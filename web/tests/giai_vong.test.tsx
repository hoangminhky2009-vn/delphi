/**
 * D401 — GIẢI VÒNG: xu các ghế bay vào giải ở bước CHIA QUỸ (trước khi lá lật), hộp "Ăn chia cược" rơi ra từ chính
 * cái giải ấy ở bước LÃI/LỖ.
 *
 * Founder 24/09 chốt A: *"ở bước chia quỹ (trước khi lật lá), xu từ các ghế bay vào giải. Tới bước LÃI/LỖ, hộp "Ăn
 * chia cược" bay ra từ chính cái giải đó. Mỗi bước vẫn chỉ một tiêu điểm."* — và trước đó *"trả trước lá là lộ ai
 * thắng"*. Canh năm điều: (1) xu vẽ mức GÓP của server, không lộ hạng/phần chia; (2) bước chia quỹ đủ dài cho viên
 * cuối đáp mà cả chuỗi vẫn gọn trong pha ĐỌC; (3) hộp GIẢI giữ con số cũ tới đúng lúc xu vào đủ, xu được dọn bằng
 * đồng hồ (không chờ `onfinish`); (4) hộp "Ăn chia cược" bay từ giải về chỗ nó và báo giải cạn đúng một lần; (5) dáng
 * bay là MỘT nguồn cho Shop, xu và hộp.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { act, render } from '@testing-library/react';
import { SO_GHE_MAX } from '@config/holdem';
import { CO_XU_BAY, GiaiVong, mocGiaiDu, NAC_SO_LE, XU_CHUI_VAO } from '../src/components/holdem/GiaiVong';
import { KhoanNoi } from '../src/components/holdem/KhoanNoi';
import type { KetQuaGheDTO, KetQuaVongDTO } from '../src/api/holdem';
import { EASING_BAY, khungBay, VOM_BAY } from '../src/lib/duong_bay';
import { gheNopCuaVong, KHOAN_TU_GIAI } from '../src/lib/giai_vong';
import { khoanLaiLo, khoanNoiCuaVong } from '../src/lib/khoan_lai_lo';
import {
  KHOAN_NOI_TOI_DA, lichKetQua, mocKhoanNoiVao, NGHI_BUOC_KQ, NHIP, thoiLuongChiaQuy, thoiLuongKhoanNoi,
  thoiLuongTraGiai, XU_TOI_DA_MOI_GHE, xuTraTheoHang,
} from '../src/lib/nhip';

const doc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const khongChuThich = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ghe = (ghe_id: string, cam_ket: number, pnl_bp = 0): KetQuaGheDTO => ({
  ghe_id, pnl_bp, da_cat_lo: false, cam_ket, von_truoc: 10_000, von_sau: 10_000, hanh_dong: 'giu_vi_the', da_hit: false,
});

/* ── WAAPI giả: ghi lại mọi lần gọi, KHÔNG BAO GIỜ tự kết thúc (khuôn hat_pixel.test.ts — D356). ── */
type LanGoi = { el: Element; khung: Keyframe[]; tuyChon: KeyframeAnimationOptions };
let goi: LanGoi[] = [];
const animateGoc = (Element.prototype as { animate?: unknown }).animate;
const rectGoc = Element.prototype.getBoundingClientRect;
beforeEach(() => {
  goi = [];
  (Element.prototype as unknown as { animate: unknown }).animate = vi.fn(function animateGia(
    this: Element, khung: Keyframe[], tuyChon: KeyframeAnimationOptions,
  ) {
    goi.push({ el: this, khung, tuyChon });
    return { cancel: vi.fn(), finish: vi.fn(), onfinish: null } as unknown as Animation;
  });
  // Toạ độ đọc từ `data-x`/`data-y` của chính nó hoặc tổ tiên gần nhất — jsdom không dàn trang (mọi hộp 0×0 ở gốc).
  Element.prototype.getBoundingClientRect = function rectGia(this: Element) {
    const moc = this.closest('[data-x]');
    const x = Number(moc?.getAttribute('data-x') ?? 0);
    const y = Number(moc?.getAttribute('data-y') ?? 0);
    return { left: x, top: y, width: 20, height: 10, right: x + 20, bottom: y + 10, x, y, toJSON: () => ({}) } as DOMRect;
  };
});
afterEach(() => {
  vi.useRealTimers();
  if (animateGoc) (Element.prototype as unknown as { animate: unknown }).animate = animateGoc;
  else delete (Element.prototype as { animate?: unknown }).animate;
  Element.prototype.getBoundingClientRect = rectGoc;
  document.body.innerHTML = '';
});

