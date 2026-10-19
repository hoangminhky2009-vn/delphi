/**
 * D402 — GIẢI VÒNG TRẢ VỀ GHẾ: server phát phần quỹ vòng TỪNG ghế nhận (`ket_qua_vong.chia_quy_vong`), để client vẽ xu
 * bay từ hộp GIẢI về từng ghế ở bước LÃI/LỖ (founder 24/09: *"TRẢ giải về 3 ghế đầu cùng nhịp LÃI/LỖ"*; C4 — client
 * không tự chia).
 *
 * Bất biến khoá ở đây, qua endpoint thật, ở MỌI vòng của nhiều trận:
 *  1. TIỀN PHẢI CÂN: tổng phần chia = tổng giải `quy_vong` (khi có người tranh giải) — không chip nào rơi, không chip
 *     nào đẻ ra.
 *  2. Hạng liền 1…k, xếp theo lãi/lỗ vòng GIẢM DẦN (đúng luật chia của engine), chỉ ghế nhận > 0.
 *  3. Phần của ghế mình = dòng cầu nối "Ăn chia cược" (`cau_noi_nav.quy_vong`) — hai đường tính, một con số.
 * Replay trận cũ không đổi (golden) nằm ở `holdem_replay_golden.test.ts` — trường mới đứng NGOÀI `ketQua`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { quaManNeuCo } from './helpers/minigame.js';
import { xuGiaiTheoHang } from '../config/holdem.js';

/** D584 — khoá mặc định trả giải bằng XU (v68) ⇒ bất biến TIỀN của giải đo trên khoá prod còn giải tiền (v66): ghim trận ngay sau khi tạo. */
const KHOA_GIAI_TIEN = 'balance-v66-laiap';

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

const json = async (path: string, init: RequestInit = {}): Promise<any> => (await app.request(
  `http://localhost${path}`,
  { ...init, headers: { 'content-type': 'application/json', cookie: user.cookie } },
)).json();
// D525 — khoá mặc định có màn lõi: kết quả vòng hiện SAU màn ⇒ qua màn rồi đọc trạng thái thật (`quaManNeuCo`).
const nopVong = async (id: string, vong: number) => quaManNeuCo(pool, id, await json(`/api/v1/holdem/matches/${id}/rounds`, {
  method: 'POST',
  body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [], lenh: [] }),
}), () => json(`/api/v1/holdem/matches/${id}`));

type Chia = { ghe_id: string; hang: number; tien: number; xu?: number };

