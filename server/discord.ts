/**
 * CỬA DISCORD — PHÍA MÁY CHỦ (bản yêu cầu 02, mùa 0.0).
 *
 * Một endpoint duy nhất: `POST /api/v1/auth/discord/token`. Client gửi mã uỷ
 * quyền, máy chủ đổi lấy access_token của Discord, tìm-hoặc-tạo tài khoản, rồi
 * cấp phiên DELPHI.
 *
 * ⚠ CHƯA CẮM VÀO `server/app.ts` — một phiên làm việc khác đang giữ file đó.
 * Cắm bằng đúng một dòng, xem cuối file.
 *
 * ─── BỐN LUẬT CỦA CÁI CỬA NÀY ────────────────────────────────────────────────
 *
 * 1. **`client_secret` KHÔNG BAO GIỜ rời máy chủ.** Đó là lý do bước đổi mã nằm
 *    ở đây chứ không ở client, dù client mới là nơi có cái mã.
 *
 * 2. **Không tin client về DANH TÍNH.** Discord user id lấy từ câu trả lời của
 *    Discord cho access_token, KHÔNG lấy từ body request. Client gửi lên cái gì
 *    cũng không đọc tới.
 *
 * 3. ⚠⚠ **TÌM-HOẶC-TẠO PHẢI NGUYÊN TỬ.** Hai request cùng lúc của cùng một người
 *    (bấm hai lần, mạng chập) mà cả hai cùng "không thấy thì tạo" là **hai hàng
 *    `users` cho một người** — và `events` append-only nên KHÔNG GỘP LẠI ĐƯỢC,
 *    kể cả sang mùa mới (bản yêu cầu 02 §3). `ON CONFLICT` trên
 *    `UNIQUE(provider, provider_user_id)` là chỗ chặn, không phải một câu SELECT
 *    trước đó.
 *
 * 4. **Tài khoản mới KHÔNG có nhân khẩu.** Bậc 0 chơi trước, bậc 1 mới hỏi
 *    (founder chốt phương án B). `age_band` NULL nghĩa là CHƯA HỎI, không phải
 *    được miễn C8 — chỗ ép chuyển sang các endpoint đụng ví/rank.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { DISCORD, NHA_CUNG_CAP, handleTuTenDiscord, tenDuPhong } from '../config/discord.js';

import type { Mw as Middleware } from './http/types.js';

/**
 * Lỗi có phân loại: **lỗi CỦA NGƯỜI GỌI** hay **lỗi CỦA HỆ THỐNG**.
 *
 * ⚠⚠ PHÂN BIỆT NÀY KHÔNG PHẢI CHUYỆN THẨM MỸ MÃ TRẠNG THÁI — nó lộ ra khi chạy
 * thật trên prod: mã hết hạn / mã dùng lại là chuyện THƯỜNG NGÀY (người chơi tải
 * lại trang, bấm hai lần), nhưng bản đầu trả **502** cho nó. Và Cloudflare CHẶN
 * mọi 5xx từ origin rồi thay bằng trang HTML của chính nó ⇒ client nhận HTML
 * thay vì JSON, `res.json()` ném, và người chơi thấy một lỗi hoàn toàn khác với
 * lỗi thật.
 * ⇒ Sai của người gọi phải là 4xx. 5xx chỉ dành cho lúc HỆ THỐNG thật sự hỏng.
 */
export class LoiDiscord extends Error {
  constructor(public readonly ma: string, public readonly cuaNguoiGoi: boolean) {
    super(ma);
    this.name = 'LoiDiscord';
  }
}

/** Thông tin tối thiểu lấy được từ Discord. Không giữ gì hơn (C7). */
export interface NguoiDiscord {
  id: string;
  /** `username` hoặc `global_name` — chỉ dùng để suy ra handle, KHÔNG lưu lại. */
  ten: string;
}

/* ══════════════════════════════════════════════════════════════════════════
 * ĐỔI MÃ — tách riêng để test được mà không đụng mạng
 * ══════════════════════════════════════════════════════════════════════════ */

export interface CauHinhDiscord {
  clientId: string;
  clientSecret: string;
}

