/**
 * BA HỒI QUY CỦA MÀN TRẬN — tìm ra khi khảo sát Alpha Draft (31/08).
 *
 * Cả ba cùng một lớp: hỏng IM LẶNG. Không lỗi, không test đỏ, tsc xanh, lint
 * xanh — chỉ có một thứ trên màn hình nói sai, và nó chỉ lộ khi founder chụp
 * màn hình. Đó là lý do file này canh chúng bằng cách ĐỌC THẲNG mã nguồn/CSS
 * chứ không dựng DOM: jsdom không có layout, mà hai trong ba lỗi là lỗi layout
 * và lỗi màu.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
/** Bóc chú thích TRƯỚC khi quét — chú thích ở đây trích nguyên văn thứ bị cấm,
 *  nên quét thô sẽ khớp nhầm chính lời cảnh báo (bẫy đã trả giá ở pixelui). */
const ma = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('I. Ô ÚP phải có bề rộng — bug sống 7 ngày từ D123', () => {
  /*
   * D123 (7b3d740) tách hai tầng: `.khung` giữ `flex: 0 0 116px; height: 152px`,
   * `.o` chỉ còn `width/height: 100%`. Hàm veO() được bọc; hai nhánh ô ÚP thì
   * KHÔNG — nên trong flex row chúng co về đúng bề rộng nội dung: đo trên trình
   * duyệt ra 2px. Cộng với D184 vừa gỡ dải lịch vòng, người chơi mất SẠCH đường
   * biết ô nào là kỳ họp — mà đó là phép đếm bài hợp lệ D43 cố ý phát cho họ.
   */
  const TSX = ma(doc('src/components/holdem/MarketMap.tsx'));
  const CSS = doc('src/components/holdem/MarketMap.module.css');

  it('⭐⭐ mọi ô của dải map đều đi qua `.khung` — nơi DUY NHẤT giữ flex-basis', () => {
    // Đếm số lần mở một ô: veO (1) + veOChe (1 — ô che MÙ TIN / ô sương SƯƠNG MÙ, D422) + nhánh úp (1) + nhánh "CÒN N" (1) = 4.
    // `veO` mở ô bằng MẢNG class (`s.o,`), hai nhánh úp bằng template `${s.o}`
    // ⇒ đếm theo token `s.o` chứ không theo một cách viết.
    const soO = [...TSX.matchAll(/s\.o\b/g)].length;
    const soKhung = [...TSX.matchAll(/s\.khung/g)].length;
    expect(soO, 'số ô đổi — đọc lại rồi cập nhật con số này CÓ Ý THỨC').toBe(4);
    expect(soKhung, `${soO} ô nhưng chỉ ${soKhung} .khung — có nhánh ô không có bề rộng`)
      .toBe(soO);
  });

  it('`.khung` giữ flex-basis, `.o` KHÔNG — nếu ngược lại thì việc bọc là vô nghĩa', () => {
    const khung = CSS.slice(CSS.indexOf('.khung {'), CSS.indexOf('}', CSS.indexOf('.khung {')));
    expect(khung, '.khung mất flex-basis').toMatch(/flex:\s*0\s+0\s+\d+px/);
    expect(khung, '.khung mất chiều cao').toContain('height');
  });

  it('nhánh ô ÚP giữ được dấu KỲ HỌP — thứ duy nhất còn lại sau khi D184 gỡ dải lịch', () => {
    expect(TSX).toContain('laKyHop');
    expect(TSX).toContain('KỲ HỌP');
  });
});

