/**
 * QUÀ TRI ÂN MÙA BETA — test DB THẬT, đi qua HTTP (D68b, 04/08).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ĐÂY LÀ CỬA CHI KHO BẠC DUY NHẤT NGOÀI TRỢ CẤP, nên bốn bất biến dưới đây
 * quan trọng hơn mọi thứ khác trong file:
 *
 *   1. KHÔNG MINT. 500 T vào ví người chơi phải RA từ Kho bạc, đồng-đối-đồng.
 *      `auditSupply` là trọng tài, không phải phép cộng của test.
 *   2. TRẦN 30 NGƯỜI là TRẦN THẬT, kể cả khi 30+ người bấm CÙNG LÚC. Đây là bài
 *      đắt nhất: `COUNT` rồi `INSERT` ở READ COMMITTED KHÔNG đủ, và cái sai đó
 *      không nổ — nó chỉ làm kho hụt 500 T mỗi người vượt trần.
 *   3. KHÔNG NHẬN HAI LẦN, kể cả hai tab bấm cùng nhịp.
 *   4. CHƯA ĐỦ ĐIỀU KIỆN thì không được một đồng nào — founder dựng điều kiện
 *      chính vì tài khoản rỗng, nên rò ở đây là hỏng đúng thứ nó sinh ra để chặn.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { DIEU_KIEN_QUA_BETA, QUA_BETA } from '../config/qua_beta.js';
import { MUA_0_0, VIEC_LOI } from '../config/progression.js';
import { auditSupply } from '../server/audit.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { createTestUser, ensureGenesis } from './helpers/fixtures.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';

describe('Quà tri ân mùa beta', () => {
  let db: TestDb;
  let pool: pg.Pool;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    db = await startTestDb();
    pool = db.pool;
    await ensureGenesis(pool);
    app = createApp({
      pool, mailer: new CapturingMailer(),
      appBaseUrl: 'https://dubao.test', secureCookie: false,
    });
  }, 180_000);
  afterAll(async () => { await db?.stop(); });

  const goi = (p: string, cookie: string, body?: unknown) =>
    app.request(`http://x${p}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  /** Dựng ĐÚNG điều kiện: 4 việc lõi xong + 3 trận đã chơi. */
  async function choDuDieuKien(userId: string): Promise<void> {
    for (const nv of VIEC_LOI) {
      await pool.query(
        `INSERT INTO nhiem_vu_xong (user_id, season_id, cua_so_key, nv_id)
         VALUES ($1, $2, 'W1', $3) ON CONFLICT DO NOTHING`,
        [userId, MUA_0_0.SEASON_ID, nv.nv_id],
      );
    }
    for (let i = 0; i < DIEU_KIEN_QUA_BETA.SO_TRAN; i += 1) {
      /*
       * `holdem_results.match_id` là FK sang `holdem_matches`, nên phải dựng
       * trận thật chứ không `gen_random_uuid()`. Cùng hình dạng `holdem_api.ts`
       * ghi (xem `ghiPhien` trong tests/nhiem_vu.test.ts) — fixture đi chệch
       * hình dạng thật là fixture đo một thứ không tồn tại.
       */
      const { rows } = await pool.query(
        `INSERT INTO holdem_matches
           (owner_user_id, seed, status, ghe_json, engine_version, balance_version,
            season_id, started_at, ended_at)
         VALUES ($1, $2, 'xong', '[]'::jsonb, 'test', 'test', $3, now(), now())
         RETURNING match_id`,
        [userId, 1000 + i, MUA_0_0.SEASON_ID],
      );
      await pool.query(
        `INSERT INTO holdem_results
           (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, danh_muc_json)
         VALUES ($1, $2, 'ban', 'nguoi', 'TẬP SỰ', 1, 10000, '{}'::jsonb)`,
        [rows[0].match_id, userId],
      );
    }
  }

  const khoBac = async (): Promise<bigint> => BigInt(
    (await pool.query(
      `SELECT COALESCE((SELECT balance_after FROM treasury_ledger
                         ORDER BY entry_id DESC LIMIT 1), 0)::text AS s`)).rows[0].s);

  const viCua = async (userId: string): Promise<bigint> => BigInt(
    (await pool.query('SELECT bankroll FROM users WHERE user_id = $1', [userId]))
      .rows[0].bankroll);

  /** Dọn sổ nhận giữa các bài — trần 30 là tài nguyên dùng chung của cả file. */
  async function donSoNhan(): Promise<void> {
    await pool.query('DELETE FROM qua_beta_nhan');
  }

  it('CHƯA đủ điều kiện → tiến độ nói RÕ còn thiếu gì, chưa cho nhận', async () => {
    const u = await createTestUser(pool);
    const j = await (await goi('/api/v1/me/qua-beta', u.cookie)).json() as {
      du_dieu_kien: boolean; viec_loi_xong: number; viec_loi_can: number;
      so_tran: number; so_tran_can: number; qua: { t: number; q: number };
    };
    expect(j.du_dieu_kien).toBe(false);
    expect(j.viec_loi_xong).toBe(0);
    expect(j.viec_loi_can).toBe(DIEU_KIEN_QUA_BETA.VIEC_LOI_XONG);
    expect(j.so_tran).toBe(0);
    expect(j.so_tran_can).toBe(DIEU_KIEN_QUA_BETA.SO_TRAN);
    // Bốn món phải hiện TRƯỚC khi đủ — người ta cần biết đang cày vì cái gì.
    expect(j.qua.t).toBe(QUA_BETA.T);
    expect(j.qua.q).toBe(QUA_BETA.Q);
  });

  it('⭐ CHƯA đủ điều kiện mà bấm nhận → TỪ CHỐI, không một đồng nào rời kho', async () => {
    const u = await createTestUser(pool);
    const khoTruoc = await khoBac();
    const viTruoc = await viCua(u.userId);

    const r = await goi('/api/v1/me/qua-beta/nhan', u.cookie, {});
    expect(r.status).toBe(409);
    expect((await r.json() as { error: string }).error).toBe('chua_du_dieu_kien');

    expect(await khoBac()).toBe(khoTruoc);
    expect(await viCua(u.userId)).toBe(viTruoc);
  });

  it('đủ 4 việc lõi NHƯNG thiếu trận → vẫn từ chối (hai điều kiện, không phải một)',
    async () => {
      const u = await createTestUser(pool);
      for (const nv of VIEC_LOI) {
        await pool.query(
          `INSERT INTO nhiem_vu_xong (user_id, season_id, cua_so_key, nv_id)
           VALUES ($1, $2, 'W1', $3) ON CONFLICT DO NOTHING`,
          [u.userId, MUA_0_0.SEASON_ID, nv.nv_id],
        );
      }
      const r = await goi('/api/v1/me/qua-beta/nhan', u.cookie, {});
      expect(r.status).toBe(409);
    });

  it('⚠ điểm danh nhiều TUẦN không thay được bốn việc KHÁC NHAU', async () => {
    /*
     * `nhiem_vu_xong` có khoá (user, season, cửa_sổ, nv_id) nên cùng một việc
     * xong ở 4 tuần cho 4 DÒNG. Đếm dòng thay vì `COUNT(DISTINCT nv_id)` thì
     * điểm danh đều 4 tuần tự nó "đủ 4 việc" — điều kiện thành vô nghĩa mà
     * không ai thấy.
     */
    const u = await createTestUser(pool);
    for (let t = 1; t <= 4; t += 1) {
      await pool.query(
        `INSERT INTO nhiem_vu_xong (user_id, season_id, cua_so_key, nv_id)
         VALUES ($1, $2, $3, 'co_mat') ON CONFLICT DO NOTHING`,
        [u.userId, MUA_0_0.SEASON_ID, `W${t}`],
      );
    }
    const j = await (await goi('/api/v1/me/qua-beta', u.cookie)).json() as {
      viec_loi_xong: number; du_dieu_kien: boolean;
    };
    expect(j.viec_loi_xong, 'đếm nhầm DÒNG thay vì việc khác nhau').toBe(1);
    expect(j.du_dieu_kien).toBe(false);
  });

  it('⭐⭐ ĐỦ ĐIỀU KIỆN → nhận đủ BỐN MÓN, và 500 T RA TỪ KHO BẠC', async () => {
    await donSoNhan();
    const u = await createTestUser(pool);
    await choDuDieuKien(u.userId);

    const khoTruoc = await khoBac();
    const viTruoc = await viCua(u.userId);

    const r = await goi('/api/v1/me/qua-beta/nhan', u.cookie, {});
    expect(r.status).toBe(200);
    const j = await r.json() as {
      so_thu_tu: number; bankroll: number; quest_points: number;
      the_tao_phong: number; sticker_id: string;
    };

    // 1. T: ví CỘNG đúng bằng số kho bạc TRỪ — không mint một đồng nào.
    expect(await viCua(u.userId)).toBe(viTruoc + BigInt(QUA_BETA.T));
    expect(await khoBac()).toBe(khoTruoc - BigInt(QUA_BETA.T));
    expect(j.bankroll).toBe(Number(viTruoc) + QUA_BETA.T);

    // 2. Q
    expect(j.quest_points).toBe(QUA_BETA.Q);
    const { rows: q } = await pool.query(
      `SELECT delta, reason FROM quest_ledger WHERE user_id = $1`, [u.userId]);
    expect(q).toHaveLength(1);
    expect(Number(q[0].delta)).toBe(QUA_BETA.Q);
    expect(q[0].reason).toBe('qua_beta_q');

    // 3. Thẻ tạo phòng
    expect(j.the_tao_phong).toBe(QUA_BETA.THE_PHONG);

    // 4. Dấu niêm Beta — vào kho THẬT, qua đúng phép đếm của shop.
    const { rows: kho } = await pool.query(
      `SELECT so_luong FROM kho_sticker WHERE user_id = $1 AND sticker_id = $2`,
      [u.userId, QUA_BETA.STICKER_ID]);
    expect(Number(kho[0].so_luong)).toBeGreaterThanOrEqual(1);

    expect(j.so_thu_tu).toBe(1);
  });

  it('⭐⭐ KHÔNG MINT: sau khi phát quà, bất biến cung tiền vẫn CÂN (A3.4)', async () => {
    await donSoNhan();
    const u = await createTestUser(pool);
    await choDuDieuKien(u.userId);
    expect((await goi('/api/v1/me/qua-beta/nhan', u.cookie, {})).status).toBe(200);
    const kq = await auditSupply(pool);
    expect(kq.ok, `audit lệch: ${JSON.stringify(kq.problems ?? kq)}`).toBe(true);
  });

  it('⭐ NHẬN HAI LẦN: lần thứ hai bị từ chối, không cộng thêm gì', async () => {
    await donSoNhan();
    const u = await createTestUser(pool);
    await choDuDieuKien(u.userId);
    expect((await goi('/api/v1/me/qua-beta/nhan', u.cookie, {})).status).toBe(200);

    const viSauLan1 = await viCua(u.userId);
    const khoSauLan1 = await khoBac();

    const r2 = await goi('/api/v1/me/qua-beta/nhan', u.cookie, {});
    expect(r2.status).toBe(409);
    expect((await r2.json() as { error: string }).error).toBe('da_nhan');
    expect(await viCua(u.userId)).toBe(viSauLan1);
    expect(await khoBac()).toBe(khoSauLan1);
  });

  it('⭐ HAI TAB BẤM CÙNG LÚC → đúng MỘT lần nhận (đua ghi)', async () => {
    await donSoNhan();
    const u = await createTestUser(pool);
    await choDuDieuKien(u.userId);
    const khoTruoc = await khoBac();

    const res = await Promise.all([
      goi('/api/v1/me/qua-beta/nhan', u.cookie, {}),
      goi('/api/v1/me/qua-beta/nhan', u.cookie, {}),
      goi('/api/v1/me/qua-beta/nhan', u.cookie, {}),
    ]);
    expect(res.filter((x) => x.status === 200)).toHaveLength(1);
    // Kho chỉ mất ĐÚNG một suất.
    expect(await khoBac()).toBe(khoTruoc - BigInt(QUA_BETA.T));
  });

  it('⭐⭐ TRẦN NGƯỜI LÀ TRẦN THẬT — kể cả khi tất cả bấm CÙNG LÚC', async () => {
    /*
     * Bài đắt nhất file. `SELECT COUNT(*)` rồi `INSERT` ở READ COMMITTED KHÔNG
     * giữ nổi trần: nhiều transaction cùng đọc "còn chỗ" rồi cùng chèn, và
     * `qua_beta_nhan.user_id` (PK) không cứu được vì đó là những NGƯỜI KHÁC
     * NHAU. Cái sai đó không nổ — nó chỉ rút thêm 500 T mỗi người vượt trần,
     * và chỉ lộ ra khi kho cạn giữa chừng.
     *
     * Trần thật giữ bằng `pg_advisory_xact_lock` (`QUA_BETA_LOCK_KEY`).
     * Dùng trần NHỎ cho nhanh: đặt sổ gần đầy rồi cho một tốp chen vào chỗ cuối.
     */
    await donSoNhan();
    const conLai = 2;
    // Lấp sổ tới sát trần bằng người giả (không cấp quà — chỉ chiếm suất).
    for (let i = 1; i <= QUA_BETA.TRAN_NGUOI - conLai; i += 1) {
      const gia = await createTestUser(pool);
      await pool.query(
        `INSERT INTO qua_beta_nhan (user_id, season_id, so_thu_tu, so_t, so_q, so_the)
         VALUES ($1, $2, $3, 0, 0, 0)`,
        [gia.userId, MUA_0_0.SEASON_ID, i],
      );
    }

    const doiThu = await Promise.all(
      Array.from({ length: 6 }, () => createTestUser(pool)));
    for (const u of doiThu) await choDuDieuKien(u.userId);

    const khoTruoc = await khoBac();
    const res = await Promise.all(
      doiThu.map((u) => goi('/api/v1/me/qua-beta/nhan', u.cookie, {})));

    const thanhCong = res.filter((x) => x.status === 200).length;
    expect(thanhCong, `${thanhCong} người nhận trong khi chỉ còn ${conLai} suất`)
      .toBe(conLai);

    /*
     * ⭐ NGƯỜI THUA ĐUA PHẢI NHẬN 409 TỬ TẾ, KHÔNG PHẢI 500 — và đây là bài đo
     * THẲNG giá trị của advisory lock.
     *
     * Phép tiêm lỗi 04/08 cho một kết quả bất ngờ: gỡ `pg_advisory_xact_lock`
     * mà cả file VẪN XANH. Lý do là trần còn một lớp thứ hai ở DB —
     * `UNIQUE (season_id, so_thu_tu)`: hai transaction cùng đọc `daPhat = 28`
     * thì cùng tính `so_thu_tu = 29`, và người sau bị Postgres từ chối. Trần
     * không vỡ.
     *
     * NHƯNG cú nổ đó là `23505` giữa transaction ⇒ rollback ⇒ người chơi nhận
     * **500 internal**, trong khi lỗi của họ chỉ là bấm chậm nửa giây. Advisory
     * lock không tồn tại để giữ trần (DB làm việc đó) — nó tồn tại để biến một
     * cú nổ thành một câu "đã hết suất". Không có assertion này thì lớp code
     * gỡ đi lúc nào cũng được mà không ai biết.
     */
    for (const x of res.filter((y) => y.status !== 200)) {
      expect(x.status,
        'người thua đua nhận 500 ⇒ advisory lock đã chết, DB đang gánh hộ',
      ).toBe(409);
      expect((await x.json() as { error: string }).error).toBe('het_suat');
    }

    // Kho chỉ mất đúng số suất còn lại — không hơn một đồng.
    expect(await khoBac()).toBe(khoTruoc - BigInt(QUA_BETA.T * conLai));

    // Và tổng số người nhận không bao giờ vượt trần.
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM qua_beta_nhan WHERE season_id = $1',
      [MUA_0_0.SEASON_ID]);
    expect(Number(rows[0].n)).toBe(QUA_BETA.TRAN_NGUOI);
  }, 120_000);

  it('hết suất → người đủ điều kiện vẫn bị từ chối TỬ TẾ, không phải 500', async () => {
    // Sổ đang đầy từ bài trên.
    const u = await createTestUser(pool);
    await choDuDieuKien(u.userId);
    const r = await goi('/api/v1/me/qua-beta/nhan', u.cookie, {});
    expect(r.status).toBe(409);
    expect((await r.json() as { error: string }).error).toBe('het_suat');
  });
});
