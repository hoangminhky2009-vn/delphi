/**
 * BƯỚC 1 — ĐƯỜNG ỐNG ĐO LƯỜNG (A9; bản yêu cầu 01 §2.6).
 *
 * Đồ THẬT: Hono + PostgreSQL nhúng, không mock (A8.9 — "cấm mock để né thiết kế
 * sai"). Mọi khẳng định dưới đây khoá một BẤT BIẾN, không khoá một cuộc chạy cụ
 * thể (bài học D55).
 *
 * ⚠ BẤT BIẾN ĐẮT NHẤT CỦA CẢ FILE: `events` KHÔNG ĐƯỢC ĐỤNG. Nếu đường mới lỡ
 * ghi vào đó thì dòng rác nằm đó VĨNH VIỄN (A3.3 append-only, xoá không được) và
 * chiếm chỗ của dữ liệu thật. Kiểm ở §VIII.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { TELEMETRY } from '../config/telemetry.js';
import { locSuKien, locChiTiet, locLo } from '../server/telemetry.js';
import { cuonNgay, donHan, cuonTelemetryTick } from '../server/telemetry_cuon.js';
import { CONSENT_PHIEN_BAN } from '../config/pfm_consent.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool,
    mailer: new CapturingMailer(),
    appBaseUrl: 'https://dubao.test',
    secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

/** POST /telemetry. `cookie` vắng = khách chưa đăng nhập. */
const guiLo = async (
  body: unknown,
  opts: { cookie?: string; ip?: string } = {},
): Promise<Response> =>
  app.request('/api/v1/telemetry', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': opts.ip ?? '203.0.113.1',
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    body: JSON.stringify(body),
  });

const demDong = async (u: TestUser): Promise<number> => {
  const { rows } = await pool.query(`SELECT count(*)::int n FROM telemetry WHERE user_id = $1`, [
    u.userId,
  ]);
  return rows[0].n as number;
};

