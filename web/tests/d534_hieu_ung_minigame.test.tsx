/**
 * D534 — HIỆU ỨNG CÒN THIẾU SO VỚI DEMO (founder 06/10: *"vì sao mini game trên web ko mượt và hiệu ứng đầy đủ/ đẹp bằng demo"*). Đối chiếu demo
 * `minigame-bat-day.html`: demo tung hạt pixel (`phut`) ở 9 chỗ, app 0 · số lãi lỗ chạy từ 0 · nhãn đà `#bung` · nhãn `#nhanLon` · nút rung khi bấm
 * hụt — app không có cái nào. Bài này canh phần đã chép (hạt đếm qua `phutHat` giả — hàm thật đã có bài riêng `hat_pixel.test.ts`).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const hat = vi.hoisted(() => [] as { mau: string; n: number }[]);
vi.mock('@/lib/hat_pixel', () => ({ phutHat: (_t: unknown, mau: string, n: number) => { hat.push({ mau, n }); }, tamPhanTu: () => ({ x: 0, y: 0 }) }));

import { ManMinigame } from '@/components/holdem/ManMinigame';

const LS = Array.from({ length: 20 }, () => [100, 101, 99, 100]);
const SO0 = { vao: [], ra: [], hut: [], con_von: 4960, dang_cam: 0, tien_nut: { vao_nua: 2480, vao_het: 4960, thoat: 0 } };
const dauMan = (giayTruoc: number, them: object = {}) => ({
  vong: 2, ma: 'btc', von: 4960, dai: 'cang', nac: null, bat_dau: new Date(Date.now() - giayTruoc * 1000).toISOString(), gio_may: new Date().toISOString(),
  dem_ms: 4000, chay_ms: 34000, so_nhip: 480, cua_so_ms: 2000, phien_ban: 'x', lich_su: LS,
  loi_cam: ['bat_day', 'mua_duoi'], la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], so: SO0, ...them,
});
const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
const dongMo = (manh: string) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(manh)); } }),
  { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
function mayChu(d: object, lo: object, kq?: object) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/lenh')) { const b = JSON.parse(String(init?.body)); return json({ nhan: true, seq: 1, nhip: b.nhip, la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], so: SO0 }); }
    if (u.includes('/ket-qua')) return kq ? json(kq) : new Response(JSON.stringify({ error: 'chua_het' }), { status: 409 });
    return dongMo(JSON.stringify({ loai: 'dau', ...d }) + '\n' + JSON.stringify({ loai: 'nhip', tu: 0, nen: [], ...lo }) + '\n');
  }));
}
const canvasGia = () => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, globalAlpha: 1, fillStyle: '', imageSmoothingEnabled: false } as never);
const kqMau = (theoLenh: number) => ({
  vong: 2, ma: 'btc', von: 4960, von_sau: 4960, la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], loi: theoLenh, giu: 0, theo_lenh: theoLenh, cham_tran: false, tu_dong: false,
  ma_khac: [], vao: [{ tien: 4960, khop: 100, nhip: 100, loai: 'het' }], ra: [], hut: [], gia_dau: 100, day: 95, dinh: 104, gia_cuoi: 100, nhan: [], nav_truoc: 10000, nav_sau: 10000 + theoLenh,
});

beforeEach(() => { hat.length = 0; vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('D534 — hạt pixel (demo `phut`)', () => {
  it('⭐ bấm nút khớp được ⇒ hạt tung từ nút: nút thường 10 hạt màu mua · nút mạnh (VÀO HẾT) 18 hạt vàng', async () => {
    mayChu(dauMan(14), { gia: Array(301).fill(100) });
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const nua = await screen.findByRole('button', { name: /VÀO NỬA/ });
    await waitFor(() => expect((nua as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(nua);
    expect(hat.at(-1)).toEqual({ mau: 'var(--win)', n: 10 });
    await new Promise((r) => setTimeout(r, 300));
    fireEvent.click(screen.getByRole('button', { name: /VÀO HẾT/ }));
    expect(hat.at(-1)).toEqual({ mau: 'var(--gold)', n: 18 });
  });
  it('chọn lá ở pha CHỌN LÕI ⇒ 14 hạt vàng từ lá', async () => {
    mayChu(dauMan(-5), { gia: [] });
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mua Đuổi' }));
    expect(hat).toContainEqual({ mau: 'var(--gold)', n: 14 });
  });
  it('⭐ quyết toán có lãi ⇒ số CHẠY tới đích + 22 hạt vàng; lỗ ⇒ không hạt', async () => {
    mayChu(dauMan(60), { gia: Array(480).fill(100) }, kqMau(123));
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r.container.querySelector('[data-khoi="so-kq"]')).toBeTruthy());
    expect(hat).toContainEqual({ mau: 'var(--gold)', n: 22 });
    await waitFor(() => expect(r.container.querySelector('[data-khoi="so-kq"]')!.textContent).toBe('+123'), { timeout: 3000 });
    r.unmount(); hat.length = 0;
    mayChu(dauMan(60), { gia: Array(480).fill(100) }, kqMau(-80));
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r2.container.querySelector('[data-khoi="so-kq"]')).toBeTruthy());
    expect(hat.filter((h) => h.n === 22)).toEqual([]);
  });
});

describe('D534 — nhãn trên đồ thị (demo `#bung` · `#nhanLon`)', () => {
  it('⭐ Mua Đuổi, giá lên đều (mọi nến xanh) ⇒ nhãn "×n NẾN XANH" bật', async () => {
    canvasGia();
    mayChu(dauMan(14, { la: 'mua_duoi' }), { gia: Array.from({ length: 301 }, (_, i) => 100 + i * 0.05) });
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r.container.querySelector('[data-khoi="bung"]')!.textContent).toMatch(/×\d+ NẾN XANH/));
    expect(r.container.querySelector('[data-khoi="bung"]')!.getAttribute('aria-hidden')).toBe('false');
  });
  it('vế ngược: giá đi ngang ⇒ nhãn tắt; lõi khác (Đòn Bẩy) ⇒ không có nhãn đà', async () => {
    canvasGia();
    mayChu(dauMan(14, { la: 'mua_duoi' }), { gia: Array(301).fill(100) });
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r.container.querySelector('[data-khoi="bung"]')).toBeTruthy());
    await new Promise((x) => setTimeout(x, 300));
    expect(r.container.querySelector('[data-khoi="bung"]')!.textContent).toBe('');
    r.unmount();
    mayChu(dauMan(14, { la: 'don_bay', loi_cam: ['don_bay'] }), { gia: Array(301).fill(100) });
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await new Promise((x) => setTimeout(x, 400));
    expect(r2.container.querySelector('[data-khoi="bung"]')).toBeNull();
  });
  it('⭐ một vị thế đòn bẩy của bàn bị thanh lý ở nhịp vừa qua ⇒ nhãn BÁN CƯỠNG BỨC; sự kiện đã cũ ⇒ không', async () => {
    canvasGia();
    // bắt đầu 14 s trước, đếm 4 s, xem trễ 1,4 s ⇒ nhịp đang xem ≈ 121
    mayChu(dauMan(14), { gia: Array(301).fill(100), tl: [{ nhip: 112, ai: 'dam_dong', L: 4 }] });
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r.container.querySelector('[data-khoi="nhan-lon"]')?.textContent).toContain('BÁN CƯỠNG BỨC'));
    r.unmount();
    mayChu(dauMan(14), { gia: Array(301).fill(100), tl: [{ nhip: 20, ai: 'dam_dong', L: 4 }] });
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await new Promise((x) => setTimeout(x, 400));
    expect(r2.container.querySelector('[data-khoi="nhan-lon"]')).toBeNull();
  });
});

describe('D534 — dây nối khác (quét mã nguồn)', () => {
  const MG = readFileSync(resolve(process.cwd(), 'src/components/holdem/ManMinigame.tsx'), 'utf8');
  it('nút bấm hụt (nến trắng chặn chiều) ⇒ rung tại chỗ, không tung hạt', () => {
    expect(MG).toMatch(/if \(khoa\) \{ setHut\(c\.id\); setTimeout\(\(\) => setHut\(null\), 140\); \}\s*else phutHat\(/);
  });
  it('búa trần thua · kê khớp · kê đặt · nạp ký quỹ đều tung hạt (demo `dapBua` · `veKe` · `datKe` · `napKyQuy`)', () => {
    expect(MG).toMatch(/phutHat\(tamPhanTu\(document\.querySelector\('\[data-khoi="bua"\]'\)\), '#c8a27a', 16\)/);
    expect(MG).toMatch(/keMung\.current\.add\(khoaMung\);\s*phutHat\(/);
    expect(MG).toMatch(/if \(bp !== null\) phutHat\(tamPhanTu\(doThiEl\.current\)/);
    expect(MG).toMatch(/phutHat\(tamPhanTu\(e\.currentTarget\), 'var\(--lose\)', 10\); bam\(`nap_/);
  });
  it('ghim tin chỉ ghi màu / vị trí khi đổi (không tính lại kiểu mỗi khung)', () => {
    expect(MG).toMatch(/if \(g\.dataset\.c !== mau\)/);
    expect(MG).not.toMatch(/g\.style\.setProperty\('--c', mauTin\(t, oTin\)\);/);
  });
});
