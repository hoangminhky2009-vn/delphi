/**
 * PFM — APP TỰ CHẤM LỜI ĐOÁN CỦA CHÍNH NÓ (`cham_doan.ts`, D368). VECTOR CHÉP TAY.
 *
 * ⚠ Bài đắt nhất là §V: **chữ của lời đoán phải khớp phép đo**. Không có nó thì hai bên trôi
 * khỏi nhau trong im lặng — app hứa một đằng, chấm một nẻo, mà mọi bài khác vẫn xanh.
 */
import { describe, expect, it } from 'vitest';
import { PFM } from '@config/pfm';
import { chamDoan, congThanhTich, CUA_CUA_DOAN } from '../src/pfm/cham_doan.js';
import { MA_CHAN_DUNG } from '../src/pfm/chan_dung.js';
import { CHAN_DUNG_NOI_DUNG } from '../src/lib/pfm_chu';
import type { Khoan } from '../src/pfm/so.js';

const LUC = '2026-09-01T00:00:00.000Z';
let dem = 0;
function k(ngay: string, soTien: number, chieu: 'chi' | 'thu' = 'chi', viSale: boolean | null = null): Khoan {
  dem += 1;
  return { id: `c${dem}`, ngay, soTien, chieu, nhan: null, huId: null, cachGhi: 'tay', viSale, taoLuc: LUC, suaLuc: LUC };
}
const N = (d: number): string => `2026-09-${String(d).padStart(2, '0')}`;
/** Sáu ngày có chi (đủ sàn), mỗi ngày 30.000 — nền phẳng để từng bài tự dựng đỉnh của mình. */
const NEN: Khoan[] = [1, 2, 3, 4, 5, 6].map((d) => k(N(d), 30_000));

describe('§I — cổng chung', () => {
  it(`chưa đủ ${PFM.GUONG_SAN_NGAY_CHI} ngày có chi ⇒ chua_du (P7: chưa kiểm được thì CHƯA SAI)`, () => {
    const r = chamDoan('ngay_te', NEN.slice(0, 5), N(1), N(7));
    expect([r.ketQua, r.so]).toEqual(['chua_du', null]);
  });

  it('`chua_ro` không đoán gì ⇒ không chấm gì', () => {
    expect(chamDoan('chua_ro', NEN, N(1), N(7)).ketQua).toBe('chua_du');
    expect(CUA_CUA_DOAN.chua_ro).toBeNull();
  });

  it('⭐ khoản NGOÀI cửa sổ không được tính — và phán quyết vẫn phải là phán quyết THẬT', () => {
    /*
     * ⚠ Bản đầu chỉ đòi `doDuoc !== 9.000.000`, và mũi tiêm "bỏ lọc cửa sổ" KHÔNG đỏ: đỉnh ngoài
     * kỳ kéo phán quyết về `chua_du`, mà `chua_du` có `so === null` nên cũng "khác 9 triệu".
     * Một khẳng định phủ định thoả mãn được bằng im lặng thì không canh gì cả.
     */
    const r = chamDoan('ngay_te', [...NEN, k(N(20), 9_000_000)], N(1), N(7));
    expect(r.ketQua, 'đỉnh ngoài kỳ bị bỏ qua ⇒ vẫn chấm được trên nền phẳng').toBe('trat');
    expect(r.so).toEqual({ doDuoc: 30_000, moc: 30_000 });
  });
});

