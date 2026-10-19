/**
 * ORACLE LEVEL + BẬC DỰ BÁO — tham số tiến trình.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LEVEL LÀ CHỈ SỐ DẪN XUẤT, KHÔNG PHẢI MỘT LOẠI TIỀN.
 *
 * Không có bảng nào lưu XP, không có cột nào cộng dồn, không có gì tiêu được.
 * Mỗi lần gọi API là tính lại từ dữ liệu ĐÃ CÓ (bets/markets/holdem_results).
 *
 * Vì sao chọn dẫn xuất chứ không lưu:
 *   · không thêm faucet nào vào kinh tế — Level không thể lạm phát;
 *   · đổi công thức là đổi một số ở đây rồi mọi người có Level mới ngay, không
 *     cần migration hay backfill;
 *   · `users.quest_points` đang bị trigger DB đóng băng (migration 0002), nên
 *     cắm XP vào đó là UPDATE bị chặn lúc chạy thật.
 *
 * ĐỔI CÔNG THỨC = ĐỔI `LEVEL_FORMULA_VERSION`. Số Level của mọi người dịch theo,
 * nên phải cố ý, và phải ghi vào nhật ký quyết định.
 */

export const LEVEL_FORMULA_VERSION = 'level-v1-2026-07-25';

/**
 * XP theo HÀNH VI ĐÃ LÀM. Cân theo nguyên tắc: THAM GIA luôn được cộng, ĐÚNG
 * được cộng thêm, nhưng tham gia vẫn là phần lớn.
 *
 * Vì sao không để "đúng" chi phối: Level là thước ĐỘ DÀY KINH NGHIỆM, không
 * phải thước kỹ năng — kỹ năng đã có Bậc dự báo (Brier) đo riêng. Nếu Level
 * cũng chạy theo độ chính xác thì hai chỉ số nói cùng một chuyện, và người mới
 * đoán sai vài lần sẽ thấy mình "không lên được cấp" dù vẫn đang chơi đều.
 */
export const XP = {
  /** Mỗi câu hỏi đã phân bổ token (đếm 1 lần/kèo, không theo số lệnh). */
  KEO_THAM_GIA: 10,
  /** Cộng thêm khi kèo đó chốt và mình có token ở cửa thắng. */
  KEO_DUNG: 25,
  /** Mỗi trận Đấu trường đã chơi xong. */
  TRAN_XONG: 15,
  /** Cộng thêm khi về nhất trận. */
  TRAN_NHAT: 40,
} as const;

/**
 * Ngưỡng XP để lên cấp. `NGUONG[i]` là XP tối thiểu của Level `i + 1`.
 * Giãn dần: vài cấp đầu lên nhanh để người mới thấy chuyển động, sau đó chậm lại.
 */
export const NGUONG_XP: readonly number[] = [
  0, 60, 150, 280, 450, 680, 960, 1300, 1700, 2200,
  2800, 3500, 4300, 5200, 6300, 7600, 9100, 10800, 12800, 15000,
];

/** Level cao nhất đạt được với bảng ngưỡng hiện tại. */
export const LEVEL_TOI_DA = NGUONG_XP.length;

/** Level từ XP. Level 1 là sàn — người vừa đăng ký cũng là Level 1, không phải 0. */
export function levelTuXp(xp: number): number {
  let lv = 1;
  for (let i = 0; i < NGUONG_XP.length; i += 1) {
    if (xp >= NGUONG_XP[i]!) lv = i + 1;
    else break;
  }
  return lv;
}

/** Tiến độ trong cấp hiện tại — để vẽ thanh. Cấp tối đa thì thanh đầy. */
export function tienDoCap(xp: number): {
  level: number; xp_dau_cap: number; xp_cap_sau: number | null; phan_tram: number;
} {
  const level = levelTuXp(xp);
  const dau = NGUONG_XP[level - 1] ?? 0;
  const sau = level < NGUONG_XP.length ? NGUONG_XP[level]! : null;
  if (sau === null) return { level, xp_dau_cap: dau, xp_cap_sau: null, phan_tram: 100 };
  const phan = Math.max(0, Math.min(100, Math.floor(((xp - dau) * 100) / (sau - dau))));
  return { level, xp_dau_cap: dau, xp_cap_sau: sau, phan_tram: phan };
}

// ══════════════════════════════════════════════════════════════════════════
// BẬC DỰ BÁO — từ Brier trung bình per-pool
// ══════════════════════════════════════════════════════════════════════════

