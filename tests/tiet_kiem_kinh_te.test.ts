/**
 * v54 (D405) — SỔ TIẾT KIỆM CHỊU NỀN KINH TẾ: bài canh cho ba cờ founder chốt 25/09 (*"1 + 3 + 2"*, và *"2 phải hiếm"*).
 *
 *   1 · `tietKiemLamPhat` — lạm phát ăn tiền gốc trong sổ ĐÚNG như ăn tiền mặt (nền 150 bp/ô + cú sốc theo lá);
 *   3 · `tietKiemThaNoi`  — lãi mỗi ô tính lại theo lãi suất nền đang chạy (thay vì chốt lúc mở);
 *   2 · `nganHangDoVo`    — lá phá sản / cạn thanh khoản sau HAI lá xấu liền nhau ⇒ phần vượt hạn mức bảo hiểm mất 20%.
 *
 * Mỗi cờ BẬT TƯỜNG MINH trên nền v54 (đúng cả trước lẫn sau khi v54 bật chúng thật); vế "cờ tắt" là mũi tiêm ngược nằm
 * sẵn — trận đã lưu phải replay y cũ. ⚠ Số trong §I–§III tính TAY (A8.3). Ô cần dựng (vòng yên / vòng lạm phát / vòng
 * đổ vỡ) TÌM bằng quét seed trên bản đồ v54 THẬT, không sửa ô bằng tay (sửa ô lệch `trang_thai` của máy sinh bản đồ).
 */
import { describe, expect, it } from 'vitest';
import { laiMoiO, laiTietKiemBp, LAI_SUAT_NEN, luatCua, type BoLuatCanBang } from '../config/holdem.js';
import { laLaXau, matKhiDoVo, NGAN_HANG_DO_VO, nganHangDoVoTai } from '../config/tiet_kiem_kinh_te.js';
import {
  bpSuKienTienMat, choiVongCuoc, chotPhien, laiSuatLuc, taoTran,
  type GheMoi, type HopDongTietKiem, type QuyetDinhCuoc, type TrangThaiTran,
} from '../server/holdem/engine.js';

const V54 = 'balance-v54-ngare';
const ghe = (id: string): GheMoi => ({ id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } });
const BON_GHE: GheMoi[] = ['a', 'b', 'c', 'd'].map(ghe);
const luat = (co: Partial<BoLuatCanBang>): BoLuatCanBang => ({
  ...luatCua(V54), tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, ...co,
});
const theo: QuyetDinhCuoc = () => ({ loai: 'theo' });
const hd = (id: string, goc: number, lai_bp = 275, lai_don = 0): HopDongTietKiem => ({
  id, goc, vong_mo: 1, so_vong: 4, lai_bp, lai_don,
});

/** Trận v54 dừng ở vòng `vong`, ghế `a` gửi HẾT vào sổ (tiền mặt 0 ⇒ không nộp nền, không đụng quỹ). */
function dung(seed: number, vong: number, co: Partial<BoLuatCanBang>, so: HopDongTietKiem[]): TrangThaiTran {
  const st = taoTran(seed, BON_GHE, luat(co), 16);
  return {
    ...st, vong,
    ghe: st.ghe.map((g, i) => (i === 0 ? { ...g, von: 0, tiet_kiem: so.map((h) => ({ ...h, vong_mo: vong })) } : g)),
  };
}
const chot = (st: TrangThaiTran) => chotPhien(st, choiVongCuoc(st, theo));
const soSau = (r: ReturnType<typeof chot>) => r.trangThai.ghe[0]!.tiet_kiem ?? [];
const oChot = (st: TrangThaiTran) => st.map.o[st.o_up === true ? st.vong : st.vong - 1]!;

/** Quét (seed, vòng) trên bản đồ v54 THẬT tới khi gặp điều kiện. Vòng 2…12 ⇒ hợp đồng 4 ô còn chưa đáo hạn ở vòng chốt. */
function tim(dk: (st: TrangThaiTran) => boolean): { seed: number; vong: number } {
  for (let s = 1; s <= 4000; s += 1) {
    const seed = s * 7919;
    const st0 = taoTran(seed, BON_GHE, luat({}), 16);
    for (let vong = 2; vong <= 12; vong += 1) if (dk({ ...st0, vong })) return { seed, vong };
  }
  throw new Error('không tìm thấy ô cần dựng — bài này không được xanh rỗng');
}
const VONG_YEN = tim((st) => bpSuKienTienMat(st, oChot(st)).bpTong === 0);
const VONG_LAM_PHAT = tim((st) => bpSuKienTienMat(st, oChot(st)).bpTong < 0);
const VONG_DO_VO = tim((st) => nganHangDoVoTai(st.map.o, st.o_up === true ? st.vong : st.vong - 1));
/** Vòng mà lãi suất nền đã RỜI mức khởi điểm — không thì "thả nổi" và "đọc nhầm mức khởi điểm" ra cùng số (bài rỗng). */
const VONG_LAI_DOI = tim((st) => (laiSuatLuc(st) ?? LAI_SUAT_NEN.KHOI_DIEM) !== LAI_SUAT_NEN.KHOI_DIEM);

