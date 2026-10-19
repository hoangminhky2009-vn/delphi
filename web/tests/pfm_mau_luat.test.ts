/**
 * PFM — MẪU LUẬT (`mau_luat.ts`, GĐ1): ba lối tắt đặt luật, một cho mỗi điều kiện.
 *
 * ⚠ Bài đắt nhất ở đây là §II: `loiNhacGoiY` **là app đang nói**, nên nó chịu A10 🔒.
 * Lời nhắc cuối cùng là của người dùng, nhưng cái ĐIỀN SẴN thì do ta viết — và một gợi ý
 * kê đơn sẽ núp sau chữ ký của họ khi họ bấm Lưu mà không sửa.
 */
import { describe, expect, it } from 'vitest';
import {
  MAU_LUAT, NGUONG_GOI_Y, dieuKienThieuMau, mauCanNguong, mauTheoDieuKien, mauTheoId,
} from '../src/pfm/mau_luat.js';
import { DIEU_KIEN, canNguong, taoLuatMoi, LoiLuat } from '../src/pfm/luat.js';
import { TU_KE_DON } from '../src/lib/khoanh_khac';

const LUC = '2026-09-05T10:00:00.000Z';

describe('§I — phủ kín TẬP ĐÓNG điều kiện', () => {
  it('⭐⭐ MỌI điều kiện đều có mẫu — thêm điều kiện mà quên mẫu là bài này đỏ', () => {
    /*
     * `DIEU_KIEN` là tập ĐÓNG (cố ý, để không NLP tự do nào lọt vào), nên phủ kín nó là
     * phủ kín mọi luật đặt được. Không có bài này thì một điều kiện mới sẽ lặng lẽ không
     * có lối tắt nào, và chỉ người dùng phát hiện — bằng cách không tìm thấy nó.
     */
    expect(dieuKienThieuMau()).toEqual([]);
    expect(MAU_LUAT).toHaveLength(DIEU_KIEN.length);
  });

  it('id mẫu không trùng nhau', () => {
    expect(new Set(MAU_LUAT.map((m) => m.id)).size).toBe(MAU_LUAT.length);
  });

  it('`mauTheoId` với id lạc ⇒ null, không ném (id đến từ dữ liệu cũ)', () => {
    expect(mauTheoId('mau_da_go_bo')).toBeNull();
    expect(mauTheoId(null)).toBeNull();
    expect(mauTheoId(undefined)).toBeNull();
  });
});

describe('§II — ⭐⭐⭐ A10 🔒: gợi ý là APP đang nói', () => {
  it('⭐⭐⭐ `loiNhacGoiY` KHÔNG chứa từ kê đơn', () => {
    /*
     * ⚠⚠ Chỗ dễ trượt nhất của cả PFM. `loiNhac` được ghi rõ là *"không bao giờ app tự
     * sáng tác"* (P3 🔒) — nhưng cái ĐIỀN SẴN thì do ta viết, và người dùng bấm Lưu mà
     * không sửa là chuyện thường. Lúc đó một câu kiểu "Đừng mua thêm gì hôm nay" đã đi
     * vào sổ của họ dưới chữ ký của họ.
     * ⚠ Dùng lại `TU_KE_DON` DÙNG CHUNG, không tự chế regex (D61). Bộ này cố ý THÔ — nó
     *   bắt cả "nên" nghĩa liên từ. Guard thô mà chặt đáng tin hơn guard thông minh mà
     *   có lỗ, giá phải trả chỉ là viết content tránh một chữ.
     */
    for (const m of MAU_LUAT) {
      for (const tu of TU_KE_DON) {
        expect(m.loiNhacGoiY.toLowerCase(), `${m.id}.loiNhacGoiY chứa "${tu}"`)
          .not.toContain(tu);
      }
    }
  });

  it('⭐⭐ `viSao` KHÔNG chứa từ kê đơn', () => {
    for (const m of MAU_LUAT) {
      for (const tu of TU_KE_DON) {
        expect(m.viSao.toLowerCase(), `${m.id}.viSao chứa "${tu}"`).not.toContain(tu);
      }
    }
  });

  it('⭐ gợi ý MÔ TẢ hoàn cảnh hoặc ĐẶT CÂU HỎI — không ra lệnh', () => {
    /*
     * Bổ sung cho phép quét từ khoá: một câu mệnh lệnh không nhất thiết chứa từ trong
     * `TU_KE_DON` ("Bỏ khoản này đi"). Ở đây khoá bằng HÌNH: mỗi gợi ý phải có một dấu
     * hỏi — tức nó kết thúc bằng việc trả quyền quyết định lại cho người dùng.
     */
    for (const m of MAU_LUAT) {
      expect(m.loiNhacGoiY, `${m.id}: gợi ý phải đặt câu hỏi`).toContain('?');
    }
  });

  it('mỗi mẫu có tên ngắn và một dòng vì-sao thật', () => {
    for (const m of MAU_LUAT) {
      expect(m.ten.length, `${m.id}: tên trống`).toBeGreaterThan(2);
      expect(m.viSao.length, `${m.id}: thiếu vì-sao-hợp`).toBeGreaterThan(15);
    }
  });
});

