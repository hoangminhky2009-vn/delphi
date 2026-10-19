/**
 * PFM TẦNG KHÔNG GIAN — LÕI THUẦN CỦA BENTO (SPEC `pfm-tang-khong-gian`): bốn hàm/tập hằng mới mà không bài màn nào đứng đủ gần để canh.
 *
 *  §I   `capDoiChieu` — bốn cặp "BẠN NGHĨ ↔ THỰC TẾ" của tầng PHÂN TÍCH: thiếu mẫu là `null` chứ KHÔNG BAO GIỜ 0 (D62); không có trường nào chấm khớp/lệch
 *       (bảng gốc cấm: trọng số giữa các nguồn chưa chốt — founder còn câu mở); vector chép tay.
 *  §II  `khucTienVao` — vòng "TIỀN VÀO ĐI ĐÂU": khúc dương, tổng = 1, không khúc âm, không vòng rỗng giả.
 *  §III `phatTichHu` — hiệu ứng TÍCH HŨ: xu rơi + mực dâng có vượt + hũ nảy; phần tử tạm dọn bằng ĐỒNG HỒ (không `onfinish`); giảm chuyển động ⇒ không làm gì.
 *  §IV  Nhịp mới của `lib/nhip.ts` (luật 4.2 của SPEC: "nhịp khai trong nhip.ts TRƯỚC khi viết hiệu ứng") — số nguyên dương, ghi vào CSS, và mọi
 *       `var(--nhip-…)` mà CSS của tầng mới dùng đều có người khai.
 *  §V   A10 — mọi chuỗi `CHU_BENTO` nằm trong tầm quét `moiChuoiPfm()`; bảng không rỗng (một bảng rỗng làm bài xanh mà chẳng chứng minh gì).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { khucTienVao, type TienDiDau } from '../src/pfm/bieu_do';
import { KHUNG_CUA_NHIP, capDoiChieu, capDu, type SoBaMat } from '../src/screens/tai-chinh/BaMat';
import { THOI_LUONG_XU, phatTichHu } from '../src/components/pfm/tich_hu';
import { NHIP, capNhipVaoCss } from '../src/lib/nhip';
import { CHU_BENTO, moiChuoiPfm } from '../src/lib/pfm_chu';
import type { HoSo } from '../src/pfm/ho_so';

const doc = (p: string): string => readFileSync(resolve(__dirname, p), 'utf8');

/* ═══ §I — capDoiChieu ═════════════════════════════════════════════════════════════════════════ */

const SO_TRONG = {
  tienVe: { n: 0, coNap: 0 },
  sauTieu: null,
  daChia: null,
  camKet: null,
  quaTay: { sau_tien_ve: null, cuoi_thang: null, cuoi_tuan: null },
  giu: { giu: 0, bo: 0, dangChay: 0, khongCham: 0, rut: 0 },
  gio: [],
} as unknown as SoBaMat;

const ca = (tyLe: number) => ({ tbKhung: tyLe * 10, tbKhac: 10, tyLe, nKhung: 5, nKhac: 20 });
const SO_DAY = {
  ...SO_TRONG,
  tienVe: { n: 5, coNap: 2 },
  sauTieu: { n: 4, vuot: 3 },
  daChia: 0.62,
  quaTay: { sau_tien_ve: ca(1.6), cuoi_thang: ca(1.2), cuoi_tuan: null },
} as unknown as SoBaMat;

