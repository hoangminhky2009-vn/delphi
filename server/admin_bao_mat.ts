/**
 * KHOÁ CỬA ADMIN — ghi danh TOTP, mở quyền, xác thực lại (bản yêu cầu 01 §3).
 *
 * Tách khỏi `server/admin.ts` vì hai file trả lời hai câu khác nhau: kia là
 * "làm gì với kèo", đây là "ai được phép làm".
 *
 * ─── THI HÀNH KHÔNG ĐƯỢC TỰ NHỐT MÌNH ────────────────────────────────────────
 * Prod có ĐÚNG MỘT admin. Bật 2FA bắt buộc mà làm sai thứ tự là khoá vĩnh viễn
 * người duy nhất có thể resolve kèo — trong khi kèo có hạn và đang giữ token
 * của người chơi. Nên bậc thang quyền chia làm ba, và bậc thấp nhất luôn mở:
 *
 *   `chiAdmin`        role = admin. CHỈ dùng cho mấy route trong file này.
 *   `requireAdmin`    + đã ghi danh TOTP + phiên đã mở quyền, còn hạn TTL_PHUT.
 *                     → đây là thứ tiêm vào MỌI route admin khác.
 *   `requireXacThucLai` + vừa nhập lại mã trong XAC_THUC_LAI_PHUT.
 *                     → chỉ cho thao tác KHÔNG HOÀN TÁC ĐƯỢC.
 *
 * Lần đăng nhập admin đầu tiên sau khi deploy: mọi cửa khác đóng, cửa ghi danh
 * mở ⇒ bị ép ghi danh, không có cửa sổ nào khoá được ai ra ngoài.
 *
 * Mất điện thoại → `scripts/admin_reset_2fa.ts` (founder chốt phương án A):
 * nó KHÔNG thêm một quyền nào cả — ai chạy được nó thì đã có `.env.prod`, mà
 * người có `.env.prod` vốn đã `UPDATE users SET role='admin'` thẳng vào DB
 * được rồi. Script chỉ làm một việc vốn đã khả thi trở nên an toàn và CÓ DẤU
 * VẾT. Mã khôi phục thì ngược lại: đẻ ra một bí mật mới cần cất, mà với một
 * admin duy nhất nó sẽ nằm trên chính cái điện thoại vừa mất.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { AUTH } from '../config/auth.js';
import { consumeLimit } from './auth/rate_limit.js';
import { docTokenPhien, dongDauAdmin, type SessionActor } from './auth/session.js';
import { buocCua, sinhBiMat, timBuocKhop, uriGhiDanh } from './auth/totp.js';

import type { Env, Mw as Middleware } from './http/types.js';

/** Mốc còn "tươi" trong `phut` phút không? */
export function conTuoi(moc: Date | null, phut: number): boolean {
  if (moc === null) return false;
  return Date.now() - new Date(moc).getTime() < phut * 60_000;
}

