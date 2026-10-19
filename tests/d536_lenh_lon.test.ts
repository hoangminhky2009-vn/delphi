/**
 * D536 — LỆNH LỚN trong màn + CỘT KHỐI LƯỢNG (founder 06/10: *"Làm đủ như demo"*). Demo `minigame-bat-day.html` `cungMap`: bot Cá Mập cùng mã GOM Ở ĐÁY
 * (+6 % dốc 3 nến hiện, một nến hiện sau đáy · −3 % dốc 2 nến hiện khi còn 4 nến hiện), bot Đội Lái KÉO RỒI XẢ (+6 % dốc 2 nến hiện ở nến hiện 4–7 · −8 %
 * dốc 1 nến hiện 7 nến hiện sau, + tin hội nhóm một nến hiện sau cú kéo). Mỗi cú 30 % ở lại, 70 % tan trong 4 nến hiện (`lechLuc` nhánh không-tạm).
 * Khối lượng nến bị đè + |mag| × 30 / số nến mịn trải (`volXung`).
 *
 * Vector tay (K_MIN 2 ⇒ nến hiện = 2 nến mịn; màn chạy 60 nến mịn; đáy ở nến mịn chạy 20):
 *  · Cá Mập ⇒ cú kéo t0 = min(60 − 3, 20 + 2) = 22, trai 6, tan 8, mag +0,06, con 0,3 · cú xả t0 = 60 − 4 × 2 = 52, trai 4, mag −0,03.
 *  · lệch ở s = 28 (dốc xong) = 0,06 · s = 36 (tan xong) = 0,06 × 0,3 = 0,018 · s = 32 (tan nửa) = 0,06 × (0,3 + 0,7 × 0,5) = 0,039.
 *  · khối lượng: nến 22…27 mỗi nến + 0,06 × 30 / 6 = 0,3; nến 21 và 28 không đổi.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { K_MIN, LENH_LON_BOT, NEN_LS } from '../config/minigame.js';
import { apLenhLon, keoDoiLaiT0, khoiLuongChay, lechTl, neoVeDich, xungGai, xungLenhLon, apXungGai, type NenMin } from '../server/holdem/minigame/dong_gia.js';
import { tinDayDu } from '../server/holdem/minigame/tin.js';

const N0 = NEN_LS * K_MIN;
/** 80 nến mịn phẳng ở 100 (khối lượng 1), đáy (râu thấp) ở nến mịn chạy `day`. */
const phang = (day = 20): NenMin[] => Array.from({ length: N0 + 60 }, (_, i) => ({
  o: 100, c: 100, h: 100.5, l: i - N0 === day ? 90 : 99.5, tick: Array(8).fill(100), v: 1, iSong: i - N0, rut: 0, quet: null,
}));