describe('§I — ⭐⭐⭐ capDoiChieu: ĐẶT CẠNH NHAU, không chấm khớp/lệch; thiếu mẫu là null không phải 0', () => {
  it('⭐⭐⭐ sổ trống + hồ sơ trống ⇒ bốn cặp, mỗi cặp `nghi = null`, `thuc = null`, KHÔNG cặp nào đủ — và không con số 0 nào lọt ra', () => {
    const ds = capDoiChieu(SO_TRONG, {});
    expect(ds.map((c) => c.ma)).toEqual(['tien_ve', 'sau_tieu', 'dau_thang', 'qua_tay']);
    for (const c of ds) {
      expect(c.nghi, `${c.ma}: chưa trả lời phỏng vấn ⇒ null`).toBeNull();
      expect(c.thuc, `${c.ma}: chưa đủ mẫu ⇒ null (D62: chưa đo ≠ đo ra 0)`).toBeNull();
      expect(capDu(c)).toBe(false);
    }
    // Mẫu số 0 (n = 0) tuyệt đối không được thành `{ co: 0, n: 0 }` — "0 trên 0 lần" là một phát biểu đã đo.
    expect(JSON.stringify(ds)).not.toMatch(/"(co|ty|n)":0/);
  });

  it('⭐⭐ sổ đủ + hồ sơ đủ ⇒ bốn cặp ĐỦ HAI PHÍA, mỗi `thuc` đúng hình của phép đo (vector chép tay)', () => {
    const hs: HoSo = { lucTienVe: 'cất một phần đi', sauKhiTieu: 'nhẩm lại giá', dauThang: 'chia ngay', nhip: ['lúc vừa có tiền', 'cuối tháng'] };
    const ds = capDoiChieu(SO_DAY, hs);
    expect(ds.every(capDu)).toBe(true);
    const [tienVe, sauTieu, dauThang, quaTay] = ds;
    expect(tienVe!.nghi).toEqual(['cất một phần đi']);
    expect(tienVe!.thuc).toEqual({ k: 'dem', co: 2, n: 5 });
    expect(sauTieu!.nghi).toEqual(['nhẩm lại giá']);
    expect(sauTieu!.thuc).toEqual({ k: 'dem', co: 3, n: 4 });
    expect(dauThang!.nghi).toEqual(['chia ngay']);
    expect(dauThang!.thuc).toEqual({ k: 'phan', ty: 0.62 });
    expect(quaTay!.nghi).toEqual(['lúc vừa có tiền', 'cuối tháng']);
    expect(quaTay!.thuc).toEqual({
      k: 'nhip', ds: [{ khung: 'sau_tien_ve', tyLe: 1.6 }, { khung: 'cuoi_thang', tyLe: 1.2 }],
    });
  });

  it('⭐⭐ mỗi cặp thiếu MỘT phía thì không đủ: sổ đủ mà chưa trả lời ⇒ `nghi=null`; trả lời mà sổ chưa đủ ⇒ `thuc=null`', () => {
    const soDuChuaTraLoi = capDoiChieu(SO_DAY, {});
    expect(soDuChuaTraLoi.filter((c) => c.nghi === null && c.thuc !== null).length).toBeGreaterThanOrEqual(3);
    expect(soDuChuaTraLoi.some(capDu)).toBe(false);
    const traLoiSoTrong = capDoiChieu(SO_TRONG, { lucTienVe: 'tiêu ngay', sauKhiTieu: 'bù', dauThang: 'đại khái', nhip: ['ngày tệ'] });
    expect(traLoiSoTrong.every((c) => c.nghi !== null && c.thuc === null)).toBe(true);
    expect(traLoiSoTrong.some(capDu)).toBe(false);
  });

  it('⭐ "ngày tệ" / "đi chơi cùng bạn": sổ không đo được ⇒ cặp QUÁ TAY có `nghi` mà `thuc = null` (không bịa khung)', () => {
    expect(KHUNG_CUA_NHIP['ngày tệ']).toBeNull();
    const ds = capDoiChieu(SO_DAY, { nhip: ['ngày tệ'] });
    const q = ds.find((c) => c.ma === 'qua_tay')!;
    expect(q.nghi).toEqual(['ngày tệ']);
    expect(q.thuc, 'câu trả lời không có khung sổ nào đo được ⇒ không có gì để đặt cạnh: null (chưa đủ), KHÔNG danh sách rỗng giả').toBeNull();
    expect(capDu(q)).toBe(false);
  });

  it('⭐⭐⭐ KHÔNG chấm khớp/lệch: mỗi cặp chỉ có ba khoá `ma · nghi · thuc` (bảng gốc cấm điểm khớp)', () => {
    for (const c of capDoiChieu(SO_DAY, { lucTienVe: 'a', sauKhiTieu: 'b', dauThang: 'c', nhip: ['cuối tháng'] })) {
      expect(Object.keys(c).sort(), c.ma).toEqual(['ma', 'nghi', 'thuc']);
    }
  });
});

/* ═══ §II — khucTienVao ════════════════════════════════════════════════════════════════════════ */

