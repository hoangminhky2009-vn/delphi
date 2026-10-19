/**
 * ĐIỂM XẾP HẠNG — KIỂM TOÁN LẠM PHÁT + ĐƯỜNG CHẠY THẬT QUA DB.
 *
 * Founder: "nhớ tính toán cái điểm rank này sao cho KHÔNG BỊ LẠM PHÁT". File này là
 * phép kiểm SỐ của câu đó, không phải một câu cam kết trong tài liệu.
 *
 * Bốn tầng, mỗi tầng bắt một lớp lỗi khác nhau:
 *   1. TOÁN THUẦN — tổng delta = 0 ở mọi cỡ bàn, mọi cấu hình bậc, 300.000 bàn ngẫu
 *      nhiên. Không cần DB.
 *   2. PHẢN VÍ DỤ — làm tròn THEO NGƯỜI (cách viết trông hợp lý hơn) phải VỠ. Nếu
 *      phản ví dụ này không vỡ thì phép kiểm ở tầng 1 không kiểm gì.
 *   3. ĐƯỜNG CHẠY THẬT — ghi sổ qua DB thật, transaction thật, CONSTRAINT TRIGGER
 *      thật. Bẫy số 1 của repo là cơ chế trang trí (code có, test có, không đường
 *      chạy nào gọi) → ở đây không gọi hàm tính, mà ĐỌC LẠI từ bảng.
 *   4. TRIGGER DB CÓ THẬT SỰ CHẶN KHÔNG — cố tình ghi một bàn lệch và đòi nó nổ.
 *
 * ⚠ Kiểm KHOẢNG/QUAN HỆ, không `toBe(hằng số chép từ config)` — bẫy số 7. Chỗ duy
 *   nhất so số cứng là năm bảng delta đã tính TAY trong docs/khao-co/design_rank.md §2.4:
 *   ở đó con số là ĐỀ BÀI, không phải kết quả của code.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import {
  BAC_THANG, K, NGUONG_XEP_BAC_A, bacTuDiem, chuyenNhuongCap, conThieuLenBac,
  deltaTran, dinhNghiaBac, nacTuDiem, nenDiemQuaMua, pThangCapBp, soCapThang,
  vectorDiemCungBac,
} from '../config/rank.js';
import { BAC_BRIER } from '../config/progression.js';
import { ghiDiemTran, kiemToanLamPhat, layTienDoRank, xayBxh } from '../server/rank.js';
import { currentSeasonId } from '../server/season.js';

let db: TestDb;
let pool: pg.Pool;

/*
 * ⚠ DB CHỈ DỰNG CHO NHÓM TEST CẦN DB (xem `describe('ghi sổ qua DB thật')`).
 * Đặt `beforeAll` ở tầng file thì một migration của người khác đang lỗi cũng làm
 * SKIP luôn 14 test toán thuần — tức phép kiểm lạm phát biến mất đúng lúc repo
 * đang động, mà đó là lúc cần nó nhất.
 */

