/**
 * PFM — GƯƠNG (nhóm E). D199.
 *
 *   §I   LỊCH & TRUNG VỊ — số học nền.
 *   §II  VECTOR CHÉP TAY — mỗi con số tính bằng tay trong chú thích (khuôn A5.2).
 *   §III SÀN MẪU — dưới sàn trả `null`, KHÔNG trả 0 (P7).
 *   §IV  KHỚP SỔ ĐĂNG KÝ — mọi số gương ra phải qua được `kiemGiaTri`.
 *   §V   A10 BẰNG CẤU TRÚC — gương không có một câu chữ nào để mà lỡ kê đơn.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ngayKeTiep, chiTheoNgay, trungVi, tietKiemRong, viSale, cachGhi,
  tienVeTieu, chiBu, soVoiMoc, guongKy, ngayChiLon,
} from '../src/pfm/guong.js';
import { taoKhoan, type Khoan, type DauVaoKhoan } from '../src/pfm/so.js';
import { kiemGiaTri } from '@config/pfm_dac_trung';
import { PFM } from '@config/pfm';

const LUC = '2026-08-31T10:00:00.000Z';
let dem = 0;
const k = (v: DauVaoKhoan): Khoan => taoKhoan(v, LUC, `k${dem++}`);
/** Khoản CHI ngày `d` tháng 8, đơn vị NGHÌN đồng cho vector dễ đọc. */
const chi = (d: number, nghin: number, v: Partial<DauVaoKhoan> = {}): Khoan =>
  k({ ngay: `2026-08-${String(d).padStart(2, '0')}`, soTien: nghin * 1000, ...v });
const thu = (d: number, nghin: number): Khoan => chi(d, nghin, { chieu: 'thu' });

