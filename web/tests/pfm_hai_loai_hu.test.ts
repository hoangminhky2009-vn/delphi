/**
 * PFM — HAI LOẠI HŨ (D421 → D424): hũ TÍCH LŨY nhận tiền còn lại · hũ TIÊU DÙNG nhận tiền chi.
 *
 * Founder 26/09: *"hũ chia thành 2 loại là hũ tích lũy và hũ tiêu dùng nhé, để chia thu chi cho dễ"*; câu đóng: hũ tiêu
 * dùng không giữ tiền, đếm tiền đã tiêu trong tháng, sang tháng về 0. Rồi *"Sao phiếu chi ko làm tính năng nhập tích lũy
 * giống thu?"* ⇒ câu đóng D424: "tờ + GÕ SỐ như thu" — tiền chi chưa chia bẻ ra tờ, mỗi tờ GÁN vào hũ tiêu dùng (khoản
 * `phanBo: 'gan'`), hũ đếm TỔNG đã gán.
 *
 * ⭐⭐⭐ Bài canh chính là §III: thêm một hũ tiêu dùng + các khoản gán KHÔNG được đổi một con số nào của phần GOM TỚI MỨC
 *   hay của TIỀN — danh mục, lời đoán, cuối kỳ, trạng thái tài chính, Oracle "còn thiếu", quy tắc tự chia, ví, "đã chi",
 *   GƯƠNG — và KHÔNG đổi một dòng nào của GÓI KỲ RỜI MÁY (A11.1: gói đã gửi không gỡ lại được).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import {
  congSo, daTieuTrongThang, khoanRaBanGhi, laChiTieu, laGanChi, laThu, taoKhoan, tongGopVaoHu, type Khoan,
} from '../src/pfm/so.js';
import {
  doiTrangThai, ghiKetQuaKy, laTichLuy, laTieuDung, moLoiDoan, nhanNguNghia, nhomCua, quyetToan, resetGop, sua, tuTao,
  LoiHu, type Hu,
} from '../src/pfm/hu.js';
import { chiChuaChia, laRutHu, taoKhoanPhanBo, tienConLai } from '../src/pfm/phan_bo.js';
import { LoiTuDong, datTuDong, denHan } from '../src/pfm/tu_dong.js';
import { danhMuc, tongLoiDoan } from '../src/pfm/vi_the.js';
import { cauCuoiKy } from '../src/pfm/cuoi_ky.js';
import { trangThaiTaiChinh } from '../src/pfm/trang_thai.js';
import { quyDoiMon } from '../src/pfm/quy_doi.js';
import { guongKy } from '../src/pfm/guong.js';
import { demKhoanCoNhan, demNgayGhi } from '../src/pfm/lo_trinh.js';
import { ganKhoanKho, napKhoanKho } from '../src/pfm/sua_ban_ghi.js';
import type { MonHangDoi } from '../src/pfm/dong_bo.js';

vi.mock('../src/pfm/dong_bo_chay.js', () => ({ dongBoMotLuot: vi.fn() }));
vi.mock('../src/lib/telemetry.js', () => ({ ghiDo: vi.fn(), manCuaDuong: () => '/tai-chinh/hu' }));
const { xepGoiKy } = await import('../src/pfm/goi_ky.js');

const NAY = '2026-09-26';
const THANG = '2026-09';
const LUC = '2026-09-01T02:00:00.000Z';

const an = (): Hu => tuTao({ ten: 'Ăn uống', muc: 3_000_000, nhom: 'tieu_dung', loai: 'du_phong' }, LUC, 'h-an');
/** Khoản GÁN: `chi` = chia vào hũ · `thu` = gỡ ra. */
const gan = (id: string, huId: string, soTien: number, ngay = NAY, chieu: 'chi' | 'thu' = 'chi'): Khoan =>
  taoKhoanPhanBo({ ngay, soTien, huId, phanBo: 'gan', chieu }, `${ngay}T20:00:00.000Z`, id);

