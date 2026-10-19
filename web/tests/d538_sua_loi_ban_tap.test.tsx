/**
 * D538 — phản hồi founder 06/10 tối (bản 0.0.55 trên điện thoại):
 *  · "Lõi đòn bẩy đôi khi ko xuất hiện đường kẻ đỏ (giới hạn thanh lý) mà phải bấm zoom chart mới hiện" — vạch ra NGOÀI khung giá thì app không vẽ
 *    gì; demo BẢN 49 vẽ dấu ▼/▲ ở mép phải (`veNgoaiKhung`). Thêm: nhịp đang xem còn trước mốc đầu của ngưỡng (vừa bấm, xem trễ ~1,4 s) ⇒ dùng mốc đầu.
 *  · "Cho delphi trong màn hướng dẫn của minigame chuyển động như phần hướng dẫn bên ngoài" — Oracle trong màn bay cùng nhịp với trợ lý ngoài.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

vi.mock('@/lib/hat_pixel', () => ({ phutHat: () => undefined, tamPhanTu: () => ({ x: 0, y: 0 }) }));

import { ManMinigame } from '@/components/holdem/ManMinigame';

const LS = Array.from({ length: 20 }, () => [100, 101, 99, 100]);
const soDb = (goi: number, thanhLy: number, tu: number) => ({
  vao: [{ tien: 4960, khop: 100, nhip: 10, loai: 'vao' }], ra: [], hut: [], con_von: 0, dang_cam: 4960, tien_nut: { vao_x2: 0, chot: 4960 },
  db: { L: 2, ky_quy: 4960, nap_nhan: 0, da_goi: false, nap: [], nap_con: {}, thanh_ly: null, nguong: { tu, goi: Array(480 - tu).fill(goi), thanh_ly: Array(480 - tu).fill(thanhLy) } },
});
const dauMan = (giayTruoc: number, so: object) => ({
  vong: 2, ma: 'btc', von: 4960, dai: 'cang', nac: null, bat_dau: new Date(Date.now() - giayTruoc * 1000).toISOString(), gio_may: new Date().toISOString(),
  dem_ms: 4000, chay_ms: 34000, so_nhip: 480, cua_so_ms: 2000, phien_ban: 'x', lich_su: LS,
  loi_cam: ['don_bay'], la: 'don_bay', nut: ['vao_x2', 'chot'], so,
});
const dongMo = (manh: string) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(manh)); } }),
  { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
function mayChu(d: object, lo: object) {
  vi.stubGlobal('fetch', vi.fn(async () => dongMo(JSON.stringify({ loai: 'dau', ...d }) + '\n' + JSON.stringify({ loai: 'nhip', tu: 0, nen: [], ...lo }) + '\n')));
}
type Ve = { x: number; y: number; w: number; h: number; mau: string };
function canvasGhi(): Ve[] {
  const ve: Ve[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    const cx = { globalAlpha: 1, fillStyle: '', imageSmoothingEnabled: false, fillRect: (x: number, y: number, w: number, h: number) => { if (this.height === 150) ve.push({ x, y, w, h, mau: String(cx.fillStyle) }); } };
    return cx as never;
  });
  return ve;
}
/** Dấu mép demo `veNgoaiKhung`: ba vạch 5 · 3 · 1 px chồng nhau (tam giác) cách mép phải 6 / 12 px. */
const dauMep = (ve: Ve[], W: number) => ve.filter((r) => r.h === 1 && (r.x === W - 8 || r.x === W - 14) && r.w === 5);

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('D538 — vạch GỌI / THANH LÝ của Đòn Bẩy ngoài khung ⇒ dấu ở mép (demo BẢN 49)', () => {
  it('⭐ giá đi ngang 100, sàn thanh lý 60 + vạch gọi 70 (ngoài khung) ⇒ hai dấu ▼ ở mép phải dưới, không có vạch đứt ngang khung', async () => {
    const ve = canvasGhi();
    mayChu(dauMan(14, soDb(70, 60, 50)), { gia: Array(300).fill(100) });
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    // khung thường 30 nến ⇒ W = (10 + 30) × 5 + 2 = 202
    await waitFor(() => expect(dauMep(ve, 202).length).toBeGreaterThanOrEqual(2));
    expect(dauMep(ve, 202).every((r) => r.y >= 116 && r.y <= 118)).toBe(true);
  });
  it('vạch trong khung (gọi 99,5 · thanh lý 99,2) ⇒ vạch đứt ngang khung như cũ, không dấu mép', async () => {
    const ve = canvasGhi();
    mayChu(dauMan(14, soDb(99.5, 99.2, 50)), { gia: Array(300).fill(100) });
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(ve.filter((r) => r.w === 3 && r.h === 1 && r.x === 0).length).toBeGreaterThan(0));
    expect(dauMep(ve, 202)).toEqual([]);
  });
  it('⭐ vừa bấm (mốc đầu ngưỡng sau nhịp đang xem ~121) ⇒ vẫn vẽ bằng mốc đầu, không để trống', async () => {
    const ve = canvasGhi();
    mayChu(dauMan(14, soDb(70, 60, 200)), { gia: Array(300).fill(100) });
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(dauMep(ve, 202).length).toBeGreaterThanOrEqual(2));
  });
});

describe('D538 — Oracle trong màn bay như trợ lý ngoài', () => {
  it('trợ lý ngoài và Oracle trong màn cùng dùng `Mascot bay` (một nhịp, một nguồn ở Mascot.module.css)', () => {
    const MG = readFileSync(resolve(process.cwd(), 'src/components/holdem/ManMinigame.tsx'), 'utf8');
    const CT = readFileSync(resolve(process.cwd(), 'src/components/holdem/CoachTap.tsx'), 'utf8');
    const CSS = readFileSync(resolve(process.cwd(), 'src/components/Mascot.module.css'), 'utf8');
    expect(MG).toMatch(/<Mascot size=\{22\} glow bay \/>/);
    expect(CT).toMatch(/<Mascot size=\{44\} glow bay=\{!itMotion\} \/>/);
    expect(CSS).toMatch(/\.bay \{ animation: mascotBay 3\.2s ease-in-out infinite; \}/);
    expect(CSS).toMatch(/prefers-reduced-motion: reduce\) \{ \.bay \{ animation: none; \} \}/);
    expect(readFileSync(resolve(process.cwd(), 'src/components/holdem/CoachTap.module.css'), 'utf8')).not.toMatch(/coachBay/);
  });
});
