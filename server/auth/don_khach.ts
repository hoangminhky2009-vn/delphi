/**
 * D444 (28/09) — DỌN KHÁCH BỎ HOANG: xoá HẲN tài khoản khách "Chơi ngay"
 * (`POST /api/v1/auth/khach`, `server/app.ts`) mà sau khi tạo KHÔNG một dấu
 * vết nào — chưa từng có `events`, chưa từng có `telemetry` — và phiên đã
 * chết quá lâu để còn đường quay lại.
 *
 * ─── VÌ SAO CẦN, VÀ VÌ SAO AN TOÀN ĐỂ XOÁ HẲN (không phải anonymize) ────────
 *
 * Review bảo mật 28/09: "guest flood DB" — mỗi cú bấm "Chơi ngay" là MỘT hàng
 * `users` thật (D30, `events.user_id` có khoá ngoại nên khách phải là tài
 * khoản thật, xem `migrations/0030_khach.sql`), và khách KHÔNG CÓ ĐƯỜNG QUAY
 * LẠI khi phiên chết: không email, không mật khẩu, `resolveSession` chỉ cập
 * nhật `last_seen_at` chứ KHÔNG gia hạn `expires_at` (`server/auth/session.ts`
 * — phiên không trượt). Một khách bấm rồi đóng tab thì tài khoản đó vĩnh viễn
 * không ai đăng nhập lại được, kể cả chính người vừa tạo ra nó. `migrations/
 * 0030_khach.sql` đã tự ghi trước: "KHÔNG có lệnh dọn tài khoản khách cũ...
 * khi mở cho người ngoài, kẻ nghịch có thể bấm hàng nghìn lần" — D444 là lúc
 * lời cảnh báo đó thành việc phải làm.
 *
 * ⚠⚠ QUYẾT ĐỊNH MỚI, KHÔNG PHẢI NỚI TIỀN LỆ 0049. Migration 0049 (dọn dữ liệu
 * beta 31/08) founder chốt "chỉ ko xóa tài khoản thôi" — tức XOÁ một tài khoản
 * ĐÃ TỪNG CÓ HOẠT ĐỘNG bị bác. Ranh ở đây HẸP HƠN HẲN và không đụng ranh đó:
 * chỉ khách chưa từng chơi. Không ai MẤT gì — chưa ai từng CÓ gì để mất.
 *
 * Vì sao XOÁ HẲN thay vì "xoá tài khoản" kiểu anonymize (migration 0007, giữ
 * dòng `users` lại vì ledger/events neo vào nó): khách bỏ hoang không có gì
 * neo vào dòng `users` của họ (đúng điều kiện lọc bên dưới đảm bảo) — giữ một
 * dòng vô danh mãi mãi chỉ để giữ là trả giá kho (C1, 500 MB free tier) không
 * cần trả. Bù đếm cho dashboard nằm ở bảng riêng `khach_da_don_ngay`
 * (migration 0072) — xem `capNhatSoDemDaDon` dưới, và xem `admin_phan_tich.ts`
 * (`oSo`, `moi`/`moi_khach`) cộng bù lại từ đó.
 *
 * ─── VÌ SAO RANDOM(), KHÔNG PHẢI ORDER BY created_at ────────────────────────
 *
 * Nếu ≥ `toiDa` khách "kẹt" (bị một khoá ngoại KHÁC giữ, vd `kho_sticker` hay
 * `holdem_ban` trỏ vào — xem nhánh bắt lỗi 23503 dưới) nằm ĐẦU hàng theo
 * `created_at`, thứ tự cố định làm máy dọn ĐỨNG IM VĨNH VIỄN mỗi lượt tick:
 * luôn chọn lại đúng `toiDa` khách kẹt đó, `bo_qua` tăng đều mà `da_don` mãi
 * bằng 0, và không có thời điểm nào khá hơn để nó tự sửa. `ORDER BY random()`
 * làm mỗi lượt chọn một tập khác nhau — khách kẹt vẫn kẹt, nhưng khách dọn
 * được ở SAU nó trong ngày hôm đó thì lượt sau vẫn có cơ hội được chọn.
 *
 * ─── VÌ SAO MỖI KHÁCH MỘT TRANSACTION TRÊN MỘT CLIENT ───────────────────────
 *
 * `pool.connect()` một lần, `release()` trong `finally`; TRONG khối đó không
 * được nhắc lại `pool` (luật `scripts/lint_pool_lock.ts` — prod mở pool
 * `max: 1`, xin kết nối thứ hai khi đang cầm một kết nối là tự khoá chính
 * mình, xem `tests/pool_max1.test.ts`). Một khách một transaction (không gộp
 * cả lô vào một transaction lớn) để một khách "kẹt" (lỗi 23503) không kéo
 * ROLLBACK cả lô — các khách dọn được trước/sau nó vẫn giữ nguyên kết quả.
 */
