/**
 * K6 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — KIỂU HONO DÙNG CHUNG, MỘT NGUỒN.
 *
 * Trước bản này `type Env = { Variables: { actor: SessionActor } }` chép ở 25 tệp và mỗi tệp tự khai
 * `type Middleware = (c: any, next: any) => Promise<any>` — thêm một biến ngữ cảnh mới (vd. `c.set('x', …)`)
 * là phải nhớ sửa 25 bản, sót bản nào thì tệp ấy đọc `c.get('x')` ra `any` không ai báo (D61).
 * `tests/kieu_hono_mot_nguon.test.ts` canh: `type Env =` chỉ còn ở tệp này.
 */
import type { Context, MiddlewareHandler } from 'hono';
import type { SessionActor } from '../auth/session.js';

/** Biến ngữ cảnh mọi route đọc được — `actor` do `requireAuth` gắn. */
export type Env = { Variables: { actor: SessionActor } };
export type Ctx = Context<Env>;
/** Middleware có kiểu: `c.get('actor')` ra `SessionActor`, không phải `any`. */
export type Mw = MiddlewareHandler<Env>;
