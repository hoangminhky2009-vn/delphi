/**
 * PFM — ĐIỂM DANH & CHUỖI NGÀY (nhóm D của khung chức năng; K7 kiến trúc).
 *
 * ⚠⚠ BẢNG NÀY KHÔNG CÓ MỘT SỐ TIỀN NÀO, VÀ ĐÓ LÀ CẢ THIẾT KẾ (K3). Máy trả thưởng
 * chỉ đọc được `pfm_ngay`/`pfm_tuan` ⇒ nó KHÔNG CÓ GÌ ĐỂ ĐỌC nếu ai đó muốn thưởng
 * theo số tiền. P5 và P6 🔒 vì thế đúng BẰNG CẤU TRÚC chứ không bằng kỷ luật.
 *
 * ⚠ "HÔM NAY" DO SERVER TÍNH, theo `users.mui_gio` — không bao giờ tin ngày do client
 * gửi lên (C4, và K7 đã tuyên đồng hồ máy user là thứ không tin được). Cột `mui_gio`
 * mặc định giờ VN nên hôm nay hành vi y hệt bản không có cột (K15).
 */
import type pg from 'pg';
import { PFM } from '../../config/pfm.js';

export type TrangThaiNgay = 'tron' | 'khong_tieu' | 'tieu_it' | 'co_ghi';

/**
 * BẬC THÔNG TIN của từng trạng thái — quyết định cú nâng cấp nào hợp lệ.
 *
 * ⚠ `khong_tieu` và `tieu_it` CÙNG BẬC vì cả hai đều là "user chủ động khai một điều
 * về tiền", chỉ khác nội dung. Đổi giữa hai cái là user TỰ SỬA LỜI KHAI của chính
 * mình trong ngày — hợp lệ (P1: sổ là của user), và bản thân cú sửa được ghi lại như
 * một chuyển tiếp (P17: tầng đo ghi THÊM, không ghi đè).
 *
 * ⚠ KHÔNG BAO GIỜ TỤT VỀ `tron`. Trơn nghĩa là "chưa nói gì"; đã nói rồi thì không
 * quay lại chưa-nói-gì được — đó là xoá bằng chứng, không phải sửa.
 */
const BAC: Record<TrangThaiNgay, number> = {
  tron: 0, khong_tieu: 1, tieu_it: 1, co_ghi: 2,
};

/** Có được đi từ trạng thái `cu` sang `moi` không. */
export function napCapDuoc(cu: TrangThaiNgay | null, moi: TrangThaiNgay): boolean {
  if (cu === null) return true;
  if (moi === 'tron') return cu === 'tron';   // không tụt về "chưa nói gì"
  return BAC[moi] >= BAC[cu];
}

export interface KetQuaChuoi {
  /** Số ngày CÓ MẶT trong mạch liên tục (ngày được bảo hiểm tha KHÔNG tính là có mặt). */
  chuoi: number;
  /** Đã dùng mấy suất bảo hiểm trong mạch — để UI nói "còn 0 suất tuần này". */
  daDungBaoHiem: number;
  /** Hôm nay đã điểm danh chưa (quyết định UI mời hay không). */
  homNayXong: boolean;
}

/**
 * TÍNH CHUỖI — hàm THUẦN, tính LÚC ĐỌC.
 *
 * ⚠ KHÔNG LƯU SỐ CHUỖI Ở ĐÂU. Một con số chuỗi lưu sẵn là bản cài đặt thứ hai của
 * cùng một sự thật, và bản thứ hai SẼ trôi (D61) — biểu hiện sẽ là "app nói chuỗi 12
 * mà lịch chỉ có 9 ngày sáng".
 *
 * ⚠ HÔM NAY CHƯA ĐIỂM DANH THÌ KHÔNG PHẢI LÀ GÃY. Bắt đầu đếm từ hôm qua nếu hôm nay
 * còn trống — nếu không thì mỗi sáng mở app ai cũng thấy chuỗi về 0 cho tới lúc bấm,
 * đúng kiểu "app n** n**" mà founder đã bác (D139).
 *
 * BẢO HIỂM (D136/Lally 2010 — lỡ một ngày không phá thói quen): mỗi 7 ngày lùi được
 * tha `PFM.BAO_HIEM_STREAK_TUAN` ngày vắng. Hết suất trong cửa sổ đó ⇒ mạch đứt.
 *
 * @param coMat tập ngày (chuỗi 'YYYY-MM-DD') CÓ dòng điểm danh
 * @param homNay ngày hôm nay theo múi giờ user, dạng 'YYYY-MM-DD'
 */
