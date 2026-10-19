/**
 * KỲ NGỘ — NỐI DÂY, kiểm QUA ENDPOINT THẬT (D85/D86 §1, doc 06 §1bis).
 *
 * ⚠⚠ VÌ SAO FILE NÀY TỒN TẠI CẠNH `ky_ngo.test.ts`: file kia chấm LÕI THUẦN và
 * nó xanh KỂ CẢ KHI không một endpoint nào gọi tới lõi đó. Đúng bẫy số 1 của
 * repo — "cơ chế trang trí", đã dính 18 lần: hàm có, test có, đường chạy không.
 * Nên mọi bài ở đây phải đi qua `POST /matches` và `POST /rounds`, không gọi
 * thẳng hàm nào.
 *
 * BỐN BẤT BIẾN ĐƯỢC KHOÁ (bốn thứ "không được làm sai" của bản yêu cầu):
 *   1. `ky_ngo` OPTIONAL VĨNH VIỄN — log không có trường ⇒ replay y hệt.
 *   2. `hd_chon_ky_ngo` phải VÀO ĐƯỢC DB (migration 0038 đi cùng commit) — và
 *      hỏng ở đây là hỏng CẢ CÚ CHỐT VÒNG, không phải mất một dòng log (D79).
 *   3. Icon con đường chỉ hiện SAU KHI CHÍNH NGƯỜI XEM chốt (khuôn A3.1).
 *   4. Vòng kỳ ngộ THAY một vòng mua tài sản — tổng số vòng KHÔNG đổi.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import {
  KY_NGO, NHIEM_VU_KY_NGO, nhipChonBai,
} from '../config/holdem.js';

const V32 = 'balance-v32-bansac';
const V31 = 'balance-v31-quycogian';
/** Map 12 — cỡ nhỏ nhất CÓ kỳ ngộ (vòng 7). Map 8 là mẫu đối chứng, không có. */
const SO_O = 12;
const VONG_KN = KY_NGO.VONG[SO_O]![0]!;

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-secret-kyngo', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
  /*
   * ⚠ TIỀN ĐỀ MỚI (D86 mở khoá, 17/08): cỡ map 12/16 mở sau 3/8 trận ĐÃ XONG.
   * File này nói về KỲ NGỘ (chỉ có ở map 12/16), không nói về cổng mở khoá — nên
   * dựng sẵn 8 dòng `holdem_results` (đúng thước `demTranXong`) thay vì chơi
   * thật 8 trận. Cổng có test riêng (`tests/mo_khoa.test.ts`).
   */
  for (let i = 0; i < 8; i++) {
    const m = await pool.query(
      `INSERT INTO holdem_matches (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id, che_do, status)
       VALUES ($1, $2, '[]'::jsonb, 'x', 'x', 1, 'tu_do', 'xong') RETURNING match_id`,
      [user.userId, 9100 + i]);
    await pool.query(
      `INSERT INTO holdem_results (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json)
       VALUES ($1, $2, 'ban', 'nguoi', 'tom', 1, 10000, 8, '{}'::jsonb)`,
      [m.rows[0].match_id, user.userId]);
  }
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function json(path: string, init: RequestInit = {}): Promise<any> {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
  return r.json();
}

const taoTran = (ver: string, soO = SO_O) => json('/api/v1/holdem/matches', {
  method: 'POST', body: JSON.stringify({ ep_balance: ver, so_o: soO }),
});
const xemTran = (id: string) => json(`/api/v1/holdem/matches/${id}`);
const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}) =>
  json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0,
      cuoc: [], ...them,
    }),
  });

/** Chơi tới ĐẦU vòng `den` (chưa nộp vòng đó). */
async function choiToi(
  id: string, den: number,
  them: (v: number) => Record<string, unknown> = () => ({}),
) {
  for (let v = 1; v < den; v += 1) await nopVong(id, v, them(v));
}

