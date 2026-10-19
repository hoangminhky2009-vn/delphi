/**
 * GHÉP TÍN HIỆU GAME VÀO ĐẶC TRƯNG PFM THEO KỲ (D324) — dưới cửa `noi_game`.
 *
 * Cửa `noi_game` đã có trên prod từ D295 với văn bản *"Không gửi thêm gì. Đây là cho phép
 * ghép nhãn sổ đã gộp với thẻ tính cách của bạn trong nghiên cứu"* — nhưng tới 13/09 không
 * đường nào đọc nó (quyền được ghi, chưa được dùng). Đây là người đọc đầu tiên, và nó giữ
 * đúng câu đã hứa: KHÔNG có dữ liệu mới nào rời máy người dùng — mọi số dưới đây tính từ
 * `hanh_vi_vong`, thứ server vốn đã giữ (nước đi trong trận), và chỉ được GHÉP vào cùng kỳ
 * với gói đặc trưng sổ khi người dùng đã bật cửa.
 *
 * ⚠ ĐỌC BẢNG PHÁI SINH NHƯ ĐANG CÓ, KHÔNG LÀM TƯƠI TẠI CHỖ. `capNhatCuaUser` có thể replay
 * hàng chục trận; chạy nó trong transaction đồng bộ là giữ một kết nối pool suốt lúc ấy
 * (`gioi-han-ha-tang §3①`: kết nối gãy trước CPU). Bảng được làm tươi mỗi khi người chơi mở
 * `/me/tinh-cach`, `/me/nang-luc`, `/autopsy` và bởi tick nền — tín hiệu của kỳ "tính tới
 * lần làm tươi gần nhất" là đủ cho một chỉ số theo tháng.
 *
 * ⚠ RANH KỲ THEO `users.mui_gio`, KHÔNG THEO MÚI GIỜ CỦA PHIÊN DB (sửa D364).
 *
 * Bản đầu so `ts` (timestamptz) với `('YYYY-MM' || '-01')::date` trần. Một phép so như thế
 * KHÔNG có múi giờ của riêng nó: Postgres nâng `date` lên timestamptz bằng múi giờ PHIÊN.
 * Trên Supabase phiên là UTC ⇒ tháng thật sự bắt đầu lúc **07:00 sáng VN ngày mùng 1**, nên
 * các vòng chơi từ 00:00 tới 07:00 ngày mùng 1 rơi vào kỳ THÁNG TRƯỚC. Còn trên máy test,
 * phiên là +07 nên ranh lại đúng 00:00 VN — tức bài test đang kiểm một hành vi mà prod
 * không có, và không có gì đỏ. (Chi tiết lớp lỗi: `npm run lint:mui-gio`.)
 *
 * Nay ranh bám đúng thứ mà phần còn lại của PFM bám: tháng sống của người dùng
 * (`thangSongCuaUser` = `date_trunc('month', now() AT TIME ZONE u.mui_gio)`). Hai vế của
 * cùng một con số phải cùng một cái đồng hồ.
 */
import type pg from 'pg';
import { napGoiDacTrung } from './dac_trung.js';
import { tinhTinHieu, dongGameCuaKy, type DongTinHieu } from '../hanh_vi/tin_hieu.js';

/** Dòng hành vi của user trong kỳ `YYYY-MM` — một câu, chỉ các cột tín hiệu cần. */
async function docDongKy(client: pg.PoolClient, userId: string, ky: string): Promise<DongTinHieu[]> {
  const { rows } = await client.query(
    `SELECT match_id, vong, ts, lenh_json, pnl_bp, brier, mo_bang, o_su_kien, la_tin_gia,
            chuoi_tang, tu_dong, tien_mat_bp, so_ma, so_o, vai, thay_o_do,
            tiet_kiem_bp, tk_huy_so, tran_xong, man_tap, nghi_may
       FROM hanh_vi_vong
      WHERE user_id = $1
        AND ts >= ((($2 || '-01')::date)::timestamp
                    AT TIME ZONE (SELECT mui_gio FROM users WHERE user_id = $1))
        AND ts <  ((($2 || '-01')::date + interval '1 month')::timestamp
                    AT TIME ZONE (SELECT mui_gio FROM users WHERE user_id = $1))
      ORDER BY ts ASC, vong ASC`,
    [userId, ky]);
  return rows.map((h) => ({
    match_id: String(h.match_id),
    lenh: Array.isArray(h.lenh_json) ? h.lenh_json : [],
    pnl_bp: h.pnl_bp == null ? null : Number(h.pnl_bp),
    brier: h.brier == null ? null : Number(h.brier),
    mo_bang: h.mo_bang === true,
    o_su_kien: h.o_su_kien === true,
    la_tin_gia: h.la_tin_gia === true,
    chuoi_tang: h.chuoi_tang === true,
    tu_dong: h.tu_dong === true,
    tien_mat_bp: h.tien_mat_bp == null ? null : Number(h.tien_mat_bp),
    so_ma: h.so_ma == null ? null : Number(h.so_ma),
    so_o: h.so_o == null ? null : Number(h.so_o),
    vai: (h.vai ?? null) as string | null,
    thay_o_do: (h.thay_o_do ?? null) as 'phan_than' | 'be_chuoi' | null,
    tiet_kiem_bp: h.tiet_kiem_bp == null ? null : Number(h.tiet_kiem_bp),
    tk_huy_so: h.tk_huy_so == null ? null : Number(h.tk_huy_so),
    tran_xong: h.tran_xong === true,
    man_tap: h.man_tap === true,
    nghi_may: h.nghi_may === true,
  }));
}

/**
 * Ghi năm mã `gm_*` của kỳ `ky` (`YYYY-MM`) cho user. PHẢI gọi trong transaction của người
 * gọi, và CHỈ khi cửa `noi_game` đang mở — hàm này không tự hỏi cửa (người gọi đã giữ đúng
 * transaction đọc cửa; hỏi lại ở đây là hai nguồn cho một quyết định).
 */
export async function napTinHieuGameKy(
  client: pg.PoolClient, userId: string, ky: string, thangSong?: string,
): Promise<number> {
  const t = tinhTinHieu(await docDongKy(client, userId, ky));
  const dong = dongGameCuaKy(t).map((d) => ({ ...d, nguon: 'xac_minh' as const }));
  const kq = await napGoiDacTrung(client, userId, ky, dong, thangSong, true);
  return kq.soDong;
}
