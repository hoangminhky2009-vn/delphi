/**
 * D472 — VỎ MÀN MINIGAME trên web: dựng nến hiển thị · đọc dòng NDJSON · component (đầu màn, nút ĐÓNG, đường lui hỏi mỗi giây).
 * Đường server + DB: `tests/minigame_api.test.ts` ở gốc.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { dungNenHienThi } from '@/lib/minigame_nen';
import { docDongNhip, type DongNhip } from '@/api/minigame';
import { ManMinigame, phaMan } from '@/components/holdem/ManMinigame';
import { NHIP } from '@/lib/nhip';

const LS = Array.from({ length: 20 }, (_, i) => [100, 101, 99, 100 + i * 0.01]);
const dau = {
  vong: 2, ma: 'btc', von: 4960, dai: 'cang', bat_dau: new Date(Date.now() - 60_000).toISOString(), gio_may: new Date().toISOString(),
  dem_ms: 4000, chay_ms: 34000, so_nhip: 480, cua_so_ms: 2000, phien_ban: 'minigame-v2-duongsinh', lich_su: LS,
};

/** Một Response có thân là dòng chảy, cắt ở chỗ tuỳ ý (kể cả giữa một dòng JSON). */
const dongChay = (manh: string[]) => new Response(new ReadableStream({
  start(c) { const e = new TextEncoder(); manh.forEach((m) => c.enqueue(e.encode(m))); c.close(); },
}), { status: 200, headers: { 'content-type': 'application/x-ndjson' } });

/** Dòng GIỮ MỞ (như dòng thật giữa màn): gửi một mảnh rồi chờ, không đóng. */
const dongMo = (manh: string) => new Response(new ReadableStream({
  start(c) { c.enqueue(new TextEncoder().encode(manh)); },
}), { status: 200, headers: { 'content-type': 'application/x-ndjson' } });

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });   // jsdom không có canvas — component bỏ khung vẽ
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('§I — dựng nến hiển thị', () => {
  const g = Array.from({ length: 16 }, (_, i) => 100 + (i === 5 ? -3 : i * 0.1));
  it('khung thường gộp đôi: 16 nhịp = 1 nến; mở = đóng nến trước; râu giữ cú giật', () => {
    const n = dungNenHienThi(LS, g, new Map(), true);
    expect(n).toHaveLength(10 + 1);
    const cuoi = n[10]!;
    expect(cuoi.o).toBeCloseTo(LS[19]![3]!, 6);
    expect(cuoi.l).toBe(97);
    expect(cuoi.c).toBeCloseTo(101.5, 6);
    expect(cuoi.lichSu).toBe(false);
  });
  it('khung nhanh: 8 nhịp = 1 nến; cờ trắng theo chỉ số nến mịn', () => {
    const n = dungNenHienThi(LS, g, new Map([[1, [true, false]]]), false);
    expect(n).toHaveLength(22);
    expect(n[21]!.trang).toBe(true);
    expect(n[20]!.trang).toBe(false);
  });
  it('nến đang chạy dở (chưa đủ 8 nhịp) vẫn vẽ, đóng = nhịp mới nhất', () => {
    const n = dungNenHienThi(LS, [100, 102, 101], new Map(), false);
    expect(n[20]).toMatchObject({ h: 102, c: 101 });
  });
});

describe('§II — đọc dòng NDJSON', () => {
  it('⭐ dòng JSON bị cắt giữa hai gói vẫn ghép đúng; đủ đầu · nhịp · hết', async () => {
    const s = JSON.stringify({ loai: 'dau', ...dau }) + '\n' + JSON.stringify({ loai: 'nhip', tu: 0, gia: [100, 101], nen: [] }) + '\n{"loai":"het"}\n';
    vi.stubGlobal('fetch', vi.fn(async () => dongChay([s.slice(0, 37), s.slice(37, 200), s.slice(200)])));
    const nhan: DongNhip[] = [];
    await docDongNhip('m', 2, 0, (d) => nhan.push(d), new AbortController().signal);
    expect(nhan.map((d) => d.loai)).toEqual(['dau', 'nhip', 'het']);
  });
  it('mở dòng hỏng (404) ⇒ ném lỗi để chỗ gọi rơi về hỏi một lần', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    await expect(docDongNhip('m', 2, 0, () => undefined, new AbortController().signal)).rejects.toThrow(/404/);
  });
});