beforeEach(() => { vi.clearAllMocks(); });

describe('§I — ⭐⭐⭐ loại hũ: chọn một lần, hũ tiêu dùng không phải vị thế', () => {
  it('⭐⭐⭐ vắng `nhom` = tích lũy (mọi hũ trước D421); `tieu_dung` ghi đúng; loại lạ ⇒ lỗi', () => {
    const cu = tuTao({ ten: 'Xe máy' }, LUC, 'h-xe');
    expect(cu.nhom, 'không gửi loại ⇒ không ghi khoá — bản ghi y như trước D421').toBeUndefined();
    expect(nhomCua(cu)).toBe('tich_luy');
    expect(laTichLuy(cu)).toBe(true);
    expect(laTieuDung(an())).toBe(true);
    expect(an().nhom).toBe('tieu_dung');
    expect(() => tuTao({ ten: 'X', nhom: 'hu_la' as never }, LUC, 'x')).toThrow(LoiHu);
  });

  it('⭐⭐⭐ loại KHÔNG đổi được sau khi tạo', () => {
    expect(() => sua(an(), { nhom: 'tich_luy' }, LUC)).toThrow(LoiHu);
    expect(() => sua(tuTao({ ten: 'Xe' }, LUC, 'x'), { nhom: 'tieu_dung' }, LUC)).toThrow(LoiHu);
    expect(sua(an(), { nhom: 'tieu_dung', muc: 2_500_000 }, LUC).muc, 'cùng loại + mức mới ⇒ được').toBe(2_500_000);
  });

  it('⭐⭐⭐ hũ tiêu dùng: không kỳ hạn · không lời đoán · không quyết toán · không "xong" · không nấc cuối kỳ · không reset', () => {
    expect(() => tuTao({ ten: 'Ăn', nhom: 'tieu_dung', lenh: { tu: NAY, kyHan: '2027-03-01' } }, LUC, 'x')).toThrow(LoiHu);
    expect(() => sua(an(), { lenh: { tu: NAY, kyHan: '2027-03-01' } }, LUC)).toThrow(LoiHu);
    expect(() => moLoiDoan(an(), { han: '2027-03-01', chac: 'vua' }, LUC, NAY)).toThrow(LoiHu);
    expect(() => quyetToan(an(), 'bo_do', 'du', LUC)).toThrow(LoiHu);
    expect(() => doiTrangThai(an(), 'xong', LUC)).toThrow(LoiHu);
    expect(() => ghiKetQuaKy(an(), '2026-08', 'du')).toThrow(LoiHu);
    expect(() => resetGop(an(), LUC)).toThrow(LoiHu);
    expect(doiTrangThai(doiTrangThai(an(), 'tam_dung', LUC), 'bo_do', LUC).trangThai, 'thôi dùng thì BỎ').toBe('bo_do');
  });

  it('⭐⭐⭐ hũ tiêu dùng không nhận tiền ⇒ không quy tắc tự chia; gỡ quy tắc (`null`) vẫn được', () => {
    expect(() => datTuDong(an(), { kieu: 'ngay', gt: 50_000 }, NAY)).toThrow(LoiTuDong);
    expect(datTuDong(an(), null, NAY)).toEqual(an());
  });

  it('⭐⭐ loại hũ Ở LẠI MÁY — không đi qua cửa ngữ nghĩa (P2)', () => {
    const ra = nhanNguNghia(an()) as Record<string, unknown>;
    expect(Object.keys(ra).some((k) => k.includes('nhom'))).toBe(false);
    expect(JSON.stringify(ra)).not.toContain('tieu_dung');
  });
});

