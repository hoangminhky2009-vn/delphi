/**
 * NỐI DÂY GAME → PFM, PHÍA MÀN (D324). Ba câu:
 *  (a) mặt TRONG TRẬN của GƯƠNG có đúng ba trạng thái và không trạng thái nào giả làm trạng
 *      thái khác (cửa đóng · chưa đề · có đề); có đề ⇒ BA DẤU cùng hình mặt THẺ (13/09), không
 *      còn dòng số rời;
 *  (b) dòng "Từ trận" ở lộ trình chỉ hiện khi cửa mở VÀ có năng lực đã làm được;
 *  (c) chữ mới không kê đơn (A10).
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NangLucCuaToiDTO } from '@server/holdem/nang_luc_ids';
import { MatTrongTran } from '../src/screens/tai-chinh/Guong';
import { TuTran } from '../src/screens/tai-chinh/LoTrinh';
import { CHU_MAN_GUONG as C } from '../src/lib/pfm_chu';
import { CHU_NANG_LUC } from '../src/lib/nang_luc';
import { TU_KE_DON } from '../src/lib/khoanh_khac';
import { ME_ONBOARDED, stubFetch } from './helpers';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const NANG_LUC: NangLucCuaToiDTO = {
  formula_version: 1, so_de: 2,
  nang_luc: [
    { id: 'cam_ket_tiet_kiem', bac: 'lam_duoc', so_de_gap: 2, so_de_lam_duoc: 1, lan_dau_lam_duoc: null },
    { id: 'doc_tin', bac: 'gap_chua_vung', so_de_gap: 2, so_de_lam_duoc: 0, lan_dau_lam_duoc: null },
    { id: 'phan_tan', bac: 'chua_gap', so_de_gap: 0, so_de_lam_duoc: 0, lan_dau_lam_duoc: null },
  ],
};

const veMat = (noiGame: boolean, nl: NangLucCuaToiDTO | undefined) =>
  render(<MemoryRouter><MatTrongTran noiGame={noiGame} nl={nl} /></MemoryRouter>);

describe('(a) mặt TRONG TRẬN — ba trạng thái', () => {
  it('⭐ cửa noi_game ĐÓNG ⇒ nói mặt này ghép gì + đường tới Cài đặt, không một dấu', () => {
    const { container } = veMat(false, NANG_LUC);
    expect(screen.getByText(C.tranCuaDong)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: C.tranDiCaiDat })).toHaveAttribute('href', '/cai-dat');
    expect(container.querySelectorAll('[data-testid^="dau-"]')).toHaveLength(0);
  });

  it('chưa đề hợp lệ ⇒ nói thẳng + đường tới sảnh, không vẽ ba dấu rỗng', () => {
    const { container } = veMat(true, { ...NANG_LUC, so_de: 0 });
    expect(screen.getByText(C.tranChuaDe)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: C.tranDiChoi })).toHaveAttribute('href', '/arena');
    expect(container.querySelectorAll('[data-testid^="dau-"]')).toHaveLength(0);
  });

  it('đang tải ⇒ dấu chờ, không trạng thái nào khác giả làm nó', () => {
    const { container } = veMat(true, undefined);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText(C.tranChuaDe)).toBeNull();
  });

  it('⭐ có đề ⇒ BA DẤU đúng bậc (cùng hình mặt THẺ) + câu chưa hiệu chuẩn; không còn dòng số rời', () => {
    const { container } = veMat(true, NANG_LUC);
    for (const n of NANG_LUC.nang_luc) {
      expect(screen.getByTestId(`dau-${n.id}`)).toHaveAttribute('data-bac', n.bac);
    }
    expect(container.querySelectorAll('[data-testid="dong-tran"]')).toHaveLength(0);
    expect(screen.getByText(C.tranChuaHieuChuan)).toBeInTheDocument();
  });
});

const meCua = (noiGame: boolean) => ({
  ...ME_ONBOARDED,
  pfm: { consent: true, cua: { ket: true, dac_trung: true, thuong: true, noi_game: noiGame } },
});

const veTuTran = () => render(
  <MemoryRouter>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TuTran />
    </QueryClientProvider>
  </MemoryRouter>,
);

describe('(b) dòng "Từ trận" ở lộ trình', () => {
  it('⭐ cửa mở + có năng lực đã làm được ⇒ chỉ nêu cái đã làm được', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: meCua(true) }],
      ['/holdem/me/nang-luc', { status: 200, body: NANG_LUC }],
    ]);
    veTuTran();
    const p = await screen.findByTestId('tu-tran');
    expect(p.textContent).toContain(CHU_NANG_LUC.tuTranPre);
    expect(p.textContent).toContain('giữ sổ');
    expect(p.textContent).not.toMatch(/lọc tin|chia giỏ/);
  });

  it('cửa đóng ⇒ không gọi năng lực, không vẽ dòng', async () => {
    const goi = stubFetch([
      ['/auth/me', { status: 200, body: meCua(false) }],
      ['/holdem/me/nang-luc', { status: 200, body: NANG_LUC }],
    ]);
    veTuTran();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('tu-tran')).toBeNull();
    expect(goi.some((g) => g.url.includes('/holdem/me/nang-luc'))).toBe(false);
  });
});

describe('(c) A10 — chữ mới không kê đơn', () => {
  it('mọi chuỗi tran* của GƯƠNG và dòng Từ trận không chứa từ kê đơn', () => {
    const chu = Object.entries(C).filter(([k]) => k.startsWith('tran') || k === 'napTran').map(([, v]) => v);
    chu.push(CHU_NANG_LUC.tuTranPre);
    const vi_pham = chu.flatMap((c) => TU_KE_DON.filter((tu) => ` ${c.toLowerCase()} `.includes(tu)).map((tu) => `${tu.trim()}: ${c}`));
    expect(vi_pham).toEqual([]);
  });
});
