import { registerSW } from 'virtual:pwa-register';
import { batTayDiscord, trongDiscord } from './lib/discord';
import { datTokenDiscord, layTokenDiscord } from './lib/discord_phien';
import { api } from './api/client';

import { veApp } from './app/ve_app';

/*
 * ĐĂNG KÝ SERVICE WORKER + KIỂM CẬP NHẬT MỖI KHI QUAY LẠI APP.
 *
 * ⚠ VÌ SAO CẦN PHẦN `visibilitychange`, dù đã có `registerType: 'autoUpdate'`:
 * `registerSW` chỉ kiểm bản mới lúc TRANG ĐƯỢC TẢI. PWA đã cài mà mở lại từ nền
 * thì KHÔNG có lần tải trang nào — nên nó chạy bản đã cache vô thời hạn.
 *
 * Đây là lỗi ĐÃ XẢY RA THẬT 27/07: founder mở trên PC thấy nhãn mới "All-in",
 * mở trên điện thoại vẫn thấy nhãn cũ "DỒN HẾT VỐN". Cùng một URL, cùng một
 * bundle được phục vụ — khác nhau vì điện thoại chạy bản cũ trong cache. Và bản
 * cũ chính là bản có nhãn 11 ký tự làm vỡ ô, nên nó trông như HAI lỗi (chữ chưa
 * đổi + form lệch) trong khi chỉ là MỘT.
 *
 * Header phía máy chủ đã đúng sẵn (vỏ HTML `no-store`, `sw.js`
 * `must-revalidate`, asset băm `immutable`) — thiếu đúng cái CỚ để đi kiểm.
 *
 * Chỉ gọi `update()`, KHÔNG tự `location.reload()`: reload ngay có thể cắt
 * ngang một trận đang chơi. `skipWaiting` + `clientsClaim` lo phần còn lại ở
 * lần điều hướng kế tiếp.
 */
/*
 * ⚠⚠ KHÔNG ĐĂNG KÝ SERVICE WORKER TRONG ACTIVITY DISCORD.
 *
 * `navigateFallbackDenylist` là các regex NEO ĐẦU CHUỖI (`/^\/api\//`). Discord
 * phục vụ Activity qua proxy có tiền tố đường dẫn, nên đường thật không còn khớp
 * ⇒ SW nuốt request API và trả `index.html` từ cache; request KHÔNG BAO GIỜ ra
 * tới mạng, và không có lỗi nào để lần theo.
 * ⚠ Bug này ĐÃ XẢY RA NGUYÊN VĂN với `/admin` ngày 19/07. Lần thứ hai, cùng cơ chế.
 *
 * Tắt đi không mất gì: PWA installable (`display: standalone`, `start_url: '/'`)
 * vốn vô nghĩa trong một iframe, và đăng ký thêm chỉ đẻ ra một bản cache thứ hai
 * để có ngày lệch với bản chính.
 */
if (!trongDiscord()) {
  const capNhatSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, dangKy) {
      if (!dangKy) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void dangKy.update();
      });
    },
  });
  void capNhatSW;
}

/**
 * Bắt tay Discord TRƯỚC khi render — nếu đang ở trong Activity.
 *
 * ⚠ VÌ SAO PHẢI TRƯỚC: màn đầu tiên gọi `/auth/me` ngay lúc dựng. Chưa có token
 * thì nó ăn 401 và app rơi vào màn đăng nhập — người chơi thấy một biểu mẫu
 * email trong Discord, đúng cái mà cả thiết kế "một cú bấm" sinh ra để tránh.
 *
 * ⚠ HỎNG THÌ VẪN RENDER. Bắt tay thất bại (mạng, Discord đổi API, chưa cấu hình
 * `client_id`) mà chặn luôn việc render là biến một cửa phụ thành điểm chết của
 * cả app. Rơi về luồng web bình thường: xấu hơn, nhưng còn chơi được.
 */
/** Phiên đã lưu còn sống không. Hỏi máy chủ, không đoán từ hạn trong token. */
async function phienConSong(): Promise<boolean> {
  try {
    await api('/auth/me');
    return true;
  } catch {
    return false;
  }
}

