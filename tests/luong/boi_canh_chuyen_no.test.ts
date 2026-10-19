/**
 * LUỒNG — trận "Lên + Nới" chuyển Căng rồi vỡ nợ (SPEC `docs/spec/boi-canh-dai-han.md` §5 "kịch bản luồng", D574).
 *
 * Trận trọn 13 vòng trên khoá v67 bằng engine thật + bot thật (vòng chơi của `scripts/holdem_montecarlo.ts`): kỳ họp chuyển nợ TĂNG thật ⇒ mức
 * lãi người chơi THẤY lên sau khi kỳ họp lật ⇒ từ ô sau bối cảnh là "Lên + Căng" ⇒ vài ô sau là gấu chu kỳ (vỡ nợ) ⇒ trận vẫn chốt hết, không ghế
 * nào NAV âm/NaN. ⚠ Tầng engine, không qua API: API chỉ tạo trận ở khoá mặc định, v67 chưa mặc định — bản qua API viết lúc lật mặc định.
 */
import { describe, expect, it } from 'vitest';
import { LICH_CHINH_SACH, luatCua, phanViBang, XEP_HANG_E, XEP_HANG_E_V67 } from '../../config/holdem.js';
import {
  daKetThuc, diemCachE, giaiQuyetVong, laiSuatThayDuoc, maxTaiSanCua, tangTruongBp, taoTran, tyLeCua, viKhaoSat, ghiViKhaoSat, type Ghe, type TrangThaiTran,
} from '../../server/holdem/engine.js';
import { BOT_CHOI_DUOC, botTaiCoCau, type BoiCanh } from '../../server/holdem/bots.js';
import { bayShop } from '../../server/holdem/shop.js';
import { oCongKhai } from '../../server/holdem/map.js';
import { navCua } from '../../server/holdem/nav.js';
import { boiCanhDaiHan } from '../../server/holdem/boi_canh_dai_han.js';

const V67 = luatCua('balance-v67-boicanh');
const LICH = LICH_CHINH_SACH.O_THEO_MAP[14]!;

/** Seed "Lên + Nới" có chuyển nợ mà map mở gấu chu kỳ sau kỳ họp. */
function timSeed(n: number): number[] {
  const ra: number[] = [];
  for (let s = 0x1c000000; ra.length < n && s < 0x1c000000 + 4000; s++) {
    const b = boiCanhDaiHan(s, LICH);
    if (b.song !== 'len' || b.no !== 'noi' || b.chuyen_no === undefined) continue;
    const tt = taoTran(s, [], V67, 14).map.trang_thai!;
    if (tt.some((t, i) => i >= b.chuyen_no! && t.loai_mua === 'gau_chu_ky')) ra.push(s);
  }
  return ra;
}

function choiTron(seed: number): TrangThaiTran[] {
  const bots = Array.from({ length: 5 }, (_, i) => BOT_CHOI_DUOC[(seed + i) % BOT_CHOI_DUOC.length]!);
  let st = taoTran(seed, bots.map((b, i) => ({ id: `g${i}`, loai: 'bot' as const, bac_rank: 'Bạc', bot_id: b.id, danh_muc: { tai_san: [], chien_thuat: [] } })) as never, V67, 14);
  const lich: TrangThaiTran[] = [st];
  for (let guard = 0; !daKetThuc(st) && guard < 40; guard++) {
    const o = st.map.o[st.vong - 1]!;
    const ctxCua = (g: Ghe): BoiCanh => ({
      seed, vong: st.vong, o: oCongKhai(o) as never, oThat: o, oTruoc: st.map.o[st.vong - 2], ghe: g,
      shop: bayShop(seed, st.vong, g.id, 0, g.danh_muc, { loiGon: st.loi_gon === true }), loiGon: st.loi_gon === true,
      soNguoiSong: st.ghe.filter((x) => !x.da_chay).length, maxTaiSan: maxTaiSanCua(st, g), ...tyLeCua(st, st.vong),
    });
    st = { ...st, ghe: st.ghe.map((g, i) => {
      if (g.da_chay) return g;
      const r = botTaiCoCau(bots[i]!, { ...ctxCua(g), ghe: { ...g, luot_khao_sat: viKhaoSat(st, g) } });
      return { ...ghiViKhaoSat(st, g, r.luot_khao_sat), danh_muc: r.danh_muc };
    }) };
    st = giaiQuyetVong(st, (cuoc) => bots[st.ghe.findIndex((x) => x.id === cuoc.ghe_id)]!.chonCuoc(cuoc, ctxCua(st.ghe.find((x) => x.id === cuoc.ghe_id)!))).trangThai;
    lich.push(st);
  }
  return lich;
}

describe('D574 — luồng: Lên + Nới → kỳ họp TĂNG chuyển Căng → gấu chu kỳ', () => {
  const seeds = timSeed(3);
  it('có đủ trận mẫu', () => { expect(seeds).toHaveLength(3); });

  for (const seed of seeds) {
    it(`seed ${seed}: lãi thấy được lên sau kỳ họp chuyển · bối cảnh Lên + Căng từ ô sau · gấu chu kỳ lật trong trận · trận chốt hết, NAV hữu hạn`, () => {
      const b = boiCanhDaiHan(seed, LICH);
      const lich = choiTron(seed);
      const cuoi = lich[lich.length - 1]!;
      expect(daKetThuc(cuoi)).toBe(true);
      const tt = cuoi.map.trang_thai!;
      const k = b.chuyen_no! - 1;   // chỉ số ô kỳ họp
      expect(tt[k]!.huong_cs_thuc).toBe('tang');
      expect(tt[k + 1]!.boi_canh_dh).toBe('len_cang');
      // Mức người chơi thấy: trước khi lá kỳ họp lật < sau khi lật (một vòng sau).
      const truoc = lich.find((s) => s.vong === k)!, sau = lich.find((s) => s.vong === k + 1)!;
      expect(laiSuatThayDuoc(sau)!).toBeGreaterThan(laiSuatThayDuoc(truoc)!);
      // Gấu chu kỳ lật thành lá pha GIẢM ở một ô sau kỳ họp.
      expect(cuoi.map.o.some((x, i) => i > k && x.kind === 'giai_doan' && x.giai_doan === 'giam' && x.tinh_chat === 'gau_chu_ky')).toBe(true);
      for (const g of cuoi.ghe) expect(Number.isFinite(navCua(g)) && navCua(g) >= 0, g.id).toBe(true);
    });
  }

  it('⭐ xếp hạng cách E của trận v67 đọc BẢNG RIÊNG của khoá (founder A — tách bảng lúc lật), không bảng chung v65/v66', () => {
    let khac = 0;
    for (const seed of seeds) {
      const cuoi = choiTron(seed).at(-1)!;
      const tt = cuoi.ghe.map((g) => tangTruongBp(cuoi, g)).sort((a, b) => a - b);
      const giua = tt.length % 2 ? tt[(tt.length - 1) / 2]! : (tt[tt.length / 2 - 1]! + tt[tt.length / 2]!) / 2;
      const e = diemCachE(cuoi);
      for (const g of cuoi.ghe) {
        const vai = (g.vai ?? 'ca_nhan') as keyof typeof XEP_HANG_E;
        expect(e[g.id]).toBe(phanViBang(XEP_HANG_E_V67[vai], tangTruongBp(cuoi, g) - giua));
        if (phanViBang(XEP_HANG_E[vai], tangTruongBp(cuoi, g) - giua) !== e[g.id]) khac += 1;
      }
    }
    expect(khac, 'có ghế mà bảng chung cho điểm khác — bài phân biệt được hai bảng').toBeGreaterThan(0);
  });
});
