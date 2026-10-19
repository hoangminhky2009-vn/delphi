/**
 * v53 (D373) — ÚP Ô ĐANG CHƠI, canh Ở TẦNG API THẬT.
 *
 * `o_up_v53.test.ts` canh phần engine (bot · lãi suất · bảng điện tử). Bài này canh đúng một
 * câu, nhưng là câu quyết định: **payload gửi cho trình duyệt có còn mang ô của vòng không.**
 *
 * ⚠ VÌ SAO PHẢI LÀ API CHỨ KHÔNG PHẢI HÀM DỰNG DTO: cơ chế này giấu thông tin, mà thông tin
 * rò rỉ ở TẦNG TRUYỀN. Một bài gọi thẳng hàm dựng DTO sẽ xanh kể cả khi route thật trả một
 * payload khác (lọc thiếu, gộp thêm khối, hay đơn giản là quên nối cờ). Đây đúng nếp "đo trên
 * ĐƯỜNG CHÍNH, không đường tắt" (A11.6/D78).
 *
 * ⚠ HAI CHIỀU: mọi khẳng định "v53 giấu" đi kèm "v52 vẫn lộ". Không có vế sau thì bài này sẽ
 * xanh vĩnh viễn nếu ai đó lỡ tắt cả hai đường.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { LAI_SUAT_NEN } from '../config/holdem.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

const SO_O = 8;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

const json = async (path: string, init: RequestInit = {}): Promise<any> => (
  await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  })
).json();

/** Tạo trận ép đúng bộ luật cần đo, rồi đọc lại trạng thái qua GET (đường client đi). */
async function tran(phienBan: string): Promise<any> {
  const tao = await json('/api/v1/holdem/matches', {
    method: 'POST',
    body: JSON.stringify({ ep_balance: phienBan, so_o: SO_O }),
  });
  expect(tao.match_id, `tạo trận ${phienBan} hỏng: ${JSON.stringify(tao)}`).toBeTruthy();
  return json(`/api/v1/holdem/matches/${tao.match_id}`);
}

let v53: any;
let v52: any;

beforeAll(async () => {
  v53 = await tran('balance-v53-upo');
  v52 = await tran('balance-v52-dadang');
}, 120_000);

describe('I. ⭐ Ô CỦA VÒNG KHÔNG CÓ MẶT TRONG PAYLOAD v53', () => {
  /*
   * ⚠ D379 ĐỔI LUẬT Ở ĐÂY: ô VÒNG 1 nay LUÔN NGỬA (bối cảnh mở màn, không phải thứ để
   * cược — founder 22/09). Nên ở vòng 1, v53 phải GIỐNG HỆT v52; vế "úp" chuyển sang
   * canh ở vòng 2 trong `o_up_v53.test.ts`. Giữ nguyên bài cũ ở đây là ghim một luật
   * đã chết.
   */
  /*
   * ⚠ MÔ HÌNH ĐỔI HAI LẦN TRONG NGÀY 22/09 — vế này là bản CUỐI (D382).
   * Bản giữa (D379) cho vòng 1 ngửa HẲN, tức không có lá úp nào ở vòng 1; nó hỏng vì lá
   * tính tiền cho vòng 1 khi ấy chính là lá đang nhìn thấy. Bản cuối: lá 1 là BỐI CẢNH
   * MỞ MÀN (ngửa, không tính tiền), còn lá đang ÚP là `o[1]` — lá sẽ quyết toán vòng 1.
   * Nên ở vòng 1 v53 VẪN khai `up_o`, và `o_hien_tai` vẫn null (ô của vòng đang úp);
   * thứ ngửa nằm trong `lich_su_o` chứ không nằm ở `o_hien_tai`.
   */
  it('v53 ở vòng 1: CÓ cờ úp (lá o[1] đang úp), ô của vòng vẫn null', () => {
    expect(v53.up_o, 'không cờ úp ⇒ không còn lá nào để đoán').toBe(true);
    expect(v53.o_hien_tai, 'ô của vòng phải còn úp').toBeNull();
  });

  it('v52 (tiêm ngược): KHÔNG có cờ, và ô của vòng nằm ngửa trong payload', () => {
    expect(v52.up_o).toBeUndefined();
    expect(v52.o_hien_tai).not.toBeNull();
    expect(['giai_doan', 'su_kien']).toContain(v52.o_hien_tai.kind);
  });

  it('⭐ vòng 1: v53 ĐÃ có lá mở màn, v52 chưa lá nào — đây là cả cú đổi mô hình', () => {
    expect(v53.vong).toBe(1);
    expect(v53.lich_su_o.length, 'lá mở màn phải tới được màn hình, nếu không "lá đầu vẫn úp"').toBe(1);
    expect(v52.lich_su_o, 'v52 không có bối cảnh mở màn').toEqual([]);
  });
});

