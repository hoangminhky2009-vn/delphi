/**
 * TIÊM LỖI NGƯỢC — một lần, gỡ an toàn (A11.6 · A12 §5 · D535 bước B3).
 *
 * Vì sao có công cụ này: sáu lần công cụ tiêm tự viết làm HỎNG TỆP đang dở —
 * `git checkout --` xoá cả việc chưa commit (D301) · chuỗi mới trùng chỗ khác nên không
 * gỡ được (D395, 05/10) · chuỗi mới rỗng chèn vào mọi vị trí khi thay ngược (D453, D466) ·
 * `open(p,'w')` cắt rỗng tệp trước khi đọc (D479). Mọi bài học ấy nằm ở đây một lần:
 *
 *   1. ĐỌC bản gốc vào biến TRƯỚC, giữ băm SHA-256.
 *   2. Chuỗi cũ phải xuất hiện ĐÚNG MỘT lần; chuỗi mới KHÔNG rỗng và CHƯA có trong tệp.
 *   3. Thay bằng hàm (`replace(a, () => b)`) — tránh bẫy `$$` (13/09).
 *   4. Chạy test, đọc dòng `Tests N failed | M passed` (đã lọc mã màu ANSI).
 *   5. Hoàn nguyên bằng cách GHI LẠI BẢN GỐC (không thay ngược), rồi so băm.
 *   6. Ghi lỗi Errno 22 (tệp đang bị tsx/vitest giữ) thì thử lại 10 × 1 s (25/09).
 *
 * Dùng (ưu tiên tệp JSON — tiếng Việt qua tham số dòng lệnh PowerShell dễ méo):
 *   npm run tiem -- --bo <mui.json>
 *     mui.json: [{ "tag": "M1", "tep": "server/x.ts", "cu": "…", "moi": "…", "test": ["tests/x.test.ts"] }]
 *   npm run tiem -- --tep server/x.ts --cu "…" --moi "…" --test tests/x.test.ts [--tag M1]
 *   Tuỳ chọn mỗi mũi: "lenh" — lệnh chạy thay cho vitest (bài test của chính công cụ dùng).
 *
 * Mã thoát: 0 mọi mũi đỏ ≥ 1 và hoàn nguyên khớp · 2 có mũi KHÔNG đỏ (bài canh rỗng hoặc mũi
 * nhắm dòng chết — xem feedback 05/09, 26/09) · 1 hoàn nguyên lệch hoặc không tiêm được.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Mui {
  tag: string;
  tep: string;
  cu: string;
  moi: string;
  test?: string[];
  lenh?: string;
}

export interface KetQuaMui {
  tag: string;
  tep: string;
  do: number;        // -1 = không đọc được dòng Tests
  xanh: number;
  hoanNguyen: 'khớp' | 'LỆCH';
  ghiChu?: string;
}

/** Kiểm ba điều kiện trước khi chạm tệp. Trả null khi tiêm được, chuỗi lý do khi không. */
export function kiemChuoi(goc: string, cu: string, moi: string): string | null {
  if (!cu) return 'chuỗi cũ rỗng';
  if (!moi) return 'chuỗi mới RỖNG — thay ngược sẽ chèn vào mọi vị trí (D466)';
  const n = goc.split(cu).length - 1;
  if (n !== 1) return `chuỗi cũ xuất hiện ${n} lần, phải đúng 1`;
  if (goc.includes(moi)) return 'chuỗi mới đã có sẵn trong tệp — hoàn nguyên sẽ kẹt (D395, 05/10)';
  return null;
}

