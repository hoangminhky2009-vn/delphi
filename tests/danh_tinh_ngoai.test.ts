/**
 * MIGRATION 0029 — DANH TÍNH NGOÀI + "CHƠI TRƯỚC, KHAI SAU".
 *
 * ⚠ VÌ SAO MỘT MIGRATION LẠI ĐÁNG CÓ TEST RIÊNG: bản yêu cầu 02 §3 xếp cái này
 * vào CỬA MỘT CHIỀU. Mùa mới reset gần hết mọi thứ (D64) nhưng KHÔNG reset
 * `events` — nên nếu hàng rào chống-rẽ-đôi ở đây hỏng, hậu quả không sửa được
 * bằng cách chờ mùa sau. Đó là lý do duy nhất để cẩn thận kiểu doanh nghiệp ở
 * một dự án đang cố tình làm kiểu indie.
 *
 * Bốn bất biến được khoá, mỗi cái ứng với một cách hỏng ÂM THẦM.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';

let db: TestDb;
let pool: pg.Pool;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

/** Tài khoản chỉ có Discord — không email, không mật khẩu. */
async function taiKhoanDiscord(discordId: string): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO auth_accounts DEFAULT VALUES RETURNING account_id`,
  );
  const id = rows[0].account_id as string;
  await pool.query(
    `INSERT INTO auth_identities (account_id, provider, provider_user_id)
     VALUES ($1, 'discord', $2)`,
    [id, discordId],
  );
  return id;
}

describe('I. Hàng rào chống RẼ ĐÔI bộ dữ liệu', () => {
  /*
   * ⚠⚠ BÀI QUAN TRỌNG NHẤT CỦA FILE.
   *
   * Một người vào bằng email hôm nay, bằng Discord ngày mai. Nếu code lỡ tạo tài
   * khoản thứ hai thay vì nối vào tài khoản cũ thì Brier, rank, phễu và mọi phép
   * đo R&D chia đôi — và `events` append-only (A3.3) nên KHÔNG gộp lại được, kể
   * cả khi phát hiện ngay hôm sau, kể cả sang mùa mới.
   *
   * `UNIQUE(provider, provider_user_id)` là hàng rào DUY NHẤT chặn chuyện đó. Bài
   * này tồn tại để nếu ai gỡ nó ra thì đỏ ngay, chứ không phải phát hiện sau vài
   * nghìn dòng events.
   */
  it('cùng một Discord id KHÔNG gắn được vào hai tài khoản', async () => {
    await taiKhoanDiscord('discord-user-001');
    const { rows } = await pool.query(
      `INSERT INTO auth_accounts DEFAULT VALUES RETURNING account_id`,
    );
    await expect(
      pool.query(
        `INSERT INTO auth_identities (account_id, provider, provider_user_id)
         VALUES ($1, 'discord', 'discord-user-001')`,
        [rows[0].account_id],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it('một tài khoản gắn được nhiều nhà cung cấp khác nhau, không chặn nhầm', async () => {
    // Hôm nay chỉ có 'discord', nhưng ràng buộc phải theo CẶP (provider, id) chứ
    // không theo riêng id — nếu không thì thêm nhà cung cấp thứ hai là va nhau
    // ngay khi hai bên tình cờ trùng chuỗi id.
    const { rows } = await pool.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'auth_identities'::regclass AND contype = 'u'`,
    );
    expect(rows).toHaveLength(1);
    const { rows: cols } = await pool.query(
      `SELECT a.attname FROM pg_constraint c
         JOIN unnest(c.conkey) k(attnum) ON true
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        WHERE c.conrelid = 'auth_identities'::regclass AND c.contype = 'u'
        ORDER BY a.attname`,
    );
    expect(cols.map((r) => r.attname)).toEqual(['provider', 'provider_user_id']);
  });

  it('xoá tài khoản thì danh tính đi theo, không để lại mồ côi', async () => {
    const id = await taiKhoanDiscord('discord-user-002');
    await pool.query(`DELETE FROM auth_accounts WHERE account_id = $1`, [id]);
    const { rows } = await pool.query(
      `SELECT count(*)::int n FROM auth_identities WHERE provider_user_id = 'discord-user-002'`,
    );
    expect(rows[0].n).toBe(0);
  });
});

