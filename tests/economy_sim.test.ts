/**
 * B0 — TEST VECTOR CHÉP TAY cho `economy_sim` (A8.3: test TRƯỚC, code sau).
 *
 * Mọi con số trong file này chép từ `docs/khao-co/design_economy_unified.md`
 * (D16) hoặc tính tay từ chính bốn số D16 đã công bố. **Không được sửa test cho
 * khớp code** — nếu lệch thì code sai, hoặc D16 sai và phải hỏi founder (A8.2).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ECONOMY, MUA } from '../config/economy.js';
import { GUARDRAIL } from '../config/guardrail.js';
import {
  BATTLE_PASS, HE_THONG_MUA_LAI_DOC_BAN, tMoiChangDaChot,
} from '../config/battle_pass.js';
import { CHANG_LO_TRINH, MUA_0_0, tranQMua } from '../config/progression.js';
import {
  canDoiMuaDocQuyen, chiPhiBattlePass, chuKyKhoBac, chuKyMuaMoi, danhGiaGuardrail,
  isqrt, nenVi, nghiaVuMuaLai, phiThuVe, quetTroCap, runwayNgay, runwayTuCuaSo,
  sanHoaVi, soDoRong, soLanDoiTayCanCo, tierBonus, tongCungDuKien,
  tyLeQuyenDoiTrenCung, vongQuayChoCanCo, vongQuayDocQuyen,
} from '../server/kinh_te/mo_phong.js';

describe('isqrt — căn nguyên, không float (C5)', () => {
  it('ba mốc dùng cho nén của D16', () => {
    expect(isqrt(4_000n)).toBe(63n);   // 63² = 3.969 ≤ 4.000 < 64² = 4.096
    expect(isqrt(9_000n)).toBe(94n);   // 94² = 8.836 ≤ 9.000 < 95² = 9.025
    expect(isqrt(1_000n)).toBe(31n);   // 31² =   961 ≤ 1.000 < 32² = 1.024
  });
  it('biên', () => {
    expect(isqrt(0n)).toBe(0n);
    expect(isqrt(1n)).toBe(1n);
    expect(isqrt(2n)).toBe(1n);
    expect(isqrt(10_000n)).toBe(100n); // chính phương phải đúng, không lệch 1
    expect(() => isqrt(-1n)).toThrow();
  });
});

describe('Reset mùa bước 1 — NÉN (D16 mục 4, ba ví dụ D16 tự in ra)', () => {
  it('5.000 → 1.630 · 10.000 → 1.940 · 2.000 → 1.310', () => {
    expect(nenVi(5_000n)).toEqual({ sau: 1_630n, veKhoBac: 3_370n });
    expect(nenVi(10_000n)).toEqual({ sau: 1_940n, veKhoBac: 8_060n });
    expect(nenVi(2_000n)).toEqual({ sau: 1_310n, veKhoBac: 690n });
  });
  it('ví ≤ mốc thì không đụng tới — nén không được là một cái thuế', () => {
    expect(nenVi(1_000n)).toEqual({ sau: 1_000n, veKhoBac: 0n });
    expect(nenVi(500n)).toEqual({ sau: 500n, veKhoBac: 0n });
    expect(nenVi(0n)).toEqual({ sau: 0n, veKhoBac: 0n });
  });
  it('nén BẢO TOÀN tiền: sau + veKhoBac == trước (A3.4 — không mint, không đốt)', () => {
    for (const v of [1_001n, 1_500n, 3_333n, 12_345n, 999_999n]) {
      const r = nenVi(v);
      expect(r.sau + r.veKhoBac).toBe(v);
      expect(r.sau).toBeGreaterThanOrEqual(BigInt(MUA.NEN_MOC));
    }
  });
  it('nén giữ ĐÚNG THỨ TỰ giàu nghèo (lý do D16 chọn isqrt)', () => {
    const vis = [1_100n, 2_000n, 5_000n, 10_000n, 50_000n];
    const sau = vis.map((v) => nenVi(v).sau);
    for (let i = 1; i < sau.length; i += 1) {
      expect(sau[i]!).toBeGreaterThanOrEqual(sau[i - 1]!);
    }
  });
});

describe('Reset mùa bước 2 & 3 — SÀN và TIER BONUS', () => {
  it('sàn 700, chi từ Kho bạc đúng phần thiếu', () => {
    expect(sanHoaVi(0n)).toEqual({ sau: 700n, khoBacChi: 700n });
    expect(sanHoaVi(650n)).toEqual({ sau: 700n, khoBacChi: 50n });
    expect(sanHoaVi(700n)).toEqual({ sau: 700n, khoBacChi: 0n });
    expect(sanHoaVi(5_000n)).toEqual({ sau: 5_000n, khoBacChi: 0n });
  });
  it('bonus 80/50/25, hạng khác = 0 (D16 chốt phương án A 17/07)', () => {
    expect(tierBonus('vang')).toBe(80n);
    expect(tierBonus('bac')).toBe(50n);
    expect(tierBonus('dong')).toBe(25n);
    expect(tierBonus('khac')).toBe(0n);
  });
});

describe('Chu kỳ Kho bạc một mùa — đẳng thức D16 §5', () => {
  /** Bốn con số D16 công bố cho 1.000 user × 90 ngày. */
  const D16 = { rake: 37_457n, nen: 52_156n, troCap: 14_250n, sanHoa: 25_716n, bonus: 38_000n };

  it('D16 nguyên bản: 20.000 +37.457 +52.156 −14.250 −25.716 −38.000 = 31.647', () => {
    const r = chuKyKhoBac({ dauMua: BigInt(ECONOMY.TREASURY_GENESIS), ...D16 });
    expect(r.cuoiMua).toBe(31_647n);
    expect(r.amKhongChayNoi).toBe(false);
    expect(r.tongVao).toBe(89_613n);
    expect(r.tongRa).toBe(77_966n);
  });

  it('genesis trong config PHẢI là 20.000 — D16 tính trên đúng số này', () => {
    expect(ECONOMY.TREASURY_GENESIS).toBe(20_000);
  });

  it('SAU D86 (rake = 0, nén giữ nguyên) ⇒ −5.810 ⇒ reset mùa KHÔNG CHẠY NỔI', () => {
    const r = chuKyKhoBac({
      dauMua: BigInt(ECONOMY.TREASURY_GENESIS), ...D16, rake: 0n,
    });
    expect(r.cuoiMua).toBe(-5_810n);
    expect(r.amKhongChayNoi).toBe(true);
    // Đúng bằng chính con số rake đã mất: 31.647 − 37.457.
    expect(31_647n - D16.rake).toBe(r.cuoiMua);
  });

  it('SAU D86, đọc đủ hai vế (nén cũng → 0 vì không ai giàu lên) ⇒ −57.966', () => {
    const r = chuKyKhoBac({
      dauMua: BigInt(ECONOMY.TREASURY_GENESIS), ...D16, rake: 0n, nen: 0n,
    });
    expect(r.cuoiMua).toBe(-57_966n);
    expect(r.amKhongChayNoi).toBe(true);
  });

  it('phí chợ vật phẩm thay được vai rake: cần ≈ 37.457 T để hoà D16', () => {
    const r = chuKyKhoBac({
      dauMua: BigInt(ECONOMY.TREASURY_GENESIS), ...D16, rake: 0n, phiCho: 37_457n,
    });
    expect(r.cuoiMua).toBe(31_647n);
  });

  it('từ chối số âm — sổ không có khái niệm dòng tiền âm', () => {
    expect(() => chuKyKhoBac({
      dauMua: 0n, rake: -1n, nen: 0n, troCap: 0n, sanHoa: 0n, bonus: 0n,
    })).toThrow();
  });
});

