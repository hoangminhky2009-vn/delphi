/**
 * MÁY CHỦ THẬT cho kịch bản luồng trình duyệt cần ENGINE + DB (SPEC chan-truoc-beta: nộp vòng mất mạng · báo lỗi · ô Tài chính khoá).
 * Cùng `createApp` với prod (A8.9 — không API giả cho đường chạm `events`), Postgres NHÚNG (`startTestDb`), một người chơi dựng sẵn
 * bằng fixture. Không chạm prod, không .env.
 *
 * In MỘT dòng JSON `{"san_sang":true,"cookie":"…","port":…}` lên stdout khi sẵn sàng. Thêm hai cửa điều khiển (không qua app):
 *   GET /__luong/dem?match=<id>  — đếm thứ cần đối chiếu: dòng vòng (`action_log`) · `hd_cam_ket` theo vòng · báo lỗi · chuông Sentry.
 *   GET /__luong/hang?diem=&so_tran= — đặt điểm hạng mùa này (soi huy hiệu đầu sảnh).
 *   GET /__luong/tat             — dừng (xoá DB tạm).
 * Chạy: `npx tsx tests/luong/trinh-duyet/_may_chu_that.mts` (biến LUONG_API_PORT, mặc định 8798). Thường do `chan_truoc_beta.mjs` gọi.
 */
import { serve } from '@hono/node-server';
import { createApp } from '../../../server/app.js';
import { CapturingMailer } from '../../../server/email.js';
import type { KenhBaoLoi } from '../../../server/bao_loi.js';
import { startTestDb } from '../../helpers/testdb.js';
import { createTestUser } from '../../helpers/fixtures.js';
import { currentSeasonId } from '../../../server/season.js';

const PORT = Number(process.env.LUONG_API_PORT ?? 8798);
const db = await startTestDb();
const chuong: Array<{ loi: string; nhan: unknown } | { ten: string; nhan: Record<string, string>; vanTay: string | null }> = [];
const kenh: KenhBaoLoi = {
  bao(err, ctx) { chuong.push({ loi: err instanceof Error ? err.message : String(err), nhan: ctx.nhan ?? null }); },
  // Chuông không chữ (SPEC bao-loi-nguoi-choi) — chuông "có báo lỗi mới" + lỗi client ẩn danh đi đường này.
  baoMa(ten, nhan, vanTay) { chuong.push({ ten, nhan, vanTay: vanTay ?? null }); },
  async xa() { /* ghi lại là đủ */ },
  noiRaNgoai: true,
};
const app = createApp({
  pool: db.pool, mailer: new CapturingMailer(), appBaseUrl: 'http://localhost:5199', secureCookie: false, baoLoi: kenh,
});
const u = await createTestUser(db.pool, { tienTo: 'luong' });

const may = serve({
  port: PORT,
  fetch: async (req: Request) => {
    const url = new URL(req.url);
    if (url.pathname === '/__luong/dem') {
      const id = url.searchParams.get('match');
      const tran = id
        ? await db.pool.query('SELECT jsonb_array_length(action_log)::int AS n FROM holdem_matches WHERE match_id = $1', [id])
        : null;
      const ck = id
        ? await db.pool.query(
          `SELECT value_json->>'vong' AS vong, count(*)::int AS n FROM events
            WHERE context_id = $1 AND action_type = 'hd_cam_ket' GROUP BY 1 ORDER BY 1`, [id])
        : null;
      const bl = await db.pool.query('SELECT count(*)::int AS n FROM bao_loi WHERE user_id = $1', [u.userId]);
      return Response.json({
        dong_vong: tran?.rows[0]?.n ?? null, cam_ket: ck?.rows ?? [], bao_loi: bl.rows[0].n, chuong,
      });
    }
    if (url.pathname === '/__luong/hang') {
      // Soi huy hiệu đầu sảnh: đặt điểm hạng mùa này cho người chơi dựng sẵn (DB tạm, không bao giờ prod).
      const diem = Number(url.searchParams.get('diem') ?? 0), soTran = Number(url.searchParams.get('so_tran') ?? 10);
      await db.pool.query(
        `INSERT INTO rank_diem (user_id, season_id, diem, diem_dinh, so_tran) VALUES ($1, $2, $3, $3, $4)
         ON CONFLICT (user_id, season_id) DO UPDATE SET diem = $3, diem_dinh = $3, so_tran = $4`,
        [u.userId, currentSeasonId(), diem, soTran]);
      return Response.json({ ok: true });
    }
    if (url.pathname === '/__luong/tat') {
      setTimeout(() => { may.close(); void db.stop().then(() => process.exit(0)); }, 50);
      return Response.json({ ok: true });
    }
    return app.fetch(req);
  },
});
console.log(JSON.stringify({ san_sang: true, cookie: u.cookie, port: PORT, handle: u.handle }));
