/**
 * BẢNG ĐIỆN TỬ — TẦNG API, qua HTTP, DB thật, đúng đường code production.
 *
 * `holdem_bang.test.ts` đã khoá phần LÕI (hàm thuần). File này chỉ hỏi bốn câu
 * mà lõi không trả lời được, và cả bốn đều là chỗ tính năng chết trong im lặng:
 *
 *   1. PHÍ CÓ CHẠY THẬT KHÔNG — bẫy số 1 của repo là cơ chế trang trí: code có,
 *      test có, mà không đường chạy nào gọi. Nên ở đây ĐO Vốn qua endpoint trạng
 *      thái trước/sau, không khẳng định hàm trả đúng số.
 *   2. PHÍ CÓ SỐNG SÓT QUA LẦN NỘP VÒNG KHÔNG — trạng thái trận được REPLAY từ
 *      `action_log`, nên phí không nằm trong log là phí bốc hơi ở lần nộp kế.
 *      Đây là chỗ hỏng đắt nhất: không lỗi, không test đỏ, LUẬT 3 thành văn bản.
 *   3. TRẬN CŨ CÓ REPLAY RA ĐÚNG KẾT QUẢ CŨ KHÔNG — log trận cũ không có trường
 *      `mo_bang`; thiếu ⇒ 0 lần ⇒ không trừ gì.
 *   4. CHE Ở TẦNG API, KHÔNG Ở UI (D19) — F12 không moi ra được nấc thật của
 *      btc/cp_cn, số của sự kiện vòng hiện tại, hay cờ `la_tin_gia`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { BANG_DIEN_TU, HOLDEM_DECISIONS } from '../config/holdem.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-secret-bang', secureCookie: false,
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
async function json(path: string, init: RequestInit = {}): Promise<any> {
  return (await req(path, init)).json();
}

/*
 * ⚠ GHIM v10a — BỘ TEST DI SẢN (28/07, khi mặc định lật sang v10b-nav).
 * File này đo các cơ chế của MÔ HÌNH LÁ BÀI: mua tài sản bằng lá, đảo danh
 * mục kiểu cũ, số học không-lạm-phát. Trong nav chúng chết THEO THIẾT KẾ
 * (tài sản đi bằng lệnh mốc, đảo = bán A mua B, tiền mặt chịu lạm phát) —
 * nhưng trận v10a đã lưu vẫn replay bằng luật này nên luật này vẫn cần người
 * canh. Đối chứng nav nằm ở holdem_nav_api.test.ts.
 */
const taoTran = () => json('/api/v1/holdem/matches', {
  method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v10a-tatcuoc' }),
});

const moBang = (matchId: string, vong: number) =>
  req(`/api/v1/holdem/matches/${matchId}/bang-dien-tu`,
    { method: 'POST', body: JSON.stringify({ vong }) });

/** Payload bảng, đã ép kiểu — hình dạng thật đã được `holdem_bang.test.ts` khoá. */
const banger = async (matchId: string, vong: number): Promise<any> =>
  (await moBang(matchId, vong)).json();

/** `action_log` thô trong DB — nguồn dựng lại trận, test đọc thẳng. */
async function docLog(matchId: string): Promise<any[]> {
  const q = await pool.query(
    'SELECT action_log FROM holdem_matches WHERE match_id = $1', [matchId]);
  return (q.rows[0]!.action_log ?? []) as any[];
}

const trangThai = (matchId: string) => json(`/api/v1/holdem/matches/${matchId}`);

/** Nộp một vòng "không làm gì" — đủ để đẩy trận sang vòng kế. */
const nopVong = (matchId: string, vong: number) =>
  json(`/api/v1/holdem/matches/${matchId}/rounds`, {
    method: 'POST',
    body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0 }),
  });

