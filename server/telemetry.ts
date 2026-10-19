/**
 * ĐƯỜNG VÀO CỦA ĐO LƯỜNG VẬN HÀNH — `POST /api/v1/telemetry` (A9; bản yêu cầu
 * 01 §2.2).
 *
 * ─── LUẬT CỦA CÁI CỬA NÀY ────────────────────────────────────────────────────
 * 1. **Không tin client về THỜI GIAN.** `ts` do server đặt (DEFAULT now()).
 *    Client chỉ được gửi THỜI LƯỢNG (`ms`), và `ms` bị kẹp.
 * 2. **Không tin client về DANH TÍNH.** `user_id` lấy từ cookie phiên; trường
 *    `user_id` trong body bị BỎ QUA hoàn toàn (không đọc tới).
 * 3. **Không tin client về HÌNH DẠNG.** `loai` lọc trắng; `chi_tiet` lọc theo
 *    danh sách trắng KHOÁ + KIỂU; `man` phải là mẫu route đã biết.
 * 4. **Không bao giờ làm hỏng thao tác của người chơi.** Mọi lỗi ghi đều bị
 *    nuốt (có log) và endpoint trả 202. Đây là dụng cụ đo, không phải nghiệp vụ
 *    — nó tuyệt đối không được là lý do một người không đặt được lệnh.
 * 5. **Bỏ IM LẶNG thay vì 4xx** với đồ lạ: client cũ vẫn chạy sau khi deploy và
 *    còn gửi loại đã bỏ; làm hỏng phiên của họ là phạt nhầm người.
 *
 * ⚠ ĐÂY LÀ ENDPOINT DUY NHẤT NGƯỜI LẠ GHI THẲNG VÀO DB ĐƯỢC. Rate limit không
 * phải phần thêm cho đẹp — không có nó thì nó là cửa làm ngập kho.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import {
  CHI_TIET_CHO_PHEP,
  MAU_MA,
  TELEMETRY,
  chuanHoaMan,
  laLoaiHopLe,
  type LoaiTelemetry,
} from '../config/telemetry.js';
import { consumeLimit } from './auth/rate_limit.js';
import type { SessionActor } from './auth/session.js';
import { docNghienCuuHieuLuc } from './nghien_cuu.js';

import type { Env, Mw as Middleware } from './http/types.js';
/**
 * Cùng khuôn Env với `server/app.ts` để route cắm vào được. ⚠ Nhưng ở ĐÚNG
 * endpoint này `actor` CÓ THỂ VẮNG — `optionalAuth` không chặn khách chưa đăng
 * nhập — nên chỗ đọc phải ép kiểu về `| undefined` và xử lý cả hai nhánh.
 */

/** Một sự kiện ĐÃ LỌC — mọi trường đã ở dạng ghi thẳng vào DB được. */
export interface SuKienSach {
  loai: LoaiTelemetry;
  man: string | null;
  ms: number | null;
  chi_tiet: Record<string, string | number> | null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * LỌC — hàm THUẦN, test được không cần DB
 * ══════════════════════════════════════════════════════════════════════════ */

function kepSo(v: unknown, tran: number): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(Math.trunc(n), 0), tran);
}

