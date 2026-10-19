/**
 * HUY HIỆU HẠNG + STICKER VINH DANH THEO MÙA (SPEC docs/spec/huy-hieu-hang-sticker.md, mục 5).
 *
 * Mỗi bài đo qua ĐƯỜNG CHẠY THẬT (DB thật, transaction thật, ghiDiemPve / ghiDiemTran) rồi ĐỌC LẠI từ bảng — không
 * tin giá trị hàm trả về. Năm lớp, khớp (a)–(e) của SPEC:
 *   (a) lên bậc ⇒ ĐÚNG MỘT sticker, đúng bậc, của mùa hiện tại
 *   (b) lên lại cùng mùa ⇒ không cấp thêm   (b2) sang mùa mới ⇒ nhận bộ mới
 *   (c) SẮT ⇒ không có sticker
 *   (d) sticker vinh danh không mua được qua shop / không rơi từ gacha
 *   (e) `/auth/me` có `user.bac`
 * Cộng ba bài phụ: sticker bị ẩn không làm hỏng kết trận · KHÔNG phát bù · khớp config ↔ catalog ↔ DB.
 *
 * ⚠ Bậc thang thật chỉ lên được tới BẠCH KIM (APEX_BAT = false ở beta), nên hai sticker apex (Cá Mập, Cá Voi) được đo
 * bằng cách gọi thẳng `capStickerLenBac` — vẫn là cùng đường cấp, chỉ khác chỗ khởi động.
 *
 * Tiêm ngược (D62) đã chạy và ghi ở báo cáo: bỏ `ON CONFLICT DO NOTHING` ⇒ (b) đỏ; đưa sticker vào gacha ⇒ (d) đỏ.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { BAC_THANG, nhanHuyHieu, type BacId } from '../config/rank.js';
import { NHAN_DAN, nhanDanTheoId } from '../config/avatar.js';
import { ghiDiemPve, ghiDiemTran } from '../server/rank.js';
import { capStickerLenBac } from '../server/huy_hieu.js';
import { HOP_GACHA } from '../server/sandbox/ung_vien.js';
import { cuaCuaMon } from '../server/shop.js';
import { currentSeasonId } from '../server/season.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
const MUA = currentSeasonId();
const MUA_SAU = '2099Q1';

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-huy-hieu', secureCookie: false,
  }) as Hono<any>;
}, 180_000);
afterAll(async () => { await db?.stop(); });

const bac = (id: string) => BAC_THANG.find((b) => b.id === id)!;
/** Điểm cao nhất còn THUỘC bậc dưới `id` — một lượt PvE hạng 1 (+3) từ đây sẽ vượt mốc lên `id`. */
const sátDưới = (id: string) => Number(bac(id).moc_duoi) - 2;

async function datDiem(userId: string, mua: string, diem: number, soTran = 9): Promise<void> {
  await pool.query(
    `INSERT INTO rank_diem (user_id, season_id, diem, diem_dinh, so_tran)
          VALUES ($1, $2, $3, GREATEST($3, 0), $4)
     ON CONFLICT (user_id, season_id)
       DO UPDATE SET diem = $3, diem_dinh = GREATEST(rank_diem.diem_dinh, $3), so_tran = $4`,
    [userId, mua, diem, soTran]);
}

/** Một trận PvE hạng 1 trong transaction thật. */
async function thangPve(userId: string, mua = MUA, hang = 1): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await ghiDiemPve(c, { userId, seasonId: mua, hang });
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
}

async function sổ(userId: string): Promise<{ season_id: string; bac_id: string; sticker_id: string }[]> {
  const { rows } = await pool.query(
    `SELECT season_id, bac_id, sticker_id FROM huy_hieu_cap WHERE user_id = $1 ORDER BY season_id, bac_id`,
    [userId]);
  return rows as never;
}
async function kho(userId: string, stickerId: string): Promise<{ so_luong: number; tong_nhan: number } | null> {
  const { rows } = await pool.query(
    `SELECT so_luong, tong_nhan FROM kho_sticker WHERE user_id = $1 AND sticker_id = $2`, [userId, stickerId]);
  return rows[0] ? { so_luong: Number(rows[0].so_luong), tong_nhan: Number(rows[0].tong_nhan) } : null;
}