describe('I. LẠM PHÁT ĂN CẢ SỔ (`tietKiemLamPhat`)', () => {
  it('vế ngược — cờ tắt: vòng yên, gốc 10.000 nguyên, lãi 275 (sổ miễn lạm phát như trận đã lưu)', () => {
    const { seed, vong } = VONG_YEN;
    const so = soSau(chot(dung(seed, vong, {}, [hd('x', 10000)])));
    expect(so[0]).toMatchObject({ goc: 10000, lai_don: 275 });
  });

  it('⭐ cờ bật, vòng YÊN: gốc mất đúng lạm phát nền 150 ⇒ 9.850, lãi tính trên gốc sau lạm phát ⇒ ⌊9.850 × 2,75%⌋ = 270', () => {
    const { seed, vong } = VONG_YEN;
    const r = chot(dung(seed, vong, { tietKiemLamPhat: true }, [hd('x', 10000)]));
    expect(soSau(r)[0]).toMatchObject({ goc: 9850, lai_don: 270 });
    expect((r.ketQua.tiet_kiem ?? []).filter((x) => x.loai === 'lam_phat'))
      .toEqual([{ ghe_id: 'a', loai: 'lam_phat', id: 'x', goc: 9850, lai: 0, mat: 150 }]);
  });

  it('⭐ cờ bật, vòng có LÁ LẠM PHÁT: sổ ăn thêm đúng cú sốc tiền mặt, cùng thứ tự và cùng phép làm tròn', () => {
    const { seed, vong } = VONG_LAM_PHAT;
    const st = dung(seed, vong, { tietKiemLamPhat: true }, [hd('x', 10000)]);
    const bp = bpSuKienTienMat(st, oChot(st)).bpTong;
    expect(bp).toBeLessThan(0);
    const sauNen = 10000 - 150;
    const gocSau = sauNen - Math.floor((sauNen * Math.abs(bp)) / 10000);
    const so = soSau(chot(st));
    expect(so[0]!.goc).toBe(gocSau);
    expect(so[0]!.lai_don).toBe(laiMoiO(gocSau, 275));
    expect(gocSau).toBeLessThan(sauNen);
  });

  it('huỷ trước hạn trả GỐC ĐÃ BỊ LẠM PHÁT ĂN — không có cửa "huỷ để lấy lại gốc nguyên"', () => {
    const { seed, vong } = VONG_YEN;
    const r = chot(dung(seed, vong, { tietKiemLamPhat: true }, [hd('x', 10000)]));
    expect(soSau(r)[0]!.goc, 'gốc lưu trong sổ đã giảm — huỷ trả đúng số này').toBe(9850);
  });
});

describe('II. LÃI THẢ NỔI (`tietKiemThaNoi`)', () => {
  it('⭐ cờ bật: lãi ô này theo lãi suất nền ĐANG CHẠY (không theo mức chốt lúc mở); mức mới ghi lại vào hợp đồng', () => {
    const { seed, vong } = VONG_LAI_DOI;
    const st = dung(seed, vong, { tietKiemThaNoi: true }, [hd('x', 10000, 999)]);
    const bp = laiTietKiemBp(laiSuatLuc(st) ?? LAI_SUAT_NEN.KHOI_DIEM, 4);
    expect(bp).not.toBe(999);
    expect(bp, 'vòng dựng phải có lãi suất nền KHÁC mức khởi điểm').not.toBe(laiTietKiemBp(LAI_SUAT_NEN.KHOI_DIEM, 4));
    const so = soSau(chot(st));
    expect(so[0]).toMatchObject({ goc: 10000, lai_bp: bp, lai_don: laiMoiO(10000, bp) });
  });

  it('vế ngược — cờ tắt: lãi theo mức CHỐT LÚC MỞ (999 ⇒ 999 bp)', () => {
    const { seed, vong } = VONG_YEN;
    const so = soSau(chot(dung(seed, vong, {}, [hd('x', 10000, 999)])));
    expect(so[0]).toMatchObject({ lai_bp: 999, lai_don: 999 });
  });
});

