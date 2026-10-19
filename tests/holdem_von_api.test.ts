/**
 * LÕI VỐN — TẦNG API, qua HTTP, DB thật, đúng đường code production.
 *
 * `holdem_von.test.ts` đã khoá phần LÕI (hai hàm thuần + dây chuyền chấm điểm).
 * File này chỉ hỏi bốn câu mà lõi KHÔNG trả lời được, và cả bốn đều là chỗ tính
 * năng chết trong im lặng:
 *
 *   1. CÓ ĐƯỜNG CHẠY NÀO GỌI TỚI KHÔNG. Bẫy số 1 của repo là cơ chế trang trí:
 *      code có, test có, mà `replay()` không gọi. Nên ở đây ĐO trạng thái qua
 *      endpoint trước/sau, không khẳng định hàm trả đúng.
 *   2. TRẬN CŨ CÓ REPLAY RA ĐÚNG KẾT QUẢ CŨ KHÔNG. Đây là câu đắt nhất: engine
 *      vừa đổi cả dây chuyền chấm điểm, mà trạng thái trận được DỰNG LẠI từ
 *      `action_log` mỗi request. Cổng hỏng = mọi trận đang lưu trên prod đổi kết
 *      quả, im lặng, không cách nào biết.
 *   3. LỆNH BỊ TỪ CHỐI CÓ NÓI RA KHÔNG. Hai hàm `ap*` bỏ qua IM LẶNG; không trả
 *      lý do ra là người chơi tưởng mình vừa thoát khỏi một mã mà không hề.
 *   4. EVENT CÓ ĐƯỢC GHI KHÔNG (A7/D25-R1). `events` append-only: thiếu ở đây là
 *      thiếu vĩnh viễn, không backfill được.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { KHOA_TAI_SAN, TAI_SAN } from '../config/holdem.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-secret-von', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function json(path: string, init: RequestInit = {}): Promise<any> {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
  return r.json();
}

/*
 * ⚠ GHIM v10a — BỘ TEST DI SẢN (28/07, khi mặc định lật sang v10b-nav).
 * File này đo các cơ chế của MÔ HÌNH LÁ BÀI: mua tài sản bằng lá, đảo danh
 * mục kiểu cũ, số học không-lạm-phát. Trong nav chúng chết THEO THIẾT KẾ
 * (tài sản đi bằng lệnh mốc, đảo = bán A mua B, tiền mặt chịu lạm phát) —
 * nhưng trận v10a đã lưu vẫn replay bằng luật này nên luật này vẫn cần người
 * canh. Đối chứng nav nằm ở holdem_nav_api.test.ts.
 */
const taoTran = () => json('/api/v1/holdem/matches', {
  method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v10a-tatcuoc' }),
});
const xemTran = (id: string) => json(`/api/v1/holdem/matches/${id}`);

/** Nộp một vòng. `them` gộp `dao`/`khoa`/`mua` tuỳ ca. */
const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}) =>
  json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, ...them,
    }),
  });

/** Mã KHÔNG nằm trong danh mục — đích hợp lệ cho một lệnh tái cơ cấu. */
function maKhac(dangNam: readonly string[]): string {
  const t = TAI_SAN.find((x) => !dangNam.includes(x.id));
  if (!t) throw new Error(`maKhac: đã cầm cả ${TAI_SAN.length} mã, không còn mã nào khác`);
  return t.id;
}

/*
 * ⚠ 27/07 — hai chỗ dưới từng gọi `maKhac(tao.shop.tai_san)`, tức lấy SHOP làm
 * đại diện cho "những mã người chơi có thể đang cầm". Đại diện đó đúng khi shop
 * bày 3 trong 6 mã; từ khi chợ bày ĐỦ 6 (spec 01 §4) thì "mã ngoài shop" không
 * tồn tại và `maKhac` trả undefined → test nổ với "Cannot read properties of
 * undefined", một thông báo chẳng liên quan gì tới luật đang kiểm.
 *
 * Ý ĐỊNH THẬT của hai test là "mã người chơi KHÔNG CẦM" — nên hỏi thẳng danh mục.
 * Ở vòng 1 danh mục rỗng, nên mọi mã đều hợp lệ.
 */
const CHUA_CAM_GI: readonly string[] = [];

