/**
 * DIỆN MẠO — API bộ sưu tập avatar, khung viền, và DÁN NHÃN VĨNH VIỄN (D36).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BỐN LUẬT CỦA TẦNG NÀY.
 *
 * 1. SERVER KIỂM SỞ HỮU, MỌI LẦN, TRONG CÙNG TRANSACTION VỚI LƯU (C4). Client
 *    không bao giờ tự quyết mình có gì, và không bao giờ tự dựng chuỗi diện mạo:
 *    nó gửi Ý ĐỊNH (dán món X ở ô (x,y)), server dựng chuỗi. Nếu client dựng chuỗi
 *    thì dạng chuỗi thành hợp đồng công khai và đổi nó về sau là đổi cả app native
 *    (C6) — mà tệ hơn: một client sửa được sẽ dán được món nó không có.
 *
 * 2. KHÔNG ENDPOINT NÀO TRẢ DIỆN MẠO THEO `user_id` TUỲ Ý. Diện mạo người khác chỉ
 *    đi kèm payload ghế/bảng đã có. Cùng lý do D19 chốt ẩn phân bố ở TẦNG API và
 *    `design_rank.md` chốt không có endpoint tra điểm theo `user_id`: một bề mặt
 *    tra cứu người khác là một bề mặt bị quét.
 *
 * 3. CHUỖI LẠ KHÔNG BAO GIỜ THÀNH 500. Món đã rút khỏi catalog → bỏ đúng nhãn đó
 *    (xem `docDienMao`). Một ô vuông trắng giữa bàn đấu tệ hơn một cái mặt thiếu
 *    một nhãn dán, và 500 giữa trận thì tệ hơn cả hai.
 *
 * 4. **DÁN LÀ TIÊU VĨNH VIỄN, VÀ SERVER PHẢI ĐÒI MỘT LỜI XÁC NHẬN TƯỜNG MINH.**
 *    D36 đòi hộp xác nhận trước khi dán. Hộp thoại là việc của UI — nhưng nếu chỉ
 *    có UI canh thì một lần nối dây sai, một cú double-tap, hay một bản web cũ
 *    trong service worker là đủ để tiêu mất một nhãn hiếm của người ta, KHÔNG HOÀN
 *    ĐƯỢC. Nên `xac_nhan: true` là điều kiện ở TẦNG API: thiếu nó thì 400, và
 *    trường ấy không có giá trị mặc định ở bất cứ đâu.
 *
 * ⚠ BOT KHÔNG CÓ ĐƯỜNG NÀO TỚI ĐÂY. Không phải nhờ một luật lọc (luật lọc thì có
 * ngày quên) mà vì cấu tạo: bot không có `user_id` nên không có dòng `users`, không
 * có dòng `avatar_so_huu`, không có kho nhãn. Cùng mẹo đã dùng để bot không lên nổi
 * bảng xếp hạng.
 */
import { Hono } from 'hono';
import type pg from 'pg';
import {
  AVATAR_NEN, CATALOG_DIEN_MAO, chuoiTranTrui, DAN_TOI_DA, DIEN_MAO_MAC_DINH,
  DIEN_MAO_REGEX, docDienMao, GIA_BAN_SAO_THEM, khungTheoId, MA_NEN,
  NEN_TANG, nhanDanTheoId, O_LUOI, vietDienMao,
} from '../config/avatar.js';
import { capMonHuuHan, ShopError } from './shop_kho.js';

import { tieuBanThe } from './kinh_te/so_vat.js';
import type { Env, Mw as Middleware } from './http/types.js';
/**
 * Chỉ cần `query` — nhận cả Pool lẫn PoolClient.
 *
 * Kiểu hẹp như thế này không phải để gõ ít: nó làm cho các hàm `cap*` / `tao*` /
 * `dongBo*` KHÔNG THỂ tự mở transaction của riêng chúng. Người gọi bắt buộc phải
 * truyền client đang trong tx của mình, nên "ghi diện mạo xong mà hồ sơ rollback"
 * là chuyện không viết ra được (A7: event + nghiệp vụ cùng một transaction).
 */
type Q = {
  query: (text: string, values?: readonly unknown[]) => Promise<pg.QueryResult<any>>;
};

export class AvatarError extends Error {
  constructor(public readonly code: string, public readonly httpCode = 409, msg?: string) {
    super(msg ?? code);
  }
}