describe('§III — component (D476: chép demo — chọn lá · màn + nút · kết quả + quyết toán)', () => {
  const SO0 = { vao: [], ra: [], hut: [], con_von: 4960, dang_cam: 0, tien_nut: { vao_nua: 2480, vao_het: 4960, thoat: 0 } };
  const dauBd = (giayTruoc: number) => ({
    ...dau, bat_dau: new Date(Date.now() - giayTruoc * 1000).toISOString(), gio_may: new Date().toISOString(), nac: null,
    loi_cam: ['bat_day', 'mua_duoi'], la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], so: SO0,
  });
  const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
  /** Máy chủ giả: dòng nhịp (dừng ở nhịp `den`), cú bấm (ghi lại body), kết quả. */
  const mayChu = (d: object, den: number, kq?: object) => {
    const bam: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/lenh')) {
        const b = JSON.parse(String(init?.body)); bam.push(b);
        return json({ nhan: true, seq: bam.length, nhip: b.nhip, la: b.nut.startsWith('la_') ? b.nut.slice(3) : 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'],
          so: b.nut === 'vao_het' ? { ...SO0, vao: [{ tien: 4960, khop: 100.5, nhip: b.nhip }], con_von: 0, dang_cam: 4960, tien_nut: { vao_nua: 0, vao_het: 0, thoat: 4960 } } : SO0 });
      }
      if (u.includes('/ket-qua')) return kq ? json(kq) : new Response(JSON.stringify({ error: 'chua_het' }), { status: 409 });
      const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(den + 1).fill(100), nen: [] });
      return dongMo(JSON.stringify({ loai: 'dau', ...d }) + '\n' + lo + '\n');
    }));
    return bam;
  };

  it('⭐ màn đang chạy: đầu màn (lõi · mã · nấc thanh khoản · vốn ×2), ba nút với tiền server trả; VÀO HẾT gửi số nhịp đang thấy ⇒ sổ mới, THOÁT mở', async () => {
    const bam = mayChu(dauBd(14), 300);
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(screen.getAllByText(/BẮT ĐÁY/).length).toBeGreaterThan(0));
    expect(screen.getByText(/Crypto/)).toBeTruthy();
    expect(screen.getByText('THANH KHOẢN MỎNG')).toBeTruthy();   // nac null ⇒ nấc nền của Crypto
    expect(screen.getByText('4.960', { selector: 'b' })).toBeTruthy();
    const vaoHet = screen.getByRole('button', { name: /VÀO HẾT/ });
    await waitFor(() => expect((vaoHet as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByRole('button', { name: /VÀO NỬA/ }).textContent).toContain('2.480');
    expect((screen.getByRole('button', { name: /THOÁT/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(vaoHet);
    await waitFor(() => expect(bam).toHaveLength(1));
    expect(bam[0]).toMatchObject({ nut: 'vao_het' });
    expect(bam[0].nhip).toBeGreaterThanOrEqual(0);
    await waitFor(() => expect((screen.getByRole('button', { name: /THOÁT/ }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText('LONG')).toBeTruthy();
  });

  it('⭐ pha CHỌN LÕI: lá đúng lõi đang cầm (icon · tên · câu demo · dòng đo); bấm lá ⇒ gửi `la_<lõi>` ở nhịp −1', async () => {
    const bam = mayChu(dauBd(-5), 0);
    // Founder 04/10: "card dùng art có sẵn" — lá lõi vẽ bằng art của quầy lõi, thẻ ô bằng art của bản đồ (không emoji).
    const art = { bat_day: '<svg data-art="bat_day"></svg>', mua_duoi: '<svg data-art="mua_duoi"></svg>' };
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} art={art}
      theMoi={{ svg: '<svg data-art="gd_giam"></svg>', ten: 'Giảm' }} />);
    await waitFor(() => expect(screen.getAllByText('CHỌN LÕI').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Bắt Đáy' }).querySelector('svg[data-art="bat_day"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mua Đuổi' }).querySelector('svg[data-art="mua_duoi"]')).toBeTruthy();
    expect(container.querySelector('svg[data-art="gd_giam"]'), 'thẻ vòng vẽ bằng art lá').toBeTruthy();
    expect(screen.queryByText('🩸'), 'không còn emoji của demo').toBeNull();
    expect(screen.getByText('Giá đang lên thì sẽ lên tiếp.')).toBeTruthy();
    expect(screen.getByText('đo: cách vào lệnh')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mua Đuổi' }));
    await waitFor(() => expect(bam).toHaveLength(1));
    expect(bam[0]).toMatchObject({ nhip: -1, nut: 'la_mua_duoi' });
  });

  it('⭐ D527 — bàn tập (`tap`): dải Oracle trong màn nói lời theo vòng + lõi (màn 4 Bắt Đáy ⇒ ĐƯỜNG GIÁ TRỊ); trận thường không có dải', async () => {
    mayChu(dauBd(14), 300);
    const { unmount } = render(<ManMinigame matchId="m1" vong={4} dong={() => undefined} tap />);
    await waitFor(() => expect(document.querySelector('[data-tap="oracle-man"]')).toBeTruthy());
    expect(document.querySelector('[data-tap="oracle-man"]')!.textContent).toContain('ĐƯỜNG GIÁ TRỊ');
    unmount();
    mayChu(dauBd(14), 300);
    render(<ManMinigame matchId="m1" vong={4} dong={() => undefined} />);
    await waitFor(() => expect(screen.getAllByText(/BẮT ĐÁY/).length).toBeGreaterThan(0));
    expect(document.querySelector('[data-tap="oracle-man"]'), 'trận thường mà có lời dạy').toBeNull();
  });

  it('⭐ hết màn ⇒ hỏi KẾT QUẢ: số lãi lỗ, khoản trước → sau, NAV trước → sau; VÒNG KẾ trả về màn trận', async () => {
    mayChu(dauBd(60), 479, {
      vong: 2, ma: 'btc', von: 4960, von_sau: 4960, la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], loi: 123, giu: 0, theo_lenh: 123, cham_tran: false, tu_dong: false,
      ma_khac: [{ ma: 'vang', von_truoc: 2700, von_sau: 2781, bp: 300 }],
      vao: [{ tien: 4960, khop: 100.5, nhip: 100, loai: 'het' }], ra: [{ tien: 4960, ra: 103, nhip: 480, lai: 123, tu_dong_cuoi: true, cuoi_khoa: false }],
      hut: [], gia_dau: 100, day: 95, dinh: 104, gia_cuoi: 103.5, nhan: ['kien_nhan'], nav_truoc: 10000, nav_sau: 10123,
    });
    const dong = vi.fn();
    render(<ManMinigame matchId="m1" vong={2} dong={dong} />);
    await waitFor(() => expect(screen.getAllByText('+123').length).toBe(2));   // số lớn + dòng "nhờ lõi" của quyết toán
    expect(screen.getByText(/NHỜ LÕI · BẮT ĐÁY · TRÊN KHOẢN CRYPTO/)).toBeTruthy();
    expect(screen.getByText('4.960 → 5.083')).toBeTruthy();
    expect(screen.getByText('10.000 → 10.123')).toBeTruthy();
    expect(screen.getByText(/đáy dải −5,0%/)).toBeTruthy();
    // D479 — mã khác đang cầm: dòng giữ suốt màn theo % thị trường của vòng.
    expect(screen.getByText(/Vàng · giữ suốt màn/)).toBeTruthy();
    expect(screen.getByText('+81')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /VÒNG KẾ/ }));
    // D588 — VÒNG KẾ diễn cú RA (khung hạ + mờ `MAN_RA`) rồi mới trả về màn trận: ngay lúc bấm là RA, chưa đóng; hết nhịp thì đóng ĐÚNG một lần.
    expect(screen.getByRole('dialog').getAttribute('data-chuyen')).toBe('ra');
    expect(dong).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /VÒNG KẾ/ }));   // bấm lần hai trong lúc đang ra ⇒ không đóng hai lần
    await waitFor(() => expect(dong).toHaveBeenCalledTimes(1), { timeout: NHIP.MAN_RA + 1000 });
    await new Promise((r) => setTimeout(r, NHIP.MAN_RA + 50));
    expect(dong).toHaveBeenCalledTimes(1);
  });

  it('⭐ D483 Đội lái: khối GÀI TIN GIẢ ở pha chọn lõi (phí server trả); bấm ▲ ⇒ gửi `gai_tot` ở nhịp −1, nút ▲ sáng, ▼ khoá', async () => {
    const bam = mayChu({ ...dauBd(-5), gai: { phi: 148, chieu: 0 } }, 0);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(screen.getByText('GÀI TIN GIẢ? · 148')).toBeTruthy());
    expect(container.querySelector('[data-khoi="gai-tin"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '▲ TIN TỐT' }));
    await waitFor(() => expect(bam).toHaveLength(1));
    expect(bam[0]).toMatchObject({ nhip: -1, nut: 'gai_tot' });
    expect(screen.getByRole('button', { name: '▲ TIN TỐT' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('button', { name: '▼ TIN XẤU' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '▼ TIN XẤU' }));
    expect(bam, 'gài một lần').toHaveLength(1);
  });

  it('vế ngược: ghế không trait TUNG TIN (`gai` null) ⇒ không có khối gài', async () => {
    mayChu({ ...dauBd(-5), gai: null }, 0);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(screen.getAllByText('CHỌN LÕI').length).toBeGreaterThan(0));
    expect(container.querySelector('[data-khoi="gai-tin"]')).toBeNull();
  });

  it('⭐ kết quả có phí gài ⇒ dòng "trong đó phí gài tin giả", khoản sau đã trừ phí', async () => {
    mayChu(dauBd(60), 479, {
      vong: 2, ma: 'btc', von: 4960, von_sau: 4960, la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], loi: -148, giu: 0, theo_lenh: 0, cham_tran: false, tu_dong: true,
      phi_gai: 148, ma_khac: [], vao: [], ra: [], hut: [], gia_dau: 100, day: 95, dinh: 104, gia_cuoi: 100, nhan: ['giu_suot'], nav_truoc: 10000, nav_sau: 9852,
    });
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="phi-gai"]')).toBeTruthy());
    expect(screen.getByText('trong đó phí gài tin giả')).toBeTruthy();
    // D534 — số lớn CHẠY từ 0 tới đích trong 1,1 s (demo `G.dem`) ⇒ chờ nó tới đích rồi mới đếm.
    await waitFor(() => expect(screen.getAllByText('−148'), 'số lớn + dòng khoản (đã trừ phí, như demo `G.kq.tien`) + dòng phí + VÌ SAO (gập, vẫn trong cây)').toHaveLength(4), { timeout: 3000 });
    expect([...container.querySelectorAll('div')].some((d) => d.children.length === 0 && d.textContent === '−148'), 'số LỚN (div lá; các dòng khác là span) đã trừ phí').toBe(true);
    expect(screen.getByText('4.960 → 4.812')).toBeTruthy();
  });

  it('⭐ D484 bảng phụ: chip mỗi mã khác đang cầm (tên + % theo nhịp đang xem) TRÊN bảng chính; ▾ BẢNG mở lưới nến, ▴ GỌN thu lại', async () => {
    const d = { ...dauBd(14), phu: ['vang', 'cp_cn'] };
    vi.stubGlobal('fetch', vi.fn(async () => {
      const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(301).fill(100), nen: [], phu: { vang: Array(301).fill(102), cp_cn: Array(301).fill(97) } });
      return dongMo(JSON.stringify({ loai: 'dau', ...d }) + '\n' + lo + '\n');
    }));
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="bang-phu"]')).toBeTruthy());
    const khoi = container.querySelector('[data-khoi="bang-phu"]')!;
    expect(khoi.compareDocumentPosition(container.querySelector('canvas')!) & Node.DOCUMENT_POSITION_FOLLOWING, 'bảng phụ đứng TRƯỚC bảng chính').toBeTruthy();
    expect(khoi.textContent).toContain('Vàng');
    await waitFor(() => expect(khoi.textContent).toContain('+2,0%'));
    expect(khoi.textContent).toContain('−3,0%');
    // D490 — mặc định MỞ (founder: "mặc định là bung ra, bấm vào thì ẩn đi")
    expect(khoi.querySelectorAll('canvas')).toHaveLength(2);
    const chip = () => [...khoi.querySelectorAll('span')].filter((x) => /bpChip/.test(x.className)).length;
    expect(chip(), 'mở thì chỉ lưới — không chip (chip là dạng thu gọn)').toBe(0);
    fireEvent.click(screen.getByRole('button', { name: '▴ GỌN' }));
    expect(khoi.querySelectorAll('canvas')).toHaveLength(0);
    expect(chip()).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: '▾ BẢNG' }));
    expect(khoi.querySelectorAll('canvas')).toHaveLength(2);
  });

  it('vế ngược: không có mã khác (`phu` rỗng / vắng) ⇒ không có bảng phụ', async () => {
    mayChu(dauBd(14), 300);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(screen.getAllByText(/BẮT ĐÁY/).length).toBeGreaterThan(0));
    expect(container.querySelector('[data-khoi="bang-phu"]')).toBeNull();
  });

  it('⭐ D485 VÌ SAO ▾ (demo bản 29): mở thì THAY CHỖ câu mô tả + bảng QUYẾT TOÁN — thị trường (thẻ + % mỗi mã) · đường đi (đáy · đỉnh · cuối) · của bạn (theo lệnh − giữ = màn, nhãn); đóng thì trả lại', async () => {
    mayChu(dauBd(60), 479, {
      vong: 2, ma: 'btc', von: 4960, von_sau: 5134, la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], loi: 50, giu: 173, theo_lenh: 223, cham_tran: false, tu_dong: false,
      phi_gai: 0, ma_khac: [{ ma: 'vang', von_truoc: 2700, von_sau: 2781, bp: 300 }],
      vao: [{ tien: 4960, khop: 100.5, nhip: 100, loai: 'het' }], ra: [{ tien: 4960, ra: 105, nhip: 480, lai: 223, tu_dong_cuoi: true, cuoi_khoa: false }],
      hut: [], gia_dau: 100, day: 95, dinh: 104, gia_cuoi: 103.5, nhan: ['kien_nhan'], nav_truoc: 10000, nav_sau: 10050,
      tl: [{ nhip: 225, ai: 'ca_map', L: 4 }, { nhip: 235, ai: 'dam_dong', L: 10 }],   // D494 — dây chuyền
    });
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} theMoi={{ svg: '', ten: 'Tăng' }} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="vi-sao"]')).toBeTruthy());
    const vs = container.querySelector('[data-khoi="vi-sao"]') as HTMLDetailsElement;
    expect(vs.open).toBe(false);
    expect(screen.getByText(/Bạn vào ở/)).toBeTruthy();
    fireEvent.click(screen.getByText('VÌ SAO ▾'));
    await waitFor(() => expect(screen.getByText('QUYẾT TOÁN ▴')).toBeTruthy());
    expect(vs.open).toBe(true);
    expect(screen.queryByText(/Bạn vào ở/), 'câu mô tả nhường chỗ').toBeNull();
    expect(screen.queryByText('khoản Crypto'), 'bảng quyết toán nhường chỗ — rời khỏi cây, không chỉ gắn `hidden` (CSS module đè)').toBeNull();
    const nd = vs.textContent ?? '';
    for (const x of ['THỊ TRƯỜNG', 'Tăng', '+3,5%', 'Vàng', '+3,0%', 'ĐƯỜNG ĐI', '−5,0% · +4,0% · +3,5%', 'CỦA BẠN', 'KIÊN NHẪN', '+223 − +173 = +50',
      'bán cưỡng bức', '2 vị thế · cá mập ×4 → đám đông ×10']) expect(nd, x).toContain(x);
    fireEvent.click(screen.getByText('QUYẾT TOÁN ▴'));
    await waitFor(() => expect(screen.getByText(/Bạn vào ở/)).toBeTruthy());
  });

  it('⭐ D486 Kiên Nhẫn: trong 10 s đầu ba nút khoá, nhãn "🧘 mở sau Ns"; Nóng Vội: quá giây 17 nút khoá "⚡ hết giờ bấm"; không gửi lệnh', async () => {
    const bam = mayChu({ ...dauBd(4 + 5), trait_man: { khoa_s: 10 } }, 60);
    const { unmount } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(screen.getAllByText(/🧘 mở sau \d+s/).length).toBe(3));
    for (const n of screen.getAllByRole('button', { name: /VÀO|THOÁT/ })) expect((n as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /VÀO HẾT/ }));
    expect(bam).toHaveLength(0);
    unmount();
    mayChu({ ...dauBd(4 + 20), trait_man: { han_s: 17 }, so: { ...SO0, vao: [{ tien: 4960, khop: 100.5, nhip: 50 }], con_von: 0, dang_cam: 4960 } }, 300);
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(screen.getAllByText('⚡ hết giờ bấm').length).toBe(3));
    expect(screen.queryByText('LONG'), 'qua mốc 17 s: server đã tự chốt').toBeNull();
    expect(screen.getByText(/ĐÃ TỰ CHỐT · GIÂY 17/)).toBeTruthy();
  });

  it('⭐ D490 chốt xong (đã THOÁT, không còn nút nào có tiền) ⇒ hàng nút xám; vế ngược — đang cầm thì không xám', async () => {
    const xong = { ...SO0, vao: [{ tien: 4960, khop: 100.5, nhip: 50 }], ra: [{ tien: 4960, ra: 102, nhip: 90, lai: 70 }], con_von: 0, dang_cam: 0,
      tien_nut: { vao_nua: 0, vao_het: 0, thoat: 0 } };
    mayChu({ ...dauBd(14), so: xong }, 300);
    const r1 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r1.container.querySelector('[data-khoi="hang-nut"]')?.className).toMatch(/xamMan/));
    r1.unmount();
    mayChu({ ...dauBd(14), so: { ...xong, ra: [], dang_cam: 4960, tien_nut: { vao_nua: 0, vao_het: 0, thoat: 4960 } } }, 300);
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r2.container.querySelector('[data-khoi="hang-nut"]')).toBeTruthy());
    expect(r2.container.querySelector('[data-khoi="hang-nut"]')!.className).not.toMatch(/xamMan/);
  });

  it('vế ngược: không trait ⇒ không nhãn khoá', async () => {
    mayChu(dauBd(4 + 5), 60);
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(screen.getAllByText(/BẮT ĐÁY/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/mở sau|hết giờ bấm/)).toBeNull();
  });

  it('dòng không mở được ⇒ rơi về hỏi mỗi giây (`?mot_lan=1`)', async () => {
    const goi: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      goi.push(String(url));
      if (String(url).includes('mot_lan=1')) {
        return new Response(JSON.stringify({ dau: dauBd(14), lo: { tu: 0, gia: [100], nen: [] }, het: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 503 });
    }));
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(goi.some((u) => u.includes('mot_lan=1'))).toBe(true));
    // Dòng hỏng thì màn vẫn đi được tới KẾT QUẢ qua đường hỏi mỗi giây (vốn hiện trong đầu màn hoặc ở dòng khoản).
    await waitFor(() => expect(screen.getAllByText(/4\.960/).length).toBeGreaterThan(0));
    expect(goi.filter((u) => u.includes('/nhip?') && !u.includes('mot_lan=1'))).toHaveLength(2);   // thử dòng 2 lần rồi mới lui
  });
});

