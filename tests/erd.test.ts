/**
 * ERD — canh cho `docs/api/erd.md` khỏi trôi khỏi migrations (D3, SPEC va-bao-mat-chuan-hoa-api-dot-1).
 *
 * ⚠ Cùng lý do với `route_danh_sach.test.ts`: mục A6 của `docs/luat/04-du-lieu.md` chép tay 11 bảng khi DB đã 56,
 * trôi 45 migration không ai báo. Phép so đáng tin duy nhất: chạy MỌI migration trên Postgres nhúng, sinh lại ERD,
 * so với tệp trên đĩa. Thêm bảng/cột/FK mà quên `npm run erd:ghi` ⇒ đỏ.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEP, kieuGon, mienCua, sinhErd } from '../scripts/sinh_erd.js';
import { chuanDong } from '../scripts/_chuan_dong.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';

let db: TestDb;
let sinh: string;

beforeAll(async () => {
  db = await startTestDb();
  sinh = await sinhErd(db.pool);
});

afterAll(async () => {
  await db?.stop();
});

describe('ERD sinh ra', () => {
  it('tệp trên đĩa KHỚP migrations (quên erd:ghi ⇒ đỏ)', () => {
    // `chuanDong` hai vế (D255): bộ sinh ghi LF, checkout Windows trả CRLF.
    expect(chuanDong(readFileSync(join(process.cwd(), TEP), 'utf8'))).toBe(chuanDong(sinh));
  });

  it('có bảng thật và sơ đồ mermaid, không phải bản rỗng đọc nhầm thành "khớp"', () => {
    // Ngưỡng cố ý thấp — chống ca "migration không chạy ⇒ 0 bảng ⇒ vẫn khớp tệp rỗng"; không khoá số bảng (D61).
    expect(sinh).toMatch(/\*\*\d{2,}\*\* tables/);
    expect(sinh).toContain('```mermaid\nerDiagram');
    expect(sinh).toMatch(/ {2}users \|\|--o\{ \w+ : "user_id"/);
  });

  it('bảng mới không thuộc miền nào ⇒ NÉM, không lạc vào ô "khác"', () => {
    expect(() => mienCua('bang_chua_ai_khai')).toThrow(/config\/erd_mien\.ts/);
    // Ngoại lệ thắng tiền tố; tiền tố dài nhất thắng tiền tố ngắn.
    expect(mienCua('rank_ledger')).toBe('kinh_te');
    expect(mienCua('rank_ban')).toBe('dau_truong');
    expect(mienCua('pfm_token_ledger')).toBe('kinh_te');
    expect(mienCua('pfm_luu')).toBe('pfm');
  });

  it('kiểu cột rút về một từ mermaid đọc được', () => {
    expect(kieuGon('timestamp with time zone')).toBe('timestamptz');
    expect(kieuGon('numeric(12,4)')).toBe('numeric');
    expect(kieuGon('character varying(40)[]')).toBe('varchar_array');
  });
});
