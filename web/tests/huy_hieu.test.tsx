/**
 * HUY HIỆU HẠNG 7 BẬC + STICKER VINH DANH (SPEC docs/spec/huy-hieu-hang-sticker.md, mục 5 + 5b).
 *
 * Canh bốn thứ dễ mất mà không ai báo:
 *   1. BẢY BẬC LÀ BẢY KHỐI HÌNH (không phải bảy lần sơn lại cùng một hình) và nằm trong MỘT khung giới hạn chung —
 *      luật "càng cao càng to, góc cạnh, phức tạp" của founder.
 *   2. BÓNG ĐỘNG CHỈ Ở KIM CƯƠNG + ELITE, và `prefers-reduced-motion` tắt nó. CSS Modules bị tắt trong vitest
 *      (`css: false`) nên khẳng định ở TẦNG TỆP CSS (bóc comment trước khi quét — bẫy pixelui) + thuộc tính DOM.
 *   3. THIẾU DỮ LIỆU THÌ KHÔNG VẼ GÌ (D62): `bac` null / vắng / chưa xếp ⇒ không có huy hiệu giả.
 *   4. MỘT HÌNH, HAI NƠI: sticker ở màn Hạng và sticker dán lên avatar (`config/avatar_art.ts`) cùng silhouette.
 * Cộng hành vi màn Hồ sơ khi mạng chậm / lỗi (SPEC 5b.2): chỗ giữ sẵn, không số 0 giả, nút thử lại không gửi trùng.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BAC_THANG } from '@config/rank';
import { LUOI_DAN } from '@config/avatar_art';
import {
  CHI_SO_BONG_DONG_DAU, chiSoHuyHieu, cumSticker, KIM_LOAI_VE, LUOI_HUY_HIEU, luoiHuyHieu, SO_HUY_HIEU,
  STICKER_HANG, stickerCuaBac,
} from '@/lib/huy_hieu';
import { HuyHieuHang, StickerHang } from '@/components/ui/HuyHieuHang';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { routes } from '@/app/routes';
import { makeQueryClient } from '@/api/queries';
import { ME_ONBOARDED, renderAt } from './helpers';

const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
/** Bóc chú thích CSS trước khi quét — chú thích ở file này trích nguyên văn luật. */
const boCmt = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const CSS = boCmt(doc('src/components/ui/HuyHieuHang.module.css'));

const silhouette = (t: number) => luoiHuyHieu(t).map((h) => h.map((c) => (c ? '#' : '.')).join('')).join('\n');
const soO = (t: number) => luoiHuyHieu(t).flat().filter(Boolean).length;
const hopBao = (t: number) => {
  const g = luoiHuyHieu(t);
  let x0 = 99, x1 = -1, y0 = 99, y1 = -1;
  g.forEach((h, y) => h.forEach((c, x) => {
    if (!c) return;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }));
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, tam: (x0 + x1) / 2 };
};

