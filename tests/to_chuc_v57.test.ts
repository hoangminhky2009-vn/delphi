/**
 * D498 — TỔ CHỨC + CHIA VAI + RẢI LỆNH dưới cờ `toChucV57` (khoá `balance-v57-minigame`). Founder 04/10:
 *   chia vai: < 4 ghế 1 vai · 4–7 ghế Tổ Chức + (Cá Mập | Đội Lái) · ≥ 8 đủ ba, mỗi vai tối đa một ghế
 *   Tổ Chức: không margin (không Đòn Bẩy, như đã cấm Bán Khống) · phí quản lý +PHI_QL_BP NAV mỗi vòng vào tiền mặt
 *   Rải lệnh +2/+3/+5: trait độc quyền vai đặc biệt; lấy một cấp thì thôi chào cấp khác (luật HỌ trait)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { luatCua } from '../config/holdem_balance.js';
import { MANDATE_TO_CHUC } from '../config/holdem.js';
import { TO_CHUC_V57 } from '../config/minigame.js';
import { KHO_TRAIT_HEP, TRAIT } from '../config/trait.js';
import { bocThamVai, CHU_VAI_TO_CHUC_V57 } from '../server/holdem/vai.js';
import { mandateCua, taoTran, vaiTheoLuat, type GheMoi } from '../server/holdem/engine.js';
import { bayTrait } from '../server/holdem/trait.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

const V57 = 'balance-v57-minigame';
const DAC_BIET = ['ca_map', 'doi_lai', 'to_chuc'];

describe('§I — chia vai theo cỡ bàn', () => {
  it('⭐ 4–7 ghế: luôn Tổ Chức + đúng một trong Cá Mập/Đội Lái (không bao giờ Cá Mập + Đội Lái); qua nhiều seed có cả hai biến thể', () => {
    const thay = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const n of [4, 5, 6, 7]) {
        const v = bocThamVai(seed, n, undefined, true), db = v.filter((x) => DAC_BIET.includes(x)).sort();
        expect(db, `seed ${seed} · ${n} ghế`).toHaveLength(2);
        expect(db).toContain('to_chuc');
        thay.add(db.join('+'));
      }
    }
    expect([...thay].sort()).toEqual(['ca_map+to_chuc', 'doi_lai+to_chuc']);
  });
  it('8 ghế đủ ba, mỗi vai một ghế; 3 ghế một vai', () => {
    for (let seed = 1; seed <= 100; seed++) {
      expect(bocThamVai(seed, 8, undefined, true).filter((x) => DAC_BIET.includes(x)).sort()).toEqual(['ca_map', 'doi_lai', 'to_chuc']);
      expect(bocThamVai(seed, 3, undefined, true).filter((x) => DAC_BIET.includes(x))).toHaveLength(1);
    }
  });
  it('vế ngược — cờ tắt (khoá cũ): bàn 4–5 vẫn MỘT vai đặc biệt như trước', () => {
    for (let seed = 1; seed <= 100; seed++) expect(bocThamVai(seed, 5).filter((x) => DAC_BIET.includes(x))).toHaveLength(1);
  });
});

describe('§II — Tổ Chức không margin · trait độc quyền + họ', () => {
  const ghe = (id: string, loai: 'nguoi' | 'bot'): GheMoi => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] }, vai: 'to_chuc' } as never);
  it('⭐ mandate Tổ Chức có `camDonBay` chỉ dưới cờ', () => {
    const st57 = taoTran(9, [ghe('ban', 'nguoi'), ghe('g1', 'bot')], luatCua(V57), 12);
    const st56 = taoTran(9, [ghe('ban', 'nguoi'), ghe('g1', 'bot')], luatCua('balance-v56-congdon'), 12);
    expect(mandateCua(st57, st57.ghe[0]!)?.camDonBay).toBe(true);
    expect(mandateCua(st56, st56.ghe[0]!)?.camDonBay).toBeUndefined();
  });
  const rai = (ids: readonly string[]) => ids.filter((x) => x.startsWith('rai_lenh_'));
  it('⭐ Rải lệnh chỉ chào vai đặc biệt; Cá nhân không bao giờ thấy; tối đa một cấp mỗi lượt mời', () => {
    let coDacBiet = 0;
    for (let seed = 1; seed <= 400; seed++) {
      expect(rai(bayTrait(seed, 'ban', 5, 0, [], KHO_TRAIT_HEP, 'ca_nhan')), `seed ${seed}`).toEqual([]);
      const r = rai(bayTrait(seed, 'ban', 5, 0, [], KHO_TRAIT_HEP, 'to_chuc'));
      expect(r.length).toBeLessThanOrEqual(1);
      coDacBiet += r.length;
    }
    expect(coDacBiet, 'vai đặc biệt phải có lúc được chào Rải lệnh').toBeGreaterThan(0);
  });
  it('⭐ đang mang một cấp Rải lệnh ⇒ không còn thấy cấp nào khác', () => {
    for (let seed = 1; seed <= 400; seed++) expect(rai(bayTrait(seed, 'ban', 9, 0, ['rai_lenh_2'], KHO_TRAIT_HEP, 'ca_map'))).toEqual([]);
  });
  it('kho chung (khoá cũ, không kho hẹp) không bao giờ chào trait độc quyền — cú xáo khoá cũ không đổi', () => {
    for (let seed = 1; seed <= 200; seed++) expect(rai(bayTrait(seed, 'ban', 5, 0, [], undefined, 'to_chuc'))).toEqual([]);
    // D528 — trait độc quyền: họ Rải lệnh + KÊ MUA / KÊ BÁN (ba vai không mang sẵn; chỉ ở kho v59, không bao giờ ở kho hẹp v57/v58).
    expect(TRAIT.filter((t) => t.chiVai).every((t) => t.ho === 'rai_lenh' || t.id === 'ke_mua' || t.id === 'ke_ban')).toBe(true);
    expect(KHO_TRAIT_HEP.includes('ke_mua') || KHO_TRAIT_HEP.includes('ke_ban')).toBe(false);
  });
  it('câu chữ vai Tổ Chức khớp số config (đổi số mà quên câu ⇒ đỏ); chỉ áp dưới cờ', () => {
    const c = CHU_VAI_TO_CHUC_V57.to_chuc!;
    expect(c.dac_quyen).toContain(`×${String(TO_CHUC_V57.TRUOT_THOA_THUAN).replace('.', ',')}`);
    expect(c.dac_quyen).toContain(`+${String(TO_CHUC_V57.PHI_QL_BP / 100).replace('.', ',')}% NAV`);
    expect(c.cai_gia).toContain(`−${TO_CHUC_V57.TRAN_THUA_BP / 100}%`);
    expect(c.cai_gia).toContain(`${MANDATE_TO_CHUC.TRAN_MA_BP / 100}% NAV`);
    expect(vaiTheoLuat(luatCua(V57)).to_chuc.cai_gia).toBe(c.cai_gia);
    expect(vaiTheoLuat(luatCua('balance-v56-congdon')).to_chuc.cai_gia).not.toBe(c.cai_gia);
  });
});

describe('§III — qua HTTP + DB (đường chính)', () => {
  let db: TestDb; let pool: pg.Pool; let app: Hono<any>; let tester: TestUser;
  beforeAll(async () => {
    db = await startTestDb(); pool = db.pool;
    app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
    tester = await createTestUser(pool, { role: 'admin' });
    await pool.query('UPDATE users SET la_tester = true WHERE user_id = $1', [tester.userId]);   // ep_vai chỉ mở cho admin + tester
  }, 120_000);
  afterAll(async () => { await db?.stop(); });
  const json = async (path: string, init: RequestInit = {}): Promise<any> => (await app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie: tester.cookie, ...(init.headers ?? {}) },
  })).json();

  it('⭐ Tổ Chức: quầy lõi KHÔNG có Đòn Bẩy; nộp vòng 1 ⇒ phí quản lý = floor(NAV × PHI_QL_BP/10⁴) vào tiền mặt, response kể dòng đó', async () => {
    let gapDonBayOChoKhac = false;
    for (let lan = 0; lan < 8; lan++) {
      const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V57, ep_vai: 'to_chuc' }) });
      expect(t.error, JSON.stringify(t).slice(0, 200)).toBeUndefined();
      expect(t.ban.vai, 'ep_vai phải ăn — người tạo là admin + tester').toBe('to_chuc');
      expect(t.shop?.chien_thuat ?? [], 'quầy của Tổ Chức không bày Đòn Bẩy').not.toContain('don_bay');
      const vaiBan = (t.ghe ?? []).map((g: any) => g.vai);
      if (vaiBan.filter((v: string) => DAC_BIET.includes(v)).length >= 2) gapDonBayOChoKhac = true;
      if (lan > 0) continue;
      const r = await json(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
        method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: ['don_bay'], hanh_dong: 'giu_vi_the', them: 0, lenh: [{ ma: 'vang', chieu: 'mua', moc_bp: 5000 }] }),
      });
      expect(r.error, JSON.stringify(r).slice(0, 200)).toBeUndefined();
      expect(r.ban.danh_muc.chien_thuat, 'body gửi mua Đòn Bẩy ⇒ server lọc ở tầng nhận').not.toContain('don_bay');
      const ql = r.ket_qua_vong?.quan_ly_cua_ban;
      expect(ql, JSON.stringify(r.ket_qua_vong ?? {}).slice(0, 300)).toBeDefined();
      expect(ql.tien).toBe(Math.floor((ql.nav * TO_CHUC_V57.PHI_QL_BP) / 10000));
      expect(ql.tien).toBeGreaterThan(0);
    }
    void gapDonBayOChoKhac;
  }, 300_000);
});
