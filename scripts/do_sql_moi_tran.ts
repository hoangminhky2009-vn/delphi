/**
 * ĐO SỐ CÂU SQL MỖI TRẬN — bước 0 của task A3 (03/09/2026, phương án A3-1).
 *
 * Chạy: npx tsx scripts/do_sql_moi_tran.ts
 *
 * ─── VÌ SAO ĐO CÁI NÀY ──────────────────────────────────────────────────────
 * Đích bậc thang kế tiếp là Cloudflare Workers + Hyperdrive, và Hyperdrive gói
 * free chỉ cho **100.000 truy vấn DB/ngày**. Số CÂU SQL một trận Market Hold'em
 * tiêu tốn là mẫu số trực tiếp của "một ngày gánh được bao nhiêu trận" — số này
 * nhân với số trận/ngày kỳ vọng để biết có chạm trần Hyperdrive trước khi chạm
 * trần nào khác không.
 *
 * ─── CÁCH ĐO — VÀ MỘT BÀI HỌC ĐO LƯỜNG GIỮA CHỪNG ──────────────────────────
 * Đề bài xin bọc `pool.query` + bọc `pool.connect` (Proxy) để đếm cả
 * `PoolClient.query`. Bản ĐẦU làm đúng y vậy — và ra một con số VÔ LÝ: số câu
 * SQL/vòng TĂNG DẦN theo số vòng (16 · 26 · 36 · 46…), như thể trận nhớ lại
 * toàn bộ lịch sử mỗi lần nộp. Rà bằng stack trace (`new Error().stack` chèn
 * tạm vào bộ đếm) lộ ra: đó KHÔNG PHẢI hành vi của app — là lỗi CỦA PHÉP ĐO.
 *
 * Hai lớp lỗi chồng nhau:
 *  1. `pool.connect()` (kiểu promise) trả về CLIENT TÁI SỬ DỤNG từ pool idle —
 *     đúng MỘT object `Client` cho nhiều lần `connect()` khác nhau (đó chính
 *     là lý do một pool tồn tại). Bọc `client.query` mỗi lần connect() mà
 *     không đánh dấu "đã bọc" thì lần connect() thứ hai bọc CHỒNG lên bản bọc
 *     lần một, lần ba chồng lên lần hai… N lớp đếm cho một câu SQL thật.
 *  2. Method-level, `pg-pool`'s `Pool.prototype.query()` (dùng bởi
 *     `resolveSession(pool, ...)`, `layTran(id, uid)` mặc định `db=pool`) gọi
 *     NỘI BỘ `this.connect(callback)` (kiểu CALLBACK, xem
 *     node_modules/pg-pool/index.js:449) rồi tự chạy `client.query(...)` trên
 *     client mượn được — CÙNG client đã bị lớp (1) bọc từ một lần connect()
 *     promise-style TRƯỚC ĐÓ trong request. Kết quả: một cú `pool.query()` bị
 *     đếm HAI LẦN (một ở chỗ bọc `pool.query`, một ở chỗ bọc `client.query`
 *     của client tái sử dụng).
 *
 * ⇒ SỬA bằng cách bọc Ở ĐÚNG MỘT ĐIỂM DUY NHẤT, thấp nhất có thể:
 * `pg.Client.prototype.query`. Mọi câu SQL thật — dù đi qua `pool.query()`
 * hay qua `pool.connect()` + `client.query()` — RỐT CUỘC đều chạy qua đúng
 * phương thức này đúng MỘT lần trên prototype dùng chung, nên không còn chỗ
 * nào để đếm chồng hay đếm hụt. Đây là cách bọc CHẶT hơn đề bài gợi ý (Proxy
 * trên `pool.connect`), không phải làm khác đi cho vui — số liệu bản đầu (đã
 * loại) từng chỉ ra sai HƯỚNG (trần Hyperdrive tưởng ~71 trận/ngày, thật ra
 * xa hơn NHIỀU — xem bảng cuối file).
 *
 * `startTestDb()` (embedded Postgres, `tests/helpers/testdb.ts`) chạy
 * migrations TRƯỚC khi patch này áp dụng — chi phí migration KHÔNG lẫn vào số
 * đo, đúng ý muốn (cần chi phí ỔN ĐỊNH của một trận đang chạy, không phải chi
 * phí một lần dựng DB).
 *
 * Lái qua ĐÚNG app Hono thật (`createApp` — `server/app.ts`) bằng `app.request`,
 * y hệt cách `tests/holdem_api.test.ts` làm (`choiHetTran`) — không tự bịa một
 * đường gọi engine tắt qua HTTP.
 *
 * "Tạo user": dùng fixture `createTestUser` (`tests/helpers/fixtures.ts`) — CÙNG
 * lối tắt mà chính bộ test hiện có dùng để test Đấu trường, có lý do ghi rõ
 * trong fixture đó (argon2id ~100ms/hash làm test chậm không cần thiết). Nghĩa
 * là dòng "tạo user" trong bảng dưới đo con đường SQL trực tiếp (users +
 * wallet_ledger + auth_accounts + auth_sessions, bọc trong 1 transaction),
 * KHÔNG PHẢI phễu đăng ký thật (`POST /auth/register` → email xác minh →
 * `POST /auth/verify-email` → `POST /auth/login` → onboard) — phễu đó tốn thêm
 * nhưng là chi phí MỘT LẦN mỗi người dùng mới, không lặp lại mỗi trận, nên
 * không phải mẫu số đang cần (mẫu số cần là "mỗi trận tốn bao nhiêu", và người
 * chơi thật chỉ đăng ký một lần rồi chơi nhiều trận).
 *
 * "Đọc kết quả": `GET /matches/:id/autopsy` — endpoint "mổ xẻ SAU trận", đúng
 * nghĩa "read result" (khác `GET /matches/:id` là đọc TRẠNG THÁI SỐNG giữa trận).
 */
