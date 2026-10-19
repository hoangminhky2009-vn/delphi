/**
 * PFM — KÍCH ĐỒNG BỘ (`dong_bo_kich.ts`, D295): cái nút bấm cuối nối hai driver vào vòng
 * đời app. Trước lượt này `dongBoMotLuot`/`saoLuuMotLuot` chưa có ai gọi (D260 · D264).
 *
 *   §I   `kichDongBo` — cổng bằng bốn cửa, và két còn đòi thêm chìa.
 *   §II  hook — một lần mỗi phiên · thêm một mỗi lần app rời mắt · khách thì im.
 *   §III không có `unhandledrejection` khi driver nổ, và cú nổ được ĐẾM.
 *   §IV  ⭐⭐ `KhoProvider` THẬT SỰ gắn hook — khai mà không gọi là đúng bẫy D242.
 *
 * ⚠ Hai driver được stub ở tầng MODULE: chúng đã có máy chủ giả riêng (`pfm_dong_bo_chay`
 * · `pfm_ket_chay`, 35+ bài). Ở đây đo đúng một câu: *"có gọi không, mấy lần, với gì"*.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { kichDongBo, quenKichChoTest, useKichDongBo } from '../src/pfm/dong_bo_kich';
import { KhoProvider } from '../src/pfm/dung_kho';
import { KhoTrongBoNho, type KhoPfm } from '../src/pfm/kho.js';
import { catChia } from '../src/pfm/ket_may.js';
import { ME_ONBOARDED, stubFetch } from './helpers';
import type { MeResponse } from '../src/api/types';

vi.mock('../src/pfm/dong_bo_chay.js', () => ({ dongBoMotLuot: vi.fn() }));
vi.mock('../src/pfm/ket_chay.js', async (goc) => ({
  ...(await goc<typeof import('../src/pfm/ket_chay.js')>()),
  saoLuuMotLuot: vi.fn(),
}));
vi.mock('../src/lib/telemetry.js', () => ({ ghiDo: vi.fn(), manCuaDuong: () => '/cai-dat' }));
const { dongBoMotLuot } = await import('../src/pfm/dong_bo_chay.js');
const { saoLuuMotLuot } = await import('../src/pfm/ket_chay.js');
const { ghiDo } = await import('../src/lib/telemetry.js');

const LUC = '2026-09-06T10:00:00.000Z';
const KQ_LO = { daGui: false, ghi: 0, trung: 0, bo: 0, conLai: 0 };
const KQ_KET = { daLuu: [], thangDong: 0, quaLon: 0, conBan: 0 };
const BON_TAT = { ket: false, dac_trung: false, thuong: false, noi_game: false };

function meVoiCua(cua: Partial<Record<keyof typeof BON_TAT, boolean>>): MeResponse {
  return { ...ME_ONBOARDED, pfm: { consent: true, bat_dau: LUC, cua: { ...BON_TAT, ...cua } } };
}

function boc() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Boc = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return Boc;
}

async function chiaGia(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function anMat(trangThai: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => trangThai });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  quenKichChoTest();
  vi.mocked(dongBoMotLuot).mockReset().mockResolvedValue(KQ_LO);
  vi.mocked(saoLuuMotLuot).mockReset().mockResolvedValue(KQ_KET);
  vi.mocked(ghiDo).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});

/* ═══ §I — kichDongBo: cổng bằng cửa ═══════════════════════════════════════ */

