/**
 * CHỮ CỦA LỖI LỆNH GIAO DỊCH — MỘT bảng cho mọi chỗ nói "lệnh này không chạy" (D342).
 *
 * ⚠⚠ VÌ SAO CÓ TỆP NÀY. Trận founder 16/09 20:52: bốn vòng lệnh khống bị server bác
 * (`qua_tran_khong`), hai vòng kéo chết luôn lệnh "RÚT btc HẾT" đi kèm — và màn không nói một
 * chữ nào. Server VẪN gửi lý do (`loi_von.lenh`) từ v10; web thì không có dòng nào đọc nó
 * (kiểu DTO còn không khai trường ấy). Nút KHỚP NGAY thì in mã thô "qua_tran_khong".
 * Ba chỗ cần cùng một câu cho cùng một mã: tấm VÌ SAO sau chốt, dòng báo trong shop, câu trả
 * lời của KHỚP NGAY. Mỗi chỗ tự gõ câu là ba bản sẽ trôi (D61).
 *
 * Luật chữ (D26 · A10): server trả MÃ, chữ ở đây; câu MÔ TẢ chuyện gì xảy ra — không kê đơn.
 * Số luật đọc từ config, không gõ tay.
 */
import { BAN_KHONG_LENH, MANDATE_TO_CHUC } from '@config/holdem';
import { THAM_SO } from '@config/trait';

const pc = (bp: number): string => `${Math.round(bp / 100)}%`;

export const CHU_LOI_LENH: Readonly<Record<string, string>> = {
  khong_du_tien: 'Tiền mặt không đủ cho chuỗi lệnh này.',
  khong_du_vi_the: 'Lệnh rút lớn hơn phần đang giữ ở mã đó.',
  ma_khong_ton_tai: 'Mã này không có trên bàn.',
  day_tai_san: 'Danh mục đã giữ đủ số mã tối đa cùng lúc.',
  lenh_khong_hop_le: 'Lệnh không hợp lệ.',
  qua_tran_khong: `Tổng ký quỹ khống vượt trần ${pc(BAN_KHONG_LENH.TRAN_BP)} tổng tài sản.`,
  can_la_ban_khong: 'Mở khống mới chỉ có khi đang cầm lá Bán Khống.',
  mandate_ma: `Vai Tổ Chức: một mã không vượt ${pc(MANDATE_TO_CHUC.TRAN_MA_BP)} NAV khi mua.`,
  mandate_khong: 'Vai Tổ Chức không mở được lệnh khống.',
  khong_cam_san:
    'Sàn Việt Nam chưa cho bán khống cổ phiếu cơ sở. Blue-chip thì khống được — nó có '
    + 'hợp đồng phái sinh.',
  moc_khong_hop_le: 'Mốc lệnh không khớp bước chip của lá đang cầm.',
  nav_tat: 'Trận này không có lệnh giao dịch.',
  khong_chon_bai_duoc: 'Tư thế hiện tại không cho đặt lệnh.',
  // v55 — trait ràng buộc lệnh (server: nav.ts `gong_cum` · `so_mong`, D425).
  gong_cum: `GÔNG CÙM: mỗi vòng bán ra tối đa ${pc(THAM_SO.GONG_CUM_TRAN_BAN_VONG_BP)} NAV — lệnh bán này vượt trần.`,
  so_mong: 'SỔ MỎNG: lệnh mua quá nhỏ, không đủ trả phí cố định mỗi lệnh.',
};

/**
 * Câu cho một mã lỗi lệnh. Mã lạ vẫn ra một câu thật (kèm mã để báo lỗi được) — thà lộ mã
 * còn hơn im lặng, vì im lặng chính là lỗi tệp này sinh ra để vá.
 */
export function chuLoiLenh(ma: string): string {
  return CHU_LOI_LENH[ma] ?? `Lệnh bị từ chối (mã: ${ma}).`;
}

/**
 * Lỗi mà client BIẾT CHẮC — chỉ phụ thuộc thứ server đã gửi (ví · vị thế · sổ khống · vai ·
 * cờ luật), nên nói TRƯỚC khi chốt được. Loại ra `day_tai_san` (trần số mã còn nới bởi đặc
 * quyền server cấp) và `can_la_ban_khong` / `moc_khong_hop_le` (lá vừa chọn chưa nộp thì server
 * cho, bản nháp chưa biết) — hai nhóm đó có thể là lỗi GIẢ trên bản nháp.
 */
export const LOI_LENH_BIET_CHAC: ReadonlySet<string> = new Set([
  'mandate_ma', 'mandate_khong', 'khong_cam_san',
  'qua_tran_khong', 'khong_du_tien', 'khong_du_vi_the',
  // v55 (D425) — server phát sẵn phần BÁN còn được và phí cố định của ghế (`rang_buoc`) ⇒ bản nháp biết chắc.
  'gong_cum', 'so_mong',
]);

/**
 * D446 — khi bản nháp chạy bằng ĐÚNG bộ tham số server áp (`ban.tuy_chon_lenh`: có trần số mã thật, mốc thêm của LỆNH
 * MỊN, cờ Bán Khống) thì ba lỗi "có thể giả" ở trên thành biết chắc — TRỪ vòng người chơi đang chọn một lá lõi (lá chỉ
 * vào tay lúc chốt, có thể nới trần số mã hay đổi bước chip): vòng ấy dùng tập cũ.
 */
export const LOI_LENH_BIET_CHAC_THEO_SERVER: ReadonlySet<string> = new Set([
  ...LOI_LENH_BIET_CHAC, 'day_tai_san', 'moc_khong_hop_le', 'can_la_ban_khong',
]);
