/**
 * STICKER VINH DANH HẠNG — cấp khi LÊN BẬC (SPEC docs/spec/huy-hieu-hang-sticker.md, founder 11/10).
 *
 * Ba luật, đều đã chốt ở SPEC mục 6:
 *   1. THEO MÙA — mỗi (người, mùa hạng, bậc) nhận đúng MỘT sticker. Mùa mới leo lại ⇒ nhận bản mới;
 *      lên lại bậc cũ TRONG CÙNG MÙA ⇒ không cấp thêm. Chốt idempotent là PRIMARY KEY của `huy_hieu_cap`
 *      (migration 0077), không phải một phép "kiểm rồi mới ghi" ở đây.
 *   2. KHÔNG PHÁT BÙ — hàm này chỉ chạy tại CHỖ ĐIỂM THAY ĐỔI (`ghiDiemTran`, `ghiDiemPve`). Không có đường
 *      nào quét người đang ở bậc cao để cấp lùi.
 *   3. MERIT — sáu món đứng ở nguồn `merit` (config/avatar.ts), tách khỏi shop/gacha. Cấp qua ĐÚNG
 *      `capMonHuuHan` như mọi cửa phát khác (một phép đếm, không chép bản thứ hai).
 *
 * ⚠ KHÔNG ĐỂ STICKER LÀM HỎNG KẾT TRẬN. Hàm chạy BÊN TRONG transaction ghi điểm; một món bị admin ẩn
 * (`trang_thai <> 'song'`) hay thiếu hàng catalog làm `capMonHuuHan` ném ShopError. Bản trước mà để lỗi đó nổi
 * lên thì cả trận rollback — điểm xếp hạng của MƯỜI người chơi mất vì một cái nhãn dán. Nên cấp trong SAVEPOINT:
 * lỗi nghiệp vụ ⇒ quay về savepoint (cả dòng sổ lẫn kho), bỏ qua, trả `ly_do: 'mon_khong_cap_duoc'`; lỗi hạ tầng (không phải ShopError)
 * thì vẫn nổ lên — đó là lỗi thật, không nuốt.
 */
import type pg from 'pg';
import { dinhNghiaBac, type BacId } from '../config/rank.js';
import { capMonHuuHan, ShopError } from './shop_kho.js';

/** Chỉ cần `query` — `ghiDiemTran`/`ghiDiemPve` nhận `Db` (Pool | PoolClient) nhưng PHẢI đang trong transaction. */
type Q = Pick<pg.PoolClient, 'query'>;

export type KetQuaCapSticker =
  | { cap: true; sticker_id: string }
  | { cap: false; ly_do: 'khong_co_sticker' | 'da_nhan_trong_mua' | 'mon_khong_cap_duoc'; sticker_id: string | null };

/**
 * Cấp sticker vinh danh của bậc `bacMoi` cho `userId` trong mùa `seasonId`.
 * GỌI TRONG TRANSACTION ĐANG MỞ (client đang ở giữa BEGIN…COMMIT của kết trận).
 */
export async function capStickerLenBac(
  client: Q, userId: string, seasonId: string, bacMoi: BacId,
): Promise<KetQuaCapSticker> {
  const stickerId = dinhNghiaBac(bacMoi).sticker;
  if (!stickerId) return { cap: false, ly_do: 'khong_co_sticker', sticker_id: null };

  await client.query('SAVEPOINT cap_sticker_hang');
  try {
    const { rowCount } = await client.query(
      `INSERT INTO huy_hieu_cap (user_id, season_id, bac_id, sticker_id)
            VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, season_id, bac_id) DO NOTHING`,
      [userId, seasonId, bacMoi, stickerId],
    );
    if (rowCount === 0) {
      await client.query('RELEASE SAVEPOINT cap_sticker_hang');
      return { cap: false, ly_do: 'da_nhan_trong_mua', sticker_id: stickerId };
    }
    // 'tang' = nguồn bản thể "hệ thống tặng" của sổ vật (so_vat.ts) — không phải gacha, không phải mua.
    await capMonHuuHan(client, userId, stickerId, 1, 'tang');
    await client.query('RELEASE SAVEPOINT cap_sticker_hang');
    return { cap: true, sticker_id: stickerId };
  } catch (e) {
    if (!(e instanceof ShopError)) throw e;
    await client.query('ROLLBACK TO SAVEPOINT cap_sticker_hang');
    await client.query('RELEASE SAVEPOINT cap_sticker_hang');
    return { cap: false, ly_do: 'mon_khong_cap_duoc', sticker_id: stickerId };
  }
}

/** Các bậc đã nhận sticker TRONG MÙA này — nguồn cho ô "đã có / bóng xám" ở màn Hạng. Một SELECT theo khoá chính. */
export async function bacDaNhanStickerTrongMua(
  db: pg.Pool | pg.PoolClient, userId: string, seasonId: string,
): Promise<string[]> {
  const { rows } = await db.query(
    `SELECT bac_id FROM huy_hieu_cap WHERE user_id = $1 AND season_id = $2 ORDER BY cap_luc, bac_id`,
    [userId, seasonId],
  );
  return rows.map((r) => String(r.bac_id));
}