describe('§IV — D473: pha màn theo đồng hồ server (lật thẻ 3 s → chọn lá 8 s → đếm 4 s → chạy 34 s → hết)', () => {
  const B = 100_000, DEM = 4000, CHAY = 34_000;
  it('mốc từng pha, đếm lên giây', () => {
    expect(phaMan(B - 11_000, B, DEM, CHAY)).toEqual({ loai: 'lat', giay: 3 });
    expect(phaMan(B - 8_001, B, DEM, CHAY)).toEqual({ loai: 'lat', giay: 1 });
    expect(phaMan(B - 8_000, B, DEM, CHAY)).toEqual({ loai: 'chon', giay: 8 });
    expect(phaMan(B - 1, B, DEM, CHAY)).toEqual({ loai: 'chon', giay: 1 });
    expect(phaMan(B, B, DEM, CHAY)).toEqual({ loai: 'dem', giay: 4 });
    expect(phaMan(B + DEM - 1, B, DEM, CHAY)).toEqual({ loai: 'dem', giay: 1 });
    expect(phaMan(B + DEM, B, DEM, CHAY)).toEqual({ loai: 'chay' });
    expect(phaMan(B + DEM + CHAY - 1, B, DEM, CHAY)).toEqual({ loai: 'chay' });
    expect(phaMan(B + DEM + CHAY, B, DEM, CHAY)).toEqual({ loai: 'het' });
  });
});