describe('1. 🔴 PHÍ CÓ THẬT SỰ CHẠY (bẫy #1 — cơ chế trang trí)', () => {
  it('mở bảng → Vốn ĐỌC TỪ ENDPOINT TRẠNG THÁI thấp hơn đúng PHI_MO', async () => {
    const tao = await taoTran();
    const vonTruoc = tao.ban.von;

    const r = await moBang(tao.match_id, 1);
    expect(r.status).toBe(200);
    const bang: any = await r.json();
    expect(bang.phi_da_thu).toBe(BANG_DIEN_TU.PHI_MO);

    /*
     * ĐO LẠI QUA ENDPOINT KHÁC, không tin con số endpoint mở bảng tự khai. Đây
     * là phép thử duy nhất phân biệt "phí có chạy" với "phí được tường thuật":
     * nếu `apPhiMoBang` không nằm trên đường replay thì `von` trong payload vẫn
     * đúng còn trạng thái thật thì không đổi.
     */
    const st = await trangThai(tao.match_id);
    expect(st.ban.von, 'Vốn không đổi ⇒ phí không chạy, dù payload khai có')
      .toBe(vonTruoc - BANG_DIEN_TU.PHI_MO);
    expect(bang.von).toBe(st.ban.von);
  });

  it('mở lại trong CÙNG vòng: miễn phí, nội dung y hệt, Vốn đứng yên', async () => {
    const tao = await taoTran();
    const lan1 = await banger(tao.match_id, 1);
    const lan2 = await banger(tao.match_id, 1);

    expect(lan2.phi_da_thu, 'thu lần hai = đánh thuế cú bấm lỡ tay').toBe(0);
    // Nội dung bảng là hàm thuần của (seed, vòng, danh mục) nên lần hai KHÔNG
    // bán thêm gì — đó chính là lý do trần TOI_DA_MOI_VONG tồn tại.
    expect(lan2.so_cai).toEqual(lan1.so_cai);
    expect(lan2.thanh_khoan).toEqual(lan1.thanh_khoan);

    const st = await trangThai(tao.match_id);
    expect(st.ban.von).toBe(tao.ban.von - BANG_DIEN_TU.PHI_MO);
  });

  it('mở ở NHIỀU vòng thì thu NHIỀU lần (trần là mỗi-vòng, không phải mỗi-trận)', async () => {
    const tao = await taoTran();
    await moBang(tao.match_id, 1);
    const sauV1 = await nopVong(tao.match_id, 1);
    const vonDauV2 = sauV1.ban.von;

    await moBang(tao.match_id, 2);
    const st = await trangThai(tao.match_id);
    expect(st.ban.von).toBe(vonDauV2 - BANG_DIEN_TU.PHI_MO);
  });
});

