/**
 * PFM — NHẬN ĐẶC TRƯNG 4 LỚP (server, K14/T7.1) — cửa MỘT CHIỀU (P2 🔒).
 *
 * ⚠⚠ Registry-driven: mọi `ma`/`lop`/giá trị được kiểm lại NGAY CỬA bằng chính sổ
 * đăng ký `config/pfm_dac_trung.ts` (`laMaHopLe`/`kiemGiaTri`) — KHÔNG viết lại hai
 * hàm đó, chỉ THÊM hai kiểm T7.1 còn thiếu ở chúng: khớp `lop` đúng khai báo của
 * `ma`, và `doi_tuong` bắt buộc/cấm đúng cờ `theo_doi_tuong`.
 *
 * ⚠ KHÔNG NHẬN LỚP `intervention` Ở ĐÂY. Bốn `ma` họ `iv_*` (phễu 5 nấc T7.5) là dữ
 * liệu VẬN HÀNH (eligible/assigned/exposed/…) — theo đúng ranh A9 ("có tiền/niềm tin
 * ⇒ events; không ⇒ telemetry"), chúng phải cuộn lên từ `telemetry` bằng một job
 * server-side riêng (mô phỏng `server/telemetry_cuon.ts`), KHÔNG phải thứ client tự
 * gửi lên như context/intent/behavior/outcome. Job đó là việc của một giai đoạn sau
 * — client gửi `ma` lớp `intervention` ở đây bị từ chối, không âm thầm chấp nhận.
 *
 * ⚠⚠ `ky`: CLIENT NÊU TÊN NGĂN, SERVER GIỮ ĐỒNG HỒ (R7, D251 — sửa quyết định cũ).
 * Bản đầu để server tự tính `ky` = tháng đang sống, "không nhận từ client", đúng khuôn
 * `homNayCuaUser`. Nguyên tắc ấy ĐÚNG và vẫn còn đây — nhưng áp vào chỗ này thì hỏng
 * một chuyện khác: gói đặc trưng của tháng 8 nằm trong hàng đợi qua đêm giao thừa
 * tháng, gửi đi sáng 01/09, sẽ được **đóng dấu tháng 9**. Hành vi tháng 8 ghi thành
 * hành vi tháng 9, im lặng, trong bảng làm nền cho mọi phân tích dọc thời gian. Cái
 * "an toàn" của việc không tin client hoá ra là một cách hỏng dữ liệu chắc chắn hơn.
 * ⇒ Lối ra KHÔNG phải là tin client: client **nêu tên ngăn** (`ky`), còn **cửa sổ hợp
 * lệ vẫn do server tính** (`cuaSoKy`) — tháng đang sống hoặc liền trước, không hơn.
 * Client không đặt được đồng hồ; nó chỉ được chọn giữa hai ngăn server đã mở sẵn.
 * ⇒ Luật rút ra: *"không nhận từ client"* là câu trả lời đúng cho **THỜI ĐIỂM**, không
 * phải cho **THỜI ĐIỂM MÀ DỮ LIỆU NÓI VỀ**. Hai câu hỏi khác nhau.
 */
import type pg from 'pg';
import { PFM } from '../../config/pfm.js';
import {
  SO_DANG_KY, laMaHopLe, kiemGiaTri, SCHEMA_VERSION, type MaDacTrung, type DinhNghiaDacTrung,
} from '../../config/pfm_dac_trung.js';
import { thangSongCuaUser } from './ket.js';

export interface DongDacTrungVao {
  ma: string;
  /** '' (hoặc vắng) khi đặc trưng gắn cả kỳ, không gắn một hũ/luật cụ thể. */
  doi_tuong?: string;
  gia_tri: unknown;
  nguon?: 'tu_khai' | 'xac_minh';
}

export interface KetQuaNapDacTrung {
  ky: string;
  soDong: number;
}

/** Lý do từ chối — đi thẳng vào 400, người viết client biết sai CHỖ NÀO, không đoán. */
export class DacTrungKhongHopLe extends Error {}

/**
 * THUẦN — hai ngăn `ky` được phép ghi, tính từ tháng ĐANG SỐNG (`'YYYY-MM-01'`).
 *
 * ⚠ Vì sao đúng HAI, không phải "vài tháng cho chắc": cửa sổ này là thứ chặn một
 * client (hoặc một máy sai giờ) ghi đè lên các kỳ đã đóng — mà kỳ đã đóng chính là
 * thứ mọi phân tích dọc thời gian dựa vào. Một tháng lùi đủ cho ca thật duy nhất đã
 * biết: gói nằm trong hàng đợi qua đêm giao thừa tháng. Máy offline lâu hơn thế thì
 * gói của nó bị BỎ có lý do rõ ràng, chứ không âm thầm rơi vào tháng sai.
 */
export function cuaSoKy(thangSong: string): readonly [string, string] {
  const y = Number(thangSong.slice(0, 4));
  const m = Number(thangSong.slice(5, 7));
  const truoc = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
  return [truoc, thangSong];
}

