/**
 * ĐỢT THỬ NGHIỆM — ĐỌC CHI TIẾT TỪNG NGƯỜI (D362).
 *
 * ─── MỘT NGUỒN CHO HAI ĐƯỜNG GỌI ────────────────────────────────────────────
 * Cùng một bảng số được hai chỗ hỏi:
 *   · khu TESTER của `/quan-tri` — `GET /api/v1/admin/dot-thu` (founder đọc trên màn);
 *   · lệnh `npm run buoi-do:xuat` — xuất CSV để ghép với bảng tính Google Form.
 * Hai chỗ mà hai câu SQL là hai bảng số sẽ trôi khỏi nhau, và không ai phát hiện vì cả hai
 * đều "có số" (A11.5/D61). Nên phép đọc nằm ở ĐÂY, `scripts/` chỉ là vỏ ghi tệp.
 *
 * ⚠ Ở `server/` chứ không `scripts/`: `scripts/deploy.ts` chỉ gói `api/ server/ config/`, nên một
 * route import từ `scripts/` là một function crash trên prod (đã dính 18/07).
 *
 * ─── AI ĐƯỢC ĐỌC ────────────────────────────────────────────────────────────
 * Chỉ người đang đồng ý văn bản `buoi_do` **bản hiện hành**. Vết MỚI NHẤT phải là đồng ý (rút rồi
 * đồng ý lại thì vào; đồng ý rồi rút thì ra), và phiên bản phải khớp `CONSENT_PHIEN_BAN.buoi_do`.
 * ⚠ So bằng `=` với bản hiện hành, KHÔNG phải `<> 'v1'`: vết thiếu `phien_ban` cũng rơi ra, vì không
 *   biết họ đã đọc chữ nào thì không được coi là đã đồng ý chữ nào. Và khi văn bản lên v3, hàng rào
 *   tự siết theo mà không ai phải nhớ sửa chỗ này.
 *
 * ─── C7 — KHÔNG CỘT DANH TÍNH ───────────────────────────────────────────────
 * Không handle, không email, không tên, không `user_id`. Khoá GHÉP PHIẾU của mọi dòng là `ma_buoi_do`
 * (cột đầu) — đúng mã app tự điền vào ba Google Form (D370, `users.ma_buoi_do`). `ma_tham_gia` (theo trận)
 * giữ làm cột thứ hai để lần theo trận. ⚠ D392: trước bản này tệp CHỈ có `ma_tham_gia`, trong khi phiếu
 * mang mã buổi đo — hai mã cùng dạng 4 ký tự, không cột nào nối được hai bên. Số tiền thô của sổ không có ở đây:
 * `pfm_dac_trung` chỉ chở tỷ lệ/đếm/nhãn (A6).
 */
import type pg from 'pg';
import { CONSENT_PHIEN_BAN } from '../config/pfm_consent.js';
import { SEED_MAN_TAP_MOI_THOI } from '../config/holdem.js';
import { deCua } from '../config/holdem_de.js';
import { luatCua } from '../config/holdem_balance.js';
import { TRAIT } from '../config/trait.js';
import { chamNangLucTran, type DongNangLuc } from './holdem/nang_luc.js';
import { maThamGia } from './holdem/ma_tham_gia.js';

/*
 * ─── D404 — CỘT THÊM ĐỂ GHÉP ĐƯỢC VỚI BA PHIẾU, và cột BỎ vì không bao giờ có số ───────
 * Rà khung bằng chứng buổi đo (25/09) chỉ ra tệp xuất thiếu đúng những cột mà từng câu phiếu cần đối chứng:
 *   · `buoc` · `dong_y_luc`            — tester đi tới đâu, đồng ý lúc nào (dòng thời gian chỉ có từ đây + giờ Form)
 *   · `bat_dau_luc` · `ket_thuc_luc`   — đã SELECT từ D361 mà chưa bao giờ xuất
 *   · `de_id` · `de_chu_ky`            — Phiếu 2 câu "vừa gặp cơ chế nào" chỉ chấm được khi biết đề có gì
 *   · `vai` · `so_o`                   — phơi nhiễm đổi theo vai ghế; so giữa người phải cùng vai, cùng cỡ
 *   · `tk_huy_so_tong`                 — `tk_huy_so` cũ là MAX theo vòng (0/1), đọc nhầm thành "số lần"
 *   · `bac_*` · `the_tinh_vao`         — bậc ba năng lực của ĐÚNG trận này (`chamNangLucTran`, hàm thuần, cùng
 *                                        thước với `/autopsy`); Phiếu 1 khối G và Phiếu 3 a1 ghép vào đây.
 *                                        N2 (`doc_tin`) ẩn khỏi mặt người chơi (D396) nhưng VẪN xuất ở đây — tệp
 *                                        này là mặt đọc của nhóm làm app, đúng lời văn bản đồng ý.
 *   · `ban_tap_xong`                   — có đi qua bàn tập không (bàn tập dạy đòn bẩy · bán khống mà đề v52 có thể
 *                                        không mở ⇒ "nhận nhầm cơ chế" phải trừ phần này)
 *   · `nhom_tuoi` · `vung` · `nghe`    — dạng khoảng, văn bản đồng ý đã nói rời máy; trước D404 chưa ra tệp
 *   · `ghi_telemetry`                  — cột `app_*` chỉ có số khi cờ này bật (mặc định TẮT lúc lập hồ sơ); thiếu
 *                                        cờ thì ô trống đọc nhầm thành "không thoát, không lỗi"
 * BỎ `hv_doan_lech` và `kq_con_dung_so`: không một chỗ nào trong client phát hai mã này (chỉ đăng ký trong
 * `config/pfm_dac_trung.ts`) ⇒ luôn null. Một cột không bao giờ có số là một lời hứa rỗng trên bảng tính.
 */