/**
 * Đổi mã uỷ quyền lấy access_token, rồi hỏi Discord "người này là ai".
 *
 * ⚠ `fetch` PHẢI có hạn chờ. D57 đã trả giá cho bài học này ở client: `fetch`
 * không tự bỏ cuộc, nên một Discord chậm là một hàm serverless treo tới lúc
 * Vercel giết nó — và người chơi thấy một màn hình đứng im không lý do.
 */
export async function doiMaLayNguoi(
  ch: CauHinhDiscord,
  code: string,
  fetchFn: typeof fetch = fetch,
): Promise<NguoiDiscord> {
  const than = new URLSearchParams({
    client_id: ch.clientId,
    client_secret: ch.clientSecret,
    grant_type: 'authorization_code',
    code,
  });

  const r = await fetchFn(DISCORD.URL_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: than.toString(),
    signal: AbortSignal.timeout(DISCORD.HAN_CHO_MS),
  });
  // Discord trả 4xx = MÃ hỏng (hết hạn, đã dùng, sai client) ⇒ lỗi của người gọi.
  // 5xx hoặc hình dạng lạ = Discord đang hỏng ⇒ lỗi hệ thống.
  if (!r.ok) throw new LoiDiscord(`discord_token_${r.status}`, r.status >= 400 && r.status < 500);
  const tk = (await r.json()) as { access_token?: string };
  if (!tk.access_token) throw new LoiDiscord('discord_token_thieu', false);

  const u = await fetchFn(DISCORD.URL_ME, {
    headers: { authorization: `Bearer ${tk.access_token}` },
    signal: AbortSignal.timeout(DISCORD.HAN_CHO_MS),
  });
  // Tới bước này token đã hợp lệ, nên 4xx ở đây là bất thường của hệ thống,
  // KHÔNG phải lỗi người gọi — đừng đổ ngược cho họ.
  if (!u.ok) throw new LoiDiscord(`discord_me_${u.status}`, false);
  const me = (await u.json()) as { id?: string; username?: string; global_name?: string };
  if (!me.id) throw new LoiDiscord('discord_me_thieu_id', false);

  return {
    id: me.id,
    ten: me.global_name || me.username || '',
    // access_token đi kèm để client gọi `commands.authenticate` — xem
    // `web/src/lib/discord.ts`. KHÔNG lưu nó xuống DB: ta không dùng nó để làm gì.
    ...({ accessToken: tk.access_token } as any),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * TÌM HOẶC TẠO
 * ══════════════════════════════════════════════════════════════════════════ */

export interface KetQuaLienKet {
  accountId: string;
  userId: string;
  handle: string;
  /** Tài khoản VỪA ĐƯỢC TẠO trong lượt này. */
  moi: boolean;
  /**
   * Đã gắn danh tính Discord vào một tài khoản KHÁCH có sẵn (thay vì tạo mới).
   *
   * ⚠ Khác `moi` và không suy ra được từ nó: cả hai đều là "chưa từng khai nhân
   * khẩu", nhưng bản nâng cấp thì ĐÃ CÓ lịch sử chơi — và `events` append-only
   * nên lịch sử ấy vĩnh viễn nằm dưới `user_id` đó.
   */
  nangCap: boolean;
  /**
   * Danh tính Discord vừa được GẮN vào một tài khoản CÓ SẴN (khách hoặc email),
   * thay vì tạo tài khoản mới.
   *
   * ⚠ `nangCap` là tập con của cờ này: mọi lần nâng cấp đều là liên kết, nhưng
   * liên kết một tài khoản email thì KHÔNG nâng cấp gì cả — nó vốn đã là tài
   * khoản thật. Gộp làm một cờ thì giao diện chỉ nói được một trong hai câu.
   */
  lienKet: boolean;
}

/**
 * Tìm tài khoản theo danh tính Discord; chưa có thì tạo trọn bộ
 * (`auth_accounts` → `auth_identities` → `users`) trong MỘT transaction.
 *
 * ⚠⚠ ĐIỂM CHỐNG RẼ ĐÔI nằm ở `ON CONFLICT (provider, provider_user_id)`, không
 * nằm ở câu SELECT mở đầu. SELECT chỉ là đường nhanh cho lần thứ hai trở đi;
 * nếu chỉ có SELECT thì hai request song song cùng thấy "chưa có" và cùng tạo.
 *
 * ─── VÌ SAO LÀ VÒNG LẶP CHỨ KHÔNG PHẢI ĐỆ QUY (vá 04/08) ─────────────────────
 *
 * Bản đầu thua đua thì `return timHoacTao(pool, …)` — **gọi lại trong khi vẫn
 * đang cầm `client`** (`finally` chưa chạy). Trên prod `api/index.ts` mở pool với
 * `max: 1`, nên lượt hai xin kết nối thứ hai là **xin chính cái mình đang giữ**:
 * chờ vĩnh viễn, Vercel cắt ở 10,4 giây, người chơi thấy 504 giữa lúc bắt tay.
 *
 * ⚠ Đúng bug đã nổ ở cửa KHÁCH sáng nay (commit `20b4bec`) — cùng cơ chế, cùng
 * kiểu không tái lập được ở local vì pool local `max: 10`. Nay lint
 * `scripts/lint_pool_lock.ts` canh cả repo, và `tests/pool_max1.test.ts` chạy
 * chính đường này trên một pool `max: 1`.
 *
 * Tách làm hai: vòng lặp ở đây (KHÔNG cầm kết nối nào), một lượt ghi danh ở
 * `motLuotGhiDanh` (cầm đúng một kết nối, nhả trước khi trả về).
 */
export interface TuyChonLienKet {
  seasonId: string;
  ngauNhien?: () => string;
  /**
   * Tài khoản ĐANG ĐĂNG NHẬP (nếu có) — GẮN danh tính Discord vào chính nó thay
   * vì tạo tài khoản thứ hai. Phục vụ HAI việc, và chúng khác nhau về động cơ:
   *
   *  1. **Khách nâng cấp** — trong Discord người chơi vào KHÁCH ngay từ giây đầu.
   *     Nếu về sau bắt tay chạy được mà ta tạo tài khoản MỚI thì lịch sử chơi nằm
   *     dưới `user_id` cũ, và **`events` append-only nên không gộp lại được, kể
   *     cả sang mùa mới** (D64 luật 3). Cùng một người thành hai người vĩnh viễn.
   *  2. **Liên kết tài khoản web ↔ Discord** (founder 04/08) — người đã có tài
   *     khoản email, mở Activity, và muốn đó là TÀI KHOẢN CỦA HỌ chứ không phải
   *     một tài khoản khách thứ n.
   *
   * ⚠ Điều kiện kiểm TRONG SQL, không tin người gọi: tài khoản phải tồn tại và
   * CHƯA gắn danh tính nào. Phiên chứng minh "đây là tài khoản của người đang
   * ngồi đây"; OAuth Discord chứng minh "đây là Discord của chính người đó".
   * Thiếu vế nào cũng không được gắn.
   */
  accountHienTai?: string | null;
}

export async function timHoacTao(
  pool: pg.Pool,
  nguoi: NguoiDiscord,
  opts: TuyChonLienKet = { seasonId: '' },
): Promise<KetQuaLienKet> {
  for (let lan = 1; lan <= DISCORD.SO_LAN_THU_DUA; lan += 1) {
    const kq = await motLuotGhiDanh(pool, nguoi, opts);
    if (kq) return kq;
  }
  // Thua đua liên tiếp mấy lượt = trạng thái bất thường, không phải lỗi người gọi.
  throw new LoiDiscord('discord_ghi_danh_dua', false);
}

/** Một lượt. `null` = thua cuộc đua ghi danh, người gọi thử lượt nữa. */
async function motLuotGhiDanh(
  pool: pg.Pool,
  nguoi: NguoiDiscord,
  opts: TuyChonLienKet,
): Promise<KetQuaLienKet | null> {
  const ngauNhien = opts.ngauNhien ?? (() => Math.random().toString(36).slice(2, 10));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cu = await client.query(
      `SELECT a.account_id, a.user_id, u.handle
         FROM auth_identities i
         JOIN auth_accounts a ON a.account_id = i.account_id
         LEFT JOIN users u ON u.user_id = a.user_id
        WHERE i.provider = $1 AND i.provider_user_id = $2`,
      [NHA_CUNG_CAP, nguoi.id],
    );
    if (cu.rowCount && cu.rows[0].user_id) {
      /*
       * ⚠ Danh tính Discord này ĐÃ CÓ tài khoản ⇒ dùng nó, KỆ tài khoản khách
       * đang gọi. Không gộp hai lịch sử — `events` append-only, gộp là bịa ra
       * một quá khứ chưa từng xảy ra (A3.3). Người chơi mất phần đã chơi ở phiên
       * khách kia, và đó là cái giá đúng: chỉ có một trong hai là "họ".
       */
      await client.query('COMMIT');
      return {
        accountId: cu.rows[0].account_id,
        userId: cu.rows[0].user_id,
        handle: cu.rows[0].handle,
        moi: false,
        nangCap: false,
        lienKet: false,
      };
    }

    /*
     * GẮN VÀO TÀI KHOẢN ĐANG ĐĂNG NHẬP — xem lý do dài ở
     * `TuyChonLienKet.accountHienTai`. Điều kiện kiểm TRONG SQL, không tin client:
     * đúng tài khoản đó · chưa gắn danh tính nào · chưa bị xoá.
     *
     * ⚠ KHÔNG còn đòi `la_khach` (nới 04/08, founder: *"làm luôn chức năng liên
     * kết tài khoản discord và tài khoản web"*). Điều kiện thật sự cần là **chưa
     * có danh tính nào**, không phải "phải là khách" — một tài khoản email đã tồn
     * tại thì càng có lý do chính đáng để gắn Discord vào.
     * Cái vẫn phải giữ là `NOT EXISTS` bên dưới: nó chặn việc một tài khoản mang
     * hai danh tính Discord, và chặn ghi đè lên liên kết đã có.
     */
    if (opts.accountHienTai) {
      const kh = await client.query(
        `SELECT a.account_id, a.user_id, u.handle, u.la_khach
           FROM auth_accounts a
           JOIN users u ON u.user_id = a.user_id
          WHERE a.account_id = $1
            AND u.deleted_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM auth_identities i WHERE i.account_id = a.account_id)`,
        [opts.accountHienTai],
      );
      if (kh.rowCount) {
        const gan = await client.query(
          `INSERT INTO auth_identities (account_id, provider, provider_user_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (provider, provider_user_id) DO NOTHING
           RETURNING identity_id`,
          [kh.rows[0].account_id, NHA_CUNG_CAP, nguoi.id],
        );
        // Thua đua: ai đó vừa ghi danh tính này xong ⇒ thử lượt nữa, lượt sau
        // sẽ đi đường SELECT nhanh ở trên.
        if (gan.rowCount === 0) {
          await client.query('ROLLBACK');
          return null;
        }
        /*
         * ⚠ BỎ CỜ KHÁCH trong CÙNG transaction — đúng đường mà `0030_khach.sql`
         * đã khai là đường mong muốn ("khách nâng cấp… `la_khach` chuyển false
         * trong cùng transaction với việc gắn danh tính").
         *
         * ⚠⚠ VÀ NÓ MỞ RANK. Phải làm, vì tài khoản do `timHoacTao` tạo THẲNG từ
         * Discord vốn đã `la_khach = false`; để nguyên cờ ở nhánh này thì cùng
         * một người có quyền khác nhau chỉ vì lần mở đầu tiên bắt tay có chạy hay
         * không — một khác biệt vô hình, đúng loại tệ nhất.
         * ⚠ Ghi để founder biết: nghĩa là "có danh tính Discord" hiện đủ để đấu
         * rank mà CHƯA qua age gate C8 (bậc 1 hỏi năm sinh SAU trận đầu, D64).
         * Đó là trạng thái CÓ SẴN của cửa Discord, không phải thứ commit này đẻ ra.
         */
        const laKhach = kh.rows[0].la_khach === true;
        if (laKhach) {
          await client.query(
            `UPDATE users SET la_khach = false WHERE user_id = $1`, [kh.rows[0].user_id]);
        }
        await client.query('COMMIT');
        return {
          accountId: kh.rows[0].account_id,
          userId: kh.rows[0].user_id,
          handle: kh.rows[0].handle,
          moi: false,
          // Khách hoá thành tài khoản thật ⇒ NÂNG CẤP. Tài khoản email gắn thêm
          // Discord ⇒ chỉ LIÊN KẾT, không có gì được nâng. Hai câu khác nhau để
          // nói với người dùng, nên là hai cờ chứ không phải một.
          nangCap: laKhach,
          lienKet: true,
        };
      }
    }

    // Handle: giữ tên Discord nếu dùng được (founder chốt phương án A), rơi về
    // tên trung tính nếu không. Trùng tên thì thêm hậu tố, có trần thử.
    let handle = handleTuTenDiscord(nguoi.ten) ?? tenDuPhong(ngauNhien);
    for (let i = 0; i < DISCORD.SO_LAN_THU_TRUNG_TEN; i += 1) {
      const co = await client.query(`SELECT 1 FROM users WHERE handle = $1`, [handle]);
      if (co.rowCount === 0) break;
      handle = tenDuPhong(ngauNhien);
    }

    const acc = await client.query(
      `INSERT INTO auth_accounts DEFAULT VALUES RETURNING account_id`,
    );
    const accountId = acc.rows[0].account_id as string;

    /*
     * ⚠ CHỖ CHẶN THẬT. Thua cuộc đua thì `RETURNING` rỗng ⇒ ta bỏ dòng vừa tạo
     * và đọc lại của người thắng, thay vì tạo hàng `users` thứ hai.
     */
    const dt = await client.query(
      `INSERT INTO auth_identities (account_id, provider, provider_user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (provider, provider_user_id) DO NOTHING
       RETURNING identity_id`,
      [accountId, NHA_CUNG_CAP, nguoi.id],
    );
    if (dt.rowCount === 0) {
      await client.query('ROLLBACK');
      // Nhả kết nối RỒI mới thử lại — xem lý do dài ở `timHoacTao`.
      return null;
    }

    // Bậc 0: KHÔNG nhân khẩu, KHÔNG ví, KHÔNG vốn khởi điểm. Đấu trường không
    // đụng tới `bankroll` nên không cần cấp gì cả.
    const us = await client.query(
      `INSERT INTO users (handle, season_id) VALUES ($1, $2) RETURNING user_id`,
      [handle, opts.seasonId],
    );
    const userId = us.rows[0].user_id as string;
    await client.query(
      `UPDATE auth_accounts SET user_id = $1 WHERE account_id = $2`, [userId, accountId],
    );

    await client.query('COMMIT');
    return { accountId, userId, handle, moi: true, nangCap: false, lienKet: false };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * ROUTE
 * ══════════════════════════════════════════════════════════════════════════ */

export function registerDiscordRoutes(
  app: Hono<any>,
  pool: pg.Pool,
  deps: {
    cauHinh: CauHinhDiscord | null;
    seasonId: string;
    /**
     * Cấp phiên DELPHI. Dùng lại đúng hàm luồng email dùng — không tự chế.
     * ⚠ NHẬN `accountId`, KHÔNG PHẢI `userId`. `createSession` neo vào
     * `auth_sessions.account_id`; đưa nhầm `user_id` vào thì khoá ngoại vẫn
     * lọt (cả hai đều là uuid) nhưng phiên trỏ vào một tài khoản không tồn tại
     * — sai im lặng, không có lỗi nào để lần theo.
     */
    taoPhien: (accountId: string) => Promise<string>;
    clientIp: (c: any) => string;
    rateLimit?: Middleware;
    /**
     * Phiên đang gọi, nếu có. Dùng ĐÚNG MỘT việc: nhận ra người này đang ngồi
     * trong một tài khoản KHÁCH để GẮN danh tính Discord vào chính nó.
     *
     * ⚠ Trả `null` khi không có phiên là chuyện bình thường, KHÔNG phải lỗi —
     * người mở Activity lần đầu thì làm gì có phiên nào.
     */
    phienHienTai?: (c: any) => Promise<{ accountId: string; laKhach: boolean } | null>;
  },
): void {
  app.post('/api/v1/auth/discord/token', async (c) => {
    // Vắng cấu hình ⇒ cửa ĐÓNG, và nói rõ. Fail-closed như CORS của D57: một
    // cửa auth mở toang vì quên đặt biến môi trường là chuyện không được phép xảy ra.
    if (!deps.cauHinh) return c.json({ error: 'discord_chua_cau_hinh' }, 503);

    const body = await c.req.json().catch(() => null);
    const code = (body as any)?.code;
    if (typeof code !== 'string' || code.length < 8 || code.length > 512) {
      return c.json({ error: 'code_khong_hop_le' }, 400);
    }

    /*
     * Đang ngồi trong một tài khoản KHÁCH? Thì gắn danh tính vào chính nó.
     * ⚠ Hỏi TRƯỚC khi gọi sang Discord: nếu hỏi sau thì một Discord chậm cũng
     * kéo dài khoảng thời gian giữa "đọc phiên" và "dùng phiên" mà chẳng được gì.
     * Phiên hỏng/không có ⇒ `null` ⇒ đi tiếp như thường, KHÔNG chặn ai.
     */
    const phien = deps.phienHienTai ? await deps.phienHienTai(c).catch(() => null) : null;
    /*
     * ⚠ TRUYỀN TÀI KHOẢN BẤT KỂ KHÁCH HAY THẬT (nới 04/08). Bản trước chỉ nhận
     * khi `laKhach` — nên người đã có tài khoản email mở Activity thì Discord đẻ
     * cho họ một tài khoản THỨ HAI, đúng thứ founder vừa phàn nàn. Điều kiện thật
     * sự cần ("tài khoản này chưa gắn danh tính nào") được kiểm TRONG SQL ở
     * `timHoacTao`, chỗ nó không lách được.
     */
    const accountHienTai = phien?.accountId ?? null;

    try {
      const nguoi = await doiMaLayNguoi(deps.cauHinh, code);
      const kq = await timHoacTao(pool, nguoi, { seasonId: deps.seasonId, accountHienTai });
      const token = await deps.taoPhien(kq.accountId);
      return c.json({
        // CỦA DISCORD — client đưa vào `commands.authenticate()`.
        access_token: (nguoi as any).accessToken,
        // CỦA DELPHI — client mang bằng `Authorization: Bearer`.
        token,
        handle: kq.handle,
        moi: kq.moi,
        nang_cap: kq.nangCap,
        lien_ket: kq.lienKet,
      });
    } catch (err) {
      /*
       * ⚠ 4xx cho lỗi của người gọi. Ngoài chuyện đúng nghĩa, nó còn tránh một
       * cái bẫy đo được trên prod: Cloudflare thay MỌI 5xx của origin bằng trang
       * HTML của nó, nên client nhận HTML thay vì JSON và báo sai hoàn toàn.
       */
      if (err instanceof LoiDiscord && err.cuaNguoiGoi) {
        return c.json({ error: 'ma_khong_hop_le' }, 400);
      }
      console.error('discord token loi', err);
      return c.json({ error: 'discord_that_bai' }, 502);
    }
  });
}

/*
 * ── CÁCH CẮM (một dòng, khi `server/app.ts` rảnh) ─────────────────────────────
 *
 *   registerDiscordRoutes(app, pool, {
 *     cauHinh: env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET
 *       ? { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET }
 *       : null,
 *     seasonId: SEASON_ID,
 *     taoPhien: (userId) => createSession(pool, userId),
 *     clientIp: clientIpCoNguon,
 *   });
 *
 * ⚠ CÒN THIẾU TRƯỚC KHI CẮM — hai món nằm trong `server/app.ts` nên chưa làm được:
 *   · `resolveSession` phải nhận `Authorization: Bearer` bên cạnh cookie (ba chỗ
 *     đọc cookie). Không có nó thì cửa này cấp token xong mà không ai đọc được.
 *   · thêm `https://{clientId}.discordsays.com` vào `ALLOWED_ORIGIN`.
 */
