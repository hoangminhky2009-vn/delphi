import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/*
 * SỔ CÁCH LY (D535 B4): bài đỏ-đã-biết nằm ở `tests/_cach_ly.json` kèm lý do · chủ · hạn, KHÔNG chạy ở
 * `npm test`/CI (đỏ liên tục không cho tín hiệu, lại chặn cổng). `kiem` cảnh báo khi quá hạn, `so-do`
 * đếm. Cách ly ≠ xoá: `npx vitest run <tệp>` vẫn chạy được. Đừng thêm mục mà không ghi việc chữa.
 */
const cachLy = JSON.parse(readFileSync(new URL('./tests/_cach_ly.json', import.meta.url), 'utf8')) as
  { goc: { tep: string }[] };

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', ...cachLy.goc.map((c) => c.tep)],
    // initdb + start Postgres embedded mất vài chục giây lần đầu trên Windows
    hookTimeout: 240_000,
    testTimeout: 30_000,
    // Các file test dùng chung cổng/tài nguyên DB — chạy tuần tự cho ổn định
    fileParallelism: false,
    // CI: bài chập chờn (stress A3 khi trận khép sớm — D451) được MỘT lần chạy lại; lỗi thật vẫn đỏ hai lần.
    // Local không retry: ở máy dev, đỏ chập chờn là thứ phải nhìn thấy (bài học 19/09, 25/09).
    retry: process.env.CI ? 1 : 0,
  },
});
