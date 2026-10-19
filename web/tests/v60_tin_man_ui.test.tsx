/**
 * D532 — TIN TRONG MÀN + LƯỚT SÓNG MUA TIN SỚM trên web (chép demo `veTin` · `veTruocMan` · `#tinThatRa` · `moKetQua`). Server + DB: `tests/v60_tin_api.test.ts`.
 * Client chỉ HIỂN THỊ: tin tới theo lô (ID chữ — D26), ghim chỉ hiện khi nhịp đang xem đã qua nhịp lộ; phí do server trả (C4).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ManMinigame } from '@/components/holdem/ManMinigame';
import { chuTin } from '@/lib/tin_man';

const LS = Array.from({ length: 20 }, () => [100, 101, 99, 100]);
const SO_LS = { vao: [], ra: [], hut: [], con_von: 4960, dang_cam: 0, tien_nut: { dao: 22, chot: 0 } };
const dauLs = (giayTruoc: number, them: object = {}) => ({
  vong: 2, ma: 'btc', von: 4960, dai: 'cang', nac: null, bat_dau: new Date(Date.now() - giayTruoc * 1000).toISOString(), gio_may: new Date().toISOString(),
  dem_ms: 4000, chay_ms: 34000, so_nhip: 480, cua_so_ms: 2000, phien_ban: 'x', lich_su: LS, loi_cam: ['luot_song'], la: 'luot_song', nut: ['dao', 'chot'], so: SO_LS, ...them,
});
const CHU = 'sk.tang_lai_suat.bao', CHU2 = 'nh.0';
const TIN_THAT = [{ ng: 'bao', chu: CHU, noi: -1 }];
const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
const dongMo = (manh: string) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(manh)); } }),
  { status: 200, headers: { 'content-type': 'application/x-ndjson' } });

/** Máy chủ giả: dòng nhịp tới nhịp `den` kèm `tin` · cú bấm (`mua_tin` ⇒ trả danh sách tin thật) · kết quả. */
function mayChu(d: object, den: number, tin?: object[], kq?: object) {
  const bam: any[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/lenh')) {
      const b = JSON.parse(String(init?.body)); bam.push(b);
      return json({ nhan: true, seq: bam.length, nhip: b.nhip, la: 'luot_song', nut: ['dao', 'chot'], so: SO_LS,
        ...(b.nut === 'mua_tin' ? { tin_mua: { phi: 99, da_mua: true }, tin_that: TIN_THAT } : {}) });
    }
    if (u.includes('/ket-qua')) return kq ? json(kq) : new Response(JSON.stringify({ error: 'chua_het' }), { status: 409 });
    const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(den + 1).fill(100), nen: [], ...(tin ? { tin } : {}) });
    return dongMo(JSON.stringify({ loai: 'dau', ...d }) + '\n' + lo + '\n');
  }));
  return bam;
}
/** Canvas giả (hàm vẽ rỗng) — vòng vẽ chạy tới phần ghim + bong bóng. */
const canvasGia = () => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, globalAlpha: 1, fillStyle: '', imageSmoothingEnabled: false } as never);

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('D532 — MUA TIN SỚM ở pha chọn lõi (demo `veTruocMan`)', () => {
  it('⭐ Lướt Sóng: khối "MUA TIN SỚM?" (phí server trả · 2% vốn); bấm ⇒ gửi `mua_tin` ở nhịp −1 ⇒ danh sách TIN THẬT (chữ tra từ ID), không mua lần hai', async () => {
    const bam = mayChu(dauLs(-5, { tin_mua: { phi: 99, da_mua: false } }), 0);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(screen.getByText('MUA TIN SỚM?')).toBeTruthy());
    const nut = screen.getByRole('button', { name: /MUA · 99/ });
    expect(nut.textContent).toContain('2% vốn');
    fireEvent.click(nut);
    await waitFor(() => expect(bam).toHaveLength(1));
    expect(bam[0]).toMatchObject({ nhip: -1, nut: 'mua_tin' });
    await waitFor(() => expect(screen.getByText('TIN THẬT SẼ RA · không theo thứ tự')).toBeTruthy());
    const ds = container.querySelector('[data-khoi="ds-tin-that"]')!;
    expect(ds.textContent).toContain(chuTin(CHU)!);
    expect(ds.textContent).toContain('BÁO');
    expect((ds.firstElementChild as HTMLElement).style.getPropertyValue('--c'), 'tin xấu ⇒ họ màu xấu').toMatch(/^var\(--xau-\d\)$/);
    expect(screen.queryByRole('button', { name: /MUA · 99/ }), 'mua một lần').toBeNull();
  });

  it('vế ngược: MÙ TIN ⇒ "MÙ TIN", không nút mua · lõi khác (không `tin_mua`) ⇒ không có khối', async () => {
    mayChu(dauLs(-5, { mu_tin: true }), 0);
    const { container, unmount } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(screen.getByText('MÙ TIN')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /MUA ·/ })).toBeNull();
    unmount(); container.remove();
    mayChu(dauLs(-5, { loi_cam: ['bat_day'], la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'] }), 0);
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(screen.getAllByText('CHỌN LÕI').length).toBeGreaterThan(0));
    expect(r2.container.querySelector('[data-khoi="mua-tin"]')).toBeNull();
  });
});

