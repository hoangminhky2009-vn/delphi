/**
 * HÀNG RÀO GIỮ `config/su_kien.ts` KHÔNG TRÔI — B3 (03/09/2026, D222).
 *
 * `TRAN_SNAPSHOT` (config/su_kien.ts) là luật ĐO ĐƯỢC, không phải ước lượng. Bài
 * này chơi một trận Đấu trường THẬT qua app Hono thật, đọc lại `events`, rồi
 * khẳng định KHÔNG dòng nào vượt trần của loại nó — nếu ai đó (người hay agent)
 * nhét thêm trường vào một snapshot mà không cập nhật trần, bài này ĐỎ, nêu đúng
 * tên action_type + số đo + số trần, không cần ai nhớ để ý.
 *
 * Trận CHỦ Ý nhỏ hơn `scripts/do_co_snapshot.ts` (map 8, không cần mở khoá map
 * 16/12) để giữ bài trong ngân sách ~60s của vitest — bài đo ĐẦY ĐỦ (map 16, 8
 * ghế, mọi nhánh) là việc của script kia, chạy tay khi cần số thật mới. Ở đây chỉ
 * cần đủ để (a) hd_cam_ket — loại có snapshot to nhất — thật sự bị kiểm, và
 * (b) danh mục DB không có loại nào rơi khỏi tầm phủ của `tranSnapshot()`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
/*
 * D525 — mặc định lật sang v58 (khung minigame: màn lõi sau cú nộp, bỏ cam kết/Bảng điện tử…). Bài này canh luật ALPHA DRAFT
 * CỔ ĐIỂN mà mọi trận prod tới 05/10 chạy (v56, ghim trong golden) ⇒ tạo trận bằng khoá v56 ĐÍCH DANH.
 */
const KHOA_CO_DIEN = JSON.stringify({ ep_balance: 'balance-v56-congdon' });
import { tranSnapshot } from '../config/su_kien.js';

const TICK_SECRET = 'tick-secret-co-snapshot-test';

let db: TestDb;
let pool: pg.Pool;
let app: ReturnType<typeof createApp>;

/** Cùng kỹ thuật với `tests/events_check_du_loai.test.ts` — đọc CHECK thật trên DB. */
async function docDanhMucActionType(): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'events_action_type_check' AND conrelid = 'events'::regclass`);
  const def = rows[0]?.def as string | undefined;
  if (!def) throw new Error('không đọc được events_action_type_check — schema lệch dự đoán');
  const ra = new Set<string>();
  for (const m of def.matchAll(/'([a-z][a-z0-9_]{2,40})'::text/g)) ra.add(m[1]!);
  return [...ra].sort();
}

function reqFor(cookie: string) {
  return async (path: string, init: RequestInit = {}): Promise<Response> => app.request(
    `http://localhost${path}`,
    { ...init, headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) } },
  );
}

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  await ensureGenesis(pool);
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: TICK_SECRET, secureCookie: false,
  });

  // ── Trận map 8 (mặc định, không cần mở khoá) — dao/khoa/short mỗi vòng để
  // hd_cam_ket/hd_dao_danh_muc/hd_khoa_tai_san/hd_dat_short đều có dữ liệu thật. ──
  const u1 = await createTestUser(pool);
  const reqU1 = reqFor(u1.cookie);
  const rMatch = await reqU1('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
  // ⚠ Body của Response chỉ đọc được MỘT LẦN — `expect(status, await r.text())` rồi gọi `r.json()`
  // sau đó là đọc body lần hai, ném "Body has already been read". Kiểm status bằng if/throw (chỉ
  // đọc `.text()` LÚC LỖI) rồi mới `.json()` một lần duy nhất trên đường thường.
  if (rMatch.status !== 201) throw new Error(`POST /matches trả ${rMatch.status}: ${await rMatch.text()}`);
  const { match_id: matchId } = await rMatch.json() as { match_id: string };

  const HANH_DONG = ['giu_vi_the', 'tang_cam_ket', 'cat_lo', 'dung_ngoai'] as const;
  let shop: string[] | undefined;
  for (let vong = 1; vong <= 8; vong += 1) {
    const rBang = await reqU1(`/api/v1/holdem/matches/${matchId}/bang-dien-tu`, {
      method: 'POST', body: JSON.stringify({ vong }),
    });
    if (rBang.status !== 200) {
      throw new Error(`bang-dien-tu vòng ${vong} trả ${rBang.status}: ${await rBang.text()}`);
    }

    const body: Record<string, unknown> = {
      vong, hanh_dong: HANH_DONG[(vong - 1) % HANH_DONG.length], khao_sat_lai: 0,
      dao: { tu: 'btc', den: 'vang' }, khoa: 'usd', short: 'tpcp',
    };
    if (shop && shop.length > 0) body.mua = shop.slice(0, 2);
    const r = await reqU1(`/api/v1/holdem/matches/${matchId}/rounds`, {
      method: 'POST', body: JSON.stringify(body),
    });
    if (r.status !== 200) throw new Error(`round ${vong} trả ${r.status}: ${await r.text()}`);
    const rj = await r.json() as { xong?: boolean; shop?: { tai_san?: string[] } };
    shop = rj.shop?.tai_san;
    if (rj.xong) break;
  }

  // ── Trận hết hạn (hd_tran_het_han) — user riêng, lùi đồng hồ, tick THẬT. ──
  const u2 = await createTestUser(pool);
  const rMatch2 = await reqFor(u2.cookie)('/api/v1/holdem/matches', {
    method: 'POST', body: KHOA_CO_DIEN,
  });
  expect(rMatch2.status).toBe(201);
  const { match_id: matchId2 } = await rMatch2.json() as { match_id: string };
  await pool.query(
    `UPDATE holdem_matches SET vong_mo_luc = now() - interval '2 hours' WHERE match_id = $1`,
    [matchId2]);
  const rTick = await app.request('http://localhost/api/v1/internal/tick', {
    method: 'POST', headers: { 'x-tick-secret': TICK_SECRET },
  });
  expect(rTick.status, await rTick.text()).toBe(200);

  // ── checkin (subsidy) — action_type ngoài Đấu trường, không dùng snapshot. ──
  const u3 = await createTestUser(pool, { bankroll: 400 });
  const rSub = await reqFor(u3.cookie)('/api/v1/subsidy/claim', { method: 'POST', body: '{}' });
  expect(rSub.status, await rSub.text()).toBe(200);
}, 90_000);

