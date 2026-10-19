/**
 * MÀN MINIGAME — kênh tới server (D472, bước 3 việc 7). Server: `server/holdem_api.ts` (D466) · luật nhịp: `server/holdem/minigame/man.ts`.
 *
 * Năm cửa: mở màn (idempotent) · dòng nhịp NDJSON mỗi giây một lô · hỏi một lần (đường lui khi dòng đứt, D464) · cú bấm / chọn lá (D475) ·
 * kết quả + quyết toán (D475). Client chỉ HIỂN THỊ: giá, nến, cờ trắng, tiền mỗi nút, lãi lỗ đều đến từ server (C4); không tính tiền.
 */
import { api, yeuCauApiTho } from './client';
import type { ODTO } from './holdem';

/** Đầu màn — trùng hình dạng `dauMan` ở server. Không có hình, xác suất quét, seed hay lá (không lộ kịch bản). */
export interface DauManDTO {
  vong: number;
  ma: string;
  von: number;
  dai: 'em' | 'cang' | 'rat';
  /** D470 — nấc thanh khoản của vòng (null ⇒ nấc nền của mã). */
  nac: 'can' | 'mong' | 'vua' | 'day' | 'rat_day' | null;
  bat_dau: string;
  gio_may: string;
  dem_ms: number;
  chay_ms: number;
  so_nhip: number;
  cua_so_ms: number;
  phien_ban: string;
  /** 20 nến mịn trước màn: [mở, cao, thấp, đóng]. */
  lich_su: number[][];
  /** D536 — khoá có lệnh lớn: khối lượng 20 nến mịn lịch sử (cột dưới nến). Vắng = khoá cũ (không cột khối lượng). */
  lich_su_v?: number[];
  /** D475 — lõi đang cầm (màn CHỌN LÁ) · lá đang chơi · nút của lá (rỗng = chỉ xem) · sổ tới cú bấm cuối. */
  loi_cam: string[];
  la: string | null;
  nut: string[];
  /** D561 — khoá v65: các mức đòn bẩy của Bán Khống (chỉ ×2). Vắng = [2, 4, 10] như trước. */
  muc_db_khong?: number[];
  /** D561 — khoá v65: giây chọn lá của màn = 0 (lõi chọn lúc chốt vòng). Vắng = `CHON_LA_S`. */
  chon_la_s?: number;
  /** D482 — đòn bẩy trong màn của ghế (trait ghim ĐÒN BẨY của Cá mập ×1,5). Vắng (server cũ) = `HE_SO_LOI`. */
  he?: number;
  /** D483 — TUNG TIN của Đội lái: null = ghế không được gài · phí (chip) · chiều đã gài (0 = chưa). */
  gai?: { phi: number; chieu: 1 | -1 | 0 } | null;
  /** D484 — BẢNG PHỤ: mã khác đang cầm (thứ tự cố định). Giá tới dần trong `LoNhipDTO.phu`. Vắng (server cũ) = không có. */
  phu?: string[];
  /** D561 — khoá nhiều mã: mọi mã có màn (mã chính trước) · mã chính. Chạm ô bảng phụ ⇒ sang khung nhìn mã ấy (cùng đồng hồ). Vắng = một mã. */
  nhieu_ma?: string[]; ma_chinh?: string;
  /** D561 — khoá úp lá pha: màn của ô PHA giữ lá vòng vừa chốt ÚP tới hết màn (người chơi đọc chiều từ nến). Vắng = lật trước màn như cũ. */
  up_la?: boolean;
  /** D486 — cửa sổ bấm theo trait trong màn (giây đã chạy): KIÊN NHẪN mở ở `khoa_s` · NÓNG VỘI tự chốt ở `han_s`. Vắng = không. */
  trait_man?: { khoa_s?: number; han_s?: number };
  /** D499 — ghế là TỔ CHỨC (khung minigame): nến trắng vẫn khớp (thỏa thuận) + trần thua có búa. Vắng = không. */
  to_chuc?: boolean;
  /** D500 — BÀN NGHIÊN CỨU (Tổ Chức): xác suất tạo ĐÁY / ĐỈNH theo từng khúc thời gian đều của màn. Vắng = không. */
  nghien_cuu?: { day: number[]; dinh: number[] };
  /** D528 — khoá v59: trait KÊ MUA / KÊ BÁN của ghế (hai nút + vạch lệnh) · TÂM LÝ YẾU · trần thua Tổ Chức áp khoản giữ. Vắng = không. */
  ke_trait?: { mua?: true; ban?: true };
  tam_ly_yeu?: true;
  tran_thua_giu?: true;
  so: SoManDTO;
  /** D532 — MÙ TIN: tin chỉ có vị trí (server không gửi chữ). Vắng = không. */
  mu_tin?: true;
  /** D532 — Lướt Sóng khoá v60: giá MUA TIN SỚM (chip) + đã mua chưa. Vắng = không mua được. */
  tin_mua?: { phi: number; da_mua: boolean };
  /** D532 — đã mua tin sớm: danh sách tin THẬT của màn (không theo thứ tự). ID chữ — chữ ở client (D26). */
  tin_that?: { ng: string; chu: string; noi: number }[];
  /** D532 — KIÊN NHẪN: thấy trước VỊ TRÍ (nến mịn) + uy tín mọi tin; MÙ TIN thì không có uy. */
  tin_truoc?: { ci: number; tang: number; uy?: number }[];
}