/*
 * ─── D437 — LỚP v55 (lửa · xu · trait) ─────────────────────────────────────────────────────────────────────────────
 * Buổi đo 30/09 chạy `balance-v55-build` (founder chốt 27/09). App đã GHI đủ lớp này — 0070 `hd_chon_trait`, 0071 sáu cột
 * `hanh_vi_vong` — nhưng tới D437 tệp xuất không LẤY cột nào ⇒ sau buổi không phân tích được lớp mới. Thêm:
 *   · dòng VÒNG: `lua_nac · lua_dap · xu · trait_json · nguon_tin_rieng · co_che_cat_lo` + `trait_trong_vong` — trait CÓ HIỆU
 *     LỰC TRONG vòng, đọc `hd_chot_phien.trait_vong`. ⚠ `trait_json` là danh sách SAU vòng: gồm lá vừa lấy ở vòng mốc, mà
 *     lá ấy chỉ có hiệu lực từ vòng KẾ — đọc `trait_json` để lọc vòng là gán trait cho đúng vòng người chơi chưa có nó.
 *   · dòng NGƯỜI (tổng của trận): lửa — nấc cao nhất · số vòng bị dập · số vòng dập vì MUA ĐUỔI MUỘN; xu cuối; trait mang lúc
 *     hết trận; số vòng có tin riêng; bốn con đếm chợ trait; `brier_tb_sach` (xem `laVongSachTin`).
 *   · tệp THỨ BA `hangTrait`: mỗi lượt chợ trait một dòng (mời · lấy · cuộn · xu · MẤT TRÍ · bỏ qua) — lớp Ý ĐỊNH.
 * ⚠ NULL ≠ 0 (A11.2): trận chạy luật chưa có lửa/trait ⇒ mọi ô lửa/xu/trait/chợ TRỐNG, không phải 0. Luật đọc từ
 *   `balance_version` của CHÍNH trận (`luatCua`), không suy từ dữ liệu — dữ liệu chưa dựng lại cũng để trống cột v55.
 * ⚠ Danh sách nối bằng "|": dấu phẩy là dấu tách cột của CSV.
 */

/** Trait trục THÔNG TIN — suy từ `config/trait.ts`, không gõ tay (A11.5): SÁNG SỔ · NỘI GIÁN · LƯỚT SÓNG GHIM · THẤY DÒNG
 *  TIỀN thêm tin; MÙ TIN · SƯƠNG MÙ bớt tin. */
export const TRAIT_THONG_TIN: ReadonlySet<string> = new Set(
  TRAIT.filter((t) => t.truc === 'thong_tin').map((t) => t.id));

/**
 * D437 — một vòng có "SẠCH TIN" để đọc Brier không. ⏳ Bộ lọc MÔ TẢ cho bảng đọc số, không phải thước năng lực.
 * Không sạch khi: có tin riêng (`nguon_tin_rieng`: mở Bảng · NỘI GIÁN/LƯỚT SÓNG GHIM), HOẶC mang trait trục THÔNG TIN có hiệu lực
 * TRONG vòng — `nguon_tin_rieng` chỉ cờ hai lá thêm tin, bốn lá còn lại (kể cả hai lá BỚT tin) chỉ đọc được ở đây.
 * Trận có hệ trait mà thiếu `trait_vong` ⇒ không biết ⇒ KHÔNG tính là sạch (không đoán). Trận không có hệ trait: chỉ xét
 * `nguon_tin_rieng`.
 */
export function laVongSachTin(
  nguon: string | null, coHeTrait: boolean, traitVong: readonly string[] | null,
): boolean {
  if (nguon !== null) return false;
  if (!coHeTrait) return true;
  if (traitVong === null) return false;
  return !traitVong.some((t) => TRAIT_THONG_TIN.has(t));
}

/**
 * Công thức hành vi (`HANH_VI_FORMULA_VERSION`) từ bản này mới tính sáu cột v55 của 0071 (D409: 3 → 4). Dòng dựng bằng
 * công thức cũ hơn thì sáu cột ấy là CHƯA TÍNH, không phải "không có" ⇒ ô tổng của trận để trống, chờ dựng lại
 * (`scripts/hanh_vi_dung_lai.ts`). ⚠ Số lịch sử, KHÔNG đọc hằng hiện hành: lần tăng công thức sau vẫn giữ sáu cột.
 */
const CONG_THUC_CO_LOP_V55 = 4;

/** Mảng chuỗi ⇒ một ô CSV nối bằng "|"; không phải mảng ⇒ null (ô trống). */
function noi(x: unknown): string | null {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string').join('|') : null;
}

/** Lỗi có mã — vỏ gọi dịch ra câu tiếng Việt, bài canh so mã (D26: ID ở lõi, chữ ở vỏ). */
export class LoiDotThu extends Error {
  constructor(
    public readonly ma: 'ban_khong_co' | 'khong_phai_buoi_do' | 'khong_ai_dong_y' | 'chua_dung_hanh_vi',
    public readonly them: Record<string, unknown> = {},
  ) { super(ma); }
}

export interface ThongKeDotThu {
  dong_y: number; da_rut: number; loai_ban_cu: number; tran: number; tran_da_dung: number;
}

export interface KetQuaDotThu {
  /** Bàn khi đọc theo bàn; `null` khi đọc cả đợt theo nhãn. */
  ban: Record<string, any> | null;
  nhan: string | null;
  hangNguoi: Array<Record<string, unknown>>;
  hangVong: Array<Record<string, unknown>>;
  /** D437 — mỗi lượt chợ trait (`hd_chon_trait`) một dòng; rỗng ở trận chạy luật chưa có trait. */
  hangTrait: Array<Record<string, unknown>>;
  thongKe: ThongKeDotThu;
}

/** Chọn tập người: theo MỘT bàn (lệnh xuất) hoặc theo cả đợt đang bật cờ (khu TESTER). */
export type LocDotThu = { kieu: 'ban'; ma: string } | { kieu: 'dot'; nhan?: string | null };