describe('§II — tien_ve: ngày đậm nhất có rơi vào 48 giờ sau một lần tiền về không', () => {
  it('⭐ đỉnh NẰM TRONG cửa sổ ⇒ trúng; đẩy đỉnh ra ngoài ⇒ trật', () => {
    const thu = k(N(4), 3_000_000, 'thu');           // cửa sổ = ngày 4 và 5
    const trung = chamDoan('tien_ve', [...NEN, thu, k(N(5), 500_000)], N(1), N(7));
    expect([trung.ketQua, trung.so?.doDuoc]).toEqual(['trung', 530_000]);
    const trat = chamDoan('tien_ve', [...NEN, thu, k(N(2), 500_000)], N(1), N(7));
    expect(trat.ketQua).toBe('trat');
  });

  it('⭐⭐ KHÔNG có lần tiền về nào trong kỳ ⇒ chua_du, KHÔNG phải trật', () => {
    // ⚠ Lời đoán nói về cửa sổ tiền về; không có cửa sổ thì nó chưa có cơ hội sai.
    expect(chamDoan('tien_ve', [...NEN, k(N(5), 500_000)], N(1), N(7)).ketQua).toBe('chua_du');
  });
});

describe('§III — ngay_te: ngay sau ngày đậm nhất có tiêu trên mức thường ngày không', () => {
  it('⭐ ngày sau đỉnh CAO hơn trung vị ⇒ trúng; thấp hơn ⇒ trật', () => {
    // NEN phẳng 30k; đỉnh ngày 3, ngày 4 nâng lên 50k > trung vị.
    const trung = chamDoan('ngay_te', [...NEN, k(N(3), 500_000), k(N(4), 20_000)], N(1), N(7));
    expect(trung.ketQua).toBe('trung');
    expect(trung.so).toEqual({ doDuoc: 50_000, moc: 30_000 });
    const trat = chamDoan('ngay_te', [...NEN, k(N(3), 500_000)], N(1), N(7));
    expect([trat.ketQua, trat.so?.doDuoc]).toEqual(['trat', 30_000]);
  });

  it('⭐⭐ đỉnh rơi đúng ngày CUỐI cửa sổ ⇒ chua_du (không có "ngày sau" để nhìn)', () => {
    expect(chamDoan('ngay_te', [...NEN, k(N(7), 900_000)], N(1), N(7)).ketQua).toBe('chua_du');
  });

  it('⭐⭐ hoà đỉnh ⇒ lấy ngày SỚM hơn (không phải "muộn hơn", và không phải "tuỳ thứ tự mảng")', () => {
    /*
     * ⚠ Bản đầu chỉ so xuôi với ngược rồi thấy bằng nhau — nhưng `ngayDamNhat` duyệt theo khoá ĐÃ
     * SẮP, nên đổi `>` thành `>=` vẫn tất định, chỉ là chọn ngày KHÁC. Bài phải khoá CHỌN NGÀY NÀO.
     * Dựng để hai lựa chọn ra hai phán quyết ngược nhau: sau ngày 3 là ngày 4 (50k > trung vị) ⇒ trúng;
     * sau ngày 5 là ngày 6 (30k = trung vị) ⇒ trật.
     */
    const a = [...NEN, k(N(3), 470_000), k(N(5), 470_000), k(N(4), 20_000)];
    const r = chamDoan('ngay_te', a, N(1), N(7));
    expect(r.ketQua, 'đỉnh phải là ngày 3 — ngày SỚM hơn').toBe('trung');
    // trung vị = 40k: sáu ngày [30,30,30,50,500,500] ⇒ (30+50)/2. Ngày 4 tự nó kéo trung vị lên.
    expect(r.so).toEqual({ doDuoc: 50_000, moc: 40_000 });
    expect(chamDoan('ngay_te', [...a].reverse(), N(1), N(7)), 'đảo mảng ⇒ y hệt').toEqual(r);
  });
});