describe('1. 🔴 CƠ CHẾ CÓ CHẠY THẬT KHÔNG (đo qua endpoint, không qua hàm)', () => {
  it('ĐẢO DANH MỤC: gửi `dao` ở vòng 2 → danh mục ĐỔI THẬT', async () => {
    const tao = await taoTran();
    const lay = tao.shop.tai_san[0] as string;
    await nopVong(tao.match_id, 1, { mua: [lay] });

    const truoc = await xemTran(tao.match_id);
    expect(truoc.ban.danh_muc.tai_san).toContain(lay);
    expect(truoc.ban.dao_duoc).toBe(true);

    const den = maKhac(truoc.ban.danh_muc.tai_san);
    const sau = await nopVong(tao.match_id, 2, { dao: { tu: lay, den } });

    expect(sau.loi_von).toBeNull();
    expect(sau.ban.danh_muc.tai_san).toContain(den);
    expect(sau.ban.danh_muc.tai_san).not.toContain(lay);
  });

  it('ĐẢO có GIÁ, và giá nằm trong dây chuyền chấm điểm chứ không ở đâu khác', async () => {
    const tao = await taoTran();
    const lay = tao.shop.tai_san[0] as string;
    await nopVong(tao.match_id, 1, { mua: [lay] });
    const truoc = await xemTran(tao.match_id);
    const den = maKhac(truoc.ban.danh_muc.tai_san);
    const sau = await nopVong(tao.match_id, 2, { dao: { tu: lay, den } });

    /*
     * Phí PHẢI hiện trong `chain` — đó là chỗ duy nhất người chơi đọc được VÌ SAO
     * mất tiền (D26 feedback-clarity). Trừ ngầm ở nơi khác thì con số cuối vẫn
     * đúng mà màn hình nói dối.
     */
    const chain = (sau.ket_qua_vong.cua_ban?.chain ?? []) as { kind: string }[];
    const phi = chain.find((m) => m.kind === 'dao_phi') as any;
    expect(phi, 'không có mắt xích dao_phi ⇒ phí không chạy').toBeTruthy();
    expect(phi.delta_bp).toBeLessThan(0);
    expect(phi.tu).toBe(lay);
    expect(phi.den).toBe(den);
  });

  it('KHOÁ TÀI SẢN: gửi `khoa` → chu kỳ chạy thật, đếm ngược đúng số vòng', async () => {
    const tao = await taoTran();
    const lay = tao.shop.tai_san[0] as string;
    const v1 = await nopVong(tao.match_id, 1, { mua: [lay], khoa: lay });

    expect(v1.loi_von).toBeNull();
    expect(v1.ban.khoa).not.toBeNull();
    expect(v1.ban.khoa.ma).toBe(lay);
    /*
     * ⚠ KIỂM QUAN HỆ, KHÔNG GHIM SỐ (bẫy số 7). Chu kỳ bắt ở vòng 1, nên khi đứng
     * ở vòng 2 thì phần còn lại phải đúng bằng `SO_VONG − 1` — công thức đó vẫn
     * đúng sau khi Monte Carlo đổi `SO_VONG`, còn `toBe(1)` thì không.
     */
    expect(v1.vong).toBe(2);
    expect(v1.ban.khoa.con_vong).toBe(KHOA_TAI_SAN.SO_VONG - 1);
    expect(v1.ban.khoa.la_vong_chot).toBe(KHOA_TAI_SAN.SO_VONG === 2);
    // Đang khoá thì không chồng thêm chu kỳ thứ hai.
    expect(v1.ban.khoa_duoc).toBe(false);
  });

  it('KHOÁ hết hạn thì BIẾN MẤT — chu kỳ không kéo dài vô tận', async () => {
    const tao = await taoTran();
    const lay = tao.shop.tai_san[0] as string;
    await nopVong(tao.match_id, 1, { mua: [lay], khoa: lay });
    for (let v = 2; v <= KHOA_TAI_SAN.SO_VONG; v += 1) await nopVong(tao.match_id, v);

    const sau = await xemTran(tao.match_id);
    expect(sau.vong).toBe(KHOA_TAI_SAN.SO_VONG + 1);
    expect(sau.ban.khoa).toBeNull();
  });

  it('PHÁ CAM KẾT: bán mã đang khoá ở vòng chốt → phạt vào dây chuyền', async () => {
    const tao = await taoTran();
    const lay = tao.shop.tai_san[0] as string;
    await nopVong(tao.match_id, 1, { mua: [lay], khoa: lay });

    const giua = await xemTran(tao.match_id);
    expect(giua.ban.khoa.la_vong_chot).toBe(true);   // SO_VONG = 2
    const den = maKhac(giua.ban.danh_muc.tai_san);
    const sau = await nopVong(tao.match_id, giua.vong, { dao: { tu: lay, den } });

    const chain = (sau.ket_qua_vong.cua_ban?.chain ?? []) as { kind: string }[];
    const pha = chain.find((m) => m.kind === 'be_keo') as any;
    expect(pha, 'bán mã đang khoá ở vòng chốt mà không bị phạt').toBeTruthy();
    expect(pha.phat_bp).toBe(KHOA_TAI_SAN.PHAT_BE_KEO_BP);
    // Hậu quả phải hiện ra để UI vẽ được, không chỉ nằm trong engine.
    expect(sau.ban.von_bi_giam).toBe(true);
  });
});

