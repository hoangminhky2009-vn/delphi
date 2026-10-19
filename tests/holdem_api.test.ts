/**
 * MARKET HOLD'EM — API qua HTTP, DB thật, đúng đường code production.
 *
 * Soi bốn thứ dễ hỏng nhất và đắt nhất khi hỏng:
 *   1. THÔNG TIN ẨN — cờ `la_tin_gia` KHÔNG được lọt ra response nào trước khi
 *      trận kết thúc. Lọt = F12 đọc được = toàn bộ cơ chế Tin giả vô nghĩa.
 *   2. R1 (D25) — event `hd_cam_ket` phải mang bối cảnh đối thủ ĐANG HIỂN THỊ.
 *      events append-only nên thiếu trường = hỏng vĩnh viễn, không backfill.
 *   3. TƯỜNG LỬA — chơi cả trận không suy suyển bankroll/quest_points một đơn vị.
 *   4. SERVER LÀ CHÂN LÝ (C4) — client khai bừa vẫn ra số của server.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
/*
 * D525 — mặc định lật sang v58 (khung minigame: màn lõi sau cú nộp, bỏ cam kết/Bảng điện tử…). Bài này canh luật ALPHA DRAFT
 * CỔ ĐIỂN mà mọi trận prod tới 05/10 chạy (v56, ghim trong golden) ⇒ tạo trận bằng khoá v56 ĐÍCH DANH.
 */
const KHOA_CO_DIEN = JSON.stringify({ ep_balance: 'balance-v56-congdon' });
import { BAC_THANG } from '../config/rank.js';
import { BAC_BRIER } from '../config/progression.js';
import {
  CHIEN_THUAT, HOLDEM_DECISIONS, HOLDEM_MATCH, SO_GHE_MAX, SO_GHE_MIN, TAI_SAN, soLanCatLo,
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
    tickSecret: 'tick-secret-holdem', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function req(path: string, init: RequestInit = {}): Promise<Response> {
  return app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
}
async function json(path: string, init: RequestInit = {}): Promise<any> {
  return (await req(path, init)).json();
}

/** Chơi trọn một trận, trả về mọi response vòng. */
async function choiHetTran(): Promise<{ matchId: string; vong: any[]; soGhe: number }> {
  const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
  // D3 — số ghế của TRẬN NÀY (bàn 4–8). Trả ra để assertion khỏi đoán.
  const soGhe = tao.doi_thu.length + 1;
  const vong: any[] = [];
  // D406 — số vòng của TRẬN NÀY (server), không phải `MAP_SIZE`: khoá mặc định v54 dựng bàn 16 (15 vòng).
  const tong = Number(tao.tong_vong ?? HOLDEM_DECISIONS.MAP_SIZE);
  for (let v = 1; v <= tong; v += 1) {
    const shop = v === 1 ? tao.shop : vong[vong.length - 1]?.shop;
    const r = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({
        vong: v, khao_sat_lai: 0,
        mua: shop?.tai_san?.[0] ?? null,
        hanh_dong: 'giu_vi_the', them: 0,
      }),
    });
    vong.push(r);
    if (r.xong) break;
  }
  return { matchId: tao.match_id, vong, soGhe };
}

