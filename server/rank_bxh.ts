/**
 * HAI BẢNG TOP CỦA MẶT DỰ BÁO (Hệ B) — dựng SNAPSHOT, không tính lúc có request.
 *
 * D32 chốt hai bảng, và hai bảng có động cơ NGƯỢC nhau CÓ CHỦ Ý:
 *   · TOP % DỰ BÁO CHÍNH XÁC — một kèo tính là ĐÚNG khi **cửa người chơi đặt NHIỀU
 *     NHẤT** là cửa thắng, tính trên 30 kèo VĨ MÔ gần nhất.
 *   · BẢNG SỐ LƯỢNG — xếp theo tổng token ăn được nhờ dự báo, tính THEO MÙA.
 * Bảng % thưởng đúng; bảng token thưởng dám và bền. Né kèo khó để giữ % thì tụt bảng
 * token; bắn bừa cho nhiều thì tụt bảng %.
 *
 * ⚠ Vì sao "cửa đặt NHIỀU NHẤT" chứ không "có token ở cửa thắng": người chơi được
 *   rải token nhiều cửa cùng kèo (A5.4), nên "có token ở cửa thắng" thì ai rải đều
 *   mọi cửa cũng đúng 100% — bảng sẽ thưởng việc KHÔNG dự báo gì.
 * ⚠ HOÀ MAX = KHÔNG CÓ DỰ BÁO CHÍNH ⇒ KHÔNG THỂ ĐÚNG. Nếu chọn bừa một cửa trong
 *   các cửa đồng hạng nhất thì người rải đều 4 cửa lại có 25% cơ hội được tính đúng
 *   miễn phí — đúng cái lỗ hổng vừa bịt ở trên, mở lại bằng cửa khác.
 * ⚠ Bảng này KHÔNG ĐỌC `scores.brier`. Brier là mặt ẨN (A3.8: v0.1 không hiển thị);
 *   đặt một đường công khai lên bảng đó là mời rò rỉ.
 */
import type pg from 'pg';
import { DUBAO_TOP, SCORING_VERSION } from '../config/rank_dubao.js';

type Db = pg.Pool | pg.PoolClient;

export type DongDuBao = {
  hang: number; user_id: string; handle: string;
  /** Bảng %: k/n + phần trăm. Bảng token: tổng ròng. */
  so?: number; k?: number; n?: number; pct?: number;
};

/**
 * Bảng % chính xác — cửa sổ là 30 kèo VĨ MÔ ĐÃ RESOLVE GẦN NHẤT (toàn cục).
 *
 * Cửa sổ tính theo KÈO chứ không theo người: nếu mỗi người có cửa sổ 30 kèo riêng
 * thì hai người đang được so trên hai bộ đề khác nhau, và ai chỉ chơi kèo dễ sẽ
 * luôn thắng bảng.
 *
 * ⚠ Kèo vĩ mô là kèo THÁNG nên 30 kèo là hơn hai năm → mùa Beta bảng này gần như
 *   TRỐNG với tất cả mọi người. Đó là lý do có `NGUONG_VAO_BANG_KEO_BETA`, và nó là
 *   NỢ CÓ NGÀY CHẾT (xem config/rank_dubao.ts).
 */
export async function xayBangDoChinhXac(db: Db, nguongKeo: number): Promise<number> {
  const { rows } = await db.query(
    `WITH w AS (
        SELECT market_id, outcome_option_id
          FROM markets
         WHERE pool = 'macro' AND status = 'resolved' AND outcome_option_id IS NOT NULL
         ORDER BY resolved_ts DESC NULLS LAST
         LIMIT $1
     ),
     src AS (
        SELECT b.user_id, b.market_id, b.option_id, b.amount
          FROM bets b JOIN w USING (market_id)
         WHERE NOT b.is_seed AND b.user_id IS NOT NULL
     ),
     mx AS (SELECT user_id, market_id, MAX(amount) AS mx FROM src GROUP BY 1, 2),
     dinh AS (
        SELECT s.user_id, s.market_id,
               COUNT(*) AS so_cua_dong_hang,
               MIN(s.option_id::text) AS cua_chinh
          FROM src s JOIN mx USING (user_id, market_id)
         WHERE s.amount = mx.mx
         GROUP BY 1, 2
     ),
     cham AS (
        SELECT d.user_id,
               COUNT(*)::int AS n,
               COUNT(*) FILTER (WHERE d.so_cua_dong_hang = 1
                                  AND d.cua_chinh = w.outcome_option_id::text)::int AS k
          FROM dinh d JOIN w USING (market_id)
         GROUP BY 1
     )
     SELECT c.user_id, u.handle, c.k, c.n,
            round(100.0 * c.k / c.n, 1) AS pct
       FROM cham c JOIN users u USING (user_id)
      WHERE c.n >= $2
      ORDER BY (100.0 * c.k / c.n) DESC, c.n DESC, u.handle
      LIMIT $3`,
    [DUBAO_TOP.CUA_SO_KEO, nguongKeo, DUBAO_TOP.SO_DONG],
  );

  const dong: DongDuBao[] = rows.map((r, i) => ({
    hang: i + 1,
    user_id: String(r.user_id),
    handle: String(r.handle),
    k: Number(r.k),
    n: Number(r.n),
    pct: Number(r.pct),
  }));
  // season_id = '-' : bảng này KHÔNG theo mùa (cửa sổ 30 kèo cắt ngang các mùa).
  await luuSnapshot(db, 'du_bao_do_chinh_xac', '-', dong);
  return dong.length;
}

