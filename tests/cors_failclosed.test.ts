/**
 * CORS FAIL-CLOSED (vá 03/08, đợt kiểm 02/08 bắt được).
 *
 * Bản cũ là `deps.allowedOrigin ?? '*'` — QUÊN đặt biến môi trường thì API mở
 * toang, mà mở toang lại đi kèm `credentials: true`: trang web bất kỳ gọi API
 * kèm cookie phiên của người dùng và ĐỌC được trả lời.
 *
 * Test này khoá HƯỚNG của mặc định. Một cấu hình thiếu phải làm hệ thống chặt
 * hơn, không lỏng hơn — và hướng ấy là thứ dễ bị đảo lại nhất trong một lần
 * "sửa nhanh cho chạy được ở local".
 */
import { describe, expect, it } from 'vitest';
import { chonOrigin } from '../server/app.js';

describe('chonOrigin — vắng cấu hình thì ĐÓNG, không mở', () => {
  it('không khai biến ⇒ KHÔNG origin nào được chấp nhận', () => {
    const cho = chonOrigin(undefined);
    expect(cho('https://ke-xau.example')).toBeNull();
    expect(cho('https://dubao.example.workers.dev')).toBeNull();
  });

  it('chuỗi rỗng / chỉ khoảng trắng cũng là ĐÓNG (không hoá dấu sao)', () => {
    for (const v of ['', '   ', ',', ' , ']) {
      expect(chonOrigin(v)('https://ke-xau.example'), `giá trị ${JSON.stringify(v)}`).toBeNull();
    }
  });

  it('khai đúng gốc ⇒ chỉ gốc ấy qua, gốc khác bị chặn', () => {
    const cho = chonOrigin('https://dubao.example.workers.dev');
    expect(cho('https://dubao.example.workers.dev'))
      .toBe('https://dubao.example.workers.dev');
    expect(cho('https://dubao.example.workers.dev.ke-xau.com')).toBeNull();
    expect(cho('http://dubao.example.workers.dev')).toBeNull(); // khác giao thức
  });

  it('nhận danh sách ngăn bằng dấu phẩy (dev + staging chung một biến)', () => {
    const cho = chonOrigin('http://localhost:5173, https://staging.example');
    expect(cho('http://localhost:5173')).toBe('http://localhost:5173');
    expect(cho('https://staging.example')).toBe('https://staging.example');
    expect(cho('https://khac.example')).toBeNull();
  });

  it('KHÔNG BAO GIỜ trả dấu sao — kể cả khi người ta khai đúng chữ đó', () => {
    /*
     * `*` cộng `credentials: true` là cấu hình trình duyệt vốn từ chối, nên
     * khai nó chỉ tạo cảm giác an toàn giả. Ở đây nó rơi vào nhánh "không
     * khớp" như mọi chuỗi lạ khác — đóng, chứ không mở.
     */
    expect(chonOrigin('*')('https://ke-xau.example')).toBeNull();
  });
});
