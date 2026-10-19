/**
 * BẢN DEMO — thay `@node-rs/argon2` (mã máy, không chạy trong trình duyệt). Khách demo không có mật khẩu và không có người
 * thứ hai trên cùng DB tạm; hai hàm này chỉ để module `server/auth/crypto` nạp được.
 */
import { createHash } from './crypto';

export async function hash(matKhau: string): Promise<string> {
  return `demo$${createHash('sha256').update(matKhau).digest('hex')}`;
}
export async function verify(daBam: string, matKhau: string): Promise<boolean> {
  return daBam === await hash(matKhau);
}