// ═══════════════════════════════════════════════════════════════════════════
describe('khớp config ↔ catalog ↔ DB (không bảng thứ hai)', () => {
  it('mỗi bậc có kim loại; mỗi sticker khai ở BAC_THANG có trong NHAN_DAN (merit) và trong DB; SẮT không có', async () => {
    expect(BAC_THANG.map((b) => b.kim_loai)).toEqual(
      ['ELITE', 'KIM CƯƠNG', 'BẠCH KIM', 'VÀNG', 'BẠC', 'ĐỒNG', 'SẮT']);
    expect(bac('tap_su').sticker).toBeNull();
    const coSticker = BAC_THANG.filter((b) => b.sticker !== null);
    expect(coSticker).toHaveLength(6);
    expect(new Set(coSticker.map((b) => b.sticker)).size).toBe(6);
    for (const b of coSticker) {
      const nd = nhanDanTheoId(b.sticker!);
      expect(nd, `${b.sticker} thiếu trong NHAN_DAN`).not.toBeNull();
      expect(nd!.nguon).toBe('merit');
      expect(nd!.gia_q).toBeNull();
      const { rows } = await pool.query(
        `SELECT family, kind, price_q, nguon_cua, trang_thai FROM cosmetic_items WHERE cosmetic_id = $1`,
        [b.sticker]);
      expect(rows, `${b.sticker}: thiếu hàng cosmetic_items`).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        family: 'danh_phan', kind: 'sticker', price_q: null, nguon_cua: 'merit', trang_thai: 'song',
      });
    }
    // Chiều ngược: mọi sticker merit trong catalog đều đứng ở một bậc — không mồ côi.
    const merit = NHAN_DAN.filter((n) => n.nguon === 'merit').map((n) => n.id).sort();
    expect(merit).toEqual(coSticker.map((b) => b.sticker!).sort());
  });

  it('nhãn hiển thị "ĐỒNG · Chuyên viên"', () => {
    expect(nhanHuyHieu('chuyen_vien')).toBe('ĐỒNG · Chuyên viên');
    expect(nhanHuyHieu('tap_su')).toBe('SẮT · Tập sự');
    expect(nhanHuyHieu('tao_song')).toBe('ELITE · Người tạo sóng');
    expect(nhanHuyHieu('chua_xep')).toBe('CHƯA XẾP BẬC');
  });
});

