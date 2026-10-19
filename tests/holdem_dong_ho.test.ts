/**
 * ĐỒNG HỒ TRẬN (D38) — hạn vòng + hạn trận.
 *
 * Founder 27/07: *"khi vào ván bài mà thoát ra ngoài không chơi nữa dù có cả ngày
 * quay trở lại vẫn là ván bài đó... Hãy cho mốc time tối đa cho 1 trận và thời gian
 * cố định các round lật bài thay vì vô hạn."*
 *
 * Test theo QUAN HỆ chứ không theo hằng số: mọi số trong `DONG_HO` đánh dấu
 * PLAYTEST-TUNE và sẽ đổi sau khi có người thật chơi. Chép `45` vào `toBe()` là
 * biến test thành bản sao config — đổi số thì đỏ dù hành vi vẫn đúng, mà đổi DẤU
 * thì vẫn xanh.
 */
import { describe, expect, it } from 'vitest';
import {
  NUOC_HET_GIO, soiDongHo, tranHetHan,
} from '../server/holdem/dong_ho.js';
import { DONG_HO, giayChonBai, giayToiDaCaTran } from '../config/holdem.js';
import { themGiayTrait } from '../server/holdem/dong_ho.js';

/** Mốc cố định — không dùng `new Date()` để test không phụ thuộc lúc chạy. */
const T0 = new Date('2026-07-27T12:00:00.000Z');
const sau = (giay: number) => new Date(T0.getTime() + giay * 1000);

describe('thời lượng pha chọn bài', () => {
  it('VÒNG MỞ BÀN dài hơn vòng thường — nhiều việc nhất, chưa biết gì', () => {
    expect(giayChonBai(1, 8)).toBeGreaterThan(giayChonBai(7, 8));
  });

  it('vòng ĐƯỢC CHỌN THẺ CHIẾN THUẬT dài hơn vòng thường cùng map', () => {
    /*
     * D34: map 8 chọn thẻ ở vòng 2·3·4. Vòng 7 không phải vòng chọn thẻ. Lấy nhịp
     * từ chính `loaiTheVong` (qua `giayChonBai`) chứ không gõ cứng số vòng — nhịp
     * co theo cỡ map nên gõ cứng là sai ở hai trong ba map.
     */
    expect(giayChonBai(3, 8)).toBeGreaterThan(giayChonBai(7, 8));
  });

  it('map to hơn thì tổng thời lượng trận dài hơn, và đơn điệu tăng', () => {
    const t8 = giayToiDaCaTran(8);
    const t12 = giayToiDaCaTran(12);
    const t16 = giayToiDaCaTran(16);
    expect(t12).toBeGreaterThan(t8);
    expect(t16).toBeGreaterThan(t12);
  });

  it('TRẬN NGẮN NHẤT vẫn phải nằm trong cỡ một trận mobile — dưới 30 phút', () => {
    /*
     * Ràng buộc mềm nhưng thật: founder đòi "không thấy quá lâu". Đây không phải
     * canh một con số cụ thể mà canh việc ai đó nâng hạn vòng lên 5 phút rồi biến
     * map 16 thành một buổi chiều — sẽ đỏ ở đây trước khi kịp lên tay người chơi.
     */
    expect(giayToiDaCaTran(8)).toBeLessThan(30 * 60);
    expect(giayToiDaCaTran(16), 'map dài nhất cũng không nên quá một tiếng')
      .toBeLessThan(60 * 60);
  });

  /*
   * ── ĐỆM XEM KẾT QUẢ (rà đồng hồ 08/08) ──────────────────────────────────
   * Mốc vòng N+1 đặt ngay tại commit vòng N, nên thời gian xem khoảnh khắc +
   * đọc VÌ SAO bị trừ vào hạn vòng mới. Đo prod: founder ĐANG NGỒI CHƠI vẫn bị
   * chốt hộ `tu_dong` 2 vòng/trận. Vòng ≥ 2 phải có ngân sách đọc kết quả.
   */
  it('vòng ≥ 2 có ĐỆM XEM KẾT QUẢ; vòng 1 thì KHÔNG (chưa có gì để đọc)', () => {
    expect(giayChonBai(1, 8), 'vòng 1 không có kết quả nào để xem')
      .toBe(DONG_HO.CHON_BAI_VONG_1_S);
    expect(giayChonBai(7, 8), 'vòng thường = nền + đệm xem kết quả')
      .toBe(DONG_HO.CHON_BAI_S + DONG_HO.XEM_KET_QUA_S);
    expect(giayChonBai(3, 8), 'vòng thẻ = nền + thẻ + đệm')
      .toBe(DONG_HO.CHON_BAI_S + DONG_HO.CHON_BAI_THEM_KHI_CO_THE_S
        + DONG_HO.XEM_KET_QUA_S);
  });

  it('đệm phải ĐỦ CHỨA trần overlay khoảnh khắc (12s watchdog phía client)', () => {
    // Overlay diễn tối đa 12s (watchdog AlphaDraftMatch). Đệm nhỏ hơn thế thì
    // riêng phần DIỄN đã nuốt sạch ngân sách đọc, chưa nói tới việc ĐỌC.
    expect(DONG_HO.XEM_KET_QUA_S).toBeGreaterThanOrEqual(12);
  });
});

