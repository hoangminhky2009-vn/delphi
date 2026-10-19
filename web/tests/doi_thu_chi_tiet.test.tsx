/**
 * TẤM CHI TIẾT MỘT GHẾ — và BA MỨC LỘ của nó (founder 13/09 tối muộn).
 *
 * Founder bác bảng "cả bàn" liệt kê tám dòng: *"học hỏi TFT ấy, bấm vào ai thì hiện thông
 * tin chi tiết người đó thôi"*, kèm luật lộ: số tiền ẩn TUYỆT ĐỐI · tài sản đang nắm ẩn trừ
 * khi có lõi ĐI NGƯỢC (và khi lộ thì chỉ CẦM GÌ, không CẦM BAO NHIÊU).
 *
 * ⚠ Bài này canh CẢ LỚP, không canh một ca: nó kiểm rằng màn chỉ vẽ đúng ghế được chạm, và
 * rằng không con số tiền nào của đối thủ lọt ra — kể cả khi payload có `von` (trận cũ).
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DoiThuStrip } from '@/components/holdem/DoiThuStrip';
import type { DoiThuDTO, KetQuaGheDTO } from '@/api/holdem';

const ghe = (id: string, patch: Partial<DoiThuDTO> = {}): DoiThuDTO => ({
  ghe_id: id, loai: 'bot', ten: `Máy · ${id}`, bac_rank: '—',
  con_song: true, so_the: 3, fx: 'binh_thuong', vai: 'ca_map',
  phong_cach_hang: 'B+', ...patch,
} as DoiThuDTO);

function moDai(doiThu: DoiThuDTO[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DoiThuStrip
        doiThu={doiThu}
        vongTruoc={new Map<string, KetQuaGheDTO>()}
        tenTaiSan={{ btc: 'Crypto', vang: 'Vàng' }}
      />
    </QueryClientProvider>,
  );
}

describe('tấm chi tiết một ghế', () => {
  it('⭐ chạm MỘT ghế ⇒ chỉ ghế đó hiện, không phải bảng cả bàn', () => {
    const { container } = moDai([ghe('a'), ghe('b')]);
    // Trước khi chạm: không có tấm nào.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Máy · a/ }));
    const tam = container.querySelector('[role="dialog"]')!;
    expect(tam, 'chạm ghế mà không mở tấm nào').not.toBeNull();
    expect(within(tam as HTMLElement).getByText(/Máy · a/)).toBeInTheDocument();
    // Ghế còn lại KHÔNG được kể trong tấm — đó là cả điểm của "bấm vào ai hiện người đó".
    expect(within(tam as HTMLElement).queryByText(/Máy · b/)).toBeNull();
  });

  it('⭐⭐ SỐ TIỀN của đối thủ ẩn tuyệt đối — kể cả khi payload còn `von` (trận cũ)', () => {
    const { container } = moDai([ghe('a', { von: 12345 } as Partial<DoiThuDTO>)]);
    fireEvent.click(screen.getByRole('button', { name: /Máy · a/ }));
    const tam = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(tam.textContent, 'số tiền đối thủ lọt ra màn').not.toMatch(/12[.,]?345/);
    expect(within(tam).getByText(/ẩn cả trận/)).toBeInTheDocument();
  });

  it('⭐ TÀI SẢN: khoá khi chưa có lõi ĐI NGƯỢC', () => {
    const { container } = moDai([ghe('a')]);
    fireEvent.click(screen.getByRole('button', { name: /Máy · a/ }));
    const tam = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(within(tam).getByText(/cần lõi ĐI NGƯỢC/)).toBeInTheDocument();
  });

  it('⭐ TÀI SẢN: server gửi `tai_san_thay` ⇒ hiện TÊN MÃ, và nói rõ không thấy số lượng', () => {
    const { container } = moDai([ghe('a', { tai_san_thay: ['btc', 'vang'] })]);
    fireEvent.click(screen.getByRole('button', { name: /Máy · a/ }));
    const tam = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(within(tam).getByText(/Crypto · Vàng/)).toBeInTheDocument();
    expect(within(tam).getByText(/không cho thấy cầm BAO NHIÊU/)).toBeInTheDocument();
    expect(within(tam).queryByText(/cần lõi ĐI NGƯỢC/)).toBeNull();
  });

  it('bộ dò còn sống: mặt ghế KHÔNG in tên/vai bằng chữ (đó là lý do có tấm này)', () => {
    const { container } = moDai([ghe('a')]);
    const dai = container.querySelector('[data-tap="doi-thu"]') as HTMLElement;
    expect(dai.textContent, 'tên bot quay lại mặt ghế').not.toMatch(/Máy · a/);
    expect(dai.textContent, 'vai quay lại mặt ghế').not.toMatch(/CÁ MẬP/);
  });
});
