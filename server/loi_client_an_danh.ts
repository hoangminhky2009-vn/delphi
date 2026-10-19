/**
 * LỖI CLIENT ẨN DANH (SPEC `docs/spec/bao-loi-nguoi-choi.md` mục 4.3 + 5; founder 11/10 — A cho mọi người, một đường).
 *
 *   POST /api/v1/loi-client  { ma, man, ban }  → luôn 202 (trừ khi chính máy chủ hỏng)
 *
 * ⚠⚠ ĐƯỜNG NÀY KHÔNG BIẾT AI GỌI — VÀ PHẢI GIỮ NHƯ THẾ. Đoạn điều khoản T4 hứa: "Không mã tài khoản, không email, không
 * chữ bạn gõ … Sentry cũng không thấy địa chỉ mạng của bạn". Nên ở đây:
 *   · KHÔNG `optionalAuth`, không đọc cookie — không có actor nào để lỡ gắn vào nhãn;
 *   · gói ra Sentry dựng LẠI từ đúng ba trường đã kiểm (`TRUONG_BAO_LOI_AN_DANH`), không chuyền thân request;
 *   · IP chỉ dùng làm khoá trần (cùng nếp đăng ký), không đi ra ngoài.
 * Khác `loi_client` của telemetry (A9 — chỉ ghi cho người đã bật nghiên cứu, vẫn chạy y như cũ): đường này không ghi DB.
 *
 * ⚠ Sai hình dạng / vượt trần / không DSN ⇒ vẫn 202 và bỏ IM LẶNG: client không có gì để sửa, và một mã 4xx/429 chỉ
 * mời nó thử lại mãi. Client tự chặn thêm (một mã một lần mỗi phiên, chưa xem thẻ điều khoản thì chưa gửi).
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { BAO_LOI_AN_DANH, TRUONG_BAO_LOI_AN_DANH, type TruongBaoLoiAnDanh } from '../config/bao_loi.js';
import { MAN_HOP_LE, MAN_KHAC, MAU_MA } from '../config/telemetry.js';
import { consumeLimit } from './auth/rate_limit.js';
import type { KenhBaoLoi } from './bao_loi.js';

const MAN_SET: ReadonlySet<string> = new Set([...MAN_HOP_LE, MAN_KHAC]);

const KIEM: Record<TruongBaoLoiAnDanh, (v: string) => boolean> = {
  ma: (v) => MAU_MA.test(v),
  man: (v) => MAN_SET.has(v),
  ban: (v) => BAO_LOI_AN_DANH.MAU_BAN.test(v),
};

/** Dựng gói từ thân request — đúng các trường đã khai, đúng hình dạng; thiếu/sai một trường ⇒ null. */
export function docGoiAnDanh(than: unknown): Record<TruongBaoLoiAnDanh, string> | null {
  if (than === null || typeof than !== 'object') return null;
  const goi = {} as Record<TruongBaoLoiAnDanh, string>;
  for (const k of TRUONG_BAO_LOI_AN_DANH) {
    const v = (than as Record<string, unknown>)[k];
    if (typeof v !== 'string' || !KIEM[k](v)) return null;
    goi[k] = v;
  }
  return goi;
}

export function registerLoiClientAnDanhRoutes(
  app: Hono<any>,
  pool: pg.Pool,
  deps: {
    baoLoi: KenhBaoLoi;
    /** Trần theo IP (cùng hàm của cửa đăng ký — có vế trần chung cho luồng không xác thực được). */
    hanMucIp: (c: any, tienTo: string, tran: number, cuaSoPhut: number) => Promise<{ allowed: boolean }>;
  },
): void {
  app.post('/api/v1/loi-client', async (c) => {
    const im = c.body(null, 202);
    // Không DSN ⇒ kênh IM: không có gì để gửi, đừng tốn câu DB đếm trần.
    if (!deps.baoLoi.noiRaNgoai) return im;
    let than: unknown;
    try { than = await c.req.json(); } catch { return im; }
    const goi = docGoiAnDanh(than);
    if (!goi) return im;

    const theoIp = await deps.hanMucIp(c, 'loi_an_danh', BAO_LOI_AN_DANH.TRAN_MOI_IP_NGAY, BAO_LOI_AN_DANH.CUA_SO_PHUT);
    if (!theoIp.allowed) return im;
    const toanCuc = await consumeLimit(
      pool, 'loi_an_danh:toan_cuc', BAO_LOI_AN_DANH.TRAN_TOAN_CUC_NGAY, BAO_LOI_AN_DANH.CUA_SO_PHUT);
    if (!toanCuc.allowed) return im;

    deps.baoLoi.baoMa('loi_client', { ...goi });
    await deps.baoLoi.xa();
    return im;
  });
}
