/**
 * SHOP — HAI CỬA, KHÔNG BAO GIỜ GẶP NHAU.
 *
 *   CỬA Q (niêm yết, biết trước):  avatar nền 600 Q · khung viền 250 Q
 *   CỬA T (quay hộp, ngẫu nhiên):  100 T/lượt, đốt 100%, rate 70/25/5, pity ≤20
 *
 * Cả hai giá lấy NGUYÊN từ bảng D16 đã duyệt; file này không đặt con số kinh tế nào
 * (A8.2). Catalog cũng không nằm ở đây — nó ở `config/avatar.ts`, và shop ĐỌC từ đó.
 * Chép lại danh sách món lần thứ hai là đẻ hai nguồn chân lý, và nguồn thứ hai sẽ
 * lệch đúng vào lúc mùa sau thêm món.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VÌ SAO "MỖI MÓN ĐÚNG MỘT CỬA" LÀ LUẬT PHÁP LÝ, KHÔNG PHẢI GỌN GÀNG (A3.5)
 *
 * Q chạm voucher thật (D16) nên mọi thứ mua bằng Q phải NIÊM YẾT GIÁ, và không
 * được quay số bằng Q. Nhưng còn một đường vòng mà D16 phải cấm riêng: nếu một món
 * VỪA bán 100 Q VỪA rơi ra từ hộp 100 T thì quay hộp mà trúng nó = tiết kiệm 100 Q,
 * tức một lượt tiêu T vừa trả ra GIÁ TRỊ TÍNH BẰNG Q. Hộp T thành hộp có giá trị
 * thật — đúng cửa chết pháp lý mà cả luật ngẫu nhiên dựng ra để tránh, chỉ đi vòng
 * qua một MÓN thay vì một XU.
 *
 * Nên tường lửa ở đây có BA lớp, và không lớp nào là lời dặn:
 *   1. `config/avatar.ts` khai `nguon` cho từng món — một trường, một cửa.
 *   2. `cosmetic_items.nguon_cua` + CHECK `cosmetic_mot_mon_mot_cua` (0015): món
 *      cửa Q bắt buộc CÓ giá, món cửa T bắt buộc KHÔNG giá. DB từ chối kiểu khác.
 *   3. Hai đường code dưới đây dùng hai hàm tiền khác nhau (`chiQ` / `dotT`) và
 *      hai hàm đó không đọc nổi loại xu của nhau (`server/shop_kho.ts`).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BẢNG RƠI CỦA HỘP = ĐÚNG DANH SÁCH NHÃN DÁN, KHÔNG HƠN
 *
 * Hộp chỉ rơi nhãn dán, và điều đó giải luôn bài toán "trùng món" mà thiết kế gốc
 * phải xử bằng "phiếu chọn": nhãn dán là VẬT TIÊU HAO (D36 — dán là mất), nên bản
 * thứ hai của cùng một nhãn là +1 vào kho, không phải một món chết. Không có xu
 * thứ ba nào được đẻ ra, tức không có gì để tường lửa phải canh thêm.
 *
 * Khung/nền KHÔNG rơi từ hộp: chúng là đồ ĐEO, mua một lần, và nếu chúng vừa rơi
 * vừa bán 250 Q thì rơi vào đúng lỗ "một món hai cửa" ở trên.
 */
import { randomInt } from 'node:crypto';
import { Hono } from 'hono';
import type pg from 'pg';
import {
  AVATAR_NEN, GIA_BAN_SAO_THEM, KHUNG, NHAN_DAN, nenTheoId,
} from '../config/avatar.js';
import { ECONOMY } from '../config/economy.js';
import { SANDBOX_FLAGS } from '../config/sandbox.js';
import { taoAvatarNen } from './avatar.js';
import {
  GACHA, GACHA_RATES_BP, GachaError, bocDeu, haBac, pull,
} from './sandbox/gacha.js';
import { makeRng } from './sandbox/rng.js';
import {
  HOP_GACHA, bacConHang, conMonNao, ungVienBac, type BoiCanhUngVien,
} from './sandbox/ung_vien.js';
import {
  capMonHuuHan, chiQ, docTonKho, dotT, khoaVaKiemVi, ShopError,
} from './shop_kho.js';