/** D532 — một tin lộ trong lô nhịp: nến mịn `ci` (0–60) · tầng xếp chồng · nguồn / ID chữ / hướng lời nói (vắng khi MÙ TIN) · thật/nhiễu (chỉ khi đã mua tin sớm). */
export interface TinLoDTO { id: number; ci: number; tang: number; ng?: string; chu?: string; noi?: number; that?: boolean }

/** D528 — một lệnh kê như server giữ: giá so với giá mở (bp) · đòn bẩy (lệnh mở ký quỹ) · khớp ở nhịp nào · vai trò lúc khớp · lý do huỷ · số lần dời. */
export interface LenhKeDTO { gia_bp: number; L: number; khop: number | null; vt: 'mo' | 'chot' | 'ban_giu' | null; huy: string | null; sua: number }
/** D528 — phần v59 của sổ / lô nhịp / kết quả. */
export interface SoV59DTO {
  ke?: { mua: LenhKeDTO | null; ban: LenhKeDTO | null };
  tly?: { nhip: number };
  khoan_giu?: { tien: number; con: number };
  /** D531 — Lướt Sóng: chiều đang cầm (0 = không) · số lần ĐẢO · phí giao dịch đã trừ. Vắng = chưa giao dịch / lõi khác. */
  ls?: { chieu: 1 | -1 | 0; so_dao: number; phi: number };
}

/** D475 — sổ của người chơi trong màn tới cú bấm cuối (không gồm phần app tự làm). Tiền mỗi nút: 0 = nút tắt. */
export interface SoManDTO {
  /** D589 — `vay`: phần ×2 của Mua Đuổi (khoá v70) — không tính vào số phần nhồi. */
  vao: { tien: number; khop: number; nhip: number; vay?: true }[];
  ra: { tien: number; ra: number; nhip: number; lai: number }[];
  hut: { nhip: number; ben: 'mua' | 'ban' }[];
  con_von: number;
  dang_cam: number;
  tien_nut: Record<string, number>;
  /** D492 — lõi Đòn Bẩy (vắng ở lõi khác / server cũ). */
  db?: SoDonBayDTO;
  /** D499 — số cú TỰ ĐẨY giá của chính lệnh tới giờ: tăng ⇒ nối lại dòng nhịp từ nhịp đang xem (đường mới có cú đẩy). */
  xung?: number;
  /** D499 — Tổ Chức đang cầm: GIÁ TRẦN — giá đang xem ≤ ⇒ server đã tự chốt; client bật búa (so giá, không tính tiền — C4). */
  gia_tran?: number;
  /** D499 — Tổ Chức đã chạm trần (ở nhịp đã qua). */
  tran_thua?: { nhip: number };
  /** D528 — lệnh kê · Tâm lý yếu · khoản giữ đã bán (tới cú bấm cuối). */
  ke?: SoV59DTO['ke']; tly?: SoV59DTO['tly']; khoan_giu?: SoV59DTO['khoan_giu']; ls?: SoV59DTO['ls'];
}

