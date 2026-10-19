/**
 * MÀN SỔ KHÔNG KÉO MÀN KHÁC VÀO GÓI CỦA NÓ (D431).
 *
 * ⚠⚠ Vì sao có bài này: SỔ là màn mở nhiều nhất của cả khu tài chính (ghi một khoản = mở SỔ). Hai lần liền, một cú nhập
 *   tiện tay đã kéo nguyên một màn nặng vào gói của nó mà không gì đỏ ngoài một bài chờ-1-giây ở chỗ khác:
 *     · D426 — `So.tsx` → `Hu.tsx` → khối biểu đồ GƯƠNG (~11 KB gzip) ⇒ tách `BieuDoViThe.tsx`;
 *     · D431 — `So.tsx` → `Hu.tsx` (cả màn HŨ, ~20 KB gzip) chỉ để lấy hộp quyết toán ⇒ tách `QuyetToanHop.tsx`.
 *   Lần hai lộ ra trên bản gộp 0.0.46: `oracle_chat` (dựng `/tai-chinh/so`, chờ đầu Oracle 1 giây) đỏ cả khi chạy riêng.
 * ⚠ Canh BẮC CẦU, không chỉ dòng import trực tiếp: đi hết đồ thị nhập tương đối + `@/` từ `So.tsx`. Một tệp trung gian mới
 *   nhập lại `Hu.tsx` cũng đỏ như cú nhập thẳng.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const SRC = resolve(__dirname, '../src');
const GOC = join(SRC, 'screens/tai-chinh/So.tsx');

/** Màn nặng không được lọt vào đồ thị nhập của SỔ. */
const CAM = ['screens/tai-chinh/Hu.tsx', 'screens/tai-chinh/Guong.tsx', 'screens/tai-chinh/BieuDo.tsx',
  'screens/tai-chinh/DinhHuong.tsx', 'screens/tai-chinh/BaMat.tsx'].map((f) => join(SRC, f));

function giaiDuong(tu: string, spec: string): string | null {
  let goc: string;
  if (spec.startsWith('@/')) goc = join(SRC, spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) goc = resolve(dirname(tu), spec);
  else return null;                                        // gói ngoài · @config · @server: không phải màn
  const bo = goc.replace(/\.js$/, '');
  for (const c of [bo, `${bo}.ts`, `${bo}.tsx`, join(bo, 'index.ts'), join(bo, 'index.tsx')]) {
    if (/\.tsx?$/.test(c) && existsSync(c)) return c;
  }
  return null;                                             // .css · .svg… — không mang mã
}

function doThiNhap(goc: string): Set<string> {
  const da = new Set<string>([goc]);
  const hang = [goc];
  while (hang.length) {
    const f = hang.pop()!;
    const ma = readFileSync(f, 'utf8');
    for (const m of ma.matchAll(/(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g)) {
      const t = giaiDuong(f, m[1]!);
      if (t !== null && !da.has(t)) { da.add(t); hang.push(t); }
    }
  }
  return da;
}

describe('màn SỔ không kéo màn nặng vào gói của nó', () => {
  it('⭐⭐ đồ thị nhập (bắc cầu) của So.tsx không chạm HŨ · GƯƠNG · biểu đồ · định hướng · ba mặt', () => {
    const doThi = doThiNhap(GOC);
    expect(doThi.size, 'đồ thị rỗng ⇒ bộ đọc import hỏng, bài này không canh gì').toBeGreaterThan(10);
    const lot = CAM.filter((f) => doThi.has(f)).map((f) => f.slice(SRC.length + 1));
    expect(lot, 'SỔ đang nhập (bắc cầu) một màn nặng').toEqual([]);
  });

  it('bộ đọc import thấy được một cạnh có thật (không xanh vì đọc sai)', () => {
    // So.tsx nhập hộp quyết toán — cạnh này PHẢI có trong đồ thị.
    expect(doThiNhap(GOC).has(join(SRC, 'screens/tai-chinh/QuyetToanHop.tsx'))).toBe(true);
  });
});
