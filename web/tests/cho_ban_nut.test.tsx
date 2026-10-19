/**
 * NÚT BÁN Ở SHOP — bước 4 của M1 "tôi bán được một món và thấy T về ví".
 *
 * Màn KHÔNG tính gì: giá, cửa mở/đóng, số dư đều là số server trả (C4). Bài này
 * canh đúng ba điều màn phải làm và một điều màn KHÔNG được làm:
 *   · chợ tắt (403) ⇒ không vẽ mục, không có nút chết;
 *   · vẽ TỪNG BẢN (seri) với giá server, bản `mo=false` thì nút khoá + nói vì sao;
 *   · bấm ⇒ POST đúng `ban_the_id` rồi làm mới kho + catalog + ví;
 *   · server từ chối ⇒ hiện lỗi, không tự đoán trạng thái sau.
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

const KHO = {
  quy_cho: 300,
  mon: [
    { ban_the_id: '11', mau_id: 'st_ria_mep', ten: 'Ria mép', seri: 1, gia: 60, mo: true, ly_do: null },
    { ban_the_id: '12', mau_id: 'st_ria_mep', ten: 'Ria mép', seri: 2, gia: 60, mo: true, ly_do: null },
    { ban_the_id: '20', mau_id: 'st_kinh_ram', ten: 'Kính râm', seri: 1, gia: 180, mo: false, ly_do: 'quy_khong_du' },
    { ban_the_id: '30', mau_id: 'st_niem_beta', ten: 'Dấu niêm Beta', seri: 1, gia: 600, mo: false, ly_do: 'khong_ban_lai' },
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
  ]);
}

describe('Shop — kho của tôi, bán cho Hệ thống (M1)', () => {
  it('chợ TẮT (403) ⇒ không vẽ mục, không có một nút bán nào', async () => {
    stub([['/cho/cua-toi', { status: 403, body: { error: 'feature_disabled' } }]]);
    renderAt('/shop');
    await timO('[data-so-du]');                      // màn đã lên
    await new Promise((r) => setTimeout(r, 50));    // cho query 403 kịp về
    expect(document.querySelector('[data-kho-cua-toi]')).toBeNull();
    expect(document.querySelector('[data-ban]')).toBeNull();
  });

  it('vẽ TỪNG BẢN với giá server; bản `mo=false` thì nút khoá và nói vì sao', async () => {
    stub([['/cho/cua-toi', { status: 200, body: KHO }]]);
    renderAt('/shop');
    await timO('[data-kho-cua-toi]');
    const nut11 = document.querySelector('[data-ban="11"]') as HTMLButtonElement;
    const nut12 = document.querySelector('[data-ban="12"]') as HTMLButtonElement;
    const nut20 = document.querySelector('[data-ban="20"]') as HTMLButtonElement;
    expect(nut11.textContent).toBe('BÁN #1 · 60 T');
    // ⭐ Tên bậc cao nhất: "CỰC HIẾM" → "KIỆT TÁC" (D296). Bài này khoá lại vì
    // đó là một quyết định thương hiệu, không phải một chuỗi tuỳ tiện — đổi lần
    // nữa thì phải đổi có chủ ý, kèm demo (A11.25).
    expect(nut12.textContent).toBe('BÁN #2 · 60 T');
    expect(nut11).toBeEnabled();
    expect(nut20).toBeDisabled();
    expect(document.querySelector('[data-mau="st_kinh_ram"]')!.textContent).toMatch(/hiện KHÔNG mua/);
    /*
     * ⭐ HAI LÝ DO, HAI CÂU — không được nói nhầm. "Quỹ không đủ" là tạm thời và
     * hứa ngầm "mai bán được"; món quà beta thì KHÔNG BAO GIỜ bán lại được (E24).
     * Ca thật đã mở trên prod 06/09 (D291).
     */
    const oBeta = document.querySelector('[data-mau="st_niem_beta"]')!;
    expect(oBeta.textContent).toMatch(/không mua lại/);
    expect(oBeta.textContent, 'không được nói nhầm thành lý do quỹ').not.toMatch(/quỹ chợ không đủ/);
    expect(document.querySelector('[data-ban="30"]')).toBeDisabled();
    expect(screen.getByText(/Quỹ chợ hiện có/).textContent).toMatch(/300 T/);
  });

  it('⭐ bấm BÁN ⇒ POST đúng ban_the_id, rồi làm mới kho + catalog', async () => {
    const calls = stub([
      ['/cho/cua-toi', { status: 200, body: KHO }],
      ['/cho/ban', { status: 200, body: { ok: true, ban_the_id: '11', gia: 60, bankroll: 1060, quy_cho: 240 } }],
    ]);
    renderAt('/shop');
    await timO('[data-kho-cua-toi]');
    fireEvent.click(document.querySelector('[data-ban="11"]')!);
    await waitFor(() => {
      const post = calls.find((c) => c.url.includes('/cho/ban') && c.method === 'POST');
      expect(post).toBeDefined();
      expect(post!.body).toEqual({ ban_the_id: '11' });
    });
    await waitFor(() => {
      // Sau khi bán: kho được hỏi lại, catalog (số dư) được hỏi lại.
      expect(calls.filter((c) => c.url.includes('/cho/cua-toi')).length).toBeGreaterThanOrEqual(2);
      expect(calls.filter((c) => c.url.includes('/shop/catalog')).length).toBeGreaterThanOrEqual(2);
    });
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('server từ chối (409) ⇒ hiện đúng lời server, không tự đoán ví đã tăng', async () => {
    stub([
      ['/cho/cua-toi', { status: 200, body: KHO }],
      ['/cho/ban', { status: 409, body: { error: 'he_thong_khong_mua', message: 'Quỹ chợ hiện không đủ để mua.' } }],
    ]);
    renderAt('/shop');
    await timO('[data-kho-cua-toi]');
    fireEvent.click(document.querySelector('[data-ban="11"]')!);
    const loi = await waitFor(() => {
      const el = document.querySelector('[role="alert"]');
      if (!el) throw new Error('chưa thấy lỗi');
      return el;
    });
    expect(loi.textContent).toMatch(/không đủ/);
    expect(document.querySelector('[data-so-du]')!.textContent).toBe('1.000 T');
  });

  it('kho rỗng ⇒ nói "chưa có nhãn", không vẽ nút', async () => {
    stub([['/cho/cua-toi', { status: 200, body: { quy_cho: 300, mon: [] } }]]);
    renderAt('/shop');
    await timO('[data-kho-rong]');
    expect(document.querySelector('[data-ban]')).toBeNull();
  });
});

