/**
 * PFM — THẺ CUỐI KỲ (D325): nhìn lại MỘT tháng vừa khép, ở đầu màn GƯƠNG.
 *
 * Bốn thứ, đúng gói (A) founder chốt 13/09:
 *  1. mỗi hũ còn mở trong kỳ ⇒ "tới đâu?" (bốn nấc `KET_QUA_HU`) → `ketQuaKy` → `kq_dat_muc_tieu`
 *  2. mỗi luật còn sống trong kỳ ⇒ "có tác dụng không?" (`co · khong · chua_ro`) → `hieuQuaKy`
 *     → `kq_rule_hieu_qua` — nhãn sổ đăng ký khai "do USER đánh giá" mà tới D325 chưa màn nào hỏi
 *  3. số hũ BỎ giữa chừng trong kỳ — app TỰ ĐẾM từ `lichSu`, không hỏi
 *  4. số ngày có ghi sổ trong kỳ — app TỰ ĐẾM từ sổ, không hỏi
 *
 * ⚠⚠ KHÔNG THƯỞNG GÌ CHO CÂU TỰ KHAI (D99/D101 — A11.11). Thưởng cho câu trả lời là mua câu
 * trả lời đẹp, và đây đúng là lớp OUTCOME của dataset. Thẻ không có token, không có chuỗi.
 * ⚠ A10 🔒: hai dòng tự đếm chỉ TẢ ("1 hũ bỏ giữa chừng"), không phán, không màu đỏ-xanh.
 * ⚠ Chỉ hỏi kỳ LIỀN TRƯỚC, không dồn các kỳ cũ hơn: người mở app sau ba tháng không phải trả
 * nợ ba thẻ. Kỳ cũ hơn cũng không vào được gói nữa (server chỉ nhận kỳ sống + liền trước).
 */
import type { KhoPfm } from './kho.js';
import { tongGopVaoHu, type Khoan } from './so.js';
import { laTichLuy, type Hu } from './hu.js';
import type { Luat } from './luat.js';
import { huThuocKy, huTrongKy, luatThuocKy, mocKy } from './goi_ky.js';
import {
  demLuatTrongKy, loiDoanHuToiHan, loiDoanLuatCuaKy, trangThaiLoiDoanLuat,
  type DemLuatKy, type LoiDoanHu, type LoiDoanLuat, type TrangThaiLoiDoan,
} from './vi_the.js';
import { thangSauCua } from './thoi_gian.js';

/** Lời đoán hũ tới hạn ở kỳ + số đã góp QUA APP tới hết kỳ (chỉ để in cạnh câu hỏi, không phải kết quả). */
export interface DoanHuCk { ld: LoiDoanHu; daGop: number }
/** Lời đoán luật của kỳ + nhịp đếm trong kỳ + trạng thái suy (xét được hay chưa). */
export interface DoanLuatCk { ld: LoiDoanLuat; dem: DemLuatKy; tt: TrangThaiLoiDoan }

export interface CauCuoiKy {
  ky: string;
  /** Hũ để hỏi — BẢN HÔM NAY (câu trả lời ghi vào chính bản ghi này). */
  hu: readonly Hu[];
  /** Luật để hỏi — bản hôm nay. */
  luat: readonly Luat[];
  /** Số hũ có dấu `bo_do` TRONG kỳ. */
  soHuBo: number;
  /** Số NGÀY khác nhau có ghi sổ trong kỳ — đếm, không phán (0 là một số đếm thật, không phải thiếu mẫu). */
  soNgayGhi: number;
  /**
   * ⭐ LỜI ĐOÁN tới hạn ở kỳ (tệp 15 lát 1), khoá theo id hũ/luật đang được hỏi. Thẻ vẫn MỘT (D61): hũ
   * có lời đoán thì câu "tới đâu?" đi kèm điều đã đặt, rồi thêm hàng VÌ SAO; luật thì kèm nhịp app tự đếm.
   */
  doanHu: Readonly<Record<string, DoanHuCk>>;
  doanLuat: Readonly<Record<string, DoanLuatCk>>;
}

