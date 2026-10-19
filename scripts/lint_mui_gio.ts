/**
 * LINT — SQL ĐI THEO MÚI GIỜ CỦA PHIÊN DB (D364).
 *
 * ─── VÌ SAO CẦN LINT, TRONG KHI ĐÃ CÓ CẢ MỘT SUITE TEST ─────────────────────
 *
 * Postgres quyết "ngày" bằng **múi giờ của PHIÊN** ở mọi phép sau: `ts::date`,
 * `date_trunc('day', ts)`, `to_char(ts, …)`, `extract(hour FROM ts)`, và cả phép so
 * một cột `timestamptz` với một giá trị `date`. Prod (Supabase) chạy **UTC**, nên
 * "hôm nay" của DB bắt đầu lúc **07:00 sáng giờ VN**.
 *
 * ⚠⚠ MÁY TEST KHÔNG NHÌN RA LỚP LỖI NÀY, VÀ ĐÓ LÀ CHUYỆN ĐÃ ĐO:
 *   · Postgres nhúng lấy múi giờ của máy ⇒ phiên `Asia/Bangkok` (+07) — TRÙNG giờ VN.
 *     Một câu sai ra ĐÚNG ngày VN ở đây và LỆCH 7 TIẾNG trên prod.
 *   · D341 tiêm `min(started_at)::date` vào mặt PHIÊN BẢN: bài canh "ngày đầu/cuối là
 *     NGÀY VIỆT NAM" vẫn **XANH** (mũi 14b).
 *   · 16/09 chạy CẢ suite gốc với phiên ép UTC: **không một bài nào đỏ** — kể cả ở
 *     commit còn mang đúng lỗi `::date` mà D341 sửa. Ép UTC là điều kiện CẦN, không đủ.
 *   · Và ép UTC chỉ soi được lớp "hôm nay" khi chạy trong khung **00–07h VN** (ngoài
 *     khung đó, ngày UTC trùng ngày VN nên sai cũng không lộ). Một cái lưới chỉ giăng
 *     được 7 tiếng mỗi ngày thì không phải lưới.
 *
 * ⇒ Hai lớp, bắt hai thứ khác nhau (đúng khuôn `lint:pool-lock` + `pool_max1.test.ts`):
 *   1. `tests/helpers/testdb.ts` ép phiên UTC — cho bài test chạy trên đúng đồng hồ prod.
 *   2. LINT NÀY — bắt lúc VIẾT, không cần chờ tới giờ nào trong ngày.
 *
 * ─── LUẬT ───────────────────────────────────────────────────────────────────
 *
 * Mọi phép cắt ngày/giờ trên cột thời điểm phải nói RÕ múi giờ: `AT TIME ZONE`.
 * Khuôn sẵn có: `dauNgay()` / `ngayCua()` ở `server/admin_phan_tich.ts`.
 *
 *   ✗ `min(m.started_at)::date`          ✓ `(m.started_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`
 *   ✗ `date_trunc('month', created_at)`  ✓ `date_trunc('month', created_at AT TIME ZONE $2)`
 *   ✗ `ts >= ($1 || '-01')::date`        ✓ `ts >= (($1 || '-01')::date)::timestamp AT TIME ZONE <tz>`
 *   ✗ `CURRENT_DATE`, `now()::date`      ✓ `(now() AT TIME ZONE u.mui_gio)::date`
 *
 * Cột kiểu `date` (`ngay`, `thang`, `tuan`, `ky`) KHÔNG dính luật này — chúng không có
 * giờ để mà lệch.
 *
 * ─── GIỚI HẠN, KHAI THẲNG ───────────────────────────────────────────────────
 *
 * Đây là phép quét VĂN BẢN, không phải bộ phân tích SQL. Nó bắt các hình dạng ĐÃ gây
 * lỗi thật, và nó đọc "cột thời điểm" theo TÊN (`ts`, `*_at`, `*_ts`, `*_luc`, `now()`).
 * Đặt tên cột kiểu khác thì nó không thấy — và một câu SQL dựng bằng nối chuỗi nhiều
 * mảnh cũng có thể lọt. Cần cố ý đi ngoài luật thì ghi ngay trên dòng đó:
 *
 *     // mui-gio-ok: <lý do>
 *
 * Miễn trừ tính theo ĐÚNG MỘT DÒNG (dòng có dấu, và dòng ngay sau nó) — không có cửa
 * miễn cả tệp, vì một cửa như thế sẽ được mở ra rồi không ai đóng lại.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Thư mục quét SQL: mọi nơi có câu chạm DB prod (kể cả script chạy tay). */
