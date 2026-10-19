/**
 * THỐNG KÊ QUẢN TRỊ — tầng CŨ (bản yêu cầu 01 §4), nay còn hai vai.
 *
 *  1. HÀNG RÀO DÙNG CHUNG cho mọi tầng số của app quản trị: loại tài khoản quản trị (D212) · loại tài khoản thử
 *     (0052) · loại trận ép tham số · bộ lọc phiên bản (founder 31/08). `admin_phan_tich.ts` và
 *     `admin_san_pham.ts` import từ đây — MỘT bản.
 *  2. `GET /api/v1/admin/tk/tong-quan` — sức khoẻ hệ thống (kho · kiểm toán cung · lỗi gọi máy chủ), khu VẬN HÀNH.
 *
 * Đã rời đi: mặt NHÓM + NGƯỜI (`/tk/nhom`, `/tk/nguoi*`) — khu PHÂN KHÚC và NGƯỜI DÙNG thay từ D335, gỡ hẳn ở D341
 * đúng hẹn "commit kế tiếp chạm tệp này"; năm mặt SẢN PHẨM (`/tk/hanh-trinh|tran|keo|tinh-cach|phien-ban`) — viết
 * lại theo khoảng ngày ở `admin_san_pham.ts` (D341), URL giữ nguyên.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { PHIEN_BAN_SONG, duocVaoPhanTich } from '../config/giai_doan.js';
import { HOLDEM_BALANCE_VERSION, SEED_MAN_TAP_MOI_THOI } from '../config/holdem.js';
import { TELEMETRY } from '../config/telemetry.js';
import { auditSupply } from './audit.js';

import type { Env, Mw as Middleware } from './http/types.js';

/** Cửa sổ mặc định + trần, tính bằng ngày. */
const CUA_SO_MAC_DINH = 30;
const CUA_SO_TOI_DA = 365;

/* ══════════════════════════════════════════════════════════════════════════
 * LOẠI HÀNH VI CỦA ADMIN KHỎI PHÂN TÍCH (D212)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Founder 01/09: *"dashboard không hiện dữ liệu hành vi của admin để tránh
 * rối/loãng với user."*
 *
 * ⚠ ĐO TRƯỚC KHI LÀM, và con số quyết định luôn hình dạng lời giải. Prod 01/09:
 * **2/26 tài khoản là admin (8%) nhưng họ sở hữu 84% số trận, 83% event, 84%
 * `hanh_vi_tran`, 100% hồ sơ tính cách.** Mặt phân tích đang là gương soi chính
 * người đi test — mỗi tỷ lệ "người ta hay làm X" đọc được ở đó thật ra là
 * "founder hay làm X".
 *
 * ⚠⚠ KHÔNG CẦN THAM SỐ BIND — có chủ đích. Mệnh đề này là một câu con hằng, nên
 * chèn được vào BẤT KỲ chỗ nào trong WHERE mà không xê dịch đánh số `$n`. Ở một
 * tệp có ~40 chỗ truy vấn với đánh số tay, một hàng rào cần thêm `$n` là một
 * hàng rào sẽ gây lệch tham số ở chỗ thứ mười mấy — và lệch kiểu đó không nổ,
 * nó chỉ trả sai số.
 *
 * ⚠ `IS NULL OR` là BẮT BUỘC, không phải cho gọn: trong SQL, `x NOT IN (…)` trả
 * NULL chứ không phải TRUE khi `x` NULL, nên thiếu vế đó là lặng lẽ vứt mọi
 * dòng không gắn user (event hệ thống, telemetry khách chưa định danh).
 */
export function loaiAdmin(gom: boolean, cot: string): string {
  if (gom) return '';
  return `AND (${cot} IS NULL OR ${cot} NOT IN (
            SELECT user_id FROM users WHERE role = 'admin' AND deleted_at IS NULL))`;
}

/**
 * Đọc công tắc. MẶC ĐỊNH là LOẠI — founder muốn mặt sạch, và một mặc định
 * "gộp" thì cái sạch chỉ có khi ai đó nhớ bấm.
 *
 * Vì sao vẫn có đường bật: admin cần soi chính hành động mình vừa làm có sinh
 * ra event không. Bỏ hẳn đường đó là đẩy người ta xuống tra tay bằng SQL, và
 * lúc đó thì chẳng còn lớp lọc nào cả.
 */
