import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { ensureGenesis } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';

/*
 * KHÁCH KHÔNG ĐƯỢC ĐỘNG VÀO KHO BẠC — VÀ CỬA MỚI PHẢI TỰ LỘ RA.
 *
 * ⚠⚠ VÌ SAO BÀI NÀY TỒN TẠI, VÀ VÌ SAO NÓ KHÔNG CHỈ TEST MỘT ROUTE.
 * 11/08 vá cửa `/subsidy/claim` bằng một câu `if (actor.laKhach)` trong handler.
 * Hôm sau đợt săn tìm ra cửa THỨ HAI còn nguyên: `/me/qua-beta/nhan`, chi 500 T
 * mỗi lượt — gấp mười lần trợ cấp — cho bất kỳ ai gọi được một cú POST tạo
 * khách (không email, không mật khẩu, không age gate).
 *
 * Bài học nằm ở CHỖ ĐẶT, không ở cái `if`: người thêm cửa mới đang nghĩ về tính
 * năng của họ, không nghĩ về Kho bạc. Nên bài này canh HAI thứ:
 *   1. HÀNH VI: khách gọi cửa đã biết ⇒ 403, không phải 200.
 *   2. ⭐ ĐỘ PHỦ: quét mã nguồn tìm MỌI file có đường chi Kho bạc, và bắt mỗi
 *      file đó phải có tên trong danh sách đã gác. Thêm một cửa chi mới mà quên
 *      cổng ⇒ bài này ĐỎ, và người sửa buộc phải CHỌN chứ không được bỏ quên.
 *
 * Cùng nếp `BANG_PHU_DU` của backup: một danh sách CÓ TÊN kèm lý do, và một
 * phép đối chiếu với thực tế — chứ không phải trí nhớ của người viết commit sau.
 *
 * VÌ SAO KHÁCH BỊ CẤM: Kho bạc là quỹ MỘT LẦN (genesis 20.000 T, khoá bằng
 * unique index — A3.4) với `CHECK balance_after >= 0` ở tầng DB. Cạn thì MỌI
 * khoản chi fail cứng: trợ cấp người thật, seed thanh khoản khi mở kèo, quà tri
 * ân. Không đúc lại được (A3.4).
 */

/** Cửa chi Kho bạc đã gác. Thêm cửa mới thì thêm vào đây VÀ gắn `chanKhach`. */
const CUA_DA_GAC: Record<string, { duong: string; ly_do: string }> = {
  'subsidy.ts': {
    duong: '/api/v1/subsidy/claim',
    ly_do: 'trợ cấp ngày 50 T, rút thẳng từ Kho bạc',
  },
  'qua_beta_api.ts': {
    duong: '/api/v1/me/qua-beta/nhan',
    ly_do: 'quà tri ân beta 500 T + Q + thẻ phòng + sticker giới hạn',
  },
};

/**
 * File được phép chạm Kho bạc mà KHÔNG cần cổng khách — mỗi cái một lý do.
 * Đây là danh sách LOẠI TRỪ CÓ TÊN, không phải một cái lọc mờ.
 */
const KHONG_PHAI_CUA: Record<string, string> = {
  'qua_beta.ts': 'tầng nghiệp vụ của qua_beta_api.ts — cửa đã gác ở file kia',
  'treasury.ts': 'tầng ghi sổ, không phải endpoint — nó không biết actor là ai',
  'audit.ts': 'chỉ ĐỌC để đối chiếu bảo toàn cung tiền',
  'markets.ts': 'seed thanh khoản do ADMIN mở kèo chi, đã sau cửa admin + 2FA',
  'resolve.ts': 'trả thưởng khi resolve, chạy sau cửa admin hoặc scheduler',
  'admin.ts': 'toàn bộ file sau cửa admin + 2FA + xác thực lại',
  'admin_keo.ts': 'như trên',
  'scheduler.ts': 'chạy server-side theo giờ, không có actor nào (C3)',
  'season.ts': 'reset mùa, chạy bằng script có .env.prod',
  /*
   * ⚠ `cho.ts` chạm Kho bạc theo chiều NGƯỢC với mọi tên khác trong hai danh
   * sách này: nó chỉ CỘNG (2% phí mỗi lượt mua, `phi_cho_in`), không có nhánh
   * nào trừ. Cổng khách (D79) sinh ra để chặn một người vô danh RÚT Kho bạc;
   * một khoản đi vào không rút được gì, và người mua thì đang trả T của chính
   * mình. `tests/cho_mua.test.ts` canh chiều đó bằng số (Kho bạc chỉ tăng).
   */
  'cho.ts': 'chỉ CỘNG 2% phí vào Kho bạc (phi_cho_in) — không có đường rút, nên cổng khách không có gì để chặn',
};

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(),
    appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

