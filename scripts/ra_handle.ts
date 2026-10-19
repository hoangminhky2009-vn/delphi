/**
 * RÀ HANDLE THEO BLOCKLIST — trả nốt mục nghiệm thu của D25/R2.
 *
 * D25/R2 (19/07) chốt: *"vá blocklist tên + rà handle prod TRƯỚC khi hiện tên cho
 * người lạ — pre-req cứng"*, và mục nghiệm thu là **"0 handle cũ vi phạm
 * blocklist"**. Blocklist đã vá hôm đó; phần RÀ thì chưa, và bản yêu cầu 03 §3.6
 * gọi tên lại món nợ này vì **sảnh chờ là lần đầu tiên tên người thật hiện cho
 * người thật** trong repo.
 *
 * Đo trên prod 04/08: 11 tài khoản, **1 vi phạm** (tạo 18/07, 0 trận, 4 event).
 *
 * ─── VÌ SAO ĐỔI TÊN CHỨ KHÔNG XOÁ TÀI KHOẢN ─────────────────────────────────
 * `events` append-only (A3.3) và trỏ vào `users.user_id` bằng khoá ngoại. Xoá
 * người là hoặc phá khoá ngoại, hoặc phá append-only — cả hai đều cấm. Mà `handle`
 * KHÔNG nằm trong `events`: nó chỉ là nhãn hiển thị, nên đổi nó không viết lại một
 * dòng lịch sử nào. Đúng chỗ để sửa, và là chỗ DUY NHẤT sửa được.
 *
 * Tên mới lấy từ `tenDuPhong` của cửa Discord — cùng một câu trả lời cho cùng một
 * câu hỏi ("không dùng được tên họ đặt thì gọi họ là gì"), nên không đẻ thêm một
 * quy ước đặt tên thứ hai để có ngày lệch nhau.
 *
 * ⚠ GHI `admin_audit`. Đổi tên hiển thị của một người là việc có hậu quả với
 * người đó — nó phải có chủ ngữ và có dấu vết, không phải một cú UPDATE lặng lẽ.
 *
 * Chạy:
 *   npx tsx --env-file=.env.prod scripts/ra_handle.ts            # chạy khô
 *   npx tsx --env-file=.env.prod scripts/ra_handle.ts --that     # thực thi
 */
import { createPool } from '../server/db.js';
import { handleBlockReason } from '../config/auth.js';
import { tenDuPhong, DISCORD } from '../config/discord.js';

const THAT = process.argv.includes('--that');

async function main(): Promise<void> {
  const pool = createPool(process.env.DATABASE_URL, { max: 2 });
  try {
    const { rows } = await pool.query(
      `SELECT u.user_id, u.handle, u.role, u.created_at,
              (SELECT count(*)::int FROM events e WHERE e.user_id = u.user_id) AS so_event
         FROM users u ORDER BY u.created_at`,
    );

    const viPham = rows
      .map((r) => ({ ...r, ly_do: handleBlockReason(r.handle) }))
      .filter((r) => r.ly_do !== null);

    console.log(`${rows.length} tài khoản · ${viPham.length} vi phạm blocklist`);
    if (viPham.length === 0) {
      console.log('✓ Mục nghiệm thu D25/R2 ĐẠT: 0 handle vi phạm.');
      return;
    }
    for (const v of viPham) {
      console.log(`  ⛔ ${v.handle}  [${v.ly_do}]  event=${v.so_event}` +
        `  ${v.created_at.toISOString().slice(0, 10)}`);
    }

    if (!THAT) {
      console.log('\n(chạy khô — thêm --that để đổi tên)');
      return;
    }

    // Ghi công người chạy script: admin duy nhất của prod. Nhiều admin thì phải
    // chọn tay — im lặng lấy đại một người là ghi sai chủ ngữ vào sổ audit.
    const { rows: admins } = await pool.query(
      `SELECT user_id, handle FROM users WHERE role = 'admin' ORDER BY created_at`);
    if (admins.length !== 1) {
      throw new Error(
        `Cần đúng 1 admin để ghi audit, đang có ${admins.length}. ` +
        'Sửa script để nhận --admin=<handle> trước khi chạy.',
      );
    }
    const adminId = admins[0]!.user_id as string;

    for (const v of viPham) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let ten = '';
        for (let i = 0; i < DISCORD.SO_LAN_THU_TRUNG_TEN; i += 1) {
          const thu = tenDuPhong(() => Math.random().toString(36).slice(2, 10));
          const co = await client.query(`SELECT 1 FROM users WHERE handle = $1`, [thu]);
          if (co.rowCount === 0) { ten = thu; break; }
        }
        if (!ten) throw new Error('không cấp được tên thay thế');

        await client.query(`UPDATE users SET handle = $1 WHERE user_id = $2`, [ten, v.user_id]);
        await client.query(
          `INSERT INTO admin_audit (admin_id, action, payload_json) VALUES ($1,$2,$3)`,
          [adminId, 'handle_doi_vi_blocklist',
            JSON.stringify({ user_id: v.user_id, cu: v.handle, moi: ten, ly_do: v.ly_do })],
        );
        await client.query('COMMIT');
        console.log(`  ✓ ${v.handle} → ${ten}`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }
    console.log('\nXong. Chạy lại không kèm --that để xác nhận 0 vi phạm.');
  } finally {
    await pool.end();
  }
}

await main();
