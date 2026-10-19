/**
 * PFM — TẦNG API `/api/v1/pfm/*` qua HTTP thật (GĐ1, nối `05b` Phụ lục T2).
 *
 * Đồ thật: `app.request()` + embedded Postgres (A8.9) — không mock đường HTTP. Các
 * bài đơn vị của `ngay.ts`/`token.ts`/`xoa.ts` đã nằm ở `tests/pfm_nghiep_vu.test.ts`;
 * ở đây CHỈ kiểm phần MỚI của tầng này: cổng auth/khách, trần content-length (T5.7),
 * K5 tại runtime, và `ket.ts` (xoay thế hệ + chống ghi đè mù) — chưa có bài nào canh.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { chanContentLength, laThangHopLe, DUONG_PFM } from '../server/pfm/api.js';
import { tuanNiemPhongCuaUser } from '../server/pfm/tuan.js';
import { PFM, PFM_LO, LAT_SONG_THANG, LAT_SONG, thangGuiLen, latTuThang } from '../config/pfm.js';
import {
  CUA_PFM, CUA_PFM_COT, CUA_CANH_DUONG, CONSENT_PHIEN_BAN, vanBanCua, type CuaPfm,
} from '../config/pfm_consent.js';

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

const guest = async (): Promise<string> => {
  const r = await app.request('/api/v1/auth/khach', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  return (r.headers.get('set-cookie') ?? '').split(';')[0]!;
};

/*
 * ⚠ BẬT phải kèm VẾT VĂN BẢN CỦA ĐÚNG CỬA (R1/D295); TẮT thì không — rút lại đồng ý
 * không bao giờ được dựng thêm rào. Helper phản ánh đúng bất đối xứng đó. Văn bản lấy
 * từ config (`vanBanCua` + `CONSENT_PHIEN_BAN`), không gõ tay `'v1'` ở đây.
 */
const batCua = async (u: TestUser, cua: CuaPfm, bat = true, vet?: Record<string, unknown>) =>
  app.request('/api/v1/pfm/consent', {
    method: 'POST', headers: { cookie: u.cookie, 'content-type': 'application/json' },
    body: JSON.stringify(
      bat
        ? { cua, bat, van_ban_id: vanBanCua(cua), phien_ban: CONSENT_PHIEN_BAN[vanBanCua(cua)], ...vet }
        : { cua, bat },
    ),
  });

/** "Công tắc chung" của test: mở CẢ BỐN cửa — đúng điều màn cài đặt làm khi bấm nút chung. */
const batPfm = async (u: TestUser) => {
  let r!: Response;
  for (const cua of CUA_PFM) r = await batCua(u, cua, true);
  return r;
};

/** Mở ĐÚNG những cửa được nêu, các cửa khác để đóng. */
const chiMo = async (u: TestUser, mo: readonly CuaPfm[]) => {
  for (const cua of mo) await batCua(u, cua, true);
};

const docCuaDb = async (u: TestUser): Promise<Record<CuaPfm, boolean> & { pfm_consent: boolean; pfm_bat_dau: unknown }> => {
  const { rows } = await pool.query(
    `SELECT pfm_consent, pfm_bat_dau,
            ${CUA_PFM.map((cua) => `${CUA_PFM_COT[cua]} AS ${cua}`).join(', ')}
       FROM users WHERE user_id = $1`, [u.userId]);
  return rows[0];
};

const demEventCua = async (u: TestUser, ma: string): Promise<number> => (await pool.query(
  `SELECT count(*)::int AS n FROM events WHERE user_id = $1 AND action_type = $2`,
  [u.userId, ma])).rows[0].n as number;

/*
 * ⚠⚠ R4/D251 — ĐIỂM DANH HÔM NAY KHÔNG TÍNH VÀO TUẦN ĐƯỢC NIÊM PHONG, trừ Chủ
 * nhật. Nghi lễ chốt **tuần gần nhất đã kết thúc**, còn `/pfm/diem-danh` thì luôn
 * ghi vào HÔM NAY và không nhận ngày giả. Nên các bài dưới phải ghi thẳng vào
 * `pfm_ngay` một ngày nằm TRONG tuần ấy — không có đường vòng nào khác.
 */
const coMatTrongTuanNiemPhong = async (u: TestUser, buLui = 0) => {
  await pool.query(
    `INSERT INTO pfm_ngay (user_id, ngay, trang_thai)
     VALUES ($1, $2::date + $3::int, 'co_ghi')
     ON CONFLICT (user_id, ngay) DO NOTHING`,
    [u.userId, await tuanNiemPhongCuaUser(pool, u.userId), buLui]);
  /*
   * ⚠⚠ ĐIỂM DANH CẢ HÔM NAY — route không nhận ngày (K7: server tự tính, không tin
   * client), nên bài test API không bơm được ngày giả như bài nghiệp vụ. Cách duy nhất
   * để nó tất định qua mọi thứ trong tuần là **thoả điều kiện của rào Chủ nhật**.
   * ⇒ Ngày thường: hôm nay nằm NGOÀI tuần được niêm phong (tuần trước) nên dòng này
   *   không đổi phép đếm. Chủ nhật: hôm nay CHÍNH LÀ ngày cuối tuần ấy, và rào đòi đúng
   *   nó. Không có dòng này thì bộ test xanh sáu ngày, đỏ vào Chủ nhật — đã xảy ra thật.
   */
  await pool.query(
    `INSERT INTO pfm_ngay (user_id, ngay, trang_thai)
     SELECT $1, (now() AT TIME ZONE mui_gio)::date, 'co_ghi' FROM users WHERE user_id = $1
     ON CONFLICT (user_id, ngay) DO NOTHING`,
    [u.userId]);
};

/** Thứ trong tuần theo múi giờ CỦA USER (ISO: 1=T2 … 7=CN) — không đọc đồng hồ máy test. */
const thuCuaUser = async (u: TestUser): Promise<number> => Number((await pool.query(
  `SELECT to_char(now() AT TIME ZONE mui_gio, 'ID') AS t FROM users WHERE user_id = $1`,
  [u.userId])).rows[0].t);

const diemDanh = async (u: TestUser, trangThai: string) =>
  app.request('/api/v1/pfm/diem-danh', {
    method: 'POST', headers: { cookie: u.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ trang_thai: trangThai }),
  });

const thangSong = async (userId: string): Promise<string> => {
  const { rows } = await pool.query(
    `SELECT to_char(date_trunc('month', now() AT TIME ZONE u.mui_gio), 'YYYY-MM-DD') AS t
       FROM users u WHERE u.user_id = $1`, [userId]);
  return rows[0].t as string;
};

const postTuan = async (u: TestUser) =>
  app.request('/api/v1/pfm/tuan', { method: 'POST', headers: { cookie: u.cookie } });

const luuUrl = (thang: string, schemaV: number, ver: number) =>
  `/api/v1/pfm/luu?thang=${thang}&schema_v=${schemaV}&ver=${ver}`;

/**
 * ⚠ `content-length` phải ĐẶT TAY: một client HTTP thật (trình duyệt, curl) luôn kèm
 * header này khi gửi thân — đó là thứ `chanContentLength` dựa vào (T5.7). Nhưng
 * `app.request()` dựng thẳng một `Request` trong process, KHÔNG đi qua dây mạng, nên
 * KHÔNG tự điền header này cho thân dạng Buffer — phải mô phỏng đúng client thật.
 */
const postLuu = async (u: TestUser, thang: string, schemaV: number, ver: number, bytes: Buffer) =>
  app.request(luuUrl(thang, schemaV, ver), {
    method: 'POST',
    headers: {
      cookie: u.cookie,
      'content-type': 'application/octet-stream',
      'content-length': String(bytes.byteLength),
    },
    body: bytes,
  });

describe('§I — laThangHopLe (hàm thuần)', () => {
  it('nhận đúng YYYY-MM-01, từ chối mọi hình dạng khác', () => {
    expect(laThangHopLe('2026-08-01')).toBe(true);
    expect(laThangHopLe('2026-08-15')).toBe(false);   // không phải ngày 1
    expect(laThangHopLe('2026-13-01')).toBe(false);    // tháng 13
    expect(laThangHopLe('hom-nay')).toBe(false);
    expect(laThangHopLe(undefined)).toBe(false);
  });
});

describe('§I-bis — R15: mốc LÁT SỐNG (D251)', () => {
  it('⭐ LAT_SONG_THANG phải qua được chính bộ lọc `thang` của route', () => {
    // Nếu bộ lọc siết lại mà quên mốc này thì hũ/luật MẤT ĐƯỜNG VÀO KÉT — im lặng.
    expect(laThangHopLe(LAT_SONG_THANG)).toBe(true);
  });
});

