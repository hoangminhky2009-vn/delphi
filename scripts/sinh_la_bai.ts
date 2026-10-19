/**
 * SINH `server/art/la_bai.ts` TỪ TRANG DEMO ĐÃ DUYỆT (D393).
 *
 * Trang demo `docs/ui-ux/demo/la-bai-phong-cach.html` là nguồn chân lý của 22 lá (A11.25): mảng `LUOI`
 * (lưới chữ) và mảng `THE` (nét neon · màu vệt · góc) nằm ở đó. Tệp art của server là bản CHÉP — và bản chép
 * gõ tay là bản sẽ trôi (D61). Nên sửa một lá = sửa ở demo, cho founder xem, rồi chạy:
 *
 *   npx tsx scripts/sinh_la_bai.ts
 *
 * `tests/holdem_art.test.ts` §5 so từng ô với trang demo: quên chạy lệnh này thì bài canh đỏ.
 * Nhịp loé kim (`nhip: 'kim'`) đọc từ CSS của demo (`[data-id=…] .cua svg .vet{animation-name:vetKim}`),
 * không gõ danh sách.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = resolve(GOC, 'docs/ui-ux/demo/la-bai-phong-cach.html');
const RA = resolve(GOC, 'server/art/la_bai.ts');

const html = readFileSync(DEMO, 'utf8');
const LUOI = JSON.parse(/const LUOI = (\{.*?\});\r?\n/.exec(html)![1]!) as Record<string, string[]>;

/** Một lá của mảng `THE`: `{ id: '…', …, neon: [...], vet: [...], goc: N }`. */
function laDemo(id: string): { neon: string[]; vet: string; goc: number } {
  const m = new RegExp(`\\{ id: '${id}',([^{}]*?)goc: (-?\\d+) \\}`).exec(html);
  if (!m) throw new Error(`trang demo không có lá "${id}"`);
  const mang = (ten: string) => [...new RegExp(`${ten}: \\[(.*?)\\]`).exec(m[1]!)![1]!.matchAll(/'([^']+)'/g)]
    .map((x) => x[1]!);
  return { neon: mang('neon'), vet: mang('vet')[0]!, goc: Number(m[2]) };
}
const KIM = new Set([...html.matchAll(/\[data-id="([a-z_]+)"\] \.cua svg \.vet\{animation-name:vetKim\}/g)]
  .map((m) => m[1]!));

/** Khoá art trong app → mã lá trong demo, xếp theo nhóm như trên bàn. */
const NHOM: readonly [string, readonly (readonly [string, string])[]][] = [
  ['GIAI ĐOẠN THỊ TRƯỜNG (ô bản đồ `gd_*`)', [
    ['gd_tang', 'tang'], ['gd_giam', 'giam'], ['gd_di_ngang', 'di_ngang'],
    ['gd_bien_dong', 'bien_dong'], ['gd_phuc_hoi', 'phuc_hoi'],
  ]],
  ['TIN (ô bản đồ `sk_*`) — lá thiên nga đen dùng chung cho MỌI tin `hoang_loan`, xem `holdem_art.ts`', [
    ['sk_ha_lai_suat', 'ha_lai'], ['sk_tang_lai_suat', 'tang_lai'], ['sk_lam_phat', 'lam_phat'],
    ['sk_hack_san', 'hack_san'], ['sk_bong_bong', 'bong_bong'], ['sk_thien_nga_den', 'thien_nga'],
  ]],
  ['CHIẾN THUẬT (lá của người chơi)', [
    ['don_bay', 'don_bay'], ['mua_duoi', 'mua_duoi'], ['bat_day', 'bat_day'],
    ['luot_song', 'luot_song'], ['ban_khong', 'ban_khong'],
  ]],
  ['TÀI SẢN (sáu mã)', [
    ['btc', 'ts_btc'], ['cp_cn', 'ts_cp_cn'], ['vn30', 'ts_vn30'],
    ['vang', 'ts_vang'], ['usd', 'ts_usd'], ['tpcp', 'ts_tpcp'],
  ]],
];

const DAU = `/**
 * LÁ BÀI BẢN MỚI — 22 lưới, founder duyệt 23–24/09 (D390; demo bản 12).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ NGUỒN CHÂN LÝ LÀ TRANG DEMO, không phải tệp này (A11.25):
 *   \`docs/ui-ux/demo/la-bai-phong-cach.html\`. Tệp này là bản CHÉP từng ô của trang ấy, và
 *   \`tests/holdem_art.test.ts\` §5 so từng ô + neon + góc vệt với nó. Sửa một lá = sửa ở
 *   demo, cho founder xem, rồi chép sang đây — bài canh đỏ cho tới khi hai bên khớp.
 *   Tệp SINH RA bằng \`npx tsx scripts/sinh_la_bai.ts\` (đọc thẳng trang demo); gõ tay ở đây là
 *   lệch khỏi trang đã duyệt.
 *
 * QUY ƯỚC (khác bộ cũ 80×60 ở \`./grids_chien_thuat.ts\`):
 *   · lưới VUÔNG 48×48 — riêng cặp lãi suất 40×40 (bồ câu vẽ ở cỡ ấy; hai lá phải cùng
 *     khuôn, founder 24/09: *"giống nhau y hệt chỉ khác màu và linh vật"*);
 *   · \`.\` = trong suốt: lá KHÔNG có nền — khung ngoài (ô bản đồ, lá trên tay) tự vẽ cửa
 *     sổ tối, nên một hình dùng được trên mọi nền;
 *   · chữ màu = \`BANG_MAU\` ở \`config/pixel_luoi.ts\`, như mọi art pixel khác.
 *
 * \`neon\` = chữ màu của NÉT CHÍNH (đường xu hướng, viền chủ thể): bộ vẽ chép riêng các nét
 * ấy ra một lớp để khung ngoài cho THỞ sáng, và một vệt sáng chạy DỌC chúng — neon chạy
 * trên nét vẽ, không chạy quanh khung (founder 23/09). \`vet\` = màu tâm vệt, \`goc\` = hướng
 * dải sáng (độ). \`nhip: 'kim'\` = nhịp loé kim loại của cặp lãi suất (quét 30% chu kỳ 3,4s).
 */
export interface LaBai {
  /** Mã lá trong trang demo — bài canh tra lưới của trang theo mã này. */
  demo: string;
  neon: readonly string[];
  vet: string;
  goc: number;
  nhip?: 'kim';
  luoi: readonly string[];
}

export const LA_BAI: Record<string, LaBai> = {`;

const dong: string[] = [DAU];
for (const [tieu, ds] of NHOM) {
  dong.push(`  // ── ${tieu} ──`);
  for (const [khoa, demo] of ds) {
    const t = laDemo(demo);
    const luoi = LUOI[demo];
    if (!luoi) throw new Error(`trang demo không có lưới "${demo}"`);
    if (!luoi.every((h) => h.length === luoi.length)) throw new Error(`lưới "${demo}" không vuông`);
    const neon = t.neon.map((c) => `'${c}'`).join(', ');
    const nhip = KIM.has(demo) ? ", nhip: 'kim'" : '';
    dong.push(`  ${khoa}: { demo: '${demo}', neon: [${neon}], vet: '${t.vet}', goc: ${t.goc}${nhip}, luoi: [`);
    for (const h of luoi) dong.push(`    '${h}',`);
    dong.push('  ] },');
  }
}
dong.push('};');
writeFileSync(RA, `${dong.join('\n')}\n`, 'utf8');
console.log(`✓ ${RA} — ${NHOM.reduce((n, [, ds]) => n + ds.length, 0)} lá từ trang demo`);
