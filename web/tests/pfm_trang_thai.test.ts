/**
 * PFM — LỘ TRÌNH ĐỌC SỔ (D325). Trước D325 chặng 1 ghép khối CHỈ từ sáu câu phỏng vấn: người
 * đã mở ba hũ và người chưa mở hũ nào nhận cùng một lộ trình.
 *  §I   `trangThaiTaiChinh` đếm đúng — chỉ hũ ĐANG MỞ, nhịp từ nhãn câu 2, nhãn lạ ⇒ `chua_ro`;
 *  §II  ba khối trạng thái hiện ĐÚNG điều kiện, đứng ĐẦU chặng 1, và BỎ được;
 *  §III câu hỏi khung: hỏi khung theo nhịp, không hỏi khi không biết nhịp hoặc đã chọn khung;
 *  §IV  ⭐ A10 + nút: không chữ kê đơn, không số tiền, mọi nút mới có đích.
 */
import { describe, expect, it } from 'vitest';
import { doiTrangThai, tuTao, type Hu } from '../src/pfm/hu.js';
import type { HoSo } from '../src/pfm/ho_so.js';
import { DICH_NUT, KHOA_BO_TRANG_THAI, loTrinh } from '../src/pfm/lo_trinh.js';
import { nhipThuTuNhan, trangThaiTaiChinh, type TrangThaiTaiChinh } from '../src/pfm/trang_thai.js';
import { CAU_PV } from '../src/pfm/phong_van.js';
import { tuKeDonTrong } from '../src/lib/khoanh_khac';

const LUC = '2026-09-01T02:00:00.000Z';
const hu = (id: string, v: Partial<Pick<Hu, 'loai' | 'han'>>): Hu =>
  tuTao({ ten: id, loai: v.loai ?? null, han: v.han ?? null }, LUC, id);

const TT0: TrangThaiTaiChinh = { co_hu_du_phong: false, hu_han_ngan: 0, nhip_thu: 'chua_ro' };
const khoiDau = (hoSo: HoSo, tt: TrangThaiTaiChinh | null) => loTrinh(hoSo, [], false, tt)[0]!.khoi;
const maDau = (hoSo: HoSo, tt: TrangThaiTaiChinh | null) => khoiDau(hoSo, tt).map((k) => k.ma);

describe('§I — trạng thái sổ đếm đúng', () => {
  it('hũ dự phòng ĐANG MỞ mới tính; hũ dự phòng đã bỏ thì không', () => {
    const dp = hu('dp', { loai: 'du_phong' });
    expect(trangThaiTaiChinh([dp], {}).co_hu_du_phong).toBe(true);
    expect(trangThaiTaiChinh([doiTrangThai(dp, 'bo_do', LUC)], {}).co_hu_du_phong).toBe(false);
    expect(trangThaiTaiChinh([doiTrangThai(dp, 'tam_dung', LUC)], {}).co_hu_du_phong).toBe(true);
  });

  it('đếm hũ đang mở cùng hạn NGẮN; hạn chưa đặt không bị đoán là ngắn', () => {
    const ds = [hu('a', { han: 'ngan' }), hu('b', { han: 'ngan' }), hu('c', { han: 'dai' }), hu('d', {})];
    expect(trangThaiTaiChinh(ds, {}).hu_han_ngan).toBe(2);
  });

  it('⭐ ba nhãn nhịp khớp ĐÚNG chip câu 2 của phỏng vấn — đổi chữ chip thì bài này đỏ', () => {
    const dap = CAU_PV.find((c) => c.id === 'deu')!.dap;
    expect(dap.map(nhipThuTuNhan)).toEqual(['deu', 'that_thuong', 'that_thuong']);
    expect(nhipThuTuNhan(undefined)).toBe('chua_ro');
    expect(nhipThuTuNhan('một nhãn lạ')).toBe('chua_ro');
  });
});

