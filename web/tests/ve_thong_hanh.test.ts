/**
 * VÉ THÔNG HÀNH CỦA CỔNG HÀNG CHỜ — round-trip KÝ → KIỂM.
 *
 * ⚠⚠ BÀI NÀY SINH RA TỪ MỘT SỰ CỐ PROD (06/09, D293). `khoa()` import khoá HMAC
 * với quyền `['sign']`, rồi `kiemVe` gọi `crypto.subtle.verify` bằng đúng khoá
 * đó ⇒ WebCrypto ném `InvalidAccessError`. Mọi request mang cookie `dp_pass`
 * thành **500**.
 *
 * ⭐ VÌ SAO KHÔNG AI THẤY: request ĐẦU TIÊN không có cookie nên không kiểm gì cả
 * ⇒ 200, rồi Worker phát vé. Chỉ request THỨ HAI trở đi mới nổ. Mở trang một
 * lần bằng cửa sổ ẩn danh thì thấy "chạy tốt"; người đang dùng thì hỏng sạch.
 * `cong.test.ts` cũng không bắt được vì nó test phần TOÁN thuần của hàng chờ —
 * chỗ gãy nằm ở lớp crypto, và lớp đó chưa có bài nào.
 *
 * Bài học rộng hơn: **ký và kiểm phải được test CÙNG NHAU**. Một bài chỉ ký
 * (hoặc chỉ kiểm bằng chữ ký chép sẵn) sẽ xanh với đúng cái lỗi này.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error — worker là JS thuần, không có khai báo kiểu
import { kiemVe, kyVe } from '../worker/index.js';

const BEM = 'bi-mat-thu-nghiem-dai-ngoang-cho-giong-that';
const NOW = 1_800_000_000_000;

describe('vé thông hành — ký rồi kiểm phải khớp', () => {
  it('⭐ ROUND-TRIP: ký xong kiểm lại được, KHÔNG ném', async () => {
    const hetHan = NOW + 60_000;
    const pass = await kyVe('ve-42', hetHan, BEM);
    // Chính dòng dưới đây ném `InvalidAccessError` trước bản vá.
    await expect(kiemVe(pass, 've-42', BEM, NOW)).resolves.toBe(hetHan);
  });

  it('vé HẾT HẠN ⇒ null, không ném', async () => {
    const pass = await kyVe('ve-42', NOW - 1, BEM);
    await expect(kiemVe(pass, 've-42', BEM, NOW)).resolves.toBeNull();
  });

  it('vé của NGƯỜI KHÁC (khác mã vé) ⇒ null', async () => {
    const pass = await kyVe('ve-42', NOW + 60_000, BEM);
    await expect(kiemVe(pass, 've-43', BEM, NOW)).resolves.toBeNull();
  });

  it('⭐ chữ ký GIẢ ⇒ null — đây là thứ duy nhất chặn người tự phát vé nhảy hàng', async () => {
    const that = await kyVe('ve-42', NOW + 60_000, BEM);
    const gia = await kyVe('ve-42', NOW + 60_000, 'bi-mat-khac-hoan-toan');
    expect(gia).not.toBe(that);
    await expect(kiemVe(gia, 've-42', BEM, NOW)).resolves.toBeNull();
  });

  it('đầu vào rác ⇒ null, không ném (cookie hỏng không được làm sập request)', async () => {
    for (const rac of ['', 'a', 'a.b', 'a.b.c.d', 've-42.khong-phai-so.xxx']) {
      await expect(kiemVe(rac, 've-42', BEM, NOW)).resolves.toBeNull();
    }
  });
});

describe('⭐ kiemVe KHÔNG ĐƯỢC NÉM — fail-open, cùng nếp lời gọi Durable Object', () => {
  /*
   * Sự cố 06/09 thành sập TOÀN PHẦN chỉ vì một lời gọi crypto không được bọc.
   * `hoiCua` ngay bên dưới đã có `try/catch` với lý lẽ "cửa hỏng ⇒ mở toang";
   * `kiemVe` thì không. Bài này khoá lại tính chất ấy: mọi đầu vào bệnh hoạn
   * đều phải ra `null`, không bao giờ ném — vì một ngoại lệ ở đây = 500 cho
   * mọi người đang có phiên.
   */
  it('chữ ký base64 hỏng ⇒ null, KHÔNG ném', async () => {
    const hetHan = NOW + 60_000;
    await expect(kiemVe(`ve-42.${hetHan}.@@@khong-phai-base64@@@`, 've-42', BEM, NOW))
      .resolves.toBeNull();
  });

  it('chữ ký rỗng ⇒ null, KHÔNG ném', async () => {
    await expect(kiemVe(`ve-42.${NOW + 60_000}.`, 've-42', BEM, NOW)).resolves.toBeNull();
  });

  it('bí mật rỗng ⇒ null, KHÔNG ném (cấu hình sai không được làm sập app)', async () => {
    const pass = await kyVe('ve-42', NOW + 60_000, BEM);
    await expect(kiemVe(pass, 've-42', '', NOW)).resolves.toBeNull();
  });
});