describe('2. 🔴 PHÍ SỐNG SÓT QUA LẦN NỘP VÒNG (replay từ action_log)', () => {
  it('mở bảng rồi nộp vòng → phí KHÔNG bốc hơi, và nằm trong log', async () => {
    const tao = await taoTran();
    await moBang(tao.match_id, 1);
    await nopVong(tao.match_id, 1);

    /*
     * Vòng 1 còn trừ cam kết nền và cộng/trừ P&L, nên số tuyệt đối sau khi nộp
     * không nói lên điều gì. Bằng chứng phí sống sót nằm ở hai chỗ đo được:
     * (a) log sau khi nộp PHẢI mang `mo_bang` — dưới đây; (b) gỡ trường đó ra
     * thì Vốn nhảy lên đúng PHI_MO — test kế tiếp.
     */
    const log = await docLog(tao.match_id);
    expect(log, 'đuôi chờ nộp phải được GỘP, không để lại dòng rác').toHaveLength(1);
    expect(log[0].cho_nop, 'dòng vòng không được mang cờ đuôi').toBeUndefined();
    expect(log[0].mo_bang, 'phí bốc hơi lúc nộp vòng ⇒ LUẬT 3 chỉ là văn bản')
      .toBe(1);
  });

  it('GỠ `mo_bang` khỏi log → replay ra Vốn CAO HƠN đúng PHI_MO', async () => {
    /*
     * Đây đồng thời là phép thử "TRẬN CŨ": log của trận tạo trước bản này trông
     * y hệt log đã gỡ trường — và nó phải replay ra đúng kết quả nó từng có,
     * tức không trừ gì. Sửa-rồi-đo: nếu hai con số bằng nhau thì `h.mo_bang`
     * không hề được đọc trên đường replay.
     */
    /*
     * ⚠ "BỎ PHÍ ĐI THÌ GIÀU HƠN" LÀ MỘT GIẢ ĐỊNH SAI. ĐO RA MỚI THẤY.
     *
     * Bản cũ đòi hiệu số ĐÚNG BẰNG `PHI_MO`. Chạy nhiều lần thì gặp **−499**: gỡ phí
     * đi mà người chơi kết thúc với ÍT tiền hơn 499.
     *
     * Không phải bug. `cam_ket` co giãn theo Vốn, nên vào vòng với nhiều tiền hơn là
     * CAM KẾT LỚN HƠN — và vòng đó lỗ thì lỗ đậm hơn đúng phần chênh. Cộng thêm hai
     * ngưỡng kẹp có thể bị vượt ở bản này mà không ở bản kia: gọi ký quỹ (từ D37 trừ
     * `Math.min(g.von, MAT_CHIP_THUONG)` ở MỌI ô, không riêng hack sàn) và cháy tài
     * khoản. Seed trận do server tự sinh (API không nhận seed) nên trước đây test
     * xanh là do MAY, không phải do chắc.
     *
     * ⇒ Điều test này THẬT SỰ chứng minh được, và là điều nó cần chứng minh, là
     * `h.mo_bang` CÓ NẰM TRÊN ĐƯỜNG REPLAY: gỡ trường ra thì kết quả ĐỔI. Chiều của
     * cú đổi không phải là thứ suy ra được, và đòi hỏi nó là đòi hỏi một tính chất
     * mà engine không hứa.
     *
     * Hai khẳng định, giữ nguyên độ chặt của cả hai:
     *  · MỌI trận: `khongPhi !== coPhi` — bằng nhau nghĩa là trường không được đọc.
     *  · ÍT NHẤT MỘT trận sạch (không cam kết lệch, không chạm ngưỡng): hiệu số ĐÚNG
     *    BẰNG `PHI_MO` — giữ lại phép đo chính xác, chỉ thôi đòi nó ở một trận rút
     *    ngẫu nhiên.
     */
    let daThayDungPhi = false;
    for (let lan = 0; lan < 8 && !daThayDungPhi; lan += 1) {
      const tao = await taoTran();
      await moBang(tao.match_id, 1);
      await nopVong(tao.match_id, 1);
      const coPhi = (await trangThai(tao.match_id)).ban.von;

      const logCu = (await docLog(tao.match_id)).map(({ mo_bang: _bo, ...h }) => h);
      await pool.query(
        'UPDATE holdem_matches SET action_log = $1 WHERE match_id = $2',
        [JSON.stringify(logCu), tao.match_id]);

      const khongPhi = (await trangThai(tao.match_id)).ban.von;
      expect(khongPhi - coPhi,
        'gỡ trường mà số KHÔNG ĐỔI ⇒ `h.mo_bang` không được đọc trên đường replay')
        .not.toBe(0);
      if (khongPhi - coPhi === BANG_DIEN_TU.PHI_MO) daThayDungPhi = true;
    }
    expect(daThayDungPhi,
      '8 trận đều lệch khỏi PHI_MO ⇒ phí đang bị một cơ chế khác cộng thêm vào, '
      + 'không còn là "trừ đúng phí mở bảng"').toBe(true);
  });
});

