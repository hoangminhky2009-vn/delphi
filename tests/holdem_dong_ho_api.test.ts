/**
 * ĐỒNG HỒ TRẬN (D38) — TẦNG API, qua HTTP, DB thật, đúng đường code production.
 *
 * `holdem_dong_ho.test.ts` đã khoá phần LÕI (`soiDongHo`/`tranHetHan` — hàm thuần).
 * File này chỉ hỏi một câu mà lõi không trả lời được, và nó là câu duy nhất đáng
 * hỏi ở đây: **CÓ ĐƯỜNG CHẠY NÀO GỌI TỚI KHÔNG.**
 *
 * Vì sao câu đó đáng một file riêng: commit 5b9b839 nộp đủ config + hàm thuần +
 * migration + 15 test XANH mà KHÔNG một dòng nào đọc `vong_mo_luc`, và `'bo_dở'`
 * vẫn là một giá trị enum không ai ghi. "Có test" ≠ "có chạy" — bẫy số 1 của repo,
 * đã dính 9 lần. Nên mọi test dưới đây đo qua HTTP/DB THẬT, và mỗi test cưỡng chế
 * đều có cặp ĐỐI CHỨNG "không lùi mốc thì KHÔNG xảy ra": số giống hệt nhau ở hai
 * nhánh nghĩa là cơ chế không chạy, dù test có xanh.
 *
 * CÁCH GIẢ LẬP THỜI GIAN: LÙI `vong_mo_luc` xuống quá khứ bằng SQL, chứ không giả
 * lập đồng hồ hệ thống. Đó chính là hình dạng thật của sự việc — người chơi rời
 * máy thì mốc đứng yên còn `now()` tiến lên — và nó chạy qua đúng câu SQL, đúng
 * `tranHetHan`, đúng transaction mà prod chạy.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
/*
 * D525 — mặc định lật sang v58 (khung minigame: màn lõi sau cú nộp, bỏ cam kết/Bảng điện tử…). Bài này canh luật ALPHA DRAFT
 * CỔ ĐIỂN mà mọi trận prod tới 05/10 chạy (v56, ghim trong golden) ⇒ tạo trận bằng khoá v56 ĐÍCH DANH.
 */
const KHOA_CO_DIEN = JSON.stringify({ ep_balance: 'balance-v56-congdon' });
import { DONG_HO, giayChonBai, HOLDEM_DECISIONS } from '../config/holdem.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

const TICK_SECRET = 'tick-secret-dongho';

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: TICK_SECRET, secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function req(path: string, init: RequestInit = {}): Promise<Response> {
  return app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
}
const json = async (p: string, i: RequestInit = {}): Promise<any> => (await req(p, i)).json();

const taoTran = () => json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
const trangThai = (id: string) => json(`/api/v1/holdem/matches/${id}`);
const nopVong = (id: string, body: unknown) =>
  req(`/api/v1/holdem/matches/${id}/rounds`, { method: 'POST', body: JSON.stringify(body) });

/**
 * D442 — hạn VÒNG 1 theo đúng luật của trận: trận có chợ trait (v55 — vòng 1 là mốc chợ, payload mang `ban.cho_trait`)
 * được cộng `CHON_TRAIT_THEM_S`. Đọc cờ từ CHÍNH payload thay vì gõ tay "trận mặc định là v55" — lật mặc định lần sau
 * thì bài tự đúng theo luật mới.
 */
const hanVong1 = (t: any): number =>
  giayChonBai(1, t.tong_vong) + (t.ban?.cho_trait !== undefined ? DONG_HO.CHON_TRAIT_THEM_S : 0);

/** Lùi mốc mở vòng về quá khứ `giay` giây — đúng hình dạng "người chơi rời máy". */
async function luiMoc(matchId: string, giay: number) {
  await pool.query(
    `UPDATE holdem_matches SET vong_mo_luc = now() - make_interval(secs => $2)
      WHERE match_id = $1`, [matchId, giay]);
}

const docTran = async (matchId: string) => (await pool.query(
  `SELECT status, ly_do_dong, vong_mo_luc, action_log, ended_at
     FROM holdem_matches WHERE match_id = $1`, [matchId])).rows[0];

const tick = () => req('/api/v1/internal/tick',
  { method: 'POST', headers: { 'x-tick-secret': TICK_SECRET } });

