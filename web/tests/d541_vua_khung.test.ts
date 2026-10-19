/**
 * D541 — BÀN ĐẤU VỪA MỘT KHUNG HÌNH (founder 06/10: *"màn chơi phải cố định trong 1 khung hình để user nhìn được bao quát bàn"*). Đo trên trình
 * duyệt 06/10 (375 rộng): bàn 663 px; khung app chừa 74 px đáy cho BottomNav dù màn trận ẩn thanh ấy ⇒ trang 757 px ở khung 690 ⇒ cuộn, che nửa
 * dải người chơi. Sửa hai lớp: (1) màn toàn màn không chừa đáy; (2) khung thấp hơn bàn ⇒ thu các khối trong luồng bằng `zoom` (600 px ⇒ 0,864,
 * trang đúng 600, không dao động; 812 ⇒ 1).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { heSoVuaKhung, ZOOM_TOI_THIEU } from '@/lib/vua_khung';

describe('D541 — hệ số thu', () => {
  it('⭐ nội dung 663 trong khung 580 ⇒ 0,874; vừa / thừa chỗ ⇒ 1 (không bao giờ phóng)', () => {
    expect(heSoVuaKhung(663, 580)).toBe(0.874);
    expect(heSoVuaKhung(663, 663)).toBe(1);
    expect(heSoVuaKhung(500, 800)).toBe(1);
  });
  it('sàn 0,75 — dưới mức ấy thà cuộn (chữ 9 px thành < 7 px)', () => {
    expect(heSoVuaKhung(1000, 400)).toBe(ZOOM_TOI_THIEU);
  });
  it('đổi < 1 % ⇒ giữ hệ số cũ (đo lại sau khi thu không rung)', () => {
    expect(heSoVuaKhung(663, 580, 0.87)).toBe(0.87);
    expect(heSoVuaKhung(663, 520, 0.87)).toBe(0.784);
  });
  it('số hỏng ⇒ 1', () => {
    expect(heSoVuaKhung(0, 600)).toBe(1);
    expect(heSoVuaKhung(600, Number.NaN)).toBe(1);
  });
});

describe('D541 — dây nối', () => {
  const doc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
  it('⭐ màn toàn màn (bàn đấu) không chừa 74 px đáy cho BottomNav vắng mặt', () => {
    expect(doc('src/app/AppShell.tsx')).toMatch(/className=\{toanMan \? `\$\{s\.shell\} \$\{s\.shellToanMan\}` : s\.shell\}/);
    expect(doc('src/app/AppShell.module.css')).toMatch(/\.shellToanMan \{ padding-bottom: env\(safe-area-inset-bottom, 0px\); \}/);
  });
  it('chỉ các khối TRONG LUỒNG của bàn bị thu (lớp phủ cố định giữ cỡ)', () => {
    expect(doc('src/screens/holdem/AlphaDraftMatch.module.css'))
      .toMatch(/\.banDau > \.strip, \.banDau > \.pnl, \.banDau > \.foot, \.banDau > \.thanhDay \{ zoom: var\(--vua, 1\); \}/);
    expect(doc('src/screens/holdem/AlphaDraftMatch.tsx')).toMatch(/style=\{\{ '--vua': vua \} as CSSProperties\}/);
  });
});