describe('1. Catalog + tạo trận', () => {
  it('catalog trả đủ bộ bài và quyết định D24', async () => {
    const c = await json('/api/v1/holdem/catalog');
    expect(c.tai_san).toHaveLength(6);
    // Số thẻ chiến thuật lấy TỪ CONFIG, không gõ cứng: bộ bài còn dài ra theo các
    // cụm khắc chế (D5 thêm 'Đi Ngược'), và một con số cứng ở đây chỉ tạo ra một
    // test đỏ vô nghĩa mỗi lần thêm thẻ — nó không canh bất biến nào.
    expect(c.chien_thuat).toHaveLength(CHIEN_THUAT.length);
    expect(c.chien_thuat.length, 'bộ bài không được rỗng').toBeGreaterThan(6);
    expect(c.giai_doan).toHaveLength(5);
    expect(c.quyet_dinh.MAP_SIZE).toBe(HOLDEM_DECISIONS.MAP_SIZE);
    expect(c.quyet_dinh.SHOWDOWN_MODEL).toBe('A');
  });

  it('tạo trận → 201, bàn 4–8 ghế và có shop', async () => {
/*
 * D3 (25/07/2026) — SỐ GHẾ THÔI LÀ HẰNG SỐ: mỗi trận 4–8 ghế, rút từ seed.
 * Nên mọi assertion về số ghế phải suy TỪ CHÍNH TRẬN ĐÓ, không so với
 * `HOLDEM_MATCH.SEATS` nữa. Hằng số đó giờ chỉ là bàn quy chiếu cho cân bằng.
 */
    const r = await req('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    expect(r.status).toBe(201);
    const b = await r.json() as any;
    const soGhe = b.doi_thu.length + 1;
    expect(soGhe, 'bàn phải nằm trong dải D3').toBeGreaterThanOrEqual(SO_GHE_MIN);
    expect(soGhe).toBeLessThanOrEqual(SO_GHE_MAX);
    expect(b.ban.von).toBe(HOLDEM_MATCH.START_VON);
    expect(b.shop.tai_san).toHaveLength(TAI_SAN.length);
    expect(b.vong).toBe(1);
  });

  it('chưa đăng nhập → 401 (endpoint JSON)', async () => {
    const r = await app.request('http://localhost/api/v1/holdem/catalog');
    expect(r.status).toBe(401);
  });
});

describe('1b. TRANG HTML — chuyển hướng, KHÔNG trả cục JSON', () => {
  /**
   * Lỗi founder gặp 20/07: mở /choi bằng trình duyệt khi chưa đăng nhập thì
   * nhận nguyên `{"error":"unauthorized"}` giữa màn hình, không có lối đi tiếp.
   * Trang HTML phải chuyển hướng về màn đăng nhập của SPA.
   */
  /*
   * K5 (Q4 = A) — `GET /api/v1/holdem/choi` (302 về `/arena`) đã XOÁ cùng `guardTrang`; trang server-render còn lại duy nhất là
   * `/admin`, nên luật "trang HTML chuyển hướng, không trả JSON" canh trên nó.
   */
  it('chưa đăng nhập → 302 về /onboard kèm ?next= (trang /admin)', async () => {
    const r = await app.request('http://localhost/admin', { redirect: 'manual' });
    expect(r.status).toBe(302);
    const loc = r.headers.get('location') ?? '';
    expect(loc).toContain('/onboard');
    expect(loc, 'phải nhớ đường quay lại').toContain('next=');
    expect(await r.text(), 'không được trả JSON').not.toContain('unauthorized');
  });

  it('đường cũ /api/v1/holdem/choi đã gỡ ⇒ 404, không còn chuyển hướng', async () => {
    const r = await req('/api/v1/holdem/choi', { redirect: 'manual' });
    expect(r.status).toBe(404);
  });
});

describe('2. 🔴 THÔNG TIN ẨN — tin giả không được lọt ra F12', () => {
  it('KHÔNG response nào trong lúc chơi chứa "la_tin_gia"', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    expect(JSON.stringify(tao)).not.toContain('la_tin_gia');

    for (let v = 1; v <= 3; v += 1) {
      const raw = await (await req(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
        method: 'POST',
        body: JSON.stringify({ vong: v, hanh_dong: 'giu_vi_the', them: 0, mua: null }),
      })).text();
      expect(raw, `vòng ${v} lộ cờ tin giả`).not.toContain('la_tin_gia');
    }
    const st = await (await req(`/api/v1/holdem/matches/${tao.match_id}`)).text();
    expect(st).not.toContain('la_tin_gia');
  });

  it('telegraph chỉ nói "nghiêng về", KHÔNG nói tin thật hay giả', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    let state = tao;
    for (let v = 1; v <= 5 && !state.xong; v += 1) {
      state = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
        method: 'POST',
        body: JSON.stringify({ vong: v, hanh_dong: 'giu_vi_the', them: 0, mua: null }),
      });
      if (state.telegraph) {
        // DANH SÁCH TRẮNG — cố ý ghim chặt. Thêm trường vào telegraph là bắt
        // dừng lại cân nhắc xem nó có rò thông tin ẩn không, thay vì trôi qua.
        //
        // `keo_theo` thêm 20/07 và AN TOÀN: nó suy từ MT_SU_KIEN_KE_TIEP —
        // một bảng hằng số công khai — theo id sự kiện đã lật, KHÔNG đọc
        // `la_tin_gia`. Nó nói "tin này THƯỜNG kéo theo gì", không nói tin này
        // có thật hay không. Đó đúng là chỗ người chơi phải tự cân.
        expect(Object.keys(state.telegraph).sort())
          .toEqual(['keo_theo', 'nghieng_ve', 'tu_su_kien']);
      }
    }
  });

  it('autopsy SAU khi xong mới lộ map đầy đủ', async () => {
    const { matchId } = await choiHetTran();
    const a = await json(`/api/v1/holdem/matches/${matchId}/autopsy`);
    expect(a.xong).toBe(true);

    // ⚠ Bản trước khẳng định thẳng `map_da_lo` có chứa 'la_tin_gia'. Test đó
    // FLAKY và không ai bắt được lâu: seed trận sinh bằng Math.random(), mà cờ
    // tin giả chỉ nằm trên ô SỰ KIỆN — map 8 ô hoàn toàn có thể không có ô sự
    // kiện nào (luật: không sự kiện trước vòng N, không hai sự kiện liền nhau).
    // Trận như vậy làm test đỏ dù code đúng hoàn toàn.
    //
    // Bất biến THẬT, luôn kiểm được: map lộ ĐỦ số ô, và MỌI ô sự kiện đều kèm
    // cờ tin giả. Vế "trong trận không được lộ" đã có test riêng ở trên giữ.
    // D406 — cỡ THẬT của trận (khoá mặc định v54 dựng bàn 16), không phải `MAP_SIZE`.
    const soO = (await pool.query('SELECT so_o FROM holdem_matches WHERE match_id = $1', [matchId])).rows[0]!.so_o as number;
    expect(a.map_da_lo).toHaveLength(soO);
    const suKien = a.map_da_lo.filter((o: any) => o.kind === 'su_kien');
    for (const o of suKien) {
      expect(typeof o.la_tin_gia, 'ô sự kiện phải lộ cờ tin giả').toBe('boolean');
    }
  });

  it('bộ bài còn lại chỉ trả SỐ ĐẾM, không trả thứ tự — và "còn" nghĩa là còn ÚP', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    expect(Object.keys(tao.bo_bai_con_lai).sort())
      .toEqual(['con_lai', 'so_giai_doan', 'so_su_kien', 'tin_gia_ky_vong']);
    /*
     * SỬA LỆCH-MỘT 28/07: bản cũ đếm cả Ô ĐANG NGỬA vào "còn lại". Founder thấy
     * đúng cảnh này trên prod — vòng 1 map 8 hiện "còn 8 ô" trong khi ô 1 đã
     * ngửa "HIỆN TẠI" giữa màn: hai vùng của CÙNG một payload cãi nhau
     * (`o_hien_tai` phơi ô đó ra, `bo_bai_con_lai` bảo nó còn úp).
     * Test dùng GET trạng thái (đường UI đi), không tạo thêm trận — POST thứ ~10
     * của file này đụng rate limit và match_id undefined làm GET nổ 500 vô nghĩa.
     */
    const st = await json(`/api/v1/holdem/matches/${tao.match_id}`);
    /*
     * ⚠ D378 — GHIM TÍNH CHẤT, KHÔNG GHIM CON SỐ. Bản cũ khẳng định "ô hiện tại phải NGỬA
     * ngay vòng 1" + `con_lai === tong_vong - 1`. Đó là LUẬT v52, và v53 đổi đúng chỗ ấy:
     * ô của vòng bị ÚP (ở vòng 1 thì LUÔN úp — `sinhMap` cấm ô tin ở vòng 1, mà v53 chỉ úp
     * ô pha). Ghim con số thì bài đỏ mỗi lần lật cổng, và người sửa dễ "sửa cho xanh" bằng
     * cách nới con số — tức gỡ mất chính hàng rào.
     *
     * Thứ PHẢI đúng ở CẢ HAI phiên bản là quan hệ: **"còn" = số ô còn ÚP**, nên nó trừ đi
     * đúng những ô đã ngửa — không nhiều hơn (giấu bớt), không ít hơn (đếm cả ô đã phơi).
     * Chính vế "ít hơn" là lỗi founder bắt trên prod 28/07: vòng 1 map 8 hiện "còn 8 ô"
     * trong khi ô 1 đã ngửa giữa màn — hai vùng của CÙNG một payload cãi nhau.
     */
    const daNgua = st.o_hien_tai ? 1 : 0;
    expect(st.bo_bai_con_lai.con_lai, '"còn" phải đúng bằng số ô còn ÚP')
      .toBe(st.tong_vong - daNgua);
    // Và hai vùng không được cãi nhau: ô đã phơi ra thì KHÔNG được đếm là còn úp.
    if (st.o_hien_tai) {
      expect(st.bo_bai_con_lai.con_lai,
        'ô đang ngửa mà vẫn bị đếm vào "còn lại" — đúng lỗi 28/07').toBeLessThan(st.tong_vong);
    }
  });
});

