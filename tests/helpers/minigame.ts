/**
 * D525 — HELPER CHO BÀI TẠO TRẬN BẰNG KHOÁ MẶC ĐỊNH (v58, khung minigame). Sau cú nộp vòng có màn lõi, server trả trạng thái
 * CHỜ MÀN (`cho_man`) và chặn cú nộp kế (`man_chua_xong`) cho tới khi màn hết giờ theo lịch của nó. Thời gian thật thì màn tự xong;
 * bài test lùi mốc mở vòng qua hết phần màn — đúng cách `minigame_api.test.ts` / `v58_nhip_xen_ke.test.ts` đã làm. Màn cuối trận:
 * qua màn rồi GET thì server khép trận (`chotManCuoi`).
 *
 * ⚠ Chỉ lùi mốc khi server BÁO có màn — không lùi mù (trận khoá cũ không có màn thì mốc mở vòng là đồng hồ thật của bài).
 */
import type pg from 'pg';

/** Lùi `vong_mo_luc` qua hết phần màn (lật thẻ + chọn lá + đếm + chạy < 60 s). */
export async function quaMan(pool: pg.Pool, matchId: string): Promise<void> {
  await pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '60 seconds' WHERE match_id = $1`, [matchId]);
}

/**
 * Nếu `body` là trạng thái chờ màn ⇒ qua màn rồi đọc lại trạng thái thật bằng `docLai`. Ngược lại trả nguyên `body`.
 * Dùng ngay sau mọi cú nộp vòng của bài chạy khoá mặc định.
 */
export async function quaManNeuCo<T extends { cho_man?: unknown }>(
  pool: pg.Pool, matchId: string, body: T, docLai: () => Promise<T>,
): Promise<T> {
  if (!body || body.cho_man === undefined) return body;
  await quaMan(pool, matchId);
  return docLai();
}