describe('tên bậc hiển thị — quyết định thương hiệu, không phải chuỗi tuỳ tiện', () => {
  /*
   * `epic` là id máy (CHECK của DB, dữ liệu prod); người chơi chưa bao giờ thấy
   * nó. Thứ họ thấy là từ điển `TEN_BAC` ở client — nên đổi cảm giác của bậc
   * cao nhất tốn 0 migration. Bài này khoá con chữ lại để lần đổi sau là một
   * quyết định có chủ ý kèm demo (A11.25), không phải một cú sửa tiện tay.
   */
  it('bậc cao nhất đọc là KIỆT TÁC, không còn là một mức độ của "hiếm"', async () => {
    const CAT_EPIC = {
      ...CATALOG,
      hop: { ...CATALOG.hop, mon: [{ id: 'st_niem_beta', ten: 'Dấu niêm', hiem: 'epic', loai: 'sticker', ma: null, con_lai: null }] },
    };
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/shop/catalog', { status: 200, body: CAT_EPIC }],
      ['/cho/cua-toi', { status: 403, body: { error: 'feature_disabled' } }],
    ]);
    renderAt('/shop');
    // Nhiều chỗ cùng hiện tên bậc (danh sách món + dải tỷ lệ công khai) — đó là
    // ĐÚNG, và chính vì thế phải quét `not.toMatch` bên dưới: sót một chỗ là
    // hai cái tên cùng sống.
    await waitFor(() => expect(screen.getAllByText('KIỆT TÁC').length).toBeGreaterThan(0));
    expect(document.body.textContent).not.toMatch(/CỰC HIẾM/);
  });
});