describe('§I — luật lệnh lớn (vector tay)', () => {
  it('hằng số chép nguyên demo (PLAYTEST-TUNE)', () => {
    expect(LENH_LON_BOT).toEqual({
      CA_MAP: { KEO: 0.06, KEO_TRAI: 3, SAT_CUOI: 3, XA: -0.03, XA_TRAI: 2, XA_TRUOC_CUOI: 4 },
      DOI_LAI: { TU: 4, THEM: 4, KEO: 0.06, KEO_TRAI: 2, XA_SAU: 7, XA: -0.08, XA_TRAI: 1 },
      O_LAI: 0.3, TAN: 4, VOL: 30,
    });
  });
  it('⭐ Cá Mập: cú kéo một nến hiện sau ĐÁY (đọc đường gốc), cú xả khi còn 4 nến hiện', () => {
    expect(xungLenhLon(phang(20), 7, ['ca_map'])).toEqual([
      { ai: 'ca_map', t0: 22, mag: 0.06, trai: 6, tan: 8, con: 0.3 },
      { ai: 'ca_map', t0: 52, mag: -0.03, trai: 4, tan: 8, con: 0.3 },
    ]);
    // đáy sát cuối ⇒ kẹp ở 60 − 3
    expect(xungLenhLon(phang(58), 7, ['ca_map'])[0]!.t0).toBe(57);
  });
  it('⭐ Đội Lái: kéo ở nến hiện 4–7 theo seed, xả −8 % sau 7 nến hiện; MỘT nguồn thời điểm với tin của nó', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const t0 = keoDoiLaiT0(seed);
      expect([8, 10, 12, 14]).toContain(t0);
      expect(xungLenhLon(phang(), seed, ['doi_lai'])).toEqual([
        { ai: 'doi_lai', t0, mag: 0.06, trai: 4, tan: 8, con: 0.3 },
        { ai: 'doi_lai', t0: t0 + 14, mag: -0.08, trai: 2, tan: 8, con: 0.3 },
      ]);
    }
    expect(xungLenhLon(phang(), 1, [])).toEqual([]);
  });
  it('⭐ 30 % ở lại, 70 % tan trong 4 nến hiện (demo `lechLuc` nhánh không-tạm)', () => {
    const [keo] = xungLenhLon(phang(20), 7, ['ca_map']);
    expect(lechTl([keo!], 28)).toBeCloseTo(0.06, 12);
    expect(lechTl([keo!], 32)).toBeCloseTo(0.039, 12);
    expect(lechTl([keo!], 36)).toBeCloseTo(0.018, 12);
    expect(lechTl([keo!], 50)).toBeCloseTo(0.018, 12);
  });
  it('⭐ áp lên đường: mốc cuối nến 27 (s = 28) = 100 × 1,06; nến trước cú không đổi', () => {
    const min = phang(20);
    apLenhLon(min, xungLenhLon(min, 7, ['ca_map']).slice(0, 1));
    expect(min[N0 + 27]!.tick[7]).toBeCloseTo(106, 9);
    expect(min[N0 + 21]!.tick).toEqual(Array(8).fill(100));
  });
  it('⭐ khối lượng: nến 22…27 + 0,3; nến 21 và 28 giữ 1', () => {
    const kl = khoiLuongChay(phang(20), xungLenhLon(phang(20), 7, ['ca_map']).slice(0, 1));
    expect(kl.slice(21, 29).map((x) => +x.toFixed(9))).toEqual([1, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 1]);
    expect(kl).toHaveLength(60);
  });
  it('neo % engine sau các cú (D479): điểm cuối = giá mở × (1 + bp / 10⁴) dù cú để lại 30 %', () => {
    const min = phang(20);
    apLenhLon(min, xungLenhLon(min, 3, ['ca_map', 'doi_lai']));
    neoVeDich(min, 250);
    expect(min[min.length - 1]!.c / min[N0 - 1]!.c).toBeCloseTo(1.025, 9);
  });
  it('tin gài của Đội Lái (người) dùng CÙNG một cú với `apXungGai` (một công thức)', () => {
    const x = xungGai(42, 1, 1.3), min = phang();
    expect(apXungGai(min, 42, 1, 1.3)).toBe(x.ci);
    expect(min[N0 + Math.floor(x.t0 + x.trai)]!.tick[7]! / 100 - 1).toBeCloseTo(lechTl([x], Math.floor(x.t0 + x.trai) + 1), 12);
  });
});

describe('§II — tin của bot Đội Lái (demo: gài "đang được gom mạnh" một nến hiện sau cú kéo)', () => {
  it('⭐ có Đội Lái cùng mã ⇒ một tin hội nhóm `bot.doi_lai`, nhiễu, lời tốt; không có ⇒ không', () => {
    const co = tinDayDu({ tin: [], hinh: '__khong_co__', seed: 77, lon: ['doi_lai'] }, phang(), 0);
    expect(co).toEqual([{ id: 0, tang: 0, ci: keoDoiLaiT0(77) + K_MIN, ng: 'hoi_nhom', chu: 'bot.doi_lai', noi: 1, huong: 0, that: false }]);
    expect(tinDayDu({ tin: [], hinh: '__khong_co__', seed: 77, lon: ['ca_map'] }, phang(), 0)).toEqual([]);
    expect(tinDayDu({ tin: [], hinh: '__khong_co__', seed: 77 }, phang(), 0)).toEqual([]);
  });
});

