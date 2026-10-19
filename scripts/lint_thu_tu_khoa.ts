/**
 * LINT — THỨ TỰ LẤY KHOÁ (M3).
 *
 * ─── VÌ SAO PHẢI LÀ MÁY, KHÔNG PHẢI MỘT DÒNG DẶN DÒ ─────────────────────────
 * Bế tắc do khoá ngược chiều là lớp lỗi **không hiện ở n = 1 và hiện đúng lúc tệ
 * nhất**: một mình bấm thì không bao giờ thấy, hai người bấm cùng lúc vào đúng
 * hai đường ngược nhau thì cả hai treo tới khi Vercel cắt. Không có gì trong
 * đoạn code nhìn ra được — nó là quan hệ giữa hai tệp ở hai chỗ khác nhau.
 *
 * `kien-truc-ky-thuat.md` §4 chốt thứ tự, và tự nói nó phải là một hàng rào máy
 * "cùng khuôn `lint:pool-lock`". Đây là hàng rào đó.
 *
 * ─── LUẬT ───────────────────────────────────────────────────────────────────
 *   1. users            4. vat_pham_ban_the
 *   2. cosmetic_items   5. TREASURY_LOCK (advisory)
 *   3. dot_phat_hanh    6. QUY_CHO_LOCK (advisory)
 * Không cần lấy đủ; chỉ **không được lấy sai thứ tự**.
 *
 * ─── HAI PHÉP KIỂM, VÀ CHÚNG BẮT HAI THỨ KHÁC NHAU ──────────────────────────
 *
 * (A) **Thứ tự trong một tệp.** Các chỗ lấy khoá, đọc theo thứ tự văn bản, bậc
 *     không được đi lùi.
 *
 * (B) ⭐ **`FOR UPDATE` MƠ HỒ.** Một `FOR UPDATE` trần trong câu có JOIN khoá
 *     dòng của **mọi** bảng trong FROM — tức lấy hai bậc trong MỘT câu, thứ tự
 *     do bộ lập kế hoạch quyết chứ không do ta. Phép (A) không nhìn thấy được
 *     chuyện đó vì nó chỉ có một vị trí văn bản. Sửa bằng `FOR UPDATE OF <bí
 *     danh>`. Ca thật: `tieuBanThe` ở `server/kinh_te/so_vat.ts` (D269).
 *
 * ⚠⚠ ĐIỂM MÙ, GHI RA ĐỂ KHÔNG AI TƯỞNG NÓ CANH ĐỦ: lint này đọc theo TỆP. Một
 * route gọi hàm phụ A rồi hàm phụ B, mà A khoá bậc 4 còn B khoá bậc 2, thì hai
 * chỗ đó nằm ở hai tệp khác và lint KHÔNG thấy. Chống đường đó phải là test đua
 * hai transaction thật — cùng lý lẽ hai lớp của `lint:pool-lock`.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THU_MUC = ['server', 'api'];

/** Bậc khoá — MỘT nguồn cho cả lint lẫn tài liệu §4. */
export const BAC_KHOA: ReadonlyArray<{ ten: string; bac: number }> = [
  { ten: 'users', bac: 1 },
  { ten: 'cosmetic_items', bac: 2 },
  { ten: 'dot_phat_hanh', bac: 3 },
  { ten: 'vat_pham_ban_the', bac: 4 },
];

/**
 * Bậc 5–6 là khoá ADVISORY, nhận ra theo TÊN hằng số trong lời gọi
 * `pg_advisory_xact_lock(…)` — hoặc ngay trong ngoặc, hoặc ở mảng tham số cùng
 * câu lệnh. Khoá advisory khác (`QUA_BETA_LOCK_KEY`) không thuộc chuỗi M3 nên
 * không xếp bậc — lint bỏ qua, không đoán.
 */
export const BAC_KHOA_ADVISORY: ReadonlyArray<{ ten: string; bac: number }> = [
  { ten: 'TREASURY_LOCK_KEY', bac: 5 },
  { ten: 'QUY_CHO_LOCK_KEY', bac: 6 },
];

const TEN_BAC = [...BAC_KHOA, ...BAC_KHOA_ADVISORY];

/** Cửa sổ nhìn ngược từ `FOR UPDATE` để tìm tên bảng của chính câu đó. */
const CUA_SO = 700;

export interface ViPhamKhoa {
  file: string;
  dong: number;
  loai: 'thu_tu' | 'mo_ho';
  chiTiet: string;
}

