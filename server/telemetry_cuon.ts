/**
 * CUỘN NGÀY + DỌN HẠN cho đo lường vận hành (A9; bản yêu cầu 01 §2.5).
 *
 * Tách khỏi `server/telemetry.ts` vì hai file này có nhịp sống khác hẳn nhau:
 * kia là đường NÓNG (mỗi lô của mỗi người), đây là đường NGUỘI (một lần mỗi
 * ngày, từ cron). Trộn chung thì mỗi lần sửa dashboard là một lần chạm vào
 * đoạn code đang gánh lưu lượng.
 *
 * ─── HAI THỨ FILE NÀY BẢO VỆ ────────────────────────────────────────────────
 * 1. **Bảng cuộn nhỏ VĨNH VIỄN.** Đây là thứ dashboard đọc (§4.3); nó nhỏ nên
 *    dashboard nhanh mà kho không phình. Bản thô hết hạn 90 ngày, bản cuộn ở lại.
 * 2. **Không bao giờ xoá thô chưa được tổng hợp.** Xem `donHan()` — hạn lưu là
 *    một cái van, không phải một lưỡi dao.
 */
import type pg from 'pg';
import { TELEMETRY } from '../config/telemetry.js';

type Db = pg.Pool | pg.PoolClient;

export interface BaoCaoCuon {
  /** Các ngày (YYYY-MM-DD, giờ VN) vừa được cuộn trong lượt này. */
  ngay_da_cuon: string[];
  xoa_tho: number;
  xoa_lo: number;
}

/**
 * Cuộn ĐÚNG MỘT ngày (giờ Việt Nam) từ bảng thô sang bảng tổng hợp.
 *
 * ⚠ BẤT BIẾN QUAN TRỌNG NHẤT CỦA CẢ BƯỚC NÀY: gọi hai lần cho cùng một ngày ⇒
 * KẾT QUẢ KHÔNG ĐỔI. Nó đúng nhờ hai thứ, không phải nhờ may:
 *   · `ON CONFLICT … DO UPDATE` — ghi đè, không cộng dồn. Đây là chỗ mà một
 *     `INSERT` trần sẽ nhân đôi mọi con số và không ai thấy cho tới lúc đọc
 *     dashboard.
 *   · Người gọi (`cuonTelemetryTick`) chỉ đưa vào NGÀY ĐÃ ĐÓNG. Cuộn ngày đang
 *     chạy thì số đổi giữa hai lần là chuyện đương nhiên — nên bất biến được
 *     giữ ở TẦNG CHỌN NGÀY chứ không phải bằng cách bắt hàm này thông minh hơn.
 *
 * ⚠ KHÔNG DELETE-rồi-INSERT. Nếu bản thô của ngày đó đã hết hạn 90 ngày thì
 * "tính lại" sẽ ra 0 dòng và XOÁ MẤT phần tổng hợp vốn giữ vĩnh viễn. Ghi đè
 * theo từng ô là cách duy nhất an toàn với một bảng có hai tốc độ hết hạn.
 */
