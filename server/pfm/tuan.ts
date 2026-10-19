/**
 * PFM — NIÊM PHONG TUẦN (nghi lễ Chủ nhật, K7) + PHÁN QUYẾT TOKEN.
 *
 * ⚠⚠ P6 🔒 SOI Ở ĐÂY: hàm này chỉ được đọc `pfm_ngay`/`pfm_tuan`/`events` — CẤM đọc
 * `pfm_dac_trung`, `pfm_luu`, hay bất kỳ trường `tu_khai` nào. Máy trả thưởng KHÔNG
 * CÓ GÌ ĐỂ ĐỌC nếu muốn thưởng theo tiền hay theo nội dung tự khai — P5/P6 vì thế
 * đúng BẰNG CẤU TRÚC. `tests/pfm_nen.test.ts` §VIII quét nguồn file này để canh.
 *
 * ⚠ CÔNG THỨC PHÁT TOKEN Ở ĐÂY LÀ PLACEHOLDER TỐI GIẢN (A8.2 — agent không tự đặt
 * tham số kinh tế; founder phiên này chỉ đạo "để số kinh tế đó, tối ưu công năng
 * trước"). Chỉ tính theo SỐ NGÀY CÓ MẶT trong tuần — chưa cộng thưởng theo tỷ lệ
 * giữ-luật, vì `luat.ts` (GĐ6) chưa tồn tại nên chưa có dòng `pfm_luat` nào để đọc;
 * thêm nhánh đó khi luat.ts ra `events` thật, đừng viết logic đọc một nguồn rỗng.
 */
import type pg from 'pg';
import { PFM } from '../../config/pfm.js';
import { capToken } from './token.js';
import { homNayCuaUser } from './ngay.js';

/**
 * ⭐ THUẦN — từ ngày local của user ra thứ Hai của tuần ĐƯỢC PHÉP niêm phong.
 *
 * ⚠⚠ NIÊM PHONG TUẦN GẦN NHẤT **ĐÃ KẾT THÚC**, không phải tuần đang chạy (founder
 * chốt 04/09). Bản trước niêm phong tuần HIỆN TẠI, và đó là một lỗi có hình dạng rất
 * dễ bỏ qua: thứ Ba mà "chốt tuần" thì đang chốt một tuần còn năm ngày nữa mới xong —
 * số ngày có mặt đếm được luôn thấp hơn sự thật, và vì `pfm_tuan` có UNIQUE
 * `(user_id, tuan)` nên **niêm phong sớm khoá luôn tuần đó**: năm ngày còn lại không
 * bao giờ được tính. Một nghi lễ mà làm mất dữ liệu của chính người làm nó.
 *
 * Luật: **Chủ nhật ⇒ tuần này** (hôm nay chính là ngày cuối của nó) · **T2–T7 ⇒ tuần
 * trước**. Tuần ISO bắt đầu THỨ HAI, khớp `date_trunc('week')` của Postgres.
 *
 * ⚠ Vì sao tính ở JS chứ không nối thêm SQL: cả vào lẫn ra đều là chuỗi ngày, nên
 * `Date.UTC` là phép cộng ngày thuần, không dính múi giờ (cùng lý lẽ `ngayKeTiep`).
 * Quan trọng hơn: đây là hàm THUẦN nên khoá được bằng vector chép tay cho cả bảy thứ,
 * còn một câu SQL thì chỉ test được vào đúng cái thứ mà hôm nay đang là.
 */
export function tuanNiemPhongTuNgay(ngay: string): string {
  const y = Number(ngay.slice(0, 4));
  const m = Number(ngay.slice(5, 7));
  const d = Number(ngay.slice(8, 10));
  const moc = new Date(Date.UTC(y, m - 1, d));
  const thu = moc.getUTCDay();                    // 0 = CN, 1 = T2 … 6 = T7
  const veThuHai = thu === 0 ? 6 : thu - 1;       // lùi bấy nhiêu ngày là tới T2 tuần ISO này
  const lui = thu === 0 ? veThuHai : veThuHai + 7;
  const ra = new Date(Date.UTC(y, m - 1, d - lui));
  return ra.toISOString().slice(0, 10);
}

/** Chủ nhật (ngày CUỐI) của tuần bắt đầu từ `tuan`. Thuần, cùng phép cộng ngày. */
export function ngayCuoiTuan(tuan: string): string {
  const y = Number(tuan.slice(0, 4));
  const m = Number(tuan.slice(5, 7));
  const d = Number(tuan.slice(8, 10));
  return new Date(Date.UTC(y, m - 1, d + 6)).toISOString().slice(0, 10);
}

/** Thứ Hai của tuần được phép niêm phong, theo múi giờ user — server tự tính (K7). */
export async function tuanNiemPhongCuaUser(
  db: pg.Pool | pg.PoolClient, userId: string,
): Promise<string> {
  return tuanNiemPhongTuNgay(await homNayCuaUser(db, userId));
}