export function tinhChuoi(coMat: ReadonlySet<string>, homNay: string): KetQuaChuoi {
  const homNayXong = coMat.has(homNay);
  const moc = Date.parse(`${homNay}T00:00:00Z`);
  if (Number.isNaN(moc)) throw new Error(`ngày không hợp lệ: ${homNay}`);

  let chuoi = 0;
  let daDungBaoHiem = 0;
  let baoHiemCon = PFM.BAO_HIEM_STREAK_TUAN;
  let daDi = 0;
  /*
   * ⚠ SUẤT BẢO HIỂM CHỈ ĐƯỢC TÍNH LÀ "ĐÃ DÙNG" KHI NÓ THẬT SỰ BẮC CẦU.
   *
   * Bản đầu cộng ngay lúc gặp ngày vắng, và vector chép tay bắt được: mạch 3 ngày
   * liền tù tì vẫn báo "đã dùng 1 suất" — vì ngày TRƯỚC khi mạch bắt đầu cũng là một
   * ngày vắng, và vòng lặp tiêu một suất ở đó rồi mới dừng. Tức app nói dối người
   * dùng ("bạn đã tiêu suất tha tuần này") ở đúng lúc họ không lỡ ngày nào.
   * ⇒ Giữ số suất đang treo, chỉ chốt khi gặp một ngày CÓ MẶT ở phía sau nó; suất
   * treo ở RÌA mạch thì bỏ, vì nó không bắc cầu cho cái gì cả.
   */
  let treo = 0;

  // Bắt đầu từ hôm nay nếu đã xong, không thì từ hôm qua.
  const batDau = homNayXong ? 0 : 1;
  // Trần vòng lặp: mạch dài nhất có nghĩa với một mùa; cũng là lưới an toàn.
  for (let i = batDau; i < 400; i++) {
    if (daDi > 0 && daDi % 7 === 0) baoHiemCon = PFM.BAO_HIEM_STREAK_TUAN;
    const d = new Date(moc - i * 86_400_000).toISOString().slice(0, 10);
    if (coMat.has(d)) {
      chuoi++;
      daDungBaoHiem += treo;   // các suất treo vừa được xác nhận là có bắc cầu
      treo = 0;
    } else if (baoHiemCon > 0) {
      baoHiemCon--;
      treo++;
    } else {
      break;
    }
    daDi++;
  }
  return { chuoi, daDungBaoHiem, homNayXong };
}

/** Ngày hôm nay theo múi giờ CỦA USER — server tự tính, không nhận từ client. */
export async function homNayCuaUser(db: pg.Pool | pg.PoolClient, userId: string): Promise<string> {
  const { rows } = await db.query(
    `SELECT to_char((now() AT TIME ZONE u.mui_gio)::date, 'YYYY-MM-DD') AS d
       FROM users u WHERE u.user_id = $1`, [userId]);
  if (!rows[0]) throw new Error('không thấy user');
  return rows[0].d as string;
}

export interface KetQuaDiemDanh {
  ngay: string;
  trangThai: TrangThaiNgay;
  /** true nếu cú này TẠO dòng mới (ngày mới), false nếu chỉ nâng cấp trạng thái. */
  moi: boolean;
  /** true nếu cú này bị bỏ qua vì sẽ là một cú TỤT bậc. */
  boQua: boolean;
}