import { ducBanThe } from './kinh_te/so_vat.js';
import type { Env, Mw as Middleware } from './http/types.js';

/** Món bán bằng Q — gộp nền + khung, đọc từ catalog, không gõ lại tay. */
const MON_CUA_Q = [
  ...AVATAR_NEN.filter((n) => n.nguon === 'niem_yet_q')
    .map((n) => ({ id: n.id, ten: n.ten, loai: 'nen' as const, gia: n.gia_q!, ma: n.ma })),
  ...KHUNG.filter((k) => k.nguon === 'niem_yet_q')
    .map((k) => ({ id: k.id, ten: k.ten, loai: 'khung' as const, gia: k.gia_q!, ma: null })),
];

export function registerShopRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: { requireAuth: Middleware; requireOnboarded: Middleware },
): void {
  const guard = [mw.requireAuth, mw.requireOnboarded] as const;

  // ═══════════════════════════════ CATALOG ═══════════════════════════════
  /**
   * Quầy hàng + số dư HAI loại xu + TỒN KHO CÒN LẠI.
   *
   * Cần đăng nhập vì response chứa số dư và cờ "đã sở hữu". Không cache: giá thì
   * tĩnh nhưng tồn kho món hữu hạn thì không, và một con số tồn kho cũ ở màn shop
   * là lời hứa sai về thứ D36 gọi là "cực ít, cực hiếm".
   */
  app.get('/api/v1/shop/catalog', ...guard, async (c) => {
    const userId = c.get('actor').userId!;
    const [me, coRoi, khungCo, nenCo, ton, pity] = await Promise.all([
      pool.query('SELECT bankroll, quest_points FROM users WHERE user_id = $1', [userId]),
      pool.query(
        `SELECT cosmetic_id, trang_thai, phien_ban FROM cosmetic_items
          WHERE family = 'dien_mao'`),
      pool.query('SELECT cosmetic_id FROM user_cosmetics WHERE user_id = $1', [userId]),
      pool.query(
        `SELECT nen, COUNT(*)::int AS n FROM avatar_so_huu
          WHERE user_id = $1 GROUP BY nen`, [userId]),
      docTonKho(pool),
      pool.query('SELECT tu_epic, tong_luot FROM gacha_pity WHERE user_id = $1', [userId]),
    ]);

    const trangThai = new Map<string, { song: boolean; phienBan: string | null }>(
      coRoi.rows.map((r) => [r.cosmetic_id as string,
        { song: r.trang_thai === 'song', phienBan: (r.phien_ban as string | null) ?? null }]),
    );
    const daCo = new Set<string>(khungCo.rows.map((r) => r.cosmetic_id as string));
    /*
     * Bối cảnh để tính bảng rơi RIÊNG cho người này. Dùng CHUNG một phép lọc với
     * đường mở hộp (`server/sandbox/ung_vien.ts`) — nếu catalog tự suy lại thì
     * màn và hộp thành hai nguồn chân lý, và cái lệch luôn là cái không ai nhìn.
     */
    const bcCatalog: BoiCanhUngVien = {
      ton,
      nenDaCo: new Set(nenCo.rows.map((r) => r.nen as string)),
    };
    const soTacPham = new Map<string, number>(
      nenCo.rows.map((r) => [r.nen as string, Number(r.n)]));

    const banQ = MON_CUA_Q.map((m) => {
      const st = trangThai.get(m.id);
      const daMua = m.loai === 'nen'
        ? (soTacPham.get(m.ma!) ?? 0) > 0
        : daCo.has(m.id);
      /*
       * Bản sao thêm của một avatar nền CHƯA CÓ GIÁ (`GIA_BAN_SAO_THEM = null`,
       * cố ý — D36 biến nền thành vật tiêu hao, mà D16 chỉ định giá cho món mua
       * một lần). Trả `gia: null` + `ly_do` để màn nói thật "chưa mở bán" thay vì
       * hiện một nút bấm vào là lỗi.
       */
      const gia = m.loai === 'nen' && daMua ? GIA_BAN_SAO_THEM : (daMua ? null : m.gia);
      return {
        id: m.id, ten: m.ten, loai: m.loai, gia,
        /*
         * Mã nền (A|B|C) — màn cần nó để VẼ món trước khi mua, vì art tra theo mã
         * chứ không theo id. Trả ra thay vì để client suy từ id: một bảng tra id →
         * mã ở client là nguồn chân lý thứ hai, và nó sẽ lệch đúng vào mùa thêm nền.
         */
        ma: m.ma,
        da_so_huu: daMua,
        /** Nền mua được nhiều lần (vật tiêu hao); khung thì không (đồ đeo). */
        mua_lai_duoc: m.loai === 'nen',
        phien_ban: st?.phienBan ?? null,
        song: st?.song !== false,
      };
    });

    const hop = {
      gia_t: GACHA.COST_T,
      /*
       * Số dư TỐI THIỂU để mở được một hộp. Trả ra thay vì để màn tự cộng: C4 —
       * client không tính điều kiện tiền, và nếu ngưỡng đổi thì màn không được nói
       * một con số khác với con số server đang chặn.
       */
      can_du_t: ECONOMY.SUBSIDY_THRESHOLD + GACHA.COST_T,
      rate_bp: GACHA_RATES_BP,
      pity: GACHA.PITY_EPIC,
      tu_epic: pity.rows[0] ? Number(pity.rows[0].tu_epic) : 0,
      tong_luot: pity.rows[0] ? Number(pity.rows[0].tong_luot) : 0,
      mo_duoc: SANDBOX_FLAGS.GACHA,
      /*
       * ⭐ BẢNG RƠI THEO NGƯỜI, KHÔNG PHẢI BẢNG CHUNG (D68a).
       *
       * Từ 04/08 bậc `epic` chỉ còn ĐÚNG MỘT món và nó độc bản, nên với người đã
       * có nó thì cửa 5% RỖNG THẬT. Dán "5%" cho họ là app nói dối đúng chỗ người
       * chơi sắp trả tiền — và họ là người duy nhất không kiểm chứng được.
       * `con_hang` cho màn ghi thẳng "cửa này với bạn đã hết".
       */
      con_hang: bacConHang(bcCatalog),
      mon: HOP_GACHA.map((m) => {
        const t = ton.get(m.id);
        const nd = NHAN_DAN.find((n) => n.id === m.id);
        return {
          id: m.id, ten: m.ten, hiem: m.hiem,
          loai: m.loai, ma: m.ma,
          ghi_chu: nd?.ghi_chu ?? nenTheoId(m.id)?.mo_ta ?? '',
          con_lai: t?.conLai ?? null,
          song: t?.song !== false,
          /** Đã sở hữu ⇒ lá này không rơi cho bạn nữa (chỉ món độc bản). */
          da_co: m.docBan && m.ma !== null && bcCatalog.nenDaCo.has(m.ma),
        };
      }),
    };

    return c.json({
      bankroll: Number(me.rows[0]?.bankroll ?? 0),
      quest_points: Number(me.rows[0]?.quest_points ?? 0),
      ban_q: banQ,
      hop,
      /** `null` = founder chưa chốt giá bản sao thêm (A8.2). */
      gia_ban_sao_them: GIA_BAN_SAO_THEM,
    });
  });

  // ═══════════════════════════════ CỬA Q ═══════════════════════════════
  /**
   * MUA HÀNG NIÊM YẾT. Không ngẫu nhiên, không hộp, giá biết trước khi bấm.
   *
   * Một transaction: trừ Q → ghi sổ Q → trao món → ghi event. Không có bước nào
   * chạm `bankroll`, và đó là điều `tests/shop.test.ts` đo thẳng ở DB.
   */
  app.post('/api/v1/shop/mua', ...guard, async (c) => {
    const userId = c.get('actor').userId!;
    const body = await c.req.json().catch(() => null) as { mon_id?: unknown } | null;
    const monId = typeof body?.mon_id === 'string' ? body.mon_id : '';
    const mon = MON_CUA_Q.find((m) => m.id === monId);
    if (!mon) {
      return c.json({ error: 'mon_khong_ban', message: 'Món này không bán ở quầy Q.' }, 400);
    }
    if (!SANDBOX_FLAGS.COSMETICS) {
      return c.json({ error: 'feature_disabled', message: 'Quầy chưa mở.' }, 403);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: st } = await client.query(
        `SELECT trang_thai FROM cosmetic_items WHERE cosmetic_id = $1`, [mon.id]);
      if (!st[0] || st[0].trang_thai !== 'song') {
        throw new ShopError('mon_ngung_phat_hanh', 409, 'Món này đã ngừng bán.');
      }

      let gia = mon.gia;
      let ketQua: Record<string, unknown> = {};

      if (mon.loai === 'khung') {
        // Khung là đồ ĐEO: một bản là đủ, mua bản thứ hai không cho thêm gì.
        const { rowCount } = await client.query(
          'SELECT 1 FROM user_cosmetics WHERE user_id = $1 AND cosmetic_id = $2',
          [userId, mon.id]);
        if (rowCount) throw new ShopError('da_so_huu', 409, 'Bạn đã có món này.');

        await chiQ(client, userId, gia, mon.id);
        await client.query(
          `INSERT INTO user_cosmetics (user_id, cosmetic_id, source)
           VALUES ($1, $2, 'shop_q')`, [userId, mon.id]);
        // Ghi song song vào sổ vật (B1 nhịp 2) — cùng transaction, no-op khi cờ tắt.
        await ducBanThe(client, {
          mauId: mon.id, chuSoHuu: userId, nguon: 'mua_he_thong', soLuong: 1,
        });
        ketQua = { khung_id: mon.id };
      } else {
        /*
         * Avatar nền là VẬT TIÊU HAO (D36): mỗi tác phẩm sticker mới cần một nền
         * mới. Bản đầu tiên dùng giá skin 600 Q của D16; bản thứ hai trở đi là một
         * sink Q LẶP LẠI mà D16 chưa định giá → 409, KHÔNG chạy với số tạm.
         */
        const { rows: dem } = await client.query(
          'SELECT COUNT(*)::int AS n FROM avatar_so_huu WHERE user_id = $1 AND nen = $2',
          [userId, mon.ma]);
        const daCo = Number(dem[0].n) > 0;
        if (daCo) {
          if (GIA_BAN_SAO_THEM === null) {
            throw new ShopError('chua_dinh_gia', 409,
              'Bản thứ hai của ảnh đại diện này chưa mở bán.');
          }
          gia = GIA_BAN_SAO_THEM;
        }

        await chiQ(client, userId, gia, mon.id);
        const t = await taoAvatarNen(client, userId, mon.ma!, 'shop_q');
        await client.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type,
                               value_json, state_snapshot_json)
           VALUES ($1, 'avatar', $2, 'avatar_tao', $3, NULL)`,
          [userId, t.avatarId,
            JSON.stringify({ nen: mon.ma, seri: t.seri, nguon: 'shop_q' })],
        );
        ketQua = { avatar_id: t.avatarId, seri: t.seri, chuoi: t.chuoi };
      }

      const { rows: du } = await client.query(
        'SELECT quest_points FROM users WHERE user_id = $1', [userId]);
      const conQ = Number(du[0].quest_points);

      /*
       * A7 — event ghi CÙNG transaction. `gia` là con số quyết định thật (bản sao
       * thêm có thể khác giá bản đầu), `con_q` cho biết mua xong còn bao nhiêu:
       * cặp đó mới đo được "mua tới cạn" vs "mua có dư", còn giá đơn lẻ thì không.
       */
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type,
                             value_num, value_json, state_snapshot_json)
         VALUES ($1, 'shop', $2, 'shop_mua', $3, $4, NULL)`,
        [userId, mon.id, gia, JSON.stringify({ loai: mon.loai, con_q: conQ })],
      );

      await client.query('COMMIT');
      return c.json({ ok: true, mon_id: mon.id, gia_q: gia, quest_points: conQ, ...ketQua });
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

  // ═══════════════════════════════ CỬA T ═══════════════════════════════
  /**
   * MỞ MỘT HỘP PHONG CÁCH. Đốt 100 T, rơi một nhãn dán.
   *
   * THỨ TỰ CÁC BƯỚC LÀ MỘT PHẦN CỦA ĐÚNG ĐẮN, không phải sắp cho gọn:
   *
   *   1. Đếm tồn TRƯỚC KHI đốt. Hết hàng mọi bậc → từ chối, chưa mất T nào.
   *   2. Đốt T (khoá dòng `users`). Ngưỡng chặn xem `duDieuKienMoHop`.
   *   3. Khoá + đọc bộ đếm pity. Không lưu thì mốc "epic trong 20 lượt" là khẩu hiệu.
   *   4. Quay → BẬC. Bậc hết hàng → hạ bậc, và catalog đã nói trước là nó hết.
   *   5. Bốc món trong bậc, cấp phát dưới khoá của chính món đó. Nếu người khác
   *      vừa lấy bản cuối giữa bước 4 và 5 → thử ứng viên còn lại; hết ứng viên →
   *      ROLLBACK, tức KHÔNG đốt T. Đốt tiền để nhận không có gì là lỗi tệ nhất
   *      cửa này có thể mắc, nên nó phải không biểu diễn được, không phải hiếm.
   *
   * Thứ tự khoá: `users` → `cosmetic_items`. Cùng chiều mọi nơi khác trong repo, nên
   * không có deadlock chéo giữa shop và các đường ghi khác.
   */
  app.post('/api/v1/shop/hop', ...guard, async (c) => {
    const userId = c.get('actor').userId!;
    if (!SANDBOX_FLAGS.GACHA) {
      return c.json({ error: 'feature_disabled', message: 'Hộp chưa mở.' }, 403);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      /*
       * Bước 1 — KHOÁ VÍ, CHƯA TRỪ (đổi từ 04/08, D68a).
       *
       * Khoá vẫn lấy ở đúng chỗ cũ để giữ chiều `users → cosmetic_items` của cả
       * repo; thứ dời xuống sau là phép TRỪ, vì founder chốt "trúng lá đã có thì
       * hoàn T" mà `burn_ledger` không gỡ được dòng đốt nào (append-only,
       * `CHECK amount > 0`) ⇒ đốt-rồi-hoàn là mint, phạm A3.4. Xem `khoaVaKiemVi`.
       */
      const truoc = await khoaVaKiemVi(client, userId, GACHA.COST_T);

      /*
       * Bước 2 — BỐI CẢNH RIÊNG CỦA NGƯỜI NÀY: tồn kho toàn hệ + tập nền đã sở hữu.
       *
       * Tập sở hữu là thứ bản trước không có, và thiếu nó thì luật "mỗi người một
       * bản" không thi hành được ở bất cứ đâu — `doc_ban` chỉ nằm trong config.
       */
      const [ton, nenCo] = await Promise.all([
        docTonKho(client),
        client.query('SELECT DISTINCT nen FROM avatar_so_huu WHERE user_id = $1', [userId]),
      ]);
      const bc: BoiCanhUngVien = {
        ton,
        nenDaCo: new Set(nenCo.rows.map((r) => r.nen as string)),
      };
      if (!conMonNao(bc)) {
        throw new ShopError('het_hang', 409, 'Hộp đang không có món nào để trao.');
      }

      // Bước 3 — pity. `ON CONFLICT DO UPDATE` vừa tạo dòng nếu chưa có, vừa GIỮ
      // KHOÁ dòng đó tới hết transaction: hai lượt song song của cùng một người
      // không thể cùng đọc một bộ đếm.
      const { rows: pRows } = await client.query(
        `INSERT INTO gacha_pity (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
         RETURNING tu_epic, tong_luot`,
        [userId],
      );
      const tuEpic = Number(pRows[0].tu_epic);

      // Bước 4 — quay. `hat` lưu vào event: một lượt quay phải tái lập được khi có
      // ai đó hỏi "tôi có bị thiệt không", và rate công khai chỉ đáng tin nếu từng
      // lượt kiểm lại được.
      const hat = randomInt(1, 2_147_483_647);
      const ketQuaQuay = pull(Number(truoc), tuEpic, makeRng(hat));
      const bac = haBac(ketQuaQuay.rarity, (b) => ungVienBac(b, bc).length > 0);
      if (bac === null) throw new ShopError('het_hang', 409, 'Hộp đang trống.');

      // Bước 5 — bốc và cấp phát. Thử lần lượt các ứng viên đã trộn: bản cuối có
      // thể vừa bị người khác lấy sau bước 2.
      const dsUngVien = [...ungVienBac(bac, bc)];
      const rngBoc = makeRng(hat ^ 0x5f5f);
      let trao: {
        id: string; ten: string; conLai: number | null;
        loai: 'sticker' | 'nen'; ma: string | null; avatarId?: string; seri?: number;
      } | null = null;
      /** Bốc trúng lá độc bản mà người này VỪA nhận từ nguồn khác (đua). */
      let trungLa: { id: string; ten: string } | null = null;
      let loiCuoi: unknown = null;
      while (dsUngVien.length > 0 && trao === null && trungLa === null) {
        const m = bocDeu(dsUngVien, rngBoc)!;
        dsUngVien.splice(dsUngVien.indexOf(m), 1);
        try {
          if (m.loai === 'nen') {
            /*
             * ⚠ SAVEPOINT là bắt buộc, không phải cẩn thận thừa.
             *
             * Chốt cuối của luật độc bản là partial unique index (0033). Nó nổ
             * khi tập sở hữu đọc ở bước 2 đã cũ — người này vừa nhận đúng lá đó
             * từ quà beta hoặc admin giữa hai bước. Không có savepoint thì cú nổ
             * huỷ CẢ transaction và người chơi ăn 500 lỗi thay vì một lời giải
             * thích; có savepoint thì ta lùi đúng một câu lệnh và xử tử tế.
             */
            await client.query('SAVEPOINT cap_nen');
            try {
              const t = await taoAvatarNen(client, userId, m.ma!, 'gacha_t');
              await client.query('RELEASE SAVEPOINT cap_nen');
              trao = {
                id: m.id, ten: m.ten, conLai: ton.get(m.id)?.conLai ?? null,
                loai: 'nen', ma: m.ma, avatarId: t.avatarId, seri: t.seri,
              };
            } catch (e) {
              await client.query('ROLLBACK TO SAVEPOINT cap_nen');
              if ((e as { code?: string }).code !== '23505') throw e;
              trungLa = { id: m.id, ten: m.ten };
            }
          } else {
            const { conLai } = await capMonHuuHan(client, userId, m.id, 1);
            trao = { id: m.id, ten: m.ten, conLai, loai: 'sticker', ma: null };
          }
        } catch (e) {
          if (!(e instanceof ShopError)) throw e;
          loiCuoi = e;
        }
      }

      /*
       * ⭐ TRÙNG LÁ ⇒ KHÔNG TRỪ T (founder 04/08 gọi là "hoàn T").
       *
       * Cài thành "không trừ" thay vì "trừ rồi hoàn" vì hai cách cho người chơi
       * cùng một kết quả nhưng chỉ một cách không mint (xem `khoaVaKiemVi`).
       * Lượt này KHÔNG đụng pity: người chơi không nhận được gì, nên lấy đi tiến
       * độ pity của họ là phạt hai lần cho một cú xui không phải lỗi của họ.
       */
      if (trungLa !== null) {
        await client.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type,
                               value_num, value_json, state_snapshot_json)
           VALUES ($1, 'shop', 'hop', 'gacha_trung', 0, $2, NULL)`,
          [userId, JSON.stringify({ m: trungLa.id, b: bac, hat })],
        );
        await client.query('COMMIT');
        return c.json({
          ok: true, trung: true, bac, bac_goc: ketQuaQuay.rarity,
          ha_bac: bac !== ketQuaQuay.rarity, tu_pity: ketQuaQuay.fromPity,
          mon: { id: trungLa.id, ten: trungLa.ten, con_lai: null, loai: 'nen', ma: null },
          bankroll: Number(truoc),
          hoan_t: GACHA.COST_T,
          tu_epic: tuEpic,
          hat,
        });
      }

      if (trao === null) {
        throw (loiCuoi instanceof ShopError
          ? loiCuoi
          : new ShopError('het_hang', 409, 'Hộp đang trống.'));
      }

      // Bước 6 — ĐỐT. Giờ mới đốt, vì giờ mới chắc chắn có thứ để trao.
      const { sau } = await dotT(client, userId, GACHA.COST_T);

      await client.query(
        `UPDATE gacha_pity SET tu_epic = $2, tong_luot = tong_luot + 1, updated_at = now()
          WHERE user_id = $1`,
        [userId, ketQuaQuay.pullsSinceEpic],
      );

      /*
       * A7 — snapshot GỌN (≤ ~300 byte). `du_t` là trường đắt nhất: nó cho biết ai
       * quay tới sát ngưỡng chặn, tức ai đang đổi vốn dự báo lấy ngoại hình — chỉ
       * số §6.6 đòi theo dõi, và không backfill được (`events` append-only).
       */
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type,
                             value_num, value_json, state_snapshot_json)
         VALUES ($1, 'shop', 'hop', 'gacha_mo', $2, $3, NULL)`,
        [userId, GACHA.COST_T, JSON.stringify({
          m: trao.id,
          b: bac,
          bg: ketQuaQuay.rarity,
          p: ketQuaQuay.fromPity ? 1 : 0,
          du_t: Number(sau),
          hat,
        })],
      );

      await client.query('COMMIT');
      return c.json({
        ok: true,
        trung: false,
        bac,
        bac_goc: ketQuaQuay.rarity,
        ha_bac: bac !== ketQuaQuay.rarity,
        tu_pity: ketQuaQuay.fromPity,
        /*
         * `loai` + `ma` là thứ màn cần để VẼ món: art nền tra theo mã (32×32),
         * art nhãn dán tra theo id (≤14×8). Trả ra thay vì để client suy từ id —
         * một bảng tra ở client là nguồn chân lý thứ hai và nó sẽ lệch.
         */
        mon: {
          id: trao.id, ten: trao.ten, con_lai: trao.conLai,
          loai: trao.loai, ma: trao.ma,
          ...(trao.avatarId ? { avatar_id: trao.avatarId, seri: trao.seri } : {}),
        },
        bankroll: Number(sau),
        tu_epic: ketQuaQuay.pullsSinceEpic,
        hat,
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err instanceof ShopError) {
        return c.json({ error: err.code, message: err.message }, err.httpCode as 400);
      }
      if (err instanceof GachaError) {
        return c.json({ error: err.code, message: err.message }, 409);
      }
      throw err;
    } finally {
      client.release();
    }
  });
}

/**
 * Món này thuộc cửa nào — nguồn chân lý DUY NHẤT cho câu hỏi đó ở tầng code.
 *
 * Tồn tại để test tường lửa hỏi được câu "có món nào ở cả hai cửa không" mà không
 * phải tự dựng lại phép suy từ catalog; một phép suy thứ hai là một phép suy sẽ lệch.
 */
export function cuaCuaMon(id: string): 'niem_yet_q' | 'gacha_t' | 'merit' | null {
  const nen = nenTheoId(id);
  if (nen?.nguon === 'niem_yet_q') return 'niem_yet_q';
  /*
   * ⚠ Nhánh này thiếu cho tới 04/08 và đó là một LỖ CỦA TEST TƯỜNG LỬA, không
   * phải thiếu sót thẩm mỹ: hai lá trader là avatar nền đứng ở cửa gacha, mà hàm
   * này trả `null` cho chúng ⇒ phép kiểm "có món nào đứng ở CẢ HAI cửa không"
   * (A3.5) lặng lẽ bỏ qua đúng hai món mới nhất. Một tường lửa không phủ món mới
   * là một tường lửa đang tắt dần theo thời gian.
   */
  if (nen?.nguon === 'gacha_t') return 'gacha_t';
  if (KHUNG.some((k) => k.id === id)) return 'niem_yet_q';
  /*
   * Sticker vinh danh hạng (nguon 'merit') KHÔNG phải cửa nào của shop — trả đúng 'merit' chứ không rơi vào
   * 'gacha_t': tường lửa A3.5 hỏi hàm này "món nào đứng ở cả hai cửa", và gán nhầm 'gacha_t' cho món merit
   * vừa nói dối về sáu món, vừa làm test `rơi từ hộp mà không thuộc cửa T` trông như đã phủ chúng.
   */
  const nd = NHAN_DAN.find((n) => n.id === id);
  if (nd) return nd.nguon === 'merit' ? 'merit' : 'gacha_t';
  return null;
}
