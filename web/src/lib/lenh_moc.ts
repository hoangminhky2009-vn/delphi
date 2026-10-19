/**
 * GỘP LỆNH MỐC TRONG SHOP — luật "ý sau đè ý trước" (sửa bug founder báo 08/08).
 *
 * ⚠⚠ BUG THẬT: luật cũ chỉ thay mốc khi CÙNG MÃ + CÙNG CHIỀU. Cùng mã mà NGƯỢC
 * chiều thì cả hai cùng nằm trong hàng đợi — bấm MUA btc rồi đổi ý bấm BÁN btc
 * là lúc nộp engine chạy CẢ HAI (bán giải trước theo luật broker 01/08, mua
 * chạy sau), ra một kết quả không khớp Ý ĐỊNH NÀO và trả trượt giá hai lần.
 * Founder gọi đúng tên: *"chức năng mua/bán tài sản đang bị lỗi xung đột"*.
 *
 * ─── LUẬT MỚI: xung đột TRONG CÙNG MỘT VẾ thì lệnh sau THAY lệnh trước ────────
 *   mua        ↔ ban          (vế LONG: mua và bán cùng mã là hai ý ngược nhau)
 *   khong      ↔ dong_khong   (vế SHORT: mở và đóng cùng mã cũng vậy)
 *
 * ⚠ HAI CẶP KIA KHÔNG PHẢI XUNG ĐỘT — đừng "sửa cho triệt để" mà giết chúng:
 *   ban        + khong        = ĐẢO LONG→SHORT trong một vòng (thoát rồi đánh xuống)
 *   dong_khong + mua          = ĐẢO SHORT→LONG (đóng khống rồi vào hàng)
 * Hai combo này là nước đi có thật của nghề; luật gộp mà nuốt chúng thì người
 * chơi mất khả năng đảo chiều trong một vòng — sửa một bug bằng cách trồng một
 * bug khác.
 *
 * ⚠ Ở `lib/` chứ không nằm trong component: đây là LUẬT CHƠI phía client, không
 * phải trình bày — Codex (UI-UX) không đụng vùng này (04 §7), và hàm thuần thì
 * test thẳng được, không phải dựng cả màn trận.
 */

export interface LenhMocNhap {
  ma: string;
  chieu: 'mua' | 'ban' | 'khong' | 'dong_khong';
  moc_bp: number;
}

/** Chiều NGƯỢC trong cùng một vế — xem bảng ở đầu file. */
const NGUOC: Record<LenhMocNhap['chieu'], LenhMocNhap['chieu']> = {
  mua: 'ban', ban: 'mua', khong: 'dong_khong', dong_khong: 'khong',
};

/** Trần lệnh mỗi cú nộp — khớp đúng tầng nhận của server (D67: 18 tag một mã). */
export const TRAN_LENH = 12;

export function themLenhMoc(
  ds: readonly LenhMocNhap[], l: LenhMocNhap,
): LenhMocNhap[] {
  return [
    ...ds.filter((x) =>
      !(x.ma === l.ma && (x.chieu === l.chieu || x.chieu === NGUOC[l.chieu]))),
    l,
  ].slice(-TRAN_LENH);
}

/** Đặc quyền lá mà một lệnh mốc CẦN để server chịu khớp. */
export interface DacQuyenCam {
  /** Đang CẦM THẬT lá Chia Lệnh (mốc mịn 5%). */
  chiaLenh: boolean;
  /** Đang CẦM THẬT lá Bán Khống (server cấp cờ `co_ban_khong`). */
  banKhong: boolean;
  /** Bước mốc THÔ của ghế không Chia Lệnh (catalog cấp, thường 2500). */
  buocThoBp: number;
}

/**
 * §4.5c (founder 08/08) — các lệnh trong hàng đợi CẦN lá chưa nộp.
 *
 * Vì sao tồn tại: server cho lá chọn CÙNG VÒNG hiệu lực ngay trong cú NỘP
 * (mua lá áp trước khi giải lệnh — có test API khoá), nên client được phép
 * bày nấc mịn/hàng khống ngay khi người chơi CHỌN lá. Nhưng nút KHỚP NGAY
 * chạy TRƯỚC cú nộp — server lúc đó chưa biết lá — nên lệnh phụ thuộc lá
 * vừa-chọn-chưa-nộp mà đem khớp ngay là ăn 409 chắc chắn. Hàm này là một
 * LUẬT, đặt ở lib để test thẳng và để hai chỗ dùng (nhốt nút + lọc khi bỏ
 * chọn lá) không tự chế hai bản sao lệch nhau (D61).
 *
 * ⚠ `dong_khong` KHÔNG cần lá (v17: "ĐÓNG thì luôn được — không ai bị giam
 * trong vị thế vì lỡ bán lá") — đừng "siết cho chắc" mà giam người ta.
 */
export function lenhCanLaChuaCam(
  ds: readonly LenhMocNhap[], cam: DacQuyenCam,
): LenhMocNhap[] {
  return ds.filter((l) =>
    (l.chieu === 'khong' && !cam.banKhong)
    || (!cam.chiaLenh && l.moc_bp !== 10000 && l.moc_bp % cam.buocThoBp !== 0));
}
