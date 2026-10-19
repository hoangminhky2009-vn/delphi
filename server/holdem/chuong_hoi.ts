/**
 * CHƯƠNG HỒI CÓ TÊN — LUẬT GỐC, dời từ `web/src/lib/chuong_hoi.ts` xuống server
 * (D88 §11.3). Client nay RE-EXPORT file này qua alias `@server` (tiền lệ
 * `xemTruocLenh` D67) — MỘT nguồn, không thể trôi.
 *
 * ─── VÌ SAO PHẢI DỜI XUỐNG SERVER ─────────────────────────────────────────
 * Bộ mời kỳ ngộ nay sinh theo CHƯƠNG HỒI đang chơi (D88). Lời mời do server
 * quyết (C4) và phải dựng lại được khi replay; nếu luật hồi sống ở client thì
 * server phải chép lại nó — bản sao thứ hai sẽ trôi (D61), và cú trôi ở đây
 * biểu hiện là LỜI MỜI khai hồi SÓNG GIÓ trong khi MÀN đang hiện BONG BÓNG.
 *
 * ⚠⚠ TỪ D88, LUẬT NÀY NẰM TRÊN ĐƯỜNG REPLAY (mời kỳ ngộ = hàm của hồi).
 * Đổi bất kỳ ngưỡng/nhánh nào ở đây là đổi bộ mời của MỌI trận v32 đã lưu —
 * phải qua cổng `balance_version` mới, y như đổi engine. Có test golden khoá
 * (tests/ky_ngo.test.ts) để cú sửa "chỉ là hiển thị" không đi lọt.
 *
 * ─── BA LUẬT CỨNG (giữ nguyên từ bản client) ──────────────────────────────
 * 1. ⚠⚠ CHỈ ĐỌC THÔNG TIN CÔNG KHAI: ô ĐÃ LẬT + chuỗi xu hướng ĐÃ XÁC NHẬN +
 *    môi trường lãi suất. KHÔNG đọc `suc_cang_dai` hay sự thật tin-giả —
 *    chương hồi mà rò thứ ẩn thì nó thành lá Lướt Sóng phát không.
 * 2. Chương là NHÃN HỒI CỐ, không phải dự báo.
 * 3. A10 — câu phụ MÔ TẢ, không KÊ ĐƠN.
 *
 * Dò "bão" bằng `bao_truoc` chứ không bằng danh sách id: thẻ mới tự khai hướng
 * của nó, không có bản sao thứ hai để trôi (D61).
 */

/**
 * Ô ở DẠNG CÔNG KHAI — đúng hình dạng `oCongKhai()` phát ra và client nhận.
 * Khai CẤU TRÚC tại đây (không import từ web, không import map.ts): luật này
 * phải bundle được vào trình duyệt và chỉ được thấy thứ người chơi thấy.
 */
export interface OCongChuong {
  /**
   * D422 — `che` / `suong`: lớp che của riêng người mang MÙ TIN / SƯƠNG MÙ (client nhận ô đã che). Luật dưới đọc chúng là
   * KHÔNG BIẾT (không pha, không nghiêng) — đúng thứ người ấy thấy. Server chỉ đưa vào đây ô thật.
   */
  kind: 'giai_doan' | 'su_kien' | 'che' | 'suong';
  giai_doan?: string;
  su_kien?: string;
  bao_truoc?: string;
}

export type ChuongId =
  | 'mo_man' | 'gay_dung' | 'song_gio' | 'bong_bong'
  | 'tien_re' | 'tien_dat' | 'giu_nhip';

export interface Chuong {
  id: ChuongId;
  ten: string;
  /** Câu phụ — MÔ TẢ thị trường, không bao giờ khuyên nước đi (A10). */
  phu: string;
}

