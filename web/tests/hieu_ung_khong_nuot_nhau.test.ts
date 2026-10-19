/**
 * MỘT PHẦN TỬ, MỘT CHỦ CỦA `animation` — bộ canh cho CẢ LỚP LỖI, không cho
 * từng ca.
 *
 * ⚠⚠ VÌ SAO FILE NÀY TỒN TẠI. Rà 23/08 tìm ra **chín** hoạt ảnh chưa từng chạy
 * một khung hình nào, tất cả cùng một cơ chế: hai (hoặc năm) lớp cùng được dán
 * lên MỘT phần tử, và mỗi lớp khai thuộc tính rút gọn `animation`. CSS không
 * cộng dồn — lớp thắng chiếm TRỌN, lớp kia biến mất. Và thứ quyết định ai thắng
 * là **thứ tự trong bundle**, không phải thứ tự trong `className`:
 * `motion.module.css` và `pixel.module.css` nằm cuối bundle nên chúng luôn
 * thắng lớp cục bộ của component.
 *
 * Hỏng theo kiểu tệ nhất có thể:
 *   · CSS hợp lệ, `tsc` xanh, `lint:css-anim` xanh (keyframe CÓ người tham
 *     chiếu — chỉ là người ấy thua cascade);
 *   · lớp VẪN nằm trên DOM, nên soi bằng devtools cũng thấy "có mà";
 *   · và một nửa hiệu ứng vẫn chạy (phần đặt trên `::before`/`.art` là hộp
 *     khác) nên nhìn lướt thì thấy "có hiệu ứng", chỉ thiếu đúng tầng khung.
 *
 * Ba tầng canh dưới đây, mỗi tầng bắt một hình dạng khác nhau.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const GOC = process.cwd();
const doc = (p: string) => readFileSync(resolve(GOC, p), 'utf8');
const khongChuThich = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Mọi *.module.css dưới src/ — quét cả cây, không chép danh sách tay. */
function moiCss(): string[] {
  const ra: string[] = [];
  const di = (d: string) => {
    for (const t of readdirSync(resolve(GOC, d))) {
      const p = join(d, t);
      if (statSync(resolve(GOC, p)).isDirectory()) di(p);
      else if (t.endsWith('.module.css')) ra.push(p);
    }
  };
  di('src');
  return ra;
}

/** Một rule: tên lớp → thân + danh sách lớp nó `composes`. */
interface Rule { file: string; than: string; composes: { file: string; ten: string }[] }

/**
 * Đọc mọi rule một-lớp của mọi module, kèm quan hệ `composes` đã giải đường dẫn.
 * ⚠ Chỉ lấy selector ĐƠN (`.x { … }`): `composes` chỉ hợp lệ ở đó, và đây cũng
 * đúng là hình dạng sinh ra bug (hai tên lớp trên một phần tử).
 */
function docRule(): Map<string, Rule> {
  const bang = new Map<string, Rule>();
  for (const f of moiCss()) {
    const css = khongChuThich(doc(f));
    /*
     * ⚠ Bắt (selector, thân) rồi mới lọc, KHÔNG neo `(^|\})` phía trước.
     * Bản đầu neo như thế và bị ăn mất một nửa số rule: regex `g` chạy tiếp từ
     * sau NGUYÊN cụm đã khớp — tức đã nuốt luôn dấu `}` mà rule kế cần làm mốc.
     * Hai rule liền nhau thì cái thứ hai không bao giờ khớp, im lặng.
     */
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const sel = m[1]!.trim();
      const chiMotLop = /^\.[A-Za-z0-9_-]+$/.test(sel);
      if (!chiMotLop) continue;
      const ten = sel.slice(1);
      const than = m[2]!;
      const composes: { file: string; ten: string }[] = [];
      for (const c of than.matchAll(/composes:\s*([^;]+);/g)) {
        const phan = c[1]!.trim();
        const tuFile = /from\s+['"]([^'"]+)['"]/.exec(phan)?.[1];
        const tenLop = phan.replace(/from\s+['"][^'"]+['"]/, '').trim().split(/\s+/);
        for (const t of tenLop) {
          if (!t) continue;
          // `from '@/styles/x'` → `src/styles/x`; đường dẫn tương đối → giải theo file.
          const dich = tuFile
            ? (tuFile.startsWith('@/')
              ? join('src', tuFile.slice(2))
              : join(f, '..', tuFile))
            : f;
          composes.push({ file: dich.replace(/\\/g, '/'), ten: t });
        }
      }
      bang.set(`${f.replace(/\\/g, '/')}#${ten}`, { file: f, than, composes });
    }
  }
  return bang;
}