/* ══════════════════════════════════════════════════════════════════════════
 * TESTER MODE (0052) — CHEAT CHO TÀI KHOẢN THỬ NGHIỆM
 *
 * Founder 03/09/2026: *"cấp toàn quyền cho tài khoản admin để làm tester nhé.
 * Như kiểu cheat luôn ấy"*, và xác nhận riêng 26/26 tài khoản hiện có là của
 * chính founder.
 *
 * ⚠⚠ VÌ SAO ĐÒI CẢ HAI, KHÔNG PHẢI MỘT — đọc kỹ trước khi "gọn hoá" thành
 * `actor.role === 'admin'`. Từ D208 repo có ô uỷ quyền admin bấm-một-nút
 * (`POST /api/v1/admin/quyen`, xem `registerAdminQuyenRoutes` dưới). Nếu cheat
 * chỉ gác bằng `role` thì MỖI LẦN uỷ quyền admin cho ai đó là trao luôn máy in
 * tiền — người mới có quyền admin tự gọi `POST /admin/tester/token` mint T vào
 * ví mình, và `admin_adjust` là đường mint HỢP LỆ theo `server/audit.ts`
 * (`mintedWallet` cộng cả `signup_grant` lẫn `admin_adjust`) nên `npm run
 * audit:supply` vẫn báo CÂN — KHÔNG MỘT HÀNG RÀO NÀO KÊU. `la_tester` đóng lỗ
 * đó: cột mặc định FALSE, KHÔNG route nào ghi được nó (chỉ UPDATE tay của
 * founder, xem migrations/0052_tai_khoan_thu_nghiem.sql) — tách quyền VẬN HÀNH
 * (role=admin, uỷ quyền được) khỏi quyền THỬ NGHIỆM (la_tester, chỉ tay mới bật).
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * VỪA admin VỪA tester — điều kiện CẦN cho MỌI quyền cheat (năm quyền ở
 * `server/admin_tester.ts` + phần ép tham số trong `POST /holdem/matches`).
 * Một hàm thuần trên `actor` đã có sẵn trong request (không hỏi lại DB — cùng
 * lý lẽ với `laKhach` ở `auth/session.ts`), nên MỌI route cheat gọi ĐÚNG một
 * chỗ này — không có bản chép tay `actor.role === 'admin' && actor.laTester`
 * ở nơi khác để mà trôi (D61).
 */
export function laTester(actor: SessionActor): boolean {
  return actor.role === 'admin' && actor.laTester === true;
}

/**
 * Middleware chặn ở cửa cheat. Đặt SAU `requireAdmin` trong chuỗi guard của
 * route — `requireAdmin` đã lo 2FA + hạn quyền, hàm này chỉ thêm đúng một
 * điều kiện: `la_tester`.
 */
export const requireTester: Middleware = async (c, next) => {
  const actor = c.get('actor') as SessionActor;
  if (!laTester(actor)) {
    return c.json({
      error: 'khong_phai_tester',
      message: 'Cheat chỉ mở cho tài khoản thử nghiệm (role=admin và la_tester).',
    }, 403);
  }
  await next();
};

/**
 * Xác minh một mã TOTP VÀ tiêu nó (chống dùng lại).
 *
 * ⚠ CHỐNG DÙNG LẠI LÀ MỘT NỬA CỦA LỚP THỨ HAI, không phải phần thêm cho chắc.
 * Thiếu nó thì một mã bị nhìn trộm dùng được cho CẢ đăng nhập LẪN xác nhận
 * thao tác phá huỷ trong cùng 30 giây — hai lần hỏi mà chỉ tốn một lần trộm.
 *
 * `UPDATE … WHERE totp_buoc_cuoi IS NULL OR totp_buoc_cuoi < $buoc` là một phép
 * so-và-đặt NGUYÊN TỬ: hai request song song cùng mang một mã thì chỉ một cái
 * khớp dòng, cái kia rowCount = 0 và bị từ chối (bài học D55).
 */
async function tieuMa(
  pool: pg.Pool,
  accountId: string,
  biMat: string,
  maNhap: string,
): Promise<boolean> {
  const buoc = timBuocKhop(biMat, maNhap, buocCua());
  if (buoc === null) return false;
  const res = await pool.query(
    `UPDATE auth_accounts SET totp_buoc_cuoi = $2
      WHERE account_id = $1
        AND (totp_buoc_cuoi IS NULL OR totp_buoc_cuoi < $2)`,
    [accountId, buoc],
  );
  return (res.rowCount ?? 0) === 1;
}

async function docBiMat(
  pool: pg.Pool,
  accountId: string,
): Promise<{ secret: string | null; xong: boolean }> {
  const { rows } = await pool.query(
    `SELECT totp_secret, totp_confirmed_at FROM auth_accounts WHERE account_id = $1`,
    [accountId],
  );
  return {
    secret: rows[0]?.totp_secret ?? null,
    xong: rows[0]?.totp_confirmed_at !== null && rows[0]?.totp_confirmed_at !== undefined,
  };
}

