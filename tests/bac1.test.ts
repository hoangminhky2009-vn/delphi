/**
 * BẬC 1 — HỎI NHÂN KHẨU SAU TRẬN ĐẦU (D64 phương án B; founder chốt 04/08).
 *
 * ⚠⚠ CỬA NÀY KHÔNG CHẶN AI, và các bài dưới đây khoá đúng điều đó. Founder bác
 * lý do "age gate vì nội dung" — không có nội dung người lớn, không phải cá cược
 * — nên thứ còn lại chỉ là một CÂU HỎI. Bỏ qua là một câu trả lời hợp lệ.
 *
 * Thứ thật sự được bảo vệ ở đây là DỮ LIỆU: A1 nói app cho người Việt 16–30, và
 * `events` append-only (A3.3) nên không hỏi hôm nay là vĩnh viễn không gắn nhãn
 * lại được cho mọi trận đã chơi.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { ensureGenesis } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { CONSENT_PHIEN_BAN } from '../config/pfm_consent.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

let ipSeq = 0;
/** Một người chơi bậc 0 mới toanh (cửa KHÁCH — đường mà Discord cũng rơi vào). */
async function nguoiMoi(): Promise<{ token: string; handle: string }> {
  ipSeq += 1;
  const r = await app.request('/api/v1/auth/khach', {
    method: 'POST', headers: { 'x-forwarded-for': `198.51.100.${100 + ipSeq}` },
  });
  const b = (await r.json()) as { token: string; handle: string };
  /*
   * B5 (D613, vá đợt 1 Gói 2) — CỔNG TUỔI dời lên TRƯỚC trận đầu: khách gặp tấm hỏi năm sinh (`POST /me/tuoi`, chỉ ghi mốc, KHÔNG
   * ghi `age_band`) rồi mới chơi. Tấm nhân khẩu bậc 1 ở đây vẫn là câu HỎI sau trận đầu, vẫn không khoá gì — bài này canh đúng thế.
   */
  const tuoi = await app.request('/api/v1/me/tuoi', {
    method: 'POST',
    headers: { authorization: `Bearer ${b.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ birth_year: new Date().getUTCFullYear() - 20 }),
  });
  expect(tuoi.status).toBe(200);
  return b;
}

const me = async (token: string) =>
  (await (await app.request('/api/v1/auth/me', {
    headers: { authorization: `Bearer ${token}` },
  })).json()) as any;

const choiMotTran = (token: string) =>
  app.request('/api/v1/holdem/matches', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

const khai = (token: string, body: unknown) =>
  app.request('/api/v1/me/nhan-khau', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const hangUser = async (handle: string) =>
  (await pool.query(
    `SELECT age_band, region, occupation_band, nhan_khau_hoi_luc FROM users WHERE handle = $1`,
    [handle],
  )).rows[0];

describe('I. Thời điểm hỏi — SAU trận đầu, không phải lúc vào', () => {
  /*
   * ⚠ Đây là cả nội dung của phương án B: bậc 0 ngồi xuống chơi ngay, không một
   * câu hỏi nào. Hỏi trước trận đầu là dựng lại đúng cái biểu mẫu vừa bỏ đi.
   */
  it('người mới CHƯA chơi trận nào → không hỏi', async () => {
    const u = await nguoiMoi();
    expect((await me(u.token)).hoi_nhan_khau).toBe(false);
  });

  it('chơi xong trận đầu → mới hỏi', async () => {
    const u = await nguoiMoi();
    expect((await choiMotTran(u.token)).status).toBe(201);
    expect((await me(u.token)).hoi_nhan_khau).toBe(true);
  });

  /*
   * Người đăng ký bằng email đã khai lúc đăng ký. Hỏi lại là hỏi thừa, và cửa
   * này không phải cửa "đổi hồ sơ".
   */
  it('người đã có age_band thì KHÔNG bao giờ bị hỏi', async () => {
    const u = await nguoiMoi();
    await choiMotTran(u.token);
    await khai(u.token, { birth_year: 2000, region: 'bac', occupation_band: 'van_phong' });
    expect((await me(u.token)).hoi_nhan_khau).toBe(false);
  });
});

describe('II. Khai — C7: chỉ lưu KHOẢNG, không lưu năm sinh', () => {
  it('khai đủ → lưu đúng nhóm tuổi + vùng + nghề', async () => {
    const u = await nguoiMoi();
    await choiMotTran(u.token);
    const r = await khai(u.token, {
      birth_year: 2009, region: 'nam', occupation_band: 'hs_sv',
    });
    expect(r.status).toBe(200);
    expect((await r.json() as any).da_luu).toBe(true);

    const h = await hangUser(u.handle);
    expect(h.age_band).toBe('16-17');   // 2026 − 2009 = 17
    expect(h.region).toBe('nam');
    expect(h.occupation_band).toBe('hs_sv');
    expect(h.nhan_khau_hoi_luc).not.toBeNull();
  });

  /*
   * ⚠⚠ BÀI CANH C7. Năm sinh là thứ ta CỐ Ý không giữ; nó chỉ tồn tại trong một
   * request rồi biến mất. Ai "tiện thể" thêm một cột `birth_year` cho dễ tính
   * tuổi thì bài này đỏ — và đó đúng là kiểu tiện tay khó thấy nhất khi review.
   */
  it('⭐ NĂM SINH không nằm ở bất kỳ cột nào của users', async () => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users' AND (column_name LIKE '%birth%' OR column_name LIKE '%nam_sinh%')`,
    );
    expect(rows, 'lưu năm sinh đầy đủ là vi phạm C7').toEqual([]);
  });

  it('ghi event `onboard_demo` kèm dấu bậc 1 — phân biệt với khai lúc đăng ký', async () => {
    const u = await nguoiMoi();
    await choiMotTran(u.token);
    await khai(u.token, { birth_year: 1995, region: 'trung', occupation_band: 'tu_do' });

    const { rows } = await pool.query(
      `SELECT e.value_json FROM events e
         JOIN users u ON u.user_id = e.user_id
        WHERE u.handle = $1 AND e.action_type = 'onboard_demo'`, [u.handle]);
    expect(rows).toHaveLength(1);
    expect(rows[0].value_json).toMatchObject({ age_band: '31-45', bac: 1 });
    expect(rows[0].value_json.birth_year, 'năm sinh rò vào events là RÒ VĨNH VIỄN')
      .toBeUndefined();
  });
});