describe('3. Từ chối rõ ràng (sai vòng / sai pha)', () => {
  it('sai vòng → 409 sai_vong, KHÔNG thu phí', async () => {
    const tao = await taoTran();
    const r = await moBang(tao.match_id, 7);
    expect(r.status).toBe(409);
    expect(((await r.json()) as any).error).toBe('sai_vong');
    expect((await trangThai(tao.match_id)).ban.von).toBe(tao.ban.von);
  });

  it('trận đã xong → 409 match_closed', async () => {
    const tao = await taoTran();
    for (let v = 1; v <= HOLDEM_DECISIONS.MAP_SIZE; v += 1) {
      const r = await nopVong(tao.match_id, v);
      if (r.xong) break;
    }
    const r = await moBang(tao.match_id, 1);
    expect(r.status).toBe(409);
    expect(((await r.json()) as any).error).toBe('match_closed');
  });

  it('trận của người khác → 404, không lộ sự tồn tại', async () => {
    const tao = await taoTran();
    const nguoiLa = await createTestUser(pool);
    const r = await app.request(
      `http://localhost/api/v1/holdem/matches/${tao.match_id}/bang-dien-tu`,
      {
        method: 'POST', body: JSON.stringify({ vong: 1 }),
        headers: { 'content-type': 'application/json', cookie: nguoiLa.cookie },
      });
    expect(r.status).toBe(404);
  });
});

