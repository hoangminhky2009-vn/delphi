/**
 * Ngân sách polling — LUẬT D11, đổi số phải qua founder (CLAUDE.md):
 *   - Sảnh: KHÔNG polling.
 *   - Chi tiết kèo: CHỈ user đã đặt kèo đó, CHỈ khi tab đang hiển thị.
 *   - Bậc thang: 30s → 10s (<30 phút tới khóa) → 5s (5 phút cuối).
 *   - Chạm 70% quota Vercel → nâng bậc (đổi hằng số dưới, có ghi Nhật ký).
 * Hàm thuần để unit-test được; GĐ5 nối vào refetchInterval của TanStack Query.
 */
import { useSyncExternalStore } from 'react';

export const POLL_BASE_MS = 30_000;
export const POLL_NEAR_MS = 10_000;
export const POLL_FINAL_MS = 5_000;
export const NEAR_LOCK_WINDOW_MS = 30 * 60_000;
export const FINAL_WINDOW_MS = 5 * 60_000;

export interface PollContext {
  /** User đã có tiền trong kèo này chưa (điều kiện D11). */
  hasBet: boolean;
  /** Tab có đang hiển thị không (document.visibilityState). */
  visible: boolean;
}

/**
 * Chu kỳ polling chi tiết kèo, hoặc `false` = không polling.
 * Truyền now/lockTs tường minh (không đọc Date.now bên trong) để test tất định.
 */
export function marketPollIntervalMs(
  nowMs: number,
  lockTsMs: number,
  ctx: PollContext,
): number | false {
  if (!ctx.hasBet || !ctx.visible) return false;
  const remaining = lockTsMs - nowMs;
  if (remaining <= 0) return false; // đã khóa — chờ resolve, không polling
  if (remaining <= FINAL_WINDOW_MS) return POLL_FINAL_MS;
  if (remaining <= NEAR_LOCK_WINDOW_MS) return POLL_NEAR_MS;
  return POLL_BASE_MS;
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/** Tab đang hiển thị? — đầu vào `visible` cho marketPollIntervalMs. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => true,
  );
}
