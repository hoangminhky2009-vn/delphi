/**
 * PFM — SỐ CHO BIỂU ĐỒ (D426, `src/pfm/bieu_do.ts`).
 *
 * ⭐⭐⭐ Bài canh chính: mỗi biểu đồ nói ĐÚNG con số mà màn khác đã nói — cột "chi" = "đã chi" của SỔ, khúc hũ tiêu dùng =
 *   số trên lá hũ, điểm cuối đường góp = "đã góp" của lá vị thế. Biểu đồ là cách NHÌN một con số đã có, không phải phép
 *   đếm thứ hai (A11.5); lệch một đồng là app nói hai điều về cùng một đồng tiền.
 * ⭐⭐ Và "so tháng trước" là so CÙNG NGÀY — mùng 3 không được nói "−90%" cho một người tiêu y như cũ.
 */
import { describe, expect, it } from 'vitest';
import { PFM } from '@config/pfm';
import {
  congSo, daTieuTrongThang, taoKhoan, tongGopVaoHu, type DauVaoKhoan, type Khoan,
} from '../src/pfm/so.js';
import { doiTrangThai, quyetToan, resetGop, tuTao, type Hu } from '../src/pfm/hu.js';
import { chiChuaChia, taoKhoanPhanBo } from '../src/pfm/phan_bo.js';
import { hanTuSoThang } from '../src/pfm/vi_the.js';
import { congNgay } from '../src/pfm/thoi_gian.js';
import {
  chiTheoThu, chiToiNgay, duongGopHu, giuCamKet, hangHuTieu, lichSuThang, luyKeChi, phanDaChia, sauTienVe,
  soCungNgay, soKhung, thangDauTien, tienDiDau, tienTungNgay, tienVeCoNap,
} from '../src/pfm/bieu_do.js';

let dem = 0;
const id = (): string => `k${dem++}`;
const chi = (ngay: string, soTien: number, them: Partial<DauVaoKhoan> = {}): Khoan =>
  taoKhoan({ ngay, soTien, ...them }, `${ngay}T05:00:00.000Z`, id());
const thu = (ngay: string, soTien: number): Khoan =>
  taoKhoan({ ngay, soTien, chieu: 'thu' }, `${ngay}T02:00:00.000Z`, id());
const nap = (ngay: string, soTien: number, huId: string, phanBo: 'tay' | 'tu_dong' = 'tay'): Khoan =>
  taoKhoanPhanBo({ ngay, soTien, huId, phanBo }, `${ngay}T13:00:00.000Z`, id());
const rut = (ngay: string, soTien: number, huId: string): Khoan =>
  taoKhoanPhanBo({ ngay, soTien, huId, phanBo: 'tay', chieu: 'thu' }, `${ngay}T13:30:00.000Z`, id());
const gan = (ngay: string, soTien: number, huId: string, chieu: 'chi' | 'thu' = 'chi'): Khoan =>
  taoKhoanPhanBo({ ngay, soTien, huId, phanBo: 'gan', chieu }, `${ngay}T14:00:00.000Z`, id());

const LUC = '2026-06-01T02:00:00.000Z';
const huAn = (): Hu => tuTao({ ten: 'Ăn uống', muc: 3_000_000, nhom: 'tieu_dung' }, LUC, 'h-an');
const huDi = (): Hu => tuTao({ ten: 'Đi lại', muc: 800_000, nhom: 'tieu_dung' }, LUC, 'h-di');

/** Tháng 8 tiêu 100.000 MỖI NGÀY (31 ngày) — nền cho mọi phép "so tháng trước". */
const thang8Deu = (): Khoan[] => Array.from({ length: 31 }, (_, i) => chi(`2026-08-${String(i + 1).padStart(2, '0')}`, 100_000));

/* ═══ §I — trục ngày là LỊCH ═══════════════════════════════════════════════════════════════════ */

