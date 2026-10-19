/**
 * MẠNG KÉM / CHẬP CHỜN (founder 11/08) — cảm biến kết nối.
 *
 * Ba câu, và cả ba đều là chỗ cảnh báo hoá thành vô dụng trong im lặng:
 *  1. Có bật khi mạng thật sự hỏng không?
 *  2. Có IM khi máy chủ vẫn trả lời — kể cả trả lời LỖI? (401 của khách chưa
 *     đăng nhập, 409 bấm trùng… đều KHÔNG phải sự cố mạng. Đếm chúng vào là
 *     dải cảnh báo chớp suốt buổi và người chơi học cách phớt lờ nó.)
 *  3. Có tự TẮT khi mạng về không?
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/api/client';
import {
  dangMatKetNoi, ghiNhanGoi, ghiSuCo, ngheMatKetNoi, resetCamBienMang, suCoKeTu,
} from '../src/api/mang';

beforeEach(() => resetCamBienMang());

describe('cảm biến kết nối', () => {
  it('MỘT cú hỏng lẻ ⇒ CHƯA báo động (di động rớt lẻ suốt, tự lành ngay)', () => {
    ghiNhanGoi(false);
    expect(dangMatKetNoi(),
      'báo động ở lần đầu = dải cảnh báo chớp tắt cả buổi, rồi không ai đọc nó nữa')
      .toBe(false);
  });

  it('⭐ HAI cú hỏng liên tiếp ⇒ báo mất kết nối', () => {
    ghiNhanGoi(false);
    ghiNhanGoi(false);
    expect(dangMatKetNoi()).toBe(true);
  });

  it('⭐ máy chủ TRẢ LỜI (kể cả lỗi) ⇒ IM, và cắt luôn chuỗi hỏng', () => {
    /*
     * Đây là bài đắt nhất file. 401 là câu trả lời BÌNH THƯỜNG cho khách chưa
     * đăng nhập và mọi màn đều gọi `/auth/me` trước; 409 `sai_vong` là bấm
     * trùng. Cả hai chứng minh đường mạng CÒN SỐNG. Đếm chúng vào cảm biến là
     * dải "MẤT KẾT NỐI" bật lên trong lúc mạng hoàn toàn bình thường.
     */
    ghiNhanGoi(false);
    ghiNhanGoi(true); // server trả lời — dù là 401/409
    ghiNhanGoi(false);
    expect(dangMatKetNoi(), 'chuỗi hỏng phải bị CẮT bởi một lần tới nơi')
      .toBe(false);
  });

  it('mạng về ⇒ tự TẮT, không cần ai bấm gì', () => {
    ghiNhanGoi(false); ghiNhanGoi(false);
    expect(dangMatKetNoi()).toBe(true);
    ghiNhanGoi(true);
    expect(dangMatKetNoi()).toBe(false);
  });

  it('người nghe được báo ĐÚNG hai lần: bật rồi tắt (không spam mỗi cú gọi)', () => {
    const thay: boolean[] = [];
    const huy = ngheMatKetNoi((m) => thay.push(m));
    ghiNhanGoi(false); ghiNhanGoi(false); // bật
    ghiNhanGoi(false); ghiNhanGoi(false); // vẫn hỏng — KHÔNG được phát lại
    ghiNhanGoi(true); // tắt
    huy();
    expect(thay, 'phát lại mỗi cú gọi là bắt cả cây React render vô ích')
      .toEqual([true, false]);
  });

  it('người nghe ném lỗi KHÔNG được làm chết cảm biến', () => {
    const huy1 = ngheMatKetNoi(() => { throw new Error('hỏng'); });
    const thay: boolean[] = [];
    const huy2 = ngheMatKetNoi((m) => thay.push(m));
    ghiNhanGoi(false); ghiNhanGoi(false);
    huy1(); huy2();
    expect(thay).toEqual([true]);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 * CÓ ĐƯỜNG CHẠY NÀO GỌI TỚI KHÔNG — bẫy số 1 của repo (đã dính 18+ lần).
 *
 * ⚠ Sáu bài trên kiểm CẢM BIẾN, và cả sáu vẫn XANH KỂ CẢ KHI `api()` không hề
 * gọi tới nó — tôi đã tiêm lỗi để xác nhận đúng như vậy. Một cảm biến không ai
 * nuôi là một cảm biến im lặng vĩnh viễn, và dải cảnh báo sẽ KHÔNG BAO GIỜ bật
 * dù mạng hỏng thế nào. Hai bài dưới đây canh chính DÂY NỐI đó.
 * ══════════════════════════════════════════════════════════════════════════ */
describe('DÂY NỐI api() ↔ cảm biến (không có thì cảnh báo chết im)', () => {
  it('⭐ fetch NÉM (mất mạng) ⇒ api() phải ghi nhận HỎNG', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(api('/auth/me')).rejects.toThrow();
    await expect(api('/auth/me')).rejects.toThrow();
    expect(dangMatKetNoi(), 'api() không nuôi cảm biến ⇒ dải cảnh báo chết im')
      .toBe(true);
    vi.unstubAllGlobals();
  });

  it('⭐ máy chủ trả 401 ⇒ api() phải ghi nhận TỚI NƠI (401 không phải sự cố mạng)',
    async () => {
      // Dựng sẵn trạng thái "đang mất kết nối" rồi cho một response 401 tới.
      ghiNhanGoi(false); ghiNhanGoi(false);
      expect(dangMatKetNoi()).toBe(true);

      vi.stubGlobal('fetch', vi.fn(async () => new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Bạn cần đăng nhập.' }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      )));
      await expect(api('/auth/me')).rejects.toThrow();
      expect(dangMatKetNoi(),
        'máy chủ ĐÃ trả lời ⇒ mạng còn sống ⇒ phải tắt cảnh báo, dù trả lời là lỗi')
        .toBe(false);
      vi.unstubAllGlobals();
    });
});

/*
 * BĂNG PHẢI TỰ TẮT KHI MẠNG VỀ — và chữ "đang thử lại" phải là SỰ THẬT.
 *
 * ⚠⚠ Đo trên PROD 12/08: rớt mạng rồi ngồi yên 8 giây ⇒ 0 lời gọi API thêm, băng
 * nằm đó vĩnh viễn. Vì từ D64 màn trận không polling nhịp nào, và ngoài trận thì
 * react-query ngồi im trên cache — nên "tắt khi có lời gọi thành công" là một
 * điều kiện KHÔNG BAO GIỜ TỚI nếu người chơi đang đứng yên đọc màn hình.
 * Cảnh báo sai mãi thì lần sau mất mạng thật cũng không ai tin nó nữa.
 */
describe('cảm biến TỰ DÒ khi đang mất kết nối', () => {
  beforeEach(() => { vi.useFakeTimers(); resetCamBienMang(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('⭐ đang mất kết nối thì TỰ gọi máy chủ, không ngồi chờ người dùng bấm', async () => {
    const goi = vi.fn().mockRejectedValue(new Error('mạng chết'));
    vi.stubGlobal('fetch', goi);

    ghiNhanGoi(false); ghiNhanGoi(false);          // vào trạng thái mất kết nối
    expect(dangMatKetNoi()).toBe(true);
    expect(goi, 'chưa tới nhịp đầu thì chưa dò').not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3500);
    expect(goi, 'phải tự dò mà không cần ai bấm gì').toHaveBeenCalled();
  });

  it('⭐ máy chủ trả lời (kể cả lỗi) → băng TẮT và ngừng dò', async () => {
    const goi = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', goi);

    ghiNhanGoi(false); ghiNhanGoi(false);
    await vi.advanceTimersByTimeAsync(3500);
    expect(dangMatKetNoi(), 'máy chủ đã trả lời ⇒ mạng sống ⇒ phải tắt băng').toBe(false);

    const soSauKhiTat = goi.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(goi.mock.calls.length, 'tắt rồi mà vẫn dò là bào pin vô ích')
      .toBe(soSauKhiTat);
  });

  it('nhịp GIÃN DẦN, không dò đều — mất mạng kéo dài hàng phút', async () => {
    const goi = vi.fn().mockRejectedValue(new Error('mạng chết'));
    vi.stubGlobal('fetch', goi);

    ghiNhanGoi(false); ghiNhanGoi(false);
    await vi.advanceTimersByTimeAsync(3500);
    const sauNhip1 = goi.mock.calls.length;
    // Nếu nhịp ĐỀU 3s thì 3 giây nữa phải có thêm một lần; giãn thì chưa.
    await vi.advanceTimersByTimeAsync(3000);
    expect(goi.mock.calls.length, 'nhịp hai phải xa hơn nhịp một').toBe(sauNhip1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(goi.mock.calls.length).toBeGreaterThan(sauNhip1);
  });
});

/*
 * SỔ SỰ CỐ — nuôi lời khai `su_co_khai` (D93, founder 16/08 "dán nhãn, không đổi luật").
 *
 * Vòng bị server chốt hộ vì client không tới được máy chủ thì trong `events` nó y
 * hệt một người AFK — trừ khi client KHAI mình đã cố gửi. Ba tính chất:
 *  1. Đếm ĐÚNG cửa sổ (kể từ mốc), lỗi cuối là lỗi CUỐI, không có gì ⇒ null.
 *  2. api() NUÔI sổ ở cả hai nhánh: chưa tới máy chủ (timeout/network) VÀ 5xx —
 *     nhưng KHÔNG ở 4xx (409 bấm trùng không phải sự cố) và KHÔNG ở đường
 *     telemetry (vòng lặp: lô đo hỏng ⇒ ghi ⇒ gửi ⇒ hỏng).
 *  3. Sổ có trần — phiên chơi cả buổi không phình.
 */
describe('sổ sự cố (D93) — nuôi su_co_khai', () => {
  it('đếm kể từ MỐC, lỗi cuối là lỗi cuối; không có gì ⇒ null', () => {
    ghiSuCo('timeout', 1000);
    ghiSuCo('network', 2000);
    ghiSuCo('server', 3000);
    expect(suCoKeTu(0)).toEqual({ so_lan_hong: 3, loi_cuoi: 'server' });
    expect(suCoKeTu(1500), 'sự cố TRƯỚC mốc thuộc vòng trước, không tính')
      .toEqual({ so_lan_hong: 2, loi_cuoi: 'server' });
    expect(suCoKeTu(3001), 'không có gì để khai ⇒ null (chỗ gọi không gửi trường)').toBeNull();
  });

  it('⭐ api() nuôi sổ: fetch NÉM ⇒ network; AbortError ⇒ timeout', async () => {
    const moc = Date.now() - 1;
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(api('/holdem/matches/x/rounds', { method: 'POST', body: {} })).rejects.toThrow();
    expect(suCoKeTu(moc)).toEqual({ so_lan_hong: 1, loi_cuoi: 'network' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('quá hạn', 'AbortError'); }));
    await expect(api('/holdem/matches/x/rounds', { method: 'POST', body: {} })).rejects.toThrow();
    expect(suCoKeTu(moc)).toEqual({ so_lan_hong: 2, loi_cuoi: 'timeout' });
    vi.unstubAllGlobals();
  });

  it('⭐ api() nuôi sổ ở 5xx (máy chủ có mặt nhưng hỏng), KHÔNG ở 4xx', async () => {
    const moc = Date.now() - 1;
    const tra = (status: number) => vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'x', message: 'y' }),
      { status, headers: { 'content-type': 'application/json' } })));
    tra(409);
    await expect(api('/holdem/matches/x/rounds', { method: 'POST', body: {} })).rejects.toThrow();
    expect(suCoKeTu(moc), '409 sai_vong là câu trả lời, không phải sự cố').toBeNull();
    tra(500);
    await expect(api('/holdem/matches/x/rounds', { method: 'POST', body: {} })).rejects.toThrow();
    expect(suCoKeTu(moc)).toEqual({ so_lan_hong: 1, loi_cuoi: 'server' });
    vi.unstubAllGlobals();
  });

  it('đường /telemetry KHÔNG vào sổ (chống vòng lặp đo-hỏng-đo)', async () => {
    const moc = Date.now() - 1;
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(api('/telemetry', { method: 'POST', body: {} })).rejects.toThrow();
    expect(suCoKeTu(moc)).toBeNull();
    vi.unstubAllGlobals();
  });

  it('sổ có TRẦN — 200 sự cố thì chỉ giữ 64 gần nhất', () => {
    for (let i = 0; i < 200; i += 1) ghiSuCo('network', i);
    expect(suCoKeTu(0)!.so_lan_hong).toBe(64);
  });
});
