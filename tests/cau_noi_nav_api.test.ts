/**
 * D342 — CẦU NỐI NAV qua endpoint thật. Founder 16/09 (ảnh vòng 2, bàn 12): tấm VÌ SAO nói
 * "Crypto +89" trong khi NAV −1.855 (−22,8%) — dựng lại ra phí mua bán −1.832 (RÚT hết CP + MUA
 * ALL-IN Crypto), nộp quỹ −500, nhận quỹ +388, không dòng nào hiện. Nợ ghi từ D336.
 *
 * Bất biến khoá ở đây: PHẦN TIỀN theo mã + mọi dòng cầu nối = NAV sau − NAV trước, ĐÚNG TỪNG
 * CHIP, ở mọi vòng — kể cả vòng có lệnh, vòng không lệnh, vòng nhận quỹ.
 *
 * ⚠ D415 — SEED GHIM + dòng NỘP QUỸ đo bằng khoản ghế ĐÃ GÓP, không bằng hằng 500. Cả hai bài từng tạo trận seed
 * NGẪU NHIÊN rồi đòi `nop_quy === −500` ở mọi vòng. Nhưng engine thu `min(nền, sức đóng)` (`moVongCuoc`; sức đóng =
 * NAV tự do từ v14): ghế đã đảo trọn danh mục mấy vòng liền, phí hai bậc đốt còn dưới 500, thì góp hết phần còn lại
 * — 497, 499 — và CÓ THỂ vẫn sống qua vòng nhờ phần quỹ chia về. Quét 150 seed bằng đúng hai chuỗi lệnh dưới đây: bài
 * ca cháy gặp ca ấy ở seed 105 · 121, bài ảnh founder ở seed 105 — tức đỏ theo xổ số (lượt cả bộ 26/09: `−497`).
 * Nay mỗi bài chơi một DANH SÁCH seed ghim chọn để phủ CẢ HAI nhánh (góp đủ nền · góp thiếu), đếm để chứng minh đã
 * phủ, và khẳng định dòng cầu nối bằng đúng khoản sổ cược ghi (`cua_ban.cam_ket`) — hai phép đo độc lập của cùng khoản.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { HOLDEM_MATCH } from '../config/holdem.js';

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
  // D415 — admin + `la_tester`: server CHỈ nhận `ep_seed` qua `laTester(actor)`; người thường bị bỏ qua lặng lẽ.
  user = await createTestUser(pool, { role: 'admin' });
  await pool.query(`UPDATE users SET la_tester = true WHERE user_id = $1`, [user.userId]);
}, 120_000);

afterAll(async () => { await db?.stop(); });

const json = async (path: string, init: RequestInit = {}): Promise<any> => (await app.request(
  `http://localhost${path}`,
  { ...init, headers: { 'content-type': 'application/json', cookie: user.cookie } },
)).json();
const nopVong = (id: string, vong: number, lenh: unknown[]) => json(`/api/v1/holdem/matches/${id}/rounds`, {
  method: 'POST',
  body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [], lenh }),
});
const tong = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** D415 — tạo trận v53 bàn 8 với seed ÉP, và khẳng định seed ăn thật (không thì bài quay về xổ số trong im lặng). */
async function taoTran(seed: number): Promise<any> {
  // D406 — `so_o: 8` chỉ còn nghĩa dưới khoá còn cho chọn cỡ: ghim v53 (bàn 8 không vai — xem ghi chú ở holdem_khop_lenh).
  const t = await json('/api/v1/holdem/matches', {
    method: 'POST', body: JSON.stringify({ so_o: 8, ep_balance: 'balance-v53-upo', ep_seed: seed }),
  });
  expect(t.match_id, JSON.stringify(t).slice(0, 200)).toBeTypeOf('string');
  const { rows: [m] } = await pool.query(
    `SELECT seed::text AS seed FROM holdem_matches WHERE match_id = $1`, [t.match_id]);
  expect(m?.seed, 'ep_seed bị bỏ qua — người tạo trận phải là admin + la_tester').toBe(String(seed));
  return t;
}

/**
 * D415 — dòng NỘP QUỸ phải HIỆN và bằng ĐÚNG khoản sổ cược ghi ghế đã góp vòng này (≤ nền). Trả khoản góp để bài
 * đếm được nhánh "góp thiếu nền". Hai phép đo độc lập: dòng cầu nối lấy từ hai mốc NAV, `cam_ket` lấy từ sổ cược.
 */
function kiemNopQuy(theoId: Record<string, number>, kv: any, nhan: string): number {
  const gop = kv.cua_ban?.cam_ket;
  expect(theoId.nop_quy, `${nhan}: nộp quỹ phải hiện`).toBeLessThan(0);
  expect(gop, `${nhan}: sổ cược phải ghi khoản góp`).toBeGreaterThan(0);
  expect(gop, `${nhan}: góp quá nền`).toBeLessThanOrEqual(HOLDEM_MATCH.CAM_KET_NEN);
  expect(-theoId.nop_quy!, `${nhan}: dòng nộp quỹ lệch khoản ghế đã góp`).toBe(gop);
  return gop as number;
}

