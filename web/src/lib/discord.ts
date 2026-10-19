/**
 * CỬA DISCORD — PHÍA MÁY NGƯỜI CHƠI (bản yêu cầu 02, mùa 0.0).
 *
 * Module này CHỈ lo ba việc: nhận biết đang chạy trong Discord · bắt tay với
 * Discord client · lấy mã uỷ quyền đưa về máy chủ. Nó KHÔNG biết gì về trận đấu,
 * và KHÔNG được biết — Đấu trường phải chạy y hệt dù vào từ web hay từ Discord
 * (C6: UI tách khỏi tầng dữ liệu).
 *
 * ─── BA CHỖ DỄ MẤT MỘT NGÀY, tra ra 04/08 ───────────────────────────────────
 *
 * 1. ⚠⚠ `new DiscordSDK(...)` NÉM LỖI khi URL thiếu `frame_id`/`instance_id`/
 *    `platform`. Gọi vô điều kiện ở tầng import là **bản web thường trắng màn
 *    ngay dòng import** — hỏng ở chỗ chẳng liên quan gì tới Discord. Nên phải
 *    nhận biết môi trường TRƯỚC, và nạp SDK bằng `import()` động để bundle của
 *    web thường thậm chí không tải nó về.
 *
 * 2. ⚠⚠ `commands.authenticate()` **KHÔNG tạo phiên với máy chủ của mình**. Nó
 *    chỉ mở phiên RPC với Discord client để các lệnh khác không bị từ chối.
 *    Phiên DELPHI vẫn phải do máy chủ cấp — và vì cookie `SameSite=Lax` chết
 *    trong iframe nên phải mang bằng `Authorization: Bearer`.
 *    Nhầm chỗ này thì mọi thứ "trông như đã đăng nhập" mà mọi request đều 401.
 *
 * 3. ⚠ `instanceId` **KHÔNG BỀN**: mọi người rời hết là instance chết và **không
 *    bao giờ tái sử dụng**; lần mở sau trong cùng kênh sinh mã MỚI. Dùng nó làm
 *    KHOÁ ĐỂ TÌM NHAU thì đúng; dùng làm khoá bền của một trận thì hỏng.
 */

import { ghiDo } from './telemetry';
import { DISCORD } from '@config/discord';
import { MA_TOI_DA } from '@config/telemetry';
import { nenTangGon, trongDiscord } from './trong_discord';

/*
 * `trongDiscord` sống ở `lib/trong_discord.ts` (module không import gì) vì ba
 * chỗ cần hỏi và không được trả lời khác nhau — xem lý do dài ở đó. Xuất lại ở
 * đây để chỗ gọi cũ không phải đổi.
 */
export { trongDiscord };

/**
 * Đọc RA LÝ DO của một cú ném, kể cả khi nó không phải `Error`.
 *
 * ⚠⚠ CHỖ NÀY VỪA LÀM MÙ MỘT NGÀY ĐO, và lỗi là của chính bản vá sáng 04/08.
 * Bản đó viết `e instanceof Error ? name+message : String(e)` — nhưng **SDK
 * Discord từ chối bằng một OBJECT THUẦN**, nên `String(e)` ra `[object Object]`.
 * Prod ghi đúng ba dòng vô nghĩa:
 *     discord:authorize:-object-object-   ×3
 * Tức vẫn không ai biết `authorize` chết vì sao — đúng cái mù mà cả cơ chế đánh
 * dấu từng bước sinh ra để xoá, chỉ lùi thêm một lớp.
 *
 * Lỗi RPC của Discord có hình `{ code: 4006, message: "..." }`, đôi khi
 * `{ error: "..." }`. Nên phải MOI TỪNG TRƯỜNG, không được trông vào `String()`.
 */
export function moTaLoi(e: unknown): string {
  if (e instanceof Error) return `${e.name} ${e.message}`;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    const phan = ['code', 'name', 'error', 'message', 'reason']
      .map((k) => (o[k] === undefined || o[k] === null ? null : `${k}=${String(o[k])}`))
      .filter(Boolean);
    // Không moi được trường nào thì đọc khoá — vẫn hơn `[object Object]`.
    return phan.length > 0 ? phan.join(' ') : `keys ${Object.keys(o).join(',')}`;
  }
  return String(e ?? '');
}

