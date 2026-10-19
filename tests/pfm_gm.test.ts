/**
 * NỐI DÂY GAME → SỔ QUA HTTP THẬT (D324). Hàm thuần đã có `tests/tin_hieu.test.ts`; ở đây
 * chỉ hỏi câu hàm thuần không trả lời được: ĐƯỜNG CHẠY có đọc cửa `noi_game` không, có ghi
 * đúng kỳ không, và cửa client có chặn mã của server không.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { CUA_PFM, CONSENT_PHIEN_BAN, vanBanCua, type CuaPfm } from '../config/pfm_consent.js';
import { SCHEMA_VERSION } from '../config/pfm_dac_trung.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
}, 120_000);

afterAll(async () => { await db?.stop(); });

const batCua = (u: TestUser, cua: CuaPfm) => app.request('/api/v1/pfm/consent', {
  method: 'POST', headers: { cookie: u.cookie, 'content-type': 'application/json' },
  body: JSON.stringify({ cua, bat: true, van_ban_id: vanBanCua(cua), phien_ban: CONSENT_PHIEN_BAN[vanBanCua(cua)] }),
});

/** ⚠ `content-length` đặt tay — `app.request()` không tự đặt, thiếu thì 411 (xem pfm_api §X). */
const postLo = (u: TestUser, mon: unknown) => {
  const than = JSON.stringify({ mon });
  return app.request('/api/v1/pfm/dong-bo', {
    method: 'POST',
    headers: {
      cookie: u.cookie, 'content-type': 'application/json',
      'content-length': String(new TextEncoder().encode(than).byteLength),
    },
    body: than,
  });
};

const kySong = async (u: TestUser): Promise<string> => {
  const { rows } = await pool.query(
    `SELECT to_char(now() AT TIME ZONE mui_gio, 'YYYY-MM') AS k FROM users WHERE user_id = $1`, [u.userId]);
  return rows[0].k as string;
};

const dongGm = async (u: TestUser) => (await pool.query(
  `SELECT ma, gia_tri, nguon, to_char(ky, 'YYYY-MM') AS ky, schema_version
     FROM pfm_dac_trung WHERE user_id = $1 AND ma LIKE 'gm\\_%' ORDER BY ma`, [u.userId])).rows;

const goi = (id: string, ky: string, dong: unknown[]) => ({ id, loai: 'goi', ky, schema_v: SCHEMA_VERSION, dong });

