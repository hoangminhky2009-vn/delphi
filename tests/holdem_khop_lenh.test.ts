/**
 * KHỚP LỆNH GIỮA VÒNG (founder 08/08: *"không có nút chốt mua/bán ngay trong
 * phiên mà phải đợi round sau lệnh mới được khớp dẫn đến nhiều lỗi ngớ ngẩn khi
 * chuyển đổi tài sản, phân bổ danh mục"*).
 *
 * Khuôn đuôi `cho_nop` của phí mở bảng: khớp ghi đuôi, nộp vòng gộp thành
 * `khop_truoc` trên dòng vòng. Ba bất biến file này khoá:
 *  1. khớp là THẬT — GET ngay sau đó thấy vị thế mới, tiền mới;
 *  2. nộp vòng KHÔNG áp lại lần hai (đuôi gộp rồi biến mất);
 *  3. đuôi khớp và đuôi phí bảng SỐNG CHUNG — endpoint nào ghi đè đuôi cũng
 *     phải giữ phần của endpoint kia.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function gui(path: string, init: RequestInit = {}): Promise<Response> {
  return app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
}
const json = async (path: string, init: RequestInit = {}): Promise<any> =>
  (await gui(path, init)).json();

// D406 — ghim v53 (bàn 8, KHÔNG vai): dưới v54 bàn nào cũng có vai, ghế người bốc TỔ CHỨC (trần 40%/mã) thì cú mua lớn
// bị từ chối ngẫu nhiên theo seed. Bài này đo cơ chế lệnh, không đo vai — luật vai v54 canh ở luoc_bo_v54_api.
const taoTran = () => json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v53-upo' }) });
const xemTran = (id: string) => json(`/api/v1/holdem/matches/${id}`);
const khop = (id: string, vong: number, lenh: unknown, khoa?: string) =>
  gui(`/api/v1/holdem/matches/${id}/khop-lenh`, {
    method: 'POST',
    body: JSON.stringify({ vong, lenh, ...(khoa ? { idempotency_key: khoa } : {}) }),
  });
const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}) =>
  json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0,
      cuoc: [], ...them,
    }),
  });

describe('0. ⚠⚠ KHOÁ CHỐNG ÁP HAI LẦN — lỗ MẤT TIỀN THẬT (rà mạng kém 11/08)', () => {
  /*
   * KỊCH BẢN THẬT, không phải phòng xa: server áp lệnh xong ở giây 3, response
   * rớt trên đường về, client hết hạn chờ 15s rồi TRẢ HÀNG LỆNH VỀ và mời bấm
   * lại. Endpoint này CỘNG lệnh vào đuôi (`khop: [...khopCho, lenhMoi]`) và hai
   * cửa chặn duy nhất của nó là SỐ VÒNG với HẠN GIỜ — cú gửi lại trong cùng
   * vòng lọt qua cả hai. Kết quả: bán hai lần, im lặng, tiền thật.
   *
   * `/rounds` không dính vì đã có compare-and-set trên `action_log`.
   */
  it('⭐ gửi LẠI cùng khoá ⇒ KHÔNG áp thêm lần nào, tiền và vị thế đứng yên', async () => {
    const tao = await taoTran();
    const KHOA = 'khoa-test-mot';
    const r1 = await khop(tao.match_id, 1, [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }], KHOA);
    expect(r1.status).toBe(200);
    const sau1 = await xemTran(tao.match_id);

    const r2 = await khop(tao.match_id, 1, [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }], KHOA);
    expect(r2.status, 'gửi lại phải THÀNH CÔNG — lệnh của họ đã khớp thật rồi')
      .toBe(200);
    expect((await r2.json() as any).da_ap_truoc_do,
      'server phải NÓI RA rằng đây là trạng thái đã áp, không phải cú áp mới')
      .toBe(true);

    const sau2 = await xemTran(tao.match_id);
    expect(sau2.ban.vi_the.btc, 'mua hai lần = vị thế gấp đôi = mất tiền')
      .toBe(sau1.ban.vi_the.btc);
    expect(sau2.ban.tien_mat, 'tiền mặt phải đứng yên').toBe(sau1.ban.tien_mat);
  });

  it('KHOÁ KHÁC ⇒ vẫn là cú bấm MỚI, phải áp thật (không chặn nhầm)', async () => {
    /*
     * Đối chứng bắt buộc: nếu thiếu, một lỗi chặn-tất-cả vẫn cho bài trên xanh
     * trong khi tính năng KHỚP NGAY chết hẳn ở cú bấm thứ hai.
     */
    const tao = await taoTran();
    await khop(tao.match_id, 1, [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }], 'k-1');
    const sau1 = await xemTran(tao.match_id);
    const r2 = await khop(tao.match_id, 1, [{ ma: 'vang', chieu: 'mua', moc_bp: 2500 }], 'k-2');
    expect(r2.status).toBe(200);
    const sau2 = await xemTran(tao.match_id);
    expect(sau2.ban.vi_the.vang, 'cú bấm mới phải khớp thật').toBeGreaterThan(0);
    expect(sau2.ban.tien_mat).toBeLessThan(sau1.ban.tien_mat);
  });

  it('gửi lại cùng khoá SAU KHI HẾT GIỜ vẫn trả 200 — không nói dối về việc đã áp',
    async () => {
      /*
       * Idempotent đúng nghĩa là "gọi mấy lần cũng ra một kết quả", KHÔNG phải
       * "lần hai thì báo lỗi". Cú gửi lại hoàn toàn có thể rơi vào lúc vòng đã
       * hết giờ; ném `het_gio` ở đó là nói với người chơi rằng lệnh của họ
       * không khớp, trong khi nó ĐÃ khớp và tiền ĐÃ trừ.
       */
      const tao = await taoTran();
      const KHOA = 'khoa-het-gio';
      expect((await khop(tao.match_id, 1,
        [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }], KHOA)).status).toBe(200);
      // Đẩy vòng quá hạn (đã trừ ân hạn) rồi gửi LẠI đúng khoá đó.
      await pool.query(
        `UPDATE holdem_matches SET vong_mo_luc = now() - make_interval(secs => $2)
          WHERE match_id = $1`,
        [tao.match_id, 45 + 15 + 8 + 30]);
      const r = await khop(tao.match_id, 1,
        [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }], KHOA);
      expect(r.status, 'hết giờ KHÔNG được che mất sự thật "lệnh đã khớp rồi"')
        .toBe(200);
      expect((await r.json() as any).da_ap_truoc_do).toBe(true);
    });

  it('KHÔNG gửi khoá ⇒ vẫn chạy (client cũ hơn API) — không chặn cứng', async () => {
    const tao = await taoTran();
    expect((await khop(tao.match_id, 1,
      [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }])).status).toBe(200);
  });
});

