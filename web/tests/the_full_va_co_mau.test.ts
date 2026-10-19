/**
 * THẺ SỰ KIỆN PHẢI ĐẦY MẶT VÀ CÓ MÀU RIÊNG — founder 24/08: *"thẻ bài sự kiện
 * cái nào trông cũng giống nhau vì không full và nền tím"*.
 *
 * Hai nguyên nhân, và bộ canh này khoá cả hai vì gỡ một cái thôi thì lỗi vẫn còn:
 *
 *   §I  KHÔNG FULL — art là cảnh 4:3 (viewBox 200×150) nhét vào một hộp gần
 *       VUÔNG, mà SVG mặc định `preserveAspectRatio: meet` nên nó tự thu vào
 *       giữa và chừa hai dải trống trên–dưới; cộng đệm 8px bốn phía nữa thì
 *       tranh chỉ còn ~43% mặt thẻ. Cái phân biệt bảy loại tin bị bóp hơn nửa.
 *
 *   §II NỀN TÍM — sáu màu tính cách CÓ TỒN TẠI từ D121 nhưng chỉ sống trên một
 *       cái viền 1,5px của ĐÚNG ô đang lật, còn 100% mặt ô là một nền tím dùng
 *       chung. Bảy tin khác nhau in ra bảy tấm thẻ tím giống hệt.
 *
 * ⚠ §III canh cái BẪY LẶNG nguy hiểm nhất của cụm này: thêm một sự kiện mới mà
 * quên khai màu thì thẻ KHÔNG vỡ, không lỗi, không test nào khác đỏ — nó chỉ
 * lặng lẽ rơi về xám trung tính, tức tái sinh đúng cái bug đang sửa.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GIAI_DOAN, SU_KIEN } from '@config/holdem';
import { HO_MAU, matLa } from '../src/lib/la_bai';

const doc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const TSX = doc('src/components/holdem/MarketMap.tsx');
const CSS = doc('src/components/holdem/MarketMap.module.css');
const khongChuThich = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Sáu hex của bảng màu — dùng để bắt bản sao thứ hai mọc lại trong CSS. */
const SAU_HEX = ['#fb923c', '#4ade80', '#ef4444', '#22d3ee', '#c2410c', '#a78bfa'];

/*
 * ⚠ 24/09 (D393) — §I VIẾT LẠI THEO BỘ LÁ MỚI (D390). Hai luật cũ ("`.art` khoá 4:3" và "ô
 * không đệm") là luật của bộ CẢNH 200×150 phủ kín khung: tranh kín khung thì hộp thư lộ nền.
 * Lá mới là nét vẽ TRONG SUỐT, VUÔNG, đặt giữa một CỬA SỔ TỐI, và khung lá có đệm + khắc góc
 * — đúng khuôn demo founder duyệt. Lỗi "trông giống nhau vì không full" không quay lại theo
 * đường này: thứ phân biệt bảy tin nay là HỌ MÀU + nét vẽ, và §II vẫn canh màu.
 * Hai bài mới canh đúng hai cách lá mới có thể hỏng im lặng: bị kéo méo, và khung trôi khỏi demo.
 */
