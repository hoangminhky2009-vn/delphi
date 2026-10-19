/**
 * SHOP — HAI CỬA, TƯỜNG LỬA, VÀ ĐUA ĐIỀU KIỆN TRÊN HÀNG HỮU HẠN.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BỐN THỨ FILE NÀY CỐ Ý *KHÔNG* LÀM:
 *
 * 1. KHÔNG `toBe(600)` / `toBe(100)`. Giá đọc từ config; chép lại số vào test thì
 *    test kiểm chính nó. Ở đây kiểm QUAN HỆ: trừ đúng bằng giá NIÊM YẾT, số dư sau
 *    = trước − giá, và sau mỗi lượt mở hộp số dư còn TRÊN ngưỡng trợ cấp.
 *
 * 2. KHÔNG kiểm tường lửa T↔Q bằng cách đọc code rồi tin. Đo Ở DB: mua bằng Q thì
 *    `bankroll` và ba sổ T KHÔNG được nhúc nhích một đơn vị; mở hộp bằng T thì
 *    `quest_points` và `quest_ledger` KHÔNG được nhúc nhích. Và thử VI PHẠM thật —
 *    ghi một dòng Q dương, tăng Q, đặt giá Q cho một món của hộp — rồi đòi DB từ chối.
 *
 * 3. KHÔNG mock transaction. Đua điều kiện là thứ chỉ tồn tại khi có transaction
 *    thật, khoá thật, và hai kết nối thật cùng chen. Mock ra thì đang kiểm một thứ
 *    không tồn tại.
 *
 * 4. KHÔNG tin "có route là có chạy". Mọi đường đi qua HTTP `app.request`, vì cái
 *    bẫy đã cắn tám lần ở repo này là code có, test có, mà không đường chạy nào gọi
 *    — và lần này bẫy có hình dạng rất cụ thể: ba stub 403 của `/shop/*` từng nằm
 *    trong `arena_api.ts` và ĐƯỢC ĐĂNG KÝ TRƯỚC cửa thật.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import type pg from 'pg';
import {
  AVATAR_NEN, CATALOG_DIEN_MAO, GIA_BAN_SAO_THEM, KHUNG, NHAN_DAN,
} from '../config/avatar.js';
import { ECONOMY } from '../config/economy.js';
import { SANDBOX_FLAGS } from '../config/sandbox.js';
import { GACHA, BAC_TU_CAO, bocDeu, haBac, type Rarity } from '../server/sandbox/gacha.js';
import { makeRng } from '../server/sandbox/rng.js';
import { capMonHuuHan, duDieuKienMoHop, ShopError } from '../server/shop_kho.js';
import { HOP_GACHA } from '../server/sandbox/ung_vien.js';
import { cuaCuaMon } from '../server/shop.js';
import { auditSupply } from '../server/audit.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { createTestUser, ensureGenesis } from './helpers/fixtures.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';

/**
 * MÓN DÙNG ĐỂ THỬ HÀNG HỮU HẠN — phải là NHÃN DÁN và phải CÒN TRONG HỘP.
 *
 * ⚠ Trước 04/08 đây là `NHAN_DAN.filter(hiem === 'epic')`, tức `st_niem_beta` —
 * món epic duy nhất. Nó rời hộp để thành quà beta (D68b) nên lấy nó làm mẫu thử
 * khiến hộp RỖNG HOÀN TOÀN sau khi ẩn các món khác, và bài đo "đúng 1 người
 * thành công" đọc ra 0. Chọn theo ĐIỀU KIỆN (còn trong hộp, là sticker) thay vì
 * theo BẬC: bậc đổi theo mùa, còn hai điều kiện kia là thứ bài này thật sự cần.
 */
const MON_HUU_HAN = HOP_GACHA.filter((m) => m.loai === 'sticker');

// ═══════════════ 1. CATALOG — MỘT NGUỒN CHÂN LÝ, MỘT CỬA MỖI MÓN ═══════════════