export async function cuonNgay(db: Db, ngay: string): Promise<number> {
  /*
   * KHỐI 1 — THEO MÀN. Trả lời "màn nào tốn thời gian", cắt thô theo tuổi.
   * `ms_tong` là phép CỘNG: trung vị không trả lời được "chơi mấy giờ", và sau
   * khi cuộn thì không có cách nào suy ngược ra tổng từ p50/p90.
   */
  const res = await db.query(
    `WITH bien AS (
       SELECT ($1::date)::timestamp     AT TIME ZONE $2 AS tu,
              ($1::date + 1)::timestamp AT TIME ZONE $2 AS den
     )
     INSERT INTO telemetry_ngay
            (ngay, loai, man, age_band, so_luot, so_nguoi, ms_tong, ms_p50, ms_p90)
     SELECT $1::date,
            t.loai,
            t.man,
            -- Cắt theo NHÓM ngay từ lúc cuộn (C7). Bảng tổng hợp không giữ một
            -- dấu vết nào chỉ về một người cụ thể; khách chưa đăng nhập ⇒ NULL.
            u.age_band,
            count(*)::int,
            count(DISTINCT t.user_id)::int,
            COALESCE(sum(t.ms), 0)::bigint,
            -- percentile_* bỏ qua NULL; mọi ms NULL ⇒ trả NULL. Đúng ý: loại sự
            -- kiện không đo thời lượng thì không có p50 giả bằng 0.
            percentile_cont(0.5) WITHIN GROUP (ORDER BY t.ms)::int,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY t.ms)::int
       FROM telemetry t
       LEFT JOIN users u ON u.user_id = t.user_id
       CROSS JOIN bien
      WHERE t.ts >= bien.tu AND t.ts < bien.den
      GROUP BY t.loai, t.man, u.age_band
     ON CONFLICT (ngay, loai, man, age_band) DO UPDATE
        SET so_luot  = EXCLUDED.so_luot,
            so_nguoi = EXCLUDED.so_nguoi,
            ms_tong  = EXCLUDED.ms_tong,
            ms_p50   = EXCLUDED.ms_p50,
            ms_p90   = EXCLUDED.ms_p90`,
    [ngay, TELEMETRY.MUI_GIO],
  );

  /*
   * KHỐI 2 — THEO NHÓM (0026). Đủ ba chiều nhân khẩu, KHÔNG có `man`.
   * Đây là khối mà mặt lọc-dần của dashboard đọc. Vì sao không gộp làm một khoá
   * duy nhất: xem phần đếm dòng ở đầu migration 0026 — gộp là ~100 MB/năm.
   */
  await db.query(
    `WITH bien AS (
       SELECT ($1::date)::timestamp     AT TIME ZONE $2 AS tu,
              ($1::date + 1)::timestamp AT TIME ZONE $2 AS den
     )
     INSERT INTO telemetry_ngay_nhom
            (ngay, loai, age_band, region, occupation_band,
             so_luot, so_nguoi, ms_tong, ms_p50, ms_p90)
     SELECT $1::date, t.loai, u.age_band, u.region, u.occupation_band,
            count(*)::int,
            count(DISTINCT t.user_id)::int,
            COALESCE(sum(t.ms), 0)::bigint,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY t.ms)::int,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY t.ms)::int
       FROM telemetry t
       LEFT JOIN users u ON u.user_id = t.user_id
       CROSS JOIN bien
      WHERE t.ts >= bien.tu AND t.ts < bien.den
      GROUP BY t.loai, u.age_band, u.region, u.occupation_band
     ON CONFLICT (ngay, loai, age_band, region, occupation_band) DO UPDATE
        SET so_luot  = EXCLUDED.so_luot,
            so_nguoi = EXCLUDED.so_nguoi,
            ms_tong  = EXCLUDED.ms_tong,
            ms_p50   = EXCLUDED.ms_p50,
            ms_p90   = EXCLUDED.ms_p90`,
    [ngay, TELEMETRY.MUI_GIO],
  );

  const soDong = res.rowCount ?? 0;

  await db.query(
    `INSERT INTO telemetry_cuon (ngay, cuon_luc, so_dong) VALUES ($1::date, now(), $2)
     ON CONFLICT (ngay) DO UPDATE SET cuon_luc = now(), so_dong = EXCLUDED.so_dong`,
    [ngay, soDong],
  );
  return soDong;
}

/**
 * Dọn hạn: bản thô quá `GIU_THO_NGAY`, khoá chống-gửi-lại quá `GIU_LO_GIO`.
 *
 * ⚠⚠ ĐIỀU KIỆN THỨ HAI TRONG CÂU XOÁ THÔ KHÔNG PHẢI ĐỂ CHO ĐẸP. Nó chặn đúng
 * một kịch bản mất dữ liệu thật: nếu vòng cuộn tụt lại (app ngừng lâu, cron
 * hỏng) thì hạn 90 ngày sẽ xoá bản thô CHƯA TỪNG ĐƯỢC TỔNG HỢP — mất luôn, vì
 * bản cuộn là thứ duy nhất giữ vĩnh viễn. Nên chỉ xoá phần ngày đã nằm sau mốc
 * cuộn. Chưa cuộn lần nào ⇒ `COALESCE(..., 'epoch')` ⇒ KHÔNG xoá gì cả.
 * Fail-closed đúng chiều: thà kho phình thêm vài ngày còn hơn mất dữ liệu.
 *
 * `telemetry_ngay` và `telemetry_ngay_nhom` KHÔNG bị đụng ở đây — hai khối cuộn
 * giữ VĨNH VIỄN. Chỉ bản thô có hạn.
 */