describe('§III — ⭐⭐ ngưỡng: MỘT nguồn, và cố ý KHÔNG có gợi ý', () => {
  it('⭐⭐ `mauCanNguong` khớp `canNguong` của `luat.ts` cho MỌI mẫu', () => {
    /*
     * Cùng một câu hỏi trả lời ở hai chỗ thì hai chỗ sẽ trôi, và kiểu trôi này rất êm:
     * màn hình không hiện ô ngưỡng, `taoLuatMoi` ném, người dùng thấy "có lỗi" ở một nút
     * trông chẳng liên quan.
     */
    for (const m of MAU_LUAT) {
      expect(mauCanNguong(m), m.id).toBe(canNguong(m.dieuKien));
    }
  });

  it('⭐⭐⭐ KHÔNG có ngưỡng gợi ý — điền sẵn một con số là thả neo', () => {
    /*
     * ⚠⚠ Điền sẵn một con số "hợp lý" là anchoring đúng nghĩa: người dùng dịch quanh nó
     * thay vì nghĩ từ đầu, nên thứ ta đo về sau hoá ra là **phản ứng với con số của ta**,
     * không phải mức của họ. Nó cũng là một phát biểu ngầm rằng bao nhiêu thì "lớn" —
     * app định nghĩa hộ, đúng thứ A10 cấm.
     */
    expect(NGUONG_GOI_Y).toBeNull();
    expect(JSON.stringify(MAU_LUAT), 'không mẫu nào được chở sẵn một con số')
      .not.toMatch(/nguong|thamSo/);
  });

  it('mẫu cần ngưỡng mà tạo luật không kèm ngưỡng ⇒ NÉM (chốt thật ở `luat.ts`)', () => {
    const m = MAU_LUAT.find((x) => mauCanNguong(x))!;
    expect(() => taoLuatMoi(
      { loiNhac: m.loiNhacGoiY, dieuKien: m.dieuKien, mauId: m.id }, LUC, 'l1'))
      .toThrow(LoiLuat);
  });
});

describe('§IV — mẫu dựng được một luật THẬT', () => {
  it('⭐ mọi mẫu đều tạo được luật hợp lệ, và `mauId` trỏ về đúng mẫu', () => {
    /*
     * `Luat.mauId` có sẵn từ GĐ6 mà chưa từng có gì để trỏ tới — mẫu là thứ lấp chỗ đó.
     * Nó tồn tại để về sau trả lời được "mẫu nào dẫn tới luật giữ được lâu nhất".
     */
    for (const m of MAU_LUAT) {
      const luat = taoLuatMoi({
        loiNhac: m.loiNhacGoiY,
        dieuKien: m.dieuKien,
        ...(mauCanNguong(m) ? { thamSo: { nguong: 200_000 } } : {}),
        mauId: m.id,
      }, LUC, `l_${m.id}`);
      expect(luat.mauId, m.id).toBe(m.id);
      expect(mauTheoId(luat.mauId)).toBe(m);
      expect(luat.trangThai).toBe('bat');
    }
  });

  it('`mauTheoDieuKien` trả đúng mẫu của từng điều kiện', () => {
    for (const dk of DIEU_KIEN) {
      expect(mauTheoDieuKien(dk)?.dieuKien, dk).toBe(dk);
    }
  });
});
