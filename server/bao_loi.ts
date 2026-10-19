/**
 * KÊNH BÁO LỖI — adapter mỏng, MỘT nơi duy nhất biết "báo lỗi ra ngoài" nghĩa là gì.
 *
 * ─── VÌ SAO TỒN TẠI (D93, 16/08) ─────────────────────────────────────────────
 * Founder hỏi *"nếu server xử lý bị sập thì game có tiếp tục chạy không?"* Rà
 * ra: `@sentry/node` nằm trong package.json từ GĐ0, `SENTRY_DSN` được ghi trong
 * `.env.example` và `docs/deploy_gd0.md` ("copy DSN → đặt env → redeploy") —
 * mà KHÔNG MỘT DÒNG CODE NÀO đọc biến đó. Ai đọc tài liệu sẽ tưởng đặt env là
 * xong. Lỗi server đi `console.error` ⇒ Vercel logs ⇒ không ai được báo. Một
 * cơn bão 500 ở `/rounds` trong khi `/health` vẫn 200 là VÔ HÌNH cho tới khi
 * có người mở dashboard đọc `loi_api`. Founder chốt: *"báo thẳng cho tôi"*.
 *
 * ─── VÌ SAO LÀ ADAPTER, KHÔNG IMPORT SENTRY THẲNG (A8.9) ──────────────────────
 * Founder: *"không để lại nợ kỹ thuật để sau này khi có tiền mua server không
 * phải nhìn lại đống rác"*. Nghiệp vụ chỉ biết `KenhBaoLoi.bao(err, {noi})`.
 * File này KHÔNG import `@sentry/node`: nó nhận một `SdkBaoLoi` — bốn hàm — do
 * điểm vào prod (`api/index.ts`) tiêm. Đổi Sentry → Datadog/Axiom/tự host là
 * viết một shim 20 dòng thoả `SdkBaoLoi` và đổi một dòng import ở điểm vào;
 * `server/` không đổi. Test tiêm sdk giả, không mạng, không tài khoản.
 *
 * ─── BA LUẬT CỦA KÊNH ─────────────────────────────────────────────────────────
 * 1. KHÔNG DSN ⇒ IM. dev/test/CI chạy y hệt trước D93; không đòi tài khoản.
 * 2. KHÔNG BAO GIỜ NÉM. Chuông báo cháy mà tự bốc cháy thì che mất lỗi gốc —
 *    `bao()`/`xa()` nuốt mọi lỗi của chính nó và chỉ `console.error`.
 * 3. TẮT AUTO-INSTRUMENT. `defaultIntegrations: false` + `tracesSampleRate: 0`:
 *    không để SDK vá `pg`/`http` qua OpenTelemetry (không rõ tương tác với pool
 *    `max: 1` — D65 — và cold start serverless), không gửi PII (`sendDefaultPii:
 *    false`, C7). Ta chỉ cần captureException + nhãn tự đặt.
 *
 * ─── SERVERLESS PHẢI XẢ ─────────────────────────────────────────────────────
 * Sentry gửi bất đồng bộ; Vercel đóng băng process ngay sau khi response đi.
 * Không `await xa()` trước khi trả 500 thì event nằm lại trong một process sắp
 * ngủ — chuông có nối dây mà không kêu. `app.onError` gọi `xa` với hạn ngắn.
 */

export interface BoiCanhLoi {
  /** Nơi lỗi nổ — `METHOD /đường` cho request, `'tick'`, `'backup'`… Dùng làm nhãn lọc. */
  noi: string;
  /** Nhãn phụ (status, user id nội bộ, match id…). Giá trị được ép về chuỗi. KHÔNG bỏ PII vào đây (C7). */
  nhan?: Record<string, string | number | boolean | null | undefined>;
}

export interface KenhBaoLoi {
  /** Ghi nhận một lỗi. Không bao giờ ném. */
  bao(err: unknown, ctx: BoiCanhLoi): void;
  /**
   * Gửi một TIẾNG CHUÔNG không mang lỗi gốc — chỉ một tên + nhãn mã (SPEC bao-loi-nguoi-choi). Dùng cho lỗi client ẩn
   * danh và chuông "có báo lỗi mới". ⚠ Nhãn ở đây đi thẳng ra dịch vụ ngoài: chỉ MÃ (mã lỗi · mẫu route · số bản),
   * KHÔNG mã tài khoản, email, chữ người gõ (C7). Không bao giờ ném.
   */
  baoMa(ten: string, nhan: Record<string, string>, vanTay?: string): void;
  /** Đẩy hàng đợi ra ngoài trước khi function kết thúc. Không có gì ⇒ về ngay. Không bao giờ ném. */
  xa(hanMs?: number): Promise<void>;
  /** Có nối ra dịch vụ ngoài không — `/health` khai để kiểm cấu hình prod. */
  readonly noiRaNgoai: boolean;
}