/**
 * Số kèo đã chốt tối thiểu trong một pool để có bậc. Dưới ngưỡng → "Chưa xếp".
 * Cùng con số với `ECONOMY.UNRANKED_THRESHOLD`, nhưng KHÔNG import chéo:
 * config/economy là tầng tiền tệ, tầng này không được dính vào nó.
 */
export const NGUONG_XEP_BAC = 5;

/**
 * Ngưỡng Brier → bậc. Brier THẤP HƠN LÀ TỐT HƠN (thang 0–2).
 *
 * ⚠ MỐC SO SÁNH LÀ 0,75 — KHÔNG PHẢI 1,0.
 * Brier = Σ(p_i − o_i)². Với kèo 4 cửa, rải đều 25% mỗi cửa cho
 * 3×0,0625 + 0,5625 = **0,75**. Nên 0,75 chính là "đoán bừa nhưng biết chia
 * đều". Bậc phải neo quanh mốc đó, nếu không thì Đồng lại đang mô tả người chơi
 * tệ hơn cả rải đều mà vẫn nghe như đang ổn.
 *
 * Dồn hết vào cửa đúng = 0. Dồn hết vào cửa sai = 2.
 */
export const BAC_BRIER = [
  { bac: 'Vàng', toi_da: 0.40, y_nghia: 'đọc thị trường tốt hơn rải đều rõ rệt' },
  { bac: 'Bạc', toi_da: 0.62, y_nghia: 'nhỉnh hơn rải đều' },
  { bac: 'Đồng', toi_da: 0.78, y_nghia: 'quanh mức rải đều' },
  { bac: 'Chì', toi_da: Number.POSITIVE_INFINITY, y_nghia: 'đang tự tin sai hướng' },
] as const;

export type BacDuBao = (typeof BAC_BRIER)[number]['bac'] | 'Chưa xếp';

/** Bậc từ Brier trung bình + số kèo đã tính. Dưới ngưỡng → 'Chưa xếp'. */
export function bacTuBrier(brierTb: number | null, soKeo: number): BacDuBao {
  if (brierTb === null || soKeo < NGUONG_XEP_BAC) return 'Chưa xếp';
  for (const b of BAC_BRIER) if (brierTb <= b.toi_da) return b.bac;
  return 'Chì';
}

// ══════════════════════════════════════════════════════════════════════════
// VIỆC TUẦN + LỘ TRÌNH MÙA 0.0 "BETA ACCESS"
// (codename nội bộ `battle pass` — KHÔNG BAO GIỜ render, đúng nếp D26 với
//  "Market Hold'em". Nhãn player-facing: "LỘ TRÌNH MÙA 0.0".)
//
// ─────────────────────────────────────────────────────────────────────────
// LUẬT XƯƠNG SỐNG: LƯƠNG THEO CỬA SỔ, KHÔNG KHOÁN SẢN PHẨM.
//
// Phần thưởng gắn vào CỬA SỔ THỜI GIAN, không gắn vào SỐ HÀNH ĐỘNG trong cửa
// sổ đó. Người chơi 1 phiên và người chơi 40 phiên trong một tuần nhận ĐÚNG
// BẰNG NHAU. Đạo hàm của thưởng theo số hành động = 0 sau hành động đầu tiên,
// nên áp lực cày chết về mặt CẤU TRÚC — không có tham số nào để tinh chỉnh,
// không có ngưỡng nào để đoán đúng.
//
// Vì sao đó là yêu cầu của DỮ LIỆU chứ không phải một nhượng bộ: founder 27/07
// yêu cầu hạn chế tuyệt đối việc chơi theo meta mà không có chính kiến, "vì điều
// đó ảnh hưởng lớn đến data". Một việc kiểu "đặt 10 lệnh hôm nay" trả tiền cho
// việc bấm bừa, và mỗi lần bấm bừa ghi một dòng `bets` + một dòng `events` có
// `state_snapshot_json` — tức rác nằm ĐÚNG TRONG bảng sản phẩm (A1). Sai số của
// việc THIẾU nhiệm vụ là "ít dữ liệu"; sai số của nhiệm vụ SAI là "dữ liệu nhiễu
// trông như dữ liệu thật", và cái sau không phát hiện được sau khi đã trộn.
//
// ─────────────────────────────────────────────────────────────────────────
// HAI DANH SÁCH, VÀ ĐÂY LÀ CHỖ DUY NHẤT CHÚNG SỐNG
//
// ĐƯỢC làm điều kiện: có mặt (ngày hoạt động) · độ phủ (đã chạm bao nhiêu loại
//   bề mặt) · tiêu thụ (đã mở lại câu hỏi đã chốt chưa) · mốc do THẾ GIỚI phát
//   (câu hỏi đã chốt, tuần mới của mùa).
// CẤM tuyệt đối: mức cam kết (số T đặt) · % ví vào một cửa · rải bao nhiêu cửa ·
//   số cửa · lựa chọn hệ/thẻ/cỡ bàn · thắng/thua · thứ hạng · vốn cuối · điểm
//   xếp hạng · Brier · phân vị bảng.
//
// Lý do là GOODHART, không phải khẩu vị: biến nào bị gắn thưởng thì biến đó thôi
// đo cái nó từng đo và bắt đầu đo ÁP LỰC PHẦN THƯỞNG. D32 đã loại phương án
// "chuẩn hoá theo % tăng trưởng ví" bằng đúng lập luận này. Danh sách trên là một
// DANH SÁCH nên nó lint được — không phải một tinh thần cần diễn giải.
// ══════════════════════════════════════════════════════════════════════════

