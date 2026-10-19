/**
 * `GET /api/v1/canh` + chuông Sentry cho `/health` (server/canh.ts — phiếu NGHIÊN CỨU → VẬN HÀNH 11/10).
 *
 * Mỗi mã lỗi có một bài dựng ĐÚNG ca của nó: lệch bản (sự cố 06/10), web không đọc được, heartbeat chết, và
 * `/health` 500 phải tới kênh báo lỗi (trước đây bị try/catch nuốt — đính chính 06/09).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { BAN_PHAT_HANH } from '../config/phien_ban.js';
import { xoaNhipBaoCanh, taoDocBanWeb, uocLuotThang } from '../server/canh.js';
import { NGUONG_CANH_LUOT_THANG, LUOT_NGOAI_WORKER_MOI_NGAY } from '../config/ha_tang.js';
import type { KenhBaoLoi } from '../server/bao_loi.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';

const TICK = 'tick-secret-canh-test';
const PROXY = 'proxy-secret-canh-test';
let db: TestDb;
let pool: pg.Pool;
let bao: { err: string; noi: string }[] = [];
const kenh: KenhBaoLoi = {
  bao: (err, ctx) => { bao.push({ err: (err as Error).message, noi: ctx.noi }); },
  baoMa: () => {},
  xa: async () => {},
  noiRaNgoai: true,
};

const appTho = (docBanWeb?: () => Promise<string | null>) => createApp({
  pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  tickSecret: TICK, proxySecret: PROXY, baoLoi: kenh, docBanWeb,
});
/*
 * `/canh` (cron-job.org) và `/health` (UptimeRobot, từ B1 — D613) đi QUA WORKER, nên request trong bài mang proxy secret
 * như Worker gắn. Gọi thẳng origin (không secret) là ca riêng: B1 chặn `/canh` 403 trước route (bài cuối của describe dưới).
 */
const app = (docBanWeb?: () => Promise<string | null>) => {
  const a = appTho(docBanWeb);
  return {
    request: (duong: string, init: { headers?: Record<string, string> } = {}) =>
      a.request(duong, { ...init, headers: { 'x-delphi-proxy-secret': PROXY, ...init.headers } }),
  };
};
const nhipTim = async (): Promise<void> => {
  await pool.query(`INSERT INTO scheduler_heartbeat (source) VALUES ('pg_cron'), ('tick')`);
};

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
}, 120_000);
afterAll(async () => { await db?.stop(); });
beforeEach(() => { bao = []; xoaNhipBaoCanh(); });

describe('/api/v1/canh', () => {
  it('thiếu nhịp tim ⇒ 500 `heartbeat` — và báo kênh lỗi', async () => {
    const res = await app(async () => BAN_PHAT_HANH).request('/api/v1/canh');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, loi: ['heartbeat'] });
    expect(bao.map((b) => b.err)).toEqual(['canh_hong:heartbeat']);
  });

  it('chỉ MỘT nguồn có nhịp (tick sống, pg_cron chết) ⇒ vẫn `heartbeat` — cùng luật /health', async () => {
    await pool.query(`INSERT INTO scheduler_heartbeat (source) VALUES ('tick')`);
    const res = await app(async () => BAN_PHAT_HANH).request('/api/v1/canh');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, loi: ['heartbeat'] });
  });

  it('⭐ đủ nhịp + bản web khớp ⇒ 200; công khai CHỈ {ok, loi}; không cache', async () => {
    await nhipTim();
    const res = await app(async () => BAN_PHAT_HANH).request('/api/v1/canh');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, loi: [] });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(bao).toEqual([]);
  });

  it('⭐ lệch bản web ↔ API (sự cố 06/10) ⇒ 500 `lech_ban`; chi tiết có hai bản khi có secret', async () => {
    const res = await app(async () => '0.0.52').request('/api/v1/canh', { headers: { 'x-tick-secret': TICK } });
    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, unknown>;
    expect(body.loi).toEqual(['lech_ban']);
    expect(body.ban_web).toBe('0.0.52');
    expect(body.ban_server).toBe(BAN_PHAT_HANH);
  });

  it('web không đọc được ⇒ `web_khong_doc_duoc` (đọc ném lỗi cũng vậy, không làm route nổ)', async () => {
    const r1 = await app(async () => null).request('/api/v1/canh');
    expect((await r1.json() as { loi: string[] }).loi).toEqual(['web_khong_doc_duoc']);
    const r2 = await app(async () => { throw new Error('mạng'); }).request('/api/v1/canh');
    expect(r2.status).toBe(500);
    expect((await r2.json() as { loi: string[] }).loi).toEqual(['web_khong_doc_duoc']);
  });

  it('van 10 phút: cùng lỗi gọi hai lần chỉ báo kênh MỘT lần', async () => {
    const a = app(async () => '0.0.1');
    await a.request('/api/v1/canh');
    await a.request('/api/v1/canh');
    expect(bao).toHaveLength(1);
  });

  it('taoDocBanWeb đọc `{ban}` từ /phien-ban.json; không phải 2xx ⇒ null', async () => {
    const goi: string[] = [];
    const doc = taoDocBanWeb('https://web.test/', (async (u: string) => {
      goi.push(String(u));
      return new Response(JSON.stringify({ ban: '0.0.9' }), { status: 200 });
    }) as unknown as typeof fetch);
    expect(await doc()).toBe('0.0.9');
    expect(goi[0]).toMatch(/^https:\/\/web\.test\/phien-ban\.json\?t=\d+$/);
    const hong = taoDocBanWeb('https://web.test', (async () => new Response('', { status: 404 })) as unknown as typeof fetch);
    expect(await hong()).toBeNull();
  });
});

