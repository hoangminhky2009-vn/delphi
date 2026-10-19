/**
 * v55 (D409) — LỬA · XU · TRAIT · CHỐT LỜI qua API THẬT + DB THẬT (Postgres nhúng, migration 0070/0071 áp thật).
 *
 * Canh đúng ba cửa một chiều: `hd_chon_trait` ghi được (CHECK đã nới — bỏ migration là bài đỏ), `hd_chot_phien`
 * mang `lua`/`trait`, và kho hành vi trải sáu cột mới. Mọi mục có vế ngược trên khoá v54 (mặc định 0.0.45).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { hanhViDeps } from '../server/holdem_api.js';
import { dungHanhViTran } from '../server/hanh_vi/kho.js';
import { HANH_VI_FORMULA_VERSION } from '../server/hanh_vi/trai.js';
import { THAM_SO, TRAIT, TRAIT_VAI, diemCoDau, type TraitId } from '../config/trait.js';
import { HOLDEM_MATCH } from '../config/holdem.js';
import type { VaiId } from '../server/holdem/vai.js';
import { bayTrait, tongDiem } from '../server/holdem/trait.js';
import { luatCua } from '../config/holdem_balance.js';
import { taoTran as taoTranEngine, tinBiChe, type Ghe, type TrangThaiTran } from '../server/holdem/engine.js';

const V55 = 'balance-v55-build';
const V54 = 'balance-v54-ngare';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let U: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-v55', secureCookie: false,
  }) as Hono<any>;
  /*
   * `ep_seed` chỉ có hiệu lực với ADMIN có cờ tester (`laTester`: role admin + la_tester); người thường gửi thì server
   * LẶNG LẼ bỏ qua và bốc seed ngẫu nhiên. Bản đầu của bài này chỉ bật la_tester trên một người thường ⇒ seed chưa bao
   * giờ được ghim, và bài đỏ ngẫu nhiên mỗi khi cặp cân rơi vào LỬA GIẢ (lượt gốc đầy đủ 26/09, D409). Dựng y như API
   * giả soi mắt: admin + TOTP (`moCuaAdmin`) + la_tester — và bài đầu KHẲNG ĐỊNH seed ép có hiệu lực.
   */
  U = await createTestUser(pool, { role: 'admin' });
  await moCuaAdmin(pool, U);
  await pool.query('UPDATE users SET la_tester = true WHERE user_id = $1', [U.userId]);
}, 120_000);
afterAll(async () => { await db?.stop(); });

async function req(path: string, init: RequestInit = {}): Promise<Response> {
  return app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie: U.cookie, ...(init.headers ?? {}) },
  });
}
async function json(path: string, init: RequestInit = {}): Promise<any> { return (await req(path, init)).json(); }
/** `Response.json()` của Hono trả `unknown` — bài này đọc DTO lỏng, cùng nếp `json()` ngay trên. */
const docJson = (r: Response): Promise<any> => r.json() as Promise<any>;
let seedKe = 55_001;
async function taoTran(khoa: string, seed = seedKe++, them: Record<string, unknown> = {}): Promise<any> {
  const r = await req('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: khoa, ep_seed: seed, ...them }) });
  expect(r.status).toBe(201);
  return r.json();
}
const capCan = (moi: readonly TraitId[]): [TraitId, TraitId] => {
  const tai = moi.filter((id) => TRAIT.find((t) => t.id === id)!.loai === 'tai');
  for (const t of tai) {
    const x = moi.find((id) => TRAIT.find((u) => u.id === id)!.loai === 'tat' && diemCoDau(TRAIT.find((u) => u.id === id)!) === -diemCoDau(TRAIT.find((u) => u.id === t)!));
    if (x) return [t, x];
  }
  throw new Error('lượt mời không có cặp cân — bayTrait phải luôn cho 3+3 cùng tổng');
};
const diem = (id: TraitId): number => diemCoDau(TRAIT.find((x) => x.id === id)!);
const loaiCua = (id: TraitId): 'tai' | 'tat' => TRAIT.find((x) => x.id === id)!.loai;
/**
 * Seed ĐẦU TIÊN (từ `tu`) mà lượt mời vòng 1 thoả `dk` — tìm bằng chính hàm thuần `bayTrait`, không gõ tay seed: đổi bảng
 * trait thì bài tự tìm seed khác chứ không lặng lẽ thôi chạm ca nó sinh ra để canh.
 */
function seedCo(tu: number, dk: (moi: readonly TraitId[]) => TraitId[] | null): { seed: number; lay: TraitId[] } {
  for (let s = tu; s < tu + 5000; s += 1) {
    const lay = dk(bayTrait(s, 'ban', 1, 0, []));
    if (lay) return { seed: s, lay };
  }
  throw new Error(`không seed nào trong [${tu}, ${tu + 5000}) thoả điều kiện`);
}
/** Nộp một vòng "giữ nguyên" (thêm trường qua `them`), khẳng định 200 và trả DTO. */
async function nopVong(matchId: string, vong: number, them: Record<string, unknown> = {}): Promise<any> {
  const r = await req(`/api/v1/holdem/matches/${matchId}/rounds`, {
    method: 'POST',
    body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, lenh: [], ...them }),
  });
  expect(r.status, `vòng ${vong}`).toBe(200);
  return docJson(r);
}
/** Trạng thái engine CỤC BỘ cùng seed + khoá (map không phụ thuộc ghế) và ghế 'ban' mang `trait` từ vòng 2 — để đoán
 * lớp che bằng chính hàm thuần của engine (`tinBiChe`), không gõ tay ô nào bị che. */
