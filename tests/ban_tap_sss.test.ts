/**
 * D337 — ⭐⭐ BÀN TẬP PHẢI CHẠM ĐƯỢC SSS, QUA ĐƯỜNG CHÍNH.
 *
 * Founder 15/09: *"bạn giúp user đạt SSS ở phần hướng dẫn để app flex hiệu ứng nhé =))
 * chứ mình tốn công làm mà ko ai xem thì hơi phí"* — và *"chỉ trong phần hướng dẫn thôi
 * nhé"*. Đường tới SSS không phải một câu dắt tay: nó là THANG BÀN TẬP (`THANG_BAN_TAP`)
 * cộng với việc nghe đúng mạch Oracle đã kể sẵn. D433 — bàn tập v54 (ô úp, D382): vòng N quyết toán ô N+1 đang
 * úp, 12 ô = 11 vòng; đường nghe-Oracle dời theo đúng những câu Oracle nói:
 *   · vòng 1 cầm USDT (D448: Oracle — lá mở màn GIẢM trên bàn ĐỎ, ô sắp lật nghiêng GIẢM tiếp, phe PHÒNG THỦ đỡ hơn),
 *   · vòng 2 (D448: Oracle — GIẢM tiếp, mùa đi xuống đã chạy từ trước khi vào bàn nên không còn trẻ; chuỗi SUY THOÁI →
 *     HẠ LÃI → PHỤC HỒI): rời USDT sang phe RỦI RO (Cổ phiếu CN + Crypto). Seed 77004 dời bước này ở vòng 3; seed dạy màu
 *     bàn mà vẫn đợi vòng 3 thì thanh chỉ tới SS trong trận (đo 28/09: ô 3 ĐI NGANG, cầm tiền không ăn điểm),
 *   · vòng 4 (HẠ LÃI vừa lật, tiền rẻ — quầy lõi có Đòn Bẩy): mua Đòn Bẩy,
 *   · vòng 8 (Oracle: ô 9 ⚖ sắp lật, nó mà TĂNG LÃI thì Đòn Bẩy nhân đôi cú rơi): bán phe rủi ro, sang USDT.
 *
 * ⚠ Bài này là CHUÔNG, không phải đích: đổi luật engine (cổng balance mới), đổi dãy ô
 * bàn tập hay đổi thang mà giết mất khoảnh khắc SSS thì bài đỏ — lúc đó phải đo lại
 * đường nghe-Oracle và SỬA KỊCH BẢN/THANG có chủ đích, không phải sửa bài cho qua.
 * ⚠ Việc kế tiếp đã biết sẽ chạm nó: sửa lỗi đơn vị Đòn Bẩy ở trận NAV (bot cá mập của
 * bàn này đang ăn lỗi ấy) — chạy lại bài này trong cùng commit đó.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { HOLDEM_DECISIONS, laSeedManTap, luatCua } from '../config/holdem.js';

/*
 * D527 — bàn tập mặc định sang nhịp xen kẽ v58 (6 ô, trợ lý `KICH_BAN_MINIGAME`). Bài này canh ĐƯỜNG NGHE-ORACLE của kịch bản v54
 * (`KICH_BAN`), thứ vẫn chạy cho trận tập v54 còn dở ⇒ ghim khoá v54 ĐÍCH DANH và ép nó qua cửa `ep_balance` (vitest), cửa ấy
 * dựng đúng seed của khoá ép (D527).
 */
const KHOA_TAP_V54 = 'balance-v54-ngare';
/** D433 — số VÒNG của bàn tập (server `soVong`, D382): luật ô úp có lá mở màn ⇒ 12 ô = 11 vòng. */
const SO_VONG = HOLDEM_DECISIONS.MAN_TAP_SO_O - (luatCua(KHOA_TAP_V54).oUp ? 1 : 0);

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-secret-bantap-sss', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function json(path: string, init: RequestInit = {}): Promise<any> {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
  const body = await r.json();
  if (r.status >= 400) throw new Error(`${path} → ${r.status} ${JSON.stringify(body)}`);
  return body;
}

