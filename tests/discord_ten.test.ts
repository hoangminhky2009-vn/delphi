/**
 * TÊN HIỂN THỊ CHO NGƯỜI VÀO TỪ DISCORD (bản yêu cầu 02, founder chốt phương án A).
 *
 * Hàm thuần, không cần DB — chạy nhanh, và đó là chủ ý: phần dễ sai nhất của cả
 * cửa Discord là chuyển đổi chuỗi, mà chuyển đổi chuỗi thì không cần Postgres để
 * kiểm.
 */
import { describe, it, expect } from 'vitest';
import { AUTH, handleBlockReason } from '../config/auth.js';
import { DISCORD, boDau, handleTuTenDiscord, tenDuPhong } from '../config/discord.js';

describe('I. Bỏ dấu tiếng Việt', () => {
  /*
   * ⚠ BÀI ĐÁNG GIÁ NHẤT FILE NÀY. `đ` KHÔNG phải chữ có dấu tổ hợp — nó là một
   * ký tự riêng, `normalize('NFD')` không tách ra được. Quên xử tay thì nó rơi
   * vào nhóm "ký tự lạ" và biến thành gạch dưới, tức tên người Việt bị cắt cụt
   * MỘT CÁCH IM LẶNG. Với app cho người Việt thì đây không phải trường hợp hiếm.
   */
  it('đ/Đ phải thành d/D — NFD không làm hộ việc này', () => {
    expect(boDau('đức')).toBe('duc');
    expect(boDau('Đạt')).toBe('Dat');
    expect(boDau('đười ươi')).toBe('duoi uoi');
  });

  it('mọi dấu tiếng Việt đều rụng, chữ cái giữ nguyên', () => {
    expect(boDau('Nguyễn Hoàng Minh')).toBe('Nguyen Hoang Minh');
    expect(boDau('ăâêôơưáàảãạ')).toBe('aaeoouaaaaa');
  });
});

describe('II. Đổi tên Discord thành handle', () => {
  it('tên Việt có dấu và có hoa vẫn nhận ra được', () => {
    expect(handleTuTenDiscord('Nguyễn Hoàng Minh')).toBe('nguyen_hoang_minh');
    expect(handleTuTenDiscord('Đức Anh')).toBe('duc_anh');
  });

  it('ký tự lạ thành gạch dưới, không để lại gạch thừa ở hai đầu', () => {
    expect(handleTuTenDiscord('.minh.hoang.')).toBe('minh_hoang');
    expect(handleTuTenDiscord('cool!!!guy')).toBe('cool_guy');
    expect(handleTuTenDiscord('a___b')).toBe('a_b');
  });

  it('cắt đúng trần 20 ký tự và không để lại gạch dưới ở đuôi', () => {
    const ra = handleTuTenDiscord('Nguyen Hoang Minh Quan Thanh Pho Ho Chi Minh')!;
    expect(ra.length).toBeLessThanOrEqual(20);
    expect(ra.endsWith('_')).toBe(false);
    expect(AUTH.HANDLE_PATTERN.test(ra)).toBe(true);
  });

  it('tên không cứu được → null, KHÔNG tự bịa ra tên gần giống', () => {
    // Dưới 3 ký tự sau khi lọc: đệm thêm là bịa ra một cái tên khác rồi vờ như
    // đó là tên của họ.
    expect(handleTuTenDiscord('ab')).toBeNull();
    expect(handleTuTenDiscord('🎮🎮🎮')).toBeNull();
    expect(handleTuTenDiscord('')).toBeNull();
    expect(handleTuTenDiscord(null as unknown as string)).toBeNull();
  });

  /*
   * ⚠⚠ CHỐT CHẶN CHÍNH CỦA CẢ FILE. D25/R2 dựng blocklist hai tầng rồi đặt mục
   * nghiệm thu "0 handle cũ vi phạm" TRƯỚC khi hiện tên cho người lạ. Cửa Discord
   * mà bỏ qua nó thì đó là một đường vòng quanh chính hàng rào ấy — và đường vòng
   * này còn tự động, không cần ai cố ý.
   */
  it('tên vi phạm blocklist → null, cửa Discord KHÔNG đi vòng qua D25/R2', () => {
    // Tìm một mục blocklist thật để bài test không phụ thuộc một từ gõ tay.
    const mau = ['suckmydik', 'dubao'].find((t) => handleBlockReason(t) !== null);
    expect(mau, 'không tìm được mẫu blocklist để kiểm — bài này mất tác dụng').toBeTruthy();
    expect(handleTuTenDiscord(mau!)).toBeNull();
  });

  it('kết quả LUÔN qua được cửa mà server dùng cho handle web', () => {
    const mau = ['Nguyễn Văn A', 'xX_Dark_Xx', 'ăn.cơm.chưa', 'Minh2009', 'ĐẠT_9'];
    for (const t of mau) {
      const h = handleTuTenDiscord(t);
      if (h === null) continue;
      expect(AUTH.HANDLE_PATTERN.test(h), `hỏng ở: ${t} → ${h}`).toBe(true);
      expect(handleBlockReason(h), `hỏng ở: ${t} → ${h}`).toBeNull();
    }
  });
});

describe('III. Tên dự phòng', () => {
  it('vừa trần 20 ký tự và qua được cả hai cửa', () => {
    const t = tenDuPhong(() => 'a1b2c3');
    expect(t).toBe('nguoi_choi_a1b2c3');
    expect(t.length).toBeLessThanOrEqual(20);
    expect(AUTH.HANDLE_PATTERN.test(t)).toBe(true);
    expect(handleBlockReason(t)).toBeNull();
  });

  it('nguồn ngẫu nhiên trả chuỗi ngắn/bẩn vẫn ra tên hợp lệ', () => {
    // Không tin đầu vào kể cả khi đầu vào là của chính mình.
    expect(AUTH.HANDLE_PATTERN.test(tenDuPhong(() => ''))).toBe(true);
    expect(AUTH.HANDLE_PATTERN.test(tenDuPhong(() => '!!'))).toBe(true);
    expect(tenDuPhong(() => 'ABCDEFGHIJK').length).toBe(
      DISCORD.TEN_DU_PHONG_TIEN_TO.length + DISCORD.TEN_DU_PHONG_SO_KY_TU,
    );
  });
});
