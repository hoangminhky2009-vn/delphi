/**
 * ID SAI ĐỊNH DẠNG ⇒ 404, KHÔNG BAO GIỜ 500.
 *
 * Mọi cột id của ta là kiểu `uuid`. Đưa thẳng một chuỗi rác vào `WHERE id = $1`
 * thì Postgres KHÔNG trả 0 dòng — nó NÉM `22P02` ("invalid input syntax for
 * type uuid"), không ai bắt, `app.onError` trả 500.
 *
 * Trước 16/08 chuyện đó chỉ là sai mã lỗi (vô hại về dữ liệu: câu SELECT thuần,
 * không ghi gì). Từ D93 nó có giá THẬT: Sentry đã cắm điện trên prod nên mỗi cú
 * 500 là một event, mà free tier chỉ 5.000 error/tháng — chuông kêu vì chuyện
 * KHÔNG PHẢI SỰ CỐ thì người ta học cách phớt lờ nó, và đó là cách hỏng đắt
 * nhất của cái vừa lắp. Bài này canh cái đó.
 *
 * ⚠ Đo prod 16/08: mọi route `:id` nằm sau `requireAuth` ⇒ không phiên là 401,
 * nên đây KHÔNG phải lỗ cho kẻ quét vô danh (câu "một con quét URL bừa" của
 * D93 nói quá — xem `server/uuid.ts`). Nó là chuyện của người ĐÃ ĐĂNG NHẬP mở
 * link cũ. Vì vậy §II dưới đây phải đăng nhập mới đo được gì.
 *
 * ⚠ HAI TẦNG, CÓ CHỦ ĐÍCH — bỏ tầng nào cũng hở:
 *   §I  ĐÍCH DANH đường đã hỏng (`GET /holdem/matches/:id`), khoá cả mã lỗi lẫn
 *       câu chữ. Đây là bài sẽ đỏ nếu ai gỡ phép kiểm trong `layTran`.
 *   §II CẢ LỚP — liệt kê route có `:id` từ BẢNG ROUTE THẬT của Hono, không gõ
 *       tay. Route `:id` thêm sau này mà quên chặn là ĐỎ NGAY, không phải chờ
 *       ai đó nhớ ra phải bổ sung một dòng vào danh sách (nếp D79).
 *
 * ⚠ §II đăng nhập bằng ADMIN ĐÃ QUA 2FA chứ không phải user thường, và đó là
 * điều kiện để bài không XANH GIẢ: route `/admin/*` bị cổng 2FA chặn ở 403
 * TRƯỚC khi chạm DB, nên chạy bằng user thường thì cả 10 route admin "đạt" mà
 * chưa từng đi tới câu query — đúng lớp lỗi D62 (bài test xanh mãi mãi mà chưa
 * bao giờ chạm thứ nó mang tên). ĐÃ ĐO 16/08: user thường ⇒ cả 10 route admin
 * trả 403; admin đã 2FA ⇒ chúng trả 404, tức đi tới đúng phép kiểm id.
 *
 * ⚠⚠ §II TỪNG CÓ MỘT LỖ, ĐÃ BỊT — giữ chuyện này lại vì nó là cách bài test
 * chết mà không ai hay. Bản đầu chỉ khoá `!== 500`. Đo 19 route `:id` thì 16
 * route đi tới phép kiểm id (404), còn BA route soi body/query TRƯỚC nên với
 * thân rỗng chúng dừng ở 400 — `preview-resolve` · `resolve` · `khop-lenh`.
 * Với hình dạng đó, gỡ phép kiểm uuid mà bài VẪN XANH: tiêm vào `admin_keo`
 * thì 400 của `kiemThanKeo` che mất, và mũi tiêm trượt.
 *
 * Bịt bằng hai nước, xem `PHU_KIEN` và `NGOAI_LE_400` ở §II:
 *   1. cấp phụ kiện để đi qua phép kiểm KHÁC ⇒ cú gỡ rơi xuống câu SQL ⇒ 500;
 *   2. mặc định phải 404, khác thì phải KHAI TÊN ⇒ cú gỡ nào bị một tầng 400
 *      che mất vẫn lộ ra vì status tụt khỏi 404.
 * Tiêm lại: gỡ guard `admin_keo` ⇒ ĐỎ (đúng mũi từng lọt); gỡ guard
 * `preview-resolve` (một route NGOẠI LỆ) ⇒ ĐỎ qua vế 500 — ngoại lệ không phải
 * cửa miễn trừ.
 *
 * ⇒ Nay §II khoá được câu MẠNH: **mọi route `:id` đều tới phép kiểm id, và
 * không route nào trả 500 với id rác.** Nhưng đừng đọc thành "không thể hở
 * nữa": nó chỉ chặt bằng `PHU_KIEN`. Route mới soi body theo kiểu chưa có ở
 * đây vẫn cần một dòng phụ kiện — và luật "404 hoặc khai tên" chính là thứ
 * BUỘC người thêm route phải đối diện chuyện đó thay vì lặng lẽ đi qua.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;
let admin: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-secret-id', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
  admin = await createTestUser(pool, { role: 'admin' });
  await moCuaAdmin(pool, admin);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function goi(
  path: string, opts: { method?: string; cookie?: string; body?: unknown } = {},
): Promise<Response> {
  const method = opts.method ?? 'GET';
  return app.request(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: opts.cookie ?? user.cookie },
    // GET/HEAD không mang được body — undici ném TRƯỚC cả khi tới route.
    ...(method === 'GET' || method === 'HEAD'
      ? {} : { body: JSON.stringify(opts.body ?? {}) }),
  });
}

/** `Response.json()` trả `unknown` dưới `strict` — một cửa ép kiểu, không rải. */
const doc = async (r: Response): Promise<any> => r.json();

