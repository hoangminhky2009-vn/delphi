// @vitest-environment node
/**
 * BẢN DEMO "KHÁCH NÂNG CAO" — máy chủ trong trang chạy ĐÚNG server thật, và KHÔNG thu dữ liệu (founder 28/09: link cho
 * pitch deck *"trải nghiệm full chức năng … mà ko cần đăng nhập, ko lưu dữ liệu (ko phải link tester)"*).
 *
 *  §I   dựng từ đủ migration + CHÍNH `createApp` (`dungMayChu`, cùng hàm worker gọi): khách vào thẳng bằng Bearer, trận
 *       thật tạo được và chạy trọn vòng.
 *  §II  khách không thành một dòng nghiên cứu: `research_consent = FALSE` ⇒ telemetry không ghi. VẾ NGƯỢC: bật đồng ý thì
 *       cùng lô ấy được ghi — bài đo CỔNG đồng ý, không đo một payload hỏng (bài xanh vì payload sai là bài rỗng).
 *  §III bộ chuyển pg ↔ PGlite giữ đúng ngữ nghĩa node-pg mà server dựa vào: `rowCount` của SELECT (thiếu nó mọi trận
 *       "không thấy" — đã vấp lúc thử 28/09), int8 là chuỗi, hai giao dịch không đan câu vào nhau.
 *  §IV  lớp đệm crypto trùng `node:crypto` (băm phiên · TOTP).
 *  §V   một nguồn dựng app: app thật và demo cùng gọi `veApp`; demo không tự nạp CSS (bản sao thứ hai sẽ trôi — A11.5).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as nodeCrypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite, types } from '@electric-sql/pglite';
import { dungMayChu, type MayChu } from '../src/demo/may_chu';
import { taoPoolPglite } from '../src/demo/pg_pglite';
import * as shim from '../src/demo/shim/crypto';
import cauHinhDemo, { BAM_HEADER, HEADER_DEMO, headerChoDemo } from '../vite.demo.config';
import { khoSoMau } from '../src/demo/so_mau';
import { duongKhiMoLai } from '../src/demo/duong_dan';
import { docHoSo } from '../src/pfm/ho_so';
import { CONSENT_PHIEN_BAN } from '@config/pfm_consent';

let may: MayChu;
const goi = async (duong: string, init: RequestInit = {}) => {
  const r = await may.app.request(`http://demo.test/api/v1${duong}`, {
    ...init,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${may.token}`, ...(init.headers ?? {}) },
  });
  let j: any = null;
  try { j = await r.json(); } catch { /* thân rỗng */ }
  return { s: r.status, j };
};

beforeAll(async () => { may = await dungMayChu('http://demo.test'); }, 120_000);

