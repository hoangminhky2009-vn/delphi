/**
 * TOTP (RFC 6238) — mã hai lớp cho tài khoản admin.
 *
 * ─── VÌ SAO TỰ VIẾT, VÀ THỨ TỰ VIẾT KHÔNG PHẢI MẬT MÃ ────────────────────────
 * "Đừng tự viết mật mã" là mặc định đúng. Ở đây nó không áp dụng, vì phần tự
 * viết KHÔNG PHẢI nguyên hàm mật mã:
 *   · Nguyên hàm là HMAC-SHA1 — lấy từ `node:crypto`, bản đã được kiểm chứng.
 *   · Phần tự viết là SỐ HỌC theo một đặc tả công khai: chia thời gian thành
 *     bước 30 giây · đóng bộ đếm big-endian 8 byte · cắt động theo offset ·
 *     chia lấy dư ra N chữ số.
 *   · RFC 6238 Phụ lục B CÔNG BỐ SẴN bảng test vector ⇒ tính đúng đắn chứng
 *     minh được bằng ground truth, đúng cách A5.2 khoá công thức tiền bằng số
 *     tính tay. Không có bảng đó thì đã không tự viết.
 *   · Và đây là CỬA ADMIN — chỗ đáng ngại nhất để cắm thêm một mắt xích chuỗi
 *     cung ứng. Nhất quán với D17a: thư viện cho NGUYÊN HÀM (argon2), tự viết
 *     phần GHÉP (giao thức phiên).
 *
 * Năm điều kiện founder đặt khi duyệt (thiếu một là quay về dùng thư viện):
 *   1. HMAC từ `node:crypto`, tuyệt đối không tự cài.          → `createHmac`
 *   2. Nghiệm thu bằng đúng bảng RFC 6238 Phụ lục B.           → tests/totp.test.ts
 *   3. So sánh bằng `timingSafeEqual`.                         → `khopMa`
 *   4. Bí mật `randomBytes(20)` (160 bit, RFC 4226).           → `sinhBiMat`
 *   5. Chống dùng lại mã.                                      → `timBuocKhop` trả BƯỚC
 *
 * ⚠⚠ BÍ MẬT TOTP KHÔNG BĂM ĐƯỢC — và đây là chỗ người quen argon2 hay đi sai
 * theo quán tính. Nó là BÍ MẬT CHIA SẺ: máy chủ phải giữ được bản gốc để tự
 * tính ra mã mà so. Băm nó xong thì không còn đường xác minh. Nó nằm trong DB ở
 * dạng đọc được, và điều đó chấp nhận được vì ai đọc được DB thì đã sở hữu toàn
 * bộ hệ thống rồi (cùng lý lẽ với đường thoát `admin_reset_2fa`).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Độ dài một bước thời gian (giây) — X trong RFC 6238. */
export const BUOC_GIAY = 30;

/* ══════════════════════════════════════════════════════════════════════════
 * BASE32 (RFC 4648) — dạng chuẩn để trao bí mật cho ứng dụng xác thực
 * ══════════════════════════════════════════════════════════════════════════ */

const BANG_CHU = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Ma(du: Buffer): string {
  let bit = 0;
  let gom = 0;
  let ra = '';
  for (const b of du) {
    gom = (gom << 8) | b;
    bit += 8;
    while (bit >= 5) {
      ra += BANG_CHU[(gom >>> (bit - 5)) & 31];
      bit -= 5;
    }
  }
  if (bit > 0) ra += BANG_CHU[(gom << (5 - bit)) & 31];
  return ra;
}

export function base32Giai(s: string): Buffer {
  // Bỏ đệm '=' và dấu cách người dùng hay chép kèm; chữ thường vẫn nhận.
  const sach = s.replace(/[\s=]/g, '').toUpperCase();
  let bit = 0;
  let gom = 0;
  const ra: number[] = [];
  for (const c of sach) {
    const v = BANG_CHU.indexOf(c);
    if (v < 0) throw new Error(`Ký tự base32 không hợp lệ: ${c}`);
    gom = (gom << 5) | v;
    bit += 5;
    if (bit >= 8) {
      ra.push((gom >>> (bit - 8)) & 0xff);
      bit -= 8;
    }
  }
  return Buffer.from(ra);
}