const tien = (o: { deDanh?: number; hu?: number[]; chuaChia?: number; du?: number }): TienDiDau => ({
  thu: 0, chi: 0, deDanh: o.deDanh ?? 0, chuaChia: o.chuaChia ?? 0, du: o.du ?? 0,
  chiTheoHu: (o.hu ?? []).map((so, i) => ({ huId: `h${i}`, so })),
  deDanhTheoHu: [],
}) as unknown as TienDiDau;

describe('§II — ⭐⭐⭐ khucTienVao: vòng khép kín từ các khúc DƯƠNG, tổng = 1', () => {
  it('vector chép tay: để dành 300 · chi vào hũ 150+50 · chưa chia 100 · dư 400 ⇒ 30% · 20% · 10% · 40%', () => {
    const k = khucTienVao(tien({ deDanh: 300, hu: [150, 50], chuaChia: 100, du: 400 }))!;
    expect(k.map((x) => [x.ma, x.phan])).toEqual([['de_danh', 0.3], ['chi_hu', 0.2], ['chi_chua_chia', 0.1], ['du', 0.4]]);
    expect(k.reduce((a, x) => a + x.phan, 0)).toBeCloseTo(1, 12);
  });

  it('⭐⭐ phần ÂM (dư âm: tiêu + để dành vượt tiền vào; rút nhiều hơn nạp) KHÔNG vẽ khúc âm — vòng vẫn khép, tổng 1', () => {
    const k = khucTienVao(tien({ deDanh: 500, hu: [500], du: -200 }))!;
    expect(k.map((x) => x.ma)).toEqual(['de_danh', 'chi_hu']);
    expect(k.reduce((a, x) => a + x.phan, 0)).toBeCloseTo(1, 12);
    const rut = khucTienVao(tien({ deDanh: -300, chuaChia: 100, du: 100 }))!;
    expect(rut.map((x) => x.ma)).toEqual(['chi_chua_chia', 'du']);
    expect(rut.every((x) => x.phan > 0)).toBe(true);
  });

  it('⭐⭐⭐ P7 — tháng chưa có khoản nào (mọi khúc 0 hoặc âm) ⇒ `null`: "chưa đủ để nói", KHÔNG vòng rỗng giả', () => {
    expect(khucTienVao(tien({}))).toBeNull();
    expect(khucTienVao(tien({ deDanh: -50, du: -10 }))).toBeNull();
  });

  it('một khúc duy nhất ⇒ một khúc 100% (không chia cho 0, không NaN)', () => {
    expect(khucTienVao(tien({ du: 7 }))).toEqual([{ ma: 'du', phan: 1 }]);
  });
});

/* ═══ §III — phatTichHu ════════════════════════════════════════════════════════════════════════ */

