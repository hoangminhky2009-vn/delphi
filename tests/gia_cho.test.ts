/**
 * B6 — PROPERTY TEST cho lớp định giá (`server/kinh_te/gia.ts`).
 *
 * Bất biến E7 của `kien-truc-ky-thuat.md` §6 nói: `gia_san < gia_ban_ra` ∀ trạng
 * thái. "∀" là chữ quan trọng — nên bài này quét **toàn miền tham số** chứ không
 * thử vài ca đẹp. Chính lượt quét đó lôi ra cái bẫy floor ở giá nhỏ.
 */
import { describe, it, expect } from 'vitest';
import { CHO, CHO_BP, GACHA_EV, PHI, TRAN_VE_DANG_CAI } from '../config/cho.js';
import { ECONOMY } from '../config/economy.js';
import { GACHA } from '../server/sandbox/gacha.js';
import {
  chiaPhi, evCentiLuotDenEpic, evTDenEpic, evTDenEpicCuThe,
  giaBanLaiVe, giaBanRa, giaSan, giaVe,
} from '../server/kinh_te/gia.js';

const BAC = Object.keys(CHO.GIA_GOC);

describe('E7 — `gia_san < gia_ban_ra` ∀ TRẠNG THÁI (quét toàn miền)', () => {
  it('không một tổ hợp (bậc × tồn kho × hệ số quỹ) nào phá bất biến', () => {
    let soCa = 0;
    let soCaCuaDong = 0;
    for (const bac of BAC) {
      for (let ton = 0; ton <= CHO.HS_TON_KHO_BP.length + 2; ton += 1) {
        for (let quy = 0; quy <= CHO_BP; quy += 137) {   // 137: bước lẻ, quét cả biên
          const san = giaSan(bac, ton, quy);
          const ban = giaBanRa(san);
          soCa += 1;
          if (san === 0n) {
            // Cửa ĐÓNG: cả hai chiều đều 0. Đây là trạng thái hợp lệ, không phải lỗi.
            expect(ban).toBe(0n);
            soCaCuaDong += 1;
          } else {
            expect(ban, `bậc=${bac} tồn=${ton} quỹ=${quy}: ${san} → ${ban}`)
              .toBeGreaterThan(san);
          }
        }
      }
    }
    expect(soCa).toBeGreaterThan(1_000);
    // Phải CÓ ca cửa đóng trong miền quét, nếu không thì nhánh đó chưa được thử.
    expect(soCaCuaDong).toBeGreaterThan(0);
  });

  it('⚠ BẪY FLOOR Ở GIÁ NHỎ — chỗ công thức trong thiết kế gãy', () => {
    // floor(1 × 12.000/10.000) = 1 ⇒ nếu theo đúng công thức thiết kế thì giá bán
    // BẰNG giá mua, tức có chuỗi mua–bán với Hệ thống không lỗ.
    expect((1n * BigInt(CHO_BP + CHO.SPREAD_BP)) / BigInt(CHO_BP)).toBe(1n);
    // Hàm thật phải vá được: luôn hơn ít nhất một đơn vị.
    expect(giaBanRa(1n)).toBe(2n);
    expect(giaBanRa(2n)).toBe(3n);
    expect(giaBanRa(4n)).toBe(5n);
    // Đủ lớn thì spread thắng mức tối thiểu.
    expect(giaBanRa(100n)).toBe(120n);
  });

  it('giá mua vào GIẢM khi kho đầy dần — bonding curve đi đúng chiều', () => {
    const g = (ton: number) => giaSan('epic', ton, CHO.HS_QUY_BP_MAC_DINH);
    for (let i = 1; i < CHO.HS_TON_KHO_BP.length; i += 1) {
      expect(g(i)).toBeLessThan(g(i - 1));
    }
  });

  it('quỹ cạn ⇒ giá mua vào về 0 ⇒ CỬA ĐÓNG (D65 — fail rõ, không treo)', () => {
    expect(giaSan('epic', 0, 0)).toBe(0n);
    expect(giaBanRa(0n)).toBe(0n);
  });

  it('từ chối đầu vào vô nghĩa thay vì trả một con số trông có lý', () => {
    expect(() => giaSan('khong_co_bac_nay', 0, CHO_BP)).toThrow();
    expect(() => giaSan('epic', -1, CHO_BP)).toThrow();
    expect(() => giaSan('epic', 0, CHO_BP + 1)).toThrow();
    expect(() => giaBanRa(-1n)).toThrow();
  });
});