afterAll(async () => { await db?.stop(); });

describe('trần state_snapshot_json theo action_type (config/su_kien.ts)', () => {
  it('⭐ KHÔNG dòng events nào vượt trần snapshot của action_type nó', async () => {
    const { rows } = await pool.query<{
      action_type: string; max_bytes: number | null; n: number;
    }>(`
      SELECT action_type, max(octet_length(state_snapshot_json::text)) AS max_bytes, count(*)::int AS n
        FROM events
       GROUP BY action_type
    `);

    expect(rows.length, 'không đọc được dòng events nào — setup trận ở beforeAll đã hỏng')
      .toBeGreaterThan(5);

    const viPham: string[] = [];
    for (const r of rows) {
      if (r.max_bytes === null) continue; // loại này không dùng cột — không có gì để kiểm
      const tran = tranSnapshot(r.action_type);
      if (r.max_bytes > tran.bytes) {
        viPham.push(`${r.action_type}: đo ${r.max_bytes}B > trần ${tran.bytes}B (n=${r.n})`);
      }
    }

    expect(viPham,
      'một hoặc nhiều action_type có state_snapshot_json vượt trần khai ở config/su_kien.ts — '
      + 'hoặc snapshot vừa phình to hơn lúc đo (D222), hoặc trần vừa bị hạ nhầm. '
      + 'Sửa snapshot (nếu phình ngoài ý muốn) hoặc đo lại + nâng trần có chủ ý (nếu phình CÓ CHỦ Ý, '
      + 'giống ca hd_cam_ket) — không sửa cả hai cùng lúc mà không hiểu vì sao đỏ.')
      .toEqual([]);
  });

  it('mọi action_type trong danh mục DB đều có câu trả lời từ tranSnapshot() (đo hoặc mặc định)',
    async () => {
      const danhMuc = await docDanhMucActionType();
      expect(danhMuc.length, 'không rút được action_type nào từ CHECK — regex hỏng, không phải repo sạch')
        .toBeGreaterThan(10);

      for (const loai of danhMuc) {
        const tran = tranSnapshot(loai);
        expect(tran.bytes, `tranSnapshot('${loai}') trả về trần âm hoặc NaN — hỏng công thức mặc định`)
          .toBeGreaterThanOrEqual(0);
        expect(tran.vi_sao.length, `tranSnapshot('${loai}') thiếu lý do — mọi entry (kể cả mặc định) `
          + 'phải nói được VÌ SAO').toBeGreaterThan(0);
      }
    });
});
