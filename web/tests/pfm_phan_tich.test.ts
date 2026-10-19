/**
 * PFM — PHÂN TÍCH & ĐỊNH HƯỚNG (D429): bản tin `src/pfm/phan_tich.ts` + khung app xếp `src/pfm/phong_cach.ts`.
 *
 * ⭐⭐⭐ Canh bốn điều:
 *   (1) mỗi dòng bản tin đứng trên đúng phép cộng đã có (A11.5) — "chi so cùng ngày" = `soCungNgay`, tỷ số khung ngày =
 *       `soKhung`, "đã góp" = `tongGopVaoHu`; bản tin là cách ĐỌC số, không phải phép đếm thứ hai;
 *   (2) dự phóng nói ra CƠ SỞ của nó (nhịp bao nhiêu ngày · quy tắc hay nhịp góp) và thiếu mẫu thì IM (P7);
 *   (3) khung đứng đầu có DẤU HIỆU ĐẾM ĐƯỢC; không dấu hiệu nào ⇒ không xếp bừa;
 *   (4) P3 🔒 — bước dựng không bao giờ chở một con số cho người dùng nhận; số theo công thức khung chỉ có qua `nhap503020`.
 */
import { describe, expect, it } from 'vitest';
import { taoKhoan, tongGopVaoHu, type DauVaoKhoan, type Khoan } from '../src/pfm/so.js';
import { doiTrangThai, tuTao, type Hu } from '../src/pfm/hu.js';
import { taoKhoanPhanBo } from '../src/pfm/phan_bo.js';
import { hanTuSoThang } from '../src/pfm/vi_the.js';
import { taoLuatMoi, datBat, type Luat } from '../src/pfm/luat.js';
import { congNgay, soNgayTrongThang, thuTrongTuan } from '../src/pfm/thoi_gian.js';
import { soCungNgay, soKhung, SO_TUAN_THOI_QUEN } from '../src/pfm/bieu_do.js';
import {
  dangChuY, dangDiVeDau, HANG_DU_PHONG, SAN_NGAY_NHIP, SO_DONG, tatCaChuY, tatCaDuPhong, thuTrungBinhThang,
  type ChuY, type DuPhong,
} from '../src/pfm/phan_tich.js';
import {
  danhGiaPhongCach, hoTroDung, nhap503020, nhipThuSo, SO_HO_TRO, trenSo, type HoTro,
} from '../src/pfm/phong_cach.js';
import type { HoSo } from '../src/pfm/ho_so.js';

let dem = 0;
const id = (): string => `k${dem++}`;
const chi = (ngay: string, soTien: number, them: Partial<DauVaoKhoan> = {}): Khoan =>
  taoKhoan({ ngay, soTien, ...them }, `${ngay}T05:00:00.000Z`, id());
const thu = (ngay: string, soTien: number): Khoan =>
  taoKhoan({ ngay, soTien, chieu: 'thu' }, `${ngay}T02:00:00.000Z`, id());
const nap = (ngay: string, soTien: number, huId: string, phanBo: 'tay' | 'tu_dong' = 'tay'): Khoan =>
  taoKhoanPhanBo({ ngay, soTien, huId, phanBo }, `${ngay}T13:00:00.000Z`, id());
const gan = (ngay: string, soTien: number, huId: string): Khoan =>
  taoKhoanPhanBo({ ngay, soTien, huId, phanBo: 'gan' }, `${ngay}T14:00:00.000Z`, id());

const ngay = (thang: string, d: number): string => `${thang}-${String(d).padStart(2, '0')}`;
/** Mỗi ngày `tu..den` của tháng một khoản `f(d)` (bỏ qua 0). */
const moiNgay = (thang: string, tu: number, den: number, f: (d: number) => number, them: Partial<DauVaoKhoan> = {}): Khoan[] =>
  Array.from({ length: den - tu + 1 }, (_, i) => tu + i).filter((d) => f(d) > 0).map((d) => chi(ngay(thang, d), f(d), them));

const HOM_NAY = '2026-09-26';
const LUC = '2026-06-01T02:00:00.000Z';
const huTieu = (idHu: string, ten: string, muc: number | null, them: Partial<Parameters<typeof tuTao>[0]> = {}): Hu =>
  tuTao({ ten, muc, nhom: 'tieu_dung', ...them }, LUC, idHu);
const huTich = (idHu: string, ten: string, muc: number | null, tu: string, soThang: number, taoLuc = LUC): Hu =>
  tuTao({ ten, muc, lenh: { tu, kyHan: hanTuSoThang(tu, soThang) } }, taoLuc, idHu);

const cua = <M extends ChuY['ma']>(ds: readonly ChuY[], ma: M): Extract<ChuY, { ma: M }> | undefined =>
  ds.find((c) => c.ma === ma) as Extract<ChuY, { ma: M }> | undefined;

/* ═══ §I — ĐÁNG CHÚ Ý ═══════════════════════════════════════════════════════════════════════════ */

