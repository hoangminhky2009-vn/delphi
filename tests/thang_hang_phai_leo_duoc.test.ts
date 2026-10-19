/**
 * THANG HẠNG PHẢI LEO ĐƯỢC — chiết khấu cỡ mẫu (24/08, founder: *"Fix it"*).
 *
 * BỆNH: điểm phong cách là TRUNG BÌNH CÓ TRỌNG SỐ, nên nó gần như không nhúc
 * nhích theo số vòng — một chuỗi vòng đẹp cho **933đ (SS) ngay ở VÒNG 1** và
 * 975đ (SSS) ở vòng 3, bằng đúng con số của 16 vòng như thế. Thang hạng vì vậy
 * không phải thứ leo được: nó có sẵn từ vòng đầu, và lớp phủ toàn màn (D113) nổ
 * cho một thành tích chưa ai kịp lập.
 *
 * CHỮA: cộng `SAN_VONG_TIN_CAY` giả-vòng ở mốc trung tính, tan dần về 0 từ vòng
 * thứ 4. Sớm thì "chưa biết"; cuối trận thì trả lại đúng con số cũ.
 *
 * ⚠⚠ ĐÍNH CHÍNH D115: ghi chú *"ngồi im 3 vòng đầu vẫn ra 974đ = SSS"* KHÔNG tái
 * lập được trên trận thật. Đo 600 trận bot (map 8, v34): SSS chỉ nổ ở 0,8% số
 * trận, đúng 1 lần ở ≤ vòng 3. Thứ nổ sớm là **S và SS** — 40% và 64% số cú nổ
 * nằm ở ≤ vòng 3. Con số cũ nhiều khả năng đo trên một chuỗi dựng tay.
 */
import { describe, expect, it } from 'vitest';
import { PC, chamPhongCach, hangCua, type VongPhongCach } from '../server/holdem/phong_cach.js';

/** Vòng "đẹp tối đa": đứng ngoài đúng lúc chợ xuống ⇒ cả ba trục kịch trần. */
const dep: VongPhongCach = { brier: null, nav_bp: 0, cho_bp: -400, tu_dong: false };
const chuoi = (n: number, v: VongPhongCach = dep) => Array.from({ length: n }, () => v);

describe('I. Vài vòng đầu là "CHƯA BIẾT", không phải "xuất sắc"', () => {
  it('⭐⭐ một chuỗi vòng hoàn hảo KHÔNG cho hạng S ở vòng 1', () => {
    /*
     * Đây là bài chịu lực. Trước bản này vòng 1 ra 933đ = SS — một thứ hạng
     * PHONG CÁCH sau đúng một vòng, và lớp phủ toàn màn nổ theo nó.
     */
    const r = chamPhongCach(chuoi(1));
    expect(r.diem, 'vòng 1 vẫn cho điểm gần kịch trần').toBeLessThan(700);
    expect(r.hang.startsWith('S'), `vòng 1 ra hạng ${r.hang} — chưa ai leo gì cả`)
      .toBe(false);
  });

  it('⭐ điểm PHẢI TĂNG theo số vòng với cùng chất lượng chơi', () => {
    // Tính chất "leo được": cùng một kiểu vòng, càng nhiều mẫu càng chắc.
    const d = [1, 2, 3, 4].map((n) => chamPhongCach(chuoi(n)).diem);
    for (let i = 1; i < d.length; i += 1) {
      expect(d[i]!, `điểm không tăng từ ${i} vòng lên ${i + 1} vòng`)
        .toBeGreaterThan(d[i - 1]!);
    }
  });
});

describe('II. ⚠ Hạng CUỐI TRẬN không được xê dịch', () => {
  it('⭐⭐ từ vòng thứ 4 trở đi, điểm bằng ĐÚNG bản không chiết khấu', () => {
    /*
     * Ràng buộc quan trọng nhất: chiết khấu chỉ được chạm mấy vòng đầu. Mọi cỡ
     * map đều ≥ 8 vòng, nên hạng người chơi mang đi khoe phải y hệt trước đây —
     * nếu không thì đây là một cú chỉnh cân bằng trá hình, mà đó là A8.2.
     */
    const khongChietKhau = (vongs: VongPhongCach[]) => {
      // Bản dựng lại phép cũ: trung bình có trọng số, không giả-vòng.
      let streak = 0; let tuSo = 0; let mauSo = 0; const n = vongs.length;
      for (const [i, v] of vongs.entries()) {
        const co = 0.45 * 1 + 0.35 * ((): number => {
          const d = v.nav_bp - (v.cho_bp ?? 0);
          return 0.5 + 0.5 * (d / (Math.abs(d) + PC.HON_CHO_THANG_BP));
        })() + 0.20 * 1;
        if (co >= PC.NGUONG_STREAK && !v.tu_dong) streak += 1; else streak = 0;
        const w = PC.NGHIENG ** (n - 1 - i);
        tuSo += w * Math.min(1, co + Math.min(PC.STREAK_TRAN, streak * PC.STREAK_BONUS));
        mauSo += w;
      }
      return Math.round(1000 * (tuSo / mauSo));
    };
    for (const n of [4, 6, 8, 12, 16]) {
      expect(chamPhongCach(chuoi(n)).diem,
        `${n} vòng: chiết khấu vẫn còn cắn ⇒ hạng cuối trận bị đổi`)
        .toBe(khongChietKhau(chuoi(n)));
    }
  });

  it('sàn phải nhỏ hơn số vòng của map ngắn nhất', () => {
    // Map 8 là cỡ nhỏ nhất. Sàn ≥ 8 thì chiết khấu không bao giờ tan ⇒ nó thôi
    // là "chưa biết" và thành một cú nerf vĩnh viễn.
    expect(PC.SAN_VONG_TIN_CAY).toBeLessThan(8);
    expect(PC.SAN_VONG_TIN_CAY).toBeGreaterThan(0);
  });
});

describe('III. Giả-vòng phải ở mốc TRUNG TÍNH', () => {
  it('⚠ kéo về GIỮA thang, không kéo về 0', () => {
    /*
     * Kéo về 0 là phạt người mới; kéo về giữa là nói "chưa đủ mẫu để khen hay
     * chê". Chuỗi vòng TỆ tối đa phải được kéo LÊN đúng như chuỗi vòng đẹp bị
     * kéo XUỐNG — đối xứng quanh mốc trung tính.
     */
    expect(PC.MOC_TRUNG_TINH).toBe(0.5);
    const te: VongPhongCach = { brier: 2, nav_bp: -900, cho_bp: 400, tu_dong: false };
    const d1 = chamPhongCach(chuoi(1, te)).diem;
    const d8 = chamPhongCach(chuoi(8, te)).diem;
    expect(d1, 'chuỗi vòng tệ ở vòng 1 không được kéo lên ⇒ chiết khấu chỉ phạt một chiều')
      .toBeGreaterThan(d8);
    expect(hangCua(d1)).toBeTruthy();
  });
});
