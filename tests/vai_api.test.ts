/**
 * VAI BẤT ĐỐI XỨNG — bước 1 qua API THẬT: nhãn vào sơ đồ ghế + `hd_match_start`.
 *
 * ⚠ Bước này CHƯA đổi chip. Thứ bị khoá ở đây là RANH GIỚI:
 *   §I  map 8 KHÔNG có vai (mẫu đối chứng thuần — D85/D86);
 *   §II map 12 có vai, ghi vào `ghe_json` VÀ nhãn lên `hd_match_start.vai`
 *       (append-only: nhãn phải có mặt TRƯỚC khi cơ chế bật, không gắn sau được);
 *   §III người chơi chỉ nhận vai cho-người mùa này.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { VAI } from '../server/holdem/vai.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, moCuaAdmin, type TestUser } from './helpers/fixtures.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let U: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-vai', secureCookie: false,
  }) as Hono<any>;
  U = await createTestUser(pool);
  // Mở khoá map 12 (cần 3 trận xong — D86).
  for (let i = 0; i < 3; i++) {
    const m = await pool.query(
      `INSERT INTO holdem_matches (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id, che_do, status)
       VALUES ($1, $2, '[]'::jsonb, 'x', 'x', 1, 'tu_do', 'xong') RETURNING match_id`, [U.userId, 5000 + i]);
    await pool.query(
      `INSERT INTO holdem_results (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json)
       VALUES ($1, $2, 'ban', 'nguoi', 'tom', 1, 10000, 8, '{}'::jsonb)`, [m.rows[0].match_id, U.userId]);
  }
}, 120_000);

afterAll(async () => { await db?.stop(); });

/*
 * D406 — mặc định lật sang v54 (vốn đều · chỉ bàn 16 · vai số riêng). Bài này đo LUẬT VAI của v53: map 8 đối chứng
 * không vai, Cá Mập/Đội Lái vốn ×3 — luật ấy vẫn sống ở bàn tập (`khoaBanTap` ghim v53). Nên ghim v53 ở một chỗ, trừ
 * khi bài tự xin khoá khác. Luật vai của v54 (vốn đều) được canh ở `luoc_bo_v54.test.ts` + `luoc_bo_v54_api.test.ts`.
 */
const KHOA_BAI = 'balance-v53-upo';

async function taoTran(body: Record<string, unknown>, cookie: string = U.cookie) {
  const r = await app.request('http://localhost/api/v1/holdem/matches', {
    method: 'POST', body: JSON.stringify({ ep_balance: KHOA_BAI, ...body }),
    headers: { 'content-type': 'application/json', cookie },
  });
  return { status: r.status, body: await r.json() as any };
}

/** Người mới đã mở khoá map 12 — mỗi tài khoản có hạn mức tạo trận riêng (30/giờ). */
let seqNguoi = 0;
async function nguoiMoi(): Promise<TestUser> {
  seqNguoi += 1;
  const u = await createTestUser(pool);
  for (let i = 0; i < 3; i++) {
    const m = await pool.query(
      `INSERT INTO holdem_matches (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id, che_do, status)
       VALUES ($1, $2, '[]'::jsonb, 'x', 'x', 1, 'tu_do', 'xong') RETURNING match_id`, [u.userId, 7000 + seqNguoi * 10 + i]);
    await pool.query(
      `INSERT INTO holdem_results (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json)
       VALUES ($1, $2, 'ban', 'nguoi', 'tom', 1, 10000, 8, '{}'::jsonb)`, [m.rows[0].match_id, u.userId]);
  }
  return u;
}

async function gheJson(matchId: string) {
  const r = await pool.query('SELECT ghe_json FROM holdem_matches WHERE match_id = $1', [matchId]);
  return r.rows[0]!.ghe_json as { id: string; vai?: string }[];
}

async function nhanMatchStart(matchId: string) {
  const r = await pool.query(
    `SELECT value_json FROM events WHERE action_type = 'hd_match_start' AND context_id = $1`, [matchId]);
  return r.rows[0]!.value_json as { vai?: string };
}