describe('§I-ter — ⭐⭐ HAI ĐẦU DÂY: thứ CLIENT sinh ra phải qua được bộ lọc SERVER', () => {
  it('mọi `thangGuiLen()` của client đều được `laThangHopLe()` của server nhận', () => {
    /*
     * ⚠⚠ ĐÂY LÀ BÀI KIỂU D259, và nó tồn tại vì R8: hai đầu dây mỗi bên tự nhất quán mà
     * không bao giờ nối được. `thangGuiLen` (client, `config/pfm.ts`) là hàm DUY NHẤT
     * sinh ra tham số `?thang=`; `laThangHopLe` (server, `server/pfm/api.ts`) là bộ lọc
     * DUY NHẤT nhận nó. Bộ test của driver két dựng máy chủ giả — mà máy chủ giả ấy cũng
     * gọi `thangGuiLen`, nên nó KHÔNG BAO GIỜ bắt được một cú lệch giữa hai hàm này.
     * ⇒ Chỗ duy nhất bắt được là ở đây, nơi cả hai hàm THẬT cùng có mặt trong một tiến
     *   trình. Siết bộ lọc một đầu mà quên đầu kia ⇒ két câm, im lặng, cho tới ngày ai
     *   đó cần khôi phục.
     */
    for (const maLat of ['2026-01', '2026-09', '2026-12', '2099-12', LAT_SONG]) {
      expect(laThangHopLe(thangGuiLen(maLat)), `mã lát "${maLat}"`).toBe(true);
    }
  });

  it('`latTuThang` là NGHỊCH ĐẢO thật của `thangGuiLen` — vòng đi về không lệch', () => {
    // Đường khôi phục đọc `thang` từ server rồi quy về mã lát. Một vòng không khép là
    // lát khôi phục về sai chỗ: nội dung tháng 9 trộn vào tháng 1, không ai báo.
    for (const maLat of ['2026-01', '2026-09', LAT_SONG]) {
      expect(latTuThang(thangGuiLen(maLat))).toBe(maLat);
    }
  });
});

describe('§II — trần content-length (T5.7) — không tiêu thụ luồng body', () => {
  it('⭐ THIẾU HEADER ⇒ TỪ CHỐI 411 (không mặc định "chắc là nhỏ")', async () => {
    // Không dựng được ca này qua app.request() thật: fetch/undici luôn tự điền
    // content-length khi có thân — nên gọi thẳng middleware với `c` giả tối giản.
    const mw = chanContentLength(1024);
    let ketQua: unknown;
    const c = {
      req: { header: () => undefined },
      json: (body: unknown, status: number) => { ketQua = { body, status }; return ketQua; },
    };
    await mw(c as never, async () => { throw new Error('không được gọi next() khi thiếu header'); });
    expect((ketQua as any).status).toBe(411);
    expect((ketQua as any).body.error).toBe('thieu_content_length');
  });

  it('content-length vượt trần ⇒ 413, TRƯỚC KHI đọc thân (next() không được gọi)', async () => {
    const mw = chanContentLength(1024);
    let ketQua: unknown;
    const c = {
      req: { header: (n: string) => (n === 'content-length' ? '2000' : undefined) },
      json: (body: unknown, status: number) => { ketQua = { body, status }; return ketQua; },
    };
    let nextGoi = false;
    await mw(c as never, async () => { nextGoi = true; });
    expect(nextGoi).toBe(false);
    expect((ketQua as any).status).toBe(413);
  });

  it('content-length hợp lệ ⇒ qua (gọi next())', async () => {
    const mw = chanContentLength(1024);
    const c = { req: { header: (n: string) => (n === 'content-length' ? '500' : undefined) }, json: () => {} };
    let nextGoi = false;
    await mw(c as never, async () => { nextGoi = true; });
    expect(nextGoi).toBe(true);
  });

  it('HTTP thật: thân vượt PFM.BLOB_MAX ⇒ 413 (đo bằng body thật, không cần giả header)', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const thang = await thangSong(u.userId);
    const to = Buffer.alloc(PFM.BLOB_MAX + 1, 7);
    const r = await postLuu(u, thang, 1, 0, to);
    expect(r.status).toBe(413);
  });
});

describe('§III — cổng auth/khách trên MỌI route /pfm/* (T5.6, bài phủ)', () => {
  // ⚠ MỘT khách DÙNG CHUNG cho cả vòng lặp — không tạo mới mỗi route. Trần khách
  // thật là 5/IP/giờ (xem server/subsidy.ts); DUONG_PFM có 6 route, tạo-mới-mỗi-
  // route sẽ tự đụng trần và làm `guest()` âm thầm trả cookie rỗng ở route cuối,
  // khiến bài test đổi ý nghĩa (401 vì "không cookie", không phải 403 vì "khách").
  let khachCookie = '';
  beforeAll(async () => { khachCookie = await guest(); });

  for (const { method, path } of DUONG_PFM) {
    it(`${method} ${path} — không cookie ⇒ 401`, async () => {
      const r = await app.request(path, { method });
      expect(r.status).toBe(401);
    });

    it(`${method} ${path} — tài khoản KHÁCH ⇒ 403 (K9: toàn bộ /pfm/* chặn khách)`, async () => {
      const r = await app.request(path, { method, headers: { cookie: khachCookie } });
      expect(r.status, `${method} ${path} phải chặn khách`).toBe(403);
    });
  }
});

