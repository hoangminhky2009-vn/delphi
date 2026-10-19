/**
 * LƯỚI TRẦN NGÀY ở server — lớp thứ hai của suất trận (SPEC `docs/spec/tran-tran-ngay.md` mục 5; số ở `config/suat_tran.ts`).
 *
 * ─── VÌ SAO SERVER CŨNG PHẢI ĐẾM ──────────────────────────────────────────────────────────────────────────────────────────────
 * Cửa chính là hàng chờ ở cổng Worker, nhưng cổng FAIL-OPEN có chủ ý (DO lỗi / thiếu `CONG_BI_MAT` / gọi thẳng
 * api.example.vercel.app ⇒ cho qua): một cái cổng hỏng mà khoá chết cả app tệ hơn cổng không chạy. Nên quota Vercel phải có một
 * chốt KHÔNG mở toang được — đếm ngay trong DB, nơi trận được sinh ra.
 *
 * ─── HAI REQUEST SÁT TRẦN KHÔNG ĐƯỢC CÙNG LỌT ─────────────────────────────────────────────────────────────────────────────────
 * Đếm rồi mới INSERT là kẽ hở kinh điển (D55): hai request cùng đọc "47 < 48" rồi cùng chèn ⇒ 49. Nên ĐẾM + INSERT nằm trong MỘT
 * transaction sau `pg_advisory_xact_lock` một khoá cố định: request thứ hai chờ tới khi thứ nhất COMMIT rồi mới đếm, và thấy 48.
 * Khoá tự nhả khi COMMIT/ROLLBACK (cùng nếp `consumeLimit`). Chỉ trận người thường đi qua khoá; admin không xếp hàng ở đây.
 *
 * ⚠ ⚠ `lam` PHẢI dùng đúng `db` được đưa vào. Prod chạy pool `max: 1` mỗi instance (`api/index.ts`): gọi `pool.query` bên trong
 *   khi client đang giữ kết nối duy nhất là TỰ KHOÁ CHẾT.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { SUAT_TRAN, dauGioVN, dauNgayVN, gioVN, moLaiLuc } from '../config/suat_tran.js';
import type { SessionActor } from './auth/session.js';

/** Khoá tư vấn cố định cho trần ngày (số tự chọn, không trùng khoá `hashtext` của `consumeLimit`). */
const KHOA_TRAN_NGAY = 7_210_011;

/**
 * TRẦN NGÀY ĐANG HIỆU LỰC — `null` = lưới tắt.
 *
 * ⚠ VÌ SAO TẮT TRONG VITEST (CI lô 0942 đỏ, 12/10): DB test dùng chung trong một tệp, và bộ test cũ tạo > 48 trận (stress B1 40
 *   trận song song · vai_api) ⇒ chạm lưới, ăn 503 `het_suat_ngay` — đúng là lưới LÀM VIỆC, nhưng các bài đó đo thứ khác. Nới khẳng
 *   định của chúng là cấm (A11.30); thứ đúng là để lưới thành một DEP tiêm được như các cổng khác của `AppDeps`.
 * ⚠ CHIỀU AN TOÀN: vắng tiêm ⇒ BẬT ở mọi nơi trừ vitest. Prod không bao giờ có `VITEST` ⇒ quên tiêm không thể tắt lưới; ngược lại
 *   bài muốn đo lưới thì tiêm số tường minh (`tests/suat_tran_luoi.test.ts`). Bài canh khoá cả ba nhánh.
 */
export function tranNgayHieuLuc(
  tiem: number | null | undefined, env: Record<string, string | undefined> = process.env,
): number | null {
  if (tiem !== undefined) return tiem;
  return env.VITEST ? null : SUAT_TRAN.TRAN_NGAY_SERVER;
}

/** Admin (tester ⊂ admin) miễn trần — demo, kiểm lỗi lúc hết suất (SPEC mục 4.2). */
export function mienSuat(actor: Pick<SessionActor, 'role'>): boolean {
  return actor.role === 'admin';
}

/** Lỗi "hết suất hôm nay" — mang mốc mở lại để client nói thật "mở lại 0:00", không phải một lỗi đỏ. */
export class HetSuatNgay extends Error {
  constructor(public readonly moLaiLuc: number) {
    super('Hôm nay đã hết suất trận — mở lại lúc 0:00.');
  }
}

/** Đếm trận người thường đã tạo từ `tu` (UTC). Trận của admin không tính — họ cũng không bị chặn. */
export async function demTranTu(db: pg.Pool | pg.PoolClient, tu: number): Promise<number> {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n
       FROM holdem_matches m
       JOIN users u ON u.user_id = m.owner_user_id
      WHERE m.started_at >= $1 AND u.role <> 'admin'`,
    [new Date(tu)]);
  return Number(rows[0]?.n ?? 0);
}

/**
 * Chạy `lam` (câu INSERT tạo trận) dưới lưới trần ngày. Miễn ⇒ chạy thẳng trên `pool`. Không miễn ⇒ transaction + khoá tư vấn,
 * đếm trận trong ngày VN; chạm trần ⇒ ROLLBACK và ném `HetSuatNgay` — không dòng `holdem_matches` nào được tạo.
 */
export async function trongLuoiNgay<T>(
  pool: pg.Pool, mien: boolean,
  lam: (db: pg.Pool | pg.PoolClient) => Promise<T>,
  now = Date.now(), tran: number = SUAT_TRAN.TRAN_NGAY_SERVER,
): Promise<T> {
  if (mien) return lam(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [KHOA_TRAN_NGAY]);
    if (await demTranTu(client, dauNgayVN(now)) >= tran) {
      await client.query('ROLLBACK');
      throw new HetSuatNgay(moLaiLuc(now));
    }
    const kq = await lam(client);
    await client.query('COMMIT');
    return kq;
  } catch (e) {
    if (!(e instanceof HetSuatNgay)) await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** Giây tới lúc nên hỏi lại khi đã hết suất ngày — kẹp như nhịp hàng chờ ở cổng (một nguồn: `config/suat_tran.ts`). */
export function hoiLaiSauHetNgay(now: number): number {
  const s = Math.ceil((moLaiLuc(now) - now) / 1000);
  return Math.min(SUAT_TRAN.HOI_LAI_MAX_S, Math.max(SUAT_TRAN.HOI_LAI_MIN_S, s));
}

/**
 * `/admin` — nửa số do DB biết (Worker giữ nửa kia ở `/api/v1/_suat`): trận người thường tạo hôm nay / giờ này so với lưới.
 */
export function registerSuatTranAdmin(
  app: Hono<any>, pool: pg.Pool,
  mw: { requireAuth: any; requireOnboarded: any; requireAdmin: any },
): void {
  app.get('/api/v1/admin/suat-tran', mw.requireAuth, mw.requireOnboarded, mw.requireAdmin, async (c) => {
    const now = Date.now();
    const [homNay, gioNay] = await Promise.all([
      demTranTu(pool, dauNgayVN(now)),
      demTranTu(pool, dauGioVN(now, gioVN(now))),
    ]);
    return c.json({
      gio_vn: gioVN(now),
      tran_gio_nay: gioNay,
      tran_hom_nay: homNay,
      tran_ngay_server: SUAT_TRAN.TRAN_NGAY_SERVER,
      quy_ngay: SUAT_TRAN.QUY_NGAY,
    });
  });
}
