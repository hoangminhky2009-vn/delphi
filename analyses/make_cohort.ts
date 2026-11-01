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
 * For the funnel and week-2 queries (04, 05) the cohort also gets a lifecycle, drawn from a
 * second seeded stream so the match behaviour above is unchanged: signup days spread over the
 * last 8 weeks, an age band skewed to 18-30 (so some bands are small), research consent on
 * for ~85 %, tutorial finished for ~75 % of those, an app open on the signup day, and a week-2
 * app open with probability 0.20 + 0.05 × planned matches. A further 20 % of accounts never
 * create a profile (half of them never verify their e-mail). Telemetry is written only for
 * consenting players, as the product does. These are the generator's assumptions, not
 * findings; they are written to truth.csv next to the behaviour.
 *
 * Limit: no synthetic match FINISHES. After the last round the server waits for an
 * end-of-match mini-game that runs on a real-time clock (409 `tran_da_het`), and the
 * generator does not play it. Matches stay `dang_choi`, there is no `hd_match_end` event,
 * and any count of finished matches is 0 here.
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
import { SEED_MAN_TAP_MOI_THOI } from '../config/holdem.js';

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
const life = mulberry32(SEED ^ 0x5eed);
const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;
// Midnight of today in Vietnam, as a UTC instant; signups are placed between 08:00 and 20:00 VN.
const todayVN = Math.floor((Date.now() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS;
const signupAt = (daysAgo: number) => new Date(todayVN - daysAgo * DAY_MS + (8 + life() * 12) * 3_600_000);
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
    // Lifecycle (second stream). Matches above were played "now"; only the funnel steps and app opens are dated.
    const daysAgo = Math.floor(life() * 56);
    const at = signupAt(daysAgo);
    const consent = life() < 0.85;
    const tutorial = consent && life() < 0.75;
    const returnsW2 = consent && life() < 0.2 + 0.05 * nMatches;
    const w2 = new Date(at.getTime() + (7 + Math.floor(life() * 7)) * DAY_MS);
    const a = life();
    const ageBand = a < 0.03 ? '16-17' : a < 0.6 ? '18-22' : a < 0.94 ? '23-30' : a < 0.98 ? '31-45' : '46+';
    await pool.query('UPDATE users SET created_at = $2, research_consent = $3, age_band = $4 WHERE user_id = $1', [u.userId, at, consent, ageBand]);
    await pool.query('UPDATE auth_accounts SET created_at = $2, email_verified_at = $2 WHERE user_id = $1', [u.userId, at]);
    if (consent) {
      const tel = (ts: Date, loai: string, chiTiet: unknown = null) => pool.query(
        'INSERT INTO telemetry (user_id, ts, loai, chi_tiet) VALUES ($1, $2, $3, $4)', [u.userId, ts, loai, chiTiet]);
      await tel(at, 'phien_mo');
      if (tutorial) await tel(new Date(at.getTime() + 300_000), 'huong_dan_buoc', { buoc: 'het' });
      // A week-2 open that would lie in the future is not written: that window has not happened yet.
      if (returnsW2 && w2.getTime() < Date.now()) await tel(w2, 'phien_mo');
    }
    Object.assign(truth[truth.length - 1], {
      signup_days_ago: daysAgo, age_band: ageBand, consent: Number(consent), tutorial: Number(tutorial), returns_week2: Number(returnsW2),
    });
    if (i % 25 === 0) console.log(`  ${i}/${PLAYERS} players`);
  }
  // Accounts that never create a profile: e-mail only, half of them never verified.
  for (let j = 1; j <= Math.round(PLAYERS * 0.2); j += 1) {
    const at = signupAt(Math.floor(life() * 56));
    await pool.query(
      `INSERT INTO auth_accounts (email, password_hash, email_verified_at, created_at) VALUES ($1, 'x', $2, $3)`,
      [`syn_pending_${String(j).padStart(3, '0')}@example.invalid`, life() < 0.5 ? at : null, at]);
  }
  fs.writeFileSync(path.join(OUT, 'truth.csv'), csv(truth));
  for (const f of fs.readdirSync(SQL).filter((x) => x.endsWith('.sql')).sort()) {
    const text = fs.readFileSync(path.join(SQL, f), 'utf8').replaceAll(':practice_seeds', SEED_MAN_TAP_MOI_THOI.join(', '));
    const { rows } = await pool.query(text);
    fs.writeFileSync(path.join(OUT, f.replace(/\.sql$/, '.csv')), csv(rows));
    console.log(`${f}: ${rows.length} rows`);
  }
  console.log(`done · skipped players: ${skipped}`);
} finally { await db.stop(); }