export async function docDotThu(pool: pg.Pool, loc: LocDotThu): Promise<KetQuaDotThu> {
  const q = async <R = Record<string, any>>(sql: string, p: unknown[] = []): Promise<R[]> =>
    (await pool.query(sql, p)).rows as R[];
  const BAN_NAY = CONSENT_PHIEN_BAN.buoi_do;

  let ban: Record<string, any> | null = null;
  let nhan: string | null = null;
  let ids: string[];
  let thongKeConsent: Pick<ThongKeDotThu, 'dong_y' | 'da_rut' | 'loai_ban_cu'>;

  if (loc.kieu === 'ban') {
    ban = (await q(
      `SELECT ma, loai, de_id, nhan, balance_version, seed, so_o, created_at, het_han,
              (het_han <= now()) AS da_dong
         FROM holdem_ban WHERE ma = $1`, [loc.ma]))[0] ?? null;
    if (!ban) throw new LoiDotThu('ban_khong_co', { ma: loc.ma });
    if (ban.loai !== 'buoi_do') throw new LoiDotThu('khong_phai_buoi_do', { ma: loc.ma, loai: ban.loai });
    nhan = ban.nhan ?? null;

    /*
     * Vết MỚI NHẤT của mỗi người với bàn này.
     * ⚠ `ORDER BY event_id DESC` chứ không `ts DESC`: hai vết trong cùng một giây (bấm rồi rút ngay)
     *   thì `ts` không phân xử được, `event_id` thì luôn.
     */
    const vet = await q<{ user_id: string; phien_ban: string | null; trang_thai: string }>(
      `SELECT DISTINCT ON (e.user_id) e.user_id, e.value_json->>'phien_ban' AS phien_ban,
              e.action_type AS trang_thai
         FROM events e
        WHERE e.action_type IN ('hd_dong_y_buoi_do', 'hd_rut_buoi_do')
          AND e.value_json->>'ban_ma' = $1
        ORDER BY e.user_id, e.event_id DESC`, [loc.ma]);
    const dangDongY = vet.filter((r) => r.trang_thai === 'hd_dong_y_buoi_do');
    const hopLe = dangDongY.filter((r) => r.phien_ban === BAN_NAY);
    thongKeConsent = {
      dong_y: dangDongY.length,
      da_rut: vet.length - dangDongY.length,
      loai_ban_cu: dangDongY.length - hopLe.length,
    };
    if (hopLe.length === 0) throw new LoiDotThu('khong_ai_dong_y', thongKeConsent);
    ids = hopLe.map((r) => r.user_id);
  } else {
    nhan = loc.nhan ?? null;
    /*
     * ⚠ CỜ `thu_chi_tiet` LÀ ĐIỀU KIỆN CẦN, KHÔNG PHẢI ĐIỀU KIỆN ĐỦ. Cờ nói "người này vào bằng link
     * tester"; vết trong `events` mới là bằng chứng họ đã đọc và bấm bản nào. Cờ có thể bật mà vết
     * hỏng (sự cố), nên vẫn kiểm vết — cờ chỉ để lọc nhanh và để gom theo ĐỢT.
     */
    const nguoi = await q<{ user_id: string }>(
      `SELECT u.user_id FROM users u
        WHERE u.thu_chi_tiet AND u.deleted_at IS NULL
          AND ($1::text IS NULL OR u.thu_chi_tiet_nhan = $1)
          AND (SELECT e.action_type FROM events e
                WHERE e.user_id = u.user_id
                  AND e.action_type IN ('hd_dong_y_buoi_do', 'hd_rut_buoi_do')
                ORDER BY e.event_id DESC LIMIT 1) = 'hd_dong_y_buoi_do'
          AND (SELECT e.value_json->>'phien_ban' FROM events e
                WHERE e.user_id = u.user_id AND e.action_type = 'hd_dong_y_buoi_do'
                ORDER BY e.event_id DESC LIMIT 1) = $2`, [nhan, BAN_NAY]);
    const [dem] = await q<{ bat: number }>(
      `SELECT count(*)::int AS bat FROM users u
        WHERE u.thu_chi_tiet AND u.deleted_at IS NULL AND ($1::text IS NULL OR u.thu_chi_tiet_nhan = $1)`,
      [nhan]);
    thongKeConsent = {
      dong_y: nguoi.length, da_rut: 0, loai_ban_cu: Number(dem?.bat ?? 0) - nguoi.length,
    };
    ids = nguoi.map((r) => r.user_id);
    if (ids.length === 0) return { ban: null, nhan, hangNguoi: [], hangVong: [], hangTrait: [], thongKe: { ...thongKeConsent, tran: 0, tran_da_dung: 0 } };
  }

  /* Trận trong đợt: theo bàn thì đúng bàn ấy; theo đợt thì mọi trận buổi đo của họ. */
  const tran = await q(
    `SELECT m.match_id::text AS match_id, m.owner_user_id::text AS uid, m.seed::text AS seed,
            m.status, m.vong_hien_tai, m.balance_version, m.ban_ma, m.started_at, m.ended_at,
            r.hang, r.von_cuoi, r.vong_chay, coalesce(r.dau_hang, false) AS dau_hang, b.de_id,
            (SELECT count(*)::int FROM holdem_results x WHERE x.match_id = m.match_id) AS so_ghe,
            (SELECT count(*)::int FROM hanh_vi_tran t WHERE t.match_id = m.match_id) AS da_dung
       FROM holdem_matches m
       LEFT JOIN holdem_results r ON r.match_id = m.match_id AND r.user_id = m.owner_user_id
       LEFT JOIN holdem_ban b ON b.ma = m.ban_ma
      WHERE m.owner_user_id = ANY($1::uuid[])
        AND ($2::text IS NULL OR m.ban_ma = $2)
        AND ($2::text IS NOT NULL OR m.ban_ma IS NOT NULL)
      ORDER BY m.started_at`, [ids, loc.kieu === 'ban' ? loc.ma : null]);

  const phu = tran.filter((t) => Number(t.da_dung) > 0).length;
  if (loc.kieu === 'ban' && tran.length > 0 && phu === 0) {
    throw new LoiDotThu('chua_dung_hanh_vi', { tran: tran.length });
  }

  const idTran = tran.map((t) => t.match_id);

  /*
   * D440 — LƯỢT CHƠI (founder 27/09: *"tester tính id theo lượt … nếu 1 lượt lỗi do sự cố còn biết"* ⇒ chọn: mã theo LƯỢT,
   * GIỮ mã người). Mã buổi đo vẫn theo người (khoá ghép ba phiếu); mỗi lượt = một trận = một `ma_tham_gia`. Một tài khoản
   * một trận mỗi bàn (UNIQUE — chơi lại cùng seed là biết trước ô), nên người gặp sự cố chơi lại trên một BÀN PHỤ cùng đề.
   * `lan_thu` = thứ tự lượt của người ấy trên CÙNG đề, qua MỌI bàn buổi đo; `luot_truoc` = mã lượt ngay trước. ⚠ Lượt ≥ 2
   * đã thấy trước một phần ô ⇒ đọc riêng, không gộp như lượt đầu.
   */
  const luot = ids.length === 0 ? [] : await q<{ match_id: string; uid: string; de_id: string | null }>(
    `SELECT m.match_id::text AS match_id, m.owner_user_id::text AS uid, b.de_id
       FROM holdem_matches m JOIN holdem_ban b ON b.ma = m.ban_ma AND b.loai = 'buoi_do'
      WHERE m.owner_user_id = ANY($1::uuid[])
      ORDER BY m.owner_user_id, b.de_id, m.started_at, m.match_id`, [ids]);
  const luotTheo = new Map<string, { lan_thu: number; luot_truoc: string | null }>();
  {
    let nhom = '';
    let lan = 0;
    let truoc: string | null = null;
    for (const r of luot) {
      const k = `${r.uid}#${r.de_id ?? ''}`;
      if (k !== nhom) { nhom = k; lan = 0; truoc = null; }
      lan += 1;
      luotTheo.set(r.match_id, { lan_thu: lan, luot_truoc: truoc });
      truoc = maThamGia(r.match_id);
    }
  }
  const hv = idTran.length === 0 ? [] : await q(
    `SELECT hv.match_id::text AS match_id,
            count(*)::int                                 AS so_vong,
            count(*) FILTER (WHERE NOT hv.tu_dong)::int   AS vong_quyet,
            count(*) FILTER (WHERE hv.tu_dong)::int       AS vong_tu_dong,
            count(*) FILTER (WHERE hv.o_su_kien)::int     AS vong_su_kien,
            count(*) FILTER (WHERE hv.la_tin_gia)::int    AS vong_tin_gia,
            count(*) FILTER (WHERE hv.mo_bang)::int       AS lan_mo_bang,
            avg(hv.brier)                                 AS brier_tb,
            avg(hv.ms_quyet)::float8                      AS ms_quyet_tb,
            max(hv.tiet_kiem_bp)                          AS tiet_kiem_bp,
            max(hv.tk_huy_so)                             AS tk_huy_so,
            sum(hv.tk_huy_so)::int                        AS tk_huy_so_tong,
            min(hv.vai)                                   AS vai,
            min(hv.so_o)                                  AS so_o,
            avg(hv.so_ma)::float8                         AS so_ma_tb,
            avg(hv.so_nhom)::float8                       AS so_nhom_tb,
            avg(1.0 - hv.tien_mat_bp / 10000.0)::float8   AS phoi_nhiem_tb,
            bool_or(hv.tran_xong)                         AS tran_xong,
            bool_or(hv.nghi_may)                          AS nghi_may,
            -- D437 — lớp v55. SQL chỉ ĐẾM; ô của trận chạy luật chưa có lửa/trait để trống ở vỏ JS (A11.2).
            max(hv.lua_nac)::int                          AS lua_nac_max,
            count(*) FILTER (WHERE hv.lua_dap IS NOT NULL)::int AS so_vong_lua_dap,
            count(*) FILTER (WHERE hv.lua_dap = 'mua_duoi_muon')::int AS so_vong_mua_duoi_muon,
            count(*) FILTER (WHERE hv.nguon_tin_rieng IS NOT NULL)::int AS so_vong_tin_rieng,
            (array_agg(hv.xu ORDER BY hv.vong DESC))[1]   AS xu_cuoi,
            (array_agg(hv.trait_json ORDER BY hv.vong DESC))[1] AS trait_cuoi,
            min(hv.formula_version)::int                  AS cong_thuc_min
       FROM hanh_vi_vong hv WHERE hv.match_id = ANY($1::uuid[]) GROUP BY 1`, [idTran]);
  const hvTheo = new Map(hv.map((r) => [r.match_id, r]));
  const luatTheo = new Map(tran.map((t) => [t.match_id as string, luatCua(t.balance_version as string | null)]));

  /*
   * D437 — hai nguồn v55 chỉ có trong `events` của CHÍNH chủ trận: trait CÓ HIỆU LỰC TRONG vòng (`hd_chot_phien.trait_vong` —
   * kho hành vi đọc nó rồi chỉ giữ hai cột suy ra) và lượt chợ trait (`hd_chon_trait`, 0070).
   */
  const chot = idTran.length === 0 ? [] : await q<{ match_id: string; vong: number; trait_vong: unknown[] }>(
    `SELECT m.match_id::text AS match_id, (e.value_json->>'vong')::int AS vong, e.value_json->'trait_vong' AS trait_vong
       FROM holdem_matches m
       JOIN events e ON e.context_type = 'holdem' AND e.context_id = m.match_id::text AND e.user_id = m.owner_user_id
      WHERE m.match_id = ANY($1::uuid[]) AND e.action_type = 'hd_chot_phien'
        AND jsonb_typeof(e.value_json->'trait_vong') = 'array' AND (e.value_json->>'vong') ~ '^[0-9]+$'
      ORDER BY e.event_id`, [idTran]);
  const traitVongTheo = new Map<string, string[]>();   // khoá `${match_id}#${vong}`
  for (const r of chot) {
    traitVongTheo.set(`${r.match_id}#${r.vong}`, r.trait_vong.filter((x): x is string => typeof x === 'string'));
  }
  const cho = idTran.length === 0 ? [] : await q<{
    match_id: string; ts: Date; so_lay: string | null; vj: Record<string, unknown> | null;
  }>(
    `SELECT m.match_id::text AS match_id, e.ts, e.value_num AS so_lay, e.value_json AS vj
       FROM holdem_matches m
       JOIN events e ON e.context_type = 'holdem' AND e.context_id = m.match_id::text AND e.user_id = m.owner_user_id
      WHERE m.match_id = ANY($1::uuid[]) AND e.action_type = 'hd_chon_trait'
      ORDER BY m.match_id, e.event_id`, [idTran]);
  const choTheo = new Map<string, { moc: number; lay: number; cuon: number; bo_qua: number }>();
  for (const r of cho) {
    const c = choTheo.get(r.match_id) ?? { moc: 0, lay: 0, cuon: 0, bo_qua: 0 };
    c.moc += 1;
    c.lay += r.so_lay === null ? 0 : Number(r.so_lay);
    c.cuon += typeof r.vj?.cuon === 'number' ? r.vj.cuon : 0;
    c.bo_qua += r.vj?.bo_qua === true ? 1 : 0;
    choTheo.set(r.match_id, c);
  }

  /*
   * DẤU VẾT TRONG APP — vế "feedback về app". Telemetry CHỈ của người đang bật ghi
   * (`research_consent`): đồng ý buổi đo không thay cửa ghi chung, hai cửa khác nhau (A9).
   */
  const vetApp = await q(
    `SELECT t.user_id::text AS uid,
            count(*) FILTER (WHERE t.loai = 'man_vao')::int    AS so_man_vao,
            count(*) FILTER (WHERE t.loai = 'loi_client')::int AS so_loi_client,
            count(*) FILTER (WHERE t.loai = 'loi_api')::int    AS so_loi_api,
            (array_agg(t.man ORDER BY t.ts DESC) FILTER (WHERE t.loai = 'man_vao'))[1] AS man_cuoi,
            (array_agg(t.chi_tiet->>'vong' ORDER BY t.ts DESC) FILTER (WHERE t.loai = 'tran_thoat'))[1] AS thoat_vong,
            (array_agg(t.chi_tiet->>'buoc' ORDER BY t.ts DESC) FILTER (WHERE t.loai = 'huong_dan_buoc'))[1] AS hd_buoc_cuoi
       FROM telemetry t
       JOIN users u ON u.user_id = t.user_id AND u.research_consent
      WHERE t.user_id = ANY($1::uuid[]) GROUP BY 1`, [ids]);
  const vetTheo = new Map(vetApp.map((r) => [r.uid, r]));

  /* PFM — kỳ MỚI NHẤT của mỗi người. Dạng dài; vỏ gọi lấy mã nào nó cần. */
  const pfm = await q(
    `SELECT DISTINCT ON (d.user_id, d.ma, d.doi_tuong)
            d.user_id::text AS uid, d.ma, d.doi_tuong, d.gia_tri
       FROM pfm_dac_trung d WHERE d.user_id = ANY($1::uuid[])
      ORDER BY d.user_id, d.ma, d.doi_tuong, d.ky DESC`, [ids]);
  const pfmTheo = new Map<string, typeof pfm>();
  for (const r of pfm) {
    const cu = pfmTheo.get(r.uid);
    if (cu) cu.push(r); else pfmTheo.set(r.uid, [r]);
  }

  const bat = await q<{
    uid: string; bd: string | null; nhan: string | null; ma_buoi_do: string | null;
    buoc: number | null; dong_y_luc: Date | null; nhom_tuoi: string | null; vung: string | null;
    nghe: string | null; ghi_telemetry: boolean; ban_tap_xong: boolean;
  }>(
    `SELECT u.user_id::text AS uid, u.pfm_bat_dau::text AS bd, u.thu_chi_tiet_nhan AS nhan, u.ma_buoi_do,
            u.buoi_do_buoc AS buoc, u.thu_chi_tiet_luc AS dong_y_luc,
            u.age_band AS nhom_tuoi, u.region AS vung, u.occupation_band AS nghe,
            u.research_consent AS ghi_telemetry,
            EXISTS (SELECT 1 FROM holdem_matches m2
                     WHERE m2.owner_user_id = u.user_id AND m2.status = 'xong'
                       AND m2.seed = ANY($2::bigint[])) AS ban_tap_xong
       FROM users u WHERE u.user_id = ANY($1::uuid[])`, [ids, SEED_MAN_TAP_MOI_THOI]);
  const batTheo = new Map(bat.map((r) => [r.uid, r]));

  /*
   * DÒNG THEO VÒNG — đọc TRƯỚC dòng người vì bậc ba năng lực của trận chấm từ chính những dòng này
   * (`chamNangLucTran`, hàm thuần — cùng thước `/autopsy` dùng, không phải bản chép thứ hai).
   * Ba cột `tran_xong · man_tap · nghi_may` thêm vào để hàm chấm có đủ đầu vào (`DongNangLuc`).
   */
  const vong = idTran.length === 0 ? [] : await q(
    `SELECT hv.match_id::text AS match_id, hv.vong, hv.ts, hv.pnl_bp, hv.brier, hv.brier_v,
            hv.mo_bang, hv.o_su_kien, hv.la_tin_gia, hv.chuoi_tang, hv.tu_dong, hv.cho_bp,
            hv.tien_mat_bp, hv.so_ma, hv.so_nhom, hv.ms_quyet, hv.tiet_kiem_bp, hv.tk_huy_so,
            hv.tran_xong, hv.man_tap, hv.nghi_may,
            hv.lua_nac, hv.lua_dap, hv.xu, hv.trait_json, hv.nguon_tin_rieng, hv.co_che_cat_lo,
            jsonb_array_length(hv.lenh_json) AS so_lenh
       FROM hanh_vi_vong hv WHERE hv.match_id = ANY($1::uuid[])
      ORDER BY hv.match_id, hv.vong`, [idTran]);
  const vongTheoTran = new Map<string, DongNangLuc[]>();
  for (const r of vong) {
    const so = (x: unknown): number | null => (x === null || x === undefined ? null : Number(x));
    const d: DongNangLuc = {
      vong: Number(r.vong), brier: so(r.brier), o_su_kien: r.o_su_kien === true, la_tin_gia: r.la_tin_gia === true,
      tu_dong: r.tu_dong === true, so_ma: so(r.so_ma), tien_mat_bp: so(r.tien_mat_bp),
      tiet_kiem_bp: so(r.tiet_kiem_bp), tk_huy_so: so(r.tk_huy_so), so_nhom: so(r.so_nhom),
      tran_xong: r.tran_xong === true, man_tap: r.man_tap === true, nghi_may: r.nghi_may === true,
      // D436 — trận có hệ trait ⇒ bậc LỌC TIN tách (cùng hàm chấm với `/me/nang-luc`).
      trait_json: r.trait_json == null ? null : (r.trait_json as string[]),
    };
    const cu = vongTheoTran.get(r.match_id);
    if (cu) cu.push(d); else vongTheoTran.set(r.match_id, [d]);
  }
  // D437 — Brier trung bình trên vòng SẠCH TIN (`laVongSachTin`), theo từng trận.
  const sachTheo = new Map<string, { tong: number; n: number }>();
  for (const r of vong) {
    const s = sachTheo.get(r.match_id) ?? { tong: 0, n: 0 };
    const coTrait = luatTheo.get(r.match_id)?.trait === true;
    const tv = traitVongTheo.get(`${r.match_id}#${r.vong}`) ?? null;
    if (r.brier !== null && r.brier !== undefined
      && laVongSachTin((r.nguon_tin_rieng as string | null) ?? null, coTrait, tv)) {
      s.tong += Number(r.brier); s.n += 1;
    }
    sachTheo.set(r.match_id, s);
  }

  const bacCua = (matchId: string) => {
    const rows = vongTheoTran.get(matchId);
    if (!rows || rows.length === 0) return null;
    const the = chamNangLucTran(rows);
    const bac = (id: string) => the.nang_luc.find((n) => n.id === id)?.bac ?? null;
    return {
      the_tinh_vao: the.tinh_vao_the, the_ly_do_khong_tinh: the.ly_do_khong_tinh,
      bac_cam_ket_tiet_kiem: bac('cam_ket_tiet_kiem'), bac_doc_tin: bac('doc_tin'), bac_phan_tan: bac('phan_tan'),
    };
  };

  const hangNguoi = tran.map((t) => {
    const h: any = hvTheo.get(t.match_id) ?? {};
    const v: any = vetTheo.get(t.uid) ?? {};
    const dt = pfmTheo.get(t.uid) ?? [];
    const lay = (m: string) => dt.find((x) => x.ma === m && x.doi_tuong === '')?.gia_tri ?? null;
    const u = batTheo.get(t.uid);
    const de = deCua(t.de_id);
    const the = bacCua(t.match_id);
    return {
      ma_buoi_do: u?.ma_buoi_do ?? '',
      ma_tham_gia: maThamGia(t.match_id),
      // D440 — thứ tự LƯỢT của người này trên cùng đề (qua mọi bàn buổi đo) + mã lượt ngay trước.
      lan_thu: luotTheo.get(t.match_id)?.lan_thu ?? null, luot_truoc: luotTheo.get(t.match_id)?.luot_truoc ?? null,
      dot: u?.nhan ?? '', ban_ma: t.ban_ma ?? '',
      buoc: u?.buoc ?? null, dong_y_luc: u?.dong_y_luc ?? null,
      trang_thai_tran: t.status, dau_hang: t.dau_hang === true, hang: t.hang, so_ghe: t.so_ghe, von_cuoi: t.von_cuoi,
      vong_chay: t.vong_chay, vong_dung: t.vong_hien_tai, luat: t.balance_version, seed: t.seed,
      de_id: t.de_id ?? null, de_chu_ky: de ? de.chu_ky.join('|') : null,
      vai: h.vai ?? null, so_o: h.so_o ?? null,
      bat_dau_luc: t.started_at ?? null, ket_thuc_luc: t.ended_at ?? null,
      so_vong: h.so_vong ?? null, vong_quyet: h.vong_quyet ?? null, vong_tu_dong: h.vong_tu_dong ?? null,
      vong_su_kien: h.vong_su_kien ?? null, vong_tin_gia: h.vong_tin_gia ?? null,
      lan_mo_bang: h.lan_mo_bang ?? null,
      brier_tb: h.brier_tb ?? null, ms_quyet_tb: h.ms_quyet_tb ?? null,
      tiet_kiem_bp: h.tiet_kiem_bp ?? null, tk_huy_so: h.tk_huy_so ?? null, tk_huy_so_tong: h.tk_huy_so_tong ?? null,
      so_ma_tb: h.so_ma_tb ?? null, so_nhom_tb: h.so_nhom_tb ?? null, phoi_nhiem_tb: h.phoi_nhiem_tb ?? null,
      tran_xong: h.tran_xong ?? null, nghi_may: h.nghi_may ?? null,
      // D437 — lớp v55; trận chạy luật chưa có lửa/trait ⇒ ô trống (A11.2), không phải 0.
      ...(() => {
        const l = luatTheo.get(t.match_id);
        // Cột từ `hanh_vi_vong` cần CẢ luật có lửa/trait LẪN dòng đã dựng bằng công thức có lớp v55.
        const daTinh = Number(h.cong_thuc_min ?? 0) >= CONG_THUC_CO_LOP_V55;
        const coLua = l?.lua === true && daTinh;
        const coTraitHv = l?.trait === true && daTinh;
        // Con đếm chợ đọc `events` (nguồn gốc, không phụ thuộc lần dựng) ⇒ chỉ cần luật có trait.
        const coTrait = l?.trait === true;
        const c = choTheo.get(t.match_id) ?? { moc: 0, lay: 0, cuon: 0, bo_qua: 0 };
        const s = sachTheo.get(t.match_id);
        const conTrait = Array.isArray(h.trait_cuoi) ? h.trait_cuoi as unknown[] : null;
        return {
          lua_nac_max: coLua ? h.lua_nac_max ?? null : null,
          so_vong_lua_dap: coLua ? h.so_vong_lua_dap ?? null : null,
          so_vong_mua_duoi_muon: coLua ? h.so_vong_mua_duoi_muon ?? null : null,
          xu_cuoi: coLua ? h.xu_cuoi ?? null : null,
          trait_cuoi: coTraitHv ? noi(conTrait) : null,
          so_trait_cuoi: coTraitHv && conTrait !== null ? conTrait.length : null,
          so_moc_trait: coTrait ? c.moc : null,
          so_trait_lay: coTrait ? c.lay : null,
          so_lan_cuon: coTrait ? c.cuon : null,
          so_moc_bo_qua: coTrait ? c.bo_qua : null,
          so_vong_tin_rieng: daTinh ? h.so_vong_tin_rieng ?? null : null,
          brier_tb_sach: daTinh && s && s.n > 0 ? s.tong / s.n : null,
          so_vong_brier_sach: daTinh && s ? s.n : null,
        };
      })(),
      the_tinh_vao: the?.the_tinh_vao ?? null, the_ly_do_khong_tinh: the?.the_ly_do_khong_tinh ?? null,
      bac_cam_ket_tiet_kiem: the?.bac_cam_ket_tiet_kiem ?? null,
      bac_doc_tin: the?.bac_doc_tin ?? null,
      bac_phan_tan: the?.bac_phan_tan ?? null,
      ban_tap_xong: u?.ban_tap_xong ?? null,
      nhom_tuoi: u?.nhom_tuoi ?? null, vung: u?.vung ?? null, nghe: u?.nghe ?? null,
      ghi_telemetry: u?.ghi_telemetry ?? null,
      pfm_bat_dau: u?.bd ?? '', pfm_so_dac_trung: dt.length,
      hv_ngay_co_ghi: lay('hv_ngay_co_ghi'), hv_ngay_co_mat: lay('hv_ngay_co_mat'),
      hv_chi_bu: lay('hv_chi_bu'),
      hv_tien_ve_tieu: lay('hv_tien_ve_tieu'), hv_vi_sale: lay('hv_vi_sale'),
      hv_tiet_kiem_rong: lay('hv_tiet_kiem_rong'), kq_giu_luat: lay('kq_giu_luat'),
      app_so_man_vao: v.so_man_vao ?? null, app_man_cuoi: v.man_cuoi ?? null,
      app_thoat_vong: v.thoat_vong ?? null, app_hd_buoc_cuoi: v.hd_buoc_cuoi ?? null,
      app_so_loi_client: v.so_loi_client ?? null, app_so_loi_api: v.so_loi_api ?? null,
    };
  });

  const uidTheoTran = new Map(tran.map((t) => [t.match_id as string, t.uid as string]));
  const hangVong = vong.map(({ match_id, trait_json, ...con }) => ({
    ma_buoi_do: batTheo.get(uidTheoTran.get(match_id) ?? '')?.ma_buoi_do ?? '',
    ma_tham_gia: maThamGia(match_id), ...con,
    // D437 — danh sách nối "|"; `trait_trong_vong` chỉ có ở trận có hệ trait (không thì ô trống, không phải "không mang gì").
    trait_json: noi(trait_json),
    trait_trong_vong: luatTheo.get(match_id)?.trait === true
      ? noi(traitVongTheo.get(`${match_id}#${con.vong}`) ?? null) : null,
  }));

  // D437 — tệp THỨ BA: mỗi lượt chợ trait một dòng (lớp Ý ĐỊNH — mời gì, lấy gì, cuộn mấy lần, bỏ qua không).
  const soHuu = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const hangTrait = cho.map((r) => {
    const vj = r.vj ?? {};
    return {
      ma_buoi_do: batTheo.get(uidTheoTran.get(r.match_id) ?? '')?.ma_buoi_do ?? '',
      ma_tham_gia: maThamGia(r.match_id),
      vong: soHuu(vj.vong), moc: soHuu(vj.moc),
      moi: noi(vj.moi), lay: noi(vj.lay), so_lay: r.so_lay === null ? null : Number(r.so_lay),
      cuon: soHuu(vj.cuon), xu_truoc: soHuu(vj.xu_truoc), xu_sau: soHuu(vj.xu_sau),
      mat_tri: typeof vj.mat_tri === 'string' ? vj.mat_tri : null,
      bo_qua: typeof vj.bo_qua === 'boolean' ? vj.bo_qua : null,
      tu_dong: vj.tu_dong === true,
      dang_mang: noi(vj.dang_mang),
      ts: r.ts,
    };
  });

  return {
    ban, nhan, hangNguoi, hangVong, hangTrait,
    thongKe: { ...thongKeConsent, tran: tran.length, tran_da_dung: phu },
  };
}

