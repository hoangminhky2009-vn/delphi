/**
 * ENGINE v10 chặng 3a — API: lệnh giao dịch + payload NAV + Đi Ngược Số Đông.
 *
 * Trận v10b tạo qua `ep_balance` (đường tạm CHỈ sống dưới vitest — A8.9, gỡ khi
 * v10b thành mặc định). Kiểm qua ENDPOINT thật: bẫy số 1 của repo là hàm có mà
 * không đường nào gọi.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { HOLDEM_DECISIONS, HOLDEM_MATCH, luatCua, soOManTap } from '../config/holdem.js';
import { luatChoTran, replay } from '../server/holdem_api.js';
import { xepHang } from '../server/holdem/engine.js';
import { PC, THANG, chamPhongCach, hangCua, khoaTheoThuHang } from '../server/holdem/phong_cach.js';

// D383 — số vòng = SỐ Ô − 1 (bối cảnh mở màn `o[0]` không quyết toán vòng nào).

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;
/**
 * D418 — người ADMIN có cờ tester, CHỈ cho bài cần ép VAI: server nhận `ep_vai` qua `laTester(actor)` (role admin +
 * `la_tester`); người thường gửi thì bị bỏ qua lặng lẽ và vai vẫn bốc thăm theo seed. Tách khỏi `user` để các bài còn
 * lại giữ nguyên điều kiện người chơi thường.
 */
let tester: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-secret-nav', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
  tester = await createTestUser(pool, { role: 'admin' });
  await pool.query(`UPDATE users SET la_tester = true WHERE user_id = $1`, [tester.userId]);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function json(path: string, init: RequestInit = {}, u: TestUser = user): Promise<any> {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: u.cookie, ...(init.headers ?? {}) },
  });
  return r.json();
}

const taoTranNav = () => json('/api/v1/holdem/matches', {
  method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v10b-nav' }),
});
const xemTran = (id: string, u: TestUser = user) => json(`/api/v1/holdem/matches/${id}`, {}, u);
const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}, u: TestUser = user) =>
  json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0,
      cuoc: [], ...them,
    }),
  }, u);