const THU_MUC_SQL = ['server', 'api', 'scripts', 'migrations'];
/** Thư mục quét giờ MÁY: chỉ mã chạy trên Vercel (UTC). Script chạy ở máy founder thì giờ máy là đúng ý. */
const THU_MUC_GIO_MAY = ['server', 'api'];

export interface ViPham {
  tep: string;
  dong: number;
  luat: string;
  trich: string;
}

/** Biểu thức "có giờ trong đó" — cột timestamptz theo quy ước tên của repo, hoặc `now()`. */
const CO_GIO = /\bnow\s*\(\s*\)|\b(?:\w+\.)?(?:ts|[a-z][a-z0-9]*_(?:at|ts|luc))\b/i;
const CO_TZ = /at\s+time\s+zone/i;
/** Lời gọi khuôn dùng chung — bản thân nó đã có `AT TIME ZONE` bên trong. */
const KHUON = /\b(?:dauNgay|ngayCua)\s*\(/;

const an = (bt: string): boolean => CO_TZ.test(bt) || KHUON.test(bt);

/* ══════════════════════════════════════════════════════════════════════════
 * Tước chú thích — GIỮ NGUYÊN SỐ DÒNG
 *
 * ⚠ Bắt buộc, và đã có tiền lệ trả giá: chính chú thích giải thích luật lại chứa
 * ví dụ `::date` sai, nên quét thô là lint tự báo động vào mặt mình (D87). Nội dung
 * chuỗi và template thì GIỮ — SQL sống trong đó.
 * ══════════════════════════════════════════════════════════════════════════ */
export function tuocChuThich(src: string, laSql = false): string {
  const ra: string[] = [];
  const khung: { loai: 'ma' | 'tpl'; nhon: number }[] = [{ loai: 'ma', nhon: 0 }];
  const giuDong = (s: string) => s.replace(/[^\n]/g, ' ');
  let i = 0;
  while (i < src.length) {
    const f = khung[khung.length - 1]!;
    const c = src[i]!;
    const d = src[i + 1];
    if (f.loai === 'tpl') {
      if (c === '\\') { ra.push(c, src[i + 1] ?? ''); i += 2; continue; }
      if (c === '`') { khung.pop(); ra.push(c); i += 1; continue; }
      if (c === '$' && d === '{') { khung.push({ loai: 'ma', nhon: 0 }); ra.push('${'); i += 2; continue; }
      ra.push(c); i += 1; continue;
    }
    // ── trong mã ──
    if (!laSql && c === '/' && d === '/') {
      const het = src.indexOf('\n', i);
      const den = het === -1 ? src.length : het;
      ra.push(giuDong(src.slice(i, den))); i = den; continue;
    }
    if (laSql && c === '-' && d === '-') {
      const het = src.indexOf('\n', i);
      const den = het === -1 ? src.length : het;
      ra.push(giuDong(src.slice(i, den))); i = den; continue;
    }
    if (c === '/' && d === '*') {
      const het = src.indexOf('*/', i + 2);
      const den = het === -1 ? src.length : het + 2;
      ra.push(giuDong(src.slice(i, den))); i = den; continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < src.length) {
        if (!laSql && src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) { j += 1; break; }
        j += 1;
      }
      ra.push(src.slice(i, j)); i = j; continue;
    }
    if (!laSql && c === '`') { khung.push({ loai: 'tpl', nhon: 0 }); ra.push(c); i += 1; continue; }
    if (c === '{') { f.nhon += 1; ra.push(c); i += 1; continue; }
    if (c === '}') {
      if (f.nhon === 0 && khung.length > 1) khung.pop();
      else f.nhon -= 1;
      ra.push(c); i += 1; continue;
    }
    ra.push(c); i += 1;
  }
  return ra.join('');
}

/** Dòng được miễn: dòng mang dấu `mui-gio-ok: <lý do>` và dòng ngay sau nó. */
export function dongMienTru(src: string): Set<number> {
  const ra = new Set<number>();
  src.split('\n').forEach((d, idx) => {
    if (/mui-gio-ok:\s*\S/.test(d)) { ra.add(idx + 1); ra.add(idx + 2); }
  });
  return ra;
}

