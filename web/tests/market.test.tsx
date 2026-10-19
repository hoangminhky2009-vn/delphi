/**
 * Test sảnh + chi tiết trên CONTRACT THẬT (docs/gd5_ui_technical_directives.md §2.2):
 * A3.1 rẽ nhánh theo vắng key distribution; đặt declarative + idempotency §2.3;
 * ví cập nhật từ RESPONSE (C4).
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch, type StubRoute } from './helpers';

const OPTIONS = [
  { option_id: 'o1', label: 'Dưới 3,0', sort_order: 1, range_low: null, range_high: '3.0' },
  { option_id: 'o2', label: '3,0 – 3,4', sort_order: 2, range_low: '3.0', range_high: '3.4' },
  { option_id: 'o3', label: '3,4 – 3,8', sort_order: 3, range_low: '3.4', range_high: '3.8' },
  { option_id: 'o4', label: 'Từ 3,8', sort_order: 4, range_low: '3.8', range_high: null },
];

const SUMMARY = {
  market_id: 'm1',
  pool: 'macro',
  question_text: 'CPI tháng 7/2026 so với cùng kỳ nằm trong khoảng nào?',
  resolution_source_name: 'GSO',
  resolution_source_url: 'https://gso.gov.vn',
  open_ts: '2026-07-17T00:00:00Z',
  lock_ts: '2026-07-24T12:00:00Z',
  status: 'open',
  seed_per_option: 100,
  total_volume: 4520,
};

const MARKETS: StubRoute = {
  status: 200,
  body: {
    markets: [
      SUMMARY,
      { ...SUMMARY, market_id: 'm2', status: 'locked', question_text: 'Giá xăng kỳ tới tăng hay giảm?' },
      { ...SUMMARY, market_id: 'm3', status: 'resolved', question_text: 'Giá vàng tuần này chốt ở khoảng nào?' },
    ],
  },
};

/** A3.1: KHÔNG có key distribution khi chưa đặt. */
const DETAIL_HIDDEN: StubRoute = {
  status: 200,
  body: {
    ...SUMMARY,
    resolve_deadline_ts: '2026-07-31T12:00:00Z',
    options: OPTIONS,
    seed_total: 400,
    my_allocation: [],
    bankroll: 1000,
    bet_cap: 200,
  },
};

// Shape mới (founder 19/07): SỐ TIỀN mỗi cửa + pct. KHÔNG tỷ lệ ăn, KHÔNG số người.
const DISTRIBUTION = [
  { option_id: 'o1', volume: 603, pct: 13 },
  { option_id: 'o2', volume: 1995, pct: 43 },
  { option_id: 'o3', volume: 835, pct: 18 },
  { option_id: 'o4', volume: 1207, pct: 26 },
];

const BET_OK: StubRoute = {
  status: 200,
  body: {
    ok: true,
    market_id: 'm1',
    bankroll: 880,
    my_allocation: [{ option_id: 'o3', amount: 120 }],
    bet_total_mine: 120,
    bet_cap: 200,
    total_volume: 4640,
    distribution: DISTRIBUTION,
  },
};

describe('Bảng giá (GET /markets)', () => {
  it('khách → cổng đăng nhập, không lộ dữ liệu', async () => {
    stubFetch([]);
    renderAt('/du-bao');
    expect(await screen.findByText('▶ ĐĂNG NHẬP / ĐĂNG KÝ')).toBeInTheDocument();
    // Không lộ dữ liệu kèo thật (chữ 'CPI' trơn trong ticker hero là trang trí)
    expect(screen.queryByText(/CPI tháng 7\/2026/)).toBeNull();
    expect(screen.queryByText(/Nguồn:/)).toBeNull();
  });

  it('đã đăng nhập → bảng giá chỉ open+locked, KHÔNG có phân bố % (A3.1)', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/markets?', MARKETS],
    ]);
    renderAt('/du-bao');
    expect(await screen.findByText(/CPI tháng 7\/2026/)).toBeInTheDocument();
    expect(screen.getByText('ĐÃ KHÓA — CHỜ NGUỒN CÔNG BỐ')).toBeInTheDocument();
    // Kèo đã chốt KHÔNG nằm ở sảnh (spec GĐ5 — có màn Kết quả riêng)
    expect(screen.queryByText(/Giá vàng tuần này/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d\s?%/);
  });
});

