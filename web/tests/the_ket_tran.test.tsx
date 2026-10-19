/**
 * THẺ KẾT TRẬN (17/08, `man-ket-de-khoe.md`) — món "rời app được".
 *   · `chuDan`/`daiKhoi`/`cuLatLon` là hàm THUẦN, vector tay (thứ được dán ra
 *     ngoài phải ổn định, không tuỳ máy);
 *   · KHÔNG SPOIL (luật 7): chữ share không chứa nội dung ô/tin giả/danh mục;
 *   · A10: không câu kê đơn (nên/hãy/đừng…) — cùng bộ quét với D89;
 *   · thẻ chỉ VẼ KHI BẤM (canvas 1080×1350 tốn vài trăm ms trên máy yếu);
 *   · huỷ hộp chia sẻ ⇒ rơi về chép chữ, KHÔNG báo lỗi cho việc người ta tự huỷ.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/api/queries';
import { TheKetTran } from '../src/components/holdem/TheKetTran';
import { chuDan, cuLatLon, daiKhoi, pct, veThe, type DuLieuThe } from '../src/lib/the_ket_tran';
import { TU_KE_DON } from '../src/lib/khoanh_khac';
import { ME_ONBOARDED, stubFetch } from './helpers';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const DU: DuLieuThe = {
  handle: 'minh', hang: 2, tong: 8, nav: 12_480, navDau: 10_000,
  duong: [10_200, 9_800, 11_000, 12_480],
  daiDoiThu: [[9_000, 9_500, 9_100, 8_800]],
  daCham: ['TRƯỢT GIÁ', 'SỨC CĂNG'],
  conDuong: [{ ten: 'LA BÀN', xong: true }],
  banMa: 'a3f9k', soO: 8, link: 'https://x.test/arena/ban/a3f9k',
};

describe('hàm thuần', () => {
  it('pct: dấu VN, luôn có dấu', () => {
    expect(pct(2480)).toBe('+24,8%');
    expect(pct(-1800)).toBe('−18,0%');
    expect(pct(0)).toBe('+0,0%');
  });

  it('daiKhoi: một khối mỗi vòng, ký tự bậc thang; rỗng ⇒ chuỗi rỗng', () => {
    const d = daiKhoi(DU.duong, DU.navDau);
    expect(d).toHaveLength(DU.duong.length);
    expect(d.split('').every((c) => '▁▂▃▄▅▆▇█'.includes(c))).toBe(true);
    // đáy là vòng 2 (9.800), đỉnh là vòng cuối (12.480)
    expect(d[1]).toBe('▁');
    expect(d[3]).toBe('█');
    expect(daiKhoi([], 10_000)).toBe('');
  });

  it('cuLatLon: vòng đổi mạnh nhất theo TRỊ TUYỆT ĐỐI (cú sập cũng được kể)', () => {
    // 10.000 → 10.200 (+2%) → 9.800 (−3,92%) → 11.000 (+12,2%) → 12.480 (+13,5%)
    expect(cuLatLon(DU.duong, DU.navDau)).toEqual({ vong: 4, bp: 1345 });
    expect(cuLatLon([10_000, 5_000], 10_000)).toEqual({ vong: 2, bp: -5000 });
    expect(cuLatLon([], 10_000)).toBeUndefined();
  });

  it('⭐ chuDan: có hạng/NAV/dải khối/link; KHÔNG spoil ô, KHÔNG kê đơn (A10)', () => {
    const t = chuDan({ ...DU, cuLat: cuLatLon(DU.duong, DU.navDau) });
    expect(t).toMatch(/hạng 2\/8/);
    expect(t).toMatch(/\+24,8%/);
    expect(t).toMatch(/#A3F9K/);
    expect(t).toMatch(/x\.test\/arena\/ban\/a3f9k/);
    expect(t).toMatch(/vừa chạm: TRƯỢT GIÁ · SỨC CĂNG/);
    // Không spoil: không nhắc tin giả / tên ô / danh mục.
    for (const cam of ['tin giả', 'bong bóng', 'thiên nga', 'btc', 'vàng']) {
      expect(t.toLowerCase()).not.toContain(cam);
    }
    // A10 — không kê đơn.
    for (const tu of TU_KE_DON) expect(t.toLowerCase()).not.toContain(tu);
  });

  it('veThe: vẽ đủ khổ 1080×1350 và không ném khi thiếu dữ liệu', () => {
    const c = document.createElement('canvas');
    // jsdom không có 2d context thật ⇒ chỉ khoá phần KHÔNG NÉM + khổ thẻ.
    expect(() => veThe(c, DU)).not.toThrow();
    expect(c.width).toBe(1080);
    expect(c.height).toBe(1350);
    expect(() => veThe(c, { ...DU, duong: [], daiDoiThu: [], conDuong: [], daCham: [], banMa: null })).not.toThrow();
  });
});

const dung = () => render(
  <QueryClientProvider client={makeQueryClient()}>
    <TheKetTran du={{
      hang: 2, tong: 8, nav: 12_480, navDau: 10_000, duong: [10_200, 12_480],
      daCham: ['TRƯỢT GIÁ'], soO: 8, banMa: 'a3f9k', link: 'https://x.test/arena/ban/a3f9k',
    }} />
  </QueryClientProvider>,
);

describe('component', () => {
  it('chưa bấm ⇒ CHƯA vẽ ảnh xem trước (không tốn canvas của máy yếu)', () => {
    stubFetch([['/auth/me', { status: 200, body: ME_ONBOARDED }]]);
    dung();
    expect(screen.getByText('THẺ KẾT TRẬN')).toBeInTheDocument();
    expect(screen.queryByAltText(/Xem trước/)).toBeNull();
  });

  it('⭐ bấm CHIA SẺ: gọi navigator.share với chữ dán được', async () => {
    stubFetch([['/auth/me', { status: 200, body: ME_ONBOARDED }]]);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share, clipboard: { writeText: vi.fn() } });
    dung();
    fireEvent.click(screen.getByRole('button', { name: /CHIA SẺ/ }));
    // Hạn dựng ảnh 2,5s (HAN_VE_MS) — canvas jsdom không gọi callback ⇒ rơi về chữ.
    await waitFor(() => expect(share).toHaveBeenCalled(), { timeout: 5000 });
    const arg = share.mock.calls[0]![0] as { text: string };
    expect(arg.text).toMatch(/hạng 2\/8/);
    expect(screen.getByText(/hạng 2\/8/)).toBeInTheDocument();   // chữ hiện để chép tay
  });

  it('không có Web Share ⇒ chép chữ, báo ĐÃ CHÉP (không báo lỗi)', async () => {
    stubFetch([['/auth/me', { status: 200, body: ME_ONBOARDED }]]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    dung();
    fireEvent.click(screen.getByRole('button', { name: /CHIA SẺ/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled(), { timeout: 5000 });
    expect(await screen.findByText(/ĐÃ CHÉP CHỮ/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('người dùng HUỶ hộp chia sẻ ⇒ chép chữ, KHÔNG báo lỗi', async () => {
    stubFetch([['/auth/me', { status: 200, body: ME_ONBOARDED }]]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator, share: vi.fn().mockRejectedValue(new Error('AbortError')),
      clipboard: { writeText },
    });
    dung();
    fireEvent.click(screen.getByRole('button', { name: /CHIA SẺ/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled(), { timeout: 5000 });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