/** Bỏ chú thích nhưng GIỮ chuỗi (ta cần đọc SQL) và giữ nguyên số dòng. */
function boChuThich(src: string): string {
  let ra = '';
  let i = 0;
  let trongKhoi = false;
  while (i < src.length) {
    if (trongKhoi) {
      if (src.startsWith('*/', i)) { trongKhoi = false; ra += '  '; i += 2; }
      else { ra += src[i] === '\n' ? '\n' : ' '; i += 1; }
      continue;
    }
    if (src.startsWith('/*', i)) { trongKhoi = true; ra += '  '; i += 2; continue; }
    if (src.startsWith('//', i)) {
      while (i < src.length && src[i] !== '\n') { ra += ' '; i += 1; }
      continue;
    }
    ra += src[i];
    i += 1;
  }
  return ra;
}

/**
 * Cửa sổ nhìn ngược, **CẮT Ở RANH CÂU LỆNH**.
 *
 * ⚠ Bản đầu chỉ lấy 700 ký tự phía trước, nên nó vắt sang câu lệnh TRƯỚC ĐÓ và
 * báo mơ hồ cho một câu chỉ chạm đúng một bảng. Bài canh bắt được ngay — và đó
 * là lý do bài canh phải cho lint ăn mã hỏng trước khi tin chữ "sạch" của nó.
 *
 * Neo: `query(` gần nhất (chỗ chuỗi SQL bắt đầu) hoặc `;` gần nhất, lấy cái
 * muộn hơn.
 */
function cuaSoCauLenh(s: string, viTri: number): string {
  const dau = Math.max(0, viTri - CUA_SO);
  const tho = s.slice(dau, viTri);
  const neo = Math.max(tho.lastIndexOf('query('), tho.lastIndexOf(';'));
  return neo === -1 ? tho : tho.slice(neo);
}

/** Bảng nào bị khoá ở một chỗ `FOR UPDATE`, và có mơ hồ không. */
function docChoKhoa(cuaSo: string, sauFU: string): { bac: number[]; moHo: boolean } {
  const coMat = BAC_KHOA.filter((b) => new RegExp(`\\b${b.ten}\\b`).test(cuaSo));
  const mOf = /^\s*OF\s+([A-Za-z_][\w]*)/i.exec(sauFU);
  if (mOf) {
    const biDanh = mOf[1]!;
    // Bí danh → bảng: `<bảng> <bí danh>` hoặc `<bảng> AS <bí danh>`.
    for (const b of BAC_KHOA) {
      if (new RegExp(`\\b${b.ten}\\s+(?:AS\\s+)?${biDanh}\\b`, 'i').test(cuaSo)) {
        return { bac: [b.bac], moHo: false };
      }
    }
    // Có `OF` nhưng không suy được bảng ⇒ coi như đã chỉ đích danh, không kêu.
    return { bac: coMat.map((b) => b.bac), moHo: false };
  }
  return { bac: coMat.map((b) => b.bac), moHo: coMat.length > 1 };
}

/**
 * Đếm số chỗ `FOR UPDATE` mà lint XẾP ĐƯỢC BẬC.
 *
 * ⚠ Tồn tại chỉ để chứng minh lint **không rỗng**: một bài quét không tìm thấy
 * chỗ nào cũng báo "sạch", và "sạch" kiểu đó tệ hơn không có lint. Repo đã bị
 * đúng chuyện này hai lần trong ngày 05/09 (D262, D269).
 */
export function demChoXepBac(src: string): number {
  const s = boChuThich(src);
  let n = 0;
  const re = /FOR\s+UPDATE/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const cuaSo = cuaSoCauLenh(s, m.index);
    if (BAC_KHOA.some((b) => new RegExp(`\\b${b.ten}\\b`).test(cuaSo))) n += 1;
  }
  n += moiChoAdvisory(s).length;
  return n;
}

/** Một chỗ lấy khoá đã xếp bậc, theo vị trí văn bản. */
interface ChoKhoa { viTri: number; bac: number[]; moHo: boolean }

/**
 * Chỗ khoá advisory: `pg_advisory_xact_lock(X)` với X là tên hằng, HOẶC `($1)`
 * rồi tên hằng nằm trong mảng tham số của cùng câu `query(...)`. Cửa sổ nhìn
 * xuôi tới dấu `;` gần nhất — đủ cho cả hai cách viết repo đang dùng.
 */
function moiChoAdvisory(s: string): ChoKhoa[] {
  const ra: ChoKhoa[] = [];
  const re = /pg_advisory_xact_lock\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const het = s.indexOf(';', m.index);
    const doan = s.slice(m.index, het === -1 ? m.index + 300 : het);
    for (const b of BAC_KHOA_ADVISORY) {
      if (new RegExp(`\\b${b.ten}\\b`).test(doan)) ra.push({ viTri: m.index, bac: [b.bac], moHo: false });
    }
  }
  return ra;
}