describe('3. 🔴 R1 — bối cảnh đối thủ vào event, không backfill được', () => {
  it('hd_cam_ket ghi ĐÚNG bảng đối thủ mà API đã gửi ra', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, hanh_dong: 'tang_cam_ket', them: 50, mua: null }),
    });

    const ev = await pool.query(
      `SELECT value_json, state_snapshot_json FROM events
        WHERE context_id = $1 AND action_type = 'hd_cam_ket'`, [tao.match_id]);
    expect(ev.rowCount).toBe(1);
    const snap = ev.rows[0]!.state_snapshot_json;

    // Số đối thủ phải khớp CHÍNH TRẬN NÀY (D3: bàn 4–8), không phải hằng số.
    expect(snap.doi_thu, 'thiếu bối cảnh đối thủ → R1 hỏng vĩnh viễn')
      .toHaveLength(tao.doi_thu.length);
    expect(snap.so_nguoi_song).toBe(tao.doi_thu.length + 1);
    /*
     * R4: BẬC, không phải điểm số.
     *
     * ⚠ SỬA 27/07 (luồng xếp hạng): bản cũ kiểm `['Đồng','Bạc','Vàng']` — tức nó
     * KHOÁ ĐÚNG HAI CÁI LỖI thay vì bắt chúng. (a) Ba chữ đó là bậc BRIER của Hệ B
     * (`config/progression.ts`), dùng lại cho Đấu trường là hai đại lượng khác nhau
     * đọc ra cùng một chữ; (b) chúng được sinh bằng `BAC_RANK[(seed+i*3)%3]`, tức
     * NGẪU NHIÊN — mà R1 log cột này như "bậc người chơi ĐÃ THẤY" để khử nhiễu
     * nể-cao/lấn-thấp, nên khử nhiễu bằng nhãn ngẫu nhiên cho ra kết luận SAI.
     *
     * Nay kiểm QUAN HỆ chứ không kiểm danh sách chép tay: nhãn phải thuộc thang
     * Đấu trường (hoặc '—' cho ghế máy vì máy không có bậc), và TUYỆT ĐỐI không
     * được là một chữ của Hệ B.
     */
    const nhanHopLe = new Set<string>([
      '—', 'CHƯA XẾP BẬC', 'Chưa xếp',
      ...BAC_THANG.map((b) => b.biet_danh),
    ]);
    const nhanHeB = new Set<string>(BAC_BRIER.map((b) => b.bac));
    for (const d of snap.doi_thu) {
      expect(nhanHopLe, `nhãn bậc lạ: ${d.bac_rank}`).toContain(d.bac_rank);
      expect(nhanHeB.has(d.bac_rank), 'badge Đấu trường mượn tên bậc Hệ B').toBe(false);
      expect(d).not.toHaveProperty('diem');
    }
    // Đúng bảng đối thủ lúc BẮT ĐẦU vòng (thứ người chơi đang nhìn khi bấm).
    expect(snap.doi_thu.map((d: any) => d.ghe_id))
      .toEqual(tao.doi_thu.map((d: any) => d.ghe_id));
  });

  /*
   * TRẠNG THÁI CẢM XÚC (D25 — xã hội là stakes engine).
   *
   * Đây là biến gây nhiễu phải khử khi đọc dữ liệu khẩu vị rủi ro: người ta tố
   * mạnh hơn khi thấy đối thủ đang cháy, và nhường khi thấy đối thủ thắng đậm.
   * Không log thì mọi phân tích "mức cam kết ↔ độ tự tin" đều lẫn hiệu ứng xã
   * hội vào — và KHÔNG BACKFILL ĐƯỢC.
   */
  it('API gửi `fx` cho MỌI ghế — cả đối thủ lẫn ghế mình', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    const HOP_LE = ['binh_thuong', 'lai_dam', 'lo_dam', 'nguy_kich', 'chay'];
    expect(HOP_LE).toContain(tao.ban.fx);
    for (const d of tao.doi_thu) expect(HOP_LE, `ghế ${d.ghe_id}`).toContain(d.fx);
    // Đầu trận mọi ghế bằng vốn khởi điểm → không ai đang lãi/lỗ đậm.
    expect(tao.ban.fx).toBe('binh_thuong');
  });

  it('hd_cam_ket ghi `opponent_fx_state` — trạng thái CẢ BÀN lúc quyết định', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, hanh_dong: 'tang_cam_ket', them: 50, mua: null }),
    });
    const ev = await pool.query(
      `SELECT state_snapshot_json FROM events
        WHERE context_id = $1 AND action_type = 'hd_cam_ket'`, [tao.match_id]);
    const fx = ev.rows[0]!.state_snapshot_json.opponent_fx_state;
    expect(fx, 'thiếu opponent_fx_state → không khử được nhiễu xã hội').toBeTruthy();
    /*
     * Đủ MỌI ghế của bàn đó: các đối thủ + CHÍNH MÌNH. Thiếu ghế mình thì không
     * so được "tôi đang cháy" với "đối thủ đang cháy" — mất nửa tín hiệu.
     *
     * D3: bàn 4–8 ghế nên KHÔNG khoá cứng danh sách id nữa; suy từ chính trận.
     */
    expect(Object.keys(fx).sort())
      .toEqual(['ban', ...tao.doi_thu.map((d: any) => d.ghe_id)].sort());
    for (const v of Object.values(fx)) {
      expect(['binh_thuong', 'lai_dam', 'lo_dam', 'nguy_kich', 'chay']).toContain(v);
    }
  });

  it('R3 — bot lộ mặt là bot, tên có tiền tố "Máy"', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    for (const d of tao.doi_thu) {
      expect(d.loai).toBe('bot');
      expect(d.ten).toMatch(/^Máy · /);
    }
  });

  it('ghi event chốt phiên kèm dây chuyền chấm điểm', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, hanh_dong: 'giu_vi_the', them: 0, mua: tao.shop.tai_san[0] }),
    });
    const ev = await pool.query(
      `SELECT value_json FROM events
        WHERE context_id = $1 AND action_type = 'hd_chot_phien'`, [tao.match_id]);
    expect(ev.rowCount).toBe(1);
    expect(Array.isArray(ev.rows[0]!.value_json.chain)).toBe(true);
  });
});