export const NHIEM_VU_VERSION = 'nv-v1-mua-0.0-2026-07-27';

/** Cửa sổ = ĐƠN VỊ TRẢ THƯỞNG. Cố ý KHÔNG có 'moi_lan' — đó là khoán sản phẩm. */
export type CuaSo = 'tuan' | 'mua';

/**
 * Bề mặt được phép sinh tiến độ.
 *
 * GIẢI XẾP HẠNG và HÀNH VI ĐẶT LỆNH KHÔNG có trong danh sách này, và cả hai vắng
 * mặt vì cùng một lý do: đầu ra của chúng chảy vào một PHÉP ĐO (sổ điểm zero-sum;
 * Brier + hai bảng D32). Bề mặt nào có đầu ra chảy vào một phép đo thì bề mặt đó
 * phải SẠCH NHIỆM VỤ. `xem_lai` được phép đếm ở phiên xếp hạng vì XEM không sinh
 * thêm dòng nào vào `holdem_results` — ranh giới là "sinh hay không sinh".
 */
export type BeMat = 'diem_danh' | 'du_bao' | 'dau_tu_do' | 'xem_lai' | 'dien_mao';

export interface NhiemVu {
  readonly nv_id: string;
  /** Nhãn player-facing. (Ban-list D26 + lint đã gỡ 16/08 — D91.) */
  readonly ten: string;
  readonly cua_so: CuaSo;
  readonly be_mat: BeMat;
  /**
   * Ngưỡng — CHỈ đếm được trên biến "có mặt / độ phủ / tiêu thụ", không bao giờ
   * trên biến quyết định. Mọi ngưỡng ở đây là số NGÀY, số NHÓM, số CÂU HỎI ĐÃ
   * CHỐT ĐÃ XEM: ba thứ mà chơi thêm không làm tăng được trong cùng một cửa sổ.
   */
  readonly muc: number;
  /**
   * A8.9 — cấm đường tắt không có ngày chết. Cuối mùa chạy I-N6 (so CÙNG MỘT
   * NGƯỜI, trong-cửa-sổ vs ngoài) cho từng việc; đỏ thì GỠ việc đó, KHÔNG "tinh
   * chỉnh giá trị". Việc không có ngày rà soát = lint fail.
   */
  readonly ngay_ra_soat: string;
}

const RA_SOAT = '2026-09-21'; // cuối mùa 0.0 + một tuần đệm

