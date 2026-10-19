/**
 * TOTP — NGHIỆM THU BẰNG GROUND TRUTH, không bằng "tự sinh rồi tự kiểm".
 *
 * Điều kiện số 2 trong năm điều kiện founder đặt khi duyệt việc tự viết
 * (03/08): bảng số ở đây chép ĐÚNG từ đặc tả công bố, không phải do code này
 * sinh ra. Đó là khác biệt giữa "test khoá hành vi" và "test khoá SỰ ĐÚNG":
 * một cái chỉ đóng băng thứ ta vừa viết, cái kia so nó với thế giới bên ngoài.
 * Cùng tinh thần A5.2 — số tính tay đi trước, code đi sau.
 *
 * Nguồn:
 *   · RFC 6238 Phụ lục B — bảng TOTP 8 chữ số, HMAC-SHA1, T0=0, X=30.
 *   · RFC 4226 Phụ lục D — bảng HOTP 6 chữ số, counter 0…9. Bảng này kiểm
 *     riêng phép CẮT ĐỘNG, chỗ dễ sai nhất và cũng là chỗ sai âm thầm nhất
 *     (lệch offset vẫn ra 6 chữ số trông rất hợp lệ).
 */
import { describe, it, expect } from 'vitest';
import {
  BUOC_GIAY,
  base32Giai,
  base32Ma,
  buocCua,
  sinhBiMat,
  sinhMa,
  timBuocKhop,
  uriGhiDanh,
} from '../server/auth/totp.js';

/** Hạt giống của cả hai RFC: chuỗi ASCII "12345678901234567890" (20 byte). */
const HAT_ASCII = '12345678901234567890';
const HAT_B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('base32 — cửa vào của mọi thứ còn lại', () => {
  it('hạt giống RFC mã ra đúng chuỗi base32 đã biết', () => {
    // Nếu dòng này sai thì mọi test dưới đây sai theo mà vẫn có thể "khớp
    // nhau" — nên nó phải đứng trước, và phải so với một hằng số bên ngoài.
    expect(base32Ma(Buffer.from(HAT_ASCII, 'ascii'))).toBe(HAT_B32);
  });

  it('mã rồi giải ra đúng byte gốc', () => {
    expect(base32Giai(HAT_B32).toString('ascii')).toBe(HAT_ASCII);
  });

  it('bỏ qua dấu cách/đệm và chấp nhận chữ thường (người dùng chép tay)', () => {
    expect(base32Giai('gezd gnbv gy3t qojq= ').toString('ascii')).toBe('1234567890');
  });

  it('ký tự lạ thì NỔ, không trả im lặng một khoá sai', () => {
    expect(() => base32Giai('GEZD!NBV')).toThrow();
  });
});

describe('RFC 6238 Phụ lục B — bảng TOTP chính thức (SHA-1, 8 chữ số)', () => {
  /** [giây kể từ epoch, mã mong đợi] — chép nguyên từ bảng trong RFC. */
  const BANG: ReadonlyArray<readonly [number, string]> = [
    [59, '94287082'],
    [1_111_111_109, '07081804'],
    [1_111_111_111, '14050471'],
    [1_234_567_890, '89005924'],
    [2_000_000_000, '69279037'],
    [20_000_000_000, '65353130'],
  ];

  for (const [giay, mong] of BANG) {
    it(`T=${giay}s → ${mong}`, () => {
      const buoc = Math.floor(giay / BUOC_GIAY);
      expect(sinhMa(HAT_B32, buoc, 8)).toBe(mong);
    });
  }

  it('bản 6 chữ số là 6 chữ số CUỐI của bản 8 — cùng phép cắt, khác modulo', () => {
    for (const [giay, mong] of BANG) {
      const buoc = Math.floor(giay / BUOC_GIAY);
      expect(sinhMa(HAT_B32, buoc, 6)).toBe(mong.slice(-6));
    }
  });
});

describe('RFC 4226 Phụ lục D — bảng HOTP (kiểm riêng phép cắt động)', () => {
  const BANG = [
    '755224', '287082', '359152', '969429', '338314',
    '254676', '287922', '162583', '399871', '520489',
  ];
  it('counter 0…9 khớp đủ mười giá trị', () => {
    // `sinhMa(bí mật, counter)` chính là HOTP: TOTP chỉ là HOTP với counter =
    // bước thời gian. Test này bắt được lỗi offset mà bảng 6238 có thể bỏ sót.
    expect(BANG.map((_, i) => sinhMa(HAT_B32, i))).toEqual(BANG);
  });
});

describe('timBuocKhop — trả BƯỚC, vì chống dùng lại mã cần con số đó', () => {
  const GIO = 1_111_111_111_000; // ms
  const buoc = buocCua(GIO);

  it('mã đúng của bước hiện tại → trả đúng bước đó', () => {
    expect(timBuocKhop(HAT_B32, sinhMa(HAT_B32, buoc), buoc)).toBe(buoc);
  });

  it('chấp nhận lệch ±1 bước, TỪ CHỐI ±2', () => {
    expect(timBuocKhop(HAT_B32, sinhMa(HAT_B32, buoc - 1), buoc)).toBe(buoc - 1);
    expect(timBuocKhop(HAT_B32, sinhMa(HAT_B32, buoc + 1), buoc)).toBe(buoc + 1);
    // Mỗi bước nới thêm là 30 giây nữa cho một mã đã lộ — nên biên này phải
    // có test, không phải một hằng số ai cũng sửa được cho tiện.
    expect(timBuocKhop(HAT_B32, sinhMa(HAT_B32, buoc - 2), buoc)).toBeNull();
    expect(timBuocKhop(HAT_B32, sinhMa(HAT_B32, buoc + 2), buoc)).toBeNull();
  });

  it('mã sai / sai độ dài / không phải số → null, không ném', () => {
    expect(timBuocKhop(HAT_B32, '000000', buoc)).toBeNull();
    expect(timBuocKhop(HAT_B32, '12345', buoc)).toBeNull();
    expect(timBuocKhop(HAT_B32, '1234567', buoc)).toBeNull();
    expect(timBuocKhop(HAT_B32, 'abcdef', buoc)).toBeNull();
    expect(timBuocKhop(HAT_B32, '', buoc)).toBeNull();
  });

  it('bỏ dấu cách người dùng gõ giữa mã', () => {
    const ma = sinhMa(HAT_B32, buoc);
    expect(timBuocKhop(HAT_B32, `${ma.slice(0, 3)} ${ma.slice(3)}`, buoc)).toBe(buoc);
  });

  it('bí mật KHÁC thì mã KHÔNG khớp', () => {
    expect(timBuocKhop(sinhBiMat(), sinhMa(HAT_B32, buoc), buoc)).toBeNull();
  });
});

describe('sinh bí mật + URI ghi danh', () => {
  it('bí mật 160 bit (RFC 4226) — 32 ký tự base32', () => {
    const b = sinhBiMat();
    expect(b).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Giai(b)).toHaveLength(20);
  });

  it('hai lần sinh không trùng nhau', () => {
    expect(sinhBiMat()).not.toBe(sinhBiMat());
  });

  it('URI đúng dạng otpauth, mang bí mật và chu kỳ', () => {
    const uri = uriGhiDanh('admin@delphi.test', HAT_B32);
    expect(uri.startsWith('otpauth://totp/DELPHI%3Aadmin%40delphi.test?')).toBe(true);
    expect(uri).toContain(`secret=${HAT_B32}`);
    expect(uri).toContain('period=30');
    expect(uri).toContain('digits=6');
  });
});
