/**
 * PFM — LỘ TRÌNH + CAM KẾT (08/09).
 *
 * Bốn chỗ bài này canh, chọn theo "hỏng ở đây thì hỏng IM LẶNG":
 *  1. **Cổng đếm VIỆC, không đếm NGÀY.** Demo chốt: *"Nhập một tháng cũ trong một
 *     tối là mở ngay tối đó."* Đếm nhầm sang số ngày trôi qua thì người ghi bù cả
 *     tháng vẫn bị khoá — và không có gì đỏ, chỉ có một người bỏ app.
 *  2. **A10 🔒 — không khối nào chứa một con số tiền.** Đây là ranh KHÔNG dẻo, và
 *     nó dễ vỡ nhất bằng cách vô tình: ai đó thêm "gợi ý 500k" vào một khối mẫu.
 *  3. **Gợi ý điều kiện mơ hồ ⇒ null**, không bốc bừa — cùng luật `nguonThuTuNhan`.
 *  4. **Câu 4 trống thì lộ trình phải NÓI RA**, không im lặng bày một chặng rỗng.
 *  5. **(D308) Không nút nào được thiếu đích.** Bản D306 vẽ đủ bảy nút mà sáu cái
 *     bấm vào không có gì xảy ra — 1.591 bài xanh, không bài nào đọc được điều đó,
 *     đúng họ lỗi "ngõ cụt" 07/09 (A11.21: mốc là ĐIỀU NGƯỜI CHƠI LÀM ĐƯỢC).
 */
import { describe, expect, it } from 'vitest';
import {
  CONG, DICH_NUT, demKhoanCoNhan, demNgayGhi, loTrinh, tomTatLoTrinh,
} from '../src/pfm/lo_trinh';
import { dieuKienGoiY } from '../src/pfm/cam_ket';
import type { HoSo } from '../src/pfm/ho_so';
import type { Khoan } from '../src/pfm/so';

const khoan = (ngay: string, nhan: string | null): Khoan => ({
  id: `k-${ngay}-${nhan ?? 'x'}`,
  ngay,
  soTien: 10_000,
  chieu: 'chi',
  nhan,
  huId: null,
  cachGhi: 'tay',
  viSale: null,
  taoLuc: `${ngay}T09:00:00.000Z`,
  suaLuc: `${ngay}T09:00:00.000Z`,
} as Khoan);

describe('I. Cổng đếm VIỆC ĐÃ LÀM, không đếm ngày trôi qua', () => {
  it('⭐ nhập bù cả tháng trong MỘT tối vẫn mở được chặng', () => {
    // 12 ngày khác nhau, tất cả ghi trong cùng một buổi (taoLuc cùng ngày).
    const so = Array.from({ length: CONG.NGAY_GHI }, (_, i) =>
      khoan(`2026-08-${String(i + 1).padStart(2, '0')}`, 'an_uong'));
    expect(demNgayGhi(so)).toBe(CONG.NGAY_GHI);
    const c = loTrinh({}, so);
    expect(c[1]!.mo, 'ghi bù đủ ngày mà chặng 2 vẫn khoá').toBe(true);
  });

  it('nhiều khoản CÙNG một ngày chỉ tính MỘT ngày', () => {
    const so = [khoan('2026-08-01', 'an_uong'), khoan('2026-08-01', 'di_lai')];
    expect(demNgayGhi(so)).toBe(1);
  });

  it('khoản chưa phân loại KHÔNG tính vào cổng chặng 3', () => {
    const so = [khoan('2026-08-01', null), khoan('2026-08-02', 'an_uong')];
    expect(demKhoanCoNhan(so)).toBe(1);
  });

  it('⭐⭐ D410 — khoản ghi nhanh rồi PHÂN BỔ vào hũ cũng là đã phân loại (không thì cổng chặng 3 kẹt vĩnh viễn)', () => {
    const vaoHu = { ...khoan('2026-08-03', null), huId: 'hu-1' };
    expect(demKhoanCoNhan([vaoHu, khoan('2026-08-04', null)])).toBe(1);
  });

  it('chặng 1 luôn mở; chặng 2·3 khoá khi chưa đủ; MỞ HẾT mở tất', () => {
    const kin = loTrinh({}, []);
    expect(kin.map((c) => c.mo)).toEqual([true, false, false]);
    expect(loTrinh({}, [], true).map((c) => c.mo)).toEqual([true, true, true]);
  });
});

