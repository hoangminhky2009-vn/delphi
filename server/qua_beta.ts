/**
 * QUÀ TRI ÂN MÙA BETA 0.0 — lõi nghiệp vụ (D68b, founder 04/08).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BỐN MÓN, BỐN ĐƯỜNG TIỀN KHÁC NHAU — VÀ ĐÓ LÀ CHỦ Ý
 *
 *   500 T  → RÚT KHO BẠC (`treasuryAppend` −500) rồi cộng ví + `wallet_ledger`.
 *            KHÔNG đúc: A3.4 chỉ chừa một ngoại lệ là `genesis_grant`, và nó đã
 *            dùng xong. Kho cạn ⇒ `CHECK balance_after >= 0` fail cứng.
 *   500 Q  → phát mới qua `themQ`. Q có vòi riêng (lộ trình mùa), không đụng kho.
 *   3 thẻ  → cột đếm `users.the_tao_phong`.
 *   1 sticker → `capMonHuuHan` (cùng phép đếm với gacha — không chép bản thứ hai).
 *
 * Bốn đường đi qua bốn hàm khác nhau là điều KHÔNG gộp được, và cũng không nên
 * gộp: mỗi loại xu có sổ riêng và bất biến riêng, một hàm "cấp quà" tự viết SQL
 * cho cả bốn là chỗ tường lửa T↔Q (A3.5) chết trong im lặng.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TRẦN 30 NGƯỜI — VÌ SAO PHẢI LÀ ADVISORY LOCK
 *
 * Cách hiển nhiên là `SELECT COUNT(*) FROM qua_beta_nhan` rồi so với 30. Ở READ
 * COMMITTED nó HỎNG: hai transaction cùng đọc 29, cùng thấy "còn chỗ", cùng
 * chèn — và ta có 31 người nhận, tức 500 T vượt ngân sách kho. Không lỗi nào nổ.
 *
 * `qua_beta_nhan.user_id` là PK nên nó chặn được NHẬN HAI LẦN, nhưng không chặn
 * được HAI NGƯỜI KHÁC NHAU cùng lấy suất cuối — PK không biết gì về số 30.
 *
 * Nên trần giữ bằng `pg_advisory_xact_lock`: khoá → đếm → chèn, tuần tự tuyệt
 * đối, nhả khi transaction kết thúc. Cùng idiom `treasuryAppend` dùng cho sổ Kho
 * bạc, và cùng lý do.
 */
import type pg from 'pg';
import { DIEU_KIEN_QUA_BETA, QUA_BETA } from '../config/qua_beta.js';
import { MUA_0_0, VIEC_LOI } from '../config/progression.js';
import { themQ } from './nhiem_vu.js';
import { capMonHuuHan } from './shop_kho.js';
import { treasuryAppend } from './treasury.js';

/**
 * Khoá riêng cho chuỗi cấp quà beta.
 *
 * ⚠ PHẢI khác `TREASURY_LOCK_KEY` (81_500_2). Dùng chung một khoá nghĩa là mọi
 * lệnh chi Kho bạc trên toàn hệ (trợ cấp ngày, seed kèo) xếp hàng sau quà beta —
 * một cửa hiếm dùng chặn một cửa chạy suốt ngày.
 */
export const QUA_BETA_LOCK_KEY = 81_500_3;

export class QuaBetaError extends Error {
  constructor(public readonly code: string, public readonly httpCode = 409, msg?: string) {
    super(msg ?? code);
  }
}

export interface TienDoQuaBeta {
  /** Đã nhận rồi? */
  da_nhan: boolean;
  /** Số việc lõi đã xong (0..4). */
  viec_loi_xong: number;
  viec_loi_can: number;
  /** Số trận Đấu trường đã chơi xong. */
  so_tran: number;
  so_tran_can: number;
  /** Đủ điều kiện để bấm nhận chưa. */
  du_dieu_kien: boolean;
  /** Còn bao nhiêu suất trong trần. */
  con_suat: number;
  tran_nguoi: number;
  /** Bốn món — hiện TRƯỚC khi nhận, để người chơi biết mình đang cày vì gì. */
  qua: { t: number; q: number; the_phong: number; sticker_id: string };
}