describe('§I — ⭐⭐⭐ ĐÁNG CHÚ Ý: chi so CÙNG NGÀY tháng trước, và phần chênh đến TỪ ĐÂU', () => {
  /* Tháng 8: 100k/ngày, 80k chia vào ĂN UỐNG. Tháng 9 (tới 26): 70k/ngày, 50k chia vào ĂN UỐNG. */
  const soDoi = (): Khoan[] => [
    ...moiNgay('2026-08', 1, 31, () => 100_000), ...moiNgay('2026-09', 1, 26, () => 70_000),
    ...Array.from({ length: 31 }, (_, i) => gan(ngay('2026-08', i + 1), 80_000, 'h-an')),
    ...Array.from({ length: 26 }, (_, i) => gan(ngay('2026-09', i + 1), 50_000, 'h-an')),
  ];

  it('⭐⭐⭐ số = `soCungNgay` (một phép cộng), nguồn = hũ chở phần lớn chênh CÙNG CHIỀU', () => {
    const so = soDoi();
    const c = cua(tatCaChuY({ so, hu: [huTieu('h-an', 'Ăn uống', 3_000_000)], homNay: HOM_NAY }), 'chi_doi')!;
    const goc = soCungNgay(so, '2026-09', 26);
    expect({ nay: c.nay, truoc: c.truoc, ngay: c.ngay }).toEqual(goc);
    expect(c.nay).toBe(1_820_000);
    expect(c.truoc).toBe(2_600_000);
    expect(c.nguon).toEqual({ huId: 'h-an', lech: -780_000 });
  });

  it('⭐⭐ phần CHƯA CHIA là một nguồn như mọi hũ (`huId: null`)', () => {
    const so = [...moiNgay('2026-08', 1, 31, () => 100_000), ...moiNgay('2026-09', 1, 26, () => 60_000)];
    const c = cua(tatCaChuY({ so, hu: [], homNay: HOM_NAY }), 'chi_doi')!;
    expect(c.nguon).toEqual({ huId: null, lech: -1_040_000 });
  });

  it('⭐⭐ không nguồn nào chở ≥ 30 % chênh ⇒ KHÔNG gọi tên nguồn (không bịa một nguyên nhân)', () => {
    const hu = ['a', 'b', 'c', 'd'].map((x) => huTieu(`h-${x}`, x, null));
    const so = [
      ...moiNgay('2026-08', 1, 31, () => 100_000), ...moiNgay('2026-09', 1, 26, () => 60_000),
      // Tháng 8 mỗi hũ nhận 25k/ngày; tháng 9 mỗi hũ 15k/ngày ⇒ mỗi hũ chở đúng 25 % phần giảm.
      ...hu.flatMap((h) => Array.from({ length: 31 }, (_, i) => gan(ngay('2026-08', i + 1), 25_000, h.id))),
      ...hu.flatMap((h) => Array.from({ length: 26 }, (_, i) => gan(ngay('2026-09', i + 1), 15_000, h.id))),
    ];
    const c = cua(tatCaChuY({ so, hu, homNay: HOM_NAY }), 'chi_doi')!;
    expect(c).toBeDefined();
    expect(c.nguon).toBeNull();
  });

  it('⭐⭐⭐ P7 — sổ mở GIỮA tháng trước ⇒ không so (tháng ghi dở không phải một tháng)', () => {
    /* ⚠ Cảnh phải đủ MẠNH để ca sai hiện dòng: mở 20/08 ⇒ "tháng 8 tới ngày 26" chỉ có 7 ngày (700k) so với 1,82tr — bỏ cổng
       là một dòng "+160%" bịa. Bản đầu mở 10/08 (chênh +7%, dưới ngưỡng) nên gỡ cổng vẫn xanh — tiêm lỗi bắt được bài rỗng. */
    const so = [...moiNgay('2026-08', 20, 31, () => 100_000), ...moiNgay('2026-09', 1, 26, () => 70_000)];
    expect(cua(tatCaChuY({ so, hu: [], homNay: HOM_NAY }), 'chi_doi')).toBeUndefined();
  });

  it('chênh dưới 10 % ⇒ không dòng', () => {
    const so = [...moiNgay('2026-08', 1, 31, () => 100_000), ...moiNgay('2026-09', 1, 26, () => 95_000)];
    expect(cua(tatCaChuY({ so, hu: [], homNay: HOM_NAY }), 'chi_doi')).toBeUndefined();
  });
});

describe('§I-bis — khung ngày (cuối tuần · sau tiền về) đọc ĐÚNG `soKhung`; "Tắt Gương" tắt chúng', () => {
  /* Tám tuần: thứ Bảy/Chủ nhật 300k, ngày thường 100k; tiền về ngày 5 và 20 mỗi tháng, hai ngày ấy tiêu thêm 400k. */
  const so = (): Khoan[] => {
    const ra: Khoan[] = [];
    for (let d = congNgay(HOM_NAY, -60); d < HOM_NAY; d = congNgay(d, 1)) {
      ra.push(chi(d, thuTrongTuan(d) >= 5 ? 300_000 : 100_000));
      const dd = Number(d.slice(8, 10));
      if (dd === 5 || dd === 20) { ra.push(thu(d, 3_000_000)); ra.push(chi(d, 400_000)); }
    }
    return ra;
  };

  it('⭐⭐⭐ tỷ số của dòng = tỷ số `soKhung` (cùng cửa sổ, cùng lịch quan sát)', () => {
    const s = so();
    const ds = tatCaChuY({ so: s, hu: [], homNay: HOM_NAY });
    expect(cua(ds, 'cuoi_tuan')!.tyLe).toBeCloseTo(soKhung(s, HOM_NAY, 'cuoi_tuan', SO_TUAN_THOI_QUEN * 7)!.tyLe, 10);
    expect(cua(ds, 'sau_tien_ve')!.tyLe).toBeCloseTo(soKhung(s, HOM_NAY, 'sau_tien_ve')!.tyLe, 10);
    expect(cua(ds, 'cuoi_tuan')!.tyLe).toBeGreaterThan(1.3);
  });

  it('⭐⭐ tatHanhVi ⇒ không dòng hành vi nào; dòng TỔNG của sổ vẫn còn', () => {
    const s = [...so(), ...moiNgay('2026-08', 1, 31, () => 1)];
    const ds = tatCaChuY({ so: s, hu: [], homNay: HOM_NAY, tatHanhVi: true });
    expect(ds.some((c) => c.ma === 'cuoi_tuan' || c.ma === 'sau_tien_ve')).toBe(false);
  });
});