describe('§III — ⭐⭐⭐ phatTichHu: xu rơi · mực dâng có vượt · hũ nảy; dọn bằng đồng hồ, không `onfinish`', () => {
  const LOP = { nay: 'nay', xu: 'xu' };
  let animate: ReturnType<typeof vi.fn>;
  let goc: HTMLDivElement;
  let vo: HTMLElement;
  let muc: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom không có WAAPI: giả MỘT `animate` KHÔNG BAO GIỜ gọi `onfinish` — đúng ca khung ẩn mà luật "dọn bằng đồng hồ" sinh ra để chặn.
    animate = vi.fn(() => ({ cancel: vi.fn() }));
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
    goc = document.createElement('div');
    goc.innerHTML = '<span data-hu="h1"><span data-vo-hu=""><i data-muc-hu=""></i></span></span><span data-hu="h2"><span data-vo-hu=""></span></span>';
    document.body.appendChild(goc);
    vo = goc.querySelector('[data-hu="h1"] [data-vo-hu]')!;
    muc = goc.querySelector('[data-hu="h1"] [data-muc-hu]')!;
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    document.body.innerHTML = '';
  });
  const xu = (): number => document.body.querySelectorAll(`i.${LOP.xu}`).length;

  it('⭐⭐⭐ phát đúng một hình (hũ `h1`): đủ `PFM_XU_SO` xu, mực dâng từ mức cũ có vượt, nảy đúng lúc xu rơi xong; hũ KHÁC không bị động', () => {
    const so = phatTichHu(goc, { huId: 'h1', truoc: 40, nay: 60 }, LOP);
    expect(so).toBe(1);
    expect(xu()).toBe(NHIP.PFM_XU_SO);
    // Mực: bắt đầu từ 40/60, vượt 1,07 rồi về 1 — chờ xu rơi xong (delay = THOI_LUONG_XU), `fill: backwards` giữ mức cũ trong lúc chờ.
    const lanMuc = animate.mock.calls.filter((c) => (c[1] as { delay: number }).delay === THOI_LUONG_XU);
    expect(lanMuc).toHaveLength(1);
    const [kf, opt] = lanMuc[0] as [{ transform: string }[], { fill: string; duration: number; easing: string }];
    expect(kf.map((k) => k.transform)).toEqual([`scaleY(${40 / 60})`, 'scaleY(1.07)', 'scaleY(1)']);
    expect(opt).toMatchObject({ fill: 'backwards', duration: NHIP.PFM_ND_DAY });
    expect(opt.easing).toContain('cubic-bezier(.34,1.56,.64,1)');
    // Nảy: chưa tới lúc thì chưa có lớp; tới lúc thì có; hết nhịp thì gỡ.
    expect(vo.classList.contains(LOP.nay)).toBe(false);
    vi.advanceTimersByTime(THOI_LUONG_XU + 1);
    expect(vo.classList.contains(LOP.nay)).toBe(true);
    vi.advanceTimersByTime(NHIP.PFM_ND_DAY + 61);
    expect(vo.classList.contains(LOP.nay)).toBe(false);
    expect(goc.querySelector('[data-hu="h2"] [data-vo-hu]')!.classList.contains(LOP.nay)).toBe(false);
  });

  it('⭐⭐⭐ xu là phần tử TẠM gắn vào body và rời đi bằng HẸN GIỜ — `onfinish` không bao giờ tới mà body vẫn sạch', () => {
    phatTichHu(goc, { huId: 'h1', truoc: 10, nay: 20 }, LOP);
    expect(xu()).toBe(NHIP.PFM_XU_SO);
    for (const c of animate.mock.results) expect((c.value as { onfinish?: unknown }).onfinish ?? null, 'bài không được dựa vào onfinish').toBeNull();
    vi.advanceTimersByTime((NHIP.PFM_XU_SO - 1) * NHIP.PFM_XU_CACH + NHIP.PFM_XU_ROI + 41);
    expect(xu(), 'xu phải rời DOM đúng hạn dù không có onfinish').toBe(0);
  });

  it('trục NGANG (`data-truc="x"`) ⇒ mực dâng theo scaleX', () => {
    vo.dataset.truc = 'x';
    phatTichHu(goc, { huId: 'h1', truoc: 20, nay: 50 }, LOP);
    const lan = animate.mock.calls.find((c) => (c[1] as { delay: number }).delay === THOI_LUONG_XU)!;
    expect((lan[0] as { transform: string }[])[0]!.transform).toBe('scaleX(0.4)');
  });

  it('⭐ hũ CHƯA ĐẶT MỨC (`truoc` hoặc `nay` null) ⇒ vẫn rơi xu + nảy, KHÔNG vẽ mực dâng (không có mức để dâng tới)', () => {
    expect(phatTichHu(goc, { huId: 'h1', truoc: null, nay: null }, LOP)).toBe(1);
    expect(xu()).toBe(NHIP.PFM_XU_SO);
    expect(animate.mock.calls.filter((c) => (c[1] as { delay: number }).delay === THOI_LUONG_XU)).toHaveLength(0);
    void muc;
  });

  it('⭐⭐ giảm chuyển động ⇒ KHÔNG làm gì (số vẫn đúng, không nháy — D116): trả 0, không xu, không lớp, không animate', () => {
    (window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: true });
    expect(phatTichHu(goc, { huId: 'h1', truoc: 40, nay: 60 }, LOP)).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(xu()).toBe(0);
    expect(animate).not.toHaveBeenCalled();
    expect(vo.classList.contains(LOP.nay)).toBe(false);
  });

  it('hũ không có hình trên màn (id lạ) ⇒ 0, không ném', () => {
    expect(phatTichHu(goc, { huId: 'khong-co', truoc: 1, nay: 2 }, LOP)).toBe(0);
    expect(xu()).toBe(0);
  });

  it('thời lượng xu rơi trọn vẹn = (số xu − 1) × cách + rơi — mực và nảy chờ đúng chừng ấy', () => {
    expect(THOI_LUONG_XU).toBe((NHIP.PFM_XU_SO - 1) * NHIP.PFM_XU_CACH + NHIP.PFM_XU_ROI);
  });
});

