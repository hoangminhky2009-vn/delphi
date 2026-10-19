/**
 * KHU SẢN PHẨM của app quản trị `/quan-tri` — năm mặt ĐỌC THEO KHOẢNG NGÀY (D341, 16/09/2026).
 *
 * Founder 16/09 trên prod: *"chọn các mốc 7 ngày / 1 ngày / 30 ngày không cho số lượng dữ liệu tương ứng trong
 * khoảng thời gian đó"*. Đo trước khi sửa, trên dữ liệu dựng tay (ba tài khoản tạo lúc 2 giờ · 3 ngày · 20 ngày
 * trước): phễu đăng ký ra `3→3→3→3` ở CẢ BA mốc · "màn cuối" ở mốc Hôm nay rỗng vĩnh viễn · bốn mặt còn lại không
 * nhận khoảng nào. Gốc: năm route này ra đời trước D335 với "N ngày trượt tính tới giờ này" (hoặc không cắt gì), và
 * màn gửi số ngày đọc từ phản hồi TỔNG QUAN — tổng quan chưa về thì mặt đọc số của mốc cũ.
 *
 * ⚠ Từ tệp này khu SẢN PHẨM theo ĐÚNG bảy luật nối dây ở đầu `admin_phan_tich.ts` — không có bộ luật thứ hai, và mọi
 *   mảnh dùng chung (khoảng · đầu ngày VN · ảnh chụp chỉ-đọc · `tho_tu`) import từ đó.
 * ⚠ URL giữ `/admin/tk/*`: sáu tệp test canh bất biến của năm route này (loại quản trị/thử · cắt phiên bản chết ·
 *   cổng đồng ý · trận ép tham số) — giữ URL là giữ các lưới đó nguyên chỗ. Khác duy nhất về hợp đồng: thiếu
 *   `tu`/`den` thì mặc định 30 ngày tới hôm nay (`docKhoang`), không còn "từ đầu".
 * ⚠ Hai công tắc TÁCH RỜI (`gom_admin`, `gom_tester`) chứ không một: bài D224 (`tester_mode` §VI) bật riêng từng
 *   cờ. Màn luôn gửi cả hai (`web/src/api/phantich.ts`).
 *
 * ─── MỖI KHỐI CẮT THEO MỘT TRONG HAI KIỂU — không có kiểu thứ ba ──────────────────────────────────────────────
 *  · SỰ VIỆC TRONG KHOẢNG — thứ xảy ra từ đầu ngày `tu` tới hết ngày `den` (trận bắt đầu · lượt đăng nhập · lượt đặt
 *    cược · cú sập…).
 *  · NHÓM BẮT ĐẦU TRONG KHOẢNG, THEO TỚI HÔM NAY — phễu đăng ký (tài khoản tạo trong khoảng; cùng định nghĩa phễu
 *    người mới ở TỔNG QUAN) · học xong rồi có ở lại · thấy pool rồi có chỉnh · tính cách (người có trận trong
 *    khoảng, hồ sơ dựng trên cả lịch sử — founder chốt 16/09: một gói cần ≥10 trận liên tiếp, cắt theo ngày thì
 *    khoảng ngắn không còn hồ sơ nào).
 *
 * ⚠ Mọi câu SQL ở đây mở đầu bằng ba tham số `$1 = tu · $2 = den · $3 = tho_tu` (CTE `cua`), nên tham số riêng của
 *   từng câu luôn bắt đầu từ `$4`. Đừng xếp lại thứ tự — lệch `$n` không nổ, nó trả sai số.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import {
  CONTEXT_DA_CHET, GIAI_DOAN, NHAN_GIAI_DOAN, PHIEN_BAN_SONG, giaiDoanCuaPhienBan,
} from '../config/giai_doan.js';
import { HOLDEM_BALANCE_VERSION } from '../config/holdem.js';
import { BUOC_DANG_KY, BUOC_HUONG_DAN, BUOC_HUONG_DAN_XONG, BUOC_TAT_TRO_LY } from '../config/telemetry.js';
import {
  congNgay, dauNgay, docKhoang, docMotAnh, layTho, msDauNgayVN, ngayCua,
} from './admin_phan_tich.js';
import type {
  BacPheuSP, DemMa, DemMan, DongPhienBan, HanhTrinhTraVe, KeoTraVe, ManCuoiSP, PhienBanTraVe, TinhCachTraVe,
  TranTraVe,
} from './admin_phan_tich_ids.js';
import {
  chiTranTap, docGomAdmin, docGomTap, docGomTester, docVer, ghepLoc, loaiAdmin, loaiTester,
  loaiTranCheat, loaiTranTap, menhDeVer,
} from './admin_thongke.js';
// K7 — tầng admin không import tầng route `holdem_api.ts`: phụ thuộc hành vi (replay theo seed) do `app.ts` TIÊM vào.
import { hoSoTheoGoi, type Deps as HanhViDeps } from './hanh_vi/kho.js';
import { RIENG_TU, cuaGopHoSo, sanO } from './rieng_tu.js';

import type { Env, Mw as Middleware } from './http/types.js';

/** Người im ngần này mới được tính là "đã biến mất" — định nghĩa của mặt HÀNH TRÌNH từ 03/08, giữ nguyên. */
const IM_DE_TINH_BIEN_MAT_MS = 24 * 3_600_000;

/* ══════════════════════════════════════════════════════════════════════════
 * MẢNH SQL
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Tập người được tính (luật 6): chưa xoá, loại quản trị/thử theo HAI công tắc. Cùng hình `cteNguoi` của
 * `admin_phan_tich.ts` — tách vì hai cờ rời nhau (đầu tệp). KHÔNG có tham số bind: chèn đâu cũng không xê dịch `$n`.
 */
function cteNguoi(gA: boolean, gT: boolean): string {
  return `nguoi AS (
    SELECT u.user_id, u.research_consent FROM users u
     WHERE u.deleted_at IS NULL ${ghepLoc(loaiAdmin(gA, 'u.user_id'), loaiTester(gT, 'u.user_id'))}
  )`;
}

