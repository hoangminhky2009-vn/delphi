/**
 * Phiên đăng nhập: cookie httpOnly giữ token thô, DB giữ sha256(token).
 */
import type pg from 'pg';
import { AUTH } from '../../config/auth.js';
import { generateToken, hashToken } from './crypto.js';

export interface SessionActor {
  accountId: string;
  email: string;
  userId: string | null;
  role: 'user' | 'admin';
  emailVerified: boolean;
  /**
   * Tài khoản KHÁCH (0030) — vào chơi không cần đăng nhập.
   *
   * ⚠ Đọc ở ĐÂY chứ không hỏi DB lại ở từng chỗ cần: mọi cửa đã có `actor`, nên
   * một truy vấn thừa mỗi lần kiểm là trả giá trên đường nóng, mà pool chỉ có 5
   * kết nối (C1). Và một nguồn thì không lệch được với chính nó.
   */
  laKhach: boolean;
  /**
   * Tài khoản THỬ NGHIỆM của founder (0052) — điều kiện CẦN (cùng `role ===
   * 'admin'`) để bật cheat, và điều kiện ĐỦ để bị loại khỏi phân tích sản
   * phẩm (`server/admin_thongke.ts`).
   *
   * ⚠ Đọc Ở ĐÂY cùng lý lẽ với `laKhach`: mọi cửa đã có `actor`, nên hỏi lại
   * DB ở từng route là một truy vấn thừa trên đường nóng (pool 5 kết nối, C1)
   * — và một nguồn thì không lệch được với chính nó. KHÔNG route nào được
   * phép GHI cột `la_tester` (xem `tests/tester_mode.test.ts`).
   */
  laTester: boolean;
  /**
   * B5 (C8, 0084) — đã qua cổng tuổi: có `age_band` (đăng ký email / khai nhân khẩu) HOẶC đã xác nhận ở `POST /me/tuoi`.
   * Đọc ở đây cùng lý lẽ với `laKhach`: `requireOnboarded` chạy trên mọi route nghiệp vụ, hỏi DB lại là một truy vấn thừa
   * trên đường nóng. Không có hồ sơ `users` ⇒ false (cổng `not_onboarded` chặn trước).
   */
  tuoiDaXacNhan: boolean;
  /** Đã ghi danh TOTP xong chưa (0025). Chưa xong ⇒ mọi cửa admin đóng. */
  totpDaGhiDanh: boolean;
  /** Lúc phiên NÀY qua TOTP để mở quyền admin. Null = chưa mở. */
  adminXacThucLuc: Date | null;
  /** Lúc phiên NÀY xác thực lại cho thao tác phá huỷ. */
  xacThucLaiLuc: Date | null;
}

