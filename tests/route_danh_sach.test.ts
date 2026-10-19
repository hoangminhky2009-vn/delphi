/**
 * DANH SÁCH ROUTE — canh cho bản sinh ra khỏi trôi khỏi app thật.
 *
 * ⚠ VÌ SAO BÀI NÀY TỒN TẠI, chứ không phải "doc thì cập nhật tay cũng được":
 * mục A6 trong `docs/luat/04-du-lieu.md` liệt kê 11 bảng trong khi DB thật đã
 * 56 — nó trôi suốt 45 migration mà KHÔNG CÓ GÌ BÁO, vì không ai canh. Bảng
 * route gõ tay sẽ đi đúng con đường đó, chỉ nhanh hơn: bề mặt API đổi mỗi tuần.
 *
 * Nên phép so ở đây là phép so DUY NHẤT đáng tin: dựng app thật, hỏi Hono nó
 * có những route nào, rồi so với tệp trên đĩa. Thêm/xoá/đổi guard một route mà
 * quên `npm run route:ghi` ⇒ bài này đỏ ngay trong CI.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEP, gopRoute, guardCua, mien, sinhDanhSachRoute } from '../scripts/sinh_route.js';
import { chuanDong } from '../scripts/_chuan_dong.js';

const GOC = process.cwd();

describe('Danh sách route sinh ra', () => {
  it('tệp trên đĩa KHỚP app đang chạy (quên route:ghi ⇒ đỏ)', async () => {
    /*
     * ⚠ `chuanDong` ở CẢ HAI VẾ (D255) — không phải làm đẹp. Bộ sinh ghi LF, còn
     * `git checkout` trên Windows trả CRLF (`core.autocrlf`), nên so chuỗi THÔ làm
     * bài này đỏ trên MỌI bản clone, với thông báo in ra hai dòng trông y hệt nhau.
     * Một bộ canh đỏ vì lý do không liên quan sẽ dạy người ta bỏ qua nó — và đó là
     * cách một bộ canh chết.
     */
    const trenDia = readFileSync(join(GOC, TEP), 'utf8');
    expect(chuanDong(trenDia)).toBe(chuanDong(await sinhDanhSachRoute()));
  });

  it('⭐ D255 — phép so BỎ QUA kiểu xuống dòng: bản CRLF vẫn phải khớp', async () => {
    /*
     * ⚠ Bài này khoá chính BẢN VÁ, không khoá tệp. Gỡ `chuanDong` đi thì bài trên vẫn
     * xanh trên máy vừa chạy bộ sinh (LF/LF) — nó chỉ đỏ ở bản clone, tức đỏ đúng chỗ
     * không ai chạy test. Dựng thẳng bản CRLF ở đây để lỗi lộ ra NGAY trên máy đang sửa.
     */
    const sinh = await sinhDanhSachRoute();
    const banCRLF = sinh.replace(/\n/g, '\r\n');
    expect(banCRLF, 'phải thật sự khác byte, không thì bài này rỗng').not.toBe(sinh);
    expect(chuanDong(banCRLF)).toBe(chuanDong(sinh));
  });

  it('⭐ D255 — nhưng KHÁC NỘI DUNG thì vẫn đỏ (chuẩn hoá không được nuốt drift)', async () => {
    const sinh = await sinhDanhSachRoute();
    const them = sinh + '\n| GET | `/bia-dat` | |';
    expect(chuanDong(them)).not.toBe(chuanDong(sinh));
  });

  it('có route thật, không phải bảng rỗng đọc nhầm thành "khớp"', async () => {
    const md = await sinhDanhSachRoute();
    // Ngưỡng cố ý THẤP: đây là bài chống ca "app dựng hỏng ⇒ 0 route ⇒ vẫn khớp
    // tệp rỗng", không phải bài đếm route (số đó đổi mỗi tuần, khoá nó là tự
    // chuốc một bản sao thứ hai phải sửa tay — đúng thứ D61 cấm).
    expect(md).toMatch(/\*\*\d{2,}\*\* route/);
    expect(md).toContain('/api/v1/health');
  });

  it('gộp theo (method, đường); guard là VỊ TRÍ, không phải cái tên', () => {
    const cua = () => undefined;
    Object.defineProperty(cua, 'name', { value: 'requireAuth' });
    const kq = gopRoute([
      { method: 'GET', path: '/x', handler: cua },
      { method: 'GET', path: '/x', handler: () => undefined },
      { method: 'POST', path: '/x', handler: cua },
    ]);
    expect(kq).toHaveLength(2);

    /*
     * ⚠ handler thứ hai ở trên có `.name === 'handler'` — JS SUY tên hàm
     * từ thuộc tính được gán vào. Đúng cái bẫy khiến lọc-theo-tên là sai:
     * cùng một hàm, viết thẳng vào `app.get(...)` thì tên rỗng, còn gán
     * vào biến hay thuộc tính thì lại có tên.
     */
    expect(kq[0]?.handlers).toEqual(['requireAuth', 'handler']);
    expect(guardCua(kq[0] ?? { handlers: [] })).toEqual(['requireAuth']);

    // Route chỉ có ĐÚNG một handler ⇒ không guard nào, kể cả khi handler có tên.
    expect(guardCua(kq[1] ?? { handlers: [] })).toEqual([]);
  });

  it('miền suy từ đường — /admin và /api/v1/admin/* cùng một miền', () => {
    expect(mien('/admin')).toBe('admin');
    expect(mien('/api/v1/admin/quyen')).toBe('admin');
    expect(mien('/api/v1/health')).toBe('health');
  });
});