describe('v10b qua endpoint thật', () => {
  /*
   * ⚠⚠ HỢP ĐỒNG ĐỔI 08/09 (D312). Bài này trước đây khoá *"đối thủ CHỈ lộ NAV"*
   * — tức vẫn lộ MỘT con số tiền. Founder 08/09: *"tôi cũng nói là ẩn số tiền
   * chi tiết mà đối thủ đang cầm đi cơ mà?"* ⇒ ghế đối thủ nay không mang một
   * trường tiền nào cả.
   *
   * ⚠ Và bài phải canh CHIỀU CẤM, không chỉ chiều cho phép: `von`/`nav` phải
   * VẮNG trong payload. Che ở UI mà vẫn gửi thì con số nằm nguyên trong tab
   * Network — tức không che gì, và một bài chỉ kiểm giao diện sẽ xanh suốt.
   */
  it('tạo trận → ban có nav/tien_mat/vi_the; đối thủ KHÔNG mang trường tiền nào', async () => {
    const tao = await taoTranNav();
    const st = await xemTran(tao.match_id);
    expect(st.ban.nav).toBe(HOLDEM_MATCH.START_VON);
    expect(st.ban.tien_mat).toBe(HOLDEM_MATCH.START_VON);
    expect(st.ban.vi_the).toEqual({});
    for (const d of st.doi_thu) {
      expect(d.nav, '⭐ NAV đối thủ phải VẮNG khỏi payload (D312)').toBeUndefined();
      expect((d as { von?: number }).von, '⭐ von đối thủ phải VẮNG khỏi payload')
        .toBeUndefined();
      expect(d.tai_san_thay, 'chưa cầm Đi Ngược thì danh mục đối thủ phải ẨN')
        .toBeUndefined();
      // Thứ THAY THẾ: số thẻ vẫn công khai như poker (danh mục cụ thể thì không).
      expect(typeof d.so_the, 'số thẻ vẫn phải hiện').toBe('number');
    }
  });

  it('⭐ (D312 · D337) chưa đủ 4 vòng ⇒ CHƯA có hạng; đủ 4 vòng ⇒ mọi ghế có HẠNG PHONG CÁCH, vẫn không có tiền', async () => {
    /*
     * D337 — founder: mấy vòng đầu *"ko đủ dữ liệu chấm điểm/ đánh giá"* ⇒ thanh của mình
     * và chữ ở dải ghế đều VẮNG cho tới khi đủ `PC.SAN_VONG_TIN_CAY` vòng. Trước D337 bài
     * này khoá "chốt MỘT vòng là có hạng".
     */
    const tao = await taoTranNav();
    for (let v = 1; v <= 3; v += 1) await nopVong(tao.match_id, v, { lenh: [] });
    const som = await xemTran(tao.match_id);
    expect(som.phong_cach, '3 vòng: thanh của mình phải VẮNG').toBeUndefined();
    for (const d of som.doi_thu) {
      expect(d.phong_cach_hang, `3 vòng: ghế ${d.ghe_id} chưa được có chữ`).toBeUndefined();
    }
    await nopVong(tao.match_id, 4, { lenh: [] });
    const st = await xemTran(tao.match_id);
    expect(st.phong_cach?.hang, '4 vòng: thanh của mình phải có hạng').toEqual(expect.any(String));
    const hang: unknown[] = st.doi_thu.map(
      (d: { phong_cach_hang?: string }) => d.phong_cach_hang);
    expect(hang.every((h: unknown) => typeof h === 'string' && h.length > 0),
      'chốt xong bốn vòng thì mọi ghế phải chấm được hạng').toBe(true);
    for (const d of st.doi_thu) {
      expect((d as { von?: number }).von).toBeUndefined();
      expect(d.nav).toBeUndefined();
    }
  });

  it('lệnh mua qua POST /rounds: vị thế vào thật, trượt giá vào Quỹ vòng', async () => {
    const tao = await taoTranNav();
    // Mốc THÔ 25% của 10.000 = 2.500 — chưa cầm Chia Lệnh nên chỉ mốc thô.
    const r = await nopVong(tao.match_id, 1, {
      lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }],
    });
    expect(r.loi_von?.lenh).toBeUndefined();
    // 2000 − floor(2000×120/10000) = 1976, rồi bị định giá vòng 1 cắn tiếp —
    // nên khẳng định KHOẢNG + tồn tại, không khẳng định số cứng sau định giá.
    expect(r.ban.vi_the.btc).toBeGreaterThan(1000);
    expect(r.ban.nav).toBeGreaterThan(0);
    // Quỹ vòng ≥ nền × số ghế (phí trượt của mình + của bot cộng thêm vào).
    const soGhe = r.doi_thu.length + 1;
    expect(r.ket_qua_vong.quy_vong)
      .toBeGreaterThanOrEqual(HOLDEM_MATCH.CAM_KET_NEN * soGhe);
  });

  it('lệnh rác bị lọc Ở TẦNG NHẬN — không lọt vào action_log', async () => {
    const tao = await taoTranNav();
    await nopVong(tao.match_id, 1, {
      lenh: [
        { ma: '<script>', chieu: 'mua', moc_bp: 2500 },
        { ma: 'btc', chieu: 'xxx', moc_bp: 2500 },
        { ma: 'btc', chieu: 'mua', moc_bp: 2500.5 },
        { ma: 'btc', chieu: 'mua', moc_bp: 0 },
      ],
    });
    const st = await xemTran(tao.match_id);
    // Không lệnh nào hợp lệ ⇒ không vị thế nào mở, và replay không nổ.
    expect(st.ban.vi_the).toEqual({});
    expect(st.vong).toBe(2);
  });

  it('MỐC MỊN khi chưa cầm Chia Lệnh → loi_von.lenh = moc_khong_hop_le', async () => {
    /*
     * Đặc quyền founder 28/07: "Chỉ chiến thuật chia lệnh mới cho phép đi vốn
     * cụ thể (các mốc 5-10-15...100)". 5% cấu trúc HỢP LỆ (qua được tầng nhận)
     * nhưng NGỮ NGHĨA sai với ghế không lá — engine phải chặn và NÓI RA.
     */
    const tao = await taoTranNav();
    const r = await nopVong(tao.match_id, 1, {
      lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 500 }],
    });
    expect(r.loi_von?.lenh).toBe('moc_khong_hop_le');
    expect(r.ban.vi_the).toEqual({});
  });

  it('đảo danh mục kiểu cũ trên trận nav → từ chối RÕ (nav_dung_lenh)', async () => {
    const tao = await taoTranNav();
    await nopVong(tao.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] });
    const r = await nopVong(tao.match_id, 2, { dao: { tu: 'btc', den: 'vang' } });
    expect(r.loi_von?.dao).toBe('nav_dung_lenh');
  });

  it('BÁN ALL qua mốc: sạch vị thế thật qua endpoint', async () => {
    const tao = await taoTranNav();
    const r1 = await nopVong(tao.match_id, 1, {
      lenh: [{ ma: 'usd', chieu: 'mua', moc_bp: 2500 }],
    });
    expect(r1.ban.vi_the.usd as number).toBeGreaterThan(0);
    const r2 = await nopVong(tao.match_id, 2, {
      lenh: [{ ma: 'usd', chieu: 'ban', moc_bp: 10000 }],
    });
    expect(r2.loi_von?.lenh).toBeUndefined();
    expect(r2.ban.vi_the.usd).toBeUndefined();
  });

  it('§8.3 chu kỳ tín dụng: trạng thái máy CHẢY VÀO events, kể cả s_exit', async () => {
    // Bẫy "cơ chế trang trí" lần 11 dạy: field tồn tại trong type ≠ field nằm
    // trong DB. Kiểm bằng SELECT thật sau khi chơi qua endpoint thật.
    const tao = await taoTranNav();
    await nopVong(tao.match_id, 1, {
      lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }],
    });
    await nopVong(tao.match_id, 2, {
      lenh: [{ ma: 'btc', chieu: 'ban', moc_bp: 10000 }],
    });

    const chot = await pool.query(
      `SELECT state_snapshot_json AS s FROM events
        WHERE context_id = $1 AND action_type = 'hd_chot_phien'
        ORDER BY event_id`, [tao.match_id]);
    expect(chot.rows.length).toBe(2);
    for (const { s } of chot.rows) {
      // Bước 1: sức căng khoá 0 trên MỌI vòng — số 0 là ground truth, phải ghi.
      expect(s.tension_true_bps).toEqual([0, 0, 0, 0, 0, 0]);
      expect(s.tension_visible).toBe(false);
      expect(s.is_policy_cell).toBe(false);
      expect(['di_ngang', 'tang', 'giam', 'bien_dong', 'phuc_hoi'])
        .toContain(s.market_state);
      expect(s.face_prior_bps).toBeGreaterThan(0);
      expect(s.face_prior_bps).toBeLessThanOrEqual(10000);
      expect(typeof s.run_length).toBe('number');
    }

    const camKet = await pool.query(
      `SELECT value_json AS v FROM events
        WHERE context_id = $1 AND action_type = 'hd_cam_ket'
        ORDER BY event_id`, [tao.match_id]);
    // Vòng 1 mua: lệnh ĐÃ ÁP phải nằm trong event, chưa rời mã nào.
    expect(camKet.rows[0]!.v.lenh).toEqual([{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }]);
    expect(camKet.rows[0]!.v.tension_at_exit_bps).toBeUndefined();
    // Vòng 2 bán sạch: RỜI btc → cột vàng tension_at_exit ghi mức S thật (=0).
    expect(camKet.rows[1]!.v.tension_at_exit_bps).toEqual({ btc: 0 });
  });

  it('v11 lịch chính sách: policy_expected/actual_dir CHẢY VÀO events ở đúng ô 4', async () => {
    const tao = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v11-lich' }),
    });
    for (let v = 1; v <= 3; v += 1) await nopVong(tao.match_id, v);
    // Đường đọc 8.4 ở TRẠNG THÁI vòng 4: lịch công khai + cặp kỳ vọng/thực
    // của đúng ô kỳ họp đang ngửa giữa màn.
    const tt = await xemTran(tao.match_id);
    // Map mặc định của trận API là 8 ô → đúng một kỳ họp tại ô 4 (Q1 founder).
    expect(tt.o_lich).toContain(4);
    expect(tt.o_lich.length).toBeGreaterThanOrEqual(1);
    expect(['tang', 'ha', 'giu']).toContain(tt.chinh_sach?.ky_vong);
    expect(['tang', 'ha', 'giu']).toContain(tt.chinh_sach?.thuc);
    await nopVong(tao.match_id, 4);
    const chot = await pool.query(
      `SELECT state_snapshot_json AS s FROM events
        WHERE context_id = $1 AND action_type = 'hd_chot_phien'
        ORDER BY event_id`, [tao.match_id]);
    expect(chot.rows.length).toBe(4);
    // Ô 1–3: không phải kỳ họp → cặp hướng VẮNG MẶT (vắng = không có, không null).
    for (const { s } of chot.rows.slice(0, 3)) {
      expect(s.is_policy_cell).toBe(false);
      expect('policy_expected_dir' in s).toBe(false);
    }
    const o4 = chot.rows[3]!.s;
    expect(o4.is_policy_cell).toBe(true);
    expect(['tang', 'ha', 'giu']).toContain(o4.policy_expected_dir);
    expect(['tang', 'ha', 'giu']).toContain(o4.policy_actual_dir);
  });

  it('all-in rồi ĐẢO MÃ: bán giải TRƯỚC mua, kể cả khi người chơi bấm mua trước', async () => {
    // Kịch bản founder dính 01/08: all-in BTC → tiền mặt 0 → thêm [MUA usd,
    // BÁN btc] theo thứ tự bấm → mua đứng trước giải ra 0 đồng và cả người
    // lẫn máy kẹt. Broker thật tất toán bán trước để bù tiền mua trong ngày.
    const tao = await taoTranNav();
    const r1 = await nopVong(tao.match_id, 1, {
      lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }],
    });
    expect(r1.ban.vi_the.btc as number).toBeGreaterThan(0);
    const r2 = await nopVong(tao.match_id, 2, {
      lenh: [
        { ma: 'usd', chieu: 'mua', moc_bp: 5000 },
        { ma: 'btc', chieu: 'ban', moc_bp: 10000 },
      ],
    });
    expect(r2.loi_von?.lenh).toBeUndefined();
    expect(r2.ban.vi_the.btc).toBeUndefined();
    // Mua ăn đúng tiền vừa bán về — không còn "không đủ vốn để phân bổ".
    expect(r2.ban.vi_the.usd as number).toBeGreaterThan(0);
  });

  /*
   * ⚠ D418 — "ghế thường" phải là ghế ĐÃ BIẾT không cầm Lướt Sóng, không phải ghế của một trận mặc định. Bài cũ tạo trận
   * mặc định rồi coi ghế người là "thường" (chú thích còn ghi "mặc định v14"). Nhưng từ khi trận mặc định là bàn lớn có
   * VAI bốc thăm theo seed, ghế người trúng ĐỘI LÁI thì `taoTran` ghim sẵn Lướt Sóng vào ô 1 (`loiGhimCua`) ⇒ thấy dải —
   * ĐÚNG LUẬT (lá ghim là lá đang cầm), nhưng bài đọc thành "che hỏng" và đỏ theo bốc thăm (lượt cả bộ gốc 26/09:
   * `expected true to be false`). Nay mọi trận ép vai qua `tester` và khẳng định vai ăn thật; nhánh đội lái — đúng cái
   * nhánh từng làm bài đỏ — thành một vế được canh thay vì một cú xổ số.
   */
  it('bước 5 — BỘ ĐO SỨC CĂNG: chỉ ghế cầm Lướt Sóng thấy dải, che ở TẦNG API', async () => {
    const taoVai = async (vai: string, them: Record<string, unknown> = {}) => {
      // D525 — đội lái cầm sẵn Lướt Sóng là LÕI GHIM của khoá ≤ v56 (v57+ ghim trait) ⇒ ghim v56 đích danh.
      const t = await json('/api/v1/holdem/matches', {
        method: 'POST', body: JSON.stringify({ ep_vai: vai, ep_balance: 'balance-v56-congdon', ...them }),
      }, tester);
      expect(t.match_id, JSON.stringify(t).slice(0, 200)).toBeTypeOf('string');
      const st = await xemTran(t.match_id, tester);
      expect(st.ban.vai, 'ep_vai bị bỏ qua — người tạo trận phải là admin + la_tester').toBe(vai);
      return { id: t.match_id as string, st };
    };

    // Ghế thường (CÁ NHÂN — không lõi ghim, chưa lấy lá): field VẮNG MẶT — F12 không moi ra được.
    const thuong = await taoVai('ca_nhan');
    expect(thuong.st.ban.danh_muc.chien_thuat, 'tiền đề: ghế thường không được cầm Lướt Sóng')
      .not.toContain('luot_song');
    expect('suc_cang_dai' in thuong.st).toBe(false);

    // Ghế cầm Lướt Sóng (ép qua đường vitest — shop bày ngẫu nhiên): thấy
    // đúng 6 mã, mỗi mã một DẢI 0/1/2 — không một con số bp nào lộ.
    const co = await taoVai('ca_nhan', { ep_chien_thuat: ['luot_song'] });
    expect(Object.keys(co.st.suc_cang_dai)).toHaveLength(6);
    for (const dai of Object.values(co.st.suc_cang_dai)) {
      expect([0, 1, 2]).toContain(dai);
    }

    // ĐỘI LÁI: Lướt Sóng là lá GHIM của vai, không phải lá lấy ở quầy — vẫn là lá đang cầm, nên vẫn thấy dải.
    const doiLai = await taoVai('doi_lai');
    expect(doiLai.st.ban.danh_muc.chien_thuat, 'tiền đề: đội lái cầm sẵn Lướt Sóng ghim').toContain('luot_song');
    expect(Object.keys(doiLai.st.suc_cang_dai ?? {}), 'đội lái cầm Lướt Sóng mà không thấy dải').toHaveLength(6);

    // Cờ hiển thị vào events (chống confound thứ tư): hai quần thể tách được.
    await nopVong(co.id, 1, {}, tester);
    const ev = await pool.query(
      `SELECT state_snapshot_json AS s FROM events
        WHERE context_id = $1 AND action_type = 'hd_chot_phien'`, [co.id]);
    expect(ev.rows[0]!.s.tension_visible).toBe(true);
    expect(ev.rows[0]!.s.tension_band_shown).toHaveLength(6);
    await nopVong(thuong.id, 1, {}, tester);
    const ev2 = await pool.query(
      `SELECT state_snapshot_json AS s FROM events
        WHERE context_id = $1 AND action_type = 'hd_chot_phien'`, [thuong.id]);
    expect(ev2.rows[0]!.s.tension_visible).toBe(false);
    expect(ev2.rows[0]!.s.tension_band_shown).toBeNull();
  });

  it('v17 — mở KHỐNG qua endpoint: cần lá ban_khong, sổ khống về payload', async () => {
    const co = await json('/api/v1/holdem/matches', {
      method: 'POST',
      body: JSON.stringify({
        ep_balance: 'balance-v17-khong', ep_chien_thuat: ['ban_khong'],
      }),
    });
    const r = await nopVong(co.match_id, 1, {
      lenh: [{ ma: 'btc', chieu: 'khong', moc_bp: 2500 }],
    });
    expect(r.loi_von?.lenh).toBeUndefined();
    expect(r.ban.vi_the_khong.btc as number).toBeGreaterThan(0);
    expect(r.ban.co_ban_khong).toBe(true);
    // Sổ khống KHÔNG lộ sang đối thủ — chỉ NAV.
    for (const d of r.doi_thu) expect(d.vi_the_khong).toBeUndefined();

    // Ghế KHÔNG cầm lá: mở khống bị chặn NÓI RA.
    const thuong = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v17-khong' }),
    });
    const r2 = await nopVong(thuong.match_id, 1, {
      lenh: [{ ma: 'btc', chieu: 'khong', moc_bp: 2500 }],
    });
    expect(r2.loi_von?.lenh).toBe('can_la_ban_khong');
    expect(r2.ban.co_ban_khong).toBe(false);
  });

  it('founder 02/08 — MÀN TẬP: seed ghim nên hai bàn tập GIỐNG HỆT nhau, luôn MAN_TAP_SO_O ô (D300: 12, có vai; nhịp + lõi theo luật ghim)', async () => {
    const a = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ tap: true }),
    });
    const b = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ tap: true }),
    });
    /*
     * Số vòng theo LUẬT CỦA BÀN TẬP, không gõ tay: luật có ô úp (v53) dành lá cuối để quyết toán nên
     * 12 ô = 11 vòng (D382/D383); D392 ghim bàn tập về v52 (không ô úp) nên 12 ô = 12 vòng. Ghim TÍNH CHẤT
     * chứ không ghim con số — đổi luật ghim của bàn tập thì bài tự theo, không đỏ oan.
     */
    // D527 — cỡ bàn tập theo luật ghim (`soOManTap`: nhịp xen kẽ 6 ô, khoá cũ 12 ô).
    const soVongTap = soOManTap(luatCua(HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION))
      - (luatCua(HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION).oUp ? 1 : 0);
    expect(a.tong_vong).toBe(soVongTap);
    expect(b.tong_vong).toBe(soVongTap);
    // Cùng seed ghim ⇒ ô mở màn + dàn đối thủ giống hệt — điều kiện để lời
    // coach ở client nói đúng thứ người chơi đang thấy.
    expect(a.o_hien_tai).toEqual(b.o_hien_tai);
    expect(a.doi_thu.map((d: { ten: string }) => d.ten))
      .toEqual(b.doi_thu.map((d: { ten: string }) => d.ten));
    // D300 — bàn tập 12 ô phải DẠY được vai: người chơi bốc CÁ NHÂN, bàn có đủ ba vai đặc biệt.
    expect(a.ban.vai).toBe('ca_nhan');
    // D542 — vai từng ghế giấu (khoá ≥ v59); đủ ba vai đọc qua `dem_vai`.
    for (const v of ['ca_map', 'to_chuc', 'doi_lai']) expect(a.dem_vai?.[v], `thiếu vai ${v}`).toBeGreaterThan(0);
    /*
     * D433 — nhịp chọn bài + bộ lõi ghim theo LUẬT GHIM của bàn tập (tính chất, không chuỗi): v52 có kỳ ngộ vòng 7 và
     * bảng lõi nhịp giãn; v54 tắt kỳ ngộ và dùng bảng lõi gọn (`MAN_TAP_LOI_GON`, năm lõi bị động đã rời kệ).
     */
    const luatTap = luatCua(HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION);
    expect(a.ban.nhip_chon_bai.includes('ky_ngo')).toBe(luatTap.kyNgo);

    // Bộ LÕI GHIM (founder: "cố định để hướng dẫn, không ngẫu nhiên"):
    // nộp vòng 1 → shop vòng lõi V2 phải là đúng bộ trong bảng ghim của luật ấy.
    // D527 — nhịp xen kẽ: lượt lõi duy nhất ở vòng 1, quầy ghim `MAN_TAP_LOI_XEN_KE[1]`, đọc ngay lúc tạo bàn.
    if (luatTap.nhipXenKe) {
      expect(a.shop.chien_thuat).toEqual([...HOLDEM_DECISIONS.MAN_TAP_LOI_XEN_KE[1]!]);
    } else {
      const bangGhim = luatTap.loiGon ? HOLDEM_DECISIONS.MAN_TAP_LOI_GON
        : luatTap.gianLaMapNgan ? HOLDEM_DECISIONS.MAN_TAP_LOI_GIAN : HOLDEM_DECISIONS.MAN_TAP_LOI;
      const r = await nopVong(a.match_id, 1);
      expect(r.shop.chien_thuat).toEqual([...bangGhim[2]!]);
    }
  });

  it('founder 02/08 — MÀN TẬP: đồng hồ TẠM DỪNG mấy vòng đầu, trận thường vẫn chạy giờ', async () => {
    /*
     * D527 — ghim bàn tập v54 (12 ô = 11 vòng): ngưỡng miễn giờ (9) chỉ còn "nửa sau có giờ" ở bàn dài. Bàn tập nhịp xen kẽ chỉ 5 vòng
     * ⇒ cả bàn miễn giờ (áp lực nằm ở màn lõi 34 s) — bài `ban_tap_xen_ke` đi hết bàn ấy.
     */
    const tap = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ tap: true, ep_balance: 'balance-v54-ngare' }),
    });
    expect(tap.dong_ho.tam_dung).toBe(true);
    expect(tap.dong_ho.het_gio).toBe(false);
    // Qua ngưỡng miễn giờ thì đồng hồ chạy lại — nửa sau bàn tập vẫn có áp lực.
    let st = tap;
    for (let v = 1; v <= HOLDEM_DECISIONS.MAN_TAP_MIEN_GIO_DEN_VONG; v += 1) {
      st = await nopVong(tap.match_id, v);
    }
    expect(st.dong_ho.tam_dung).toBeUndefined();

    // Trận thường KHÔNG bao giờ được miễn giờ.
    const thuong = await taoTranNav();
    expect(thuong.dong_ho.tam_dung).toBeUndefined();
  });

  it('founder 02/08 — CHỌN CỠ MAP: so_o lưu vào trận, replay đọc lại; số lạ về mặc định', async () => {
    /*
     * ⚠ TIỀN ĐỀ MỚI (D86 mở khoá, 17/08): cỡ 16 ô mở sau 8 trận ĐÃ XONG. Ghi
     * thẳng `holdem_results` — đúng thước `demTranXong`, và bài này nói về việc
     * LƯU/REPLAY cỡ map chứ không nói về cổng mở khoá (cổng có test riêng).
     */
    for (let i = 0; i < 8; i++) {
      const m = await pool.query(
        `INSERT INTO holdem_matches (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id, che_do, status)
         VALUES ($1, $2, '[]'::jsonb, 'x', 'x', 1, 'tu_do', 'xong') RETURNING match_id`,
        [user.userId, 7700 + i]);
      await pool.query(
        `INSERT INTO holdem_results (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json)
         VALUES ($1, $2, 'ban', 'nguoi', 'tom', 1, 10000, 8, '{}'::jsonb)`,
        [m.rows[0].match_id, user.userId]);
    }
    // Chọn 16 ô → trận 16 vòng, và GET sau đó (replay từ DB) vẫn 16.
    // D525 — khoá mặc định v58 ghim bàn 8 ⇒ ghim v56 (chỉ bàn 16) cho cửa "chọn 16 ⇒ 16 vòng".
    const dai = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ so_o: 16, ep_balance: 'balance-v56-congdon' }),
    });
    expect(dai.tong_vong).toBe(15);
    const st = await xemTran(dai.match_id);
    expect(st.tong_vong).toBe(15);
    // Nộp vòng 1 chạy bình thường trên map 16 — đường thật, không chỉ tạo.
    const r = await nopVong(dai.match_id, 1, {
      lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }],
    });
    expect(r.loi_von?.lenh).toBeUndefined();
    expect(r.tong_vong).toBe(15);

    // Số lạ (7) → rơi về mặc định như khẩu vị, không chặn vào trận.
    // D406 — ghim v53: từ v54 (`chiBan16`) server bỏ qua `so_o` hẳn (canh ở luoc_bo_v54_api), nên cửa kiểm số lạ
    // chỉ còn đo được trên khoá còn cho chọn cỡ.
    const la = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ so_o: 7, ep_balance: 'balance-v53-upo' }),
    });
    expect(la.tong_vong).toBe(HOLDEM_DECISIONS.MAP_SIZE - 1);
  });

  it('founder 02/08 — shop KHÔNG bày lá chết: đủ 3 bản thì biến mất, ô kín thì chỉ còn lá nâng cấp được', async () => {
    // 3 bản don_bay = kịch trần MAX_BAN_SAO → mua() chắc chắn từ chối → không được bày.
    const max3 = await json('/api/v1/holdem/matches', {
      method: 'POST',
      body: JSON.stringify({
        ep_balance: 'balance-v18-hequa',
        ep_chien_thuat: ['don_bay', 'don_bay', 'don_bay'],
      }),
    });
    const st1 = await xemTran(max3.match_id);
    expect(st1.shop.chien_thuat).not.toContain('don_bay');

    // Ô chiến thuật KÍN (3 lá khác nhau) → lá mới không vào được, chỉ lá đang
    // cầm (nâng cấp) mới được phép còn trên quầy.
    const kin = await json('/api/v1/holdem/matches', {
      method: 'POST',
      body: JSON.stringify({
        ep_balance: 'balance-v18-hequa',
        ep_chien_thuat: ['luot_song', 'chan_lo', 'di_nguoc'],
      }),
    });
    const st2 = await xemTran(kin.match_id);
    for (const id of st2.shop.chien_thuat as string[]) {
      expect(['luot_song', 'chan_lo', 'di_nguoc']).toContain(id);
    }
  });

  it('founder 02/08 — fx đo trên NAV: all-in mua mã KHÔNG bị báo "sắp cháy"', async () => {
    const tao = await taoTranNav();
    // Dồn toàn bộ tiền mặt vào một mã: tiền mặt ≈ 0 nhưng NAV gần nguyên vẹn.
    const r = await nopVong(tao.match_id, 1, {
      lenh: [{ ma: 'usd', chieu: 'mua', moc_bp: 10000 }],
    });
    expect(r.loi_von?.lenh).toBeUndefined();
    expect(r.ban.nav).toBeGreaterThan(5000);
    // Thước cũ (tiền mặt/START_VON) sẽ ra 'nguy_kich' ở đây — đúng ảnh founder
    // chụp. Thước NAV thì không: mất tiền mặt ≠ mất tài sản.
    expect(r.ban.fx).not.toBe('nguy_kich');
    for (const d of r.doi_thu) {
      if (d.con_song) expect(d.fx).not.toBe('chay');
    }
  });

  it('founder 02/08 — thẻ ghim ĐỔI ĐÍCH được mỗi vòng qua `gan`, mã không cầm bị lọc', async () => {
    const tao = await json('/api/v1/holdem/matches', {
      method: 'POST',
      body: JSON.stringify({
        ep_balance: 'balance-v18-hequa', ep_chien_thuat: ['don_bay'],
      }),
    });
    // Vòng 1: mua hai mã. Bảng gắn merge TRƯỚC nhịp lệnh nên gắn ngay vòng
    // mua chưa ăn — UI cũng chỉ bày mã ĐANG cầm, hai tầng khớp nhau.
    const r1 = await nopVong(tao.match_id, 1, {
      lenh: [
        { ma: 'btc', chieu: 'mua', moc_bp: 2500 },
        { ma: 'vang', chieu: 'mua', moc_bp: 2500 },
      ],
    });
    expect(r1.loi_von?.lenh).toBeUndefined();
    // Vòng 2: nhắm Đòn Bẩy vào BTC.
    const r2 = await nopVong(tao.match_id, 2, { gan: { don_bay: 'btc' } });
    expect(r2.ban.danh_muc.gan?.don_bay).toBe('btc');
    // Vòng 3: đổi đích sang VÀNG — "gán được đúng 1 lần" phải chết ở đây.
    const r3 = await nopVong(tao.match_id, 3, { gan: { don_bay: 'vang' } });
    expect(r3.ban.danh_muc.gan?.don_bay).toBe('vang');
    // Vòng 4: nhắm mã KHÔNG cầm → server lọc, đích giữ nguyên.
    const r4 = await nopVong(tao.match_id, 4, { gan: { don_bay: 'usd' } });
    expect(r4.ban.danh_muc.gan?.don_bay).toBe('vang');
  });

  it('trận GHIM v10a (di sản): lenh bị lờ, không trường nav nào xuất hiện', async () => {
    // Mặc định nay là v10b — đối chứng phi-nav phải ghim version cũ tường minh.
    const tao = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v10a-tatcuoc' }),
    });
    const r = await nopVong(tao.match_id, 1, {
      lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }],
    });
    expect(r.ban.nav).toBeUndefined();
    expect(r.ban.vi_the).toBeUndefined();
    expect(r.loi_von?.lenh).toBeUndefined();
  });
});

