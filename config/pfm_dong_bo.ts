/**
 * PFM — HÌNH DÂY CỦA `POST /pfm/dong-bo` (R8, D251). MỘT NGUỒN cho cả hai đầu.
 *
 * ⚠⚠ VÌ SAO TỆP NÀY TỒN TẠI: trước D251 client gom một lô **hỗn hợp** (`goi` đặc
 * trưng + `nhip` sự kiện) trong `web/src/pfm/dong_bo.ts`, còn server chỉ có
 * `/pfm/dac-trung` nhận `{dong:[…]}` — một hình dây KHÁC, và chỉ nhận một trong hai
 * loại. Nên `pfm_hu`/`pfm_luat`/`pfm_consent` **không route nào ghi được**, và hàng
 * đợi client không có nơi để đổ. Hai đầu dây được viết riêng, mỗi bên tự nhất quán,
 * và cái sai chỉ lộ ra khi thử nối — đó là lý do hình dây phải có MỘT chỗ ở.
 *
 * ⚠ RANH GIỚI CỦA TỆP NÀY: nó kiểm **PHONG BÌ**, không kiểm nội dung.
 *   · phong bì (ở đây)  — có `id` không · `loai` có phải một trong hai · `ky` đúng
 *     dạng · `dong` có phải mảng · các trần số lượng.
 *   · nội dung (server) — `ma` có trong sổ đăng ký không (`kiemDongDacTrung`), `v`
 *     có hợp K5 không (`kiemValueJsonPfm`), `ky` có nằm trong cửa sổ cho phép không.
 * Trộn hai vai vào đây là chép sổ đăng ký sang chỗ thứ hai (A11.5/D61).
 */
import { PFM_LO } from './pfm.js';
import { kiemValueJsonPfm, clientTuGuiDuoc, NHIP_CLIENT_TU_GUI } from './pfm_events.js';

/** Một dòng đặc trưng trên DÂY — snake_case, khớp mọi route khác của API. */
export interface DongGoiLo {
  ma: string;
  gia_tri: unknown;
  /** '' (hoặc vắng) khi đặc trưng gắn cả kỳ, không gắn một hũ/luật cụ thể. */
  doi_tuong?: string;
}

/**
 * ⭐ MỌI MÓN ĐỀU CÓ `id` — NHƯNG `id` CÓ HAI VAI KHÁC NHAU THEO `loai`.
 *
 * · `nhip` — `id` là **khoá chống trùng cấp món** (`pfm_lo_da_nhan`, migration 0056).
 *   Nó phải ổn định qua các lần GỬI LẠI và **duy nhất cho mỗi sự kiện thật**. Thiếu nó
 *   thì một cú mất phản hồi làm `events` append-only có hai dòng cho một sự kiện.
 * · `goi` — `id` CHỈ là **nhãn để ghép `KetMon` về đúng món trong hàng đợi**. Server
 *   KHÔNG dùng nó chống trùng.
 *
 * ⚠⚠ VÌ SAO PHẢI TÁCH HAI VAI (bản đầu D251 gộp làm một và nó HỎNG): khoá hàng đợi của
 * một gói là `goi:<ky>` — **ổn định theo KỲ, không theo nội dung** (`khoaMon`, và có
 * test khoá chặt tính chất ấy). Gói là ẢNH CHỤP gộp của một kỳ, nên người dùng sửa sổ
 * xong thì client dựng lại ảnh chụp MỚI dưới **đúng khoá cũ**. Chống trùng theo khoá đó
 * ⇒ ảnh chụp thứ hai bị trả `trung` và bị vứt ⇒ `pfm_dac_trung` đóng băng ở bản đầu tiên
 * suốt `NHO_MON_NGAY` ngày, im lặng. Nó biến nhánh UPSERT của `napGoiDacTrung` — thứ
 * tồn tại CHÍNH XÁC để nhận bản cập nhật — thành code chết.
 * ⇒ Và chống trùng cho `goi` không bảo vệ gì cả: `goi` không chạm `events`, nó UPSERT
 * theo khoá `(user_id, ky, lop, ma, doi_tuong)` nên **đã idempotent sẵn**. Cửa chống
 * trùng dựng ra vì `events` append-only; áp nó lên chỗ không có `events` là thuần mất mát.
 */
export type MonLo =
  | { id: string; loai: 'goi'; ky: string; schema_v: number; dong: DongGoiLo[] }
  | { id: string; loai: 'nhip'; ma: string; v: Record<string, unknown> };

const RE_MON_ID = /^[A-Za-z0-9_:-]{1,64}$/;
/** Hình mã kỳ `'YYYY-MM'`. Xuất ra (D325) để cửa GHI nấc theo kỳ ở máy dùng ĐÚNG hình server kiểm. */
export const RE_KY = /^\d{4}-\d{2}$/;

/**
 * Kiểm PHONG BÌ của một món. Trả `null` nếu ổn, hoặc câu tả CHỖ SAI.
 *
 * ⚠ Lý do trả câu chữ chứ không trả boolean: lô là hỗn hợp và **món hỏng bị từ chối
 * RIÊNG, món lành vẫn ghi**. Client phải biết món nào hỏng vì SAO để (a) bỏ nó khỏi
 * hàng đợi thay vì gửi lại mãi mãi, (b) đếm được bằng `pfm_lo_loi{ma}`. Một lô trả
 * đúng chữ "400" là một hàng đợi tắc vĩnh viễn mà không ai biết vì sao.
 */
