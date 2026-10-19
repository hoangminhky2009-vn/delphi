/**
 * LUẬT CỔNG HÀNG CHỜ — `web/worker/cong.js`.
 *
 * Test ở đây không đo hiệu năng; nó khoá bốn tính chất mà một cái hàng chờ SAI
 * vẫn "chạy được" nếu thiếu:
 *   1. đủ chỗ thì vào thẳng — cổng không được cản khi vắng
 *   2. hết chỗ thì có SỐ THỨ TỰ thật, không phải một lỗi 503 trần
 *   3. ⭐ KHÔNG CHEN HÀNG — người mới tới không được lấp ghế vừa trống trong
 *      khi có người đã đứng chờ. Đây là tính chất DUY NHẤT không lộ ra trong
 *      bất kỳ phép đo tải nào: cổng vẫn giữ đúng trần, vẫn không sập, chỉ là
 *      người xếp hàng đứng mãi. Mất niềm tin vào hàng chờ là mất luôn cơ chế.
 *   4. hỏi lại khi đang chờ KHÔNG làm tụt hạng — nếu không thì client càng
 *      chăm hỏi càng bị đẩy ra sau, và người dùng học được rằng nên F5 liên tục
 *      (đúng thứ cổng sinh ra để chặn).
 */
import { describe, expect, it } from 'vitest';
import { CONG, donDep, quyetDinh, soTrong } from '../worker/cong.js';

/**
 * Thu hẹp kiểu về nhánh ĐANG CHỜ. `QuyetDinhCong` là union phân biệt có chủ ý
 * — nhánh `vao: true` KHÔNG có `vi_tri`, và đó là tính chất đáng giữ chứ không
 * phải phiền toái để nới ra: nó chặn chính lỗi đọc `vi_tri` của một người
 * đã được vào (luôn `undefined` — hiển thị ra là "vị trí undefined").
 */
function cho(kq: ReturnType<typeof quyetDinh>) {
  if (kq.vao) throw new Error('mong đợi đang chờ, nhưng đã được vào');
  return kq;
}

/** Cấu hình bé cho dễ đếm tay — luật không đổi theo cỡ. */
const CH = { ...CONG, TRAN_TRONG: 2, HAN_GHE_MS: 1_000, HAN_CHO_MS: 5_000 };

describe('còn chỗ', () => {
  it('vào thẳng khi trong ngưỡng', () => {
    const st = soTrong();
    expect(quyetDinh(st, 'a', 0, CH).vao).toBe(true);
    expect(quyetDinh(st, 'b', 0, CH).vao).toBe(true);
    expect(st.trong.size).toBe(2);
  });

  it('người đã ở trong hỏi lại thì GIA HẠN, không tốn thêm ghế', () => {
    const st = soTrong();
    quyetDinh(st, 'a', 0, CH);
    const kq = quyetDinh(st, 'a', 500, CH);
    expect(kq.vao).toBe(true);
    expect(st.trong.size).toBe(1);
    expect(st.trong.get('a')).toBe(500 + CH.HAN_GHE_MS);
  });
});

describe('hết chỗ', () => {
  it('người thứ 3 nhận SỐ THỨ TỰ, không phải lỗi trần', () => {
    const st = soTrong();
    quyetDinh(st, 'a', 0, CH);
    quyetDinh(st, 'b', 0, CH);
    const kq = cho(quyetDinh(st, 'c', 0, CH));
    expect(kq.vi_tri).toBe(1);
    expect(kq.tong).toBe(1);
    expect(kq.hoi_lai_s).toBe(CH.NHIP_HOI_S);
  });

  it('xếp đúng thứ tự đến trước — trước', () => {
    const st = soTrong();
    quyetDinh(st, 'a', 0, CH);
    quyetDinh(st, 'b', 0, CH);
    expect(cho(quyetDinh(st, 'c', 10, CH)).vi_tri).toBe(1);
    expect(cho(quyetDinh(st, 'd', 20, CH)).vi_tri).toBe(2);
    expect(cho(quyetDinh(st, 'e', 30, CH)).vi_tri).toBe(3);
  });

  it('hỏi lại khi đang chờ thì GIỮ NGUYÊN vị trí', () => {
    const st = soTrong();
    quyetDinh(st, 'a', 0, CH);
    quyetDinh(st, 'b', 0, CH);
    quyetDinh(st, 'c', 10, CH);
    quyetDinh(st, 'd', 20, CH);
    // `c` hỏi lại nhiều lần — vẫn số 1, và hàng không dài thêm.
    expect(cho(quyetDinh(st, 'c', 30, CH)).vi_tri).toBe(1);
    expect(cho(quyetDinh(st, 'c', 40, CH)).vi_tri).toBe(1);
    expect(st.cho.length).toBe(2);
  });
});