describe('I. ⭐ Khớp là THẬT — thấy ngay, không đợi round sau', () => {
  it('khớp MUA giữa vòng → GET thấy vị thế mới và tiền đã trừ', async () => {
    const tao = await taoTran();
    const truoc = await xemTran(tao.match_id);
    const r = await khop(tao.match_id, 1, [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]);
    expect(r.status).toBe(200);
    const b: any = await r.json();
    expect(b.ban.vi_the.btc).toBeGreaterThan(0);

    const sau = await xemTran(tao.match_id);
    expect(sau.ban.vi_the.btc, 'GET không thấy vị thế = khớp chỉ là lời hứa')
      .toBeGreaterThan(0);
    expect(sau.ban.tien_mat).toBeLessThan(truoc.ban.tien_mat);
  });

  it('⭐ BÁN rồi THẤY TIỀN VỀ rồi mới MUA — đúng cái nút founder cần', async () => {
    const tao = await taoTran();
    await khop(tao.match_id, 1, [{ ma: 'vang', chieu: 'mua', moc_bp: 5000 }]);
    const giua = await xemTran(tao.match_id);
    expect(giua.ban.vi_the.vang).toBeGreaterThan(0);

    // Cú hai: bán sạch vàng — tiền phải VỀ trước khi người chơi quyết mua gì.
    await khop(tao.match_id, 1, [{ ma: 'vang', chieu: 'ban', moc_bp: 10000 }]);
    const sauBan = await xemTran(tao.match_id);
    expect(sauBan.ban.vi_the.vang ?? 0).toBe(0);
    expect(sauBan.ban.tien_mat).toBeGreaterThan(giua.ban.tien_mat);

    // Cú ba: dùng đúng tiền vừa về để mua mã khác.
    const r3 = await khop(tao.match_id, 1, [{ ma: 'vn30', chieu: 'mua', moc_bp: 5000 }]);
    expect(r3.status).toBe(200);
    expect((await xemTran(tao.match_id)).ban.vi_the.vn30).toBeGreaterThan(0);
  });

  it('nộp vòng sau khi khớp: KHÔNG áp lại lần hai, log gộp thành khop_truoc', async () => {
    const tao = await taoTran();
    await khop(tao.match_id, 1, [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]);
    const truocNop = await xemTran(tao.match_id);
    const viTruoc = truocNop.ban.vi_the.btc;

    await nopVong(tao.match_id, 1);
    const sau = await xemTran(tao.match_id);
    /*
     * Vị thế sau nộp = vị thế trước nộp ± định giá của Ô VỪA LẬT — tuyệt đối
     * KHÔNG phải một cú mua thứ hai. Định giá một ô kéo giá trong khoảng vài
     * chục %, còn mua đúp là +100% cỡ lệnh: ngưỡng ×1,7 tách được hai thứ đó.
     */
    expect(sau.ban.vi_the.btc).toBeGreaterThan(0);
    expect(sau.ban.vi_the.btc, 'vị thế gần gấp đôi = đuôi khớp bị áp lại lần hai')
      .toBeLessThan(viTruoc * 1.7);

    const { rows } = await pool.query(
      `SELECT action_log FROM holdem_matches WHERE match_id = $1`, [tao.match_id]);
    const log = rows[0].action_log as any[];
    expect(log).toHaveLength(1);
    expect(log[0].khop_truoc, 'đuôi không gộp vào dòng vòng = lệnh bốc hơi')
      .toEqual([[{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]]);
    expect(log.some((h) => h.cho_nop)).toBe(false);
  });
});

describe('II. Sống chung với đuôi phí bảng', () => {
  it('⭐ khớp rồi MỞ BẢNG: nhóm khớp không bốc hơi (và ngược lại)', async () => {
    const tao = await taoTran();
    await khop(tao.match_id, 1, [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]);
    const rBang = await gui(`/api/v1/holdem/matches/${tao.match_id}/bang-dien-tu`, {
      method: 'POST', body: JSON.stringify({ vong: 1 }),
    });
    expect(rBang.status).toBe(200);

    // Cả hai thứ phải còn: vị thế đã khớp + phí bảng đã trừ.
    const st = await xemTran(tao.match_id);
    expect(st.ban.vi_the.btc, 'mở bảng ghi đè đuôi làm lệnh đã khớp bốc hơi')
      .toBeGreaterThan(0);

    // Và khớp TIẾP sau khi mở bảng cũng không nuốt phí bảng.
    // ⚠ Mốc phải là bội 2500 (BUOC_MOC_THO_BP) — ghế này không cầm Chia Lệnh.
    await khop(tao.match_id, 1, [{ ma: 'usd', chieu: 'mua', moc_bp: 2500 }]);
    const { rows } = await pool.query(
      `SELECT action_log FROM holdem_matches WHERE match_id = $1`, [tao.match_id]);
    const duoi = (rows[0].action_log as any[]).find((h) => h.cho_nop);
    expect(duoi.mo_bang, 'khớp lần hai nuốt mất phí bảng đang chờ').toBe(1);
    expect(duoi.khop).toHaveLength(2);
  });
});

describe('II-b. §4.5c — lá chọn CÙNG VÒNG có hiệu lực NGAY trong cú nộp', () => {
  /*
   * Founder 08/08: *"thẻ đang mở lại chẳng ảnh hưởng gì đến danh mục"*. Thứ tự
   * replay là mua lá → gắn → RỒI MỚI giải lệnh, nên đặc quyền phải sống ngay
   * trong cùng cú nộp — bài này khoá lời hứa đó bằng ca khó nhất: lệnh MỞ
   * KHỐNG (`khong`) chỉ hợp lệ khi cầm lá Bán Khống, và lá đó được lấy TRONG
   * CHÍNH cú nộp mang lệnh. Dùng bàn tập: bộ lõi ghim chào đúng Bán Khống ở
   * vòng lá CUỐI (MAN_TAP_LOI — đổi bảng ghim là bài này phải đổi theo).
   * ⚠ v33 (D90 M1, 17/08): nhịp map 8 giãn 2·3·4 → 2·4·6, nên vòng có Bán Khống
   * dời từ 4 sang 6. Đọc vòng từ CHÍNH nhịp của trận thay vì gõ số — nhịp đổi
   * lần nữa thì bài này đi theo, không đỏ oan.
   */
  it('⭐ lấy Bán Khống + lệnh mở khống trong MỘT cú nộp → khớp ngay vòng đó', async () => {
    // D527 — bộ lõi ghim Bán Khống ở vòng lá cuối là của bàn tập v54 ⇒ ghim bàn tập v54 đích danh (bàn tập mặc định nay v58).
    const tao = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ tap: true, ep_balance: 'balance-v54-ngare' }),
    });
    const nhip: string[] = tao.ban.nhip_chon_bai;
    const vongLa = nhip
      .map((x, i) => (x === 'chien_thuat' ? i + 1 : 0)).filter((x) => x > 0);
    const vongKhong = vongLa[vongLa.length - 1]!;   // vòng lá CUỐI = ghim Bán Khống
    for (let v = 1; v < vongKhong; v += 1) {
      const rv = await nopVong(tao.match_id, v, v === vongLa[0] ? { mua: ['luot_song'] } : {});
      expect(rv.error, `vòng ${v} không nộp được`).toBeUndefined();
    }
    const r4 = await nopVong(tao.match_id, vongKhong, {
      mua: ['ban_khong'],
      lenh: [{ ma: 'btc', chieu: 'khong', moc_bp: 2500 }],
    });
    expect(r4.error).toBeUndefined();
    expect(r4.loi_von?.lenh,
      'lệnh khống bị từ chối = lá cùng vòng KHÔNG hiệu lực ngay (trễ một vòng)')
      .toBeUndefined();
    const sau = await xemTran(tao.match_id);
    expect(sau.ban.vi_the_khong?.btc ?? 0).toBeGreaterThan(0);
  });
});