describe('§I-ter — khoản lớn · để dành ba tháng · xếp hạng', () => {
  it('⭐⭐ ba khoản lớn nhất chiếm ≥ 35 % ⇒ một dòng mang ghi chú của CHÍNH khoản', () => {
    const so = [
      chi('2026-09-06', 500_000, { ghiChu: 'Mỹ phẩm' }), chi('2026-09-12', 400_000), chi('2026-09-14', 300_000),
      ...moiNgay('2026-09', 15, 23, () => 50_000),
    ];
    const c = cua(tatCaChuY({ so, hu: [], homNay: HOM_NAY }), 'khoan_lon')!;
    expect(c.phan).toBeCloseTo(1_200_000 / 1_650_000, 10);
    expect(c.lon[0]).toEqual({ ngay: '2026-09-06', soTien: 500_000, ghiChu: 'Mỹ phẩm' });
    expect(c.lon[1]!.ghiChu, 'không ghi chú ⇒ null, không chuỗi rỗng').toBeNull();
  });

  it('dưới 10 khoản ⇒ không dòng (ba khoản của năm khoản là "chiếm nhiều" với mọi người)', () => {
    const so = [chi('2026-09-06', 500_000), chi('2026-09-07', 50_000), chi('2026-09-08', 50_000)];
    expect(cua(tatCaChuY({ so, hu: [], homNay: HOM_NAY }), 'khoan_lon')).toBeUndefined();
  });

  const baThang = (napT6: number, napT7: number): Khoan[] => [
    chi('2026-06-01', 10_000),
    thu('2026-06-05', 5_000_000), thu('2026-07-05', 5_000_000), thu('2026-08-05', 5_000_000),
    ...(napT6 > 0 ? [nap('2026-06-06', napT6, 'h-q')] : []), nap('2026-07-06', napT7, 'h-q'), nap('2026-08-06', 600_000, 'h-q'),
  ];

  it('⭐⭐ để dành đi MỘT CHIỀU ba tháng đã khép ⇒ một dòng, đúng ba tỷ lệ', () => {
    const c = cua(tatCaChuY({ so: baThang(250_000, 400_000), hu: [], homNay: HOM_NAY }), 'de_danh')!;
    expect(c.dong.map((t) => [t.thang, t.tyLe])).toEqual([['2026-06', 0.05], ['2026-07', 0.08], ['2026-08', 0.12]]);
  });

  it('⭐⭐⭐ P7 — một tháng không cú nạp/rút nào ⇒ "—", không phải 0 % ⇒ không dòng', () => {
    /* ⚠ Tháng 6 im lặng rồi 8 % → 12 %: đọc im lặng là 0 % thì thành "đi lên ba tháng liền" — đúng câu bịa cần chặn. (Bản đầu
       để tháng GIỮA im lặng: 5 → 0 → 12 không một chiều, gỡ cổng vẫn xanh — bài rỗng, tiêm lỗi bắt được.) */
    expect(cua(tatCaChuY({ so: baThang(0, 400_000), hu: [], homNay: HOM_NAY }), 'de_danh')).toBeUndefined();
  });

  it('⭐⭐ xếp theo độ mạnh; cắt đúng SO_DONG dòng', () => {
    const so = [
      ...moiNgay('2026-08', 1, 31, () => 100_000), ...moiNgay('2026-09', 1, 25, () => 20_000),
      chi('2026-09-06', 900_000), chi('2026-09-12', 800_000), chi('2026-09-14', 700_000),
    ];
    const tatCa = tatCaChuY({ so, hu: [], homNay: HOM_NAY });
    for (let i = 1; i < tatCa.length; i++) expect(tatCa[i - 1]!.manh).toBeGreaterThanOrEqual(tatCa[i]!.manh);
    expect(dangChuY({ so, hu: [], homNay: HOM_NAY }).length).toBeLessThanOrEqual(SO_DONG);
  });
});

/* ═══ §II — ĐANG ĐI VỀ ĐÂU ══════════════════════════════════════════════════════════════════════ */

const cuaDp = <M extends DuPhong['ma']>(ds: readonly DuPhong[], ma: M, huId?: string): Extract<DuPhong, { ma: M }> | undefined =>
  ds.find((d) => d.ma === ma && (huId === undefined || ('huId' in d && d.huId === huId))) as Extract<DuPhong, { ma: M }> | undefined;

describe('§II — ⭐⭐⭐ CẢ THÁNG: chi tới nay + nhịp × ngày còn lại; nhịp tới HẾT HÔM QUA', () => {
  it('⭐⭐⭐ con số và cơ sở của nó', () => {
    const so = [...moiNgay('2026-08', 1, 31, () => 90_000), ...moiNgay('2026-09', 1, 25, () => 100_000), chi(HOM_NAY, 30_000)];
    const d = cuaDp(tatCaDuPhong({ so, hu: [], homNay: HOM_NAY }), 'chi_het_thang')!;
    expect(d.soNgayNhip).toBe(25);
    expect(d.nhip, 'hôm nay còn dở — không vào nhịp').toBe(100_000);
    expect(d.toiNay).toBe(2_530_000);
    expect(d.conNgay).toBe(soNgayTrongThang('2026-09') - 26);
    expect(d.duKien).toBe(2_530_000 + 4 * 100_000);
    expect(d.thangTruoc).toBe(31 * 90_000);
  });

  it(`⭐⭐ P7 — dưới ${SAN_NGAY_NHIP} ngày trọn ⇒ không dự phóng`, () => {
    const so = moiNgay('2026-09', 1, 5, () => 100_000);
    expect(cuaDp(tatCaDuPhong({ so, hu: [], homNay: '2026-09-05' }), 'chi_het_thang')).toBeUndefined();
  });

  it('⭐⭐ sổ mở GIỮA tháng ⇒ nhịp chia cho số ngày sổ có mặt, không cho cả tháng (ngày chưa có app không phải ngày 0)', () => {
    const so = moiNgay('2026-09', 15, 25, () => 100_000);
    const d = cuaDp(tatCaDuPhong({ so, hu: [], homNay: HOM_NAY }), 'chi_het_thang')!;
    expect(d.soNgayNhip).toBe(11);
    expect(d.nhip).toBe(100_000);
    expect(d.thangTruoc, 'tháng trước sổ chưa có mặt ⇒ null, không 0').toBeNull();
  });
});