describe('nhả ghế', () => {
  it('quá hạn không gia hạn ⇒ ghế trống, người đầu hàng được vào', () => {
    const st = soTrong();
    quyetDinh(st, 'a', 0, CH);
    quyetDinh(st, 'b', 0, CH);
    quyetDinh(st, 'c', 10, CH);          // c xếp hàng
    // Tới lúc ghế của a,b hết hạn (0 + 1000).
    const kq = quyetDinh(st, 'c', 1_001, CH);
    expect(kq.vao).toBe(true);
    expect(st.cho.length).toBe(0);
  });

  it('⭐ KHÔNG CHEN HÀNG: người mới không lấy được ghế của người đang chờ', () => {
    const st = soTrong();
    quyetDinh(st, 'a', 0, CH);
    quyetDinh(st, 'b', 0, CH);
    quyetDinh(st, 'cho1', 10, CH);       // đã đứng chờ

    /*
     * ⚠ PHẢI CHỈ MỘT GHẾ TRỐNG, nếu không bài test vô nghĩa. Bản đầu để cả a
     * lẫn b cùng hết hạn ⇒ hai ghế trống cho một người chờ, nên `moi` vào ghế
     * thứ hai là ĐÚNG, không phải chen hàng — test đỏ mà luật không sai. Nên:
     * `b` gia hạn (còn chơi), chỉ `a` rơi.
     */
    quyetDinh(st, 'b', 900, CH);         // b còn chơi → ghế b bận tới 1900
    const kqMoi = quyetDinh(st, 'moi', 1_001, CH);

    // Đúng 1 ghế trống ⇒ `cho1` phải được nhích vào trước, `moi` xuống hàng.
    // Nếu đảo thứ tự bước 3 và 4 trong `quyetDinh`, `moi` vào thẳng còn `cho1`
    // đứng mãi — cổng vẫn giữ đúng trần, vẫn không sập, chỉ là hàng chờ dối.
    expect(st.trong.has('cho1')).toBe(true);
    expect(st.trong.has('moi')).toBe(false);
    expect(cho(kqMoi).vi_tri).toBe(1);
  });
});

describe('dọn hàng', () => {
  it('đứng chờ mà im quá HAN_CHO_MS ⇒ rời hàng, người sau nhích lên', () => {
    const st = soTrong();
    quyetDinh(st, 'a', 0, CH);
    quyetDinh(st, 'b', 0, CH);
    quyetDinh(st, 'c', 0, CH);           // vị trí 1
    quyetDinh(st, 'd', 0, CH);           // vị trí 2

    // `d` hỏi đều; `c` bỏ đi. Ghế vẫn bận (a,b gia hạn).
    quyetDinh(st, 'a', 4_000, CH);
    quyetDinh(st, 'b', 4_000, CH);
    const kq = cho(quyetDinh(st, 'd', 5_001, CH));
    expect(kq.vi_tri).toBe(1);           // c đã rơi khỏi hàng
    expect(st.cho.length).toBe(1);
  });

  it('donDep xoá đúng ghế hết hạn, giữ ghế còn hạn', () => {
    const st = soTrong();
    st.trong.set('con', 2_000);
    st.trong.set('het', 500);
    donDep(st, 1_000, CH);
    expect([...st.trong.keys()]).toEqual(['con']);
  });
});

describe('mặc định thật', () => {
  it('trần mặc định 300 — đo 05/09/2026, dưới trần thật 200 kết nối Supavisor', () => {
    /*
     * CHỐT CHẶN, không phải bài đo lại hằng số: nó buộc ai nâng trần phải đi qua
     * đây và đọc lý lẽ ở `cong.js`. Trần này đứng yên ở 150 suốt từ D207 vì
     * chưa ai đo; nâng tiếp phải đo đường CÓ TRANSACTION trước.
     */
    expect(CONG.TRAN_TRONG).toBe(300);
  });

  it('hạn ghế PHẢI dài hơn hạn vé, nếu không người đang chơi bị đá ra', () => {
    expect(CONG.HAN_GHE_MS).toBeGreaterThan(CONG.HAN_PASS_S * 1000);
  });
});
