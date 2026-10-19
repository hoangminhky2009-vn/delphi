/**
 * MẮT XÍCH NÀO LÀ CÔNG CỦA LÁ — bộ nhận diện cho danh sách VÌ SAO.
 *
 * Founder 08/08 (lần 2): khối "LÁ BÀI TRẢ CÔNG" riêng bị chê *"gượng gạo"* —
 * *"làm 1 dòng lãi/lỗ ở phần giải thích có màu khác biệt và nổi bật như lá
 * đòn bẩy cũ"*. Tức phản hồi cho lá KHÔNG đứng thành mục riêng nữa mà nằm
 * NGAY TRONG dây chuyền: mắt xích nào thuộc về một lá chiến thuật thì dòng
 * đó ăn style nổi bật (kiểu dòng "Đòn Bẩy 2× — khuếch đại" mà founder khen).
 *
 * File này chỉ trả lời MỘT câu: mắt xích này của lá nào (hay của thị
 * trường/hệ thống — null). THUẦN, không đổi phép tính nào của engine.
 */
import type { MatXichDTO } from '@/api/holdem';

/**
 * Trả id lá (hoặc CẶP lá cho mắt xích đôi), `null` = mắt xích thị trường/
 * hệ thống (tài sản, dư âm, chen chúc, khẩu vị, phí, khoá, bẻ kèo…).
 */
export function laCuaMatXich(
  m: MatXichDTO,
): string | readonly [string, string] | null {
  switch (m.kind) {
    case 'nhan': return m.id;
    case 'ct_su_kien': return m.id;
    case 'day_chuyen': return 'luot_song';
    case 'hoan_truot': return 'khop_nhanh';
    case 'canh_nhip': return m.id;
    case 'da_dang': return 'da_dang_hoa';
    case 'phong_thu': return m.id;
    case 'di_nguoc': return 'di_nguoc';
    case 'doi_tac': return m.id;
    case 'chan_lo_san': return 'chan_lo';
    case 'short': return 'phong_ho';
    // v55 (D409) — chốt lời trong ô là công của lá Lướt Sóng (mới); lửa đà và CHỐT NON không thuộc lá nào (trait/ghế).
    case 'song': return 'luot_song';
    // v49 (D342) — giá của sổ khống là công của lá Bán Khống (quyền mở khống).
    case 'khong_gia': return 'ban_khong';
    case 'dac_quyen': return m.id;
    case 'cong_huong': return m.cap;
    case 'xung_dot': return m.cap;
    case 'triet_bien_tang': return m.cap;
    default: return null;
  }
}