describe('D532 — tin trên đồ thị (demo `veTin`)', () => {
  // bắt đầu 14 s trước, đếm 4 s, xem trễ 1,4 s ⇒ nhịp đang xem ≈ 121 (nến mịn ≈ 15). Tin ở nến 13 đã lộ + bong bóng mở; nến 30 CHƯA lộ.
  const TIN = [{ id: 0, ci: 13, tang: 0, ng: 'bao', chu: CHU, noi: -1 }, { id: 1, ci: 30, tang: 1, ng: 'kol', chu: CHU2, noi: 1 }];

  it('⭐ tin đã lộ ⇒ ghim (nhãn = nguồn: chữ) + bong bóng (nguồn · uy tín ■ · chữ); tin của nhịp chưa xem tới ⇒ KHÔNG ghim dù đã nhận', async () => {
    canvasGia();
    mayChu(dauLs(14), 300, TIN);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="tin-lop"] button[data-tin="0"]')).toBeTruthy());
    const g = container.querySelector<HTMLButtonElement>('[data-khoi="tin-lop"] button[data-tin="0"]')!;
    expect(g.getAttribute('aria-label')).toBe(`BÁO: ${chuTin(CHU)}`);
    expect(g.style.getPropertyValue('--c')).toMatch(/^var\(--xau-\d\)$/);
    const ghim1 = container.querySelector<HTMLButtonElement>('[data-khoi="tin-lop"] button[data-tin="1"]');
    expect(!ghim1 || ghim1.hidden, 'tin nến 30 chưa lộ').toBe(true);
    const bong = container.querySelector('[data-khoi="chong-tin"]')!;
    await waitFor(() => expect(bong.textContent).toContain(chuTin(CHU)!));
    expect(bong.textContent).toContain('BÁO');
    expect(bong.textContent).toContain('■');
    expect(bong.textContent, 'chưa mua tin sớm ⇒ không dấu THẬT/NHIỄU').not.toMatch(/THẬT|NHIỄU/);
  });

  it('⭐ đã mua tin sớm ⇒ bong bóng có dấu ✓ THẬT / ✗ NHIỄU (server gửi `that`)', async () => {
    canvasGia();
    mayChu(dauLs(14, { tin_mua: { phi: 99, da_mua: true }, tin_that: TIN_THAT }), 300, [{ ...TIN[0], that: false }]);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="chong-tin"]')!.textContent).toContain('✗ NHIỄU'));
    expect(container.querySelector<HTMLElement>('[data-khoi="tin-lop"] button[data-tin="0"]')!.style.getPropertyValue('--c'), 'nhiễu sau khi mua ⇒ xám').toMatch(/^var\(--mo-\d\)$/);
  });

  it('⭐ MÙ TIN: server không gửi chữ ⇒ ghim "Tin (chữ bị che)" · bong bóng "NGUỒN BỊ CHE" + chữ xáo (không chữ thật nào)', async () => {
    canvasGia();
    mayChu(dauLs(14, { mu_tin: true }), 300, [{ id: 0, ci: 13, tang: 0 }]);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="chong-tin"]')!.textContent).toContain('NGUỒN BỊ CHE'));
    expect(container.querySelector('[data-khoi="tin-lop"] button[data-tin="0"]')!.getAttribute('aria-label')).toBe('Tin (chữ bị che)');
    expect(container.querySelector('[data-khoi="chong-tin"] [data-xao]')!.textContent!.length).toBeGreaterThan(20);
  });

  it('⭐ KIÊN NHẪN thấy trước: ghim MỜ đúng vị trí tin chưa tới, màu = uy tín (sắc xám, không lộ hướng); không bấm được', async () => {
    canvasGia();
    mayChu(dauLs(14, { tin_truoc: [{ ci: 40, tang: 1, uy: 4 }, { ci: 5, tang: 0, uy: 2 }] }), 300);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(container.querySelectorAll('[data-khoi="tin-lop"] button[aria-hidden="true"]:not([hidden])')).toHaveLength(1));
    const g = container.querySelector<HTMLElement>('[data-khoi="tin-lop"] button[aria-hidden="true"]:not([hidden])')!;
    expect(g.style.getPropertyValue('--c'), 'tin nến 40 (chưa tới); tin nến 5 đã qua ⇒ ẩn').toBe('var(--mo-4)');
    expect(g.dataset.tin).toBeUndefined();
  });

  it('⭐ đếm ngược + đã mua ⇒ danh sách tin thật che đồ thị, "vào sau N" (demo `#tinThatRa`); chưa mua thì không', async () => {
    mayChu(dauLs(3, { tin_mua: { phi: 99, da_mua: true }, tin_that: TIN_THAT }), 0);
    const { container, unmount } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="tin-that-ra"]')).toBeTruthy());
    expect(container.querySelector('[data-khoi="tin-that-ra"]')!.textContent).toMatch(/vào sau \d/);
    expect(container.querySelector('[data-khoi="tin-that-ra"]')!.textContent).toContain(chuTin(CHU)!);
    unmount(); container.remove();
    mayChu(dauLs(3, { tin_mua: { phi: 99, da_mua: false } }), 0);
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r2.container.querySelector('[data-khoi="do-thi"]')).toBeTruthy());
    expect(r2.container.querySelector('[data-khoi="tin-that-ra"]')).toBeNull();
  });
});