describe('I. map 8 — mẫu ĐỐI CHỨNG, không vai', () => {
  it('không ghế nào có vai, và hd_match_start không có nhãn', async () => {
    const t = await taoTran({ so_o: 8 });
    expect(t.status).toBe(201);
    const ghe = await gheJson(t.body.match_id);
    expect(ghe.every((g) => g.vai === undefined)).toBe(true);
    expect((await nhanMatchStart(t.body.match_id)).vai).toBeUndefined();
  });
});

describe('II. ⭐ map 12 — vai vào ghe_json + nhãn lên events', () => {
  it('mọi ghế có vai hợp lệ; mỗi vai đặc biệt tối đa 1 ghế; số vai đặc biệt theo cỡ bàn', async () => {
    const t = await taoTran({ so_o: 12 });
    expect(t.status).toBe(201);
    const ghe = await gheJson(t.body.match_id);
    expect(ghe.length).toBeGreaterThanOrEqual(4);
    for (const g of ghe) expect(Object.keys(VAI)).toContain(g.vai);
    for (const v of ['doi_lai', 'ca_map', 'to_chuc']) {
      expect(ghe.filter((g) => g.vai === v).length).toBeLessThanOrEqual(1);
    }
    const dacBiet = ghe.filter((g) => g.vai !== 'ca_nhan').length;
    expect(dacBiet).toBe(ghe.length >= 8 ? 3 : ghe.length >= 6 ? 2 : 1);
  });

  it('⭐ nhãn vai của NGƯỜI có trong hd_match_start — và khớp ghe_json', async () => {
    const t = await taoTran({ so_o: 12 });
    const ghe = await gheJson(t.body.match_id);
    const nhan = await nhanMatchStart(t.body.match_id);
    expect(nhan.vai).toBe(ghe[0]!.vai);
  });

  it('vai TẤT ĐỊNH theo seed: tải lại trận (replay) ra cùng vai, không bốc lại', async () => {
    const t = await taoTran({ so_o: 12 });
    const ghe1 = await gheJson(t.body.match_id);
    // GET trận đi qua replay với ghe_json đã lưu — vai đọc từ đó, không suy lại.
    const r = await app.request(`http://localhost/api/v1/holdem/matches/${t.body.match_id}`, {
      headers: { cookie: U.cookie },
    });
    expect(r.status).toBe(200);
    const ghe2 = await gheJson(t.body.match_id);
    expect(ghe2.map((g) => g.vai)).toEqual(ghe1.map((g) => g.vai));
  });
});

