import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/*
 * HEADER BẢO MẬT — KHOÁ NHỮNG CHỖ HỎNG IM LẶNG (dựng 11/08).
 *
 * ⚠⚠ CSP là loại cấu hình mà SAI THÌ KHÔNG AI THẤY NGAY. Header vẫn 200, trang
 * vẫn dựng, `curl` vẫn báo "đã áp" — chỉ có một phần app lặng lẽ chết trong
 * trình duyệt thật. Nên bài này không kiểm "có header không", nó kiểm ĐÚNG BỐN
 * chỗ mà bản soạn đầu tiên suýt hỏng, và cả bốn đều không lộ ra qua curl:
 *
 *   1. `font-src` thiếu `data:` ⇒ bộ chữ nhúng data URI của @fontsource bị chặn,
 *      trong đó có subset TIẾNG VIỆT ⇒ chữ có dấu tụt về font hệ thống. Trong
 *      một app tiếng Việt thì đây là hỏng thật, mà trang vẫn "chạy".
 *   2. `X-Frame-Options` ở tầng SPA ⇒ Discord Activity trắng iframe hoàn toàn.
 *      XFO không diễn đạt được allowlist nên MỌI giá trị của nó đều giết cửa đó.
 *   3. Luật khai ở `/` thay vì `/*` ⇒ mọi lối vào sâu (/vi, /shop, /keo/:id) do
 *      SPA fallback trả về KHÔNG có header. Curl `/` nói đã áp; sự thật là phần
 *      lớn lối vào thì không.
 *   4. `script-src` phải KHÔNG cần `'unsafe-inline'` — vite không sinh một byte
 *      script inline nào. Ngày nào nó cần thì đó là tín hiệu có thứ mới lọt vào
 *      vỏ trang, và bài này bắt buộc người sửa phải nhìn thấy điều đó.
 */

const goc = existsSync(resolve(process.cwd(), 'web/public/_headers'))
  ? process.cwd() : resolve(process.cwd(), '..');
const THO = readFileSync(resolve(goc, 'web/public/_headers'), 'utf8');

/*
 * ⚠ BỎ DÒNG CHÚ THÍCH TRƯỚC KHI KIỂM. Bản đầu của bài này quét cả file và ĐỎ vì
 * chính dòng chú thích "TUYỆT ĐỐI KHÔNG THÊM X-Frame-Options" — tức nó tố cáo
 * đúng câu văn dặn đừng làm điều đó. Một bài test báo động giả rồi sẽ bị ai đó
 * tắt đi, và lúc ấy nó không còn canh gì nữa.
 */
const DONG = THO.split(/\r?\n/).filter((d) => !d.trim().startsWith('#'));
const HEADERS = DONG.join('\n');

/** CSP của một khối đường dẫn trong `_headers`. */
function cspCua(duong: string): string {
  const i = DONG.findIndex((d) => d.trim() === duong);
  expect(i, `không tìm thấy khối "${duong}" trong _headers`).toBeGreaterThanOrEqual(0);
  for (let k = i + 1; k < DONG.length; k += 1) {
    const d = DONG[k]!;
    if (d.trim() === '' || !/^\s/.test(d)) break;      // hết khối
    const m = /^\s*Content-Security-Policy:\s*(.+)$/i.exec(d);
    if (m) return m[1]!.trim();
  }
  throw new Error(`khối "${duong}" không có Content-Security-Policy`);
}

const csp = cspCua('/*');
const chiThi = (ten: string): string => {
  const m = new RegExp(`(?:^|;)\\s*${ten}\\s+([^;]+)`).exec(csp);
  expect(m, `CSP thiếu chỉ thị ${ten}`).not.toBeNull();
  return m![1]!.trim();
};

/** Permissions-Policy của một khối đường dẫn trong `_headers` (D444). */
function ppCua(duong: string): string {
  const i = DONG.findIndex((d) => d.trim() === duong);
  expect(i, `không tìm thấy khối "${duong}" trong _headers`).toBeGreaterThanOrEqual(0);
  for (let k = i + 1; k < DONG.length; k += 1) {
    const d = DONG[k]!;
    if (d.trim() === '' || !/^\s/.test(d)) break;      // hết khối
    const m = /^\s*Permissions-Policy:\s*(.+)$/i.exec(d);
    if (m) return m[1]!.trim();
  }
  throw new Error(`khối "${duong}" không có Permissions-Policy`);
}

const pp = ppCua('/*');

