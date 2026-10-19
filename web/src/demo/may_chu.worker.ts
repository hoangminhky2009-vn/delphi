/**
 * BẢN DEMO "KHÁCH NÂNG CAO" — MÁY CHỦ CHẠY TRONG TRANG (Web Worker).
 *
 * Founder 28/09: link demo cho pitch deck *"trải nghiệm full chức năng (giả định luôn phần dữ liệu cho PFM) mà ko cần
 * đăng nhập, ko lưu dữ liệu (ko phải link tester)"* — chọn "chạy hẳn trong trình duyệt". Nên: CHÍNH `createApp` của server
 * (engine, bot, luật, DTO — không một dòng chép tay) chạy trên PGlite (Postgres WASM) trong worker này (`dungMayChu`); màn
 * chính chuyển mọi yêu cầu `/api/*` sang đây (`chan_fetch.ts`). Không một byte nào ra khỏi máy người xem: không DB prod,
 * không telemetry nghiên cứu (khách gieo sẵn `research_consent = FALSE` ⇒ server tự không ghi), đóng tab là mất.
 *
 * Chạy trong worker, không ở luồng chính: engine dựng lại trận từ log ở mỗi yêu cầu — chạy ở luồng chính là giật hoạt ảnh.
 */
import { dungMayChu } from './may_chu';

interface YeuCau { id: number; url: string; method: string; headers: Record<string, string>; body?: ArrayBuffer }
type XuLy = (yc: YeuCau) => Promise<void>;

const guiLen = (d: unknown, chuyen: Transferable[] = []) => (self as unknown as Worker).postMessage(d, chuyen);
const json = (o: unknown): ArrayBuffer => new TextEncoder().encode(JSON.stringify(o)).buffer as ArrayBuffer;
let sanSang: Promise<XuLy> | null = null;

async function khoiDong(): Promise<XuLy> {
  const t0 = performance.now();
  const { app, token } = await dungMayChu(self.location.origin);
  guiLen({ loai: 'san_sang', ms: Math.round(performance.now() - t0) });

  return async (yc: YeuCau) => {
    try {
      // Đăng xuất ở bản demo là tự đá mình ra khỏi bàn chơi thử — trả "đã xong" mà không xoá phiên.
      if (yc.url.startsWith('/api/v1/auth/logout')) {
        const body = json({ ok: true });
        guiLen({ loai: 'tra_loi', id: yc.id, status: 200, headers: { 'content-type': 'application/json' }, body }, [body]);
        return;
      }
      /*
       * Phiên khách đi bằng `Authorization: Bearer` — đường server đã có cho Discord (`docTokenPhien`). KHÔNG bằng cookie:
       * trong trình duyệt (kể cả Web Worker) `Cookie` là header bị CẤM đặt bằng mã — `new Request` lặng lẽ bỏ nó, server
       * thấy yêu cầu vô danh và trả 401 (đo 28/09: chạy thử bằng Node thì qua, vì Node không cấm).
       */
      const res = await app.request(`${self.location.origin}${yc.url}`, {
        method: yc.method,
        headers: { ...yc.headers, authorization: `Bearer ${token}` },
        ...(yc.body && yc.method !== 'GET' && yc.method !== 'HEAD' ? { body: yc.body } : {}),
      });
      const body = await res.arrayBuffer();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { if (k !== 'set-cookie') headers[k] = v; });
      guiLen({ loai: 'tra_loi', id: yc.id, status: res.status, headers, body }, [body]);
    } catch (e) {
      const body = json({ error: 'demo_loi', message: String((e as Error)?.message ?? e) });
      guiLen({ loai: 'tra_loi', id: yc.id, status: 500, headers: { 'content-type': 'application/json' }, body }, [body]);
    }
  };
}

self.onmessage = async (e: MessageEvent<YeuCau | { loai: 'khoi_dong' }>) => {
  if ('loai' in e.data) {
    sanSang ??= khoiDong();
    try { await sanSang; } catch (loi) { guiLen({ loai: 'hong', message: String((loi as Error)?.message ?? loi) }); }
    return;
  }
  const xuLy = await (sanSang ??= khoiDong());
  await xuLy(e.data);
};
