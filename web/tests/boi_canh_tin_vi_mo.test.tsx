/**
 * D574 — TIN VĨ MÔ của bối cảnh dài hạn trong dòng tin màn (SPEC `docs/spec/boi-canh-dai-han.md` §4.1). Server gửi ID chữ `vm.<trạng thái>.<mẫu>` +
 * nguồn `vi_mo` (D26); MÙ TIN thì server chỉ gửi vị trí (`tinChoGhe`, canh ở `tests/boi_canh_dai_han.test.ts`). Client chỉ HIỂN THỊ.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ManMinigame } from '@/components/holdem/ManMinigame';
import { chuTin } from '@/lib/tin_man';

const LS = Array.from({ length: 20 }, () => [100, 101, 99, 100]);
const SO_LS = { vao: [], ra: [], hut: [], con_von: 4960, dang_cam: 0, tien_nut: { dao: 22, chot: 0 } };
const dauLs = (giayTruoc: number, them: object = {}) => ({
  vong: 2, ma: 'btc', von: 4960, dai: 'cang', nac: null, bat_dau: new Date(Date.now() - giayTruoc * 1000).toISOString(), gio_may: new Date().toISOString(),
  dem_ms: 4000, chay_ms: 34000, so_nhip: 480, cua_so_ms: 2000, phien_ban: 'x', lich_su: LS, loi_cam: ['luot_song'], la: 'luot_song', nut: ['dao', 'chot'], so: SO_LS, ...them,
});
const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
const dongMo = (manh: string) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(manh)); } }),
  { status: 200, headers: { 'content-type': 'application/x-ndjson' } });

/** Máy chủ giả: đầu màn + một lô nhịp tới `den` kèm `tin`. */
function mayChu(d: object, den: number, tin: object[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('/ket-qua')) return new Response(JSON.stringify({ error: 'chua_het' }), { status: 409 });
    if (String(url).includes('/lenh')) return json({ nhan: true, seq: 1, nhip: 0, la: 'luot_song', nut: ['dao', 'chot'], so: SO_LS });
    const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(den + 1).fill(100), nen: [], tin });
    return dongMo(JSON.stringify({ loai: 'dau', ...d }) + '\n' + lo + '\n');
  }));
}
const canvasGia = () => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, globalAlpha: 1, fillStyle: '', imageSmoothingEnabled: false } as never);

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('D574 — dòng tin vĩ mô trong màn', () => {
  // bắt đầu 14 s trước ⇒ nhịp đang xem ≈ nến mịn 15: tin ở nến 13 đã lộ (cùng nhịp với bài D532).
  it('⭐ dòng VĨ MÔ đã lộ ⇒ ghim "VĨ MÔ: <chữ>" + bong bóng nguồn VĨ MÔ · màu theo hướng lời (Căng = xấu)', async () => {
    canvasGia();
    const CHU = 'vm.cang.0';
    expect(chuTin(CHU)).toBeTruthy();
    mayChu(dauLs(14), 300, [{ id: 0, ci: 13, tang: 0, ng: 'vi_mo', chu: CHU, noi: -1 }]);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="tin-lop"] button[data-tin="0"]')).toBeTruthy());
    const g = container.querySelector<HTMLButtonElement>('[data-khoi="tin-lop"] button[data-tin="0"]')!;
    expect(g.getAttribute('aria-label')).toBe(`VĨ MÔ: ${chuTin(CHU)}`);
    expect(g.style.getPropertyValue('--c')).toMatch(/^var\(--xau-4\)$/);
    const bong = container.querySelector('[data-khoi="chong-tin"]')!;
    await waitFor(() => expect(bong.textContent).toContain(chuTin(CHU)!));
    expect(bong.textContent).toContain('VĨ MÔ');
  });

  it('dòng Lên / Nới ⇒ màu TỐT; đã mua tin sớm mà server không gửi `that` cho dòng vĩ mô ⇒ không dấu THẬT/NHIỄU, giữ màu', async () => {
    canvasGia();
    const CHU = 'vm.len.2';
    mayChu(dauLs(14, { tin_mua: { phi: 99, da_mua: true }, tin_that: [] }), 300, [{ id: 0, ci: 13, tang: 0, ng: 'vi_mo', chu: CHU, noi: 1 }]);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="chong-tin"]')!.textContent).toContain(chuTin(CHU)!));
    expect(container.querySelector('[data-khoi="chong-tin"]')!.textContent).not.toMatch(/THẬT|NHIỄU/);
    expect(container.querySelector<HTMLElement>('[data-khoi="tin-lop"] button[data-tin="0"]')!.style.getPropertyValue('--c')).toMatch(/^var\(--tot-4\)$/);
  });
});
