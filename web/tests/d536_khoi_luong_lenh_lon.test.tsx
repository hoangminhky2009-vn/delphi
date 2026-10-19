/**
 * D536 — CỘT KHỐI LƯỢNG + NHÃN "◆ LỆNH LỚN" của màn minigame (demo `minigame-bat-day.html` `veDoThi`: dải VOL0 130 · VOLH 18, lịch sử mờ 0,35, nến chạy 0,7;
 * `#nhanLon` "◆ LỆNH LỚN" + ai đặt khi ghế là Tổ Chức — `thayChuLenh`). Client chỉ VẼ số server gửi (`lich_su_v` · `v` tích luỹ theo nhịp · `lon`), không tính.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { chuTin } from '@/lib/tin_man';

vi.mock('@/lib/hat_pixel', () => ({ phutHat: () => undefined, tamPhanTu: () => ({ x: 0, y: 0 }) }));

import { ManMinigame } from '@/components/holdem/ManMinigame';

const LS = Array.from({ length: 20 }, () => [100, 101, 99, 100]);
const SO0 = { vao: [], ra: [], hut: [], con_von: 4960, dang_cam: 0, tien_nut: { vao_nua: 2480, vao_het: 4960, thoat: 0 } };
const dauMan = (giayTruoc: number, them: object = {}) => ({
  vong: 2, ma: 'btc', von: 4960, dai: 'cang', nac: null, bat_dau: new Date(Date.now() - giayTruoc * 1000).toISOString(), gio_may: new Date().toISOString(),
  dem_ms: 4000, chay_ms: 34000, so_nhip: 480, cua_so_ms: 2000, phien_ban: 'x', lich_su: LS,
  loi_cam: ['bat_day'], la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], so: SO0, ...them,
});
const dongMo = (manh: string) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(manh)); } }),
  { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
function mayChu(d: object, lo: object) {
  vi.stubGlobal('fetch', vi.fn(async () => dongMo(JSON.stringify({ loai: 'dau', ...d }) + '\n' + JSON.stringify({ loai: 'nhip', tu: 0, nen: [], ...lo }) + '\n')));
}
/** Canvas giả ghi mọi `fillRect` kèm `globalAlpha` lúc vẽ (chỉ canvas chính 202 × 150 — bảng phụ không có). */
type Ve = { x: number; y: number; w: number; h: number; a: number };
function canvasGhi(): Ve[] {
  const ve: Ve[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    const cx = { globalAlpha: 1, fillStyle: '', imageSmoothingEnabled: false, fillRect: (x: number, y: number, w: number, h: number) => { if (this.height === 150) ve.push({ x, y, w, h, a: cx.globalAlpha }); } };
    return cx as never;
  });
  return ve;
}
/** Cột khối lượng = hình chữ nhật rộng 3 nằm trọn trong dải [130, 148]. */
const cot = (ve: Ve[]) => ve.filter((r) => r.w === 3 && r.y >= 130 && r.y + r.h === 148);

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('D536 — cột khối lượng (demo `veDoThi` dải VOL0 130 · VOLH 18)', () => {
  it('⭐ khoá có lệnh lớn: cột dưới mỗi nến; cột lớn nhất cao đủ 18 px; lịch sử mờ 0,35, nến chạy 0,7; vạch ngăn ở 127', async () => {
    const ve = canvasGhi();
    // nhịp 0–299: khối lượng tích luỹ của nến mịn j ở nhịp k = (j + 1) × (k % 8 + 1) / 8 ⇒ nến sau dày hơn nến trước.
    const v = Array.from({ length: 300 }, (_, k) => ((Math.floor(k / 8) + 1) * ((k % 8) + 1)) / 8);
    mayChu(dauMan(14, { lich_su_v: Array(20).fill(0.5) }), { gia: Array(300).fill(100), v });
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(cot(ve).length).toBeGreaterThan(10));
    const c = cot(ve);
    expect(Math.max(...c.map((r) => r.h))).toBe(18);
    expect(c.some((r) => r.a === 0.35)).toBe(true);
    expect(c.some((r) => r.a === 0.7)).toBe(true);
    expect(ve.some((r) => r.y === 127 && r.h === 1)).toBe(true);
  });
  it('vế ngược: khoá cũ (không `lich_su_v`) ⇒ không cột, không vạch ngăn — màn cũ y như trước', async () => {
    const ve = canvasGhi();
    mayChu(dauMan(14), { gia: Array(300).fill(100) });
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(ve.length).toBeGreaterThan(50));
    expect(cot(ve)).toEqual([]);
    expect(ve.some((r) => r.y === 127 && r.h === 1)).toBe(false);
  });
});

describe('D536 — nhãn "◆ LỆNH LỚN" (demo `#nhanLon`)', () => {
  // bắt đầu 14 s trước, đếm 4 s, xem trễ 1,4 s ⇒ nhịp đang xem ≈ 121
  it('⭐ cú lệnh lớn đang đè nhịp đang xem ⇒ "◆ LỆNH LỚN"; Tổ Chức (server gửi `ai`) thấy ai đặt', async () => {
    canvasGhi();
    mayChu(dauMan(14), { gia: Array(300).fill(100), lon: [{ nhip: 100, het: 200 }] });
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r.container.querySelector('[data-khoi="nhan-lon"]')?.textContent).toBe('◆ LỆNH LỚN'));
    r.unmount();
    mayChu(dauMan(14, { to_chuc: true }), { gia: Array(300).fill(100), lon: [{ nhip: 100, het: 200, ai: 'doi_lai' }] });
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r2.container.querySelector('[data-khoi="nhan-lon"]')?.textContent).toBe('◆ LỆNH LỚN · ĐỘI LÁI'));
  });
  it('⭐ lệnh lớn và bán cưỡng bức cùng lúc ⇒ LỆNH LỚN thắng (demo `G.xung.find`: cú dựng sẵn đứng trước); cú đã hết ⇒ về BÁN CƯỠNG BỨC', async () => {
    canvasGhi();
    mayChu(dauMan(14), { gia: Array(300).fill(100), tl: [{ nhip: 112, ai: 'dam_dong', L: 4 }], lon: [{ nhip: 100, het: 200, ai: 'ca_map' }] });
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r.container.querySelector('[data-khoi="nhan-lon"]')?.textContent).toBe('◆ LỆNH LỚN · CÁ MẬP'));
    r.unmount();
    mayChu(dauMan(14), { gia: Array(300).fill(100), tl: [{ nhip: 112, ai: 'dam_dong', L: 4 }], lon: [{ nhip: 40, het: 80 }] });
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r2.container.querySelector('[data-khoi="nhan-lon"]')?.textContent).toContain('BÁN CƯỠNG BỨC'));
  });
  it('cú chưa tới nhịp đang xem ⇒ không nhãn (client không đi trước đồng hồ xem)', async () => {
    canvasGhi();
    mayChu(dauMan(14), { gia: Array(300).fill(100), lon: [{ nhip: 250, het: 300 }] });
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await new Promise((x) => setTimeout(x, 400));
    expect(r.container.querySelector('[data-khoi="nhan-lon"]')).toBeNull();
  });
});

describe('D536 — tin của bot Đội Lái (demo `cungMap === "doi_lai"`)', () => {
  it('ID chữ `bot.doi_lai` ⇒ câu của demo', () => {
    expect(chuTin('bot.doi_lai')).toBe('Mã này đang được gom mạnh, lên thuyền!');
  });
});
