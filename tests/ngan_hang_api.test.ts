/**
 * NGÂN HÀNG — TẦNG API, qua HTTP, DB thật, đúng đường code production (D317).
 *
 * ⚠⚠ VÌ SAO FILE NÀY PHẢI TỒN TẠI dù `ngan_hang_v43.test.ts` đã khoá cả lõi:
 * cơ chế ngay trước nó — CAM KẾT GIỮ — có engine đủ, config đủ, DTO đủ, đường
 * nộp đủ, test lõi XANH... và **0/167 trận prod** từng dùng được, vì đường bấm
 * không tồn tại. Lớp hỏng ấy KHÔNG làm đỏ một bài đơn vị nào. Nó chỉ lộ ra khi
 * có ai đó đi hết đường chính: tạo trận → nộp vòng qua endpoint → đọc lại trạng
 * thái từ `action_log` dựng lại.
 *
 * Bốn câu file này hỏi, và cả bốn đều là chỗ "chết trong im lặng":
 *   1. Lệnh gửi đi qua HTTP có tạo ra hợp đồng THẬT không (không hỏi hàm, hỏi
 *      trạng thái sau khi replay dựng lại).
 *   2. Sổ có RA ĐƯỢC DTO cho client vẽ không — và có kèm `con_vong` server tính.
 *   3. Lệnh bị từ chối có NÓI RA LÝ DO không (bỏ qua im lặng = người chơi tưởng
 *      mình vừa gửi tiền mà không hề).
 *   4. `events` có ghi không (A7/D25-R1) — append-only, thiếu là thiếu vĩnh viễn.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { TIET_KIEM } from '../config/holdem.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-secret-nh', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function json(path: string, init: RequestInit = {}): Promise<any> {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
  return r.json();
}

/*
 * ⚠ GHIM `balance-v43-nganhang` ĐÍCH DANH, không dùng mặc định.
 * Mặc định đổi mỗi lần lật cổng; một file test về ngân hàng mà chạy theo mặc
 * định sẽ âm thầm đo một bộ luật khác vào ngày nào đó — và đó chính là lớp lỗi
 * "gate xanh mà đo sai" đã mắc ở D313.
 */
const taoTran = () => json('/api/v1/holdem/matches', {
  method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v43-nganhang' }),
});
const xemTran = (id: string) => json(`/api/v1/holdem/matches/${id}`);

const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}) =>
  json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, ...them,
    }),
  });