async function audit(
  db: pg.Pool | pg.PoolClient,
  adminId: string,
  action: string,
  payload: unknown,
): Promise<void> {
  await db.query(
    `INSERT INTO admin_audit (admin_id, action, payload_json) VALUES ($1, $2, $3)`,
    [adminId, action, JSON.stringify(payload)],
  );
}

export type KetQuaGoBo =
  | { trang_thai: 'khong_co_tai_khoan' }
  | { trang_thai: 'khong_phai_admin'; role: string }
  | { trang_thai: 'chua_bat' }
  | { trang_thai: 'da_go'; handle: string; bat_luc: Date };

/**
 * GỠ 2FA của một admin (đường thoát khi mất thiết bị).
 *
 * Logic nằm ở đây chứ không nằm trong `scripts/admin_reset_2fa.ts` để nó TEST
 * ĐƯỢC — một đường thoát khẩn cấp chưa từng được chạy thử là một đường thoát
 * chưa tồn tại, và ta chỉ phát hiện ra vào đúng ngày cần nó.
 *
 * ⚠ BA VIỆC, KHÔNG ĐƯỢC THIẾU VIỆC NÀO:
 *  1. xoá bí mật;
 *  2. thu hồi dấu mốc admin trên MỌI phiên — thiếu bước này thì phiên trên
 *     chính thiết bị vừa mất vẫn còn quyền cho hết TTL, tức đúng lúc cần khoá
 *     thì nó còn mở;
 *  3. ghi `admin_audit` (điều kiện founder đặt): một cú reset 2FA không bao giờ
 *     được im lặng — nếu có ngày nó chạy mà founder không phải người chạy, dòng
 *     audit đó là thứ duy nhất nói ra.
 */
