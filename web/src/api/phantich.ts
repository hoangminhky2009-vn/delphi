/**
 * Hooks đọc tầng PHÂN TÍCH của app quản trị riêng (`/admin/pt/*`, D335).
 *
 * ⚠ CHỈ import từ `src/quan-tri/` — cùng luật tách gói với `api/thongke.ts` (`web/tests/quantri.test.tsx` canh).
 * ⚠ KHÔNG khai lại hình dạng phản hồi ở đây. Nó nằm ở `server/admin_phan_tich_ids.ts` và route máy chủ gắn kiểu trả
 *   về từ CÙNG tệp đó — bản đầu có một bộ interface "gương" chép tay ở đây, tức hai bản sẽ trôi (D61) mà không bài
 *   nào đỏ. Tên `…DTO` phía web giữ nguyên chỉ để màn không phải đổi.
 */
import {
  keepPreviousData, useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient,
} from '@tanstack/react-query';
import type {
  ChiaNhomTraVe, DieuKien, DsNguoiTraVe, DsNhomLuuTraVe, HanhTrinhTraVe, KeoTraVe, LuuNhomTraVe, MotNguoiTraVe,
  PhienBanTraVe, TheoChia, TinhCachTraVe, TinhNhomTraVe, TongQuanTraVe, TranTraVe,
} from '@server/admin_phan_tich_ids';
import { api, ApiError } from './client';

export type {
  ChiaNhomTraVe as ChiaNhomDTO, ChiSoNhom as ChiSoNhomDTO, DieuKien as DieuKienDTO, DongNguoi as DongNguoiDTO,
  DsNguoiTraVe as DsNguoiDTO, KhoangTraVe as KhoangDTO, MotNguoiTraVe as MotNguoiDTO, NgayDong as NgayDongDTO,
  NhomLuu as NhomLuuDTO, OGiuChan as OGiuChanDTO, OSo as OSoDTO, Phien as PhienDTO, QuayLai as QuayLaiDTO,
  SuKien as SuKienDTO, TheoChia, TinhNhomTraVe as TinhNhomDTO, TongQuanTraVe as TongQuanPTDTO,
  HanhTrinhTraVe as HanhTrinhDTO, KeoTraVe as KeoDTO, ManCuoiSP, PhienBanTraVe as PhienBanDTO,
  TinhCachTraVe as TinhCachTkDTO, TranTraVe as TranDTO,
} from '@server/admin_phan_tich_ids';

const thuLai = (lan: number, loi: unknown): boolean => {
  if (loi instanceof ApiError && loi.status >= 400 && loi.status < 500) return false;
  return lan < 1;
};

export interface ThamSoKhoang { tu: string; den: string; gom: boolean }

const qsKhoang = (k: ThamSoKhoang): string => `tu=${k.tu}&den=${k.den}${k.gom ? '&gom=1' : ''}`;

/* ── Tổng quan ───────────────────────────────────────────────────────────── */

export function useTongQuanPT(k: ThamSoKhoang) {
  return useQuery({
    queryKey: ['admin', 'pt', 'tong-quan', k],
    queryFn: () => api<TongQuanTraVe>(`/admin/pt/tong-quan?${qsKhoang(k)}`),
    retry: thuLai,
    placeholderData: keepPreviousData,
  });
}

/* ── Người dùng ──────────────────────────────────────────────────────────── */

export type SapNguoi = 'cuoi' | 'phien' | 'tran' | 'tao';

export function useDsNguoiPT(k: ThamSoKhoang, o: { tim: string; loc: string[]; sap: SapNguoi; trang: number }) {
  const qs = `${qsKhoang(k)}&tim=${encodeURIComponent(o.tim)}&loc=${o.loc.join(',')}&sap=${o.sap}&trang=${o.trang}`;
  return useQuery({
    queryKey: ['admin', 'pt', 'nguoi', k, o],
    queryFn: () => api<DsNguoiTraVe>(`/admin/pt/nguoi?${qs}`),
    retry: thuLai,
    placeholderData: keepPreviousData,
  });
}

/** Dòng thời gian tải từng lượt: lượt sau đọc tiếp các ngày cũ hơn `con_nua_truoc`. */
export function useMotNguoiPT(handle: string, k: ThamSoKhoang) {
  return useInfiniteQuery({
    queryKey: ['admin', 'pt', 'mot-nguoi', handle, k.tu, k.den],
    initialPageParam: '',
    queryFn: ({ pageParam }) => api<MotNguoiTraVe>(
      `/admin/pt/nguoi/${encodeURIComponent(handle)}?tu=${k.tu}&den=${k.den}${pageParam ? `&truoc=${pageParam}` : ''}`),
    getNextPageParam: (trang) => trang.con_nua_truoc ?? undefined,
    retry: thuLai,
  });
}