describe('2. 🔴 TRẬN CŨ REPLAY RA ĐÚNG KẾT QUẢ CŨ', () => {
  /**
   * Hai trận GIỐNG HỆT NHAU tới từng byte (cùng seed, cùng sơ đồ ghế, cùng
   * `balance_version` cũ), chơi cùng một chuỗi vòng — chỉ khác một trận có thêm
   * `dao`/`khoa` trong log. Nếu cổng phiên bản đúng thì hai trận ra CÙNG kết quả.
   *
   * ⚠ Đây là phép đo, không phải phép đọc code: cổng nằm ở `luatCua(...)` sâu
   * trong `layTran`, và cách duy nhất biết nó còn sống là so hai kết quả.
   */
  async function tranCuGiongNhau() {
    const a = await taoTran();
    const b = await taoTran();
    const row = await pool.query(
      'SELECT seed, ghe_json FROM holdem_matches WHERE match_id = $1', [a.match_id]);
    await pool.query(
      `UPDATE holdem_matches
          SET seed = $1, ghe_json = $2, balance_version = 'balance-v5-D30-camket'
        WHERE match_id = ANY($3)`,
      [row.rows[0]!.seed, JSON.stringify(row.rows[0]!.ghe_json),
        [a.match_id, b.match_id]]);
    return { a: a.match_id as string, b: b.match_id as string };
  }

  it('log CÓ `dao`/`khoa` mà trận chạy luật cũ → kết quả y hệt trận không có', async () => {
    const { a, b } = await tranCuGiongNhau();
    const shop = (await xemTran(a)).shop.tai_san[0] as string;

    await nopVong(a, 1, { mua: [shop] });
    await nopVong(b, 1, { mua: [shop], khoa: shop });

    const st1 = await xemTran(a);
    const den = maKhac(st1.ban.danh_muc.tai_san);
    const ka = await nopVong(a, 2);
    const kb = await nopVong(b, 2, { dao: { tu: shop, den } });

    expect(kb.ban.von).toBe(ka.ban.von);
    expect(kb.ban.danh_muc).toEqual(ka.ban.danh_muc);
    expect(kb.ket_qua_vong.cua_ban.pnl_bp).toBe(ka.ket_qua_vong.cua_ban.pnl_bp);
    // Và luật tắt thì hai cần gạt phải TẮT HẲN ở payload, không nửa vời.
    expect(kb.ban.luat_von).toBe(false);
    expect(kb.ban.dao_duoc).toBe(false);
    expect(kb.ban.khoa_duoc).toBe(false);
    expect(kb.ban.khoa).toBeNull();
  });
});