export const docGomAdmin = (q: (k: string) => string | undefined): boolean =>
  q('gom_admin') === '1';

/*
 * ══════════════════════════════════════════════════════════════════════════
 * LOẠI TESTER KHỎI PHÂN TÍCH (0052) — LỚP THỨ TƯ, ĐỘC LẬP VỚI `loaiAdmin` Ở
 * TRÊN VÀ VỚI `config/giai_doan.ts` / `server/rieng_tu.ts`
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `role='admin'` và `la_tester` là HAI TRỤC KHÁC NHAU (migrations/0052: "Đòi
 * thêm la_tester... tách hai quyền ra: quản trị là chuyện vận hành, cheat là
 * chuyện thử nghiệm"). D208 mở đường uỷ quyền admin cho người KHÔNG PHẢI
 * founder — người đó không nên tự động biến mất khỏi dashboard chỉ vì họ là
 * admin, và một tester tương lai không nhất thiết mang role admin. Nên đây
 * KHÔNG phải viết lại `loaiAdmin`; đây là một hàng rào riêng, ghép cạnh hàng
 * rào cũ bằng `ghepLoc`, có công tắc bật riêng (`gom_tester`).
 */
export function loaiTester(gom: boolean, cot: string): string {
  if (gom) return '';
  return `AND (${cot} IS NULL OR ${cot} NOT IN (
            SELECT user_id FROM users WHERE la_tester AND deleted_at IS NULL))`;
}

/** Cùng khuôn `docGomAdmin` — mặc định LOẠI tester, bật rõ ràng bằng `gom_tester=1`. */
export const docGomTester = (q: (k: string) => string | undefined): boolean =>
  q('gom_tester') === '1';

/**
 * Ghép nhiều mệnh đề "loại ai" lại một chỗ. Mỗi mệnh đề trả `''` hoặc
 * `AND (...)`; nối bằng KHOẢNG TRẮNG chứ không phải nối chuỗi trần — hai
 * `AND (...)` dính liền nhau (`)AND (`) là lỗi cú pháp SQL, và đó chính là
 * bẫy mà một hàm nối riêng dựng ra để không ai giẫm phải ở từng chỗ gọi.
 */
export function ghepLoc(...manh: string[]): string {
  return manh.filter(Boolean).join(' ');
}

/**
 * Loại TRẬN tự thân đánh dấu `co_ep_tham_so` (0052) — phòng thủ chiều sâu,
 * ĐỘC LẬP với `loaiTester` (lọc theo CHỦ tài khoản HÔM NAY). Chủ một trận có
 * thể mất cờ `la_tester` sau khi trận đã tạo (hiếm, nhưng cột không cấm) —
 * lúc đó `loaiTester` không còn thấy trận này nữa dù dữ liệu của nó vẫn sinh
 * ra dưới tham số ép tay. Cột trên chính DÒNG TRẬN là sự thật KHÔNG đổi theo
 * thời gian, nên đây là lớp thứ hai, không phải lớp thay thế.
 * Dùng CHUNG công tắc `gom_tester`: một chữ, một câu hỏi duy nhất cho người
 * đọc dashboard — "có muốn xem dữ liệu thử nghiệm/cheat không".
 */