/**
 * Dựng thẻ cho kỳ `ky`. `null` ⇒ không vẽ gì: chưa có hũ lẫn luật nào để hỏi.
 *
 * ⚠ HŨ ĐƯỢC HỎI = hũ thuộc kỳ mà lúc kỳ khép VẪN MỞ (chạy hoặc tạm dừng). Hũ chốt trong kỳ đã
 * có nấc quyết toán — hỏi lại là bắt người dùng trả lời hai lần cùng một câu, và hai câu ấy sẽ
 * tranh nhau một dòng (`dac_trung.ts` §`??`).
 * ⚠ LUẬT ĐƯỢC HỎI = luật thuộc kỳ mà hôm nay đang BẬT, hoặc có nhịp trong kỳ. Luật không lưu
 * lịch sử bật/tắt (`datBat` — cấu hình cục bộ thuần), nên "đã tắt từ tháng 5" và "tắt hôm qua"
 * trông như nhau; nhịp trong kỳ là bằng chứng duy nhất nó còn sống tháng ấy.
 */
export function cauCuoiKy(
  ky: string, so: readonly Khoan[], hu: readonly Hu[], luat: readonly Luat[],
): CauCuoiKy | null {
  const { dau, sau } = mocKy(ky);
  const huHoi = hu.filter((h) => {
    // D421 — "tháng ấy hũ này tới đâu" là câu của hũ gom tới mức; hũ tiêu dùng không có đích.
    if (!laTichLuy(h) || !huThuocKy(h, ky)) return false;
    const t = huTrongKy(h, ky).trangThai;
    return t === 'dang_chay' || t === 'tam_dung';
  });
  const luatHoi = luat.filter((l) => luatThuocKy(l, ky)
    && (l.trangThai === 'bat' || l.lichSu.some((d) => d.luc >= dau && d.luc < sau
      && (d.ma === 'ban' || d.ma === 'giu' || d.ma === 'vo'))));
  if (huHoi.length === 0 && luatHoi.length === 0) return null;
  /*
   * ⚠ Số đã góp TỚI HẾT KỲ (khoản đề ngày trong/trước kỳ), không phải tới hôm nay: câu hỏi là "tháng ấy
   * tới đâu". Nó chỉ là số in cạnh câu hỏi — kết quả vẫn là NẤC người dùng bấm (tính cả tiền ngoài app, D62).
   */
  const soToiKy = so.filter((k) => k.ngay < `${thangSauCua(ky)}-01`);
  const doanHu: Record<string, DoanHuCk> = {};
  for (const h of huHoi) {
    const ld = loiDoanHuToiHan(h, ky);
    if (ld !== null) doanHu[h.id] = { ld, daGop: tongGopVaoHu(soToiKy, h.id, h.mocGop) };
  }
  const doanLuat: Record<string, DoanLuatCk> = {};
  for (const l of luatHoi) {
    const ld = loiDoanLuatCuaKy(l, ky);
    if (ld !== null) {
      doanLuat[l.id] = { ld, dem: demLuatTrongKy(l, ky), tt: trangThaiLoiDoanLuat(l, ld, thangSauCua(ky)) };
    }
  }
  return {
    ky,
    hu: huHoi,
    luat: luatHoi,
    doanHu,
    doanLuat,
    soHuBo: hu.filter((h) => h.lichSu.some((d) => d.ma === 'bo_do' && d.luc >= dau && d.luc < sau)).length,
    soNgayGhi: new Set(so.filter((k) => k.ngay.startsWith(ky)).map((k) => k.ngay)).size,
  };
}

/* ═══ DẤU "ĐÃ XONG" — một bản ghi `nhip` mỗi kỳ ═══════════════════════════════ */

const idDau = (ky: string): string => `cuoi_ky_${ky}`;

/** Người dùng đã bấm XONG cho kỳ `ky` chưa. */
export async function daXongCuoiKy(kho: KhoPfm, ky: string): Promise<boolean> {
  return (await kho.doc<{ ky: string }>('nhip', idDau(ky))) !== null;
}

/**
 * ⚠⚠ `thang` CỦA BẢN GHI LÀ THÁNG ĐANG SỐNG, KHÔNG PHẢI `ky`. Ngăn `nhip` sao lưu theo lát
 * tháng (`ket.ts` §`KIEU_LAT`), và một bản ghi rơi vào lát tháng ĐÃ ĐÓNG làm lát ấy bẩn vĩnh
 * viễn — driver két kêu `pfm_ket_thang_dong` mỗi ngày, mãi mãi (`ket_chay.ts` §lát kẹt).
 * Thẻ luôn hỏi về tháng trước, nên ghi `thang: ky` là rơi đúng vào cái bẫy ấy mọi lần.
 */
export async function ghiXongCuoiKy(
  kho: KhoPfm, ky: string, thangSong: string, luc: string,
): Promise<void> {
  await kho.ghi('nhip', { id: idDau(ky), thang: thangSong, suaLuc: luc, d: { ky } });
}
