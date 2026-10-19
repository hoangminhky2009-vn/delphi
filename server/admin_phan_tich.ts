/**
 * PHÂN TÍCH QUẢN TRỊ — nguồn số cho app quản trị riêng `/quan-tri` (D335, 15/09/2026).
 *
 * Founder 15/09: *"xem dữ liệu trên mốc thời gian cụ thể và xem chi tiết data thao tác khi vào app của 1 user …
 * thêm vài chức năng chia khu và phân tích data cơ bản"* rồi *"chú ý thật kỹ phần nối dây từ database sang để
 * tránh dữ liệu phản ánh không chính xác"*. Demo đã chốt: `docs/ui-ux/demo/phan-tich-quan-tri.html`.
 *
 * Ba khu: TỔNG QUAN (`/pt/tong-quan`) · NGƯỜI DÙNG (`/pt/nguoi`, `/pt/nguoi/:handle`) · PHÂN KHÚC (`/pt/phan-khuc*`).
 *
 * ─── BẢY LUẬT NỐI DÂY — mỗi luật là một chỗ số từng sai hoặc sẽ sai ─────────────────────────────────────────
 *  1. MỘT KHOẢNG = NGÀY VIỆT NAM, HAI ĐẦU ĐỀU LẤY. `tu`/`den` là ngày theo `TELEMETRY.MUI_GIO`; mốc đổi ra
 *     timestamptz ở SQL bằng `(ngày)::timestamp AT TIME ZONE`. Lọc bằng `ts >= đầu AND ts < (den + 1)` — không
 *     bao giờ `::date = …` trên cột (mất index) và không bao giờ so ngày UTC (lệch 7 tiếng: 00:30 sáng VN là
 *     17:30 hôm trước theo UTC).
 *  2. "HÔM NAY" TÍNH MỘT LẦN mỗi request, ở JS, rồi truyền xuống — mọi khối trong một phản hồi cùng một hôm nay.
 *  3. MỘT ẢNH CHỤP. Mọi truy vấn của một phản hồi chạy trong một giao dịch REPEATABLE READ READ ONLY: cùng một
 *     con số hiện ở hai khối thì khớp nhau, kể cả khi có người đang chơi lúc đọc.
 *  4. SỐ HÀNH VI CHỈ TÍNH NGƯỜI ĐANG BẬT GHI (`users.research_consent`, đọc lúc XEM — cổng tầng đọc D101).
 *     Telemetry vốn chỉ ghi khi đang bật (cửa ghi ở `server/telemetry.ts`), nhưng người tắt SAU đó vẫn còn dòng
 *     cũ; lọc lúc đọc mới giữ được lời "tắt là thôi".
 *  5. TELEMETRY THÔ CHỈ CÒN ~90 NGÀY (`donHan`). Khối nào cần nó thì cắt khoảng ở `tho_tu` — ngày đầu tiên CÒN
 *     ĐỦ — và nói ra (`cat_tho`, `do_duoc`). Không bao giờ để một ngày thiếu dữ liệu đọc thành một ngày vắng.
 *  6. LOẠI TÀI KHOẢN QUẢN TRỊ + THỬ MẶC ĐỊNH (D212, 0052), một công tắc cho cả hai; trận ép tham số
 *     (`co_ep_tham_so`) loại cùng công tắc thử.
 *  7. `telemetry.ts` LÀ LÚC MÁY CHỦ NHẬN LÔ (gom tới 30 giây), KHÔNG PHẢI LÚC BẤM. Thời lượng đọc `ms` của client;
 *     thứ tự trong dòng của một người đọc theo `id`. Mốc giờ hiện ở phút và UI nói rõ độ lệch.
 *
 * ⚠ Ranh riêng tư (A11.17 — không dẻo): chỉ `handle`, không email · nhóm dưới `SAN` người không lộ số ·
 * mỗi lần mở trang một người ghi `admin_audit` · trận buổi đo không lộ bàn/nhóm/hạng (lời hứa D329).
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { DEMOGRAPHIC } from '../config/auth.js';
import { TELEMETRY } from '../config/telemetry.js';
import { ghepLoc, loaiAdmin, loaiTester, loaiTranCheat, loaiTranTap } from './admin_thongke.js';
/*
 * Hình dạng mọi thứ đi dây nằm ở `admin_phan_tich_ids.ts` — web đọc CÙNG tệp đó (`@server`). Mỗi route dưới đây gắn
 * kiểu trả về từ đó: đổi một khoá ở đây mà màn không đổi theo thì tsc web đỏ, không phải màn in "—" im lặng.
 */
import type {
  ChiaNhomTraVe, ChiSoNhom, DieuKien, DongLoi, DongMan, DsNguoiTraVe, DsNhomLuuTraVe, HangGiuChan, Khoang,
  LuuNhomTraVe, MotNguoiTraVe, NgayChuoi, NgayDong, OGiuChan, ONhomChia, OSo, Pheu, Phien, QuayLai, SuKien,
  TheoChia, TinhNhomTraVe, TongQuanTraVe,
} from './admin_phan_tich_ids.js';

import type { Env, Mw as Middleware } from './http/types.js';

/** Ô dưới ngần này người thì không lộ số — cùng ngưỡng mặt NHÓM cũ (`CHE_DUOI`, founder chốt phương án C). */
export const SAN = 5;
/** Khoảng dài nhất một lần hỏi. Dài hơn thì bảng theo ngày không còn đọc được trên một màn. */
export const KHOANG_TOI_DA_NGAY = 366;
/** Khoảng mặc định khi URL không nói gì: 30 ngày tới hôm nay. */
const KHOANG_MAC_DINH_NGAY = 30;
/** Trần số dòng một lượt tải dòng thời gian. Người chơi rất tích cực sinh vài trăm dòng một ngày. */
export const TRAN_DONG_THOI_GIAN = 600;

const TZ = TELEMETRY.MUI_GIO;
// Múi giờ được CHÈN vào câu SQL (không bind — xem luật 1 và lý do đánh số `$n` ở `loaiAdmin`). Nó là hằng
// trong config, nhưng vẫn kiểm hình dạng lúc nạp: một ký tự lạ ở đây là một lỗ SQL chứ không phải lỗi hiển thị.
if (!/^[A-Za-z_]+\/[A-Za-z_]+$/.test(TZ)) throw new Error(`TELEMETRY.MUI_GIO sai hình dạng: ${TZ}`);

/* ══════════════════════════════════════════════════════════════════════════
 * NGÀY & KHOẢNG
 * ══════════════════════════════════════════════════════════════════════════ */

const MAU_NGAY = /^\d{4}-\d{2}-\d{2}$/;
const MS_NGAY = 86_400_000;
const LECH_VN_MS = 7 * 3_600_000; // Asia/Ho_Chi_Minh không đổi giờ mùa hè.

/** Ngày VN (YYYY-MM-DD) của một mốc thời gian. */
export function ngayVN(ms: number): string {
  return new Date(ms + LECH_VN_MS).toISOString().slice(0, 10);
}

/** Cộng ngày trên chuỗi YYYY-MM-DD (lịch thuần, không múi giờ). */
export function congNgay(ngay: string, n: number): string {
  return new Date(Date.parse(`${ngay}T00:00:00Z`) + n * MS_NGAY).toISOString().slice(0, 10);
}

/** Số ngày từ `a` tới `b` (b − a). */
export function hieuNgay(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_NGAY);
}

