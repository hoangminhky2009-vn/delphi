/**
 * GIAI ĐOẠN DỮ LIỆU — một nguồn duy nhất trả lời câu *"dòng này có được vào bảng
 * phân tích product không, và nó thuộc phiên bản nào"* (founder 31/08: *"cô lập
 * data giai đoạn thử nghiệm để ko ảnh hưởng đến dashboard phân tích product…
 * phase hiện tại đa số data thu được là rác"*).
 *
 * ─── VÌ SAO SUY RA, KHÔNG LƯU THÀNH CỘT ─────────────────────────────────────
 * Cám dỗ đầu tiên là thêm `holdem_matches.giai_doan` rồi UPDATE một lượt. Bỏ
 * hướng đó vì ba lý do, và lý do thứ ba là lý do thật:
 *   1. `balance_version` ĐÃ nằm sẵn trên từng dòng từ migration 0010 — thêm cột
 *      thứ hai nói về cùng một sự thật là dựng bản sao, mà bản sao SẼ trôi (D61).
 *   2. Cột đóng băng lúc UPDATE; ranh giới "hiện tại / cũ" thì DI CHUYỂN mỗi lần
 *      founder lật `HOLDEM_BALANCE_VERSION`. Cột sẽ nói dối ngay lần lật kế.
 *   3. Suy ra thì ranh giới là một THUỘC TÍNH ĐO ĐƯỢC của dữ liệu, không phải
 *      một cái mốc ngày do agent chọn. Xem `khong_dung_lai_duoc` ngay dưới.
 *
 * ─── BA GIAI ĐOẠN, VÀ RANH GIỚI KHÔNG PHẢI DO AI ĐẶT TAY ────────────────────
 * ⚠⚠ `khong_dung_lai_duoc` là phát hiện chính của đợt rà 31/08, và nó nặng hơn
 * hẳn "data cũ". Đo trên prod: `balance-v2-D20lever` (81 trận) · `balance-v3-D1`
 * (7) · `balance-v4-D2D3D4` (7) — tổng **95/179 trận = 53% corpus** — mang những
 * chuỗi phiên bản KHÔNG CÒN TRONG `BO_LUAT_THEO_PHIEN_BAN`. `luatCua()` gặp
 * chuỗi lạ thì trả bộ cờ TẮT HẾT (`config/holdem.ts`, nhánh `??`), nên mọi phép
 * dựng lại từ chúng — `sinhMap` để trải hành vi, replay để chấm điểm — chạy trên
 * MỘT TRÒ KHÁC hẳn trò người chơi đã chơi. Đây không phải "số cũ hơi lệch"; đây
 * là số của một thí nghiệm chưa từng diễn ra. Đúng lớp bug D169 (kho.ts dựng map
 * bằng danh sách cờ chép tay đã trôi), chỉ ở quy mô nửa corpus.
 *
 * ⇒ Ranh giới không phải "trước ngày X". Nó là: **bộ luật của dòng này còn tồn
 * tại trong code không.** Không còn ⇒ không dựng lại được ⇒ không so được với
 * bất cứ gì ⇒ ra khỏi mọi bảng phân tích, vô điều kiện, kể cả khi ai đó bấm
 * "xem tất cả".
 *
 * ─── KHÔNG PHẢI CƠ CHẾ RIÊNG TƯ ─────────────────────────────────────────────
 * ⚠ File này lọc theo CHẤT LƯỢNG SO SÁNH ĐƯỢC, không lọc theo quyền. Cổng đồng ý
 * nghiên cứu + sàn cỡ ô vẫn sống nguyên ở `server/rieng_tu.ts` và chạy ĐỘC LẬP —
 * hai lớp, hai vai. Ai gỡ file này thì bảng vẫn kín; ai gỡ `rieng_tu.ts` thì
 * bảng vẫn so được. Đừng gộp chúng.
 */

import { BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION } from './holdem.js';

/* ══════════════════════════════════════════════════════════════════════════
 * GIAI ĐOẠN
 * ══════════════════════════════════════════════════════════════════════════ */

export type GiaiDoanDuLieu =
  /** Đúng bộ luật đang chạy. Đây là mẫu DUY NHẤT nói được điều gì về trò hôm nay. */
  | 'hien_tai'
  /** Bộ luật còn trong registry ⇒ dựng lại được, so được VỚI CHÍNH NÓ. Không gộp
   *  với `hien_tai`: mỗi cổng balance là một trò khác (A11.3). */
  | 'cu'
  /** Bộ luật đã biến mất khỏi code ⇒ mọi con số phái sinh là hư cấu. Cắt. */
  | 'khong_dung_lai_duoc';