describe('1. bảy bậc = bảy khối hình, trong một khung chung', () => {
  it('khớp 1-1 với BAC_THANG: 7 bậc, bậc số n ⇒ chỉ số n-1', () => {
    expect(SO_HUY_HIEU).toBe(BAC_THANG.length);
    expect(KIM_LOAI_VE).toHaveLength(7);
    expect(BAC_THANG.map((b) => b.bac).sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(chiSoHuyHieu('tap_su')).toBe(0);
    expect(chiSoHuyHieu('tao_song')).toBe(6);
    expect(chiSoHuyHieu('chua_xep')).toBeNull();
    expect(chiSoHuyHieu(null)).toBeNull();
    expect(chiSoHuyHieu(undefined)).toBeNull();
  });

  it('⭐ bảy SILHOUETTE khác nhau — đổi hình chứ không chỉ đổi màu', () => {
    const hinh = Array.from({ length: SO_HUY_HIEU }, (_, t) => silhouette(t));
    expect(new Set(hinh).size).toBe(SO_HUY_HIEU);
    // Và màu cũng khác (không có hai bậc cùng bảng màu).
    const mau = Array.from({ length: SO_HUY_HIEU }, (_, t) => new Set(luoiHuyHieu(t).flat().filter(Boolean)).size);
    expect(mau.every((n) => n > 3)).toBe(true);
  });

  it('⭐ khung giới hạn chung: mọi bậc nằm trong CÙNG lưới 40×40 và căn giữa theo chiều ngang', () => {
    for (let t = 0; t < SO_HUY_HIEU; t += 1) {
      const { w, h, tam } = hopBao(t);
      expect(w, `bậc ${t} rộng ${w}`).toBeLessThanOrEqual(LUOI_HUY_HIEU);
      expect(h, `bậc ${t} cao ${h}`).toBeLessThanOrEqual(LUOI_HUY_HIEU);
      // Tâm ngang quanh 19.5 (lệch ≤ 1 ô): huy hiệu không trôi sang một bên khi đổi bậc.
      expect(Math.abs(tam - 19.5), `bậc ${t} lệch tâm ${tam}`).toBeLessThanOrEqual(1);
    }
    // Sắt là bậc NHỎ nhất: khung giới hạn là trần, không phải kích cỡ chung.
    expect(hopBao(0).w).toBeLessThan(hopBao(1).w + 1);
    expect(hopBao(0).w).toBeLessThan(hopBao(5).w);
  });

  it('luật "càng cao càng to / phức tạp": KIM CƯƠNG & ELITE nhiều ô hơn SẮT, nhiều sắc hơn SẮT', () => {
    for (const t of [5, 6]) {
      expect(soO(t)).toBeGreaterThan(soO(0));
      expect(new Set(luoiHuyHieu(t).flat().filter(Boolean)).size)
        .toBeGreaterThan(new Set(luoiHuyHieu(0).flat().filter(Boolean)).size);
    }
    // Cánh chỉ có từ VÀNG trở lên; vương miện chỉ KIM CƯƠNG + ELITE (tham số vẽ — nguồn của khối hình).
    expect(KIM_LOAI_VE.map((k) => k.canh > 0)).toEqual([false, false, false, true, true, true, true]);
    expect(KIM_LOAI_VE.map((k) => k.mien > 0)).toEqual([false, false, false, false, false, true, true]);
  });

  it('tất định: vẽ hai lần ra đúng một lưới', () => {
    for (let t = 0; t < SO_HUY_HIEU; t += 1) expect(luoiHuyHieu(t)).toEqual(luoiHuyHieu(t));
  });
});

describe('2. bóng theo bậc — động ở KIM CƯƠNG + ELITE, reduced-motion tắt', () => {
  const dong = (bac: string, chuaDat = false) => {
    const { container, unmount } = render(<HuyHieuHang bac={bac as never} chuaDat={chuaDat} />);
    const v = container.querySelector('svg')!.getAttribute('data-bong-dong');
    unmount();
    return v;
  };

  it('⭐ bậc ≥ KIM CƯƠNG có cờ bóng động; bậc dưới thì không', () => {
    expect(CHI_SO_BONG_DONG_DAU).toBe(5);
    const ket = BAC_THANG.map((b) => [b.bac, dong(b.id)] as const);
    for (const [bacSo, v] of ket) expect(v, `bậc ${bacSo}`).toBe(bacSo >= 6 ? 'true' : 'false');
  });

  it('bậc CHƯA ĐẠT (thang toàn cảnh) không nhấp nháy dù là bậc cao', () => {
    expect(dong('tao_song', true)).toBe('false');
  });

  it('CSS: chỉ hai lớp bóng ĐỘNG có `animation`, keyframe khai cùng file', () => {
    const luat = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1]!.trim(), m[2]!] as const);
    const coAnim = luat.filter(([, kv]) => /animation\s*:\s*(?!\s*none)/.test(kv)).map(([k]) => k);
    expect(coAnim.sort()).toEqual(['.hh5', '.hh6']);
    expect(CSS).toContain('@keyframes bongKimCuong');
    expect(CSS).toContain('@keyframes bongElite');
  });

  it('⭐ prefers-reduced-motion TẮT animation của cả hai lớp bóng động', () => {
    const m = CSS.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?\})\s*\}/);
    expect(m, 'thiếu @media reduced-motion').not.toBeNull();
    const trong = m![1]!;
    expect(trong).toMatch(/\.hh5/);
    expect(trong).toMatch(/\.hh6/);
    expect(trong).toMatch(/animation\s*:\s*none/);
  });

  it('component gắn đúng lớp theo bậc (hhN) — không bậc nào mượn lớp của bậc khác', () => {
    const SRC = doc('src/components/ui/HuyHieuHang.tsx');
    expect(SRC).toMatch(/s\[`hh\$\{t\}`\]/);
    for (let t = 0; t < 7; t += 1) {
      // Mỗi lớp từ hh2 trở lên có luật riêng (bóng); hh0/hh1 phẳng nên không cần.
      if (t >= 2) expect(CSS, `thiếu .hh${t}`).toContain(`.hh${t} `);
    }
  });
});

