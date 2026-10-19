/**
 * PFM — ORACLE GIÚP 2 · 4 · 5 (GĐ B, D365). Ba hàm thuần, VECTOR CHÉP TAY.
 *
 * ⚠ Bài đắt nhất ở đây là §I.4 (**hai khoá PHÂN HOẠCH**) và §III.3 (**nhịp 0 ⇒ im**):
 * cái đầu là chỗ hai thanh chắn có thể lặng lẽ cộng dồn lên nhau, cái sau là chỗ một phép
 * chia cho 0 biến thành "tiền của bạn đi tới năm 2199" — cả hai đều XANH nếu chỉ thử ca đẹp.
 */
import { describe, expect, it } from 'vitest';
import { PFM } from '@config/pfm';
import { chuanHoaGhiChu, chuoiThangDaiNhat, deNghiMauLap, khoaCuaKhoan } from '../src/pfm/khoan_lap.js';
import { quyDoiMon } from '../src/pfm/quy_doi.js';
import { tienToiNgay } from '../src/pfm/tien_toi_ngay.js';
import type { Hu } from '../src/pfm/hu.js';
import type { Khoan } from '../src/pfm/so.js';

const LUC = '2026-08-20T10:00:00.000Z';
let dem = 0;
function k(ngay: string, soTien: number, ghiChu?: string, chieu: 'chi' | 'thu' = 'chi'): Khoan {
  dem += 1;
  return {
    id: `k${dem}`, ngay, soTien, chieu, nhan: null, huId: null, cachGhi: 'tay',
    viSale: null, taoLuc: LUC, suaLuc: LUC, ...(ghiChu === undefined ? {} : { ghiChu }),
  };
}
const RONG = new Set<string>();