const CH: Record<ChuongId, Chuong> = {
  mo_man: { id: 'mo_man', ten: 'MỞ MÀN', phu: 'Chợ đang thăm dò, chưa thành chuyện.' },
  gay_dung: { id: 'gay_dung', ten: 'GẦY DỰNG LẠI', phu: 'Chợ gượng dậy sau cú rơi.' },
  song_gio: { id: 'song_gio', ten: 'SÓNG GIÓ', phu: 'Tin xấu dồn dập, giá đang rơi.' },
  bong_bong: { id: 'bong_bong', ten: 'BONG BÓNG PHỒNG', phu: 'Giá leo dài — càng cao càng giòn.' },
  tien_re: { id: 'tien_re', ten: 'MÙA TIỀN RẺ', phu: 'Vay rẻ, tiền tràn ra chợ.' },
  tien_dat: { id: 'tien_dat', ten: 'MÙA TIỀN ĐẮT', phu: 'Vay đắt, tiền rút khỏi chợ.' },
  giu_nhip: { id: 'giu_nhip', ten: 'GIỮ NHỊP', phu: 'Không sóng lớn — chợ đi nhịp thường.' },
};

/** Cửa sổ đọc: 3 ô gần nhất. Một ô lẻ là nhiễu, không phải một hồi. */
const CUA_SO = 3;

export function chuongHoi(
  lichSuO: readonly OCongChuong[],
  oHienTai: OCongChuong | null | undefined,
  xuHuong: { huong: number; dai: number } | null | undefined,
  moiTruong: 're' | 'trung_tinh' | 'dat' | undefined,
): Chuong {
  const thay: OCongChuong[] = [...lichSuO, ...(oHienTai ? [oHienTai] : [])];

  // Một ô chưa phải một câu chuyện — đợi có nhịp rồi mới gọi tên.
  if (thay.length <= 1) return CH.mo_man;

  const cuoi = thay.slice(-CUA_SO);
  const pha = (o: OCongChuong): string | null =>
    (o.kind === 'giai_doan' ? o.giai_doan ?? null : null);
  /** Độ nghiêng CÔNG KHAI của một ô: pha của giai đoạn, `bao_truoc` của sự kiện. */
  const nghieng = (o: OCongChuong): string | null =>
    (o.kind === 'su_kien' ? o.bao_truoc ?? null : pha(o));

  /*
   * THỨ TỰ LÀ MỘT PHẦN CỦA LUẬT (tiền lệ D73 — nét "đắt" xét trước nét "đẹp"):
   * hồi cố gần nhất thắng hồi cố xa. [sập sàn, phục hồi] phải đọc là GẦY DỰNG
   * LẠI chứ không phải SÓNG GIÓ — cú rơi là chuyện của hồi TRƯỚC.
   */

  // GẦY DỰNG LẠI — pha phục hồi trong 2 ô gần nhất.
  if (thay.slice(-2).some((o) => pha(o) === 'phuc_hoi')) return CH.gay_dung;

  // SÓNG GIÓ — ≥2/3 ô gần nhất nghiêng xuống hoặc hỗn loạn. Ngưỡng 2 có chủ ý:
  // một ô đỏ lẻ giữa dải xanh là nhiễu; gọi nó là "sóng gió" thì nhãn nhảy
  // theo từng ô và người chơi học cách phớt lờ (bài học viền D77).
  const bao = cuoi.filter((o) => {
    const n = nghieng(o);
    return n === 'giam' || n === 'bien_dong';
  }).length;
  if (bao >= 2) return CH.song_gio;

  // BONG BÓNG PHỒNG — chuỗi tăng ĐÃ XÁC NHẬN (server phát công khai) đủ dài,
  // hoặc vừa dài vừa có mồi (thẻ Bong bóng đã lật / tiền đang rẻ).
  const daiLen = (xuHuong?.huong ?? 0) > 0 ? (xuHuong?.dai ?? 0) : 0;
  const moiBong = cuoi.some((o) => o.kind === 'su_kien' && o.su_kien === 'bong_bong');
  if (daiLen >= 3 || (daiLen >= 2 && (moiBong || moiTruong === 're'))) return CH.bong_bong;

  // Không có kịch — nền lãi suất kể nốt phần còn lại.
  if (moiTruong === 're') return CH.tien_re;
  if (moiTruong === 'dat') return CH.tien_dat;
  return CH.giu_nhip;
}