describe('§IV — /pfm/consent: BỐN CỬA RIÊNG (D295)', () => {
  /** Bốn cửa đều đóng — hình dạng chuẩn để so `toEqual`, sinh từ config chứ không gõ tay. */
  const dong = () => Object.fromEntries(CUA_PFM.map((c) => [c, false])) as Record<CuaPfm, boolean>;

  it('bật MỘT cửa: đúng cột ấy true, ba cột kia false, pfm_consent true, pfm_bat_dau set, đúng hai vết', async () => {
    const u = await createTestUser(pool);
    const r = await batCua(u, 'ket', true);
    expect(r.status).toBe(200);
    const j = await r.json() as any;
    expect(j.doi).toBe(true);
    expect(j.pfm_consent).toBe(true);
    expect(j.pfm_bat_dau).not.toBeNull();
    expect(j.cua).toEqual({ ...dong(), ket: true });
    expect(Object.keys(j.cua).sort()).toEqual([...CUA_PFM].sort());

    const db = await docCuaDb(u);
    expect(db.ket).toBe(true);
    for (const cua of CUA_PFM) if (cua !== 'ket') expect(db[cua], `${cua} phải còn đóng`).toBe(false);
    expect(db.pfm_consent, 'cờ gộp = có ít nhất một cửa bật').toBe(true);
    expect(db.pfm_bat_dau).not.toBeNull();

    expect(await demEventCua(u, 'pfm_bat')).toBe(1);
    // ⭐ R1 — vết văn bản đi CÙNG transaction với cú bật cửa, và là văn bản CỦA CỬA ẤY.
    const vet = await pool.query(
      `SELECT value_json FROM events WHERE user_id = $1 AND action_type = 'pfm_consent'`, [u.userId]);
    expect(vet.rowCount).toBe(1);
    expect(vet.rows[0].value_json).toEqual({ van_ban_id: 'pfm_ket', phien_ban: 'v1' });
  });

  it('bật cửa THỨ HAI: KHÔNG có pfm_bat thứ hai, pfm_bat_dau không đổi, vết consent thứ hai đúng văn bản', async () => {
    const u = await createTestUser(pool);
    const a = await (await batCua(u, 'ket', true)).json() as any;
    const b = await (await batCua(u, 'thuong', true)).json() as any;
    expect(b.doi).toBe(true);
    expect(b.cua).toEqual({ ...dong(), ket: true, thuong: true });
    expect(b.pfm_bat_dau).toBe(a.pfm_bat_dau);
    expect(await demEventCua(u, 'pfm_bat'), 'pfm_bat = PFM bật TỪ KHÔNG, không phải mỗi cửa một dòng').toBe(1);
    const vet = await pool.query(
      `SELECT value_json FROM events WHERE user_id = $1 AND action_type = 'pfm_consent'`, [u.userId]);
    expect(vet.rows.map((x) => x.value_json.van_ban_id).sort()).toEqual(['pfm_ket', 'pfm_thuong']);
  });

  it('tắt MỘT cửa khi cửa kia còn: pfm_consent VẪN true, vết pfm_tat{cua}, cửa kia không đổi', async () => {
    const u = await createTestUser(pool);
    await chiMo(u, ['ket', 'thuong']);
    const r = await batCua(u, 'ket', false);
    expect(r.status).toBe(200);
    const j = await r.json() as any;
    expect(j.doi).toBe(true);
    expect(j.cua).toEqual({ ...dong(), thuong: true });
    expect(j.pfm_consent, 'còn cửa mở thì PFM còn bật').toBe(true);
    const db = await docCuaDb(u);
    expect(db.pfm_consent).toBe(true);
    expect(db.ket).toBe(false);
    expect(db.thuong).toBe(true);
    const vet = await pool.query(
      `SELECT value_json FROM events WHERE user_id = $1 AND action_type = 'pfm_tat'`, [u.userId]);
    expect(vet.rowCount).toBe(1);
    expect(vet.rows[0].value_json).toEqual({ cua: 'ket' });
  });

  it('tắt cửa CUỐI: pfm_consent false, pfm_bat_dau GIỮ (mốc lần đầu không xoá); bật lại ⇒ pfm_bat lần nữa', async () => {
    const u = await createTestUser(pool);
    const a = await (await batCua(u, 'thuong', true)).json() as any;
    const r = await batCua(u, 'thuong', false);
    const j = await r.json() as any;
    expect(j.pfm_consent).toBe(false);
    expect(j.cua).toEqual(dong());
    expect(j.pfm_bat_dau).toBe(a.pfm_bat_dau);
    const db = await docCuaDb(u);
    expect(db.pfm_consent, 'cửa cuối đóng ⇒ cờ gộp phải tắt CÙNG câu UPDATE').toBe(false);
    expect(await demEventCua(u, 'pfm_tat')).toBe(1);

    // Từ KHÔNG lên có lần nữa ⇒ đúng một pfm_bat nữa; mốc lần đầu vẫn là mốc đầu.
    const lai = await (await batCua(u, 'ket', true)).json() as any;
    expect(lai.pfm_bat_dau).toBe(a.pfm_bat_dau);
    expect(await demEventCua(u, 'pfm_bat')).toBe(2);
  });

  it('⭐ van_ban_id KHÔNG KHỚP cửa ⇒ 400 field van_ban_id, không cột nào bật, không vết nào', async () => {
    const u = await createTestUser(pool);
    const r = await batCua(u, 'thuong', true, { van_ban_id: 'pfm_ket' });
    expect(r.status).toBe(400);
    expect(((await r.json()) as any).field).toBe('van_ban_id');
    const db = await docCuaDb(u);
    for (const cua of CUA_PFM) expect(db[cua]).toBe(false);
    expect(db.pfm_consent).toBe(false);
    expect(await demEventCua(u, 'pfm_consent')).toBe(0);
  });

  it('⭐ văn bản gộp cũ `pfm_dong_bo` ĐÃ NGHỈ ⇒ 400 ở mọi cửa', async () => {
    const u = await createTestUser(pool);
    for (const cua of CUA_PFM) {
      const r = await batCua(u, cua, true, { van_ban_id: 'pfm_dong_bo', phien_ban: 'v1' });
      expect(r.status, `cửa ${cua} không được nhận văn bản gộp cũ`).toBe(400);
    }
    expect((await docCuaDb(u)).pfm_consent).toBe(false);
  });

  it('⭐ R1 — BẬT mà thiếu vết văn bản ⇒ 400, và KHÔNG bật cột', async () => {
    const u = await createTestUser(pool);
    const r = await app.request('/api/v1/pfm/consent', {
      method: 'POST', headers: { cookie: u.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ cua: 'ket', bat: true }),
    });
    expect(r.status).toBe(400);
    expect(((await r.json()) as any).field).toBe('van_ban_id');
    expect((await docCuaDb(u)).ket, 'từ chối vết ⇒ không được bật cột').toBe(false);
  });

  it('⭐ R1 — phiên bản CŨ/sai ⇒ 400 (client đang hiện văn bản cũ)', async () => {
    const u = await createTestUser(pool);
    const r = await batCua(u, 'ket', true, { phien_ban: 'v0' });
    expect(r.status).toBe(400);
  });

  it('`cua` lạ / thiếu / tên văn bản thay tên cửa ⇒ 400 field cua; `bat` không boolean ⇒ field bat', async () => {
    const u = await createTestUser(pool);
    const goi = (body: unknown) => app.request('/api/v1/pfm/consent', {
      method: 'POST', headers: { cookie: u.cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    for (const body of [{ bat: true }, { cua: 'la', bat: true }, { cua: 'pfm_ket', bat: false }]) {
      const r = await goi(body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(((await r.json()) as any).field, JSON.stringify(body)).toBe('cua');
    }
    const r = await goi({ cua: 'ket', bat: 'true' });
    expect(r.status).toBe(400);
    expect(((await r.json()) as any).field).toBe('bat');
  });

  it('⭐ R1 — TẮT không đòi vết: rút lại đồng ý không được dựng thêm rào', async () => {
    const u = await createTestUser(pool);
    await batCua(u, 'ket', true);
    const r = await batCua(u, 'ket', false);
    expect(r.status).toBe(200);
    expect(((await r.json()) as any).pfm_consent).toBe(false);
  });

  it('bật lại cửa ĐÃ bật / tắt cửa ĐANG đóng ⇒ phép rỗng: doi=false, KHÔNG vết, pfm_bat_dau KHÔNG đổi', async () => {
    const u = await createTestUser(pool);
    const a = await (await batCua(u, 'ket', true)).json() as any;
    const b = await (await batCua(u, 'ket', true)).json() as any;
    expect(b.doi).toBe(false);
    expect(b.pfm_bat_dau).toBe(a.pfm_bat_dau);
    expect(b.cua).toEqual(a.cua);
    expect(await demEventCua(u, 'pfm_bat')).toBe(1);
    expect(await demEventCua(u, 'pfm_consent')).toBe(1);
    // Không có vết rút-lại cho thứ chưa từng mở.
    const c = await (await batCua(u, 'thuong', false)).json() as any;
    expect(c.doi).toBe(false);
    expect(await demEventCua(u, 'pfm_tat')).toBe(0);
  });

  it('tắt ⇒ dữ liệu server KHÔNG bị xoá (đó là việc riêng của /pfm/xoa)', async () => {
    const u = await createTestUser(pool);
    await batCua(u, 'thuong', true);
    await diemDanh(u, 'co_ghi');
    const r = await batCua(u, 'thuong', false);
    expect(((await r.json()) as any).pfm_consent).toBe(false);
    const ngay = await pool.query(`SELECT count(*)::int AS n FROM pfm_ngay WHERE user_id = $1`, [u.userId]);
    expect(ngay.rows[0].n, 'tắt PFM không được xoá dữ liệu đã ghi').toBe(1);
  });

  /*
   * ⭐⭐ CỔNG TỪNG CỬA — lặp qua `CUA_CANH_DUONG` (config), KHÔNG gõ tay danh sách đường:
   * thêm một đường vào config mà quên cổng ở server thì bài này đỏ; thêm ở server mà quên
   * config thì `cuaCanh` ném lúc nạp module. Mỗi đường phải (a) bị chặn 403 + `cua` khi CỬA
   * CỦA NÓ đóng dù ba cửa kia mở, và (b) KHÔNG bị chặn khi CHỈ cửa của nó mở — hai vế cùng
   * có mặt thì cổng đọc nhầm cột mới lộ (đọc `dac_trung` thay `ket` qua được vế (a) một mình).
   */
  describe('cổng từng cửa theo CUA_CANH_DUONG', () => {
    const GOI: Record<string, (u: TestUser) => Response | Promise<Response>> = {
      'POST /api/v1/pfm/diem-danh': (u) => diemDanh(u, 'co_ghi'),
      'POST /api/v1/pfm/tuan': (u) => postTuan(u),
      'POST /api/v1/pfm/dong-bo': (u) => {
        const than = JSON.stringify(
          { mon: [{ id: 'm1', loai: 'nhip', ma: 'pfm_hu', v: { hu_id: 'h1', ma: 'tao' } }] });
        return app.request('/api/v1/pfm/dong-bo', {
          method: 'POST',
          headers: {
            cookie: u.cookie, 'content-type': 'application/json',
            'content-length': String(new TextEncoder().encode(than).byteLength),
          },
          body: than,
        });
      },
      'POST /api/v1/pfm/luu': async (u) => postLuu(u, await thangSong(u.userId), 1, 0, Buffer.from('x')),
    };

    it('mọi đường trong CUA_CANH_DUONG đều có cách gọi ở bài này (không đường nào lọt kiểm)', () => {
      const tatCa = CUA_PFM.flatMap((cua) => [...CUA_CANH_DUONG[cua]]);
      expect(tatCa.length).toBeGreaterThan(0);
      for (const d of tatCa) expect(GOI[d], `thiếu cách gọi cho ${d}`).toBeDefined();
    });

    for (const cua of CUA_PFM) {
      for (const duong of CUA_CANH_DUONG[cua]) {
        it(`${duong}: cửa "${cua}" đóng (ba cửa kia mở) ⇒ 403 chua_bat_pfm + cua`, async () => {
          const u = await createTestUser(pool);
          await chiMo(u, CUA_PFM.filter((k) => k !== cua));
          const r = await GOI[duong]!(u);
          expect(r.status).toBe(403);
          const j = await r.json() as any;
          expect(j.error).toBe('chua_bat_pfm');
          expect(j.cua).toBe(cua);
        });
        it(`${duong}: CHỈ cửa "${cua}" mở ⇒ không bị cổng chặn`, async () => {
          const u = await createTestUser(pool);
          await chiMo(u, [cua]);
          const r = await GOI[duong]!(u);
          expect(r.status, `body: ${await r.text()}`).not.toBe(403);
        });
      }
    }
  });

  it('GET /pfm/luu và POST /pfm/xoa KHÔNG canh cửa: lấy đồ của mình · quyền xoá không phụ thuộc đồng ý', async () => {
    const u = await createTestUser(pool);
    await batCua(u, 'ket', true);
    const thang = await thangSong(u.userId);
    expect((await postLuu(u, thang, 1, 0, Buffer.from('cua-dong-van-doc'))).status).toBe(200);
    await batCua(u, 'ket', false);
    const g = await app.request(`/api/v1/pfm/luu?thang=${thang}`, { headers: { cookie: u.cookie } });
    expect(g.status, 'két đóng vẫn lấy lại được đồ của mình').toBe(200);
    const x = await app.request('/api/v1/pfm/xoa', { method: 'POST', headers: { cookie: u.cookie } });
    expect(x.status, 'xoá không phụ thuộc cửa nào').toBe(200);
  });
});

describe('§V — /pfm/diem-danh', () => {
  it('chưa bật PFM ⇒ 403 chua_bat_pfm, không ghi gì', async () => {
    const u = await createTestUser(pool);
    const r = await diemDanh(u, 'co_ghi');
    expect(r.status).toBe(403);
    expect(((await r.json()) as any).error).toBe('chua_bat_pfm');
  });

  it('điểm danh thật: ghi pfm_ngay + event pfm_diem_danh khớp K5', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const r = await diemDanh(u, 'khong_tieu');
    expect(r.status).toBe(200);
    const j = await r.json() as any;
    expect(j.trangThai).toBe('khong_tieu');
    expect(j.moi).toBe(true);

    const ev = await pool.query(
      `SELECT value_json FROM events WHERE user_id = $1 AND action_type = 'pfm_diem_danh'`, [u.userId]);
    expect(ev.rows[0].value_json).toEqual({ trang_thai: 'khong_tieu' });
  });

  it('⭐ cú TỤT bậc bị bỏ qua (D140) ⇒ KHÔNG ghi event thứ hai', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    await diemDanh(u, 'co_ghi');
    const r = await diemDanh(u, 'tron');   // tụt về "chưa nói gì" — phải bị bỏ qua
    const j = await r.json() as any;
    expect(j.boQua).toBe(true);
    expect(j.trangThai).toBe('co_ghi');    // giữ nguyên trạng thái cao hơn

    const n = await pool.query(
      `SELECT count(*)::int AS n FROM events WHERE user_id = $1 AND action_type = 'pfm_diem_danh'`,
      [u.userId]);
    expect(n.rows[0].n, 'cú bị bỏ qua không được sinh event').toBe(1);   // chỉ dòng đầu
  });

  it('trang_thai ngoài bốn giá trị hợp lệ ⇒ 400, không đụng DB', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const r = await diemDanh(u, 'khong_tieu_gi_ca');
    expect(r.status).toBe(400);
  });
});

