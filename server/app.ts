/**
 * Toàn bộ API /api/v1 — một Hono app duy nhất.
 *
 * Vì sao gom một app thay vì mỗi endpoint một file serverless (A8.9):
 *   1. Vercel Hobby giới hạn 12 function/deployment — mỗi endpoint một file sẽ
 *      chạm trần ngay ở GĐ3; gom router = trần biến mất vĩnh viễn.
 *   2. Hono chạy trên Node/Workers/Deno/Bun — rời Vercel là đổi adapter 3 dòng,
 *      không viết lại route nào.
 *   3. Test được TOÀN BỘ tầng HTTP ở local bằng app.request() + embedded Postgres,
 *      không mock, không cần deploy.
 *
 * Mọi phụ thuộc (DB, mailer, secret) tiêm vào qua createApp → test dùng đồ thật.
 */
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type pg from 'pg';
import { AUTH, DEMOGRAPHIC, GIONG_HO_SO, handleBlockReason } from '../config/auth.js';
import { ECONOMY } from '../config/economy.js';
import { BAN_PHAT_HANH } from '../config/phien_ban.js';
import { checkAgeGate } from './auth/age.js';
import { hashPassword, verifyPassword, kiemMatKhau, generateToken, hashToken, safeEqual } from './auth/crypto.js';
import {
  createSession,
  docTokenPhien,
  resolveSession,
  revokeSession,
  revokeAllSessions,
  purgeExpiredSessions,
  type SessionActor,
} from './auth/session.js';
import { consumeLimit, clearAttempts, purgeOldAttempts } from './auth/rate_limit.js';
import { donKhachBoHoang } from './auth/don_khach.js';
import { laBanBuoiDoDangMo } from './holdem/ban_buoi_do.js';
import { currentSeasonId } from './season.js';
import { registerDiscordRoutes } from './discord.js';
import { NHA_CUNG_CAP } from '../config/discord.js';
import { verifyEmailMail, resetPasswordMail, type Mailer } from './email.js';
import type { BackupResult } from './backup.js';
import { registerMarketRoutes } from './markets.js';
import { registerProgressionRoutes } from './progression.js';
import { registerSubsidyRoutes } from './subsidy.js';
import { registerAdminRoutes } from './admin.js';
import { capBoKhoiDau, dienMaoGheNguoi, registerAvatarRoutes } from './avatar.js';
import { DIEN_MAO_MAC_DINH, NEN_TANG } from '../config/avatar.js';
import { registerShopRoutes } from './shop.js';
import { registerChoRoutes } from './cho.js';
import { registerHoldemRoutes, quetTranQuaHan, hanhViDeps } from './holdem_api.js';
import { capNhatNen as capNhatHanhViNen } from './hanh_vi/kho.js';
import {
  ghiDoTreRounds, giaySauThuLai, laHetKetNoi, nenBaoHetKetNoi, soLieuTai,
} from './tai.js';
import { registerRankRoutes, xayBxhTick } from './rank_api.js';
import { bacTuDiem } from '../config/rank.js';
import { registerRankGhepRoutes } from './rank_ghep_api.js';
import { chotBanQuaHan, ghepCacSuat } from './rank_ghep.js';
import { ghepBanBat } from '../config/rank_ghep.js';
import { ADMIN_HTML } from './admin_ui.js';
import { runSchedulerPass } from './scheduler.js';
import { registerTelemetryRoutes } from './telemetry.js';
import { registerDuLieuCuaToiRoutes } from './du_lieu_cua_toi.js';
import { canHoiLaiNghienCuu, datNghienCuu, nghienCuuHieuLuc, VAN_BAN_NGHIEN_CUU } from './nghien_cuu.js';
import { CONSENT_PHIEN_BAN, laConsentHienHanh } from '../config/pfm_consent.js';
import { cuonTelemetryTick } from './telemetry_cuon.js';
import { dungCuaAdmin, registerAdminBaoMatRoutes, registerAdminQuyenRoutes } from './admin_bao_mat.js';
import { registerAdminKhoRoutes } from './admin_kho.js';
import { registerAdminKinhTeRoutes } from './admin_kinh_te.js';
import { registerAdminThongKeRoutes } from './admin_thongke.js';
import { mienSuat, registerSuatTranAdmin, tranNgayHieuLuc } from './suat_tran.js';
import { registerAdminPhanTichRoutes } from './admin_phan_tich.js';
import { registerAdminDotThuRoutes } from './admin_dot_thu.js';
import { registerAdminSanPhamRoutes } from './admin_san_pham.js';
import { registerAdminKeoRoutes } from './admin_keo.js';
import { registerAdminTesterRoutes } from './admin_tester.js';
import { KENH_IM, type KenhBaoLoi } from './bao_loi.js';
import { xoaSachPfm } from './pfm/xoa.js';
import { registerPfmRoutes, COT_CUA_SELECT, cuaTuHang } from './pfm/api.js';
import { docChuoi } from './pfm/ngay.js';
import { docViToken } from './pfm/token.js';
import { docTrangThaiTuan } from './pfm/tuan.js';
import { kiemCanh, nenBaoCanh } from './canh.js';
import { registerLoiClientAnDanhRoutes } from './loi_client_an_danh.js';

export const API_VERSION = 'v0.4.0-gd4';

export interface AppDeps {
  pool: pg.Pool;
  mailer: Mailer;
  /** Gốc URL frontend để dựng link trong email. */
  appBaseUrl: string;
  /** Secret của scheduler lớp 2 (cron-job.org) — D444: dùng lại để mở phần
   *  CHI TIẾT của `/health` (header `x-tick-secret`), không đẻ secret mới. */
  tickSecret?: string | undefined;
  /** Secret của Vercel cron gọi backup đêm (Authorization: Bearer <CRON_SECRET>). */
  backupSecret?: string | undefined;
  /**
   * Secret dùng chung với Cloudflare Worker proxy. Có mặt → tin header
   * `x-delphi-client-ip` khi `x-delphi-proxy-secret` khớp (xem clientIp).
   */
  proxySecret?: string | undefined;
  /**
   * Cửa Discord. VẮNG MỘT TRONG HAI ⇒ endpoint trả 503 (fail-closed, D57).
   * `discordClientId` không phải bí mật; `discordClientSecret` thì có, và nó
   * chỉ được sống trong biến môi trường trên Vercel (D17e).
   */
  discordClientId?: string | undefined;
  discordClientSecret?: string | undefined;
  /** Chạy backup end-to-end (collect + đẩy GitHub). Vắng → endpoint trả 501. */
  runBackup?: ((pool: pg.Pool) => Promise<BackupResult>) | undefined;
  allowedOrigin?: string | undefined;
  /** Cookie Secure — tắt trong test HTTP. */
  secureCookie?: boolean;
  /**
   * Kênh báo lỗi ra ngoài (D93 — xem `server/bao_loi.ts`). Vắng ⇒ `KENH_IM`
   * (console.error như trước). Điểm vào prod tiêm kênh Sentry; test tiêm kênh giả.
   */
  baoLoi?: KenhBaoLoi | undefined;
  /**
   * Đọc bản phát hành của gói web ở biên (`server/canh.ts` `taoDocBanWeb`). Vắng ⇒ `/canh` bỏ qua phép so bản
   * (dev, test không cấu hình). Điểm vào prod tiêm theo `ALLOWED_ORIGIN`.
   */
  docBanWeb?: (() => Promise<string | null>) | undefined;
  /**
   * Lưới trần ngày của suất trận (SPEC tran-tran-ngay, `server/suat_tran.ts` `tranNgayHieuLuc`). Vắng ⇒ `SUAT_TRAN.TRAN_NGAY_SERVER`
   * ở mọi nơi TRỪ vitest (tắt — bộ test cũ tạo > 48 trận một DB); `null` ⇒ tắt; số ⇒ trần đó. Bài đo lưới tiêm số tường minh.
   */
  tranNgaySuat?: number | null | undefined;
}

import type { Env, Mw } from './http/types.js';
import { requireSecret } from './http/cua_secret.js';

// ---------------------------------------------------------------------------
// Tiện ích kiểm tra dữ liệu vào (server-side, mọi trường — GĐ6 VIỆC 4)
// ---------------------------------------------------------------------------

class BadInput extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
  }
}

function str(body: unknown, field: string, opts: { min?: number; max?: number } = {}): string {
  const v = (body as Record<string, unknown> | null)?.[field];
  if (typeof v !== 'string') throw new BadInput(field, `Thiếu trường ${field}.`);
  const t = v.trim();
  if (opts.min !== undefined && t.length < opts.min) {
    throw new BadInput(field, `Trường ${field} quá ngắn (tối thiểu ${opts.min} ký tự).`);
  }
  if (opts.max !== undefined && t.length > opts.max) {
    throw new BadInput(field, `Trường ${field} quá dài (tối đa ${opts.max} ký tự).`);
  }
  return t;
}

function oneOf<T extends string>(body: unknown, field: string, allowed: readonly T[]): T {
  const v = str(body, field);
  if (!(allowed as readonly string[]).includes(v)) {
    throw new BadInput(field, `Giá trị ${field} không hợp lệ.`);
  }
  return v as T;
}

function bool(body: unknown, field: string): boolean {
  const v = (body as Record<string, unknown> | null)?.[field];
  if (typeof v !== 'boolean') throw new BadInput(field, `Trường ${field} phải là true/false.`);
  return v;
}

function int(body: unknown, field: string): number {
  const v = (body as Record<string, unknown> | null)?.[field];
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    throw new BadInput(field, `Trường ${field} phải là số nguyên.`);
  }
  return n;
}

function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new BadInput('email', 'Email không hợp lệ.');
  }
  return email;
}

function validatePassword(p: string): void {
  if (p.length < AUTH.PASSWORD_MIN_LENGTH) {
    throw new BadInput('password', `Mật khẩu phải từ ${AUTH.PASSWORD_MIN_LENGTH} ký tự trở lên.`);
  }
  if (p.length > AUTH.PASSWORD_MAX_LENGTH) {
    throw new BadInput('password', 'Mật khẩu quá dài.');
  }
}

function validateHandle(h: string): void {
  if (!AUTH.HANDLE_PATTERN.test(h)) {
    throw new BadInput('handle', 'Tên hiển thị chỉ gồm a–z, 0–9, gạch dưới; dài 3–20 ký tự.');
  }
  if (handleBlockReason(h) !== null) {
    // Không nói LÝ DO cụ thể: nói ra là chỉ luôn cách lách.
    throw new BadInput('handle', 'Tên hiển thị không được phép. Bạn chọn tên khác nhé.');
  }
}

/**
 * IP thật của client — nền tảng của rate limit đăng ký theo IP.
 *
 * BẪY ĐÃ DÍNH TRÊN PROD (19/07/2026): frontend là Cloudflare Worker proxy sang
 * Vercel. Vercel GHI ĐÈ `x-forwarded-for` bằng IP của bên kết nối tới nó — tức
 * IP edge Cloudflare, KHÔNG phải IP người dùng. Hệ quả: mọi user chung một PoP
 * dùng chung một bucket → REGISTER_MAX_PER_IP=5/giờ khóa oan cả đám lúc beta.
 *
 * Cách chữa: worker gửi IP thật qua header riêng kèm secret dùng chung. CHỈ tin
 * header đó khi secret khớp — nếu không, ai gọi thẳng api.example.vercel.app cũng
 * giả được IP để né rate limit.
 */
function clientIpCoNguon(
  c: { req: { header: (n: string) => string | undefined } },
  proxySecret?: string | undefined,
): { ip: string; tinDuoc: boolean } {
  if (proxySecret) {
    const given = c.req.header('x-delphi-proxy-secret');
    const realIp = c.req.header('x-delphi-client-ip');
    if (given && realIp && safeEqual(given, proxySecret)) {
      return { ip: realIp.trim(), tinDuoc: true };
    }
  }
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) return { ip: fwd.split(',')[0]!.trim(), tinDuoc: false };
  return { ip: c.req.header('x-real-ip') ?? 'unknown', tinDuoc: false };
}

/** Request mang đúng secret dùng chung với Worker — tức đi qua cửa trước (B1). So hằng thời gian. */
function coBiMatProxy(
  c: { req: { header: (n: string) => string | undefined } },
  proxySecret: string,
): boolean {
  const given = c.req.header('x-delphi-proxy-secret');
  return !!given && safeEqual(given, proxySecret);
}

/** Log "cổng proxy mở" MỘT LẦN mỗi tiến trình — mỗi `createApp` của bộ test không được đẻ một dòng. */
let daBaoCongMo = false;

function clientIp(
  c: { req: { header: (n: string) => string | undefined } },
  proxySecret?: string | undefined,
): string {
  return clientIpCoNguon(c, proxySecret).ip;
}

/**
 * HẠN MỨC THEO IP, CÓ TRẦN CHUNG CHO LUỒNG KHÔNG XÁC THỰC ĐƯỢC.
 *
 * ⚠⚠ VÌ SAO CẦN VẾ THỨ HAI. `clientIpCoNguon` trả về HAI thứ — `ip` và
 * `tinDuoc` — nhưng năm chỗ khoá rate limit chỉ lấy `ip` rồi vứt `tinDuoc`. Khi
 * request không đi qua proxy tin cậy, `ip` rơi về `x-forwarded-for`, tức MỘT
 * HEADER NGƯỜI GỌI TỰ ĐẶT. **Tự chọn được khoá bucket nghĩa là tự miễn trừ rate
 * limit**: mỗi request một IP mới là một hạn mức mới.
 * Đo bằng đồ thật (`tests/rate_limit_ip_gia.test.ts`): 15/15 tài khoản khách
 * được tạo bằng cách xoay IP tự khai, trong khi trần là 5.
 *
 * ⚠ TRÊN VERCEL CHUYỆN NÀY HIỆN BỊ CHẶN BỞI NỀN TẢNG, KHÔNG PHẢI BỞI CODE TA:
 * Vercel ghi đè `x-forwarded-for` bằng IP bên kết nối (chính sự cố 18/07 dạy
 * điều đó). Nên đây không phải lỗ đang chảy máu. Nhưng nó nghĩa là một phép kiểm
 * an toàn đang tựa vào hành vi KHÔNG NẰM TRONG HỢP ĐỒNG của nhà cung cấp — đổi
 * hosting hay đổi cách Vercel xử header là nó mở IM LẶNG, đúng thứ A8.9 gọi là
 * khoá nhà cung cấp ở tầng nghiệp vụ. Ta tự đứng được thì tự đứng.
 *
 * ⚠ VÌ SAO KHÔNG NHỐT HẾT LUỒNG KHÔNG-TIN VÀO MỘT XÔ (và đây là phần đáng cân
 * nhất): làm thế thì hôm nào `PROXY_SHARED_SECRET` lệch giữa Worker và API, MỌI
 * người thật hoá không-tin và cùng chen một hạn mức ⇒ cửa đăng ký đóng với cả
 * thế giới. Nên giữ CẢ HAI vế: vẫn hạn mức theo IP (chặn một người bấm nhiều),
 * CỘNG một trần chung cho toàn bộ luồng không-tin (chặn một người xoay IP). Kẻ
 * xoay IP đụng vế hai; người thật khi proxy hỏng vẫn còn một cửa hẹp mà đi, và
 * `/health` khai `tin_duoc_ip` để biết vì sao hẹp — từ D444 khoá này nằm ở
 * phần CHI TIẾT, đọc bằng `curl -H "x-tick-secret: …" .../api/v1/health`.
 */
async function tieuHanMucIp(
  pool: pg.Pool, c: any, proxySecret: string | undefined,
  tienTo: string, tran: number, cuaSoPhut: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const { ip, tinDuoc } = clientIpCoNguon(c, proxySecret);
  const theoIp = await consumeLimit(pool, `${tienTo}:ip:${ip}`, tran, cuaSoPhut);
  if (!theoIp.allowed) return theoIp;
  // Chỉ dựng trần chung khi CÓ secret — không có secret thì không tồn tại khái
  // niệm "đáng tin", và nhốt cả dev/local vào một xô là phá đường chạy thật.
  if (tinDuoc || !proxySecret) return theoIp;
  return consumeLimit(pool, `${tienTo}:khong-tin`, tran * AUTH.KHONG_TIN_HE_SO, cuaSoPhut);
}

/**
 * Allowlist IP cho cửa admin (§3.3). Đọc từ biến môi trường mỗi lần gọi —
 * không cache, để đổi biến trên Vercel là có hiệu lực ngay lần deploy sau mà
 * không cần nhớ có một chỗ nào đó đang giữ bản cũ.
 */
