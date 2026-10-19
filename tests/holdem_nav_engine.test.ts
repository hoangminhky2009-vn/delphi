/**
 * ENGINE v10 chặng 2 — NỐI: lệnh vào engine, chotPhien nhánh NAV.
 *
 * Kiểm qua ĐƯỜNG CHẠY THẬT (giaiQuyetVong), không qua hàm rời — bẫy số 1 của
 * repo là "hàm có, test hàm xanh, không ai gọi" (đã dính 10 lần).
 */
import { describe, expect, it } from 'vitest';
import {
  apLenhVongNav, giaiQuyetVong, taoTran, type GheMoi,
} from '../server/holdem/engine.js';
import { navCua } from '../server/holdem/nav.js';
import { HOLDEM_BALANCE_VERSION, HOLDEM_MATCH, NAV_V10, luatCua } from '../config/holdem.js';

const V10B = luatCua('balance-v10b-nav');
const ghe = (id: string): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] },
});
const THEO = () => ({ loai: 'theo' as const });

describe('cổng version', () => {
  it('v10b bật nav; v10a và mọi bản cũ thì KHÔNG', () => {
    expect(V10B.nav).toBe(true);
    expect(luatCua('balance-v10a-tatcuoc').nav).toBe(false);
    expect(luatCua('balance-v9-tuongquan').nav).toBe(false);
    expect(luatCua(undefined).nav).toBe(false);
  });

  it('version MẶC ĐỊNH là v10b — lật trong CÙNG commit nối UI (chặng 3b)', () => {
    // Chiều gác cũ ("chưa nối thì chưa lật") đã hoàn thành nhiệm vụ 28/07.
    expect(luatCua(HOLDEM_BALANCE_VERSION).nav).toBe(true);
  });
});

describe('apLenhVongNav — cửa lệnh duy nhất', () => {
  it('mua 2.000 BTC: vị thế 1.976 (trượt 24 vào quỹ vòng), gương tai_san đồng bộ', () => {
    const st = taoTran(11, [ghe('a'), ghe('b')], V10B);
    const r = apLenhVongNav(st, 'a', [{ ma: 'btc', tien: 2000 }]);
    expect(r.ok).toBe(true);
    const a = r.st.ghe.find((g) => g.id === 'a')!;
    expect(a.von).toBe(HOLDEM_MATCH.START_VON - 2000);
    expect(a.vi_the.btc).toBe(1976);            // 2000 − floor(2000×120/10000)
    expect(a.danh_muc.tai_san).toEqual(['btc']); // gương cho dungChuoi/chen chúc
    expect(r.st.phi_giao_dich_vong).toBe(24);
  });

  it('trận KHÔNG bật nav → từ chối rõ, không im lặng', () => {
    const st = taoTran(11, [ghe('a')], luatCua('balance-v10a-tatcuoc'));
    expect(apLenhVongNav(st, 'a', [{ ma: 'btc', tien: 100 }]).loi).toBe('nav_tat');
  });

  it('lệnh hỏng → trận không đổi một chip nào', () => {
    const st = taoTran(11, [ghe('a')], V10B);
    const r = apLenhVongNav(st, 'a', [{ ma: 'btc', tien: 999999 }]);
    expect(r.loi).toBe('khong_du_tien');
    expect(r.st).toBe(st);
  });
});