/**
 * BỐN VIỆC LÕI — có mặt ở MỌI tuần.
 *
 * Cả bốn đều `muc` thấp và không việc nào chạm nội dung quyết định:
 *  · `co_mat`   : nút thuần, không kèm điều kiện chơi gì. Hành động tối thiểu để
 *                 mở lương tuần CỐ Ý không sinh dữ liệu quyết định — người bấm
 *                 cho xong chỉ ghi một dòng siêu dữ liệu trung thực.
 *  · `xem_xet`  : hoàn thành được bằng cách CHỈ XEM một câu hỏi. Cố ý không đòi
 *                 phân bổ token — người không có quan điểm về CPI tháng này vẫn
 *                 xong việc mà không ghi một dòng `bets` vô nghĩa.
 *  · `mot_tran` : NGƯỠNG 1, không phải 2. `design_battle_pass_0_0.md §6.3` viết
 *                 "2 trận"; hạ về 1 theo luật mạnh hơn ở `design_nhiem_vu.md`
 *                 (`tran_moi_cua_so: 1`). Lý do: mọi ngưỡng > 1 sinh một GAI
 *                 trong histogram số hành động/ngày (chỉ số I-N5) — dấu hiệu
 *                 người ta HOÀN THÀNH thay vì CHƠI. Chênh lệch đã khai trong báo
 *                 cáo, không sửa lặng lẽ.
 *  · `doc_lai`  : tiêu thụ. Nguồn cung bị ĐỒNG HỒ BÊN NGOÀI chặn (câu hỏi chốt
 *                 theo lịch nguồn) nên chơi thêm không tạo thêm nguồn cung.
 */
export const VIEC_LOI: readonly NhiemVu[] = [
  {
    nv_id: 'co_mat',
    ten: 'Điểm danh 4 ngày trong tuần',
    cua_so: 'tuan', be_mat: 'diem_danh', muc: 4, ngay_ra_soat: RA_SOAT,
  },
  {
    nv_id: 'xem_xet',
    ten: 'Xem xét ít nhất 1 câu hỏi dự báo',
    cua_so: 'tuan', be_mat: 'du_bao', muc: 1, ngay_ra_soat: RA_SOAT,
  },
  {
    nv_id: 'mot_tran',
    ten: 'Chơi xong 1 phiên Đấu trường',
    cua_so: 'tuan', be_mat: 'dau_tu_do', muc: 1, ngay_ra_soat: RA_SOAT,
  },
  {
    nv_id: 'doc_lai',
    ten: 'Mở lại 1 câu hỏi đã chốt',
    cua_so: 'tuan', be_mat: 'xem_lai', muc: 1, ngay_ra_soat: RA_SOAT,
  },
] as const;

/**
 * VIỆC LUÂN PHIÊN — một việc khác nhau mỗi tuần.
 *
 * Ô này tồn tại để ĐO SỞ THÍCH: việc nào bị bỏ nhiều nhất là dữ liệu A1. Nó cố ý
 * KHÔNG phải "việc khó hơn" — trả cùng một chặng như bốn việc lõi.
 *
 * Năm loại, xoay vòng trong 8 tuần (lặp lại là chấp nhận được: mùa 0.0 chỉ có 5
 * bề mặt hợp lệ, bịa loại thứ sáu cho đủ 8 là bịa việc). Không loại nào đòi quá
 * 2 ngày có phiên trong tuần ⟹ trần phiên trên TOÀN roster ≤ 3/tuần (luật N4).
 */
export const VIEC_LUAN_PHIEN: readonly NhiemVu[] = [
  {
    nv_id: 'phu_ba_nhom',
    ten: 'Ghé cả 3 nhóm câu hỏi',
    cua_so: 'tuan', be_mat: 'du_bao', muc: 3, ngay_ra_soat: RA_SOAT,
  },
  {
    nv_id: 'doi_dien_mao',
    ten: 'Đổi diện mạo một lần',
    cua_so: 'tuan', be_mat: 'dien_mao', muc: 1, ngay_ra_soat: RA_SOAT,
  },
  {
    nv_id: 'hai_ngay_dau',
    ten: 'Vào Đấu trường ở 2 ngày khác nhau',
    cua_so: 'tuan', be_mat: 'dau_tu_do', muc: 2, ngay_ra_soat: RA_SOAT,
  },
  {
    nv_id: 'doc_lai_hai',
    ten: 'Mở lại 2 câu hỏi đã chốt',
    cua_so: 'tuan', be_mat: 'xem_lai', muc: 2, ngay_ra_soat: RA_SOAT,
  },
  {
    nv_id: 'co_mat_sau',
    ten: 'Điểm danh 6 ngày trong tuần',
    cua_so: 'tuan', be_mat: 'diem_danh', muc: 6, ngay_ra_soat: RA_SOAT,
  },
] as const;

export const NHIEM_VU_TAT_CA: readonly NhiemVu[] = [...VIEC_LOI, ...VIEC_LUAN_PHIEN];