describe('Màn Kết quả (danh sách — spec GĐ5 màn 5)', () => {
  it('liệt kê kèo đã chốt + ±T của tôi (server tính) + link trang lễ công bố', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      [
        '/me/results',
        {
          status: 200,
          body: [
            {
              market_id: 'm3',
              question_text: 'Giá vàng tuần này chốt ở khoảng nào?',
              status: 'resolved',
              outcome_option_id: 'o1',
              my_total_bet: 50,
              my_return: 120,
              net: 70,
            },
            {
              market_id: 'm4',
              question_text: 'Điểm chuẩn CNTT năm nay tăng hay giảm?',
              status: 'resolved',
              outcome_option_id: 'o2',
              my_total_bet: 40,
              my_return: 40,
              net: 0,
            },
          ],
        },
      ],
      [
        '/markets?',
        {
          status: 200,
          body: {
            markets: [
              ...(MARKETS.body as { markets: unknown[] }).markets,
              {
                ...SUMMARY,
                market_id: 'm4',
                status: 'resolved',
                question_text: 'Điểm chuẩn CNTT năm nay tăng hay giảm?',
              },
            ],
          },
        },
      ],
    ]);
    localStorage.removeItem('delphi.revealed_results');
    renderAt('/ket-qua');
    const card = (await screen.findByText(/Giá vàng tuần này/)).closest('a');
    expect(card).toHaveAttribute('href', '/keo/m3/ket-qua');
    expect(screen.getAllByText('CÓ KẾT QUẢ')).toHaveLength(2);
    // CHƯA xem lễ → không lộ ±T, kể cả trường hợp hoà vốn
    expect(screen.getAllByText('CHỜ CÔNG BỐ')).toHaveLength(2);
    expect(screen.queryByText('▲ +70 T')).toBeNull();
    expect(screen.queryByText('HOÀN VỐN')).toBeNull();
  });
});