describe('III. Cửa đóng đúng chỗ', () => {
  it('lệnh rỗng/rác → 400, log không đổi', async () => {
    const tao = await taoTran();
    expect((await khop(tao.match_id, 1, [])).status).toBe(400);
    expect((await khop(tao.match_id, 1, [{ ma: '<x>', chieu: 'mua', moc_bp: 2500 }])).status)
      .toBe(400);
    // Mốc 10% khi không cầm Chia Lệnh: engine từ chối (bội 2500 mới hợp lệ).
    expect((await khop(tao.match_id, 1, [{ ma: 'btc', chieu: 'mua', moc_bp: 1000 }])).status)
      .toBe(409);
    const { rows } = await pool.query(
      `SELECT jsonb_array_length(action_log)::int n FROM holdem_matches WHERE match_id = $1`,
      [tao.match_id]);
    expect(rows[0].n).toBe(0);
  });

  it('sai vòng → 409', async () => {
    const tao = await taoTran();
    expect((await khop(tao.match_id, 5, [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }])).status)
      .toBe(409);
  });

  it('lệnh không đủ tiền → 409 lenh_khong_khop, KHÔNG ghi đuôi', async () => {
    const tao = await taoTran();
    // Nuốt hết tiền bằng một cú mua 100%, rồi thử mua tiếp.
    await khop(tao.match_id, 1, [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }]);
    const r = await khop(tao.match_id, 1, [{ ma: 'vang', chieu: 'mua', moc_bp: 10000 }]);
    expect(r.status).toBe(409);
    expect(((await r.json()) as any).error).toBe('lenh_khong_khop');
    const { rows } = await pool.query(
      `SELECT action_log FROM holdem_matches WHERE match_id = $1`, [tao.match_id]);
    const duoi = (rows[0].action_log as any[]).find((h) => h.cho_nop);
    expect(duoi.khop, 'lệnh lỗi mà vẫn vào đuôi = replay sẽ nổ').toHaveLength(1);
  });

  it('event hd_khop_lenh ghi CÙNG transaction — mỗi cú bấm một dòng', async () => {
    const tao = await taoTran();
    await khop(tao.match_id, 1, [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]);
    await khop(tao.match_id, 1, [{ ma: 'vang', chieu: 'mua', moc_bp: 2500 }]);
    const { rows } = await pool.query(
      `SELECT value_json FROM events
        WHERE context_id = $1 AND action_type = 'hd_khop_lenh' ORDER BY ts`,
      [tao.match_id]);
    expect(rows).toHaveLength(2);
    expect(rows[0].value_json.lenh[0].ma).toBe('btc');
    expect(rows[1].value_json.lenh[0].ma).toBe('vang');
  });
});