describe('§III — nối vào màn thật: ghế BOT Cá Mập / Đội Lái giữ cùng mã', async () => {
  const { luatCua } = await import('../config/holdem_balance.js');
  const { taoTran } = await import('../server/holdem/engine.js');
  const { boiCanhCuaGhe, vaiLonCung } = await import('../server/holdem/minigame/quyet_toan.js');
  const ghe = (id: string, loai: 'nguoi' | 'bot') => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } }) as never;
  const ban = (khoa: string, vai: Record<string, string>, viThe: Record<string, Record<string, number>>) => {
    const st = taoTran(11, [ghe('ban', 'nguoi'), ghe('g1', 'bot'), ghe('g2', 'bot'), ghe('g3', 'bot')], luatCua(khoa), 12);
    return { ...st, vong: 3, ghe: st.ghe.map((g) => ({ ...g, vai: vai[g.id] ?? 'ca_nhan', trait: [], vi_the: viThe[g.id] ?? {},
      danh_muc: { ...g.danh_muc, chien_thuat: ['bat_day'] as never } })) } as never;
  };
  const bcCua = (st: any, i = 0) => {
    const bc = boiCanhCuaGhe(st, 11, 2, st.ghe[i], { btc: 300 });
    if ('loi' in bc) throw new Error(bc.loi);
    return bc;
  };
  it('⭐ v61: bot Cá Mập + bot Đội Lái giữ BTC ⇒ lon [ca_map, doi_lai]; ghế NGƯỜI Cá Mập không tính', () => {
    const st = ban('balance-v61-lenhlon', { ban: 'ca_map', g2: 'doi_lai', g3: 'ca_map' }, { ban: { btc: 100000 }, g1: { btc: 9 }, g2: { btc: 5000 }, g3: { btc: 5000 } });
    expect(bcCua(st).lon).toEqual(['ca_map', 'doi_lai']);
    expect(vaiLonCung(st, 'ban')).toEqual({ btc: ['ca_map', 'doi_lai'] });
    // từ phía một ghế BOT: người Cá Mập giữ BTC không thành kịch bản lệnh lớn (lệnh thật của người đè qua cú tự đẩy — D507)
    const st2 = ban('balance-v61-lenhlon', { ban: 'ca_map', g2: 'doi_lai' }, { ban: { btc: 100000 }, g2: { btc: 5000 } });
    expect(vaiLonCung(st2, 'g1')).toEqual({ btc: ['doi_lai'] });
  });
  it('bot vai lớn giữ mã KHÁC ⇒ lon rỗng (khoá vẫn có cột khối lượng); chính ghế bot không tự tính mình', () => {
    const st = ban('balance-v61-lenhlon', { g2: 'doi_lai', g3: 'ca_map' }, { ban: { btc: 100000 }, g2: { vang: 5000 }, g3: { btc: 5000 } });
    expect(bcCua(st).lon).toEqual(['ca_map']);
    expect(vaiLonCung(st, 'g3')).toEqual({ vang: ['doi_lai'] });
    const st2 = ban('balance-v61-lenhlon', { g3: 'ca_map' }, { ban: { btc: 100000 }, g3: { vang: 5000 } });
    expect(bcCua(st2).lon).toEqual([]);
  });
  it('⭐ đường dựng thật (`dungDongManDu`): có cú lệnh lớn mà điểm cuối vẫn đúng % engine — cú áp TRƯỚC neo (không đám đông để tách riêng)', async () => {
    const { dungDongManDu } = await import('../server/holdem/minigame/man.js');
    const st = ban('balance-v61-lenhlon', { g2: 'doi_lai', g3: 'ca_map' }, { ban: { btc: 100000 }, g2: { btc: 5000 }, g3: { btc: 5000 } });
    const { dam_dong: _d, bay: _b, day_chuyen: _c, day_chuyen_khong: _k, ...bc } = bcCua(st);
    expect(bc.lon).toEqual(['ca_map', 'doi_lai']);
    const co = dungDongManDu(bc), khong = dungDongManDu({ ...bc, lon: [] });
    expect(co.lon.map((x) => x.ai)).toEqual(['ca_map', 'ca_map', 'doi_lai', 'doi_lai']);
    const cuoi = (m: NenMin[]) => m[m.length - 1]!.c / m[N0 - 1]!.c;
    expect(cuoi(co.min)).toBeCloseTo(1 + bc.muc_tieu_bp! / 10000, 9);
    expect(cuoi(co.min)).toBeCloseTo(cuoi(khong.min), 9);
    expect(Math.max(...co.min.map((c, i) => Math.abs(c.c / khong.min[i]!.c - 1)))).toBeGreaterThan(0.02);
  });
  it('⭐ v60 (không cờ `lenhLonV61`) ⇒ bối cảnh không có `lon` (màn prod 0.0.54 dựng lại byte-hệt)', () => {
    const st = ban('balance-v60-loiman', { g3: 'ca_map' }, { ban: { btc: 100000 }, g3: { btc: 5000 } });
    expect(bcCua(st).lon).toBeUndefined();
  });
});

