/**
 * Ô ĐỒNG Ý NGHIÊN CỨU CÓ SỐ BẢN (SPEC chan-truoc-beta · migration 0079) — MỘT nguồn cho cổng đọc lẫn đường ghi.
 *
 * ⚠⚠ VÌ SAO: trước 0079 `users.research_consent` là boolean trần, `POST /account/consent` chỉ UPDATE một cột — không ai dựng lại
 * được người dùng đã đồng ý với CHỮ NÀO, và không có vết nào của từng lần bật/tắt. Bốn cửa PFM và buổi đo đã có cơ chế ấy
 * (`config/pfm_consent.ts`); ô này nay đi cùng cơ chế: văn bản `nghien_cuu`, số bản, vết trong `events` cùng transaction.
 *
 * ⚠ ĐỒNG Ý CÓ HIỆU LỰC = cột bật VÀ số bản lưu là bản hiện hành. Người bật từ trước 0079 (số bản NULL) ⇒ coi như TẮT tới khi trả lời
 * tấm hỏi lại (founder 11/10: "chưa trả lời = TẮT"). Mọi CỔNG GHI dữ liệu nghiên cứu (telemetry) và cửa xếp hạng đọc qua đây —
 * đọc thẳng `research_consent` là bỏ qua số bản, tức đúng cái lỗ bản này bịt.
 */
import type pg from 'pg';
import { CONSENT_PHIEN_BAN, laConsentHienHanh } from '../config/pfm_consent.js';

export const VAN_BAN_NGHIEN_CUU = 'nghien_cuu' as const;

/** Hàng `users` tối thiểu để quyết. */
export interface HangDongY { research_consent: boolean | null; research_consent_phien_ban: string | null }

/** Đồng ý CÓ HIỆU LỰC: bật + đúng bản hiện hành. */
export function nghienCuuHieuLuc(h: HangDongY | undefined | null): boolean {
  return h?.research_consent === true && laConsentHienHanh(VAN_BAN_NGHIEN_CUU, h.research_consent_phien_ban);
}

/** Phải hỏi lại: cột bật nhưng số bản không phải bản hiện hành (gồm NULL — bật trước 0079). */
export function canHoiLaiNghienCuu(h: HangDongY | undefined | null): boolean {
  return h?.research_consent === true && !laConsentHienHanh(VAN_BAN_NGHIEN_CUU, h.research_consent_phien_ban);
}

/** Đọc đồng ý có hiệu lực của một người (người đã xoá ⇒ false). */
export async function docNghienCuuHieuLuc(db: pg.Pool | pg.PoolClient, userId: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT research_consent, research_consent_phien_ban FROM users WHERE user_id = $1 AND deleted_at IS NULL`, [userId]);
  return nghienCuuHieuLuc(rows[0] as HangDongY | undefined);
}

/**
 * BẬT / TẮT — đổi cột + số bản và ghi MỘT vết, TRONG transaction của người gọi (A7: vết đi cùng hành động; cột nói "đã đồng ý" mà
 * vết hỏng là đúng tình trạng đang muốn tránh).
 *   bật: `phienBan` PHẢI là bản hiện hành (người gọi đã kiểm) ⇒ vết `nghien_cuu_dong_y` {van_ban_id, phien_ban}.
 *   tắt: luôn được, không đòi khai văn bản (rút lại không bao giờ là thủ tục) ⇒ vết `nghien_cuu_rut` {van_ban_id, phien_ban}
 *        với phien_ban = bản người ấy ĐANG giữ (null nếu chưa từng có số).
 * Trả `doi: false` khi không đổi gì (không ghi vết trùng) — trừ trường hợp cột bật mà số bản cũ: bật lại bằng bản mới là một lần
 * đồng ý thật, có vết.
 */
export async function datNghienCuu(
  client: pg.PoolClient, userId: string, bat: boolean, phienBan: string | null,
): Promise<{ doi: boolean }> {
  const { rows } = await client.query(
    `SELECT research_consent, research_consent_phien_ban FROM users
      WHERE user_id = $1 AND deleted_at IS NULL FOR UPDATE`, [userId]);
  const truoc = rows[0] as HangDongY | undefined;
  if (!truoc) return { doi: false };
  if (bat) {
    if (!laConsentHienHanh(VAN_BAN_NGHIEN_CUU, phienBan)) {
      throw new Error(`datNghienCuu: bật phải kèm bản hiện hành ${CONSENT_PHIEN_BAN.nghien_cuu} (lỗi lập trình)`);
    }
    if (nghienCuuHieuLuc(truoc)) return { doi: false };
    await client.query(
      `UPDATE users SET research_consent = true, research_consent_phien_ban = $2 WHERE user_id = $1`, [userId, phienBan]);
    await client.query(
      `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
       VALUES ($1, 'profile', $2, 'nghien_cuu_dong_y', $3)`,
      [userId, userId, JSON.stringify({ van_ban_id: VAN_BAN_NGHIEN_CUU, phien_ban: phienBan })]);
    return { doi: true };
  }
  if (truoc.research_consent !== true) return { doi: false };
  await client.query(`UPDATE users SET research_consent = false WHERE user_id = $1`, [userId]);
  await client.query(
    `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
     VALUES ($1, 'profile', $2, 'nghien_cuu_rut', $3)`,
    [userId, userId, JSON.stringify({ van_ban_id: VAN_BAN_NGHIEN_CUU, phien_ban: truoc.research_consent_phien_ban })]);
  return { doi: true };
}
