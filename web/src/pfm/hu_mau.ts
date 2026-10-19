/**
 * PFM — MẪU HŨ + BỘ ICON (nội dung, sống ở CLIENT theo luật tự điển D26).
 *
 * ⚠⚠ HAI ĐƯỜNG TẠO HŨ, CẢ HAI ĐỀU HỢP LỆ — đây là chỗ hai chỉ thị của founder gặp nhau
 * và chúng KHÔNG cãi nhau:
 *   · P14/G6 (D134): *"đừng bắt user dựng từ số 0"* ⇒ mở bằng vài mẫu đã vẽ sẵn.
 *   · Founder 31/08: *"cho phép user tự tạo hũ (tự điền tên, chọn mức, icon…)"*
 *     và *"tuyệt đối không phải một bảng excel giản lược"*.
 * ⇒ Mẫu là ĐIỂM XUẤT PHÁT, không phải cái lồng: nút "tự tạo" luôn đứng cạnh, và mọi
 * thứ của một hũ đã tạo (kể cả hũ sinh từ mẫu) đều sửa được sau.
 *
 * ⚠⚠ RANH GIỚI DỮ LIỆU PHẢI GIỮ KHI USER TỰ ĐIỀN TÊN (P2 🔒):
 *   TÊN hũ là CHỮ TỰ DO ⇒ **ở lại máy vĩnh viễn**, chỉ đi vào két đã khoá.
 *   NHÃN ngữ nghĩa (`y_loai` · `y_han` · `y_uu_tien` · `y_thiet_yeu`) sinh từ CÚ CHỌN
 *   MENU ⇒ được phép lên server (K14).
 * Nghĩa là: user gõ "Đám cưới con Hường" thì server không bao giờ thấy chuỗi đó — nó
 * chỉ thấy `su_kien · han_vua · uu_tien_cao`. Không NLP, không đoán, và đúng 100% vì
 * chính user chọn.
 *
 * ⚠ ICON: chỉ dùng tên lưới ĐÃ CÓ trong `PixelIcon` — nợ art là nợ đắt nhất repo
 * (D68). Danh sách dưới đã đối chiếu với bộ lưới hiện có; thêm icon mới là một quyết
 * định art, phải qua cửa sổ UI-UX.
 */
import type { MaLoaiHu, MaHan, MaUuTien } from './hu.js';
import type { HoSo } from './ho_so.js';
import type { PixelIconName } from '../components/ui/PixelIcon';

/**
 * Icon dùng được cho hũ — TÊN LƯỚI CÓ THẬT trong `components/ui/PixelIcon`.
 *
 * ⚠⚠ `satisfies readonly PixelIconName[]` KHÔNG PHẢI TRANG TRÍ KIỂU — nó là cái
 * bẫy duy nhất bắt được họ lỗi này. Danh sách cũ khai `'book'`, một tên KHÔNG hề
 * tồn tại trong bộ lưới (19 lưới thường + 16 lưới rank, không có `book`), nên mẫu
 * "Thiết bị học tập" vẽ ra một ô RỖNG. Không lỗi, không cảnh báo, không test nào
 * đỏ — vì kiểu cũ chỉ là `string`.
 * ⇒ Danh sách tên tham chiếu sang một bộ khác thì phải để TRÌNH BIÊN DỊCH giữ mối
 * nối, đừng để một dòng chú thích hứa hộ. Chú thích trên đầu tệp này đã hứa đúng
 * điều ấy ("đã đối chiếu với bộ lưới hiện có") và vẫn sai.
 */
export const ICON_HU = [
  'vault', 'target', 'analyze', 'shield', 'shop', 'wallet', 'coin',
  'medal', 'flame', 'candle', 'chart', 'mail', 'hall', 'arena', 'lock',
] as const satisfies readonly PixelIconName[];
export type IconHu = (typeof ICON_HU)[number];

export interface MauHu {
  id: string;
  /** Tên GỢI Ý — user sửa thoải mái, và tên đã sửa không bao giờ rời máy. */
  tenGoiY: string;
  icon: IconHu;
  loai: MaLoaiHu;
  han: MaHan;
  uuTien: MaUuTien;
  thietYeu: boolean;
  /**
   * MỘT DÒNG VÌ-SAO-HỢP, bắt buộc (P14).
   * ⚠ MÔ TẢ, KHÔNG KÊ ĐƠN (A10 🔒): nói mẫu này THƯỜNG dùng cho việc gì, tuyệt đối
   * không nói user NÊN để dành bao nhiêu. Test quét từ-kê-đơn chạy trên đúng cột này.
   */
  viSao: string;
}