describe('(a) lên bậc ⇒ đúng MỘT sticker, đúng bậc, của mùa hiện tại', () => {
  it('PvE: TẬP SỰ → CHUYÊN VIÊN cấp Tôm; đọc lại sổ + kho', async () => {
    const u = await createTestUser(pool);
    await datDiem(u.userId, MUA, sátDưới('chuyen_vien'));
    await thangPve(u.userId);
    expect(await sổ(u.userId)).toEqual([
      { season_id: MUA, bac_id: 'chuyen_vien', sticker_id: 'st_hh_tom' }]);
    expect(await kho(u.userId, 'st_hh_tom')).toEqual({ so_luong: 1, tong_nhan: 1 });
  }, 60_000);

  it('mỗi bậc thang beta lên được cấp đúng sticker của nó (Tôm · Cua · Cá Ngựa · Cá Đuối)', async () => {
    const mong: Record<string, string> = {
      chuyen_vien: 'st_hh_tom', nha_giao_dich: 'st_hh_cua',
      quan_ly_danh_muc: 'st_hh_ca_ngua', giam_doc_dau_tu: 'st_hh_ca_duoi',
    };
    for (const [id, st] of Object.entries(mong)) {
      const u = await createTestUser(pool);
      await datDiem(u.userId, MUA, sátDưới(id));
      await thangPve(u.userId);
      expect((await sổ(u.userId)).map((r) => r.sticker_id), id).toEqual([st]);
      expect((await kho(u.userId, st))?.so_luong, id).toBe(1);
    }
  }, 120_000);

  it('bàn PvP: lên bậc qua ghiDiemTran cũng cấp (cùng đường, event rank_len_bac cùng transaction)', async () => {
    const dan: TestUser[] = [];
    for (let i = 0; i < 4; i += 1) dan.push(await createTestUser(pool));
    await datDiem(dan[0]!.userId, MUA, sátDưới('chuyen_vien'));
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const { rows } = await c.query(
        `INSERT INTO holdem_matches (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id, che_do)
         VALUES ($1, 1, '[]'::jsonb, 'test', 'test', $2, 'rank_slot') RETURNING match_id`,
        [dan[0]!.userId, MUA]);
      const matchId = String(rows[0]!.match_id);
      const ghe = dan.map((u, i) => ({ gheId: `g${i}`, userId: u.userId, bacVaoBan: 'tap_su' }));
      const kq = await ghiDiemTran(c, {
        matchId, seasonId: MUA, cheDo: 'rank_slot', soLa: 12, hangTheoGhe: ghe.map((g) => g.gheId), ghe,
      });
      expect(kq.ghi).toBe(true);
      await c.query('COMMIT');
    } finally { c.release(); }
    expect((await sổ(dan[0]!.userId)).map((r) => r.sticker_id)).toEqual(['st_hh_tom']);
    // Những người không lên bậc thì không có gì.
    for (const u of dan.slice(1)) expect(await sổ(u.userId)).toEqual([]);
    const { rows: ev } = await pool.query(
      `SELECT 1 FROM events WHERE user_id = $1 AND action_type = 'rank_len_bac'`, [dan[0]!.userId]);
    expect(ev).toHaveLength(1);
  }, 60_000);

  it('hai bậc apex (Cá Mập, Cá Voi) cấp qua cùng một đường', async () => {
    const u = await createTestUser(pool);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      expect(await capStickerLenBac(c, u.userId, MUA, 'chu_quy')).toEqual({ cap: true, sticker_id: 'st_hh_ca_map' });
      expect(await capStickerLenBac(c, u.userId, MUA, 'tao_song')).toEqual({ cap: true, sticker_id: 'st_hh_ca_voi' });
      await c.query('COMMIT');
    } finally { c.release(); }
    expect((await sổ(u.userId)).map((r) => r.sticker_id).sort()).toEqual(['st_hh_ca_map', 'st_hh_ca_voi']);
  }, 60_000);
});

