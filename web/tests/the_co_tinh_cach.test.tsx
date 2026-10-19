/**
 * THẺ THỊ TRƯỜNG CÓ TÍNH CÁCH — founder 23/08: *"Thẻ cũ sau khi thẻ mới lật thì
 * bị biến thành màu xám chứ không chỉ làm mờ như hiện tại. Và các thẻ cũng phải
 * có hiệu ứng/khung viền riêng để cho giống thẻ bài hơn và thể hiện bản chất của
 * thẻ đang xuất hiện mà player chưa phải nhìn rõ thẻ."*
 *
 * Bốn thứ được khoá, mỗi cái một lớp lỗi:
 *   §I  QUÁ KHỨ XÁM THẬT — mờ mà giữ màu thì cả dải vẫn là bảy màu neon nhạt;
 *   §II BẢN CHẤT ĐÚNG THẺ — bảng tính cách không được trôi khỏi danh sách sự kiện;
 *   §III CHỈ Ô ĐANG LẬT mới có tính cách (cả dải nhấp nháy thì không ai đọc ra gì);
 *   §IV ⚠ KHÔNG GHI ĐÈ `animation` CỦA `.o` — bẫy im lặng, xem §IV.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SU_KIEN } from '@config/holdem';

const doc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const TSX = doc('src/components/holdem/MarketMap.tsx');
const CSS = doc('src/components/holdem/MarketMap.module.css');
const khongChuThich = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('I. Thẻ ĐÃ QUA — xám thật, không chỉ mờ', () => {
  it('⭐ `.qua` rút hết màu', () => {
    const than = /\.qua \{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(than, 'không tìm thấy `.qua`').not.toBe('');
    expect(than, 'chỉ giảm opacity là vẫn để cả dải neon nhạt')
      .toMatch(/grayscale\(1\)/);
  });

  it('nhãn số/chân cũng rút màu — chữ cyan sáng vẫn kéo mắt về ô đã hết chuyện', () => {
    const than = /\.qua \.so, \.qua \.chan \{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(than).not.toMatch(/--accent/);
  });
});

describe('II. Bản chất — đúng thẻ, đúng chỉ thị', () => {
  const chatCua = (id: string): string[] => {
    const dong = new RegExp(`${id}:\\s*\\{[^}]*\\}`).exec(khongChuThich(TSX))?.[0] ?? '';
    const m = /chat:\s*\[([^\]]*)\]/.exec(dong);
    return m ? [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!) : [];
  };

  it('⭐ chiến tranh và thiên nga đen: RUNG khi xuất hiện + TRO BAY', () => {
    for (const id of ['chien_tranh', 'thien_nga_den']) {
      expect(chatCua(id), id).toContain('rungHien');
      expect(chatCua(id), id).toContain('troBay');
    }
  });

  it('⭐ năm mặt ĐUÔI cũng là thiên nga đen ⇒ cùng bản chất', () => {
    /*
     * `thien_nga_den` đã được chia thành năm mặt (D43 §4.3) giữ nguyên ngân
     * sách. Chúng KHÔNG được năm hiệu ứng bịa thêm — chúng LÀ thiên nga đen.
     * Đây là chỗ dễ sai theo hướng "làm nhiều hơn cho phong phú": mười hai hiệu
     * ứng khác nhau thì không ai đọc ra ý nghĩa của cái nào.
     */
    // D393: chiến tranh cũng vào lá thiên nga (D390) ⇒ cùng bản chất, không nhịp cam riêng.
    for (const id of ['chien_tranh', 'phap_ly', 'pha_san', 'cam_van', 'tham_hoa', 'dich_benh']) {
      expect(chatCua(id), id).toEqual(chatCua('thien_nga_den'));
    }
    // …và đủ bốn hiệu ứng của lá thiên nga trong demo: rung · tro · giật nhiễu · quét CRT.
    expect(chatCua('thien_nga_den')).toEqual(['rungHien', 'troBay', 'giat', 'quet']);
  });

  it('⭐ cặp lãi suất: ánh kim chạy DỌC NÉT (art), không còn lớp loé phủ cả ô', () => {
    /*
     * D393: founder chốt tăng lãi *"y hệt hạ lãi, chỉ khác màu + linh vật"* (D390) ⇒ cả hai
     * mang cùng nhịp loé kim, và nhịp ấy nằm trong art (`data-nhip="kim"`), CSS ô chỉ bật nó.
     * Tăng lãi giữ cú rung nhẹ lúc xuất hiện (founder 23/08).
     */
    expect(chatCua('ha_lai_suat')).toEqual([]);
    expect(chatCua('tang_lai_suat')).toEqual(['rungNhe']);
    expect(khongChuThich(CSS), 'mất nhịp vệt loé kim trên nét vẽ')
      .toMatch(/svg\[data-nhip="kim"\] \.vet\)\s*\{[^}]*animation-name:\s*laVetKim/);
  });

  it('⭐ CẠN THANH KHOẢN (sập sàn cũ) KHÔNG còn nhiễu — nó là trạng thái của chợ, không phải hỏng hóc', () => {
    // D393: founder đổi "Sàn khoá rút tiền" thành Cạn thanh khoản (D390) ⇒ bỏ ngôn ngữ trục trặc.
    expect(chatCua('hack_san')).toEqual([]);
  });

  it('mọi lớp bản chất được nhắc đều CÓ THẬT trong CSS', () => {
    // "Cơ chế trang trí" ở dạng ngược: tên lớp gõ sai thì không lỗi, chỉ là
    // không có hiệu ứng nào — và không gì báo.
    const dung = [...khongChuThich(TSX).matchAll(/chat:\s*\[([^\]]*)\]/g)]
      .flatMap((m) => [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!));
    expect(dung.length).toBeGreaterThan(0);
    for (const lop of new Set(dung)) {
      expect(CSS, `lớp \`${lop}\` không có trong CSS`).toMatch(new RegExp(`\\.${lop}[\\s.:{]`));
    }
  });

  it('mọi id trong bảng tính cách là sự kiện CÓ THẬT (bảng không trôi khỏi config)', () => {
    const ids = new Set(SU_KIEN.map((x) => x.id as string));
    const bang = /const TINH_CACH_SU_KIEN[^{]*\{([\s\S]*?)\n\};/.exec(TSX)?.[1] ?? '';
    const quet = [...khongChuThich(bang).matchAll(/^\s{2}([a-z_]+):/gm)];
    /*
     * ⭐ Bài này trích bảng bằng regex, nên nó có HAI cách chết lặng: `const
     * TINH_CACH_SU_KIEN` đổi hình dạng (thành `export const`, thêm kiểu, đổi
     * cách xuống dòng) ⇒ `bang` rỗng; hoặc thụt lề bảng đổi khỏi đúng 2 dấu
     * cách ⇒ không id nào quét trúng. Cả hai đều cho một vòng lặp 0 vòng, tức
     * một bài luôn xanh mà không đối chiếu gì với `SU_KIEN`.
     * (01/09: cùng hình dạng với hai ca vừa tìm ra ở `phong_cach_ui` và
     * `man_ngang`.)
     */
    expect(quet.length, 'không quét được id nào — bộ trích bảng đã trôi')
      .toBeGreaterThan(0);
    for (const m of quet) {
      expect(ids, `\`${m[1]}\` không còn trong SU_KIEN`).toContain(m[1]!);
    }
  });
});

