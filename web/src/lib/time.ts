/**
 * Hiển thị thời gian: DB/API là UTC, hiển thị Asia/Ho_Chi_Minh (A8.8).
 * KHÔNG tự cộng trừ +7 — luôn qua Intl với timeZone tường minh.
 * Định dạng giờ khóa theo chỉ đạo GĐ5: "19:00 T6 24/07" (kèm thứ).
 */
const TZ = 'Asia/Ho_Chi_Minh';

const partsFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  weekday: 'short',
  hourCycle: 'h23',
});

function parts(isoUtc: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(new Date(isoUtc))) out[p.type] = p.value;
  return out;
}

/** "Thứ 6"/"Th 6" → "T6"; Chủ nhật → "CN" (ICU mỗi bản in một kiểu — bám chữ số). */
function shortWeekday(w: string | undefined): string {
  if (!w) return '';
  const digit = /\d/.exec(w);
  return digit ? `T${digit[0]}` : 'CN';
}

/** ISO UTC → "19:00 T6 24/07" (chỉ đạo GĐ5 mục 1.3). */
export function formatLockTime(isoUtc: string): string {
  const p = parts(isoUtc);
  return `${p.hour}:${p.minute} ${shortWeekday(p.weekday)} ${p.day}/${p.month}`;
}

/** ISO UTC → "19:00" (giờ VN) — giờ dự kiến của hàng chờ suất trận. */
export function formatGio(isoUtc: string): string {
  const p = parts(isoUtc);
  return `${p.hour}:${p.minute}`;
}

/** ISO UTC → "19:00 24/07/2026". */
export function formatFull(isoUtc: string): string {
  const p = parts(isoUtc);
  return `${p.hour}:${p.minute} ${p.day}/${p.month}/${p.year}`;
}

/** ISO UTC → "24/07" (nhóm ngày trong ví). */
export function formatDay(isoUtc: string): string {
  const p = parts(isoUtc);
  return `${shortWeekday(p.weekday)} ${p.day}/${p.month}`;
}