/**
 * D337 — ⭐⭐ HẠNG PHONG CÁCH KHOÁ THEO THỨ HẠNG, ĐI ĐƯỜNG CHÍNH QUA API THẬT.
 *
 * Founder soi bàn tập 15/09: ghế đứng thứ hạng 7/8 (NAV −15%) mà thanh phong
 * cách chấm A+, trong khi ghế NHẤT bàn chỉ A-. Bài này không dựng lại engine —
 * nó CHỐT VÒNG QUA ĐÚNG `POST /rounds`, đọc lại state qua ĐÚNG `GET /matches/:id`
 * (như người chơi thật), rồi kiểm dãy hạng trả ra không tăng theo thứ hạng.
 *
 * ⚠ Seed CỐ ĐỊNH qua `ep_seed`/`ep_so_ghe` (đòi tài khoản TESTER — role=admin +
 * `la_tester`, cách DUY NHẤT hợp lệ là UPDATE tay, xem `tests/tester_mode.test.ts`
 * mục VII) để bài tái lập được: seed=1, 8 ghế, 6 vòng ngồi im (`giu_vi_the`) dưới
 * `balance-v10b-nav` — dò bằng script rời (không còn trong repo) và Log lại ở
 * đây: điểm phong cách GỐC (chưa khoá) của seed này CÓ cặp ngược thật (xem bài
 * "bằng chứng không rỗng" bên dưới) — không phải mọi seed đều tự nhiên có.
 */
