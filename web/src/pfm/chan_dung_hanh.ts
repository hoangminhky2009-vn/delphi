/**
 * PFM — **CHÂN DUNG HÀNH TINH**: ba câu ĐO của phỏng vấn ⇒ một toạ độ ⇒ một trong 27 chân dung.
 *
 * Theo DEMO ĐÃ CHỐT `docs/ui-ux/demo/pfm-chan-dung.html` (A11.25 — demo đứng trên mọi văn bản
 * kế hoạch; hai bên lệch thì sửa plan cho khớp demo, không sửa demo cho khớp plan).
 *
 * ⚠⚠ ĐÂY KHÔNG PHẢI `chan_dung.ts` THỨ HAI. Hai thứ khác hẳn nhau và cùng tồn tại có lý do:
 *   · `chan_dung.ts` (`MaChanDung`: tien_ve · ngay_te · ban_ru · cuoi_thang) đọc **SỔ THẬT** —
 *     bằng chứng mạnh, nhưng phải có ≥ `GUONG_SAN_NGAY_CHI` ngày có ghi mới nói được gì.
 *   · tệp này đọc **LỜI KHAI** ở phỏng vấn — bằng chứng yếu (P6), nhưng nói được từ phút đầu.
 * Tức đây là bản vá cho khoảng trống "ngày 1 chưa có dữ liệu", đúng chỉ đạo founder 20/09:
 * *đừng bắt user chờ mới có giá trị*. Khi sổ đủ dày thì `cham_doan.ts` chấm lại lời đoán, và
 * chính nó là thứ nói xem lời khai này có đúng không.
 *
 * ⚠ A10 🔒 — chân dung chỉ MÔ TẢ. Không một chữ "nên/hãy/bớt", không xếp hạng hành tinh nào hơn
 *   hành tinh nào. Hành tinh là CHỖ ĐỨNG, không phải điểm số.
 * ⚠ A8.2 — mọi con số neo nằm ở `config/pfm.ts`, không chôn ở đây.
 * ⚠ D26 — tệp này trả MÃ + SỐ. Mọi chữ người đọc ở `lib/pfm_chu.ts`.
 *
 * Hàm THUẦN: không đọc đồng hồ, không đọc kho, không chuỗi hiển thị.
 */
import { PFM } from '@config/pfm';

/** Ba trục đo được từ phỏng vấn. `null` = chưa trả lời câu đó (P7 — KHÔNG phải 0). */
export interface ToaDoChanDung {
  /** 0–100. CAO = muốn ngay (thiên vị hiện tại). */
  b: number | null;
  /** 0–100. CAO = tiếc khi tiêu (ma sát lúc tiền rời tay). */
  dau: number | null;
  /** 0 · 1 · 2 = tuỳ hứng · đại khái · khá rõ. Vành đai của hành tinh. */
  kh: number | null;
}

/**
 * NHÃN ĐÁP ÁN ⇒ ĐIỂM TRỤC.
 *
 * ⚠⚠ KHOÁ LÀ NHÃN NGƯỜI ĐỌC, CHÉP NGUYÊN TỪ `phong_van.ts`. Đổi chữ một bên mà quên bên kia thì
 * `DIEM_B[nhãn]` ra `undefined` ⇒ trục im lặng thành "chưa đo", KHÔNG có lỗi nào bắn ra và chân
 * dung vẫn vẽ được — chỉ là vẽ sai. Bài canh §I khoá hai bảng với `CAU_PV` để chặn đúng ca đó.
 *
 * ⏳ PLAYTEST-TUNE (A8.2) — xem khối `CHAN_DUNG_*` ở `config/pfm.ts`.
 */
export const DIEM_B: Readonly<Record<string, number>> = {
  'cất một phần đi': 12,
  'trả khoản cố định': 38,
  'tiêu cái đang cần': 70,
  'chưa nghĩ đã vơi': 100,
};