/*
 * ─── D440 — LỌC NHIỄU CHO PHÂN TÍCH ────────────────────────────────────────────────────────────────────────────────
 * Founder 27/09: *"ko lưu dữ liệu buổi đo bị dở hoặc có dấu hiệu spam … nhiễu dữ liệu lúc phân tích"*. Hai tầng, hai việc:
 *   · THU: không bỏ gì. `events` chỉ ghi thêm (A3.3 — cửa một chiều, A11.17), và lúc một vòng được ghi thì chưa ai biết trận
 *     sẽ xong hay không. Spam ở cửa thu đã có rào: một trận mỗi người mỗi bàn · 60 tài khoản/bàn/24 giờ · khách không vào.
 *   · PHÂN TÍCH: tệp xuất chỉ giữ lượt đo TRỌN VẸN. Khu TESTER (`/quan-tri`, theo dõi TRONG buổi) vẫn đọc bản đủ — lọc ở đó
 *     là giấu người đang chơi dở khỏi chính người điều phối.
 * Ba lý do loại, đều là cờ app ĐÃ có (không đặt ngưỡng mới — A8.2):
 *   · `chua_xong` — trận chưa khép (bỏ dở / đang chơi): thiếu nửa sau của mọi thước;
 *   · `dau_hang`  — trận đầu hàng: cùng điều kiện "đã xong" của màn điều phối và trang nhóm (D396);
 *   · `nghi_may`  — MỌI vòng (≥ 2) để máy chốt hộ (`danCoNghiMay`): người không chơi, chỉ treo máy — thẻ cũng không tính.
 * Cả ba tệp (người · vòng · lượt chợ) lọc CÙNG một tập trận, khoá (mã buổi đo, mã tham gia): một người một trận mỗi bàn.
 */