describe('Phí — giữ nguyên khuôn rake, không đặt số mới', () => {
  it('3% đốt + 2% Kho bạc lấy THẲNG từ A4, không phải hằng số mới', () => {
    expect(PHI.DOT_BP).toBe(ECONOMY.RAKE_BURN_BP);
    expect(PHI.KHO_BAC_BP).toBe(ECONOMY.RAKE_TREASURY_BP);
    expect(PHI.DOT_BP + PHI.KHO_BAC_BP).toBe(500);
  });

  it('ba phần CỘNG LẠI đúng bằng tổng — không đồng nào bốc hơi (∀ tổng)', () => {
    for (let t = 0; t <= 5_000; t += 7) {
      const p = chiaPhi(BigInt(t));
      expect(p.dot + p.khoBac + p.quyCho).toBe(BigInt(t));
      expect(p.dot).toBeGreaterThanOrEqual(0n);
      expect(p.khoBac).toBeGreaterThanOrEqual(0n);
      expect(p.quyCho).toBeGreaterThanOrEqual(0n);
    }
  });

  it('vector chép tay: 1.900 T ⇒ 57 đốt · 38 Kho bạc · 1.805 quỹ', () => {
    expect(chiaPhi(1_900n)).toEqual({ dot: 57n, khoBac: 38n, quyCho: 1_805n });
  });

  it('phần dư do floor về QUỸ, không đốt thêm (khác residual của A5.1 — có chủ ý)', () => {
    const p = chiaPhi(33n);   // 33×3% = 0,99 → 0 ; 33×2% = 0,66 → 0
    expect(p.dot).toBe(0n);
    expect(p.khoBac).toBe(0n);
    expect(p.quyCho).toBe(33n);
  });
});

describe('Bậc thang vé — bậc thang CHÍNH LÀ trần', () => {
  it('⚠ hết bậc ⇒ null = HẾT VÉ, không phải "giá cao nhất" (founder bác 05/09)', () => {
    const bang = CHO.VE_DANG_CAI_BAC;
    expect(giaVe(bang, 0)).toBe(BigInt(bang[0]!));
    expect(giaVe(bang, bang.length - 1)).toBe(BigInt(bang[bang.length - 1]!));
    expect(giaVe(bang, bang.length)).toBeNull();
    expect(giaVe(bang, bang.length + 99)).toBeNull();
  });

  it('số bậc = trần vé mỗi phiên — một con số, hai vai, không có trần thứ hai', () => {
    expect(TRAN_VE_DANG_CAI).toBe(CHO.VE_DANG_CAI_BAC.length);
  });

  it('giá vé chỉ ĐI LÊN — một bậc phẳng là một chỗ gom hàng không tốn thêm', () => {
    for (const bang of [CHO.VE_DANG_CAI_BAC, CHO.VE_DAU_BAC]) {
      for (let i = 1; i < bang.length; i += 1) {
        expect(bang[i]!).toBeGreaterThan(bang[i - 1]!);
      }
    }
  });

  it('vé ĐẤU rẻ hơn hẳn vé ĐĂNG CAI ở mọi bậc (ba tầng của §7.11)', () => {
    for (let i = 0; i < CHO.VE_DAU_BAC.length; i += 1) {
      expect(CHO.VE_DAU_BAC[i]!).toBeLessThan(CHO.VE_DANG_CAI_BAC[i]!);
    }
  });
});

describe('E19 — bán lại vé KHÔNG được thành máy in tiền', () => {
  const bang = CHO.VE_DANG_CAI_BAC;

  it('mua hết rồi bán hết trả về ĐÚNG tỷ lệ bán lại, không hơn một đồng', () => {
    let daTra = 0n;
    for (let i = 0; i < bang.length; i += 1) daTra += giaVe(bang, i)!;
    let thuVe = 0n;
    for (let n = bang.length - 1; n >= 0; n -= 1) thuVe += giaBanLaiVe(bang, n);
    // Giá đọc SAU khi giảm ⇒ đối xứng tuyệt đối với hệ số bán lại.
    expect(thuVe).toBe((daTra * BigInt(CHO.VE_BAN_LAI_BP)) / BigInt(CHO_BP));
    expect(thuVe).toBeLessThan(daTra);
  });

  it('⚠ nếu đọc giá TRƯỚC khi giảm thì có lãi — đây là cái bẫy, ghi lại bằng số', () => {
    let daTra = 0n;
    for (let i = 0; i < bang.length; i += 1) daTra += giaVe(bang, i)!;
    // Cách SAI: mọi tấm đều bán ở bậc cao nhất đang đứng.
    const bacCaoNhat = BigInt(bang[bang.length - 1]!);
    const thuVeSai = (bacCaoNhat * BigInt(CHO.VE_BAN_LAI_BP)) / BigInt(CHO_BP)
      * BigInt(bang.length);
    expect(thuVeSai).toBeGreaterThan(daTra);   // ← máy in tiền, nếu làm sai
  });

  it('bán lại luôn THẤP HƠN giá mua ở cùng bậc — không có vòng lặp tức thì', () => {
    for (let n = 0; n < bang.length; n += 1) {
      expect(giaBanLaiVe(bang, n)).toBeLessThan(giaVe(bang, n)!);
    }
  });
});

