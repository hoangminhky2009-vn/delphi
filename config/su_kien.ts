/**
 * TRẦN `state_snapshot_json` THEO TỪNG `action_type` — B3 (03/09/2026, quyết định
 * founder; nhật ký: `docs/nhat-ky/D222.md` — xem entry đó để tra toàn bộ hoàn cảnh
 * + bảng đo đầy đủ).
 *
 * ─── VÌ SAO FILE NÀY, VÌ SAO KHÔNG PHẢI `config/ha_tang.ts` ─────────────────
 * `ha_tang.ts` tự khai rõ miền của nó: ngưỡng HẠ TẦNG chung (dung lượng DB, tuổi
 * backup, số user/ngày) — và tự loại trừ "một bảng cụ thể" ra khỏi phạm vi (xem
 * docstring đầu file đó, đoạn "Ba file từng được cân nhắc"). Trần ở ĐÂY là NGƯỢC
 * LẠI đúng thứ bị loại trừ: giới hạn của MỘT CỘT (`events.state_snapshot_json`)
 * THEO TỪNG `action_type` — một luật DỮ LIỆU/SCHEMA (miền A7/A9,
 * `docs/luat/04-du-lieu.md`), không phải một con số về SỨC CHỊU hạ tầng. Nhà
 * đúng của nó là một file riêng cạnh `config/economy.ts` (cũng phục vụ một miền
 * luật cụ thể — A4/A5 — không phải `ha_tang.ts`), không phải nhét vào nhà hàng xóm.
 *
 * ─── ĐO THẬT, KHÔNG ƯỚC LƯỢNG ────────────────────────────────────────────────
 * A7 gốc (`docs/luat/04-du-lieu.md`, trước 03/09) đặt một mục tiêu DUY NHẤT "≤
 * ~300 byte/event" cho MỌI action_type — số này chưa từng được đo, chỉ là ước
 * lượng viết tay. Thực tế đo bằng `scripts/do_co_snapshot.ts` (lái app Hono thật
 * qua Postgres nhúng, một trận map 16 · 8 ghế — cỡ map và số ghế LỚN NHẤT engine
 * cho phép) lộ ra: `hd_cam_ket` (nhúng nguyên mảng đối thủ, `bangDoiThu()`, mỗi
 * vòng) đo được max ~1,7 KB — gấp ~5,7 lần mục tiêu cũ. Đây KHÔNG PHẢI lỗi cần
 * sửa: founder chốt phương án (a) — GIỮ snapshot giàu (dữ liệu hành vi đắt hơn
 * byte), ĐỔI LUẬT cho khớp thực tế, ĐO thay vì ước lượng. File này là luật đó.
 *
 * ⚠⚠ NGƯỜI ĐỌC SAU: đừng "tối ưu" `hd_cam_ket` xuống nhỏ vì thấy nó to nhất bảng.
 * To là CHỦ ĐÍCH (xem `vi_sao` của chính entry đó) — nếu thấy cấn, hỏi founder
 * trước khi cắt (A8.1), đừng lặng lẽ rút gọn state_snapshot_json.
 *
 * ─── QUY TẮC LỀ (headroom), ÁP DỤNG ĐỀU CHO MỌI LOẠI ĐÃ ĐO ──────────────────
 * `bytes = làm_tròn_lên_bội_50( max(max_đo × 1,3 ; p95_đo) )`, tối thiểu 300.
 * 1,3× max chừa chỗ cho biến thiên seed/số ghế giữa các trận thật (script đo
 * MỘT trận mẫu, không phải mọi trận tương lai); sàn 300 giữ nguyên số mục tiêu
 * CŨ của A7 làm đáy — không loại nào được phép nhỏ hơn mức luật gốc từng đặt ra
 * cho TẤT CẢ. Loại NÀO đo được p95 gần bằng max (phân bố ổn định, không có đuôi
 * dài) thì 1,3×max luôn thắng vế p95 trong `max(...)` — vế p95 giữ lại cho loại
 * tương lai có phân bố lệch (đuôi dài hiếm gặp nhưng to).
 *
 * Số liệu gốc + bảng đo đầy đủ (min/p50/p95/max, cả state_snapshot_json lẫn
 * TOÀN BỘ dòng): chạy lại `npx tsx scripts/do_co_snapshot.ts`, hoặc xem nhật ký.
 */

