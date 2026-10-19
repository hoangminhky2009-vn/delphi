import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

/*
 * D416 — `findBy*` / `waitFor` chờ 3 s thay vì 1 s mặc định của Testing Library.
 * Bộ web chạy SONG SONG (vitest: số CPU − 1 worker), mỗi bài dựng cả cây route trong jsdom; trên máy founder (8 luồng)
 * một màn cần hơn 1 s mới vẽ xong là chuyện thường ⇒ lượt cả bộ đỏ 5–16 bài `Unable to find…`, mỗi lượt một chỗ, rồi
 * xanh hết khi chạy riêng (đo 26/09: 16 đỏ lúc máy tranh CPU, 5 đỏ lúc máy rảnh; 35/35 khi chạy riêng từng tệp). Một
 * bộ test lượt nào cũng đỏ vài bài thì người ta thôi đọc nó — và bài đỏ THẬT lẫn vào đó (hai bài đỏ của lỗi D412 nằm
 * lẫn trong mọi lượt cả bộ từ 22/09 tới 26/09). Nới chỉ đổi lúc BÀI HỎNG (báo chậm hơn 2 s), không đổi lúc bài đúng:
 * `findBy` trả ngay khi phần tử có mặt.
 * ⚠ Không có bài nào dựa vào `findBy` THẤT BẠI nhanh (đã rà `rejects`); bài nào cần hạn khác thì truyền `{ timeout }`.
 */
configure({ asyncUtilTimeout: 3000 });

// Không bật vitest globals → RTL không tự đăng ký cleanup; làm tay cho chắc
afterEach(cleanup);

// jsdom AbortSignal ≠ undici AbortSignal: react-router navigate() dựng
// new Request({signal}) và undici từ chối signal của jsdom → vá bỏ signal
// (chỉ trong test; fetch đã stub nên không mất gì).
const NativeRequest = globalThis.Request;
globalThis.Request = class PatchedRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init && 'signal' in init) {
      const { signal: _drop, ...rest } = init;
      super(input, rest);
    } else {
      super(input, init);
    }
  }
} as typeof Request;

// jsdom có thể thiếu requestAnimationFrame (lễ công bố dùng rAF)
// Bài chạy môi trường node (`// @vitest-environment node` — vd bản demo chạy PGlite) không có window/Element: bỏ qua vá DOM.
const CO_DOM = typeof window !== 'undefined';
if (CO_DOM && typeof window.requestAnimationFrame !== 'function') {
  window.requestAnimationFrame = (cb: FrameRequestCallback): number =>
    window.setTimeout(() => cb(performance.now()), 16) as unknown as number;
  window.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

/*
 * jsdom KHÔNG cài `scrollIntoView` (nó không có layout để cuộn).
 *
 * ⚠ Không phải chuyện thẩm mỹ. Bàn đấu tự kéo tới lá đang lật mỗi lần sang vòng
 * (AlphaDraftMatch), nên thiếu hàm này là effect ném TypeError → React Router
 * nuốt vào ErrorBoundary → màn thay bằng trang lỗi NGAY SAU khi nộp vòng. Test
 * nào khẳng định trước cú ném vẫn xanh, và cả phần sau của luồng thì không ai
 * kiểm được — đúng tiền lệ "test xanh vì component đã chết trước đó".
 */
if (CO_DOM && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}
/*
 * `window.scrollTo` thì jsdom CÓ khai, nhưng mỗi lần gọi in một dòng "Error: Not implemented" ra stderr (D429: đổi màn
 * từ bước dựng về đầu trang — `BachKhoa` cũng gọi y thế). Dòng lỗi giả ấy lấp đúng chỗ người đọc tìm lỗi thật ⇒ thay
 * bằng hàm rỗng, cùng lý lẽ `scrollIntoView` ngay trên.
 */
if (CO_DOM) window.scrollTo = (() => {}) as typeof window.scrollTo;

// jsdom thiếu matchMedia (motion.css dùng prefers-reduced-motion)
if (CO_DOM) Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }),
});

// Mặc định: API trả 401 (khách). Test nào cần user thật thì stub lại fetch.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: 'unauthorized', message: 'Bạn cần đăng nhập.' }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
    ),
  );
});