export function loaiTranCheat(gom: boolean, alias: string): string {
  return gom ? '' : `AND NOT ${alias}co_ep_tham_so`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * LOẠI BÀN TẬP KHỎI SỐ CỦA TRẬN THẬT (D359, founder 20/09) — LỚP THỨ NĂM
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Founder 20/09: *"bàn tập chỉ thu dữ liệu product cho phần hướng dẫn thôi. Màn chơi thật
 * thu dữ liệu phổ thông."* — hai câu hỏi khác nhau, hai rổ khác nhau.
 *
 * ⚠⚠ VÌ SAO TRỘN LÀ SAI HẲN, KHÔNG PHẢI "HƠI NHIỄU". Bàn tập KHÔNG phải một trận dễ; nó
 * là một trò khác:
 *   · seed GHIM (`seedManTap`) ⇒ mọi người chơi đúng một bàn cờ, không phải mẫu ngẫu nhiên;
 *   · MIỄN GIỜ vòng 1–4 (D53) ⇒ không có áp lực thời gian, thứ mà cả thiết kế trận dựa vào;
 *   · đám đông KHÔNG đổi được ô (D302) ⇒ cơ chế phản thân — trục đo chính — bị tắt;
 *   · Oracle dắt tay từng bước ⇒ "nghe Oracle" không còn là một lựa chọn để đo.
 * Đổ chung rổ thì phân bố hạng gần như hằng số của bàn tập kéo mọi tỷ lệ về phía nó, theo
 * đúng tỷ lệ NGƯỜI MỚI trong mẫu — tức sai nhiều nhất đúng lúc đang đo người mới (buổi đo).
 *
 * ⚠ LỌC THEO `seed`, KHÔNG THEO CỘT: `holdem_matches` không có cột `man_tap` (0010), và cờ
 * `man_tap` của `hanh_vi_vong` (0043) nằm ở bảng PHÁI SINH — mặt admin đọc thẳng
 * `holdem_matches` nên không với tới. `seed` là sự thật GỐC, không đổi theo thời gian, y hệt
 * lý do `co_ep_tham_so` nằm trên chính dòng trận.
 *
 * ⚠⚠ KHÔNG CẦN THAM SỐ BIND — cùng chủ đích với `loaiAdmin`: mệnh đề hằng chèn được vào bất
 * kỳ chỗ nào trong WHERE mà không xê dịch đánh số `$n`. Số nội suy là `number` hằng của
 * `config/holdem.ts`, không phải đầu vào người dùng; hàng rào `Number.isSafeInteger` dưới là
 * để một seed hỏng làm câu SQL NỔ chứ không lặng lẽ lọc sai.
 *
 * ⚠ `alias` mang sẵn dấu chấm (`'m.'`) — giống `loaiTranCheat`, không giống `loaiAdmin`.
 */
const SEED_TAP_SQL = ((): string => {
  const xau = SEED_MAN_TAP_MOI_THOI.map((s) => {
    if (!Number.isSafeInteger(s)) throw new Error(`seed bàn tập không phải số nguyên: ${s}`);
    return String(s);
  });
  if (xau.length === 0) throw new Error('SEED_MAN_TAP_MOI_THOI rỗng — lọc bàn tập sẽ câm');
  return xau.join(', ');
})();

export function loaiTranTap(gom: boolean, alias: string): string {
  return gom ? '' : `AND ${alias}seed NOT IN (${SEED_TAP_SQL})`;
}

/** Mệnh đề ĐẢO — dùng cho mặt MÀN HƯỚNG DẪN, nơi bàn tập là chủ đề chứ không phải nhiễu. */
export function chiTranTap(alias: string): string {
  return `AND ${alias}seed IN (${SEED_TAP_SQL})`;
}

/**
 * Đọc công tắc. MẶC ĐỊNH là LOẠI — cùng lý do với `docGomAdmin`: một mặc định "gộp" thì cái
 * sạch chỉ có khi ai đó nhớ bấm, và ba tháng qua không ai bấm vì không ai biết là có gì để bấm.
 *
 * ⚠ CHỈ `admin_san_pham.ts` ĐỌC CÔNG TẮC NÀY. Tệp đó có hai công tắc rời (`gom_admin`,
 * `gom_tester`) nên trục thứ ba đứng riêng là đúng hình. `admin_phan_tich.ts` thì ngược lại —
 * nó có MỘT `gom` gộp mọi thứ "không đại diện", nên ở đó bàn tập đi kèm `gom` luôn. Hai cách
 * đọc khác nhau là vì hai tệp vốn khác thiết kế, không phải vì sót.
 */
export const docGomTap = (q: (k: string) => string | undefined): boolean =>
  q('gom_tap') === '1';

const soNgay = (v: string | undefined): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return CUA_SO_MAC_DINH;
  return Math.min(Math.max(Math.trunc(n), 1), CUA_SO_TOI_DA);
};