/**
 * Dựng lại chuỗi diện mạo của MỘT tác phẩm TỪ NGUỒN CHÂN LÝ và ghi bản sao đọc
 * nhanh vào `avatar_so_huu.chuoi` (+ `users.dien_mao` nếu đang mặc).
 *
 * ⚠ ĐÂY LÀ ĐƯỜNG DUY NHẤT ĐƯỢC GHI HAI CỘT ĐÓ. Hai bản sao của cùng một sự thật
 * thì SẼ lệch — trừ khi chỉ có đúng một hàm viết chúng và hàm đó luôn đọc lại từ
 * `avatar_dan`. `tests/avatar.test.ts` recompute lại từ bảng dán rồi so, nên lệch
 * là CI đỏ chứ không phải "hồ sơ hiện một đằng, trong trận hiện một nẻo".
 */
export async function dongBoDienMao(client: Q, avatarId: string): Promise<string> {
  const { rows } = await client.query(
    `SELECT a.nen, a.khung_id, a.an, a.user_id,
            COALESCE(json_agg(json_build_object(
              'mon', d.sticker_id, 'x', d.x, 'y', d.y, 'lat', d.lat)
              ORDER BY d.thu_tu) FILTER (WHERE d.dan_id IS NOT NULL), '[]') AS dan
       FROM avatar_so_huu a
       LEFT JOIN avatar_dan d ON d.avatar_id = a.avatar_id
      WHERE a.avatar_id = $1
      GROUP BY a.avatar_id`,
    [avatarId],
  );
  const r = rows[0];
  if (!r) throw new AvatarError('avatar_khong_ton_tai', 404);

  const day = vietDienMao({
    goc: r.nen as string,
    khung: (r.khung_id as string | null) ?? null,
    dan: r.dan as { mon: string; x: number; y: number; lat: boolean }[],
  });
  // Tác phẩm bị ẩn → chỉ còn NỀN. Giữ khuôn mặt để người chơi vẫn nhận ra nhau
  // (D25), bỏ đúng phần gây vấn đề. Xoá sạch là phạt nặng hơn mức cần.
  const chuoi = r.an ? chuoiTranTrui(day) : day;

  await client.query('UPDATE avatar_so_huu SET chuoi = $1 WHERE avatar_id = $2',
    [chuoi, avatarId]);
  await client.query(
    'UPDATE users SET dien_mao = $1 WHERE user_id = $2 AND avatar_dang_mac = $3',
    [chuoi, r.user_id, avatarId],
  );
  return chuoi;
}

/**
 * Tạo MỘT tác phẩm mới (avatar nền trắng, chưa dán gì).
 *
 * Dùng cho: quà khởi đầu · shop bán nền · admin bồi thường. Trả `avatar_id` để
 * người gọi ghi tiếp event/ledger trong CÙNG transaction.
 */
export async function taoAvatarNen(
  client: Q, userId: string, nen: string, nguon: string,
): Promise<{ avatarId: string; seri: number; chuoi: string }> {
  if (!MA_NEN.includes(nen)) throw new AvatarError('nen_khong_ton_tai', 400);
  const { rows } = await client.query(
    `INSERT INTO avatar_so_huu (user_id, nen, nguon, seri, chuoi)
     SELECT $1, $2, $3, COALESCE(MAX(seri), 0) + 1, $4
       FROM avatar_so_huu WHERE user_id = $1 AND nen = $2
     RETURNING avatar_id, seri, chuoi`,
    [userId, nen, nguon, vietDienMao({ goc: nen })],
  );
  const r = rows[0];
  return { avatarId: String(r.avatar_id), seri: Number(r.seri), chuoi: r.chuoi as string };
}

/**
 * QUÀ KHỞI ĐẦU — hai lá tặng, tạo trong CÙNG transaction với hồ sơ (D36 điểm 2).
 *
 * Tặng CẢ HAI chứ không chỉ lá đã chọn: hai lá là quà, và người chơi phải có sẵn
 * một tấm nền thứ hai để lỡ dán hỏng tấm đầu thì còn đường đi tiếp. Nếu chỉ tặng
 * một thì cú dán đầu tiên trong đời tài khoản là cú dán vào tài sản duy nhất — quá
 * đắt để ai đó dám thử, và một cơ chế không ai dám chạm là một cơ chế trang trí.
 */
export async function capBoKhoiDau(
  client: Q, userId: string, nenChon: string,
): Promise<{ dienMao: string; avatarId: string }> {
  const chon = MA_NEN.includes(nenChon) ? nenChon : NEN_TANG[0]!.ma;
  let dangMac: { avatarId: string; chuoi: string } | null = null;
  for (const nen of NEN_TANG) {
    const t = await taoAvatarNen(client, userId, nen.ma, 'tang_khoi_dau');
    if (nen.ma === chon) dangMac = { avatarId: t.avatarId, chuoi: t.chuoi };
  }
  const m = dangMac!;
  await client.query(
    'UPDATE users SET avatar_dang_mac = $1, dien_mao = $2 WHERE user_id = $3',
    [m.avatarId, m.chuoi, userId],
  );
  return { dienMao: m.chuoi, avatarId: m.avatarId };
}

