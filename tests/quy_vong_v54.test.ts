/**
 * v54 (D403) — QUỸ VÒNG HẾT "NGỒI IM ĂN TRỌN": bài canh cho ba cờ founder chốt 24–25/09.
 *
 * Founder gửi ảnh vòng +38,6% NAV (gần cả bàn CẮT ⇒ một ghế ngồi yên ăn trọn quỹ 4.374) rồi chọn C (A + B) và gỡ nút
 * BỎ. Ba cờ: `boBaiTat` · `quyTheoCoBan` (B) · `quyTranHang1` (A). Bài dựng luật bằng cách BẬT TƯỜNG MINH từng cờ trên
 * nền v54 — nên nó đúng cả trước lẫn sau khi v54 bật chúng; vế "cờ tắt" là mũi tiêm ngược nằm sẵn (trận đã lưu
 * phải replay y cũ).
 *
 * ⚠ Số trong §I tính TAY (A8.3 — đụng tiền: vector trước, code sau). Đổi hàm mà số lệch ⇒ sửa hàm, không sửa số.
 */
import { describe, expect, it } from 'vitest';
import { HOLDEM_MATCH, luatCua, type BoLuatCanBang } from '../config/holdem.js';
import {
  choiVongCuoc, chotPhien, kepTranHang1, nenVongCua, taoTran, type GheMoi, type QuyetDinhCuoc,
} from '../server/holdem/engine.js';

const V54 = 'balance-v54-ngare';
const ghe = (id: string): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] },
});
const banGhe = (n: number): GheMoi[] => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].slice(0, n).map(ghe);
const luat = (co: Partial<BoLuatCanBang>): BoLuatCanBang => ({
  ...luatCua(V54), boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, ...co,
});
const theo: QuyetDinhCuoc = () => ({ loai: 'theo' });