describe('cầu nối NAV — PHẦN TIỀN + các dòng khác = ΔNAV, từng chip', () => {
  it('⭐ kịch bản ảnh founder: MUA ALL-IN rồi đảo sang mã khác — cộng khớp mọi vòng, phí hiện ra', async () => {
    /*
     * D384 — QUÉT TỚI KHI PHỦ ĐƯỢC DÒNG QUỸ, không cầu may một trận.
     *
     * Bản cũ tạo MỘT trận (seed NGẪU NHIÊN — POST không truyền seed), chơi 5 vòng, rồi đòi
     * có ít nhất một vòng ghế mình nhận quỹ. Đó là bài XÁC SUẤT: 22/09 trúng, 23/09 trượt,
     * trong khi mã chạy không đổi một dòng. Một bài đỏ/xanh theo may rủi thì cả hai màu
     * đều không nói gì.
     *
     * Nay dùng đúng cách bài "ca cháy" ngay dưới đã dùng: chơi TỚI HẾT BÀN (số vòng do server
     * khai — bàn k ô chạy k−1 vòng từ D382), lặp nhiều trận, dừng khi đã thấy dòng quỹ. Bất
     * biến cầu-nối-khép được kiểm ở MỌI vòng của MỌI trận đã chơi ⇒ bài CHẶT hơn, không
     * lỏng đi. Quét 40 trận mà vẫn không thấy dòng quỹ thì đó là tín hiệu thật (ghế người
     * không bao giờ được chia quỹ), không còn là xui.
     */
    const lenhVong = (v: number): unknown[] => (v === 1
      ? [{ ma: 'cp_cn', chieu: 'mua', moc_bp: 10000 }]
      : v === 2
        ? [{ ma: 'cp_cn', chieu: 'ban', moc_bp: 10000 }, { ma: 'btc', chieu: 'mua', moc_bp: 10000 }]
        : []);
    let coQuy = 0;
    let soVongDaKiem = 0;
    let gopThieu = 0;
    /*
     * D415 — seed GHIM (quét 150 seed bằng đúng chuỗi lệnh này): 0 = trận điển hình, đủ 7 vòng, góp đủ nền, nhận quỹ
     * 6 vòng · 105 = vòng 2 (ALL-IN rồi đảo sang Crypto) phí hai bậc đốt NAV tự do xuống dưới 500 ⇒ góp 497, rồi cháy ở
     * vòng 4. Phủ cả hai nhánh của dòng nộp quỹ.
     */
    for (const [n, seed] of [0, 105].entries()) {
      const t = await taoTran(seed);
      const cuoi = Number(t.tong_vong);
      expect(cuoi, `trận ${n}: server phải khai tong_vong`).toBeGreaterThan(2);
      for (let v = 1; v <= cuoi; v += 1) {
        const r = await nopVong(t.match_id, v, lenhVong(v));
        const kv = r.ket_qua_vong;
        if (!kv) break; // đã cháy từ vòng trước ⇒ không còn kết quả vòng để nối
        expect(kv.nav_truoc, `trận ${n} vòng ${v}: thiếu mẫu số`).toBeTypeOf('number');
        const dong = (kv.cau_noi_nav ?? []) as { id: string; tien: number }[];
        const gia = tong(Object.values((kv.cua_ban?.tien_theo_ma ?? {}) as Record<string, number>));
        expect(gia + tong(dong.map((d) => d.tien)), `trận ${n} vòng ${v}: cầu nối không khép`)
          .toBe(r.ban.nav - kv.nav_truoc);
        const theoId = Object.fromEntries(dong.map((d) => [d.id, d.tien]));
        if (kiemNopQuy(theoId, kv, `trận ${n} vòng ${v}`) < HOLDEM_MATCH.CAM_KET_NEN) gopThieu += 1;
        if (v <= 2) expect(theoId.phi_giao_dich, `trận ${n} vòng ${v}: phí mua bán phải hiện`).toBeLessThan(0);
        else expect(theoId.phi_giao_dich, `trận ${n} vòng ${v}: không lệnh mà có phí`).toBeUndefined();
        if ((theoId.quy_vong ?? 0) > 0) coQuy += 1;
        for (const d of dong) expect(d.tien, `dòng ${d.id} = 0 phải bị lược`).not.toBe(0);
        soVongDaKiem += 1;
        if (r.ban.da_chay === true) break;
      }
    }
    expect(coQuy, 'không vòng nào nhận quỹ — ghế người không bao giờ được chia quỹ?')
      .toBeGreaterThan(0);
    expect(soVongDaKiem, 'bài phải kiểm được ít nhất một trận trọn').toBeGreaterThan(2);
    expect(gopThieu, 'seed ghim không còn phủ nhánh GÓP THIẾU nền — chọn lại seed, đừng bỏ vế này').toBeGreaterThan(0);
  }, 600_000);
});