/**
 * Trao nhãn dán vào kho (gacha / shop / nhiệm vụ / admin).
 *
 * MỌI CỬA PHÁT ĐI QUA ĐÚNG MỘT PHÉP ĐẾM — và phép đếm đó là `capMonHuuHan` trong
 * `server/shop_kho.ts`, không phải một bản chép ở đây. Món ĐỘC QUYỀN của D36 ("số
 * lượng cực ít") chỉ giữ được lời hứa nếu hai cửa phát không đếm bằng hai đoạn mã
 * khác nhau: đoạn nào cũng đúng lúc viết, rồi một đoạn được sửa còn đoạn kia không.
 *
 * ⚠ BẢN CŨ Ở ĐÂY CÓ LỖI ĐUA ĐIỀU KIỆN — ghi lại để không ai viết lại nó cho gọn:
 * nó gộp KHOÁ và ĐẾM vào một câu `SELECT gioi_han, (SELECT SUM(tong_nhan) …) …
 * FOR UPDATE`. Ở READ COMMITTED, snapshot của một câu lệnh được chụp lúc câu lệnh
 * BẮT ĐẦU, không phải lúc nó lấy được khoá — nên mọi lượt phát đang xếp hàng đều
 * đếm bằng số ĐÃ CŨ và tất cả cùng được cấp, không lỗi nào nổ. `tests/avatar.test.ts`
 * §6b tái hiện tất định: 3 lượt chen nhau trên bản CUỐI CÙNG thì cả 3 cùng qua.
 * Cách đúng (hai câu lệnh: khoá trước, đếm sau) nằm trong `capMonHuuHan` cùng lý do
 * viết đầy đủ ở đầu `shop_kho.ts`.
 *
 * Hàm này còn lại đúng hai việc: kiểm nhãn có trong catalog diện mạo, và đổi KIỂU
 * lỗi. `ShopError` lọt ra ngoài thì route admin ở dưới (chỉ bắt `AvatarError`) trả
 * 500 cho một tình huống hoàn toàn bình thường — "hết bản phát hành". Mã lỗi giữ
 * NGUYÊN, không dịch lại: hai cửa cùng một sự thật thì nên nói cùng một câu.
 */
export async function capSticker(
  client: Q, userId: string, stickerId: string, soLuong: number,
): Promise<void> {
  if (!nhanDanTheoId(stickerId)) throw new AvatarError('nhan_khong_ton_tai', 400);
  try {
    await capMonHuuHan(client, userId, stickerId, soLuong);
  } catch (err) {
    if (err instanceof ShopError) throw new AvatarError(err.code, err.httpCode, err.message);
    throw err;
  }
}

/** Chuỗi diện mạo hợp lệ VỀ DẠNG (chưa xét sở hữu). */
export function dangHopLe(s: unknown): s is string {
  return typeof s === 'string' && DIEN_MAO_REGEX.test(s);
}

function soNguyenTrongLuoi(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < O_LUOI ? v : null;
}

/** Kẹp một con số client gửi về khoảng lành mạnh — dùng cho trường đo lường. */
function doThoiGian(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.max(0, Math.min(600_000, Math.round(v))) : null;
}

