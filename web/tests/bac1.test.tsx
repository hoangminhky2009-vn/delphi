/**
 * BẬC 1 — MÀN HỎI NHÂN KHẨU SAU TRẬN ĐẦU (D64 phương án B).
 *
 * ⚠⚠ MỌI BÀI Ở ĐÂY CANH MỘT CÂU: **nó KHÔNG chặn ai.** Founder bác thẳng lý do
 * "age gate vì nội dung" — không nội dung người lớn, không cá cược — nên thứ còn
 * lại chỉ là một câu hỏi. Bài dễ trôi nhất là nút BỎ QUA: chỉ cần một lần ai đó
 * "tạm" ẩn nó đi cho đẹp thì màn này lặng lẽ thành một cái cửa.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
import { renderAt, stubFetch, ME_ONBOARDED } from './helpers';
import type { MeResponse } from '@/api/types';
import { CONSENT_PHIEN_BAN } from '@config/pfm_consent';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** `/auth/me` của một người bậc 0 vừa đá xong trận đầu: chưa khai, máy chủ bảo HỎI. */
const ME_CAN_HOI: MeResponse = {
  ...ME_ONBOARDED,
  hoi_nhan_khau: true,
  user: { ...ME_ONBOARDED.user!, age_band: null as any, region: null as any,
    occupation_band: null as any },
};

const BANG = (me: MeResponse): [string, { status: number; body: unknown }][] => [
  ['/me/nhan-khau', { status: 200, body: { ok: true, da_luu: true } }],
  ['/account/consent', { status: 200, body: { ok: true, research_consent: true } }],
  ['/auth/me', { status: 200, body: me }],
  ['/holdem/', { status: 200, body: {} }],
  ['/markets', { status: 200, body: { markets: [] } }],
];

describe('Khi nào hiện', () => {
  it('máy chủ bảo hỏi → hiện màn ba câu', async () => {
    stubFetch(BANG(ME_CAN_HOI));
    renderAt('/');
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/NĂM SINH/)).toBeTruthy();
  });

  /*
   * ⚠ Cờ do MÁY CHỦ đặt (C4). Client tự suy từ `age_band == null` thì sẽ hỏi lại
   * vĩnh viễn đúng những người đã bấm BỎ QUA — họ cũng để lại `age_band` NULL.
   */
  it('máy chủ KHÔNG bảo hỏi → không hiện, dù nhân khẩu vẫn trống', async () => {
    stubFetch(BANG({ ...ME_CAN_HOI, hoi_nhan_khau: false }));
    renderAt('/');
    // Neo vào một chuỗi DUY NHẤT của Hub — tên module hiện ở cả thẻ lẫn nhãn.
    await screen.findByText(/không có giá trị thật/);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /*
   * ⚠ Trường vắng = bản máy chủ CŨ (PWA giữ bundle trong cache, D26/27 đã trả
   * giá một lần). Phải rơi về "không hỏi", không phải "hỏi".
   */
  it('máy chủ cũ không có trường này → không hiện', async () => {
    const { hoi_nhan_khau: _, ...cu } = ME_CAN_HOI;
    stubFetch(BANG(cu as MeResponse));
    renderAt('/');
    // Neo vào một chuỗi DUY NHẤT của Hub — tên module hiện ở cả thẻ lẫn nhãn.
    await screen.findByText(/không có giá trị thật/);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Không chặn ai', () => {
  it('⭐ có nút BỎ QUA, và nó gọi máy chủ rồi ĐÓNG màn', async () => {
    const calls = stubFetch([
      ['/me/nhan-khau', { status: 200, body: { ok: true, da_luu: false } }],
      ...BANG(ME_CAN_HOI).slice(1),
    ]);
    renderAt('/');
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: /BỎ QUA/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const g = calls.find((c) => c.url.includes('/me/nhan-khau'));
    expect(g?.method).toBe('POST');
    expect(g?.body).toEqual({ bo_qua: true });
  });

  /*
   * ⚠ Bấm XONG khi chưa điền đủ thì nút phải KHOÁ — nhưng nút BỎ QUA thì KHÔNG
   * BAO GIỜ khoá. Khoá cả hai là dựng lại đúng cái cửa vừa bỏ đi.
   */
  it('chưa điền gì: XONG khoá, BỎ QUA vẫn bấm được', async () => {
    stubFetch(BANG(ME_CAN_HOI));
    renderAt('/');
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: /^XONG$/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /BỎ QUA/ }).hasAttribute('disabled')).toBe(false);
  });
});