describe('§V — CSS của màn: mỗi lớp gốc khai báo MỘT lần', () => {
  it('⭐ không lớp nào bị khai báo lại ở gốc tệp (D484: `.truocMan` của khối gài tin gộp vào lớp phủ HẾT MÀN ⇒ khối gài nằm dưới lá, bấm ▲ trúng lá)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/holdem/ManMinigame.module.css'), 'utf8');
    const goc = [...css.matchAll(/^\.([A-Za-z0-9_]+)\s*\{/gm)].map((m) => m[1]!);
    const trung = goc.filter((x, i) => goc.indexOf(x) !== i);
    expect(goc.length, 'bài không rỗng').toBeGreaterThan(20);
    expect(trung).toEqual([]);
  });
});

describe('§V — D492: lõi Đòn Bẩy trong màn', () => {
  const NUT_DB = ['vao_x2', 'vao_x4', 'vao_x10', 'tang_x4', 'tang_x10', 'ban_het', 'chot', 'nap_vang'];
  const tienNut0 = { vao_x2: 4960, vao_x4: 4960, vao_x10: 4960, tang_x4: 0, tang_x10: 0, ban_het: 0, chot: 0, nap_vang: 0 };
  const db0 = { L: 0, ky_quy: 4960, nap_nhan: 0, da_goi: false, nap: [], nap_con: { vang: 3000 }, nap_phi: { vang: 6 }, thanh_ly: null, nguong: null };
  const SO = { vao: [], ra: [], hut: [], con_von: 4960, dang_cam: 0, tien_nut: tienNut0, db: db0 };
  const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
  /** Máy chủ giả: sau VÀO ×10 trả sổ có NGƯỠNG `goi` / `tl` cho mọi nhịp tới (giá dòng = 100). */
  /** `tt` — D504: lãi lỗ tạm tính server gửi kèm dòng nhịp khi đang cầm. Máy chủ thật dựng lại sổ từ mọi lệnh đã ghi ⇒ dòng mở lại mang sổ MỚI. */
  const mayChuDb = (goi: number, tl: number, phu?: string[], tt?: number, them?: { db?: object; tien_nut?: object }) => {
    const bam: any[] = [];
    let soNay: object = SO;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/lenh')) {
        const b = JSON.parse(String(init?.body)); bam.push(b);
        const so = b.nut === 'vao_x10' ? { ...SO, vao: [{ tien: 4960, khop: 100.5, nhip: b.nhip }], con_von: 0, dang_cam: 4960,
          tien_nut: { ...tienNut0, vao_x2: 0, vao_x4: 0, vao_x10: 0, ban_het: 4960, chot: 4960, nap_vang: 992, ...them?.tien_nut },
          db: { ...db0, L: 10, nguong: { tu: b.nhip + 1, goi: Array(480).fill(goi), thanh_ly: Array(480).fill(tl) }, ...them?.db } } : SO;
        soNay = so;
        return json({ nhan: true, seq: bam.length, nhip: b.nhip, la: 'don_bay', nut: NUT_DB, so });
      }
      if (u.includes('/ket-qua')) return new Response(JSON.stringify({ error: 'chua_het' }), { status: 409 });
      const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(301).fill(100), nen: [], ...(tt !== undefined && soNay !== SO ? { tt: Array(301).fill(tt) } : {}) });
      return dongMo(JSON.stringify({ loai: 'dau', ...dau, bat_dau: new Date(Date.now() - 14_000).toISOString(), gio_may: new Date().toISOString(), nac: null,
        loi_cam: ['don_bay'], la: 'don_bay', nut: NUT_DB, so: soNay, ...(phu ? { phu } : {}) }) + '\n' + lo + '\n');
    }));
    return bam;
  };

  it('⭐ chưa vào ⇒ ba nút VÀO ×2 · ×4 · ×10 (tiền server); VÀO ×10 ⇒ TĂNG (×10 tối đa) · NẠP THÊM · CHỐT, tạm tính "×10 · ký quỹ"', async () => {
    const bam = mayChuDb(80, 70);
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const x10 = await screen.findByRole('button', { name: /VÀO ×10/ });
    expect(screen.getByRole('button', { name: /VÀO ×2/ })).toBeTruthy();
    await waitFor(() => expect((x10 as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(x10);
    await waitFor(() => expect(bam).toHaveLength(1));
    expect(bam[0]).toMatchObject({ nut: 'vao_x10' });
    await screen.findByRole('button', { name: /×10 TỐI ĐA/ });
    expect((screen.getByRole('button', { name: /NẠP THÊM/ }) as HTMLButtonElement).disabled, 'chưa bị gọi ⇒ nạp tắt').toBe(true);
    expect(screen.getByRole('button', { name: /CHỐT/ })).toBeTruthy();
    expect(screen.getByText('LONG ×10')).toBeTruthy();
    expect(screen.queryByText(/BỊ GỌI/), 'giá 100 > ngưỡng gọi 80').toBeNull();
  });

  /*
   * Hẹn giờ hiệu ứng của cú bấm (lún nút 90 ms · rung bàn 140 ms) phải bị HUỶ khi màn gỡ. Rò thì nó bắn `setState` sau unmount — ở CI
   * là sau khi jsdom đóng ⇒ "window is not defined" ⇒ job thoát 1 dù mọi bài xanh (run 38030597768 · 38039548529, 10/10). Bài đếm
   * hẹn giờ 90/140 ms CÒN TREO ngay sau khi gỡ (gọi hàm thật, chỉ ghi sổ) — không phụ thuộc runner nhanh hay chậm.
   */
  it('⭐ gỡ màn NGAY sau cú bấm ⇒ không hẹn giờ hiệu ứng nào còn treo', async () => {
    mayChuDb(80, 70);
    const goc = { dat: globalThis.setTimeout, huy: globalThis.clearTimeout };
    const treo = new Set<unknown>();
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number, ...a: unknown[]) => {
      if (ms !== 90 && ms !== 140) return goc.dat(fn, ms, ...a);
      const t = goc.dat(() => { treo.delete(t); fn(); }, ms);
      treo.add(t);
      return t;
    }) as typeof setTimeout);
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((t?: Parameters<typeof clearTimeout>[0]) => { treo.delete(t); goc.huy(t); }) as typeof clearTimeout);
    const { unmount } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const x10 = await screen.findByRole('button', { name: /VÀO ×10/ });
    await waitFor(() => expect((x10 as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(x10);
    expect(treo.size, 'VÀO ×10 phải hẹn lún + rung — không thì bài rỗng').toBeGreaterThanOrEqual(2);
    unmount();
    expect(treo.size, 'hẹn giờ hiệu ứng còn treo sau khi gỡ màn ⇒ bắn setState sau unmount').toBe(0);
  });

  it('⭐ D519 — bàn phím vừa ĐỔI (VÀO ×10 ⇒ TĂNG · NẠP · CHỐT) ⇒ cú bấm trong 250 ms bị bỏ (ngón thứ hai không rơi vào ô mới); sau đó nhận', async () => {
    const bam = mayChuDb(80, 70);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const x10 = await screen.findByRole('button', { name: /VÀO ×10/ });
    await waitFor(() => expect((x10 as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(x10);
    const chot = await screen.findByRole('button', { name: /CHỐT/ });
    await waitFor(() => expect(container.querySelector('[data-khoi="hang-nut"]')?.className).toMatch(/doiPhim/));
    fireEvent.click(chot);
    await new Promise((r) => setTimeout(r, 50));
    expect(bam.map((b) => b.nut), 'cú bấm ngay sau khi phím đổi phải bị bỏ').toEqual(['vao_x10']);
    await new Promise((r) => setTimeout(r, 300));
    fireEvent.click(screen.getByRole('button', { name: /CHỐT/ }));
    await waitFor(() => expect(bam.map((b) => b.nut)).toEqual(['vao_x10', 'chot']));
  });

  it('⭐ D519 — hai cú bấm bay cùng lúc, câu trả lời CŨ (seq 1) về SAU câu mới (seq 2) ⇒ bỏ qua: không áp sổ cũ, không mở lại dòng thêm lần nữa', async () => {
    const tn = (L: number) => ({ ...tienNut0, vao_x2: 0, vao_x4: 0, vao_x10: 0, tang_x4: L === 2 ? 4960 : 0, tang_x10: L === 4 ? 4960 : 0, chot: 4960, nap_vang: 992 });
    const soL = (L: number) => ({ ...SO, vao: [{ tien: 4960, khop: 100, nhip: 5 }], con_von: 0, dang_cam: 4960, tien_nut: tn(L),
      db: { ...db0, L, nguong: { tu: 6, goi: Array(480).fill(50), thanh_ly: Array(480).fill(40) } } });
    let lan = 0;
    let moDong = 0;
    let soNay: object = SO;   // máy chủ thật: dòng mở lại mang sổ đã gộp mọi lệnh đã ghi (cả hai cú ghi xong trước khi câu trả lời chậm về)
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/lenh')) {
        lan += 1;
        const b = JSON.parse(String(init?.body));
        soNay = soL(4);
        // cú 1 (VÀO ×2) trả CHẬM sổ ×2 · cú 2 (VÀO ×4, server đã gộp: ×4) trả NGAY
        if (lan === 1) { await new Promise((r) => setTimeout(r, 150)); return json({ nhan: true, seq: 1, nhip: b.nhip, la: 'don_bay', nut: NUT_DB, so: soL(2) }); }
        return json({ nhan: true, seq: 2, nhip: b.nhip, la: 'don_bay', nut: NUT_DB, so: soL(4) });
      }
      if (u.includes('/ket-qua')) return new Response(JSON.stringify({ error: 'chua_het' }), { status: 409 });
      moDong += 1;
      const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(301).fill(100), nen: [] });
      return dongMo(JSON.stringify({ loai: 'dau', ...dau, bat_dau: new Date(Date.now() - 14_000).toISOString(), gio_may: new Date().toISOString(), nac: null,
        loi_cam: ['don_bay'], la: 'don_bay', nut: NUT_DB, so: soNay }) + '\n' + lo + '\n');
    }));
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const x2 = await screen.findByRole('button', { name: /VÀO ×2/ });
    await waitFor(() => expect((x2 as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(x2);
    fireEvent.click(screen.getByRole('button', { name: /VÀO ×4/ }));
    await screen.findByRole('button', { name: /TĂNG ×10/ });
    const truoc = moDong;
    await new Promise((r) => setTimeout(r, 300));
    expect(moDong, 'câu trả lời cũ về muộn vẫn cắt + mở lại dòng (và áp sổ cũ một nhịp)').toBe(truoc);
    expect(screen.queryByRole('button', { name: /TĂNG ×4/ })).toBeNull();
  });

  it('⭐ D510 — Bán Khống có KÝ QUỸ (đòn bẩy chiều bán): BÁN ×L → TĂNG · NẠP · MUA LẠI; giá ≥ ngưỡng gọi (`chieu` −1) ⇒ BỊ GỌI, nút giữa DỒN HẾT', async () => {
    const NUT_BK = ['ban_x2', 'ban_x4', 'ban_x10', 'tang_x4', 'tang_x10', 'ban_het', 'mua_lai', 'nap_vang'];
    const tn0 = { ban_x2: 4960, ban_x4: 4960, ban_x10: 4960, tang_x4: 0, tang_x10: 0, ban_het: 0, mua_lai: 0, nap_vang: 0 };
    const SO0 = { ...SO, tien_nut: tn0 };
    const bam: any[] = [];
    let soNay: object = SO0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/lenh')) {
        const b = JSON.parse(String(init?.body)); bam.push(b);
        // ngưỡng gọi 99 < giá 100 ⇒ phe KHỐNG đang bị gọi (giá ≥ ngưỡng) · mua cưỡng bức 150 (chưa chạm)
        const so = b.nut === 'ban_x10' ? { ...SO0, vao: [{ tien: 4960, khop: 99.5, nhip: b.nhip }], con_von: 0, dang_cam: 4960,
          tien_nut: { ...tn0, ban_x2: 0, ban_x4: 0, ban_x10: 0, ban_het: 3000, mua_lai: 4960, nap_vang: 992 },
          db: { ...db0, L: 10, chieu: -1, nguong: { tu: b.nhip + 1, goi: Array(480).fill(99), thanh_ly: Array(480).fill(150) } } } : soNay;
        soNay = so;
        return json({ nhan: true, seq: bam.length, nhip: b.nhip, la: 'ban_khong', nut: NUT_BK, so });
      }
      if (u.includes('/ket-qua')) return new Response(JSON.stringify({ error: 'chua_het' }), { status: 409 });
      const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(301).fill(100), nen: [] });
      return dongMo(JSON.stringify({ loai: 'dau', ...dau, bat_dau: new Date(Date.now() - 14_000).toISOString(), gio_may: new Date().toISOString(), nac: null,
        loi_cam: ['ban_khong'], la: 'ban_khong', nut: NUT_BK, so: soNay }) + '\n' + lo + '\n');
    }));
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const x10 = await screen.findByRole('button', { name: /BÁN ×10/ });
    expect(screen.getByRole('button', { name: /BÁN ×2/ })).toBeTruthy();
    await waitFor(() => expect((x10 as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(x10);
    const dong = await screen.findByRole('button', { name: /MUA LẠI/ });
    await screen.findByRole('button', { name: /DỒN HẾT/ });
    expect(screen.getByText('BỊ GỌI ×10')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 300));   // D519 — bàn phím vừa đổi ⇒ khoá 250 ms
    fireEvent.click(dong);
    await waitFor(() => expect(bam.map((b) => b.nut)).toContain('mua_lai'));
  });

  it('⭐ D511 — Mua Đuổi: VÀO (0/3) → NHỒI (1/3 · số server) · CHỐT NỬA gửi `chot_nua`', async () => {
    const NUT_MD = ['vao', 'chot_nua', 'chot_het'];
    const SO0 = { ...SO, tien_nut: { vao: 1653, chot_nua: 0, chot_het: 0 } };
    const bam: any[] = [];
    let soNay: object = SO0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/lenh')) {
        const b = JSON.parse(String(init?.body)); bam.push(b);
        const so = b.nut === 'vao' ? { ...SO0, vao: [{ tien: 1653, khop: 100.5, nhip: b.nhip }], con_von: 3307, dang_cam: 1653,
          tien_nut: { vao: 1653, chot_nua: 826, chot_het: 1653 } } : soNay;
        soNay = so;
        return json({ nhan: true, seq: bam.length, nhip: b.nhip, la: 'mua_duoi', nut: NUT_MD, so });
      }
      if (u.includes('/ket-qua')) return new Response(JSON.stringify({ error: 'chua_het' }), { status: 409 });
      const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(301).fill(100), nen: [] });
      return dongMo(JSON.stringify({ loai: 'dau', ...dau, bat_dau: new Date(Date.now() - 14_000).toISOString(), gio_may: new Date().toISOString(), nac: null,
        loi_cam: ['mua_duoi'], la: 'mua_duoi', nut: NUT_MD, so: soNay }) + '\n' + lo + '\n');
    }));
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const vao = await screen.findByRole('button', { name: /^VÀO/ });
    expect(vao.textContent).toContain('0/3 · 1.653');
    await waitFor(() => expect((vao as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(vao);
    const nhoi = await screen.findByRole('button', { name: /NHỒI/ });
    expect(nhoi.textContent).toContain('1/3 · 1.653');
    const nua = screen.getByRole('button', { name: /CHỐT NỬA/ });
    expect(nua.textContent).toContain('826');
    await new Promise((r) => setTimeout(r, 300));   // D519 — VÀO đổi thành NHỒI ⇒ bàn phím khoá 250 ms
    fireEvent.click(nua);
    await waitFor(() => expect(bam.map((b) => b.nut)).toContain('chot_nua'));
  });

  it('⭐ D531 — Lướt Sóng (demo `LOI.luot_song`): SHORT ▼ (phí 1 lần) → ĐẢO ▲ LONG (phí 2 lần) → ĐẢO ▼ SHORT · CHỐT tắt khi HOLD, bật khi đang cầm', async () => {
    const NUT_LS = ['dao', 'chot'];
    const SO_LS = { vao: [], ra: [], hut: [], con_von: 4960, dang_cam: 0, tien_nut: { dao: 22, chot: 0 } };
    const bam: any[] = [];
    let soNay: object = SO_LS;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/lenh')) {
        const b = JSON.parse(String(init?.body)); bam.push(b);
        const ch = bam.length % 2 === 1 ? -1 : 1;   // lần 1: SHORT · lần 2: ĐẢO lên LONG
        soNay = { ...SO_LS, vao: [{ tien: 4960, khop: 100, nhip: b.nhip }], dang_cam: 4960, tien_nut: { dao: 44, chot: 4960 }, ls: { chieu: ch, so_dao: bam.length - 1, phi: 22 * bam.length } };
        return json({ nhan: true, seq: bam.length, nhip: b.nhip, la: 'luot_song', nut: NUT_LS, so: soNay });
      }
      if (u.includes('/ket-qua')) return new Response(JSON.stringify({ error: 'chua_het' }), { status: 409 });
      const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(301).fill(100), nen: [] });
      return dongMo(JSON.stringify({ loai: 'dau', ...dau, bat_dau: new Date(Date.now() - 14_000).toISOString(), gio_may: new Date().toISOString(), nac: null,
        loi_cam: ['luot_song'], la: 'luot_song', nut: NUT_LS, so: soNay }) + '\n' + lo + '\n');
    }));
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const short = await screen.findByRole('button', { name: /SHORT ▼/ });
    expect(short.textContent).toContain('phí 22');
    const chot0 = screen.getByRole('button', { name: /CHỐT/ }) as HTMLButtonElement;
    expect(chot0.textContent).toContain('đang HOLD');
    expect(chot0.disabled).toBe(true);
    await waitFor(() => expect((short as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(short);
    const len = await screen.findByRole('button', { name: /ĐẢO ▲ LONG/ });
    expect(len.textContent).toContain('phí 44');
    expect(screen.getByRole('button', { name: /CHỐT/ }).textContent).toContain('đang SHORT · về HOLD');
    await new Promise((r) => setTimeout(r, 300));   // D519 — bàn phím vừa đổi chữ ⇒ khoá 250 ms
    fireEvent.click(len);
    await screen.findByRole('button', { name: /ĐẢO ▼ SHORT/ });
    expect(bam.map((b) => b.nut)).toEqual(['dao', 'dao']);
  });

  describe('D513 — LỚP SOI trên chart (chuỗi săn)', () => {
    /** Màn lõi `la` với lô nhịp kèm `soi` ở nhịp 99 (đã lộ). Canvas giả (hàm vẽ rỗng) để vòng vẽ chạy tới phần nhãn. */
    const manSoi = (la: string, soi: object) => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, globalAlpha: 1, fillStyle: '', imageSmoothingEnabled: false } as never);
      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (String(url).includes('/ket-qua')) return new Response(JSON.stringify({ error: 'chua_het' }), { status: 409 });
        const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(100).fill(100), nen: [], soi });
        return dongMo(JSON.stringify({ loai: 'dau', ...dau, bat_dau: new Date(Date.now() - 14_000).toISOString(), gio_may: new Date().toISOString(), nac: null,
          loi_cam: [la], la, nut: [], so: SO }) + '\n' + lo + '\n');
      }));
      return render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    };
    it('⭐ Bán Khống: nhãn ×10 ở SÀN phe mua (dải đỏ) · Mua Đuổi: nhãn ở MỨC ÉP phe khống', async () => {
      const a1 = manSoi('ban_khong', { muc: [{ gia: 91, L: 10, tien: 0.4, vao: 20 }] });
      await waitFor(() => expect(a1.container.querySelector('[data-khoi="soi"] b[data-k="san"]')?.textContent).toBe('×10'));
      a1.unmount();
      const a2 = manSoi('mua_duoi', { muc: [{ gia: 109, L: 5, tien: 0.4, vao: 20 }] });
      await waitFor(() => expect(a2.container.querySelector('[data-khoi="soi"] b[data-k="ep"]')?.textContent).toBe('×5'));
    });
    it('⭐ D523 Bắt Đáy (màn mới): nhãn "GIÁ TRỊ ↗" theo dốc 3 điểm cuối đã tới · QUÁ BÁN chỉ dưới nến ĐÃ đóng tới nhịp đang xem · không còn đáy thác', async () => {
      // điểm j = 2…6 (nến gộp 16 nhịp; dòng giả có 100 nhịp ⇒ đang xem nhịp 99 = giữa nến 6), giá trị lên đều 100 → 104 ⇒ dốc ↗;
      // QUÁ BÁN ở nến 1 (đã đóng) · nến 6 (ĐANG CHẠY — chưa được hiện) · nến 25 (chưa tới)
      const a0 = manSoi('bat_day', { gt: { diem: [2, 3, 4, 5, 6].map((j) => ({ j, g: 98 + j })), rong: 0.0156, quaBan: [1, 6, 25] } });
      await waitFor(() => expect(a0.container.querySelector('[data-khoi="soi"] b[data-k="gt"]')?.textContent).toBe('GIÁ TRỊ ↗'));
      expect(a0.container.querySelectorAll('[data-khoi="soi"] b[data-k="qb"]')).toHaveLength(1);
      expect(a0.container.querySelector('[data-khoi="soi"] b[data-k="qb"]')?.textContent).toBe('QUÁ BÁN');
      expect(a0.container.querySelector('[data-khoi="soi"]')?.textContent).not.toContain('THÁC');
      a0.unmount();
      const a1 = manSoi('bat_day', { gt: { diem: [2, 3, 4, 5, 6].map((j) => ({ j, g: 110 - j })), rong: 0.0156, quaBan: [] } });
      await waitFor(() => expect(a1.container.querySelector('[data-khoi="soi"] b[data-k="gt"]')?.textContent).toBe('GIÁ TRỊ ↘'));
      a1.unmount();
    });
    it('⭐ D521 Bắt Đáy: NẾU CHẠM (vạch sàn) + DẢI khoảng thác so với vạch (không còn chữ HỒI); màn cũ không khoảng ⇒ dải co về một mức; chợ vắng ⇒ chữ nhỏ', async () => {
      const a0 = manSoi('bat_day', { thac: { ngoi: 95, day: 92, n: 2, tu: 93, den: 90 } });
      await waitFor(() => expect(a0.container.querySelector('[data-khoi="soi"] b[data-k="thac"]')?.textContent).toBe('▸ THÁC −2,1% … −5,3%'));
      expect(a0.container.querySelector('[data-khoi="soi"] b[data-k="ngoi"]')?.textContent).toBe('NẾU CHẠM · 2 sàn nối nhau');
      expect(a0.container.querySelector('[data-khoi="soi"]')?.textContent).not.toContain('HỒI');
      a0.unmount();
      const a1 = manSoi('bat_day', { thac: { ngoi: 95, day: 92, n: 2 } });
      await waitFor(() => expect(a1.container.querySelector('[data-khoi="soi"] b[data-k="thac"]')?.textContent).toBe('▸ THÁC −3,2% … −3,2%'));
      a1.unmount();
      const a2 = manSoi('bat_day', { thac: null });
      await waitFor(() => expect(a2.container.querySelector('[data-khoi="soi"] i')?.textContent).toBe('chợ vắng đòn bẩy'));
    });
  });

  it('⭐ D504 — đang cầm: dòng tạm tính in SỐ TIỀN server gửi kèm dòng nhịp (không tự tính); cú bấm ⇒ mở lại dòng nhịp để nhận tạm tính mới', async () => {
    mayChuDb(80, 70, undefined, -3970);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const x10 = await screen.findByRole('button', { name: /VÀO ×10/ });
    await waitFor(() => expect((x10 as HTMLButtonElement).disabled).toBe(false));
    const moDong = () => (fetch as any).mock.calls.filter((c: any[]) => String(c[0]).includes('/nhip')).length;
    const truoc = moDong();
    fireEvent.click(x10);
    await waitFor(() => expect(container.querySelector('[data-khoi="tam-tinh-tien"]')?.textContent).toBe('−3.970'));
    expect(screen.getByText('LONG ×10')).toBeTruthy();
    expect(moDong(), 'mở lại dòng nhịp sau cú bấm').toBeGreaterThan(truoc);
  });

  it('vế ngược D504: server chưa gửi tạm tính ⇒ đường lui % giá, không có số tiền', async () => {
    mayChuDb(80, 70);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const x10 = await screen.findByRole('button', { name: /VÀO ×10/ });
    await waitFor(() => expect((x10 as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(x10);
    await screen.findByText('LONG ×10');
    expect(container.querySelector('[data-khoi="tam-tinh-tien"]')).toBeNull();
  });

  it('⭐ D507 — bị gọi: hàng bán có TIỀN MẶT (icon ví pixel, không phí); BÁN HẾT = "dồn hết ký quỹ", bấm gửi `ban_het`', async () => {
    const bam = mayChuDb(101, 70, undefined, undefined, { db: { nap_con: { vang: 3000, tien: 500 }, nap_phi: { vang: 6, tien: 0 } }, tien_nut: { nap_tien: 200, ban_het: 3500 } });
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: /VÀO ×10/ }));
    const banHet = await screen.findByRole('button', { name: /BÁN HẾT/ });
    expect(banHet.textContent).toContain('dồn hết ký quỹ');
    const nut = [...container.querySelectorAll('[data-khoi="nap-hang"] [data-khoi="nut-nap"]')];
    const tien = nut.find((b) => b.textContent?.includes('Tiền mặt'))!;
    expect(tien.textContent).toBe('Tiền mặt−200');
    expect(tien.querySelector('[data-icon="wallet"]'), 'Tiền mặt dùng lại icon ví pixel').toBeTruthy();
    await waitFor(() => expect((banHet as HTMLButtonElement).disabled).toBe(false));
    await new Promise((r) => setTimeout(r, 300));   // D519 — bàn phím vừa đổi ⇒ khoá 250 ms
    fireEvent.click(banHet);
    await waitFor(() => expect(bam.map((b) => b.nut)).toContain('ban_het'));
  });

  it('vế ngược D507: không còn khoản nào để dồn (server `ban_het` 0) ⇒ BÁN HẾT tắt', async () => {
    mayChuDb(101, 70, undefined, undefined, { tien_nut: { ban_het: 0 } });
    render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: /VÀO ×10/ }));
    const banHet = await screen.findByRole('button', { name: /BÁN HẾT/ });
    expect((banHet as HTMLButtonElement).disabled).toBe(true);
  });

  it('⭐ giá chạm NGƯỠNG GỌI ⇒ nút giữa thành BÁN HẾT, hộp NẠP mở sẵn (số bán + phí server trả), bấm nạp gửi `nap_<mã>`', async () => {
    const bam = mayChuDb(101, 70);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: /VÀO ×10/ }));
    await screen.findByRole('button', { name: /BÁN HẾT/ });
    expect(screen.getByText(/BỊ GỌI/)).toBeTruthy();
    // D493 — cuộc gọi: thẻ hiện ngay ở cạnh lên, ~0,6 s sau thu thành icon điện thoại (art pixel, không ký tự ✆); bấm icon ⇒ thẻ phát lại.
    expect(container.querySelector('[data-khoi="cuoc-goi"]')).toBeTruthy();
    await waitFor(() => expect(container.querySelector('[data-khoi="dt-goi"]')).toBeTruthy(), { timeout: 2000 });
    expect(container.querySelector('[data-khoi="cuoc-goi"]')).toBeNull();
    expect(container.textContent).not.toContain('✆');
    fireEvent.click(container.querySelector('[data-khoi="dt-goi"]')!);
    await waitFor(() => expect(container.querySelector('[data-khoi="cuoc-goi"]')).toBeTruthy());
    // D503 — hàng nút BÁN TÀI SẢN nằm trong DẢI DƯỚI ĐỒ THỊ, sát hàng nút (số bán · phí do server trả).
    const hang = container.querySelector('[data-khoi="o-duoi"] [data-khoi="nap-hang"]')!;
    expect(hang.textContent).toContain('Vàng−992 · 6');
    fireEvent.click(hang.querySelector('[data-khoi="nut-nap"]')!);
    await waitFor(() => expect(bam.map((b) => b.nut)).toContain('nap_vang'));
  });

  it('⭐ D503 — có bảng phụ: nút bán KHÔNG mọc trên bảng phụ (phải rướn tay) mà ở dải dưới đồ thị; trước khi bị gọi dải chỉ có dòng tạm tính', async () => {
    const bam = mayChuDb(101, 70, ['vang']);
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await screen.findByRole('button', { name: /VÀO ×10/ });
    expect(container.querySelector('[data-khoi="o-duoi"]'), 'dải có sẵn trước khi bị gọi').toBeTruthy();
    expect(container.querySelector('[data-khoi="nap-hang"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /VÀO ×10/ }));
    await screen.findByRole('button', { name: /BÁN HẾT/ });
    expect(container.querySelector('[data-khoi="bang-phu"] button[data-khoi="nut-nap"]'), 'không nút bán trên bảng phụ').toBeNull();
    const nut = container.querySelector('[data-khoi="o-duoi"] [data-khoi="nut-nap"]')!;
    expect(nut.textContent).toBe('Vàng−992 · 6');
    // dải đứng ngay trên hàng nút: nút bán sát ngón cái
    expect(container.querySelector('[data-khoi="o-duoi"]')!.nextElementSibling?.getAttribute('data-khoi')).toBe('hang-nut');
    fireEvent.click(nut);
    await waitFor(() => expect(bam.map((b) => b.nut)).toContain('nap_vang'));
  });

  it('⭐ giá chạm SÀN THANH LÝ ⇒ khoá mọi nút + hàng nút xám, tạm tính "BỊ THANH LÝ"; vế ngược — chỉ bị gọi thì không xám', async () => {
    mayChuDb(101, 100.5);
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: /VÀO ×10/ }));
    await screen.findByText('BỊ THANH LÝ');
    expect(r.container.querySelector('[data-khoi="hang-nut"]')!.className).toMatch(/xamMan/);
    // D493 — lóe đỏ một phát rồi gỡ; ĐỒ THỊ xám tới hết màn (founder: "chỉ xám phần nút bấm và chart thôi" — bảng phụ giữ màu).
    expect(r.container.querySelector('[data-khoi="chop-do"]')).toBeTruthy();
    await waitFor(() => expect(r.container.querySelector('[data-khoi="chop-do"]')).toBeNull(), { timeout: 2000 });
    expect(r.container.querySelector('[data-khoi="do-thi"]')!.className).toMatch(/xamMan/);
    expect(r.container.querySelector('[data-khoi="dt-goi"]'), 'đã thanh lý ⇒ tắt icon gọi').toBeNull();
    for (const n of r.container.querySelectorAll('[data-khoi="hang-nut"] button')) expect((n as HTMLButtonElement).disabled).toBe(true);
    r.unmount();
    mayChuDb(101, 70);
    const r2 = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: /VÀO ×10/ }));
    await screen.findByRole('button', { name: /BÁN HẾT/ });
    expect(r2.container.querySelector('[data-khoi="hang-nut"]')!.className).not.toMatch(/xamMan/);
    expect(r2.container.querySelector('[data-khoi="do-thi"]')!.className).not.toMatch(/xamMan/);
    expect(r2.container.querySelector('[data-khoi="chop-do"]')).toBeNull();
  });
});

