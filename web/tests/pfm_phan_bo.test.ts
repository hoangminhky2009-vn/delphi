/**
 * PFM — PHÂN BỔ (`pfm/phan_bo.ts`, D420) — VECTOR CHÉP TAY.
 *
 * Ví dụ founder chốt qua câu hỏi đóng (26/09): hôm nay + THU 2.000.000 · − CHI 45.000 · − CHI 100.000 ⇒ khay bày TIỀN
 * CÒN LẠI 1.855.000 = 500k ×3 · 200k · 100k · 50k · 5k; và *"2tr thì 4 tờ 500k được bấm 4 lần"*.
 */
import { describe, expect, it } from 'vitest';
import { congSo, laChiTieu, laPhanBo, taoKhoan, tongGopVaoHu, type Khoan } from '../src/pfm/so.js';
import { LoiPhanBo, chiaTo, taoKhoanPhanBo, tienConLai, type ChongTo } from '../src/pfm/phan_bo.js';

const MG = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000] as const;
const LUC = '2026-09-26T05:00:00.000Z';
const k = (id: string, soTien: number, them: Partial<Pick<Khoan, 'chieu' | 'huId' | 'ngay'>> = {}): Khoan =>
  taoKhoan({ ngay: them.ngay ?? '2026-09-26', soTien, chieu: them.chieu ?? 'chi', huId: them.huId ?? null }, LUC, id);
const tongTo = (to: readonly ChongTo[]): number => to.reduce((a, t) => a + t.gt * t.dem, 0);

describe('§I — ⭐⭐⭐ bẻ tiền còn lại ra tờ ("2tr thì 4 tờ 500k được bấm 4 lần")', () => {
  it('⭐⭐⭐ 2.000.000 ⇒ 500k ×4 — đúng ví dụ founder', () => {
    expect(chiaTo(2_000_000, MG)).toEqual([{ gt: 500_000, dem: 4 }]);
  });

  it('⭐⭐⭐ 1.855.000 ⇒ 500k ×3 · 200k · 100k · 50k · 5k — đúng ví dụ câu hỏi đã chốt', () => {
    expect(chiaTo(1_855_000, MG)).toEqual([
      { gt: 500_000, dem: 3 }, { gt: 200_000, dem: 1 }, { gt: 100_000, dem: 1 }, { gt: 50_000, dem: 1 },
      { gt: 5_000, dem: 1 },
    ]);
  });

  it('tờ LỚN trước; phần lẻ dưới tờ nhỏ nhất là MỘT tờ lẻ đúng bằng nó; 0 / âm / không nguyên ⇒ không tờ nào', () => {
    expect(chiaTo(47_500, MG)).toEqual([
      { gt: 20_000, dem: 2 }, { gt: 5_000, dem: 1 }, { gt: 2_000, dem: 1 }, { gt: 500, dem: 1, le: true },
    ]);
    expect(chiaTo(0, MG)).toEqual([]);
    expect(chiaTo(-5_000, MG)).toEqual([]);
    expect(chiaTo(1.5, MG)).toEqual([]);
    expect(chiaTo(12_000, [...MG].reverse()), 'mệnh giá đưa vào lộn thứ tự vẫn chia từ tờ lớn').toEqual([
      { gt: 10_000, dem: 1 }, { gt: 2_000, dem: 1 },
    ]);
  });

  it('⭐⭐⭐ BỎ ĐI MỘT TỜ BẤT KỲ ⇒ các tờ còn lại giữ nguyên — mọi số nghìn tới 3 triệu', () => {
    /*
     * Đây là điều kiện để chạm một tờ chỉ trừ ĐÚNG tờ ấy trên khay: tờ khác không đổi số, không đổi chỗ (luật "cố
     * định"). Hệ 1-2-5 cho điều ấy; bài này quét cạn thay vì tin lời.
     */
    const loi: string[] = [];
    for (let x = 1_000; x <= 3_000_000; x += 1_000) {
      const to = chiaTo(x, MG);
      if (tongTo(to) !== x) loi.push(`${x}: tổng ${tongTo(to)}`);
      for (const t of to) {
        const mong = to.map((c) => (c.gt === t.gt ? { ...c, dem: c.dem - 1 } : c)).filter((c) => c.dem > 0);
        if (JSON.stringify(chiaTo(x - t.gt, MG)) !== JSON.stringify(mong)) loi.push(`${x} − ${t.gt}`);
      }
    }
    expect(loi).toEqual([]);
  });
});