describe('III. NGƯỜI cầm ĐỦ BỐN vai (founder 22/08) — và mỗi vai mang đúng cờ của nó lên DTO', () => {
  /** Tạo trận map 12 (người MỚI, hạn mức riêng) tới khi ghế người trúng `vai`. */
  async function tranVoiVai(vai: string, toiDa = 28) {
    // Xác suất ghế người trúng một vai cụ thể ≈ 1/8–1/4 tuỳ cỡ bàn (seed rút) —
    // 28 lần có thể hụt ~10%; đi tối đa 3 người (3 hạn mức) để bài không giòn.
    for (let lan = 0; lan < 3; lan++) {
      const u = await nguoiMoi();
      for (let i = 0; i < toiDa; i++) {
        const t = await taoTran({ so_o: 12 }, u.cookie);
        if (t.status !== 201) throw new Error(`tạo trận ${t.status}: ${JSON.stringify(t.body)}`);
        const ghe = await gheJson(t.body.match_id);
        if (ghe[0]!.vai === vai) return { id: t.body.match_id as string, cookie: u.cookie };
      }
    }
    throw new Error(`không bốc được vai ${vai} sau ${toiDa * 3} trận`);
  }
  const layTran = async (id: string, cookie: string) => {
    const r = await app.request(`http://localhost/api/v1/holdem/matches/${id}`, { headers: { cookie } });
    expect(r.status).toBe(200);
    return (await r.json()) as any;
  };
  const khop = async (id: string, cookie: string, lenh: unknown[]) => {
    const r = await app.request(`http://localhost/api/v1/holdem/matches/${id}/khop-lenh`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ vong: 1, lenh }),
    });
    return { status: r.status, body: (await r.json()) as any };
  };

  it('qua nhiều trận, ghế "ban" gặp cả bốn vai — không vai nào bị giấu khỏi người', async () => {
    const u = await nguoiMoi();
    const thay = new Set<string>();
    for (let i = 0; i < 28 && thay.size < 4; i++) {
      const t = await taoTran({ so_o: 12 }, u.cookie);
      if (t.status !== 201) throw new Error(`tạo trận ${t.status}`);
      thay.add((await gheJson(t.body.match_id))[0]!.vai!);
    }
    // Cỡ bàn rút theo seed (4–8): bàn nhỏ chỉ 1–2 vai đặc biệt nên 28 trận không
    // chắc gặp đủ bốn — bài này canh "không vai nào bị CHẶN" (mọi vai thấy đều hợp
    // lệ, ≥ 3 loại); từng vai cụ thể được chứng minh ở các bài `tranVoiVai` dưới.
    for (const v of thay) expect(Object.keys(VAI)).toContain(v);
    expect(thay.size).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it('catalog phát bảng vai + mandate — client đọc chữ từ đây, không chép', async () => {
    const r = await app.request('http://localhost/api/v1/holdem/catalog', { headers: { cookie: U.cookie } });
    const c = (await r.json()) as any;
    expect(Object.keys(c.vai).sort()).toEqual(['ca_map', 'ca_nhan', 'doi_lai', 'to_chuc']);
    expect(c.vai.to_chuc.dac_quyen.length).toBeGreaterThan(10);
    expect(c.mandate_to_chuc.TRAN_MA_BP).toBeGreaterThan(0);
  });

  it('⭐ TỔ CHỨC: DTO mang mandate + dòng tiền; mua 100% một mã ⇒ 409 mandate_ma; 25% ⇒ 200', async () => {
    const { id, cookie } = await tranVoiVai('to_chuc');
    const st = await layTran(id, cookie);
    expect(st.ban.vai).toBe('to_chuc');
    expect(st.ban.mandate).toEqual({ tran_ma_bp: 4000, cam_khong: true });
    expect(Object.keys(st.ban.dong_tien).length).toBeGreaterThanOrEqual(6);
    expect(Object.values(st.ban.dong_tien).every((v) => ['vang', 'vua', 'dong'].includes(v as string))).toBe(true);
    const r1 = await khop(id, cookie, [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }]);
    expect(r1.status).toBe(409);
    // D342 — mã lỗi đi riêng ở `ly_do` (D26: chữ ở client); câu không còn nhét mã thô.
    expect(r1.body.ly_do).toBe('mandate_ma');
    expect(String(r1.body.message)).not.toContain('mandate_ma');
    const r2 = await khop(id, cookie, [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]);
    expect(r2.status).toBe(200);
  }, 60_000);

  it('CÁ NHÂN: không mandate, không dòng tiền — mua 100% một mã ⇒ 200', async () => {
    const { id, cookie } = await tranVoiVai('ca_nhan', 20);
    const st = await layTran(id, cookie);
    expect(st.ban.mandate).toBeUndefined();
    expect(st.ban.dong_tien).toBeUndefined();
    expect((await khop(id, cookie, [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }])).status).toBe(200);
  }, 60_000);

  it('CÁ MẬP: vốn ×3, Đòn Bẩy ghim sẵn; cấp 1 ⇒ chưa được nhắm đích phụ (server không khai gan_phu_duoc, gan_phu gửi lên bị lọc)', async () => {
    const { id, cookie } = await tranVoiVai('ca_map');
    const st = await layTran(id, cookie);
    expect(st.ban.vai).toBe('ca_map');
    expect(st.ban.von).toBe(30_000);
    expect(st.ban.danh_muc.chien_thuat).toContain('don_bay');
    expect(st.ban.gan_phu_duoc).toBeUndefined();
    // Nộp vòng 1 kèm gan_phu: cấp 1 ⇒ bị lọc ở tầng nhận, danh mục không có gan_phu.
    const r = await app.request(`http://localhost/api/v1/holdem/matches/${id}/rounds`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [],
        lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }, { ma: 'vang', chieu: 'mua', moc_bp: 2500 }],
        gan: { don_bay: 'btc' }, gan_phu: { don_bay: 'vang' },
      }),
    });
    expect(r.status).toBe(200);
    const sau = await layTran(id, cookie);
    expect(sau.ban.danh_muc.gan?.don_bay).toBe('btc');
    expect(sau.ban.danh_muc.gan_phu).toBeUndefined();
  }, 60_000);

  it('ĐỘI LÁI: vốn ×3, Lướt Sóng ghim sẵn, tác động giá 1 (cái giá là SIẾT + ghim, không phải phí)', async () => {
    const { id, cookie } = await tranVoiVai('doi_lai');
    const st = await layTran(id, cookie);
    expect(st.ban.von).toBe(30_000);
    expect(st.ban.danh_muc.chien_thuat).toContain('luot_song');
    expect(st.ban.tac_dong_gia).toBe(VAI.doi_lai.tac_dong_gia);
  }, 60_000);
});

