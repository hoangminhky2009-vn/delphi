/**
 * GUARDRAIL KINH TẾ — ngưỡng báo động vận hành (D16 mục 6, sửa 05/09 theo D246).
 *
 * ⚠ ĐÂY KHÔNG PHẢI THAM SỐ ĐƯỜNG TIỀN. Không một hằng số nào ở đây tham gia vào
 * một phép tính payout/giá/phí. Chúng là NGƯỠNG BÁO ĐỘNG: đọc số đã có rồi kêu.
 * Tham số đường tiền vẫn nằm nguyên ở `config/economy.ts` (A4) và file này IMPORT
 * chứ không chép lại (D61 — bản sao thứ hai sẽ trôi).
 *
 * ⚠ Mọi con số dưới đây là PLAYTEST-TUNE trừ khi ghi "D16" — agent không tự đặt
 * tham số kinh tế (A8.2/A11.8). Nguồn đề xuất: `docs/thiet-ke-de-xuat/kinh-te/
 * nen-kinh-te-app.md` §11. Founder chốt trước khi coi là số thật.
 *
 * ─── HAI DÒNG GUARDRAIL CỦA D16 ĐÃ CHẾT, SỬA Ở ĐÂY ──────────────────────────
 *
 * 1. "Q tồn kho bình quân > 2.500/user" — **không bao giờ nổ được**. Trần phát Q
 *    cả mùa (`tranQMua()`) chỉ 1.200, nên một người không thể tồn 2.500. Một cái
 *    chuông treo ở độ cao không ai với tới thì không phải chuông.
 *    ⇒ Đổi sang TỶ LỆ của trần phát thật: `tồn > Q_TON_TY_LE_BP × tranQMua()`.
 *
 * 2. "Q sink/phát > 0,9 (dân ngộp)" — chỉ có TRẦN, thiếu SÀN. Bệnh đang mắc là
 *    bệnh ngược lại: sink/phát ~0,50, tức **có Q mà không có gì đáng tiêu**.
 *    ⇒ Thêm ngưỡng sàn `< 0,55` (mép dưới dải lành mạnh của chính D16).
 */
import { ECONOMY } from './economy.js';

/** Mẫu số basis point dùng chung (nhắc lại kiểu, không nhắc lại giá trị A4). */
export const GR_BP = 10_000;

