/**
 * LỚP PHỦ TOÀN MÀN KHÔNG ĐƯỢC NUỐT CHỮ — founder 24/08 chụp màn kỳ ngộ trên máy
 * thật (prod): *"Lỗi hiển thị"*. Mọi đoạn chữ chạy quá mép phải và bị cắt cụt
 * giữa chữ — *"phần còn lạ…"*, *"đủ t…"*, *"hiện cho ngư…"*.
 *
 * ─── GỐC: VA CHẠM TÊN LỚP TỪ MỘT TỪ ĐỒNG ÂM ─────────────────────────────────
 * `KyNgo.module.css` khai `.phu` HAI LẦN cho HAI THỨ KHÁC HẲN NHAU:
 *   · PHỤ ĐỀ một dòng của chip  → cần `white-space: nowrap` + ellipsis;
 *   · LỚP PHỦ toàn màn          → `position: fixed; inset: 0`.
 * Không dấu thì *phụ* và *phủ* là cùng một chuỗi, mà CSS Modules băm theo TÊN ⇒
 * hai rule dán lên CÙNG một lớp. `white-space: nowrap` không có ai tranh trong
 * rule thứ hai nên nó sống sót, rồi **KẾ THỪA xuống mọi đoạn chữ bên trong**.
 * Cộng `overflow: hidden` (cũng từ rule phụ đề) ⇒ chữ bị CẮT chứ không cuộn được.
 *
 * ⚠ CSS hoàn toàn hợp lệ · `tsc` xanh · `lint:css-anim` xanh · không một cảnh báo.
 * Cùng họ với D122 (`animation` bị lớp khác chiếm trọn) và D123 (`.tayHoiLa` trùng
 * tên bị đè sạch), nhưng nguy hiểm hơn cả hai vì `white-space` ĐI XUYÊN kế thừa —
 * nó hỏng những phần tử KHÔNG hề mang cái lớp gây lỗi.
 *
 * ─── VÌ SAO LUẬT VIẾT HẸP ───────────────────────────────────────────────────
 * Quét cả web/src ra 13 lớp bị khai trùng ở 10 file, mà PHẦN LỚN HỢP LỆ: khai lại
 * để ghi đè theo mục là nếp CSS bình thường (`.nay` của MarketMap, `.ketQua` của
 * Shop…). Một bài cấm mọi khai trùng sẽ đỏ ngay từ lúc viết, và một bài đỏ sẵn thì
 * người sau tắt nó đi (D79). ⇒ Chỉ cấm đúng TỔ HỢP không bao giờ đúng: một hộp
 * TRẢI TOÀN MÀN mà lại cấm chữ xuống hàng.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';

const GOC = resolve(process.cwd(), 'src');

function moiModule(d: string, ra: string[] = []): string[] {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) moiModule(p, ra);
    else if (e.name.endsWith('.module.css')) ra.push(p);
  }
  return ra;
}

const khongChuThich = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Gộp MỌI rule của cùng một tên lớp trong một file — đúng cách trình duyệt thấy
 * nó sau khi CSS Modules băm tên. Chỉ lấy selector là một lớp đơn ở đầu dòng;
 * `.a .b`, `.a.b`, `.a::after` là phần tử/trạng thái khác, không gộp vào.
 */
function gopTheoLop(css: string): Map<string, string> {
  const gop = new Map<string, string>();
  for (const m of khongChuThich(css).matchAll(/^\.([A-Za-z_][\w-]*)\s*\{([^}]*)\}/gm)) {
    const ten = m[1]!;
    gop.set(ten, (gop.get(ten) ?? '') + ';' + m[2]!);
  }
  return gop;
}

const laHopTraiToanMan = (than: string) =>
  /position:\s*(fixed|absolute)/.test(than) && /\binset:\s*0/.test(than);

describe('I. Hộp trải toàn màn không được cấm chữ xuống hàng', () => {
  it('⭐⭐ không file nào có lớp vừa `inset: 0` vừa `white-space: nowrap`', () => {
    const pham: string[] = [];
    for (const f of moiModule(GOC)) {
      for (const [ten, than] of gopTheoLop(readFileSync(f, 'utf8'))) {
        if (laHopTraiToanMan(than) && /white-space:\s*nowrap/.test(than)) {
          pham.push(`${f.split(sep).join('/').replace(/^.*?src\//, 'src/')} .${ten}`);
        }
      }
    }
    expect(
      pham,
      'lớp phủ trải toàn màn mà cấm xuống hàng ⇒ mọi đoạn chữ bên trong chạy quá '
      + 'mép và bị cắt cụt (founder chụp được trên prod 24/08):\n  ' + pham.join('\n  '),
    ).toEqual([]);
  });

  it('⚠ bắt được cả khi hai vế nằm ở HAI rule rời nhau của cùng một lớp', () => {
    /*
     * Đây chính là hình dạng của bug thật: không rule nào một mình sai cả, chỉ
     * cái HỢP của chúng mới sai. Một bộ đọc xét từng rule riêng lẻ sẽ xanh trơn.
     * Bài này chứng minh bộ đọc ở trên GỘP theo tên lớp trước khi xét.
     */
    const gia = [
      '.phu { font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
      '.dan { display: grid; }',
      '.phu { position: fixed; inset: 0; z-index: 66; overflow-y: auto; }',
    ].join('\n');
    const gop = gopTheoLop(gia);
    const than = gop.get('phu') ?? '';
    expect(than, 'bộ đọc không gộp hai rule cùng tên ⇒ nó sẽ bỏ lọt bug thật')
      .toMatch(/white-space:\s*nowrap/);
    expect(laHopTraiToanMan(than)).toBe(true);
  });
});

describe('II. Kỳ ngộ — phụ đề và lớp phủ phải là HAI lớp khác nhau', () => {
  const CSS = readFileSync(resolve(GOC, 'components/holdem/KyNgo.module.css'), 'utf8');
  const TSX = readFileSync(resolve(GOC, 'components/holdem/KyNgo.tsx'), 'utf8');

  it('⭐ `.phu` chỉ còn MỘT nghĩa: lớp phủ toàn màn', () => {
    const than = gopTheoLop(CSS).get('phu') ?? '';
    expect(than, 'không tìm thấy `.phu`').not.toBe('');
    expect(than, '`.phu` lại mang `white-space: nowrap` ⇒ cả màn kỳ ngộ thôi xuống hàng')
      .not.toMatch(/white-space:\s*nowrap/);
    expect(than, '`.phu` phải là lớp phủ trải toàn màn').toMatch(/inset:\s*0/);
  });

  it('phụ đề của chip vẫn còn, và vẫn cắt cụt được', () => {
    // Gỡ nowrap khỏi lớp phủ mà làm rơi luôn phụ đề thì không phải sửa, là mất.
    const than = gopTheoLop(CSS).get('dauPhu') ?? '';
    expect(than, 'mất hẳn lớp phụ đề').not.toBe('');
    expect(than, 'phụ đề một dòng vẫn cần ellipsis').toMatch(/text-overflow:\s*ellipsis/);
    expect(TSX, 'phụ đề không còn được gắn ở JSX').toMatch(/s\.dauPhu/);
    expect(TSX, '`s.phu` bị gắn cho phụ đề lần nữa ⇒ va chạm tái sinh')
      .not.toMatch(/<span className=\{s\.phu\}/);
  });
});
