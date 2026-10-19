/**
 * BRIER ĐẤU TRƯỜNG — test vector tính TAY viết TRƯỚC (A8.3).
 *
 * Bài số 1 là bài quan trọng nhất cả file: nó chép NGUYÊN ví dụ đã tính tay
 * trong CLAUDE.md §A5.4. Nếu bài đó xanh thì Brier đấu trường CHỨNG MINH ĐƯỢC
 * là cùng một công thức với chợ dự báo — chứ không phải "một điểm số nghe cũng
 * giống Brier". Đây đúng cách A5.2 khoá công thức tiền: có ground truth.
 */
import { describe, expect, it } from 'vitest';
import { brierTrungBinh, brierVong } from '../server/holdem/brier.js';

describe('brierVong', () => {
  it('VECTOR CLAUDE.md A5.4: 60/40 hai cửa, cửa nặng thắng ⇒ 0,32', () => {
    /*
     * Nguyên văn A5.4: "đặt 60 @ cửa 1, 40 @ cửa 3 (kèo 4 cửa), cửa 1 thắng →
     * Brier = (0,6−1)² + 0² + 0,4² + 0² = 0,32".
     * Cửa không đặt và không thắng đóng góp 0 nên không cần liệt kê.
     */
    const b = brierVong(
      { cua1: 60, cua3: 40 },
      { cua1: 500, cua2: -100, cua3: 120, cua4: 0 },
    );
    expect(b).toBeCloseTo(0.32, 10);
  });

  it('dồn 100% đúng mã thắng ⇒ 0 (dự báo hoàn hảo)', () => {
    expect(brierVong({ btc: 5_000 }, { btc: 300, vang: -50 })).toBeCloseTo(0, 10);
  });

  it('dồn 100% vào mã THUA ⇒ 2 (sai hoàn toàn, đúng trần thang 0–2)', () => {
    // p_thua = 1, o = 0 ⇒ 1; p_thắng = 0, o = 1 ⇒ 1. Tổng 2.
    expect(brierVong({ vang: 5_000 }, { btc: 300, vang: -50 })).toBeCloseTo(2, 10);
  });

  it('toàn TIỀN MẶT ⇒ null, KHÔNG phải 0 và KHÔNG phải 2', () => {
    /*
     * Chỗ dễ sai nhất. Đứng ngoài không phải dự báo sai — nó là KHÔNG dự báo.
     * Trả 0 thì người không bao giờ vào lệnh có điểm hoàn hảo; trả 2 thì họ bị
     * phạt vì một câu chưa từng phát biểu. Cả hai đều bịa.
     */
    expect(brierVong({}, { btc: 300 })).toBeNull();
    expect(brierVong({ btc: 0 }, { btc: 300 })).toBeNull();
  });

  it('KHÔNG cầm mã thắng ⇒ vẫn phải cộng phần phạt của mã đó', () => {
    /*
     * Bài canh một cú tối ưu sai rất dễ mắc: chỉ lặp trên `viThe` cho gọn.
     * Làm thế thì cầm 100% một mã thua ra 1 thay vì 2 — Brier đẹp lên một cách
     * vô lý đúng ở những vòng đoán trật nhất.
     */
    const b = brierVong({ vang: 100 }, { btc: 900, vang: -200 });
    expect(b).toBeCloseTo(2, 10);
  });

  it('mã thắng xét trên CẢ BÀN, không xét trong rổ của mình', () => {
    /*
     * Cầm đúng một mã mà chỉ so trong rổ thì luôn "đoán đúng" ⇒ thước thưởng
     * việc KHÔNG đa dạng hoá, tức đo ngược hẳn thứ nó sinh ra để đo.
     */
    expect(brierVong({ tpcp: 1_000 }, { tpcp: 10, btc: 800 })).toBeCloseTo(2, 10);
  });

  it('rải đều 4 mã ⇒ 0,75 bất kể mã nào thắng (không thiên vị)', () => {
    // p=0,25 mỗi mã: (0,25−1)² + 3×0,25² = 0,5625 + 0,1875 = 0,75.
    const r = { a: 100, b: 50, c: 10, d: 0 };
    for (const thang of ['a', 'b', 'c', 'd']) {
      const loi: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
      loi[thang] = 999;
      expect(brierVong({ a: 25, b: 25, c: 25, d: 25 }, loi)).toBeCloseTo(0.75, 10);
    }
    expect(Object.keys(r)).toHaveLength(4);
  });

  it('bảng lợi suất RỖNG ⇒ null (không có vòng nào để chấm)', () => {
    expect(brierVong({ btc: 100 }, {})).toBeNull();
  });
});

describe('brierTrungBinh', () => {
  it('BỎ QUA vòng null, không thay bằng số mặc định', () => {
    expect(brierTrungBinh([0.32, null, 0.68])).toBeCloseTo(0.5, 10);
  });

  it('chưa từng vào lệnh ⇒ null, không phải 0', () => {
    expect(brierTrungBinh([null, null])).toBeNull();
    expect(brierTrungBinh([])).toBeNull();
  });
});
