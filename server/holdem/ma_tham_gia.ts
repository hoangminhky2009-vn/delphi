/**
 * K7 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — dời từ `holdem_api.ts` xuống tầng thuần: `dot_thu.ts` (tầng xuất dữ liệu buổi đo)
 * từng import tầng ROUTE chỉ để lấy hàm băm bốn ký tự này. Hành vi không đổi; `holdem_api.ts` import lại từ đây.
 *
 * D329 — MÃ THAM GIA của một trận buổi đo: 4 ký tự suy TẤT ĐỊNH từ sha-256(match_id), để người điều
 * phối ghép bài giấy với thẻ mà không cần tên người (C7). Bảng chữ BỎ `0 o 1 l i` — mã này được CHÉP
 * TAY lên giấy, và hai ký tự trông giống nhau là một cú ghép nhầm không ai phát hiện.
 * ⚠ Suy từ `match_id` (uuid ngẫu nhiên) chứ không từ user_id: mã không dùng lại được qua hai buổi,
 * nên một tờ giấy lọt ra ngoài không nối được hai buổi đo của cùng một người.
 */
import { createHash } from 'node:crypto';

export function maThamGia(matchId: string): string {
  const KY = 'abcdefghjkmnpqrstuvwxyz23456789';
  const h = createHash('sha256').update(matchId).digest();
  return Array.from({ length: 4 }, (_, i) => KY[h[i]! % KY.length]).join('');
}
