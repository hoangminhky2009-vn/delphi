/**
 * Test Kết quả (kèo resolved) — dữ liệu thật: chi tiết + /me/results (§2.5).
 * Lễ công bố chỉ khi ĐÃ tham gia; không tham gia → không thấy phân bố (A3.1).
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch, type StubRoute } from './helpers';

function clearRevealed() {
  localStorage.removeItem('delphi.revealed_results');
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

/**
 * Từ 20/07 reduced-motion KHÔNG còn nuốt lễ — nó chỉ bỏ chuyển động và co còn
 * ~25% (xem MarketResult RM_SCALE). Nên test phải CHỜ lễ chốt rồi mới đọc số,
 * thay vì đọc ngay sau cú bấm như hồi lễ bị bỏ qua.
 */
async function ceremonyDone() {
  await screen.findByText('↻ CHẠY LẠI', undefined, { timeout: 6000 });
}

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? matches : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
}

const OPTIONS = [
  { option_id: 'o1', label: 'Dưới 3,0', sort_order: 1, range_low: null, range_high: null },
  { option_id: 'o2', label: '3,0 – 3,4', sort_order: 2, range_low: null, range_high: null },
  { option_id: 'o3', label: '3,4 – 3,8', sort_order: 3, range_low: null, range_high: null },
  { option_id: 'o4', label: 'Từ 3,8', sort_order: 4, range_low: null, range_high: null },
];

const BASE = {
  market_id: 'm1',
  pool: 'macro',
  question_text: 'CPI tháng 7/2026 so với cùng kỳ nằm trong khoảng nào?',
  resolution_source_name: 'GSO',
  resolution_source_url: 'https://gso.gov.vn',
  open_ts: '2026-07-17T00:00:00Z',
  lock_ts: '2026-07-24T12:00:00Z',
  resolve_deadline_ts: '2026-07-31T12:00:00Z',
  status: 'resolved',
  seed_per_option: 100,
  total_volume: 4520,
  options: OPTIONS,
  seed_total: 400,
  bankroll: 1790,
  bet_cap: 200,
  outcome_option_id: 'o3',
  resolution_note: 'CPI +3,42% — thông cáo GSO 29/07.',
  resolved_ts: '2026-07-29T03:00:00Z',
};

/** User ĐÃ tham gia: có distribution + my_allocation. */
const DETAIL_MINE: StubRoute = {
  status: 200,
  body: {
    ...BASE,
    my_allocation: [{ option_id: 'o3', amount: 120 }],
    distribution: [
      { option_id: 'o1', volume: 603, pct: 13 },
      { option_id: 'o2', volume: 1995, pct: 43 },
      { option_id: 'o3', volume: 835, pct: 18 },
      { option_id: 'o4', volume: 1207, pct: 26 },
    ],
  },
};

/** User KHÔNG tham gia: không distribution, không my_allocation (A3.1). */
const DETAIL_OTHER: StubRoute = {
  status: 200,
  body: { ...BASE, my_allocation: [] },
};

const MY_RESULTS: StubRoute = {
  status: 200,
  body: [
    {
      market_id: 'm1',
      question_text: BASE.question_text,
      status: 'resolved',
      outcome_option_id: 'o3',
      my_total_bet: 120,
      my_return: 550,
      net: 430,
    },
  ],
};

