/**
 * SỔ LIÊN HỆ (12/09, Q3) — thành phần chỉ VẼ `lien_he` của `/holdem/me/so-tay`.
 *
 * Ba điều đáng canh:
 *  1. Hàng CHỈ điền khi đã sống qua THẬT: chấm nghiêng đúng dấu server gửi, bậc
 *     đúng số lần; mặt chưa gặp vẽ mờ, không chấm, không dấu hỏi.
 *  2. Mặt chỉ mới gặp dưới dạng TIN GIẢ: không chấm (chưa sống qua thật), nhưng
 *     nói thật là "tin giả ×n".
 *  3. A10 — mọi chữ trên sổ là mô tả; không một từ khuyên (nên · hãy · đừng ·
 *     phải · lần sau · nhớ · tránh · cần).
 * Tiêm lỗi 12/09: đổi `dau > 0 ? s.chamLen` thành `dau < 0` ⇒ bài 1 đỏ; xoá
 * điều kiện `!chuaGap` quanh chấm ⇒ bài 2 đỏ. Hoàn nguyên bằng thay-chuỗi.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CHU_SO_LIEN_HE, SoLienHe } from '../src/components/SoLienHe';
import type { LienHeSoTay } from '@server/holdem/khoanh_khac_ids';

const SU_KIEN = [
  { id: 'ha_lai_suat', label: 'Hạ lãi suất', icon: '🕊' },
  { id: 'chien_tranh', label: 'Chiến tranh', icon: '⚔' },
  { id: 'hack_san', label: 'Sập sàn', icon: '💀' },
  { id: 'bong_bong', label: 'Bong bóng', icon: '🫧' },
];
const TAI_SAN = [
  { id: 'btc', label: 'Crypto' }, { id: 'cp_cn', label: 'Cổ tech' }, { id: 'vn30', label: 'Blue-chip' },
  { id: 'vang', label: 'Vàng' }, { id: 'usd', label: 'USD' }, { id: 'tpcp', label: 'Trái phiếu' },
];
const dau = (mau: string) => TAI_SAN.map((t, i) => ({
  ma: t.id, dau: (mau[i] === '+' ? 1 : mau[i] === '-' ? -1 : 0) as -1 | 0 | 1,
}));
const LIEN_HE: LienHeSoTay[] = [
  { id: 'chien_tranh', tinh_chat: 'hoang_loan', so_lan: 3, so_lan_gia: 1, lan_dau: '2026-09-01T00:00:00Z', dau: dau('---+++') },
  { id: 'ha_lai_suat', tinh_chat: 'van_tien', so_lan: 1, so_lan_gia: 0, lan_dau: '2026-09-12T00:00:00Z', dau: dau('++++-+') },
  { id: 'hack_san', tinh_chat: 'lech_ma', so_lan: 0, so_lan_gia: 2, lan_dau: null, dau: dau('--0+-+') },
];

const hang = (c: HTMLElement, id: string) => {
  const el = c.querySelector<HTMLElement>(`[data-mat="${id}"]`);
  if (!el) throw new Error(`không thấy hàng ${id}`);
  return el;
};
const chamCua = (h: HTMLElement) => [...h.querySelectorAll('i')]
  .map((i) => (i.className.includes('chamLen') ? '+' : i.className.includes('chamXuong') ? '-'
    : i.className.includes('chamNgang') ? '0' : ''))
  .filter(Boolean).join('');

/** Render TRONG từng `it` — testing-library dọn DOM sau mỗi bài, render ở describe là bài sau thấy rỗng. */
const ve = () => render(<SoLienHe lienHe={LIEN_HE} suKien={SU_KIEN} taiSan={TAI_SAN} />).container;