const coAnimation = (than: string) => /\banimation(-[a-z]+)?\s*:/.test(than);

describe('I. `composes` + `animation` — hai lớp tranh một thuộc tính', () => {
  it('⭐ rule nào `composes` một lớp CÓ animation thì không được tự khai `animation`', () => {
    /*
     * Hình dạng đắt nhất, vì nó SAI 100% số lần chứ không tuỳ thứ tự className:
     * `composes` sinh ra một tên lớp THỨ HAI trên cùng phần tử, và thuộc tính
     * `animation` không cộng dồn — một bên chiếm trọn.
     *
     * Ca thật đã bắt được:
     *   · `.laVao { composes: adTheVao; animation-delay: … }` — shorthand của
     *     `adTheVao` RESET luôn `animation-delay`, nên nhịp CHIA BÀI SO LE của
     *     D78 chết câm và cả 6 lá bay vào cùng lúc (đo trên stack: mọi lá `0s`);
     *   · `.sel { composes: adChiaXuong }` đứng cạnh `px.sang` — cú rơi bị nuốt.
     *
     * ⚠ PHẢI GIẢI CHUỖI `composes`, không được chỉ hỏi "có composes không":
     * bản đầu của bài này báo động giả ở `.oBap { composes: o; animation: … }`
     * — `.o` chỉ composes `khung` (khung hình, KHÔNG có animation) nên chẳng ai
     * tranh với ai. Một bài báo động giả rồi sẽ bị nới cho qua, và lúc đó nó
     * thôi canh gì (D79) — nên nó phải chính xác, không phải nghiêm khắc.
     */
    const bang = docRule();
    const coAnimSauKhiGiai = (khoa: string, tham = new Set<string>()): boolean => {
      if (tham.has(khoa)) return false;
      tham.add(khoa);
      const r = bang.get(khoa);
      if (!r) return false;
      if (coAnimation(r.than)) return true;
      return r.composes.some((c) => coAnimSauKhiGiai(`${c.file}#${c.ten}`, tham));
    };

    const pham: string[] = [];
    for (const [khoa, r] of bang) {
      if (!r.composes.length || !coAnimation(r.than)) continue;
      const dungDo = r.composes.filter((c) => coAnimSauKhiGiai(`${c.file}#${c.ten}`));
      if (dungDo.length) {
        pham.push(`${khoa} ⟂ ${dungDo.map((c) => `${c.file}#${c.ten}`).join(', ')}`);
      }
    }
    expect(pham, `composes một lớp CÓ animation rồi tự khai animation — một bên sẽ bị nuốt:\n${pham.join('\n')}`)
      .toEqual([]);
  });

  it('⭐ bài trên KHÔNG rỗng: bộ đọc thật sự thấy `composes` và thấy `animation`', () => {
    /*
     * Chốt chống xanh giả. Nếu `docRule()` trả rỗng (đổi cấu trúc thư mục, đổi
     * regex) thì bài trên xanh vĩnh viễn mà chưa từng quét gì.
     */
    const bang = docRule();
    expect(bang.size, 'không đọc được rule nào').toBeGreaterThan(200);
    expect([...bang.values()].filter((r) => r.composes.length).length,
      'không thấy `composes` nào').toBeGreaterThan(20);
    expect([...bang.values()].filter((r) => coAnimation(r.than)).length,
      'không thấy `animation` nào').toBeGreaterThan(20);
    // …và chuỗi phải giải được xuyên file: `.laVao` → motion `.adTheVao`.
    const laVao = bang.get('src/components/holdem/ShopManHinh.module.css#laVao');
    expect(laVao?.composes?.[0]?.file, '`composes … from` chưa giải được đường dẫn')
      .toBe('src/styles/motion.module.css');
  });
});

describe('II. Dải ô thị trường — cú LẬT và nhịp SỐNG phải ở hai phần tử', () => {
  const TSX = doc('src/components/holdem/MarketMap.tsx');
  const CSS = doc('src/components/holdem/MarketMap.module.css');

  it('⭐ cú lật (`latO`/`latSuKien`) dán lên KHUNG, không lên ô', () => {
    /*
     * Trước 23/08 cả hai dán lên `.o`, và cú lật (motion, cuối bundle) nuốt
     * BỐN thứ: `oThoNhe` (ô đang lật thở) · `skLua` · `skGiat` (Sập sàn GIẬT
     * NGANG — đúng họ "rung" founder hỏi) · `skNoiLen` (Bong bóng nổi lên).
     * Đo trên stack: `getComputedStyle` của ô đang lật trả về đúng `latSuKien`.
     */
    const than = khongChuThich(TSX);
    const khung = /s\.khung,[\s\S]{0,400}?mo\.(latSuKien|latO)/.test(than);
    expect(khung, 'cú lật không còn nằm trong khối `.khung`').toBe(true);

    // …và ô KHÔNG được nhận lớp lật nữa.
    const khoiO = /className=\{\[\s*s\.o,([\s\S]*?)\]\.filter/.exec(than)?.[1] ?? '';
    expect(khoiO, 'không tìm thấy khối className của ô').not.toBe('');
    expect(khoiO, 'ô vẫn nhận `mo.latO`/`mo.latSuKien` ⇒ nó lại nuốt nhịp sống')
      .not.toMatch(/mo\.lat/);
  });

  it('⭐ `.nay` không composes hoạt ảnh nào (cú lật thứ ba, chưa từng thắng)', () => {
    expect(/\.nay \{[^}]*composes:/.test(khongChuThich(CSS)),
      '`.nay` composes lại một lớp lật ⇒ ba hoạt ảnh tranh một chỗ').toBe(false);
  });

  it('nhịp SỐNG + tính cách vẫn khai trên ô (không bị dọn nhầm khi tách tầng)', () => {
    const css = khongChuThich(CSS);
    expect(css, 'mất nhịp thở của ô đang lật').toMatch(/\.nay \{[^}]*animation:[^}]*oThoNhe/);
    // D393: cú giật ngang của Sập sàn (`skLoi`) đã gỡ cùng tên tin — xem the_co_tinh_cach.
    expect(css, 'mất cú NỔI LÊN của Bong bóng').toMatch(/\.skPhong \{[^}]*skNoiLen/);
  });
});

describe('III. Shop — lớp phủ và lá không bị cướp `animation`', () => {
  const TSX = khongChuThich(doc('src/components/holdem/ShopManHinh.tsx'));
  const CSS = khongChuThich(doc('src/components/holdem/ShopManHinh.module.css'));

  it('⭐⭐ KHÔNG cú rung nào dịch cả lớp phủ khi đặt chip', () => {
    /*
     * ⚠ BÀI NÀY ĐÃ LẬT CHIỀU 24/08 — trước đó nó ĐÒI có cú rung, nay nó CẤM.
     * Giữ bài thay vì xoá, vì thứ cần canh không biến mất mà chỉ đổi dấu: cú
     * rung dán lên `.phu` đã mọc lại HAI LẦN (lớp CSS `.rungNhe`, rồi WAAPI
     * `rungShop`). Xoá bài đi thì lần thứ ba không ai chặn.
     *
     * Vì sao cấm (founder 24/08: *"khựng rung 1 nhịp lỗi làm màn hình bị
     * chuyển khung và ko nhìn rõ chip chuyển lên bàn"*): `.phu` là
     * `position: fixed; inset: 0`, nên rung nó là rung CẢ KHUNG MÀN chứ không
     * phải cái nút vừa bấm; và `bayChip` chụp toạ độ NGAY sau đó, nên đàn chip
     * bay theo một đường tính từ hệ quy chiếu ĐANG RUNG. Chip bay LÀ phản hồi
     * của cú đi vốn — rung cái nền phía sau là che đúng nó.
     */
    expect(CSS, 'lớp `.rungNhe` quay lại ⇒ nó sẽ cướp `animation` của `.phu`')
      .not.toMatch(/^\.rungNhe\s*\{/m);
    expect(TSX, 'lớp phủ lại nhận một lớp rung').not.toMatch(/s\.rungNhe/);
    expect(TSX, 'cú rung toàn lớp phủ đã mọc lại').not.toMatch(/rungShop/);
    // Cấm cả đường vòng: một WAAPI đặt thẳng lên ref của chính lớp phủ.
    expect(TSX, '`phuRef` sống lại ⇒ gần như chắc chắn để rung lớp phủ')
      .not.toMatch(/phuRef/);
  });

  it('⭐ phản hồi của cú đặt chip vẫn còn — chip bay, và bay TRÊN lớp phủ', () => {
    /*
     * Vế bắt buộc đi kèm: gỡ cú rung mà không canh cái thay nó thì lần dọn sau
     * có thể gỡ nốt `bayChip`, và cú đi vốn thành KHÔNG có phản hồi nào. Khoá
     * ba mắt xích: có gọi · đích là lá đang cược · chip nằm TRÊN lớp phủ.
     */
    expect(TSX, 'mất đàn chip bay ⇒ đi vốn không còn phản hồi nào').toMatch(/bayChip\(/);
    expect(TSX, 'chip không còn bay tới lá đang cược').toMatch(/data-card=/);
    const bay = /^\.bay \{([^}]*)\}/m.exec(CSS)?.[1] ?? '';
    expect(bay, 'không tìm thấy `.bay`').not.toBe('');
    const zBay = Number(/z-index:\s*(\d+)/.exec(bay)?.[1] ?? 0);
    const zPhu = Number(/^\.phu \{[\s\S]*?z-index:\s*(\d+)/m.exec(CSS)?.[1] ?? 70);
    expect(zBay, 'chip bay chui XUỐNG DƯỚI lớp phủ ⇒ không ai nhìn thấy nó')
      .toBeGreaterThan(zPhu);
  });

  it('⭐ nhịp CHIA BÀI SO LE và nhịp KHOÁ CỌC thắng được lớp composed', () => {
    /*
     * Cả hai chỉ được dán KÈM `.laVao`, mà `.laVao` composes `adTheVao` —
     * shorthand của lớp composed reset `animation-delay` và chiếm `animation`.
     * Nhân đôi lớp đẩy độ ưu tiên lên (0,2,0) nên thắng bất kể thứ tự file.
     */
    expect(CSS, 'độ trễ so le lại đi bằng selector một lớp ⇒ bị reset về 0s')
      .toMatch(/\.laVao\.laVao \{[^}]*animation-delay/);
    expect(CSS, 'nhịp khoá cọc lại đi bằng selector một lớp ⇒ không bao giờ chạy')
      .toMatch(/\.laKhoa\.laKhoa \{[^}]*animation:/);
  });

  it('chip bay được dọn khi shop rời màn', () => {
    expect(TSX, 'thiếu đường dọn ⇒ chip vàng bay ngang qua màn KẾT QUẢ VÒNG')
      .toMatch(/donChipBay\s*\(\s*\)/);
  });
});

describe('IV. Lá bài — cú RƠI XUỐNG và cú LOÉ nằm chung một danh sách', () => {
  it('⭐ không lớp loé riêng nào được dán cạnh `.sel`', () => {
    const tsx = khongChuThich(doc('src/components/holdem/GameCard.tsx'));
    expect(tsx, '`px.sang` quay lại ⇒ nó nuốt cú rơi-xuống-ô của `.sel`')
      .not.toMatch(/px\.sang/);
  });
});

describe('V. Tiết kiệm chuyển động — off-switch phải đủ mạnh', () => {
  it('⭐ mọi selector BẬT hoạt ảnh của thanh phong cách đều có mặt ở khối tắt', () => {
    /*
     * Lỗ đã có thật: quầng được bật ở `.fx_chay .quang` (0,2,0) nhưng tắt bằng
     * `.quang` (0,1,0) ⇒ THUA về độ ưu tiên, quầng vẫn thở vô hạn ở cả ba bậc
     * cháy. Và dải cầu vồng `.fx_cau_vong .fx::before` thiếu hẳn khỏi danh sách.
     * Bài này so HAI DANH SÁCH thay vì liệt kê tay, nên thêm hoạt ảnh mới mà
     * quên tắt là đỏ ngay.
     */
    const css = doc('src/components/holdem/ThanhPhongCach.module.css');
    const i = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(i, 'không có khối giảm chuyển động').toBeGreaterThan(0);
    const tren = khongChuThich(css.slice(0, i));
    /*
     * ⚠ Bóc lớp vỏ `@media (...) {` trước khi quét: nếu để nguyên thì cụm
     * `([^{}]+)\{([^}]*)\}` khớp CHÍNH dòng at-rule làm "selector" và nuốt thân
     * rule đầu tiên làm "thân" — mọi rule sau đó lệch một nhịp và tập tắt ra
     * RỖNG. (Bắt được bằng chốt `tat.size > 3` ngay dưới.)
     */
    const duoi = khongChuThich(css.slice(css.indexOf('{', i) + 1));

    /*
     * ⚠⚠ SO HAI TẬP SELECTOR, KHÔNG `includes` TRÊN CẢ KHỐI.
     * Bản đầu của bài này hỏi `duoi.includes('.fx_chay .quang')` — và nó XANH
     * GIẢ, chứng minh bằng tiêm lỗi: gỡ `.fx_chay .quang` khỏi danh sách tắt mà
     * bài vẫn đậu, vì chuỗi ấy còn xuất hiện ở một rule KHÁC trong cùng khối
     * (`.fx_chay .quang { opacity: .14 }`). Phải gom đúng selector của những
     * rule CÓ `animation: none`.
     */
    const gomSel = (nguon: string, loc: (than: string) => boolean) => {
      const ra = new Set<string>();
      for (const m of nguon.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        if (!loc(m[2]!)) continue;
        for (const sel of m[1]!.split(',')) {
          const s = sel.trim().replace(/\s+/g, ' ');
          if (s.startsWith('.')) ra.add(s);
        }
      }
      return ra;
    };

    const bat = gomSel(tren, (t) => /\banimation\s*:/.test(t));
    const tat = gomSel(duoi, (t) => /\banimation\s*:\s*none/.test(t));
    expect(bat.size, 'không tìm thấy selector nào bật animation').toBeGreaterThan(3);
    expect(tat.size, 'không tìm thấy selector nào bị tắt').toBeGreaterThan(3);

    const thieu = [...bat].filter((s) => !tat.has(s));
    expect(thieu, `bật hoạt ảnh mà khối reduced-motion không tắt ĐÚNG selector đó:\n${thieu.join('\n')}`)
      .toEqual([]);
  });
});

describe('VI. Hoạt ảnh VÔ HẠN nhân theo SỐ GHẾ chỉ được đụng transform/opacity', () => {
  it('⭐ fx cảm xúc của dải ghế không animate `box-shadow`/`filter`', () => {
    /*
     * ⚠ VÌ SAO CHỈ CANH DẢI GHẾ, KHÔNG CANH CẢ REPO: quét toàn bộ thì còn 11 chỗ
     * chạy keyframe đụng `box-shadow`/`filter` vô hạn, và phần lớn HỢP LỆ —
     * `dhvDap` của đồng hồ là `steps(1, end)`, blur 0 (spread thuần), trên một
     * hộp ~90×20px, tức đổi giá trị đúng 2 lần mỗi 0,9s. Một bài cấm tất sẽ đỏ
     * ngay từ lúc viết, và một bài đỏ sẵn thì người sau tắt nó đi (D79).
     *
     * Dải ghế thì khác về BẢN CHẤT, và đó là lý do nó đáng một luật riêng: hiệu
     * ứng ở đây NHÂN THEO SỐ GHẾ (tới 8), chạy `ease-in-out` (đổi giá trị mỗi
     * khung hình chứ không vài nấc), và chạy SUỐT TRẬN. `box-shadow` không nằm
     * trên luồng hợp thành nên mỗi nhịp là một lượt vẽ lại trọn ô ghế — viền,
     * avatar 32px và năm dòng chữ.
     * ⇒ Quầng phải là một VẬT có sẵn bóng, và chỉ `opacity` được động.
     */
    const css = doc('src/components/holdem/DoiThuStrip.module.css');
    const than = khongChuThich(css);

    const dungKf = new Set<string>();
    for (const m of than.matchAll(/animation:\s*([^;]+);/g)) {
      for (const k of m[1]!.matchAll(/\b([a-zA-Z][\w-]*)\b(?=\s+[\d.]+m?s)/g)) {
        dungKf.add(k[1]!);
      }
    }
    expect(dungKf.size, 'không đọc được keyframe nào ⇒ bài này rỗng')
      .toBeGreaterThan(1);

    for (const m of than.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)) {
      const [, ten, body] = m;
      if (!dungKf.has(ten!)) continue;   // keyframe không ai chạy thì không tính
      expect(body!, `\`${ten}\` animate box-shadow — nhân theo số ghế, repaint cả ô`)
        .not.toMatch(/box-shadow\s*:/);
      expect(body!, `\`${ten}\` animate filter — không map sang RN/Flutter`)
        .not.toMatch(/filter\s*:/);
    }
  });

  it('⭐ nhãn chữ dưới bản đồ không mang nhịp thở `filter` vô hạn', () => {
    /*
     * `.telegraph` từng composes `adTho` = `filter: brightness` vô hạn, trên 1–3 KHỐI
     * CHỮ, suốt cả trận — và nhịp sáng ấy không chở một bit thông tin nào (nội dung
     * telegraph đứng yên). ⚠ Chính MarketMap.module.css có câu tự kiểm khai *"ngoại lệ
     * DUY NHẤT là `filter: brightness` của lửa"* — câu đó SAI suốt thời gian dòng ấy tồn tại.
     *
     * 13/09 tối: mọi hộp chữ dưới bản đồ đã GỠ (founder: *"đừng thêm mấy phần chú thích
     * trực tiếp ra màn hình"*) — nay chỉ còn cặp nhãn ngắn `.cs*` TRÊN CHÍNH Ô. Bài giữ
     * nguyên mục đích: một nhãn chữ nhỏ thì tuyệt đối không được thở bằng `filter`, và
     * khối chữ cũ không được dựng lại.
     */
    const css = khongChuThich(doc('src/components/holdem/MarketMap.module.css'));
    expect(css, 'hộp chữ `.telegraph` dựng lại dưới bản đồ').not.toMatch(/\.telegraph\s*\{/);
    const cs = /\.cs \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(cs, 'không tìm thấy `.cs` — cặp kỳ vọng/thực trên ô').not.toBe('');
    expect(cs, 'nhịp thở `filter` quay lại trên nhãn chữ').not.toMatch(/composes:|animation/);
  });

  it('⭐ đèn rọi màn tập hãm bằng `steps()` — nó tô lại CẢ MÀN mỗi khung hình', () => {
    /*
     * `.lo` mang `box-shadow: 0 0 0 200vmax` (nhuộm đen phần còn lại), nên vùng
     * phải vẽ lại đúng bằng CẢ MÀN HÌNH. Trước 24/08 nó transition BỐN thuộc
     * tính BỐ CỤC (left/top/width/height) với đường cong mặc định — chỗ duy nhất
     * trong repo animate thuộc tính bố cục mà không hãm số lần.
     */
    const css = khongChuThich(doc('src/components/holdem/CoachTap.module.css'));
    const khoi = /\.lo \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(khoi, 'không tìm thấy `.lo`').not.toBe('');
    const tr = /transition:([^;]*);/.exec(khoi)?.[1] ?? '';
    expect(tr, 'không có transition nào').not.toBe('');
    for (const t of ['left', 'top', 'width', 'height']) {
      expect(tr, `\`${t}\` chưa hãm bằng steps()`)
        .toMatch(new RegExp(`${t}\\s+[\\d.]+m?s\\s+steps\\(`));
    }
  });
});