/**
 * VÀO ĐƯỢC BẰNG MỌI GIÁ, THEO ĐÚNG THỨ TỰ ƯU TIÊN — cửa Discord (founder 04/08:
 * *"làm cơ chế đăng nhập thuận tiện cho người dùng discord"*).
 *
 *   1. phiên đã lưu của lượt mở trước  → cùng một người, giữ được lịch sử;
 *   2. bắt tay Discord                 → danh tính thật, và GẮN vào tài khoản
 *                                        khách ở (1) nếu có (máy chủ lo);
 *   3. chưa có gì cả                   → vào KHÁCH, KHÔNG HỎI GÌ.
 *
 * ⚠⚠ (3) là điểm chính, và nó sửa một thứ tệ hơn cả lỗi: trước đây bắt tay hỏng
 * thì người chơi rơi vào **màn đăng nhập email trong một iframe Discord** — đúng
 * cái mà cả thiết kế "một cú bấm" sinh ra để tránh, và trong Discord thì còn tệ
 * hơn vì bàn phím email giữa một cửa sổ voice là chỗ người ta bỏ đi.
 *
 * ⚠ Thứ tự (1) TRƯỚC (2) là có chủ ý: phải có phiên khách trong tay TRƯỚC khi
 * đổi mã, thì máy chủ mới gắn được danh tính Discord vào chính tài khoản ấy thay
 * vì đẻ tài khoản thứ hai. Đảo lại là mở đúng cửa một chiều mà D64 luật 3 cấm.
 *
 * ⚠ MỌI NHÁNH ĐỀU KHÔNG ĐƯỢC CHẶN RENDER. Hỏng ở đây thì app vẫn phải hiện ra —
 * bài học `#root` rỗng vĩnh viễn (04/08) mới trả giá xong.
 */
async function vaoCuaDiscord(): Promise<void> {
  // (1) phiên cũ — token đọc sẵn từ kho lúc nạp module `discord_phien`.
  if (layTokenDiscord() && !(await phienConSong())) datTokenDiscord(null);

  // (2) bắt tay. Mỗi bước tự ghi telemetry khi chết, nên ở đây không log thêm.
  try {
    const phien = await batTayDiscord({
      clientId: import.meta.env.VITE_DISCORD_CLIENT_ID as string,
      doiMa: (code) =>
        api<{ access_token: string; token: string; moi: boolean }>(
          '/auth/discord/token', { method: 'POST', body: { code } },
        ).then((r) => ({ accessToken: r.access_token, token: r.token, moi: r.moi })),
    });
    if (phien) {
      datTokenDiscord(phien.token);
      return;
    }
  } catch {
    /* đã ghi `loi_client` theo từng bước trong `batTayDiscord` */
  }

  /*
   * (3) Vẫn chưa có phiên nào ⇒ MỞ CỬA VÀO, không tự cấp tài khoản khách.
   *
   * ⚠⚠ ĐÂY LÀ CHỖ ĐI LÙI SO VỚI BẢN SÁNG NAY, VÀ LÙI CÓ CHỦ Ý (founder 04/08:
   * *"đăng ký hay điều khoản phải đặt ở ngay đầu sau khi người chơi mở app
   * chứ"*). Bản sáng tự tạo tài khoản khách trước khi render — 0 thao tác, nhưng
   * cái giá là người chơi bị PHÁT một danh tính mà chưa từng được hỏi, và không
   * bao giờ nhìn thấy điều khoản.
   *
   * Nay: mở lần đầu thì thấy cửa vào (CHƠI NGAY · đăng nhập · đăng ký · điều
   * khoản). Một thao tác thay vì không, và đổi lại người ta biết mình đang bước
   * vào cái gì. D64 phương án B không bị đụng: vẫn KHÔNG hỏi gì trước trận đầu.
   *
   * ⚠ Chỉ áp cho LẦN MỞ ĐẦU. Ai đã có phiên (bước 1) hoặc bắt tay Discord chạy
   * được (bước 2) thì vào thẳng — cửa này không mọc lại mỗi lần mở app.
   *
   * ⚠ Đổi URL TRƯỚC khi dựng router, và điều đó an toàn vì `trong_discord.ts`
   * đã chốt `frame_id` lúc nạp module — mất query string ở đây không làm app
   * tưởng mình đã ra khỏi Activity (đúng cái bug 04/08 đã vá).
   */
  if (layTokenDiscord()) return;
  try {
    window.history.replaceState({}, '', '/onboard');
  } catch {
    /* trình duyệt chặn thì thôi — app vẫn render ở Hub, nút đăng ký vẫn ở đó */
  }
}

async function khoiDong(): Promise<void> {
  if (trongDiscord()) await vaoCuaDiscord();
  veApp(document.getElementById('root')!);
}

void khoiDong();
