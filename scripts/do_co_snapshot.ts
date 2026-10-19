/**
 * ĐO KÍCH THƯỚC THẬT của `events.state_snapshot_json` THEO TỪNG `action_type` — B3
 * (03/09/2026, quyết định founder).
 *
 * Chạy: npx tsx scripts/do_co_snapshot.ts
 *
 * ─── VÌ SAO ĐO CÁI NÀY ──────────────────────────────────────────────────────
 * A7 (`docs/luat/04-du-lieu.md`) nói snapshot "Mục tiêu ≤ ~300 byte/event". Thực tế
 * `hd_cam_ket` nhúng NGUYÊN mảng đối thủ (`bangDoiThu()`, tới 7 ghế cho bàn 8) vào
 * `state_snapshot_json` mỗi vòng — luật và code lệch nhau, và trước script này KHÔNG
 * AI ĐO, chỉ ước lượng ("~600–700 byte cho bàn 5 ghế" — một câu không ai chạy lại
 * được). Founder chốt phương án (a): GIỮ snapshot giàu, ĐỔI LUẬT theo TỪNG loại,
 * ĐO THẬT thay vì ước lượng. Script này là phép đo; `config/su_kien.ts` là luật suy
 * ra từ nó; `tests/co_snapshot.test.ts` là hàng rào giữ luật đó không trôi.
 *
 * ─── CÁCH ĐO ────────────────────────────────────────────────────────────────
 * Lái ĐÚNG app Hono thật (`createApp`, `server/app.ts`) qua `app.request` — cùng
 * đường mà người chơi thật đi, không gọi tắt engine. Toàn bộ số đo tính bằng SQL
 * (`octet_length`, `percentile_cont`) trên chính bảng `events` sau khi chơi xong —
 * không tính bằng `JSON.stringify(...).length` ở tầng Node, vì đó đo SAI đơn vị:
 * `octet_length` đếm BYTE UTF-8 thật trên đĩa, `.length` của JS string đếm UTF-16
 * code unit — hai con số lệch nhau ngay khi có dấu tiếng Việt trong dữ liệu (không
 * có ở đây, nhưng lệch cũng xảy ra với escape của JSON, nên đo tại nguồn cho chắc).
 *
 * Danh mục `action_type` HỢP LỆ đọc từ CHÍNH `pg_get_constraintdef` của
 * `events_action_type_check` (cùng kỹ thuật migration 0047 dùng để NỚI check đó) —
 * đây là nguồn chân lý theo đúng chỉ định của nhiệm vụ, không dò tay qua 20 migration.
 *
 * ─── BA BẪY ĐO ĐÃ TRÁNH (học từ `do_sql_moi_tran.ts`) ─────────────────────────
 * 1. KHÔNG đo bằng Node — SQL làm hết (xem trên). Không có Proxy/bọc hàm nào ở
 *    đây nên không có lớp lỗi "bọc chồng" mà `do_sql_moi_tran.ts` từng dính.
 * 2. `startTestDb()` chạy migrations TRƯỚC — action_type mới nhất (kể cả PFM,
 *    0047) đã có trong CHECK khi ta query nó, không lệch với code.
 * 3. `pg.types.setTypeParser(20, BigInt)` (đặt trong `tests/helpers/testdb.js`)
 *    biến MỌI cột BIGINT (kể cả `seed`, `event_id`) thành JS BigInt — mọi số đọc
 *    ra từ DB dùng trực tiếp trong so sánh/tính toán phải `Number(...)` trước.
 *
 * ─── HẠT GIỐNG SEED ────────────────────────────────────────────────────────
 * Seed của MỖI TRẬN do server random (`Math.floor(Math.random()*0xffffffff)`) —
 * đây là hành vi THẬT của app khi tạo trận qua API công khai (không có tham số
 * ngoài cho phép client ấn định seed, và cố tình không có — "ghim seed tự do =
 * farm bàn đã biết trước", xem `holdem_api.ts` dòng ~2807). Số GHẾ (4–8) là hàm
 * tất định CỦA seed đó (`SO_GHE_MIN + seed % 5`), nên "bàn 8 ghế" không xin được
 * trực tiếp — script TẠO NHIỀU bàn map 16 rồi giữ bàn đầu tiên ra đúng 8 ghế.
 * Phần điều khiển được (thứ tự hành động, id thẻ dùng, lựa chọn kỳ ngộ) thì CỐ
 * ĐỊNH — không có `Math.random()` nào của riêng script này.
 */
