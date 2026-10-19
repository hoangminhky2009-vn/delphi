/**
 * STRESS TEST — BẤT BIẾN DƯỚI ĐỒNG THỜI VÀ DƯỚI TẢI (Đấu trường + Arena).
 *
 * Vì sao cần thêm file này khi đã có `concurrency.test.ts`: file kia phủ đường
 * TIỀN THẬT (đặt kèo — idempotency_key + FOR UPDATE ví) và phủ rất tốt. Nhưng
 * hai writer NÓNG NHẤT của repo — `/holdem/matches/:id/rounds` và
 * `/arena/matches/:id/rounds` — chưa từng có một bài kiểm đồng thời nào. Cả bộ
 * 1.182 test đang xanh trên đúng khoảng trống đó.
 *
 * ─── ĐỒ THẬT, KHÔNG MOCK (A8.9) ────────────────────────────────────────────
 * Hono app thật + embedded Postgres thật + `Promise.all`. Không giả lập độ trễ,
 * không chèn hook vào code sản phẩm: nếu phải sửa code mới test được thì phép
 * đo đã đo một chương trình khác.
 *
 * ─── ĐỌC KẾT QUẢ THẾ NÀO ───────────────────────────────────────────────────
 * Mọi `expect` ở đây khẳng định HÀNH VI ĐÚNG, không khẳng định hành vi hiện
 * tại. Test đỏ = lỗi thật đang sống trên prod, không phải test sai. Khối A đỏ
 * cho tới khi `/rounds` khoá dòng trận; khối A4 (đối chứng) phải XANH SẴN vì
 * `/bang-dien-tu` đã có `FOR UPDATE` — nó chứng minh cách vá đúng là cách nào.
 *
 * ─── ĐUA LÀ XÁC SUẤT ───────────────────────────────────────────────────────
 * Một lượt bắn có thể tình cờ tuần tự hoá. Nên mỗi bài chạy NHIỀU LẦN và khẳng
 * định trên TOÀN BỘ số lần — "không lần nào hỏng", chứ không phải "lần này ổn".
 * Cửa sổ đua rộng nhất ở vòng CUỐI (replay dài nhất), nên bài nặng nhất đặt ở đó.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { auditSupply } from '../scripts/audit_supply.js';
import { consumeLimit } from '../server/auth/rate_limit.js';
import { ECONOMY } from '../config/economy.js';
import { diemPveTheoHang } from '../config/rank.js';
/** Bỏ ĐỒNG HỒ — thứ duy nhất được phép khác giữa các lần trả của cùng một cú nộp (SPEC chan-truoc-beta). */
function boDongHo(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(boDongHo);
  if (x === null || typeof x !== 'object') return x;
  return Object.fromEntries(Object.entries(x as Record<string, unknown>)
    .filter(([k]) => k !== 'dong_ho' && k !== 'het_ms').map(([k, v]) => [k, boDongHo(v)]));
}

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool,
    mailer: new CapturingMailer(),
    appBaseUrl: 'https://dubao.test',
    secureCookie: false,
  }) as Hono<any>;
}, 180_000);

afterAll(async () => { await db?.stop(); });

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------

const goi = async (
  cookie: string, path: string, init: RequestInit = {},
): Promise<Response> =>
  app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) },
  });

/*
 * D525 — mặc định lật sang v58 (khung minigame: sau cú nộp có màn lõi chạy theo đồng hồ, bỏ Bảng điện tử). Bài này đo ĐUA + TẢI trên
 * đường nộp vòng / mở bảng — nhịp nộp liền tay của nó là nhịp Alpha Draft cổ điển ⇒ ghim v56 đích danh (trừ khi bài tự ép khoá khác).
 */
const taoTran = async (u: TestUser, body: Record<string, unknown> = {}) =>
  (await goi(u.cookie, '/api/v1/holdem/matches', {
    method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v56-congdon', ...body }),
  })).json() as Promise<any>;

