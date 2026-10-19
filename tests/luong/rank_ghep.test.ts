/**
 * LUỒNG NGƯỜI CHƠI — GHÉP BÀN XẾP HẠNG ≥ 4 NGƯỜI THẬT, đi ĐÚNG đường web đi (SPEC alpha-draft-tang-khong-gian mục 6 · mục 5b.3).
 *
 *   A. cờ TẮT (mặc định): mọi cửa ghép bàn đóng và nói đúng một câu "cần ≥ 4 người thật"; xếp hạng cũ (`rank_pve`) vẫn chạy như beta.
 *   B. cờ BẬT: `rank_pve` bị đóng (không còn bàn toàn máy); khách / chưa đồng ý không đăng ký được.
 *   C. ĐƯỜNG CHÍNH: 5 người đăng ký (HTTP) → tick ghép → mỗi người đọc trạng thái → bấm vào bàn (HTTP) → một người chơi HẾT 13 vòng, hai người
 *      đầu hàng, hai người vắng → bàn hết hạn → tick chốt → điểm CHỈ người–người, zero-sum đọc từ sổ, người vắng về đáy.
 *   D. 3 người ⇒ tick báo "chưa đủ người", không bàn nào; /internal/tick có dây tới ghép bàn (ghép một suất đã tới giờ bằng đồng hồ THẬT).
 *
 * Thời gian: hàm ghép nhận `now` nên bài "dịch đồng hồ" bằng tham số (không sửa giờ hệ thống); riêng đoạn D dùng suất ĐÃ QUA thật + tick HTTP.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../../server/app.js';
import { CapturingMailer } from '../../server/email.js';
import { startTestDb, type TestDb } from '../helpers/testdb.js';
import { createTestUser, type TestUser } from '../helpers/fixtures.js';
import { chotBanQuaHan, ghepCacSuat } from '../../server/rank_ghep.js';
import { RANK_GHEP_KHOA_LUAT, THONG_BAO_CAN_NGUOI } from '../../config/rank_ghep.js';
import { kiemToanLamPhat } from '../../server/rank.js';
import { currentSeasonId } from '../../server/season.js';

let db: TestDb; let pool: pg.Pool; let app: Hono<any>;
const TICK = 'tick-rank-ghep';
const SECRET = 'secret-luong-ghep-0078';

beforeAll(async () => {
  db = await startTestDb(); pool = db.pool;
  app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://x.test', tickSecret: TICK, secureCookie: false }) as Hono<any>;
}, 180_000);
afterAll(async () => { await db?.stop(); });
afterEach(() => { delete process.env.RANK_GHEP_BAT; delete process.env.SLOT_SHUFFLE_SECRET; });

const goi = (cookie: string, p: string, init: RequestInit = {}) =>
  app.request(`http://localhost${p}`, { ...init, headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) } });
const lay = async (cookie: string, p: string, init: RequestInit = {}): Promise<{ s: number; b: any }> => {
  const r = await goi(cookie, p, init);
  return { s: r.status, b: await r.json().catch(() => ({})) };
};
const batCo = () => { process.env.RANK_GHEP_BAT = '1'; process.env.SLOT_SHUFFLE_SECRET = SECRET; };
const tick = async () => (await app.request('http://localhost/api/v1/internal/tick', { method: 'POST', headers: { 'x-tick-secret': TICK } })).json() as Promise<any>;

describe('A. cờ TẮT (mặc định) — cửa đóng, xếp hạng beta nguyên vẹn', () => {
  it('⭐ đăng ký · rút · vào bàn đều bị đóng với MỘT câu nói thẳng "≥ 4 người thật"; GET trạng thái vẫn 200 (phân biệt "chưa mở" với "lỗi")', async () => {
    const u = await createTestUser(pool, {});
    const dk = await lay(u.cookie, '/api/v1/holdem/rank/suat', { method: 'POST' });
    expect(dk.s).toBe(403);
    expect(dk.b.error).toBe('ghep_ban_chua_mo');
    expect(dk.b.message).toBe(THONG_BAO_CAN_NGUOI);
    expect(dk.b.message).toContain('4 người thật');
    expect((await lay(u.cookie, '/api/v1/holdem/rank/suat', { method: 'DELETE' })).s).toBe(403);
    expect((await lay(u.cookie, '/api/v1/holdem/rank/vao', { method: 'POST' })).s).toBe(403);
    const me = await lay(u.cookie, '/api/v1/holdem/rank/suat/me');
    expect(me.s).toBe(200);
    expect(me.b.bat).toBe(false);
    expect(me.b.trang_thai).toBe('khong');
    const { rows } = await pool.query(`SELECT count(*)::int AS c FROM rank_dang_ky WHERE user_id = $1`, [u.userId]);
    expect(rows[0].c).toBe(0);
  });

  it('⭐ cờ tắt ⇒ xếp hạng beta (`rank_pve`) vẫn tạo được trận như trước — tính năng mới không làm hỏng đường cũ', async () => {
    const u = await createTestUser(pool, {});
    const t = await lay(u.cookie, '/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ che_do: 'rank_pve' }) });
    expect(t.s).toBe(201);
    const { rows } = await pool.query(`SELECT che_do, balance_version FROM holdem_matches WHERE match_id = $1`, [t.b.match_id]);
    expect(rows[0].che_do).toBe('rank_pve');
    expect(rows[0].balance_version).not.toBe(RANK_GHEP_KHOA_LUAT);
  });

  it('tick với cờ tắt không đụng bảng ghép nào (ghep_ban = null)', async () => {
    const r = await tick();
    expect(r.ok).toBe(true);
    expect(r.ghep_ban).toBeNull();
  });
});

describe('B. cờ BẬT — không còn bàn toàn máy; cổng khách & đồng ý', () => {
  it('⭐ `rank_pve` bị đóng với câu "cần ≥ 4 người thật" (409) — bấm XẾP HẠNG không bao giờ vào bàn toàn máy', async () => {
    batCo();
    const u = await createTestUser(pool, {});
    const t = await lay(u.cookie, '/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ che_do: 'rank_pve' }) });
    expect(t.s).toBe(409);
    expect(t.b.error).toBe('xep_hang_can_ghep_ban');
    expect(t.b.message).toBe(THONG_BAO_CAN_NGUOI);
    // Chế độ TỰ DO (không điểm) vẫn vào được — "gợi ý ĐẤU TỰ DO" là lối thoát thật.
    const tuDo = await lay(u.cookie, '/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({}) });
    expect(tuDo.s).toBe(201);
  });

  it('chưa đồng ý điều khoản ⇒ 403 chua_dong_y; không có dòng đăng ký', async () => {
    batCo();
    const u = await createTestUser(pool, {});
    await pool.query(`UPDATE users SET research_consent = false WHERE user_id = $1`, [u.userId]);
    const r = await lay(u.cookie, '/api/v1/holdem/rank/suat', { method: 'POST' });
    expect(r.s).toBe(403);
    expect(r.b.error).toBe('chua_dong_y');
    const { rows } = await pool.query(`SELECT count(*)::int AS c FROM rank_dang_ky WHERE user_id = $1`, [u.userId]);
    expect(rows[0].c).toBe(0);
  });

  it('chưa đăng nhập ⇒ 401 ở cả ba cửa', async () => {
    batCo();
    for (const [m, p] of [['POST', '/api/v1/holdem/rank/suat'], ['DELETE', '/api/v1/holdem/rank/suat'], ['GET', '/api/v1/holdem/rank/suat/me'], ['POST', '/api/v1/holdem/rank/vao']] as const) {
      const r = await app.request(`http://localhost${p}`, { method: m });
      expect(r.status, `${m} ${p}`).toBe(401);
    }
  });

  it('người chưa có bàn bấm vào bàn ⇒ 404 khong_co_ban', async () => {
    batCo();
    const u = await createTestUser(pool, {});
    const r = await lay(u.cookie, '/api/v1/holdem/rank/vao', { method: 'POST' });
    expect(r.s).toBe(404);
    expect(r.b.error).toBe('khong_co_ban');
  });
});

describe('C. ĐƯỜNG CHÍNH — 5 người: đăng ký → ghép → vào bàn → chơi / đầu hàng / vắng → chốt điểm', () => {
  const HAN = (id: string) => pool.query(`UPDATE rank_ban SET han_luc = now() - interval '1 minute' WHERE ban_id = $1`, [id]);
  const post = (cookie: string, p: string, body: unknown) => lay(cookie, p, { method: 'POST', body: JSON.stringify(body) });
  const quaMan = (id: string) => pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '60 seconds' WHERE match_id = $1`, [id]);
  const luiMan = async (id: string, vong: number) => {
    const r = await pool.query('DELETE FROM holdem_minigame_man WHERE match_id = $1 AND vong = $2 RETURNING boi_canh, phien_ban', [id, vong]);
    if (!r.rows[0]) return;
    await pool.query(
      `INSERT INTO holdem_minigame_man (match_id, vong, phien_ban, boi_canh, bat_dau) VALUES ($1, $2, $3, $4, now() - interval '60 seconds')`,
      [id, vong, r.rows[0].phien_ban, JSON.stringify(r.rows[0].boi_canh)]);
  };
  const nopVong = (u: TestUser, id: string, vong: number, them: Record<string, unknown> = {}) =>
    lay(u.cookie, `/api/v1/holdem/matches/${id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, ...them }) });

  /** Đi HẾT 13 vòng như người chơi thật (lùi mốc qua phần màn, mở & qua màn lõi) tới khi server khép trận. */
  async function choiHetTran(u: TestUser, id: string): Promise<void> {
    for (let v = 1; v <= 13; v += 1) {
      if (v > 1) await quaMan(id);
      const g = await lay(u.cookie, `/api/v1/holdem/matches/${id}`);
      expect(g.b.vong, `trạng thái vòng ${v}`).toBe(v);
      const r = await nopVong(u, id, v, { lenh: [{ ma: 'vang', chieu: 'mua', moc_bp: 1000 }] });
      expect(r.b.error, `vòng ${v}: ${JSON.stringify(r.b).slice(0, 200)}`).toBeUndefined();
      if (r.b.cho_man) {
        const mo = await post(u.cookie, `/api/v1/holdem/matches/${id}/minigame`, { vong: v });
        if (mo.s === 200) await luiMan(id, v);
      }
    }
    await quaMan(id);
    const g = await lay(u.cookie, `/api/v1/holdem/matches/${id}`);
    expect(g.b.status).toBe('xong');
  }

  it('⭐ trọn vòng đời một bàn 5 người', async () => {
    batCo();
    const nguoi: TestUser[] = [];
    for (let i = 0; i < 5; i += 1) nguoi.push(await createTestUser(pool, {}));

    // 1) ĐĂNG KÝ qua HTTP: 201, có giờ ghép đúng :00/:15/:30/:45, KHÔNG có số người đăng ký; bấm lại = 200 cùng suất.
    let slot = '';
    for (const u of nguoi) {
      const r = await lay(u.cookie, '/api/v1/holdem/rank/suat', { method: 'POST' });
      expect(r.s).toBe(201);
      slot = r.b.slot;
      expect(new Date(slot).getUTCMinutes() % 15).toBe(0);
      expect(new Date(slot).getTime()).toBeGreaterThan(Date.now());
      expect(JSON.stringify(r.b)).not.toMatch(/so_dang_ky|so_nguoi\b|dang_ky_hien_tai/);
    }
    const lai = await lay(nguoi[0]!.cookie, '/api/v1/holdem/rank/suat', { method: 'POST' });
    expect(lai.s).toBe(200);
    expect(lai.b.da_co).toBe(true);
    expect((await lay(nguoi[0]!.cookie, '/api/v1/holdem/rank/suat/me')).b).toMatchObject({ bat: true, trang_thai: 'cho', slot });

    // 2) TỚI GIỜ — đúng hàm /internal/tick gọi; "giờ" dịch bằng tham số.
    const kq = await ghepCacSuat(pool, new Date(new Date(slot).getTime() + 1000));
    expect(kq.ban_moi).toBe(1);
    const me0 = await lay(nguoi[0]!.cookie, '/api/v1/holdem/rank/suat/me');
    expect(me0.b.trang_thai).toBe('da_ghep');
    expect(me0.b.ban.so_nguoi).toBe(5);
    expect(me0.b.ban.so_may).toBeLessThanOrEqual(4);
    expect(me0.b.ban.so_may).toBeLessThan(me0.b.ban.so_nguoi);
    expect(me0.b.ban.match_id).toBeNull();
    expect(JSON.stringify(me0.b)).not.toContain('seed');

    // 3) VÀO BÀN: mỗi người MỘT trận riêng, cùng seed · cùng số ghế · cùng bộ vai; bấm đúp = cùng trận.
    const ban = (await pool.query(`SELECT * FROM rank_ban WHERE slot_id = $1::timestamptz`, [slot])).rows[0]!;
    const tran: string[] = [];
    for (const u of nguoi) {
      const v = await post(u.cookie, '/api/v1/holdem/rank/vao', {});
      expect(v.s, JSON.stringify(v.b).slice(0, 200)).toBe(201);
      expect(v.b.match_id).toBeTruthy();
      tran.push(v.b.match_id);
      const v2 = await post(u.cookie, '/api/v1/holdem/rank/vao', {});
      expect(v2.s).toBe(200);
      expect(v2.b.match_id).toBe(v.b.match_id);
    }
    expect(new Set(tran).size).toBe(5);
    const { rows: ms } = await pool.query(
      `SELECT match_id, seed, che_do, balance_version, ghe_json, owner_user_id FROM holdem_matches WHERE match_id = ANY($1::uuid[])`, [tran]);
    expect(ms).toHaveLength(5);
    const vaiBan = [...(ban.vai_json as string[])].sort();
    for (const m of ms) {
      expect(Number(m.seed)).toBe(Number(ban.seed));
      expect(m.che_do).toBe('rank_slot');
      expect(m.balance_version).toBe(RANK_GHEP_KHOA_LUAT);
      expect(m.ghe_json).toHaveLength(ban.so_ghe);
      expect(m.ghe_json[0].id).toBe('ban');
      // Tập vai cả bàn là MỘT: gộp vai mọi ghế của trận này phải bằng vai_json của bàn (chỉ khác ai cầm vai nào).
      expect(m.ghe_json.map((g: any) => g.vai).sort()).toEqual(vaiBan);
    }
    // Người ngoài bàn không vào được: 404. Người ở bàn nhưng bàn đã có trận trả trận cũ (đã kiểm ở trên).
    const ngoai = await createTestUser(pool, {});
    expect((await post(ngoai.cookie, '/api/v1/holdem/rank/vao', {})).s).toBe(404);
    // Đã ngồi bàn thì không đăng ký thêm suất.
    expect((await lay(nguoi[1]!.cookie, '/api/v1/holdem/rank/suat', { method: 'POST' })).s).toBe(409);

    // 4) CHƠI: nguoi[0] chơi HẾT 13 vòng · nguoi[1], nguoi[2] đầu hàng ở vòng 2 · nguoi[3], nguoi[4] vào bàn rồi bỏ đó (vắng).
    await choiHetTran(nguoi[0]!, tran[0]!);
    for (const i of [1, 2]) {
      await nopVong(nguoi[i]!, tran[i]!, 1);
      const dh = await nopVong(nguoi[i]!, tran[i]!, 2, { hanh_dong: 'dau_hang', cuoc: [{ loai: 'bo' }] });
      expect(dh.s).toBe(200);
      expect(dh.b.xong).toBe(true);
    }
    const xong = await pool.query(
      `SELECT user_id, xong, dau_hang, nav_cuoi FROM rank_ban_nguoi WHERE ban_id = $1`, [ban.ban_id]);
    const theoU = new Map(xong.rows.map((r) => [r.user_id, r]));
    expect(theoU.get(nguoi[0]!.userId)!.xong).toBe(true);
    expect(theoU.get(nguoi[0]!.userId)!.dau_hang).toBe(false);
    expect(theoU.get(nguoi[1]!.userId)!.dau_hang).toBe(true);
    expect(theoU.get(nguoi[3]!.userId)!.xong).toBe(false);
    // NAV ghi vào chỗ ngồi = NAV cuối trong holdem_results (một nguồn).
    const nav0 = (await pool.query(`SELECT von_cuoi FROM holdem_results WHERE match_id = $1 AND ghe_id = 'ban'`, [tran[0]])).rows[0]!.von_cuoi;
    expect(Number(theoU.get(nguoi[0]!.userId)!.nav_cuoi)).toBe(Math.trunc(Number(nav0)));

    // Còn người chưa xong và chưa hết hạn ⇒ CHƯA chia điểm.
    expect((await pool.query(`SELECT count(*)::int AS c FROM rank_ledger WHERE ban_id = $1`, [ban.ban_id])).rows[0].c).toBe(0);
    expect((await chotBanQuaHan(pool, new Date())).chot).toBe(0);

    // 5) HẾT HẠN — tick chốt (không cần ai mở app, C3). Dùng tick HTTP thật.
    await HAN(ban.ban_id);
    const t = await tick();
    expect(t.ghep_ban.chot.chot).toBeGreaterThanOrEqual(1);
    const sổ = (await pool.query(
      `SELECT user_id, delta, hang, match_id FROM rank_ledger WHERE ban_id = $1`, [ban.ban_id])).rows;
    expect(sổ).toHaveLength(5);
    expect(sổ.reduce((a, r) => a + r.delta, 0)).toBe(0);
    const theoS = new Map(sổ.map((r) => [r.user_id, r]));
    expect(theoS.get(nguoi[0]!.userId)!.hang).toBe(1);                                   // người chơi hết trận đứng đầu
    expect(theoS.get(nguoi[0]!.userId)!.delta).toBeGreaterThan(0);
    expect(theoS.get(nguoi[1]!.userId)!.hang).toBe(2);                                   // đầu hàng: tầng riêng dưới người chơi hết trận
    expect(theoS.get(nguoi[2]!.userId)!.hang).toBe(2);                                   // hai người đầu hàng HOÀ nhau (cùng tầng)
    expect(theoS.get(nguoi[3]!.userId)!.hang).toBe(4);                                   // vắng: đáy (sau 1 người chơi hết trận + 2 người đầu hàng)
    expect(theoS.get(nguoi[3]!.userId)!.delta).toBeLessThan(0);
    // Sổ tổng: không lạm phát.
    const kt = await kiemToanLamPhat(pool, currentSeasonId());
    expect(kt.tran_lech).toEqual([]);
    // Trạng thái cuối người chơi đọc được: bàn đã đóng.
    const cuoi = await lay(nguoi[3]!.cookie, '/api/v1/holdem/rank/suat/me');
    expect(cuoi.b.ban.ban_trang_thai).toBe('da_chot');
    // Sau khi chốt, đăng ký suất mới lại được.
    expect((await lay(nguoi[3]!.cookie, '/api/v1/holdem/rank/suat', { method: 'POST' })).s).toBe(201);
    // Vào bàn đã chốt: không còn bàn mở.
    expect((await post(nguoi[4]!.cookie, '/api/v1/holdem/rank/vao', {})).s).toBe(404);
  }, 900_000);
});

