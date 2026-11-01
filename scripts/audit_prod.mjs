/**
 * AUDIT GÓI PROD — `npm audit --omit=dev`, chặn từ high, trừ NGOẠI LỆ CÓ HẠN (founder 01/11 B).
 *
 *   node scripts/audit_prod.mjs            (chạy trong thư mục có package-lock: gốc hoặc web/)
 *
 * Ngoại lệ khoá theo (thư mục · GHSA · gói), không theo mức: một cảnh báo khác cùng gói vẫn chặn.
 * Ngoại lệ THỪA (cảnh báo không còn hiện) ⇒ đỏ: điều kiện gỡ do máy nhắc, không ai phải nhớ (A11.15).
 * Lỗi mạng / JSON hỏng ⇒ đỏ — audit không chạy được không phải audit xanh.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/** @type {{ thu_muc: string; ghsa: string; goi: string; ly_do: string; go_khi: string }[]} */
export const NGOAI_LE = [
  {
    thu_muc: 'web',
    ghsa: 'GHSA-mrhx-c7xc-m3w5',
    goi: 'zod',
    ly_do: 'zod 3.x chỉ vào bundle qua @discord/embedded-app-sdk 2.5.0 (bản mới nhất, đòi zod ^3.9.8; dòng 3.x không có bản vá), '
      + 'nạp động chỉ khi chạy trong Discord (web/src/lib/discord.ts); khai thác cần payload quá cỡ từ khung Discord ⇒ treo tab của chính người chơi',
    go_khi: '@discord/embedded-app-sdk dùng zod ≥ 4.6.6 (hoặc gỡ SDK) — khi đó cảnh báo biến mất và bước này đỏ "ngoại lệ thừa"',
  },
];

const CHAN = new Set(['high', 'critical']);

/**
 * Thuần: đọc JSON `npm audit --json` (npm ≥ 7). Chỉ xét cảnh báo gốc (`via` là object); `via` là chuỗi = gói phụ thuộc
 * vào gói lỗi — cảnh báo gốc của nó đã nằm ở gói kia.
 * @param {any} bao
 * @param {string} thuMuc
 * @param {typeof NGOAI_LE} ngoaiLe
 */
export function danhGia(bao, thuMuc, ngoaiLe = NGOAI_LE) {
  if (!bao || typeof bao !== 'object' || !bao.vulnerabilities) throw new Error(`npm audit không trả báo cáo: ${JSON.stringify(bao?.error ?? bao).slice(0, 300)}`);
  const cuaToi = ngoaiLe.filter((n) => n.thu_muc === thuMuc);
  const chan = [];
  const boQua = [];
  const thay = new Set();
  for (const [goi, v] of Object.entries(bao.vulnerabilities)) {
    for (const via of v.via ?? []) {
      if (typeof via !== 'object') continue;
      const ghsa = /GHSA-[\w-]+/.exec(via.url ?? '')?.[0] ?? String(via.source);
      const n = cuaToi.find((x) => x.ghsa === ghsa && x.goi === goi);
      if (n) { thay.add(n); boQua.push({ goi, ghsa, muc: via.severity, ly_do: n.ly_do }); continue; }
      if (CHAN.has(via.severity)) chan.push({ goi, ghsa, muc: via.severity, tieu_de: via.title });
    }
  }
  const thua = cuaToi.filter((n) => !thay.has(n));
  return { chan, boQua, thua };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const thuMuc = path.basename(process.cwd()) === 'web' ? 'web' : 'goc';
  const r = spawnSync('npm audit --omit=dev --json', { encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
  let kq;
  try { kq = danhGia(JSON.parse(r.stdout || 'null'), thuMuc); } catch (e) { console.error(`✗ ${e instanceof Error ? e.message : e}\n${r.stderr ?? ''}`); process.exit(2); }
  for (const b of kq.boQua) console.log(`⚠ bỏ qua ${b.ghsa} (${b.goi}, ${b.muc}) — ngoại lệ có hạn: ${b.ly_do}`);
  for (const t of kq.thua) console.error(`✗ ngoại lệ THỪA ${t.ghsa} (${t.goi}) — cảnh báo không còn hiện ⇒ xoá mục khỏi NGOAI_LE ở scripts/audit_prod.mjs (điều kiện gỡ: ${t.go_khi})`);
  for (const c of kq.chan) console.error(`✗ ${c.muc} ${c.ghsa} ở ${c.goi}: ${c.tieu_de}`);
  if (kq.chan.length || kq.thua.length) process.exit(1);
  console.log(`✔ audit gói prod (${thuMuc}): không lỗ high/critical ngoài ${kq.boQua.length} ngoại lệ có hạn`);
}
