/**
 * LẦN ĐẦU VÀO ĐẤU TRƯỜNG ⇒ VÀO THẲNG MÀN TẬP (D336 lượt 2, founder 15/09).
 *
 * Nguyên văn: *"khi bấm vào chọn alpha draft ở sảnh lần đầu tiên thì user sẽ được điều ngay vào phòng
 * tập, sau khi hoàn thành hoặc bỏ qua thì sẽ ko còn bị điều hướng nữa, ai muốn chơi lại thì lướt xuống
 * cuối."*
 *
 * Bốn điều canh, qua ROUTE THẬT `/arena`:
 *  I.  bảng quyết định thuần (`quyetDinhVaoSanh`) — vector tay, gồm các cửa KHÔNG kéo;
 *  II. người mới tinh ⇒ dựng bàn tập (`tap: true`) và vào thẳng, không vẽ sảnh; nhớ id bàn;
 *  III. đã qua (máy ghi) / đã có trận xong (server) / tới vì link bàn ⇒ sảnh bình thường;
 *  IV. sảnh: MÀN TẬP đứng CUỐI (sau RỦ BẠN), card thử thách không còn đoạn mô tả.
 * Tiêm lỗi: (a) bỏ `if (b.soTranXong > 0)` ⇒ III-2 đỏ; (b) bỏ `b.coViecKhac` ⇒ III-3 đỏ;
 * (c) trả MÀN TẬP về chỗ cũ (ngay dưới thẻ thử thách) ⇒ IV đỏ.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { routes } from '@/app/routes';
import { makeQueryClient } from '@/api/queries';
import { quyetDinhVaoSanh, type BoiCanhVaoSanh } from '@/lib/man_tap_dau';
import { ME_ONBOARDED, stubFetch } from './helpers';

const CHO = { timeout: 4000 };

const CATALOG = {
  engine_version: 'holdem-test-mtd', balance_version: 'balance-test',
  luat: {}, nhip_chon_bai: [], cap_stack_bp: [10000, 16000, 20000],
  quyet_dinh: { MAP_SIZE: 12, CO_MAP_CHON: [8, 12, 16] },
  tai_san: [], chien_thuat: [], giai_doan: [], su_kien: [],
  tu_dien: { tai_san: {}, chien_thuat: {} },
  khau_vi: [{ id: 'can_bang', label: 'Cân bằng', mo_ta: '' }],
};

function dung(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const sanh = (soTranXong: number, tran: unknown[] = []) => stubFetch([
  ['/auth/me', { status: 200, body: ME_ONBOARDED }],
  ['/holdem/catalog', { status: 200, body: CATALOG }],
  ['/holdem/me/matches', { status: 200, body: { tran } }],
  ['/holdem/me/tien-do', { status: 200, body: { so_tran_xong: soTranXong, co_map: [8, 12, 16], khau_vi: soTranXong >= 3, con_thieu: {} } }],
  ['/holdem/matches/m-tap', { status: 404, body: { error: 'khong_thay', message: 'x' } }],
  ['/holdem/matches', { status: 201, body: { match_id: 'm-tap', vong: 1, tong_vong: 12, status: 'dang_choi', doi_thu: [] } }],
]);

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { window.localStorage.clear(); });

// ─── I. BẢNG QUYẾT ĐỊNH ────────────────────────────────────────────────────
describe('I. quyetDinhVaoSanh — ai bị dắt vào bàn tập', () => {
  const NEN: BoiCanhVaoSanh = { daQuaMay: false, soTranXong: 0, tranMo: [], tranTap: null, coViecKhac: false };
  const ca: [string, Partial<BoiCanhVaoSanh>, string][] = [
    ['người mới tinh', {}, 'tao_tap'],
    ['máy đã ghi "đã qua" (xong / bỏ qua)', { daQuaMay: true }, 'sanh'],
    ['tới vì link bàn / ép seed / buổi đo', { coViecKhac: true }, 'sanh'],
    ['server chưa trả số mới', { soTranXong: undefined }, 'cho'],
    ['server hỏi lỗi — không đoán', { soTranXong: null }, 'sanh'],
    ['trận đang dở hỏi lỗi — không đoán', { tranMo: null }, 'sanh'],
    ['đã có trận xong (người chơi cũ, cả trước luật này)', { soTranXong: 2 }, 'sanh'],
    ['đang dở CHÍNH bàn tập đã dắt vào', { tranTap: 'm-t', tranMo: [{ match_id: 'm-t', tiep_duoc: true }] }, 'tiep_tap'],
    ['đang dở một trận KHÁC ⇒ sảnh có thẻ TIẾP TỤC', { tranMo: [{ match_id: 'm-khac', tiep_duoc: true }] }, 'sanh'],
    ['bàn tập đã nhớ nhưng hết hạn ⇒ dựng bàn mới', { tranTap: 'm-t', tranMo: [{ match_id: 'm-t', tiep_duoc: false }] }, 'tao_tap'],
  ];
  for (const [ten, them, ra] of ca) {
    it(`${ten} ⇒ ${ra}`, () => {
      expect(quyetDinhVaoSanh({ ...NEN, ...them }).loai).toBe(ra);
    });
  }

  it('người chơi cũ ⇒ ghi "da_choi" để lần sau khỏi hỏi', () => {
    expect(quyetDinhVaoSanh({ ...NEN, soTranXong: 5 })).toEqual({ loai: 'sanh', ghi: 'da_choi' });
  });
});

// ─── II. NGƯỜI MỚI TINH ────────────────────────────────────────────────────
describe('II. Người mới tinh vào Đấu trường ⇒ vào thẳng bàn tập', () => {
  it('⭐⭐ dựng bàn tập (`tap: true`), vào `/arena/tran/<id>?tap=1`, nhớ id — không vẽ sảnh', async () => {
    const calls = sanh(0);
    const router = dung('/arena');
    await waitFor(() => expect(router.state.location.pathname).toBe('/arena/tran/m-tap'), CHO);
    expect(router.state.location.search).toBe('?tap=1');
    const tao = calls.filter((c) => c.method === 'POST' && c.url.includes('/holdem/matches'));
    expect(tao).toHaveLength(1);
    expect(tao[0]!.body).toMatchObject({ tap: true });
    expect(window.localStorage.getItem('delphi:man-tap:tran')).toBe('m-tap');
  });
});

// ─── III. KHÔNG KÉO ────────────────────────────────────────────────────────
describe('III. Các cửa KHÔNG kéo vào bàn tập', () => {
  const khongTao = (calls: { method: string; url: string }[]) =>
    calls.filter((c) => c.method === 'POST' && c.url.includes('/holdem/matches'));

  it('⭐ 1. đã bỏ qua / đã xong (máy ghi) ⇒ sảnh, không dựng trận', async () => {
    window.localStorage.setItem('delphi:man-tap:da-qua', 'bo_qua');
    const calls = sanh(0);
    const router = dung('/arena');
    expect(await screen.findByTestId('sanh-man-tap', {}, CHO)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/arena');
    expect(khongTao(calls)).toHaveLength(0);
  });

  it('⭐⭐ 2. đã có trận xong ở server (người chơi cũ, máy mới) ⇒ sảnh, và máy ghi "da_choi"', async () => {
    const calls = sanh(4);
    dung('/arena');
    expect(await screen.findByTestId('sanh-man-tap', {}, CHO)).toBeInTheDocument();
    expect(khongTao(calls)).toHaveLength(0);
    await waitFor(() => expect(window.localStorage.getItem('delphi:man-tap:da-qua')).toBe('da_choi'), CHO);
  });

  it('⭐ 3. tới vì link mời bàn (buổi đo cả lớp đang chờ) ⇒ không kéo đi đâu', async () => {
    const calls = sanh(0);
    const router = dung('/arena/ban/lop01');
    expect(await screen.findByTestId('sanh-man-tap', {}, CHO)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/arena/ban/lop01');
    expect(khongTao(calls)).toHaveLength(0);
  });
});

// ─── IV. BỐ CỤC SẢNH ───────────────────────────────────────────────────────
describe('IV. Sảnh: MÀN TẬP ở cuối, sau mọi chế độ chơi', () => {
  it('⭐ MÀN TẬP đứng SAU ô "RỦ BẠN" và sau ĐẤU VỚI MÁY / XẾP HẠNG — ô cuối của bốn ô chế độ (không còn ngay dưới thẻ thử thách)', async () => {
    /*
     * VIẾT LẠI 11/10 (sảnh bento, SPEC `alpha-draft-tang-khong-gian`): bài cũ đo thứ tự DÒNG CHỮ ("RỦ BẠN CÙNG BÀN" · "ĐẤU VỚI MÁY" · "MÀN TẬP —
     * HỌC BẰNG CÁCH CHƠI"). Sảnh nay là lưới ô: nhãn ngắn, chữ dài nằm trong lớp trượt. Luật giữ nguyên — MÀN TẬP là ô CUỐI, ai muốn tập lại
     * thì vào đó; người mới được dắt thẳng vào bàn tập (II) nên không cần tìm.
     */
    window.localStorage.setItem('delphi:man-tap:da-qua', 'xong');
    sanh(0);
    dung('/arena');
    const tap = await screen.findByTestId('sanh-man-tap', {}, CHO);
    const o = (d: string) => document.querySelector(`[data-o="${d}"]`) as HTMLElement;
    for (const truoc of ['ru', 'may', 'xep']) {
      // DOCUMENT_POSITION_FOLLOWING (4): `tap` đứng sau ô `truoc` trong cây DOM.
      expect(o(truoc).compareDocumentPosition(tap) & Node.DOCUMENT_POSITION_FOLLOWING, `MÀN TẬP phải đứng sau ô ${truoc}`).toBeTruthy();
    }
  });
});