describe('(b) lên lại trong CÙNG mùa ⇒ không cấp thêm · (b2) mùa mới ⇒ bộ mới', () => {
  it('tụt rồi lên lại cùng bậc cùng mùa: sổ vẫn một dòng, kho vẫn một bản', async () => {
    const u = await createTestUser(pool);
    await datDiem(u.userId, MUA, sátDưới('chuyen_vien'));
    await thangPve(u.userId);                                 // lên lần 1 → nhận
    await datDiem(u.userId, MUA, sátDưới('chuyen_vien'));     // tụt (đặt lại điểm dưới mốc)
    await thangPve(u.userId);                                 // lên lần 2 cùng mùa
    expect(await sổ(u.userId)).toHaveLength(1);
    expect(await kho(u.userId, 'st_hh_tom')).toEqual({ so_luong: 1, tong_nhan: 1 });
  }, 60_000);

  it('gọi cấp hai lần liền cho cùng (người, mùa, bậc) ⇒ lần hai báo da_nhan_trong_mua', async () => {
    const u = await createTestUser(pool);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      expect((await capStickerLenBac(c, u.userId, MUA, 'nha_giao_dich')).cap).toBe(true);
      expect(await capStickerLenBac(c, u.userId, MUA, 'nha_giao_dich'))
        .toEqual({ cap: false, ly_do: 'da_nhan_trong_mua', sticker_id: 'st_hh_cua' });
      await c.query('COMMIT');
    } finally { c.release(); }
    expect(await kho(u.userId, 'st_hh_cua')).toEqual({ so_luong: 1, tong_nhan: 1 });
  }, 60_000);

  it('MÙA MỚI: leo lại ⇒ một dòng sổ mới + thêm một bản; bộ mùa cũ GIỮ NGUYÊN', async () => {
    const u = await createTestUser(pool);
    await datDiem(u.userId, MUA, sátDưới('chuyen_vien'));
    await thangPve(u.userId);
    await datDiem(u.userId, MUA_SAU, sátDưới('chuyen_vien'));
    await thangPve(u.userId, MUA_SAU);
    expect(await sổ(u.userId)).toEqual([
      { season_id: MUA, bac_id: 'chuyen_vien', sticker_id: 'st_hh_tom' },
      { season_id: MUA_SAU, bac_id: 'chuyen_vien', sticker_id: 'st_hh_tom' },
    ].sort((x, y) => x.season_id.localeCompare(y.season_id)));
    expect(await kho(u.userId, 'st_hh_tom')).toEqual({ so_luong: 2, tong_nhan: 2 });
  }, 60_000);

  it('KHÔNG PHÁT BÙ: người đã ở bậc cao từ trước (điểm sẵn, chưa có sổ) không tự nhận gì', async () => {
    const u = await createTestUser(pool);
    await datDiem(u.userId, MUA, bac('quan_ly_danh_muc').moc_duoi as number + 50, 30);
    expect(await sổ(u.userId)).toEqual([]);
    // Một trận nữa vẫn ở cùng bậc ⇒ không phải "lên bậc" ⇒ vẫn không có gì.
    await thangPve(u.userId);
    expect(await sổ(u.userId)).toEqual([]);
    expect(await kho(u.userId, 'st_hh_ca_ngua')).toBeNull();
  }, 60_000);
});

describe('(c) SẮT không có sticker', () => {
  it('chưa xếp → TẬP SỰ (trận thứ 5) là LÊN bậc nhưng không cấp gì', async () => {
    const u = await createTestUser(pool);
    await datDiem(u.userId, MUA, 0, 4);
    await thangPve(u.userId, MUA, 3);                         // hạng 3 = 0 điểm, nhưng đủ 5 trận ⇒ có bậc
    const { rows } = await pool.query(
      `SELECT so_tran FROM rank_diem WHERE user_id = $1 AND season_id = $2`, [u.userId, MUA]);
    expect(Number(rows[0]!.so_tran)).toBe(5);
    expect(await sổ(u.userId)).toEqual([]);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      expect(await capStickerLenBac(c, u.userId, MUA, 'tap_su'))
        .toEqual({ cap: false, ly_do: 'khong_co_sticker', sticker_id: null });
      await c.query('COMMIT');
    } finally { c.release(); }
    expect(await sổ(u.userId)).toEqual([]);
  }, 60_000);
});

describe('sticker bị ẩn / thiếu hàng KHÔNG làm hỏng kết trận', () => {
  it('trang_thai = an ⇒ điểm vẫn ghi, sổ không có dòng mồ côi, trận không rollback', async () => {
    await pool.query(`UPDATE cosmetic_items SET trang_thai = 'an' WHERE cosmetic_id = 'st_hh_tom'`);
    try {
      const u = await createTestUser(pool);
      await datDiem(u.userId, MUA, sátDưới('chuyen_vien'));
      await thangPve(u.userId);                               // phải KHÔNG ném
      const { rows } = await pool.query(
        `SELECT diem FROM rank_diem WHERE user_id = $1 AND season_id = $2`, [u.userId, MUA]);
      expect(Number(rows[0]!.diem)).toBe(sátDưới('chuyen_vien') + 3);
      expect(await sổ(u.userId)).toEqual([]);                 // savepoint cuốn cả dòng sổ
      expect(await kho(u.userId, 'st_hh_tom')).toBeNull();
    } finally {
      await pool.query(`UPDATE cosmetic_items SET trang_thai = 'song' WHERE cosmetic_id = 'st_hh_tom'`);
    }
  }, 60_000);
});

