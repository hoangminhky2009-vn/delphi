/**
 * PFM — MẶT API CỦA CLIENT. Mọi màn PFM gọi qua đây, không gọi `api()` trực tiếp.
 *
 * ⚠⚠ VÌ SAO CÓ TẦNG NÀY chứ không để màn hình gọi thẳng `api()`: bảy đường PFM có
 * **hình dây riêng** khai ở `config/` (`MonLo`, `CONSENT_PHIEN_BAN`, tham số truy vấn
 * của két). Để mỗi màn tự ghép chuỗi truy vấn và tự nhớ tên field là dựng bảy bản sao
 * của cùng một giao ước — A11.5/D61 — và bản thứ hai SẼ trôi. Ở đây là MỘT nguồn.
 *
 * ⚠ TẦNG NÀY KHÔNG SUY DIỄN GÌ (C4). Nó chuyên chở: ghép đường, gọi, trả nguyên. Mọi
 * con số hiển thị là số server trả về.
 *
 * ⚠ KHÔNG BẮT LỖI Ở ĐÂY. `ApiError` đi thẳng lên người gọi — driver đồng bộ cần phân
 * biệt "chưa tới máy chủ" (giữ hàng đợi, gửi lại) với "máy chủ đã trả lời là không"
 * (bỏ món), mà một `try/catch` nuốt lỗi ở tầng chuyên chở thì xoá mất chính sự phân
 * biệt ấy. Xem `ApiError.chuaToiMayChu`.
 */
import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys, useMe } from './queries';
import type { MeResponse } from './types';
import { CONSENT_PHIEN_BAN, CUA_PFM, vanBanCua, type CuaPfm } from '@config/pfm_consent';
import type { MonLo, KetMon } from '@config/pfm_dong_bo';
import type { MaTrangThaiNgay } from '@config/pfm_events';

/* ══ 1. CONSENT — BỐN CỬA (D295) ════════════════════════════════════════════ */

/** Phản hồi của `POST /pfm/consent` — nguyên hình server trả, không suy diễn (C4). */
export interface KetQuaConsentApi {
  ok: true;
  /** `false` = cửa đã ở trạng thái ấy rồi; server không ghi vết trùng. */
  doi: boolean;
  cua: Record<CuaPfm, boolean>;
  /** Cột gộp cũ = có ít nhất một cửa bật — `/me` và thống kê vẫn đọc nó. */
  pfm_consent: boolean;
  pfm_bat_dau: string | null;
}

/**
 * BẬT MỘT CỬA.
 *
 * ⚠⚠ BẤT ĐỐI XỨNG CÓ CHỦ ĐÍCH (R1/D250): **bật** phải kèm vết văn bản
 * (`van_ban_id` + `phien_ban`) vì đó là hành vi đồng ý và phải chứng minh được;
 * **tắt** là RÚT LẠI, và rút lại thì không bao giờ được dựng thêm rào.
 * ⚠ Văn bản là CỦA CỬA ẤY (`vanBanCua`) và phiên bản lấy từ `CONSENT_PHIEN_BAN` — KHÔNG
 * gõ tay ở màn hình. Server chỉ nhận cặp (văn bản của đúng cửa, bản ĐANG hiệu lực), nên
 * một chuỗi gõ tay là một cú 400 chờ sẵn ngày văn bản đổi; và gửi văn bản của cửa này để
 * mở cửa kia là ghi ra một vết "chứng minh" điều không xảy ra.
 */
export async function batCua(cua: CuaPfm): Promise<KetQuaConsentApi> {
  const vanBan = vanBanCua(cua);
  return api('/pfm/consent', {
    method: 'POST',
    body: { cua, bat: true, van_ban_id: vanBan, phien_ban: CONSENT_PHIEN_BAN[vanBan] },
  });
}