export function kiemPhongBiMon(m: unknown): string | null {
  if (typeof m !== 'object' || m === null || Array.isArray(m)) return 'món phải là object';
  const o = m as Record<string, unknown>;

  if (typeof o.id !== 'string' || !RE_MON_ID.test(o.id)) {
    return 'id phải khớp ^[A-Za-z0-9_:-]{1,64}$';
  }

  if (o.loai === 'goi') {
    if (typeof o.ky !== 'string' || !RE_KY.test(o.ky)) return 'ky phải dạng YYYY-MM';
    if (!Number.isInteger(o.schema_v) || (o.schema_v as number) < 1) {
      return 'schema_v phải là số nguyên ≥ 1';
    }
    if (!Array.isArray(o.dong)) return 'dong phải là mảng';
    if (o.dong.length > PFM_LO.DONG_MOI_GOI) {
      return `gói tối đa ${PFM_LO.DONG_MOI_GOI} dòng (đang ${o.dong.length})`;
    }
    for (const [i, d] of o.dong.entries()) {
      if (typeof d !== 'object' || d === null || Array.isArray(d)) {
        return `dong[${i}] phải là object`;
      }
      const dd = d as Record<string, unknown>;
      if (typeof dd.ma !== 'string' || dd.ma === '') return `dong[${i}].ma phải là chuỗi`;
      if (!('gia_tri' in dd)) return `dong[${i}] thiếu gia_tri`;
      if (dd.doi_tuong !== undefined && typeof dd.doi_tuong !== 'string') {
        return `dong[${i}].doi_tuong phải là chuỗi`;
      }
    }
    return null;
  }

  if (o.loai === 'nhip') {
    if (typeof o.ma !== 'string') return 'ma phải là chuỗi';
    /*
     * ⚠⚠ AI PHÁT, TRƯỚC KHI HỎI HÌNH DẠNG. `kiemValueJsonPfm` kiểm hình của
     * `value_json` — nó không biết ai đang gọi. Không có dòng này thì client POST
     * được `ma: 'pfm_consent'` và tự ghi một VẾT ĐỒNG Ý GIẢ vào `events`, đúng cái
     * vết R1/D250 dựng ra để chứng minh. Xem `NHIP_CLIENT_TU_GUI`.
     */
    if (!clientTuGuiDuoc(o.ma)) {
      return `ma "${String(o.ma)}" không phải nhịp client tự gửi được `
        + `(chỉ ${NHIP_CLIENT_TU_GUI.join(', ')})`;
    }
    /*
     * ⚠ Gọi thẳng cửa kiểm K5 (D250) chứ không kiểm lại `v` ở đây. Nó đã biết mọi
     * field bắt buộc và mọi hình giá trị cho bảy `action_type`; viết lại là dựng bản
     * thứ hai của một danh sách trắng — thứ sẽ trôi, và trôi ở đúng cái cửa dựng ra
     * để giữ `events` sạch.
     */
    return kiemValueJsonPfm(o.ma, o.v);
  }

  return `loai lạ: ${String(o.loai)} (chỉ 'goi' hoặc 'nhip')`;
}

/** Kết quả xử lý MỘT món — trả về theo đúng thứ tự client gửi. */
export interface KetMon {
  id: string;
  /** `ghi` mới · `trung` đã nhận trước đó (gửi lại) · `bo` từ chối vĩnh viễn. */
  ket: 'ghi' | 'trung' | 'bo';
  /** Chỉ có khi `ket === 'bo'` — đi thẳng vào telemetry `pfm_lo_loi{ma}`. */
  ly_do?: string;
}

/**
 * ⭐ GIAO ƯỚC XÁC NHẬN — client BỎ KHỎI HÀNG ĐỢI cả `ghi` LẪN `trung` LẪN `bo`.
 *
 * ⚠ `trung` chỉ xuất hiện với `nhip`. Một `goi` không bao giờ trả `trung` — xem `MonLo`.
 *
 * ⚠⚠ `bo` cũng phải bỏ, và đây là chỗ dễ làm sai nhất. Mọi lý do từ chối ở đường này
 * là TẤT ĐỊNH — sai hình, mã lạ, kỳ quá cũ — nên gửi lại lần thứ một nghìn vẫn hỏng y
 * hệt. Giữ nó lại "cho chắc" là để một dòng hỏng **chặn đứng mọi món phía sau nó**,
 * vĩnh viễn, im lặng (đúng cái bẫy `xepHang` đã cảnh báo ở chiều ngược lại).
 * ⚠ Nhưng bỏ thì phải ĐẾM: mỗi `bo` phát một `pfm_lo_loi{ma}`. Vứt dữ liệu mà không
 * để lại con số là cách mất dữ liệu êm ái nhất tồn tại.
 * ⚠ Món KHÔNG có trong `ket` (lô bị cắt vì trần, hoặc request hỏng) thì GIỮ LẠI.
 */
export const XAC_NHAN_BO_HET: readonly KetMon['ket'][] = ['ghi', 'trung', 'bo'];
