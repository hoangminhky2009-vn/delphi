/**
 * DANH SÁCH ID KHOẢNH KHẮC — tách khỏi `khoanh_khac.ts` để CLIENT import được
 * qua `@server` mà không kéo `engine.ts` (kiểu `MatXich`) vào chương trình tsc
 * của web (web bật `noUnusedLocals`, engine có biến chưa dùng ⇒ đỏ oan).
 * Nguồn chân lý DUY NHẤT của tập ID; `khoanh_khac.ts` re-export.
 */
export const KHOANH_KHAC_IDS = [
  /** Lệnh to đập vào chợ mỏng ⇒ xếp hàng khớp, trả giá xấu hơn bảng (phí vội vàng). */
  'truot_gia',
  /** Cả bàn dồn vào một mã ⇒ giá đã chạy trước khi bạn tới (herding). */
  'chen_chuc',
  /** Đứng nhầm phía một tin hoá ra bịa — dư âm ĐẢO chiều lên danh mục. */
  'tin_gia',
  /** Sức căng tích tụ rồi bung ở dải RẤT CĂNG — cú rơi bị khuếch đại. */
  'suc_cang',
  /** Đòn bẩy nhân cả hai chiều — đây là vòng nó cắn (hoặc trả) mạnh nhất. */
  'don_bay',
  /** Vị thế bán khống KHỚP — ăn khi giá xuống, hoặc bị giá lên bào. */
  'ban_khong',
  /** Sàn chặn lỗ đã đỡ được một phần cú sụt. */
  'chan_lo',
  /** Đọc dây chuyền nhân quả — bám đúng hoặc bám nhầm. */
  'day_chuyen',
] as const;
export type KhoanhKhacId = (typeof KHOANH_KHAC_IDS)[number];

/**
 * SỔ TAY KHÁI NIỆM (tầng 3, 16/08) — payload `GET /holdem/me/so-tay`. Kiểu
 * đặt ở đây (không phụ thuộc engine) để kênh đọc thuần `web/src/api/tinh_cach.ts`
 * import được mà không chạm ví trận (tường lửa D24) lẫn engine.ts.
 * Chỉ khái niệm ĐÃ CHẠM có mặt; client tự điền phần "chưa chạm" từ KHOANH_KHAC_IDS.
 */
export interface SoTayKhaiNiem {
  id: KhoanhKhacId;
  /** Số trận đã xong mà khái niệm này qua ngưỡng đáng gọi tên. */
  so_tran: number;
  /** Mốc trận ĐẦU TIÊN chạm (ISO) — null nếu trận không có mốc. */
  lan_dau: string | null;
  /** Cú mạnh nhất qua mọi trận: delta_bp + vòng. */
  manh_nhat: { delta_bp: number; vong: number };
}
/**
 * 12/09 (Q3 — LIÊN KẾT NHÌN THẤY) — SỔ LIÊN HỆ: cái kéo (mặt sự kiện) nào bạn đã
 * SỐNG QUA ở các trận đã xong, mấy lần, lần đầu khi nào. Tính từ seed + cỡ bàn +
 * luật của trận (`sinhMap` tất định — `server/holdem/lien_he.ts`), KHÔNG từ dây
 * chuyền ghế mình: sống qua là cả bàn thấy (dải sáu mã), không phải mã đang cầm.
 * `dau` = dấu tác động lên từng mã theo ma trận trôi của luật (`mtSuKien`) —
 * server tính, client chỉ vẽ sáu chấm nghiêng; KHÔNG phải β, KHÔNG phải số.
 * Chỉ mặt ĐÃ GẶP có mặt; client tự vẽ mờ phần chưa gặp từ catalog (Outer Wilds:
 * bản đồ những gì còn tồn tại, không phải danh sách việc — D67/A10).
 */
export interface LienHeSoTay {
  /** `SuKienId` — client tra tên ở catalog (D26). */
  id: string;
  /** Tính chất nền của mặt (van_tien · hung_phan · hoang_loan · lech_ma) — huy hiệu. */
  tinh_chat: string;
  /** Số lần gặp THẬT (mặt lật đúng nghĩa) — bậc GẶP 1 · GẶP LẠI 2 · QUEN ≥3. */
  so_lan: number;
  /** Số lần gặp mặt này dưới dạng TIN GIẢ (giá đi rồi đảo). */
  so_lan_gia: number;
  /** Trận đầu tiên gặp thật (ISO) — null nếu chỉ mới gặp giả / trận không mốc. */
  lan_dau: string | null;
  /** Dấu tác động lên từng mã, thứ tự bảng `TAI_SAN`. */
  dau: { ma: string; dau: -1 | 0 | 1 }[];
}
export interface SoTayDTO {
  /** Số trận đã xong của người này (thước D62/D86) — 0 thì client không vẽ sổ. */
  so_tran: number;
  khai_niem: SoTayKhaiNiem[];
  /** 12/09 — vắng ở API cũ ⇒ client không vẽ khối liên hệ. */
  lien_he?: LienHeSoTay[];
}

/**
 * BA BẬC của một mặt đã sống qua — GẶP · GẶP LẠI · QUEN. Ở đây (không engine) để
 * client vẽ cùng thang với server. ⚠ PLAYTEST-TUNE: đề xuất agent 12/09, chưa
 * founder chốt; đổi ngưỡng không qua `balance_version` (không phải luật engine).
 */
export const BAC_LIEN_HE = { GAP: 1, GAP_LAI: 2, QUEN: 3 } as const;

export function bacLienHe(soLan: number): 0 | 1 | 2 | 3 {
  if (soLan >= BAC_LIEN_HE.QUEN) return 3;
  if (soLan >= BAC_LIEN_HE.GAP_LAI) return 2;
  if (soLan >= BAC_LIEN_HE.GAP) return 1;
  return 0;
}