type Lenh = { ma: string; chieu: 'mua' | 'ban'; moc_bp: number };
const vong = (v: number, them: { mua?: string[]; lenh?: Lenh[] } = {}) => ({
  vong: v, khao_sat_lai: 0, mua: them.mua ?? null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [],
  ...(them.lenh ? { lenh: them.lenh } : {}),
});
/** Đường nghe-Oracle — xem docstring đầu tệp. */
const DUONG_NGHE_ORACLE = [
  vong(1, { lenh: [{ ma: 'usd', chieu: 'mua', moc_bp: 10000 }] }),
  vong(2, {
    lenh: [
      { ma: 'usd', chieu: 'ban', moc_bp: 10000 },
      { ma: 'cp_cn', chieu: 'mua', moc_bp: 5000 },
      { ma: 'btc', chieu: 'mua', moc_bp: 10000 },
    ],
  }),
  vong(3),
  vong(4, { mua: ['don_bay'] }),
  vong(5), vong(6), vong(7),
  vong(8, {
    lenh: [
      { ma: 'btc', chieu: 'ban', moc_bp: 10000 },
      { ma: 'cp_cn', chieu: 'ban', moc_bp: 10000 },
      { ma: 'usd', chieu: 'mua', moc_bp: 10000 },
    ],
  }),
  vong(9), vong(10), vong(11),
];

describe('D337 — bàn tập: nghe đúng mạch Oracle ⇒ về nhất và chạm SSS', () => {
  it('⭐⭐ thanh trong trận lên SS ở vòng 5, SSS từ vòng 7 tới cuối; màn kết SSS + thứ hạng 1', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ tap: true, ep_balance: KHOA_TAP_V54 }) });
    const { rows } = await pool.query(
      'SELECT seed, balance_version FROM holdem_matches WHERE match_id = $1', [tao.match_id]);
    expect(laSeedManTap(Number(rows[0]!.seed)), 'phải đúng là bàn tập').toBe(true);
    // D392 — bàn tập chạy luật GHIM của nó, không theo luật mặc định (xem `MAN_TAP_BALANCE_VERSION`).
    expect(rows[0]!.balance_version, 'bàn tập phải chạy luật ghim')
      .toBe(KHOA_TAP_V54);

    const hangSauVong: string[] = [];
    expect(DUONG_NGHE_ORACLE.length, 'đường phải đi trọn số vòng của bàn').toBe(SO_VONG);
    for (const b of DUONG_NGHE_ORACLE) {
      const r = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
        method: 'POST', body: JSON.stringify(b),
      });
      expect(r.loi_von?.lenh, `vòng ${b.vong}: lệnh bị từ chối — đường kịch bản đã hỏng`).toBeUndefined();
      if (b.vong < SO_VONG) {
        const st = await json(`/api/v1/holdem/matches/${tao.match_id}`);
        hangSauVong[b.vong] = st.phong_cach?.hang;
      }
    }
    /*
     * D392 — bài này đỏ từ D383 (luật v53: vòng N tính tiền bằng ô N+1, nên đi đúng lời Oracle
     * chỉ về thứ 4). Không nới khẳng định nào: bàn tập nay GHIM luật v52 — đúng luật mà kịch bản
     * Oracle và đường nghe-Oracle ở trên được viết cho — nên chuỗi hạng trở lại y như D337 đo.
     * Gỡ ghim sang luật khác thì bài này đỏ lại — đúng như phải thế (xem docstring đầu tệp).
     */
    /*
     * D433 — đo 27/09 trên bàn tập v54 (seed bánh xe): chuỗi hạng [·, ·, ·, ·, S+, SS, SS, SSS, SSS, SSS, SSS] — SS ở
     * vòng 5 (phục hồi sau cú hạ lãi), SSS từ vòng 7 (bong bóng thật) và GIỮ tới vòng cuối nhờ rút trước kỳ họp tăng lãi.
     */
    expect(hangSauVong[5], 'vòng 5 (phục hồi) — lớp phủ SS').toBe('SS');
    expect(hangSauVong[7], 'vòng 7 (bong bóng thật) — lớp phủ SSS').toBe('SSS');
    expect(hangSauVong[SO_VONG - 1], `vòng ${SO_VONG - 1} — SSS giữ qua cú tăng lãi`).toBe('SSS');

    const kq = await json(`/api/v1/holdem/matches/${tao.match_id}/autopsy`);
    const ban = (kq.xep_hang as { ghe_id: string; hang: number }[]).find((x) => x.ghe_id === 'ban');
    expect(ban?.hang, 'về nhất bàn tập').toBe(1);
    expect(kq.phong_cach.hang, 'màn kết bàn tập').toBe('SSS');
  }, 120_000);
});
