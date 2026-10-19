/** Test Ví (GET /wallet + POST /subsidy/claim) theo contract §2.4. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch, type StubRoute } from './helpers';

const WALLET: StubRoute = {
  status: 200,
  body: {
    bankroll: 430,
    entries: [
      {
        entry_id: 3,
        delta: 550,
        balance_after: 430,
        reason: 'payout',
        ref_market_id: 'm1',
        created_at: '2026-07-18T05:00:00Z',
      },
      {
        entry_id: 2,
        delta: -120,
        balance_after: -880 + 1000, // 880 — giá trị server, chỉ hiển thị
        reason: 'bet_place',
        ref_market_id: 'm1',
        created_at: '2026-07-17T09:00:00Z',
      },
      {
        entry_id: 1,
        delta: 1000,
        balance_after: 1000,
        reason: 'signup_grant',
        ref_market_id: null,
        created_at: '2026-07-17T08:00:00Z',
      },
    ],
    next_before: null,
  },
};

/** Đánh dấu kèo ĐÃ xem lễ công bố (khoá của lib/seen). */
function markSeen(...ids: string[]) {
  localStorage.setItem('delphi.revealed_results', JSON.stringify(ids));
}

describe('Ví & lịch sử', () => {
  it('render số dư + ledger có lý do từng dòng (A3.10)', async () => {
    markSeen('m1'); // đã công bố rồi thì ví được hiện số
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/wallet', WALLET],
    ]);
    renderAt('/vi');
    expect(await screen.findByText('430 T')).toBeInTheDocument();
    expect(screen.getByText('Nhận từ pool')).toBeInTheDocument();
    expect(screen.getByText('Phân bổ vào câu hỏi')).toBeInTheDocument();
    expect(screen.getByText('Vốn khởi điểm')).toBeInTheDocument();
    expect(screen.getByText('▲ +550 T')).toBeInTheDocument();
    expect(screen.getByText('▼ −120 T')).toBeInTheDocument();
  });

  /*
   * BUG 20/07 (founder): "phải bấm hiện kết quả mới biết mình nhận bao nhiêu
   * token cơ mà? Sao hiện luôn ở ngoài?" — sổ ví phun thẳng
   * "Nhận từ pool ▲ +550 T" kèm link sang đúng kèo, nên chẳng ai buồn mở lễ.
   * Màn Kết quả đã chặn từ 19/07 nhưng ví thì sót.
   */
  it('CHƯA công bố → dòng trả thưởng bị che số, mời bấm công bố', async () => {
    localStorage.removeItem('delphi.revealed_results');
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/wallet', WALLET],
    ]);
    renderAt('/vi');
    expect(await screen.findByText('▲ ••• T')).toBeInTheDocument();
    expect(screen.getByText('chưa công bố')).toBeInTheDocument();
    expect(screen.getByText('công bố kết quả →')).toBeInTheDocument();
    // Con số TUYỆT ĐỐI không được có mặt, kể cả trong DOM ẩn
    expect(document.body.textContent).not.toContain('550');
    // Dòng KHÔNG phải trả thưởng vẫn hiện bình thường
    expect(screen.getByText('▼ −120 T')).toBeInTheDocument();
    expect(screen.getByText('▲ +1.000 T')).toBeInTheDocument();
  });

  it('bankroll < 500 → hiện nút trợ cấp; nhận thành công → +50 từ RESPONSE', async () => {
    markSeen('m1');
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/subsidy/claim', { status: 200, body: { ok: true, amount: 50, bankroll: 480 } }],
      ['/wallet', WALLET],
    ]);
    renderAt('/vi');
    const btn = await screen.findByText(/NHẬN TRỢ CẤP NGÀY/);
    fireEvent.click(btn);
    expect(await screen.findByText(/\+50 T trợ cấp đã vào ví/)).toBeInTheDocument();
  });

  it('đã nhận hôm nay → hiện message server 409', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      [
        '/subsidy/claim',
        {
          status: 409,
          body: { error: 'already_claimed_today', message: 'Hôm nay bạn đã nhận trợ cấp rồi. Mai quay lại nhé.' },
        },
      ],
      ['/wallet', WALLET],
    ]);
    renderAt('/vi');
    fireEvent.click(await screen.findByText(/NHẬN TRỢ CẤP NGÀY/));
    expect(await screen.findByText(/Hôm nay bạn đã nhận trợ cấp rồi/)).toBeInTheDocument();
  });
});
