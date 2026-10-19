/**
 * LUỒNG NGƯỜI CHƠI — quét 4 VAI × 12 TỔ HỢP LỆNH ở vòng 1 qua đúng API web gửi (D533 · A12 §5 `kiem -- luong`).
 *
 * Vì sao có bài này: 06/10 founder bắt ba lỗi luồng trên prod 0.0.53 mà ~487 tệp test không bắt — đổi lõi vòng 1 bị
 * server BỎ IM LẶNG, bàn kẹt sau màn, lệnh bị bác không một chữ. Lỗi sống ở chỗ nối trạng thái ↔ server, nên bài này
 * đi ĐÚNG đường web đi: tạo trận → (đổi lõi) → nộp vòng 1 với tổ hợp lệnh → mở màn → lùi màn → đọc trạng thái vòng sau.
 * Gốc: bộ quét ở scratchpad phiên minigame (`_tam_luong.test.ts`), đưa vào repo với khẳng định thay cho `console.log`.
 *
 * Khẳng định (D533 §Nghiệm thu): mọi tổ hợp web gửi được phải chạy đúng — nộp 200, lõi chọn/đổi được GIỮ, màn mở có
 * `cho_man.het_ms` — TRỪ ba lớp có lý do và phải NÓI lý do: `mandate_ma` (Tổ Chức ≥ 50 % một mã) · `can_la_ban_khong`
 * (bán khống không có lá) · `moc_khong_hop_le`. Nộp bị bác thì `loi_von` phải có mặt (không im lặng).
 *
 * Mỗi vai một admin-tester riêng (tạo trận bị giới hạn ~30/giờ/user — bài học 26/09).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../../server/app.js';
import { CapturingMailer } from '../../server/email.js';
import { startTestDb, type TestDb } from '../helpers/testdb.js';
import { createTestUser } from '../helpers/fixtures.js';

let db: TestDb; let pool: pg.Pool; let app: Hono<any>;
beforeAll(async () => {
  db = await startTestDb(); pool = db.pool;
  app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://x.test', secureCookie: false }) as Hono<any>;
}, 120_000);
afterAll(async () => { await db?.stop(); });

let cookie = '';
const req = (p: string, init: RequestInit = {}) =>
  app.request(`http://localhost${p}`, { ...init, headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) } });
const j = async (p: string, init: RequestInit = {}): Promise<any> => (await req(p, init)).json();
const quaMan = (id: string) => pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '50 seconds' WHERE match_id = $1`, [id]);
const luiMan = async (id: string, vong: number) => {
  const r = await pool.query('DELETE FROM holdem_minigame_man WHERE match_id = $1 AND vong = $2 RETURNING boi_canh, phien_ban', [id, vong]);
  if (!r.rows[0]) return;
  await pool.query(`INSERT INTO holdem_minigame_man (match_id, vong, phien_ban, boi_canh, bat_dau) VALUES ($1, $2, $3, $4, now() - interval '60 seconds')`,
    [id, vong, r.rows[0].phien_ban, JSON.stringify(r.rows[0].boi_canh)]);
};

type L = { ma: string; chieu: string; moc_bp: number };
const COMBO: Record<string, { lenh: L[]; doi?: true; boLoi?: true }> = {
  mua1_25: { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] },
  mua1_50: { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] },
  mua1_all: { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }] },
  mua_vang_all: { lenh: [{ ma: 'vang', chieu: 'mua', moc_bp: 10000 }] },
  mua_tpcp_50: { lenh: [{ ma: 'tpcp', chieu: 'mua', moc_bp: 5000 }] },
  mua2_50_50: { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }, { ma: 'vang', chieu: 'mua', moc_bp: 5000 }] },
  mua3_25: { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }, { ma: 'vn30', chieu: 'mua', moc_bp: 2500 }, { ma: 'usd', chieu: 'mua', moc_bp: 2500 }] },
  mua6_all_chia: { lenh: ['btc', 'cp_cn', 'vn30', 'vang', 'usd', 'tpcp'].map((ma, i) => ({ ma, chieu: 'mua', moc_bp: Math.round(10000 / (6 - i)) })) },
  khong_btc_25: { lenh: [{ ma: 'btc', chieu: 'khong', moc_bp: 2500 }] },
  doi_loi_mua50: { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }], doi: true },
  khong_lenh: { lenh: [] },
  khong_loi_mua50: { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }], boLoi: true },
  // một lệnh hợp lệ + một lệnh bị bác (khống không lá) ⇒ phải có loi_von — đúng nhánh D533 lỗi 3. Đo 10/10 (master lẫn nhánh prod):
  // engine bác CẢ LÔ (`can_la_ban_khong`), không cầm btc ⇒ không có màn riêng (nhánh D549 ở lỗi 2).
  mua25_khong25: { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }, { ma: 'vang', chieu: 'khong', moc_bp: 2500 }] },
};
const LY_DO_HOP_LE = new Set(['mandate_ma', 'can_la_ban_khong', 'moc_khong_hop_le']);
const VAI = ['ca_nhan', 'ca_map', 'to_chuc', 'doi_lai'] as const;

describe('quét vai × tổ hợp ở vòng 1 — đường web đi, có khẳng định', () => {
  it('mọi tổ hợp: nộp 200 hoặc bác CÓ LÝ DO; lõi giữ được; màn mở có mốc hết', async () => {
    const bang: string[] = [];
    const loiLuong: string[] = [];
    for (const vai of VAI) {
      const uv = await createTestUser(pool, { role: 'admin' });
      await pool.query('UPDATE users SET la_tester = true WHERE user_id = $1', [uv.userId]);
      cookie = uv.cookie;
      for (const [ten, c] of Object.entries(COMBO)) {
        const nhan = `${vai}/${ten}`;
        const t = await j('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_vai: vai }) });
        const id = t.match_id as string | undefined;
        if (typeof id !== 'string') { loiLuong.push(`${nhan}: tạo trận hỏng ${JSON.stringify(t).slice(0, 120)}`); continue; }
        const st = await j(`/api/v1/holdem/matches/${id}`);
        const shop = c.doi ? (await j(`/api/v1/holdem/matches/${id}/shop?lan=1`)).shop : st.shop;
        // Đổi lõi: chọn lõi CHỈ có ở quầy lượt 1 (không có ở quầy lượt 0) — để "server đọc quầy cũ" (D533 lỗi 1) lộ ra.
        const quay0: string[] = st.shop?.chien_thuat ?? [];
        const quay1: string[] = shop?.chien_thuat ?? [];
        const loi: string | null = c.boLoi ? null : (c.doi ? (quay1.find((x) => !quay0.includes(x)) ?? quay1[0] ?? null) : quay0[0] ?? null);
        if (!shop) loiLuong.push(`${nhan}: không có shop ở vòng ${st.vong}`);
        const nop = await req(`/api/v1/holdem/matches/${id}/rounds`, { method: 'POST', body: JSON.stringify({
          vong: 1, khao_sat_lai: c.doi ? 1 : 0, mua: loi ? [loi] : [], hanh_dong: 'giu_vi_the', them: 0,
          ...(c.lenh.length ? { lenh: c.lenh } : {}) }) });
        const nb: any = await nop.json();
        const mo = await req(`/api/v1/holdem/matches/${id}/minigame`, { method: 'POST', body: JSON.stringify({ vong: 1 }) });
        const mb: any = await mo.json();
        await luiMan(id, 1); await quaMan(id);
        const sau = await j(`/api/v1/holdem/matches/${id}`);
        const loiGiu = (sau.ban?.danh_muc?.chien_thuat ?? sau.ban?.chien_thuat ?? []) as string[];

        if (nop.status === 200) {
          if (loi && !loiGiu.includes(loi)) loiLuong.push(`${nhan}: lõi ${loi} nộp 200 mà KHÔNG được giữ (D533 lỗi 1)`);
          /*
           * Lỗi 2 — màn mở phải có mốc hết. D549 (founder 07/10, sau bài này): bàn toàn máy mà người chơi KHÔNG có màn riêng (cửa mở màn
           * bác — không cầm mã) ⇒ server bỏ qua cửa sổ màn, `het_ms` = 0, bàn sang vòng sau ngay. Nên ghim HAI CHIỀU theo chính cửa mở màn:
           * mở được màn ⟺ `het_ms` > 0; mở bị bác ⟺ `het_ms` === 0 VÀ bàn đã sang vòng 2 (không kẹt — đúng thứ lỗi 2 sinh ra để canh).
           */
          if (nb.cho_man) {
            const het = nb.cho_man.het_ms;
            if (typeof het !== 'number') loiLuong.push(`${nhan}: cho_man không có het_ms (D533 lỗi 2)`);
            else if (mo.status === 200 && !(het > 0)) loiLuong.push(`${nhan}: màn mở được mà het_ms = ${het} (D533 lỗi 2)`);
            else if (mo.status !== 200 && het !== 0) loiLuong.push(`${nhan}: không có màn riêng (mở ${mo.status}) mà vẫn bắt chờ het_ms = ${het} (D549)`);
            else if (mo.status !== 200 && sau.vong !== 2) loiLuong.push(`${nhan}: không có màn riêng mà bàn không sang vòng 2 — kẹt (D533 lỗi 2 · D549)`);
          }
          // Lỗi 3 — nộp 200 mà có lệnh KHÔNG thành vị thế (bị bác) thì PHẢI có `loi_von` nói lý do — kể cả ở nhánh chờ màn.
          const viThe = (sau.ban?.vi_the ?? {}) as Record<string, number>;
          const viTheKhong = (sau.ban?.vi_the_khong ?? {}) as Record<string, number>;
          const bac = c.lenh.filter((l) => (l.chieu === 'khong' ? !(Number(viTheKhong[l.ma]) > 0) : !(Number(viThe[l.ma]) > 0)));
          if (bac.length > 0 && (nb.loi_von === undefined || nb.loi_von === null)) {
            loiLuong.push(`${nhan}: nộp 200, lệnh ${bac.map((l) => `${l.chieu} ${l.ma}`).join('+')} bị bác mà KHÔNG có loi_von — im lặng (D533 lỗi 3)`);
          }
        } else {
          const ly = String(nb.error ?? nb.loi_von?.ly_do ?? '');
          if (![...LY_DO_HOP_LE].some((k) => ly.includes(k))) loiLuong.push(`${nhan}: nộp ${nop.status} bác mà không có lý do hợp lệ: ${JSON.stringify(nb).slice(0, 160)}`);
          if (nb.loi_von === undefined && nb.error === undefined) loiLuong.push(`${nhan}: nộp bị bác IM LẶNG — không loi_von, không error (D533 lỗi 3)`);
        }
        bang.push([vai.padEnd(8), ten.padEnd(16), `nộp ${nop.status}${nb.error ? ':' + nb.error : ''}`, `màn ${mo.status} la=${mb.la ?? '-'}`,
          `lõi ${loi ?? '-'}→giữ ${loi ? loiGiu.includes(loi) : '-'}`, `q0=${quay0.join(',')} q1=${quay1.join(',')}`,
          `cho_man=${nb.cho_man ? 'có' : '-'} loi_von=${nb.loi_von === undefined ? 'undef' : nb.loi_von === null ? 'null' : 'có'}`,
          `vi_the=${JSON.stringify(sau.ban?.vi_the ?? {})}`, `vòng sau ${sau.vong}`].join(' | '));
      }
    }
    console.log('\n' + bang.join('\n'));
    expect(loiLuong, loiLuong.join('\n')).toEqual([]);
    expect(bang.length).toBe(VAI.length * Object.keys(COMBO).length);
  }, 600_000);
});
