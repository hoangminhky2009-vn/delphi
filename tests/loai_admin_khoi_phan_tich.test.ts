/**
 * DASHBOARD KHÔNG ĐẾM HÀNH VI CỦA ADMIN (D212).
 *
 * Founder 01/09: *"thiết kế luôn là phần dashboard không hiện dữ liệu hành vi
 * của admin nhé để tránh rối/loãng với user."*
 *
 * ⚠ ĐO TRÊN PROD TRƯỚC KHI THIẾT KẾ, và con số quyết định luôn hình dạng lời
 * giải: **2/26 tài khoản là admin (8%), nhưng họ sở hữu 84% số trận, 83% event,
 * 84% `hanh_vi_tran` và 100% hồ sơ tính cách.** Tức mặt phân tích đang là tấm
 * gương soi chính người đi test, không phải chân dung người chơi. Mỗi tỷ lệ
 * "người ta hay làm X" đọc được ở đó thực ra là "founder hay làm X".
 *
 * ─── BA RANH GIỚI, VÀ CẢ BA ĐỀU CÓ LÝ DO ────────────────────────────────────
 *
 *  1. **Lọc ở SERVER, không ở giao diện.** Lọc ở client thì dữ liệu vẫn rời máy
 *     chủ, và lớp lọc đó sẽ trôi khỏi truy vấn (D61). Ở đây nó phải nằm trong
 *     chính câu SQL.
 *  2. **Có công tắc `?gom_admin=1`.** Không phải để chiều: admin cần xem chính
 *     hành động mình vừa làm có sinh ra event không — bỏ hẳn đường đó là đẩy
 *     người ta xuống tra tay bằng SQL, và lúc đó không ai lọc gì nữa.
 *  3. **Thẻ KHO và tra-một-người-theo-id KHÔNG lọc.** Kho là bản thô, vai của
 *     nó là bày đủ; tra theo id là khi anh đã hỏi đích danh người đó.
 *
 * ⚠⚠ VÀ PHẢI LUÔN NÓI RA ĐÃ LOẠI BAO NHIÊU. Một mặt tự lọc trong im lặng thì
 * lần đầu ai đó phát hiện là lần cuối họ tin nó — cùng nguyên tắc với bản kê
 * cột bị khoá ở thẻ KHO (D209) và với "nói ra phần bị cắt" của D192. Sau khi
 * loại admin, prod chỉ còn 14 trận và **0 hồ sơ tính cách**; một mặt trống trơn
 * mà không kèm lời giải thích thì bị đọc thành "dashboard hỏng".
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import {
  createTestUser, ensureGenesis, moCuaAdmin, type TestUser,
} from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let quan: TestUser;      // admin — dữ liệu của người này phải BIẾN MẤT khỏi mặt
let nguoi: TestUser;     // người chơi thật — phải CÒN

const goi = (u: TestUser, url: string) =>
  app.request(url, { headers: { cookie: u.cookie } });

/** Cắm một ít hành vi cho một user: trận + event + telemetry. */
async function camHanhVi(u: TestUser, ver: string): Promise<void> {
  const { rows } = await pool.query(
    `INSERT INTO holdem_matches
       (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json,
        engine_version, balance_version, season_id, started_at, ended_at, so_o)
     VALUES ($1, 1234, 'xong', 8, '[]'::jsonb, '[]'::jsonb, 'e', $2, '2026Q3',
             now() - interval '20 minutes', now() - interval '2 minutes', 8)
     RETURNING match_id`, [u.userId, ver]);
  const mid = rows[0].match_id;
  await pool.query(
    `INSERT INTO events (user_id, context_type, context_id, action_type, value_num)
     VALUES ($1, 'holdem_match', $2, 'hd_chot_phien', 7)`, [u.userId, mid]);
  await pool.query(
    `INSERT INTO telemetry (user_id, loai, man, ms) VALUES ($1, 'man_ra', '/arena', 900)`,
    [u.userId]);
}

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);

  quan = await createTestUser(pool, { role: 'admin', bankroll: 0 });
  await moCuaAdmin(pool, quan);
  nguoi = await createTestUser(pool);

  const { rows } = await pool.query(
    `SELECT balance_version FROM holdem_matches LIMIT 1`).catch(() => ({ rows: [] as any[] }));
  const ver = rows[0]?.balance_version
    ?? (await import('../config/holdem.js')).HOLDEM_BALANCE_VERSION;

  // ⚠ Cắm hành vi cho CẢ HAI. Chỉ cắm cho admin thì "0 kết quả" là xanh giả:
  // không phân biệt được "đã lọc đúng" với "truy vấn hỏng, chẳng trả gì".
  await camHanhVi(quan, ver);
  await camHanhVi(nguoi, ver);
}, 120_000);
afterAll(async () => { await db?.stop(); });

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Mặc định: hành vi admin KHÔNG được tính', () => {
  it('tổng quan — đếm người và trận đều bỏ admin', async () => {
    const d = await (await goi(quan, '/api/v1/admin/tk/tong-quan')).json() as any;
    expect(d.nguoi.tong, 'còn đếm cả admin').toBe(1);
    expect(d.tran.tong, 'còn đếm trận của admin').toBe(1);
  });

  it('⭐ tổng quan NÓI RA đã loại bao nhiêu — lọc im lặng là mất niềm tin', async () => {
    /*
     * Sau khi loại admin, prod chỉ còn 14 trận và 0 hồ sơ tính cách. Một mặt
     * trống mà không nói vì sao thì bị đọc thành "dashboard hỏng", rồi người ta
     * đi tìm một lỗi không có (bẫy D86).
     */
    const d = await (await goi(quan, '/api/v1/admin/tk/tong-quan')).json() as any;
    expect(d.da_loai, 'thiếu khối da_loai').toBeTruthy();
    expect(d.da_loai.tai_khoan).toBe(1);
    expect(d.da_loai.tran).toBeGreaterThan(0);
    expect(d.da_loai.events).toBeGreaterThan(0);
  });

  it('danh sách người (khu NGƯỜI DÙNG) — admin không có trong bảng', async () => {
    // D341: `/tk/nguoi` + `/tk/nhom` đã gỡ (D335 thay bằng `/pt/nguoi` + PHÂN KHÚC) — bài canh đi theo route mới.
    const d = await (await goi(quan, '/api/v1/admin/pt/nguoi')).json() as any;
    const ten = d.nguoi.map((x: any) => x.handle);
    expect(ten, 'admin lọt vào danh sách phân tích').not.toContain(quan.handle);
    expect(ten, 'người thật bị lọc oan').toContain(nguoi.handle);
  });

  it('mặt TRẬN — trận của admin không vào bảng', async () => {
    const d = await (await goi(quan, '/api/v1/admin/tk/tran')).json() as any;
    expect(JSON.stringify(d), 'còn dấu vết trận admin').not.toContain(quan.userId);
    // Cỡ mẫu của mặt này nằm ở khối `mau` (D123: mẫu số phải đi cùng tử số).
    expect(d.mau.tran, 'cỡ mẫu còn cộng trận admin').toBe(1);
    expect(d.mau.nguoi, 'còn đếm admin là một người chơi').toBe(1);
  });

  it('mặt PHIÊN BẢN — cột trận/event không cộng admin', async () => {
    const d = await (await goi(quan, '/api/v1/admin/tk/phien-ban')).json() as any;
    expect(d.tong.tran, 'phiên bản còn cộng trận admin').toBe(1);
  });

  it('mặt HÀNH TRÌNH — phễu không đếm admin', async () => {
    /*
     * ⚠ BẢN ĐẦU CỦA BÀI NÀY RỖNG: nó hỏi `JSON.stringify(d)` có chứa handle của
     * admin không — mà phễu KHÔNG BAO GIỜ trả handle, nó chỉ trả số đếm. Bài
     * xanh từ trước khi có một dòng lọc nào. Đây là ca thứ tư trong hai ngày của
     * cùng một lớp: phép so đúng cú pháp, canh một tính chất mà bug không vi
     * phạm. Chỉ lộ ra khi hỏi "bài này từng ĐỎ bao giờ chưa?".
     *
     * Phép đúng: đo chính con số phễu. Bậc đầu đếm `auth_accounts`, và fixture
     * dựng đúng hai tài khoản — một admin, một người thật.
     */
    const d = await (await goi(quan, '/api/v1/admin/tk/hanh-trinh')).json() as any;
    expect(d.gom_admin).toBe(false);
    expect(d.phieu_dang_ky[0].so_nguoi ?? d.phieu_dang_ky[0].n,
      'phễu đăng ký còn đếm admin').toBe(1);
    expect(d.tran.so_lan_vao, 'phễu trận còn đếm trận admin').toBe(1);

    const g = await (await goi(quan, '/api/v1/admin/tk/hanh-trinh?gom_admin=1')).json() as any;
    expect(g.phieu_dang_ky[0].so_nguoi ?? g.phieu_dang_ky[0].n).toBe(2);
    expect(g.tran.so_lan_vao).toBe(2);
  });

  it('mặt TÍNH CÁCH — admin không vào cỡ mẫu', async () => {
    /*
     * ⚠ BẢN ĐẦU dùng `toBeLessThanOrEqual(1)` — lỏng tới mức 0 cũng qua, nên nó
     * không phân biệt được "lọc đúng" với "cổng đồng ý loại sạch". Nay so hai
     * chế độ với nhau: chênh lệch đúng bằng một người, và người đó là admin.
     *
     * ⚠ Lọc nằm trong `cuaGopHoSo` (server/rieng_tu.ts) chứ không ở route —
     * đó là chỗ DUY NHẤT quyết ai vào cỡ mẫu, nên mặt nào dùng lại hàm ấy cũng
     * được lọc sẵn thay vì phải nhớ tự lọc.
     */
    const tat = await (await goi(quan, '/api/v1/admin/tk/tinh-cach')).json() as any;
    const bat = await (await goi(quan, '/api/v1/admin/tk/tinh-cach?gom_admin=1')).json() as any;
    expect(tat.gom_admin).toBe(false);
    expect(bat.gom_admin).toBe(true);

    /*
     * ⚠ ĐO THẲNG VÀO CỔNG, KHÔNG QUA `n_nguoi`. Một hồ sơ tính cách chỉ thành
     * hình khi có ≥10 trận liên tiếp, mà fixture cho mỗi người 1 trận ⇒ `n_nguoi`
     * bằng 0 ở CẢ HAI chế độ. So hai số 0 với nhau là một phép đo không thể đỏ —
     * đúng cái bẫy vừa gỡ ở bài phễu ngay trên.
     * `cuaGopHoSo` là chỗ duy nhất quyết ai vào cỡ mẫu, nên đo nó là đo đúng thứ
     * cần đo, và không phải bịa thêm một trường API chỉ để test nhìn thấy.
     */
    const { cuaGopHoSo } = await import('../server/rieng_tu.js');
    const loc = await cuaGopHoSo(pool);
    const het = await cuaGopHoSo(pool, { gomAdmin: true });
    expect(het.user_ids.length - loc.user_ids.length,
      'cổng cỡ mẫu chưa loại admin').toBe(1);
    expect(loc.user_ids, 'admin vẫn lọt vào cỡ mẫu tính cách')
      .not.toContain(quan.userId);
    expect(het.user_ids, 'bật cờ mà admin vẫn bị loại').toContain(quan.userId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. Công tắc ?gom_admin=1 — mở lại khi cần soi chính mình', () => {
  it('bật cờ ⇒ admin xuất hiện trở lại ở tổng quan và danh sách', async () => {
    const tq = await (await goi(quan, '/api/v1/admin/tk/tong-quan?gom_admin=1')).json() as any;
    expect(tq.nguoi.tong).toBe(2);
    expect(tq.tran.tong).toBe(2);
    expect(tq.da_loai.tai_khoan, 'bật cờ thì không loại ai').toBe(0);

    const ds = await (await goi(quan, '/api/v1/admin/pt/nguoi?gom=1')).json() as any;
    expect(ds.nguoi.map((x: any) => x.handle)).toContain(quan.handle);
  });

  it('⚠ cờ phải ĐI VÀO CÂU TRẢ LỜI — người đọc phải biết mình đang xem chế độ nào', async () => {
    // Hai con số khác nhau cho cùng một câu hỏi, mà không nhìn ra đang ở chế độ
    // nào, là cách chắc chắn nhất để trích dẫn nhầm một tỷ lệ ra ngoài.
    const tat = await (await goi(quan, '/api/v1/admin/tk/tong-quan')).json() as any;
    const bat = await (await goi(quan, '/api/v1/admin/tk/tong-quan?gom_admin=1')).json() as any;
    expect(tat.gom_admin).toBe(false);
    expect(bat.gom_admin).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Hai cửa CỐ Ý không lọc', () => {
  it('⭐ thẻ KHO vẫn bày đủ — nó là bản THÔ, lọc là phá hợp đồng của nó', async () => {
    /*
     * Thẻ KHO (D209) tồn tại để trả lời câu chưa ai nghĩ ra. Một bản thô đã bị
     * lọc sẵn thì không còn là bản thô, và người đọc sẽ không biết mình đang
     * thiếu gì — đúng thứ mặt đó sinh ra để chống.
     */
    const d = await (await goi(quan, '/api/v1/admin/kho/bang/users?moi=200')).json() as any;
    const co = JSON.stringify(d.dong);
    expect(co, 'thẻ KHO đang giấu admin — sai vai').toContain(quan.userId);
  });

  it('tra MỘT người theo id vẫn xem được admin — anh đã hỏi đích danh', async () => {
    const r = await goi(quan, `/api/v1/admin/pt/nguoi/${quan.handle}`);
    expect(r.status).toBe(200);
    expect((await r.json() as any).ho_so.handle).toBe(quan.handle);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. D335 — chỗ còn sót: hành trình (telemetry) · kèo · trận thoát', () => {
  /*
   * Trước D335 các đường này đọc telemetry/bets/events của MỌI người: tổng quan và phễu đã loại admin, nhưng
   * "đăng nhập mất bao lâu", "rơi ở bước hướng dẫn nào", "khẩu vị rủi ro", "thoát ở vòng nào" vẫn cộng founder
   * đi thử. Cắm cho CẢ HAI người mỗi thứ một dòng: mặc định đếm 1, bật công tắc đếm 2 — không bài nào xanh vì 0.
   */
  beforeAll(async () => {
    const { rows: m } = await pool.query(
      `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url, open_ts, lock_ts,
                            resolve_deadline_ts, status, seed_per_option, season_id, created_by)
       VALUES ('life','x','n','https://x', now() - interval '2 days', now() + interval '2 days',
               now() + interval '3 days', 'open', 0, '2026Q3', $1) RETURNING market_id`, [quan.userId]);
    const { rows: o } = await pool.query(
      `INSERT INTO market_options (market_id, label, sort_order) VALUES ($1,'A',0),($1,'B',1) RETURNING option_id`,
      [m[0].market_id]);
    for (const u of [quan, nguoi]) {
      await pool.query(
        `INSERT INTO telemetry (user_id, loai, man, ms, chi_tiet) VALUES
           ($1, 'dang_nhap', NULL, NULL, NULL),
           ($1, 'huong_dan_buoc', NULL, NULL, '{"buoc":"het"}'::jsonb),
           ($1, 'man_vao', '/arena', NULL, NULL),
           ($1, 'tran_thoat', NULL, NULL, '{"vong":3,"giay":90}'::jsonb),
           ($1, 'loi_client', NULL, NULL, '{"ma":"vo_man"}'::jsonb)`, [u.userId]);
      await pool.query(
        `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed) VALUES ($1, $2, $3, 100, false)`,
        [m[0].market_id, o[0].option_id, u.userId]);
      await pool.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type) VALUES ($1, 'market', $2, 'pool_reveal')`,
        [u.userId, m[0].market_id]);
      const { rows: t } = await pool.query(
        `INSERT INTO holdem_matches (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json, engine_version,
                                     balance_version, season_id, started_at, so_o)
         VALUES ($1, 9, 'bo_dở', 4, '[]'::jsonb, '[]'::jsonb, 'e', 'b', '2026Q3', now() - interval '30 minutes', 8)
         RETURNING match_id::text AS id`, [u.userId]);
      await pool.query(
        `INSERT INTO events (user_id, ts, context_type, context_id, action_type)
         VALUES ($1, now() - interval '25 minutes', 'holdem', $2, 'hd_chot_phien')`, [u.userId, t[0].id]);
    }
  });

  const hai = async (duong: string) => {
    const noi = duong.includes('?') ? '&' : '?';
    const tat = await (await goi(quan, duong)).json() as any;
    const bat = await (await goi(quan, `${duong}${noi}gom_admin=1&gom_tester=1`)).json() as any;
    return { tat, bat };
  };

  it('hành trình: đăng nhập · hướng dẫn · client kịp báo thoát · lỗi giao diện · bỏ dở theo phút/vòng', async () => {
    const { tat, bat } = await hai('/api/v1/admin/tk/hanh-trinh');
    expect([tat.huong_dan.bat_dau, bat.huong_dan.bat_dau]).toEqual([1, 2]);
    expect([tat.huong_dan.di_het, bat.huong_dan.di_het]).toEqual([1, 2]);
    expect([tat.tran.client_kip_bao, bat.tran.client_kip_bao]).toEqual([1, 2]);
    const loi = (d: any) => d.loi_client.find((x: any) => x.ma === 'vo_man')?.n ?? 0;
    expect([loi(tat), loi(bat)]).toEqual([1, 2]);
    const vong4 = (d: any) => d.tran.bo_do_theo_vong.find((x: any) => x.vong === 4)?.n ?? 0;
    expect([vong4(tat), vong4(bat)]).toEqual([1, 2]);
    const tong = (d: any) => d.tran.bo_do_theo_phut.reduce((a: number, x: any) => a + x.n, 0);
    expect([tong(tat), tong(bat)]).toEqual([1, 2]);
    // "Đăng nhập mất bao lâu" ghép `dang_nhap` với `man_ra` /onboard — fixture không có màn ấy nên đo SỐ LƯỢT vào
    // mẫu qua "đăng nhập xong đi đâu": mỗi người đi thẳng /arena.
    const arena = (d: any) => d.sau_dang_nhap.find((x: any) => x.man === '/arena')?.n ?? 0;
    expect([arena(tat), arena(bat)]).toEqual([1, 2]);
  });

  it('kèo: khẩu vị rủi ro · bầy đàn · số người ở kèo trong khoảng', async () => {
    const { tat, bat } = await hai('/api/v1/admin/tk/keo');
    expect([tat.khau_vi_rui_ro.n, bat.khau_vi_rui_ro.n]).toEqual([1, 2]);
    expect([tat.bay_dan.da_thay, bat.bay_dan.da_thay]).toEqual([1, 2]);
    expect([tat.keo_trong_khoang[0].nguoi, bat.keo_trong_khoang[0].nguoi]).toEqual([1, 2]);
    expect([tat.gom_admin, bat.gom_admin]).toEqual([false, true]);
  });

  it('trận: thoát theo vòng', async () => {
    const { tat, bat } = await hai('/api/v1/admin/tk/tran');
    const n = (d: any) => d.thoat_theo_vong.reduce((a: number, x: any) => a + x.n, 0);
    expect([n(tat), n(bat)]).toEqual([1, 2]);
  });
});