export type LyDoLoai = 'chua_xong' | 'dau_hang' | 'nghi_may';

/** D440 — lý do loại một dòng người khỏi tệp phân tích; `null` = giữ. Thứ tự: dở trước, rồi đầu hàng, rồi treo máy. */
export function lyDoLoai(h: Record<string, unknown>): LyDoLoai | null {
  if (h.trang_thai_tran !== 'xong') return 'chua_xong';
  if (h.dau_hang === true) return 'dau_hang';
  if (h.nghi_may === true) return 'nghi_may';
  return null;
}

/**
 * D440 — bản kết quả chỉ còn lượt đo trọn vẹn + số bị loại theo từng lý do + `hangLoai`: MỖI LƯỢT bị loại một dòng, KHÔNG
 * vứt (founder: *"nếu 1 lượt lỗi do sự cố còn biết"*). `co_loi_ghi_nhan`: lượt có lỗi app/máy chủ được ghi lại không —
 * `null` khi người ấy không bật ghi dấu vết (không biết, KHÔNG phải "không lỗi" — A11.2).
 */
export function locPhanTich(kq: KetQuaDotThu): {
  kq: KetQuaDotThu; loai: Record<LyDoLoai, number>; hangLoai: Array<Record<string, unknown>>;
} {
  const loai: Record<LyDoLoai, number> = { chua_xong: 0, dau_hang: 0, nghi_may: 0 };
  const khoa = (x: Record<string, unknown>): string => `${String(x.ma_buoi_do ?? '')}#${String(x.ma_tham_gia ?? '')}`;
  const giu = new Set<string>();
  const hangLoai: Array<Record<string, unknown>> = [];
  for (const h of kq.hangNguoi) {
    const ly = lyDoLoai(h);
    if (ly === null) { giu.add(khoa(h)); continue; }
    loai[ly] += 1;
    const soLoi = Number(h.app_so_loi_client ?? 0) + Number(h.app_so_loi_api ?? 0);
    hangLoai.push({
      ma_buoi_do: h.ma_buoi_do, ma_tham_gia: h.ma_tham_gia, ly_do_loai: ly,
      co_loi_ghi_nhan: h.ghi_telemetry === true ? soLoi > 0 : null,
      ...h,
    });
  }
  const loc = (xs: Array<Record<string, unknown>>) => xs.filter((x) => giu.has(khoa(x)));
  return {
    kq: { ...kq, hangNguoi: loc(kq.hangNguoi), hangVong: loc(kq.hangVong), hangTrait: loc(kq.hangTrait) },
    loai, hangLoai,
  };
}

