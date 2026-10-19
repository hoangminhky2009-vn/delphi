/**
 * ĐỒNG HỒ TRẬN — hàm THUẦN, không đọc đồng hồ hệ thống, không đụng DB.
 *
 * Chỉ đạo founder 27/07 (D38): cho hạn cho từng vòng và cho cả trận, thay vì vô hạn.
 * Số cụ thể nằm ở `DONG_HO` trong config/holdem.ts kèm lý do chọn từng con số.
 *
 * ─── VÌ SAO `now` LÀ THAM SỐ, KHÔNG PHẢI `Date.now()` BÊN TRONG ──────────────
 * Ba lý do, và lý do thứ ba mới là lý do cứng:
 *  1. Test được mà không phải giả lập đồng hồ toàn cục.
 *  2. MỘT mốc thời gian cho cả một request. Gọi `Date.now()` ở ba chỗ trong cùng
 *     một request là ba mốc lệch nhau vài chục ms — đủ để "còn 0,01s" và "đã hết
 *     giờ" cùng đúng, và bug đó không tái lập được.
 *  3. Engine của trò này TẤT ĐỊNH tuyệt đối: trận dựng lại từ `(seed, action_log)`.
 *     Một lời gọi `Date.now()` lọt vào đường tính toán là replay ra kết quả khác
 *     mỗi lần chạy — im lặng, không lỗi. Đồng hồ chỉ được phép quyết ĐƯỢC PHÉP HÀNH
 *     ĐỘNG HAY KHÔNG, tuyệt đối không được vào phép tính tiền hay giá.
 *
 * ─── AI CƯỠNG CHẾ ───────────────────────────────────────────────────────────
 * SERVER, và chỉ server (C4). Client dùng mấy hàm này CHỈ để vẽ vòng đếm ngược cho
 * đẹp; nếu client nói "còn 3 giây" mà server nói hết thì server thắng. Đổi giờ máy
 * không mua được một giây nào.
 */
import { DONG_HO, DONG_HO_MINIGAME, giayChonBai } from '../../config/holdem.js';
import { laMocTrait } from './trait.js';

/** Kết quả soi đồng hồ của một vòng đang mở. */
/** v55 (D409) — không pha QUYẾT nào ngắn hơn bấy nhiêu giây, dù trait trừ bao nhiêu. */
export const DONG_HO_TOI_THIEU_S = 10;

/**
 * D442 — giây cộng thêm ở vòng MỐC CHỢ TRAIT (`DONG_HO.CHON_TRAIT_THEM_S`): chỉ trận chạy luật có hệ trait (`trait_bat`)
 * và đúng vòng mở chợ (`laMocTrait` — cùng bảng mốc engine dùng). Cộng vào `themS` của `soiDongHo` ở MỌI chỗ soi hạn,
 * như `themGiayKyNgo`: màn hiện "còn 20 s" mà server đã chốt hộ là lớp lỗi tệ nhất của cụm đồng hồ (D53/D76).
 * D459 — trận mang cờ `dong_ho_minigame` (khung minigame, khoá v57) cộng `DONG_HO_MINIGAME.CHON_TRAIT_THEM_S` (20 s) thay vì 25 s.
 */
export function themGiayTrait(
  st: { trait_bat?: boolean; trait_kho_hep?: boolean; dong_ho_minigame?: boolean; nhip_xen_ke?: boolean; map: { o: readonly unknown[] } }, vong: number,
): number {
  if (st.trait_bat !== true || !laMocTrait(vong, st.map.o.length, st)) return 0;
  // D526 — nhịp xen kẽ: chợ là MỘT chặng thay màn ⇒ 45 s (`CHON_TRAIT_XEN_KE_S`).
  if (st.nhip_xen_ke === true) return DONG_HO_MINIGAME.CHON_TRAIT_XEN_KE_S;
  return st.dong_ho_minigame === true ? DONG_HO_MINIGAME.CHON_TRAIT_THEM_S : DONG_HO.CHON_TRAIT_THEM_S;
}