describe('§II — ba khối trạng thái', () => {
  it('⭐ không hũ dự phòng ⇒ khối DP đứng ĐẦU chặng 1, nút CHỌN MẪU + BỎ', () => {
    const k = khoiDau({}, TT0);
    expect(k[0]!.ma).toBe('DP');
    expect(k[0]!.nhan).toBe(KHOA_BO_TRANG_THAI.DP_THIEU);
    expect(k[0]!.nut).toEqual(['CHỌN MẪU', 'BỎ']);
    expect(k[0]!.vi).toContain('đọc từ sổ');
  });

  it('câu 4 đã chọn "quỹ dự phòng" ⇒ KHÔNG khối DP thứ hai; đã có hũ ⇒ không khối nào', () => {
    expect(maDau({ mucTieu: ['quỹ dự phòng'] }, TT0).filter((m) => m === 'DP')).toHaveLength(1);
    expect(maDau({}, { ...TT0, co_hu_du_phong: true })).not.toContain('DP');
  });

  it('⭐ đang tải hũ (`tt = null`) ⇒ không vẽ khối trạng thái nào — không loé "không có hũ"', () => {
    expect(maDau({}, null)).toEqual(['?', 'GHI']);
  });

  it('từ HAI hũ cùng hạn ngắn ⇒ khối HẠN, câu tả mang đúng con số', () => {
    expect(maDau({}, { ...TT0, co_hu_du_phong: true, hu_han_ngan: 1 })).not.toContain('HẠN');
    const k = khoiDau({}, { ...TT0, co_hu_du_phong: true, hu_han_ngan: 3 }).find((x) => x.ma === 'HẠN')!;
    expect(k.vi.startsWith('3 hũ')).toBe(true);
    expect(k.nut).toEqual(['XEM HŨ', 'BỎ']);
  });

  it('⭐ BỎ ẩn đúng khối ấy — khoá `#…` không lọt vào nhánh "chưa có hũ nào"', () => {
    const hoSo: HoSo = { mucTieu: ['chuyến đi'], loTrinhBo: [KHOA_BO_TRANG_THAI.DP_THIEU] };
    const ma = maDau(hoSo, { ...TT0, hu_han_ngan: 2 });
    expect(ma).toEqual(['HẠN', 'ĐI', 'GHI']);
  });
});

describe('§III — câu hỏi thử khung', () => {
  const tt = (nhip: TrangThaiTaiChinh['nhip_thu']): TrangThaiTaiChinh => ({ ...TT0, co_hu_du_phong: true, nhip_thu: nhip });

  it('⭐ tiền vào thất thường ⇒ hỏi khung hũ; đều ⇒ hỏi 50/30/20; khối mang khung sẽ ghi', () => {
    const a = khoiDau({ deu: 'thất thường' }, tt('that_thuong')).find((k) => k.ma === 'HỎI')!;
    expect(a.khung).toBe('hu');
    expect(a.nut).toEqual(['THỬ KHUNG NÀY', 'ĐỂ SAU']);
    expect(a.vi).toContain('“thất thường”');
    const b = khoiDau({ deu: 'đều mỗi tháng' }, tt('deu')).find((k) => k.ma === 'HỎI')!;
    expect(b.khung).toBe('50_30_20');
  });

  it('không biết nhịp ⇒ không hỏi; đã chọn khung ⇒ không hỏi; chọn "bạn chọn sau" ⇒ vẫn hỏi', () => {
    expect(maDau({}, tt('chua_ro'))).not.toContain('HỎI');
    expect(maDau({ khung: 'kakeibo' }, tt('deu'))).not.toContain('HỎI');
    expect(maDau({ khung: 'tu_do' }, tt('deu'))).toContain('HỎI');
  });

  it('ĐỂ SAU (khoá #GOI_Y_KHUNG) ⇒ không hỏi nữa', () => {
    expect(maDau({ loTrinhBo: [KHOA_BO_TRANG_THAI.GOI_Y_KHUNG] }, tt('deu'))).not.toContain('HỎI');
  });
});

describe('§IV — ⭐ A10 + nút có đích', () => {
  const MOI: [HoSo, TrangThaiTaiChinh][] = [
    [{ deu: 'thất thường' }, { co_hu_du_phong: false, hu_han_ngan: 4, nhip_thu: 'that_thuong' }],
    [{ deu: 'đều mỗi tháng' }, { co_hu_du_phong: false, hu_han_ngan: 2, nhip_thu: 'deu' }],
  ];
  const khoiMoi = MOI.flatMap(([h, t]) => khoiDau(h, t).filter((k) => k.nhan?.startsWith('#')));

  it('phủ đủ ba khối mới ở cả hai nhánh nhịp', () => {
    expect(new Set(khoiMoi.map((k) => k.nhan))).toEqual(new Set(Object.values(KHOA_BO_TRANG_THAI)));
  });

  it('⭐⭐ không chữ kê đơn trong ten/phu/vi của khối mới', () => {
    for (const k of khoiMoi) {
      for (const c of [k.ten, k.phu, k.vi]) expect(tuKeDonTrong(c), `"${c}"`).toEqual([]);
    }
  });

  it('⭐ không một con số tiền', () => {
    const tien = /\d[\d.,\s]*\s*(k|tr|đ|vnd|nghìn|triệu)\b/i;
    for (const k of khoiMoi) for (const c of [k.ten, k.phu, k.vi]) expect(tien.test(c), `"${c}"`).toBe(false);
  });

  it('mọi nút của khối mới có đích trong DICH_NUT', () => {
    for (const k of khoiMoi) for (const n of k.nut) expect(DICH_NUT[n], `nút ${n}`).toBeDefined();
  });
});
