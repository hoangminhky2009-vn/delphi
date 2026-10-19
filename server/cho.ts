/**
 * CHỢ — HAI CHIỀU VỚI HỆ THỐNG: BÁN (B7a, mốc M1) và MUA (B7b, mốc M2).
 *
 * ─── ĐÂY LÀ GIAO DỊCH THẬT ĐẦU TIÊN CỦA CẢ NỀN KINH TẾ ─────────────────────
 * Mọi thứ đã thiết kế — chỉ số giá, ngân hàng trung ương, cầm cố, đấu giá — ăn
 * `chiSoThucHien`, mà nó `null` cho tới khi có một giao dịch thật. Route này là
 * giao dịch đó. Nó chạm cả bốn tầng một lần: sổ vật đổi chủ (T2), quỹ chợ trả
 * tiền (T1), giá từ hàm thuần (T0), và hai audit phải cùng cân.
 *
 * ─── ⭐ VÌ SAO HAI CHIỀU PHẢI Ở CÙNG MỘT TỆP ───────────────────────────────
 * Bất biến E7 (`gia_san < gia_ban_ra`) là một quan hệ GIỮA hai cửa. Tách chúng
 * ra hai tệp thì mỗi tệp đọc một mình đều đúng, và cái sai duy nhất — một vòng
 * mua-bán không lỗ — không nằm trong tệp nào cả. Để cạnh nhau thì người sửa một
 * chiều nhìn thấy chiều kia.
 *
 * ─── VÌ SAO HỢP LỆ VỀ PHÁP LÝ (§7.15) ──────────────────────────────────────
 * Tiền trả cho người bán đến từ QUỸ CHỢ, NGAY LÚC BÁN, theo CÔNG THỨC biết trước
 * (`giaSan`). Không chờ người mua nào xuất hiện ⇒ không phải ký gửi (Điều 57 K5).
 * Ba tính chất đó là ranh, và cả ba nằm trong chính hình dạng của route.
 *
 * ─── THỨ TỰ KHOÁ (M3), đọc theo văn bản ────────────────────────────────────
 *   BÁN: users (1) → cosmetic_items (2) → vat_pham_ban_the (4) → QUY_CHO (6).
 *   MUA: thêm TREASURY (5) trước QUY_CHO (6), vì 2% phí về Kho bạc.
 *   Mỗi cửa là MỘT transaction, và khoá nhả hết khi transaction đóng — nên hai
 *   cửa không ràng buộc nhau. `lint:thu-tu-khoa` đặt lại mốc ở mỗi `BEGIN`
 *   chính vì lẽ đó (D286); trước khi có ranh ấy nó báo sai đúng ca này.
 *
 * ─── PHẠM VI, CỐ Ý HẸP ────────────────────────────────────────────────────
 *  · chỉ NHÃN DÁN (kind = 'sticker') — khung/nền là đồ đeo, mốc sau;
 *  · hệ số quỹ = mặc định; bậc thang theo tồn kho có, nhưng chính sách vặn nó
 *    (ngân hàng trung ương) thì chưa nối — đó là tầng N+2 (A11.22);
 *  · phí CHỈ ở chiều mua: người bán nhận đủ `gia_san`, còn người mua trả
 *    `gia_ban_ra` rồi 3% đốt + 2% về Kho bạc, phần còn lại nuôi quỹ. Một khoản
 *    phí ở chiều bán sẽ trừ vào đúng người đang cần tiền nhất.
 *
 * ─── ⚠⚠ BA SỔ ĐĂNG KÝ ĐÓNG MỘT CỬA TIỀN-VÀ-VẬT PHẢI ĐI QUA ─────────────────
 * Repo canh mỗi thứ bằng một bài quét mã nguồn riêng, và chúng KHÔNG biết nhau.
 * Viết cửa mới mà chỉ nhớ một sổ thì hai sổ kia sẽ đỏ ở lượt chạy suite đầy đủ
 * — đã xảy ra hai lần với chính tệp này (06/09).
 *
 *   1. ví      `SO_DANG_KY_CUA_CHAM_VI`  (`kinh_te/cua_tieu.ts`) — ai ghi `wallet_ledger`
 *   2. vật     `SO_DANG_KY_GHI_KHO`      (`kinh_te/so_vat.ts`)   — ai ghi hai bảng đọc nhanh
 *   3. Kho bạc `KHONG_PHAI_CUA`/`CUA_DA_GAC` (`tests/kho_bac_chan_khach.test.ts`) — ai gọi `treasuryAppend`
 *
 * Tệp này có mặt ở (1) và (3); cố ý KHÔNG có ở (2) vì nó không nhắc tên bảng
 * đọc nhanh nào — mọi phép ghi vật đi qua cổng `so_vat.ts`.
 *
 * ─── CỜ ────────────────────────────────────────────────────────────────────
 * Cả hai cửa giao dịch một `ban_the_id`, tức chúng đứng trên SỔ VẬT. Cờ
 * `CHO_SO_VAT` tắt thì sổ và bảng đọc nhanh không còn đi cùng nhau ⇒ mọi route
 * ở đây ĐÓNG (fail-closed), không phải "chạy theo bảng cũ".
 */