export async function goBo2FA(
  pool: pg.Pool,
  email: string,
  lyDo: string,
): Promise<KetQuaGoBo> {
  const { rows } = await pool.query(
    `SELECT a.account_id, a.user_id, a.totp_confirmed_at, u.handle, u.role
       FROM auth_accounts a
       LEFT JOIN users u ON u.user_id = a.user_id
      WHERE a.email = $1`,
    [email.trim().toLowerCase()],
  );
  if (rows.length === 0) return { trang_thai: 'khong_co_tai_khoan' };
  const acc = rows[0];
  // Fail-closed: script chỉ tồn tại cho cửa admin. Nới phạm vi là mở một cửa
  // MỚI — đúng cái mà lý lẽ "không thêm quyền nào" dựa vào để đứng vững.
  if (acc.role !== 'admin') return { trang_thai: 'khong_phai_admin', role: String(acc.role) };
  if (acc.totp_confirmed_at === null) return { trang_thai: 'chua_bat' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE auth_accounts
          SET totp_secret = NULL, totp_confirmed_at = NULL, totp_buoc_cuoi = NULL
        WHERE account_id = $1`,
      [acc.account_id],
    );
    await client.query(
      `UPDATE auth_sessions
          SET admin_xac_thuc_luc = NULL, xac_thuc_lai_luc = NULL
        WHERE account_id = $1`,
      [acc.account_id],
    );
    await audit(client, acc.user_id, 'admin_2fa_reset', {
      email: email.trim().toLowerCase(), ly_do: lyDo, qua: 'script',
    });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return {
    trang_thai: 'da_go',
    handle: String(acc.handle),
    bat_luc: new Date(acc.totp_confirmed_at),
  };
}

export interface CuaAdmin {
  /** role = admin, KHÔNG đòi 2FA. Chỉ dùng cho route trong file này. */
  chiAdmin: Middleware;
  /** role = admin + đã ghi danh + phiên đã mở quyền còn hạn. */
  requireAdmin: Middleware;
  /** Thêm: vừa xác thực lại. Cho thao tác không hoàn tác được. */
  requireXacThucLai: Middleware;
}

export function dungCuaAdmin(pool: pg.Pool): CuaAdmin {
  const chiAdmin: Middleware = async (c, next) => {
    const actor = c.get('actor') as SessionActor;
    if (actor.role !== 'admin') {
      return c.json({ error: 'forbidden', message: 'Bạn không có quyền truy cập.' }, 403);
    }
    await next();
  };

  const requireAdmin: Middleware = async (c, next) => {
    const actor = c.get('actor') as SessionActor;
    if (actor.role !== 'admin') {
      return c.json({ error: 'forbidden', message: 'Bạn không có quyền truy cập.' }, 403);
    }
    if (!actor.totpDaGhiDanh) {
      return c.json(
        {
          error: 'can_ghi_danh_2fa',
          message: 'Tài khoản admin phải bật mã hai lớp trước khi dùng trang quản trị.',
        },
        403,
      );
    }
    if (!conTuoi(actor.adminXacThucLuc, AUTH.ADMIN.TTL_PHUT)) {
      return c.json(
        { error: 'can_mo_khoa_2fa', message: 'Nhập mã hai lớp để mở quyền quản trị.' },
        403,
      );
    }
    await next();
  };

  const requireXacThucLai: Middleware = async (c, next) => {
    const actor = c.get('actor') as SessionActor;
    if (!conTuoi(actor.xacThucLaiLuc, AUTH.ADMIN.XAC_THUC_LAI_PHUT)) {
      return c.json(
        {
          error: 'can_xac_thuc_lai',
          message: 'Thao tác này không hoàn tác được — nhập lại mã hai lớp để xác nhận.',
        },
        403,
      );
    }
    await next();
  };

  return { chiAdmin, requireAdmin, requireXacThucLai };
}

export function registerAdminBaoMatRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  deps: { requireAuth: Middleware; requireOnboarded: Middleware; chiAdmin: Middleware },
): void {
  const cua = [deps.requireAuth, deps.requireOnboarded, deps.chiAdmin] as const;

  /** Trạng thái để trang admin biết phải hiện ô nào. Không tiết lộ bí mật. */
  app.get('/api/v1/admin/2fa/trang-thai', ...cua, async (c) => {
    const actor = c.get('actor');
    return c.json({
      da_ghi_danh: actor.totpDaGhiDanh,
      quyen_con_han: conTuoi(actor.adminXacThucLuc, AUTH.ADMIN.TTL_PHUT),
      xac_thuc_lai_con_han: conTuoi(actor.xacThucLaiLuc, AUTH.ADMIN.XAC_THUC_LAI_PHUT),
      ttl_phut: AUTH.ADMIN.TTL_PHUT,
      xac_thuc_lai_phut: AUTH.ADMIN.XAC_THUC_LAI_PHUT,
    });
  });

  /**
   * Bắt đầu ghi danh — trả bí mật + URI để quét.
   *
   * Gọi lại khi CHƯA xác nhận thì sinh bí mật MỚI (quét hỏng, quét nhầm máy…).
   * Đã xác nhận rồi thì TỪ CHỐI: nếu không, ai cầm được phiên admin đang mở sẽ
   * lặng lẽ thay bí mật bằng của họ và khoá chủ tài khoản ra ngoài.
   */
  app.post('/api/v1/admin/2fa/ghi-danh', ...cua, async (c) => {
    const actor = c.get('actor');
    const { xong } = await docBiMat(pool, actor.accountId);
    if (xong) {
      return c.json(
        {
          error: 'da_ghi_danh',
          message: 'Đã bật mã hai lớp rồi. Mất thiết bị thì dùng scripts/admin_reset_2fa.ts.',
        },
        409,
      );
    }
    const biMat = sinhBiMat();
    await pool.query(
      `UPDATE auth_accounts SET totp_secret = $2, totp_buoc_cuoi = NULL WHERE account_id = $1`,
      [actor.accountId, biMat],
    );
    return c.json({ bi_mat: biMat, uri: uriGhiDanh(actor.email, biMat) });
  });

  /** Xác nhận ghi danh bằng một mã thật — và mở luôn quyền cho phiên này. */
  app.post('/api/v1/admin/2fa/xac-nhan', ...cua, async (c) => {
    const actor = c.get('actor');
    const kq = await consumeLimit(
      pool, `admin2fa:${actor.accountId}`, AUTH.ADMIN.TOTP_MAX_SAI, AUTH.ADMIN.TOTP_CUA_SO_PHUT,
    );
    if (!kq.allowed) return c.json({ error: 'rate_limited', message: 'Sai quá nhiều lần. Thử lại sau.' }, 429);

    const { secret, xong } = await docBiMat(pool, actor.accountId);
    if (xong) return c.json({ error: 'da_ghi_danh', message: 'Đã bật rồi.' }, 409);
    if (!secret) return c.json({ error: 'chua_ghi_danh', message: 'Bấm "Bắt đầu" trước đã.' }, 409);

    const ma = String((await c.req.json().catch(() => null))?.ma ?? '');
    if (!(await tieuMa(pool, actor.accountId, secret, ma))) {
      return c.json({ error: 'ma_sai', message: 'Mã không đúng hoặc đã dùng rồi.' }, 401);
    }
    /*
     * ⚠⚠ BA BÚT TOÁN NÀY PHẢI CÙNG SỐNG HOẶC CÙNG CHẾT (siết 11/08).
     *
     * Trước đây chúng chạy rời nhau, và điều đó chỉ vô hại vì `dongDauAdmin`
     * KHÔNG BAO GIỜ báo lỗi — nó nuốt cả trường hợp không đóng dấu được dòng
     * nào. Khi siết cho nó biết ném (đúng luật: một thao tác bảo mật không được
     * phép "chắc là xong"), chuỗi rời này lộ ra một trạng thái kẹt: tài khoản
     * ĐÃ bật 2FA, phiên CHƯA được đóng dấu, và dòng `admin_audit` không bao giờ
     * được ghi. Lần sau ghi danh lại ăn 409 "đã bật rồi" — với một admin duy
     * nhất thì đó là tự khoá mình ra ngoài, đúng thứ §I của bộ test canh.
     *
     * Gói vào một transaction: hụt bước nào thì quay về nguyên trạng và người
     * dùng chỉ việc bấm lại. Sổ kiểm (`admin_audit`) đi CÙNG hành động, không
     * phải một lời hứa ghi sau — cùng luật với `events` (A7).
     */
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE auth_accounts SET totp_confirmed_at = now() WHERE account_id = $1`,
        [actor.accountId],
      );
      await dongDauAdmin(client, docTokenPhien(c), 'mo_quyen');
      await audit(client, actor.userId!, 'admin_2fa_bat', { account_id: actor.accountId });
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return c.json({ ok: true });
  });

  /** Mở quyền admin cho phiên hiện tại (bước đăng nhập lớp hai). */
  app.post('/api/v1/admin/2fa/mo-khoa', ...cua, async (c) => {
    const actor = c.get('actor');
    const kq = await consumeLimit(
      pool, `admin2fa:${actor.accountId}`, AUTH.ADMIN.TOTP_MAX_SAI, AUTH.ADMIN.TOTP_CUA_SO_PHUT,
    );
    if (!kq.allowed) return c.json({ error: 'rate_limited', message: 'Sai quá nhiều lần. Thử lại sau.' }, 429);

    const { secret, xong } = await docBiMat(pool, actor.accountId);
    if (!xong || !secret) {
      return c.json({ error: 'can_ghi_danh_2fa', message: 'Chưa bật mã hai lớp.' }, 403);
    }
    const ma = String((await c.req.json().catch(() => null))?.ma ?? '');
    if (!(await tieuMa(pool, actor.accountId, secret, ma))) {
      return c.json({ error: 'ma_sai', message: 'Mã không đúng hoặc đã dùng rồi.' }, 401);
    }
    await dongDauAdmin(pool, docTokenPhien(c), 'mo_quyen');
    return c.json({ ok: true, con_han_phut: AUTH.ADMIN.TTL_PHUT });
  });

  /**
   * Xác thực lại ngay trước thao tác phá huỷ.
   *
   * Founder chốt dùng MÃ TOTP chứ không phải mật khẩu (đi lệch nguyên văn §3.2),
   * và lý do nằm ở mô hình đe doạ: kịch bản thật nhất là LAPTOP ĐĂNG NHẬP SẴN BỊ
   * BỎ QUÊN. Mật khẩu nằm trong trình quản lý mật khẩu nên "hỏi lại mật khẩu"
   * chỉ là một cú bấm Enter — tạo cảm giác an toàn mà không tạo an toàn. Mã TOTP
   * nằm trên điện thoại và đổi mỗi 30 giây.
   */
  app.post('/api/v1/admin/2fa/xac-thuc-lai', ...cua, async (c) => {
    const actor = c.get('actor');
    const kq = await consumeLimit(
      pool, `admin2fa:${actor.accountId}`, AUTH.ADMIN.TOTP_MAX_SAI, AUTH.ADMIN.TOTP_CUA_SO_PHUT,
    );
    if (!kq.allowed) return c.json({ error: 'rate_limited', message: 'Sai quá nhiều lần. Thử lại sau.' }, 429);

    const { secret, xong } = await docBiMat(pool, actor.accountId);
    if (!xong || !secret) {
      return c.json({ error: 'can_ghi_danh_2fa', message: 'Chưa bật mã hai lớp.' }, 403);
    }
    const ma = String((await c.req.json().catch(() => null))?.ma ?? '');
    if (!(await tieuMa(pool, actor.accountId, secret, ma))) {
      return c.json({ error: 'ma_sai', message: 'Mã không đúng hoặc đã dùng rồi.' }, 401);
    }
    await dongDauAdmin(pool, docTokenPhien(c), 'xac_thuc_lai');
    return c.json({ ok: true, con_han_phut: AUTH.ADMIN.XAC_THUC_LAI_PHUT });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * UỶ QUYỀN ADMIN (D208)
 *
 * Founder 31/08: *"t muốn người có quyền tương đương t… thêm cơ chế uỷ quyền đi"*.
 *
 * Trước đây thêm một admin phải gõ `UPDATE users SET role='admin'` thẳng vào DB,
 * tức phải cầm `.env.prod` — TOÀN QUYỀN database — chỉ để trao một quyền ứng
 * dụng. Và không để lại dấu vết nào trong `admin_audit`.
 *
 * ⚠ QUYỀN LÀ TƯƠNG ĐƯƠNG THẬT. Admin mới làm được đúng 31 route như founder, kể
 * cả 5 thao tác không hoàn tác được. Không có bậc quyền thứ hai. Ràng buộc duy
 * nhất: **không ai thu hồi được quyền của chủ sở hữu** — xem `0051`.
 * ══════════════════════════════════════════════════════════════════════════ */

export function registerAdminQuyenRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  deps: {
    requireAuth: Middleware; requireOnboarded: Middleware;
    requireAdmin: Middleware; requireXacThucLai: Middleware;
  },
): void {
  const doc = [deps.requireAuth, deps.requireOnboarded, deps.requireAdmin] as const;
  /*
   * ⚠ CỬA XÁC THỰC LẠI KIỂM TRONG HÀM, KHÔNG Ở CHUỖI MIDDLEWARE — vì nó áp KHÁC
   * NHAU cho hai loại người (founder 01/09: *"làm cho t thao tác nào nhanh gọn
   * vào miễn là t là người quản lý cấp cao nhất"*).
   *
   *   · **Chủ sở hữu** — đi thẳng. Họ đã nhập mã để mở phiên admin, và họ là
   *     người duy nhất không ai thu quyền được, nên một cú uỷ quyền lỡ tay của
   *     họ luôn tự thu lại được. Bắt nhập mã lần hai chỉ mua thêm ma sát.
   *   · **Admin thường** — vẫn phải xác thực lại. Với họ cú uỷ quyền KHÔNG tự
   *     thu lại được (người mới có quyền ngang họ), nên nó vẫn là thao tác
   *     không hoàn tác được, đúng hạng resolve/huỷ kèo.
   *
   * ⚠ Đây là một cú NỚI có ý thức, không phải bỏ chốt: hàng rào vẫn đứng cho
   * mọi người trừ đúng một người, và người đó là người chịu trách nhiệm cuối.
   */
  const ghi = [...doc] as const;

  app.get('/api/v1/admin/quyen', ...doc, async (c) => {
    const actor = c.get('actor');
    const { rows } = await pool.query(
      `SELECT u.user_id::text AS id, u.handle, u.chu_so_huu,
              (a.totp_confirmed_at IS NOT NULL) AS da_ghi_danh_2fa,
              u.created_at,
              (SELECT count(*)::int FROM admin_audit aa WHERE aa.admin_id = u.user_id)
                AS so_thao_tac
         FROM users u LEFT JOIN auth_accounts a ON a.user_id = u.user_id
        WHERE u.role = 'admin' AND u.deleted_at IS NULL
        ORDER BY u.chu_so_huu DESC, u.created_at`);
    /*
     * ỨNG VIÊN — để trang admin bày nút bấm MỘT PHÁT thay vì bắt gõ handle.
     * Gõ tay là chỗ sinh lỗi chính tả, và lỗi chính tả ở đây trả về 404 chứ
     * không nói "ý bạn là ai" — nên bỏ hẳn bước gõ rẻ hơn là làm thông báo lỗi
     * thông minh hơn.
     *
     * ⚠ Lọc SẴN theo đúng luật của cửa ghi (không khách, chưa là admin, chưa
     * xoá) — bày một cái tên rồi từ chối nó khi bấm là dạy người dùng rằng nút
     * bấm không đáng tin.
     */
    const { rows: ungVien } = await pool.query(
      /*
       * ⚠ `created_at` TRẢ NGUYÊN, KHÔNG `::date`. Bản đầu cắt về ngày ngay ở
       * máy chủ — và cắt ở đây thì client KHÔNG CÓ ĐƯỜNG NÀO lấy lại giờ/phút:
       * dữ liệu đã mất trước khi rời DB. Founder 01/09 bắt đúng chỗ này.
       * Với việc quản trị, "tạo lúc 14:32" và "tạo hôm nay" là hai thông tin
       * khác hẳn nhau — hai tài khoản tạo cách nhau 40 giây thì đáng chú ý,
       * mà nhìn theo ngày là chúng giống hệt nhau.
       * Luật chung: SERVER trả mốc thời gian ĐẦY ĐỦ, CLIENT quyết hiển thị bao
       * nhiêu (D26 — server trả ID + SỐ, chữ ở client).
       */
      `SELECT u.handle, u.created_at AS tao,
              (SELECT count(*)::int FROM holdem_matches m WHERE m.owner_user_id = u.user_id)
                AS tran
         FROM users u
        WHERE u.role = 'user' AND NOT u.la_khach AND u.deleted_at IS NULL
        ORDER BY u.created_at DESC LIMIT 25`);

    return c.json({
      admin: rows.map((r) => ({
        handle: r.handle, chu_so_huu: r.chu_so_huu,
        da_ghi_danh_2fa: r.da_ghi_danh_2fa, so_thao_tac: Number(r.so_thao_tac),
        la_toi: r.id === actor.userId,
      })),
      ung_vien: ungVien.map((r) => ({
        handle: r.handle, tao: r.tao, tran: Number(r.tran),
      })),
      toi_la_chu: rows.some((r) => r.id === actor.userId && r.chu_so_huu),
    });
  });

  app.post('/api/v1/admin/quyen', ...ghi, async (c) => {
    const actor = c.get('actor');
    const body = await c.req.json().catch(() => ({})) as { handle?: unknown; cho?: unknown };
    const handle = typeof body.handle === 'string' ? body.handle.trim() : '';
    const cho = body.cho === true;
    if (!handle) return c.json({ error: 'thieu_handle' }, 400);

    /*
     * Chủ sở hữu đi thẳng; admin thường phải còn "tươi" mã hai lớp. Đọc cờ chủ
     * sở hữu từ DB chứ không từ phiên: phiên được cấp lúc đăng nhập và có thể
     * đã cũ hơn một cú chuyển quyền.
     */
    const { rows: toi } = await pool.query(
      `SELECT chu_so_huu FROM users WHERE user_id = $1`, [actor.userId]);
    if (!toi[0]?.chu_so_huu
        && !conTuoi(actor.xacThucLaiLuc, AUTH.ADMIN.XAC_THUC_LAI_PHUT)) {
      return c.json({
        error: 'can_xac_thuc_lai',
        message: 'Nhập lại mã hai lớp để xác nhận — bạn không phải chủ sở hữu.',
      }, 403);
    }

    const cn = await pool.connect();
    try {
      await cn.query('BEGIN');
      const { rows } = await cn.query(
        `SELECT user_id::text AS id, role, chu_so_huu, la_khach
           FROM users WHERE handle = $1 AND deleted_at IS NULL FOR UPDATE`, [handle]);
      const u = rows[0];
      if (!u) { await cn.query('ROLLBACK'); return c.json({ error: 'khong_co_nguoi' }, 404); }

      /*
       * ⚠ KHÁCH KHÔNG BAO GIỜ THÀNH ADMIN. Tài khoản khách tạo được không cần
       * email (0030, 5 khách/IP/giờ) — cho nó lên admin là biến một cửa mở
       * thành đường leo quyền.
       */
      if (cho && u.la_khach) {
        await cn.query('ROLLBACK'); return c.json({ error: 'khach_khong_the_len_admin' }, 409);
      }
      // No-op cũng là một cú TỪ CHỐI, không phải một cú thành công (D70).
      if (cho && u.role === 'admin') {
        await cn.query('ROLLBACK'); return c.json({ error: 'da_la_admin' }, 409);
      }
      if (!cho && u.role !== 'admin') {
        await cn.query('ROLLBACK'); return c.json({ error: 'von_khong_phai_admin' }, 409);
      }
      // Chủ sở hữu không bị ai thu quyền — kể cả chính mình (xem 0051).
      if (!cho && u.chu_so_huu) {
        await cn.query('ROLLBACK'); return c.json({ error: 'khong_thu_duoc_chu_so_huu' }, 409);
      }
      if (!cho) {
        /*
         * ⚠ KHÔNG ĐỂ APP RƠI VỀ 0 ADMIN. Kèo có hạn và đang giữ token người chơi
         * (A3.2); không còn ai resolve được là hỏng đúng thứ không hoãn được.
         * Đếm TRONG transaction đã `FOR UPDATE` nên hai cú thu quyền song song
         * không thể cùng thấy "còn 2".
         */
        const { rows: d } = await cn.query(
          `SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND deleted_at IS NULL`);
        if (Number(d[0].n) <= 1) {
          await cn.query('ROLLBACK'); return c.json({ error: 'khong_con_admin_nao' }, 409);
        }
      }

      await cn.query(`UPDATE users SET role = $2 WHERE user_id = $1`,
        [u.id, cho ? 'admin' : 'user']);
      await cn.query(
        `INSERT INTO admin_audit (admin_id, action, payload_json) VALUES ($1, $2, $3)`,
        [actor.userId, cho ? 'quyen_uy' : 'quyen_thu',
          // SPEC chan-truoc-beta — append-only ⇒ user_id, không tên (xem `admin_phan_tich.ts` cùng lý do).
          JSON.stringify({ user_id: u.id, nguon: 'POST /admin/quyen' })]);
      await cn.query('COMMIT');
    } catch (e) {
      await cn.query('ROLLBACK').catch(() => {});
      throw e;
    } finally { cn.release(); }

    return c.json({ ok: true, handle, la_admin: cho });
  });
}
