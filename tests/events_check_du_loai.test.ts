/**
 * MỌI `action_type` CODE ĐANG GHI ĐỀU PHẢI QUA ĐƯỢC CHECK CỦA DB.
 *
 * ⚠⚠ VÌ SAO ĐÁNG MỘT FILE RIÊNG — đây KHÔNG phải "thiếu một dòng log".
 * Mọi câu INSERT vào `events` đều nằm TRONG transaction của hành động nghiệp
 * vụ (A7 — event đi cùng hành động, không fire-and-forget). CHECK từ chối một
 * loại ⇒ CẢ TRANSACTION ROLLBACK ⇒ chính hành động đó thất bại.
 *
 * Đã có một ca thật: `hd_dat_short` (đặc quyền lá Phòng Hộ, D33 — thêm 27/07)
 * được code ghi mà CHECK chưa bao giờ nới. Hậu quả là ai cầm Phòng Hộ đặt
 * short thì CHỐT VÒNG hỏng, bấm mãi không đi tiếp được. Lỗi mở gần hai tuần,
 * không một bài test nào chạm tới, vì mọi bài đều kiểm "loại tôi nhớ" chứ
 * không kiểm "mọi loại code đang ghi".
 *
 * ⇒ Bài này đọc DANH SÁCH TỪ CHÍNH MÃ NGUỒN rồi thử từng loại trên DB thật.
 * Thêm một loại event mới mà quên migration là ĐỎ NGAY, không cần ai nhớ.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

let db: TestDb;
let pool: pg.Pool;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

/**
 * Rút mọi `action_type` xuất hiện trong câu `INSERT INTO events` của server.
 *
 * ⚠ ĐỌC THEO VỊ TRÍ CỘT, không quét mọi chuỗi trong khối. Bản đầu quét thô
 * rồi lọc bằng tiền tố, và nó bắt nhầm `'qua_beta'` — đó là CONTEXT_TYPE của
 * `qua_beta.ts:217`, không phải action_type (`'qua_beta_nhan'` mới là). Một
 * bài test báo động giả sẽ bị người ta tắt đi, và lúc đó nó không còn canh gì.
 *
 * Cách đúng: tìm danh sách cột `(...)`, lấy CHỈ SỐ của `action_type`, rồi lấy
 * phần tử cùng chỉ số trong `VALUES (...)`. Phần tử là chuỗi nháy đơn ⇒ đó là
 * một action_type ghi cứng. Là `$n` ⇒ bỏ qua (giá trị đến lúc chạy).
 */
function loaiEventTrongMa(): string[] {
  // `fileURLToPath` chứ không phải `.pathname` — đường dẫn Windows có dấu cách
  // bị mã hoá thành %20 trong URL, và `scandir` không giải mã nó.
  const thuMuc = fileURLToPath(new URL('../server/', import.meta.url));
  const ra = new Set<string>();
  const quet = (d: string): void => {
    for (const m of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, m.name);
      if (m.isDirectory()) { quet(p); continue; }
      if (!m.name.endsWith('.ts')) continue;
      const src = readFileSync(p, 'utf8');
      // Khối từ "INSERT INTO events" tới dấu backtick kết thúc câu SQL.
      for (const khoi of src.matchAll(/INSERT INTO events[\s\S]*?`/g)) {
        const sql = khoi[0];
        const cot = /INSERT INTO events\s*\(([^)]*)\)/.exec(sql)?.[1];
        const vals = /VALUES\s*\(([^)]*)\)/.exec(sql)?.[1];
        if (!cot || !vals) continue;
        const iCot = cot.split(',').map((x) => x.trim()).indexOf('action_type');
        if (iCot < 0) continue;
        const v = vals.split(',')[iCot]?.trim();
        const m = v ? /^'([a-z][a-z0-9_]{2,40})'$/.exec(v) : null;
        if (m) ra.add(m[1]!);
      }
    }
  };
  quet(thuMuc);
  return [...ra];
}

describe('CHECK events.action_type phủ đủ mọi loại code đang ghi', () => {
  it('⭐ mọi action_type trong mã nguồn đều INSERT được (không thì cả tx rollback)',
    async () => {
      const ungVien = loaiEventTrongMa();
      expect(ungVien.length, 'không rút được loại nào — bộ quét hỏng, không phải repo sạch')
        .toBeGreaterThan(10);

      const hong: string[] = [];
      for (const loai of ungVien) {
        try {
          await pool.query(
            `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
             VALUES ($1, 'test', gen_random_uuid(), $2, '{}'::jsonb)`,
            [user.userId, loai]);
        } catch (e) {
          // Bộ quét nay đọc theo VỊ TRÍ CỘT nên mọi ứng viên đều là
          // action_type thật — rớt CHECK là hỏng thật, không cần lọc thêm.
          if (String(e).includes('events_action_type_check')) hong.push(loai);
        }
      }

      expect(hong,
        'code ghi loại này mà DB từ chối ⇒ CẢ transaction nghiệp vụ rollback — '
        + 'nộp vòng/mua thẻ/nhận quà thất bại theo kiểu khó hiểu nhất. '
        + 'Nới CHECK bằng migration cộng dồn (mẫu: migrations/0037).')
        .toEqual([]);
    }, 60_000);

  it('ĐỐI CHỨNG — loại BỊA vẫn phải bị CHECK chặn (không thì CHECK đã chết)',
    async () => {
      /*
       * Bắt buộc có: nếu ai đó gỡ CHECK cho "đỡ phiền" thì bài trên xanh vĩnh
       * viễn trong khi hàng rào duy nhất giữ `events` sạch đã biến mất — mà
       * `events` là APPEND-ONLY (A3.3), rác đổ vào là nằm đó mãi.
       */
      await expect(pool.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
         VALUES ($1, 'test', gen_random_uuid(), 'hd_loai_bia_khong_ton_tai', '{}'::jsonb)`,
        [user.userId])).rejects.toThrow(/events_action_type_check/);
    });
});
