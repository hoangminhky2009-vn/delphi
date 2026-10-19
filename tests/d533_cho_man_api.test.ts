/**
 * D533 — NHÁNH CHỜ MÀN qua HTTP + DB thật (founder 06/10: chốt vòng 1 xong không có màn, bàn khoá hết nút).
 *
 * Trước D533 cú nộp ở vòng có màn trả `dtoChoMan` và BỎ MẤT hai thứ:
 *   · `loi_von` — lệnh bị bác nói vì sao. Bàn 8 có màn ở 5/7 vòng ⇒ phần lớn lệnh bị bác IM LẶNG: người chơi chỉ thấy "không có màn"
 *     (bộ quét 06/10: Tổ Chức bấm 50 % một mã ⇒ `mandate_ma` ⇒ không cầm mã ⇒ `khong_co_ma`).
 *   · mốc hết màn — web không biết lúc nào hỏi lại, nên đứng ở vòng vừa nộp.
 * Nay `cho_man.het_ms` (còn bao lâu màn hết, đo ở server lúc trả) đi kèm cả response nộp lẫn GET trạng thái; `loi_von` đi kèm response nộp.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { giayManMinigame, HOLDEM_BALANCE_VERSION } from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

/** Màn neo vào lúc chốt: lật thẻ + chọn lá + đếm ngược + chạy (cùng công thức `layTran`). */
// D561 — độ dài màn theo luật của khoá MẶC ĐỊNH (v65 bỏ pha chọn lá) — một nguồn `giayManMinigame`, không gõ cứng từng pha.
const DAI_MAN_MS = giayManMinigame(luatCua(HOLDEM_BALANCE_VERSION).loiChonTruoc === true) * 1000;

describe('D533 — nhánh chờ màn: mốc hết màn + lý do lệnh bị bác', () => {
  let db: TestDb; let pool: pg.Pool; let app: Hono<any>; let tester: TestUser;
  beforeAll(async () => {
    db = await startTestDb(); pool = db.pool;
    app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
    tester = await createTestUser(pool, { role: 'admin' });
    await pool.query('UPDATE users SET la_tester = true WHERE user_id = $1', [tester.userId]);
  }, 120_000);
  afterAll(async () => { await db?.stop(); });
  const json = async (path: string, init: RequestInit = {}): Promise<any> => (await app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie: tester.cookie, ...(init.headers ?? {}) },
  })).json();
  const nop = (id: string, lenh: object[]) => json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, lenh }),
  });

  it('⭐ Tổ Chức mua 50 % một mã ở vòng 1 (có màn) ⇒ response nộp có `cho_man.het_ms` ≈ độ dài màn VÀ `loi_von.lenh = mandate_ma`', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_vai: 'to_chuc' }) });
    expect(t.lich_man, 'trận mặc định có màn ở vòng 1').toContain(1);
    const r = await nop(t.match_id, [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }]);
    expect(r.error, JSON.stringify(r).slice(0, 200)).toBeUndefined();
    expect(r.cho_man?.vong).toBe(1);
    expect(r.loi_von?.lenh, 'lệnh bị bác phải NÓI RA cả ở vòng có màn').toBe('mandate_ma');
    /*
     * D549 — lệnh bị bác ⇒ không cầm mã ⇒ không có màn riêng, bàn toàn máy ⇒ KHÔNG chờ: `het_ms` 0, GET là vòng 2 ngay (web mang `loi_von` của cú
     * nộp sang vòng mới — `kemLoiVon`). Trước D549 chỗ này chờ ~49 s (bài cũ khoá `het_ms` ≈ độ dài màn).
     */
    expect(r.cho_man.het_ms).toBe(0);
    const g = await json(`/api/v1/holdem/matches/${t.match_id}`);
    expect(g.vong).toBe(2);
    expect(g.cho_man).toBeUndefined();
  }, 300_000);

  it('vế ngược: Cá nhân 25 % ⇒ `loi_von` null, vẫn có mốc; hết màn ⇒ GET sang vòng 2, không còn `cho_man`', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_vai: 'ca_nhan' }) });
    const r = await nop(t.match_id, [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]);
    expect(r.loi_von).toBeNull();
    // Cầm mã ⇒ có màn riêng ⇒ chờ đủ lịch chung (bài D533 cũ khoá độ dài này ở ca Tổ Chức; D549 dời sang ca cầm mã).
    expect(r.cho_man?.het_ms).toBeGreaterThan(DAI_MAN_MS - 5000);
    expect(r.cho_man?.het_ms).toBeLessThanOrEqual(DAI_MAN_MS);
    await pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '60 seconds' WHERE match_id = $1`, [t.match_id]);
    const g = await json(`/api/v1/holdem/matches/${t.match_id}`);
    expect(g.cho_man).toBeUndefined();
    expect(g.vong).toBe(2);
  }, 300_000);
});