describe('§I — GIÚP 2: đề nghị lưu mẫu một chạm khi thấy khoản lặp', () => {
  it('chuẩn hoá ghi chú: gộp khoảng trắng, thường hoá, GIỮ DẤU; rỗng ⇒ null', () => {
    expect(chuanHoaGhiChu('  Cà   Phê ')).toBe('cà phê');
    expect(chuanHoaGhiChu('CÀ PHÊ')).toBe('cà phê');
    expect(chuanHoaGhiChu('   ')).toBeNull();
    expect(chuanHoaGhiChu(undefined)).toBeNull();
    // ⚠ "cà phê" ≠ "ca phe": bỏ dấu là đoán hộ người dùng đã gõ gì.
    expect(chuanHoaGhiChu('ca phe')).not.toBe(chuanHoaGhiChu('cà phê'));
  });

  it('khoá: có ghi chú ⇒ `tiền|chú`; không ⇒ `tiền`; THU không có khoá', () => {
    expect(khoaCuaKhoan(k('2026-08-10', 25_000))).toBe('25000');
    expect(khoaCuaKhoan(k('2026-08-10', 25_000, 'Cà Phê'))).toBe('25000|cà phê');
    expect(khoaCuaKhoan(k('2026-08-10', 25_000, '  '))).toBe('25000');
    expect(khoaCuaKhoan(k('2026-08-10', 3_000_000, 'lương', 'thu'))).toBeNull();
  });

  it(`⭐ CÓ ghi chú: đủ ${PFM.ORACLE_LAP_CO_CHU_LAN} lần trong ${PFM.ORACLE_LAP_CO_CHU_NGAY} ngày thì hỏi; lệch một ngày ra ngoài cửa sổ thì KHÔNG`, () => {
    const homNay = '2026-08-14';
    // cách hôm nay 13 · 9 · 0 ngày — cả ba nằm trong cửa sổ 14 (điều kiện là `< 14`).
    const trong = [k('2026-08-01', 25_000, 'cà phê'), k('2026-08-05', 25_000, 'Cà phê'), k(homNay, 25_000, 'cà  phê')];
    const d = deNghiMauLap({ so: trong, homNay, daCoMau: RONG, daHoi: RONG });
    expect(d).toEqual({ khoa: '25000|cà phê', nhip: 'day', soTien: 25_000, ghiChu: 'cà phê', lan: 3, cuaSo: 14 });

    // đẩy lần đầu ra đúng MỘT ngày (cách 14) ⇒ chỉ còn 2 trong cửa sổ.
    const ngoai = [k('2026-07-31', 25_000, 'cà phê'), trong[1]!, trong[2]!];
    expect(deNghiMauLap({ so: ngoai, homNay, daCoMau: RONG, daHoi: RONG })).toBeNull();
  });

  it(`⭐ KHÔNG ghi chú: cần ${PFM.ORACLE_LAP_KHONG_CHU_LAN} lần trong ${PFM.ORACLE_LAP_KHONG_CHU_NGAY} ngày — ba lần là CHƯA đủ`, () => {
    const homNay = '2026-08-14';
    const ba = ['2026-08-10', '2026-08-12', homNay].map((n) => k(n, 35_000));
    expect(deNghiMauLap({ so: ba, homNay, daCoMau: RONG, daHoi: RONG })).toBeNull();
    const bon = [...ba, k('2026-08-08', 35_000)];
    expect(deNghiMauLap({ so: bon, homNay, daCoMau: RONG, daHoi: RONG }))
      .toEqual({ khoa: '35000', nhip: 'day', soTien: 35_000, ghiChu: null, lan: 4, cuaSo: 7 });
  });

  it('⭐⭐⭐ HAI KHOÁ PHÂN HOẠCH — khoản CÓ ghi chú KHÔNG đẩy khoá chỉ-số-tiền lên', () => {
    /*
     * ⚠⚠ Đây là chỗ hai thanh chắn có thể lặng lẽ cộng dồn. Ba lần "cà phê 25k" phải bắn
     * ĐÚNG luật có-ghi-chú (≥3/14). Nếu cùng ba khoản ấy cũng được đếm vào khoá `25000`
     * thì ngưỡng ≥4/7 của khoá trần (thứ đặt cao để chặn nhiễu tiền tròn 5k — D363) bị một
     * đường vòng: chỉ cần thêm MỘT khoản 25k không ghi chú là đủ 4, và người dùng ăn thêm
     * một câu hỏi trùng về cùng một thứ.
     */
    const homNay = '2026-08-14';
    const so = [
      k('2026-08-10', 25_000, 'cà phê'), k('2026-08-12', 25_000, 'cà phê'),
      k('2026-08-13', 25_000, 'cà phê'), k(homNay, 25_000),
    ];
    const d = deNghiMauLap({ so, homNay, daCoMau: RONG, daHoi: RONG });
    expect(d?.khoa, 'phải là khoá có ghi chú').toBe('25000|cà phê');
    expect(d?.lan, 'ba — không phải bốn').toBe(3);
    // và khoá trần một mình thì chưa tới ngưỡng ⇒ hỏi xong khoá kia là hết chuyện để hỏi.
    expect(deNghiMauLap({ so, homNay, daCoMau: RONG, daHoi: new Set(['25000|cà phê']) })).toBeNull();
  });

  it('khoá đã có mẫu hoặc đã hỏi ⇒ im (hỏi một lần, nhớ câu trả lời)', () => {
    const homNay = '2026-08-14';
    const so = ['2026-08-10', '2026-08-12', homNay].map((n) => k(n, 25_000, 'cà phê'));
    expect(deNghiMauLap({ so, homNay, daCoMau: new Set(['25000|cà phê']), daHoi: RONG })).toBeNull();
    expect(deNghiMauLap({ so, homNay, daCoMau: RONG, daHoi: new Set(['25000|cà phê']) })).toBeNull();
  });

  it('⭐ tất định: đảo thứ tự mảng đầu vào ⇒ CÙNG một đề nghị; nhiều khoá ⇒ lấy khoá nhiều lần nhất', () => {
    const homNay = '2026-08-14';
    const so = [
      ...['2026-08-09', '2026-08-11', '2026-08-13'].map((n) => k(n, 25_000, 'cà phê')),
      ...['2026-08-08', '2026-08-10', '2026-08-12', homNay].map((n) => k(n, 15_000, 'gửi xe')),
    ];
    const xuoi = deNghiMauLap({ so, homNay, daCoMau: RONG, daHoi: RONG });
    const nguoc = deNghiMauLap({ so: [...so].reverse(), homNay, daCoMau: RONG, daHoi: RONG });
    expect(xuoi?.khoa, '4 lần > 3 lần').toBe('15000|gửi xe');
    expect(nguoc).toEqual(xuoi);
  });

  it('khoản ở TƯƠNG LAI không được tính (người dùng gõ nhầm ngày)', () => {
    const homNay = '2026-08-14';
    const so = [k('2026-08-12', 25_000, 'cà phê'), k('2026-08-13', 25_000, 'cà phê'), k('2026-08-20', 25_000, 'cà phê')];
    expect(deNghiMauLap({ so, homNay, daCoMau: RONG, daHoi: RONG })).toBeNull();
  });
});