/*
 * D435 — founder 27/09: *"Đòn bẩy lv 2 đ** cho gán đòn bẩy 2 mã"*. Dựng lại ĐÚNG trận của founder (prod 83e630d9, seed
 * 4026622875, bàn 16, v54): ghế người bốc CÁ MẬP (Đòn Bẩy ghim sẵn), quầy vòng 2 chào Đòn Bẩy. Vòng 2 mua lá thứ hai kèm
 * đích phụ (mã mua CÙNG vòng) ⇒ vòng 3 phải có cả đích chính cũ lẫn đích phụ. Server đã nhận đường này từ v34; thứ thiếu
 * là cờ báo client mở nó ngay vòng mua (`gan_phu_khi_mua`). Tiêm lỗi: bỏ cờ ở `holdem_api.ts` ⇒ khẳng định đầu đỏ.
 */
describe('D435 — Đòn Bẩy cấp 2 nhắm đích phụ NGAY vòng mua lá thứ hai', () => {
  it('cá mập cầm 1 lá: server khai gan_phu_khi_mua; mua thêm + gan_phu cùng vòng ⇒ vòng sau có đích phụ, đích chính giữ', async () => {
    const A = await createTestUser(pool, { role: 'admin' });
    await moCuaAdmin(pool, A);
    await pool.query('UPDATE users SET la_tester = true WHERE user_id = $1', [A.userId]);
    const tao = await app.request('http://localhost/api/v1/holdem/matches', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: A.cookie },
      body: JSON.stringify({ so_o: 16, ep_seed: 4026622875, ep_balance: 'balance-v54-ngare' }),
    });
    expect(tao.status).toBe(201);
    const id = ((await tao.json()) as any).match_id as string;
    const lay = async () => {
      const r = await app.request(`http://localhost/api/v1/holdem/matches/${id}`, { headers: { cookie: A.cookie } });
      expect(r.status).toBe(200);
      return (await r.json()) as any;
    };
    const nop = async (b: Record<string, unknown>) => {
      const r = await app.request(`http://localhost/api/v1/holdem/matches/${id}/rounds`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: A.cookie },
        body: JSON.stringify({ khao_sat_lai: 0, hanh_dong: 'giu_vi_the', them: 0, cuoc: [], ...b }),
      });
      expect(r.status, JSON.stringify(await r.clone().json())).toBe(200);
    };
    const st1 = await lay();
    expect(st1.ban.vai).toBe('ca_map');
    await nop({ vong: 1, mua: [], gan: { don_bay: 'usd' }, lenh: [{ ma: 'usd', chieu: 'mua', moc_bp: 10000 }] });

    const st2 = await lay();
    expect(st2.ban.gan_phu_duoc).toBeUndefined();
    expect(st2.ban.gan_phu_khi_mua).toBe(true);
    const shop = await app.request(`http://localhost/api/v1/holdem/matches/${id}/shop`, { headers: { cookie: A.cookie } });
    expect(JSON.stringify(await shop.json())).toContain('don_bay');
    await nop({ vong: 2, mua: ['don_bay'], gan_phu: { don_bay: 'tpcp' }, lenh: [{ ma: 'tpcp', chieu: 'mua', moc_bp: 10000 }] });

    const st3 = await lay();
    expect(st3.ban.danh_muc.gan?.don_bay).toBe('usd');
    expect(st3.ban.danh_muc.gan_phu?.don_bay).toBe('tpcp');
    expect(st3.ban.gan_phu_duoc).toBe(true);
    expect(st3.ban.gan_phu_khi_mua).toBeUndefined();
  }, 120_000);
});
