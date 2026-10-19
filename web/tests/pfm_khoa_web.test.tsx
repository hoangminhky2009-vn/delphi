/**
 * KHÓA PFM TRÊN WEB (SPEC chan-truoc-beta mục 6 — founder 11/10; cờ `web/src/lib/pfm_mo.ts`).
 *
 *   · Hub: ô Tài chính xám + câu "Admin cần donate…", KHÔNG số liệu sổ, KHÔNG nút nhận tiền; link nhỏ "Bạn có nhu cầu…?" mở lớp trượt.
 *   · Gõ thẳng mọi `/tai-chinh/*` ⇒ về Hub. THẺ đo từ trận (`/ho-so/the`) KHÔNG bị khoá (không thuộc khu Tài chính).
 *   · Không màn nào mở kho sổ trên máy (không `moKhoChung`/`KhoProvider` ⇒ driver đồng bộ · két không chạy).
 *   · Canh điều kiện mở lại (A11.15): cờ bật mà kho IndexedDB còn tên CHUNG `delphi_pfm` ⇒ đỏ (SPEC mục 3: tách kho theo tài khoản trước).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from '@/app/routes';
import { makeQueryClient } from '@/api/queries';
import type { MeResponse } from '@/api/types';
import { CHU_HUB } from '@/lib/hub_chu';
import { PFM_WEB_MO } from '@/lib/pfm_mo';
import * as dungKho from '@/pfm/dung_kho';
import { ME_ONBOARDED, stubFetch } from './helpers';

const ME_THAT: MeResponse = { ...ME_ONBOARDED, user: { ...ME_ONBOARDED.user!, la_khach: false } };
const LT = { mua_mo: true, tuan: 1, so_tuan: 4, chang: 1, so_chang: 30, quest_points: 0, viec: [], da_diem_danh_hom_nay: true, moc: [] };
const BANG: [string, { status: number; body: unknown }][] = [
  ['/me/nhiem-vu', { status: 200, body: LT }],
  ['/auth/me', { status: 200, body: ME_THAT }],
];

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<QueryClientProvider client={makeQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}
const o = (dau: string) => document.querySelector(`[data-o="${dau}"]`) as HTMLElement | null;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('PFM web khoá', () => {
  it('cờ đang TẮT (mặc định của bản này)', () => {
    expect(PFM_WEB_MO).toBe(false);
  });

  it('⭐ Hub: ô Tài chính GIỮ icon cũ (founder 11/10), không số sổ, không mở kho; CHẠM ⇒ lớp nói lý do + link nhu cầu', async () => {
    const mo = vi.spyOn(dungKho, 'moKhoChung');
    stubFetch(BANG);
    renderApp('/');
    await waitFor(() => expect(o('tai-chinh')?.querySelector('svg, img, [data-icon], span')).toBeTruthy());
    expect(o('tai-chinh')!.textContent).not.toContain(CHU_HUB.ghiChiTieu);
    expect(o('tai-chinh')!.textContent, 'câu khoá chỉ hiện khi CHẠM, không nằm trên mặt ô').not.toContain(CHU_HUB.taiChinhKhoa);
    expect(document.querySelector('[data-nut="nhu-cau-pfm"]'), 'link ở trong lớp trượt, không chen dưới ô').toBeNull();
    fireEvent.click(o('tai-chinh')!);
    const tam = await screen.findByRole('dialog');
    expect(tam.textContent).toContain(CHU_HUB.taiChinhKhoa);
    expect(tam.textContent).not.toContain(CHU_HUB.moTaiChinh);
    expect(tam.textContent).not.toMatch(/chuyển khoản|momo|stk|số tài khoản/i);
    fireEvent.click(within(tam).getByText(CHU_HUB.nhuCauPfm));
    await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain(CHU_HUB.nhuCauPfmCho));
    expect(mo, 'Hub khoá mà vẫn mở kho sổ trên máy').not.toHaveBeenCalled();
  });

  it('⭐ ô khoá xoay BẢN XEM TRƯỚC (founder 11/10): 6 cảnh hành tinh ↔ SỔ · HŨ · GƯƠNG, nhãn XEM TRƯỚC, không số liệu sổ nào', async () => {
    stubFetch(BANG);
    renderApp('/');
    const xt = await waitFor(() => {
      const e = o('tai-chinh')?.querySelector('[data-xem-truoc-pfm]');
      expect(e).toBeTruthy();
      return e as HTMLElement;
    }, { timeout: 20_000 });
    expect(xt.textContent).toContain(CHU_HUB.xemTruoc);
    for (const t of [CHU_HUB.xemTruocSo, CHU_HUB.xemTruocHu, CHU_HUB.xemTruocGuong, 'SAO THUỶ', 'HẢI VƯƠNG', 'SAO KIM']) {
      expect(xt.textContent, `thiếu cảnh "${t}"`).toContain(t);
    }
    expect(xt.textContent, 'xem trước không được in số tiền / số liệu sổ').not.toMatch(/\d/);
  });

  it.each(['/tai-chinh', '/tai-chinh/so', '/tai-chinh/hu', '/tai-chinh/guong', '/tai-chinh/the'])('⭐ gõ thẳng %s ⇒ về Hub', async (duong) => {
    stubFetch(BANG);
    const r = renderApp(duong);
    await waitFor(() => expect(r.state.location.pathname).toBe('/'));
  });

  it('THẺ đo từ trận (/ho-so/the) KHÔNG bị khoá — nó thuộc Đấu trường', async () => {
    stubFetch(BANG);
    const r = renderApp('/ho-so/the');
    await new Promise((x) => { setTimeout(x, 300); });
    expect(r.state.location.pathname).toBe('/ho-so/the');
  });

  it('⭐ điều kiện mở lại: cờ bật ⇒ kho IndexedDB không còn tên chung một-cho-mọi-tài-khoản', () => {
    const kho = readFileSync(join(process.cwd(), 'src/pfm/kho_idb.ts'), 'utf8');
    const tenChung = /['"]delphi_pfm['"]/.test(kho);
    if (PFM_WEB_MO) expect(tenChung, 'bật PFM web mà kho vẫn dùng chung mọi tài khoản (SPEC chan-truoc-beta mục 3)').toBe(false);
    else expect(tenChung, 'bài này đọc đúng tệp kho (đối chứng)').toBe(true);
  });
});