/* ══════════════════════════════════════════════════════════════════════════
 * LÕI
 * ══════════════════════════════════════════════════════════════════════════ */

/** Bí mật mới: 160 bit theo khuyến nghị RFC 4226 §4, trả dạng base32. */
export function sinhBiMat(): string {
  return base32Ma(randomBytes(20));
}

/** Bước thời gian hiện tại. `now` tính bằng mili-giây. */
export function buocCua(now: number = Date.now()): number {
  return Math.floor(now / 1000 / BUOC_GIAY);
}

/**
 * Sinh mã cho MỘT bước (HOTP với counter = bước — RFC 4226 §5.3).
 *
 * `soChuSo` để tham số hoá được CHỈ vì bảng RFC 6238 Phụ lục B dùng 8 chữ số:
 * test phải so với đúng con số trong đặc tả, không phải với bản 6 chữ số đã cắt
 * bớt do chính ta suy ra. Đời thật luôn dùng mặc định 6.
 */
export function sinhMa(biMatBase32: string, buoc: number, soChuSo = 6): string {
  const khoa = base32Giai(biMatBase32);
  const dem = Buffer.alloc(8);
  dem.writeBigUInt64BE(BigInt(buoc));
  const bam = createHmac('sha1', khoa).update(dem).digest();

  // Cắt động (RFC 4226 §5.3): 4 bit thấp của byte cuối trỏ tới offset.
  const off = bam[bam.length - 1]! & 0x0f;
  const so =
    ((bam[off]! & 0x7f) << 24) |
    ((bam[off + 1]! & 0xff) << 16) |
    ((bam[off + 2]! & 0xff) << 8) |
    (bam[off + 3]! & 0xff);

  return String(so % 10 ** soChuSo).padStart(soChuSo, '0');
}

/** So mã theo thời gian hằng định. Lệch độ dài ⇒ sai, không cần so tiếp. */
function khopMa(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/**
 * Tìm BƯỚC khớp với mã người dùng nhập, hoặc `null`.
 *
 * ⚠ TRẢ VỀ BƯỚC CHỨ KHÔNG TRẢ `true/false`, và đó là cả điểm của hàm này:
 * người gọi PHẢI ghi lại bước đã dùng rồi từ chối mọi bước ≤ nó. Không có phần
 * đó thì một mã bị nhìn trộm dùng được cho CẢ đăng nhập LẪN xác nhận thao tác
 * phá huỷ trong cùng 30 giây — tức lớp thứ hai thôi là lớp thứ hai.
 *
 * `cuaSo = 1`: chấp nhận ±1 bước cho đồng hồ lệch, KHÔNG hơn. Mỗi bước nới thêm
 * là 30 giây nữa cho một mã bị lộ.
 */
export function timBuocKhop(
  biMatBase32: string,
  maNhap: string,
  buocGiua: number,
  opts: { soChuSo?: number; cuaSo?: number } = {},
): number | null {
  const soChuSo = opts.soChuSo ?? 6;
  const cuaSo = opts.cuaSo ?? 1;
  const sach = maNhap.replace(/\s/g, '');
  if (!new RegExp(`^\\d{${soChuSo}}$`).test(sach)) return null;

  for (let d = -cuaSo; d <= cuaSo; d += 1) {
    const buoc = buocGiua + d;
    if (buoc < 0) continue;
    if (khopMa(sinhMa(biMatBase32, buoc, soChuSo), sach)) return buoc;
  }
  return null;
}

/**
 * URI cho ứng dụng xác thực (Google Authenticator / Aegis / 1Password…).
 * Người dùng quét mã QR dựng từ chuỗi này, hoặc chép tay `biMat`.
 */
export function uriGhiDanh(nhan: string, biMatBase32: string, phatHanh = 'DELPHI'): string {
  const ten = encodeURIComponent(`${phatHanh}:${nhan}`);
  const p = new URLSearchParams({
    secret: biMatBase32,
    issuer: phatHanh,
    algorithm: 'SHA1',
    digits: '6',
    period: String(BUOC_GIAY),
  });
  return `otpauth://totp/${ten}?${p.toString()}`;
}