/** Các ĐỢT đang có người bật cờ — để khu TESTER cho chọn. */
export async function dsDotThu(pool: pg.Pool): Promise<Array<{ nhan: string | null; n: number }>> {
  const { rows } = await pool.query(
    `SELECT thu_chi_tiet_nhan AS nhan, count(*)::int AS n
       FROM users WHERE thu_chi_tiet AND deleted_at IS NULL
      GROUP BY 1 ORDER BY 2 DESC, 1`);
  return rows as Array<{ nhan: string | null; n: number }>;
}

/**
 * MỘT Ô CSV — tối giản nhưng đúng: bọc kép khi có dấu phẩy/nháy/xuống dòng; `null` ⇒ ô trống.
 * Sống ở đây (lõi đọc chung), không trong script: bài canh gọi thẳng được mà không nạp `.env` của script.
 *
 * ⚠ D396 — MỐC GIỜ RA ISO-8601 UTC (`…Z`). Trước đó `String(Date)` in `Thu Sep 24 2026 13:35:38 GMT+0700
 * (Indochina Time)`: theo múi giờ của MÁY chạy lệnh, bảng tính không nhận là ngày giờ, và ghép với giờ nộp
 * Google Form (theo múi giờ của phiếu) là phải tự đoán lệch mấy tiếng.
 */
export function oCsv(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString()
    : typeof v === 'number' && !Number.isInteger(v) ? String(Math.round(v * 1e4) / 1e4) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