describe('§II-bis — ⭐⭐⭐ HŨ TIÊU DÙNG so MỨC BẠN ĐẶT', () => {
  const ganMoiNgay = (soTien: number, den = 25): Khoan[] =>
    Array.from({ length: den }, (_, i) => gan(ngay('2026-09', i + 1), soTien, 'h-an'));
  const nen = moiNgay('2026-09', 1, 25, () => 1);

  it('⭐⭐⭐ đã qua mức ⇒ hạng đầu, là một SỰ THẬT (có mặt cả khi chưa đủ ngày làm nhịp)', () => {
    const d = cuaDp(tatCaDuPhong({ so: [...nen, ...ganMoiNgay(130_000)], hu: [huTieu('h-an', 'Ăn uống', 3_000_000)], homNay: HOM_NAY }), 'hu_muc')!;
    expect(d.daVuot).toBe(true);
    expect(d.hang).toBe(HANG_DU_PHONG.hu_vuot);
    const som = cuaDp(tatCaDuPhong({
      so: [chi('2026-09-01', 1), gan('2026-09-02', 1_000_000, 'h-an')], hu: [huTieu('h-an', 'Ăn uống', 800_000)], homNay: '2026-09-05',
    }), 'hu_muc');
    expect(som?.daVuot, 'ngày 5 — chưa đủ nhịp, nhưng "đã qua mức" vẫn là sự thật').toBe(true);
  });

  it('⭐⭐ giữ nhịp thì chạm mức NGÀY NÀO trong tháng', () => {
    const d = cuaDp(tatCaDuPhong({ so: [...nen, ...ganMoiNgay(100_000)], hu: [huTieu('h-an', 'Ăn uống', 2_800_000)], homNay: HOM_NAY }), 'hu_muc')!;
    expect(d.ngayCham).toBe('2026-09-29');
    expect(d.hang).toBe(HANG_DU_PHONG.hu_cham);
  });

  it('không chạm ⇒ dự kiến cuối tháng, hạng cuối', () => {
    const d = cuaDp(tatCaDuPhong({ so: [...nen, ...ganMoiNgay(100_000)], hu: [huTieu('h-an', 'Ăn uống', 5_000_000)], homNay: HOM_NAY }), 'hu_muc')!;
    expect(d.ngayCham).toBeNull();
    expect(d.duKienCuoi).toBe(2_500_000 + 4 * 100_000);
    expect(d.hang).toBe(HANG_DU_PHONG.hu_duoi);
  });

  it('⭐⭐⭐ P3 — hũ KHÔNG mức ⇒ không dòng (app không tự điền mức để có gì mà so)', () => {
    const ds = tatCaDuPhong({ so: [...nen, ...ganMoiNgay(100_000)], hu: [huTieu('h-an', 'Ăn uống', null)], homNay: HOM_NAY });
    expect(cuaDp(ds, 'hu_muc')).toBeUndefined();
  });
});