/* ── Phân khúc ───────────────────────────────────────────────────────────── */

const KEY_LUU = ['admin', 'pt', 'phan-khuc', 'luu'] as const;

export function useNhomLuu() {
  return useQuery({
    queryKey: KEY_LUU,
    queryFn: () => api<DsNhomLuuTraVe>('/admin/pt/phan-khuc'),
    retry: thuLai,
  });
}

export function useLuuNhom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { ten: string; dieu_kien: DieuKien }) =>
      api<LuuNhomTraVe>('/admin/pt/phan-khuc', { method: 'POST', body: b }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY_LUU }); },
  });
}

export function useXoaNhom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/admin/pt/phan-khuc/${id}/xoa`, { method: 'POST' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY_LUU }); },
  });
}

/** Tính 1–4 nhóm một lượt, cùng một ảnh chụp dữ liệu — hai cột so sánh không lệch nhau vì đọc hai lúc. */
export function useTinhNhom(nhom: DieuKien[], k: ThamSoKhoang) {
  return useQuery({
    queryKey: ['admin', 'pt', 'phan-khuc', 'tinh', nhom, k],
    queryFn: () => api<TinhNhomTraVe>('/admin/pt/phan-khuc/tinh', {
      method: 'POST', body: { nhom, tu: k.tu, den: k.den, gom: k.gom },
    }),
    enabled: nhom.length > 0,
    retry: thuLai,
    placeholderData: keepPreviousData,
  });
}

export function useChiaNhom(dk: DieuKien | null, theo: TheoChia, k: ThamSoKhoang) {
  return useQuery({
    queryKey: ['admin', 'pt', 'phan-khuc', 'chia', dk, theo, k],
    queryFn: () => api<ChiaNhomTraVe>('/admin/pt/phan-khuc/chia', {
      method: 'POST', body: { dieu_kien: dk, theo, tu: k.tu, den: k.den, gom: k.gom },
    }),
    enabled: dk !== null,
    retry: thuLai,
    placeholderData: keepPreviousData,
  });
}

/**
 * Cỡ của MỌI nhóm đã lưu — gom từng lượt 4 nhóm (trần của route), mỗi lượt một ảnh chụp. Trả mảng cùng thứ tự
 * với `ds`; phần tử `undefined` = đang tải.
 */
export function useCoNhieuNhom(ds: DieuKien[], k: ThamSoKhoang): Array<{ n: number | null } | undefined> {
  const lo: DieuKien[][] = [];
  for (let i = 0; i < ds.length; i += 4) lo.push(ds.slice(i, i + 4));
  const kq = useQueries({
    queries: lo.map((nhom) => ({
      queryKey: ['admin', 'pt', 'phan-khuc', 'tinh', nhom, k],
      queryFn: () => api<TinhNhomTraVe>('/admin/pt/phan-khuc/tinh', {
        method: 'POST', body: { nhom, tu: k.tu, den: k.den, gom: k.gom },
      }),
      retry: thuLai,
    })),
  });
  return kq.flatMap((q, i) => (q.data ? q.data.nhom.map((x) => ({ n: x.n })) : lo[i]!.map(() => undefined)));
}

/* ── Sản phẩm (D341) — năm mặt `/admin/tk/*` ĐỌC THEO KHOẢNG ─────────────── */

/**
 * URL một mặt SẢN PHẨM: khoảng của thanh thời gian + công tắc gồm (HAI cờ — máy chủ tách rời cho bài D224).
 *
 * ⚠ Khoảng lấy thẳng từ URL (`docTrangThai`), KHÔNG từ phản hồi tổng quan. Trước D341 màn gửi `ngay` đọc từ
 *   `tong-quan.khoang.so_ngay`: tổng quan còn đang tải (giữ bản cũ) thì mặt đọc số của mốc CŨ dưới nhãn mốc mới,
 *   tổng quan lỗi thì mặt kẹt ở 30 ngày.
 * ⚠ Dựng bằng `URLSearchParams`, không nối tay `?`/`&` (bài học D212, `api/thongke.ts`).
 */
export function urlSanPham(duong: string, k: ThamSoKhoang, them: Record<string, string> = {}): string {
  const p = new URLSearchParams({ ...them, tu: k.tu, den: k.den });
  if (k.gom) { p.set('gom_admin', '1'); p.set('gom_tester', '1'); }
  return `/admin/tk/${duong}?${p}`;
}

/*
 * ⚠ KHÔNG `keepPreviousData` ở năm mặt này, có chủ đích: đổi mốc thì mặt hiện "đang tải…" chứ không giữ số của khoảng
 *   cũ dưới nhãn khoảng mới — đúng cái founder thấy trên prod (16/09).
 */
