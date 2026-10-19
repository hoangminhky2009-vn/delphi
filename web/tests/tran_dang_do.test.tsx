/**
 * SẢNH — thẻ "TIẾP TỤC TRẬN ĐANG DỞ" (D93 3/3).
 *
 * Thẻ có từ 11/08 (99c61be) mà tới 16/08 KHÔNG bài test nào chạm — đúng lớp
 * "cơ chế trang trí" ở dạng khó thấy nhất: nó chạy, chỉ là không ai canh. Ba
 * tính chất, qua ROUTE THẬT `/arena`:
 *   1. Có trận `dang_choi` + `tiep_duoc` ⇒ thẻ hiện, ghi đúng vòng.
 *   2. `dang_choi` nhưng `tiep_duoc: false` (quá hạn, chưa tick quét) ⇒ KHÔNG
 *      hiện — mời bàn chết là dẫn người ta vào 409.
 *   3. Không trận nào ⇒ không thẻ. (API cũ không có `tiep_duoc` ⇒ rơi về status.)
 */
import { describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch, type RecordedCall } from './helpers';

const CATALOG = {
  engine_version: 'holdem-test-dd', balance_version: 'balance-test',
  luat: {}, nhip_chon_bai: [], cap_stack_bp: [10000, 16000, 20000],
  quyet_dinh: { MAP_SIZE: 8, CO_MAP_CHON: [8, 12, 16] },
  tai_san: [], chien_thuat: [], giai_doan: [], su_kien: [],
  tu_dien: { tai_san: {}, chien_thuat: {} },
  khau_vi: [{ id: 'can_bang', label: 'Cân bằng', mo_ta: '' }],
};

const moSanh = (tran: unknown[]) => stubFetch([
  ['/auth/me', { status: 200, body: ME_ONBOARDED }],
  ['/holdem/catalog', { status: 200, body: CATALOG }],
  ['/holdem/me/matches', { status: 200, body: { tran } }],
  ['/holdem/me/rank', { status: 200, body: {} }],
]);

/*
 * ⚠ KHẲNG ĐỊNH "VẮNG MẶT" PHẢI CHỜ QUERY VỀ — bài học tiêm lỗi 16/08: bản đầu
 * dùng `waitFor(() => expect(queryByTestId(...)).toBeNull())` — nó ĐẬU NGAY ở
 * lần thử đầu vì lúc đó query `/me/matches` còn đang bay và thẻ chưa kịp hiện.
 * Gỡ hẳn bộ lọc `tiep_duoc` ở sảnh mà bài vẫn xanh: một bài xanh mãi mãi mà
 * chưa từng chạm thứ nó mang tên (D62). Nay: chờ tới khi fetch `/me/matches`
 * ĐÃ ĐƯỢC GỌI, rồi nhả một nhịp cho react-query áp kết quả + React vẽ, rồi mới
 * hỏi "thẻ có không".
 */
async function choTranDoVe(calls: RecordedCall[]): Promise<void> {
  await waitFor(() => expect(calls.some((c) => c.url.includes('/holdem/me/matches'))).toBe(true));
  await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
}

describe('sảnh — TIẾP TỤC TRẬN ĐANG DỞ', () => {
  it('có trận dang_choi + tiep_duoc ⇒ thẻ hiện, ghi đúng vòng', async () => {
    moSanh([{ match_id: 'm-1', status: 'dang_choi', vong_hien_tai: 5, started_at: '', ended_at: null, tiep_duoc: true }]);
    renderAt('/arena');
    const the = await screen.findByTestId('tiep-tuc-tran');
    // 11/10 (demo CHỐT): ô chính của sảnh bento nói "BÀN ĐANG DỞ" + chip "VÒNG 5" (chữ cũ "TIẾP TỤC TRẬN ĐANG DỞ" + "vòng 5" đã đổi theo demo).
    expect(the.textContent).toContain('BÀN ĐANG DỞ');
    expect(the.textContent).toContain('VÒNG 5');
  });

  it('⭐ dang_choi nhưng tiep_duoc=false (quá hạn, chưa quét) ⇒ KHÔNG mời — mời là dẫn vào 409', async () => {
    const calls = moSanh([{ match_id: 'm-2', status: 'dang_choi', vong_hien_tai: 3, started_at: '', ended_at: null, tiep_duoc: false }]);
    renderAt('/arena');
    await screen.findByTestId('sanh-man-tap'); // 11/10: sảnh bento — ô MÀN TẬP (mốc "sảnh đã vẽ"), không còn dòng chữ dài
    await choTranDoVe(calls);
    expect(screen.queryByTestId('tiep-tuc-tran')).toBeNull();
  });

  it('API cũ không có tiep_duoc ⇒ rơi về status (không làm mất thẻ của bản cũ)', async () => {
    moSanh([{ match_id: 'm-3', status: 'dang_choi', vong_hien_tai: 2, started_at: '', ended_at: null }]);
    renderAt('/arena');
    expect(await screen.findByTestId('tiep-tuc-tran')).toBeInTheDocument();
  });

  it('chỉ trận đã xong ⇒ không thẻ', async () => {
    const calls = moSanh([{ match_id: 'm-4', status: 'ket_thuc', vong_hien_tai: 8, started_at: '', ended_at: 'x', tiep_duoc: false }]);
    renderAt('/arena');
    await screen.findByTestId('sanh-man-tap'); // 11/10: sảnh bento — ô MÀN TẬP (mốc "sảnh đã vẽ"), không còn dòng chữ dài
    await choTranDoVe(calls);
    expect(screen.queryByTestId('tiep-tuc-tran')).toBeNull();
  });
});
