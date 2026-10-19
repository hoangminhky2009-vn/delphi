/**
 * v54 (D389) — LƯỢC BỎ qua API THẬT: lúc tạo trận, khoá có `chiBan16` / `khauViTat` / `loiGon`
 * thì SERVER quyết cỡ bàn · khẩu vị · lõi được ép — client gửi gì cũng không lọt.
 *
 * Người tạo trận ở đây ĐÃ MỞ khẩu vị (3 trận xong), nên nếu cờ tắt khẩu vị hỏng thì
 * `quyet_liet` sẽ lọt qua đúng đường mọi người chơi thật đi. Vế ngược: cùng body dưới v53 thì
 * cỡ 8 và `quyet_liet` phải được giữ nguyên — không thì bài chỉ đang đo một cổng rỗng.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, KHAU_VI, luatCua } from '../config/holdem.js';
import { coBanGhim } from '../config/luoc_bo.js';
import { NGAN_HANG_DO_VO } from '../config/tiet_kiem_kinh_te.js';
import { VAI } from '../server/holdem/vai.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let U: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-lb54', secureCookie: false,
  }) as Hono<any>;
  U = await createTestUser(pool);
  // Mở khoá khẩu vị (3 trận xong — `MO_KHOA.KHAU_VI`).
  for (let i = 0; i < 3; i++) {
    const m = await pool.query(
      `INSERT INTO holdem_matches (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id, che_do, status)
       VALUES ($1, $2, '[]'::jsonb, 'x', 'x', 1, 'tu_do', 'xong') RETURNING match_id`, [U.userId, 5400 + i]);
    await pool.query(
      `INSERT INTO holdem_results (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json)
       VALUES ($1, $2, 'ban', 'nguoi', 'tom', 1, 10000, 8, '{}'::jsonb)`, [m.rows[0].match_id, U.userId]);
  }
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function taoTran(body: Record<string, unknown>) {
  const r = await app.request('http://localhost/api/v1/holdem/matches', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', cookie: U.cookie },
  });
  return { status: r.status, body: await r.json() as any };
}

async function hang(matchId: string) {
  const r = await pool.query(
    'SELECT so_o, balance_version, ghe_json FROM holdem_matches WHERE match_id = $1', [matchId]);
  return r.rows[0] as {
    so_o: number; balance_version: string;
    ghe_json: { id: string; khau_vi?: string; danh_muc?: { chien_thuat: string[] } }[];
  };
}

const BODY = { so_o: 8, khau_vi: 'quyet_liet', ep_chien_thuat: ['da_dang_hoa', 'mua_duoi'] };

describe('Tạo trận dưới v54 — server quyết, không tin client', () => {
  it('v54: bàn 16 dù xin 8 · khẩu vị cân bằng dù xin quyết liệt · lõi đã cắt không ép được', async () => {
    const t = await taoTran({ ...BODY, ep_balance: 'balance-v54-ngare' });
    expect(t.status).toBe(201);
    const h = await hang(t.body.match_id);
    expect(h.balance_version).toBe('balance-v54-ngare');
    expect(h.so_o).toBe(16);
    const ban = h.ghe_json.find((g) => g.id === 'ban')!;
    expect(ban.khau_vi ?? 'can_bang').toBe('can_bang');
    expect(ban.danh_muc?.chien_thuat).toEqual(['mua_duoi']);
  });

  it('vế ngược — v53: cùng body thì cỡ 8 + quyết liệt + Đa Dạng Hoá được giữ', async () => {
    const t = await taoTran({ ...BODY, ep_balance: 'balance-v53-upo' });
    expect(t.status).toBe(201);
    const h = await hang(t.body.match_id);
    expect(h.so_o).toBe(8);
    const ban = h.ghe_json.find((g) => g.id === 'ban')!;
    expect(ban.khau_vi).toBe('quyet_liet');
    expect(ban.danh_muc?.chien_thuat).toEqual(['da_dang_hoa', 'mua_duoi']);
  });

  it('v54: trận tải lại (replay) chạy được, không kỳ ngộ, quỹ vòng vẫn thu nền mọi ghế', async () => {
    const t = await taoTran({ ep_balance: 'balance-v54-ngare' });
    const r = await app.request(`http://localhost/api/v1/holdem/matches/${t.body.match_id}`, {
      headers: { cookie: U.cookie },
    });
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    // Quỹ vòng GIỮ (D389): nền × số ghế đang chơi, như mọi khoá cũ.
    expect(b.quy_vong_hien_tai).toBeGreaterThan(0);
    expect(b.quy_vong_hien_tai % 500).toBe(0);
    expect(b.ky_ngo).toBeUndefined();
  });
});

/*
 * v54 (D395) — THANH KHOẢN CỦA VÒNG qua đường thật: chốt một vòng thì `ket_qua_vong.thanh_khoan_vong`
 * có đủ sáu mã ở thang năm vạch; mã đầu cơ `vach: null` và KHÔNG mang biên độ của Bảng điện tử (biên ấy
 * cố ý lệch 30% — hàng trả phí, không được rò qua cửa miễn phí). Vế ngược: v53 · v45 không có thước.
 */