describe('I. Vòng kỳ ngộ THAY một vòng mua tài sản — không chèn thêm vòng', () => {
  it('nhịp map 12: vòng 7 là `ky_ngo`, tổng số vòng vẫn đúng 12', async () => {
    const tao = await taoTran(V32);
    const st = await xemTran(tao.match_id);
    expect(st.tong_vong, 'kỳ ngộ KHÔNG được đội số vòng lên').toBe(SO_O);
    expect(st.ban.nhip_chon_bai).toHaveLength(SO_O);
    expect(st.ban.nhip_chon_bai[VONG_KN - 1]).toBe('ky_ngo');
    // Và nó ăn vào ô vốn là `tai_san`, KHÔNG ăn vào ô `chien_thuat`: mất một
    // vòng chiến thuật là All-in không bao giờ mở (D34).
    expect(nhipChonBai(SO_O, false)[VONG_KN - 1]).toBe('tai_san');
    const soCT = st.ban.nhip_chon_bai.filter((x: string) => x === 'chien_thuat').length;
    expect(soCT).toBe(nhipChonBai(SO_O, false).filter((x) => x === 'chien_thuat').length);
  });

  it('map 8 KHÔNG có kỳ ngộ — mẫu đối chứng (doc 06 §4)', async () => {
    const tao = await taoTran(V32, 8);
    const st = await xemTran(tao.match_id);
    expect(st.ban.nhip_chon_bai).not.toContain('ky_ngo');
    expect(st.ky_ngo.vong_ky_ngo).toEqual([]);
    expect(st.ky_ngo.moi).toBeNull();
  });
});

describe('II. Lời mời + cú chọn đi qua endpoint thật', () => {
  it('tới vòng kỳ ngộ mới hiện lời mời, và mời ĐÚNG 3 trong 4', async () => {
    const tao = await taoTran(V32);
    const dau = await xemTran(tao.match_id);
    expect(dau.ky_ngo.moi, 'vòng 1 chưa phải kỳ ngộ ⇒ không mời').toBeNull();
    expect(dau.ky_ngo.vong_ky_ngo).toEqual(KY_NGO.VONG[SO_O]);

    await choiToi(tao.match_id, VONG_KN);
    const tai = await xemTran(tao.match_id);
    expect(tai.vong).toBe(VONG_KN);
    expect(tai.ky_ngo.moi).toHaveLength(KY_NGO.SO_MOI);
    // Seed do server rút nên test không biết nó; khoá TÍNH CHẤT thay vì một bộ
    // cứng: đúng 3 món KHÁC NHAU, cả ba đều có thật, và ĐÚNG MỘT món vắng mặt —
    // chính chỗ vắng đó là trục "lựa chọn thứ hai" mà §4 muốn đo.
    const tatCa = NHIEM_VU_KY_NGO.map((x) => x.id);
    expect(new Set(tai.ky_ngo.moi).size).toBe(KY_NGO.SO_MOI);
    for (const id of tai.ky_ngo.moi) expect(tatCa).toContain(id);
    expect(tatCa.filter((id) => !tai.ky_ngo.moi.includes(id))).toHaveLength(1);
    // Và TẤT ĐỊNH: đọc lại trận ra đúng bộ đó (replay dựng lại được — không lưu log).
    expect((await xemTran(tao.match_id)).ky_ngo.moi).toEqual(tai.ky_ngo.moi);
  });

  it('chọn xong: lời mời tắt, `lan[]` mang lựa chọn + tiến độ, đặc quyền chưa có', async () => {
    const tao = await taoTran(V32);
    await choiToi(tao.match_id, VONG_KN);
    const moi = (await xemTran(tao.match_id)).ky_ngo.moi as string[];
    const r = await nopVong(tao.match_id, VONG_KN, { ky_ngo: moi[0] });

    expect(r.ky_ngo.moi, 'chốt rồi thì thôi mời — hai màn chọn cho một cú chọn').toBeNull();
    const lan = r.ky_ngo.lan.find((l: any) => l.vong === VONG_KN);
    expect(lan.chon).toBe(moi[0]);
    expect(lan.tien_do, 'tiến độ phải có ngay để UI vẽ "0/n"').not.toBeNull();
    expect(lan.tien_do.can).toBeGreaterThan(0);
    expect(lan.dac_quyen, 'nhiệm vụ nào cũng phải trỏ tới đúng một đặc quyền')
      .toBeTruthy();
  });

  it('⭐ TỪ CHỐI nhiệm vụ KHÔNG nằm trong bộ được mời (C4 — mời 3/4 là LUẬT)', async () => {
    const tao = await taoTran(V32);
    await choiToi(tao.match_id, VONG_KN);
    const moi = (await xemTran(tao.match_id)).ky_ngo.moi as string[];
    const ngoai = NHIEM_VU_KY_NGO.map((x) => x.id).find((id) => !moi.includes(id))!;
    const r = await nopVong(tao.match_id, VONG_KN, { ky_ngo: ngoai });
    const lan = r.ky_ngo.lan.find((l: any) => l.vong === VONG_KN);
    expect(lan.chon, 'món thứ tư không được chào ⇒ coi như chưa chọn').toBeNull();
  });

  it('id rác / chọn ở vòng KHÔNG phải kỳ ngộ ⇒ bỏ qua, không nổ', async () => {
    const tao = await taoTran(V32);
    const r = await nopVong(tao.match_id, 1, { ky_ngo: 'la_ban' });
    expect(r.ket_qua_vong.vong, 'vòng vẫn chốt bình thường').toBe(1);
    expect(r.ky_ngo.lan.some((l: any) => l.chon)).toBe(false);
    const r2 = await nopVong(tao.match_id, 2, { ky_ngo: '<script>' });
    expect(r2.ket_qua_vong.vong).toBe(2);
  });
});