describe('(d) sticker vinh danh KHÔNG mua được, KHÔNG rơi từ gacha', () => {
  const ids = BAC_THANG.filter((b) => b.sticker).map((b) => b.sticker!);

  it('không nằm trong bảng rơi của hộp; tường lửa A3.5 nhận ra là "merit"', () => {
    const trongHop = new Set(HOP_GACHA.map((m) => m.id));
    for (const id of ids) {
      expect(trongHop.has(id), `${id} lọt vào hộp gacha`).toBe(false);
      expect(cuaCuaMon(id), `${id} thuộc cửa nào`).toBe('merit');
    }
  });

  it('DB khoá giá: không UPDATE nào đặt được price_q cho món merit', async () => {
    for (const id of ids) {
      await expect(pool.query(
        `UPDATE cosmetic_items SET price_q = 100 WHERE cosmetic_id = $1`, [id]),
      ).rejects.toThrow();
    }
  });

  it('POST /shop/mua từ chối; catalog shop không liệt kê', async () => {
    const u = await createTestUser(pool, { questPoints: 5000 });
    for (const id of ids) {
      const r = await app.request('http://localhost/api/v1/shop/mua', {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: u.cookie },
        body: JSON.stringify({ mon_id: id }),
      });
      expect(r.status, id).toBe(400);
      expect(((await r.json()) as any).error).toBe('mon_khong_ban');
    }
    const cat = await app.request('http://localhost/api/v1/shop/catalog', { headers: { cookie: u.cookie } });
    expect(cat.status).toBe(200);
    expect(JSON.stringify(await cat.json())).not.toContain('st_hh_');
    expect(await kho(u.userId, 'st_hh_tom')).toBeNull();
  }, 60_000);
});

describe('(e) /auth/me có `user.bac`', () => {
  async function bacCua(u: TestUser): Promise<unknown> {
    const r = await app.request('http://localhost/api/v1/auth/me', { headers: { cookie: u.cookie } });
    expect(r.status).toBe(200);
    const j = (await r.json()) as any;
    expect('bac' in j.user, 'thiếu trường user.bac').toBe(true);
    return j.user.bac;
  }

  it('đúng id bậc theo điểm mùa này; chưa xếp / chưa chơi ⇒ null (không phải 0, không phải bậc giả)', async () => {
    const chuaChoi = await createTestUser(pool);
    expect(await bacCua(chuaChoi)).toBeNull();

    const chuaXep = await createTestUser(pool);
    await datDiem(chuaXep.userId, MUA, 500, 3);               // điểm cao nhưng mới 3 trận
    expect(await bacCua(chuaXep)).toBeNull();

    for (const [id, diem] of [['tap_su', 10], ['chuyen_vien', 130], ['nha_giao_dich', 400],
      ['quan_ly_danh_muc', 800], ['giam_doc_dau_tu', 2000]] as const) {
      const u = await createTestUser(pool);
      await datDiem(u.userId, MUA, diem, 9);
      expect(await bacCua(u), id).toBe(id satisfies BacId);
    }
  }, 120_000);

  it('điểm của MÙA KHÁC không tính', async () => {
    const u = await createTestUser(pool);
    await datDiem(u.userId, MUA_SAU, 2000, 20);
    expect(await bacCua(u)).toBeNull();
  }, 60_000);

  it('/me/rank trả sticker_da_nhan đúng sổ của mùa', async () => {
    const u = await createTestUser(pool);
    await datDiem(u.userId, MUA, sátDưới('chuyen_vien'));
    await thangPve(u.userId);
    const r = await app.request('http://localhost/api/v1/me/rank', { headers: { cookie: u.cookie } });
    expect(r.status).toBe(200);
    const j = (await r.json()) as any;
    expect(j.sticker_da_nhan).toEqual(['chuyen_vien']);
    expect(j.bac).toBe('chuyen_vien');
  }, 60_000);
});