describe('Thanh khoản của vòng (D395) — thước dải 6 mã', () => {
  async function chotMotVong(luat: string) {
    const t = await taoTran({ ep_balance: luat });
    const id = t.body.match_id as string;
    const r = await app.request(`http://localhost/api/v1/holdem/matches/${id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong: t.body.vong, hanh_dong: 'giu_vi_the' }),
      headers: { 'content-type': 'application/json', cookie: U.cookie },
    });
    expect(r.status).toBe(200);
    return (await r.json() as any).ket_qua_vong as {
      thi_truong_vong?: unknown[];
      thanh_khoan_vong?: { ma: string; tong_vach: number; vach_nen: number; vach: number | null; bien_vach?: unknown }[];
    };
  }

  it('v54: sáu mã · năm vạch · mã đầu cơ sương mù không kèm biên độ', async () => {
    const tk = (await chotMotVong('balance-v54-ngare')).thanh_khoan_vong;
    expect(tk?.map((x) => x.ma).sort()).toEqual(['btc', 'cp_cn', 'tpcp', 'usd', 'vang', 'vn30']);
    for (const x of tk!) {
      expect(x.tong_vach, x.ma).toBe(5);
      expect(x.bien_vach, x.ma).toBeUndefined();
      if (x.ma === 'btc' || x.ma === 'cp_cn') expect(x.vach, x.ma).toBeNull();
      else expect(x.vach, x.ma).toBeGreaterThanOrEqual(1);
    }
    expect(tk!.find((x) => x.ma === 'vn30')!.vach_nen).toBe(4);   // dày = vạch 4/5
  });

  it('vế ngược — v53 (bàn tập · prod tới 0.0.44) và v45 (đề buổi đo): KHÔNG có thước, màn giữ nguyên', async () => {
    /*
     * Thước là kênh thông tin mới ⇒ chỉ trận bật cổng năm nấc. Thêm nó giữa đợt đo là đổi phép đo; và ở thang
     * ba nấc lá CẠN THANH KHOẢN không chạm sổ nào — thước sẽ phơi đúng chỗ lệch D395 sinh ra để sửa.
     */
    for (const luat of ['balance-v53-upo', 'balance-v45-duongcong']) {
      const kqv = await chotMotVong(luat);
      expect(kqv.thi_truong_vong?.length, luat).toBe(6);   // trận NAV thật — chỉ riêng thước vắng (không rỗng)
      expect(kqv.thanh_khoan_vong, luat).toBeUndefined();
    }
  });

  it('cờ trận `thanh_khoan_nam_nac`: v54 có (client giữ chỗ hàng thước từ trước chốt), v53 không', async () => {
    const tt = async (luat: string) => {
      const t = await taoTran({ ep_balance: luat });
      const r = await app.request(`http://localhost/api/v1/holdem/matches/${t.body.match_id}`, {
        headers: { cookie: U.cookie },
      });
      return await r.json() as any;
    };
    expect((await tt('balance-v54-ngare')).thanh_khoan_nam_nac).toBe(true);
    expect((await tt('balance-v53-upo')).thanh_khoan_nam_nac).toBeUndefined();
  });

  /*
   * D406 — lật mặc định sang v54: CATALOG phải nói đúng thứ server dựng. Mời 8/12 ở sảnh mà server lặng lẽ dựng 16 là
   * hứa một thứ không giao; nút khẩu vị mà server bỏ qua cũng vậy. Bài viết theo TÍNH CHẤT của khoá mặc định (lật
   * khoá khác thì vế `else` tự áp) — riêng dòng đầu ghim rằng HÔM NAY mặc định bật cả ba cờ, để bài không xanh rỗng.
   */
  it('⭐ D406 — catalog theo khoá mặc định: một cỡ bàn · cờ tắt khẩu vị (bảng vẫn còn) · số đổ vỡ cho Bách khoa', async () => {
    const luat = luatCua(HOLDEM_BALANCE_VERSION);
    // D525 — khoá mặc định v58: cỡ ghim 8 (`coBanGhim`), khẩu vị tắt, không sổ tiết kiệm (không đổ vỡ). Bài ghim TÍNH CHẤT bên dưới.
    expect(luat.khauViTat, 'khẩu vị tắt ở khoá mặc định').toBe(true);
    const coGhim = coBanGhim(luat);
    const r = await app.request('http://localhost/api/v1/holdem/catalog', { headers: { cookie: U.cookie } });
    expect(r.status).toBe(200);
    const cat = await r.json() as any;
    if (coGhim !== null) {
      expect(cat.quyet_dinh.CO_MAP_CHON).toEqual([coGhim]);
      expect(cat.quyet_dinh.MAP_MAC_DINH_SANH).toBe(coGhim);
    } else {
      expect(cat.quyet_dinh.CO_MAP_CHON).toEqual(HOLDEM_DECISIONS.CO_MAP_CHON);
    }
    // Phần còn lại của quyết định giữ nguyên — ghi đè đúng hai khoá, không nuốt cả bảng.
    expect(cat.quyet_dinh.MAN_TAP_MIEN_GIO_DEN_VONG).toBe(HOLDEM_DECISIONS.MAN_TAP_MIEN_GIO_DEN_VONG);
    expect(cat.khau_vi_tat).toBe(luat.khauViTat ? true : undefined);
    // Bảng khẩu vị KHÔNG bị rút rỗng: Bách khoa và trận cũ vẫn đọc hệ số từ đây.
    expect(cat.khau_vi.map((k: { id: string }) => k.id)).toEqual(KHAU_VI.map((k) => k.id));
    if (luat.nganHangDoVo) {
      expect(cat.ngan_hang_do_vo).toEqual({
        BAO_HIEM_TOI_DA: NGAN_HANG_DO_VO.BAO_HIEM_TOI_DA, MAT_BP: NGAN_HANG_DO_VO.MAT_BP,
        SO_LA_XAU_TRUOC: NGAN_HANG_DO_VO.SO_LA_XAU_TRUOC,
      });
    } else {
      expect(cat.ngan_hang_do_vo).toBeUndefined();
    }
  });

  /*
   * D406 — BẢNG VAI THEO TRẬN. Catalog chỉ nói khoá mặc định; lời chào vai + nút vai ở chợ đọc `vai_bang` của CHÍNH trận.
   * Không có nó thì dưới mặc định v54, bàn tập (v53) hiện Cá Mập "×1" trong khi vốn thật ×3 — và trận v54 hiện tổ chức
   * "Đa Dạng Hoá ghim sẵn" trong khi lá ấy đã rời quầy.
   */
  it('⭐ D406 — vai_bang theo luật của TRẬN: v54 vốn đều + chữ hết hứa lõi đã cắt; v53 giữ ×3 + chữ gốc', async () => {
    const lay = async (body: Record<string, unknown>) => {
      const t = await taoTran(body);
      expect(t.status, JSON.stringify(t.body)).toBe(201);
      const r = await app.request(`http://localhost/api/v1/holdem/matches/${t.body.match_id}`, { headers: { cookie: U.cookie } });
      return await r.json() as any;
    };
    const v54 = await lay({ ep_balance: 'balance-v54-ngare' });
    expect(v54.vai_bang, 'trận v54 bàn 16 có vai ⇒ phải có bảng vai').toBeDefined();
    expect(Object.values(v54.vai_bang as Record<string, { he_so_von: number }>).every((v) => v.he_so_von === 1)).toBe(true);
    expect(v54.vai_bang.to_chuc.dac_quyen).not.toMatch(/Đa Dạng Hoá/);
    expect(v54.vai_bang.ca_nhan.cai_gia).not.toMatch(/vốn/i);

    /*
     * D433 — bàn tập nay chạy luật ghim v54 ⇒ cùng bảng vai với trận v54 (từng là vế đối chứng v53 khi bàn tập còn
     * `khoaBanTap`). Vế đối chứng v53 dựng thẳng bằng `ep_balance` + bàn 12 có vai.
     */
    // D527 — bàn tập ép v54 (bàn tập mặc định nay v58: vốn theo vai).
    const tap = await lay({ tap: true, ep_balance: 'balance-v54-ngare' });
    expect(Object.values(tap.vai_bang as Record<string, { he_so_von: number }>).every((v) => v.he_so_von === 1)).toBe(true);
    const v53 = await lay({ ep_balance: 'balance-v53-upo', so_o: 12 });
    expect(v53.vai_bang.ca_map.he_so_von).toBe(VAI.ca_map.he_so_von);
    expect(v53.vai_bang.to_chuc.dac_quyen).toBe(VAI.to_chuc.dac_quyen);
    expect(v53.vai_bang.ca_nhan.cai_gia).toBe(VAI.ca_nhan.cai_gia);

    // Bàn 8 của v53 là mẫu đối chứng KHÔNG vai ⇒ không có bảng (vắng, không rỗng).
    const tam = await lay({ ep_balance: 'balance-v53-upo', so_o: 8 });
    expect(tam.vai_bang).toBeUndefined();
  });
});