/**
 * MÙA 0.0 — lịch và trần.
 *
 * `SO_TUAN = 8` lệch `ECONOMY.SEASON_LENGTH_MONTHS = 3` của A4. Đây là THAM SỐ
 * KINH TẾ nên nó là câu hỏi cho founder (A8.2), không phải quyết định của agent.
 * Lý do đề xuất 8: D16 hẹn "đo lại bằng dữ liệu người thật sau 4–6 tuần beta",
 * 8 tuần phủ đúng cái hẹn đó rồi mới đóng mùa; còn 3 tháng nghĩa là một cán cân
 * sai NẰM NGUYÊN 90 ngày trước khi được sửa.
 *
 * `NGAY_BAT_DAU` là mốc lịch, không phải đường tắt: tuần suy từ nó ở SERVER
 * (C4 — client không gửi tuần, không tự tính cửa sổ).
 */
export const MUA_0_0 = {
  SEASON_ID: 'beta-0.0',
  NGAY_BAT_DAU: '2026-07-27',
  /*
   * 8 → 28 (founder 11/10: *"Kéo dài 4 tháng đi"* — mùa 8 tuần đã HẾT từ 21/09, Hub hiện "CHƯA MỞ" trên prod). Giữ ngày bắt đầu và
   * season_id ⇒ ai đã có chặng giữ nguyên tiến độ; 28 tuần ⇒ chơi được thêm ~4 tháng tính từ 12/10 (mùa đóng CN 07/02/2027).
   * Trần Q mùa KHÔNG đổi: một việc = một chặng, trần `SO_CHANG` 30 × `Q_MOI_CHANG` 60 = 1.800 Q như cũ (tuần 9–11 đã trôi, không bù).
   */
  SO_TUAN: 28,
  SO_CHANG: 30,
  /** = số phần tử roster mỗi tuần (4 lõi + 1 luân phiên), KHÔNG phải một luật rời. */
  VIEC_MOI_TUAN: VIEC_LOI.length + 1,
  Q_MOI_CHANG: 60,
} as const;

/**
 * Vòi Q thứ hai (check-in 10 Q/ngày = 560 Q/mùa) của
 * `design_battle_pass_0_0.md §7.1` — CỐ Ý TẮT ở lát này.
 *
 * Hai lý do, cả hai là số:
 *  1. Trần Q của mùa chỉ suy ra được từ LỊCH khi số vòi đếm được và mỗi vòi có
 *     trần riêng. Một vòi ⟹ trần kiểm được bằng MỘT câu SQL.
 *  2. D36 vừa thêm một sink LẶP LẠI (avatar nền tiêu hao) nhưng giá bản sao CHƯA
 *     CHỐT (`GIA_BAN_SAO_THEM = null` trong `config/avatar.ts`). Mở thêm vòi phát
 *     trước khi biết giá sink là cân một cái cân còn thiếu quả cân.
 * Bật = đổi số này thành 10 rồi chạy lại `economy_sim` (nợ D16) — A8.2.
 */
export const Q_CHECKIN_MOI_NGAY = 0;

/** Một mốc lộ trình. `mon_id === null` ⟹ chỗ CHỜ ART, không nhận được. */
export interface MocLoTrinh {
  readonly chang_no: number;
  readonly q: number;
  readonly mon_id: string | null;
  /** Nhãn phần thưởng cosmetic — hiện cả khi chưa có art (mọi mốc phải thấy trước). */
  readonly nhan?: string;
  /** Độc bản mùa 0.0 — không bao giờ phát lại. */
  readonly doc_ban?: true;
}

/**
 * BẢNG 30 CHẶNG.
 *
 * 20 chặng trả Q × 60 = 1.200 Q (khớp `design_battle_pass_0_0.md §4`, có test so
 * tổng). 10 chặng trả cosmetic.
 *
 * ⚠ CHỈ MỘT trong 10 chặng cosmetic GIAO ĐƯỢC HÔM NAY (`kh_moc_neo`, chặng 8).
 * Chín chặng còn lại để `mon_id: null` — CHỜ ART, và tầng nhận TỪ CHỐI chúng
 * (fail-closed) thay vì trao một mã không có trong catalog. Vì sao không bịa mã:
 * `cosmetic_items` là khoá ngoại, còn art + `config/avatar*.ts` thuộc luồng khác
 * trong đợt này; trao một mã chưa có art = phần thưởng KHÔNG HIỆN RA, tệ hơn một
 * ô ghi rõ "chờ art". Mọi mốc vẫn NHÌN THẤY TRƯỚC khi đạt — đó là yêu cầu, chứ
 * yêu cầu không phải là "mọi mốc nhận được ngay hôm nay".
 *
 * Vì sao chỉ MỘT khung được phát (không phải cả ba): ba khung là 750 Q sink của
 * quầy Phong cách. Phát hết ba thì catalog Q còn 600 (avatar nền) + 700 (2 hệ) =
 * 1.300 so với 1.200 Q phát ⟹ tỷ lệ 1,08 — THẤP hơn luật catalog ≥ 1,2 × Q phát
 * (`design_nhiem_vu §10.4`). Phát một khung ⟹ catalog 1.800 / 1.200 = 1,50 ✓.
 */