/* ══════════════════════════════════════════════════════════════════════════════
 * §I — LỊCH & TRUNG VỊ
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§I — số học nền', () => {
  it('ngày kế tiếp qua được mọi mép lịch', () => {
    expect(ngayKeTiep('2026-08-15')).toBe('2026-08-16');
    expect(ngayKeTiep('2026-08-31'), 'sang tháng').toBe('2026-09-01');
    expect(ngayKeTiep('2026-12-31'), 'sang năm').toBe('2027-01-01');
    expect(ngayKeTiep('2026-02-28'), '2026 KHÔNG nhuận').toBe('2026-03-01');
    expect(ngayKeTiep('2024-02-28'), '2024 nhuận').toBe('2024-02-29');
  });

  it('⭐ TRUNG VỊ, không phải trung bình — một ngày mua đồ lớn không được kéo nền', () => {
    /*
     * Nếu nền là TRUNG BÌNH thì một ngày mua điện thoại kéo nó lên đủ để chính ngày đó
     * thôi là "ngày lớn", và cả chỉ số chi-bù tự vô hiệu hoá. Trung vị miễn nhiễm với
     * đúng loại ngày mà chỉ số này sinh ra để nhìn.
     */
    const day = [100, 100, 100, 100, 10_000];
    expect(trungVi(day)).toBe(100);
    expect(day.reduce((a, b) => a + b, 0) / day.length, 'trung bình thì lệch hẳn').toBe(2080);
  });

  it('trung vị: rỗng ⇒ null, lẻ ⇒ giữa, chẵn ⇒ trung bình hai giữa', () => {
    expect(trungVi([])).toBeNull();
    expect(trungVi([5])).toBe(5);
    expect(trungVi([4, 1, 3, 2])).toBe(2.5);
  });

  it('`chiTheoNgay` chỉ đếm CHI, gộp nhiều khoản cùng ngày', () => {
    const m = chiTheoNgay([chi(1, 30), chi(1, 20), thu(1, 900), chi(2, 50)]);
    expect(m.get('2026-08-01')).toBe(50_000);
    expect(m.get('2026-08-02')).toBe(50_000);
    expect(m.size, 'ngày chỉ có THU không thành một dòng chi').toBe(2);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §II — VECTOR CHÉP TAY
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§II — vector chép tay (khuôn A5.2)', () => {
  it('TIẾT KIỆM RÒNG: thu 10tr, chi 4tr ⇒ (10−4)/10 = 0,6', () => {
    const r = tietKiemRong([thu(1, 10_000), chi(2, 4_000)]);
    expect(r.gt).toBeCloseTo(0.6, 10);
    expect(r.thu).toBe(10_000_000);
    expect(r.chi).toBe(4_000_000);
    expect(r.chamSan).toBe(false);
  });

  it('⭐ TIẾT KIỆM RÒNG: thu 1tr, chi 5tr ⇒ (1−5)/1 = −4 ⇒ kẹp −1 và NÓI RA', () => {
    // Kẹp mà không nói là giấu: người gọi tưởng "tiêu hết đúng gấp đôi thu".
    const r = tietKiemRong([thu(1, 1_000), chi(2, 5_000)]);
    expect(r.gt).toBe(-1);
    expect(r.chamSan, 'phải khai là đã chạm sàn').toBe(true);
  });

  it('⭐⭐ VÌ SALE: mẫu số là "ĐÃ HỎI", không phải "tất cả khoản"', () => {
    /*
     * 5 khoản chi: true · true · false · null · null.
     * ĐÃ HỎI = 3 (hai true + một false) ⇒ 2/3 ≈ 0,667.
     * Nếu lấy mẫu số = 5 thì ra 0,4 — thấp giả tạo, và thấp đúng ở người ghi sổ cẩu thả
     * nhất. Lỗi này KHÔNG lộ ra ở đâu: 0,4 vẫn nằm trong [0,1] và vẫn trông hợp lý.
     */
    const r = viSale([
      chi(1, 10, { viSale: true }), chi(2, 10, { viSale: true }),
      chi(3, 10, { viSale: false }), chi(4, 10), chi(5, 10),
    ]);
    expect(r.gt).toBeCloseTo(2 / 3, 10);
    expect(r.n, 'mẫu số = số khoản ĐÃ HỎI').toBe(3);
    expect(r.gt).not.toBeCloseTo(0.4, 3);
  });

  it('CÁCH GHI: 4 khoản tay·tay·mẫu·sms ⇒ 0,5 / 0,25 / 0,25 và cộng lại đúng 1', () => {
    const r = cachGhi([
      chi(1, 10), chi(2, 10),
      chi(3, 10, { cachGhi: 'mau_lap' }), chi(4, 10, { cachGhi: 'dan_sms' }),
    ]);
    expect(r.gt).toEqual({ tay: 0.5, mau_lap: 0.25, dan_sms: 0.25 });
    const tong = Object.values(r.gt!).reduce((a, b) => a + b, 0);
    expect(tong).toBeCloseTo(1, 10);
  });

  it('TIỀN VỀ LÀ TIÊU: thu ngày 05; chi 05=300, 06=200, 09=500 ⇒ 500/1000 = 0,5', () => {
    // Cửa sổ 48h = ngày nhận + ngày kế = {05, 06}. Khoản ngày 09 nằm ngoài.
    const r = tienVeTieu([thu(5, 5_000), chi(5, 300), chi(6, 200), chi(9, 500)]);
    expect(r.gt).toBeCloseTo(0.5, 10);
    expect(r.n).toBe(1);
  });

  it('⭐⭐ TIỀN VỀ: hai ngày thu SÁT NHAU — cửa sổ chồng nhau không được đếm hai lần', () => {
    /*
     * thu ngày 05 và 06; chi DUY NHẤT ngày 06 = 100k.
     * Cửa sổ: {05,06} ∪ {06,07} = {05,06,07}. Đúng: 100/100 = 1,0.
     * Nếu cộng theo TỪNG cửa sổ thì ngày 06 vào hai lần ⇒ 200/100 = 2,0 — ra ngoài miền
     * [0,1] của sổ đăng ký, và không ai thấy vì nó vẫn là một con số đẹp.
     */
    const r = tienVeTieu([thu(5, 900), thu(6, 900), chi(6, 100)]);
    expect(r.gt).toBe(1);
    /*
     * ⚠⚠ BÀI NÀY TỪNG LÀ PHÉP RỖNG, VÀ MŨI TIÊM LÀ THỨ TÌM RA. Bản đầu của `tienVeTieu`
     * kẹp kết quả về [0,1]; cú tiêm "cộng theo từng cửa sổ" cho 200/100 = 2,0 rồi bị kẹp
     * về đúng 1,0 — trùng khít đáp án đúng, nên bài XANH trên một bản đã hỏng. Đã gỡ
     * phép kẹp (tỷ lệ bị chặn theo CẤU TRÚC nhờ `Set`), nên nay cú đếm-hai-lần lộ thẳng.
     * Thêm một ca không-chạm-biên để bài không phụ thuộc vào đúng số 1.
     */
    const r2 = tienVeTieu([thu(5, 900), thu(6, 900), chi(6, 100), chi(20, 300)]);
    expect(r2.gt, 'đúng: 100/400 = 0,25 — đếm hai lần sẽ ra 0,5').toBeCloseTo(0.25, 10);
  });

  it('⭐⭐ CHI BÙ — vector chép tay đầy đủ', () => {
    /*
     * Chi theo ngày (nghìn): 01=100 · 02=400 · 03=100 · 04=50 · 05=400 · 06=300 ·
     *                        07=100 · 08=400 · 09=20 · 10=100
     * Sắp: 20 50 100 100 100 100 300 400 400 400  (n=10, chẵn)
     *   ⇒ TRUNG VỊ = (100 + 100)/2 = 100  ⇒ nền = 100k
     *   ⇒ ngưỡng "ngày lớn" = 2 × 100k = 200k
     * Ngày lớn: 02(400) · 05(400) · 06(300) · 08(400)  ⇒ 4 ngày
     * Ngày NGAY SAU: 03=100 · 06=300 · 07=100 · 09=20
     *   vượt nền (> 100k)?  03 không (bằng, không vượt) · 06 CÓ · 07 không · 09 không
     *   ⇒ 1/4 = 0,25
     */
    const so = [
      chi(1, 100), chi(2, 400), chi(3, 100), chi(4, 50), chi(5, 400),
      chi(6, 300), chi(7, 100), chi(8, 400), chi(9, 20), chi(10, 100),
    ];
    const r = chiBu(so);
    expect(r.nguong).toBe(200_000);
    expect(r.soNgayLon).toBe(4);
    expect(r.n).toBe(4);
    expect(r.gt).toBe(0.25);
    /*
     * ⭐ MỐC NỀN (D354): dải 01→10 = 10 ngày lịch; ngày có chi VƯỢT nền 100k: 02 · 05 · 06 · 08
     *   ⇒ 4/10 = 0,4. Tức nếu KHÔNG có chi bù thì `gt` của cuốn sổ này quanh 0,4 — và 0,25 quan sát
     *   được nằm DƯỚI mức tình cờ, không phải "một phần tư số lần có chi bù".
     */
    expect(r.nenNgauNhien).toBe(0.4);

    // ⭐ `ngayChiLon` (GĐ6, dùng chung công thức) phải khớp NGƯỠNG của chiBu trên
    // đúng bộ dữ liệu này — bằng chứng D61: một nguồn, không phải hai công thức trùng.
    expect(ngayChiLon(so, '2026-08-02').nguong).toBe(r.nguong);
    expect(ngayChiLon(so, '2026-08-02'), 'ngày 02 chi 400k ≥ ngưỡng 200k').toEqual(
      { laNgayLon: true, nguong: 200_000 });
    expect(ngayChiLon(so, '2026-08-01'), 'ngày 01 chi 100k < ngưỡng').toEqual(
      { laNgayLon: false, nguong: 200_000 });
    expect(ngayChiLon(so, '2026-08-15'),
      'ngày không có khoản nào = chi 0, VẪN LÀ MỘT QUAN SÁT (không phải thiếu mẫu)')
      .toEqual({ laNgayLon: false, nguong: 200_000 });
  });

  it('`ngayChiLon` dưới sàn NGÀY CÓ CHI ⇒ null cho cả hai vế, không bịa ngưỡng', () => {
    const it = Array.from({ length: PFM.GUONG_SAN_NGAY_CHI - 1 }, (_, i) => chi(i + 1, 100));
    expect(ngayChiLon(it, '2026-08-01')).toEqual({ laNgayLon: null, nguong: null });
  });

  it('⭐ NGÀY KHÔNG CHI = 0, không phải VẮNG MẶT — đó là quan sát đắt nhất', () => {
    /*
     * Hôm sau một ngày tiêu lớn mà KHÔNG tiêu gì là bằng chứng họ đã ghìm lại. Bỏ nó ra
     * khỏi mẫu số là chỉ đếm những lần chi bù, và bảo đảm ra tỷ lệ cao.
     * Ở đây ngày 03, 06, 09 hoàn toàn không có khoản nào ⇒ vẫn phải vào mẫu số với 0.
     * Chi: 01=100 02=400 04=100 05=400 07=100 08=400 10=100  (7 ngày có chi)
     * Sắp: 100 100 100 100 400 400 400 (n=7, lẻ) ⇒ trung vị = 100 ⇒ ngưỡng 200
     * Ngày lớn: 02 · 05 · 08. Ngày sau: 03(0) · 06(0) · 09(0) — không ngày nào vượt.
     *   ⇒ 0/3 = 0 THẬT (không phải null, và không phải "bỏ qua").
     */
    const r = chiBu([
      chi(1, 100), chi(2, 400), chi(4, 100), chi(5, 400),
      chi(7, 100), chi(8, 400), chi(10, 100),
    ]);
    expect(r.n, 'ba ngày trống vẫn là ba quan sát').toBe(3);
    expect(r.gt).toBe(0);
    // ⭐ Mốc nền đi theo LỊCH, cùng luật với mẫu số trên: 10 ngày lịch (01→10), trong đó ba ngày
    // trống tính là 0; vượt nền 100k chỉ có 02 · 05 · 08 ⇒ 3/10. Chia cho 7 ngày CÓ chi (3/7) là
    // quên mất đúng những ngày trống mà bài này sinh ra để giữ.
    expect(r.nenNgauNhien).toBe(0.3);
  });

  it('ngày sau ngày lớn mà NGOÀI DẢI quan sát thì không đếm', () => {
    // Ngày lớn cuối dải: hôm sau chưa từng được ghi ⇒ không có quan sát, không phải "0".
    // Chi: 01..06 = 100 mỗi ngày, 07 = 400 (ngày lớn cuối), 02/04 cũng lớn để đủ sàn.
    const r = chiBu([
      chi(1, 100), chi(2, 400), chi(3, 100), chi(4, 400),
      chi(5, 100), chi(6, 100), chi(7, 400),
    ]);
    expect(r.soNgayLon).toBe(3);
    expect(r.n, 'ngày 08 nằm ngoài dải ⇒ chỉ còn 2 quan sát').toBe(2);
  });

  it('SO VỚI MỐC (E3): tăng, giảm, mốc 0, và chạm trần', () => {
    expect(soVoiMoc(120, 100).gt).toBeCloseTo(0.2, 10);
    expect(soVoiMoc(50, 100).gt).toBeCloseTo(-0.5, 10);
    expect(soVoiMoc(100, 0).gt, 'kỳ trước bằng 0 ⇒ phép chia vô nghĩa').toBeNull();
    const gap5 = soVoiMoc(500, 100);
    expect(gap5.gt).toBe(1);
    expect(gap5.chamSan).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §III — SÀN MẪU
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§III — dưới sàn thì im, không đoán', () => {
  it('⭐ sổ RỖNG: mọi chỉ số `null`, KHÔNG có chỉ số nào ra 0', () => {
    /*
     * "Chưa đủ để nói" và "đo được, kết quả bằng 0" là hai chuyện khác hẳn (P7/D62).
     * Gộp chúng là để một app mới cài mở ra đã phán "bạn tiết kiệm 0%".
     */
    const g = guongKy([]);
    expect(g.tiet_kiem_rong.gt).toBeNull();
    expect(g.vi_sale.gt).toBeNull();
    expect(g.cach_ghi.gt).toBeNull();
    expect(g.tien_ve_tieu.gt).toBeNull();
    expect(g.chi_bu.gt).toBeNull();
  });

  it('⭐ KHÔNG CÓ THU ⇒ tiết kiệm ròng `null`, không phải −1', () => {
    // Không có thu nhập thì "tiết kiệm được mấy phần trăm thu nhập" là câu KHÔNG CÓ
    // NGHĨA, chứ không phải câu có nghĩa với đáp án xấu.
    const r = tietKiemRong([chi(1, 500)]);
    expect(r.gt).toBeNull();
    expect(r.chi).toBe(500_000);
  });

  it('⭐ chi bù: chưa có nền thì cũng CHƯA có mốc nền — `null`, không phải 0 hay 0,5 (D354)', () => {
    const it2 = Array.from({ length: PFM.GUONG_SAN_NGAY_CHI - 1 }, (_, i) => chi(i + 1, 100));
    expect(chiBu(it2).nenNgauNhien).toBeNull();
    // Đủ ngày có chi nhưng ít quan sát ngày-sau: `gt` null, còn mốc nền thì ĐÃ tính được — nó chỉ
    // phụ thuộc vào nền, không phụ thuộc vào việc có bao nhiêu ngày lớn.
    const du = Array.from({ length: PFM.GUONG_SAN_NGAY_CHI }, (_, i) => chi(i + 1, 100));
    expect(chiBu(du).gt).toBeNull();
    expect(chiBu(du).nenNgauNhien, 'mọi ngày bằng nhau ⇒ không ngày nào VƯỢT trung vị').toBe(0);
  });

  it('chi bù: dưới sàn ngày có chi ⇒ null và không bịa ngưỡng', () => {
    const it = Array.from({ length: PFM.GUONG_SAN_NGAY_CHI - 1 }, (_, i) => chi(i + 1, 100));
    const r = chiBu(it);
    expect(r.gt).toBeNull();
    expect(r.nguong, 'chưa đủ ngày thì chưa có nền để mà đặt ngưỡng').toBeNull();
  });

  it('chi bù: đủ ngày nhưng ít quan sát ngày-sau ⇒ null, mà ngưỡng thì có', () => {
    // Nền tính được (đủ ngày) nên trả ngưỡng ra cho người gọi kiểm; tỷ lệ thì chưa.
    const r = chiBu([
      chi(1, 100), chi(2, 100), chi(3, 100), chi(4, 100), chi(5, 100), chi(6, 400),
    ]);
    expect(r.nguong).toBe(200_000);
    expect(r.gt, 'chỉ 1 ngày lớn và nó ở cuối dải').toBeNull();
  });

  it('vì sale: chưa hỏi đủ ⇒ null, và `n` nói rõ đã hỏi được mấy', () => {
    const r = viSale([chi(1, 10, { viSale: true }), chi(2, 10)]);
    expect(r.gt).toBeNull();
    expect(r.n).toBe(1);
  });

  it('tiền về: không có ngày thu nào ⇒ null', () => {
    expect(tienVeTieu([chi(1, 100)]).gt).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §IV — KHỚP SỔ ĐĂNG KÝ
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§IV — mọi số gương ra phải qua được cửa server', () => {
  it('⭐⭐ số của gương hợp MIỀN của sổ đăng ký (`kiemGiaTri` không phàn nàn)', () => {
    /*
     * Đây là chỗ dễ vỡ im lặng nhất của cả nhóm E: `hv_chi_bu` khai `ty_le` trong [0,1],
     * nên nếu ai định nghĩa "chi bù" thành TỶ SỐ TRUNG BÌNH (chi hôm sau ÷ chi nền) thì
     * nó vượt 1 dễ như bỡn và bị `kiemGiaTri` từ chối — nhưng bị từ chối SAU KHI đã tính
     * cả kỳ, ở tận cửa server, với một thông điệp không ai lần ngược được về đây.
     * Bài này bắt cú đó ngay tại chỗ sinh ra nó.
     */
    const so = [
      thu(1, 5_000),
      chi(1, 100), chi(2, 400), chi(3, 100), chi(4, 50), chi(5, 400),
      chi(6, 300), chi(7, 100), chi(8, 400), chi(9, 20), chi(10, 100),
      chi(11, 80, { viSale: true }), chi(12, 60, { viSale: false }),
      chi(13, 40, { viSale: true, cachGhi: 'dan_sms' }),
    ];
    const g = guongKy(so);
    expect(kiemGiaTri('hv_chi_bu', g.chi_bu.gt!)).toBeNull();
    expect(kiemGiaTri('hv_vi_sale', g.vi_sale.gt!)).toBeNull();
    expect(kiemGiaTri('hv_tien_ve_tieu', g.tien_ve_tieu.gt!)).toBeNull();
    expect(kiemGiaTri('hv_tiet_kiem_rong', g.tiet_kiem_rong.gt!)).toBeNull();
    expect(kiemGiaTri('hv_cach_ghi', g.cach_ghi.gt!)).toBeNull();
  });

  it('kể cả ở hai biên: tiết kiệm ròng −1 và so-với-mốc +1 vẫn hợp miền', () => {
    expect(kiemGiaTri('hv_tiet_kiem_rong', tietKiemRong([thu(1, 1), chi(2, 9_000)]).gt!))
      .toBeNull();
    expect(kiemGiaTri('hv_so_voi_ky_truoc', soVoiMoc(500, 100).gt!)).toBeNull();
    expect(kiemGiaTri('hv_so_voi_ky_truoc', soVoiMoc(0, 100).gt!)).toBeNull();
  });

  it('phân bố cách ghi chỉ dùng khoá có trong miền sổ đăng ký', () => {
    const g = cachGhi([chi(1, 10), chi(2, 10, { cachGhi: 'dan_sms' })]);
    expect(Object.keys(g.gt!).sort()).toEqual(['dan_sms', 'mau_lap', 'tay']);
    expect(kiemGiaTri('hv_cach_ghi', g.gt!)).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §V — A10 BẰNG CẤU TRÚC
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§V — gương chỉ trả SỐ (A10 🔒 thi hành bằng cấu trúc)', () => {
  const nguon = fs.readFileSync(path.resolve(__dirname, '../src/pfm/guong.ts'), 'utf8');
  const ma = nguon.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('⭐ mọi giá trị gương trả ra là SỐ hoặc `null` — không một câu nào', () => {
    /*
     * A10 thi hành bằng CẤU TRÚC thay vì bằng kỷ luật: chỗ này không có chuỗi hiển thị
     * nào để mà lỡ viết "bạn nên bớt ăn ngoài". Câu chữ sống ở catalog riêng, và catalog
     * đó có bài quét `TU_KE_DON`.
     */
    const g = guongKy([thu(1, 900), chi(1, 100), chi(2, 50, { viSale: true })]);
    const soHoacNull = (v: unknown): boolean =>
      v === null || typeof v === 'number' || typeof v === 'boolean'
      || (typeof v === 'object' && v !== null && Object.values(v).every(soHoacNull));
    for (const [ten, cs] of Object.entries(g)) {
      expect(soHoacNull(cs), `chỉ số "${ten}" chở một giá trị không phải số`).toBe(true);
    }
  });

  it('mã nguồn không chứa chuỗi tiếng Việt có dấu ngoài chú thích', () => {
    // Chuỗi có dấu trong mã (không phải chú thích) gần như chắc chắn là câu cho người
    // đọc — tức chữ đã lọt vào tầng tính.
    const chuoi = [...ma.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2] ?? '');
    for (const s of chuoi) {
      expect(/[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i
        .test(s), `chuỗi tiếng Việt trong mã: "${s}"`).toBe(false);
    }
  });

  it('không đọc ĐỒNG HỒ (phép cộng lịch trên chuỗi ngày thì được)', () => {
    // `new Date(Date.UTC(...))` an toàn: vào lẫn ra đều là chuỗi ngày trần, không múi
    // giờ nào tham gia. Cái bị cấm là thứ làm kết quả đổi theo LÚC CHẠY.
    expect(ma).not.toContain('Date.now(');
    expect(ma).not.toMatch(/new Date\(\s*\)/);
    expect(ma).toContain('Date.UTC(');
  });

  it('không import sổ đăng ký — gương tính CHO USER, đóng gói là việc `dac_trung/`', () => {
    expect(ma).not.toContain('pfm_dac_trung');
    expect(ma).not.toContain('fetch(');
  });

  it('⭐ `guongKy` là MỘT CỬA — `dac_trung/` đóng gói, không tính lại', () => {
    // Hai nơi cùng tính một công thức là bản sao sẽ trôi (D61); cú trôi ở đây biểu hiện
    // là "màn hình gương nói 42%, hồ sơ cohort nói 38%" cho cùng một tháng.
    const so = [thu(1, 900), chi(1, 100), chi(2, 50, { viSale: true })];
    expect(guongKy(so).tiet_kiem_rong).toEqual(tietKiemRong(so));
    expect(guongKy(so).vi_sale).toEqual(viSale(so));
    expect(guongKy(so).cach_ghi).toEqual(cachGhi(so));
    expect(guongKy(so).tien_ve_tieu).toEqual(tienVeTieu(so));
    expect(guongKy(so).chi_bu).toEqual(chiBu(so));
  });

  it('hàm THUẦN — không đụng mảng đầu vào', () => {
    const so = [chi(2, 100), chi(1, 50)];
    const truoc = so.map((x) => x.id);
    guongKy(so);
    expect(so.map((x) => x.id)).toEqual(truoc);
  });
});
