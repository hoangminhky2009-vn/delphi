/**
 * PFM — TOKEN (đồng tiền THỨ BA) + sổ cái.
 *
 * ⚠⚠ TƯỜNG LỬA BA CHIỀU T ↔ Q ↔ token-PFM (P4 🔒). File này KHÔNG BAO GIỜ được import
 * ví T (`wallet_ledger`), điểm Q (`quest_ledger`) hay Kho bạc. Token PFM không rút từ
 * Kho bạc (A3.4) — nó được "in" theo luật tất định có TRẦN PHÁT/NGÀY. In-có-trần an
 * toàn ở đây vì token PFM chỉ đổi được đồ trang trí (A3.9): lạm phát tệ nhất là
 * "nhiều người có nhiều skin", không phá kinh tế nào.
 *
 * ⚠ MỌI HÀM Ở ĐÂY ĐÒI `PoolClient` TRONG TRANSACTION, không nhận `Pool`. Đường TIỀN
 * phải nguyên tử với hành động nghiệp vụ sinh ra nó (C4/A7) — nhận `Pool` là mở cửa
 * cho một cú phát token fire-and-forget, và token phát ra không có sổ ghi là đúng thứ
 * A3.10 tồn tại để chặn.
 */
import type pg from 'pg';
import { PFM } from '../../config/pfm.js';

export type LyDoToken = 'moc_su_kien' | 'phan_quyet_tuan' | 'mua_shop' | 'admin_adjust';

export interface KetQuaCapToken {
  cap: boolean;
  soDu: number;
  /** Chỉ có khi `cap === false`. */
  lyDoTuChoi?: 'tran_ngay' | 'am_vi' | 'khong_thay_user';
  /** Số token đã phát trong ngày (sau cú này nếu thành công). */
  daPhatHomNay: number;
}

/**
 * CẤP (hoặc TRỪ) token trong một transaction đang mở.
 *
 * ⚠ CHỐNG TOCTOU BẰNG KHOÁ HÀNG, KHÔNG BẰNG "ĐỌC RỒI GHI". Repo đã trả giá một lần
 * cho khuôn SELECT-rồi-INSERT (cuộc đua hai cú chốt cùng lúc). Ở đây `FOR UPDATE` trên
 * đúng hàng `users` của người này tuần tự hoá mọi cú phát cho CÙNG một user, mà không
 * đụng gì tới người khác — rẻ hơn advisory lock và không cần nhớ nhả.
 *
 * ⚠ TRẦN NGÀY CHỈ ÁP CHO PHÁT (delta > 0). Tiêu token ở shop không bị trần chặn —
 * trần tồn tại để giới hạn tốc độ IN tiền, không phải để cản người dùng tiêu đồ của họ.
 */
export async function capToken(
  client: pg.PoolClient,
  userId: string,
  delta: number,
  lyDo: LyDoToken,
  ref?: string,
): Promise<KetQuaCapToken> {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error(`delta token phải là số nguyên khác 0, nhận: ${delta}`);
  }

  const u = await client.query(
    `SELECT pfm_token, mui_gio FROM users WHERE user_id = $1 FOR UPDATE`, [userId]);
  if (!u.rows[0]) return { cap: false, soDu: 0, lyDoTuChoi: 'khong_thay_user', daPhatHomNay: 0 };

  const soDuHienTai = Number(u.rows[0].pfm_token);

  // Đã phát bao nhiêu HÔM NAY (theo múi giờ user) — chỉ đếm dòng DƯƠNG.
  const d = await client.query(
    `SELECT COALESCE(SUM(delta), 0)::int AS s FROM pfm_token_ledger
      WHERE user_id = $1 AND delta > 0
        AND (created_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date`,
    [userId, u.rows[0].mui_gio]);
  const daPhat = Number(d.rows[0].s);

  if (delta > 0 && daPhat + delta > PFM.TRAN_TOKEN_NGAY) {
    return { cap: false, soDu: soDuHienTai, lyDoTuChoi: 'tran_ngay', daPhatHomNay: daPhat };
  }
  const soDuMoi = soDuHienTai + delta;
  if (soDuMoi < 0) {
    return { cap: false, soDu: soDuHienTai, lyDoTuChoi: 'am_vi', daPhatHomNay: daPhat };
  }

  await client.query(
    `INSERT INTO pfm_token_ledger (user_id, delta, balance_after, reason, ref)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, delta, soDuMoi, lyDo, ref ?? null]);
  await client.query(
    `UPDATE users SET pfm_token = $2 WHERE user_id = $1`, [userId, soDuMoi]);

  return {
    cap: true, soDu: soDuMoi,
    daPhatHomNay: daPhat + (delta > 0 ? delta : 0),
  };
}

/** Số dư + số đã phát hôm nay — cho payload mở app (K11), không mở transaction. */
export async function docViToken(
  db: pg.Pool | pg.PoolClient, userId: string,
): Promise<{ soDu: number; daPhatHomNay: number; tranNgay: number }> {
  const { rows } = await db.query(
    `SELECT u.pfm_token,
            COALESCE((SELECT SUM(l.delta) FROM pfm_token_ledger l
                       WHERE l.user_id = u.user_id AND l.delta > 0
                         AND (l.created_at AT TIME ZONE u.mui_gio)::date
                           = (now() AT TIME ZONE u.mui_gio)::date), 0)::int AS da_phat
       FROM users u WHERE u.user_id = $1`, [userId]);
  if (!rows[0]) throw new Error('không thấy user');
  return {
    soDu: Number(rows[0].pfm_token),
    daPhatHomNay: Number(rows[0].da_phat),
    tranNgay: PFM.TRAN_TOKEN_NGAY,
  };
}