/** Biểu thức đứng ngay TRƯỚC vị trí `i` (đã cân ngoặc, gồm cả tên hàm nếu có). */
function bieuThucTruoc(s: string, i: number): string {
  let j = i - 1;
  while (j >= 0 && /\s/.test(s[j]!)) j -= 1;
  if (j < 0) return '';
  const het = j + 1;
  const dong = (mo: string, dong2: string): number => {
    let sau = 0;
    while (j >= 0) {
      if (s[j] === dong2) sau += 1;
      else if (s[j] === mo) { sau -= 1; if (sau === 0) return j; }
      j -= 1;
    }
    return 0;
  };
  if (s[j] === ')') { j = dong('(', ')'); }
  else if (s[j] === '}') { j = dong('{', '}'); if (s[j - 1] === '$') j -= 1; }
  else { while (j >= 0 && /[\w$.'"]/.test(s[j]!)) j -= 1; j += 1; return s.slice(j, het); }
  // lùi thêm qua tên hàm (min, max, coalesce…) hoặc `$` của `${…}`
  let k = j - 1;
  while (k >= 0 && /\w/.test(s[k]!)) k -= 1;
  return s.slice(k + 1, het);
}

/**
 * Biểu thức đứng NGAY SAU vị trí `i` (vế phải của một phép so).
 *
 * ⚠ Phải cân ngoặc và đi XUYÊN DÒNG: SQL trong repo xuống dòng giữa chừng, nên bản đầu
 * (chỉ đọc hết dòng) đọc `ts >= ((($1)::date)::timestamp` rồi kết luận "không có
 * AT TIME ZONE" — trong khi mệnh đề ấy nằm ở dòng kế. Dừng ở ranh mệnh đề thật.
 */
function bieuThucSau(s: string, i: number): string {
  let sau = 0;
  let j = i;
  for (; j < s.length; j += 1) {
    const c = s[j]!;
    if (c === '(') { sau += 1; continue; }
    if (c === ')') { if (sau === 0) break; sau -= 1; continue; }
    if (sau > 0) continue;
    if (c === ',' || c === ';' || c === '`') break;
    if (/\s/.test(c) && /^\s+(and|or|group\s+by|order\s+by|having|limit|union|returning)\b/i.test(s.slice(j))) break;
  }
  return s.slice(i, j);
}

/** Danh sách tham số của lời gọi hàm mở ngoặc tại `mo`. */
function thamSo(s: string, mo: number): string[] {
  const ra: string[] = [];
  let sau = 0;
  let dau = mo + 1;
  for (let j = mo; j < s.length; j += 1) {
    const c = s[j]!;
    if (c === '(') sau += 1;
    else if (c === ')') {
      sau -= 1;
      if (sau === 0) { ra.push(s.slice(dau, j)); break; }
    } else if (c === ',' && sau === 1) { ra.push(s.slice(dau, j)); dau = j + 1; }
  }
  return ra;
}

/** Quét một tệp đã đọc. `tep` chỉ dùng để dán nhãn (và để biết .sql hay .ts). */
export function quet(src: string, tep: string): ViPham[] {
  const laSql = tep.endsWith('.sql');
  const s = tuocChuThich(src, laSql);
  const mien = dongMienTru(src);
  const dauDong: number[] = [0];
  for (let i = 0; i < s.length; i += 1) if (s[i] === '\n') dauDong.push(i + 1);
  const dongCua = (i: number): number => {
    let lo = 0; let hi = dauDong.length - 1;
    while (lo < hi) { const giua = (lo + hi + 1) >> 1; if (dauDong[giua]! <= i) lo = giua; else hi = giua - 1; }
    return lo + 1;
  };

  const ra: ViPham[] = [];
  const them = (i: number, luat: string, trich: string) => {
    const dong = dongCua(i);
    if (mien.has(dong)) return;
    ra.push({ tep, dong, luat, trich: trich.replace(/\s+/g, ' ').trim().slice(0, 110) });
  };

  // R1 — `::date` / `::timestamp` áp thẳng lên biểu thức có giờ
  for (const m of s.matchAll(/::\s*(date|timestamp)(?![a-z])/gi)) {
    const bt = bieuThucTruoc(s, m.index!);
    if (CO_GIO.test(bt) && !an(bt)) them(m.index!, 'ep-kieu-tran', `${bt}${m[0]}`);
  }

  // R2 — `date_trunc(đơn vị, X)` hai tham số
  for (const m of s.matchAll(/\bdate_trunc\s*\(/gi)) {
    const args = thamSo(s, m.index! + m[0].length - 1);
    const x = args[1] ?? '';
    if (args.length < 3 && CO_GIO.test(x) && !an(x)) them(m.index!, 'date_trunc-khong-tz', `date_trunc(${args[0]},${x})`);
  }

  // R3 — hằng "bây giờ" theo phiên
  for (const m of s.matchAll(/\b(current_date|localtimestamp|current_time)\b/gi)) {
    them(m.index!, 'hang-theo-phien', m[0]);
  }

  // R4 — `to_char` trên biểu thức có giờ
  for (const m of s.matchAll(/\bto_char\s*\(/gi)) {
    const x = thamSo(s, m.index! + m[0].length - 1)[0] ?? '';
    if (CO_GIO.test(x) && !an(x)) them(m.index!, 'to_char-khong-tz', `to_char(${x}, …)`);
  }

  // R5 — `extract` / `date_part` (trừ `epoch`: hiệu hai mốc không phụ thuộc múi giờ)
  for (const m of s.matchAll(/\b(extract|date_part)\s*\(/gi)) {
    const args = thamSo(s, m.index! + m[0].length - 1);
    let truong = '';
    let x = '';
    if (m[1]!.toLowerCase() === 'extract') {
      const tach = (args[0] ?? '').split(/\bfrom\b/i);
      truong = tach[0] ?? '';
      x = tach.slice(1).join(' from ');
    } else { truong = args[0] ?? ''; x = args[1] ?? ''; }
    if (/epoch/i.test(truong)) continue;
    if (CO_GIO.test(x) && !an(x)) them(m.index!, 'extract-khong-tz', `${m[1]}(${truong} from ${x})`);
  }

  // R6 — so cột thời điểm với một giá trị KIỂU NGÀY (Postgres tự nâng bằng múi giờ phiên)
  for (const m of s.matchAll(/\b(?:\w+\.)?(?:ts|[a-z][a-z0-9]*_(?:at|ts|luc))\s*(?:>=|<=|<>|<|>|=)/gi)) {
    const ve = bieuThucSau(s, m.index! + m[0].length);
    if (/::\s*date\b/i.test(ve) && !an(ve)) them(m.index!, 'so-voi-kieu-ngay', `${m[0]}${ve}`);
  }

  // R7 — giờ MÁY trong mã chạy trên Vercel (Node ở đó là UTC, máy founder là +07)
  // ⚠ So theo ĐOẠN ĐẦU của đường dẫn tương đối. Bản đầu hỏi `includes('/server/')` — với
  // `server/pfm/x.ts` (không có dấu / đứng trước) thì luật này chưa bao giờ chạy; bài test
  // §I bắt được đúng cú đó.
  if (!laSql && THU_MUC_GIO_MAY.includes(tep.replace(/\\/g, '/').split('/')[0] ?? '')) {
    const ham = /\.(getHours|getDate|getDay|getMonth|getFullYear|setHours|setDate|setMonth|setFullYear|getTimezoneOffset|toDateString|toTimeString|toLocaleDateString)\s*\(/g;
    for (const m of s.matchAll(ham)) them(m.index!, 'gio-may', m[0]);
  }
  return ra;
}

async function gom(dir: string, duoi: string[]): Promise<string[]> {
  const ra: string[] = [];
  let muc;
  try { muc = await readdir(dir, { withFileTypes: true }); } catch { return ra; }
  for (const e of muc) {
    const day = path.join(dir, e.name);
    if (e.isDirectory()) ra.push(...(await gom(day, duoi)));
    else if (duoi.some((x) => e.name.endsWith(x))) ra.push(day);
  }
  return ra;
}

export async function lintMuiGio(goc = GOC): Promise<ViPham[]> {
  const ra: ViPham[] = [];
  for (const d of THU_MUC_SQL) {
    for (const tep of await gom(path.join(goc, d), ['.ts', '.sql'])) {
      // Bảng mẫu của chính lint nằm trong mã nguồn của nó — quét mình là tự báo động giả,
      // và một lint hay báo động giả sẽ bị tắt đi (D79).
      if (path.basename(tep) === 'lint_mui_gio.ts') continue;
      ra.push(...quet(await readFile(tep, 'utf8'), path.relative(goc, tep).replace(/\\/g, '/')));
    }
  }
  return ra;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const laChinh = process.argv[1]?.endsWith('lint_mui_gio.ts');
if (laChinh) {
  const xau = await lintMuiGio();
  if (xau.length === 0) {
    console.log('✓ Lint múi giờ: không câu SQL nào cắt ngày/giờ theo múi giờ của phiên DB');
    process.exit(0);
  }
  console.error(`✗ ${xau.length} chỗ đi theo MÚI GIỜ PHIÊN (prod = UTC, máy test = +07 — sai mà không đỏ):\n`);
  for (const v of xau) console.error(`  ${v.tep}:${v.dong}  [${v.luat}]  ${v.trich}`);
  console.error('\nCách sửa: nói rõ múi giờ — `(cot AT TIME ZONE \'Asia/Ho_Chi_Minh\')::date`, hoặc dùng');
  console.error('`dauNgay()` / `ngayCua()` ở server/admin_phan_tich.ts. Cố ý đi ngoài luật thì ghi');
  console.error('`// mui-gio-ok: <lý do>` ngay trên dòng đó.');
  process.exit(1);
}