/**
 * Ba mốc của khoảng (luật 1 + 5): `bd` = đầu ngày `tu` · `kt` = đầu ngày SAU `den` (lọc `>= bd AND < kt`) ·
 * `bd_tho` = như `bd` nhưng không sớm hơn `tho_tu` — mọi khối đọc telemetry thô dùng mốc này.
 */
const CTE_CUA = `cua AS (
    SELECT ${dauNgay('$1')} AS bd, ${dauNgay('$2::date + 1')} AS kt,
           ${dauNgay('greatest($1::date, $3::date)')} AS bd_tho
  )`;

/**
 * Telemetry của người ĐANG bật ghi (luật 4), alias `t`, kèm `cua`. `CROSS JOIN` chứ không dấu phẩy: một
 * `JOIN LATERAL` viết sau dấu phẩy không nhìn thấy bảng đứng trước dấu phẩy.
 */
const TELE = `telemetry t JOIN nguoi ON nguoi.user_id = t.user_id AND nguoi.research_consent CROSS JOIN cua`;
const TELE_TRONG = `t.ts >= cua.bd_tho AND t.ts < cua.kt`;

/** Trận của người được tính, alias `m`, kèm `cua`. */
const TRAN = `holdem_matches m JOIN nguoi ON nguoi.user_id = m.owner_user_id CROSS JOIN cua`;
const TRAN_TRONG = `m.started_at >= cua.bd AND m.started_at < cua.kt`;

/** Dựng phễu theo THỨ TỰ đã khai (bậc không ai tới vẫn hiện với 0), kèm tỷ lệ còn lại so với bậc đầu. */
function dungPhieu(thuTu: readonly string[], rows: Array<{ buoc: string; n: number }>): BacPheuSP[] {
  const m = new Map(rows.map((r) => [r.buoc, r.n]));
  const dau = m.get(thuTu[0]!) ?? 0;
  return thuTu.map((b) => {
    const n = m.get(b) ?? 0;
    return { buoc: b, so_nguoi: n, ty_le_con_lai: dau > 0 ? n / dau : null };
  });
}

/** Một lần đọc: "hôm nay" tính MỘT lần (luật 2), khoảng kẹp theo cùng mốc đó. */
function docYeuCau(q: (k: string) => string | undefined) {
  const bayGio = Date.now();
  // `gP` = gộp bàn tập (D359). Mặc định false ⇒ mọi số TRẬN ở tệp này là số của TRẬN THẬT.
  return { bayGio, k: docKhoang(q, bayGio), gA: docGomAdmin(q), gT: docGomTester(q), gP: docGomTap(q) };
}

/** Chạy một câu với ba tham số khoảng đứng đầu. */
function hoi(db: pg.PoolClient, ba: [string, string, string]) {
  return async <R = any>(sql: string, them: unknown[] = []): Promise<R[]> => (await db.query(sql, [...ba, ...them])).rows as R[];
}

/* ══════════════════════════════════════════════════════════════════════════
 * ROUTES
 * ══════════════════════════════════════════════════════════════════════════ */