describe('§I — kichDongBo cổng bằng bốn cửa', () => {
  const moc = { ngay: '2026-09-06', luc: LUC, thangSong: '2026-09' };

  it('bốn cửa đóng ⇒ không driver nào chạy, kết quả rỗng', async () => {
    const kq = await kichDongBo(new KhoTrongBoNho(), BON_TAT, moc);
    expect(kq).toEqual({});
    expect(dongBoMotLuot).not.toHaveBeenCalled();
    expect(saoLuuMotLuot).not.toHaveBeenCalled();
  });

  it('⭐ `dac_trung` mở ⇒ đồng bộ lô với đúng mốc; két vẫn im vì cửa két đóng', async () => {
    const kho = new KhoTrongBoNho();
    const kq = await kichDongBo(kho, { ...BON_TAT, dac_trung: true }, moc);
    expect(dongBoMotLuot).toHaveBeenCalledWith(kho, '2026-09-06', LUC);
    expect(kq.dongBo).toEqual(KQ_LO);
    expect(saoLuuMotLuot).not.toHaveBeenCalled();
  });

  it('⭐⭐ `ket` mở mà máy CHƯA có chìa ⇒ KHÔNG gọi driver két, và `saoLuu` VẮNG (không phải vuong)', async () => {
    /*
     * Driver tự trả `chua_co_chia`, nhưng một màn hiển thị `vuong` sẽ nhắc "chưa có
     * chìa" với người chưa hề mở khối két — nhắc một việc họ không chọn làm.
     */
    const kq = await kichDongBo(new KhoTrongBoNho(), { ...BON_TAT, ket: true }, moc);
    expect(saoLuuMotLuot).not.toHaveBeenCalled();
    expect(kq.saoLuu).toBeUndefined();
  });

  it('⭐ `ket` mở + có chìa THẬT ⇒ sao lưu với `thangSong` của mốc', async () => {
    const kho = new KhoTrongBoNho();
    await catChia(kho, await chiaGia(), LUC);
    const kq = await kichDongBo(kho, { ...BON_TAT, ket: true }, moc);
    expect(saoLuuMotLuot).toHaveBeenCalledWith(kho, '2026-09-06', LUC, '2026-09');
    expect(kq.saoLuu).toEqual(KQ_KET);
  });

  it('chìa là `{}` (máy dính bản lỗi cũ, D264) ⇒ không phải chìa ⇒ không gọi', async () => {
    const kho = new KhoTrongBoNho();
    await kho.ghi('meta', { id: 'khoa_ket', thang: '2026-09', suaLuc: LUC, d: {} });
    await kichDongBo(kho, { ...BON_TAT, ket: true }, moc);
    expect(saoLuuMotLuot).not.toHaveBeenCalled();
  });
});

/* ═══ §II — hook: một lần mỗi phiên · hidden · khách ═══════════════════════ */

describe('§II — useKichDongBo', () => {
  it('⭐⭐ khách (`/me` 401 ⇒ pfm null) ⇒ 0 lời gọi driver — test màn hiện có không tự bắn mạng', async () => {
    // fetch mặc định của setup.ts trả 401 cho mọi đường.
    const kho = new KhoTrongBoNho();
    const { rerender } = renderHook(() => useKichDongBo(kho), { wrapper: boc() });
    await new Promise((r) => setTimeout(r, 30));
    rerender();
    anMat('hidden');
    await new Promise((r) => setTimeout(r, 30));
    expect(dongBoMotLuot).not.toHaveBeenCalled();
    expect(saoLuuMotLuot).not.toHaveBeenCalled();
  });

  it('⭐⭐⭐ `dac_trung` mở ⇒ đồng bộ ĐÚNG MỘT lần dù re-render 3 lần VÀ mount lại (chuyển màn)', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoiCua({ dac_trung: true }) }]]);
    const kho = new KhoTrongBoNho();
    const a = renderHook(() => useKichDongBo(kho), { wrapper: boc() });
    await waitFor(() => expect(dongBoMotLuot).toHaveBeenCalledTimes(1));
    a.rerender(); a.rerender(); a.rerender();
    await new Promise((r) => setTimeout(r, 30));
    expect(dongBoMotLuot).toHaveBeenCalledTimes(1);
    expect(dongBoMotLuot).toHaveBeenCalledWith(kho, expect.any(String), expect.any(String));
    /*
     * ⚠⚠ MOUNT LẠI là ca cờ phiên tồn tại để chặn: mỗi màn PFM mount một `KhoProvider`
     * riêng, chuyển SỔ → HŨ → GƯƠNG là ba mount. Tiêm lỗi đã chứng minh: bỏ cờ mà chỉ
     * re-render thì bài vẫn xanh (effect chỉ chạy lại khi `kho`/`cua` đổi) — bài rỗng.
     */
    a.unmount();
    renderHook(() => useKichDongBo(kho), { wrapper: boc() });
    await new Promise((r) => setTimeout(r, 60));
    expect(dongBoMotLuot, 'mount thứ hai trong cùng phiên không được gửi lại').toHaveBeenCalledTimes(1);
  });

  it('⭐⭐ app rời mắt (`visibilitychange → hidden`) ⇒ gọi thêm ĐÚNG một; `visible` thì không', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoiCua({ dac_trung: true }) }]]);
    renderHook(() => useKichDongBo(new KhoTrongBoNho()), { wrapper: boc() });
    await waitFor(() => expect(dongBoMotLuot).toHaveBeenCalledTimes(1));
    anMat('visible');
    await new Promise((r) => setTimeout(r, 20));
    expect(dongBoMotLuot).toHaveBeenCalledTimes(1);
    anMat('hidden');
    await waitFor(() => expect(dongBoMotLuot).toHaveBeenCalledTimes(2));
  });

  it('⭐ bốn cửa đều đóng ⇒ KHÔNG tiêu "một lần mỗi phiên" — bật cửa sau đó vẫn được kích', async () => {
    /*
     * Cờ phiên chỉ được đặt khi có gì để gửi. Người mở app rồi mới bật cửa ở Cài đặt
     * (cùng phiên) mà bị cờ chặn thì lô đầu tiên của họ đợi tới lần mở app sau.
     */
    stubFetch([['/auth/me', { status: 200, body: meVoiCua({ noi_game: true }) }]]);
    const kho = new KhoTrongBoNho();
    const a = renderHook(() => useKichDongBo(kho), { wrapper: boc() });
    await new Promise((r) => setTimeout(r, 40));
    expect(dongBoMotLuot).not.toHaveBeenCalled();
    a.unmount();

    stubFetch([['/auth/me', { status: 200, body: meVoiCua({ dac_trung: true }) }]]);
    renderHook(() => useKichDongBo(kho), { wrapper: boc() });
    await waitFor(() => expect(dongBoMotLuot).toHaveBeenCalledTimes(1));
  });

  it('kho chưa mở (`null`) ⇒ chờ, không gọi với null', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoiCua({ dac_trung: true }) }]]);
    renderHook(() => useKichDongBo(null), { wrapper: boc() });
    await new Promise((r) => setTimeout(r, 40));
    expect(dongBoMotLuot).not.toHaveBeenCalled();
  });
});