export interface TrangThaiDongHo {
  /** Giây còn lại của pha chọn bài (đã trừ ân hạn). ≤0 là đã hết. */
  con_lai_s: number;
  /** Tổng thời lượng pha này — client cần để vẽ vòng tròn đếm ngược. */
  tong_s: number;
  /** Đã quá hạn VÒNG (tính cả ân hạn) chưa. */
  qua_han_vong: boolean;
  /** Đã qua MỐC hết giờ (chưa tính ân hạn). Xem chú thích trong `soiDongHo`. */
  qua_moc_vong: boolean;
  /** Đã quá hạn TRẬN chưa — quá thì trận không tiếp được nữa. */
  qua_han_tran: boolean;
}

/** Số giây đã trôi giữa hai mốc, làm tròn XUỐNG, không bao giờ âm. */
function giayTroiQua(tu: Date, den: Date): number {
  return Math.max(0, Math.floor((den.getTime() - tu.getTime()) / 1000));
}

/**
 * Soi đồng hồ của vòng đang mở.
 *
 * `vongMoLuc` null (trận cũ trước migration 0018, hoặc trận đã xong) ⇒ coi như
 * KHÔNG có hạn. Đó là chủ ý: bịa một mốc cho trận cũ là bịa ra chuyện nó đã quá
 * hạn, và với `events` append-only (A3.3) thì kết luận sai đó không xoá lại được.
 */
export function soiDongHo(
  vongMoLuc: Date | null, vong: number, soO: number, now: Date,
  /**
   * v32 — THẺ GIỜ (đặc quyền KẺ VƯỢT SÓNG): cộng thêm giây cho vòng này.
   *
   * ⚠ Cộng vào `tong` chứ không trừ vào `troi`: `tong_s` là thứ client vẽ vòng
   * tròn đếm ngược, nên một đặc quyền cộng giờ mà không đội `tong_s` lên sẽ ra
   * cái đồng hồ chạy quá 100% rồi đứng — người chơi đọc thành "hết giờ rồi mà
   * vẫn bấm được", tức chính họ không biết mình đang có đặc quyền.
   *
   * ⚠ Người gọi PHẢI suy con số này từ `action_log` (tất định), không được đọc
   * trạng thái ngoài log — đồng hồ quyết định vòng có bị chốt hộ hay không, và
   * hai request cùng trận mà ra hai hạn khác nhau là mất lượt không tái lập được.
   */
  themS = 0,
  /**
   * v33 — nhịp giãn ở map ngắn (D90 M1). Đồng hồ phải hỏi CÙNG nhịp với shop:
   * vòng có quầy thẻ chiến thuật được +12s, và sau khi giãn thì vòng đó là vòng
   * khác. Lệch ⇒ người chơi được thêm giây ở vòng không có gì để chọn.
   */
  gianLa = false,
  /**
   * D457 — cổng `dongHoMinigame` (`st.dong_ho_minigame`): đặt lệnh 15 s + đọc kết quả 5 s thay vì 25 + 15. Mọi cửa soi hạn PHẢI
   * truyền cùng cờ này — màn hiện "còn 15 s" mà một cửa khác tính theo 40 s là lớp lỗi tệ nhất của cụm đồng hồ (D53/D76).
   */
  dongHoMinigame = false,
  /** D526 — cờ `nhipXenKe` (`st.nhip_xen_ke`): màn của vòng trước chỉ chiếm giờ khi lịch có màn; lõi theo `NHIP_XEN_KE`. Cùng luật mọi cửa. */
  xenKe = false,
  /** D561 — cờ `loiChonTruoc` (`st.loi_chon_truoc`): màn không còn pha chọn lá. Cùng luật mọi cửa. */
  loiChonTruoc = false,
): TrangThaiDongHo {
  // v55 (D409) — trait BÌNH TĨNH cộng, BÁO TRỄ trừ: `themS` có thể ÂM; sàn 10 s để không có vòng 0 giây.
  const tong = Math.max(DONG_HO_TOI_THIEU_S, giayChonBai(vong, soO, gianLa, dongHoMinigame, xenKe, loiChonTruoc) + themS);
  if (!vongMoLuc) {
    return { con_lai_s: tong, tong_s: tong, qua_han_vong: false, qua_moc_vong: false, qua_han_tran: false };
  }
  const troi = giayTroiQua(vongMoLuc, now);
  return {
    con_lai_s: Math.max(0, tong - troi),
    tong_s: tong,
    // Ân hạn CHỈ vào phép so "đã quá hạn chưa", KHÔNG vào `con_lai_s`. Nếu cộng vào
    // cả hai thì đồng hồ hiện thừa 8 giây và người chơi học được rằng số hiện ra là
    // số nói dối — thà cho họ thấy 0 rồi vẫn nhận nước đi.
    qua_han_vong: troi > tong + DONG_HO.AN_HAN_S,
    /*
     * ĐÃ QUA MỐC (không tính ân hạn) — cho cú TỰ NỘP của client (`tu_dong: true`).
     * Ân hạn 8s tồn tại để bảo vệ một QUYẾT ĐỊNH THẬT đến muộn vì mạng; một cú
     * client tự khai "đồng hồ tôi chạm 0" không cần ân hạn đó, và bắt nó chờ
     * thêm 10s là màn đứng im "HẾT GIỜ" mười giây mỗi vòng (founder 22/08:
     * *"đếm xong không lật bài tiếp theo"*). Server vẫn là bên quyết: chưa qua
     * mốc theo đồng hồ server ⇒ từ chối, client hẹn lại.
     */
    qua_moc_vong: troi >= tong,
    qua_han_tran: troi > DONG_HO.HAN_TRAN_PHUT * 60,
  };
}

