import { describe, expect, it, afterEach } from 'vitest';
import { tyLeTinGiaHieuDung } from '../config/holdem.js';

/*
 * LƯỚI CANH CẦN GẠT TỶ LỆ TIN GIẢ (mở 11/08).
 *
 * ⚠ VÌ SAO BÀI NÀY TỒN TẠI — nó canh một lớp lỗi ĐÃ XẢY RA, không phải lo xa.
 * `TY_LE_TIN_GIA_BP` từng là cần gạt của G2/G4 (D58). Khi v28 thay cách tính
 * tỷ lệ tin giả bằng tích ba bảng, cần gạt ấy CHẾT — nhưng không gì đỏ: nó vẫn
 * biên dịch, vẫn có người đọc, vẫn được thông điệp gate chỉ tên. Dò ba nấc
 * 3500/5000/6500 ra số GIỐNG HỆT nhau tới từng chữ số, và phải mất một phiên
 * mới truy ra. Đúng lớp "cơ chế trang trí" repo đã dính 18+ lần, ở dạng khó
 * thấy nhất: cần gạt chết vì CƠ CHẾ ĐỔI, không vì ai gõ sai tên biến.
 *
 * Nên bài này KHÔNG khoá một con số. Nó khoá đúng ba TÍNH CHẤT làm nên một cần
 * gạt dùng được, và cả ba đều là thứ một lần đổi cơ chế nữa sẽ phá:
 *   1. NÓ SỐNG        — đổi cần gạt thì số PHẢI đổi (bài học D58: trước khi
 *                       kết luận "cần gạt không có tác dụng", phải chứng minh
 *                       cần gạt còn sống).
 *   2. NÓ ĐƠN ĐIỆU    — nhân lớn hơn thì tỷ lệ không bao giờ nhỏ đi; một cần
 *                       gạt phi đơn điệu thì dò ra bảng số vô nghĩa.
 *   3. NÓ GIỮ HÌNH DẠNG — v28 dựng CÓ CHỦ Ý chuyện tin chính sách khó dựng hơn
 *                       tin đồn sập sàn. Cần gạt được phép dịch MỨC, tuyệt đối
 *                       không được san phẳng thứ tự ấy — nếu không thì dò nó
 *                       là đang lặng lẽ xoá một quyết định thiết kế.
 * Và một tính chất an toàn: KHÔNG CÓ CHÌA thì mặc định phải nguyên vẹn, vì
 * cần gạt này nằm trên đường sinh map của trận thật (C4).
 */

const CU = { ...process.env };
afterEach(() => { process.env = { ...CU }; });

const SU_KIEN = ['chinh_sach', 'hack_san', 'bong_bong'] as const;
type Bang = Record<(typeof SU_KIEN)[number], number>;

function doVoi(nhan: number | null): Bang {
  if (nhan === null) {
    delete process.env.HOLDEM_SWEEP;
    delete process.env.HOLDEM_TIN_GIA_NHAN_BP;
  } else {
    process.env.HOLDEM_SWEEP = '1';
    process.env.HOLDEM_TIN_GIA_NHAN_BP = String(nhan);
  }
  return {
    chinh_sach: tyLeTinGiaHieuDung('noi_chuoi' as never, 'chinh_sach' as never, 400),
    hack_san: tyLeTinGiaHieuDung('noi_chuoi' as never, 'hack_san' as never, 400),
    bong_bong: tyLeTinGiaHieuDung('noi_chuoi' as never, 'bong_bong' as never, 400),
  };
}

describe('cần gạt TIN_GIA_NHAN_BP', () => {
  it('CÒN SỐNG — đổi cần gạt thì tỷ lệ tin giả phải đổi', () => {
    const thap = doVoi(6000);
    const cao = doVoi(20000);
    // Không so một mã: cần gạt chết theo kiểu "chỉ còn một nhánh đọc nó" thì
    // vài mã vẫn đổi. Đòi MỌI loại sự kiện đều nhúc nhích.
    for (const k of SU_KIEN) {
      expect(cao[k], `${k} phải tăng khi nhân lớn hơn`).toBeGreaterThan(thap[k]);
    }
  });

  it('ĐƠN ĐIỆU theo cần gạt', () => {
    const nac: Bang[] = [3000, 6000, 10000, 16000, 22000].map(doVoi);
    for (let i = 1; i < nac.length; i += 1) {
      const truoc = nac[i - 1] as Bang;
      const sau = nac[i] as Bang;
      for (const k of SU_KIEN) {
        expect(sau[k], `${k} nấc ${i}`).toBeGreaterThanOrEqual(truoc[k]);
      }
    }
  });

  it('GIỮ HÌNH DẠNG v28 — chính sách vẫn khó dựng hơn đồn sập sàn', () => {
    for (const nhan of [3000, 10000, 22000]) {
      const r = doVoi(nhan);
      expect(r.chinh_sach, `nhân ${nhan}`).toBeLessThan(r.hack_san);
    }
  });

  it('KHÔNG CÓ CHÌA thì giữ nguyên mặc định', () => {
    const macDinh = doVoi(null);
    // Có biến nhưng THIẾU HOLDEM_SWEEP=1 ⇒ vẫn phải là mặc định.
    process.env.HOLDEM_TIN_GIA_NHAN_BP = '22000';
    for (const k of SU_KIEN) {
      expect(tyLeTinGiaHieuDung('noi_chuoi' as never, k as never, 400)).toBe(macDinh[k]);
    }
  });
});