/** Nộp một vòng "giữ nguyên" — nước rẻ nhất, không đụng shop/lệnh. */
const nopVong = (u: TestUser, id: string, vong: number): Promise<Response> =>
  goi(u.cookie, `/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [],
    }),
  });

const demEvent = async (matchId: string, loai: string): Promise<number> => {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM events
      WHERE context_id = $1 AND action_type = $2`, [matchId, loai]);
  return rows[0].n as number;
};

const docLog = async (matchId: string): Promise<any[]> => {
  const { rows } = await pool.query(
    `SELECT action_log FROM holdem_matches WHERE match_id = $1`, [matchId]);
  return (rows[0]?.action_log ?? []) as any[];
};

// ===========================================================================
// KHỐI A — ĐUA TRÊN CÙNG MỘT TRẬN
// ===========================================================================

describe('A. Đua trên cùng một trận (Đấu trường)', () => {
  /**
   * A1 — Nộp CÙNG MỘT VÒNG nhiều lần song song.
   *
   * Bất biến: một vòng chỉ tồn tại MỘT LẦN. Đúng một request được nhận (200),
   * phần còn lại phải bị từ chối `sai_vong`. Và `events` — bảng append-only
   * LÀ SẢN PHẨM (A1) — không được có dòng thừa nào: một vòng đã chơi sinh đúng
   * một `hd_cam_ket` và một `hd_chot_phien`. Dòng ma không xoá lại được (A3.3).
   */
  it('A1 — 6 request cùng một vòng: đúng 1 lần được nhận, events không nhân bản', async () => {
    const LAN = 6;
    for (let lan = 0; lan < LAN; lan += 1) {
      const u = await createTestUser(pool);
      const t = await taoTran(u, { so_o: 8 });

      const rs = await Promise.all(
        Array.from({ length: 6 }, () => nopVong(u, t.match_id, 1)));
      /*
       * SPEC chan-truoc-beta (11/10) — HỢP ĐỒNG ĐỔI: sáu request CÙNG THÂN là sáu lần gửi của MỘT cú bấm (hai tab · client gửi lại khi
       * mất phản hồi) ⇒ CẢ SÁU nhận đúng một kết quả, và vẫn chỉ MỘT bản ghi (ba khẳng định đếm ngay dưới giữ nguyên). Trước đây "đúng 1
       * được nhận, 5 bị 409" — tức người mất sóng nhận lỗi thay cho kết quả của chính mình.
       */
      const ok = rs.filter((r) => r.status === 200).length;
      expect(ok, `lần ${lan}: mọi request cùng thân nhận kết quả`).toBe(6);
      const than = await Promise.all(rs.map(async (r) => JSON.stringify(boDongHo(await r.clone().json()))));
      expect(new Set(than).size, `lần ${lan}: sáu thân trả lời phải là MỘT kết quả`).toBe(1);
      expect(await demEvent(t.match_id, 'hd_cam_ket'),
        `lần ${lan}: hd_cam_ket của vòng 1`).toBe(1);
      expect(await demEvent(t.match_id, 'hd_chot_phien'),
        `lần ${lan}: hd_chot_phien của vòng 1`).toBe(1);
      expect((await docLog(t.match_id)).length, `lần ${lan}: số dòng action_log`).toBe(1);
    }
  }, 180_000);

  /**
   * A2 — Đua ở VÒNG CUỐI của trận xếp hạng (rank_pve). Bài nặng nhất.
   *
   * Vòng cuối là chỗ cửa sổ đua rộng nhất (replay 7 vòng trước khi ghi) VÀ là
   * chỗ đắt nhất: `luuKetQua` gọi `ghiDiemPve`, mà hàm đó cộng dồn
   * `diem = diem + $3` / `so_tran + 1` — không có khoá duy nhất theo trận.
   * Nhân đôi ở đây là NHÂN ĐIỂM MÙA, tức một đường gian lận thang xếp hạng,
   * chứ không chỉ là bẩn dữ liệu.
   *
   * Khẳng định thêm bất biến 0017 tự tuyên (chống lạm phát điểm):
   *     Σ rank_diem.diem + rank_quy_diem.so_du_sau(mới nhất) = 0
   */
  it('A2 — đua vòng CUỐI rank_pve: điểm mùa cộng ĐÚNG MỘT LẦN', async () => {
    const LAN = 8;
    let dua = 0;
    let khepSom = 0;
    for (let lan = 0; dua < LAN && lan < LAN + 4; lan += 1) {
      const u = await createTestUser(pool);
      const t = await taoTran(u, { che_do: 'rank_pve', so_o: 8 });
      /*
       * D384 — VÒNG CUỐI LÀ `tong_vong` DO SERVER KHAI, không phải số ô gõ tay. Từ D382
       * bộ bài k ô chỉ chạy k−1 vòng (lá mở màn không quyết toán vòng nào), nên bản cũ
       * đua ở "vòng 8" của bàn 8 ô — một vòng KHÔNG TỒN TẠI — và 0/4 request được nhận.
       * ⚠ Bài này bị gạt đi là "flake theo tải" HAI LẦN ngày 22/09 trong khi nó đang báo
       * đúng lỗi thật. Tên bài nói "vòng CUỐI" — đó là manh mối, không phải tiếng ồn.
       */
      const cuoi = Number(t.tong_vong);
      expect(cuoi, `lần ${lan}: server phải khai tong_vong`).toBeGreaterThan(1);

      /*
       * D451 — TRẬN KHÉP SỚM là luật (mọi bot cháy ⇒ ≤ 1 ghế còn trong trận), không phải lỗi. Đo 10/10: 2/150 trận rank_pve
       * v56 bàn 8 khép sớm (vòng 5 và 13 trên 15) theo seed ngẫu nhiên; rơi đúng vòng chuẩn bị cuối thì 4 request vòng cuối
       * đều nhận `match_closed` và bài báo "0 được nhận" — đỏ chập chờn khi chạy chung bộ. Lượt ấy KHÔNG có cuộc đua nào để
       * đo ⇒ không tính vào `LAN`, nhưng chỉ chấp nhận đúng lý do hợp lệ duy nhất (≤ 1 ghế còn sống), y khuôn B1.
       */
      let xongSom = false;
      for (let v = 1; v < cuoi; v += 1) {
        const r = await nopVong(u, t.match_id, v);
        expect(r.status, `lần ${lan}: chuẩn bị vòng ${v}`).toBe(200);
        if (((await r.json()) as { xong?: boolean }).xong === true) { xongSom = true; break; }
      }
      if (xongSom) {
        const song = ((await (await goi(u.cookie, `/api/v1/holdem/matches/${t.match_id}`)).json()) as { so_nguoi_song?: number })
          .so_nguoi_song;
        expect(song, `lần ${lan}: trận khép trước vòng cuối chỉ hợp lệ khi ≤ 1 ghế còn sống (D451)`).toBeLessThanOrEqual(1);
        khepSom += 1;
        continue;
      }
      dua += 1;
      const rs = await Promise.all(
        Array.from({ length: 4 }, () => nopVong(u, t.match_id, cuoi)));
      // Lý do bác in kèm: bài này từng bị gạt là "flake" hai lần trong khi nó báo lỗi thật (D384) — đỏ thì phải đọc được vì sao.
      const lyDo = await Promise.all(rs.map(async (r) => `${r.status}:${(await r.clone().json().catch(() => ({})) as { error?: string }).error ?? ''}`));
      // SPEC chan-truoc-beta — bốn lần gửi của một cú bấm ⇒ cả bốn nhận kết quả; điểm mùa vẫn cộng ĐÚNG MỘT LẦN (khẳng định dưới).
      expect(rs.filter((r) => r.status === 200).length,
        `lần ${lan}: mọi request cùng thân ở vòng CUỐI (${cuoi}/${t.tong_vong}) nhận kết quả — ${lyDo.join(' · ')}`).toBe(4);

      const { rows } = await pool.query(
        `SELECT diem, so_tran FROM rank_diem WHERE user_id = $1`, [u.userId]);
      expect(rows[0]?.so_tran, `lần ${lan}: so_tran sau ĐÚNG MỘT trận`).toBe(1);

      // Hạng thật đọc từ holdem_results — điểm phải khớp bảng PvE của hạng đó.
      const { rows: hr } = await pool.query(
        `SELECT hang FROM holdem_results WHERE match_id = $1 AND user_id = $2`,
        [t.match_id, u.userId]);
      expect(Number(rows[0]?.diem), `lần ${lan}: điểm PvE theo hạng ${hr[0]?.hang}`)
        .toBe(diemPveTheoHang(Number(hr[0].hang)));

      expect(await demEvent(t.match_id, 'hd_match_end'),
        `lần ${lan}: hd_match_end`).toBe(1);
    }

    expect(dua, `số cuộc đua vòng cuối đã đo (${khepSom} trận khép sớm hợp lệ bị bỏ qua)`).toBe(LAN);

    // Bất biến chống lạm phát điểm (0017) — đo trên TOÀN mùa sau cả 8 lần.
    const { rows: tong } = await pool.query(
      `SELECT (SELECT COALESCE(sum(diem), 0) FROM rank_diem WHERE season_id = s.season_id)
            + COALESCE((SELECT so_du_sau FROM rank_quy_diem
                         WHERE season_id = s.season_id
                         ORDER BY entry_id DESC LIMIT 1), 0) AS can
         FROM (SELECT DISTINCT season_id FROM rank_diem) s`);
    for (const r of tong) {
      expect(Number(r.can), 'Σ rank_diem.diem + rank_quy_diem.so_du_sau phải = 0').toBe(0);
    }
  }, 300_000);

  /**
   * A3 — `/rounds` KHÔNG được ghi đè đuôi phí của `/bang-dien-tu`.
   *
   * `/bang-dien-tu` giữ `FOR UPDATE` trên dòng trận, nhưng khoá chỉ có tác dụng
   * khi MỌI writer cùng lấy nó. `/rounds` đọc log ngoài transaction rồi UPDATE
   * vô điều kiện ⇒ nó xoá mất dòng `MoBangCho` vừa ghi.
   *
   * Hậu quả: bảng đã trả về nội dung (200) mà người chơi không trả Vốn nào —
   * LUẬT 3 bị vô hiệu bằng đúng hai request bắn cùng lúc.
   */
  it('A3 — mở bảng + nộp vòng song song: phí Bảng điện tử KHÔNG bốc hơi', async () => {
    const LAN = 8;
    let daKiem = 0;
    let duaThat = 0;
    for (let lan = 0; lan < LAN; lan += 1) {
      const u = await createTestUser(pool);
      const t = await taoTran(u, { so_o: 8 });

      const [bang, vong] = await Promise.all([
        goi(u.cookie, `/api/v1/holdem/matches/${t.match_id}/bang-dien-tu`, {
          method: 'POST', body: JSON.stringify({ vong: 1 }),
        }),
        nopVong(u, t.match_id, 1),
      ]);
      /*
       * ⚠ TIỀN ĐỀ VIẾT LẠI SAU BẢN VÁ CAS (02/08). Bản đầu của bài này đòi CẢ
       * HAI cùng 200 — đó là mô tả đúng của trò khi CÒN LỖ HỔNG. Sau khi
       * `/rounds` có compare-and-set trên `action_log`, hai request đè nhau là
       * BẤT KHẢ THI về mặt thiết kế: kẻ đọc log cũ luôn 409.
       *
       * ⚠⚠ VIẾT LẠI LẦN HAI (10/10, founder chọn A). Bản 02/08 còn đòi "không bao giờ cả hai cùng 200" — sai: `Promise.all`
       * KHÔNG bảo đảm hai request chồng nhau. Đo 10/10: lượt "lạnh" đầu tiên `/bang-dien-tu` commit xong ở 28 ms, `/rounds`
       * tới 214 ms mới đọc trận ⇒ thực chất TUẦN TỰ, cả hai 200 là đúng luồng thường (mở bảng rồi nộp) và phí đã gộp vào dòng
       * vòng. Vế ấy đỏ 3/4 lượt CI nhánh prod (03–08/10) và 2/2 ở snapshot master trên máy founder; master xanh nhờ `retry`.
       * Nên bài khẳng định BẤT BIẾN TIỀN cho MỌI thứ tự, và đòi riêng ≥ 1 lượt chồng nhau THẬT để CAS thực sự bị thử:
       *   · bảng 200 ⇒ phí còn trong log + đúng một `hd_mo_bang`; bảng bị bác ⇒ không thu, không event;
       *   · vòng 200 ⇒ đúng một dòng vòng, phí (nếu có) đã GỘP vào nó — không đuôi mồ côi;
       *   · vòng 409 ⇒ CAS bác sạch: không dòng vòng, không `hd_cam_ket`; bảng 200 thì đuôi phí còn nguyên.
       */
      for (const [ten, r] of [['bảng', bang], ['vòng', vong]] as const) {
        expect([200, 409], `lần ${lan}: ${ten} trả ${r.status} — chỉ được nhận hoặc bác sạch`).toContain(r.status);
      }
      expect(bang.status === 409 && vong.status === 409,
        `lần ${lan}: cả hai cùng bị bác — không writer nào được ghi`).toBe(false);

      const log = await docLog(t.match_id);
      const phi = log.reduce((s, h) => s + Number(h.mo_bang ?? 0), 0);
      const duoi = log.filter((h) => h.cho_nop);
      const dongVong = log.filter((h) => !h.cho_nop);
      const moBang = await demEvent(t.match_id, 'hd_mo_bang');
      const camKet = await demEvent(t.match_id, 'hd_cam_ket');

      if (bang.status === 200) {
        daKiem += 1;
        expect(phi, `lần ${lan}: bảng trả 200 thì phí mở bảng PHẢI còn trong log`).toBeGreaterThanOrEqual(1);
        expect(moBang, `lần ${lan}: bảng 200 ⇒ đúng một hd_mo_bang`).toBe(1);
      } else {
        expect(phi, `lần ${lan}: bảng bị bác mà log vẫn có phí`).toBe(0);
        expect(moBang, `lần ${lan}: bảng bị bác mà vẫn ghi hd_mo_bang`).toBe(0);
      }

      if (vong.status === 200) {
        expect(dongVong.length, `lần ${lan}: vòng 200 ⇒ đúng một dòng vòng`).toBe(1);
        expect(duoi.length, `lần ${lan}: vòng 200 ⇒ đuôi phí đã gộp vào dòng vòng, không mồ côi`).toBe(0);
        expect(camKet, `lần ${lan}: vòng 200 ⇒ đúng một hd_cam_ket`).toBe(1);
      } else {
        const loi = (await vong.json() as { error?: string }).error;
        expect(dongVong.length, `lần ${lan}: vòng ${loi} mà vẫn có dòng vòng`).toBe(0);
        expect(camKet, `lần ${lan}: vòng ${loi} mà vẫn ghi hd_cam_ket`).toBe(0);
        if (bang.status === 200) {
          expect(loi, `lần ${lan}: vòng thua cuộc đua phải bị CAS bác`).toBe('vong_da_nop');
          expect(duoi.length, `lần ${lan}: CAS bác vòng ⇒ đuôi phí của bảng còn nguyên`).toBe(1);
          duaThat += 1;
        }
      }
    }
    expect(daKiem, 'phải có ít nhất một lượt bảng mở được để bài này có nghĩa')
      .toBeGreaterThan(0);
    expect(duaThat, 'phải có ít nhất một lượt hai writer CHỒNG NHAU thật (vòng bị CAS bác) — không thì bài chỉ đo hai request tuần tự')
      .toBeGreaterThan(0);
  }, 240_000);

  /**
   * A4 — ĐỐI CHỨNG. Hai cú mở bảng song song trên CÙNG vòng.
   *
   * Bài này phải XANH SẴN, không cần sửa gì: `/bang-dien-tu` đã lấy
   * `FOR UPDATE` (holdem_api.ts, `layTran(..., client, true)`). Giữ nó trong bộ
   * để hai chuyện rõ ra: (1) cách vá đúng đã có sẵn trong chính file đó;
   * (2) nếu ngày nào đó ai gỡ khoá thì bài này đỏ ngay.
   */
  it('A4 — (đối chứng) hai cú mở bảng song song chỉ thu phí MỘT lần', async () => {
    for (let lan = 0; lan < 6; lan += 1) {
      const u = await createTestUser(pool);
      const t = await taoTran(u, { so_o: 8 });

      await Promise.all([
        goi(u.cookie, `/api/v1/holdem/matches/${t.match_id}/bang-dien-tu`, {
          method: 'POST', body: JSON.stringify({ vong: 1 }),
        }),
        goi(u.cookie, `/api/v1/holdem/matches/${t.match_id}/bang-dien-tu`, {
          method: 'POST', body: JSON.stringify({ vong: 1 }),
        }),
      ]);
      const duoi = (await docLog(t.match_id)).filter((h) => h.cho_nop);
      expect(duoi.length, `lần ${lan}: số đuôi chờ nộp`).toBe(1);
      expect(duoi[0]?.mo_bang, `lần ${lan}: số lần thu phí`).toBe(1);
    }
  }, 180_000);
});