/**
 * Giai đoạn của một `balance_version`.
 *
 * @param macDinh phiên bản đang là mặc định. Tham số hoá thay vì đọc thẳng hằng
 *   số để bài test dựng được cả ba nhánh mà không phải sửa config toàn cục — và
 *   để bàn đo (Monte Carlo) hỏi được "nếu mặc định là X thì bảng ra sao".
 */
export function giaiDoanCuaPhienBan(
  ver: string | null | undefined,
  macDinh: string = HOLDEM_BALANCE_VERSION,
): GiaiDoanDuLieu {
  // NULL cũng là "không dựng lại được": không biết luật nào thì không suy được gì.
  if (!ver) return 'khong_dung_lai_duoc';
  if (!(ver in BO_LUAT_THEO_PHIEN_BAN)) return 'khong_dung_lai_duoc';
  return ver === macDinh ? 'hien_tai' : 'cu';
}

/** Dòng này có được phép vào bảng phân tích product không (bất kể bộ lọc nào). */
export function duocVaoPhanTich(
  ver: string | null | undefined,
  macDinh?: string,
): boolean {
  return giaiDoanCuaPhienBan(ver, macDinh) !== 'khong_dung_lai_duoc';
}

/**
 * Mọi phiên bản CÒN DỰNG LẠI ĐƯỢC — dùng làm danh sách trắng cho mệnh đề SQL.
 *
 * ⚠ Suy thẳng từ khoá của registry, KHÔNG chép tay. Danh sách chép tay ở đây là
 * đúng cái đã đốt D169: bản chép dừng ở v32 rồi lặng lẽ dán nhãn sai cho mọi
 * trận v35 — không lỗi, không test đỏ, chỉ có dữ liệu sai.
 */
export const PHIEN_BAN_SONG: readonly string[] = Object.freeze(
  Object.keys(BO_LUAT_THEO_PHIEN_BAN),
);

/** Nhãn tiếng Việt cho mặt admin. Chữ ở client (D26) — đây là mặt NỘI BỘ nên
 *  nhãn đi cùng dữ liệu cho đỡ một vòng tra; không áp cho API người chơi. */
export const NHAN_GIAI_DOAN: Readonly<Record<GiaiDoanDuLieu, string>> = {
  hien_tai: 'phiên bản hiện tại',
  cu: 'phiên bản cũ (còn dựng lại được)',
  khong_dung_lai_duoc: 'KHÔNG DỰNG LẠI ĐƯỢC — luật đã biến mất khỏi code',
};

/* ══════════════════════════════════════════════════════════════════════════
 * SẢN PHẨM ĐÃ CHẾT
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * `context_type` của những thứ KHÔNG CÒN LÀ SẢN PHẨM — dòng của chúng không bao
 * giờ được gộp vào số product.
 *
 * ⚠ `sandbox_match` là game TRƯỚC pivot D24 (19/07). Nó không phải phiên bản cũ
 * của Đấu trường; nó là một trò khác đã bị khai tử. 37 dòng trên prod.
 * ⚠ `verify` là dấu vết của một lượt kiểm thủ công (2 dòng, 19/07).
 *
 * ⚠⚠ CHỢ DỰ BÁO (`market`) KHÔNG CÓ Ở ĐÂY — CÓ CHỦ ĐÍCH. Nó ĐÓNG BĂNG (D86),
 * không chết: "không xoá gì, kèo đang mở resolve đúng luật, mở lại = bỏ cờ".
 * Xếp nó vào đây là lặng lẽ biến một quyết định đóng băng thành một quyết định
 * khai tử — mà đó là việc của founder, không phải của một hằng số.
 */
export const CONTEXT_DA_CHET: readonly string[] = ['sandbox_match', 'verify'];

/* ══════════════════════════════════════════════════════════════════════════
 * SÀN MẪU
 * ══════════════════════════════════════════════════════════════════════════ */

export const GIAI_DOAN = {
  /**
   * Dưới ngần này trận thì con số vẫn HIỆN nhưng phải đeo cờ "mẫu quá mỏng".
   *
   * ⚠ HIỆN chứ không ẩn: mùa 0.0 mẫu số là ~3–5 người thật (D64/A11.1), ẩn hết
   * thì mặt admin trắng trơn và founder mất luôn đường soi. Cái phải chặn không
   * phải việc NHÌN con số, mà việc ĐỌC nó như một kết luận.
   *
   * PLAYTEST-TUNE (A8.2 — agent không tự chốt). 10 là mức khớp với cỡ "gói đầy"
   * của tầng hành vi (`server/hanh_vi/goi.ts`: ≥10 trận XONG), để hai chỗ đừng
   * nói hai ngưỡng khác nhau về cùng một câu "đã đủ để nói gì chưa".
   */
  SAN_TRAN_TIN_CAY: 10,
} as const;