describe('II. Chấm báo "có lõi chờ chọn" — tin TỐT không được vẽ bằng màu MẤT TIỀN', () => {
  const CSS = doc('src/components/holdem/TayBai.module.css');
  const luat = CSS.slice(CSS.indexOf('.cham {'), CSS.indexOf('}', CSS.indexOf('.cham {')));

  it('⭐⭐ chấm dùng HỔ PHÁCH, tuyệt đối không dùng `--lose`', () => {
    /*
     * Khi dời từ `AlphaDraftMatch.chamMoi` sang `TayBai.cham`, chấm rơi về
     * `var(--lose)`. Người chơi đọc màu trước khi đọc chữ, nên "có hàng mới"
     * vẽ bằng đỏ-thua là dạy sai đúng thứ họ học nhanh nhất.
     */
    expect(luat, 'chấm thông báo đang dùng màu MẤT TIỀN').not.toContain('--lose');
    expect(luat, 'chấm phải là hổ phách').toContain('--gold-amber');
  });

  it('chấm có nhịp thở, và nhịp đi qua `--nhip-*` chứ không gõ số trần', () => {
    expect(luat, 'chấm đứng im — mất luôn vế "có gì đó mới"').toContain('animation');
    expect(luat, 'thời lượng gõ trần thì không có cần gạt nào chỉnh được')
      .toContain('--nhip-tho');
  });

  it('có nhánh reduced-motion, và nó GIỮ chấm lại (D116: tắt chuyển động, không tắt tin)', () => {
    const i = CSS.indexOf('prefers-reduced-motion');
    expect(i, 'thiếu hẳn nhánh reduced-motion').toBeGreaterThan(-1);
    const khoi = CSS.slice(i, CSS.indexOf('}', CSS.indexOf('}', i) + 1));
    expect(khoi).toContain('.cham');
    expect(khoi, 'tắt chuyển động mà làm chấm biến mất là tắt luôn cái TIN').toContain('opacity: 1');
  });

  it('`--nhip-tho` có người khai — không phải biến ma', () => {
    expect(ma(doc('src/lib/nhip.ts')), 'nhip.ts chưa bơm --nhip-tho').toContain("'--nhip-tho'");
  });
});

describe('III. Khối CSS chết không được nằm lại làm mồi cho người sau', () => {
  it('`.chamMoi` / `admChamTho` đã gỡ — bản cũ còn đó là hai nguồn cho một chấm', () => {
    /*
     * Khối cũ vẫn đầy đủ (8px, quầng, thở, cả nhánh reduced-motion) và trông
     * rất đúng, nhưng 0 người gọi. Ai được giao "sửa chấm báo" sẽ tìm thấy nó
     * trước, chỉnh ở đó, rồi không thấy gì đổi — đúng bẫy D87.
     */
    const CSS = doc('src/screens/holdem/AlphaDraftMatch.module.css');
    expect(CSS).not.toContain('.chamMoi');
    expect(CSS).not.toContain('admChamTho');
  });
});


