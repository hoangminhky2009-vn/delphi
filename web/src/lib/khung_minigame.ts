/**
 * KHUNG MINIGAME (khoá v57 — cờ trận `dong_ho_minigame`) — chữ của lõi và trait ĐỔI NGHĨA trong khung (D474, founder 04/10: *"Sửa lại chú thích lõi
 * và trait"* · *"Viết chú thích mới"*). Chữ ở client, server chỉ trả id + số (D26). Trận KHÔNG mang cờ đọc chữ cũ, byte-hệt — prod giữ nguyên.
 *
 * Lõi: CHÉP từ demo đã chốt `docs/ui-ux/demo/minigame-bat-day.html` (hằng `LA` — icon · tên · một câu · dòng "đo"), A11.25 — demo thắng.
 * Trait: chỉ những lá mà CODE khung đã đổi nghĩa (D473: KHẨU VỊ ĐA DẠNG). Lá chưa đổi trong engine giữ câu cũ — câu hứa trên màn phải trỏ tới
 * đường code đang chạy; Kiên Nhẫn / Nóng Vội mới (D471) vào đây cùng bước 4 #8, khi màn thật có chúng.
 */
import { createContext, useContext } from 'react';
import type { ChienThuatId } from '@config/holdem';

/** Trận đang vẽ có mang cờ khung minigame không — `AlphaDraftMatch` cấp; mọi thẻ trait / quầy lõi đọc. */
export const KhungMinigameCtx = createContext(false);
export const useKhungMinigame = (): boolean => useContext(KhungMinigameCtx);

export interface ChuLoiMinigame { icon: string; ten: string; mt: string; day: string }

/** Năm lõi của minigame — nguyên văn demo (`LA`). */
export const LOI_MINIGAME_CHU: Readonly<Partial<Record<ChienThuatId, ChuLoiMinigame>>> = {
  bat_day:   { icon: '🩸', ten: 'Bắt Đáy',   mt: 'Giá rơi quá đà rồi sẽ bật lại.', day: 'đo: cách vào lệnh' },
  mua_duoi:  { icon: '🚀', ten: 'Mua Đuổi',  mt: 'Giá đang lên thì sẽ lên tiếp.', day: 'đo: cách ra lệnh' },
  luot_song: { icon: '🌊', ten: 'Lướt Sóng', mt: 'Ăn từng con sóng nhỏ, vào ra liên tục.', day: 'đo: mua thông tin' },
  don_bay:   { icon: '🏋️', ten: 'Đòn Bẩy',  mt: 'Vay thêm để đặt cược lớn hơn vốn.', day: 'đo: phá quỹ dự phòng' },
  ban_khong: { icon: '📉', ten: 'Bán Khống', mt: 'Mượn để bán trước, mua lại khi giá rơi.', day: 'đo: ôm lỗ vì tin mình đúng' },
};

/**
 * D530 — khoá v60 (cờ trận `loi_chi_trong_man`): LÕI CHỈ TÁC ĐỘNG TRONG MÀN (founder 06/10 chọn *"Chỉ tác động trong màn"*). MỘT nguồn cho tờ (!)
 * của quầy lõi, Bách khoa (MÀN LÕI) và Hướng dẫn — bản thứ hai của cùng câu sẽ trôi (A11.5). Không chữ số (tầng trên bàn của Bách khoa đọc chung).
 */
export const LOI_CHI_TRONG_MAN_CHU = 'Lõi chỉ tác động trong MÀN LÕI. Vòng không có màn, lõi nghỉ — khoản đi đúng phần trăm thị trường.';
/** Hàng nút của từng lõi trong màn — tả, không khuyên (A10). Lướt Sóng không có nút: màn của nó chỉ để xem. */
export const LOI_NUT_MAN: Readonly<Partial<Record<ChienThuatId, string>>> = {
  // D589 — khoá v70: VÀO chia ba phần (Bắt Đáy phần sau to dần · Mua Đuổi phần sau nhỏ dần); Mua Đuổi đủ ba phần thì ô VÀO thành ×2, CHỐT nửa rồi hết.
  bat_day: 'gom ba phần, phần sau to hơn phần trước · thoát; thấy đường giá trị và nhãn quá bán',
  mua_duoi: 'nhồi ba phần, phần sau nhỏ hơn phần trước; đủ ba phần thì vay thêm gấp đôi được · chốt lần đầu một nửa, lần hai hết — đuổi càng muộn (càng nhiều nến xanh liền nhau) trượt càng nặng',
  don_bay: 'vào theo mức nhân · tăng · nạp thêm · chốt — lãi lỗ nhân đúng mức đã chọn, có lãi vay, chạm ngưỡng thì bị gọi ký quỹ rồi thanh lý',
  ban_khong: 'như Đòn Bẩy nhưng chiều bán: bán theo mức nhân · tăng · nạp · mua lại — ăn phần giá rơi, giá lên thì lỗ',
  luot_song: 'chỉ xem — khung nến nhanh, không có nút; màn không cộng trừ gì',
};