describe('II. Đếm bài — "còn lại" nghĩa là còn ÚP', () => {
  /*
   * Ở v52 ô 1 đang ngửa giữa màn nên "còn 7" là đúng (lỗi lệch-một đã vá 28/07).
   * Ở v53 không ô nào ngửa, nên cùng vòng ấy phải là "còn 8". Hai con số khác nhau
   * ở cùng vòng 1 chính là thứ chứng minh cờ đã chảy tới tận phép đếm.
   */
  it('v53 vòng 1: "còn" = 7, trừ đúng ô mở màn đã ngửa (giống v52)', () => {
    // D379 — vòng 1 ngửa ⇒ v53 trừ đúng ô mở màn, y như v52.
    expect(v53.bo_bai_con_lai.con_lai, '"còn" phải trừ ô mở màn đang ngửa').toBe(SO_O - 1);
    expect(v53.tong_vong, 'bộ bài k ô chỉ chạy được k−1 vòng').toBe(SO_O - 1);
    expect(v52.tong_vong, 'v52 không đổi: số vòng == số ô').toBe(SO_O);
  });

  it('v52 (tiêm ngược): còn 7 — vì ô 1 đang ngửa', () => {
    expect(v52.bo_bai_con_lai.con_lai).toBe(SO_O - 1);
  });

  it('thành phần vẫn cộng đủ ở cả hai luật (không nuốt mất ô nào)', () => {
    for (const st of [v53, v52]) {
      const b = st.bo_bai_con_lai;
      expect(b.so_giai_doan + b.so_su_kien).toBe(b.con_lai);
    }
  });
});

describe('III. Không có cửa sau: chuỗi · kỳ họp · lãi suất', () => {
  it('v53 vòng 1: chuỗi không thể dài hơn MỘT — ô chưa lật không được đếm', () => {
    // Ở v52 ô 1 đã ngửa nên chuỗi CÓ THỂ đã hình thành; ở v53 thì chắc chắn chưa.
    /*
     * ⚠ KHÔNG so với `v52.xu_huong`: hai fixture là HAI TRẬN seed khác nhau, nên so trực
     * tiếp là so hai bản đồ khác nhau — bài xanh/đỏ theo may rủi. (Bản đầu của tôi viết
     * đúng như thế và nó xanh một lần rồi đỏ ở lượt chạy đầy đủ.)
     * Tính chất THẬT cần canh: vòng 1 của v53 nay ĐÃ lật ô mở màn, nên chuỗi được tính
     * trên đúng MỘT ô — chứ không phải `null` như khi ô của vòng còn úp.
     */
    /*
     * ⚠ KHÔNG khẳng định GIÁ TRỊ của `xu_huong` ở đây. Hai lý do, cả hai tôi đã trả giá
     * trong đúng phiên này:
     *   · so với `v52.xu_huong` là so HAI TRẬN seed khác nhau — xanh/đỏ theo may rủi;
     *   · khẳng định "phải khác null" cũng sai: ô mở màn ĐI NGANG thì chuỗi null hợp lệ,
     *     mà ô mở màn là ngẫu nhiên theo seed.
     * Thứ TẤT ĐỊNH và vẫn đáng canh: vòng 1 chỉ có đúng MỘT ô đã lật, nên không đời nào
     * có một chuỗi dài hơn 1 — chuỗi dài hơn nghĩa là đang đếm cả ô chưa ai thấy.
     * Vế "vòng 1 không úp" đã được canh tất định ở `o_up_v53.test.ts` (unit, không seed).
     */
    expect(v53.xu_huong === null || v53.xu_huong.dai === 1,
      'vòng 1 mà chuỗi dài hơn 1 ⇒ đang đếm cả ô chưa lật').toBe(true);
  });

  it('v53 vòng 1: `chinh_sach` null — chưa kỳ họp nào lật thì chưa có kết quả nào', () => {
    expect(v53.chinh_sach ?? null).toBeNull();
  });

  it('v53 vòng 1: lãi suất đúng MỨC KHỞI ĐIỂM (chưa ô nào dịch được nó)', () => {
    if (v53.lai_suat === undefined) return; // trận không bật cơ chế — không có gì để rò
    // Đọc hằng số, không gõ tay: bài chép số thì nó chỉ nhắc lại config (bẫy 7).
    expect(v53.lai_suat.diem).toBe(LAI_SUAT_NEN.KHOI_DIEM);
  });
});
