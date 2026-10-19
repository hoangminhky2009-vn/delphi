/**
 * KẾT QUẢ VÒNG SỐNG QUA CÚ NẠP LẠI TRANG — trả nợ D116 (24/08).
 *
 * D116 tự khai: *"`GET /matches/:id` không phát `ket_qua_vong` ⇒ NẠP LẠI TRANG
 * hoặc vào bằng deep link thì vẫn không có con số và không mở được VÌ SAO"*, và
 * nêu luôn đường sửa đúng: *"serialise `ket_qua_vong` ở GET bằng CHÍNH đoạn dựng
 * của POST — tách thành hàm dùng chung, không chép"*. Nợ nằm đó tới hôm nay, và
 * D127 vừa nối `ky_quy_cua_ban` vào chính cái kênh thủng ấy.
 *
 * Ba thứ được khoá:
 *   §I   POST và GET trả về CÙNG MỘT kết quả vòng — không phải "giống nhau", mà
 *        là cùng một hàm dựng (bản sao thứ hai sẽ trôi — D61);
 *   §II  `nav_truoc` là NAV HEADLINE, KHÔNG phải `nav_truoc` của engine;
 *   §III vòng 1 chưa chốt gì ⇒ trường VẮNG MẶT, không phải `null`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

let db: TestDb;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  app = createApp({
    pool: db.pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-kqv', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(db.pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

const json = async (path: string, init: RequestInit = {}): Promise<any> => {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
  return r.json();
};

// D406 — ghim v53 (bàn 8, KHÔNG vai): dưới v54 bàn nào cũng có vai, ghế người bốc TỔ CHỨC (trần 40%/mã) thì cú mua lớn
// bị từ chối ngẫu nhiên theo seed. Bài này đo cơ chế lệnh, không đo vai — luật vai v54 canh ở luoc_bo_v54_api.
const taoTran = () => json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v53-upo' }) });
const xem = (id: string) => json(`/api/v1/holdem/matches/${id}`);
const nop = (id: string, st: any) => {
  const shop = st.shop ?? {};
  const dm = st.ban?.danh_muc ?? {};
  const muaTS = (dm.tai_san ?? []).length === 0 && (shop.tai_san ?? []).length > 0
    ? [shop.tai_san[0]] : [];
  const ma = (dm.tai_san ?? [])[0] ?? muaTS[0];
  return json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong: st.vong, khao_sat_lai: 0, mua: muaTS, hanh_dong: 'giu_vi_the', them: 0,
      ...(ma ? { lenh: [{ ma, chieu: 'mua', moc_bp: 5000 }] } : {}),
    }),
  });
};

describe('I. POST ≡ GET — cùng một kết quả vòng', () => {
  it('⭐⭐ nạp lại trang vẫn lấy được kết quả vòng vừa chốt, khớp từng trường', async () => {
    const t = await taoTran();
    let st = await xem(t.match_id);
    st = await nop(t.match_id, st);           // chốt vòng 1
    st = await nop(t.match_id, st);           // chốt vòng 2 — có lệnh, có dây chuyền

    const tuPost = st.ket_qua_vong;
    expect(tuPost, 'POST không còn phát kết quả vòng').toBeTruthy();

    // ĐÂY LÀ CÚ F5: hỏi lại bằng GET, không nhờ gì tới response cũ.
    const lai = await xem(t.match_id);
    expect(lai.ket_qua_vong, 'GET vẫn không phát kết quả vòng — nợ D116 chưa trả')
      .toBeTruthy();

    const g = lai.ket_qua_vong;
    expect(g.vong).toBe(tuPost.vong);
    expect(g.nav_truoc).toBe(tuPost.nav_truoc);
    expect(g.cua_ban?.pnl_bp).toBe(tuPost.cua_ban?.pnl_bp);
    expect(g.cua_ban?.chain?.length).toBe(tuPost.cua_ban?.chain?.length);
    expect(g.quy_vong).toEqual(tuPost.quy_vong);
  });

  it('⭐ vòng 1 chưa chốt gì ⇒ trường VẮNG MẶT (không phải null)', async () => {
    const t = await taoTran();
    const st = await xem(t.match_id);
    expect(st.vong).toBe(1);
    expect('ket_qua_vong' in st,
      'gửi `null` thay vì vắng mặt ⇒ client cũ phải phân nhánh thêm một ca').toBe(false);
  });
});

describe('II. Mẫu số phải là NAV HEADLINE', () => {
  it('⭐⭐ `nav_truoc` KHÁC `cua_ban.nav_truoc` của engine ở vòng có lệnh', async () => {
    /*
     * D116 đo ra engine chụp `nav_truoc`/`nav_sau` TRƯỚC khi chia Quỹ vòng, trước
     * gọi ký quỹ và trước SIẾT PHÁP LÝ ⇒ hiệu của chúng lệch với cú đổi NAV người
     * chơi NHÌN THẤY ở 100% số vòng có lệnh, và ĐỔI DẤU ở 15–40%. Đó là lý do
     * client tự chụp headline; nay server chụp hộ để nó sống qua F5.
     *
     * ⚠ Bài này khoá theo TÍNH CHẤT ("hiệu tính từ nav_truoc phải khớp cú đổi
     * headline"), không khoá một con số — số đổi theo seed, tính chất thì không.
     */
    const t = await taoTran();
    let st = await xem(t.match_id);
    const navDau = st.ban.nav;
    st = await nop(t.match_id, st);

    const kq = st.ket_qua_vong;
    expect(kq.nav_truoc, '`nav_truoc` vắng ⇒ con số vòng không dựng lại được')
      .toBe(navDau);
    // Và nó phải là mẫu số ĐÚNG: NAV sau − nav_truoc = cú đổi headline.
    expect(st.ban.nav - kq.nav_truoc).toBe(st.ban.nav - navDau);
  });
});

describe('III. MỘT hàm dựng, không phải hai bản chép', () => {
  const SRC = readFileSync(resolve(process.cwd(), 'server/holdem_api.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('⭐ chỉ có ĐÚNG MỘT chỗ dựng `ket_qua_vong`, và hai route cùng gọi nó', () => {
    /*
     * D116 nêu đích danh: tách thành hàm dùng chung, KHÔNG chép. Bản sao thứ hai
     * không sai lúc viết — nó sai lúc bên kia đổi (D61), và cú trôi ở đây biểu
     * hiện là "bấm con số ra một lý do, F5 xong bấm lại ra lý do khác".
     */
    expect((SRC.match(/function dungKetQuaVong\(/g) ?? []).length,
      'không tìm thấy hàm dựng dùng chung').toBe(1);
    const goi = (SRC.match(/dungKetQuaVong\(/g) ?? []).length;
    expect(goi, 'phải có 1 khai báo + 2 lời gọi (POST và GET)').toBe(3);
    // Và không ai dựng lại khối đó bằng tay ở chỗ khác.
    expect((SRC.match(/ket_qua_vong:\s*\{/g) ?? []).length,
      'có người chép lại khối dựng thay vì gọi hàm chung').toBe(0);
  });
});