describe('soi đồng hồ vòng', () => {
  it('vừa mở vòng ⇒ còn nguyên thời lượng, chưa quá hạn gì', () => {
    const d = soiDongHo(T0, 1, 8, T0);
    expect(d.con_lai_s).toBe(d.tong_s);
    expect(d.qua_han_vong).toBe(false);
    expect(d.qua_han_tran).toBe(false);
  });

  it('thời gian trôi thì đếm ngược, và KHÔNG BAO GIỜ âm', () => {
    const tong = giayChonBai(5, 8);
    expect(soiDongHo(T0, 5, 8, sau(1)).con_lai_s).toBe(tong - 1);
    expect(soiDongHo(T0, 5, 8, sau(tong)).con_lai_s).toBe(0);
    expect(soiDongHo(T0, 5, 8, sau(tong + 999)).con_lai_s,
      'số âm sẽ hiện ra màn hình dưới dạng "-12s"').toBe(0);
  });

  it('ÂN HẠN chỉ vào phép so quá-hạn, KHÔNG cộng vào số hiện ra', () => {
    /*
     * Nếu ân hạn cộng vào cả `con_lai_s` thì đồng hồ hiện thừa và người chơi học
     * được rằng con số trên màn là số nói dối. Thà cho họ thấy 0 mà vẫn nhận nước.
     */
    const tong = giayChonBai(5, 8);
    const trongAnHan = soiDongHo(T0, 5, 8, sau(tong + DONG_HO.AN_HAN_S - 1));
    expect(trongAnHan.con_lai_s, 'hiện 0 chứ không hiện thêm ân hạn').toBe(0);
    expect(trongAnHan.qua_han_vong, 'còn trong ân hạn thì vẫn nhận nước').toBe(false);

    expect(soiDongHo(T0, 5, 8, sau(tong + DONG_HO.AN_HAN_S + 1)).qua_han_vong)
      .toBe(true);
  });

  it('ân hạn phải DƯƠNG — 0 nghĩa là đồng hồ phạt chất lượng mạng', () => {
    expect(DONG_HO.AN_HAN_S).toBeGreaterThan(0);
  });
});

describe('HẠN TRẬN — đúng vấn đề founder báo', () => {
  it('"cả ngày sau quay lại" ⇒ trận HẾT HẠN, không tiếp được', () => {
    const motNgay = 24 * 60 * 60;
    expect(tranHetHan(T0, sau(motNgay))).toBe(true);
    expect(soiDongHo(T0, 3, 8, sau(motNgay)).qua_han_tran).toBe(true);
  });

  it('nghỉ vài phút giữa trận thì KHÔNG bị cắt — đây là app điện thoại', () => {
    expect(tranHetHan(T0, sau(5 * 60)), 'một cuộc điện thoại không được giết trận')
      .toBe(false);
  });

  it('hạn trận rộng hơn hẳn hạn một vòng — nếu không thì rời máy 1 phút là mất trận', () => {
    expect(DONG_HO.HAN_TRAN_PHUT * 60)
      .toBeGreaterThan(giayChonBai(1, 8) + DONG_HO.AN_HAN_S);
  });

  it('MIỄN GIỜ (màn tập vòng 1–4) ⇒ hạn trận DÀI hơn, nhưng vẫn PHẢI có', () => {
    /*
     * Rà đồng hồ 08/08: màn đang hứa "TẠM DỪNG ∞" mà tick đóng trận ở phút 46
     * là một lời nói dối. Nhưng ∞ thật thì trận bỏ dở vòng 1 (đa số tuyệt đối,
     * D62) không bao giờ được dọn — nên là hạn DÀI, không phải bỏ hạn.
     */
    const phut46 = 46 * 60;
    expect(tranHetHan(T0, sau(phut46)), 'trận thường: 46 phút là hết').toBe(true);
    expect(tranHetHan(T0, sau(phut46), true),
      'đang TẠM DỪNG mà bị cắt ở phút 46 = màn hình nói dối').toBe(false);
    expect(tranHetHan(T0, sau(DONG_HO.HAN_TRAN_TAP_PHUT * 60 + 60), true),
      'quá hạn dài thì vẫn phải dọn — bảng không được phình vô hạn (A8.9)')
      .toBe(true);
  });

  it('mốc NULL (trận cũ trước migration 0018) ⇒ KHÔNG kết luận hết hạn', () => {
    /*
     * Bịa một mốc cho trận cũ là bịa ra chuyện nó đã quá hạn, và `events` là
     * append-only nên kết luận sai đó không xoá lại được (A3.3).
     */
    expect(tranHetHan(null, sau(999999))).toBe(false);
    const d = soiDongHo(null, 3, 8, sau(999999));
    expect(d.qua_han_vong).toBe(false);
    expect(d.qua_han_tran).toBe(false);
    expect(d.con_lai_s, 'trận cũ hiện đủ thời lượng chứ không hiện 0').toBe(d.tong_s);
  });

  it('MỘT công thức duy nhất cho cả hai đường — nộp vòng và tiến trình dọn', () => {
    /*
     * Hai công thức rời nhau thì sẽ có ngày người chơi thấy "trận còn sống" mà
     * tiến trình dọn đã đóng nó — hoặc một trận không ai đóng được mà cũng không
     * ai chơi được. Test này khoá hai đường phải trả CÙNG kết luận.
     */
    for (const s of [0, 60, 44 * 60, 46 * 60, 24 * 60 * 60]) {
      expect(soiDongHo(T0, 3, 8, sau(s)).qua_han_tran, `mốc ${s}s`)
        .toBe(tranHetHan(T0, sau(s)));
    }
  });
});