/**
 * D492 — phần Đòn Bẩy của sổ giữa màn. `nguong`: GIÁ mà tại đó server gọi ký quỹ / thanh lý, từng nhịp từ `tu` (`goi[k − tu]`) — client chỉ SO GIÁ
 * đang thấy với ngưỡng để bật cuộc gọi / lóe đỏ (C4). null = không cầm.
 */
export interface SoDonBayDTO {
  L: number; ky_quy: number; nap_nhan: number; da_goi: boolean;
  /** D510 — 1 Đòn Bẩy · −1 Bán Khống (ngưỡng nằm trên giá — so ≥). Vắng ở server cũ = 1. */
  chieu?: 1 | -1;
  nap: { ma: string; lay: number; phi: number; nhan: number; nhip: number; luc?: 'goi' | 'chu_dong' | 'ban_het' }[];
  /** D507 — có thể gồm `tien` (Tiền mặt, phí 0). */
  nap_con: Record<string, number>;
  nap_phi?: Record<string, number>;
  thanh_ly: { nhip: number; ban_het: boolean } | null;
  nguong: { tu: number; goi: number[]; thanh_ly: number[] } | null;
  /** D507 — nhịp đã BÁN HẾT (dồn mọi khoản vào ký quỹ). Vắng = chưa. */
  ban_het?: number;
}

/** D475 — kết quả + quyết toán màn (sau khi hết giờ). */
export interface KetQuaManDTO {
  vong: number; ma: string; von: number; la: string | null; nut: string[];
  /** D483 — phí gài tin giả đã trừ trong `loi` (loi = theo_lenh − giu − phi_gai). Vắng (server cũ) = 0. */
  phi_gai?: number;
  /** D532 — phí MUA TIN SỚM, đã trừ trong `loi`. Vắng = không mua. */
  phi_tin?: number;
  /** D479 — khoản chạy theo đường: `von` vốn màn (trước thị trường) · `von_sau` khoản engine ra (= giữ suốt) · `giu` giữ suốt · `theo_lenh` theo
   *  lệnh · `loi` = theo_lenh − giu (phần màn cộng thêm). */
  von_sau: number; loi: number; giu: number; theo_lenh: number; cham_tran: boolean; tu_dong: boolean;
  /** D479 — mã khác đang cầm: giữ suốt màn theo % thị trường của vòng. */
  ma_khac: { ma: string; von_truoc: number; von_sau: number; bp: number }[];
  /** D561 — khoá nhiều mã: kết quả từng MÀN CON (vốn = cả khoản). `theo_lenh` = khoản theo đường so với vốn (như mã chính). Vắng = một mã. */
  nhieu?: { ma: string; von: number; von_sau: number; loi: number; giu: number; theo_lenh: number; tu_dong: boolean; vao: number; ra: number }[];
  /** D561 — khoá úp lá pha: mặt lá ô pha của vòng (lúc màn chạy lá úp) — màn lật ở kết quả. Vắng = lá đã lật trước màn. */
  the_vong?: ODTO;
  vao: { tien: number; khop: number; nhip: number; loai: string }[];
  ra: { tien: number; ra: number; nhip: number; lai: number; tu_dong_cuoi: boolean; cuoi_khoa: boolean; ly_do?: 'thanh_ly' | 'ban_het' | 'tran_thua' | 'ke_lenh' | 'tam_ly_yeu'; /** D528 — bán KHOẢN GIỮ */ giu?: true }[];
  /** D528 — lệnh kê · Tâm lý yếu · khoản giữ. */
  ke?: SoV59DTO['ke']; tly?: SoV59DTO['tly']; khoan_giu?: SoV59DTO['khoan_giu']; ls?: SoV59DTO['ls'];
  hut: { nhip: number; ben: 'mua' | 'ban' }[];
  gia_dau: number; day: number; dinh: number; gia_cuoi: number;
  nhan: string[];
  nav_truoc: number | null; nav_sau: number | null;
  /** D494 — các cú bán cưỡng bức của dây chuyền trong màn. Vắng (server cũ) = không có. */
  tl?: SuKienTlDTO[];
  /** D492 — Đòn Bẩy: `loi` đã gồm `nap_nhan`; khoản nguồn bị trừ `nap[].lay`. */
  db?: {
    L: number; L0: number; nap_nhan: number; da_goi: boolean;
    nap: { ma: string; lay: number; phi: number; nhan: number; nhip: number; luc?: 'goi' | 'chu_dong' | 'ban_het' }[];
    thanh_ly: { nhip: number; gia: number; ban_het: boolean } | null;
    tang: { nhip: number; tu: number; len: number }[];
  };
}