const suKien = (over: Record<string, unknown> = {}) => ({
  loai: 'man_vao',
  man: '/arena',
  ...over,
});

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Lọc — hàm thuần, không cần DB', () => {
  it('loai lạ → null (bỏ im lặng, không ném)', () => {
    expect(locSuKien({ loai: 'khong_ton_tai' })).toBeNull();
    expect(locSuKien({ loai: 42 })).toBeNull();
    expect(locSuKien(null)).toBeNull();
    expect(locSuKien('man_vao')).toBeNull();
  });

  it('man không phải mẫu route → "khac"; vắng → null; mẫu hợp lệ giữ nguyên', () => {
    // ⚠ ĐÂY LÀ CÁI CHỐT CHỐNG PHÌNH BẢNG TỔNG HỢP. Ghi URL cụ thể thì
    // telemetry_ngay đẻ một dòng cho MỖI KÈO MỖI NGÀY — hỏng âm thầm.
    expect(locSuKien(suKien({ man: '/keo/abc-123-def' }))!.man).toBe('khac');
    expect(locSuKien(suKien({ man: '/keo/:marketId' }))!.man).toBe('/keo/:marketId');
    expect(locSuKien(suKien({ man: undefined }))!.man).toBeNull();
  });

  it('ms phi lý bị KẸP, không làm rơi cả dòng', () => {
    expect(locSuKien(suKien({ loai: 'man_ra', ms: -5 }))!.ms).toBe(0);
    expect(locSuKien(suKien({ loai: 'man_ra', ms: 10 * 3600 * 1000 }))!.ms).toBe(
      TELEMETRY.MS_TOI_DA,
    );
    expect(locSuKien(suKien({ loai: 'man_ra', ms: 1234 }))!.ms).toBe(1234);
    expect(locSuKien(suKien({ loai: 'man_ra', ms: 'nhiều' }))!.ms).toBeNull();
  });

  it('lô vượt trần bị CẮT, không 4xx', () => {
    const to = Array.from({ length: TELEMETRY.LO_TOI_DA + 30 }, () => suKien());
    expect(locLo(to)).toHaveLength(TELEMETRY.LO_TOI_DA);
    expect(locLo('không phải mảng')).toEqual([]);
  });

  /*
   * §8.4: nút KHÔNG nằm trong danh sách thì rơi ngay ở tầng lọc. Danh sách nay
   * có ĐÚNG HAI nhãn của bàn cược (16/08) — mỗi nhãn là một cách nhập lệnh,
   * không phải một cú chạm; và bật là phải có ngày rà (A8.9).
   */
  it('cham_nut: nút ngoài danh sách rơi ngay ở tầng lọc; hai nhãn bàn cược đi qua', () => {
    // 12/09 (Q3, C4 'hỏi là đo') — thêm 'vi-sao' + 'so-lien-he', cùng câu hỏi và ngày rà (xem config/telemetry.ts).
    expect([...TELEMETRY.CHAM_NUT_BAT].sort()).toEqual(['shop-chip-truoc', 'shop-la-truoc', 'so-lien-he', 'vi-sao']);
    expect(locSuKien({ loai: 'cham_nut', chi_tiet: { nut: 'chot-vong' } })).toBeNull();
    expect(locSuKien({ loai: 'cham_nut', chi_tiet: { nut: 'shop-chip-truoc' } })).not.toBeNull();
    expect(locSuKien({ loai: 'cham_nut', chi_tiet: { nut: 'shop-la-truoc' } })).not.toBeNull();
  });

  it('cham_nut: bật nhãn nào cũng phải có NGÀY RÀ ở tương lai gần (A8.9)', () => {
    if (TELEMETRY.CHAM_NUT_BAT.length === 0) return;
    expect(TELEMETRY.CHAM_NUT_NGAY_RA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Ngày rà không được là quá khứ xa quá 90 ngày so với hôm nay — quá hạn
    // thì hoặc gỡ nhãn hoặc ghi ngày mới; test đỏ là lời nhắc, không phải lỗi.
    const ra = new Date(TELEMETRY.CHAM_NUT_NGAY_RA).getTime();
    expect(Date.now() - ra).toBeLessThan(90 * 86_400_000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. chi_tiet — danh sách trắng + trần kích cỡ (C7)', () => {
  it('khoá ngoài danh sách trắng KHÔNG có đường đi tiếp', () => {
    const ra = locChiTiet('tran_thoat', { vong: 3, email: 'ai@do.com', ghi_chu: 'dài' });
    expect(ra).toEqual({ vong: 3 });
  });

  it('giá trị kiểu "ma" phải khớp MAU_MA — email không sống sót', () => {
    // Ngay cả khi ai đó nhét email vào ĐÚNG khoá được phép: có `@` ⇒ trượt mẫu.
    expect(locChiTiet('loi_client', { ma: 'hotenmau@example.com' })).toBeNull();
    expect(locChiTiet('loi_client', { ma: 'CÓ HOA VÀ DẤU CÁCH' })).toBeNull();
    expect(locChiTiet('loi_client', { ma: 'timeout' })).toEqual({ ma: 'timeout' });
  });

  it('chi_tiet quá cỡ → bỏ chi_tiet, GIỮ dòng', () => {
    const dai = 'a'.repeat(TELEMETRY.CHI_TIET_TOI_DA_BYTE + 50);
    // Chuỗi dài trượt MAU_MA (trần 40 ký tự) nên đã rơi ở tầng hình dạng;
    // trần byte là lớp cuối, kiểm bằng chính hằng số.
    expect(locChiTiet('loi_client', { ma: dai })).toBeNull();
    const sk = locSuKien({ loai: 'loi_client', chi_tiet: { ma: dai } });
    expect(sk).not.toBeNull();
    expect(sk!.chi_tiet).toBeNull();
  });

  it('loại không khai trường nào → chi_tiet luôn null dù client gửi gì', () => {
    expect(locChiTiet('man_vao', { buoc: 'x', vong: 1, email: 'a@b.c' })).toBeNull();
  });

  it('loi_api: nhận mã lỗi dạng slug, và `man` vẫn là MẪU route', () => {
    const sk = locSuKien({
      loai: 'loi_api', man: '/keo/abc-123', chi_tiet: { ma: 'timeout', duong: '/markets/abc' },
    });
    expect(sk).toMatchObject({ loai: 'loi_api', man: 'khac', chi_tiet: { ma: 'timeout' } });
    // ⚠ `duong` (đường dẫn endpoint) KHÔNG được khai — nó chứa id kèo/trận nên
    // sẽ thổi cardinality đúng như URL thô. Danh sách trắng chặn nó tại đây.
    expect(sk!.chi_tiet).not.toHaveProperty('duong');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Ghi lô + chống gửi lại', () => {
  it('lô 50 → đúng 50 dòng; gửi lại CÙNG key → vẫn 50', async () => {
    const u = await createTestUser(pool);
    const lo = Array.from({ length: 50 }, (_, i) =>
      suKien({ loai: 'man_ra', ms: i * 10 }),
    );
    const key = 'lo-nghiem-thu-0001';

    const r1 = await guiLo({ idempotency_key: key, su_kien: lo }, { cookie: u.cookie });
    expect(r1.status).toBe(202);
    expect(await demDong(u)).toBe(50);

    const r2 = await guiLo({ idempotency_key: key, su_kien: lo }, { cookie: u.cookie });
    expect(r2.status).toBe(202);
    expect(await demDong(u)).toBe(50); // KHÔNG nhân đôi
  });

  it('loai lạ bỏ im lặng, sự kiện hợp lệ CÙNG LÔ vẫn vào đủ', async () => {
    const u = await createTestUser(pool);
    const r = await guiLo(
      {
        idempotency_key: 'lo-hon-hop-0001',
        su_kien: [suKien(), { loai: 'ma_khong_ton_tai' }, suKien({ man: '/vi' }), 'rác', null],
      },
      { cookie: u.cookie },
    );
    expect(r.status).toBe(202);
    expect(await demDong(u)).toBe(2);
  });

  it('thứ tự trong lô giữ nguyên theo id (phễu đọc theo id, không theo ts)', async () => {
    const u = await createTestUser(pool);
    await guiLo(
      {
        idempotency_key: 'lo-thu-tu-0001',
        su_kien: ['b1', 'b2', 'b3'].map((b) => ({ loai: 'dang_ky_buoc', chi_tiet: { buoc: b } })),
      },
      { cookie: u.cookie },
    );
    const { rows } = await pool.query(
      `SELECT chi_tiet->>'buoc' AS b FROM telemetry WHERE user_id = $1 ORDER BY id`,
      [u.userId],
    );
    expect(rows.map((r) => r.b)).toEqual(['b1', 'b2', 'b3']);
  });

  /*
   * MÃ PHIÊN (0028) — thứ duy nhất đếm được phễu của khách CHƯA có tài khoản.
   * ⚠ Rác phải bị BỎ chứ không được ném: cột là kiểu `uuid`, một chuỗi hỏng làm
   * cả lô đổ, mà lỗi ở đường này bị nuốt (202) ⇒ mất im lặng cả lô.
   */
  it('mã phiên đi tới DB; rác thì bỏ mã chứ không mất lô', async () => {
    const u = await createTestUser(pool);
    const p = '33333333-3333-4333-a333-333333333333';
    await guiLo(
      { idempotency_key: 'lo-phien-0001', phien: p, su_kien: [suKien()] },
      { cookie: u.cookie },
    );
    await guiLo(
      { idempotency_key: 'lo-phien-0002', phien: '<script>', su_kien: [suKien()] },
      { cookie: u.cookie },
    );
    const { rows } = await pool.query(
      `SELECT phien FROM telemetry WHERE user_id = $1 ORDER BY id`, [u.userId]);
    expect(rows.map((r) => r.phien)).toEqual([p, null]);
  });

  it('body rỗng / không phải JSON → 202, không nổ', async () => {
    const u = await createTestUser(pool);
    expect((await guiLo({}, { cookie: u.cookie })).status).toBe(202);
    expect((await guiLo({ su_kien: [] }, { cookie: u.cookie })).status).toBe(202);
    expect(await demDong(u)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. Không tin client về danh tính và thời gian', () => {
  it('user_id trong body BỊ BỎ QUA — luôn lấy từ phiên', async () => {
    const toi = await createTestUser(pool);
    const nanNhan = await createTestUser(pool);
    await guiLo(
      { idempotency_key: 'lo-gia-mao-0001', user_id: nanNhan.userId, su_kien: [suKien()] },
      { cookie: toi.cookie },
    );
    expect(await demDong(toi)).toBe(1);
    expect(await demDong(nanNhan)).toBe(0);
  });

  it('ts do SERVER đặt — client gửi ts quá khứ cũng không đổi được', async () => {
    const u = await createTestUser(pool);
    await guiLo(
      {
        idempotency_key: 'lo-thoi-gian-001',
        su_kien: [suKien({ ts: '2020-01-01T00:00:00Z' })],
      },
      { cookie: u.cookie },
    );
    const { rows } = await pool.query(
      `SELECT ts > now() - interval '1 minute' AS moi FROM telemetry WHERE user_id = $1`,
      [u.userId],
    );
    expect(rows[0].moi).toBe(true);
  });

  it('khách chưa đăng nhập ghi được, user_id NULL', async () => {
    const truoc = await pool.query(`SELECT count(*)::int n FROM telemetry WHERE user_id IS NULL`);
    const r = await guiLo(
      { idempotency_key: 'lo-khach-00001', su_kien: [suKien({ man: '/onboard' })] },
      { ip: '203.0.113.77' },
    );
    expect(r.status).toBe(202);
    const sau = await pool.query(`SELECT count(*)::int n FROM telemetry WHERE user_id IS NULL`);
    expect(sau.rows[0].n).toBe(truoc.rows[0].n + 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V. Rate limit', () => {
  it('user vượt trần → 429, và KHÔNG ghi thêm dòng nào', async () => {
    const u = await createTestUser(pool);
    // Mồi thẳng bằng SQL: thứ đang test là CÁI CỬA, không phải tốc độ chèn.
    await pool.query(
      `INSERT INTO telemetry (user_id, loai) SELECT $1, 'man_vao' FROM generate_series(1, $2)`,
      [u.userId, TELEMETRY.TRAN_MOI_USER],
    );
    const r = await guiLo(
      { idempotency_key: 'lo-qua-tran-001', su_kien: [suKien()] },
      { cookie: u.cookie },
    );
    expect(r.status).toBe(429);
    expect(await demDong(u)).toBe(TELEMETRY.TRAN_MOI_USER);
  });

  it('khách vượt trần theo IP → 429', async () => {
    const ip = '198.51.100.42';
    await pool.query(
      `INSERT INTO auth_attempts (bucket) SELECT $1 FROM generate_series(1, $2)`,
      [`tele:ip:${ip}`, TELEMETRY.KHACH_TRAN_MOI_IP],
    );
    const r = await guiLo({ idempotency_key: 'lo-khach-tran-1', su_kien: [suKien()] }, { ip });
    expect(r.status).toBe(429);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VI. Cuộn ngày', () => {
  /** Ghi thô với ts ép cứng — kiểm được biên ngày mà không cần chờ tới mai. */
  const ghiTho = (userId: string | null, ts: string, loai: string, ms: number | null) =>
    pool.query(
      `INSERT INTO telemetry (user_id, ts, loai, man, ms) VALUES ($1, $2::timestamptz, $3, '/arena', $4)`,
      [userId, ts, loai, ms],
    );

  it('cuộn ra đúng số; chạy HAI LẦN cho cùng một ngày ⇒ KHÔNG ĐỔI', async () => {
    const a = await createTestUser(pool);
    const b = await createTestUser(pool);
    await pool.query(`UPDATE users SET age_band = '16-17' WHERE user_id = $1`, [a.userId]);
    await pool.query(`UPDATE users SET age_band = '23-30' WHERE user_id = $1`, [b.userId]);

    for (const ms of [100, 200, 300]) await ghiTho(a.userId, '2026-05-10T09:00:00+07', 'man_ra', ms);
    await ghiTho(b.userId, '2026-05-10T21:00:00+07', 'man_ra', 500);

    const lan1 = await cuonNgay(pool, '2026-05-10');
    const doc = async () =>
      (
        await pool.query(
          `SELECT age_band, so_luot, so_nguoi, ms_p50, ms_p90 FROM telemetry_ngay
            WHERE ngay = '2026-05-10' AND loai = 'man_ra' ORDER BY age_band`,
        )
      ).rows;
    const sau1 = await doc();

    expect(lan1).toBe(2); // hai nhóm tuổi ⇒ hai ô
    expect(sau1).toEqual([
      { age_band: '16-17', so_luot: 3, so_nguoi: 1, ms_p50: 200, ms_p90: 280 },
      { age_band: '23-30', so_luot: 1, so_nguoi: 1, ms_p50: 500, ms_p90: 500 },
    ]);

    // ⚠ BẤT BIẾN QUAN TRỌNG NHẤT CỦA BƯỚC NÀY.
    await cuonNgay(pool, '2026-05-10');
    expect(await doc()).toEqual(sau1);
  });

  it('cắt ngày theo GIỜ VIỆT NAM, không theo UTC', async () => {
    const u = await createTestUser(pool);
    /*
     * 02:00 giờ VN ngày 12/05 = 19:00Z ngày 11/05. Cắt theo UTC thì dòng này
     * rơi nhầm sang ngày 11 — và cả câu hỏi "chơi mấy giờ" đi theo nó (A8.8).
     */
    await ghiTho(u.userId, '2026-05-12T02:00:00+07', 'phien_mo', null);
    await cuonNgay(pool, '2026-05-11');
    await cuonNgay(pool, '2026-05-12');
    const { rows } = await pool.query(
      `SELECT ngay::text, so_luot FROM telemetry_ngay
        WHERE loai = 'phien_mo' AND ngay IN ('2026-05-11','2026-05-12')`,
    );
    expect(rows).toEqual([{ ngay: '2026-05-12', so_luot: 1 }]);
  });

  it('khách chưa đăng nhập ⇒ age_band NULL, vẫn cuộn được (không rơi vì NULL)', async () => {
    await ghiTho(null, '2026-05-13T10:00:00+07', 'dang_ky_buoc', null);
    await cuonNgay(pool, '2026-05-13');
    const { rows } = await pool.query(
      `SELECT age_band, so_luot, so_nguoi FROM telemetry_ngay
        WHERE ngay = '2026-05-13' AND loai = 'dang_ky_buoc'`,
    );
    expect(rows).toEqual([{ age_band: null, so_luot: 1, so_nguoi: 0 }]);
  });

  it('KHỐI THEO NHÓM (0026): đủ ba chiều nhân khẩu, và ms_tong là phép CỘNG', async () => {
    const u = await createTestUser(pool);
    await pool.query(
      `UPDATE users SET age_band='23-30', region='nam', occupation_band='van_phong'
        WHERE user_id = $1`, [u.userId],
    );
    for (const ms of [1000, 2000, 3000]) {
      await ghiTho(u.userId, '2026-05-20T09:00:00+07', 'phien_dong', ms);
    }
    await cuonNgay(pool, '2026-05-20');

    const { rows } = await pool.query(
      `SELECT age_band, region, occupation_band, so_luot, so_nguoi, ms_tong::int, ms_p50
         FROM telemetry_ngay_nhom WHERE ngay='2026-05-20' AND loai='phien_dong'`,
    );
    expect(rows).toEqual([{
      age_band: '23-30', region: 'nam', occupation_band: 'van_phong',
      so_luot: 3, so_nguoi: 1, ms_tong: 6000, ms_p50: 2000,
    }]);

    /*
     * ⚠ `ms_tong` không suy ngược ra được từ p50/p90 sau khi đã cuộn. "Chơi
     * mấy giờ" là một phép CỘNG, và nếu không lưu ở đây thì câu hỏi đó mất
     * vĩnh viễn cùng lúc bản thô hết hạn 90 ngày.
     */
    const cuMan = await pool.query(
      `SELECT ms_tong::int FROM telemetry_ngay WHERE ngay='2026-05-20' AND loai='phien_dong'`,
    );
    expect(cuMan.rows[0].ms_tong).toBe(6000);
  });

  it('cuộn HAI LẦN: CẢ HAI khối đều không đổi', async () => {
    // `ms_tong` là BIGINT → pg trả BigInt (testdb.ts), mà JSON.stringify không
    // nuốt BigInt. Ép chuỗi trong replacer thay vì đổi truy vấn: so sánh phải
    // thấy ĐÚNG mọi cột, kể cả cột mới thêm sau này.
    const chuoi = (x: unknown) => JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? String(v) : v));
    const doc = async () => chuoi([
      (await pool.query(`SELECT * FROM telemetry_ngay ORDER BY loai, man NULLS FIRST, age_band NULLS FIRST`)).rows,
      (await pool.query(`SELECT * FROM telemetry_ngay_nhom ORDER BY loai, age_band NULLS FIRST`)).rows,
    ]);
    await cuonNgay(pool, '2026-05-20');
    const truoc = await doc();
    await cuonNgay(pool, '2026-05-20');
    expect(await doc()).toBe(truoc);
  });

  it('khách chưa đăng nhập rơi vào ô ba chiều NULL, không bị mất', async () => {
    await ghiTho(null, '2026-05-21T10:00:00+07', 'man_vao', null);
    await cuonNgay(pool, '2026-05-21');
    const { rows } = await pool.query(
      `SELECT age_band, region, occupation_band, so_luot FROM telemetry_ngay_nhom
        WHERE ngay='2026-05-21' AND loai='man_vao'`,
    );
    expect(rows).toEqual([
      { age_band: null, region: null, occupation_band: null, so_luot: 1 },
    ]);
  });

  it('tick chỉ cuộn ngày ĐÃ ĐÓNG — hôm nay không bị đụng', async () => {
    await pool.query(`DELETE FROM telemetry_cuon`);
    await pool.query(`INSERT INTO telemetry_cuon (ngay, so_dong) VALUES ('2026-06-01', 0)`);
    const u = await createTestUser(pool);
    await ghiTho(u.userId, '2026-06-02T10:00:00+07', 'man_vao', null);
    await ghiTho(u.userId, '2026-06-03T10:00:00+07', 'man_vao', null);

    // "Bây giờ" = giữa ngày 03 giờ VN ⇒ chỉ ngày 02 đã đóng.
    const bc = await cuonTelemetryTick(pool, new Date('2026-06-03T05:00:00Z'));
    expect(bc.ngay_da_cuon).toEqual(['2026-06-02']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VII. Dọn hạn', () => {
  it('KHÔNG xoá thô khi chưa cuộn lần nào (fail-closed, chống mất dữ liệu)', async () => {
    await pool.query(`DELETE FROM telemetry_cuon`);
    const u = await createTestUser(pool);
    await pool.query(
      `INSERT INTO telemetry (user_id, ts, loai) VALUES ($1, now() - interval '200 days', 'man_vao')`,
      [u.userId],
    );
    const kq = await donHan(pool);
    expect(kq.xoa_tho).toBe(0);
    expect(await demDong(u)).toBe(1);
  });

  it('xoá đúng phần thô quá hạn, KHÔNG đụng telemetry_ngay', async () => {
    const u = await createTestUser(pool);
    await pool.query(
      `INSERT INTO telemetry (user_id, ts, loai) VALUES
         ($1, now() - interval '200 days', 'man_vao'),
         ($1, now() - interval '10 days',  'man_vao')`,
      [u.userId],
    );
    // Mốc cuộn phải đi TRƯỚC thì cửa xoá mới mở (xem donHan).
    await pool.query(
      `INSERT INTO telemetry_cuon (ngay, so_dong) VALUES ((now() - interval '1 day')::date, 0)
       ON CONFLICT (ngay) DO NOTHING`,
    );
    const truocNgay = (await pool.query(`SELECT count(*)::int n FROM telemetry_ngay`)).rows[0].n;

    await donHan(pool);

    expect(await demDong(u)).toBe(1); // dòng 200 ngày đi, dòng 10 ngày ở lại
    const sauNgay = (await pool.query(`SELECT count(*)::int n FROM telemetry_ngay`)).rows[0].n;
    expect(sauNgay).toBe(truocNgay); // bảng cuộn giữ VĨNH VIỄN
  });

  it('dọn khoá lô quá TTL', async () => {
    await pool.query(
      `INSERT INTO telemetry_lo (lo_key, at) VALUES ('lo-qua-han-0001', now() - interval '48 hours')`,
    );
    await donHan(pool);
    const { rows } = await pool.query(
      `SELECT count(*)::int n FROM telemetry_lo WHERE lo_key = 'lo-qua-han-0001'`,
    );
    expect(rows[0].n).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VIII. Tường lửa A9 — events không bị đụng một dòng nào', () => {
  it('cả đường ống (ghi + cuộn + dọn) không thêm/bớt một event nào', async () => {
    const demEvents = async () =>
      (await pool.query(`SELECT count(*)::int n FROM events`)).rows[0].n as number;
    const truoc = await demEvents();

    const u = await createTestUser(pool);
    await guiLo(
      {
        idempotency_key: 'lo-tuong-lua-01',
        su_kien: [
          suKien(),
          { loai: 'huong_dan_buoc', chi_tiet: { buoc: 'mo-shop' } },
          { loai: 'tran_thoat', chi_tiet: { vong: 4 } },
          { loai: 'loi_client', chi_tiet: { ma: 'timeout' } },
        ],
      },
      { cookie: u.cookie },
    );
    await cuonTelemetryTick(pool, new Date('2026-06-03T05:00:00Z'));
    await donHan(pool);

    expect(await demEvents()).toBe(truoc);
    expect(await demDong(u)).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IX. CỔNG ĐỒNG Ý — điều khoản §5.4 phải đúng bằng CODE', () => {
  /*
   * ⚠ VÌ SAO BỘ NÀY TỒN TẠI: trước 03/08, `research_consent` là CỘT CHẾT —
   * ghi lúc onboarding, đọc ra để hiện trên màn quản trị, và KHÔNG một truy vấn
   * nào lọc theo nó. Tức cái ô tích đang nói dối người tích nó. Đó là "cơ chế
   * trang trí" lần thứ 17, nhưng ở dạng tệ nhất: nó không hỏng một tính năng
   * nào, nó hỏng một LỜI HỨA.
   *
   * Cách thi hành đã chọn là chặn ở chỗ GHI chứ không lọc ở chỗ ĐỌC — không có
   * dòng nào thì không có gì để quên lọc. Mấy bài dưới khoá đúng điều đó.
   */
  it('CHƯA đồng ý ⇒ KHÔNG ghi một dòng telemetry nào', async () => {
    const u = await createTestUser(pool);
    await pool.query(`UPDATE users SET research_consent = FALSE WHERE user_id = $1`, [u.userId]);

    const r = await guiLo(
      { idempotency_key: 'lo-tat-dong-y-1', su_kien: [suKien(), suKien(), suKien()] },
      { cookie: u.cookie },
    );

    // 202 chứ không 4xx: người đã tắt KHÔNG cần biết client của họ vẫn gửi, và
    // báo lỗi thì client sẽ thử lại mãi mãi.
    expect(r.status).toBe(202);
    expect(await demDong(u), 'tắt đồng ý mà vẫn ghi = điều khoản nói dối').toBe(0);
  });

  it('ĐÃ đồng ý ⇒ ghi bình thường (đối chứng — chứng minh cổng không chặn nhầm)', async () => {
    const u = await createTestUser(pool); // fixture đặt TRUE
    await guiLo(
      { idempotency_key: 'lo-bat-dong-y-1', su_kien: [suKien(), suKien()] },
      { cookie: u.cookie },
    );
    expect(await demDong(u)).toBe(2);
  });

  it('BẬT LẠI thì ghi tiếp — quyết định không bị khoá vĩnh viễn', async () => {
    const u = await createTestUser(pool);
    await pool.query(`UPDATE users SET research_consent = FALSE WHERE user_id = $1`, [u.userId]);
    await guiLo({ idempotency_key: 'lo-doi-y-tat-1', su_kien: [suKien()] }, { cookie: u.cookie });
    expect(await demDong(u)).toBe(0);

    const bat = await app.request('/api/v1/account/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: u.cookie },
      body: JSON.stringify({ research_consent: true, van_ban_id: 'nghien_cuu', phien_ban: CONSENT_PHIEN_BAN.nghien_cuu }),   // 0079 — bật kèm văn bản
    });
    expect(bat.status).toBe(200);

    await guiLo({ idempotency_key: 'lo-doi-y-bat-1', su_kien: [suKien()] }, { cookie: u.cookie });
    expect(await demDong(u)).toBe(1);
  });

  it('TẮT qua endpoint ⇒ ngừng ghi NGAY, không cần đăng nhập lại', async () => {
    const u = await createTestUser(pool);
    await guiLo({ idempotency_key: 'lo-truoc-tat-01', su_kien: [suKien()] }, { cookie: u.cookie });
    expect(await demDong(u)).toBe(1);

    await app.request('/api/v1/account/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: u.cookie },
      body: JSON.stringify({ research_consent: false }),
    });

    await guiLo({ idempotency_key: 'lo-sau-tat-001', su_kien: [suKien()] }, { cookie: u.cookie });
    expect(await demDong(u), 'phải vẫn là 1 — lô sau khi tắt không được vào').toBe(1);
  });

  it('KHÁCH chưa đăng nhập KHÔNG bị cổng này chặn', async () => {
    /*
     * Khách không có tài khoản nên không có ô đồng ý để tích. Chặn họ là mù
     * luôn phễu đăng ký — đúng chỗ rò rỉ lớn nhất mà cả đường ống này sinh ra
     * để soi. Dữ liệu của khách không gắn với ai (user_id NULL).
     */
    const truoc = await pool.query(`SELECT count(*)::int n FROM telemetry WHERE user_id IS NULL`);
    const r = await guiLo(
      { idempotency_key: 'lo-khach-congdy', su_kien: [suKien({ man: '/onboard' })] },
      { ip: '203.0.113.91' },
    );
    expect(r.status).toBe(202);
    const sau = await pool.query(`SELECT count(*)::int n FROM telemetry WHERE user_id IS NULL`);
    expect(sau.rows[0].n).toBe(truoc.rows[0].n + 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('X. CỔNG ĐIỀU KHOẢN — chỉ khoá XẾP HẠNG, không khoá chơi tự do', () => {
  /*
   * ⚠ ĐÂY LÀ CƠ CHẾ KHÁC với bộ IX, dù dùng chung một cột:
   *   · IX = "không đồng ý thì KHÔNG GHI" (bảo vệ người dùng);
   *   · X  = "không đồng ý thì KHÔNG CHƠI" (điều kiện dùng dịch vụ).
   * Cả hai cùng đọc `research_consent`, nên một bài test cho cả hai sẽ xanh vì
   * lý do sai. Tách bộ, đặt tên rõ.
   *
   * ⚠ CỔNG ĐỨNG Ở CHỖ CÓ NGƯỜI KHÁC (founder sửa 03/08). Bản đầu chặn MỌI
   * trận, kể cả chơi một mình với bot — nhưng ép đồng ý để được chơi thì
   * "đồng ý" không còn là đồng ý, nó là phí vào cửa trả bằng dữ liệu. Ranh
   * giới đúng: chơi TỰ DO thì không ai thấy bạn nên không cần thoả thuận gì;
   * XẾP HẠNG là lúc tên bạn đứng trên bảng chung cạnh người lạ.
   */
  const taoTranQuaApi = (cookie: string, body: Record<string, unknown>) =>
    app.request('/api/v1/holdem/matches', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    });

  it('⭐ CHƯA đồng ý ⇒ vẫn CHƠI TỰ DO được (đây là điểm chính của bản sửa)', async () => {
    const u = await createTestUser(pool);
    await pool.query(`UPDATE users SET research_consent = FALSE WHERE user_id = $1`, [u.userId]);

    const r = await taoTranQuaApi(u.cookie, {});
    expect(r.status, 'chơi một mình mà bị chặn = ép đồng ý để được chơi').not.toBe(403);
  });

  it('CHƯA đồng ý ⇒ XẾP HẠNG bị 403 chua_dong_y', async () => {
    const u = await createTestUser(pool);
    await pool.query(`UPDATE users SET research_consent = FALSE WHERE user_id = $1`, [u.userId]);

    const r = await taoTranQuaApi(u.cookie, { che_do: 'rank_pve' });
    expect(r.status).toBe(403);
    const body = (await r.json()) as { error: string; message: string };
    expect(body.error).toBe('chua_dong_y');
    // Thông điệp phải nói CẢ đường ra LẪN việc tự do vẫn chơi được.
    expect(body.message).toMatch(/Hồ sơ/);
    expect(body.message).toMatch(/tự do/);
  });

  it('ĐÃ đồng ý ⇒ xếp hạng KHÔNG bị chặn (đối chứng)', async () => {
    const u = await createTestUser(pool); // fixture đặt TRUE
    const r = await taoTranQuaApi(u.cookie, { che_do: 'rank_pve' });
    expect(r.status, 'đồng ý rồi mà vẫn 403 = cổng chặn nhầm').not.toBe(403);
  });

  it('BẬT LẠI ⇒ xếp hạng mở ngay, không cần đăng nhập lại', async () => {
    const u = await createTestUser(pool);
    await pool.query(`UPDATE users SET research_consent = FALSE WHERE user_id = $1`, [u.userId]);
    expect((await taoTranQuaApi(u.cookie, { che_do: 'rank_pve' })).status).toBe(403);

    await app.request('/api/v1/account/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: u.cookie },
      body: JSON.stringify({ research_consent: true, van_ban_id: 'nghien_cuu', phien_ban: CONSENT_PHIEN_BAN.nghien_cuu }),   // 0079 — bật kèm văn bản
    });

    const mo = await taoTranQuaApi(u.cookie, { che_do: 'rank_pve' });
    expect(mo.status, 'bật lại mà vẫn khoá = cổng không đọc trạng thái mới').not.toBe(403);
  });

  it('tắt đồng ý vẫn xem được ví/hồ sơ — Hồ sơ chính là chỗ bật lại', async () => {
    /*
     * Khoá luôn đường vào Hồ sơ là nhốt người ta ngoài cửa rồi giấu chìa khoá
     * bên trong.
     */
    const u = await createTestUser(pool);
    await pool.query(`UPDATE users SET research_consent = FALSE WHERE user_id = $1`, [u.userId]);

    for (const path of ['/api/v1/auth/me', '/api/v1/wallet']) {
      const r = await app.request(path, { headers: { cookie: u.cookie } });
      expect(r.status, `${path} không được bị cổng chặn`).not.toBe(403);
    }
  });
});
