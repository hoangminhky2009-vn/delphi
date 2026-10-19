/**
 * D444 (28/09) — QUÉT NGUỒN `server/admin_ui.ts`: mọi field lấy từ server rồi
 * ghép (+) thẳng vào chuỗi HTML PHẢI qua `esc()` (hoặc `_tt()` riêng cho
 * `status` — hàm dịch mã trạng thái sang nhãn màu, an toàn vì giá trị LUÔN
 * nằm trong một enum cố định do CHÍNH `_tt()` liệt kê, không phải text tự do
 * người dùng gõ).
 *
 * ⚠ MIỄN HAI LOẠI, cả hai đều có lý do — không phải lách luật:
 *
 *   1. Bên trong `confirm()` / `prompt()` / `alert()` — hộp thoại trình duyệt
 *      hiện CHỮ THUẦN, không dựng DOM/HTML, nên không có đường tiêm HTML nào ở
 *      đó. Đề bài chỉ nêu `confirm(` làm ví dụ; `prompt()`/`alert()` cùng bản
 *      chất nên miễn chung — `goNhap`/`huyKeo` ghép `m.question_text` vào
 *      `confirm()`/`prompt()`, `doOpen`/`confirmWin` ghép `r.body.message` vào
 *      `alert()`, cả bốn chỗ đó CỐ Ý không đổi ở bản vá này (không phải sót).
 *      Dò bằng NGĂN XẾP TÊN HÀM bao quanh mỗi vị trí trong nguồn — không chỉ
 *      nhìn 4 ký tự liền trước như phép so esc()/_tt(), vì `r.body.message` có
 *      thể nằm sâu trong `(r.body.message||r.status)` bên trong `alert(...)`.
 *   2. `r.status` (KHÔNG phải `r.body.status`) — đây là MÃ HTTP của chính lệnh
 *      gọi `api()` (`return {status:r.status,body:b}`), LUÔN LUÔN là số, không
 *      thể mang HTML. Chỉ `status` của ĐỐI TƯỢNG NGHIỆP VỤ (`m.status`,
 *      `r.body.status`) mới cần soi — phân biệt bằng BASE ngay trước dấu chấm.
 *
 * ⚠ CHỈ SOI OCCURRENCE ĐANG THẬT SỰ GHÉP CHUỖI (đứng ngay sau dấu "+", bỏ qua
 * khoảng trắng) — `field` trùng tên nhưng đứng trong một PHÉP SO SÁNH
 * (`if(m.status==='draft')`) hay khoá object literal (`{status:r.status}`)
 * thì không phải đường tiêm HTML, dù cùng field. Thiếu bước này, bài sẽ báo
 * động giả trên MỌI nhánh rẽ theo `m.status` (đã bắt được khi viết bài — bốn
 * chỗ `if(m.status===…)`/`else if(…)` ở `loadTodo`/`loadMarkets` bị tính nhầm
 * là vi phạm cho tới khi thêm bộ lọc này).
 *
 * ⚠ KHÔNG dựng RegExp từ chuỗi trích ra ở nguồn — tệp chứa rất nhiều dấu gạch
 * chéo ngược (`\n`, `\'`) sẽ làm hỏng một RegExp dựng động từ đó. Quét bằng
 * indexOf/slice thuần (regex literal cố định trong CHÍNH bài test này, như
 * `/[A-Za-z0-9_$]/`, không đụng tới nội dung trích ra nên an toàn).
 *
 * Bài phải ĐỎ khi bỏ `esc(`/`_tt(` ở BẤT KỲ một chỗ nào (tiêm lỗi ngược M6).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const goc = process.cwd();
const SRC = readFileSync(resolve(goc, 'server/admin_ui.ts'), 'utf8');

/** Field domain cần soi — đúng danh sách đề bài liệt kê. */
const FIELDS = ['question_text', 'label', 'resolution_source_name', 'handle', 'message', 'status'] as const;

const laKyTuDinhDanh = (ch: string | undefined): boolean =>
  ch !== undefined && /[A-Za-z0-9_$.]/.test(ch);
const laKyTuTen = (ch: string | undefined): boolean =>
  ch !== undefined && /[A-Za-z0-9_$]/.test(ch);

/** Mọi vị trí dấu "." ngay trước `.field`, field phải là RANH TỪ thật (không phải tiền tố của tên dài hơn). */
function timMoiViTriDotField(field: string): number[] {
  const needle = `.${field}`;
  const ket: number[] = [];
  let tu = 0;
  for (;;) {
    const i = SRC.indexOf(needle, tu);
    if (i === -1) break;
    if (!laKyTuTen(SRC[i + needle.length])) ket.push(i);
    tu = i + needle.length;
  }
  return ket;
}