describe('§II-ter — ⭐⭐⭐ VỊ THẾ: tháng đủ so KỲ HẠN BẠN ĐẶT, và nói ra cơ sở nhịp', () => {
  it('⭐⭐⭐ có quy tắc MỖI NGÀY ⇒ nhịp = quy tắc; "đã góp" = `tongGopVaoHu`', () => {
    let xe = huTich('h-xe', 'Xe máy', 12_000_000, '2026-07-10', 12);
    xe = { ...xe, tuDong: { kieu: 'ngay', gt: 50_000, tu: '2026-09-21', chayToi: null, moc: null } };
    const so = [chi('2026-07-01', 1), nap('2026-07-12', 1_000_000, 'h-xe'), nap('2026-08-07', 900_000, 'h-xe'),
      ...[22, 23, 24, 25].map((d) => nap(ngay('2026-09', d), 50_000, 'h-xe', 'tu_dong'))];
    const d = cuaDp(tatCaDuPhong({ so, hu: [xe], homNay: HOM_NAY }), 'vi_the', 'h-xe')!;
    expect(d.con).toBe(12_000_000 - tongGopVaoHu(so, 'h-xe', xe.mocGop));
    expect(d.coSo).toEqual({ kieu: 'quy_tac', tuDong: 'ngay', gt: 50_000 });
    expect(d.nhipThang).toBe(1_500_000);
    expect(d.thangDu).toBe('2027-04');
    expect(d.kyHan).toBe(hanTuSoThang('2026-07-10', 12));
    expect(d.lechThang, 'tháng 4 so tháng 7 ⇒ sớm 3').toBe(-3);
    expect(d.hang).toBe(HANG_DU_PHONG.vi_the_kip);
  });

  it('⭐⭐⭐ không quy tắc ⇒ nhịp góp THẬT từ lúc mở; trễ kỳ hạn ⇒ hạng "trễ"', () => {
    const tn = huTich('h-tn', 'Tai nghe', 1_500_000, '2026-09-01', 3, '2026-09-01T05:00:00.000Z');
    const so = [chi('2026-08-01', 1), nap('2026-09-02', 300_000, 'h-tn')];
    const d = cuaDp(tatCaDuPhong({ so, hu: [tn], homNay: HOM_NAY }), 'vi_the', 'h-tn')!;
    expect(d.coSo).toEqual({ kieu: 'gop', soNgay: 25 });
    expect(d.nhipThang).toBe(360_000);
    expect(d.thangDu).toBe('2027-01');
    expect(d.lechThang).toBe(1);
    expect(d.hang).toBe(HANG_DU_PHONG.vi_the_tre);
  });

  it('⭐⭐ quy tắc % ⇒ nhịp = % × tiền vào trung bình ba tháng đã khép (`thuTrungBinhThang`)', () => {
    let q = huTich('h-q', 'Quỹ', 20_000_000, '2026-06-01', 12);
    q = { ...q, tuDong: { kieu: 'phan_tram', gt: 10, tu: '2026-06-01', chayToi: null, moc: null } };
    const so = [chi('2026-06-01', 1), thu('2026-06-05', 4_000_000), thu('2026-07-05', 5_000_000), thu('2026-08-05', 6_000_000)];
    expect(thuTrungBinhThang(so, '2026-09')).toBe(5_000_000);
    const d = cuaDp(tatCaDuPhong({ so, hu: [q], homNay: HOM_NAY }), 'vi_the', 'h-q')!;
    expect(d.coSo).toEqual({ kieu: 'quy_tac', tuDong: 'phan_tram', gt: 10 });
    expect(d.nhipThang).toBe(500_000);
  });

  it('⭐⭐ P7 — mở dưới 14 ngày, không quy tắc ⇒ không dòng; 0 đồng trong cửa sổ ⇒ "chưa có tháng đủ" (null), hạng trễ', () => {
    const moi = huTich('h-m', 'Mới', 1_000_000, '2026-09-20', 3, '2026-09-20T05:00:00.000Z');
    expect(cuaDp(tatCaDuPhong({ so: [chi('2026-08-01', 1)], hu: [moi], homNay: HOM_NAY }), 'vi_the')).toBeUndefined();
    const im = huTich('h-i', 'Im', 1_000_000, '2026-08-01', 6, '2026-08-01T05:00:00.000Z');
    const d = cuaDp(tatCaDuPhong({ so: [chi('2026-08-01', 1)], hu: [im], homNay: HOM_NAY }), 'vi_the', 'h-i')!;
    expect(d.thangDu).toBeNull();
    expect(d.lechThang).toBeNull();
    expect(d.hang).toBe(HANG_DU_PHONG.vi_the_tre);
  });

  it('quá kỳ hạn (chờ kết toán) · đã đủ mức · tạm dừng ⇒ không dòng', () => {
    const qua = huTich('h-qua', 'Quá', 1_000_000, '2026-06-01', 3);
    const du = huTich('h-du', 'Đủ', 500_000, '2026-08-01', 6);
    const dung = doiTrangThai(huTich('h-dung', 'Dừng', 1_000_000, '2026-08-01', 6), 'tam_dung', LUC);
    const so = [chi('2026-06-01', 1), nap('2026-08-02', 600_000, 'h-du')];
    const ds = tatCaDuPhong({ so, hu: [qua, du, dung], homNay: HOM_NAY });
    expect(ds.filter((d) => d.ma === 'vi_the')).toEqual([]);
  });

  it('⭐⭐ thứ tự HỮU ÍCH: vượt → chạm → vị thế trễ → cả tháng → vị thế kịp → hũ còn dư', () => {
    const tn = huTich('h-tn', 'Tai nghe', 1_500_000, '2026-09-01', 3, '2026-09-01T05:00:00.000Z');
    let xe = huTich('h-xe', 'Xe', 12_000_000, '2026-07-10', 12);
    xe = { ...xe, tuDong: { kieu: 'ngay', gt: 50_000, tu: '2026-09-21', chayToi: null, moc: null } };
    const hu = [huTieu('h-vuot', 'Vượt', 100_000), huTieu('h-cham', 'Chạm', 2_800_000), huTieu('h-du2', 'Dư', 9_000_000), tn, xe];
    const so = [
      ...moiNgay('2026-08', 1, 31, () => 1), ...moiNgay('2026-09', 1, 25, () => 1),
      gan('2026-09-03', 200_000, 'h-vuot'),
      ...Array.from({ length: 25 }, (_, i) => gan(ngay('2026-09', i + 1), 100_000, 'h-cham')),
      ...Array.from({ length: 25 }, (_, i) => gan(ngay('2026-09', i + 1), 100_000, 'h-du2')),
      nap('2026-09-02', 300_000, 'h-tn'),
    ];
    const hang = tatCaDuPhong({ so, hu, homNay: HOM_NAY }).map((d) => d.hang);
    expect([...hang].sort((a, b) => a - b)).toEqual(hang);
    expect(hang).toEqual([0, 1, 2, 3, 4, 5]);
    expect(dangDiVeDau({ so, hu, homNay: HOM_NAY })).toHaveLength(SO_DONG);
  });
});

/* ═══ §III — PHONG CÁCH ══════════════════════════════════════════════════════════════════════════ */

