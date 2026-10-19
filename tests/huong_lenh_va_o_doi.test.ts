/**
 * D302 — HƯỚNG LỆNH đối thủ (thay máy cược đã tắt) + LỘ EX-POST cú ĐÁM ĐÔNG ĐỔI Ô.
 *
 * VÌ SAO CÓ FILE NÀY
 *
 * 1. Từ v10a (`cuocTat`) máy cược tắt nên `suyHanhDong` trả GIỮ VỊ THẾ cho cả bàn ở
 *    mọi vòng; dải đối thủ 5 ghế một chữ suốt trận — founder 07/09 đọc thành "chẳng
 *    thấy đối thủ làm gì". Bài `holdem_api.test.ts` chỉ canh `hanh_dong ∈ {3 nhãn}`,
 *    tức là canh một thứ luôn đúng mà không nói gì. Đây canh hướng lệnh THẬT theo
 *    lệnh THẬT: mua ⇒ `vao`, không lệnh ⇒ `dung`, bán ⇒ `ra`, vừa bán vừa mua ⇒ `dao`.
 * 2. Phản thân (v20) / bẻ chuỗi bằng vốn (v35) đổi 22,5% số vòng bàn 12 mà DTO chưa
 *    bao giờ nói — trái luật 03 §3 "lộ ex-post BẮT BUỘC". Đây canh ba mặt của cùng
 *    một sự thật: `ket_qua_vong.o_doi` ở đúng vòng · `lich_su_o[v-1].doi` sau đó ·
 *    `o_hien_tai` KHÔNG BAO GIỜ mang (ex-ante vẫn giấu).
 *
 * ⚠ Mục IV dò seed qua CHÍNH endpoint (không dựng máy mô phỏng thứ hai — D61) và
 * dừng ở seed đầu tiên có cú đổi; một user mới cho mỗi seed vì mỗi user chỉ được
 * một trận mở. Không seed nào trong 1..12 bị đổi ô là máy đổi ô tắt — bài phải đỏ.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { quaManNeuCo } from './helpers/minigame.js';
import { suyHuongLenh } from '../server/holdem_api.js';
import { oDoiCua } from '../server/holdem/engine.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-secret-hl', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

const goi = (u: TestUser) => async (path: string, init: RequestInit = {}): Promise<any> => {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: u.cookie, ...(init.headers ?? {}) },
  });
  return r.json();
};

// D525 — khoá mặc định có màn lõi sau cú nộp ⇒ qua màn rồi đọc trạng thái thật (`quaManNeuCo`; kết quả vòng có trong trạng thái).
const nopVong = async (
  j: ReturnType<typeof goi>, id: string, vong: number, them: Record<string, unknown> = {},
) => quaManNeuCo(pool, id, await j(`/api/v1/holdem/matches/${id}/rounds`, {
  method: 'POST',
  body: JSON.stringify({
    vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [], ...them,
  }),
}), () => j(`/api/v1/holdem/matches/${id}`));

const HUONG = ['vao', 'ra', 'dao', 'dung'];

describe('I. suyHuongLenh — thuần', () => {
  const so = (dai: Record<string, number> = {}, khong: Record<string, number> = {}) =>
    ({ dai, khong });

  it('mua = vao · bán = ra · vừa bán vừa mua = dao · không đổi = dung', () => {
    expect(suyHuongLenh(so(), so({ btc: 2000 }))).toBe('vao');
    expect(suyHuongLenh(so({ btc: 2000 }), so({ btc: 500 }))).toBe('ra');
    expect(suyHuongLenh(so({ btc: 2000 }), so({ vang: 1500 }))).toBe('dao');
    expect(suyHuongLenh(so({ btc: 2000 }), so({ btc: 2000 }))).toBe('dung');
    expect(suyHuongLenh(so(), so())).toBe('dung');
  });

  it('mở khống = vao, đóng khống = ra — sổ khống là sổ riêng, không phải "cầm mã"', () => {
    expect(suyHuongLenh(so({}, {}), so({}, { btc: 1000 }))).toBe('vao');
    expect(suyHuongLenh(so({}, { btc: 1000 }), so({}, {}))).toBe('ra');
    // Bán dài + mở khống cùng mã: một RA một VÀO ⇒ ĐẢO.
    expect(suyHuongLenh(so({ btc: 900 }, {}), so({}, { btc: 900 }))).toBe('dao');
  });

  it('không có ảnh chụp trước ⇒ dung, không ném', () => {
    expect(suyHuongLenh(undefined, so({ btc: 1 }))).toBe('dung');
  });
});

describe('II. oDoiCua — thuần, một nguồn cho DTO vòng + ô lịch sử + sổ hành vi', () => {
  it('đọc đúng sổ theo vòng; vòng không đổi ⇒ null; sổ rỗng ⇒ null', () => {
    const st = {
      phan_than: [{ vong: 3, tu: 'di_ngang', den: 'giam', vi: 'don' as const }],
      be_chuoi: [{ vong: 5, tu: 'giam', den: 'tang', huong: 'len' as const }],
    };
    expect(oDoiCua(st, 3)).toEqual({ boi: 'phan_than', tu: 'di_ngang', den: 'giam', vi: 'don' });
    expect(oDoiCua(st, 5)).toEqual({ boi: 'be_chuoi', tu: 'giam', den: 'tang', vi: 'len' });
    expect(oDoiCua(st, 4)).toBeNull();
    expect(oDoiCua({}, 1)).toBeNull();
  });
});

describe('III. huong_lenh qua POST /rounds', () => {
  it('trận NAV: ban VÀO → ĐỨNG → VÀO → RA → ĐẢO theo lệnh thật; đối thủ ghế nào cũng có hướng', async () => {
    const j = goi(user);
    const tao = await j('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ so_o: 12 }),
    });
    expect(tao.match_id, JSON.stringify(tao)).toBeTruthy();

    const r1 = await nopVong(j, tao.match_id, 1, {
      lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }],
    });
    expect(r1.loi_von?.lenh).toBeUndefined();
    expect(r1.ket_qua_vong.cua_ban.huong_lenh).toBe('vao');
    expect(r1.ket_qua_vong.cua_doi_thu.length).toBeGreaterThan(0);
    for (const d of r1.ket_qua_vong.cua_doi_thu) {
      expect(HUONG, `ghế ${d.ghe_id} thiếu hướng lệnh`).toContain(d.huong_lenh);
      // Ranh thông tin ẩn không đổi: chỉ HƯỚNG, không mã, không cỡ.
      expect(d).not.toHaveProperty('chain');
      expect(d).not.toHaveProperty('danh_muc');
      expect(d).not.toHaveProperty('vi_the');
    }

    const r2 = await nopVong(j, tao.match_id, 2);
    expect(r2.ket_qua_vong.cua_ban.huong_lenh).toBe('dung');

    const r3 = await nopVong(j, tao.match_id, 3, {
      lenh: [{ ma: 'vang', chieu: 'mua', moc_bp: 2500 }],
    });
    expect(r3.loi_von?.lenh).toBeUndefined();
    expect(r3.ket_qua_vong.cua_ban.huong_lenh).toBe('vao');

    const r4 = await nopVong(j, tao.match_id, 4, {
      lenh: [{ ma: 'btc', chieu: 'ban', moc_bp: 10000 }],
    });
    expect(r4.loi_von?.lenh).toBeUndefined();
    expect(r4.ket_qua_vong.cua_ban.huong_lenh).toBe('ra');

    const r5 = await nopVong(j, tao.match_id, 5, {
      lenh: [
        { ma: 'vang', chieu: 'ban', moc_bp: 10000 },
        { ma: 'usd', chieu: 'mua', moc_bp: 2500 },
      ],
    });
    expect(r5.loi_von?.lenh).toBeUndefined();
    expect(r5.ket_qua_vong.cua_ban.huong_lenh).toBe('dao');
  });

  it('trận cũ không NAV: KHÔNG có trường — client cũ đọc nhãn cược như trước', async () => {
    const u2 = await createTestUser(pool);
    const j = goi(u2);
    const tao = await j('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v10a-tatcuoc' }),
    });
    expect(tao.match_id, JSON.stringify(tao)).toBeTruthy();
    const r = await nopVong(j, tao.match_id, 1);
    expect(r.ket_qua_vong.cua_ban).not.toHaveProperty('huong_lenh');
    for (const d of r.ket_qua_vong.cua_doi_thu) expect(d).not.toHaveProperty('huong_lenh');
    expect(r.ket_qua_vong).not.toHaveProperty('o_doi');
  });
});

describe('IV. o_doi — lộ ex-post, giấu ex-ante', () => {
  it('ô bị đổi: o_doi ở ĐÚNG vòng · lich_su_o[v-1].doi sau đó · o_hien_tai không bao giờ mang', async () => {
    let daThay = false;
    for (let seed = 1; seed <= 12 && !daThay; seed += 1) {
      // Tester mới cho mỗi seed: `ep_seed` chỉ nhận ở tester, và mỗi user một trận mở.
      const t = await createTestUser(pool, { role: 'admin' });
      await pool.query(`UPDATE users SET la_tester = true WHERE user_id = $1`, [t.userId]);
      const j = goi(t);
      const tao = await j('/api/v1/holdem/matches', {
        // D406 — ghim v53: v54 tắt cả máy phản thân lẫn bẻ chuỗi (`phanThan`/`beChuoiVon` false) — không còn ô nào
        // bị đổi để đo. Cú đổi ô vẫn sống ở bàn tập (ghim v53) nên mặt lộ ex-post của nó vẫn phải được canh.
        method: 'POST', body: JSON.stringify({ ep_seed: seed, so_o: 12, ep_balance: 'balance-v53-upo' }),
      });
      expect(tao.match_id, JSON.stringify(tao)).toBeTruthy();

      for (let v = 1; v <= 12; v += 1) {
        // Dồn vào rủi ro để phe "dồn" dễ đủ ngưỡng — người chơi là một trong 5–8 ghế.
        const r = await nopVong(j, tao.match_id, v,
          v === 1 ? { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] } : {});
        if (!r.ket_qua_vong) break;                       // trận đã khép (cháy / hết ô)
        const st = await j(`/api/v1/holdem/matches/${tao.match_id}`);
        // Ex-ante: ô đang mở KHÔNG BAO GIỜ mang dấu đổi — dù sổ engine đã có dòng của nó.
        expect(st.o_hien_tai?.doi, `seed ${seed} v${v}: ô đang mở lộ dấu đổi`).toBeUndefined();

        const oDoi = r.ket_qua_vong.o_doi;
        const oLat = st.lich_su_o?.[v - 1];
        if (!oDoi) {
          expect(oLat?.doi, `seed ${seed} v${v}: lịch sử có dấu mà DTO vòng không`).toBeUndefined();
          if (st.status !== 'dang_choi') break;
          continue;
        }
        expect(['phan_than', 'be_chuoi']).toContain(oDoi.boi);
        expect(oDoi.tu).not.toBe(oDoi.den);
        expect(['don', 'tron', 'len', 'xuong']).toContain(oDoi.vi);
        // Ba mặt một sự thật: ô lịch sử mang ĐÚNG cú đổi đó, và ô đã lật là ô SAU đổi.
        expect(oLat?.doi).toEqual(oDoi);
        expect(oLat.kind === 'su_kien' ? oLat.su_kien : oLat.giai_doan).toBe(oDoi.den);
        daThay = true;
        break;
      }
    }
    expect(daThay, 'không seed nào trong 1..12 bị đổi ô — máy phản thân / bẻ chuỗi tắt?')
      .toBe(true);
  }, 120_000);
});