export const CHANG_LO_TRINH: readonly MocLoTrinh[] = [
  { chang_no: 1, q: 60, mon_id: null },
  { chang_no: 2, q: 0, mon_id: null, nhan: 'Nhãn dán #1' },
  { chang_no: 3, q: 60, mon_id: null },
  { chang_no: 4, q: 60, mon_id: null },
  { chang_no: 5, q: 0, mon_id: null, nhan: 'Nhãn dán #2' },
  { chang_no: 6, q: 60, mon_id: null },
  { chang_no: 7, q: 60, mon_id: null },
  { chang_no: 8, q: 0, mon_id: 'kh_moc_neo', nhan: 'Khung móc neo' },
  { chang_no: 9, q: 60, mon_id: null },
  { chang_no: 10, q: 0, mon_id: null, nhan: 'Nhãn dán #3', doc_ban: true },
  { chang_no: 11, q: 60, mon_id: null },
  { chang_no: 12, q: 60, mon_id: null },
  { chang_no: 13, q: 0, mon_id: null, nhan: 'Nhãn dán #4' },
  { chang_no: 14, q: 60, mon_id: null },
  { chang_no: 15, q: 0, mon_id: null, nhan: 'Khung viền #2' },
  { chang_no: 16, q: 60, mon_id: null },
  { chang_no: 17, q: 60, mon_id: null },
  { chang_no: 18, q: 0, mon_id: null, nhan: 'Nhãn dán #5' },
  { chang_no: 19, q: 60, mon_id: null },
  { chang_no: 20, q: 0, mon_id: null, nhan: 'Nhãn dán #6' },
  { chang_no: 21, q: 60, mon_id: null },
  { chang_no: 22, q: 60, mon_id: null },
  { chang_no: 23, q: 0, mon_id: null, nhan: 'Nhãn dán #7' },
  { chang_no: 24, q: 60, mon_id: null },
  { chang_no: 25, q: 0, mon_id: null, nhan: 'Khung "BẢN DỰNG 0.0"', doc_ban: true },
  { chang_no: 26, q: 60, mon_id: null },
  { chang_no: 27, q: 60, mon_id: null },
  { chang_no: 28, q: 60, mon_id: null },
  { chang_no: 29, q: 60, mon_id: null },
  { chang_no: 30, q: 60, mon_id: null, nhan: 'Avatar "KỸ THUẬT VIÊN 0.0"', doc_ban: true },
] as const;

/**
 * Trần Q TUYỆT ĐỐI của một người trong mùa. Dùng cho assertion + audit SQL, không
 * dùng để hiển thị.
 *
 * Đây là tính chất mà guardrail D16 §6 cần: guardrail chỉ vặn được thứ ĐO ĐƯỢC,
 * và số này không phụ thuộc kỹ năng, thời lượng hay cỡ bàn — chỉ phụ thuộc lịch.
 */
export function tranQMua(): number {
  const tuChang = CHANG_LO_TRINH.reduce((s, c) => s + c.q, 0);
  return tuChang + Q_CHECKIN_MOI_NGAY * 7 * MUA_0_0.SO_TUAN;
}

/**
 * CHẶNG từ số việc đã xong — DẪN XUẤT, cùng khuôn `levelTuXp()`. Không bảng nào
 * lưu chặng, không cột nào cộng dồn, không gì tiêu được chặng.
 */
export function changTuViec(soViecDaXong: number): number {
  return Math.max(0, Math.min(MUA_0_0.SO_CHANG, Math.trunc(soViecDaXong)));
}

/** Roster của một tuần: 4 việc lõi + 1 việc luân phiên (xoay theo số tuần). */
export function rosterTuan(tuan: number): readonly NhiemVu[] {
  const lp = VIEC_LUAN_PHIEN[(tuan - 1) % VIEC_LUAN_PHIEN.length]!;
  return [...VIEC_LOI, lp];
}