describe('§I-bis — GIÚP 2 nhánh KHOẢN CỐ ĐỊNH THEO THÁNG (founder 21/09)', () => {
  /*
   * ⚠⚠ Luật cửa-sổ-lăn ở §I KHÔNG BAO GIỜ bắt được tiền trọ mùng 5 — hai lần cách nhau một tháng
   * thì chẳng bao giờ cùng nằm trong 14 ngày. Đây là cả lý do nhánh này tồn tại.
   */
  /** Nền khoản nhỏ để trung vị KHOẢN ≈ 30.000 ⇒ sàn cố định = 60.000. */
  const NEN: Khoan[] = Array.from({ length: 9 }, (_, i) =>
    k(`2026-07-${String(i + 1).padStart(2, '0')}`, 30_000, 'ăn'));

  it('⭐⭐⭐ trọ 2 triệu mùng 5 hai tháng liền ⇒ ĐỀ NGHỊ (nhịp THÁNG) — luật ngày không thấy gì', () => {
    const tro = [k('2026-07-05', 2_000_000, 'tiền trọ'), k('2026-08-05', 2_000_000, 'tiền trọ')];
    const d = deNghiMauLap({ so: [...NEN, ...tro], homNay: '2026-08-20', daCoMau: RONG, daHoi: RONG });
    expect(d?.nhip).toBe('thang');
    expect([d?.soTien, d?.ghiChu, d?.lan, d?.cuaSo]).toEqual([2_000_000, 'tiền trọ', 2, null]);
  });

  it('⭐⭐ lệch vài ngày vẫn tính (trả trọ sớm/muộn); lệch quá dung sai thì KHÔNG', () => {
    const gan = [k('2026-07-05', 2_000_000, 'tiền trọ'), k('2026-08-08', 2_000_000, 'tiền trọ')];
    expect(deNghiMauLap({ so: [...NEN, ...gan], homNay: '2026-08-20', daCoMau: RONG, daHoi: RONG })?.nhip).toBe('thang');
    const xa = [k('2026-07-05', 2_000_000, 'tiền trọ'), k('2026-08-20', 2_000_000, 'tiền trọ')];
    expect(deNghiMauLap({ so: [...NEN, ...xa], homNay: '2026-08-25', daCoMau: RONG, daHoi: RONG })).toBeNull();
  });

  it('⭐⭐⭐ KHOẢN NHỎ lặp theo tháng thì KHÔNG hỏi — điều kiện cỡ là thứ giữ luật này dùng được', () => {
    // Đo được: bỏ lọc cỡ thì luật tháng bắn 18–23 khoá trùng hợp mỗi 4 tháng (tiền Việt tròn 5k).
    const nho = [k('2026-07-05', 30_000, 'ăn'), k('2026-08-05', 30_000, 'ăn')];
    expect(deNghiMauLap({ so: [...NEN, ...nho], homNay: '2026-08-20', daCoMau: RONG, daHoi: RONG })).toBeNull();
  });

  it('⭐⭐ khoản cố định ĐỨNG TRƯỚC thói quen lặt vặt khi cả hai cùng đủ điều kiện', () => {
    // Cà phê 25k ba lần trong 14 ngày (nhịp ngày) VÀ trọ 2tr hai tháng (nhịp tháng) — trọ thắng.
    const ca = ['2026-08-10', '2026-08-14', '2026-08-18'].map((n) => k(n, 25_000, 'cà phê'));
    const tro = [k('2026-07-05', 2_000_000, 'tiền trọ'), k('2026-08-05', 2_000_000, 'tiền trọ')];
    const d = deNghiMauLap({ so: [...NEN, ...ca, ...tro], homNay: '2026-08-20', daCoMau: RONG, daHoi: RONG });
    expect([d?.nhip, d?.ghiChu]).toEqual(['thang', 'tiền trọ']);
  });

  it('⭐⭐⭐ sàn cỡ đo theo TRUNG VỊ KHOẢN, không theo TRUNG VỊ NGÀY — gói cước 90k phải lọt', () => {
    /*
     * ⚠⚠ Một ngày gộp NHIỀU khoản, nên trung vị NGÀY cao hơn trung vị KHOẢN nhiều lần. Đo trên sổ giả
     * (§B1-ter vs §B1-quater): lấy nhầm trung vị NGÀY thì gói cước 90k hằng tháng bị bắt 0–1% — nó nằm
     * DƯỚI một ngày chi thường, dù nó gấp ba một khoản thường. Bài này dựng đúng thế: mỗi ngày BA khoản
     * 30k ⇒ trung vị KHOẢN 30k (sàn 60k, lọt) nhưng trung vị NGÀY 90k (sàn 180k, trượt).
     */
    const day: Khoan[] = [];
    for (let d = 1; d <= 8; d++) {
      for (let i = 0; i < 3; i++) day.push(k(`2026-07-${String(d).padStart(2, '0')}`, 30_000, 'ăn'));
    }
    const cuoc = [k('2026-07-12', 90_000, 'nạp đt'), k('2026-08-12', 90_000, 'nạp đt')];
    const d = deNghiMauLap({ so: [...day, ...cuoc], homNay: '2026-08-20', daCoMau: RONG, daHoi: RONG });
    expect(d?.nhip, 'gói cước 90k hằng tháng phải được hỏi').toBe('thang');
    expect(d?.soTien).toBe(90_000);
  });
  it('chép tay — `chuoiThangDaiNhat`: ba mốc cách nhau một tháng ⇒ 3; hai mốc sát nhau ⇒ 1', () => {
    expect(chuoiThangDaiNhat(['2026-06-05', '2026-07-05', '2026-08-05'])).toBe(3);
    expect(chuoiThangDaiNhat(['2026-08-05', '2026-08-06'])).toBe(1);
    expect(chuoiThangDaiNhat([])).toBe(0);
  });
});

