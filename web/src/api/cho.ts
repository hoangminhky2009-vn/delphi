/**
 * CHỢ — hai cửa với Hệ thống: BÁN (B7a, M1) và MUA (B7b, M2).
 *
 * Tầng này chỉ chuyên chở. `gia` và `mo` là số SERVER trả — màn không tự tính giá
 * theo bậc, không tự suy "quỹ còn đủ không" (C4). Nếu server đổi công thức, màn
 * phải đổi theo, không được nói một con số khác với con số đang thật sự trả.
 *
 * Cờ chợ tắt ⇒ mọi route ở đây trả 403 `feature_disabled`; màn ẩn cả mục, không
 * để một cái nút chết trên prod.
 */
import { api } from './client';

export interface BanTheCuaToi {
  ban_the_id: string;
  mau_id: string;
  ten: string;
  seri: number;
  /** T Hệ thống sẽ trả lúc này. */
  gia: number;
  /** Cửa có mở cho bản này không. */
  mo: boolean;
  /**
   * VÌ SAO đóng — mã, chữ ở client (D26). `khong_ban_lai` = món chưa từng có
   * cửa tốn T để lấy (quà/battle pass), Hệ thống không mua lại (E24);
   * `quy_khong_du` = tạm thời, mai quỹ dày thì bán được. Hai câu này KHÁC nhau
   * và nói nhầm là hứa nhầm.
   */
  ly_do: 'khong_ban_lai' | 'quy_khong_du' | null;
}

export interface KhoCuaToi {
  quy_cho: number;
  mon: BanTheCuaToi[];
}

export interface KetQuaBan {
  ok: true;
  ban_the_id: string;
  gia: number;
  bankroll: number;
  quy_cho: number;
}

export interface BanTheTrenQuay {
  ban_the_id: string;
  mau_id: string;
  ten: string;
  seri: number;
  /** Số bản cùng mẫu Hệ thống đang giữ — càng nhiều thì càng rẻ. */
  ton: number;
  /** T phải trả lúc này (đã gồm spread). */
  gia: number;
  /** Mua được không: giá > 0, ví đủ, VÀ mua xong vẫn trên lưới trợ cấp. */
  mo: boolean;
}

export interface QuayHeThong {
  bankroll: number;
  mon: BanTheTrenQuay[];
}

export interface KetQuaMua {
  ok: true;
  ban_the_id: string;
  gia: number;
  /** Phí THỰC THU — ở giá nhỏ hai số này làm tròn về 0, và màn nói thật điều đó. */
  phi_dot: number;
  phi_kho_bac: number;
  bankroll: number;
  quy_cho: number;
}

export const choApi = {
  cuaToi: () => api<KhoCuaToi>('/cho/cua-toi'),
  ban: (banTheId: string) =>
    api<KetQuaBan>('/cho/ban', { method: 'POST', body: { ban_the_id: banTheId } }),
  quay: () => api<QuayHeThong>('/cho/quay'),
  mua: (banTheId: string) =>
    api<KetQuaMua>('/cho/mua', { method: 'POST', body: { ban_the_id: banTheId } }),
};
