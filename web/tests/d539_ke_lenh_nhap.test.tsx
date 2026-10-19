/**
 * D539 — KÊ LỆNH = VẠCH NHÁP rồi bấm ✓ ĐẶT (founder 06/10: *"bấm 1 phát hiện trên chart và nếu lỡ có nến nào chạm nhẹ là bán luôn hoặc mua
 * luôn thay vì cho t thời gian set up"* — chọn "vạch nháp rồi bấm ĐẶT"). Nháp chỉ ở client: không gửi server ⇒ không bao giờ tự khớp.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/hat_pixel', () => ({ phutHat: () => undefined, tamPhanTu: () => ({ x: 0, y: 0 }) }));

import { ManMinigame } from '@/components/holdem/ManMinigame';

const LS = Array.from({ length: 20 }, () => [100, 101, 99, 100]);
const SO0 = { vao: [], ra: [], hut: [], con_von: 4960, dang_cam: 0, tien_nut: { vao_nua: 2480, vao_het: 4960, thoat: 0 } };
const dauMan = (giayTruoc: number) => ({
  vong: 2, ma: 'btc', von: 4960, dai: 'cang', nac: null, bat_dau: new Date(Date.now() - giayTruoc * 1000).toISOString(), gio_may: new Date().toISOString(),
  dem_ms: 4000, chay_ms: 34000, so_nhip: 480, cua_so_ms: 2000, phien_ban: 'x', lich_su: LS,
  loi_cam: ['bat_day'], la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], so: SO0, ke_trait: { mua: true, ban: true },
});
const dongMo = (manh: string) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(manh)); } }),
  { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
let lenh: { nut: string; gia_bp?: number }[] = [];
function mayChu() {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/lenh')) {
      const b = JSON.parse(String(init?.body)); lenh.push(b);
      return json({ nhan: true, seq: lenh.length, nhip: b.nhip, la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'],
        so: { ...SO0, ke: { mua: b.nut === 'ke_mua' ? { gia_bp: b.gia_bp, L: b.L ?? 1, khop: null, vt: null, huy: null, sua: 0 } : null, ban: null } } });
    }
    return dongMo(JSON.stringify({ loai: 'dau', ...dauMan(14) }) + '\n' + JSON.stringify({ loai: 'nhip', tu: 0, nen: [], gia: Array(300).fill(100) }) + '\n');
  }));
}
const canvasGia = () => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, globalAlpha: 1, fillStyle: '', imageSmoothingEnabled: false } as never);
const nhan = (c: HTMLElement) => c.querySelector('[data-khoi="ke-nhan-mua"]') as HTMLElement;

beforeEach(() => { lenh = []; canvasGia(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('D539 — kê lệnh: vạch nháp rồi ✓ ĐẶT', () => {
  it('⭐ bấm KÊ MUA ⇒ vạch NHÁP, KHÔNG gửi gì lên server; ✓ ĐẶT mới gửi `ke_mua`', async () => {
    mayChu();
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const nut = await screen.findByRole('button', { name: 'KÊ MUA' });
    await waitFor(() => expect((nut as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(nut);
    await waitFor(() => expect(nhan(r.container).querySelector('[data-ke="t"]')?.textContent).toMatch(/NHÁP/));
    expect(nhan(r.container).dataset.nhap).toBe('1');
    await new Promise((x) => setTimeout(x, 400));
    expect(lenh, 'nháp không đi server').toEqual([]);
    fireEvent.click(r.container.querySelector('[data-khoi="ke-dat-mua"]')!);
    await waitFor(() => expect(lenh.map((x) => x.nut)).toEqual(['ke_mua']));
    expect(lenh[0]!.gia_bp).toBeLessThan(0);   // mua nằm dưới giá
    await waitFor(() => expect(nhan(r.container).dataset.nhap).toBe(''));
  });
  it('bấm KÊ MUA lần hai khi đang nháp ⇒ bỏ nháp, vẫn không gửi gì; ✕ trên nhãn nháp cũng bỏ', async () => {
    mayChu();
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const nut = await screen.findByRole('button', { name: 'KÊ MUA' });
    await waitFor(() => expect((nut as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(nut);
    await waitFor(() => expect(nhan(r.container).dataset.nhap).toBe('1'));
    fireEvent.click(nut);
    await waitFor(() => expect(nhan(r.container).style.display).toBe('none'));
    fireEvent.click(nut);
    await waitFor(() => expect(nhan(r.container).dataset.nhap).toBe('1'));
    await waitFor(() => expect(nhan(r.container).style.display).toBe(''));
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ nháp' }));
    await waitFor(() => expect(nhan(r.container).style.display).toBe('none'));
    expect(lenh).toEqual([]);
  });
});