describe('HẾT GIỜ = GIỮ NGUYÊN, và phải phân biệt được với giữ CỐ Ý', () => {
  it('nước hết giờ là "giữ" và mang cờ `tu_dong`', () => {
    expect(NUOC_HET_GIO.hanh_dong).toBe('giu');
    expect(NUOC_HET_GIO.tu_dong,
      'thiếu cờ này là gộp "không kịp bấm" với "cố ý giữ" — pha loãng cột khẩu vị '
      + 'rủi ro, và events append-only nên không tách lại được (A1 + A3.3)')
      .toBe(true);
  });

  it('luật "hết giờ là giữ nguyên" được khai tường minh trong config', () => {
    // Nếu ai đó đổi sang "hết giờ là bỏ bài" thì đó là một quyết định thiết kế
    // nặng (tự động cắt lỗ hộ người chơi), phải đi qua founder — không lặng lẽ.
    expect(DONG_HO.HET_GIO_LA_GIU_NGUYEN).toBe(true);
  });
});

/*
 * D442 (founder 27/09 tối: *"Thời gian nghĩ hiện tại hơi ít cho mấy vòng chọn lõi/ trait"*) — vòng lõi +25 s (trước +12),
 * vòng MỐC CHỢ TRAIT +25 s (trước không được cộng gì). Cộng giờ trait đi qua `themGiayTrait` — một nguồn cho payload và
 * mọi cửa soi hạn (bài API `holdem_dong_ho_api` khẳng định `tong_s` vòng 1 của trận v55 đúng bằng nền + phần cộng này).
 */
describe('D442 — giờ nghĩ vòng chọn lõi / chợ trait', () => {
  const st = (trait: boolean) => ({ trait_bat: trait, map: { o: new Array(16).fill(0) } });

  it('⭐ trận có hệ trait: mốc chợ 1 · 6 · 9 · 13 được cộng CHON_TRAIT_THEM_S; vòng không mốc = 0', () => {
    for (const v of [1, 6, 9, 13]) expect(themGiayTrait(st(true), v), `vòng ${v}`).toBe(DONG_HO.CHON_TRAIT_THEM_S);
    for (const v of [2, 5, 7, 8, 15]) expect(themGiayTrait(st(true), v), `vòng ${v}`).toBe(0);
  });

  it('vế ngược: luật KHÔNG có trait (v54 — cùng bàn 16, cùng vòng) ⇒ 0 ở mọi vòng', () => {
    for (const v of [1, 6, 9, 13]) expect(themGiayTrait(st(false), v)).toBe(0);
  });

  it('số của founder: vòng lõi và vòng trait đều được cộng ít nhất 25 s', () => {
    expect(DONG_HO.CHON_BAI_THEM_KHI_CO_THE_S).toBeGreaterThanOrEqual(25);
    expect(DONG_HO.CHON_TRAIT_THEM_S).toBeGreaterThanOrEqual(25);
  });
});