describe('Runway & quét trợ cấp — câu hỏi thật sau D86', () => {
  it('20.000 T ÷ 50 T/ngày = 400 user-ngày (con số D245 nêu)', () => {
    expect(runwayNgay(20_000n, BigInt(ECONOMY.SUBSIDY_AMOUNT))).toBe(400);
  });
  it('không chi gì ⇒ null, KHÔNG phải một số to (A11.2 — thiếu mẫu là null)', () => {
    expect(runwayNgay(20_000n, 0n)).toBeNull();
  });
  it('quét: 100 người/ngày, mục tiêu 90 ngày — mức nào sống nổi', () => {
    const q = quetTroCap(20_000n, 100, 90);
    const m50 = q.find((x) => x.mucMoiNgay === 50)!;
    expect(m50.chiMoiNgay).toBe(5_000n);
    expect(m50.runway).toBe(4);          // 20.000 / 5.000
    expect(m50.du).toBe(false);
    // Không mức nào trong dải mặc định gánh nổi 100 người × 90 ngày.
    expect(q.every((x) => !x.du)).toBe(true);
  });
  it('quét: 1 người/ngày thì mức 50 sống 400 ngày ⇒ đủ cho một mùa', () => {
    const q = quetTroCap(20_000n, 1, 90);
    expect(q.find((x) => x.mucMoiNgay === 50)!.runway).toBe(400);
    expect(q.find((x) => x.mucMoiNgay === 50)!.du).toBe(true);
  });
});

