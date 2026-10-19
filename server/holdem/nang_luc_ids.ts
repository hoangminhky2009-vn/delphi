/**
 * KIỂU DTO THẺ NĂNG LỰC (D323) — tách khỏi `nang_luc.ts` (hàm chấm) đúng nếp
 * `khoanh_khac_ids.ts`: chỉ kiểu + hằng, không kéo theo phép tính, để phía
 * đọc thuần (client qua `@server`, hoặc route) import mà không phải rước theo
 * toàn bộ logic chấm.
 *
 * `NangLucTran.bac` CỐ Ý loại `chung_minh` bằng kiểu (`Exclude`): bậc đó chỉ có
 * nghĩa khi gộp NHIỀU trận khác seed (test-retest, xem docstring `nang_luc.ts`
 * config) — một trận đơn lẻ không bao giờ tự xưng "đã chứng minh".
 */
import type { BacNangLuc, NangLucId } from '../../config/nang_luc.js';

/** Một năng lực đã chấm trên MỘT trận (đề). */
export interface NangLucTran {
  id: NangLucId;
  bac: Exclude<BacNangLuc, 'chung_minh'>;
  /** Số đã đếm — null = không đo được (A11.2). Khoá cố định theo năng lực, xem nang_luc.ts. */
  bang_chung: Record<string, number | null>;
}

/** Payload thẻ năng lực của MỘT trận — nằm cạnh `khoanh_khac` trong `/autopsy`. */
export interface TheNangLucTranDTO {
  formula_version: number;
  /** Trận này có vào thẻ theo người không (xong · không màn tập · không nghi máy). */
  tinh_vao_the: boolean;
  ly_do_khong_tinh: 'man_tap' | 'chua_xong' | 'nghi_may' | null;
  nang_luc: NangLucTran[];
}

/** Một năng lực đã gộp qua MỌI trận tính vào thẻ — payload `GET /me/nang-luc`. */
export interface NangLucCuaToi {
  id: NangLucId;
  bac: BacNangLuc;
  so_de_gap: number;        // số trận (đếm vào thẻ) mà bậc ≠ chua_gap
  so_de_lam_duoc: number;   // số SEED khác nhau có lam_duoc
  lan_dau_lam_duoc: string | null; // ISO
}

export interface NangLucCuaToiDTO {
  formula_version: number;
  so_de: number;
  nang_luc: NangLucCuaToi[];
  /**
   * D404 — `true` = người này đang ở chế độ tester và CHƯA nộp PHIẾU 2 ⇒ thẻ bị GIỮ: `nang_luc` rỗng,
   * `so_de` = 0. Cùng cửa với `the_dang_giu` của `/autopsy` (D370) — trước D404 chỉ màn kết giấu thẻ,
   * còn Hồ sơ → Thẻ vẫn trả đủ ba bậc, tức cửa một chiều "chưa xem thẻ" hở ở đường thứ hai.
   */
  the_dang_giu?: boolean;
}