describe('§I — CHI TỪNG NGÀY: trục là lịch, cột chỉ là tiêu thật', () => {
  it('đủ mọi ngày của tháng (28 · 30 · 31); ngày không ghi có mặt với `soKhoan` 0', () => {
    expect(tienTungNgay([], '2027-02')).toHaveLength(28);
    expect(tienTungNgay([], '2026-09')).toHaveLength(30);
    const ngay = tienTungNgay([chi('2026-08-04', 45_000)], '2026-08');
    expect(ngay).toHaveLength(31);
    expect(ngay[3]).toEqual({ ngay: '2026-08-04', chi: 45_000, thu: 0, soKhoan: 1 });
    expect(ngay[4]).toEqual({ ngay: '2026-08-05', chi: 0, thu: 0, soKhoan: 0 });
  });

  it('⭐⭐⭐ khoản CHUYỂN và GÁN ở màn HŨ không dựng cột — tổng các cột = "đã chi" của SỔ', () => {
    /* Quy tắc tự chia 50k/ngày + một cú rút + gán ăn uống: không đồng nào trong số ấy là một cú tiêu. */
    const so = [
      chi('2026-09-02', 60_000), chi('2026-09-02', 40_000), chi('2026-09-03', 120_000),
      nap('2026-09-02', 50_000, 'h-xe', 'tu_dong'), nap('2026-09-03', 50_000, 'h-xe', 'tu_dong'),
      rut('2026-09-03', 30_000, 'h-xe'), gan('2026-09-03', 100_000, 'h-an'),
      thu('2026-09-05', 4_500_000),
    ];
    const ngay = tienTungNgay(so, '2026-09');
    expect(ngay[1]!.chi).toBe(100_000);
    expect(ngay[2]!.chi, 'nạp/rút/gán không cộng vào cột ngày 3').toBe(120_000);
    expect(ngay[4]!.thu).toBe(4_500_000);
    expect(ngay.reduce((a, o) => a + o.chi, 0)).toBe(congSo(so).chi);
    expect(ngay[1]!.soKhoan, 'khoản chuyển không phải một dòng SỔ').toBe(2);
  });
});

/* ═══ §II — so CÙNG NGÀY ════════════════════════════════════════════════════════════════════════ */

describe('§II — ⭐⭐⭐ "so tháng trước" là so CÙNG NGÀY', () => {
  it('⭐⭐⭐ mùng 3 so với ba ngày đầu tháng trước — không so với cả tháng trước', () => {
    const so = [...thang8Deu(), chi('2026-09-01', 100_000), chi('2026-09-02', 100_000), chi('2026-09-03', 100_000)];
    const c = soCungNgay(so, '2026-09', 3);
    expect(c).toEqual({ nay: 300_000, truoc: 300_000, ngay: 3 });
    expect(c.truoc, 'cả tháng 8 là 3.100.000 — so với nó là nói "−90%" cho một người tiêu y như cũ')
      .not.toBe(3_100_000);
  });

  it('ngày 31 so với tháng trước 30 ngày ⇒ cả tháng trước; ngày 0 ⇒ 0', () => {
    const so = [chi('2026-09-30', 70_000), chi('2026-10-31', 10_000)];
    expect(chiToiNgay(so, '2026-09', 31)).toBe(70_000);
    expect(soCungNgay(so, '2026-10', 31)).toEqual({ nay: 10_000, truoc: 70_000, ngay: 31 });
    expect(chiToiNgay(so, '2026-09', 0)).toBe(0);
  });

  it('cộng dồn tăng dần và điểm cuối = tổng chi của tháng', () => {
    const l = luyKeChi(thang8Deu(), '2026-08');
    expect(l).toHaveLength(31);
    expect(l[0]).toBe(100_000);
    expect(l.at(-1)).toBe(3_100_000);
    expect(luyKeChi(thang8Deu(), '2026-08', 5)).toEqual([100_000, 200_000, 300_000, 400_000, 500_000]);
  });
});

/* ═══ §III — tiền vào đi đâu ══════════════════════════════════════════════════════════════════ */

