/**
 * BÀN ĐẤU TRÊN MÀN HÌNH LỚN (founder 04/08).
 *
 * ⚠ Ba bài này khoá ba thứ KHÁC NHAU, đừng gộp:
 *  1. cờ có tới đúng route bàn đấu (và KHÔNG rò sang màn khác);
 *  2. bàn đấu nở ra nhưng CÓ TRẦN — khác hẳn bảng quản trị nở hết cỡ;
 *  3. tầm đọc KHÔNG nở theo khung — đây là cả lý do phải tách `--shell-width`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RouteObject } from 'react-router-dom';
import { routes, type RouteHandle } from '../src/app/routes';
import { NGUONG_NGANG_PX, boCucHienTai } from '../src/lib/bo_cuc';

const doc = (p: string) =>
  readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

/** Mọi route + handle, phẳng. */
function gom(ds: RouteObject[], ra: Array<{ path?: string; h?: RouteHandle }> = []) {
  for (const r of ds) {
    ra.push({ path: typeof r.path === 'string' ? r.path : undefined, h: r.handle as RouteHandle });
    if (r.children) gom(r.children, ra);
  }
  return ra;
}

describe('Bàn đấu trên màn hình lớn', () => {
  it('CHỈ bàn đấu mang cờ manNgang — không rò sang màn nào khác', () => {
    const co = gom(routes).filter((r) => r.h?.manNgang === true);
    expect(co).toHaveLength(1);
    expect(co[0]!.path).toContain('/arena/tran/');
  });

  /*
   * ⚠ Bàn đấu và bảng quản trị nở KHÁC NHAU, và khác có lý do: bảng số càng
   * rộng càng dễ đọc vì mắt quét theo CỘT; bàn đấu thì mắt phải ôm cả cục.
   * Gộp hai cờ làm một là kéo bàn đấu ngang một mét trên màn 27 inch.
   */
  it('bàn đấu có TRẦN, bảng quản trị thì không — hai cờ khác nhau', () => {
    const css = doc('../src/app/AppShell.module.css');
    expect(css).toMatch(/\.frameNgang\s*\{[^}]*max-width:\s*min\(1100px/);
    expect(css).toMatch(/\.frameRong\s*\{[\s\S]*?max-width:\s*min\(1600px/);
  });

  /*
   * ⚠⚠ BÀI ĐÁNG GIÁ NHẤT. `--shell-width` từng gánh HAI vai: trần khung ngoài
   * VÀ tầm đọc bên trong. Một biến hai vai thì không nới được vai này mà không
   * nới luôn vai kia — đó mới là lý do thật khiến màn ngang trông bất khả thi.
   * Ai gộp lại thành một biến thì bài này đỏ.
   */
  it('tầm đọc là biến RIÊNG, và nó không nở bằng khung', () => {
    expect(doc('../src/styles/tokens.css')).toContain('--tam-width');
    const css = doc('../src/app/AppShell.module.css');
    const m = css.match(/@media \(min-width: 900px\)[\s\S]*?--tam-width:\s*(\d+)px/);
    expect(m, 'không thấy tầm đọc được khai riêng ở màn rộng').toBeTruthy();
    expect(Number(m![1]), 'tầm đọc nở bằng khung = mắt lạc dòng').toBeLessThan(1100);
  });

  /*
   * ⚠⚠ BÀI ĐẮT NHẤT CỦA CẢ FILE — nó khoá một chỗ hỏng IM LẶNG.
   * CSS quyết định shop có đứng cạnh bản đồ hay không; `lib/bo_cuc.ts` quyết
   * định ta GHI VÀO `events` là người đó thấy bố cục nào. Hai ngưỡng lệch nhau
   * thì cờ nói một đằng màn hình hiện một nẻo — không lỗi, không cảnh báo, và
   * chỉ lộ ra ở tầng phân tích nhiều tháng sau, lúc `events` đã append-only.
   */
  it('ngưỡng của CSS và ngưỡng ghi vào events phải BẰNG NHAU', () => {
    const css = doc('../src/components/holdem/ShopManHinh.module.css');
    const m = css.match(/@media \(min-width: (\d+)px\)/);
    expect(m, 'shop chưa có nhánh màn ngang').toBeTruthy();
    expect(Number(m![1])).toBe(NGUONG_NGANG_PX);
  });

  it('shop THÔI CHE trên màn rộng — đó là lý do làm màn ngang', () => {
    const css = doc('../src/components/holdem/ShopManHinh.module.css');
    const ngang = css.slice(css.indexOf('@media (min-width: 900px)'));
    // Lớp phủ gốc là `inset: 0` (che hết). Nhánh ngang phải neo lại, không che.
    expect(ngang).toMatch(/\.phu\s*\{[\s\S]*?inset:\s*0 auto 0 50%/);
    expect(ngang).toMatch(/width:\s*min\(420px/);
  });

  it('điện thoại KHÔNG đổi một px nào — đường chạy của phần lớn người chơi', () => {
    const css = doc('../src/app/AppShell.module.css');
    // Mọi thứ của màn rộng phải nằm SAU một media query, không đứng trần.
    const truoc = css.slice(0, css.indexOf('@media (min-width: 900px)'));
    expect(truoc).not.toContain('--tam-width:');
  });

  /*
   * ⚠⚠ BÀI SINH RA TỪ MỘT LỖI CÓ THẬT, founder chụp màn trong Discord 04/08.
   *
   * `.frame` có ĐÚNG HAI con: `<header>` và `<main>`. Đặt lưới `auto-fit` lên
   * chính nó thì hai con đó thành hai CỘT — tức thanh header cao 40px được cấp
   * nửa màn hình, và cả app bị nhồi vào nửa còn lại. Đo trên Chrome 1280×720:
   *     grid-template-columns: 542px 542px
   *     HEADER 542×549   ·   MAIN 542×549
   *
   * Lưới phải nằm ở tầng NỘI DUNG. Bài này khoá đúng chỗ đặt, không khoá con số
   * nào — số cột đổi theo bề ngang, còn "đặt lưới lên khung" thì sai vĩnh viễn.
   */
  it('lưới màn ngang KHÔNG được đặt lên khung — header sẽ ăn trọn một cột', () => {
    /*
     * ⚠ BẢN ĐẦU CỦA CHÍNH BÀI NÀY XANH GIẢ, và chỉ lộ ra nhờ tiêm lỗi ngược.
     * Nó tách luật bằng `([^{}]+?)\{([^{}]*)\}` — mà `@media (…) {` cũng mở một
     * cặp ngoặc, nên bộ tách không bao giờ đi vào trong media query. Gắn thẳng
     * `display: grid` lên `.frameNgang` mà bài vẫn xanh.
     * Nay hỏi TRỰC TIẾP thân của luật `.frameNgang` — không tự chế bộ tách CSS.
     */
    const css = doc('../src/app/AppShell.module.css');
    const luat = [...css.matchAll(/\.frameNgang\s*\{([^}]*)\}/g)];
    /*
     * ⭐ DÒNG ĐẾM NÀY LÀ HẬU QUẢ TRỰC TIẾP CỦA CHÚ THÍCH NGAY TRÊN. Bài từng
     * xanh giả một lần rồi, và bản vá lúc đó chỉ sửa BỘ TÁCH — không thêm gì để
     * lần sau biết bộ tách lại trôi. Đổi tên lớp `.frameNgang`, hay chỉ cần viết
     * `.frameNgang,\n.abc {` (dấu phẩy làm regex hụt), là quét trúng 0 luật và
     * vòng lặp dưới đây chạy 0 vòng — xanh, im lặng, y như lần trước.
     * (01/09: cùng ngày phát hiện `phong_cach_ui` canh keyframes bằng một vòng
     * chạy 0 lần suốt từ đầu. Ba lần cùng một hình dạng thì nó là một luật,
     * không phải xui.)
     */
    expect(luat.length, 'không quét được luật .frameNgang nào — bộ tách đã trôi lại')
      .toBeGreaterThan(0);
    for (const m of luat) {
      expect(m[1]!, 'lưới đặt lên khung ⇒ header ăn một cột').not.toMatch(/display:\s*grid/);
    }
  });

  it('…mà đặt lên khối nội dung của màn, chỗ các thẻ thật sự nằm', () => {
    const css = doc('../src/app/AppShell.module.css');
    const ngang = css.slice(css.indexOf('@media (min-width: 900px)'));
    // Phải có một luật tổ hợp con đi qua `.main` và khai số cột.
    expect(ngang).toMatch(/\.frameNgang\s*>\s*\.main\s*>[^{]*\{[^}]*grid-template-columns/);
  });

  it('không hỏi được màn hình thì khai "doc" — đoán về phía đa số', () => {
    const cu = window.matchMedia;
    // @ts-expect-error cố tình phá để kiểm nhánh dự phòng
    window.matchMedia = undefined;
    expect(boCucHienTai()).toBe('doc');
    window.matchMedia = cu;
  });
});