/**
 * Kiểm MỘT dòng theo registry — trả lý do (string) nếu sai, `null` nếu hợp lệ.
 * Tách riêng khỏi `napGoiDacTrung` để test được từng nhánh mà không cần DB thật.
 */
export function kiemDongDacTrung(d: DongDacTrungVao, tuServer = false): string | null {
  // Vào từ HTTP (unknown thật sự) nên chống cả trường hợp phần tử không phải object.
  if (typeof d !== 'object' || d === null) return 'mỗi dòng phải là object';
  if (typeof d.ma !== 'string' || !laMaHopLe(d.ma)) return `mã lạ: ${d.ma}`;
  const ma = d.ma as MaDacTrung;
  // `satisfies` giữ nguyên KIỂU HẸP (literal) của từng mục — ép về kiểu union khai
  // báo `DinhNghiaDacTrung` để đọc được `theo_doi_tuong` (optional) trên MỌI nhánh.
  const dinh = SO_DANG_KY[ma] as DinhNghiaDacTrung;

  /*
   * D324 — mã `chi_server` (năm mã GAME) chỉ đi đường `tuServer`. Mặc định `false` là CỐ Ý:
   * mọi đường gọi cũ (cửa đồng bộ của client) tự động bị chặn mà không phải sửa chỗ nào.
   */
  if (dinh.chi_server && !tuServer) {
    return `${ma}: mã do server tính, client không gửi`;
  }

  // KHÔNG NHẬN LỚP intervention ở cửa client — xem docstring đầu file.
  if (dinh.lop === 'intervention') {
    return `${ma}: lớp intervention không nhận qua cửa client (cuộn từ telemetry, job riêng)`;
  }

  const doiTuong = d.doi_tuong ?? '';
  if (dinh.theo_doi_tuong && doiTuong === '') {
    return `${ma}: bắt buộc doi_tuong (đặc trưng gắn theo hũ/luật)`;
  }
  if (!dinh.theo_doi_tuong && doiTuong !== '') {
    return `${ma}: không nhận doi_tuong (đặc trưng gắn cả kỳ)`;
  }
  /*
   * ⚠ `doi_tuong` là ô CHỮ TỰ DO duy nhất còn hở đi vào `pfm_dac_trung`: cột không có
   * CHECK độ dài, và hai câu trên chỉ hỏi rỗng-hay-không-rỗng. Nó là một ID, nên chặn
   * đúng như mọi id khác trong miền PFM.
   */
  if (doiTuong.length > PFM.DOI_TUONG_TOI_DA) {
    return `${ma}: doi_tuong dài ${doiTuong.length} ký tự (trần ${PFM.DOI_TUONG_TOI_DA})`;
  }

  const loiGiaTri = kiemGiaTri(ma, d.gia_tri);
  if (loiGiaTri) return loiGiaTri;

  if (d.nguon !== undefined && d.nguon !== 'tu_khai' && d.nguon !== 'xac_minh') {
    return `${ma}: nguon phải là tu_khai hoặc xac_minh`;
  }
  return null;
}

/**
 * NẠP một gói đặc trưng — UPSERT đúng khoá `(user_id, ky, lop, ma, doi_tuong)`.
 *
 * ⚠ UPSERT, KHÔNG xoá-rồi-chèn cả kỳ: khớp tinh thần P17 ("tầng đo chỉ ghi thêm
 * theo kỳ") và đúng khuôn "nâng cấp một chiều" `pfm_ngay` đã dùng — client gửi lại
 * `ky` hiện tại (vd. sau khi user sửa một khoản) thì GHI ĐÈ đúng slot đó, các
 * `ma`/`doi_tuong` khác trong cùng kỳ không bị đụng. Biết trước một khe hở nhỏ:
 * `doi_tuong` của một hũ đã xoá có thể còn nằm lại nếu lần gửi sau không nhắc tới
 * nó nữa (không tự dọn) — chấp nhận, không phải vi phạm P2/P6/P9 nào.
 *
 * ⚠ PHẢI GỌI TRONG TRANSACTION CỦA NGƯỜI GỌI (cùng khuôn mọi hàm nghiệp vụ PFM khác).
 */
