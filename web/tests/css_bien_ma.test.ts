/**
 * BIẾN CSS MA — mọi `var(--x)` dùng trong `web/src` phải được KHAI ở đâu đó.
 *
 * ⚠⚠ VÌ SAO BÀI NÀY TỒN TẠI: biến CSS không tồn tại KHÔNG làm build đỏ, không
 * làm tsc đỏ, không làm test component đỏ — nó chỉ lặng lẽ nuốt cả khai báo.
 * Repo đã dính HAI LẦN, và cả hai lần đều do founder chụp màn hình báo:
 *   · D74 (08/08) — `--neon` / `--text` chưa tồn tại ⇒ trong SVG biến hỏng rơi
 *     về `fill` ĐEN ⇒ radar đen thui trên nền tối;
 *   · 23/08 — `--surface-2` không tồn tại ⇒ `color-mix(…, var(--surface-2))`
 *     hỏng cả hàm ⇒ nền bong bóng Oracle rơi về TRONG SUỐT ⇒ chữ chồng chữ.
 * Hai lần cùng một lớp lỗi thì lần thứ ba là chuyện thời gian ⇒ quét cả lớp.
 *
 * Nguồn khai hợp lệ: bất kỳ `--x:` nào trong `web/src/**​/*.css` (tokens, base,
 * pixel, module CSS tự khai) + biến do JS đặt inline (`element.style.setProperty`
 * / `style={{ '--x': … }}`) — nhóm sau khai trong TSX nên quét cả `.tsx`.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function quetFile(thuMuc: string, duoi: string[]): string[] {
  const ra: string[] = [];
  const di = (d: string) => {
    for (const e of readdirSync(join(process.cwd(), d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) di(p);
      else if (duoi.some((x) => e.name.endsWith(x))) ra.push(p);
    }
  };
  di(thuMuc);
  return ra;
}

/**
 * ⚠⚠ NỢ CÓ SẴN — **33 chỗ, 13 tên**, TÌM RA bởi chính bài này ngày 24/08.
 * (Bản đầu ghi "21 chỗ / 12 tên" — đếm khi bộ quét còn bỏ sót. Sửa lại vì một
 * con số sai trong tài liệu làm người sau xếp ưu tiên theo nó.)
 * Nặng nhất: ShopManHinh 11 · AlphaDraftLobby 6 · **pixel.module.css 6** ·
 * AlphaDraftMatch 5 · HopXacNhan 2 · QuanTriVon 2 · Shop 1.
 *
 * Đây KHÔNG phải danh sách miễn trừ cho tương lai: nó là ảnh chụp những biến ma
 * đã sống trong repo TRƯỚC khi có bài canh. Mỗi tên ở đây là một khai báo CSS
 * đang bị trình duyệt nuốt im lặng — nặng nhất là `pixel.module.css`, nơi
 * `border: 1px solid var(--line)` và `border-color: var(--cyan)` khiến MỌI nút
 * pixel trong app mất viền và mất màu hover mà không ai thấy build đỏ.
 *
 * Vì sao chưa sửa ngay trong commit này: nó đổi DIỆN MẠO của gần như mọi màn,
 * mà phần lớn file liên quan (ShopManHinh · AlphaDraftMatch · KyNgo) đang được
 * một cửa sổ khác sửa cùng lúc (D67 — hai cửa sổ chung một thư mục). Sửa mù rồi
 * để founder phát hiện màu lạ là đổi một lỗi im lặng lấy một lỗi ồn ào.
 * ⚠ THÊM TÊN VÀO ĐÂY LÀ MỘT QUYẾT ĐỊNH, KHÔNG PHẢI MỘT CÚ SỬA TEST: biến ma mới
 * phải bị chặn ngay lúc viết, còn nếu cố ý muốn có giá trị lùi thì viết
 * `var(--x, <màu>)` — cách đó bài này vốn đã chấp nhận.
 *
 * ⚠⚠ 15/09 (D336) — MIỄN THEO (TỆP, TÊN), KHÔNG THEO TÊN. Bản cũ là `Set` các TÊN, nên
 * miễn `--neon-cyan` cho MỘT dòng ở `Shop.module.css` cũng là miễn nó cho mọi tệp viết SAU.
 * v43 (09/09) chép demo ngân hàng — demo tự khai `--neon-cyan` — sang `NganHang.module.css`:
 * sáu khai báo bị nuốt, bài này xanh, và founder phải tự thấy núm thanh kéo tiền trong suốt.
 * Miễn theo tệp thì một cú dùng mới của tên đã miễn vẫn đỏ ngay lúc viết.
 * `--neon-cyan` đã sửa về `--accent` ở cả hai tệp, nên nó rời danh sách.
 */