/** Một lô nhịp: giá các nhịp `tu`… + cờ trắng [nến mịn, trắng mua, trắng bán] của nến mịn ĐÃ ĐÓNG trong lô. */
export interface LoNhipDTO {
  tu: number;
  gia: number[];
  nen: [number, number, number][];
  /** D484 — giá mỗi mã bảng phụ ở CÙNG các nhịp (100 = giá mở màn). */
  phu?: Record<string, number[]>;
  /** D494 — cú bán cưỡng bức của dây chuyền xảy ra trong lô (nhịp · ai · đòn bẩy). */
  tl?: SuKienTlDTO[];
  /** D504 — lãi lỗ TẠM TÍNH (số tiền, server tính) ở CÙNG các nhịp khi đang cầm; null = nhịp trước cú bấm cuối. Vắng = không cầm. Client chỉ in (C4). */
  tt?: (number | null)[];
  /** D513 — LỚP SOI của lõi đang cầm ở nhịp CUỐI của lô (server `soiTai`): mức xử lý đám đông (Bán Khống · Mua Đuổi) hoặc đáy thác (Bắt Đáy). */
  soi?: SoiLoDTO;
  /** D528 — luật TỰ ĐỘNG tới nhịp CUỐI lô (lệnh kê khớp · Tâm lý yếu · trần thua khoản giữ) + tạm tính ở nhịp đó. Vắng = màn không có luật ấy. */
  tu_dong?: SoV59DTO & { tran_thua?: { nhip: number }; tt: number | null };
  /** D532 — tin LỘ trong lô (nhịp lộ = nến mịn × 8). Vắng = không tin nào. */
  tin?: TinLoDTO[];
  /** D536 — khối lượng TÍCH LUỸ của nến mịn chứa nhịp, ở CÙNG các nhịp (nến đang chạy lớn dần). Vắng = khoá cũ. */
  v?: number[];
  /** D536 — cú LỆNH LỚN mở trong lô. Vắng = không cú nào. */
  lon?: LonLoDTO[];
}

/** D536 — một cú LỆNH LỚN: nhịp mở · nhịp hết nhãn · ai đặt (chỉ gửi cho Tổ Chức). */
export interface LonLoDTO { nhip: number; het: number; ai?: 'ca_map' | 'doi_lai' | 'gai' }

/** D513 — lớp soi: `muc` = sàn phe mua (Bán Khống) / mức ép phe khống (Mua Đuổi) của từng vị thế đã mở, còn sống · `thac` = đáy thác (Bắt Đáy, null = chợ vắng). */
export type SoiLoDTO = { muc: { gia: number; L: number; tien: number; vao: number }[] } | { thac: { ngoi: number; day: number; n: number; /** D521 — khoảng thác (phân vị nông · sâu); vắng = màn cũ */ tu?: number; den?: number } | null }
  /** D523 — Bắt Đáy: ĐƯỜNG GIÁ TRỊ theo nến hiện `j` (server đã trễ + sai số) · độ rộng dải dưới (tỷ lệ) · nến hiện có nhãn QUÁ BÁN (đã đóng). */
  | { gt: { diem: { j: number; g: number }[]; rong: number; quaBan: number[] } };