describe('III. Chỉ ô ĐANG LẬT mới có tính cách', () => {
  it('thẻ đã qua không nhận lớp bản chất nào', () => {
    /*
     * Thẻ đã qua nay XÁM hẳn; một thẻ xám mà vẫn rung là nói dối về việc nó còn
     * quan trọng. Và cả dải nhấp nháy bảy kiểu thì không ai đọc được cái nào.
     */
    const than = khongChuThich(TSX);
    expect(than).toMatch(/trangThai === 'nay' && laSK[\s\S]{0,200}?\?\.chat/);
  });
});

describe('IV. ⚠ Không lớp bản chất nào ghi đè `animation` của chính ô', () => {
  it('⭐ cú RUNG và cú GIẬT đặt trên `.art`, không trên `.o`', () => {
    /*
     * Bẫy ghi đè im lặng, bắt được ngay khi vừa viết: `.skChienTranh`, `.skLoi`,
     * `.skPhong` đã khai `animation` trên chính ô (nhịp thở + lửa/giật/nổi lên).
     * Thêm một lớp nữa cũng khai `animation` trên ô thì lớp nào đứng SAU TRONG
     * FILE thắng — KHÔNG phải lớp nào đứng sau trong `className`. Cú rung mới sẽ
     * nuốt sạch nhịp thở cũ, mà CSS vẫn hợp lệ và không gì báo.
     */
    for (const lop of ['rungHien', 'rungNhe']) {
      const trenO = new RegExp(`^\\.${lop} \\{`, 'm');
      expect(CSS, `\`.${lop}\` khai animation trên chính ô ⇒ nuốt nhịp thở của thẻ`)
        .not.toMatch(trenO);
      expect(CSS).toMatch(new RegExp(`\\.${lop} \\.art \\{[^}]*animation`));
    }
    // D393: cú GIẬT của lá thiên nga ở tầng thứ ba — `svg` trong cửa sổ — vì `.art` đã có
    // cú rung xuất hiện; cùng tầng thì một trong hai bị nuốt.
    expect(CSS, '`.giat` không được khai animation trên ô').not.toMatch(/^\.giat \{/m);
    expect(CSS).toMatch(/\.giat \.art > svg \{[^}]*animation/);
  });

  it('mỗi thẻ dùng `::before` CỦA Ô đúng MỘT lần — lớp phủ không giẫm chân nhau', () => {
    // D393: đọc từ CSS thay vì gõ danh sách — `loeKim`/`loeDo`/`nhieu` đã gỡ, còn `troBay`.
    // (`.quet .art::before` nằm trên CỬA SỔ HÌNH, phần tử khác, không tranh với ô.)
    const dungBefore = [...khongChuThich(CSS).matchAll(/^\.([A-Za-z]+)::before/gm)].map((m) => m[1]!);
    expect(dungBefore).toEqual(['troBay']);
    const bang = khongChuThich(TSX);
    for (const m of bang.matchAll(/chat:\s*\[([^\]]*)\]/g)) {
      const lop = [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
      const dem = lop.filter((l) => dungBefore.includes(l)).length;
      expect(dem, `thẻ dùng ${dem} lớp ::before — chúng sẽ đè nhau`).toBeLessThanOrEqual(1);
    }
  });

  it('tiết kiệm chuyển động: tắt CHUYỂN ĐỘNG, giữ CHẤT LIỆU', () => {
    const tat = /@media \(prefers-reduced-motion: reduce\)([\s\S]*)$/.exec(CSS)?.[1] ?? '';
    expect(tat).toMatch(/\.rungHien \.art/);
    // Lớp phủ vẫn hiện ở một khung hình đứng yên ⇒ bản chất thẻ vẫn đọc được.
    expect(tat).toMatch(/opacity: 0\.5/);
  });
});

/*
 * D529 — §V TÊN LỚP BẢN CHẤT KHÔNG ĐƯỢC DÙNG LẠI. CSS module gộp hai tên trùng thành MỘT class: D442 thêm `.quet` cho vệt loé
 * mặt bàn (`position:absolute · width:45% · translateX`) trùng tên bản chất `quet` của lá thiên nga ⇒ ô thiên nga lật ra là co
 * lại, trượt khỏi chỗ, để lại khối đen (và `display:none` khi giảm chuyển động). Lớp bản chất gắn lên CHÍNH Ô, nên mọi rule của
 * nó chỉ được là con (`.x .art`) hoặc giả tố (`.x::before`) — rule trần `.x {` / `.x,` là đổi hộp của ô.
 */
describe('V. Lớp bản chất gắn lên ô — không trùng tên, không rule trần', () => {
  const ten = [...new Set([...khongChuThich(TSX).matchAll(/chat:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1]!.matchAll(/'(\w+)'/g)].map((x) => x[1]!)))];
  it('bảng có lớp bản chất để canh', () => { expect(ten).toEqual(expect.arrayContaining(['quet', 'giat', 'troBay', 'rungHien'])); });
  it('⭐ không chỗ nào khác trong MarketMap.tsx gắn lớp bản chất bằng `s.<tên>`', () => {
    for (const t of ten) expect(khongChuThich(TSX), `s.${t} dùng ngoài bảng tính cách`).not.toMatch(new RegExp(String.raw`\bs\.${t}\b|s\['${t}'\]`));
  });
  it('⭐ CSS: mọi selector bắt đầu bằng lớp bản chất chỉ là con hoặc giả tố', () => {
    const css = khongChuThich(CSS);
    for (const t of ten) {
      const tran = [...css.matchAll(new RegExp(String.raw`\.${t}(?![\w-])(?!\s+[.\w>]|::)`, 'g'))].map((m) => css.slice(m.index!, m.index! + 40));
      expect(tran, `rule trần .${t}`).toEqual([]);
    }
  });
});
