/**
 * D374 — LỚP PHỦ `position: fixed` PHẢI KẸP THEO CỘT APP, KHÔNG THEO VIEWPORT.
 *
 * ─── LỚP LỖI NÀY ĐÃ CẮN BỐN LẦN ─────────────────────────────────────────────
 * Cả app sống trong một cột rộng `--shell-width` (AppShell), căn giữa màn. Một phần
 * tử `position: fixed` THOÁT khỏi cột đó: nó neo vào viewport. Trên điện thoại hai
 * thứ trùng nhau nên không ai thấy gì; trên desktop 1920px thì tâm viewport KHÔNG
 * phải tâm cột, và lớp phủ trôi ra khỏi thứ nó định phủ.
 *
 *   27/07  `.phu` (ShopManHinh) — lưới thẻ tràn, đè lên mục LÕI CHIẾN THUẬT
 *   ~08/08 `.viSaoTam` — tấm kết quả trải hết 1920px
 *   21/09  `.the` + `.dock` (CoachTap) — founder: *"Khung chat của oracle che mẹ
 *          mất chỗ chọn lệnh nạp/rút"*
 *   21/09  `.thongBao` (ShopManHinh) — lời báo trôi ra ngoài shop
 *
 * Ba lần đầu đều được vá TẠI CHỖ và không ai dựng hàng rào, nên lần thứ tư tới đúng
 * như cũ. Bài này là hàng rào: nó đọc CSS và bắt mọi khối `position: fixed` trải
 * ngang phải khai một trong hai cách kẹp.
 *
 * ─── HAI CÁCH KẸP HỢP LỆ ────────────────────────────────────────────────────
 *   (a) `width: …var(--shell-width)…` + `margin-inline: auto`   — dải đúng cỡ cột;
 *   (b) `right: 0; left: 0` + `margin-inline: auto`              — dải trải rồi tự căn.
 * Cách (b) là cách D374 dùng, vì nó không đụng `transform` — thứ mà hoạt ảnh và
 * `.theBam` đang giữ.
 *
 * ⚠ CÁI BỊ CẤM là `left: <phần trăm>` trong một khối `fixed`: đó chính là phép căn
 * theo viewport. `left: 0`/`right: 0`/`inset: 0` thì không sao — chúng trải hết rồi
 * để `margin-inline` hoặc phần tử con lo phần căn.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const GOC = resolve(process.cwd(), 'src');

/** Mọi tệp `.module.css` dưới `src/` — thêm màn mới là bài này tự canh luôn. */
function cacTepCss(thuMuc: string): string[] {
  const ra: string[] = [];
  for (const m of readdirSync(thuMuc, { withFileTypes: true })) {
    const p = join(thuMuc, m.name);
    if (m.isDirectory()) ra.push(...cacTepCss(p));
    else if (m.name.endsWith('.module.css')) ra.push(p);
  }
  return ra;
}

/** Cắt một tệp CSS thành các khối `.tên { … }` (một tầng, đủ cho bài này). */
function cacKhoi(css: string): { ten: string; than: string }[] {
  const ra: { ten: string; than: string }[] = [];
  const re = /(^|\n)\s*([.#][A-Za-z0-9_\-:.\s,[\]="']*?)\{([^{}]*)\}/g;
  let m = re.exec(css);
  while (m !== null) {
    ra.push({ ten: m[2]!.trim(), than: m[3]! });
    m = re.exec(css);
  }
  return ra;
}

const TEP = cacTepCss(GOC);

describe('lớp phủ fixed phải kẹp theo cột app', () => {
  it('có đọc được CSS thật — bài rỗng thì mọi khẳng định dưới đều vô nghĩa', () => {
    expect(TEP.length, 'không tìm thấy tệp .module.css nào').toBeGreaterThan(20);
    const tong = TEP.reduce((n, t) => n + cacKhoi(readFileSync(t, 'utf8')).length, 0);
    expect(tong, 'cắt khối CSS ra rỗng — regex hỏng').toBeGreaterThan(200);
  });

  it('⭐ không khối `position: fixed` nào còn căn giữa bằng `left: <%>`', () => {
    const pham: string[] = [];
    for (const tep of TEP) {
      for (const k of cacKhoi(readFileSync(tep, 'utf8'))) {
        if (!/position:\s*fixed/.test(k.than)) continue;
        if (!/left:\s*\d+(\.\d+)?%/.test(k.than)) continue;
        pham.push(`${tep.slice(GOC.length + 1)} → ${k.ten}`);
      }
    }
    expect(pham, [
      'Khối `position: fixed` căn giữa bằng `left: <%>` neo vào VIEWPORT, không vào cột app',
      '(`--shell-width`). Trên desktop nó trôi ra khỏi thứ nó định phủ — lỗi đã cắn 4 lần.',
      'Thay bằng: `right: 0; left: 0; margin-inline: auto` (+ `width` nếu cần).',
    ].join(' ')).toEqual([]);
  });

  it('⭐ khối fixed trải ngang (`right:0; left:0`) phải có `margin-inline: auto` hoặc cỡ cột', () => {
    const pham: string[] = [];
    for (const tep of TEP) {
      for (const k of cacKhoi(readFileSync(tep, 'utf8'))) {
        if (!/position:\s*fixed/.test(k.than)) continue;
        const traiNgang = /left:\s*0/.test(k.than) && /right:\s*0/.test(k.than);
        const insetNgang = /inset:\s*0/.test(k.than);
        if (!traiNgang && !insetNgang) continue;
        // Trải hết màn CÓ CHỦ Ý (nền mờ, lỗ khoét) thì không có gì để căn — nhận diện
        // bằng việc nó không khai `width`: một tấm nền thì rộng bằng màn là đúng.
        if (!/\bwidth:/.test(k.than) && !/margin-inline/.test(k.than)) continue;
        const kepDuoc = /margin-inline:\s*auto/.test(k.than)
          || /--shell-width/.test(k.than);
        if (!kepDuoc) pham.push(`${tep.slice(GOC.length + 1)} → ${k.ten}`);
      }
    }
    expect(pham, [
      'Khối `fixed` trải ngang mà có `width` thì phải tự căn về cột app:',
      'thêm `margin-inline: auto`, hoặc lấy `width: min(100%, var(--shell-width))`.',
    ].join(' ')).toEqual([]);
  });
});
