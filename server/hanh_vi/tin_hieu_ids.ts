/**
 * KIỂU DTO TÍN HIỆU GAME CHO PFM (D324) — tách khỏi `tin_hieu.ts` đúng nếp
 * `khoanh_khac_ids.ts`: chỉ kiểu, không import pg/engine, để kênh đọc thuần phía web
 * (`web/src/api/tinh_cach.ts`) import qua `@server` mà không kéo tầng DB vào bundle.
 */
import type { BacDocId, SauChiSo } from '../holdem/insight.js';

export interface TinHieuTietKiem {
  /** Trận hợp lệ chạy luật CÓ ngân hàng (`tiet_kiem_bp` không toàn null). */
  n_tran_co_co_che: number;
  /** Trận có ít nhất một vòng gửi (`tiet_kiem_bp > 0`). */
  n_tran_gui: number;
  /** Tổng số hợp đồng huỷ trước hạn qua mọi trận có cơ chế. */
  so_huy_tong: number;
  /** TB `tiet_kiem_bp` trên vòng đang gửi (> 0); null khi không vòng nào gửi. */
  ty_trong_tb_bp: number | null;
  /** (trận gửi và không huỷ lần nào) / trận gửi; null khi chưa trận nào gửi. */
  ty_le_tran_giu_du: number | null;
}

export interface TinHieuGameDTO {
  /** = `HANH_VI_FORMULA_VERSION` của dòng nguồn — không mở trục phiên bản mới. */
  formula_version: number;
  /**
   * ⚠ LUÔN `'chua'` mùa này: độ tin cậy lặp lại (Test A, tệp 10 §4.3) chưa đo, nên mọi
   * số dưới đây là TÍN HIỆU CHƯA HIỆU CHUẨN. Trường tồn tại để khi có kết quả Test A,
   * người đọc (gương, nghiên cứu) không phải đoán từ ngày ghi.
   */
  hieu_chuan: 'chua';
  /** Trận / vòng HỢP LỆ — cùng luật `vaoGoi` (xong · không màn tập · không nghi máy). */
  n_tran: number;
  n_vong: number;
  chi_so: SauChiSo;
  bac_doc: BacDocId;
  /** null khi không trận hợp lệ nào có cơ chế ngân hàng (khác 0 = có cửa mà không dùng). */
  tiet_kiem: TinHieuTietKiem | null;
}
