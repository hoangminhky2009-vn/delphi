/**
 * Cửa DUY NHẤT frontend nói chuyện với backend (/api/v1 — server/app.ts).
 * UI không bao giờ gọi fetch trực tiếp; đổi transport/host = sửa mỗi file này (C6, A8.9).
 *
 * LUẬT C4 — server-authoritative: client KHÔNG tính tiền/odds/payout/cap.
 * Mọi con số hiển thị là số server trả về; tầng này chỉ chuyên chở, không suy diễn.
 */
import { baoHangCho } from './cong';
import type { ApiErrorBody } from './types';
import { layTokenDiscord } from '@/lib/discord_phien';
import { ghiDo, manCuaDuong } from '@/lib/telemetry';
import { ghiNhanGoi, ghiSuCo } from './mang';
import { ghiLoiGanNhat } from '@/lib/loi_gan_nhat';

/**
 * Báo một lỗi API vào đo lường vận hành (§4.2 mục 12).
 *
 * ⚠⚠ PHẢI LOẠI CHÍNH ĐƯỜNG TELEMETRY RA, nếu không đây là một vòng lặp: lô đo
 * gửi hỏng → ghi một sự kiện lỗi → tới ngưỡng lại gửi → lại hỏng → lại ghi.
 * Mất mạng là kịch bản kích hoạt nó, tức nó nổ đúng lúc đang yếu nhất.
 *
 * `ghiDo` không bao giờ ném (xem lib/telemetry.ts) nên gọi ở nhánh lỗi là an toàn.
 */
function baoLoiApi(path: string, ma: string): void {
  if (path.startsWith('/telemetry')) return;
  // SPEC chan-truoc-beta — báo lỗi của người chơi kèm "mã lỗi gần nhất" (chỉ mã, không thông điệp).
  ghiLoiGanNhat(ma);
  ghiDo('loi_api', { man: manCuaDuong(window.location.pathname), chi_tiet: { ma } });
}

/** Trống = cùng origin (dev: Vite proxy /api; prod: xem README "Cookie & origin"). */
const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly field?: string,
    public readonly retryAfterSeconds?: number,
    /**
     * Thân JSON máy chủ trả kèm lỗi — cho ca máy chủ trả THÊM dữ liệu cùng mã
     * lỗi (16/08: 409 `da_vao_ban` kèm `match_id` trận cũ để client về đúng
     * trận). Đọc có kiểm, đừng tin mù.
     */
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * CHƯA TỚI ĐƯỢC MÁY CHỦ (mất mạng hoặc quá hạn chờ) — khác hẳn "máy chủ đã
   * trả lời và trả lời là không".
   *
   * ⚠ ĐÂY LÀ RANH GIỚI QUYẾT ĐỊNH CÓ GỬI LẠI HAY KHÔNG, nên nó phải là một
   * thuộc tính chứ không phải một phép thử `instanceof`. Trước 03/08 luật thử
   * lại viết là "không phải ApiError thì gửi lại" — đúng khi lỗi mạng còn ném
   * thô, nhưng vừa gói lỗi mạng thành ApiError là lá chắn chống trừ tiền hai
   * lần TẮT IM LẶNG. Máy chủ đã trả lời thì tuyệt đối không gửi lại (có thể
   * trừ tiền lần nữa); chưa tới máy chủ thì gửi lại là AN TOÀN vì server
   * idempotent theo `idempotency_key` (§2.3).
   */
  get chuaToiMayChu(): boolean {
    return this.status === 0;
  }
}

interface ApiInit {
  method?: 'GET' | 'POST';
  body?: unknown;
  /**
   * THÂN NHỊ PHÂN — đi thẳng, không qua `JSON.stringify`. Dùng cho két PFM
   * (`POST /pfm/luu`): thân là ciphertext do máy user khoá, server không có chìa.
   *
   * ⚠ CỐ Ý KHÔNG ĐẶT `content-length` BẰNG TAY. Nó là *forbidden header name* —
   * trình duyệt lặng lẽ bỏ qua mọi cố gắng đặt nó, và tự điền đúng cho một thân
   * không-phải-luồng. Viết một dòng đặt nó là dựng một cái chốt trông như có tác
   * dụng mà không có; và server thì thật sự đòi header ấy (411 nếu thiếu).
   */
  than?: ArrayBuffer | Uint8Array;
  /**
   * Kỳ vọng phản hồi NHỊ PHÂN thay vì JSON (`GET /pfm/luu`).
   * ⚠ Chỉ đổi cách đọc thân THÀNH CÔNG. Nhánh lỗi vẫn đọc JSON như mọi đường khác —
   * server trả lỗi bằng JSON kể cả trên route nhị phân, và mọi màn hình chỉ biết đúng
   * một hình dạng lỗi (`ApiError`).
   */
  raNhiPhan?: boolean;
  /**
   * Đọc HEADER của phản hồi thành công. Có đúng một chỗ cần: `GET /pfm/luu` trả `ver`
   * của lát trong `X-Pfm-Ver`, và đó là số duy nhất cho máy vừa khôi phục biết mình
   * đang cầm bản nào — không nhặt thì cú sao lưu đầu tiên sau khôi phục chắc chắn 409.
   *
   * ⚠ CỐ Ý LÀ CALLBACK CHỨ KHÔNG ĐỔI KIỂU TRẢ VỀ CỦA `api()`. Trả thêm header cho mọi
   * đường gọi là bắt 40 chỗ khác đổi theo vì một chỗ cần; và bọc thành `{than, dau}`
   * chỉ cho nhánh nhị phân là dựng hai hình trả về cho một hàm.
   */
  nhanDau?: (dau: Headers) => void;
}