describe('chotPhien nhánh NAV — chạy trọn vòng thật', () => {
  it('giá CẮN vào vị thế: pnl_bp ĐÚNG BẰNG công thức tăng trưởng NAV', () => {
    let st = taoTran(77, [ghe('a'), ghe('b'), ghe('c')], V10B);
    st = apLenhVongNav(st, 'a', [{ ma: 'btc', tien: 5000 }]).st;
    const r = giaiQuyetVong(st, THEO);

    const kqA = r.ketQua.ket_qua.find((k) => k.ghe_id === 'a')!;
    expect(kqA.nav_truoc).toBeGreaterThan(0);
    expect(kqA.nav_sau).toBeGreaterThan(0);
    const kyVong = Math.floor(
      ((kqA.nav_sau! - kqA.nav_truoc!) * 10000) / kqA.nav_truoc!);
    expect(kqA.pnl_bp).toBe(kyVong);
    expect(kqA.tien_theo_ma).toBeDefined();
    expect(typeof kqA.tien_theo_ma!.btc).toBe('number');
  });

  it('§7.3 — ENGINE THẬT SỰ PHÁT RA `brier`, không chỉ có hàm nằm đó', () => {
    /*
     * ⚠ Bài này tồn tại vì một lý do: `brierVong` có 10 bài test riêng và tất
     * cả đều xanh KỂ CẢ KHI không ai gọi nó. Đó đúng lớp "cơ chế trang trí"
     * repo dính 17 lần. Nên phải có một bài hỏi đúng câu *"nó có chảy ra tới
     * kết quả vòng không"* — không hỏi *"công thức có đúng không"*.
     */
    let st = taoTran(77, [ghe('a'), ghe('b'), ghe('c')], V10B);
    st = apLenhVongNav(st, 'a', [{ ma: 'btc', tien: 5000 }]).st;
    const r = giaiQuyetVong(st, THEO);

    const kqA = r.ketQua.ket_qua.find((k) => k.ghe_id === 'a')!;
    expect(typeof kqA.brier).toBe('number');
    expect(kqA.brier!).toBeGreaterThanOrEqual(0);
    expect(kqA.brier!).toBeLessThanOrEqual(2);

    /*
     * Ghế 'b' toàn tiền mặt ⇒ null, KHÔNG phải 0. Khoá luôn chỗ này vì 0 nghĩa
     * là "đoán hoàn hảo" — đọc nhầm thì người không bao giờ vào lệnh hoá ra
     * giỏi nhất bàn, tức thước đo ngược hẳn thứ nó sinh ra để đo.
     */
    const kqB = r.ketQua.ket_qua.find((k) => k.ghe_id === 'b')!;
    expect(kqB.brier).toBeNull();
  });

  it('ghế toàn tiền mặt: không mắt xích tiền nào, không mất kiểu 71%', () => {
    const st = taoTran(77, [ghe('a'), ghe('b'), ghe('c')], V10B);
    const r = giaiQuyetVong(st, THEO);
    const kqB = r.ketQua.ket_qua.find((k) => k.ghe_id === 'b')!;
    expect(Object.keys(kqB.tien_theo_ma ?? {})).toHaveLength(0);
    const b = r.trangThai.ghe.find((g) => g.id === 'b')!;
    expect(navCua(b)).toBeGreaterThan(HOLDEM_MATCH.START_VON - 1500);
  });

  it('phí giao dịch VÀO QUỸ VÒNG chứ không bốc hơi, và về 0 sau vòng', () => {
    let st = taoTran(31, [ghe('a'), ghe('b'), ghe('c')], V10B);
    st = apLenhVongNav(st, 'a', [{ ma: 'vang', tien: 3000 }]).st;   // trượt 18
    const phi = st.phi_giao_dich_vong ?? 0;
    expect(phi).toBe(18);
    const r = giaiQuyetVong(st, THEO);
    expect(r.ketQua.quy_vong).toBe(HOLDEM_MATCH.CAM_KET_NEN * 3 + phi);
    expect(r.trangThai.phi_giao_dich_vong).toBe(0);
  });

  it('bàn toàn tiền mặt: tổng NAV cả bàn chỉ đi XUỐNG — không tiền tự sinh', () => {
    let st = taoTran(55, [ghe('a'), ghe('b'), ghe('c')], V10B);
    for (let v = 0; v < 4; v++) {
      const truoc = st.ghe.reduce((x, g) => x + navCua(g), 0);
      const r = giaiQuyetVong(st, THEO);
      const sau = r.trangThai.ghe.reduce((x, g) => x + navCua(g), 0);
      expect(sau).toBeLessThanOrEqual(truoc);
      st = r.trangThai;
    }
  });

  it('cháy theo NAV: ngưỡng đọc từ config, vị thế TÍNH VÀO', () => {
    let st = taoTran(99, [ghe('a'), ghe('b'), ghe('c')], V10B);
    st = {
      ...st,
      // Van casual chỉ che vài vòng đầu — nhảy tới vòng cuối để đo luật thật.
      vong: st.map.o.length - 1,
      ghe: st.ghe.map((g) => (g.id === 'a'
        ? { ...g, von: 400, vi_the: { usd: 500 }, danh_muc: { ...g.danh_muc, tai_san: ['usd'] } }
        : g)),
    };
    const nguong = Math.floor(
      (HOLDEM_MATCH.START_VON * NAV_V10.NGUONG_CHAY_BP) / 10000);
    expect(400 + 500).toBeLessThan(nguong);
    const r = giaiQuyetVong(st, THEO);
    expect(r.trangThai.ghe.find((g) => g.id === 'a')!.da_chay).toBe(true);
  });

  it('trận v10a (nav TẮT): vi_the đứng im, không trường NAV nào xuất hiện', () => {
    const st = taoTran(77, [ghe('a'), ghe('b'), ghe('c')],
      luatCua('balance-v10a-tatcuoc'));
    const r = giaiQuyetVong(st, THEO);
    for (const g of r.trangThai.ghe) expect(Object.keys(g.vi_the)).toHaveLength(0);
    const kq = r.ketQua.ket_qua[0]!;
    expect(kq.nav_truoc).toBeUndefined();
    expect(kq.nav_sau).toBeUndefined();
  });
});