// ───────────────────────────────────────────────────────────────────────────
describe('VIỆC 1 — mốc mở vòng được GHI THẬT', () => {
  it('tạo trận ⇒ có mốc trong DB, và payload mang đồng hồ đầy', async () => {
    const t = await taoTran();
    const row = await docTran(t.match_id);
    expect(row.vong_mo_luc, 'không có mốc thì trận vĩnh viễn không có hạn').not.toBeNull();

    expect(t.dong_ho, 'thiếu trường này là client không có gì để vẽ').toBeTruthy();
    expect(t.dong_ho.con_lai_s, 'trận vừa tạo phải còn nguyên thời lượng')
      .toBe(t.dong_ho.tong_s);
    expect(t.dong_ho.het_gio).toBe(false);
    // Thời lượng phải là của VÒNG 1 trên CỠ MAP THẬT — không phải cỡ mặc định.
    expect(t.dong_ho.tong_s).toBe(hanVong1(t));
  });

  it('nộp vòng ⇒ mốc TIẾN LÊN (vòng kế mở ra), không đứng yên', async () => {
    /*
     * Đây là phép SỬA-RỒI-ĐO của việc 1: nếu không dòng nào ghi lại mốc khi nộp
     * vòng thì mốc vẫn là mốc lúc tạo trận, và người đánh chậm mà đánh LIÊN TỤC
     * vẫn bị cắt giữa trận — phạt đúng người không đáng phạt.
     */
    const t = await taoTran();
    const truoc = (await docTran(t.match_id)).vong_mo_luc as Date;
    await luiMoc(t.match_id, 5); // để hai mốc không bằng nhau tới từng ms
    const r = await nopVong(t.match_id, { vong: 1, hanh_dong: 'giu_vi_the' });
    expect(r.status).toBe(200);

    const sau = (await docTran(t.match_id)).vong_mo_luc as Date;
    expect(sau, 'mốc phải là mốc của VÒNG MỚI, không phải mốc cũ')
      .not.toBeNull();
    expect(sau.getTime()).toBeGreaterThan(truoc.getTime() - 5000);
    // Và đồng hồ trong response đã chạy lại từ đầu cho vòng 2.
    const body = await r.json() as any;
    expect(body.dong_ho.con_lai_s).toBe(body.dong_ho.tong_s);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('VIỆC 2 — quá hạn VÒNG thì server chốt hộ, và ĐÁNH DẤU tự động', () => {
  /** Payload "hung hăng": nếu nó được áp thì Vốn và log sẽ khác hẳn. */
  const payloadHungHang = (vong: number) =>
    ({ vong, hanh_dong: 'tang_cam_ket', them: 300, khao_sat_lai: 1 });

  it('ĐỐI CHỨNG — đúng giờ thì payload được áp NGUYÊN VẸN, không cờ tự động', async () => {
    /*
     * Nửa này bắt buộc phải có: nếu thiếu, một lỗi khiến MỌI vòng bị coi là hết
     * giờ vẫn cho test dưới xanh, và cả tính năng đọc ra "luôn luôn tự động".
     */
    const t = await taoTran();
    const r = await nopVong(t.match_id, payloadHungHang(1));
    expect(r.status).toBe(200);
    const body = await r.json() as any;
    expect(body.tu_dong).toBe(false);

    const log = (await docTran(t.match_id)).action_log as any[];
    expect(log[0].hanh_dong).toBe('tang_cam_ket');
    expect(log[0].them).toBe(300);
    expect(log[0].tu_dong, 'vòng bấm đúng giờ KHÔNG được mang cờ tự động')
      .toBeUndefined();
  });

  it('quá hạn ⇒ áp NUOC_HET_GIO, bỏ nội dung client gửi', async () => {
    const t = await taoTran();
    // Quá hạn vòng 1 (đã trừ ân hạn) nhưng CHƯA quá hạn trận.
    await luiMoc(t.match_id, hanVong1(t) + DONG_HO.AN_HAN_S + 5);

    const r = await nopVong(t.match_id, payloadHungHang(1));
    expect(r.status, 'hết giờ KHÔNG phải lỗi — vòng vẫn chốt, chỉ là chốt hộ')
      .toBe(200);
    const body = await r.json() as any;
    expect(body.tu_dong, 'response phải NÓI RA rằng vòng này bị chốt hộ').toBe(true);

    const log = (await docTran(t.match_id)).action_log as any[];
    expect(log[0].hanh_dong, 'HET_GIO_LA_GIU_NGUYEN').toBe('giu_vi_the');
    expect(log[0].them, 'cam kết của một vòng đã đóng không được tính').toBe(0);
    expect(log[0].khao_sat_lai).toBe(0);
    expect(log[0].tu_dong,
      'thiếu cờ này là gộp "không kịp bấm" với "cố ý giữ vị thế" — pha loãng cột '
      + 'khẩu vị rủi ro, và events append-only nên không tách lại được (A1 + A3.3)')
      .toBe(true);
  });

  it('event `hd_cam_ket` ghi NƯỚC ĐÃ ÁP + cờ `tu_dong`, không ghi ý định', async () => {
    /*
     * `action_log` đúng mà event sai thì bộ dữ liệu — sản phẩm thật (A1) — tả một
     * ván không hề xảy ra. Hai chỗ phải khớp, nên phải đo cả hai.
     */
    const t = await taoTran();
    await luiMoc(t.match_id, hanVong1(t) + DONG_HO.AN_HAN_S + 5);
    await nopVong(t.match_id, payloadHungHang(1));

    const ev = (await pool.query(
      `SELECT value_json, value_num FROM events
        WHERE context_id = $1 AND action_type = 'hd_cam_ket'`, [t.match_id])).rows[0];
    expect(ev.value_json.tu_dong).toBe(true);
    expect(ev.value_json.hanh_dong).toBe('giu_vi_the');
    expect(ev.value_json.them).toBe(0);
    expect(Number(ev.value_num), 'value_num phải là cam kết THẬT, không phải số client xin')
      .toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("VIỆC 3 — tick dọn trận quá hạn, và 'bo_dở' CÓ NGƯỜI GHI", () => {
  it("trận đứng yên quá HAN_TRAN_PHUT ⇒ tick đóng thành 'bo_dở'/'het_han'", async () => {
    const t = await taoTran();
    // SỬA-RỒI-ĐO: đo trước khi lùi mốc để chắc chắn chính CÚ LÙI gây ra thay đổi.
    expect((await docTran(t.match_id)).status).toBe('dang_choi');

    await luiMoc(t.match_id, DONG_HO.HAN_TRAN_PHUT * 60 + 60);
    // Chưa chạy tick thì trận VẪN đang chơi — không có phép màu nào tự đóng nó.
    expect((await docTran(t.match_id)).status,
      'nếu chỗ này đã là bo_dở thì thứ đóng trận không phải tick').toBe('dang_choi');

    const r = await tick();
    expect(r.status).toBe(200);
    expect((await r.json() as any).holdem_het_han).toBeGreaterThanOrEqual(1);

    const row = await docTran(t.match_id);
    expect(row.status,
      "'bo_dở' hợp lệ trong CHECK của 0010 từ lâu mà không dòng nào ghi — bẫy số 1")
      .toBe('bo_dở');
    expect(row.ly_do_dong).toBe('het_han');
    expect(row.ended_at).not.toBeNull();
    expect(row.vong_mo_luc, 'trận đóng thì không còn vòng nào đang mở').toBeNull();
  });

  it('trận bị đóng ghi event, nhưng KHÔNG ghi kết quả và KHÔNG tính rank', async () => {
    const t = await taoTran();
    await luiMoc(t.match_id, DONG_HO.HAN_TRAN_PHUT * 60 + 60);
    await tick();

    const ev = await pool.query(
      `SELECT value_json FROM events
        WHERE context_id = $1 AND action_type = 'hd_tran_het_han'`, [t.match_id]);
    expect(ev.rowCount, 'tỷ lệ rời trận là dữ liệu founder cần để biết trận có dài quá không')
      .toBe(1);
    expect(ev.rows[0]!.value_json.ly_do).toBe('het_han');

    const kq = await pool.query(
      'SELECT 1 FROM holdem_results WHERE match_id = $1', [t.match_id]);
    expect(kq.rowCount,
      'chấm điểm một ván chưa đánh xong = bảng xếp hạng đầy trận bỏ dở, và điểm rank '
      + 'thì không rút lại được').toBe(0);
  });

  it('trận CHƯA quá hạn KHÔNG bị tick đụng tới', async () => {
    const t = await taoTran();
    await luiMoc(t.match_id, 5 * 60); // nghỉ 5 phút — một cuộc điện thoại
    await tick();
    expect((await docTran(t.match_id)).status,
      'cắt sớm là giết trận của người đang nghe điện thoại').toBe('dang_choi');
  });

  it('trận CŨ (mốc NULL, trước migration 0018) KHÔNG bị kết luận hết hạn', async () => {
    const t = await taoTran();
    await pool.query(
      'UPDATE holdem_matches SET vong_mo_luc = NULL WHERE match_id = $1', [t.match_id]);
    await tick();
    expect((await docTran(t.match_id)).status,
      'bịa hạn cho trận cũ là bịa ra chuyện nó đã quá hạn — events append-only, '
      + 'kết luận sai đó không xoá lại được (A3.3)').toBe('dang_choi');
  });

  it('trận đã hết hạn thì MỌI cửa nộp vòng đều đóng, và đóng luôn trận', async () => {
    const t = await taoTran();
    await luiMoc(t.match_id, DONG_HO.HAN_TRAN_PHUT * 60 + 60);

    // Người chơi quay lại TRƯỚC khi tick kịp chạy: `/rounds` phải tự đóng, không
    // được để họ bấm thêm vài vòng vào một trận sắp bị dọn.
    const r = await nopVong(t.match_id, { vong: 1, hanh_dong: 'giu_vi_the' });
    expect(r.status).toBe(409);
    expect((await r.json() as any).error).toBe('tran_het_han');
    expect((await docTran(t.match_id)).status).toBe('bo_dở');
  });

  it('mở Bảng điện tử trên trận hết hạn bị TỪ CHỐI — không thu tiền món dùng không được',
    async () => {
      const t = await taoTran();
      await luiMoc(t.match_id, DONG_HO.HAN_TRAN_PHUT * 60 + 60);
      const r = await req(`/api/v1/holdem/matches/${t.match_id}/bang-dien-tu`,
        { method: 'POST', body: JSON.stringify({ vong: 1 }) });
      expect(r.status).toBe(409);
      expect((await r.json() as any).error).toBe('tran_het_han');
    });

  it('mở Bảng điện tử khi VÒNG đã quá ân hạn cũng bị từ chối — cùng lý lẽ', async () => {
    /*
     * Rà đồng hồ 08/08: quá ân hạn vòng thì `/rounds` sắp vứt mọi quyết định
     * của vòng này (chốt hộ GIỮ NGUYÊN) — thu phí bán thông tin cho một quyết
     * định không còn quyền ra là bán hàng dùng không được. Cùng điều kiện với
     * cửa KHỚP LỆNH.
     */
    const t = await taoTran();
    // Quá hạn VÒNG (đã trừ ân hạn) nhưng CHƯA quá hạn TRẬN.
    await luiMoc(t.match_id, hanVong1(t) + DONG_HO.AN_HAN_S + 5);
    const r = await req(`/api/v1/holdem/matches/${t.match_id}/bang-dien-tu`,
      { method: 'POST', body: JSON.stringify({ vong: 1 }) });
    expect(r.status).toBe(409);
    expect((await r.json() as any).error).toBe('het_gio');
    // Và không một Vốn nào bị trừ: log không có đuôi mở bảng.
    expect(((await docTran(t.match_id)).action_log as any[]).length).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('MÀN TẬP MIỄN GIỜ — "TẠM DỪNG ∞" thì hạn trận cũng phải giữ lời', () => {
  // D527 — bàn tập mặc định nay v58 (5 vòng, miễn giờ cả bàn) ⇒ bài "qua vòng miễn giờ" ghim bàn tập v54 (11 vòng) đích danh.
  const taoTap = () => json('/api/v1/holdem/matches',
    { method: 'POST', body: JSON.stringify({ tap: true, ep_balance: 'balance-v54-ngare' }) });

  it('màn tập đứng yên 46 phút ở vòng MIỄN GIỜ ⇒ tick KHÔNG đóng', async () => {
    /*
     * Rà đồng hồ 08/08: màn đang vẽ "TẠM DỪNG ∞" (D53) mà tick đóng trận ở
     * phút 46 là màn hình nói dối — đúng lớp lỗi D53 sinh ra để tránh.
     */
    const t = await taoTap();
    await luiMoc(t.match_id, DONG_HO.HAN_TRAN_PHUT * 60 + 60);
    await tick();
    expect((await docTran(t.match_id)).status,
      'đang TẠM DỪNG ∞ mà bị đóng = lời hứa trên màn là giả').toBe('dang_choi');
  });

  it('nhưng quá hạn DÀI (HAN_TRAN_TAP_PHUT) thì VẪN dọn — bảng không phình vô hạn', async () => {
    const t = await taoTap();
    await luiMoc(t.match_id, DONG_HO.HAN_TRAN_TAP_PHUT * 60 + 60);
    await tick();
    expect((await docTran(t.match_id)).status,
      'trận tập bỏ dở ở vòng 1 (đa số tuyệt đối, D62) phải có ngày được dọn')
      .toBe('bo_dở');
  });

  it('màn tập đã QUA vòng miễn giờ ⇒ hạn trận thường áp lại như mọi trận', async () => {
    /*
     * ĐỐI CHỨNG bắt buộc: nếu thiếu, một lỗi miễn-giờ-cho-mọi-vòng-màn-tập vẫn
     * cho hai test trên xanh — trong khi nửa sau bàn tập được D53 chốt là
     * "chạy giờ thật".
     */
    const t = await taoTap();
    const MIEN = HOLDEM_DECISIONS.MAN_TAP_MIEN_GIO_DEN_VONG;
    for (let v = 1; v <= MIEN; v += 1) {
      const r = await nopVong(t.match_id, { vong: v, hanh_dong: 'giu_vi_the' });
      expect(r.status, `vòng tập ${v} phải nộp được`).toBe(200);
    }
    await luiMoc(t.match_id, DONG_HO.HAN_TRAN_PHUT * 60 + 60);
    await tick();
    expect((await docTran(t.match_id)).status,
      'vòng 5 trở đi chạy giờ thật (D53) — hạn trận phải áp lại').toBe('bo_dở');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('VIỆC 4 — payload đủ để client CHỈ VẼ (C4)', () => {
  it('trạng thái trận mang đồng hồ đã trừ thời gian đã trôi', async () => {
    const t = await taoTran();
    const tong = hanVong1(t);
    await luiMoc(t.match_id, 10);
    const st = await trangThai(t.match_id);
    expect(st.dong_ho.tong_s).toBe(tong);
    /*
     * DẢI ±1 GIÂY, KHÔNG PHẢI MỘT MỐC CHÍNH XÁC — và đó là phép so ĐÚNG, không phải
     * một cú nới lỏng.
     *
     * `luiMoc` đặt `vong_mo_luc = now() - 10s` bằng đồng hồ POSTGRES (giờ bắt đầu
     * transaction), còn `soiDongHo` đếm bằng đồng hồ NODE rồi `Math.floor` xuống giây.
     * Hai đồng hồ lệch nhau một phần nghìn giây là đủ để 9,998s thành 9 thay vì 10,
     * và `con_lai_s` ra 36 thay vì 35. Đòi đúng một mốc ở đây là đòi hai đồng hồ khớp
     * tới từng ms — một tính chất không ai hứa và sẽ đỏ ngẫu nhiên trên CI.
     *
     * Điều test này CẦN chứng minh là SERVER CÓ TRỪ thời gian đã trôi (C4 — client
     * không tự tính), và một dải hai giây quanh mốc chứng minh đúng điều đó: nếu server
     * không trừ thì `con_lai_s` sẽ bằng `tong` (45), lệch xa khỏi dải.
     */
    expect(st.dong_ho.con_lai_s, 'server trừ, client không tự tính (C4)')
      .toBeLessThanOrEqual(tong - 9);
    expect(st.dong_ho.con_lai_s, 'trừ quá tay ⇒ đang đếm nhầm đơn vị')
      .toBeGreaterThanOrEqual(tong - 11);
    expect(st.dong_ho.con_lai_s).toBeGreaterThan(0);
  });

  it('quá hạn ⇒ `het_gio` bật và `con_lai_s` không bao giờ âm', async () => {
    const t = await taoTran();
    await luiMoc(t.match_id, hanVong1(t) + DONG_HO.AN_HAN_S + 5);
    const st = await trangThai(t.match_id);
    expect(st.dong_ho.con_lai_s, 'số âm sẽ hiện ra màn hình dưới dạng "-12s"').toBe(0);
    expect(st.dong_ho.het_gio).toBe(true);
  });

  it('trận đã đóng KHÔNG kèm đồng hồ — không mời client vẽ đếm ngược vô nghĩa', async () => {
    const t = await taoTran();
    await luiMoc(t.match_id, DONG_HO.HAN_TRAN_PHUT * 60 + 60);
    await tick();
    const st = await trangThai(t.match_id);
    expect(st.status).toBe('bo_dở');
    expect(st.dong_ho).toBeUndefined();
  });
});
