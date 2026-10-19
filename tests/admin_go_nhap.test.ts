/**
 * GỠ BẢN NHÁP + trang admin không vỡ template.
 *
 * Founder 04/08: *"Xóa hết những kèo đó đi... Làm đơn giản và trực quan hóa cơ
 * chế hủy kèo giúp tôi cái"*. Trước hôm nay bản nháp KHÔNG CÓ ĐƯỜNG NÀO GỠ —
 * `cancelMarket` chỉ nhận open/locked — nên mỗi lần thử tạo kèo hỏng là một hàng
 * nằm lại vĩnh viễn.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { ADMIN_HTML } from '../server/admin_ui.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let admin: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  admin = await createTestUser(pool, { role: 'admin' });
  await moCuaAdmin(pool, admin);
}, 120_000);

afterAll(async () => { await db?.stop(); });

/** Tạo một bản nháp qua đúng cửa admin, trả về market_id. */
async function taoNhap(text = 'Kèo thử nghiệm'): Promise<string> {
  const r = await app.request('/api/v1/admin/markets', {
    method: 'POST',
    headers: { cookie: admin.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({
      pool: 'macro', question_text: text,
      resolution_source_name: 'TCTK', resolution_source_url: 'https://gso.gov.vn',
      open_ts: new Date(Date.now() + 3600_000).toISOString(),
      lock_ts: new Date(Date.now() + 7200_000).toISOString(),
      resolve_deadline_ts: new Date(Date.now() + 864_00_000).toISOString(),
      seed_per_option: 0,
      options: [{ label: 'Có' }, { label: 'Không' }],
    }),
  });
  const b: any = await r.json();
  expect(r.status, JSON.stringify(b)).toBeLessThan(300);
  return b.market_id;
}

const xoa = (id: string) =>
  app.request(`/api/v1/admin/markets/${id}`, { method: 'DELETE', headers: { cookie: admin.cookie } });

describe('I. Gỡ bản nháp', () => {
  it('nháp sạch → xoá hẳn, và các cửa của nó đi theo', async () => {
    const id = await taoNhap('Nháp sạch để gỡ');
    const r = await xoa(id);
    expect(r.status).toBe(200);

    for (const bang of ['markets', 'market_options']) {
      const { rows } = await pool.query(
        `SELECT count(*)::int n FROM ${bang} WHERE market_id = $1`, [id]);
      expect(rows[0].n, `${bang} còn sót dòng`).toBe(0);
    }
  });

  it('audit ghi CẢ CÂU HỎI, không chỉ id — xoá rồi thì id tra ngược không ra', async () => {
    const id = await taoNhap('Câu hỏi phải còn trong audit');
    await xoa(id);
    const { rows } = await pool.query(
      `SELECT payload_json FROM admin_audit WHERE action = 'market_draft_delete'
        AND payload_json->>'market_id' = $1`, [id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].payload_json.question_text).toBe('Câu hỏi phải còn trong audit');
  });

  /*
   * ⚠ Cửa này chỉ mở cho NHÁP. Kèo đã mở có tiền thật của người thật, và xoá nó
   * là làm bốc hơi tiền của họ mà không hoàn — đường đúng là HỦY (hoàn 100%).
   */
  it('kèo ĐÃ MỞ → từ chối, và chỉ đúng đường phải đi', async () => {
    const id = await taoNhap('Kèo sẽ mở');
    await app.request(`/api/v1/admin/markets/${id}/open`, {
      method: 'POST', headers: { cookie: admin.cookie },
    });
    const r = await xoa(id);
    expect(r.status).toBe(409);
    const b: any = await r.json();
    expect(b.error).toBe('chi_go_duoc_nhap');
    expect(b.message).toContain('HỦY');

    const { rows } = await pool.query(`SELECT count(*)::int n FROM markets WHERE market_id=$1`, [id]);
    expect(rows[0].n, 'kèo đã mở KHÔNG được biến mất').toBe(1);
  });

  /*
   * ⚠⚠ Chốt chặn ĐO ĐƯỢC, không suy từ trạng thái. Một bản nháp mang dấu vết tiền
   * hoặc dấu vết hành vi là chuyện BẤT THƯỜNG — và lúc đó việc đúng là dừng lại,
   * không phải xoá cho gọn.
   */
  it('nháp mà có dấu vết → KHÔNG xoá, dừng lại và nói ra', async () => {
    const id = await taoNhap('Nháp có dấu vết');
    const { rows: op } = await pool.query(
      `SELECT option_id FROM market_options WHERE market_id=$1 LIMIT 1`, [id]);
    await pool.query(
      `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed)
       VALUES ($1,$2,$3,10,false)`, [id, op[0].option_id, admin.userId]);

    const r = await xoa(id);
    expect(r.status).toBe(409);
    expect((await r.json() as any).error).toBe('nhap_co_dau_vet');
  });

  it('người thường không gỡ được', async () => {
    const id = await taoNhap('Nháp của admin');
    const u = await createTestUser(pool);
    const r = await app.request(`/api/v1/admin/markets/${id}`, {
      method: 'DELETE', headers: { cookie: u.cookie },
    });
    expect(r.status).toBe(403);
  });
});

describe('II. Trang admin không vỡ', () => {
  /*
   * ⚠⚠ BÀI NÀY SINH RA TỪ MỘT LỖI VỪA TỰ GÂY RA. Cả trang admin là MỘT template
   * literal, nên một dấu backtick lạc vào phần script — kể cả trong một dòng CHÚ
   * THÍCH — sẽ KẾT THÚC chuỗi và làm vỡ toàn bộ trang. TypeScript có bắt được,
   * nhưng chỉ vì phần sau tình cờ không parse nổi; đổi chút nữa là nó im lặng.
   */
  it('phần <script> KHÔNG chứa backtick', () => {
    const html = ADMIN_HTML;
    const script = html.slice(html.indexOf('<script>'));
    expect(script.includes('`'), 'backtick trong script = vỡ template literal').toBe(false);
  });

  it('danh sách kèo đọc endpoint ADMIN (thấy được bản nháp) và có nút ngay trên dòng', () => {
    const html = ADMIN_HTML;
    // Endpoint người chơi không bao giờ trả bản nháp — mà nháp mới là thứ hay
    // phải dọn nhất, nên đọc nhầm nguồn là cả tính năng không dùng được.
    expect(html).toContain('/api/v1/admin/keo');
    expect(html).toContain('goNhap(');
    expect(html).toContain('huyKeo(');
  });

  /*
   * Founder 16/08: "Mấy cái market id t chẳng biết lấy ở chỗ nào".
   *
   * Máy móc VẪN LUÔN ĐỦ — `loadMarkets` bày nút « chọn » mỗi dòng và
   * `pickMarket` tự điền `a_mid`. Cái thiếu là trang KHÔNG NÓI RA: ô danh sách
   * rỗng trơn lúc mở (mọi mục khác đều có "(bấm để tải)"), nhãn chỉ ghi trống
   * không `market_id`, còn lời dẫn thì bảo thẳng là "gõ tay". Một tính năng có
   * đủ mà không ai tìm ra thì đúng bằng không có.
   */
  it('ô danh sách kèo có trạng thái rỗng CHỈ ĐƯỜNG, không để trống trơn', () => {
    const html = ADMIN_HTML;
    const mkts = html.slice(html.indexOf('<div id="mkts"'), html.indexOf('<h3>Thao tác'));
    expect(mkts).toContain('Tải danh sách');
    expect(mkts).toContain('chọn');
    // Nhãn ô phải chỉ sang nút, y như ô outcome_option_id ngay dưới nó đã làm.
    expect(html).toMatch(/market_id \(tự điền[^)]*chọn/);
    expect(html, 'thôi mời người ta gõ tay id').not.toContain('chốt kèo bằng ID gõ tay');
  });

  /*
   * ⚠ PANEL NÓI DỐI. `loadMarkets` bản cũ không đọc status, nên 403 (chưa mở
   * khoá 2FA) hay 401 (hết phiên) đều ra mảng rỗng ⇒ in "Không có kèo nào."
   * trong khi prod đang có kèo. Người đọc kết luận kho trống rồi đi tìm id chỗ
   * khác — mà thật ra họ đang bị khoá ngoài. Im còn đỡ hơn nói sai (D61).
   */
  it('loadMarkets phân biệt LỖI với "không có kèo nào"', () => {
    const html = ADMIN_HTML;
    const fn = html.slice(html.indexOf('async function loadMarkets()'),
      html.indexOf('async function goNhap('));
    expect(fn).toContain('r.status!==200');
    // Nhánh lỗi phải đứng TRƯỚC nhánh rỗng, nếu không nó không bao giờ chạy.
    expect(fn.indexOf('r.status!==200')).toBeLessThan(fn.indexOf('Không có kèo nào'));
    expect(fn).toContain('MÃ HAI LỚP');
  });

  it('hộp xác nhận hủy nói SỐ TIỀN và SỐ NGƯỜI, không hỏi chung chung', () => {
    const html = ADMIN_HTML;
    // Một câu "bạn có chắc không" thì ai cũng bấm Yes; một câu có con số thì
    // người ta dừng lại đọc.
    expect(html).toContain('Hoàn 100% cho ');
    expect(html).toContain('người chơi đọc được');
  });
});