export async function createSession(
  db: pg.Pool | pg.PoolClient,
  accountId: string,
): Promise<string> {
  const raw = generateToken();
  await db.query(
    `INSERT INTO auth_sessions (token_hash, account_id, expires_at)
     VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
    [hashToken(raw), accountId, AUTH.SESSION_TTL_DAYS],
  );
  return raw;
}

/** Trả actor nếu phiên còn sống; đồng thời cập nhật last_seen_at. */
export async function resolveSession(
  db: pg.Pool | pg.PoolClient,
  rawToken: string,
): Promise<SessionActor | null> {
  const { rows } = await db.query(
    `UPDATE auth_sessions s
        SET last_seen_at = now()
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      RETURNING s.account_id, s.admin_xac_thuc_luc, s.xac_thuc_lai_luc`,
    [hashToken(rawToken)],
  );
  if (rows.length === 0) return null;

  const accountId: string = rows[0].account_id;
  const { rows: accs } = await db.query(
    `SELECT a.account_id, a.email, a.user_id, a.email_verified_at,
            a.totp_confirmed_at, u.role, u.la_khach, u.la_tester,
            (u.age_band IS NOT NULL OR u.tuoi_ok_luc IS NOT NULL) AS tuoi_da_xac_nhan
       FROM auth_accounts a
       LEFT JOIN users u ON u.user_id = a.user_id
      WHERE a.account_id = $1`,
    [accountId],
  );
  if (accs.length === 0) return null;
  const row = accs[0];
  return {
    accountId: row.account_id,
    email: row.email,
    userId: row.user_id,
    role: (row.role ?? 'user') as 'user' | 'admin',
    emailVerified: row.email_verified_at !== null,
    laKhach: row.la_khach === true,
    laTester: row.la_tester === true,
    tuoiDaXacNhan: row.tuoi_da_xac_nhan === true,
    totpDaGhiDanh: row.totp_confirmed_at !== null,
    adminXacThucLuc: rows[0].admin_xac_thuc_luc ?? null,
    xacThucLaiLuc: rows[0].xac_thuc_lai_luc ?? null,
  };
}

/**
 * TOKEN PHIÊN CỦA MỘT REQUEST — cookie (web) HOẶC `Authorization: Bearer`
 * (Activity Discord). **MỘT NGUỒN DUY NHẤT, mọi nơi phải hỏi qua đây.**
 *
 * ⚠⚠ VÌ SAO NÓ ĐỨNG Ở ĐÂY chứ không nằm trong `createApp` như trước: có ba chỗ
 * ngoài `app.ts` tự đọc thẳng `getCookie(...)` thay vì hỏi bộ giải, và cả ba đều
 * hỏng theo cách IM LẶNG với phiên Bearer:
 *   · `/auth/logout` — không thu hồi được gì mà vẫn trả `{ok:true}`. Người bấm
 *     "đăng xuất" tin là mình đã ra, phiên thì sống tới lúc hết hạn. Một nút
 *     đăng xuất nói dối tệ hơn không có nút nào.
 *   · ba lời gọi `dongDauAdmin` — đóng dấu TOTP lên "phiên có token undefined",
 *     tức không đóng lên phiên nào cả.
 * Đường Bearer sinh ra cho Discord Activity (iframe xuyên site, cookie
 * `SameSite=Lax` không được gửi). Mọi cửa mới quên đường đó sẽ hỏng đúng kiểu
 * này, nên chỗ chữa là DẸP BẢN SAO chứ không phải sửa từng chỗ (D61).
 *
 * ⚠ CHỈ dùng cho API. Trang server-render CỐ Ý không nhận Bearer — điều hướng
 * trình duyệt không đặt được header, nhận nó ở đó là bắt chước máy móc.
 */
export function docTokenPhien(
  c: { req: { header: (n: string) => string | undefined } },
): string | null {
  const cookie = docCookiePhien(c);
  if (cookie) return cookie;
  const h = c.req.header('authorization');
  if (typeof h === 'string' && h.startsWith('Bearer ')) {
    const t = h.slice(7).trim();
    if (t) return t;
  }
  return null;
}

/** Đọc riêng cookie phiên (không đụng Bearer). Tách ra để `docTokenPhien` khỏi
 *  phụ thuộc `hono/cookie` — file này là tầng auth thuần, không import framework. */
function docCookiePhien(
  c: { req: { header: (n: string) => string | undefined } },
): string | null {
  const raw = c.req.header('cookie');
  if (!raw) return null;
  for (const phan of raw.split(';')) {
    const i = phan.indexOf('=');
    if (i < 0) continue;
    if (phan.slice(0, i).trim() === AUTH.SESSION_COOKIE) {
      const v = phan.slice(i + 1).trim();
      if (!v) return null;
      /*
       * ⚠ `decodeURIComponent` NÉM với chuỗi escape hỏng (vd `delphi_session=%`).
       * `getCookie` của Hono nuốt lỗi đó; bản parse này thì không, nên nếu để
       * nguyên thì một cookie rác — thứ người dùng tự đặt được — làm MỌI endpoint
       * API trả 500 thay vì 401, và cửa tự chữa `deleteCookie` ở `requireAuth`
       * không bao giờ chạy tới. Đổi một câu 401 lành thành một app chết cứng.
       * Cookie không giải mã được thì coi như KHÔNG CÓ phiên — đúng nghĩa của nó.
       */
      try {
        return decodeURIComponent(v);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Đóng dấu "phiên này vừa qua TOTP".
 *
 * ⚠ Đóng dấu lên PHIÊN, không lên tài khoản. Đăng nhập ở máy khác là một phiên
 * khác, và nó phải tự chứng minh lại — nếu đóng dấu lên tài khoản thì một lần
 * mở khoá ở nhà sẽ mở luôn cửa admin cho cái laptop đang để quên ở trường.
 */
export async function dongDauAdmin(
  db: pg.Pool | pg.PoolClient,
  rawToken: string | null,
  loai: 'mo_quyen' | 'xac_thuc_lai',
): Promise<void> {
  /*
   * ⚠⚠ ĐÓNG DẤU HỤT PHẢI KÊU TO, KHÔNG ĐƯỢC IM (siết 11/08).
   *
   * Bản cũ nhận `string` và mọi người gọi đều truyền `getCookie(...)!`. Với phiên
   * Bearer thì cookie vắng ⇒ token là `undefined` ⇒ UPDATE khớp 0 DÒNG ⇒ hàm trả
   * về bình thường, handler trả `{ok:true}`, và người dùng được báo là đã bật 2FA
   * trong khi phiên của họ CHƯA hề được đóng dấu. Cửa admin sau đó từ chối họ mà
   * không ai hiểu vì sao.
   *
   * Nay: token vắng ⇒ ném; UPDATE không khớp dòng nào ⇒ ném. Đây là một thao tác
   * BẢO MẬT — "làm rồi hay chưa" không được phép là câu hỏi mở, và một lần hụt
   * phải thành lỗi 500 nhìn thấy được chứ không phải một cú thành công giả.
   */
  if (!rawToken) {
    throw new Error('dongDauAdmin: không có token phiên (cookie lẫn Bearer đều vắng)');
  }
  const cot = loai === 'mo_quyen' ? 'admin_xac_thuc_luc' : 'xac_thuc_lai_luc';
  const kq = await db.query(
    `UPDATE auth_sessions SET ${cot} = now()
      WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(rawToken)],
  );
  if (kq.rowCount === 0) {
    throw new Error(`dongDauAdmin: không đóng dấu được phiên nào (${loai})`);
  }
}

