/**
 * Rate limit dựa trên DB (không state trong process — serverless nhiều instance
 * vẫn đếm đúng; đổi hosting không mất tính năng — A8.9).
 */
import type pg from 'pg';

export interface RateLimitCheck {
  allowed: boolean;
  count: number;
  retryAfterSeconds: number;
}

/** Đếm số lần trong cửa sổ; KHÔNG ghi thêm. */
export async function countAttempts(
  db: pg.Pool | pg.PoolClient,
  bucket: string,
  windowMinutes: number,
): Promise<number> {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM auth_attempts
     WHERE bucket = $1 AND at > now() - ($2 || ' minutes')::interval`,
    [bucket, windowMinutes],
  );
  return rows[0].n as number;
}

export async function recordAttempt(
  db: pg.Pool | pg.PoolClient,
  bucket: string,
): Promise<void> {
  await db.query(`INSERT INTO auth_attempts (bucket) VALUES ($1)`, [bucket]);
}

/** Chuỗi sai liên tiếp: thành công → xóa sạch bucket. */
export async function clearAttempts(
  db: pg.Pool | pg.PoolClient,
  bucket: string,
): Promise<void> {
  await db.query(`DELETE FROM auth_attempts WHERE bucket = $1`, [bucket]);
}

/**
 * TIÊU MỘT SUẤT, NGUYÊN TỬ. Đây là hàm DUY NHẤT được dùng để gác cổng.
 *
 * ─── VÌ SAO KHÔNG CÒN `checkLimit` RỜI ─────────────────────────────────────
 * Bản cũ tách làm hai: `checkLimit()` SELECT count rồi trả về, caller tự gọi
 * `recordAttempt()` sau. Giữa hai câu đó là một khoảng trống kinh điển
 * (TOCTOU): N request song song cùng đọc một con số cũ và cùng được cho qua.
 *
 * ĐO THẬT trên embedded Postgres, trần 5:
 *     tuần tự 20 request  → lọt 5   (đúng)
 *     SONG SONG 20 request → lọt 16  (sai)
 *
 * Với đăng nhập còn tệ hơn: giữa "kiểm" và "ghi" có cả một lần băm argon2
 * (~100ms), đủ rộng để cả loạt request chui lọt trước khi ai kịp ghi lỗi đầu
 * tiên. Nên mô hình mới là "tiêu suất TRƯỚC, hoàn lại nếu thành công", chứ
 * không phải "hỏi rồi mới tiêu".
 *
 * ─── VÌ SAO KHOÁ TƯ VẤN CẤP TRANSACTION ────────────────────────────────────
 * `pg_advisory_xact_lock` tự nhả khi COMMIT/ROLLBACK nên chạy đúng qua
 * connection pooler ở chế độ transaction (Supabase — D11). Khoá cấp SESSION
 * (`pg_advisory_lock`) thì KHÔNG: pooler trả connection về pool khi kết thúc
 * transaction, khoá còn treo trên một connection mà request sau không giữ →
 * rò khoá vĩnh viễn. Đây là bẫy phải nhớ, không phải chi tiết vặt.
 *
 * Va chạm băm (`hashtext` trả int4) chỉ khiến hai bucket khác nhau xếp hàng
 * chung — chậm hơn tí, không sai kết quả.
 *
 * ─── D207-b (03/09/2026): GỘP 5 CÂU CÒN 4 — VÀ MỘT PHƯƠNG ÁN ĐÃ THỬ RỒI BỎ ───
 * Việc: prod chạy `pool: max 1` + Fluid compute (nhiều lượt gọi chung một
 * instance) nên MỘT connection bị giữ suốt cả giao dịch là điểm nghẽn nối
 * đuôi — `docs/gioi-han-ha-tang.md` §3② gọi đúng tên: "chặn một request tốn
 * gần bằng phục vụ nó".
 *
 * ĐÃ THỬ (và ĐO THẤY SAI) — gộp cả khoá+đếm+ghi vào ĐÚNG MỘT câu tự-commit
 * (`pool.query` thẳng, ép thứ tự bằng phụ thuộc dữ liệu qua CTE: `dem` chọn
 * FROM `khoa`, `khoa` gọi `pg_advisory_xact_lock`). Ý tưởng nghe hợp lý — CTE
 * ghi (`ghi`) buộc Postgres phải hoàn tất `dem` trước, và `dem` buộc phải có
 * `khoa` mới cross-join được — nhưng ĐO THẬT (`tests/rate_limit.test.ts`) lộ
 * ngay: vòng 1 lọt 9 (phải 5), bucket riêng lọt 9 (phải 6), HTTP đăng ký lọt 6
 * (trần 5), HTTP đăng nhập lọt 12 (trần 10). SAI Ở MỌI BÀI SONG SONG.
 *
 * VÌ SAO: thứ tự THỰC THI trong plan không phải thứ quyết định — thứ quyết
 * định là SNAPSHOT. Ở READ COMMITTED, một câu lệnh (dù có mấy CTE) chỉ lấy
 * MỘT snapshot DUY NHẤT, chốt tại lúc câu lệnh BẮT ĐẦU chạy — tức là TRƯỚC khi
 * `pg_advisory_xact_lock` kịp chặn ai cả. Một request bị khoá chặn, ngủ chờ,
 * rồi tỉnh dậy sau khi kẻ giữ khoá trước đã COMMIT — nhưng phép đếm `dem` của
 * nó vẫn nhìn qua snapshot CŨ, chốt từ TRƯỚC lúc chặn, nên KHÔNG thấy dòng vừa
 * được ghi. Khoá vẫn tuần tự hoá đúng THỨ TỰ CHẠY, nhưng không tuần tự hoá
 * được TẦM NHÌN — quay lại đúng lỗ TOCTOU ban đầu, chỉ là nó náu trong một
 * câu lệnh thay vì náu giữa hai câu.
 *
 * ⇒ KẾT LUẬN ĐO ĐƯỢC: khoá phải là MỘT CÂU LỆNH HOÀN TẤT RIÊNG (client nhận
 * lại quyền điều khiển ⇒ chắc chắn khoá đã cấp) TRƯỚC KHI câu lệnh đếm được
 * gửi đi — chỉ vậy câu đếm mới lấy snapshot MỚI, chốt SAU khi khoá đã cấp
 * (mà muốn cấp thì kẻ giữ khoá trước phải đã COMMIT). Đây không phải hành vi
 * ngôn ngữ SQL bảo đảm — là hành vi snapshot của READ COMMITTED, nên PHẢI giữ
 * transaction tường minh (BEGIN…COMMIT) để ép hai câu đó chạy trên CÙNG một
 * kết nối, đúng thứ tự.
 *
 * ⇒ PHẦN GỘP ĐƯỢC: đếm + ghi (không đụng khoá) gộp an toàn vào MỘT CTE — hai
 * câu đó vốn dĩ cùng chạy trong MỘT snapshot của bản 5-câu cũ rồi (không câu
 * nào trong hai câu đó CHỜ ai), nên gộp không đổi ngữ nghĩa, chỉ đỡ một
 * round-trip. Kết quả: BEGIN → khoá → (đếm+ghi gộp) → COMMIT — 4 câu thay vì
 * 5, vẫn giữ nguyên `pool.connect()` (transaction cần cùng một connection từ
 * đầu tới cuối, không né được), nhưng bớt 1 round-trip mỗi lần gọi.
 */
export async function consumeLimit(
  pool: pg.Pool,
  bucket: string,
  max: number,
  windowMinutes: number,
): Promise<RateLimitCheck> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Câu lệnh RIÊNG, chạy XONG rồi mới gửi câu kế — client nhận lại quyền
    // điều khiển ở đây nghĩa là khoá ĐÃ cấp (xem docstring: đây là điều kiện
    // bắt buộc để câu đếm bên dưới lấy được snapshot MỚI hơn khoá).
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [bucket]);
    // Đếm + ghi gộp MỘT câu (an toàn gộp — xem docstring): trong bản cũ hai
    // câu này vốn chạy liền nhau, không câu nào chờ khoá, nên gộp không đổi
    // snapshot nào cả, chỉ đỡ một round-trip.
    const { rows } = await client.query(
      `WITH dem AS (
         SELECT count(*)::int AS n FROM auth_attempts
         WHERE bucket = $1 AND at > now() - ($2 || ' minutes')::interval
       ), ghi AS (
         INSERT INTO auth_attempts (bucket)
         SELECT $1 FROM dem WHERE dem.n < $3
         RETURNING 1
       )
       SELECT dem.n AS n, EXISTS (SELECT 1 FROM ghi) AS da_ghi FROM dem`,
      [bucket, windowMinutes, max],
    );
    await client.query('COMMIT');
    return {
      allowed: rows[0].da_ghi === true,
      count: Number(rows[0].n),
      retryAfterSeconds: windowMinutes * 60,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Dọn rác định kỳ (gọi từ /internal/tick — không để bảng phình mãi). */
export async function purgeOldAttempts(db: pg.Pool | pg.PoolClient): Promise<number> {
  const res = await db.query(
    `DELETE FROM auth_attempts WHERE at < now() - interval '24 hours'`,
  );
  return res.rowCount ?? 0;
}
