/**
 * GIAI ĐOẠN DỮ LIỆU + CỬA THOÁT DỌN BETA (founder 31/08).
 *
 * ⚠ VÌ SAO FILE NÀY CANH CẢ NHỮNG THỨ "HIỂN NHIÊN": mọi thứ ở đây hỏng IM LẶNG.
 * Một bộ lọc phiên bản sai không nổ — nó trả về một tỷ lệ trông rất hợp lý, dựng
 * trên một trò khác. Một cửa thoát trigger rò ra ngoài transaction cũng không nổ
 * — nó chỉ lặng lẽ biến `events` thành bảng xoá được. Cả hai chỉ lộ khi có người
 * đi đọc lại dữ liệu vài tháng sau, lúc không sửa được nữa.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import {
  CONTEXT_DA_CHET, GIAI_DOAN, PHIEN_BAN_SONG,
  duocVaoPhanTich, giaiDoanCuaPhienBan,
} from '../config/giai_doan.js';
import { BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION } from '../config/holdem.js';
import { GOI } from '../server/hanh_vi/goi.js';
import { docVer } from '../server/admin_thongke.js';

/** Một phiên bản CÒN SỐNG nhưng không phải mặc định — để canh nhánh `cu`. */
const VER_CU = Object.keys(BO_LUAT_THEO_PHIEN_BAN)
  .find((v) => v !== HOLDEM_BALANCE_VERSION)!;
