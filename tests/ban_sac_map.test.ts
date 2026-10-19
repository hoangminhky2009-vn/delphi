import { describe, expect, it, afterEach } from 'vitest';
import { sinhMap } from '../server/holdem/map.js';
import { banSacBp, BAN_SAC_MAP } from '../config/holdem.js';

/*
 * BẢN SẮC CỠ MAP (v32, D85/D86 §2) — LƯỚI CANH.
 *
 * Khoá bốn tính chất, mỗi cái một lớp lỗi đã xảy ra ở repo:
 *   1. ⚠⚠ MAP 8 BYTE-HỆT khi bật cờ — nó là MẪU ĐỐI CHỨNG của thiết kế data
 *      hai-bộ (doc 06 §4). Kịch bản rò vào map 8 là cột khẩu vị rủi ro sạch
 *      biến mất, và `events` append-only nên không gắn nhãn lại được (A3.3).
 *   2. CẦN GẠT CÒN SỐNG (D58): bật cờ thì map 12/16 PHẢI đổi — nếu không thì
 *      đây là cơ chế trang trí, và mọi số dò bên dưới là phép rỗng.
 *   3. ĐƠN ĐIỆU theo cường độ: nhân lớn hơn thì cấu trúc không bao giờ ít đi.
 *   4. LUẬT CỨNG VẪN THẮNG KỊCH BẢN: hồi IV cộng cho `phuc_hoi`, nhưng luật
 *      "phục hồi chỉ mở sau chuỗi giảm đủ dài" (chèn SAU) phải vẫn ép được 0 —
 *      nếu không kịch bản hồi sinh đúng cái răng cưa v12 dựng luật để giết.
 */

const CO = {
  lich: true, quanTinh: true, sucCang: true, chuKy: true, duoiTelegraph: true,
  duoi5: false, laiSuatNen: true, bongBongChuoi: true, mapV28: true,
} as const;

const CU = { ...process.env };
afterEach(() => { process.env = { ...CU }; });

const map = (seed: number, size: number, banSac: boolean) =>
  JSON.stringify(sinhMap(seed, size, { ...CO, banSac }).o);

describe('bản sắc cỡ map', () => {
  it('⭐ MAP 8 BYTE-HỆT khi bật cờ — mẫu đối chứng không được đụng', () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      expect(map(seed, 8, true), `seed ${seed}: bản sắc RÒ vào map 8`)
        .toBe(map(seed, 8, false));
    }
  });

  it('banSacBp(8, …) trả 0 tuyệt đối — đường về 0 là đường byte-hệt', () => {
    for (let i = 0; i < 8; i += 1) {
      for (const pha of ['tang', 'giam', 'phuc_hoi', 'bien_dong', 'di_ngang'] as const) {
        expect(banSacBp(8, i, pha)).toBe(0);
      }
    }
  });

  it('⭐ CẦN GẠT CÒN SỐNG: map 12 và 16 ĐỔI khi bật cờ', () => {
    for (const size of [12, 16]) {
      let khac = 0;
      for (let seed = 1; seed <= 200; seed += 1) {
        if (map(seed, size, true) !== map(seed, size, false)) khac += 1;
      }
      expect(khac, `map ${size} không đổi khi bật bản sắc — cơ chế trang trí`)
        .toBeGreaterThan(50);
    }
  });

  it('ĐƠN ĐIỆU: cường độ lớn hơn không làm cấu trúc ÍT đi', () => {
    // Đếm "ô tăng ở nửa đầu map 16" — một proxy đơn điệu của độ cong.
    const dem = (nhan: number): number => {
      process.env.HOLDEM_SWEEP = '1';
      process.env.HOLDEM_BAN_SAC_NHAN_BP = String(nhan);
      let t = 0;
      for (let seed = 1; seed <= 300; seed += 1) {
        const o = sinhMap(seed, 16, { ...CO, banSac: true }).o;
        t += o.slice(0, 10).filter(
          (x) => x.kind === 'giai_doan' && x.giai_doan === 'tang').length;
      }
      return t;
    };
    const thap = dem(10000);
    const cao = dem(30000);
    expect(cao, 'nhân lớn hơn mà đà nửa đầu lại ít hơn').toBeGreaterThanOrEqual(thap);
  });

  it('KHÔNG CÓ CHÌA thì mặc định nguyên vẹn (nhân = bảng gốc)', () => {
    const macDinh = banSacBp(16, 5, 'tang');
    process.env.HOLDEM_BAN_SAC_NHAN_BP = '30000';   // thiếu HOLDEM_SWEEP=1
    expect(banSacBp(16, 5, 'tang')).toBe(macDinh);
  });

  it('LUẬT ĐÁY-CẦN-THỜI-GIAN: bản sắc KHÔNG làm răng cưa tệ đi', () => {
    /*
     * ⚠ BÀI NÀY TỪNG SAI THEO HƯỚNG QUÁ NGHIÊM (sửa 15/08). Bản đầu đòi phục
     * hồi VẮNG MẶT tuyệt đối sau chuỗi giảm ngắn — nhưng luật engine đếm CHUỖI
     * XUYÊN QUA SỰ KIỆN (`runDai`, `phaCuoi`), không đếm kề-vị-trí. Đo cờ TẮT:
     * 9/500 seed đã "vi phạm" theo định nghĩa kề-vị-trí — tức luật vốn KHÔNG
     * tuyệt đối theo thước ấy. Một bài test đòi tính chất trò không có là báo
     * động giả, và báo động giả rồi sẽ bị tắt (bài học header_bao_mat).
     *
     * Tính chất ĐÚNG và có nghĩa: bản sắc không được LÀM TỆ ĐI. Đo cả hai (đo
     * được: TẮT 9, BẬT 5 — bias thực ra làm giảm), khoá BẬT ≤ TẮT.
     */
    const demRangCua = (banSac: boolean): number => {
      let n = 0;
      for (let seed = 1; seed <= 500; seed += 1) {
        const o = sinhMap(seed, 16, { ...CO, banSac }).o;
        for (let i = 2; i < o.length; i += 1) {
          const nay = o[i]!; const truoc = o[i - 1]!; const truoc2 = o[i - 2]!;
          const laPhuc = nay.kind === 'giai_doan' && nay.giai_doan === 'phuc_hoi';
          const truocGiam = truoc.kind === 'giai_doan' && truoc.giai_doan === 'giam';
          const truoc2Giam = truoc2.kind === 'giai_doan' && truoc2.giai_doan === 'giam';
          if (laPhuc && truocGiam && !truoc2Giam) n += 1;
        }
      }
      return n;
    };
    expect(demRangCua(true), 'bản sắc làm răng cưa NHIỀU hơn nền')
      .toBeLessThanOrEqual(demRangCua(false));
  });

  it('bảng kịch bản chỉ khai map 12 và 16 — map 8 vắng mặt CÓ CHỦ Ý', () => {
    expect(Object.keys(BAN_SAC_MAP).sort()).toEqual(['12', '16']);
  });
});
