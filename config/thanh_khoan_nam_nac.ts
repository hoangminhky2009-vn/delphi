/**
 * ═══ THANH KHOẢN NĂM NẤC (D395, founder 24/09) — cổng `thanhKhoanNamNac`, balance-v54-ngare ═══
 *
 * Founder: *"phần hiện thanh khoản chúng ta phải cho nó co dãn theo thẻ sự kiện đang được lật nên là
 * cố gắng cân bằng"* — rồi chọn phương án "sửa luật + 5 nấc".
 *
 * ─── VÌ SAO ────────────────────────────────────────────────────────────────────────────────────
 * Thanh khoản ĐÃ động từ D1 (`THANH_KHOAN_DONG`, `nacHieuDung`), nhưng lệch với bộ lá mới (D390):
 *   · lá tên CẠN THANH KHOẢN (`hack_san`) KHÔNG làm mỏng sổ nào — lá hứa một điều, engine làm điều khác;
 *   · bảy tin hoảng loạn nay là MỘT lá thiên nga, mà chỉ ba loại (thiên nga gốc · chiến tranh · phá sản)
 *     làm mỏng sổ — cùng một lá, lúc co lúc không;
 *   · ba nấc kẹp cứng: BTC nằm sẵn ở đáy (mỏng) nên khủng hoảng nào cũng không mỏng thêm, VN30/USDT
 *     nằm sẵn ở trần nên tiền rẻ không dày thêm — thước của ba mã này gần như không nhúc nhích.
 * ⇒ Năm nấc: thêm CẠN dưới mỏng và RẤT DÀY trên dày. Nấc NỀN của sáu mã giữ nguyên ở ba nấc giữa,
 *   nên mã nào cũng còn chỗ co và chỗ giãn.
 *
 * ─── ĐỔI THÊM, CÓ ĐO ─────────────────────────────────────────────────────────────────────────────
 *   · QUÁ NÓNG (`bien_dong`) +1 thay vì −1 — xem `DICH_NAC_NAM.GIAI_DOAN` (gate D395 kéo cân bằng về).
 *
 * ─── GIỮ NGUYÊN (không lén đổi) ─────────────────────────────────────────────────────────────────
 *   · bong bóng +1 cho nhóm risk-on · lãi suất nền ±1 (`LAI_SUAT_NEN`).
 *   · TIN GIẢ không làm mỏng sổ (thanh khoản là hành vi thật của dòng tiền — `nacHieuDung`).
 *   · Phần bù/phí thanh khoản (`GIA_CUA_THANH_KHOAN_BP`) tính theo nấc NỀN — không đổi.
 *   · Ba nấc giữa có ĐÚNG độ sâu cũ (`DO_SAU_L`): mã không bị lá nào chạm thì trượt giá y hệt v53.
 *
 * ⭐ PLAYTEST-TUNE (A8.2/A11.8): độ sâu hai nấc mới + độ co của CẠN THANH KHOẢN là số agent ĐỀ XUẤT để đo,
 * founder chốt sau gate. Đổi số ⇒ chạy lại G1–G5 bàn 16 (`--co=thanhKhoanNamNac:0` để so với bản tắt).
 */
import {
  DO_SAU_L, doThamSo, SU_KIEN, THANH_KHOAN_DONG, TINH_CHAT_NEN,
  type GiaiDoanId, type SuKienId, type ThanhKhoan,
} from './holdem.js';

/** Nấc thanh khoản khi cổng năm nấc bật. Ba nấc giữa = ba nấc cũ (`ThanhKhoan`). */
export type NacThanhKhoan = 'can' | ThanhKhoan | 'rat_day';

/** Năm nấc MỎNG → DÀY; chỉ số của mảng là "nấc". */
export const NAC_NAM: readonly NacThanhKhoan[] = ['can', 'mong', 'vua', 'day', 'rat_day'];

