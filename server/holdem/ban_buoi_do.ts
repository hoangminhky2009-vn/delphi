/**
 * BÀN BUỔI ĐO ĐANG MỞ — một câu hỏi, một chỗ trả lời (D333).
 *
 * Cửa đăng ký (`server/app.ts`) cần hỏi *"mã này có phải một bàn buổi đo còn mở không"* để đổi xô hạn
 * mức từ IP sang BÀN. Định nghĩa "mở" phải trùng đúng định nghĩa của đường vào bàn
 * (`holdem_api.ts` → `banBuoiDo().daDong`: `het_han <= now` là đóng), nên nó nằm ở đây thay vì gõ lại
 * một câu SQL thứ hai trong tệp auth (A11.5).
 *
 * ⚠ Trả boolean, KHÔNG trả hàng: cửa đăng ký là cửa công khai, và nó không được thành một máy dò
 * "mã nào đang tồn tại". Người gọi dùng kết quả để chọn xô, không để trả lời người gửi.
 */
import type pg from 'pg';

/** Hình dạng mã bàn — trùng `holdem_api.ts` (`/^[a-z0-9]{5}$/`). */
export const MA_BAN_HOP_LE = /^[a-z0-9]{5}$/;

/**
 * QUYỀN ĐIỀU PHỐI — đọc và đặt cờ `users.la_dieu_phoi` theo handle (D333, vỏ CLI `scripts/bat_dieu_phoi.ts`).
 *
 * D329 bật cờ bằng một câu SQL gõ tay: không in DB nào, không kiểm handle, gõ sai là `UPDATE 0` im lặng —
 * và người được bật là người đầu tiên KHÔNG phải founder. Logic nằm ở `server/` vì deploy chỉ đóng gói
 * api/server/config (import từ scripts/ lúc chạy là crash function, đã dính 18/07).
 * ⚠ Khách (`la_khach`) không nhận cờ: server không cho khách tạo bàn buổi đo, bật cho khách là một quyền
 *   không dùng được và một dòng dữ liệu nói dối.
 */
export type KetQuaQuyen =
  | { loai: 'khong_co'; handle: string }
  | { loai: 'la_khach'; handle: string }
  | { loai: 'ok'; handle: string; truoc: boolean; sau: boolean };

export async function datQuyenDieuPhoi(
  pool: pg.Pool, handleTho: string, muon: boolean | null,
): Promise<KetQuaQuyen> {
  const handle = handleTho.trim().toLowerCase();
  const r = await pool.query(
    `SELECT user_id, la_khach, la_dieu_phoi FROM users WHERE handle = $1`, [handle]);
  const u = r.rows[0] as { user_id: string; la_khach: boolean; la_dieu_phoi: boolean } | undefined;
  if (!u) return { loai: 'khong_co', handle };
  if (u.la_khach) return { loai: 'la_khach', handle };
  if (muon === null || muon === u.la_dieu_phoi) {
    return { loai: 'ok', handle, truoc: u.la_dieu_phoi, sau: u.la_dieu_phoi };
  }
  await pool.query(`UPDATE users SET la_dieu_phoi = $2 WHERE user_id = $1`, [u.user_id, muon]);
  return { loai: 'ok', handle, truoc: u.la_dieu_phoi, sau: muon };
}

/**
 * QUYỀN ĐIỀU PHỐI CHO MỌI ADMIN (D349, founder 19/09: *"tất cả admin hiện tại"*).
 *
 * Vì sao là một hàm riêng chứ không phải gọi `datQuyenDieuPhoi` trong vòng lặp: lượt này KHÔNG có
 * handle để gõ. Founder không có danh sách admin trong đầu, và bắt anh ấy tự tra rồi gõ lại từng
 * cái là dựng đúng cái bẫy D329 đã vấp — gõ sai một handle thì `UPDATE 0` im lặng, và người vận
 * hành không có cách nào biết.
 *
 * ⚠ "HIỆN TẠI" LÀ CỐ Ý — đây là một lượt CẤP, không phải một luật. Cờ không suy từ `role`: ai bị
 * gỡ admin sau này vẫn giữ cờ điều phối cho tới khi có người `--go`. Muốn "admin thì đương nhiên
 * điều phối" thì đó là một quyết định khác, và nó phải nằm ở đường đọc quyền, không nằm ở script.
 * ⚠ Khách không lọt: `la_khach` loại ngay trong câu SELECT, cùng lý do với `datQuyenDieuPhoi`.
 */
export interface HangQuyenAdmin { handle: string; truoc: boolean; }

export async function datQuyenDieuPhoiMoiAdmin(
  pool: pg.Pool, muon: boolean | null,
): Promise<readonly HangQuyenAdmin[]> {
  // ⚠ `AS truoc` là bắt buộc, không phải trang trí: pg trả hàng theo TÊN CỘT, nên bỏ alias đi thì
  // mọi hàng có `truoc === undefined` mà TypeScript vẫn im (ép kiểu qua `rows as`). Bài §V bắt.
  const r = await pool.query(
    `SELECT handle, la_dieu_phoi AS truoc FROM users
      WHERE role = 'admin' AND la_khach = false
      ORDER BY handle`);
  const hang = r.rows as HangQuyenAdmin[];
  if (muon === null || hang.length === 0) return hang;
  // MỘT câu cho cả lượt: không có trạng thái nửa vời nếu đứt giữa chừng.
  await pool.query(
    `UPDATE users SET la_dieu_phoi = $1 WHERE role = 'admin' AND la_khach = false`, [muon]);
  return hang;
}

export async function laBanBuoiDoDangMo(pool: pg.Pool, maTho: unknown): Promise<string | null> {
  const ma = typeof maTho === 'string' ? maTho.trim().toLowerCase() : '';
  if (!MA_BAN_HOP_LE.test(ma)) return null;
  const r = await pool.query(
    `SELECT 1 FROM holdem_ban WHERE ma = $1 AND loai = 'buoi_do' AND het_han > now()`, [ma]);
  return r.rowCount === 1 ? ma : null;
}