/** TẮT MỘT CỬA — không kèm vết văn bản (xem `batCua`). Không xoá dữ liệu (P9 là việc của `xoaSachPfm`). */
export async function tatCua(cua: CuaPfm): Promise<KetQuaConsentApi> {
  return api('/pfm/consent', { method: 'POST', body: { cua, bat: false } });
}

/**
 * Bốn cửa từ `/me`. `null` = CHƯA BIẾT hoặc bốn cửa đóng (khách · chưa tải · `pfm: null`).
 *
 * ⚠ Trả `null` chứ không trả "bốn false" cho ca chưa biết: người gọi làm cổng (driver
 * đồng bộ) cần phân biệt "đã hỏi và không cửa nào mở" với "chưa hỏi xong" — cả hai đều
 * không được gửi gì, nhưng chỉ ca đầu mới nên tiêu cái "một lần mỗi phiên".
 * ⚠ `pfm` có mà thiếu `cua` (bản máy chủ cũ trong cache PWA) ⇒ bốn cửa ĐÓNG — P7/D62:
 * thiếu là vắng, không phải bật; hỏng về phía không gửi gì đi.
 */
export function cuaTuMe(me: MeResponse | null | undefined): Record<CuaPfm, boolean> | null {
  const p = me?.pfm;
  if (!p) return null;
  const ra = {} as Record<CuaPfm, boolean>;
  for (const k of CUA_PFM) ra[k] = p.cua?.[k] === true;
  return ra;
}

/** Bốn cửa của người đang đăng nhập, ổn định theo `/me` (memo) — cho màn Cài đặt và driver. */
export function useCuaPfm(): Record<CuaPfm, boolean> | null {
  const { data } = useMe();
  return useMemo(() => cuaTuMe(data), [data]);
}

/**
 * Bật/tắt MỘT cửa rồi làm tươi `/me` — trạng thái cửa sống ở đó, và mọi màn đọc từ đó.
 * ⚠ KHÔNG nuốt lỗi: `ApiError` đi thẳng lên màn (xem khối đầu tệp). Không tự thử lại —
 * đây là một hành vi đồng ý, không phải một cú đọc.
 */
export function useDoiCua() {
  const qc = useQueryClient();
  return useMutation<KetQuaConsentApi, Error, { cua: CuaPfm; bat: boolean }>({
    mutationFn: ({ cua, bat }) => (bat ? batCua(cua) : tatCua(cua)),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.me }); },
  });
}

/* ══ 2. ĐIỂM DANH · TUẦN ════════════════════════════════════════════════════ */

export interface KetQuaDiemDanhApi {
  ngay: string;
  trang_thai: MaTrangThaiNgay;
  moi: boolean;
  bo_qua: boolean;
  chuoi: number;
  token_thuong: number;
}

/**
 * ⚠ KHÔNG gửi `ngay`. Server tự tính "hôm nay" theo `users.mui_gio` (K7) — mọi thứ có
 * tiền thưởng đứng sau đều do đồng hồ server quyết. Xem `web/src/pfm/thoi_gian.ts`.
 */
export async function diemDanh(trangThai: MaTrangThaiNgay): Promise<KetQuaDiemDanhApi> {
  return api('/pfm/diem-danh', { method: 'POST', body: { trang_thai: trangThai } });
}

export interface KetQuaNiemPhongApi {
  tuan: string;
  moi: boolean;
  tokenThuong: number;
  soNgayCoMat?: number;
}

/**
 * Niêm phong tuần GẦN NHẤT ĐÃ KẾT THÚC (R4/D251) — server tự chọn tuần, client không nêu.
 * ⚠ Có thể trả **409 `chua_diem_danh_hom_nay`**: đúng vào Chủ nhật, tuần được niêm phong
 * kết thúc HÔM NAY, nên phải điểm danh xong rồi mới chốt — không thì ngày cuối ấy bị
 * khoá ra ngoài vĩnh viễn. Màn hình phải hiện lời mời điểm danh, không phải báo lỗi.
 */
export async function niemPhongTuan(): Promise<KetQuaNiemPhongApi> {
  return api('/pfm/tuan', { method: 'POST', body: {} });
}