describe('§IV — dòng nhịp qua HTTP + DB: khối lượng tích luỹ · cú lệnh lớn · ai đặt chỉ cho Tổ Chức', () => {
  let db: any; let pool: pg.Pool; let app: Hono<any>; let tester: any;
  beforeAll(async () => {
    const { createApp } = await import('../server/app.js');
    const { CapturingMailer } = await import('../server/email.js');
    const { startTestDb } = await import('./helpers/testdb.js');
    const { createTestUser } = await import('./helpers/fixtures.js');
    db = await startTestDb(); pool = db.pool;
    app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
    tester = await createTestUser(pool, { role: 'admin' });
    await pool.query('UPDATE users SET la_tester = true WHERE user_id = $1', [tester.userId]);
  }, 120_000);
  afterAll(async () => { await db?.stop(); });
  const json = async (path: string, init: RequestInit = {}): Promise<any> => (await app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie: tester.cookie, ...(init.headers ?? {}) },
  })).json();
  /** Ghi lại màn (DB thử — bảng chặn UPDATE, cửa một chiều D466) với bối cảnh sửa theo `sua` và mốc bắt đầu lùi 2 phút ⇒ màn đã chạy hết. */
  const ghiLai = async (id: string, sua: (bc: any) => any) => {
    const r = await pool.query('DELETE FROM holdem_minigame_man WHERE match_id = $1 AND vong = 1 RETURNING boi_canh, phien_ban', [id]);
    await pool.query(`INSERT INTO holdem_minigame_man (match_id, vong, phien_ban, boi_canh, bat_dau) VALUES ($1, 1, $2, $3, now() - interval '2 minutes')`,
      [id, r.rows[0]!.phien_ban, JSON.stringify(sua(r.rows[0]!.boi_canh))]);
    return r.rows[0]!.boi_canh;
  };

  it('⭐ lô có `v` cùng độ dài `gia`, tích luỹ đều trong nến; đầu màn có `lich_su_v`; cú lệnh lớn có nhịp · hết; ai đặt CHỈ khi Tổ Chức', async () => {
    let id = '';
    for (let lan = 0; lan < 10 && !id; lan++) {
      const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_vai: 'ca_nhan' }) });
      const r = await json(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
        method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: [], hanh_dong: 'giu_vi_the', them: 0, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] }),
      });
      if (r.error) continue;
      const mo = await json(`/api/v1/holdem/matches/${t.match_id}/minigame`, { method: 'POST', body: JSON.stringify({ vong: 1 }) });
      if (!mo.error) id = t.match_id;
    }
    expect(id, 'mở được một màn').not.toBe('');
    const bc0 = await ghiLai(id, (bc) => ({ ...bc, lon: ['ca_map', 'doi_lai'] }));
    expect(Array.isArray(bc0.lon), 'khoá v61 ghi `lon` vào bối cảnh lúc mở màn (kể cả rỗng)').toBe(true);
    const r = await json(`/api/v1/holdem/matches/${id}/minigame/1/nhip?tu=0&mot_lan=1`);
    expect(r.dau.lich_su_v).toHaveLength(20);
    expect(r.lo.gia.length).toBe(480);
    expect(r.lo.v).toHaveLength(480);
    for (let j = 0; j < 60; j++) {
      const c = r.lo.v.slice(j * 8, j * 8 + 8) as number[];
      expect(c[7]! / 8, `nến ${j}: tích luỹ đều`).toBeCloseTo(c[0]!, 2);
    }
    expect(r.lo.lon).toHaveLength(4);
    for (const e of r.lo.lon) { expect(e.het).toBeGreaterThan(e.nhip); expect(e.ai, 'không phải Tổ Chức ⇒ không thấy ai đặt').toBeUndefined(); }
    // lô chỉ gồm nhịp cuối ⇒ không gửi lại cú đã mở trước đó
    expect((await json(`/api/v1/holdem/matches/${id}/minigame/1/nhip?tu=479&mot_lan=1`)).lo.lon).toBeUndefined();
    // Tổ Chức (demo `thayChuLenh`) thấy ai đặt
    await ghiLai(id, (bc) => ({ ...bc, to_chuc: true }));
    const r2 = await json(`/api/v1/holdem/matches/${id}/minigame/1/nhip?tu=0&mot_lan=1`);
    expect(new Set(r2.lo.lon.map((e: any) => e.ai))).toEqual(new Set(['ca_map', 'doi_lai']));
    // khoá cũ (bối cảnh không `lon`) ⇒ không khối lượng, không cú — màn prod 0.0.54 y như cũ
    await ghiLai(id, ({ lon: _bo, to_chuc: _t, ...bc }) => bc);
    const r3 = await json(`/api/v1/holdem/matches/${id}/minigame/1/nhip?tu=0&mot_lan=1`);
    expect(r3.dau.lich_su_v).toBeUndefined();
    expect(r3.lo.v).toBeUndefined();
    expect(r3.lo.lon).toBeUndefined();
  }, 600_000);
});