/**
 * D346 — CA CHÁY. Phí hai bậc làm cú "ALL-IN rồi đảo mã" tốn hơn hẳn, nên ghế cháy giữa vòng là
 * chuyện thường gặp chứ không còn hiếm. Trước bản vá, ĐÚNG vòng cháy thì cầu nối rơi về rỗng:
 * tấm VÌ SAO không kể một dòng nào và thiếu đúng 500 (nộp quỹ) so với ΔNAV.
 */
describe('cầu nối NAV — vòng ghế CHÁY vẫn phải khép', () => {
  it('trận cháy: mọi vòng cộng khớp, vòng cháy vẫn có dòng nộp quỹ — cả khi góp đủ nền lẫn khi góp thiếu', async () => {
    let daThayChay = 0;
    let chayGopDu = 0;
    let gopThieu = 0;
    // Đảo trọn danh mục MỖI vòng: cách nhanh nhất để đốt NAV xuống ngưỡng cháy dưới phí hai bậc.
    const daoVong = (v: number): unknown[] => (v === 1
      ? [{ ma: 'cp_cn', chieu: 'mua', moc_bp: 10000 }]
      : (v % 2 === 0
        ? [{ ma: 'cp_cn', chieu: 'ban', moc_bp: 10000 }, { ma: 'btc', chieu: 'mua', moc_bp: 10000 }]
        : [{ ma: 'btc', chieu: 'ban', moc_bp: 10000 }, { ma: 'cp_cn', chieu: 'mua', moc_bp: 10000 }]));
    /*
     * D415 — seed GHIM thay cho "quét tới 120 trận ngẫu nhiên" (quét 150 seed bằng đúng chuỗi lệnh này: 23 trận cháy,
     * 21 góp đủ nền ở vòng cháy, 2 góp thiếu). 2 = cháy ở vòng 5, góp đủ 500 · 105 = góp 497 rồi 499 mà VẪN SỐNG (vòng
     * 2, 3 — quỹ chia về kéo lại), cháy ở vòng 4 với 497. Bản cũ còn một cái trần giả: tạo trận bị chặn 30 trận/giờ mỗi
     * tài khoản, nên "120 trận" thật ra chỉ là 30, rồi 90 vòng lặp tạo hụt trong im lặng.
     */
    for (const [n, seed] of [2, 105].entries()) {
      const t = await taoTran(seed);
      // D384 — tới hết bàn theo số vòng server khai; `v <= 8` cũ gửi thừa một vòng không tồn
      // tại và chỉ "qua" được nhờ `if (!kv) break` — nuốt nhầm "trận đã đóng" thành "đã cháy".
      for (let v = 1; v <= Number(t.tong_vong); v += 1) {
        const r = await nopVong(t.match_id, v, daoVong(v));
        const kv = r.ket_qua_vong;
        if (!kv) break; // đã cháy từ vòng trước ⇒ không còn kết quả vòng để nối
        const dong = (kv.cau_noi_nav ?? []) as { id: string; tien: number }[];
        const gia = tong(Object.values((kv.cua_ban?.tien_theo_ma ?? {}) as Record<string, number>));
        expect(gia + tong(dong.map((d) => d.tien)), `trận ${n} vòng ${v}: cầu nối không khép`)
          .toBe(r.ban.nav - kv.nav_truoc);
        const theoId = Object.fromEntries(dong.map((d) => [d.id, d.tien]));
        const gop = kiemNopQuy(theoId, kv, `trận ${n} vòng ${v}`);
        if (gop < HOLDEM_MATCH.CAM_KET_NEN) gopThieu += 1;
        if (r.ban.da_chay === true) {
          daThayChay += 1;
          if (gop === HOLDEM_MATCH.CAM_KET_NEN) chayGopDu += 1;
          break;
        }
      }
    }
    // Đếm để chứng minh seed ghim phủ đủ: một bộ seed chỉ ra một nhánh thì bài lại chỉ canh được một nửa.
    expect(daThayChay, 'seed ghim không còn cháy — bài này không còn canh thứ nó định canh').toBe(2);
    expect(chayGopDu, 'thiếu ca cháy mà vẫn góp ĐỦ nền').toBeGreaterThan(0);
    expect(gopThieu, 'thiếu ca góp THIẾU nền — đúng ca bản cũ đỏ theo xổ số').toBeGreaterThan(0);
  }, 600_000);
});