/*
 * ⚠ CÓ CHỦ Ý: hàm này KHÔNG kiểm `rowCount`, khác hẳn `dongDauAdmin` ngay trên.
 * Trông như tiêu chuẩn kép nên phải nói rõ vì sao chúng ngược nhau:
 *   · ĐÓNG DẤU là CẤP quyền. Không khớp dòng nào ⇒ quyền CHƯA được cấp, mà
 *     handler lại báo thành công ⇒ người dùng tin mình đã bật 2FA. Phải kêu.
 *   · THU HỒI là LẤY ĐI quyền. Không khớp dòng nào ⇒ phiên đó vốn đã chết hoặc
 *     chưa từng tồn tại, tức KẾT QUẢ MONG MUỐN đã đạt. Ném ở đây là biến một
 *     lần đăng xuất lành thành lỗi, và nó phá tính idempotent: "gọi mấy lần
 *     cũng ra một kết quả" chứ không phải "lần hai thì báo lỗi" (bài học D78).
 * Nói ngắn: hụt một cú CẤP là hỏng; hụt một cú THU HỒI là đã xong từ trước.
 */
export async function revokeSession(
  db: pg.Pool | pg.PoolClient,
  rawToken: string,
): Promise<void> {
  await db.query(
    `UPDATE auth_sessions SET revoked_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(rawToken)],
  );
}

/** Đổi mật khẩu / xóa tài khoản → giết mọi phiên của account. */
export async function revokeAllSessions(
  db: pg.Pool | pg.PoolClient,
  accountId: string,
): Promise<void> {
  await db.query(
    `UPDATE auth_sessions SET revoked_at = now()
      WHERE account_id = $1 AND revoked_at IS NULL`,
    [accountId],
  );
}

/** Dọn phiên hết hạn (gọi từ /internal/tick). */
export async function purgeExpiredSessions(db: pg.Pool | pg.PoolClient): Promise<number> {
  const res = await db.query(
    `DELETE FROM auth_sessions WHERE expires_at < now() - interval '7 days'`,
  );
  return res.rowCount ?? 0;
}