function danhSachIpAdmin(): string[] {
  return (process.env[AUTH.ADMIN.BIEN_ALLOWLIST] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * CORS FAIL-CLOSED — vá 03/08 (đợt kiểm 02/08 bắt được).
 *
 * ⚠ Bản cũ là `deps.allowedOrigin ?? '*'`, tức QUÊN đặt biến môi trường thì hệ
 * thống tự mở toang, và mở toang ĐI KÈM `credentials: true` — nghĩa là mọi
 * trang web bất kỳ có thể gọi API kèm cookie phiên của người dùng và ĐỌC được
 * trả lời. Cấu hình thiếu phải làm hệ thống CHẶT hơn, không phải lỏng hơn;
 * một mặc định mở là lỗ hổng chờ một lần deploy đãng trí.
 *
 * Không mở là AN TOÀN ở đây, không phải đánh đổi: web prod gọi API qua proxy
 * cùng gốc của Worker (D18), mà request cùng gốc thì trình duyệt không bật
 * CORS. Nên đường chạy thật KHÔNG cần header này. Vắng biến ⇒ không phát
 * `Access-Control-Allow-Origin` (trả `null` để Hono bỏ hẳn header) ⇒ trang lạ
 * không đọc được gì, còn app vẫn chạy y nguyên.
 *
 * Nhận danh sách ngăn bằng dấu phẩy để dev/staging cùng khai một biến.
 */
export function chonOrigin(cauHinh: string | undefined): (o: string) => string | null {
  const cho = (cauHinh ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return (o: string): string | null => (cho.includes(o) ? o : null);
}

// ---------------------------------------------------------------------------

export function createApp(deps: AppDeps): Hono<Env> {
  const app = new Hono<Env>();
  const { pool, mailer } = deps;
  const kenhBaoLoi: KenhBaoLoi = deps.baoLoi ?? KENH_IM;

  /*
   * ─── HEADER BẢO MẬT (thêm 11/08) ─────────────────────────────────────────
   *
   * Trước hôm nay repo KHÔNG có một header bảo mật nào ở bất kỳ đâu (grep toàn
   * dự án: 0 kết quả cho Content-Security-Policy lẫn X-Frame-Options).
   *
   * ⚠⚠ ĐẶT Ở ĐÂY LÀ ĐÚNG CHỖ CHO HONO, VÀ CHỈ CHO HONO. Vỏ SPA KHÔNG đi qua
   * file này — Cloudflare trả asset thẳng ở biên, không gọi worker
   * (`run_worker_first` = false, đã đo 25/07) ⇒ header cho SPA phải nằm ở
   * `web/public/_headers`. Ngược lại `/admin` thì KHÔNG phải asset tĩnh: worker
   * bắt riêng nó rồi proxy sang đây và trả Response nguyên si, nên header cho
   * `/admin` bắt buộc phải đặt ở Hono. Hai nơi, hai vai — đặt nhầm chỗ nào cũng
   * ra code chết mà trông như đã làm.
   *
   * ⚠ VÌ SAO KHÔNG DÙNG `X-Frame-Options`: nó không diễn đạt được allowlist, và
   * nếu ai đó "tiện tay" chép nó lên tầng SPA thì Discord Activity chết trắng
   * iframe. `frame-ancestors` làm đúng việc đó mà nói được cả trường hợp cho
   * phép — nên chỉ dùng một cơ chế, ở một chỗ.
   *
   * Response của Hono không bao giờ là tài liệu bị nhúng iframe trong luồng
   * Discord (thứ bị nhúng là vỏ SPA từ Cloudflare), nên `frame-ancestors 'none'`
   * ở đây không đụng gì tới Activity.
   *
   * ⚠ PERMISSIONS-POLICY (thêm 28/09, D444) — GIỐNG HỆT NỘI DUNG ở
   * `web/public/_headers` (đọc chú thích đầy đủ ở đó, kể cả danh sách PHẢI
   * CHỪA `web-share`/`clipboard-write`): hai nơi, hai vai, y hệt lý lẽ CSP ở
   * trên — `/admin` là HTML thật (nút "chọn"/"uỷ quyền" dùng click thường,
   * không đụng share/clipboard) nên tắt luôn sáu feature không dùng ở CẢ tầng
   * API lẫn tầng admin.
   */
  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    // HSTS: 180 ngày, KHÔNG `preload`, KHÔNG `includeSubDomains` — hai thứ đó là
    // cam kết khó rút lại (trình duyệt nhớ, và preload phải xin gỡ khỏi danh
    // sách). Bản vừa đủ này vẫn lùi được bằng cách phát `max-age=0`.
    c.header('Strict-Transport-Security', 'max-age=15552000');
    c.header(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()',
    );
    if (!c.res.headers.has('Content-Security-Policy')) {
      // Mặc định cho response JSON: không tài nguyên nào, không nhúng được.
      c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    }
  });

  /*
   * ⚠⚠ TRẦN KÍCH CỠ BODY ĐÃ GỠ (12/08) — `hono/body-limit` LÀM TREO PROD.
   *
   * Bản đầu đặt `bodyLimit({ maxSize: 256 * 1024 })` ở đây. Nó CHẶN đúng (body
   * 300 KB trả 413 trên prod), nhưng nó cũng làm mọi route đi qua `consumeLimit`
   * treo tới hạn 10,4 giây của Vercel rồi 504: đăng nhập, tạo khách, quên mật
   * khẩu — tức CỬA VÀO của cả app.
   *
   * Bài học đắt hơn cái middleware: tôi nghiệm thu bản deploy trước bằng
   * `/health` (GET) và một route trả 401 — hai đường KHÔNG ĐỌC BODY và KHÔNG
   * xin kết nối qua `pool.connect()`. Cả hai xanh, và tôi kết luận "prod ổn".
   * Đo trên đường không đi qua chỗ hỏng thì không bao giờ thấy chỗ hỏng — đúng
   * bài học D78 đã ghi về radar, lặp lại nguyên vẹn.
   *
   * Trần độ dài vẫn còn ở TỪNG TRƯỜNG (`chuanHoaMua` và các chỗ khác), tức lỗ
   * MB-rác-vào-events đã bịt. Thứ mất là lớp phòng thủ chung; nó phải quay lại
   * bằng một cách KHÔNG đụng luồng body — đọc `content-length` rồi từ chối, chứ
   * không tiêu thụ stream. Làm ở phiên riêng, có đo bằng chính route đọc body.
   */

  /*
   * ─── CỔNG PROXY — B1 (SPEC va-bao-mat-chuan-hoa-api-dot-1, Q1 = A) ──────────
   *
   * Origin `api.example.vercel.app` là công khai: ai gọi thẳng nó là vòng qua cổng hàng chờ 300 + cache của Worker, và
   * mỗi `POST /auth/login` trần đốt một lượt argon2 ~100 ms trên quota Hobby (D444 cố ý giữ argon2 cho email lạ). Trước
   * bản vá `x-delphi-proxy-secret` chỉ gác IP · admin · canh — mọi route khác trả lời bất kỳ ai.
   * Nay: API có `PROXY_SHARED_SECRET` ⇒ `/api/*` thiếu/sai secret ⇒ 403 `khong_qua_cong`, TRƯỚC `cors` và mọi route
   * (không tiêu suất `auth_attempts`, không chạm DB).
   * Hai miễn trừ, mỗi cái một lý do:
   *   · `/api/v1/internal/*` — cron-job.org (tick) + Vercel cron (backup) gọi THẲNG Vercel, có secret riêng gác.
   *   · `/api/v1/health` — UptimeRobot/người kiểm; route tự cắt thân về hai trường và KHÔNG chạm DB khi gọi thẳng.
   * API KHÔNG có secret ⇒ mở như cũ + log một lần (dev/test; cùng lý lẽ fail-open của `cuaNgoaiAdmin` bên dưới: không
   * có secret thì máy chủ không có cách nào phân biệt Worker với người lạ — đóng là khoá tất cả). `/health` chi tiết
   * khai `proxy_secret_cau_hinh` + `admin_allowlist.tin_duoc_ip` để thấy trạng thái này TRƯỚC deploy (SPEC mục 5).
   */
  const congProxy = async (c: Context<Env>, next: () => Promise<void>) => {
    if (!deps.proxySecret) {
      if (!daBaoCongMo) {
        daBaoCongMo = true;
        console.warn('[DELPHI] CỔNG PROXY MỞ: API chưa có PROXY_SHARED_SECRET nên ai gọi thẳng origin cũng qua.');
      }
      await next();
      return undefined;
    }
    const duong = c.req.path;
    if (duong === '/api/v1/health' || duong.startsWith('/api/v1/internal/') || coBiMatProxy(c, deps.proxySecret)) {
      await next();
      return undefined;
    }
    return c.json({ error: 'khong_qua_cong', message: 'Hãy vào app qua địa chỉ chính thức.' }, 403);
  };
  app.use('/api/*', congProxy);

  /*
   * ─── TRẦN BODY TOÀN CỤC — B14 ─────────────────────────────────────────────
   * Đúng cách khối chú thích ngay trên đòi: CHỈ đọc `content-length` rồi từ chối, không bọc/tiêu luồng body (nếp
   * `chanContentLength` của PFM). Thiếu header (chunked, cron, curl không thân) ⇒ qua — trần riêng từng trường vẫn đứng.
   * Đo trên ĐƯỜNG ĐỌC BODY + `consumeLimit` (`tests/tran_body.test.ts`, máy chủ HTTP thật), không phải `/health`.
   */
  const tranBody = async (c: Context<Env>, next: () => Promise<void>) => {
    const cl = c.req.header('content-length');
    if (cl !== undefined && Number(cl) > AUTH.THAN_TOI_DA_BYTE) {
      return c.json({ error: 'body_qua_lon', message: `Thân request vượt trần ${AUTH.THAN_TOI_DA_BYTE} byte.` }, 413);
    }
    await next();
    return undefined;
  };
  app.use('/api/*', tranBody);

  app.use('/api/*', cors({
    origin: chonOrigin(deps.allowedOrigin),
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    // `authorization` cho cửa Discord (phiên đi bằng Bearer, xem `docTokenPhien`).
    // Trong Activity thì request thật ra là SAME-ORIGIN nên không có preflight và
    // dòng này không được dùng tới — để đây cho trường hợp KHÔNG same-origin, vì
    // thiếu nó thì hỏng ở dạng khó tra nhất: preflight chặn, không log gì ở app.
    allowHeaders: ['content-type', 'authorization'],
    /*
     * ⚠ `GET /pfm/luu` trả `ver` của lát trong HEADER, và trình duyệt **không cho JS
     * đọc header nào không được phơi ra** khi khác origin — không báo lỗi, chỉ trả
     * `null`. Lúc đó máy vừa khôi phục cầm `ver = 0` và cú sao lưu đầu tiên chắc chắn
     * 409 — đúng cái `ket_chay.ts` dựng `nhanDau` ra để tránh. Cùng lý lẽ với
     * `allowHeaders` ở trên: hôm nay same-origin nên không dùng tới, nhưng thiếu nó thì
     * hỏng ở dạng khó tra nhất.
     */
    exposeHeaders: ['X-Pfm-Ver', 'X-Pfm-Schema-V'],
    credentials: true,
  }));

  /*
   * ─── B7 — CHẶN GHI CHÉO TRANG (SPEC va-bao-mat-chuan-hoa-api-dot-1) ──────────
   *
   * Trước bản này chống CSRF chỉ có cookie `SameSite=Lax` — MỘT lớp: trình duyệt cũ, hoặc ngày cookie phải nới `SameSite=None`
   * cho iframe, là trang lạ POST được kèm phiên. Lớp hai, đọc header TRÌNH DUYỆT tự đặt (JS trang lạ không giả được):
   *   · `Sec-Fetch-Site: cross-site` ⇒ chặn;
   *   · có `Origin` mà không thuộc danh sách ⇒ chặn. Danh sách = `ALLOWED_ORIGIN` (cùng nguồn CORS) + gốc của `APP_BASE_URL`
   *     (trang web của chính app — Worker proxy same-origin nên `Origin` là gốc Worker) + Activity Discord của ĐÚNG client id.
   * Không có cả hai header (cron-job.org · curl · script) ⇒ qua: CSRF cần trình duyệt, và trình duyệt luôn gửi ít nhất một.
   * Chỉ method ghi; đặt TRƯỚC mọi route nên lượt bị chặn không tiêu suất đăng nhập, không chạy argon2.
   * ⚠ Trước deploy: `ALLOWED_ORIGIN` hoặc `APP_BASE_URL` trên Vercel phải là gốc Worker, không thì POST thật bị chặn.
   */
  const originDuocGhi = chonOrigin([
    deps.allowedOrigin ?? '',
    (() => { try { return new URL(deps.appBaseUrl).origin; } catch { return ''; } })(),
    deps.discordClientId ? `https://${deps.discordClientId}.discordsays.com` : '',
  ].join(','));
  const chanGhiCheoTrang: Mw = async (c, next) => {
    const m = c.req.method;
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
      const origin = c.req.header('origin');
      if (c.req.header('sec-fetch-site') === 'cross-site' || (origin !== undefined && originDuocGhi(origin) === null)) {
        return c.json({ error: 'origin_la', message: 'Yêu cầu đến từ trang khác — bị từ chối.' }, 403);
      }
    }
    await next();
  };
  app.use('/api/*', chanGhiCheoTrang);

  /*
   * ─── CỬA NGOÀI CỦA KHU ADMIN — allowlist IP + rate limit (§3.3, §3.4) ────
   *
   * Đặt Ở ĐÂY, TRƯỚC MỌI ROUTE, và theo TIỀN TỐ. Hono chạy middleware theo thứ
   * tự đăng ký, nên đăng ký sau route là không chạy cho route đó — mà quan
   * trọng hơn: quấn theo tiền tố nghĩa là một route admin THÊM SAU NÀY cũng tự
   * động được che, kể cả khi người thêm nó quên mọi thứ trong file này.
   * Phủ cả `/admin` (trang HTML) lẫn `/api/v1/admin/*`.
   *
   * ⚠ Trước 03/08 route admin KHÔNG CÓ RATE LIMIT NÀO (§0.3).
   */
  const cuaNgoaiAdmin: Mw = async (c, next) => {
    const { ip, tinDuoc } = clientIpCoNguon(c, deps.proxySecret);
    const ds = danhSachIpAdmin();

    if (ds.length > 0) {
      if (!tinDuoc && !deps.proxySecret) {
        /*
         * ⚠ API KHÔNG ĐƯỢC CẤU HÌNH `PROXY_SHARED_SECRET` ⇒ `tinDuoc` VĨNH VIỄN
         * false ⇒ đóng cửa ở đây là khoá 100% mọi người, kể cả founder đi đúng
         * cửa trước, và không có request hợp lệ nào cứu được.
         *
         * Đây là chỗ fail-OPEN vẫn đúng: không phải vì ta chấp nhận rủi ro, mà
         * vì trong cấu hình này máy chủ KHÔNG CÓ CÁCH NÀO phân biệt ai với ai —
         * đóng cửa thì cũng không chặn đúng người, chỉ chặn tất cả. Kêu to và đi
         * tiếp; `/health` khai `proxy_secret_cau_hinh` để chuyện này thấy được
         * TRƯỚC khi founder bật allowlist — từ D444 khoá này nằm ở phần CHI
         * TIẾT, đọc bằng `curl -H "x-tick-secret: …" .../api/v1/health`.
         */
        console.error(
          '[DELPHI] ALLOWLIST ADMIN VÔ HIỆU: API chưa có PROXY_SHARED_SECRET nên '
          + 'không bao giờ xác thực được IP. Đặt biến đó rồi deploy lại.',
        );
        /*
         * ⚠ PHẢI THOÁT HẲN, KHÔNG ĐƯỢC RƠI XUỐNG PHÉP SO IP BÊN DƯỚI.
         * Bản đầu của bản vá này chỉ ghi log rồi đi tiếp — và đi tiếp nghĩa là
         * so `ip` (thứ vừa tuyên bố là KHÔNG đáng tin) với allowlist, nên vẫn
         * 403. Tức "fail-open" trên giấy mà fail-closed trong máy. Bài test
         * `API KHÔNG có PROXY_SHARED_SECRET` bắt được đúng chỗ này.
         */
        await next();
        return undefined;
      }
      if (!tinDuoc) {
        /*
         * ⚠⚠ SỬA 11/08 — FAIL-OPEN Ở ĐÂY LÀ MỘT CỬA SAU, KHÔNG PHẢI MỘT ĐÁNH ĐỔI.
         *
         * Bản cũ ghi log rồi CHO ĐI TIẾP, với lý do "PROXY_SHARED_SECRET có thể
         * lệch, khoá nhầm founder còn tệ hơn". Lý do ấy đúng cho một sự cố cấu
         * hình — nhưng nó bỏ sót ai KHÁC rơi vào đúng nhánh này: **kẻ gọi thẳng
         * `api.example.vercel.app` không bao giờ mang secret**, nên họ LUÔN LUÔN
         * `tinDuoc === false` và LUÔN LUÔN được cho qua.
         * ⇒ Allowlist chỉ chặn được người đi đúng cửa trước. Nó không bảo vệ ai
         * cả, mà lại tạo đúng cảm giác đang được bảo vệ — thứ nguy hiểm hơn là
         * không có allowlist, vì người ta sẽ dựa vào nó.
         *
         * Nay: allowlist đã bật ⇒ request KHÔNG chứng minh được đi qua cửa trước
         * thì TỪ CHỐI. Đây không phải câu hỏi về IP nữa mà là câu hỏi "có đi qua
         * cửa trước không" — và cửa sau thì phải đóng, không phải ghi log.
         *
         * ⚠ RỦI RO KHOÁ NHẦM ĐÃ CÂN, và nó nhỏ hơn nhiều so với vẻ ngoài:
         *   · Worker CÓ chuyển tiếp cả `/admin` kèm secret (web/worker/index.js)
         *     nên đường đăng nhập thật không đổi một bước nào.
         *   · ⚠⚠ **LÝ LẼ ĐẦU CỦA TÔI VỀ C3 SAI, GIỮ LẠI ĐÍNH CHÍNH ĐỂ KHÔNG AI
         *     DỰA VÀO NÓ:** tôi từng viết "scheduler không nằm dưới /admin nên
         *     kèo vẫn resolve đúng giờ". Sai ở đúng điểm chịu lực. `scheduler.ts`
         *     chỉ KHOÁ kèo và TỰ HUỶ kèo quá `RESOLUTION_TIMEOUT` (7 ngày, A4);
         *     việc TRẢ THƯỞNG nằm ở `POST /admin/markets/:id/resolve` — tức SAU
         *     đúng cánh cửa này. Khoá admin quá 7 ngày ⇒ kèo lần lượt tự huỷ và
         *     hoàn 100% thay vì trả đúng kết quả, trên sổ append-only nên KHÔNG
         *     hoàn tác được (A3.3).
         *     ⇒ Rủi ro khoá nhầm là RỦI RO TIỀN THẬT, không phải bất tiện. Nó
         *     được chấp nhận ở đây CHỈ vì hai điều kiện đo được: (a) nhánh này
         *     chỉ chạy khi API có secret, tức luôn tồn tại một đường vào hợp lệ;
         *     (b) prod đã đo `tin_duoc_ip: true` qua Worker ngày 11/08, tức
         *     đường đó đang sống thật. Mất một trong hai ⇒ phải xét lại.
         *   · Đường phục hồi là sửa biến môi trường — thứ founder vốn đã có
         *     (cùng nếp D61: đường thoát dùng quyền đã có, không đẻ bí mật mới).
         *   · Prod hôm nay allowlist RỖNG (đo `/health`: bat=false — từ D444
         *     đọc số này cần header `x-tick-secret`, xem route health) ⇒ nhánh
         *     này không chạy, tức đổi này KHÔNG đổi hành vi hôm nay. Nó chỉ
         *     làm cho cái công tắc trở nên THẬT vào ngày founder bật lên.
         */
        console.error(
          '[DELPHI] TỪ CHỐI ADMIN: allowlist đang bật nhưng request không đi qua '
          + 'proxy tin cậy (PROXY_SHARED_SECRET lệch giữa Worker và API, hoặc có '
          + 'người gọi thẳng origin API).',
        );
        return c.json({ error: 'forbidden', message: 'Không truy cập được từ mạng này.' }, 403);
      }
      if (!ds.includes(ip)) {
        return c.json({ error: 'forbidden', message: 'Không truy cập được từ mạng này.' }, 403);
      }
    }

    const kq = await consumeLimit(pool, `admin:ip:${ip}`, AUTH.ADMIN.MAX_MOI_PHUT, 1);
    if (!kq.allowed) {
      return c.json({ error: 'rate_limited', message: 'Quá nhiều yêu cầu. Thử lại sau.' }, 429);
    }
    await next();
  };
  app.use('/api/v1/admin/*', cuaNgoaiAdmin);
  app.use('/admin', cuaNgoaiAdmin);
  app.use('/admin/*', cuaNgoaiAdmin);

  /**
   * CHỐT CUỐI CỦA MỌI LỖI KHÔNG AI BẮT (D93). Đây là nơi duy nhất mà "server
   * sập" thành một sự kiện có địa chỉ: mọi route — kể cả tick và backup — rơi
   * xuống đây khi ném. Trước D93 nó chỉ `console.error` ⇒ Vercel logs ⇒ không ai
   * được báo. Nay đẩy sang `deps.baoLoi` với `noi = METHOD + đường`, và PHẢI
   * `await xa()` TRƯỚC khi trả lời — serverless đóng băng process ngay sau
   * response, event chưa xả là event mất.
   *
   * `BadInput` là 400 do người dùng, không phải sự cố — không báo (báo là ngập
   * chuông bằng thứ hoạt động đúng, cùng lý lẽ với 401 ở client `baoLoiApi`).
   */
  app.onError(async (err, c) => {
    if (err instanceof BadInput) {
      return c.json({ error: 'invalid_input', field: err.field, message: err.message }, 400);
    }
    /*
     * VAN QUÁ TẢI (D274) — ĐO ĐƯỢC, không phải phòng xa. Chạm trần 200 client
     * của pooler thì `pg` ném `EMAXCONN` và nhánh dưới trả 500: một lời NÓI DỐI
     * với client, vì nó bảo "máy chủ hỏng" trong khi sự thật là "đang đủ tải,
     * quay lại sau". 503 + `Retry-After` là câu đúng, và là câu DUY NHẤT mà mọi
     * lớp thử-lại phía trên (trình duyệt, TanStack Query, worker) hiểu được.
     *
     * ⚠ Đặt TRƯỚC nhánh báo lỗi chung là cố ý: đợt tràn đẻ hàng trăm lỗi giống
     * hệt trong vài giây, xả hết vào Sentry là tắt chuông đúng lúc cần nó nhất
     * (5.000 sự kiện/tháng). `nenBaoHetKetNoi` bóp còn một lần mỗi phút mỗi
     * instance — ta cần BIẾT CÓ, không cần đếm đủ.
     *
     * ⚠ Van này KHÔNG thay cổng hàng chờ ở `web/worker/`: cổng chặn TRƯỚC khi
     * chạm DB, van chỉ trả lời cho tử tế khi đã chạm. Hai lớp, hai vai.
     */
    if (laHetKetNoi(err)) {
      if (nenBaoHetKetNoi()) {
        kenhBaoLoi.bao(err, { noi: `${c.req.method} ${c.req.path}`, nhan: { qua_tai: true } });
        await kenhBaoLoi.xa();
      }
      const giay = giaySauThuLai();
      c.header('Retry-After', String(giay));
      return c.json({
        error: 'qua_tai',
        message: 'Máy chủ đang đông. Thử lại sau vài giây nhé.',
        thu_lai_sau_giay: giay,
      }, 503);
    }
    kenhBaoLoi.bao(err, {
      noi: `${c.req.method} ${c.req.path}`,
      nhan: { user: (c.get('actor') as SessionActor | undefined)?.userId ?? null },
    });
    await kenhBaoLoi.xa();
    return c.json({ error: 'internal', message: 'Có lỗi phía máy chủ. Thử lại sau nhé.' }, 500);
  });

  /*
   * `docTokenPhien` ĐÃ DỜI SANG `auth/session.ts` (11/08) — xem docstring đầy đủ
   * ở đó. Nó từng là closure trong hàm này, và vì vậy ba chỗ NGOÀI file này
   * không với tới được nên đã tự chép lại bằng `getCookie(...)` — rồi cả ba hỏng
   * im lặng với phiên Bearer của Discord. Bản sao thứ hai luôn là bản sẽ trôi (D61).
   */

  /** Middleware: bắt buộc đăng nhập. */
  const requireAuth: Mw = async (c, next) => {
    const raw = docTokenPhien(c);
    if (!raw) return c.json({ error: 'unauthorized', message: 'Bạn cần đăng nhập.' }, 401);
    const actor = await resolveSession(pool, raw);
    if (!actor) {
      deleteCookie(c, AUTH.SESSION_COOKIE, { path: '/' });
      return c.json({ error: 'unauthorized', message: 'Phiên đã hết hạn. Đăng nhập lại nhé.' }, 401);
    }
    c.set('actor', actor);
    /*
     * SUẤT TRẬN (SPEC tran-tran-ngay) — báo cổng Worker "phiên này miễn suất". Worker không giải được token phiên
     * (DB mới giải), nên server nói qua header; Worker đổi thành vé ký gắn với phiên rồi bóc header đi
     * (`web/worker/index.js`). Đặt ở đây vì mọi route đã xác thực đều qua cửa này — admin mở app là có vé.
     */
    if (mienSuat(actor)) c.header('x-dp-mien-suat', '1');
    await next();
  };

  /**
   * Middleware: gắn `actor` NẾU có phiên, không chặn ai.
   *
   * Chỉ dùng cho đo lường vận hành (A9): phễu đăng ký và màn hướng dẫn xảy ra
   * TRƯỚC khi có tài khoản, nên đòi đăng nhập ở đó là tự bịt mắt đúng chỗ cần
   * nhìn nhất — "bỏ ở bước nào" chỉ trả lời được nếu người bỏ cuộc cũng ghi
   * được. Khách chưa đăng nhập ⇒ `user_id` NULL, và bù lại họ bị siết theo IP.
   *
   * ⚠ KHÔNG dùng cửa này cho bất cứ thứ gì đọc/ghi nghiệp vụ.
   */
  const optionalAuth: Mw = async (c, next) => {
    const raw = docTokenPhien(c);
    if (raw) {
      const actor = await resolveSession(pool, raw);
      if (actor) c.set('actor', actor);
    }
    await next();
  };

  /**
   * Middleware: có hồ sơ `users` — KHÔNG đòi tuổi. Chỉ cho các cửa mà người CHƯA qua cổng tuổi phải với tới được để qua nó:
   * `POST /me/tuoi` (B5) · `POST /me/nhan-khau` (khai năm sinh ở đó cũng là qua cổng). Mọi cửa khác dùng `requireOnboarded`.
   */
  const requireHoSo: Mw = async (c, next) => {
    if (!c.get('actor').userId) {
      return c.json({ error: 'not_onboarded', message: 'Bạn cần hoàn tất đăng ký hồ sơ trước.' }, 403);
    }
    await next();
  };

  /**
   * Middleware: bắt buộc đã onboarding xong (có hồ sơ users) VÀ đã qua cổng tuổi.
   *
   * B5 (SPEC va-bao-mat-chuan-hoa-api-dot-1, C8) — trước bản này age gate 16+ chỉ ở `POST /auth/register`: khách và Discord vào chơi
   * không bị hỏi tuổi, nên "16+" chỉ đúng với một trong ba đường vào. Đặt ở middleware chung chứ không ở `/holdem/matches`: mọi
   * cửa nghiệp vụ đã đi qua đây, cửa thêm sau tự được che (cùng lý lẽ `chanKhach`). Ngưỡng `ECONOMY.AGE_GATE_MIN` — chỉ nâng (C8).
   */
  const requireOnboarded: Mw = async (c, next) => {
    const actor = c.get('actor');
    if (!actor.userId) {
      return c.json({ error: 'not_onboarded', message: 'Bạn cần hoàn tất đăng ký hồ sơ trước.' }, 403);
    }
    if (!actor.tuoiDaXacNhan) {
      return c.json({ error: 'chua_xac_nhan_tuoi', message: 'Cho mình biết năm sinh của bạn trước khi chơi nhé.' }, 403);
    }
    await next();
  };

  /**
   * ⚠⚠ CỔNG CHUNG CHO MỌI CỬA CHI KHO BẠC — đặt Ở TẦNG MIDDLEWARE, có chủ ý.
   *
   * 11/08 đã vá cửa `/subsidy/claim` bằng một câu `if (actor.laKhach)` ngay
   * trong handler. Đó là vá ĐÚNG MỘT CỬA, và hôm sau đợt săn tìm ra cửa THỨ HAI
   * còn nguyên: `/me/qua-beta/nhan` chi 500 T mỗi lượt — gấp mười lần trợ cấp —
   * cho bất kỳ ai gọi được một cú POST tạo khách (không email, không mật khẩu,
   * không age gate).
   *
   * Bài học là về CHỖ ĐẶT chứ không về cái `if`: mỗi cửa mới sẽ lại quên, vì
   * người thêm cửa đang nghĩ về tính năng của họ chứ không nghĩ về Kho bạc.
   * Middleware thì người thêm route phải CỐ Ý bỏ nó ra mới lọt, và
   * `tests/kho_bac_chan_khach.test.ts` bắt buộc mọi file có đường chi Kho bạc
   * phải khai tên trong danh sách đã gác.
   *
   * VÌ SAO KHÁCH KHÔNG ĐƯỢC ĐỘNG VÀO KHO BẠC: nó là quỹ MỘT LẦN (genesis
   * 20.000 T, khoá bằng unique index — A3.4), có `CHECK balance_after >= 0` ở
   * tầng DB, nên cạn là mọi khoản chi FAIL CỨNG: trợ cấp của người thật, seed
   * thanh khoản khi mở kèo, quà tri ân. Không đúc lại được. Một tài khoản tạo
   * bằng một dòng curl không được phép rút từ cái quỹ đó.
   */
  const chanKhach: Mw = async (c, next) => {
    const actor = c.get('actor') as SessionActor;
    if (actor.laKhach) {
      return c.json({
        error: 'khach_khong_duoc',
        message: 'Phần này dành cho tài khoản đã đăng ký. Tạo tài khoản để nhận nhé.',
      }, 403);
    }
    await next();
  };

  /**
   * ─── GUARD CHO TRANG HTML (khác guard cho API) ─────────────────────────
   *
   * `requireAuth` trả JSON 401 — đúng cho endpoint JSON, SAI cho trang người
   * dùng mở bằng trình duyệt: gõ URL khi chưa đăng nhập thì nhận nguyên cục
   * `{"error":"unauthorized"}` giữa màn hình, không có lối đi tiếp.
   *
   * Trang HTML phải CHUYỂN HƯỚNG về màn đăng nhập của SPA. Kèm `?next=` để
   * frontend quay lại đúng trang sau khi đăng nhập — SPA chưa đọc tham số này
   * thì cũng vô hại, và sẵn sàng khi frontend làm.
   *
   * Đã đăng nhập rồi (cookie phiên còn hạn, trình duyệt nhớ) → vào thẳng, đúng
   * hành vi mong đợi.
   */
  const trangDangNhap = (c: any) =>
    c.redirect(`/onboard?next=${encodeURIComponent(c.req.path)}`, 302);

  const requireAuthPage: Mw = async (c, next) => {
    const raw = getCookie(c, AUTH.SESSION_COOKIE);
    if (!raw) return trangDangNhap(c);
    const actor = await resolveSession(pool, raw);
    if (!actor) {
      deleteCookie(c, AUTH.SESSION_COOKIE, { path: '/' });
      return trangDangNhap(c);
    }
    c.set('actor', actor);
    await next();
  };

  /** Chưa hoàn tất hồ sơ → đẩy sang bước tạo hồ sơ, không trả JSON. */
  const requireOnboardedPage: Mw = async (c, next) => {
    const actor = c.get('actor') as SessionActor;
    if (!actor.userId) return c.redirect('/onboard/ho-so', 302);
    await next();
  };

  /*
   * ─── BA BẬC CỬA ADMIN (0025 · bản yêu cầu 01 §3) ───────────────────────
   *
   * Trước 03/08 chỉ có MỘT bậc: `role === 'admin'`. Nay ba, và `requireAdmin`
   * — cái tiêm vào MỌI route admin — nay đòi cả TOTP lẫn hạn quyền.
   *
   * ⚠ ĐỔI Ở ĐÂY LÀ ĐỔI CHO CẢ 11 ROUTE ADMIN CÙNG LÚC, gồm cả hai route trong
   * `avatar.ts` mà bản yêu cầu §3.4 không liệt kê. Đó là chủ đích: siết bằng
   * cách đổi THỨ ĐƯỢC TIÊM VÀO, không đi gắn tay từng route — gắn tay thì chắc
   * chắn sót, và cái sót sẽ là cái thêm sau này.
   */
  const cuaAdmin = dungCuaAdmin(pool);
  const { chiAdmin, requireAdmin, requireXacThucLai } = cuaAdmin;

  // =========================================================================
  // Hạ tầng (GĐ0)
  // =========================================================================

  /*
   * ĐO ĐỘ TRỄ `/rounds` — thứ nghẽn trước tiên khi đông người (replay + tx). Chỉ
   * ghi số, không đổi response. Middleware đứng TRƯỚC route nên bao cả lỗi.
   */
  app.use('/api/v1/holdem/matches/:id/rounds', async (c, next) => {
    const t0 = performance.now();
    try { await next(); } finally { ghiDoTreRounds(performance.now() - t0); }
  });

  /*
   * ═══════════════════════════════════════════════════════════════════════
   * D444 (28/09) — CÔNG KHAI CHỈ CÒN HAI KHOÁ; CHI TIẾT ĐÒI HEADER BÍ MẬT.
   *
   * Review bảo mật prod 28/09: route này TRƯỚC ĐÓ mở toàn bộ thân bên dưới
   * cho BẤT KỲ AI gọi, không đăng nhập, không secret. Từng khoá lộ một thứ:
   *   · `admin_allowlist.bat` — báo kẻ tấn công biết khu admin có đang mở cho
   *     MỌI IP hay không, tức có đáng thử vào thẳng hay không.
   *   · `tai.pool` — lúc nào pool DB cạn (`waiting > 0`), tức lúc nào một đợt
   *     dồn dập ăn đòn nặng nhất.
   *   · `heartbeats` / `scheduler_heartbeat_age_s` — scheduler có đang chết,
   *     tức lúc nào hệ thống mất người canh (kèo không tự khoá đúng giờ).
   *   · `proxy_secret_cau_hinh` / `admin_allowlist.tin_duoc_ip` — allowlist
   *     admin có THẬT SỰ có tác dụng hay chỉ là một ổ khoá trang trí.
   *   · `bao_loi.noi_ra_ngoai` — chuông Sentry có dây không, tức tấn công
   *     xong có ai biết không.
   *   · `db_ok`, `version` — bề mặt do thám nhỏ hơn nhưng vẫn không có lý do
   *     gì phải phát cho người lạ.
   * Không route/dịch vụ nào NGOÀI người vận hành cần các khoá này: UptimeRobot
   * chỉ cần mã HTTP; `web/src/api/mang.ts` (cảm biến mất mạng) chỉ cần "có trả
   * lời hay không", không đọc thân. Nên từ nay CÔNG KHAI CHỈ CÒN đúng hai khoá
   * `{status, ban_phat_hanh}` — đủ cho cả hai việc đó. CHI TIẾT (đủ mọi khoá
   * cũ, không đổi tên khoá) chỉ trả khi header `x-tick-secret` khớp
   * `deps.tickSecret` — so bằng `safeEqual` (hằng thời gian), Y HỆT route
   * `/api/v1/internal/tick` ngay dưới đây.
   *
   * ⚠ VÌ SAO `ban_phat_hanh` VẪN CÔNG KHAI: nó là bản NGƯỜI ĐỌC (D196), và
   * đúng khoá mà bước KIỂM SAU DEPLOY ở `docs/phat-hanh/mua-0.0.md` dùng để so
   * — so được CẢ đi thẳng lẫn qua Worker mà KHÔNG cần secret (cả hai đường đó
   * là trình duyệt/curl của người kiểm gọi, không phải máy-tới-máy, nên không
   * có chỗ nào giắt secret vào theo nếp cũ). Bắt secret ở khoá này là tự khoá
   * luôn bước kiểm đó. Và tự thân số bản phát hành không giúp gì kẻ tấn công:
   * nó không nói route nào mở, thư viện nào có lỗ, hay pool có đang cạn không.
   *
   * ⚠ VÌ SAO DÙNG LẠI `TICK_SECRET`, KHÔNG ĐẺ SECRET MỚI: founder đã có nó ở
   * CẢ HAI nơi cần (cron-job.org gọi `/internal/tick`, và biến môi trường
   * Vercel) — thêm một biến nữa là thêm một thứ phải nhớ đặt/không để lộ, mà
   * không mua thêm an toàn (gõ đúng `x-tick-secret` vốn dĩ đã là người vận
   * hành, không phải người lạ).
   *
   * Cách đọc chi tiết (thay đúng secret đang đặt trên Vercel):
   *   curl -H "x-tick-secret: …" https://api.example.vercel.app/api/v1/health
   *
   * ⚠ FAIL-CLOSED: `deps.tickSecret` không cấu hình ⇒ KHÔNG BAO GIỜ trả chi
   * tiết, bất kể header gửi gì (kể cả chuỗi rỗng) — cùng triết lý với
   * `chonOrigin` của CORS (dòng ~285 ở trên): thiếu cấu hình phải làm hệ
   * thống CHẶT hơn, không phải lỏng hơn.
   * ═══════════════════════════════════════════════════════════════════════
   */
  app.get('/api/v1/health', async (c) => {
    /*
     * B1 — GỌI THẲNG ORIGIN (không proxy secret, không `x-tick-secret`) ⇒ chỉ "còn sống", KHÔNG một truy vấn DB nào:
     * route này miễn cổng proxy (UptimeRobot), nên nó không được thành cửa đốt DB cho người lạ (trước bản vá: 2 truy vấn
     * mỗi lần gọi). Trạng thái thật (`db_ok`, heartbeat) đi qua Worker hoặc kèm `x-tick-secret`. API không có proxy
     * secret (dev/test) ⇒ như cũ.
     */
    if (deps.proxySecret && !coBiMatProxy(c, deps.proxySecret)) {
      const tick = c.req.header('x-tick-secret');
      if (!deps.tickSecret || !tick || !safeEqual(tick, deps.tickSecret)) {
        return c.json({ status: 'ok', ban_phat_hanh: BAN_PHAT_HANH });
      }
    }
    const body = {
      status: 'ok' as 'ok' | 'degraded',
      server_time_utc: new Date().toISOString(),
      version: API_VERSION,
      /*
       * ⚠ HAI SỐ, KHÔNG PHẢI MỘT — và đó là điểm của D196. `version` là bản MÁY
       * CHỦ (đổi khi API đổi); `ban_phat_hanh` là bản NGƯỜI ĐỌC (đổi khi có một
       * đợt đáng đọc lại). Trước D196 chỉ có số đầu, nên câu "prod đang chạy đợt
       * nào" không hỏi được ở đâu cả — phải đi đoán từ git.
       */
      ban_phat_hanh: BAN_PHAT_HANH,
      db_ok: false,
      scheduler_heartbeat_age_s: null as number | null,
      heartbeats: { pg_cron: null as number | null, tick: null as number | null },
      /*
       * Trạng thái allowlist admin (§3.3). Hiện ở đây vì "bật nhưng vô hiệu" là
       * thứ KHÔNG BAO GIỜ tự lộ ra: cửa vẫn mở, không ai báo lỗi, và ta chỉ
       * biết vào ngày cần nó thì nó đã không có tác dụng từ lâu.
       * Không in danh sách IP — chỉ in SỐ LƯỢNG (C7).
       */
      /*
       * Cấu hình CÓ hay KHÔNG — đây là thứ phải biết TRƯỚC khi bật allowlist,
       * vì thiếu nó thì allowlist không bao giờ xác thực được ai. Khác
       * `tin_duoc_ip` ở chỗ nó không xác nhận một giá trị secret nào.
       */
      proxy_secret_cau_hinh: Boolean(deps.proxySecret),
      /*
       * Kênh báo lỗi CÓ nối ra ngoài không (D93). Cùng lý lẽ với hai trường trên:
       * "chuông đã cắm dây" là thứ chỉ lộ ra vào ngày cần nó — mà lúc đó biết
       * thì đã muộn. Đặt SENTRY_DSN xong thì `curl -H "x-tick-secret: …" /health`
       * là kiểm được (từ D444, khoá này ở phần CHI TIẾT), không phải gây lỗi
       * thật trên prod để xem chuông có kêu.
       */
      bao_loi: { noi_ra_ngoai: kenhBaoLoi.noiRaNgoai },
      admin_allowlist: {
        bat: danhSachIpAdmin().length > 0,
        so_muc: danhSachIpAdmin().length,
        tin_duoc_ip: clientIpCoNguon(c, deps.proxySecret).tinDuoc,
      },
      /*
       * TẢI (D106 §6, bước 1 — chỉ ĐO): pool đang chờ/tổng + p95 `/rounds` 60 s.
       * Của MỘT instance serverless — xem `server/tai.ts`. Van chưa có.
       */
      tai: soLieuTai(pool as unknown as Parameters<typeof soLieuTai>[0]),
    };
    try {
      await pool.query('SELECT 1');
      body.db_ok = true;
      const { rows } = await pool.query(
        `SELECT source, extract(epoch FROM (now() - max(beat_at)))::int AS age
         FROM scheduler_heartbeat GROUP BY source`,
      );
      for (const row of rows) {
        if (row.source === 'pg_cron') body.heartbeats.pg_cron = Number(row.age);
        if (row.source === 'tick') body.heartbeats.tick = Number(row.age);
      }
      const { pg_cron, tick } = body.heartbeats;
      body.scheduler_heartbeat_age_s =
        pg_cron !== null && tick !== null ? Math.max(pg_cron, tick) : null;
    } catch (err) {
      console.error(err);
    }
    const healthy =
      body.db_ok &&
      body.scheduler_heartbeat_age_s !== null &&
      body.scheduler_heartbeat_age_s <= 180;
    if (!healthy) body.status = 'degraded';
    // D444 — gọn thân trừ khi header bí mật khớp (khối chú thích ở trên route).
    // Cùng phép so secret với `/api/v1/internal/tick` ngay dưới: `safeEqual` +
    // fail-closed khi `deps.tickSecret` chưa cấu hình.
    const given = c.req.header('x-tick-secret');
    const thieuQuyenChiTiet = !deps.tickSecret || !given || !safeEqual(given, deps.tickSecret);
    const traVe = thieuQuyenChiTiet ? { status: body.status, ban_phat_hanh: body.ban_phat_hanh } : body;
    /*
     * ⚠ THÂN CHI TIẾT KHÔNG ĐƯỢC NẰM TRONG BẤT KỲ CACHE NÀO. Worker cache `/health`
     * 30 giây theo URL — không theo header — nên một cú kiểm chi tiết đi qua Worker
     * sẽ bị cất rồi phát cho người lạ (bắt ở lượt rà D444, trước khi lên prod).
     * Hai lá chắn: Worker bỏ qua request mang `x-tick-secret` (`nenCache`), và ở đây
     * thân chi tiết tự khai `no-store` để Worker (`catDuocVaoCache`) cùng mọi tầng
     * cache khác không cất. Thân công khai giữ nguyên để Worker vẫn đỡ tải được.
     */
    if (!thieuQuyenChiTiet) c.header('Cache-Control', 'no-store');
    /*
     * ⚠ 500 Ở ĐÂY TỪNG KHÔNG BAO GIỜ TỚI SENTRY (đính chính 06/09, docs/gioi-han-ha-tang.md): lỗi DB bị `try/catch`
     * ở trên nuốt nên không rơi xuống `app.onError`. Báo thẳng ở đây, qua van 10 phút (`nenBaoCanh`) — UptimeRobot
     * gọi mỗi 5 phút, một giờ sập không được đẻ hàng chục sự kiện.
     */
    if (!healthy && nenBaoCanh('health')) {
      kenhBaoLoi.bao(new Error('health_degraded'), {
        noi: 'GET /api/v1/health',
        nhan: { db_ok: body.db_ok, heartbeat_age_s: body.scheduler_heartbeat_age_s },
      });
      await kenhBaoLoi.xa();
    }
    return c.json(traVe, healthy ? 200 : 500);
  });

  /*
   * ═══════════════════════════════════════════════════════════════════════
   * GET /api/v1/canh — kiểm canh đi ĐÚNG đường người chơi (server/canh.ts).
   *
   * ⚠ CỐ Ý KHÔNG nằm trong `MIEN_CONG` của Worker và KHÔNG ở `/internal/`: cron-job.org gọi nó qua Worker kèm
   * cookie `dp_pass`, tức đi qua `kiemVe()` — nhánh đã trả 500 cho mọi người hôm D293 trong khi `/health` xanh.
   * Công khai chỉ `{ok, loi}` (mã lỗi, không số liệu); thân chi tiết cần `x-tick-secret` như `/health` (D444).
   * Không bao giờ cache: một câu "ok" cũ phát lại là chuông câm.
   * ═══════════════════════════════════════════════════════════════════════
   */
  app.get('/api/v1/canh', async (c) => {
    // Số đếm của Worker (D594) chỉ tin khi đi kèm proxy secret khớp — người gọi thẳng Vercel không giả được để tắt chuông.
    const biMat = c.req.header('x-delphi-proxy-secret');
    const demTho = c.req.header('x-dp-dem-thang');
    const demWorker = deps.proxySecret && biMat && safeEqual(biMat, deps.proxySecret) && demTho && /^\d+$/.test(demTho)
      ? Number(demTho) : null;
    const kq = await kiemCanh(pool, { banServer: BAN_PHAT_HANH, docBanWeb: deps.docBanWeb, demWorker });
    if (!kq.ok && nenBaoCanh(`canh:${kq.loi.join(',')}`)) {
      kenhBaoLoi.bao(new Error(`canh_hong:${kq.loi.join(',')}`), {
        noi: 'GET /api/v1/canh',
        nhan: {
          ban_server: kq.ban_server, ban_web: kq.ban_web, heartbeat_age_s: kq.heartbeat_age_s, luot_thang_uoc: kq.luot_thang_uoc,
        },
      });
      await kenhBaoLoi.xa();
    }
    const given = c.req.header('x-tick-secret');
    const chiTiet = !!deps.tickSecret && !!given && safeEqual(given, deps.tickSecret);
    c.header('Cache-Control', 'no-store');
    return c.json(chiTiet ? kq : { ok: kq.ok, loi: kq.loi }, kq.ok ? 200 : 500);
  });

  /*
   * K3 — cửa máy gọi là MIDDLEWARE có tên (`requireSecret`, `server/http/cua_secret.ts`), không phải `if` đầu handler: cột guard của
   * `docs/api/danh-sach-route.md` mới thấy hai cửa đắt nhất app có khoá. Fail-closed khi secret chưa cấu hình — giữ.
   */
  const cuaTick = requireSecret((c) => c.req.header('x-tick-secret'), () => deps.tickSecret);
  /** Vercel cron gửi `Authorization: Bearer <CRON_SECRET>`; `x-cron-secret` cho gọi tay/test bằng curl. */
  const cuaBackup = requireSecret(
    (c) => c.req.header('authorization')?.replace(/^Bearer\s+/i, '') || c.req.header('x-cron-secret'),
    () => deps.backupSecret,
  );

  app.post('/api/v1/internal/tick', cuaTick, async (c) => {
    await pool.query(`INSERT INTO scheduler_heartbeat (source) VALUES ('tick')`);
    // Scheduler nghiệp vụ (GĐ4): khóa kèo tới giờ + tự hủy kèo quá hạn nguồn.
    // Lớp 1 pg_cron (prod) chạy song song cùng câu khóa — idempotent, giẫm vô hại.
    const scheduler = await runSchedulerPass(pool);
    // Dọn rác định kỳ — bảng phụ trợ không bao giờ phình vô hạn (A8.9)
    const sessions = await purgeExpiredSessions(pool);
    const attempts = await purgeOldAttempts(pool);
    await pool.query(
      `DELETE FROM auth_tokens WHERE expires_at < now() - interval '7 days'`,
    );
    // bet_intents TTL 24h (GĐ3) — không phải ledger, dọn được
    await pool.query(`DELETE FROM bet_intents WHERE created_at < now() - interval '24 hours'`);
    /*
     * ⚠ NHỊP TIM CŨNG PHẢI DỌN — sót từ GĐ0, dashboard bước 3 chỉ ra ngay lần
     * chạy đầu: `scheduler_heartbeat` là bảng TO NHẤT trên prod (3,5 MB), lớn
     * hơn cả `events`. Hai nguồn ghi mỗi phút (pg_cron + tick) = 2.880 dòng/ngày
     * và trước dòng này thì KHÔNG AI XOÁ — đúng thứ mà chú thích ngay phía trên
     * ("bảng phụ trợ không bao giờ phình vô hạn — A8.9") cấm.
     * Giữ 7 ngày: `/health` chỉ cần dòng mới nhất mỗi nguồn, phần dư để còn
     * truy được "hôm thứ ba cron có chết không".
     */
    await pool.query(`DELETE FROM scheduler_heartbeat WHERE beat_at < now() - interval '7 days'`);
    /*
     * Snapshot bảng xếp hạng — LỚP 2 (dự phòng cho pg_cron). Tự bỏ qua khi snapshot
     * còn tươi, nên tick mỗi phút KHÔNG dựng bảng mỗi phút. Đây cũng là đường chạy
     * duy nhất ở DB local, nơi pg_cron không tồn tại (0005).
     */
    const bxh = await xayBxhTick(pool);
    /*
     * D38 — DỌN TRẬN QUÁ HẠN. Đi nhờ tick sẵn có chứ KHÔNG dựng lịch mới: tick đã
     * chạy mỗi phút (D11 lớp 2) và C1 bắt ngân sách hạ tầng 0đ.
     *
     * Không có bước này thì trận rời dở nằm mãi ở `dang_choi` — đúng vấn đề founder
     * báo 27/07 ("cả ngày quay lại vẫn là ván bài đó"), và `'bo_dở'` vẫn là một giá
     * trị enum không ai ghi. Luật hết hạn nằm trong `tranHetHan`, dùng chung với
     * `/rounds` và `/luot`; ở đây chỉ là nơi bấm nút.
     */
    const holdem = await quetTranQuaHan(pool);
    /*
     * ĐO LƯỜNG VẬN HÀNH — cuộn ngày đã đóng + dọn hạn (A9). Đi nhờ nhịp tick
     * sẵn có, KHÔNG dựng scheduler mới (C3). Gần như mọi lượt chạy sẽ không có
     * gì để làm (chỉ cuộn ngày ĐÃ ĐÓNG, tối đa một ngày mỗi 24 giờ).
     */
    const telemetry = await cuonTelemetryTick(pool);
    /*
     * D106 — TẦNG CHUNG CHUYỂN HÀNH VI, quét nền: trận có event mới hơn dấu
     * `hanh_vi_tran` thì dựng lại `hanh_vi_vong`. Đường ĐỌC (`/me/tinh-cach`) tự
     * làm tươi cho chính người hỏi, nên tick chỉ phục vụ bảng GỘP (admin) và giữ
     * bảng không quá cũ khi không ai mở hồ sơ. Trần 40 trận/lượt: một replay
     * cỡ ms, 40 trận nằm gọn trong ngân sách hàm serverless.
     */
    const hanh_vi = await capNhatHanhViNen(pool, hanhViDeps, 40);
    /*
     * D444 (28/09) — DỌN KHÁCH BỎ HOANG, BƯỚC CUỐI CÙNG của tick.
     *
     * ⚠ TRY/CATCH RIÊNG, không để lỗi ở đây kéo sập cả lượt: scheduler/purge/
     * bxh/quét trận quá hạn/cuộn telemetry/hành vi phía TRÊN đã chạy xong và
     * COMMIT rồi — một lỗi dọn khách làm cả response thành 500 sẽ CHE MẤT việc
     * đó đã thành công (cron-job.org đọc 500 ⇒ tưởng cả lượt tick hỏng). Ghi
     * lỗi ra kênh báo lỗi như nhánh backup phía dưới; trả `khach_don: null` để
     * phân biệt "lượt này lỗi" với "0 khách đủ điều kiện" (số 0 thật).
     */
    let khach_don: { da_don: number; bo_qua: number } | null = null;
    try {
      khach_don = await donKhachBoHoang(pool);
    } catch (err) {
      kenhBaoLoi.bao(err, { noi: 'tick:don_khach' });
      // ⚠ XẢ TRƯỚC KHI TRẢ LỜI — cùng lý do `app.onError`: serverless đóng băng
      // tiến trình ngay sau response, event chưa xả là event mất. Thiếu dòng này
      // thì máy dọn hỏng mãi mà chuông không kêu lần nào (bắt ở lượt rà D444).
      await kenhBaoLoi.xa();
    }
    /*
     * GHÉP BÀN XẾP HẠNG ≥ 4 NGƯỜI THẬT (SPEC alpha-draft-tang-khong-gian mục 6) — đi nhờ nhịp tick sẵn có, KHÔNG dựng lịch mới (C1/C3, không
     * setInterval): suất tới giờ (:00 :15 :30 :45) ⇒ ghép TRONG DB; rồi chốt bàn quá hạn / đã không còn ai đang chơi. TRY/CATCH RIÊNG như
     * dọn khách: lỗi ở đây không được che việc tick phía trên đã làm xong. Cờ TẮT ⇒ không làm gì, không đụng bảng nào.
     */
    let ghep_ban: Record<string, unknown> | null = null;
    if (ghepBanBat()) {
      try {
        ghep_ban = { ...(await ghepCacSuat(pool)), chot: await chotBanQuaHan(pool) };
      } catch (err) {
        kenhBaoLoi.bao(err, { noi: 'tick:ghep_ban' });
        await kenhBaoLoi.xa();
      }
    }
    return c.json({
      ok: true, scheduler, purged: { sessions, attempts }, bxh,
      holdem_het_han: holdem.dong.length,
      telemetry,
      hanh_vi,
      khach_don,
      ghep_ban,
    });
  });

  /**
   * Backup đêm (D11) — Vercel cron gọi GET mỗi ngày kèm
   * `Authorization: Bearer <CRON_SECRET>` (Vercel tự chèn khi env CRON_SECRET được đặt).
   * Cũng nhận `x-cron-secret` để trigger tay/test bằng curl. READ-ONLY trên DB.
   */
  app.get('/api/v1/internal/backup', cuaBackup, async (c) => {
    if (!deps.runBackup) {
      return c.json(
        { error: 'not_configured', message: 'Backup chưa cấu hình (thiếu BACKUP_GH_TOKEN/BACKUP_GH_REPO/BACKUP_KHOA — không bao giờ đẩy bản trần).' },
        501,
      );
    }
    try {
      const result = await deps.runBackup(pool);
      return c.json({ ok: true, ...result });
    } catch (err) {
      // Backup hỏng là sự cố phải có người biết — bản khôi phục thảm hoạ mà
      // hỏng im lặng thì đến ngày cần nó mới phát hiện đã trắng tay (D57).
      kenhBaoLoi.bao(err, { noi: 'backup' });
      await kenhBaoLoi.xa();
      return c.json({ error: 'backup_failed', message: (err as Error).message }, 500);
    }
  });

  // =========================================================================
  // Auth (GĐ2)
  // =========================================================================

  app.post('/api/v1/auth/register', async (c) => {
    const body = await c.req.json().catch(() => null);
    const email = normalizeEmail(str(body, 'email'));
    const password = str(body, 'password', { max: AUTH.PASSWORD_MAX_LENGTH + 1 });
    validatePassword(password);
    const birthYear = int(body, 'birth_year');

    /*
     * D333 — ĐĂNG KÝ TỪ LINK BÀN BUỔI ĐO: xô theo BÀN thay vì theo IP (lý do dài ở
     * `AUTH.REGISTER_MAX_PER_BAN`). Mã lạ / bàn đã đóng / không phải buổi đo ⇒ rơi về
     * đường IP y như chưa gửi mã — và KHÔNG báo gì khác đi, để cửa công khai này không
     * thành máy dò mã bàn nào đang mở.
     */
    const banMo = await laBanBuoiDoDangMo(pool, (body as { ban_ma?: unknown } | null)?.ban_ma);

    // Rate limit theo IP (chống spam tài khoản)
    // Tiêu suất NGUYÊN TỬ ngay đây — mọi lần thử đều tính, kể cả lần bị age
    // gate chặn. Không còn "kiểm rồi mới ghi" (xem consumeLimit).
    const ipLimit = banMo
      ? await consumeLimit(
        pool, `register:ban:${banMo}`,
        AUTH.REGISTER_MAX_PER_BAN, AUTH.REGISTER_BAN_WINDOW_HOURS * 60,
      )
      : await tieuHanMucIp(
        pool, c, deps.proxySecret, 'register',
        AUTH.REGISTER_MAX_PER_IP, AUTH.REGISTER_WINDOW_HOURS * 60,
      );
    if (!ipLimit.allowed) {
      return c.json(
        { error: 'rate_limited', message: 'Bạn đã tạo quá nhiều tài khoản. Thử lại sau 1 giờ.' },
        429,
        { 'Retry-After': String(ipLimit.retryAfterSeconds) },
      );
    }

    // Age gate (C8) — chỉ giữ age_band, KHÔNG lưu năm sinh (C7)
    const gate = checkAgeGate(birthYear);
    if (!gate.ok) {
      if (gate.reason === 'under_age') {
        return c.json(
          {
            error: 'under_age',
            message: `Rất tiếc, Dự báo chỉ dành cho người từ ${ECONOMY.AGE_GATE_MIN} tuổi trở lên. Hẹn gặp bạn sau nhé!`,
          },
          403,
        );
      }
      return c.json({ error: 'invalid_input', field: 'birth_year', message: 'Năm sinh không hợp lệ.' }, 400);
    }

    const passwordHash = await hashPassword(password);

    let accountId: string;
    try {
      const { rows } = await pool.query(
        `INSERT INTO auth_accounts (email, password_hash, pending_age_band)
         VALUES ($1, $2, $3) RETURNING account_id`,
        [email, passwordHash, gate.ageBand],
      );
      accountId = rows[0].account_id;
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        // Không tiết lộ email đã tồn tại (chống dò danh sách user)
        return c.json({ ok: true, message: 'Kiểm tra hộp thư để xác minh email nhé.' }, 202);
      }
      throw err;
    }

    const rawToken = generateToken();
    await pool.query(
      `INSERT INTO auth_tokens (token_hash, account_id, purpose, expires_at)
       VALUES ($1, $2, 'verify_email', now() + ($3 || ' hours')::interval)`,
      [hashToken(rawToken), accountId, AUTH.VERIFY_TOKEN_TTL_HOURS],
    );
    /*
     * D333 — link xác minh MANG THEO MÃ BÀN. Thư thường được mở ở một trình duyệt khác (trình duyệt
     * trong app Gmail), nơi không còn gì nhớ người này đến từ bàn nào; thiếu mã thì xác minh xong họ
     * rơi về Hub giữa buổi đo. Chỉ mã đã qua `laBanBuoiDoDangMo` mới được gắn — không vọng lại chữ
     * người gửi tự đặt.
     */
    const quayVe = banMo ? `&ban=${banMo}` : '';
    await mailer.send(
      verifyEmailMail(email, `${deps.appBaseUrl}/verify-email?token=${rawToken}${quayVe}`),
    );

    /*
     * D392 — D370 ① ("bỏ xác minh đi :V vì đâu ai có link khác", founder 21/09) NAY CHẠY THẬT.
     *
     * ⚠⚠ Trước bản này cửa D370 ở `/onboarding` KHÔNG CÓ ĐƯỜNG TỚI: nó đòi một phiên, mà đăng ký không cấp
     * phiên còn đăng nhập thì chặn email chưa xác minh (xem `/auth/login`). Bài test D370 dựng phiên thẳng
     * trong DB nên vẫn xanh; đi thử bằng trình duyệt 23/09: tester vẫn phải mở hộp thư như thường.
     * ⇒ Người đăng ký TỪ BÀN BUỔI ĐO ĐANG MỞ (`banMo` đã qua `laBanBuoiDoDangMo`) được cấp phiên NGAY, rồi
     * đi thẳng vào lập hồ sơ. Thư xác minh vẫn gửi: bấm lúc nào cũng được, và là đường khôi phục mật khẩu.
     * ⚠ CHỈ tài khoản VỪA TẠO ở đây — nhánh email đã tồn tại (23505) trả 202 ở trên, KHÔNG phiên nào: cấp
     *   phiên ở đó là trao tài khoản của người khác cho bất kỳ ai gõ được email của họ.
     * ⚠ Giá đã khai ở D370 (`/onboarding`): email của nhóm này không được xác minh ⇒ khôi phục mật khẩu yếu
     *   hơn; bán kính một bàn đang mở, xô đăng ký theo bàn (`REGISTER_MAX_PER_BAN`).
     * ⚠ Token ra cả thân phản hồi — cùng lý lẽ `/auth/login` (Activity Discord không gửi cookie xuyên site).
     */
    if (banMo) {
      const raw = await createSession(pool, accountId);
      setCookie(c, AUTH.SESSION_COOKIE, raw, {
        httpOnly: true,
        secure: deps.secureCookie ?? true,
        sameSite: 'Lax',
        path: '/',
        maxAge: AUTH.SESSION_TTL_DAYS * 24 * 60 * 60,
      });
      return c.json({
        ok: true, dang_nhap: true, onboarded: false, token: raw,
        message: 'Đã tạo tài khoản — lập hồ sơ để vào buổi đo. Thư xác minh email vẫn gửi, bấm lúc nào cũng được.',
      }, 201);
    }

    return c.json({ ok: true, message: 'Kiểm tra hộp thư để xác minh email nhé.' }, 202);
  });

  app.post('/api/v1/auth/verify-email', async (c) => {
    const body = await c.req.json().catch(() => null);
    const token = str(body, 'token');
    const { rows } = await pool.query(
      `UPDATE auth_tokens SET used_at = now()
        WHERE token_hash = $1 AND purpose = 'verify_email'
          AND used_at IS NULL AND expires_at > now()
        RETURNING account_id`,
      [hashToken(token)],
    );
    if (rows.length === 0) {
      return c.json(
        { error: 'invalid_token', message: 'Liên kết xác minh không đúng hoặc đã hết hạn.' },
        400,
      );
    }
    await pool.query(
      `UPDATE auth_accounts SET email_verified_at = COALESCE(email_verified_at, now()),
                                updated_at = now()
        WHERE account_id = $1`,
      [rows[0].account_id],
    );
    return c.json({ ok: true, message: 'Email đã xác minh. Bạn đăng nhập được rồi.' });
  });

  /*
   * ═══ CHƠI NGAY, KHÔNG ĐĂNG NHẬP (founder chốt 04/08) ═══════════════════════
   *
   * Một cú bấm, không biểu mẫu. Tạo tài khoản KHÁCH thật (`users.la_khach`) chứ
   * không phải một phiên giả — xem lý do dài trong `migrations/0030_khach.sql`:
   * `events.user_id` có khoá ngoại, nên tài khoản thật là thứ DUY NHẤT cho phép
   * mọi đường ghi hiện có dùng lại nguyên vẹn, không đẻ ra đường dữ liệu thứ hai.
   *
   * ⭐ VÀ NÓ ĐI VÒNG QUA ĐÚNG LỖI ĐANG CHẶN: trong iframe Discord, cookie
   * `SameSite=Lax` không được gửi nên đăng nhập bằng email không dính. Cửa này
   * trả token ra THÂN phản hồi để client mang bằng `Authorization: Bearer` —
   * cùng đường đã làm cho Discord, chạy được ở cả hai chỗ.
   *
   * ⚠ Vẫn đặt cookie như thường cho bản web: hai đường không loại trừ nhau, và
   * bản web thì cookie HttpOnly an toàn hơn token nằm trong bộ nhớ JS.
   */
  app.post('/api/v1/auth/khach', async (c) => {
    /*
     * ⚠ CỬA NÀY TẠO MỘT HÀNG `users` MỖI LẦN GỌI — không rate limit thì nó là
     * cửa bơm phình bảng người dùng, và `events` trỏ vào đó nên rác kéo theo rác.
     * Mà `events` là APPEND-ONLY (A3.3): rác đổ vào nằm đó vĩnh viễn và chiếm chỗ
     * của dữ liệu thật (A1), trên một free tier 500 MB (C1).
     * Dùng CHUNG hạn mức với đăng ký: cùng bản chất "một người mới xuất hiện".
     */
    const kq = await tieuHanMucIp(
      pool, c, deps.proxySecret, 'khach',
      AUTH.REGISTER_MAX_PER_IP, AUTH.REGISTER_WINDOW_HOURS * 60,
    );
    if (!kq.allowed) {
      return c.json({
        error: 'rate_limited',
        message: 'Bạn vừa tạo nhiều lượt chơi thử quá. Đợi một lát rồi thử lại nhé.',
      }, 429);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const acc = await client.query(
        `INSERT INTO auth_accounts DEFAULT VALUES RETURNING account_id`);
      const accountId = acc.rows[0].account_id as string;

      /*
       * Tên tự cấp. Trùng thì thử lại — `handle` là UNIQUE, và ở mùa 0.0 với
       * ~150 người thì đụng độ gần như không xảy ra, nhưng "gần như" không phải
       * "không" và một lần đụng là một người không vào chơi được.
       */
      let handle = '';
      for (let i = 0; i < 6; i += 1) {
        const thu = `khach_${generateToken().replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)}`;
        const co = await client.query(`SELECT 1 FROM users WHERE handle = $1`, [thu]);
        if (co.rowCount === 0) { handle = thu; break; }
      }
      if (!handle) throw new Error('khong_cap_duoc_ten_khach');

      /*
       * KHÔNG nhân khẩu (bậc 0 của 0029), KHÔNG vốn khởi điểm — Đấu trường không
       * đụng ví (`server/holdem_api.ts:20`), nên khách chơi trọn vẹn mà không cần
       * một T nào. Muốn ví thì nâng cấp tài khoản, và đó là đúng chỗ để hỏi.
       */
      const us = await client.query(
        `INSERT INTO users (handle, season_id, la_khach) VALUES ($1, $2, true)
         RETURNING user_id`,
        [handle, currentSeasonId()],
      );
      const userId = us.rows[0].user_id as string;
      await client.query(
        `UPDATE auth_accounts SET user_id = $1 WHERE account_id = $2`, [userId, accountId]);
      /*
       * Cấp bộ avatar khởi đầu như mọi tài khoản: khách vẫn có MẶT trên bàn đấu,
       * mà D25 nói thẳng thứ làm trò có sức nặng là đối thủ NHÌN THẤY mình. Một
       * ghế không mặt thì mất đúng phần đó.
       * ⚠ Không hỏi họ chọn lá nào — hỏi là dựng lại cái biểu mẫu vừa bỏ đi. Lá
       * mặc định, đổi được sau ở Hồ sơ.
       */
      await capBoKhoiDau(client, userId, DIEN_MAO_MAC_DINH);
      /*
       * ⚠⚠ `client`, KHÔNG PHẢI `pool` — và đây là chỗ bản đầu TỰ KHOÁ CHÍNH NÓ.
       *
       * `api/index.ts` mở pool với `max: 1` (đúng cho serverless: mỗi instance
       * chỉ nên giữ một kết nối thật qua pooler). Nên hễ đang cầm client mà lại
       * xin thêm một kết nối từ pool là XIN CHÍNH CÁI MÌNH ĐANG GIỮ — chờ vĩnh
       * viễn. Đo trên prod: đúng 10,4 giây rồi Vercel cắt, tức không phải "chậm"
       * mà là bế tắc, và nó KHÔNG tái lập được ở local vì pool local `max: 10`.
       *
       * Tiện thể còn đúng hơn về nghiệp vụ: phiên tạo TRONG cùng transaction, nên
       * COMMIT hỏng thì không có phiên trỏ vào một tài khoản không tồn tại.
       */
      const raw = await createSession(client, accountId);
      await client.query('COMMIT');
      setCookie(c, AUTH.SESSION_COOKIE, raw, {
        httpOnly: true, secure: deps.secureCookie ?? true, sameSite: 'Lax', path: '/',
        maxAge: AUTH.SESSION_TTL_DAYS * 24 * 60 * 60,
      });
      return c.json({ token: raw, handle, la_khach: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  app.post('/api/v1/auth/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const email = normalizeEmail(str(body, 'email'));
    const password = str(body, 'password');

    /**
     * Tiêu suất TRƯỚC khi verify mật khẩu, không phải sau khi biết sai.
     *
     * Bản cũ chỉ ghi khi sai — nghĩa là trong lúc argon2 băm (~100ms), cả loạt
     * request song song đều đã qua cửa kiểm vì chưa ai kịp ghi lỗi nào. Nay
     * mỗi lần thử tiêu một suất ngay; đăng nhập ĐÚNG thì clearAttempts bên
     * dưới xoá sạch bucket, nên người dùng thật không bị ảnh hưởng.
     */
    const bucket = `login:email:${email}`;
    const limit = await consumeLimit(
      pool, bucket, AUTH.LOGIN_MAX_FAILS, AUTH.LOGIN_FAIL_WINDOW_MINUTES,
    );
    if (!limit.allowed) {
      return c.json(
        {
          error: 'rate_limited',
          message: `Sai mật khẩu quá nhiều lần. Thử lại sau ${AUTH.LOGIN_LOCK_MINUTES} phút.`,
        },
        429,
        { 'Retry-After': String(AUTH.LOGIN_LOCK_MINUTES * 60) },
      );
    }

    const { rows } = await pool.query(
      `SELECT account_id, password_hash, email_verified_at, user_id
         FROM auth_accounts WHERE email = $1`,
      [email],
    );
    const account = rows[0];
    // D444: kiemMatKhau, KHÔNG gọi verifyPassword thẳng — email lạ (account
    // undefined) vẫn tốn đúng một lượt argon2 y hệt email có thật, để hai
    // nhánh không lộ ra qua THỜI GIAN phản hồi (xem server/auth/crypto.ts).
    const ok = await kiemMatKhau(account?.password_hash, password);
    if (!ok) {
      // Suất đã bị tiêu ở consumeLimit phía trên — không ghi thêm lần nữa.
      // Cùng một thông điệp cho "email sai" và "mật khẩu sai" — không dò được user
      return c.json({ error: 'invalid_credentials', message: 'Email hoặc mật khẩu không đúng.' }, 401);
    }
    if (account.email_verified_at === null) {
      return c.json(
        { error: 'email_not_verified', message: 'Bạn cần xác minh email trước khi đăng nhập.' },
        403,
      );
    }

    await clearAttempts(pool, bucket);
    const raw = await createSession(pool, account.account_id);
    setCookie(c, AUTH.SESSION_COOKIE, raw, {
      httpOnly: true,
      secure: deps.secureCookie ?? true,
      sameSite: 'Lax',
      path: '/',
      maxAge: AUTH.SESSION_TTL_DAYS * 24 * 60 * 60,
    });
    /*
     * ⚠⚠ TOKEN RA CẢ THÂN PHẢN HỒI — nếu không thì ĐĂNG NHẬP BẰNG EMAIL KHÔNG
     * DÍNH TRONG DISCORD, và đó là lý do thật khiến người mở Activity chỉ có mỗi
     * đường tài khoản KHÁCH (founder 04/08).
     *
     * Activity chạy trong iframe của `{clientId}.discordsays.com` — ngữ cảnh
     * XUYÊN SITE với trang chủ. Cookie phiên đặt `SameSite=Lax` nên trình duyệt
     * KHÔNG GỬI nó đi, tức đăng nhập "thành công" xong mọi `/api/v1` vẫn 401.
     * Hỏng kiểu khó chịu nhất: màn hình nói đã vào, hệ thống nói chưa.
     *
     * ⚠ VẪN ĐẶT COOKIE như thường cho bản web — hai đường KHÔNG loại trừ nhau,
     * và trên web thì `HttpOnly` an toàn hơn token nằm trong bộ nhớ JS. Đây đúng
     * là lựa chọn cửa KHÁCH đã làm (D64/0030); làm khác đi ở đây là để hai cửa
     * đăng nhập có hai hành vi khác nhau mà không ai nhớ vì sao.
     *
     * ⚠ Trả token cho web KHÔNG nới lỗ hổng nào: thân phản hồi chỉ trang vừa gửi
     * request đọc được, và muốn gọi được cửa này thì đã phải có mật khẩu.
     */
    return c.json({ ok: true, onboarded: account.user_id !== null, token: raw });
  });

  app.post('/api/v1/auth/logout', async (c) => {
    /*
     * ⚠ ĐỌC QUA `docTokenPhien`, KHÔNG ĐỌC THẲNG COOKIE (vá 11/08).
     *
     * Bản cũ chỉ đọc cookie ⇒ phiên đi bằng Bearer (Activity Discord) gọi đăng
     * xuất thì KHÔNG thu hồi gì, mà endpoint vẫn trả `{ok:true}`. Người bấm tin
     * là mình đã ra; phiên sống tới lúc hết hạn. Một nút đăng xuất nói dối tệ
     * hơn không có nút nào — nó làm người ta yên tâm rời máy.
     *
     * Xoá cookie vẫn giữ nguyên: đường web cần nó, và với phiên Bearer thì lệnh
     * xoá là phép rỗng vô hại.
     */
    const raw = docTokenPhien(c);
    if (raw) await revokeSession(pool, raw);
    deleteCookie(c, AUTH.SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  app.get('/api/v1/auth/me', requireAuth, async (c) => {
    const actor = c.get('actor');
    if (!actor.userId) {
      /*
       * D396 — NHÓM TUỔI ĐÃ SUY TỪ NĂM SINH lúc đăng ký (`pending_age_band`, C7: năm sinh không lưu). Màn hồ
       * sơ chọn sẵn đúng nhóm này thay vì bắt chọn lại rồi từ chối: tuổi tính theo NĂM (`checkAgeGate`), nên
       * học sinh sinh cuối 2008 — thật ra 17 tuổi — thuộc nhóm "18–22"; bấm "16–17" từng bị báo "không khớp
       * năm sinh" ngay ở màn đầu của buổi đo. Cổng kiểm ở `/onboarding` giữ nguyên.
       */
      const khai = await pool.query(
        `SELECT pending_age_band FROM auth_accounts WHERE account_id = $1`, [actor.accountId]);
      return c.json({
        email: actor.email,
        email_verified: actor.emailVerified,
        onboarded: false,
        user: null,
        nhom_tuoi_khai: (khai.rows[0]?.pending_age_band as string | null | undefined) ?? null,
      });
    }
    const { rows } = await pool.query(
      `SELECT user_id, handle, age_band, region, occupation_band, bankroll,
              role, research_consent, research_consent_phien_ban, created_at, season_id, dien_mao,
              nhan_khau_hoi_luc, la_khach, giong_ho_so, pfm_consent, pfm_bat_dau,
              thu_chi_tiet, thu_chi_tiet_nhan, ma_buoi_do, buoi_do_buoc,
              -- D392: bàn buổi đo = bàn của VẾT ĐỒNG Ý MỚI NHẤT. CASE lười ⇒ người thường không tốn gì.
              CASE WHEN thu_chi_tiet THEN (
                SELECT e.context_id FROM events e
                 WHERE e.user_id = users.user_id AND e.action_type = 'hd_dong_y_buoi_do'
                 ORDER BY e.ts DESC LIMIT 1) END AS ban_buoi_do,
              ${COT_CUA_SELECT},
              -- HUY HIỆU HẠNG (SPEC huy-hieu-hang-sticker): ba cột điểm của MÙA NÀY đi kèm câu SELECT đã chạy —
              -- không thêm request nào từ client (D11) và không thêm round-trip DB. Chưa có dòng ⇒ NULL.
              (SELECT rd.diem FROM rank_diem rd
                WHERE rd.user_id = users.user_id AND rd.season_id = $2) AS rank_diem,
              (SELECT rd.so_tran FROM rank_diem rd
                WHERE rd.user_id = users.user_id AND rd.season_id = $2) AS rank_so_tran,
              (SELECT rd.hang FROM rank_diem rd
                WHERE rd.user_id = users.user_id AND rd.season_id = $2) AS rank_hang
         FROM users WHERE user_id = $1`,
      [actor.userId, currentSeasonId()],
    );
    const u = rows[0];
    /*
     * TRẠNG THÁI PFM ĐI KÈM `/me`, KHÔNG PHẢI MỘT ROUTE RIÊNG (T5.9/K11 — cùng lý
     * lẽ `dien_mao` ở dưới: tách ra là thêm một request mỗi lần mở app, trong một
     * ngân sách 1M request/tháng). CHỈ chạy ba câu đọc khi user ĐÃ consent — không
     * tốn gì thêm cho phần lớn user chưa bật PFM (RANH 1: server không tính hộ thứ
     * không ai cần). Ba hàm đọc đều KHÔNG mở transaction (chỉ SELECT), chạy qua
     * `pool.query()` song song an toàn — không giữ connection qua await như
     * `consumeLimit` nên không đụng bẫy 12/08.
     */
    const pfm = u.pfm_consent
      ? await (async () => {
        const [chuoi, vi, tuan] = await Promise.all([
          docChuoi(pool, actor.userId!),
          docViToken(pool, actor.userId!),
          docTrangThaiTuan(pool, actor.userId!),
        ]);
        return {
          // `consent` = có ít nhất một cửa bật; `cua` nói RÕ cửa nào (D295). Vắng `pfm`
          // (null) thì client hiểu là bốn cửa đều đóng — không cần một hình dạng thứ ba.
          consent: true, bat_dau: u.pfm_bat_dau, cua: cuaTuHang(u),
          chuoi: chuoi.chuoi, da_dung_bao_hiem: chuoi.daDungBaoHiem, hom_nay_xong: chuoi.homNayXong,
          so_ngay_thang_nay: chuoi.soNgayThangNay,
          token: vi.soDu, token_da_phat_hom_nay: vi.daPhatHomNay, token_tran_ngay: vi.tranNgay,
          tuan: tuan.tuan, tuan_da_niem_phong: tuan.daNiemPhong, tuan_token_thuong: tuan.tokenThuong,
          tuan_so_ngay_co_mat: tuan.soNgayCoMat,
        };
      })()
      : null;
    /*
     * BẬC 1 — CÓ NÊN HỎI NHÂN KHẨU BÂY GIỜ KHÔNG (D64 phương án B).
     *
     * ⚠ MÁY CHỦ QUYẾT, KHÔNG PHẢI CLIENT (C4). Luật là "chưa khai · chưa từng
     * hỏi · và đã chơi ít nhất một trận"; để client tự ghép ba mảnh đó thì mỗi
     * màn mới lại phải nhớ ghép đúng, và quên một mảnh là hỏi nhầm người.
     *
     * ⚠ Câu EXISTS chỉ chạy khi HAI điều kiện rẻ đã đúng — tức chỉ với người
     * chưa khai và chưa bị hỏi. Trả lời hoặc bỏ qua một lần là nó tắt vĩnh viễn,
     * nên đây không phải phí thường trực trên đường nóng (pool 5 kết nối, C1).
     */
    let hoiNhanKhau = false;
    if (u.age_band === null && u.nhan_khau_hoi_luc === null) {
      const { rows: co } = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM holdem_matches WHERE owner_user_id = $1) AS da_choi`,
        [actor.userId],
      );
      hoiNhanKhau = co[0]?.da_choi === true;
    }
    return c.json({
      hoi_nhan_khau: hoiNhanKhau,
      // B5 — tấm hỏi năm sinh (AppShell). Cùng cờ `requireOnboarded` đọc, một nguồn.
      can_xac_nhan_tuoi: !actor.tuoiDaXacNhan,
      email: actor.email,
      email_verified: actor.emailVerified,
      onboarded: true,
      user: {
        user_id: u.user_id,
        handle: u.handle,
        age_band: u.age_band,
        region: u.region,
        occupation_band: u.occupation_band,
        bankroll: Number(u.bankroll),
        role: u.role,
        /*
         * 0079 — đồng ý CÓ HIỆU LỰC (bật + đúng bản văn hiện hành), không phải cột thô: người bật trước khi có số bản thấy ô TẮT và
         * gặp tấm hỏi lại (`hoi_lai_nghien_cuu` ở dưới) — founder 11/10 "chưa trả lời = TẮT". Một nguồn: `server/nghien_cuu.ts`.
         */
        research_consent: nghienCuuHieuLuc(u),
        research_consent_phien_ban: u.research_consent_phien_ban ?? null,
        hoi_lai_nghien_cuu: canHoiLaiNghienCuu(u),
        created_at: u.created_at,
        season_id: u.season_id,
        /*
         * ⚠⚠ THIẾU TRƯỜNG NÀY LÀ LÝ DO NGƯỜI VÀO TỪ DISCORD KẸT LẠI Ở TÀI KHOẢN
         * KHÁCH (founder 04/08: *"chỉ được tặng ngay 1 tài khoản khách"*).
         *
         * Client trước nay KHÔNG CÓ CÁCH NÀO biết mình đang là khách hay là tài
         * khoản thật — nên Hub chỉ dám hiện nút đăng nhập khi `user === null`, mà
         * khách thì CÓ `user`. Kết quả: cửa duy nhất để thoát khỏi chế độ khách
         * biến mất đúng với người đang ở trong chế độ khách.
         * Một dòng ở đây, và nó là cột duy nhất cho phép giao diện nói ra sự thật.
         */
        la_khach: u.la_khach === true,
        /*
         * HẠNG ĐẤU TRƯỜNG — id bậc (`BAC_THANG[].id`: tap_su … tao_song), `null` khi CHƯA XẾP BẬC (chưa đủ
         * trận / chưa có dòng điểm mùa này). Client cũ không biết trường này ⇒ không vẽ ô hạng (D62: thiếu
         * mẫu là `null`, không bao giờ là bậc giả). Cùng `bacTuDiem` với `/me/rank` — một công thức, một
         * nguồn; ở đây KHÔNG lộ điểm, chỉ lộ bậc.
         */
        bac: ((): string | null => {
          if (u.rank_so_tran === null || u.rank_so_tran === undefined) return null;
          const id = bacTuDiem(
            Number(u.rank_diem), Number(u.rank_so_tran), u.rank_hang === null ? null : Number(u.rank_hang));
          return id === 'chua_xep' ? null : id;
        })(),
        /*
         * GIỌNG HỒ SƠ (D106, founder 22/08: thẻ tếu/meme theo tuổi HOẶC theo
         * Cài đặt). Client suy giọng từ `age_band` + cột này (`giongCua`); server
         * không chọn hộ vì câu chữ nằm ở client (lint từ vựng quét `web/src`).
         */
        giong_ho_so: (u.giong_ho_so ?? 'tu_dong') as string,
        /*
         * DIỆN MẠO ĐI KÈM `/auth/me`, không phải một request riêng.
         *
         * Nó là một cột trên `users` nên không tốn thêm round-trip nào, và mọi
         * màn cần vẽ mặt mình (hồ sơ · dải đối thủ · khoảnh khắc toàn màn) đều
         * đã gọi `useMe()` sẵn. Tách ra endpoint riêng là thêm một request trên
         * mỗi lần mở app, trong một ngân sách 1M request/tháng (D11).
         */
        dien_mao: dienMaoGheNguoi(u.dien_mao),
      },
      pfm,
      /*
       * D370 — CHẾ ĐỘ TESTER ĐI KÈM `/me`, cùng lý lẽ với `pfm` và `dien_mao` ngay trên: tách thành
       * route riêng là thêm một request mỗi lần mở app, trong ngân sách 1M request/tháng (D11).
       * Bốn cột lấy từ CHÍNH câu SELECT đã chạy — không tốn thêm một truy vấn nào.
       *
       * ⚠ `null` khi không thuộc đợt đo nào. Client hiểu "không có chế độ tester" — không cần hình
       * dạng thứ ba, y như `pfm: null` nghĩa là bốn cửa đều đóng.
       * ⚠ Rút đồng ý ⇒ `thu_chi_tiet = false` ⇒ khối này thành `null` ngay lần đọc kế, dải tester biến
       * mất. Mã vẫn nằm trong DB (0069) nhưng người đã rút thì không còn ở chế độ ấy nữa.
       */
      /*
       * D392 — `ban` = mã BÀN buổi đo (5 ký tự), khác `ma` = mã buổi đo của NGƯỜI (4 ký tự, điền vào
       * phiếu). Thiếu nó thì chơi xong bàn tập là không có đường về bàn: link bàn chỉ nằm trong tin nhắn,
       * còn điểm quay về đã xoá lúc vào bàn lần đầu. Dải tester dùng nó cho nút VÀO BÀN BUỔI ĐO.
       */
      buoi_do: u.thu_chi_tiet
        ? {
          ma: u.ma_buoi_do as string | null, nhan: u.thu_chi_tiet_nhan as string | null,
          buoc: Number(u.buoi_do_buoc), ban: (u.ban_buoi_do as string | null) ?? null,
        }
        : null,
    });
  });

  // =========================================================================
  // Onboarding (GĐ2 việc 3–4) — MỘT transaction: users + signup_grant + event
  // =========================================================================

  app.post('/api/v1/onboarding', requireAuth, async (c) => {
    const actor = c.get('actor');
    if (actor.userId) {
      return c.json({ error: 'already_onboarded', message: 'Hồ sơ của bạn đã hoàn tất rồi.' }, 409);
    }

    const body = await c.req.json().catch(() => null);

    /*
     * D370 — BỎ CỬA XÁC MINH EMAIL CHO NGƯỜI VÀO TỪ BÀN BUỔI ĐO ĐANG MỞ (founder 21/09:
     * *"bỏ xác minh đi :V vì đâu ai có link khác"*).
     *
     * ⚠ Đây là CỬA MỘT CHIỀU đã được founder chốt, không phải tôi tự nới (A11.17). Lý do đứng được:
     * mở được cửa này thì phải có mã của một bàn buổi đo ĐANG MỞ — mã do người có quyền điều phối tạo,
     * bàn tự hết hạn, và xô đăng ký theo bàn đã chặn ở 60 tài khoản/24h. Tức "có link" chính là giấy phép.
     *
     * ⚠ KIỂM LẠI Ở ĐÂY, KHÔNG TIN CỜ LƯU TỪ LÚC ĐĂNG KÝ. `ban_ma` lúc signup chỉ dùng chọn xô hạn mức
     * rồi bị vứt (app.ts §signup) — cố ý không lưu. Kiểm lại ngay lúc dùng nghĩa là: bàn đóng giữa chừng
     * thì cửa đóng theo, không có cờ cũ nào sống sót quá hạn của bàn.
     *
     * ⚠ CÁI GIÁ, ghi ra để sau này không ai phải đoán: email của đúng nhóm tài khoản này KHÔNG được xác
     * minh ⇒ đường khôi phục mật khẩu của họ yếu hơn. Bán kính giới hạn trong một bàn, tới khi bàn đóng.
     */
    const banMo = await laBanBuoiDoDangMo(pool, (body as { ban_ma?: unknown } | null)?.ban_ma);
    if (!actor.emailVerified && !banMo) {
      return c.json({ error: 'email_not_verified', message: 'Bạn cần xác minh email trước.' }, 403);
    }
    const handle = str(body, 'handle').toLowerCase();
    validateHandle(handle);
    const ageBand = oneOf(body, 'age_band', DEMOGRAPHIC.AGE_BANDS);
    const region = oneOf(body, 'region', DEMOGRAPHIC.REGIONS);
    const occupationBand = oneOf(body, 'occupation_band', DEMOGRAPHIC.OCCUPATION_BANDS);
    const researchConsent = bool(body, 'research_consent');
    /*
     * 0079 — số bản văn đồng ý màn onboarding đang hiện. Không phải bản hiện hành (web cũ trong cache PWA chưa gửi trường này) ⇒ vẫn
     * tạo hồ sơ (chặn ở đây là chặn đăng ký) nhưng cột bật mà KHÔNG có số bản ⇒ server coi như TẮT và hỏi lại ở lần mở app kế.
     */
    const nghienCuuPhienBan = researchConsent
      && laConsentHienHanh(VAN_BAN_NGHIEN_CUU, (body as { research_consent_phien_ban?: unknown } | null)?.research_consent_phien_ban)
      ? CONSENT_PHIEN_BAN.nghien_cuu : null;

    /*
     * LÁ AVATAR CHỌN LÚC ĐĂNG KÝ.
     *
     * ⚠ KHÔNG BẮT BUỘC Ở TẦNG API, dù thiết kế đòi "bắt buộc chọn, không mặc
     * định sẵn". Lý do là vận hành chứ không phải thiết kế: app đã có user thật
     * và là PWA có service worker, nên một bản web cũ nằm trong cache mà API vừa
     * siết thành 400 nghĩa là NGƯỜI MỚI KHÔNG ĐĂNG KÝ ĐƯỢC. Bắt buộc nằm ở màn
     * onboard (không cho đi tiếp khi chưa chạm một lá) — đúng chỗ có thể chỉ cho
     * người dùng thấy phải làm gì.
     *
     * Dữ liệu vẫn SẠCH, và đó mới là chỗ quan trọng: event ghi kèm `tu_chon`, nên
     * "chọn lá A" và "không chọn nên nhận lá A" là hai thứ PHÂN BIỆT ĐƯỢC trong
     * truy vấn. Nếu gộp một cờ thì phân bố thu về là phân bố của CÁI MẶC ĐỊNH chứ
     * không phải của gu — và cột đó mất nghĩa vĩnh viễn vì events append-only.
     */
    const gocGui = (body as { avatar_goc?: unknown } | null)?.avatar_goc;
    const tuChon = typeof gocGui === 'string' && NEN_TANG.some((g) => g.ma === gocGui);
    const goc = tuChon ? (gocGui as string) : NEN_TANG[0]!.ma;

    const { rows: accRows } = await pool.query(
      `SELECT pending_age_band FROM auth_accounts WHERE account_id = $1`,
      [actor.accountId],
    );
    const pendingBand: string | null = accRows[0]?.pending_age_band ?? null;
    // age_band là XÁC NHẬN của khoảng suy từ năm sinh lúc đăng ký — không cho khai khác
    if (pendingBand && ageBand !== pendingBand) {
      return c.json(
        {
          error: 'age_band_mismatch',
          field: 'age_band',
          message: 'Nhóm tuổi không khớp năm sinh bạn đã khai lúc đăng ký.',
        },
        400,
      );
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const grant = BigInt(ECONOMY.STARTING_BANKROLL);
      const seasonId = currentSeasonId();

      const { rows: userRows } = await client.query(
        `INSERT INTO users (handle, age_band, region, occupation_band, bankroll,
                            research_consent, season_id, dien_mao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING user_id`,
        [handle, ageBand, region, occupationBand, grant.toString(), researchConsent && nghienCuuPhienBan === null,
          seasonId, DIEN_MAO_MAC_DINH],
      );
      const userId: string = userRows[0].user_id;
      // 0079 — đồng ý ngay từ onboarding: số bản + vết `nghien_cuu_dong_y` đi qua đúng đường ghi của Hồ sơ (một nguồn), cùng tx.
      if (nghienCuuPhienBan !== null) await datNghienCuu(client, userId, true, nghienCuuPhienBan);

      /*
       * QUÀ KHỞI ĐẦU — HAI tác phẩm (D36), tạo trong CHÍNH transaction này.
       *
       * `users.dien_mao` vừa được ghi bằng chuỗi mặc định chỉ để thoả NOT NULL;
       * `capBoKhoiDau` ghi đè nó bằng chuỗi của tác phẩm đang mặc và trỏ
       * `avatar_dang_mac` vào đó. Hai bước trong một transaction nên không tồn tại
       * trạng thái "có hồ sơ mà không có avatar nào" — trạng thái đó sẽ làm hồ sơ
       * và dải đối thủ vẽ ra hai thứ khác nhau.
       */
      await capBoKhoiDau(client, userId, goc);

      await client.query(
        `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
         VALUES ($1, $2, $3, 'signup_grant')`,
        [userId, grant.toString(), grant.toString()],
      );
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type, value_json,
                             state_snapshot_json)
         VALUES ($1, 'onboarding', $2, 'onboard_demo', $3, NULL)`,
        [
          userId,
          userId,
          JSON.stringify({
            age_band: ageBand,
            region,
            occupation_band: occupationBand,
            research_consent: researchConsent,
          }),
        ],
      );
      /*
       * `avatar_chon` — revealed preference MIỄN PHÍ của 100% người dùng, ghi
       * đúng MỘT LẦN trong đời tài khoản, CÙNG transaction với việc tạo hồ sơ.
       *
       * Ba trường, không thừa một trường nào (A7: công thức index viết TRƯỚC rồi
       * mới suy trường cần log):
       *   · `goc`      — phân bố gu. Câu hỏi: ba lá có THẬT chia ba không?
       *   · `tu_chon`  — tách "chọn" khỏi "nhận mặc định"; xem lý do ở trên.
       *   · `ms_can_nhac` — thời gian tới lúc bấm, client đo. Tách "chọn thật"
       *     khỏi "bấm cho xong"; không có nó thì mọi lượt chọn trông giống nhau.
       * Cố ý KHÔNG ghi cả chuỗi diện mạo: lúc onboard nó luôn là gốc + rỗng, tức
       * 19 byte cho zero thông tin mới.
       */
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type, value_json,
                             state_snapshot_json)
         VALUES ($1, 'onboarding', $2, 'avatar_chon', $3, NULL)`,
        [
          userId, userId,
          JSON.stringify({
            goc,
            tu_chon: tuChon,
            ms_can_nhac: Number.isFinite((body as { avatar_ms?: unknown })?.avatar_ms as number)
              ? Math.max(0, Math.min(600_000, Math.round(
                (body as { avatar_ms: number }).avatar_ms)))
              : null,
          }),
        ],
      );
      const linked = await client.query(
        `UPDATE auth_accounts SET user_id = $1, pending_age_band = NULL, updated_at = now()
          WHERE account_id = $2 AND user_id IS NULL`,
        [userId, actor.accountId],
      );
      if (linked.rowCount !== 1) {
        // Có phiên khác vừa onboard xong → không cấp vốn hai lần
        throw Object.assign(new Error('race_onboarding'), { code: 'RACE' });
      }
      await client.query('COMMIT');

      return c.json({ ok: true, user_id: userId, bankroll: ECONOMY.STARTING_BANKROLL }, 201);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const code = (err as { code?: string }).code;
      if (code === '23505') {
        return c.json(
          { error: 'handle_taken', field: 'handle', message: 'Tên hiển thị đã có người dùng.' },
          409,
        );
      }
      if (code === 'RACE') {
        return c.json({ error: 'already_onboarded', message: 'Hồ sơ của bạn đã hoàn tất rồi.' }, 409);
      }
      throw err;
    } finally {
      client.release();
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * ĐỔI TÊN HIỂN THỊ (founder 04/08: *"phải cho player đổi tên chứ"*)
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Gấp vì cửa KHÁCH cấp tên máy (`khach_p83m0c21`) — đọc được cho máy chủ, không
   * đọc được cho người ngồi cùng bàn. D25: thứ làm trò có sức nặng là đối thủ
   * NHÌN THẤY mình.
   *
   * ⚠ KHÔNG động tới lịch sử: `events` · `holdem_results` · `rank_diem` · `scores`
   * đều neo `user_id`. `handle` chỉ là NHÃN, nên đây là thao tác rẻ và lùi được.
   * ⚠ Dùng lại `validateHandle` của đường onboarding — cùng luật cho mọi handle
   * vào bảng `users` (D25/R2). Viết một bộ kiểm thứ hai ở đây là mở đúng cánh cửa
   * mà blocklist sinh ra để đóng.
   */
  app.post('/api/v1/me/handle', requireAuth, requireOnboarded, async (c) => {
    const actor = c.get('actor');
    const body = await c.req.json().catch(() => null);
    const handle = str(body, 'handle').trim().toLowerCase();
    validateHandle(handle);

    const { rows: cu } = await pool.query(
      `SELECT handle FROM users WHERE user_id = $1`, [actor.userId]);
    const tenCu: string = cu[0]?.handle ?? '';
    // Đổi thành CHÍNH TÊN ĐANG DÙNG: không tiêu một suất, không ghi event. Đây là
    // một thao tác rỗng, và tính nó là một lần đổi thì người gõ lại tên mình bị
    // phạt vì không làm gì cả.
    if (tenCu === handle) return c.json({ ok: true, handle, doi: false });

    /*
     * ⚠ TIÊU SUẤT TRƯỚC KHI ĐỔI, không phải sau khi biết thành công — cùng bài
     * học với `/auth/login` (bản cũ chỉ ghi khi SAI, nên cả loạt request song
     * song đều qua cửa vì chưa ai kịp ghi). Mỗi lần đổi là một lần thả tên cũ ra.
     */
    const suat = await consumeLimit(
      pool, `handle:${actor.userId}`,
      AUTH.HANDLE_DOI_MAX, AUTH.HANDLE_DOI_WINDOW_HOURS * 60,
    );
    if (!suat.allowed) {
      return c.json({
        error: 'rate_limited',
        message: `Bạn đổi tên hơi nhiều rồi. Thử lại sau ${AUTH.HANDLE_DOI_WINDOW_HOURS} giờ nhé.`,
      }, 429);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE users SET handle = $2 WHERE user_id = $1`,
        [actor.userId, handle]);
      /*
       * Cùng transaction với hành động (A7).
       * ⚠ KHÔNG CHỞ TÊN (SPEC chan-truoc-beta, founder 11/10 "A"). Bản cũ ghi `{cu, moi}` để nối hai cái tên — nhưng `events` không
       * xoá được, nên người đã đổi tên thì xoá tài khoản xong vẫn còn đường `user_id` → tên. Dòng chỉ còn nói "đã đổi". Dòng cũ (trước
       * 0.0.66) vẫn chở tên — append-only, không sửa được.
       */
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type, value_json,
                             state_snapshot_json)
         VALUES ($1, 'profile', $2, 'handle_doi', $3, NULL)`,
        [actor.userId, actor.userId, JSON.stringify({ doi: true })],
      );
      await client.query('COMMIT');
      return c.json({ ok: true, handle, doi: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      // UNIQUE(handle) — người khác đang dùng tên đó.
      if ((err as { code?: string }).code === '23505') {
        return c.json(
          { error: 'handle_taken', field: 'handle', message: 'Tên này có người dùng rồi.' },
          409,
        );
      }
      throw err;
    } finally {
      client.release();
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
   * BẬC 1 — HỎI NHÂN KHẨU SAU TRẬN ĐẦU (D64 phương án B)
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Founder 04/08, sau khi bác lý do "age gate vì nội dung": *"game có nội dung
   * người lớn hay cá cược đâu"* — đúng, và cửa này KHÔNG CHẶN AI. Nó chỉ HỎI.
   *
   * ⚠ HAI THỨ KHÁC NHAU, đừng gộp:
   *   · CHẶN dưới 16 — giá trị pháp lý, đang treo ở tờ hỏi luật sư (A10 câu 4).
   *     KHÔNG có ở đây. Đường đăng ký email giữ nguyên cửa cũ của nó.
   *   · HỎI khoảng tuổi — giá trị sản phẩm: A1 nói app cho người Việt 16–30, và
   *     `events` append-only nên **không gắn nhãn lại được về sau**. Không hỏi
   *     hôm nay là vĩnh viễn không biết mọi trận đã chơi là của ai.
   *
   * ⚠ C7: chỉ nhận NĂM sinh và chỉ lưu KHOẢNG. Năm sinh không bao giờ chạm DB —
   * `toAgeBand` chạy ở đây rồi con số gốc rơi khỏi bộ nhớ cùng request.
   */
  /*
   * CÀI ĐẶT (D106, founder 22/08: *"game chưa có phần setting, bạn làm luôn đi"*).
   * Hôm nay đúng MỘT tuỳ chọn: giọng hồ sơ. Khách (bậc 0) cũng đổi được — khách
   * cũng có thẻ để đọc. Giá trị lạ ⇒ 400 có tên trường, không im lặng rơi về mặc
   * định (bấm GEN Z mà thành CHỮNG là màn nói dối).
   */
  app.post('/api/v1/me/cai-dat', requireAuth, requireOnboarded, async (c) => {
    const actor = c.get('actor');
    const body = await c.req.json().catch(() => null) as { giong_ho_so?: unknown } | null;
    const giong = body?.giong_ho_so;
    if (giong !== undefined) {
      if (!GIONG_HO_SO.includes(giong as (typeof GIONG_HO_SO)[number])) {
        return c.json({ error: 'gia_tri_khong_hop_le', field: 'giong_ho_so',
          message: 'Giọng hồ sơ không hợp lệ.' }, 400);
      }
      await pool.query(`UPDATE users SET giong_ho_so = $2 WHERE user_id = $1`,
        [actor.userId, giong]);
    }
    const { rows } = await pool.query(
      `SELECT giong_ho_so, age_band FROM users WHERE user_id = $1`, [actor.userId]);
    return c.json({ ok: true, giong_ho_so: rows[0]?.giong_ho_so ?? 'tu_dong',
      age_band: rows[0]?.age_band ?? null });
  });

  /*
   * CÂU TỰ KHAI (D101 Q4 · D106 bước 6) — xem đầu migration 0044. Mỗi lần trả lời
   * là một dòng; đọc dòng mới nhất. Không thưởng gì. Khách cũng trả lời được.
   */
  app.get('/api/v1/me/tu-khai', requireAuth, async (c) => {
    const actor = c.get('actor');
    if (!actor.userId) return c.json({ rui_ro: null, ts: null });
    const { rows } = await pool.query(
      `SELECT tra_loi, ts FROM tu_khai WHERE user_id = $1 AND cau = 'rui_ro'
        ORDER BY ts DESC, id DESC LIMIT 1`, [actor.userId]);
    const r = rows[0];
    return c.json({ rui_ro: r ? Number(r.tra_loi) : null, ts: r ? new Date(r.ts).toISOString() : null });
  });
  app.post('/api/v1/me/tu-khai', requireAuth, requireOnboarded, async (c) => {
    const actor = c.get('actor');
    const body = await c.req.json().catch(() => null) as { cau?: unknown; tra_loi?: unknown } | null;
    const cau = body?.cau;
    const tl = Number(body?.tra_loi);
    if (cau !== 'rui_ro') {
      return c.json({ error: 'gia_tri_khong_hop_le', field: 'cau', message: 'Câu hỏi không hợp lệ.' }, 400);
    }
    if (!Number.isInteger(tl) || tl < 0 || tl > 10) {
      return c.json({ error: 'gia_tri_khong_hop_le', field: 'tra_loi', message: 'Trả lời phải là số nguyên 0–10.' }, 400);
    }
    await pool.query(`INSERT INTO tu_khai (user_id, cau, tra_loi) VALUES ($1, $2, $3)`,
      [actor.userId, cau, tl]);
    return c.json({ ok: true, rui_ro: tl });
  });

  /**
   * B5 — XÁC NHẬN TUỔI cho khách/Discord (tài khoản email đã qua ở `/auth/register`). Năm sinh KHÔNG lưu (C7): đủ tuổi ⇒ ghi mốc
   * `tuoi_ok_luc`. Dưới tuổi ⇒ 403 `duoi_tuoi`, tài khoản GIỮ nhưng mọi cửa `requireOnboarded` vẫn đóng; gửi lại được (gõ nhầm năm
   * là chuyện thường — cùng lý lẽ `/me/nhan-khau`).
   * ⚠ CỐ Ý KHÔNG ghi `age_band` (SPEC đề xuất "nếu còn trống" — lệch, ghi ở SPEC mục 6): bậc 1 hỏi nhân khẩu (D64) mở theo
   * `age_band IS NULL`, và `/me/nhan-khau` chỉ ghi khi `age_band IS NULL` ⇒ ghi ở đây là tắt vĩnh viễn câu hỏi vùng/nghề của
   * mọi khách. Nhóm tuổi vẫn đến từ tấm nhân khẩu như cũ.
   */
  app.post('/api/v1/me/tuoi', requireAuth, requireHoSo, async (c) => {
    const actor = c.get('actor');
    const body = await c.req.json().catch(() => null);
    const gate = checkAgeGate(int(body, 'birth_year'));
    if (!gate.ok) {
      return c.json(gate.reason === 'under_age'
        ? { error: 'duoi_tuoi', field: 'birth_year',
          message: `Ứng dụng dành cho người từ ${ECONOMY.AGE_GATE_MIN} tuổi.` }
        : { error: 'nam_sinh_khong_hop_le', field: 'birth_year', message: 'Năm sinh không hợp lệ.' },
      gate.reason === 'under_age' ? 403 : 400);
    }
    await pool.query(
      `UPDATE users SET tuoi_ok_luc = COALESCE(tuoi_ok_luc, now()) WHERE user_id = $1`,
      [actor.userId],
    );
    return c.json({ ok: true });
  });

  app.post('/api/v1/me/nhan-khau', requireAuth, requireHoSo, async (c) => {
    const actor = c.get('actor');
    const body = await c.req.json().catch(() => null);

    // BỎ QUA — một câu trả lời hợp lệ, không phải một thất bại. Ghi mốc đã hỏi
    // để không bao giờ hỏi lại người đã từ chối.
    if ((body as { bo_qua?: unknown } | null)?.bo_qua === true) {
      await pool.query(
        `UPDATE users SET nhan_khau_hoi_luc = now()
          WHERE user_id = $1 AND nhan_khau_hoi_luc IS NULL`,
        [actor.userId],
      );
      return c.json({ ok: true, da_luu: false });
    }

    const birthYear = int(body, 'birth_year');
    const region = oneOf(body, 'region', DEMOGRAPHIC.REGIONS);
    const occupationBand = oneOf(body, 'occupation_band', DEMOGRAPHIC.OCCUPATION_BANDS);

    const gate = checkAgeGate(birthYear);
    if (!gate.ok) {
      /*
       * ⚠ KHÔNG ghi mốc "đã hỏi" ở nhánh này, và KHÔNG chặn họ chơi tiếp.
       * Gõ nhầm năm sinh là chuyện thường; đóng cửa vĩnh viễn vì một cú gõ nhầm
       * thì người đó không bao giờ khai lại được nữa. Trả 400 để màn hiện lỗi
       * ngay tại ô, họ sửa rồi gửi lại.
       */
      return c.json({
        error: gate.reason === 'under_age' ? 'duoi_tuoi' : 'nam_sinh_khong_hop_le',
        field: 'birth_year',
        message: gate.reason === 'under_age'
          ? `Ứng dụng dành cho người từ ${ECONOMY.AGE_GATE_MIN} tuổi. Bạn vẫn chơi được, chỉ là phần này bỏ qua nhé.`
          : 'Năm sinh không hợp lệ.',
      }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      /*
       * ⚠ `age_band IS NULL` trong WHERE là chốt chống ghi đè: người đã khai ở
       * đường đăng ký email thì cửa này KHÔNG được sửa nhân khẩu của họ. Đây là
       * cửa "khai lần đầu", không phải cửa "đổi hồ sơ".
       */
      const up = await client.query(
        `UPDATE users
            SET age_band = $2, region = $3, occupation_band = $4, nhan_khau_hoi_luc = now()
          WHERE user_id = $1 AND age_band IS NULL
          RETURNING user_id`,
        [actor.userId, gate.ageBand, region, occupationBand],
      );
      if (up.rowCount === 0) {
        await client.query('ROLLBACK');
        return c.json({ ok: true, da_luu: false });
      }
      /*
       * Cùng transaction với hành động nghiệp vụ (A7). Dùng lại đúng
       * `action_type` mà đường email dùng — hai tên cho cùng một sự kiện là hai
       * cột phải hợp nhất mãi mãi trong mọi truy vấn phân tích.
       * `bac: 1` phân biệt "khai lúc đăng ký" với "khai sau trận đầu": hai hoàn
       * cảnh khác nhau, và độ tin của câu trả lời cũng khác nhau.
       */
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type, value_json,
                             state_snapshot_json)
         VALUES ($1, 'onboarding', $2, 'onboard_demo', $3, NULL)`,
        [
          /*
           * ⚠ Truyền HAI LẦN thay vì dùng lại `$1` — `user_id` là uuid còn
           * `context_id` là text, nên Postgres không suy được một kiểu chung cho
           * cùng một tham số ("inconsistent types deduced for parameter $1") và
           * cả câu nổ lúc CHẠY, không lúc biên dịch. Đường email (dòng ~955) vốn
           * đã làm đúng như vậy.
           */
          actor.userId,
          actor.userId,
          JSON.stringify({
            age_band: gate.ageBand, region, occupation_band: occupationBand, bac: 1,
          }),
        ],
      );
      await client.query('COMMIT');
      return c.json({ ok: true, da_luu: true, age_band: gate.ageBand });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  // =========================================================================
  // Tài khoản (GĐ2 việc 7)
  // =========================================================================

  /**
   * B9 — trần lần gõ MẬT KHẨU HIỆN TẠI, chung một xô cho đổi mật khẩu + xoá tài khoản (`AUTH.MAT_KHAU_THU`). Tiêu suất
   * TRƯỚC khi băm, nếp `/auth/login`: kiểm-rồi-mới-ghi thì cả loạt request song song lọt qua lúc argon2 đang chạy.
   * Trả hàm dựng 429 khi hết suất, `null` khi còn.
   */
  const tieuSuatMatKhau = async (accountId: string) => {
    const kq = await consumeLimit(pool, `mk:${accountId}`, AUTH.MAT_KHAU_THU.MAX, AUTH.MAT_KHAU_THU.CUA_SO_PHUT);
    if (kq.allowed) return null;
    return (c: Context<Env>) => c.json(
      { error: 'rate_limited', message: `Gõ sai mật khẩu quá nhiều lần. Thử lại sau ${AUTH.MAT_KHAU_THU.CUA_SO_PHUT} phút.` },
      429,
      { 'Retry-After': String(kq.retryAfterSeconds || AUTH.MAT_KHAU_THU.CUA_SO_PHUT * 60) },
    );
  };

  app.post('/api/v1/account/password', requireAuth, async (c) => {
    const actor = c.get('actor');
    const body = await c.req.json().catch(() => null);
    const current = str(body, 'current_password');
    const next = str(body, 'new_password', { max: AUTH.PASSWORD_MAX_LENGTH + 1 });
    validatePassword(next);

    const chan = await tieuSuatMatKhau(actor.accountId);
    if (chan) return chan(c);
    const { rows } = await pool.query(
      `SELECT password_hash FROM auth_accounts WHERE account_id = $1`,
      [actor.accountId],
    );
    if (!(await verifyPassword(rows[0].password_hash, current))) {
      return c.json({ error: 'invalid_credentials', message: 'Mật khẩu hiện tại không đúng.' }, 401);
    }
    await pool.query(
      `UPDATE auth_accounts SET password_hash = $1, updated_at = now() WHERE account_id = $2`,
      [await hashPassword(next), actor.accountId],
    );
    // Đổi mật khẩu = đá mọi phiên khác ra (kể cả phiên kẻ trộm)
    await revokeAllSessions(pool, actor.accountId);
    deleteCookie(c, AUTH.SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true, message: 'Đã đổi mật khẩu. Đăng nhập lại nhé.' });
  });

  /**
   * ĐỔI Ý VỀ Ô ĐỒNG Ý DỮ LIỆU.
   *
   * ⚠ Trước 03/08, `research_consent` ghi MỘT LẦN lúc onboarding rồi không có
   * đường nào đổi — tức một lựa chọn về dữ liệu của chính mình bị khoá vĩnh
   * viễn sau một cú bấm ở màn người ta còn chưa hiểu app là gì. Điều khoản §5.4
   * hứa "đổi ý lúc nào cũng được", nên đây là chỗ giữ lời hứa đó.
   *
   * Tắt ⇒ `POST /telemetry` ngừng ghi cho người này NGAY (xem cổng trong
   * `server/telemetry.ts`). Dòng đã ghi trước đó vẫn còn — telemetry có hạn
   * lưu 90 ngày nên nó tự hết, và ta không xoá ngược để tránh đụng một bảng
   * đang có người đọc.
   */
  app.post('/api/v1/account/consent', requireAuth, requireOnboarded, async (c) => {
    const actor = c.get('actor');
    const body = await c.req.json().catch(() => null);
    const dongY = bool(body, 'research_consent');
    /*
     * 0079 (SPEC chan-truoc-beta) — BẬT phải kèm đúng văn bản đang hiện (`nghien_cuu@<bản hiện hành>`), cùng luật bốn cửa PFM: màn
     * gửi bản cũ nghĩa là nó đang hiện chữ cũ. TẮT thì không đòi gì — rút lại không bao giờ là thủ tục. Mỗi lần đổi một vết.
     */
    const vb = body as { van_ban_id?: unknown; phien_ban?: unknown } | null;
    if (dongY && (vb?.van_ban_id !== VAN_BAN_NGHIEN_CUU || !laConsentHienHanh(VAN_BAN_NGHIEN_CUU, vb?.phien_ban))) {
      return c.json({
        error: 'invalid_input', field: 'van_ban_id',
        message: `Bật phải kèm đúng văn bản: ${VAN_BAN_NGHIEN_CUU}@${CONSENT_PHIEN_BAN.nghien_cuu}.`,
      }, 400);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await datNghienCuu(client, actor.userId!, dongY, dongY ? CONSENT_PHIEN_BAN.nghien_cuu : null);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    return c.json({
      ok: true,
      research_consent: dongY,
      message: dongY
        ? 'Cảm ơn bạn. Dữ liệu dùng app của bạn sẽ giúp tụi mình sửa chỗ khó chịu.'
        : 'Đã tắt. Từ giờ tụi mình ngừng ghi lại cách bạn dùng app.',
    });
  });

  /**
   * Xóa tài khoản = ẨN DANH HÓA (không xóa events/ledger — A3.3 append-only,
   * và events là sản phẩm): xóa email/mật khẩu/phiên, đổi handle thành ẩn danh,
   * đánh dấu users.deleted_at. Hồ sơ demographic ở lại phục vụ nghiên cứu ẩn danh
   * đúng như điều khoản đã ghi.
   */
  /**
   * B6 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — GỠ LIÊN KẾT DISCORD. Trước bản này gắn Discord là gắn vĩnh viễn (SPEC pháp lý D2
   * hứa xoá được định danh ngoài). Ba nhánh, theo thứ tự:
   *   · chưa gắn ⇒ 404;
   *   · tài khoản KHÔNG mật khẩu (vào thẳng từ Discord / khách nâng cấp) ⇒ 409 — gỡ là tự khoá mình ngoài; lối ra là xoá tài
   *     khoản (B4) hoặc đặt mật khẩu trước;
   *   · có mật khẩu ⇒ gõ lại (cùng xô `mk:` của B9): phiên bị mượn không đủ để cắt một đường đăng nhập của chủ.
   * Nonce/state cho đường GẮN qua SDK là Ý chờ (SameSite=Lax + B7 đã che POST chéo trang).
   */
  app.post('/api/v1/auth/discord/go', requireAuth, async (c) => {
    const actor = c.get('actor');
    const body = await c.req.json().catch(() => null) as { password?: unknown } | null;
    const { rows } = await pool.query(
      `SELECT a.password_hash,
              EXISTS (SELECT 1 FROM auth_identities i
                       WHERE i.account_id = a.account_id AND i.provider = $2) AS co_discord
         FROM auth_accounts a WHERE a.account_id = $1`,
      [actor.accountId, NHA_CUNG_CAP],
    );
    if (rows[0]?.co_discord !== true) {
      return c.json({ error: 'chua_lien_ket_discord', message: 'Tài khoản chưa gắn Discord.' }, 404);
    }
    const hash = rows[0].password_hash as string | null; // null = vào thẳng từ Discord / khách nâng cấp
    if (hash === null) {
      return c.json({
        error: 'khong_con_duong_dang_nhap',
        message: 'Discord là đường đăng nhập duy nhất của tài khoản này — gỡ thì không vào lại được.',
      }, 409);
    }
    const chan = await tieuSuatMatKhau(actor.accountId);
    if (chan) return chan(c);
    if (typeof body?.password !== 'string' || !(await verifyPassword(hash, body.password))) {
      return c.json({ error: 'invalid_credentials', message: 'Mật khẩu không đúng.' }, 401);
    }
    await pool.query(
      `DELETE FROM auth_identities WHERE account_id = $1 AND provider = $2`, [actor.accountId, NHA_CUNG_CAP]);
    return c.json({ ok: true });
  });

  app.post('/api/v1/account/delete', requireAuth, async (c) => {
    const actor = c.get('actor');
    const body = await c.req.json().catch(() => null) as { password?: unknown; xac_nhan?: unknown } | null;

    const chan = await tieuSuatMatKhau(actor.accountId);
    if (chan) return chan(c);
    const { rows } = await pool.query(
      `SELECT password_hash FROM auth_accounts WHERE account_id = $1`,
      [actor.accountId],
    );
    const hash = rows[0].password_hash as string | null;
    if (hash === null) {
      /*
       * B4 — KHÁCH / DISCORD: không có mật khẩu để gõ, nên trước bản vá `verifyPassword(null, …)` luôn false ⇒ họ KHÔNG
       * BAO GIỜ tự xoá được (trái điều khoản "Xoá tài khoản ở cuối Hồ sơ" + quyền xoá 20 ngày — SPEC pháp lý R6). Thứ
       * chứng minh "chính chủ" ở đây là PHIÊN HIỆN TẠI (`requireAuth`) — cũng là thứ duy nhất họ có; `XOA` chỉ chặn
       * bấm nhầm, đúng chữ hoa không dấu cho bàn phím nào cũng gõ được.
       */
      if (body?.xac_nhan !== 'XOA') {
        return c.json({ error: 'thieu_xac_nhan', message: 'Gõ XOA để xác nhận xoá tài khoản.' }, 400);
      }
    } else if (typeof body?.password !== 'string' || !(await verifyPassword(hash, body.password))) {
      // Có mật khẩu ⇒ phải gõ mật khẩu; `xac_nhan` không thay được nó (phiên bị mượn không đủ để xoá).
      return c.json({ error: 'invalid_credentials', message: 'Mật khẩu không đúng.' }, 401);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (actor.userId) {
        /*
         * ⚠⚠ XOÁ DỮ LIỆU PFM TRƯỚC KHI ẨN DANH HOÁ — P9 🔒.
         *
         * Trước bản này, đường xoá tài khoản chỉ đổi `handle` + đặt `deleted_at`, và
         * KHÔNG chạm một bảng `pfm_*` nào. Nghĩa là dữ liệu tài chính của người vừa
         * yêu cầu xoá vẫn nằm nguyên — mà route xoá PFM riêng thì họ không còn cửa
         * nào gọi (tài khoản đã đi rồi). Một lỗ IM LẶNG: không ai thấy, cho tới ngày
         * có người hỏi "dữ liệu của tôi đâu".
         *
         * ⚠ MỘT HÀM, HAI LỐI VÀO (D61): route `/pfm` và chỗ này gọi CÙNG
         * `xoaSachPfm`. Hai bản cài đặt của cùng một việc thì bản thứ hai sẽ trôi, và
         * ở đây "trôi" nghĩa là xoá SÓT dữ liệu nhạy cảm.
         *
         * ⚠ Chỉ xoá phần SERVER giữ (két đã khoá · bảng điểm · token · cúp · đặc
         * trưng). Sổ thô nằm ở máy user, không bao giờ trong tầm với của server
         * (P2 🔒) — muốn xoá nó thì xoá trên máy.
         */
        await xoaSachPfm(client, actor.userId);
        /*
         * 0079 (SPEC chan-truoc-beta, agent tự quyết — founder đổi được lúc CHỐT): telemetry KHÔNG append-only (A9) ⇒ xoá hẳn dòng của
         * người này; báo lỗi chở chữ họ tự gõ ⇒ xoá hẳn. `events` thì ở lại (A3.3) dưới `user_id` đã mất đường về email/tên.
         */
        await client.query(`DELETE FROM telemetry WHERE user_id = $1`, [actor.userId]);
        await client.query(`DELETE FROM bao_loi WHERE user_id = $1`, [actor.userId]);
        await client.query(
          `UPDATE users
              SET handle = 'da_xoa_' || substr(replace(user_id::text, '-', ''), 1, 12),
                  deleted_at = now()
            WHERE user_id = $1 AND deleted_at IS NULL`,
          [actor.userId],
        );
      }
      // Xóa danh tính đăng nhập: email biến mất; sessions/tokens cascade theo
      await client.query(`DELETE FROM auth_accounts WHERE account_id = $1`, [actor.accountId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    deleteCookie(c, AUTH.SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true, message: 'Tài khoản đã xóa. Dữ liệu nghiên cứu được giữ ở dạng ẩn danh.' });
  });

  /** Quên mật khẩu — luôn trả 202 (không tiết lộ email có tồn tại hay không). */
  app.post('/api/v1/auth/forgot-password', async (c) => {
    const body = await c.req.json().catch(() => null);
    const email = normalizeEmail(str(body, 'email'));

    /*
     * ⚠⚠ CỬA NÀY GỬI MỘT EMAIL THẬT MỖI LẦN GỌI, VÀ TRƯỚC 12/08 KHÔNG CÓ MỘT
     * LỚP CHẶN TẦN SUẤT NÀO. Repo có sẵn cơ chế và dùng ở năm chỗ (admin, đăng
     * ký, khách, đăng nhập, đổi tên) — riêng route này chưa bao giờ được nối vào,
     * và `config/auth.ts` cũng không có hằng số nào cho nó, tức chưa từng ai định.
     *
     * ⚠ HẬU QUẢ DÂY CHUYỀN MỚI LÀ PHẦN ĐÁNG LO, không phải mấy cái thư rác: đốt
     * hết hạn ngạch SMTP thì hàm gửi thư ở `/auth/register` NÉM ⇒ 500, nhưng
     * hàng tài khoản ĐÃ ghi và suất rate-limit IP ĐÃ tiêu trước đó. Người thật
     * đăng ký xong ôm một tài khoản chưa xác minh, không nhận được thư, mất suất,
     * và repo KHÔNG có endpoint gửi lại thư xác minh nào ⇒ cửa đăng ký chết suốt
     * Beta. Kèm theo: domain gửi thư bị báo spam — thứ KHÔNG sửa được bằng deploy.
     *
     * ⚠ ĐẾM CẢ HAI CHIỀU, và đây là chỗ dễ đổi một lỗ lấy một lỗ: chặn theo IP
     * thôi thì kẻ xoay IP vẫn dội thư vào một nạn nhân; chặn theo EMAIL thôi thì
     * ai cũng tiêu hết suất của người khác để họ KHÔNG reset được mật khẩu. Nên
     * đếm cả hai, và **luôn trả 202 dù chặn hay không** — bản thân mã trả về
     * cũng không được biến thành máy dò email nào có thật.
     */
    const chan = await tieuHanMucIp(
      pool, c, deps.proxySecret, 'quenmk',
      AUTH.QUEN_MK_MAX_PER_IP, AUTH.QUEN_MK_WINDOW_PHUT,
    );
    const chanEmail = email
      ? await consumeLimit(
        pool, `quenmk:email:${email.slice(0, 120)}`,
        AUTH.QUEN_MK_MAX_PER_EMAIL, AUTH.QUEN_MK_WINDOW_PHUT,
      )
      : { allowed: false, retryAfterSeconds: 0 };
    if (!chan.allowed || !chanEmail.allowed) {
      return c.json({
        ok: true,
        message: 'Nếu email tồn tại, tụi mình đã gửi liên kết đặt lại mật khẩu.',
      }, 202);
    }

    const { rows } = await pool.query(
      `SELECT account_id FROM auth_accounts WHERE email = $1`,
      [email],
    );
    if (rows.length > 0) {
      const raw = generateToken();
      await pool.query(
        `INSERT INTO auth_tokens (token_hash, account_id, purpose, expires_at)
         VALUES ($1, $2, 'reset_password', now() + ($3 || ' hours')::interval)`,
        [hashToken(raw), rows[0].account_id, AUTH.RESET_TOKEN_TTL_HOURS],
      );
      await mailer.send(resetPasswordMail(email, `${deps.appBaseUrl}/reset-password?token=${raw}`));
    }
    return c.json({ ok: true, message: 'Nếu email tồn tại, thư đặt lại mật khẩu đã được gửi.' }, 202);
  });

  app.post('/api/v1/auth/reset-password', async (c) => {
    const body = await c.req.json().catch(() => null);
    const token = str(body, 'token');
    const next = str(body, 'new_password', { max: AUTH.PASSWORD_MAX_LENGTH + 1 });
    validatePassword(next);

    const { rows } = await pool.query(
      `UPDATE auth_tokens SET used_at = now()
        WHERE token_hash = $1 AND purpose = 'reset_password'
          AND used_at IS NULL AND expires_at > now()
        RETURNING account_id`,
      [hashToken(token)],
    );
    if (rows.length === 0) {
      return c.json({ error: 'invalid_token', message: 'Liên kết đặt lại không đúng hoặc đã hết hạn.' }, 400);
    }
    const accountId: string = rows[0].account_id;
    await pool.query(
      `UPDATE auth_accounts
          SET password_hash = $1,
              email_verified_at = COALESCE(email_verified_at, now()),
              updated_at = now()
        WHERE account_id = $2`,
      [await hashPassword(next), accountId],
    );
    /*
     * B11 — MỌI link đặt lại khác của tài khoản này chết theo. Trước bản vá chỉ link vừa dùng bị đánh dấu; link thứ hai
     * (thư cũ, hoặc kẻ đã xin trước) sống tới hết hạn và đổi được mật khẩu ngay sau khi chủ vừa giành lại tài khoản.
     */
    await pool.query(
      `UPDATE auth_tokens SET used_at = now()
        WHERE account_id = $1 AND purpose = 'reset_password' AND used_at IS NULL`,
      [accountId],
    );
    await revokeAllSessions(pool, accountId);
    return c.json({ ok: true, message: 'Đã đặt lại mật khẩu. Đăng nhập lại nhé.' });
  });

  // K5 (Q4 = A) — `GET /api/v1/admin/ping` (chỉ test gọi) ĐÃ XOÁ; ba bậc cửa admin canh qua `/api/v1/admin/quyen` (`tests/auth.test.ts`).

  // =========================================================================
  // Chợ kèo + đặt cược (GĐ3) — server/markets.ts
  // =========================================================================
  registerMarketRoutes(app, pool, { requireAuth, requireOnboarded });

  // =========================================================================
  // Oracle Level + Bậc dự báo — server/progression.ts
  // CHỈ SỐ DẪN XUẤT: không bảng mới, không XP lưu, không thứ gì tiêu được.
  // Tính lại từ bets/markets/holdem_results/rank_snapshots mỗi request.
  // =========================================================================
  registerProgressionRoutes(app, pool, requireAuth, requireOnboarded, chanKhach);

  // =========================================================================
  // Trợ cấp sàn (GĐ4) — server/subsidy.ts
  // =========================================================================
  registerSubsidyRoutes(app, pool, { requireAuth, requireOnboarded, chanKhach });
  // PFM (05b Phụ lục T2, GĐ1) — nối tầng nghiệp vụ đã có (ngay/token/xoa/ket) ra
  // HTTP thật; K9 đòi chanKhach trên MỌI route, cùng cửa với trợ cấp ở trên.
  registerPfmRoutes(app, pool, { requireAuth, requireOnboarded, chanKhach });

  /*
   * ⚠ ĐẤU TRƯỜNG SANDBOX (GĐ4.5) ĐÃ GỠ 11/08 — xem D81.
   *
   * D40 (27/07) thay hẳn mô hình sandbox bằng engine NAV, và từ đó `/arena/*`
   * không còn một đường vào nào từ UI. Nhưng 7 endpoint vẫn ĐĂNG KÝ, vẫn nhận
   * request, và vẫn GHI VÀO `events` — bảng append-only (A3.3), tức rác đổ vào
   * là nằm đó vĩnh viễn và chiếm chỗ của dữ liệu thật (A1).
   *
   * Một engine trò chơi thứ hai còn sống mà không ai chơi cũng là bề mặt tấn
   * công không ai canh: nó có đường ghi DB mà không nằm trong tầm mắt của bất
   * kỳ ai đang phát triển đấu trường NAV.
   */

  // =========================================================================
  // Diện mạo (avatar · khung viền · phụ kiện) — server/avatar.ts
  // Tách khỏi đường tiền hoàn toàn: không đụng bankroll, không đụng
  // quest_points. Trang bị là một chuỗi 19 ký tự trên `users`, sở hữu nằm ở
  // `user_cosmetics` — và `user_cosmetics` không có đường nào đổi chủ (0009).
  // =========================================================================
  registerAvatarRoutes(app, pool, {
    requireAuth, requireOnboarded, requireAdmin, requireXacThucLai,
  });

  // =========================================================================
  // Shop (0015) — HAI CỬA TÁCH HẲN: Q niêm yết (nền · khung) · T quay hộp (nhãn
  // dán, đốt 100%). Đây là chỗ DUY NHẤT trong repo tiêu Q, và là chỗ duy nhất
  // ngoài kèo tiêu T. Không món nào đứng ở cả hai cửa (A3.5 — xem server/shop.ts).
  //
  // ⚠ ĐĂNG KÝ SAU `registerArenaRoutes` LÀ CÓ Ý: ba stub 403 của `/shop/*` đã
  // được gỡ khỏi arena_api.ts, và nếu ai đó thêm lại thì cửa thật này bị bịt im
  // lặng (Hono khớp route đầu tiên). Test `shop.test.ts` gọi thẳng HTTP nên nó
  // đỏ ngay nếu chuyện đó xảy ra.
  // =========================================================================
  registerShopRoutes(app, pool, { requireAuth, requireOnboarded });
  registerChoRoutes(app, pool, { requireAuth, requireOnboarded });

  // =========================================================================
  // Market Hold'em (lát 1) — server/holdem_api.ts. Codename nội bộ; người
  // chơi thấy "Đấu trường" (D26). Loop 3 nhịp thay loop phân bổ của GĐ4.5.
  // Cùng tường lửa: chip ảo trong trận, không đụng bankroll/quest_points.
  // =========================================================================
  registerHoldemRoutes(app, pool, {
    requireAuth, requireOnboarded,
  }, { tranNgaySuat: tranNgayHieuLuc(deps.tranNgaySuat) });

  // =========================================================================
  // Xếp hạng Đấu trường (0017) — điểm CHUYỂN NHƯỢNG zero-sum theo bàn, bậc dẫn
  // xuất từ điểm, bảng đọc từ snapshot. Không endpoint nào trả điểm của người
  // khác ngoài bảng xếp hạng (D25/R4: hiện BẬC, không hiện ĐIỂM).
  // =========================================================================
  registerRankRoutes(app, pool, { requireAuth, requireOnboarded });
  registerRankGhepRoutes(app, pool, { requireAuth, requireOnboarded });

  // =========================================================================
  // ĐO LƯỜNG VẬN HÀNH (A9) — bảng `telemetry`, KHÔNG phải `events`.
  //
  // ⚠ Phép thử A9 (*"dòng này có tiền hoặc có niềm tin trong đó không?"*) trả
  // lời KHÔNG cho mọi thứ đi qua cửa này: thời gian màn hình, phễu, lỗi client.
  // Cửa duy nhất người CHƯA đăng nhập ghi được vào DB ⇒ có rate limit riêng.
  // =========================================================================
  registerTelemetryRoutes(app, pool, {
    optionalAuth,
    clientIp: (c: any) => clientIp(c, deps.proxySecret),
  });

  // LỖI CLIENT ẨN DANH (SPEC bao-loi-nguoi-choi) — không auth, không DB ghi, chỉ chuông Sentry mang mã · màn · bản.
  registerLoiClientAnDanhRoutes(app, pool, {
    baoLoi: kenhBaoLoi,
    hanMucIp: (c: any, tienTo: string, tran: number, phut: number) =>
      tieuHanMucIp(pool, c, deps.proxySecret, tienTo, tran, phut),
  });

  // SPEC chan-truoc-beta — "Dữ liệu của tôi" (xem + tải tệp) và Báo lỗi của người chơi. Xem `server/du_lieu_cua_toi.ts`.
  registerDuLieuCuaToiRoutes(app, pool, { requireAuth, requireOnboarded, requireAdmin, baoLoi: kenhBaoLoi });

  // =========================================================================
  // Cửa Discord (bản yêu cầu 02, mùa 0.0) — server/discord.ts
  // Vắng biến môi trường ⇒ endpoint trả 503, KHÔNG mở toang. Fail-closed cùng
  // kỷ luật với CORS của D57: quên đặt biến phải là "đóng", không phải "mở".
  // =========================================================================
  registerDiscordRoutes(app, pool, {
    cauHinh:
      deps.discordClientId && deps.discordClientSecret
        ? { clientId: deps.discordClientId, clientSecret: deps.discordClientSecret }
        : null,
    // Dùng đúng hàm mà luồng onboarding web dùng (dòng ~815) — hai nguồn cho
    // cùng một mùa là hai nguồn sẽ có ngày lệch nhau.
    seasonId: currentSeasonId(),
    // ⚠ `createSession` neo vào `account_id`, KHÔNG phải `user_id` — hai thứ đều
    // là uuid nên đưa nhầm vẫn qua khoá ngoại rồi sai im lặng.
    taoPhien: (accountId: string) => createSession(pool, accountId),
    clientIp: (c: any) => clientIp(c, deps.proxySecret),
    /*
     * Cho cửa Discord nhìn thấy phiên KHÁCH đang gọi, để nó GẮN danh tính vào
     * chính tài khoản đó thay vì đẻ tài khoản thứ hai cho cùng một người
     * (`events` append-only ⇒ không gộp lại được, D64 luật 3).
     * Dùng lại `docTokenPhien` + `resolveSession` — không tự chế đường đọc phiên
     * thứ hai để có ngày lệch với đường chính.
     */
    phienHienTai: async (c: any) => {
      const raw = docTokenPhien(c);
      if (!raw) return null;
      const actor = await resolveSession(pool, raw);
      return actor ? { accountId: actor.accountId, laKhach: actor.laKhach } : null;
    },
  });

  // =========================================================================
  // Admin: vòng đời kèo + dashboard (GĐ4) — server/admin.ts; trang công cụ
  // nội bộ server-render (KHÔNG phải UI sản phẩm GĐ5)
  // =========================================================================
  /*
   * Cửa 2FA phải đăng ký TRƯỚC các route admin khác về mặt đọc hiểu: nó là bậc
   * DUY NHẤT dùng `chiAdmin` (không đòi 2FA), nên nó là đường vào cho lần ghi
   * danh đầu tiên. Không có nó thì bật 2FA = khoá vĩnh viễn admin duy nhất.
   */
  registerAdminBaoMatRoutes(app, pool, { requireAuth, requireOnboarded, chiAdmin });
  // Uỷ quyền admin (D208) — đòi `requireXacThucLai` vì nó tạo ra một người có
  // thể chuyển token của người chơi, cùng hạng với resolve/cancel kèo.
  registerAdminQuyenRoutes(app, pool,
    { requireAuth, requireOnboarded, requireAdmin, requireXacThucLai });
  registerAdminThongKeRoutes(app, pool, { requireAuth, requireOnboarded, requireAdmin });
  // D335 — app quản trị riêng: khoảng thời gian · dòng thời gian một người · phân khúc.
  registerAdminPhanTichRoutes(app, pool, { requireAuth, requireOnboarded, requireAdmin });
  // D341 — khu SẢN PHẨM (năm mặt `/tk/*`) đọc theo khoảng ngày, cùng bảy luật nối dây của D335.
  registerAdminSanPhamRoutes(app, pool, { requireAuth, requireOnboarded, requireAdmin, hanhVi: hanhViDeps });
  // D362 — khu TESTER: mặt DUY NHẤT trả dòng theo người, và chỉ cho người đã vào bằng link
  // bàn buổi đo + bấm văn bản bản hiện hành. Khoá là `ma_tham_gia`, không danh tính.
  registerAdminDotThuRoutes(app, pool, { requireAuth, requireOnboarded, requireAdmin });
  // Kho dữ liệu thô (D209) — CHỈ ĐỌC, cùng cửa `requireAdmin` với thống kê.
  // Không đi qua `requireXacThucLai`: nó không ghi gì, mà bắt nhập lại mã cho
  // một thao tác đọc là cách nhanh nhất khiến người ta thôi mở nó ra xem.
  registerAdminKhoRoutes(app, pool, { requireAuth, requireOnboarded, requireAdmin });
  // Suất trận (SPEC tran-tran-ngay) — nửa số DB biết; nửa kia ở Worker `/api/v1/_suat`. Cả hai vẽ ở `/admin`.
  registerSuatTranAdmin(app, pool, { requireAuth, requireOnboarded, requireAdmin });
  registerAdminKinhTeRoutes(app, pool, { requireAuth, requireOnboarded, requireAdmin });
  registerAdminRoutes(app, pool, {
    requireAuth, requireOnboarded, requireAdmin, requireXacThucLai,
  });
  // Tiện dụng quản kèo (bước 4) — tách khỏi admin.ts theo ranh giới "an toàn"
  // vs "không hoàn tác được"; ranh giới đó quyết route nào qua cửa nặng.
  registerAdminKeoRoutes(app, pool, {
    requireAuth, requireOnboarded, requireAdmin, requireXacThucLai,
  });
  // TESTER MODE (0052) — cheat cho tài khoản thử nghiệm; tự gác thêm bằng
  // requireTester bên trong server/admin_tester.ts (role=admin CHƯA đủ).
  registerAdminTesterRoutes(app, pool, {
    requireAuth, requireOnboarded, requireAdmin, requireXacThucLai,
  });
  /*
   * CSP CHO TRANG /admin — soạn theo đúng những gì trang này thật sự dùng (đã
   * kiểm kê: 1 khối <script> inline, 1 khối <style>, 19 `onclick=`, 25 `style=`,
   * 0 tài nguyên từ domain ngoài, 15 lời gọi fetch đều tương đối).
   *
   * ⚠⚠ `'unsafe-inline'` Ở ĐÂY LÀ BẮT BUỘC, KHÔNG PHẢI LƯỜI. Dùng nonce hoặc hash
   * thì trình duyệt BỎ QUA `'unsafe-inline'`, mà nonce/hash không bao giờ cho
   * phép `onclick=` ⇒ cả 19 nút chết trong khi trang vẫn hiện đầy đủ. Đó là dạng
   * hỏng tệ hơn trang trắng: nhìn như đang chạy, kể cả nút mở khoá 2FA. Cùng lý
   * do: KHÔNG thêm `require-trusted-types-for` — nó chặn 14 chỗ `innerHTML` và
   * giết `loadTfa()` ngay lúc tải, tức khoá admin ra ngoài.
   *
   * ⇒ Giá trị thật của CSP này KHÔNG phải chặn XSS thực thi (nó không chặn
   * được), mà là chặn RÒ RỈ ra ngoài (`default-src 'none'` + `connect-src 'self'`
   * + `form-action 'none'` + `base-uri 'none'`) và chống CLICKJACKING
   * (`frame-ancestors 'none'`) — đáng giá vì trang này có nút resolve/huỷ kèo
   * không hoàn tác được.
   *
   * ⚠ ĐẶT CHO CẢ HAI NHÁNH, kể cả nhánh 403. Bản đầu chỉ đặt ở handler cuối, nên
   * trang từ chối (cũng là HTML, cũng có `style=` inline) rơi vào CSP mặc định
   * `default-src 'none'` và mất sạch style ⇒ chữ sáng trên nền trắng. Đúng lớp
   * "chữ đen nền tối" đã dính ở D74.
   */
  const CSP_ADMIN = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');

  // Trang HTML → dùng guard chuyển hướng, KHÔNG phải guard JSON.
  app.get('/admin', requireAuthPage, requireOnboardedPage, async (c, next) => {
    c.header('Content-Security-Policy', CSP_ADMIN);
    const actor = c.get('actor') as SessionActor;
    if (actor.role !== 'admin') {
      return c.html('<meta charset="utf-8"><body style="background:#04070d;color:#e8f6ff;'
        + 'font:15px ui-monospace,monospace;padding:24px">Trang này chỉ dành cho quản trị. '
        + '<a href="/" style="color:#22d3ee">Về trang chủ</a></body>', 403);
    }
    await next();
  }, (c) => c.html(ADMIN_HTML));

  app.notFound((c) => c.json({ error: 'not_found', message: 'Không có endpoint này.' }, 404));

  return app;
}