/**
 * ⭐ TRẠNG THÁI TUẦN ĐI KÈM `/me`, KHÔNG PHẢI MỘT ROUTE RIÊNG (server/app.ts §`/auth/me`,
 * T5.9/K11): tách ra là thêm một request mỗi lần mở app trong ngân sách 1M lượt/tháng.
 *
 * ⚠ `null` = CHƯA BIẾT hoặc chưa bật PFM — KHÔNG PHẢI "tuần chưa niêm phong" (P7/D62).
 * Người gọi phải phân biệt: dựng nút CHỐT SỔ TUẦN từ một `null` là mời người dùng bấm
 * một nút chắc chắn 4xx.
 *
 * ⚠ HÌNH DẠNG KHAI TẠI CHỖ, KHÔNG SỬA `MeResponse`. Khối `pfm` của `/auth/me` là
 * optional (bản máy chủ cũ trong cache PWA không có nó — đúng nếp `hoi_nhan_khau`), và
 * nó chỉ có ĐÚNG MỘT người đọc là màn GƯƠNG. Đọc có kiểm ở đây, không tin mù.
 */
export interface TrangThaiTuanPfm {
  tuan: string;
  daNiemPhong: boolean;
  tokenThuong: number;
  soNgayCoMat: number;
}

interface MePfmTuan {
  pfm?: {
    tuan?: unknown;
    tuan_da_niem_phong?: unknown;
    tuan_token_thuong?: unknown;
    tuan_so_ngay_co_mat?: unknown;
  } | null;
}

const soAnToan = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function useTrangThaiTuan(): TrangThaiTuanPfm | null {
  const { data } = useMe();
  const p = (data as (MePfmTuan | null | undefined))?.pfm;
  if (!p || typeof p.tuan !== 'string') return null;
  return {
    tuan: p.tuan,
    daNiemPhong: p.tuan_da_niem_phong === true,
    tokenThuong: soAnToan(p.tuan_token_thuong),
    soNgayCoMat: soAnToan(p.tuan_so_ngay_co_mat),
  };
}

/**
 * NIÊM PHONG TUẦN — cú bấm một chiều, nên nó KHÔNG tự thử lại (mặc định `retry` của
 * `makeQueryClient` chỉ áp cho query, không cho mutation).
 *
 * ⚠ Vô hiệu hoá `/auth/me` sau khi thành công: `tuan_da_niem_phong` sống ở đó, nên bỏ
 * bước này thì nút đáy vẫn mời bấm lần nữa cho một tuần đã chốt — và cú bấm thứ hai trả
 * lỗi ở một màn vừa báo thành công.
 * ⚠ KHÔNG nuốt lỗi: `ApiError` đi thẳng lên màn (xem khối đầu tệp). 409
 * `chua_diem_danh_hom_nay` là một câu trả lời có nghĩa, không phải một sự cố.
 */
export function useNiemPhongTuan() {
  const qc = useQueryClient();
  return useMutation<KetQuaNiemPhongApi, Error, void>({
    mutationFn: niemPhongTuan,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.me }); },
  });
}

/* ══ 3. ĐỒNG BỘ LÔ ══════════════════════════════════════════════════════════ */

export interface KetQuaDongBoApi {
  ok: true;
  ket: KetMon[];
  ghi: number;
  trung: number;
  bo: number;
}

/**
 * Gửi một lô hỗn hợp (gói đặc trưng + nhịp sự kiện).
 *
 * ⚠ `mon` phải là bản ĐÃ RA DÂY (`raWire` ở `web/src/pfm/dong_bo.ts`), không phải món
 * trong máy — hai hình khác nhau, và đó là chỗ đã sinh ra R8.
 * ⚠ Kết quả TỪNG MÓN nằm ở `ket`, theo đúng thứ tự gửi. Người gọi phải đọc nó: một lô
 * 200 vẫn có thể chứa món `bo`, và bỏ qua `ket` là vứt dữ liệu mà không đếm.
 */