/** MỌI chỗ khoá (row + advisory), sắp theo vị trí văn bản. */
function moiChoKhoa(s: string): ChoKhoa[] {
  const ra: ChoKhoa[] = [...moiChoAdvisory(s)];
  const re = /FOR\s+UPDATE/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const cuaSo = cuaSoCauLenh(s, m.index);
    const { bac, moHo } = docChoKhoa(cuaSo, s.slice(m.index + m[0].length, m.index + m[0].length + 40));
    if (bac.length > 0) ra.push({ viTri: m.index, bac, moHo });
  }
  return ra.sort((a, b) => a.viTri - b.viTri);
}

/**
 * Vị trí mọi chỗ MỞ TRANSACTION — `client.query('BEGIN')`.
 *
 * ⭐ Đây là ranh mà phép (A) phải đặt lại mốc, và nó KHÔNG phải một cách nới
 * luật cho dễ thở. Cả hai loại khoá trong chuỗi M3 — khoá dòng (`FOR UPDATE`)
 * và khoá advisory (`pg_advisory_xact_lock`) — đều **nhả khi transaction kết
 * thúc**. Nên "đã lấy bậc 2" của giao dịch trước không nói gì về giao dịch sau;
 * so hai bên với nhau là so hai thứ không cùng tồn tại lúc nào cả.
 *
 * Bản đầu không có ranh này, và nó **báo sai ngay lần thứ hai một tệp có hai
 * cửa**: `server/cho.ts` thêm cửa MUA (B7b) bên dưới cửa BÁN thì lint kêu "lấy
 * bậc 1 sau khi đã lấy bậc 2" — trong khi mỗi cửa tự nó tăng dần đúng luật. Một
 * hàng rào kêu sai là hàng rào sắp bị tắt (D79/D125), nên đây là sửa BẮT BUỘC,
 * không phải nhượng bộ.
 *
 * ⚠ KHÔNG làm lint yếu đi: thứ tự lùi BÊN TRONG một transaction vẫn bị bắt
 * nguyên vẹn, và hàm phụ không có `BEGIN` (được gọi trong transaction của
 * caller) vẫn cộng dồn như cũ. `tests/lint_thu_tu_khoa.test.ts` canh cả hai.
 */
function moiChoBegin(s: string): number[] {
  const ra: number[] = [];
  const re = /query\s*\(\s*['"]BEGIN['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) ra.push(m.index);
  return ra;
}

export function quetNguon(src: string, file: string): ViPhamKhoa[] {
  const s = boChuThich(src);
  const loi: ViPhamKhoa[] = [];
  const begin = moiChoBegin(s);
  let caoNhat = 0;
  let tenCaoNhat = '';
  let truoc = -1;

  for (const cho of moiChoKhoa(s)) {
    const { bac, moHo } = cho;
    const dong = s.slice(0, cho.viTri).split('\n').length;

    // Có một `BEGIN` xen giữa chỗ khoá trước và chỗ này ⇒ transaction mới ⇒ mốc
    // cũ đã nhả. Đặt lại.
    if (begin.some((b) => b > truoc && b < cho.viTri)) {
      caoNhat = 0;
      tenCaoNhat = '';
    }
    truoc = cho.viTri;

    if (moHo) {
      loi.push({
        file, dong, loai: 'mo_ho',
        chiTiet: `FOR UPDATE trần trong câu chạm ${bac.length} bảng có bậc `
          + `(${TEN_BAC.filter((b) => bac.includes(b.bac)).map((b) => b.ten).join(', ')})`
          + ' — dùng FOR UPDATE OF <bí danh>',
      });
    }

    const thapNhat = Math.min(...bac);
    if (thapNhat < caoNhat) {
      loi.push({
        file, dong, loai: 'thu_tu',
        chiTiet: `lấy bậc ${thapNhat} sau khi đã lấy bậc ${caoNhat} (${tenCaoNhat})`,
      });
    }
    const caoCuaCho = Math.max(...bac);
    if (caoCuaCho > caoNhat) {
      caoNhat = caoCuaCho;
      tenCaoNhat = TEN_BAC.find((b) => b.bac === caoCuaCho)!.ten;
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

export async function quetRepo(): Promise<ViPhamKhoa[]> {
  const ra: ViPhamKhoa[] = [];
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
    console.log('lint:thu-tu-khoa — sạch (không chỗ nào lấy khoá ngược bậc, không FOR UPDATE mơ hồ).');
  } else {
    console.error(`lint:thu-tu-khoa — ${loi.length} chỗ:\n`);
    for (const v of loi) console.error(`  ${v.file}:${v.dong}  [${v.loai}]  ${v.chiTiet}`);
    console.error('\nThứ tự: users → cosmetic_items → dot_phat_hanh → vat_pham_ban_the'
      + ' → TREASURY_LOCK → QUY_CHO_LOCK (kien-truc-ky-thuat.md §4).');
    process.exit(1);
  }
}
