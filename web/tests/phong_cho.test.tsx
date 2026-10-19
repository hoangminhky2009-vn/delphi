/**
 * PHÒNG CHỜ (16/08) — founder: *"tạo lobby tìm trận ở chế độ rank đi chứ bấm phát
 * vào trận luôn thì hơi không quen"*. Ba luật canh:
 *   · HUỶ trong pha TÌM ⇒ KHÔNG tạo trận (không để lại trận dở);
 *   · sau nhịp TÌM mới POST /matches (server dựng), ghế lộ dần từ `doi_thu` server;
 *   · ghế máy phải LỘ MẶT là máy (D25/R3) — không giả vờ có người.
 * Dùng fake timers cho nhịp; `useReducedMotion` mặc định false trong jsdom.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/api/queries';
import { NHIP_PHONG_CHO, PhongCho } from '../src/components/holdem/PhongCho';
import { stubFetch } from './helpers';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const TRAN = {
  match_id: 'm-pc', vong: 1, tong_vong: 8, status: 'dang_choi',
  // Server: `doi_thu` KHÔNG chứa ghế mình; bot mang tên "Máy · <nhãn>", bậc '—' (D25/R3).
  doi_thu: [
    { ghe_id: 'b1', loai: 'bot', ten: 'Máy · Tất tay', bac_rank: '—' },
    { ghe_id: 'b2', loai: 'bot', ten: 'Máy · Phòng thủ', bac_rank: '—' },
  ],
};

/**
 * Nhả n nhịp trong act — fake timers thì `findBy*`/`waitFor` không tự chạy, và
 * react-query báo kết quả qua `setTimeout(0)` (notifyManager) nên phải TUA 1ms
 * mỗi nhịp chứ microtask không đủ. 1ms × 8 < mọi nhịp phòng chờ (TIM 1600).
 */
const nha = async (n = 8) => {
  for (let i = 0; i < n; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  }
};

const dung = (props: Partial<Parameters<typeof PhongCho>[0]> = {}) => {
  const onHuy = vi.fn();
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <PhongCho cheDo="rank_pve" soO={8} khauVi="can_bang" onHuy={onHuy} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onHuy };
};

describe('PhongCho', () => {
  it('pha TÌM: chữ "ĐANG TÌM TRẬN" (rank), HUỶ được, CHƯA POST /matches', () => {
    vi.useFakeTimers();
    const calls = stubFetch([['/holdem/matches', { status: 201, body: TRAN }]]);
    const { onHuy } = dung();
    expect(screen.getByText('ĐANG TÌM TRẬN')).toBeInTheDocument();
    expect(screen.getByText(/Mùa Beta ghép với máy/)).toBeInTheDocument();
    expect(screen.getByText('BẠN')).toBeInTheDocument();          // mình đã ngồi bàn từ giây đầu
    expect(screen.getAllByText('đang tìm…').length).toBeGreaterThan(0);
    act(() => { vi.advanceTimersByTime(NHIP_PHONG_CHO.TIM - 100); });
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'HUỶ' }));
    expect(onHuy).toHaveBeenCalledTimes(1);
  });

  it('sau nhịp TÌM ⇒ POST /matches; ghế lộ dần, máy ghi rõ "máy"; rồi nút VÀO BÀN', async () => {
    vi.useFakeTimers();
    const calls = stubFetch([['/holdem/matches', { status: 201, body: TRAN }]]);
    dung({ cheDo: 'tu_do' });
    expect(screen.getByText('ĐANG XẾP BÀN')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(NHIP_PHONG_CHO.TIM + 50); });
    // fetch stub trả về qua microtask — nhả vài nhịp.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    // Ghế lộ TỪNG cái — mỗi ghế một đồng hồ mới sau render, nên tua từng nhịp.
    for (let i = 0; i < 4; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { vi.advanceTimersByTime(NHIP_PHONG_CHO.MOI_GHE + 10); });
    }
    expect(screen.getByText('BẠN')).toBeInTheDocument();
    expect(screen.getByText('Tất tay')).toBeInTheDocument();     // bóc "Máy · " — dòng dưới đã nói
    expect(screen.getAllByText('máy').length).toBe(2);           // lộ mặt máy, không giả người
    expect(screen.queryByText(/người · /)).toBeNull();
    expect(screen.getByText('BÀN ĐÃ ĐỦ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /VÀO BÀN · \ds/ })).toBeInTheDocument();
  });

  it('bàn chung: nhãn số ô đọc từ BÀN (server), không từ cỡ đang chọn ở sảnh; ĐỘI hỏi lại ngay sau khi có trận', async () => {
    vi.useFakeTimers();
    // Body ĐỘI là object sống: sau khi POST /matches, mình thành một dòng của đội.
    const ban = {
      ma: 'k9x2m', so_o: 12, het_han: '2026-08-17T00:00:00Z', created_at: '2026-08-16T00:00:00Z',
      chu: 'founder', la_chu: true, so_nguoi: 0, toi: null, toi_da_xong: false,
      doi: [] as { handle: string; la_toi: boolean; xong: boolean; dang_choi: boolean }[],
    };
    const calls = stubFetch([
      ['/holdem/ban/k9x2m', { status: 200, body: ban }],
      ['/holdem/matches', { status: 201, body: { ...TRAN, tong_vong: 12 } }],
    ]);
    dung({ cheDo: 'tu_do', soO: 8, banMa: 'k9x2m' });   // sảnh đang chọn 8 — bàn là 12
    await nha();
    expect(screen.getByText(/BÀN CHUNG · K9X2M · 12 ô/)).toBeInTheDocument();
    expect(screen.getByText('chưa ai vào')).toBeInTheDocument();
    const soGetBanTruoc = calls.filter((c) => c.method === 'GET' && c.url.includes('/holdem/ban/k9x2m')).length;
    // Từ cú POST trở đi máy chủ sẽ thấy mình trong đội — đổi body TRƯỚC khi tua tới
    // nhịp TÌM (act(async) xả sạch microtask: POST → onSuccess → refetch xong ngay trong act).
    ban.doi = [{ handle: 'founder', la_toi: true, xong: false, dang_choi: true }]; ban.so_nguoi = 1;
    await act(async () => { vi.advanceTimersByTime(NHIP_PHONG_CHO.TIM + 50); });
    await nha();
    const post = calls.find((c) => c.method === 'POST' && /\/holdem\/matches$/.test(c.url));
    expect(post).toBeTruthy();
    expect((post!.body as { ban_ma?: string }).ban_ma).toBe('k9x2m');
    // ĐỘI được hỏi lại NGAY (không đợi nhịp 20s) ⇒ dòng "founder (bạn) · đang chơi".
    await nha();
    expect(screen.getByText(/founder \(bạn\) · đang chơi/)).toBeInTheDocument();
    const soGetBanSau = calls.filter((c) => c.method === 'GET' && c.url.includes('/holdem/ban/k9x2m')).length;
    expect(soGetBanSau).toBeGreaterThan(soGetBanTruoc);
    expect(screen.getByText(/· 12 ô/)).toBeInTheDocument();
  });
});
