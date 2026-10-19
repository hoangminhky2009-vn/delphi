/**
 * SINH `web/src/lib/trait_hinh.ts` TỪ TRANG DEMO ĐÃ DUYỆT (D422).
 *
 * Trang `docs/ui-ux/demo/the-trait.html` là nguồn chân lý của 27 hình trait (A11.25, founder 26/09: *"t chốt hết hiệu
 * ứng/ hình ảnh và màu của bản demo"*): lưới chữ `LUOI`, dấu ghim `GHIM`, bảng màu `PAL` (năm nấc họ xanh/đỏ + năm nấc
 * VÀNG chỉ cho hình đồng xu). Tệp của app là bản CHÉP — chép tay thì trôi (D61). Sửa một hình = sửa ở demo, cho founder
 * xem, rồi chạy:
 *
 *   npx tsx scripts/sinh_the_trait.ts
 *
 * `web/tests/the_trait.test.tsx` so từng ô + từng mã màu với trang demo: quên chạy lệnh này thì bài canh đỏ.
 * Cùng nếp `scripts/sinh_la_bai.ts` (D393).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = resolve(GOC, 'docs/ui-ux/demo/the-trait.html');
const RA = resolve(GOC, 'web/src/lib/trait_hinh.ts');

const html = readFileSync(DEMO, 'utf8');
/** Lá trang demo BÀY (mảng `CHU`) — bảng `LUOI` của trang còn giữ vài lưới cũ không bày (vd LỬA GIẢ), không chép. */
const CHU = JSON.parse(/const CHU = (\[[\s\S]*?\]);\r?\n/.exec(html)![1]!) as { id: string }[];
const TAT_CA = JSON.parse(/const LUOI = (\{[\s\S]*?\});\r?\n/.exec(html)![1]!) as Record<string, string[]>;
const LUOI = Object.fromEntries(CHU.map((t) => {
  const l = TAT_CA[t.id];
  if (!l) throw new Error(`trang demo bày "${t.id}" mà không có lưới`);
  return [t.id, l] as const;
}));
const GHIM = JSON.parse(/const GHIM = (\[.*?\]);\r?\n/.exec(html)![1]!) as string[];
/** `{ a: '#…', … }` của demo (khoá không ngoặc, chuỗi nháy đơn) → bản ghi. */
function doiTuong(ten: string): Record<string, string> {
  const m = new RegExp(`const ${ten} = \\{([^}]*)\\};`).exec(html);
  if (!m) throw new Error(`trang demo không có ${ten}`);
  return Object.fromEntries([...m[1]!.matchAll(/(\w+): '(#[0-9a-f]{6})'/g)].map((x) => [x[1]!, x[2]!]));
}
const VANG = doiTuong('VANG');
/** Năm nấc họ màu: `tai: { 1: '#…', …, 5: '#…', ...VANG }`. */
function ho(ten: 'tai' | 'tat'): Record<string, string> {
  const m = new RegExp(`${ten}: \\{ (1: '#[0-9a-f]{6}'(?:, \\d: '#[0-9a-f]{6}')*)`).exec(html);
  if (!m) throw new Error(`trang demo không có họ màu ${ten}`);
  return Object.fromEntries([...m[1]!.matchAll(/(\d): '(#[0-9a-f]{6})'/g)].map((x) => [x[1]!, x[2]!]));
}
const HO = { tai: ho('tai'), tat: ho('tat') };

for (const [id, l] of Object.entries(LUOI)) {
  if (l.length !== 24 || l.some((h) => h.length !== 24)) throw new Error(`lưới "${id}" không phải 24×24`);
  const la = [...new Set(l.join(''))].filter((c) => c !== '.' && !(c in HO.tai) && !(c in VANG));
  if (la.length > 0) throw new Error(`lưới "${id}" có chữ màu lạ: ${la.join(' ')}`);
}

const hang = (l: readonly string[]) => l.map((h) => `    '${h}',`).join('\n');
const bangMau = (o: Record<string, string>) => `{ ${Object.entries(o).map(([k, v]) => `'${k}': '${v}'`).join(', ')} }`;
const ra = `/**
 * HÌNH 27 LÁ TRAIT — founder chốt 26/09 (D422): *"t chốt hết hiệu ứng/ hình ảnh và màu của bản demo"*.
 *
 * ⚠ NGUỒN CHÂN LÝ LÀ TRANG DEMO \`docs/ui-ux/demo/the-trait.html\`, không phải tệp này (A11.25). Tệp SINH RA bằng
 *   \`npx tsx scripts/sinh_the_trait.ts\`; \`web/tests/the_trait.test.tsx\` so từng ô + từng mã màu với trang. Gõ tay ở
 *   đây là lệch khỏi trang đã duyệt.
 *
 * QUY ƯỚC: lưới 24×24 · \`.\` trong suốt (nền thẻ tự vẽ) · '1'…'5' = năm nấc sắc độ của HỌ màu (TÀI xanh / TẬT đỏ —
 * lưới không mang màu, họ do lá quyết) · 'a'…'e' = năm nấc VÀNG, CHỈ cho hình đồng xu (luật màu: vàng là màu của xu).
 * Cặp của vai tô theo tính chất của chính nó + dấu GHIM ở góc.
 */
export const LUOI_TRAIT: Readonly<Record<string, readonly string[]>> = {
${Object.entries(LUOI).map(([id, l]) => `  ${id}: [\n${hang(l)}\n  ],`).join('\n')}
};

/** Dấu GHIM 7×7 ở góc trái trên của cặp độc quyền theo vai. */
export const LUOI_GHIM: readonly string[] = [
${hang(GHIM)}
];

/** Bảng màu theo họ: năm nấc sắc độ + năm nấc vàng. */
export const MAU_TRAIT: Readonly<Record<'tai' | 'tat', Readonly<Record<string, string>>>> = {
  tai: ${bangMau({ ...HO.tai, ...VANG })},
  tat: ${bangMau({ ...HO.tat, ...VANG })},
};
`;
writeFileSync(RA, ra, 'utf8');
console.log(`ghi ${RA} — ${Object.keys(LUOI).length} lưới`);