describe('HỒI QUY — ba lỗi tự rà ra ngày 05/09, mỗi lỗi một bài canh', () => {
  it('LỖI 1: chia trước làm tròn xuống ⇒ chi ÍT bị đọc thành "không chi gì"', () => {
    // Chi 6 T trong 7 ngày. Đường cũ: 6/7 = 0 T/ngày ⇒ runway null ("không chi").
    expect(runwayNgay(20_000n, 6n / 7n)).toBeNull();          // hành vi SAI của bản đầu
    // Đường đúng: nhân trước, chia sau — cùng nếp A5.1.
    expect(runwayTuCuaSo(20_000n, 6n, 7)).toBe(23_333);       // 20.000 × 7 / 6
    // Và vẫn null khi THẬT SỰ không chi gì.
    expect(runwayTuCuaSo(20_000n, 0n, 7)).toBeNull();
  });

  it('LỖI 2: `soTuanMedianDuoiSan` phải NULL-được, không lặng lẽ bằng 0', () => {
    const s = { ...soDoRong(tranQMua()), medianVi: 100n, soTuanMedianDuoiSan: null };
    // Chưa đo được chuỗi tuần ⇒ tuyệt đối không kêu, dù median rất thấp.
    expect(danhGiaGuardrail(s).map((x) => x.ma)).not.toContain('median_thap');
    // Đo được rồi thì kêu.
    expect(danhGiaGuardrail({ ...s, soTuanMedianDuoiSan: 3 }).map((x) => x.ma))
      .toContain('median_thap');
  });

  it('LỖI 3: quét phải nhận được MỌI mức, kể cả mức không nằm trong dải mặc định', () => {
    // Bản đầu tìm `SUBSIDY_AMOUNT` trong dải cứng rồi `!` ⇒ nổ khi founder đổi số.
    const q = quetTroCap(20_000n, 1, 90, [7]);
    expect(q).toHaveLength(1);
    expect(q[0]!.mucMoiNgay).toBe(7);
    expect(q[0]!.runway).toBe(2_857);
  });
});