// ═══════════════════════════════════════════════════════════════════════════
describe('1. 🔴 CƠ CHẾ CÓ ĐƯỜNG CHẠY THẬT KHÔNG (đo qua endpoint)', () => {
  it('⭐ gửi `tiet_kiem.mo` qua HTTP ⇒ hợp đồng CÓ THẬT sau khi replay dựng lại', async () => {
    const tao = await taoTran();
    const truoc = await xemTran(tao.match_id);
    expect(truoc.ban.tiet_kiem_duoc, 'vòng 1 phải gửi được').toBe(true);
    const tienTruoc = truoc.ban.tien_mat as number;

    const moc = truoc.ban.tiet_kiem_bao_gia[0]!;
    const sau = await nopVong(tao.match_id, 1, {
      tiet_kiem: { mo: [{ moc_bp: 5000, so_vong: moc.so_vong }] },
    });
    expect(sau.loi_von?.tiet_kiem ?? null, 'lệnh hợp lệ mà bị từ chối').toBeNull();

    /*
     * ⚠ ĐỌC LẠI QUA `xemTran`, không đọc phản hồi của cú nộp: trạng thái trận
     * được DỰNG LẠI từ `action_log` mỗi request. Nếu `replay()` không chạy nhánh
     * tiết kiệm thì hợp đồng biến mất ở đúng đây, và chỉ ở đúng đây.
     */
    const st = await xemTran(tao.match_id);
    const so = st.ban.tiet_kiem as { goc: number; so_vong: number; con_vong: number }[];
    expect(so, 'sổ không ra được DTO ⇒ client không có gì để vẽ').toHaveLength(1);
    expect(so[0]!.so_vong).toBe(moc.so_vong);
    expect(so[0]!.goc).toBeGreaterThanOrEqual(TIET_KIEM.GOC_TOI_THIEU);
    // Tiền mặt PHẢI tụt đúng phần gốc — không thì tiền được nhân đôi ở đâu đó.
    expect(st.ban.tien_mat).toBeLessThan(tienTruoc);
  });

  it('⭐ `con_vong` do SERVER tính (C4) — client không suy từ `vong_mo`', async () => {
    const tao = await taoTran();
    const bg = (await xemTran(tao.match_id)).ban.tiet_kiem_bao_gia as { so_vong: number }[];
    const n = Math.max(...bg.map((b) => b.so_vong));
    await nopVong(tao.match_id, 1, { tiet_kiem: { mo: [{ moc_bp: 5000, so_vong: n }] } });

    const v1 = (await xemTran(tao.match_id)).ban.tiet_kiem[0]!;
    await nopVong(tao.match_id, 2);
    const v2 = (await xemTran(tao.match_id)).ban.tiet_kiem[0]!;
    expect(v2.con_vong, 'đếm ngược không chạy ⇒ màn hiện sai hạn').toBe(v1.con_vong - 1);
    // Lãi treo phải DỒN LÊN — nó là thứ người chơi mất khi huỷ.
    expect(v2.lai_don).toBeGreaterThan(v1.lai_don);
  });

  it('⭐ HUỶ qua HTTP: gốc về ví, lãi treo MẤT — cái giá là tiền, không phải chữ', async () => {
    const tao = await taoTran();
    const bg = (await xemTran(tao.match_id)).ban.tiet_kiem_bao_gia as { so_vong: number }[];
    const n = Math.max(...bg.map((b) => b.so_vong));
    await nopVong(tao.match_id, 1, { tiet_kiem: { mo: [{ moc_bp: 5000, so_vong: n }] } });
    await nopVong(tao.match_id, 2);

    const truoc = await xemTran(tao.match_id);
    const h = truoc.ban.tiet_kiem[0]!;
    expect(h.lai_don, 'chưa dồn lãi thì bài này không chứng minh được gì').toBeGreaterThan(0);
    const tienTruoc = truoc.ban.tien_mat as number;

    const r = await nopVong(tao.match_id, 3, { tiet_kiem: { huy: [h.id] } });
    const sau = await xemTran(tao.match_id);
    expect(sau.ban.tiet_kiem ?? []).toHaveLength(0);

    /*
     * ⚠ BẢN ĐẦU CỦA BÀI NÀY KHẲNG ĐỊNH `tien_mat === tienTruoc + goc` VÀ ĐỎ —
     * đúng, vì chính vòng huỷ cũng ăn lạm phát tiền mặt và có thể ăn sốc tiền mặt
     * theo ô. Muốn cộng cho khớp thì phải chép lại số học của `chotPhien` vào đây,
     * tức dựng bản thứ hai của công thức (D61) — và bản thứ hai sẽ trôi.
     * Số học chính xác đã có người canh: `ngan_hang_v43.test.ts` §III, vector chép
     * tay trên state thuần. Việc của bài API là ĐƯỜNG CHẠY và LỜI NÓI RA.
     */
    expect(sau.ban.tien_mat, 'gốc không về ví').toBeGreaterThan(tienTruoc);

    /*
     * ⭐ CÁI GIÁ PHẢI ĐƯỢC NÓI RA BẰNG CON SỐ (D67). Để NAV tự tụt là người chơi
     * thấy mình nghèo đi mà không biết chính cú bấm của mình vừa đốt bao nhiêu.
     */
    const sk = (r.ket_qua_vong?.tiet_kiem ?? []) as { loai: string; lai_mat?: number }[];
    const huy = sk.find((x) => x.loai === 'huy');
    expect(huy, 'vòng huỷ mà kết quả vòng không hề nhắc tới sổ').toBeTruthy();
    expect(huy!.lai_mat, 'không nói mất bao nhiêu lãi').toBe(h.lai_don);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('2. 🔴 LỆNH BỊ TỪ CHỐI PHẢI NÓI RA (bỏ qua im lặng là tệ nhất)', () => {
  it('kỳ hạn LẠ ⇒ `loi_von.tiet_kiem` có mã lỗi, và KHÔNG hợp đồng nào mở', async () => {
    const tao = await taoTran();
    const r = await nopVong(tao.match_id, 1, {
      tiet_kiem: { mo: [{ moc_bp: 5000, so_vong: 7 }] },
    });
    /*
     * ⚠ `chuanHoaTietKiem` lọc kỳ hạn ngoài whitelist ngay ở cổng vào, nên lệnh
     * có thể bị VỨT trước khi tới engine. Cả hai đường đều chấp nhận được — điều
     * KHÔNG chấp nhận được là hợp đồng vẫn mở. Bài khẳng định hệ quả, không
     * khẳng định đường đi.
     */
    expect(r.ban.tiet_kiem ?? [], 'kỳ hạn lạ mà vẫn mở được hợp đồng').toHaveLength(0);
  });

  it('⭐ gốc dưới tối thiểu ⇒ TỪ CHỐI CÓ LÝ DO — và CẢ CHUỖI bị bỏ', async () => {
    /*
     * ⚠ BẢN ĐẦU CỦA BÀI NÀY LÀ MỘT BÀI RỖNG, do chính tôi viết trong phiên này:
     * nó gửi mốc 5% và `return` sớm nếu gốc vẫn ≥ tối thiểu — mà với vốn khởi
     * điểm 10.000 thì 5% = 500, LUÔN ≥ 100, nên nó luôn thoát ra và không đo gì.
     * Xanh, vô dụng, đúng lớp D262/D269/D272. Nói ra ở đây thay vì lặng lẽ sửa.
     *
     * Cách dựng điều kiện THẬT: mốc áp TUẦN TỰ trên tiền mặt CÒN LẠI, nên hợp
     * đồng đầu lấy 100% rồi hợp đồng sau chỉ còn 0 chip. Một mũi tên trúng hai
     * đích — vừa chạm `goc_qua_nho`, vừa chứng minh luật tuần tự chạy qua HTTP.
     */
    const tao = await taoTran();
    const bg = (await xemTran(tao.match_id)).ban.tiet_kiem_bao_gia as { so_vong: number }[];
    const k = bg[0]!.so_vong;
    const r = await nopVong(tao.match_id, 1, {
      tiet_kiem: { mo: [{ moc_bp: 10_000, so_vong: k }, { moc_bp: 10_000, so_vong: k }] },
    });
    expect(r.loi_von?.tiet_kiem, 'từ chối mà không nói lý do').toBe('goc_qua_nho');
    // ALL-OR-NOTHING: hợp đồng ĐẦU cũng không được mở. Mở một nửa chuỗi là trạng
    // thái người chơi không hề chọn — họ định gửi hai, không định gửi một.
    expect(r.ban.tiet_kiem ?? [], 'chuỗi hỏng mà vẫn mở được một phần').toHaveLength(0);
    expect(TIET_KIEM.GOC_TOI_THIEU).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('3. 🔴 EVENTS — append-only, thiếu ở đây là thiếu VĨNH VIỄN (A7)', () => {
  it('⭐ mỗi vòng có `tiet_kiem` sinh đúng một `hd_tiet_kiem`, kể cả khi BỊ TỪ CHỐI', async () => {
    const tao = await taoTran();
    const bg = (await xemTran(tao.match_id)).ban.tiet_kiem_bao_gia as { so_vong: number }[];
    await nopVong(tao.match_id, 1, {
      tiet_kiem: { mo: [{ moc_bp: 5000, so_vong: bg[0]!.so_vong }] },
    });
    await nopVong(tao.match_id, 2, { tiet_kiem: { huy: ['tk9_9'] } });   // id không có

    const r = await pool.query(
      `SELECT value_json FROM events
        WHERE context_id = $1 AND action_type = 'hd_tiet_kiem' ORDER BY event_id`,
      [tao.match_id]);
    /*
     * HAI dòng: Ý ĐỊNH cũng là dữ liệu (cùng nếp `hd_khoa_tai_san`). Một lệnh bị
     * bác vẫn nói lên điều gì đó về người chơi — họ ĐÃ MUỐN rút tiền ra ở vòng
     * đó. Chỉ ghi lệnh thành công là mất hẳn nửa câu chuyện.
     */
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]!.value_json.ok).toBe(true);
    expect(r.rows[1]!.value_json.ok).toBe(false);
    expect(r.rows[1]!.value_json.loi).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('4. 🔴 CỔNG — trận luật CŨ không được mọc ra ngân hàng', () => {
  it('trận `balance-v42-taisan` ⇒ không `tiet_kiem_duoc`, và lệnh gửi bị bác', async () => {
    const tao = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v42-taisan' }),
    });
    const st = await xemTran(tao.match_id);
    /*
     * ⭐ VẮNG MẶT, không phải `false` + `[]`. Client quyết có vẽ ô NGÂN HÀNG hay
     * không bằng chính sự vắng mặt ấy; trả `[]` thì trận v42 vẫn hiện ô đó kèm
     * câu "không kỳ hạn nào kịp đáo hạn" — in tên một cơ chế không tồn tại rồi
     * bịa cho nó một lý do. Đã mắc và đã sửa trong D317.
     */
    expect(st.ban.tiet_kiem_duoc).toBeUndefined();
    expect(st.ban.tiet_kiem_bao_gia).toBeUndefined();

    const r = await nopVong(tao.match_id, 1, {
      tiet_kiem: { mo: [{ moc_bp: 5000, so_vong: 2 }] },
    });
    expect(r.loi_von?.tiet_kiem).toBe('luat_tat');
    expect(r.ban.tiet_kiem ?? []).toHaveLength(0);
  });
});
