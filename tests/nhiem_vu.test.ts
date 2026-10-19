/**
 * VIỆC TUẦN + LỘ TRÌNH MÙA 0.0 — test.
 *
 * Bốn nhóm, và mỗi nhóm canh một cách hỏng ĐÃ TỪNG XẢY RA trong repo này:
 *
 *  A. TƯỜNG LỬA Q (A3.5/A3.10) — đọc CHECK THẬT trong `pg_constraint`, không đọc
 *     hằng số TS. Test chép hằng số thì không kiểm gì (bẫy #7): nếu ai đó thêm
 *     'payout' vào danh mục `quest_ledger.reason` bằng một migration, một test
 *     so-hai-mảng-TS vẫn xanh.
 *  B. CÀY KHÔNG ĐƯỢC TRẢ — so QUAN HỆ (2 phiên vs 40 phiên) chứ không so số.
 *     Đây là tính chất phải giữ dù mọi tham số đổi.
 *  C. TIẾN ĐỘ CÓ CHẠY THẬT (bẫy #1, 8 lần) — đường suy tiến độ đọc đúng những
 *     dòng mà `markets.ts` / `holdem_api.ts` / `avatar.ts` ĐANG ghi, nên test
 *     dựng bằng chứng theo ĐÚNG hình dạng đường chạy thật (kể cả `value_json`).
 *  D. MIGRATION KHÔNG XOÁ VIỆC NGƯỜI KHÁC — 0016 nới `events_action_type_check`
 *     bằng cách đọc-rồi-chèn; test khẳng định loại event của 0013 VẪN INSERT ĐƯỢC.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser } from './helpers/fixtures.js';
import {
  CHANG_LO_TRINH, MUA_0_0, NHIEM_VU_TAT_CA, Q_CHECKIN_MOI_NGAY,
  changTuViec, rosterTuan, tranQMua, VIEC_LOI, VIEC_LUAN_PHIEN,
} from '../config/progression.js';
import {
  diemDanh, nhanMocDaDat, ngayVN, raSoatTuan, themQ, tienDoViec, trangThaiLoTrinh,
  tuanCuaMua,
} from '../server/nhiem_vu.js';

let db: TestDb;
let pool: pg.Pool;

/** Giữa tuần 1 của mùa 0.0 — mọi bằng chứng test ghi ts tường minh quanh mốc này. */
const NOW = new Date(Date.parse('2026-07-29T05:00:00Z'));

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

/** Danh sách giá trị hợp lệ của một CHECK `col IN (...)`, đọc từ DB thật. */
async function danhMucCheck(ten: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = $1`,
    [ten],
  );
  const d = rows[0]?.d as string | undefined;
  if (d === undefined) throw new Error(`không thấy constraint ${ten}`);
  return [...d.matchAll(/'([a-z_0-9]+)'::text/g)].map((m) => m[1]!);
}

async function ghiEvent(
  userId: string, actionType: string, ts: Date,
  opts: { contextId?: string; valueJson?: unknown } = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO events (user_id, ts, context_type, context_id, action_type, value_json)
     VALUES ($1, $2, 'test', $3, $4, $5)`,
    [userId, ts.toISOString(), opts.contextId ?? null, actionType,
      opts.valueJson === undefined ? null : JSON.stringify(opts.valueJson)],
  );
}

/** Một phiên Đấu trường đã xong, đúng hình dạng `holdem_api.ts` ghi. */
async function ghiPhien(userId: string, ts: Date): Promise<void> {
  const { rows } = await pool.query(
    `INSERT INTO holdem_matches
       (owner_user_id, seed, status, ghe_json, engine_version, balance_version,
        season_id, started_at, ended_at)
     VALUES ($1, 1, 'xong', '[]'::jsonb, 'test', 'test', $2, $3, $3)
     RETURNING match_id`,
    [userId, MUA_0_0.SEASON_ID, ts.toISOString()],
  );
  await pool.query(
    `INSERT INTO holdem_results
       (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, danh_muc_json,
        created_at)
     VALUES ($1, $2, 'ban', 'nguoi', 'TẬP SỰ', 1, 10000, '{}'::jsonb, $3)`,
    [rows[0].match_id, userId, ts.toISOString()],
  );
}