describe('§II — ⭐⭐⭐ sổ: khoản GÁN · đã tiêu trong tháng · tiền chi chưa chia', () => {
  const chi = (id: string, ngay: string, soTien: number): Khoan => taoKhoan({ ngay, soTien }, `${ngay}T05:00:00.000Z`, id);

  it('⭐⭐⭐ khoản gán KHÔNG phải tiền: không chi tiêu, không tiền vào, không rút, không vào ví, không "đã chi"', () => {
    const vao = gan('g1', 'h-an', 45_000);
    const ra = gan('g2', 'h-an', 20_000, NAY, 'thu');
    expect(laGanChi(vao) && laGanChi(ra)).toBe(true);
    expect(laChiTieu(vao)).toBe(false);
    expect(laThu(ra)).toBe(false);
    expect(laRutHu(ra), 'gỡ khỏi hũ tiêu dùng không phải rút tiền về ví').toBe(false);
    const so = [taoKhoan({ ngay: NAY, soTien: 500_000, chieu: 'thu' }, LUC, 't'), chi('c', NAY, 45_000)];
    expect(tienConLai([...so, vao, ra])).toBe(tienConLai(so));
    expect(congSo([...so, vao, ra])).toEqual(congSo(so));
    expect(tongGopVaoHu([vao], 'h-an'), 'không bao giờ là "đã góp"').toBe(0);
  });

  it('⭐⭐⭐ đã tiêu tháng = chia − gỡ của khoản GÁN vào hũ, theo NGÀY khoản gán — tháng trước, hũ khác, khoản chi trần KHÔNG tính', () => {
    const so = [
      gan('a', 'h-an', 45_000, '2026-09-03'),
      gan('b', 'h-an', 30_000, '2026-09-20'),
      gan('c', 'h-an', 10_000, '2026-09-21', 'thu'),
      gan('d', 'h-an', 99_000, '2026-08-30'),
      gan('e', 'h-dl', 12_000, '2026-09-05'),
      { ...chi('f', '2026-09-06', 70_000), huId: 'h-an' },
    ];
    expect(daTieuTrongThang(so, 'h-an', THANG)).toBe(65_000);
    expect(daTieuTrongThang(so, 'h-an', '2026-08')).toBe(99_000);
  });

  it('⭐⭐⭐ tiền chi chưa chia = CHI TIÊU tháng này − phần đã gán (chia − gỡ); âm ⇒ 0; tháng khác không lẫn', () => {
    const so = [
      chi('com', NAY, 45_000), chi('grab', NAY, 100_000), chi('thang8', '2026-08-31', 90_000),
      taoKhoan({ ngay: NAY, soTien: 2_000_000, chieu: 'thu' }, LUC, 'luong'),
      taoKhoanPhanBo({ ngay: NAY, soTien: 500_000, huId: 'h-xe', phanBo: 'tay' }, LUC, 'nap'),
    ];
    expect(chiChuaChia(so, THANG), '45k + 100k — lương, nạp hũ, tháng 8 không tính').toBe(145_000);
    expect(chiChuaChia([...so, gan('g1', 'h-an', 45_000)], THANG)).toBe(100_000);
    expect(chiChuaChia([...so, gan('g1', 'h-an', 45_000), gan('g2', 'h-an', 20_000, NAY, 'thu')], THANG)).toBe(120_000);
    expect(chiChuaChia([gan('g3', 'h-an', 80_000), chi('x', NAY, 50_000)], THANG), 'xoá bớt chi sau khi đã gán').toBe(0);
    expect(chiChuaChia(so, '2026-08')).toBe(90_000);
  });
});

/* ═══ §III — THÊM hũ tiêu dùng + khoản gán ⇒ phần tích lũy và phần tiền không nhúc nhích ═════════════════════════════ */