/* ═══ §IV — nhịp mới ═══════════════════════════════════════════════════════════════════════════ */

const NHIP_MOI = [
  'PFM_TAB_LUOT', 'PFM_O_CACH', 'PFM_QUET', 'PFM_SAO_CAU', 'PFM_SAO_VANH', 'PFM_SAO_HAT_TRE', 'PFM_SAO_HAT_DON',
  'PFM_KHAY_NHAY', 'PFM_XU_ROI', 'PFM_XU_CACH', 'PFM_XU_SO',
] as const;

describe('§IV — ⭐⭐ nhịp mới khai trong `lib/nhip.ts` TRƯỚC khi viết hiệu ứng', () => {
  it('mỗi nhịp mới là số nguyên dương (không NaN, không 0, không số lẻ ms)', () => {
    for (const k of NHIP_MOI) {
      const v = NHIP[k];
      expect(Number.isInteger(v) && v > 0, `NHIP.${k} = ${String(v)}`).toBe(true);
    }
  });

  it('`capNhipVaoCss` ghi các nhịp mới thành biến CSS bằng ms (một nguồn cho JS và CSS)', () => {
    const el = document.createElement('div');
    capNhipVaoCss(el);
    expect(el.style.getPropertyValue('--nhip-pfm-tab-luot')).toBe(`${NHIP.PFM_TAB_LUOT}ms`);
    expect(el.style.getPropertyValue('--nhip-pfm-o-cach')).toBe(`${NHIP.PFM_O_CACH}ms`);
    expect(el.style.getPropertyValue('--nhip-pfm-quet')).toBe(`${NHIP.PFM_QUET}ms`);
    expect(el.style.getPropertyValue('--nhip-pfm-sao-cau')).toBe(`${NHIP.PFM_SAO_CAU}ms`);
    expect(el.style.getPropertyValue('--nhip-pfm-sao-vanh')).toBe(`${NHIP.PFM_SAO_VANH}ms`);
    expect(el.style.getPropertyValue('--nhip-pfm-khay-nhay')).toBe(`${NHIP.PFM_KHAY_NHAY}ms`);
  });

  it('⭐⭐ MỌI `var(--nhip-…)` mà CSS của tầng mới dùng đều có người khai trong `capNhipVaoCss` (quên khai ⇒ rơi về dự phòng, im lặng)', () => {
    const el = document.createElement('div');
    capNhipVaoCss(el);
    const dung = new Set<string>();
    for (const tep of [
      'components/pfm/KhungPfm.module.css', 'components/pfm/PfmBento.module.css', 'components/pfm/BanTien.module.css',
      'screens/tai-chinh/HuBento.module.css', 'screens/tai-chinh/GuongBento.module.css', 'screens/tai-chinh/TheBento.module.css',
    ]) {
      for (const m of doc(`../src/${tep}`).replace(/\/\*[\s\S]*?\*\//g, ' ').matchAll(/var\((--nhip-[a-z0-9-]+)/g)) dung.add(m[1]!);
    }
    expect(dung.size, 'phép quét không tìm thấy nhịp nào — bài đang canh số không').toBeGreaterThan(5);
    for (const ten of dung) expect(el.style.getPropertyValue(ten), `${ten} chưa được khai ở capNhipVaoCss`).not.toBe('');
  });
});

/* ═══ §V — A10 ════════════════════════════════════════════════════════════════════════════════ */

describe('§V — ⭐⭐⭐ A10: chữ của bốn tab bento nằm trong tầm quét', () => {
  it('mọi chuỗi `CHU_BENTO` có mặt trong `moiChuoiPfm()`', () => {
    const quet = new Set(moiChuoiPfm());
    for (const [k, v] of Object.entries(CHU_BENTO)) expect(quet.has(v), `CHU_BENTO.${k}: "${v}" chưa nằm trong tầm quét A10`).toBe(true);
    expect(Object.keys(CHU_BENTO).length, 'bảng rỗng làm bài trên xanh mà chẳng chứng minh gì').toBeGreaterThan(150);
  });
});
