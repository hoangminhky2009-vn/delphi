/**
 * Hooks đọc tầng số quản trị cũ: `/api/v1/admin/tk/tong-quan` (sức khoẻ hệ thống) + kho dữ liệu thô.
 * Năm mặt SẢN PHẨM (`/tk/hanh-trinh|tran|keo|tinh-cach|phien-ban`) dời sang `api/phantich.ts` từ D341 — đọc theo
 * khoảng ngày, hình dạng phản hồi ở hợp đồng `server/admin_phan_tich_ids.ts`.
 *
 * ⚠ File này CHỈ được import từ màn `/quan-tri`, và màn đó nạp trễ. Import nó
 * từ bất cứ đâu khác là kéo cả gói admin vào gói của người chơi — đúng thứ
 * §8.1 dựng ra để tránh. Có test canh (`web/tests/quantri.test.tsx`).
 */
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from './client';

/**
 * KHÔNG thử lại lỗi 4xx.
 *
 * 401/403 là câu trả lời DỨT KHOÁT — "bạn không có quyền" không đổi ý sau một
 * giây. Thử lại chỉ nhân đôi request (D11: ngân sách 1 triệu/tháng) và kéo dài
 * khoảng thời gian màn hình đứng ở "đang tải", tức làm một câu trả lời rõ ràng
 * trông như một sự cố. Lỗi 5xx và lỗi mạng thì vẫn đáng thử lại một lần.
 */
const thuLai = (lan: number, loi: unknown): boolean => {
  if (loi instanceof ApiError && loi.status >= 400 && loi.status < 500) return false;
  return lan < 1;
};

export interface LocNhom {
  tuoi: string | null;
  vung: string | null;
  nghe: string | null;
}

export interface TongQuanDTO {
  gom_admin: boolean;
  gom_tester?: boolean;
  /** Đã loại bao nhiêu vì là admin — LUÔN hiện, xem chú thích ở server. */
  da_loai: { tai_khoan: number; tran: number; events: number };
  cua_so_ngay: number;
  nguoi: { tong: number; moi_trong_cua_so: number };
  kinh_te: { audit_ok: boolean; van_de: string[]; cung: Record<string, number> };
  keo: Record<string, number>;
  /** ⚠ `tong` = kho có bao nhiêu trận, KHÔNG phải bao nhiêu trận DÙNG ĐƯỢC —
   *  hai số lệch 53% trên prod 31/08. `khong_dung_lai_duoc` là phần chênh. */
  tran: {
    tong: number; dang_choi: number; xong: number; bo_do: number;
    khong_dung_lai_duoc: number; ver_hien_tai: number;
  };
  kho: {
    tong_mb: number; tran_mb: number;
    bang: Array<{ ten: string; mb: number; uoc_dong: number }>;
  };
  loi_api: Array<{ ma: string; n: number }>;
}

/** Dựng query-string từ bộ lọc — bỏ chiều null để URL ngắn và chia sẻ được. */
export function chuoiLoc(
  loc: Partial<LocNhom>, ngay?: number, gomAdmin = false,
): string {
  const p = new URLSearchParams();
  if (loc.tuoi) p.set('tuoi', loc.tuoi);
  if (loc.vung) p.set('vung', loc.vung);
  if (loc.nghe) p.set('nghe', loc.nghe);
  if (ngay) p.set('ngay', String(ngay));
  // D335: MỘT công tắc cho hai lớp loại — tài khoản quản trị (D212) và tài khoản thử (0052). Trước đó màn chỉ
  // gửi `gom_admin`, nên bật công tắc vẫn giấu tester và người đọc không biết.
  if (gomAdmin) { p.set('gom_admin', '1'); p.set('gom_tester', '1'); }
  const s = p.toString();
  return s ? `?${s}` : '';
}

const KHOA = ['admin', 'tk'] as const;

/**
 * Công tắc "gộp cả hành vi admin" (D212).
 *
 * ⚠ MẶC ĐỊNH TẮT, và cờ phải đi vào **queryKey** chứ không chỉ vào URL: thiếu nó
 * ở khoá thì React Query trả lại bản cache của chế độ kia — người xem bấm công
 * tắc, con số không đổi, và kết luận là tính năng hỏng.
 *
 * ⚠⚠ DỰNG URL BẰNG `URLSearchParams`, KHÔNG NỐI CHUỖI. Bản đầu có một hàm
 * `cg(gom, dauTien)` tự chọn `?` hay `&` — và nó sai ngay ở chỗ đầu tiên:
 * `useDanhSachNguoi` gọi `chuoiLoc(loc)` vốn trả **rỗng** khi không lọc gì, nên
 * URL thành `/admin/tk/nguoi&gom_admin=1` ⇒ 404, bảng trắng trơn. tsc không
 * thấy, test không thấy (không bài nào bấm công tắc) — chỉ soi tay trên stack
 * thật mới lộ. Ai biết mình đang ở đầu hay giữa chuỗi truy vấn là một thứ KHÔNG
 * NÊN phải biết.
 */

export const useTongQuan = (ngay: number, gom = false) =>
  useQuery({
    queryKey: [...KHOA, 'tong-quan', ngay, gom],
    queryFn: () => api<TongQuanDTO>(`/admin/tk/tong-quan${chuoiLoc({}, ngay, gom)}`),
    retry: thuLai,
  });

/* ══════════════════════════════════════════════════════════════════════════
 * KHO DỮ LIỆU THÔ (D209) — mọi bảng, mọi cột
 * ══════════════════════════════════════════════════════════════════════════ */

export interface BangKhoDTO {
  bang: {
    ten: string; cot: number; byte: number;
    dong: number | null; dong_uoc: number;
  }[];
  tong_dong: number | null;
  tong_byte: number;
  khoa: { an_han: string[]; che: string[]; rut_gon: string[] };
}

export const useKhoBang = () =>
  useQuery({
    queryKey: ['admin', 'kho', 'bang'],
    queryFn: () => api<BangKhoDTO>('/admin/kho/bang'),
    retry: thuLai,
  });

export interface KhoDongDTO {
  ten: string;
  cot: { ten: string; kieu: string; an: 'an_han' | 'che' | 'rut_gon' | null }[];
  dong: Record<string, unknown>[];
  trang: number;
  moi: number;
  con_nua: boolean;
  sap: string;
  chieu: string;
  cat_o: number;
}

export const useKhoDong = (
  ten: string | null,
  o: { trang: number; sap: string; chieu: string; day: boolean },
) =>
  useQuery({
    queryKey: ['admin', 'kho', 'dong', ten, o.trang, o.sap, o.chieu, o.day],
    // `enabled` chứ không phải gọi rồi bỏ: chưa chọn bảng thì KHÔNG có gì để
    // hỏi, và một request rỗng vẫn ăn ngân sách 1 triệu/tháng (D11).
    enabled: ten !== null,
    queryFn: () => api<KhoDongDTO>(
      `/admin/kho/bang/${encodeURIComponent(ten as string)}`
      + `?trang=${o.trang}&sap=${encodeURIComponent(o.sap)}&chieu=${o.chieu}`
      + (o.day ? '&cat=0&moi=5' : '&moi=50')),
    retry: thuLai,
  });