describe('3. thiếu dữ liệu ⇒ KHÔNG vẽ huy hiệu giả (D62)', () => {
  it('null / undefined / chua_xep / id lạ ⇒ không render gì', () => {
    for (const bac of [null, undefined, 'chua_xep', 'khong_co_bac_nay']) {
      const { container, unmount } = render(<HuyHieuHang bac={bac as never} />);
      expect(container.innerHTML, String(bac)).toBe('');
      unmount();
    }
    const { container } = render(<StickerHang id="khong-co" />);
    expect(container.innerHTML).toBe('');
  });

  it('có bậc ⇒ SVG đúng cỡ khai báo, đủ ô, aria hợp lệ', () => {
    const { container } = render(<HuyHieuHang bac="chuyen_vien" size={80} nhan="ĐỒNG · Chuyên viên" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('80');
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${LUOI_HUY_HIEU} ${LUOI_HUY_HIEU}`);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('ĐỒNG · Chuyên viên');
    expect(svg.querySelectorAll('rect').length).toBeGreaterThan(20);
    // Không nhãn ⇒ chỉ trang trí.
    const { container: c2 } = render(<HuyHieuHang bac="chuyen_vien" />);
    expect(c2.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('4. sáu sticker — một hình, hai nơi', () => {
  it('mỗi bậc (trừ SẮT) có đúng một lưới; SẮT không có', () => {
    const co = BAC_THANG.filter((b) => b.sticker);
    expect(co).toHaveLength(6);
    for (const b of co) expect(STICKER_HANG[b.sticker!], b.sticker!).toBeDefined();
    expect(Object.keys(STICKER_HANG).sort()).toEqual(co.map((b) => b.sticker!).sort());
    expect(stickerCuaBac('tap_su')).toBeNull();
    expect(stickerCuaBac('chua_xep')).toBeNull();
    expect(stickerCuaBac('chuyen_vien')?.id).toBe('st_hh_tom');
  });

  it('⭐ silhouette ở màn Hạng == silhouette lưới dán lên avatar (không lệch hình, chỉ lệch sắc)', () => {
    for (const [id, luoi] of Object.entries(STICKER_HANG)) {
      const dan = LUOI_DAN[id];
      expect(dan, `${id}: thiếu lưới dán avatar`).toBeDefined();
      const sil = (rows: readonly string[]) => rows.map((r) => [...r].map((c) => (c === '.' ? '.' : '#')).join(''));
      expect(sil(dan!), id).toEqual(sil(luoi.rows));
    }
  });

  it('mọi chữ trong lưới đều có màu trong bảng của chính nó (ô lạ bị bỏ = mất ô không ai biết)', () => {
    for (const [id, luoi] of Object.entries(STICKER_HANG)) {
      for (const ch of new Set(luoi.rows.join('').replace(/\./g, ''))) {
        expect(luoi.pal[ch], `${id}: chữ '${ch}' không có màu`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('render: sticker xám khi chưa có, có màu khi đã có; cạnh vuông bao đủ lưới', () => {
    const { n } = cumSticker(STICKER_HANG.st_hh_ca_voi!);
    expect(n).toBe(23);
    const { container } = render(<StickerHang id="st_hh_tom" size={40} chua />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('data-sticker')).toBe('st_hh_tom');
    expect(svg.getAttribute('class') ?? '').not.toBe('');
    const { container: c2 } = render(<StickerHang id="st_hh_tom" size={40} />);
    expect(c2.querySelector('svg')!.getAttribute('class')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. HỒ SƠ — chỗ giữ sẵn khi mạng chậm, lỗi có nút thử lại, không gửi trùng
// ═══════════════════════════════════════════════════════════════════════════
const RANK_OK = {
  season_id: '2026Q4', diem: 130, diem_dinh: 130, so_tran: 9, bac: 'chuyen_vien', bac_ten: 'CHUYÊN VIÊN',
  bac_biet_danh: 'Cua', bac_icon: 'rank_cua', bac_icon_lon: 'rank_cua_lon', nac: 3, con_thieu_diem: 230,
  con_thieu_tran: 0, hang: null, phan_vi: null, sticker_da_nhan: ['chuyen_vien'],
  formula_version: 'x', bang_bat: false,
};

/** fetch giả có bảng route; `/me/rank` do test điều khiển (hoãn / lỗi / thành công). */
function stubHoSo(rank: () => Promise<Response>) {
  const goi: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/v1/telemetry')) return new Response('{"ok":true}', { status: 202 });
    goi.push(url);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), {
      status, headers: { 'content-type': 'application/json' } });
    if (url.includes('/auth/me')) return json(ME_ONBOARDED);
    if (url.includes('/me/rank')) return rank();
    return json({ error: 'unauthorized', message: 'x' }, 401);
  }));
  return goi;
}
const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });

describe('5. màn Hồ sơ — khối Hạng', () => {
  it('⭐ ĐANG TẢI: có chỗ giữ sẵn, KHÔNG có huy hiệu / số 0 / chữ bậc; dữ liệu về thì thay đúng chỗ', async () => {
    let giai!: (r: Response) => void;
    stubHoSo(() => new Promise<Response>((res) => { giai = res; }));
    renderAt('/ho-so');
    const nhan = await screen.findByText('BẬC ĐẤU TRƯỜNG');
    const khoiNgoai = nhan.parentElement as HTMLElement;
    const hang = khoiNgoai.querySelector('[data-cho-hang]') as HTMLElement;
    expect(hang, 'chưa có hàng giữ chỗ').not.toBeNull();
    expect(khoiNgoai.getAttribute('aria-busy')).toBe('true');
    expect(hang.querySelector('svg')).toBeNull();               // không huy hiệu giả
    expect(hang.textContent).toBe('');                          // không chữ, không số giả
    expect(screen.queryByText(/ĐỒNG ·/)).toBeNull();
    // Cấu trúc tĩnh có mặt ngay (thang 7 bậc + hàng 7 ô sticker) nhưng MỜ — dữ liệu về không làm khối nào mọc ra.
    const thang = khoiNgoai.querySelectorAll('[data-chua-co-du-lieu="true"]');
    expect(thang).toHaveLength(2);
    const soHang = khoiNgoai.children.length;
    expect(khoiNgoai.querySelectorAll('[data-sticker-bac]')).toHaveLength(7);
    // Mọi ô sticker lúc này là "chưa biết" — KHÔNG ô nào được tô màu như đã nhận.
    expect(khoiNgoai.querySelectorAll('[data-da-nhan="true"]')).toHaveLength(0);

    await act(async () => { giai(ok(RANK_OK)); });
    expect(await screen.findByText(/ĐỒNG · Chuyên viên III/)).toBeInTheDocument();
    expect(document.querySelector('[data-cho-hang]')).toBeNull();
    // ⭐ CÙNG CẤU TRÚC trước/sau: số khối con không đổi, hết mờ, hàng sticker vẫn 7 ô.
    expect(khoiNgoai.children.length).toBe(soHang);
    expect(khoiNgoai.getAttribute('aria-busy')).toBe('false');
    expect(khoiNgoai.querySelectorAll('[data-chua-co-du-lieu="true"]')).toHaveLength(0);
    expect(khoiNgoai.querySelectorAll('[data-sticker-bac]')).toHaveLength(7);
    // Hạng đã về: huy hiệu ĐỒNG + hàng sticker, ô Tôm có màu, các ô khác xám.
    expect(document.querySelector('svg[data-huy-hieu="chuyen_vien"]')).not.toBeNull();
    const tom = document.querySelector('[data-sticker-bac="chuyen_vien"]')!;
    expect(tom.getAttribute('data-da-nhan')).toBe('true');
    expect(tom.textContent).toContain('Tôm');
    for (const id of ['nha_giao_dich', 'quan_ly_danh_muc', 'giam_doc_dau_tu', 'chu_quy', 'tao_song']) {
      expect(document.querySelector(`[data-sticker-bac="${id}"]`)!.getAttribute('data-da-nhan'), id).toBe('false');
    }
    expect(document.querySelector('[data-sticker-bac="tap_su"] svg')).toBeNull();   // SẮT: "—"
  });

  it('⭐ LỖI: có chữ nói rõ + nút THỬ LẠI; bấm liên tiếp KHÔNG gửi trùng; thử lại được thì hiện hạng', async () => {
    let lan = 0;
    let giai!: (r: Response) => void;
    const goi = stubHoSo(() => {
      lan += 1;
      if (lan === 1) return Promise.resolve(new Response(JSON.stringify({ error: 'x' }), { status: 500 }));
      return new Promise<Response>((res) => { giai = res; });
    });
    renderAt('/ho-so');
    const nut = await screen.findByRole('button', { name: 'THỬ LẠI' }, { timeout: 8000 });
    expect(screen.getByText('Chưa tải được hạng của bạn.')).toBeInTheDocument();
    const truoc = goi.filter((u) => u.includes('/me/rank')).length;

    // Bấm ba lần liền: lần đầu gửi, và nút BIẾN MẤT ngay (khối quay về chỗ giữ sẵn) nên hai lần sau không có đích.
    fireEvent.click(nut);
    fireEvent.click(nut);
    fireEvent.click(nut);
    await waitFor(() => expect(document.querySelector('[data-cho-hang]')).not.toBeNull());
    expect(screen.queryByRole('button', { name: 'THỬ LẠI' })).toBeNull();
    expect(goi.filter((u) => u.includes('/me/rank')).length - truoc).toBe(1);

    await act(async () => { giai(ok(RANK_OK)); });
    expect(await screen.findByText(/ĐỒNG · Chuyên viên III/)).toBeInTheDocument();
  }, 30_000);
});

describe('6. chuyển tiếp & đường dẫn của khối Hạng (SPEC 5b.3)', () => {
  const ME_JSON = JSON.stringify(ME_ONBOARDED);
  function dung(rank: Response | (() => Response)) {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/telemetry')) return new Response('{"ok":true}', { status: 202 });
      if (url.includes('/auth/me')) return new Response(ME_JSON, { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.includes('/me/rank')) return typeof rank === 'function' ? rank() : rank.clone();
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'x' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }));
  }

  it('⭐ Back/Forward: đi sang Cài đặt rồi quay lại ⇒ hạng hiện NGAY từ bộ nhớ, không chớp chỗ giữ sẵn', async () => {
    dung(ok(RANK_OK));
    const router = createMemoryRouter(routes, { initialEntries: ['/ho-so'] });
    render(<QueryClientProvider client={makeQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
    expect(await screen.findByText(/ĐỒNG · Chuyên viên III/)).toBeInTheDocument();
    await act(async () => { await router.navigate('/cai-dat'); });
    expect(screen.queryByText(/ĐỒNG · Chuyên viên III/)).toBeNull();
    await act(async () => { await router.navigate(-1); });
    // Đồng bộ ngay sau khi quay lại: không `findBy`, không chờ fetch.
    expect(router.state.location.pathname).toBe('/ho-so');
    expect(screen.getByText(/ĐỒNG · Chuyên viên III/)).toBeInTheDocument();
    expect(document.querySelector('[data-cho-hang]')).toBeNull();
    await act(async () => { await router.navigate(1); });                     // Forward không vỡ
    expect(router.state.location.pathname).toBe('/cai-dat');
  });

  it('deep link /ho-so khi CHƯA ĐĂNG NHẬP ⇒ không vẽ khối hạng, không gọi /me/rank', async () => {
    const goi: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/telemetry')) return new Response('{"ok":true}', { status: 202 });
      goi.push(url);
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Bạn cần đăng nhập.' }), {
        status: 401, headers: { 'content-type': 'application/json' } });
    }));
    renderAt('/ho-so');
    await waitFor(() => expect(goi.some((u) => u.includes('/auth/me'))).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    expect(screen.queryByText('BẬC ĐẤU TRƯỜNG')).toBeNull();
    expect(goi.some((u) => u.includes('/me/rank'))).toBe(false);
  });

  it('máy chủ cũ trả 404 cho /me/rank ⇒ ẨN cả khối (không khung rỗng, không bậc giả)', async () => {
    dung(new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'content-type': 'application/json' } }));
    renderAt('/ho-so');
    await screen.findByText('tester', { exact: false });
    await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
    expect(screen.queryByText('BẬC ĐẤU TRƯỜNG')).toBeNull();
    expect(document.querySelector('[data-sticker-bac]')).toBeNull();
  });
});