describe('D532 — kết quả màn Lướt Sóng có tin (demo `moKetQua` · `veQuyetToan`)', () => {
  it('⭐ câu "Đảo n lần · phí giao dịch · mua tin sớm (phí)" · dòng "trong đó phí giao dịch · phí mua tin sớm" · số lớn đã trừ phí mua tin · nhãn hành vi', async () => {
    mayChu(dauLs(60), 479, undefined, {
      vong: 2, ma: 'btc', von: 4960, von_sau: 4960, la: 'luot_song', nut: ['dao', 'chot'], loi: 157, giu: 0, theo_lenh: 256, cham_tran: false, tu_dong: false,
      phi_tin: 99, ls: { chieu: 0, so_dao: 2, phi: 44 }, ma_khac: [], vao: [{ tien: 4960, khop: 100, nhip: 100, loai: 'dao' }],
      ra: [{ tien: 4960, ra: 105, nhip: 300, lai: 256, tu_dong_cuoi: false, cuoi_khoa: false }], hut: [], gia_dau: 100, day: 95, dinh: 106, gia_cuoi: 100,
      nhan: ['mua_tin_som', 'dung_thong_tin'], nav_truoc: 10000, nav_sau: 10157,
    });
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="phi-ls"]')).toBeTruthy());
    expect(screen.getByText(/Đảo 2 lần · phí giao dịch 44 · mua tin sớm \(99\)/)).toBeTruthy();
    expect(container.querySelector('[data-khoi="phi-ls"]')!.textContent).toBe('trong đó phí giao dịch · phí mua tin sớm−44 · −99');
    expect(screen.getAllByText('+157').length, 'số lớn = theo lệnh − phí mua tin').toBeGreaterThan(0);
    expect(screen.getByText('4.960 → 5.117')).toBeTruthy();
    expect(container.textContent).toContain('MUA TIN SỚM · DÙNG THÔNG TIN');
  });
  it('vế ngược: không mua ⇒ "không mua tin sớm", phí mua tin −0', async () => {
    mayChu(dauLs(60), 479, undefined, {
      vong: 2, ma: 'btc', von: 4960, von_sau: 4960, la: 'luot_song', nut: ['dao', 'chot'], loi: 0, giu: 0, theo_lenh: 0, cham_tran: false, tu_dong: false,
      ls: { chieu: 0, so_dao: 0, phi: 22 }, ma_khac: [], vao: [{ tien: 4960, khop: 100, nhip: 100, loai: 'dao' }], ra: [], hut: [],
      gia_dau: 100, day: 95, dinh: 106, gia_cuoi: 100, nhan: ['khong_mua_tin_som'], nav_truoc: 10000, nav_sau: 10000,
    });
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="phi-ls"]')).toBeTruthy());
    expect(screen.getByText(/Đảo 0 lần · phí giao dịch 22 · không mua tin sớm/)).toBeTruthy();
    expect(container.querySelector('[data-khoi="phi-ls"]')!.textContent).toContain('−22 · −0');
  });
});