/* ══════════════════════════════════════════════════════════════════════════
 * BỘ LỌC PHIÊN BẢN (founder 31/08)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Ba chế độ xem, và MẶC ĐỊNH là `hien_tai` — đây là chỗ chỉ thị của founder
 * được thi hành, nên nói rõ vì sao mặc định như thế.
 *
 * Trước bản này mọi mặt phân tích gộp TRỌN 21 phiên bản cân bằng vào một rổ
 * (đo prod 31/08: `balance-v2-D20lever` một mình chiếm 81/179 trận = 45%, còn
 * phiên bản đang chạy chỉ có 10). Một tỷ lệ gộp như thế không "hơi nhiễu" — nó
 * chủ yếu mô tả một trò đã bị thay luật 32 lần. Để mặc định là "tất cả" tức là
 * để con số sai làm mặc định và bắt người đọc phải nhớ bấm lọc; đảo lại thì
 * người đọc phải chủ động bấm mới thấy số gộp, và lúc đó là họ CỐ Ý.
 */
export type CheDoXemVer = 'hien_tai' | 'dung_lai_duoc' | 'tat_ca';

export function docVer(q: (k: string) => string | undefined): {
  che_do: CheDoXemVer; ver: string | null;
} {
  const v = q('ver');
  if (v === 'tat_ca') return { che_do: 'tat_ca', ver: null };
  if (v === 'dung_lai_duoc') return { che_do: 'dung_lai_duoc', ver: null };
  // Chuỗi lạ ⇒ coi như chọn đích danh một phiên bản (URL chia sẻ được, không 400).
  if (v) return { che_do: 'hien_tai', ver: v };
  return { che_do: 'hien_tai', ver: HOLDEM_BALANCE_VERSION };
}

/**
 * Mệnh đề WHERE cho bộ lọc phiên bản, áp lên một alias có cột `balance_version`.
 *
 * ⚠⚠ `khong_dung_lai_duoc` BỊ CẮT KỂ CẢ Ở `tat_ca` — và đó là chủ đích, không
 * phải sót. "Tất cả" ở đây nghĩa là *mọi phiên bản còn dựng lại được*, vì dòng
 * của một bộ luật đã biến mất khỏi code không phải là dữ liệu cũ mà là dữ liệu
 * của một thí nghiệm chưa từng chạy (xem `config/giai_doan.ts`). Cho nó vào một
 * ô nào đó của mặt admin là mời người sau cộng nó vào một tỷ lệ.
 * Muốn nhìn chúng thì có mặt riêng: `/tk/phien-ban` liệt kê ĐỦ, kèm nhãn.
 */