describe('Guardrail — hai dòng chết đã sửa', () => {
  it('trần phát Q cả mùa đúng 1.200 ⇒ ngưỡng "tồn > 2.500" của D16 KHÔNG BAO GIỜ nổ', () => {
    expect(tranQMua()).toBe(1_200);
    expect(tranQMua()).toBeLessThan(2_500);
  });

  it('dòng chết #1 đã sửa: ngưỡng tồn là TỶ LỆ của trần phát, không phải 2.500', () => {
    const s = { ...soDoRong(tranQMua()), qTonBinhQuan: 800 };
    // 60% × 1.200 = 720 ⇒ 800 phải kêu.
    expect(danhGiaGuardrail(s).map((d) => d.ma)).toContain('q_ton_dong');
    expect(danhGiaGuardrail({ ...s, qTonBinhQuan: 700 })).toEqual([]);
  });

  it('dòng chết #2 đã sửa: có SÀN 0,55 — đúng bệnh đang mắc (sink/phát ~0,50)', () => {
    const s = { ...soDoRong(tranQMua()), qSinkPhatBp: 5_000 };
    const d = danhGiaGuardrail(s);
    expect(d.map((x) => x.ma)).toContain('q_thieu_mon');
    expect(d.find((x) => x.ma === 'q_thieu_mon')!.muc).toBe('do');
    // Trong dải lành mạnh thì im.
    expect(danhGiaGuardrail({ ...s, qSinkPhatBp: 8_200 })).toEqual([]);
    // Trần cũ của D16 vẫn còn hiệu lực.
    expect(danhGiaGuardrail({ ...s, qSinkPhatBp: 9_500 }).map((x) => x.ma)).toContain('q_ngop');
  });

  it('⚠ null KHÔNG BAO GIỜ được đọc thành 0 — số rỗng thì im lặng tuyệt đối', () => {
    expect(danhGiaGuardrail(soDoRong(tranQMua()))).toEqual([]);
  });

  it('runway ngắn và Kho bạc mỏng đều là báo động ĐỎ', () => {
    const s = {
      ...soDoRong(tranQMua()),
      khoBacSoDu: 1_000n, troCapTuanDuKien: 3_500n, khoBacRunwayNgay: 20,
    };
    const ma = danhGiaGuardrail(s).map((x) => x.ma);
    expect(ma).toContain('kho_bac_mong');
    expect(ma).toContain('runway_ngan');
    expect(danhGiaGuardrail(s).every((x) => x.muc === 'do')).toBe(true);
  });

  it('median thấp chỉ kêu khi ĐỦ SỐ TUẦN liên tiếp (D16 chống báo động lẻ)', () => {
    const nen = { ...soDoRong(tranQMua()), medianVi: 400n };
    expect(danhGiaGuardrail({ ...nen, soTuanMedianDuoiSan: 1 })).toEqual([]);
    expect(danhGiaGuardrail({ ...nen, soTuanMedianDuoiSan: 2 }).map((x) => x.ma))
      .toContain('median_thap');
    expect(GUARDRAIL.MEDIAN_SO_TUAN).toBe(2);
  });

  it('thuần: cùng đầu vào ⇒ cùng kết quả, cùng thứ tự', () => {
    const s = {
      ...soDoRong(tranQMua()), medianVi: 4_000n, giniBp: 5_000, qSinkPhatBp: 5_000,
    };
    expect(danhGiaGuardrail(s)).toEqual(danhGiaGuardrail(s));
  });
});