import pg from 'pg';
import { startTestDb } from '../tests/helpers/testdb.js';
import { createTestUser, ensureGenesis } from '../tests/helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { SO_GHE_MAX, boNhiemVuMoi, laVongKyNgo } from '../config/holdem.js';

const TICK_SECRET = 'tick-secret-do-co-snapshot';

/** Mã tài sản CỐ ĐỊNH dùng cho dao/khoa/short mỗi vòng — chỉ cần vài mã HỢP LỆ (có thật trong
 *  `TAI_SAN`, config/holdem.ts), không cần đúng luật đặc quyền (xem lý do ở `choiTran`). */
const MA_DAO_TU = 'btc';
const MA_DAO_DEN = 'vang';
const MA_KHOA = 'usd';
const MA_SHORT = 'tpcp';

/**
 * Danh mục `action_type` HỢP LỆ hiện tại — đọc thẳng từ CHECK constraint trên DB
 * (kỹ thuật giống migration 0047: `pg_get_constraintdef`), KHÔNG dò tay qua từng
 * migration. Đây là "nguồn chân lý" theo đúng lời nhiệm vụ giao.
 */
async function docDanhMucActionType(pool: pg.Pool): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'events_action_type_check' AND conrelid = 'events'::regclass`);
  const def = rows[0]?.def as string | undefined;
  if (!def) throw new Error('không đọc được events_action_type_check — schema lệch dự đoán');
  const ra = new Set<string>();
  for (const m of def.matchAll(/'([a-z][a-z0-9_]{2,40})'::text/g)) ra.add(m[1]!);
  if (ra.size < 10) {
    throw new Error(`chỉ rút được ${ra.size} action_type từ constraint — regex hỏng, không phải repo sạch`);
  }
  return [...ra].sort();
}

/** Lý do KHÔNG đo được — khai rõ để "chưa đo" không lặng lẽ biến mất khỏi báo cáo. */
const LY_DO_KHONG_DO: Record<string, string> = {
  onboard_demo: 'chỉ ghi qua phễu đăng ký/onboarding THẬT (server/app.ts); fixture user của script '
    + 'này (createTestUser) cố ý ĐI TẮT qua SQL để né chi phí argon2id (~100ms/hash) — cùng lý do '
    + 'các bài test Đấu trường hiện có đều đi tắt. Ngoài phạm vi phép đo snapshot Đấu trường.',
  avatar_chon: 'cùng phễu onboarding với onboard_demo ở trên — một event, một lý do.',
  handle_doi: 'chỉ ghi khi người dùng ĐÃ có hồ sơ đổi handle qua `PATCH /me` — không nằm trên đường '
    + 'chơi Đấu trường, không dựng riêng cho lần đo này.',
  cos_equip: 'cần vật phẩm trang trí đã sở hữu (gacha/shop) — user mới của script không có gì để mặc.',
  sticker_dan: 'cùng lý do cos_equip — cần vật phẩm sticker đã sở hữu.',
  avatar_tao: 'sinh khi mở hộp gacha hoặc khi nhận quà nhiệm vụ mốc — cả hai đường đều cần trạng thái '
    + 'thiết lập riêng (shop/quest) ngoài phạm vi lần đo này.',
  market_view: 'chợ dự báo parimutuel — mùa 0.0 ĐÓNG BĂNG theo CLAUDE.md (A0/D86, "mở lại = bỏ cờ"); '
    + 'không phải mặt sản phẩm đang đo cho quyết định B3.',
  bet_place: 'cùng lý do market_view — chợ dự báo đóng băng mùa này.',
  bet_adjust: 'cùng lý do market_view — chợ dự báo đóng băng mùa này.',
  pool_reveal: 'cùng lý do market_view — chợ dự báo đóng băng mùa này.',
  bp_chang_nhan: 'thuộc hệ "lộ trình" (server/nhiem_vu.ts) — cần trạng thái chặng lộ trình riêng, '
    + 'ngoài phạm vi lần đo Đấu trường này.',
  nv_diem_danh: 'thuộc hệ nhiệm vụ điểm danh (server/nhiem_vu.ts) — cần lịch điểm danh riêng.',
  nv_view: 'thuộc hệ nhiệm vụ (server/nhiem_vu_api.ts) — cần danh sách nhiệm vụ đã giao.',
  qua_beta_nhan: 'cần MÃ MỜI beta do admin cấp (server/qua_beta.ts) — không tự sinh được trong script.',
  rank_diem_thay_doi: 'CHỈ ghi trong `ghiDiemTran` (server/rank.ts), và hàm đó TỪ CHỐI ngay khi bàn có '
    + 'một ghế bot ("bàn có N ghế không phải người thật" — dòng ~137). API công khai KHÔNG có cách tạo '
    + 'trận toàn người thật: `che_do` client chọn được chỉ có `tu_do`/`rank_pve` (rank_slot/rank_bu — '
    + 'PvP thật, dùng `ghiDiemTran` — bị đóng ở tầng tạo trận, xem holdem_api.ts dòng ~2866: "PvP thật '
    + 'vẫn đóng — chúng thuộc lớp ghép trận chưa xây"). Xác nhận BẰNG ĐỌC CODE, không phải "chưa thử".',
  rank_len_bac: 'cùng lý do rank_diem_thay_doi — cùng hàm `ghiDiemTran`, cùng cửa chặn.',
  rank_tut_bac: 'cùng lý do rank_diem_thay_doi — cùng hàm `ghiDiemTran`, cùng cửa chặn.',
  shop_mua: 'cửa hàng token (server/shop.ts) — cần danh mục hàng + số dư token thiết lập riêng.',
  gacha_trung: 'cùng lý do shop_mua — cần mở hộp gacha thật.',
  gacha_mo: 'cùng lý do shop_mua — cần mở hộp gacha thật.',
  pfm_bat: 'CHƯA CÓ ĐƯỜNG CHẠY: giữ chỗ trong CHECK từ migration 0047 (PFM) nhưng KHÔNG file nào trong '
    + '`server/` (ngoài `server/pfm/xoa.ts`, chỉ lo xoá) có câu INSERT ghi loại này — xác nhận bằng '
    + '`grep -rn "pfm_bat" server/`. Tính năng PFM ghi sự kiện chưa thi công, không phải bỏ sót phép đo.',
  pfm_tat: 'cùng lý do pfm_bat — chưa có đường chạy.',
  pfm_consent: 'cùng lý do pfm_bat — chưa có đường chạy.',
  pfm_diem_danh: 'cùng lý do pfm_bat — chưa có đường chạy.',
  pfm_hu: 'cùng lý do pfm_bat — chưa có đường chạy.',
  pfm_luat: 'cùng lý do pfm_bat — chưa có đường chạy.',
  pfm_tuan_niem_phong: 'cùng lý do pfm_bat — chưa có đường chạy.',
  hd_brier_vong: 'chỉ ghi khi `cuaBan.brier` là số — tức người chơi ĐANG GIỮ một dự báo thật (không '
    + '100% tiền mặt). Script có thử `gan: {mua_duoi: MA_DAO_TU}` (cấu trúc hợp lệ — `mua_duoi` có '
    + '`pham_vi: \'tai_san\'`, xem config/holdem.ts) nhưng KHÔNG ra Brier: gán một thẻ chiến thuật vào '
    + 'tài sản nhiều khả năng cần thẻ đó đã NẰM TRONG danh mục (`danh_muc.chien_thuat`) từ một vòng mua '
    + 'trước, chứ không nhận `gan` một thẻ chưa từng sở hữu — cần dò sâu hơn `replay`/`apLenh` để dựng '
    + 'đúng chuỗi mua-rồi-gán nhiều vòng. Đã THỬ THẬT (không phải suy luận suông) và ghi lại kết quả âm.',
  hd_khop_lenh: 'endpoint RIÊNG (`/matches/:id/khop`) khớp một lệnh CHỜ (`lenh[].moc_bp`) đặt ở vòng '
    + 'trước khi giá chạm mốc GIỮA hai vòng — cần hiểu đúng `apLenhMocNav`/đặc quyền Chia Lệnh để dựng '
    + 'một lệnh THỰC SỰ khớp được (không chỉ đúng cấu trúc như dao/khoa/short — khớp lệnh KHÔNG ghi event '
    + 'khi không có gì khớp, xem holdem_api.ts dòng ~3437: "NO-OP CŨNG LÀ TỪ CHỐI"). Ngoài ngân sách thời '
    + 'gian của lần đo này — cần dựng kịch bản giá đa vòng, không phải một trường body tĩnh.',
  // ── Xác nhận CHẾT: 0 kết quả `grep -rn "<tên>" server/ config/` — không phải "chưa thử", mà là
  // KHÔNG CÒN (hoặc CHƯA TỪNG CÓ) một câu INSERT nào ghi loại này trong toàn bộ code hiện hành. ──
  sb_alloc_set: 'engine THỨ HAI đã dọn ("arena", `server/sandbox/`) — nhật ký 02/08–08/08 '
    + '(`docs/nhat-ky/02-dau-thang8-d43-d85.md`, mục D75) đã ghi nó là "rác hai lần pivot… không còn '
    + 'đường vào từ UI" và xếp vào việc cần dọn; `server/sandbox/` hôm nay CHỈ còn ba tệp tiện ích dùng '
    + 'chung (gacha.ts/rng.ts/ung_vien.ts, không viết action_type `sb_*` nào) — xác nhận bằng '
    + '`grep -rln "sb_alloc_set" server/ config/` ra rỗng. 10 loại `sb_*` trong danh mục đều cùng cảnh này.',
  sb_autopsy_view: 'cùng lý do sb_alloc_set — engine "arena" đã dọn, 0 chỗ ghi trong code hiện hành.',
  sb_card_buy: 'cùng lý do sb_alloc_set — engine "arena" đã dọn, 0 chỗ ghi trong code hiện hành.',
  sb_faction_pick: 'cùng lý do sb_alloc_set — engine "arena" đã dọn, 0 chỗ ghi trong code hiện hành.',
  sb_match_end: 'cùng lý do sb_alloc_set — engine "arena" đã dọn, 0 chỗ ghi trong code hiện hành.',
  sb_match_start: 'cùng lý do sb_alloc_set — engine "arena" đã dọn, 0 chỗ ghi trong code hiện hành.',
  sb_news_react: 'cùng lý do sb_alloc_set — engine "arena" đã dọn, 0 chỗ ghi trong code hiện hành.',
  sb_round_end: 'cùng lý do sb_alloc_set — engine "arena" đã dọn, 0 chỗ ghi trong code hiện hành.',
  sb_rule_set: 'cùng lý do sb_alloc_set — engine "arena" đã dọn, 0 chỗ ghi trong code hiện hành.',
  sb_shop_roll: 'cùng lý do sb_alloc_set — engine "arena" đã dọn, 0 chỗ ghi trong code hiện hành.',
  hd_tai_co_cau: 'v0.1 Đấu trường (migration 0010: "Tái cơ cấu / Giữ nguyên + thẻ đã mua") — khái niệm '
    + 'này nay là `hd_dao_danh_muc` (đảo danh mục); tên cũ còn trong CHECK nhưng 0 chỗ ghi trong '
    + 'code hiện hành (`grep -rn "hd_tai_co_cau" server/` ra rỗng).',
  hd_khao_sat_lai: 'v0.1 Đấu trường (migration 0010: "khảo sát lại shop") — nay chỉ còn là TRƯỜNG '
    + '`khao_sat_lai` bên trong `value_json` của `hd_cam_ket` (xem dòng 4156 holdem_api.ts), không còn '
    + 'là action_type riêng — 0 chỗ ghi trong code hiện hành.',
  hd_chay: 'v0.1 Đấu trường (migration 0010: "cháy tài khoản") — nay là trạng thái `da_chay`/`con_song` '
    + 'trong sơ đồ ghế + nhãn `fx` (không phải event riêng); phản ánh qua `hd_match_end.xep_hang`. '
    + '0 chỗ ghi trong code hiện hành.',
  bxh_xem: 'thêm cùng đợt rank (migration 0017, cạnh `rank_diem_thay_doi`/`rank_len_bac`/`rank_tut_bac`) '
    + 'nhưng "xem bảng xếp hạng" chưa từng có route ghi nó — 0 chỗ ghi trong code hiện hành. Có thể là '
    + 'ca A9 lẽ ra thuộc `telemetry` (xem thao tác) chứ không phải `events` (có tiền/niềm tin).',
  nv_xong: 'thêm cùng đợt nhiệm vụ (migration 0016: "một việc chuyển sang xong, kèm cửa sổ") — ba loại '
    + 'anh em cùng đợt (`nv_diem_danh`, `nv_view`, `bp_chang_nhan`) đều có code viết thật, riêng loại '
    + 'này thì không — 0 chỗ ghi trong code hiện hành.',
  subsidy_claim: 'CATALOGUE GỐC v0.1 (A7 trong CLAUDE.md trước 01/09, migration 0001) liệt `checkin` '
    + '(nhận trợ cấp) VÀ `subsidy_claim` là HAI mục tách biệt; code thật hợp nhất làm MỘT — '
    + '`server/subsidy.ts` ghi `action_type = \'checkin\'` cho toàn bộ luồng trợ cấp. Hai chỗ nhắc tới '
    + 'chuỗi `\'subsidy_claim\'` hôm nay (`server/hanh_vi/kho.ts`, `server/hanh_vi/trai.ts`) là nhãn cấu '
    + 'hình của bộ chấm hồ sơ hành vi, KHÔNG phải câu INSERT — 0 chỗ ghi thật trong code hiện hành.',
};

