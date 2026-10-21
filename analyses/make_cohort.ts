/**
 * Builds a SYNTHETIC cohort and runs every analyses/sql/*.sql over it.
 *
 *   npx tsx analyses/make_cohort.ts [players] [seed]
 *
 * What it does: starts an embedded PostgreSQL, applies the migrations, creates `players`
 * accounts and plays real matches through the real HTTP app (`createApp`). Each synthetic
 * player has a hidden loss-cut propensity drawn from Beta(2, 6) and a seeded number of
 * matches (1–8). The hidden values are written to results/truth.csv — they exist only
 * because the data is synthetic; real users have no ground truth.
 *
 * The server's daily match cap (48 per day outside tests) is switched off for this run only,
 * through the `tranNgaySuat: null` dependency, so one DB can hold a whole cohort.
 *
 * Nothing here is user data. Match seeds are chosen by the server, so a re-run is
 * statistically similar but not byte-identical; the player behaviour is seeded.
 */
import fs from 'node:fs';
import path from 'node:path';
import { startTestDb } from '../tests/helpers/testdb.js';
import { createTestUser, ensureGenesis } from '../tests/helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';

const PLAYERS = Number(process.argv[2] ?? 150);
const SEED = Number(process.argv[3] ?? 20261021);
const OUT = path.join(import.meta.dirname, 'results');
const SQL = path.join(import.meta.dirname, 'sql');
const OTHER = ['giu_vi_the', 'tang_cam_ket', 'dung_ngoai'] as const;

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Gamma(k) for integer k via sum of exponentials, enough for Beta(2, 6).
function beta(rnd: () => number, a: number, b: number) {
  const g = (k: number) => { let s = 0; for (let i = 0; i < k; i += 1) s -= Math.log(1 - rnd()); return s; };
  const x = g(a); const y = g(b);
  return x / (x + y);
}
const csv = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  return `${cols.join(',')}\n${rows.map((r) => cols.map((c) => r[c] ?? '').join(',')).join('\n')}\n`;
};

const rnd = mulberry32(SEED);
fs.mkdirSync(OUT, { recursive: true });
const db = await startTestDb();
try {
  const pool = db.pool;
  await ensureGenesis(pool);
  const app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://app.test', tickSecret: 'tick-analyses', secureCookie: false, tranNgaySuat: null });
  const truth: Record<string, unknown>[] = [];
  let skipped = 0;
  for (let i = 1; i <= PLAYERS; i += 1) {
    const handle = `syn_${String(i).padStart(3, '0')}`;
    const p = beta(rnd, 2, 6);
    const nMatches = 1 + Math.floor(rnd() * 8);
    truth.push({ handle, true_cut_loss_rate: p.toFixed(4), planned_matches: nMatches });
    const u = await createTestUser(pool, { handle });
    const req = (route: string, init: RequestInit = {}) => app.request(`http://localhost${route}`, { ...init, headers: { 'content-type': 'application/json', cookie: u.cookie } });
    for (let m = 0; m < nMatches; m += 1) {
      const rm = await req('/api/v1/holdem/matches', { method: 'POST', body: '{}' });
      if (rm.status !== 200 && rm.status !== 201) { skipped += 1; if (skipped <= 3) console.log('match refused', rm.status, (await rm.text()).slice(0, 200)); break; }
      const { match_id } = await rm.json() as { match_id: string };
      for (let v = 1; v <= 40; v += 1) {
        const action = rnd() < p ? 'cat_lo' : OTHER[Math.floor(rnd() * OTHER.length)];
        const r = await req(`/api/v1/holdem/matches/${match_id}/rounds`, { method: 'POST', body: JSON.stringify({ vong: v, hanh_dong: action, khao_sat_lai: 0 }) });
        if (r.status !== 200) break;
        if ((await r.json() as { xong?: boolean }).xong) break;
      }
    }
    if (i % 25 === 0) console.log(`  ${i}/${PLAYERS} players`);
  }
  fs.writeFileSync(path.join(OUT, 'truth.csv'), csv(truth));
  for (const f of fs.readdirSync(SQL).filter((x) => x.endsWith('.sql')).sort()) {
    const { rows } = await pool.query(fs.readFileSync(path.join(SQL, f), 'utf8'));
    fs.writeFileSync(path.join(OUT, f.replace(/\.sql$/, '.csv')), csv(rows));
    console.log(`${f}: ${rows.length} rows`);
  }
  console.log(`done · skipped players: ${skipped}`);
} finally { await db.stop(); }