describe('§II — ⭐⭐⭐ ví = tiền còn lại (Σ THU − Σ CHI, mọi tháng)', () => {
  it('⭐⭐⭐ ví dụ câu hỏi: + 2.000.000 · − 45.000 · − 100.000 ⇒ 1.855.000', () => {
    expect(tienConLai([k('t', 2_000_000, { chieu: 'thu' }), k('a', 45_000), k('b', 100_000)])).toBe(1_855_000);
  });

  it('⭐⭐ góp hũ (CHI có hũ) và khoản phân bổ RỜI ví; rút hũ (THU có hũ) VỀ ví; tháng trước vẫn tính', () => {
    const so = [
      k('t', 3_000_000, { chieu: 'thu', ngay: '2026-08-05' }),
      k('c', 500_000, { ngay: '2026-08-20' }),
      k('gop', 400_000, { huId: 'h1' }),
      taoKhoanPhanBo({ ngay: '2026-09-26', soTien: 300_000, huId: 'h1', phanBo: 'tay' }, LUC, 'pb'),
      k('rut', 100_000, { chieu: 'thu', huId: 'h1' }),
    ];
    expect(tienConLai(so)).toBe(3_000_000 - 500_000 - 400_000 - 300_000 + 100_000);
  });

  it('⭐⭐ ví âm ⇒ 0 — thiếu dòng thu không phải tiền để chia (P7: không bịa)', () => {
    expect(tienConLai([k('c', 90_000)])).toBe(0);
    expect(tienConLai([])).toBe(0);
  });
});

describe('§III — ⭐⭐⭐ khoản phân bổ: CHUYỂN vào hũ, không phải TIÊU', () => {
  const pb = taoKhoanPhanBo({ ngay: '2026-09-26', soTien: 500_000, huId: 'h-xe', phanBo: 'tay' }, LUC, 'pb1');

  it('⭐⭐⭐ khoản mới: CHI · có hũ · dấu `phanBo` · đề ngày ghi — `cachGhi` vẫn trong miền đã đăng ký', () => {
    expect(pb).toMatchObject({
      id: 'pb1', ngay: '2026-09-26', soTien: 500_000, chieu: 'chi', huId: 'h-xe', phanBo: 'tay', nhan: null,
      cachGhi: 'tay', taoLuc: LUC,
    });
    expect(() => taoKhoanPhanBo({ ngay: '2026-09-26', soTien: 1_000, huId: '', phanBo: 'tay' }, LUC, 'x'))
      .toThrow(LoiPhanBo);
    expect(() => taoKhoanPhanBo({ ngay: '2026-09-26', soTien: 0, huId: 'h', phanBo: 'tay' }, LUC, 'x')).toThrow();
    expect(() => taoKhoanPhanBo({ ngay: '2026-09-26', soTien: 1.5, huId: 'h', phanBo: 'tay' }, LUC, 'x')).toThrow();
  });

  it('⭐⭐⭐ `laChiTieu` / `congSo` BỎ khoản phân bổ; tổng hũ ĐẾM nó', () => {
    const so = [k('an', 45_000), k('luong', 2_000_000, { chieu: 'thu' }), pb];
    expect(laPhanBo(pb)).toBe(true);
    expect(laChiTieu(pb), 'chuyển vào hũ không phải một cú tiêu').toBe(false);
    expect(laChiTieu(so[0]!)).toBe(true);
    expect(laChiTieu(so[1]!)).toBe(false);
    expect(congSo(so), '"đã chi" = 45.000, không phình thêm 500.000').toEqual({ chi: 45_000, thu: 2_000_000, rong: 1_955_000 });
    expect(tongGopVaoHu(so, 'h-xe')).toBe(500_000);
  });

  it('⭐ góp CŨ (CHI có hũ, ghi ở SỔ trước D410 — không dấu `phanBo`) vẫn đếm như trước ở `congSo`', () => {
    expect(congSo([k('cu', 200_000, { huId: 'h-xe' })]).chi).toBe(200_000);
  });
});