const NGOAI_LE: Readonly<Record<string, readonly string[]>> = {
  'src/components/holdem/HopXacNhan.module.css': ['--amber'],
  // 11/10 — AlphaDraftLobby.module.css VIẾT LẠI cho bento không-cuộn: sáu chỗ `--amber` biến mất cùng khối khẩu vị cũ ⇒ gỡ khỏi danh sách miễn (bài canh bên dưới đòi thế).
  // D443 — `--fs-num` đã gỡ khỏi đây: `.phiSo` về thang `--fs-human` (bài canh thang chữ màn trận bắt được).
  'src/screens/holdem/AlphaDraftMatch.module.css': ['--amber', '--red'],
  'src/styles/pixel.module.css': ['--amber'],
};

describe('CSS — không có biến ma', () => {
  it('⭐ mọi var(--x) trong web/src đều được khai ở đâu đó', () => {
    const cssFiles = quetFile('src', ['.css']);
    const tsxFiles = quetFile('src', ['.tsx', '.ts']);

    const khai = new Set<string>();
    for (const f of [...cssFiles, ...tsxFiles]) {
      const noi = readFileSync(join(process.cwd(), f), 'utf8');
      // Khai trong CSS: `--x: giá trị`. Khai trong JS: `'--x':` hoặc setProperty('--x'.
      for (const m of noi.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) khai.add(m[1]!);
      for (const m of noi.matchAll(/setProperty\(\s*['"](--[a-zA-Z0-9-]+)['"]/g)) khai.add(m[1]!);
      /*
       * JS đặt inline: `style={{ '--px': `${px}px` }}` — dấu nháy chen giữa TÊN và
       * dấu hai chấm nên regex trên trượt. Bỏ sót nhóm này thì bài đỏ hàng loạt vì
       * lý do sai, và một bài đỏ sai sẽ bị tắt đi (D79) — lúc đó nó thôi canh gì.
       */
      for (const m of noi.matchAll(/['"](--[a-zA-Z0-9-]+)['"]\s*:/g)) khai.add(m[1]!);
      /*
       * Và dạng khoá tính toán `['--bd' as string]: bd` (GameCard) — trong TS/TSX
       * một chuỗi `'--x'` gần như chỉ có một công dụng: đặt biến CSS.
       */
      if (f.endsWith('.ts') || f.endsWith('.tsx')) {
        for (const m of noi.matchAll(/['"](--[a-zA-Z0-9-]+)['"]/g)) khai.add(m[1]!);
      }
    }

    const thieu: string[] = [];
    for (const f of cssFiles) {
      const noi = readFileSync(join(process.cwd(), f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      /*
       * CHỈ bắt `var(--x)` KHÔNG có giá trị lùi. `var(--x, #123)` là cách khai
       * hợp lệ cho biến do NƠI DÙNG bơm vào: biến vắng thì rơi về màu dự phòng,
       * không nuốt cả khai báo. Bắt cả nhóm đó là báo động giả.
       */
      for (const m of noi.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)) {
        const ten = m[1]!;
        if (!khai.has(ten) && !(NGOAI_LE[f] ?? []).includes(ten)) thieu.push(`${f}: ${ten}`);
      }
    }

    expect(thieu, `Biến CSS chưa khai ở đâu cả — trình duyệt sẽ nuốt cả khai báo:\n${thieu.join('\n')}`)
      .toEqual([]);
  });

  it('⚠ danh sách miễn không giữ (tệp, tên) đã hết dùng — miễn rác che cú dùng lại sau này', () => {
    const rac: string[] = [];
    for (const [f, ds] of Object.entries(NGOAI_LE)) {
      const noi = readFileSync(join(process.cwd(), f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const ten of ds) if (!noi.includes(`var(${ten})`)) rac.push(`${f}: ${ten}`);
    }
    expect(rac, `đã sửa rồi thì gỡ khỏi NGOAI_LE:\n${rac.join('\n')}`).toEqual([]);
  });

  it('bong bóng Oracle có nền ĐỤC (chữ trang dưới không xuyên qua)', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/OracleChat.module.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    for (const lop of ['.bong {', '.dau {']) {
      const khoi = css.slice(css.indexOf(lop), css.indexOf('}', css.indexOf(lop)));
      const nen = khoi.match(/background:\s*([^;]+);/)?.[1] ?? '';
      expect(nen, `${lop} phải có nền`).not.toBe('');
      expect(nen, `${lop} không được dùng color-mix (một biến ma là hỏng cả hàm)`)
        .not.toMatch(/color-mix/);
      // rgba với alpha ≥ 0.9 hoặc màu đặc.
      const alpha = nen.match(/rgba\([^)]*,\s*([\d.]+)\s*\)/)?.[1];
      if (alpha !== undefined) {
        expect(Number(alpha), `${lop} nền phải đục ≥ 0.9`).toBeGreaterThanOrEqual(0.9);
      }
    }
  });
});
