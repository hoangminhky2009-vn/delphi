/**
 * D402 — `chotPhien().chiaQuy` CỘNG DỒN qua MỌI pot. Pot phụ chỉ xuất hiện khi có người tất tay ít hơn phần nền, nên
 * bài qua endpoint (`chia_quy_vong_api.test.ts`) chơi trận thường có thể không bao giờ gặp — tiêm lỗi 24/09 bắt đúng lỗ
 * ấy: bỏ cộng dồn mà bài API vẫn xanh. Bài này DỰNG ca pot phụ: một ghế vốn nhỏ tất tay ⇒ pot chính (cả bàn) + pot phụ
 * (các ghế còn lại); ghế đứng đầu nhận từ CẢ HAI pot, nên tổng phần chia chỉ bằng giải khi được cộng đủ.
 */
import { describe, expect, it } from 'vitest';
import { giaiQuyetVong, taoTran, type GheMoi } from '../server/holdem/engine.js';

function ghe(id: string, taiSan: string[]): GheMoi {
  return { id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: taiSan, chien_thuat: [] as never } };
}
const THEO_HET = () => ({ loai: 'theo' as const });

describe('D402 — phần quỹ từng ghế cộng dồn qua pot phụ', () => {
  it('⭐ có pot phụ: tổng phần chia = giải, hạng 1…k liền, mọi phần là số nguyên dương', () => {
    let soCaPotPhu = 0;
    for (let seed = 0; seed < 200 && soCaPotPhu < 8; seed += 1) {
      for (const nho of [120, 260, 380]) {
        const st0 = taoTran(seed, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd']), ghe('d', ['vn30'])]);
        const st = { ...st0, ghe: st0.ghe.map((g) => (g.id === 'a' ? { ...g, von: nho } : g)) };
        const r = giaiQuyetVong(st, THEO_HET);
        if (r.ketQua.so_pot < 2) continue;
        soCaPotPhu += 1;
        const chia = r.chiaQuy ?? [];
        expect(chia.length, `seed ${seed} vốn ${nho}: có pot mà không ai nhận`).toBeGreaterThan(0);
        expect(chia.reduce((a, c) => a + c.tien, 0), `seed ${seed} vốn ${nho}: phần chia không cộng dồn đủ các pot`)
          .toBe(r.ketQua.quy_vong);
        expect(chia.map((c) => c.hang)).toEqual(chia.map((_, i) => i + 1));
        expect(chia.every((c) => Number.isInteger(c.tien) && c.tien > 0)).toBe(true);
      }
    }
    expect(soCaPotPhu, 'không dựng được ca pot phụ nào — bài rỗng').toBeGreaterThan(0);
  });

  it('không pot phụ: phần chia vẫn = giải (bàn thường)', () => {
    const r = giaiQuyetVong(taoTran(7, [ghe('a', ['btc']), ghe('b', ['vang']), ghe('c', ['usd'])]), THEO_HET);
    expect(r.ketQua.so_pot).toBe(1);
    expect((r.chiaQuy ?? []).reduce((a, c) => a + c.tien, 0)).toBe(r.ketQua.quy_vong);
  });
});
