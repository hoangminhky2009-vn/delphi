/**
 * VAN QUÁ TẢI (D274) — 503 + Retry-After thay cho 500 khi hết chỗ kết nối.
 *
 * ⚠ BÀI QUAN TRỌNG NHẤT LÀ §2 "KHÔNG bắt nhầm". Một van bắt quá rộng còn tệ hơn
 * không có van: nó biến MỌI sự cố thật thành "đang đông, thử lại sau", client
 * lặng lẽ thử lại, và chuông không bao giờ kêu. Nhận diện bằng thông điệp nên
 * bài đó phải có ca âm thật, không chỉ ca dương.
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import type { Mailer } from '../server/email.js';
import {
  giaySauThuLai, laHetKetNoi, nenBaoHetKetNoi, xoaNhipBaoHetKetNoi,
} from '../server/tai.js';

/** Nguyên văn từ log Vercel 05/09/2026 (D271) — đừng "dọn" cho gọn. */
const LOI_THAT = '(EMAXCONN) max client connections reached, limit: 200';

const POOL_GIA = {} as unknown as pg.Pool;
const MAILER_GIA = { send: async () => undefined } as unknown as Mailer;

function dungApp(): Hono<any> {
  const app = createApp({
    pool: POOL_GIA, mailer: MAILER_GIA, appBaseUrl: 'https://dubao.test',
  }) as Hono<any>;
  app.get('/api/v1/__thu/het-ket-noi', () => { throw new Error(LOI_THAT); });
  app.get('/api/v1/__thu/loi-thuong', () => { throw new Error('cot bankroll khong ton tai'); });
  return app;
}

beforeEach(() => xoaNhipBaoHetKetNoi());

describe('I. Nhận diện hết kết nối', () => {
  it('bắt đúng thông điệp THẬT của Supavisor', () => {
    expect(laHetKetNoi(new Error(LOI_THAT))).toBe(true);
  });

  it('bắt cả ca pool hết giờ xin kết nối (cùng bản chất)', () => {
    expect(laHetKetNoi(new Error('timeout exceeded when trying to connect'))).toBe(true);
  });
});

describe('II. KHÔNG bắt nhầm — van bắt rộng thì chuông chết', () => {
  it.each([
    ['lỗi SQL thường', 'column "bankroll" does not exist'],
    ['ràng buộc DB', 'violates check constraint "bankroll_khong_am"'],
    ['lỗi lạ', 'boom'],
    ['chuỗi rỗng', ''],
  ])('%s ⇒ KHÔNG phải quá tải', (_ten, msg) => {
    expect(laHetKetNoi(new Error(msg))).toBe(false);
  });

  it('không nổ với thứ không phải Error', () => {
    expect(laHetKetNoi(null)).toBe(false);
    expect(laHetKetNoi(undefined)).toBe(false);
    expect(laHetKetNoi({ code: 'XX000' })).toBe(false);
  });
});

describe('III. Bóp nhịp báo — chuông không tự đốt hạn mức', () => {
  it('lần đầu báo, những lần sau trong cùng phút thì im', () => {
    const t = 1_000_000;
    expect(nenBaoHetKetNoi(t)).toBe(true);
    expect(nenBaoHetKetNoi(t + 1)).toBe(false);
    expect(nenBaoHetKetNoi(t + 59_999)).toBe(false);
    expect(nenBaoHetKetNoi(t + 60_000)).toBe(true);
  });
});

describe('IV. Retry-After có nhiễu', () => {
  it('nằm trong 3–8 giây', () => {
    expect(giaySauThuLai(() => 0)).toBe(3);
    expect(giaySauThuLai(() => 0.999)).toBe(8);
  });
});

describe('V. Đường thật qua app.onError', () => {
  it('hết kết nối ⇒ 503 + Retry-After, KHÔNG phải 500', async () => {
    const res = await dungApp().request('/api/v1/__thu/het-ket-noi');
    expect(res.status).toBe(503);
    const giay = Number(res.headers.get('Retry-After'));
    expect(giay).toBeGreaterThanOrEqual(3);
    expect(giay).toBeLessThanOrEqual(8);
    const body = (await res.json()) as { error: string; thu_lai_sau_giay: number };
    expect(body.error).toBe('qua_tai');
    expect(body.thu_lai_sau_giay).toBe(giay);
  });

  it('⚠ lỗi THƯỜNG vẫn 500 và KHÔNG có Retry-After — van không được nuốt sự cố thật', async () => {
    const res = await dungApp().request('/api/v1/__thu/loi-thuong');
    expect(res.status).toBe(500);
    expect(res.headers.get('Retry-After')).toBeNull();
    expect(((await res.json()) as { error: string }).error).toBe('internal');
  });
});
