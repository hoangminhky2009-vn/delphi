/**
 * Khoá hành vi của lint animation chết câm (scripts/lint_css_anim.ts).
 *
 * Lint này sinh ra sau sự cố 20/07/2026: 20 khai báo animation trong 12 file
 * `*.module.css` trỏ vào @keyframes toàn cục → CSS Modules đổi tên → hiệu ứng
 * im lặng không chạy, build vẫn xanh. Không công cụ nào báo.
 */
import { describe, expect, it } from 'vitest';
import { findAnimationNames, scanModuleCss, stripCssComments } from '../scripts/lint_css_anim.js';

describe('lint animation chết câm', () => {
  it('BẮT được đúng ca đã gây sự cố: keyframe ở file khác', () => {
    const css = `.lose {\n  animation: losehit 0.5s ease-out both;\n}`;
    const bad = scanModuleCss(css, 'DoorRow.module.css');
    expect(bad).toHaveLength(1);
    expect(bad[0]!.name).toBe('losehit');
    expect(bad[0]!.line).toBe(2);
  });

  it('CHO QUA khi @keyframes nằm cùng file', () => {
    const css = `@keyframes losehit { 0% { opacity: 1; } }\n.lose { animation: losehit 0.5s ease-out both; }`;
    expect(scanModuleCss(css, 'x.module.css')).toHaveLength(0);
  });

  it('CHO QUA `composes` — đường dùng chung hợp lệ', () => {
    const css = `.lose {\n  composes: doorLose from '../../styles/motion.module.css';\n  opacity: 0.42;\n}`;
    expect(scanModuleCss(css, 'x.module.css')).toHaveLength(0);
  });

  it('đọc được khai báo NHIỀU DÒNG, nhiều lớp animation', () => {
    const css = `@keyframes a { 0% { opacity: 0; } }\n.win {\n  animation:\n    a 0.75s cubic-bezier(0.3, 1.6, 0.4, 1) both,\n    b 1s ease-out 0.1s both,\n    c 2.8s ease-in-out 1.2s infinite;\n}`;
    const bad = scanModuleCss(css, 'x.module.css').map((v) => v.name);
    expect(bad).toEqual(['b', 'c']); // `a` khai cùng file nên hợp lệ
  });

  it('KHÔNG nhầm từ khoá cú pháp và hàm timing thành tên keyframe', () => {
    const css = `@keyframes k { 0% { opacity: 0; } }\n.x { animation: k 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.3) both infinite alternate; }`;
    expect(scanModuleCss(css, 'x.module.css')).toHaveLength(0);
  });

  it('KHÔNG nhầm biến CSS trong var() thành tên keyframe', () => {
    const css = `@keyframes badgeup { 0% { opacity: 0; } }\n.x { animation: badgeup var(--dl-badgeup-dur, 0.45s) ease both; }`;
    expect(scanModuleCss(css, 'x.module.css')).toHaveLength(0);
  });

  it('tước comment nhưng GIỮ số dòng (bẫy đã dính ở lint từ vựng)', () => {
    const src = `/* animation: losehit 1s;\n   nhiều dòng */\n.x { animation: real 1s; }`;
    expect(stripCssComments(src).split('\n')).toHaveLength(3);
    expect(findAnimationNames(src)).toEqual([{ name: 'real', line: 3 }]);
  });
});