export function menhDeVer(
  x: { che_do: CheDoXemVer; ver: string | null }, alias: string, tuSo: number,
): { sql: string; tham: unknown[] } {
  if (x.che_do === 'hien_tai' && x.ver) {
    /*
     * ⚠⚠ GỌI ĐÍCH DANH MỘT PHIÊN BẢN ĐÃ CHẾT ⇒ TRẢ RỖNG, KHÔNG TRẢ SỐ.
     *
     * Lỗ này lọt qua bài `?ver=tat_ca` (bài đó chỉ canh nhánh whitelist) và chỉ
     * lộ khi tự đọc lại: `?ver=balance-v2-D20lever` đi thẳng vào nhánh này và
     * `/tk/tran` sẽ tính phân bố hạng + chuỗi về bét trên 81 trận của một bộ
     * luật không còn tồn tại — đúng thứ cả file `giai_doan.ts` sinh ra để chặn.
     *
     * KHÔNG âm thầm thay bằng whitelist: người hỏi sẽ tưởng con số họ thấy là
     * của phiên bản họ gõ. Trả RỖNG, còn `loc.giai_doan` nói vì sao — mặt admin
     * đọc được và giải thích được. Muốn nhìn phiên bản chết thì có `/tk/phien-ban`.
     */
    if (!duocVaoPhanTich(x.ver)) return { sql: 'AND false', tham: [] };
    return { sql: `AND ${alias}.balance_version = $${tuSo}`, tham: [x.ver] };
  }
  return {
    sql: `AND ${alias}.balance_version = ANY($${tuSo}::text[])`,
    tham: [PHIEN_BAN_SONG as string[]],
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * ROUTES
 * ══════════════════════════════════════════════════════════════════════════ */

export function registerAdminThongKeRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: { requireAuth: Middleware; requireOnboarded: Middleware; requireAdmin: Middleware },
): void {
  const guard = [mw.requireAuth, mw.requireOnboarded, mw.requireAdmin] as const;

  /* ────────────────────────────────────────────────────────────────────────
   * 1. TỔNG QUAN — mọi thứ trả lời được NGAY, không chờ telemetry tích luỹ
   * ──────────────────────────────────────────────────────────────────────── */
  app.get('/api/v1/admin/tk/tong-quan', ...guard, async (c) => {
    const ngay = soNgay(c.req.query('ngay'));
    const gom = docGomAdmin((k) => c.req.query(k));
    const gomTester = docGomTester((k) => c.req.query(k));
    const boU = ghepLoc(loaiAdmin(gom, 'user_id'), loaiTester(gomTester, 'user_id'));
    const boM = ghepLoc(loaiAdmin(gom, 'owner_user_id'), loaiTester(gomTester, 'owner_user_id'));

    const [nguoi, kinhTe, keo, tran, kho, loi, loai] = await Promise.all([
      pool.query(
        `SELECT count(*)::int AS tong,
                count(*) FILTER (WHERE created_at > now() - ($1 || ' days')::interval)::int AS moi
           FROM users WHERE deleted_at IS NULL ${boU}`, [ngay]),
      auditSupply(pool),
      pool.query(
        `SELECT status, count(*)::int AS n FROM markets GROUP BY status`),
      /*
       * ⚠ `tong` ở đây là "kho có bao nhiêu trận", KHÔNG phải "có bao nhiêu trận
       * dùng được". Hai con số đó lệch nhau 53% trên prod 31/08 (95/179 mang bộ
       * luật đã biến mất khỏi code), nên từ nay ô này trả CẢ HAI. Một con số
       * "179 trận" đứng một mình ở ngay đầu dashboard là lời nói dối đắt nhất
       * của cả mặt này — nó là thứ founder đọc trước tiên.
       */
      pool.query(
        `SELECT count(*)::int AS tong,
                count(*) FILTER (WHERE status = 'dang_choi')::int AS dang_choi,
                count(*) FILTER (WHERE status = 'xong')::int AS xong,
                count(*) FILTER (WHERE status = 'bo_dở')::int AS bo_do,
                count(*) FILTER (WHERE balance_version IS NULL
                                    OR NOT (balance_version = ANY($1::text[])))::int
                  AS khong_dung_lai_duoc,
                count(*) FILTER (WHERE balance_version = $2)::int AS ver_hien_tai
           FROM holdem_matches WHERE true ${boM}`,
        [PHIEN_BAN_SONG as string[], HOLDEM_BALANCE_VERSION]),
      /*
       * §4.2 mục 14 — dung lượng + tốc độ tăng. Thấy TRƯỚC khi chạm trần 500 MB
       * (C1), không phải lúc đã chạm. `pg_total_relation_size` gồm cả index.
       */
      /*
       * ⚠⚠ KHÔNG LỌC `nspname = 'public'` (sửa 11/08 — rà soát).
       *
       * Bản cũ chỉ nhìn schema `public`, nên bảng TO NHẤT prod hoàn toàn vô
       * hình: `cron.job_run_details` chiếm 20,5 / 38 MB — 54% cả database,
       * lớn hơn mọi bảng nghiệp vụ cộng lại. Một panel dựng ra để canh trần
       * 500 MB (C1) mà không thấy thứ chiếm hơn nửa kho thì nó không cảnh báo,
       * nó RU NGỦ — đúng lớp lỗi D61 mục 3 (số hụt 5 lần cũng "trông hợp lý").
       *
       * Loại đúng ba schema hệ thống của Postgres; mọi thứ khác (`cron`,
       * `extensions`, `auth`…) đều là kho THẬT đang ăn vào trần, nên phải hiện.
       * Tên bảng kèm schema để không lẫn hai bảng trùng tên khác schema.
       */
      pool.query(
        `SELECT pg_database_size(current_database()) AS tong_byte,
                (SELECT COALESCE(json_agg(x), '[]'::json) FROM (
                   SELECT CASE WHEN n.nspname = 'public' THEN c.relname
                               ELSE n.nspname || '.' || c.relname END AS ten,
                          pg_total_relation_size(c.oid) AS byte,
                          c.reltuples::bigint AS uoc_dong
                     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relkind = 'r'
                      AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                    ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 12
                 ) x) AS bang`),
      /*
       * §4.2 mục 12 — TỬ SỐ của sức khoẻ kỹ thuật. Đọc BẢN THÔ vì khối cuộn cố
       * ý không giữ `chi_tiet` (nó là bảng tổng hợp, không phải bảng chi tiết);
       * bù lại luôn có mốc thời gian và cửa sổ kẹp theo hạn lưu 90 ngày.
       * Mẫu số (tổng request, phân bố status máy chủ) đọc ở bảng điều khiển
       * Vercel — miễn phí, 0 byte kho. Xem ghi chú `loi_api` ở config.
       */
      pool.query(
        `SELECT chi_tiet->>'ma' AS ma, count(*)::int AS n
           FROM telemetry
          WHERE loai = 'loi_api' AND ts > now() - ($1 || ' days')::interval ${boU}
          GROUP BY 1 ORDER BY n DESC LIMIT 10`,
        [Math.min(ngay, TELEMETRY.GIU_THO_NGAY)]),
      /*
       * ⚠⚠ ĐẾM PHẦN BỊ LOẠI, VÀ TRẢ NÓ VỀ CÙNG CON SỐ. Một mặt tự lọc trong im
       * lặng thì lần đầu ai đó phát hiện là lần cuối họ tin nó — cùng nguyên tắc
       * với bản kê cột bị khoá ở thẻ KHO (D209) và "nói ra phần bị cắt" (D192).
       * Cụ thể ở đây: loại admin xong, prod 01/09 chỉ còn 14 trận và 0 hồ sơ
       * tính cách. Một mặt trống trơn KHÔNG kèm lời giải thích sẽ bị đọc thành
       * "dashboard hỏng", rồi người ta đi tìm một lỗi không tồn tại (bẫy D86).
       */
      gom
        ? Promise.resolve({ rows: [{ tai_khoan: 0, tran: 0, events: 0 }] })
        : pool.query(
          `SELECT (SELECT count(*)::int FROM users
                    WHERE role = 'admin' AND deleted_at IS NULL) AS tai_khoan,
                  (SELECT count(*)::int FROM holdem_matches m
                    WHERE m.owner_user_id IN (SELECT user_id FROM users
                      WHERE role = 'admin' AND deleted_at IS NULL)) AS tran,
                  (SELECT count(*)::int FROM events e
                    WHERE e.user_id IN (SELECT user_id FROM users
                      WHERE role = 'admin' AND deleted_at IS NULL)) AS events`),
    ]);

    /*
     * ⚠ TỔNG PHẢI LÀ `pg_database_size`, KHÔNG PHẢI TỔNG 12 BẢNG LỚN NHẤT.
     * Bản đầu cộng danh sách bảng và bảo "6,1/500 MB" trong khi database thật
     * là 31,4 MB — hụt hơn 5 lần. Chênh lệch nằm ở các bảng ngoài top 12, chỉ
     * mục ngoài `public`, và chi phí catalog; Supabase tính hạn mức trên
     * DATABASE, không trên mấy bảng ta chọn hiển thị.
     * Mục này (§4.2 điểm 14) sinh ra để thấy TRƯỚC khi chạm trần — một con số
     * hụt 5 lần thì nó làm đúng điều ngược lại: ru ngủ. Lỗi chỉ lộ khi chạy
     * trên dữ liệu prod thật, fixture test không bao giờ bắt được.
     * Danh sách bảng ở lại, nhưng đúng vai của nó: PHÂN RÃ top 12, không phải tổng.
     */
    const tongByte = Number(kho.rows[0].tong_byte);
    const dsBang = (kho.rows[0].bang ?? []) as Array<{
      ten: string; byte: string | number; uoc_dong: string | number;
    }>;
    return c.json({
      cua_so_ngay: ngay,
      gom_admin: gom,
      gom_tester: gomTester,
      da_loai: loai.rows[0],
      nguoi: { tong: nguoi.rows[0].tong, moi_trong_cua_so: nguoi.rows[0].moi },
      kinh_te: { audit_ok: kinhTe.ok, van_de: kinhTe.problems, cung: kinhTe.numbers },
      keo: Object.fromEntries(keo.rows.map((r) => [r.status, r.n])),
      tran: tran.rows[0],
      kho: {
        tong_mb: Math.round((tongByte / 1048576) * 10) / 10,
        tran_mb: 500,
        bang: dsBang.map((r) => ({
          ten: r.ten,
          mb: Math.round((Number(r.byte) / 1048576) * 10) / 10,
          uoc_dong: Number(r.uoc_dong),
        })),
      },
      loi_api: loi.rows,
    });
  });
}