import { Hono } from 'hono';
import type pg from 'pg';
import { CHO } from '../config/cho.js';
import { conTrenLuoiSauKhiChi, lyDoTuChoiTieuT } from './kinh_te/cua_tieu.js';
import { chiaPhi, giaBanRa, giaSan } from './kinh_te/gia.js';
import { heThongMuaLai, lyDoKhongMuaLai } from './kinh_te/mua_lai.js';
import { QuyChoError, quyChoAppend, soDuQuyCho } from './kinh_te/quy_cho.js';
import {
  SoVatError, chuyenBanTheChoNguoi, chuyenBanTheVaoKho, soVatDangGhi,
} from './kinh_te/so_vat.js';
import { ShopError } from './shop_kho.js';
import { treasuryAppend } from './treasury.js';

import type { Env, Mw as Middleware } from './http/types.js';

interface BanThe {
  ban_the_id: string;
  chu_so_huu: string | null;
  trang_thai: string;
  seri: number;
  mau_id: string;
  rarity: string;
  kind: string;
}

async function docBanThe(client: pg.PoolClient, banTheId: string): Promise<BanThe | null> {
  const { rows } = await client.query(
    `SELECT b.ban_the_id::text, b.chu_so_huu::text, b.trang_thai, b.seri,
            d.mau_id, ci.rarity, ci.kind
       FROM vat_pham_ban_the b
       JOIN dot_phat_hanh d ON d.dot_id = b.dot_id
       JOIN cosmetic_items ci ON ci.cosmetic_id = d.mau_id
      WHERE b.ban_the_id = $1`,
    [banTheId],
  );
  return (rows[0] as BanThe | undefined) ?? null;
}

/** Số bản của mẫu này đang nằm trong kho AMM — đầu vào của bậc thang giá. */
async function tonKhoHeThong(client: pg.PoolClient, mauId: string): Promise<number> {
  const { rows } = await client.query(
    `SELECT count(*)::int AS n
       FROM vat_pham_ban_the b JOIN dot_phat_hanh d ON d.dot_id = b.dot_id
      WHERE d.mau_id = $1 AND b.kho = 'amm'`,
    [mauId],
  );
  return Number(rows[0].n);
}

function kiemBanTheId(v: unknown): string | null {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? String(v)
    : typeof v === 'string' && /^\d{1,18}$/.test(v) ? v
    : null;
}

