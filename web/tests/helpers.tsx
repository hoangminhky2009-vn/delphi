/** Helper chung cho test màn hình: render router thật + stub fetch theo contract. */
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { routes } from '@/app/routes';
import { makeQueryClient } from '@/api/queries';
import type { MeResponse } from '@/api/types';

export function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

export interface StubRoute {
  status: number;
  body: unknown;
  /** Ném lỗi mạng N lần đầu (test retry idempotency). */
  failFirst?: number;
}

export interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
}

/**
 * Bảng route dạng MẢNG [pattern, route] — khớp theo THỨ TỰ khai báo (đặt pattern
 * cụ thể trước, vd '/bets' trước '/markets/'). Không khớp → 401 mặc định.
 *
 * ⚠ `/api/v1/telemetry` KHÔNG được ghi vào danh sách trả về (03/08). Đo lường
 * vận hành (A9) chạy ở `AppShell` nên nó bắn trong MỌI màn được render, và các
 * test ở đây khẳng định những câu như *"bấm điểm danh gọi ĐÚNG MỘT POST"* — về
 * lệnh NGHIỆP VỤ. Để lô đo lọt vào danh sách thì mọi phép đếm ấy đổi nghĩa
 * thành "gọi bao nhiêu request", tức là làm yếu đi đúng thứ chúng canh.
 *
 * Lọc ở đây, KHÔNG tắt telemetry trong test: tắt đi thì đường ống không bao giờ
 * được chạy qua đường thật, và đó chính là cách "cơ chế trang trí" sinh ra (bẫy
 * §6.1, repo đã dính 16+ lần). Nó vẫn được stub phục vụ, vẫn 202; chỉ là không
 * bị đếm nhầm. Đường ống có test riêng: `tests/telemetry.test.ts`.
 */
export function stubFetch(table: [string, StubRoute][]): RecordedCall[] {
  const calls: RecordedCall[] = [];
  const failCount = new Map<string, number>();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (url.includes('/api/v1/telemetry')) {
        return new Response('{"ok":true}', {
          status: 202, headers: { 'content-type': 'application/json' },
        });
      }
      calls.push({ url, method, body });
      const hit = table.find(([pattern]) => url.includes(pattern));
      if (!hit) {
        return new Response(
          JSON.stringify({ error: 'unauthorized', message: 'Bạn cần đăng nhập.' }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        );
      }
      const [pattern, route] = hit;
      if (route.failFirst) {
        const n = failCount.get(pattern) ?? 0;
        if (n < route.failFirst) {
          failCount.set(pattern, n + 1);
          throw new TypeError('Failed to fetch');
        }
      }
      return new Response(JSON.stringify(route.body), {
        status: route.status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return calls;
}

export const ME_ONBOARDED: MeResponse = {
  email: 'a@b.vn',
  email_verified: true,
  onboarded: true,
  user: {
    user_id: 'u1',
    handle: 'tester',
    age_band: '18-22',
    region: 'nam',
    occupation_band: 'hs_sv',
    bankroll: 1000,
    role: 'user',
    research_consent: true,
    created_at: '2026-07-18T00:00:00Z',
    season_id: '2026Q3',
  },
};