export async function guiLo(mon: readonly MonLo[]): Promise<KetQuaDongBoApi> {
  return api('/pfm/dong-bo', { method: 'POST', body: { mon } });
}

/* ══ 4. KÉT (nhị phân) ══════════════════════════════════════════════════════ */

export interface KetQuaLuuApi { ok: true; ver: number }

/**
 * GHI một lát két. `than` là ciphertext do máy user khoá — server KHÔNG có chìa (P2 🔒).
 *
 * ⚠ `ver` là bản client ĐANG cầm, không phải bản nó muốn tạo. Server so rồi mới ghi
 * (K8 chống ghi đè mù) và trả về `ver` mới. Lệch ⇒ **409 `ver_cu`** kèm `ver` thật —
 * người gọi phải đọc lại rồi hoà giải, đừng thử lại với cùng con số.
 * ⚠ `thang` dùng `thangGuiLen()` để lát SỐNG (hũ/luật/mẫu lặp) ra đúng mốc
 * `LAT_SONG_THANG` — chúng sống xuyên tháng nên không có tháng nào để nằm vào (R15).
 */
export async function luuKet(
  thang: string, schemaV: number, ver: number, than: Uint8Array,
): Promise<KetQuaLuuApi> {
  const q = new URLSearchParams({ thang, schema_v: String(schemaV), ver: String(ver) });
  return api(`/pfm/luu?${q}`, { method: 'POST', than });
}

/**
 * ĐỌC một lát két. `theHe` 1 = mới nhất (mặc định); 2/3 = hai bản lùi (K8 giữ ba thế hệ).
 * ⚠ Trả `null` khi chưa có lát nào — server 404, và "chưa từng sao lưu" là trạng thái
 * BÌNH THƯỜNG của người mới, không phải lỗi để ném lên màn hình.
 */
export interface LatDaDoc {
  than: ArrayBuffer;
  /** `ver` server đang giữ cho lát này — đọc từ `X-Pfm-Ver`. */
  ver: number;
  schemaV: number;
}

export async function docKet(thang: string, theHe?: 1 | 2 | 3): Promise<LatDaDoc | null> {
  const q = new URLSearchParams({ thang });
  if (theHe !== undefined) q.set('the_he', String(theHe));
  let dau: Headers | undefined;
  try {
    const than = await api<ArrayBuffer>(`/pfm/luu?${q}`, {
      raNhiPhan: true, nhanDau: (h) => { dau = h; },
    });
    /*
     * ⚠ SỐ KHÔNG ĐỌC ĐƯỢC ⇒ `0`, KHÔNG PHẢI `NaN`. `NaN` đi tiếp thành `ver=NaN` trên
     * query và server trả 400 `ver_khong_hop_le` — một lỗi vô nghĩa cho người dùng. `0`
     * thì đi vào đúng đường đã có: 409 `ver_cu` kèm `ver` thật, không tốn suất (R3).
     */
    return { than, ver: soDau(dau, 'X-Pfm-Ver'), schemaV: soDau(dau, 'X-Pfm-Schema-V') };
  } catch (e) {
    if (e instanceof Error && 'status' in e && (e as { status: number }).status === 404) {
      return null;
    }
    throw e;
  }
}

function soDau(dau: Headers | undefined, ten: string): number {
  const n = Number(dau?.get(ten));
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/* ══ 5. XOÁ SẠCH (P9 🔒) ════════════════════════════════════════════════════ */

/**
 * ⚠ Đường MỘT CHIỀU. Màn gọi nó phải có nút giữ-2-giây, không phải một cú chạm.
 * Server xoá mọi bảng `pfm_*` của user trong một transaction và trả thống kê từng bảng.
 */
export async function xoaSachPfm(): Promise<{ ok: true; da_xoa: Record<string, number> }> {
  return api('/pfm/xoa', { method: 'POST', body: {} });
}