describe('1. CATALOG — shop đọc từ config, và mỗi món đúng một cửa', () => {
  it('mọi món diện mạo thuộc ĐÚNG MỘT cửa, và giá có mặt đúng ở cửa Q', () => {
    for (const m of [...AVATAR_NEN, ...CATALOG_DIEN_MAO]) {
      // Món tặng khởi đầu không có cửa nào (không bán, không rơi) — hợp lệ.
      if (m.nguon === 'tang_khoi_dau') {
        expect(m.gia_q, `${m.id}: quà mà có giá`).toBeNull();
        continue;
      }
      const coGia = m.gia_q !== null;
      expect(coGia, `${m.id}: cửa ${m.nguon} mà giá ${m.gia_q}`)
        .toBe(m.nguon === 'niem_yet_q');
    }
  });

  /*
   * Đây là lỗ mà D16 mục 3 phải cấm riêng: một món vừa bán 100 Q vừa rơi từ hộp
   * 100 T thì trúng nó = tiết kiệm 100 Q, tức lượt tiêu T trả ra GIÁ TRỊ TÍNH BẰNG
   * Q — mà Q chạm voucher thật. Hộp T thành hộp có giá trị thật.
   */
  it('KHÔNG món nào đứng ở cả hai cửa (đường T→Q gián tiếp)', () => {
    const q = new Set([...AVATAR_NEN, ...CATALOG_DIEN_MAO]
      .filter((m) => m.nguon === 'niem_yet_q').map((m) => m.id));
    const t = new Set(NHAN_DAN.filter((m) => m.nguon === 'gacha_t').map((m) => m.id));
    for (const id of q) expect(t.has(id), `${id} ở CẢ HAI cửa`).toBe(false);
    // Và mọi món của bảng rơi phải thật sự là món cửa T.
    for (const id of t) expect(cuaCuaMon(id)).toBe('gacha_t');
    for (const id of q) expect(cuaCuaMon(id)).toBe('niem_yet_q');
  });

  it('KHUNG không bao giờ rơi từ hộp; NỀN chỉ rơi khi nó KHÔNG bán bằng Q', () => {
    /*
     * ⚠ TÊN CŨ CỦA BÀI NÀY ĐÃ THÀNH LỜI NÓI DỐI (sửa 04/08). Nó ghi "không có
     * khung/nền nào" trong khi từ D68a hộp CÓ rơi hai lá nền — assertion vẫn
     * xanh vì nó không hề kiểm điều nó tuyên bố. Một bài test xanh mà tên sai
     * còn tệ hơn không có bài: người sau đọc tên rồi tin.
     *
     * Luật THẬT không phải "nền không được rơi" mà là MỖI MÓN ĐÚNG MỘT CỬA: món
     * vừa bán bằng Q vừa rơi từ hộp T mới là lỗ pháp lý (D16 mục 3). Nền cửa
     * gacha không có giá Q nên nó không đi qua lỗ đó.
     */
    for (const k of KHUNG) expect(cuaCuaMon(k.id)).toBe('niem_yet_q');
    for (const m of HOP_GACHA) {
      expect(cuaCuaMon(m.id), `${m.id} rơi từ hộp mà không thuộc cửa T`).toBe('gacha_t');
      const nen = AVATAR_NEN.find((n) => n.id === m.id);
      if (nen) expect(nen.gia_q, `${m.id} vừa rơi vừa có giá Q`).toBeNull();
    }
  });

  it('giá bản sao thêm CÒN null → đường mua bản sao phải không tồn tại', () => {
    // Bất biến canh chiều: nếu ai đó điền một số tạm vào đây, test này đỏ và buộc
    // họ đi qua founder (A8.2) chứ không lặng lẽ ship một sink Q mới.
    if (GIA_BAN_SAO_THEM !== null) {
      expect(Number.isInteger(GIA_BAN_SAO_THEM)).toBe(true);
      expect(GIA_BAN_SAO_THEM).toBeGreaterThan(0);
    } else {
      expect(GIA_BAN_SAO_THEM).toBeNull();
    }
  });
});

// ═══════════════ 2. HÀM THUẦN — HẠ BẬC & BỐC ĐỀU ═══════════════

describe('2. Bốc món trong bậc — đều tuyệt đối, hạ bậc khi cạn hàng', () => {
  it('bốc ĐỀU: không món nào trong cùng bậc được ưu ái', () => {
    const ds = ['a', 'b', 'c', 'd'];
    const dem = new Map(ds.map((x) => [x, 0]));
    const N = 40_000;
    for (let i = 0; i < N; i += 1) {
      const m = bocDeu(ds, makeRng(i + 1))!;
      dem.set(m, dem.get(m)! + 1);
    }
    for (const x of ds) {
      const p = dem.get(x)! / N;
      expect(Math.abs(p - 0.25), `${x} lệch: ${p}`).toBeLessThan(0.02);
    }
  });

  it('hạ bậc epic → hiếm → thường khi bậc trên cạn', () => {
    expect(haBac('epic', (b) => b === 'thuong')).toBe('thuong');
    expect(haBac('epic', (b) => b !== 'epic')).toBe('hiem');
    expect(haBac('thuong', () => false)).toBeNull();
  });

  it('bậc dưới cạn mà bậc trên còn → trao món TỐT hơn, không trả tay không', () => {
    expect(haBac('thuong', (b) => b === 'epic')).toBe('epic');
    expect(BAC_TU_CAO[0]).toBe('epic');
  });
});

// ═══════════════ 3. NGƯỠNG MỞ HỘP — KHÔNG HÚT KHO BẠC ═══════════════

describe('3. Ngưỡng mở hộp bịt đường hút Kho bạc (§6.6)', () => {
  /*
   * Bất biến QUAN HỆ, không phải con số: sau một lượt mở hộp, số dư phải còn TRÊN
   * ngưỡng trợ cấp. Nếu không thì ví 599 T quay xong xuống 499 T, nhận 50 T/ngày
   * từ Kho bạc rồi quay tiếp — 1.000 người là tối đa 3.000.000 T rút ra trong khi
   * Kho bạc chỉ có ~31.647 T (D16). Kho bạc không âm được (D10) nên nó không sai
   * số, nó TỪ CHỐI TRỢ CẤP CHO NGƯỜI THẬT khi cạn.
   */
  it('mở hộp xong số dư phải còn TRÊN ngưỡng trợ cấp', () => {
    const nguong = BigInt(ECONOMY.SUBSIDY_THRESHOLD);
    const gia = GACHA.COST_T;
    expect(duDieuKienMoHop(nguong + BigInt(gia), gia)).toBe(true);
    expect(duDieuKienMoHop(nguong + BigInt(gia) - 1n, gia)).toBe(false);
  });

  it('ngưỡng này CHẶT HƠN chốt cũ của engine, không lỏng hơn', () => {
    // Hướng sai của luật mới phải là "ít người quay được", không phải "kho bạc cạn".
    expect(ECONOMY.SUBSIDY_THRESHOLD + GACHA.COST_T)
      .toBeGreaterThan(GACHA.MIN_BANKROLL_T);
  });
});