describe('I. kepTranHang1 — hàm thuần, vector tính tay', () => {
  it('⭐ ca founder: 8 ghế × 500 + phí 374 = 4.374, CHỈ MỘT ghế tranh ⇒ ghế đó 2.187, bảy ghế kia hoàn 2.187 theo góp', () => {
    const gop = new Map(['ban', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'].map((id) => [id, 500] as const));
    const ra = kepTranHang1(new Map([['ban', 4374]]), 4374, gop);
    // trần = ⌊4.374 × 5.000 ÷ 10.000⌋ = 2.187; thừa 2.187 chia 7 ghế góp 500: ⌊2.187 × 500 ÷ 3.500⌋ = 312, dư 3
    // ⇒ ba ghế đầu theo (góp giảm, id tăng) = b1 · b2 · b3 thêm 1 chip.
    expect(Object.fromEntries(ra)).toEqual({
      ban: 2187, b1: 313, b2: 313, b3: 313, b4: 312, b5: 312, b6: 312, b7: 312,
    });
    expect([...ra.values()].reduce((s, x) => s + x, 0), 'tiền cân — không chip nào cháy').toBe(4374);
  });

  it('hai ghế tranh [62,5% · 37,5%] ⇒ hạng 1 kẹp 50%, phần vượt về ghế kia ⇒ 500/500', () => {
    const ra = kepTranHang1(new Map([['a', 625], ['b', 375]]), 1000, new Map([['a', 500], ['b', 500]]));
    expect(Object.fromEntries(ra)).toEqual({ a: 500, b: 500 });
  });

  it('ba ghế tranh [50 · 30 · 20] ⇒ KHÔNG chạm chip nào (hạng 1 đúng bằng trần, không vượt)', () => {
    const vao = new Map([['a', 750], ['b', 450], ['c', 300]]);
    expect(Object.fromEntries(kepTranHang1(vao, 1500, new Map([['a', 500], ['b', 500], ['c', 500]]))))
      .toEqual({ a: 750, b: 450, c: 300 });
  });

  it('dư lẻ do làm tròn: 2.501 ⇒ hạng 1 nhận 1.251 > trần 1.250 ⇒ 1 chip về ghế góp nhiều nhất còn lại', () => {
    const ra = kepTranHang1(
      new Map([['a', 1251], ['b', 750], ['c', 500]]), 2501, new Map([['a', 834], ['b', 834], ['c', 833]]));
    expect(Object.fromEntries(ra)).toEqual({ a: 1250, b: 751, c: 500 });
  });

  it('ghế bị kẹp là NGƯỜI GÓP DUY NHẤT ⇒ không ai để trả ⇒ phần vượt ở lại với nó (tiền không cháy)', () => {
    expect(Object.fromEntries(kepTranHang1(new Map([['a', 1000]]), 1000, new Map([['a', 1000]]))))
      .toEqual({ a: 1000 });
  });

  it('người bỏ bài VẪN được hoàn (tiền họ nằm trong pot) — hoàn theo tỷ lệ góp, không chia đều', () => {
    // a tranh một mình; b góp 600, c góp 200 (đã bỏ) ⇒ pot 1.300, trần 650, thừa 650 → b 487 · c 162, dư 1 → b.
    const ra = kepTranHang1(new Map([['a', 1300]]), 1300, new Map([['a', 500], ['b', 600], ['c', 200]]));
    expect(Object.fromEntries(ra)).toEqual({ a: 650, b: 488, c: 162 });
  });

  it('không sửa map đầu vào', () => {
    const vao = new Map([['a', 1000]]);
    kepTranHang1(vao, 1000, new Map([['a', 500], ['b', 500]]));
    expect(vao.get('a')).toBe(1000);
  });
});

describe('II. nenVongCua — QUỸ THEO CỠ BÀN (phương án B)', () => {
  it('⭐ cờ bật: nền = ⌊500 × 5 ÷ số ghế⌋ ⇒ 4:625 · 5:500 · 6:416 · 7:357 · 8:312 — quỹ ≈ 2.500 mọi cỡ bàn', () => {
    const nen = [4, 5, 6, 7, 8].map((n) => nenVongCua(taoTran(7, banGhe(n), luat({ quyTheoCoBan: true }), 16)));
    expect(nen).toEqual([625, 500, 416, 357, 312]);
  });

  it('vế ngược — cờ tắt: nền phẳng CAM_KET_NEN ở mọi cỡ bàn (trận đã lưu replay y cũ)', () => {
    for (const n of [4, 5, 6, 7, 8]) {
      expect(nenVongCua(taoTran(7, banGhe(n), luat({}), 16)), `bàn ${n}`).toBe(HOLDEM_MATCH.CAM_KET_NEN);
    }
  });

  it('⭐ vòng cược THẬT thu đúng nền đó: bàn 8 quỹ 8 × 312 + phí; cờ tắt 8 × 500 + phí', () => {
    const quy = (co: Partial<BoLuatCanBang>): number => {
      const st = { ...taoTran(7, banGhe(8), luat(co), 16), phi_giao_dich_vong: 300 };
      return chotPhien(st, choiVongCuoc(st, theo)).ketQua.quy_vong;
    };
    expect(quy({ quyTheoCoBan: true })).toBe(8 * 312 + 300);
    expect(quy({})).toBe(8 * HOLDEM_MATCH.CAM_KET_NEN + 300);
  });

  it('nền theo số ghế LÚC DỰNG BÀN — ghế cháy không làm nền của ghế còn lại tăng', () => {
    const st = taoTran(7, banGhe(8), luat({ quyTheoCoBan: true }), 16);
    const chay = { ...st, ghe: st.ghe.map((g, i) => (i < 3 ? { ...g, da_chay: true } : g)) };
    expect(nenVongCua(chay)).toBe(312);
  });
});

describe('III. BỎ BÀI TẮT — không ai bỏ được, nút và bot cùng một danh sách', () => {
  /** Ghế nào cũng đòi bỏ; ghi lại danh sách `duoc` engine trao cho mỗi lượt. */
  const doiBo = (): { qd: QuyetDinhCuoc; duoc: string[][] } => {
    const duoc: string[][] = [];
    return { qd: (ctx) => { duoc.push([...ctx.duoc]); return { loai: 'bo' }; }, duoc };
  };

  it("⭐ cờ bật: 'bo' không có trong `duoc` của lượt nào; ai đòi 'bo' thành THEO ⇒ không ghế nào rời pot", () => {
    const st = taoTran(7, banGhe(6), luat({ boBaiTat: true }), 16);
    const { qd, duoc } = doiBo();
    const tt = choiVongCuoc(st, qd);
    expect(duoc.length).toBeGreaterThan(0);
    expect(duoc.some((d) => d.includes('bo'))).toBe(false);
    expect(tt.daBo.size).toBe(0);
    const r = chotPhien(st, tt);
    expect(r.ketQua.quy_vong).toBe(6 * HOLDEM_MATCH.CAM_KET_NEN);
    expect(r.ketQua.ket_qua.every((k) => k.da_cat_lo !== true)).toBe(true);
  });

  it("vế ngược — cờ tắt: 'bo' còn trong `duoc` và được thi hành (quota vòng 1 còn)", () => {
    const st = taoTran(7, banGhe(6), luat({}), 16);
    const { qd, duoc } = doiBo();
    const tt = choiVongCuoc(st, qd);
    expect(duoc.every((d) => d.includes('bo'))).toBe(true);
    // 5 chứ không 6: năm ghế bỏ xong thì vòng đóng — người cuối còn lại không bị hỏi (luật poker, `daDongVong`).
    expect(tt.daBo.size).toBe(5);
  });
});

describe('IV. TRẦN PHẦN MỘT GHẾ trong engine (phương án A) — qua `chotPhien`, đúng số hàm thuần', () => {
  /** a THEO, mọi ghế khác BỎ ⇒ pot chính chỉ một người tranh (cần BỎ còn sống ⇒ `boBaiTat` tắt). */
  const motNguoiTranh: QuyetDinhCuoc = (ctx) => (ctx.ghe_id === 'a' ? { loai: 'theo' } : { loai: 'bo' });
  const chiaCua = (co: Partial<BoLuatCanBang>) => {
    const st = taoTran(7, banGhe(8), luat(co), 16);
    const r = chotPhien(st, choiVongCuoc(st, motNguoiTranh));
    return { quy: r.ketQua.quy_vong, chia: Object.fromEntries((r.chiaQuy ?? []).map((x) => [x.ghe_id, x.tien])) };
  };

  it('⭐ cờ bật: a nhận 2.000 (50% của 4.000), bảy ghế bỏ được hoàn 2.000 theo góp 500 — 286 × 5 · 285 × 2', () => {
    const { quy, chia } = chiaCua({ quyTranHang1: true });
    expect(quy).toBe(4000);
    expect(chia).toEqual({ a: 2000, b: 286, c: 286, d: 286, e: 286, f: 286, g: 285, h: 285 });
  });

  it('vế ngược — cờ tắt: a ăn trọn 4.000 (đúng ca founder bắt)', () => {
    expect(chiaCua({}).chia).toEqual({ a: 4000 });
  });

  it('⭐ cả ba cờ cùng bật, cả bàn THEO: tổng chia = quỹ, không ghế nào quá 50%, không ai rời pot', () => {
    for (const seed of [7, 11, 29, 101, 4242]) {
      const st = { ...taoTran(seed, banGhe(8), luat({ boBaiTat: true, quyTheoCoBan: true, quyTranHang1: true }), 16),
        phi_giao_dich_vong: 137 };
      const r = chotPhien(st, choiVongCuoc(st, (ctx) => (ctx.ghe_id === 'a' ? { loai: 'theo' } : { loai: 'bo' })));
      const chia = r.chiaQuy ?? [];
      expect(r.ketQua.quy_vong, `seed ${seed}`).toBe(8 * 312 + 137);
      expect(chia.reduce((s, x) => s + x.tien, 0), `seed ${seed}`).toBe(r.ketQua.quy_vong);
      expect(Math.max(...chia.map((x) => x.tien)), `seed ${seed}`).toBeLessThanOrEqual(Math.floor(r.ketQua.quy_vong / 2));
    }
  });
});
