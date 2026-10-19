/**
 * D406 — MÀN TRẬN ĐỌC BẢNG VAI CỦA CHÍNH TRẬN (`st.vai_bang`), KHÔNG ĐỌC CATALOG.
 *
 * Catalog `vai` là bảng của khoá MẶC ĐỊNH. Từ khi mặc định là v54 (vốn đều · lõi gọn) mà bàn tập vẫn chạy v53, màn trận
 * đọc catalog là bàn tập hiện Cá Mập "×1" (vốn thật ×3) và trận thật hiện tổ chức "Đa Dạng Hoá ghim sẵn" (lá đã rời
 * quầy). Lớp lỗi: một chỗ đọc `c.vai` mới là một chỗ hứa sai. Bài này quét mã: `c.vai` chỉ được xuất hiện ĐÚNG MỘT lần —
 * ở dòng rơi về cho server cũ — và mọi chỗ vẽ vai (chào vai · nút vai ở chợ · dắt coach) đi qua `vaiBang`.
 * Server phát đúng bảng theo trận: `tests/luoc_bo_v54_api.test.ts` (D406).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const NGUON = readFileSync(resolve(__dirname, '../src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8');

describe('D406 — màn trận đọc bảng vai theo trận', () => {
  it('⭐ `c.vai` chỉ còn ở dòng rơi về (server cũ chưa phát `vai_bang`)', () => {
    const cho = [...NGUON.matchAll(/\bc\.vai\b/g)];
    expect(cho.length, 'mỗi chỗ đọc thẳng catalog `c.vai` là một chỗ hứa luật của khoá mặc định').toBe(1);
    expect(NGUON).toMatch(/const vaiBang = st\.vai_bang \?\? c\.vai;/);
  });

  it('chào vai · nút vai ở chợ · cờ dắt coach đều đọc `vaiBang`', () => {
    expect(NGUON).toMatch(/vaiBang=\{vaiBang\}/);
    expect(NGUON).toMatch(/dacQuyen: vaiBang\[b\.vai\]!\.dac_quyen/);
    expect(NGUON).toMatch(/heSoVon: vaiBang\[b\.vai\]!\.he_so_von/);
    expect(NGUON).toMatch(/chaoVaiXong=\{b\.vai && vaiBang\?\.\[b\.vai\]/);
    // Chống xanh rỗng: bài quét đúng tệp có màn chào vai.
    expect(NGUON).toContain('<ChaoVai');
  });
});
