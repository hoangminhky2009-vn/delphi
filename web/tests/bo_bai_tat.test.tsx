/**
 * v54 (D403) — BỎ BÀI TẮT ở MÀN: trận mang cờ `bo_bai_tat` của server thì nút BỎ ở hàng TAY biến mất và shop có BÁN SẠCH.
 *
 * Founder 24/09: *"cái phần bỏ bài ấy bây giờ vô dụng phết nhỉ vì chúng ta đã đổi sang chip từ lâu rồi mà =)). Ko thì cho
 * nó thành 1 nút bấm nhanh để dùng ở trong shop khi muốn bán sạch tài sản đi"*. Engine gỡ 'bo' khỏi danh sách được-làm;
 * nút mà còn thì bấm vào CẮT LỖ chỉ ra THEO — một nút nói dối. Hành vi BÁN SẠCH canh ở `ban_cuoc.test.tsx`.
 *
 * ⚠ Cả hai phía đọc CÙNG một cờ server — không phân nhánh theo phiên bản (nếp `up_o` / `thanh_khoan_nam_nac`): trận
 * v53 (prod) và v45 (đề buổi đo) giữ nguyên nút BỎ, không có BÁN SẠCH.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TayBai } from '@/components/holdem/TayBai';

const MAN = readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8');

const tay = (coBo?: boolean) => render(
  <TayBai
    shopMo={false} onShop={() => {}} soTheChon={0}
    onChotVong={() => {}} onBo={() => {}} {...(coBo !== undefined ? { coBo } : {})}
  />,
);

describe('BỎ BÀI TẮT — hàng TAY', () => {
  it('⭐ coBo = false ⇒ KHÔNG có nút BỎ; CHỐT VÒNG vẫn đứng', () => {
    tay(false);
    expect(screen.queryByRole('button', { name: /^BỎ/ })).toBeNull();
    expect(screen.getByRole('button', { name: /CHỐT VÒNG/ })).toBeTruthy();
  });

  it('vế ngược — mặc định (trận còn BỎ) ⇒ nút BỎ còn nguyên', () => {
    tay();
    expect(screen.getByRole('button', { name: /^BỎ/ })).toBeTruthy();
  });

  it('⭐ màn trận nối CẢ HAI phía từ đúng một cờ server `bo_bai_tat`', () => {
    expect(MAN).toMatch(/coBo=\{st\.bo_bai_tat !== true\}/);
    expect(MAN).toMatch(/banSach: st\.bo_bai_tat === true/);
  });
});
