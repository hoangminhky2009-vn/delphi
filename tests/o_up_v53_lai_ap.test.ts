/**
 * LÃI SUẤT ÁP CHO VÒNG ở luật ô úp — tách từ `o_up_v53.test.ts` §III ngày 10/10 (cửa sổ CI xanh).
 *
 * Ý định của v53 (D373): ô của vòng còn úp ⇒ người chơi thấy mức TRƯỚC kỳ họp, còn engine định giá vòng bằng mức SAU
 * kỳ họp của chính lá quyết toán. D382 (22/09) dời lá quyết toán vòng N từ `o[N−1]` sang `o[N]` (và đã dời
 * `nganHangDoVoTai` theo), nhưng `laiSuatLuc` vẫn đọc `trang_thai[vong − 1]` — mức của lá ĐÃ LẬT cuối. Hệ quả: kỳ họp
 * lật cuối vòng N thì coupon · lãi tiết kiệm thả nổi · lãi đòn bẩy · độ sâu thanh khoản chỉ đổi từ vòng N+1. Đúng hành vi
 * mọi trận v53 → v65 đang chạy, golden ghim nguyên.
 *
 * Founder 10/10 chọn B: lỗi D382 bỏ sót. Chữa bằng KHOÁ MỚI (cửa sổ minigame, đo gate); v53–v65 GIỮ hành vi trễ để replay
 * trận cũ (A11.3).
 *
 * D566 — khoá `balance-v66-laiap` (cờ `laiApLaQuyetToan`) chữa. Bài tách HAI vế, ra khỏi sổ cách ly:
 *   · KHOÁ CŨ (mọi khoá ô úp chưa bật cờ, quét `BO_LUAT_THEO_PHIEN_BAN`) — ghim mức TRỄ 325 cho replay;
 *   · KHOÁ MỚI (mọi khoá bật cờ) — đòi mức của lá quyết toán 400, và mức nhìn thấy / coupon của bot vẫn 325 (không rò).
 */
import { describe, expect, it } from 'vitest';
import {
  coV42ChoBot, couponBpCua, laiSuatLuc, laiSuatThayDuoc, taoTran, type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { BO_LUAT_THEO_PHIEN_BAN, couponBp, LAI_SUAT_NEN, luatCua } from '../config/holdem.js';
import type { OThiTruong, TrangThaiO } from '../server/holdem/map.js';

const gd = (g: 'tang' | 'di_ngang'): OThiTruong => ({ kind: 'giai_doan', giai_doan: g });
const tt = (lai: number = LAI_SUAT_NEN.KHOI_DIEM, oLich = false): TrangThaiO => ({
  giai_doan_nen: 'di_ngang', run_huong: 0, run_dai: 1, face_prior_bp: 5000,
  suc_cang_bp: [0, 0, 0, 0, 0, 0], o_lich: oLich, lai_suat_diem: lai, tail_face: null,
});
const GHE: readonly GheMoi[] = [
  { id: 'ban', loai: 'nguoi', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } },
  { id: 'b1', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } },
];

/** Vòng 1 luật ô úp: `o[0]` lá mở màn (mức 325) đã lật; `o[1]` KỲ HỌP (mức sau họp 400) là lá quyết toán, còn úp. */
function banHop(khoa: string): TrangThaiTran {
  const st = taoTran(4242, GHE, { ...luatCua(khoa) });
  return {
    ...st,
    map: { ...st.map, o: [gd('tang'), gd('di_ngang'), gd('di_ngang')], trang_thai: [tt(325), tt(400, true), tt(400)] },
    vong: 1,
  };
}

/** Khoá ô úp có bật lãi nền, chia theo cờ D566 — quét bảng, không liệt tay (khoá N+1 ra đời tự vào đúng vế). */
const KHOA_O_UP = Object.entries(BO_LUAT_THEO_PHIEN_BAN)
  .filter(([, l]) => l.oUp === true && l.laiSuatNen === true);
const KHOA_CU = KHOA_O_UP.filter(([, l]) => l.laiApLaQuyetToan !== true).map(([k]) => k);
const KHOA_MOI = KHOA_O_UP.filter(([, l]) => l.laiApLaQuyetToan === true).map(([k]) => k);

describe('lãi suất áp cho vòng ở luật ô úp — khoá cũ trễ (replay), khoá v66 theo lá quyết toán (D373 · D382 · D566)', () => {
  it('bảng có cả hai vế: v53 · v65 ở vế cũ, v66 ở vế mới', () => {
    expect(KHOA_CU).toEqual(expect.arrayContaining(['balance-v53-upo', 'balance-v65-thangkynang']));
    expect(KHOA_MOI).toContain('balance-v66-laiap');
  });

  it.each(KHOA_CU)('%s (khoá cũ): engine áp mức TRỄ — mức lá đã lật cuối (325), y như trận đã lưu', (khoa) => {
    const st = banHop(khoa);
    expect(laiSuatThayDuoc(st)).toBe(325);
    expect(laiSuatLuc(st)).toBe(325);
  });

  it.each(KHOA_MOI)('%s (khoá mới): người thấy mức trước họp (325), engine định giá vòng bằng mức sau họp (400)', (khoa) => {
    const st = banHop(khoa);
    expect(laiSuatThayDuoc(st)).toBe(325);
    expect(laiSuatLuc(st)).toBe(400);
  });

  it.each(KHOA_MOI)('%s (khoá mới): coupon engine theo 400, coupon trong bối cảnh bot theo mức nhìn thấy 325 (kỳ họp úp không rò)', (khoa) => {
    const st = banHop(khoa);
    const cong = st.duong_cong === true;
    expect(couponBp(325, cong)).not.toBe(couponBp(400, cong));   // phép đo có răng: hai mức cho hai coupon khác nhau
    expect(couponBpCua(st)).toBe(couponBp(400, cong));
    expect(coV42ChoBot(st).coupon_bp).toBe(couponBp(325, cong));
  });
});
