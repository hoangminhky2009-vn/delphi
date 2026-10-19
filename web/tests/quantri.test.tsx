/**
 * APP QUẢN TRỊ RIÊNG `/quan-tri` (D335) — tách gói · trạng thái URL · màn chạy thật với API giả.
 *
 * Lịch sử: file này từng canh màn `/quan-tri` NẰM TRONG app người chơi (bước 3, §8.1 "tách gói bằng lazy"). Đo
 * 15/09 thì `lazy` không đủ: service worker vẫn precache chunk quản trị về máy MỌI người chơi. D335 tách hẳn thành
 * trang HTML thứ hai và gom công cụ quản trị về đó; `/admin` chỉ còn mã hai lớp, quyền, và ba thao tác chuyển token.
 *
 * ⚠ HAI BẤT BIẾN ĐẦU QUAN TRỌNG NHẤT, và cả hai hỏng ÂM THẦM:
 *  1. Gói quản trị KHÔNG được rơi về gói người chơi — app vẫn chạy đúng, chỉ nặng thêm, không ai nhận ra.
 *  2. `/admin` (trang Hono cứu hộ) KHÔNG được SPA chiếm — đường thoát chết đúng lúc cần nó.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ME_ONBOARDED, stubFetch } from './helpers';
import { chuoiLoc } from '../src/api/thongke';
import { nhanBanTheoThang } from '../src/api/quankeo';
// Thân API giả gắn CÙNG kiểu mà route máy chủ gắn (`server/admin_phan_tich_ids.ts`): bài màn không thể xanh trên một
// hình dạng máy chủ không bao giờ trả.
import type {
  ChiaNhomDTO, ChiSoNhomDTO, DsNguoiDTO, HanhTrinhDTO, MotNguoiDTO, NhomLuuDTO, OSoDTO, PhienBanDTO, TinhNhomDTO,
  TongQuanPTDTO,
} from '../src/api/phantich';
import { urlSanPham } from '../src/api/phantich';
import { makeQueryClient } from '../src/api/queries';
import { QuanTriApp } from '../src/quan-tri/App';
import { congNgay, docTrangThai, ghiTrangThai, ngayVN, soNgayKhoang, thoiLuong } from '../src/quan-tri/khoang';
import { BUOC_HUONG_DAN, BUOC_TAT_TRO_LY } from '@config/telemetry';

const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/** Mọi file nguồn dưới `src/`, trừ hai thư mục của app quản trị. */
function nguonNgoaiQuanTri(): string[] {
  const ra: string[] = [];
  const di = (d: string) => {
    for (const e of readdirSync(join(process.cwd(), d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) { if (!p.endsWith('/screens/admin') && !p.endsWith('/quan-tri')) di(p); }
      else if (/\.(ts|tsx)$/.test(e.name)) ra.push(p);
    }
  };
  di('src');
  return ra;
}

/** Dựng đúng như `src/quan-tri/main.tsx`: một route `*`, mọi trạng thái nằm ở query. */
function renderQuanTri(duong: string) {
  const router = createMemoryRouter([{ path: '*', element: <QuanTriApp /> }], { initialEntries: [duong] });
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

type Tuyen = [string, { status: number; body: unknown }];

/** ⚠ `ME_ONBOARDED` là role 'user' — cổng quyền chặn đúng, nên phải có bản admin. */
const ME_ADMIN = { ...ME_ONBOARDED, user: { ...ME_ONBOARDED.user!, role: 'admin' as const, handle: 'quan_tri_a' } };
const HOM_NAY = ngayVN(Date.now());
const ok = (body: unknown) => ({ status: 200, body });

const QL = (nhom: number, co: number, chua_toi = 0) => ({ nhom, co, chua_toi, het_tho: 0 });
const O_SO: OSoDTO = {
  tai_khoan_moi: 9, tai_khoan_moi_khach: 1, tran: 3, tran_xong: 2, tran_bo_do: 1, tran_dang_choi: 0,
  do_duoc: true, cat_tho: false, nguoi_hoat_dong: 6, phien: 9, phien_co_thoi_luong: 5, ms_moi_phien_tv: 300_000,
  quay_lai: QL(5, 3, 2),
};
/** Thân tổng quan HỢP LỆ — khung đọc nó ở mọi khu (dòng ghi của thanh thời gian), nên mọi bài đều cần. */
const TQ_PT: TongQuanPTDTO = {
  khoang: {
    tu: congNgay(HOM_NAY, -29), den: HOM_NAY, so_ngay: 30, hom_nay: HOM_NAY, tho_tu: congNgay(HOM_NAY, -60),
    ky_truoc: { tu: congNgay(HOM_NAY, -59), den: congNgay(HOM_NAY, -30) },
  },
  gom: false, san: 5,
  pham_vi: { tat_ca: 11, bat_ghi: 7 },
  nay: O_SO,
  truoc: { ...O_SO, tai_khoan_moi: 3, nguoi_hoat_dong: 4, quay_lai: QL(2, 1) },
  chuoi: [{ ngay: HOM_NAY, tai_khoan_moi: 1, nguoi_hoat_dong: 2 }],
  pheu: { tao_tai_khoan: 10, xac_minh: 9, lap_ho_so: 8, bat_ghi: 7, xong_tap: 1, vao_tran: 3, xong_3_tran: 1, quay_lai: QL(5, 3, 2) },
  giu_chan: [
    { tu: congNgay(HOM_NAY, -6), den: HOM_NAY, n: null,
      tuan: [{ trang_thai: 'chua_toi' }, { trang_thai: 'chua_toi' }, { trang_thai: 'chua_toi' }, { trang_thai: 'chua_toi' }] },
    { tu: congNgay(HOM_NAY, -20), den: congNgay(HOM_NAY, -14), n: 5,
      tuan: [{ trang_thai: 'co', n: 5, co: 3 }, { trang_thai: 'co', n: 5, co: 3 }, { trang_thai: 'it' }, { trang_thai: 'chua_toi' }] },
  ],
  man: [{ man: '/arena', luot: 2, nguoi: 2, ms_tong: 135_000, ms_moi_nguoi_tv: 67_500 }],
  loi: [{ man: '/arena', loai: 'loi_api', ma: 'timeout', n: 2 }],
};
const NEN: Tuyen[] = [['/auth/me', ok(ME_ADMIN)], ['/admin/pt/tong-quan', ok(TQ_PT)]];

/** Khoảng như máy chủ trả (D341 — năm mặt SẢN PHẨM đều trả kèm). */
const KH = (tu: string, den: string) => ({
  tu, den, so_ngay: soNgayKhoang(tu, den), hom_nay: HOM_NAY, tho_tu: congNgay(HOM_NAY, -60),
  ky_truoc: { tu: congNgay(tu, -soNgayKhoang(tu, den)), den: congNgay(tu, -1) },
});
/** Thân HÀNH TRÌNH hợp lệ, 7 ngày tới hôm nay. */
const HT: HanhTrinhDTO = {
  khoang: KH(congNgay(HOM_NAY, -6), HOM_NAY), gom_admin: false, gom_tester: false, do_duoc: true, cat_tho: false,
  phieu_dang_ky: [
    { buoc: 'tao-tai-khoan', so_nguoi: 5, ty_le_con_lai: 1 }, { buoc: 'xac-minh-email', so_nguoi: 4, ty_le_con_lai: 0.8 },
    { buoc: 'xong-ho-so', so_nguoi: 4, ty_le_con_lai: 0.8 }, { buoc: 'tran-dau', so_nguoi: 2, ty_le_con_lai: 0.4 },
  ],
  man_dang_ky: [{ buoc: 'mo-dang-ky', so_nguoi: 3, ty_le_con_lai: 1 }, { buoc: 'gui-dang-ky', so_nguoi: 2, ty_le_con_lai: 2 / 3 }],
  // D359 — rổ riêng của ván dạy. Số ở đây CỐ Ý không khớp ô TRẬN bên dưới: hai rổ khác nhau.
  ban_tap: { so_nguoi_vao: 4, so_tran: 6, so_xong: 2, so_bo_do: 4, bo_o_vong: [{ vong: 2, n: 3 }, { vong: 5, n: 1 }] },
  loi_client: [],
  dang_nhap: { so_lan: 3, giay_p50: 12, giay_p90: 40 },
  sau_dang_nhap: [{ man: '/arena', n: 2 }],
  huong_dan: {
    bat_dau: 2, di_het: 1, tu_tat: 0, xong_roi_o_lai: 1, xong_roi_di_luon: 0,
    buoc: BUOC_HUONG_DAN.map((b, i) => ({ buoc: b, so_nguoi: i === 0 ? 2 : 1, ty_le_con_lai: i === 0 ? 1 : 0.5 })),
  },
  tran: {
    so_lan_vao: 2, so_xong: 1, so_dang_choi: 0, so_lan_bo_do: 1, phut_p50: 10, phut_p90: 10,
    bo_do_theo_phut: [{ phut: 5, n: 1 }], bo_do_theo_vong: [{ vong: 3, n: 1 }], client_kip_bao: 1,
  },
  man_cuoi: { trang_thai: 'co', tinh_toi: new Date(Date.now() - 86_400_000).toISOString(), dong: [{ man: '/hub', n: 1 }] },
};

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Tách gói — quản trị KHÔNG rơi về app người chơi', () => {
  it('router người chơi không biết `/quan-tri` và không nạp màn quản trị nào (kể cả lazy)', () => {
    const src = doc('src/app/routes.tsx');
    expect(src).not.toMatch(/screens\/admin|quan-tri\//);
    expect(src).not.toMatch(/ROUTE_QUAN_TRI|path:\s*['"]\/quan-tri/);
  });

  it('không file nào ngoài hai thư mục quản trị import màn/khung quản trị — tĩnh hay động', () => {
    /*
     * ⚠ Cái bẫy thật: chỉ cần MỘT import ở bất kỳ đâu trong cây người chơi là rollup kéo module quản trị vào gói
     * người chơi. Không có gì báo — app chạy đúng, chỉ nặng lên. Bắt cả `import('…')`: gói lazy vẫn là chunk của
     * cửa vào người chơi.
     */
    const pham = nguonNgoaiQuanTri().filter((f) =>
      /(from\s+|import\s*\(\s*)['"][^'"]*(screens\/admin\/|quan-tri\/)/.test(doc(f)));
    expect(pham, `file kéo gói quản trị vào gói người chơi: ${pham.join(', ')}`).toEqual([]);
  });

  it('bốn tầng API của quản trị chỉ được dùng từ thư mục quản trị', () => {
    for (const mo of ['thongke', 'quankeo', 'phantich', 'vanhanh']) {
      const pham = nguonNgoaiQuanTri().filter((f) =>
        f !== `src/api/${mo}.ts` && new RegExp(`(from\\s+|import\\s*\\(\\s*)['"][^'"]*api/${mo}['"]`).test(doc(f)));
      expect(pham, `file kéo api/${mo} vào gói chung: ${pham.join(', ')}`).toEqual([]);
    }
  });

  it('build có hai cửa vào; chunk quản trị mang tiền tố qt-; service worker bỏ qua cả tệp lẫn đường', () => {
    /*
     * Ba chỗ phải khớp nhau (chú thích đầu `vite.config.ts`): thiếu `input` thì trang không được build; thiếu tiền
     * tố thì `globIgnores` không nhận ra chunk; thiếu `globIgnores` thì sw.js precache gói quản trị về máy người
     * chơi — đúng thứ đo được trước D335.
     */
    const v = doc('vite.config.ts');
    expect(v).toMatch(/quanTri:\s*path\.resolve\(__dirname,\s*'quan-tri\.html'\)/);
    for (const thuMuc of ["'/src/quan-tri/'", "'/src/screens/admin/'", "'/src/api/phantich'", "'/src/api/vanhanh'",
      "'/src/api/thongke'", "'/src/api/quankeo'"]) expect(v).toContain(thuMuc);
    expect(v).toContain("'assets/qt-[name]-[hash].js'");
    // D594 thêm `phien-ban.json` (tệp bản ở biên, service worker không được giữ) — vẫn khẳng định NGUYÊN dòng, đủ ba mẫu.
    expect(v).toContain("globIgnores: ['**/quan-tri.html', '**/assets/qt-*', '**/phien-ban.json']");
    expect(v).toContain('/^\\/quan-tri/');
  });

  it('quan-tri.html trỏ đúng cửa vào; cửa vào KHÔNG đăng ký service worker, telemetry, Discord', () => {
    // ⚠ Telemetry ở đây không chỉ thừa: hành vi người quản trị đi vào số đo người chơi là thứ D212 dựng ra để chặn.
    expect(doc('quan-tri.html')).toContain('src="/src/quan-tri/main.tsx"');
    expect(doc('quan-tri.html')).toContain('noindex');
    const m = doc('src/quan-tri/main.tsx');
    // ⚠ Bắt cả `import '…'` trần (chỉ để chạy tác dụng phụ) và `import('…')` — bản đầu chỉ bắt `from '…'`, và tiêm
    //   `import '@/lib/telemetry'` vào đây thì bài vẫn xanh.
    expect(m).not.toMatch(/(from\s+|import\s*\(?\s*)['"][^'"]*(pwa-register|lib\/telemetry|discord|AppShell|app\/routes)/i);
    expect(m).toMatch(/createBrowserRouter\(\[\{\s*path:\s*'\*',\s*element:\s*<QuanTriApp \/>\s*\}\]\)/);
  });

  it('vỏ HTML quản trị không được giữ ở biên (vỏ cũ trỏ vào bundle đã xoá = trang trắng)', () => {
    const h = doc('public/_headers');
    expect(h).toMatch(/^\/quan-tri\r?\n\s+Cache-Control: no-store/m);
    expect(h).toMatch(/^\/quan-tri\.html\r?\n\s+Cache-Control: no-store/m);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. `/admin` vẫn là đường thoát, KHÔNG bị SPA chiếm', () => {
  it('router không khai route nào cho /admin', () => {
    expect(doc('src/app/routes.tsx')).not.toMatch(/path:\s*['"]\/admin/);
  });

  it('service worker vẫn để /admin ra mạng (denylist còn nguyên)', () => {
    // Bug thật 19/07: SW trả index.html từ cache nên request CHƯA BAO GIỜ ra tới mạng — và `curl` không tái hiện
    // được vì curl không chạy SW.
    expect(doc('vite.config.ts')).toContain('/^\\/admin/');
  });

  it('Worker vẫn proxy /admin sang Hono — còn /quan-tri thì KHÔNG (nó là tệp tĩnh ở biên)', () => {
    expect(doc('wrangler.jsonc')).toContain('"/admin"');
    // Nếu `/quan-tri` lọt vào run_worker_first thì nó đi sang Vercel và tệp HTML ở biên không bao giờ được phục vụ.
    expect(doc('wrangler.jsonc')).not.toContain('quan-tri');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Trạng thái sống ở URL', () => {
  const bay = Date.parse('2026-09-15T05:00:00Z');
  const q = (s: string) => new URLSearchParams(s);

  it('mặc định: tổng quan · 30 ngày tới hôm nay · so kỳ trước bật · loại quản trị & thử', () => {
    expect(docTrangThai(q(''), bay)).toEqual({
      khu: 'tong', moc: '30', tu: '2026-08-17', den: '2026-09-15', soKy: true, gom: false, nguoi: null, tab: null,
    });
  });

  it('"hôm nay" là ngày GIỜ VIỆT NAM, không phải ngày UTC', () => {
    // 17:30 UTC ngày 15 = 00:30 ngày 16 ở Việt Nam.
    expect(docTrangThai(q('moc=hom_nay'), Date.parse('2026-09-15T17:30:00Z'))).toMatchObject({ tu: '2026-09-16', den: '2026-09-16' });
  });

  it('nút nhanh · tuỳ chọn (đổi chỗ, kẹp tương lai) · giá trị lạ về mặc định', () => {
    expect(docTrangThai(q('moc=7'), bay)).toMatchObject({ tu: '2026-09-09', den: '2026-09-15' });
    expect(docTrangThai(q('moc=hom_nay'), bay)).toMatchObject({ tu: '2026-09-15', den: '2026-09-15' });
    expect(docTrangThai(q('moc=tuy&tu=2026-09-10&den=2026-09-01'), bay)).toMatchObject({ tu: '2026-09-01', den: '2026-09-10' });
    expect(docTrangThai(q('moc=tuy&tu=2026-09-10&den=2027-01-01'), bay)).toMatchObject({ den: '2026-09-15' });
    expect(docTrangThai(q('moc=tuy&tu=2026-02-30&den=2026-09-01'), bay)).toMatchObject({ moc: '30', tu: '2026-08-17' });
    expect(docTrangThai(q('moc=tuy&tu=x&den=y'), bay)).toMatchObject({ moc: '30', tu: '2026-08-17' });
    expect(docTrangThai(q('khu=email'), bay).khu).toBe('tong');
  });

  it('`nguoi` chỉ có nghĩa ở khu NGƯỜI DÙNG và phải là handle hợp lệ', () => {
    expect(docTrangThai(q('khu=nguoi&nguoi=pt_u1'), bay).nguoi).toBe('pt_u1');
    expect(docTrangThai(q('khu=tong&nguoi=pt_u1'), bay).nguoi).toBeNull();
    expect(docTrangThai(q("khu=nguoi&nguoi=x'--"), bay).nguoi).toBeNull();
  });

  it('ghi: đổi nút nhanh xoá từ/đến; đổi khu xoá người + tab; giữ bộ lọc danh sách', () => {
    const t = ghiTrangThai(q('khu=nguoi&nguoi=a_b&tab=x&moc=tuy&tu=2026-09-01&den=2026-09-02&loc=ghi'), { moc: '7' });
    expect([t.get('tu'), t.get('den'), t.get('loc')]).toEqual([null, null, 'ghi']);
    const k = ghiTrangThai(t, { khu: 'phan' });
    expect([k.get('nguoi'), k.get('tab'), k.get('khu')]).toEqual([null, null, 'phan']);
    expect(ghiTrangThai(q(''), { soKy: false }).get('so_ky')).toBe('0');
    expect(ghiTrangThai(q('so_ky=0'), { soKy: true }).get('so_ky')).toBeNull();
  });

  it('thời lượng đọc được', () => {
    expect([thoiLuong(45_000), thoiLuong(200_000), thoiLuong(3_900_000), thoiLuong(null)])
      .toEqual(['45 giây', '3 phút 20 giây', '1 giờ 5 phút', '—']);
  });

  it('chuoiLoc (các mặt SẢN PHẨM) bỏ chiều rỗng, giữ chiều có giá trị', () => {
    expect(chuoiLoc({})).toBe('');
    expect(chuoiLoc({ vung: 'bac' })).toBe('?vung=bac');
    expect(chuoiLoc({ vung: 'bac', tuoi: '16-17' }, 30)).toBe('?tuoi=16-17&vung=bac&ngay=30');
    expect(chuoiLoc({ vung: null, tuoi: null, nghe: null })).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. Cổng vào — nói thật, không dựng vỏ rỗng', () => {
  it('KHÔNG phải admin → nói thẳng, KHÔNG bắn request quản trị nào', async () => {
    const calls = stubFetch([['/auth/me', ok({ ...ME_ONBOARDED, user: { ...ME_ONBOARDED.user!, role: 'user' } })]]);
    renderQuanTri('/quan-tri');
    expect(await screen.findByText('Trang này chỉ dành cho quản trị.')).toBeInTheDocument();
    /*
     * ⚠ Bản đầu (bước 3) dựng nguyên khung rồi để nó đứng ở "đang tải…" trong khi mọi lời gọi ăn 401 — người
     * chơi gõ nhầm đường thấy một trang quản trị hỏng, và admin chưa mở mã hai lớp cũng thấy y hệt.
     */
    expect(calls.filter((c) => c.url.includes('/admin/'))).toEqual([]);
    expect(screen.queryByText('TỔNG QUAN')).not.toBeInTheDocument();
  });

  it('khách chưa đăng nhập → chỉ đường đăng nhập, cũng không thấy vỏ', async () => {
    stubFetch([['/auth/me', { status: 401, body: { error: 'unauthorized', message: 'x' } }]]);
    renderQuanTri('/quan-tri');
    expect(await screen.findByText(/Đăng nhập bằng tài khoản quản trị/)).toBeInTheDocument();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/onboard');
  });

  it('mã hai lớp hết hạn → lời báo có đường bấm sang /admin (cửa nhập mã nằm ở đó)', async () => {
    stubFetch([
      ['/auth/me', ok(ME_ADMIN)],
      ['/admin/pt/tong-quan', { status: 403, body: { error: 'can_mo_khoa_2fa', message: 'Nhập mã hai lớp để mở quyền quản trị.' } }],
    ]);
    renderQuanTri('/quan-tri');
    const bao = await screen.findByTestId('can-ma-hai-lop');
    expect(bao).toHaveTextContent('Nhập mã hai lớp');
    expect(within(bao).getByRole('link').getAttribute('href')).toBe('/admin');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V. TỔNG QUAN — màn in đúng số server trả, đúng phạm vi', () => {
  it('ô số · chênh kỳ trước · phạm vi bật ghi · link về /admin · MỘT lượt hỏi', async () => {
    const calls = stubFetch(NEN);
    renderQuanTri('/quan-tri');
    const o = await screen.findByTestId('o-tai-khoan-moi');
    expect(o).toHaveTextContent('9');
    expect(o).toHaveTextContent('▲ 200% so với 3');
    expect(o).toHaveTextContent('tất cả tài khoản · 1 khách');
    expect(screen.getByTestId('o-hoat-dong')).toHaveTextContent('▲ 50% so với 4');
    expect(screen.getByTestId('o-phien')).toHaveTextContent('= kỳ trước');
    expect(screen.getByTestId('o-moi-phien')).toHaveTextContent('5phút');
    expect(screen.getByTestId('o-quay-lai')).toHaveTextContent('60%');
    // Kỳ trước chỉ 2 người tới tuần 2 ⇒ dưới sàn ⇒ KHÔNG có dòng chênh: không so với một tỷ lệ đã bị che.
    expect(screen.getByTestId('o-quay-lai')).not.toHaveTextContent('điểm %');
    expect(screen.getByTestId('tg-ghi')).toHaveTextContent('7/11 người đang bật ghi');
    expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === '/admin')).toBe(true);
    // Khung (dòng ghi) và khu dùng CHUNG một lượt hỏi — hai lượt là hai ảnh chụp, có thể lệch nhau.
    expect(calls.filter((c) => c.url.includes('/admin/pt/tong-quan'))).toHaveLength(1);
  });

  it('nút nhanh xếp đúng demo: Hôm nay · 7 · 30 · 90 (không để JS tự xếp khoá số lên trước)', async () => {
    stubFetch(NEN);
    renderQuanTri('/quan-tri');
    const thanh = await screen.findByRole('region', { name: 'Khoảng thời gian' });
    expect(within(thanh).getAllByRole('button').map((b) => b.textContent)).toEqual(['Hôm nay', '7 ngày', '30 ngày', '90 ngày']);
  });

  it('kỳ trước chỉ đo được MỘT PHẦN ⇒ ba ô hành vi không so (tránh cú ▲ giả) và nói ra; ô tài khoản vẫn so', async () => {
    // Kỳ trước 30 ngày mà dữ liệu phiên chỉ phủ vài ngày cuối: đếm của nó nhỏ vì THIẾU DỮ LIỆU, không phải vì ít người.
    const truoc: OSoDTO = { ...TQ_PT.truoc, cat_tho: true, nguoi_hoat_dong: 1, phien: 2 };
    stubFetch([['/auth/me', ok(ME_ADMIN)], ['/admin/pt/tong-quan', ok({ ...TQ_PT, truoc })]]);
    renderQuanTri('/quan-tri');
    for (const id of ['o-hoat-dong', 'o-phien', 'o-moi-phien']) {
      expect(await screen.findByTestId(id)).toHaveTextContent('kỳ trước chỉ đo được một phần');
      expect(screen.getByTestId(id)).not.toHaveTextContent(/▲|▼/);
    }
    expect(screen.getByTestId('o-tai-khoan-moi')).toHaveTextContent('so với');
  });

  it('kỳ trước nằm hẳn trước dữ liệu phiên ⇒ "kỳ trước chưa đo được", không để trống', async () => {
    const truoc: OSoDTO = { ...TQ_PT.truoc, do_duoc: false, nguoi_hoat_dong: null, phien: null, phien_co_thoi_luong: null, ms_moi_phien_tv: null };
    stubFetch([['/auth/me', ok(ME_ADMIN)], ['/admin/pt/tong-quan', ok({ ...TQ_PT, truoc })]]);
    renderQuanTri('/quan-tri');
    expect(await screen.findByTestId('o-hoat-dong')).toHaveTextContent('kỳ trước chưa đo được');
    expect(screen.getByTestId('o-moi-phien')).toHaveTextContent('kỳ trước chưa đo được');
  });

  it('tắt "so với kỳ trước" ⇒ không còn dòng chênh nào', async () => {
    stubFetch(NEN);
    renderQuanTri('/quan-tri?so_ky=0');
    expect(await screen.findByTestId('o-tai-khoan-moi')).not.toHaveTextContent('so với');
  });

  it('công tắc GỒM đi tới máy chủ và được nói ra trên màn', async () => {
    const calls = stubFetch(NEN);
    renderQuanTri('/quan-tri');
    await screen.findByTestId('o-tai-khoan-moi');
    fireEvent.click(screen.getByLabelText(/gồm tài khoản quản trị/));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/admin/pt/tong-quan') && c.url.includes('gom=1'))).toBe(true));
    expect(screen.getByTestId('tg-ghi')).toHaveTextContent('ĐANG GỒM tài khoản quản trị & thử');
  });

  it('khoảng trước dữ liệu phiên ⇒ "—" + lời giải thích, KHÔNG in 0', async () => {
    const nay: OSoDTO = { ...O_SO, do_duoc: false, nguoi_hoat_dong: null, phien: null, phien_co_thoi_luong: null, ms_moi_phien_tv: null };
    stubFetch([['/auth/me', ok(ME_ADMIN)], ['/admin/pt/tong-quan', ok({ ...TQ_PT, nay })]]);
    renderQuanTri('/quan-tri');
    expect(await screen.findByTestId('khong-do-duoc')).toBeInTheDocument();
    for (const id of ['o-hoat-dong', 'o-phien', 'o-moi-phien']) {
      expect(screen.getByTestId(id)).toHaveTextContent('—');
      expect(screen.getByTestId(id)).not.toHaveTextContent(/\b0\b/);
    }
  });

  it('phễu che bậc dưới sàn bằng "<5"; bậc không đo được nói ra; quay lại dưới sàn không lộ tỷ lệ', async () => {
    const pheu: TongQuanPTDTO['pheu'] = { ...TQ_PT.pheu, xong_tap: null, vao_tran: 3, quay_lai: QL(3, 0) };
    stubFetch([['/auth/me', ok(ME_ADMIN)], ['/admin/pt/tong-quan', ok({ ...TQ_PT, pheu })]]);
    renderQuanTri('/quan-tri');
    expect(await screen.findByTestId('pheu-vao-tran')).toHaveTextContent('<5');
    expect(screen.getByTestId('pheu-vao-tran')).not.toHaveTextContent('3');
    expect(screen.getByTestId('pheu-xong-tap')).toHaveTextContent('không đo được');
    expect(screen.getByTestId('pheu-tao')).toHaveTextContent('10');
    // Mẫu 3, tử 0: "0%" cũng là lộ số — ba người, không ai quay lại.
    expect(screen.getByTestId('pheu-quay-lai')).toHaveTextContent('<5 người tới tuần 2');
    expect(screen.getByTestId('pheu-quay-lai')).not.toHaveTextContent('%');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VI. NGƯỜI DÙNG — danh sách → một người', () => {
  const DS: DsNguoiDTO = {
    khoang: TQ_PT.khoang, gom: false, trang: 0, moi_trang: 50, tong: 2,
    nguoi: [
      { handle: 'pt_u1', tao: '2026-08-26T03:00:00Z', tuoi: '18-22', vung: 'bac', nghe: 'hs_sv', bat_ghi: true,
        quan_tri: false, thu: false, khach: false, phien: 2, tran: 1, lan_cuoi: new Date().toISOString() },
      { handle: 'pt_u3', tao: '2026-08-26T04:00:00Z', tuoi: '18-22', vung: 'bac', nghe: 'hs_sv', bat_ghi: false,
        quan_tri: false, thu: false, khach: false, phien: null, tran: 1, lan_cuoi: null },
    ],
  };
  const MOT: MotNguoiDTO = {
    khoang: TQ_PT.khoang,
    ho_so: { handle: 'pt_u3', tao: '2026-08-26T04:00:00Z', tuoi: '18-22', vung: 'bac', nghe: 'hs_sv',
      bat_ghi: false, quan_tri: false, thu: false, khach: false, tong_tran: 2 },
    o: { phien: null, ms_trong_app: null, loi: null, tran: 1 },
    gio: null,
    ngay: [{
      ngay: '2026-09-11', phien: [],
      ngoai_phien: [
        { loai: 'tran_ket', ts: '2026-09-11T02:20:00Z', trang_thai: 'xong', hang: null, so_ghe: null, buoi_do: true },
        { loai: 'tran_vao', ts: '2026-09-11T02:00:00Z', so_o: null, che_do: null, buoi_do: true },
      ],
    }],
    con_nua_truoc: null,
  };

  it('danh sách: phiên của người tắt ghi là "—"; không có cột email; bấm dòng mở trang người đó', async () => {
    const calls = stubFetch([...NEN, ['/admin/pt/nguoi/pt_u3', ok(MOT)], ['/admin/pt/nguoi', ok(DS)]]);
    const router = renderQuanTri('/quan-tri?khu=nguoi');
    const dong = await screen.findByTestId('dong-pt_u3');
    expect(dong).toHaveTextContent('—');
    expect(dong).toHaveTextContent('tắt');
    expect(screen.getByTestId('dong-pt_u1')).toHaveTextContent('✓ bật');
    expect(screen.queryByRole('columnheader', { name: /email/i })).not.toBeInTheDocument();
    fireEvent.click(dong);
    expect(await screen.findByTestId('rao-rieng-tu')).toHaveTextContent('người này đang tắt ghi');
    expect(router.state.location.search).toContain('nguoi=pt_u3');
    // Trang một người hỏi đúng khoảng đang chọn.
    const u = new URL(calls.find((c) => c.url.includes('/admin/pt/nguoi/pt_u3'))!.url, 'https://x.test');
    expect([u.searchParams.get('tu'), u.searchParams.get('den')]).toEqual([TQ_PT.khoang.tu, HOM_NAY]);
  });

  it('một người tắt ghi: chỉ còn chip TẤT CẢ + TRẬN & TOKEN; trận buổi đo không lộ bàn/nhóm/hạng', async () => {
    stubFetch([...NEN, ['/admin/pt/nguoi/pt_u3', ok(MOT)]]);
    renderQuanTri('/quan-tri?khu=nguoi&nguoi=pt_u3');
    await screen.findByTestId('ngay-2026-09-11');
    for (const ten of ['MÀN HÌNH', 'CHẠM NÚT', 'TÀI CHÍNH', 'LỖI']) expect(screen.getByRole('button', { name: ten })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'TRẬN & TOKEN' })).not.toBeDisabled();
    expect(screen.getByText('Vào trận buổi đo')).toBeInTheDocument();
    expect(screen.getByText('Kết trận buổi đo')).toBeInTheDocument();
    expect(screen.getByText('không hiện bàn, nhóm, hạng')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VII. PHÂN KHÚC', () => {
  const NHOM: NhomLuuDTO = { id: '1', ten: 'Sinh viên', dieu_kien: { nghe: ['hs_sv'] }, tao_luc: '2026-09-15T00:00:00Z', tao_boi: 'quan_tri_a' };
  const NHOM2: NhomLuuDTO = { id: '2', ten: 'Miền Nam', dieu_kien: { vung: ['nam'] }, tao_luc: '2026-09-15T00:00:00Z', tao_boi: 'quan_tri_a' };
  // Nhóm thứ ba để lượt đếm cỡ các nhóm đã lưu gửi BA điều kiện — khác hẳn lượt so A/B (hai điều kiện).
  const NHOM3: NhomLuuDTO = { id: '3', ten: 'Mười trận', dieu_kien: { tran_tu: 10 }, tao_luc: '2026-09-15T00:00:00Z', tao_boi: 'quan_tri_a' };
  const CS: ChiSoNhomDTO = { n: 7, vao_app: 6, phien: 9, ms_moi_phien_tv: 300_000, tran: 2, xong_tap: 1, dung_tai_chinh: 1, quay_lai: QL(5, 3, 2) };
  const DUOI_SAN = { n: null, chi_so: null };
  const bang = (nhom0: TinhNhomDTO['nhom'][number], nhom1: TinhNhomDTO['nhom'][number] = DUOI_SAN): Tuyen[] => {
    const tinh: TinhNhomDTO = { khoang: TQ_PT.khoang, gom: false, san: 5, nhom: [nhom0, nhom1, DUOI_SAN] };
    const chia: ChiaNhomDTO = { khoang: TQ_PT.khoang, gom: false, san: 5, theo: 'tuoi', n: 7,
      nhom: [{ khoa: '18-22', n: 7, tran: 2, quay_lai: { nhom: 5, co: 3 } }] };
    return [
      ...NEN,
      ['/admin/pt/phan-khuc/tinh', ok(tinh)],
      ['/admin/pt/phan-khuc/chia', ok(chia)],
      ['/admin/pt/phan-khuc', ok({ nhom: [NHOM, NHOM2, NHOM3] })],
    ];
  };

  it('so hai nhóm in đủ tám dòng, nhóm dưới sàn không lộ số; chia nhóm A; đủ người thì lưu được', async () => {
    const calls = stubFetch(bang({ n: 7, chi_so: CS }));
    renderQuanTri('/quan-tri?khu=phan');
    const bangSo = await screen.findByTestId('so-hai-nhom');
    expect(within(bangSo).getAllByRole('row')).toHaveLength(9); // đầu bảng + 8 chỉ số
    // Cột B dưới sàn: tám ô "<5", không một con số nào.
    expect(within(bangSo).getAllByText('<5')).toHaveLength(8);
    expect(await screen.findByTestId('chia-nhom')).toHaveTextContent('7');
    fireEvent.change(screen.getByLabelText('Tên nhóm'), { target: { value: 'Nhóm thử' } });
    await waitFor(() => expect(screen.getByTestId('pk-co-nhom')).toHaveTextContent('7'));
    expect(screen.getByRole('button', { name: 'LƯU NHÓM' })).not.toBeDisabled();
    // Hai cột so sánh đi CHUNG một lượt tính, đúng thứ tự A rồi B — một ảnh chụp, không lệch nhau vì đọc hai lúc.
    const tinhAB = calls.filter((c) => c.url.includes('/admin/pt/phan-khuc/tinh')
      && JSON.stringify((c.body as { nhom?: unknown[] } | undefined)?.nhom) === JSON.stringify([NHOM.dieu_kien, NHOM2.dieu_kien]));
    expect(tinhAB.length).toBeGreaterThan(0);
    // Và các khoảng hỏi đi cùng body, khớp thanh thời gian.
    expect(tinhAB[0]!.body).toMatchObject({ tu: TQ_PT.khoang.tu, den: HOM_NAY, gom: false });
  });

  it('chênh THỜI LƯỢNG in bằng phút như giá trị — không phải mili-giây trần ("39.053")', async () => {
    const CS2: ChiSoNhomDTO = { ...CS, n: 9, ms_moi_phien_tv: 339_000 };
    stubFetch(bang({ n: 7, chi_so: CS }, { n: 9, chi_so: CS2 }));
    renderQuanTri('/quan-tri?khu=phan');
    const bangSo = await screen.findByTestId('so-hai-nhom');
    const dong = within(bangSo).getByText('Thời gian mỗi phiên (trung vị)').closest('tr')!;
    await waitFor(() => expect(dong).toHaveTextContent('5,7 phút'));
    expect(dong).toHaveTextContent('5 phút');
    expect(dong).toHaveTextContent('A thấp hơn 0,7 phút');
    expect(dong.textContent).not.toMatch(/\d\.\d{3}/);
  });

  it('nhóm đang dựng dưới sàn: "<5" và nút LƯU khoá dù đã đặt tên', async () => {
    stubFetch(bang({ n: null, chi_so: null }));
    renderQuanTri('/quan-tri?khu=phan');
    await waitFor(() => expect(screen.getByTestId('pk-co-nhom')).toHaveTextContent('<5'));
    fireEvent.change(screen.getByLabelText('Tên nhóm'), { target: { value: 'Nhóm thử' } });
    expect(screen.getByRole('button', { name: 'LƯU NHÓM' })).toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VIII. SẢN PHẨM › PHIÊN BẢN — so sánh (founder 31/08)', () => {
  /** Ba dòng, ba giai đoạn — đúng hình dạng prod 31/08 (v2 chiếm 45% corpus). Gắn kiểu hợp đồng từ D341. */
  const PB: PhienBanDTO = {
    khoang: KH(congNgay(HOM_NAY, -89), HOM_NAY),
    gom_admin: false,
    gom_tester: false,
    ver_hien_tai: 'balance-v36-regime',
    san_tran_tin_cay: 10,
    dong: [
      {
        ver: 'balance-v2-D20lever', che_do: 'tu_do', giai_doan: 'khong_dung_lai_duoc',
        nhan_giai_doan: 'KHÔNG DỰNG LẠI ĐƯỢC — luật đã biến mất khỏi code',
        mau_mong: false, tran: 81, xong: 33, dang_choi: 0, bo_do: 48,
        nguoi: 1, ghe_nguoi: 81, n_events: 758, tu: '2026-07-20', den: '2026-07-24', co_map: [],
      },
      {
        ver: 'balance-v34-vai', che_do: 'tu_do', giai_doan: 'cu',
        nhan_giai_doan: 'phiên bản cũ (còn dựng lại được)',
        mau_mong: true, tran: 8, xong: 6, dang_choi: 0, bo_do: 2,
        nguoi: 2, ghe_nguoi: 8, n_events: 252, tu: '2026-08-22', den: '2026-08-30', co_map: [8, 12],
      },
      {
        ver: 'balance-v36-regime', che_do: 'tu_do', giai_doan: 'hien_tai',
        nhan_giai_doan: 'phiên bản hiện tại',
        mau_mong: true, tran: 2, xong: 2, dang_choi: 0, bo_do: 0,
        nguoi: 1, ghe_nguoi: 2, n_events: 12, tu: '2026-08-31', den: '2026-08-31', co_map: [12],
      },
    ],
    tong: { tran: 91, events: 1022, so_phien_ban: 3 },
    bi_cat: { tran: 81, events: 758, phien_ban: ['balance-v2-D20lever'], ty_le_tran: 0.89 },
    context_da_chet: ['sandbox_match', 'verify'],
  };
  const stub = () => stubFetch([...NEN, ['/admin/tk/phien-ban', ok(PB)]]);

  it('bày ĐỦ mọi phiên bản có dữ liệu, kèm nhãn giai đoạn', async () => {
    stub();
    renderQuanTri('/quan-tri?khu=sp&tab=phien-ban');
    expect(await screen.findByText(/balance-v36-regime ◀ đang chạy/)).toBeInTheDocument();
    expect(screen.getByText('phiên bản cũ (còn dựng lại được)')).toBeInTheDocument();
    // Mặt này là mặt DUY NHẤT bày phiên bản chết — nó kể kho, không tính tỷ lệ.
    expect(screen.getByText(/KHÔNG DỰNG LẠI ĐƯỢC/)).toBeInTheDocument();
  });

  it('⚠ NÓI RA phần bị cắt — cắt im lặng là cái bẫy', async () => {
    /*
     * Thiếu dải này thì người đọc thấy cỡ mẫu tụt, tưởng app hỏng, rồi ai đó "sửa" bằng cách gỡ bộ lọc — đúng
     * lối mòn `bo_qua_chua_dong_y` đã phải chặn ở mặt TÍNH CÁCH.
     */
    stub();
    renderQuanTri('/quan-tri?khu=sp&tab=phien-ban');
    expect(await screen.findByText(/ĐÃ CẮT KHỎI MỌI MẶT PHÂN TÍCH/)).toBeInTheDocument();
    expect(screen.getByText(/81 trận/)).toBeInTheDocument();
    // Tên phiên bản chết hiện ĐÚNG HAI CHỖ: dải cảnh báo (nó bị cắt) và hàng bảng (kho vẫn còn nó).
    expect(screen.getAllByText(/balance-v2-D20lever/)).toHaveLength(2);
  });

  it('mẫu mỏng ĐƯỢC HIỆN, chỉ đeo cảnh báo — ẩn thì mùa 0.0 mặt trắng trơn', async () => {
    stub();
    renderQuanTri('/quan-tri?khu=sp&tab=phien-ban');
    await screen.findByText(/balance-v36-regime ◀ đang chạy/);
    expect(screen.getByText('6 ⚠')).toBeInTheDocument();
    expect(screen.getByText('2 ⚠')).toBeInTheDocument();
  });

  it('công tắc GỒM chung của app đi tới mặt cũ bằng CẢ HAI cờ', async () => {
    const calls = stub();
    renderQuanTri('/quan-tri?khu=sp&tab=phien-ban&gom=1');
    await screen.findByText(/balance-v36-regime ◀ đang chạy/);
    const u = new URL(calls.find((c) => c.url.includes('/admin/tk/phien-ban'))!.url, 'https://x.test');
    expect([u.searchParams.get('gom_admin'), u.searchParams.get('gom_tester')]).toEqual(['1', '1']);
  });

  it('ngày trận đầu → cuối in theo dd/mm/yyyy (máy chủ trả ngày Việt Nam dạng chữ)', async () => {
    stub();
    renderQuanTri('/quan-tri?khu=sp&tab=phien-ban&moc=90');
    expect(await screen.findByText('22/08/2026 → 30/08/2026')).toBeInTheDocument();
  });
});

describe('VIIIb. SẢN PHẨM — mọi mặt đọc ĐÚNG khoảng của thanh thời gian (D341)', () => {
  /*
   * Founder 16/09 trên prod: đổi mốc Hôm nay / 7 / 30 ngày ở khu SẢN PHẨM mà số không đổi. Hai gốc phía màn: mặt HÀNH
   * TRÌNH gửi `ngay` đọc từ phản hồi TỔNG QUAN (tổng quan chưa về ⇒ số của mốc cũ; tổng quan lỗi ⇒ kẹt 30 ngày), còn
   * bốn mặt kia không gửi khoảng nào. Các bài dưới cho tổng quan LỖI hẳn để chắc mặt không còn dựa vào nó.
   */
  const NEN_LOI: Tuyen[] = [['/auth/me', ok(ME_ADMIN)], ['/admin/pt/tong-quan', { status: 500, body: { error: 'loi' } }]];
  const khoangCuoi = (calls: Array<{ url: string }>, duong: string) => {
    const c = calls.filter((x) => x.url.includes(`/admin/tk/${duong}?`)).at(-1);
    if (!c) return null;
    const u = new URL(c.url, 'https://x.test');
    return [u.searchParams.get('tu'), u.searchParams.get('den')];
  };

  it('⭐ đổi mốc ⇒ mặt HÀNH TRÌNH gửi đúng khoảng mới, kể cả khi tổng quan lỗi', async () => {
    const calls = stubFetch([...NEN_LOI, ['/admin/tk/hanh-trinh', ok(HT)]]);
    renderQuanTri('/quan-tri?khu=sp&moc=7');
    await waitFor(() => expect(khoangCuoi(calls, 'hanh-trinh')).toEqual([congNgay(HOM_NAY, -6), HOM_NAY]));
    fireEvent.click(screen.getByRole('button', { name: 'Hôm nay' }));
    await waitFor(() => expect(khoangCuoi(calls, 'hanh-trinh')).toEqual([HOM_NAY, HOM_NAY]));
    fireEvent.click(screen.getByRole('button', { name: '30 ngày' }));
    await waitFor(() => expect(khoangCuoi(calls, 'hanh-trinh')).toEqual([congNgay(HOM_NAY, -29), HOM_NAY]));
    // Không lượt nào còn gửi `ngay` — tham số cũ đọc từ tổng quan.
    expect(calls.filter((c) => c.url.includes('/admin/tk/')).some((c) => new URL(c.url, 'https://x.test').searchParams.has('ngay')))
      .toBe(false);
  });

  it('⭐ khoảng mới chưa về thì mặt hiện "đang tải…", KHÔNG giữ số của khoảng cũ dưới nhãn khoảng mới', async () => {
    // Lượt 7 ngày trả ngay; lượt Hôm nay treo mãi. Giữ bản cũ (`keepPreviousData`) là đúng cái founder thấy trên prod.
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const tl = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
      if (url.includes('/auth/me')) return tl(ME_ADMIN);
      if (url.includes('/admin/pt/tong-quan')) return tl({ error: 'loi' }, 500);
      if (url.includes('/admin/tk/hanh-trinh') && url.includes(`tu=${HOM_NAY}&`)) return new Promise<Response>(() => {});
      if (url.includes('/admin/tk/hanh-trinh')) return tl(HT);
      return tl({ ok: true }, 202);
    }));
    renderQuanTri('/quan-tri?khu=sp&moc=7');
    await screen.findByTestId('ht-khoang');
    fireEvent.click(screen.getByRole('button', { name: 'Hôm nay' }));
    expect(await screen.findByText('đang tải…')).toBeInTheDocument();
    expect(screen.queryByTestId('ht-khoang')).not.toBeInTheDocument();
  });

  it.each(['tran', 'keo', 'tinh-cach', 'phien-ban'])('mặt %s gửi khoảng tuỳ chọn của thanh (trước D341 không gửi gì)', async (tab) => {
    const tu = congNgay(HOM_NAY, -20);
    const den = congNgay(HOM_NAY, -10);
    const calls = stubFetch([...NEN_LOI, ['/admin/tk/', { status: 500, body: { error: 'loi' } }]]);
    renderQuanTri(`/quan-tri?khu=sp&tab=${tab}&moc=tuy&tu=${tu}&den=${den}`);
    await waitFor(() => expect(khoangCuoi(calls, tab)).toEqual([tu, den]));
  });

  it('dòng khoảng in ĐÚNG khoảng máy chủ đã kẹp; không còn lời "tính tới hôm nay"', async () => {
    stubFetch([...NEN_LOI, ['/admin/tk/hanh-trinh', ok(HT)]]);
    renderQuanTri('/quan-tri?khu=sp&moc=7');
    const dong = await screen.findByTestId('ht-khoang');
    expect(dong).toHaveTextContent(`Khoảng ${HT.khoang.tu.slice(8)}/${HT.khoang.tu.slice(5, 7)}/${HT.khoang.tu.slice(0, 4)}`);
    expect(dong).toHaveTextContent('(7 ngày, giờ Việt Nam)');
    expect(screen.queryByText(/TÍNH TỚI HÔM NAY/)).not.toBeInTheDocument();
    expect(screen.queryByText(/không cắt theo khoảng thời gian/)).not.toBeInTheDocument();
  });

  it('khoảng trước phần dữ liệu thô còn giữ: năm khối thao tác nói "không đo được" — không vẽ số 0', async () => {
    const d: HanhTrinhDTO = {
      ...HT, do_duoc: false, man_dang_ky: null, loi_client: null, dang_nhap: null, sau_dang_nhap: null, huong_dan: null,
      tran: { ...HT.tran, client_kip_bao: null }, man_cuoi: { trang_thai: 'khong_do_duoc' },
    };
    stubFetch([...NEN_LOI, ['/admin/tk/hanh-trinh', ok(d)]]);
    renderQuanTri('/quan-tri?khu=sp&moc=7');
    expect(await screen.findByTestId('ht-khoang')).toHaveTextContent('không đo được');
    // 1b màn đăng ký · 2 đi đâu · 5 màn cuối · 3 bước hướng dẫn · 6 sập giao diện
    expect(screen.getAllByTestId('ht-khong-do')).toHaveLength(5);
  });

  it('⭐ màn cuối ở mốc Hôm nay nói "chưa biết được" thay vì một bảng rỗng', async () => {
    stubFetch([...NEN_LOI, ['/admin/tk/hanh-trinh', ok({ ...HT, man_cuoi: { trang_thai: 'chua_du_24h' } } satisfies HanhTrinhDTO)]]);
    renderQuanTri('/quan-tri?khu=sp&moc=hom_nay');
    expect(await screen.findByTestId('man-cuoi-chua-du')).toHaveTextContent('chưa biết được');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IX. VẬN HÀNH', () => {
  const KEO = {
    trang: 0, moi_trang: 25, tong: 2,
    keo: [
      {
        market_id: 'm-nhap', pool: 'macro', question_text: 'CPI tháng 9?', status: 'draft',
        tu_mo: false, open_ts: '2026-09-01T00:00:00Z', lock_ts: '2026-09-20T00:00:00Z',
        resolve_deadline_ts: '2026-09-25T00:00:00Z', seed_per_option: '0', volume_nguoi: '0', so_nguoi: 0,
      },
      {
        market_id: 'm-mo', pool: 'life', question_text: 'Xăng tuần tới?', status: 'open',
        tu_mo: false, open_ts: '2026-08-01T00:00:00Z', lock_ts: '2026-08-09T00:00:00Z',
        resolve_deadline_ts: '2026-08-10T00:00:00Z', seed_per_option: '100', volume_nguoi: '350', so_nguoi: 4,
      },
    ],
  };

  it('QUẢN KÈO liệt kê MỌI trạng thái — không chỉ việc đang chờ', async () => {
    stubFetch([...NEN, ['/admin/keo', ok(KEO)]]);
    renderQuanTri('/quan-tri?khu=vh&tab=quan-keo');
    expect(await screen.findByText('CPI tháng 9?')).toBeInTheDocument();
    expect(screen.getByText('Xăng tuần tới?')).toBeInTheDocument();
  });

  it('QUẢN KÈO: nháp thì cho SỬA + HẸN GIỜ; kèo đã mở thì chỉ XEM NHƯ NGƯỜI CHƠI', async () => {
    /*
     * ⚠ Ranh giới này là luật, không phải cách bày nút: kèo đã mở mà đổi câu hỏi là đổi luật giữa chừng với người
     * đang giữ token trong đó. Máy chủ chặn (409) và giao diện cũng không được mời gọi.
     */
    stubFetch([...NEN, ['/admin/keo', ok(KEO)]]);
    renderQuanTri('/quan-tri?khu=vh&tab=quan-keo');
    await screen.findByText('CPI tháng 9?');
    expect(screen.getAllByText('sửa')).toHaveLength(1);
    expect(screen.getAllByText('hẹn giờ mở')).toHaveLength(1);
    expect(screen.getAllByText('xem như người chơi')).toHaveLength(1);
  });

  it('VIỆC CẦN LÀM chỉ đọc — mọi việc trỏ sang /admin, không có nút làm thay', async () => {
    /*
     * ⚠ MỞ kèo rút seed Kho bạc, CHỐT chuyển token, HUỶ hoàn tiền — cả ba không hoàn tác và phải sống kể cả khi bản
     * build web hỏng (§8.1). Nên chúng ở trang máy chủ vẽ; ở đây chỉ có đường bấm sang.
     */
    stubFetch([
      ...NEN,
      ['/admin/pending', ok({ markets: [
        { market_id: 'm1', question_text: 'Vàng tuần này?', status: 'locked', pool: 'life', lock_ts: '2026-09-14T00:00:00Z',
          resolution_source_name: 'SJC', seed_per_option: 0, total_volume: 500, options: [] },
        { market_id: 'm2', question_text: 'Lãi suất tháng 10?', status: 'draft', pool: 'macro', lock_ts: '2026-10-01T00:00:00Z',
          resolution_source_name: 'NHNN', seed_per_option: 0, total_volume: 0, options: [] },
      ] })],
    ]);
    renderQuanTri('/quan-tri?khu=vh&tab=viec');
    expect((await screen.findByText('chốt ở /admin ›')).getAttribute('href')).toBe('/admin');
    expect(screen.getByText('mở ở /admin ›').getAttribute('href')).toBe('/admin');
    expect(screen.queryByRole('button', { name: /chốt|mở kèo|huỷ|hủy/i })).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('X. DỮ LIỆU › KHO — mọi bảng, mọi cột (founder 31/08)', () => {
  const DS = {
    bang: [
      { ten: 'users', cot: 24, byte: 81920, dong: 6, dong_uoc: 6 },
      { ten: 'auth_accounts', cot: 12, byte: 40960, dong: 6, dong_uoc: 0 },
    ],
    tong_dong: 12,
    tong_byte: 122880,
    khoa: { an_han: ['totp_secret', 'password_hash', 'token_hash'], che: ['email'], rut_gon: ['blob'] },
  };
  const DONG = {
    ten: 'auth_accounts',
    cot: [
      { ten: 'account_id', kieu: 'uuid', an: null },
      { ten: 'email', kieu: 'text', an: 'che' },
      { ten: 'totp_secret', kieu: 'text', an: 'an_han' },
    ],
    dong: [{ account_id: 'abc-123', email: 'ho***@example.com' }],
    trang: 0, moi: 50, con_nua: false, sap: 'account_id', chieu: 'desc', cat_o: 500,
  };
  const stub = () => stubFetch([...NEN, ['/admin/kho/bang/auth_accounts', ok(DONG)], ['/admin/kho/bang', ok(DS)]]);

  it('bày mọi bảng kèm số dòng ĐẾM THẬT', async () => {
    stub();
    renderQuanTri('/quan-tri?khu=dl');
    expect(await screen.findByRole('button', { name: 'users' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth_accounts' })).toBeInTheDocument();
    expect(screen.getByText('đếm thật, không ước lượng')).toBeInTheDocument();
  });

  it('⚠ bản kê cột bị khoá hiện NGAY trên mặt, không chôn ở tài liệu', async () => {
    stub();
    renderQuanTri('/quan-tri?khu=dl');
    expect(await screen.findByText(/totp_secret · password_hash · token_hash/)).toBeInTheDocument();
    expect(screen.getByText(/đăng nhập được dưới danh nghĩa người khác/)).toBeInTheDocument();
  });

  it('chạm một bảng thì đọc được dòng; cột ẩn hiện KHOÁ chứ không hiện giá trị', async () => {
    stub();
    renderQuanTri('/quan-tri?khu=dl');
    fireEvent.click(await screen.findByRole('button', { name: 'auth_accounts' }));
    expect(await screen.findByText('abc-123')).toBeInTheDocument();
    // Cột ẩn vẫn được KHAI là tồn tại (không nói dối về schema) — bản kê + đầu cột ⇒ ≥2 chỗ.
    expect(screen.getAllByText(/totp_secret/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('🔒').length).toBeGreaterThan(0);
    expect(screen.getByText('ho***@example.com')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('XI. Phễu hướng dẫn khớp CoachTap (chống trôi)', () => {
  it('BUOC_HUONG_DAN bằng ĐÚNG danh sách id trong CoachTap, cùng thứ tự', () => {
    /*
     * ⚠ Phễu "rơi ở bước nào" vẽ theo THỨ TỰ khai trong config. Thêm hoặc đổi tên một bước trong CoachTap mà quên ở
     * đây thì phễu vẫn vẽ, chỉ là bước mới biến mất và thứ tự sai — hỏng âm thầm.
     */
    const src = doc('src/components/holdem/CoachTap.tsx');
    const trongMan = [...src.matchAll(/^\s*id: '([a-z0-9-]+)'/gm)].map((m) => m[1]!);
    // Sàn này để bắt chuyện regex hỏng rồi khớp 0 dòng — lúc đó `toEqual` so hai mảng RỖNG và xanh vô nghĩa.
    expect(trongMan.length).toBeGreaterThan(8);
    expect([...BUOC_HUONG_DAN]).toEqual(trongMan);
    // `tat-tro-ly` KHÔNG phải một bước — nó là dấu người chơi chủ động tắt.
    expect(trongMan).not.toContain(BUOC_TAT_TRO_LY);
    expect(src).toContain(BUOC_TAT_TRO_LY);
  });
});

describe('XII. Nhân bản theo tháng', () => {
  it('dịch theo THÁNG LỊCH và thay {thang} bằng tháng thật', () => {
    const goc = {
      pool: 'macro', question_text: 'CPI tháng {thang}?',
      resolution_source_name: 'GSO', resolution_source_url: 'https://gso.test',
      open_ts: '2026-01-31T00:00:00.000Z',
      lock_ts: '2026-02-20T00:00:00.000Z',
      resolve_deadline_ts: '2026-02-25T00:00:00.000Z',
      seed_per_option: 0, options: [{ label: 'Tăng' }, { label: 'Giảm' }],
    };
    const ds = nhanBanTheoThang(goc, 3);
    expect(ds).toHaveLength(3);
    /*
     * ⚠ MẪU CỐ Ý LÀ NGÀY 31/01 — ca bẫy. `setMonth(+1)` trên ngày 31 KHÔNG ra 28/02 mà ra 03/03, nên loạt kèo MẤT
     * HẲN THÁNG 2 và tháng 3 có hai kèo. Nay kẹp vào ngày cuối tháng.
     */
    expect(ds[0]!.question_text).toContain('tháng 1/2026');
    expect(ds[1]!.question_text).toContain('tháng 2/2026');
    expect(ds[2]!.question_text).toContain('tháng 3/2026');
    expect(new Date(ds[1]!.open_ts).getUTCMonth()).toBe(1);
    expect(new Date(ds[1]!.open_ts).getUTCDate()).toBe(28);
    expect(new Date(ds[2]!.open_ts).getUTCDate()).toBe(31);
  });
});

describe('XIII. Công tắc GỒM (D212 + tài khoản thử) — một công tắc, hai cờ, url luôn hợp lệ', () => {
  it('⚠ MỌI url phân tích cũ đều parse được khi bật cờ — không nối tay dấu ? và &', () => {
    /*
     * ⚠⚠ CA THẬT (D212): bản đầu tự chọn `?` hay `&`; một hook gọi `chuoiLoc(loc)` — vốn trả RỖNG khi không lọc gì —
     * nên URL thành `/admin/tk/nguoi&gom_admin=1`, tức 404 và bảng trắng trơn. Lọt qua cả tsc lẫn suite vì không
     * bài nào bấm công tắc. D335 thêm: bật công tắc phải gồm CẢ tài khoản thử — trước đó màn chỉ gửi `gom_admin`.
     */
    const k = (gom: boolean) => ({ tu: congNgay(HOM_NAY, -6), den: HOM_NAY, gom });
    for (const gom of [false, true]) {
      for (const [ten, url] of [
        ['tong-quan', `/admin/tk/tong-quan${chuoiLoc({}, 30, gom)}`],
        // D341: năm mặt SẢN PHẨM dựng URL bằng `urlSanPham` — khoảng + hai cờ.
        ['hanh-trinh', urlSanPham('hanh-trinh', k(gom))],
        ['tran (có ver)', urlSanPham('tran', k(gom), { ver: 'tat_ca' })],
        ['keo', urlSanPham('keo', k(gom))],
        ['phien-ban', urlSanPham('phien-ban', k(gom))],
        ['tinh-cach', urlSanPham('tinh-cach', k(gom))],
      ] as const) {
        expect(url, `${ten}: có '&' trước khi có '?'`).not.toMatch(/^[^?]*&/);
        const u = new URL(url, 'https://x.test');
        expect([u.searchParams.get('gom_admin'), u.searchParams.get('gom_tester')], `${ten}: cờ không tới nơi`)
          .toEqual(gom ? ['1', '1'] : [null, null]);
      }
    }
  });
});

describe('XIV. Không rò PII ra giao diện', () => {
  it('mã nguồn app quản trị và các tầng API của nó không đọc trường email ở đâu cả', () => {
    /*
     * Tầng API không trả email (test phía server kiểm trên chuỗi thô). Đây là lớp thứ hai, và nó rẻ.
     *
     * ⚠ PHẠM VI HẸP TỪ D209: tab KHO vẽ cột TỔNG QUÁT — không nhắc tên cột nào, nên đi qua bài này hợp lệ trong khi
     * vẫn in được ô của một cột tên `email`. Lớp chặn thật cho tab đó ở MÁY CHỦ (`server/admin_kho.ts` COT_CHE);
     * cho khu NGƯỜI DÙNG là `server/admin_phan_tich.ts` (không SELECT email). Siết ở đó, đừng siết regex này.
     * Bắt việc ĐỌC TRƯỜNG, không bắt chữ "email" trần — màn có câu "không email", cấm cả chữ đó là chặn chính lời
     * cam kết.
     */
    const DOC_TRUONG = /\.email\b|\bemail\s*[:=]|['"]email['"]/i;
    for (const thuMuc of ['src/screens/admin', 'src/quan-tri']) {
      const tep = readdirSync(join(process.cwd(), thuMuc)).filter((f) => /\.tsx?$/.test(f));
      expect(tep.length, `${thuMuc} rỗng — bài quét không quét gì`).toBeGreaterThan(3);
      for (const f of tep) expect(doc(`${thuMuc}/${f}`), f).not.toMatch(DOC_TRUONG);
    }
    for (const f of ['src/api/thongke.ts', 'src/api/phantich.ts', 'src/api/vanhanh.ts']) expect(doc(f), f).not.toMatch(DOC_TRUONG);
  });
});

vi.mock('virtual:pwa-register', () => ({ registerSW: () => () => {} }));
