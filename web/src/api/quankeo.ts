/**
 * Hooks quản kèo cho mặt `/quan-tri` (bước 4 — bản yêu cầu 01 §5).
 *
 * ⚠ Chỉ được import từ `screens/admin/*` — cùng luật với `api/thongke.ts`, và
 * cũng có test canh. Kéo file này vào gói người chơi là kéo cả tầng admin theo.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './client';

const thuLai = (lan: number, loi: unknown): boolean => {
  if (loi instanceof ApiError && loi.status >= 400 && loi.status < 500) return false;
  return lan < 1;
};

export interface KeoDong {
  market_id: string;
  pool: string;
  question_text: string;
  status: 'draft' | 'open' | 'locked' | 'resolved' | 'cancelled';
  tu_mo: boolean;
  open_ts: string;
  lock_ts: string;
  resolve_deadline_ts: string;
  seed_per_option: string;
  volume_nguoi: string;
  so_nguoi: number;
}

export interface CuaKeo {
  label: string;
  range_low?: number | null;
  range_high?: number | null;
}

export interface ThanKeo {
  pool: string;
  question_text: string;
  resolution_source_name: string;
  resolution_source_url: string;
  open_ts: string;
  lock_ts: string;
  resolve_deadline_ts: string;
  seed_per_option: number;
  options: CuaKeo[];
}

export interface XemTruocDTO {
  nhu_nguoi_chua_dat: Record<string, unknown>;
  nhu_nguoi_da_dat: Record<string, unknown> | null;
  a31_an_phan_bo: boolean;
  co_nguoi_da_dat: boolean;
}

export interface LocKeo { tt?: string; pool?: string; q?: string; trang?: number }

const KHOA = ['admin', 'keo'] as const;

export const useDanhSachKeo = (loc: LocKeo) => {
  const p = new URLSearchParams();
  if (loc.tt) p.set('tt', loc.tt);
  if (loc.pool) p.set('pool', loc.pool);
  if (loc.q) p.set('q', loc.q);
  if (loc.trang) p.set('trang', String(loc.trang));
  const qs = p.toString();
  return useQuery({
    queryKey: [...KHOA, 'ds', loc.tt ?? '', loc.pool ?? '', loc.q ?? '', loc.trang ?? 0],
    queryFn: () => api<{ trang: number; moi_trang: number; tong: number; keo: KeoDong[] }>(
      `/admin/keo${qs ? `?${qs}` : ''}`,
    ),
    retry: thuLai,
  });
};

export const useXemTruoc = (id: string | null) =>
  useQuery({
    queryKey: [...KHOA, 'xem-truoc', id],
    queryFn: () => api<XemTruocDTO>(`/admin/keo/${id}/xem-truoc`),
    enabled: id !== null,
    retry: thuLai,
  });

/** Mọi lệnh ghi đều làm mới danh sách — không để màn hiện trạng thái đã cũ. */
function dungLenh<T, V>(chay: (v: V) => Promise<T>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chay,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KHOA] }),
  });
}

export const useSuaKeo = () =>
  dungLenh<{ ok: true }, { id: string; than: ThanKeo }>(
    ({ id, than }) => api(`/admin/keo/${id}/sua`, { method: 'POST', body: than }),
  );

export const useTaoHangLoat = () =>
  dungLenh<{ so_keo: number; market_ids: string[] }, ThanKeo[]>(
    (keo) => api('/admin/keo/hang-loat', { method: 'POST', body: { keo } }),
  );

export const useHenGio = () =>
  dungLenh<{ ok: true; tu_mo: boolean }, { id: string; bat: boolean }>(
    ({ id, bat }) => api(`/admin/keo/${id}/hen-gio`, { method: 'POST', body: { bat } }),
  );

/** Nhập lại mã hai lớp — cửa nặng cho hẹn giờ / mở / huỷ (bước 2). */
export const useXacThucLai = () =>
  useMutation({
    mutationFn: (ma: string) => api('/admin/2fa/xac-thuc-lai', { method: 'POST', body: { ma } }),
  });

/**
 * Nhân bản một thân kèo theo THÁNG — đúng nhu cầu §5 nêu ("kèo vĩ mô theo
 * tháng rất cần").
 *
 * ⚠ Cố ý KHÔNG làm ô dán JSON: dán JSON là chuyển gánh nặng cú pháp sang người
 * dùng để tiết kiệm code, mà bước này tên là TIỆN DỤNG. Dịch theo tháng lịch
 * (`setMonth`) chứ không cộng 30 ngày — kèo tháng phải rơi đúng ngày trong
 * tháng, và tháng thì dài ngắn khác nhau.
 */
export function nhanBanTheoThang(goc: ThanKeo, soThang: number): ThanKeo[] {
  /*
   * ⚠ KẸP NGÀY VÀO CUỐI THÁNG, KHÔNG ĐỂ `setMonth` TRÀN.
   *
   * `new Date('2026-01-31').setMonth(+1)` KHÔNG ra 28/02 — nó ra 03/03, vì ngày
   * 31 tháng 2 không tồn tại nên JS cộng dồn sang tháng sau. Hệ quả với đúng
   * việc này: dựng kèo tháng từ một mẫu ngày 31 thì THÁNG 2 BIẾN MẤT khỏi loạt,
   * và tháng 3 có hai kèo. Không báo lỗi, không ai để ý cho tới lúc kèo đã mở.
   *
   * "Cùng ngày ấy của tháng sau" với ngày 31 nghĩa là ngày cuối tháng — nên kẹp.
   */
  const dich = (iso: string, i: number): string => {
    const d = new Date(iso);
    const ngay = d.getUTCDate();
    const dich1 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1));
    const cuoiThang = new Date(Date.UTC(
      dich1.getUTCFullYear(), dich1.getUTCMonth() + 1, 0,
    )).getUTCDate();
    return new Date(Date.UTC(
      dich1.getUTCFullYear(), dich1.getUTCMonth(), Math.min(ngay, cuoiThang),
      d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
    )).toISOString();
  };

  const ra: ThanKeo[] = [];
  for (let i = 0; i < soThang; i += 1) {
    const mo = new Date(dich(goc.open_ts, i));
    ra.push({
      ...goc,
      // `{thang}` trong câu hỏi thay bằng tháng/năm THẬT của kèo đó.
      question_text: goc.question_text.replace(
        '{thang}', `${mo.getUTCMonth() + 1}/${mo.getUTCFullYear()}`,
      ),
      open_ts: dich(goc.open_ts, i),
      lock_ts: dich(goc.lock_ts, i),
      resolve_deadline_ts: dich(goc.resolve_deadline_ts, i),
    });
  }
  return ra;
}