describe('§VI — /pfm/tuan (niêm phong tuần, GĐ2)', () => {
  it('chưa bật PFM ⇒ 403', async () => {
    const u = await createTestUser(pool);
    const r = await postTuan(u);
    expect(r.status).toBe(403);
  });

  it('⭐⭐ R4 — điểm danh HÔM NAY không kéo token của tuần đã đóng (trừ Chủ nhật)', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    await diemDanh(u, 'co_ghi');          // hôm nay, tức TUẦN ĐANG CHẠY

    const j = await (await postTuan(u)).json() as any;
    const homNay = (await pool.query(
      `SELECT to_char(now() AT TIME ZONE mui_gio, 'ID') AS thu FROM users WHERE user_id = $1`,
      [u.userId])).rows[0].thu as string;

    if (homNay === '7') {
      // Chủ nhật: tuần đang chạy CHÍNH LÀ tuần được niêm phong ⇒ ngày hôm nay có tính.
      expect(j.soNgayCoMat).toBe(1);
    } else {
      /*
       * Đây là chính cái lỗi R4 sửa: bản cũ niêm phong tuần ĐANG CHẠY nên con số này
       * là 1, và tuần đó bị khoá lại (UNIQUE user_id+tuan) — mấy ngày còn lại không
       * bao giờ được tính. Nay nó phải là 0: tuần đang chạy chưa tới lượt.
       */
      expect(j.soNgayCoMat, 'ngày của tuần ĐANG CHẠY không được tính vào tuần đã đóng').toBe(0);
      expect(j.tokenThuong).toBe(0);
    }
  });

  it('⭐⭐⭐ K7 🔒 — CLIENT KHÔNG BƠM ĐƯỢC "HÔM NAY" vào đường niêm phong', async () => {
    /*
     * ⚠⚠ `niemPhongTuan` có seam `homNayEp` cho TEST. Seam ấy chỉ an toàn chừng nào route
     * không có đường nào để một trường của request chui vào — vì "hôm nay" quyết định
     * TUẦN nào được niêm phong, mà niêm phong CẤP TOKEN. Bơm được ngày là in được token
     * (K7: server tự tính, không bao giờ nhận từ client).
     * ⇒ Bài này gửi ngày giả qua CẢ query lẫn body và đòi phản hồi y hệt lúc không gửi.
     */
    const u = await createTestUser(pool);
    await batPfm(u);
    await coMatTrongTuanNiemPhong(u);

    const banGia = await app.request(
      '/api/v1/pfm/tuan?ngay=2020-01-06&homNay=2020-01-06&homNayEp=2020-01-06',
      {
        method: 'POST',
        headers: { cookie: u.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ ngay: '2020-01-06', homNay: '2020-01-06', homNayEp: '2020-01-06' }),
      });
    expect(banGia.status).toBe(200);
    const jg = await banGia.json() as any;
    expect(jg.tuan, 'tuần phải là tuần THẬT của server, không phải 2020')
      .toBe(await tuanNiemPhongCuaUser(pool, u.userId));
  });

  it('⭐⭐ R4 — rào Chủ nhật: không khoá một tuần khi ngày cuối của nó CHƯA XONG', async () => {
    /*
     * Founder chốt "CN = tuần này". Cài thẳng thì bấm niêm phong 10h sáng CN là khoá
     * tuần (UNIQUE user_id+tuan) trong khi CN còn 14 tiếng — điểm danh tối hôm ấy không
     * bao giờ được đếm. Rào: trên chính ngày cuối, chỉ cho niêm phong khi HÔM NAY đã
     * điểm danh. Không mất tuần nào: chưa điểm danh thì chờ tới T2, mà T2 niêm phong
     * ĐÚNG tuần đó.
     * ⚠ Hai nhánh, và CẢ HAI đều khẳng định điều gì đó — nhánh không-chạy không được
     * phép là một `expect` rỗng.
     */
    const u = await createTestUser(pool);
    await batPfm(u);
    await coMatTrongTuanNiemPhong(u);
    /*
     * ⚠ HELPER CHUNG cố ý điểm danh CẢ HÔM NAY để mọi bài khác tất định qua mọi thứ trong
     * tuần. Bài NÀY cần đúng điều ngược lại — tiền đề của nó là "chưa điểm danh hôm nay"
     * — nên phải gỡ dòng ấy ra. Nói rõ ở đây, không sửa helper: helper phục vụ số đông.
     */
    await pool.query(
      `DELETE FROM pfm_ngay WHERE user_id = $1
        AND ngay = (SELECT (now() AT TIME ZONE mui_gio)::date FROM users WHERE user_id = $1)`,
      [u.userId]);
    const laChuNhat = await thuCuaUser(u) === 7;

    const r = await postTuan(u);               // chưa điểm danh HÔM NAY
    if (laChuNhat) {
      expect(r.status, 'CN chưa điểm danh ⇒ chặn').toBe(409);
      expect(((await r.json()) as any).error).toBe('chua_diem_danh_hom_nay');
      const chua = await pool.query(
        `SELECT count(*)::int AS n FROM pfm_tuan WHERE user_id = $1`, [u.userId]);
      expect(chua.rows[0].n, 'bị chặn thì KHÔNG được giành chỗ').toBe(0);

      await diemDanh(u, 'co_ghi');             // xong hôm nay rồi
      const sau = await postTuan(u);
      expect(sau.status, 'điểm danh xong thì niêm phong được').toBe(200);
      expect(((await sau.json()) as any).soNgayCoMat, 'phải đếm CẢ ngày hôm nay').toBe(2);
    } else {
      expect(r.status, 'T2–T7: tuần được niêm phong đã đóng hẳn ⇒ rào không chạm').toBe(200);
      expect(((await r.json()) as any).moi).toBe(true);
    }
  });

  it('niêm phong lần đầu: 200, moi=true; lần hai cùng tuần: moi=false, KHÔNG lệch token', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    await coMatTrongTuanNiemPhong(u);

    const a = await postTuan(u);
    expect(a.status).toBe(200);
    const ja = await a.json() as any;
    expect(ja.moi).toBe(true);
    expect(ja.tokenThuong).toBeGreaterThan(0);

    const ev = await pool.query(
      `SELECT value_json FROM events WHERE user_id = $1 AND action_type = 'pfm_tuan_niem_phong'`,
      [u.userId]);
    expect(ev.rowCount).toBe(1);
    expect(ev.rows[0].value_json).toEqual({ tuan: ja.tuan, moc_ids: [] });

    const b = await postTuan(u);
    const jb = await b.json() as any;
    expect(jb.moi).toBe(false);
    expect(jb.tokenThuong).toBe(ja.tokenThuong);

    // Lần hai KHÔNG được ghi thêm event niêm phong (chỉ dòng đầu là "thật").
    const ev2 = await pool.query(
      `SELECT count(*)::int AS n FROM events WHERE user_id = $1 AND action_type = 'pfm_tuan_niem_phong'`,
      [u.userId]);
    expect(ev2.rows[0].n).toBe(1);
  });
});

