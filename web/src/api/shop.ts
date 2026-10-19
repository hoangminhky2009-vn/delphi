/**
 * SHOP — hai cửa, hai loại xu, KHÔNG đường nào nối chúng (A3.5).
 *
 * Tầng này chỉ chuyên chở. Mọi con số (giá · số dư · số bản còn lại · điều kiện mở
 * hộp) là số SERVER trả về; màn không tự cộng, không tự suy, không tự đoán trạng
 * thái sau khi bấm (C4). Cụ thể: `can_du_t` là ngưỡng server đang chặn, không phải
 * `SUBSIDY_THRESHOLD + gia_t` tính ở client — nếu ngưỡng đổi thì màn phải đổi theo,
 * không được nói một con số khác với con số đang thật sự chặn.
 */
import { api } from './client';

export type HiemMon = 'thuong' | 'hiem' | 'epic';

export interface MonBanQ {
  id: string;
  ten: string;
  loai: 'nen' | 'khung';
  /** `null` = không bán được lúc này (đã có, hoặc bản sao chưa định giá). */
  gia: number | null;
  da_so_huu: boolean;
  /** Nền mua lại được (vật tiêu hao); khung thì không (đồ đeo). */
  mua_lai_duoc: boolean;
  phien_ban: string | null;
  song: boolean;
}

export interface MonTrongHop {
  id: string;
  ten: string;
  hiem: HiemMon;
  ghi_chu: string;
  /** `null` = phát hành không giới hạn. 0 = hết bản. */
  con_lai: number | null;
  song: boolean;
}

export interface ShopCatalog {
  bankroll: number;
  quest_points: number;
  ban_q: MonBanQ[];
  hop: {
    gia_t: number;
    /** Số dư tối thiểu để mở được một hộp — server chặn theo số này. */
    can_du_t: number;
    rate_bp: Record<HiemMon, number>;
    pity: number;
    tu_epic: number;
    tong_luot: number;
    mo_duoc: boolean;
    mon: MonTrongHop[];
  };
  gia_ban_sao_them: number | null;
}

export interface KetQuaMua {
  ok: true;
  mon_id: string;
  gia_q: number;
  quest_points: number;
  avatar_id?: string;
  seri?: number;
}

export interface KetQuaHop {
  ok: true;
  bac: HiemMon;
  bac_goc: HiemMon;
  /** Bậc gốc đã cạn hàng nên trao bậc khác — phải hiện, không được im. */
  ha_bac: boolean;
  tu_pity: boolean;
  /**
   * Bốc trúng lá ĐÃ SỞ HỮU (món độc bản) ⇒ lượt này KHÔNG trừ T.
   *
   * Founder gọi là "hoàn T" (D68a); server cài thành "không trừ" vì `burn_ledger`
   * append-only nên đốt-rồi-hoàn là mint (A3.4). Màn PHẢI nói ra — không thì
   * người chơi đọc thành mất tiền, đúng điều D68 dặn tránh.
   */
  trung?: boolean;
  /** Số T không bị trừ ở lượt trùng (server trả, client không tự suy). */
  hoan_t?: number;
  /**
   * `loai`/`ma`: hộp rơi CẢ nhãn dán lẫn ảnh nền từ 04/08, mà hai họ vẽ bằng hai
   * lưới khác nhau (32×32 vs ≤14×8). Server trả ra thay vì để client tra theo id
   * — một bảng tra ở client là nguồn chân lý thứ hai và nó sẽ lệch.
   */
  mon: {
    id: string; ten: string; con_lai: number | null;
    loai?: 'sticker' | 'nen'; ma?: string | null;
    avatar_id?: string; seri?: number;
  };
  bankroll: number;
  tu_epic: number;
  /** Hạt ngẫu nhiên của lượt này — để người chơi kiểm lại được. */
  hat: number;
}

export const shopApi = {
  catalog: () => api<ShopCatalog>('/shop/catalog'),
  mua: (monId: string) =>
    api<KetQuaMua>('/shop/mua', { method: 'POST', body: { mon_id: monId } }),
  moHop: () => api<KetQuaHop>('/shop/hop', { method: 'POST', body: {} }),
};