export interface TranSnapshot {
  /** Ngưỡng byte cho `octet_length(state_snapshot_json::text)` của MỘT dòng loại này. */
  bytes: number;
  /** Vì sao loại này cần đúng ngần này — một dòng. */
  vi_sao: string;
}

/**
 * Bảy loại ĐO ĐƯỢC có dùng `state_snapshot_json` thật, cộng NĂM loại ĐO ĐƯỢC là
 * KHÔNG DÙNG cột đó (đo 03/09/2026, xem docstring đầu file). Nhóm sau (`bytes: 0`)
 * không phải "chưa đo" — câu INSERT của chúng (đọc trong `server/holdem_api.ts`
 * và `server/subsidy.ts`) không hề có cột `state_snapshot_json`, nên nó luôn NULL
 * theo CẤU TRÚC. Ghi tường minh `bytes: 0` ở đây thay vì để chúng rơi vào sàn mặc
 * định (300) — mặc định dành cho "chưa ai đo, có thể cần tới sàn đó"; năm loại
 * này đã ĐO RỒI và sự thật là chúng không bao giờ cần một byte snapshot nào.
 */
export const TRAN_SNAPSHOT: Readonly<Record<string, TranSnapshot>> = {
  hd_cam_ket: {
    bytes: 2250,
    vi_sao: 'Nhúng NGUYÊN mảng đối thủ (`bangDoiThu()`, tới 7 ghế bàn 8) MỖI VÒNG — chủ đích của '
      + 'founder (03/09): dữ liệu hành vi (bối cảnh xã hội D25/R1 tại đúng khoảnh khắc quyết định) đáng '
      + 'giá hơn byte tiết kiệm được. Đo max 1698–1710B qua 4 lần chạy độc lập (map 16, 8 ghế); CHƯA từng đo '
      + 'lúc đặc quyền "di_nguoc" lộ thêm `tai_san_thay` cho nhiều đối thủ cùng lúc — 1,3× nên đã chừa '
      + 'chỗ, nhưng đây là điểm cần đo lại nếu tách suất riêng cho ca đó về sau.',
  },
  hd_chot_phien: {
    bytes: 500,
    vi_sao: '`trangThaiMay` — trạng thái máy của ô vừa lật, ghi MỌI vòng (comment gốc ước "~230B", đo '
      + 'thật ra 305–376B — ước lượng cũ THẤP hơn thực tế, không phải cao).',
  },
  hd_mo_bang: {
    bytes: 300,
    vi_sao: 'Bối cảnh lúc mở Bảng điện tử (von/tổng ròng/số dòng chưa rõ + môi trường). Comment gốc '
      + 'ước "~200B", đo thật 158–165B — ước lượng cũ CAO hơn thực tế; sàn 300 (không phải max×1,3) '
      + 'là mức quyết định ở đây.',
  },
  hd_dao_danh_muc: {
    bytes: 300,
    vi_sao: 'Bối cảnh vốn rút gọn (`boiCanhVon`) — von/môi trường/số người sống, không dump danh mục. '
      + 'Đo max 119–120B qua nhiều lần chạy; sàn 300 quyết định.',
  },
  hd_khoa_tai_san: {
    bytes: 300,
    vi_sao: 'Cùng hình dạng `boiCanhVon` với hd_dao_danh_muc — cam kết giữ dài hạn, không phải phản '
      + 'ứng tức thời, nhưng snapshot ghi CÙNG một bối cảnh gọn. Đo max 119–120B; sàn 300 quyết định.',
  },
  hd_dat_short: {
    bytes: 300,
    vi_sao: 'Cùng hình dạng `boiCanhVon` — đặt cược NGƯỢC xu hướng, đo max 118–120B; sàn 300 quyết định.',
  },
  hd_chon_ky_ngo: {
    bytes: 300,
    vi_sao: 'Cùng hình dạng `boiCanhVon`, ghi bối cảnh lúc chọn nhiệm vụ kỳ ngộ (v32). Đo max 115–117B '
      + '(chỉ 2 mẫu — map 16 có đúng 2 vòng kỳ ngộ mỗi trận, xem `KY_NGO.VONG`); sàn 300 quyết định.',
  },
  // ── Đo được là KHÔNG DÙNG state_snapshot_json (câu INSERT thiếu hẳn cột đó) ──
  hd_match_start: {
    bytes: 0,
    vi_sao: 'Bối cảnh đối thủ đầy đủ (kể cả `doi_thu`) nằm trong `value_json`, không phải '
      + '`state_snapshot_json` — cột này vắng mặt trong câu INSERT (holdem_api.ts ~3041).',
  },
  hd_match_end: {
    bytes: 0,
    vi_sao: 'Toàn bộ dữ liệu (xếp hạng, NAV cuối, kỳ ngộ) nằm trong `value_json`; câu INSERT '
      + '(holdem_api.ts ~4924) không có cột `state_snapshot_json`.',
  },
  hd_tran_het_han: {
    bytes: 0,
    vi_sao: 'Chỉ ba trường nhỏ (vòng, hạn phút, lý do) trong `value_json`; câu INSERT '
      + '(holdem_api.ts ~4781) không có cột `state_snapshot_json`.',
  },
  mg_lenh: {
    bytes: 0,
    vi_sao: 'Cú bấm trong màn minigame (D466): vòng · số nhịp đang thấy · nhịp máy · nút · nguồn trong `value_json`; câu INSERT '
      + '(holdem_api.ts, route `/minigame/:vong/lenh`) không có cột `state_snapshot_json`. Bối cảnh màn nằm ở `holdem_minigame_man`.',
  },
  hd_tin_gia_lo: {
    bytes: 0,
    vi_sao: 'Payload là chính đối tượng "tin giả lộ" trong `value_json`; câu INSERT '
      + '(holdem_api.ts ~4402) không có cột `state_snapshot_json`.',
  },
  checkin: {
    bytes: 0,
    vi_sao: 'Chỉ một số tiền qua `value_num`; câu INSERT (subsidy.ts ~171) chỉ có bốn cột '
      + '(user_id, context_type, context_id, action_type, value_num) — không có `value_json` lẫn '
      + '`state_snapshot_json`.',
  },
};