/**
 * GHI ĐIỂM DANH — nâng cấp một chiều, mỗi ngày một dòng.
 *
 * ⚠ PHẢI GỌI TRONG TRANSACTION CỦA NGƯỜI GỌI. Cú điểm danh có thể kèm phát token
 * (đường TIỀN) nên nó phải nguyên tử với dòng `events` và dòng sổ cái — C4/A7. Hàm
 * này cố ý KHÔNG tự mở transaction để người gọi không thể vô tình tách chúng ra.
 */
export async function ghiDiemDanh(
  client: pg.PoolClient, userId: string, trangThai: TrangThaiNgay,
): Promise<KetQuaDiemDanh> {
  const ngay = await homNayCuaUser(client, userId);

  const cu = await client.query(
    `SELECT trang_thai FROM pfm_ngay WHERE user_id = $1 AND ngay = $2 FOR UPDATE`,
    [userId, ngay]);
  const truoc = (cu.rows[0]?.trang_thai ?? null) as TrangThaiNgay | null;

  if (truoc !== null && !napCapDuoc(truoc, trangThai)) {
    return { ngay, trangThai: truoc, moi: false, boQua: true };
  }
  if (truoc === null) {
    await client.query(
      `INSERT INTO pfm_ngay (user_id, ngay, trang_thai) VALUES ($1, $2, $3)`,
      [userId, ngay, trangThai]);
    return { ngay, trangThai, moi: true, boQua: false };
  }
  if (truoc !== trangThai) {
    await client.query(
      `UPDATE pfm_ngay SET trang_thai = $3 WHERE user_id = $1 AND ngay = $2`,
      [userId, ngay, trangThai]);
  }
  return { ngay, trangThai, moi: false, boQua: false };
}

/** Đọc chuỗi hiện tại — gộp một lượt truy vấn, dùng cho payload mở app (K11). */
/**
 * THUẦN — đếm ngày CÓ MẶT trong một tháng, từ chính tập ngày `docChuoi` đã nạp.
 *
 * ⚠ Cố ý KHÔNG thêm câu SQL thứ hai. `docChuoi` đã kéo về mọi ngày có mặt trong 400
 * ngày gần nhất để tính mạch; tháng này là một tập con của nó. Thêm một `count(*)`
 * nữa là trả tiền hai lần cho cùng một sự thật, trên đường nóng `/me` (pool 5 kết
 * nối, C1) — và mở đường cho hai con số lệch nhau khi một bên đổi trần quét.
 */
export function demNgayTrongThang(coMat: ReadonlySet<string>, thang: string): number {
  let n = 0;
  for (const d of coMat) if (d.startsWith(thang)) n++;
  return n;
}

export async function docChuoi(
  db: pg.Pool | pg.PoolClient, userId: string,
): Promise<KetQuaChuoi & { ngay: string; soNgayThangNay: number }> {
  const ngay = await homNayCuaUser(db, userId);
  /*
   * ⚠ CÓ TRẦN PHẠM VI QUÉT. Đọc cả đời sổ mỗi lần mở app là thứ sẽ nặng dần theo
   * tuổi tài khoản — mà mạch dài nhất có nghĩa cũng chỉ vài trăm ngày. Trần 400 ngày
   * khớp đúng trần vòng lặp của `tinhChuoi`, nên hai chỗ không thể lệch nhau.
   */
  const { rows } = await db.query(
    `SELECT to_char(ngay, 'YYYY-MM-DD') AS d FROM pfm_ngay
      WHERE user_id = $1 AND ngay > (now() AT TIME ZONE
            (SELECT mui_gio FROM users WHERE user_id = $1))::date - 400`,
    [userId]);
  const coMat = new Set<string>(rows.map((r) => r.d as string));
  return {
    ...tinhChuoi(coMat, ngay), ngay,
    soNgayThangNay: demNgayTrongThang(coMat, ngay.slice(0, 7)),
  };
}