describe('§II — GIÚP 4: quy món lớn ra đơn vị của chính người dùng', () => {
  /** Sáu ngày có chi, trung vị = 50.000: 30 · 40 · 50 · 50 · 60 · 70 (chẵn ⇒ (50+50)/2). */
  const SAU_NGAY: readonly Khoan[] = [
    k('2026-08-01', 30_000), k('2026-08-02', 40_000), k('2026-08-03', 50_000),
    k('2026-08-04', 50_000), k('2026-08-05', 60_000), k('2026-08-06', 70_000),
  ];
  const hu = (id: string, muc: number | null): Hu => ({
    id, ten: id, muc, mocGop: null, loai: 'muc_tieu', mau: 1, taoLuc: LUC, suaLuc: LUC,
  } as unknown as Hu);

  it('chép tay: 300.000 trên nền 50.000 ⇒ 6 ngày thường; mức hũ 1.000.000 ⇒ 30%', () => {
    const q = quyDoiMon({ soTien: 300_000, so: SAU_NGAY, hu: [hu('h1', 1_000_000)] });
    expect(q).toEqual({ soNgayThuong: 6, nenNgay: 50_000, phanMucHu: 0.3, huId: 'h1' });
  });

  it(`⭐ CHƯA đủ ${PFM.GUONG_SAN_NGAY_CHI} ngày có chi ⇒ null (P7), dù khoản rất to`, () => {
    expect(quyDoiMon({ soTien: 5_000_000, so: SAU_NGAY.slice(0, 5), hu: [hu('h1', 1_000_000)] })).toBeNull();
  });

  it(`⭐⭐ khoản DƯỚI ${PFM.ORACLE_HE_SO_MON_LON} × nền ⇒ im; đúng bằng ngưỡng ⇒ nói`, () => {
    const duoi = quyDoiMon({ soTien: 2 * 50_000 - 1, so: SAU_NGAY, hu: [] });
    const bang = quyDoiMon({ soTien: 2 * 50_000, so: SAU_NGAY, hu: [] });
    expect(duoi).toBeNull();
    expect(bang?.soNgayThuong).toBe(2);
  });

  it('không có hũ nào ĐẶT MỨC ⇒ `phanMucHu` null, phần "ngày thường" vẫn nói được', () => {
    const q = quyDoiMon({ soTien: 300_000, so: SAU_NGAY, hu: [hu('h1', null), hu('h2', 0)] });
    expect([q?.phanMucHu, q?.huId, q?.soNgayThuong]).toEqual([null, null, 6]);
  });

  it('⭐⭐ chọn hũ CÒN THIẾU NHIỀU NHẤT, và "đã góp" tính TỪ SỔ chứ không cất trên hũ', () => {
    /*
     * h1 mức 1.000.000 đã góp 900.000 ⇒ còn thiếu 100.000
     * h2 mức   500.000 chưa góp gì     ⇒ còn thiếu 500.000  ⟵ chọn cái này
     * ⚠ Nếu ai đó đổi sang "hũ có mức lớn nhất" thì h1 thắng và câu chữ nói 30% của một hũ
     *   người dùng sắp xong — phép so ít nghĩa nhất trong hai cái.
     */
    const gop: Khoan = { ...k('2026-08-06', 900_000), huId: 'h1' };
    const q = quyDoiMon({ soTien: 300_000, so: [...SAU_NGAY, gop], hu: [hu('h1', 1_000_000), hu('h2', 500_000)] });
    expect(q?.huId).toBe('h2');
    expect(q?.phanMucHu).toBe(0.6);
  });
});

