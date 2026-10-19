/**
 * LINT ANIMATION CHẾT CÂM — chặn đúng lớp lỗi đã ăn nguyên màn Kết quả (20/07/2026).
 *
 * TRIỆU CHỨNG: build xanh, typecheck xanh, test xanh, console sạch — mà hiệu ứng
 * KHÔNG CHẠY. Không có gì báo cho bạn biết.
 *
 * NGUYÊN NHÂN: CSS Modules đổi tên MỌI animation-name trong file `*.module.css`.
 *   /* styles/motion.css (toàn cục) *\/      @keyframes losehit { ... }
 *   /* DoorRow.module.css *\/               .lose { animation: losehit .5s ...; }
 * biên dịch ra `animation: _losehit_1i8e2_1 .5s ...` — cái tên đó không có định
 * nghĩa nào, nên trình duyệt bỏ qua lặng lẽ. Đã chết 20 khai báo / 12 file:
 * cửa thắng không nảy, cửa sai không rung, huy hiệu không trượt, con trỏ không
 * nháy, scanline không thở, vệt sáng không quét, nền không chớp.
 *
 * LUẬT: trong một `*.module.css`, mọi tên animation phải có `@keyframes` CÙNG FILE.
 * Cần dùng chung → `composes: <lớp> from 'styles/motion.module.css'`.
 *
 * (CSS thường — không phải module — không bị đổi tên nên không quét.)
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SCAN_ROOT = 'web/src';

/** Từ khoá của cú pháp `animation` — không phải tên keyframe. */
const CSS_ANIM_KEYWORDS = new Set([
  'none', 'infinite', 'alternate', 'reverse', 'normal', 'both', 'forwards',
  'backwards', 'running', 'paused', 'linear', 'ease', 'initial', 'inherit',
  'unset', 'revert', 'steps', 'cubic', 'bezier', 'start', 'end', 'jump',
  's', 'ms', 'var', 'and', 'in', 'out',
]);

export interface AnimViolation {
  file: string;
  line: number;
  name: string;
}

/**
 * Thay comment `/* … *\/` bằng khoảng trắng, GIỮ NGUYÊN số dòng để báo đúng chỗ.
 * Bắt buộc: chính file này viết comment tiếng Việt có chữ "animation:" — không
 * tước thì lint tự tố mình. Đúng cái bẫy lint từ vựng cũ (đã gỡ D91) từng ghi.
 */
export function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Tách phần giá trị của mọi khai báo `animation`/`animation-name` (kể cả nhiều dòng). */
export function findAnimationNames(input: string): { name: string; line: number }[] {
  const source = stripCssComments(input);
  const out: { name: string; line: number }[] = [];
  const re = /animation(?:-name)?\s*:\s*([^;}]*)[;}]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const line = source.slice(0, m.index).split('\n').length;
    const value = m[1] ?? '';
    // Bỏ nội dung trong ngoặc — cubic-bezier(...), var(...), steps(...)
    const flat = value.replace(/\([^)]*\)/g, ' ');
    for (const raw of flat.split(',')) {
      for (const tok of raw.trim().split(/\s+/)) {
        if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(tok)) continue; // số, thời gian, %…
        if (CSS_ANIM_KEYWORDS.has(tok.toLowerCase())) continue;
        if (tok.startsWith('--')) continue;
        out.push({ name: tok, line });
        break; // mỗi lớp animation chỉ có MỘT tên
      }
    }
  }
  return out;
}

export function scanModuleCss(source: string, file: string): AnimViolation[] {
  const declared = new Set(
    [...stripCssComments(source).matchAll(/@keyframes\s+([A-Za-z_][A-Za-z0-9_-]*)/g)].map(
      (m) => m[1]!,
    ),
  );
  return findAnimationNames(source)
    .filter((a) => !declared.has(a.name))
    .map((a) => ({ file, line: a.line, name: a.name }));
}

async function collect(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await collect(full)));
    else if (e.name.endsWith('.module.css')) out.push(full);
  }
  return out;
}

export async function lintCssAnim(root = SCAN_ROOT): Promise<AnimViolation[]> {
  const found: AnimViolation[] = [];
  for (const file of await collect(root)) {
    found.push(...scanModuleCss(await readFile(file, 'utf8'), file));
  }
  return found;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const isMain = process.argv[1]?.endsWith('lint_css_anim.ts');
if (isMain) {
  const bad = await lintCssAnim();
  if (bad.length === 0) {
    console.log('✓ Lint animation: mọi @keyframes dùng trong *.module.css đều có định nghĩa cùng file');
    process.exit(0);
  }
  console.error(`✗ ${bad.length} animation CHẾT CÂM (gọi tên nhưng không có @keyframes cùng file):\n`);
  for (const v of bad) {
    console.error(`  ${v.file}:${v.line}  → "${v.name}"`);
  }
  console.error('\nCách sửa: dùng `composes: <lớp> from "…/styles/motion.module.css"`');
  console.error('thay vì gõ `animation: <tên> …`. Xem đầu file web/src/styles/motion.module.css.');
  process.exit(1);
}