/**
 * Mã lỗi telemetry cho một bước bắt tay: `dc.<nền tảng>:<bước>:<lý do>`.
 *
 * ⚠⚠ CẮT THEO TRẦN THẬT, KHÔNG CẮT THEO MỘT CON SỐ ĐOÁN. `chi_tiet.ma` phải
 * khớp `MAU_MA` — tối đa **40 ký tự** — và máy chủ BỎ IM LẶNG cả trường nếu
 * vượt (A9: khoá lạ/ giá trị sai hình dạng → bỏ, không 4xx).
 *
 * Bản sáng 04/08 cắt lý do ở 48 ký tự rồi ghép sau tiền tố `discord:authorize:`
 * (18 ký tự) ⇒ tối đa 66. Nó chỉ lọt vì lý do thật hôm đó ngắn tũn
 * (`-object-object-`); một thông điệp Discord dài hơn sẽ bị **vứt nguyên dòng lý
 * do** đúng lúc cần nó nhất. Nên trần phải TÍNH RA từ tiền tố, không gõ tay.
 */
export function maLoiDiscord(buoc: string, e: unknown): string {
  const dau = `dc.${nenTangGon()}:${buoc}:`;
  const con = Math.max(0, MA_TOI_DA - dau.length);
  const ly = moTaLoi(e)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')     // C7: chỉ chữ–số–gạch, không @ không dấu cách
    .replace(/^-+/, '')
    .slice(0, con)
    .replace(/-+$/, '');
  return `${dau}${ly}`;
}

/** Thứ lấy được sau khi bắt tay xong. */
export interface PhienDiscord {
  /** Mã một LƯỢT MỞ Activity. Không bền — xem chú thích (3) đầu file. */
  instanceId: string;
  channelId: string | null;
  guildId: string | null;
  /** Token phiên DELPHI, mang bằng `Authorization: Bearer`. */
  token: string;
  /** Có phải tài khoản vừa được tạo không — dùng để quyết có hỏi bậc 1 hay chưa. */
  moi: boolean;
}

/**
 * Chỗ cắm để test không cần Discord thật.
 *
 * ⚠⚠ `doiMa` trả về HAI TOKEN, và lẫn chúng là lỗi tôi vừa tự mắc ngay sau khi
 * viết cảnh báo ở đầu file — nên ghi thẳng vào kiểu dữ liệu để lần sau trình
 * biên dịch bắt hộ, đừng trông vào trí nhớ:
 *   · `accessToken` — CỦA DISCORD, chỉ dùng cho `commands.authenticate()`.
 *   · `token` — CỦA DELPHI, chỉ dùng cho `Authorization: Bearer`.
 * Đưa nhầm nhau thì không có lỗi biên dịch, không có lỗi lúc chạy — chỉ là mọi
 * request đều 401 trong khi màn hình trông như đã đăng nhập xong.
 */
export interface CuaDiscord {
  clientId: string;
  doiMa: (code: string) => Promise<{ accessToken: string; token: string; moi: boolean }>;
  /** Nạp SDK. Mặc định `import()` động; test tiêm bản giả. */
  napSdk?: () => Promise<any>;
}

/**
 * Bắt tay trọn vẹn. Trả `null` nếu KHÔNG chạy trong Discord — người gọi cứ đi
 * tiếp bằng luồng web bình thường.
 *
 * ⚠ Thứ tự dưới đây KHÔNG ĐẢO ĐƯỢC, và mỗi bước hỏng theo một kiểu khác nhau:
 *   new → ready() → authorize() → [máy chủ] → authenticate()
 */
/** Đồng hồ hết giờ cho một bước bắt tay. Chỉ ném, không bao giờ trả về. */
function heHan(ten: string, ms: number): Promise<never> {
  return new Promise<never>((_, tuChoi) => {
    setTimeout(() => tuChoi(new Error(`qua han ${ten} ${ms}ms`)), ms);
  });
}

