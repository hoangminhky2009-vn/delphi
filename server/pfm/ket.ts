/**
 * PFM — KÉT (server, K1/K2/K8/K10). Server chỉ di chuyển BYTE — nội dung đã mã hoá
 * đầu-cuối trên máy user trước khi tới đây (K2), nên không hàm nào ở file này đọc
 * được một chữ nào bên trong `blob`.
 *
 * ⚠ CHỈ THÁNG ĐANG SỐNG được ghi (K10 — "tháng đã đóng, không bao giờ ghi lại"; một
 * tháng không thể vỡ trần vì nó không thể to hơn chính nó). Tháng ĐANG SỐNG xoay tối
 * đa `PFM.BLOB_THE_HE` thế hệ; quy ước `the_he = 1` LUÔN là bản mới nhất — nhờ vậy GET
 * không cần so `ver` giữa các dòng để biết bản nào mới nhất.
 *
 * ⚠ CHỐNG GHI ĐÈ MÙ (K8/T5.1): `ver` do SERVER cấp, tăng dần. Client phải gửi kèm
 * ver nó ĐANG THẤY; lệch với ver mới nhất trên server ⇒ từ chối — bắt client GET lại
 * trước khi ghi đè. KHÔNG dùng đồng hồ máy client làm trọng tài (K7 đã tuyên đồng hồ
 * đó không tin được, và đây là đúng khuôn "ghi trước khoá sau" mà repo đã cấm).
 */
import type pg from 'pg';
import { PFM, LAT_SONG_THANG } from '../../config/pfm.js';

export interface KetQuaGhiLuu {
  ghi: boolean;
  ver: number;
  /** Chỉ có khi `ghi === false`. */
  lyDoTuChoi?: 'thang_khong_song' | 'ver_cu' | 'qua_lon';
}

/** Tháng ĐANG SỐNG của user (ngày 1, theo múi giờ user) — server tự tính, không tin client. */
export async function thangSongCuaUser(
  db: pg.Pool | pg.PoolClient, userId: string,
): Promise<string> {
  const { rows } = await db.query(
    `SELECT to_char(date_trunc('month', now() AT TIME ZONE u.mui_gio), 'YYYY-MM-DD') AS t
       FROM users u WHERE u.user_id = $1`, [userId]);
  if (!rows[0]) throw new Error('không thấy user');
  return rows[0].t as string;
}

/**
 * GHI một lát tháng đã khoá — chỉ nhận nếu `thang` là tháng ĐANG SỐNG và `verClient`
 * khớp bản mới nhất hiện có. Xoay thế hệ theo thứ tự BẮT BUỘC (xoá 3 trước, rồi mới
 * dịch 2→3 và 1→2) để không đụng UNIQUE `(user_id, thang, the_he)` giữa chừng.
 *
 * ⚠ PHẢI GỌI TRONG TRANSACTION CỦA NGƯỜI GỌI — cùng khuôn `ghiDiemDanh`/`capToken`:
 * bốn câu SQL dưới đây phải nguyên tử, không thì hai cú ghi chồng lấn làm mất một
 * thế hệ hoặc vi phạm khoá chính giữa chừng.
 */
export async function ghiLatThang(
  client: pg.PoolClient, userId: string,
  thang: string, blob: Buffer, schemaV: number, verClient: number,
): Promise<KetQuaGhiLuu> {
  if (blob.byteLength > PFM.BLOB_MAX) return { ghi: false, ver: 0, lyDoTuChoi: 'qua_lon' };

  /*
   * ⭐ R15 — ĐÚNG MỘT CHỖ BIẾT LÁT SỐNG LÀ ĐẶC BIỆT, và đây là chỗ đó.
   * "Tháng phải đang sống" tồn tại để tháng đã qua ĐÓNG BĂNG (K10). Lát sống thì
   * theo định nghĩa không thuộc tháng nào — hũ sửa tháng 12 vẫn là cùng một cái hũ
   * tạo tháng 8 — nên áp luật ấy lên nó là cấm người dùng sửa hũ, chứ không bảo vệ gì.
   * Mọi câu SQL phía dưới (xoay ba thế hệ, UNIQUE, đọc, xoá) chạy y hệt, không biết
   * và không cần biết dòng này khác gì.
   */
  if (thang !== LAT_SONG_THANG) {
    const song = await thangSongCuaUser(client, userId);
    if (thang !== song) return { ghi: false, ver: 0, lyDoTuChoi: 'thang_khong_song' };
  }

  const hienTai = await client.query(
    `SELECT ver FROM pfm_luu WHERE user_id = $1 AND thang = $2 AND the_he = 1 FOR UPDATE`,
    [userId, thang]);
  const verHienTai = (hienTai.rows[0]?.ver as number | undefined) ?? 0;
  if (verClient !== verHienTai) {
    return { ghi: false, ver: verHienTai, lyDoTuChoi: 'ver_cu' };
  }

  const verMoi = verHienTai + 1;
  await client.query(
    `DELETE FROM pfm_luu WHERE user_id = $1 AND thang = $2 AND the_he = 3`, [userId, thang]);
  await client.query(
    `UPDATE pfm_luu SET the_he = 3 WHERE user_id = $1 AND thang = $2 AND the_he = 2`,
    [userId, thang]);
  await client.query(
    `UPDATE pfm_luu SET the_he = 2 WHERE user_id = $1 AND thang = $2 AND the_he = 1`,
    [userId, thang]);
  await client.query(
    `INSERT INTO pfm_luu (user_id, thang, the_he, blob, schema_v, ver)
     VALUES ($1, $2, 1, $3, $4, $5)`,
    [userId, thang, blob, schemaV, verMoi]);

  return { ghi: true, ver: verMoi };
}