/** Gọi endpoint /api/v1. `path` bắt đầu bằng '/', vd api('/auth/me'). */
/**
 * HẠN CHỜ MỖI LƯỢT GỌI — vá 03/08 (đợt kiểm 02/08).
 *
 * ⚠ `fetch` KHÔNG tự bỏ cuộc. Mạng 3G chập chờn hay hàm serverless nguội thì
 * lời hứa treo VÔ HẠN, và màn hình đang chờ nó cứ quay mãi — đúng triệu chứng
 * "trận trông như chết" founder từng báo. Trên điện thoại chuyện này thường
 * hơn cả lỗi máy chủ, mà treo im lặng lại tệ hơn lỗi có thông báo: người chơi
 * không biết nên đợi hay tải lại, và ở đây họ đang có TIỀN trong một vòng
 * chưa chốt.
 *
 * 15s: dài hơn mọi endpoint chậm nhất đo được (nộp vòng ~1,2s ở tải B1) nhiều
 * lần, nên không cắt nhầm request đang chạy thật; đủ ngắn để người chơi chưa
 * kịp nghĩ là app hỏng.
 */
const HAN_CHO_MS = 15_000;

/**
 * D472 — URL + header xác thực cho đường KHÔNG đi qua `api()`: dòng nhịp minigame là phản hồi NDJSON sống ~40 s, còn `api()` cắt ở
 * `HAN_CHO_MS` và đọc trọn thân JSON. MỘT nguồn cho gốc API + token Discord — đừng chép lại ở chỗ gọi.
 */
