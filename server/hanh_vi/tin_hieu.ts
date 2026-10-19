/**
 * TÍN HIỆU GAME CHO PFM (D324) — hàm THUẦN trên dòng `hanh_vi_vong`.
 *
 * ─── VÌ SAO KHÔNG CHỜ GÓI ──────────────────────────────────────────────────
 * Thẻ tính cách (`goi.ts`) chỉ nở khi đủ 10 trận · 40 vòng quyết định · 8 vòng sự kiện.
 * Nối dây sang PFM mà đợi gói thì người mới — đúng người vừa chơi xong rồi mở sổ — không
 * bao giờ thấy mặt "trong trận" của gương, và màn phỏng vấn tiếp tục điền ⚑ bằng hằng số.
 * Nên ở đây trả tín hiệu NGAY TỪ TRẬN ĐẦU, kèm cỡ mẫu (`n_tran`, `n_vong`, và `n` của từng
 * chỉ số trong `SauChiSo`) để người đọc tự cân; chỉ số thiếu mẫu vẫn là `null` (D62).
 *
 * ─── VÌ SAO GẮN NHÃN "CHƯA HIỆU CHUẨN" ─────────────────────────────────────
 * Tệp 10 §4.3 (Test A) đòi đo độ tin cậy lặp lại TRƯỚC khi nối tín hiệu game vào chân
 * dung. Founder chốt 13/09 nối trước (phương án A của câu 3) — nên dây được nối, nhưng
 * mỗi số mang cờ `hieu_chuan: 'chua'` để không ai đọc nó như một phép đo đã kiểm.
 *
 * Luật lọc dòng dùng CHÍNH `vaoGoi` — một chỗ quyết "dòng nào là quyết định thật", không
 * chép điều kiện (D61).
 */
import { tinhChiSo, xepBacDoc, type VongInsight } from '../holdem/insight.js';
import { vaoGoi } from './goi.js';
import { HANH_VI_FORMULA_VERSION } from './trai.js';
import type { HangHanhVi } from './kho.js';
import type { TinHieuGameDTO, TinHieuTietKiem } from './tin_hieu_ids.js';

/** Đầu vào tối thiểu — `HangHanhVi` thoả về cấu trúc. */
export type DongTinHieu = VongInsight
  & Pick<HangHanhVi, 'tran_xong' | 'man_tap' | 'nghi_may' | 'tiet_kiem_bp' | 'tk_huy_so'>;

const lamTron3 = (x: number): number => Math.round(x * 1000) / 1000;

function tinHieuTietKiem(rows: readonly DongTinHieu[]): TinHieuTietKiem | null {
  const theoTran = new Map<string, DongTinHieu[]>();
  for (const r of rows) {
    const ds = theoTran.get(r.match_id);
    if (ds) ds.push(r); else theoTran.set(r.match_id, [r]);
  }
  let coCoChe = 0;
  let gui = 0;
  let giuDu = 0;
  let huyTong = 0;
  const tyTrong: number[] = [];
  for (const ds of theoTran.values()) {
    if (!ds.some((r) => r.tiet_kiem_bp !== null)) continue;
    coCoChe += 1;
    const huy = ds.reduce((s, r) => s + (r.tk_huy_so ?? 0), 0);
    huyTong += huy;
    const dangGui = ds.filter((r) => (r.tiet_kiem_bp ?? 0) > 0);
    if (dangGui.length === 0) continue;
    gui += 1;
    if (huy === 0) giuDu += 1;
    for (const r of dangGui) tyTrong.push(r.tiet_kiem_bp as number);
  }
  if (coCoChe === 0) return null;
  return {
    n_tran_co_co_che: coCoChe,
    n_tran_gui: gui,
    so_huy_tong: huyTong,
    ty_trong_tb_bp: tyTrong.length > 0
      ? Math.round(tyTrong.reduce((a, b) => a + b, 0) / tyTrong.length) : null,
    ty_le_tran_giu_du: gui > 0 ? lamTron3(giuDu / gui) : null,
  };
}

/** Tín hiệu game từ mọi dòng của một user (hoặc của một kỳ đã lọc sẵn). */
export function tinhTinHieu(rows: readonly DongTinHieu[]): TinHieuGameDTO {
  const hopLe = rows.filter(vaoGoi);
  const chiSo = tinhChiSo(hopLe);
  return {
    formula_version: HANH_VI_FORMULA_VERSION,
    hieu_chuan: 'chua',
    n_tran: new Set(hopLe.map((r) => r.match_id)).size,
    n_vong: hopLe.length,
    chi_so: chiSo,
    bac_doc: xepBacDoc(chiSo),
    tiet_kiem: tinHieuTietKiem(hopLe),
  };
}

/**
 * Năm mã `gm_*` của MỘT kỳ (xem `config/pfm_dac_trung.ts` §GAME). Giá trị `null` ⇒
 * KHÔNG phát dòng ấy (A11.2 — thiếu là vắng, không phải 0). `gm_n_tran` luôn phát: 0 trận
 * hợp lệ trong một kỳ mà cửa nối đang mở là một QUAN SÁT thật.
 */
export function dongGameCuaKy(t: TinHieuGameDTO): { ma: string; gia_tri: number }[] {
  const ra: { ma: string; gia_tri: number }[] = [{ ma: 'gm_n_tran', gia_tri: Math.min(999, t.n_tran) }];
  if (t.tiet_kiem?.ty_le_tran_giu_du != null) ra.push({ ma: 'gm_tk_giu', gia_tri: t.tiet_kiem.ty_le_tran_giu_du });
  if (t.tiet_kiem) ra.push({ ma: 'gm_tk_huy', gia_tri: Math.min(99, t.tiet_kiem.so_huy_tong) });
  const brier = t.chi_so.hieu_chinh?.brier_tb;
  if (brier != null) ra.push({ ma: 'gm_brier_tb', gia_tri: lamTron3(Math.min(2, Math.max(0, brier)) / 2) });
  const phoi = t.chi_so.khau_vi?.phoi_nhiem_tb;
  if (phoi != null) ra.push({ ma: 'gm_phoi_nhiem', gia_tri: lamTron3(Math.min(1, Math.max(0, phoi))) });
  return ra;
}
