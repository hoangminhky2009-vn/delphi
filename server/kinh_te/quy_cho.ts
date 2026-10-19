/**
 * QUỸ CHỢ — đường ghi DUY NHẤT vào `quy_cho_ledger` (bước B5, mốc M1).
 *
 * ─── VÌ SAO LÀ MỘT SỔ RIÊNG, KHÔNG PHẢI MỘT DÒNG TRONG KHO BẠC ─────────────
 * Kho bạc là túi tiền của NHÀ ĐIỀU TIẾT: trợ cấp, tier bonus, genesis. Quỹ chợ
 * là túi tiền của NGƯỜI BÁN HÀNG: nó trả T khi mua vật phẩm của người chơi và
 * nhận T khi bán ra. Hai vai, hai sổ — gộp chung thì câu hỏi *"Kho bạc còn gánh
 * nổi trợ cấp bao lâu?"* (D68, D263) mất nghĩa, vì mỗi cú mua bán ở chợ làm số
 * đó nhảy. Bất biến E1 của bản vẽ viết rõ vế thứ tư: `Σví + kho bạc + QUỸ CHỢ +
 * đã đốt`.
 *
 * ─── SOI GƯƠNG `server/treasury.ts`, KHÔNG PHÁT MINH ────────────────────────
 * Cùng hình dạng: advisory lock riêng · đọc dòng cuối · `balance_after` do DB
 * CHECK ≥ 0 · append-only. Repo đã sống với hình dạng đó hai tháng; bản thứ hai
 * của một sổ cái mà khác hình dạng là một chỗ để lệch âm thầm.
 *
 * ─── THỨ TỰ KHOÁ (M3) — BẬC 6, SAU KHO BẠC ────────────────────────────────
 *   5. TREASURY_LOCK (81_500_2)   6. QUY_CHO_LOCK (81_500_4)
 * `napQuyChoTuKhoBac` lấy 5 rồi 6. Không hàm nào ở đây được gọi trước khi caller
 * đã xong với khoá Kho bạc nếu caller cần cả hai — `lint:thu-tu-khoa` canh.
 *
 * ⚠ SEED KHÔNG NẰM TRONG CODE (A8.2). Nạp bao nhiêu là quyết định của founder,
 * chạy bằng `npm run quy-cho:nap -- <T>`. Quỹ mới tạo có số dư 0 ⇒ `gia_san = 0`
 * ⇒ cửa mua vào ĐÓNG (D65) cho tới khi có người nạp. Fail-closed, không phải
 * một số tạm.
 */
import type pg from 'pg';
import { treasuryAppend } from '../treasury.js';

type Q = {
  query: (text: string, values?: readonly unknown[]) => Promise<pg.QueryResult<any>>;
};

/** Khoá advisory riêng cho chuỗi bút toán quỹ chợ. Bậc 6 của M3. */
export const QUY_CHO_LOCK_KEY = 81_500_4;

export type QuyChoReason =
  /** Vốn từ Kho bạc — đối ứng `treasury_ledger.quy_cho_out` (bất biến E). */
  | 'nap_tu_kho_bac'
  /** Hệ thống MUA vật phẩm của người chơi: quỹ −gia_san. */
  | 'mua_vao'
  /**
   * Hệ thống BÁN vật phẩm cho người chơi: quỹ nhận **phần còn lại của
   * `gia_ban_ra` sau khi trích phí** — tức `chiaPhi(gia_ban_ra).quyCho`, không
   * phải cả `gia_ban_ra`. Ba mảnh (đốt 3% · Kho bạc 2% · quỹ 95%) cộng lại đúng
   * bằng số T rời ví người mua, nên bất biến E1 cân theo cấu trúc.
   */
  | 'ban_ra'
  /**
   * Phần "quỹ chợ" của một khoản PHÍ thu ở nơi khác (rake phiên đấu giá — B10).
   * Khác `ban_ra`: ở đó quỹ là người bán hàng, ở đây quỹ là người thu phí.
   * Chưa có đường nào ghi lý do này.
   */
  | 'phi_in';

export class QuyChoError extends Error {
  constructor(public readonly ma: string, msg?: string) {
    super(msg ?? ma);
    this.name = 'QuyChoError';
  }
}

/** Số dư hiện tại = dòng cuối sổ. 0 nếu sổ trống — tức cửa mua vào đang ĐÓNG. */
export async function soDuQuyCho(client: Q): Promise<bigint> {
  const { rows } = await client.query(
    'SELECT balance_after FROM quy_cho_ledger ORDER BY entry_id DESC LIMIT 1',
  );
  return rows.length > 0 ? BigInt(rows[0].balance_after) : 0n;
}

/**
 * Ghi một bút toán quỹ chợ. PHẢI gọi trong transaction đang mở của `client`.
 * Trả về `balance_after` mới. Chi vượt quỹ ⇒ ném lỗi RÕ trước khi DB CHECK nổ.
 */
export async function quyChoAppend(
  client: Q,
  delta: bigint,
  reason: QuyChoReason,
  refBanTheId: string | null = null,
): Promise<bigint> {
  if (delta === 0n) throw new QuyChoError('delta_bang_0', 'bút toán quỹ chợ không được bằng 0');
  await client.query('SELECT pg_advisory_xact_lock($1)', [QUY_CHO_LOCK_KEY]);
  const hienTai = await soDuQuyCho(client);
  const sau = hienTai + delta;
  if (sau < 0n) {
    throw new QuyChoError(
      'quy_cho_khong_du',
      `quỹ chợ không đủ: số dư ${hienTai} T, cần chi ${-delta} T (reason=${reason})`,
    );
  }
  await client.query(
    `INSERT INTO quy_cho_ledger (delta, balance_after, reason, ref_ban_the_id)
     VALUES ($1, $2, $3, $4)`,
    [delta.toString(), sau.toString(), reason, refBanTheId],
  );
  return sau;
}

/**
 * NẠP VỐN từ Kho bạc sang quỹ chợ. Chuyển, KHÔNG mint: hai bút toán đối ứng
 * trong một transaction, tổng cung không đổi một đồng (A3.4, E1).
 *
 * Khoá theo đúng bậc: Kho bạc (5) trước, quỹ chợ (6) sau. Kho bạc không đủ thì
 * `treasuryAppend` ném lỗi TRƯỚC khi quỹ chợ kịp ghi gì — không có trạng thái
 * "đã nạp mà chưa trừ".
 */
export async function napQuyChoTuKhoBac(
  client: pg.PoolClient,
  soT: bigint,
): Promise<{ khoBacSau: bigint; quyChoSau: bigint }> {
  if (soT <= 0n) throw new QuyChoError('so_t_khong_duong', `số T nạp phải dương: ${soT}`);
  const khoBacSau = await treasuryAppend(client, -soT, 'quy_cho_out');
  const quyChoSau = await quyChoAppend(client, soT, 'nap_tu_kho_bac');
  return { khoBacSau, quyChoSau };
}
