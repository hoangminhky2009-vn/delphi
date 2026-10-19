/**
 * PFM — ĐỒNG HỒ (`thoi_gian.ts`, GĐ1).
 *
 * Bài quan trọng nhất ở đây KHÔNG phải "hàm trả đúng định dạng" mà là hai ràng buộc
 * liên module: id phải lọt được cửa kiểm CỦA SERVER, và `ngayCua` phải theo giờ ĐỊA
 * PHƯƠNG chứ không phải UTC.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { bayGio, homNay, thangNay, ngayCua, sinhId } from '../src/pfm/thoi_gian.js';
import { khoaMon, type MonHangDoi } from '../src/pfm/dong_bo.js';
import { kiemPhongBiMon } from '@config/pfm_dong_bo';

afterEach(() => { vi.useRealTimers(); });

describe('§I — ngayCua: giờ ĐỊA PHƯƠNG, không phải UTC', () => {
  it('⭐⭐ 0h30 sáng giờ địa phương vẫn là NGÀY HÔM NAY, không lùi một ngày', () => {
    /*
     * ⚠ ĐÂY LÀ BÀI CHỐNG ĐÚNG MỘT DÒNG SAI: `toISOString().slice(0,10)` trả ngày theo
     * UTC, nên với người dùng ở UTC+7 thì từ 0h đến 7h sáng nó **lùi lại một ngày**.
     * Lỗi chỉ xuất hiện buổi sáng sớm — không ai tái hiện được lúc 3 giờ chiều, và mọi
     * khoản chi ghi lúc đó rơi nhầm sang hôm qua.
     */
    const d = new Date(2026, 8, 5, 0, 30);       // 05/09/2026, 0h30 giờ MÁY
    expect(ngayCua(d)).toBe('2026-09-05');
  });

  it('23h59 giờ địa phương vẫn là ngày hôm đó', () => {
    expect(ngayCua(new Date(2026, 8, 5, 23, 59))).toBe('2026-09-05');
  });

  it('đệm 0 đủ hai chữ số cho cả tháng lẫn ngày', () => {
    expect(ngayCua(new Date(2026, 0, 3))).toBe('2026-01-03');
  });

  it('⭐ KHÁC hẳn cách tính theo UTC — nếu hai cách trùng nhau thì bài trên rỗng', () => {
    // Chọn một thời điểm mà giờ máy và UTC chắc chắn khác ngày, nếu máy lệch UTC.
    const d = new Date(2026, 8, 5, 0, 30);
    const utc = d.toISOString().slice(0, 10);
    if (d.getTimezoneOffset() !== 0) {
      expect(ngayCua(d), 'máy không ở UTC ⇒ hai cách PHẢI khác nhau').not.toBe(utc);
    } else {
      // Máy chạy test đang ở UTC: bài trên không phân biệt được gì, nói thẳng ra.
      expect(ngayCua(d)).toBe(utc);
    }
  });
});

describe('§II — homNay/thangNay/bayGio bám đồng hồ máy', () => {
  it('homNay theo đồng hồ giả lập, thangNay là sáu ký tự đầu', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 12, 0));
    expect(homNay()).toBe('2026-12-31');
    expect(thangNay()).toBe('2026-12');
  });

  it('bayGio là mốc ISO tuyệt đối (UTC) — khác vai với homNay', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 5, 3, 4, 5)));
    expect(bayGio()).toBe('2026-09-05T03:04:05.000Z');
  });
});

describe('§III — sinhId: hình chữ là GIAO ƯỚC với server, không phải thẩm mỹ', () => {
  it('⭐⭐⭐ khoá hàng đợi dựng từ id PHẢI qua được cửa kiểm của server', () => {
    /*
     * Server chặn `mon_id` bằng `^[A-Za-z0-9_:-]{1,64}$`, và DB thêm
     * `CHECK length BETWEEN 1 AND 64`. Khoá là `nhip:` + id. Gọi thẳng cửa kiểm THẬT
     * của server ở đây là cách rẻ nhất chứng minh hai đầu khớp — đỏ ngay lúc ai đó đổi
     * một bên mà quên bên kia.
     */
    for (let i = 0; i < 200; i++) {
      const m: MonHangDoi = { loai: 'nhip', ma: 'pfm_hu', v: { hu_id: 'h1', ma: 'tao' } };
      const khoa = khoaMon(m, sinhId());
      expect(khoa.length, 'trần 64 của cột mon_id').toBeLessThanOrEqual(64);
      expect(kiemPhongBiMon({ ...m, id: khoa }), `khoá ${khoa} bị server từ chối`).toBeNull();
    }
  });

  it('id chỉ dùng [0-9a-z], dài cố định 20', () => {
    for (let i = 0; i < 200; i++) {
      const id = sinhId();
      expect(id).toMatch(/^[0-9a-z]{20}$/);
    }
  });

  it('⭐ không đụng nhau, kể cả trong cùng một mili-giây', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 5, 12, 0, 0));
    const ds = new Set(Array.from({ length: 2_000 }, () => sinhId()));
    expect(ds.size, 'đồng hồ đứng yên ⇒ phần ngẫu nhiên phải gánh toàn bộ').toBe(2_000);
  });

  it('⭐ tiền tố thời gian ⇒ id TỰ SẮP theo thứ tự tạo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 5, 12, 0, 0));
    const truoc = sinhId();
    vi.setSystemTime(new Date(2026, 8, 5, 12, 0, 1));
    const sau = sinhId();
    expect(truoc < sau, 'so chuỗi phải ra đúng thứ tự thời gian').toBe(true);
  });
});