describe('§VII — /pfm/luu (ket.ts: xoay thế hệ + chống ghi đè mù)', () => {
  it('chưa bật PFM ⇒ 403', async () => {
    const u = await createTestUser(pool);
    const thang = await thangSong(u.userId);
    const r = await postLuu(u, thang, 1, 0, Buffer.from('xxx'));
    expect(r.status).toBe(403);
  });

  it('GET trước khi có bản nào ⇒ 404', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const thang = await thangSong(u.userId);
    const r = await app.request(`/api/v1/pfm/luu?thang=${thang}`, { headers: { cookie: u.cookie } });
    expect(r.status).toBe(404);
  });

  it('ghi lần đầu (ver=0) → ver 1; GET đọc đúng byte-for-byte + header ver/schema_v', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const thang = await thangSong(u.userId);
    const noiDung = Buffer.from('ciphertext-gia-lap-1');
    const p = await postLuu(u, thang, 3, 0, noiDung);
    expect(p.status).toBe(200);
    expect(((await p.json()) as any).ver).toBe(1);

    const g = await app.request(`/api/v1/pfm/luu?thang=${thang}`, { headers: { cookie: u.cookie } });
    expect(g.status).toBe(200);
    expect(g.headers.get('x-pfm-ver')).toBe('1');
    expect(g.headers.get('x-pfm-schema-v')).toBe('3');
    expect(Buffer.from(await g.arrayBuffer())).toEqual(noiDung);
  });

  it('⭐ VER CŨ (chống ghi đè mù, K8/T5.1) ⇒ 409 ver_cu, không đổi gì', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const thang = await thangSong(u.userId);
    await postLuu(u, thang, 1, 0, Buffer.from('v1'));
    // Gửi lại với ver=0 (đã cũ — bản mới nhất trên server giờ là 1)
    const r = await postLuu(u, thang, 1, 0, Buffer.from('v2-nhung-goi-ver-cu'));
    expect(r.status).toBe(409);
    expect(((await r.json()) as any).error).toBe('ver_cu');

    const g = await app.request(`/api/v1/pfm/luu?thang=${thang}`, { headers: { cookie: u.cookie } });
    expect(Buffer.from(await g.arrayBuffer())).toEqual(Buffer.from('v1'));   // không bị ghi đè
  });

  it('THÁNG KHÔNG PHẢI đang sống ⇒ 409 thang_khong_song (K10: tháng đã đóng không ghi lại)', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const r = await postLuu(u, '2020-01-01', 1, 0, Buffer.from('x'));
    expect(r.status).toBe(409);
    expect(((await r.json()) as any).error).toBe('thang_khong_song');
  });

  it('⭐ XOAY BA THẾ HỆ: ghi 4 lần liên tiếp, the_he=1 luôn mới nhất, thế hệ cũ nhất bị đá ra', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    // Nới trần lượt lưu/ngày cho riêng test này — bài trần K11 nằm ở test khác.
    await pool.query(
      `DELETE FROM auth_attempts WHERE bucket = $1`, [`pfm:luu:${u.userId}`]);
    const thang = await thangSong(u.userId);

    for (let i = 1; i <= 4; i++) {
      const kq = await postLuu(u, thang, 1, i - 1, Buffer.from(`ban-${i}`));
      if (kq.status !== 200) {
        // Trần K11 (SO_LAN_LUU_NGAY) có thể chặn trước khi tới lượt 4 — nới thêm rồi thử lại.
        await pool.query(`DELETE FROM auth_attempts WHERE bucket = $1`, [`pfm:luu:${u.userId}`]);
        const lai = await postLuu(u, thang, 1, i - 1, Buffer.from(`ban-${i}`));
        expect(lai.status).toBe(200);
      }
    }

    const rows = await pool.query(
      `SELECT the_he, blob FROM pfm_luu WHERE user_id = $1 AND thang = $2 ORDER BY the_he`,
      [u.userId, thang]);
    expect(rows.rowCount, 'chỉ giữ đúng BA thế hệ, không phình thêm').toBe(3);
    expect((rows.rows[0].blob as Buffer).toString()).toBe('ban-4');   // the_he=1: mới nhất
    expect((rows.rows[1].blob as Buffer).toString()).toBe('ban-3');   // the_he=2
    expect((rows.rows[2].blob as Buffer).toString()).toBe('ban-2');   // the_he=3
    // 'ban-1' đã bị đá khỏi cả ba thế hệ — đúng thiết kế "tối đa 3, không phải vô hạn".
  });

  it('⭐⭐ R3 — 409 KHÔNG đốt suất: ver lệch mấy lần rồi cú ĐÚNG vẫn ghi được', async () => {
    /*
     * Lời hứa của R3 là "suất tiêu cho việc ĐÃ LÀM". Không có bài này thì `soiTruocKhiGhi`
     * có thể bị xoá đi mà mọi bài khác vẫn xanh — nó chỉ đổi THỨ TỰ, không đổi mã trả về.
     */
    const u = await createTestUser(pool);
    await batPfm(u);
    const thang = await thangSong(u.userId);
    // Đốt đúng bằng SỐ SUẤT một ngày, toàn bằng cú ver lệch (chắc chắn 409).
    for (let i = 0; i < PFM.SO_LAN_LUU_NGAY; i++) {
      const r = await postLuu(u, thang, 1, 99, Buffer.from(`sai-${i}`));
      expect(r.status, 'ver lệch phải là 409').toBe(409);
    }
    // Nếu 409 có đốt suất thì cú này đã 429.
    const dung = await postLuu(u, thang, 1, 0, Buffer.from('dung'));
    expect(dung.status, 'cú ĐÚNG sau mấy cú 409 vẫn phải ghi được').toBe(200);
  });

  it('⭐ R15 — lát SỐNG ghi và đọc được, và KHÔNG bị luật tháng-đang-sống chặn', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    // `LAT_SONG_THANG` là 1970 — với luật K10 thì đây là "tháng đã đóng" từ rất lâu.
    const r = await postLuu(u, LAT_SONG_THANG, 1, 0, Buffer.from('hu-va-luat'));
    expect(r.status, 'lát sống phải đi qua cửa tháng-đang-sống').toBe(200);

    const doc = await app.request(
      `/api/v1/pfm/luu?thang=${LAT_SONG_THANG}`, { headers: { cookie: u.cookie } });
    expect(doc.status).toBe(200);
    expect(Buffer.from(await doc.arrayBuffer()).toString()).toBe('hu-va-luat');
  });

  it('⭐ R15 — lát sống xoay thế hệ y hệt lát tháng (không có nhánh SQL riêng)', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    await pool.query(
      `UPDATE rate_limits SET so_lan = 0 WHERE khoa = $1`, [`pfm:luu:${u.userId}`]).catch(() => {});
    const a = await postLuu(u, LAT_SONG_THANG, 1, 0, Buffer.from('the-he-1'));
    expect(a.status).toBe(200);
    const b = await postLuu(u, LAT_SONG_THANG, 1, 1, Buffer.from('the-he-2'));
    expect(b.status).toBe(200);
    const cu = await app.request(
      `/api/v1/pfm/luu?thang=${LAT_SONG_THANG}&the_he=2`, { headers: { cookie: u.cookie } });
    expect(Buffer.from(await cu.arrayBuffer()).toString(), 'bản cũ phải lùi xuống thế hệ 2')
      .toBe('the-he-1');
  });

  it('K11: trần SO_LAN_LUU_NGAY chặn đúng chỗ ⇒ 429', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const thang = await thangSong(u.userId);
    let verCuoi = 0;
    let thay429 = false;
    for (let i = 0; i < PFM.SO_LAN_LUU_NGAY + 2; i++) {
      const r = await postLuu(u, thang, 1, verCuoi, Buffer.from(`lan-${i}`));
      if (r.status === 429) { thay429 = true; break; }
      expect(r.status).toBe(200);
      verCuoi = ((await r.json()) as any).ver;
    }
    expect(thay429, `phải chạm trần ${PFM.SO_LAN_LUU_NGAY} lần/ngày`).toBe(true);
  });
});