describe('§VI — founder 04/10: "Bảng phụ vẫn đang dùng icon kìa" — mã vẽ bằng ART PIXEL có sẵn, không emoji của demo', () => {
  it('⭐ bảng phụ + đầu màn: svg art[mã]; không còn emoji TAI_SAN.icon nào trên màn', async () => {
    const { TAI_SAN } = await import('@config/holdem');
    const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/ket-qua')) return json({ error: 'chua_het' });
      const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(301).fill(100), nen: [], phu: { vang: Array(301).fill(100), tpcp: Array(301).fill(100) } });
      return dongMo(JSON.stringify({ loai: 'dau', ...dau, bat_dau: new Date(Date.now() - 14_000).toISOString(), gio_may: new Date().toISOString(), nac: null,
        loi_cam: ['bat_day'], la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], phu: ['vang', 'tpcp'],
        so: { vao: [], ra: [], hut: [], con_von: 4960, dang_cam: 0, tien_nut: { vao_nua: 2480, vao_het: 4960, thoat: 0 } } }) + '\n' + lo + '\n');
    }));
    const art = { btc: '<svg data-art="btc"></svg>', vang: '<svg data-art="vang"></svg>', tpcp: '<svg data-art="tpcp"></svg>' };
    const { container } = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} art={art} />);
    await waitFor(() => expect(container.querySelector('[data-khoi="bang-phu"] svg[data-art="vang"]')).toBeTruthy());
    expect(container.querySelector('[data-khoi="bang-phu"] svg[data-art="tpcp"]')).toBeTruthy();
    expect(container.querySelector('svg[data-art="btc"]'), 'đầu màn: mã chính').toBeTruthy();
    const chu = container.textContent ?? '';
    for (const t of TAI_SAN) expect(chu.includes(t.icon), `emoji ${t.icon} (${t.id})`).toBe(false);
  });
});

