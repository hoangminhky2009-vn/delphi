/**
 * CACHE BIÊN CỦA WORKER — hai lá chắn cho `/health` (D444, 28/09).
 *
 * ⚠⚠ BÀI NÀY SINH RA TỪ BƯỚC RÀ BẢN VÁ D444, TRƯỚC KHI LÊN PROD. D444 chia thân
 * `/api/v1/health` làm hai: công khai `{status, ban_phat_hanh}`, chi tiết chỉ khi
 * request mang `x-tick-secret` khớp. Server làm đúng — nhưng Worker đứng trước nó
 * cache `/health` 30 giây theo URL, và cache biên KHÔNG khoá theo header. Một cú
 * kiểm chi tiết đi qua Worker sẽ bị cất rồi phát lại cho người lạ trong 30 giây:
 * đúng thứ vừa giấu, rò ra ở tầng mà mọi bài test phía server không nhìn thấy.
 *
 * Trước bài này KHÔNG có bài nào chạm `nenCache` — chỗ gãy nằm ngoài tầm của cả
 * `tests/health_cong_khai.test.ts` lẫn mọi bài route.
 *
 * Hai lá chắn, test riêng từng cái (bỏ cái nào cũng hở một đường):
 *   1. `nenCache` — request có `x-tick-secret` ⇒ không đọc, không ghi cache.
 *   2. `catDuocVaoCache` — upstream nói `no-store`/`private` ⇒ không cất, để một
 *      route đổi thân theo header tự bảo vệ được mình mà không cần ai nhớ sửa Worker.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — worker là JS thuần, không có khai báo kiểu
import { catDuocVaoCache, nenCache } from '../worker/index.js';

const GOC = 'https://dubao.example.workers.dev';

function hoi(duong: string, init: RequestInit = {}): [Request, URL] {
  const url = new URL(duong, GOC);
  return [new Request(url, init), url];
}

describe('nenCache — lá chắn 1: request', () => {
  it('/health không header gì ⇒ được cache (hành vi cũ giữ nguyên)', () => {
    expect(nenCache(...hoi('/api/v1/health'))).toBe(true);
  });

  it('⭐ /health kèm x-tick-secret ⇒ KHÔNG cache — dù giá trị đúng hay sai', () => {
    for (const giaTri of ['dung-hay-sai-khong-quan-trong', '']) {
      const [req, url] = hoi('/api/v1/health', { headers: { 'x-tick-secret': giaTri } });
      expect(nenCache(req, url), `x-tick-secret="${giaTri}"`).toBe(false);
    }
  });

  it('cookie / authorization ⇒ không cache (lá chắn cũ vẫn đứng)', () => {
    expect(nenCache(...hoi('/api/v1/health', { headers: { cookie: 'dp_phien=x' } }))).toBe(false);
    expect(nenCache(...hoi('/api/v1/health', { headers: { authorization: 'Bearer x' } }))).toBe(false);
  });

  it('ngoài danh sách trắng hoặc không phải GET ⇒ không cache', () => {
    expect(nenCache(...hoi('/api/v1/auth/me'))).toBe(false);
    expect(nenCache(...hoi('/api/v1/health', { method: 'POST' }))).toBe(false);
  });
});

describe('catDuocVaoCache — lá chắn 2: phản hồi', () => {
  const tra = (init: ResponseInit & { headers?: Record<string, string> } = {}) =>
    new Response(init.status === 204 ? null : '{"status":"ok"}', init);

  it('200 bình thường ⇒ cất được', () => {
    expect(catDuocVaoCache(tra())).toBe(true);
    expect(catDuocVaoCache(tra({ headers: { 'cache-control': 'public, max-age=0, must-revalidate' } }))).toBe(true);
  });

  it('⭐ upstream nói no-store / private ⇒ KHÔNG cất', () => {
    expect(catDuocVaoCache(tra({ headers: { 'cache-control': 'no-store' } }))).toBe(false);
    expect(catDuocVaoCache(tra({ headers: { 'cache-control': 'private, max-age=60' } }))).toBe(false);
    expect(catDuocVaoCache(tra({ headers: { 'cache-control': 'No-Store' } }))).toBe(false);
  });

  it('set-cookie / lỗi / 204 ⇒ không cất (luật cũ dời sang đây, giữ nguyên)', () => {
    expect(catDuocVaoCache(tra({ headers: { 'set-cookie': 'a=b' } }))).toBe(false);
    expect(catDuocVaoCache(tra({ status: 500 }))).toBe(false);
    expect(catDuocVaoCache(tra({ status: 204 }))).toBe(false);
  });
});