// ══════════════════════════════════════════════════════════════════════════
describe('A · tường lửa Q ↔ T (A3.5) và sổ Q (A3.10)', () => {
  it('hai danh mục reason KHÔNG giao nhau — đọc CHECK thật, không đọc hằng số TS', async () => {
    const q = await danhMucCheck('quest_ledger_reason_check');
    const t = await danhMucCheck('wallet_ledger_reason_check');
    expect(q.length).toBeGreaterThan(0);
    expect(t.length).toBeGreaterThan(0);
    expect(q.filter((r) => t.includes(r))).toEqual([]);
    // Không đường quy đổi nào, kể cả nghe vô hại.
    for (const cam of ['convert', 'exchange', 'doi_t', 'refund_in_other_currency']) {
      expect(q).not.toContain(cam);
    }
  });

  it('CHỈ một đường PHÁT Q — trần mùa chỉ suy được từ lịch khi số vòi đếm được', async () => {
    const q = await danhMucCheck('quest_ledger_reason_check');
    expect(q).toContain('lo_trinh_moc');
    // Nếu thêm vòi phát mới thì phải sửa `tranQMua()` cùng lúc — test này là chỗ
    // bắt việc quên đó.
    expect(q.filter((r) => r.startsWith('lo_trinh'))).toEqual(['lo_trinh_moc']);
  });

  it('quest_ledger từ chối reason của ví T', async () => {
    const u = await createTestUser(pool);
    await expect(pool.query(
      `INSERT INTO quest_ledger (user_id, delta, balance_after, reason, season_id)
       VALUES ($1, 10, 10, 'payout', 'x')`,
      [u.userId],
    )).rejects.toThrow();
  });

  it('đổi quest_points mà KHÔNG có dòng sổ → transaction nổ lúc COMMIT', async () => {
    const u = await createTestUser(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE users SET quest_points = 999 WHERE user_id = $1`, [u.userId]);
      await expect(client.query('COMMIT')).rejects.toThrow(/quest_ledger|quest_points/);
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
    const { rows } = await pool.query(
      `SELECT quest_points FROM users WHERE user_id = $1`, [u.userId]);
    expect(Number(rows[0].quest_points)).toBe(0);
  });

  it('themQ: ví Q = dòng cuối của sổ, và recompute từ sổ khớp ví', async () => {
    const u = await createTestUser(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await themQ(client, u.userId, 60, 'lo_trinh_moc', 'chang:1');
      await themQ(client, u.userId, 60, 'lo_trinh_moc', 'chang:3');
      await themQ(client, u.userId, -100, 'shop_q', 'kh_manh_cyan');
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    const { rows } = await pool.query(
      `SELECT u.quest_points AS vi,
              (SELECT SUM(delta) FROM quest_ledger WHERE user_id = u.user_id) AS tong,
              (SELECT balance_after FROM quest_ledger WHERE user_id = u.user_id
                ORDER BY entry_id DESC LIMIT 1) AS cuoi
         FROM users u WHERE u.user_id = $1`,
      [u.userId],
    );
    expect(Number(rows[0].vi)).toBe(20);
    expect(Number(rows[0].tong)).toBe(20);
    expect(Number(rows[0].cuoi)).toBe(20);
  });

  it('sổ Q là append-only', async () => {
    const u = await createTestUser(pool);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await themQ(client, u.userId, 60, 'lo_trinh_moc', null);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    await expect(pool.query(
      `UPDATE quest_ledger SET delta = 1 WHERE user_id = $1`, [u.userId])).rejects.toThrow();
    await expect(pool.query(
      `DELETE FROM quest_ledger WHERE user_id = $1`, [u.userId])).rejects.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('B · cày KHÔNG được trả (luật xương sống)', () => {
  it('40 phiên trong một tuần = ĐÚNG BẰNG 1 phiên về số việc xong', async () => {
    const it2 = await createTestUser(pool);
    const nhieu = await createTestUser(pool);

    await ghiPhien(it2.userId, NOW);
    for (let i = 0; i < 40; i += 1) {
      await ghiPhien(nhieu.userId, new Date(NOW.getTime() + i * 60_000));
    }

    const a = await raSoatTuan(pool, it2.userId, NOW);
    const b = await raSoatTuan(pool, nhieu.userId, NOW);
    const xong = (r: typeof a) => r.viec.filter((v) => v.xong).map((v) => v.nv_id).sort();
    expect(xong(a)).toEqual(xong(b));
    // Và cả hai chỉ mở đúng ô Đấu trường — không việc nào khác được cày kèm.
    expect(xong(a)).toEqual(['mot_tran']);
  });

  it('trần một việc/cửa sổ nằm ở KHOÁ CHÍNH: rà soát 5 lần không sinh thêm dòng', async () => {
    const u = await createTestUser(pool);
    await ghiPhien(u.userId, NOW);
    for (let i = 0; i < 5; i += 1) await raSoatTuan(pool, u.userId, NOW);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM nhiem_vu_xong WHERE user_id = $1`, [u.userId]);
    expect(rows[0].n).toBe(1);
  });

  it('chặng bị TRẦN ở SO_CHANG: 40 việc xong vẫn là 30 chặng', () => {
    expect(changTuViec(MUA_0_0.SO_TUAN * MUA_0_0.VIEC_MOI_TUAN)).toBe(MUA_0_0.SO_CHANG);
    expect(changTuViec(1_000_000)).toBe(MUA_0_0.SO_CHANG);
    expect(changTuViec(-5)).toBe(0);
  });

  it('không việc nào có ngưỡng đòi quá 2 ngày có phiên (trần ≤3 phiên/tuần)', () => {
    const phien = NHIEM_VU_TAT_CA.filter((n) => n.be_mat === 'dau_tu_do');
    for (const n of phien) expect(n.muc).toBeLessThanOrEqual(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('C · tiến độ suy từ dấu vết THẬT, không do client khai', () => {
  it('lịch tuần suy từ SERVER: trước mùa và sau mùa đều là null', () => {
    expect(tuanCuaMua(new Date(Date.parse('2026-07-01T00:00:00Z')))).toBeNull();
    expect(tuanCuaMua(NOW)?.tuan).toBe(1);
    const cuoi = new Date(Date.parse(`${MUA_0_0.NGAY_BAT_DAU}T00:00:00+07:00`)
      + MUA_0_0.SO_TUAN * 7 * 86_400_000);
    expect(tuanCuaMua(cuoi)).toBeNull();
    expect(tuanCuaMua(new Date(cuoi.getTime() - 3_600_000))?.tuan).toBe(MUA_0_0.SO_TUAN);
  });

  it('xem_xet xong bằng CHỈ XEM — không cần một dòng bets nào', async () => {
    const u = await createTestUser(pool);
    await ghiEvent(u.userId, 'market_view', NOW,
      { contextId: 'm1', valueJson: { pool: 'macro', status: 'open' } });
    const r = await raSoatTuan(pool, u.userId, NOW);
    expect(r.viec.find((v) => v.nv_id === 'xem_xet')?.xong).toBe(true);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM bets WHERE user_id = $1`, [u.userId]);
    expect(rows[0].n).toBe(0);
  });

  it('doc_lai chỉ tính câu hỏi ĐÃ CHỐT (đồng hồ bên ngoài chặn nguồn cung)', async () => {
    const u = await createTestUser(pool);
    await ghiEvent(u.userId, 'market_view', NOW,
      { contextId: 'm1', valueJson: { pool: 'life', status: 'open' } });
    let r = await raSoatTuan(pool, u.userId, NOW);
    expect(r.viec.find((v) => v.nv_id === 'doc_lai')?.xong).toBe(false);

    await ghiEvent(u.userId, 'market_view', NOW,
      { contextId: 'm2', valueJson: { pool: 'life', status: 'resolved' } });
    r = await raSoatTuan(pool, u.userId, NOW);
    expect(r.viec.find((v) => v.nv_id === 'doc_lai')?.xong).toBe(true);
  });

  it('co_mat đếm NGÀY, không đếm số lần bấm', async () => {
    const u = await createTestUser(pool);
    const cs = tuanCuaMua(NOW)!;
    // 10 lần bấm trong CÙNG một ngày → vẫn là 1 ngày.
    for (let i = 0; i < 10; i += 1) {
      await ghiEvent(u.userId, 'nv_diem_danh', new Date(cs.bat_dau.getTime() + i * 60_000));
    }
    let r = await raSoatTuan(pool, u.userId, NOW);
    expect(r.viec.find((v) => v.nv_id === 'co_mat')?.da).toBe(1);

    for (let d = 1; d < 4; d += 1) {
      await ghiEvent(u.userId, 'nv_diem_danh',
        new Date(cs.bat_dau.getTime() + d * 86_400_000 + 3_600_000));
    }
    r = await raSoatTuan(pool, u.userId, NOW);
    expect(r.viec.find((v) => v.nv_id === 'co_mat')?.xong).toBe(true);
  });

  it('bằng chứng của tuần TRƯỚC không tính cho tuần này', async () => {
    const u = await createTestUser(pool);
    const cs = tuanCuaMua(NOW)!;
    await ghiPhien(u.userId, new Date(cs.bat_dau.getTime() - 86_400_000));
    const r = await raSoatTuan(pool, u.userId, NOW);
    expect(r.viec.find((v) => v.nv_id === 'mot_tran')?.xong).toBe(false);
  });

  it('điểm danh: trần 1 lần/ngày lịch VN', async () => {
    const u = await createTestUser(pool);
    const a = await diemDanh(pool, u.userId, NOW);
    const b = await diemDanh(pool, u.userId, NOW);
    expect(a.moi).toBe(true);
    expect(b.moi).toBe(false);
    expect(a.ngay).toBe(ngayVN(NOW));
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM events
        WHERE user_id = $1 AND action_type = 'nv_diem_danh'`, [u.userId]);
    expect(rows[0].n).toBe(1);
  });

  it('việc mới mà quên khai bằng chứng thì KHÔNG BAO GIỜ xong (fail-closed)', () => {
    const gia = {
      nv_id: 'viec_chua_co_bang_chung', ten: 'x', cua_so: 'tuan' as const,
      be_mat: 'du_bao' as const, muc: 1, ngay_ra_soat: '2026-09-21',
    };
    expect(tienDoViec(gia, {
      ngay_diem_danh: 9, cham_du_bao: 9, nhom_da_ghe: 9, phien_xong: 9,
      ngay_co_phien: 9, keo_da_chot_da_xem: 9, lan_doi_dien_mao: 9,
    } as never)).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('C2 · bảng 30 chặng và trần Q của mùa', () => {
  it('Σ Q các mốc == 20 chặng × Q_MOI_CHANG == tranQMua()', () => {
    const coQ = CHANG_LO_TRINH.filter((c) => c.q > 0);
    expect(CHANG_LO_TRINH.length).toBe(MUA_0_0.SO_CHANG);
    expect(coQ.length * MUA_0_0.Q_MOI_CHANG)
      .toBe(CHANG_LO_TRINH.reduce((s, c) => s + c.q, 0));
    expect(tranQMua()).toBe(coQ.length * MUA_0_0.Q_MOI_CHANG
      + Q_CHECKIN_MOI_NGAY * 7 * MUA_0_0.SO_TUAN);
  });

  it('mỗi chặng có ĐÚNG MỘT số hiệu, liên tục 1..30', () => {
    expect(CHANG_LO_TRINH.map((c) => c.chang_no))
      .toEqual([...Array(MUA_0_0.SO_CHANG)].map((_, i) => i + 1));
  });

  it('không mốc nào trả T, mastery, NSCT hay lượt quay — chỉ Q và cosmetic', () => {
    for (const m of CHANG_LO_TRINH) {
      const khoa = Object.keys(m);
      for (const cam of ['t', 'token', 'bankroll', 'gacha', 'luot', 'nsct', 'mastery',
        'diem_rank', 'danh_xung']) {
        expect(khoa).not.toContain(cam);
      }
    }
  });

  it('chặng có mon_id thì mã món PHẢI có trong catalog (không bịa khoá ngoại)', async () => {
    const ids = CHANG_LO_TRINH.map((c) => c.mon_id).filter((x): x is string => x !== null);
    expect(ids.length).toBeGreaterThan(0);
    const { rows } = await pool.query(
      `SELECT cosmetic_id, family FROM cosmetic_items WHERE cosmetic_id = ANY($1)`, [ids]);
    expect(rows.length).toBe(ids.length);
    // D16/R3: lộ trình CHỈ trao Họ 1 Diện mạo. Họ 2 Danh phận là merit-only.
    for (const r of rows) expect(r.family).toBe('dien_mao');
  });

  it('nhận đủ 30 chặng: Q đúng trần, mốc chờ art KHÔNG bị ghi là đã nhận', async () => {
    const u = await createTestUser(pool);
    // Xong toàn bộ roster của 8 tuần = 40 việc (chặng bị trần ở 30).
    for (let t = 1; t <= MUA_0_0.SO_TUAN; t += 1) {
      for (const nv of rosterTuan(t)) {
        await pool.query(
          `INSERT INTO nhiem_vu_xong (user_id, season_id, cua_so_key, nv_id)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [u.userId, MUA_0_0.SEASON_ID, `W${t}`, nv.nv_id],
        );
      }
    }
    const tt = await trangThaiLoTrinh(pool, u.userId, NOW);
    expect(tt.viec_da_xong).toBe(MUA_0_0.SO_TUAN * MUA_0_0.VIEC_MOI_TUAN);
    expect(tt.chang).toBe(MUA_0_0.SO_CHANG);

    /*
     * ⚠ SỬA 04/08 — TRẦN Q LÀ TRẦN, KHÔNG PHẢI SỐ PHẢI ĐẠT.
     *
     * Bản cũ đòi `quest_points === tranQMua()`, và điều đó chỉ đúng khi mọi mốc
     * chờ art đều có `q: 0`. Chặng 30 phá giả định đó (`q: 60` + `mon_id: null`),
     * và chính chỗ đó là một lỗ mất-món-vĩnh-viễn: nhánh fail-closed cũ hỏi
     * `q === 0 && mon_id === null` nên nó BỎ QUA chặng 30 ⇒ trao 60 Q, ghi
     * `lo_trinh_nhan`, mốc đóng sổ, và món vinh danh lớn nhất mùa không bao giờ
     * tới. Nay điều kiện hỏi "mốc có HỨA món không" (`nhan`), nên chặng 30 giữ
     * TRỌN GÓI — cả Q lẫn món — tới khi art về.
     *
     * ⇒ Q thực nhận = trần − phần đang bị giữ. `tranQMua()` vẫn là trần tuyệt
     * đối cho audit (thực nhận không bao giờ vượt), nên giữ luôn phép so đó.
     */
    const qBiGiu = CHANG_LO_TRINH
      .filter((c) => c.mon_id === null && c.nhan !== undefined)
      .reduce((s, c) => s + c.q, 0);
    expect(tt.quest_points).toBe(tranQMua() - qBiGiu);
    expect(tt.quest_points).toBeLessThanOrEqual(tranQMua());

    const choArt = tt.moc.filter((m) => m.cho_art);
    expect(choArt.length).toBeGreaterThan(0);
    for (const m of choArt) expect(m.da_nhan).toBe(false);
    for (const m of tt.moc.filter((x) => !x.cho_art)) expect(m.da_nhan).toBe(true);

    // Món giao được thì phải NẰM TRONG TÚI, không chỉ nằm trong `lo_trinh_nhan`.
    const { rows } = await pool.query(
      `SELECT cosmetic_id, source FROM user_cosmetics WHERE user_id = $1`, [u.userId]);
    expect(rows.map((r) => r.cosmetic_id)).toContain('kh_moc_neo');
    for (const r of rows) expect(r.source).toBe('bp');

    // Trần Q của mùa (bất biến B1) — không lịch sử chơi nào vượt được.
    const { rows: tran } = await pool.query(
      `SELECT COALESCE(SUM(delta), 0)::int AS phat FROM quest_ledger
        WHERE user_id = $1 AND delta > 0 AND season_id = $2`,
      [u.userId, MUA_0_0.SEASON_ID]);
    expect(tran[0].phat).toBeLessThanOrEqual(tranQMua());
  });

  it('nhận lại lần hai KHÔNG cộng đôi (retry an toàn)', async () => {
    const u = await createTestUser(pool);
    await pool.query(
      `INSERT INTO nhiem_vu_xong (user_id, season_id, cua_so_key, nv_id)
       VALUES ($1, $2, 'W1', 'co_mat')`, [u.userId, MUA_0_0.SEASON_ID]);
    const lan1 = await nhanMocDaDat(pool, u.userId, 1);
    const lan2 = await nhanMocDaDat(pool, u.userId, 1);
    expect(lan1.length).toBe(1);
    expect(lan2.length).toBe(0);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(delta),0)::int AS tong
         FROM quest_ledger WHERE user_id = $1`, [u.userId]);
    expect(rows[0].n).toBe(1);
    expect(rows[0].tong).toBe(MUA_0_0.Q_MOI_CHANG);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('D · migration 0016 không xoá việc của migration khác', () => {
  it('loại event của 0013 VẪN insert được sau khi 0016 nới CHECK', async () => {
    const u = await createTestUser(pool);
    for (const loai of ['sticker_dan', 'avatar_chon', 'hd_mo_bang', 'market_view',
      'nv_diem_danh', 'nv_view', 'nv_xong', 'bp_chang_nhan']) {
      await expect(ghiEvent(u.userId, loai, NOW)).resolves.toBeUndefined();
    }
  });

  it('loại event không khai vẫn bị CHECK từ chối (danh mục còn ĐÓNG)', async () => {
    const u = await createTestUser(pool);
    await expect(ghiEvent(u.userId, 'loai_bua_bai', NOW)).rejects.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('E · luật thiết kế nhiệm vụ (kiểm được bằng danh sách, không bằng tinh thần)', () => {
  it('mọi việc có ngay_ra_soat (A8.9: cấm đường tắt không có ngày chết)', () => {
    for (const nv of NHIEM_VU_TAT_CA) {
      expect(nv.ngay_ra_soat).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('không việc nào sống ở bề mặt CÓ ĐO (xếp hạng / hành vi đặt lệnh)', () => {
    const camBeMat = ['giai_xep_hang', 'xep_hang', 'dat_lenh', 'phan_bo'];
    for (const nv of NHIEM_VU_TAT_CA) expect(camBeMat).not.toContain(nv.be_mat);
  });

  it('nv_id và tên không nhắc biến B2B nào (GOODHART — L-N1)', () => {
    const cam = ['amount', 'pct', 'so_cua', 'win', 'thang', 'hang', 'nav', 'brier',
      'diem_rank', 'phan_vi', 'top'];
    for (const nv of NHIEM_VU_TAT_CA) {
      const s = `${nv.nv_id} ${nv.ten}`.toLowerCase();
      for (const c of cam) expect(s.includes(c)).toBe(false);
    }
  });

  it('roster mỗi tuần đúng VIEC_MOI_TUAN việc, không trùng mã', () => {
    for (let t = 1; t <= MUA_0_0.SO_TUAN; t += 1) {
      const r = rosterTuan(t);
      expect(r.length).toBe(MUA_0_0.VIEC_MOI_TUAN);
      expect(new Set(r.map((n) => n.nv_id)).size).toBe(r.length);
      for (const loi of VIEC_LOI) expect(r.map((n) => n.nv_id)).toContain(loi.nv_id);
    }
    // Ô luân phiên phải THẬT SỰ xoay — nếu nó đứng yên thì nó không đo sở thích gì.
    const oLuan = [...Array(MUA_0_0.SO_TUAN)].map((_, i) => rosterTuan(i + 1)[4]!.nv_id);
    expect(new Set(oLuan).size).toBe(Math.min(MUA_0_0.SO_TUAN, VIEC_LUAN_PHIEN.length));
  });
});
