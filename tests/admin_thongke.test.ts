/**
 * BƯỚC 3 — TẦNG SỐ CỦA DASHBOARD (bản yêu cầu 01 §4).
 *
 * ⚠ VÌ SAO FILE NÀY DÀI HƠN BÌNH THƯỜNG: phần lớn tầng này là SQL gõ tay, và
 * SQL sai thì **không nổ** — nó trả về một con số trông rất hợp lý. Một
 * dashboard nói dối tệ hơn hẳn một dashboard trống, vì người ta ra quyết định
 * dựa vào nó. Nên mỗi chỉ số ở đây được dựng dữ liệu BIẾT TRƯỚC ĐÁP ÁN rồi so.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { BUOC_HUONG_DAN } from '../config/telemetry.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let admin: TestUser;
let thuong: TestUser;

/** Ba người, ba hồ sơ nhân khẩu BIẾT TRƯỚC — mọi khẳng định dưới đây neo vào đây. */
let A: TestUser; // 16-17 · bac  · hs_sv
let B: TestUser; // 16-17 · bac  · van_phong
let C: TestUser; // 23-30 · nam  · hs_sv

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  admin = await createTestUser(pool, { role: 'admin', bankroll: 0 });
  await moCuaAdmin(pool, admin);
  thuong = await createTestUser(pool);

  const dat = async (u: TestUser, tuoi: string, vung: string, nghe: string) =>
    pool.query(
      `UPDATE users SET age_band=$2, region=$3, occupation_band=$4 WHERE user_id=$1`,
      [u.userId, tuoi, vung, nghe],
    );
  /*
   * ⚠ CỐ Ý TRÁNH VÙNG 'bac': fixture mặc định là 18-22 · bac · hs_sv, và các
   * describe khác còn tạo thêm user. Neo khẳng định vào 'trung'/'nam' thì con
   * số không trôi theo số test chạy trước — một test đếm tuyệt đối trên dữ liệu
   * dùng chung là test sẽ đỏ vì lý do chẳng liên quan gì.
   */
  A = await createTestUser(pool); await dat(A, '16-17', 'trung', 'hs_sv');
  B = await createTestUser(pool); await dat(B, '16-17', 'trung', 'van_phong');
  C = await createTestUser(pool); await dat(C, '23-30', 'nam', 'hs_sv');
}, 120_000);

afterAll(async () => { await db?.stop(); });

const goi = async (path: string, u: TestUser = admin): Promise<Response> =>
  app.request(path, { headers: { cookie: u.cookie } });
const j = (r: Response): Promise<any> => r.json() as Promise<any>;