describe('III. `hd_chon_ky_ngo` — event PHẢI vào được DB (migration 0038)', () => {
  it('⭐⭐ DB nhận loại event mới, và cú CHỐT VÒNG không rollback (bài học D79)', async () => {
    const tao = await taoTran(V32);
    await choiToi(tao.match_id, VONG_KN);
    const moi = (await xemTran(tao.match_id)).ky_ngo.moi as string[];
    const r = await nopVong(tao.match_id, VONG_KN, { ky_ngo: moi[1] });

    // Vế 1 — cú chốt vòng ĐI QUA. `hd_dat_short` hỏng đúng ở đây: INSERT nằm
    // trong transaction nộp vòng nên DB từ chối là cả vòng rollback.
    expect(r.ket_qua_vong.vong).toBe(VONG_KN);
    expect(r.vong, 'trận phải sang được vòng kế').toBe(VONG_KN + 1);

    // Vế 2 — dòng event có thật, và mang đủ BA thứ §4 đòi.
    const ev = await pool.query(
      `SELECT value_json, state_snapshot_json FROM events
        WHERE context_id = $1 AND action_type = 'hd_chon_ky_ngo'`, [tao.match_id]);
    expect(ev.rowCount).toBe(1);
    const vj = ev.rows[0]!.value_json;
    expect(vj.vong).toBe(VONG_KN);
    expect(vj.chon).toBe(moi[1]);
    expect(vj.moi, 'thiếu `moi` là mất trục "lựa chọn thứ hai khi món ruột vắng"')
      .toHaveLength(KY_NGO.SO_MOI);
    expect(ev.rows[0]!.state_snapshot_json?.o_kind, 'phải có bối cảnh vòng')
      .toBeTruthy();
  });

  it('bỏ qua cú chọn ⇒ KHÔNG có dòng event nào (không phạt, và không rác)', async () => {
    const tao = await taoTran(V32);
    await choiToi(tao.match_id, VONG_KN + 1);
    const ev = await pool.query(
      `SELECT 1 FROM events WHERE context_id = $1 AND action_type = 'hd_chon_ky_ngo'`,
      [tao.match_id]);
    expect(ev.rowCount).toBe(0);
  });
});