/**
 * Độ sâu sổ lệnh L theo nấc (thang của `HE_SO_TAC_DONG_K`: Δgiá_bp = K × flow × 10000 / L).
 * Ba nấc giữa ĐỌC THẲNG `DO_SAU_L` — không chép số (D61). Rất dày nối tiếp cấp số của ba nấc cũ
 * (2.500 → 6.000 → 14.000 ≈ ×2,4 mỗi nấc ⇒ ≈ 32.000). CẠN 1.500 chứ không 1.000 theo cấp số: gate D395 đo
 * 1.000 phạt người giao dịch quá tay (ngân hàng 33,1% → 1.500 còn 32,4%, á quân 32,0%).
 */
export const DO_SAU_L_NAM: Readonly<Record<NacThanhKhoan, number>> = {
  can: doThamSo('TK_NAM_DO_SAU_CAN', 1500), // PLAYTEST-TUNE
  ...DO_SAU_L,
  rat_day: doThamSo('TK_NAM_DO_SAU_RAT_DAY', 32000), // PLAYTEST-TUNE
};

/**
 * Lá vừa lật dịch nấc bao nhiêu (âm = mỏng đi). Một lá một số, đọc được bằng mắt.
 * · CẠN THANH KHOẢN: lá mang đúng tên thanh khoản ⇒ co mạnh nhất (−2).
 * · Mọi tin `hoang_loan` −1 — suy từ `TINH_CHAT_NEN`, KHÔNG gõ danh sách: một lá thiên nga, một luật;
 *   tin hoảng loạn mới tự nhận luật này.
 */
const HOANG_LOAN: readonly SuKienId[] = SU_KIEN
  .filter((s) => TINH_CHAT_NEN[s.id] === 'hoang_loan').map((s) => s.id);

export const DICH_NAC_NAM = {
  /**
   * Pha dịch nấc. ⭐ QUÁ NÓNG làm DÀY sổ (+1), NGƯỢC nhánh cũ "biến động làm mỏng" của D1.
   * Nhánh cũ viết cho nghĩa cũ của lá (`bien_dong` = biến động mạnh); ở v54 `bien_dong` là mùa QUÁ NÓNG của
   * bánh xe (D389/D390) — đỉnh hưng phấn, tiền tràn vào, sổ lệnh sâu nhất; sổ chỉ cạn khi chu kỳ gãy (lá
   * hoảng loạn · cạn thanh khoản). Gate D395 12.000 trận: giữ −1 thì "gửi hết ngân hàng" thắng 37,0%, đổi
   * +1 thì 33,1% (v54 trước cổng: 34,0%) — chiều này là thứ kéo cân bằng về. Núm dò `TK_NAM_GD_BIEN_DONG`.
   */
  GIAI_DOAN: {
    bien_dong: doThamSo('TK_NAM_GD_BIEN_DONG', 1), // PLAYTEST-TUNE
  } as Readonly<Partial<Record<GiaiDoanId, number>>>,
  /** Tin dịch nấc cho MỌI mã. */
  SU_KIEN: {
    ...Object.fromEntries(HOANG_LOAN.map((id) => [id, doThamSo('TK_NAM_HOANG_LOAN', -1)])), // PLAYTEST-TUNE
    hack_san: doThamSo('TK_NAM_CAN_THANH_KHOAN', -2), // PLAYTEST-TUNE
  } as Readonly<Partial<Record<SuKienId, number>>>,
  /** Tin dịch nấc CHỈ cho nhóm risk-on — giữ nhánh cũ (`DAY_THEM_SU_KIEN` +1, `MA_RISK_ON`). */
  RISK_ON: Object.fromEntries(
    THANH_KHOAN_DONG.DAY_THEM_SU_KIEN.map((id) => [id, 1]),
  ) as Readonly<Partial<Record<SuKienId, number>>>,
  MA_RISK_ON: THANH_KHOAN_DONG.MA_RISK_ON,
} as const;

/** Tin này có làm co giãn thanh khoản không (dưới cổng năm nấc) — Bảng điện tử dùng để nói "giả định tin thật". */
export const suKienDichNacNam = (id: string): boolean =>
  (DICH_NAC_NAM.SU_KIEN[id as SuKienId] ?? 0) !== 0 || (DICH_NAC_NAM.RISK_ON[id as SuKienId] ?? 0) !== 0;