/*
 * K3 · K5 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — canh trên CHÍNH bảng route của app dựng thật (không đọc mã bằng regex).
 * Tiêm ngược: bỏ `requireOnboarded` khỏi `POST /me/cai-dat` ⇒ ca K3 đỏ · bỏ `cuaTick` ⇒ ca internal đỏ · xoá một nhãn trong
 * `config/route_nhan.ts` ⇒ ca K5 đỏ · thêm nhãn cho route có client gọi ⇒ ca nhãn thừa đỏ.
 */
import { createApp } from '../server/app.js';
import { chuNguonGoi, coNguoiGoi } from '../scripts/sinh_route.js';
import { ROUTE_NHAN } from '../config/route_nhan.js';

const bangRoute = () => gopRoute(createApp({
  pool: {} as never, mailer: { send: async () => undefined } as never, appBaseUrl: 'https://vi-du.invalid',
}).routes).filter((d) => d.method !== 'ALL');

/**
 * Route ghi dưới `/me/*` được phép KHÔNG đòi `requireOnboarded` (B5: nó đòi cả cổng tuổi) — kèm lý do. Chúng vẫn phải có
 * `requireHoSo` (có hồ sơ `users`): đây là hai cửa người CHƯA qua cổng tuổi phải với tới được để qua nó.
 */
const ME_KHONG_ONBOARDED: Record<string, string> = {
  '/api/v1/me/tuoi': 'B5 — chính cửa xác nhận tuổi',
  '/api/v1/me/nhan-khau': 'khai năm sinh ở tấm nhân khẩu cũng là qua cổng tuổi',
};

describe('K3 — guard là middleware, không phải `if` trong handler', () => {
  it('⭐ mọi route ≠ GET dưới /api/v1/me/* có requireOnboarded', () => {
    const thieu = bangRoute()
      .filter((d) => d.method !== 'GET' && d.path.startsWith('/api/v1/me/'))
      .filter((d) => !(d.path in ME_KHONG_ONBOARDED) && !guardCua(d).includes('requireOnboarded'))
      .map((d) => `${d.method} ${d.path}`);
    expect(thieu).toEqual([]);
  });

  it('cửa miễn cổng tuổi vẫn có requireHoSo', () => {
    const ds = bangRoute().filter((d) => d.method !== 'GET' && d.path in ME_KHONG_ONBOARDED);
    expect(ds.map((d) => d.path).sort()).toEqual(Object.keys(ME_KHONG_ONBOARDED).sort());
    for (const d of ds) expect(guardCua(d), d.path).toEqual(['requireAuth', 'requireHoSo']);
  });

  it('cửa máy gọi /internal/* có requireSecret trong cột guard', () => {
    const thieu = bangRoute()
      .filter((d) => d.path.startsWith('/api/v1/internal/') && !guardCua(d).includes('requireSecret'))
      .map((d) => `${d.method} ${d.path}`);
    expect(thieu).toEqual([]);
  });
});

describe('K5 — route không ai gọi phải có nhãn ở config/route_nhan.ts', () => {
  const chu = chuNguonGoi();

  it('⭐ mỗi route: hoặc có chỗ gọi trong web/src · trang admin · Worker, hoặc có nhãn', () => {
    const moCoi = bangRoute()
      .filter((d) => !ROUTE_NHAN[`${d.method} ${d.path}`] && !coNguoiGoi(d.path, chu))
      .map((d) => `${d.method} ${d.path}`);
    expect(moCoi, 'thêm chỗ gọi, hoặc nhãn + lý do ở config/route_nhan.ts').toEqual([]);
  });

  it('nhãn không thừa: route có nhãn thì tồn tại và chưa có client gọi', () => {
    const coThat = new Set(bangRoute().map((d) => `${d.method} ${d.path}`));
    const thua = Object.keys(ROUTE_NHAN).filter((k) => !coThat.has(k) || coNguoiGoi(k.split(' ')[1]!, chu));
    expect(thua, 'route đã xoá hoặc đã có client ⇒ gỡ nhãn').toEqual([]);
  });

  it('bộ dò chỗ gọi: template · nối chuỗi · đuôi động khớp; tiền tố trùng và hai đoạn chữ thiếu thì không', () => {
    expect(coNguoiGoi('/api/v1/holdem/ban/:ma', "api(`/holdem/ban/${ma}`)")).toBe(true);
    expect(coNguoiGoi('/api/v1/me/tu-khai', "api('/me/tu-khai', {")).toBe(true);
    expect(coNguoiGoi('/api/v1/me/tu-khai', "api('/me/tu-khai-moi')")).toBe(false);
    expect(coNguoiGoi('/api/v1/admin/markets/:id/open', "api('/api/v1/admin/markets/'+m.id+'/open',{")).toBe(true);
    expect(coNguoiGoi('/api/v1/admin/2fa/mo-khoa', "api('/api/v1/admin/2fa/'+duong,{")).toBe(true);
    expect(coNguoiGoi('/api/v1/admin/2fa/mo-khoa', "api('/api/v1/'+duong)")).toBe(false);
    expect(coNguoiGoi('/api/v1/admin/tk/tran', 'return `/admin/tk/${duong}?${p}`;')).toBe(true);
    expect(coNguoiGoi('/api/v1/holdem/choi', 'mở `/api/v1/holdem/choi/x`')).toBe(false);
  });
});