describe('GIẢI VÒNG trả về ghế — số của server, cân từng chip', () => {
  it('⭐ mọi vòng: tổng phần chia = giải · hạng 1…k theo lãi/lỗ vòng · phần của mình = dòng "Ăn chia cược"', async () => {
    let soVongCoChia = 0;
    let soVongMinhNhan = 0;
    for (let n = 0; n < 6; n += 1) {
      const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ so_o: 8 }) });
      expect(t.match_id, 'không tạo được trận').toBeTypeOf('string');
      await pool.query('UPDATE holdem_matches SET balance_version = $2 WHERE match_id = $1', [t.match_id, KHOA_GIAI_TIEN]);
      // ⭐ Trước chốt vòng đầu KHÔNG có gì để lộ: trạng thái mở trận không mang phần chia nào.
      expect(t.ket_qua_vong?.chia_quy_vong, 'lộ phần chia trước khi có vòng nào chốt').toBeUndefined();
      const cuoi = Number(t.tong_vong);
      for (let v = 1; v <= cuoi; v += 1) {
        const r = await nopVong(t.match_id, v);
        const kv = r.ket_qua_vong;
        if (!kv) break;
        const chia = (kv.chia_quy_vong ?? []) as Chia[];
        if (kv.quy_vong > 0 && kv.ghe_thang !== null) {
          expect(chia.length, `trận ${n} vòng ${v}: có giải mà không ai nhận`).toBeGreaterThan(0);
        }
        if (chia.length === 0) continue;
        soVongCoChia += 1;
        // 1. Tiền phải cân.
        expect(chia.reduce((a, c) => a + c.tien, 0), `trận ${n} vòng ${v}: tổng phần chia ≠ giải`).toBe(kv.quy_vong);
        expect(chia.every((c) => Number.isInteger(c.tien) && c.tien > 0), 'phần chia phải là số nguyên dương (C5)').toBe(true);
        // 2. Hạng liền 1…k, lãi/lỗ vòng giảm dần.
        expect(chia.map((c) => c.hang)).toEqual(chia.map((_, i) => i + 1));
        const pnl = new Map<string, number>([
          ...(kv.cua_ban ? [[kv.cua_ban.ghe_id, kv.cua_ban.pnl_bp] as [string, number]] : []),
          ...(kv.cua_doi_thu as { ghe_id: string; pnl_bp: number }[]).map((d) => [d.ghe_id, d.pnl_bp] as [string, number]),
        ]);
        for (let i = 1; i < chia.length; i += 1) {
          expect(pnl.get(chia[i - 1]!.ghe_id)!, `trận ${n} vòng ${v}: hạng ${i} lãi ít hơn hạng ${i + 1}`)
            .toBeGreaterThanOrEqual(pnl.get(chia[i]!.ghe_id)!);
        }
        expect(new Set(chia.map((c) => c.ghe_id)).size, 'một ghế xuất hiện hai lần').toBe(chia.length);
        // 3. Phần của mình = dòng "Ăn chia cược" của cầu nối NAV (khi không có khoản trừ sau chia: siết · ký quỹ).
        const cuaMinh = chia.find((c) => c.ghe_id === 'ban');
        const dongQuy = ((kv.cau_noi_nav ?? []) as { id: string; tien: number }[]).find((d) => d.id === 'quy_vong');
        if (cuaMinh && !kv.siet_cua_ban && !kv.ky_quy_cua_ban && dongQuy) {
          soVongMinhNhan += 1;
          expect(dongQuy.tien, `trận ${n} vòng ${v}: hai đường tính phần của mình lệch nhau`).toBe(cuaMinh.tien);
        }
      }
    }
    // Bài phải thật sự đi qua các nhánh — không thì nó xanh mà không canh gì.
    expect(soVongCoChia, 'không vòng nào có phần chia — bài rỗng').toBeGreaterThan(5);
    expect(soVongMinhNhan, 'chưa từng gặp vòng ghế mình nhận giải — vế 3 rỗng').toBeGreaterThan(0);
  }, 600_000);

  it('⭐ D584 khoá mặc định (giải bằng XU TRAIT): hũ tiền 0 · mỗi suất 0 tiền, đúng `xuGiaiTheoHang(hạng)` xu · hạng theo lãi/lỗ vòng · không dòng "Ăn chia cược"', async () => {
    let soVong = 0;
    for (let n = 0; n < 3; n += 1) {
      const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ so_o: 8 }) });
      expect(t.giai_xu_hien_tai, 'hộp GIẢI không biết tổng xu').toBeGreaterThan(0);
      for (let v = 1; v <= Number(t.tong_vong); v += 1) {
        const kv = (await nopVong(t.match_id, v)).ket_qua_vong;
        if (!kv) break;
        expect(kv.quy_vong, 'khoá giải xu mà vẫn có hũ tiền').toBe(0);
        const chia = (kv.chia_quy_vong ?? []) as Chia[];
        if (chia.length === 0) continue;
        soVong += 1;
        expect(chia.every((c) => c.tien === 0 && c.xu === xuGiaiTheoHang(c.hang))).toBe(true);
        const pnl = new Map<string, number>([
          ...(kv.cua_ban ? [[kv.cua_ban.ghe_id, kv.cua_ban.pnl_bp] as [string, number]] : []),
          ...(kv.cua_doi_thu as { ghe_id: string; pnl_bp: number }[]).map((d) => [d.ghe_id, d.pnl_bp] as [string, number]),
        ]);
        for (let i = 1; i < chia.length; i += 1) expect(pnl.get(chia[i - 1]!.ghe_id)!).toBeGreaterThanOrEqual(pnl.get(chia[i]!.ghe_id)!);
        expect(((kv.cau_noi_nav ?? []) as { id: string; tien: number }[]).some((d) => d.id === 'quy_vong' && d.tien !== 0), 'giải xu mà NAV vẫn nhận tiền giải').toBe(false);
      }
    }
    expect(soVong).toBeGreaterThan(5);
  }, 600_000);
});