/** Số byte UTF-8. `TextEncoder` chứ không `Buffer` — chạy cả trên Workers (A8.9). */
function soByte(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * Lọc `chi_tiet` theo DANH SÁCH TRẮNG.
 *
 * ⚠⚠ VÒNG LẶP CHẠY TRÊN DANH SÁCH TRẮNG, KHÔNG TRÊN DỮ LIỆU VÀO. Đây là điểm
 * mấu chốt chống rò PII (C7): duyệt theo `CHI_TIET_CHO_PHEP` thì một khoá không
 * được khai KHÔNG CÓ ĐƯỜNG NÀO đi tiếp — kể cả khi client gửi `{email: …}`,
 * `{handle: …}` hay nguyên một object trạng thái. Duyệt theo dữ liệu vào rồi
 * loại khoá xấu là mô hình ngược, và nó chỉ chặn được những gì ta nghĩ ra trước.
 *
 * Giá trị cũng bị ép hình dạng: `'so'` là số nguyên đã kẹp, `'ma'` phải khớp
 * `MAU_MA` (không dấu cách, không `@`) ⇒ một địa chỉ email không sống sót nổi
 * dù có ai đó nhét nó vào đúng khoá được phép.
 */
export function locChiTiet(
  loai: LoaiTelemetry,
  raw: unknown,
): Record<string, string | number> | null {
  const choPhep = CHI_TIET_CHO_PHEP[loai];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const nguon = raw as Record<string, unknown>;
  const ra: Record<string, string | number> = {};
  for (const [khoa, kieu] of Object.entries(choPhep)) {
    const v = nguon[khoa];
    if (v === undefined || v === null) continue;
    if (kieu === 'so') {
      const n = kepSo(v, TELEMETRY.SO_TOI_DA);
      if (n !== null) ra[khoa] = n;
    } else {
      if (typeof v !== 'string' || !MAU_MA.test(v)) continue;
      ra[khoa] = v;
    }
  }
  if (Object.keys(ra).length === 0) return null;

  /*
   * Trần CỨNG đo đúng thứ cần đo — KÍCH CỠ. Danh sách trắng ở trên đã chặn phần
   * lớn, nhưng "≤ ~200 byte" trong bản yêu cầu vốn chỉ là MỤC TIÊU: trần "50 sự
   * kiện" không hề chặn 50 sự kiện mỗi cái 50 KB (founder chỉ ra 03/08).
   * Vượt trần thì bỏ `chi_tiet` chứ KHÔNG bỏ cả dòng — biết "có xảy ra" vẫn hơn
   * mất hẳn một điểm dữ liệu.
   */
  return soByte(JSON.stringify(ra)) > TELEMETRY.CHI_TIET_TOI_DA_BYTE ? null : ra;
}

/** Lọc một sự kiện. Trả `null` = bỏ im lặng (loại lạ / không phải object). */
export function locSuKien(raw: unknown): SuKienSach | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  if (!laLoaiHopLe(v.loai)) return null;

  /*
   * §8.4 — cơ chế `cham_nut` xây sẵn nhưng DANH SÁCH RỖNG. Nút không nằm trong
   * `CHAM_NUT_BAT` thì rơi ngay tại đây, không tốn một dòng DB nào. Đây là cái
   * bẫy dung lượng lớn nhất của cả danh mục, nên nó phải fail-closed.
   */
  if (v.loai === 'cham_nut') {
    const nut = v.chi_tiet && typeof v.chi_tiet === 'object'
      ? (v.chi_tiet as Record<string, unknown>).nut
      : undefined;
    if (typeof nut !== 'string' || !TELEMETRY.CHAM_NUT_BAT.includes(nut)) return null;
  }

  return {
    loai: v.loai,
    man: chuanHoaMan(v.man),
    ms: v.ms === undefined || v.ms === null ? null : kepSo(v.ms, TELEMETRY.MS_TOI_DA),
    chi_tiet: locChiTiet(v.loai, v.chi_tiet),
  };
}

/** Lọc cả lô + CẮT về trần. Vượt trần không phải lỗi của người dùng ⇒ không 4xx. */
export function locLo(raw: unknown): SuKienSach[] {
  if (!Array.isArray(raw)) return [];
  const ra: SuKienSach[] = [];
  for (const item of raw) {
    if (ra.length >= TELEMETRY.LO_TOI_DA) break;
    const s = locSuKien(item);
    if (s) ra.push(s);
  }
  return ra;
}

/* ══════════════════════════════════════════════════════════════════════════
 * GHI
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ghi một lô. Trả về số dòng đã ghi (0 = lô trùng, đã ghi lần trước).
 *
 * ⚠ MỘT CÂU SQL DUY NHẤT, KHÔNG TRANSACTION TƯỜNG MINH. Pool chỉ có 5 kết nối
 * (C1) và đây là endpoint gọi nhiều nhất trong app — mở BEGIN/COMMIT cho mỗi lô
 * là giữ một kết nối qua nhiều vòng mạng. CTE ghi-dữ-liệu cho ta đúng tính
 * nguyên tử cần có mà chỉ tốn một vòng:
 *
 *   · `lo` chèn khoá chống-gửi-lại; trùng ⇒ `RETURNING` rỗng.
 *   · `WHERE EXISTS (SELECT 1 FROM lo)` ⇒ lô trùng thì KHÔNG dòng nào được ghi.
 *
 * `WITH ORDINALITY` + `ORDER BY` để `id` (IDENTITY) tăng theo ĐÚNG thứ tự client
 * xếp — thứ tự phễu đọc theo `id`, vì cả lô chung một `now()`.
 *
 * ⚠ Phải bọc `ROWS FROM(...)`: Postgres không cho `WITH ORDINALITY` đứng cạnh
 * một column-definition-list (`AS x(a text, …)`) — lỗi 42601. Cú pháp này trông
 * thừa nhưng là cách DUY NHẤT để có cả hai thứ trong một câu.
 */
