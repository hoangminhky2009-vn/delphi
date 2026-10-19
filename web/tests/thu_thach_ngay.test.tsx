/**
 * THỬ THÁCH HÔM NAY — phía client (17/08; D85 §5.2, migration 0041).
 *   · card sảnh: ba trạng thái từ `GET /holdem/ngay` — CHƯA VÀO (mở phòng chờ với
 *     đúng mã bàn ngày) · ĐANG CHƠI (về trận) · ĐÃ XONG (phân vị, không bấm vào bàn mới);
 *   · D32: KHÔNG top-N, KHÔNG tên người khác — màn kết bàn ngày vẽ PHÂN VỊ, và
 *     dưới IT_NGUOI người thì đổi lời ("người thứ h trong N"), không "TOP 100%";
 *   · A3.1: chưa xong ⇒ không có hạng để vẽ, chỉ số người + "phân vị lộ khi bạn xong";
 *   · `cauPhanVi`/`ngayNgan`/`conLai` — một nguồn chữ, vector tay.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/api/queries';
import { DoiBan } from '../src/components/holdem/DoiBan';
import { PhongCho } from '../src/components/holdem/PhongCho';
import { ThuThachNgayCard, cauPhanVi, conLai, ngayNgan } from '../src/components/holdem/ThuThachNgay';
import { stubFetch } from './helpers';

const BAN_NGAY = (them: Record<string, unknown> = {}) => ({
  ma: 'q7p2z', so_o: 12, het_han: '2026-08-17T17:00:00Z', created_at: '2026-08-17T01:00:00Z',
  loai: 'ngay', chu: 'DELPHI', la_chu: false, so_nguoi: 4, toi: null, toi_da_xong: false, doi: [],
  thu_thach: { ngay: '2026-08-17', so_nguoi_vao: 4, so_nguoi_xong: 3 },
  ...them,
});

const dung = (ui: React.ReactElement) => render(
  <QueryClientProvider client={makeQueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>,
);

describe('chữ — một nguồn', () => {
  it('cauPhanVi: đủ người ⇒ TOP x% · hạng h/N; ít người ⇒ "người thứ h trong N"; chưa xong ⇒ null', () => {
    expect(cauPhanVi({ ngay: 'x', so_nguoi_vao: 9, so_nguoi_xong: 9, hang: 1, tong: 9, top_pct: 12 })).toBe('TOP 12% · hạng 1/9');
    expect(cauPhanVi({ ngay: 'x', so_nguoi_vao: 2, so_nguoi_xong: 2, hang: 2, tong: 2, top_pct: 100 })).toBe('bạn là người thứ 2 trong 2 người đã xong');
    expect(cauPhanVi({ ngay: 'x', so_nguoi_vao: 2, so_nguoi_xong: 1 })).toBeNull();
    expect(ngayNgan('2026-08-17')).toBe('17/08');
    expect(conLai('2026-08-17T17:00:00Z', Date.parse('2026-08-17T12:00:00Z'))).toBe('còn 5h');
    expect(conLai('2026-08-17T17:00:00Z', Date.parse('2026-08-17T15:30:00Z'))).toBe('còn 1h30');
    expect(conLai('2026-08-17T17:00:00Z', Date.parse('2026-08-17T16:40:00Z'))).toBe("còn 20'");
    expect(conLai('2026-08-17T17:00:00Z', Date.parse('2026-08-17T16:59:30Z'))).toBe('sắp đóng');
  });
});

describe('card sảnh', () => {
  it('⭐ CHƯA VÀO — card GỌN: tên · ngày · cỡ bàn · giờ còn lại · nút, KHÔNG đoạn mô tả ⇒ onVao(mã)', async () => {
    /*
     * D336 lượt 2 (founder 15/09): *"chỉ hiện thử thách hôm nay, màn chơi, số giờ còn lại của thử
     * thách và vào bàn hôm nay thôi"*. Bài khoá cả hai vế: bốn thứ CÓ, đoạn mô tả + số người KHÔNG.
     */
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));
    try {
      stubFetch([['/holdem/ngay', { status: 200, body: BAN_NGAY() }]]);
      const onVao = vi.fn();
      const { container } = dung(<ThuThachNgayCard onVao={onVao} />);
      const the = await screen.findByText(/VÀO BÀN HÔM NAY/);
      expect(screen.getByText(/THỬ THÁCH HÔM NAY · 17\/08/)).toBeInTheDocument();
      expect(screen.getByText('12 ô · còn 5h')).toBeInTheDocument();
      const chu = container.querySelector('[data-tap="thu-thach-ngay"]')!.textContent ?? '';
      expect(chu).not.toMatch(/Một bàn chung|người đã vào|mở hàng/);
      fireEvent.click(the);
      expect(onVao).toHaveBeenCalledWith('q7p2z');
    } finally { vi.useRealTimers(); }
  });

  it('⭐ ĐÃ XONG: card BIẾN MẤT khỏi sảnh', async () => {
    /*
     * Founder 23/08: *"cái phần thử thách hôm nay ở hub của đấu trường ấy thì
     * bạn có thể để nó biến mất sau khi player chơi và hoàn thành nhiệm vụ
     * không?"*. Card đứng ĐẦU sảnh và là thứ to nhất màn; xong rồi thì nó thành
     * một tấm bảng chiếm chỗ nổi bật nhất để nói "hết việc", mỗi lần vào sảnh,
     * tới tận 0:00 — mà một lượt/ngày nên không còn gì để bấm.
     * ⚠ Phân vị KHÔNG bị chôn: nó ở màn kết (`KetQuaThuThach`), có bài riêng
     * ngay dưới. Bài này vì thế khoá đúng một vế — VẮNG MẶT ở sảnh.
     */
    stubFetch([['/holdem/ngay', { status: 200, body: BAN_NGAY({
      toi: { match_id: 'm-x', status: 'xong' }, toi_da_xong: true,
      thu_thach: { ngay: '2026-08-17', so_nguoi_vao: 9, so_nguoi_xong: 9, nav: 12_340, hang: 2, tong: 9, top_pct: 23 },
    }) }]]);
    const onVao = vi.fn();
    const { container } = dung(<ThuThachNgayCard onVao={onVao} />);
    const the = () => container.querySelector('[data-tap="thu-thach-ngay"]');
    /*
     * ⚠ HAI VẾ, VÀ VẾ ĐẦU MỚI LÀ THỨ CHỐNG XANH GIẢ. Trong lúc query còn bay,
     * card VẪN render (trạng thái `doc`) — nên nếu chỉ hỏi "có null không" ngay
     * lập tức thì bài đậu vì lý do khác hẳn, và gỡ sạch bản vá nó vẫn xanh.
     * Cùng bẫy "vắng mặt" đã dính ở D93. Chứng minh: CÓ, rồi MẤT.
     */
    expect(the(), 'lúc đang tải card phải còn — nếu không thì bài này rỗng')
      .not.toBeNull();
    await vi.waitFor(() => {
      expect(the(), 'chơi xong rồi mà card vẫn chiếm đầu sảnh').toBeNull();
    });
    expect(screen.queryByText(/TOP 23%/)).toBeNull();
    expect(onVao).not.toHaveBeenCalled();
  });

  it('ĐANG CHƠI: nút "CHƠI TIẾP BÀN HÔM NAY", không mở phòng chờ', async () => {
    stubFetch([['/holdem/ngay', { status: 200, body: BAN_NGAY({ toi: { match_id: 'm-d', status: 'dang_choi' } }) }]]);
    const onVao = vi.fn();
    dung(<ThuThachNgayCard onVao={onVao} />);
    await screen.findByText(/CHƠI TIẾP BÀN HÔM NAY/);
    fireEvent.click(screen.getByRole('button'));
    expect(onVao).not.toHaveBeenCalled();
  });
});