describe('§III — ⭐⭐⭐ nhịp tiền vào ĐỌC TỪ SỔ', () => {
  const baThang = (tien: [number, number, number], khoan = 1): Khoan[] => [
    chi('2026-06-01', 1),
    ...(['2026-06', '2026-07', '2026-08'] as const).flatMap((t, i) =>
      Array.from({ length: khoan }, (_, j) => thu(ngay(t, 5 + j), Math.round(tien[i]! / khoan)))),
  ];

  it('đều: lệch nhỏ, ít khoản mỗi tháng', () => {
    expect(nhipThuSo(baThang([6_000_000, 6_500_000, 6_300_000], 2), HOM_NAY)?.loai).toBe('deu');
  });
  it('thất thường: lệch lớn — HOẶC nhiều khoản nhỏ mỗi tháng', () => {
    expect(nhipThuSo(baThang([3_000_000, 8_000_000, 5_000_000]), HOM_NAY)?.loai).toBe('that_thuong');
    expect(nhipThuSo(baThang([6_000_000, 6_100_000, 6_000_000], 5), HOM_NAY)?.loai).toBe('that_thuong');
  });
  it('⭐⭐ P7 — dưới hai tháng đủ ⇒ null ("đều" của một tháng là đúng với mọi người)', () => {
    expect(nhipThuSo([chi('2026-08-01', 1), thu('2026-08-05', 5_000_000)], HOM_NAY)).toBeNull();
  });
});

describe('§III-bis — ⭐⭐⭐ khung đứng đầu có DẤU HIỆU ĐẾM ĐƯỢC; không dấu hiệu ⇒ không xếp bừa', () => {
  const soHu = (): Khoan[] => [
    ...moiNgay('2026-09', 1, 25, () => 100_000),
    ...Array.from({ length: 25 }, (_, i) => gan(ngay('2026-09', i + 1), 80_000, 'h-an')),
  ];
  const huHu = (): Hu[] => {
    let xe = huTich('h-xe', 'Xe', 12_000_000, '2026-07-10', 12);
    xe = { ...xe, tuDong: { kieu: 'ngay', gt: 50_000, tu: '2026-09-21', chayToi: null, moc: null } };
    return [huTieu('h-an', 'Ăn uống', 3_000_000), huTieu('h-di', 'Đi lại', 800_000),
      xe, huTich('h-tn', 'Tai nghe', 1_500_000, '2026-09-01', 3)];
  };

  it('⭐⭐⭐ người đã chia theo TÚI ⇒ HŨ đứng đầu, mỗi dấu hiệu là một sự thật của sổ', () => {
    const pc = danhGiaPhongCach({ so: soHu(), hu: huHu(), hoSo: {}, homNay: HOM_NAY });
    expect(pc.goiY).toBe('hu');
    const hu = pc.hang[0]!;
    expect(hu.dauHieu.map((x) => x.ma)).toEqual(['da_chia_hu', 'nhieu_muc_tieu', 'co_tu_chia']);
    expect(hu.dauHieu.every((x) => x.nguon === 'so')).toBe(true);
    expect(hu.dauHieu[0]).toMatchObject({ n: 2, p: 0.8 });
  });

  it('⭐⭐ tiền vào đều + kể "đều mỗi tháng" + ít túi ⇒ 50/30/20', () => {
    /* Tiêu ĐỀU mỗi ngày từ tháng 6 — kakeibo cũng có dấu hiệu (ghi đều, chưa mục tiêu) nhưng ít hơn. */
    const so = [thu('2026-06-05', 6_000_000), thu('2026-07-05', 6_200_000), thu('2026-08-05', 6_100_000),
      ...(['2026-06', '2026-07', '2026-08'] as const).flatMap((t) => moiNgay(t, 1, soNgayTrongThang(t), () => 100_000)),
      ...moiNgay('2026-09', 1, 25, () => 100_000)];
    const pc = danhGiaPhongCach({ so, hu: [], hoSo: { deu: 'đều mỗi tháng' }, homNay: HOM_NAY });
    expect(pc.goiY).toBe('50_30_20');
    expect(pc.hang[0]!.dauHieu.map((x) => [x.ma, x.nguon])).toEqual([['thu_deu', 'so'], ['noi_deu', 'ban_noi'], ['it_tui', 'so']]);
  });

  it('⭐⭐ ghi đều mà chưa chia túi nào, chi lệch giữa các tuần ⇒ kakeibo', () => {
    /* Tuần (thứ Hai) chẵn 60k/ngày, tuần lẻ 200k/ngày — ghi mọi ngày từ 01/08. */
    const tuanCua = (d: string): number => Math.floor((Date.parse(`${d}T00:00:00Z`) - Date.parse('2026-07-27T00:00:00Z')) / 604_800_000);
    const so = Array.from({ length: 56 }, (_, i) => congNgay(HOM_NAY, -56 + i))
      .map((d) => chi(d, tuanCua(d) % 2 === 0 ? 60_000 : 200_000));
    const hu = [huTich('h-x', 'X', 1_000_000, '2026-09-01', 6)];
    const pc = danhGiaPhongCach({ so, hu, hoSo: {}, homNay: HOM_NAY });
    expect(pc.goiY).toBe('kakeibo');
    expect(pc.hang[0]!.dauHieu.map((x) => x.ma)).toEqual(['ghi_deu_it_chia', 'tuan_lech']);
  });

  it('⭐⭐⭐ P7 — tuần KHÔNG GHI không phải tuần tiêu 0: sổ có từ tháng 6 rồi bỏ trống tháng 8 ⇒ không "lệch tuần"', () => {
    const so = [chi('2026-06-01', 1), ...moiNgay('2026-09', 1, 25, () => 100_000)];
    const pc = danhGiaPhongCach({ so, hu: [], hoSo: {}, homNay: HOM_NAY });
    expect(pc.hang.find((h) => h.khung === 'kakeibo')!.dauHieu.map((x) => x.ma)).not.toContain('tuan_lech');
  });

  it('⭐⭐⭐ P7 — sổ trống + hồ sơ trống ⇒ `goiY` null, không khung nào "được gợi ý"', () => {
    const pc = danhGiaPhongCach({ so: [], hu: [], hoSo: {}, homNay: HOM_NAY });
    expect(pc.goiY).toBeNull();
    expect(pc.hang.every((h) => h.dauHieu.length === 0)).toBe(true);
  });

  it('⭐⭐ chỉ có lời kể ⇒ vẫn gợi ý ngay (đừng bắt người mới chờ) — nhưng SƠ BỘ', () => {
    const pc = danhGiaPhongCach({ so: [], hu: [], hoSo: { deu: 'thất thường' }, homNay: HOM_NAY });
    expect(pc.goiY).toBe('hu');
    expect(pc.soBo).toBe(true);
    /* ⚠ Sổ ĐỦ ngày (21) mà khung đầu chỉ đứng trên lời kể ⇒ vẫn sơ bộ. Bản đầu chỉ có sổ trống — sơ bộ vì thiếu ngày, nên gỡ
       vế "không dấu hiệu SỔ" vẫn xanh (tiêm lỗi bắt được). Cảnh: ghi thưa (5/21 ngày), ba hũ gom (một có mức) ⇒ không khung nào
       có dấu hiệu sổ. */
    const thua = [0, 5, 10, 15, 20].map((i) => chi(congNgay(HOM_NAY, -20 + i), 50_000));
    const ba = [huTich('h-1', 'Một', 1_000_000, '2026-09-01', 6), huTich('h-2', 'Hai', null, '2026-09-01', 6),
      huTich('h-3', 'Ba', null, '2026-09-01', 6)];
    const loiKe = danhGiaPhongCach({ so: thua, hu: ba, hoSo: { deu: 'thất thường' }, homNay: HOM_NAY });
    expect(loiKe.soNgaySo).toBe(21);
    expect(loiKe.goiY).toBe('hu');
    expect(loiKe.hang[0]!.dauHieu.map((x) => x.nguon)).toEqual(['ban_noi']);
    expect(loiKe.soBo, 'đủ ngày nhưng chỉ có lời kể ⇒ sơ bộ').toBe(true);
    const moi = danhGiaPhongCach({ so: moiNgay('2026-09', 20, 25, () => 50_000), hu: huHu(), hoSo: {}, homNay: HOM_NAY });
    expect(moi.soBo, 'sổ 7 ngày < 14 ⇒ sơ bộ').toBe(true);
    expect(moi.soNgaySo).toBe(7);
  });

  it('`daChon` = khung người dùng đã chọn trong ba khung; "không theo khung nào" ⇒ null', () => {
    expect(danhGiaPhongCach({ so: [], hu: [], hoSo: { khung: '50_30_20' }, homNay: HOM_NAY }).daChon).toBe('50_30_20');
    expect(danhGiaPhongCach({ so: [], hu: [], hoSo: { khung: 'tu_do' }, homNay: HOM_NAY }).daChon).toBeNull();
  });
});