describe('§VII — D497 (founder: "che mẹ hết nửa cái chart") — cuộc gọi ký quỹ là DẢI mép trên, không phủ đồ thị', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/components/holdem/ManMinigame.module.css'), 'utf8');
  /** Thân khối CSS của bộ chọn `sel` (chuỗi thường, không regex) — vắng ⇒ ném lỗi, để bài này không xanh rỗng. */
  const khoi = (sel: string) => {
    const a = css.indexOf(`${sel} {`);
    if (a < 0) throw new Error(`không thấy khối ${sel}`);
    return css.slice(a, css.indexOf('}', a) + 1);
  };
  it('⭐ `.cuocGoi` không nền phủ, dồn lên mép trên; `.goiThe` một hàng ngang, không chiếm % bề rộng', () => {
    expect(khoi('.cuocGoi')).not.toMatch(/background/);
    expect(khoi('.cuocGoi')).toMatch(/align-items: flex-start/);
    expect(khoi('.goiThe')).toMatch(/flex-direction: row/);
    expect(khoi('.goiThe')).not.toMatch(/width: [0-9]+%/);
  });
  it('⭐ D503 — `.oDuoi` cao CỐ ĐỊNH, không co giãn (hàng nút bán hiện/ẩn không xô đồ thị lẫn hàng nút)', () => {
    expect(khoi('.oDuoi')).toMatch(/[^-]height: [0-9]+px/);
    expect(khoi('.oDuoi')).toMatch(/overflow: hidden/);
    expect(khoi('.oDuoi')).toMatch(/flex: none/);
  });
});

