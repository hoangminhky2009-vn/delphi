/**
 * D584 — GIẢI VÒNG TRẢ BẰNG XU TRAIT (khoá balance-v68-giaixu; founder 10/10 *"Thay bằng xu trait nhé"*).
 * Canh: khoá mới = v67 + đúng một cờ · không thu nền, không hũ tiền (NAV không nhận một đồng nào từ giải) · ghế còn tranh xếp theo lãi/lỗ vòng,
 * suất k nhận `xuGiaiTheoHang(k)` xu trait · khoá cũ vẫn chia tiền như cũ.
 */
import { describe, expect, it } from 'vitest';
import { luatCua, trongSoQuyVong, xuGiaiTheoHang, tongXuGiai, GIAI_XU, phanViBang, XEP_HANG_E_V67, XEP_HANG_E_V68 } from '../config/holdem.js';
import { diemCachE, giaiQuyetVong, maxTaiSanCua, nenVongCua, taoTran, tyLeCua, type Ghe, type TrangThaiTran } from '../server/holdem/engine.js';
import { BOT_CHOI_DUOC, botTaiCoCau, type BoiCanh } from '../server/holdem/bots.js';
import { bayShop } from '../server/holdem/shop.js';
import { oCongKhai } from '../server/holdem/map.js';

const V68 = luatCua('balance-v68-giaixu');
const V67 = luatCua('balance-v67-boicanh');

/** Một vòng bot thật (vòng chơi của gate) — trả kết quả `chotPhien`. */
function motVong(luat: typeof V68, seed: number) {
  const bots = Array.from({ length: 5 }, (_, i) => BOT_CHOI_DUOC[(seed + i) % BOT_CHOI_DUOC.length]!);
  let st: TrangThaiTran = taoTran(seed, bots.map((b, i) => ({ id: `g${i}`, loai: 'bot' as const, bac_rank: 'Bạc', bot_id: b.id, danh_muc: { tai_san: [], chien_thuat: [] } })) as never, luat, 14);
  const o = st.map.o[st.vong - 1]!;
  const ctx = (g: Ghe): BoiCanh => ({
    seed, vong: st.vong, o: oCongKhai(o) as never, oThat: o, oTruoc: st.map.o[st.vong - 2], ghe: g,
    shop: bayShop(seed, st.vong, g.id, 0, g.danh_muc, { loiGon: st.loi_gon === true }), loiGon: st.loi_gon === true,
    soNguoiSong: st.ghe.length, maxTaiSan: maxTaiSanCua(st, g), ...tyLeCua(st, st.vong),
  });
  st = { ...st, ghe: st.ghe.map((g, i) => ({ ...g, danh_muc: botTaiCoCau(bots[i]!, ctx(g)).danh_muc })) };
  const truoc = st;
  const r = giaiQuyetVong(st, (c) => bots[st.ghe.findIndex((x) => x.id === c.ghe_id)]!.chonCuoc(c, ctx(st.ghe.find((x) => x.id === c.ghe_id)!)));
  return { truoc, r };
}

describe('D584 — giải vòng bằng xu trait', () => {
  it('khoá v68 = v67 + ĐÚNG một cờ `giaiXu`', () => {
    const a = V67 as unknown as Record<string, unknown>, b = V68 as unknown as Record<string, unknown>;
    expect(Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k])).toEqual(['giaiXu']);
  });

  it('⭐ không thu nền · hũ tiền 0 · không ai nhận TIỀN từ giải; suất k của bảng lãi/lỗ vòng nhận đúng `xuGiaiTheoHang(k)` xu', () => {
    let soVong = 0;
    for (let seed = 101; seed < 141; seed++) {
      const { truoc, r } = motVong(V68, seed);
      expect(nenVongCua(truoc)).toBe(0);
      expect(r.ketQua.quy_vong).toBe(0);
      const cq = r.chiaQuy ?? [];
      expect(cq.every((x) => x.tien === 0 && (x.xu ?? 0) > 0)).toBe(true);
      // Xếp theo lãi/lỗ vòng giảm dần: hạng k có pnl ≥ hạng k+1.
      const pnl = new Map(r.ketQua.ket_qua.map((k) => [k.ghe_id, k.pnl_bp]));
      for (let k = 1; k < cq.length; k++) expect(pnl.get(cq[k - 1]!.ghe_id)!).toBeGreaterThanOrEqual(pnl.get(cq[k]!.ghe_id)!);
      expect(cq.map((x) => x.xu)).toEqual(cq.map((x) => xuGiaiTheoHang(x.hang)));
      expect(cq.length).toBe(trongSoQuyVong(truoc.ghe.length, truoc.quy_co_gian === true).length);
      // Xu thật sự vào ghế (cộng thêm phần lửa / nhiệm vụ lõi của chính vòng ấy — so với cùng vòng ở khoá v67).
      const sau = new Map(r.trangThai.ghe.map((g) => [g.id, g.xu ?? 0]));
      const { r: r67 } = motVong(V67, seed);
      const sau67 = new Map(r67.trangThai.ghe.map((g) => [g.id, g.xu ?? 0]));
      for (const x of cq) expect(sau.get(x.ghe_id)! - sau67.get(x.ghe_id)!, `seed ${seed} ${x.ghe_id}`).toBe(x.xu);
      soVong += 1;
    }
    expect(soVong).toBe(40);
  });

  it('⭐ xếp hạng cách E của trận v68 TẠM đọc bảng v67 (founder 11/10 A — bảng đúng của v68 làm G1 đỏ), không bảng đo v68', () => {
    const { truoc } = motVong(V68, 3);
    const e = diemCachE(truoc);   // đầu trận: mọi ghế tăng trưởng 0 = trung vị
    for (const id of Object.keys(e)) expect(e[id]).toBe(phanViBang(XEP_HANG_E_V67.ca_nhan, 0));
    expect(phanViBang(XEP_HANG_E_V68.ca_nhan, 0), 'hai bảng cho cùng điểm ⇒ bài không phân biệt được').not.toBe(phanViBang(XEP_HANG_E_V67.ca_nhan, 0));
  });

  it('khoá cũ (v67) vẫn chia TIỀN: hũ > 0, suất có tiền, không trường xu; tổng xu giải bàn 5 = 3 + 2 + 1', () => {
    const { r } = motVong(V67, 7);
    expect(r.ketQua.quy_vong).toBeGreaterThan(0);
    expect((r.chiaQuy ?? []).every((x) => x.tien > 0 && x.xu === undefined)).toBe(true);
    expect(tongXuGiai(5, true)).toBe(GIAI_XU.XU_THEO_HANG.slice(0, 3).reduce((a, b) => a + b, 0));
  });
});
