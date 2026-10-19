/**
 * PHÁ HOÀ QUỸ VÒNG — vá 04/08.
 *
 * ⚠ Lỗi cũ không nằm ở một phép tính sai mà ở một chữ: chú thích ghi "tất định",
 * và tất định thì đúng — nhưng tất định KHÔNG có nghĩa là công bằng. So chuỗi id
 * ghế nghĩa là ghế người (`'ban'`) đứng trước mọi ghế bot (`'bot_*'`) theo bảng
 * chữ cái, nên người chơi thắng MỌI cú hoà, mọi vòng, mọi trận.
 */
import { describe, it, expect } from 'vitest';
import { luatCua, HOLDEM_BALANCE_VERSION } from '../config/holdem.js';

describe('Phá hoà Quỹ vòng', () => {
  it('⚠ tên ghế người ĐỨNG TRƯỚC mọi tên bot — gốc của thiên vị', () => {
    // Bài này không kiểm code mình viết; nó kiểm SỰ THẬT làm nên cái bug, để
    // người sau đọc là hiểu ngay vì sao phải băm thay vì so chuỗi.
    for (const bot of ['bot_1', 'bot_2', 'bot_7']) {
      expect('ban' < bot, `'ban' phải đứng trước ${bot} — đó là cái bẫy`).toBe(true);
    }
  });

  it('bản đang ship BẬT phá hoà công bằng', () => {
    expect(luatCua(HOLDEM_BALANCE_VERSION).hoaCongBang).toBe(true);
  });

  /*
   * ⚠⚠ CHỐT CHẶN REPLAY. 137 trận trên prod lưu `balance_version` cũ, và kết quả
   * của chúng dựng lại từ `action_log`. Bật cờ cho bản cũ là VIẾT LẠI kết quả đã
   * hiện cho người chơi xem.
   */
  it('MỌI phiên bản cũ vẫn TẮT — không viết lại trận đã lưu', () => {
    for (const v of ['balance-v23-cantroi2', 'balance-v22-botdoctin', 'balance-v10b-nav']) {
      expect(luatCua(v).hoaCongBang, `${v} phải giữ luật cũ`).toBe(false);
    }
  });

  it('phiên bản lạ rơi về TẮT — replay an toàn theo mặc định', () => {
    expect(luatCua('khong-ton-tai').hoaCongBang).toBe(false);
    expect(luatCua(null).hoaCongBang).toBe(false);
  });
});