describe('4. 🔴 TƯỜNG LỬA — chip ảo không chạm ví', () => {
  it('chơi trọn trận: bankroll và quest_points KHÔNG đổi', async () => {
    const truoc = await pool.query(
      'SELECT bankroll, quest_points FROM users WHERE user_id = $1', [user.userId]);
    await choiHetTran();
    const sau = await pool.query(
      'SELECT bankroll, quest_points FROM users WHERE user_id = $1', [user.userId]);
    expect(sau.rows[0]!.bankroll).toBe(truoc.rows[0]!.bankroll);
    expect(sau.rows[0]!.quest_points).toBe(truoc.rows[0]!.quest_points);
  });

  it('không sinh bút toán ledger nào từ trận', async () => {
    // Đo CHÊNH LỆCH, không đếm tuyệt đối: user test có sẵn 1 bút toán
    // `signup_grant` 1.000 T lúc tạo, đếm thô sẽ đỏ oan.
    const dem = async () => (await pool.query(
      'SELECT count(*)::int c FROM wallet_ledger WHERE user_id = $1',
      [user.userId])).rows[0]!.c as number;
    const truoc = await dem();
    await choiHetTran();
    expect(await dem(), 'trận sandbox tuyệt đối không được ghi ledger').toBe(truoc);
  });
});