export function registerChoRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: { requireAuth: Middleware; requireOnboarded: Middleware },
): void {
  const guard = [mw.requireAuth, mw.requireOnboarded] as const;

  /**
   * KHO CỦA TÔI — mọi bản thể nhãn dán `tu_do` tôi đang giữ, kèm giá Hệ thống sẽ
   * trả lúc này và cửa có mở không. Đây là cái màn Shop cần để vẽ nút Bán:
   * catalog chỉ mang SỐ ĐẾM (cache), còn bán thì bán một `ban_the_id`.
   *
   * Chỉ đọc, không khoá. Giá tính MỘT lần cho mỗi mẫu (cùng mẫu cùng giá lúc
   * này); `mo` gộp cả ba điều kiện của cửa bán để màn không tự suy (C4).
   */
  app.get('/api/v1/cho/cua-toi', ...guard, async (c) => {
    if (!soVatDangGhi()) return c.json({ error: 'feature_disabled', message: 'Chợ chưa mở.' }, 403);
    const userId = c.get('actor').userId!;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT b.ban_the_id::text AS ban_the_id, b.seri, d.mau_id, ci.label, ci.rarity
           FROM vat_pham_ban_the b
           JOIN dot_phat_hanh d ON d.dot_id = b.dot_id
           JOIN cosmetic_items ci ON ci.cosmetic_id = d.mau_id
          WHERE b.chu_so_huu = $1 AND b.trang_thai = 'tu_do' AND ci.kind = 'sticker'
          ORDER BY d.mau_id, b.seri`,
        [userId],
      );
      const quy = await soDuQuyCho(client);
      const giaTheoMau = new Map<string, bigint>();
      for (const r of rows) {
        if (!giaTheoMau.has(r.mau_id)) {
          const ton = await tonKhoHeThong(client, r.mau_id);
          giaTheoMau.set(r.mau_id, giaSan(r.rarity, ton, CHO.HS_QUY_BP_MAC_DINH));
        }
      }
      return c.json({
        quy_cho: Number(quy),
        mon: rows.map((r) => {
          const gia = giaTheoMau.get(r.mau_id)!;
          // ⚠ E24 trước tiên: món không có cửa tốn T để lấy thì Hệ thống KHÔNG
          // mua, và lý do đó KHÁC hẳn "quỹ không đủ". Trả mã, chữ ở client (D26)
          // — nói nhầm lý do còn tệ hơn không nói, vì nó hứa "mai quỹ dày thì bán
          // được" cho một món sẽ không bao giờ bán được.
          const camMuaLai = lyDoKhongMuaLai(r.mau_id);
          const lyDo = camMuaLai !== null ? camMuaLai
            : gia === 0n || quy < gia ? 'quy_khong_du' as const : null;
          return {
            ban_the_id: r.ban_the_id, mau_id: r.mau_id, ten: r.label, seri: Number(r.seri),
            gia: Number(gia), mo: lyDo === null, ly_do: lyDo,
          };
        }),
      });
    } finally {
      client.release();
    }
  });

  /*
   * ⚠ ĐÃ GỠ `GET /cho/gia/:ban_the_id` (D296). Tôi dựng nó ở D279 và **không
   * client nào gọi** — đo: `grep "cho/gia" web/src` ⇒ 0 kết quả. `/cho/cua-toi`
   * đã trả giá cho TỪNG bản rồi, nên nó thừa ngay từ lúc sinh ra.
   *
   * Gỡ không phải để cho gọn. Nó là chỗ thứ BA phải giữ đồng bộ cổng E24
   * (`heThongMuaLai`) cùng với `cua-toi` và `ban` — mà một luật chép ở ba chỗ
   * thì chỗ thứ ba sẽ trôi (D61/A11.5). Hôm nay repo vừa trả giá đúng hai lần
   * cho "mã tồn tại mà chưa bao giờ chạy" (D291 hằng số không ai đọc · D293 tệp
   * chưa bao giờ deploy). Một route không ai gọi là ca thứ ba của cùng họ đó.
   *
   * Cần lại thì dựng lại trong mười dòng — dữ liệu và hàm giá đều còn nguyên.
   */

  /** BÁN một bản thể cho Hệ thống ở `gia_san`. Một transaction, hoặc không gì cả. */
  app.post('/api/v1/cho/ban', ...guard, async (c) => {
    if (!soVatDangGhi()) return c.json({ error: 'feature_disabled', message: 'Chợ chưa mở.' }, 403);
    const userId = c.get('actor').userId!;
    const body = await c.req.json().catch(() => null) as { ban_the_id?: unknown } | null;
    const id = kiemBanTheId(body?.ban_the_id);
    if (id === null) return c.json({ error: 'invalid_input', field: 'ban_the_id' }, 400);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // (1) users — khoá ví trước mọi thứ khác.
      const { rows: uRows } = await client.query(
        'SELECT bankroll FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
      if (!uRows[0]) throw new ShopError('khong_co_ho_so', 404);
      const viTruoc = uRows[0].bankroll as bigint;

      const b = await docBanThe(client, id);
      if (!b || b.chu_so_huu !== userId) throw new ShopError('khong_so_huu', 404, 'Bạn không sở hữu bản này.');
      if (b.kind !== 'sticker') throw new ShopError('chua_ho_tro', 409, 'Mốc này chỉ bán nhãn dán.');
      if (b.trang_thai !== 'tu_do') throw new ShopError('khong_tu_do', 409, 'Bản này đã gắn hoặc đã tiêu.');
      /*
       * ⚠⚠ E24 — CHẶN TRƯỚC KHI CHẠM BẤT KỲ SỔ NÀO. Hệ thống chỉ trả tiền cho
       * món có một cửa tốn T để lấy; món tới bằng quà/battle pass thì giá của nó
       * là một câu hỏi riêng, chưa có nguồn (`HE_THONG_MUA_LAI_DOC_BAN = false`).
       * Ca thật đã mở trên prod: `Dấu niêm Beta` bán được 600 T = 30% quỹ chợ.
       */
      if (!heThongMuaLai(b.mau_id)) {
        throw new ShopError('khong_ban_lai', 409,
          'Hệ thống không mua lại món này — nó không có cửa mua bằng T.');
      }

      // (2) cosmetic_items — khoá mẫu RỒI MỚI đếm tồn kho: câu đếm là câu lệnh
      // mới ⇒ snapshot mới, thấy đúng những gì người trước vừa commit (bài học
      // ở đầu `shop_kho.ts`).
      await client.query('SELECT 1 FROM cosmetic_items WHERE cosmetic_id = $1 FOR UPDATE', [b.mau_id]);
      const ton = await tonKhoHeThong(client, b.mau_id);
      const gia = giaSan(b.rarity, ton, CHO.HS_QUY_BP_MAC_DINH);
      if (gia === 0n) throw new ShopError('he_thong_khong_mua', 409, 'Hệ thống hiện không mua món này.');

      // (4) Sổ vật + bảng đọc nhanh — qua CỔNG, không ghi tay. Cổng khoá bản thể,
      // kiểm lại chủ/trạng thái dưới khoá (hai tab cùng bán một bản), chuyển sang
      // kho AMM, trừ kho_sticker; cache không có gì để trừ ⇒ sổ và cache đã
      // lệch ⇒ hỏng cả cú bán, để audit:cung chỉ đúng chỗ.
      try {
        await chuyenBanTheVaoKho(client, { banTheId: id, chuSoHuu: userId, mauId: b.mau_id, kho: 'amm' });
      } catch (e) {
        if (e instanceof SoVatError) {
          throw new ShopError(e.ma === 'so_lech' ? 'so_lech' : 'khong_tu_do', 409,
            e.ma === 'so_lech' ? 'Kho và sổ không khớp — chưa bán được.' : 'Bản này vừa đổi trạng thái.');
        }
        throw e;
      }

      // (6) quỹ chợ trả tiền — khoá riêng, kiểm số dư DƯỚI khoá.
      let quyChoSau: bigint;
      try {
        quyChoSau = await quyChoAppend(client, -gia, 'mua_vao', id);
      } catch (e) {
        if (e instanceof QuyChoError) throw new ShopError('he_thong_khong_mua', 409, 'Quỹ chợ hiện không đủ để mua.');
        throw e;
      }

      // Ví người bán +gia, sổ ví cùng transaction.
      const viSau = viTruoc + gia;
      await client.query('UPDATE users SET bankroll = $1 WHERE user_id = $2', [viSau.toString(), userId]);
      await client.query(
        `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
         VALUES ($1, $2, $3, 'ban_cho_he_thong')`,
        [userId, gia.toString(), viSau.toString()],
      );

      // Sự kiện — cùng transaction (A7). Chỉ ID + số (D26, K5).
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type,
                             value_num, value_json, state_snapshot_json)
         VALUES ($1, 'cho', 'ban', 'cho_ban', $2, $3, NULL)`,
        [userId, Number(gia), JSON.stringify({ m: b.mau_id, s: b.seri, b: b.rarity, ton })],
      );

      await client.query('COMMIT');
      return c.json({
        ok: true, ban_the_id: id, gia: Number(gia),
        bankroll: Number(viSau), quy_cho: Number(quyChoSau),
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err instanceof ShopError) {
        return c.json({ error: err.code, message: err.message }, err.httpCode as 400);
      }
      throw err;
    } finally {
      client.release();
    }
  });

  /**
   * QUẦY HỆ THỐNG — mọi bản thể đang nằm trong kho AMM, kèm giá bán ra lúc này.
   *
   * ⚠ Liệt kê TỪNG BẢN, không gộp thành "còn 4 cái". Cùng một mẫu thì cùng giá,
   * nên gộp lại có vẻ gọn hơn — nhưng seri là thứ người chơi phân biệt được, và
   * quầy có bản #1 của mình nằm đó là toàn bộ lý do một cái chợ đáng nhìn. Gộp
   * đi là bỏ đúng phần có cảm xúc để đổi lấy một dòng JSON ngắn hơn.
   *
   * Chỉ đọc, không khoá. `mo` gộp mọi điều kiện để màn không tự suy (C4).
   */
  app.get('/api/v1/cho/quay', ...guard, async (c) => {
    if (!soVatDangGhi()) return c.json({ error: 'feature_disabled', message: 'Chợ chưa mở.' }, 403);
    const userId = c.get('actor').userId!;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT b.ban_the_id::text AS ban_the_id, b.seri, d.mau_id, ci.label, ci.rarity,
                count(*) OVER (PARTITION BY d.mau_id)::int AS ton
           FROM vat_pham_ban_the b
           JOIN dot_phat_hanh d ON d.dot_id = b.dot_id
           JOIN cosmetic_items ci ON ci.cosmetic_id = d.mau_id
          WHERE b.chu_so_huu IS NULL AND b.kho = 'amm'
            AND b.trang_thai = 'tu_do' AND ci.kind = 'sticker'
          ORDER BY d.mau_id, b.seri
          LIMIT 200`,
      );
      const { rows: vRows } = await client.query(
        'SELECT bankroll FROM users WHERE user_id = $1', [userId]);
      const vi = (vRows[0]?.bankroll as bigint | undefined) ?? 0n;
      return c.json({
        bankroll: Number(vi),
        mon: rows.map((r) => {
          const gia = giaBanRa(giaSan(r.rarity, Number(r.ton), CHO.HS_QUY_BP_MAC_DINH));
          return {
            ban_the_id: r.ban_the_id, mau_id: r.mau_id, ten: r.label, seri: Number(r.seri),
            ton: Number(r.ton), gia: Number(gia),
            mo: gia > 0n && vi >= gia && conTrenLuoiSauKhiChi(vi, gia),
          };
        }),
      });
    } finally {
      client.release();
    }
  });

  /**
   * MUA một bản thể từ kho Hệ thống ở `gia_ban_ra`. Một transaction, hoặc không gì.
   *
   * ─── ĐÂY LÀ CHIỀU CÓ PHÍ, VÀ PHÍ CHIA BA ──────────────────────────────────
   * `nen-kinh-te-app.md` §2: *"phí mỗi giao dịch 5%: 3% ĐỐT + 2% ► KHO BẠC"*,
   * còn spread thì về QUỸ. Ba mảnh của `chiaPhi(gia)` cộng lại đúng bằng số T
   * rời ví, nên bất biến E1 cân **theo cấu trúc** chứ không nhờ một phép trừ
   * viết đúng — `chiaPhi` trả phần dư về quỹ chính vì lý do đó.
   *
   * ⚠ Ở số nhỏ, 3% và 2% ĐỀU LÀM TRÒN VỀ 0 (dưới 34 T và dưới 50 T). Route này
   * KHÔNG bịa ra một sàn phí để chữa: sàn phí đổi khuôn rake 3%+2%, mà D16 §6
   * gọi đó là *hằng số niềm tin*, tức một quyết định của founder chứ không phải
   * một cú vặn tham số. Thay vào đó phí thực thu ghi thẳng vào `events.value_json`
   * để câu hỏi *"bao nhiêu phần trăm giao dịch trả 0 phí?"* trả lời được bằng
   * SQL — hoãn thì phải kèm điều kiện kích hoạt ĐO ĐƯỢC (A11.15).
   *
   * ─── CỔNG CỬA TIÊU T ──────────────────────────────────────────────────────
   * Mua là chi KHÔNG HOÀN vào ngoại hình — đúng họ cửa mà `conTrenLuoiSauKhiChi`
   * sinh ra để canh (B2/D253), y như gacha. Chiều BÁN thì không qua cổng vì một
   * khoản đi vào không đẩy ai xuống dưới lưới; hai chiều, hai luật, cùng tệp.
   *
   * ─── THỨ TỰ KHOÁ (M3) ─────────────────────────────────────────────────────
   *   users (1) → cosmetic_items (2) → vat_pham_ban_the (4, trong cổng)
   *   → TREASURY (5) → QUY_CHO (6). Tăng dần, không lùi.
   */
  app.post('/api/v1/cho/mua', ...guard, async (c) => {
    if (!soVatDangGhi()) return c.json({ error: 'feature_disabled', message: 'Chợ chưa mở.' }, 403);
    const userId = c.get('actor').userId!;
    const body = await c.req.json().catch(() => null) as { ban_the_id?: unknown } | null;
    const id = kiemBanTheId(body?.ban_the_id);
    if (id === null) return c.json({ error: 'invalid_input', field: 'ban_the_id' }, 400);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // (1) users — khoá ví trước mọi thứ khác.
      const { rows: uRows } = await client.query(
        'SELECT bankroll FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
      if (!uRows[0]) throw new ShopError('khong_co_ho_so', 404);
      const viTruoc = uRows[0].bankroll as bigint;

      const b = await docBanThe(client, id);
      if (!b) throw new ShopError('khong_thay', 404, 'Không có bản này.');
      if (b.chu_so_huu !== null) throw new ShopError('da_co_chu', 409, 'Bản này đã có người mua.');
      if (b.kind !== 'sticker') throw new ShopError('chua_ho_tro', 409, 'Mốc này chỉ bán nhãn dán.');

      // (2) cosmetic_items — khoá mẫu RỒI MỚI đếm tồn kho: câu đếm là câu lệnh
      // mới ⇒ snapshot mới, thấy đúng những gì người mua trước vừa commit.
      await client.query('SELECT 1 FROM cosmetic_items WHERE cosmetic_id = $1 FOR UPDATE', [b.mau_id]);
      const ton = await tonKhoHeThong(client, b.mau_id);
      const gia = giaBanRa(giaSan(b.rarity, ton, CHO.HS_QUY_BP_MAC_DINH));
      if (gia === 0n) throw new ShopError('he_thong_khong_ban', 409, 'Hệ thống hiện không bán món này.');
      if (viTruoc < gia) {
        throw new ShopError('khong_du_t', 409, `Cần ${gia} T, ví đang có ${viTruoc} T.`);
      }
      if (!conTrenLuoiSauKhiChi(viTruoc, gia)) {
        throw new ShopError('von_qua_thap', 409, lyDoTuChoiTieuT(gia));
      }

      // (4) Sổ vật — qua CỔNG. Cổng khoá bản thể, kiểm lại "còn trong kho" dưới
      // khoá (hai người cùng bấm một bản), rồi cộng bảng đọc nhanh.
      try {
        await chuyenBanTheChoNguoi(client, { banTheId: id, chuMoi: userId, mauId: b.mau_id, kho: 'amm' });
      } catch (e) {
        if (e instanceof SoVatError) throw new ShopError('da_co_chu', 409, 'Bản này vừa có người mua.');
        throw e;
      }

      // Phí chia ba — cộng lại đúng `gia`, không dư một đồng.
      const phi = chiaPhi(gia);
      if (phi.dot > 0n) {
        await client.query(
          `INSERT INTO burn_ledger (amount, reason) VALUES ($1, 'phi_cho_burn')`,
          [phi.dot.toString()]);
      }
      // (5) Kho bạc. Bỏ qua khi 0 — một dòng sổ delta = 0 là rác, và `quyChoAppend`
      // đã cấm hẳn delta 0 nên bỏ qua ở đây là giữ hai sổ cùng một nếp.
      if (phi.khoBac > 0n) await treasuryAppend(client, phi.khoBac, 'phi_cho_in');
      // (6) quỹ chợ nhận phần còn lại.
      const quyChoSau = await quyChoAppend(client, phi.quyCho, 'ban_ra', id);

      // Ví người mua −gia, sổ ví cùng transaction.
      const viSau = viTruoc - gia;
      await client.query('UPDATE users SET bankroll = $1 WHERE user_id = $2', [viSau.toString(), userId]);
      await client.query(
        `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
         VALUES ($1, $2, $3, 'mua_cua_he_thong')`,
        [userId, (-gia).toString(), viSau.toString()],
      );

      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type,
                             value_num, value_json, state_snapshot_json)
         VALUES ($1, 'cho', 'mua', 'cho_mua', $2, $3, NULL)`,
        [userId, Number(gia), JSON.stringify({
          m: b.mau_id, s: b.seri, b: b.rarity, ton,
          // Phí THỰC THU, không phải phí danh nghĩa — đây là con số trả lời
          // "bao nhiêu giao dịch trả 0 phí" mà không phải suy lại từ giá.
          pd: Number(phi.dot), pk: Number(phi.khoBac),
        })],
      );

      await client.query('COMMIT');
      return c.json({
        ok: true, ban_the_id: id, gia: Number(gia),
        phi_dot: Number(phi.dot), phi_kho_bac: Number(phi.khoBac),
        bankroll: Number(viSau), quy_cho: Number(quyChoSau),
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err instanceof QuyChoError) {
        return c.json({ error: 'quy_cho_loi', message: 'Quỹ chợ từ chối bút toán.' }, 409);
      }
      if (err instanceof ShopError) {
        return c.json({ error: err.code, message: err.message }, err.httpCode as 400);
      }
      throw err;
    } finally {
      client.release();
    }
  });
}