const huGoc = (): Hu[] => {
  const xe = moLoiDoan(
    tuTao({ ten: 'Xe máy', muc: 12_000_000, lenh: { tu: '2026-09-01', kyHan: '2027-03-01' } }, LUC, 'h-xe'),
    { han: '2027-03-01', chac: 'vua' }, LUC, '2026-09-01',
  );
  const dp = { ...tuTao({ ten: 'Dự phòng', muc: 5_000_000, loai: 'du_phong' }, LUC, 'h-dp'),
    tuDong: { kieu: 'phan_tram' as const, gt: 10, tu: '2026-09-01', chayToi: null, moc: null } };
  return [xe, dp];
};
const soGoc = (): Khoan[] => {
  const so: Khoan[] = [
    taoKhoan({ ngay: '2026-09-05', soTien: 8_000_000, chieu: 'thu' }, '2026-09-05T02:00:00.000Z', 'luong'),
    taoKhoanPhanBo({ ngay: '2026-09-06', soTien: 1_500_000, huId: 'h-xe', phanBo: 'tay' }, '2026-09-06T14:00:00.000Z', 'nap'),
  ];
  for (let d = 1; d <= 26; d++) {
    const ngay = `2026-09-${String(d).padStart(2, '0')}`;
    so.push(taoKhoan({ ngay, soTien: 40_000 + (d % 4) * 15_000 }, `${ngay}T05:00:00.000Z`, `chi-${d}`));
  }
  return so;
};
/** Tối nào cũng CHIA phần chi của ngày chẵn vào hũ ăn uống, và một lần GỠ — đúng những khoản `ganKhoanKho` ghi. */
const soCoGan = (so: readonly Khoan[]): Khoan[] => [
  ...so,
  ...so.filter((x) => x.id.startsWith('chi-') && Number(x.id.slice(4)) % 2 === 0)
    .map((x) => gan(`gan-${x.id}`, 'h-an', x.soTien, x.ngay)),
  gan('go-1', 'h-an', 10_000, NAY, 'thu'),
];

