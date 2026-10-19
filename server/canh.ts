/**
 * CANH — một phép kiểm đi ĐÚNG đường người chơi, để chuông kêu ở hai lớp sự cố mà `/health` không thấy
 * (phiếu NGHIÊN CỨU → VẬN HÀNH 11/10):
 *
 *   ① D293 (06/09): Worker trả 500 cho MỌI request mang cookie `dp_pass`, còn `/health` sống vì nằm trong danh
 *     sách miễn cổng ⇒ UptimeRobot xanh suốt. `GET /api/v1/canh` KHÔNG nằm trong `MIEN_CONG` của Worker: gọi nó
 *     kèm cookie `dp_pass` là đi qua đúng nhánh `kiemVe()` đã nổ hôm đó.
 *   ② 06/10: web 0.0.54 chạy cùng API 0.0.52 ~5 giờ, không ai được báo. Ở đây so bản của máy chủ với
 *     `/phien-ban.json` mà gói web ở biên đang phát (web/vite.config.ts `tepPhienBan`).
 *
 * Kèm hai thứ `/health` đã có: một câu đọc BẢNG THẬT (không phải `SELECT 1`) và tuổi heartbeat.
 * Hỏng ⇒ 500 ⇒ cron-job.org gửi email (cách đặt: docs/deploy_gd0.md §Canh). Mã lỗi là ID, chữ ở client (D26).
 */
import type pg from 'pg';
import { NGUONG_CANH_LUOT_THANG, LUOT_NGOAI_WORKER_MOI_NGAY } from '../config/ha_tang.js';

export type MaLoiCanh = 'db' | 'heartbeat' | 'web_khong_doc_duoc' | 'lech_ban' | 'quota';

export interface KetQuaCanh {
  ok: boolean;
  loi: MaLoiCanh[];
  ban_server: string;
  /** null khi không cấu hình đọc web (dev) hoặc đọc hỏng — xem `loi`. */
  ban_web: string | null;
  heartbeat_age_s: number | null;
  /** Ước lượng lượt gọi Vercel tháng này (Worker đếm + lượt ngoài Worker); null khi không có số đáng tin từ Worker. */
  luot_thang_uoc: number | null;
}

/** Lượt tháng ước lượng: số Worker đếm + lượt ngoài Worker của các ngày đã qua trong tháng UTC (tính cả hôm nay). */
export function uocLuotThang(demWorker: number, now = new Date()): number {
  return demWorker + LUOT_NGOAI_WORKER_MOI_NGAY * now.getUTCDate();
}

/** Trùng ngưỡng `/health` (app.ts): quá 3 phút không nhịp là scheduler chết. */
export const HEARTBEAT_TOI_DA_S = 180;

export async function kiemCanh(
  pool: pg.Pool,
  opts: {
    banServer: string;
    docBanWeb?: (() => Promise<string | null>) | undefined;
    /** Số lượt Worker đếm tháng này — CHỈ truyền khi header đã qua kiểm proxy secret. */
    demWorker?: number | null | undefined;
    now?: Date;
  },
): Promise<KetQuaCanh> {
  const kq: KetQuaCanh = {
    ok: false, loi: [], ban_server: opts.banServer, ban_web: null, heartbeat_age_s: null, luot_thang_uoc: null,
  };
  try {
    // Bảng thật, có chỉ mục khoá chính — `SELECT 1` sống cả khi schema/quyền hỏng.
    await pool.query('SELECT count(*) FROM users');
    // Cùng luật `/health`: CẢ HAI nguồn phải có nhịp — một nguồn chưa từng đập là chết, không phải "không biết".
    const { rows } = await pool.query(
      `SELECT source, extract(epoch FROM (now() - max(beat_at)))::int AS age
         FROM scheduler_heartbeat WHERE source IN ('pg_cron', 'tick') GROUP BY source`);
    kq.heartbeat_age_s = rows.length === 2 ? Math.max(...rows.map((r) => Number(r.age))) : null;
    if (kq.heartbeat_age_s === null || kq.heartbeat_age_s > HEARTBEAT_TOI_DA_S) kq.loi.push('heartbeat');
  } catch {
    kq.loi.push('db');
  }
  if (opts.docBanWeb) {
    kq.ban_web = await opts.docBanWeb().catch(() => null);
    if (kq.ban_web === null) kq.loi.push('web_khong_doc_duoc');
    else if (kq.ban_web !== opts.banServer) kq.loi.push('lech_ban');
  }
  if (opts.demWorker !== null && opts.demWorker !== undefined) {
    kq.luot_thang_uoc = uocLuotThang(opts.demWorker, opts.now);
    if (kq.luot_thang_uoc >= NGUONG_CANH_LUOT_THANG) kq.loi.push('quota');
  }
  kq.ok = kq.loi.length === 0;
  return kq;
}

/**
 * Đọc `/phien-ban.json` của web ở biên. Hạn 5 s; không cache (bản ở biên là thứ cần biết, không phải bản cũ).
 * Trả null khi không đọc được — `kiemCanh` biến nó thành mã `web_khong_doc_duoc`.
 */
export function taoDocBanWeb(webOrigin: string, fetchFn: typeof fetch = fetch): () => Promise<string | null> {
  return async () => {
    const r = await fetchFn(`${webOrigin.replace(/\/$/, '')}/phien-ban.json?t=${Date.now()}`, {
      cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { ban?: unknown };
    return typeof j.ban === 'string' ? j.ban : null;
  };
}

/*
 * Van báo Sentry cho `/health` · `/canh` hỏng: cron gọi mỗi vài phút, một sự cố kéo dài một giờ không được đẻ
 * hàng chục sự kiện trên hạn mức 5.000/tháng (cùng lý lẽ van D274 ở server/tai.ts). Một lần mỗi 10 phút mỗi
 * khoá mỗi instance — cần BIẾT CÓ, không cần đếm đủ; cron-job.org lo phần email liên tục.
 */
const NHIP_BAO_MS = 10 * 60_000;
const baoLuc = new Map<string, number>();

export function nenBaoCanh(khoa: string, now = Date.now()): boolean {
  const truoc = baoLuc.get(khoa);
  if (truoc !== undefined && now - truoc < NHIP_BAO_MS) return false;
  baoLuc.set(khoa, now);
  return true;
}

/** Chỉ để test. */
export function xoaNhipBaoCanh(): void { baoLuc.clear(); }