describe('II. Tài khoản không email/mật khẩu — và email vẫn được canh', () => {
  it('tạo được tài khoản CHỈ có Discord', async () => {
    const id = await taiKhoanDiscord('discord-user-003');
    const { rows } = await pool.query(
      `SELECT email, password_hash FROM auth_accounts WHERE account_id = $1`, [id],
    );
    expect(rows[0].email).toBeNull();
    expect(rows[0].password_hash).toBeNull();
  });

  /*
   * ⚠ TIÊM LỖI NGƯỢC. Nới `NOT NULL` rất dễ bị hiểu nhầm thành "nới cả CHECK".
   * Trong SQL, CHECK trả UNKNOWN trên NULL nên nó không chặn NULL — nhưng nó PHẢI
   * còn chặn email sai định dạng. Nếu ai đó "dọn dẹp" bỏ luôn CHECK thì bài này đỏ.
   */
  it('email sai định dạng VẪN bị từ chối (nới NOT NULL không nới CHECK)', async () => {
    await expect(
      pool.query(`INSERT INTO auth_accounts (email, password_hash) VALUES ('KHONG-PHAI-EMAIL', 'x')`),
    ).rejects.toThrow(/check constraint|vi phạm/i);
  });

  it('nhiều tài khoản cùng để email NULL — UNIQUE không coi hai NULL là trùng', async () => {
    await taiKhoanDiscord('discord-user-004');
    await taiKhoanDiscord('discord-user-005');
    const { rows } = await pool.query(
      `SELECT count(*)::int n FROM auth_accounts WHERE email IS NULL`,
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(2);
  });
});

describe('III. Chơi trước, khai sau (phương án B)', () => {
  it('tạo được `users` chưa khai nhân khẩu — bậc 0 ngồi vào bàn ngay', async () => {
    const { rows } = await pool.query(
      `INSERT INTO users (handle, season_id) VALUES ('nguoi_choi_test1', '2026Q3')
       RETURNING user_id, age_band, region, occupation_band`,
    );
    expect(rows[0].age_band).toBeNull();
    expect(rows[0].region).toBeNull();
    expect(rows[0].occupation_band).toBeNull();
  });

  /*
   * ⚠ NỚI Ở DB KHÔNG PHẢI NỚI Ở NGHIỆP VỤ. `age_band` NULL nghĩa là CHƯA HỎI,
   * không phải được miễn C8. Bài này khoá phần DB vẫn canh: giá trị lạ vẫn bị
   * từ chối, nên "chưa khai" và "khai bừa" là hai chuyện khác nhau.
   */
  it('đã khai thì vẫn phải khai ĐÚNG — giá trị ngoài danh sách bị từ chối', async () => {
    await expect(
      pool.query(
        `INSERT INTO users (handle, season_id, age_band) VALUES ('nguoi_choi_test2', '2026Q3', '99+')`,
      ),
    ).rejects.toThrow(/check constraint|vi phạm/i);
  });

  it('handle vẫn bắt buộc và vẫn đúng hình dạng — nó là thứ đối thủ nhìn thấy', async () => {
    // D25: đối thủ thấy mình là cái để mất. Tự cấp handle thì vẫn phải qua CHECK.
    await expect(
      pool.query(`INSERT INTO users (handle, season_id) VALUES ('CÓ HOA VÀ DẤU', '2026Q3')`),
    ).rejects.toThrow(/check constraint|vi phạm/i);
    await expect(
      pool.query(`INSERT INTO users (season_id) VALUES ('2026Q3')`),
    ).rejects.toThrow(/null value|not-null/i);
  });
});