describe('4. 🔴 CHE Ở TẦNG API, KHÔNG Ở UI (D19) — F12 không moi ra được', () => {
  it('raw JSON không chứa `la_tin_gia` ở bất kỳ đâu', async () => {
    const tao = await taoTran();
    const raw = await (await moBang(tao.match_id, 1)).text();
    expect(raw).not.toContain('la_tin_gia');
    // Kể cả tên trường bị đổi, giá trị boolean trần cũng không được kèm ô nào.
    expect(raw).not.toContain('tin_gia":true');
  });

  it('LUẬT 2 — btc/cp_cn: nấc thật, vạch và độ sâu đều BỊ CẮT khỏi payload', async () => {
    const tao = await taoTran();
    const bang = await banger(tao.match_id, 1);

    const mu = bang.thanh_khoan.filter((t: any) => t.suong_mu);
    expect(mu.map((t: any) => t.tai_san_id).sort())
      .toEqual([...BANG_DIEN_TU.MA_SUONG_MU].sort());
    for (const t of mu) {
      expect(t.nac, 'nấc thật lọt ra ⇒ sương mù chỉ là trang trí UI').toBeNull();
      expect(t.vach).toBeNull();
      // `do_sau` là con số nạp thẳng vào tầng trượt giá — lộ nó là lộ nấc.
      expect(t.do_sau, 'độ sâu sổ lệnh suy ngược ra nấc ngay lập tức').toBeNull();
      expect(t.bien).toHaveLength(2);
    }
    for (const t of bang.thanh_khoan.filter((x: any) => !x.suong_mu)) {
      expect(t.nac).not.toBeNull();
      expect(t.bien, 'mã không sương mù thì không có biên để nhấp nháy').toBeUndefined();
    }
  });

  it('LUẬT 1 — sự kiện vòng HIỆN TẠI: mọi SỐ là null, tên thì không che', async () => {
    /*
     * QUÉT NÔNG, ÍT TRẬN — 5 trận × 3 vòng đầu. Hai ràng buộc ngược nhau, và cả hai
     * đều đã cắn thật trong ngày 27/07:
     *
     *  · ĐI SÂU TRONG MỘT TRẬN THÌ HẾT TIỀN. Mỗi vòng đi qua là một lần bào Vốn, nên
     *    tới vòng 6–7 có seed không còn đủ `PHI_MO`; API trả 409 và bản cũ `.json()`
     *    thẳng rồi `.find()` trên `undefined` — nổ bằng "Cannot read properties of
     *    undefined", một thông báo không chỉ ra nguyên nhân, ở một test chẳng liên
     *    quan gì tới tiền. D39 (tương quan) đổi quỹ đạo Vốn nên nó lộ ra.
     *  · TẠO NHIỀU TRẬN THÌ ĐỤNG RATE LIMIT. Bản dò 20 trận làm `POST /matches` trả
     *    409 `rate_limited` (`consumeLimit`, holdem_api.ts) và kéo đổ CẢ BỐN test sau
     *    trong file — tệ hơn hẳn lỗi ban đầu. Nới số lần dò là phản xạ sai ở đây.
     *
     * Ba vòng đầu thì Vốn còn dư dả, mà sự kiện chiếm ~35% số ô nên 5×3 lượt trượt
     * hết chỉ khoảng 0,5%. Và mọi lỗi mở bảng nay đỏ NGAY kèm thân phản hồi, thay vì
     * nổ ở một dòng `.find()` cách xa nguyên nhân.
     */
    let daKiem = false;
    for (let lan = 0; lan < 6 && !daKiem; lan += 1) {
      const tao = await taoTran();
      let st = tao;
      // Chỉ 3 vòng ĐẦU: xem docstring — đi sâu hơn là bào hết Vốn rồi 409.
      for (let v = 1; v <= 3 && !daKiem; v += 1) {
        if (st.o_hien_tai?.kind === 'su_kien') {
          const r = await moBang(tao.match_id, v);
          const bang = await r.json() as any;
          /*
           * ⚠ HẾT VỐN LÀ TRẠNG THÁI HỢP LỆ CỦA TRÒ CHƠI, KHÔNG PHẢI LỖI.
           *
           * Bản trước khẳng định thẳng `status === 200` với lý lẽ "ba vòng đầu thì
           * Vốn còn dư dả". ĐO RA SAI: chạy 4 lượt thì 1 lượt đỏ với
           * `khong_du_von … bạn còn 2` ngay ở vòng 3. Quỹ đạo Vốn phụ thuộc seed
           * (cam kết nền · phí · gọi ký quỹ ở ô thường từ v8), nên "dư dả" là một
           * PHỎNG ĐOÁN chứ chưa bao giờ là bất biến.
           *
           * Test này kiểm LUẬT CHE SỐ (D19), không kiểm khả năng chi trả. Một mẫu
           * không mở nổi bảng là mẫu KHÔNG DÙNG ĐƯỢC, không phải một luật bị vi
           * phạm — nên bỏ mẫu, đi tiếp. Mọi lỗi KHÁC vẫn đỏ ngay, vì lỗi khác thì
           * đúng là bug.
           */
          if (r.status === 409 && bang?.error === 'khong_du_von') break;
          expect(r.status, `mở bảng vòng ${v} phải được: ${JSON.stringify(bang)}`)
            .toBe(200);
          const dong = bang.so_cai.find((d: any) => d.vong === v);
          expect(dong, 'ô sự kiện đang lật phải có mặt trong sổ cái').toBeTruthy();
          expect(dong.an).toBe(true);
          expect(dong.do_lon_bp).toBeNull();
          expect(dong.con_vong).toBeNull();
          expect(dong.dao).toBeNull();
          expect(dong.luc_bp).toBeNull();
          // Tên KHÔNG bị che: người chơi đã thấy ô lật, che tên chỉ là gây khó.
          expect(dong.su_kien).toBe(st.o_hien_tai.su_kien);
          expect(dong.label.length).toBeGreaterThan(0);
          // Dòng "?" không được lọt vào tổng ròng, và phải được ĐẾM ra.
          expect(bang.so_dong_chua_ro).toBeGreaterThanOrEqual(1);
          daKiem = true;
          break;
        }
        const r = await nopVong(tao.match_id, v);
        if (r.xong) break;
        st = r;
      }
    }
    expect(daKiem, 'quét 6 trận không gặp ô sự kiện nào — map hết sinh tin?').toBe(true);
  });

  it('tổng ròng chỉ cộng dòng ĐÃ BIẾT, và số dòng chưa rõ được khai báo', async () => {
    const tao = await taoTran();
    const bang = await banger(tao.match_id, 1);
    const tong = bang.so_cai
      .filter((d: any) => d.luc_bp !== null)
      .reduce((s: number, d: any) => s + d.luc_bp, 0);
    expect(bang.tong_rong_bp).toBe(tong);
    expect(bang.so_dong_chua_ro)
      .toBe(bang.so_cai.filter((d: any) => d.luc_bp === null).length);
  });
});