describe('§VIII — /pfm/xoa qua HTTP (đối chứng: đã kiểm kỹ ở tests/pfm_nghiep_vu.test.ts)', () => {
  it('xoá xong, dùng lại được ngay: bật PFM lại + điểm danh lại bình thường', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    await diemDanh(u, 'co_ghi');

    const r = await app.request('/api/v1/pfm/xoa', { method: 'POST', headers: { cookie: u.cookie } });
    expect(r.status).toBe(200);
    const j = await r.json() as any;
    expect(j.pfm_ngay).toBe(1);

    // D295 — xoá sạch đóng CẢ BỐN cửa; /me không còn thấy PFM.
    const db = await docCuaDb(u);
    for (const cua of CUA_PFM) expect(db[cua], `cửa ${cua} phải đóng sau xoá`).toBe(false);
    expect(db.pfm_consent).toBe(false);
    const me = await (await app.request('/api/v1/auth/me', { headers: { cookie: u.cookie } })).json() as any;
    expect(me.pfm).toBeNull();

    const laiBat = await batPfm(u);
    expect(laiBat.status).toBe(200);
    const laiDiemDanh = await diemDanh(u, 'co_ghi');
    expect(laiDiemDanh.status).toBe(200);
  });
});

describe('§IX — trạng thái PFM gộp vào /api/v1/auth/me (T5.9 — KHÔNG route riêng)', () => {
  const getMe = async (u: TestUser) => {
    const r = await app.request('/api/v1/auth/me', { headers: { cookie: u.cookie } });
    return (await r.json()) as any;
  };

  it('chưa bật PFM ⇒ me.pfm === null (không tốn ba câu đọc cho người chưa consent)', async () => {
    const u = await createTestUser(pool);
    const me = await getMe(u);
    expect(me.pfm).toBeNull();
  });

  it('⭐ D295 — me.pfm.cua nói ĐÚNG bốn cửa: mở một cửa ⇒ đúng khoá ấy true, đủ bốn khoá; đóng hết ⇒ null', async () => {
    const u = await createTestUser(pool);
    await batCua(u, 'thuong', true);
    const me = await getMe(u);
    expect(me.pfm).not.toBeNull();
    expect(me.pfm.consent).toBe(true);
    expect(Object.keys(me.pfm.cua).sort()).toEqual([...CUA_PFM].sort());
    for (const cua of CUA_PFM) expect(me.pfm.cua[cua], `cửa ${cua}`).toBe(cua === 'thuong');

    await batCua(u, 'ket', true);
    expect((await getMe(u)).pfm.cua).toMatchObject({ thuong: true, ket: true, dac_trung: false, noi_game: false });

    await batCua(u, 'thuong', false);
    await batCua(u, 'ket', false);
    expect((await getMe(u)).pfm, 'không cửa nào mở ⇒ client hiểu là bốn cửa đóng, không cần hình thứ ba').toBeNull();
  });

  it('đã bật PFM ⇒ me.pfm khớp đúng ba nguồn (chuỗi/token/tuần), KHÔNG lệch số nào', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    await diemDanh(u, 'co_ghi');            // HÔM NAY — vào chuỗi và vào tháng
    await coMatTrongTuanNiemPhong(u);       // một ngày trong TUẦN ĐÃ ĐÓNG — vào nghi lễ
    await postTuan(u);

    const me = await getMe(u);
    expect(me.pfm).not.toBeNull();
    expect(me.pfm.consent).toBe(true);
    expect(me.pfm.bat_dau).not.toBeNull();
    expect(me.pfm.chuoi).toBe(1);
    expect(me.pfm.hom_nay_xong).toBe(true);
    expect(me.pfm.tuan_da_niem_phong).toBe(true);

    /*
     * ⭐ R4/D251 — `/me` phải nói ĐÚNG con số mà nghi lễ đã phát theo. Trước D251 client
     * phải tự đếm từ sổ local, mà sổ local đếm "ngày TÔI CÓ GHI KHOẢN" còn máy phát token
     * đếm "ngày có dòng pfm_ngay" — hai tập khác nhau (`tron`/`khong_tieu` không cần
     * khoản nào).
     *
     * ⚠ KHẲNG ĐỊNH BẰNG SỐ CỤ THỂ, KHÔNG BẰNG CÔNG THỨC. Bản đầu tôi viết
     * `toBe(tuan_token_thuong / TOKEN_MOC_VI_MO)` — tức so một giá trị với CHÍNH công
     * thức sinh ra nó, và nó còn xanh cả khi hai vế cùng bằng 0. Một khẳng định như thế
     * không ghim được gì.
     * Dựng đúng hai dòng `pfm_ngay`: một hôm nay, một ở đầu tuần được niêm phong. Chỉ
     * vào Chủ nhật thì hai dòng ấy MỚI cùng nằm trong tuần được niêm phong.
     */
    const laChuNhat = await thuCuaUser(u) === 7;
    const mongDoi = laChuNhat ? 2 : 1;
    expect(me.pfm.tuan_so_ngay_co_mat, `hôm nay ${laChuNhat ? 'LÀ' : 'không phải'} CN`)
      .toBe(mongDoi);
    expect(me.pfm.tuan_token_thuong).toBe(mongDoi * PFM.TOKEN_MOC_VI_MO);

    /* ⭐ G5 — số ngày có mặt trong THÁNG, suy từ chính tập ngày docChuoi đã nạp. */
    const trongThang = (await pool.query(
      `SELECT count(*)::int AS n FROM pfm_ngay
        WHERE user_id = $1
          AND to_char(ngay, 'YYYY-MM') = to_char(now() AT TIME ZONE
              (SELECT mui_gio FROM users WHERE user_id = $1), 'YYYY-MM')`,
      [u.userId])).rows[0].n as number;
    expect(me.pfm.so_ngay_thang_nay).toBe(trongThang);
    expect(me.pfm.so_ngay_thang_nay).toBeGreaterThanOrEqual(1);
  });

  it('⚠ HỒI QUY: các trường /me sẵn có (ngoài PFM) không đổi hình dạng', async () => {
    const u = await createTestUser(pool);
    const me = await getMe(u);
    expect(me).toMatchObject({
      onboarded: true,
      user: { user_id: u.userId, handle: u.handle, la_khach: false },
    });
    expect(typeof me.user.bankroll).toBe('number');
    expect('hoi_nhan_khau' in me).toBe(true);
    expect('dien_mao' in me.user).toBe(true);
  });
});