/**
 * Vài hình dạng rác khác nhau. Không phải để "thử cho nhiều" — mỗi cái hỏng ở
 * một chỗ khác trong bộ parse uuid của Postgres (không phải hex · thiếu gạch ·
 * hụt một ký tự · rỗng-sau-khi-cắt), và một phép kiểm cẩu thả có thể lọt cái
 * này mà chặn cái kia.
 */
const ID_RAC = [
  'khong-phai-uuid',
  '123',
  '00000000000000000000000000000000',
  '00000000-0000-4000-8000-00000000000',   // hụt đúng MỘT ký tự
  'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz',  // đúng khuôn nhưng không phải hex
];

/** UUID hợp lệ nhưng chắc chắn không tồn tại — mốc đối chứng của §I. */
const ID_KHONG_CO = '00000000-0000-4000-8000-000000000000';

// ═══════════════════════════════════════════════════════════════════════════
describe('I. GET /holdem/matches/:id — id rác trả 404 y như id không tồn tại', () => {
  it('id không tồn tại (UUID hợp lệ) → 404 not_found', async () => {
    const r = await goi(`/api/v1/holdem/matches/${ID_KHONG_CO}`);
    expect(r.status).toBe(404);
    expect((await doc(r)).error).toBe('not_found');
  });

  it('id SAI ĐỊNH DẠNG → 404 not_found, KHÔNG phải 500', async () => {
    for (const id of ID_RAC) {
      const r = await goi(`/api/v1/holdem/matches/${encodeURIComponent(id)}`);
      const body = await doc(r);
      expect(r.status, id).toBe(404);
      expect(body.error, id).toBe('not_found');
      // Cùng MỘT câu trả lời cho cả hai cách "không có trận này": người gõ nhầm
      // id không được suy ra ta lưu id bằng kiểu gì.
      expect(body.message, id).toBe('Không thấy trận này.');
    }
  });

  /**
   * Cả sáu route `:id` của holdem đi CHUNG một cửa `layTran`, nên đây là bài
   * canh "không ai mở đường vòng" chứ không phải sáu phép kiểm rời.
   *
   * ⚠ `/khop-lenh` phải gửi một `lenh` HỢP LỆ: nó soi body TRƯỚC khi tra id, nên
   * body rỗng ăn 400 `lenh_rong` và bài sẽ xanh mà chưa từng chạm `layTran` —
   * "không phải 500" là thật nhưng không chứng minh được điều mình đang nói.
   */
  it('mọi route holdem có :id đều 404 (không route nào sót)', async () => {
    const duong: Array<[string, string, unknown?]> = [
      ['GET', ''],
      ['GET', '/shop'],
      ['GET', '/autopsy'],
      ['POST', '/rounds'],
      ['POST', '/khop-lenh', { vong: 1, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] }],
      ['POST', '/bang-dien-tu'],
    ];
    for (const [method, duoi, body] of duong) {
      const r = await goi(`/api/v1/holdem/matches/khong-phai-uuid${duoi}`, {
        method, ...(body === undefined ? {} : { body }),
      });
      expect(r.status, `${method} …${duoi}`).toBe(404);
      expect((await doc(r)).error, `${method} …${duoi}`).toBe('not_found');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. CẢ LỚP — không route :id nào trả 500 với id rác', () => {
  /**
   * Đọc từ bảng route THẬT của Hono (tiền lệ `admin_2fa.test.ts` §II). Gõ tay
   * danh sách thì route thêm sau này lọt ra ngoài phép kiểm — mà chỗ thủng của
   * chính bug này là chỗ QUÊN, không phải chỗ làm sai.
   */
  const routeCoId = (): Array<{ method: string; path: string }> => {
    const thay = new Set<string>();
    return ((app as any).routes as Array<{ method: string; path: string }>)
      .filter((r) => r.path.includes(':id') && r.method !== 'ALL')
      .filter((r) => {
        const k = `${r.method} ${r.path}`;
        if (thay.has(k)) return false;
        thay.add(k);
        return true;
      })
      .map((r) => ({ method: r.method, path: r.path }));
  };

  it('phát hiện được route :id ở cả bốn cụm (holdem · admin · admin_keo · markets)', () => {
    const ds = routeCoId();
    const paths = ds.map((r) => r.path);
    // Không khoá con số chính xác — thêm route là chuyện thường, và một bài test
    // đỏ mỗi lần thêm route thì sẽ bị sửa cho xanh chứ không ai đọc nó canh gì.
    expect(ds.length).toBeGreaterThanOrEqual(15);
    expect(paths.some((p) => p.startsWith('/api/v1/holdem/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('/api/v1/admin/'))).toBe(true);
    expect(paths.some((p) => p.startsWith('/api/v1/markets/'))).toBe(true);
  });

  /**
   * PHỤ KIỆN ĐỂ ĐI QUA CÁC PHÉP KIỂM *KHÁC* — không phải để test chạy cho xanh.
   *
   * Ba route dưới đây soi body/query nên với thân rỗng chúng dừng ở 400 TRƯỚC
   * khi tra id. Không cấp phụ kiện thì gỡ phép kiểm uuid của chúng mà bài VẪN
   * XANH — đã tiêm thử và trúng đúng chỗ đó. Cấp đủ phụ kiện thì cú gỡ rơi
   * thẳng xuống câu SQL và bật ra 500, tức bài lại có răng.
   *
   * ⚠ Mọi phụ kiện dùng id RÁC ở `:id` và UUID hợp lệ ở các trường khác — nên
   * không cú nào chạm được một dòng dữ liệu thật, kể cả `resolve`.
   */
  const PHU_KIEN: Record<string, { than?: unknown; query?: string }> = {
    'POST /api/v1/holdem/matches/:id/khop-lenh': {
      than: { vong: 1, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] },
    },
    // D466 — cú bấm màn minigame soi NÚT trước (400 `nut_sai`) rồi mới tới trận ⇒ cấp một nút có thật để đi tới phép kiểm id.
    'POST /api/v1/holdem/matches/:id/minigame/:vong/lenh': {
      than: { nhip: 0, nut: 'vao_het' },
    },
    'GET /api/v1/admin/markets/:id/preview-resolve': {
      query: `?outcome_option_id=${ID_KHONG_CO}`,
    },
    'POST /api/v1/admin/markets/:id/resolve': {
      than: {
        outcome_option_id: ID_KHONG_CO,
        evidence_url: 'https://nguon.test/cong-bo',
        confirm_code: 'KHONG-KHOP',
      },
    },
  };

  /**
   * Route trả 400 THAY VÌ 404 một cách CÓ CHỦ ĐÍCH — phải ghi lý do ở đây.
   *
   * ⭐ HIỆN RỖNG, và đó là một phát biểu chứ không phải chỗ chưa điền: **cả 19
   * route `:id` trả CÙNG một câu cho id sai hình dạng.** Hai route resolve
   * từng ở đây (chúng gộp `market_id` + `outcome_option_id` vào một câu 400)
   * — tách ra 16/08, nay `:id` sai ⇒ 404 như cả nhà, còn `outcome_option_id`
   * sai vẫn 400 kèm tên trường. Ranh giới: đường dẫn định danh TÀI NGUYÊN,
   * body/query là TRƯỜNG NHẬP.
   *
   * Để map này lại (thay vì xoá) vì nó là cái van: route sau muốn trả khác
   * 404 thì phải khai tên vào đây, tức phải viết ra lý do cho người kế tiếp
   * đọc — không có cửa lặng lẽ đi qua.
   */
  const NGOAI_LE_400: Record<string, string> = {};

  /**
   * ⚠⚠ HAI PHÉP KIỂM, VÀ CÁI THỨ HAI MỚI LÀ CÁI CÓ RĂNG.
   *
   * (a) `!== 500` là bất biến thật (mỗi 500 là một event Sentry — D93).
   * (b) `=== 404 trừ khi được KHAI TÊN` là thứ bắt được cú gỡ phép kiểm ngay
   *     cả khi một tầng validate khác che mất 500: gỡ guard ở `admin_keo` thì
   *     route tụt từ 404 xuống 400 của `kiemThanKeo`, mà 400 không có tên
   *     trong `NGOAI_LE_400` ⇒ ĐỎ. Trước khi có (b), đúng cú tiêm đó lọt.
   * Route `:id` mới thêm sau này cũng bị (b) ép: hoặc trả 404 như cả nhà,
   * hoặc phải khai ra vì sao mình khác — không có cửa im lặng.
   */
  it('id rác ⇒ không route nào 500, và mặc định phải là 404', async () => {
    for (const r of routeCoId()) {
      const khoa = `${r.method} ${r.path}`;
      const pk = PHU_KIEN[khoa] ?? {};
      const duong = r.path.replace(/:id/g, 'khong-phai-uuid') + (pk.query ?? '');
      const res = await goi(duong, {
        method: r.method, cookie: admin.cookie,
        ...(pk.than === undefined ? {} : { body: pk.than }),
      });
      expect(res.status, `${khoa} — 500 là một event Sentry`).not.toBe(500);
      if (!NGOAI_LE_400[khoa]) {
        expect(res.status, `${khoa} — id rác phải là 404 (hoặc khai vào NGOAI_LE_400)`)
          .toBe(404);
      }
    }
  });
});