describe('§III-ter — ⭐⭐⭐ BƯỚC DỰNG: có lý do đếm được, trỏ màn sẵn có, KHÔNG chở con số (P3 🔒)', () => {
  const tn = (): Hu => huTich('h-tn', 'Tai nghe', 1_500_000, '2026-09-01', 3, '2026-09-01T05:00:00.000Z');
  const nen = (): Khoan[] => [chi('2026-08-01', 1), nap('2026-09-02', 300_000, 'h-tn'), ...moiNgay('2026-09', 1, 25, () => 40_000)];
  const vao = (them: Partial<Parameters<typeof hoTroDung>[1]> = {}) => ({
    so: nen(), hu: [tn()], luat: [] as Luat[], hoSo: {} as HoSo, homNay: HOM_NAY, ...them,
  });

  it('⭐⭐⭐ vị thế TRỄ kỳ hạn, chưa quy tắc ⇒ "tự chia mỗi ngày" mở đúng bảng của hũ ấy', () => {
    const b = hoTroDung('hu', vao())[0]!;
    expect(b.ma).toBe('tu_chia_vi_the');
    expect(b.dich).toEqual({ kieu: 'lenh_hu', huId: 'h-tn', td: 'ngay' });
    expect(b).toMatchObject({ thang: '2027-01', x: 1, kyHan: '2026-12-01' });
  });

  it('⭐⭐ hũ đã có quy tắc ⇒ không đề nghị đặt quy tắc cho nó nữa', () => {
    const h = { ...tn(), tuDong: { kieu: 'ngay' as const, gt: 5_000, tu: '2026-09-02', chayToi: null, moc: null } };
    expect(hoTroDung('hu', vao({ hu: [h] })).some((b) => b.ma === 'tu_chia_vi_the')).toBe(false);
  });

  it('⭐⭐⭐ "lúc vừa có tiền" (câu 6 — kể cả nhãn DI SẢN) ⇒ quy tắc % + luật "tiền vừa về"; có % rồi ⇒ thôi', () => {
    for (const nhan of ['lúc vừa có tiền', 'ngay sau khi tiền về']) {
      const ds = hoTroDung('hu', vao({ hoSo: { nhip: [nhan] } }));
      expect(ds.find((b) => b.ma === 'tu_chia_tien_ve')?.dich, nhan).toEqual({ kieu: 'lenh_hu', huId: 'h-tn', td: 'phan_tram' });
      // Luật cùng khoảnh khắc: ở HŨ nó đứng sau ba việc "dựng túi" (trần SO_HO_TRO); ở kakeibo nó đứng thứ hai.
      const kk = hoTroDung('kakeibo', vao({ hoSo: { nhip: [nhan] } }));
      expect(kk.find((b) => b.ma === 'luat_tien_ve')?.dich, nhan).toEqual({ kieu: 'cam_ket', dk: 'tien_vua_ve' });
    }
    const q = { ...huTich('h-q', 'Quỹ', null, '2026-06-01', 12), tuDong: { kieu: 'phan_tram' as const, gt: 10, tu: '2026-06-01', chayToi: null, moc: null } };
    const co = hoTroDung('hu', vao({ hu: [tn(), q], hoSo: { nhip: ['lúc vừa có tiền'] } }));
    expect(co.some((b) => b.ma === 'tu_chia_tien_ve')).toBe(false);
  });

  it('⭐⭐ luật "tiền vừa về" ĐANG BẬT ⇒ không đề nghị; tắt đi ⇒ đề nghị lại', () => {
    const l = taoLuatMoi({ loiNhac: 'x', dieuKien: 'tien_vua_ve' }, LUC, 'l1');
    expect(hoTroDung('kakeibo', vao({ hoSo: { nhip: ['lúc vừa có tiền'] }, luat: [l] })).some((b) => b.ma === 'luat_tien_ve')).toBe(false);
    expect(hoTroDung('kakeibo', vao({ hoSo: { nhip: ['lúc vừa có tiền'] }, luat: [datBat(l, false, LUC)] })).some((b) => b.ma === 'luat_tien_ve')).toBe(true);
  });

  it('⭐⭐ phần chi chưa vào túi ≥ 20 % (và ≥ 100k) ⇒ "tạo hũ tiêu dùng"; ít hơn ⇒ không', () => {
    const b = hoTroDung('hu', vao()).find((x) => x.ma === 'hu_cho_chua_chia')!;
    expect(b.dich).toEqual({ kieu: 'tao_hu', nhom: 'tieu_dung' });
    expect(b.so).toBe(1_000_000);
    const it = [...nen(), ...Array.from({ length: 25 }, (_, i) => gan(ngay('2026-09', i + 1), 35_000, 'h-an'))];
    expect(hoTroDung('hu', vao({ so: it, hu: [tn(), huTieu('h-an', 'Ăn', null)] })).some((x) => x.ma === 'hu_cho_chua_chia')).toBe(false);
  });

  it('50/30/20 ⇒ "phân loại" đứng đầu khi còn hũ tiêu dùng chưa nói; kakeibo ⇒ "bốn câu cuối tuần" đứng đầu', () => {
    const hu = [tn(), huTieu('h-an', 'Ăn', null), huTieu('h-cf', 'Cà phê', null, { thietYeu: false })];
    expect(hoTroDung('50_30_20', vao({ hu }))[0]).toMatchObject({ ma: 'phan_loai', n: 1, dich: { kieu: 'phan_loai' } });
    expect(hoTroDung('kakeibo', vao())[0]).toMatchObject({ ma: 'chot_tuan', dich: { kieu: 'chot_tuan' } });
    expect(hoTroDung('hu', vao({ hu })).some((b) => b.ma === 'phan_loai'), 'phân loại là việc của 50/30/20').toBe(false);
  });

  it('⭐⭐⭐ P3 🔒 — ĐÍCH của mọi bước chỉ mang mã (loại · hũ · kiểu · điều kiện), KHÔNG một con số; tối đa SO_HO_TRO', () => {
    const hu = [tn(), huTieu('h-an', 'Ăn', null)];
    const ds: HoTro[] = (['hu', '50_30_20', 'kakeibo'] as const)
      .flatMap((k) => hoTroDung(k, vao({ hu, hoSo: { nhip: ['lúc vừa có tiền', 'ngày tệ'] } })));
    expect(ds.length).toBeGreaterThan(5);
    for (const b of ds) {
      for (const [k, v] of Object.entries(b.dich)) {
        expect(['kieu', 'nhom', 'huId', 'td', 'dk'], `${b.ma}.${k}`).toContain(k);
        expect(typeof v, `${b.ma}.${k} không được là số`).toBe('string');
      }
    }
    for (const k of ['hu', '50_30_20', 'kakeibo'] as const) {
      expect(hoTroDung(k, vao({ hu, hoSo: { nhip: ['lúc vừa có tiền', 'ngày tệ'] } })).length).toBeLessThanOrEqual(SO_HO_TRO);
    }
  });
});

