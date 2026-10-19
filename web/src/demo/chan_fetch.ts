/**
 * BẢN DEMO — MỌI YÊU CẦU `/api/*` CÙNG ORIGIN ĐI VÀO MÁY CHỦ TRONG TRANG (worker), không ra mạng.
 *
 * App không biết mình đang chạy demo: `api()` vẫn `fetch('/api/v1/...')` như thường, lớp này đổi đích ở đúng một chỗ.
 * Yêu cầu khác origin (font, ảnh CDN nếu có) đi mạng như cũ. `sendBeacon` tới `/api/*` (telemetry lúc ẩn trang) cũng
 * vào worker — không một byte nào tới máy chủ thật.
 */
type TraLoi = { loai: 'tra_loi'; id: number; status: number; headers: Record<string, string>; body: ArrayBuffer };

export function chanFetch(worker: Worker): void {
  let dem = 0;
  const cho = new Map<number, (r: Response) => void>();
  worker.addEventListener('message', (e: MessageEvent<TraLoi | { loai: string }>) => {
    const d = e.data;
    if (d.loai !== 'tra_loi') return;
    const t = d as TraLoi;
    const xong = cho.get(t.id);
    if (!xong) return;
    cho.delete(t.id);
    const khongThan = t.status === 204 || t.status === 205 || t.status === 304;
    xong(new Response(khongThan ? null : t.body, { status: t.status, headers: t.headers }));
  });

  const laApi = (url: URL) => url.origin === window.location.origin && url.pathname.startsWith('/api/');
  const goc = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (!laApi(url)) return goc(input, init);
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => { headers[k] = v; });
    dem += 1;
    const id = dem;
    return new Promise<Response>((ok) => {
      cho.set(id, ok);
      worker.postMessage({ id, url: url.pathname + url.search, method: req.method, headers, body }, body ? [body] : []);
    });
  };

  const beacon = navigator.sendBeacon?.bind(navigator);
  navigator.sendBeacon = (url: string | URL, data?: BodyInit | null): boolean => {
    const u = new URL(String(url), window.location.href);
    if (!laApi(u)) return beacon ? beacon(url, data) : false;
    void window.fetch(u, { method: 'POST', ...(data != null ? { body: data } : {}) });
    return true;
  };
}
