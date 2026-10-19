/**
 * KÊNH BÁO LỖI (D93) — adapter mỏng bọc Sentry, và đường nối vào `app.onError`.
 *
 * Bốn tính chất khoá ở đây, mỗi cái một lớp lỗi có thật:
 *   1. KHÔNG DSN ⇒ kênh IM (không gọi sdk.init, không ném) — dev/test/CI không
 *      cần tài khoản, và app chạy y hệt trước D93.
 *   2. CÓ DSN ⇒ init ĐÚNG MỘT LẦN, tắt auto-instrument (defaultIntegrations
 *      false · tracesSampleRate 0 · sendDefaultPii false — C7), và mỗi `bao()`
 *      thành đúng một `captureException` mang nhãn `noi`.
 *   3. SDK NÉM ⇒ `bao()` KHÔNG ném. Kênh báo lỗi mà ném là che mất lỗi gốc —
 *      đúng lớp "chuông báo cháy tự bốc cháy".
 *   4. `app.onError` GỌI kênh với đúng `noi` = method + path. Trước D93 nó chỉ
 *      `console.error` ⇒ sập trên prod thì không ai được báo (thư viện Sentry nằm
 *      trong package.json từ GĐ0, `SENTRY_DSN` ghi trong .env.example — mà không
 *      một dòng code nào đọc: cơ chế trang trí).
 */
import { describe, it, expect, vi } from 'vitest';
import type pg from 'pg';
import { taoKenhBaoLoi, type SdkBaoLoi } from '../server/bao_loi.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';

function sdkGia(): SdkBaoLoi & { goi: { init: unknown[]; capture: unknown[][]; flush: number } } {
  const goi = { init: [] as unknown[], capture: [] as unknown[][], flush: 0 };
  return {
    goi,
    init: (o) => { goi.init.push(o); },
    captureException: (err, hint) => { goi.capture.push([err, hint]); return 'id'; },
    captureMessage: (msg, ctx) => { goi.capture.push([msg, ctx]); return 'id'; },
    flush: async () => { goi.flush += 1; return true; },
  };
}

describe('kênh báo lỗi — adapter', () => {
  it('KHÔNG DSN ⇒ im: không init, bao() không ném, xa() về ngay, không nối ra ngoài', async () => {
    const sdk = sdkGia();
    const kenh = taoKenhBaoLoi({ dsn: undefined }, sdk);
    const im = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => kenh.bao(new Error('x'), { noi: 'test' })).not.toThrow();
    await kenh.xa();
    im.mockRestore();
    expect(sdk.goi.init).toHaveLength(0);
    expect(sdk.goi.capture).toHaveLength(0);
    expect(kenh.noiRaNgoai).toBe(false);
  });

  it('CÓ DSN ⇒ init một lần, tắt auto-instrument + không PII; bao() ⇒ một captureException mang nhãn noi', async () => {
    const sdk = sdkGia();
    const kenh = taoKenhBaoLoi(
      { dsn: 'https://abc@o1.ingest.sentry.io/1', moiTruong: 'production', phienBan: 'sha123' }, sdk);
    expect(kenh.noiRaNgoai).toBe(true);
    expect(sdk.goi.init).toHaveLength(1);
    const o = sdk.goi.init[0] as Record<string, unknown>;
    expect(o.dsn).toBe('https://abc@o1.ingest.sentry.io/1');
    expect(o.environment).toBe('production');
    expect(o.release).toBe('sha123');
    expect(o.defaultIntegrations).toBe(false);
    expect(o.tracesSampleRate).toBe(0);
    expect(o.sendDefaultPii).toBe(false);

    const im = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('bùm');
    kenh.bao(err, { noi: 'POST /api/v1/holdem/matches/:id/rounds', nhan: { status: 500, user: 'u1' } });
    im.mockRestore();
    expect(sdk.goi.capture).toHaveLength(1);
    const [e, hint] = sdk.goi.capture[0]!;
    expect(e).toBe(err);
    const tags = (hint as { tags: Record<string, unknown> }).tags;
    expect(tags.noi).toBe('POST /api/v1/holdem/matches/:id/rounds');
    expect(tags.status).toBe('500');
    expect(tags.user).toBe('u1');

    await kenh.xa(100);
    expect(sdk.goi.flush).toBe(1);
  });

  it('SDK NÉM ⇒ bao() và xa() KHÔNG ném (chuông báo cháy không được tự bốc cháy)', async () => {
    const sdk: SdkBaoLoi = {
      init: () => {},
      captureException: () => { throw new Error('sentry chết'); },
      captureMessage: () => { throw new Error('sentry chết'); },
      flush: async () => { throw new Error('flush chết'); },
    };
    const kenh = taoKenhBaoLoi({ dsn: 'https://abc@o1.ingest.sentry.io/1' }, sdk);
    const im = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => kenh.bao(new Error('gốc'), { noi: 'x' })).not.toThrow();
    expect(() => kenh.baoMa('loi_client', { ma: 'route:x:1', man: '/arena', ban: '0.0.65' })).not.toThrow();
    await expect(kenh.xa(50)).resolves.toBeUndefined();
    im.mockRestore();
  });

  it('không có sdk thật tiêm vào mà CÓ DSN ⇒ vẫn không ném (mặc định là kênh im + cảnh báo)', () => {
    const im = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Không truyền sdk ⇒ adapter phải tự rơi về im, KHÔNG được import Sentry ngầm
    // ở đây (Sentry chỉ được nạp ở api/index.ts — điểm vào prod).
    const kenh = taoKenhBaoLoi({ dsn: 'https://abc@o1.ingest.sentry.io/1' });
    expect(kenh.noiRaNgoai).toBe(false);
    expect(() => kenh.bao(new Error('x'), { noi: 'y' })).not.toThrow();
    im.mockRestore();
  });
});

