/**
 * GIẢI VÒNG (D401) — ai thả bao nhiêu viên xu vào giải ở bước CHIA QUỸ.
 *
 * Số do server phát (C4): `cam_ket` của từng ghế = phần đã góp vào Quỹ vòng ở vòng này (engine `KetQuaGhe.cam_ket`,
 * công khai — poker luôn thấy đối thủ bỏ bao nhiêu vào hũ). Client KHÔNG cộng ra tiền: tổng giải là `quy_vong` của
 * server (gồm cả phí mua bán đổ vào), con số trên hộp GIẢI đọc thẳng nó. Ở đây chỉ đổi mức góp thành SỐ VIÊN XU để
 * vẽ — ghế góp nền thả 1 viên, góp nhiều hơn nền thả 2, từ gấp đôi trở lên thả 3 (trần — số nhiều nói bằng con số).
 *
 * ⚠ Không lộ gì mới: mức góp là hành động ĐÃ làm trước khi lá lật (cược), không phải kết quả. Hạng và phần chia
 *   (kết quả) KHÔNG đi qua đây — chúng tới ở bước LÃI/LỖ bằng hộp "Ăn chia cược" (founder: *"trả trước lá là lộ ai
 *   thắng"*).
 */
import type { KetQuaVongDTO } from '@/api/holdem';
import { khoaCauNoi } from './khoan_lai_lo';
import { XU_TOI_DA_MOI_GHE } from './nhip';

/**
 * Khoản "Ăn chia cược" (dòng cầu nối `quy_vong` — phần giải của CHÍNH mình, server chia theo % lãi/lỗ của vòng — D450) — khoản duy
 * nhất RƠI TỪ GIẢI ở bước LÃI/LỖ thay vì trồi tại chỗ (`KhoanNoi` · `tuGiai`).
 */
export const KHOAN_TU_GIAI = khoaCauNoi('quy_vong');

export interface GheNop {
  /** Mã ghế — `ban` là ghế mình (cùng quy ước dải ghế `DoiThuStrip`). */
  ghe: string;
  /** Số viên xu vẽ, 1…`XU_TOI_DA_MOI_GHE`. */
  xu: number;
}

/** Các ghế có góp vào giải vòng này (ghế mình trước, rồi đối thủ theo thứ tự server) và số viên xu của mỗi ghế. */
export function gheNopCuaVong(kq: Pick<KetQuaVongDTO, 'cua_ban' | 'cua_doi_thu'>): GheNop[] {
  const ds = [...(kq.cua_ban ? [kq.cua_ban] : []), ...kq.cua_doi_thu].filter((g) => g.cam_ket > 0);
  if (ds.length === 0) return [];
  const nen = Math.min(...ds.map((g) => g.cam_ket));
  return ds.map((g) => ({
    ghe: g.ghe_id,
    xu: g.cam_ket >= 2 * nen ? XU_TOI_DA_MOI_GHE : g.cam_ket > nen ? 2 : 1,
  }));
}
