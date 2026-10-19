/**
 * BẢN DEMO — biến toàn cục kiểu Node mà server đọc lúc chạy, nạp TRƯỚC mọi module server (import đầu tiên của worker).
 * `Buffer` (băm · token phiên) và `process.env` (tham số PLAYTEST-TUNE `doThamSo`, cờ `VITEST`/`HOLDEM_SWEEP` — vắng = mặc định).
 */
import { Buffer } from 'buffer';

const g = globalThis as unknown as { Buffer?: unknown; process?: { env?: Record<string, string | undefined> } };
g.Buffer ??= Buffer;
g.process ??= { env: {} };
g.process.env ??= {};

/*
 * Gói `buffer` (bản trình duyệt của Buffer) chưa biết mã hoá 'base64url' — mà `generateToken()` của server
 * (`randomBytes(32).toString('base64url')`) cấp token phiên bằng đúng nó. Thêm đúng một nhánh, còn lại đi nguyên bản.
 */
const toStringGoc = Buffer.prototype.toString;
Buffer.prototype.toString = function toString(this: Buffer, enc?: string, dau?: number, cuoi?: number): string {
  if (enc === 'base64url') {
    return toStringGoc.call(this, 'base64', dau, cuoi).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return toStringGoc.call(this, enc as BufferEncoding, dau, cuoi);
} as typeof Buffer.prototype.toString;