describe('kênh báo lỗi — nối vào app.onError', () => {
  /*
   * "Server sập" giả lập bằng một pool mà MỌI câu query đều ném — chính là
   * hình dạng của Supabase chết / pooler từ chối. Route tick là cửa gọn nhất:
   * dòng đầu tiên của nó là `pool.query(INSERT heartbeat)`.
   */
  const poolChet = { query: async () => { throw new Error('ECONNREFUSED giả'); } } as unknown as pg.Pool;

  it('lỗi trong route ⇒ 500 `internal` VÀ kênh nhận đúng một lần với noi = METHOD + đường', async () => {
    const goi: { err: unknown; noi: string; nhan?: Record<string, unknown> }[] = [];
    let daXa = 0;
    const app = createApp({
      pool: poolChet, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
      secureCookie: false, tickSecret: 'tick-test',
      baoLoi: {
        bao: (err, ctx) => { goi.push({ err, ...ctx }); },
        baoMa: () => {},
        xa: async () => { daXa += 1; },
        noiRaNgoai: true,
      },
    });
    const im = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/api/v1/internal/tick', {
      method: 'POST', headers: { 'x-tick-secret': 'tick-test' },
    });
    im.mockRestore();
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: string }).error).toBe('internal');
    expect(goi).toHaveLength(1);
    expect((goi[0]!.err as Error).message).toBe('ECONNREFUSED giả');
    expect(goi[0]!.noi).toBe('POST /api/v1/internal/tick');
    // Serverless: PHẢI xả trước khi trả lời, không thì function kết thúc và
    // event nằm lại trong hàng đợi của một process sắp bị đóng băng.
    expect(daXa).toBe(1);
  });

  it('không tiêm kênh ⇒ app vẫn trả 500 y hệt trước D93 (kênh mặc định im)', async () => {
    const app = createApp({
      pool: poolChet, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
      secureCookie: false, tickSecret: 'tick-test',
    });
    const im = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/api/v1/internal/tick', {
      method: 'POST', headers: { 'x-tick-secret': 'tick-test' },
    });
    im.mockRestore();
    expect(res.status).toBe(500);
  });

  it('/health khai `bao_loi.noi_ra_ngoai` — để kiểm cấu hình prod mà không phải đoán', async () => {
    // D444: khoá này giờ ở phần CHI TIẾT, cần header x-tick-secret mới đọc được.
    const app = createApp({
      pool: poolChet, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
      secureCookie: false, tickSecret: 'tick-test',
      baoLoi: { bao: () => {}, baoMa: () => {}, xa: async () => {}, noiRaNgoai: true },
    });
    const im = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/api/v1/health', {
      headers: { 'x-tick-secret': 'tick-test' },
    });
    im.mockRestore();
    const body = (await res.json()) as { bao_loi: { noi_ra_ngoai: boolean } };
    expect(body.bao_loi.noi_ra_ngoai).toBe(true);
  });
});