/*
 * ⚠ KHỐI A' (đua ở Arena sandbox) ĐÃ GỠ 11/08 — xem D81. Engine sandbox và
 * toàn bộ `/arena/*` đã ra khỏi repo: D40 thay hẳn mô hình từ 27/07 và từ đó
 * không còn đường vào nào từ UI, nhưng 7 endpoint vẫn sống và vẫn ghi vào
 * `events` (append-only). Bài A5 canh một cuộc đua trên những cửa nay không
 * còn tồn tại; giữ lại là một bài test xanh vĩnh viễn trên mã đã chết.
 *
 * Lớp lỗi mà nó canh (đọc ván ngoài transaction rồi UPDATE vô điều kiện) VẪN
 * được canh ở khối A cho `/holdem/rounds` — cùng bệnh, bảng còn sống.
 */

// KHỐI B — TẢI: NHIỀU NGƯỜI CHƠI CÙNG LÚC
// ===========================================================================

describe('B. Tải — nhiều người chơi đồng thời', () => {
  const SO_NGUOI = 40;
  const SO_O = 8;
  const nguoi: TestUser[] = [];

  /**
   * B1 — 40 người, mỗi người một trận riêng, tất cả chơi ĐỒNG THỜI tới hết bàn.
   *
   * Đây là hình dạng tải thật của C2: đỉnh CCU không phải nhiều người trong một
   * trận (chưa có PvP) mà là nhiều trận song song. Bài này không đo đua — nó đo
   * "hệ có xuống cấp có kiểm soát không": không 5xx, không trận nào dựng lại sai
   * số vòng, và mọi trận đóng đúng trạng thái.
   */
  it(`B1 — ${SO_NGUOI} trận song song chạy hết bàn: không 5xx, log đúng số vòng`, async () => {
    for (let i = 0; i < SO_NGUOI; i += 1) {
      nguoi.push(await createTestUser(pool));
    }

    const t0 = performance.now();
    const ketQua = await Promise.all(nguoi.map(async (u) => {
      const t = await taoTran(u, { so_o: SO_O });
      // D384 — số vòng do server khai (bàn k ô có thể chỉ chạy k−1 vòng), không gõ tay.
      const soVong = Number(t.tong_vong);
      const ma: number[] = [];
      let soLuot = 0;
      for (let v = 1; v <= soVong; v += 1) {
        const r = await nopVong(u, t.match_id, v);
        ma.push(r.status);
        if (r.status !== 200) break;
        soLuot += 1;
        /*
         * D451 — trận KHÉP SỚM là luật, không phải lỗi: `daKetThuc` khép khi chỉ còn ≤ 1 ghế trong trận (mọi bot cháy).
         * Bài cũ nộp mù tới `tong_vong` nên đỏ chập chờn theo seed (đo 28/09: seed 2099466810, v56 — ba bot cháy, trận
         * khép sau 11/15 vòng, vòng 12 bị 409 `match_closed`). Server báo `xong` ở chính cú nộp ⇒ dừng đúng ở đó.
         */
        if (((await r.json()) as { xong?: boolean }).xong === true) break;
      }
      /*
       * ⭐ VẾ MỚI (D384) — VÒNG QUÁ CUỐI PHẢI BỊ TỪ CHỐI. Đúng lớp lỗi D383: engine từng chạy
       * quá `tong_vong` một vòng rồi nổ "vượt quá map". Server khai N vòng thì N+1 phải là
       * 4xx sạch, không phải 200 (chạy lố) và càng không phải 5xx (nổ).
       */
      const qua = await nopVong(u, t.match_id, soLuot + 1);
      // Khép sớm ⇒ đọc số ghế còn sống để bài dưới đòi đúng lý do hợp lệ duy nhất (D451).
      const song = soLuot < soVong
        ? ((await (await goi(u.cookie, `/api/v1/holdem/matches/${t.match_id}`)).json()) as { so_nguoi_song?: number })
          .so_nguoi_song
        : null;
      return { matchId: t.match_id as string, ma, soVong, soLuot, song, quaCuoi: qua.status };
    }));
    const ms = performance.now() - t0;

    const tatCaMa = ketQua.flatMap((k) => k.ma);
    expect(tatCaMa.filter((m) => m >= 500), 'không được có 5xx nào').toEqual([]);
    expect(tatCaMa.every((m) => m === 200), 'mọi vòng phải được nhận').toBe(true);
    const quaCuoi = ketQua.map((k) => k.quaCuoi);
    expect(quaCuoi.filter((m) => m < 400 || m >= 500),
      'vòng tong_vong+1 phải bị từ chối SẠCH (4xx) — 200 là chạy lố, 5xx là nổ').toEqual([]);

    for (const k of ketQua) {
      const { rows } = await pool.query(
        `SELECT status, vong_hien_tai, jsonb_array_length(action_log) AS n
           FROM holdem_matches WHERE match_id = $1`, [k.matchId]);
      expect(Number(rows[0].n), 'số dòng action_log = số vòng đã nộp').toBe(k.soLuot);
      expect(rows[0].status).toBe('xong');
      // D451 — khép TRƯỚC `tong_vong` chỉ hợp lệ khi còn ≤ 1 ghế trong trận; khép sớm vì lý do khác vẫn đỏ.
      if (k.soLuot < k.soVong) {
        expect(k.song, `trận ${k.matchId} khép sau ${k.soLuot}/${k.soVong} vòng mà còn nhiều ghế sống`).toBeLessThanOrEqual(1);
      }
    }

    const tongVong = ketQua.reduce((n, k) => n + k.soLuot, 0);
    const khepSom = ketQua.filter((k) => k.soLuot < k.soVong).length;
    console.log(`   B1: ${SO_NGUOI} trận × ${ketQua[0]?.soVong} vòng (${khepSom} trận khép sớm vì mọi bot cháy) = ${tongVong} lượt nộp`
      + ` trong ${ms.toFixed(0)}ms → ${(tongVong / (ms / 1000)).toFixed(0)} vòng/giây`
      + ` (pool test max=5 kết nối)`);
  }, 600_000);

  /**
   * B2 — TƯỜNG LỬA DƯỚI TẢI (A3.5 + D24 mục 1).
   *
   * Sau cả cơn bão B1: không một chip nào trong trận được rò sang ví thật. Ví
   * của cả 40 người phải đứng nguyên ở vốn khởi điểm, sổ ví đúng một bút toán
   * `signup_grant`, và audit tổng cung phải CÂN.
   *
   * Tường lửa đã có test tĩnh (`holdem_firewall.test.ts` quét import). Bài này
   * kiểm nó ở tầng KHÁC: sau khi đường code đã thực sự chạy vài trăm lần.
   */
  it('B2 — sau bão: ví không đổi, audit tổng cung CÂN', async () => {
    for (const u of nguoi) {
      const { rows } = await pool.query(
        `SELECT bankroll, quest_points FROM users WHERE user_id = $1`, [u.userId]);
      expect(Number(rows[0].bankroll), `ví ${u.handle} không được đổi vì chơi Đấu trường`)
        .toBe(ECONOMY.STARTING_BANKROLL);
      expect(Number(rows[0].quest_points), `Q ${u.handle} phải đứng yên`).toBe(0);

      const { rows: sl } = await pool.query(
        `SELECT count(*)::int AS n FROM wallet_ledger WHERE user_id = $1`, [u.userId]);
      expect(sl[0].n, `sổ ví ${u.handle} chỉ có bút toán signup_grant`).toBe(1);
    }

    const report = await auditSupply(pool);
    expect(report.problems, 'audit tổng cung phải CÂN sau tải').toEqual([]);
  }, 180_000);
});

