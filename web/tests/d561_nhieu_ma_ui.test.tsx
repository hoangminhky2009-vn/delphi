/**
 * D561 — đánh màn nhiều mã trên web (khoá v65 `nhieuMa`): ô bảng phụ là cửa sang màn con — chạm ⇒ dòng nhịp + cú bấm đi kèm `ma`, màn hiện mã ấy;
 * kết quả cộng mọi khoản + dòng quyết toán từng mã. Khoá một mã ⇒ ô bảng phụ chỉ xem (không cửa).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ManMinigame } from '@/components/holdem/ManMinigame';

const LS = Array.from({ length: 20 }, (_, i) => [100, 101, 99, 100 + i * 0.01]);
const SO0 = { vao: [], ra: [], hut: [], con_von: 4960, dang_cam: 0, tien_nut: { vao_nua: 2480, vao_het: 4960, thoat: 0 } };
const dau = (ma: string, phu: string[], nhieu: boolean, von: number) => ({
  vong: 2, ma, von, dai: 'cang', bat_dau: new Date(Date.now() - 14_000).toISOString(), gio_may: new Date().toISOString(),
  dem_ms: 4000, chay_ms: 34000, so_nhip: 480, cua_so_ms: 2000, phien_ban: 'minigame-v2-duongsinh', lich_su: LS, nac: null,
  loi_cam: ['bat_day'], la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], so: { ...SO0, con_von: von }, phu,
  ...(nhieu ? { nhieu_ma: ['btc', 'vang'], ma_chinh: 'btc' } : {}),
});
const dongMo = (manh: string) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(manh)); } }),
  { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function mayChu(nhieu: boolean) {
  const url: string[] = [], bam: any[] = [];
  vi.stubGlobal('fetch', vi.fn(async (u: string, init?: RequestInit) => {
    const s = String(u); url.push(s);
    if (s.includes('/lenh')) { const b = JSON.parse(String(init?.body)); bam.push(b); return json({ nhan: true, seq: bam.length, nhip: b.nhip, la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], so: SO0 }); }
    const vang = s.includes('ma=vang');
    const d = vang ? dau('vang', ['btc'], nhieu, 1200) : dau('btc', ['vang'], nhieu, 4960);
    const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(301).fill(100), nen: [], phu: vang ? { btc: Array(301).fill(101) } : { vang: Array(301).fill(102) } });
    return dongMo(JSON.stringify({ loai: 'dau', ...d }) + '\n' + lo + '\n');
  }));
  return { url, bam };
}

describe('D561 — chạm bảng phụ để đánh mã khác', () => {
  it('⭐ khoá nhiều mã: chạm ô Vàng ⇒ dòng nhịp hỏi `ma=vang`, màn hiện khoản Vàng, cú bấm mang `ma: vang`', async () => {
    const { url, bam } = mayChu(true);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const o = await waitFor(() => { const x = container.querySelector('[data-doi-ma="vang"]'); expect(x).toBeTruthy(); return x as HTMLElement; });
    expect(url.some((u) => u.includes('ma=vang'))).toBe(false);
    fireEvent.click(o);
    await waitFor(() => expect(url.some((u) => u.includes('/nhip') && u.includes('ma=vang'))).toBe(true));
    await waitFor(() => expect(container.querySelector('[data-doi-ma="btc"]'), 'bảng phụ giờ là BTC — chạm để quay lại').toBeTruthy());
    expect(screen.getByText('1.200', { selector: 'b' })).toBeTruthy();
    const vaoHet = screen.getByRole('button', { name: /VÀO HẾT/ });
    await waitFor(() => expect((vaoHet as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(vaoHet);
    await waitFor(() => expect(bam).toHaveLength(1));
    expect(bam[0]).toMatchObject({ nut: 'vao_het', ma: 'vang' });
  });
  it('vế ngược — khoá một mã: ô bảng phụ không phải cửa; cú bấm không mang `ma`', async () => {
    const { bam } = mayChu(false);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="bang-phu"]')).toBeTruthy());
    expect(container.querySelector('[data-doi-ma]')).toBeNull();
    const vaoHet = screen.getByRole('button', { name: /VÀO HẾT/ });
    await waitFor(() => expect((vaoHet as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(vaoHet);
    await waitFor(() => expect(bam).toHaveLength(1));
    expect(bam[0].ma).toBeUndefined();
  });
});

describe('D561 — úp lá pha tới hết màn', () => {
  const KQ = {
    vong: 2, ma: 'btc', von: 4960, von_sau: 4960, la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], loi: 0, giu: 0, theo_lenh: 0, cham_tran: false, tu_dong: true,
    phi_gai: 0, ma_khac: [], vao: [], ra: [], hut: [], gia_dau: 100, day: 99, dinh: 101, gia_cuoi: 100, nhan: ['giu_suot'], nav_truoc: 10000, nav_sau: 10000,
    the_vong: { kind: 'giai_doan', giai_doan: 'giam' },
  };
  function mayChuUp(upLa: boolean, het: boolean) {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      const s = String(u);
      if (s.includes('/ket-qua')) return het ? json(KQ) : new Response(JSON.stringify({ error: 'chua_het' }), { status: 409 });
      const d = { ...dau('btc', [], false, 4960), ...(upLa ? { up_la: true } : {}),
        ...(het ? { bat_dau: new Date(Date.now() - 60_000).toISOString() } : {}) };
      const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(het ? 480 : 301).fill(100), nen: [] });
      return dongMo(JSON.stringify({ loai: 'dau', ...d }) + '\n' + lo + '\n' + (het ? '{"loai":"het"}\n' : ''));
    }));
  }
  const matThe = (o: any) => ({ svg: '', ten: o.giai_doan === 'giam' ? 'Giảm' : '?' });
  it('⭐ đang chạy: lá vòng vừa chốt giữ ÚP (nhãn "LẬT SAU MÀN"); vế ngược — khoá cũ thì lá đã lật', async () => {
    mayChuUp(true, false);
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} theMoi={{ svg: '', ten: 'Giảm' }} matTheCua={matThe} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /VÀO HẾT/ })).toBeTruthy());
    expect(r.container.querySelector('[data-khoi="the-moi"]')!.className).toMatch(/\bup\b|_up_/);
    expect(screen.getByText(/LẬT SAU MÀN/)).toBeTruthy();
    r.unmount();
    mayChuUp(false, false);
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} theMoi={{ svg: '', ten: 'Giảm' }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /VÀO HẾT/ })).toBeTruthy());
    expect(r2.container.querySelector('[data-khoi="the-moi"]')!.className).not.toMatch(/\bup\b|_up_/);
  });
  it('hết màn có kết quả: lá LẬT bằng mặt lá server gửi kèm kết quả', async () => {
    mayChuUp(true, true);
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} matTheCua={matThe} />);
    await waitFor(() => expect(r.container.querySelector('[data-khoi="so-kq"]')).toBeTruthy(), { timeout: 3000 });
    expect(r.container.querySelector('[data-khoi="the-moi"]')!.className).not.toMatch(/\bup\b|_up_/);
    expect(r.container.querySelector('[data-khoi="the-moi"]')!.textContent).toContain('Giảm');
  });

  // D585 — thẻ vòng lật MỘT lần, trên bàn: màn trận (`latTrenBan`) không lật lần hai.
  it('⭐ D585 `latTrenBan`: lá pha úp giữ ÚP cả lúc quyết toán (bàn lật nó một lần sau màn); không cờ thì màn lật như cũ', async () => {
    mayChuUp(true, true);
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} matTheCua={matThe} latTrenBan />);
    await waitFor(() => expect(r.container.querySelector('[data-khoi="so-kq"]')).toBeTruthy(), { timeout: 3000 });
    expect(r.container.querySelector('[data-khoi="the-moi"]')!.className).toMatch(/\bup\b|_up_/);
  });
  it('⭐ D585 `latTrenBan`: lá có mặt (đã lật trên bàn) hiện NGỬA ngay từ lần vẽ đầu — không úp chờ pha rồi lật lại', () => {
    mayChuUp(false, false);
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} theMoi={{ svg: '', ten: 'Giảm' }} latTrenBan />);
    expect(r.container.querySelector('[data-khoi="the-moi"]')!.className).not.toMatch(/\bup\b|_up_/);
    r.unmount();
    mayChuUp(false, false);
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} theMoi={{ svg: '', ten: 'Giảm' }} />);
    expect(r2.container.querySelector('[data-khoi="the-moi"]')!.className, 'không cờ: úp tới khi biết pha rồi lật (lối cũ)').toMatch(/\bup\b|_up_/);
  });
});
