/**
 * LINT — TỰ KHOÁ POOL: xin kết nối thứ hai trong khi đang cầm kết nối thứ nhất.
 *
 * ─── VÌ SAO CẦN MỘT CÁI LINT CHO ĐÚNG MỘT DÒNG CODE ──────────────────────────
 *
 * Bug thật 04/08 (commit `20b4bec`): cửa KHÁCH giữ `client` rồi gọi
 * `createSession(pool, …)`. Trên prod `api/index.ts` mở pool với **`max: 1`**
 * (đúng cho serverless — mỗi instance chỉ nên giữ MỘT kết nối thật qua transaction
 * pooler), nên xin kết nối thứ hai là **xin chính cái mình đang giữ**: chờ vĩnh
 * viễn, Vercel cắt ở 10,4 giây, người dùng thấy 504.
 *
 * ⚠⚠ ĐÂY LÀ LỚP LỖI TEST KHÔNG BAO GIỜ BẮT ĐƯỢC BẰNG CÁCH CHẠY BÌNH THƯỜNG:
 * pool ở local mở `max: 10` nên cùng một đoạn code chạy đúng ở máy mình và bế tắc
 * trên prod. Khác biệt nằm trong **một con số cấu hình ở một file khác** — không
 * có gì trong đoạn code nhìn ra được. `tsc` sạch, test xanh, prod chết.
 *
 * Commit `20b4bec` tự khai: *"repo có 8 chỗ khác cùng dùng `pool.connect()` …
 * phải rà một lượt"*. Rà tay một lượt thì lượt sau lại phải rà — nên rà bằng lint.
 *
 * ─── LUẬT ────────────────────────────────────────────────────────────────────
 *
 * Trong đoạn từ `X.connect()` tới `.release()`, **KHÔNG được nhắc tới `X`**.
 * Cần chạy câu lệnh thì dùng `client`; cần gọi hàm phụ thì truyền `client` vào.
 *
 * ⚠ Lint này bắt CHỖ DỄ THẤY (tên pool xuất hiện thẳng trong khối). Nó KHÔNG bắt
 * được đường vòng — một hàm nhận `client` nhưng bên trong lại dùng pool ở scope
 * module. Chống đường đó là bài test `tests/pool_max1.test.ts`: chạy chính các
 * endpoint trên một pool `max: 1`, tức đúng ràng buộc của prod.
 * Hai lớp vì chúng bắt hai thứ khác nhau; bỏ lớp nào cũng hở.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THU_MUC = ['server', 'api'];

export interface ViPhamPool {
  file: string;
  dongConnect: number;
  dongViPham: number;
  ten: string;
  noiDung: string;
}

/** Bỏ chú thích + chuỗi, GIỮ NGUYÊN số dòng (thay bằng khoảng trắng). */
function xoaChuThich(src: string): string[] {
  const ra: string[] = [];
  let trongKhoi = false;
  for (const dong of src.split('\n')) {
    let out = '';
    let i = 0;
    while (i < dong.length) {
      if (trongKhoi) {
        if (dong.startsWith('*/', i)) { trongKhoi = false; i += 2; out += '  '; }
        else { i += 1; out += ' '; }
        continue;
      }
      if (dong.startsWith('/*', i)) { trongKhoi = true; i += 2; out += '  '; continue; }
      if (dong.startsWith('//', i)) { out += ' '.repeat(dong.length - i); break; }
      const c = dong[i]!;
      if (c === "'" || c === '"' || c === '`') {
        // Chuỗi: nuốt tới dấu đóng cùng loại (đủ dùng — không có chuỗi nhiều dòng
        // nào trong repo mang tên biến pool).
        out += ' ';
        i += 1;
        while (i < dong.length && dong[i] !== c) {
          if (dong[i] === '\\') { out += ' '; i += 1; }
          out += ' ';
          i += 1;
        }
        if (i < dong.length) { out += ' '; i += 1; }
        continue;
      }
      out += c;
      i += 1;
    }
    ra.push(out);
  }
  return ra;
}

export function quetNguon(src: string, file: string): ViPhamPool[] {
  const dong = xoaChuThich(src);
  const loi: ViPhamPool[] = [];

  for (let i = 0; i < dong.length; i += 1) {
    // `const client = await <ten>.connect()` — `<ten>` là biến pool.
    const m = /(?:const|let)\s+\w+\s*=\s*await\s+([A-Za-z_$][\w$.]*)\.connect\(\)/.exec(dong[i]!);
    if (!m) continue;
    const ten = m[1]!;

    // Khối "đang cầm kết nối" kết thúc ở `.release()` gần nhất phía sau.
    let het = dong.length;
    for (let j = i + 1; j < dong.length; j += 1) {
      if (/\.release\(\)/.test(dong[j]!)) { het = j; break; }
    }

    // Tên pool xuất hiện lại trong khối = xin kết nối thứ hai (hoặc mở đường tới nó).
    const mau = new RegExp(`(^|[^\\w$.])${ten.replace(/\./g, '\\.')}(?![\\w$])`);
    for (let j = i + 1; j < het; j += 1) {
      if (mau.test(dong[j]!)) {
        loi.push({
          file, dongConnect: i + 1, dongViPham: j + 1, ten,
          noiDung: dong[j]!.trim().slice(0, 100),
        });
      }
    }
  }
  return loi;
}

async function moiFileTs(dir: string): Promise<string[]> {
  const ra: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ra.push(...(await moiFileTs(p)));
    else if (e.name.endsWith('.ts')) ra.push(p);
  }
  return ra;
}

export async function quetRepo(): Promise<ViPhamPool[]> {
  const ra: ViPhamPool[] = [];
  for (const tm of THU_MUC) {
    for (const f of await moiFileTs(path.join(ROOT, tm))) {
      ra.push(...quetNguon(await readFile(f, 'utf8'), path.relative(ROOT, f).replace(/\\/g, '/')));
    }
  }
  return ra;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const loi = await quetRepo();
  if (loi.length === 0) {
    console.log('lint:pool-lock — sạch (không chỗ nào xin kết nối thứ hai khi đang cầm kết nối).');
  } else {
    console.error(`lint:pool-lock — ${loi.length} chỗ TỰ KHOÁ POOL:\n`);
    for (const v of loi) {
      console.error(`  ${v.file}:${v.dongViPham}  (giữ client từ dòng ${v.dongConnect})`);
      console.error(`      ${v.noiDung}`);
    }
    console.error(
      '\nSửa: dùng `client` thay cho `' + loi[0]!.ten + '` trong khối đó, hoặc truyền `client`' +
      '\nvào hàm phụ. Trên prod pool mở `max: 1` — xin kết nối thứ hai là bế tắc 10,4 giây.',
    );
    process.exit(1);
  }
}