// ═══════════════ 4. ĐƯỜNG CHẠY THẬT ═══════════════

describe('4. HTTP — hai cửa, tường lửa, đua điều kiện', () => {
  let db: TestDb;
  let pool: pg.Pool;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    db = await startTestDb();
    pool = db.pool;
    await ensureGenesis(pool);
    app = createApp({
      pool, mailer: new CapturingMailer(),
      appBaseUrl: 'https://dubao.test', secureCookie: false,
    });
  }, 180_000);
  afterAll(async () => { await db?.stop(); });

  const goi = (p: string, cookie: string, body?: unknown) =>
    app.request(`http://x${p}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  interface SoDu { bankroll: bigint; q: bigint; viT: bigint; dot: bigint; soQ: bigint }
  /** Ảnh chụp CẢ HAI loại xu + ba sổ liên quan. Dùng để đo tường lửa hai chiều. */
  async function chup(userId: string): Promise<SoDu> {
    const one = async (sql: string, v: unknown[] = [userId]) =>
      BigInt((await pool.query(sql, v)).rows[0].s ?? 0);
    return {
      bankroll: BigInt((await pool.query(
        'SELECT bankroll FROM users WHERE user_id = $1', [userId])).rows[0].bankroll),
      q: BigInt((await pool.query(
        'SELECT quest_points FROM users WHERE user_id = $1', [userId])).rows[0].quest_points),
      viT: await one(
        `SELECT COALESCE(COUNT(*),0)::text AS s FROM wallet_ledger WHERE user_id = $1`),
      dot: await one(`SELECT COALESCE(SUM(amount),0)::text AS s FROM burn_ledger`, []),
      soQ: await one(
        `SELECT COALESCE(COUNT(*),0)::text AS s FROM quest_ledger WHERE user_id = $1`),
    };
  }

  // ─────────────────── 4a. CỬA Q ───────────────────

  it('CATALOG hiện đủ hàng cửa Q + bảng rơi cửa T, và KHÔNG bị 403 stub bịt', async () => {
    const u = await createTestUser(pool);
    const r = await goi('/api/v1/shop/catalog', u.cookie);
    expect(r.status, 'cửa thật bị stub 403 của arena_api bịt?').toBe(200);
    const j = await r.json() as {
      ban_q: { id: string; gia: number | null }[];
      hop: { mon: { id: string }[]; gia_t: number; can_du_t: number };
      quest_points: number;
    };
    expect(j.ban_q.map((m) => m.id).sort())
      .toEqual([...AVATAR_NEN.filter((n) => n.nguon === 'niem_yet_q').map((n) => n.id),
        ...KHUNG.map((k) => k.id)].sort());
    /*
     * ⚠ BẢNG RƠI ≠ DANH MỤC NHÃN DÁN (đổi 04/08, D68a). Trước đó hai thứ trùng
     * nhau nên so với `NHAN_DAN` là đúng; từ khi hộp rơi thêm hai lá NỀN và
     * `st_niem_beta` rời hộp để thành quà beta thì chúng tách hẳn. So với
     * `HOP_GACHA` — nguồn chân lý của câu hỏi "hộp trả ra được gì".
     */
    expect(j.hop.mon.map((m) => m.id).sort()).toEqual(HOP_GACHA.map((m) => m.id).sort());
    expect(j.hop.mon.map((m) => m.id)).not.toContain('st_niem_beta');
    expect(j.hop.can_du_t).toBe(ECONOMY.SUBSIDY_THRESHOLD + j.hop.gia_t);
    // Chưa có nguồn phát Q nào → mọi người 0 Q. Đó là sự thật, không phải lỗi.
    expect(j.quest_points).toBe(0);
  });

  it('0 Q thì mua hàng niêm yết bị TỪ CHỐI rõ ràng, không âm số dư', async () => {
    const u = await createTestUser(pool);
    const r = await goi('/api/v1/shop/mua', u.cookie, { mon_id: KHUNG[0]!.id });
    expect(r.status).toBe(409);
    expect((await r.json() as { error: string }).error).toBe('khong_du_q');
    const { rows } = await pool.query(
      'SELECT quest_points FROM users WHERE user_id = $1', [u.userId]);
    expect(rows[0].quest_points).toBe(0n);
  });

  it('MUA KHUNG: trừ đúng giá niêm yết, ghi sổ Q, trao món — và KHÔNG chạm T', async () => {
    const khung = KHUNG[0]!;
    const u = await createTestUser(pool, { questPoints: khung.gia_q! * 3 });
    const truoc = await chup(u.userId);

    const r = await goi('/api/v1/shop/mua', u.cookie, { mon_id: khung.id });
    expect(r.status).toBe(200);
    const j = await r.json() as { gia_q: number; quest_points: number };

    const sau = await chup(u.userId);
    // Trừ ĐÚNG BẰNG giá niêm yết (quan hệ, không phải con số chép lại).
    expect(sau.q).toBe(truoc.q - BigInt(khung.gia_q!));
    expect(j.gia_q).toBe(khung.gia_q);
    expect(j.quest_points).toBe(Number(sau.q));
    // Sổ Q có thêm đúng một dòng, và số dư sau khớp.
    expect(sau.soQ).toBe(truoc.soQ + 1n);
    const { rows: ql } = await pool.query(
      `SELECT delta, balance_after, reason, ref_id FROM quest_ledger
        WHERE user_id = $1 ORDER BY entry_id DESC LIMIT 1`, [u.userId]);
    expect(Number(ql[0].delta)).toBe(-khung.gia_q!);
    expect(BigInt(ql[0].balance_after)).toBe(sau.q);
    // Cửa shop dùng đúng lý do mà 0016 (bên phát Q) chừa sẵn cho nó.
    expect(ql[0].reason).toBe('shop_q');
    expect(ql[0].ref_id).toBe(khung.id);
    // TƯỜNG LỬA: không một đơn vị T nào, không một dòng sổ T nào.
    expect(sau.bankroll).toBe(truoc.bankroll);
    expect(sau.viT).toBe(truoc.viT);
    expect(sau.dot).toBe(truoc.dot);
    // Món đã về tay.
    const { rowCount } = await pool.query(
      'SELECT 1 FROM user_cosmetics WHERE user_id = $1 AND cosmetic_id = $2',
      [u.userId, khung.id]);
    expect(rowCount).toBe(1);
  });

  it('mua khung lần hai bị chặn — đồ ĐEO thì một bản là đủ', async () => {
    const khung = KHUNG[1]!;
    const u = await createTestUser(pool, { questPoints: khung.gia_q! * 3 });
    expect((await goi('/api/v1/shop/mua', u.cookie, { mon_id: khung.id })).status).toBe(200);
    const r2 = await goi('/api/v1/shop/mua', u.cookie, { mon_id: khung.id });
    expect(r2.status).toBe(409);
    expect((await r2.json() as { error: string }).error).toBe('da_so_huu');
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM quest_ledger WHERE user_id = $1`, [u.userId]);
    expect(rows[0].n, 'lần hai bị chặn mà vẫn trừ Q').toBe(1);
  });

  /*
   * ⚠ D41 XOÁ CỬA BÁN AVATAR NỀN. Hai test cũ ("MUA AVATAR NỀN" và "BẢN SAO THÊM")
   * mở đầu bằng `AVATAR_NEN.find(n => n.nguon === 'niem_yet_q')!` — sau D41 không
   * còn nền nào ở cửa Q nên biểu thức đó là `undefined`, và dấu `!` biến một thay
   * đổi thiết kế thành một cú nổ khó đọc giữa test.
   *
   * Thay bằng hai test đúng với luật MỚI. Không hạ độ chặt: cái cần canh bây giờ là
   * "cửa Q KHÔNG bán nền", và nó được canh ở CẢ hai tầng (catalog + endpoint mua).
   */
  it('D41: KHÔNG nền nào ở cửa Q — catalog trống, và mua thẳng id vẫn bị từ chối', async () => {
    // Tầng 1 — catalog: không lá nền nào lọt vào danh sách bán.
    expect(AVATAR_NEN.filter((n) => n.nguon === 'niem_yet_q')).toHaveLength(0);
    const u = await createTestUser(pool, { questPoints: 10_000 });
    const cat = await (await goi('/api/v1/shop/catalog', u.cookie)).json() as
      { cua_q?: { mon_id: string }[] };
    const idNen = new Set(AVATAR_NEN.map((n) => n.id));
    for (const m of cat.cua_q ?? []) {
      expect(idNen.has(m.mon_id), `${m.mon_id}: nền vẫn còn trên cửa Q`).toBe(false);
    }

    /*
     * Tầng 2 — ĐƯỜNG SAU. Người dùng còn giữ nút cũ (hoặc gọi thẳng API) vẫn bấm
     * được id đó. Catalog sạch mà endpoint vẫn bán thì D41 chỉ là chuyện hiển thị.
     */
    const q0 = (await chup(u.userId)).q;
    const r = await goi('/api/v1/shop/mua', u.cookie, { mon_id: 'av_ao_trum_dau' });
    expect(r.status, 'áo trùm đầu nay là thưởng lộ trình, không phải hàng').not.toBe(200);
    expect((await chup(u.userId)).q, 'từ chối mà vẫn trừ Q').toBe(q0);
  });

  /*
   * D36 biến avatar nền thành VẬT TIÊU HAO, mà D16 chỉ định giá cho món mua một
   * lần → giá bản sao là THAM SỐ KINH TẾ MỚI, agent không đặt (A8.2).
   *
   * ⚠ SAU D41 ĐƯỜNG NÀY KHÔNG CÒN CỬA VÀO NÀO: cửa Q hết nền, nên không có id nào
   * để mua bản sao thứ hai. Cơ chế "nền là vật tiêu hao" vì thế đang KHÔNG VỚI TỚI
   * ĐƯỢC — và đó là trạng thái ĐÚNG, vì nó vốn đã bị chặn bởi `GIA_BAN_SAO_THEM`
   * còn `null`. Test giữ lại để khoá bất biến: chừng nào chưa có giá thì không
   * đường nào được phép chạy với một số tạm.
   *
   * CHỜ FOUNDER: khi chốt `GIA_BAN_SAO_THEM`, phải quyết luôn **nền nào được mua
   * bản sao** — cả ba lá tặng, hay chỉ lá lộ trình? Bán bản sao của một lá TẶNG là
   * đang bán một thứ vốn cho không.
   */
  it('GIÁ BẢN SAO chưa chốt ⇒ không đường nào bán bản sao, và không xu Q nào bị trừ', () => {
    expect(GIA_BAN_SAO_THEM, 'có giá rồi thì phải mở lại đường mua + viết test mới')
      .toBeNull();
    expect(AVATAR_NEN.filter((n) => n.nguon === 'niem_yet_q'),
      'còn nền ở cửa Q là còn cửa vào cho bản sao chưa định giá').toHaveLength(0);
  });

  it('nhãn dán KHÔNG mua được bằng Q (nó là hàng của hộp)', async () => {
    const u = await createTestUser(pool, { questPoints: 10_000 });
    const r = await goi('/api/v1/shop/mua', u.cookie, { mon_id: NHAN_DAN[0]!.id });
    expect(r.status).toBe(400);
    expect((await r.json() as { error: string }).error).toBe('mon_khong_ban');
  });

  // ─────────────────── 4b. CỬA T ───────────────────

  it('MỞ HỘP: đốt đúng giá, trao một nhãn dán, ghi HAI sổ T — và KHÔNG chạm Q', async () => {
    const u = await createTestUser(pool, { bankroll: 5_000, questPoints: 900 });
    /*
     * ⚠ ẨN HAI LÁ NỀN cho riêng bài này (04/08). Bài đo đường NHÃN DÁN — nó kiểm
     * `kho_sticker` ở cuối, mà lá nền đi vào `avatar_so_huu` nên nếu bốc trúng
     * nền thì bài đo nhầm bảng. Ẩn đi để nó vẫn đo đúng thứ nó mang tên; đường
     * nền có bài riêng ở `tests/gacha_nen.test.ts`.
     */
    const nenGacha = AVATAR_NEN.filter((n) => n.nguon === 'gacha_t').map((n) => n.id);
    await pool.query(
      `UPDATE cosmetic_items SET trang_thai = 'an' WHERE cosmetic_id = ANY($1)`, [nenGacha]);
    try {
    const truoc = await chup(u.userId);

    const r = await goi('/api/v1/shop/hop', u.cookie, {});
    expect(r.status).toBe(200);
    const j = await r.json() as {
      bac: Rarity; mon: { id: string }; bankroll: number; hat: number;
    };
    expect(NHAN_DAN.map((n) => n.id), 'ẩn nền rồi mà vẫn ra nền?').toContain(j.mon.id);

    const sau = await chup(u.userId);
    expect(sau.bankroll).toBe(truoc.bankroll - BigInt(GACHA.COST_T));
    expect(Number(sau.bankroll)).toBe(j.bankroll);
    expect(sau.viT).toBe(truoc.viT + 1n);
    // Đốt 100%: burn_ledger tăng đúng bằng số đã trừ khỏi ví (không vào Kho bạc).
    expect(sau.dot).toBe(truoc.dot + BigInt(GACHA.COST_T));
    // TƯỜNG LỬA chiều ngược: Q không nhúc nhích, sổ Q không có dòng nào.
    expect(sau.q).toBe(truoc.q);
    expect(sau.soQ).toBe(truoc.soQ);

    // Nhãn về kho THẬT, và event ghi cùng transaction.
    const { rows: kho } = await pool.query(
      'SELECT so_luong, tong_nhan FROM kho_sticker WHERE user_id = $1 AND sticker_id = $2',
      [u.userId, j.mon.id]);
    expect(Number(kho[0].so_luong)).toBeGreaterThanOrEqual(1);
    const { rows: ev } = await pool.query(
      `SELECT value_num, value_json FROM events
        WHERE user_id = $1 AND action_type = 'gacha_mo'`, [u.userId]);
    expect(Number(ev[0].value_num)).toBe(GACHA.COST_T);
    expect(ev[0].value_json.hat).toBe(j.hat);
    expect(ev[0].value_json.du_t).toBe(j.bankroll);
    // A7: snapshot phải GỌN.
    expect(JSON.stringify(ev[0].value_json).length).toBeLessThan(300);
    } finally {
      await pool.query(
        `UPDATE cosmetic_items SET trang_thai = 'song' WHERE cosmetic_id = ANY($1)`,
        [nenGacha]);
    }
  });

  it('vốn không đủ để giữ số dư trên ngưỡng trợ cấp → TỪ CHỐI, không đốt gì', async () => {
    const canDu = ECONOMY.SUBSIDY_THRESHOLD + GACHA.COST_T;
    const u = await createTestUser(pool, { bankroll: canDu - 1 });
    const truoc = await chup(u.userId);
    const r = await goi('/api/v1/shop/hop', u.cookie, {});
    expect(r.status).toBe(409);
    expect((await r.json() as { error: string }).error).toBe('von_qua_thap');
    const sau = await chup(u.userId);
    expect(sau.bankroll).toBe(truoc.bankroll);
    expect(sau.dot).toBe(truoc.dot);

    // Đúng ngưỡng thì mở được — chặn phải là chặn, không phải chặn quá.
    const v = await createTestUser(pool, { bankroll: canDu });
    expect((await goi('/api/v1/shop/hop', v.cookie, {})).status).toBe(200);
    const { rows } = await pool.query(
      'SELECT bankroll FROM users WHERE user_id = $1', [v.userId]);
    expect(rows[0].bankroll).toBe(BigInt(ECONOMY.SUBSIDY_THRESHOLD));
  });

  /*
   * Pity chỉ là lời hứa nếu bộ đếm sống qua request. `pull()` là hàm thuần nhận
   * bộ đếm vào — không ai lưu thì mỗi lượt bắt đầu lại từ 0 và "epic trong 20
   * lượt" không bao giờ chạm tới. Đo Ở DB, và đo bằng QUAN HỆ (đủ 20 lượt phải có
   * ít nhất một epic) chứ không chép con số 20 vào assertion.
   */
  it('PITY sống qua request: đủ mốc bảo hiểm là ra epic, bộ đếm lưu ở DB', async () => {
    const n = GACHA.PITY_EPIC;
    const u = await createTestUser(pool, {
      bankroll: ECONOMY.SUBSIDY_THRESHOLD + GACHA.COST_T * (n + 2),
    });
    const bac: Rarity[] = [];
    for (let i = 0; i < n; i += 1) {
      const r = await goi('/api/v1/shop/hop', u.cookie, {});
      expect(r.status, `lượt ${i + 1}`).toBe(200);
      bac.push((await r.json() as { bac: Rarity }).bac);
    }
    expect(bac.filter((b) => b === 'epic').length,
      'đủ mốc bảo hiểm mà không có epic nào → bộ đếm không được lưu').toBeGreaterThanOrEqual(1);

    const { rows } = await pool.query(
      'SELECT tu_epic, tong_luot FROM gacha_pity WHERE user_id = $1', [u.userId]);
    expect(Number(rows[0].tong_luot)).toBe(n);
    expect(Number(rows[0].tu_epic)).toBeLessThan(GACHA.PITY_EPIC);
  });

  it('sổ sách CÂN sau khi mở hộp (bất biến A của audit)', async () => {
    const u = await createTestUser(pool, { bankroll: 3_000 });
    for (let i = 0; i < 3; i += 1) {
      expect((await goi('/api/v1/shop/hop', u.cookie, {})).status).toBe(200);
    }
    const bc = await auditSupply(pool);
    expect(bc.ok, JSON.stringify(bc.problems)).toBe(true);
  });

  // ─────────────────── 4c. TƯỜNG LỬA Ở TẦNG DB ───────────────────

  describe('tường lửa T↔Q — thử VI PHẠM thật, đòi DB từ chối', () => {
    /*
     * Sau 0016 (hệ nhiệm vụ — bên PHÁT Q), tường lửa không còn là "cấm mọi thay
     * đổi quest_points" mà là hai thứ chặt hơn: (a) đổi Q phải có DÒNG SỔ KHỚP,
     * (b) danh mục `reason` quyết định đường nào được phát. Shop chỉ đứng ở chiều
     * TIÊU, và đó là điều test này ghim.
     */
    it('quest_points KHÔNG đổi được mà không có dòng sổ khớp (A3.10)', async () => {
      const u = await createTestUser(pool, { questPoints: 100 });
      await expect(pool.query(
        'UPDATE users SET quest_points = quest_points + 1 WHERE user_id = $1', [u.userId],
      )).rejects.toThrow();
    });

    it('shop CHỈ ghi dòng sổ ÂM, và chỉ với lý do `shop_q`', async () => {
      const khung = KHUNG[0]!;
      const u = await createTestUser(pool, { questPoints: khung.gia_q! });
      expect((await goi('/api/v1/shop/mua', u.cookie, { mon_id: khung.id })).status).toBe(200);
      const { rows } = await pool.query(
        `SELECT delta, reason FROM quest_ledger WHERE user_id = $1`, [u.userId]);
      expect(rows.length).toBe(1);
      expect(Number(rows[0].delta)).toBeLessThan(0);
      expect(rows[0].reason).toBe('shop_q');

      // Và mã shop không có chỗ nào ghi một lý do Q khác — kể cả lý do PHÁT.
      const src = (await Promise.all([
        readFile(new URL('../server/shop.ts', import.meta.url), 'utf8'),
        readFile(new URL('../server/shop_kho.ts', import.meta.url), 'utf8'),
      ])).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect(src).not.toMatch(/lo_trinh_moc|hoan_ve|admin_adjust/);
    });

    it('quest_ledger là APPEND-ONLY (không sửa, không xoá)', async () => {
      const khung = KHUNG[2]!;
      const u = await createTestUser(pool, { questPoints: khung.gia_q! });
      expect((await goi('/api/v1/shop/mua', u.cookie, { mon_id: khung.id })).status).toBe(200);
      await expect(pool.query(
        'UPDATE quest_ledger SET delta = -1 WHERE user_id = $1', [u.userId])).rejects.toThrow();
      await expect(pool.query(
        'DELETE FROM quest_ledger WHERE user_id = $1', [u.userId])).rejects.toThrow();
    });

    it('KHÔNG đặt được giá Q cho một món của hộp T (một món một cửa, ở tầng DB)', async () => {
      await expect(pool.query(
        `UPDATE cosmetic_items SET price_q = 100 WHERE cosmetic_id = $1`, [NHAN_DAN[0]!.id],
      )).rejects.toThrow();
      // Và ngược lại: gỡ giá của món cửa Q cũng bị chặn.
      await expect(pool.query(
        `UPDATE cosmetic_items SET price_q = NULL WHERE cosmetic_id = $1`, [KHUNG[0]!.id],
      )).rejects.toThrow();
    });

    it('hai hàm tiền không đọc nổi loại xu của nhau (quét mã nguồn)', async () => {
      const src = await readFile(new URL('../server/shop_kho.ts', import.meta.url), 'utf8');
      const than = (ten: string) => {
        const i = src.indexOf(`export async function ${ten}`);
        expect(i, `không tìm thấy ${ten}`).toBeGreaterThan(0);
        // Cắt tới hàm export kế tiếp — đủ để bao trọn thân hàm.
        const j = src.indexOf('\nexport ', i + 10);
        return src.slice(i, j < 0 ? src.length : j)
          .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      };
      expect(than('chiQ')).not.toMatch(/bankroll|burn_ledger|wallet_ledger/);
      expect(than('dotT')).not.toMatch(/quest_points|quest_ledger/);
    });
  });

  // ─────────────────── 4d. ĐUA ĐIỀU KIỆN TRÊN HÀNG HỮU HẠN ───────────────────

  /*
   * CHỖ DỄ VỠ NHẤT CỦA CẢ ĐỢT. D36: món độc quyền "số lượng cực ít, cực hiếm".
   * Hữu hạn + nhiều người bấm cùng lúc = đua điều kiện, và cách viết SAI mà trông
   * rất đúng là gộp "khoá" với "đếm" vào một câu SELECT … FOR UPDATE: ở READ
   * COMMITTED, subquery trong danh sách chọn vẫn dùng snapshot CŨ sau khi khoá được
   * đánh thức, nên hai giao dịch cùng đọc "đã phát = 0" và cùng được cấp.
   */
  describe('hàng hữu hạn — không bao giờ phát quá số lượng', () => {
    const MON = MON_HUU_HAN[0]!.id;

    async function datGioiHan(n: number | null) {
      await pool.query('UPDATE cosmetic_items SET gioi_han = $2 WHERE cosmetic_id = $1',
        [MON, n]);
    }
    async function daPhat(): Promise<number> {
      const { rows } = await pool.query(
        `SELECT COALESCE(SUM(tong_nhan), 0)::int AS n FROM kho_sticker WHERE sticker_id = $1`,
        [MON]);
      return Number(rows[0].n);
    }

    it('5 giao dịch CHEN NHAU trên giới hạn 2 → đúng 2 thành công', async () => {
      const truoc = await daPhat();
      await datGioiHan(truoc + 2);
      const users = await Promise.all(
        Array.from({ length: 5 }, () => createTestUser(pool)));

      // Mỗi người một kết nối riêng, mỗi kết nối một transaction thật.
      const ketQua = await Promise.all(users.map(async (u) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await capMonHuuHan(client, u.userId, MON, 1);
          await client.query('COMMIT');
          return 'ok';
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          if (e instanceof ShopError) return e.code;
          throw e;
        } finally {
          client.release();
        }
      }));

      expect(ketQua.filter((x) => x === 'ok').length).toBe(2);
      expect(ketQua.filter((x) => x === 'het_ban_phat_hanh').length).toBe(3);
      // Bất biến thật sự quan trọng: TỔNG ĐÃ PHÁT không bao giờ vượt giới hạn.
      expect(await daPhat()).toBe(truoc + 2);
      await datGioiHan(null);
    });

    it('MỞ HỘP song song trên bản CUỐI CÙNG: ai không nhận được thì KHÔNG bị đốt T',
      async () => {
        /*
         * Ép hộp chỉ còn đúng một loại hàng: ẩn mọi nhãn khác, đặt giới hạn cho món
         * còn lại. Khi bản cuối đã hết, `haBac` trả null → transaction ROLLBACK →
         * T chưa từng bị trừ. Đốt tiền để nhận không có gì là lỗi tệ nhất cửa này
         * có thể mắc, nên nó phải KHÔNG BIỂU DIỄN ĐƯỢC, không phải hiếm.
         */
        /*
         * ⚠ PHẢI ẨN CẢ HAI LÁ NỀN (04/08). Bài này ép hộp còn ĐÚNG MỘT món để đo
         * "hết hàng thì không đốt T". Từ khi hộp rơi thêm nền, ẩn mỗi nhãn dán là
         * chưa đủ: nền vẫn trao được ⇒ 4 người cùng thành công và bài đỏ với
         * "expected 4 to be 1" — đó chính là cách nó lộ ra hôm nay.
         */
        const khac = [
          ...NHAN_DAN.filter((n) => n.id !== MON).map((n) => n.id),
          ...AVATAR_NEN.filter((n) => n.nguon === 'gacha_t').map((n) => n.id),
        ];
        await pool.query(
          `UPDATE cosmetic_items SET trang_thai = 'an' WHERE cosmetic_id = ANY($1)`, [khac]);
        const truoc = await daPhat();
        await datGioiHan(truoc + 1);
        try {
          const users = await Promise.all(Array.from({ length: 4 }, () =>
            createTestUser(pool, { bankroll: 5_000 })));
          const dotTruoc = BigInt((await pool.query(
            `SELECT COALESCE(SUM(amount),0)::text AS s FROM burn_ledger`)).rows[0].s);

          const res = await Promise.all(users.map(async (u) => {
            const r = await goi('/api/v1/shop/hop', u.cookie, {});
            return { status: r.status, body: await r.json() as { error?: string }, u };
          }));

          expect(res.filter((x) => x.status === 200).length).toBe(1);
          expect(res.filter((x) => x.status === 409).length).toBe(3);
          expect(await daPhat()).toBe(truoc + 1);

          // Chỉ MỘT lượt được đốt — ba người bị từ chối phải còn nguyên vốn.
          const dotSau = BigInt((await pool.query(
            `SELECT COALESCE(SUM(amount),0)::text AS s FROM burn_ledger`)).rows[0].s);
          expect(dotSau - dotTruoc).toBe(BigInt(GACHA.COST_T));
          for (const x of res) {
            const { rows } = await pool.query(
              'SELECT bankroll FROM users WHERE user_id = $1', [x.u.userId]);
            expect(rows[0].bankroll, `${x.status}: vốn sai`)
              .toBe(x.status === 200 ? BigInt(5_000 - GACHA.COST_T) : 5_000n);
          }
        } finally {
          await pool.query(
            `UPDATE cosmetic_items SET trang_thai = 'song' WHERE cosmetic_id = ANY($1)`, [khac]);
          await datGioiHan(null);
        }
      });

    it('món ngừng phát hành thì không cấp được, kể cả gọi thẳng hàm cấp phát',
      async () => {
        const u = await createTestUser(pool);
        await pool.query(
          `UPDATE cosmetic_items SET trang_thai = 'thu_hoi' WHERE cosmetic_id = $1`, [MON]);
        try {
          await expect(capMonHuuHan(pool, u.userId, MON, 1)).rejects.toThrow(/ngung_phat_hanh/);
        } finally {
          await pool.query(
            `UPDATE cosmetic_items SET trang_thai = 'song' WHERE cosmetic_id = $1`, [MON]);
        }
      });

    it('khung KHÔNG cấp được qua đường kho nhãn dán (sai loại là chặn, không im lặng)',
      async () => {
        const u = await createTestUser(pool);
        await expect(capMonHuuHan(pool, u.userId, KHUNG[0]!.id, 1))
          .rejects.toThrow(/khong_phai_nhan_dan/);
      });
  });

  // ─────────────────── 4e. CỜ TÍNH NĂNG ───────────────────

  /*
   * `events.action_type` là CHECK ĐÓNG và ba migration cùng đợt đều nới nó — một
   * trong ba nới bằng cách VIẾT LẠI TOÀN BỘ danh sách, nên hai loại của shop có thể
   * bị xoá âm thầm bởi một migration số cao hơn (xem đầu `0018_shop_events.sql`).
   * Test này biến quả mìn đó thành một dòng CI đỏ có địa chỉ, thay vì một 23514 giữa
   * transaction mua hàng của người thật.
   */
  it('hai loại event của shop CÒN SỐNG trong CHECK cuối cùng của schema', async () => {
    const { rows } = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint
        WHERE conname = 'events_action_type_check' AND conrelid = 'events'::regclass`);
    for (const loai of ['shop_mua', 'gacha_mo']) {
      expect(rows[0].d as string,
        `${loai} bị một migration số cao hơn viết lại danh sách và xoá mất`)
        .toContain(loai);
    }
  });

  it('cờ SANDBOX_FEES vẫn TẮT — 0015 không mở nguồn phát Q nào', () => {
    // Nới trigger theo MỘT CHIỀU nghĩa là vé bàn thu Q vẫn không thu nổi của ai.
    expect(SANDBOX_FLAGS.SANDBOX_FEES).toBe(false);
    // Và hai cờ shop phải BẬT, không thì cả đợt này là cơ chế trang trí.
    expect(SANDBOX_FLAGS.COSMETICS).toBe(true);
    expect(SANDBOX_FLAGS.GACHA).toBe(true);
  });
});