interface TuyChonVong {
  giauDu?: boolean;
}

/** Chơi một trận từ vòng 1 tới hết, hành động XOAY VÒNG cố định (không random). */
async function choiTran(
  reqU: (path: string, init?: RequestInit) => Promise<Response>,
  matchId: string, seed: number, soO: number, tuy: TuyChonVong,
): Promise<void> {
  const HANH_DONG = ['giu_vi_the', 'tang_cam_ket', 'cat_lo', 'dung_ngoai'] as const;
  let shop: string[] | undefined;
  for (let vong = 1; vong <= soO; vong += 1) {
    const body: Record<string, unknown> = {
      vong, hanh_dong: HANH_DONG[(vong - 1) % HANH_DONG.length], khao_sat_lai: 0,
    };
    if (tuy.giauDu) {
      if (shop && shop.length > 0) body.mua = shop.slice(0, 2);
      // Gửi CỐ ĐỊNH mỗi vòng — engine từ chối thì event vẫn ghi (ok:false + loi),
      // "ý định cũng là dữ liệu" (comment holdem_api.ts quanh dòng 4249). Không
      // cần đúng luật đặc quyền, chỉ cần đúng CẤU TRÚC để qua tầng nhận.
      body.dao = { tu: MA_DAO_TU, den: MA_DAO_DEN };
      body.khoa = MA_KHOA;
      body.short = MA_SHORT;
      // `mua_duoi` có pham_vi 'tai_san' (config/holdem.ts) — gán vào 'btc' để
      // thử giữ một vị thế thật (đích: hd_brier_vong cần dự báo ≠ toàn tiền mặt).
      body.gan = { mua_duoi: MA_DAO_TU };
      if (laVongKyNgo(vong, soO)) {
        const moi = boNhiemVuMoi(seed, vong);
        if (moi.length > 0) body.ky_ngo = moi[0];
      }
      // Bảng điện tử — endpoint RIÊNG, gọi TRƯỚC khi nộp vòng (giá bán thông tin
      // đóng cửa sau khi vòng nộp). Nguồn của `hd_mo_bang`.
      const rBang = await reqU(`/api/v1/holdem/matches/${matchId}/bang-dien-tu`, {
        method: 'POST', body: JSON.stringify({ vong }),
      });
      if (rBang.status !== 200) {
        throw new Error(`POST /bang-dien-tu vòng ${vong} (match ${matchId}) trả ${rBang.status}: `
          + `${await rBang.text()}`);
      }
    }
    const r = await reqU(`/api/v1/holdem/matches/${matchId}/rounds`, {
      method: 'POST', body: JSON.stringify(body),
    });
    if (r.status !== 200) {
      throw new Error(`POST /rounds vòng ${vong} (match ${matchId}) trả ${r.status}: ${await r.text()}`);
    }
    const rj = await r.json() as { xong?: boolean; shop?: { tai_san?: string[] } };
    shop = rj.shop?.tai_san;
    if (rj.xong) return;
  }
}