export function yeuCauApiTho(path: string): { url: string; headers: Record<string, string> } {
  const tok = layTokenDiscord();
  return { url: `${BASE}/api/v1${path}`, headers: tok ? { authorization: `Bearer ${tok}` } : {} };
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  // ⚠ GỌI chốt, không chỉ khai nó. Một cái chốt không chạy còn tệ hơn không có chốt:
  // nó làm người đọc yên tâm mà không kiểm gì cả (D242).
  const loiVao = kiemVaoApi(init);
  if (loiVao) throw new Error(`api(${path}): ${loiVao}`);
  const { method = 'GET', body, than, raNhiPhan, nhanDau } = init;
  const bo = new AbortController();
  const hen = setTimeout(() => bo.abort(), HAN_CHO_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      credentials: 'include', // phiên = cookie HttpOnly (D17a)
      /*
       * Hai đường mang phiên, và chúng KHÔNG loại trừ nhau:
       *  · cookie — bản web thường;
       *  · `Authorization: Bearer` — trong Activity Discord, nơi cookie
       *    `SameSite=Lax` KHÔNG được gửi vì iframe là ngữ cảnh xuyên site.
       * Ngoài Discord thì `layTokenDiscord()` luôn null nên header không xuất
       * hiện, và đường chạy của web thường không đổi một byte nào.
       */
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(than !== undefined ? { 'content-type': 'application/octet-stream' } : {}),
        ...(layTokenDiscord() ? { authorization: `Bearer ${layTokenDiscord()}` } : {}),
      },
      /*
       * ⚠ `than` (nhị phân) và `body` (JSON) loại trừ nhau — `kiemVaoApi` ở dưới chặn
       * ca đưa cả hai. Ở đây `than` đi TRƯỚC để nếu chốt kia có ngày bị gỡ thì hành vi
       * vẫn xác định, không phụ thuộc thứ tự đọc thuộc tính.
       */
      body: than !== undefined
        ? (than as BodyInit)
        : (body !== undefined ? JSON.stringify(body) : undefined),
      signal: bo.signal,
    });
  } catch (e) {
    /*
     * Quá hạn và mất mạng đi CHUNG một cửa vì với người chơi chúng là một
     * chuyện: không nói được với máy chủ. Ném ApiError như mọi lỗi khác để
     * màn hình gọi không phải học thêm một hình dạng lỗi thứ hai.
     */
    const quaHan = e instanceof DOMException && e.name === 'AbortError';
    // Hai lớp lỗi máy chủ KHÔNG BAO GIỜ thấy được: quá hạn thì nó đã trả 200,
    // mất mạng thì nó chẳng nhận được gì. Không ghi ở đây là mù vĩnh viễn.
    baoLoiApi(path, quaHan ? 'timeout' : 'network');
    // Cảm biến kết nối — đặt ở đây vì đây là cửa DUY NHẤT ra backend (xem `mang.ts`).
    ghiNhanGoi(false);
    // Sổ sự cố (D93) — nuôi lời khai `su_co_khai` khi vòng bị chốt hộ.
    if (!path.startsWith('/telemetry')) ghiSuCo(quaHan ? 'timeout' : 'network');
    throw new ApiError(0, quaHan ? 'timeout' : 'network',
      quaHan
        ? 'Máy chủ trả lời quá lâu. Kiểm tra mạng rồi thử lại nhé.'
        : 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé.');
  } finally {
    clearTimeout(hen);
  }

  /*
   * MÁY CHỦ ĐÃ TRẢ LỜI ⇒ đường mạng còn sống, kể cả khi nó trả lời là LỖI.
   * Ghi nhận TRƯỚC nhánh `!res.ok`: một cú 409 `sai_vong` không phải sự cố
   * mạng, và đếm nó vào cảm biến là dải cảnh báo bật lên mỗi lần bấm trùng.
   */
  ghiNhanGoi(true);

  /*
   * ⚠ ĐỌC THÂN NHỊ PHÂN CHỈ Ở NHÁNH THÀNH CÔNG, và phải TRƯỚC `res.json()`: một
   * `Response` chỉ đọc được MỘT lần. Gọi `.json()` trước rồi mới nghĩ tới nhị phân là
   * đã tiêu mất luồng — lỗi này im lặng, chỉ hiện thành "két rỗng".
   * ⚠ Nhánh lỗi thì vẫn JSON: server trả lỗi bằng JSON kể cả trên route nhị phân.
   */
  if (raNhiPhan && res.ok) {
    // `ghiNhanGoi(true)` đã chạy ngay trên — đừng gọi lại, cảm biến kết nối sẽ đếm đôi.
    nhanDau?.(res.headers);
    return (await res.arrayBuffer()) as unknown as T;
  }

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (json ?? {}) as Partial<ApiErrorBody>;
    /*
     * 401 KHÔNG phải sự cố — nó là câu trả lời bình thường cho khách chưa đăng
     * nhập, và mọi màn auth đều gọi `/auth/me` trước. Ghi nó vào là làm ngập
     * bảng lỗi bằng thứ hoạt động đúng, rồi cột "sức khoẻ kỹ thuật" thành vô
     * dụng vì không ai đọc nổi qua đống nhiễu.
     */
    /*
     * SUẤT TRẬN (SPEC tran-tran-ngay) — 503 `hang_cho_tran` / `het_suat_ngay` cũng là CÂU TRẢ LỜI, không phải sự cố: máy chủ
     * khoẻ, ta chủ động xếp hàng để giữ hạn mức. Người chờ hỏi lại mỗi vài phút ⇒ ghi vào là ngập bảng lỗi + bật dải "mất kết
     * nối" cho đúng người đang làm đúng điều ta bảo.
     */
    const laCauTraLoiSuat = res.status === 503
      && (err.error === 'hang_cho_tran' || err.error === 'het_suat_ngay');
    if (res.status !== 401 && !laCauTraLoiSuat) baoLoiApi(path, err.error ?? `http_${res.status}`);
    /*
     * Sổ sự cố (D93): 5xx là "máy chủ có mặt nhưng hỏng" — với người chơi cùng
     * một chuyện với không tới máy chủ (không quyết định được). 4xx KHÔNG vào
     * sổ: 409 `sai_vong`, 400 nhập sai là câu trả lời, không phải sự cố.
     */
    if (res.status >= 500 && !path.startsWith('/telemetry') && !laCauTraLoiSuat) ghiSuCo('server');
    /*
     * CỔNG HÀNG CHỜ (D207) — 503 `hang_cho` do Cloudflare Worker trả, KHÔNG
     * phải máy chủ hỏng. Báo cho `api/cong.ts` để nó dựng màn xếp hàng và
     * tự hỏi lại; vẫn ném ApiError như mọi lỗi khác để màn đang mở không
     * phải học thêm một hình dạng lỗi thứ hai.
     */
    if (res.status === 503 && (json as { error?: string } | null)?.error === 'hang_cho') {
      baoHangCho(json);
    }
    const retryAfter = res.headers.get('Retry-After');
    throw new ApiError(
      res.status,
      err.error ?? 'unknown',
      err.message ?? 'Có lỗi không xác định. Thử lại sau nhé.',
      err.field,
      retryAfter ? Number(retryAfter) : undefined,
      json,
    );
  }
  return json as T;
}

/**
 * Chặn hai cách dùng sai `api()` mà kiểu không bắt được.
 *
 * ⚠ Vì sao là hàm riêng chứ không phải `if` rải trong `api()`: `api()` là đường nóng của
 * MỌI màn hình, và nó đã dài. Gom hai phép kiểm vào một chỗ có tên thì test gọi thẳng
 * được, và người đọc `api()` không phải lướt qua hai nhánh chẳng bao giờ chạy.
 */
export function kiemVaoApi(init: ApiInit): string | null {
  if (init.than !== undefined && init.body !== undefined) {
    return 'không đưa cả `than` (nhị phân) lẫn `body` (JSON) — chọn một';
  }
  if (init.than !== undefined && (init.method ?? 'GET') !== 'POST') {
    return '`than` chỉ đi với POST';
  }
  return null;
}