describe('II. ⭐ A10 — không khối nào chứa một con số tiền', () => {
  it('quét MỌI khối của cả ba chặng: không có chuỗi tiền nào', () => {
    const hoSo: HoSo = {
      mucTieu: ['quỹ dự phòng', 'chuyến đi', 'trả nợ', 'món muốn mua', 'thiết bị học'],
      khung: 'hu',
      nhip: ['ngày tệ'],
    };
    const chu = loTrinh(hoSo, [], true)
      .flatMap((c) => c.khoi)
      .flatMap((k) => [k.ten, k.phu, k.vi]);
    /*
     * Bắt cả `500k`, `2tr`, `1.000.000`, `20 000đ`. ⚠ Cố ý KHÔNG bắt số trần như
     * "66" (Lally 2010) hay "0,65" (Gollwitzer) — đó là số NGHIÊN CỨU trong dòng
     * vì-sao, không phải số tiền app kê cho người dùng.
     */
    const tien = /\d[\d.,\s]*\s*(k|tr|đ|vnd|nghìn|triệu)\b/i;
    const pham = chu.filter((c) => tien.test(c));
    expect(pham, 'khối lộ trình đang chứa một con số tiền — A10 vỡ ở đây').toEqual([]);
  });

  it('mức hũ luôn là "do bạn đặt", app không đặt hộ', () => {
    const c = loTrinh({ mucTieu: ['quỹ dự phòng'] }, []);
    const hu = c[0]!.khoi.find((k) => k.ma === 'DP');
    expect(hu?.phu).toContain('mức: do bạn đặt');
  });
});

describe('III. Lộ trình ghép từ câu trả lời, và NÓI RA khi thiếu', () => {
  it('mỗi mục tiêu ⇒ một hũ, kèm dòng "vì sao" trỏ đúng câu 4', () => {
    const c = loTrinh({ mucTieu: ['chuyến đi', 'trả nợ'] }, []);
    const ma = c[0]!.khoi.map((k) => k.ma);
    expect(ma).toContain('ĐI');
    expect(ma).toContain('NỢ');
    expect(c[0]!.khoi.find((k) => k.ma === 'ĐI')?.vi).toContain('câu 4');
  });

  it('⭐ câu 4 trống ⇒ chặng 1 có khối "chưa có hũ" VÀ tóm tắt nói ra', () => {
    const c = loTrinh({}, []);
    expect(c[0]!.khoi.some((k) => k.ma === '?')).toBe(true);
    expect(tomTatLoTrinh({}, 'TÀU LƯỢN', 0)).toContain('Câu 4');
  });

  it('khung đã chọn thì chặng 2 gọi tên nó; chưa chọn thì nói "bạn chọn sau"', () => {
    expect(loTrinh({ khung: 'kakeibo' }, [], true)[1]!.khoi
      .find((k) => k.ma === 'KHUNG')?.ten).toBe('Khung: kakeibo');
    expect(loTrinh({ khung: 'tu_do' }, [], true)[1]!.khoi
      .find((k) => k.ma === 'KHUNG')?.ten).toBe('Khung: bạn chọn sau');
  });
});

describe('IV. Gợi điều kiện cam kết: thà TRỐNG còn hơn ĐOÁN', () => {
  it('một nhãn ⇒ ra điều kiện', () => {
    expect(dieuKienGoiY(['ngay sau khi tiền về'])).toBe('tien_vua_ve');
    expect(dieuKienGoiY(['ngày tệ'])).toBe('ngay_chi_lon');
    // hai nhãn nhưng CÙNG một điều kiện ⇒ vẫn suy được
    expect(dieuKienGoiY(['ngày tệ', 'cuối tháng'])).toBe('ngay_chi_lon');
  });

  it('⭐ hai điều kiện khác nhau ⇒ null, không bốc cái đầu', () => {
    expect(dieuKienGoiY(['ngày tệ', 'ngay sau khi tiền về'])).toBeNull();
  });

  it('chưa trả lời câu 6 hoặc nhãn lạ ⇒ null', () => {
    expect(dieuKienGoiY([])).toBeNull();
    expect(dieuKienGoiY(['nhãn không có thật'])).toBeNull();
  });
});