export async function donHan(db: Db): Promise<{ xoa_tho: number; xoa_lo: number }> {
  const tho = await db.query(
    `DELETE FROM telemetry
      WHERE ts < now() - ($1 || ' days')::interval
        AND (ts AT TIME ZONE $2)::date
            <= COALESCE((SELECT max(ngay) FROM telemetry_cuon), 'epoch'::date)`,
    [TELEMETRY.GIU_THO_NGAY, TELEMETRY.MUI_GIO],
  );
  const lo = await db.query(
    `DELETE FROM telemetry_lo WHERE at < now() - ($1 || ' hours')::interval`,
    [TELEMETRY.GIU_LO_GIO],
  );
  return { xoa_tho: tho.rowCount ?? 0, xoa_lo: lo.rowCount ?? 0 };
}

/**
 * Một lượt của cron — gọi từ `/internal/tick` (D11 lớp 2). KHÔNG dựng scheduler
 * mới (C3): nhịp mỗi phút đã có sẵn, và việc này chỉ có thật sự gì để làm đúng
 * một lần mỗi ngày.
 *
 * ⚠ KHOÁ TRƯỚC KHI HỎI (bài học D57 mục 2). Đọc mốc cuộn ngoài khoá rồi mới
 * cuộn là check-then-act: cron-job.org + UptimeRobot + một request người dùng
 * có thể cùng kết luận "đến hạn" rồi cả ba cùng quét.
 *
 * ⚠ KHÁC `xayBxhTick` MỘT CHỖ, CÓ CHỦ Ý: ở đó khoá được nhả TRƯỚC khi xây, vì
 * việc xây chạy mỗi chu kỳ và giữ một kết nối suốt lúc xây là chữa nghẽn bằng
 * một chỗ nghẽn to hơn. Ở đây khoá bao TRỌN việc cuộn, vì (a) việc cuộn CHÍNH
 * LÀ câu ghi, không tách ra được, và (b) nó chạy đúng một lần mỗi ngày chứ
 * không phải mỗi chu kỳ — giữ một kết nối vài trăm mili-giây mỗi ngày là cái
 * giá khác hẳn. `try_` để tick đến sau đi tiếp thay vì xếp hàng.
 */
export async function cuonTelemetryTick(
  pool: pg.Pool,
  now: Date = new Date(),
): Promise<BaoCaoCuon> {
  const rong: BaoCaoCuon = { ngay_da_cuon: [], xoa_tho: 0, xoa_lo: 0 };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const khoa = await client.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS co', [
      'telemetry:cuon',
    ]);
    if (khoa.rows[0]?.co !== true) {
      await client.query('ROLLBACK');
      return rong;
    }

    /*
     * Ngày cần cuộn = từ (mốc đã cuộn + 1) đến HÔM QUA theo giờ VN.
     * Chưa cuộn lần nào ⇒ bắt đầu từ ngày của dòng thô cũ nhất. Bảng thô rỗng
     * ⇒ `generate_series` nhận NULL ⇒ 0 dòng, không cần nhánh riêng.
     */
    const { rows } = await client.query(
      `WITH moc AS (
         SELECT ($1::timestamptz AT TIME ZONE $2)::date - 1 AS het
       ), bat_dau AS (
         SELECT COALESCE(
                  (SELECT max(ngay) + 1 FROM telemetry_cuon),
                  (SELECT (min(ts) AT TIME ZONE $2)::date FROM telemetry)
                ) AS tu
       )
       SELECT to_char(d, 'YYYY-MM-DD') AS ngay
         FROM bat_dau, moc,
              generate_series(bat_dau.tu, moc.het, interval '1 day') AS d
        ORDER BY d
        LIMIT $3`,
      [now.toISOString(), TELEMETRY.MUI_GIO, TELEMETRY.CUON_TOI_DA_NGAY_MOI_TICK],
    );

    const daCuon: string[] = [];
    for (const r of rows) {
      await cuonNgay(client, r.ngay as string);
      daCuon.push(r.ngay as string);
    }

    const don = await donHan(client);
    await client.query('COMMIT');
    return { ngay_da_cuon: daCuon, ...don };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