/**
 * Bảng token — TỔNG RÒNG token ăn được nhờ dự báo, THEO MÙA (D32 mục 1).
 *
 * "Ròng" = payout + refund − token đã đặt, trên các kèo của mùa đó. Chọn ròng chứ
 * không chọn tổng payout vì tổng payout tăng chỉ nhờ ĐẶT NHIỀU: rải 1.000 T rồi
 * nhận lại 900 T vẫn cộng 900 vào bảng, tức bảng sẽ thưởng người đặt nhiều mà lỗ.
 * ⚠ Đây là chỗ tài liệu D32 chỉ nói "tổng token ăn được" — cần founder xác nhận
 *   RÒNG là cách đọc đúng (câu hỏi đóng ở báo cáo).
 *
 * Theo MÙA vì số tuyệt đối thì cựu binh cộng dồn vĩnh viễn; mùa reset thì mỗi mùa
 * mọi người bắt đầu gần bằng nhau. Tổng cả sự nghiệp vẫn nằm trong ledger (không
 * mất gì), chỉ là KHÔNG phải một bảng đua.
 */
export async function xayBangSoLuong(db: Db, seasonId: string): Promise<number> {
  const { rows } = await db.query(
    `SELECT w.user_id, u.handle, SUM(w.delta)::int AS rong
       FROM wallet_ledger w
       JOIN markets m ON m.market_id = w.ref_market_id
       JOIN users u ON u.user_id = w.user_id
      WHERE w.reason IN ('bet_place', 'bet_adjust', 'payout', 'refund')
        AND m.season_id = $1
      GROUP BY w.user_id, u.handle
     HAVING SUM(w.delta) > 0
      ORDER BY SUM(w.delta) DESC, u.handle
      LIMIT $2`,
    [seasonId, DUBAO_TOP.SO_DONG],
  );
  const dong: DongDuBao[] = rows.map((r, i) => ({
    hang: i + 1,
    user_id: String(r.user_id),
    handle: String(r.handle),
    so: Number(r.rong),
  }));
  await luuSnapshot(db, 'du_bao_so_lan', seasonId, dong);
  return dong.length;
}

async function luuSnapshot(
  db: Db, bangId: string, seasonId: string, dong: DongDuBao[],
): Promise<void> {
  await db.query(
    `INSERT INTO bxh_snapshots (bang_id, season_id, payload_json, computed_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (bang_id, season_id) DO UPDATE
       SET payload_json = EXCLUDED.payload_json, computed_at = EXCLUDED.computed_at`,
    [bangId, seasonId, JSON.stringify({
      tong_xep_bac: dong.length, dong, v: SCORING_VERSION,
    })],
  );
}

export type BangDuBao = {
  dong: DongDuBao[];
  tong: number;
  computed_at: string | null;
  /** Vị trí của CHÍNH CHỦ, kể cả khi ngoài top hiển thị (D32: phân vị cho mọi người). */
  cua_toi: { hang: number; phan_vi: number } | null;
};

export async function docBangDuBao(
  db: Db, bangId: 'du_bao_so_lan' | 'du_bao_do_chinh_xac', seasonId: string, userId: string,
): Promise<BangDuBao> {
  const { rows } = await db.query(
    `SELECT payload_json, computed_at FROM bxh_snapshots
      WHERE bang_id = $1 AND season_id = $2`,
    [bangId, seasonId],
  );
  const p = rows[0]?.payload_json as { dong?: DongDuBao[] } | undefined;
  const dong = p?.dong ?? [];
  const i = dong.findIndex((d) => d.user_id === userId);
  return {
    // TOP_N cho người dẫn đầu; phần còn lại của snapshot chỉ dùng để tra phân vị.
    dong: dong.slice(0, DUBAO_TOP.TOP_N),
    tong: dong.length,
    computed_at: rows[0]?.computed_at ? new Date(rows[0].computed_at).toISOString() : null,
    cua_toi: i < 0 ? null : {
      hang: dong[i]!.hang,
      phan_vi: Math.max(1, Math.ceil((dong[i]!.hang / dong.length) * 100)),
    },
  };
}