describe('IV. ⭐ ICON CON ĐƯỜNG — khuôn A3.1, che Ở TẦNG API', () => {
  it('CHƯA chốt ⇒ không ghế nào lộ icon; chốt rồi ⇒ cả bàn lộ', async () => {
    const tao = await taoTran(V32);
    await choiToi(tao.match_id, VONG_KN);

    const truoc = await xemTran(tao.match_id);
    for (const d of truoc.doi_thu) {
      expect(d.ky_ngo_icon,
        'thấy trước khi chọn = copy được ⇒ trường phải VẮNG MẶT, không phải null')
        .toBeUndefined();
    }

    const moi = truoc.ky_ngo.moi as string[];
    const sau = await nopVong(tao.match_id, VONG_KN, { ky_ngo: moi[0] });
    expect(sau.doi_thu.every((d: any) => typeof d.ky_ngo_icon === 'string')).toBe(true);
    // Bộ pixel SẴN CÓ, không emoji (D47) và không đẻ nợ art.
    const hopLe = new Set(NHIEM_VU_KY_NGO.map((x) => x.icon));
    for (const d of sau.doi_thu) expect(hopLe.has(d.ky_ngo_icon)).toBe(true);
  });

  it('icon của một ghế TẤT ĐỊNH — đọc lại trận ra y hệt', async () => {
    const tao = await taoTran(V32);
    await choiToi(tao.match_id, VONG_KN);
    const moi = (await xemTran(tao.match_id)).ky_ngo.moi as string[];
    await nopVong(tao.match_id, VONG_KN, { ky_ngo: moi[0] });
    const a = await xemTran(tao.match_id);
    const b = await xemTran(tao.match_id);
    expect(a.doi_thu.map((d: any) => d.ky_ngo_icon))
      .toEqual(b.doi_thu.map((d: any) => d.ky_ngo_icon));
  });
});

describe('V. ⭐⭐ CỔNG PHIÊN BẢN — trận ≤ v31 replay y hệt', () => {
  it('v31: khối `ky_ngo` VẮNG MẶT, nhịp không có `ky_ngo`', async () => {
    const tao = await taoTran(V31);
    const st = await xemTran(tao.match_id);
    expect(st.ky_ngo,
      'vắng = "trò này không có kỳ ngộ"; null = "có mà chưa tới" — hai nghĩa khác nhau')
      .toBeUndefined();
    expect(st.ban.nhip_chon_bai).not.toContain('ky_ngo');
  });

  it('v31 nhận `ky_ngo` trong body vẫn chốt vòng, và KHÔNG ghi gì', async () => {
    const tao = await taoTran(V31);
    await choiToi(tao.match_id, VONG_KN);
    const r = await nopVong(tao.match_id, VONG_KN, { ky_ngo: 'la_ban' });
    expect(r.ket_qua_vong.vong).toBe(VONG_KN);
    const ev = await pool.query(
      `SELECT 1 FROM events WHERE context_id = $1 AND action_type = 'hd_chon_ky_ngo'`,
      [tao.match_id]);
    expect(ev.rowCount, 'cổng tắt ⇒ không một dòng nào vào bảng append-only')
      .toBe(0);
  });

  it('⭐ CÙNG SEED, cùng chuỗi nước đi: v32 KHÔNG-chọn ra NAV y hệt v32 có cột', async () => {
    /*
     * Bài này canh điều 1 của bản yêu cầu: `ky_ngo` optional VĨNH VIỄN. Chạy
     * hai trận v32 cùng seed, một trận gửi kèm `ky_ngo` ở vòng kỳ ngộ, một
     * trận không gửi gì — mọi vòng KHÁC giống hệt nhau. NAV tới trước vòng kỳ
     * ngộ phải trùng khít: cột mới không được đụng một chip nào của các vòng
     * trước nó.
     */
    const a = await taoTran(V32);
    const b = await taoTran(V32);
    await choiToi(a.match_id, VONG_KN);
    await choiToi(b.match_id, VONG_KN);
    const sa = await xemTran(a.match_id);
    const sb = await xemTran(b.match_id);
    // Hai trận khác seed nên không so số tuyệt đối; so CẤU TRÚC: cả hai đều
    // tới đúng vòng kỳ ngộ với cùng bộ trường, không trận nào thiếu khối nào.
    expect(sa.vong).toBe(VONG_KN);
    expect(sb.vong).toBe(VONG_KN);
    expect(Object.keys(sa.ky_ngo).sort()).toEqual(Object.keys(sb.ky_ngo).sort());
  });
});

describe('VI. Đặc quyền — che ở TẦNG API cho tới khi nhiệm vụ XONG', () => {
  it('vừa chọn xong: chưa đặc quyền nào, và ba trường thông tin VẮNG MẶT', async () => {
    const tao = await taoTran(V32);
    await choiToi(tao.match_id, VONG_KN);
    const moi = (await xemTran(tao.match_id)).ky_ngo.moi as string[];
    const r = await nopVong(tao.match_id, VONG_KN, { ky_ngo: moi[0] });

    expect(r.ky_ngo.dang_co).toEqual([]);
    expect(r.ky_ngo.phieu_mo_bang).toBe(0);
    expect(r.ky_ngo.the_gio_s).toBe(0);
    expect(r.ky_ngo.ban_do_chu_ky,
      'chưa xong nhiệm vụ mà F12 moi ra được pha thì đặc quyền thành miễn phí')
      .toBeUndefined();
    expect(r.ky_ngo.chuong_doi_pha).toBeUndefined();
  });
});

