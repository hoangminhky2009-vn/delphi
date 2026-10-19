/**
 * BÀI CANH CHO CÔNG CỤ TIÊM (scripts/tiem.ts — D535 B3).
 *
 * Công cụ tiêm là thứ từng làm hỏng tệp sáu lần (D301 · D395 · D453 · D466 · D479 · 05/10),
 * nên chính nó phải bị canh: ba điều kiện chuỗi, đọc dòng Tests qua mã màu, và vòng
 * thay → chạy → ghi lại bản gốc → so băm — kể cả khi lệnh test nổ giữa chừng.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { bang, docKetQua, kiemChuoi, lenhTest, tiemMot } from '../scripts/tiem.js';

describe('I. Ba điều kiện chuỗi — mỗi điều kiện là một lần đã hỏng tệp', () => {
  it('chuỗi mới RỖNG bị từ chối (D466: thay ngược chuỗi rỗng chèn vào mọi vị trí)', () => {
    expect(kiemChuoi('abc', 'b', '')).toMatch(/RỖNG/);
  });
  it('chuỗi cũ phải xuất hiện đúng MỘT lần (0 lần và 2 lần đều bị từ chối)', () => {
    expect(kiemChuoi('abc', 'z', 'y')).toMatch(/0 lần/);
    expect(kiemChuoi('abab', 'ab', 'y')).toMatch(/2 lần/);
  });
  it('chuỗi mới đã có sẵn trong tệp bị từ chối (D395, 05/10: hoàn nguyên kẹt)', () => {
    expect(kiemChuoi('a x b', 'a', 'x')).toMatch(/đã có sẵn/);
  });
  it('tiêm được thì trả null', () => {
    expect(kiemChuoi('a x b', 'a', 'TIEM')).toBeNull();
  });
});

describe('II. Đọc dòng Tests — qua mã màu ANSI (08/09)', () => {
  it('đọc được "N failed | M passed" lẫn mã màu', () => {
    expect(docKetQua('\x1b[2m      Tests \x1b[22m \x1b[1m\x1b[31m2 failed\x1b[39m | \x1b[32m7 passed\x1b[39m')).toEqual({ do: 2, xanh: 7 });
  });
  it('không có failed ⇒ 0 đỏ', () => {
    expect(docKetQua('      Tests  12 passed (12)')).toEqual({ do: 0, xanh: 12 });
  });
  it('MỌI bài đỏ ⇒ vitest in "Tests 1 failed (1)" không có vế passed — vẫn đọc được (ca S2 06/10)', () => {
    expect(docKetQua('      Tests  1 failed (1)')).toEqual({ do: 1, xanh: 0 });
  });
  it('không có dòng Tests ⇒ null (không đoán)', () => {
    expect(docKetQua('vitest crashed')).toBeNull();
  });
  it('test ở web/ chạy trong thư mục web với đường dẫn cắt tiền tố', () => {
    const l = lenhTest(['web/tests/a.test.tsx'], 'R');
    expect(l.cwd).toBe(path.join('R', 'web'));
    expect(l.lenh).toContain('tests/a.test.tsx');
    expect(l.lenh).not.toContain('web/tests');
  });
});

describe('III. Vòng tiêm thật trên tệp tạm — ghi lại bản gốc, không thay ngược', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'delphi-tiem-'));
  const muc = path.join(dir, 'muc.txt');
  const goc = 'dòng một\nGIA_TRI = 1\ndòng ba\n';
  writeFileSync(muc, goc, 'utf8');
  // "bộ test" giả: đỏ khi tệp mang chuỗi tiêm, xanh khi không.
  const kiemGia = path.join(dir, 'kiem_gia.cjs');
  writeFileSync(kiemGia, [
    "const fs = require('node:fs');",
    'const t = fs.readFileSync(process.argv[2], "utf8");',
    'if (t.includes("GIA_TRI = 2")) { console.log("      Tests  1 failed | 0 passed"); process.exit(1); }',
    'console.log("      Tests  0 failed | 1 passed");',
  ].join('\n'), 'utf8');
  const lenh = `node "${kiemGia}" "${muc}"`;
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('mũi đúng ⇒ 1 đỏ, tệp trở về đúng từng byte', () => {
    const k = tiemMot({ tag: 'M1', tep: muc, cu: 'GIA_TRI = 1', moi: 'GIA_TRI = 2', lenh }, dir);
    expect(k.do).toBe(1);
    expect(k.hoanNguyen).toBe('khớp');
    expect(readFileSync(muc, 'utf8')).toBe(goc);
  });

  it('mũi nhắm dòng không có ⇒ KHÔNG TIÊM, tệp không bị chạm', () => {
    const k = tiemMot({ tag: 'M2', tep: muc, cu: 'KHONG_CO', moi: 'X', lenh }, dir);
    expect(k.ghiChu).toMatch(/KHÔNG TIÊM/);
    expect(readFileSync(muc, 'utf8')).toBe(goc);
  });

  it('lệnh test nổ (không in dòng Tests) ⇒ vẫn hoàn nguyên khớp, kết quả "?"', () => {
    const k = tiemMot({ tag: 'M3', tep: muc, cu: 'GIA_TRI = 1', moi: 'GIA_TRI = 2', lenh: 'node -e "process.exit(7)"' }, dir);
    expect(k.do).toBe(-1);
    expect(k.hoanNguyen).toBe('khớp');
    expect(readFileSync(muc, 'utf8')).toBe(goc);
  });

  it('bảng kết quả có một dòng mỗi mũi', () => {
    const b = bang([{ tag: 'M1', tep: 'a', do: 1, xanh: 3, hoanNguyen: 'khớp' }]);
    expect(b.split('\n')).toHaveLength(3);
    expect(b).toContain('1 đỏ / 3 xanh');
  });
});
