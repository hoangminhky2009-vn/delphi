/**
 * BÀN CHUNG THEO SEED — phía client (16/08, đề xuất `moi-ban-vao-doi.md` A).
 *   · sảnh: card TẠO PHÒNG khoá thành RỦ BẠN CÙNG BÀN; phát mã ⇒ mã hiện to;
 *     VÀO BÀN gửi ĐÚNG `ban_ma` (server là nguồn seed — C4);
 *   · nhập mã ⇒ POST /holdem/matches {ban_ma}; 409 `da_vao_ban` ⇒ về trận cũ
 *     (không báo lỗi cho một việc đã xong);
 *   · link `/arena/ban/<mã>` ⇒ tự thử vào một lần;
 *   · màn kết: khối ĐỘI đọc /holdem/ban/:ma và tôn cờ server (số người khác
 *     chỉ hiện khi server gửi — client không tự suy A3.1).
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/api/queries';
import { DoiBan } from '../src/components/holdem/DoiBan';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

const CATALOG = {
  engine_version: 'x', balance_version: 'x',
  luat: {
    SEATS: 5, START_VON: 10000, CAM_KET_NEN: 500, MAX_TAI_SAN: 4, MAX_CHIEN_THUAT: 2,
    SHOP_TAI_SAN: 3, SHOP_CHIEN_THUAT: 2, CHI_PHI_KHAO_SAT_LAI: 2, TRAN_TANG_CAM_KET_BP: 4000,
    PHI_BANG_DIEN_TU: 25,
  },
  nhip_chon_bai: ['tai_san', 'tai_san', 'chien_thuat', 'tai_san', 'tai_san', 'chien_thuat', 'khong', 'khong'],
  cap_stack_bp: [10000, 16000, 20000],
  quyet_dinh: { MAP_SIZE: 8, SHOWDOWN_MODEL: 'A', MAN_TAP_MIEN_GIO_DEN_VONG: 4, CO_MAP_CHON: [8, 12, 16] },
  tai_san: [{ id: 'btc', label: 'BTC', icon: '₿', nhom: 'rui_ro', thanh_khoan: 'mong', bien_dong_bp: 400 }],
  chien_thuat: [], giai_doan: [{ id: 'di_ngang', label: 'Đi ngang', icon: '➖' }], su_kien: [],
  tu_dien: { tai_san: {}, chien_thuat: {} },
  khau_vi: [{ id: 'can_bang', label: 'Cân bằng', he_so_pnl_bp: 10000, mo_ta: '' }],
};
/** Trận tối thiểu đủ để màn trận dựng (mượn fixture coach_dong_ho). */
const TRAN = {
  match_id: 'm-ban-1', vong: 1, tong_vong: 12, status: 'dang_choi', ban_ma: 'k9x2m',
  dong_ho: { con_lai_s: 25, tong_s: 25, het_gio: false, an_han_s: 8 },
  ban: {
    von: 10000, luot_khao_sat: 1, danh_muc: { tai_san: [], chien_thuat: [] }, da_chay: false,
    tu_the: 'choi', vong_roi: null, so_lan_cat_lo: 0, con_lai_cat_lo: 1, khau_vi: 'can_bang',
    fx: 'binh_thuong',
  },
  doi_thu: [], so_nguoi_song: 1, o_hien_tai: { kind: 'giai_doan', giai_doan: 'di_ngang' },
  lich_su_o: [], telegraph: null,
  bo_bai_con_lai: { con_lai: 7, so_giai_doan: 3, so_su_kien: 2, tin_gia_ky_vong: 1 },
  quy_vong_hien_tai: 500, shop: null, loi_von: null,
};

