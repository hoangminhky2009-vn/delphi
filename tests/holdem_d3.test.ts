/**
 * D3 — ĐÁM ĐÔNG ĐO BẰNG TỶ LỆ LOBBY.
 *
 * Cụm này mở bàn 4–8 người. Trước nó, mọi ngưỡng đám đông đếm ĐẦU NGƯỜI tuyệt
 * đối (`phat ∝ dong − 1`), nghĩa là cỡ bàn tự nó đổi cân bằng: bàn 8 phạt gấp
 * hơn hai lần bàn 4 cho cùng hành vi dồn mã. Mở 4–8 mà không chuẩn hoá = phát
 * hành năm game có cân bằng khác nhau, và gate Monte Carlo đo ở cỡ nào cũng
 * không nói được gì về cỡ còn lại.
 *
 * HAI LUẬT PHẢI GIỮ, và luật 1 là luật CHỊU LỰC:
 *   1. Ở BÀN 5 GHẾ (bàn quy chiếu), công thức mới ra ĐÚNG số cũ tới từng bp.
 *      Nhờ vậy D3 không nuốt mất cân bằng D1 vừa mất 15 vòng đo mới đạt.
 *   2. Cùng TỶ LỆ dồn thì cùng mức phạt, bất kể bàn to hay nhỏ.
 */
import { describe, expect, it } from 'vitest';
import {
  DONG_QUY_CHIEU, DO_SAU_L, HE_SO_TAC_DONG_K, dongQuyDoi, tyLeDongBp,
} from '../config/holdem.js';

/** Công thức CŨ, chép nguyên văn để làm mốc đối chiếu. */
const phatCu = (dong: number, L: number) => Math.floor((HE_SO_TAC_DONG_K * (dong - 1) * 10000) / L);
/** Công thức MỚI. */
const phatMoi = (dong: number, songSot: number, L: number) =>
  Math.floor((HE_SO_TAC_DONG_K * DONG_QUY_CHIEU * tyLeDongBp(dong, songSot)) / L);

describe('D3 — chuẩn hoá áp lực đám đông', () => {
  it('LUẬT 1 (chịu lực) — bàn 5 ghế: mới ≡ cũ tới từng bp, mọi hạng thanh khoản', () => {
    for (const L of [DO_SAU_L.mong, DO_SAU_L.vua, DO_SAU_L.day]) {
      for (let dong = 1; dong <= 5; dong += 1) {
        expect(phatMoi(dong, 5, L), `dong=${dong} L=${L}`).toBe(phatCu(dong, L));
      }
    }
  });

  it('LUẬT 2 — cùng tỷ lệ dồn → cùng phạt, bất kể cỡ bàn', () => {
    const L = DO_SAU_L.vua;
    // "Cả bàn dồn một mã" ở bàn 3, 5, 9 → phải ra cùng một khoản phạt.
    expect(phatMoi(3, 3, L)).toBe(phatMoi(5, 5, L));
    expect(phatMoi(5, 5, L)).toBe(phatMoi(9, 9, L));
    // "Một nửa bàn dồn" cũng vậy (chọn cỡ chia hết để không lẫn sai số floor).
    expect(phatMoi(3, 5, L)).toBe(phatMoi(5, 9, L));
  });

  it('cỡ bàn KHÔNG còn tự đổi độ khó: cũ thì lệch, mới thì không', () => {
    const L = DO_SAU_L.vua;
    // Bằng chứng lỗi cũ tồn tại thật: cả bàn dồn ở bàn 8 bị phạt hơn bàn 4 nhiều.
    expect(phatCu(8, L)).toBeGreaterThan(phatCu(4, L) * 2);
    // Và bằng chứng nó đã hết.
    expect(phatMoi(8, 8, L)).toBe(phatMoi(4, 4, L));
  });

  it('chỉ mình mình nắm → không có áp lực nào', () => {
    expect(tyLeDongBp(1, 5)).toBe(0);
    expect(tyLeDongBp(0, 5)).toBe(0);
    // Bàn còn 1 người (mọi người cháy hết) → không chia cho 0.
    expect(tyLeDongBp(1, 1)).toBe(0);
    expect(tyLeDongBp(2, 1)).toBe(0);
  });

  it('dongQuyDoi trả lại đúng đầu người ở bàn quy chiếu (bảng tra khỏi viết lại)', () => {
    for (let dong = 1; dong <= 5; dong += 1) expect(dongQuyDoi(dong, 5)).toBe(dong);
    // Cả bàn dồn ở mọi cỡ → luôn quy về "5 người ở bàn 5 ghế".
    expect(dongQuyDoi(4, 4)).toBe(5);
    expect(dongQuyDoi(8, 8)).toBe(5);
  });
});
