/**
 * ĐẶC QUYỀN (D33/D34) — TẦNG API, qua HTTP, DB thật, đúng đường code production.
 *
 * `holdem_dac_quyen.test.ts` đã khoá phần LÕI (hàm thuần + dây chuyền chấm
 * điểm). File này chỉ hỏi những câu mà lõi KHÔNG trả lời được, và tất cả đều là
 * chỗ tính năng chết trong im lặng:
 *
 *   1. CÓ ĐƯỜNG CHẠY NÀO GỌI TỚI KHÔNG (bẫy 1 — đã dính 6 lần). Trần thẻ mỗi
 *      vòng nằm trong `replay()`, thứ không export ra được; đo qua endpoint là
 *      cách DUY NHẤT biết nó có chạy.
 *   2. SERVER CÓ CẤP ĐỦ CỜ CHO UI KHÔNG. D25/R1: field nào log là "đã cho thấy"
 *      thì phải render vô điều kiện — mà UI không render được thứ payload không
 *      có. Thiếu ở đây thì nút hoặc mất, hoặc sáng mà bấm không tác dụng.
 *   3. BẢNG GIÁ CÓ ĐÚNG MỘT NGUỒN KHÔNG. Ba hạng 80/100/110 là ba con số dễ chép
 *      nhầm, và chép nhầm ở đây nghĩa là màn hình niêm yết một đằng, Vốn bị trừ
 *      một nẻo.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import {
  BANG_DIEN_TU, SO_THE_CHIEN_THUAT, giaMoBang, vongChonChienThuat,
} from '../config/holdem.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-secret-dq', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function json(path: string, init: RequestInit = {}): Promise<any> {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json', cookie: user.cookie,
      ...(init.headers ?? {}),
    },
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
const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}) =>
  json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, ...them,
    }),
  });

describe('1. 🔴 TRẦN THẺ MỖI VÒNG CÓ CHẠY THẬT KHÔNG (đo qua endpoint)', () => {
  it('gửi 2 lá TÀI SẢN trong một vòng mà không có đặc quyền ⇒ chỉ 1 lá vào', async () => {
    /*
     * ⚠ ĐÂY LÀ CÁI "1" MÀ ĐA DẠNG HOÁ NỚI RA. Trước D33 nó KHÔNG tồn tại: replay
     * mua hết mọi phần tử của `mua`, trần duy nhất là `length ≤ 2` ở tầng nhận —
     * một con số đếm TỔNG. Nên test này vừa khoá luật mới vừa là bằng chứng cho
     * chính lời hứa "2 thay vì 1".
     */
    const tao = await taoTran();
    const hai = (tao.shop.tai_san as string[]).slice(0, 2);
    expect(hai).toHaveLength(2);
    const sau = await nopVong(tao.match_id, 1, { mua: hai });
    expect(sau.error).toBeUndefined();
    expect(new Set(sau.ban.danh_muc.tai_san as string[]).size).toBe(1);
  });

  it('tầng nhận vẫn nới rộng hơn trần thật — không chặn nhầm lệnh hợp lệ', async () => {
    // 3 lá (2 tài sản + 1 chiến thuật) là trần THÔ; quá số đó mới bị từ chối.
    const tao = await taoTran();
    const qua = [...(tao.shop.tai_san as string[]), ...(tao.shop.chien_thuat as string[])];
    const r = await nopVong(tao.match_id, 1, { mua: qua });
    expect(r.error).toBe('mua_qua_nhieu');
  });
});

describe('2. CỜ ĐẶC QUYỀN — server suy, client chỉ vẽ (C4 + D25/R1)', () => {
  it('trạng thái trận cấp đủ cờ để UI khỏi tự suy lại thứ gì', async () => {
    const tao = await taoTran();
    const st = await xemTran(tao.match_id);
    const b = st.ban;

    expect(b.dac_quyen, 'trận MỚI luôn mang balance_version hiện hành').toBe(true);
    // D34 — All-in khoá cho tới khi chốt đủ 3 thẻ chiến thuật.
    expect(b.all_in_mo).toBe(false);
    expect(b.con_thieu_the).toBe(SO_THE_CHIEN_THUAT);
    // Chưa cầm Đa Dạng Hoá ⇒ đúng 1 lá tài sản mỗi vòng.
    expect(b.toi_da_tai_san_vong).toBe(1);
    // Chưa cầm Phòng Hộ ⇒ không đặt short được, và không có lệnh treo nào.
    expect(b.short_duoc).toBe(false);
    expect(b.short).toBeNull();
    expect(b.short_khop).toBeNull();
    expect(b.the_dac_quyen).toEqual([]);

    // Nhịp phải là nhịp của MAP THẬT, không phải bảng hằng của catalog.
    expect(b.nhip_chon_bai).toHaveLength(st.tong_vong);
    const vongCT = b.nhip_chon_bai
      .map((x: string, i: number) => (x === 'chien_thuat' ? i + 1 : 0))
      .filter(Boolean);
    expect(vongCT).toEqual(vongChonChienThuat(st.tong_vong));
  });
});

describe('3. BA HẠNG GIÁ BẢNG ĐIỆN TỬ — một nguồn chân lý', () => {
  it('ghế không cầm Lướt Sóng: giá cơ bản = giá thường, nấc dự báo KHÔNG tồn tại', async () => {
    const tao = await taoTran();
    const st = await xemTran(tao.match_id);
    expect(st.ban.gia_bang.co_ban).toBe(BANG_DIEN_TU.PHI_MO);
    expect(st.ban.gia_bang.du_bao, 'không có thẻ thì không được chào nấc +30')
      .toBeNull();
  });

  it('mở bảng: thu ĐÚNG giá của hạng, và bảng không kèm dự báo', async () => {
    const tao = await taoTran();
    const truoc = await xemTran(tao.match_id);
    const bang = await json(`/api/v1/holdem/matches/${tao.match_id}/bang-dien-tu`, {
      method: 'POST', body: JSON.stringify({ vong: 1, du_bao: true }),
    });
    // Khai `du_bao: true` mà không cầm thẻ ⇒ server PHỚT LỜ, không thu thêm.
    expect(bang.du_bao ?? null).toBeNull();
    expect(bang.sach).toBe(false);
    expect(bang.phi).toBe(giaMoBang(false, false));

    const sau = await xemTran(tao.match_id);
    expect(truoc.ban.von - sau.ban.von).toBe(giaMoBang(false, false));
  });

  it('catalog niêm yết đủ ba hạng — client không gõ tay con số nào', async () => {
    const c = await json('/api/v1/holdem/catalog');
    expect(c.gia_bang.thuong).toBe(giaMoBang(false, false));
    expect(c.gia_bang.luot_song).toBe(giaMoBang(true, false));
    expect(c.gia_bang.luot_song_du_bao).toBe(giaMoBang(true, true));
    // Nấc dự báo ĐẮT HƠN hạng thường — có chủ ý (D33), đừng "sửa cho rẻ".
    expect(c.gia_bang.luot_song_du_bao).toBeGreaterThan(c.gia_bang.thuong);
    expect(c.dac_quyen).toBeTruthy();
    expect(c.so_the_chien_thuat).toBe(SO_THE_CHIEN_THUAT);
  });
});