import type pg from 'pg';
import { AUTH } from '../../config/auth.js';
import { TELEMETRY } from '../../config/telemetry.js';

export interface KetQuaDonKhach {
  /** Số khách đã xoá HẲN (users + avatar_so_huu + auth_accounts, cùng transaction). */
  da_don: number;
  /**
   * Số ứng viên đã CHỌN (qua được câu SELECT) nhưng KHÔNG dọn được: mất dòng
   * dưới khoá (một tick khác đã dọn/động vào trước), đã có `events` khi kiểm
   * lại dưới khoá, hoặc bị một khoá ngoại KHÁC giữ (mã lỗi Postgres 23503 —
   * ví dụ một dòng `kho_sticker`/`holdem_ban` trỏ vào, dù bản thân không có
   * `events`/`telemetry`). KHÔNG gồm số bị lọc ra ngay ở câu SELECT ứng viên
   * (những trường hợp đó không bao giờ vào tới vòng lặp để mà đếm).
   */
  bo_qua: number;
}

/**
 * DỌN TỐI ĐA `toiDa` khách bỏ hoang mỗi lượt gọi. Gọi từ `/api/v1/internal/tick`
 * (mỗi phút) — xem chú thích D444 ở đó về vì sao bọc try/catch riêng.
 */
export async function donKhachBoHoang(
  pool: pg.Pool,
  toiDa: number = AUTH.KHACH_DON_MOI_LUOT,
): Promise<KetQuaDonKhach> {
  /*
   * ⚠ CÂU ỨNG VIÊN CHỈ ĐỌC, KHÔNG KHOÁ — khoá thật (FOR UPDATE) xảy ra TRONG
   * từng transaction riêng bên dưới, để không giữ khoá trên `toiDa` dòng suốt
   * thời gian xử lý cả lô (một khách xử lý lâu không được chặn khách khác của
   * MỘT lượt tick khác đang chạy song song — dù hiếm, tick có thể chồng nhau
   * nếu một lượt chạy quá 60 giây).
   */
  const { rows: ungVien } = await pool.query<{ user_id: string; created_at: Date }>(
    `SELECT u.user_id, u.created_at
       FROM users u
      WHERE u.la_khach
        AND u.role = 'user'
        AND NOT u.la_tester
        AND NOT u.research_consent
        AND u.deleted_at IS NULL
        AND u.created_at < now() - make_interval(days => $1)
        AND NOT EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.user_id)
        AND NOT EXISTS (SELECT 1 FROM telemetry t WHERE t.user_id = u.user_id)
        AND NOT EXISTS (
          SELECT 1 FROM auth_accounts a
           WHERE a.user_id = u.user_id
             AND (
               a.email IS NOT NULL
               OR a.password_hash IS NOT NULL
               OR EXISTS (SELECT 1 FROM auth_identities i WHERE i.account_id = a.account_id)
               OR EXISTS (
                 SELECT 1 FROM auth_sessions s
                  WHERE s.account_id = a.account_id
                    AND s.revoked_at IS NULL AND s.expires_at > now()
               )
             )
        )
      ORDER BY random()
      LIMIT $2`,
    [AUTH.SESSION_TTL_DAYS, toiDa],
  );

  let daDon = 0;
  let boQua = 0;

  for (const uv of ungVien) {
    // ⚠⚠ lint:pool-lock — từ dòng dưới tới `client.release()`, KHÔNG được nhắc `pool`.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      /*
       * KHOÁ DÒNG + XÁC NHẬN LẠI dưới khoá — ứng viên chọn ở trên có thể đã
       * đổi trạng thái giữa lúc SELECT và lúc tới lượt xử lý (một tick khác,
       * hoặc chính khách đó vừa quay lại chơi). Mất dòng (đã bị dọn/xoá bởi
       * một tick khác) hoặc đã có `events` (vừa chơi) ⇒ ROLLBACK và tính vào
       * `bo_qua` — CÙNG SỐ với nhánh 23503 dưới, cố ý: cả ba đều là "chọn một
       * ứng viên rồi KHÔNG dọn được nó", khác với việc bị loại ngay ở câu
       * SELECT ứng viên (không bao giờ tới đây để mà đếm). Không gộp thì một
       * ứng viên tụt điều kiện đúng giữa lúc xử lý biến mất khỏi cả hai con
       * số trả về — `da_don + bo_qua` không còn khớp số ứng viên đã CHỌN, và
       * người đọc log không phân biệt được "0 việc phải làm" với "có việc mà
       * lặng lẽ trôi".
       */
      const { rows: khoa } = await client.query<{ created_at: Date }>(
        `SELECT created_at FROM users
          WHERE user_id = $1 AND la_khach AND deleted_at IS NULL
          FOR UPDATE`,
        [uv.user_id],
      );
      if (khoa.length === 0) {
        await client.query('ROLLBACK');
        boQua += 1;
        continue;
      }
      const { rows: coSuKien } = await client.query(
        `SELECT 1 FROM events WHERE user_id = $1 LIMIT 1`,
        [uv.user_id],
      );
      if (coSuKien.length > 0) {
        await client.query('ROLLBACK');
        boQua += 1;
        continue;
      }

      // Gỡ tham chiếu TỰ THAM CHIẾU trước — avatar_dang_mac trỏ vào chính
      // avatar_so_huu sắp xoá, không gỡ trước thì DELETE dưới vỡ khoá ngoại.
      await client.query(`UPDATE users SET avatar_dang_mac = NULL WHERE user_id = $1`, [uv.user_id]);
      await client.query(`DELETE FROM avatar_so_huu WHERE user_id = $1`, [uv.user_id]);
      // auth_accounts TRƯỚC users: auth_accounts.user_id chỉ REFERENCES users
      // (không CASCADE hướng đó) — xoá users trước thì auth_accounts mồ côi
      // vỡ khoá ngoại ràng buộc NGƯỢC. Xoá auth_accounts thì auth_sessions/
      // auth_tokens/auth_identities tự cuốn theo (ON DELETE CASCADE, 0007/0029).
      await client.query(`DELETE FROM auth_accounts WHERE user_id = $1`, [uv.user_id]);
      await client.query(`DELETE FROM users WHERE user_id = $1`, [uv.user_id]);
      await capNhatSoDemDaDon(client, khoa[0]!.created_at);

      await client.query('COMMIT');
      daDon += 1;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      /*
       * ⚠ CHỈ NUỐT 23503 (khoá ngoại) — một dòng khác (vd `kho_sticker`,
       * `holdem_ban`) trỏ vào khách này dù bản thân họ sạch `events`/
       * `telemetry`. Đây là ĐÚNG lúc "kẹt" mà chú thích ORDER BY random() ở
       * trên nói tới. MỌI lỗi khác (mất kết nối, cột sai tên, …) phải NÉM
       * TIẾP — nuốt hết mọi lỗi thì một bug thật ở đây sẽ báo "bo_qua" y hệt
       * một FK vô hại, và không ai biết mà sửa.
       */
      if ((err as { code?: string } | null)?.code === '23503') {
        boQua += 1;
      } else {
        throw err;
      }
    } finally {
      client.release();
    }
  }

  return { da_don: daDon, bo_qua: boQua };
}

/**
 * Cộng dồn một khách vào sổ đếm của ĐÚNG NGÀY VIỆT NAM lúc tài khoản họ được
 * TẠO (không phải ngày bị dọn) — cùng cách chia ngày `ngayCua()` dùng ở
 * `admin_phan_tich.ts` (A11.5: một nguồn công thức chia ngày, không chép lại).
 * PHẢI gọi TRONG transaction đang xoá `users`/`avatar_so_huu`/`auth_accounts`
 * của khách đó — commit chung, để không có lượt nào "xoá xong mà quên ghi sổ"
 * hoặc "ghi sổ mà xoá thất bại".
 */
async function capNhatSoDemDaDon(client: pg.PoolClient, taoLuc: Date): Promise<void> {
  await client.query(
    `INSERT INTO khach_da_don_ngay (ngay, so)
     VALUES ((($1::timestamptz) AT TIME ZONE $2)::date, 1)
     ON CONFLICT (ngay) DO UPDATE SET so = khach_da_don_ngay.so + 1`,
    [taoLuc, TELEMETRY.MUI_GIO],
  );
}