/* ═══ §III — driver nổ: không lọt ra ngoài, và được đếm ═══════════════════ */

describe('§III — ⭐⭐⭐ driver ném ⇒ không `unhandledrejection`, có telemetry', () => {
  it('cú nổ lúc rời mắt bị bắt ở lớp hook và đếm `pfm_lo_loi`', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoiCua({ dac_trung: true }) }]]);
    const bat = vi.fn();
    process.on('unhandledRejection', bat);
    try {
      renderHook(() => useKichDongBo(new KhoTrongBoNho()), { wrapper: boc() });
      await waitFor(() => expect(dongBoMotLuot).toHaveBeenCalledTimes(1));
      vi.mocked(dongBoMotLuot).mockRejectedValueOnce(new Error('nổ giữa chừng'));
      anMat('hidden');
      await waitFor(() => expect(dongBoMotLuot).toHaveBeenCalledTimes(2));
      await new Promise((r) => setTimeout(r, 30));
      expect(bat, 'một promise bị từ chối đã lọt ra ngoài').not.toHaveBeenCalled();
      expect(ghiDo).toHaveBeenCalledWith('pfm_lo_loi', { chi_tiet: { loai: 'kich' } });
    } finally {
      process.off('unhandledRejection', bat);
    }
  });
});

/* ═══ §IV — KhoProvider THẬT SỰ gắn hook ═══════════════════════════════════ */

describe('§IV — ⭐⭐ KhoProvider gắn hook — khai mà không gọi là bẫy D242', () => {
  it('bọc `KhoProvider` với kho + `/me` có cửa ⇒ driver chạy mà màn không gọi gì', async () => {
    stubFetch([['/auth/me', { status: 200, body: meVoiCua({ dac_trung: true }) }]]);
    const kho: KhoPfm = new KhoTrongBoNho();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(createElement(QueryClientProvider, { client: qc },
      createElement(KhoProvider, { kho, children: createElement('span', null, 'màn rỗng') })));
    await waitFor(() => expect(dongBoMotLuot).toHaveBeenCalledWith(kho, expect.any(String), expect.any(String)));
  });
});