describe('§III — ⭐⭐⭐ hũ tiêu dùng + khoản gán KHÔNG đổi một con số nào của phần tích lũy hay của tiền', () => {
  const hu = huGoc();
  const so = soGoc();
  const hu2 = [...hu, an()];
  const so2 = soCoGan(so);

  it('bài không rỗng: khoản gán THẬT SỰ đã vào hũ ăn uống', () => {
    expect(daTieuTrongThang(so2, 'h-an', THANG)).toBeGreaterThan(500_000);
  });

  it('⭐⭐⭐ DANH MỤC: cùng vị thế, cùng phần cam kết, cùng câu Oracle', () => {
    const dm = danhMuc(hu, so, NAY, (h) => tongGopVaoHu(so, h.id, h.mocGop));
    const dm2 = danhMuc(hu2, so2, NAY, (h) => tongGopVaoHu(so2, h.id, h.mocGop));
    expect(dm2.dong.map((d) => d.hu.id)).toEqual(dm.dong.map((d) => d.hu.id));
    expect(dm2.daCamKet).toEqual(dm.daCamKet);
    expect(dm2.cau).toEqual(dm.cau);
    expect(dm2.dongTien).toEqual(dm.dongTien);
  });

  it('⭐⭐⭐ CUỐI KỲ không hỏi hũ tiêu dùng "tháng ấy gom tới đâu"; lời đoán đếm như cũ', () => {
    const ck = cauCuoiKy('2026-08', so, hu, []);
    const ck2 = cauCuoiKy('2026-08', so2, hu2, []);
    expect(ck2?.hu.map((h) => h.id) ?? null).toEqual(ck?.hu.map((h) => h.id) ?? null);
    const ckNay = cauCuoiKy(THANG, so2, hu2, []);
    expect(ckNay?.hu.map((h) => h.id) ?? []).not.toContain('h-an');
    expect(tongLoiDoan(hu2, [], THANG)).toEqual(tongLoiDoan(hu, [], THANG));
  });

  it('⭐⭐ TRẠNG THÁI tài chính (hũ dự phòng · hạn ngắn) — hũ ăn uống mang nhãn `du_phong` cũng không đếm', () => {
    const hoSo = { deu: 'đều mỗi tháng' } as Parameters<typeof trangThaiTaiChinh>[1];
    expect(trangThaiTaiChinh([an()], hoSo).co_hu_du_phong).toBe(false);
    expect(trangThaiTaiChinh(hu2, hoSo)).toEqual(trangThaiTaiChinh(hu, hoSo));
  });

  it('⭐⭐ Oracle "còn thiếu nhiều nhất" (quy đổi món lớn) không chọn mức THÁNG của hũ tiêu dùng', () => {
    expect(quyDoiMon({ soTien: 900_000, so: so2, hu: hu2 })).toEqual(quyDoiMon({ soTien: 900_000, so, hu }));
    expect(quyDoiMon({ soTien: 900_000, so: so2, hu: [an()] })?.huId ?? null).toBeNull();
  });

  it('⭐⭐ bản ghi hũ tiêu dùng MANG quy tắc (dựng tay / két cũ) ⇒ quy tắc bị bỏ qua, không chia tiền vào nó', () => {
    const lau = { ...an(), tuDong: { kieu: 'ngay' as const, gt: 50_000, tu: '2026-09-01', chayToi: null, moc: null } };
    expect(denHan([...hu, lau], so, NAY)).toEqual(denHan(hu, so, NAY));
  });

  it('⭐⭐⭐ quy tắc tự chia · ví · "đã chi" · GƯƠNG · ngày có ghi: y nguyên', () => {
    expect(denHan(hu2, so2, NAY)).toEqual(denHan(hu, so, NAY));
    expect(tienConLai(so2)).toBe(tienConLai(so));
    expect(congSo(so2)).toEqual(congSo(so));
    expect(guongKy(so2)).toEqual(guongKy(so));
    expect(demNgayGhi(so2)).toBe(demNgayGhi(so));
  });

  it('⭐ lộ trình: chia tiền chi vào hũ LÀ phân loại (D410 — "phân loại dời sang tối ở HŨ") ⇒ mỗi khoản gán đếm một', () => {
    expect(demKhoanCoNhan(so2)).toBe(demKhoanCoNhan(so) + 14);
  });

  it('⭐⭐⭐ GÓI KỲ RỜI MÁY: thêm hũ tiêu dùng + khoản gán ⇒ từng dòng của gói y hệt (cửa một chiều)', async () => {
    const dung = async (dsHu: Hu[], dsSo: Khoan[]): Promise<unknown> => {
      const kho = new KhoTrongBoNho();
      for (const h of dsHu) await kho.ghi('hu', { id: h.id, thang: THANG, suaLuc: LUC, d: h });
      for (const x of dsSo) await kho.ghi('khoan', khoanRaBanGhi(x));
      await xepGoiKy(kho, THANG, `${NAY}T10:00:00.000Z`);
      const mon = (await kho.doc<MonHangDoi>('outbox', `goi:${THANG}`))!.d;
      return mon.loai === 'goi' ? mon.goi : null;
    };
    const goi = await dung(hu, so);
    expect(goi, 'bài không rỗng: có gói').not.toBeNull();
    expect(await dung(hu2, so2)).toEqual(goi);
  });
});