describe('III. Bỏ qua — một câu trả lời hợp lệ, không phải thất bại', () => {
  it('bỏ qua → không lưu nhân khẩu, nhưng KHÔNG hỏi lại nữa', async () => {
    const u = await nguoiMoi();
    await choiMotTran(u.token);
    const r = await khai(u.token, { bo_qua: true });
    expect(r.status).toBe(200);
    expect((await r.json() as any).da_luu).toBe(false);

    const h = await hangUser(u.handle);
    expect(h.age_band).toBeNull();
    expect(h.nhan_khau_hoi_luc, 'không ghi mốc ⇒ hỏi lại vĩnh viễn người đã từ chối')
      .not.toBeNull();
    expect((await me(u.token)).hoi_nhan_khau).toBe(false);
  });

  it('bỏ qua rồi vẫn chơi được bình thường — cửa này không khoá gì', async () => {
    const u = await nguoiMoi();
    await choiMotTran(u.token);
    await khai(u.token, { bo_qua: true });
    expect((await choiMotTran(u.token)).status, 'bỏ qua mà bị chặn chơi = đã thành cái cửa').toBe(201);
  });
});

describe('IV. Dưới tuổi — báo, KHÔNG chặn, và KHÔNG khoá luôn cơ hội khai lại', () => {
  it('khai dưới ngưỡng → 400 và không lưu gì', async () => {
    const u = await nguoiMoi();
    await choiMotTran(u.token);
    const r = await khai(u.token, { birth_year: 2015, region: 'bac', occupation_band: 'hs_sv' });
    expect(r.status).toBe(400);
    expect((await r.json() as any).error).toBe('duoi_tuoi');

    const h = await hangUser(u.handle);
    expect(h.age_band).toBeNull();
  });

  /*
   * ⚠ Gõ nhầm năm sinh là chuyện thường. Ghi mốc "đã hỏi" ở nhánh lỗi là đóng
   * cửa VĨNH VIỄN vì một cú gõ nhầm — họ không bao giờ khai lại được nữa.
   */
  it('⭐ gõ nhầm rồi sửa lại → vẫn khai được', async () => {
    const u = await nguoiMoi();
    await choiMotTran(u.token);
    await khai(u.token, { birth_year: 2015, region: 'bac', occupation_band: 'hs_sv' });
    expect((await me(u.token)).hoi_nhan_khau, 'một cú gõ nhầm đã khoá cửa').toBe(true);

    const r = await khai(u.token, { birth_year: 1998, region: 'bac', occupation_band: 'hs_sv' });
    expect(r.status).toBe(200);
    expect((await hangUser(u.handle)).age_band).toBe('23-30');
  });

  /*
   * ⚠ Đổi nghĩa 19/10 (D613 B5): "không chặn ai" nay chỉ đúng với TẤM NHÂN KHẨU — cổng tuổi C8 đứng ở `/me/tuoi` trước trận đầu
   * (`tests/age_gate_moi_duong.test.ts`). Người đã qua cổng mà gõ nhầm năm ở tấm này thì vẫn chơi: tấm này không phải cổng.
   */
  it('đã qua cổng tuổi, gõ năm dưới tuổi ở tấm nhân khẩu ⇒ vẫn CHƠI được — tấm này không chặn ai', async () => {
    const u = await nguoiMoi();
    await choiMotTran(u.token);
    await khai(u.token, { birth_year: 2015, region: 'bac', occupation_band: 'hs_sv' });
    expect((await choiMotTran(u.token)).status).toBe(201);
  });

  it('năm sinh vô nghĩa → 400, không nổ 500', async () => {
    const u = await nguoiMoi();
    await choiMotTran(u.token);
    for (const y of [0, 1800, 9999]) {
      const r = await khai(u.token, { birth_year: y, region: 'bac', occupation_band: 'hs_sv' });
      expect(r.status, `năm ${y}`).toBe(400);
    }
  });
});