describe('§III — GIÚP 5: tiền đi tới ngày nào', () => {
  const VE = '2026-08-05';
  /** Tiền về 1.000.000 ngày 05; chi 100k mỗi ngày 05→09; hôm nay 09 ⇒ đã tiêu 500k (50%). */
  const SO: readonly Khoan[] = [
    k(VE, 1_000_000, 'lương', 'thu'),
    k('2026-08-05', 100_000), k('2026-08-06', 100_000), k('2026-08-07', 100_000),
    k('2026-08-08', 100_000), k('2026-08-09', 100_000),
  ];

  it('chép tay: đã tiêu 50%, nhịp 100.000/ngày, còn 500.000 ⇒ hết vào ngày 14', () => {
    const r = tienToiNgay(SO, '2026-08-09');
    expect(r).toEqual({
      ngayVe: VE, tienVe: 1_000_000, daTieu: 500_000, tyLeDaTieu: 0.5, conLai: 500_000,
      nhip: 100_000, nhipNgay: 3, ngayHet: '2026-08-14',
    });
  });

  it('⭐ ngoại suy phải LÀM TRÒN LÊN: còn 250.000 với nhịp 100.000 ⇒ 3 ngày, không phải 2,5', () => {
    const so = [k(VE, 750_000, 'lương', 'thu'), ...SO.slice(1)];
    expect(tienToiNgay(so, '2026-08-09')?.ngayHet).toBe('2026-08-12');
  });

  it('⭐⭐⭐ nhịp 0 (ba ngày qua không tiêu gì) ⇒ null — KHÔNG bịa một ngày xa tít', () => {
    // ⚠ Chia cho 0 ở đây ra `Infinity` rồi `congNgay` chạy vô hạn; và kể cả chặn được thì
    //   một câu "tiền của bạn đi tới năm 2199" là vô nghĩa với người đọc.
    const so = [k(VE, 1_000_000, 'lương', 'thu'), k('2026-08-05', 100_000), k('2026-08-06', 100_000)];
    expect(tienToiNgay(so, '2026-08-12')).toBeNull();
  });

  it(`⭐ chưa đủ ${PFM.ORACLE_NHIP_NGAY} ngày kể từ lần tiền về ⇒ null (chưa có "nhịp" nào để nói)`, () => {
    expect(tienToiNgay(SO, '2026-08-06')).toBeNull();
    expect(tienToiNgay(SO, '2026-08-07'), 'đúng ba ngày (05·06·07) thì nói được').not.toBeNull();
  });

  it('⭐⭐ tiêu QUÁ số tiền về ⇒ `conLai` âm, `tyLeDaTieu` > 1 (không kẹp), `ngayHet` null', () => {
    const so = [k(VE, 300_000, 'lương', 'thu'), ...SO.slice(1)];
    const r = tienToiNgay(so, '2026-08-09');
    expect(r?.conLai).toBe(-200_000);
    expect(r?.tyLeDaTieu).toBeCloseTo(500_000 / 300_000, 10);
    expect(r?.ngayHet).toBeNull();
  });

  it('lấy lần tiền về GẦN NHẤT, và gộp mọi khoản thu TRONG ĐÚNG ngày ấy', () => {
    const so = [
      k('2026-08-01', 2_000_000, 'lương', 'thu'),
      k(VE, 600_000, 'mẹ cho', 'thu'), k(VE, 400_000, 'bán đồ', 'thu'),
      ...SO.slice(1),
    ];
    const r = tienToiNgay(so, '2026-08-09');
    expect([r?.ngayVe, r?.tienVe]).toEqual([VE, 1_000_000]);
  });

  it('chưa có lần tiền về nào ⇒ null', () => {
    expect(tienToiNgay(SO.slice(1), '2026-08-09')).toBeNull();
  });
});
