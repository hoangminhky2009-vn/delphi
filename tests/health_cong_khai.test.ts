/**
 * D444 (28/09) — `/api/v1/health` CÔNG KHAI chỉ còn `{status, ban_phat_hanh}`;
 * CHI TIẾT (đủ mọi khoá cũ) chỉ trả khi header `x-tick-secret` khớp
 * `deps.tickSecret` (so bằng `safeEqual`, fail-closed khi chưa cấu hình).
 *
 * Bài này khoá đúng BẢN VÁ (A11.6) — không khoá một tệp hay một chuỗi. Xem
 * khối chú thích D444 ở `server/app.ts` ngay trên `app.get('/api/v1/health', …)`
 * để biết vì sao gọn và vì sao `ban_phat_hanh` vẫn công khai.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';

const TICK = 'tick-secret-health-cong-khai-test';
/** Hình dạng CÔNG KHAI đúng luật D444 — không hơn, không kém. */
const KHOA_CONG_KHAI = ['ban_phat_hanh', 'status'];

let db: TestDb;
let pool: pg.Pool;
/** App CÓ cấu hình tickSecret — dùng cho (a)(b)(c)(e). */
let appConTick: Hono<any>;
/** App KHÔNG cấu hình tickSecret — dùng riêng cho (d), đúng nhánh fail-closed. */
let appKhongTick: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  appConTick = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    secureCookie: false, tickSecret: TICK,
  }) as Hono<any>;
  appKhongTick = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    secureCookie: false,
  }) as Hono<any>;
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

const j = (r: Response): Promise<any> => r.json() as Promise<any>;

describe('/api/v1/health — công khai gọn, chi tiết đòi header (D444)', () => {
  it('(a) không header ⇒ thân CHỈ có đúng {status, ban_phat_hanh}', async () => {
    const res = await appConTick.request('/api/v1/health');
    const body = await j(res);
    expect(Object.keys(body).sort()).toEqual(KHOA_CONG_KHAI);
  });

  it('(b) header SAI (nhưng CÓ gửi) ⇒ vẫn chỉ hai khoá, không dò được bằng đoán', async () => {
    const res = await appConTick.request('/api/v1/health', {
      headers: { 'x-tick-secret': 'doan-mo-sai-hoan-toan' },
    });
    const body = await j(res);
    expect(Object.keys(body).sort()).toEqual(KHOA_CONG_KHAI);
  });

  it('(c) header ĐÚNG ⇒ trả đủ khoá chi tiết cũ (không đổi tên khoá)', async () => {
    const res = await appConTick.request('/api/v1/health', {
      headers: { 'x-tick-secret': TICK },
    });
    const body = await j(res);
    expect(body).toHaveProperty('admin_allowlist');
    expect(body).toHaveProperty('tai');
    expect(body).toHaveProperty('bao_loi');
    expect(body).toHaveProperty('proxy_secret_cau_hinh');
    expect(body).toHaveProperty('db_ok');
  });

  it('(d) app KHÔNG cấu hình tickSecret ⇒ FAIL-CLOSED — mọi header (kể cả chuỗi rỗng) đều chỉ ra hai khoá', async () => {
    const cacHeader: (string | undefined)[] = [undefined, '', 'gia-tri-bat-ky', TICK];
    for (const gt of cacHeader) {
      const res = await appKhongTick.request('/api/v1/health', {
        headers: gt === undefined ? {} : { 'x-tick-secret': gt },
      });
      const body = await j(res);
      expect(Object.keys(body).sort(), `header=${JSON.stringify(gt)}`).toEqual(KHOA_CONG_KHAI);
    }
  });

  /*
   * ⭐ (f) LÁ CHẮN CACHE — bắt ở lượt rà D444, không phải lúc viết bản vá: Worker
   * cache `/health` 30 giây theo URL, không theo header, nên thân CHI TIẾT lọt vào
   * cache biên là phát cho người lạ. Thân chi tiết phải tự khai `no-store`; thân
   * công khai thì KHÔNG (Worker vẫn phải đỡ tải được cho UptimeRobot + cảm biến mạng).
   * Cặp với `web/tests/worker_cache.test.ts` (lá chắn phía Worker).
   */
  it('⭐ (f) thân chi tiết phát Cache-Control: no-store; thân công khai không', async () => {
    const chiTiet = await appConTick.request('/api/v1/health', { headers: { 'x-tick-secret': TICK } });
    expect(chiTiet.headers.get('cache-control') ?? '').toMatch(/no-store/);
    for (const headers of [{}, { 'x-tick-secret': 'doan-mo-sai-hoan-toan' }]) {
      const congKhai = await appConTick.request('/api/v1/health', { headers });
      expect(congKhai.headers.get('cache-control') ?? '', JSON.stringify(headers)).not.toMatch(/no-store/);
    }
  });

  it('(e) DB test mới dựng ⇒ heartbeat rỗng ⇒ degraded + HTTP 500 ⇒ thân vẫn chỉ hai khoá', async () => {
    // Không có bài nào trong tệp này gọi /internal/tick, nên scheduler_heartbeat
    // luôn rỗng trên DB test này — đúng hình dạng "vừa dựng xong, chưa ai tick".
    const res = await appConTick.request('/api/v1/health');
    expect(res.status).toBe(500);
    const body = await j(res);
    expect(body.status).toBe('degraded');
    expect(Object.keys(body).sort()).toEqual(KHOA_CONG_KHAI);
  });
});
