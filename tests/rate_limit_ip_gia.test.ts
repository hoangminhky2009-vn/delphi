import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { ensureGenesis } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { AUTH } from '../config/auth.js';

/*
 * KHOÁ RATE LIMIT KHÔNG ĐƯỢC LẤY TỪ THỨ NGƯỜI GỌI TỰ ĐẶT.
 *
 * ⚠⚠ VÌ SAO BÀI NÀY TỒN TẠI. `clientIpCoNguon` trả về HAI thứ — `ip` và
 * `tinDuoc` — nhưng năm chỗ khoá rate limit chỉ lấy `ip` rồi vứt `tinDuoc`:
 * `register:ip` · `khach:ip` · `tele:ip` · hai chỗ Discord. Khi request KHÔNG đi
 * qua proxy tin cậy, `ip` rơi về `x-forwarded-for` — MỘT HEADER NGƯỜI GỌI ĐẶT.
 * Tự chọn được khoá bucket nghĩa là tự miễn trừ rate limit: mỗi request một IP
 * mới là một hạn mức mới.
 *
 * ⚠ TRÊN VERCEL CHUYỆN NÀY HIỆN BỊ CHẶN BỞI NỀN TẢNG, KHÔNG PHẢI BỞI CODE TA:
 * Vercel ghi đè `x-forwarded-for` bằng IP của bên kết nối (chính sự cố 18/07 đã
 * dạy điều đó — xem docstring `clientIpCoNguon`). Nên đây KHÔNG phải lỗ đang
 * chảy máu trên prod. Nhưng nó có nghĩa là một phép kiểm an toàn của ta đang tựa
 * vào một hành vi KHÔNG ĐƯỢC GHI TRONG HỢP ĐỒNG của nhà cung cấp — đổi hosting
 * hoặc đổi cách Vercel xử header là nó mở im lặng, đúng thứ A8.9 gọi là khoá
 * nhà cung cấp ở tầng nghiệp vụ.
 *
 * Bài này khoá TÍNH CHẤT: khi máy chủ KHÔNG xác thực được IP, nó không được phép
 * cho người gọi tự chọn hạn mức của mình.
 */

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
const PROXY = 'bi-mat-proxy-test';

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(),
    appBaseUrl: 'https://dubao.test', secureCookie: false, proxySecret: PROXY,
  }) as Hono<any>;
  await ensureGenesis(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

/** Gọi cửa khách KHÔNG qua proxy, tự khai IP — đúng tư thế của kẻ gọi thẳng gốc API. */
const khachGiaIp = (ip: string) =>
  app.request('/api/v1/auth/khach', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  });

describe('rate limit không được khoá bằng header người gọi tự đặt', () => {
  it('⭐ đổi x-forwarded-for mỗi lần KHÔNG được cấp hạn mức mới', async () => {
    const tran = AUTH.REGISTER_MAX_PER_IP;
    const soLan = tran * AUTH.KHONG_TIN_HE_SO * 2;   // đủ để vượt CẢ trần chung
    const ma: number[] = [];
    for (let i = 0; i < soLan; i += 1) {
      ma.push((await khachGiaIp(`203.0.113.${i + 1}`)).status);
    }
    const qua = ma.filter((s) => s === 200 || s === 201).length;
    // Trần đúng ở đây là trần CHUNG của luồng không-tin, không phải trần một IP:
    // vế theo-IP không chặn được ai xoay IP, vế chung mới là cái chặn.
    const tranChung = tran * AUTH.KHONG_TIN_HE_SO;
    expect(
      qua,
      `tạo được ${qua}/${soLan} tài khoản khách bằng cách đổi IP giả`
      + ` — trần luồng không-tin là ${tranChung}.`
      + ' Khoá rate limit đang lấy từ thứ người gọi tự đặt.',
    ).toBeLessThanOrEqual(tranChung);
  });

  it('đường ĐÚNG (qua proxy, IP thật khác nhau) vẫn được cấp hạn mức riêng', async () => {
    // Bản vá không được biến rate limit thành một cái xô chung cho người thật:
    // hai người ở hai mạng khác nhau phải có hai hạn mức.
    const goiThat = (ip: string) =>
      app.request('/api/v1/auth/khach', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-delphi-client-ip': ip,
          'x-delphi-proxy-secret': PROXY,
        },
      });
    expect((await goiThat('198.51.100.11')).status).toBeLessThan(400);
    expect((await goiThat('198.51.100.12')).status).toBeLessThan(400);
  });
});
