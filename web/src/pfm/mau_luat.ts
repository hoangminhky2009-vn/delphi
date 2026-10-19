/**
 * PFM — MẪU LUẬT NẾU-THÌ: ba lối tắt để đặt luật đầu tiên, một mẫu cho mỗi điều kiện.
 *
 * ⚠⚠ CÙNG KHUÔN `hu_mau.ts` VÀ CÙNG MỘT RANH: mẫu là **lối tắt**, không phải đường duy
 * nhất — `taoLuatMoi` luôn mở cho người tự viết. Menu nhỏ thắng menu mở với người mới
 * (Iyengar–Lepper, dẫn ở G6), nhưng "nhỏ" không được thành "bịt".
 *
 * ⚠⚠⚠ `loiNhacGoiY` LÀ APP ĐANG NÓI, NÊN NÓ CHỊU A10 🔒. Đây là chỗ dễ trượt nhất của cả
 * PFM: lời nhắc CUỐI CÙNG là của người dùng (họ tự viết, tự sửa, và `loiNhac` được ghi rõ
 * là *"không bao giờ app tự sáng tác"* — P3 🔒), nhưng cái **điền sẵn** thì do ta viết.
 * Một gợi ý kiểu *"Đừng mua thêm gì hôm nay"* là app kê đơn, rồi núp sau chữ ký của người
 * dùng khi họ bấm Lưu mà không sửa. ⇒ Gợi ý chỉ được **mô tả hoàn cảnh** hoặc **đặt câu
 * hỏi**; có bài quét `TU_KE_DON` chạy trên đúng cột này.
 */
import { DIEU_KIEN, canNguong, type MaDieuKien } from './luat.js';

export interface MauLuat {
  id: string;
  dieuKien: MaDieuKien;
  /** Tên ngắn trên thẻ chọn mẫu. */
  ten: string;
  /**
   * MỘT DÒNG VÌ-SAO-HỢP (P14) — nói mẫu này THƯỜNG hợp với hoàn cảnh nào.
   * ⚠ MÔ TẢ, KHÔNG KÊ ĐƠN (A10 🔒). Bài quét từ-kê-đơn chạy trên cột này.
   */
  viSao: string;
  /**
   * Điền sẵn vào ô lời nhắc; user sửa thoải mái trước khi lưu.
   * ⚠ Cũng chịu A10 — xem khối đầu tệp. Đây là app đang nói, không phải user.
   */
  loiNhacGoiY: string;
}

/**
 * BA MẪU, MỘT CHO MỖI ĐIỀU KIỆN — và con số ba không phải lựa chọn thẩm mỹ: `DIEU_KIEN`
 * là một TẬP ĐÓNG (cố ý, để không có NLP tự do nào lọt vào), nên phủ kín nó là phủ kín
 * mọi luật đặt được. Có bài canh đúng điều đó: thêm một điều kiện mà quên mẫu ⇒ đỏ.
 */
export const MAU_LUAT: readonly MauLuat[] = [
  {
    id: 'ngay_dat',
    dieuKien: 'ngay_chi_lon',
    ten: 'Ngày tiêu đậm',
    viSao: 'Hôm nào tiêu đậm hơn hẳn thường lệ thì mẫu này lên tiếng ngay hôm đó.',
    loiNhacGoiY: 'Hôm nay tiêu đậm hơn thường lệ. Khoản nào đáng giá nhất trong đó?',
  },
  {
    id: 'khoan_to',
    dieuKien: 'khoan_vuot_muc',
    ten: 'Khoản lớn',
    viSao: 'Một khoản đơn lẻ vượt mức bạn tự đặt — mẫu này bắt đúng lúc vừa ghi xong.',
    loiNhacGoiY: 'Khoản này vượt mức mình tự đặt. Mình đang mua nó vì điều gì?',
  },
  {
    id: 'tien_moi_ve',
    dieuKien: 'tien_vua_ve',
    ten: 'Tiền vừa về',
    viSao: 'Vài ngày sau khi tiền vào là quãng chi mạnh nhất với phần lớn người ghi sổ.',
    loiNhacGoiY: 'Tiền vừa về. Lần này mình muốn nó đi tới đâu?',
  },
] as const;

/** Tra một mẫu theo id. `null` khi không có — id mẫu đến từ dữ liệu cũ nên có thể lạc. */
export function mauTheoId(id: string | null | undefined): MauLuat | null {
  return MAU_LUAT.find((m) => m.id === id) ?? null;
}

/**
 * ⚠ `canNguong` ĐỌC TỪ `luat.ts`, không tự suy lại. Cùng một câu hỏi (*"điều kiện này có
 * cần ngưỡng không"*) mà trả lời ở hai chỗ thì hai chỗ sẽ trôi, và kiểu trôi ở đây rất
 * êm: màn hình không hỏi ngưỡng, `taoLuatMoi` ném, người dùng thấy "có lỗi" ở một nút
 * trông chẳng liên quan.
 */
export function mauCanNguong(m: MauLuat): boolean {
  return canNguong(m.dieuKien);
}

/**
 * ⚠⚠ CỐ Ý KHÔNG CÓ NGƯỠNG GỢI Ý, và đây là một quyết định chứ không phải thiếu sót.
 *
 * `khoan_vuot_muc` cần một con số, và điền sẵn một con số "hợp lý" là **thả neo** đúng
 * nghĩa anchoring: người dùng sẽ dịch quanh nó thay vì nghĩ từ đầu, nên cái ta đo về sau
 * hoá ra là **phản ứng với con số của ta**, không phải mức của họ. Nó cũng là một phát
 * biểu ngầm về việc bao nhiêu thì "lớn" — tức app đang định nghĩa hộ, đúng thứ A10 cấm.
 * ⇒ Màn hình phải HỎI. Ô rỗng chậm hơn một nhịp, và đó là cái giá đúng.
 */
export const NGUONG_GOI_Y = null;

/** Mẫu cho một điều kiện cụ thể — dùng khi user chọn điều kiện trước, mẫu sau. */
export function mauTheoDieuKien(dk: MaDieuKien): MauLuat | null {
  return MAU_LUAT.find((m) => m.dieuKien === dk) ?? null;
}

/** Mọi điều kiện đã có mẫu chưa. Bài canh gọi nó; người gọi bình thường thì không cần. */
export function dieuKienThieuMau(): MaDieuKien[] {
  return DIEU_KIEN.filter((dk) => mauTheoDieuKien(dk) === null);
}
