/**
 * D589 — hàng nút khoá v70 (founder 11/10): Mua Đuổi nhồi đủ 3 phần ⇒ CHÍNH ô VÀO thành ×2 (không thêm ô) · CHỐT gộp nói lần này bán NỬA hay HẾT ·
 * Bắt Đáy phần 2–3 là GOM. Số trên nút do server trả (C4) — client chỉ xếp ô.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ManMinigame } from '@/components/holdem/ManMinigame';

const LS = Array.from({ length: 20 }, (_, i) => [100, 101, 99, 100 + i * 0.01]);
const dau = (la: string, nut: string[], so: object) => ({
  vong: 2, ma: 'btc', von: 1000, dai: 'cang', bat_dau: new Date(Date.now() - 14_000).toISOString(), gio_may: new Date().toISOString(),
  dem_ms: 4000, chay_ms: 34000, so_nhip: 480, cua_so_ms: 2000, phien_ban: 'minigame-v2-duongsinh', lich_su: LS, nac: null,
  loi_cam: [la], la, nut, so, phu: [],
});
const dongMo = (manh: string) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(manh)); } }),
  { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
const v = (tien: number, vay?: true) => ({ tien, khop: 100, nhip: 10, ...(vay ? { vay } : {}) });
function mayChu(la: string, nut: string[], so: object) {
  vi.stubGlobal('fetch', vi.fn(async () => dongMo(JSON.stringify({ loai: 'dau', ...dau(la, nut, so) }) + '\n'
    + JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(301).fill(100), nen: [] }) + '\n')));
}
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const o = async (r: ReturnType<typeof render>) => {
  const hang = await waitFor(() => { const h = r.container.querySelector('[data-khoi="hang-nut"]'); expect(h).toBeTruthy(); return h!; });
  return [...hang.querySelectorAll('button')].map((b) => b.textContent ?? '');
};
const MD = ['vao', 'vay_x2', 'chot', 'ban_bot'];
const SO = (vao: object[], tien: Record<string, number>, dangCam: number) => ({ vao, ra: [], hut: [], con_von: 0, dang_cam: dangCam, tien_nut: tien });

describe('D589 — hàng nút khoá v70', () => {
  it('⭐ Mua Đuổi chưa đủ 3 phần: ô VÀO là NHỒI (đếm phần), KHÔNG có ô ×2 riêng; CHỐT nói "nửa"', async () => {
    mayChu('mua_duoi', MD, SO([v(500), v(333)], { vao: 167, vay_x2: 0, chot: 416, ban_bot: 0 }, 833));
    const nut = await o(render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />));
    expect(nut).toHaveLength(3);
    expect(nut[0]).toMatch(/NHỒI.*2\/3 · 167/);
    expect(nut.join('|')).not.toMatch(/×2/);
    expect(nut[1]).toMatch(/CHỐT.*nửa · 416/);
  });
  it('⭐ đủ 3 phần: CHÍNH ô VÀO thành VAY ×2 (vẫn 3 ô); đã vay ⇒ ô nói đang vay, khoá; CHỐT bằng cả phần đang cầm ⇒ "hết"', async () => {
    mayChu('mua_duoi', MD, SO([v(500), v(333), v(167)], { vao: 0, vay_x2: 1000, chot: 500, ban_bot: 0 }, 1000));
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const nut = await o(r);
    expect(nut).toHaveLength(3);
    expect(nut[0]).toMatch(/VAY ×2.*vay 1\.000/);
    r.unmount(); vi.unstubAllGlobals();
    mayChu('mua_duoi', MD, SO([v(500), v(333), v(167), v(1000, true)], { vao: 0, vay_x2: 0, chot: 2000, ban_bot: 0 }, 2000));
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const nut2 = await o(r2);
    expect(nut2[0]).toMatch(/×2 ĐANG VAY/);
    expect((r2.container.querySelectorAll('[data-khoi="hang-nut"] button')[0] as HTMLButtonElement).disabled).toBe(true);
    expect(nut2[1]).toMatch(/CHỐT.*hết · 2\.000/);
  });
  it('Bắt Đáy khoá v70: phần 2–3 là GOM; khoá cũ (không ×2 trong danh sách) đủ 3 phần vẫn là ô NHỒI như trước', async () => {
    mayChu('bat_day', ['vao', 'thoat', 'ban_bot'], SO([v(166)], { vao: 333, thoat: 166, ban_bot: 0 }, 166));
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    expect((await o(r))[0]).toMatch(/GOM.*1\/3 · 333/);
    r.unmount(); vi.unstubAllGlobals();
    mayChu('mua_duoi', ['vao', 'chot_nua', 'chot_het'], SO([v(333), v(333), v(334)], { vao: 0, chot_nua: 500, chot_het: 1000 }, 1000));
    expect((await o(render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />)))[0]).toMatch(/NHỒI.*3\/3/);
  });
});