export async function napGoiDacTrung(
  client: pg.PoolClient, userId: string, kyVao: string, dong: readonly DongDacTrungVao[],
  thangSong?: string,
  /** D324 — CHỈ `napTinHieuGameKy` truyền `true`; xem `kiemDongDacTrung`. */
  tuServer = false,
): Promise<KetQuaNapDacTrung> {
  for (const d of dong) {
    const loi = kiemDongDacTrung(d, tuServer);
    if (loi) throw new DacTrungKhongHopLe(loi);
  }

  // R7 — client nêu ngăn, server soi ngăn ấy có đang mở không. Chạy TRƯỚC lối ra
  // rỗng: một gói rỗng gắn kỳ sai vẫn là một client sai giờ, và im lặng cho qua là
  // bỏ mất tín hiệu duy nhất về chuyện đó.
  // ⚠ `thangSong` truyền vào là để KHỎI hỏi lại DB cho từng gói trong một lô (đo D256:
  // câu này chiếm 1 vòng SQL mỗi gói). Không truyền thì tự hỏi — chữ ký cũ vẫn chạy.
  const song = thangSong ?? await thangSongCuaUser(client, userId);
  const ky = `${kyVao}-01`;
  const cho = cuaSoKy(song);
  if (!cho.includes(ky)) {
    throw new DacTrungKhongHopLe(
      `kỳ ${kyVao} ngoài cửa sổ cho phép (chỉ ${cho[0].slice(0, 7)} hoặc ${cho[1].slice(0, 7)})`);
  }

  if (dong.length === 0) return { ky, soDong: 0 };

  // Trần TRẦN_DOI_TUONG_KY tính trên TỔNG doi_tuong khác nhau sau khi gộp — không
  // chỉ trên gói vừa gửi, vì trần là về TRẠNG THÁI cuối kỳ, không phải về một lần gửi.
  const doiTuongMoi = new Set(dong.map((d) => d.doi_tuong ?? '').filter((x) => x !== ''));
  if (doiTuongMoi.size > 0) {
    const daCo = await client.query(
      `SELECT DISTINCT doi_tuong FROM pfm_dac_trung
        WHERE user_id = $1 AND ky = $2 AND doi_tuong <> ''`,
      [userId, ky]);
    const tongHop = new Set<string>(daCo.rows.map((r) => r.doi_tuong as string));
    for (const dt of doiTuongMoi) tongHop.add(dt);
    if (tongHop.size > PFM.TRAN_DOI_TUONG_KY) {
      throw new DacTrungKhongHopLe(
        `vượt trần ${PFM.TRAN_DOI_TUONG_KY} đối tượng/kỳ (đang có ${tongHop.size})`);
    }
  }

  /*
   * ⭐ MỘT CÂU INSERT CHO CẢ GÓI (D256) — trước đây mỗi dòng một câu.
   *
   * ⚠ Vì sao đáng đổi: một gói chở tới `PFM_LO.DONG_MOI_GOI` dòng, và cả lô nằm trong
   * MỘT transaction giữ một trong năm kết nối pool. 300 vòng đi-về × RTT Singapore là
   * hàng giây giữ kết nối — `gioi-han-ha-tang §3①` nói thẳng kết nối gãy trước CPU.
   *
   * ⚠⚠ PHẢI KHỬ TRÙNG KHOÁ TRƯỚC, và đây là chỗ bản gộp KHÁC bản vòng lặp: Postgres
   * ném `ON CONFLICT DO UPDATE command cannot affect row a second time` nếu HAI dòng
   * nguồn trong CÙNG câu lệnh cùng đụng một khoá. Vòng lặp cũ thì không sao — dòng sau
   * ghi đè dòng trước qua hai câu riêng. Nên ở đây giữ **dòng CUỐI** cho mỗi khoá, đúng
   * bằng kết quả vòng lặp cũ để lại. Bỏ bước này là đổi một gói hợp lệ thành lỗi 500.
   */
  const theoKhoa = new Map<string, DongDacTrungVao>();
  for (const d of dong) {
    const dinh = SO_DANG_KY[d.ma as MaDacTrung];
    theoKhoa.set(`${dinh.lop}\u0000${d.ma}\u0000${d.doi_tuong ?? ''}`, d);
  }
  const rut = [...theoKhoa.values()];

  await client.query(
    `INSERT INTO pfm_dac_trung (user_id, ky, lop, ma, doi_tuong, gia_tri, nguon, schema_version)
     SELECT $1, $2, t.lop, t.ma, t.doi_tuong, t.gia_tri::jsonb, t.nguon, $3
       FROM unnest($4::text[], $5::text[], $6::text[], $7::text[], $8::text[])
            AS t(lop, ma, doi_tuong, gia_tri, nguon)
     ON CONFLICT (user_id, ky, lop, ma, doi_tuong)
     DO UPDATE SET gia_tri = EXCLUDED.gia_tri, nguon = EXCLUDED.nguon,
                    schema_version = EXCLUDED.schema_version, cap_nhat_luc = now()`,
    [
      userId, ky,
      // ⚠ schema_version LƯU nhưng KHÔNG dùng để chọn nhánh validate — server chỉ biết
      // kiểm theo registry HIỆN TẠI (T7.2); cột này là bookkeeping cho phân tích dọc
      // thời gian sau này, không phải một cổng đa-phiên-bản đang sống.
      SCHEMA_VERSION,
      rut.map((d) => SO_DANG_KY[d.ma as MaDacTrung].lop),
      rut.map((d) => d.ma),
      rut.map((d) => d.doi_tuong ?? ''),
      rut.map((d) => JSON.stringify(d.gia_tri)),
      rut.map((d) => d.nguon ?? 'tu_khai'),
    ],
  );

  return { ky, soDong: dong.length };
}