describe('CSP của vỏ SPA', () => {
  it('⭐ font-src cho phép data: — bộ chữ tiếng Việt nhúng data URI', () => {
    // Sự thật này đến từ PHỤ THUỘC, không từ code ta viết: @fontsource nhúng
    // woff bằng data URI. Khoá ở đây để ai gỡ `data:` cho "gọn" phải trả lời.
    const pkg = JSON.parse(readFileSync(resolve(goc, 'web/package.json'), 'utf8'));
    const coFontsource = Object.keys(pkg.dependencies ?? {})
      .some((d) => d.startsWith('@fontsource'));
    expect(coFontsource, 'tiền đề của bài này đã đổi — kiểm lại nguồn font').toBe(true);
    expect(chiThi('font-src')).toContain('data:');
  });

  it('nếu đã build thì bản dựng THẬT xác nhận có font data:', () => {
    const thuMuc = resolve(goc, 'web/dist/assets');
    if (!existsSync(thuMuc)) return;                     // chưa build — bài trên đã đủ
    const css = readdirSync(thuMuc).filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(resolve(thuMuc, f), 'utf8')).join('');
    if (!css.includes('url(data:font')) return;          // dựng ra không nhúng thì thôi
    expect(chiThi('font-src')).toContain('data:');
  });

  it('⭐ KHÔNG có X-Frame-Options ở bất kỳ đâu (nó giết Discord Activity)', () => {
    expect(HEADERS).not.toMatch(/X-Frame-Options/i);
  });

  it('⭐ frame-ancestors cho phép Discord nhúng', () => {
    expect(chiThi('frame-ancestors')).toContain('discordsays.com');
  });

  /*
   * B8 (SPEC va-bao-mat-chuan-hoa-api-dot-1, founder A 19/10) — `*.discordsays.com` cho MỌI Activity của Discord nhúng app (và
   * `connect-src` cho chúng gọi). Ghim về đúng client id của app. `_headers` tĩnh nên không đọc env lúc build được ⇒ bài đối chiếu
   * với `web/.env` khi có (máy founder), trên CI (không có `.env`) chỉ đòi: không dấu sao + mọi chỗ cùng MỘT id dạng snowflake.
   * Tiêm ngược: trả lại `*.discordsays.com` ở một chỉ thị ⇒ đỏ; đổi id ở một chỗ ⇒ đỏ.
   */
  it('⭐ B8 — discordsays.com ghim đúng MỘT client id, không dấu sao', () => {
    expect(csp).not.toMatch(/\*\.discordsays\.com/);
    const ids = [...csp.matchAll(/(?:https|wss):\/\/([^./\s;]+)\.discordsays\.com/g)].map((m) => m[1]);
    expect(ids.length, 'connect-src (https + wss) + frame-ancestors').toBe(3);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toMatch(/^\d{17,20}$/);
    const env = resolve(goc, 'web/.env');
    const khai = existsSync(env) ? /^VITE_DISCORD_CLIENT_ID=(\d+)\s*$/m.exec(readFileSync(env, 'utf8'))?.[1] : undefined;
    if (khai) expect(ids[0], 'ID trong _headers lệch VITE_DISCORD_CLIENT_ID của web/.env').toBe(khai);
  });

  it('⭐ luật khai ở `/*`, không chỉ `/` (SPA fallback phục vụ mọi lối vào sâu)', () => {
    expect(DONG.some((d) => d.trim() === '/*')).toBe(true);
  });

  it('script-src KHÔNG cần unsafe-inline (vite không sinh script inline)', () => {
    expect(chiThi('script-src')).not.toContain('unsafe-inline');
    // Và tiền đề phải còn đúng: vỏ trang nguồn không có script inline nào.
    const html = readFileSync(resolve(goc, 'web/index.html'), 'utf8');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/gi)];
    expect(inline, 'vỏ trang đã có script inline — CSP phải được xét lại').toHaveLength(0);
  });

  it('ba header nền có mặt', () => {
    for (const h of ['X-Content-Type-Options', 'Referrer-Policy', 'Strict-Transport-Security']) {
      expect(HEADERS, `thiếu ${h}`).toContain(h);
    }
  });

  it('HSTS không kèm preload/includeSubDomains (cam kết khó rút lại)', () => {
    const m = /Strict-Transport-Security:\s*(.+)/i.exec(HEADERS)!;
    expect(m[1]!.toLowerCase()).not.toContain('preload');
    expect(m[1]!.toLowerCase()).not.toContain('includesubdomains');
  });
});

describe('Permissions-Policy của vỏ SPA (D444)', () => {
  it('khối /* có khai Permissions-Policy', () => {
    expect(pp.length).toBeGreaterThan(0);
  });

  it('camera / microphone / geolocation đều bị tắt hẳn — ()', () => {
    for (const f of ['camera', 'microphone', 'geolocation']) {
      const m = new RegExp(`(?:^|,)\\s*${f}=\\(([^)]*)\\)`).exec(pp);
      expect(m, `thiếu chỉ thị ${f}`).not.toBeNull();
      expect(m![1], `${f} phải là () — không origin nào được xin`).toBe('');
    }
  });

  it('⭐ web-share và clipboard-write KHÔNG bị chặn — app đang dùng share/clipboard thật', () => {
    // ⚠ Không chỉ kiểm "không có =()" — kiểm cả tên hoàn toàn KHÔNG xuất hiện,
    // để lỡ ai gõ `web-share=(self)` (tưởng vậy là "cho phép") cũng bị bắt:
    // luật ở _headers là ĐỪNG LIỆT KÊ, không phải "liệt kê rồi cho phép".
    expect(pp).not.toMatch(/web-share/);
    expect(pp).not.toMatch(/clipboard-write/);
  });
});