describe('IV. Lớp animation CHẾT và lưới tiết kiệm chuyển động', () => {
  /*
   * Quét ra 8 lớp có `animation` mà 0 nơi nào gọi (kể cả qua `composes` và qua
   * chuỗi động). Chúng không vô hại: người được giao "sửa hiệu ứng X" tìm thấy
   * khối cũ trước, chỉnh ở đó, rồi không thấy gì đổi — đúng bẫy D87. Nặng nhất
   * là `.adTho`, mà chú thích của chính nó đã tự khai "KHÔNG CÒN NGƯỜI DÙNG
   * (24/08)" rồi vẫn nằm lại thêm một tuần.
   */
  const DA_GO = ['adLatThe', 'adLoLung', 'adTho', 'adRungNhe', 'pxSang', 'pxNhay', 'admNuocHien'];

  it('⭐ tám lớp/keyframe đã gỡ không được mọc lại', () => {
    for (const f of ['src/styles/motion.module.css', 'src/styles/pixel.module.css',
                     'src/screens/holdem/AlphaDraftMatch.module.css']) {
      const s = ma(doc(f));
      for (const t of DA_GO) {
        expect(s, `${t} mọc lại ở ${f}`).not.toContain(`@keyframes ${t}`);
      }
    }
  });

  it('⭐⭐ mọi selector trong khối reduced-motion phải trỏ tới một lớp CÓ THẬT', () => {
    /*
     * Lỗi vừa gặp khi dọn: gỡ lớp mà quên gỡ tên nó khỏi danh sách tắt ⇒ danh
     * sách đọc lên như đang che 12 lớp, thực ra che 9. Không CSS nào báo, và
     * người sau tin vào danh sách đó thay vì đi kiểm.
     */
    /* ⚠ BÓC CHÚ THÍCH TRƯỚC: khối tắt có chú thích trích tên lớp ĐÃ GỠ để kể
       lý do nhóm này được phủ. Quét thô là bắt phải chính lời kể đó — bài đỏ vì
       lý do sai thì bị nới cho qua, và lúc ấy nó thôi canh gì (D79). */
    const s = ma(doc('src/styles/motion.module.css'));
    const i = s.indexOf('@media (prefers-reduced-motion');
    expect(i, 'motion.module.css mất khối reduced-motion').toBeGreaterThan(-1);
    const khoiRM = s.slice(i);
    const khai = new Set([...s.matchAll(/^\.([A-Za-z0-9_]+)/gm)].map((m) => m[1]));
    const goi = new Set([...khoiRM.matchAll(/\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));
    const thieu = [...goi].filter((t) => !khai.has(t));
    expect(thieu, `khối tắt gọi tên lớp không tồn tại: ${thieu.join(', ')}`).toEqual([]);
  });

  it('`pixel.module.css` có lưới tắt — và confetti bị ẨN chứ không phải `animation: none`', () => {
    /*
     * `.hat` kết ở `opacity: 0` kèm `forwards`. Tắt animation là đóng băng nó ở
     * khung ĐẦU ⇒ một đám ô vuông đứng im vĩnh viễn. Đây là chỗ áp D116 máy móc
     * sẽ ra kết quả tệ hơn cả không áp.
     */
    /* ⚠ `ma()` — BÓC CHÚ THÍCH TRƯỚC, cùng lý do với bài ngay trên. Bài này đỏ
       thật ngày 19/09 vì một chú thích MỚI ở đầu `pixel.module.css` nhắc tên khối
       tắt: `indexOf` bắt trúng lời kể, `rm` bắt đầu từ đầu tệp, nên `.hat` nó soi
       là `.hat` KHAI BÁO (không có `display: none`) chứ không phải `.hat` trong
       khối tắt. Canh CSS thì phải đọc CSS, đừng đọc văn xuôi. */
    const s = ma(doc('src/styles/pixel.module.css'));
    const i = s.indexOf('@media (prefers-reduced-motion');
    expect(i, 'pixel.module.css vẫn chưa có lưới tắt tầng CSS').toBeGreaterThan(-1);
    const rm = s.slice(i);
    expect(rm).toContain('.lat');
    const hat = rm.slice(rm.indexOf('.hat'), rm.indexOf('}', rm.indexOf('.hat')));
    expect(hat, 'confetti phải ẩn hẳn, không phải đứng im').toContain('display: none');
  });

  it('⭐⭐ `pixel.module.css` nằm trong `@layer pixel` — nếu không, mọi `composes` chết câm', () => {
    /*
     * LỖI ĐÃ CHẠY TRÊN PROD (19/09). `composes` không tạo thứ hạng: `.nut` và lớp
     * của nơi dùng đều (0,1,0), nên kẻ đứng SAU thắng — mà `pixel.module.css` bị
     * minifier gom về MỘT bản ở CUỐI bundle (byte ~271.900 / 292 KB). Hệ quả:
     * 38 lớp ở 22 tệp `composes` rồi khai đè đều bị nuốt (nút chính 17 màn hiện
     * ra như `.nut` xám trơn), và 16 lớp "đang chọn" vô hình — founder báo là
     * "bấm câu 2 thì câu 1 mất dấu".
     *
     * `@layer` là thứ DUY NHẤT ở đây không phụ thuộc thứ tự bundler. Gỡ nó ra là
     * lỗi quay lại y nguyên, vẫn im lặng y nguyên. Nên bài này canh ba điều:
     * layer có mặt · lớp nền nằm TRONG · lưới tắt chuyển động nằm NGOÀI.
     */
    const s = ma(doc('src/styles/pixel.module.css'));
    const mo = s.indexOf('@layer pixel {');
    expect(mo, 'pixel.module.css không còn `@layer pixel` — xem chú thích trong chính tệp đó')
      .toBeGreaterThan(-1);

    // khớp ngoặc để biết layer đóng ở đâu
    let d = 0;
    let dong = -1;
    for (let j = mo + '@layer pixel'.length; j < s.length; j++) {
      if (s[j] === '{') d++;
      else if (s[j] === '}') { d--; if (d === 0) { dong = j; break; } }
    }
    expect(dong, '`@layer pixel` không đóng ngoặc').toBeGreaterThan(mo);

    /* Lưới tắt chuyển động PHẢI ở ngoài: nó cần thắng cả layer lẫn nơi dùng. */
    const rm = s.indexOf('@media (prefers-reduced-motion');
    expect(rm, 'pixel.module.css mất khối reduced-motion').toBeGreaterThan(-1);
    expect(rm > dong, 'khối reduced-motion lọt VÀO layer ⇒ nơi dùng đè được lưới an toàn')
      .toBe(true);

    /*
     * ⚠ KHÔNG chỉ soi vài lớp tên sẵn — soi TẤT CẢ. Mũi tiêm ngày 19/09 chứng
     * minh bản đầu của bài này vô dụng: thêm `.nut { … }` MỘT LẦN NỮA ở ngay
     * sau ngoặc đóng của layer thì `indexOf('.nut {')` vẫn trúng bản trong
     * layer ⇒ bài xanh, mà lớp thật đang chạy là bản ngoài. Đây đúng là cách
     * lỗi sẽ quay lại: người sau viết thêm một lớp ở CUỐI tệp cho tiện.
     * Nên luật là: mọi selector lớp của tệp này ở TRONG layer, trừ `.lat`/`.hat`
     * của khối reduced-motion.
     */
    const ngoai: string[] = [];
    for (const m of s.matchAll(/^\.[A-Za-z][\w-]*/gm)) {
      const i = m.index ?? -1;
      if (i > mo && i < dong) continue;
      if (i > rm) continue; // trong khối reduced-motion — cố ý ở ngoài
      ngoai.push(`${m[0]} @${i}`);
    }
    expect(ngoai, `lớp nằm NGOÀI @layer ⇒ lại đè nơi dùng: ${ngoai.join(', ')}`).toEqual([]);

    for (const lop of ['.nut {', '.khung {', '.nutChinh {', '.khoi {']) {
      expect(s.indexOf(lop), `${lop} biến mất khỏi pixel.module.css`).toBeGreaterThan(-1);
    }
  });

  it('con trỏ màn tập thôi nháy nhưng KHÔNG biến mất (D116: tắt nhịp, giữ tin)', () => {
    const s = doc('src/components/holdem/CoachTap.module.css');
    const i = s.indexOf('@media (prefers-reduced-motion');
    expect(i, 'CoachTap chưa có lưới tắt').toBeGreaterThan(-1);
    const rm = s.slice(i);
    const ct = rm.slice(rm.indexOf('.conTro'), rm.indexOf('}', rm.indexOf('.conTro')));
    expect(ct).toContain('animation: none');
    expect(ct, 'tắt cả con trỏ là tắt luôn dấu "trợ lý đang nói tới đây"').toContain('opacity: 1');
  });
});

describe('D427 — luật ép cỡ lá trong shop chỉ được nhắm THÂN lá', () => {
  /*
   * Khung lá GameCard có BA nút con: thân lá (`data-card`), (!) và MUA. D374 viết
   * `.ni .hangThe > * > button` — bắt cả ba: đo ở 375px, (!) 22×22 thành ô 108×144 đè lên lá, MUA
   * thành ô 53×71, thân lá còn 60×74 (founder chụp màn vòng lõi 26/09). Luật cùng kiểu ở lưới tài
   * sản làm (!) còn 22×15. jsdom không có layout nên canh ở mã nguồn, như ba hồi quy phía trên.
   */
  const CSS = ma(doc('src/components/holdem/ShopManHinh.module.css'));
  it('⭐ không selector nào chọn `button` trơn là con của khung lá (`> * > button` phải kèm `[data-card]`)', () => {
    const tron = [...CSS.matchAll(/>\s*\*\s*>\s*button(?!\[data-card\])[^{]*\{/g)].map((m) => m[0].trim());
    expect(tron, 'chọn `button` trơn là kéo giãn cả (!) lẫn MUA (D427)').toEqual([]);
    // tự canh không rỗng: hai luật thật (lưới tài sản · hàng lõi) vẫn còn và nhắm đúng thân lá
    expect([...CSS.matchAll(/>\s*\*\s*>\s*button\[data-card\]/g)].length).toBeGreaterThanOrEqual(2);
  });
  it('GameCard: CHỈ thân lá mang `data-card` — bài quét trên đứng trên đúng điều này', () => {
    const TSX = ma(doc('src/components/holdem/GameCard.tsx'));
    expect([...TSX.matchAll(/data-card=/g)].length).toBe(1);
    expect(TSX).toMatch(/data-card=\{id\}/);
  });
});