/**
 * Trận này có còn tiếp được không, xét riêng mặt thời gian.
 *
 * Dùng ở CẢ hai chỗ và phải là CÙNG MỘT hàm: (a) khi người chơi nộp một vòng,
 * (b) khi tiến trình dọn dẹp quét bảng. Hai công thức rời nhau thì sẽ có ngày
 * người chơi thấy "trận còn sống" mà tiến trình dọn đã đóng nó — hoặc ngược lại,
 * một trận không ai đóng được mà cũng không ai chơi được.
 *
 * `mienGio` = vòng hiện tại đang miễn giờ (màn tập vòng 1–4, D53): màn đang
 * hứa "TẠM DỪNG ∞" thì hạn thường 45' là lời nói dối — dùng hạn dài
 * `HAN_TRAN_TAP_PHUT` thay vì bỏ hẳn hạn (bỏ hẳn thì trận bỏ dở ở vòng 1
 * không bao giờ được dọn). Caller quyết cờ này bằng `manTapMienGio` — CÙNG
 * cửa hỏi với payload đồng hồ, không có công thức thứ hai.
 */
export function tranHetHan(
  vongMoLuc: Date | null, now: Date, mienGio = false,
): boolean {
  if (!vongMoLuc) return false;
  const hanPhut = mienGio ? DONG_HO.HAN_TRAN_TAP_PHUT : DONG_HO.HAN_TRAN_PHUT;
  return giayTroiQua(vongMoLuc, now) > hanPhut * 60;
}

/**
 * Nước đi khi HẾT GIỜ = GIỮ NGUYÊN, và luôn mang cờ `tu_dong`.
 *
 * ⚠ CỜ NÀY CHẠM A1, KHÔNG PHẢI CHI TIẾT KỸ THUẬT. "Không kịp bấm" và "cố ý giữ vị
 * thế" ra CÙNG một nước đi nhưng là hai hành vi khác nhau hẳn về tâm lý. Gộp chúng
 * vào một dòng `events` là pha loãng đúng cột khẩu vị rủi ro — tín hiệu B2B đắt
 * nhất — bằng những lần người chơi chỉ đang bận. Và `events` append-only nên KHÔNG
 * tách lại được về sau (A3.3). Phải phân biệt từ dòng đầu tiên.
 */
export const NUOC_HET_GIO = { hanh_dong: 'giu' as const, tu_dong: true as const };