describe('5. Chơi — dây chuyền, vòng, kết thúc', () => {
  it('mỗi vòng trả dây chuyền có thứ tự, mắt xích nhân đứng cuối', async () => {
    const { vong } = await choiHetTran();
    for (const v of vong) {
      const chain = v.ket_qua_vong?.cua_ban?.chain;
      if (!chain?.length) continue;
      const iNhan = chain.findIndex((m: any) => m.kind === 'nhan');
      if (iNhan >= 0) expect(iNhan).toBe(chain.length - 1);
    }
  });

  it('chơi hết map thì trận đóng, xếp hạng đủ MỌI ghế của bàn đó', async () => {
    const { matchId, vong, soGhe } = await choiHetTran();
    expect(vong[vong.length - 1]!.xong).toBe(true);
    const a = await json(`/api/v1/holdem/matches/${matchId}/autopsy`);
    expect(a.xep_hang).toHaveLength(soGhe);
    expect(a.xep_hang[0]!.hang).toBe(1);
  });

  it('lưu kết quả vào holdem_results khi xong — một dòng mỗi ghế', async () => {
    const { matchId, soGhe } = await choiHetTran();
    const r = await pool.query(
      'SELECT count(*)::int c FROM holdem_results WHERE match_id = $1', [matchId]);
    expect(r.rows[0]!.c).toBe(soGhe);
  });

  it('nộp sai số vòng → 409, không làm hỏng trận', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    const r = await req(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 7, hanh_dong: 'giu_vi_the', them: 0 }),
    });
    expect(r.status).toBe(409);
    expect(((await r.json()) as any).error).toBe('sai_vong');
  });

  it('trận đã xong thì không nộp thêm được', async () => {
    const { matchId, vong } = await choiHetTran();
    const r = await req(`/api/v1/holdem/matches/${matchId}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: vong.length + 1, hanh_dong: 'giu_vi_the', them: 0 }),
    });
    expect([409]).toContain(r.status);
  });

  it('SERVER LÀ CHÂN LÝ: khai `them` khổng lồ vẫn bị trần chặn', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    const r = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, hanh_dong: 'tang_cam_ket', them: 99999999 }),
    });
    // Vốn CÓ THỂ tăng vượt vạch xuất phát nếu ăn Quỹ vòng — đó là luật, không
    // phải lỗi.
    //
    // ⚠ Cận cũ là "cam kết nền + 40% vốn, nhân số ghế". Cận đó CHẾT từ khi vòng
    // cược chạy tuần tự (20/07): trần TRAN_TANG_CAM_KET_BP là trần MỖI CÚ TỐ,
    // mà một vòng có thể tố qua tố lại nhiều lượt — đúng như poker, và chính là
    // thứ founder yêu cầu. Quỹ 31.000 > 22.500 là cơ chế chạy đúng, không phải
    // rò rỉ. Bất biến THẬT chỉ có hai: không ai góp quá túi mình, nên quỹ không
    // vượt tổng vốn cả bàn; và không ai âm vốn.
    expect(r.ket_qua_vong.quy_vong)
      .toBeLessThanOrEqual(HOLDEM_MATCH.START_VON * (tao.doi_thu.length + 1));
    expect(r.ban.von).toBeGreaterThanOrEqual(0);
    for (const d of r.ket_qua_vong.cua_doi_thu) {
      expect(d.von_sau).toBeGreaterThanOrEqual(0);
    }
  });

  it('hành động lạ → 400', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    const r = await req(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, hanh_dong: 'all_in', them: 0 }),
    });
    expect(r.status).toBe(400);
  });

  it('không xem được trận của người khác', async () => {
    const nguoiKhac = await createTestUser(pool);
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    const r = await app.request(`http://localhost/api/v1/holdem/matches/${tao.match_id}`, {
      headers: { cookie: nguoiKhac.cookie },
    });
    expect(r.status).toBe(404);
  });
});

