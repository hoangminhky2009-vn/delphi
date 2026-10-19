/**
 * CHƯƠNG HỒI — RE-EXPORT từ luật gốc ở server (D88 §11.3).
 *
 * ⚠ LUẬT SỐNG Ở `server/holdem/chuong_hoi.ts`, KHÔNG Ở ĐÂY. Từ D88 bộ mời kỳ
 * ngộ sinh theo hồi, tức luật này nằm trên đường replay — hai bản cài đặt là
 * lời mời khai một hồi trong khi màn hiện hồi khác (D61). File server THUẦN,
 * chỉ đọc thông tin công khai, nên bundle vào trình duyệt được — đúng tiền lệ
 * `xemTruocLenh` (D67) qua alias `@server`.
 *
 * `ODTO` của client khớp CẤU TRÚC với `OCongChuong` (server khai cấu trúc,
 * không import ngược từ web) — TypeScript kiểm điều đó ở chỗ gọi.
 */
export {
  chuongHoi, type Chuong, type ChuongId, type OCongChuong,
} from '@server/holdem/chuong_hoi';
