/**
 * §XI — PIXEL FRAME / BUTTON / ANIMATION.
 *
 * Ba luật, và cả ba đều là thứ tách "modern pixel" khỏi "web bo góc thông thường":
 *   1. KHÔNG `border-radius` — góc bo có đường cong, lưới pixel chỉ có bậc.
 *   2. Bóng CỨNG (blur = 0) — pixel art đổ bóng bằng khối đặc dịch đi vài pixel.
 *   3. `steps()` chứ không `cubic-bezier` — chuyển động pixel nhảy theo nấc.
 *
 * ⚠ LUẬT 3 LÀ LUẬT DỄ MẤT NHẤT, và đã mất một lần thật: `composes` đưa lớp pixel
 * vào TRƯỚC, nên file dùng khai lại `transition` là ghi đè im lặng. Đo được trên
 * nút thật: góc khấc và bóng cứng vẫn đúng, mà nhịp là `cubic-bezier(0.34, 1.56…)`
 * — nhìn thì pixel, chuyển động thì vẫn trượt mượt. Không có test này thì lần sau
 * ai thêm một dòng `transition` là luật lại rơi mà build vẫn xanh.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Đọc file và BỎ COMMENT trước khi quét.
 *
 * ⚠ Không bỏ comment thì test bắt phải chữ trong chính docstring: `pixel.module.css`
 * viết "steps(), KHÔNG cubic-bezier" để giải thích luật, và bản đầu của test này
 * báo đỏ vì tưởng đó là một khai báo CSS. Một test bắt phải lời giải thích về luật
 * mà nó đang canh thì nó đang đo văn bản, không đo code.
 */
const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const PIXEL = doc('src/styles/pixel.module.css');
/** Những file ĐÃ chuyển sang nguyên thuỷ pixel — phải giữ luật. */
/*
 * QUÉT TOÀN BỘ, KHÔNG DÙNG DANH SÁCH TRẮNG.
 *
 * Bản trước liệt kê đích danh 2 file "đã pixel hoá" rồi chỉ kiểm mấy file đó.
 * Danh sách trắng canh được HIỆN TẠI nhưng không canh được TƯƠNG LAI: màn viết
 * sau không có tên trong danh sách nên bo góc thoải mái mà test vẫn xanh —
 * đúng kiểu §XI từng bị bỏ qua im lặng một lần rồi.
 *
 * Nay quét mọi `*.module.css` dưới `src/`. Thêm file mới là tự động bị canh.
 */