describe('Chống lộ kết quả trước khi công bố (chỉ đạo founder 19/07)', () => {
  const table = (): [string, StubRoute][] => [
    ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ['/me/results', MY_RESULTS],
    ['/markets?', { status: 200, body: { markets: [{ ...BASE, my_allocation: undefined }] } }],
    ['/markets/m1', DETAIL_MINE],
  ];

  it('danh sách Kết quả: CHƯA xem lễ → KHÔNG hiện ±T, chỉ "CHỜ CÔNG BỐ"', async () => {
    clearRevealed();
    stubFetch(table());
    renderAt('/ket-qua');
    expect(await screen.findByText('CHỜ CÔNG BỐ')).toBeInTheDocument();
    expect(screen.queryByText('▲ +430 T')).toBeNull();
    expect(screen.queryByText(/▼/)).toBeNull();
  });

  it('sau khi chạy lễ xong → danh sách mới lộ ±T', async () => {
    clearRevealed();
    stubReducedMotion(true);
    stubFetch(table());
    const view = renderAt('/keo/m1/ket-qua');
    fireEvent.click(await screen.findByText('▶ CÔNG BỐ KẾT QUẢ'));
    await ceremonyDone(); // markRevealed chạy ở nhịp chốt, không phải lúc lộ cửa thắng
    view.unmount();

    stubFetch(table());
    renderAt('/ket-qua');
    expect(await screen.findByText('▲ +430 T')).toBeInTheDocument();
    expect(screen.queryByText('CHỜ CÔNG BỐ')).toBeNull();
  });
});

describe('Ca THUA: số không nhảy, vốn về tạch ra 0 + mặt mếu', () => {
  const LOST: StubRoute = {
    status: 200,
    body: [
      {
        market_id: 'm1',
        question_text: BASE.question_text,
        status: 'resolved',
        outcome_option_id: 'o2', // cửa thắng KHÔNG phải cửa tôi (o3)
        my_total_bet: 200,
        my_return: 0,
        net: -200,
      },
    ],
  };

  it('thua trắng → VỐN VỀ 0 T, tổng nhận 0, KHÔNG có delta ví, không glow xanh', async () => {
    clearRevealed();
    stubReducedMotion(true);
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/me/results', LOST],
      [
        '/markets/m1',
        { status: 200, body: { ...(DETAIL_MINE.body as object), outcome_option_id: 'o2' } },
      ],
    ]);
    renderAt('/keo/m1/ket-qua');
    fireEvent.click(await screen.findByText('▶ CÔNG BỐ KẾT QUẢ'));
    await ceremonyDone();

    expect(screen.getByText('0 T')).toBeInTheDocument(); // vốn về tạch ra 0
    expect(screen.getByRole('img', { name: '0' })).toBeInTheDocument(); // tổng nhận 0
    expect(screen.getByText('—')).toBeInTheDocument(); // lãi từ pool: không có
    // Ví KHÔNG có delta (token đã trừ lúc đặt, resolve không đụng ví)
    expect(screen.queryByText(/▲ \+/)).toBeNull();
    // Không có huy hiệu ăn mừng
    expect(screen.queryByText('Ngược đám đông')).toBeNull();
  });
});

describe('Thưởng chuỗi (khối lửa mẫu E — số do SERVER cấp)', () => {
  const withStreak: StubRoute = {
    status: 200,
    body: [
      {
        market_id: 'm1',
        question_text: BASE.question_text,
        status: 'resolved',
        outcome_option_id: 'o3',
        my_total_bet: 120,
        my_return: 550,
        net: 430,
        streak_bonus: 86,
        streak_len: 3,
        streak_pools: 2,
        streak_rate_pct: 20,
      },
    ],
  };

  it('có streak_bonus → hiện khối THƯỞNG CHUỖI, tổng nhận cộng cả thưởng', async () => {
    clearRevealed();
    stubReducedMotion(true);
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/me/results', withStreak],
      ['/markets/m1', DETAIL_MINE],
    ]);
    renderAt('/keo/m1/ket-qua');
    fireEvent.click(await screen.findByText('▶ CÔNG BỐ KẾT QUẢ'));
    await ceremonyDone();

    expect(screen.getByText(/THƯỞNG CHUỖI/)).toBeInTheDocument();
    expect(screen.getByText('+20%')).toBeInTheDocument();
    expect(screen.getByText(/đúng 3 câu liên tiếp · 2 pool/)).toBeInTheDocument();
    expect(screen.getByText('▲ +86 T')).toBeInTheDocument();
    // 550 + 86 = 636 (đúng số mẫu E)
    expect(screen.getByRole('img', { name: '636' })).toBeInTheDocument();
  });

  it('KHÔNG có streak_bonus → không hiện khối nào (không bịa thưởng)', async () => {
    clearRevealed();
    stubReducedMotion(true);
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/me/results', MY_RESULTS],
      ['/markets/m1', DETAIL_MINE],
    ]);
    renderAt('/keo/m1/ket-qua');
    fireEvent.click(await screen.findByText('▶ CÔNG BỐ KẾT QUẢ'));
    await ceremonyDone();
    expect(screen.queryByText(/THƯỞNG CHUỖI/)).toBeNull();
    expect(screen.getByRole('img', { name: '550' })).toBeInTheDocument();
  });
});