// ===========================================================================
// KHỐI C — RATE LIMIT NGUYÊN TỬ (hồi quy)
// ===========================================================================

describe('C. Rate limit dưới tải', () => {
  /**
   * C1 — `consumeLimit` phải nguyên tử.
   *
   * Bản `checkLimit` + `recordAttempt` rời từng đo được: tuần tự 20 request lọt
   * 5 (đúng), SONG SONG 20 request lọt 16 (sai). Nay dùng
   * `pg_advisory_xact_lock`. Đây là bài hồi quy để không ai tách lại hai câu đó.
   */
  it('C1 — 30 request song song vào xô trần 5: lọt ĐÚNG 5', async () => {
    const xo = `stress:${Math.random().toString(36).slice(2)}`;
    const rs = await Promise.all(
      Array.from({ length: 30 }, () => consumeLimit(pool, xo, 5, 60)));
    expect(rs.filter((r) => r.allowed).length).toBe(5);
  }, 120_000);

  /**
   * C2 — trần tạo trận theo GIỜ phải chặn thật khi bị dội song song.
   * Trần là 30/giờ (`GIOI_HAN.TAO_MOI_GIO`); bắn 45 cú cùng lúc.
   */
  it('C2 — 45 cú tạo trận song song: không quá 30 trận được tạo', async () => {
    const u = await createTestUser(pool);
    const rs = await Promise.all(Array.from({ length: 45 }, () =>
      goi(u.cookie, '/api/v1/holdem/matches', {
        method: 'POST', body: JSON.stringify({ so_o: 8 }),
      })));
    const tao = rs.filter((r) => r.status === 201).length;
    expect(tao, 'số trận tạo được không vượt trần giờ').toBeLessThanOrEqual(30);

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM holdem_matches WHERE owner_user_id = $1`,
      [u.userId]);
    expect(rows[0].n, 'số dòng trận trong DB phải khớp số 201 trả về').toBe(tao);
  }, 180_000);
});