/**
 * MẪU MẶC ĐỊNH — cố ý NGẮN.
 *
 * ⚠ Menu nhỏ thắng menu mở với người mới (Iyengar–Lepper 2000, đã dẫn ở G6), nhưng
 * "nhỏ" ở đây KHÔNG có nghĩa là bịt đường: `tuTao()` luôn mở, và lớp chọn mẫu chỉ là
 * lối tắt cho ~80% trường hợp thường gặp. Danh mục này là PLAYTEST-TUNE.
 */
export const MAU_HU: readonly MauHu[] = [
  {
    id: 'du_phong', tenGoiY: 'Quỹ dự phòng', icon: 'shield',
    loai: 'du_phong', han: 'dai', uuTien: 'cao', thietYeu: true,
    viSao: 'Khoản để dành cho việc bất ngờ — thường là hũ người ta lập đầu tiên.',
  },
  {
    id: 'thiet_bi_hoc', tenGoiY: 'Thiết bị học tập', icon: 'analyze',
    loai: 'giao_duc', han: 'vua', uuTien: 'cao', thietYeu: false,
    viSao: 'Máy tính, sách vở, khoá học — mục tiêu có ngày kết thúc rõ ràng.',
  },
  {
    id: 'du_lich', tenGoiY: 'Chuyến đi', icon: 'target',
    loai: 'du_lich', han: 'ngan', uuTien: 'vua', thietYeu: false,
    viSao: 'Có mốc thời gian cụ thể — tiến độ nhìn thấy được từng tuần.',
  },
  {
    id: 'mua_sam', tenGoiY: 'Món muốn mua', icon: 'shop',
    loai: 'thiet_bi', han: 'ngan', uuTien: 'thap', thietYeu: false,
    viSao: 'Một món cụ thể đang nhắm — tách riêng để không lẫn vào chi hằng ngày.',
  },
  {
    id: 'tra_no', tenGoiY: 'Trả nợ', icon: 'lock',
    loai: 'tra_no', han: 'vua', uuTien: 'cao', thietYeu: true,
    viSao: 'Khoản đã vay đang trả dần — theo dõi riêng để thấy phần còn lại.',
  },
] as const;

/** Mẫu mặc định gợi ý khi chưa biết gì về user (hồ sơ trống). */
export const MAU_MAC_DINH = ['du_phong', 'thiet_bi_hoc', 'du_lich'] as const;

/**
 * CHỌN 2–4 MẪU HỢP VỚI HỒ SƠ (P14) — hàm THUẦN, tất định.
 *
 * ⚠ KHÔNG "thông minh" hơn mức này có chủ đích. Mọi cú lọc phức tạp hơn đều là app
 * đoán về user, mà đoán sai ở màn ĐẦU TIÊN thì mất luôn niềm tin cho cả phần sau.
 * Ở đây chỉ dùng thứ user đã TỰ KHAI ở bước hoàn cảnh (Context) — không suy diễn.
 *
 * ⚠ LUÔN trả về ít nhất 2 và nhiều nhất 4; và người gọi PHẢI hiện nút "tự tạo" cạnh
 * chúng — có bài test canh đúng điều đó ở tầng UI khi màn hũ được dựng.
 */
export function mauHopVoiHoSo(hoSo: HoSo = {}): MauHu[] {
  const theoId = (id: string) => MAU_HU.find((m) => m.id === id)!;
  const ra: MauHu[] = [];

  // Có nợ ⇒ hũ trả nợ lên đầu. Đây là thứ user tự khai, không phải app suy đoán.
  if (hoSo.coNo) ra.push(theoId('tra_no'));

  // Người phụ thuộc gia đình: mục tiêu học tập/món muốn mua sát thực tế hơn quỹ dự
  // phòng dài hạn — nhưng dự phòng vẫn có mặt, chỉ không đứng đầu.
  if (hoSo.tuLap === 'phu_thuoc') {
    ra.push(theoId('thiet_bi_hoc'), theoId('mua_sam'), theoId('du_phong'));
  } else {
    ra.push(theoId('du_phong'), theoId('thiet_bi_hoc'), theoId('du_lich'));
  }
  return ra.slice(0, 4);
}
