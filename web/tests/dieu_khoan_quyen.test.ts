/**
 * BÀI QUÉT ĐIỀU KHOẢN — mỗi câu "bạn làm được" ở mục `quyen` trỏ tới một route + endpoint ĐANG CÓ (SPEC chan-truoc-beta mục 5; luật
 * "câu hứa trên màn phải trỏ tới mã/đường dữ liệu đang có").
 *
 * Ca thật bắt được ngày 11/10: điều khoản hứa "**Xem** tụi mình giữ gì về bạn" và "**Sửa** nhóm tuổi / vùng / nghề" suốt nhiều tuần mà
 * không endpoint nào làm hai việc ấy. Không bài nào đỏ, vì không bài nào đọc điều khoản như một danh sách lời hứa.
 *
 * Đọc mã nguồn server (danh sách route đăng ký) và cây route web THẬT — không chép danh sách tay (bản sao thứ hai sẽ trôi, D61).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Navigate, type RouteObject } from 'react-router-dom';
import { MUC, QUYEN } from '@/content/dieuKhoan';
import { routes } from '@/app/routes';

/** Mọi `METHOD /api/v1/...` server đăng ký bằng chuỗi literal (`app.get('…'` · `app.post('…'`). */
function duongServer(): Set<string> {
  // cwd = web/ (vitest chạy ở gói web — cùng nếp các bài quét mã nguồn khác ở đây).
  const goc = join(process.cwd(), '..', 'server');
  const ra = new Set<string>();
  const quet = (d: string): void => {
    for (const m of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, m.name);
      if (m.isDirectory()) { quet(p); continue; }
      if (!m.name.endsWith('.ts')) continue;
      for (const k of readFileSync(p, 'utf8').matchAll(/\bapp\.(get|post|put|patch|delete)\(\s*'(\/api\/v1\/[^']+)'/g)) {
        ra.add(`${k[1]!.toUpperCase()} ${k[2]}`);
      }
    }
  };
  quet(goc);
  return ra;
}

/** Route web → phần tử (gom phẳng cây). */
function routeWeb(): Map<string, RouteObject> {
  const ra = new Map<string, RouteObject>();
  const di = (ds: RouteObject[] | undefined): void => {
    for (const r of ds ?? []) {
      if (r.path) ra.set(r.path, r);
      di(r.children);
    }
  };
  di(routes);
  return ra;
}

describe('điều khoản — mỗi quyền có mã đứng sau', () => {
  const server = duongServer();
  const web = routeWeb();

  it('bài quét đọc được route thật (đối chứng — không xanh vì đọc rỗng)', () => {
    expect(server.size).toBeGreaterThan(100);
    expect(server.has('POST /api/v1/account/delete')).toBe(true);
    expect(web.has('/ho-so')).toBe(true);
  });

  it('⭐ mọi câu ở mục `quyen` đến từ `QUYEN` — không câu hứa nào viết tay ngoài danh sách có đường', () => {
    const quyen = MUC.find((m) => m.id === 'quyen');
    expect(quyen?.doan).toEqual(QUYEN.map((q) => q.chu));
  });

  it.each(QUYEN.map((q) => [q.chu.slice(0, 48), q] as const))('⭐ "%s…" trỏ tới endpoint + màn đang có', (_ten, q) => {
    expect(q.duong.length, 'câu hứa không khai đường nào').toBeGreaterThan(0);
    for (const d of q.duong) {
      if (d === 'mailto') {
        const man = readFileSync(join(process.cwd(), 'src/screens/DieuKhoan.tsx'), 'utf8');
        expect(man, 'hứa "email ở cuối trang" mà trang không có link mailto').toMatch(/href="mailto:[^"@]+@[^"]+"/);
        continue;
      }
      expect(server.has(d), `endpoint "${d}" không được đăng ký ở server/`).toBe(true);
    }
    if (q.man !== null) {
      const r = web.get(q.man);
      expect(r, `màn "${q.man}" không có trong app/routes.tsx`).toBeDefined();
      // Màn bị khoá về Hub (vd khu Tài chính lúc PFM_WEB_MO tắt) thì người dùng không tới được — lời hứa rỗng.
      expect((r!.element as { type?: unknown } | undefined)?.type, `màn "${q.man}" đang chuyển hướng đi chỗ khác`).not.toBe(Navigate);
    }
  });
});