describe('Kho bạc làm NGÂN HÀNG TRUNG ƯƠNG — bảng cân đối, không máy in (05/09)', () => {
  const soNguoi = 1_000;
  const soChang = 30;

  it('battle pass ở THANG CŨ của Q (60/chặng) = 1,8 triệu T một mùa', () => {
    expect(chiPhiBattlePass(60, soChang, soNguoi)).toBe(1_800_000n);
  });

  it('vòng quay chợ phải đạt = dòng ra ÷ phí, LÀM TRÒN LÊN (đây là mức tối thiểu)', () => {
    // 2% ⇒ cần gấp 50 lần dòng ra.
    expect(vongQuayChoCanCo(1_800_000n, ECONOMY.RAKE_TREASURY_BP)).toBe(90_000_000n);
    // Làm tròn LÊN: 1 T chi ra ở phí 2% cần 50 T vòng quay, không phải 49.
    expect(vongQuayChoCanCo(1n, ECONOMY.RAKE_TREASURY_BP)).toBe(50n);
    expect(vongQuayChoCanCo(3n, 3_000)).toBe(10n);   // 3×10.000/3.000 = 10 chẵn
    expect(vongQuayChoCanCo(1n, 3_000)).toBe(4n);    // 3,33… ⇒ 4
  });

  it('phí = 0 ⇒ null (VÔ NGHIỆM), không phải 0 — không vòng quay nào đủ', () => {
    expect(vongQuayChoCanCo(1_000n, 0)).toBeNull();
  });

  it('⚠ giữ thang cũ đòi vòng quay gấp 48 LẦN mức D16 từng cần', () => {
    const canCu = vongQuayChoCanCo(chiPhiBattlePass(60, soChang, soNguoi),
      ECONOMY.RAKE_TREASURY_BP)!;
    const vongD16 = 37_457n * 50n;   // toàn bộ rake D16 quy ngược ra vòng quay
    expect(canCu / vongD16).toBe(48n);
  });

  it('⚠ NGAY CẢ 5 T/chặng, mùa vẫn ÂM khi phí chợ chỉ bằng mức rake cũ', () => {
    const kq = chuKyMuaMoi({
      dauMua: BigInt(ECONOMY.TREASURY_GENESIS),
      phiCho: 37_457n, nen: 52_156n,
      troCap: 14_250n, sanHoa: 25_716n, bonus: 38_000n,
      battlePass: chiPhiBattlePass(5, soChang, soNguoi),
    });
    expect(kq.cuoiMua).toBe(-118_353n);
    expect(kq.amKhongChayNoi).toBe(true);
  });

  it('chuKyMuaMoi KHÔNG có vế rake — D86 đóng băng, và cấu trúc mới không dựa vào nó', () => {
    const a = chuKyMuaMoi({
      dauMua: 100_000n, phiCho: 10_000n, nen: 0n,
      troCap: 0n, sanHoa: 0n, bonus: 0n, battlePass: 0n,
    });
    expect(a.cuoiMua).toBe(110_000n);
    expect(a.tongVao).toBe(10_000n);
  });

  it('battle pass gộp vào vế RA cùng bonus — một đồng chi là một đồng chi', () => {
    const chung = chuKyMuaMoi({
      dauMua: 100_000n, phiCho: 0n, nen: 0n,
      troCap: 0n, sanHoa: 0n, bonus: 1_000n, battlePass: 2_000n,
    });
    expect(chung.tongRa).toBe(3_000n);
    expect(chung.cuoiMua).toBe(97_000n);
  });

  it('từ chối đầu vào vô nghĩa', () => {
    expect(() => chiPhiBattlePass(-1, 30, 1_000)).toThrow();
    expect(() => vongQuayChoCanCo(-1n, 200)).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// VẬT PHẨM ĐỘC QUYỀN MÙA (D257) — "battle pass cho T và vật phẩm độc quyền
// mỗi mùa". Ba nghìn bản epic ở 600 T là bối cảnh chép từ `economy_sim`.
// ══════════════════════════════════════════════════════════════════════════

const SO_BAN = 3_000;          // 3 mẫu độc bản × 1.000 người
const GIA = 600n;              // giaSan('epic', kho rỗng, quỹ đầy)
const PHI_KB = ECONOMY.RAKE_TREASURY_BP;   // 200 bp

describe('Vòng quay vật phẩm độc quyền — tài sản, không phải tiền', () => {
  it('vector chép tay: 3.000 bản × 2 lần × 600 T = 3.600.000 T', () => {
    expect(vongQuayDocQuyen({ soBan: SO_BAN, giaMoiLan: GIA, soLanDoiTayMoiBan: 2 }))
      .toBe(3_600_000n);
  });

  it('phí thu LÀM TRÒN XUỐNG, mức phải đạt LÀM TRÒN LÊN — ngược chiều, có chủ ý', () => {
    // 99 T × 2% = 1,98 ⇒ thu về 1 (không được làm đẹp thành 2).
    expect(phiThuVe(99n, PHI_KB)).toBe(1n);
    // Ngược lại: cần 1 T thì vòng quay tối thiểu là 50 T, không phải 49.
    expect(vongQuayChoCanCo(1n, PHI_KB)).toBe(50n);
  });

  it('mỗi bản phải đổi tay mấy lần — vector chép tay ở bốn mức', () => {
    const lan = (muc: number) =>
      soLanDoiTayCanCo(chiPhiBattlePass(muc, 30, 1_000), SO_BAN, GIA, PHI_KB);
    expect(lan(60)).toBe(50);   // 1.800.000 ÷ 36.000 = 50 chẵn
    expect(lan(20)).toBe(17);   //   600.000 ÷ 36.000 = 16,67 → LÊN 17
    expect(lan(2)).toBe(2);     //    60.000 ÷ 36.000 = 1,67  → LÊN 2
    expect(lan(1)).toBe(1);     //    30.000 ÷ 36.000 = 0,83  → LÊN 1
  });

  it('⭐ số lần đó là TỐI THIỂU CHẶT: đủ ở n, KHÔNG đủ ở n−1 (∀ mức)', () => {
    for (let muc = 1; muc <= 60; muc += 1) {
      const chi = chiPhiBattlePass(muc, 30, 1_000);
      const n = soLanDoiTayCanCo(chi, SO_BAN, GIA, PHI_KB)!;
      const thuO = (k: number) => phiThuVe(
        vongQuayDocQuyen({ soBan: SO_BAN, giaMoiLan: GIA, soLanDoiTayMoiBan: k }), PHI_KB,
      );
      expect(thuO(n), `mức ${muc}: n=${n} phải ĐỦ`).toBeGreaterThanOrEqual(chi);
      expect(thuO(n - 1), `mức ${muc}: n−1=${n - 1} phải THIẾU`).toBeLessThan(chi);
    }
  });

  it('vô nghiệm trả `null`, KHÔNG phải 0 (A11.2) — ba cửa vô nghiệm', () => {
    expect(soLanDoiTayCanCo(1n, SO_BAN, GIA, 0)).toBeNull();        // không có phí
    expect(soLanDoiTayCanCo(1n, 0, GIA, PHI_KB)).toBeNull();        // không có bản nào
    expect(soLanDoiTayCanCo(1n, SO_BAN, 0n, PHI_KB)).toBeNull();    // giá bằng 0
    // Còn "không chi gì" thì 0 lần là câu trả lời THẬT, không phải vô nghiệm.
    expect(soLanDoiTayCanCo(0n, 0, 0n, 0)).toBe(0);
  });

  it('từ chối đầu vào vô nghĩa thay vì trả số trông có lý', () => {
    expect(() => vongQuayDocQuyen({ soBan: -1, giaMoiLan: GIA, soLanDoiTayMoiBan: 1 })).toThrow();
    expect(() => vongQuayDocQuyen({ soBan: 1, giaMoiLan: -1n, soLanDoiTayMoiBan: 1 })).toThrow();
    expect(() => vongQuayDocQuyen({ soBan: 1, giaMoiLan: GIA, soLanDoiTayMoiBan: 1.5 })).toThrow();
    expect(() => phiThuVe(-1n, PHI_KB)).toThrow();
    expect(() => nghiaVuMuaLai(-1, GIA)).toThrow();
    expect(() => canDoiMuaDocQuyen(-1n, { soBan: 1, giaMoiLan: GIA, soLanDoiTayMoiBan: 1 }, PHI_KB))
      .toThrow();
  });
});

describe('E24 — quyền đòi tạo ra bởi phát MIỄN PHÍ vượt cả cung tiền', () => {
  it('cung tiền là phép SUY RA từ A4, không phải số mới: 1.000 người ⇒ 1.020.000 T', () => {
    expect(tongCungDuKien(1_000)).toBe(1_020_000n);
    expect(tongCungDuKien(0)).toBe(BigInt(ECONOMY.TREASURY_GENESIS));
  });

  it('⚠⚠ 3.000 bản × 600 T = 1.800.000 T quyền đòi trên 1.020.000 T tồn tại — 176%', () => {
    const quyenDoi = nghiaVuMuaLai(SO_BAN, GIA);
    expect(quyenDoi).toBe(1_800_000n);
    const bp = tyLeQuyenDoiTrenCung(quyenDoi, tongCungDuKien(1_000))!;
    expect(bp).toBe(17_647);
    // > 10.000 bp = quyền đòi LỚN HƠN toàn bộ số T tồn tại. A3.4 cấm mint thêm,
    // nên đây không phải "quỹ mỏng" — là không trả nổi về mặt số học.
    expect(bp).toBeGreaterThan(10_000);
  });

  it('⭐ quyền đòi đó một mình ĐÃ BẰNG cả battle pass ở thang Q cũ', () => {
    // Không phải "một khoản nữa bên cạnh" — nó là một khoản thứ hai CÙNG CỠ.
    expect(nghiaVuMuaLai(SO_BAN, GIA)).toBe(chiPhiBattlePass(60, 30, 1_000));
  });

  it('⚠ sổ vẫn CÂN suốt quá trình đó — `audit:supply` không đếm lời hứa', () => {
    // Đây là lý do E24 phải là một bất biến RIÊNG: bất biến tiền (E1) mù với nó.
    // Quyền đòi không phải một dòng nào trong sổ cho tới lúc có người bấm bán.
    const quyenDoi = nghiaVuMuaLai(SO_BAN, GIA);
    const cung = tongCungDuKien(1_000);
    expect(quyenDoi).toBeGreaterThan(cung);
    // Không có phép cộng nào trong `chuKyKhoBac` nhìn thấy `quyenDoi`.
    const kq = chuKyKhoBac({
      dauMua: cung, rake: 0n, nen: 0n, troCap: 0n, sanHoa: 0n, bonus: 0n,
    });
    expect(kq.amKhongChayNoi).toBe(false);
  });

  it('cờ là BẤT BIẾN, không phải tham số', () => {
    expect(HE_THONG_MUA_LAI_DOC_BAN).toBe(false);
  });

  it('tỷ lệ vô nghiệm khi không có cung — `null`, không phải 0 (A11.2)', () => {
    expect(tyLeQuyenDoiTrenCung(1n, 0n)).toBeNull();
    expect(() => tyLeQuyenDoiTrenCung(-1n, 1n)).toThrow();
    expect(() => tongCungDuKien(-1)).toThrow();
  });
});

describe('Cân đối mùa — battle pass có tự nuôi được bằng chợ nó tạo ra không', () => {
  const dq = { soBan: SO_BAN, giaMoiLan: GIA, soLanDoiTayMoiBan: 2 };

  it('ở nhịp 2 lần/bản/mùa: 2 T/chặng tự nuôi được, 5 T/chặng thì không', () => {
    const o = (muc: number) => canDoiMuaDocQuyen(chiPhiBattlePass(muc, 30, 1_000), dq, PHI_KB);
    expect(o(2).phiThu).toBe(72_000n);
    expect(o(2).tuNuoiDuoc).toBe(true);
    expect(o(2).chenhLech).toBe(12_000n);
    expect(o(5).tuNuoiDuoc).toBe(false);
    expect(o(5).chenhLech).toBe(-78_000n);
  });

  it('không chi gì thì hoà (0 ≥ 0) — biên, không phải ca lỗi', () => {
    const kq = canDoiMuaDocQuyen(0n, dq, PHI_KB);
    expect(kq.tuNuoiDuoc).toBe(true);
    expect(kq.soLanCanCo).toBe(0);
  });
});

describe('config/battle_pass — số chưa chốt phải KÊU, không được im', () => {
  it('✔ `T_MOI_CHANG` founder chốt 2 (05/09) ⇒ cổng mở, trả đúng 2', () => {
    expect(BATTLE_PASS.T_MOI_CHANG).toBe(2);
    expect(tMoiChangDaChot()).toBe(2);
  });

  it('⭐ nhánh FAIL-CLOSED vẫn còn trong mã nguồn — đừng dọn nó như code chết', () => {
    // Số đã chốt ⇒ nhánh ném lỗi giờ KHÔNG chạy tới được, và đó đúng là lúc
    // nó dễ bị xoá nhất ("nhánh này có bao giờ chạy đâu"). Nó phải sống, vì
    // mùa sau reset số này về `null` là chuyện bình thường — và lúc đó im lặng
    // phát 0 T là cái giá của việc đã xoá.
    const src = readFileSync(join(process.cwd(), 'config/battle_pass.ts'), 'utf8');
    expect(src).toMatch(/if \(v === null\)/);
    expect(src).toMatch(/chưa chốt/);
    expect(src).toMatch(/throw new Error/);
  });

  it('SO_CHANG lấy từ lịch mùa, không phải bản sao thứ hai (D61)', () => {
    expect(BATTLE_PASS.SO_CHANG).toBe(MUA_0_0.SO_CHANG);
  });

  it('SO_MAU_DOC_BAN là phép ĐẾM bảng chặng, không phải số mới', () => {
    const dem = CHANG_LO_TRINH.filter((c) => c.doc_ban === true).length;
    expect(BATTLE_PASS.SO_MAU_DOC_BAN).toBe(dem);
  });
});