/** Chuỗi đã biến mất khỏi registry — đúng ca prod (`balance-v2-D20lever`, 81 trận). */
const VER_CHET = 'balance-v2-D20lever';

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Luật giai đoạn (thuần)', () => {
  it('ba nhánh + null', () => {
    expect(giaiDoanCuaPhienBan(HOLDEM_BALANCE_VERSION)).toBe('hien_tai');
    expect(giaiDoanCuaPhienBan(VER_CU)).toBe('cu');
    expect(giaiDoanCuaPhienBan(VER_CHET)).toBe('khong_dung_lai_duoc');
    // NULL cũng là "không dựng lại được": không biết luật nào thì không suy được gì.
    expect(giaiDoanCuaPhienBan(null)).toBe('khong_dung_lai_duoc');
    expect(giaiDoanCuaPhienBan(undefined)).toBe('khong_dung_lai_duoc');
    expect(giaiDoanCuaPhienBan('')).toBe('khong_dung_lai_duoc');
  });

  it('`cu` VẪN vào được phân tích — chỉ `khong_dung_lai_duoc` bị cắt', () => {
    // Ranh giới là DỰNG LẠI ĐƯỢC KHÔNG, không phải CŨ HAY MỚI. Lẫn hai thứ này
    // thì mọi phiên bản trước bản mới nhất bị vứt, và mùa 0.0 còn 0 trận.
    expect(duocVaoPhanTich(HOLDEM_BALANCE_VERSION)).toBe(true);
    expect(duocVaoPhanTich(VER_CU)).toBe(true);
    expect(duocVaoPhanTich(VER_CHET)).toBe(false);
    expect(duocVaoPhanTich(null)).toBe(false);
  });

  it('⚠ MẶC ĐỊNH PHẢI NẰM TRONG REGISTRY — nếu không, mọi dòng mới sinh ra đã là rác', () => {
    /*
     * Bài canh cấu hình chí mạng. Nếu ai đó lật `HOLDEM_BALANCE_VERSION` sang một
     * chuỗi chưa khai trong `BO_LUAT_THEO_PHIEN_BAN` thì: `luatCua()` trả bộ cờ
     * tắt hết (engine chạy sai luật), VÀ mọi trận mới bị chính bộ lọc này xếp vào
     * `khong_dung_lai_duoc` — tức app vừa chơi sai vừa vứt hết dữ liệu, im lặng.
     */
    expect(HOLDEM_BALANCE_VERSION in BO_LUAT_THEO_PHIEN_BAN).toBe(true);
    expect(giaiDoanCuaPhienBan(HOLDEM_BALANCE_VERSION)).toBe('hien_tai');
  });

  it('PHIEN_BAN_SONG suy từ registry, KHÔNG chép tay (bài học D169)', () => {
    expect([...PHIEN_BAN_SONG].sort())
      .toEqual(Object.keys(BO_LUAT_THEO_PHIEN_BAN).sort());
    expect(PHIEN_BAN_SONG).toContain(HOLDEM_BALANCE_VERSION);
    expect(PHIEN_BAN_SONG).not.toContain(VER_CHET);
  });

  it('CHỢ DỰ BÁO không nằm trong "sản phẩm đã chết" — D86 là ĐÓNG BĂNG, không khai tử', () => {
    // Xếp `market` vào đây là lặng lẽ biến một quyết định đóng băng thành một
    // quyết định khai tử — việc của founder, không phải của một hằng số.
    expect(CONTEXT_DA_CHET).not.toContain('market');
    expect(CONTEXT_DA_CHET).toContain('sandbox_match');
  });

  it('sàn tin cậy KHỚP với ngưỡng "gói đầy" — hai chỗ không được nói hai số', () => {
    // Cả hai trả lời cùng một câu: "đã đủ để nói gì chưa". Lệch nhau thì mặt
    // admin bảo mẫu đủ trong khi tầng hành vi bảo chưa, hoặc ngược lại.
    expect(GIAI_DOAN.SAN_TRAN_TIN_CAY).toBe(GOI.TRAN);
  });

  it('docVer: mặc định là PHIÊN BẢN HIỆN TẠI, không phải "tất cả"', () => {
    // Để mặc định là "tất cả" tức là để con số sai làm mặc định.
    expect(docVer(() => undefined)).toEqual(
      { che_do: 'hien_tai', ver: HOLDEM_BALANCE_VERSION });
    expect(docVer((k) => (k === 'ver' ? 'tat_ca' : undefined)).che_do).toBe('tat_ca');
    expect(docVer((k) => (k === 'ver' ? VER_CU : undefined)))
      .toEqual({ che_do: 'hien_tai', ver: VER_CU });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. Cửa thoát dọn beta — CẢ HAI ĐÃ ĐÓNG (0049→0053 · 0054→0055, D225/D228)', () => {
  let db: TestDb;
  let pool: pg.Pool;
  let u: TestUser;

  beforeAll(async () => {
    db = await startTestDb();
    pool = db.pool;
    await ensureGenesis(pool);
    u = await createTestUser(pool);
  }, 120_000);
  afterAll(async () => { await db?.stop(); });

  const themEvent = async (): Promise<string> => {
    const { rows } = await pool.query(
      `INSERT INTO events (user_id, context_type, context_id, action_type)
       VALUES ($1, 'holdem', 'x', 'hd_cam_ket') RETURNING event_id::text AS id`, [u.userId]);
    return rows[0].id as string;
  };

  it('KHÔNG cờ ⇒ DELETE nổ (A3.3 là mặc định, chưa từng đổi)', async () => {
    const id = await themEvent();
    await expect(pool.query('DELETE FROM events WHERE event_id = $1', [id]))
      .rejects.toThrow(/append-only/i);
  });

  it('⚠⚠ CỜ 0049 KHÔNG CÒN TÁC DỤNG — cửa đóng vĩnh viễn, không phải "tạm không ai bật"', async () => {
    /*
     * 0049 tự đặt ngày chết: "trước khi mời người ngoài vòng quen biết". D225
     * (03/09) là lần dùng cuối; 0053 khoá lại NGAY sau đó bằng cách trả trigger
     * `events` về `forbid_mutation()` — giống hệt wallet_ledger/treasury_ledger/
     * burn_ledger/admin_audit — và DROP hẳn `events_chan()`, không còn hàm nào
     * đọc `delphi.don_beta` trên bảng này nữa.
     *
     * Bài test CHỦ Ý bật đúng cờ D225 đã dùng rồi chứng minh nó vô nghĩa: nếu
     * sau này ai đó lỡ hồi sinh `events_chan()` (vd. chép 0049 làm mẫu cho một
     * cửa thoát khác rồi quên bảng NÀY đã bị 0053 khoá) thì bài test đỏ ngay.
     */
    const id = await themEvent();
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('delphi.don_beta', '1', true)`);
      await expect(c.query('DELETE FROM events WHERE event_id = $1', [id]))
        .rejects.toThrow(/append-only/i);
      await c.query('ROLLBACK');
    } finally { c.release(); }
  });

  it('UPDATE cấm TUYỆT ĐỐI, kể cả khi cờ bật', async () => {
    const id = await themEvent();
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('delphi.don_beta', '1', true)`);
      await expect(c.query(
        `UPDATE events SET action_type = 'doi' WHERE event_id = $1`, [id]))
        .rejects.toThrow(/append-only/i);
      await c.query('ROLLBACK');
    } finally { c.release(); }
  });

  it('⚠⚠ SỔ TIỀN KHÔNG CÓ CỬA NÀO ĐANG MỞ — cả hai cờ từng dùng nay đều vô nghĩa', async () => {
    /*
     * Ba sổ tiền có MỘT lần mở cửa duy nhất trong lịch sử repo: 0054→0055
     * (D228, cùng phiên với D225), hẹp và có ngày chết ngay lập tức — khác
     * `events` (0049→0053, mở treo 4 ngày). Bài test này canh TRẠNG THÁI CUỐI:
     * cả cờ cũ của `events` (`delphi.don_beta`) lẫn cờ của cửa 0054
     * (`delphi.go_ref_market`) đều không còn tác dụng gì trên ba sổ tiền — kể
     * cả UPDATE chỉ-đổi-ref_market_id (đúng thứ 0054 từng cho phép) lẫn DELETE.
     * `npm run audit:supply` recompute số dư TỪ sổ, nên một dòng/một cột biến
     * mất là số dư sai vĩnh viễn mà không cách nào truy ra.
     */
    const { rows: mkt } = await pool.query(
      `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url,
                            open_ts, lock_ts, resolve_deadline_ts, season_id, created_by)
       VALUES ('event', 'x', 'x', 'https://x', now(), now() + interval '1 day',
               now() + interval '2 day', '2026Q3', $1) RETURNING market_id`, [u.userId]);
    const { rows } = await pool.query(
      `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason, ref_market_id)
       VALUES ($1, 1, 1, 'admin_adjust', $2) RETURNING entry_id`, [u.userId, mkt[0].market_id]);
    // Hai transaction RIÊNG — một câu nổ là cả transaction "aborted", câu sau
    // trong CÙNG transaction sẽ nổ sai lý do (không phải trigger) chứ không
    // phải append-only nữa. Tách để mỗi assertion canh đúng nguyên nhân của nó.
    const c1 = await pool.connect();
    try {
      await c1.query('BEGIN');
      await c1.query(`SELECT set_config('delphi.don_beta', '1', true)`);
      await c1.query(`SELECT set_config('delphi.go_ref_market', '1', true)`);
      await expect(c1.query(
        'DELETE FROM wallet_ledger WHERE entry_id = $1', [rows[0].entry_id]))
        .rejects.toThrow(/append-only/i);
      await c1.query('ROLLBACK');
    } finally { c1.release(); }

    // Đúng thao tác 0054 từng cho phép — nay phải nổ y hệt DELETE.
    const c2 = await pool.connect();
    try {
      await c2.query('BEGIN');
      await c2.query(`SELECT set_config('delphi.don_beta', '1', true)`);
      await c2.query(`SELECT set_config('delphi.go_ref_market', '1', true)`);
      await expect(c2.query(
        'UPDATE wallet_ledger SET ref_market_id = NULL WHERE entry_id = $1', [rows[0].entry_id]))
        .rejects.toThrow(/append-only/i);
      await c2.query('ROLLBACK');
    } finally { c2.release(); }
  });

  it('TRUNCATE cấm — không đếm được thì không cho', async () => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('delphi.don_beta', '1', true)`);
      await expect(c.query('TRUNCATE events')).rejects.toThrow(/append-only/i);
      await c.query('ROLLBACK');
    } finally { c.release(); }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Mặt admin có chiều phiên bản', () => {
  let db: TestDb;
  let pool: pg.Pool;
  let app: Hono<any>;
  let admin: TestUser;
  let A: TestUser;

  beforeAll(async () => {
    db = await startTestDb();
    pool = db.pool;
    app = createApp({
      pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
    }) as Hono<any>;
    await ensureGenesis(pool);
    admin = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    await moCuaAdmin(pool, admin);
    A = await createTestUser(pool);

    /* Ba trận, ba giai đoạn — đáp án biết trước. */
    const tran = async (ver: string, hang: number): Promise<string> => {
      const { rows } = await pool.query(
        `INSERT INTO holdem_matches
           (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json,
            engine_version, balance_version, season_id, started_at, so_o)
         VALUES ($1, 1, 'xong', 8, '[]'::jsonb, '[]'::jsonb, 'e', $2, '2026Q3', now(), 8)
         RETURNING match_id::text AS id`, [A.userId, ver]);
      const id = rows[0].id as string;
      await pool.query(
        `INSERT INTO holdem_results
           (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json)
         VALUES ($1, $2, 'ban', 'nguoi', 'tom', $3, 1000, 8, '{}'::jsonb)`,
        [id, A.userId, hang]);
      await pool.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type)
         VALUES ($1, 'holdem', $2, 'hd_cam_ket')`, [A.userId, id]);
      return id;
    };
    await tran(HOLDEM_BALANCE_VERSION, 1);
    await tran(VER_CU, 2);
    await tran(VER_CHET, 3);
  }, 120_000);
  afterAll(async () => { await db?.stop(); });

  const goi = (u: string) => app.request(u, { headers: { cookie: admin.cookie } });
  const j = async (r: Response) => { expect(r.status).toBe(200); return r.json() as any; };

  it('/tk/phien-ban liệt kê ĐỦ, kèm nhãn giai đoạn', async () => {
    const b = await j(await goi('/api/v1/admin/tk/phien-ban'));
    const theo = Object.fromEntries(b.dong.map((d: any) => [d.ver, d]));
    expect(theo[HOLDEM_BALANCE_VERSION].giai_doan).toBe('hien_tai');
    expect(theo[VER_CU].giai_doan).toBe('cu');
    // Mặt này là mặt DUY NHẤT hiện phiên bản chết — nó kể kho, không tính tỷ lệ.
    expect(theo[VER_CHET].giai_doan).toBe('khong_dung_lai_duoc');
    expect(theo[HOLDEM_BALANCE_VERSION].n_events).toBe(1);
    expect(b.ver_hien_tai).toBe(HOLDEM_BALANCE_VERSION);
  });

  it('/tk/phien-ban NÓI RA phần bị cắt — cắt im lặng là cái bẫy', async () => {
    const b = await j(await goi('/api/v1/admin/tk/phien-ban'));
    expect(b.bi_cat.tran).toBe(1);
    expect(b.bi_cat.events).toBe(1);
    expect(b.bi_cat.phien_ban).toContain(VER_CHET);
    expect(b.bi_cat.ty_le_tran).toBeCloseTo(1 / 3, 2);
  });

  it('/tk/tran mặc định = phiên bản hiện tại (hai trận kia KHÔNG lọt)', async () => {
    const b = await j(await goi('/api/v1/admin/tk/tran'));
    expect(b.loc.ver).toBe(HOLDEM_BALANCE_VERSION);
    expect(b.mau.tran).toBe(1);
    // Chỉ hạng 1 (trận của phiên bản hiện tại) được đếm.
    expect(b.phan_bo_hang.map((d: any) => d.hang)).toEqual([1]);
  });

  it('/tk/tran?ver=<cũ> xem được phiên bản cũ — so sánh là mục đích của cả đợt này', async () => {
    const b = await j(await goi(`/api/v1/admin/tk/tran?ver=${encodeURIComponent(VER_CU)}`));
    expect(b.loc.giai_doan).toBe('cu');
    expect(b.mau.tran).toBe(1);
    expect(b.phan_bo_hang.map((d: any) => d.hang)).toEqual([2]);
  });

  it('⚠ ?ver=tat_ca VẪN cắt phiên bản không dựng lại được', async () => {
    /*
     * "Tất cả" = mọi phiên bản CÒN DỰNG LẠI ĐƯỢC. Cho trận chết vào một ô nào đó
     * của mặt admin là mời người sau cộng nó vào một tỷ lệ.
     */
    const b = await j(await goi('/api/v1/admin/tk/tran?ver=tat_ca'));
    expect(b.mau.tran).toBe(2);
    expect(b.phan_bo_hang.map((d: any) => d.hang).sort()).toEqual([1, 2]);
    expect(b.phan_bo_hang.map((d: any) => d.hang)).not.toContain(3);
  });

  it('⚠⚠ gọi ĐÍCH DANH phiên bản đã chết ⇒ RỖNG, không phải "số của phiên bản đó"', async () => {
    /*
     * Lỗ này lọt qua bài `?ver=tat_ca` ở trên (bài đó chỉ canh nhánh whitelist).
     * Không có bài này thì `/tk/tran?ver=balance-v2-D20lever` sẽ tính phân bố
     * hạng trên 81 trận của một bộ luật không còn tồn tại — mà nó TRÔNG hợp lệ.
     */
    const b = await j(await goi(`/api/v1/admin/tk/tran?ver=${encodeURIComponent(VER_CHET)}`));
    expect(b.loc.giai_doan).toBe('khong_dung_lai_duoc');
    expect(b.mau.tran).toBe(0);
    expect(b.phan_bo_hang).toEqual([]);
    // ⚠ Và KHÔNG được âm thầm thay bằng whitelist: người hỏi sẽ tưởng con số họ
    // thấy là của phiên bản họ gõ. `loc.ver` phải giữ nguyên chuỗi đã hỏi.
    expect(b.loc.ver).toBe(VER_CHET);
  });

  it('cỡ mẫu ĐI KÈM con số, kèm cờ mẫu mỏng', async () => {
    const b = await j(await goi('/api/v1/admin/tk/tran'));
    expect(b.mau).toMatchObject({ tran: 1, xong: 1, mong: true });
    expect(b.mau.san_tin_cay).toBe(GIAI_DOAN.SAN_TRAN_TIN_CAY);
  });

  it('ô "thoát theo vòng" tự khai là KHÔNG lọc được theo phiên bản', async () => {
    // Schema `tran_thoat` chỉ chở {vong, giay}. Bỏ cờ này đi là biến một hạn chế
    // đã biết thành một cái bẫy: người đọc tưởng nó cùng bộ lọc với ô bên cạnh.
    const b = await j(await goi('/api/v1/admin/tk/tran'));
    expect(b.thoat_khong_loc_duoc_ver).toBe(true);
  });

  it('/tk/tinh-cach khai ĐỘ TRỘN phiên bản thay vì im lặng gộp', async () => {
    const b = await j(await goi('/api/v1/admin/tk/tinh-cach'));
    expect(b.tron_phien_ban).toMatchObject({
      ver_hien_tai: HOLDEM_BALANCE_VERSION,
      so_phien_ban: expect.any(Number),
    });
    expect(b.tron_phien_ban.ty_le_khong_dung_lai_duoc).toBeGreaterThanOrEqual(0);
    expect(b.tron_phien_ban.ty_le_khong_dung_lai_duoc).toBeLessThanOrEqual(1);
  });
});
