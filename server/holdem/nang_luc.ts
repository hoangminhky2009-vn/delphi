/**
 * CHẤM THẺ NĂNG LỰC (D323) — hàm THUẦN, không DB, không engine, không RNG.
 *
 * Hai tầng, đúng nếp `insight.ts`:
 *  · `chamNangLucTran`  — MỘT trận (đề) → ba năng lực, mỗi cái MỘT trong ba bậc
 *    `chua_gap · gap_chua_vung · lam_duoc` (không có `chung_minh` — xem
 *    `nang_luc_ids.ts`).
 *  · `gopNangLuc`       — nhiều trận đã chấm (kèm seed) → thẻ theo NGƯỜI, nơi
 *    `chung_minh` mới xuất hiện (test-retest ≥ 2 đề KHÁC seed).
 *
 * Vì sao ba năng lực không dùng chung một khuôn ngưỡng: mỗi cái đo một dạng
 * bằng chứng khác nhau (trạng thái NAV cuối vòng · độ khớp xác suất · cấu trúc
 * danh mục), nên "đã gặp" và "đã làm được" của từng cái phải tự định nghĩa lấy
 * — ép chung một công thức là đúng kiểu trừu tượng hoá sai chỗ.
 *
 * Ngưỡng số ở `config/nang_luc.ts` (NGUONG_NANG_LUC, PLAYTEST-TUNE — A8.2).
 */
import {
  NANG_LUC_FORMULA_VERSION, NGUONG_NANG_LUC, type BacNangLuc,
} from '../../config/nang_luc.js';
import type { NangLucCuaToiDTO, NangLucTran, TheNangLucTranDTO } from './nang_luc_ids.js';

/**
 * Đầu vào tối thiểu MỘT VÒNG cần để chấm cả ba năng lực. `HangHanhVi`
 * (`server/hanh_vi/kho.ts`) thoả kiểu này về CẤU TRÚC — cố ý không import nó ở
 * đây để tầng chấm không phụ thuộc ngược vào tầng đọc DB.
 */
export interface DongNangLuc {
  vong: number;
  brier: number | null;
  o_su_kien: boolean;
  la_tin_gia: boolean;
  tu_dong: boolean;
  so_ma: number | null;
  tien_mat_bp: number | null;
  tiet_kiem_bp: number | null;
  tk_huy_so: number | null;
  so_nhom: number | null;
  tran_xong: boolean;
  man_tap: boolean;
  nghi_may: boolean;
  /**
   * D436 — trait đang mang SAU vòng (cột `trait_json`, 0071). KHÁC null ⇒ trận chạy luật có hệ trait (v55+): MÙ TIN che tin,
   * NỘI GIÁN cho tin riêng ⇒ thước đọc tin của trận ấy không so được với luật cũ ⇒ không vào LỌC TIN. Vắng/null = trận cũ.
   */
  trait_json?: readonly string[] | null | undefined;
}

const lamTron3 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * CAM KẾT TIẾT KIỆM (N1) — hai đường `chua_gap` KHÁC NHAU (bang_chung khác
 * nhau) dù cùng tên bậc: "luật trận không có cơ chế" (không có gì để đo) và
 * "có cơ chế mà không bước vào" (có bằng chứng: 0 quan sát, không phải THIẾU
 * quan sát) — trộn hai cái là đúng lỗi A11.2 nhưng ở tầng suy luận.
 */
function chamCamKetTietKiem(rows: readonly DongNangLuc[]): Pick<NangLucTran, 'bac' | 'bang_chung'> {
  const coCoChe = rows.some((r) => r.tiet_kiem_bp !== null);
  if (!coCoChe) {
    return {
      bac: 'chua_gap',
      bang_chung: { so_vong_gui: null, so_huy: null, ty_trong_max_bp: null },
    };
  }
  const soVongGui = rows.filter((r) => (r.tiet_kiem_bp ?? 0) > 0).length;
  const tyTrongMax = rows.reduce((m, r) => Math.max(m, r.tiet_kiem_bp ?? 0), 0);
  if (soVongGui === 0) {
    // Có cửa mà không bước vào — KHÔNG phải bằng chứng ngược (§3.3), chỉ là chưa gặp.
    return { bac: 'chua_gap', bang_chung: { so_vong_gui: 0, so_huy: 0, ty_trong_max_bp: 0 } };
  }
  const soHuy = rows.reduce((s, r) => s + (r.tk_huy_so ?? 0), 0);
  if (soHuy > 0) {
    const vongHuyDau = rows.find((r) => (r.tk_huy_so ?? 0) > 0)?.vong ?? null;
    return {
      bac: 'gap_chua_vung',
      bang_chung: { so_vong_gui: soVongGui, so_huy: soHuy, ty_trong_max_bp: tyTrongMax, vong_huy_dau: vongHuyDau },
    };
  }
  return { bac: 'lam_duoc', bang_chung: { so_vong_gui: soVongGui, so_huy: soHuy, ty_trong_max_bp: tyTrongMax } };
}