/*
 * ⚠ 5b GHIM v10a: "mua tài sản bằng LÁ" chết theo thiết kế trong nav (tài sản
 * đi bằng lệnh mốc) — nhưng trận v10a đã lưu vẫn replay luật lá nên vẫn canh.
 */
describe('5b. 🔴 MUA TỪ CẢ HAI BỘ BÀI trong cùng một vòng', () => {
  /**
   * Founder bắt 20/07: "sao t đ** chọn được cả tài sản và chiến thuật?"
   * Chương II thiết kế: hai bộ bài tách biệt để KẾT HỢP thành danh mục.
   * Bản đầu API chỉ nhận `mua` MỘT lá → không bao giờ lấy được cả hai.
   */
  it('gửi mảng [tài sản, chiến thuật] → danh mục nhận CẢ HAI', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v10a-tatcuoc' }) });
    const ts = tao.shop.tai_san[0];
    const ct = tao.shop.chien_thuat[0];
    const r = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, mua: [ts, ct], hanh_dong: 'giu_vi_the', them: 0 }),
    });
    expect(r.ban.danh_muc.tai_san, 'thiếu thẻ tài sản').toContain(ts);
    expect(r.ban.danh_muc.chien_thuat, 'thiếu thẻ chiến thuật').toContain(ct);
  });

  it('vẫn đọc được dạng CŨ (chuỗi đơn) — trận đang chơi dở không gãy', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v10a-tatcuoc' }) });
    const r = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, mua: tao.shop.tai_san[0], hanh_dong: 'giu_vi_the', them: 0 }),
    });
    expect(r.ban.danh_muc.tai_san).toContain(tao.shop.tai_san[0]);
  });

  it('quá 2 thẻ → 400, không cho gom cả shop', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v10a-tatcuoc' }) });
    const r = await req(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({
        vong: 1, mua: [...tao.shop.tai_san, ...tao.shop.chien_thuat],
        hanh_dong: 'giu_vi_the', them: 0,
      }),
    });
    expect(r.status).toBe(400);
  });

  it('trạng thái trả kèm dòng thời gian đã lật + quỹ vòng tối thiểu', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v10a-tatcuoc' }) });
    expect(tao.lich_su_o).toEqual([]);
    expect(tao.quy_vong_hien_tai).toBeGreaterThan(0);
    const r = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, hanh_dong: 'giu_vi_the', them: 0 }),
    });
    expect(r.lich_su_o).toHaveLength(1);
    expect(JSON.stringify(r.lich_su_o), 'lộ tin giả').not.toContain('la_tin_gia');
  });
});