function banCucBo(seed: number, trait: readonly TraitId[]): { st: TrangThaiTran; g: Ghe } {
  const st = taoTranEngine(seed, [{ id: 'ban', loai: 'nguoi', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } }], luatCua(V55), 16);
  const g: Ghe = { ...st.ghe[0]!, trait: [...trait], trait_tu_vong: Object.fromEntries(trait.map((id) => [id, 2])) };
  return { st, g };
}
/** Tập lá TÀI trong lượt mời cộng đúng `can` điểm (duyệt mọi tập con) — null nếu không có. */
function taiCong(moi: readonly TraitId[], can: number): TraitId[] | null {
  const tai = moi.filter((id) => loaiCua(id) === 'tai');
  for (let m = 1; m < 1 << tai.length; m += 1) {
    const chon = tai.filter((_, i) => (m & (1 << i)) !== 0);
    if (chon.reduce((t, id) => t + diem(id), 0) === can) return chon;
  }
  return null;
}
async function events(matchId: string, loai: string): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT value_num::float AS num, value_json FROM events WHERE context_type = 'holdem' AND context_id = $1 AND action_type = $2 ORDER BY ts ASC`,
    [matchId, loai]);
  return rows;
}

describe('v55 qua API', () => {
  it('trận v55: DTO có lửa 0 · xu 0 · trait rỗng · mốc mua 25/50/75/100 · chợ trait mở ở vòng 1; trận v54 không có gì', async () => {
    const SEED_MO = 55_000;
    const t = await taoTran(V55, SEED_MO);
    expect(t.tong_vong).toBe(15);
    expect(t.ban.lua).toEqual({ nac: 0, chuoi: 0, bias: null, dac_biet: false });
    // D411 — VÀNG gộp vào XU: ví khởi điểm là phần cấp cũ của lượt khảo sát; DTO khai cờ gộp và ví shop CHÍNH là xu.
    expect(t.ban.xu).toBe(HOLDEM_MATCH.START_LUOT_KHAO_SAT);
    expect(t.ban.xu_gop).toBe(true);
    expect(t.ban.luot_khao_sat).toBe(t.ban.xu);
    // Trận thường bốc vai: vai ngoài Cá nhân mang sẵn cặp cố định (traitVai) — kho chung vẫn rỗng.
    const capVai = TRAIT_VAI[(t.ban.vai ?? 'ca_nhan') as VaiId];
    expect(t.ban.trait).toEqual([...capVai]);
    expect(t.ban.moc_cho_phep).toEqual([2500, 5000, 7500, 10000]);
    expect(t.ban.cho_trait.moc).toBe(1);
    expect(t.ban.cho_trait.moi.length).toBe(6);
    expect(tongDiem(t.ban.cho_trait.moi)).toBe(0);
    // Seed ép CÓ hiệu lực: lượt mời đúng bằng hàm thuần của seed ấy — cũng chính là điều replay và cửa kiểm lượt mời cần.
    expect(t.ban.cho_trait.moi, '`ep_seed` bị bỏ qua — người gọi phải là admin-tester').toEqual(bayTrait(SEED_MO, 'ban', 1, 0, []));
    expect(t.ban.rang_buoc.te_liet).toBe(false);
    const cu = await taoTran(V54);
    expect(cu.ban.lua).toBeUndefined();
    expect(cu.ban.xu_gop).toBeUndefined();
    expect(cu.ban.luot_khao_sat).toBe(HOLDEM_MATCH.START_LUOT_KHAO_SAT);
    expect(cu.ban.cho_trait).toBeUndefined();
    expect(cu.ban.trait).toBeUndefined();
    expect(cu.ban.moc_cho_phep).toBeUndefined();
  });

  it('nộp vòng 1 với cặp cân 0 ⇒ nhận trait; `hd_chon_trait` ghi lượt mời + lá lấy; `hd_chot_phien` mang lua/trait; kết quả vòng có `lua`', async () => {
    const t = await taoTran(V55);
    const [tai, tat] = capCan(t.ban.cho_trait.moi);
    const r = await req(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({
        vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0,
        lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }],
        trait: { lay: [tai, tat], cuon: 0 },
      }),
    });
    expect(r.status).toBe(200);
    const b = await docJson(r);
    const capVai = TRAIT_VAI[(t.ban.vai ?? 'ca_nhan') as VaiId];
    expect(b.ban.trait).toEqual([...capVai, tai, tat]);
    expect(b.ban.lua.nac).toBeGreaterThanOrEqual(0);
    expect(b.ket_qua_vong.lua).toBeDefined();
    expect(b.ket_qua_vong.lua.xu).toBe(b.ban.xu);
    expect(b.ban.cho_trait, 'vòng 2 không phải mốc').toBeUndefined();
    const ct = await events(t.match_id, 'hd_chon_trait');
    expect(ct.length).toBe(1);
    expect(ct[0].value_json.moi).toEqual(t.ban.cho_trait.moi);
    expect(ct[0].value_json.lay).toEqual([tai, tat]);
    expect(ct[0].value_json.cuon).toBe(0);
    expect(ct[0].value_json.bo_qua).toBe(false);
    expect(ct[0].value_json.dang_mang).toEqual([...capVai, tai, tat]);
    expect(ct[0].num).toBe(2);
    const cp = await events(t.match_id, 'hd_chot_phien');
    expect(cp.length).toBe(1);
    expect(cp[0].value_json.lua).toBeDefined();
    // D422 — LỬA GIẢ đã thành MÙ LỬA (lửa người mang luôn tắt ngay ở engine) ⇒ màn phát ĐÚNG nấc thật.
    const that = cp[0].value_json.lua.sau as number;
    expect(b.ban.lua.nac).toBe(that);
    expect(cp[0].value_json.trait, 'trait SAU vòng: gồm cặp vừa lấy').toEqual([...capVai, tai, tat]);
    expect(cp[0].value_json.trait_vong, 'trait TRONG vòng mốc: cặp vừa lấy CHƯA có hiệu lực').toEqual([...capVai]);
  });

  it('MÙ LỬA: lấy ở mốc 1 ⇒ từ vòng 2 lửa luôn 0 dù ôm phía đều; kết quả vòng khai `mu_lua` và xu thêm ≥ 2', async () => {
    const { seed, lay } = seedCo(56_000, (moi) => {
      if (!moi.includes('mu_lua')) return null;
      const tai = taiCong(moi, -diem('mu_lua'));
      return tai ? [...tai, 'mu_lua'] : null;
    });
    const t = await taoTran(V55, seed);
    const r1 = await nopVong(t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }], trait: { lay, cuon: 0 } });
    expect(r1.ban.trait).toContain('mu_lua');
    for (const v of [2, 3]) {
      const b = await nopVong(t.match_id, v);
      expect(b.ban.lua.nac, `vòng ${v}`).toBe(0);
      expect(b.ket_qua_vong.lua.sau).toBe(0);
      expect(b.ket_qua_vong.lua.mu_lua).toBe(true);
      expect(b.ket_qua_vong.lua.xu_them).toBeGreaterThanOrEqual(THAM_SO.MU_LUA_XU);
      expect(b.ban.rang_buoc.mu_lua).toBe(true);
    }
  });

  it('lệch cân ⇒ 400 trait_lech_can · ngoài lượt mời ⇒ 400 trait_ngoai_luot · vòng 2 ⇒ 409 khong_phai_moc · đổi bài + cuộn vượt ví ⇒ 409 thieu_xu', async () => {
    const t = await taoTran(V55);
    const [tai, tat] = capCan(t.ban.cho_trait.moi);
    const nop = (body: Record<string, unknown>) => req(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, ...body }),
    });
    let r = await nop({ trait: { lay: [tai], cuon: 0 } });
    expect(r.status).toBe(400); expect((await docJson(r)).error).toBe('trait_lech_can');
    const ngoai = TRAIT.find((x) => !x.vai && !t.ban.cho_trait.moi.includes(x.id))!;
    r = await nop({ trait: { lay: [ngoai.id], cuon: 0 } });
    expect(r.status).toBe(400); expect((await docJson(r)).error).toBe('trait_ngoai_luot');
    // D411 — ví gộp: đổi bài shop (2 lần: lần đầu miễn phí + 1 giá) cộng cuộn chợ (1 lần) vượt ví khởi điểm ⇒ thiếu xu.
    r = await nop({ khao_sat_lai: 2, trait: { lay: [], cuon: 1 } });
    expect(r.status).toBe(409); expect((await docJson(r)).error).toBe('thieu_xu');
    r = await nop({});
    expect(r.status).toBe(200);
    expect((await events(t.match_id, 'hd_chon_trait')).length, 'không lấy gì, không cuộn ⇒ vẫn ghi lượt mời (bo_qua=false, lay=[])').toBe(1);
    r = await req(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 2, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, trait: { lay: [tai, tat], cuon: 0 } }),
    });
    expect(r.status).toBe(409); expect((await docJson(r)).error).toBe('khong_phai_moc');
  });

  it('GET /shop?cuon=1 trả lượt mời KHÁC lượt 0 kèm giá 2 xu; lượt 0 y hệt DTO trận', async () => {
    const t = await taoTran(V55);
    const s0 = await json(`/api/v1/holdem/matches/${t.match_id}/shop?cuon=0`);
    expect(s0.cho_trait.moi).toEqual(t.ban.cho_trait.moi);
    expect(s0.cho_trait.gia).toBe(0);
    const s1 = await json(`/api/v1/holdem/matches/${t.match_id}/shop?cuon=1`);
    expect(s1.cho_trait.lan_cuon).toBe(1);
    expect(s1.cho_trait.gia).toBe(2);
    expect(s1.cho_trait.moi.length).toBe(6);
    expect(tongDiem(s1.cho_trait.moi)).toBe(0);
    const cu = await taoTran(V54);
    expect((await json(`/api/v1/holdem/matches/${cu.match_id}/shop?cuon=1`)).cho_trait).toBeUndefined();
  });

  it('chốt lời trong ô cần lá Lướt Sóng ⇒ 400; trận v54 lột `trait`/`chot_loi` khỏi log (không ghi, không nổ)', async () => {
    const t = await taoTran(V55);
    const r = await req(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({
        vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0,
        chot_loi: [{ ma: 'btc', nguong_bp: 500, phan_bp: 5000 }],
      }),
    });
    expect(r.status).toBe(400); expect((await docJson(r)).error).toBe('can_la_luot_song');
    const cu = await taoTran(V54);
    const r2 = await req(`/api/v1/holdem/matches/${cu.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({
        vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0,
        trait: { lay: ['giu_nhiet', 'gong_cum'], cuon: 0 }, chot_loi: [{ ma: 'btc', nguong_bp: 500, phan_bp: 5000 }],
      }),
    });
    expect(r2.status).toBe(200);
    expect((await events(cu.match_id, 'hd_chon_trait')).length).toBe(0);
    const { rows } = await pool.query('SELECT action_log FROM holdem_matches WHERE match_id = $1', [cu.match_id]);
    expect(JSON.stringify(rows[0].action_log)).not.toContain('chot_loi');
    expect(JSON.stringify(rows[0].action_log)).not.toContain('"trait"');
  });

  it(`kho hành vi (công thức ${HANH_VI_FORMULA_VERSION}): trận v55 có lua_nac/xu/trait_json/co_che_cat_lo; trận v54 sáu cột NULL`, async () => {
    // Seed có CẢ NỘI GIÁN lẫn KỶ LUẬT trong lượt mời ⇒ bài luôn chạm đúng ca "lá lấy ở vòng mốc chỉ tính từ vòng kế".
    const { seed, lay } = seedCo(57_000, (moi) => {
      if (!moi.includes('noi_gian') || !moi.includes('ky_luat')) return null;
      const can = -(diem('noi_gian') + diem('ky_luat'));
      const tat = moi.filter((id) => loaiCua(id) === 'tat');
      for (let m = 1; m < 1 << tat.length; m += 1) {
        const bo = tat.filter((_, i) => (m >> i) & 1);
        if (bo.reduce((a, id) => a + diem(id), 0) === can) return ['noi_gian', 'ky_luat', ...bo];
      }
      return null;
    });
    // Ép Cá nhân (không cặp vai): cặp vai THÍNH TIN của Đội Lái đã từng che mất đúng lỗi bài này canh — mũi tiêm "kho
    // đọc danh sách SAU vòng" XANH vì seed đầu tiên tìm được bốc trúng Đội Lái (26/09).
    const t = await taoTran(V55, seed, { ep_vai: 'ca_nhan' });
    expect(t.ban.vai ?? 'ca_nhan').toBe('ca_nhan');
    await req(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, lenh: [{ ma: 'vn30', chieu: 'mua', moc_bp: 5000 }], trait: { lay, cuon: 0 } }),
    });
    await req(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong: 2, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0 }),
    });
    await dungHanhViTran(pool, t.match_id, hanhViDeps);
    const { rows } = await pool.query(
      'SELECT vong, lua_nac, lua_dap, xu, trait_json, nguon_tin_rieng, co_che_cat_lo FROM hanh_vi_vong WHERE match_id = $1 ORDER BY vong', [t.match_id]);
    expect(rows.length).toBe(2);
    const capVai = TRAIT_VAI[(t.ban.vai ?? 'ca_nhan') as VaiId];
    for (const r of rows) {
      expect(r.lua_nac).not.toBeNull();
      expect(r.xu).not.toBeNull();
      // `trait_json` = danh sách SAU vòng (migration 0071) ⇒ cả hai dòng đã gồm phần lấy ở mốc 1.
      expect(r.trait_json).toEqual([...capVai, ...lay]);
    }
    /*
     * Hai cột NGỮ CẢNH đọc trait CÓ HIỆU LỰC TRONG vòng: vòng 1 (vòng mốc) chưa có NỘI GIÁN / KỶ LUẬT vừa lấy — chỉ cặp
     * vai; vòng 2 mới có. Bản đầu đọc danh sách SAU vòng và gán cả hai cho vòng 1 (D409).
     */
    const thinhTin = capVai.includes('ghim_luot_song') ? 'trait' : null;
    expect(rows[0].nguon_tin_rieng, 'vòng mốc: NỘI GIÁN vừa lấy chưa có hiệu lực').toBe(thinhTin);
    expect(rows[0].co_che_cat_lo, 'vòng mốc: KỶ LUẬT vừa lấy chưa có hiệu lực').toBe(false);
    expect(rows[1].nguon_tin_rieng).toBe('trait');
    expect(rows[1].co_che_cat_lo).toBe(true);
    const cu = await taoTran(V54);
    await req(`/api/v1/holdem/matches/${cu.match_id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0 }),
    });
    await dungHanhViTran(pool, cu.match_id, hanhViDeps);
    const cuRows = await pool.query(
      'SELECT lua_nac, lua_dap, xu, trait_json, nguon_tin_rieng, co_che_cat_lo FROM hanh_vi_vong WHERE match_id = $1', [cu.match_id]);
    expect(cuRows.rows.length).toBe(1);
    expect(cuRows.rows[0]).toEqual({ lua_nac: null, lua_dap: null, xu: null, trait_json: null, nguon_tin_rieng: null, co_che_cat_lo: null });
  });

  it('D411 — ví gộp: đổi bài lần đầu MIỄN PHÍ, từ lần hai tốn giá; hết ví ⇒ 409; khoá cũ vẫn trừ từ lần đầu (replay nguyên)', async () => {
    const t = await taoTran(V55);
    const GIA = HOLDEM_MATCH.CHI_PHI_KHAO_SAT_LAI;
    const s1 = await json(`/api/v1/holdem/matches/${t.match_id}/shop?lan=1`);
    expect(s1.luot_con_lai, 'lần đầu miễn phí — đúng nhãn "⟳ FREE" của shop').toBe(t.ban.xu);
    const s2 = await json(`/api/v1/holdem/matches/${t.match_id}/shop?lan=2`);
    expect(s2.luot_con_lai).toBe(t.ban.xu - GIA);
    const r3 = await req(`/api/v1/holdem/matches/${t.match_id}/shop?lan=3`);
    expect(r3.status, 'lần ba vượt ví').toBe(409);
    expect((await docJson(r3)).error).toBe('het_luot_khao_sat');
    // Chốt vòng với MỘT lần đổi bài: ví không mất xu nào (luật cũ sẽ trừ GIA ⇒ dưới mốc này).
    const r = await req(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 1, mua: null, hanh_dong: 'giu_vi_the', them: 0 }),
    });
    expect(r.status).toBe(200);
    const b = await docJson(r);
    expect(b.ban.xu).toBeGreaterThanOrEqual(t.ban.xu + HOLDEM_MATCH.LUOT_KHAO_SAT_MOI_VONG);
    expect(b.ban.luot_khao_sat).toBe(b.ban.xu);
    const cu = await taoTran(V54);
    const c1 = await json(`/api/v1/holdem/matches/${cu.match_id}/shop?lan=1`);
    expect(c1.luot_con_lai, 'khoá cũ: trừ từ lần đầu — replay giữ nguyên').toBe(HOLDEM_MATCH.START_LUOT_KHAO_SAT - GIA);
  });
});

/* ═══ D422 — vòng 3 qua API ═══════════════════════════════════════════════════════════════════════════════════ */
describe('v55 vòng 3 qua API (D422)', () => {
  it('MÙ TIN (tier 4): lá TIN lật ra sau khi mang bị che đúng như `tinBiChe`; lá che không lộ tên ở lịch sử ô và chuỗi VÌ SAO', async () => {
    // Seed có MÙ TIN trong lượt mời mốc 1 + TÀI cộng đủ 4, VÀ ít nhất một lá tin bị che trong 6 ô đầu sau khi mang.
    let tim: { seed: number; lay: TraitId[] } | null = null;
    for (let sd = 57_000; sd < 60_000 && !tim; sd += 1) {
      const moi = bayTrait(sd, 'ban', 1, 0, []);
      if (!moi.includes('mu_tin')) continue;
      const tai = taiCong(moi, -diem('mu_tin'));
      if (!tai) continue;
      const { st, g } = banCucBo(sd, ['mu_tin']);
      if ([2, 3, 4, 5, 6].some((k) => tinBiChe(st, g, k))) tim = { seed: sd, lay: [...tai, 'mu_tin'] };
    }
    expect(tim, 'không tìm được seed có lá tin bị che').not.toBeNull();
    const t = await taoTran(V55, tim!.seed);
    // Ôm hai mã để lá tin có chỗ dội vào chuỗi VÌ SAO — không vị thế thì chuỗi rỗng và vế "không lộ tên" canh rỗng
    // (tiêm lỗi D422 M16 đã bắt đúng ca ấy).
    const lenh = [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }, { ma: 'vang', chieu: 'mua', moc_bp: 5000 }];
    let b = await nopVong(t.match_id, 1, { lenh, trait: { lay: tim!.lay, cuon: 0 } });
    const { st, g } = banCucBo(tim!.seed, ['mu_tin']);
    let daThayChe = 0;
    let dauChe = 0;
    for (let v = 2; v <= 7; v += 1) {
      b = await nopVong(t.match_id, v);
      const k = b.ket_qua_vong.vong as number;
      if (tinBiChe(st, g, k)) {
        daThayChe += 1;
        expect(b.ket_qua_vong.o).toEqual({ kind: 'che' });
        const chain = (b.ket_qua_vong.cua_ban?.chain ?? []) as { su_kien?: string }[];
        expect(JSON.stringify(chain)).not.toContain(`"su_kien":"${(st.map.o[k] as { su_kien?: string }).su_kien}"`);
        dauChe += chain.filter((m) => m.su_kien === 'che').length;
      } else {
        expect(b.ket_qua_vong.o.kind).not.toBe('che');
      }
    }
    b.lich_su_o.forEach((o: any, k: number) => {
      expect(o.kind === 'che', `ô ${k}`).toBe(tinBiChe(st, g, k));
    });
    expect(daThayChe).toBeGreaterThan(0);
    expect(dauChe, 'lá tin bị che phải để lại dấu che trong chuỗi VÌ SAO').toBeGreaterThan(0);
  });

  it('SƯƠNG MÙ: lá PHA mới lật hiện HAI mặt (có mặt thật) với riêng người mang, vòng sau tan; lá tin không bị đụng', async () => {
    const { seed, lay } = seedCo(60_000, (moi) => {
      if (!moi.includes('suong_mu')) return null;
      const tai = taiCong(moi, -diem('suong_mu'));
      return tai ? [...tai, 'suong_mu'] : null;
    });
    const t = await taoTran(V55, seed);
    await nopVong(t.match_id, 1, { trait: { lay, cuon: 0 } });
    const { st } = banCucBo(seed, []);
    let thay = 0;
    let truoc: any = null;
    for (let v = 2; v <= 8; v += 1) {
      const b = await nopVong(t.match_id, v);
      const k = b.ket_qua_vong.vong as number;
      const oThat = st.map.o[k]!;
      if (oThat.kind === 'giai_doan') {
        thay += 1;
        expect(b.ket_qua_vong.o.kind).toBe('suong');
        expect(b.ket_qua_vong.o.hai_mat).toHaveLength(2);
        expect(b.ket_qua_vong.o.hai_mat).toContain(oThat.giai_doan);
        expect(b.lich_su_o[k].kind).toBe('suong');
        expect(JSON.stringify(b.ket_qua_vong.cua_ban?.chain ?? [])).not.toContain(`"giai_doan":"${oThat.giai_doan}"`);
      } else {
        expect(b.ket_qua_vong.o.kind).not.toBe('suong');
      }
      // lá của vòng TRƯỚC đã tan: lịch sử ô trả nguyên mặt thật
      if (truoc !== null && truoc.k >= 0 && st.map.o[truoc.k]!.kind === 'giai_doan') {
        expect(b.lich_su_o[truoc.k].kind).toBe('giai_doan');
      }
      truoc = { k };
    }
    expect(thay).toBeGreaterThan(0);
  });

  it('ĐI SAU: người mang thấy `dong_lenh_ban` — đủ sáu mã, mức −3…+3; không mang ⇒ vắng', async () => {
    const { seed, lay } = seedCo(61_000, (moi) => {
      if (!moi.includes('di_sau')) return null;
      const tat = moi.find((id) => loaiCua(id) === 'tat' && diem(id) === -diem('di_sau'));
      return tat ? ['di_sau', tat] : null;
    });
    const t = await taoTran(V55, seed);
    const b = await nopVong(t.match_id, 1, { trait: { lay, cuon: 0 } });
    expect(b.ban.dong_lenh_ban).toHaveLength(6);
    for (const x of b.ban.dong_lenh_ban) expect(Math.abs(x.muc)).toBeLessThanOrEqual(3);
    expect(b.ban.rang_buoc.di_sau).toBe(true);
    const khac = await taoTran(V55);
    const b2 = await nopVong(khac.match_id, 1);
    expect(b2.ban.dong_lenh_ban).toBeUndefined();
  });

  it('NÓNG VỘI: ôm một mã liền quá 3 vòng ⇒ số vòng giữ lên màn; từ vòng thứ 5 chuỗi VÌ SAO có `nong_voi` cắt lãi (khi mã lãi)', async () => {
    const { seed, lay } = seedCo(62_000, (moi) => {
      if (!moi.includes('nong_voi')) return null;
      const tai = moi.find((id) => loaiCua(id) === 'tai' && diem(id) === -diem('nong_voi'));
      return tai ? [tai, 'nong_voi'] : null;
    });
    const t = await taoTran(V55, seed);
    const b1 = await nopVong(t.match_id, 1, { lenh: [{ ma: 'vang', chieu: 'mua', moc_bp: 5000 }], trait: { lay, cuon: 0 } });
    expect(b1.ban.giu_lien?.vang).toBe(1);
    let coCat = false;
    for (let v = 2; v <= 9; v += 1) {
      const b = await nopVong(t.match_id, v);
      expect(b.ban.giu_lien?.vang, `vòng ${v}`).toBe(v);
      const chuoi = (b.ket_qua_vong.cua_ban?.chain ?? []) as { kind: string; ma?: string; delta_bp: number }[];
      const nv = chuoi.filter((m) => m.kind === 'nong_voi');
      if (v <= 4) expect(nv.length, `vòng ${v}: chưa quá 3 vòng`).toBe(0);
      for (const m of nv) { expect(m.ma).toBe('vang'); expect(m.delta_bp).toBeLessThan(0); coCat = true; }
    }
    expect(coCat, 'tám vòng ôm Vàng mà không vòng nào lãi — đổi seed').toBe(true);
  });
});

describe('v55 D425 qua API — GÔNG CÙM trần BÁN · SỔ MỎNG phí cố định', () => {
  const layCap = (tat: TraitId) => (moi: readonly TraitId[]): TraitId[] | null => {
    if (!moi.includes(tat)) return null;
    const tai = taiCong(moi, -diem(tat));
    return tai ? [...tai, tat] : null;
  };
  it('GÔNG CÙM: DTO phát trần bán + phần bán còn được; bán sạch vị thế lớn ⇒ `loi_von.lenh = gong_cum`, bán một phần thì khớp', async () => {
    const { seed, lay } = seedCo(63_000, layCap('gong_cum'));
    const t = await taoTran(V55, seed);
    const b1 = await nopVong(t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }], trait: { lay, cuon: 0 } });
    expect(b1.ban.trait).toContain('gong_cum');
    expect(b1.ban.rang_buoc.tran_ban_vong_bp).toBe(THAM_SO.GONG_CUM_TRAN_BAN_VONG_BP);
    expect(b1.ban.rang_buoc.phi_co_dinh_lenh).toBe(0);
    const nav = (b1.ban.tien_mat ?? b1.ban.von) + Object.values(b1.ban.vi_the as Record<string, number>).reduce((a, x) => a + x, 0);
    expect(b1.ban.rang_buoc.tran_ban_con).toBeGreaterThan(nav * 0.3);
    expect(b1.ban.rang_buoc.tran_ban_con).toBeLessThanOrEqual(nav * 0.45);
    const b2 = await nopVong(t.match_id, 2, { lenh: [{ ma: 'btc', chieu: 'ban', moc_bp: 10000 }] });
    expect(b2.loi_von?.lenh, 'bán sạch ≈ gần hết NAV > 40 %').toBe('gong_cum');
    expect(b2.ban.vi_the.btc, 'lệnh bị bác thì vị thế còn nguyên').toBeGreaterThan(0);
    const b3 = await nopVong(t.match_id, 3, { lenh: [{ ma: 'btc', chieu: 'ban', moc_bp: 2500 }] });
    expect(b3.loi_von?.lenh).toBeUndefined();
  });

  it('SỔ MỎNG: DTO phát phí cố định = 0,7 % vốn khởi điểm; ghế không mang ⇒ 0; không có trần bán', async () => {
    const { seed, lay } = seedCo(64_000, layCap('so_mong'));
    const t = await taoTran(V55, seed);
    const b1 = await nopVong(t.match_id, 1, { trait: { lay, cuon: 0 } });
    expect(b1.ban.trait).toContain('so_mong');
    const phi = Math.floor(((b1.ban.von_quy_chieu ?? HOLDEM_MATCH.START_VON) * THAM_SO.SO_MONG_PHI_LENH_BP) / 10000);
    expect(phi).toBeGreaterThan(0);
    expect(b1.ban.rang_buoc.phi_co_dinh_lenh).toBe(phi);
    expect(b1.ban.rang_buoc.tran_ban_con).toBeUndefined();
    const k1 = await nopVong((await taoTran(V55)).match_id, 1);
    expect(k1.ban.rang_buoc.phi_co_dinh_lenh).toBe(0);
  });

  /*
   * D446 — màn shop xem trước bằng NGUYÊN bộ tham số server áp (`ban.tuy_chon_lenh`); bài đối chiếu engine ↔ xem trước ở
   * `web/tests/chip_xem_truoc_mot_nguon.test.tsx`. Bài này canh vế còn lại: DTO THẬT qua API có phát bộ ấy, và số trong
   * bộ trùng các trường lẻ cùng DTO (cùng một `st`, cùng một ghế) — lệch là có hai nguồn.
   */
  it('D446 — DTO phát `tuy_chon_lenh`: trần bán · phí cố định · hệ số vai · cờ khống trùng các trường lẻ cùng DTO', async () => {
    const { seed, lay } = seedCo(63_000, layCap('gong_cum'));
    const t = await taoTran(V55, seed);
    const b1 = await nopVong(t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }], trait: { lay, cuon: 0 } });
    const tc = b1.ban.tuy_chon_lenh;
    expect(tc, 'trận v55 không phát bộ tham số lệnh — màn lùi về đường chép tay').toBeDefined();
    expect(b1.ban.trait).toContain('gong_cum');
    expect(tc.tranBanVong.tranTien - tc.tranBanVong.daBan).toBe(b1.ban.rang_buoc.tran_ban_con);
    expect(tc.phiCoDinhLenh ?? 0).toBe(b1.ban.rang_buoc.phi_co_dinh_lenh);
    expect(tc.tacDongGia).toBe(b1.ban.tac_dong_gia ?? 1);
    expect(tc.coBanKhong).toBe(b1.ban.co_ban_khong === true);
    expect(tc.voiVang).toBe(b1.ban.phi_voi_vang === true);
    expect(tc.maxTaiSan).toBeGreaterThanOrEqual(HOLDEM_MATCH.MAX_TAI_SAN - 1);
  });
});
