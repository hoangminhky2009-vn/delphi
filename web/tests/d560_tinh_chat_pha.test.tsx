/**
 * D560 — TÍNH CHẤT LÁ PHA hiện như loại tin của lá thiên nga: ICON GÓC PHẢI (founder 08/10: *"Làm giống trường hợp lá thiên nga đen ấy,
 * 1 icon ở góc"*), tên ở aria + tooltip. Lá không tính chất (mọi khoá cũ) giữ mã lá như cũ.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MarketMap } from '../src/components/holdem/MarketMap';
import { TINH_CHAT_PHA } from '../src/lib/la_bai';
import type { NhanDTO, ODTO } from '../src/api/holdem';

const CAT_GD: NhanDTO[] = [
  { id: 'tang', label: 'Tăng', icon: '📈' }, { id: 'di_ngang', label: 'Đi ngang', icon: '➖' }, { id: 'giam', label: 'Giảm', icon: '📉' },
];
const oGD = (gd: string, tc?: string): ODTO => ({ kind: 'giai_doan', giai_doan: gd, ...(tc ? { tinh_chat: tc } : {}) } as ODTO);
const ve = (daLat: ODTO[]) => render(<MarketMap
  daLat={daLat} hienTai={null} vong={daLat.length + 1} tongVong={14} conLai={14 - daLat.length}
  art={{}} giaiDoan={CAT_GD} suKien={[]} telegraph={null} upO
/>);

describe('D560 — icon tính chất lá pha', () => {
  it('đủ 7 tính chất, lưới 16×16', () => {
    expect(Object.keys(TINH_CHAT_PHA).sort()).toEqual(
      ['dong_tien', 'gau_chu_ky', 'gau_dinh_gia', 'gau_su_kien', 'phan_phoi', 'tang_truong', 'tich_luy']);
    for (const { icon } of Object.values(TINH_CHAT_PHA)) {
      expect(icon).toHaveLength(16);
      for (const r of icon) expect(r).toHaveLength(16);
    }
  });
  it('⭐ lá có tính chất ⇒ icon góc phải có tên ở aria + tooltip; lá không tính chất ⇒ không icon', () => {
    const { container } = ve([oGD('tang', 'dong_tien'), oGD('di_ngang', 'phan_phoi'), oGD('giam', 'gau_chu_ky'), oGD('tang')]);
    const icon = [...container.querySelectorAll('[data-tinh-chat-pha]')];
    expect(icon.map((e) => e.getAttribute('data-tinh-chat-pha'))).toEqual(['dong_tien', 'phan_phoi', 'gau_chu_ky']);
    expect(icon.map((e) => e.getAttribute('title'))).toEqual(['BÒ DÒNG TIỀN', 'PHÂN PHỐI', 'GẤU CHU KỲ']);
    expect(icon[0]!.getAttribute('aria-label')).toBe('Tính chất bò dòng tiền');
    expect(icon.every((e) => e.querySelector('svg, canvas, span, i'))).toBe(true);
  });
});