describe('Kết quả kèo (resolved)', () => {
  // reduced-motion KHÔNG được nuốt lễ. Trước 20/07 start() gọi thẳng finishNow()
  // → bật tiết kiệm pin trên Android là mất sạch hiệu ứng (founder báo 20/07).
  // Luật: bỏ chuyển động, GIỮ trình tự + giữ đủ số.
  it('reduced-motion: lễ vẫn chạy đủ trình tự, ra đúng SỐ SERVER', async () => {
    clearRevealed();
    stubReducedMotion(true);
    stubFetch([
      ['/auth/me', { status: 200, body: { ...ME_ONBOARDED, user: { ...ME_ONBOARDED.user!, bankroll: 1790 } } }],
      ['/me/results', MY_RESULTS],
      ['/markets/m1', DETAIL_MINE],
    ]);
    renderAt('/keo/m1/ket-qua');
    fireEvent.click(await screen.findByText('▶ CÔNG BỐ KẾT QUẢ'));

    // Trình tự phải còn: ngay sau cú bấm vẫn đang chạy, chưa lộ cửa thắng
    expect(screen.queryByText('CỬA THẮNG')).toBeNull();
    expect(screen.getByText(/chạm màn hình để xem ngay kết quả/)).toBeInTheDocument();

    await ceremonyDone();
    expect(screen.getByText('CỬA THẮNG')).toBeInTheDocument();
    expect(screen.getAllByText('✕ TẠCH')).toHaveLength(3);
    expect(screen.getByText('120 T')).toBeInTheDocument(); // vốn đã đặt (server)
    expect(screen.getByText('▲ +430 T')).toBeInTheDocument(); // net (server)
    expect(screen.getByText('▲ +430')).toBeInTheDocument(); // delta trên pill VÍ
    expect(screen.getByRole('img', { name: '550' })).toBeInTheDocument(); // odometer
    expect(screen.getByText('↻ CHẠY LẠI')).toBeInTheDocument();
    // Không chat / không thưởng chuỗi (doc mục 8)
    expect(screen.queryByText(/THƯỞNG CHUỖI/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/CHAT/);
  });

  /*
   * BUG 20/07 (founder báo "hiệu ứng lỗi và lệch"), tái hiện được trên trình duyệt:
   * mốc lễ chạy bằng setTimeout còn tween chạy bằng rAF — hai đồng hồ khác nhau.
   * Khi rAF bị bóp (tiết kiệm pin, tab chạy nền, máy yếu rớt khung) timer vẫn về
   * đích còn tween thì không → lễ báo "xong" với thanh đứng 0% và TỔNG NHẬN 0 T.
   * Nhịp cuối BẮT BUỘC chốt cứng về FINAL, không chỉ lật cờ running/done.
   */
  it('rAF bị treo (máy tiết kiệm pin) → lễ vẫn chốt ĐÚNG SỐ, không đứng ở 0', async () => {
    clearRevealed();
    stubReducedMotion(false);
    // rAF không bao giờ gọi lại callback — đúng hành vi khi trình duyệt bóp khung hình
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1 as unknown as number);
    try {
      stubFetch([
        ['/auth/me', { status: 200, body: ME_ONBOARDED }],
        ['/me/results', MY_RESULTS],
        ['/markets/m1', DETAIL_MINE],
      ]);
      renderAt('/keo/m1/ket-qua');
      fireEvent.click(await screen.findByText('▶ CÔNG BỐ KẾT QUẢ'));

      // Lễ đầy đủ ~9,8s ở tốc độ chuẩn (xem PACE trong MarketResult) — chừa biên
      expect(await screen.findByText('↻ CHẠY LẠI', undefined, { timeout: 16000 })).toBeInTheDocument();
      // Số phải là số SERVER, không phải giá trị tween đứng dở
      expect(screen.getByText('CỬA THẮNG')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: '550' })).toBeInTheDocument(); // odometer tổng nhận
      expect(screen.getByText('▲ +430 T')).toBeInTheDocument();
      expect(screen.queryByText('0%')).toBeNull(); // thanh không được đứng ở 0
    } finally {
      raf.mockRestore();
    }
  }, 24_000);

  it('đang chạy lễ → chạm card skip về trạng thái cuối', async () => {
    stubReducedMotion(false);
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/me/results', MY_RESULTS],
      ['/markets/m1', DETAIL_MINE],
    ]);
    renderAt('/keo/m1/ket-qua');
    fireEvent.click(await screen.findByText('▶ CÔNG BỐ KẾT QUẢ'));
    // Skip có cả nút thật (bàn phím/screen reader) lẫn chạm cả card
    expect(screen.getByText(/chạm màn hình để xem ngay kết quả/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ceremony-card'));
    expect(await screen.findByText('CỬA THẮNG')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '550' })).toBeInTheDocument();
  });

  it('tab bị ẩn giữa lễ → chốt thẳng kết quả, không đóng băng (bug điện thoại)', async () => {
    stubReducedMotion(false);
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/me/results', MY_RESULTS],
      ['/markets/m1', DETAIL_MINE],
    ]);
    renderAt('/keo/m1/ket-qua');
    fireEvent.click(await screen.findByText('▶ CÔNG BỐ KẾT QUẢ'));
    expect(screen.getByText(/chạm màn hình để xem ngay kết quả/)).toBeInTheDocument();

    setVisibility('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    setVisibility('visible');

    expect(await screen.findByText('CỬA THẮNG')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '550' })).toBeInTheDocument();
    expect(screen.getByText('↻ CHẠY LẠI')).toBeInTheDocument();
  });

  it('KHÔNG tham gia: thấy cửa đúng nhưng KHÔNG thấy phân bố % (A3.1)', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/me/results', { status: 200, body: [] }],
      ['/markets/m1', DETAIL_OTHER],
    ]);
    renderAt('/keo/m1/ket-qua');
    expect(await screen.findByText('CỬA THẮNG')).toBeInTheDocument();
    expect(screen.getByText(/không tham gia câu hỏi này/)).toBeInTheDocument();
    expect(screen.queryByText('▶ CÔNG BỐ KẾT QUẢ')).toBeNull();
    // Không một pct phân bố nào lộ ra (resolution_note chứa "%" là nội dung hợp lệ)
    for (const pct of ['13%', '43%', '18%', '26%']) {
      expect(screen.queryByText(pct)).toBeNull();
    }
  });

  it('kèo hủy: banner hoàn 100%, không lễ', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/me/results', { status: 200, body: [] }],
      ['/markets/m1', { status: 200, body: { ...BASE, status: 'cancelled', my_allocation: [] } }],
    ]);
    renderAt('/keo/m1/ket-qua');
    expect(await screen.findByText('ĐÃ HỦY')).toBeInTheDocument();
    expect(screen.getByText(/hoàn 100%/)).toBeInTheDocument();
    expect(screen.queryByText('▶ CÔNG BỐ KẾT QUẢ')).toBeNull();
  });
});