describe('1. hàng điền theo thứ đã sống qua', () => {
  it('chiến tranh: sáu chấm đúng dấu, bậc QUEN (3), có lần đầu và số giả', () => {
    const container = ve();
    const h = hang(container, 'chien_tranh');
    expect(chamCua(h)).toBe('---+++');
    expect(h.dataset['bac']).toBe('3');
    expect(h.querySelectorAll('[class*="oBacDay"]').length).toBe(3);
    expect(h.textContent).toContain('×3');
    expect(h.textContent).toContain('giả ×1');
  });

  it('hạ lãi: bậc GẶP (1), một ô đầy', () => {
    const container = ve();
    const h = hang(container, 'ha_lai_suat');
    expect(chamCua(h)).toBe('++++-+');
    expect(h.dataset['bac']).toBe('1');
    expect(h.querySelectorAll('[class*="oBacDay"]').length).toBe(1);
  });

  it('bong bóng chưa gặp: mờ, không chấm, không dấu hỏi, nói "chưa gặp"', () => {
    const container = ve();
    const h = hang(container, 'bong_bong');
    expect(h.className).toMatch(/hangMo/);
    expect(chamCua(h)).toBe('');
    expect(h.textContent).toContain('chưa gặp');
    expect(h.textContent).not.toContain('?');
  });

  it('đầu sổ đếm đúng: đã gặp 2/4 · quen 1', () => {
    const container = ve();
    expect(container.textContent).toContain('đã gặp 2/4');
    expect(container.textContent).toContain('quen 1');
  });
});

describe('2. chỉ mới gặp tin giả', () => {
  it('sập sàn ×2 giả: không chấm (chưa sống qua thật), nói thật "tin giả ×2"', () => {
    const { container } = render(<SoLienHe lienHe={LIEN_HE} suKien={SU_KIEN} taiSan={TAI_SAN} />);
    const h = hang(container, 'hack_san');
    expect(chamCua(h)).toBe('');
    expect(h.textContent).toContain('tin giả ×2');
    expect(h.dataset['bac']).toBe('0');
  });

  it('API cũ (lien_he vắng): không vẽ gì', () => {
    const { container } = render(<SoLienHe lienHe={undefined} suKien={SU_KIEN} taiSan={TAI_SAN} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('3. A10 — tả, không khuyên', () => {
  it('không từ kê đơn trên toàn bộ sổ', () => {
    const { container } = render(<SoLienHe lienHe={LIEN_HE} suKien={SU_KIEN} taiSan={TAI_SAN} />);
    // 13/09 — cách đọc sổ nằm sau `!`: mở ra rồi mới quét, không thì bài quét bỏ sót chính câu dài nhất.
    fireEvent.click(screen.getByRole('button', { name: CHU_SO_LIEN_HE.hoi }));
    const chu = container.textContent ?? '';
    expect(chu).toContain(CHU_SO_LIEN_HE.giai);
    for (const tu of ['nên', 'hãy', 'đừng', 'phải', 'lần sau', 'nhớ', 'tránh', 'cần']) {
      expect(chu.toLowerCase(), `từ kê đơn "${tu}"`).not.toMatch(new RegExp(`(^|[^\\p{L}])${tu}([^\\p{L}]|$)`, 'u'));
    }
  });
});

describe('4. D336 lượt 2 — cất sổ từ chính đầu sổ', () => {
  /*
   * Founder 15/09: *"phần sổ liên hệ … đ** ẩn được"* — trong trận nút SỔ nằm trên bản đồ, sổ mở ra
   * dưới dải sáu mã; đọc tới đó thì nút đóng đã trôi khỏi màn. Tiêm lỗi: bỏ `{onDong && (` ⇒ bài đỏ.
   */
  it('⭐ có onDong ⇒ nút "Cất sổ liên hệ" ngay đầu sổ, bấm là gọi; không có ⇒ không nút', () => {
    let dong = 0;
    const { unmount } = render(
      <SoLienHe lienHe={LIEN_HE} suKien={SU_KIEN} taiSan={TAI_SAN} gon onDong={() => { dong += 1; }} />,
    );
    const nut = screen.getByRole('button', { name: 'Cất sổ liên hệ' });
    expect(nut.closest('[class*="_dau_"]'), 'nút cất phải nằm ở đầu sổ').not.toBeNull();
    fireEvent.click(nut);
    expect(dong).toBe(1);
    unmount();
    render(<SoLienHe lienHe={LIEN_HE} suKien={SU_KIEN} taiSan={TAI_SAN} />);
    expect(screen.queryByRole('button', { name: 'Cất sổ liên hệ' })).toBeNull();
  });
});
