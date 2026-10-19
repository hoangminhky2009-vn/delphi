/**
 * D588 — CHUYỂN CẢNH bàn ↔ màn minigame (founder 11/10: *"chuyển tiếp từ màn chính sang màn mini-game chưa mượt"* · *"cơ chế lật bài
 * hiện tại hơi rối"*). Canh: màn mở bằng cú VÀO (lớp `vao` đứng một nhịp rồi gỡ) · lá vừa lật trên bàn (`[data-o-dang-lat]`) BAY vào ô
 * "VÒNG N" của màn — chỉ khi bàn đã lật lá và lá có mặt · lá úp / không cờ `latTrenBan` / giảm chuyển động ⇒ không bay · đầu màn khi
 * lá đã lật trên bàn ghi "VÀO MÀN", không "LẬT THẺ".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, waitFor } from '@testing-library/react';
import { ManMinigame } from '@/components/holdem/ManMinigame';
import { NHIP } from '@/lib/nhip';

const LS = Array.from({ length: 20 }, (_, i) => [100, 101, 99, 100 + i * 0.01]);
const SO0 = { vao: [], ra: [], hut: [], con_von: 4960, dang_cam: 0, tien_nut: { vao_nua: 2480, vao_het: 4960, thoat: 0 } };
/** Màn còn ở pha chờ đầu (`bat_dau` xa phía trước ⇒ `phaMan` = 'lat'). */
const dau = () => ({
  vong: 2, ma: 'btc', von: 4960, dai: 'cang', bat_dau: new Date(Date.now() + 60_000).toISOString(), gio_may: new Date().toISOString(),
  dem_ms: 4000, chay_ms: 34000, so_nhip: 480, cua_so_ms: 2000, phien_ban: 'minigame-v2-duongsinh', lich_su: LS, nac: null,
  loi_cam: ['bat_day'], la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], so: SO0, phu: [],
});
const dongMo = (manh: string) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(manh)); } }),
  { status: 200, headers: { 'content-type': 'application/x-ndjson' } });

let ban: HTMLElement;
let animate: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('fetch', vi.fn(async () => dongMo(JSON.stringify({ loai: 'dau', ...dau() }) + '\n')));
  // Ô vừa lật của bàn (MarketMap đánh dấu `data-o-dang-lat`) — đứng thấp hơn và to hơn ô thẻ của màn.
  ban = document.createElement('div');
  ban.setAttribute('data-o-dang-lat', '');
  document.body.appendChild(ban);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const r = this.hasAttribute('data-o-dang-lat') ? { left: 140, top: 300, width: 120, height: 160 } : { left: 200, top: 80, width: 96, height: 128 };
    return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => r } as DOMRect;
  });
  animate = vi.fn();
  Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true });
});
afterEach(() => {
  ban.remove();
  delete (Element.prototype as { animate?: unknown }).animate;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const MAT = { svg: '', ten: 'Giảm' };
const cuBayThe = () => animate.mock.calls.filter((_, i) => (animate.mock.contexts[i] as Element).getAttribute('data-khoi') === 'the-moi');

describe('D588 — chuyển cảnh bàn ↔ màn', () => {
  it('⭐ màn mở bằng cú VÀO: lớp `vao` có ngay lần vẽ đầu, đứng đúng một nhịp `MAN_VAO` rồi gỡ', async () => {
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} theMoi={MAT} latTrenBan />);
    const phu = r.container.querySelector('[role="dialog"]')!;
    expect(phu.getAttribute('data-chuyen')).toBe('vao');
    await waitFor(() => expect(phu.getAttribute('data-chuyen')).toBeNull(), { timeout: NHIP.MAN_VAO + 1000 });
  });

  it('⭐ lá vừa lật trên bàn BAY vào ô "VÒNG N": một cú, từ tâm ô bàn (to hơn) về chỗ đứng thật, dài `THE_VAO_MAN`', () => {
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} theMoi={MAT} latTrenBan />);
    const bay = cuBayThe();
    expect(bay).toHaveLength(1);
    const [khung, tuy] = bay[0]! as [Keyframe[], KeyframeAnimationOptions];
    // tâm ô bàn (200, 380) − tâm ô màn (248, 144) = (−48, 236); cỡ 120 / 96 = 1,25.
    expect(khung[0]!.transform).toBe('translate(-48px,236px) scale(1.25)');
    expect(khung[khung.length - 1]!.transform).toBe('none');
    expect(tuy.duration).toBe(NHIP.THE_VAO_MAN);
  });

  it('vế ngược — không bay khi: lá úp (không mặt) · màn không cờ `latTrenBan` (bàn chưa lật) · bàn không có ô vừa lật · giảm chuyển động', () => {
    const lan = (el: ReactElement) => { const r = render(el); const n = cuBayThe().length; r.unmount(); animate.mockClear(); return n; };
    expect(lan(<ManMinigame matchId="m1" vong={2} dong={() => undefined} latTrenBan />), 'lá úp').toBe(0);
    expect(lan(<ManMinigame matchId="m1" vong={2} dong={() => undefined} theMoi={MAT} />), 'không cờ').toBe(0);
    ban.removeAttribute('data-o-dang-lat');
    expect(lan(<ManMinigame matchId="m1" vong={2} dong={() => undefined} theMoi={MAT} latTrenBan />), 'không ô vừa lật').toBe(0);
    ban.setAttribute('data-o-dang-lat', '');
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...mm(q), matches: q.includes('reduce') })) as typeof window.matchMedia;
    try {
      expect(lan(<ManMinigame matchId="m1" vong={2} dong={() => undefined} theMoi={MAT} latTrenBan />), 'giảm chuyển động').toBe(0);
    } finally { window.matchMedia = mm; }
  });

  it('⭐ đầu màn khi lá đã lật trên bàn ghi "VÀO MÀN" — không còn "LẬT THẺ VÒNG N" mà chẳng lá nào lật; không cờ thì như cũ', async () => {
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} theMoi={MAT} latTrenBan />);
    await waitFor(() => expect(r.container.textContent).toContain('VÀO MÀN'));
    expect(r.container.textContent).not.toContain('LẬT THẺ VÒNG');
    r.unmount();
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} theMoi={MAT} />);
    await waitFor(() => expect(r2.container.textContent).toContain('LẬT THẺ VÒNG 2'));
  });
});