describe('/api/v1/canh — quota Vercel đếm ở Worker (D594)', () => {
  it('uocLuotThang = số Worker + lượt ngoài Worker × ngày trong tháng UTC', () => {
    expect(uocLuotThang(1000, new Date('2026-10-11T05:00:00Z'))).toBe(1000 + LUOT_NGOAI_WORKER_MOI_NGAY * 11);
  });

  it('⭐ header từ Worker (secret khớp) vượt ngưỡng ⇒ 500 `quota`, chi tiết có số ước lượng', async () => {
    const res = await app(async () => BAN_PHAT_HANH).request('/api/v1/canh', {
      headers: { 'x-dp-dem-thang': String(NGUONG_CANH_LUOT_THANG), 'x-delphi-proxy-secret': PROXY, 'x-tick-secret': TICK },
    });
    expect(res.status).toBe(500);
    const body = await res.json() as { loi: string[]; luot_thang_uoc: number };
    expect(body.loi).toEqual(['quota']);
    expect(body.luot_thang_uoc).toBeGreaterThanOrEqual(NGUONG_CANH_LUOT_THANG);
  });

  it('dưới ngưỡng ⇒ 200, có số ước lượng', async () => {
    const res = await app(async () => BAN_PHAT_HANH).request('/api/v1/canh', {
      headers: { 'x-dp-dem-thang': '10', 'x-delphi-proxy-secret': PROXY, 'x-tick-secret': TICK },
    });
    expect(res.status).toBe(200);
    expect((await res.json() as { luot_thang_uoc: number | null }).luot_thang_uoc).not.toBeNull();
  });

  /*
   * ⚠ ĐỔI LUẬT CÓ CHỦ ĐÍCH (B1, D613): bài cũ khẳng định "secret sai/thiếu ⇒ route chạy nhưng bỏ qua số đếm". Từ cổng
   * proxy, người gọi thẳng Vercel không tới được route nữa (403 `khong_qua_cong`) — điều bài canh (không giả được số để
   * tắt chuông) giữ nguyên và chặt hơn: không cả chạm `kiemCanh`.
   */
  it('⚠ secret SAI hoặc thiếu ⇒ 403 khong_qua_cong trước route (người gọi thẳng Vercel không giả được số để tắt chuông)', async () => {
    for (const h of [{ 'x-delphi-proxy-secret': 'sai' }, {}]) {
      const res = await appTho(async () => BAN_PHAT_HANH).request('/api/v1/canh', {
        headers: { 'x-dp-dem-thang': String(NGUONG_CANH_LUOT_THANG * 2), 'x-tick-secret': TICK, ...h },
      });
      expect(res.status).toBe(403);
      expect((await res.json() as { error: string }).error).toBe('khong_qua_cong');
    }
    expect(bao).toEqual([]);
  });
});

describe('/api/v1/health — 500 phải tới kênh báo lỗi', () => {
  it('⭐ heartbeat quá hạn ⇒ 500 VÀ một sự kiện `health_degraded`', async () => {
    await pool.query(`UPDATE scheduler_heartbeat SET beat_at = now() - interval '1 hour'`);
    const res = await app().request('/api/v1/health');
    expect(res.status).toBe(500);
    expect(bao).toEqual([{ err: 'health_degraded', noi: 'GET /api/v1/health' }]);
  });
});