describe('V. ⭐ (D308) Mọi nút của mọi khối đều có đích', () => {
  /*
   * Quét mọi hình dạng hồ sơ sinh ra khối khác nhau — nút chỉ tồn tại trong khối,
   * nên bảng hồ sơ này phải phủ hết các nhánh của `khoiChang1..3`.
   */
  const HO_SO: HoSo[] = [
    {},                                                   // câu 4 trống ⇒ khối CHỌN MẪU
    { mucTieu: ['quỹ dự phòng', 'trả nợ'] },               // khối hũ ⇒ ĐỔI MẪU/ĐẶT MỨC/BỎ
    { mucTieu: ['chuyến đi'], loTrinhBo: ['chuyến đi'] },  // bỏ hết ⇒ lại về CHỌN MẪU
    { khung: 'hu', nhip: ['ngày tệ'] },
  ];

  it('không nhãn nút nào vắng mặt trong DICH_NUT', () => {
    const thieu = new Set<string>();
    for (const h of HO_SO) {
      for (const c of loTrinh(h, [], true)) {
        for (const k of c.khoi) {
          for (const n of k.nut) if (DICH_NUT[n] === undefined) thieu.add(n);
        }
      }
    }
    expect([...thieu], 'nút vẽ ra mà bấm vào không đi đâu').toEqual([]);
  });

  it('mọi đích kiểu "di" là một route của khu Tài chính', () => {
    for (const [nhan, d] of Object.entries(DICH_NUT)) {
      if (d.kieu !== 'di') continue;
      expect(d.den, `nút ${nhan}`).toMatch(/^\/tai-chinh\//);
    }
  });

  it('⭐ BỎ giấu đúng khối ấy mà KHÔNG đụng vào câu 4', () => {
    const hoSo: HoSo = { mucTieu: ['quỹ dự phòng', 'chuyến đi'], loTrinhBo: ['chuyến đi'] };
    const khoi = loTrinh(hoSo, [], true)[0]!.khoi;
    expect(khoi.map((k) => k.ma)).toEqual(['DP', 'GHI']);
    // Nguồn (câu 4) còn nguyên — `loTrinhBo` là một lớp che, không phải cú xoá.
    expect(hoSo.mucTieu).toEqual(['quỹ dự phòng', 'chuyến đi']);
  });

  it('khối hũ mang NHÃN câu 4 để nút BỎ biết nó đang bỏ cái gì', () => {
    const khoi = loTrinh({ mucTieu: ['trả nợ'] }, [], true)[0]!.khoi;
    expect(khoi.find((k) => k.ma === 'NỢ')?.nhan).toBe('trả nợ');
    // Khối chung (GHI) không phải của một nhãn nào ⇒ không có `nhan`, và BỎ không đụng tới.
    expect(khoi.find((k) => k.ma === 'GHI')?.nhan).toBeUndefined();
  });

  it('bỏ HẾT khối hũ ⇒ ô trống nói ĐÚNG chuyện, không đổ cho "câu 4 để trống"', () => {
    const k = loTrinh({ mucTieu: ['chuyến đi'], loTrinhBo: ['chuyến đi'] }, [], true)[0]!
      .khoi.find((x) => x.ma === '?')!;
    expect(k.vi).toContain('bỏ');
    expect(k.vi, 'người đã trả lời câu 4 mà bị nói là để trống').not.toContain('để trống');
    // Còn người CHƯA trả lời thì vẫn phải nghe đúng câu cũ.
    expect(loTrinh({}, [], true)[0]!.khoi.find((x) => x.ma === '?')!.vi).toContain('để trống');
  });
});