describe('§III-quater — TRÊN SỔ CỦA BẠN · công thức 50/30/20', () => {
  it('⭐⭐ 50/30/20 xếp THÁNG TRƯỚC (đã khép) theo nhãn hũ; chưa nói ⇒ vào "chưa rõ" cùng phần chưa chia', () => {
    const hu = [huTieu('h-an', 'Ăn', null, { thietYeu: true }), huTieu('h-cf', 'Cà phê', null, { thietYeu: false }), huTieu('h-x', 'X', null)];
    const so = [
      chi('2026-08-01', 1_000_000), thu('2026-08-05', 6_000_000),
      gan('2026-08-02', 500_000, 'h-an'), gan('2026-08-03', 200_000, 'h-cf'), gan('2026-08-04', 100_000, 'h-x'),
      nap('2026-08-06', 900_000, 'h-q'),
    ];
    const ts = trenSo('50_30_20', { so, hu, hoSo: {}, homNay: HOM_NAY });
    expect(ts).toMatchObject({
      khung: '50_30_20', thang: '2026-08', thu: 6_000_000, thietYeu: 500_000, muon: 200_000,
      chuaRo: 200_000 + 100_000, deDanh: 900_000, nThietYeu: 1, nMuon: 1,
    });
  });

  it('⭐⭐⭐ công thức công khai, làm tròn XUỐNG tới nghìn (C5)', () => {
    expect(nhap503020(6_300_000)).toEqual({ thietYeu: 3_150_000, muon: 1_890_000, deDanh: 1_260_000 });
    expect(nhap503020(1_234_567)).toEqual({ thietYeu: 617_000, muon: 370_000, deDanh: 246_000 });
  });
});