describe('§IV — ⭐⭐⭐ kho: chia / gỡ tiền chi ở hũ tiêu dùng · tiền chỉ chuyển giữa ví và hũ TÍCH LŨY', () => {
  async function kho(): Promise<KhoTrongBoNho> {
    const k = new KhoTrongBoNho();
    for (const h of [...huGoc(), an(), doiTrangThai(tuTao({ ten: 'Đi lại', nhom: 'tieu_dung' }, LUC, 'h-dl'), 'tam_dung', LUC)]) {
      await k.ghi('hu', { id: h.id, thang: THANG, suaLuc: LUC, d: h });
    }
    for (const x of soGoc()) await k.ghi('khoan', khoanRaBanGhi(x));
    return k;
  }
  const so = async (k: KhoTrongBoNho): Promise<Khoan[]> => (await k.liet<Khoan>('khoan')).map((b) => b.d);

  it('⭐⭐⭐ CHIA VÀO: một khoản gán mới, không quá tiền chi chưa chia; trả phần còn lại sau cú ghi', async () => {
    const k = await kho();
    const truoc = chiChuaChia(await so(k), THANG);
    const ra = await ganKhoanKho(k, gan('g1', 'h-an', 100_000));
    expect(ra?.khoan).toMatchObject({ phanBo: 'gan', chieu: 'chi', huId: 'h-an', soTien: 100_000 });
    expect(ra?.chiCon).toBe(truoc - 100_000);
    expect(chiChuaChia(await so(k), THANG)).toBe(truoc - 100_000);
    expect(daTieuTrongThang(await so(k), 'h-an', THANG)).toBe(100_000);
    expect(await ganKhoanKho(k, gan('g2', 'h-an', truoc)), 'quá phần chưa chia').toBeNull();
  });

  it('⭐⭐⭐ GỠ RA: không quá số hũ đã tiêu tháng này; gỡ xong phần chưa chia tăng lại', async () => {
    const k = await kho();
    await ganKhoanKho(k, gan('g1', 'h-an', 60_000));
    expect(await ganKhoanKho(k, gan('g2', 'h-an', 60_001, NAY, 'thu')), 'hũ mới có 60.000').toBeNull();
    const truoc = chiChuaChia(await so(k), THANG);
    const ra = await ganKhoanKho(k, gan('g3', 'h-an', 20_000, NAY, 'thu'));
    expect(ra?.chiCon).toBe(truoc + 20_000);
    expect(daTieuTrongThang(await so(k), 'h-an', THANG)).toBe(40_000);
  });

  it('⭐⭐⭐ chỉ hũ tiêu dùng ĐANG CHẠY nhận khoản gán; chỉ khoản gán đi đường này', async () => {
    const k = await kho();
    expect(await ganKhoanKho(k, gan('g1', 'h-xe', 10_000)), 'hũ tích lũy không nhận tiền chi').toBeNull();
    expect(await ganKhoanKho(k, gan('g2', 'h-dl', 10_000)), 'hũ tạm dừng').toBeNull();
    const nap = taoKhoanPhanBo({ ngay: NAY, soTien: 10_000, huId: 'h-an', phanBo: 'tay' }, LUC, 'nap-an');
    expect(await ganKhoanKho(k, nap), 'khoản nạp không phải khoản gán').toBeNull();
    expect(daTieuTrongThang(await so(k), 'h-an', THANG)).toBe(0);
  });

  it('⭐⭐⭐ NẠP / RÚT chỉ với hũ tích lũy; RÚT không quá số hũ đang có; khoản gán không đi đường nạp', async () => {
    const k = await kho();
    const nap = (huId: string, soTien: number, chieu: 'chi' | 'thu' = 'chi', id = `pb-${huId}-${chieu}`): Khoan =>
      taoKhoanPhanBo({ ngay: NAY, soTien, huId, phanBo: 'tay', chieu }, `${NAY}T21:00:00.000Z`, id);
    expect(await napKhoanKho(k, nap('h-an', 100_000)), 'hũ tiêu dùng không giữ tiền').toBeNull();
    // ⚠ Nhắm hũ TÍCH LŨY: khoản gán vào hũ tiêu dùng đã bị chặn bởi "chỉ hũ tích lũy" — bài ấy không canh gì (tiêm 26/09).
    expect(await napKhoanKho(k, gan('g-sai', 'h-xe', 10_000)), 'khoản gán không phải tiền chuyển').toBeNull();
    expect((await so(k)).some((x) => x.id === 'g-sai')).toBe(false);
    expect(await napKhoanKho(k, nap('h-xe', 1_500_001, 'thu')), 'hũ XE có 1.500.000').toBeNull();
    const ra = await napKhoanKho(k, nap('h-xe', 500_000, 'thu'));
    expect(ra?.khoan).toMatchObject({ chieu: 'thu', huId: 'h-xe', phanBo: 'tay', soTien: 500_000 });
    const tat = await so(k);
    expect(tongGopVaoHu(tat, 'h-xe')).toBe(1_000_000);
    expect(ra?.conLai, 'ví SAU cú rút = ví trước + 500.000').toBe(tienConLai(tat));
  });
});