describe('III. NGÂN HÀNG ĐỔ VỠ — HIẾM (`nganHangDoVo`)', () => {
  const G = (giai_doan: string) => ({ kind: 'giai_doan', giai_doan });
  const S = (su_kien: string) => ({ kind: 'su_kien', su_kien });

  it('lá xấu = hoảng loạn · pha giảm · cạn thanh khoản; lạm phát / lãi suất / bong bóng / đi ngang KHÔNG xấu', () => {
    expect([S('chien_tranh'), S('pha_san'), S('thien_nga_den'), G('giam'), S('hack_san')].every(laLaXau)).toBe(true);
    expect([S('lam_phat'), S('tang_lai_suat'), S('bong_bong'), G('di_ngang'), G('tang'), undefined].some(laLaXau)).toBe(false);
  });

  it('⭐ điều kiện: lá phá sản / cạn thanh khoản + HAI lá xấu liền trước; thiếu một lá là không', () => {
    expect(nganHangDoVoTai([G('giam'), S('chien_tranh'), S('pha_san')], 2)).toBe(true);
    expect(nganHangDoVoTai([G('giam'), G('giam'), S('hack_san')], 2)).toBe(true);
    expect(nganHangDoVoTai([G('di_ngang'), S('chien_tranh'), S('pha_san')], 2)).toBe(false);
    expect(nganHangDoVoTai([G('giam'), G('giam'), S('lam_phat')], 2)).toBe(false);
    expect(nganHangDoVoTai([S('chien_tranh'), S('pha_san')], 1), 'đầu bàn không đủ hai lá trước').toBe(false);
  });

  it('⭐ tin GIẢ vẫn kích hoạt (mặt chữ — dân rút theo tin đồn; tính theo thật/giả là lộ `la_tin_gia` sớm)', () => {
    expect(nganHangDoVoTai([G('giam'), G('giam'), { ...S('pha_san'), la_tin_gia: true } as never], 2)).toBe(true);
  });

  it('⭐ HIẾM thật: 2.000 bản đồ v54 bàn 16 ⇒ 2%–10% số trận có ít nhất một lần (đếm 20.000 bản đồ: 5,0%)', () => {
    let tran = 0;
    for (let s = 1; s <= 2000; s += 1) {
      const st = taoTran(s * 104729, BON_GHE, luat({}), 16);
      let co = false;
      for (let n = 1; n < st.map.o.length && !co; n += 1) co = nganHangDoVoTai(st.map.o, n);
      if (co) tran += 1;
    }
    expect(tran / 2000).toBeGreaterThan(0.02);
    expect(tran / 2000).toBeLessThan(0.10);
  });

  it('matKhiDoVo: tổng 12.000, hạn mức 5.000 ⇒ vượt 7.000 × 20% = 1.400; dưới hạn mức ⇒ 0', () => {
    expect(NGAN_HANG_DO_VO.BAO_HIEM_TOI_DA).toBe(5000);
    expect(NGAN_HANG_DO_VO.MAT_BP).toBe(2000);
    expect(matKhiDoVo(12000)).toBe(1400);
    expect(matKhiDoVo(5000)).toBe(0);
    expect(matKhiDoVo(4200)).toBe(0);
  });

  it('⭐ cờ bật, vòng đổ vỡ: hai sổ 8.000 + 4.000 mất 1.400 chia theo tỷ lệ — 933 · 467 (dư lẻ vào sổ cuối); lãi tính SAU', () => {
    const { seed, vong } = VONG_DO_VO;
    const r = chot(dung(seed, vong, { nganHangDoVo: true }, [hd('x', 8000), hd('y', 4000)]));
    const so = soSau(r);
    expect(so.map((h) => h.goc)).toEqual([8000 - 933, 4000 - 467]);
    expect(so.map((h) => h.lai_don)).toEqual([laiMoiO(7067, 275), laiMoiO(3533, 275)]);
    expect((r.ketQua.tiet_kiem ?? []).filter((x) => x.loai === 'do_vo').map((x) => [x.id, x.mat]))
      .toEqual([['x', 933], ['y', 467]]);
  });

  it('cờ bật, vòng đổ vỡ, tổng sổ DƯỚI hạn mức ⇒ không mất gì (bảo hiểm che trọn)', () => {
    const { seed, vong } = VONG_DO_VO;
    const so = soSau(chot(dung(seed, vong, { nganHangDoVo: true }, [hd('x', 4800)])));
    expect(so[0]!.goc).toBe(4800);
  });

  it('vế ngược — cờ tắt: cùng vòng đổ vỡ, sổ nguyên', () => {
    const { seed, vong } = VONG_DO_VO;
    const so = soSau(chot(dung(seed, vong, {}, [hd('x', 8000), hd('y', 4000)])));
    expect(so.map((h) => h.goc)).toEqual([8000, 4000]);
  });

  it('cờ bật, vòng YÊN (không đủ điều kiện) ⇒ sổ nguyên', () => {
    const { seed, vong } = VONG_YEN;
    const st = dung(seed, vong, { nganHangDoVo: true }, [hd('x', 12000)]);
    expect(nganHangDoVoTai(st.map.o, st.o_up === true ? st.vong : st.vong - 1)).toBe(false);
    expect(soSau(chot(st))[0]!.goc).toBe(12000);
  });
});