// ═══════════════════════════════════════════════════════════════════════════
describe('II. Quyền — tầng số cũng phải qua cửa 2FA', () => {
  it('người thường 403 trên MỌI endpoint thống kê', async () => {
    for (const p of ['tong-quan', 'hanh-trinh', 'keo', 'tran', 'tinh-cach', 'phien-ban']) {
      expect((await goi(`/api/v1/admin/tk/${p}`, thuong)).status, p).toBe(403);
    }
  });

  it('admin CHƯA qua 2FA cũng 403 (dùng chung requireAdmin, không có cửa sau)', async () => {
    const moi = await createTestUser(pool, { role: 'admin' });
    const r = await goi('/api/v1/admin/tk/tong-quan', moi);
    expect(r.status).toBe(403);
    expect((await j(r)).error).toBe('can_ghi_danh_2fa');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VI. Kèo — khẩu vị rủi ro là tín hiệu B2B đắt nhất, phải đúng', () => {
  it('độ đậm đặc: tất tay một cửa = 1,0 · rải đều hai cửa = 0,5', async () => {
    const { rows: m } = await pool.query(
      `INSERT INTO markets (pool, question_text, resolution_source_name,
                            resolution_source_url, open_ts, lock_ts, resolve_deadline_ts,
                            status, seed_per_option, season_id, created_by)
       VALUES ('life','x','n','https://x','2026-04-01','2026-04-02','2026-04-03',
               'open', 0, '2026Q2', $1) RETURNING market_id`, [admin.userId]);
    const mid = m[0].market_id;
    const { rows: o } = await pool.query(
      `INSERT INTO market_options (market_id, label, sort_order)
       VALUES ($1,'A',0),($1,'B',1) RETURNING option_id`, [mid]);

    // A tất tay cửa 1 → 1,0 ; B chia đều hai cửa → 0,5
    await pool.query(
      `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed)
       VALUES ($1,$2,$3,100,false)`, [mid, o[0].option_id, A.userId]);
    await pool.query(
      `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed)
       VALUES ($1,$2,$3,50,false),($1,$4,$3,50,false)`,
      [mid, o[0].option_id, B.userId, o[1].option_id]);
    /*
     * ⚠ TRỪ VÍ + GHI SỔ cho khớp. Chèn `bets` trần là tạo token từ hư không:
     * kiểm toán cung tiền (A3.10) đỏ ngay, và §VIII sẽ đỏ theo — bản đầu của
     * test này đúng như vậy. Cách chữa KHÔNG phải là hạ chuẩn khẳng định
     * `audit_ok`, mà là để dữ liệu dựng sẵn tôn trọng chính bất biến đang canh.
     */
    for (const u of [A, B]) {
      await pool.query(
        `UPDATE users SET bankroll = bankroll - 100 WHERE user_id = $1`, [u.userId]);
      await pool.query(
        `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason, ref_market_id)
         SELECT $1, -100, bankroll, 'bet_place', $2 FROM users WHERE user_id = $1`,
        [u.userId, mid]);
    }

    const b = await j(await goi('/api/v1/admin/tk/keo'));
    expect(b.khau_vi_rui_ro.n).toBe(2);
    expect(b.khau_vi_rui_ro.tat_tay).toBe(1);          // chỉ A
    expect(b.khau_vi_rui_ro.tb).toBeCloseTo(0.75, 2);  // (1,0 + 0,5) / 2
  });

  it('bầy đàn đếm được, kèo có cược trong khoảng có volume', async () => {
    const b = await j(await goi('/api/v1/admin/tk/keo'));
    expect(b.bay_dan).toHaveProperty('da_thay');
    expect(b.bay_dan).toHaveProperty('co_chinh_sau');
    // Kèo mở từ 04/2026 (ngoài 30 ngày) nhưng có lượt đặt HÔM NAY ⇒ vẫn thuộc khoảng mặc định (D341).
    expect(b.keo_trong_khoang.length).toBeGreaterThan(0);
    expect(b.keo_trong_khoang[0]).toHaveProperty('volume');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VII. Trận + thứ hạng', () => {
  it('phân bố hạng LUÔN kèm số ghế — "hạng 4" ở bàn 4 khác hẳn ở bàn 8', async () => {
    const b = await j(await goi('/api/v1/admin/tk/tran'));
    expect(Array.isArray(b.phan_bo_hang)).toBe(true);
    for (const d of b.phan_bo_hang) {
      // Thiếu `so_ghe` thì con số này vô nghĩa — và tệ hơn, nó TRÔNG có nghĩa.
      expect(d).toHaveProperty('so_ghe');
      expect(d).toHaveProperty('hang');
    }
  });

  it('thoát giữa chừng gom theo VÒNG', async () => {
    await pool.query(
      `INSERT INTO telemetry (user_id, loai, chi_tiet)
       VALUES ($1,'tran_thoat','{"vong":3}'::jsonb), ($1,'tran_thoat','{"vong":3}'::jsonb),
              ($1,'tran_thoat','{"vong":7}'::jsonb)`, [A.userId]);
    const b = await j(await goi('/api/v1/admin/tk/tran'));
    expect(b.thoat_theo_vong).toEqual([{ vong: 3, n: 2 }, { vong: 7, n: 1 }]);
  });

  it('chuỗi về bét chạy được trên bảng rỗng (0, không nổ)', async () => {
    const b = await j(await goi('/api/v1/admin/tk/tran'));
    expect(b.chuoi_ve_bet).toMatchObject({ dai_nhat: expect.any(Number) });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VIII. Tổng quan', () => {
  it('trả đủ khối, và dung lượng kho có số thật + trần 500 MB', async () => {
    const b = await j(await goi('/api/v1/admin/tk/tong-quan'));
    expect(b.nguoi.tong).toBeGreaterThan(0);
    expect(b.kinh_te.audit_ok).toBe(true);
    expect(b.kho.tran_mb).toBe(500);
    expect(b.kho.tong_mb).toBeGreaterThan(0);
    // §4.2 mục 14: thấy TRƯỚC khi chạm trần, không phải lúc đã chạm.
    expect(b.kho.bang.length).toBeGreaterThan(0);
    expect(b.kho.bang[0]).toHaveProperty('mb');
    /*
     * ⚠ TỔNG PHẢI ≥ TỔNG CÁC BẢNG ĐƯỢC LIỆT KÊ. Bản đầu lấy tổng = tổng 12
     * bảng lớn nhất và báo 6,1/500 MB trong khi database thật 31,4 MB — hụt
     * hơn 5 lần, tức một cảnh báo sớm biến thành thuốc ngủ. Chỉ lộ khi chạy
     * trên dữ liệu prod; ở fixture thì hai con số gần bằng nhau nên test cũ
     * xanh mà vẫn sai.
     */
    const tongBang = b.kho.bang.reduce((a: number, x: any) => a + x.mb, 0);
    expect(b.kho.tong_mb).toBeGreaterThanOrEqual(tongBang);
  });

  it('lỗi API gom theo mã (tử số của sức khoẻ kỹ thuật)', async () => {
    await pool.query(
      `INSERT INTO telemetry (user_id, loai, chi_tiet)
       VALUES ($1,'loi_api','{"ma":"timeout"}'::jsonb),
              ($1,'loi_api','{"ma":"timeout"}'::jsonb),
              ($1,'loi_api','{"ma":"network"}'::jsonb)`, [A.userId]);
    const b = await j(await goi('/api/v1/admin/tk/tong-quan'));
    expect(b.loi_api).toEqual([{ ma: 'timeout', n: 2 }, { ma: 'network', n: 1 }]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IX. HÀNH TRÌNH — người ta rời đi ở đâu (founder hỏi 03/08)', () => {
  /** Dựng một người mới đi trọn đường: đăng nhập → hub → hướng dẫn → bỏ trận. */
  beforeAll(async () => {
    const ghi = (u: TestUser, loai: string, over: Record<string, unknown> = {}) =>
      pool.query(
        `INSERT INTO telemetry (user_id, loai, man, ms, chi_tiet)
         VALUES ($1, $2, $3, $4, $5)`,
        [u.userId, loai, over.man ?? null, over.ms ?? null,
          over.chi_tiet ? JSON.stringify(over.chi_tiet) : null],
      );

    // A: đăng nhập mất 12 giây → vào Hub → học hết hướng dẫn → CÒN hoạt động
    await ghi(A, 'dang_nhap');
    await ghi(A, 'man_ra', { man: '/onboard', ms: 12_000 });
    await ghi(A, 'man_vao', { man: '/' });
    // Id bước theo BUOC_HUONG_DAN (16/08 hướng dẫn ít chữ: mo-shop · taisan · shop-lenh …).
    for (const b of ['mo-shop', 'taisan', 'shop-lenh', 'het']) {
      await ghi(A, 'huong_dan_buoc', { chi_tiet: { buoc: b } });
    }
    await ghi(A, 'man_vao', { man: '/arena' });          // ở lại sau khi học xong
    await ghi(A, 'man_ra', { man: '/arena/tran/:matchId', ms: 8 * 60_000 });

    // B: đăng nhập mất 40 giây → vào thẳng đấu trường → bỏ hướng dẫn ở bước 2
    await ghi(B, 'dang_nhap');
    await ghi(B, 'man_ra', { man: '/onboard', ms: 40_000 });
    await ghi(B, 'man_vao', { man: '/arena' });
    for (const b of ['mo-shop', 'taisan']) {
      await ghi(B, 'huong_dan_buoc', { chi_tiet: { buoc: b } });
    }
    await ghi(B, 'tran_thoat', { chi_tiet: { vong: 3, giay: 200 } });  // phút 3
    await ghi(B, 'tran_thoat', { chi_tiet: { vong: 5, giay: 400 } });  // phút 6
  });

  it('ĐĂNG NHẬP MẤT BAO LÂU — ghép đúng `man_ra` của màn /onboard', async () => {
    const b = await j(await goi('/api/v1/admin/tk/hanh-trinh'));
    expect(b.dang_nhap.so_lan).toBe(2);
    /*
     * ⚠ Đo bằng `ms` client gửi, KHÔNG trừ `ts`: `ts` do server đặt lúc NHẬN LÔ,
     * mà lô gộp tới 20 sự kiện hoặc 30 giây — hai sự kiện cách nhau 3 giây thật
     * có thể mang cùng một `ts`. Trung vị của {12s, 40s} = 26s.
     */
    expect(b.dang_nhap.giay_p50).toBe(26);
  });

  it('ĐĂNG NHẬP XONG ĐI ĐÂU — màn đầu tiên sau cú đăng nhập', async () => {
    const b = await j(await goi('/api/v1/admin/tk/hanh-trinh'));
    const m = Object.fromEntries(b.sau_dang_nhap.map((x: any) => [x.man, x.n]));
    expect(m['/']).toBe(1);        // A
    expect(m['/arena']).toBe(1);   // B
    // Màn `/onboard` bị loại: quay lại chính màn đăng nhập không phải "đi đâu".
    expect(m['/onboard']).toBeUndefined();
  });

  it('HƯỚNG DẪN — rơi ở bước nào, ĐÚNG THỨ TỰ, và ai ở lại sau khi học xong', async () => {
    const b = await j(await goi('/api/v1/admin/tk/hanh-trinh'));
    expect(b.huong_dan.bat_dau).toBe(2);
    expect(b.huong_dan.di_het).toBe(1);            // chỉ A tới bước 'het'
    expect(b.huong_dan.xong_roi_o_lai).toBe(1);    // A còn mở màn sau đó
    expect(b.huong_dan.xong_roi_di_luon).toBe(0);

    // Phễu phải theo THỨ TỰ khai trong config, không theo thứ tự SQL trả về —
    // và là TRỌN danh sách: bước không ai tới vẫn hiện với 0 người, SQL không
    // được lược nó đi (phễu thiếu bậc thì không đọc được "rơi ở đâu").
    // 07/09 (D302): so với chính `BUOC_HUONG_DAN` thay vì chép tay ba id đầu —
    // D300 chen `vai` vào vị trí 2 và bài này đỏ vì bản chép, không vì phễu sai.
    const buoc = b.huong_dan.buoc.map((x: any) => x.buoc);
    expect(buoc).toEqual([...BUOC_HUONG_DAN]);
    expect(buoc.indexOf('mo-shop')).toBeLessThan(buoc.indexOf('taisan'));
    expect(buoc.indexOf('taisan')).toBeLessThan(buoc.indexOf('shop-lenh'));
    // D527 — phễu nối đuôi hai kịch bản (bàn tập v54 rồi bàn tập minigame): mỗi kịch bản kết bằng bậc "đi hết" của nó.
    expect(buoc.indexOf('het')).toBeGreaterThan(buoc.indexOf('shop-lenh'));
    expect(buoc[buoc.length - 1]).toBe('mg-het');

    const m = Object.fromEntries(b.huong_dan.buoc.map((x: any) => [x.buoc, x.so_nguoi]));
    expect(m['mo-shop']).toBe(2);   // cả hai
    expect(m.taisan).toBe(2);
    expect(m['shop-lenh']).toBe(1); // B rơi ở đây
    expect(m.het).toBe(1);
  });

  /*
   * ⚠⚠ TRẬN ĐỌC TỪ `holdem_matches`, KHÔNG TỪ TELEMETRY — và đó là cả bài học.
   *
   * Bản đầu đo bằng `man_ra`/`tran_thoat` do client gửi. Nhưng client chỉ gửi
   * được khi React tháo cây, tức chỉ khi người ta BẤM NÚT để rời; đóng app giữa
   * trận thì không có dòng nào. Mà prod nói bỏ dở LÀ HÀNH VI ĐA SỐ (90/137), nên
   * bản đầu vẽ đúng nhóm thiểu số rồi trông như một phân bố đầy đủ.
   */
  it('TRẬN — thời lượng và điểm bỏ dở đọc từ trạng thái bền, không từ telemetry', async () => {
    /**
     * Dựng một trận + dấu vết `events` của nó.
     * `nuocCuoiPhutTruoc` = nước CUỐI CÙNG của người chơi; sau đó luôn thêm một
     * `hd_tran_het_han` của bộ quét dọn để chứng minh truy vấn loại đúng nó ra.
     */
    const tran = async (o: {
      st: string; batDauPhutTruoc: number; ketPhutTruoc?: number;
      nuocCuoiPhutTruoc?: number; vong: number;
    }) => {
      const { rows } = await pool.query(
        `INSERT INTO holdem_matches
           (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json,
            engine_version, balance_version, season_id, started_at, ended_at, so_o)
         VALUES ($1, 1, $2, $3, '[]'::jsonb, '[]'::jsonb, 'e', 'b', '2026Q3',
                 now() - ($4 || ' minutes')::interval,
                 CASE WHEN $5::text IS NULL THEN NULL
                      ELSE now() - ($5 || ' minutes')::interval END, 8)
         RETURNING match_id::text AS id`,
        [A.userId, o.st, o.vong, String(o.batDauPhutTruoc),
          o.ketPhutTruoc === undefined ? null : String(o.ketPhutTruoc)],
      );
      const id = rows[0].id as string;
      if (o.nuocCuoiPhutTruoc !== undefined) {
        await pool.query(
          `INSERT INTO events (user_id, ts, context_type, context_id, action_type)
           VALUES ($1, now() - ($2 || ' minutes')::interval, 'holdem', $3, 'hd_chot_phien'),
                  ($1, now() - ($4 || ' minutes')::interval, 'holdem', $3, 'hd_tran_het_han')`,
          [A.userId, String(o.nuocCuoiPhutTruoc), id, String(o.ketPhutTruoc ?? 1)],
        );
      }
      return id;
    };

    // Hai trận chơi hết: 10 và 20 phút ⇒ trung vị 15.
    await tran({ st: 'xong', batDauPhutTruoc: 60, ketPhutTruoc: 50, vong: 8 });
    await tran({ st: 'xong', batDauPhutTruoc: 60, ketPhutTruoc: 40, vong: 8 });
    /*
     * Bỏ ở phút 3 (vòng 2) và phút 7 (vòng 4).
     * ⚠ `ended_at` để RẤT XA (5 phút trước = 295 phút sau khi bắt đầu) và mỗi
     * trận có thêm một `hd_tran_het_han` ở đúng mốc đó. Nếu truy vấn dùng nhầm
     * `ended_at` HOẶC quên loại event của bộ quét dọn, cả hai rơi vào rổ 30.
     */
    await tran({ st: 'bo_dở', batDauPhutTruoc: 300, nuocCuoiPhutTruoc: 297, ketPhutTruoc: 5, vong: 2 });
    await tran({ st: 'bo_dở', batDauPhutTruoc: 300, nuocCuoiPhutTruoc: 293, ketPhutTruoc: 5, vong: 4 });

    const b = await j(await goi('/api/v1/admin/tk/hanh-trinh'));
    expect(b.tran.phut_p50).toBe(15);
    expect(b.tran.so_xong).toBe(2);
    expect(b.tran.so_lan_bo_do).toBe(2);
    /*
     * ⚠ CHỐT CHẶN CHÍNH: nếu ai đó đổi truy vấn về dùng `ended_at` thì hai trận
     * bỏ dở sẽ rơi vào rổ phút 295 chứ không phải 3 và 7 — bài này đỏ ngay.
     */
    expect(b.tran.bo_do_theo_phut).toEqual([{ phut: 3, n: 1 }, { phut: 7, n: 1 }]);
    // Vòng nói về NỘI DUNG (chán ở đoạn nào), phút nói về KIÊN NHẪN.
    expect(b.tran.bo_do_theo_vong).toEqual([{ vong: 2, n: 1 }, { vong: 4, n: 1 }]);
  });

  it('trận bị treo rất lâu gộp vào rổ cuối, không kéo dài trục', async () => {
    const { rows } = await pool.query(
      `INSERT INTO holdem_matches
         (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json,
          engine_version, balance_version, season_id, started_at, so_o)
       VALUES ($1, 2, 'bo_dở', 3, '[]'::jsonb, '[]'::jsonb, 'e', 'b', '2026Q3',
               now() - interval '400 minutes', 8)
       RETURNING match_id::text AS id`,
      [A.userId],
    );
    await pool.query(
      `INSERT INTO events (user_id, ts, context_type, context_id, action_type)
       VALUES ($1, now() - interval '300 minutes', 'holdem', $2, 'hd_chot_phien')`,
      [A.userId, rows[0].id],
    );
    const b = await j(await goi('/api/v1/admin/tk/hanh-trinh'));
    expect(b.tran.bo_do_theo_phut.at(-1)).toEqual({ phut: 30, n: 1 });
  });

  /*
   * ⚠⚠ BÀI NÀY KHOÁ ĐÚNG THỨ ĐÃ HỎNG HAI LẦN TRONG MỘT NGÀY.
   *
   * Lần 1: phễu lọc `user_id IS NOT NULL` ⇒ đọc 0 vĩnh viễn (bước đăng ký xảy ra
   * TRƯỚC khi tài khoản tồn tại). Lần 2: vá bằng mã phiên, nhưng năm mốc nằm ở
   * năm lần NẠP TRANG khác nhau — `xac-minh-email` mở từ link trong email nên
   * không đời nào cùng phiên — và bậc cuối bắn ở MỌI lần tạo trận, nên đo ra
   * "% còn lại" 400%.
   *
   * Tính chất ĐỊNH NGHĨA một cái phễu là mỗi bậc phải là TẬP CON của bậc trên.
   * Bài này khoá đúng tính chất đó, chứ không khoá một con số cụ thể — con số
   * thì đổi theo fixture, còn tính chất thì không được phép đổi.
   */
  it('phễu người: đơn điệu giảm, KHÔNG bậc nào vượt 100% (đọc từ tài khoản thật)', async () => {
    await pool.query(
      `INSERT INTO auth_accounts (email, password_hash) VALUES ('chua_xac_minh@t.test', 'x')`);
    await pool.query(
      `INSERT INTO auth_accounts (email, password_hash, email_verified_at)
       VALUES ('xac_minh_chua_xong@t.test', 'x', now())`);

    const b = await j(await goi('/api/v1/admin/tk/hanh-trinh'));
    expect(b.phieu_dang_ky.map((x: any) => x.buoc))
      .toEqual(['tao-tai-khoan', 'xac-minh-email', 'xong-ho-so', 'tran-dau']);

    const n = b.phieu_dang_ky.map((x: any) => x.so_nguoi);
    for (let i = 1; i < n.length; i += 1) expect(n[i]).toBeLessThanOrEqual(n[i - 1]!);
    for (const x of b.phieu_dang_ky) expect(x.ty_le_con_lai).toBeLessThanOrEqual(1);

    // Hai tài khoản vừa chèn phải làm đúng hai bậc đầu tụt xuống.
    expect(n[0]! - n[1]!).toBeGreaterThanOrEqual(1);
    expect(n[1]! - n[2]!).toBeGreaterThanOrEqual(1);
    // Và bậc cuối đọc từ trận thật, nên nó phải thấy A (người vừa có trận ở trên).
    expect(n[3]).toBeGreaterThanOrEqual(1);
  });

  it('màn đăng ký: hai bước CÙNG một lần nạp trang, đếm theo phiên, đứng RIÊNG', async () => {
    const p1 = '11111111-1111-4111-a111-111111111111';
    const p2 = '22222222-2222-4222-a222-222222222222';
    // Phiên 1 mở màn HAI lần (bấm qua lại trong app) rồi gửi. Phiên 2 mở rồi bỏ.
    await pool.query(
      `INSERT INTO telemetry (user_id, phien, loai, chi_tiet) VALUES
         (NULL,$1::uuid,'dang_ky_buoc','{"buoc":"mo-dang-ky"}'::jsonb),
         (NULL,$1::uuid,'dang_ky_buoc','{"buoc":"mo-dang-ky"}'::jsonb),
         (NULL,$1::uuid,'dang_ky_buoc','{"buoc":"gui-dang-ky"}'::jsonb),
         (NULL,$2::uuid,'dang_ky_buoc','{"buoc":"mo-dang-ky"}'::jsonb)`,
      [p1, p2],
    );
    const b = await j(await goi('/api/v1/admin/tk/hanh-trinh'));
    const m = new Map(b.man_dang_ky.map((x: any) => [x.buoc, x.so_nguoi]));
    // HAI lượt mở, không phải BA — hai lần mở trong cùng một phiên là một lượt.
    expect(m.get('mo-dang-ky')).toBe(2);
    expect(m.get('gui-dang-ky')).toBe(1);
    expect(b.man_dang_ky[1].ty_le_con_lai).toBeCloseTo(0.5);
    // ⚠ Và nó KHÔNG được lẫn vào phễu người — hai đơn vị đo khác nhau.
    expect(b.phieu_dang_ky.map((x: any) => x.buoc)).not.toContain('mo-dang-ky');
  });

  it('khoảng dài hơn phần telemetry thô còn giữ ⇒ đo được, và NÓI RA phần đầu bị cắt (D341 thay cửa sổ kẹp 90)', async () => {
    // Kho của bài này mới có telemetry từ hôm nay ⇒ tho_tu = hôm nay; khoảng 366 ngày vẫn đo, cờ cat_tho bật.
    const tu = new Date(Date.now() + 7 * 3600_000 - 365 * 86_400_000).toISOString().slice(0, 10);
    const b = await j(await goi(`/api/v1/admin/tk/hanh-trinh?tu=${tu}`));
    expect(b.khoang.so_ngay).toBe(366);
    expect([b.do_duoc, b.cat_tho]).toEqual([true, true]);
    expect(b.khoang.tho_tu > b.khoang.tu).toBe(true);
  });
});
