/**
 * PFM — PHÂN BỔ: CHIA TIỀN CÒN LẠI VÀO HŨ (D420, founder 26/09 — thay mô hình D410).
 *
 * Founder chốt bằng câu hỏi đóng (26/09): *"hôm nay ghi + THU 2.000.000 · − CHI 45.000 · − CHI 100.000 ⇒ tối mở HŨ,
 * khay bày TIỀN CÒN LẠI 1.855.000"*, bẻ ra TỜ (*"2tr thì 4 tờ 500k được bấm 4 lần"*) — mỗi cú chạm một tờ; hoặc gõ đúng
 * số. D410 bày tiền ĐÃ TIÊU và một cú chạm nạp cả khoản: *"sao t bấm 1 cái nó cho phân bổ hết sạch số tiền luôn vậy"*.
 *
 * ⭐ TIỀN CÒN LẠI = Σ THU − Σ CHI của MỌI khoản trong sổ, mọi tháng. Góp hũ là CHI (tiền rời ví vào hũ), rút hũ là THU —
 *   nên MỘT phép cộng nói đủ "ví còn bao nhiêu chưa vào quỹ nào". Âm ⇒ 0: sổ chỉ biết tiền được ghi, và ví âm nghĩa là
 *   thiếu dòng thu chứ không phải có tiền để chia.
 * ⭐ PHÂN BỔ = MỘT KHOẢN MỚI: `chi` + `huId` + dấu `phanBo`, đề ngày hôm nay. Không sửa khoản cũ nào, không đụng tháng đã
 *   qua (két đóng băng nó — K10). Chuyển vào hũ KHÔNG phải tiêu: `laChiTieu`/`congSo` bỏ nó ra (xem `Khoan.phanBo`).
 * ⭐ TỜ = MỆNH GIÁ CỦA BÀN TIỀN, chia tham lam từ tờ lớn. Hệ 1-2-5 nên bỏ đi một tờ bất kỳ thì các tờ còn lại giữ nguyên
 *   (bài `pfm_phan_bo.test.ts` §I quét mọi số nghìn tới 3 triệu) — chạm một tờ chỉ trừ ĐÚNG tờ ấy, không tờ nào khác đổi
 *   chỗ hay đổi số. Phần lẻ dưới tờ nhỏ nhất là một "tờ lẻ" riêng, đúng bằng phần ấy.
 * ⚠ Hàm thuần, không đọc đồng hồ: ngày và lúc do màn đưa vào.
 */
import { laChiTieu, laGanChi, laPhanBo, soGan, taoKhoan, type Khoan, type MaPhanBo } from './so.js';

export class LoiPhanBo extends Error {}

/** Ví còn bao nhiêu chưa vào hũ nào (xem đầu tệp). Không bao giờ âm. */
export function tienConLai(so: readonly Khoan[]): number {
  let n = 0;
  for (const k of so) {
    if (laGanChi(k)) continue;   // D424 — khoản gán không phải tiền
    n += k.chieu === 'thu' ? k.soTien : -k.soTien;
  }
  return Math.max(0, n);
}

/**
 * ⭐ TIỀN CHI CHƯA CHIA của một tháng (D424) — phía CHI của khay, *"giống thu"*: tổng CHI TIÊU (`laChiTieu`) đề ngày
 * trong `thang` trừ phần đã GÁN vào hũ tiêu dùng trong tháng ấy (chia cộng, gỡ trừ). Âm ⇒ 0 — người dùng vừa xoá một
 * khoản chi đã chia: sổ nói ít hơn đã gán, không phải có tiền chi để chia.
 * ⚠ Theo THÁNG, cùng nhịp với số của hũ tiêu dùng (`daTieuTrongThang`): tháng mới bắt đầu thì phần chưa chia của tháng
 *   cũ ở lại tháng cũ, không kéo sang.
 * ⭐ D429 — `denNgay` (1–31): chỉ đếm tới hết ngày ấy — phép "so CÙNG NGÀY" của bản tin (`phan_tich.ts`), cùng nếp tham
 *   số của `daTieuTrongThang`. Vắng = cả tháng. Một hàm có tham số, không phải bản thứ hai của vòng lặp (A11.5).
 */
export function chiChuaChia(so: readonly Khoan[], thang: string, denNgay: number | null = null): number {
  let chi = 0;
  let gan = 0;
  for (const k of so) {
    if (!k.ngay.startsWith(thang)) continue;
    if (denNgay !== null && Number(k.ngay.slice(8, 10)) > denNgay) continue;
    if (laChiTieu(k)) chi += k.soTien;
    else gan += soGan(k);
  }
  return Math.max(0, chi - gan);
}

/** Một chồng tờ trên khay: mệnh giá + số tờ. `le` = phần lẻ dưới tờ nhỏ nhất — một "tờ" đúng bằng phần ấy. */
export interface ChongTo {
  gt: number;
  dem: number;
  le?: true;
}

/** Bẻ `soTien` ra tờ theo `menhGia`, tờ LỚN trước (mắt tìm tờ to trước, như khay ở bàn tiền). */
export function chiaTo(soTien: number, menhGia: readonly number[]): ChongTo[] {
  if (!Number.isSafeInteger(soTien) || soTien <= 0) return [];
  const ra: ChongTo[] = [];
  let con = soTien;
  for (const gt of [...menhGia].sort((a, b) => b - a)) {
    const dem = (con - (con % gt)) / gt;
    if (dem > 0) { ra.push({ gt, dem }); con -= dem * gt; }
  }
  if (con > 0) ra.push({ gt: con, dem: 1, le: true });
  return ra;
}

export interface DauVaoPhanBo {
  ngay: string;
  soTien: number;
  huId: string;
  phanBo: MaPhanBo;
  /** `chi` = NẠP (ví → hũ, mặc định) · `thu` = RÚT (hũ → ví, D421) — đúng quy ước dấu của `tongGopVaoHu`. */
  chieu?: 'chi' | 'thu';
}

/**
 * D421 — khoản này là một cú RÚT ở màn HŨ (hũ → ví): khoản phân bổ chiều `thu` — trừ khoản GÁN (D424: gỡ chi tiêu khỏi
 * hũ tiêu dùng cũng là `thu`, nhưng không tiền nào về ví). MỘT cửa cho câu "nạp hay rút".
 */
export function laRutHu(k: Khoan): boolean {
  return laPhanBo(k) && !laGanChi(k) && k.chieu === 'thu';
}

/** Khoản phân bổ — tiền chuyển giữa ví và `huId`. Kiểm ngày + số tiền đi qua `taoKhoan` (một nguồn). */
export function taoKhoanPhanBo(v: DauVaoPhanBo, luc: string, id: string): Khoan {
  if (!v.huId) throw new LoiPhanBo('Phân bổ cần một hũ.');
  return {
    ...taoKhoan({ ngay: v.ngay, soTien: v.soTien, chieu: v.chieu ?? 'chi', huId: v.huId }, luc, id),
    phanBo: v.phanBo,
  };
}
