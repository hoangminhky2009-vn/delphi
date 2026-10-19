/**
 * Mật khẩu + token. KHÔNG tự chế crypto (A8): argon2id qua @node-rs/argon2
 * (bản dựng sẵn, không cần toolchain native), token bằng randomBytes của Node.
 */
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { AUTH } from '../../config/auth.js';

export async function hashPassword(plain: string): Promise<string> {
  return argonHash(plain, AUTH.ARGON2);
}

/** Sai mật khẩu → false; hash hỏng → false (không ném ra ngoài). */
export async function verifyPassword(hashStored: string, plain: string): Promise<boolean> {
  try {
    return await argonVerify(hashStored, plain);
  } catch {
    return false;
  }
}

/**
 * Hash GIẢ dùng khi email không tồn tại — tính LƯỜI một lần cho cả tiến
 * trình, giữ dưới dạng Promise (nhiều request cùng lúc lúc cold start thì
 * CHIA SẺ đúng một Promise, không băm N lần).
 *
 * ⚠ KHÔNG hard-code chuỗi hash: tham số argon2 nằm ở `AUTH.ARGON2`
 * (config/auth.ts) — một hash chép tay sẽ TRÔI khỏi tham số đó ngay khi ai
 * đổi `AUTH.ARGON2`, đúng lớp "bản sao thứ hai sẽ trôi" (A11.5). Sinh bằng
 * CHÍNH `hashPassword` với một token ngẫu nhiên (`generateToken()`) nên tham
 * số luôn khớp, và không ai "đăng nhập" được bằng nó — plaintext của nó sinh
 * ra rồi vứt, không ai biết, kể cả ta.
 */
let hashGia: Promise<string> | undefined;

/**
 * D444 (28/09) — CHỐNG DÒ EMAIL NÀO ĐÃ ĐĂNG KÝ QUA THỜI GIAN PHẢN HỒI.
 *
 * Trước bản vá, `/api/v1/auth/login` gọi thẳng `verifyPassword` khi CÓ tài
 * khoản và bỏ qua hẳn bước đó khi KHÔNG có — tức email lạ trả 401 gần như
 * tức thì, còn email có thật luôn tốn một lượt argon2 (`AUTH.ARGON2`) trước
 * khi 401. Ví dụ có số (đo trên máy dev qua route thật, có DB —
 * `tests/dang_nhap_thoi_gian.test.ts`): trung vị nhánh "email lạ" kiểu cũ
 * ~4,3 ms so nhánh "email có, sai mật khẩu" ~56 ms — chênh ~13 lần, tách được
 * chỉ bằng vài chục lượt gọi kể cả qua mạng thật. Sau bản vá hai trung vị cùng
 * ~60–80 ms (tỉ lệ ~1,0–1,1). Đúng thứ chú thích cũ ở route login hứa ("không
 * dò được user") mà code KHÔNG giữ.
 *
 * Sửa: KHÔNG có hash (email lạ) cũng verify — với HASH GIẢ cố định của tiến
 * trình — rồi LUÔN trả false. Tốn đúng một lượt argon2 y hệt nhánh có hash
 * thật, nên hai nhánh không còn phân biệt được qua đồng hồ.
 *
 * ⚠ GIÁ, GHI ĐÚNG CHỨ KHÔNG LÀM NHẸ: +1 lượt argon2 (~50 ms CPU trên máy dev)
 * cho MỖI lần đăng nhập bằng email không tồn tại. Trần `LOGIN_MAX_FAILS` (10
 * lần sai/15 phút) là theo EMAIL — dò NHIỀU email khác nhau thì mỗi email có
 * suất riêng, nên trần ấy không chặn được việc này — và đăng nhập KHÔNG có trần
 * theo IP (founder bác 28/09: buổi đo cả lớp chung một IP, trần đăng ký đã dính
 * đúng lỗi ấy). ⇒ Kẻ cố ý spam email lạ đốt được thời gian chạy hàm của Vercel.
 * Điều kiện xét lại (thêm trần theo IP chỉ đếm lượt SAI) ghi ở D444 §5.
 *
 * Sai mật khẩu / KHÔNG có hash → false; hash hỏng → false (giống
 * `verifyPassword`, không ném ra ngoài).
 */
export async function kiemMatKhau(
  hashStored: string | null | undefined,
  plain: string,
): Promise<boolean> {
  if (hashStored) return verifyPassword(hashStored, plain);
  if (!hashGia) hashGia = hashPassword(generateToken());
  await verifyPassword(await hashGia, plain);
  return false;
}

/** Token thô gửi cho user (URL-safe). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** DB chỉ lưu hash — lộ DB không dùng được token/phiên. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** So sánh chuỗi hằng thời gian (dùng cho secret so khớp). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