describe('I. Lá trên ô = đúng khuôn lá đã duyệt (D390/D393)', () => {
  it('⭐⭐ tranh giữ VUÔNG trong cửa sổ hình — không bị kéo méo theo ô', () => {
    const css = khongChuThich(CSS);
    const svg = /^\.art > svg \{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(svg, 'không tìm thấy `.art > svg`').not.toBe('');
    expect(svg, 'mất `aspect-ratio: 1` ⇒ ô có thêm hàng chip là lá bị ép dẹt')
      .toMatch(/aspect-ratio:\s*1\s*;/);
    const art = /^\.art \{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(art, '`.art` lại khoá 4:3 — luật của bộ cảnh cũ, lá vuông sẽ bị bóp')
      .not.toMatch(/aspect-ratio:\s*4\s*\/\s*3/);
    expect(art, 'cửa sổ hình phải tối như `.cua` của demo').toMatch(/background-color:\s*#02050a/);
  });

  it('⭐ khung lá KHẮC GÓC đúng từng điểm của demo', () => {
    // Token + số đo chép NGUYÊN từ demo (A11.25) — lệch một điểm là một góc lá khác.
    const demo = readFileSync(resolve(process.cwd(), '../docs/ui-ux/demo/la-bai-phong-cach.html'), 'utf8');
    const gon = (x: string) => x.replace(/\s+/g, '');
    const khacDemo = /--khac:(polygon\([^;]*\));/.exec(demo)?.[1] ?? '';
    expect(khacDemo, 'không đọc được `--khac` của demo').not.toBe('');
    const o = /^\.o \{([\s\S]*?)\n\}/m.exec(khongChuThich(CSS))?.[1] ?? '';
    expect(gon(/--khac:([^;]*);/.exec(o)?.[1] ?? ''), '`--khac` của ô lệch demo').toBe(gon(khacDemo));
    expect(o, 'ô không cắt theo `--khac`').toMatch(/clip-path:\s*var\(--khac\)/);
  });

  it('bảng tên nằm DƯỚI art, không cắt ngang đỉnh thẻ', () => {
    // Thứ tự trong JSX quyết định bố cục cột: số (đè lên art) → art → tên → chân.
    const than = khongChuThich(TSX);
    const iArt = than.indexOf('s.art');
    const iTen = than.indexOf('s.ten');
    expect(iArt, 'không tìm thấy `s.art`').toBeGreaterThan(-1);
    expect(iTen, 'không tìm thấy `s.ten`').toBeGreaterThan(-1);
    expect(iArt, 'bảng tên lại nhảy lên TRÊN art ⇒ tranh bị đẩy tụt xuống')
      .toBeLessThan(iTen);
  });
});

describe('II. Màu của CẢ ô, và chỉ MỘT nguồn', () => {
  it('⭐⭐ viền lá · lưới cửa sổ hình đều đọc `--o-mau`, không gõ lại hex', () => {
    // D393: khung lá mới vẽ viền bằng inset box-shadow (demo), cửa sổ hình nhuộm lưới theo họ.
    const css = khongChuThich(CSS);
    const o = /^\.o \{([\s\S]*?)\n\}/m.exec(css)?.[1] ?? '';
    expect(o, 'viền lá không theo màu họ ⇒ cả dải lại một màu')
      .toMatch(/box-shadow:[\s\S]*var\(--o-mau/);
    const art = /^\.art \{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(art, 'cửa sổ hình không theo màu họ ⇒ bảy tin lại chung một khung')
      .toMatch(/background-image:[\s\S]*var\(--o-mau/);
  });

  it('⭐ hào quang thẻ và cú chớp màn thôi gõ hex — cùng đọc một biến', () => {
    /*
     * Trước bản này mỗi hex nằm HAI chỗ — `.sk*::after` (hào quang quanh thẻ) và
     * `.chop*` (cú chớp toàn màn). Chúng LUÔN phải bằng nhau, nên bản thứ hai chỉ
     * là bản sẽ trôi (D61), và cú trôi biểu hiện là "thẻ đỏ mà màn chớp xanh" —
     * không lỗi, không ai báo, chỉ sai.
     *
     * ⚠ Quét theo LUẬT CỦA TỪNG RULE chứ không quét cả file: `.troBay` có một
     * bảng hex RIÊNG cho tàn lửa (nhiều sắc cam của tro), và nó KHÔNG phải bản
     * sao của bảng màu tin. Một bài cấm cả file sẽ đỏ vì nó và rồi bị tắt (D79).
     */
    const css = khongChuThich(CSS);
    // ⚠ `.chopMan` là cái KHUNG của cú chớp (vị trí + nhịp), không mang màu —
    // loại nó ra, không thì bài đỏ vì một rule vốn không có việc gì với màu.
    const luat = [...css.matchAll(/^(\.(?:sk\w+::after|chop(?!Man\b)[A-Z]\w*))\s*\{([^}]*)\}/gm)];
    // D393: 4 nhịp hào quang (tốt · xấu · bào mòn · phồng) + 4 kiểu chớp — chiến tranh và
    // sập sàn thôi có nhịp/chớp riêng (vào lá thiên nga / nhịp cạn dần).
    expect(luat.length, 'không đọc được rule hào quang / chớp màn nào')
      .toBeGreaterThanOrEqual(8);
    for (const [, ten, than] of luat) {
      for (const hex of SAU_HEX) {
        expect(than, `${ten} gõ cứng ${hex} ⇒ dựng lại bảng màu thứ hai`)
          .not.toContain(hex);
      }
      expect(than, `${ten} không đọc \`--o-mau\` ⇒ nó sẽ trôi khỏi màu của thẻ`)
        .toMatch(/var\(--o-mau/);
    }
  });

  it('⭐⭐ MỌI lớp tính cách đều có màu — thêm tin mới mà quên là thẻ về xám', () => {
    /*
     * Bẫy im lặng của cụm này. `--o-mau` có giá trị lùi, nên một sự kiện thiếu
     * màu KHÔNG vỡ gì cả: nó chỉ trông y hệt ô trung tính — tức tái sinh đúng
     * cái bug "cái nào cũng giống nhau" mà không một dấu hiệu nào.
     */
    /*
     * D393: màu thôi theo lớp nhịp (`MAU_O` đã gỡ) mà theo HỌ của lá (`matLa`, lib/la_bai.ts).
     * Bẫy im lặng vẫn y nguyên, chỉ đổi chỗ: tin/giai đoạn không có mặt lá ⇒ không họ ⇒ xám.
     * Nguồn là danh sách của CONFIG, không chép tay.
     */
    for (const x of SU_KIEN) {
      const m = matLa(`sk_${x.id}`);
      expect(m, `tin "${x.id}" không có mặt lá ⇒ ô rơi về xám`).toBeTruthy();
      expect(HO_MAU[m!.ho]?.mau, `tin "${x.id}" họ "${m!.ho}" không có màu`).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const g of GIAI_DOAN) {
      const m = matLa(`gd_${g.id}`);
      expect(m, `giai đoạn "${g.id}" không có mặt lá ⇒ ô rơi về xám`).toBeTruthy();
      expect(HO_MAU[m!.ho]?.mau).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(TSX, 'bảng màu thứ hai theo lớp nhịp mọc lại').not.toMatch(/const MAU_O\b/);
  });

  it('màu chảy vào ô ĐÃ QUA nữa, không riêng ô đang lật', () => {
    /*
     * Phân biệt rạch ròi với D121: HOẠT ẢNH chỉ ô đang lật (cả dải nhấp nháy
     * thì không ai đọc được gì), nhưng MÀU thì mọi ô — nếu không thì cả đoạn
     * quá khứ lại là một dải tím đồng nhất, đúng thứ founder gạch.
     * ⇒ Cú gán `--o-mau` KHÔNG được đứng sau điều kiện `trangThai === 'nay'`.
     */
    const than = khongChuThich(TSX);
    const gan = /--o-mau[\s\S]{0,120}?\}/.exec(than)?.[0] ?? '';
    expect(gan, "không tìm thấy chỗ gán `--o-mau`").not.toBe('');
    const truoc = than.slice(Math.max(0, than.indexOf('--o-mau') - 220), than.indexOf('--o-mau'));
    expect(truoc, 'màu bị khoá vào ô đang lật ⇒ quá khứ lại thành dải tím đồng nhất')
      .not.toMatch(/trangThai === 'nay'\s*&&\s*laSK\s*$/);
  });
});