/** Đọc dòng `Tests N failed | M passed` của vitest, bỏ mã màu ANSI (bài học 08/09). */
export function docKetQua(out: string): { do: number; xanh: number } | null {
  const sach = out.replace(/\x1b\[[0-9;]*m/g, '');
  // Ba dạng vitest in: `Tests 2 failed | 7 passed (9)` · `Tests 12 passed (12)` · `Tests 1 failed (1)` (mọi bài đỏ —
  // dạng thứ ba từng làm bộ đọc trả "?" và mũi S2 06/10 bị ghi nhầm là không đọc được).
  // Quét MỌI chỗ có chữ "Tests" (dòng "Failed Tests 1 ⎯" đứng TRƯỚC dòng tổng), lấy chỗ đầu tiên đọc ra số.
  for (const m of sach.matchAll(/Tests\s+(?:(\d+) failed)?(?:\s*\|\s*)?(?:(\d+) passed)?/g)) {
    if (m[1] === undefined && m[2] === undefined) continue;
    return { do: Number(m[1] ?? 0), xanh: Number(m[2] ?? 0) };
  }
  return null;
}

export function lenhTest(test: string[], root: string): { lenh: string; cwd: string } {
  const web = test.length > 0 && test.every((t) => t.startsWith('web/'));
  if (web) {
    return {
      lenh: `npx vitest run ${test.map((t) => t.slice(4)).join(' ')} --reporter=basic`,
      cwd: path.join(root, 'web'),
    };
  }
  return { lenh: `npx vitest run ${test.join(' ')} --reporter=basic`, cwd: root };
}

function bam(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function ngu(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function ghiCoThuLai(p: string, s: string): void {
  let loi: unknown;
  for (let i = 0; i < 10; i++) {
    try {
      writeFileSync(p, s, 'utf8');
      return;
    } catch (e) {
      loi = e;
      ngu(1000);
    }
  }
  throw loi;
}

export function chayLenh(lenh: string, cwd: string): { rc: number; out: string } {
  const r = spawnSync(lenh, {
    cwd, shell: true, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { rc: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** Tiêm một mũi: thay → chạy → GHI LẠI BẢN GỐC → so băm. Không bao giờ thay ngược. */
export function tiemMot(m: Mui, root: string): KetQuaMui {
  const p = path.resolve(root, m.tep);
  const goc = readFileSync(p, 'utf8');
  const h0 = bam(goc);
  const loi = kiemChuoi(goc, m.cu, m.moi);
  if (loi) return { tag: m.tag, tep: m.tep, do: -1, xanh: -1, hoanNguyen: 'khớp', ghiChu: `KHÔNG TIÊM — ${loi}` };
  if (!m.lenh && (!m.test || m.test.length === 0)) {
    return { tag: m.tag, tep: m.tep, do: -1, xanh: -1, hoanNguyen: 'khớp', ghiChu: 'KHÔNG TIÊM — thiếu "test" hoặc "lenh"' };
  }
  const { lenh, cwd } = m.lenh ? { lenh: m.lenh, cwd: root } : lenhTest(m.test!, root);
  let kq: { do: number; xanh: number } | null = null;
  let ghiChu: string | undefined;
  try {
    ghiCoThuLai(p, goc.replace(m.cu, () => m.moi));
    const r = chayLenh(lenh, cwd);
    kq = docKetQua(r.out);
    if (!kq) ghiChu = `không đọc được dòng Tests (rc=${r.rc})`;
  } finally {
    ghiCoThuLai(p, goc);
  }
  const hoanNguyen = bam(readFileSync(p, 'utf8')) === h0 ? 'khớp' : 'LỆCH';
  return { tag: m.tag, tep: m.tep, do: kq?.do ?? -1, xanh: kq?.xanh ?? -1, hoanNguyen, ...(ghiChu ? { ghiChu } : {}) };
}

export function bang(kq: KetQuaMui[]): string {
  const dong = kq.map((k) => `| ${k.tag} | \`${k.tep}\` | ${k.do < 0 ? '?' : k.do} đỏ / ${k.xanh < 0 ? '?' : k.xanh} xanh | ${k.hoanNguyen}${k.ghiChu ? ` — ${k.ghiChu}` : ''} |`);
  return ['| mũi | tệp | kết quả | hoàn nguyên |', '|---|---|---|---|', ...dong].join('\n');
}

function docThamSo(argv: string[]): Mui[] {
  const lay = (co: string): string | undefined => {
    const i = argv.indexOf(co);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const bo = lay('--bo');
  if (bo) {
    const ds = JSON.parse(readFileSync(bo, 'utf8')) as Mui[];
    if (!Array.isArray(ds)) throw new Error('--bo: tệp JSON phải là mảng mũi');
    return ds;
  }
  const tep = lay('--tep');
  const cu = lay('--cu');
  const moi = lay('--moi');
  if (!tep || cu === undefined || moi === undefined) throw new Error('Dùng: --bo <mui.json> | --tep <tệp> --cu "…" --moi "…" --test <tệp test…> [--tag M1] [--lenh "<lệnh>"]');
  const iTest = argv.indexOf('--test');
  const test = iTest >= 0 ? argv.slice(iTest + 1).filter((x) => !x.startsWith('--')).filter((x) => x !== cu && x !== moi) : [];
  const lenh = lay('--lenh');
  return [{ tag: lay('--tag') ?? 'M1', tep, cu, moi, test, ...(lenh ? { lenh } : {}) }];
}

async function main(): Promise<void> {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const ds = docThamSo(process.argv.slice(2));
  const kq: KetQuaMui[] = [];
  for (const m of ds) {
    const k = tiemMot(m, ROOT);
    kq.push(k);
    console.log(`${k.tag}: ${k.do < 0 ? '?' : k.do} đỏ / ${k.xanh < 0 ? '?' : k.xanh} xanh — hoàn nguyên ${k.hoanNguyen}${k.ghiChu ? ` — ${k.ghiChu}` : ''}`);
  }
  console.log('\n' + bang(kq) + '\n');
  if (kq.some((k) => k.hoanNguyen === 'LỆCH' || k.ghiChu?.startsWith('KHÔNG TIÊM'))) {
    console.error('✗ có mũi hoàn nguyên LỆCH hoặc không tiêm được — kiểm tệp bằng git diff ngay.');
    process.exit(1);
  }
  if (kq.some((k) => k.do <= 0)) {
    console.error('✗ có mũi KHÔNG đỏ — bài canh rỗng, hoặc mũi nhắm dòng chết (feedback 05/09, 26/09). Chưa được tính là nghiệm thu.');
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