describe('Chi tiết (GET /markets/:id) — A3.1 + đặt declarative', () => {
  const baseTable = (): [string, StubRoute][] => [
    ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ['/bets', BET_OK],
    ['/markets/m1', DETAIL_HIDDEN],
  ];

  it('chưa đặt: có khung mời đặt lần đầu, KHÔNG có %', async () => {
    stubFetch(baseTable());
    renderAt('/keo/m1');
    expect(await screen.findByText(/Đặt lần đầu để xem phân bố cộng đồng/)).toBeInTheDocument();
    /*
     * 04/08: ba dấu chấm tách thành ba `<span>` để sáng lần lượt (con trỏ
     * terminal đang đợi số) — trước đó là một chuỗi `'· · ·'` đứng im. Đếm CHẤM
     * chứ không đếm chuỗi: 4 cửa × 3 chấm.
     */
    expect(screen.getAllByText('·')).toHaveLength(12);
    expect(screen.queryByText('43%')).toBeNull();
    expect(screen.getByText(/trần câu hỏi này: 200 T/)).toBeInTheDocument();
  });

  it('⭐⭐ A3.1: chuyển động của cửa chưa mở khoá phải ĐỒNG NHẤT — không rò phân bố',
    async () => {
      /*
       * ĐÂY LÀ BÀI CANH MỘT KÊNH RÒ, KHÔNG PHẢI BÀI THẨM MỸ.
       *
       * 04/08 thêm nhịp "đang chờ dữ liệu" cho cửa chưa mở khoá (founder: màn
       * trông "khô cứng"). Nhưng chuyển động là THÔNG TIN: nếu cửa đông nhấp
       * nháy khác cửa vắng — nhanh hơn, sáng hơn, lệch pha — thì người chơi đọc
       * được phân bố từ nhịp thở, và A3.1 bị đi vòng qua đúng cánh cửa nó khoá.
       * D19 còn siết thêm (bỏ cả tỷ lệ ăn lẫn số người) để "% ví đặt vào" giữ
       * nghĩa ĐỘ TỰ TIN thay vì phản ứng đám đông.
       *
       * Nên bài này đòi: mọi cửa mang ĐÚNG một bộ class như nhau, và không cửa
       * nào có style nội tuyến riêng (delay/duration/biến CSS suy từ dữ liệu).
       */
      stubFetch(baseTable());
      renderAt('/keo/m1');
      await screen.findByText(/Đặt lần đầu để xem phân bố cộng đồng/);

      const cua = [...document.querySelectorAll('[class*="masked"]')]
        .filter((e) => !e.className.includes('maskedDot'));
      expect(cua.length).toBeGreaterThan(1);

      const chuKy = cua.map((e) => `${e.className}|${(e as HTMLElement).style.cssText}`);
      for (const c of chuKy) {
        expect(c, 'một cửa diễn khác cửa khác ⇒ nhịp thở thành kênh rò phân bố')
          .toBe(chuKy[0]);
      }
      // Và không cửa nào mang biến CSS riêng (chỗ dữ liệu hay lẻn vào nhất).
      for (const e of cua) {
        expect((e as HTMLElement).style.cssText).not.toMatch(/--|delay|duration/);
      }
    });

  // 25/07: nhãn 'ALL-IN' đổi thành 'HẾT TRẦN' — 'all-in' vào ban-list D26 (§1.2).
  // Ở mặt Dự báo nó vốn nghĩa là "đã chạm trần 20%/kèo", nên 'HẾT TRẦN' còn đúng hơn.
  it('chạm cửa → bung thanh kéo; kéo MAX → HẾT TRẦN cháy + khẩu vị rủi ro', async () => {
    stubFetch(baseTable());
    renderAt('/keo/m1');
    fireEvent.click(await screen.findByRole('button', { name: /Dưới 3,0/ }));
    expect(screen.getByLabelText('Kéo phân bổ cho Dưới 3,0')).toBeInTheDocument();
    fireEvent.click(screen.getByText('MAX'));
    // 26/07: bỏ 🔥 ở đuôi nhãn khẩu vị (emoji do font HĐH vẽ, lạc hệ pixel) →
    // hai chỗ nay cùng chữ: tem trên thanh kéo + nhãn khẩu vị rủi ro.
    expect(screen.getAllByText('HẾT TRẦN')).toHaveLength(2);
    expect(screen.queryByText(/HẾT TRẦN\s*🔥/)).toBeNull();
    expect(screen.getByText('200 T')).toBeInTheDocument(); // tổng phân bổ = trần server
  });

  it('rải 2 cửa → thanh chia khúc + nhãn khẩu vị hạ nhiệt', async () => {
    stubFetch(baseTable());
    renderAt('/keo/m1');
    fireEvent.click(await screen.findByRole('button', { name: /Dưới 3,0/ }));
    fireEvent.change(screen.getByLabelText('Phân bổ cho Dưới 3,0'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /3,4 – 3,8/ }));
    fireEvent.change(screen.getByLabelText('Phân bổ cho 3,4 – 3,8'), { target: { value: '40' } });
    // splitBar legend hiện cả 2 cửa với mức của từng cửa
    expect(screen.getByText(/Dưới 3,0 · 40 T/)).toBeInTheDocument();
    expect(screen.getByText(/3,4 – 3,8 · 40 T/)).toBeInTheDocument();
    expect(screen.getByText(/rải 2 cửa/)).toBeInTheDocument();
  });

  it('gửi phân bổ → body declarative + idempotency_key; reveal + ví từ RESPONSE', async () => {
    const calls = stubFetch(baseTable());
    renderAt('/keo/m1');
    fireEvent.click(await screen.findByRole('button', { name: /3,4 – 3,8/ }));
    fireEvent.change(screen.getByLabelText('Phân bổ cho 3,4 – 3,8'), {
      target: { value: '120' },
    });
    fireEvent.click(screen.getByText('▶ GỬI PHÂN BỔ'));

    expect(await screen.findByText('43%')).toBeInTheDocument();
    expect(screen.getByText('ĐẶT · 120 T')).toBeInTheDocument();
    // C4: ví cập nhật từ bankroll TRONG response (1000 → 880)
    expect(await screen.findByText('880 T')).toBeInTheDocument();

    const post = calls.find((c) => c.method === 'POST');
    expect(post!.url).toBe('/api/v1/markets/m1/bets');
    const body = post!.body as { allocations: unknown; idempotency_key: string };
    expect(body.allocations).toEqual([{ option_id: 'o3', amount: 120 }]);
    expect(body.idempotency_key.length).toBeGreaterThanOrEqual(8);
  });

  it('mạng chập → tự gửi lại CÙNG idempotency_key + body (chống trừ đôi §2.3)', async () => {
    const table = baseTable();
    table[1] = ['/bets', { ...BET_OK, failFirst: 1 }];
    const calls = stubFetch(table);
    renderAt('/keo/m1');
    fireEvent.click(await screen.findByRole('button', { name: /3,4 – 3,8/ }));
    fireEvent.change(screen.getByLabelText('Phân bổ cho 3,4 – 3,8'), {
      target: { value: '120' },
    });
    fireEvent.click(screen.getByText('▶ GỬI PHÂN BỔ'));

    expect(await screen.findByText('43%', undefined, { timeout: 3000 })).toBeInTheDocument();
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(2);
    const k1 = (posts[0]!.body as { idempotency_key: string }).idempotency_key;
    const k2 = (posts[1]!.body as { idempotency_key: string }).idempotency_key;
    expect(k1).toBe(k2);
    expect(posts[0]!.body).toEqual(posts[1]!.body);
  });

  it('server từ chối (cap_exceeded) → hiện message server, không reveal', async () => {
    const table = baseTable();
    table[1] = [
      '/bets',
      { status: 400, body: { error: 'cap_exceeded', message: 'Vượt trần 20% tài sản cho kèo này.' } },
    ];
    stubFetch(table);
    renderAt('/keo/m1');
    fireEvent.click(await screen.findByRole('button', { name: /3,4 – 3,8/ }));
    fireEvent.change(screen.getByLabelText('Phân bổ cho 3,4 – 3,8'), {
      target: { value: '150' },
    });
    fireEvent.click(screen.getByText('▶ GỬI PHÂN BỔ'));
    expect(await screen.findByText(/Vượt trần 20%/)).toBeInTheDocument();
    expect(screen.queryByText('43%')).toBeNull();
  });
});