/**
 * Mặc định cho action_type CHƯA đo — giữ NGUYÊN số mục tiêu CŨ của A7 (≤300B),
 * nay đổi vai từ "luật cho mọi loại" thành "sàn an toàn cho loại chưa ai đo".
 * Loại nào vượt mốc này khi đo thật thì thêm entry riêng vào `TRAN_SNAPSHOT`,
 * KHÔNG nới số mặc định — nới mặc định là nới trần của mọi loại tương lai cùng
 * lúc, kể cả loại chưa ai nghĩ tới.
 */
export const TRAN_SNAPSHOT_MAC_DINH = 300;

/**
 * Trần snapshot của một `action_type`: entry riêng nếu đã đo, mặc định nếu chưa.
 * KHÔNG throw — mọi loại (đo được hay không) đều có câu trả lời, đúng tinh thần
 * "loại chưa đo không được lặng lẽ vô trần" (A11.6 — nghiệm thu bằng tiêm lỗi
 * ngược cần một trần XÁC ĐỊNH để hạ xuống thử).
 */
export function tranSnapshot(actionType: string): TranSnapshot {
  return TRAN_SNAPSHOT[actionType] ?? {
    bytes: TRAN_SNAPSHOT_MAC_DINH,
    vi_sao: 'chưa đo riêng — dùng sàn A7 gốc. Đo thật bằng `scripts/do_co_snapshot.ts` rồi thêm entry '
      + 'vào TRAN_SNAPSHOT nếu loại này thật sự dùng state_snapshot_json và vượt sàn này.',
  };
}