describe('3. 🔴 LỆNH BỊ TỪ CHỐI PHẢI NÓI RA (engine bỏ qua im lặng)', () => {
  it('đảo ở vòng 1 → trả `loi_von.dao`, không im lặng nuốt lệnh', async () => {
    const tao = await taoTran();
    const lay = tao.shop.tai_san[0] as string;
    const den = maKhac([lay]);
    const r = await nopVong(tao.match_id, 1, { mua: [lay], dao: { tu: lay, den } });
    expect(r.loi_von?.dao).toBe('chua_toi_vong');
    expect(r.ban.danh_muc.tai_san).not.toContain(den);
  });

  it('khoá mã KHÔNG cầm → trả `loi_von.khoa`', async () => {
    const tao = await taoTran();
    const khongCam = maKhac(CHUA_CAM_GI);
    const r = await nopVong(tao.match_id, 1, { khoa: khongCam });
    expect(r.loi_von?.khoa).toBe('khong_nam_ma');
    expect(r.ban.khoa).toBeNull();
  });

  it('id rác bị LỌC Ở TẦNG NHẬN — không lọt vào `action_log`', async () => {
    /*
     * `action_log` LÀ nguồn dựng lại trận, nên rác lọt vào là rác VĨNH VIỄN. Lọc
     * lúc áp thì không đủ: dòng log vẫn mang id bịa và mọi lần replay sau đều
     * phải đọc nó.
     */
    const tao = await taoTran();
    await nopVong(tao.match_id, 1, {
      dao: { tu: '<script>', den: 'khong_co_ma_nay' }, khoa: 'cung_khong_co',
    });
    const row = await pool.query(
      'SELECT action_log FROM holdem_matches WHERE match_id = $1', [tao.match_id]);
    const log = row.rows[0]!.action_log as Record<string, unknown>[];
    expect(log[0]!.dao).toBeUndefined();
    expect(log[0]!.khoa).toBeUndefined();
    expect(JSON.stringify(log)).not.toContain('script');
  });
});

describe('4. 🔴 EVENT — tín hiệu hành vi, append-only nên thiếu là thiếu vĩnh viễn', () => {
  it('đảo + khoá đều đẻ event riêng, kèm bối cảnh môi trường và đối thủ', async () => {
    const tao = await taoTran();
    const lay = tao.shop.tai_san[0] as string;
    await nopVong(tao.match_id, 1, { mua: [lay], khoa: lay });
    const st = await xemTran(tao.match_id);
    const den = maKhac(st.ban.danh_muc.tai_san);
    await nopVong(tao.match_id, 2, { dao: { tu: lay, den } });

    const ev = await pool.query(
      `SELECT action_type, value_json, state_snapshot_json
         FROM events
        WHERE context_id = $1 AND action_type IN ('hd_dao_danh_muc','hd_khoa_tai_san')
        ORDER BY ts`, [tao.match_id]);
    expect(ev.rows.map((r) => r.action_type))
      .toEqual(['hd_khoa_tai_san', 'hd_dao_danh_muc']);

    const khoaEv = ev.rows[0]!;
    expect(khoaEv.value_json.ma).toBe(lay);
    expect(khoaEv.value_json.ok).toBe(true);
    const daoEv = ev.rows[1]!;
    expect(daoEv.value_json).toMatchObject({ vong: 2, tu: lay, den, ok: true });

    for (const r of ev.rows) {
      const snap = r.state_snapshot_json;
      // D25/R1 — bối cảnh đối thủ bắt buộc từ dòng đầu, không backfill được.
      expect(typeof snap.so_nguoi_song).toBe('number');
      expect(typeof snap.fx_ban).toBe('string');
      // Bối cảnh môi trường lúc quyết định chi tiền.
      expect(snap.o_kind).toBeTruthy();
      // A7 — snapshot phải GỌN (~300 byte). Dump cả danh mục là vỡ mục tiêu này.
      expect(JSON.stringify(snap).length).toBeLessThan(320);
      /*
       * KHÔNG được biết thứ người chơi chưa được biết: cờ tin giả chỉ lộ sau khi
       * ô đã qua. Event điều kiện hoá trên thông tin chưa lộ là làm bẩn chính bộ
       * dữ liệu mà A1 định bán.
       */
      expect(JSON.stringify(snap)).not.toContain('la_tin_gia');
    }
  });

  it('lệnh BỊ TỪ CHỐI vẫn ghi event — ý định cũng là dữ liệu', async () => {
    const tao = await taoTran();
    await nopVong(tao.match_id, 1, { khoa: maKhac(CHUA_CAM_GI) });
    const ev = await pool.query(
      `SELECT value_json FROM events
        WHERE context_id = $1 AND action_type = 'hd_khoa_tai_san'`, [tao.match_id]);
    expect(ev.rowCount).toBe(1);
    expect(ev.rows[0]!.value_json.ok).toBe(false);
    expect(ev.rows[0]!.value_json.loi).toBe('khong_nam_ma');
  });
});
