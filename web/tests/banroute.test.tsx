/**
 * BÀN ĐẤU CÓ ĐỊA CHỈ — khóa cái vá ngày 25/07/2026.
 *
 * Ba luật, mỗi luật là một lỗi đã xảy ra thật:
 *
 *  1. **Bàn đấu KHÔNG BAO GIỜ tự tạo trận.** Bản cũ gọi `POST /holdem/matches`
 *     trong `useEffect`, nên tải lại trang giữa trận = tạo trận mới và mất sạch
 *     trận đang chơi. Test đọc danh sách call: mở màn bàn đấu mà thấy một POST
 *     `/matches` nào là VỠ.
 *
 *  2. **Tải trạng thái lỗi phải hiện LỖI, không phải skeleton.** Trước đây màn
 *     này không có nhánh lỗi nào, nên mọi thất bại đều biến thành "chờ mãi" —
 *     đúng hình dạng mà founder báo. Một màn chỉ có trạng thái "đang chờ" thì
 *     không thể phân biệt chậm với chết.
 *
 *  3. **Route thiếu mã bàn cũng phải nói ra**, không im lặng quay vòng.
 *
 * ⚠ Đừng "đơn giản hoá" test này thành kiểm chuỗi. Luật 1 kiểm PHƯƠNG PHÁP HTTP,
 * vì lỗi nằm ở chỗ có gọi POST hay không, không nằm ở chữ trên màn hình.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

/** Trận giả theo `TrangThaiDTO` — đủ để response hợp lệ, không cần render trọn màn. */
const TRAN = {
  match_id: 'm-abc',
  vong: 1,
  tong_vong: 8,
  ban: {
    von: 1000,
    luot_khao_sat: 1,
    danh_muc: { tai_san: [], chien_thuat: [] },
    da_chay: false,
    tu_the: 'choi',
    vong_roi: null,
    fx: 'binh_thuong',
  },
  doi_thu: [],
  so_nguoi_song: 1,
  o_hien_tai: null,
  lich_su_o: [],
  telegraph: null,
  bo_bai_con_lai: { con_lai: 8, so_giai_doan: 4, so_su_kien: 4, tin_gia_ky_vong: 1 },
  quy_vong_hien_tai: 0,
  shop: null,
};

describe('Bàn đấu địa chỉ hoá theo matchId', () => {
  it('LUẬT 1 — mở /arena/tran/:id KHÔNG gọi POST /matches (F5 không mất trận)', async () => {
    /*
     * Cố ý CHỈ stub `/me` + trận. Catalog/art rơi vào 401 → màn nằm ở skeleton
     * MỘT CÁCH TRUNG THỰC (`data-cho` nói đang thiếu gì). Đó là trạng thái đủ để
     * kiểm điều cần kiểm: lúc chưa có catalog, màn ĐÃ đọc trận theo id trong URL
     * và CHƯA từng gọi POST. Dựng fixture catalog đầy đủ chỉ để render trọn màn
     * sẽ làm test này phụ thuộc vào 10 hình dạng dữ liệu không liên quan tới luật.
     */
    const calls = stubFetch([
      ['/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/matches/m-abc', { status: 200, body: TRAN }],
    ]);

    const { container } = renderAt('/arena/tran/m-abc');
    /*
     * Chờ ĐÚNG skeleton của bàn đấu (`data-cho`), không phải skeleton nào cũng
     * được: AuthGate cũng dựng một cái lúc `/me` chưa về, và bắt nhầm nó thì test
     * xanh trước khi màn bàn đấu kịp chạy dòng nào.
     */
    await vi.waitFor(() => {
      expect(container.querySelector('[data-cho]')).not.toBeNull();
    }, { timeout: 5000 });
    expect(container.querySelector('[data-cho]')!.getAttribute('data-cho')).toBeTruthy();

    expect(calls.filter((c) => c.method === 'POST' && c.url.includes('/holdem/matches')))
      .toEqual([]);
    // Và nó PHẢI đọc theo đúng id trong URL, không phải id nào khác.
    expect(calls.some((c) => c.method === 'GET' && c.url.includes('/holdem/matches/m-abc')))
      .toBe(true);
  });

  it('LUẬT 2 — GET trạng thái lỗi → hiện lỗi + nút ra, KHÔNG treo skeleton', async () => {
    stubFetch([
      ['/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: { assets: [], tactics: [], tu_dien: [] } }],
      ['/holdem/art', { status: 200, body: {} }],
      ['/holdem/matches/m-die', { status: 404, body: { error: 'not_found', message: 'Không có trận.' } }],
    ]);

    renderAt('/arena/tran/m-die');

    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toBeTruthy();
    // Phải có đường ra — màn cụt là lỗi thiết kế, không phải lỗi mạng.
    expect(screen.getByText(/VỀ SẢNH/)).toBeTruthy();
    expect(screen.getByText(/THỬ LẠI/)).toBeTruthy();
  });

  it('LUẬT 3 — /arena/tran trần (không id) → về sảnh, không tạo trận', async () => {
    const calls = stubFetch([
      ['/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: { assets: [], tactics: [], tu_dien: [] } }],
      ['/holdem/art', { status: 200, body: {} }],
    ]);

    renderAt('/arena/tran');
    await new Promise((r) => setTimeout(r, 60));

    expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
  });
});