/** Lý do một cú ghi CHẮC CHẮN hỏng, biết được mà không cần mở transaction. */
export type LyDoSoiTruoc = 'thang_khong_song' | 'ver_cu';

/**
 * ⭐ SOI TRƯỚC KHI TIÊU SUẤT (R3) — chỉ ĐỌC, không khoá, không transaction.
 *
 * ⚠⚠ VÌ SAO CẦN: đường `/pfm/luu` gọi `consumeLimit` TRƯỚC `ghiLatThang`, mà hai lý
 * do từ chối phổ biến nhất (`ver_cu`, `thang_khong_song`) chỉ lộ ra BÊN TRONG
 * transaction. Trần sao lưu là **2 lần/ngày**, nên một client lệch bản đốt sạch suất
 * của cả ngày cho hai cú chắc chắn 409 — rồi cú thứ ba, cú ĐÚNG, ăn 429. Người dùng
 * mất sao lưu cả ngày vì một lỗi mà server biết trước từ mili-giây đầu tiên.
 * ⇒ Suất phải tiêu cho việc ĐÃ LÀM, không cho việc chắc chắn không làm được.
 *
 * ⚠⚠ ĐÂY LÀ CỬA SỚM, KHÔNG PHẢI CỬA THẬT — ĐỪNG XOÁ KIỂM TRONG `ghiLatThang`.
 * Nó đọc không khoá nên có khe: `ver` đổi giữa lúc soi và lúc ghi thì bản soi nói
 * "ổn" mà bản ghi vẫn phải từ chối. `FOR UPDATE` bên trong mới là thứ giữ đúng đắn;
 * hàm này chỉ giữ TIỀN SUẤT. Bỏ một trong hai là hỏng một trong hai thứ khác nhau.
 */
export async function soiTruocKhiGhi(
  db: pg.Pool | pg.PoolClient, userId: string, thang: string, verClient: number,
): Promise<{ ok: true } | { ok: false; lyDo: LyDoSoiTruoc; ver: number }> {
  const { rows } = await db.query(
    `SELECT to_char(date_trunc('month', now() AT TIME ZONE u.mui_gio), 'YYYY-MM-DD') AS song,
            (SELECT p.ver FROM pfm_luu p
              WHERE p.user_id = u.user_id AND p.thang = $2 AND p.the_he = 1) AS ver
       FROM users u WHERE u.user_id = $1`, [userId, thang]);
  if (!rows[0]) throw new Error('không thấy user');
  if (thang !== LAT_SONG_THANG && thang !== (rows[0].song as string)) {
    return { ok: false, lyDo: 'thang_khong_song', ver: 0 };
  }
  const ver = (rows[0].ver as number | null) ?? 0;
  return verClient === ver ? { ok: true } : { ok: false, lyDo: 'ver_cu', ver };
}

export interface LatThang {
  blob: Buffer;
  schemaV: number;
  ver: number;
}

/** Đọc một lát — mặc định thế hệ mới nhất (`the_he = 1`). Không mở transaction. */
export async function docLatThang(
  db: pg.Pool | pg.PoolClient, userId: string, thang: string, theHe = 1,
): Promise<LatThang | null> {
  const { rows } = await db.query(
    `SELECT blob, schema_v, ver FROM pfm_luu
      WHERE user_id = $1 AND thang = $2 AND the_he = $3`,
    [userId, thang, theHe]);
  if (!rows[0]) return null;
  return {
    blob: rows[0].blob as Buffer,
    schemaV: rows[0].schema_v as number,
    ver: rows[0].ver as number,
  };
}