/** Tạo một tài khoản khách thật qua đúng cửa công khai, lấy cookie phiên. */
async function moKhach(): Promise<string> {
  const r = await app.request('/api/v1/auth/khach', {
    method: 'POST', headers: { 'content-type': 'application/json' },
  });
  expect(r.status, 'không mở được phiên khách để thử').toBeLessThan(400);
  const sc = r.headers.get('set-cookie') ?? '';
  const ck = sc.split(';')[0] ?? '';
  expect(ck.length, 'cửa khách không trả cookie phiên').toBeGreaterThan(0);
  // B5 (vá đợt 1 Gói 2) — khách qua cổng tuổi trước, như ngoài đời: không thì 403 dưới kia là của cổng tuổi, không phải `chanKhach`.
  const tuoi = await app.request('/api/v1/me/tuoi', {
    method: 'POST', headers: { cookie: ck, 'content-type': 'application/json' },
    body: JSON.stringify({ birth_year: new Date().getUTCFullYear() - 20 }),
  });
  expect(tuoi.status).toBe(200);
  return ck;
}

describe('khách không rút được Kho bạc', () => {
  it.each(Object.entries(CUA_DA_GAC))('%s: khách gọi %o → 403', async (_f, cua) => {
    const cookie = await moKhach();
    const r = await app.request(cua.duong, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
    });
    expect(
      r.status,
      `${cua.duong} (${cua.ly_do}) cho khách đi qua — đây là cửa rút Kho bạc`,
    ).toBe(403);
    const j = await r.json().catch(() => ({}));
    expect(j).toMatchObject({ error: 'khach_khong_duoc' });
  });
});

describe('độ phủ: mọi file có đường chi Kho bạc đều đã được xét', () => {
  it('⭐ không có file chi Kho bạc nào nằm ngoài hai danh sách', () => {
    const thuMuc = resolve(process.cwd(), 'server');
    const coChi = readdirSync(thuMuc)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => {
        const src = readFileSync(resolve(thuMuc, f), 'utf8');
        // Bỏ chú thích trước khi quét: file này và các file khác NHẮC TỚI Kho
        // bạc trong lời văn rất nhiều, và một bài test báo động giả sẽ bị tắt đi.
        const ma = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        return /treasuryAppend\s*\(/.test(ma);
      });

    const chuaXet = coChi.filter((f) => !(f in CUA_DA_GAC) && !(f in KHONG_PHAI_CUA));
    expect(
      chuaXet,
      'file có đường chi Kho bạc mà chưa ai xét: hoặc gắn `chanKhach` rồi khai vào'
      + ' CUA_DA_GAC, hoặc khai vào KHONG_PHAI_CUA kèm lý do',
    ).toEqual([]);
  });

  it('danh sách đã gác không chứa tên file đã biến mất', () => {
    const co = new Set(readdirSync(resolve(process.cwd(), 'server')));
    for (const f of [...Object.keys(CUA_DA_GAC), ...Object.keys(KHONG_PHAI_CUA)]) {
      expect(co.has(f), `${f} khai trong danh sách nhưng không còn trong server/`).toBe(true);
    }
  });
});
