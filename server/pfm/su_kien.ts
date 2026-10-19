/**
 * PFM — GHI MỘT DÒNG `events` (K5 🔒). Tách khỏi `api.ts` ở D251.
 *
 * ⚠ Lý do tách: `api.ts` (route) và `lo.ts` (bộ xử lý lô) đều phải ghi `events`, mà
 * `api.ts` đã import `lo.ts`. Để hàm ở lại `api.ts` là dựng một vòng import — hoặc,
 * tệ hơn, dựng bản thứ hai của cùng cú ghi ở `lo.ts` (A11.5/D61) và mất luôn cái
 * kiểm K5 runtime dưới đây ở đúng đường đi vào nhiều nhất.
 */
import type pg from 'pg';
import { kiemValueJsonPfm, type PfmActionType } from '../../config/pfm_events.js';

/** Ghi một dòng `events` PFM — kiểm K5 tại RUNTIME (không chỉ ở test quét nguồn). */
export async function ghiEventPfm(
  client: pg.PoolClient, userId: string, actionType: PfmActionType,
  valueJson: Record<string, unknown>,
): Promise<void> {
  const loi = kiemValueJsonPfm(actionType, valueJson);
  if (loi) {
    // Đây là LỖI LẬP TRÌNH (payload tôi tự dựng vi phạm whitelist tôi tự đặt),
    // không phải lỗi user — ném để lộ ngay lúc viết, không lọt xuống DB.
    throw new Error(`K5 vi phạm (lỗi lập trình): ${loi}`);
  }
  // ⚠ $1 KHÔNG ĐƯỢC DÙNG LẠI cho cả user_id lẫn context_id: postgres suy kiểu tham
  // số theo VỊ TRÍ xuất hiện đầu tiên, dùng lại cùng số hiệu ở hai cột ném lỗi
  // "inconsistent types deduced" — dù cả hai cột đều là uuid. Truyền hai lần, hai $.
  await client.query(
    `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
     VALUES ($1, 'pfm', $2, $3, $4::jsonb)`,
    [userId, userId, actionType, JSON.stringify(valueJson)],
  );
}
