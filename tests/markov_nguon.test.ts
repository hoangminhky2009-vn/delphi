/**
 * MARKOV THEO NGUYÊN NHÂN v35 (D159) — độ lì chuỗi đọc theo NGUỒN mở chuỗi,
 * sau cổng `markovNguon` (founder D152: *"uptrend từ tiền rẻ hay tin tốt thật
 * đi DÀI hơn, uptrend từ tin tức đi NGẮN hơn"*).
 *
 * Hai đòn bẩy (KHÔNG phải hệ số nhân đơn thuần — bản đầu đo ra trang trí,
 * 1,70→1,71): nguồn LÌ = ngưỡng chuỗi 1 + biên ×2,5 · nguồn MAU TÀN = hazard
 * chủ động lên mặt đảo chiều. Đo 1200 seed sau vá: tin-giả 1,34 < trung-tính
 * 1,50 < tiền-rẻ 1,84 (trước cần gạt tin-giả 1,62 > trung-tính — v34 đang
 * thưởng nhầm hype). Nhãn nguồn LATENT — không trang_thai, không DTO (§7).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BO_LUAT_THEO_PHIEN_BAN, MARKOV_NGUON, luatCua } from '../config/holdem.js';
import { taoTran, type GheMoi } from '../server/holdem/engine.js';

const ghe = (n: number): GheMoi[] => Array.from({ length: n }, (_, i) => ({
  id: `g${i}`, loai: 'bot' as const, bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: [] },
}));
const kyMap = (seed: number, luat: Parameters<typeof taoTran>[2]) =>
  JSON.stringify(taoTran(seed, ghe(4), luat, 12).map);

describe('I. Cổng', () => {
  it('⭐⭐ markovNguon = false ở TỪNG entry trừ v35', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      /*
       * ⚠ THƯỚC ĐÚNG LÀ "KHÔNG BẬT HỒI TỐ", KHÔNG PHẢI "CHỈ MỘT PHIÊN BẢN".
       * Bản đầu chốt `=== 'balance-v35-chuoi'`, nên MỖI LẦN thêm một
       * phiên bản kế thừa (v37…) là bài này đỏ dù không có gì hỏng — mà một bài
       * đỏ vì lý do sai thì sẽ bị nới bừa cho qua (D79). Điều thật sự phải giữ:
       * phiên bản CŨ HƠN mốc không bao giờ được bật, vì đó mới là cú đổi
       * replay của trận đã lưu.
       */
      const soCua = (t: string) => Number(/balance-v(\d+)/.exec(t)?.[1] ?? 0);
      const moc = soCua('balance-v35-chuoi');
      if (soCua(ten) < moc) {
        expect(luat.markovNguon, `phiên bản CŨ "${ten}" bật cờ ⇒ đổi map trận đã lưu`)
          .not.toBe(true);
      } else {
        expect(luat.markovNguon, `phiên bản "${ten}" từ mốc trở đi phải bật`).toBe(true);
      }
    }
    expect(luatCua('phien-ban-khong-ton-tai').markovNguon).toBe(false);
  });

  it('phân lớp nguồn PHỦ KÍN và KHÔNG GIAO — nguồn rơi giữa hai lớp là mất luật im lặng', () => {
    const li = new Set<string>(MARKOV_NGUON.NGUON_LI);
    const tan = new Set<string>(MARKOV_NGUON.NGUON_MAU_TAN);
    for (const n of li) expect(tan.has(n), `${n} nằm cả hai lớp`).toBe(false);
    expect([...li, ...tan].sort())
      .toEqual(['chinh_sach_that', 'hoang_loan', 'tien_re', 'tin_don']);
  });
});

describe('II. Cơ chế sống — cô lập đúng MỘT cần gạt', () => {
  it('⭐⭐ v35 vs v35∖markovNguon phải KHÁC được (map 12, 80 seed)', () => {
    const v35 = luatCua('balance-v35-chuoi');
    const tat = { ...v35, markovNguon: false };
    let khac = 0;
    for (let seed = 1; seed <= 80; seed += 1) {
      if (kyMap(seed, v35) !== kyMap(seed, tat)) khac += 1;
    }
    expect(khac, 'markovNguon không đổi map nào — cờ không nối tới máy sinh')
      .toBeGreaterThan(0);
  });
});

describe('III. Dây nối', () => {
  it('⭐ đủ mắt nguonMoChuoi trong map.ts — rơi một mắt là nửa cơ chế chết im', () => {
    /*
     * 11 mắt CODE (chú thích đã bóc). 5 của D159 — khai báo · gán lúc chuỗi mở
     * · null-check `coNguon` · đọc `laNguonLi` · đọc `NGUON_MAU_TAN`; **+6 của
     * máy tick v36 (D165)**: 3 lượt gán lại nhãn ở ba nhánh mở/đảo/cắt và 3
     * lượt đọc trong nhánh hazard-theo-nguồn.
     * ⚠ Bài này ĐÃ LÀM ĐÚNG VIỆC: R1 thêm chỗ đọc là nó đỏ, buộc đổi số CÓ Ý
     * THỨC (không phải dọn dẹp tiện tay) — giữ nguyên tinh thần đó.
     */
    const src = readFileSync(resolve(process.cwd(), 'server/holdem/map.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\*.*$/gm, '');
    expect((src.match(/nguonMoChuoi/g) ?? []).length).toBe(11);
    // ⚠ Nhãn nguồn là LATENT: không được ghi vào trang_thai/DTO (§7 addendum).
    expect(src).not.toMatch(/nguon_mo_chuoi|nguonMoChuoi[^;]*trangThai/);
  });
});
