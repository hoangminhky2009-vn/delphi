/**
 * QUẦY HỆ THỐNG Ở SHOP — mốc M2 "tôi mua lại được một món".
 *
 * Cùng bốn câu hỏi như bài của nút BÁN, nhưng chiều ngược: màn không được tự
 * tính giá, không được tự đoán ví sau khi mua, và phải ẩn sạch khi chợ tắt.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

const CATALOG = {
  bankroll: 1000, quest_points: 0, ban_q: [],
  hop: {
    gia_t: 100, can_du_t: 600, rate_bp: { thuong: 7000, hiem: 2500, epic: 500 },
    pity: 20, tu_epic: 0, tong_luot: 0, mo_duoc: true, mon: [],
  },
  gia_ban_sao_them: null,
};

const KHO = { quy_cho: 300, mon: [] };

const QUAY = {
  bankroll: 1000,
  mon: [
    { ban_the_id: '31', mau_id: 'st_ria_mep', ten: 'Ria mép', seri: 1, ton: 2, gia: 57, mo: true },
    { ban_the_id: '32', mau_id: 'st_ria_mep', ten: 'Ria mép', seri: 2, ton: 2, gia: 57, mo: true },
    { ban_the_id: '40', mau_id: 'st_kinh_ram', ten: 'Kính râm', seri: 3, ton: 1, gia: 2000, mo: false },
  ],
};

async function timO(sel: string): Promise<HTMLElement> {
  return waitFor(() => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`chưa thấy ${sel}`);
    return el as HTMLElement;
  });
}

function stub(extra: [string, { status: number; body: unknown }][] = []) {
  return stubFetch([
    ...extra,
    ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ['/shop/catalog', { status: 200, body: CATALOG }],
    ['/cho/cua-toi', { status: 200, body: KHO }],
  ]);
}

describe('Shop — quầy Hệ thống, mua lại (M2)', () => {
  it('chợ TẮT (403) ⇒ không vẽ quầy, không có một nút mua nào', async () => {
    stub([['/cho/quay', { status: 403, body: { error: 'feature_disabled' } }]]);
    renderAt('/shop');
    await timO('[data-so-du]');
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('[data-quay-he-thong]')).toBeNull();
    expect(document.querySelector('[data-mua]')).toBeNull();
  });

  it('quầy rỗng ⇒ nói rõ vì sao rỗng, không vẽ nút', async () => {
    stub([['/cho/quay', { status: 200, body: { bankroll: 1000, mon: [] } }]]);
    renderAt('/shop');
    await timO('[data-quay-rong]');
    expect(document.querySelector('[data-mua]')).toBeNull();
  });

  it('vẽ TỪNG BẢN với giá + tồn kho server trả; `mo=false` thì nút khoá', async () => {
    stub([['/cho/quay', { status: 200, body: QUAY }]]);
    renderAt('/shop');
    await timO('[data-quay-he-thong]');
    const n31 = document.querySelector('[data-mua="31"]') as HTMLButtonElement;
    const n40 = document.querySelector('[data-mua="40"]') as HTMLButtonElement;
    expect(n31.textContent).toBe('MUA #1 · 57 T');
    expect(n31).toBeEnabled();
    expect(n40).toBeDisabled();
    expect(document.querySelector('[data-quay-mau="st_ria_mep"]')!.textContent)
      .toMatch(/kho còn 2/);
    // Giá 2.000 T > ví 1.000 T ⇒ màn nói được lý do đó bằng số nó đang có.
    expect(document.querySelector('[data-quay-mau="st_kinh_ram"]')!.textContent)
      .toMatch(/ví chưa đủ/);
  });

  it('⭐ bấm MUA ⇒ POST đúng ban_the_id, rồi làm mới quầy + kho + catalog', async () => {
    const calls = stub([
      ['/cho/quay', { status: 200, body: QUAY }],
      ['/cho/mua', { status: 200, body: {
        ok: true, ban_the_id: '31', gia: 57, phi_dot: 1, phi_kho_bac: 1,
        bankroll: 943, quy_cho: 355,
      } }],
    ]);
    renderAt('/shop');
    await timO('[data-quay-he-thong]');
    fireEvent.click(document.querySelector('[data-mua="31"]')!);
    await waitFor(() => {
      const post = calls.find((c) => c.url.includes('/cho/mua') && c.method === 'POST');
      expect(post).toBeDefined();
      expect(post!.body).toEqual({ ban_the_id: '31' });
    });
    await waitFor(() => {
      expect(calls.filter((c) => c.url.includes('/cho/quay')).length).toBeGreaterThanOrEqual(2);
      expect(calls.filter((c) => c.url.includes('/shop/catalog')).length).toBeGreaterThanOrEqual(2);
    });
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('server từ chối (409 vốn quá thấp) ⇒ hiện lời server, ví KHÔNG tự tụt', async () => {
    stub([
      ['/cho/quay', { status: 200, body: QUAY }],
      ['/cho/mua', { status: 409, body: {
        error: 'von_qua_thap',
        message: 'Cần số dư còn lại trên 500 T sau khi trừ 57 T — vốn dự báo không phải thứ để đổi lấy ngoại hình.',
      } }],
    ]);
    renderAt('/shop');
    await timO('[data-quay-he-thong]');
    fireEvent.click(document.querySelector('[data-mua="31"]')!);
    const loi = await waitFor(() => {
      const el = document.querySelector('[role="alert"]');
      if (!el) throw new Error('chưa thấy lỗi');
      return el;
    });
    expect(loi.textContent).toMatch(/vốn dự báo/);
    expect(document.querySelector('[data-so-du]')!.textContent).toBe('1.000 T');
    expect(screen.getByText(/trích 3% đốt/)).toBeTruthy();
  });
});