describe('màn kết + phòng chờ — bàn ngày', () => {
  it('⭐ D32/A3.1: màn kết vẽ PHÂN VỊ, không tên ai; ít người ⇒ "#h · người thứ h trong N"', async () => {
    stubFetch([['/holdem/ban/q7p2z', { status: 200, body: BAN_NGAY({
      toi: { match_id: 'm-x', status: 'xong' }, toi_da_xong: true,
      thu_thach: { ngay: '2026-08-17', so_nguoi_vao: 2, so_nguoi_xong: 2, nav: 9_900, hang: 2, tong: 2, top_pct: 100 },
    }) }]]);
    dung(<DoiBan ma="q7p2z" />);
    await screen.findByText(/người thứ 2 trong 2 người đã xong/);
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.queryByText(/TOP 100%/)).toBeNull();
    expect(screen.queryByText(/ĐỘI CỦA BẠN/)).toBeNull();
    expect(screen.getByText(/RỦ BẠN CHƠI BÀN HÔM NAY/)).toBeInTheDocument();
  });

  it('màn kết khi tôi CHƯA xong (server không gửi hạng) ⇒ không bịa số', async () => {
    stubFetch([['/holdem/ban/q7p2z', { status: 200, body: BAN_NGAY() }]]);
    dung(<DoiBan ma="q7p2z" />);
    await screen.findByText(/Phân vị hiện sau khi bạn chốt xong bàn/);
    expect(screen.queryByText(/TOP /)).toBeNull();
    expect(screen.queryByText(/^#\d/)).toBeNull();
  });

  it('phòng chờ bàn ngày: nhãn THỬ THÁCH HÔM NAY · ngày, dòng CẢ SÂN (số người), KHÔNG danh sách tên', async () => {
    vi.useFakeTimers();
    try {
      stubFetch([
        ['/holdem/ban/q7p2z', { status: 200, body: BAN_NGAY() }],
        ['/holdem/matches', { status: 201, body: { match_id: 'm-n', vong: 1, tong_vong: 12, status: 'dang_choi', doi_thu: [] } }],
      ]);
      dung(<PhongCho cheDo="tu_do" soO={8} khauVi="can_bang" banMa="q7p2z" onHuy={() => {}} />);
      for (let i = 0; i < 8; i++) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      }
      expect(screen.getByText(/THỬ THÁCH HÔM NAY · 17\/08 · 12 ô/)).toBeInTheDocument();
      expect(screen.getByText(/CẢ SÂN · 4 người đã vào · 3 xong/)).toBeInTheDocument();
      expect(screen.queryByText(/ĐỘI ·/)).toBeNull();
      expect(screen.queryByText('chưa ai vào')).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});