describe('6. Cảnh báo xung đột — UI gọi trước khi xác nhận mua', () => {
  it('trả cảnh báo có nhãn đọc được', async () => {
    const r = await json('/api/v1/holdem/canh-bao-xung-dot', {
      method: 'POST',
      body: JSON.stringify({ the: 'chan_lo', tai_san: [], chien_thuat: ['mua_duoi'] }),
    });
    expect(r.canh_bao).not.toBeNull();
    expect(r.canh_bao.nhan_xung_dot).toBe('Mua Đuổi');
  });

  it('không xung đột → null (đừng doạ nhầm)', async () => {
    const r = await json('/api/v1/holdem/canh-bao-xung-dot', {
      method: 'POST',
      body: JSON.stringify({ the: 'phong_ho', tai_san: [], chien_thuat: ['chan_lo'] }),
    });
    expect(r.canh_bao).toBeNull();
  });
});

describe('7. BÀN CÓ SỰ SỐNG — thấy đối thủ làm gì (founder 20/07)', () => {
  /**
   * Trước đây đối thủ chỉ là tên + số tiền: không biết nó theo, bỏ hay rút bài.
   * Poker mà không thấy hành động đối thủ thì chơi với tường.
   * Hành động cược là THÔNG TIN CÔNG KHAI — danh mục mới là thứ phải giấu.
   */
  it('doi_thu kèm SỐ thẻ đang cầm (không kèm danh mục cụ thể)', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    for (const d of tao.doi_thu) {
      expect(typeof d.so_the, 'thiếu số thẻ').toBe('number');
      expect(d).not.toHaveProperty('danh_muc');
    }
  });

  it('cua_doi_thu kèm hành động: check / raise / fold', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    const r = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, hanh_dong: 'giu_vi_the', them: 0, mua: null }),
    });
    expect(r.ket_qua_vong.cua_doi_thu.length).toBeGreaterThan(0);
    for (const d of r.ket_qua_vong.cua_doi_thu) {
      expect(['giu_vi_the', 'tang_cam_ket', 'cat_lo']).toContain(d.hanh_dong);
      expect(typeof d.da_hit).toBe('boolean');
      // Danh mục đối thủ VẪN ẩn — chỉ số lượng, không phải nội dung.
      expect(d).not.toHaveProperty('chain');
      expect(d).not.toHaveProperty('danh_muc');
    }
  });

  /*
   * ⚠ LẬT CHIỀU 28/07 — trước đây test này khẳng định "TĂNG CAM KẾT ra raise".
   * Từ v10a (`cuocTat`) TỐ CHẾT THEO THIẾT KẾ: mọi nước trừ 'bo' ép về 'theo',
   * mất mát tối đa một vòng chặn ở mức nền. Test cũ chỉ còn xanh được nhờ một
   * BUG khác — replay chỉ truyền 2/8 cờ vào taoTran nên cuocTat chưa từng chạy
   * ở tầng API (cơ chế trang trí lần thứ 11, sửa cùng ngày). Nay cờ tới nơi
   * thật, và test canh đúng luật mới: gửi tăng cam kết thì bị ÉP GIỮ NGUYÊN,
   * cam kết đúng bằng nền — không ai kéo được ai vượt nền nữa.
   */
  it('gửi TĂNG CAM KẾT dưới cuocTat → bị ép GIỮ NGUYÊN, cam kết = nền', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    const r = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, hanh_dong: 'tang_cam_ket', them: 3000, mua: null }),
    });
    expect(r.ket_qua_vong.cua_ban.hanh_dong).toBe('giu_vi_the');
    expect(r.ket_qua_vong.cua_ban.cam_ket).toBe(HOLDEM_MATCH.CAM_KET_NEN);
  });

  it('người CẮT LỖ: fold + THU PHÍ + TRỪ QUOTA + vòng sau vẫn ở trong trận', async () => {
    /*
     * Mở rộng test cũ ("hành động là fold") thay vì thêm test mới: file này bị
     * TRẦN 30 TRẬN/GIỜ, và một `POST /matches` thêm là đủ làm `beforeAll` của
     * nhóm 8 trượt rồi 6 test khác đỏ với lý do vô nghĩa. Đã dính đúng bẫy đó
     * một lần trong phiên này.
     *
     * Ba assertion dưới sinh ra vì đo trên browser thật thấy MÂU THUẪN: bấm
     * "Cắt lỗ" xong `so_lan_cat_lo` vẫn 0 và Vốn TĂNG 250 — tức UI không hề bỏ
     * bài. Test này chốt hợp đồng API để lần sau biết ngay lỗi ở tầng nào.
     */
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    const r = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({
        vong: 1, hanh_dong: 'cat_lo', them: 0, mua: null, cuoc: [{ loai: 'bo' }],
      }),
    });
    expect(r.ket_qua_vong.cua_ban.hanh_dong).toBe('cat_lo');
    expect(r.ban.so_lan_cat_lo, 'quota phải bị trừ').toBe(1);
    // D406 — quota theo cỡ bàn (`soLanCatLo`), đọc cỡ THẬT của trận: bàn 16 của v54 có quota khác bàn 8.
    const soO = (await pool.query('SELECT so_o FROM holdem_matches WHERE match_id = $1', [tao.match_id])).rows[0]!.so_o as number;
    expect(r.ban.con_lai_cat_lo).toBe(soLanCatLo(soO) - 1);
    expect(r.ban.tu_the, 'cắt lỗ KHÔNG rời trận — khác hẳn đứng ngoài').toBe('choi');
    expect(r.ban.von, 'phải MẤT tiền, không được lãi').toBeLessThan(HOLDEM_MATCH.START_VON);
    // Phí phải được KỂ RA, kèm cờ giẫm đạp — người chơi mất tiền phải biết vì sao.
    expect(r.ket_qua_vong.phi_cua_ban?.loai).toBe('cat_lo');
    expect(r.ket_qua_vong.phi_cua_ban?.mat).toBeGreaterThan(0);
    expect(typeof r.ket_qua_vong.phi_cua_ban?.giam_dap).toBe('boolean');
  });

  it('mua thẻ → da_hit = true (đó là HIT của blackjack)', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: KHOA_CO_DIEN });
    const r = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({
        vong: 1, hanh_dong: 'giu_vi_the', them: 0, mua: [tao.shop.tai_san[0]],
      }),
    });
    expect(r.ket_qua_vong.cua_ban.da_hit).toBe(true);
  });
});

/*
 * ⚠ KHỐI 8 (LƯỢT CƯỢC TUẦN TỰ) ĐÃ GỠ 11/08 — xem D81.
 *
 * Nó kiểm hợp đồng của `POST /matches/:id/luot`, endpoint vừa được gỡ cùng cả
 * cỗ máy cược tuần tự mà D40 (27/07) tuyên CHẾT HẲN. Client chưa bao giờ gọi
 * nó: `moVong()` — cửa duy nhất dẫn tới — không có một người gọi nào.
 *
 * ⚠ Bốn bài này XANH suốt từ D40 tới nay trên một đường không ai đi. Đó chính
 * là thứ làm chúng nguy hiểm hơn vô dụng: một bộ test xanh tạo cảm giác vùng
 * đó còn được canh, trong khi nó đã chết từ lâu.
 */