describe('§I — server thật trong trang', () => {
  it('⭐ khách vào thẳng (Bearer, không đăng nhập): /auth/me 200, đã qua cửa, không đồng ý nghiên cứu', async () => {
    const me = await goi('/auth/me');
    expect(me.s).toBe(200);
    expect(me.j.onboarded).toBe(true);
    const { rows } = await may.db.query<{ research_consent: boolean }>(
      'SELECT research_consent FROM users WHERE user_id = $1', [may.userId]);
    expect(rows[0]!.research_consent).toBe(false);
  });

  it('⭐ trận thật: tạo → đọc → nộp trọn mọi vòng tới khi xong (engine + bot + DB đều chạy trong trang)', async () => {
    const tao = await goi('/holdem/matches', { method: 'POST', body: JSON.stringify({}) });
    expect(tao.s).toBe(201);
    const id = tao.j.match_id as string;
    let st = await goi(`/holdem/matches/${id}`);
    let soVong = 0;
    while (st.s === 200 && st.j.status === 'dang_choi' && soVong < 20) {
      const r = await goi(`/holdem/matches/${id}/rounds`, {
        method: 'POST',
        body: JSON.stringify({ vong: st.j.vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [],
          lenh: soVong === 0 ? [{ ma: 'vang', chieu: 'mua', moc_bp: 5000 }] : [] }),
      });
      expect(r.s, `vòng ${st.j.vong}: ${JSON.stringify(r.j).slice(0, 160)}`).toBe(200);
      soVong += 1;
      // D525 — khung minigame (mặc định v58): sau cú nộp có MÀN LÕI chạy theo đồng hồ server (cho_man). Thời gian thật thì màn tự xong;
      // ở đây lùi mốc mở vòng qua hết phần màn — cùng cách bài màn ở gốc (`minigame_api.test.ts`).
      if (r.j.cho_man) {
        await may.db.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '60 seconds' WHERE match_id = $1`, [id]);
      }
      st = await goi(`/holdem/matches/${id}`);
    }
    expect(st.j.status).toBe('xong');
    expect(soVong).toBeGreaterThan(5);
  }, 120_000);
});

describe('§II — khách demo không thành dữ liệu nghiên cứu', () => {
  const lo = (k: string) => JSON.stringify({ idempotency_key: k, phien: 'demo-phien', su_kien: [{ loai: 'man_vao', man: '/arena' }] });
  const demDong = async () => (await may.db.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM telemetry WHERE user_id = $1', [may.userId])).rows[0]!.n;

  it('⭐ không đồng ý ⇒ lô telemetry KHÔNG ghi dòng nào; vế ngược: bật đồng ý ⇒ cùng lô ấy được ghi', async () => {
    const r1 = await goi('/telemetry', { method: 'POST', body: lo('demo-k1') });
    expect(r1.s, JSON.stringify(r1.j)).toBeLessThan(500);
    expect(await demDong()).toBe(0);
    // 0079 — đồng ý CÓ HIỆU LỰC cần cả số bản hiện hành (bật trơn không số bản = coi như TẮT).
    await may.db.query('UPDATE users SET research_consent = TRUE, research_consent_phien_ban = $2 WHERE user_id = $1',
      [may.userId, CONSENT_PHIEN_BAN.nghien_cuu]);
    try {
      const r2 = await goi('/telemetry', { method: 'POST', body: lo('demo-k2') });
      expect(r2.s, JSON.stringify(r2.j)).toBeLessThan(300);
      expect(await demDong(), 'bật đồng ý mà vẫn 0 dòng ⇒ bài đo payload hỏng, không đo cổng').toBeGreaterThan(0);
    } finally {
      await may.db.query('UPDATE users SET research_consent = FALSE WHERE user_id = $1', [may.userId]);
    }
  });
});

describe('§III — bộ chuyển pg ↔ PGlite giữ ngữ nghĩa node-pg', () => {
  it('rowCount: SELECT có dòng = số dòng (PGlite để affectedRows = 0) · UPDATE không RETURNING = số dòng đổi · int8 là chuỗi', async () => {
    const db = new PGlite({ parsers: { [types.INT8]: (x: string) => x } });
    const pool = taoPoolPglite(db);
    await pool.query('CREATE TABLE t (id int8 PRIMARY KEY, v int)');
    await pool.query('INSERT INTO t VALUES (1, 10), (2, 20), (3, 30)');
    const sel = await pool.query('SELECT id FROM t WHERE v >= $1', [20]);
    expect(sel.rowCount).toBe(2);
    expect(typeof sel.rows[0].id).toBe('string');
    expect((await pool.query('UPDATE t SET v = v + 1 WHERE v < $1', [25])).rowCount).toBe(2);
    expect((await pool.query('SELECT id FROM t WHERE v > $1', [999])).rowCount).toBe(0);
    await db.close();
  });

  it('hai giao dịch không đan câu: giao dịch sau chờ giao dịch trước release mới BEGIN', async () => {
    const db = new PGlite();
    const pool = taoPoolPglite(db);
    const nhat: string[] = [];
    const a = await pool.connect();
    const choB = pool.connect().then(async (b) => { nhat.push('B vào'); await b.query('BEGIN'); await b.query('COMMIT'); b.release(); });
    await a.query('BEGIN');
    nhat.push('A giữa giao dịch');
    await new Promise((r) => setTimeout(r, 30));
    await a.query('COMMIT');
    a.release();
    await choB;
    expect(nhat).toEqual(['A giữa giao dịch', 'B vào']);
    await db.close();
  });
});

describe('§IV — lớp đệm crypto trùng node:crypto', () => {
  it('sha256 · sha1 · HMAC trên chuỗi rỗng, tiếng Việt, khối biên 55/56/64 byte, khoá dài', () => {
    for (const s of ['', 'abc', 'Tiếng Việt có dấu', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'q'.repeat(1000)]) {
      for (const t of ['sha256', 'sha1']) {
        expect(shim.createHash(t).update(s).digest('hex'), `${t} ${s.length}`).toBe(nodeCrypto.createHash(t).update(s).digest('hex'));
        for (const k of ['k', 'khoá dài '.repeat(20)]) {
          expect(shim.createHmac(t, k).update(s).digest('hex')).toBe(nodeCrypto.createHmac(t, k).update(s).digest('hex'));
        }
      }
    }
  });
});

describe('§V — một nguồn dựng app', () => {
  const doc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
  it('app thật và demo cùng gọi `veApp`; demo không tự nạp CSS; `veApp` mang danh sách font/CSS', () => {
    expect(doc('src/main.tsx')).toMatch(/veApp\(document\.getElementById\('root'\)!\)/);
    const demo = doc('src/demo/main.tsx');
    expect(demo).toMatch(/veApp\(goc, \{ bangDemo: true \}\)/);
    expect(demo).not.toMatch(/import ['"][^'"]+\.css['"]/);
    expect(doc('src/app/ve_app.tsx')).toMatch(/import '@fontsource-variable\/handjet\/full\.css';/);
    expect(doc('src/main.tsx')).not.toMatch(/import ['"][^'"]+\.css['"]/);
  });

  it('bản demo nới CSP đúng một nguồn cho WASM (PGlite), app thật giữ nguyên — link thật từng đứng im ở màn chờ vì thiếu nó', () => {
    expect(HEADER_DEMO).toContain("script-src 'self' 'wasm-unsafe-eval';");
    expect(HEADER_DEMO, 'không được mở eval của JS').not.toMatch(/script-src[^;\n]*\s'unsafe-eval'/);
    expect(HEADER_DEMO.replace("'wasm-unsafe-eval' ", '').replace(" 'wasm-unsafe-eval'", ''), 'ngoài một nguồn ấy, header demo trùng app thật')
      .toBe(doc('public/_headers'));
    expect(doc('public/_headers')).not.toMatch(/wasm-unsafe-eval/);
    expect(() => headerChoDemo('script-src *;'), 'CSP gốc đổi dạng ⇒ build phải ĐỎ, không lặng lẽ bỏ qua').toThrow();
  });

  it('dải demo né thanh điều hướng đáy: bộ chọn trong `ve_app` trỏ đúng nhãn của `BottomNav`', () => {
    const m = doc('src/app/ve_app.tsx').match(/body:has\(nav\[aria-label="([^"]+)"\]\)/);
    expect(m, 'dải demo mất luật né thanh đáy — nó sẽ che chữ HUB · TOKEN · MAP').not.toBeNull();
    expect(doc('src/components/BottomNav.tsx')).toContain(`aria-label="${m![1]}"`);
    // Màn toàn cảnh (trận · SHOP · chợ trait/lõi) có hàng nút ở đáy: dải ẩn mặc định, chỉ hiện khi có thanh điều hướng.
    const ve = doc('src/app/ve_app.tsx');
    expect(ve, 'dải phải ẨN mặc định — soi 28/09 nó đè "ĐỔI TRAIT", "ĐỔI LÕI", CHỐT VÒNG').toMatch(/\.bang-demo \{ display: none;/);
    expect(ve).toMatch(/body:has\(nav\[aria-label="[^"]+"\]\) \.bang-demo \{ display: block; \}/);
  });

  it('mở lại trang ở đường dẫn trận / bàn cũ ⇒ về sảnh Đấu trường (DB mới trống — soi 28/09 ra màn trắng); đường khác giữ', () => {
    expect(duongKhiMoLai('/arena/tran/331a25e8-651a-4d61-b69c-a598196cf6ee')).toBe('/arena');
    expect(duongKhiMoLai('/arena/ban/ABCD')).toBe('/arena');
    for (const d of ['/', '/arena', '/tai-chinh/so', '/bach-khoa']) expect(duongKhiMoLai(d), d).toBeNull();
    expect(doc('src/demo/main.tsx'), 'main.tsx phải gọi luật này TRƯỚC khi dựng app').toMatch(/duongKhiMoLai\(location\.pathname\)[\s\S]*veApp\(goc/);
  });

  it('⭐ tên tệp worker mang băm của header demo — đổi header là đổi tên, không ai kẹt với header cũ trong cache immutable', () => {
    expect(BAM_HEADER).toBe(nodeCrypto.createHash('sha256').update(HEADER_DEMO).digest('hex').slice(0, 8));
    const ra = (cauHinhDemo as { worker?: { rollupOptions?: { output?: { entryFileNames?: unknown } } } })
      .worker?.rollupOptions?.output?.entryFileNames;
    expect(typeof ra).toBe('string');
    expect(ra as string).toContain(BAM_HEADER);
    expect(ra as string).toMatch(/\[hash\]/);
  });
});

describe('§VI — sổ mẫu PFM (khu Tài chính của bản demo)', () => {
  it('sổ mẫu dựng bằng đúng hàm nghiệp vụ: hồ sơ phỏng vấn qua `suaHoSo`, có tiền vào · chi hằng ngày · góp hũ, đủ ba hũ', async () => {
    const kho = await khoSoMau();
    const hs = await docHoSo(kho);
    expect(hs.tuLap).toBe('ban_tu_lap');
    expect(hs.khung).toBe('hu');
    expect(hs.coNo).toBe(false);
    expect(hs.mucTieu).toHaveLength(3);
    const khoan = (await kho.liet<{ chieu?: string; huId?: string }>('khoan')).map((b) => b.d);
    expect(khoan.filter((k) => k.chieu === 'thu').length, 'tiền vào').toBeGreaterThanOrEqual(4);
    expect(khoan.filter((k) => k.huId !== undefined).length, 'góp hũ').toBeGreaterThanOrEqual(6);
    expect(khoan.length, 'mười tuần chi hằng ngày').toBeGreaterThan(150);
    expect(await kho.liet('hu')).toHaveLength(3);
  });
});