describe('D. suất thiếu người + dây tick', () => {
  it('⭐ 3 người ⇒ KHÔNG bàn; tick báo thiếu người; người dùng thấy "Suất này chưa đủ người." với hai lối: giữ suất · đấu tự do', async () => {
    batCo();
    const nguoi: TestUser[] = [];
    for (let i = 0; i < 3; i += 1) nguoi.push(await createTestUser(pool, {}));
    // Suất ĐÃ QUA thật (không cần dịch đồng hồ): dựng thẳng như thể họ đã đăng ký từ 20 phút trước, rồi để tick HTTP ghép bằng giờ THẬT.
    const qua = new Date(Math.floor((Date.now() - 20 * 60_000) / 900_000) * 900_000);
    await pool.query(`INSERT INTO rank_suat (slot_id, season_id) VALUES ($1::timestamptz, $2)`, [qua.toISOString(), currentSeasonId()]);
    for (const u of nguoi) {
      await pool.query(`INSERT INTO rank_dang_ky (slot_id, user_id, diem_ghep, bac_so) VALUES ($1::timestamptz, $2, 0, 0)`, [qua.toISOString(), u.userId]);
    }
    const r = await tick();
    expect(r.ghep_ban.suat_thieu_nguoi).toBeGreaterThanOrEqual(1);
    expect(r.ghep_ban.ban_moi).toBe(0);
    const me = await lay(nguoi[0]!.cookie, '/api/v1/holdem/rank/suat/me');
    expect(me.b.trang_thai).toBe('thieu_nguoi');
    expect(me.b.thong_bao).toBe('Suất này chưa đủ người.');
    expect(me.b.lua_chon).toEqual(['giu_suat', 'dau_tu_do']);
    expect((await pool.query(`SELECT count(*)::int AS c FROM rank_ban WHERE slot_id = $1::timestamptz`, [qua.toISOString()])).rows[0].c).toBe(0);
    // "Giữ suất" = đăng ký lại sang suất kế.
    const giu = await lay(nguoi[0]!.cookie, '/api/v1/holdem/rank/suat', { method: 'POST' });
    expect(giu.s).toBe(201);
    expect(new Date(giu.b.slot).getTime()).toBeGreaterThan(Date.now());
    // "Đấu tự do" vào được ngay, không điểm.
    const tuDo = await lay(nguoi[1]!.cookie, '/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({}) });
    expect(tuDo.s).toBe(201);
  }, 120_000);

  it('⭐ 4 người ở suất đã qua ⇒ tick HTTP thật ghép ra 1 bàn có máy < người (dây /internal/tick → ghepCacSuat chạy thật)', async () => {
    batCo();
    const nguoi: TestUser[] = [];
    for (let i = 0; i < 4; i += 1) nguoi.push(await createTestUser(pool, {}));
    const qua = new Date(Math.floor((Date.now() - 35 * 60_000) / 900_000) * 900_000);
    await pool.query(`INSERT INTO rank_suat (slot_id, season_id) VALUES ($1::timestamptz, $2) ON CONFLICT DO NOTHING`, [qua.toISOString(), currentSeasonId()]);
    for (const u of nguoi) {
      await pool.query(`INSERT INTO rank_dang_ky (slot_id, user_id, diem_ghep, bac_so) VALUES ($1::timestamptz, $2, 0, 0)`, [qua.toISOString(), u.userId]);
    }
    const r = await tick();
    expect(r.ghep_ban.ban_moi).toBe(1);
    const ban = (await pool.query(`SELECT so_nguoi, so_may FROM rank_ban WHERE slot_id = $1::timestamptz`, [qua.toISOString()])).rows[0]!;
    expect(ban.so_nguoi).toBe(4);
    expect(ban.so_may).toBeLessThanOrEqual(3);
    // Tick chạy lần hai: không ghép lại.
    expect((await tick()).ghep_ban.ban_moi).toBe(0);
    // thiếu secret trên prod ⇒ tick vẫn 200 (không sập), ghi nhận lỗi cấu hình
    delete process.env.SLOT_SHUFFLE_SECRET;
    const khongSecret = await tick();
    expect(khongSecret.ok).toBe(true);
    expect(khongSecret.ghep_ban.loi).toBe('thieu_secret');
  }, 120_000);
});