describe('5. Event `hd_mo_bang` (A7 — dữ liệu mới là sản phẩm thật)', () => {
  it('ghi CÙNG transaction với việc trừ Vốn, snapshot gọn và đủ bối cảnh', async () => {
    const tao = await taoTran();
    const bang = await banger(tao.match_id, 1);

    const ev = await pool.query(
      `SELECT value_num, value_json, state_snapshot_json FROM events
        WHERE context_id = $1 AND action_type = 'hd_mo_bang'`, [tao.match_id]);
    expect(ev.rowCount).toBe(1);
    const row = ev.rows[0]!;
    expect(Number(row.value_num), 'phải là phí THỰC THU, không phải giá niêm yết')
      .toBe(BANG_DIEN_TU.PHI_MO);
    // D33 — hai hạng LOG RIÊNG, không gộp: "ai chịu trả thêm cho thông tin DỰ
    // BÁO vs ai bằng lòng với thông tin MÔ TẢ HIỆN TRẠNG là hai kiểu người khác
    // nhau" (founder). Ghế mặc định không cầm Lướt Sóng nên cả hai đều false.
    expect(row.value_json).toEqual({
      vong: 1, so_lan: 1, hang_sach: false, hang_du_bao: false,
    });

    const snap = row.state_snapshot_json;
    expect(snap.vong).toBe(1);
    expect(snap.von_truoc, 'thiếu mẫu số thì không đọc được phí đắt hay rẻ')
      .toBe(tao.ban.von);
    expect(snap.tong_rong_bp).toBe(bang.tong_rong_bp);
    expect(snap.so_dong_chua_ro).toBe(bang.so_dong_chua_ro);
    // D25/R1 — bối cảnh đối thủ, bắt buộc từ dòng đầu vì KHÔNG backfill được.
    expect(snap.so_nguoi_song).toBe(tao.doi_thu.length + 1);
    expect(snap.o_kind).toBe(tao.o_hien_tai.kind);

    // A7: ≤ ~300 byte. Dump cả `BangDienTu` vào đây là gấp hàng chục lần.
    expect(JSON.stringify(snap).length).toBeLessThanOrEqual(300);
    // Event cũng không được biết thứ người chơi chưa được biết.
    expect(JSON.stringify(snap)).not.toContain('la_tin_gia');
  });

  it('mở lại miễn phí vẫn ghi event, với value_num = 0', async () => {
    const tao = await taoTran();
    await moBang(tao.match_id, 1);
    await moBang(tao.match_id, 1);
    const ev = await pool.query(
      `SELECT value_num FROM events
        WHERE context_id = $1 AND action_type = 'hd_mo_bang' ORDER BY event_id`,
      [tao.match_id]);
    expect(ev.rowCount, 'lần mở thứ hai vẫn là một hành vi đáng đo').toBe(2);
    expect(Number(ev.rows[1]!.value_num)).toBe(0);
  });
});

describe('6. Catalog niêm yết giá (nút phải báo giá TRƯỚC khi bấm)', () => {
  it('`luat.PHI_BANG_DIEN_TU` khớp hằng số, không để client gõ lại giá', async () => {
    const c = await json('/api/v1/holdem/catalog');
    expect(c.luat.PHI_BANG_DIEN_TU).toBe(BANG_DIEN_TU.PHI_MO);
  });
});