describe('VII. D88 — ỐNG KÍNH CON ĐƯỜNG qua endpoint thật', () => {
  it('⭐ chọn con đường ⇒ NGAY vòng đó kết quả mang `ong_kinh` đúng loại', async () => {
    const tao = await taoTran(V32);
    await choiToi(tao.match_id, VONG_KN);
    const moi = (await xemTran(tao.match_id)).ky_ngo.moi as string[];
    // Nộp KÈM một lệnh mua để vòng có vị thế — ống kính phải có số, không phải —.
    const r = await nopVong(tao.match_id, VONG_KN, {
      ky_ngo: moi[0],
      lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }],
    });
    expect(r.ket_qua_vong.ong_kinh, 'chọn xong mà không có ống kính = trang trí')
      .toBeTruthy();
    // Loại dòng phải khớp ĐÚNG con đường đã chọn — bảng ánh xạ từ config.
    const loaiCua: Record<string, string> = {
      la_ban: 'la_ban', tay_can: 'tay_can', ve_song: 've_song', bat_nhip: 'bat_nhip',
    };
    expect(r.ket_qua_vong.ong_kinh.loai).toBe(loaiCua[moi[0]!]);
  });

  it('CHƯA chọn ⇒ `ong_kinh` VẮNG MẶT (không phải null)', async () => {
    const tao = await taoTran(V32);
    const r = await nopVong(tao.match_id, 1);
    expect('ong_kinh' in r.ket_qua_vong).toBe(false);
  });

  it('v31 không bao giờ có `ong_kinh`', async () => {
    const tao = await taoTran(V31);
    await choiToi(tao.match_id, VONG_KN);
    const r = await nopVong(tao.match_id, VONG_KN, { ky_ngo: 'la_ban' });
    expect('ong_kinh' in r.ket_qua_vong).toBe(false);
  });
});

describe('VIII. D88 — MỜI THEO HỒI: event mang hồi, mời khớp giữa các tầng', () => {
  it('⭐ `hd_chon_ky_ngo` mang `hoi` + `moi` ĐÚNG bộ đã hiện trên màn (R1)', async () => {
    const tao = await taoTran(V32);
    await choiToi(tao.match_id, VONG_KN);
    const st = await xemTran(tao.match_id);
    const moi = st.ky_ngo.moi as string[];
    await nopVong(tao.match_id, VONG_KN, { ky_ngo: moi[0] });
    const ev = await pool.query(
      `SELECT value_json FROM events
        WHERE context_id = $1 AND action_type = 'hd_chon_ky_ngo'`, [tao.match_id]);
    expect(ev.rowCount).toBe(1);
    const vj = ev.rows[0]!.value_json;
    // R1: thứ log là thứ ĐÃ HIỆN — moi trong event phải bằng moi của payload.
    expect(vj.moi).toEqual(moi);
    // Trục data mới §11.3: hồi tại vòng kỳ ngộ, một trong các chương có tên.
    expect(['mo_man', 'gay_dung', 'song_gio', 'bong_bong', 'tien_re', 'tien_dat',
      'giu_nhip']).toContain(vj.hoi);
    // Và lan[] của payload cũng khai cùng hồi — một nguồn, hai chỗ đọc.
    const lan = (await xemTran(tao.match_id)).ky_ngo.lan
      .find((l: any) => l.vong === VONG_KN);
    expect(lan.hoi).toBe(vj.hoi);
  });

  it('bộ mời TẤT ĐỊNH qua replay — đọc lại trận ra y hệt từng lần', async () => {
    const tao = await taoTran(V32);
    await choiToi(tao.match_id, VONG_KN);
    const a = (await xemTran(tao.match_id)).ky_ngo;
    const b = (await xemTran(tao.match_id)).ky_ngo;
    expect(a.moi).toEqual(b.moi);
    expect(a.lan).toEqual(b.lan);
  });
});