const coLop = (el: Element, ten: string) => String(el.className).split(' ').some((c) => c.startsWith(`_${ten}_`));
const xuTrenManHinh = () => [...document.body.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')].filter((e) => coLop(e, 'xu'));

describe('I. Xu vẽ mức GÓP của server — không lộ hạng, không lộ phần chia', () => {
  it('⭐ chỉ ghế có góp; ghế mình trước; nền 1 viên · hơn nền 2 · từ gấp đôi 3 (trần)', () => {
    const kq = {
      cua_ban: ghe('ban', 500),
      cua_doi_thu: [ghe('b1', 0), ghe('b2', 750), ghe('b3', 1000), ghe('b4', 5000), ghe('b5', 500)],
    };
    expect(gheNopCuaVong(kq)).toEqual([
      { ghe: 'ban', xu: 1 }, { ghe: 'b2', xu: 2 }, { ghe: 'b3', xu: 3 }, { ghe: 'b4', xu: XU_TOI_DA_MOI_GHE }, { ghe: 'b5', xu: 1 },
    ]);
  });

  it('⭐ kết quả vòng (lãi/lỗ, ai thắng) KHÔNG đổi được một viên xu nào — xu chỉ kể chuyện góp', () => {
    const a = { cua_ban: ghe('ban', 500, 900), cua_doi_thu: [ghe('b1', 500, -700), ghe('b2', 1000, 10)] };
    const b = { cua_ban: ghe('ban', 500, -900), cua_doi_thu: [ghe('b1', 500, 700), ghe('b2', 1000, -10)] };
    expect(gheNopCuaVong(a)).toEqual(gheNopCuaVong(b));
    expect(Object.keys(gheNopCuaVong(a)[0]!).sort()).toEqual(['ghe', 'xu']);
  });

  it('không ai góp (hoặc không có ghế mình) vẫn chạy được', () => {
    expect(gheNopCuaVong({ cua_ban: null, cua_doi_thu: [ghe('b1', 0)] })).toEqual([]);
    expect(gheNopCuaVong({ cua_ban: null, cua_doi_thu: [ghe('b1', 500)] })).toEqual([{ ghe: 'b1', xu: 1 }]);
  });
});

describe('II. Bước CHIA QUỸ trong nhịp kết quả (A11.26)', () => {
  const buoc = (l: ReturnType<typeof lichKetQua>, b: string) => l.find((x) => x.buoc === b)!;

  it('⭐ 0 ghế nộp ⇒ 0 ms (không bắt chờ khoảng trống); n ghế ⇒ `thoiLuongChiaQuy(n)`', () => {
    expect(buoc(lichKetQua({ coTin: false, giamChuyenDong: false }), 'chia_quy').ms).toBe(0);
    expect(buoc(lichKetQua({ soGheNop: 0, coTin: false, giamChuyenDong: false }), 'chia_quy').ms).toBe(0);
    expect(buoc(lichKetQua({ soGheNop: 5, coTin: false, giamChuyenDong: false }), 'chia_quy').ms).toBe(thoiLuongChiaQuy(5));
    expect(thoiLuongChiaQuy(5)).toBeGreaterThan(thoiLuongChiaQuy(4));
  });

  it('⭐ bước đủ dài: viên CUỐI của ghế cuối (đủ trần viên) đáp, còn giữ GIAI_GIU để đọc + một khoảng lặng', () => {
    for (let n = 1; n <= SO_GHE_MAX; n += 1) {
      const du = mocGiaiDu(Array.from({ length: n }, () => XU_TOI_DA_MOI_GHE));
      expect(du + NHIP.GIAI_GIU + NGHI_BUOC_KQ, `bàn ${n} ghế`).toBeLessThanOrEqual(thoiLuongChiaQuy(n));
    }
  });

  it('⭐ ca dài nhất (bàn đủ ghế, ghế nào cũng 3 viên + ô tin + đủ trần hộp khoản nổi) vẫn dưới 15 s pha ĐỌC', () => {
    const l = lichKetQua({ soGheNop: SO_GHE_MAX, coTin: true, giamChuyenDong: false, soKhoan: KHOAN_NOI_TOI_DA });
    const cuoi = l[l.length - 1]!;
    expect(cuoi.batDau + cuoi.ms).toBeLessThan(15_000);
  });

  it('chia quỹ đứng TRƯỚC lá lật; giảm chuyển động: 0 ms', () => {
    const l = lichKetQua({ soGheNop: 5, coTin: false, giamChuyenDong: false });
    expect(buoc(l, 'lat_la').batDau).toBe(thoiLuongChiaQuy(5));
    expect(buoc(lichKetQua({ soGheNop: 8, coTin: true, giamChuyenDong: true }), 'chia_quy').ms).toBe(0);
  });
});

/** Dải ghế giả theo thứ tự DOM `thuTu`, ghế thứ i đứng ở x = 40·i, y = 400; hộp GIẢI ở (300, 20). */
function dung(o: {
  thuTu: string[]; so: number; tuSo?: number; pha: 'nghi' | 'nop' | 'tra'; gheNop?: { ghe: string; xu: number }[];
  traVe?: { ghe: string; hang: number; tien: number; xu?: number }[]; lan?: number; giam?: boolean; laXu?: boolean;
}) {
  return (
    <>
      <div data-tap="doi-thu">
        {o.thuTu.map((g, i) => <button key={g} type="button" data-ghe={g} data-x={40 * i} data-y={400} />)}
      </div>
      <span data-x={300} data-y={20} id="boc">
        <GiaiVong so={o.so} tuSo={o.tuSo} pha={o.pha} gheNop={o.gheNop ?? []} traVe={o.traVe ?? []} lan={o.lan ?? 4}
          giamChuyenDong={o.giam ?? false} laXu={o.laXu ?? false} />
      </span>
    </>
  );
}
const soTren = (c: HTMLElement) => c.querySelector('[data-giai-vong]')!.lastElementChild!.textContent;

describe('III. Hộp GIẢI — xu bay vào ở bước CHIA QUỸ', () => {
  it('nghỉ: hiện đúng con số server, không bay gì', () => {
    const { container } = render(dung({ thuTu: ['ban', 'b1'], so: 2500, pha: 'nghi' }));
    expect(soTren(container)).toBe('2.500');
    expect(container.querySelector('[data-giai-vong]')!.getAttribute('aria-label')).toBe('Giải vòng 2.500');
    expect(xuTrenManHinh().length).toBe(0);
  });

  it('⭐ GIỮ số cũ tới đúng lúc viên cuối đáp, rồi mới chạy tới tổng server + quầng vàng', () => {
    vi.useFakeTimers();
    // Ghế CUỐI thả 3 viên: viên chót đáp muộn hơn viên đầu của nó đúng 2·XU_CACH_XU — số phải chờ cả viên ấy.
    const gheNop = [{ ghe: 'ban', xu: 1 }, { ghe: 'b1', xu: 2 }, { ghe: 'b2', xu: 3 }];
    const { container, rerender } = render(dung({ thuTu: ['ban', 'b1', 'b2'], so: 2500, pha: 'nghi' }));
    rerender(dung({ thuTu: ['ban', 'b1', 'b2'], so: 2503, tuSo: 2500, pha: 'nop', gheNop }));
    const du = mocGiaiDu([1, 2, 3]);
    expect(du).toBe(2 * NHIP.XU_CACH_GHE + 2 * NHIP.XU_CACH_XU + NHIP.XU_VAO_GIAI);
    act(() => { vi.advanceTimersByTime(du - 1); });
    expect(soTren(container), 'số nhảy trước khi xu vào đủ').toBe('2.500');
    const hop = container.querySelector('[data-giai-vong]')!;
    expect(coLop(hop, 'sang')).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(coLop(hop, 'sang'), 'giải đủ mà không loé').toBe(true);
    act(() => { vi.advanceTimersByTime(6 * 40 + 10); });
    expect(soTren(container)).toBe('2.503');
  });

  it('⭐ xu bay từ TỪNG ghế theo thứ tự dải (trái → phải), số viên đúng mức góp, đích là hộp GIẢI', () => {
    vi.useFakeTimers();
    // Server kể b1 trước ban — dải thì ban đứng đầu: thác xu phải theo dải.
    const gheNop = [{ ghe: 'b1', xu: 2 }, { ghe: 'ban', xu: 1 }];
    render(dung({ thuTu: ['ban', 'x', 'b1'], so: 1500, tuSo: 1000, pha: 'nop', gheNop }));
    act(() => { vi.advanceTimersByTime(0); });
    const dau = xuTrenManHinh();
    expect(dau.length, 'ghế đầu dải thả trước').toBe(1);
    expect(dau[0]!.style.left).toBe(`${0 + 10 - CO_XU_BAY / 2}px`);   // tâm ghế `ban` (x 0, rộng 20) − nửa viên xu
    expect(dau[0]!.style.position, 'xu không bay tự do trên màn').toBe('fixed');
    act(() => { vi.advanceTimersByTime(NHIP.XU_CACH_GHE); });
    const ca = xuTrenManHinh();
    expect(ca.length, 'ghế `x` không góp — không được thả xu; `b1` thả 2').toBe(3);
    expect(ca.slice(1).every((c) => c.style.left === `${80 + 10 - CO_XU_BAY / 2}px`)).toBe(true);
    // Mọi viên bay tới tâm hộp GIẢI (300+10, 20+5) theo dáng bay chung.
    const bay = goi.filter((g) => coLop(g.el, 'xu'));
    expect(bay.length).toBe(3);
    for (const g of bay) {
      expect(g.tuyChon.easing).toBe(EASING_BAY);
      expect(g.tuyChon.duration).toBe(NHIP.XU_VAO_GIAI);
      const cuoi = String(g.khung[g.khung.length - 1]!.transform);
      const tu = (g.el as HTMLElement).style.left === `${10 - CO_XU_BAY / 2}px` ? { x: 10, y: 405 } : { x: 90, y: 405 };
      expect(cuoi).toBe(`translate(${310 - tu.x}px,${25 - tu.y}px) scale(${XU_CHUI_VAO.scale})`);
      // Xu CHUI VÀO giải (nhỏ + mờ ở cuối đường) — soi màn 24/09: đáp nguyên cỡ thì tám viên chất đống che con số.
      expect(Number(g.khung[g.khung.length - 1]!.opacity)).toBe(XU_CHUI_VAO.opacity);
      expect(Number(g.khung[0]!.opacity)).toBe(1);
      expect(XU_CHUI_VAO.scale).toBeLessThan(1);
      expect(XU_CHUI_VAO.opacity).toBeLessThan(1);
    }
    // Viên thứ hai của cùng một ghế bay trễ đúng một CÁCH_XU.
    expect(bay.map((g) => g.tuyChon.delay)).toEqual([0, 0, NHIP.XU_CACH_XU]);
  });

  it('⭐⭐ xu được dọn bằng ĐỒNG HỒ dù animate() không bao giờ kết thúc (D356)', () => {
    vi.useFakeTimers();
    render(dung({ thuTu: ['ban', 'b1'], so: 1000, tuSo: 1000, pha: 'nop', gheNop: [{ ghe: 'ban', xu: 3 }, { ghe: 'b1', xu: 3 }] }));
    act(() => { vi.advanceTimersByTime(NHIP.XU_CACH_GHE); });
    expect(xuTrenManHinh().length).toBe(6);
    // Viên cuối (ghế 2, viên 3) chạm miệng giải đúng lúc XU_CACH_GHE + 2·XU_CACH_XU + XU_VAO_GIAI — và biến mất ngay đó.
    act(() => { vi.advanceTimersByTime(2 * NHIP.XU_CACH_XU + NHIP.XU_VAO_GIAI - 1); });
    expect(xuTrenManHinh().length, 'viên cuối biến mất trước khi chạm giải').toBe(1);
    act(() => { vi.advanceTimersByTime(1); });
    expect(xuTrenManHinh().length, 'xu kẹt lại DOM').toBe(0);
  });

  it('⭐ hộp NẢY một nhịp mỗi lần một ghế đáp (steps — vật), không nảy trước khi đáp', () => {
    vi.useFakeTimers();
    const { container } = render(dung({ thuTu: ['ban', 'b1'], so: 1000, tuSo: 1000, pha: 'nop', gheNop: [{ ghe: 'ban', xu: 1 }, { ghe: 'b1', xu: 1 }] }));
    const hop = container.querySelector('[data-giai-vong]')!;
    const nay = () => goi.filter((g) => g.el === hop);
    act(() => { vi.advanceTimersByTime(NHIP.XU_VAO_GIAI - 1); });
    expect(nay().length).toBe(0);
    act(() => { vi.advanceTimersByTime(1 + NHIP.XU_CACH_GHE); });
    expect(nay().length).toBe(2);
    expect(nay()[0]!.tuyChon.duration).toBe(NHIP.GIAI_NAY);
    expect(String(nay()[0]!.khung[0]!.easing)).toMatch(/^steps\(/);
  });

  it('rời bước chia quỹ giữa chừng (bị cắt ngang) ⇒ không còn viên nào bay lạc', () => {
    vi.useFakeTimers();
    const gheNop = [{ ghe: 'ban', xu: 3 }, { ghe: 'b1', xu: 3 }];
    const { rerender } = render(dung({ thuTu: ['ban', 'b1'], so: 1000, tuSo: 900, pha: 'nop', gheNop }));
    act(() => { vi.advanceTimersByTime(10); });
    expect(xuTrenManHinh().length).toBe(3);
    rerender(dung({ thuTu: ['ban', 'b1'], so: 0, pha: 'nghi', gheNop }));
    expect(xuTrenManHinh().length).toBe(0);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(xuTrenManHinh().length).toBe(0);
  });

  it('giảm chuyển động: không xu, không nảy, số đứng thẳng ở tổng server', () => {
    vi.useFakeTimers();
    const { container } = render(dung({
      thuTu: ['ban'], so: 1203, tuSo: 1000, pha: 'nop', gheNop: [{ ghe: 'ban', xu: 1 }], giam: true,
    }));
    act(() => { vi.advanceTimersByTime(400); });
    expect(xuTrenManHinh().length).toBe(0);
    expect(goi.length).toBe(0);
    expect(soTren(container)).toBe('1.203');
  });
});

const KQ: KetQuaVongDTO = {
  vong: 4, o: { kind: 'giai_doan', giai_doan: 'tang' }, tin_gia_lo: null, quy_vong: 2503,
  ghe_thang: 'ban', chay_vong_nay: [],
  cua_ban: { ...ghe('ban', 500), tien_theo_ma: { vang: 870 } },
  cua_doi_thu: [], phi_cua_ban: null, ty_le_cat_lo_bp: 0,
  cau_noi_nav: [{ id: 'nop_quy', tien: -500 }, { id: 'quy_vong', tien: 1253 }, { id: 'trong_vong', tien: -40 }],
};
const TAI_SAN = [{ id: 'vang', label: 'Vàng', icon: '🥇', nhom: 'phong_thu' as const, thanh_khoan: 'vua' as const, bien_dong_bp: 240 }];

describe('IV. Hộp "Ăn chia cược" rơi ra từ GIẢI ở bước LÃI/LỖ', () => {
  const khoan = khoanNoiCuaVong(khoanLaiLo(KQ, TAI_SAN), KHOAN_NOI_TOI_DA);
  const iQuy = khoan.findIndex((k) => k.khoa === KHOAN_TU_GIAI);

  it('khoá trỏ đúng dòng cầu nối `quy_vong` của danh sách khoản', () => {
    expect(KHOAN_TU_GIAI).toBe('cn:quy_vong');
    expect(iQuy).toBeGreaterThan(0);
  });

  it('⭐ báo giải cạn ĐÚNG MỘT LẦN, đúng lúc hộp ấy vào hàng — không sớm hơn', () => {
    vi.useFakeTimers();
    const khiRa = vi.fn();
    render(
      <>
        <div data-giai-vong="nghi" data-x={300} data-y={20} />
        <KhoanNoi khoan={khoan} goc={10_000} giamChuyenDong={false} tuGiai={{ khoa: KHOAN_TU_GIAI, khiRa }} />
      </>,
    );
    act(() => { vi.advanceTimersByTime(iQuy * NHIP.KHOAN_NOI_CACH - 1); });
    expect(khiRa).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(khiRa).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(NHIP.KHOAN_NOI_CACH * 10); });
    expect(khiRa, 'hộp sau vào hàng mà giải bị báo cạn lần nữa').toHaveBeenCalledTimes(1);
  });

  it('⭐ chỉ hộp ấy nằm trong khung BAY, bay từ tâm hộp GIẢI về chỗ nó, dáng bay chung', () => {
    vi.useFakeTimers();
    const { container } = render(
      <>
        <div data-giai-vong="nghi" data-x={300} data-y={20} />
        <KhoanNoi khoan={khoan} goc={10_000} giamChuyenDong={false} tuGiai={{ khoa: KHOAN_TU_GIAI }} />
      </>,
    );
    act(() => { vi.advanceTimersByTime(NHIP.KHOAN_NOI_CACH * khoan.length); });
    const bay = container.querySelectorAll('[data-bay-tu-giai]');
    expect(bay.length).toBe(1);
    const hop = bay[0]!.querySelector('[data-khoan]')!;
    expect(hop.getAttribute('data-khoan')).toBe(KHOAN_TU_GIAI);
    expect(coLop(hop, 'hopRa'), 'hộp rơi từ giải phải mang vòng đời không mờ vào').toBe(true);
    for (const h of container.querySelectorAll('[data-khoan]')) {
      if (h === hop) continue;
      expect(coLop(h.parentElement!, 'o'), `${h.getAttribute('data-khoan')} bị bọc khung bay`).toBe(true);
      expect(coLop(h, 'hop')).toBe(true);
    }
    const g = goi.find((x) => x.el === bay[0]);
    expect(g, 'khung bay không được animate').toBeDefined();
    // Khung bay đứng ở (0,0) cỡ 20×10 ⇒ tâm (10,5); hộp GIẢI tâm (310,25).
    expect(String(g!.khung[0]!.transform)).toBe('translate(300px,20px)');
    expect(String(g!.khung[g!.khung.length - 1]!.transform)).toBe('translate(0px,0px)');
    expect(g!.tuyChon.duration).toBe(NHIP.GIAI_TRA_BAY);
    expect(g!.tuyChon.easing).toBe(EASING_BAY);
  });

  it('không có hộp GIẢI trên màn ⇒ hộp đứng tại chỗ, nhưng giải VẪN được báo cạn', () => {
    vi.useFakeTimers();
    const khiRa = vi.fn();
    render(<KhoanNoi khoan={khoan} goc={10_000} giamChuyenDong={false} tuGiai={{ khoa: KHOAN_TU_GIAI, khiRa }} />);
    act(() => { vi.advanceTimersByTime(NHIP.KHOAN_NOI_CACH * khoan.length); });
    expect(khiRa).toHaveBeenCalledTimes(1);
    expect(goi.length).toBe(0);
  });

  it('⭐ CSS: vòng đời hộp rơi hiện NGAY ở giải (không mờ vào), chạm cỡ thật đúng lúc khung bay đáp', () => {
    const motion = khongChuThich(doc('src/styles/motion.module.css'));
    const kf = /@keyframes khoanNoiRaGiaiLen \{([\s\S]*?)\n\}/.exec(motion)?.[1] ?? '';
    expect(kf, 'không thấy keyframe').not.toBe('');
    // Neo ĐẦU DÒNG: không neo thì '70% { opacity: 1;' cũng khớp '0% { opacity: 1;' — tiêm lỗi 24/09 bắt bài rỗng này.
    expect(kf).toMatch(/^\s*0% \{ opacity: 1;/m);
    const dap = /(\d+)% \{[^}]*scale\(1\.06\)/.exec(kf);
    expect(dap, 'không thấy mốc đáp scale(1.06)').not.toBeNull();
    expect(Math.abs((Number(dap![1]) / 100) * NHIP.KHOAN_NOI_SONG - NHIP.GIAI_TRA_BAY)).toBeLessThanOrEqual(40);
    expect(motion).toMatch(/\.khoanNoiRaGiai \{\s*animation: khoanNoiRaGiaiLen var\(--nhip-khoan-noi-song/);
    // Giảm chuyển động tắt cả hộp rơi.
    const tat = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)$/.exec(motion)?.[1] ?? '';
    expect(tat).toMatch(/\.khoanNoiRaGiai\b/);
    const kn = khongChuThich(doc('src/components/holdem/KhoanNoi.module.css'));
    expect(kn).toMatch(/\.hopRa \{\s*composes: vat;\s*composes: khoanNoiRaGiai from/);
    expect(kn).toMatch(/\.hop \{\s*composes: vat;\s*composes: khoanNoi from/);
  });
});

const noiTrenManHinh = () => [...document.body.querySelectorAll<HTMLElement>('[data-giai-noi]')];

describe('III½. D402 — GIẢI TRẢ VỀ GHẾ ở bước LÃI/LỖ (founder: "TRẢ giải về 3 ghế đầu cùng nhịp LÃI/LỖ")', () => {
  // Dải: ban (x 0) · b1 (x 40) · b2 (x 80) · b3 (x 120). Server trả: b2 hạng 1, ban hạng 2, b1 hạng 3.
  const TRA = [{ ghe: 'ban', hang: 2, tien: 1310 }, { ghe: 'b2', hang: 1, tien: 1640 }, { ghe: 'b1', hang: 3, tien: 982 }];
  const THU_TU = ['ban', 'b1', 'b2', 'b3'];

  it('⭐ trả theo HẠNG (1 → 2 → 3), không theo dải; số viên theo hạng; ghế mình không nhận xu (đã có hộp "Ăn chia cược")', () => {
    vi.useFakeTimers();
    render(dung({ thuTu: THU_TU, so: 0, pha: 'tra', traVe: TRA }));
    act(() => { vi.advanceTimersByTime(0); });
    // Hạng 1 (b2) thả trước — ba viên, từ tâm hộp GIẢI (310, 25).
    expect(xuTrenManHinh().length).toBe(xuTraTheoHang(1));
    expect(xuTrenManHinh().every((c) => c.style.left === `${310 - CO_XU_BAY / 2}px`), 'xu không xuất phát từ GIẢI').toBe(true);
    const bay = goi.filter((g) => coLop(g.el, 'xu'));
    expect(String(bay[0]!.khung[bay[0]!.khung.length - 1]!.transform), 'xu hạng 1 không bay về ghế b2')
      .toBe(`translate(${90 - 310}px,${405 - 25}px) scale(${XU_CHUI_VAO.scale})`);
    // Hạng 2 là ghế mình ⇒ tới lượt cũng KHÔNG thả xu.
    act(() => { vi.advanceTimersByTime(NHIP.GIAI_TRA_CACH); });
    expect(xuTrenManHinh().length).toBe(xuTraTheoHang(1));
    // Hạng 3 (b1) một viên.
    act(() => { vi.advanceTimersByTime(NHIP.GIAI_TRA_CACH); });
    expect(xuTrenManHinh().length).toBe(xuTraTheoHang(1) + xuTraTheoHang(3));
    expect(xuTraTheoHang(1)).toBeGreaterThan(xuTraTheoHang(2));
  });

  it('⭐ nhãn "hạng · +tiền" nổi ĐÚNG thứ tự hạng (ghế mình cũng chờ như ghế có xu), đúng số server', () => {
    vi.useFakeTimers();
    render(dung({ thuTu: THU_TU, so: 0, pha: 'tra', traVe: TRA }));
    act(() => { vi.advanceTimersByTime(NHIP.XU_VAO_GIAI - 1); });
    expect(noiTrenManHinh().length, 'nhãn bật trước khi xu đáp').toBe(0);
    act(() => { vi.advanceTimersByTime(1); });
    expect(noiTrenManHinh().map((n) => n.getAttribute('data-giai-noi'))).toEqual(['b2']);
    act(() => { vi.advanceTimersByTime(NHIP.GIAI_TRA_CACH); });
    expect(noiTrenManHinh().map((n) => n.getAttribute('data-giai-noi')), 'nhãn ghế mình nhảy cóc thứ tự hạng')
      .toEqual(['b2', 'ban']);
    act(() => { vi.advanceTimersByTime(NHIP.GIAI_TRA_CACH); });
    const noi = noiTrenManHinh();
    expect(noi.map((n) => n.getAttribute('data-giai-noi'))).toEqual(['b2', 'ban', 'b1']);
    expect(noi.map((n) => n.textContent)).toEqual(['1+1.640', '2+1.310', '3+982']);
  });

  it('⭐ ghế lẻ nổi cao hơn một nấc (hai ghế liền nhau cùng nhận không đè nhãn) · dọn bằng đồng hồ', () => {
    vi.useFakeTimers();
    render(dung({ thuTu: THU_TU, so: 0, pha: 'tra', traVe: TRA }));
    act(() => { vi.advanceTimersByTime(NHIP.XU_VAO_GIAI + 2 * NHIP.GIAI_TRA_CACH); });
    const top = Object.fromEntries(noiTrenManHinh().map((n) => [n.getAttribute('data-giai-noi'), n.style.top]));
    // Ghế cao 10 ⇒ neo 400 + 4; ghế lẻ (b1 — vị trí 1) nổi cao hơn NAC_SO_LE.
    expect(top.ban).toBe('404px');
    expect(top.b2).toBe('404px');
    expect(top.b1).toBe(`${404 - NAC_SO_LE}px`);
    act(() => { vi.advanceTimersByTime(NHIP.GIAI_NOI_SONG); });
    expect(noiTrenManHinh().length, 'nhãn kẹt lại DOM').toBe(0);
    expect(xuTrenManHinh().length, 'xu kẹt lại DOM').toBe(0);
  });

  it('rời bước giữa chừng ⇒ dọn sạch · giảm chuyển động ⇒ không xu, không nhãn', () => {
    vi.useFakeTimers();
    const { rerender } = render(dung({ thuTu: THU_TU, so: 0, pha: 'tra', traVe: TRA }));
    act(() => { vi.advanceTimersByTime(NHIP.XU_VAO_GIAI + 10); });
    expect(noiTrenManHinh().length + xuTrenManHinh().length).toBeGreaterThan(0);
    rerender(dung({ thuTu: THU_TU, so: 0, pha: 'nghi', traVe: TRA }));
    expect(noiTrenManHinh().length + xuTrenManHinh().length).toBe(0);
    document.body.innerHTML = '';
    goi = [];
    render(dung({ thuTu: THU_TU, so: 0, pha: 'tra', traVe: TRA, giam: true }));
    // Kiểm ĐÚNG lúc nhãn lẽ ra đã bật — đợi 5 s thì xu/nhãn đã tự dọn hết, bài xanh mà không canh gì (tiêm lỗi 24/09).
    act(() => { vi.advanceTimersByTime(NHIP.XU_VAO_GIAI + 10); });
    expect(noiTrenManHinh().length + xuTrenManHinh().length, 'giảm chuyển động mà vẫn trả xu/nhãn').toBe(0);
    expect(goi.length, 'giảm chuyển động mà vẫn gọi hoạt ảnh').toBe(0);
  });

  it('⭐ lịch: bước LÃI/LỖ chờ đủ cú trả (tính từ lúc giải cạn) + khoảng lặng; ca dài nhất vẫn < 15 s', () => {
    const buoc = (l: ReturnType<typeof lichKetQua>, b: string) => l.find((x) => x.buoc === b)!;
    const luc = mocKhoanNoiVao(4);
    const l = lichKetQua({ coTin: false, giamChuyenDong: false, soKhoan: 5, traGiai: { luc, soGhe: 5 } });
    expect(buoc(l, 'lai_lo').ms).toBe(Math.max(thoiLuongKhoanNoi(5), luc + thoiLuongTraGiai(5) + NGHI_BUOC_KQ));
    expect(buoc(l, 'lai_lo').ms, 'bước LÃI/LỖ hết trước khi nhãn cuối tắt').toBeGreaterThan(luc + thoiLuongTraGiai(5));
    const xau = lichKetQua({
      soGheNop: SO_GHE_MAX, coTin: true, giamChuyenDong: false, soKhoan: KHOAN_NOI_TOI_DA,
      traGiai: { luc: mocKhoanNoiVao(KHOAN_NOI_TOI_DA - 1), soGhe: SO_GHE_MAX },
    });
    const cuoi = xau[xau.length - 1]!;
    expect(cuoi.batDau + cuoi.ms).toBeLessThan(15_000);
  });
});

describe('III¾. D584 — giải vòng trả bằng XU TRAIT (khoá `giai_xu`)', () => {
  const TRA_XU = [{ ghe: 'ban', hang: 2, tien: 0, xu: 2 }, { ghe: 'b2', hang: 1, tien: 0, xu: 3 }, { ghe: 'b1', hang: 3, tien: 0, xu: 1 }];
  it('⭐ hộp GIẢI nói số XU (không định dạng tiền); nhãn ghế "hạng · +n xu" theo số server; ghế mình CŨNG nhận xu bay (không còn hộp "Ăn chia cược")', () => {
    vi.useFakeTimers();
    const r = render(dung({ thuTu: ['ban', 'b1', 'b2', 'b3'], so: 6, pha: 'nghi', laXu: true }));
    expect(r.container.querySelector('[data-giai-vong]')!.textContent).toContain('6 XU');
    r.unmount();
    render(dung({ thuTu: ['ban', 'b1', 'b2', 'b3'], so: 0, pha: 'tra', traVe: TRA_XU, laXu: true }));
    act(() => { vi.advanceTimersByTime(NHIP.GIAI_TRA_CACH); });
    expect(xuTrenManHinh().length, 'ghế mình (hạng 2) không nhận xu bay').toBe(xuTraTheoHang(1) + xuTraTheoHang(2));
    act(() => { vi.advanceTimersByTime(NHIP.XU_VAO_GIAI + NHIP.GIAI_TRA_CACH); });
    expect(noiTrenManHinh().map((n) => n.textContent)).toEqual(['1+3 xu', '2+2 xu', '3+1 xu']);
  });
});

describe('IV½. Dáng bay chung `khungBay`', () => {
  it('⭐ giữa đường NHẤC lên đúng VOM_BAY; không `cuoi` thì chỉ `translate` (chip Shop giữ nguyên từ 13/09)', () => {
    const k = khungBay({ x: 0, y: 0 }, { x: 100, y: -200 });
    expect(k.map((x) => x.transform)).toEqual([
      'translate(0px,0px)', `translate(50px,${-100 - VOM_BAY}px)`, 'translate(100px,-200px)',
    ]);
    expect(k.every((x) => !('opacity' in x))).toBe(true);
  });

  it('`cuoi`: cỡ/độ đậm đi 1 → nửa chừng → đích, hai đầu ĐÚNG số', () => {
    const k = khungBay({ x: 0, y: 0 }, { x: 10, y: 10 }, 0, { scale: 0.4, opacity: 0.3 });
    expect(k.map((x) => x.transform)).toEqual([
      'translate(0px,0px) scale(1)', 'translate(5px,5px) scale(0.7)', 'translate(10px,10px) scale(0.4)',
    ]);
    expect(k.map((x) => x.opacity)).toEqual([1, 0.65, 0.3]);
  });
});

describe('V. Dây nối màn trận + một nguồn cho dáng bay', () => {
  const man = khongChuThich(doc('src/screens/holdem/AlphaDraftMatch.tsx'));

  it('⭐ lịch nhận số ghế nộp từ `gheNopCuaVong`; hộp GIẢI cuối hàng HUD; "Ăn chia cược" rơi từ giải', () => {
    expect(man).toMatch(/const soGheNop = kq \? gheNopCuaVong\(kq\)\.length : 0;/);
    expect(man).toMatch(/lichKetQua\(\{ soGheNop, coTin, giamChuyenDong: itMotion, soKhoan, doiMoiTruong, \.\.\.\(traGiai \? \{ traGiai \} : \{\}\) \}\)/);
    // Đồng hồ + GIẢI chung MỘT cụm phải không tự xuống dòng (soi màn 24/09: GIẢI rơi xuống dòng hai ở 375px).
    expect(man).toMatch(/<span className=\{s\.cumPhai\}>[\s\S]*?<span data-tap="dong-ho" className=\{s\.oDongHo\}>[\s\S]*?\{giai && \(\s*<span data-tap="giai-vong" className=\{s\.oGiai\}>\s*<GiaiVong/);
    expect(man).toMatch(/tuGiai=\{\{ khoa: KHOAN_TU_GIAI, khiRa: \(\) => setGiaiDaChia\(/);
    // 'nop' CHỈ ở bước chia quỹ; giải về 0 ở phong cách hoặc khi hộp đã rời giải.
    expect(man).toMatch(/const vuaChia = buocKq === 'lai_lo' && giaiDaChia === kq\.vong;/);
    // D584 — khoá giải bằng xu trait: con số là tổng xu server chia; vẫn cạn về 0 đúng hai bước ấy.
    expect(man).toMatch(/so: vuaChia \|\| buocKq === 'phong_cach' \? 0 : giaiLaXu \? tongXu : kq\.quy_vong/);
    // D402 — `tra` đúng lúc giải cạn ở bước LÃI/LỖ, danh sách nhận giải lấy thẳng `chia_quy_vong` của server.
    expect(man).toMatch(/pha: buocKq === 'chia_quy' \? 'nop' : vuaChia \? 'tra' : 'nghi'/);
    expect(man).toMatch(/traVe: \(kq\.chia_quy_vong \?\? \[\]\)\.map\(/);
    expect(man).toMatch(/traGiai = soGheNhan > 0 \? \{ luc: iQuy >= 0 \? mocKhoanNoiVao\(iQuy\) : 0, soGhe: soGheNhan \}/);
    // Không được chia gì ⇒ giải cạn ngay đầu bước LÃI/LỖ (không kẹt ở số đầy).
    expect(man).toMatch(/!khoanVong\.some\(\(k\) => k\.khoa === KHOAN_TU_GIAI\)\)\) setGiaiDaChia\(kq\.vong\)/);
  });

  it('⭐ hàng HUD giữ MỘT dòng: cụm phải xuống dòng như một khối, thanh đồng hồ 26px (12px dưới 375px)', () => {
    const css = khongChuThich(doc('src/screens/holdem/AlphaDraftMatch.module.css'));
    const cum = /\.cumPhai \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(cum).toMatch(/flex: 1 1 0;/);
    expect(cum).toMatch(/min-width: min-content;/);
    expect(/\.oGiai \{([^}]*)\}/.exec(css)?.[1] ?? '').toMatch(/flex-shrink: 0;/);
    const dh = khongChuThich(doc('src/components/holdem/DongHoVong.module.css'));
    const thanh = /\.thanh \{([^}]*)\}/.exec(dh)?.[1] ?? '';
    expect(thanh, 'thanh đồng hồ không còn cỡ demo 26px').toMatch(/(^|[^-])width: 26px;/);
    const hep = /@media \(max-width: 374\.98px\) \{\s*\.thanh \{ width: 12px; \}\s*\}/.exec(dh);
    expect(hep, 'màn < 375px mất nấc thanh 12px ⇒ ở 360px ca xấu nhất đẩy [đồng hồ · GIẢI] xuống dòng').not.toBeNull();
  });

  it('⭐ mặt bàn (bản đồ · tên chương · đếm bộ bài · lãi suất) GIỮ ảnh trước vòng tới bước LÁ LẬT', () => {
    // Soi màn 24/09: bản đồ đọc `st` mới ⇒ lá mới quay ngay lúc kết quả về, CHỒNG lên đàn xu đang bay vào giải.
    expect(man).toMatch(/const stBan = !daToiBuoc\(buocKq, 'lat_la'\) && ketQuaCho\?\.stTruoc \? ketQuaCho\.stTruoc : st;/);
    const map = /<MarketMap([\s\S]*?)\/>/.exec(man)?.[1] ?? '';
    // D585 — lá chờ màn (`cho_man.o`) chỉ ghép vào bản đồ TỪ bước LÁ LẬT (một cú lật, trên bàn, trước khi màn mở); trước đó vẫn đúng ảnh cũ.
    expect(map).toMatch(/daLat=\{daLatBan\}/);
    expect(man).toMatch(/const laChoMan = st\.cho_man\?\.o && !\('up' in st\.cho_man\.o\) && daToiBuoc\(buocKq, 'lat_la'\) \? st\.cho_man\.o : null;/);
    expect(man).toMatch(/const daLatBan = laChoMan \? \[\.\.\.stBan\.lich_su_o, laChoMan\] : stBan\.lich_su_o;/);
    expect(map).toMatch(/hienTai=\{stBan\.o_hien_tai\}/);
    expect(map).toMatch(/vong=\{stBan\.vong\}/);
    expect(map, 'bản đồ còn đọc `st` mới ở chỗ nào đó').not.toMatch(/[^A-Za-z]st\./);
    const chuong = /<ChuongHoi([\s\S]*?)\/>/.exec(man)?.[1] ?? '';
    expect(chuong).not.toMatch(/[^A-Za-z]st\./);
    expect(man).toMatch(/còn \{stBan\.bo_bai_con_lai\.con_lai\} ô/);
    expect(man).toMatch(/data-tap="lai-suat"/);
    expect(man).toMatch(/\{stBan\.lai_suat && \(\s*<button/);
  });

  it('⭐⭐ `composes` lớp CÙNG tệp phải trỏ lớp đã khai PHÍA TRÊN (vite từ chối dựng, vitest không báo)', () => {
    // Soi màn 24/09: `.hop { composes: vat; }` với `.vat` khai bên dưới ⇒ vite đỏ cả màn "referenced class name not
    // found", trong khi 64 bài vitest xanh. Bài này quét MỌI *.module.css của web/src.
    const tep: string[] = [];
    const di = (d: string) => {
      for (const t of readdirSync(d)) {
        const q = join(d, t);
        if (statSync(q).isDirectory()) di(q);
        else if (t.endsWith('.module.css')) tep.push(q);
      }
    };
    di(resolve(process.cwd(), 'src'));
    expect(tep.length).toBeGreaterThan(20);
    const loi: string[] = [];
    let soComposesCucBo = 0;
    for (const q of tep) {
      const css = khongChuThich(readFileSync(q, 'utf8'));
      for (const m of css.matchAll(/composes:\s*([^;]+);/g)) {
        if (/\bfrom\b/.test(m[1]!)) continue;
        soComposesCucBo += 1;
        for (const ten of m[1]!.trim().split(/\s+/)) {
          const khai = new RegExp(`(^|[\\s,}])\\.${ten}(?![\\w-])[^{;]*\\{`, 'm').exec(css);
          if (!khai || khai.index > m.index!) loi.push(`${q.replace(/.*[\\/]src[\\/]/, 'src/')}: composes ${ten}`);
        }
      }
    }
    expect(soComposesCucBo, 'bộ quét không thấy composes cục bộ nào — bài rỗng').toBeGreaterThan(0);
    expect(loi).toEqual([]);
  });

  it('dải ghế dán mã ghế lên từng nút (điểm xuất phát của xu)', () => {
    expect(khongChuThich(doc('src/components/holdem/DoiThuStrip.tsx'))).toMatch(/data-ghe=\{d\.ghe_id\}/);
  });

  it('⭐ hộp GIẢI CÙNG khuôn hộp đồng hồ (composes, không chép) + viền vàng', () => {
    const css = khongChuThich(doc('src/components/holdem/GiaiVong.module.css'));
    expect(css).toMatch(/\.hop \{\s*composes: hop from '\.\/DongHoVong\.module\.css';[^}]*var\(--border-gold\)/);
    // Xu bay là đồng xu pixel (`PixelIcon coin`, mẫu ẩn trong hộp) — không vẽ đồng xu thứ hai bằng CSS.
    const tsx = khongChuThich(doc('src/components/holdem/GiaiVong.tsx'));
    expect(tsx).toMatch(/<span ref=\{mauXuRef\} hidden><PixelIcon name="coin" size=\{CO_XU_BAY\} \/><\/span>/);
    expect(tsx).toMatch(/mau\.cloneNode\(true\)/);
  });

  it('⭐ MỘT dáng bay: Shop, xu nộp giải, hộp rơi từ giải cùng dùng `lib/duong_bay.ts`, không gõ lại đường cong', () => {
    for (const p of ['src/components/holdem/ShopManHinh.tsx', 'src/components/holdem/GiaiVong.tsx', 'src/components/holdem/KhoanNoi.tsx']) {
      const t = khongChuThich(doc(p));
      expect(t, `${p} không dùng khungBay`).toMatch(/khungBay\(/);
      expect(t, `${p} không dùng EASING_BAY`).toMatch(/EASING_BAY/);
      expect(t, `${p} gõ lại đường cong bay`).not.toMatch(/cubic-bezier\(0\.22, 0\.61, 0\.36, 1\)/);
    }
  });
});
