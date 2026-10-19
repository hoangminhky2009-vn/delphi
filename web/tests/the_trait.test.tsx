/**
 * THẺ TRAIT TRÊN APP = ĐÚNG TRANG ĐÃ CHỐT (D422, A11.25).
 *
 * Founder 26/09: *"t chốt hết hiệu ứng/ hình ảnh và màu của bản demo"*. Trang `docs/ui-ux/demo/the-trait.html` là nguồn
 * chân lý; app chép (hình sinh bằng `scripts/sinh_the_trait.ts`, chữ trang sinh từ `lib/trait_chu.ts`). Bản chép không
 * canh là bản sao thứ hai sẽ trôi (D61). Tệp này canh:
 *   §I   hình: mọi trait có lưới 24×24, từng ô = lưới của trang; bảng màu = bảng của trang (vàng CHỈ cho xu);
 *   §II  chữ: tên · luật · ngoài đời · điểm của trang = của app (trang in đúng chữ app);
 *   §III token màu của CSS = `:root` của trang; ranh easing A11.18 (thở = ease-in-out, nảy = cubic-bezier, lún = steps);
 *   §IV  hạt nổ: 12 hạt, không hạt nào khi giảm chuyển động.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TRAIT, type TraitId } from '@config/trait';
import { LUOI_GHIM, LUOI_TRAIT, MAU_TRAIT } from '../src/lib/trait_hinh';
import { TRAIT_CHU, diemChu, hoMau } from '../src/lib/trait_chu';
import { phutHat } from '../src/components/holdem/TheTrait';

const DEMO = readFileSync(resolve(process.cwd(), '../docs/ui-ux/demo/the-trait.html'), 'utf8');
const CSS = readFileSync(resolve(process.cwd(), 'src/components/holdem/TheTrait.module.css'), 'utf8');
/** Token của app (lần khai ĐẦU trong `tokens.css`) — CSS thẻ gọi token khi mã màu trùng (`mau_theo_token`). */
const TOKEN: Record<string, string> = {};
for (const m of readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8').matchAll(/--([\w-]+):\s*([^;]+);/g)) {
  TOKEN[m[1]!] ??= m[2]!.trim();
}
/** `var(--x)` → giá trị thật (đệ quy), để so với mã màu gõ thẳng ở trang demo. */
const giaiToken = (v: string): string => {
  const m = /^var\(--([\w-]+)\)$/.exec(v.trim());
  return m && TOKEN[m[1]!] !== undefined ? giaiToken(TOKEN[m[1]!]!) : v.trim();
};

const LUOI_DEMO = JSON.parse(/const LUOI = (\{[\s\S]*?\});\r?\n/.exec(DEMO)![1]!) as Record<string, string[]>;
const GHIM_DEMO = JSON.parse(/const GHIM = (\[.*?\]);\r?\n/.exec(DEMO)![1]!) as string[];
const CHU_DEMO = JSON.parse(/const CHU = (\[[\s\S]*?\]);\r?\n/.exec(DEMO)![1]!) as {
  id: string; loai: string; vai: string | null; diem: string; ten: string; luat: string; doi: string | null;
}[];
/** `--ten:#hex` trong khối `:root{…}` ĐẦU TIÊN của trang. */
const ROOT_DEMO = Object.fromEntries(
  [...(/:root\{([\s\S]*?)\n  \}/.exec(DEMO)?.[1] ?? '').matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
);

describe('§I hình = trang demo', () => {
  it('bài không rỗng: trang bày đúng bộ trait của config, không thiếu không thừa', () => {
    expect(CHU_DEMO.length).toBe(TRAIT.length);
    expect(CHU_DEMO.map((t) => t.id).sort()).toEqual(TRAIT.map((t) => t.id).sort());
  });
  for (const t of TRAIT) {
    it(`"${t.id}" — lưới 24×24, từng ô khớp trang`, () => {
      const l = LUOI_TRAIT[t.id];
      expect(l, `app thiếu hình ${t.id}`).toBeTruthy();
      expect(l!.length).toBe(24);
      for (const h of l!) expect(h.length).toBe(24);
      expect([...l!]).toEqual(LUOI_DEMO[t.id]);
      // chỉ chữ màu hợp lệ: '.', năm nấc họ, năm nấc vàng
      expect(l!.join('')).toMatch(/^[.1-5a-e]+$/);
    });
  }
  it('dấu GHIM + bảng màu = trang; vàng (a…e) chung cho hai họ — màu của đồng xu, không họ nào có vàng riêng', () => {
    expect([...LUOI_GHIM]).toEqual(GHIM_DEMO);
    const vang = /const VANG = \{([^}]*)\};/.exec(DEMO)![1]!;
    for (const [k, v] of Object.entries(MAU_TRAIT.tai)) {
      if (/[a-e]/.test(k)) {
        expect(vang).toContain(`${k}: '${v}'`);
        expect(MAU_TRAIT.tat[k]).toBe(v);
      }
    }
    for (const ho of ['tai', 'tat'] as const) {
      const m = new RegExp(`${ho}: \\{ (1: '#[0-9a-f]{6}'(?:, \\d: '#[0-9a-f]{6}')*)`).exec(DEMO)!;
      for (const [, k, v] of m[1]!.matchAll(/(\d): '(#[0-9a-f]{6})'/g)) expect(MAU_TRAIT[ho][k!]).toBe(v);
    }
  });
});