export const GUARDRAIL = {
  // ── T: ví và phân phối (D16 mục 6, giữ nguyên) ───────────────────────────
  /** Median ví dưới mức này hai tuần liên tiếp ⇒ nâng trợ cấp. D16. */
  MEDIAN_SAN: 500,
  /** Median ví trên mức này ⇒ cần sự kiện đốt. D16. */
  MEDIAN_TRAN: 3_000,
  /** Số tuần liên tiếp phải chạm mới kêu (chống báo động vì một tuần lẻ). D16. */
  MEDIAN_SO_TUAN: 2,
  /** Gini trên mức này ⇒ kiểm thông đồng/multi-acc TRƯỚC, đừng nén sớm. D16. */
  GINI_TRAN_BP: 4_500,

  // ── T: Kho bạc ───────────────────────────────────────────────────────────
  /**
   * D16: "Kho bạc < 2×(trợ cấp tuần dự kiến)". Giữ nguyên hình dạng, viết lại
   * thành bội số để đọc được bằng máy.
   */
  KHO_BAC_BOI_TRO_CAP_TUAN: 2,
  /**
   * MỚI (D246 §11): runway dưới ngần này ngày ⇒ báo động đỏ. Runway là câu hỏi
   * D16 chưa từng hỏi vì hồi đó Kho bạc còn rake nuôi; sau D86 thì nó là câu
   * hỏi đầu tiên.
   */
  KHO_BAC_RUNWAY_NGAY: 60,

  // ── T: sink/faucet ───────────────────────────────────────────────────────
  /** Sink/faucet dưới 1 kéo dài ⇒ lạm phát. D16 (mốc 1,00 = cân bằng). */
  T_SINK_FAUCET_SAN_BP: 10_000,

  /**
   * MỚI (D246 §11): tỷ lệ dòng trợ cấp kết thúc ở lò đốt trong 7 ngày. Ống dẫn
   * "Kho bạc → lò đốt" hiện KHÔNG tồn tại (cổng `duDieuKienMoHop` chặn — xem
   * D246 §10.2), nhưng mỗi cửa tiêu T mới có thể mở lại nó. Chuông này là thứ
   * phát hiện việc đó mà không cần ai nhớ.
   */
  TRO_CAP_VAO_LO_DOT_TRAN_BP: 3_000,
  TRO_CAP_VAO_LO_DOT_SO_NGAY: 7,

  // ── Q: tồn và sink/phát ──────────────────────────────────────────────────
  /**
   * SỬA dòng chết #1: tồn Q bình quân vượt tỷ lệ này của `tranQMua()` ⇒ thiếu
   * món để tiêu. 6.000 bp = 60% — PLAYTEST-TUNE.
   */
  Q_TON_TY_LE_BP: 6_000,
  /** D16: sink/phát trên mức này ⇒ dân ngộp, giảm giá hoặc tăng quest. */
  Q_SINK_PHAT_TRAN_BP: 9_000,
  /**
   * SỬA dòng chết #2 — THÊM SÀN: dưới mức này ⇒ **có Q mà không có gì đáng
   * tiêu**. 5.500 bp = 0,55, mép dưới dải lành mạnh của chính D16.
   */
  Q_SINK_PHAT_SAN_BP: 5_500,

  /**
   * Dưới ngần này NGƯỜI THẬT thì mọi TỶ LỆ trong báo cáo chỉ là giai thoại
   * (A11.1/D223: 26/26 tài khoản prod là của founder). Đây là ngưỡng ĐỌC SỐ,
   * không phải ngưỡng vận hành — nó không vặn gì cả, nó chỉ dựng một lá cờ để
   * người đọc biết đừng tin con số bên cạnh. PLAYTEST-TUNE.
   */
  MAU_SO_TOI_THIEU: 30,

  // ── Chưa có nguồn số (B5/B6 mới sinh ra) ─────────────────────────────────
  /**
   * Quỹ chợ dưới ngần này lần chi mua-vào tuần dự kiến ⇒ hạ `HS_QUY`.
   * ⚠ CHƯA CÓ NGUỒN: `quy_cho_ledger` ra đời ở bước B5. Tới lúc đó phép đo trả
   * `null`, KHÔNG trả 0 (A11.2/D62 — thiếu mẫu là null, không phải không).
   */
  QUY_CHO_BOI_CHI_TUAN: 2,
  /**
   * Chỉ số giá bậc hiếm giảm liên tục ngần này kỳ ⇒ dấu hiệu thiếu tiêu huỷ.
   * ⚠ CHƯA CÓ NGUỒN: chỉ số giá ra đời ở bước B6.
   */
  CHI_SO_GIA_SO_KY_GIAM: 4,
} as const;

/**
 * Trợ cấp tuần dự kiến cho `KHO_BAC_BOI_TRO_CAP_TUAN` — suy từ A4, không đặt số
 * mới. Đây là hàm chứ không phải hằng số vì nó phụ thuộc số người đủ điều kiện,
 * thứ chỉ đo được lúc chạy.
 */
export function troCapTuanDuKien(soNguoiDuoiNguong: number): bigint {
  if (!Number.isInteger(soNguoiDuoiNguong) || soNguoiDuoiNguong < 0) {
    throw new Error(`soNguoiDuoiNguong không hợp lệ: ${soNguoiDuoiNguong}`);
  }
  return BigInt(soNguoiDuoiNguong) * BigInt(ECONOMY.SUBSIDY_AMOUNT) * 7n;
}