/**
 * Số ngày CÓ MẶT trong tuần bắt đầu từ `tuan` (thứ Hai) — MỘT nguồn cho cả cú niêm
 * phong lẫn payload `/me`. Hai chỗ đọc cùng một con số thì không thể lệch nhau: nếu
 * `/me` nói 6 mà lúc bấm nút lại phát theo 5, người dùng thấy nghi lễ ăn gian.
 */
export async function demNgayCoMatTuan(
  db: pg.Pool | pg.PoolClient, userId: string, tuan: string,
): Promise<number> {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM pfm_ngay
      WHERE user_id = $1 AND ngay >= $2::date AND ngay < $2::date + 7`,
    [userId, tuan]);
  return rows[0].n as number;
}

export interface KetQuaNiemPhongTuan {
  tuan: string;
  /**
   * Có mặt khi cú niêm phong bị TỪ CHỐI (chưa xảy ra gì cả), khác hẳn `moi: false`
   * vốn nghĩa là "tuần này niêm phong rồi".
   */
  lyDoTuChoi?: 'chua_diem_danh_hom_nay';
  /** true = cú này THẬT SỰ niêm phong (lần đầu trong tuần); false = tuần đã niêm phong rồi. */
  moi: boolean;
  tokenThuong: number;
  /** Chỉ có khi `moi === true` — tính lại tại chỗ, không đọc từ đâu khác. */
  soNgayCoMat?: number;
}

/**
 * NIÊM PHONG tuần hiện tại — mỗi tuần đúng một lần, phán quyết token TẤT ĐỊNH.
 *
 * ⚠⚠ THỨ TỰ BẮT BUỘC: GIÀNH CHỖ (INSERT...ON CONFLICT DO NOTHING) TRƯỚC, GỌI
 * `capToken` SAU. Nếu tính token rồi mới INSERT, hai request cùng lọt qua khe hở
 * trước khi ai kịp ghi dòng `pfm_tuan` sẽ CẢ HAI gọi `capToken` thật — mỗi bên một
 * transaction riêng nên `capToken`'s `FOR UPDATE` không loại được nhau (chỉ tuần
 * tự hoá, không CHẶN cú thứ hai) ⇒ phát đúp cho một tuần. Giành chỗ trước bằng một
 * câu ghi có điều kiện (T5.4) thì bên THUA dừng ngay, không bao giờ chạm ví.
 *
 * ⚠ PHẢI GỌI TRONG TRANSACTION CỦA NGƯỜI GỌI (cùng khuôn `ghiDiemDanh`/`capToken`).
 */
export async function niemPhongTuan(
  client: pg.PoolClient, userId: string, homNayEp?: string,
): Promise<KetQuaNiemPhongTuan> {
  /*
   * ⚠⚠ ĐỌC "HÔM NAY" ĐÚNG MỘT LẦN, rồi dùng lại. Bản trước đọc HAI lần (một lần trong
   * `tuanNiemPhongCuaUser`, một lần nữa ở rào Chủ nhật) — hai lần `now()` khác nhau, nên
   * một cú niêm phong đúng lúc nửa đêm có thể tính TUẦN theo hôm qua rồi so rào theo hôm
   * nay. Hiếm, nhưng là loại sai không ai dựng lại được. Một lần đọc thì không thể lệch.
   *
   * ⚠⚠ `homNayEp` LÀ SEAM CHO TEST, KHÔNG PHẢI CỬA CHO CLIENT. K7 nói rõ: server tự tính
   * "hôm nay", **không bao giờ nhận từ client** — vì đổi giờ máy là in được token. Route
   * `/pfm/tuan` gọi hàm này với ĐÚNG HAI đối số và không có đường nào để một trường của
   * request chui vào đây; có bài canh riêng cho điều đó (`tests/pfm_api.test.ts` §VI).
   * ⇒ Vì sao cần seam: rào Chủ nhật làm hành vi phụ thuộc THỨ TRONG TUẦN, nên bộ test
   *   không có seam sẽ xanh sáu ngày và đỏ vào Chủ nhật — đúng loại "đỏ vào một ngày nào
   *   đó trong năm" mà `thoi_gian.ts` đã cảnh báo, và nó đã xảy ra thật.
   */
  const homNay = homNayEp ?? await homNayCuaUser(client, userId);
  const tuan = tuanNiemPhongTuNgay(homNay);

  /*
   * ⚠⚠ CHỦ NHẬT: TUẦN ĐƯỢC NIÊM PHONG KẾT THÚC **HÔM NAY**, TỨC NÓ CHƯA XONG.
   *
   * Founder chốt 04/09: "CN = tuần này". Đúng về nghi lễ — người ta chốt cái tuần vừa
   * sống xong. Nhưng cài thẳng thì có một lỗ: bấm niêm phong 10 giờ sáng Chủ nhật là
   * khoá tuần lại (UNIQUE `user_id, tuan`) trong khi Chủ nhật còn 14 tiếng nữa. Người
   * dùng điểm danh lúc 8 giờ tối hôm ấy thì **ngày đó không bao giờ được đếm**, và
   * token của nó mất — im lặng, không lỗi. Đúng loại mất mát mà R4 nói mình đi sửa,
   * chỉ thu nhỏ từ năm ngày xuống một ngày.
   *
   * ⇒ Nên trên chính ngày cuối ấy, chỉ cho niêm phong khi HÔM NAY ĐÃ ĐIỂM DANH. Không
   * mất gì: chưa điểm danh thì chờ tới thứ Hai, mà thứ Hai `tuanNiemPhongCuaUser` trả
   * về **đúng tuần đó** (tuần trước) — nghi lễ chỉ lùi vài tiếng, không bỏ tuần nào.
   * ⚠ Đây là RÀO, không phải đổi luật của founder: luật "CN = tuần này" giữ nguyên.
   */
  if (ngayCuoiTuan(tuan) === homNay) {
    const coHomNay = await client.query(
      `SELECT 1 FROM pfm_ngay WHERE user_id = $1 AND ngay = $2::date`,
      [userId, ngayCuoiTuan(tuan)]);
    if (!coHomNay.rows[0]) {
      return { moi: false, tuan, tokenThuong: 0, lyDoTuChoi: 'chua_diem_danh_hom_nay' };
    }
  }

  const cho = await client.query(
    `INSERT INTO pfm_tuan (user_id, tuan, token_thuong, moc_json)
     VALUES ($1, $2, 0, '[]'::jsonb)
     ON CONFLICT (user_id, tuan) DO NOTHING
     RETURNING tuan`,
    [userId, tuan]);

  if (!cho.rows[0]) {
    const daCo = await client.query(
      `SELECT token_thuong FROM pfm_tuan WHERE user_id = $1 AND tuan = $2`, [userId, tuan]);
    return { moi: false, tuan, tokenThuong: Number(daCo.rows[0].token_thuong) };
  }

  const soNgayCoMat = await demNgayCoMatTuan(client, userId, tuan);
  const tokenDuKien = Math.min(soNgayCoMat * PFM.TOKEN_MOC_VI_MO, PFM.TOKEN_TUAN_TOI_DA);

  let tokenThatSu = 0;
  if (tokenDuKien > 0) {
    const kq = await capToken(client, userId, tokenDuKien, 'phan_quyet_tuan', tuan);
    if (kq.cap) tokenThatSu = tokenDuKien;
    // kq.cap === false (chạm trần/ngày do mốc khác đã ăn hết suất hôm nay) ⇒ vẫn
    // niêm phong, chỉ token = 0 lần này. Ritual (giữ chân) và token (kinh tế) là
    // hai trục tách nhau có chủ đích (P5) — một cái bị chặn không được kéo cái kia.
  }

  if (tokenThatSu > 0) {
    await client.query(
      `UPDATE pfm_tuan SET token_thuong = $3 WHERE user_id = $1 AND tuan = $2`,
      [userId, tuan, tokenThatSu]);
  }

  return { moi: true, tuan, tokenThuong: tokenThatSu, soNgayCoMat };
}

/**
 * Trạng thái tuần ĐƯỢC PHÉP NIÊM PHONG — cho payload `/me` (K11), không mở transaction.
 *
 * ⚠ `soNgayCoMat` đi kèm ở đây chứ không để client tự đếm: client CÓ sổ local nên
 * đếm được, nhưng con số nó đếm là "ngày tôi có ghi khoản", còn con số phát token là
 * "ngày có dòng `pfm_ngay`" — hai tập khác nhau (điểm danh `tron`/`khong_tieu` không
 * cần một khoản nào). Để client đoán là hứa một số rồi phát một số khác.
 */
export async function docTrangThaiTuan(
  db: pg.Pool | pg.PoolClient, userId: string,
  /**
   * D327 — SEAM CHO TEST, cùng hạng `homNayEp` của `niemPhongTuan` (K7: route `/me` gọi với
   * ĐÚNG hai đối số). Không có nó, bài test so tuần của cú niêm phong ép `NGAY_THU` với tuần
   * của ĐỒNG HỒ THẬT — bài ấy đỏ chắc chắn từ khi đồng hồ qua tuần của `NGAY_THU` (13/09).
   */
  homNayEp?: string,
): Promise<{ tuan: string; daNiemPhong: boolean; tokenThuong: number; soNgayCoMat: number }> {
  const tuan = homNayEp !== undefined
    ? tuanNiemPhongTuNgay(homNayEp)
    : await tuanNiemPhongCuaUser(db, userId);
  const [viTri, soNgayCoMat] = await Promise.all([
    db.query(`SELECT token_thuong FROM pfm_tuan WHERE user_id = $1 AND tuan = $2`, [userId, tuan]),
    demNgayCoMatTuan(db, userId, tuan),
  ]);
  return {
    tuan, daNiemPhong: viTri.rows.length > 0, soNgayCoMat,
    tokenThuong: viTri.rows[0] ? Number(viTri.rows[0].token_thuong) : 0,
  };
}