export async function ghiLo(
  pool: pg.Pool,
  arg: {
    loKey: string;
    userId: string | null;
    /** Mã LƯỢT NGỒI (0028). `null` = client cũ chưa gửi. */
    phien?: string | null;
    suKien: readonly SuKienSach[];
  },
): Promise<number> {
  if (arg.suKien.length === 0) return 0;
  const res = await pool.query(
    `WITH lo AS (
       INSERT INTO telemetry_lo (lo_key) VALUES ($1)
       ON CONFLICT (lo_key) DO NOTHING
       RETURNING lo_key
     )
     INSERT INTO telemetry (user_id, phien, loai, man, ms, chi_tiet)
     SELECT $2::uuid, $4::uuid, x.loai, x.man, x.ms, x.chi_tiet
       FROM ROWS FROM (
              jsonb_to_recordset($3::jsonb) AS (loai text, man text, ms int, chi_tiet jsonb)
            ) WITH ORDINALITY AS x(loai, man, ms, chi_tiet, ord)
      WHERE EXISTS (SELECT 1 FROM lo)
      ORDER BY x.ord`,
    [arg.loKey, arg.userId, JSON.stringify(arg.suKien), arg.phien ?? null],
  );
  return res.rowCount ?? 0;
}

/* ══════════════════════════════════════════════════════════════════════════
 * ROUTE
 * ══════════════════════════════════════════════════════════════════════════ */

/** Khoá lô hợp lệ theo CHECK của bảng (8–128 ký tự), không ký tự lạ. */
const MAU_LO_KEY = /^[A-Za-z0-9_.:-]{8,128}$/;

/**
 * Mã phiên phải là UUID ĐÚNG HÌNH DẠNG, nếu không thì bỏ (`null`) chứ không ném.
 *
 * ⚠ Chặt ở đây vì cột là `uuid`: một chuỗi rác sẽ làm CẢ LÔ ném lỗi kiểu, mà
 * lỗi ở đường này bị nuốt (luật 4 đầu file) ⇒ mất im lặng đúng những lô của
 * client lạ. Lọc trước thì mất mã phiên, giữ được dữ liệu.
 */