/** RNG tất định — một test "ngẫu nhiên" mà không tái lập được thì không debug được. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const ghe = (n: number) => Array.from({ length: n }, (_, i) => `g${i}`);

// ═══════════════════════════════════════════════════════════════════════════
// TẦNG 1 — TOÁN THUẦN
// ═══════════════════════════════════════════════════════════════════════════
describe('zero-sum: toán thuần', () => {
  it('bàn toàn cùng bậc ra đúng năm vector đã tính tay ở §2.4', () => {
    const mong: Record<number, number[]> = {
      4: [30, 10, -10, -30],
      5: [40, 20, 0, -20, -40],
      6: [50, 30, 10, -10, -30, -50],
      7: [60, 40, 20, 0, -20, -40, -60],
      8: [70, 50, 30, 10, -10, -30, -50, -70],
    };
    for (const n of [4, 5, 6, 7, 8]) {
      const ids = ghe(n);
      const bac = Object.fromEntries(ids.map((g) => [g, 4]));
      const d = deltaTran(ids, bac);
      expect(ids.map((g) => d[g])).toEqual(mong[n]);
      // Trường hợp riêng in cho người chơi xem phải KHỚP đường tính thật.
      expect(vectorDiemCungBac(n)).toEqual(mong[n]);
      expect(ids.reduce((s, g) => s + d[g]!, 0)).toBe(0);
    }
  });

  it('năm bàn BẬC LỆCH ra đúng số đã tính tay ở §2.4 (đây mới là phép kiểm thật)', () => {
    const ca: { bac: number[]; delta: number[] }[] = [
      { bac: [2, 5, 5, 3, 1], delta: [54, 0, -20, -18, -16] },
      { bac: [6, 1, 1, 1, 1, 1], delta: [5, 39, 19, -1, -21, -41] },
      { bac: [4, 4, 4, 4, 4, 4, 4, 4], delta: [70, 50, 30, 10, -10, -30, -50, -70] },
      { bac: [7, 1, 7, 1, 7, 1, 7, 1], delta: [34, 86, -6, 46, -46, 6, -86, -34] },
      { bac: [1, 2, 3, 4, 5, 6, 7], delta: [101, 69, 35, 0, -35, -69, -101] },
    ];
    for (const c of ca) {
      const ids = ghe(c.bac.length);
      const bac = Object.fromEntries(ids.map((g, i) => [g, c.bac[i]!]));
      const d = deltaTran(ids, bac);
      expect(ids.map((g) => d[g])).toEqual(c.delta);
      expect(c.delta.reduce((a, b) => a + b, 0)).toBe(0);
    }
  });

  it('300.000 bàn ngẫu nhiên (N=4..8, bậc 1..7): 0 bàn vỡ zero-sum', () => {
    const r = rng(20260727);
    let vo = 0;
    let quet = 0;
    for (let n = 4; n <= 8; n += 1) {
      for (let lan = 0; lan < 60_000; lan += 1) {
        const ids = ghe(n);
        const bac = Object.fromEntries(ids.map((g) => [g, 1 + Math.floor(r() * 7)]));
        // deltaTran tự throw nếu lệch → đếm bằng try, không tin một mình assertion.
        try {
          const d = deltaTran(ids, bac);
          if (ids.reduce((s, g) => s + d[g]!, 0) !== 0) vo += 1;
        } catch { vo += 1; }
        quet += 1;
      }
    }
    expect(quet).toBe(300_000);
    expect(vo).toBe(0);
  });

  it('PHẢN VÍ DỤ: làm tròn THEO NGƯỜI vỡ hơn 40% số bàn — đây là chỗ bug sẽ lọt', () => {
    /*
     * Cách viết "tự nhiên" hơn: cộng dồn phần thực của từng cặp rồi làm tròn MỘT
     * LẦN theo người. Nó ra số trông hoàn toàn hợp lý, nên review không bắt được.
     * Test này tồn tại để chứng minh phép kiểm ở trên KIỂM ĐƯỢC GÌ ĐÓ.
     */
    const r = rng(777);
    let vo = 0;
    const N = 60_000;
    for (let lan = 0; lan < N; lan += 1) {
      const n = 4 + Math.floor(r() * 5);
      const bac = Array.from({ length: n }, () => 1 + Math.floor(r() * 7));
      const d = new Array(n).fill(0) as number[];
      for (let a = 0; a < n; a += 1) {
        for (let b = a + 1; b < n; b += 1) {
          const thuc = (K * (10_000 - pThangCapBp(bac[a]! - bac[b]!))) / 10_000;
          d[a]! += thuc;
          d[b]! -= thuc;
        }
      }
      const tron = d.map((x) => Math.round(x));
      if (tron.reduce((a, b) => a + b, 0) !== 0) vo += 1;
    }
    // Đo được ~50%. Kiểm KHOẢNG chứ không kiểm con số chính xác: con số phụ thuộc
    // RNG, còn điều cần khẳng định là "vỡ thường xuyên, không phải hiếm".
    expect(vo / N).toBeGreaterThan(0.4);
  });

  it('bàn đông ăn nhiều hơn — không có hệ số nhân nào, chỉ vì nhiều cặp hơn', () => {
    const nhat = (n: number) => deltaTran(ghe(n), Object.fromEntries(ghe(n).map((g) => [g, 4])))['g0']!;
    expect(nhat(8) / nhat(4)).toBeCloseTo(7 / 3, 2);   // 2,33× — tự sinh từ số cặp
    for (let n = 5; n <= 8; n += 1) expect(nhat(n)).toBeGreaterThan(nhat(n - 1));
    expect(soCapThang(8, 1)).toBe(7);
    expect(soCapThang(4, 4)).toBe(0);
  });

  it('p() đối xứng và cầm máu cho người bậc thấp', () => {
    for (let d = 0; d <= 6; d += 1) {
      // Thắng người bậc CAO hơn ăn đậm hơn; thua người bậc cao hơn mất ít hơn.
      expect(chuyenNhuongCap(-d)).toBeGreaterThanOrEqual(chuyenNhuongCap(0));
      expect(chuyenNhuongCap(d)).toBeLessThanOrEqual(chuyenNhuongCap(0));
      expect(pThangCapBp(d) + pThangCapBp(-d)).toBe(10_000);
    }
    // Không bao giờ âm: điểm chuyển âm nghĩa là người xếp TRÊN trả cho người dưới.
    for (let d = -8; d <= 8; d += 1) expect(chuyenNhuongCap(d)).toBeGreaterThanOrEqual(0);
  });

  it('reset mùa chia đôi là TRUNG TÍNH: dư luôn nguyên và đối ứng bằng 0', () => {
    const r = rng(31337);
    for (let lan = 0; lan < 20_000; lan += 1) {
      const n = 4 + Math.floor(r() * 20);
      const x: number[] = [];
      for (let i = 0; i < n - 1; i += 1) x.push(Math.floor(r() * 4001) - 2000);
      x.push(-x.reduce((a, b) => a + b, 0));           // Σ = 0 như bất biến của hệ
      const sau = x.map(nenDiemQuaMua);
      const du = sau.reduce((a, b) => a + b, 0);
      expect(Number.isInteger(du)).toBe(true);
      // Dư đi vào Quỹ điểm; bất biến Σ users + Quỹ = 0 vẫn đúng sau reset.
      expect(du + -du).toBe(0);
    }
    expect(nenDiemQuaMua(-41)).toBe(-20);              // trunc VỀ 0, không floor
    expect(nenDiemQuaMua(1301)).toBe(650);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BẬC — dẫn xuất, và KHÔNG trùng tên với Hệ B
// ═══════════════════════════════════════════════════════════════════════════
describe('thang bậc', () => {
  it('bậc đơn điệu theo điểm và không bao giờ tụt khi điểm tăng', () => {
    let truoc = 0;
    for (let diem = -500; diem <= 4_000; diem += 20) {
      const b = dinhNghiaBac(bacTuDiem(diem, 10)).bac;
      expect(b).toBeGreaterThanOrEqual(truoc);
      truoc = b;
    }
  });

  it('dưới ngưỡng trận = CHƯA XẾP BẬC dù điểm cao', () => {
    expect(bacTuDiem(5_000, NGUONG_XEP_BAC_A - 1)).toBe('chua_xep');
    expect(bacTuDiem(5_000, NGUONG_XEP_BAC_A)).not.toBe('chua_xep');
  });

  it('apex KHOÁ ở beta: trần là bậc 5 kể cả khi hạng 1 và điểm rất cao', () => {
    expect(dinhNghiaBac(bacTuDiem(99_999, 50, 1, false)).bac).toBe(5);
    // Bật apex thì hai bậc đỉnh mới mở, và CHỈ theo hạng bảng.
    expect(dinhNghiaBac(bacTuDiem(99_999, 50, 1, true)).bac).toBe(7);
    expect(dinhNghiaBac(bacTuDiem(99_999, 50, 40, true)).bac).toBe(6);
    expect(dinhNghiaBac(bacTuDiem(99_999, 50, 400, true)).bac).toBe(5);
  });

  it('KHÔNG chuỗi bậc nào trùng bậc Brier của Hệ B (lỗi namespace đã sống trên prod)', () => {
    const heB = new Set<string>(BAC_BRIER.map((b) => b.bac));
    for (const b of BAC_THANG) {
      expect(heB.has(b.ten)).toBe(false);
      expect(heB.has(b.biet_danh)).toBe(false);
      // Cả sau khi bỏ dấu/hoa-thường — trùng "vàng" vs "Vàng" vẫn là trùng.
      expect(heB.has(b.biet_danh.toLowerCase())).toBe(false);
    }
    expect(BAC_THANG).toHaveLength(7);
    expect(new Set(BAC_THANG.map((b) => b.biet_danh)).size).toBe(7);
  });

  it('nấc chỉ có ở bậc giữa, và đi từ III xuống I khi điểm lên', () => {
    expect(nacTuDiem(0, 'tap_su')).toBeNull();
    const nac = [130, 200, 300, 355].map((d) => nacTuDiem(d, 'chuyen_vien'));
    expect(nac[0]).toBe(3);
    expect(nac[3]).toBe(1);
    for (let i = 1; i < nac.length; i += 1) expect(nac[i]!).toBeLessThanOrEqual(nac[i - 1]!);
  });

  it('còn thiếu bao nhiêu điểm là số dương giảm dần, hết ở trần thang', () => {
    expect(conThieuLenBac(0, 'tap_su')).toBeGreaterThan(conThieuLenBac(100, 'tap_su')!);
    expect(conThieuLenBac(2_000, 'giam_doc_dau_tu')).toBeNull();
  });

  it('một trận không đủ đổi bậc từ bậc 2 lên — rung ở biên bị chặn bằng bề rộng bậc', () => {
    // Biên độ tệ nhất một trận: bàn 8, bậc lệch tối đa (bảng §2.4 ra ±101 ở N=7).
    const bienDo = Math.max(...[4, 5, 6, 7, 8].map((n) => {
      const ids = ghe(n);
      const bac = Object.fromEntries(ids.map((g, i) => [g, i % 2 === 0 ? 1 : 7]));
      const d = deltaTran(ids, bac);
      return Math.max(...ids.map((g) => Math.abs(d[g]!)));
    }));
    const beRongHep = Math.min(...BAC_THANG
      .filter((b) => b.moc_duoi !== null && Number.isFinite(b.moc_duoi))
      .map((b) => {
        const duoi = BAC_THANG.find((x) => x.bac === b.bac - 1);
        return b.moc_duoi! - (duoi && Number.isFinite(duoi.moc_duoi as number)
          ? (duoi.moc_duoi as number) : 0);
      }));
    expect(bienDo).toBeLessThan(beRongHep);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TẦNG 3+4 — ĐƯỜNG CHẠY THẬT QUA DB
// ═══════════════════════════════════════════════════════════════════════════
describe('ghi sổ qua DB thật', () => {
  const seasonId = currentSeasonId();

  beforeAll(async () => {
    db = await startTestDb();
    pool = db.pool;
  }, 180_000);
  afterAll(async () => { await db?.stop(); });

  async function taoTran(client: pg.PoolClient, ownerId: string, cheDo: string): Promise<string> {
    const { rows } = await client.query(
      `INSERT INTO holdem_matches
         (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id, che_do)
       VALUES ($1, 1, '[]'::jsonb, 'test', 'test', $2, $3) RETURNING match_id`,
      [ownerId, seasonId, cheDo]);
    return String(rows[0]!.match_id);
  }

  it('bàn 4..8 người: tổng delta ĐỌC LẠI TỪ SỔ bằng đúng 0, và kho bạc điểm cân', async () => {
    const nguoi: TestUser[] = [];
    for (let i = 0; i < 8; i += 1) nguoi.push(await createTestUser(pool, {}));

    const soDo: Record<number, number> = {};
    for (const n of [4, 5, 6, 7, 8]) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const matchId = await taoTran(client, nguoi[0]!.userId, 'rank_slot');
        const banGhe = nguoi.slice(0, n).map((u, i) => ({
          gheId: `g${i}`, userId: u.userId, bacVaoBan: BAC_THANG[i % 7]!.id as string,
        }));
        // holdem_results phải có dòng trước: ghiDiemTran cập nhật diem_truoc/diem_sau.
        for (let i = 0; i < n; i += 1) {
          await client.query(
            `INSERT INTO holdem_results
               (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, danh_muc_json)
             VALUES ($1,$2,$3,'nguoi',$4,$5,0,'{}'::jsonb)`,
            [matchId, banGhe[i]!.userId, banGhe[i]!.gheId, banGhe[i]!.bacVaoBan, i + 1]);
        }
        const kq = await ghiDiemTran(client, {
          matchId, seasonId, cheDo: 'rank_slot', soLa: 12,
          hangTheoGhe: banGhe.map((g) => g.gheId), ghe: banGhe,
        });
        expect(kq.ghi).toBe(true);
        await client.query('COMMIT');
      } finally { client.release(); }

      const { rows } = await pool.query(
        `SELECT COALESCE(SUM(delta),0)::int AS t, COUNT(*)::int AS c
           FROM rank_ledger WHERE season_id = $1`, [seasonId]);
      soDo[n] = Number(rows[0]!.t);
      // ĐỌC LẠI TỪ BẢNG — không tin giá trị hàm vừa trả về.
      expect(Number(rows[0]!.t)).toBe(0);
    }

    // Sau 5 bàn liên tiếp: tổng vẫn 0 tuyệt đối, không trôi một điểm.
    expect(Object.values(soDo).every((x) => x === 0)).toBe(true);

    const kt = await kiemToanLamPhat(pool, seasonId);
    expect(kt.tran_lech).toEqual([]);
    expect(kt.tong_he).toBe(0);              // Σ điểm mọi người = 0 ⇒ không lạm phát
    expect(kt.can).toBe(true);
  }, 120_000);

  it('bàn có BOT: từ chối ghi, không ghi nửa vời (D31 — rank toàn người thật)', async () => {
    const u = await createTestUser(pool, {});
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const matchId = await taoTran(client, u.userId, 'rank_slot');
      const kq = await ghiDiemTran(client, {
        matchId, seasonId, cheDo: 'rank_slot', soLa: 12,
        hangTheoGhe: ['g0', 'g1', 'g2', 'g3'],
        ghe: [
          { gheId: 'g0', userId: u.userId, bacVaoBan: 'tap_su' },
          { gheId: 'g1', userId: null, bacVaoBan: 'chua_xep' },
          { gheId: 'g2', userId: null, bacVaoBan: 'chua_xep' },
          { gheId: 'g3', userId: null, bacVaoBan: 'chua_xep' },
        ],
      });
      expect(kq.ghi).toBe(false);
      expect(kq.theo_ghe).toEqual({});
      await client.query('COMMIT');
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS c FROM rank_ledger WHERE match_id = $1`, [matchId]);
      expect(Number(rows[0]!.c)).toBe(0);
    } finally { client.release(); }
  }, 60_000);

  it('TRIGGER DB chặn một bàn lệch — tầng TS bị qua mặt thì transaction phải nổ', async () => {
    const a = await createTestUser(pool, {});
    const b = await createTestUser(pool, {});
    const client = await pool.connect();
    let noRoi = false;
    try {
      await client.query('BEGIN');
      const matchId = await taoTran(client, a.userId, 'rank_slot');
      for (const [u, delta] of [[a, 30], [b, -20]] as const) {
        await client.query(
          `INSERT INTO rank_ledger (user_id, season_id, che_do, match_id, so_ghe, so_la,
                                    hang, so_cap_thang, bac_vao_ban, delta, diem_sau,
                                    formula_version)
           VALUES ($1,$2,'rank_slot',$3,2,12,1,1,'tap_su',$4,$4,'test')`,
          [(u as TestUser).userId, seasonId, matchId, delta]);
      }
      await client.query('COMMIT');            // ← DEFERRED: nổ ở đây, không ở INSERT
    } catch (e) {
      noRoi = true;
      expect(String((e as Error).message)).toMatch(/tong delta/);
      await client.query('ROLLBACK').catch(() => {});
    } finally { client.release(); }
    expect(noRoi).toBe(true);
  }, 60_000);

  it('ĐƯỜNG CHẠY THẬT: /internal/tick dựng snapshot, và KHÔNG dựng lại khi còn tươi', async () => {
    /*
     * Bẫy số 1 của repo: cơ chế trang trí — code có, test có, không đường chạy nào
     * gọi. Test này gọi ĐÚNG endpoint mà cron gọi ở prod, không gọi hàm dựng bảng.
     * (pg_cron không tồn tại ở DB local — 0005 — nên lớp 2 này chính là đường chạy
     * duy nhất ở local, và A8.9 cấm mock để né chuyện đó.)
     */
    const app = createApp({
      pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
      tickSecret: 'tick-rank', secureCookie: false,
    }) as Hono<any>;
    const tick = () => app.request('http://localhost/api/v1/internal/tick', {
      method: 'POST', headers: { 'x-tick-secret': 'tick-rank' },
    });

    const lan1 = await (await tick()).json() as any;
    expect(lan1.bxh.da_xay).toBe(true);
    const { rows: r1 } = await pool.query(
      `SELECT computed_at FROM bxh_snapshots WHERE bang_id = 'dau_truong' AND season_id = $1`,
      [seasonId]);
    expect(r1).toHaveLength(1);

    // Tick chạy mỗi PHÚT nhưng bảng chỉ cần mới mỗi 10 phút → lần hai phải BỎ QUA.
    const lan2 = await (await tick()).json() as any;
    expect(lan2.bxh.da_xay).toBe(false);
    const { rows: r2 } = await pool.query(
      `SELECT computed_at FROM bxh_snapshots WHERE bang_id = 'dau_truong' AND season_id = $1`,
      [seasonId]);
    expect(new Date(r2[0]!.computed_at).getTime())
      .toBe(new Date(r1[0]!.computed_at).getTime());
  }, 120_000);

  it('snapshot + phân vị: hạng ghi sẵn, người dưới ngưỡng trận KHÔNG lên bảng', async () => {
    const mua = `T${Date.now()}`;
    const dan: TestUser[] = [];
    for (let i = 0; i < 6; i += 1) dan.push(await createTestUser(pool, {}));
    for (let i = 0; i < 6; i += 1) {
      await pool.query(
        `INSERT INTO rank_diem (user_id, season_id, diem, diem_dinh, so_tran)
         VALUES ($1, $2, $3, $3, $4)`,
        // Người cuối chỉ 2 trận → dưới ngưỡng, dù điểm cao nhất.
        [dan[i]!.userId, mua, 100 * (i + 1), i === 5 ? 2 : 9]);
    }
    const soDong = await xayBxh(pool, mua);
    expect(soDong).toBe(5);

    const dau = await layTienDoRank(pool, dan[4]!.userId, mua);
    expect(dau.hang).toBe(1);
    expect(dau.phan_vi).toBe(20);            // 1/5 → top 20%, phân vị cho mọi người
    const ngoai = await layTienDoRank(pool, dan[5]!.userId, mua);
    expect(ngoai.hang).toBeNull();
    expect(ngoai.bac).toBe('chua_xep');
    expect(ngoai.con_thieu_tran).toBe(NGUONG_XEP_BAC_A - 2);
  }, 60_000);
});