async function main(): Promise<void> {
  const db = await startTestDb();
  const pool = db.pool;
  await ensureGenesis(pool);

  const app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: TICK_SECRET, secureCookie: false,
  });

  function reqFor(cookie: string) {
    return async (path: string, init: RequestInit = {}): Promise<Response> => app.request(
      `http://localhost${path}`,
      { ...init, headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) } },
    );
  }

  async function taoTran(
    reqU: (path: string, init?: RequestInit) => Promise<Response>, soO?: number,
  ): Promise<{ matchId: string; seed: number; soGhe: number }> {
    const body: Record<string, unknown> = soO ? { so_o: soO } : {};
    const r = await reqU('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify(body) });
    if (r.status !== 201) throw new Error(`POST /matches so_o=${soO ?? '(mặc định)'} trả ${r.status}: ${await r.text()}`);
    const b = await r.json() as { match_id: string };
    const { rows } = await pool.query(
      `SELECT seed, jsonb_array_length(ghe_json) AS so_ghe FROM holdem_matches WHERE match_id = $1`,
      [b.match_id]);
    return { matchId: b.match_id, seed: Number(rows[0].seed), soGhe: Number(rows[0].so_ghe) };
  }

  console.log('=== B3 — đo state_snapshot_json thật theo action_type ===\n');

  // ── User 1: mở khoá map 16 (cần ≥8 trận xong), rồi chơi trận LỚN NHẤT ──────
  const u1 = await createTestUser(pool, { handle: 'snapu1' });
  const reqU1 = reqFor(u1.cookie);

  console.log('[1/4] Mở khoá map 16 — chơi 8 trận map 8 (nhanh, hành động tối giản)…');
  for (let i = 0; i < 8; i += 1) {
    const t = await taoTran(reqU1, 8);
    await choiTran(reqU1, t.matchId, t.seed, 8, {});
  }

  console.log('[2/4] Tìm bàn map 16 ra ĐÚNG 8 ghế (SO_GHE_MAX) — thử tối đa 20 lần…');
  const SO_LAN_TIM_TOI_DA = 20;
  let hero: { matchId: string; seed: number; soGhe: number } | null = null;
  const gheDaThay: number[] = [];
  for (let i = 0; i < SO_LAN_TIM_TOI_DA; i += 1) {
    const t = await taoTran(reqU1, 16);
    gheDaThay.push(t.soGhe);
    if (!hero || t.soGhe > hero.soGhe) hero = t;
    if (t.soGhe === SO_GHE_MAX) break;
  }
  if (!hero) throw new Error('không tạo được trận map 16 nào — hỏng thiệt');
  if (hero.soGhe !== SO_GHE_MAX) {
    console.log(`  ⚠ KHÔNG tìm được bàn ${SO_GHE_MAX} ghế trong ${SO_LAN_TIM_TOI_DA} lần thử `
      + `(ghế thấy được: [${gheDaThay.join(', ')}]) — dùng bàn ${hero.soGhe} ghế lớn nhất tìm được. `
      + `Đây là hên-xui của seed random server (SO_GHE_MIN..MAX = 4..8, tất định theo seed nhưng seed `
      + `random ngoài tầm script), không phải lỗi script; chạy lại có thể ra 8 ghế ngay lần đầu.`);
  } else {
    console.log(`  ✓ tìm được bàn ${SO_GHE_MAX} ghế sau ${gheDaThay.length} lần thử.`);
  }

  console.log(`[3/4] Chơi trận LỚN NHẤT: map 16, ${hero.soGhe} ghế, đủ dao/khoa/short/kỳ ngộ mỗi vòng…`);
  await choiTran(reqU1, hero.matchId, hero.seed, 16, { giauDu: true });

  // ── User 2: trận hết hạn (hd_tran_het_han) — lùi đồng hồ rồi gọi tick THẬT ──
  console.log('[4/4] Trận hết hạn (hd_tran_het_han) qua /internal/tick thật…');
  const u2 = await createTestUser(pool, { handle: 'snapu2' });
  const tHetHan = await taoTran(reqFor(u2.cookie), 8);
  // Không đợi 45 phút thật: lùi mốc mở vòng ra sau lưng luật hạn trận. Sự kiện vẫn
  // ghi qua ĐÚNG đường code thật (quetTranQuaHan → dongTranQuaHan), chỉ có tiền đề
  // "đã quá hạn" là giả lập — không có cách nào khác để test một luật theo ĐỒNG HỒ
  // THẬT mà không chờ đồng hồ thật trôi.
  await pool.query(
    `UPDATE holdem_matches SET vong_mo_luc = now() - interval '2 hours' WHERE match_id = $1`,
    [tHetHan.matchId]);
  const rTick = await app.request('http://localhost/api/v1/internal/tick', {
    method: 'POST', headers: { 'x-tick-secret': TICK_SECRET },
  });
  if (rTick.status !== 200) throw new Error(`POST /internal/tick trả ${rTick.status}: ${await rTick.text()}`);

  // ── User 3: checkin (trợ cấp) — action_type ngoài Đấu trường, rẻ để đo thêm ──
  console.log('[bonus] checkin (subsidy claim) — action_type ngoài Đấu trường…');
  const u3 = await createTestUser(pool, { handle: 'snapu3', bankroll: 400 });
  const rSub = await reqFor(u3.cookie)('/api/v1/subsidy/claim', { method: 'POST', body: '{}' });
  if (rSub.status !== 200) throw new Error(`POST /subsidy/claim trả ${rSub.status}: ${await rSub.text()}`);

  // ── ĐO: toàn bộ tính bằng SQL trên dữ liệu vừa ghi ─────────────────────────
  const { rows: thongKe } = await pool.query<{
    action_type: string; n: number; n_snap: number;
    snap_min: number | null; snap_p50: number | null; snap_p95: number | null; snap_max: number | null;
    row_min: number; row_p50: number; row_p95: number; row_max: number;
  }>(`
    SELECT
      action_type,
      count(*)::int AS n,
      count(*) FILTER (WHERE state_snapshot_json IS NOT NULL)::int AS n_snap,
      min(octet_length(state_snapshot_json::text)) AS snap_min,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY octet_length(state_snapshot_json::text)))::int AS snap_p50,
      round(percentile_cont(0.95) WITHIN GROUP (ORDER BY octet_length(state_snapshot_json::text)))::int AS snap_p95,
      max(octet_length(state_snapshot_json::text)) AS snap_max,
      min(octet_length(row_to_json(events)::text))::int AS row_min,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY octet_length(row_to_json(events)::text)))::int AS row_p50,
      round(percentile_cont(0.95) WITHIN GROUP (ORDER BY octet_length(row_to_json(events)::text)))::int AS row_p95,
      max(octet_length(row_to_json(events)::text))::int AS row_max
    FROM events
    GROUP BY action_type
    ORDER BY row_max DESC NULLS LAST
  `);

  console.log('\n### Bảng đo (byte) — sắp theo row_max giảm dần\n');
  console.log('| action_type | n | n_snap | snap_min | snap_p50 | snap_p95 | snap_max | row_min | row_p50 | row_p95 | row_max |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of thongKe) {
    const s = (v: number | null): string => (v === null ? '—' : String(v));
    console.log(`| ${r.action_type} | ${r.n} | ${r.n_snap} | ${s(r.snap_min)} | ${s(r.snap_p50)} `
      + `| ${s(r.snap_p95)} | ${s(r.snap_max)} | ${r.row_min} | ${r.row_p50} | ${r.row_p95} | ${r.row_max} |`);
  }

  const tongDong = thongKe.reduce((s, r) => s + r.n, 0);
  console.log(`\nTổng số dòng \`events\` đã ghi trong lần đo này: ${tongDong}`);
  console.log('snap_* = octet_length(state_snapshot_json::text) — "—" nghĩa là loại này KHÔNG dùng cột đó '
    + '(luôn NULL), không phải đo hỏng. row_* = octet_length(row_to_json(events)::text), tức TOÀN BỘ dòng '
    + '(mọi cột, kể cả value_json) — số này mới là số quyết định dung lượng đĩa thật.');

  // ── Đối chiếu với danh mục DB (nguồn chân lý) ──────────────────────────────
  const danhMuc = await docDanhMucActionType(pool);
  const daDo = new Set(thongKe.map((r) => r.action_type));
  const chuaDo = danhMuc.filter((t) => !daDo.has(t));

  console.log(`\n### Danh mục DB: ${danhMuc.length} action_type. Đo được: ${daDo.size}. `
    + `CHƯA đo được: ${chuaDo.length}.\n`);
  if (chuaDo.length > 0) {
    console.log('| action_type | vì sao chưa đo được |');
    console.log('|---|---|');
    for (const t of chuaDo) {
      console.log(`| ${t} | ${LY_DO_KHONG_DO[t] ?? '⚠ CHƯA CÓ LÝ DO GHI SẴN — cập nhật LY_DO_KHONG_DO trong script này'} |`);
    }
  }
  const khongCoLyDo = chuaDo.filter((t) => !LY_DO_KHONG_DO[t]);
  if (khongCoLyDo.length > 0) {
    console.log(`\n⚠⚠ ${khongCoLyDo.length} loại chưa đo được KHÔNG có lý do ghi sẵn trong script: `
      + `${khongCoLyDo.join(', ')} — đây là action_type MỚI kể từ lần viết script này, cần bổ sung lý do.`);
  }

  await db.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ Script lỗi:', err);
  process.exit(1);
});