/**
 * ĐỌC TIN & HIỆU CHỈNH NIỀM TIN (N2) — n/so_su_kien/so_tin_gia LUÔN là số đếm
 * thật, kể cả ở bậc `chua_gap` (thiếu mẫu không có nghĩa là "không biết đếm
 * được bao nhiêu", nó chỉ có nghĩa "chưa đủ để tin"). CHỈ `brier_tb` null khi
 * n = 0 — chia cho 0 không phải "chưa hiệu chỉnh được", nó là vô nghĩa.
 */
function chamDocTin(rows: readonly DongNangLuc[]): Pick<NangLucTran, 'bac' | 'bang_chung'> {
  const N = NGUONG_NANG_LUC.DOC_TIN;
  const cacBrier = rows.map((r) => r.brier).filter((b): b is number => b !== null);
  const n = cacBrier.length;
  const soSuKien = rows.filter((r) => r.o_su_kien).length;
  const soTinGia = rows.filter((r) => r.la_tin_gia).length;
  const brierTb = n > 0 ? lamTron3(cacBrier.reduce((s, b) => s + b, 0) / n) : null;
  const bangChung = { brier_tb: brierTb, n, so_su_kien: soSuKien, so_tin_gia: soTinGia };
  /*
   * D436 (founder 27/09 chọn "chỉ tách LỌC TIN") — trận có hệ trait KHÔNG vào thẻ đọc tin: `chua_gap` nên `gopNangLuc`
   * không đếm nó vào đề nào; số đếm vẫn thật, kèm dấu `tach_luat_trait` để tệp xuất / người đọc biết vì sao.
   * GIỮ SỔ và CHIA vẫn tính: không trait nào chạm sổ tiết kiệm; MỘT GIỎ (trần 2 mã) và TÂM RỘNG (+1 mã) có chạm SỐ MÃ,
   * nhưng ngưỡng CHIA là ≥ 2 NHÓM nên vẫn đạt được ngay dưới trần 2 ⇒ bậc không đổi nghĩa (số mã / phơi nhiễm ở tệp xuất
   * thì có trần luật với người mang MỘT GIỎ — đọc kèm `trait_json`).
   */
  if (rows.some((r) => r.trait_json !== null && r.trait_json !== undefined)) {
    return { bac: 'chua_gap', bang_chung: { ...bangChung, tach_luat_trait: 1 } };
  }
  if (n < N.N_BRIER_TOI_THIEU || soSuKien < N.SU_KIEN_TOI_THIEU) {
    return { bac: 'chua_gap', bang_chung: bangChung };
  }
  return { bac: brierTb !== null && brierTb < N.BRIER_LAM_DUOC ? 'lam_duoc' : 'gap_chua_vung', bang_chung: bangChung };
}

/**
 * PHÂN TÁN RỦI RO (N3) — chỉ xét vòng CÓ VỊ THẾ (`so_ma ≥ 1`) và KHÔNG phải
 * vòng hết giờ tự nộp (`tu_dong`): đứng ngoài hoặc bị đồng hồ chốt hộ không
 * phải một lựa chọn về cách chia tiền. `so_nhom` vắng (dòng dựng trước 0064,
 * hoặc formula v1) dùng `so_ma ≥ 2` làm DỰ PHÒNG THÔ — ghi `dung_du_phong: 1`
 * để người đọc biết con số đã bị pha loãng (hai mã CÙNG PHE vẫn tính là "hai"),
 * không âm thầm coi hai cách đếm là một.
 */
function chamPhanTan(rows: readonly DongNangLuc[]): Pick<NangLucTran, 'bac' | 'bang_chung'> {
  const N = NGUONG_NANG_LUC.PHAN_TAN;
  const viThe = rows.filter((r) => !r.tu_dong && r.so_ma !== null && r.so_ma >= 1);
  const soVongViThe = viThe.length;
  let dungDuPhong = 0;
  const soHaiNhom = viThe.filter((r) => {
    if (r.so_nhom !== null) return r.so_nhom >= N.SO_NHOM_TOI_THIEU;
    dungDuPhong = 1;
    return (r.so_ma as number) >= 2;
  }).length;
  const tyLe = soVongViThe > 0 ? lamTron3(soHaiNhom / soVongViThe) : 0;
  const bangChung = { so_vong_vi_the: soVongViThe, ty_le_hai_nhom: tyLe, dung_du_phong: dungDuPhong };
  if (soVongViThe < N.VONG_VI_THE_TOI_THIEU) return { bac: 'chua_gap', bang_chung: bangChung };
  return { bac: tyLe >= N.TY_LE_VONG_LAM_DUOC ? 'lam_duoc' : 'gap_chua_vung', bang_chung: bangChung };
}

