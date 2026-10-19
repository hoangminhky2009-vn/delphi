/**
 * D466 — MÀN MINIGAME QUA HTTP + DB THẬT: mở màn · dòng nhịp NDJSON · hỏi một lần · cú bấm theo số nhịp · nhật ký chỉ nối thêm.
 * Thời gian giả lập bằng cách GHI LẠI dòng màn với `bat_dau` trong quá khứ (DELETE + INSERT — trigger cấm sửa `bat_dau`), không giả đồng hồ toàn cục.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { quetTranQuaHan } from '../server/holdem_api.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { MINIGAME_DONG_GIA_VERSION, SO_NHIP } from '../config/minigame.js';
import { DONG_HO_MINIGAME } from '../config/holdem.js';
import { giaTaiNhip, soiGiaTri } from '../server/holdem/minigame/dong_gia.js';
import { CHAY_MS, CUA_SO_NHIP, DEM_MS, dungDongMan, maNamNhieuNhat, nhipMay, type BoiCanhMan } from '../server/holdem/minigame/man.js';
import { apXungBan, ketQuaMan } from '../server/holdem/minigame/khop.js';
import { thamSoKhop } from '../server/holdem/minigame/quyet_toan.js';
import { NUT_LOI } from '../config/minigame.js';

const V57 = 'balance-v57-minigame';
const V56 = 'balance-v56-congdon';

describe('minigame qua HTTP + DB', () => {
  let db: TestDb;
  let pool: pg.Pool;
  let app: Hono<any>;
  let user: TestUser;

  beforeAll(async () => {
    db = await startTestDb();
    pool = db.pool;
    app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
    user = await createTestUser(pool);
  }, 120_000);
  afterAll(async () => { await db?.stop(); });

  const req = (path: string, init: RequestInit = {}) => app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
  const json = async (path: string, init: RequestInit = {}): Promise<any> => (await req(path, init)).json();
  const post = (path: string, body: unknown) => req(path, { method: 'POST', body: JSON.stringify(body) });
  const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}) =>
    json(`/api/v1/holdem/matches/${id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, ...them }),
    });
  /**
   * Trận đã nộp vòng 1 (đặt `lenh`) và vòng 2 ⇒ màn vòng 2 mở được. Seed trận ngẫu nhiên nên vai/thẻ có khi làm vị thế BTC biến mất
   * (vai cấm, mã sập…) — thử lại tới 6 trận cho tới khi mã nắm nhiều nhất là BTC; `lenh` rỗng thì nhận ngay trận đầu.
   */
  const tranCoMan = async (khoa = V57, lenh: unknown[] = [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }]): Promise<string> => {
    for (let lan = 0; lan < 6; lan += 1) {
      const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: khoa }) });
      expect(t.error, JSON.stringify(t).slice(0, 200)).toBeUndefined();
      let r: any;
      for (const [v, l] of [[1, lenh], [2, []]] as const) {
        r = await nopVong(t.match_id, v, { lenh: l });
        expect(r.error, `vòng ${v}: ${JSON.stringify(r).slice(0, 200)}`).toBeUndefined();
      }
      if (lenh.length === 0 || maNamNhieuNhat(r.ban?.vi_the ?? {}) === 'btc') return t.match_id as string;
    }
    throw new Error('6 trận liền không giữ được BTC tới hết vòng 2');
  };
  const moMan = (id: string, vong = 2) => post(`/api/v1/holdem/matches/${id}/minigame`, { vong });
  /** Ghi lại màn với mốc bắt đầu lùi `giay` giây — giữ nguyên bối cảnh. */
  const luiMan = async (id: string, giay: number, vong = 2): Promise<BoiCanhMan> => {
    const r = await pool.query('DELETE FROM holdem_minigame_man WHERE match_id = $1 AND vong = $2 RETURNING boi_canh, phien_ban', [id, vong]);
    const bc = r.rows[0]!.boi_canh as BoiCanhMan;
    await pool.query(
      `INSERT INTO holdem_minigame_man (match_id, vong, phien_ban, boi_canh, bat_dau) VALUES ($1, $2, $3, $4, now() - make_interval(secs => $5))`,
      [id, vong, r.rows[0]!.phien_ban, JSON.stringify(bc), giay]);
    return bc;
  };
  const batDauMs = async (id: string, vong = 2): Promise<number> =>
    new Date((await pool.query('SELECT bat_dau FROM holdem_minigame_man WHERE match_id = $1 AND vong = $2', [id, vong])).rows[0]!.bat_dau).getTime();
  const docNdjson = async (res: Response, toiDa = Infinity): Promise<any[]> => {
    const rd = res.body!.getReader(), dec = new TextDecoder(), ra: any[] = [];
    let buf = '';
    while (ra.length < toiDa) {
      const { value, done } = await rd.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n')) >= 0 && ra.length < toiDa) { ra.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); }
    }
    await rd.cancel().catch(() => undefined);
    return ra;
  };

  describe('§I — mở màn', () => {
    it('⭐ v57: mở màn vòng vừa nộp ⇒ mã nắm nhiều nhất, 20 nến lịch sử, 480 nhịp; mở lại trả ĐÚNG màn cũ', async () => {
      const id = await tranCoMan();
      const a = await moMan(id);
      const ja = await a.json() as any;
      expect(a.status, JSON.stringify(ja)).toBe(200);
      expect(ja.ma).toBe('btc');
      expect(ja.von).toBeGreaterThan(0);
      expect(ja.lich_su).toHaveLength(20);
      expect(ja.so_nhip).toBe(SO_NHIP);
      expect(ja.phien_ban).toBe(MINIGAME_DONG_GIA_VERSION);
      expect(ja.nhip_may).toBeLessThan(0);   // vừa mở = đang đếm ngược
      const jb = await (await moMan(id)).json() as any;
      expect(jb.bat_dau).toBe(ja.bat_dau);
      expect((await pool.query('SELECT count(*)::int AS n FROM holdem_minigame_man WHERE match_id = $1', [id])).rows[0]!.n).toBe(1);
    }, 120_000);
    it('⭐ D473 — màn neo vào LÚC CHỐT vòng (`vong_mo_luc` của vòng kế) + lật thẻ 3 s + chọn lá 8 s, không vào lúc ai đó bấm mở', async () => {
      const id = await tranCoMan();
      // Giả lập: vòng 2 đã chốt cách đây 30 s, người chơi giờ mới mở màn ⇒ màn đã chạy được 19 s − 4 s đếm.
      await pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '30 seconds' WHERE match_id = $1`, [id]);
      const moc = new Date((await pool.query('SELECT vong_mo_luc FROM holdem_matches WHERE match_id = $1', [id])).rows[0]!.vong_mo_luc).getTime();
      const j = await (await moMan(id)).json() as any;
      expect(await batDauMs(id) - moc).toBe((DONG_HO_MINIGAME.LAT_THE_S + DONG_HO_MINIGAME.CHON_LA_S) * 1000);
      expect(new Date(j.bat_dau).getTime()).toBe(await batDauMs(id));
      expect(j.nhip_may, 'mở muộn ⇒ vào GIỮA màn, cùng nhịp với mọi người').toBeGreaterThan(0);
    }, 120_000);
    it('⭐ không lộ kịch bản: phản hồi không có hình, xác suất quét, seed hay lá', async () => {
      const id = await tranCoMan();
      const j = await (await moMan(id)).json() as any;
      for (const k of ['hinh', 'q', 'seed', 'nguon', 'kb', 'diem']) expect(j, k).not.toHaveProperty(k);
      const s = await (await req(`/api/v1/holdem/matches/${id}/minigame/2/nhip?mot_lan=1`)).json() as any;
      for (const k of ['hinh', 'q', 'seed', 'nguon', 'kb', 'diem']) expect(s.dau, k).not.toHaveProperty(k);
    }, 120_000);
    it('chỉ vòng VỪA NỘP: vòng chưa nộp / vòng 1 ⇒ 409 sai_vong', async () => {
      const id = await tranCoMan();
      expect((await (await moMan(id, 3)).json() as any).error).toBe('sai_vong');
      expect((await (await moMan(id, 1)).json() as any).error).toBe('sai_vong');
    }, 120_000);
    it('không nắm mã nào ⇒ 409 khong_co_ma', async () => {
      const id = await tranCoMan(V57, []);
      expect((await (await moMan(id)).json() as any).error).toBe('khong_co_ma');
    }, 120_000);
    it('vế ngược: trận v56 không có màn (403 luat_tat)', async () => {
      const id = await tranCoMan(V56);
      const r = await moMan(id);
      expect(r.status).toBe(403);
      expect((await r.json() as any).error).toBe('luat_tat');
    }, 120_000);
  });

  describe('§II — dòng nhịp', () => {
    it('⭐ màn đã chạy hết: dòng phát trả đầu · đủ 480 nhịp · hết, rồi đóng — giá khớp dòng giá dựng lại từ bối cảnh đã ghi', async () => {
      const id = await tranCoMan();
      await moMan(id);
      const bc = await luiMan(id, 60);
      const dong = await docNdjson(await req(`/api/v1/holdem/matches/${id}/minigame/2/nhip`));
      expect(dong.map((x) => x.loai)).toEqual(['dau', 'nhip', 'het']);
      const min = dungDongMan(bc);
      expect(dong[1].gia).toHaveLength(SO_NHIP);
      dong[1].gia.forEach((g: number, k: number) => expect(g).toBeCloseTo(giaTaiNhip(min, k), 4));
      expect(dong[1].nen).toHaveLength(60);
    }, 120_000);
    it('⭐ giữa màn: lô đầu chỉ tới nhịp ĐÃ QUA (không lộ tương lai); nối lại bằng ?tu= ra đúng các nhịp đó', async () => {
      const id = await tranCoMan();
      await moMan(id);
      await luiMan(id, 20);
      const t0 = await batDauMs(id);
      const dong = await docNdjson(await req(`/api/v1/holdem/matches/${id}/minigame/2/nhip`), 2);
      const nay = nhipMay(t0, Date.now());
      expect(dong[0].loai).toBe('dau');
      expect(dong[1].loai).toBe('nhip');
      expect(dong[1].tu).toBe(0);
      const cuoi = dong[1].gia.length - 1;
      expect(cuoi).toBeLessThanOrEqual(nay);
      expect(cuoi).toBeGreaterThan(nay - 30);
      const noi = await (await req(`/api/v1/holdem/matches/${id}/minigame/2/nhip?mot_lan=1&tu=100`)).json() as any;
      expect(noi.lo.tu).toBe(100);
      expect(noi.lo.gia.slice(0, cuoi - 99)).toEqual(dong[1].gia.slice(100));
      expect(noi.het).toBe(false);
    }, 120_000);
    it('hỏi một lần khi đang đếm ngược ⇒ chưa có nhịp nào', async () => {
      const id = await tranCoMan();
      await moMan(id);
      const j = await (await req(`/api/v1/holdem/matches/${id}/minigame/2/nhip?mot_lan=1`)).json() as any;
      expect(j.lo.gia).toEqual([]);
      expect(j.dau.lich_su).toHaveLength(20);
    }, 120_000);
    it('màn của người khác / màn chưa mở ⇒ 404', async () => {
      const id = await tranCoMan();
      expect((await req(`/api/v1/holdem/matches/${id}/minigame/2/nhip?mot_lan=1`)).status).toBe(404);
      await moMan(id);
      const khac = await createTestUser(pool);
      const r = await app.request(`http://localhost/api/v1/holdem/matches/${id}/minigame/2/nhip?mot_lan=1`, { headers: { cookie: khac.cookie } });
      expect(r.status).toBe(404);
    }, 120_000);
  });

  describe('§III — cú bấm', () => {
    const bam = (id: string, body: unknown) => post(`/api/v1/holdem/matches/${id}/minigame/2/lenh`, body);
    it('⭐ nhận cú bấm trong cửa sổ: khớp giá của NHỊP ĐANG THẤY, nối vào nhật ký màn + một dòng events mg_lenh', async () => {
      const id = await tranCoMan();
      await moMan(id);
      const bc = await luiMan(id, 20);
      const t0 = await batDauMs(id);
      const nhip = nhipMay(t0, Date.now()) - 5;
      const r = await bam(id, { nhip, nut: 'vao_het', khoa: 'k1' });
      const j = await r.json() as any;
      expect(r.status, JSON.stringify(j)).toBe(200);
      expect(j).toMatchObject({ nhan: true, seq: 1, nhip });
      expect(j.gia).toBeCloseTo(giaTaiNhip(dungDongMan(bc), nhip), 4);
      const man = (await pool.query('SELECT lenh FROM holdem_minigame_man WHERE match_id = $1', [id])).rows[0]!.lenh;
      expect(man).toHaveLength(1);
      expect(man[0]).toMatchObject({ seq: 1, nhip, nut: 'vao_het', nguon: 'nguoi', khoa: 'k1' });
      const ev = await pool.query(`SELECT value_json FROM events WHERE action_type = 'mg_lenh' AND context_id = $1`, [id]);
      expect(ev.rowCount).toBe(1);
      expect(ev.rows[0]!.value_json).toMatchObject({ vong: 2, seq: 1, nhip, nut: 'vao_het', nguon: 'nguoi', ma: bc.ma, phien_ban: MINIGAME_DONG_GIA_VERSION });
      // gửi lại cùng khoá ⇒ trả cú cũ, không ghi thêm
      const j2 = await (await bam(id, { nhip, nut: 'vao_het', khoa: 'k1' })).json() as any;
      expect(j2).toMatchObject({ nhan: true, da_ghi_truoc_do: true, seq: 1 });
      expect((await pool.query(`SELECT count(*)::int AS n FROM events WHERE action_type = 'mg_lenh' AND context_id = $1`, [id])).rows[0]!.n).toBe(1);
      // cú thứ hai nối sau
      expect((await (await bam(id, { nhip: nhip + 1, nut: 'thoat' })).json() as any).seq).toBe(2);
    }, 120_000);
    it('⭐ từ chối: nhịp tương lai · cũ quá cửa sổ · ngoài màn · nút sai · màn đang đếm ngược — và không ghi gì', async () => {
      const id = await tranCoMan();
      await moMan(id);
      expect((await (await bam(id, { nhip: 0, nut: 'vao_het' })).json() as any).error).toBe('chua_chay');
      await luiMan(id, 20);
      const nay = nhipMay(await batDauMs(id), Date.now());
      expect((await (await bam(id, { nhip: nay + 40, nut: 'vao_het' })).json() as any).error).toBe('tuong_lai');
      expect((await (await bam(id, { nhip: nay - CUA_SO_NHIP - 15, nut: 'vao_het' })).json() as any).error).toBe('qua_cu');
      expect((await (await bam(id, { nhip: 480, nut: 'vao_het' })).json() as any).error).toBe('ngoai_man');
      expect((await bam(id, { nhip: nay - 3, nut: 'VÀO' })).status).toBe(400);
      // D475 — nút không thuộc lõi nào (`vao` thành nút Mua Đuổi từ D511), chọn lá một lõi không có ⇒ nut_sai.
      expect((await (await bam(id, { nhip: nay - 3, nut: 'vao_khong_co' })).json() as any).error).toBe('nut_sai');
      expect((await (await bam(id, { nhip: -1, nut: 'la_khong_co' })).json() as any).error).toBe('nut_sai');
      expect((await pool.query('SELECT jsonb_array_length(lenh) AS n FROM holdem_minigame_man WHERE match_id = $1', [id])).rows[0]!.n).toBe(0);
      expect((await pool.query(`SELECT count(*)::int AS n FROM events WHERE action_type = 'mg_lenh' AND context_id = $1`, [id])).rows[0]!.n).toBe(0);
    }, 120_000);
  });

  describe('§IV — cửa một chiều ở tầng DB', () => {
    it('⭐ trigger: không xoá/sửa cú đã ghi, không đổi bối cảnh hay mốc bắt đầu; nối thêm thì được', async () => {
      const id = await tranCoMan();
      await moMan(id);
      await luiMan(id, 20);
      const nay = nhipMay(await batDauMs(id), Date.now());
      await post(`/api/v1/holdem/matches/${id}/minigame/2/lenh`, { nhip: nay - 2, nut: 'vao_het' });
      const sql = (s: string) => pool.query(s.replace('$ID', `'${id}'`));
      await expect(sql(`UPDATE holdem_minigame_man SET lenh = '[]'::jsonb WHERE match_id = $ID`)).rejects.toThrow(/NỐI THÊM/);
      await expect(sql(`UPDATE holdem_minigame_man SET lenh = jsonb_set(lenh, '{0,nhip}', '1') WHERE match_id = $ID`)).rejects.toThrow(/NỐI THÊM/);
      await expect(sql(`UPDATE holdem_minigame_man SET boi_canh = '{}'::jsonb WHERE match_id = $ID`)).rejects.toThrow(/không đổi/);
      await expect(sql(`UPDATE holdem_minigame_man SET bat_dau = now() WHERE match_id = $ID`)).rejects.toThrow(/không đổi/);
      await sql(`UPDATE holdem_minigame_man SET lenh = lenh || '[{"seq":2}]'::jsonb WHERE match_id = $ID`);
    }, 120_000);
  });
  describe('§V — D475: Bắt Đáy khớp trên server, kết quả màn vào NAV vòng kế', () => {
    /** Trận đã nộp vòng 1 (lõi Bắt Đáy + mua BTC) và vòng 2 ⇒ màn vòng 2 là màn Bắt Đáy trên BTC. Quầy lõi là ngẫu nhiên ⇒ thử tới 40 trận. */
    const tranBatDay = async (): Promise<string> => {
      // Mỗi lần tìm một người dùng thử MỚI: tạo tới 40 trận một lèo sẽ chạm trần tần suất tạo trận của một người.
      user = await createTestUser(pool);
      for (let lan = 0; lan < 40; lan += 1) {
        const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V57 }) });
        if (!(t.shop?.chien_thuat ?? []).includes('bat_day') || (t.ban.danh_muc.chien_thuat as string[]).length) continue;
        let r = await nopVong(t.match_id, 1, { mua: ['bat_day'], lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] });
        expect(r.error, JSON.stringify(r).slice(0, 200)).toBeUndefined();
        r = await nopVong(t.match_id, 2, { lenh: [] });
        if (maNamNhieuNhat(r.ban?.vi_the ?? {}) === 'btc') return t.match_id as string;
      }
      throw new Error('40 trận không ra quầy có Bắt Đáy + giữ được BTC');
    };
    const bam = (id: string, body: unknown) => post(`/api/v1/holdem/matches/${id}/minigame/2/lenh`, body);
    const ketQua = (id: string) => req(`/api/v1/holdem/matches/${id}/minigame/2/ket-qua`);
    const ngu = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
    const logCua = async (id: string): Promise<any[]> =>
      (await pool.query('SELECT action_log FROM holdem_matches WHERE match_id = $1', [id])).rows[0]!.action_log;

    it('⭐ màn còn chạy ⇒ chưa nộp được vòng kế (409 man_chua_xong), chưa có kết quả (409 chua_het)', async () => {
      const id = await tranBatDay();
      await moMan(id);
      const r = await nopVong(id, 3);
      expect(r.error).toBe('man_chua_xong');
      expect((await (await ketQua(id)).json() as any).error).toBe('chua_het');
    }, 240_000);

    it('⭐ chọn lá trước khi chạy (lá không cầm thì bỏ qua), sau khi chạy thì 409 het_chon_la; đầu màn báo lá + nút', async () => {
      const id = await tranBatDay();
      const d = await (await moMan(id)).json() as any;
      expect(d.loi_cam).toContain('bat_day');
      expect(d.la).toBe('bat_day');
      expect(d.nut).toEqual(['vao_nua', 'vao_het', 'thoat']);
      expect(d.so.tien_nut).toEqual({ vao_nua: Math.floor(d.von / 2), vao_het: d.von, thoat: 0 });
      const a = await (await bam(id, { nhip: -1, nut: 'la_don_bay' })).json() as any;
      expect(a.nhan).toBe(true);
      expect(a.la, 'không cầm Đòn Bẩy ⇒ lá vẫn là Bắt Đáy').toBe('bat_day');
      await luiMan(id, 10);
      expect((await (await bam(id, { nhip: -1, nut: 'la_bat_day' })).json() as any).error).toBe('het_chon_la');
    }, 240_000);

    it('⭐ D483 TUNG TIN qua đường chính: ghế không trait ⇒ 403; có trait ⇒ gài trước màn một lần (lần hai 409), đường giá đổi giữa màn giữ đầu/cuối, kết quả trừ phí; sau khi chạy ⇒ 409', async () => {
      const id = await tranBatDay();
      await moMan(id);
      /** Ghi lại bối cảnh màn (bảng chỉ cho xoá + chèn) — giữ nguyên mốc bắt đầu. */
      const ghiBc = async (sua: (bc: BoiCanhMan) => BoiCanhMan, luiGiay = 0): Promise<BoiCanhMan> => {
        const r = await pool.query('DELETE FROM holdem_minigame_man WHERE match_id = $1 AND vong = 2 RETURNING boi_canh, phien_ban, bat_dau, lenh', [id]);
        const x = r.rows[0]!, bc = sua(x.boi_canh as BoiCanhMan);
        await pool.query(
          'INSERT INTO holdem_minigame_man (match_id, vong, phien_ban, boi_canh, bat_dau, lenh) VALUES ($1, 2, $2, $3, $4::timestamptz - make_interval(secs => $6), $5)',
          [id, x.phien_ban, JSON.stringify(bc), x.bat_dau, JSON.stringify(x.lenh ?? []), luiGiay]);
        return bc;
      };
      await ghiBc((bc) => { const k = { ...bc }; delete (k as { tung_tin?: true }).tung_tin; return k; });
      expect((await (await bam(id, { nhip: -1, nut: 'gai_tot' })).json() as any).error, 'vế ngược: không trait').toBe('khong_tung_tin');
      // D521 — bài này canh cú GÀI; bỏ `thac_v2` (vết thanh lý đổi theo đường đã gài ⇒ cuối màn lệch, lãi lỗ thêm phần vết).
      await ghiBc(({ thac_v2: _v, ...bc }) => ({ ...bc, tung_tin: true }));
      const d = await (await moMan(id)).json() as any;
      const phi = Math.floor((d.von * 300) / 10000);
      expect(d.gai).toEqual({ phi, chieu: 0 });
      const a = await (await bam(id, { nhip: -1, nut: 'gai_tot' })).json() as any;
      expect(a.nhan, JSON.stringify(a)).toBe(true);
      expect(a.gai).toEqual({ phi, chieu: 1 });
      expect((await (await bam(id, { nhip: -1, nut: 'gai_xau' })).json() as any).error).toBe('da_gai');
      // Lùi mốc tới hết màn — GIỮ cú bấm (`luiMan` chèn lại không kèm lệnh).
      const bc = await ghiBc((x) => x, Math.ceil((Math.max(0, (await batDauMs(id)) - Date.now()) + 39_000) / 1000));
      expect((await (await bam(id, { nhip: -1, nut: 'gai_xau' })).json() as any).error, 'màn đã chạy').toBe('het_chon_la');
      const lo = (await json(`/api/v1/holdem/matches/${id}/minigame/2/nhip?mot_lan=1`)).lo;
      const goc = dungDongMan(bc);
      expect(lo.gia.length).toBe(SO_NHIP);
      expect(lo.gia[0]).toBeCloseTo(giaTaiNhip(goc, 0), 3);
      expect(lo.gia[SO_NHIP - 1]).toBeCloseTo(giaTaiNhip(goc, SO_NHIP - 1), 3);
      const lech = lo.gia.map((g: number, k: number) => g / giaTaiNhip(goc, k) - 1);
      expect(Math.max(...lech), 'tin TỐT đẩy giá lên giữa màn').toBeGreaterThan(0.01);
      await new Promise((ok) => setTimeout(ok, 800));
      const kq = await (await ketQua(id)).json() as any;
      expect(kq.phi_gai).toBe(phi);
      expect(kq.loi, 'không bấm ⇒ chỉ còn phí').toBe(-phi);
    }, 240_000);
    it('⭐ D483 luồng nhịp mở TRƯỚC cú gài (trong lúc đếm ngược) ⇒ lúc màn chạy dựng lại đường: giá luồng gửi = đường ĐÃ gài', async () => {
      const id = await tranBatDay();
      const d0 = await (await moMan(id)).json() as any;
      // Ghế có trait + mốc bắt đầu đặt sao cho nhịp 0 tới sau 2 s (đang trong ĐẾM NGƯỢC).
      const r = await pool.query('DELETE FROM holdem_minigame_man WHERE match_id = $1 AND vong = 2 RETURNING boi_canh, phien_ban', [id]);
      const bc = { ...(r.rows[0]!.boi_canh as BoiCanhMan), tung_tin: true as const, phu: [{ ma: 'vang', bp: 300 }] };   // D484: luồng chở cả bảng phụ
      await pool.query(
        `INSERT INTO holdem_minigame_man (match_id, vong, phien_ban, boi_canh, bat_dau) VALUES ($1, 2, $2, $3, now() - make_interval(secs => $4))`,
        [id, r.rows[0]!.phien_ban, JSON.stringify(bc), (d0.dem_ms - 2000) / 1000]);
      const res = await req(`/api/v1/holdem/matches/${id}/minigame/2/nhip`);
      const rd = res.body!.getReader(), dec = new TextDecoder();
      let buf = '';
      const dong = async (): Promise<any> => {
        for (;;) {
          const i = buf.indexOf('\n');
          if (i >= 0) { const x = buf.slice(0, i); buf = buf.slice(i + 1); return JSON.parse(x); }
          const { value, done } = await rd.read();
          if (done) return null;
          buf += dec.decode(value, { stream: true });
        }
      };
      expect((await dong()).loai, 'luồng mở xong (đầu màn) TRƯỚC cú gài').toBe('dau');
      const a = await (await bam(id, { nhip: -1, nut: 'gai_tot' })).json() as any;
      expect(a.nhan, JSON.stringify(a)).toBe(true);
      const gaiPath = dungDongMan(bc, [{ seq: 1, nhip: -1, nut: 'gai_tot' }]), goc = dungDongMan(bc);
      const n0 = 20, lech = gaiPath.slice(n0).map((c, j) => c.c / goc[n0 + j]!.c - 1), kDinh = lech.indexOf(Math.max(...lech)) * 8 + 7;
      const gia: number[] = [], giaVang: number[] = [];
      while (gia.length <= kDinh) {
        const x = await dong();
        if (!x || x.loai === 'het' || x.loai === 'noi_lai') break;
        if (x.loai === 'nhip') { gia.push(...x.gia); giaVang.push(...(x.phu?.vang ?? [])); }
      }
      await rd.cancel();
      expect(gia.length, 'luồng phải chạy tới đỉnh xung').toBeGreaterThan(kDinh);
      expect(gia[kDinh]).toBeCloseTo(giaTaiNhip(gaiPath, kDinh), 3);
      expect(Math.abs(gia[kDinh]! - giaTaiNhip(goc, kDinh)), 'khác đường gốc ở đỉnh xung').toBeGreaterThan(0.01);
      expect(giaVang, 'D484 — luồng chở giá bảng phụ CÙNG nhịp').toHaveLength(gia.length);
    }, 240_000);
    it('⭐ D484 bảng phụ qua đường chính: đầu màn chỉ báo MÃ (không lộ %), giá đi dần theo nhịp, trọn màn ⇒ đúng % thị trường của vòng', async () => {
      const id = await tranBatDay();
      await moMan(id);
      const r = await pool.query('DELETE FROM holdem_minigame_man WHERE match_id = $1 AND vong = 2 RETURNING boi_canh, phien_ban', [id]);
      const bc = { ...(r.rows[0]!.boi_canh as BoiCanhMan), phu: [{ ma: 'vang', bp: 300 }] };
      await pool.query(
        `INSERT INTO holdem_minigame_man (match_id, vong, phien_ban, boi_canh, bat_dau) VALUES ($1, 2, $2, $3, now() - make_interval(secs => 39))`,
        [id, r.rows[0]!.phien_ban, JSON.stringify(bc)]);
      const d = await (await moMan(id)).json() as any;
      expect(d.phu).toEqual(['vang']);
      expect(JSON.stringify(d), 'đầu màn không chở bp (điểm cuối)').not.toContain('"bp"');
      const mot = await json(`/api/v1/holdem/matches/${id}/minigame/2/nhip?mot_lan=1`);
      expect(mot.lo.phu.vang).toHaveLength(SO_NHIP);
      expect(mot.lo.phu.vang[SO_NHIP - 1]).toBeCloseTo(103, 3);
      const nua = await json(`/api/v1/holdem/matches/${id}/minigame/2/nhip?mot_lan=1&tu=100`);
      expect(nua.lo.phu.vang[0], 'hỏi từ nhịp 100 ⇒ mốc 101').toBeCloseTo(mot.lo.phu.vang[100], 3);
    }, 240_000);
    it('⭐ D486 trait trong màn qua đường chính: đầu màn báo cửa sổ (giây); Kiên Nhẫn ⇒ bấm trước giây 10 bị 409 `trait_khoa`, sau mốc thì nhận', async () => {
      const id = await tranBatDay();
      await moMan(id);
      const r = await pool.query('DELETE FROM holdem_minigame_man WHERE match_id = $1 AND vong = 2 RETURNING boi_canh, phien_ban', [id]);
      const bc = { ...(r.rows[0]!.boi_canh as BoiCanhMan), kien_nhan: true as const };
      // màn đã chạy 4 + 5 s (đếm + 5 s chạy) ⇒ đang trong 10 s khoá
      await pool.query(
        `INSERT INTO holdem_minigame_man (match_id, vong, phien_ban, boi_canh, bat_dau) VALUES ($1, 2, $2, $3, now() - make_interval(secs => 9))`,
        [id, r.rows[0]!.phien_ban, JSON.stringify(bc)]);
      const d = await (await moMan(id)).json() as any;
      expect(d.trait_man).toEqual({ khoa_s: 10 });
      const nay = nhipMay(await batDauMs(id), Date.now());
      const a = await (await bam(id, { nhip: nay - 1, nut: 'vao_het' })).json() as any;
      expect(a.error, JSON.stringify(a)).toBe('trait_khoa');
      await luiMan(id, 4 + 12);   // giây 12 của màn chạy
      const nay2 = nhipMay(await batDauMs(id), Date.now());
      expect(nay2, 'đã qua mốc 142').toBeGreaterThanOrEqual(142);
      const b = await (await bam(id, { nhip: nay2 - 1, nut: 'vao_het' })).json() as any;
      expect(b.nhan, `sau mốc thì nhận: ${JSON.stringify(b)}`).toBe(true);
    }, 240_000);
    it('⭐ VÀO HẾT cuối màn ⇒ kết quả đúng hàm khớp, vào NGAY khoản BTC của vòng đang chơi, nộp vòng kế chép NGUYÊN số vào `mg`', async () => {
      const id = await tranBatDay();
      await moMan(id);
      const bc = await luiMan(id, 37);
      const nay = nhipMay(await batDauMs(id), Date.now());
      // D479 — cửa mở màn neo % thị trường engine của vòng: vốn màn × (1 + %) ≈ khoản sau thị trường.
      expect(bc.muc_tieu_bp, 'màn mở qua API phải mang % neo').toBeDefined();
      expect(Math.abs(Math.round(bc.von * (1 + bc.muc_tieu_bp! / 10000)) - bc.von_sau!)).toBeLessThanOrEqual(1);
      const so = await (await bam(id, { nhip: nay - 2, nut: 'vao_het', khoa: 'x' })).json() as any;
      expect(so.nhan, JSON.stringify(so)).toBe(true);
      expect(so.so.vao).toHaveLength(1);
      expect(so.so.ra, 'tự chốt cuối màn chưa xảy ra ⇒ không trả ra giữa màn').toEqual([]);
      // Tiền từng nút do server tính: đã vào hết ⇒ hai nút VÀO tắt, THOÁT = cả khoản.
      expect(so.so.tien_nut).toEqual({ vao_nua: 0, vao_het: 0, thoat: bc.von });
      expect(so.so.con_von).toBe(0);
      // D480 — trong lúc màn chạy GET trả trạng thái TRƯỚC chốt (giấu kết quả vòng) — kiểm luôn ở đây.
      expect((await json(`/api/v1/holdem/matches/${id}`)).cho_man?.vong).toBe(2);
      await ngu(Math.max(0, await batDauMs(id) + 38_200 - Date.now()));
      // D498 — `thamSoKhop` (một nguồn với quyết toán): bàn 4 ghế giờ có HAI vai đặc biệt ⇒ người hay trúng Cá Mập (đòn bẩy ×1,5) — bản chép tay thiếu `he` đỏ theo bốc thăm.
      const mong = ketQuaMan({ min: dungDongMan(bc), ...thamSoKhop(bc), la: 'bat_day', lenh: [{ seq: 1, nhip: nay - 2, nut: 'vao_het' }] });
      const kq = await (await ketQua(id)).json() as any;
      expect(kq.loi).toBe(mong.loi);
      expect(kq.tu_dong).toBe(false);
      expect(kq.nhan).toEqual(mong.nhan);
      // D479/D480 — khoản sau màn = khoản engine ra (giữ suốt) + lãi lỗ màn; NAV sau màn = trạng thái thật vòng kế.
      expect(kq.von + kq.theo_lenh, 'khoản cuối = vốn màn + theo lệnh (D521: + phần vết thác đã gồm trong loi)').toBe(kq.von + kq.giu + kq.loi - (kq.vet ?? 0));
      const sau = await json(`/api/v1/holdem/matches/${id}`);
      expect(sau.cho_man, 'màn xong ⇒ trạng thái thật').toBeUndefined();
      expect(sau.ban.vi_the.btc, 'khoản BTC của vòng đang chơi = engine + màn').toBe(kq.von_sau + mong.loi);
      expect(sau.ban.nav).toBe(kq.nav_sau);
      expect(mong.loi, 'lãi lỗ 0 thì bài này không đo được gì — đổi nhịp bấm').not.toBe(0);
      const r = await nopVong(id, 3);
      expect(r.error, JSON.stringify(r).slice(0, 200)).toBeUndefined();
      const dong3 = (await logCua(id)).find((h: any) => h.vong === 3 && !h.cho_nop);
      expect(dong3.mg.ban).toEqual({ ma: 'btc', loi: mong.loi });
      // Replay SAU nộp áp `mg` ở đầu vòng 3: NAV đầu vòng 3 (mẫu số lãi/lỗ vòng) = NAV sau màn mà người chơi đã thấy lúc đặt lệnh.
      // D480 — phản hồi nộp vòng 3 cũng giấu (màn vòng 3 chạy); qua màn rồi đọc kết quả vòng 3 thật.
      expect(r.cho_man?.vong).toBe(3);
      await pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '50 seconds' WHERE match_id = $1`, [id]);
      expect((await json(`/api/v1/holdem/matches/${id}`)).ket_qua_vong?.nav_truoc).toBe(kq.nav_sau);
    }, 240_000);

    it('⭐ D479 — không mở màn mà màn đã hết giờ ⇒ GIỮ suốt màn: lãi lỗ màn 0, khoản = đúng phần engine đã ra, `mg` không có dòng người chơi', async () => {
      const id = await tranBatDay();
      await pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '50 seconds' WHERE match_id = $1`, [id]);
      const kq = await (await ketQua(id)).json() as any;
      expect(kq.tu_dong, JSON.stringify(kq).slice(0, 200)).toBe(true);
      expect(kq.nhan).toEqual(['giu_suot']);
      expect(kq.loi, 'D521 — giữ suốt chịu đúng phần vết thác').toBe(kq.vet ?? 0);
      expect(kq.theo_lenh).toBe(kq.giu);
      // Vốn màn + giữ suốt ≈ khoản engine đã ra (vốn màn tách ngược từ % thị trường, làm tròn tới 1 chip).
      expect(Math.abs(kq.von + kq.giu - (kq.vet ?? 0) - kq.von_sau), 'D521 — bỏ phần vết thì đúng khoản engine').toBeLessThanOrEqual(1);
      const r = await nopVong(id, 3);
      expect(r.error).toBeUndefined();
      const dong3 = (await logCua(id)).find((h: any) => h.vong === 3 && !h.cho_nop);
      expect(dong3.mg?.ban?.loi ?? 0, 'D521 — không bấm: mg chỉ chở phần vết thác (nếu có)').toBe(kq.vet ?? 0);
    }, 240_000);

    it('client không gửi được `mg`: trường lạ trong body nộp bị bỏ', async () => {
      const id = await tranBatDay();
      await pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '50 seconds' WHERE match_id = $1`, [id]);
      const kq = await (await ketQua(id)).json() as any;
      expect(kq.loi).toBe(kq.vet ?? 0);   // D521 — vết thác
      await nopVong(id, 3, { mg: { ban: { ma: 'btc', loi: 999_999 } } });
      const dong3 = (await logCua(id)).find((h: any) => h.vong === 3 && !h.cho_nop);
      expect(dong3.mg?.ban?.loi ?? 0, 'server không nhận `mg` từ thân nộp — chỉ phần vết thác của chính server (D521)').toBe(kq.vet ?? 0);
    }, 240_000);
  });
  describe('§VI — D480: giấu kết quả vòng tới khi màn chạy xong', () => {
    it('⭐ nộp vòng 2 ⇒ trạng thái TRƯỚC chốt + cho_man (không đồng hồ, không kết quả vòng); GET trong màn cũng vậy; màn xong ⇒ vòng 3 thật', async () => {
      // D549 — người KHÔNG cầm mã ở bàn toàn máy thì không phải chờ màn ⇒ bài này cần trận mà lệnh BTC vòng 1 thật sự khớp (seed có lúc không).
      let t: any, r1: any, truoc: any;
      for (let lan = 0; lan < 8; lan += 1) {
        t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V57 }) });
        r1 = await nopVong(t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] });
        truoc = await json(`/api/v1/holdem/matches/${t.match_id}`);
        if (Object.values(truoc.ban.vi_the as Record<string, number>).some((v) => v > 0)) break;
      }
      expect(r1.cho_man, 'vòng 1 không có màn ⇒ trạng thái thật').toBeUndefined();
      expect(truoc.vong).toBe(2);
      expect(Object.values(truoc.ban.vi_the as Record<string, number>).some((v) => v > 0), '8 trận không khớp nổi BTC').toBe(true);
      const r2 = await nopVong(t.match_id, 2, { lenh: [] });
      expect(r2.error, JSON.stringify(r2).slice(0, 200)).toBeUndefined();
      expect(r2.cho_man?.vong).toBe(2);
      expect(r2.cho_man.o, 'lá vừa lật đi kèm').toBeDefined();
      expect(r2.vong, 'trạng thái là của TRƯỚC chốt').toBe(2);
      expect(r2.dong_ho, 'không đồng hồ trong lúc màn').toBeUndefined();
      expect(r2.ket_qua_vong, 'không kết quả vòng').toBeUndefined();
      expect(r2.ban.nav).toBe(truoc.ban.nav);
      expect(r2.ban.vi_the).toEqual(truoc.ban.vi_the);
      const g = await json(`/api/v1/holdem/matches/${t.match_id}`);
      expect(g.cho_man?.vong).toBe(2);
      expect(g.vong).toBe(2);
      expect(g.ket_qua_vong).toBeUndefined();
      // Khớp lệnh giữa vòng trong lúc màn: chặn (phản hồi khớp mang vị thế sau chốt).
      const k = await post(`/api/v1/holdem/matches/${t.match_id}/khop-lenh`, { vong: 3, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }] });
      expect(k.status).toBe(409);
      expect((await k.json() as any).error).toBe('man_chua_xong');
      // Màn xong (lùi mốc mở vòng qua hết phần màn) ⇒ trạng thái thật.
      await pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '50 seconds' WHERE match_id = $1`, [t.match_id]);
      const sau = await json(`/api/v1/holdem/matches/${t.match_id}`);
      expect(sau.cho_man).toBeUndefined();
      expect(sau.vong).toBe(3);
      expect(sau.ket_qua_vong).toBeDefined();
      expect(sau.dong_ho).toBeDefined();
    }, 240_000);
  });
  describe('§VII — D481: màn vòng cuối chiếu rồi mới tính', () => {
    const ngu = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
    /*
     * Handle KHÔNG ghim: CI chạy lại bài đỏ một lần (`vitest.config.ts`), handle cố định làm lượt chạy lại vấp `users_handle_key`
     * (23505) thay vì đo lại (CI master 741f0dc0, 10/10). Admin + `la_tester` để ép được seed (`ep_seed` chỉ ăn với tester — D413).
     */
    const nguoiTester = async (): Promise<TestUser> => {
      const u = await createTestUser(pool, { role: 'admin' });
      await pool.query('UPDATE users SET la_tester = true WHERE user_id = $1', [u.userId]);
      return u;
    };
    /*
     * ⭐ SEED GHIM cho "màn cuối còn chạy". Seed ngẫu nhiên thì có trận BTC đã bán/cháy hết trước vòng cuối ⇒ người chơi không còn màn
     * riêng ⇒ (a) D549 lùi mốc mở vòng đúng `giayManMinigame()` (bàn toàn bot không ai cần chờ) ⇒ màn cuối hết NGAY, GET khép trận —
     * bài thứ hai đỏ "GET trong màn cuối vẫn giấu: expected undefined" (CI master 741f0dc0); (b) mở màn cuối ăn 409 `khong_co_ma` — bài
     * thứ nhất đỏ "mở được màn cuối: expected 409" (1/7 lượt chạy lặp ở máy, 10/10). Quét seed qua đúng chuỗi lệnh từng bài (10/10):
     * bài hai 2/40 seed rơi vào D549 (15, 20 — tất định); bài một 83/200 seed có quầy Bắt Đáy, 1 hỏng (15). Seed 1 qua cả hai. Nhánh bỏ
     * chờ có bài riêng (`d549_bo_cho_man.test.ts`). Khoá V57 đóng băng (A11.3) nên seed không trôi; đổi chuỗi lệnh ⇒ quét lại, đừng nới bài.
     */
    const SEED_MAN_CUOI = 1;
    it('⭐ bấm VÀO HẾT trong màn cuối ⇒ NAV cuối trận (trạng thái đã khép) GỒM phần màn = nav_sau của /ket-qua', async () => {
      user = await nguoiTester();
      const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V57, ep_seed: SEED_MAN_CUOI }) });
      expect((await pool.query('SELECT seed::text AS s FROM holdem_matches WHERE match_id = $1', [t.match_id])).rows[0]?.s, 'ep_seed bị bỏ qua').toBe(String(SEED_MAN_CUOI));
      expect((t.shop?.chien_thuat ?? []).includes('bat_day') && (t.ban.danh_muc.chien_thuat as string[]).length === 0,
        'tiền đề: quầy vòng 1 có Bắt Đáy, tay trắng thẻ ⇒ chọn lại SEED_MAN_CUOI').toBe(true);
      const id = t.match_id as string, tong = t.tong_vong as number;
      for (let v = 1; v <= tong; v++) {
        if (v >= 3) await pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '50 seconds' WHERE match_id = $1`, [id]);
        const r = await nopVong(id, v, v === 1 ? { mua: ['bat_day'], lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] } : {});
        expect(r.error, `vòng ${v}: ${JSON.stringify(r).slice(0, 200)}`).toBeUndefined();
      }
      const mo = await post(`/api/v1/holdem/matches/${id}/minigame`, { vong: tong });
      expect(mo.status, 'mở được màn cuối').toBe(200);
      await luiMan(id, 37, tong);
      const nay = nhipMay(await batDauMs(id, tong), Date.now());
      const b = await post(`/api/v1/holdem/matches/${id}/minigame/${tong}/lenh`, { nhip: nay - 2, nut: 'vao_het' });
      expect((await b.json() as any).nhan).toBe(true);
      await ngu(Math.max(0, await batDauMs(id, tong) + 38_200 - Date.now()));
      const kq = await (await req(`/api/v1/holdem/matches/${id}/minigame/${tong}/ket-qua`)).json() as any;
      expect(kq.loi, 'lãi lỗ màn 0 thì bài này không đo được gì').not.toBe(0);
      const g = await json(`/api/v1/holdem/matches/${id}`);
      expect(g.status).toBe('xong');
      expect(g.ban.nav, 'NAV cuối trận gồm phần màn cuối').toBe(kq.nav_sau);
      const luu = Number((await pool.query(`SELECT von_cuoi FROM holdem_results WHERE match_id = $1 AND ghe_id = 'ban'`, [id])).rows[0]!.von_cuoi);
      expect(luu, 'kết quả LƯU (xếp hạng) cũng gồm phần màn cuối').toBe(kq.nav_sau);
      const kq2 = await (await req(`/api/v1/holdem/matches/${id}/minigame/${tong}/ket-qua`)).json() as any;
      expect(kq2.loi, 'kết quả màn cuối đọc lại sau khi khép = số đã áp').toBe(kq.loi);
    }, 400_000);
    it('⭐ nộp vòng cuối ⇒ CHƯA khép (cho_man, không lưu kết quả); qua màn ⇒ GET khép trận, dòng cuối có mg_sau, kết quả lưu đúng một lượt, /ket-qua vòng cuối vẫn đọc được', async () => {
      user = await nguoiTester();
      const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V57, ep_seed: SEED_MAN_CUOI }) });
      const seedAn = (await pool.query('SELECT seed::text AS s FROM holdem_matches WHERE match_id = $1', [t.match_id])).rows[0]?.s;
      expect(seedAn, 'ep_seed bị bỏ qua — người tạo trận phải là admin + la_tester').toBe(String(SEED_MAN_CUOI));
      const tong = t.tong_vong as number;
      let r: any;
      for (let v = 1; v <= tong; v++) {
        if (v >= 3) await pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '50 seconds' WHERE match_id = $1`, [t.match_id]);
        r = await nopVong(t.match_id, v, v === 1 ? { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] } : {});
        expect(r.error, `vòng ${v}: ${JSON.stringify(r).slice(0, 200)}`).toBeUndefined();
      }
      expect(r.cho_man?.vong, 'cú nộp cuối trả trạng thái chờ màn').toBe(tong);
      expect(r.cho_man?.het_ms, 'tiền đề: còn cầm mã tới vòng cuối (het_ms 0 = D549 bỏ chờ màn ⇒ chọn lại SEED_MAN_CUOI)').toBeGreaterThan(0);
      expect(r.xong, 'chưa khép').not.toBe(true);
      const row = async () => (await pool.query('SELECT status, action_log FROM holdem_matches WHERE match_id = $1', [t.match_id])).rows[0]!;
      expect((await row()).status).toBe('dang_choi');
      const soKq = async () => Number((await pool.query('SELECT count(*)::int AS n FROM holdem_results WHERE match_id = $1', [t.match_id])).rows[0]!.n);
      expect(await soKq()).toBe(0);
      expect((await json(`/api/v1/holdem/matches/${t.match_id}`)).cho_man?.vong, 'GET trong màn cuối vẫn giấu').toBe(tong);
      await pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '50 seconds' WHERE match_id = $1`, [t.match_id]);
      const g = await json(`/api/v1/holdem/matches/${t.match_id}`);
      expect(g.status).toBe('xong');
      expect(g.cho_man).toBeUndefined();
      const rw = await row();
      expect(rw.status).toBe('xong');
      const cuoi = (rw.action_log as any[]).filter((h) => !h.cho_nop).pop();
      expect(cuoi.vong).toBe(tong);
      expect(cuoi.mg_sau, 'dòng cuối mang kết quả màn cuối').toBeDefined();
      const n1 = await soKq();
      expect(n1, 'kết quả (mỗi ghế một dòng) đã lưu').toBeGreaterThan(0);
      await json(`/api/v1/holdem/matches/${t.match_id}`);   // hỏi lại không lưu hai lần
      expect(await soKq()).toBe(n1);
      const kq = await req(`/api/v1/holdem/matches/${t.match_id}/minigame/${tong}/ket-qua`);
      const jk = await kq.json() as any;
      // Seed ghim còn cầm BTC tới vòng cuối (tiền đề `het_ms` ở trên) ⇒ màn cuối có thật, không còn nhánh 404 `khong_co_ma` của seed ngẫu nhiên.
      expect(kq.status, `kết quả màn cuối đọc được sau khi trận khép: ${JSON.stringify(jk).slice(0, 200)}`).toBe(200);
      expect(jk.loi, 'không cầm lõi ⇒ chỉ xem = giữ ⇒ 0 (D521: + vết thác)').toBe(jk.vet ?? 0);
    }, 300_000);
    it('⭐ bỏ app giữa màn cuối ⇒ tick dọn quá hạn KHÉP trận như xong (lưu kết quả, mg_sau), không đóng thành bỏ dở', async () => {
      user = await createTestUser(pool);
      const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V57 }) });
      const tong = t.tong_vong as number;
      for (let v = 1; v <= tong; v++) {
        if (v >= 3) await pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '50 seconds' WHERE match_id = $1`, [t.match_id]);
        const r = await nopVong(t.match_id, v, {});
        expect(r.error, `vòng ${v}: ${JSON.stringify(r).slice(0, 200)}`).toBeUndefined();
      }
      // Không ai GET lại; một tiếng sau tick chạy.
      await pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '60 minutes' WHERE match_id = $1`, [t.match_id]);
      const q = await quetTranQuaHan(pool);
      expect(q.dong, 'không đóng bỏ dở').not.toContain(t.match_id);
      const rw = (await pool.query('SELECT status, action_log FROM holdem_matches WHERE match_id = $1', [t.match_id])).rows[0]!;
      expect(rw.status).toBe('xong');
      expect((rw.action_log as any[]).filter((h) => !h.cho_nop).pop().mg_sau).toBeDefined();
      expect(Number((await pool.query('SELECT count(*)::int AS n FROM holdem_results WHERE match_id = $1', [t.match_id])).rows[0]!.n)).toBeGreaterThan(0);
    }, 300_000);
  });
  describe('§VIII — D492: lõi Đòn Bẩy khớp trên server, vào NAV qua đường chính', () => {
    /** Trận cầm lõi Đòn Bẩy (mua ở vòng 1) + mua BTC ⇒ màn vòng 2 là màn Đòn Bẩy trên BTC. Quầy lõi ngẫu nhiên ⇒ thử tới 40 trận, mỗi lần người mới. */
    const tranDonBay = async (): Promise<string> => {
      user = await createTestUser(pool);
      for (let lan = 0; lan < 40; lan += 1) {
        const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V57 }) });
        if (!(t.shop?.chien_thuat ?? []).includes('don_bay') || (t.ban.danh_muc.chien_thuat as string[]).length) continue;
        let r = await nopVong(t.match_id, 1, { mua: ['don_bay'], lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] });
        expect(r.error, JSON.stringify(r).slice(0, 200)).toBeUndefined();
        r = await nopVong(t.match_id, 2, { lenh: [] });
        if (maNamNhieuNhat(r.ban?.vi_the ?? {}) === 'btc') return t.match_id as string;
      }
      throw new Error('40 trận không ra quầy có Đòn Bẩy + giữ được BTC');
    };
    const bam = (id: string, body: unknown) => post(`/api/v1/holdem/matches/${id}/minigame/2/lenh`, body);
    const ngu = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

    it('⭐ đầu màn báo nút Đòn Bẩy + tiền ×L; VÀO ×10 ⇒ sổ trả ngưỡng gọi/thanh lý từ nhịp kế; hết màn ⇒ khoản + NAV + `mg` đúng hàm khớp', async () => {
      const id = await tranDonBay();
      const d = await (await moMan(id)).json() as any;
      expect(d.la).toBe('don_bay');
      expect(d.nut).toEqual(NUT_LOI.don_bay);
      expect(d.so.tien_nut.vao_x10).toBe(d.von);
      expect(d.so.tien_nut.chot).toBe(0);
      const bc = await luiMan(id, 30);
      const nay = nhipMay(await batDauMs(id), Date.now());
      const so = await (await bam(id, { nhip: nay - 2, nut: 'vao_x10', khoa: 'v' })).json() as any;
      expect(so.nhan, JSON.stringify(so).slice(0, 300)).toBe(true);
      expect(so.so.db.L).toBe(10);
      expect(so.so.db.ky_quy).toBe(bc.von);
      expect(so.so.tien_nut.vao_x10, 'đã vào ⇒ nút VÀO tắt').toBe(0);
      expect(so.so.tien_nut.chot).toBe(bc.von);
      expect(so.so.db.nguong.tu).toBe(nay - 1);
      expect(so.so.db.nguong.thanh_ly).toHaveLength(SO_NHIP - (nay - 1));
      expect(so.so.db.nguong.goi[0]).toBeGreaterThan(so.so.db.nguong.thanh_ly[0]);
      // NẠP khi chưa từng bị gọi: server nhận cú bấm (cửa một chiều ghi đủ) nhưng khớp bỏ qua.
      const nguon = Object.keys(bc.nap_tu ?? {})[0];
      if (nguon) expect((await (await bam(id, { nhip: nay - 1, nut: `nap_${nguon}` })).json() as any).nhan).toBe(true);
      await ngu(Math.max(0, await batDauMs(id) + 38_200 - Date.now()));
      const lenh = (await pool.query('SELECT lenh FROM holdem_minigame_man WHERE match_id = $1 AND vong = 2', [id])).rows[0]!.lenh;
      const mong = ketQuaMan({ min: dungDongMan(bc), ...thamSoKhop(bc), la: 'don_bay', lenh });
      const kq = await (await req(`/api/v1/holdem/matches/${id}/minigame/2/ket-qua`)).json() as any;
      expect(kq.loi, JSON.stringify(kq).slice(0, 300)).toBe(mong.loi);
      expect(kq.db.L0).toBe(10);
      expect(kq.nhan).toEqual(mong.nhan);
      expect(mong.loi, 'lãi lỗ 0 thì bài này không đo được gì').not.toBe(0);
      const sau = await json(`/api/v1/holdem/matches/${id}`);
      expect(sau.ban.vi_the.btc).toBe(Math.max(0, kq.von_sau + mong.loi));
      expect(sau.ban.nav).toBe(kq.nav_sau);
      const r = await nopVong(id, 3);
      expect(r.error, JSON.stringify(r).slice(0, 200)).toBeUndefined();
      const dong3 = (await pool.query('SELECT action_log FROM holdem_matches WHERE match_id = $1', [id])).rows[0]!.action_log
        .find((h: any) => h.vong === 3 && !h.cho_nop);
      expect(dong3.mg.ban).toEqual({ ma: 'btc', loi: mong.loi });
    }, 300_000);
  });
  describe('§X — D507: BÁN HẾT dồn ký quỹ qua HTTP + DB, vòng sau khoản đã bán còn 0 chip', () => {
    /** Dời giờ màn (GIỮ lệnh đã ghi — khác `luiMan`) để nhịp máy đang ở `k`. */
    const denNhip = async (id: string, k: number) => {
      // Dòng màn là cửa một chiều (D466: chỉ được nối lệnh) ⇒ xoá rồi ghi lại với giờ mới, mang nguyên lệnh.
      const r = await pool.query('DELETE FROM holdem_minigame_man WHERE match_id = $1 AND vong = 2 RETURNING boi_canh, phien_ban, lenh', [id]);
      await pool.query(`INSERT INTO holdem_minigame_man (match_id, vong, phien_ban, boi_canh, bat_dau, lenh) VALUES ($1, 2, $2, $3, to_timestamp($4::double precision / 1000), $5)`,
        [id, r.rows[0]!.phien_ban, JSON.stringify(r.rows[0]!.boi_canh), Date.now() - DEM_MS - ((k + 1.5) * CHAY_MS) / SO_NHIP, JSON.stringify(r.rows[0]!.lenh ?? [])]);
    };
    /** Nhịp VÀO + nhịp BÁN HẾT mà server chắc chắn khớp (đang bị gọi, chưa bị thanh lý) trên đường của màn — tìm bằng chính hàm khớp. */
    const timCuaGoi = (bc: BoiCanhMan) => {
      const min = dungDongMan(bc), ts = thamSoKhop(bc);
      for (const L of [10, 4]) {
        for (let k0 = 30; k0 < 300; k0 += 5) {
          const vao = [{ seq: 1, nhip: k0, nut: `vao_x${L}` }];
          if (!ketQuaMan({ min, ...ts, la: 'don_bay', lenh: vao }).db?.daGoi) continue;
          for (let kb = k0 + 3; kb < Math.min(SO_NHIP - 40, k0 + 200); kb += 1) {
            const kq = ketQuaMan({ min, ...ts, la: 'don_bay', lenh: [...vao, { seq: 2, nhip: kb, nut: 'ban_het' }] });
            if (kq.db?.banHet === kb) return { L, k0, kb };
            if (kq.db?.thanhLy && kq.db.thanhLy.nhip <= kb) break;
          }
        }
      }
      return null;
    };
    const bam = (id: string, body: unknown) => post(`/api/v1/holdem/matches/${id}/minigame/2/lenh`, body);

    it('⭐ bị gọi ⇒ BÁN HẾT: sổ báo `ban_het`; kết quả có từng khoản bán trọn (`luc: ban_het`, kể cả Tiền mặt); quyết toán vòng 3 trừ trọn — khoản đã bán còn 0', async () => {
      let id = '', bc: BoiCanhMan | null = null, cua: ReturnType<typeof timCuaGoi> = null;
      for (let lan = 0; lan < 8 && !cua; lan += 1) {
        user = await createTestUser(pool);
        for (let t = 0; t < 40; t += 1) {
          const tr = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V57 }) });
          if (!(tr.shop?.chien_thuat ?? []).includes('don_bay') || (tr.ban.danh_muc.chien_thuat as string[]).length) continue;
          // Crypto 50 % + Vàng 25 % NAV (mốc bước thô — bội 2.500): Vàng là khoản khác để BÁN HẾT bán trọn. Lệnh vòng N khớp ở vòng N + 1.
          let r = await nopVong(tr.match_id, 1, { mua: ['don_bay'], lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }, { ma: 'vang', chieu: 'mua', moc_bp: 2500 }] });
          if (r.error) continue;
          r = await nopVong(tr.match_id, 2, { lenh: [] });
          if (r.error || !(r.ban?.vi_the?.vang > 0)) continue;
          if (maNamNhieuNhat(r.ban?.vi_the ?? {}) !== 'btc') continue;
          id = tr.match_id as string; break;
        }
        if (!id) continue;
        const d = await (await moMan(id)).json() as any;
        if (d.la !== 'don_bay') { id = ''; continue; }
        bc = (await pool.query('SELECT boi_canh FROM holdem_minigame_man WHERE match_id = $1 AND vong = 2', [id])).rows[0]!.boi_canh as BoiCanhMan;
        cua = timCuaGoi(bc);
        if (!cua) id = '';
      }
      expect(cua, 'không tìm được màn có cú gọi để thử').not.toBeNull();
      expect(bc!.nap_tu?.tien, 'Tiền mặt phải nằm trong nguồn nạp (D507)').toBeGreaterThan(0);
      await denNhip(id, cua!.k0 + 3);
      expect((await (await bam(id, { nhip: cua!.k0, nut: `vao_x${cua!.L}` })).json() as any).nhan).toBe(true);
      await denNhip(id, cua!.kb + 3);
      const so = await (await bam(id, { nhip: cua!.kb, nut: 'ban_het' })).json() as any;
      expect(so.nhan, JSON.stringify(so).slice(0, 300)).toBe(true);
      expect(so.so.db.ban_het).toBe(cua!.kb);
      expect(so.so.tien_nut.ban_het, 'đã dồn hết ⇒ nút tắt').toBe(0);
      await denNhip(id, SO_NHIP + 200);
      const lenh = (await pool.query('SELECT lenh FROM holdem_minigame_man WHERE match_id = $1 AND vong = 2', [id])).rows[0]!.lenh;
      const mong = ketQuaMan({ min: dungDongMan(bc!, lenh), ...thamSoKhop(bc!), la: 'don_bay', lenh });
      const kq = await (await req(`/api/v1/holdem/matches/${id}/minigame/2/ket-qua`)).json() as any;
      expect(kq.loi, JSON.stringify(kq).slice(0, 300)).toBe(mong.loi);
      const ban = (kq.db.nap as any[]).filter((n) => n.luc === 'ban_het');
      expect(ban.map((n) => n.ma).sort()).toEqual(Object.keys(bc!.nap_tu!).filter((m) => bc!.nap_tu![m]! > 0).sort());
      expect(ban.find((n) => n.ma === 'tien')!.phi).toBe(0);
      expect(ban.some((n) => n.ma !== 'tien'), `phải có một khoản tài sản bị bán trọn (nguồn: ${JSON.stringify(bc!.nap_tu)})`).toBe(true);
      // Đầu vòng 3 (chưa nộp): màn vòng 2 đã áp — đúng thứ người chơi thấy ở vòng sau (cùng `apMg` với dòng log).
      const sau = await json(`/api/v1/holdem/matches/${id}`);
      for (const n of ban) if (n.ma !== 'tien') expect(sau.ban.vi_the[n.ma] ?? 0, `${n.ma} phải còn 0 chip ở vòng sau`).toBe(0);
      const r3 = await nopVong(id, 3);
      expect(r3.error, JSON.stringify(r3).slice(0, 200)).toBeUndefined();
      const dong3 = (await pool.query('SELECT action_log FROM holdem_matches WHERE match_id = $1', [id])).rows[0]!.action_log
        .find((h: any) => h.vong === 3 && !h.cho_nop);
      expect(dong3.mg.ban.nap).toEqual(Object.fromEntries(ban.map((n) => [n.ma, n.lay])));
      expect(dong3.mg.ban.het).toEqual(ban.filter((n) => n.ma !== 'tien').map((n) => n.ma));
    }, 600_000);
  });
  describe('§IX — D499: lệnh của vai lớn tự đẩy giá · Tổ Chức có giá trần', () => {
    /** Tester ép vai `vai`, trận v57 có Bắt Đáy ở quầy vòng 1 + giữ BTC ⇒ màn vòng 2 là Bắt Đáy trên BTC. */
    const tranVai = async (vai: string): Promise<string> => {
      user = await createTestUser(pool, { role: 'admin' });
      await pool.query('UPDATE users SET la_tester = true WHERE user_id = $1', [user.userId]);
      for (let lan = 0; lan < 40; lan += 1) {
        const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V57, ep_vai: vai }) });
        if (t.error || !(t.shop?.chien_thuat ?? []).includes('bat_day') || (t.ban.danh_muc.chien_thuat as string[]).length) continue;
        // Tổ Chức: mandate không cho một mã quá 40 % NAV (đúng 40 % cộng phí là vượt, bị bỏ lặng lẽ) ⇒ mốc 25 %.
        let r = await nopVong(t.match_id, 1, { mua: ['bat_day'], lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: vai === 'to_chuc' ? 2500 : 5000 }] });
        if (r.error) continue;
        r = await nopVong(t.match_id, 2, { lenh: [] });
        if (maNamNhieuNhat(r.ban?.vi_the ?? {}) === 'btc') return t.match_id as string;
      }
      throw new Error(`40 trận không ra Bắt Đáy + BTC cho vai ${vai}`);
    };
    const bam = (id: string, body: unknown) => post(`/api/v1/holdem/matches/${id}/minigame/2/lenh`, body);

    it('⭐ Cá Mập VÀO HẾT ⇒ sổ báo 1 cú đẩy; dòng nhịp từ nhịp kế trả đúng đường GỐC + cú đẩy (một công thức với khớp)', async () => {
      const id = await tranVai('ca_map');
      await moMan(id);
      const bc = await luiMan(id, 25);
      expect(bc.tu_day, 'Cá Mập dưới v57 phải có hệ số tự đẩy').toBeGreaterThan(0);
      const nay = nhipMay(await batDauMs(id), Date.now());
      expect((await json(`/api/v1/holdem/matches/${id}/minigame/2/nhip?mot_lan=1`)).lo.tt, 'D504 — chưa cầm ⇒ không có tạm tính').toBeUndefined();
      const so = await (await bam(id, { nhip: nay - 2, nut: 'vao_het' })).json() as any;
      expect(so.nhan, JSON.stringify(so).slice(0, 200)).toBe(true);
      expect(so.so.xung).toBe(1);
      const lenh = (await pool.query('SELECT lenh FROM holdem_minigame_man WHERE match_id = $1 AND vong = 2', [id])).rows[0]!.lenh;
      const kq = ketQuaMan({ min: dungDongMan(bc, lenh), ...thamSoKhop(bc), la: 'bat_day', lenh });
      const mong = apXungBan(dungDongMan(bc, lenh), kq.xungBan);
      const lo = await json(`/api/v1/holdem/matches/${id}/minigame/2/nhip?mot_lan=1&tu=${nay - 1}`);
      const k = nay, chay = mong.slice(20);   // nhịp đã lộ (dòng hỏi-một-lần chỉ trả tới nhịp máy)
      expect(lo.lo.gia[k - (nay - 1)]).toBeCloseTo(chay[Math.floor(k / 8)]!.tick[k % 8]!, 3);
      expect(chay[Math.floor(k / 8)]!.tick[k % 8]!, 'cú đẩy phải làm giá khác đường gốc')
        .not.toBeCloseTo(dungDongMan(bc, lenh).slice(20)[Math.floor(k / 8)]!.tick[k % 8]!, 6);
      // D504 — dòng nhịp kèm lãi lỗ TẠM TÍNH (số tiền, server tính) từng nhịp đã lộ = hàm khớp của sổ tới cú bấm cuối (client chỉ in — C4).
      const soCuoi = ketQuaMan({ min: dungDongMan(bc, lenh), ...thamSoKhop(bc), la: 'bat_day', lenh, denNhip: nay - 2 });
      expect(lo.lo.tt).toHaveLength(lo.lo.gia.length);
      (lo.lo.tt as number[]).forEach((x, i) => expect(x, `nhịp ${nay - 1 + i}`).toBe(soCuoi.tamTinh!(nay - 1 + i)));
      expect(Number.isInteger(lo.lo.tt[0])).toBe(true);
      // D523 — màn Bắt Đáy mới: lớp soi là ĐƯỜNG GIÁ TRỊ + QUÁ BÁN (không còn đáy thác), đúng `soiGiaTri` ở nhịp cuối của lô.
      const kCuoi = lo.lo.tu + lo.lo.gia.length - 1;
      expect(lo.lo.soi).toEqual({ gt: soiGiaTri(dungDongMan(bc, lenh), kCuoi, { seed: bc.seed, ma: bc.ma, ...(bc.che_do ? { cheDo: bc.che_do } : {}) }) });
      expect(lo.lo.soi.gt.diem.length, 'đã qua vài nến ⇒ có điểm giá trị').toBeGreaterThan(0);
    }, 300_000);

    it('⭐ Tổ Chức: đầu màn báo `to_chuc`; VÀO HẾT ⇒ sổ có GIÁ TRẦN (−8 % theo giá đóng) để client bật búa', async () => {
      const id = await tranVai('to_chuc');
      const d = await (await moMan(id)).json() as any;
      expect(d.to_chuc).toBe(true);
      expect(d.nghien_cuu?.day, 'D500 — đầu màn Tổ Chức mang bàn nghiên cứu').toHaveLength(6);
      await luiMan(id, 25);
      const nay = nhipMay(await batDauMs(id), Date.now());
      const so = await (await bam(id, { nhip: nay - 2, nut: 'vao_het' })).json() as any;
      expect(so.so.gia_tran, JSON.stringify(so.so).slice(0, 300)).toBeLessThan(so.so.vao[0].khop);
    }, 300_000);
  });
});