export function registerAvatarRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: {
    requireAuth: Middleware; requireOnboarded: Middleware; requireAdmin: Middleware;
    requireXacThucLai: Middleware;
  },
): void {
  const guard = [mw.requireAuth, mw.requireOnboarded] as const;

  /**
   * Catalog — client dựng màn chọn TỪ ĐÂY, không hard-code danh sách.
   *
   * Không cần đăng nhập: đây là dữ liệu tĩnh. Và màn onboard phải vẽ được hai lá
   * tặng TRƯỚC KHI có hồ sơ `users` (đó là lúc người ta chọn).
   */
  app.get('/api/v1/avatar/catalog', (c) => {
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({
      nen: AVATAR_NEN.map((n) => ({
        ma: n.ma, id: n.id, ten: n.ten, mo_ta: n.mo_ta,
        nguon: n.nguon, gia_q: n.gia_q, phien_ban: n.phien_ban,
      })),
      nen_tang: NEN_TANG.map((n) => n.ma),
      mon: CATALOG_DIEN_MAO.map((m) => ({
        id: m.id, ten: m.ten, hiem: m.hiem, nguon: m.nguon,
        gia_q: m.gia_q, gioi_han: m.gioi_han, ghi_chu: m.ghi_chu,
      })),
      // Giá bản sao thêm CHƯA CÓ (A8.2 — chờ founder). Trả ra để UI nói thật với
      // người chơi ("chưa mở bán") thay vì hiện một nút bấm vào là lỗi.
      gia_ban_sao_them: GIA_BAN_SAO_THEM,
      dan_toi_da: DAN_TOI_DA,
      mac_dinh: DIEN_MAO_MAC_DINH,
    });
  });

  /** Bộ sưu tập CỦA CHÍNH MÌNH. Không nhận `user_id` (luật 2). */
  app.get('/api/v1/avatar/me', ...guard, async (c) => {
    const userId = c.get('actor').userId!;
    const [me, bst, kho, khung] = await Promise.all([
      pool.query('SELECT dien_mao, avatar_dang_mac FROM users WHERE user_id = $1', [userId]),
      pool.query(
        `SELECT a.avatar_id, a.nen, a.seri, a.khung_id, a.chuoi, a.an, a.created_at,
                (SELECT COUNT(*) FROM avatar_dan d WHERE d.avatar_id = a.avatar_id) AS so_dan
           FROM avatar_so_huu a WHERE a.user_id = $1 ORDER BY a.created_at, a.avatar_id`,
        [userId],
      ),
      pool.query(
        // JOIN theo `sticker_id` chứ không `USING (cosmetic_id)`: kho đặt tên cột
        // theo VAI TRÒ (nhãn dán) chứ không theo bảng nguồn, và `USING` im lặng
        // đòi hai bên cùng tên cột.
        `SELECT k.sticker_id, k.so_luong FROM kho_sticker k
           JOIN cosmetic_items ci ON ci.cosmetic_id = k.sticker_id
          WHERE k.user_id = $1 AND k.so_luong > 0 AND ci.trang_thai = 'song'
          ORDER BY k.sticker_id`,
        [userId],
      ),
      pool.query(
        `SELECT uc.cosmetic_id FROM user_cosmetics uc
           JOIN cosmetic_items ci USING (cosmetic_id)
          WHERE uc.user_id = $1 AND ci.kind = 'khung' AND ci.trang_thai = 'song'`,
        [userId],
      ),
    ]);

    return c.json({
      dien_mao: me.rows[0]?.dien_mao ?? DIEN_MAO_MAC_DINH,
      dang_mac: me.rows[0]?.avatar_dang_mac ? String(me.rows[0].avatar_dang_mac) : null,
      bo_suu_tap: bst.rows.map((r) => ({
        avatar_id: String(r.avatar_id),
        nen: r.nen as string,
        seri: Number(r.seri),
        khung_id: (r.khung_id as string | null) ?? null,
        chuoi: r.chuoi as string,
        an: r.an as boolean,
        so_dan: Number(r.so_dan),
      })),
      kho: kho.rows.map((r) => ({
        sticker_id: r.sticker_id as string, so_luong: Number(r.so_luong),
      })),
      khung_so_huu: khung.rows.map((r) => r.cosmetic_id as string),
    });
  });

  /**
   * Đổi tác phẩm ĐANG MẶC.
   *
   * Không nhận chuỗi, chỉ nhận `avatar_id`: "đang mặc" là một CON TRỎ tới một tác
   * phẩm có thật của chính mình, nên "mặc một diện mạo mình không sở hữu" không
   * viết ra được, kể cả khi client bị sửa.
   */
  app.post('/api/v1/avatar/mac', ...guard, async (c) => {
    const userId = c.get('actor').userId!;
    const body = await c.req.json().catch(() => null) as { avatar_id?: unknown } | null;
    const avatarId = String(body?.avatar_id ?? '');
    if (!/^\d+$/.test(avatarId)) {
      return c.json({ error: 'avatar_id_sai', message: 'Thiếu mã tác phẩm.' }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT chuoi FROM avatar_so_huu WHERE avatar_id = $1 AND user_id = $2 FOR UPDATE`,
        [avatarId, userId],
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return c.json({ error: 'khong_so_huu', message: 'Tác phẩm này không phải của bạn.' }, 404);
      }
      const { rows: uRows } = await client.query(
        'SELECT dien_mao FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
      const truoc: string = uRows[0]?.dien_mao ?? DIEN_MAO_MAC_DINH;
      const sau: string = rows[0].chuoi;

      await client.query(
        'UPDATE users SET avatar_dang_mac = $1, dien_mao = $2 WHERE user_id = $3',
        [avatarId, sau, userId],
      );
      // Event CÙNG transaction, không fire-and-forget (A7): tách ra thì có ngày ghi
      // được event mà không ghi được diện mạo, và `events` append-only nên cái sai
      // đó ở lại vĩnh viễn trong đúng bảng làm sản phẩm.
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type,
                             value_json, state_snapshot_json)
         VALUES ($1, 'avatar', $2, 'cos_equip', $3, NULL)`,
        [userId, userId, JSON.stringify({ truoc, sau, avatar_id: avatarId })],
      );
      await client.query('COMMIT');
      return c.json({ ok: true, dien_mao: sau });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  /**
   * ĐỔI LÁ GỐC đang mặc — founder báo 02/08: "không đổi avatar được".
   *
   * ⚠ BẪY TRANG TRÍ LẦN 16, CHIỀU NGƯỢC: Profile đã POST `/avatar/goc` từ lâu
   * mà route này CHƯA TỪNG TỒN TẠI — mọi cú bấm ăn 404 và màn chỉ nói "chưa
   * đổi được, thử lại nhé". Lần này UI sống, server câm.
   *
   * Ngữ nghĩa: `goc` là MÃ NỀN (một trong ba lá tặng, hoặc nền đang sở hữu).
   * Đổi gốc = MẶC tấm nền thuộc sở hữu có nền đó (ưu tiên tấm chưa ẩn, seri
   * nhỏ nhất — tấm khởi đầu). Mỗi tấm là một tác phẩm độc lập (D42) nên nhãn
   * dán/khung của tấm nào đi theo tấm đó, không "chuyển mặt giữ đồ".
   *
   * CẤP BÙ: tài khoản mở trước khi lá ẨN DANH ra đời (D41) chưa từng nhận tấm
   * của lá đó — chọn nó thì cấp đúng MỘT tấm `tang_khoi_dau` như luật quà khởi
   * đầu (D42: một tấm mỗi lá tặng), không phải mint ngoài luật.
   */
  app.post('/api/v1/avatar/goc', ...guard, async (c) => {
    const userId = c.get('actor').userId!;
    const body = await c.req.json().catch(() => null) as { goc?: unknown } | null;
    const goc = String(body?.goc ?? '');
    if (!MA_NEN.includes(goc)) {
      return c.json({ error: 'nen_khong_ton_tai', message: 'Ảnh đại diện này không tồn tại.' }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT avatar_id, chuoi FROM avatar_so_huu
          WHERE user_id = $1 AND nen = $2
          ORDER BY an ASC, seri ASC LIMIT 1 FOR UPDATE`,
        [userId, goc],
      );
      let avatarId: string; let sau: string;
      if (rows[0]) {
        avatarId = String(rows[0].avatar_id);
        sau = rows[0].chuoi as string;
      } else if (NEN_TANG.some((n) => n.ma === goc)) {
        const t = await taoAvatarNen(client, userId, goc, 'tang_khoi_dau');
        avatarId = t.avatarId;
        sau = t.chuoi;
      } else {
        await client.query('ROLLBACK');
        return c.json({ error: 'chua_so_huu', message: 'Bạn chưa có tấm nền này — mua ở Shop.' }, 404);
      }

      const { rows: uRows } = await client.query(
        'SELECT dien_mao FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
      const truoc: string = uRows[0]?.dien_mao ?? DIEN_MAO_MAC_DINH;
      await client.query(
        'UPDATE users SET avatar_dang_mac = $1, dien_mao = $2 WHERE user_id = $3',
        [avatarId, sau, userId],
      );
      // Cùng khuôn event với /mac — một hành vi "đổi thứ đang mặc", một tên.
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type,
                             value_json, state_snapshot_json)
         VALUES ($1, 'avatar', $2, 'cos_equip', $3, NULL)`,
        [userId, userId, JSON.stringify({ truoc, sau, avatar_id: avatarId, goc })],
      );
      await client.query('COMMIT');
      return c.json({ ok: true, dien_mao: sau });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  /**
   * Lắp / tháo KHUNG trên một tác phẩm.
   *
   * Khung là đồ ĐEO, không tiêu hao — đây là chỗ duy nhất trong tầng diện mạo còn
   * đường lùi, và nó ở đó có chủ ý: nếu mọi thao tác đều một-đi-không-trở-lại thì
   * người chơi sẽ không dám chạm vào cái gì cả.
   */
  app.post('/api/v1/avatar/khung', ...guard, async (c) => {
    const userId = c.get('actor').userId!;
    const body = await c.req.json().catch(() => null) as
      { avatar_id?: unknown; khung_id?: unknown } | null;
    const avatarId = String(body?.avatar_id ?? '');
    const khungId = body?.khung_id === null || body?.khung_id === undefined
      ? null : String(body.khung_id);
    if (!/^\d+$/.test(avatarId) || (khungId !== null && !khungTheoId(khungId))) {
      return c.json({ error: 'tham_so_sai', message: 'Khung hoặc tác phẩm không hợp lệ.' }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT 1 FROM avatar_so_huu WHERE avatar_id = $1 AND user_id = $2 FOR UPDATE',
        [avatarId, userId],
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return c.json({ error: 'khong_so_huu', message: 'Tác phẩm này không phải của bạn.' }, 404);
      }
      if (khungId) {
        const { rows: o } = await client.query(
          `SELECT 1 FROM user_cosmetics uc JOIN cosmetic_items ci USING (cosmetic_id)
            WHERE uc.user_id = $1 AND uc.cosmetic_id = $2 AND ci.trang_thai = 'song'`,
          [userId, khungId],
        );
        if (!o[0]) {
          await client.query('ROLLBACK');
          // 409 chứ không 403: chuyện HAY XẢY RA do cache catalog cũ hoặc một món
          // vừa bị ẩn, không phải một cuộc tấn công. Không ghi `admin_audit`.
          return c.json({
            error: 'khong_so_huu_khung',
            message: 'Bạn chưa có khung này (hoặc nó vừa ngừng phát hành).',
          }, 409);
        }
      }
      await client.query('UPDATE avatar_so_huu SET khung_id = $1 WHERE avatar_id = $2',
        [khungId, avatarId]);
      const sau = await dongBoDienMao(client, avatarId);
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type,
                             value_json, state_snapshot_json)
         VALUES ($1, 'avatar', $2, 'cos_equip', $3, NULL)`,
        [userId, userId, JSON.stringify({ khung: khungId, avatar_id: avatarId, sau })],
      );
      await client.query('COMMIT');
      return c.json({ ok: true, chuoi: sau });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  /**
   * ⚠⚠ DÁN NHÃN — HÀNH ĐỘNG KHÔNG THU HỒI ĐƯỢC. Đọc kỹ trước khi sửa.
   *
   * Một transaction, thứ tự cố định: khoá tác phẩm → kiểm sở hữu → TRỪ KHO (câu
   * UPDATE có điều kiện `so_luong > 0`, nên hai tab bấm cùng lúc thì đúng một tab
   * thắng, không cần khoá riêng) → ghi `avatar_dan` (append-only ở tầng DB) → dựng
   * lại chuỗi → ghi event. Rollback ở bất kỳ bước nào thì nhãn KHÔNG mất.
   *
   * `xac_nhan: true` là bắt buộc — xem luật 4 ở đầu file. Nó không phải nghi thức:
   * nó là thứ ngăn một cú bấm nhầm tiêu mất một món hiếm mà KHÔNG AI hoàn được,
   * kể cả admin, kể cả DB (trigger cấm DELETE).
   */
  app.post('/api/v1/avatar/dan', ...guard, async (c) => {
    const userId = c.get('actor').userId!;
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    const avatarId = String(body?.avatar_id ?? '');
    const stickerId = String(body?.sticker_id ?? '');
    const x = soNguyenTrongLuoi(body?.x);
    const y = soNguyenTrongLuoi(body?.y);
    const lat = body?.lat === true;

    if (!/^\d+$/.test(avatarId) || !nhanDanTheoId(stickerId) || x === null || y === null) {
      return c.json({ error: 'tham_so_sai', message: 'Nhãn dán hoặc toạ độ không hợp lệ.' }, 400);
    }
    if (body?.xac_nhan !== true) {
      return c.json({
        error: 'thieu_xac_nhan',
        message: 'Dán là vĩnh viễn — cần xác nhận trước khi dán.',
      }, 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      /*
       * KHOÁ TRƯỚC — ĐẾM SAU, HAI CÂU LỆNH. Cùng khuôn `capMonHuuHan` và cùng lý do:
       * đếm trong danh sách chọn của chính câu `FOR UPDATE` là đếm bằng snapshot
       * chụp lúc câu lệnh bắt đầu, tức TRƯỚC khi khoá về tay. Hai tab dán cùng lúc
       * sẽ cùng đọc `so_dan` cũ, cùng tính ra một `thu_tu`, và lượt sau chết ở
       * UNIQUE (avatar_id, thu_tu) — 500 giữa một thao tác không hoàn tác được.
       */
      const { rows: aRows } = await client.query(
        `SELECT an FROM avatar_so_huu WHERE avatar_id = $1 AND user_id = $2 FOR UPDATE`,
        [avatarId, userId],
      );
      if (!aRows[0]) {
        await client.query('ROLLBACK');
        return c.json({ error: 'khong_so_huu', message: 'Tác phẩm này không phải của bạn.' }, 404);
      }
      if (aRows[0].an) {
        await client.query('ROLLBACK');
        return c.json({ error: 'tac_pham_bi_an', message: 'Tác phẩm này đang bị ẩn.' }, 409);
      }
      // Câu lệnh MỚI ⇒ snapshot MỚI, chụp sau khi khoá đã về tay: nó thấy đúng
      // những nhãn mà lượt dán ngay trước vừa commit.
      const { rows: dRows } = await client.query(
        'SELECT COUNT(*)::int AS so_dan FROM avatar_dan WHERE avatar_id = $1', [avatarId]);
      const soDan = Number(dRows[0].so_dan);
      if (soDan >= DAN_TOI_DA) {
        await client.query('ROLLBACK');
        // Trần VẬT LÝ của payload, không phải luật chơi — xem `DAN_TOI_DA`.
        return c.json({
          error: 'day_nhan', message: `Tác phẩm này đã kín ${DAN_TOI_DA} nhãn dán.`,
        }, 409);
      }

      const tru = await client.query(
        `UPDATE kho_sticker SET so_luong = so_luong - 1
          WHERE user_id = $1 AND sticker_id = $2 AND so_luong > 0
        RETURNING so_luong`,
        [userId, stickerId],
      );
      if (tru.rowCount !== 1) {
        await client.query('ROLLBACK');
        return c.json({
          error: 'khong_du_nhan', message: 'Bạn không còn nhãn dán này trong kho.',
        }, 409);
      }

      // Ghi song song vào sổ vật (B1 nhịp 2): một nhãn rời kho ⇒ một bản thể
      // chuyển `tu_do` → `da_gan`, cùng transaction.
      //
      // ⚠ KHÔNG kiểm số trả về ở đây, và đó là chủ ý của nhịp 2: đường ĐỌC vẫn
      // là `kho_sticker`, nên sổ lệch KHÔNG được phép làm hỏng một thao tác của
      // người chơi. Lệch thì `audit:cung` kêu, và bước B4 mới là lúc sổ có
      // quyền chặn — chuyển quyền đó sớm là bỏ mất tính chất "tắt cờ là xong".
      await tieuBanThe(client, { mauId: stickerId, chuSoHuu: userId, soLuong: 1 });

      await client.query(
        `INSERT INTO avatar_dan (avatar_id, user_id, sticker_id, x, y, lat, thu_tu)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [avatarId, userId, stickerId, x, y, lat, soDan + 1],
      );
      const sau = await dongBoDienMao(client, avatarId);

      /*
       * `sticker_dan` — loại event ĐẮT NHẤT của tầng này (A7: công thức index viết
       * TRƯỚC, suy ngược trường cần log).
       *
       * Nó ghi một quyết định KHÔNG THU HỒI ĐƯỢC, có giá, trên một vật hiếm, đưa ra
       * TRƯỚC KHI biết người khác nghĩ gì. Bốn trường, không thừa cái nào:
       *   · `nhan` + `x`,`y` — bố cục thật; đo được "ai dán lên mặt, ai dán ra rìa".
       *   · `ms` — thời gian cân nhắc; tách "dán thật" khỏi "bấm cho xong".
       *   · `doi_cho` — số lần dời vị trí trước khi chốt, client đếm. Đây là phép đo
       *     NGẦN NGẠI trực tiếp nhất mà app có, và nó không suy lại được từ kết quả.
       * Tổng ~110 byte, thừa sức trong ngân sách ~300 byte/event.
       */
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type,
                             value_json, state_snapshot_json)
         VALUES ($1, 'avatar', $2, 'sticker_dan', $3, NULL)`,
        [userId, avatarId, JSON.stringify({
          nhan: stickerId, x, y, lat, thu_tu: soDan + 1,
          ms: doThoiGian(body?.ms_can_nhac),
          doi_cho: typeof body?.so_lan_doi_cho === 'number'
            ? Math.max(0, Math.min(999, Math.round(body.so_lan_doi_cho as number))) : null,
        })],
      );
      await client.query('COMMIT');
      return c.json({ ok: true, chuoi: sau, con_lai: Number(tru.rows[0].so_luong) });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  /**
   * ADMIN — trao nền / nhãn dán cho một tài khoản.
   *
   * Vì sao có đường này ngay lát đầu, dù shop mới là cửa bán thật: nếu cơ chế nhãn
   * dán không có MỘT đường chạy nào cấp được nhãn thì nó là "cơ chế trang trí" —
   * code có, test có, không ai gọi (cái bẫy đã dính sáu lần ở repo này). Đường này
   * cũng là công cụ vận hành bắt buộc: dán là vĩnh viễn nên khi có sự cố thật, thứ
   * duy nhất làm được là TRAO LẠI một nhãn mới — không hoàn, không gỡ.
   *
   * Trao KHÔNG PHẢI chuyển nhượng: không lấy của ai cả, nên trigger
   * `forbid_cosmetic_transfer` không bị chạm (nó chỉ chặn đổi `user_id` của dòng
   * đã có).
   */
  /*
   * ⚠ Cửa NẶNG: trao vật phẩm là TẠO GIÁ TRỊ, và không có nút hoàn tác. Route
   * này nằm ngoài danh sách §3.4 (bản yêu cầu chỉ nói `/api/v1/admin/*` chung
   * chung) nhưng nó khớp tiền tố, và về hậu quả thì nó ngang một cú resolve.
   */
  app.post('/api/v1/admin/avatar/tang',
    mw.requireAuth, mw.requireOnboarded, mw.requireAdmin, mw.requireXacThucLai, async (c) => {
      const adminId = c.get('actor').userId!;
      const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
      const userId = String(body?.user_id ?? '');
      const nen = body?.nen === undefined ? null : String(body.nen);
      const stickerId = body?.sticker_id === undefined ? null : String(body.sticker_id);
      const soLuong = typeof body?.so_luong === 'number' ? Math.round(body.so_luong) : 1;
      if (!userId || (!nen && !stickerId)) {
        return c.json({ error: 'tham_so_sai', message: 'Thiếu user_id và món cần trao.' }, 400);
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let avatarId: string | null = null;
        if (nen) {
          const t = await taoAvatarNen(client, userId, nen, 'merit');
          avatarId = t.avatarId;
          await client.query(
            `INSERT INTO events (user_id, context_type, context_id, action_type,
                                 value_json, state_snapshot_json)
             VALUES ($1, 'avatar', $2, 'avatar_tao', $3, NULL)`,
            [userId, t.avatarId, JSON.stringify({ nen, seri: t.seri, nguon: 'merit' })],
          );
        }
        if (stickerId) await capSticker(client, userId, stickerId, soLuong);

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, payload_json)
           VALUES ($1, 'avatar_tang', $2)`,
          [adminId, JSON.stringify({ user_id: userId, nen, sticker_id: stickerId, so_luong: soLuong })],
        );
        await client.query('COMMIT');
        return c.json({ ok: true, avatar_id: avatarId });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        if (err instanceof AvatarError) {
          return c.json({ error: err.code, message: err.message }, err.httpCode as 400);
        }
        throw err;
      } finally {
        client.release();
      }
    });

  /**
   * ADMIN — ẩn / hiện một tác phẩm (chỗ cắm kiểm duyệt của D36).
   *
   * KHÔNG xoá và KHÔNG hoàn, cố ý: xoá là mất lịch sử, hoàn là MINT (A3.4). Ẩn thì
   * nhãn dán ngừng render mà nền vẫn còn, nên người chơi vẫn có mặt để người khác
   * nhận ra (D25) — hình phạt đúng bằng mức cần, không hơn.
   */
  app.post('/api/v1/admin/avatar/an',
    mw.requireAuth, mw.requireOnboarded, mw.requireAdmin, async (c) => {
      const adminId = c.get('actor').userId!;
      const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
      const avatarId = String(body?.avatar_id ?? '');
      const an = body?.an !== false;
      if (!/^\d+$/.test(avatarId)) {
        return c.json({ error: 'tham_so_sai', message: 'Thiếu mã tác phẩm.' }, 400);
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rowCount } = await client.query(
          'UPDATE avatar_so_huu SET an = $1 WHERE avatar_id = $2', [an, avatarId]);
        if (rowCount !== 1) {
          await client.query('ROLLBACK');
          return c.json({ error: 'khong_ton_tai', message: 'Không có tác phẩm này.' }, 404);
        }
        const chuoi = await dongBoDienMao(client, avatarId);
        await client.query(
          `INSERT INTO admin_audit (admin_id, action, payload_json)
           VALUES ($1, 'avatar_an', $2)`,
          [adminId, JSON.stringify({ avatar_id: avatarId, an })],
        );
        await client.query('COMMIT');
        return c.json({ ok: true, chuoi });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    });
}

/**
 * Diện mạo của một ghế NGƯỜI, dùng cho payload trận.
 *
 * Trả CHUỖI chứ không phải object đã dựng: 5–30 byte/ghế thay vì ~1,5 KB, trên một
 * endpoint bị poll theo bậc thang. Client dựng hình cục bộ từ chuỗi — không request
 * nào theo user, nên bàn 8 ghế vẫn là 0 request phụ.
 */
export function dienMaoGheNguoi(chuoi: string | null | undefined): string {
  return chuoi && DIEN_MAO_REGEX.test(chuoi) ? chuoi : DIEN_MAO_MAC_DINH;
}

/** Nền đang mặc — dùng cho event `avatar_chon` và thống kê phân bố hai lá tặng. */
export function gocDangMac(chuoi: string | null | undefined): string {
  return docDienMao(chuoi).goc;
}

/** Khung đang đeo — tiện cho thống kê, không dùng trong đường render. */
export function khungDangDeo(chuoi: string | null | undefined): string | null {
  return docDienMao(chuoi).khung?.id ?? null;
}