describe('V. Không cho ghi đè nhân khẩu đã có', () => {
  it('người đã khai rồi gọi lại → KHÔNG đổi được (đây không phải cửa sửa hồ sơ)', async () => {
    const u = await nguoiMoi();
    await choiMotTran(u.token);
    await khai(u.token, { birth_year: 2000, region: 'bac', occupation_band: 'van_phong' });
    const r = await khai(u.token, { birth_year: 1990, region: 'nam', occupation_band: 'tu_do' });
    expect(r.status).toBe(200);
    expect((await r.json() as any).da_luu).toBe(false);

    const h = await hangUser(u.handle);
    expect(h.age_band).toBe('23-30');
    expect(h.region).toBe('bac');
  });

  it('chưa đăng nhập → 401, không ai khai hộ ai', async () => {
    const r = await app.request('/api/v1/me/nhan-khau', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bo_qua: true }),
    });
    expect(r.status).toBe(401);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * VI. VÒNG KHÉP KÍN — đồng ý xong thì telemetry PHẢI chảy trở lại
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ⚠⚠ ĐÂY LÀ BÀI CANH ĐÚNG CÁI BUG ĐÃ XẢY RA (prod 04/08, và nó là hậu quả của
 * chính bản vá auto-khách): `server/telemetry.ts` bỏ IM LẶNG mọi dòng của user có
 * `research_consent !== true` và vẫn trả 202. Khách sinh ra với consent = false,
 * nên từ lúc ai cũng tự động có phiên khách thì telemetry TẮT LỊM cho cả mùa —
 * `loi_client` · `man_vao` · `tran_thoat` đều im, và sự im lặng ấy trông y hệt
 * "không có lỗi nào".
 *
 * Cửa consent làm đúng việc của nó. Chỗ hỏng là KHÔNG AI HỎI KHÁCH BAO GIỜ. Bài
 * này khoá cả hai vế: trước khi đồng ý phải câm, sau khi đồng ý phải chảy.
 */
describe('VI. Đồng ý xong thì telemetry chảy lại', () => {
  const guiDo = (token: string) =>
    app.request('/api/v1/telemetry', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        idempotency_key: `k-${Math.random().toString(36).slice(2)}`,
        su_kien: [{ loai: 'man_vao', man: '/', ts: new Date().toISOString() }],
      }),
    });

  const demDong = async (handle: string) =>
    (await pool.query(
      `SELECT count(*)::int n FROM telemetry t JOIN users u ON u.user_id = t.user_id
        WHERE u.handle = $1`, [handle])).rows[0].n;

  it('⭐ khách chưa đồng ý → 202 nhưng KHÔNG ghi dòng nào (đúng cái đã xảy ra)', async () => {
    const u = await nguoiMoi();
    expect((await guiDo(u.token)).status).toBe(202);
    expect(await demDong(u.handle), 'ghi khi chưa đồng ý = vỡ lời hứa điều khoản §5.4').toBe(0);
  });

  it('⭐ bật đồng ý ở bậc 1 → cùng một lô ĐÓ giờ vào được', async () => {
    const u = await nguoiMoi();
    expect((await guiDo(u.token)).status).toBe(202);
    expect(await demDong(u.handle)).toBe(0);

    const r = await app.request('/api/v1/account/consent', {
      method: 'POST',
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ research_consent: true, van_ban_id: 'nghien_cuu', phien_ban: CONSENT_PHIEN_BAN.nghien_cuu }),   // 0079 — bật kèm văn bản
    });
    expect(r.status).toBe(200);

    expect((await guiDo(u.token)).status).toBe(202);
    expect(await demDong(u.handle), 'đồng ý rồi mà vẫn câm = app mù về chính nó').toBe(1);
  });

  it('tắt lại → câm ngay, không cần đăng nhập lại', async () => {
    const u = await nguoiMoi();
    const dat = (v: boolean) => app.request('/api/v1/account/consent', {
      method: 'POST',
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(v ? { research_consent: v, van_ban_id: 'nghien_cuu', phien_ban: CONSENT_PHIEN_BAN.nghien_cuu } : { research_consent: v }),
    });
    await dat(true);
    await guiDo(u.token);
    expect(await demDong(u.handle)).toBe(1);

    await dat(false);
    await guiDo(u.token);
    expect(await demDong(u.handle), 'tắt rồi vẫn ghi = công tắc trang trí').toBe(1);
  });
});