describe('Kỳ vọng gacha — giáo cụ, số phải khớp con số đã công bố', () => {
  it('12,83 lượt để ra một epic (rate 5%, pity 20) — con số D246 §3 in ra', () => {
    expect(evCentiLuotDenEpic()).toBe(1_283);
  });

  it('≈1.283 T một epic — ĐẮT HƠN cả vốn khởi điểm, đó là cả bài học', () => {
    const t = evTDenEpic(GACHA.COST_T);
    expect(t).toBe(1_283n);
    expect(t).toBeGreaterThan(BigInt(ECONOMY.STARTING_BANKROLL));
  });

  it('một epic CỤ THỂ trong bể 5 mẫu ≈ 6.415 T — lý do chợ thứ cấp tồn tại', () => {
    expect(evTDenEpicCuThe(GACHA.COST_T, 5)).toBe(6_415n);
  });

  it('pity càng chặt thì kỳ vọng càng thấp; rate càng cao thì càng thấp', () => {
    expect(evCentiLuotDenEpic(GACHA_EV.RATE_EPIC_BP, 10))
      .toBeLessThan(evCentiLuotDenEpic(GACHA_EV.RATE_EPIC_BP, 20));
    expect(evCentiLuotDenEpic(1_000, 20)).toBeLessThan(evCentiLuotDenEpic(500, 20));
  });

  it('không pity (pity = 1) ⇒ đúng 1 lượt kỳ vọng theo định nghĩa tổng', () => {
    expect(evCentiLuotDenEpic(500, 1)).toBe(100);
  });

  it('tất định: gọi lại nhiều lần ra cùng một số', () => {
    const a = evCentiLuotDenEpic();
    for (let i = 0; i < 5; i += 1) expect(evCentiLuotDenEpic()).toBe(a);
  });
});

describe('⭐ E7b — KHÔNG có vòng bán-rồi-mua-lại CÓ LỜI (bất biến ở mức giao dịch)', () => {
  /*
   * E7 nói `gia_san < gia_ban_ra` TẠI MỘT trạng thái. Nhưng một cú bán LÀM ĐỔI
   * trạng thái: tồn kho Hệ thống tăng 1, nên giá mua vào tụt xuống bậc kế. Câu
   * hỏi thật của một cái chợ là câu BẮC QUA hai trạng thái đó:
   *
   *     bán ở tồn `n`  ⇒ nhận `gia_san(n)`
   *     mua lại ngay   ⇒ trả `gia_ban_ra(gia_san(n+1))`
   *
   * Nếu vế sau NHỎ HƠN vế trước thì tồn tại một vòng lặp tự sinh lời, và nó sẽ
   * bị tìm ra trong vòng một buổi tối. E7 một mình KHÔNG bắt được ca này — nó
   * chỉ nhìn trong một trạng thái.
   */
  it('bán ở tồn n rồi mua lại ở tồn n+1: người chơi KHÔNG BAO GIỜ lãi', () => {
    for (const bac of BAC) {
      for (let n = 0; n <= CHO.HS_TON_KHO_BP.length + 3; n += 1) {
        const nhan = giaSan(bac, n, CHO.HS_QUY_BP_MAC_DINH);
        const tra = giaBanRa(giaSan(bac, n + 1, CHO.HS_QUY_BP_MAC_DINH));
        expect(tra, `bậc=${bac} tồn=${n}: nhận ${nhan}, mua lại ${tra}`)
          .toBeGreaterThanOrEqual(nhan);
      }
    }
  });

  it('⚠ ĐỆM MỎNG NHẤT LÀ 0 T, ở đúng bậc cuối bảng tồn kho — số để founder biết', () => {
    /*
     * Không phải lỗ hổng (không ai LÃI), nhưng đệm bằng 0 nghĩa là ở bậc đó một
     * vòng mua–bán khống là MIỄN PHÍ. Hôm nay không có gì thưởng theo "số giao
     * dịch" nên nó vô hại; ngày có nhiệm vụ kiểu đó thì đây là cửa vào.
     *
     * Nguyên nhân là số học chứ không phải bất cẩn: bậc cuối bảng là 5.000 bp và
     * spread là 12.000 bp, mà 0,5 × 1,2 = 0,6 = đúng bậc liền trước (6.000 bp).
     * Đổi `SPREAD_BP` hoặc bảng `HS_TON_KHO_BP` thì con số này đổi theo — nên nó
     * được KHOÁ ở đây để một cú vặn tham số không lặng lẽ biến 0 thành số âm.
     */
    let demMin = Infinity;
    let taiDau = '';
    for (const bac of BAC) {
      for (let n = 0; n <= CHO.HS_TON_KHO_BP.length + 3; n += 1) {
        const dem = Number(giaBanRa(giaSan(bac, n + 1, CHO.HS_QUY_BP_MAC_DINH))
          - giaSan(bac, n, CHO.HS_QUY_BP_MAC_DINH));
        if (dem < demMin) { demMin = dem; taiDau = `${bac}@tồn ${n}→${n + 1}`; }
      }
    }
    expect(demMin, `đệm mỏng nhất tại ${taiDau}`).toBe(0);
    expect(taiDau).toBe(`thuong@tồn ${CHO.HS_TON_KHO_BP.length - 2}→${CHO.HS_TON_KHO_BP.length - 1}`);
  });
});