describe('§VIII — D499: Tổ Chức trong màn · nối lại dòng khi lệnh tự đẩy giá', () => {
  const SO0 = { vao: [], ra: [], hut: [], con_von: 4960, dang_cam: 0, tien_nut: { vao_nua: 2480, vao_het: 4960, thoat: 0 } };
  const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { 'content-type': 'application/json' } });
  /** Máy chủ giả: Tổ Chức (`to_chuc`), nến mịn 2–3 TRẮNG BÊN MUA ở nhịp 16–31; sau VÀO HẾT trả sổ có `gia_tran` + `xung`. Đếm số lần mở dòng nhịp. */
  const mayChuTc = (giaTran: number) => {
    const bam: any[] = [], mo: string[] = [];
    let soNay: object = SO0;   // máy chủ thật dựng lại sổ từ mọi lệnh đã ghi ⇒ gói đầu của dòng nối lại mang sổ MỚI
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/lenh')) {
        const b = JSON.parse(String(init?.body)); bam.push(b);
        const so = b.nut === 'vao_het' ? { ...SO0, vao: [{ tien: 4960, khop: 100.5, nhip: b.nhip }], con_von: 0, dang_cam: 4960,
          tien_nut: { vao_nua: 0, vao_het: 0, thoat: 4960 }, xung: 1, gia_tran: giaTran } : SO0;
        soNay = so;
        return json({ nhan: true, seq: bam.length, nhip: b.nhip, la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], so });
      }
      if (u.includes('/ket-qua')) return new Response(JSON.stringify({ error: 'chua_het' }), { status: 409 });
      mo.push(u);
      const lo = JSON.stringify({ loai: 'nhip', tu: 0, gia: Array(301).fill(100), nen: [[0, 0, 0], [1, 0, 0], [2, 1, 0], [3, 1, 0]] });
      return dongMo(JSON.stringify({ loai: 'dau', ...dau, bat_dau: new Date(Date.now() - 14_000).toISOString(), gio_may: new Date().toISOString(), nac: null,
        loi_cam: ['bat_day'], la: 'bat_day', nut: ['vao_nua', 'vao_het', 'thoat'], to_chuc: true, so: soNay,
        nghien_cuu: { day: [0, 0, 0.02, 0.16, 0.53, 0.29], dinh: [1, 0, 0, 0, 0, 0] } }) + '\n' + lo + '\n');
    }));
    return { bam, mo };
  };

  it('⭐ lệnh sinh cú tự đẩy (sổ `xung` tăng) ⇒ nối lại dòng nhịp; giá chạm GIÁ TRẦN ⇒ búa pháp lý + hàng nút xám, đồ thị giữ màu', async () => {
    const { mo } = mayChuTc(100.5);
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const vao = await screen.findByRole('button', { name: /VÀO HẾT/ });
    await waitFor(() => expect((vao as HTMLButtonElement).disabled).toBe(false));
    const moTruoc = mo.length;
    fireEvent.click(vao);
    await waitFor(() => expect(mo.length, 'phải mở lại dòng nhịp sau cú tự đẩy').toBeGreaterThan(moTruoc));
    await waitFor(() => expect(r.container.querySelector('[data-khoi="bua"]')).toBeTruthy());
    expect(r.container.querySelector('[data-khoi="hang-nut"]')!.className).toMatch(/xamMan/);
    expect(r.container.querySelector('[data-khoi="do-thi"]')!.className).not.toMatch(/xamMan/);
    expect(screen.getByText(/CHẠM TRẦN THUA/)).toBeTruthy();
  });

  it('⭐ D500 BÀN NGHIÊN CỨU: dải dưới chân đồ thị, mỗi khúc ▼ % tạo đáy (đỏ) · ▲ % tạo đỉnh (xanh); dưới 5 % in chấm, không toạ độ giá', async () => {
    mayChuTc(80);
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    await waitFor(() => expect(r.container.querySelector('[data-khoi="nghien-cuu"]')).toBeTruthy());
    const dai = r.container.querySelector('[data-khoi="nghien-cuu"]')!;
    expect(dai.textContent).toContain('▼53%');
    expect(dai.textContent).toContain('▲100%');
    expect(dai.textContent).toContain('▼·');
    expect(dai.querySelectorAll('[class*="ncO"]')).toHaveLength(6);
    // D520 — chú thích cho người mới, ngay trong dải
    expect(dai.querySelector('[data-khoi="nc-chu"]')?.textContent).toBe('▼ ĐÁY · ▲ ĐỈNH hay rơi vào khúc này · mô hình chỉ biết thẻ');
  });

  it('vế ngược: giá trên giá trần ⇒ không búa, không xám', async () => {
    mayChuTc(80);
    const r = render(<ManMinigame matchId="m1" vong={2} dong={() => undefined} />);
    const vao = await screen.findByRole('button', { name: /VÀO HẾT/ });
    await waitFor(() => expect((vao as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(vao);
    await screen.findByText('LONG');
    expect(r.container.querySelector('[data-khoi="bua"]')).toBeNull();
    expect(r.container.querySelector('[data-khoi="hang-nut"]')!.className).not.toMatch(/xamMan/);
  });
});