/**
 * Bề mặt SDK tối thiểu adapter cần. Khớp `@sentry/node` v8+ (init ·
 * captureException(err, hint) · flush) nhưng KHÔNG import nó — xem đầu file.
 */
export interface SdkBaoLoi {
  init(o: {
    dsn: string;
    environment?: string | undefined;
    release?: string | undefined;
    defaultIntegrations: false;
    tracesSampleRate: 0;
    sendDefaultPii: false;
  }): void;
  captureException(err: unknown, hint?: { tags?: Record<string, string> }): unknown;
  /** `@sentry/node` captureMessage(message, captureContext) — dùng cho `baoMa`. */
  captureMessage(
    msg: string,
    ctx?: { level?: 'error' | 'warning' | 'info'; tags?: Record<string, string>; fingerprint?: string[] },
  ): unknown;
  flush(hanMs?: number): Promise<boolean>;
}

export interface CauHinhBaoLoi {
  dsn?: string | undefined;
  /** production / preview / dev — Vercel có sẵn `VERCEL_ENV`. */
  moiTruong?: string | undefined;
  /** Mã commit — Vercel có sẵn `VERCEL_GIT_COMMIT_SHA`. */
  phienBan?: string | undefined;
}

const HAN_XA_MAC_DINH_MS = 1500;

/** Kênh IM — console.error như trước D93, không nối ra ngoài. */
export const KENH_IM: KenhBaoLoi = {
  bao(err, ctx) {
    console.error(`[bao_loi] ${ctx.noi}`, err);
  },
  baoMa(ten, nhan) {
    console.error(`[bao_loi] ${ten}`, nhan);
  },
  async xa() { /* không có gì để đẩy */ },
  noiRaNgoai: false,
};

function chuoiHoaNhan(nhan: BoiCanhLoi['nhan']): Record<string, string> {
  const ra: Record<string, string> = {};
  if (!nhan) return ra;
  for (const [k, v] of Object.entries(nhan)) {
    if (v === undefined || v === null) continue;
    ra[k] = String(v);
  }
  return ra;
}

/**
 * Dựng kênh. Không DSN, hoặc không tiêm sdk ⇒ `KENH_IM` (không ném, không im
 * lặng hoàn toàn: khi CÓ DSN mà THIẾU sdk thì kêu một lần ra console — cấu hình
 * nửa vời phải nhìn thấy được, không phải một chuông tưởng đã bật).
 */
export function taoKenhBaoLoi(cauHinh: CauHinhBaoLoi, sdk?: SdkBaoLoi): KenhBaoLoi {
  const dsn = cauHinh.dsn?.trim();
  if (!dsn) return KENH_IM;
  if (!sdk) {
    console.error('[bao_loi] Có SENTRY_DSN nhưng điểm vào không tiêm SDK — kênh báo lỗi đang IM. Xem api/index.ts.');
    return KENH_IM;
  }

  try {
    sdk.init({
      dsn,
      environment: cauHinh.moiTruong,
      release: cauHinh.phienBan,
      defaultIntegrations: false,
      tracesSampleRate: 0,
      sendDefaultPii: false,
    });
  } catch (e) {
    console.error('[bao_loi] init thất bại — rơi về kênh im', e);
    return KENH_IM;
  }

  return {
    bao(err, ctx) {
      // Vẫn in ra console: Vercel logs là đường đọc thứ hai khi Sentry hết hạn mức.
      console.error(`[bao_loi] ${ctx.noi}`, err);
      try {
        sdk.captureException(err, { tags: { noi: ctx.noi, ...chuoiHoaNhan(ctx.nhan) } });
      } catch (e) {
        console.error('[bao_loi] captureException ném — bỏ qua, không che lỗi gốc', e);
      }
    },
    baoMa(ten, nhan, vanTay) {
      console.error(`[bao_loi] ${ten}`, nhan);
      try {
        // fingerprint mặc định theo tên + mã lỗi: cùng một cú sập ở trăm máy gộp thành MỘT issue, không đốt trăm dòng hạn
        // mức. `vanTay` riêng ⇒ mỗi lần một issue mới ⇒ Sentry gửi thư mỗi lần (chuông "có báo lỗi mới").
        sdk.captureMessage(ten, { level: 'error', tags: { ...nhan }, fingerprint: [ten, vanTay ?? nhan.ma ?? nhan.ma_loi ?? ten] });
      } catch (e) {
        console.error('[bao_loi] captureMessage ném — bỏ qua', e);
      }
    },
    async xa(hanMs = HAN_XA_MAC_DINH_MS) {
      try {
        await sdk.flush(hanMs);
      } catch (e) {
        console.error('[bao_loi] flush ném — bỏ qua', e);
      }
    },
    noiRaNgoai: true,
  };
}