describe('§II chữ = trang demo (trang in đúng chữ app)', () => {
  for (const d of CHU_DEMO) {
    it(`"${d.id}" — tên · luật · ngoài đời · điểm · họ`, () => {
      const c = TRAIT_CHU[d.id as TraitId];
      expect(c.ten).toBe(d.ten);
      expect(c.luat).toBe(d.luat);
      expect(c.doi ?? null).toBe(d.doi);
      expect(diemChu(d.id as TraitId)).toBe(d.diem);
      expect(hoMau(d.id)).toBe(d.loai);
    });
  }
});

describe('§III token + ranh easing', () => {
  it('token màu của thẻ = `:root` của trang (chép nguyên, không diễn giải lại)', () => {
    expect(Object.keys(ROOT_DEMO).length, 'không đọc được :root của trang').toBeGreaterThan(10);
    const doi: [string, string][] = [
      ...[0, 1, 2, 3, 4, 5].flatMap((i) => [[`tai-${i}`, `tai-${i}`], [`tat-${i}`, `tat-${i}`]] as [string, string][]),
      ['nen', 't-nen'], ['ni', 't-ni'], ['ni-vien', 't-ni-vien'], ['chu', 't-chu'], ['chu-mo', 't-chu-mo'],
      ['khung', 't-khung'], ['xu', 't-xu'], ['xu-sang', 't-xu-sang'], ['art', 'art'],
    ];
    const chuan = (v: string) => v.replace(/\s+/g, '').replace(/0\./g, '.').toLowerCase();
    for (const [demo, app] of doi) {
      const m = new RegExp(`--${app}:\\s*([^;]+);`).exec(CSS);
      expect(m, `CSS thiếu --${app}`).toBeTruthy();
      expect(chuan(giaiToken(m![1]!)), `--${app}`).toBe(chuan(ROOT_DEMO[demo]!));
    }
  });
  it('A11.18: quầng thở = ease-in-out · chia bài/nhấc thẻ/tấm = cubic-bezier nảy · nút lún = steps', () => {
    expect(CSS).toMatch(/animation: tho 1600ms ease-in-out infinite/);
    expect(CSS).toMatch(/animation: chia 460ms cubic-bezier\(0\.2, 1\.25, 0\.4, 1\)/);
    expect(CSS).toMatch(/transition: transform 70ms steps\(2, end\), box-shadow 70ms steps\(2, end\)/);
    expect(CSS).toMatch(/transition: transform 320ms cubic-bezier\(0\.2, 1\.25, 0\.4, 1\)/);
    expect(CSS).toMatch(/prefers-reduced-motion: reduce/);
  });
});

describe('§IV hạt nổ', () => {
  const goc = HTMLElement.prototype.animate;
  afterEach(() => {
    HTMLElement.prototype.animate = goc;
    document.body.innerHTML = '';
  });
  it('12 hạt từ tâm phần tử; giảm chuyển động ⇒ không hạt nào', () => {
    HTMLElement.prototype.animate = (() => ({ onfinish: null })) as unknown as typeof goc;
    const el = document.createElement('button');
    document.body.appendChild(el);
    phutHat(el, '#c8fad9', true);
    expect(document.body.querySelectorAll('i').length).toBe(0);
    phutHat(el, '#c8fad9', false);
    expect(document.body.querySelectorAll('i').length).toBe(12);
  });
});