describe('§III — ⭐⭐⭐ TIỀN VÀO ĐI ĐÂU nói đúng số của SỔ và của HŨ', () => {
  const so = (): Khoan[] => [
    thu('2026-09-05', 4_500_000),
    chi('2026-09-05', 200_000), chi('2026-09-06', 300_000), chi('2026-09-07', 100_000),
    /* Góp KIỂU CŨ (ghi ở SỔ trước D410): SỔ đếm nó vào "đã chi" ⇒ thẻ này cũng thế. */
    chi('2026-09-08', 500_000, { huId: 'h-laptop' }),
    gan('2026-09-06', 250_000, 'h-an'), gan('2026-09-07', 60_000, 'h-an', 'thu'), gan('2026-09-07', 80_000, 'h-di'),
    nap('2026-09-05', 450_000, 'h-quy', 'tu_dong'), nap('2026-09-09', 700_000, 'h-xe'), rut('2026-09-10', 200_000, 'h-xe'),
    chi('2026-08-30', 999_000), thu('2026-10-01', 1_000_000),
  ];

  it('⭐⭐⭐ `chi` = "đã chi" của SỔ cho đúng tháng ấy (kể cả góp kiểu cũ); `thu` không lẫn tháng khác', () => {
    const x = tienDiDau(so(), '2026-09');
    const thang9 = so().filter((k) => k.ngay.startsWith('2026-09'));
    expect(x.chi).toBe(congSo(thang9).chi);
    expect(x.chi).toBe(1_100_000);
    expect(x.thu).toBe(4_500_000);
  });

  it('⭐⭐⭐ khúc hũ tiêu dùng = số trên lá hũ (`daTieuTrongThang`), chưa chia = `chiChuaChia`', () => {
    const x = tienDiDau(so(), '2026-09');
    expect(x.chiTheoHu).toEqual([
      { huId: 'h-an', so: daTieuTrongThang(so(), 'h-an', '2026-09') },
      { huId: 'h-di', so: daTieuTrongThang(so(), 'h-di', '2026-09') },
    ]);
    expect(x.chiTheoHu[0]!.so, 'chia 250.000 − gỡ 60.000').toBe(190_000);
    expect(x.chuaChia).toBe(chiChuaChia(so(), '2026-09'));
    expect(x.chiTheoHu.reduce((a, k) => a + k.so, 0) + x.chuaChia, 'đã chia + chưa chia = đã chi').toBe(x.chi);
  });

  it('⭐⭐⭐ để dành = nạp − rút ở màn HŨ (gán không phải để dành); còn dư = vào − tiêu − để dành', () => {
    const x = tienDiDau(so(), '2026-09');
    expect(x.deDanh).toBe(450_000 + 700_000 - 200_000);
    expect(x.deDanhTheoHu).toEqual([{ huId: 'h-xe', so: 500_000 }, { huId: 'h-quy', so: 450_000 }]);
    expect(x.du).toBe(4_500_000 - 1_100_000 - 950_000);
  });

  it('⭐⭐ rút nhiều hơn nạp ⇒ để dành âm, khúc theo hũ GIỮ phần âm (cộng lại = để dành), còn dư không cộng phần âm', () => {
    const x = tienDiDau([
      thu('2026-09-05', 1_000_000), chi('2026-09-06', 400_000),
      nap('2026-09-06', 100_000, 'h-quy'), rut('2026-09-07', 300_000, 'h-xe'),
    ], '2026-09');
    expect(x.deDanh).toBe(-200_000);
    expect(x.deDanhTheoHu).toEqual([{ huId: 'h-quy', so: 100_000 }, { huId: 'h-xe', so: -300_000 }]);
    expect(x.deDanhTheoHu.reduce((a, k) => a + k.so, 0), 'bỏ phần âm là các khúc nói lớn hơn chữ').toBe(x.deDanh);
    expect(x.du).toBe(600_000);
  });

  it('6 THÁNG: cũ → mới, qua năm, mỗi tháng là đúng `tienDiDau` của nó; tháng đầu = tháng có khoản SỔ sớm nhất', () => {
    const s = [thu('2025-12-05', 2_000_000), chi('2026-01-03', 100_000), nap('2026-02-02', 300_000, 'h-quy')];
    expect(lichSuThang(s, '2026-02', 3).map((d) => d.thang)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(lichSuThang(s, '2026-02', 3)[2]).toEqual({ thang: '2026-02', thu: 0, chi: 0, deDanh: 300_000 });
    expect(thangDauTien(s)).toBe('2025-12');
    expect(thangDauTien([nap('2026-01-02', 1, 'h')]), 'khoản chuyển không phải khoản SỔ').toBeNull();
  });

  it('⭐⭐ số khoản đứng sau từng phần — "chưa ghi" khác "0 đồng" (P7): tháng chỉ có tiền vào ⇒ chi/chuyển = 0 khoản', () => {
    const x = tienDiDau([thu('2026-09-05', 1_000_000)], '2026-09');
    expect(x).toMatchObject({ thu: 1_000_000, chi: 0, deDanh: 0, nThu: 1, nChi: 0, nChuyen: 0 });
    const y = tienDiDau([nap('2026-09-06', 100_000, 'h-quy'), rut('2026-09-07', 100_000, 'h-quy')], '2026-09');
    expect(y, 'nạp rồi rút hết là một số 0 THẬT — có khoản đứng sau').toMatchObject({ deDanh: 0, nChuyen: 2 });
    expect(tienDiDau([gan('2026-09-06', 1, 'h-an')], '2026-09').nChuyen, 'gán không phải chuyển tiền').toBe(0);
  });

  it('phần tiêu đã chia: `null` khi tháng chưa tiêu gì (P7), không phải 0 hay 100%', () => {
    expect(phanDaChia([], '2026-09')).toBeNull();
    expect(phanDaChia(so(), '2026-09')).toBeCloseTo(270_000 / 1_100_000);
  });
});

/* ═══ §IV — hũ tiêu dùng ══════════════════════════════════════════════════════════════════════ */

describe('§IV — HŨ TIÊU DÙNG: so với chính nó tháng trước, CÙNG NGÀY', () => {
  it('⭐⭐ `truoc` đếm tới cùng ngày khi tháng đang chạy, cả tháng khi xem tháng đã khép', () => {
    const so = [gan('2026-08-02', 100_000, 'h-an'), gan('2026-08-20', 900_000, 'h-an'), gan('2026-09-02', 150_000, 'h-an')];
    const dangChay = hangHuTieu(so, [huAn()], '2026-09', 5).dong[0]!;
    expect(dangChay).toMatchObject({ daTieu: 150_000, truoc: 100_000 });
    expect(hangHuTieu(so, [huAn()], '2026-09', null).dong[0]!.truoc).toBe(1_000_000);
  });

  it('hũ tích lũy không vào; hũ đã BỎ chỉ hiện khi tháng ấy nó có số; lớn trước; kèm phần chưa chia', () => {
    const bo = doiTrangThai(doiTrangThai(huDi(), 'tam_dung', LUC), 'bo_do', LUC);
    const xe = tuTao({ ten: 'Xe máy', muc: 12_000_000 }, LUC, 'h-xe');
    const so = [chi('2026-09-03', 500_000), gan('2026-09-03', 200_000, 'h-an')];
    const r = hangHuTieu(so, [xe, bo, huAn()], '2026-09', 26);
    expect(r.dong.map((d) => d.hu.id)).toEqual(['h-an']);
    expect(r.chuaChia).toBe(300_000);
    const coSo = hangHuTieu([...so, gan('2026-09-04', 250_000, 'h-di')], [bo, huAn()], '2026-09', 26);
    expect(coSo.dong.map((d) => d.hu.id)).toEqual(['h-di', 'h-an']);
  });
});

/* ═══ §V — thói quen ══════════════════════════════════════════════════════════════════════════ */

describe('§V — THÓI QUEN trên LỊCH quan sát', () => {
  /* 2026-09-07 là thứ Hai. Ghi từ đó; hôm nay 21/09 (thứ Hai) ⇒ dải 07–20 = mười bốn ngày, mỗi thứ hai ngày. */
  const HOM_NAY = '2026-09-21';
  const soThuBay = (): Khoan[] => [thu('2026-09-07', 1_000_000), chi('2026-09-12', 200_000), chi('2026-09-19', 400_000)];

  it('⭐⭐⭐ ngày không tiêu trong dải = 0; trước ngày ghi đầu tiên KHÔNG phải quan sát; hôm nay còn dở nên không vào', () => {
    const r = chiTheoThu([...soThuBay(), chi(HOM_NAY, 999_000)], HOM_NAY);
    expect(r.soNgay, 'dải 07/09 → 20/09, không kéo lùi 8 tuần về trước khi app có mặt').toBe(14);
    expect(r.dong[5]).toEqual({ thu: 5, tb: 300_000, soNgay: 2 });
    expect(r.dong[0], 'thứ Hai không tiêu = 0 thật (có hai ngày quan sát), không phải "chưa đủ"').toEqual({ thu: 0, tb: 0, soNgay: 2 });
  });

  it('dưới hai ngày một thứ ⇒ `null` (P7)', () => {
    const r = chiTheoThu([thu('2026-09-14', 1), chi('2026-09-15', 50_000)], '2026-09-18');
    expect(r.soNgay).toBe(4);
    for (const d of r.dong) expect(d.tb).toBeNull();
  });

  it('⭐⭐ "sau tiền về" dùng ĐÚNG cửa sổ của chỉ số tiền về (`GUONG_CUA_SO_TIEN_VE` ngày tính cả hôm về)', () => {
    /* Tiền về 07/09 và 14/09; tiêu 300k/ngày TRONG cửa sổ, 100k/ngày NGOÀI cửa sổ, suốt dải 07 → 20. Cửa sổ rộng hơn
       một ngày là ngày 100k lọt vào khung và `tbKhung` tụt — bài đỏ. */
    const w = PFM.GUONG_CUA_SO_TIEN_VE;
    const cuaSo = new Set<string>();
    for (const n0 of ['2026-09-07', '2026-09-14']) for (let i = 0; i < w; i++) cuaSo.add(congNgay(n0, i));
    const so: Khoan[] = [thu('2026-09-07', 3_000_000), thu('2026-09-14', 1_000_000)];
    for (let i = 0; i < 14; i++) {
      const d = congNgay('2026-09-07', i);
      so.push(chi(d, cuaSo.has(d) ? 300_000 : 100_000));
    }
    const k = soKhung(so, HOM_NAY, 'sau_tien_ve')!;
    expect(k).toMatchObject({ tbKhung: 300_000, tbKhac: 100_000, nKhung: 2 * w, nKhac: 14 - 2 * w });
    expect(k.tyLe).toBe(3);
  });

  it('một phía dưới sàn, hoặc phía ngoài bằng 0 ⇒ `null` — tỷ số chia cho 0 là bịa', () => {
    expect(soKhung(soThuBay(), HOM_NAY, 'cuoi_thang'), 'cuối tháng chưa tới trong dải').toBeNull();
    expect(soKhung([thu('2026-09-07', 1), chi('2026-09-12', 5_000)], HOM_NAY, 'cuoi_tuan'), 'ngày thường không tiêu gì')
      .toBeNull();
  });

  it('⭐⭐ sau tiền về: mới trước · cắt ở lần tiền về KẾ TIẾP · cắt ở hôm nay · `tien` = cả ngày về', () => {
    const so = [
      thu('2026-09-01', 2_000_000), thu('2026-09-01', 500_000), chi('2026-09-01', 100_000), chi('2026-09-02', 50_000),
      thu('2026-09-04', 1_000_000), chi('2026-09-04', 10_000), chi('2026-09-06', 20_000),
    ];
    const r = sauTienVe(so, '2026-09-06');
    expect(r.map((x) => x.ngay)).toEqual(['2026-09-04', '2026-09-01']);
    expect(r[0]).toEqual({ ngay: '2026-09-04', tien: 1_000_000, luyKe: [10_000, 10_000, 30_000] });
    expect(r[1]!.tien).toBe(2_500_000);
    expect(r[1]!.luyKe, 'dừng TRƯỚC ngày 04 — từ đó là lần tiền về khác').toEqual([100_000, 150_000, 150_000]);
  });
});

/* ═══ §VI — mặt SỔ của BẠN NÓI · SỔ GHI · TRONG TRẬN ═══════════════════════════════════════════════ */

describe('§VI — mặt SỔ của từng cặp', () => {
  it('lúc tiền về: đếm lần tiền về có cú NẠP trong cửa sổ — rút hay gán không phải nạp', () => {
    const w = PFM.GUONG_CUA_SO_TIEN_VE;
    const so = [
      thu('2026-09-05', 4_500_000), nap(congNgay('2026-09-05', w - 1), 300_000, 'h-quy'),
      thu('2026-08-05', 4_500_000), nap(congNgay('2026-08-05', w), 300_000, 'h-quy'),
      thu('2026-07-05', 4_500_000), rut('2026-07-05', 100_000, 'h-quy'), gan('2026-07-05', 100_000, 'h-an'),
    ];
    expect(tienVeCoNap(so, '2026-09-20')).toEqual({ n: 3, coNap: 1 });
    expect(tienVeCoNap(so, '2026-09-20', 20), 'chỉ trong cửa sổ ngày gần đây').toEqual({ n: 1, coNap: 1 });
  });

  it('⭐⭐ giữ cam kết: chỉ hũ tích lũy CÓ KỲ HẠN; xong = giữ · bỏ = bỏ · đang chạy đếm "không chậm" · rút đếm', () => {
    const lenh = (tu: string) => ({ tu, kyHan: hanTuSoThang(tu, 12) });
    const dungNhip = tuTao({ ten: 'Xe', muc: 12_000_000, lenh: lenh('2026-08-01') }, LUC, 'h-xe');
    const cham = tuTao({ ten: 'Laptop', muc: 12_000_000, lenh: lenh('2026-07-01') }, LUC, 'h-lap');
    const xong = quyetToan(tuTao({ ten: 'Vé', muc: 800_000, lenh: lenh('2026-06-01') }, LUC, 'h-ve'), 'xong', 'du', LUC);
    const bo = quyetToan(tuTao({ ten: 'Sách', muc: 500_000, lenh: lenh('2026-06-01') }, LUC, 'h-sach'), 'bo_do', 'xa', LUC);
    const khongKyHan = tuTao({ ten: 'Quỹ' }, LUC, 'h-quy');
    /* Rút 10/08 nằm trong 90 ngày tính tới 01/09; rút 10/01 thì ngoài. */
    const so = [nap('2026-08-02', 1_200_000, 'h-xe'), rut('2026-08-10', 100_000, 'h-quy'), rut('2026-01-10', 1, 'h-quy')];
    expect(giuCamKet([dungNhip, cham, xong, bo, khongKyHan, huAn()], so, '2026-09-01'))
      .toEqual({ giu: 1, bo: 1, dangChay: 2, khongCham: 1, rut: 1 });
  });
});

/* ═══ §VII — đường góp của một vị thế ═════════════════════════════════════════════════════════ */

describe('§VII — ⭐⭐⭐ ĐƯỜNG GÓP: điểm cuối LUÔN là số "đã góp" trên lá', () => {
  it('⭐⭐⭐ = `tongGopVaoHu`, kể cả sau RESET; gán không vào; nhiều khoản một ngày = một điểm', () => {
    let xe = tuTao({ ten: 'Xe', muc: 12_000_000 }, LUC, 'h-xe');
    const truocReset = [nap('2026-07-02', 500_000, 'h-xe'), chi('2026-07-03', 200_000, { huId: 'h-xe' })];
    xe = resetGop(xe, '2026-07-15T00:00:00.000Z');
    const sau = [
      nap('2026-08-01', 300_000, 'h-xe'), nap('2026-08-01', 100_000, 'h-xe', 'tu_dong'),
      rut('2026-08-10', 50_000, 'h-xe'), gan('2026-08-10', 999_000, 'h-xe'), nap('2026-08-20', 250_000, 'h-xe'),
    ];
    const d = duongGopHu([...truocReset, ...sau], xe);
    expect(d).toEqual([
      { ngay: '2026-08-01', luyKe: 400_000 },
      { ngay: '2026-08-10', luyKe: 350_000 },
      { ngay: '2026-08-20', luyKe: 600_000 },
    ]);
    expect(d.at(-1)!.luyKe).toBe(tongGopVaoHu([...truocReset, ...sau], 'h-xe', xe.mocGop));
  });
});
