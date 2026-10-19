/**
 * HẠN CHỜ MỖI LƯỢT GỌI + RANH GIỚI GỬI LẠI (vá 03/08, đợt kiểm 02/08).
 *
 * Hai thứ được khoá ở đây, và thứ hai suýt bị vá đầu tiên làm hỏng:
 *  (1) `fetch` không tự bỏ cuộc ⇒ màn hình chờ mãi ("trận trông như chết").
 *  (2) ⚠ Lỗi mạng nay được GÓI thành `ApiError`, mà luật gửi lại lúc đó viết
 *      là "không phải ApiError thì gửi lại" — tức lá chắn chống trừ tiền hai
 *      lần TẮT IM LẶNG ngay khi thêm hạn chờ. Nên ranh giới thật phải là
 *      `chuaToiMayChu`, và nó cần test riêng: máy chủ ĐÃ trả lời thì tuyệt
 *      đối không gửi lại, chưa tới máy chủ thì gửi lại mới an toàn.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ApiError, api } from '../src/api/client';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('hạn chờ', () => {
  it('máy chủ im lặng quá lâu ⇒ ApiError timeout, KHÔNG treo vô hạn', async () => {
    vi.useFakeTimers();
    // fetch tôn trọng signal: treo cho tới khi bị huỷ.
    vi.stubGlobal('fetch', (_u: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal?.addEventListener('abort', () => {
        rej(new DOMException('aborted', 'AbortError'));
      });
    }));

    const p = api('/health').then(() => 'xong', (e: unknown) => e);
    await vi.advanceTimersByTimeAsync(20_000);
    const err = await p;

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('timeout');
    expect((err as ApiError).chuaToiMayChu, 'quá hạn = chưa tới máy chủ').toBe(true);
    expect((err as ApiError).message).toMatch(/mạng/i);
  });

  it('mất mạng ⇒ ApiError network, cũng là CHƯA TỚI máy chủ', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    const err = await api('/health').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('network');
    expect((err as ApiError).chuaToiMayChu).toBe(true);
  });

  it('⚠ MÁY CHỦ ĐÃ TRẢ LỜI (kể cả lỗi) ⇒ KHÔNG được coi là chưa tới', async () => {
    /*
     * Đây là vế giữ AN TOÀN TIỀN. Nhầm 4xx/5xx thành "chưa tới máy chủ" là
     * bật lại đường gửi lại cho một lệnh máy chủ ĐÃ nhận — nguy cơ trừ tiền
     * lần nữa nếu idempotency có ngày hỏng.
     */
    for (const status of [400, 409, 429, 500]) {
      vi.stubGlobal('fetch', () => Promise.resolve(new Response(
        JSON.stringify({ error: 'x', message: 'y' }),
        { status, headers: { 'content-type': 'application/json' } },
      )));
      const err = await api('/health').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status, `status ${status}`).toBe(status);
      expect((err as ApiError).chuaToiMayChu, `status ${status}`).toBe(false);
    }
  });

  it('gọi thành công thì hẹn giờ được dọn (không rò timer)', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(
      JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } },
    )));
    await api('/health');
    expect(vi.getTimerCount(), 'hẹn giờ phải bị clear sau khi xong').toBe(0);
  });
});