describe('D324 — ghép tín hiệu game vào đặc trưng PFM theo kỳ', () => {
  it('⭐ cửa noi_game MỞ ⇒ lô có gói kỳ này kéo theo gm_n_tran của CÙNG kỳ, nguồn xac_minh', async () => {
    const u = await createTestUser(pool);
    for (const cua of CUA_PFM) expect((await batCua(u, cua)).status).toBe(200);
    const ky = await kySong(u);
    const r = await postLo(u, [goi('g1', ky, [{ ma: 'hv_chi_bu', gia_tri: 0.2 }])]);
    expect(r.status).toBe(200);
    const gm = await dongGm(u);
    // Chưa trận nào ⇒ đúng MỘT dòng: 0 trận hợp lệ là quan sát thật; bốn mã kia vắng (null ≠ 0).
    expect(gm).toEqual([{ ma: 'gm_n_tran', gia_tri: 0, nguon: 'xac_minh', ky, schema_version: SCHEMA_VERSION }]);
  });

  it('⭐ cửa noi_game ĐÓNG (ba cửa kia mở) ⇒ lô vẫn ghi gói sổ, KHÔNG một dòng game nào', async () => {
    const u = await createTestUser(pool);
    for (const cua of CUA_PFM.filter((k) => k !== 'noi_game')) await batCua(u, cua);
    const ky = await kySong(u);
    const r = await postLo(u, [goi('g1', ky, [{ ma: 'hv_chi_bu', gia_tri: 0.2 }])]);
    expect(r.status).toBe(200);
    expect(((await r.json()) as any).ghi).toBe(1);
    expect(await dongGm(u)).toEqual([]);
  });

  it('client gửi mã gm_* ⇒ cả gói bị bỏ kèm lý do, và gói bỏ không kéo theo dòng game nào', async () => {
    const u = await createTestUser(pool);
    for (const cua of CUA_PFM) await batCua(u, cua);
    const ky = await kySong(u);
    const r = await postLo(u, [goi('g1', ky, [{ ma: 'gm_tk_giu', gia_tri: 1 }])]);
    expect(r.status).toBe(200);
    const j = (await r.json()) as any;
    expect(j.bo).toBe(1);
    expect(j.ket[0].ly_do).toMatch(/server tính/);
    expect(await dongGm(u)).toEqual([]);
  });

  /**
   * Dựng MỘT trận + MỘT vòng hợp lệ, `ts` đặt tương đối so với đầu tháng THEO MÚI GIỜ
   * CỦA USER. Đây là dụng cụ để hỏi đúng câu ranh kỳ, không phải để đo tín hiệu.
   */
  const vongLuc = async (u: TestUser, buTruDauThang: string): Promise<void> => {
    const { rows } = await pool.query(
      `INSERT INTO holdem_matches
         (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json, engine_version,
          balance_version, season_id, started_at, ended_at, so_o, che_do)
       VALUES ($1, 7, 'xong', 8, '[]'::jsonb, '[]'::jsonb, 'e', 'b', '2026Q3', now(), now(), 8, 'tu_do')
       RETURNING match_id::text AS id`, [u.userId]);
    await pool.query(
      `INSERT INTO hanh_vi_vong (user_id, match_id, vong, ts, tran_xong, formula_version)
       SELECT $1, $2, 1,
              (date_trunc('month', now() AT TIME ZONE u.mui_gio) + $3::interval) AT TIME ZONE u.mui_gio,
              true, 1
         FROM users u WHERE u.user_id = $1`, [u.userId, rows[0].id, buTruDauThang]);
  };

  it('⭐ D364 — ranh kỳ theo MÚI GIỜ USER: vòng lúc 00:30 mùng 1 thuộc kỳ NÀY, 23:30 hôm trước thì không', async () => {
    /*
     * Phiên test chạy UTC như prod (xem `tests/mui_gio.test.ts` §II). Câu cũ so `ts` với
     * `('YYYY-MM' || '-01')::date` trần ⇒ Postgres nâng cái ngày ấy bằng múi giờ PHIÊN ⇒
     * tháng bắt đầu lúc 07:00 sáng VN ⇒ vòng 00:30 mùng 1 rơi sang kỳ TRƯỚC. Hai mốc dưới
     * kẹp đúng hai bên ranh, nên bài này đỏ nếu ai đó trả câu SQL về dạng cũ.
     */
    const u = await createTestUser(pool);
    for (const cua of CUA_PFM) expect((await batCua(u, cua)).status).toBe(200);
    const ky = await kySong(u);

    await vongLuc(u, '30 minutes');   // 00:30 mùng 1 giờ VN — TRONG kỳ
    await vongLuc(u, '-30 minutes');  // 23:30 ngày cuối tháng trước — NGOÀI kỳ

    expect((await postLo(u, [goi('g1', ky, [{ ma: 'hv_chi_bu', gia_tri: 0.2 }])])).status).toBe(200);
    const nTran = (await dongGm(u)).find((d) => d.ma === 'gm_n_tran');
    expect(nTran?.ky).toBe(ky);
    expect(nTran?.gia_tri, 'đúng MỘT trận nằm trong kỳ theo giờ VN').toBe(1);
  });

  it('GET /holdem/me/tin-hieu ⇒ tín hiệu của chính chủ, gắn nhãn chưa hiệu chuẩn', async () => {
    const u = await createTestUser(pool);
    const r = await app.request('/api/v1/holdem/me/tin-hieu', { headers: { cookie: u.cookie } });
    expect(r.status).toBe(200);
    const t = (await r.json()) as any;
    expect(t.hieu_chuan).toBe('chua');
    expect(t.n_tran).toBe(0);
    expect(t.tiet_kiem).toBeNull();
    expect(Object.keys(t.chi_so).sort()).toEqual(
      ['chot_non', 'don_von', 'duoi_gia', 'hieu_chinh', 'khau_vi', 'mua_tin', 'theo_tin']);
  });
});