/**
 * Trận có vào thẻ theo NGƯỜI không, và nếu không thì vì sao — thứ tự ưu tiên
 * CỐ ĐỊNH khi nhiều lý do cùng đúng: chưa xong (nặng nhất — trận còn dở thì mọi
 * bằng chứng khác đều tạm) → màn tập (luật khác, không đại diện tiền thật) →
 * nghi máy (không ai ra quyết định nào). Rows rỗng coi như chưa xong.
 */
function xetTinhVaoThe(
  rows: readonly DongNangLuc[],
): Pick<TheNangLucTranDTO, 'tinh_vao_the' | 'ly_do_khong_tinh'> {
  if (rows.length === 0 || rows.some((r) => !r.tran_xong)) {
    return { tinh_vao_the: false, ly_do_khong_tinh: 'chua_xong' };
  }
  if (rows.some((r) => r.man_tap)) return { tinh_vao_the: false, ly_do_khong_tinh: 'man_tap' };
  if (rows.some((r) => r.nghi_may)) return { tinh_vao_the: false, ly_do_khong_tinh: 'nghi_may' };
  return { tinh_vao_the: true, ly_do_khong_tinh: null };
}

/** Chấm ba năng lực trên MỘT trận. `rows` = mọi vòng của trận đó (mọi vòng, kể cả tu_dong). */
export function chamNangLucTran(rows: readonly DongNangLuc[]): TheNangLucTranDTO {
  const { tinh_vao_the, ly_do_khong_tinh } = xetTinhVaoThe(rows);
  return {
    formula_version: NANG_LUC_FORMULA_VERSION,
    tinh_vao_the,
    ly_do_khong_tinh,
    nang_luc: [
      { id: 'cam_ket_tiet_kiem', ...chamCamKetTietKiem(rows) },
      { id: 'doc_tin', ...chamDocTin(rows) },
      { id: 'phan_tan', ...chamPhanTan(rows) },
    ],
  };
}

/**
 * Gộp thẻ của nhiều trận (đã chấm bằng `chamNangLucTran`) thành thẻ theo NGƯỜI.
 * Chỉ trận `the.tinh_vao_the` được đếm — trận màn tập/dở/nghi máy không vào
 * mẫu số nào cả, kể cả khi nó lỡ chấm ra `lam_duoc` (bot chơi hộ vẫn có thể
 * "làm được" một năng lực, nhưng đó không phải bằng chứng về NGƯỜI).
 */
export function gopNangLuc(
  tran: readonly { seed: number; luc: string | null; the: TheNangLucTranDTO }[],
): NangLucCuaToiDTO {
  const tinh = tran.filter((t) => t.the.tinh_vao_the);
  const nangLuc = (['cam_ket_tiet_kiem', 'doc_tin', 'phan_tan'] as const).map((id) => {
    const cuaId = tinh.map((t) => ({ t, n: t.the.nang_luc.find((x) => x.id === id) }));
    const soDeGap = cuaId.filter(({ n }) => n !== undefined && n.bac !== 'chua_gap').length;
    // Seed KHÁC NHAU có lam_duoc — chơi lại đúng seed cũ không tính thêm một đề.
    const seedLamDuoc = new Set(
      cuaId.filter(({ n }) => n?.bac === 'lam_duoc').map(({ t }) => t.seed));
    const soDeLamDuoc = seedLamDuoc.size;
    let lanDauLamDuoc: string | null = null;
    for (const { t, n } of cuaId) {
      if (n?.bac !== 'lam_duoc' || t.luc === null) continue;
      if (lanDauLamDuoc === null || t.luc < lanDauLamDuoc) lanDauLamDuoc = t.luc;
    }
    const bac: BacNangLuc = soDeLamDuoc >= NGUONG_NANG_LUC.CHUNG_MINH_SO_DE ? 'chung_minh'
      : soDeLamDuoc >= 1 ? 'lam_duoc'
        : soDeGap >= 1 ? 'gap_chua_vung' : 'chua_gap';
    return { id, bac, so_de_gap: soDeGap, so_de_lam_duoc: soDeLamDuoc, lan_dau_lam_duoc: lanDauLamDuoc };
  });
  return { formula_version: NANG_LUC_FORMULA_VERSION, so_de: tinh.length, nang_luc: nangLuc };
}
