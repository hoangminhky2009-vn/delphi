/**
 * D342 — LÕI BÁN KHỐNG QUA ENDPOINT THẬT (`/rounds`, `/khop-lenh`). Bẫy số 1 của repo là hàm
 * đúng mà đường chạy thật không gọi — trận founder 16/09 chết đúng ở chỗ đó: `loi_von.lenh` có
 * trong payload từ v10 mà không ai đọc, và sổ khống có định giá đảo dấu mà không mã nào tới.
 *
 * Bàn 8 ô (đối chứng, KHÔNG vai — vai bốc thăm ở bàn ≥ 12 có thể ra Tổ Chức bị cấm khống hoặc
 * vốn ×3, và `ep_vai` chỉ mở cho tester), ghế cầm sẵn lá Bán Khống.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { BAN_KHONG_LENH } from '../config/holdem.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function gui(path: string, init: RequestInit = {}): Promise<Response> {
  return app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
}
const json = async (path: string, init: RequestInit = {}): Promise<any> =>
  (await gui(path, init)).json();

const taoTran = (phienBan: string) => json('/api/v1/holdem/matches', {
  method: 'POST',
  body: JSON.stringify({
    ep_balance: phienBan, ep_chien_thuat: ['ban_khong'], so_o: 8,
  }),
});
const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}) =>
  json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [], ...them,
    }),
  });
const tong = (r: Record<string, number> | undefined) =>
  Object.values(r ?? {}).reduce((a, b) => a + b, 0);

describe('I. ⭐ /rounds — chip KHỐNG 100% không còn bị bác', () => {
  it('v49: KHỐNG btc 100% ⇒ không lỗi, sổ khống mở, cờ hạn mức về payload', async () => {
    const t = await taoTran('balance-v49-bankhong');
    const r = await nopVong(t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'khong', moc_bp: 10000 }] });
    expect(r.loi_von?.lenh, 'v49 mà vẫn bị bác').toBeUndefined();
    expect(r.ban.khong_theo_han_muc).toBe(true);
    const k = r.ban.vi_the_khong.btc as number;
    expect(k).toBeGreaterThan(0);
    // Ký quỹ mở ≤ trần 30% vốn đầu (10.000); giá của vòng nhân tối đa ×2 (mã về 0).
    expect(k).toBeLessThanOrEqual(Math.floor((10000 * BAN_KHONG_LENH.TRAN_BP) / 10000) * 2);
  });

  it('⚠ v48 (giữ nguyên cho replay): cùng lệnh ⇒ `loi_von.lenh = qua_tran_khong`, không sổ khống', async () => {
    const t = await taoTran('balance-v48-doitac');
    const r = await nopVong(t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'khong', moc_bp: 10000 }] });
    expect(r.loi_von?.lenh).toBe('qua_tran_khong');
    expect(tong(r.ban.vi_the_khong)).toBe(0);
    expect(r.ban.khong_theo_han_muc).toBeUndefined();
  });

  it('⭐ founder vòng 4: [RÚT btc HẾT, KHỐNG btc 100%] — v49 chạy cả hai, v48 mất cả lệnh bán', async () => {
    for (const [pb, chay] of [['balance-v49-bankhong', true], ['balance-v48-doitac', false]] as const) {
      const t = await taoTran(pb);
      await nopVong(t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] });
      const r = await nopVong(t.match_id, 2, {
        lenh: [{ ma: 'btc', chieu: 'ban', moc_bp: 10000 }, { ma: 'btc', chieu: 'khong', moc_bp: 10000 }],
      });
      if (chay) {
        expect(r.loi_von?.lenh, `${pb}`).toBeUndefined();
        expect(r.ban.vi_the.btc, `${pb}: lệnh bán không chạy`).toBeUndefined();
        expect(r.ban.vi_the_khong.btc, `${pb}: lệnh khống không chạy`).toBeGreaterThan(0);
      } else {
        expect(r.loi_von?.lenh, `${pb}`).toBe('qua_tran_khong');
        expect(r.ban.vi_the.btc, `${pb}: lỗi cũ — cả chuỗi bị bác nên btc vẫn còn`).toBeGreaterThan(0);
      }
    }
  });
});

describe('II. ⭐⭐ sổ khống ăn giá chợ — qua payload thật', () => {
  it('v49: mọi vòng khống btc có dòng `khong_gia` với giá ĐÚNG bằng lợi suất công khai của btc', async () => {
    const t = await taoTran('balance-v49-bankhong');
    let r = await nopVong(t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'khong', moc_bp: 10000 }] });
    let coGia = 0;
    for (let v = 2; v <= 7; v += 1) {
      r = await nopVong(t.match_id, v, { lenh: [] });
      const cb = r.ket_qua_vong?.cua_ban;
      const cong = cb?.loi_suat_ma?.btc as number | undefined;
      if (!cb || cong === undefined || tong(r.ban.vi_the_khong) === 0) continue;
      const mx = (cb.chain as { kind: string; gia_bp?: number; delta_bp: number }[])
        .find((m) => m.kind === 'khong_gia');
      if (cong === 0) { expect(mx).toBeUndefined(); continue; }
      expect(mx, `vòng ${v}: thiếu dòng giá sổ khống`).toBeDefined();
      expect(mx!.gia_bp, `vòng ${v}`).toBe(cong);
      expect(mx!.delta_bp, `vòng ${v}`).toBe(-cong);
      coGia += 1;
    }
    expect(coGia, 'không vòng nào có giá — bài rỗng').toBeGreaterThan(2);
  });
});

describe('III. /khop-lenh — lý do đi bằng MÃ, câu không chứa mã thô', () => {
  it('v48: khớp KHỐNG 100% ⇒ 409 kèm `ly_do: qua_tran_khong`', async () => {
    const t = await taoTran('balance-v48-doitac');
    const res = await gui(`/api/v1/holdem/matches/${t.match_id}/khop-lenh`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, lenh: [{ ma: 'btc', chieu: 'khong', moc_bp: 10000 }] }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string; message: string; ly_do?: string };
    expect(body.error).toBe('lenh_khong_khop');
    expect(body.ly_do).toBe('qua_tran_khong');
    expect(body.message, 'mã thô còn nằm trong câu').not.toContain('qua_tran_khong');
  });

  it('v49: khớp KHỐNG 100% ⇒ khớp thật, GET thấy sổ khống', async () => {
    const t = await taoTran('balance-v49-bankhong');
    const res = await gui(`/api/v1/holdem/matches/${t.match_id}/khop-lenh`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, lenh: [{ ma: 'btc', chieu: 'khong', moc_bp: 10000 }] }),
    });
    expect(res.status).toBe(200);
    const st = await json(`/api/v1/holdem/matches/${t.match_id}`);
    expect(st.ban.vi_the_khong.btc).toBeGreaterThan(0);
  });
});

describe('D345 — cờ phí lệnh nhẹ (v50) đi qua endpoint thật', () => {
  it('v50: `ban.phi_lenh_nhe` về payload và phí mua bán ALL-IN btc nhẹ hơn v49 quá nửa; v49 vắng cờ', async () => {
    const phi: Record<string, number> = {};
    for (const pb of ['balance-v50-phinhe', 'balance-v49-bankhong'] as const) {
      const t = await taoTran(pb);
      const r = await nopVong(t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }] });
      expect(r.loi_von?.lenh, `${pb}: lệnh bị bác`).toBeUndefined();
      if (pb === 'balance-v50-phinhe') {
        expect(r.ban.phi_lenh_nhe, 'v50 mà màn không nhận cờ ⇒ xem trước báo phí bảng cũ').toBe(true);
        // Bàn 8 không vai, ghế không cầm Khớp Nhanh ⇒ không có phần còn lại.
        expect(r.ban.phi_lenh_con_bp).toBeUndefined();
      } else {
        expect(r.ban.phi_lenh_nhe).toBeUndefined();
      }
      const dong = (r.ket_qua_vong.cau_noi_nav ?? []) as { id: string; tien: number }[];
      phi[pb] = -(dong.find((d) => d.id === 'phi_giao_dich')?.tien ?? 0);
    }
    expect(phi['balance-v50-phinhe']).toBeGreaterThan(0);
    expect(phi['balance-v50-phinhe']! * 2, `v50 ${phi['balance-v50-phinhe']} vs v49 ${phi['balance-v49-bankhong']}`)
      .toBeLessThan(phi['balance-v49-bankhong']!);
  });
});

describe('D346 — cờ phí HAI BẬC (v51) đi qua endpoint thật', () => {
  it('v51: `ban.phi_lenh_bac` về payload và phí ALL-IN btc NẶNG hơn v50; v50 vắng cờ', async () => {
    const phi: Record<string, number> = {};
    for (const pb of ['balance-v51-phibac', 'balance-v50-phinhe'] as const) {
      const t = await taoTran(pb);
      const r = await nopVong(t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }] });
      expect(r.loi_von?.lenh, `${pb}: lệnh bị bác`).toBeUndefined();
      expect(r.ban.phi_lenh_nhe, `${pb}`).toBe(true);
      if (pb === 'balance-v51-phibac') {
        expect(r.ban.phi_lenh_bac, 'v51 mà màn không nhận cờ ⇒ xem trước báo bảng v50').toBe(true);
      } else {
        expect(r.ban.phi_lenh_bac).toBeUndefined();
      }
      const dong = (r.ket_qua_vong.cau_noi_nav ?? []) as { id: string; tien: number }[];
      phi[pb] = -(dong.find((d) => d.id === 'phi_giao_dich')?.tien ?? 0);
    }
    // Dồn hết: v51 là cái phanh ⇒ nặng hơn v50 (7,9% vs 4% ở cổ phiếu, crypto gấp đôi).
    expect(phi['balance-v51-phibac'], `v51 ${phi['balance-v51-phibac']} vs v50 ${phi['balance-v50-phinhe']}`)
      .toBeGreaterThan(phi['balance-v50-phinhe']!);
  });

  it('v51: lệnh 25% vốn NHẸ hơn hẳn v50 — bậc 1 đúng là bậc rẻ', async () => {
    const phi: Record<string, number> = {};
    for (const pb of ['balance-v51-phibac', 'balance-v50-phinhe'] as const) {
      const t = await taoTran(pb);
      const r = await nopVong(t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] });
      const dong = (r.ket_qua_vong.cau_noi_nav ?? []) as { id: string; tien: number }[];
      phi[pb] = -(dong.find((d) => d.id === 'phi_giao_dich')?.tien ?? 0);
    }
    expect(phi['balance-v51-phibac']! * 2).toBeLessThan(phi['balance-v50-phinhe']!);
  });
});
