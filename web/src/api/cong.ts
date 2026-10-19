/**
 * HÀNG CHỜ VÀO APP — phía người chơi (D207).
 *
 * Cổng nằm ở Cloudflare Worker (`web/worker/`), đứng TRƯỚC cả Vercel lẫn DB.
 * Khi hết chỗ nó trả `503 { error: 'hang_cho', hang_cho: {...} }`. File này là
 * chỗ duy nhất trong client biết chuyện đó, và nó làm đúng ba việc:
 *   1. nhận tin từ `api/client.ts` (cửa duy nhất ra backend)
 *   2. tự hỏi lại `/api/v1/_cong` theo nhịp cổng bảo, tới khi được vào
 *   3. phát cho `AppShell` vẽ màn hàng chờ
 *
 * ⚠ DÙNG `fetch` TRẦN, KHÔNG DÙNG `api()`. Hai lý do, cả hai đều bắt buộc:
 *   · vòng import — `client.ts` gọi vào đây, đây gọi ngược lại là vòng tròn;
 *   · `api()` gói 503 thành `ApiError` rồi bắn tiếp vào chính đường này ⇒ đệ
 *     quy. Đường thoát khỏi hàng chờ không được đi qua cái cửa đang bị chặn.
 *
 * ⚠ KHÔNG ghi telemetry ở đây. Lúc đang xếp hàng là lúc hạ tầng đang ngộp;
 * bắn thêm request đo đạc vào đúng khoảnh khắc đó là đổ dầu vào lửa. Số liệu
 * hàng chờ đọc từ phía Worker, không phải từ máy người chơi.
 */

export interface TrangThaiCho {
  /** Vị trí trong hàng (1 = kế tiếp). */
  vi_tri: number;
  /** Tổng số người đang xếp hàng. */
  tong: number;
  /** Đang được phục vụ / trần. Có thể thiếu nếu cổng không kịp trả. */
  dang_trong?: number;
  tran?: number;
}

let dangCho: TrangThaiCho | null = null;
let hen: ReturnType<typeof setTimeout> | null = null;
const nghe = new Set<(t: TrangThaiCho | null) => void>();

function phat() {
  for (const f of nghe) f(dangCho);
}

/** Nghe đổi trạng thái. Trả hàm huỷ (nếp `mang.ts`). */
export function ngheHangCho(f: (t: TrangThaiCho | null) => void): () => void {
  nghe.add(f);
  f(dangCho);
  return () => nghe.delete(f);
}

export const dangXepHang = (): TrangThaiCho | null => dangCho;

/**
 * Hỏi cổng một lượt. Vào được thì XOÁ trạng thái chờ và dừng vòng lặp; chưa
 * thì hẹn lượt sau theo nhịp CỔNG bảo (không phải nhịp client tự đặt — client
 * tự đặt là mỗi bản build một nhịp khác nhau, và không sửa được từ xa).
 */
async function hoiCong(): Promise<void> {
  hen = null;
  let than: {
    vao?: boolean; vi_tri?: number; tong?: number;
    dang_trong?: number; tran?: number; hoi_lai_s?: number;
  } | null = null;
  try {
    const res = await fetch('/api/v1/_cong', {
      credentials: 'include',
      cache: 'no-store',
    });
    than = await res.json();
  } catch {
    /*
     * Không hỏi được cổng ⇒ GIỮ NGUYÊN màn hàng chờ và thử lại. Không tự cho
     * mình vào: mất mạng một nhịp không phải bằng chứng là đã tới lượt, mà
     * cho vào nhầm thì cú gọi kế tiếp lại ăn 503 và màn hình nhấp nháy.
     */
    hen = setTimeout(() => void hoiCong(), 5_000);
    return;
  }

  if (!than || than.vao !== false) {
    dangCho = null;
    phat();
    return;
  }
  dangCho = {
    vi_tri: than.vi_tri ?? 1,
    tong: than.tong ?? 1,
    dang_trong: than.dang_trong,
    tran: than.tran,
  };
  phat();
  hen = setTimeout(() => void hoiCong(), (than.hoi_lai_s ?? 5) * 1000);
}

/**
 * `client.ts` gọi khi máy chủ trả 503 `hang_cho`.
 * Vào hàng rồi thì KHÔNG khởi động vòng lặp thứ hai — nhiều màn cùng gọi API
 * là chuyện thường, và mỗi cái đẻ một vòng hỏi thì đúng lúc ngộp nhất ta lại
 * nhân số request lên theo số màn đang mở.
 */
export function baoHangCho(body: unknown): void {
  const h = (body as { hang_cho?: Partial<TrangThaiCho> } | null)?.hang_cho;
  dangCho = {
    vi_tri: h?.vi_tri ?? 1,
    tong: h?.tong ?? 1,
    dang_trong: h?.dang_trong,
    tran: h?.tran,
  };
  phat();
  if (hen === null) hen = setTimeout(() => void hoiCong(), 1_000);
}

/** Dọn hẹn — cho test, và cho ca app bị tháo. */
export function dungHoiCong(): void {
  if (hen !== null) clearTimeout(hen);
  hen = null;
  dangCho = null;
}