export function registerAdminSanPhamRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: { requireAuth: Middleware; requireOnboarded: Middleware; requireAdmin: Middleware; hanhVi: HanhViDeps },
): void {
  const guard = [mw.requireAuth, mw.requireOnboarded, mw.requireAdmin] as const;

  /* ────────────────────────────────────────────────────────────────────────
   * HÀNH TRÌNH — người ta rời đi ở đâu (founder hỏi 03/08)
   *
   * ⚠ Các khối telemetry cần THỨ TỰ HÀNH ĐỘNG CỦA TỪNG NGƯỜI nên đọc bản thô (bản cuộn ngày đã bỏ danh tính, C7).
   * ⚠ Thời lượng đọc `ms` client đo tại chỗ, KHÔNG trừ `ts` (luật 7: `ts` là lúc máy chủ nhận lô).
   * ──────────────────────────────────────────────────────────────────────── */
  app.get('/api/v1/admin/tk/hanh-trinh', ...guard, async (c) => {
    const { bayGio, k, gA, gT, gP } = docYeuCau((x) => c.req.query(x));
    // D359 — `loc` thay cho `cheat` cũ: hai hàng rào đi cùng nhau ở MỌI chỗ đụng `holdem_matches`.
    const loc = ghepLoc(loaiTranCheat(gT, 'm.'), loaiTranTap(gP, 'm.'));

    const traVe = await docMotAnh(pool, async (db): Promise<HanhTrinhTraVe> => {
      const tho = await layTho(db, bayGio);
      const q = hoi(db, [k.tu, k.den, tho]);
      const W = `WITH ${cteNguoi(gA, gT)}, ${CTE_CUA}`;
      const doDuoc = k.den >= tho;

      /*
       * (0) PHỄU ĐĂNG KÝ — ĐỌC TỪ TRẠNG THÁI BỀN (`auth_accounts`, khoá thật nối được mọi bậc; bài học 03/08: mã
       * phiên sinh lại mỗi lần nạp trang nên không nối được năm mốc). NHÓM = tài khoản tạo trong khoảng; ba bậc sau
       * theo chính nhóm đó tới hôm nay — mỗi bậc vẫn là TẬP CON của bậc trên.
       *
       * ⚠ Trước D341 khối này không cắt theo ngày ("tổng đăng ký là con số tích luỹ"), nên đổi mốc không đổi số —
       * đúng ca founder bắt. Số tích luỹ vẫn đọc được: chọn khoảng dài.
       */
      const [p] = await q<{ tao: number; xac_minh: number; ho_so: number; da_choi: number }>(
        `${W}, tk AS (
           SELECT a.user_id, a.email_verified_at FROM auth_accounts a CROSS JOIN cua
            WHERE a.created_at >= cua.bd AND a.created_at < cua.kt
              ${ghepLoc(loaiAdmin(gA, 'a.user_id'), loaiTester(gT, 'a.user_id'))}
              AND NOT EXISTS (SELECT 1 FROM users d WHERE d.user_id = a.user_id AND d.deleted_at IS NOT NULL)
         )
         /* D444: tao/ho_so cộng bù khách bỏ hoang đã dọn trong đúng khoảng cua (VN-ngày [$1,$2]) —
            lý lẽ đầy đủ ở oSo() trong admin_phan_tich.ts. KHÔNG cộng xac_minh/da_choi: khách bị dọn
            chưa từng xác minh, chưa từng chơi. */
         SELECT (count(*) + (SELECT coalesce(sum(k.so), 0) FROM khach_da_don_ngay k
                                WHERE k.ngay >= $1::date AND k.ngay <= $2::date))::int AS tao,
                count(email_verified_at)::int AS xac_minh,
                (count(user_id) + (SELECT coalesce(sum(k.so), 0) FROM khach_da_don_ngay k
                                      WHERE k.ngay >= $1::date AND k.ngay <= $2::date))::int AS ho_so,
                count(*) FILTER (WHERE EXISTS (
                  SELECT 1 FROM holdem_matches m WHERE m.owner_user_id = tk.user_id ${loc}))::int AS da_choi
           FROM tk`);

      /*
       * (0b) MÀN ĐĂNG KÝ: MỞ RA RỒI CÓ GỬI KHÔNG — đơn vị LƯỢT MỞ MÀN, ghép bằng `phien` vì hai bước xảy ra trong
       * CÙNG một lần nạp trang. Dòng khách (chưa có tài khoản) không có cổng đồng ý để mà lọc; dòng gắn người thì qua
       * cổng như mọi khối khác.
       */
      const moDangKy = doDuoc ? await q<{ buoc: string; n: number }>(
        `${W}
         SELECT t.chi_tiet->>'buoc' AS buoc, count(DISTINCT coalesce(t.phien::text, t.id::text))::int AS n
           FROM telemetry t CROSS JOIN cua
          WHERE t.loai = 'dang_ky_buoc' AND t.chi_tiet->>'buoc' = ANY($4::text[]) AND ${TELE_TRONG}
            AND (t.user_id IS NULL OR t.user_id IN (SELECT user_id FROM nguoi WHERE research_consent))
          GROUP BY 1`, [[...BUOC_DANG_KY]]) : null;

      /*
       * (1) ĐĂNG NHẬP MẤT BAO LÂU — ghép mỗi `dang_nhap` với `man_ra` của màn `/onboard` gần nó nhất theo `id` (hai
       * dòng sinh cách nhau vài mili-giây nên luôn kề nhau trong dòng của một người).
       */
      const dn = `dn AS (SELECT t.user_id, t.id FROM ${TELE} WHERE t.loai = 'dang_nhap' AND ${TELE_TRONG})`;
      const dangNhap = doDuoc ? (await q<{ n: number; p50: number | null; p90: number | null }>(
        `${W}, ${dn}
         SELECT count(*)::int AS n,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY x.ms)::int AS p50,
                percentile_cont(0.9) WITHIN GROUP (ORDER BY x.ms)::int AS p90
           FROM dn JOIN LATERAL (
             SELECT t2.ms FROM telemetry t2
              WHERE t2.user_id = dn.user_id AND t2.loai = 'man_ra' AND t2.man = '/onboard' AND t2.ms IS NOT NULL
                AND t2.id BETWEEN dn.id - 10 AND dn.id + 10
              ORDER BY abs(t2.id - dn.id) LIMIT 1
           ) x ON true`))[0]! : null;

      // (2) ĐĂNG NHẬP XONG ĐI ĐÂU — màn đầu tiên họ MỞ sau cú đăng nhập (màn đăng nhập không tính là "đi đâu").
      const sauDangNhap = doDuoc ? await q<DemMan>(
        `${W}, ${dn}
         SELECT x.man, count(*)::int AS n
           FROM dn JOIN LATERAL (
             SELECT t2.man FROM telemetry t2
              WHERE t2.user_id = dn.user_id AND t2.loai = 'man_vao' AND t2.id > dn.id
                AND t2.man IS NOT NULL AND t2.man <> '/onboard'
              ORDER BY t2.id LIMIT 1
           ) x ON true
          GROUP BY x.man ORDER BY n DESC, x.man`) : null;

      // (3) HƯỚNG DẪN — vào · đi hết · tự tắt; rơi ở bước nào; học xong rồi có ở lại.
      const hdChung = doDuoc ? (await q<{ bat_dau: number; xong: number; tat: number }>(
        `${W}
         SELECT count(DISTINCT t.user_id)::int AS bat_dau,
                count(DISTINCT t.user_id) FILTER (WHERE t.chi_tiet->>'buoc' = ANY($5::text[]))::int AS xong,
                count(DISTINCT t.user_id) FILTER (WHERE t.chi_tiet->>'buoc' = $4)::int AS tat
           FROM ${TELE} WHERE t.loai = 'huong_dan_buoc' AND ${TELE_TRONG}`, [BUOC_TAT_TRO_LY, [...BUOC_HUONG_DAN_XONG]]))[0]! : null;
      const hdBuoc = doDuoc ? await q<{ buoc: string; n: number }>(
        `${W}
         SELECT t.chi_tiet->>'buoc' AS buoc, count(DISTINCT t.user_id)::int AS n
           FROM ${TELE} WHERE t.loai = 'huong_dan_buoc' AND ${TELE_TRONG}
          GROUP BY 1`) : null;
      const hdSau = doDuoc ? (await q<{ xong_hd: number; o_lai: number }>(
        `${W}, xong AS (
           SELECT t.user_id, max(t.id) AS id FROM ${TELE}
            WHERE t.loai = 'huong_dan_buoc' AND t.chi_tiet->>'buoc' = ANY($4::text[]) AND ${TELE_TRONG}
            GROUP BY t.user_id
         )
         SELECT count(*)::int AS xong_hd,
                count(*) FILTER (WHERE EXISTS (
                  SELECT 1 FROM telemetry t2
                   WHERE t2.user_id = xong.user_id AND t2.id > xong.id AND t2.loai IN ('man_vao', 'phien_mo')
                ))::int AS o_lai
           FROM xong`, [[...BUOC_HUONG_DAN_XONG]]))[0]! : null;

      /*
       * (4) TRẬN — ĐỌC TỪ `holdem_matches`, KHÔNG TỪ TELEMETRY: client chỉ báo được khi người ta bấm nút rời, mà bỏ
       * dở bằng cách đóng app là hành vi đa số (prod 03/08: 90 bỏ dở / 47 xong). Tập trận = trận BẮT ĐẦU trong khoảng
       * của người được tính, trừ trận ép tham số — đúng tập của ô TRẬN ở khu TỔNG QUAN.
       * ⚠ `ended_at` của trận bỏ dở là lúc QUÉT DỌN đóng sổ (trung bình 88 giờ sau) — không dùng làm mốc rời.
       */
      const [t] = await q(
        `${W}
         SELECT count(*)::int AS n,
                count(*) FILTER (WHERE m.status = 'bo_dở')::int AS bo_do,
                count(*) FILTER (WHERE m.status = 'xong')::int AS xong,
                count(*) FILTER (WHERE m.status = 'dang_choi')::int AS dang_choi,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM m.ended_at - m.started_at))
                  FILTER (WHERE m.status = 'xong' AND m.ended_at IS NOT NULL) AS p50_giay,
                percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM m.ended_at - m.started_at))
                  FILTER (WHERE m.status = 'xong' AND m.ended_at IS NOT NULL) AS p90_giay
           FROM ${TRAN} WHERE ${TRAN_TRONG} ${loc}`);

      /*
       * (4b) BỎ Ở PHÚT THỨ MẤY — từ lúc vào tới NƯỚC CUỐI CỦA NGƯỜI CHƠI trong `events` (append-only, index
       * `context_id`), loại `hd_tran_het_han` của bộ quét dọn. Rổ 30 gộp mọi trận treo lâu hơn.
       */
      const boTheoPhut = await q<{ phut: number; n: number }>(
        `${W}
         SELECT least(floor(EXTRACT(epoch FROM (e.cuoi - m.started_at)) / 60), 30)::int AS phut, count(*)::int AS n
           FROM ${TRAN}
           JOIN LATERAL (
             SELECT max(ts) AS cuoi FROM events
              WHERE context_id = m.match_id::text AND action_type <> 'hd_tran_het_han'
           ) e ON true
          WHERE m.status = 'bo_dở' AND e.cuoi IS NOT NULL AND e.cuoi >= m.started_at AND ${TRAN_TRONG} ${loc}
          GROUP BY 1 ORDER BY 1`);

      // (4c) …và ở VÒNG nào. Vòng nói về NỘI DUNG (chán ở đoạn nào), phút nói về KIÊN NHẪN.
      const boTheoVong = await q<{ vong: number; n: number }>(
        `${W}
         SELECT m.vong_hien_tai AS vong, count(*)::int AS n
           FROM ${TRAN} WHERE m.status = 'bo_dở' AND ${TRAN_TRONG} ${loc}
          GROUP BY 1 ORDER BY 1`);

      // (4d) Bao nhiêu lượt client KỊP báo lúc rời — tụt về 0 nghĩa là đường đo phía client hỏng.
      const kipBao = doDuoc ? (await q<{ n: number }>(
        `${W} SELECT count(*)::int AS n FROM ${TELE} WHERE t.loai = 'tran_thoat' AND ${TELE_TRONG}`))[0]!.n : null;

      /*
       * (4e) BÀN TẬP — RỔ RIÊNG (D359). Mọi khối trên đây từ giờ là số của TRẬN THẬT; ván dạy đi
       * về đây. `chiTranTap` là mệnh đề ĐẢO của `loaiTranTap`, cùng một danh sách seed — nên không
       * có cửa nào cho một trận rơi vào cả hai rổ, và cũng không có cửa nào cho nó rơi khỏi cả hai.
       * ⚠ Cố ý KHÔNG dùng `loc`: `loc` mang theo `loaiTranTap` và sẽ tự loại sạch chính chủ đề.
       *   `loaiTranCheat` thì vẫn giữ — trận ép tham số trên bàn tập cũng không nói gì về người mới.
       */
      const [bt] = await q<{
        nguoi: number; n: number; xong: number; bo_do: number;
      }>(
        `${W}
         SELECT count(DISTINCT m.owner_user_id)::int AS nguoi,
                count(*)::int AS n,
                count(*) FILTER (WHERE m.status = 'xong')::int AS xong,
                count(*) FILTER (WHERE m.status = 'bo_dở')::int AS bo_do
           FROM ${TRAN}
          WHERE ${TRAN_TRONG} ${loaiTranCheat(gT, 'm.')} ${chiTranTap('m.')}`);

      const btVong = await q<{ vong: number; n: number }>(
        `${W}
         SELECT m.vong_hien_tai AS vong, count(*)::int AS n
           FROM ${TRAN}
          WHERE m.status = 'bo_dở' AND ${TRAN_TRONG} ${loaiTranCheat(gT, 'm.')} ${chiTranTap('m.')}
          GROUP BY 1 ORDER BY 1`);

      /*
       * (5) MÀN CUỐI CÙNG TRƯỚC KHI BIẾN MẤT. Người được tính = lần xem màn CUỐI CÙNG của họ (trên cả kho thô, không
       * chỉ trong khoảng — người còn quay lại sau khoảng thì chưa biến mất ở khoảng này) rơi vào phần đo được của
       * khoảng VÀ đã im ≥ 24 giờ. Mốc chặn trên = hết khoảng, nhưng không muộn hơn 24 giờ trước lúc đọc.
       * ⚠ Trước D341: "trong N×24 giờ qua" AND "cũ hơn 24 giờ" ⇒ mốc Hôm nay rỗng vĩnh viễn, im lặng.
       */
      let manCuoi: ManCuoiSP;
      const chotMs = Math.min(msDauNgayVN(congNgay(k.den, 1)), bayGio - IM_DE_TINH_BIEN_MAT_MS);
      if (!doDuoc) {
        manCuoi = { trang_thai: 'khong_do_duoc' };
      } else if (chotMs <= msDauNgayVN(k.tu > tho ? k.tu : tho)) {
        manCuoi = { trang_thai: 'chua_du_24h' };
      } else {
        const tinhToi = new Date(chotMs).toISOString();
        const dong = await q<DemMan>(
          `${W}, cuoi AS (
             SELECT DISTINCT ON (t.user_id) t.user_id, t.man, t.ts
               FROM telemetry t JOIN nguoi ON nguoi.user_id = t.user_id AND nguoi.research_consent
              WHERE t.man IS NOT NULL
              ORDER BY t.user_id, t.id DESC
           )
           SELECT cuoi.man, count(*)::int AS n
             FROM cuoi CROSS JOIN cua
            WHERE cuoi.ts >= cua.bd_tho AND cuoi.ts < $4::timestamptz
            GROUP BY cuoi.man ORDER BY n DESC, cuoi.man LIMIT 12`, [tinhToi]);
        manCuoi = { trang_thai: 'co', tinh_toi: tinhToi, dong };
      }

      // (6) SẬP GIAO DIỆN — `loi_client` (màn trắng lúc dựng), khác hẳn lỗi gọi máy chủ.
      const loiClient = doDuoc ? await q<DemMa>(
        `${W}
         SELECT t.chi_tiet->>'ma' AS ma, count(*)::int AS n
           FROM ${TELE} WHERE t.loai = 'loi_client' AND ${TELE_TRONG}
          GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`) : null;

      const bac = (buoc: string, n: number): BacPheuSP => ({
        buoc, so_nguoi: n, ty_le_con_lai: p!.tao > 0 ? n / p!.tao : null,
      });
      const giay = (v: string | number | null) => (v === null ? null : Math.round(Number(v)));
      const phut = (v: string | number | null) => (giay(v) === null ? null : Math.round(giay(v)! / 60));
      return {
        khoang: { ...k, tho_tu: tho },
        gom_admin: gA,
        gom_tester: gT,
        do_duoc: doDuoc,
        cat_tho: doDuoc && k.tu < tho,
        phieu_dang_ky: [
          bac('tao-tai-khoan', p!.tao), bac('xac-minh-email', p!.xac_minh),
          bac('xong-ho-so', p!.ho_so), bac('tran-dau', p!.da_choi),
        ],
        man_dang_ky: moDangKy === null ? null : dungPhieu(BUOC_DANG_KY, moDangKy),
        loi_client: loiClient,
        dang_nhap: dangNhap === null ? null : {
          so_lan: dangNhap.n,
          giay_p50: dangNhap.p50 === null ? null : Math.round(dangNhap.p50 / 1000),
          giay_p90: dangNhap.p90 === null ? null : Math.round(dangNhap.p90 / 1000),
        },
        sau_dang_nhap: sauDangNhap,
        huong_dan: hdChung === null || hdBuoc === null || hdSau === null ? null : {
          bat_dau: hdChung.bat_dau,
          di_het: hdChung.xong,
          tu_tat: hdChung.tat,
          xong_roi_o_lai: hdSau.o_lai,
          xong_roi_di_luon: hdSau.xong_hd - hdSau.o_lai,
          buoc: dungPhieu(BUOC_HUONG_DAN, hdBuoc),
        },
        ban_tap: {
          so_nguoi_vao: bt!.nguoi,
          so_tran: bt!.n,
          so_xong: bt!.xong,
          so_bo_do: bt!.bo_do,
          bo_o_vong: btVong.map((r) => ({ vong: Number(r.vong), n: Number(r.n) })),
        },
        tran: {
          so_lan_vao: t.n,
          so_xong: t.xong,
          so_dang_choi: t.dang_choi,
          so_lan_bo_do: t.bo_do,
          phut_p50: phut(t.p50_giay),
          phut_p90: phut(t.p90_giay),
          bo_do_theo_phut: boTheoPhut,
          bo_do_theo_vong: boTheoVong,
          client_kip_bao: kipBao,
        },
        man_cuoi: manCuoi,
      };
    });
    return c.json(traVe);
  });

  /* ────────────────────────────────────────────────────────────────────────
   * TRẬN + THỨ HẠNG — §4.1 mục 5, 6 · §4.2 mục 13. Hai bộ lọc chồng nhau: phiên bản (mặc định = bản đang chạy,
   * founder 31/08) VÀ khoảng ngày (trận BẮT ĐẦU trong khoảng).
   * ──────────────────────────────────────────────────────────────────────── */
  app.get('/api/v1/admin/tk/tran', ...guard, async (c) => {
    const qs = (x: string) => c.req.query(x);
    const { bayGio, k, gA, gT, gP } = docYeuCau(qs);
    const xv = docVer(qs);
    const v = menhDeVer(xv, 'm', 4);
    // D359 — bàn tập ra khỏi phân bố hạng. Bàn tập 12 ghế chạy MỘT bàn cờ ghim với cùng bộ bot, nên
    // hạng của nó gần như hằng số; trộn vào là kéo phân bố về phía nó theo đúng tỷ lệ người mới.
    const loc = `${TRAN_TRONG} ${v.sql} ${loaiTranCheat(gT, 'm.')} ${loaiTranTap(gP, 'm.')}`;

    const traVe = await docMotAnh(pool, async (db): Promise<TranTraVe> => {
      const tho = await layTho(db, bayGio);
      const q = hoi(db, [k.tu, k.den, tho]);
      const W = `WITH ${cteNguoi(gA, gT)}, ${CTE_CUA}`;
      const doDuoc = k.den >= tho;
      const ghe = `ghe AS (SELECT match_id, count(*)::int AS so_ghe FROM holdem_results GROUP BY match_id)`;

      /*
       * Phân bố thứ hạng. ⚠ Phải kèm SỐ GHẾ: "hạng 4" ở bàn 4 người là BÉT, ở bàn 8 người là trên trung bình — một
       * cột `hang` trần là con số vô nghĩa mà trông có nghĩa.
       */
      const hang = await q<{ hang: number; so_ghe: number; n: number }>(
        `${W}, ${ghe}
         SELECT r.hang, g.so_ghe, count(*)::int AS n
           FROM ${TRAN} JOIN holdem_results r ON r.match_id = m.match_id JOIN ghe g ON g.match_id = r.match_id
          WHERE r.user_id IS NOT NULL AND ${loc}
          GROUP BY r.hang, g.so_ghe ORDER BY g.so_ghe, r.hang`, v.tham);

      /*
       * Thoát giữa chừng ở VÒNG nào (telemetry `tran_thoat`). ⚠ Ô DUY NHẤT KHÔNG LỌC ĐƯỢC THEO PHIÊN BẢN — lý do ở
       * SCHEMA: `tran_thoat` chỉ chở `{vong, giay}`, không match id. Trả kèm cờ `thoat_khong_loc_duoc_ver` để màn
       * nói ra. Theo khoảng thì CẮT ĐƯỢC.
       */
      const thoat = doDuoc ? await q<{ vong: number; n: number }>(
        `${W}
         SELECT (t.chi_tiet->>'vong')::int AS vong, count(*)::int AS n
           FROM ${TELE} WHERE t.loai = 'tran_thoat' AND ${TELE_TRONG}
          GROUP BY 1 ORDER BY 1`) : null;

      /*
       * CHỈ SỐ NẢN — chuỗi về bét dài nhất (gap-and-islands: số thứ tự trận trừ số thứ tự trong nhóm "về bét" không
       * đổi suốt một chuỗi liên tiếp). Tính trên trận TRONG khoảng.
       */
      const [nan] = await q<{ dai_nhat: number; so_lan_tu_3: number; nguoi_dinh: number }>(
        `${W}, ${ghe}, xep AS (
           SELECT r.user_id, r.hang, g.so_ghe,
                  row_number() OVER (PARTITION BY r.user_id ORDER BY r.created_at) AS i,
                  row_number() OVER (PARTITION BY r.user_id, (r.hang = g.so_ghe) ORDER BY r.created_at) AS j
             FROM ${TRAN} JOIN holdem_results r ON r.match_id = m.match_id JOIN ghe g ON g.match_id = r.match_id
            WHERE r.user_id IS NOT NULL AND ${loc}
         ), chuoi AS (
           SELECT user_id, count(*)::int AS dai FROM xep WHERE hang = so_ghe GROUP BY user_id, i - j
         )
         SELECT COALESCE(max(dai), 0)::int AS dai_nhat,
                count(*) FILTER (WHERE dai >= 3)::int AS so_lan_tu_3,
                count(DISTINCT user_id) FILTER (WHERE dai >= 3)::int AS nguoi_dinh
           FROM chuoi`, v.tham);

      // CỠ MẪU đi kèm con số (D123).
      const [mau] = await q<{ tran: number; xong: number; nguoi: number }>(
        `${W}
         SELECT count(*)::int AS tran, count(*) FILTER (WHERE m.status = 'xong')::int AS xong,
                count(DISTINCT m.owner_user_id)::int AS nguoi
           FROM ${TRAN} WHERE ${loc}`, v.tham);

      return {
        khoang: { ...k, tho_tu: tho },
        gom_admin: gA,
        gom_tester: gT,
        loc: {
          che_do: xv.che_do,
          ver: xv.ver,
          ver_hien_tai: HOLDEM_BALANCE_VERSION,
          giai_doan: xv.ver ? giaiDoanCuaPhienBan(xv.ver) : null,
        },
        mau: { ...mau!, san_tin_cay: GIAI_DOAN.SAN_TRAN_TIN_CAY, mong: mau!.xong < GIAI_DOAN.SAN_TRAN_TIN_CAY },
        phan_bo_hang: hang,
        thoat_theo_vong: thoat,
        thoat_khong_loc_duoc_ver: true,
        chuoi_ve_bet: nan!,
      };
    });
    return c.json(traVe);
  });

  /* ────────────────────────────────────────────────────────────────────────
   * KÈO DỰ BÁO — §4.2 mục 9 (khẩu vị rủi ro) + mục 10 (bầy đàn). Chợ đóng băng từ D86 nên khoảng ngắn thường trống —
   * đúng, không phải hỏng.
   * ──────────────────────────────────────────────────────────────────────── */
  app.get('/api/v1/admin/tk/keo', ...guard, async (c) => {
    const { bayGio, k, gA, gT, gP } = docYeuCau((x) => c.req.query(x));

    const traVe = await docMotAnh(pool, async (db): Promise<KeoTraVe> => {
      const tho = await layTho(db, bayGio);
      const q = hoi(db, [k.tu, k.den, tho]);
      const W = `WITH ${cteNguoi(gA, gT)}, ${CTE_CUA}`;
      /** Lượt đặt THẬT (không seed Kho bạc) của người được tính, trong khoảng. */
      const cuoc = `cuoc AS (
          SELECT b.user_id, b.market_id, b.option_id, b.amount, b.created_at
            FROM bets b JOIN nguoi ON nguoi.user_id = b.user_id CROSS JOIN cua
           WHERE NOT b.is_seed AND b.created_at >= cua.bd AND b.created_at < cua.kt
        )`;

      /*
       * ⚠ TÍN HIỆU B2B ĐẮT NHẤT (§4.2 mục 9). Với mỗi (người, kèo): tỷ lệ token dồn vào CỬA NẶNG NHẤT. 1,0 = tất tay
       * một cửa; 1/số cửa = rải đều.
       */
      const [khauVi] = await q<{ n: number; tb: number | null; p50: number | null; tat_tay: number }>(
        `${W}, ${cuoc}, theo_cua AS (
           SELECT user_id, market_id, option_id, sum(amount) AS a FROM cuoc GROUP BY 1, 2, 3
         ), theo_keo AS (
           SELECT user_id, market_id, max(a)::numeric / NULLIF(sum(a), 0) AS dam_dac FROM theo_cua GROUP BY 1, 2
         )
         SELECT count(*)::int AS n,
                round(avg(dam_dac), 3)::float8 AS tb,
                round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dam_dac)::numeric, 3)::float8 AS p50,
                count(*) FILTER (WHERE dam_dac > 0.99)::int AS tat_tay
           FROM theo_keo`);

      // Đặt lúc nào so với giờ khoá — nước rút hay thong thả?
      const batDau = await q<{ o: number | null; n: number }>(
        `${W}, ${cuoc}
         SELECT width_bucket(EXTRACT(EPOCH FROM (mk.lock_ts - cuoc.created_at)) / 3600, 0, 72, 6) AS o,
                count(*)::int AS n
           FROM cuoc JOIN markets mk ON mk.market_id = cuoc.market_id
          WHERE cuoc.created_at < mk.lock_ts
          GROUP BY 1 ORDER BY 1`);

      /*
       * Bầy đàn: `pool_reveal` sinh ra để đo đúng chuyện này (A3.1). Nhóm = người thấy pool lần đầu TRONG khoảng;
       * đếm ai có ÍT NHẤT MỘT `bet_adjust` sau đó ở cùng kèo (kể cả sau khoảng — cú chỉnh thuộc về cú nhìn).
       */
      const [bayDan] = await q<{ da_thay: number; co_chinh_sau: number }>(
        `${W}, lo AS (
           SELECT e.user_id, e.context_id, min(e.ts) AS luc
             FROM events e JOIN nguoi ON nguoi.user_id = e.user_id CROSS JOIN cua
            WHERE e.action_type = 'pool_reveal' AND e.ts >= cua.bd AND e.ts < cua.kt
            GROUP BY 1, 2
         )
         SELECT count(DISTINCT lo.user_id)::int AS da_thay,
                count(DISTINCT e.user_id) FILTER (WHERE e.ts > lo.luc)::int AS co_chinh_sau
           FROM lo LEFT JOIN events e
             ON e.user_id = lo.user_id AND e.context_id = lo.context_id AND e.action_type = 'bet_adjust'`);

      // Kèo MỞ trong khoảng, hoặc có người đặt trong khoảng. Người/volume chỉ đếm lượt đặt trong khoảng.
      const keo = await q<KeoTraVe['keo_trong_khoang'][number]>(
        `${W}, ${cuoc}
         SELECT mk.market_id, mk.question_text, mk.pool, mk.status,
                count(DISTINCT cuoc.user_id)::int AS nguoi,
                COALESCE(sum(cuoc.amount), 0)::text AS volume
           FROM markets mk CROSS JOIN cua LEFT JOIN cuoc ON cuoc.market_id = mk.market_id
          WHERE (mk.open_ts >= cua.bd AND mk.open_ts < cua.kt) OR cuoc.market_id IS NOT NULL
          GROUP BY mk.market_id ORDER BY mk.open_ts DESC NULLS LAST LIMIT 20`);

      return {
        khoang: { ...k, tho_tu: tho },
        gom_admin: gA,
        gom_tester: gT,
        khau_vi_rui_ro: khauVi!,
        dat_truoc_gio_khoa: batDau,
        bay_dan: bayDan!,
        keo_trong_khoang: keo,
      };
    });
    return c.json(traVe);
  });

  /* ────────────────────────────────────────────────────────────────────────
   * TÍNH CÁCH TÀI CHÍNH — bảng tỷ lệ cho product (founder 08/08). MỘT đường trải dùng chung với thẻ người chơi
   * (`/me/tinh-cach`); bản admin chỉ GỘP.
   *
   * ⚠ KHÔNG bọc `docMotAnh`: đường hồ sơ TỰ LÀM TƯƠI bảng `hanh_vi_vong` lúc đọc (`server/hanh_vi/`), tức CÓ GHI —
   *   một giao dịch READ ONLY nổ đúng lượt đầu gặp người có vòng mới. Mặt này vì thế đọc bằng pool như trước D341.
   * ⚠ Cổng đồng ý + sàn cỡ ô ở `server/rieng_tu.ts` (D101) — gọi cửa gom TRƯỚC mọi lời gọi hồ sơ
   *   (`tests/rieng_tu.test.ts` §II đọc chính mã nguồn để canh).
   * ──────────────────────────────────────────────────────────────────────── */
  app.get('/api/v1/admin/tk/tinh-cach', ...guard, async (c) => {
    const { bayGio, k, gA, gT, gP } = docYeuCau((x) => c.req.query(x));
    const cua = await cuaGopHoSo(pool, { gomAdmin: gA, gomTester: gT, khoang: { tu: k.tu, den: k.den } });
    const hoSo = [];
    for (const id of cua.user_ids) {
      hoSo.push(await hoSoTheoGoi(pool, id, mw.hanhVi)); // = `hoSoTinhCachCuaUser` của holdem_api, không qua tầng route
    }

    /*
     * ⚠⚠ CẢNH BÁO TRỘN PHIÊN BẢN — không lọc được, nên KHAI RA. Một gói ≥10 trận liên tiếp vắt qua nhiều lần lật
     * cổng balance; cắt theo phiên bản thì gói vỡ. Đo độ trộn trên CHÍNH các vòng của những người trong mẫu.
     */
    const { rows: [tron] } = await pool.query(
      `SELECT count(DISTINCT m.balance_version)::int AS so_phien_ban,
              count(*)::int AS n_vong,
              count(*) FILTER (WHERE NOT (m.balance_version = ANY($2::text[])))::int AS n_vong_chet
         FROM hanh_vi_vong hv JOIN holdem_matches m ON m.match_id = hv.match_id
        WHERE hv.user_id = ANY($1::uuid[])`,
      [cua.user_ids, [...PHIEN_BAN_SONG]]);
    const tho = await layTho(pool, bayGio);

    const co = hoSo.filter((h) => h.n_vong > 0);
    const demTho: Record<string, number> = {};
    for (const h of co) demTho[h.tinh_cach] = (demTho[h.tinh_cach] ?? 0) + 1;
    const tbCua = (lay: (h: (typeof co)[number]) => number | null | undefined) => {
      const xs = co.map(lay).filter((x): x is number => typeof x === 'number');
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    };
    const t = tron ?? { so_phien_ban: 0, n_vong: 0, n_vong_chet: 0 };
    const traVe: TinhCachTraVe = {
      khoang: { ...k, tho_tu: tho },
      gom_admin: gA,
      gom_tester: gT,
      n_nguoi: co.length,
      bo_qua_chua_dong_y: cua.bo_qua_chua_dong_y,
      san_o: RIENG_TU.SAN_O,
      tron_phien_ban: {
        so_phien_ban: Number(t.so_phien_ban),
        n_vong: Number(t.n_vong),
        n_vong_khong_dung_lai_duoc: Number(t.n_vong_chet),
        ty_le_khong_dung_lai_duoc: Number(t.n_vong) === 0 ? 0
          : Math.round((Number(t.n_vong_chet) / Number(t.n_vong)) * 1000) / 1000,
        ver_hien_tai: HOLDEM_BALANCE_VERSION,
      },
      phan_bo: sanO(demTho),
      trung_binh: {
        brier: tbCua((h) => h.chi_so.hieu_chinh?.brier_tb),
        duoi_gia: tbCua((h) => h.chi_so.duoi_gia?.ty_le),
        theo_tin: tbCua((h) => h.chi_so.theo_tin?.ty_le),
        an_tin_gia: tbCua((h) => h.chi_so.theo_tin?.phan_tin_gia),
        chot_non: tbCua((h) => h.chi_so.chot_non?.lech),
        don_von_sau_thua: tbCua((h) => h.chi_so.don_von?.sau_thua_x),
        don_von_sau_thang: tbCua((h) => h.chi_so.don_von?.sau_thang_x),
        mua_tin: tbCua((h) => h.chi_so.mua_tin?.ty_le),
      },
    };
    return c.json(traVe);
  });

  /* ────────────────────────────────────────────────────────────────────────
   * PHIÊN BẢN — mặt SO SÁNH (founder 31/08). Mặt DUY NHẤT liệt kê cả phiên bản `khong_dung_lai_duoc`, vì nó không
   * tính tỷ lệ — nó kể kho chứa gì. Từ D341: kho của các trận BẮT ĐẦU trong khoảng.
   * ──────────────────────────────────────────────────────────────────────── */
  app.get('/api/v1/admin/tk/phien-ban', ...guard, async (c) => {
    const { bayGio, k, gA, gT, gP } = docYeuCau((x) => c.req.query(x));
    const loc = `${TRAN_TRONG} ${loaiTranCheat(gT, 'm.')} ${loaiTranTap(gP, 'm.')}`;

    const traVe = await docMotAnh(pool, async (db): Promise<PhienBanTraVe> => {
      const tho = await layTho(db, bayGio);
      const q = hoi(db, [k.tu, k.den, tho]);
      const W = `WITH ${cteNguoi(gA, gT)}, ${CTE_CUA}`;
      const ban = await q(
        `${W}
         SELECT m.balance_version AS ver, m.che_do,
                count(*)::int AS tran,
                count(*) FILTER (WHERE m.status = 'xong')::int AS xong,
                count(*) FILTER (WHERE m.status = 'dang_choi')::int AS dang_choi,
                count(DISTINCT m.owner_user_id)::int AS nguoi,
                (SELECT count(*)::int FROM holdem_results r
                  WHERE r.match_id = ANY(array_agg(m.match_id)) AND r.user_id IS NOT NULL) AS ghe_nguoi,
                min(${ngayCua('m.started_at')})::text AS tu, max(${ngayCua('m.started_at')})::text AS den,
                array_remove(array_agg(DISTINCT m.so_o), NULL) AS co_map
           FROM ${TRAN} WHERE ${loc}
          GROUP BY m.balance_version, m.che_do`);
      /*
       * Event theo (phiên bản, chế độ) của chính các trận ấy. So `context_id` dạng CHỮ với `match_id::text` — không ép
       * `context_id::uuid` (thứ tự đánh giá điều kiện trong JOIN không được bảo đảm, một id không phải uuid làm nổ
       * cả câu) và đi được index `events(context_id)` (A6).
       * ⚠ Trước D341 khoá chỉ là phiên bản, nên một phiên bản có hai chế độ bị cộng event HAI LẦN vào tổng.
       */
      const evt = await q<{ ver: string; che_do: string; n: number }>(
        `${W}
         SELECT m.balance_version AS ver, m.che_do, count(*)::int AS n
           FROM ${TRAN} JOIN events e ON e.context_type = 'holdem' AND e.context_id = m.match_id::text
          WHERE ${loc}
          GROUP BY m.balance_version, m.che_do`);

      const evtTheo = new Map(evt.map((r) => [`${r.ver}|${r.che_do}`, Number(r.n)]));
      const dong: DongPhienBan[] = ban.map((r) => {
        const gd = giaiDoanCuaPhienBan(r.ver);
        return {
          ver: r.ver, che_do: r.che_do, giai_doan: gd, nhan_giai_doan: NHAN_GIAI_DOAN[gd],
          // Cờ để mặt admin TÔ, không phải để ẩn: mẫu mỏng vẫn hiện.
          mau_mong: Number(r.xong) < GIAI_DOAN.SAN_TRAN_TIN_CAY,
          tran: Number(r.tran), xong: Number(r.xong), dang_choi: Number(r.dang_choi),
          bo_do: Number(r.tran) - Number(r.xong) - Number(r.dang_choi),
          nguoi: Number(r.nguoi), ghe_nguoi: Number(r.ghe_nguoi),
          n_events: evtTheo.get(`${r.ver}|${r.che_do}`) ?? 0,
          tu: r.tu, den: r.den, co_map: (r.co_map ?? []) as number[],
        };
      }).sort((a, b) => a.tu.localeCompare(b.tu) || a.ver.localeCompare(b.ver) || a.che_do.localeCompare(b.che_do));

      const cong = (ds: DongPhienBan[], f: (d: DongPhienBan) => number) => ds.reduce((s, d) => s + f(d), 0);
      const rac = dong.filter((d) => d.giai_doan === 'khong_dung_lai_duoc');
      const tongTran = cong(dong, (d) => d.tran);
      return {
        khoang: { ...k, tho_tu: tho },
        gom_admin: gA,
        gom_tester: gT,
        ver_hien_tai: HOLDEM_BALANCE_VERSION,
        san_tran_tin_cay: GIAI_DOAN.SAN_TRAN_TIN_CAY,
        dong,
        tong: { tran: tongTran, events: cong(dong, (d) => d.n_events), so_phien_ban: new Set(dong.map((d) => d.ver)).size },
        // Nói THẲNG phần bị cắt khỏi mọi mặt phân tích, kèm tỷ lệ — cắt im lặng thì người đọc tưởng app hỏng.
        bi_cat: {
          tran: cong(rac, (d) => d.tran),
          events: cong(rac, (d) => d.n_events),
          phien_ban: [...new Set(rac.map((d) => d.ver))],
          ty_le_tran: tongTran === 0 ? 0 : Math.round((cong(rac, (d) => d.tran) / tongTran) * 1000) / 1000,
        },
        context_da_chet: [...CONTEXT_DA_CHET],
      };
    });
    return c.json(traVe);
  });
}