describe('§X — POST /pfm/dong-bo (R8/R7/R2, D251): lô hỗn hợp, món hỏng bỏ riêng', () => {
  /*
   * ⚠ `content-length` ĐẶT TAY — cùng lý do đã ghi ở helper của §III: `app.request()`
   * không tự đặt header đó, còn client HTTP thật (trình duyệt, curl) thì luôn kèm khi
   * thân là chuỗi. Quên nó thì mọi bài ở đây ăn 411 chứ không đo được gì — và tôi vừa
   * mất một lượt chạy vì đúng chuyện này.
   */
  const guiLo = async (u: TestUser, than: string) => {
    return app.request('/api/v1/pfm/dong-bo', {
      method: 'POST',
      headers: {
        cookie: u.cookie, 'content-type': 'application/json',
        'content-length': String(new TextEncoder().encode(than).byteLength),
      },
      body: than,
    });
  };
  const postLo = async (u: TestUser, mon: unknown) => guiLo(u, JSON.stringify({ mon }));

  /** Kỳ đang sống theo múi giờ CỦA USER — không đọc đồng hồ máy chạy test. */
  const kySong = async (u: TestUser): Promise<string> => {
    const { rows } = await pool.query(
      `SELECT to_char(now() AT TIME ZONE mui_gio, 'YYYY-MM') AS k FROM users WHERE user_id = $1`,
      [u.userId]);
    return rows[0].k as string;
  };
  const kyLui = async (u: TestUser, n: number): Promise<string> => {
    const { rows } = await pool.query(
      `SELECT to_char((now() AT TIME ZONE mui_gio) - ($2 || ' months')::interval, 'YYYY-MM') AS k
         FROM users WHERE user_id = $1`, [u.userId, String(n)]);
    return rows[0].k as string;
  };

  const goi = (id: string, ky: string, dong: unknown[]) =>
    ({ id, loai: 'goi', ky, schema_v: 1, dong });
  const nhip = (id: string, ma: string, v: Record<string, unknown>) =>
    ({ id, loai: 'nhip', ma, v });

  const demEvent = async (u: TestUser, ma: string): Promise<number> => {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM events WHERE user_id = $1 AND action_type = $2`,
      [u.userId, ma]);
    return rows[0].n as number;
  };

  it('chưa bật PFM ⇒ 403', async () => {
    const u = await createTestUser(pool);
    const r = await postLo(u, [goi('m1', await kySong(u), [{ ma: 'ctx_tu_lap', gia_tri: 'tu_lap' }])]);
    expect(r.status).toBe(403);
  });

  it('⭐ lô HỖN HỢP (gói + nhịp) ⇒ 200, cả hai loại đều ghi', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const r = await postLo(u, [
      goi('m1', await kySong(u), [
        { ma: 'ctx_tu_lap', gia_tri: 'tu_lap' },
        { ma: 'y_loai', doi_tuong: 'hu_1', gia_tri: 'giao_duc' },
      ]),
      nhip('m2', 'pfm_hu', { hu_id: 'hu_1', ma: 'tao' }),
    ]);
    expect(r.status).toBe(200);
    const j = await r.json() as any;
    expect(j.ghi).toBe(2);
    expect(j.ket.map((k: any) => k.ket)).toEqual(['ghi', 'ghi']);

    const dt = await pool.query(
      `SELECT count(*)::int AS n FROM pfm_dac_trung WHERE user_id = $1 AND ma NOT LIKE 'gm\\_%'`, [u.userId]);
    expect(dt.rows[0].n, 'gói phải vào pfm_dac_trung').toBe(2);
    expect(await demEvent(u, 'pfm_hu'), 'nhịp phải vào events').toBe(1);
  });

  it('⭐⭐ món HỎNG bị bỏ RIÊNG, món LÀNH đứng cạnh nó VẪN GHI', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const ky = await kySong(u);
    const r = await postLo(u, [
      goi('m1', ky, [{ ma: 'ctx_tu_lap', gia_tri: 'tu_lap' }]),
      goi('m2', ky, [{ ma: 'ma_bia_dat', gia_tri: 1 }]),
      nhip('m3', 'pfm_hu', { hu_id: 'hu_9', ma: 'tao' }),
    ]);
    expect(r.status, 'lô có món hỏng KHÔNG được là 400 cả lô').toBe(200);
    const j = await r.json() as any;
    expect(j.ket.map((k: any) => k.ket)).toEqual(['ghi', 'bo', 'ghi']);
    expect(j.ghi).toBe(2);
    expect(j.bo).toBe(1);
    expect(j.ket[1].ly_do, 'phải nói SAI CHỖ NÀO để client bỏ được').toContain('ma_bia_dat');

    const dt = await pool.query(
      `SELECT count(*)::int AS n FROM pfm_dac_trung WHERE user_id = $1 AND ma NOT LIKE 'gm\\_%'`, [u.userId]);
    expect(dt.rows[0].n, 'món lành không được rollback theo món hỏng').toBe(1);
    expect(await demEvent(u, 'pfm_hu')).toBe(1);
  });

  it('⭐⭐ GỬI LẠI đúng lô ⇒ `trung`, KHÔNG nhân đôi events (mất phản hồi giữa đường)', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const lo = [nhip('m1', 'pfm_hu', { hu_id: 'hu_1', ma: 'tao' })];

    const a = await postLo(u, lo);
    expect(((await a.json()) as any).ghi).toBe(1);
    expect(await demEvent(u, 'pfm_hu')).toBe(1);

    const b = await postLo(u, lo);
    const jb = await b.json() as any;
    expect(jb.trung, 'lần hai phải là TRÙNG, không phải ghi').toBe(1);
    expect(jb.ghi).toBe(0);
    expect(await demEvent(u, 'pfm_hu'), 'events append-only KHÔNG được có bản sao').toBe(1);
  });

  it('id KHÁC nhau cho cùng nội dung ⇒ ghi cả hai (lặp thật ≠ gửi lại)', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    await postLo(u, [nhip('m1', 'pfm_hu', { hu_id: 'hu_1', ma: 'sua_ten' })]);
    await postLo(u, [nhip('m2', 'pfm_hu', { hu_id: 'hu_1', ma: 'sua_ten' })]);
    expect(await demEvent(u, 'pfm_hu')).toBe(2);
  });

  it('⭐ R7 — kỳ LIỀN TRƯỚC được nhận (gói tháng 8 gửi ngày 1/9)', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const truoc = await kyLui(u, 1);
    const r = await postLo(u, [goi('m1', truoc, [{ ma: 'ctx_tu_lap', gia_tri: 'tu_lap' }])]);
    const j = await r.json() as any;
    expect(j.ket[0].ket).toBe('ghi');

    const { rows } = await pool.query(
      `SELECT to_char(ky, 'YYYY-MM') AS k FROM pfm_dac_trung WHERE user_id = $1 AND ma NOT LIKE 'gm\\_%'`, [u.userId]);
    expect(rows[0].k, 'phải đóng dấu ĐÚNG kỳ client nêu, không phải tháng gửi').toBe(truoc);
  });

  it('⭐ R7 — kỳ HAI tháng trước bị bỏ, có lý do', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const r = await postLo(u, [goi('m1', await kyLui(u, 2), [{ ma: 'ctx_tu_lap', gia_tri: 'tu_lap' }])]);
    const j = await r.json() as any;
    expect(j.ket[0].ket).toBe('bo');
    expect(j.ket[0].ly_do).toContain('ngoài cửa sổ');
    const dt = await pool.query(
      `SELECT count(*)::int AS n FROM pfm_dac_trung WHERE user_id = $1 AND ma NOT LIKE 'gm\\_%'`, [u.userId]);
    expect(dt.rows[0].n).toBe(0);
  });

  it('nhịp mang giá trị enum bịa ⇒ bỏ riêng món đó (cửa K5 của D250)', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const r = await postLo(u, [
      nhip('m1', 'pfm_hu', { hu_id: 'hu_1', ma: 'bia_dat' }),
      nhip('m2', 'pfm_hu', { hu_id: 'hu_2', ma: 'tao' }),
    ]);
    const j = await r.json() as any;
    expect(j.ket.map((k: any) => k.ket)).toEqual(['bo', 'ghi']);
    expect(await demEvent(u, 'pfm_hu')).toBe(1);
  });

  it('lớp intervention từ client ⇒ bỏ (phải cuộn từ telemetry, không nhận trực tiếp)', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const r = await postLo(u, [
      goi('m1', await kySong(u), [{ ma: 'iv_du_dieu_kien', doi_tuong: 'oracle_1', gia_tri: 1 }]),
    ]);
    expect(((await r.json()) as any).ket[0].ket).toBe('bo');
  });

  it('món thiếu `id` ⇒ bỏ, nhãn theo vị trí để client vẫn ghép được', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const r = await postLo(u, [{ loai: 'nhip', ma: 'pfm_hu', v: { hu_id: 'h', ma: 'tao' } }]);
    const j = await r.json() as any;
    expect(j.ket[0]).toMatchObject({ id: '#0', ket: 'bo' });
    expect(j.ket[0].ly_do).toContain('id');
  });

  it('⭐⭐⭐ gói THỨ HAI cùng kỳ ⇒ GHI ĐÈ, KHÔNG phải `trung` (sửa sổ rồi đồng bộ lại)', async () => {
    /*
     * ⚠⚠ ĐÂY LÀ BÀI KHOÁ CHO LỖI NẶNG NHẤT CỦA ĐỢT NÀY. Bản đầu D251 giành chỗ chống
     * trùng cho MỌI món, mà khoá hàng đợi của một gói là `goi:<ky>` — ổn định theo KỲ,
     * không theo nội dung. Nên ảnh chụp thứ hai của cùng kỳ (thứ người dùng vừa sửa sổ
     * xong) bị trả `trung` rồi bị vứt, và đặc trưng đóng băng 30 ngày. Dùng đúng dạng id
     * `goi:${ky}` để bài này khoá luôn cái mapping mà `khoaMon` sẽ sinh ra ở GĐ1.
     */
    const u = await createTestUser(pool);
    await batPfm(u);
    const ky = await kySong(u);
    await postLo(u, [goi(`goi:${ky}`, ky, [{ ma: 'ctx_tu_lap', gia_tri: 'phu_thuoc' }])]);
    const r = await postLo(u, [goi(`goi:${ky}`, ky, [{ ma: 'ctx_tu_lap', gia_tri: 'tu_lap' }])]);
    const j = await r.json() as any;
    expect(j.ket[0].ket, 'gói cùng kỳ PHẢI ghi đè — chống trùng chỉ dành cho nhịp').toBe('ghi');

    const { rows } = await pool.query(
      `SELECT gia_tri FROM pfm_dac_trung WHERE user_id = $1 AND ma = 'ctx_tu_lap'`, [u.userId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].gia_tri, 'phải là giá trị MỚI').toBe('tu_lap');
  });

  it.each([
    ['pfm_consent', { van_ban_id: 'pfm_ket', phien_ban: 'v1' }],
    ['pfm_diem_danh', { trang_thai: 'tron' }],
    ['pfm_tuan_niem_phong', { tuan: '2026-08-31', moc_ids: [] }],
    ['pfm_bat', {}],
    ['pfm_tat', { cua: 'ket' }],
  ])('⭐⭐⭐ client KHÔNG tự ghi được `%s` — đó là bằng chứng của server', async (ma, v) => {
    /*
     * ⚠⚠ Không có rào này thì một client bất kỳ POST thẳng một VẾT ĐỒNG Ý GIẢ vào
     * `events` — đúng cái vết R1/D250 dựng ra để CHỨNG MINH người dùng đã đọc bản nào.
     * `kiemValueJsonPfm` không cứu được: nó kiểm HÌNH của value_json, nó không biết AI gọi.
     */
    const u = await createTestUser(pool);
    await batPfm(u);
    const truoc = await demEvent(u, ma);
    const r = await postLo(u, [nhip('m1', ma, v as Record<string, unknown>)]);
    const j = await r.json() as any;
    expect(j.ket[0].ket).toBe('bo');
    expect(j.ket[0].ly_do).toMatch(/không phải nhịp client tự gửi được/);
    expect(await demEvent(u, ma), 'không được thêm một dòng events nào').toBe(truoc);
  });

  it('⭐ trần DÒNG cả lô (DONG_MOI_LO) — ít món nhưng mỗi món nhiều dòng ⇒ 400', async () => {
    /*
     * Trần cũ của `/pfm/dac-trung` đếm DÒNG; `/pfm/dong-bo` đổi sang đếm MÓN, nên nếu chỉ
     * giữ trần món thì 50 gói × DONG_MOI_GOI = 15.000 INSERT trong một transaction.
     * `content-length` không cứu: 15.000 dòng ngắn vẫn lọt dưới 64KB.
     */
    const u = await createTestUser(pool);
    await batPfm(u);
    const ky = await kySong(u);
    const dongNhieu = Array.from({ length: PFM_LO.DONG_MOI_GOI },
      (_, i) => ({ ma: 'y_loai', doi_tuong: `h${i}`, gia_tri: 'giao_duc' }));
    const soGoi = Math.ceil((PFM_LO.DONG_MOI_LO + 1) / PFM_LO.DONG_MOI_GOI);
    expect(soGoi, 'bài này chỉ có nghĩa khi số MÓN vẫn dưới trần món')
      .toBeLessThanOrEqual(PFM_LO.SU_KIEN_MOI_LO);
    const lo = Array.from({ length: soGoi }, (_, i) => goi(`g${i}`, ky, dongNhieu));
    const r = await postLo(u, lo);
    expect(r.status).toBe(400);
    expect(((await r.json()) as any).message).toMatch(/dòng/);
  });

  it('⭐ doi_tuong dài quá trần ⇒ bỏ riêng món đó, món lành vẫn ghi', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const ky = await kySong(u);
    const r = await postLo(u, [
      goi('m1', ky, [{ ma: 'y_loai', doi_tuong: 'x'.repeat(PFM.DOI_TUONG_TOI_DA + 1), gia_tri: 'giao_duc' }]),
      goi('m2', ky, [{ ma: 'ctx_tu_lap', gia_tri: 'tu_lap' }]),
    ]);
    const j = await r.json() as any;
    expect(j.ket.map((k: any) => k.ket)).toEqual(['bo', 'ghi']);
  });

  it('⭐⭐ D256 — CÙNG một `id` hai lần TRONG MỘT LÔ ⇒ chỉ ghi một, events không nhân đôi',
    async () => {
      /*
       * ⚠ LỖ NÀY DO CHÍNH CÚ TỐI ƯU TẠO RA. Bản một-lượt cũ ghi ngay trong lúc giành chỗ
       * nên không thể trùng. Bản gộp giành chỗ cho cả lô bằng MỘT câu `unnest`, mà câu ấy
       * trả id trùng đúng MỘT lần — nên nếu chỉ hỏi "id này có trong tập mới giành không"
       * thì CẢ HAI lần đều thấy "mới" và cùng ghi. Đúng cái nhân đôi bảng chống trùng
       * dựng ra để chặn, lọt qua bằng cửa sau.
       */
      const u = await createTestUser(pool);
      await batPfm(u);
      const r = await postLo(u, [
        nhip('trung-1', 'pfm_hu', { hu_id: 'hu_1', ma: 'tao' }),
        nhip('trung-1', 'pfm_hu', { hu_id: 'hu_1', ma: 'tao' }),
      ]);
      const j = await r.json() as any;
      expect(j.ket.map((k: any) => k.ket)).toEqual(['ghi', 'trung']);
      expect(await demEvent(u, 'pfm_hu'), 'events append-only KHÔNG được có bản sao').toBe(1);
    });

  it('⭐⭐ D256 — gói có HAI dòng cùng khoá ⇒ không 500, dòng CUỐI thắng', async () => {
    /*
     * ⚠ Cũng do cú tối ưu: gộp cả gói vào một `INSERT ... ON CONFLICT DO UPDATE` thì
     * Postgres ném `command cannot affect row a second time` nếu hai dòng nguồn trong
     * CÙNG câu đụng một khoá. Vòng lặp cũ không sao — dòng sau ghi đè dòng trước qua hai
     * câu riêng. Bài này khoá đúng hành vi cũ: nhận, và giữ dòng CUỐI.
     */
    const u = await createTestUser(pool);
    await batPfm(u);
    const ky = await kySong(u);
    const r = await postLo(u, [goi('m1', ky, [
      { ma: 'y_loai', doi_tuong: 'hu_1', gia_tri: 'giao_duc' },
      { ma: 'y_loai', doi_tuong: 'hu_1', gia_tri: 'du_phong' },
    ])]);
    expect(r.status, 'trùng khoá trong một gói KHÔNG được làm sập cả lô').toBe(200);
    expect(((await r.json()) as any).ket[0].ket).toBe('ghi');

    const { rows } = await pool.query(
      `SELECT gia_tri FROM pfm_dac_trung WHERE user_id = $1 AND doi_tuong = 'hu_1'`, [u.userId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].gia_tri, 'dòng CUỐI thắng, đúng như vòng lặp cũ để lại').toBe('du_phong');
  });

  it('⭐ D256 — gói lớn vẫn ghi ĐỦ dòng sau khi gộp thành một câu', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const ky = await kySong(u);
    const soDong = 20;
    const dong = Array.from({ length: soDong },
      (_, i) => ({ ma: 'y_loai', doi_tuong: `hu_${i}`, gia_tri: 'giao_duc' }));
    const r = await postLo(u, [goi('m1', ky, dong)]);
    expect(((await r.json()) as any).ket[0].ket).toBe('ghi');
    const n = await pool.query(
      `SELECT count(*)::int AS n FROM pfm_dac_trung WHERE user_id = $1 AND ma NOT LIKE 'gm\\_%'`, [u.userId]);
    expect(n.rows[0].n, 'gộp không được nuốt dòng nào').toBe(soDong);
  });

  it('`mon` không phải mảng ⇒ 400', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const r = await postLo(u, { id: 'x' } as unknown);
    expect(r.status).toBe(400);
  });

  it('vượt trần SU_KIEN_MOI_LO (số món một lô) ⇒ 400', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const ky = await kySong(u);
    const qua = Array.from({ length: PFM_LO.SU_KIEN_MOI_LO + 1 },
      (_, i) => goi(`m${i}`, ky, [{ ma: 'ctx_tu_lap', gia_tri: 'tu_lap' }]));
    expect((await postLo(u, qua)).status).toBe(400);
  });

  it('⭐ R2 — thân vượt PFM_LO.THAN_TOI_DA ⇒ 413 (chặn bằng content-length)', async () => {
    const u = await createTestUser(pool);
    await batPfm(u);
    const r = await guiLo(u, JSON.stringify({ mon: [], don: 'x'.repeat(PFM_LO.THAN_TOI_DA + 10) }));
    expect(r.status).toBe(413);
  });
});