import pg from 'pg';
import { startTestDb } from '../tests/helpers/testdb.js';
import { createTestUser } from '../tests/helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { HOLDEM_DECISIONS } from '../config/holdem.js';

async function main(): Promise<void> {
  const db = await startTestDb();
  const pool = db.pool;

  // ── Đếm câu SQL: MỘT điểm bọc duy nhất, thấp nhất có thể — xem docstring ──
  let demCau = 0;
  const nhatKy: { nhan: string; sql: string }[] = [];
  let dangGhi: string | null = null;
  const gocClientQuery = pg.Client.prototype.query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pg.Client.prototype as any).query = function (this: pg.Client, ...args: unknown[]) {
    demCau += 1;
    if (dangGhi) {
      nhatKy.push({ nhan: dangGhi, sql: String(args[0] ?? '').trim().slice(0, 60).replace(/\s+/g, ' ') });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (gocClientQuery as any).apply(this, args);
  };

  const app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-secret-sql-cost', secureCookie: false,
  });

  const dsAction: { nhan: string; cau: number }[] = [];
  const doTrong = async (nhan: string, viec: () => Promise<void>): Promise<void> => {
    const truoc = demCau;
    dangGhi = nhan;
    await viec();
    dangGhi = null;
    dsAction.push({ nhan, cau: demCau - truoc });
  };

  let user: Awaited<ReturnType<typeof createTestUser>> | undefined;
  await doTrong('tao_user (fixture SQL, KHÔNG qua /register thật)', async () => {
    user = await createTestUser(pool, { handle: 'sqlcost' });
  });
  const u = user!;

  async function req(path: string, init: RequestInit = {}): Promise<Response> {
    return app.request(`http://localhost${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', cookie: u.cookie, ...(init.headers ?? {}) },
    });
  }

  let matchId = '';
  let shopVongSau: { tai_san?: string[] } | undefined;
  await doTrong('POST_matches (map 8)', async () => {
    const r = await req('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ so_o: 8 }),
    });
    if (r.status !== 201) {
      throw new Error(`POST /matches trả ${r.status}: ${await r.text()}`);
    }
    const b = await r.json() as { match_id: string; shop?: { tai_san?: string[] } };
    matchId = b.match_id;
    shopVongSau = b.shop;
  });

  const soVongDaDi: number[] = [];
  await doTrong('submit_TAT_CA_vong (tổng)', async () => {
    for (let v = 1; v <= HOLDEM_DECISIONS.MAP_SIZE; v += 1) {
      const truocVong = demCau;
      const r = await req(`/api/v1/holdem/matches/${matchId}/rounds`, {
        method: 'POST',
        body: JSON.stringify({
          vong: v, khao_sat_lai: 0,
          mua: shopVongSau?.tai_san?.[0] ?? null,
          hanh_dong: 'giu_vi_the', them: 0,
        }),
      });
      if (r.status !== 200) {
        throw new Error(`POST /rounds vòng ${v} trả ${r.status}: ${await r.text()}`);
      }
      const rj = await r.json() as { xong?: boolean; shop?: { tai_san?: string[] } };
      shopVongSau = rj.shop;
      soVongDaDi.push(demCau - truocVong);
      if (rj.xong) break;
    }
  });

  await doTrong('GET_autopsy (đọc kết quả)', async () => {
    const r = await req(`/api/v1/holdem/matches/${matchId}/autopsy`);
    if (r.status !== 200) {
      throw new Error(`GET /autopsy trả ${r.status}: ${await r.text()}`);
    }
    await r.json();
  });

  const tongCaTran = dsAction.reduce((s, a) => s + a.cau, 0);

  console.log('ĐO SỐ CÂU SQL MỖI TRẬN — Market Hold\'em, map 8 ô, qua HTTP thật (Hono)');
  console.log('');
  console.log('| hành động | số câu SQL |');
  console.log('|---|---|');
  for (const a of dsAction) console.log(`| ${a.nhan} | ${a.cau} |`);
  console.log(`| **TỔNG một trận** | **${tongCaTran}** |`);
  console.log('');
  console.log(`Số vòng đã chơi: ${soVongDaDi.length} (map 8 → tối đa 8 vòng)`);
  console.log(`Câu SQL mỗi vòng nộp: [${soVongDaDi.join(', ')}] `
    + `(trung bình ${(soVongDaDi.reduce((a, b) => a + b, 0) / soVongDaDi.length).toFixed(2)})`);
  console.log('');

  const TRAN_HYPERDRIVE_NGAY = 100_000;
  const uocTranMoiNgay = Math.floor(TRAN_HYPERDRIVE_NGAY / tongCaTran);
  console.log(`Ước tính trần Hyperdrive free (${TRAN_HYPERDRIVE_NGAY.toLocaleString('vi')} truy vấn/ngày) `
    + `÷ ${tongCaTran} câu/trận ≈ ${uocTranMoiNgay.toLocaleString('vi')} TRẬN/NGÀY tối đa `
    + '(giả định KHÔNG có truy vấn nào khác cạnh tranh cùng ngân sách — sảnh, hồ sơ, admin, '
    + 'PFM… đều CHƯA tính; đây là TRẦN TRÊN lý thuyết, không phải dự báo).');

  console.log('');
  console.log('⚠ GIỚI HẠN: đo trên 1 trận (Postgres embedded cục bộ, không phải Hyperdrive/Supabase');
  console.log('  thật) — số CÂU SQL không đổi theo hạ tầng chạy nó (cùng code, cùng câu lệnh), nhưng');
  console.log('  ĐỘ TRỄ mỗi câu thì có (RTT tới Hyperdrive khác RTT tới Postgres cục bộ). "Tạo user"');
  console.log('  đo đường fixture, không phải phễu đăng ký thật — xem docstring đầu file.');

  if (process.env['DEBUG_SQL']) {
    console.log('\n(DEBUG_SQL=1) — nhật ký từng câu:');
    for (const n of nhatKy) console.log(`  [${n.nhan}] ${n.sql}`);
  }

  await db.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error('✗ Script lỗi:', err);
  process.exit(1);
});