function moiCss(): string[] {
  const ra: string[] = [];
  const di = (d: string) => {
    for (const e of readdirSync(join(process.cwd(), d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) di(p);
      else if (e.name.endsWith('.css')) ra.push(p);
    }
  };
  di('src');
  return ra;
}

describe('§XI — nguyên thuỷ pixel', () => {
  it('LUẬT 1 — nguyên thuỷ dùng clip-path, KHÔNG border-radius', () => {
    expect(PIXEL).toContain('clip-path: polygon(');
    // `border-radius: 0` là hợp lệ (chủ động khử); giá trị khác thì không.
    const bo = PIXEL.match(/border-radius:\s*([^;]+);/g) ?? [];
    for (const d of bo) expect(d, `"${d}" — góc bo trên khung pixel`).toMatch(/:\s*0/);
  });

  it('LUẬT 2 — mọi box-shadow của nút đều blur = 0', () => {
    /*
     * Bắt dạng `<x> <y> <blur>` với blur khác 0. Bóng nhoè là bóng của vật cong
     * dưới ánh sáng mềm — sai hệ với pixel, và làm nút mất cảm giác "khối".
     */
    const nhoe = PIXEL.match(/box-shadow:[^;]*?\d+px\s+\d+px\s+[1-9]\d*px/g) ?? [];
    expect(nhoe, `bóng còn blur: ${nhoe.join(' | ')}`).toEqual([]);
  });

  it('LUẬT 3 — chuyển động dùng steps(), không cubic-bezier', () => {
    expect(PIXEL).toContain('steps(');
    expect(PIXEL, 'cubic-bezier trong nguyên thuỷ pixel').not.toContain('cubic-bezier');
  });

  /*
   * Lỗi ĐÃ XẢY RA THẬT: BetBar `composes: nut` rồi khai lại `transition` ngay
   * dưới. Nút nhìn thì pixel (góc khấc, bóng cứng đều đúng) mà nhịp vẫn là
   * cubic-bezier — build xanh, không một cảnh báo nào. Quét cả cây, không chỉ
   * mấy file có tên trong danh sách.
   */
  it('file composes lớp pixel KHÔNG được khai lại cubic-bezier (ghi đè im lặng)', () => {
    const pham: string[] = [];
    for (const f of moiCss()) {
      const css = doc(f);
      if (!css.includes("from '@/styles/pixel.module.css'")) continue;
      if (css.includes('cubic-bezier')) pham.push(f);
    }
    expect(pham, `khai lại cubic-bezier, sẽ ghi đè steps(): ${pham.join(' | ')}`)
      .toEqual([]);
  });

  /*
   * CHỐT CHỐNG XANH GIẢ. Hai test dưới đây quét `moiCss()`; nếu hàm đó trả mảng
   * rỗng (sai đường dẫn, đổi cấu trúc thư mục) thì CẢ HAI đều xanh mà không hề
   * kiểm gì. Đã dính đúng bẫy này một lần trong phiên: một test route xanh chỉ
   * vì component crash trước khi tới chỗ cần kiểm.
   */
  it('moiCss() thật sự quét ra file — chống test xanh rỗng', () => {
    const ds = moiCss();
    expect(ds.length, 'không quét ra file CSS nào').toBeGreaterThan(30);
    expect(ds).toContain('src/styles/pixel.module.css');
  });

  it('KHÔNG file CSS nào còn border-radius khác 0 (trừ 50% = avatar tròn)', () => {
    const pham: string[] = [];
    for (const f of moiCss()) {
      const css = doc(f).replace(/\/\*[\s\S]*?\*\//g, '');
      for (const d of css.match(/border-radius:\s*([^;]+);/g) ?? []) {
        if (!/:\s*(0|50%)/.test(d)) pham.push(`${f} → ${d.trim()}`);
      }
    }
    expect(pham, `còn bo góc: ${pham.join(' | ')}`).toEqual([]);
  });

  /*
   * Bảy token bo góc phải ĐỀU BẰNG 0. Đây là lưới an toàn cuối: ai quen tay
   * viết `var(--radius-card)` thì nhận 0 chứ không nhận 22px của bản cũ.
   */
  it('token --radius-* đều bằng 0', () => {
    const tk = doc('src/styles/tokens.css');
    const xau = (tk.match(/--radius-[a-z]+:\s*([^;]+);/g) ?? [])
      .filter((d) => !/:\s*0(px)?;/.test(d));
    expect(xau, `token chưa vuông: ${xau.join(' | ')}`).toEqual([]);
  });
});

describe('§XII — pháo giấy chỉ khi thắng, và tự dọn', () => {
  const SRC = doc('src/components/holdem/PhaoGiay.tsx');

  it('tôn trọng reduced-motion — không render hạt nào', () => {
    expect(SRC).toContain('useReducedMotion');
    expect(SRC).toMatch(/if \(!bat \|\| itMotion\)/);
  });

  it('tự dọn hạt sau khi rơi — không để lại rác DOM', () => {
    expect(SRC).toContain('setHat([])');
    expect(SRC).toContain('clearTimeout');
  });

  it('hạt là Ô VUÔNG — không border-radius, không hình tròn', () => {
    expect(SRC).not.toContain('borderRadius');
    expect(PIXEL).toMatch(/\.hat\s*\{[^}]*width:\s*\d+px/);
  });
});

describe('§XI — icon phải CÓ CHIỀU SÂU, không phải sticker tô phẳng', () => {
  /*
   * Founder 30/08: *"tìm hướng giải quyết vụ màu 3d đi"*.
   *
   * Đo trước khi làm: art thẻ 80×60 dùng 2,69–3,28 / 4 sắc độ mỗi họ và 0% lá tô
   * phẳng — nó ĐÃ 3D. Lớp icon thì 1,74 / 4 và **64% lưới tô phẳng hoàn toàn**.
   * D185 bù đủ 4 sắc độ mỗi họ vào BANG_MAU, D187 đổ bóng 24/33 lưới bằng
   * `npm run pixel:sau` (đèn TRÊN-TRÁI, khớp bóng cứng 3px 3px 0 của §XI).
   *
   * Bài này canh KHOẢN ĐẦU TƯ ĐÓ. Không có nó thì một cú "dọn màu cho gọn" hoặc
   * một lượt vẽ lại bằng tay có thể ép icon về phẳng, và không gì báo — đúng lớp
   * hỏng-im-lặng mà file này tồn tại để chặn.
   *
   * ⚠ Ngưỡng đặt DƯỚI mức đang có một quãng rộng, cố ý: nó chặn cú TỤT VỀ PHẲNG,
   * không khoá con số hiện tại. Vẽ lại một icon cho đẹp hơn thì không được đỏ.
   */
  const ICON = doc('src/components/ui/PixelIcon.tsx');
  const LUOI = doc('../config/pixel_luoi.ts');

  /** ký tự màu → tên họ, đọc từ chú thích `// ── tên họ` của BANG_MAU (một nguồn). */
  const hoCua = (() => {
    const khoi = LUOI.match(/export const BANG_MAU[\s\S]*?\n\};/)?.[0] ?? '';
    const cua: Record<string, string> = {};
    let ten = '?';
    for (const dong of khoi.split('\n')) {
      const c = dong.match(/──\s*([^(\n*]+)/);
      if (c && !dong.includes('*/')) { ten = c[1]!.trim(); continue; }
      if (dong.trimStart().startsWith('*')) continue;
      for (const m of dong.matchAll(/(\w):\s*'#/g)) cua[m[1]!] = ten;
    }
    return cua;
  })();

  const luoiIcon = () => {
    const khoi = ICON.match(/const GRIDS[\s\S]*\n\};/)![0];
    return [...khoi.matchAll(/(\w+):\s*\[([\s\S]*?)\n\s*\]/g)].map((m) => ({
      ten: m[1]!,
      o: [...m[2]!.matchAll(/'([^']*)'/g)].map((x) => x[1]!),
    }));
  };

  it('bảng họ đọc được — nếu không thì hai bài dưới xanh GIẢ', () => {
    // Bộ đọc hỏng thì mọi ô rơi vào họ '?' và phép đếm sắc độ thành vô nghĩa.
    expect(Object.keys(hoCua).length, 'không đọc được ký tự màu nào').toBeGreaterThan(30);
    expect(new Set(Object.values(hoCua)).size, 'phải đọc ra nhiều họ').toBeGreaterThan(5);
  });

  it('⭐ phần lớn icon KHÔNG còn tô phẳng', () => {
    const ds = luoiIcon();
    const phang = ds.filter(({ o }) => {
      const theoHo: Record<string, Set<string>> = {};
      for (const d of o) for (const c of d) {
        const h = hoCua[c];
        if (!h) continue;
        (theoHo[h] ??= new Set<string>()).add(c);
      }
      const sac = Object.values(theoHo).map((s) => s.size);
      return sac.length > 0 && sac.every((n) => n <= 1);
    });
    // Trước D187: 64% lưới có mọi họ ≤2 sắc. Ngưỡng dưới đây bắt cú tụt về
    // MỘT sắc mỗi họ — tức phẳng tuyệt đối, không còn chỗ nào đổ bóng.
    expect(
      phang.length,
      `${phang.length}/${ds.length} lưới tô phẳng tuyệt đối: ${phang.map((x) => x.ten).join(', ')}`,
    ).toBeLessThanOrEqual(6);
  });

  it('⭐ độ sâu trung bình không được tụt về mức trước khi đổ bóng', () => {
    const ds = luoiIcon();
    let tong = 0;
    let dem = 0;
    for (const { o } of ds) {
      const theoHo: Record<string, Set<string>> = {};
      for (const d of o) for (const c of d) {
        const h = hoCua[c];
        if (!h) continue;
        (theoHo[h] ??= new Set<string>()).add(c);
      }
      const sac = Object.values(theoHo).map((s) => s.size);
      if (!sac.length) continue;
      tong += sac.reduce((a, b) => a + b, 0) / sac.length;
      dem += 1;
    }
    const tb = tong / dem;
    // Đo lúc chốt: 2,26 / 4 (trước khi đổ bóng: 1,74). Sàn 2,0 nằm giữa hai mốc.
    expect(tb, `sắc độ TB mỗi họ tụt còn ${tb.toFixed(2)} — icon đang bị làm phẳng lại`)
      .toBeGreaterThan(2);
  });
});
