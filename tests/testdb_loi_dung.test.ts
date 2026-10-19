/**
 * Postgres nhúng chết lúc dựng ⇒ lỗi phải NÓI VÌ SAO, không phải "Unknown Error: undefined" (CI 12/10, run 38142814609 ·
 * 38181000602: cả tệp bị bỏ qua ở beforeAll, không dò được gốc). Dựng lại đúng hiện trường bằng tai nạn có thật trên laptop
 * dùng chung: hai Postgres nhúng cùng port (port ngẫu nhiên 21000–23999, CI + mọi worktree chạy song song). Trùng port thì
 * testdb tự dựng lại trên port khác (D606); trùng mãi thì ném lỗi thật.
 */
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SO_LAN_THU_PORT, startTestDb, type TestDb } from './helpers/testdb.js';

const portCua = (db: TestDb) =>
  Number(new URL(String((db.pool as unknown as { options: { connectionString: string } }).options.connectionString)).port);

let a: TestDb;
let port: number;

beforeAll(async () => {
  a = await startTestDb();
  port = portCua(a);
}, 120_000);

afterAll(async () => { await a?.stop(); });

describe('testdb — trùng port thì dựng lại, dựng chết thì in lỗi thật', () => {
  it('trùng port hai lần rồi gặp port trống ⇒ dựng được, chạy được câu SQL', async () => {
    const hang = [port, port];
    const trong = port === 23999 ? 21000 : port + 1;
    const b = await startTestDb({ chonPort: () => hang.shift() ?? trong });
    try {
      expect(hang, 'phải đã thử cả hai port trùng').toEqual([]);
      expect(portCua(b)).toBe(trong);
      expect((await b.pool.query('SELECT 1 AS mot')).rows[0].mot).toBe(1);
    } finally { await b.stop(); }
  }, 180_000);

  it(`trùng port ${SO_LAN_THU_PORT} lần liền ⇒ ném Error có bước · port · log postgres; không để rơi thư mục`, async () => {
    let loi: unknown;
    try { await (await startTestDb({ chonPort: () => port })).stop(); } catch (e) { loi = e; }

    expect(loi, 'Postgres cùng port phải chết — nếu không thì bài này không dựng được hiện trường').toBeInstanceOf(Error);
    const msg = (loi as Error).message;
    expect(msg).toContain('chết lúc khởi động postgres');
    expect(msg).toContain(`port ${port} (trùng port ${SO_LAN_THU_PORT} lần liền`);
    expect(msg, 'stderr của postgres phải được giữ lại — đó là chỗ duy nhất nói lý do thật').toMatch(/FATAL: .*TCP\/IP/);
    const thuMuc = /thư mục (\S+delphi-pgtest-\S+)/.exec(msg)?.[1];
    expect(thuMuc).toBeTruthy();
    expect(existsSync(thuMuc!), 'dựng chết phải dọn thư mục của chính nó').toBe(false);
  }, 180_000);
});
