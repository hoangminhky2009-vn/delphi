/**
 * HIỂN THỊ token T — và CHỈ hiển thị.
 * C4/C5: mọi phép tính tiền nằm server-side; token là INTEGER. File này cấm
 * chứa cộng trừ nhân chia tiền tệ — chỉ nhận số nguyên server trả và format.
 */

function assertInt(n: number): void {
  if (!Number.isSafeInteger(n)) {
    // Số tiền không nguyên = có nơi nào đó vi phạm C4/C5 — nổ to ở dev cho lộ sớm
    if (import.meta.env.DEV) throw new Error(`Số token không phải INTEGER: ${n}`);
  }
}

/** 4520 → "4.520 T" (vi-VN). */
export function formatT(n: number): string {
  assertInt(n);
  return `${n.toLocaleString('vi-VN')} T`;
}

/** Delta có dấu theo phong cách Mẫu E: 636 → "▲ +636 T"; -120 → "▼ −120 T". */
export function formatDeltaT(n: number): string {
  assertInt(n);
  if (n >= 0) return `▲ +${n.toLocaleString('vi-VN')} T`;
  return `▼ −${Math.abs(n).toLocaleString('vi-VN')} T`;
}