export const DIEM_DAU: Readonly<Record<string, number>> = {
  'quên luôn': 10,
  'thấy đáng': 30,
  'nhẩm lại giá': 62,
  'tiếc mất mấy hôm': 92,
};

export const DIEM_KE_HOACH: Readonly<Record<string, number>> = {
  'rồi, khá rõ': 2,
  'đại khái': 1,
  chưa: 0,
};

/** Một trục chưa trả lời ⇒ `null`, không phải 0 (P7: thiếu mẫu ≠ điểm thấp nhất). */
function diem(bang: Readonly<Record<string, number>>, nhan: string | undefined): number | null {
  if (nhan === undefined) return null;
  const v = bang[nhan];
  return v === undefined ? null : v;
}

export function toaDoTuNhan(
  lucTienVe: string | undefined, sauKhiTieu: string | undefined, dauThang: string | undefined,
): ToaDoChanDung {
  return {
    b: diem(DIEM_B, lucTienVe),
    dau: diem(DIEM_DAU, sauKhiTieu),
    kh: diem(DIEM_KE_HOACH, dauThang),
  };
}

/* ══ TOẠ ĐỘ → Ô ═══════════════════════════════════════════════════════════════ */

/** Điểm 0–100 ⇒ vùng 0 (thấp) · 1 (giữa) · 2 (cao). `null` vào thì `null` ra. */
export function vung(v: number | null): 0 | 1 | 2 | null {
  if (v === null) return null;
  const [thap, cao] = PFM.CHAN_DUNG_MOC_VUNG;
  if (v < thap!) return 0;
  return v < cao! ? 1 : 2;
}

export interface ONanhTinh { hang: 0 | 1 | 2; cot: 0 | 1 | 2 }

/**
 * Ô của người này trên lưới 3×3. `null` khi THIẾU một trong hai trục — chưa đủ thì
 * KHÔNG vẽ, chứ không lấp bằng vùng giữa (lấp là bịa một chân dung).
 *
 * ⚠⚠ `hang` LẬT LẠI: `b` cao nghĩa là MUỐN NGAY, mà hàng 0 của bảng hành tinh là hàng
 * "muốn ngay" (gần mặt trời). Quên phép lật này thì chân dung ra ngược hẳn mà vẫn trông
 * hợp lý — không test nào khác bắt được.
 */
export function oHanhTinh(t: ToaDoChanDung): ONanhTinh | null {
  const hb = vung(t.b);
  const hd = vung(t.dau);
  if (hb === null || hd === null) return null;
  return { hang: (2 - hb) as 0 | 1 | 2, cot: hd };
}

/** Vành đai = trục kế hoạch; chưa đo thì vành mảnh (1) — giữa, không phải "tuỳ hứng". */
export function vanhDai(t: ToaDoChanDung): 0 | 1 | 2 {
  return (t.kh ?? 1) as 0 | 1 | 2;
}

/**
 * TRỤC NÀO ĐANG SÁT RANH GIỚI — để màn nói thẳng *"chỉ một câu trả lời khác là bạn đã sang
 * vùng bên cạnh"*.
 *
 * ⚠ Vì sao phải có: chia vùng bằng ngưỡng cứng thì hai người lệch nhau một ly rơi vào hai hành
 * tinh khác hẳn. Giấu chuyện đó đi là để người dùng tin chân dung chắc hơn thực tế — gần lá số
 * tử vi hơn là mô tả. Trả về MÃ TRỤC (D26), chữ ở `pfm_chu.ts`.
 */
export type MaTrucRia = 'b' | 'dau';

export function trucSatRia(t: ToaDoChanDung): readonly MaTrucRia[] {
  const ra: MaTrucRia[] = [];
  const xet = (ma: MaTrucRia, v: number | null): void => {
    if (v === null) return;
    if (PFM.CHAN_DUNG_MOC_VUNG.some((moc) => Math.abs(v - moc) <= PFM.CHAN_DUNG_SAT_RIA)) ra.push(ma);
  };
  xet('b', t.b);
  xet('dau', t.dau);
  return ra;
}
