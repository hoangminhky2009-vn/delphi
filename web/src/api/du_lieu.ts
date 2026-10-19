/**
 * "DỮ LIỆU CỦA TÔI" · Ô ĐỒNG Ý NGHIÊN CỨU · BÁO LỖI — đường gọi phía web (SPEC chan-truoc-beta; server: `server/du_lieu_cua_toi.ts`,
 * `server/nghien_cuu.ts`). Tầng này chỉ chuyên chở (C4); chữ hiển thị ở `lib/nghien_cuu_chu.ts`.
 */
import { useQuery } from '@tanstack/react-query';
import { CONSENT_PHIEN_BAN } from '@config/pfm_consent';
import { api } from './client';
import { docLoiGanNhat } from '@/lib/loi_gan_nhat';
import { BAN_PHAT_HANH } from '@config/phien_ban';
import { TRUONG_GUI_KEM, type TruongGuiKem } from '@config/bao_loi';
import { manVuaRoi } from '@/lib/telemetry';

export interface DuLieuCuaToi {
  ho_so: {
    handle: string; age_band: string | null; region: string | null; occupation_band: string | null;
    created_at: string; season_id: string; la_khach: boolean;
  };
  email: string | null;
  dong_y: {
    nghien_cuu: { bat: boolean; phien_ban: string | null; hoi_lai: boolean };
    pfm: Record<'ket' | 'dac_trung' | 'thuong' | 'noi_game', boolean>;
  };
  vet_dong_y: { loai: string; luc: string; van_ban_id: string | null; phien_ban: string | null }[];
  so_tran: number;
  events: { loai: string; n: number }[];
  telemetry: number;
  bao_loi: number;
  pfm_may_chu: { bang: string; n: number }[];
}

export const KHOA_DU_LIEU = ['du-lieu-cua-toi'] as const;

export function useDuLieuCuaToi(enabled: boolean) {
  return useQuery({
    queryKey: KHOA_DU_LIEU,
    queryFn: () => api<DuLieuCuaToi>('/account/du-lieu'),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * BẬT / TẮT ô đồng ý nghiên cứu — MỘT cửa gửi cho mọi màn (Hồ sơ · tấm hỏi lại · màn nhắc xếp hạng · bậc 1). Bật luôn kèm văn bản
 * `nghien_cuu` ở bản hiện hành (server bác 400 nếu thiếu — màn đang hiện chữ nào thì vết ghi đúng chữ ấy); tắt không kèm gì.
 */
export function datNghienCuu(bat: boolean): Promise<{ ok: true; research_consent: boolean; message: string }> {
  return api('/account/consent', {
    method: 'POST',
    body: bat
      ? { research_consent: true, van_ban_id: 'nghien_cuu', phien_ban: CONSENT_PHIEN_BAN.nghien_cuu }
      : { research_consent: false },
  });
}

const BANG_XUAT = ['events', 'telemetry', 'bao_loi', 'tran'] as const;

/**
 * GOM TRỌN TỆP XUẤT: bản tóm + mọi trang của mọi bảng (server phân trang 500 dòng — xem đầu `server/du_lieu_cua_toi.ts`).
 * `trang` nhận số dòng đã gom để màn hiện tiến độ.
 */
export async function gomTepDuLieu(trang?: (soDong: number) => void): Promise<Record<string, unknown>> {
  const tom = await api<DuLieuCuaToi>('/account/du-lieu');
  const tep: Record<string, unknown> = { tai_luc: new Date().toISOString(), ...tom };
  let dem = 0;
  for (const bang of BANG_XUAT) {
    const dong: unknown[] = [];
    let sau = 0;
    for (;;) {
      const p = await api<{ dong: unknown[]; tiep: number | null }>(`/account/du-lieu/xuat?bang=${bang}&sau=${sau}`);
      dong.push(...p.dong);
      dem += p.dong.length;
      trang?.(dem);
      if (p.tiep === null) break;
      sau = p.tiep;
    }
    tep[`dong_${bang}`] = dong;
  }
  return tep;
}

/** Đưa tệp cho trình duyệt lưu — không qua máy chủ nào khác. */
export function luuTepJson(tenTep: string, noiDung: unknown): void {
  const blob = new Blob([JSON.stringify(noiDung, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = tenTep;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Giá trị từng thứ đi kèm ở dòng "Gửi kèm" (trừ `tai_khoan` — máy chủ lấy từ phiên). */
export type GiaTriGuiKem = Record<Exclude<TruongGuiKem, 'tai_khoan'>, string | null>;

/**
 * MỘT chỗ dựng giá trị đi kèm — bảng Báo lỗi vẽ dòng "Gửi kèm" từ đây và gửi đúng nó (A11.5). `man` = màn ngay TRƯỚC Hồ sơ
 * (điều khoản T5; mẫu route, không id), `ma_loi` = mã lỗi gần nhất trên máy (bộ nhớ, có thể không có).
 */
export function giaTriGuiKem(): GiaTriGuiKem {
  return { ban: BAN_PHAT_HANH, man: manVuaRoi(), ma_loi: docLoiGanNhat() };
}

/** Gửi một báo lỗi: chữ người chơi gõ + email nếu tự điền + đúng các thứ `TRUONG_GUI_KEM` — không gì khác. */
export function guiBaoLoi(noiDung: string, email: string, kem: GiaTriGuiKem = giaTriGuiKem()): Promise<{ ok: true; bao_loi_id: number }> {
  const body: Record<string, string | null> = { noi_dung: noiDung };
  for (const k of TRUONG_GUI_KEM) if (k !== 'tai_khoan') body[k] = kem[k];
  if (email.trim()) body.email = email.trim();
  return api('/bao-loi', { method: 'POST', body });
}