export const useHanhTrinhSP = (k: ThamSoKhoang) => useQuery({
  queryKey: ['admin', 'sp', 'hanh-trinh', k],
  queryFn: () => api<HanhTrinhTraVe>(urlSanPham('hanh-trinh', k)),
  retry: thuLai,
});

/** @param ver `undefined` ⇒ để máy chủ chọn mặc định (= phiên bản đang chạy); `'tat_ca'` ⇒ mọi bản còn dựng lại được. */
export const useTranSP = (ver: string | undefined, k: ThamSoKhoang) => useQuery({
  queryKey: ['admin', 'sp', 'tran', ver ?? '', k],
  queryFn: () => api<TranTraVe>(urlSanPham('tran', k, ver ? { ver } : {})),
  retry: thuLai,
});

export const useKeoSP = (k: ThamSoKhoang) => useQuery({
  queryKey: ['admin', 'sp', 'keo', k],
  queryFn: () => api<KeoTraVe>(urlSanPham('keo', k)),
  retry: thuLai,
});

export const useTinhCachSP = (k: ThamSoKhoang) => useQuery({
  queryKey: ['admin', 'sp', 'tinh-cach', k],
  queryFn: () => api<TinhCachTraVe>(urlSanPham('tinh-cach', k)),
  retry: thuLai,
});

export const usePhienBanSP = (k: ThamSoKhoang) => useQuery({
  queryKey: ['admin', 'sp', 'phien-ban', k],
  queryFn: () => api<PhienBanTraVe>(urlSanPham('phien-ban', k)),
  retry: thuLai,
});

/* ══════════════════════════════════════════════════════════════════════════
 * KHU TESTER (D362) — mặt DUY NHẤT trả dòng theo người
 * ══════════════════════════════════════════════════════════════════════════ */

export interface DongTester extends Record<string, unknown> {
  /** D392 — khoá GHÉP PHIẾU (mã app tự điền vào ba Google Form). `ma_tham_gia` là mã theo TRẬN. */
  ma_buoi_do: string;
  ma_tham_gia: string; dot: string; ban_ma: string;
  trang_thai_tran: string; hang: number | null; so_ghe: number | null; von_cuoi: number | null;
  so_vong: number | null; vong_quyet: number | null; vong_tu_dong: number | null;
  brier_tb: number | null; tiet_kiem_bp: number | null; tk_huy_so: number | null;
  /** D404 — TỔNG lần rút sổ sớm (`tk_huy_so` là MAX theo vòng, đọc nhầm thành "số lần"). */
  tk_huy_so_tong: number | null;
  ms_quyet_tb: number | null;
  phoi_nhiem_tb: number | null; so_ma_tb: number | null;
  /** D404 — bước tester (0–5) · bậc ba năng lực của ĐÚNG trận này · nhóm tuổi · cờ ghi telemetry. */
  buoc: number | null;
  bac_cam_ket_tiet_kiem: string | null; bac_doc_tin: string | null; bac_phan_tan: string | null;
  the_tinh_vao: boolean | null;
  nhom_tuoi: string | null; ghi_telemetry: boolean | null; ban_tap_xong: boolean | null;
  de_id: string | null; vai: string | null;
  pfm_bat_dau: string; hv_ngay_co_ghi: unknown;
  app_so_man_vao: number | null; app_man_cuoi: string | null; app_thoat_vong: string | null;
  app_so_loi_client: number | null;
}

export interface DotThuTraVe {
  dot: string | null;
  cac_dot: Array<{ nhan: string | null; n: number }>;
  consent_ban: string;
  thong_ke: { dong_y: number; da_rut: number; loai_ban_cu: number; tran: number; tran_da_dung: number };
  nguoi: DongTester[];
  vong: Array<Record<string, unknown>>;
}

/**
 * ⚠ KHÔNG nhận `ThamSoKhoang`: đợt thử nghiệm là một NHÓM NGƯỜI, không phải một khoảng ngày. Cắt theo
 * ngày ở đây là cắt mất chính những người mới vào hôm qua — thứ đang cần đọc nhất.
 */
export const useDotThu = (dot: string | null) => useQuery({
  queryKey: ['admin', 'dot-thu', dot ?? ''],
  // ⚠ ĐƯỜNG TƯƠNG ĐỐI: `api()` tự gắn tiền tố `/api/v1`. Bản đầu tôi viết đường tuyệt đối và nó
  // gọi `/api/v1/api/v1/admin/dot-thu` — 404 im lặng, `tsc` xanh, 80 bài test xanh. Chỉ lượt soi
  // mắt bắt được (D362).
  queryFn: () => api<DotThuTraVe>(`/admin/dot-thu${dot ? `?dot=${encodeURIComponent(dot)}` : ''}`),
  retry: thuLai,
});