describe('sảnh — RỦ BẠN CÙNG BÀN', () => {
  it('card cũ TẠO PHÒNG khoá không còn; phát mã ⇒ mã hiện to; VÀO gửi đúng ban_ma', async () => {
    const calls = stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: CATALOG }],
      ['/holdem/me/matches', { status: 200, body: { tran: [] } }],
      // Đặt mẫu CỤ THỂ trước mẫu chung: phòng chờ GET /holdem/ban/k9x2m (bảng đội).
      ['/holdem/ban/k9x2m', { status: 200, body: { ma: 'k9x2m', so_o: 12, het_han: 'x', created_at: 'x', chu: 'me', la_chu: true, so_nguoi: 0, toi: null, toi_da_xong: false, doi: [] } }],
      ['/holdem/ban', { status: 201, body: { ma: 'k9x2m', so_o: 12, het_han: '2026-08-17T00:00:00Z' } }],
      ['/holdem/matches/m-ban-1', { status: 200, body: TRAN }],
      ['/holdem/matches', { status: 201, body: TRAN }],
      ['/holdem/art', { status: 200, body: { version: 'x', art: {} } }],
    ]);
    renderAt('/arena');
    // 11/10 (sảnh bento): RỦ BẠN là ô → LỚP TRƯỢT (ruột mở sẵn, không còn nút xổ "RỦ BẠN CÙNG BÀN ▾").
    const oRu = await waitFor(() => { const e = document.querySelector('[data-o="ru"]'); expect(e).toBeTruthy(); return e as HTMLElement; });
    expect(screen.queryByText('TẠO PHÒNG')).toBeNull();
    fireEvent.click(oRu);
    expect(await screen.findByText(/RỦ BẠN CÙNG BÀN/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('12 Ô'));
    fireEvent.click(screen.getByText(/PHÁT MÃ BÀN/));
    expect(await screen.findByText('K9X2M')).toBeInTheDocument();
    const taoBan = calls.find((c) => c.url.includes('/holdem/ban') && c.method === 'POST');
    expect((taoBan!.body as { so_o: number }).so_o).toBe(12);
    fireEvent.click(screen.getByText(/VÀO BÀN NÀY/));
    // 16/08 — VÀO đi qua PHÒNG CHỜ: "đang xếp bàn" trước, POST sau nhịp TÌM (1,6s).
    expect(await screen.findByLabelText('Phòng chờ')).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith('/holdem/matches') && c.method === 'POST')).toBeUndefined();
    await waitFor(() => {
      const vao = calls.find((c) => c.url.endsWith('/holdem/matches') && c.method === 'POST');
      expect((vao!.body as { ban_ma: string }).ban_ma).toBe('k9x2m');
    }, { timeout: 4000 });
  });

  it('nhập mã bạn gửi ⇒ POST /matches {ban_ma}; 409 da_vao_ban ⇒ về trận cũ, không báo lỗi', async () => {
    const calls = stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: CATALOG }],
      ['/holdem/me/matches', { status: 200, body: { tran: [] } }],
      ['/holdem/matches/m-cu', { status: 200, body: { ...TRAN, match_id: 'm-cu' } }],
      ['/holdem/art', { status: 200, body: { version: 'x', art: {} } }],
      ['/holdem/matches', { status: 409, body: { error: 'da_vao_ban', message: 'Bạn đã có trận ở bàn này.', match_id: 'm-cu' } }],
    ]);
    renderAt('/arena');
    fireEvent.click(await waitFor(() => { const e = document.querySelector('[data-o="ru"]'); expect(e).toBeTruthy(); return e as HTMLElement; }));
    const o = (await screen.findByLabelText('Mã bàn')) as HTMLInputElement;
    fireEvent.change(o, { target: { value: 'AB-1c2' } });   // lọc ký tự lạ, cắt 5
    expect(o.value).toBe('AB1c2');
    fireEvent.click(screen.getByRole('button', { name: 'VÀO' }));
    await waitFor(() => {
      const vao = calls.find((c) => c.url.endsWith('/holdem/matches') && c.method === 'POST');
      expect((vao!.body as { ban_ma: string }).ban_ma).toBe('ab1c2');
    }, { timeout: 4000 });
    // 409 ⇒ điều hướng về trận cũ: màn trận được gọi.
    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('/holdem/matches/m-cu'))).toBe(true);
    }, { timeout: 4000 });
    expect(screen.queryByText(/Chưa vào được bàn|Mã bàn là 5 ký tự/)).toBeNull();
  });

  it('link mời /arena/ban/<mã> ⇒ tự thử vào một lần với đúng mã', async () => {
    const calls = stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: CATALOG }],
      ['/holdem/me/matches', { status: 200, body: { tran: [] } }],
      ['/holdem/matches/m-ban-1', { status: 200, body: TRAN }],
      ['/holdem/matches', { status: 201, body: TRAN }],
      ['/holdem/art', { status: 200, body: { version: 'x', art: {} } }],
    ]);
    renderAt('/arena/ban/K9X2M');
    await waitFor(() => {
      const vao = calls.filter((c) => c.url.endsWith('/holdem/matches') && c.method === 'POST');
      expect(vao).toHaveLength(1);
      expect((vao[0]!.body as { ban_ma: string }).ban_ma).toBe('k9x2m');
    }, { timeout: 4000 });
  });
});

describe('màn kết — khối ĐỘI CỦA BẠN', () => {
  const dung = (ma: string | null) => render(
    <QueryClientProvider client={makeQueryClient()}><DoiBan ma={ma} /></QueryClientProvider>,
  );

  it('không phải bàn chung ⇒ IM (không khối rỗng)', () => {
    stubFetch([]);
    dung(null);
    expect(screen.queryByLabelText('Đội của bạn')).toBeNull();
  });

  it('tôn cờ server: người có số thì hiện số, người chưa lộ thì "số lộ khi bạn chốt bàn"', async () => {
    stubFetch([
      ['/holdem/ban/k9x2m', {
        status: 200,
        body: {
          ma: 'k9x2m', so_o: 12, het_han: 'x', created_at: 'x', chu: 'an', la_chu: false,
          so_nguoi: 3, toi: { match_id: 'm', status: 'dang_choi' }, toi_da_xong: false,
          doi: [
            { handle: 'an', la_toi: false, xong: true, dang_choi: false },
            { handle: 'binh', la_toi: true, xong: false, dang_choi: true },
            { handle: 'chi', la_toi: false, xong: false, dang_choi: true },
          ],
        },
      }],
    ]);
    dung('k9x2m');
    expect(await screen.findByText(/ĐỘI CỦA BẠN · BÀN K9X2M/)).toBeInTheDocument();
    // Đầu khối render TRƯỚC khi có data — chờ dòng đội đầu tiên (không hỏi đồng bộ).
    expect(await screen.findByText(/xong · số lộ khi bạn chốt bàn/)).toBeInTheDocument();
    expect(screen.getByText('binh (bạn)')).toBeInTheDocument();
    expect(screen.getAllByText(/đang chơi…/)).toHaveLength(2);
    expect(screen.getByText(/Số của người khác hiện sau khi bạn chốt xong bàn/)).toBeInTheDocument();
  });
});