describe('D337 — hạng phong cách khoá theo thứ hạng, qua API thật', () => {
  const EP_SEED = 1;
  const SO_GHE = 8;
  const SO_VONG = 6;

  async function taoTester(): Promise<TestUser> {
    const t = await createTestUser(pool, { role: 'admin' });
    await moCuaAdmin(pool, t);
    await pool.query(`UPDATE users SET la_tester = true WHERE user_id = $1`, [t.userId]);
    return t;
  }
  async function jsonCookie(cookie: string, path: string, init: RequestInit = {}): Promise<any> {
    const r = await app.request(`http://localhost${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) },
    });
    return r.json();
  }
  /** Bàn seed=1/8 ghế/v10b: điểm GỐC không đơn điệu theo thứ hạng ở vòng 6 (dò tay). */
  async function chotBanSeed1(cookie: string) {
    const tao = await jsonCookie(cookie, '/api/v1/holdem/matches', {
      method: 'POST',
      body: JSON.stringify({ ep_balance: 'balance-v10b-nav', ep_seed: EP_SEED, ep_so_ghe: SO_GHE }),
    });
    for (let vong = 1; vong <= SO_VONG; vong += 1) {
      await jsonCookie(cookie, `/api/v1/holdem/matches/${tao.match_id}/rounds`, {
        method: 'POST',
        body: JSON.stringify({
          vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [],
        }),
      });
    }
    return tao.match_id as string;
  }
  const chiSoThang = (hang: string) => THANG.findIndex((x) => x.hang === hang);

  it('⭐ dãy hạng SAU KHOÁ, đọc qua GET /matches/:id thật, KHÔNG TĂNG theo thứ hạng sống', async () => {
    const t = await taoTester();
    const matchId = await chotBanSeed1(t.cookie);
    const st = await jsonCookie(t.cookie, `/api/v1/holdem/matches/${matchId}`);
    expect(st.phong_cach?.hang, 'ghế mình phải có hạng sau 6 vòng').toEqual(expect.any(String));

    /*
     * Thứ hạng SỐNG — đọc lại state qua chính `holdem_matches` + `replay()` +
     * `xepHang()` (KHÔNG suy đoán thứ tự từ mảng `doi_thu`, vốn theo THỨ TỰ
     * GHẾ chứ không theo thứ hạng — xem `bangDoiThu`).
     */
    const { rows } = await pool.query(
      `SELECT seed, action_log, ghe_json, balance_version, so_o
         FROM holdem_matches WHERE match_id = $1`, [matchId]);
    const row = rows[0]!;
    const luat = luatChoTran(row.balance_version as string, Number(row.seed));
    const rp = replay(
      Number(row.seed), row.action_log, false, row.ghe_json, luat, 0, false, row.so_o);
    const thuTu = xepHang(rp.st);

    const hangTheoGhe = new Map<string, string>();
    hangTheoGhe.set('ban', st.phong_cach.hang);
    for (const d of st.doi_thu as { ghe_id: string; phong_cach_hang?: string }[]) {
      if (d.phong_cach_hang) hangTheoGhe.set(d.ghe_id, d.phong_cach_hang);
    }
    const daySauKhoa = thuTu.map((id) => hangTheoGhe.get(id)).filter(
      (h): h is string => h !== undefined);
    expect(daySauKhoa.length, 'phải chấm được ít nhất vài ghế sau 6 vòng').toBeGreaterThan(4);
    for (let i = 1; i < daySauKhoa.length; i += 1) {
      expect(chiSoThang(daySauKhoa[i]!),
        `vị trí ${i + 1} (${daySauKhoa[i]}) cao hơn vị trí ${i} (${daySauKhoa[i - 1]})`)
        .toBeLessThanOrEqual(chiSoThang(daySauKhoa[i - 1]!));
    }
  });

  it('⭐ TRẬN THẬT khớp ĐÚNG TỪNG CHỮ với phép khoá trên thang CHUẨN — thang bàn tập không được lọt ra', async () => {
    /*
     * Bài "không tăng" ở trên vẫn XANH nếu thang bàn tập (điểm nới đỉnh) lọt vào trận
     * thật — quy điểm giữ thứ tự. Founder chốt *"chỉ trong phần hướng dẫn thôi nhé"*,
     * nên phải khoá bằng giá trị: chữ API trả ra = `hangCua(khoaTheoThuHang(điểm gốc
     * chuẩn))` tính độc lập ở đây.
     */
    const t = await taoTester();
    const matchId = await chotBanSeed1(t.cookie);
    const st = await jsonCookie(t.cookie, `/api/v1/holdem/matches/${matchId}`);
    const { rows } = await pool.query(
      `SELECT seed, action_log, ghe_json, balance_version, so_o
         FROM holdem_matches WHERE match_id = $1`, [matchId]);
    const row = rows[0]!;
    const rp = replay(Number(row.seed), row.action_log, false, row.ghe_json,
      luatChoTran(row.balance_version as string, Number(row.seed)), 0, false, row.so_o);
    const dong = xepHang(rp.st)
      .map((id, i) => ({ id, thu_hang: i + 1, ds: rp.pcTheoGhe.get(id) }))
      .filter((x) => x.ds && x.ds.length > 0);
    const khoa = khoaTheoThuHang(
      dong.map((x) => ({ thu_hang: x.thu_hang, diem: chamPhongCach(x.ds!).diem })), xepHang(rp.st).length);
    const mongDoi = new Map(dong.map((x, i) => [x.id, hangCua(khoa[i]!)]));
    expect(st.phong_cach.hang, 'ghế mình').toBe(mongDoi.get('ban'));
    for (const d of st.doi_thu as { ghe_id: string; phong_cach_hang?: string }[]) {
      expect(d.phong_cach_hang, `ghế ${d.ghe_id}`).toBe(mongDoi.get(d.ghe_id));
    }
  });

  it('⭐ D343 — chưa đủ vòng: `phong_cach_tam_tinh` có TỪ LÚC MỞ TRẬN, chỉ ĐIỂM + CHUỖI, khoá như bản thật; dải ghế vẫn VẮNG chữ', async () => {
    /*
     * Founder 16/09: *"ít nhất bạn phải cho nó hiện ngay từ đầu nhưng màu xám vì chưa quyết
     * định điểm, thanh vẫn chạy/ được chấm bình thường nhưng màu nhạt và điểm là dấu '?'"*.
     * Ba điều khoá ở đây, mỗi điều một cách hỏng thật:
     *  (1) KHÔNG có `hang` trong khối tạm — cửa cứng D337 ở server, client không có chữ để lộ;
     *  (2) điểm tạm = phép khoá TÍNH TAY trên mọi ghế ≥ 1 vòng — "chấm bình thường", và lúc
     *      bật sáng ở vòng đủ tin thanh không giật vì đổi luật tính;
     *  (3) chế độ tạm KHÔNG rò sang dải ghế: `doi_thu[].phong_cach_hang` chảy vào `events`
     *      (`hd_cam_ket`), nên chữ ở đó vẫn phải VẮNG tới vòng đủ tin.
     */
    const t = await taoTester();
    const tao = await jsonCookie(t.cookie, '/api/v1/holdem/matches', {
      method: 'POST',
      body: JSON.stringify({ ep_balance: 'balance-v10b-nav', ep_seed: EP_SEED, ep_so_ghe: SO_GHE }),
    });
    expect(tao.phong_cach, 'mở trận: chưa có hạng').toBeUndefined();
    expect(tao.phong_cach_tam_tinh, 'mở trận: thanh xám RỖNG phải có mặt ngay').toEqual({ diem: 0, streak: 0 });
    expect((await jsonCookie(t.cookie, `/api/v1/holdem/matches/${tao.match_id}`)).phong_cach_tam_tinh)
      .toEqual({ diem: 0, streak: 0 });

    const khoaLech: string[] = [];
    for (let vong = 1; vong < PC.SAN_VONG_TIN_CAY; vong += 1) {
      await jsonCookie(t.cookie, `/api/v1/holdem/matches/${tao.match_id}/rounds`, {
        method: 'POST',
        body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [] }),
      });
      const st = await jsonCookie(t.cookie, `/api/v1/holdem/matches/${tao.match_id}`);
      expect(st.phong_cach, `${vong} vòng: hạng thật vẫn phải VẮNG`).toBeUndefined();
      expect(Object.keys(st.phong_cach_tam_tinh ?? {}).sort(), `${vong} vòng: đúng HAI trường, không hạng`)
        .toEqual(['diem', 'streak']);
      for (const d of st.doi_thu as { ghe_id: string; phong_cach_hang?: string }[]) {
        expect(d.phong_cach_hang, `${vong} vòng: ghế ${d.ghe_id} — chế độ tạm rò sang dải ghế`).toBeUndefined();
      }

      const { rows } = await pool.query(
        `SELECT seed, action_log, ghe_json, balance_version, so_o
           FROM holdem_matches WHERE match_id = $1`, [tao.match_id]);
      const row = rows[0]!;
      const rp = replay(Number(row.seed), row.action_log, false, row.ghe_json,
        luatChoTran(row.balance_version as string, Number(row.seed)), 0, false, row.so_o);
      const dong = xepHang(rp.st)
        .map((id, i) => ({ id, thu_hang: i + 1, ds: rp.pcTheoGhe.get(id) }))
        .filter((x) => x.ds && x.ds.length > 0);
      const khoa = khoaTheoThuHang(
        dong.map((x) => ({ thu_hang: x.thu_hang, diem: chamPhongCach(x.ds!).diem })), xepHang(rp.st).length);
      const i = dong.findIndex((x) => x.id === 'ban');
      const goc = chamPhongCach(dong[i]!.ds!);
      expect(st.phong_cach_tam_tinh, `${vong} vòng: điểm tạm phải là điểm ĐÃ KHOÁ theo thứ hạng`)
        .toEqual({ diem: khoa[i], streak: goc.streak });
      if (khoa[i] !== goc.diem) khoaLech.push(`vòng ${vong}: gốc ${goc.diem} → khoá ${khoa[i]}`);
    }
    /*
     * ⚠ BẰNG CHỨNG KHÔNG RỖNG cho vế (2): nếu phép khoá chưa từng đổi điểm của ghế mình ở
     * đúng seed/log này thì một bản quên khoá cũng xanh. Seed 1 · 8 ghế · ngồi im: có đổi.
     */
    expect(khoaLech.length, 'seed này phải có ít nhất một vòng khoá ĐỔI điểm của mình').toBeGreaterThan(0);

    await jsonCookie(t.cookie, `/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({
        vong: PC.SAN_VONG_TIN_CAY, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [],
      }),
    });
    const du = await jsonCookie(t.cookie, `/api/v1/holdem/matches/${tao.match_id}`);
    expect(du.phong_cach_tam_tinh, 'đủ vòng: khối tạm phải NHƯỜNG chỗ').toBeUndefined();
    expect(du.phong_cach?.hang, 'đủ vòng: hạng thật').toEqual(expect.any(String));
  });

  it('⭐⭐ BẰNG CHỨNG BÀI TRÊN KHÔNG RỖNG: điểm GỐC (chưa khoá) của đúng seed/log này có cặp ngược', async () => {
    // Cùng seed, cùng số vòng, TÀI KHOẢN KHÁC — hai bài độc lập, tránh chung
    // trạng thái match giữa hai `it`.
    const t = await taoTester();
    const matchId = await chotBanSeed1(t.cookie);
    const { rows } = await pool.query(
      `SELECT seed, action_log, ghe_json, balance_version, so_o
         FROM holdem_matches WHERE match_id = $1`, [matchId]);
    const row = rows[0]!;
    const luat = luatChoTran(row.balance_version as string, Number(row.seed));
    const rp = replay(
      Number(row.seed), row.action_log, false, row.ghe_json, luat, 0, false, row.so_o);
    const thuTu = xepHang(rp.st);
    const gocTheoGhe = thuTu.map((id) => {
      const ds = rp.pcTheoGhe.get(id);
      return ds && ds.length > 0 ? chamPhongCach(ds).diem : undefined;
    });

    let capNguoc: { tot: number; xau: number; diemTot: number; diemXau: number } | null = null;
    for (let i = 1; i < gocTheoGhe.length && !capNguoc; i += 1) {
      for (let j = 0; j < i; j += 1) {
        const a = gocTheoGhe[j]; const b = gocTheoGhe[i];
        if (a !== undefined && b !== undefined && b > a) {
          capNguoc = { tot: j + 1, xau: i + 1, diemTot: a, diemXau: b };
          break;
        }
      }
    }
    expect(capNguoc,
      `seed=${EP_SEED} so_ghe=${SO_GHE} vong=${SO_VONG}: điểm gốc không có cặp ngược nào — `
      + 'bài "không tăng" ở trên không thật sự canh gì, phải đổi seed/số vòng.')
      .not.toBeNull();
    // Ghi rõ cặp: thứ hạng TỐT HƠN (số nhỏ hơn) lại có điểm GỐC thấp hơn ghế xếp dưới nó.
    expect(capNguoc!.diemXau, 'ghế xếp DƯỚI phải có điểm gốc CAO hơn ghế xếp trên nó')
      .toBeGreaterThan(capNguoc!.diemTot);
  });
});
