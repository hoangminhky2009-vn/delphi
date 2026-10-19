/**
 * D548 — CHỜ MÀN CỦA BÀN phải TRÔNG là đang chờ (founder 07/10: *"Vào trận phát bấm chốt vòng luôn là bị"* kẹt ở vòng 1, không mua tài sản).
 * Dựng lại trên trình duyệt + server thật: bàn KHÔNG kẹt — chốt xong không có màn riêng thì chờ màn của bàn ~49 s rồi tự sang vòng 2. Nhưng suốt
 * lúc chờ, CTA vẫn lam đặc "CHỐT VÒNG" y như chưa chốt: lớp `.nutChot.nutChot` (nhân đôi để thắng `.nut`) thắng luôn kiểu `:disabled`.
 *
 *   §I  TayBai: có mốc chờ ⇒ CTA tắt, đếm "CHỜ BÀN · Ns", hết giờ "MỞ VÒNG SAU…"; không mốc ⇒ "CHỐT VÒNG" như cũ
 *   §II CSS: CTA tắt trông tắt (xám chìm, không lam đặc)
 *   §III màn trận nối mốc chờ màn vào CTA đúng lúc lớp màn không mở
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

import { TayBai } from '../src/components/holdem/TayBai';

const doc = (rel: string): string => readFileSync(resolve(process.cwd(), rel), 'utf8');

afterEach(() => { cleanup(); vi.useRealTimers(); });

const ve = (them: Record<string, unknown> = {}) => render(
  <TayBai shopMo={false} onShop={() => {}} soTheChon={0} onChotVong={() => {}} onBo={() => {}} {...them} />,
);
const cta = (c: HTMLElement) => c.querySelector('button[data-tap="nut-shop"] ~ button') as HTMLButtonElement
  ?? [...c.querySelectorAll('button')].find((b) => /CHỐT|CHỜ|MỞ VÒNG/.test(b.textContent ?? ''))!;

describe('§I — CTA lúc chờ màn của bàn', () => {
  it('⭐ có mốc chờ ⇒ tắt, đếm "CHỜ BÀN · Ns", đánh dấu data-cho; hết giờ ⇒ "MỞ VÒNG SAU…"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T03:00:00Z'));
    const { container } = ve({ choDen: Date.now() + 41_000 });
    const nut = [...container.querySelectorAll('button')].find((b) => /CHỜ BÀN/.test(b.textContent ?? ''))!;
    expect(nut, 'CTA phải đổi nhãn').toBeTruthy();
    expect(nut.textContent).toContain('CHỜ BÀN · 41s');
    expect(nut.disabled).toBe(true);
    expect(nut.getAttribute('data-cho')).toBe('1');
    act(() => { vi.advanceTimersByTime(42_000); });
    expect(nut.textContent).toContain('MỞ VÒNG SAU…');
  });
  it('vế ngược: không mốc ⇒ "CHỐT VÒNG", bấm được', () => {
    const { container } = ve();
    const nut = cta(container);
    expect(nut.textContent).toContain('CHỐT VÒNG');
    expect(nut.disabled).toBe(false);
    expect(nut.hasAttribute('data-cho')).toBe(false);
  });
});

describe('§II — CTA tắt trông tắt', () => {
  it('⭐ `.nutChot.nutChot:disabled` cùng độ đặc hiệu với lớp lam đặc, đứng SAU nó, nền chìm + chữ mờ', () => {
    const css = doc('src/components/holdem/TayBai.module.css');
    const iLam = css.indexOf('.nutChot.nutChot {');
    const iTat = css.indexOf('.nutChot.nutChot:disabled {');
    expect(iLam).toBeGreaterThan(-1);
    expect(iTat, 'thiếu kiểu tắt').toBeGreaterThan(iLam);
    const khoi = css.slice(iTat, css.indexOf('}', iTat));
    expect(khoi).toMatch(/background:\s*var\(--surface-inset\)/);
    expect(khoi).toMatch(/color:\s*var\(--text-muted\)/);
    expect(khoi).not.toMatch(/var\(--accent\)/);
  });
});

describe('§III — màn trận nối mốc chờ', () => {
  it('⭐ CTA nhận mốc hết màn khi đang chờ màn và lớp màn không mở', () => {
    const man = doc('src/screens/holdem/AlphaDraftMatch.tsx');
    expect(man).toMatch(/choDen=\{st\.cho_man && manVong === null \? choManMoc\.current\?\.moc : undefined\}/);
  });
});
