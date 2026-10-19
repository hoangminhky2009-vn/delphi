import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import ts from 'typescript';

/*
 * CHÚ THÍCH KHÔNG ĐƯỢC RÒ RA MÀN HÌNH.
 *
 * ⚠⚠ ĐÃ XẢY RA THẬT, VÀ SỐNG MỘT NGÀY TRÊN PROD. Lúc gỡ dải lượt cược (D81) tôi
 * để lại một khối chú thích TRẦN giữa JSX, không bọc trong ngoặc nhọn. Trong JSX
 * thì đó KHÔNG phải chú thích — đó là VĂN BẢN. Nguyên đoạn ghi chú kỹ thuật
 * tiếng Việt ("DẢI LƯỢT CƯỢC ĐÃ GỠ 11/08 — xem D81…") hiện chình ình giữa màn
 * đấu, ngay trên nút CHỐT VÒNG, cho tới khi founder chụp màn gửi.
 *
 * ⚠ VÌ SAO KHÔNG GÌ BẮT ĐƯỢC: nó hợp lệ hoàn toàn. `tsc` xanh (JSX được phép
 * chứa chữ), lint xanh, test xanh. Đây là lớp lỗi chỉ MẮT NGƯỜI thấy.
 *
 * ⚠⚠ VÀ BẢN ĐẦU CỦA CHÍNH BÀI NÀY HỎNG THEO CẢ HAI CHIỀU: tôi tự viết bộ dò
 * bằng regex, nó vừa báo động giả trên JSDoc bình thường, vừa KHÔNG bắt được ca
 * tổng hợp mà tôi dựng ra để thử nó. Một bài test vừa kêu oan vừa bỏ lọt thì tệ
 * hơn không có — nó sẽ bị tắt đi.
 * ⇒ Bỏ heuristic. Hỏi thẳng TRÌNH BIÊN DỊCH: TypeScript biết chính xác đoạn nào
 * là `JsxText` (văn bản sẽ hiện ra). Chữ nào mang dấu chú thích mà nằm trong
 * `JsxText` thì chắc chắn là chú thích bị hở, không phải phỏng đoán.
 */

const GOC = (() => {
  const a = resolve(process.cwd(), 'src');
  try { return statSync(a).isDirectory() ? a : resolve(process.cwd(), 'web/src'); } catch {
    return resolve(process.cwd(), 'web/src');
  }
})();

function moiTsx(thuMuc: string): string[] {
  const ra: string[] = [];
  for (const t of readdirSync(thuMuc)) {
    const d = join(thuMuc, t);
    if (statSync(d).isDirectory()) ra.push(...moiTsx(d));
    else if (t.endsWith('.tsx')) ra.push(d);
  }
  return ra;
}

/**
 * Chữ SẼ HIỆN RA mà mang dấu chú thích. Trả `[dòng, trích]`.
 *
 * Chỉ bắt `/*` và `*​/` — hai dấu KHÔNG bao giờ là nội dung người chơi cần đọc.
 * KHÔNG bắt dấu `*` lẻ: nó là dấu nhân, dấu sao, gạch đầu dòng — bắt nó là kêu oan.
 */
export function chuThichHo(src: string, ten = 'x.tsx'): [number, string][] {
  const sf = ts.createSourceFile(ten, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ra: [number, string][] = [];
  const di = (n: ts.Node): void => {
    if (n.kind === ts.SyntaxKind.JsxText) {
      const chu = n.getText(sf);
      if (chu.includes('/*') || chu.includes('*/')) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        ra.push([line + 1, chu.trim().replace(/\s+/g, ' ').slice(0, 70)]);
      }
    }
    n.forEachChild(di);
  };
  di(sf);
  return ra;
}

describe('chú thích không rò ra màn hình', () => {
  it('⭐ không file .tsx nào có chú thích trần trong thân JSX', () => {
    const xau: string[] = [];
    for (const f of moiTsx(GOC)) {
      for (const [n, noi] of chuThichHo(readFileSync(f, 'utf8'), f)) {
        xau.push(`${f.replace(GOC, 'src')}:${n} → ${noi}`);
      }
    }
    expect(
      xau,
      'chú thích đặt trần giữa JSX sẽ HIỆN RA cho người chơi đọc — bọc nó trong ngoặc nhọn',
    ).toEqual([]);
  });

  it('bộ dò CÒN SỐNG — dựng lại đúng hình dạng lỗi D81 thì phải bắt được', () => {
    const mau = 'export const X = () => (\n  <div>\n    /*\n     * chú thích bị hở\n     */\n    <span>chữ</span>\n  </div>\n);\n';
    expect(chuThichHo(mau).length, 'bộ dò không bắt được lỗi nó sinh ra để bắt')
      .toBeGreaterThan(0);
  });

  it('KHÔNG kêu oan với chú thích JSX viết đúng', () => {
    const mau = 'export const X = () => (\n  <div>\n    {/* chú thích ĐÚNG chuẩn */}\n    <span>chữ</span>\n  </div>\n);\n';
    expect(chuThichHo(mau)).toEqual([]);
  });

  it('KHÔNG kêu oan với JSDoc ngoài JSX, và không bắt dấu sao lẻ', () => {
    const mau = '/**\n * JSDoc bình thường\n */\nexport const X = () => (\n  <div>\n    <span>3 * 4 = 12 · mục *quan trọng*</span>\n  </div>\n);\n';
    expect(chuThichHo(mau)).toEqual([]);
  });
});
