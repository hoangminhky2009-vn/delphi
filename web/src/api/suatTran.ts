/**
 * HÀNG CHỜ SUẤT TRẬN — phía người chơi (SPEC `docs/spec/tran-tran-ngay.md`).
 *
 * Khác hàng chờ VÀO APP (`api/cong.ts`, phủ toàn màn): cái này chỉ chặn ĐÚNG việc tạo trận, nên KHÔNG được chặn app — người chờ
 * vẫn lướt Hub/Hồ sơ (SPEC mục 1). Hai nguồn trả cùng một ý, gom về một trạng thái:
 *   · 503 `hang_cho_tran` — cổng Worker: có số thứ tự + giờ dự kiến (hoặc `het_ngay`)
 *   · 503 `het_suat_ngay` — lưới server (cổng fail-open): chỉ biết "hết hôm nay, mở lại 0:00"
 *
 * Việc của file: (1) `quaHangSuat` bọc lời gọi tạo trận — gặp hai mã trên thì phát trạng thái, NGỦ đúng nhịp server bảo
 * (`Retry-After`), gọi lại cùng thân, tới khi được 201 hoặc người chơi rời hàng; (2) phát trạng thái cho `HangChoSuatTran` (dải
 * chung ở AppShell); (3) giữ "trận mồ côi" — tới lượt mà màn đã bấm TÌM TRẬN không còn mở (người chơi đang ở Hub) thì dải chung
 * đưa họ vào trận, không bỏ rơi một trận đã tạo (đồng hồ vòng 1 đã chạy).
 *
 * ⚠ Nhịp hỏi là của SERVER (cùng lý do `cong.ts`: nhịp client tự đặt thì không sửa được từ xa) — và nó là ngân sách Durable
 *   Object, không phải sự tuỳ hứng: hỏi dày hơn là đốt đúng thứ đang giữ cổng sống.
 */
import { ApiError } from './client';

export const MA_HANG_CHO_TRAN = 'hang_cho_tran';
export const MA_HET_SUAT_NGAY = 'het_suat_ngay';
export const MA_ROI_HANG = 'roi_hang_suat';

export interface TrangThaiSuat {
  /** Vị trí trong hàng (1 = kế tiếp). Vắng khi lưới server trả (nó không giữ hàng). */
  vi_tri: number | null;
  tong: number | null;
  /** Mốc UTC (ms) dự kiến tới lượt; `null` khi hết suất hôm nay. */
  du_kien: number | null;
  het_ngay: boolean;
  /** Mốc UTC (ms) 0:00 giờ VN kế tiếp. */
  mo_lai_luc: number | null;
}

export interface TranMoCoi { matchId: string; tap: boolean }

let dangCho: TrangThaiSuat | null = null;
let moCoi: TranMoCoi | null = null;
let roi: (() => void) | null = null;
const nghe = new Set<() => void>();

function phat() {
  for (const f of nghe) f();
}

/** Nghe đổi trạng thái (đang chờ / trận mồ côi). Trả hàm huỷ. */
export function ngheSuatTran(f: () => void): () => void {
  nghe.add(f);
  return () => { nghe.delete(f); };
}
export const trangThaiSuat = (): TrangThaiSuat | null => dangCho;
export const tranMoCoi = (): TranMoCoi | null => moCoi;

/** Đọc thân lỗi 503 thành trạng thái chờ; `null` nếu không phải lỗi suất trận. */
export function docLoiSuat(e: unknown): TrangThaiSuat | null {
  if (!(e instanceof ApiError) || e.status !== 503) return null;
  const than = (e.body ?? {}) as {
    hang_cho_tran?: Partial<TrangThaiSuat>; mo_lai_luc?: number;
  };
  if (e.code === MA_HANG_CHO_TRAN) {
    const h = than.hang_cho_tran ?? {};
    return {
      vi_tri: h.vi_tri ?? null,
      tong: h.tong ?? null,
      du_kien: h.du_kien ?? null,
      het_ngay: h.het_ngay === true,
      mo_lai_luc: h.mo_lai_luc ?? null,
    };
  }
  if (e.code === MA_HET_SUAT_NGAY) {
    return { vi_tri: null, tong: null, du_kien: null, het_ngay: true, mo_lai_luc: than.mo_lai_luc ?? null };
  }
  return null;
}

/** Ngủ `giay`, thức sớm khi người chơi rời hàng (⇒ ném `roi_hang_suat`). */
function ngu(giay: number): Promise<void> {
  return new Promise((ok, loi) => {
    const t = setTimeout(() => { roi = null; ok(); }, giay * 1000);
    roi = () => {
      clearTimeout(t);
      roi = null;
      loi(new ApiError(0, MA_ROI_HANG, 'Bạn đã rời hàng chờ suất trận.'));
    };
  });
}

/**
 * Gọi `goi` (tạo trận) qua hàng chờ suất trận. Lỗi khác ⇒ ném nguyên như cũ — màn gọi không phải học hình dạng lỗi mới.
 * Chỉ một vòng chờ một lúc: bấm TÌM TRẬN lần hai trong khi đang chờ là cùng một chỗ trong hàng (mã vé ở cookie), nên vòng cũ
 * được rời trước — không đẻ hai nhịp hỏi.
 */
export async function quaHangSuat<T>(goi: () => Promise<T>): Promise<T> {
  roi?.();
  for (;;) {
    try {
      const kq = await goi();
      dangCho = null;
      phat();
      return kq;
    } catch (e) {
      const t = docLoiSuat(e);
      if (!t) {
        dangCho = null;
        phat();
        throw e;
      }
      dangCho = t;
      phat();
      const sau = e instanceof ApiError && e.retryAfterSeconds && e.retryAfterSeconds > 0 ? e.retryAfterSeconds : 5;
      try {
        await ngu(sau);
      } catch (r) {
        dangCho = null;
        phat();
        throw r;
      }
    }
  }
}

/** Người chơi bấm RỜI HÀNG. Không giữ chỗ: hàng ở cổng tự xoá người im quá nhịp (không ai phải báo). */
export function roiHangSuat(): void {
  if (roi) roi();
  else if (dangCho) { dangCho = null; phat(); }
}

/** Tới lượt mà màn gốc đã đóng ⇒ để dải chung đưa vào trận. */
export function baoTranMoCoi(t: TranMoCoi): void {
  moCoi = t;
  phat();
}

/** Dải chung đã đưa người chơi vào trận (hoặc test dọn). */
export function xongTranMoCoi(): void {
  moCoi = null;
  phat();
}

/** Dọn sạch — cho test. */
export function datLaiSuatTran(): void {
  roi?.();
  dangCho = null;
  moCoi = null;
  roi = null;
}