export async function batTayDiscord(cua: CuaDiscord): Promise<PhienDiscord | null> {
  if (!trongDiscord()) return null;

  /*
   * ⚠⚠ MỖI BƯỚC PHẢI KHAI TÊN KHI NÓ CHẾT (vá 04/08).
   *
   * Đo trên prod hôm nay: `auth_identities` = 0 trong khi telemetry có đủ
   * `man_vao`/`phien_mo` — tức app CHẠY trong Discord nhưng bắt tay chưa bao
   * giờ tới máy chủ. Và không ai biết nó chết ở đâu, vì người gọi bắt lỗi rồi
   * `console.error` — mà console của một iframe trong Discord thì gần như
   * không ai mở tới.
   *
   * Năm bước dưới đây hỏng theo NĂM KIỂU khác nhau (SDK không nạp được · chưa
   * bắt tay được với client · người dùng chưa cấp quyền · máy chủ từ chối đổi
   * mã · phiên RPC không mở). Một dòng "bắt tay hỏng" không phân biệt được
   * chúng, nên phải đánh dấu TỪNG bước.
   *
   * `ghiDo` không bao giờ ném (xem `lib/telemetry`), nên bọc thế này không đẻ
   * ra đường hỏng mới.
   */
  const buoc = async <T>(
    ten: string,
    f: () => Promise<T>,
    hanMs: number = DISCORD.HAN_BUOC_MAY_MS,
  ): Promise<T> => {
    try {
      /*
       * ⚠⚠ HẠN CHỜ, vì `try/catch` KHÔNG BẮT ĐƯỢC TREO — và treo ở đây ăn cả màn
       * hình đầu tiên: `main.tsx` chờ hàm này xong rồi mới render, nên một bước
       * không bao giờ trả lời là `#root` rỗng vĩnh viễn, không lỗi, không nút.
       * Đo được 04/08 bằng cách nạp app với `frame_id` mà không có Discord client.
       *
       * Hết hạn thì NÉM, để nó đi đúng đường lỗi đã có bên dưới — cùng một mã
       * telemetry, thêm hậu tố `qua-han` nên đọc trên dashboard là biết ngay
       * "chết vì im lặng" khác "chết vì bị từ chối".
       */
      return await Promise.race([f(), heHan(ten, hanMs)]);
    } catch (e) {
      /*
       * Kèm LÝ DO, không chỉ tên bước. `maLoi` băm thông điệp — đúng cho lỗi
       * render (có thể lẫn nội dung người dùng), nhưng lỗi của SDK Discord thì
       * thông điệp CHÍNH LÀ câu trả lời ("chưa cấp quyền", "sai scope",
       * "redirect không khớp"). Băm nó đi là vứt đúng thứ cần.
       *
       * ⚠ Làm sạch trước khi gửi (C7): chỉ giữ chữ–số–gạch, cắt 48 ký tự.
       * Thông điệp SDK không chứa PII, nhưng danh sách trắng phải là thứ CODE
       * bảo đảm chứ không phải thứ ta tin.
       */
      /*
       * ⚠ NỀN TẢNG nằm NGAY TRONG MÃ. `chi_tiet` là danh sách trắng KHOÁ (A9,
       * loại này chỉ có `ma`), nên thêm một cột là đổi schema; nhét hai ký tự vào
       * mã thì không đổi gì mà trả lời được đúng câu founder hỏi — *"sao không mở
       * được trên discord mobile"*. Trước dòng này, lỗi từ điện thoại và lỗi từ
       * máy tính trông GIỐNG HỆT nhau trên dashboard.
       */
      ghiDo('loi_client', { chi_tiet: { ma: maLoiDiscord(ten, e) } } );
      throw e;
    }
  };

  const nap = cua.napSdk ?? (() => import('@discord/embedded-app-sdk'));
  const { DiscordSDK } = await buoc('nap-sdk', nap);
  /*
   * ⚠ `new DiscordSDK(...)` NÉM khi thiếu `frame_id`/`instance_id`/`platform`
   * hoặc khi `clientId` rỗng (quên `VITE_DISCORD_CLIENT_ID` lúc build) — xem chú
   * thích (1) đầu file. Đứng ngoài `buoc` thì nó chết KHÔNG ĐỂ LẠI DÒNG NÀO, tức
   * đúng cái mù mà cả cơ chế đánh dấu từng bước sinh ra để xoá.
   */
  const sdk = await buoc('khoi-tao', async () => new DiscordSDK(cua.clientId));

  // `ready()` là mốc handshake, và cũng là lúc màn hình chờ của Discord tắt.
  // Mọi lệnh `commands.*` gọi trước mốc này đều không tin được.
  await buoc('ready', () => sdk.ready());

  const { code } = (await buoc('authorize', () => sdk.commands.authorize({
    client_id: cua.clientId,
    response_type: 'code',
    state: '',
    /*
     * ⚠⚠ BỎ `prompt: 'none'` (04/08) — ĐO RA NÓ CHÍNH LÀ CHỖ CHẾT.
     *
     * Telemetry prod sau khi cắm mốc từng bước: `discord:authorize` bắn 4 lần
     * liên tiếp, `auth_identities` vẫn 0 — kể cả SAU khi tài khoản founder đã
     * bấm Phê duyệt trong hộp cấp quyền của Discord.
     *
     * `prompt: 'none'` nghĩa là "đừng hỏi gì cả, im lặng cấp mã" — nên khi
     * Discord vì bất cứ lý do gì không cấp được im lặng, nó KHÔNG hiện hộp mà
     * NÉM LỖI. Với người dùng mới thì nó luôn ném: chưa ai từng cấp quyền, mà
     * cờ này lại cấm hỏi. Đây đúng là lý do `auth_identities` rỗng từ đầu tới
     * giờ — cửa vào bị khoá bằng chính cái cờ đặt ra để cho mượt.
     *
     * Bỏ cờ đi thì Discord tự chọn: đã cấp quyền rồi thì vẫn im lặng qua luôn,
     * chưa cấp thì hiện hộp NGAY TRONG Activity. Không mất gì, và mở được cửa.
     */
    // Xin ÍT NHẤT CÓ THỂ (C7). `identify` chỉ cho biết "người này là ai" —
    // không email, không danh sách server. Và Discord KHÔNG cấp năm sinh ở bất
    // kỳ scope nào, nên age gate C8 vẫn phải tự hỏi ở bậc 1.
    scope: ['identify'],
    /*
     * ⚠ HẠN CỦA NGƯỜI, KHÔNG PHẢI HẠN CỦA MÁY. Bước này dừng lại chờ người bấm
     * Phê duyệt; kẹp nó bằng 8 giây là tự tay giết hộp cấp quyền đúng lúc người
     * ta đang đọc — và giết đúng cái cửa vừa mở ra được sáng nay.
     */
  }), DISCORD.HAN_BUOC_NGUOI_MS)) as { code: string };

  // Đổi mã Ở MÁY CHỦ. `client_secret` không bao giờ được có mặt trong bundle này.
  const { accessToken, token, moi } = await buoc('doi-ma', () => cua.doiMa(code));

  /*
   * Bước cuối mở phiên RPC với Discord client. Không có nó thì các lệnh sau
   * (đọc danh sách người trong Activity) bị từ chối.
   *
   * ⚠⚠ ĐƯA `accessToken` CỦA DISCORD VÀO ĐÂY, KHÔNG PHẢI `token` CỦA DELPHI.
   * Nó KHÔNG thay cho phiên DELPHI — xem chú thích (2) đầu file.
   */
  await buoc('authenticate', () => sdk.commands.authenticate({ access_token: accessToken }));

  return {
    instanceId: sdk.instanceId,
    channelId: sdk.channelId ?? null,
    guildId: sdk.guildId ?? null,
    token,
    moi,
  };
}
