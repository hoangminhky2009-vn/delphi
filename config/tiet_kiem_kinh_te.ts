/**
 * ═══ SỔ TIẾT KIỆM CHỊU NỀN KINH TẾ (D405 — v54, founder 25/09) ═══════════════════════════════════
 *
 * Founder: *"quên mất nhỉ, gửi ngân hàng cũng phải chịu ảnh hưởng từ trạng thái nền kinh tế mà"*, chốt *"1 + 3 + 2"*,
 * rồi *"Nhưng 2 phải hiếm vào nhé (Kiểu điều kiện nhiều lá sự kiện xấu nối tiếp hay như nào)"*. Ba cờ ở `BoLuatCanBang`:
 *   1 · `tietKiemLamPhat` — lạm phát ăn cả sổ, ĐÚNG mức ăn tiền mặt (nền `NAV_V10.LAM_PHAT_TIEN_MAT_BP` + cú sốc
 *       `TIEN_MAT_SU_KIEN` qua `bpSuKienTienMat`) — không số riêng, một nguồn với tiền mặt;
 *   3 · `tietKiemThaNoi`  — lãi tính lại MỖI Ô theo lãi suất nền đang chạy, đúng công thức mở sổ (`laiTietKiemBp`);
 *   2 · `nganHangDoVo`    — HIẾM: lá phá sản / cạn thanh khoản đến sau HAI lá xấu liền nhau ⇒ phần tiền gửi VƯỢT hạn
 *       mức bảo hiểm mất một phần. Tệp này giữ SỐ + định nghĩa "lá xấu" của cờ này.
 *
 * VÌ SAO (D403 → D405): gate 12.000 trận — "gửi hết vào ngân hàng" thắng 24,7% bàn 8 (may rủi 12,5%), vì sổ miễn mọi
 * rủi ro: lãi 275 bp/ô chắc chắn, miễn lạm phát (tiền mặt mất 150 bp/ô nền + 400 bp ở lá lạm phát), miễn mọi lá khủng
 * hoảng. Hạ lãi sổ đúng 150 bp/ô (≈ cờ 1) đo ra 13,6% bàn 8 · 21,8% bàn 5 — về đúng mức may rủi.
 *
 * ⚠ Chỉ ĐỌC qua engine (`chotPhien`); đổi số ở đây = đo lại gate G1–G5 rồi trình founder (A8.2).
 */
import { doThamSo, TINH_CHAT_NEN, type SuKienId } from './holdem.js';

/** Mặt nhìn thấy của một ô — đủ để phân loại, không kéo kiểu của `server/` vào `config/`. */
export interface OMatChu {
  kind: string;
  giai_doan?: string;
  su_kien?: string;
}

export const NGAN_HANG_DO_VO = {
  /**
   * Lá KÍCH HOẠT — theo MẶT CHỮ: tin giả cũng tính, vì dân rút tiền theo tin đồn chứ không chờ kiểm chứng
   * (và nếu chỉ tin THẬT mới kích hoạt thì cú đổ vỡ lộ cờ `la_tin_gia` sớm một vòng — D149 §2 cấm).
   * `hack_san` là lá CẠN THANH KHOẢN ở v54 (D395).
   */
  LA_KICH_HOAT: ['pha_san', 'hack_san'] as readonly SuKienId[],
  /**
   * Số lá XẤU liền ngay trước lá kích hoạt. Đếm 20.000 bản đồ v54 bàn 16 (D405): 1 lá trước ⇒ 17,9% số trận có ít
   * nhất một lần; **2 lá ⇒ 5,0% (≈ 1 trận / 20)**; chỉ lá kích hoạt ⇒ 34,1%. Founder: *"2 phải hiếm"*.
   */
  SO_LA_XAU_TRUOC: 2,
  /** Hạn mức bảo hiểm tiền gửi MỖI GHẾ (chip, gốc + lãi treo). Ngoài đời VN: 125 triệu đồng/người/ngân hàng. PLAYTEST-TUNE. */
  BAO_HIEM_TOI_DA: doThamSo('NH_BAO_HIEM_TOI_DA', 5000),
  /** Phần MẤT trên số tiền gửi VƯỢT hạn mức (bp). PLAYTEST-TUNE. */
  MAT_BP: doThamSo('NH_DO_VO_MAT_BP', 2000),
} as const;

/**
 * Lá XẤU (mặt chữ): tin HOẢNG LOẠN (suy từ `TINH_CHAT_NEN` — thêm lá hoảng loạn mới là tự vào nhóm) · pha GIẢM ·
 * CẠN THANH KHOẢN (`hack_san`). Lá lạm phát / lãi suất / bong bóng KHÔNG tính — chúng không làm dân rút tiền gửi.
 */
export function laLaXau(o: OMatChu | undefined): boolean {
  if (!o) return false;
  if (o.kind === 'giai_doan') return o.giai_doan === 'giam';
  if (o.kind !== 'su_kien' || !o.su_kien) return false;
  return o.su_kien === 'hack_san' || TINH_CHAT_NEN[o.su_kien as SuKienId] === 'hoang_loan';
}

/** Ô `idx` có làm ngân hàng đổ vỡ không: lá kích hoạt + `SO_LA_XAU_TRUOC` lá xấu liền ngay trước. Thuần. */
export function nganHangDoVoTai(o: readonly (OMatChu | undefined)[], idx: number): boolean {
  const la = o[idx];
  if (!la || la.kind !== 'su_kien' || !NGAN_HANG_DO_VO.LA_KICH_HOAT.includes(la.su_kien as SuKienId)) return false;
  for (let k = 1; k <= NGAN_HANG_DO_VO.SO_LA_XAU_TRUOC; k += 1) {
    if (!laLaXau(o[idx - k])) return false;
  }
  return true;
}

/**
 * Phần MẤT của một ghế khi ngân hàng đổ vỡ: `⌊max(0, tổng sổ − hạn mức) × MAT_BP ÷ 10.000⌋`. Thuần, số nguyên (C5).
 * Engine chia phần này về từng hợp đồng theo tỷ lệ giá trị (`catTheoTyLe`).
 */
export function matKhiDoVo(tongSo: number): number {
  const vuot = Math.max(0, tongSo - NGAN_HANG_DO_VO.BAO_HIEM_TOI_DA);
  return Math.floor((vuot * NGAN_HANG_DO_VO.MAT_BP) / 10000);
}