/**
 * ĐỌC TIẾN ĐỘ — không ghi gì, không khoá gì.
 *
 * Cả hai điều kiện suy từ DẤU VẾT ĐÃ CÓ, đúng kỷ luật `server/nhiem_vu.ts`:
 * không endpoint nào nhận "tôi đã xong việc X", nên không có đường nào để khai
 * gian, và cũng không có hook mới nào để quên gọi.
 *
 * ⚠ Việc lõi tính trên CẢ MÙA, không bó trong một tuần. `nhiem_vu_xong` có khoá
 * chính (user, season, cửa_sổ, nv_id) nên một việc xong ở nhiều tuần cho nhiều
 * dòng — phải `COUNT(DISTINCT nv_id)`, nếu không thì điểm danh 4 tuần liền tự nó
 * đủ "4 việc" và điều kiện thành vô nghĩa.
 */
export async function tienDoQuaBeta(
  db: pg.Pool | pg.PoolClient, userId: string,
): Promise<TienDoQuaBeta> {
  const idViecLoi = VIEC_LOI.map((v) => v.nv_id);
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM qua_beta_nhan WHERE user_id = $1)::int          AS da_nhan,
       (SELECT COUNT(DISTINCT nv_id) FROM nhiem_vu_xong
         WHERE user_id = $1 AND season_id = $2 AND nv_id = ANY($3))::int     AS viec_loi,
       (SELECT COUNT(*) FROM holdem_results WHERE user_id = $1)::int         AS so_tran,
       (SELECT COUNT(*) FROM qua_beta_nhan WHERE season_id = $2)::int        AS da_phat`,
    [userId, MUA_0_0.SEASON_ID, idViecLoi],
  );
  const r = rows[0]!;
  const viecLoiXong = Number(r.viec_loi);
  const soTran = Number(r.so_tran);
  const daNhan = Number(r.da_nhan) > 0;
  return {
    da_nhan: daNhan,
    viec_loi_xong: viecLoiXong,
    viec_loi_can: DIEU_KIEN_QUA_BETA.VIEC_LOI_XONG,
    so_tran: soTran,
    so_tran_can: DIEU_KIEN_QUA_BETA.SO_TRAN,
    du_dieu_kien: viecLoiXong >= DIEU_KIEN_QUA_BETA.VIEC_LOI_XONG
      && soTran >= DIEU_KIEN_QUA_BETA.SO_TRAN,
    con_suat: Math.max(0, QUA_BETA.TRAN_NGUOI - Number(r.da_phat)),
    tran_nguoi: QUA_BETA.TRAN_NGUOI,
    qua: {
      t: QUA_BETA.T, q: QUA_BETA.Q,
      the_phong: QUA_BETA.THE_PHONG, sticker_id: QUA_BETA.STICKER_ID,
    },
  };
}

export interface KetQuaNhanQua {
  so_thu_tu: number;
  bankroll: number;
  quest_points: number;
  the_tao_phong: number;
  sticker_id: string;
}

/**
 * CẤP QUÀ — gọi TRONG transaction đang mở của người gọi.
 *
 * Thứ tự các bước là một phần của đúng đắn, không phải sắp cho gọn:
 *   1. Khoá chuỗi quà (advisory) — mọi phép đếm sau đó tuần tự.
 *   2. Kiểm ĐÃ NHẬN CHƯA. Trước mọi thứ khác: rẻ nhất và loại nhiều nhất.
 *   3. Kiểm TRẦN. Dưới khoá nên `COUNT` không thể cũ.
 *   4. Kiểm ĐIỀU KIỆN. Đặt sau trần vì trần là tài nguyên chung, còn điều kiện
 *      là chuyện của riêng người này — báo "hết suất" chính xác hơn là báo
 *      "chưa đủ điều kiện" cho một người thật ra đã đủ.
 *   5. RÚT KHO BẠC. Đặt trước mọi lệnh cộng: kho cạn thì rollback lúc này,
 *      chưa cộng cho ai đồng nào.
 *   6. Cộng ví · phát Q · cộng thẻ · trao sticker · ghi sổ nhận · ghi event.
 */
export async function capQuaBeta(
  client: pg.PoolClient, userId: string,
): Promise<KetQuaNhanQua> {
  await client.query('SELECT pg_advisory_xact_lock($1)', [QUA_BETA_LOCK_KEY]);

  const { rows: daCo } = await client.query(
    'SELECT 1 FROM qua_beta_nhan WHERE user_id = $1', [userId]);
  if (daCo.length > 0) {
    throw new QuaBetaError('da_nhan', 409, 'Bạn đã nhận quà tri ân mùa beta rồi.');
  }

  const { rows: dem } = await client.query(
    'SELECT COUNT(*)::int AS n FROM qua_beta_nhan WHERE season_id = $1',
    [MUA_0_0.SEASON_ID]);
  const daPhat = Number(dem[0].n);
  if (daPhat >= QUA_BETA.TRAN_NGUOI) {
    throw new QuaBetaError('het_suat', 409,
      `Quà tri ân mùa beta đã phát hết ${QUA_BETA.TRAN_NGUOI} suất.`);
  }

  const td = await tienDoQuaBeta(client, userId);
  if (!td.du_dieu_kien) {
    throw new QuaBetaError('chua_du_dieu_kien', 409,
      `Cần xong ${td.viec_loi_can} việc cơ bản (đang ${td.viec_loi_xong}) `
      + `và chơi ${td.so_tran_can} trận (đang ${td.so_tran}).`);
  }

  /*
   * Bước 5 — RÚT KHO BẠC TRƯỚC KHI CỘNG CHO AI.
   * `treasuryAppend` tự lấy khoá kho bạc và tự kiểm số dư; kho không đủ thì nó
   * ném và cả transaction rollback — không có trạng thái "đã cộng ví mà kho
   * chưa trừ".
   */
  await treasuryAppend(client, -BigInt(QUA_BETA.T), 'qua_beta_out', null);

  const { rows: vi } = await client.query(
    'SELECT bankroll FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
  if (!vi[0]) throw new QuaBetaError('khong_co_ho_so', 404);
  const bankrollSau = (vi[0].bankroll as bigint) + BigInt(QUA_BETA.T);

  await client.query('UPDATE users SET bankroll = $1 WHERE user_id = $2',
    [bankrollSau.toString(), userId]);
  await client.query(
    `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
     VALUES ($1, $2, $3, 'qua_beta_t')`,
    [userId, String(QUA_BETA.T), bankrollSau.toString()],
  );

  const qSau = await themQ(client, userId, QUA_BETA.Q, 'qua_beta_q', 'beta');

  const { rows: the } = await client.query(
    `UPDATE users SET the_tao_phong = the_tao_phong + $2
      WHERE user_id = $1 RETURNING the_tao_phong`,
    [userId, QUA_BETA.THE_PHONG]);

  /*
   * Sticker đi qua ĐÚNG phép đếm của shop (`capMonHuuHan`), không phải một câu
   * INSERT riêng: món độc quyền chỉ giữ được lời hứa "số lượng cực ít" nếu hai
   * cửa phát đếm bằng cùng một đoạn mã.
   */
  await capMonHuuHan(client, userId, QUA_BETA.STICKER_ID, 1);

  const soThuTu = daPhat + 1;
  await client.query(
    `INSERT INTO qua_beta_nhan (user_id, season_id, so_thu_tu, so_t, so_q, so_the)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, MUA_0_0.SEASON_ID, soThuTu, QUA_BETA.T, QUA_BETA.Q, QUA_BETA.THE_PHONG],
  );

  /*
   * A7 — event cùng transaction. `so_thu_tu` là trường đắt nhất: nó cho biết ai
   * là người thứ mấy chạm tới điều kiện, tức tốc độ người thật đi qua bốn việc
   * lõi + ba trận. Không backfill được (`events` append-only).
   */
  await client.query(
    `INSERT INTO events (user_id, context_type, context_id, action_type,
                         value_num, value_json, state_snapshot_json)
     VALUES ($1, 'qua_beta', 'beta', 'qua_beta_nhan', $2, $3, NULL)`,
    [userId, QUA_BETA.T, JSON.stringify({
      stt: soThuTu, q: QUA_BETA.Q, the: QUA_BETA.THE_PHONG,
      viec: td.viec_loi_xong, tran: td.so_tran,
    })],
  );

  return {
    so_thu_tu: soThuTu,
    bankroll: Number(bankrollSau),
    quest_points: qSau,
    the_tao_phong: Number(the[0].the_tao_phong),
    sticker_id: QUA_BETA.STICKER_ID,
  };
}
