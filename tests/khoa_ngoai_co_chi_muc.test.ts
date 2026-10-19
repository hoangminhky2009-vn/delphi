/**
 * KHOÁ & CHỈ MỤC — bài canh sống mãi cho MỌI bảng, kể cả bảng thêm sau này (D1 · D2, migration 0083).
 *
 * (1) Mọi FK có một chỉ mục mà các cột đầu đúng bằng tập cột FK. Postgres không tự tạo chỉ mục cho cột FK; thiếu nó
 *     thì xoá/sửa dòng cha (xoá tài khoản ⇒ `users`) quét cả bảng con dưới khoá ghi. 17/10 đo được 23 FK như vậy.
 * (2) Mọi bảng `public.*` có PRIMARY KEY. Allowlist RỖNG — bảng có cột khoá NULL có nghĩa (telemetry tổng hợp) thì
 *     thêm khoá thay thế `id` identity, không xin miễn (0083 §2).
 *
 * Hai phép đo là CÙNG một câu SQL mà `docs/api/erd.md` in ở mục "Canh" (`scripts/sinh_erd.ts`) — một nguồn. Hai bài
 * chung một tệp vì cùng một lần dựng Postgres nhúng (~10 s mỗi lần).
 *
 * ⚠ Bài canh rỗng-thì-xanh là bài nguy hiểm nhất: phép đo hỏng (lát mảng sai gốc, quên `indpred`) cũng trả `[]`. Nên
 * nửa dưới TIÊM bảng thật vào DB trong một transaction rồi ROLLBACK, chứng minh phép đo bắt được từng ca.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { bangThieuPk, fkThieuChiMuc } from '../scripts/sinh_erd.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';

let db: TestDb;

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await db?.stop();
});

/**
 * Chạy `fn` trong transaction rồi ROLLBACK — DB test không giữ bảng tiêm nào. Chỉ giữ bảng `tiem_*`: nửa này kiểm
 * PHÉP ĐO, nên không được đỏ lây khi schema thật hỏng (việc đó của hai bài trên — đỏ cùng nhau là bài thừa).
 */
async function trongGiaoDich<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await db.pool.connect();
  try {
    await c.query('BEGIN');
    return await fn(c);
  } finally {
    await c.query('ROLLBACK');
    c.release();
  }
}

describe('Schema thật sau mọi migration', () => {
  it('mọi khoá ngoại có chỉ mục bắt đầu bằng cột FK', async () => {
    expect(await fkThieuChiMuc(db.pool)).toEqual([]);
  });

  it('mọi bảng public.* có PRIMARY KEY (allowlist rỗng)', async () => {
    expect(await bangThieuPk(db.pool)).toEqual([]);
  });

  it('telemetry tổng hợp: PK là `id` thay thế, UNIQUE NULLS NOT DISTINCT vẫn là khoá nghiệp vụ', async () => {
    const r = await db.pool.query<{ bang: string; dinh_nghia: string }>(`
      SELECT tablename AS bang, indexdef AS dinh_nghia FROM pg_indexes
      WHERE tablename IN ('telemetry_ngay', 'telemetry_ngay_nhom') ORDER BY 1, 2`);
    const cua = (b: string) => r.rows.filter((x) => x.bang === b).map((x) => x.dinh_nghia).join('\n');
    for (const b of ['telemetry_ngay', 'telemetry_ngay_nhom']) {
      expect(cua(b)).toMatch(new RegExp(`UNIQUE INDEX ${b}_pkey ON public\\.${b} USING btree \\(id\\)`));
      // Khoá cũ không bị biến thành PK (PK sẽ ép NOT NULL cột có nghĩa khi NULL).
      expect(cua(b)).toMatch(new RegExp(`UNIQUE INDEX ${b}_khoa .* NULLS NOT DISTINCT`));
    }
  });
});

describe('Phép đo bắt được ca hỏng (tiêm bảng trong transaction, rollback)', () => {
  const CHA = `CREATE TABLE tiem_cha (a INT, b INT, PRIMARY KEY (a, b), UNIQUE (a))`;

  it('FK không chỉ mục ⇒ bị nêu tên', async () => {
    const kq = await trongGiaoDich(async (c) => {
      await c.query(CHA);
      await c.query(`CREATE TABLE tiem_con (id INT PRIMARY KEY, a INT REFERENCES tiem_cha (a))`);
      return (await fkThieuChiMuc(c)).filter((x) => x.bang.startsWith('tiem_'));
    });
    expect(kq).toEqual([{ bang: 'tiem_con', cot: ['a'], rang_buoc: 'tiem_con_a_fkey' }]);
  });

  it('FK nằm ở cột THỨ HAI của chỉ mục ⇒ vẫn thiếu (chỉ mục chỉ giúp từ cột đầu)', async () => {
    const kq = await trongGiaoDich(async (c) => {
      await c.query(CHA);
      await c.query(`CREATE TABLE tiem_con (id INT PRIMARY KEY, x INT, a INT REFERENCES tiem_cha (a))`);
      await c.query(`CREATE INDEX ON tiem_con (x, a)`);
      return (await fkThieuChiMuc(c)).filter((x) => x.bang.startsWith('tiem_'));
    });
    expect(kq.map((x) => x.bang)).toEqual(['tiem_con']);
  });

  it('chỉ mục một phần: `WHERE cột IS NOT NULL` phủ đủ, điều kiện khác thì KHÔNG', async () => {
    const kq = await trongGiaoDich(async (c) => {
      await c.query(CHA);
      await c.query(`CREATE TABLE tiem_du (id INT PRIMARY KEY, a INT REFERENCES tiem_cha (a))`);
      await c.query(`CREATE INDEX ON tiem_du (a) WHERE a IS NOT NULL`);
      await c.query(`CREATE TABLE tiem_thieu (id INT PRIMARY KEY, a INT REFERENCES tiem_cha (a), xoa BOOL)`);
      await c.query(`CREATE INDEX ON tiem_thieu (a) WHERE NOT xoa`);
      return (await fkThieuChiMuc(c)).filter((x) => x.bang.startsWith('tiem_'));
    });
    expect(kq.map((x) => x.bang)).toEqual(['tiem_thieu']);
  });

  it('FK nhiều cột: chỉ mục (b, a, …) phủ được FK (a, b) — so theo TẬP cột đầu', async () => {
    const kq = await trongGiaoDich(async (c) => {
      await c.query(CHA);
      await c.query(`CREATE TABLE tiem_con (id INT PRIMARY KEY, a INT, b INT, z INT,
                       FOREIGN KEY (a, b) REFERENCES tiem_cha (a, b))`);
      await c.query(`CREATE INDEX ON tiem_con (b, a, z)`);
      return (await fkThieuChiMuc(c)).filter((x) => x.bang.startsWith('tiem_'));
    });
    expect(kq).toEqual([]);
  });

  it('bảng không PK ⇒ bị nêu tên, kể cả khi có UNIQUE', async () => {
    const kq = await trongGiaoDich(async (c) => {
      await c.query(`CREATE TABLE tiem_khong_pk (a INT NOT NULL UNIQUE)`);
      return (await bangThieuPk(c)).filter((x) => x.startsWith('tiem_'));
    });
    expect(kq).toEqual(['tiem_khong_pk']);
  });
});
