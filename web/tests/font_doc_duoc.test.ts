/**
 * FONT PHẢI VẼ RA ĐƯỢC — bài canh sinh từ một sự cố thật, và từ MỘT CHẨN ĐOÁN SAI.
 *
 * ── CHUYỆN ĐÃ XẢY RA (31/08) ────────────────────────────────────────────────
 * D182 đổi toàn app sang **Handjet** (font pixel) để chữa lời phàn nàn "thập
 * cẩm", và đặt `--elsh: 0` kèm chú thích "0 = ô vuông". Kết quả: chữ VÔ HÌNH
 * gần như toàn app; founder phải chụp màn hình báo.
 *
 * ⚠⚠ NGUYÊN NHÂN THẬT là ĐÚNG MỘT CON SỐ. Đo trên trình duyệt, cùng chuỗi,
 * cùng cỡ 44px, chỉ đổi trục `ELSH`:
 *     normal ✓ · **ELSH 0 ✗ TRẮNG TRƠN** · 1 ✓ · 4 ✓ · 8 ✓ · 16 ✓
 * Ở 0 thì font vẫn dựng, vẫn đo được bề rộng, computed style trông hoàn toàn
 * hợp lệ — nhưng KHÔNG VẼ RA GÌ. Hỏng im lặng tuyệt đối.
 *
 * ⚠⚠ VÀ BẢN VÁ ĐẦU TIÊN CHẨN SAI — ghi lại vì cách sai đó rất dễ lặp:
 * D192 quy tội cho "ô lưới pixel = font-size/17 nhỏ hơn một điểm ảnh" và GỠ HẲN
 * Handjet khỏi app. Lý lẽ nghe rất hợp, lại có số đo canvas đứng sau (ở 9px
 * Handjet 30 điểm mực, monospace 139). Nhưng **canvas rasterise khác bộ vẽ
 * DOM**, nên con số đó không chứng minh điều nó tưởng — nó chỉ mô tả canvas.
 * Phép thử ĐÚNG là A/B ngay trên phần tử thật: cùng chỗ, cùng chuỗi, đổi mỗi
 * font. Làm phép đó thì ra ngay: JetBrains hiện, Handjet trắng, ở MỌI cỡ —
 * tức không phải chuyện cỡ chữ, mà là chuyện font không vẽ.
 *
 * ⇒ Bài này canh CƠ CHẾ, không canh họ chữ.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const ma = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

function quetCss(thuMuc: string): string[] {
  const ra: string[] = [];
  (function di(d: string) {
    for (const e of readdirSync(join(process.cwd(), d))) {
      const p = join(d, e);
      if (statSync(join(process.cwd(), p)).isDirectory()) di(p);
      else if (e.endsWith('.css')) ra.push(p);
    }
  })(thuMuc);
  return ra;
}

describe('I. ⭐⭐ Trục ELSH không bao giờ được bằng 0', () => {
  it('`--elsh` khai trong tokens.css phải > 0', () => {
    const tok = ma(doc('src/styles/tokens.css'));
    const m = tok.match(/--elsh:\s*([0-9.]+)/);
    expect(m, 'mất khai báo --elsh').not.toBeNull();
    const v = parseFloat(m![1]!);
    expect(v, 'ELSH = 0 làm Handjet vẽ ra RỖNG — cả app mất chữ. Đo được: '
      + 'normal ✓ · 0 ✗ · 1 ✓ · 4 ✓ · 8 ✓ · 16 ✓').toBeGreaterThan(0);
  });

  it('không file CSS nào gõ cứng `ELSH 0` ở bất kỳ đâu', () => {
    const pham: string[] = [];
    for (const f of quetCss('src')) {
      const s = ma(doc(f));
      // bắt cả `'ELSH' 0` lẫn `"ELSH" 0`, có/không khoảng trắng
      if (/['"]ELSH['"]\s*0(?![.0-9])/.test(s)) pham.push(f);
    }
    expect(pham, `ELSH 0 xuất hiện ở: ${pham.join(', ')} — chỗ đó sẽ không vẽ ra gì`)
      .toEqual([]);
  });
});

describe('II. Cài đặt biến thể phải SỐNG QUA `font: inherit`', () => {
  /*
   * Thuộc tính RÚT GỌN `font` RESET `font-variation-settings` về `normal` — kể
   * cả `font: inherit`. Repo có nhiều chục chỗ viết thế (khuôn reset nút/ô nhập),
   * tức gần như MỌI nút và nhãn. Đo được: nhãn 9px trả về `normal` trong khi
   * tokens.css khai đầy đủ. Nên đặt biến thể ở `body` là ĐẶT VÀO HƯ KHÔNG.
   */
  const base = doc('src/styles/base.css');

  it('⭐⭐ `font-variation-settings` phải đặt trên `*`, không chỉ trên `body`', () => {
    /* ⚠ base.css có NHIỀU khối `*` (một cái cho `box-sizing`). Phải xét TẤT CẢ
       rồi hỏi "có cái nào đặt biến thể không" — lấy cái đầu tiên là đo nhầm
       khối, và bài sẽ đỏ vì lý do sai. */
    const s = ma(base);
    const khoi: string[] = [];
    for (const m of s.matchAll(/\*\s*,\s*\*::before\s*,\s*\*::after\s*\{/g)) {
      khoi.push(s.slice(m.index!, s.indexOf('}', m.index!)));
    }
    expect(khoi.length, 'không có khối `*` nào — biến thể sẽ chết ở mọi nút có `font: inherit`')
      .toBeGreaterThan(0);
    expect(khoi.some((k) => k.includes('font-variation-settings')),
      `${khoi.length} khối \`*\` nhưng không khối nào đặt font-variation-settings`).toBe(true);
  });

  it('bẫy `font: inherit` vẫn còn thật — giữ con số sống để luật trên còn lý do', () => {
    const n = quetCss('src')
      .reduce((s, f) => s + [...ma(doc(f)).matchAll(/font:\s*inherit/g)].length, 0);
    expect(n, 'hết `font: inherit` rồi — bẫy này không còn, xét lại luật ở khối trên')
      .toBeGreaterThan(0);
  });
});

describe('III. Vẫn phải có một font đọc-được dự phòng', () => {
  it('`--font-vector` tồn tại — cho ô nhập và khối chữ dài', () => {
    /*
     * Không bắt buộc dùng ở đâu, nhưng phải CÓ: ngày cần một `<input>` hay một
     * đoạn văn dài, dán font pixel vào đó là tự tạo lại sự cố ở quy mô nhỏ.
     */
    expect(ma(doc('src/styles/tokens.css')), 'mất --font-vector').toContain('--font-vector');
  });
});