/** Lùi từ vị trí dấu "." về đầu chuỗi định danh — vd "r.body" đứng trước ".status". */
function baseTruocDot(dotIdx: number): { start: number; base: string } {
  let j = dotIdx;
  while (j > 0 && laKyTuDinhDanh(SRC[j - 1])) j -= 1;
  return { start: j, base: SRC.slice(j, dotIdx) };
}

/**
 * Ngăn xếp TÊN HÀM bao quanh mỗi vị trí trong nguồn (snapshot tại từng chỉ số
 * ký tự) — cho biết một vị trí có đang nằm trong `confirm(`/`prompt(`/`alert(`
 * hay không, DÙ lồng bao nhiêu ngoặc/toán tử ở giữa. Khác phép so "4 ký tự
 * liền trước" (vốn chỉ bắt được esc()/_tt() bọc TRỰC TIẾP không qua trung gian).
 */
function dungNganXepTenHam(): string[][] {
  const ngan: string[] = [];
  const snap: string[][] = new Array(SRC.length);
  for (let i = 0; i < SRC.length; i += 1) {
    snap[i] = [...ngan];
    const ch = SRC[i];
    if (ch === '(') {
      let k = i;
      while (k > 0 && laKyTuTen(SRC[k - 1])) k -= 1;
      ngan.push(SRC.slice(k, i));
    } else if (ch === ')') {
      ngan.pop();
    }
  }
  return snap;
}

const NGAN_XEP = dungNganXepTenHam();
const HOP_THOAI = new Set(['confirm', 'prompt', 'alert']);
const trongHopThoai = (idx: number): boolean => (NGAN_XEP[idx] ?? []).some((ten) => HOP_THOAI.has(ten));

interface ViPham { dong: number; doanTrich: string; }

/** Danh sách chỗ KHÔNG đạt luật (rỗng = sạch). */
function quetField(field: string): ViPham[] {
  const viPham: ViPham[] = [];
  for (const dotIdx of timMoiViTriDotField(field)) {
    const { start, base } = baseTruocDot(dotIdx);
    // (2) MÃ HTTP của api() luôn là số — không phải field domain, loại khỏi phép soi.
    if (field === 'status' && base === 'r') continue;
    // (1) Hộp thoại chữ thuần — không có đường tiêm HTML.
    if (trongHopThoai(start)) continue;
    const truoc4 = SRC.slice(Math.max(0, start - 4), start);
    const daBocEsc = truoc4 === 'esc(';
    const daBocTt = field === 'status' && truoc4 === '_tt(';
    // (3) CHỈ soi occurrence THẬT SỰ đang bị GHÉP CHUỖI (đứng ngay sau "+",
    // bỏ qua khoảng trắng) — loại các occurrence là SO SÁNH (`m.status===`),
    // NHÁNH RẼ (`if(m.status===…)`), hay khoá object literal. Không có "+"
    // đứng trước thì đây không phải chỗ tiêm HTML, dù field trùng tên.
    const wrapStart = (daBocEsc || daBocTt) ? start - 4 : start;
    let truocWrap = wrapStart - 1;
    while (truocWrap >= 0 && /\s/.test(SRC[truocWrap]!)) truocWrap -= 1;
    const laGhepChuoi = truocWrap >= 0 && SRC[truocWrap] === '+';
    if (!laGhepChuoi) continue;
    if (!daBocEsc && !daBocTt) {
      const dong = SRC.slice(0, dotIdx).split('\n').length;
      const doanTrich = SRC.slice(Math.max(0, start - 24), dotIdx + field.length + 1);
      viPham.push({ dong, doanTrich });
    }
  }
  return viPham;
}

describe('admin_ui.ts — thoát chữ trước khi ghép vào innerHTML (D444)', () => {
  it('tiền đề: tìm được ít nhất một occurrence của mỗi field (bài không rỗng)', () => {
    for (const f of FIELDS) {
      expect(timMoiViTriDotField(f).length, `.${f} không còn xuất hiện — kiểm lại danh sách FIELDS`).toBeGreaterThan(0);
    }
  });

  for (const field of FIELDS) {
    it(`mọi ".${field}" ghép vào chuỗi HTML đều qua esc()${field === 'status' ? ' (hoặc _tt())' : ''}`, () => {
      const viPham = quetField(field);
      const bao = viPham.map((v) => `  dòng ${v.dong}: …${v.doanTrich}…`).join('\n');
      expect(viPham, `thiếu esc()/_tt() ở:\n${bao}`).toEqual([]);
    });
  }
});