/** D494 — một vị thế của đám đông đòn bẩy bị sàn thanh lý (bán cưỡng bức đẩy giá). */
export interface SuKienTlDTO { nhip: number; ai: 'ca_map' | 'dam_dong'; L: number }

export type DongNhip =
  | ({ loai: 'dau' } & DauManDTO)
  | ({ loai: 'nhip' } & LoNhipDTO)
  | { loai: 'het' }
  | { loai: 'noi_lai'; tu: number };

/** Mở màn của vòng VỪA NỘP — gọi lại trả đúng màn cũ. Lỗi 409 mang mã (`khong_co_ma`, `sai_vong`, `luat_tat`…). */
export function moMan(matchId: string, vong: number) {
  return api<DauManDTO & { nhip_may: number }>(`/holdem/matches/${matchId}/minigame`, { method: 'POST', body: { vong } });
}

/** Hỏi một lần: đầu màn + mọi nhịp từ `tu` tới nhịp máy. 404 = vòng này chưa mở màn. */
export function hoiMotLan(matchId: string, vong: number, tu = 0, /** D561 — khung nhìn mã khác (khoá nhiều mã). */ ma?: string) {
  return api<{ dau: DauManDTO; lo: LoNhipDTO; het: boolean }>(`/holdem/matches/${matchId}/minigame/${vong}/nhip?mot_lan=1&tu=${tu}${ma ? `&ma=${encodeURIComponent(ma)}` : ''}`);
}

/**
 * Đọc DÒNG nhịp: gọi `nhan` với từng dòng NDJSON tới khi server đóng (`het` / `noi_lai`) hoặc `signal` huỷ. Ném lỗi khi không mở được
 * dòng — chỗ gọi rơi về `hoiMotLan`.
 */
export async function docDongNhip(
  matchId: string, vong: number, tu: number, nhan: (d: DongNhip) => void, signal: AbortSignal, /** D561 */ ma?: string,
): Promise<void> {
  const { url, headers } = yeuCauApiTho(`/holdem/matches/${matchId}/minigame/${vong}/nhip?tu=${tu}${ma ? `&ma=${encodeURIComponent(ma)}` : ''}`);
  const res = await fetch(url, { credentials: 'include', headers, signal });
  if (!res.ok || !res.body) throw new Error(`dong_nhip_${res.status}`);
  const rd = res.body.getReader(), dec = new TextDecoder();
  let du = '';
  for (;;) {
    const { value, done } = await rd.read();
    if (done) break;
    du += dec.decode(value, { stream: true });
    let i: number;
    while ((i = du.indexOf('\n')) >= 0) {
      const dong = du.slice(0, i).trim();
      du = du.slice(i + 1);
      if (dong) nhan(JSON.parse(dong) as DongNhip);
    }
  }
}

/** D475 — cú bấm nút (`nhip` = nhịp đang thấy) hoặc chọn lá (`la_<lõi>`, trước khi màn chạy). Gửi lại cùng `khoa` ⇒ không ghi hai lần. */
export function bamNut(matchId: string, vong: number, body: { nhip: number; nut: string; khoa: string; /** D528 — kê lệnh */ gia_bp?: number; L?: number; /** D561 — màn con */ ma?: string }) {
  // D504 — gửi lại cùng khoá (mạng chập chờn): server trả `da_ghi_truoc_do` và KHÔNG kèm sổ.
  return api<{ nhan: true; seq: number; nhip: number; gia?: number; la: string | null; nut: string[]; so: SoManDTO; gai?: { phi: number; chieu: 1 | -1 | 0 }; da_ghi_truoc_do?: true } & Pick<DauManDTO, 'tin_mua' | 'tin_that' | 'tin_truoc' | 'mu_tin'>>(
    `/holdem/matches/${matchId}/minigame/${vong}/lenh`, { method: 'POST', body });
}

/** D475 — kết quả + quyết toán. 409 `chua_het` khi màn chưa chạy xong (đồng hồ máy lệch vài trăm ms ⇒ hỏi lại). */
export function layKetQuaMan(matchId: string, vong: number) {
  return api<KetQuaManDTO>(`/holdem/matches/${matchId}/minigame/${vong}/ket-qua`);
}