describe('§IV — ban_ru · cuoi_thang', () => {
  it('⭐ khoản lớn nhất CÓ nhãn "vì sale" ⇒ trúng; không có ⇒ trật', () => {
    const co = chamDoan('ban_ru', [...NEN, k(N(3), 800_000, 'chi', true)], N(1), N(7));
    expect([co.ketQua, co.so]).toEqual(['trung', { doDuoc: 800_000, moc: 1 }]);
    const khong = chamDoan('ban_ru', [...NEN, k(N(3), 800_000, 'chi', false), k(N(4), 20_000, 'chi', true)], N(1), N(7));
    expect(khong.ketQua).toBe('trat');
  });

  it('⭐⭐⭐ CHƯA gắn nhãn khoản nào ⇒ chua_du — im lặng của họ KHÔNG phải câu trả lời "không"', () => {
    /*
     * ⚠ P6: `viSale` là thứ NGƯỜI DÙNG tự khai. Đọc "chưa gắn" thành "không phải vì sale" là app
     * tự trả lời hộ họ rồi lấy đó chấm điểm chính mình — một lượt trúng/trật dựng trên dữ liệu không
     * tồn tại. Mà `viSale` mặc định là `null` cho MỌI khoản, nên nhánh này là đường CHÍNH, không hiếm.
     */
    expect(chamDoan('ban_ru', [...NEN, k(N(3), 800_000)], N(1), N(7)).ketQua).toBe('chua_du');
  });

  it('⭐ cuoi_thang: nửa sau nhiều hơn nửa đầu ⇒ trúng, cắt theo NGÀY LỊCH', () => {
    const so = [...[1, 2, 3, 4, 5].map((d) => k(N(d), 20_000)), ...[6, 7, 8, 9, 10].map((d) => k(N(d), 60_000))];
    const r = chamDoan('cuoi_thang', so, N(1), N(10));
    expect([r.ketQua, r.so]).toEqual(['trung', { doDuoc: 300_000, moc: 100_000 }]);
    expect(chamDoan('cuoi_thang', so, N(10), N(1)).ketQua, 'cửa sổ lộn ngược ⇒ chua_du').toBe('chua_du');
  });
});

describe('§V — ⭐⭐⭐ CHỮ PHẢI KHỚP PHÉP ĐO', () => {
  /*
   * ⚠⚠ Đây là bài giữ cho lời đoán khỏi thành lá số tử vi. Mỗi câu `doan` phải nhắc tới đúng
   * đại lượng mà `chamDoan` đo; sửa một bên mà quên bên kia thì app hứa một đằng chấm một nẻo,
   * và KHÔNG bài nào khác đỏ.
   */
  const MOC: Record<string, readonly string[]> = {
    tien_ve: ['đậm nhất', 'tiền về'],
    ngay_te: ['đậm nhất', 'thường ngày'],
    ban_ru: ['lớn nhất', 'vì sale'],
    cuoi_thang: ['nửa cuối', 'nửa đầu'],
  };

  it('mỗi lời đoán nhắc đúng đại lượng nó bị chấm theo', () => {
    for (const [ma, tu] of Object.entries(MOC)) {
      const cau = CHAN_DUNG_NOI_DUNG[ma as keyof typeof CHAN_DUNG_NOI_DUNG].doan.toLowerCase();
      for (const t of tu) expect(cau, `chân dung ${ma} thiếu "${t}"`).toContain(t);
    }
  });

  it('mọi chân dung CÓ lời đoán đều có cửa chấm, và ngược lại', () => {
    for (const ma of MA_CHAN_DUNG) {
      const coDoan = CHAN_DUNG_NOI_DUNG[ma].doan !== '';
      expect(CUA_CUA_DOAN[ma] !== null, `${ma}: lời đoán và cửa chấm lệch nhau`).toBe(coDoan);
    }
  });
});

describe('§VI — sổ thành tích LÀ CỦA APP', () => {
  it('chua_du KHÔNG vào sổ — nó chưa phải một lượt đoán', () => {
    let s = { trung: 0, trat: 0 };
    s = congThanhTich(s, 'chua_du');
    expect(s).toEqual({ trung: 0, trat: 0 });
    s = congThanhTich(congThanhTich(s, 'trung'), 'trat');
    expect(s).toEqual({ trung: 1, trat: 1 });
  });
});
