/**
 * BÁCH KHOA — kênh ĐỌC THUẦN (D334). Cùng luật với `api/tinh_cach`: chỉ `useQuery`, không mutation, không
 * import runtime nào của ví trận — màn bách khoa đọc luật chơi, không đụng chip hay token.
 *
 * Đọc `/holdem/catalog` với ĐÚNG khoá cache của `useHoldemCatalog` (`['holdem','catalog']`): mở bách khoa sau
 * sảnh không tải lại catalog lần hai. Kiểu ở đây chỉ khai phần bách khoa dùng; `import type` không kéo module.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { KhauViDTO, NhanDTO, TietKiemDTO, TuDienDTO, VaiDTO } from '@/api/holdem';

/** Năm bậc "hay bị làm giả" + bậc riêng của Bong bóng — server/holdem/bach_khoa.ts `DoGiaBK`. */
export type DoGiaDTO = 'hiem' | 'it' | 'vua' | 'hoi_hay' | 'hay' | 'theo_lai_suat';

export interface TheTinDTO {
  tinh_chat: string;
  bao_truoc: string;
  keo_theo: string[];
  do_gia: DoGiaDTO;
}

export interface CatalogBachKhoaDTO {
  tai_san: { id: string; label: string; nhom: 'rui_ro' | 'phong_thu'; thanh_khoan: 'mong' | 'vua' | 'day'; khong_duoc?: boolean }[];
  chien_thuat: { id: string; label: string }[];
  giai_doan: NhanDTO[];
  su_kien: NhanDTO[];
  tu_dien: TuDienDTO;
  vai?: Record<string, VaiDTO>;
  mandate_to_chuc?: { TRAN_MA_BP: number };
  /** v52 (D371) — bộ số MỖI VÒNG của lá Đa Dạng Hoá. VẮNG ⇒ dòng bách khoa đọc nó tự ẩn. */
  da_dang_moi_vong?: { PHI_BP: number; MOI_MA_BP: number };
  dac_quyen?: Record<string, unknown>;
  gia_bang?: { thuong: number; luot_song: number; luot_song_du_bao: number };
  luat?: Record<string, unknown>;
  tiet_kiem?: TietKiemDTO;
  /** D406 — số của cờ ngân hàng đổ vỡ (D405). VẮNG = bộ luật mặc định không bật cờ ⇒ dòng bách khoa đọc nó tự ẩn. */
  ngan_hang_do_vo?: { BAO_HIEM_TOI_DA: number; MAT_BP: number; SO_LA_XAU_TRUOC: number };
  /** v46 (D338) — mức lãi vay Đòn Bẩy. VẮNG = bộ luật mặc định không có lãi vay ⇒ dòng bách khoa đọc nó tự ẩn. */
  lai_vay_don_bay?: { HE_SO_NEN_BP: number; PHAN_BU_BP: number };
  khau_vi?: KhauViDTO[];
  /** OPTIONAL: API và bundle deploy bằng hai lệnh riêng — API cũ chưa có thì phần luật thẻ tin tự ẩn. */
  bach_khoa?: {
    bien_dong_hang: Record<string, number>; the_tin: Record<string, TheTinDTO>;
    /** D495 — số của màn lõi (server `soMinigameBK`). Vắng ở API cũ ⇒ dòng số của các mục màn lõi tự ẩn. */
    minigame?: Record<string, number | number[]>;
  };
}

export function useCatalogBachKhoa(enabled: boolean) {
  return useQuery({
    queryKey: ['holdem', 'catalog'],
    queryFn: () => api<CatalogBachKhoaDTO>('/holdem/catalog'),
    enabled,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