const MAU_PHIEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerTelemetryRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  deps: {
    /** Gắn `actor` nếu có phiên; KHÔNG chặn khách chưa đăng nhập. */
    optionalAuth: Middleware;
    clientIp: (c: any) => string;
  },
): void {
  app.post('/api/v1/telemetry', deps.optionalAuth, async (c) => {
    const actor = c.get('actor') as SessionActor | undefined;
    const userId: string | null = actor?.userId ?? null;

    try {
      /*
       * ── RATE LIMIT ─────────────────────────────────────────────────────
       * Hai đường, cố ý khác nhau — xem ghi chú dài ở `config/telemetry.ts`.
       * Tóm tắt: `consumeLimit` ghi MỘT DÒNG mỗi lần gọi, nên dùng nó cho
       * đường nóng là để cái đếm tốn hơn cái được đếm. User đã đăng nhập được
       * đếm bằng chính dữ liệu của họ (0 byte lưu thêm); khách mới dùng
       * `consumeLimit` theo IP, và khách chỉ tồn tại ở mấy màn auth.
       */
      if (userId) {
        /*
         * ── CỔNG ĐỒNG Ý — THI HÀNH Ở CHỖ GHI, KHÔNG PHẢI CHỖ ĐỌC ──────────
         *
         * Điều khoản §5.4 hứa: tắt ô đồng ý thì dữ liệu của bạn không đi vào
         * các tập phục vụ nghiên cứu. Có hai cách giữ lời hứa đó, và chúng
         * KHÔNG tương đương:
         *   · lọc lúc ĐỌC — phải nhớ thêm `WHERE research_consent` vào mọi
         *     truy vấn, mãi mãi, kể cả truy vấn viết sau này bởi người chưa
         *     đọc dòng chú thích này. Quên một chỗ là lời hứa vỡ, im lặng.
         *   · KHÔNG GHI ngay từ đầu — không có dòng nào thì không có gì để
         *     quên lọc. Lời hứa đúng theo cấu trúc, không nhờ kỷ luật.
         * Chọn cách thứ hai. Đây cũng đúng nguyên văn founder đặt ra:
         * *"nếu không đồng ý thì có thể không thu data từ người đó"*.
         *
         * ⚠ VÌ SAO CHỈ CHẶN `telemetry` MÀ KHÔNG CHẶN `events`: hai bảng hai
         * vai (A9). `events` là hành vi kinh tế — phân bổ token của bạn CHÍNH
         * LÀ số dư của bạn; không ghi thì không chơi được, nên nó là VẬN HÀNH
         * chứ không phải nghiên cứu. `telemetry` là đo lường giao diện: bỏ đi
         * thì app vẫn chạy y hệt, chỉ có tụi tôi bớt biết. Đúng thứ được phép
         * từ chối mà không mất gì.
         *
         * Trả 202 như bình thường: người tắt đồng ý KHÔNG cần biết client của
         * họ vẫn đang gửi, và báo lỗi ở đây thì client sẽ thử lại mãi.
         */
        // 0079 — đồng ý CÓ HIỆU LỰC = bật + đúng bản văn hiện hành; bật từ trước khi có số bản ⇒ coi như TẮT tới khi trả lời
        // tấm hỏi lại (SPEC chan-truoc-beta). Một nguồn: `server/nghien_cuu.ts`.
        if (!(await docNghienCuuHieuLuc(pool, userId))) return c.json({ ok: true, nhan: 0 }, 202);

        const { rows } = await pool.query(
          `SELECT count(*)::int AS n FROM telemetry
            WHERE user_id = $1 AND ts > now() - ($2 || ' minutes')::interval`,
          [userId, TELEMETRY.TRAN_CUA_SO_PHUT],
        );
        if ((rows[0]?.n ?? 0) >= TELEMETRY.TRAN_MOI_USER) {
          return c.json({ error: 'rate_limited' }, 429);
        }
      } else {
        const kq = await consumeLimit(
          pool,
          `tele:ip:${deps.clientIp(c)}`,
          TELEMETRY.KHACH_TRAN_MOI_IP,
          TELEMETRY.KHACH_CUA_SO_PHUT,
        );
        if (!kq.allowed) return c.json({ error: 'rate_limited' }, 429);
      }

      const body = await c.req.json().catch(() => null);
      const suKien = locLo((body as any)?.su_kien);

      /*
       * Khoá lô vắng hoặc sai hình dạng ⇒ SINH MỘT KHOÁ NGẪU NHIÊN, không vứt
       * lô. Client của ta luôn gửi `randomUUID`; vắng khoá nghĩa là ai đó khác
       * đang gọi. Một đường code duy nhất, không mất dữ liệu, và người không
       * gửi khoá thì đơn giản là không được bảo vệ chống gửi lại — đúng thứ
       * họ tự chọn.
       */
      const rawKey = (body as any)?.idempotency_key;
      const loKey: string =
        typeof rawKey === 'string' && MAU_LO_KEY.test(rawKey) ? rawKey : crypto.randomUUID();

      const rawPhien = (body as any)?.phien;
      const phien: string | null =
        typeof rawPhien === 'string' && MAU_PHIEN.test(rawPhien) ? rawPhien : null;

      const so = await ghiLo(pool, { loKey, userId, phien, suKien });
      return c.json({ ok: true, nhan: so }, 202);
    } catch (err) {
      /*
       * ⚠ NUỐT LỖI LÀ CÓ CHỦ Ý, KHÔNG PHẢI LƯỜI. Telemetry hỏng thì app vẫn
       * phải chạy: một lỗi ở dụng cụ đo không được biến thành một lỗi mà người
       * chơi nhìn thấy. Nhưng nuốt IM LẶNG HẲN thì hỏng cũng không ai biết —
       * nên vẫn log, và Sentry (D11) bắt được từ đây.
       */
      console.error('telemetry ghi lỗi', err);
      return c.json({ ok: true, nhan: 0 }, 202);
    }
  });
}