/** Chuỗi YYYY-MM-DD là một ngày có thật (không nhận 2026-02-30). */
export function laNgayThat(s: string): boolean {
  if (!MAU_NGAY.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Đọc khoảng từ query. Sai hình dạng ⇒ về mặc định chứ không 400 (URL chia sẻ được, cùng tinh thần `docLoc`).
 * `den` quá hôm nay ⇒ kẹp về hôm nay; `tu > den` ⇒ đổi chỗ; dài quá trần ⇒ kẹp `tu`.
 */
export function docKhoang(q: (k: string) => string | undefined, bayGio = Date.now()): Khoang {
  const homNay = ngayVN(bayGio);
  let den = q('den') ?? '';
  let tu = q('tu') ?? '';
  if (!laNgayThat(den) || den > homNay) den = homNay;
  if (!laNgayThat(tu)) tu = congNgay(den, -(KHOANG_MAC_DINH_NGAY - 1));
  if (tu > den) [tu, den] = [den, tu];
  if (hieuNgay(tu, den) + 1 > KHOANG_TOI_DA_NGAY) tu = congNgay(den, -(KHOANG_TOI_DA_NGAY - 1));
  const soNgay = hieuNgay(tu, den) + 1;
  return {
    tu, den, so_ngay: soNgay, hom_nay: homNay,
    ky_truoc: { tu: congNgay(tu, -soNgay), den: congNgay(tu, -1) },
  };
}

/**
 * Ngày đầu tiên telemetry thô CÒN ĐỦ. `donHan` xoá dòng cũ hơn 90 ngày (và chỉ khi đã cuộn), nên ngày chứa mốc
 * `bây giờ − 90 ngày` là ngày THIẾU; ngày sau nó mới đủ. Kho còn trẻ thì ngày đầu = ngày của dòng telemetry đầu
 * tiên — trước đó không phải "thiếu" mà là chưa đo, và cả hai đều không được đọc thành số 0.
 */
export function thoTu(bayGio: number, dongDauTien: Date | null): string {
  const theoHan = congNgay(ngayVN(bayGio - TELEMETRY.GIU_THO_NGAY * MS_NGAY), 1);
  if (!dongDauTien) return theoHan;
  const dau = ngayVN(dongDauTien.getTime());
  return dau > theoHan ? dau : theoHan;
}

/** Ngày đầu còn đủ telemetry thô — một truy vấn, trong chính ảnh chụp của request. */
export async function layTho(db: pg.Pool | pg.PoolClient, bayGio: number): Promise<string> {
  const { rows } = await db.query('SELECT min(ts) AS dau FROM telemetry');
  return thoTu(bayGio, rows[0]?.dau ?? null);
}

/** Mốc (ms) đầu ngày VN của chuỗi YYYY-MM-DD — cùng độ lệch cố định với `ngayVN`. */
export const msDauNgayVN = (ngay: string): number => Date.parse(`${ngay}T00:00:00Z`) - LECH_VN_MS;

/** Công tắc chung "gồm tài khoản quản trị & thử". Mặc định LOẠI cả hai. */
export const docGom = (q: (k: string) => string | undefined): boolean =>
  q('gom_admin') === '1' || q('gom') === '1';

/* ══════════════════════════════════════════════════════════════════════════
 * GIAO DỊCH ĐỌC
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Luật 3: một phản hồi = một ảnh chụp. READ ONLY để một lỗi trong tầng này không bao giờ ghi được gì.
 * Khu SẢN PHẨM (`admin_san_pham.ts`, D341) dùng CHÍNH hàm này — không có bản thứ hai.
 */
export async function docMotAnh<T>(pool: pg.Pool, fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const cn = await pool.connect();
  try {
    await cn.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const kq = await fn(cn);
    await cn.query('COMMIT');
    return kq;
  } catch (e) {
    await cn.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cn.release();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * MẢNH SQL
 * ══════════════════════════════════════════════════════════════════════════ */

/** Đầu ngày VN của một tham số ngày (`$n`) dạng timestamptz. */
export const dauNgay = (thamSo: string): string => `((${thamSo})::date)::timestamp AT TIME ZONE '${TZ}'`;
/** Ngày VN của một cột timestamptz. */
export const ngayCua = (cot: string): string => `(${cot} AT TIME ZONE '${TZ}')::date`;

/**
 * Tập người được tính (luật 6): chưa xoá, loại admin/tester theo công tắc. KHÔNG có tham số bind — chèn vào
 * đâu cũng không xê dịch `$n`.
 */
function cteNguoi(gom: boolean): string {
  return `nguoi AS (
    SELECT u.user_id, u.created_at, u.research_consent, u.la_khach, u.pfm_bat_dau,
           u.age_band, u.region, u.occupation_band
      FROM users u
     WHERE u.deleted_at IS NULL ${ghepLoc(loaiAdmin(gom, 'u.user_id'), loaiTester(gom, 'u.user_id'))}
  )`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * KHỐI SỐ — mỗi hàm một câu hỏi, nhận client đang ở trong giao dịch
 * ══════════════════════════════════════════════════════════════════════════ */

async function oSo(db: pg.PoolClient, tu: string, den: string, tho: string, homNay: string, gom: boolean): Promise<OSo> {
  // D359: bàn tập đi cùng cheat dưới CÙNG công tắc `gom` — tệp này vốn một công tắc cho mọi
  // thứ "không đại diện" (admin + tester + ép tham số), thêm một trục thứ tư là lệch thiết kế.
  const cheat = ghepLoc(loaiTranCheat(gom, 'm.'), loaiTranTap(gom, 'm.'));
  const doDuoc = den >= tho;
  const { rows: [a] } = await db.query(
    `WITH ${cteNguoi(gom)}, cua AS (
       SELECT ${dauNgay('$1')} AS bd, ${dauNgay('$2::date + 1')} AS kt,
              ${dauNgay('greatest($1::date, $3::date)')} AS bd_tho
     )
     SELECT
       /*
        * ⚠⚠ KHÔNG DÙNG DẤU BACKTICK Ở ĐÂY, KỂ CẢ TRONG CHÚ THÍCH — cả câu SQL này là
        * MỘT template literal JS (mở bằng backtick ở "WITH ${cteNguoi(gom)}..." phía
        * trên); một backtick trong chú thích đóng chuỗi giữa chừng và vỡ cú pháp cả
        * hàm (đã dính đúng lỗi này khi viết D444 — tsc báo "',' expected" cả loạt).
        *
        * D444 — CỘNG BÙ khách bỏ hoang đã bị donKhachBoHoang() XOÁ HẲN khỏi users.
        * Không xoá thì họ vẫn nằm trong đếm 'nguoi' như mọi tài khoản; xoá xong mà không
        * bù thì moi/moi_khach ĐẾM THIẾU đúng số đã dọn — con số dashboard đổi NGƯỢC
        * theo một việc dọn rác không liên quan gì tới "hôm đó có bao nhiêu người mới",
        * đúng lớp "dữ liệu phản ánh không chính xác" founder dặn (15/09).
        * khach_da_don_ngay.ngay đã LÀ ngày VN của created_at gốc (migration 0072), nên
        * so thẳng với $1/$2 (cũng là tham số ngày, không phải timestamptz) — không qua
        * dauNgay()/ngayCua() vì hai vế đã cùng đơn vị "ngày VN".
        * Cộng ở CẢ HAI chế độ gom (không điều kiện theo gom): khách bị dọn không bao
        * giờ là admin/tester (câu ứng viên của donKhachBoHoang() đã loại cả hai —
        * role = 'user' AND NOT la_tester), nên đóng góp của họ vào moi/moi_khach giống
        * hệt nhau dù gom bật hay tắt.
        */
       ((SELECT count(*) FROM nguoi, cua WHERE nguoi.created_at >= cua.bd AND nguoi.created_at < cua.kt)
         + (SELECT coalesce(sum(k.so), 0) FROM khach_da_don_ngay k
             WHERE k.ngay >= $1::date AND k.ngay <= $2::date))::int AS moi,
       ((SELECT count(*) FROM nguoi, cua WHERE nguoi.la_khach AND nguoi.created_at >= cua.bd
                                          AND nguoi.created_at < cua.kt)
         + (SELECT coalesce(sum(k.so), 0) FROM khach_da_don_ngay k
             WHERE k.ngay >= $1::date AND k.ngay <= $2::date))::int AS moi_khach,
       (SELECT count(*) FROM holdem_matches m JOIN nguoi ON nguoi.user_id = m.owner_user_id, cua
         WHERE m.started_at >= cua.bd AND m.started_at < cua.kt ${cheat})::int AS tran,
       (SELECT count(*) FROM holdem_matches m JOIN nguoi ON nguoi.user_id = m.owner_user_id, cua
         WHERE m.started_at >= cua.bd AND m.started_at < cua.kt AND m.status = 'xong' ${cheat})::int AS tran_xong,
       (SELECT count(*) FROM holdem_matches m JOIN nguoi ON nguoi.user_id = m.owner_user_id, cua
         WHERE m.started_at >= cua.bd AND m.started_at < cua.kt AND m.status = 'bo_dở' ${cheat})::int AS tran_bo_do,
       (SELECT count(*) FROM holdem_matches m JOIN nguoi ON nguoi.user_id = m.owner_user_id, cua
         WHERE m.started_at >= cua.bd AND m.started_at < cua.kt AND m.status = 'dang_choi' ${cheat})::int AS tran_dang,
       (SELECT count(DISTINCT t.user_id) FROM telemetry t JOIN nguoi ON nguoi.user_id = t.user_id
                                          AND nguoi.research_consent, cua
         WHERE t.loai = 'phien_mo' AND t.ts >= cua.bd_tho AND t.ts < cua.kt)::int AS hoat_dong,
       (SELECT count(*) FROM telemetry t JOIN nguoi ON nguoi.user_id = t.user_id AND nguoi.research_consent, cua
         WHERE t.loai = 'phien_mo' AND t.ts >= cua.bd_tho AND t.ts < cua.kt)::int AS phien,
       (SELECT count(*) FROM telemetry t JOIN nguoi ON nguoi.user_id = t.user_id AND nguoi.research_consent, cua
         WHERE t.loai = 'phien_dong' AND t.ms IS NOT NULL
           AND t.ts >= cua.bd_tho AND t.ts < cua.kt)::int AS phien_ms,
       (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t.ms)
          FROM telemetry t JOIN nguoi ON nguoi.user_id = t.user_id AND nguoi.research_consent, cua
         WHERE t.loai = 'phien_dong' AND t.ms IS NOT NULL
           AND t.ts >= cua.bd_tho AND t.ts < cua.kt)::float8 AS ms_tv`,
    [tu, den, tho],
  );
  const quay = await quayLaiCua(db, tu, den, tho, homNay, gom, '', []);
  return {
    tai_khoan_moi: a.moi, tai_khoan_moi_khach: a.moi_khach,
    tran: a.tran, tran_xong: a.tran_xong, tran_bo_do: a.tran_bo_do, tran_dang_choi: a.tran_dang,
    do_duoc: doDuoc,
    cat_tho: doDuoc && tu < tho,
    nguoi_hoat_dong: doDuoc ? a.hoat_dong : null,
    phien: doDuoc ? a.phien : null,
    phien_co_thoi_luong: doDuoc ? a.phien_ms : null,
    ms_moi_phien_tv: doDuoc && a.ms_tv !== null ? Math.round(a.ms_tv) : null,
    quay_lai: quay,
  };
}

/**
 * Quay lại tuần 2 cho người BẬT GHI tạo tài khoản trong [tu, den], có thể thu hẹp thêm bằng một mệnh đề phân
 * khúc (`dkSql` trên alias `nguoi`, tham số bắt đầu từ `$5`).
 */
async function quayLaiCua(
  db: pg.PoolClient, tu: string, den: string, tho: string, homNay: string, gom: boolean,
  dkSql: string, dkTham: unknown[],
): Promise<QuayLai> {
  const c = ngayCua('nguoi.created_at');
  const { rows: [r] } = await db.query(
    `WITH ${cteNguoi(gom)}, x AS (
       SELECT (${c} + 13 <= $4::date) AS khep,
              (${c} + 7 >= $3::date) AS con_tho,
              EXISTS (SELECT 1 FROM telemetry t
                       WHERE t.user_id = nguoi.user_id AND t.loai = 'phien_mo'
                         AND t.ts >= ((${c} + 7)::timestamp AT TIME ZONE '${TZ}')
                         AND t.ts <  ((${c} + 14)::timestamp AT TIME ZONE '${TZ}')) AS co
         FROM nguoi
        WHERE nguoi.research_consent
          AND nguoi.created_at >= ${dauNgay('$1')} AND nguoi.created_at < ${dauNgay('$2::date + 1')}
          ${dkSql}
     )
     SELECT count(*) FILTER (WHERE khep AND con_tho)::int AS nhom,
            count(*) FILTER (WHERE khep AND con_tho AND co)::int AS co,
            count(*) FILTER (WHERE NOT khep)::int AS chua_toi,
            count(*) FILTER (WHERE khep AND NOT con_tho)::int AS het_tho
       FROM x`,
    [tu, den, tho, homNay, ...dkTham],
  );
  return { nhom: r.nhom, co: r.co, chua_toi: r.chua_toi, het_tho: r.het_tho };
}

async function chuoiNgay(db: pg.PoolClient, tu: string, den: string, tho: string, gom: boolean): Promise<NgayChuoi[]> {
  const { rows } = await db.query(
    `WITH ${cteNguoi(gom)},
     ngay AS (SELECT generate_series($1::date, $2::date, interval '1 day')::date AS d),
     moi AS (
       SELECT d, sum(n)::int AS n FROM (
         SELECT ${ngayCua('created_at')} AS d, count(*)::int AS n FROM nguoi
          WHERE created_at >= ${dauNgay('$1')} AND created_at < ${dauNgay('$2::date + 1')}
          GROUP BY 1
         UNION ALL
         /* D444: cộng bù khách bỏ hoang đã dọn, THEO TỪNG NGÀY — lý lẽ đầy đủ ở oSo() phía trên (cùng tệp). */
         SELECT k.ngay AS d, k.so AS n FROM khach_da_don_ngay k
          WHERE k.ngay >= $1::date AND k.ngay <= $2::date
       ) x GROUP BY d
     ),
     hd AS (
       SELECT ${ngayCua('t.ts')} AS d, count(DISTINCT t.user_id)::int AS n
         FROM telemetry t JOIN nguoi ON nguoi.user_id = t.user_id AND nguoi.research_consent
        WHERE t.loai = 'phien_mo'
          AND t.ts >= ${dauNgay('greatest($1::date, $3::date)')} AND t.ts < ${dauNgay('$2::date + 1')}
        GROUP BY 1
     )
     SELECT ngay.d::text AS ngay, COALESCE(moi.n, 0) AS moi,
            CASE WHEN ngay.d >= $3::date THEN COALESCE(hd.n, 0) END AS hoat_dong
       FROM ngay LEFT JOIN moi ON moi.d = ngay.d LEFT JOIN hd ON hd.d = ngay.d
      ORDER BY ngay.d`,
    [tu, den, tho],
  );
  return rows.map((r) => ({ ngay: r.ngay, tai_khoan_moi: r.moi, nguoi_hoat_dong: r.hoat_dong }));
}

/**
 * Phễu người mới — nhóm là TÀI KHOẢN EMAIL tạo trong khoảng (`auth_accounts`, khoá thật nối được mọi bậc — bài
 * học phễu đăng ký 03/08 ở `admin_thongke.ts`). Bốn bậc đầu đếm mọi tài khoản; từ "xong màn tập" chỉ đếm người
 * đang bật ghi, và mỗi bậc sau là TẬP CON của "bật ghi" (không phải của bậc liền trước: vào trận không cần xong
 * màn tập).
 */
async function pheuNguoiMoi(
  db: pg.PoolClient, tu: string, den: string, tho: string, homNay: string, gom: boolean,
): Promise<Pheu> {
  // D359: bàn tập đi cùng cheat dưới CÙNG công tắc `gom` — tệp này vốn một công tắc cho mọi
  // thứ "không đại diện" (admin + tester + ép tham số), thêm một trục thứ tư là lệch thiết kế.
  const cheat = ghepLoc(loaiTranCheat(gom, 'm.'), loaiTranTap(gom, 'm.'));
  const { rows: [r] } = await db.query(
    `WITH tk AS (
       SELECT a.user_id, a.email_verified_at
         FROM auth_accounts a
        WHERE a.created_at >= ${dauNgay('$1')} AND a.created_at < ${dauNgay('$2::date + 1')}
          ${ghepLoc(loaiAdmin(gom, 'a.user_id'), loaiTester(gom, 'a.user_id'))}
          AND NOT EXISTS (SELECT 1 FROM users d WHERE d.user_id = a.user_id AND d.deleted_at IS NOT NULL)
     ), bg AS (
       SELECT tk.user_id FROM tk JOIN users u ON u.user_id = tk.user_id WHERE u.research_consent
     )
     SELECT
       /* D444: tao/ho_so cộng bù khách bỏ hoang đã dọn (khoảng [$1,$2], VN-ngày) — lý lẽ đầy đủ ở
          oSo() trong tệp này. KHÔNG cộng xac_minh/bat_ghi/xong_tap/vao_tran/xong_3: khách bị dọn
          chưa từng xác minh, chưa từng bật ghi, chưa từng chơi. */
       ((SELECT count(*) FROM tk)
         + (SELECT coalesce(sum(k.so), 0) FROM khach_da_don_ngay k
             WHERE k.ngay >= $1::date AND k.ngay <= $2::date))::int AS tao,
       (SELECT count(*) FROM tk WHERE email_verified_at IS NOT NULL)::int AS xac_minh,
       ((SELECT count(user_id) FROM tk)
         + (SELECT coalesce(sum(k.so), 0) FROM khach_da_don_ngay k
             WHERE k.ngay >= $1::date AND k.ngay <= $2::date))::int AS ho_so,
       (SELECT count(*) FROM bg)::int AS bat_ghi,
            (SELECT count(*) FROM bg WHERE EXISTS (
               SELECT 1 FROM telemetry t WHERE t.user_id = bg.user_id AND t.loai = 'huong_dan_buoc'
                  AND t.chi_tiet->>'buoc' = 'het'))::int AS xong_tap,
            (SELECT count(*) FROM bg WHERE EXISTS (
               SELECT 1 FROM holdem_matches m WHERE m.owner_user_id = bg.user_id ${cheat}))::int AS vao_tran,
            (SELECT count(*) FROM bg WHERE (
               SELECT count(*) FROM holdem_results r JOIN holdem_matches m ON m.match_id = r.match_id
                WHERE r.user_id = bg.user_id ${cheat}) >= 3)::int AS xong_3`,
    [tu, den],
  );
  /*
   * Bậc cuối là TẬP CON của "bật ghi" trong CHÍNH nhóm tài khoản email tạo trong khoảng. Không cắt thêm theo
   * `users.created_at`: người đăng ký cuối khoảng mà lập hồ sơ hôm sau vẫn thuộc nhóm này. Cửa tuần 2 thì vẫn
   * tính từ ngày lập hồ sơ — trước đó chưa có đồng ý nào để mà có telemetry.
   */
  const quay = await quayLaiCua(db, '2000-01-01', homNay, tho, homNay, gom,
    `AND EXISTS (SELECT 1 FROM auth_accounts a WHERE a.user_id = nguoi.user_id
                    AND a.created_at >= ${dauNgay('$5')} AND a.created_at < ${dauNgay('$6::date + 1')})`, [tu, den]);
  return {
    tao_tai_khoan: r.tao, xac_minh: r.xac_minh, lap_ho_so: r.ho_so, bat_ghi: r.bat_ghi,
    xong_tap: tu >= tho ? r.xong_tap : null,
    vao_tran: r.vao_tran, xong_3_tran: r.xong_3, quay_lai: quay,
  };
}

/**
 * Gom người thành bảng giữ chân — HÀM THUẦN (test gọi thẳng). Nhóm = 8 khối 7 ngày lùi từ `den`; tuần k của
 * một người = ngày [c+7k, c+7k+6] tính từ NGÀY TẠO của chính người đó (không phải tuần lịch).
 */
export function gomGiuChan(
  nguoi: Array<{ c: string; w: [boolean, boolean, boolean, boolean] }>,
  den: string, homNay: string, tho: string,
): HangGiuChan[] {
  const hang: HangGiuChan[] = [];
  for (let b = 0; b < 8; b++) {
    const hDen = congNgay(den, -7 * b);
    const hTu = congNgay(hDen, -6);
    const nhom = nguoi.filter((x) => x.c >= hTu && x.c <= hDen);
    const tuan: OGiuChan[] = [];
    for (let k = 0; k < 4; k++) {
      const du = nhom.filter((x) => congNgay(x.c, 7 * k + 6) <= homNay && congNgay(x.c, 7 * k) >= tho);
      if (du.length === 0) {
        const chuaToi = nhom.some((x) => congNgay(x.c, 7 * k + 6) > homNay);
        tuan.push({ trang_thai: nhom.length === 0 || chuaToi ? 'chua_toi' : 'het_tho' });
      } else if (du.length < SAN) {
        tuan.push({ trang_thai: 'it' });
      } else {
        tuan.push({ trang_thai: 'co', n: du.length, co: du.filter((x) => x.w[k]).length });
      }
    }
    hang.push({ tu: hTu, den: hDen, n: nhom.length < SAN ? null : nhom.length, tuan });
  }
  return hang;
}

async function giuChan(
  db: pg.PoolClient, den: string, tho: string, homNay: string, gom: boolean,
): Promise<HangGiuChan[]> {
  const c = ngayCua('nguoi.created_at');
  const cuaSo = (k: number) => `EXISTS (SELECT 1 FROM telemetry t
      WHERE t.user_id = nguoi.user_id AND t.loai = 'phien_mo'
        AND t.ts >= ((${c} + ${7 * k})::timestamp AT TIME ZONE '${TZ}')
        AND t.ts <  ((${c} + ${7 * k + 7})::timestamp AT TIME ZONE '${TZ}'))`;
  const { rows } = await db.query(
    `WITH ${cteNguoi(gom)}
     SELECT ${c}::text AS c, ${cuaSo(0)} AS w0, ${cuaSo(1)} AS w1, ${cuaSo(2)} AS w2, ${cuaSo(3)} AS w3
       FROM nguoi
      WHERE nguoi.research_consent
        AND nguoi.created_at >= ${dauNgay('$1::date - 55')} AND nguoi.created_at < ${dauNgay('$1::date + 1')}`,
    [den],
  );
  return gomGiuChan(rows.map((r) => ({ c: r.c, w: [r.w0, r.w1, r.w2, r.w3] })), den, homNay, tho);
}

async function manDung(db: pg.PoolClient, tu: string, den: string, tho: string, gom: boolean): Promise<DongMan[]> {
  if (den < tho) return [];
  const { rows } = await db.query(
    `WITH ${cteNguoi(gom)}, tho AS (
       SELECT t.user_id, t.loai, t.man, t.ms FROM telemetry t
         JOIN nguoi ON nguoi.user_id = t.user_id AND nguoi.research_consent
        WHERE t.loai IN ('man_vao', 'man_ra') AND t.man IS NOT NULL
          AND t.ts >= ${dauNgay('greatest($1::date, $3::date)')} AND t.ts < ${dauNgay('$2::date + 1')}
     ), moi_nguoi AS (
       SELECT man, user_id, sum(ms) AS s FROM tho WHERE loai = 'man_ra' AND ms IS NOT NULL GROUP BY 1, 2
     )
     SELECT g.man, g.luot, g.nguoi, g.ms_tong, tv.ms_tv
       FROM (SELECT man,
                    count(*) FILTER (WHERE loai = 'man_vao')::int AS luot,
                    count(DISTINCT user_id) FILTER (WHERE loai = 'man_vao')::int AS nguoi,
                    COALESCE(sum(ms) FILTER (WHERE loai = 'man_ra'), 0)::bigint AS ms_tong
               FROM tho GROUP BY man) g
       LEFT JOIN (SELECT man, percentile_cont(0.5) WITHIN GROUP (ORDER BY s)::float8 AS ms_tv
                    FROM moi_nguoi GROUP BY man) tv ON tv.man = g.man
      ORDER BY g.luot DESC, g.ms_tong DESC, g.man
      LIMIT 15`,
    [tu, den, tho],
  );
  return rows.map((r) => ({
    man: r.man, luot: r.luot, nguoi: r.nguoi, ms_tong: Number(r.ms_tong),
    ms_moi_nguoi_tv: r.ms_tv === null ? null : Math.round(r.ms_tv),
  }));
}

async function loiGap(db: pg.PoolClient, tu: string, den: string, tho: string, gom: boolean): Promise<DongLoi[]> {
  if (den < tho) return [];
  const { rows } = await db.query(
    `WITH ${cteNguoi(gom)}
     SELECT t.man, t.loai, t.chi_tiet->>'ma' AS ma, count(*)::int AS n
       FROM telemetry t JOIN nguoi ON nguoi.user_id = t.user_id AND nguoi.research_consent
      WHERE t.loai IN ('loi_api', 'loi_client')
        AND t.ts >= ${dauNgay('greatest($1::date, $3::date)')} AND t.ts < ${dauNgay('$2::date + 1')}
      GROUP BY 1, 2, 3 ORDER BY n DESC, t.loai, ma LIMIT 20`,
    [tu, den, tho],
  );
  return rows.map((r) => ({ man: r.man, loai: r.loai, ma: r.ma, n: r.n }));
}

/* ══════════════════════════════════════════════════════════════════════════
 * DÒNG THỜI GIAN MỘT NGƯỜI — dựng ở TS, hàm thuần
 * ══════════════════════════════════════════════════════════════════════════ */

export interface DongTho { id: number; ts: Date; loai: string; man: string | null; ms: number | null; chi_tiet: Record<string, unknown> | null }
export interface DongTran {
  match_id: string; started_at: Date; status: 'dang_choi' | 'xong' | 'bo_dở';
  so_o: number | null; che_do: string; buoi_do: boolean;
  hang: number | null; so_ghe: number | null;
  /** Mốc KẾT thật: `ended_at` với trận xong; nước người cuối cùng với trận bỏ dở (xem `admin_thongke` 4b). */
  ket_luc: Date | null;
}
export interface DongToken { ts: Date; delta: number; reason: string }

const TELE_HIEN: ReadonlySet<string> = new Set([
  'man_vao', 'man_ra', 'cham_nut', 'loi_api', 'loi_client', 'huong_dan_buoc', 'dang_nhap',
  'pfm_ghi', 'pfm_ket_thang_dong', 'pfm_ket_qua_lon', 'pfm_lo_loi',
]);

/** Lệch tối đa giữa lúc bấm và lúc máy chủ nhận lô (luật 7). Dùng để đặt trận/token vào đúng phiên. */
const LECH_LO_MS = TELEMETRY.GOM_MS + 5_000;

/**
 * Dựng dòng thời gian — HÀM THUẦN, test gọi thẳng với dữ liệu bịa.
 *
 * ⚠ PHIÊN = đoạn ở TIỀN CẢNH (`phien_mo` → `phien_dong`, `web/src/lib/telemetry.ts`), không phải cả lần mở app.
 * ⚠ THỜI GIAN MỘT MÀN = cộng `man_ra.ms` của đúng màn ấy cho tới lượt `man_vao` kế tiếp — `man_ra` là ĐOẠN CHÚ Ý
 *   (ẩn app rồi mở lại sinh hai đoạn cho một lượt xem), nên đếm lượt đọc `man_vao`, đo thời gian cộng `man_ra`.
 * ⚠ `tele` phải đã sắp theo `id`.
 */
export function dungDongThoiGian(tele: DongTho[], tran: DongTran[], token: DongToken[]): NgayDong[] {
  const phienDs: Phien[] = [];
  const le: SuKien[] = [];
  let mo: Phien | null = null;
  let manMo: { su: Extract<SuKien, { loai: 'man' }>; man: string } | null = null;

  const them = (su: SuKien) => { if (mo) mo.su.push(su); else le.push(su); };

  for (const d of tele) {
    const ts = d.ts.toISOString();
    if (d.loai === 'phien_mo') {
      if (mo) { mo.thieu_dong = true; phienDs.push(mo); }
      mo = { bd: ts, kt: null, ms: null, thieu_dong: false, su: [] };
      manMo = null;
      continue;
    }
    if (d.loai === 'phien_dong') {
      if (mo) {
        mo.kt = ts; mo.ms = d.ms;
        phienDs.push(mo);
        mo = null;
      } else {
        // Đóng mà không thấy mở trong khoảng: phiên bắt đầu trước khoảng — vẫn là một phiên có thời lượng thật.
        phienDs.push({ bd: null, kt: ts, ms: d.ms, thieu_dong: false, su: le.splice(0) });
      }
      manMo = null;
      continue;
    }
    if (!TELE_HIEN.has(d.loai)) continue;
    const ct = d.chi_tiet ?? {};
    const ma = (k: string): string | null => (typeof ct[k] === 'string' ? (ct[k] as string) : null);
    if (d.loai === 'man_vao' && d.man) {
      const su: Extract<SuKien, { loai: 'man' }> = { loai: 'man', ts, man: d.man, ms: null };
      them(su);
      manMo = { su, man: d.man };
    } else if (d.loai === 'man_ra' && d.man) {
      if (manMo && manMo.man === d.man) {
        manMo.su.ms = (manMo.su.ms ?? 0) + (d.ms ?? 0);
      } else {
        them({ loai: 'roi_man', ts, man: d.man, ms: d.ms });
      }
    } else if (d.loai === 'cham_nut') {
      them({ loai: 'cham', ts, nut: ma('nut'), man: d.man });
    } else if (d.loai === 'loi_api' || d.loai === 'loi_client') {
      them({ loai: 'loi', ts, nguon: d.loai === 'loi_api' ? 'api' : 'client', ma: ma('ma'), man: d.man });
    } else if (d.loai === 'huong_dan_buoc') {
      them({ loai: 'huong_dan', ts, buoc: ma('buoc') });
    } else if (d.loai === 'dang_nhap') {
      them({ loai: 'dang_nhap', ts });
    } else if (d.loai.startsWith('pfm_')) {
      // Tài chính: CHỈ loại thao tác — không số tiền, không nội dung (két không mở được, P2).
      them({ loai: 'tai_chinh', ts, ma: d.loai });
    }
  }
  if (mo) { mo.thieu_dong = true; phienDs.push(mo); }

  // Trận & token — mốc CHÍNH XÁC (máy chủ ghi lúc xảy ra). Đặt vào phiên có khoảng phủ mốc đó.
  const ngoai: SuKien[] = [...le];
  const datVao = (su: SuKien) => {
    const t = Date.parse(su.ts);
    const p = phienDs.find((x) => {
      const bd = x.bd ? Date.parse(x.bd) - LECH_LO_MS : -Infinity;
      const kt = x.kt ? Date.parse(x.kt) + LECH_LO_MS : (x.bd ? Date.parse(x.bd) + 6 * 3_600_000 : -Infinity);
      return t >= bd && t <= kt;
    });
    if (p) p.su.push(su); else ngoai.push(su);
  };
  for (const m of tran) {
    datVao({ loai: 'tran_vao', ts: m.started_at.toISOString(), so_o: m.buoi_do ? null : m.so_o,
      che_do: m.buoi_do ? null : m.che_do, buoi_do: m.buoi_do });
    if (m.status !== 'dang_choi' && m.ket_luc) {
      datVao({ loai: 'tran_ket', ts: m.ket_luc.toISOString(), trang_thai: m.status === 'xong' ? 'xong' : 'bo_do',
        hang: m.buoi_do ? null : m.hang, so_ghe: m.buoi_do ? null : m.so_ghe, buoi_do: m.buoi_do });
    }
  }
  for (const k of token) datVao({ loai: 'token', ts: k.ts.toISOString(), delta: k.delta, ly_do: k.reason });

  const theoGio = (a: SuKien, b: SuKien) => Date.parse(a.ts) - Date.parse(b.ts);
  for (const p of phienDs) p.su.sort(theoGio);

  // Gom theo NGÀY VN của mốc đầu khối (phiên) hoặc của chính sự kiện (ngoài phiên). Ngày mới nhất lên đầu.
  const theoNgay = new Map<string, NgayDong>();
  const lay = (ngay: string) => {
    let x = theoNgay.get(ngay);
    if (!x) { x = { ngay, phien: [], ngoai_phien: [] }; theoNgay.set(ngay, x); }
    return x;
  };
  for (const p of phienDs) {
    const moc = p.bd ?? p.kt ?? p.su[0]?.ts;
    if (!moc) continue;
    lay(ngayVN(Date.parse(moc))).phien.push(p);
  }
  for (const su of ngoai) lay(ngayVN(Date.parse(su.ts))).ngoai_phien.push(su);
  const ra = [...theoNgay.values()].sort((a, b) => (a.ngay < b.ngay ? 1 : -1));
  for (const n of ra) {
    n.phien.sort((a, b) => Date.parse(b.bd ?? b.kt ?? '0') - Date.parse(a.bd ?? a.kt ?? '0'));
    n.ngoai_phien.sort((a, b) => theoGio(b, a));
  }
  return ra;
}

/* ══════════════════════════════════════════════════════════════════════════
 * PHÂN KHÚC — điều kiện
 * ══════════════════════════════════════════════════════════════════════════ */

/** Lọc trắng điều kiện từ body. Khoá lạ bỏ; giá trị lạ bỏ; không bao giờ ném — trả null nếu không phải object. */
export function docDieuKien(x: unknown): DieuKien | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const dk: DieuKien = {};
  if (typeof o.tao_tu === 'string' && laNgayThat(o.tao_tu)) dk.tao_tu = o.tao_tu;
  if (typeof o.tao_den === 'string' && laNgayThat(o.tao_den)) dk.tao_den = o.tao_den;
  const tap = (v: unknown, ds: readonly string[]): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const ra = [...new Set(v.filter((s): s is string => typeof s === 'string' && ds.includes(s)))];
    return ra.length ? ra.sort((a, b) => ds.indexOf(a) - ds.indexOf(b)) : undefined;
  };
  const tuoi = tap(o.tuoi, DEMOGRAPHIC.AGE_BANDS); if (tuoi) dk.tuoi = tuoi;
  const vung = tap(o.vung, DEMOGRAPHIC.REGIONS); if (vung) dk.vung = vung;
  const nghe = tap(o.nghe, DEMOGRAPHIC.OCCUPATION_BANDS); if (nghe) dk.nghe = nghe;
  const nguyen = (v: unknown, min: number, max: number): number | undefined =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined;
  const tran = nguyen(o.tran_tu, 1, 999); if (tran !== undefined) dk.tran_tu = tran;
  const vao = nguyen(o.vao_trong_ngay, 1, TELEMETRY.GIU_THO_NGAY); if (vao !== undefined) dk.vao_trong_ngay = vao;
  if (o.xong_tap === true) dk.xong_tap = true;
  if (o.dung_tai_chinh === true) dk.dung_tai_chinh = true;
  return dk;
}

/**
 * Mệnh đề WHERE của điều kiện trên alias `nguoi` (CTE `cteNguoi`). Tham số bind đánh số từ `tuSo`.
 * ⚠ Hôm nay đi vào như một tham số RIÊNG của mệnh đề (chỉ khi cần) — Postgres từ chối tham số thừa không được
 *   câu nào dùng, nên không được giả định một ô `$n` cố định chứa hôm nay.
 */
export function menhDePhanKhuc(
  dk: DieuKien, tuSo: number, homNay: string,
): { sql: string; tham: unknown[] } {
  const phan: string[] = [];
  const tham: unknown[] = [];
  const bien = (v: unknown) => { tham.push(v); return `$${tuSo + tham.length - 1}`; };
  if (dk.tao_tu) phan.push(`nguoi.created_at >= ${dauNgay(bien(dk.tao_tu))}`);
  if (dk.tao_den) phan.push(`nguoi.created_at < ${dauNgay(`${bien(dk.tao_den)}::date + 1`)}`);
  if (dk.tuoi) phan.push(`nguoi.age_band = ANY(${bien(dk.tuoi)}::text[])`);
  if (dk.vung) phan.push(`nguoi.region = ANY(${bien(dk.vung)}::text[])`);
  if (dk.nghe) phan.push(`nguoi.occupation_band = ANY(${bien(dk.nghe)}::text[])`);
  if (dk.tran_tu) {
    phan.push(`(SELECT count(*) FROM holdem_results r WHERE r.user_id = nguoi.user_id) >= ${bien(dk.tran_tu)}`);
  }
  if (dk.vao_trong_ngay) {
    phan.push(`EXISTS (SELECT 1 FROM telemetry t WHERE t.user_id = nguoi.user_id AND t.loai = 'phien_mo'
                  AND t.ts >= ${dauNgay(`${bien(homNay)}::date - ${bien(dk.vao_trong_ngay)}::int + 1`)})`);
  }
  if (dk.xong_tap) {
    phan.push(`EXISTS (SELECT 1 FROM telemetry t WHERE t.user_id = nguoi.user_id AND t.loai = 'huong_dan_buoc'
                  AND t.chi_tiet->>'buoc' = 'het')`);
  }
  if (dk.dung_tai_chinh) phan.push('nguoi.pfm_bat_dau IS NOT NULL');
  return { sql: phan.length ? `AND ${phan.join(' AND ')}` : '', tham };
}

/** Cỡ THẬT của một nhóm, không che — chỉ để test và các hàm nội bộ gọi; không route nào trả thẳng số này. */
export async function demNhom(
  db: pg.Pool | pg.PoolClient, dk: DieuKien, homNay: string, gom: boolean,
): Promise<number> {
  const md = menhDePhanKhuc(dk, 1, homNay);
  const { rows: [r] } = await db.query(
    `WITH ${cteNguoi(gom)} SELECT count(*)::int AS n FROM nguoi WHERE nguoi.research_consent ${md.sql}`,
    md.tham);
  return r.n;
}

/** Chỉ số một nhóm trong [tu, den]. Trả `{ n: null }` khi nhóm dưới sàn — không một số nào khác rời server. */
async function chiSoNhom(
  db: pg.PoolClient, dk: DieuKien, tu: string, den: string, tho: string, homNay: string, gom: boolean,
): Promise<{ n: number | null; chi_so: ChiSoNhom | null }> {
  const md = menhDePhanKhuc(dk, 4, homNay);
  // D359: bàn tập đi cùng cheat dưới CÙNG công tắc `gom` — tệp này vốn một công tắc cho mọi
  // thứ "không đại diện" (admin + tester + ép tham số), thêm một trục thứ tư là lệch thiết kế.
  const cheat = ghepLoc(loaiTranCheat(gom, 'm.'), loaiTranTap(gom, 'm.'));
  const doDuoc = den >= tho;
  const { rows: [r] } = await db.query(
    `WITH ${cteNguoi(gom)}, nhom AS (
       SELECT nguoi.user_id, nguoi.pfm_bat_dau FROM nguoi WHERE nguoi.research_consent ${md.sql}
     ), cua AS (
       SELECT ${dauNgay('$1')} AS bd, ${dauNgay('$2::date + 1')} AS kt, ${dauNgay('greatest($1::date, $3::date)')} AS bd_tho
     )
     SELECT (SELECT count(*) FROM nhom)::int AS n,
            (SELECT count(DISTINCT t.user_id) FROM telemetry t JOIN nhom ON nhom.user_id = t.user_id, cua
              WHERE t.loai = 'phien_mo' AND t.ts >= cua.bd_tho AND t.ts < cua.kt)::int AS vao_app,
            (SELECT count(*) FROM telemetry t JOIN nhom ON nhom.user_id = t.user_id, cua
              WHERE t.loai = 'phien_mo' AND t.ts >= cua.bd_tho AND t.ts < cua.kt)::int AS phien,
            (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t.ms)
               FROM telemetry t JOIN nhom ON nhom.user_id = t.user_id, cua
              WHERE t.loai = 'phien_dong' AND t.ms IS NOT NULL
                AND t.ts >= cua.bd_tho AND t.ts < cua.kt)::float8 AS ms_tv,
            (SELECT count(*) FROM holdem_matches m JOIN nhom ON nhom.user_id = m.owner_user_id, cua
              WHERE m.started_at >= cua.bd AND m.started_at < cua.kt ${cheat})::int AS tran,
            (SELECT count(*) FROM nhom WHERE EXISTS (
               SELECT 1 FROM telemetry t WHERE t.user_id = nhom.user_id AND t.loai = 'huong_dan_buoc'
                  AND t.chi_tiet->>'buoc' = 'het'))::int AS xong_tap,
            (SELECT count(*) FROM nhom WHERE nhom.pfm_bat_dau IS NOT NULL)::int AS dung_tc`,
    [tu, den, tho, ...md.tham],
  );
  if (r.n < SAN) return { n: null, chi_so: null };
  // Quay lại tuần 2 của CHÍNH nhóm này — nhóm tạo tài khoản bất kỳ lúc nào (không cắt theo khoảng).
  const md5 = menhDePhanKhuc(dk, 5, homNay);
  const quay = await quayLaiCua(db, '2000-01-01', homNay, tho, homNay, gom, md5.sql, md5.tham);
  return {
    n: r.n,
    chi_so: {
      n: r.n,
      vao_app: doDuoc ? r.vao_app : null,
      phien: doDuoc ? r.phien : null,
      ms_moi_phien_tv: doDuoc && r.ms_tv !== null ? Math.round(r.ms_tv) : null,
      tran: r.tran,
      xong_tap: r.xong_tap,
      dung_tai_chinh: r.dung_tc,
      quay_lai: quay,
    },
  };
}

export const THEO_CHIA: readonly TheoChia[] = ['tuoi', 'vung', 'nghe', 'so_tran', 'tuan_tao'];
/** Rổ số trận đã xong — cận dưới của từng rổ. */
export const RO_SO_TRAN = [0, 1, 3, 10] as const;
/** Số tuần tạo tài khoản chia riêng; cũ hơn gộp một rổ. */
export const SO_TUAN_CHIA = 12;

/**
 * Gom người thành các nhóm con — HÀM THUẦN. Thứ tự khoá cố định (danh mục C7 / rổ tăng dần) để hai lần đọc
 * so được với nhau. Nhóm dưới sàn: mọi số null, nhưng DÒNG VẪN CÒN — "có một nhóm nhỏ ở đây" khác "không có nhóm".
 */
export function gomChia(
  theo: TheoChia,
  nguoi: Array<{ tuoi: string; vung: string; nghe: string; c: string; so_xong: number; tran_k: number; quay_du: boolean; quay_co: boolean }>,
  homNay: string,
): ONhomChia[] {
  const khoaCua = (x: (typeof nguoi)[number]): string => {
    if (theo === 'tuoi') return x.tuoi;
    if (theo === 'vung') return x.vung;
    if (theo === 'nghe') return x.nghe;
    if (theo === 'so_tran') {
      let k: number = RO_SO_TRAN[0];
      for (const can of RO_SO_TRAN) if (x.so_xong >= can) k = can;
      return String(k);
    }
    const tuan = Math.floor(hieuNgay(x.c, homNay) / 7);
    return tuan >= SO_TUAN_CHIA ? `${SO_TUAN_CHIA}+` : String(tuan);
  };
  const khoaDs: string[] =
    theo === 'tuoi' ? [...DEMOGRAPHIC.AGE_BANDS]
      : theo === 'vung' ? [...DEMOGRAPHIC.REGIONS]
        : theo === 'nghe' ? [...DEMOGRAPHIC.OCCUPATION_BANDS]
          : theo === 'so_tran' ? RO_SO_TRAN.map(String)
            : [...Array.from({ length: SO_TUAN_CHIA }, (_, i) => String(i)), `${SO_TUAN_CHIA}+`];
  return khoaDs.map((khoa) => {
    const ds = nguoi.filter((x) => khoaCua(x) === khoa);
    if (ds.length < SAN) return { khoa, n: ds.length === 0 ? 0 : null, tran: null, quay_lai: null };
    const du = ds.filter((x) => x.quay_du);
    return {
      khoa, n: ds.length,
      tran: ds.reduce((a, x) => a + x.tran_k, 0),
      quay_lai: du.length < SAN ? null : { nhom: du.length, co: du.filter((x) => x.quay_co).length },
    };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * ROUTES
 * ══════════════════════════════════════════════════════════════════════════ */

const MAU_HANDLE = /^[a-z0-9_]{3,20}$/;

/** `tu`/`den` nằm trong body JSON (route POST) — cùng luật đọc với query. */
const docTuBody = (body: unknown) => (x: string): string | undefined => {
  if (x !== 'tu' && x !== 'den') return undefined;
  const v = (body as Record<string, unknown> | null)?.[x];
  return typeof v === 'string' ? v : undefined;
};

export function registerAdminPhanTichRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: { requireAuth: Middleware; requireOnboarded: Middleware; requireAdmin: Middleware },
): void {
  const guard = [mw.requireAuth, mw.requireOnboarded, mw.requireAdmin] as const;

  /* ── TỔNG QUAN ────────────────────────────────────────────────────────── */
  app.get('/api/v1/admin/pt/tong-quan', ...guard, async (c) => {
    const bayGio = Date.now();
    const q = (k: string) => c.req.query(k);
    const k = docKhoang(q, bayGio);
    const gom = docGom(q);
    const kq = await docMotAnh(pool, async (db) => {
      const tho = await layTho(db, bayGio);
      const { rows: [pv] } = await db.query(
        `WITH ${cteNguoi(gom)} SELECT count(*)::int AS tat_ca,
                count(*) FILTER (WHERE research_consent)::int AS bat_ghi FROM nguoi`);
      return {
        tho,
        pham_vi: { tat_ca: pv.tat_ca, bat_ghi: pv.bat_ghi },
        nay: await oSo(db, k.tu, k.den, tho, k.hom_nay, gom),
        truoc: await oSo(db, k.ky_truoc.tu, k.ky_truoc.den, tho, k.hom_nay, gom),
        chuoi: await chuoiNgay(db, k.tu, k.den, tho, gom),
        pheu: await pheuNguoiMoi(db, k.tu, k.den, tho, k.hom_nay, gom),
        giu_chan: await giuChan(db, k.den, tho, k.hom_nay, gom),
        man: await manDung(db, k.tu, k.den, tho, gom),
        loi: await loiGap(db, k.tu, k.den, tho, gom),
      };
    });
    const { tho, ...phan } = kq;
    const traVe: TongQuanTraVe = { khoang: { ...k, tho_tu: tho }, gom, san: SAN, ...phan };
    return c.json(traVe);
  });

  /* ── NGƯỜI DÙNG: danh sách ────────────────────────────────────────────── */
  app.get('/api/v1/admin/pt/nguoi', ...guard, async (c) => {
    const bayGio = Date.now();
    const q = (x: string) => c.req.query(x);
    const k = docKhoang(q, bayGio);
    const gom = docGom(q);
    const tim = (q('tim') ?? '').trim().toLowerCase().slice(0, 20);
    const loc = new Set((q('loc') ?? '').split(','));
    const sap = ({ cuoi: 'lan_cuoi DESC NULLS LAST', phien: 'phien DESC NULLS LAST', tran: 'tran DESC',
      tao: 'created_at DESC' } as const)[(q('sap') ?? 'cuoi') as 'cuoi'] ?? 'lan_cuoi DESC NULLS LAST';
    const trang = Math.max(0, Math.min(1000, Math.trunc(Number(q('trang')) || 0)));
    const MOI_TRANG = 50;
    // D359: bàn tập đi cùng cheat dưới CÙNG công tắc `gom` — tệp này vốn một công tắc cho mọi
  // thứ "không đại diện" (admin + tester + ép tham số), thêm một trục thứ tư là lệch thiết kế.
  const cheat = ghepLoc(loaiTranCheat(gom, 'm.'), loaiTranTap(gom, 'm.'));

    const kq = await docMotAnh(pool, async (db) => {
      const tho = await layTho(db, bayGio);
      const { rows } = await db.query(
        `WITH x AS (
           SELECT u.handle, u.created_at, u.age_band, u.region, u.occupation_band,
                  u.research_consent AS bat_ghi, (u.role = 'admin') AS quan_tri, u.la_tester AS thu,
                  u.la_khach AS khach,
                  CASE WHEN u.research_consent THEN (
                    SELECT count(*)::int FROM telemetry t WHERE t.user_id = u.user_id AND t.loai = 'phien_mo'
                       AND t.ts >= ${dauNgay('greatest($1::date, $3::date)')} AND t.ts < ${dauNgay('$2::date + 1')}
                  ) END AS phien,
                  (SELECT count(*)::int FROM holdem_matches m WHERE m.owner_user_id = u.user_id
                      AND m.started_at >= ${dauNgay('$1')} AND m.started_at < ${dauNgay('$2::date + 1')} ${cheat}) AS tran,
                  greatest(
                    CASE WHEN u.research_consent THEN (SELECT max(t.ts) FROM telemetry t WHERE t.user_id = u.user_id) END,
                    (SELECT max(m.started_at) FROM holdem_matches m WHERE m.owner_user_id = u.user_id),
                    -- ⚠ Bỏ event của BỘ QUÉT DỌN: \`hd_tran_het_han\` ghi dưới tên người chơi lúc máy đóng sổ trận bỏ
                    -- dở (nhiều giờ, có khi nhiều ngày sau khi họ rời) — tính vào là "lần cuối vào" nói dối.
                    (SELECT max(e.ts) FROM events e WHERE e.user_id = u.user_id AND e.action_type <> 'hd_tran_het_han')
                  ) AS lan_cuoi
             FROM users u
            WHERE u.deleted_at IS NULL
              ${ghepLoc(loaiAdmin(gom, 'u.user_id'), loaiTester(gom, 'u.user_id'))}
              AND ($4 = '' OR position($4 IN u.handle) > 0)
              ${loc.has('ghi') ? 'AND u.research_consent' : ''}
              ${loc.has('moi') ? `AND u.created_at >= ${dauNgay('$1')} AND u.created_at < ${dauNgay('$2::date + 1')}` : ''}
         )
         SELECT *, count(*) OVER ()::int AS tong FROM x
          ${loc.has('tran') ? 'WHERE tran > 0' : ''}
          ORDER BY ${sap}, handle
          LIMIT ${MOI_TRANG} OFFSET ${trang * MOI_TRANG}`,
        [k.tu, k.den, tho, tim],
      );
      return { tho, rows };
    });
    const traVe: DsNguoiTraVe = {
      khoang: { ...k, tho_tu: kq.tho }, gom, trang, moi_trang: MOI_TRANG,
      tong: kq.rows[0]?.tong ?? 0,
      nguoi: kq.rows.map((r) => ({
        handle: r.handle, tao: r.created_at, tuoi: r.age_band, vung: r.region, nghe: r.occupation_band,
        bat_ghi: r.bat_ghi, quan_tri: r.quan_tri, thu: r.thu, khach: r.khach,
        phien: r.phien, tran: r.tran, lan_cuoi: r.lan_cuoi,
      })),
    };
    return c.json(traVe);
  });

  /* ── NGƯỜI DÙNG: một người ────────────────────────────────────────────── */
  app.get('/api/v1/admin/pt/nguoi/:handle', ...guard, async (c) => {
    const handle = c.req.param('handle');
    if (!MAU_HANDLE.test(handle)) return c.json({ error: 'not_found' }, 404);
    const bayGio = Date.now();
    const q = (x: string) => c.req.query(x);
    const k = docKhoang(q, bayGio);
    /** Tải thêm: `truoc` = ngày cũ nhất đã hiện ⇒ lần này đọc tới hết ngày trước nó. */
    const truoc = q('truoc');
    const denTai = truoc && laNgayThat(truoc) && truoc <= k.den ? congNgay(truoc, -1) : k.den;
    const actor = c.get('actor');

    const kq = await docMotAnh(pool, async (db) => {
      const tho = await layTho(db, bayGio);
      const { rows: [u] } = await db.query(
        `SELECT u.user_id, u.handle, u.created_at, u.age_band, u.region, u.occupation_band,
                u.research_consent AS bat_ghi, (u.role = 'admin') AS quan_tri, u.la_tester AS thu, u.la_khach AS khach,
                (SELECT count(*)::int FROM holdem_matches m WHERE m.owner_user_id = u.user_id) AS tong_tran
           FROM users u WHERE u.handle = $1 AND u.deleted_at IS NULL`, [handle]);
      if (!u) return null;
      const id = u.user_id as string;
      const tele = u.bat_ghi === true; // luật 4 — đọc lúc XEM

      const { rows: [o] } = await db.query(
        `SELECT
           (SELECT count(*)::int FROM telemetry t WHERE t.user_id = $1 AND t.loai = 'phien_mo'
               AND t.ts >= ${dauNgay('greatest($2::date, $4::date)')} AND t.ts < ${dauNgay('$3::date + 1')}) AS phien,
           (SELECT COALESCE(sum(t.ms), 0)::bigint FROM telemetry t WHERE t.user_id = $1 AND t.loai = 'phien_dong'
               AND t.ts >= ${dauNgay('greatest($2::date, $4::date)')} AND t.ts < ${dauNgay('$3::date + 1')}) AS ms,
           (SELECT count(*)::int FROM telemetry t WHERE t.user_id = $1 AND t.loai IN ('loi_api', 'loi_client')
               AND t.ts >= ${dauNgay('greatest($2::date, $4::date)')} AND t.ts < ${dauNgay('$3::date + 1')}) AS loi,
           (SELECT count(*)::int FROM holdem_matches m WHERE m.owner_user_id = $1
               AND m.started_at >= ${dauNgay('$2')} AND m.started_at < ${dauNgay('$3::date + 1')}) AS tran`,
        [id, k.tu, k.den, tho]);

      const gio: number[][] | null = tele ? Array.from({ length: 7 }, () => Array(24).fill(0)) : null;
      if (gio) {
        const { rows } = await db.query(
          `SELECT extract(isodow FROM t.ts AT TIME ZONE '${TZ}')::int AS thu,
                  extract(hour FROM t.ts AT TIME ZONE '${TZ}')::int AS gio, count(*)::int AS n
             FROM telemetry t WHERE t.user_id = $1 AND t.loai = 'phien_mo'
              AND t.ts >= ${dauNgay('greatest($2::date, $4::date)')} AND t.ts < ${dauNgay('$3::date + 1')}
            GROUP BY 1, 2`, [id, k.tu, k.den, tho]);
        for (const r of rows) gio[r.thu - 1]![r.gio] = r.n;
      }

      /*
       * Chọn NGÀY cho lượt tải này: mới nhất trước, cộng dồn số dòng tới trần. Đếm theo đúng ba nguồn sẽ hiện —
       * telemetry (chỉ khi bật ghi) · trận · token — để trần là trần thật, không phải ước lượng.
       */
      const { rows: ngayRows } = await db.query(
        `WITH d AS (
           SELECT ${ngayCua('t.ts')} AS ngay, count(*)::int AS n FROM telemetry t
            WHERE $5::boolean AND t.user_id = $1
              AND t.ts >= ${dauNgay('greatest($2::date, $4::date)')} AND t.ts < ${dauNgay('$3::date + 1')}
            GROUP BY 1
           UNION ALL
           SELECT ${ngayCua('m.started_at')}, 2 FROM holdem_matches m
            WHERE m.owner_user_id = $1 AND m.started_at >= ${dauNgay('$2')} AND m.started_at < ${dauNgay('$3::date + 1')}
           UNION ALL
           SELECT ${ngayCua('w.created_at')}, 1 FROM wallet_ledger w
            WHERE w.user_id = $1 AND w.created_at >= ${dauNgay('$2')} AND w.created_at < ${dauNgay('$3::date + 1')}
         )
         SELECT ngay::text AS ngay, sum(n)::int AS n FROM d GROUP BY ngay ORDER BY ngay DESC`,
        [id, k.tu, denTai, tho, tele]);
      let cong = 0;
      const chon: string[] = [];
      for (const r of ngayRows) {
        if (chon.length > 0 && cong + r.n > TRAN_DONG_THOI_GIAN) break;
        chon.push(r.ngay); cong += r.n;
      }
      let ngay: NgayDong[] = [];
      let conNua: string | null = null;
      if (chon.length) {
        const cu = chon[chon.length - 1]!;
        const moi = chon[0]!;
        conNua = ngayRows.length > chon.length ? cu : null;
        const teleRows: DongTho[] = tele ? (await db.query(
          `SELECT id, ts, loai, man, ms, chi_tiet FROM telemetry
            WHERE user_id = $1 AND ts >= ${dauNgay('greatest($2::date, $4::date)')} AND ts < ${dauNgay('$3::date + 1')}
            ORDER BY id`, [id, cu, moi, tho])).rows.map((r) => ({ ...r, id: Number(r.id) })) : [];
        const tranRows: DongTran[] = (await db.query(
          `SELECT m.match_id, m.started_at, m.status, m.so_o, m.che_do,
                  (b.loai IS NOT DISTINCT FROM 'buoi_do') AS buoi_do,
                  r.hang,
                  (SELECT count(*)::int FROM holdem_results r2 WHERE r2.match_id = m.match_id) AS so_ghe,
                  CASE WHEN m.status = 'xong' THEN m.ended_at
                       WHEN m.status = 'bo_dở' THEN (SELECT max(e.ts) FROM events e
                         WHERE e.context_id = m.match_id::text AND e.action_type <> 'hd_tran_het_han')
                  END AS ket_luc
             FROM holdem_matches m
             LEFT JOIN holdem_ban b ON b.ma = m.ban_ma
             LEFT JOIN holdem_results r ON r.match_id = m.match_id AND r.user_id = m.owner_user_id
            WHERE m.owner_user_id = $1
              AND m.started_at >= ${dauNgay('$2')} AND m.started_at < ${dauNgay('$3::date + 1')}
            ORDER BY m.started_at`, [id, cu, moi])).rows.map((r) => ({
          ...r, buoi_do: r.buoi_do === true, so_ghe: r.so_ghe || null,
        }));
        const tokenRows: DongToken[] = (await db.query(
          `SELECT created_at AS ts, delta::float8 AS delta, reason FROM wallet_ledger
            WHERE user_id = $1 AND created_at >= ${dauNgay('$2')} AND created_at < ${dauNgay('$3::date + 1')}
            ORDER BY entry_id`, [id, cu, moi])).rows;
        ngay = dungDongThoiGian(teleRows, tranRows, tokenRows);
      }

      // Nhật ký quản trị: MỘT dòng mỗi lần mở trang (lượt đầu), không phải mỗi lần tải thêm.
      return {
        tho, u, o, gio, ngay, conNua, tele,
        ghiNhatKy: !truoc,
      };
    });
    if (!kq) return c.json({ error: 'not_found' }, 404);
    if (kq.ghiNhatKy) {
      await pool.query(
        `INSERT INTO admin_audit (admin_id, action, payload_json) VALUES ($1, 'xem_nguoi', $2)`,
        // SPEC chan-truoc-beta (founder 11/10 "A"): `admin_audit` append-only ⇒ ghi user_id, KHÔNG ghi tên — tên trong dòng không
        // xoá được là đường từ user_id về danh tính còn sống sau khi người ấy xoá tài khoản.
        [actor.userId, JSON.stringify({ user_id: kq.u.user_id, tu: k.tu, den: k.den })]);
    }
    const u = kq.u;
    const traVe: MotNguoiTraVe = {
      khoang: { ...k, tho_tu: kq.tho },
      ho_so: {
        handle: u.handle, tao: u.created_at, tuoi: u.age_band, vung: u.region, nghe: u.occupation_band,
        bat_ghi: u.bat_ghi, quan_tri: u.quan_tri, thu: u.thu, khach: u.khach, tong_tran: u.tong_tran,
      },
      o: {
        phien: kq.tele ? kq.o.phien : null,
        ms_trong_app: kq.tele ? Number(kq.o.ms) : null,
        loi: kq.tele ? kq.o.loi : null,
        tran: kq.o.tran,
      },
      gio: kq.gio,
      ngay: kq.ngay,
      con_nua_truoc: kq.conNua,
    };
    return c.json(traVe);
  });

  /* ── PHÂN KHÚC: nhóm đã lưu ───────────────────────────────────────────── */
  app.get('/api/v1/admin/pt/phan-khuc', ...guard, async (c) => {
    const { rows } = await pool.query(
      `SELECT p.id::text AS id, p.ten, p.dieu_kien, p.tao_luc, u.handle AS tao_boi
         FROM admin_phan_khuc p JOIN users u ON u.user_id = p.tao_boi
        WHERE p.xoa_luc IS NULL ORDER BY p.tao_luc`);
    const traVe: DsNhomLuuTraVe = { nhom: rows };
    return c.json(traVe);
  });

  app.post('/api/v1/admin/pt/phan-khuc', ...guard, async (c) => {
    const body = await c.req.json().catch(() => null) as { ten?: unknown; dieu_kien?: unknown } | null;
    const ten = typeof body?.ten === 'string' ? body.ten.trim() : '';
    if (ten.length < 1 || ten.length > 60) {
      return c.json({ error: 'ten_khong_hop_le', message: 'Tên nhóm dài 1–60 ký tự.' }, 400);
    }
    const dk = docDieuKien(body?.dieu_kien);
    if (!dk) return c.json({ error: 'dieu_kien_khong_hop_le', message: 'Điều kiện không đọc được.' }, 400);
    const { rows: [r] } = await pool.query(
      `INSERT INTO admin_phan_khuc (ten, dieu_kien, tao_boi) VALUES ($1, $2, $3) RETURNING id::text AS id`,
      [ten, JSON.stringify(dk), c.get('actor').userId]);
    const traVe: LuuNhomTraVe = { id: r.id, ten, dieu_kien: dk };
    return c.json(traVe, 201);
  });

  // POST chứ không DELETE: client chung (`web/src/api/client.ts`) chỉ nói GET/POST — một động từ mới cho đúng một nút
  // xoá là mở rộng lõi dùng chung để phục vụ một chỗ.
  app.post('/api/v1/admin/pt/phan-khuc/:id/xoa', ...guard, async (c) => {
    const id = c.req.param('id');
    if (!/^\d{1,18}$/.test(id)) return c.json({ error: 'not_found' }, 404);
    const { rowCount } = await pool.query(
      `UPDATE admin_phan_khuc SET xoa_luc = now() WHERE id = $1 AND xoa_luc IS NULL`, [id]);
    return rowCount ? c.json({ ok: true }) : c.json({ error: 'not_found' }, 404);
  });

  /* ── PHÂN KHÚC: tính một hoặc nhiều nhóm ──────────────────────────────── */
  app.post('/api/v1/admin/pt/phan-khuc/tinh', ...guard, async (c) => {
    const bayGio = Date.now();
    const body = await c.req.json().catch(() => null) as
      { nhom?: unknown; tu?: unknown; den?: unknown; gom?: unknown } | null;
    const ds = Array.isArray(body?.nhom) ? body!.nhom.slice(0, 4).map(docDieuKien) : [];
    if (ds.length === 0 || ds.some((x) => x === null)) {
      return c.json({ error: 'dieu_kien_khong_hop_le', message: 'Cần 1–4 nhóm điều kiện hợp lệ.' }, 400);
    }
    const k = docKhoang(docTuBody(body), bayGio);
    const gom = body?.gom === true;
    const kq = await docMotAnh(pool, async (db) => {
      const tho = await layTho(db, bayGio);
      const ra = [];
      for (const dk of ds) ra.push(await chiSoNhom(db, dk!, k.tu, k.den, tho, k.hom_nay, gom));
      return { tho, ra };
    });
    const traVe: TinhNhomTraVe = { khoang: { ...k, tho_tu: kq.tho }, gom, san: SAN, nhom: kq.ra };
    return c.json(traVe);
  });

  /* ── PHÂN KHÚC: chia một nhóm theo một chiều ──────────────────────────── */
  app.post('/api/v1/admin/pt/phan-khuc/chia', ...guard, async (c) => {
    const bayGio = Date.now();
    const body = await c.req.json().catch(() => null) as
      { dieu_kien?: unknown; theo?: unknown; tu?: unknown; den?: unknown; gom?: unknown } | null;
    const dk = docDieuKien(body?.dieu_kien);
    const theo = THEO_CHIA.find((t) => t === body?.theo);
    if (!dk || !theo) return c.json({ error: 'dieu_kien_khong_hop_le', message: 'Điều kiện hoặc chiều chia không hợp lệ.' }, 400);
    const k = docKhoang(docTuBody(body), bayGio);
    const gom = body?.gom === true;
    const md = menhDePhanKhuc(dk, 5, k.hom_nay);
    // D359: bàn tập đi cùng cheat dưới CÙNG công tắc `gom` — tệp này vốn một công tắc cho mọi
  // thứ "không đại diện" (admin + tester + ép tham số), thêm một trục thứ tư là lệch thiết kế.
  const cheat = ghepLoc(loaiTranCheat(gom, 'm.'), loaiTranTap(gom, 'm.'));
    const c0 = ngayCua('nguoi.created_at');
    const kq = await docMotAnh(pool, async (db) => {
      const tho = await layTho(db, bayGio);
      const { rows } = await db.query(
        `WITH ${cteNguoi(gom)}
         SELECT nguoi.age_band AS tuoi, nguoi.region AS vung, nguoi.occupation_band AS nghe, ${c0}::text AS c,
                (SELECT count(*)::int FROM holdem_results r WHERE r.user_id = nguoi.user_id) AS so_xong,
                (SELECT count(*)::int FROM holdem_matches m WHERE m.owner_user_id = nguoi.user_id
                    AND m.started_at >= ${dauNgay('$1')} AND m.started_at < ${dauNgay('$2::date + 1')} ${cheat}) AS tran_k,
                (${c0} + 13 <= $4::date AND ${c0} + 7 >= $3::date) AS quay_du,
                EXISTS (SELECT 1 FROM telemetry t WHERE t.user_id = nguoi.user_id AND t.loai = 'phien_mo'
                         AND t.ts >= ((${c0} + 7)::timestamp AT TIME ZONE '${TZ}')
                         AND t.ts <  ((${c0} + 14)::timestamp AT TIME ZONE '${TZ}')) AS quay_co
           FROM nguoi WHERE nguoi.research_consent ${md.sql}`,
        [k.tu, k.den, tho, k.hom_nay, ...md.tham]);
      return { tho, rows };
    });
    const tong = kq.rows.length;
    const traVe: ChiaNhomTraVe = {
      khoang: { ...k, tho_tu: kq.tho }, gom, san: SAN, theo,
      n: tong < SAN ? null : tong,
      nhom: tong < SAN ? [] : gomChia(theo, kq.rows, k.hom_nay),
    };
    return c.json(traVe);
  });
}