describe('Khai', () => {
  it('điền đủ ba câu → gửi NĂM sinh, và chỉ có thế', async () => {
    const calls = stubFetch(BANG(ME_CAN_HOI));
    renderAt('/');
    await screen.findByRole('dialog');

    fireEvent.change(screen.getByPlaceholderText('2009'), { target: { value: '2009' } });
    fireEvent.click(screen.getByRole('button', { name: 'Miền Nam' }));
    fireEvent.click(screen.getByRole('button', { name: /Học sinh/ }));
    fireEvent.click(screen.getByRole('button', { name: /^XONG$/ }));

    await waitFor(() => {
      const g = calls.find((c) => c.url.includes('/me/nhan-khau'));
      expect(g?.body).toEqual({ birth_year: 2009, region: 'nam', occupation_band: 'hs_sv' });
    });
  });

  /*
   * C7 nói bằng lời cho người đang khai. Bỏ dòng này thì họ đưa năm sinh đi mà
   * không biết app giữ lại cái gì — và đó là chỗ "đồng ý" thành hình thức.
   */
  it('nói rõ chỉ lưu nhóm tuổi, không lưu năm', async () => {
    stubFetch(BANG(ME_CAN_HOI));
    renderAt('/');
    await screen.findByRole('dialog');
    expect(screen.getByText(/Chỉ lưu nhóm tuổi/)).toBeTruthy();
  });

  it('ô năm sinh chỉ nhận CHỮ SỐ và tối đa 4 ký tự', async () => {
    stubFetch(BANG(ME_CAN_HOI));
    renderAt('/');
    await screen.findByRole('dialog');
    const o = screen.getByPlaceholderText('2009') as HTMLInputElement;
    fireEvent.change(o, { target: { value: '19a9x123' } });
    expect(o.value).toBe('1991');
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * Ô ĐỒNG Ý DỮ LIỆU (founder chốt phương án A, 04/08)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ⚠⚠ VÌ SAO Ô NÀY PHẢI Ở ĐÂY: cửa đồng ý có sẵn từ lâu (`/account/consent`, công
 * tắc ở Hồ sơ, cổng rank) nhưng KHÁCH không bao giờ đi qua chỗ nào trong số đó.
 * Đo được trên prod: từ lúc mọi người tự động vào bằng KHÁCH, `research_consent`
 * luôn false nên `POST /telemetry` bỏ IM LẶNG mọi dòng — app mù về chính nó, và
 * sự im lặng đó trông y hệt "không có lỗi nào".
 */
describe('Ô đồng ý dữ liệu', () => {
  const oDongY = () => screen.getByRole('checkbox');

  /*
   * ⚠⚠ BÀI QUAN TRỌNG NHẤT CỦA CẢ FILE. Một ô đồng ý TÍCH SẴN thì không phải sự
   * đồng ý — nó là một cái bẫy, và nó biến C7 thành một dòng chữ trang trí.
   */
  it('⭐ MẶC ĐỊNH TẮT — không bao giờ tích sẵn', async () => {
    stubFetch(BANG(ME_CAN_HOI));
    renderAt('/');
    await screen.findByRole('dialog');
    expect((oDongY() as HTMLInputElement).checked).toBe(false);
  });

  it('không tích → KHÔNG gọi cửa đồng ý', async () => {
    const calls = stubFetch(BANG(ME_CAN_HOI));
    renderAt('/');
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByPlaceholderText('2009'), { target: { value: '2009' } });
    fireEvent.click(screen.getByRole('button', { name: 'Miền Nam' }));
    fireEvent.click(screen.getByRole('button', { name: /Học sinh/ }));
    fireEvent.click(screen.getByRole('button', { name: /^XONG$/ }));

    await waitFor(() => expect(calls.some((c) => c.url.includes('/me/nhan-khau'))).toBe(true));
    expect(calls.some((c) => c.url.includes('/account/consent'))).toBe(false);
  });

  it('tích + XONG → bật đồng ý, và chỉ gửi TRUE', async () => {
    const calls = stubFetch(BANG(ME_CAN_HOI));
    renderAt('/');
    await screen.findByRole('dialog');
    fireEvent.click(oDongY());
    fireEvent.click(screen.getByRole('button', { name: /^XONG$/ }));

    await waitFor(() => {
      const g = calls.find((c) => c.url.includes('/account/consent'));
      // 0079 — bật luôn kèm văn bản `nghien_cuu` ở bản hiện hành (vết ghi đúng chữ đang hiện dưới ô tích).
      expect(g?.body).toEqual({ research_consent: true, van_ban_id: 'nghien_cuu', phien_ban: CONSENT_PHIEN_BAN.nghien_cuu });
    });
  });

  /*
   * ⚠ Hai quyết định ĐỘC LẬP. Bắt phải khai nhân khẩu mới được đồng ý là bó buộc
   * hai thứ chẳng liên quan gì nhau vào một cú bấm.
   */
  it('chỉ tích đồng ý, KHÔNG khai gì → XONG vẫn mở, và vẫn đánh dấu đã hỏi', async () => {
    const calls = stubFetch(BANG(ME_CAN_HOI));
    renderAt('/');
    await screen.findByRole('dialog');
    expect((screen.getByRole('button', { name: /^XONG$/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(oDongY());
    expect((screen.getByRole('button', { name: /^XONG$/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /^XONG$/ }));

    await waitFor(() => {
      expect(calls.find((c) => c.url.includes('/account/consent'))?.body)
        .toEqual({ research_consent: true, van_ban_id: 'nghien_cuu', phien_ban: CONSENT_PHIEN_BAN.nghien_cuu });
      // Vẫn phải đánh dấu đã hỏi, nếu không thì lần mở sau lại bật lên hỏi tiếp.
      expect(calls.find((c) => c.url.includes('/me/nhan-khau'))?.body).toEqual({ bo_qua: true });
    });
  });

  /*
   * ⚠⚠ BẪY REACT THẬT: `setDongY(false)` rồi `mutate()` ngay trong cùng một trình
   * xử lý thì state CHƯA đổi lúc mutation chạy — nút BỎ QUA sẽ vẫn gửi đồng ý.
   * Ở một ô đồng ý thì đó là loại lỗi im lặng tệ nhất có thể có.
   */
  it('⭐ tích rồi bấm BỎ QUA → TUYỆT ĐỐI không gửi đồng ý', async () => {
    const calls = stubFetch(BANG(ME_CAN_HOI));
    renderAt('/');
    await screen.findByRole('dialog');
    fireEvent.click(oDongY());
    fireEvent.click(screen.getByRole('button', { name: /BỎ QUA/ }));

    await waitFor(() => expect(calls.some((c) => c.url.includes('/me/nhan-khau'))).toBe(true));
    expect(
      calls.some((c) => c.url.includes('/account/consent')),
      'bỏ qua mà vẫn bật đồng ý = lưu một thứ người ta vừa từ chối lưu',
    ).toBe(false);
  });
});
