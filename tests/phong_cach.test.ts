/**
 * PHONG CÁCH CHƠI E→SSS — test vector CHÉP TAY (nếp A5.2).
 *
 * ⚠ File này canh ba thứ, và cả ba đều là chỗ thanh có thể ÂM THẦM làm bẩn dữ
 * liệu hành vi (§1.2) nếu ai đó "tinh chỉnh" sau này:
 *   §I   số học từng trục — đổi công thức mà quên đổi vector là đỏ ngay;
 *   §II  ⭐ TRUNG LẬP KHẨU VỊ: thanh KHÔNG được thưởng riêng mức phơi nhiễm,
 *        đa dạng hoá, hay tiền mặt — ba trục app đang ĐO;
 *   §III "không làm gì" được chấm như một DỰ BÁO, không phải một cửa miễn phí.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PC, THANG, THANG_BAN_TAP, baTruc, chamPhongCach, chuToiDaTheoThuHang, diemVong, hangCua,
  duVongDeCoHang, khoaTheoThuHang, quyVeThangChuan, type VongPhongCach,
} from '../server/holdem/phong_cach.js';

const V = (o: Partial<VongPhongCach> = {}): VongPhongCach => ({
  brier: null, nav_bp: 0, cho_bp: 0, tu_dong: false, ...o,
});

describe('I. Số học từng trục — vector tay', () => {
  it('ĐỌC: Brier 0 ⇒ trục 1; Brier 2 ⇒ trục 0; Brier 1 ⇒ trục 0,5', () => {
    // Vòng chợ đi ngang (cho_bp 0) và NAV bằng chợ ⇒ thắng-chợ = 0,5; trụ = 0,6.
    // điểm = 0,45·đọc + 0,35·0,5 + 0,20·0,6 = 0,45·đọc + 0,295
    expect(diemVong(V({ brier: 0 }))).toBeCloseTo(0.45 + 0.295, 5);
    expect(diemVong(V({ brier: 2 }))).toBeCloseTo(0.295, 5);
    expect(diemVong(V({ brier: 1 }))).toBeCloseTo(0.45 * 0.5 + 0.295, 5);
  });

  it('THẮNG CHỢ bão hoà: hơn chợ đúng bằng thang ⇒ 0,75, không bao giờ chạm 1', () => {
    // d = HON_CHO_THANG_BP ⇒ 0,5 + 0,5·(800/1600) = 0,75
    const v = V({ brier: 1, nav_bp: PC.HON_CHO_THANG_BP, cho_bp: 0 });
    // 0,45·0,5 + 0,35·0,75 + 0,20·0,6 = 0,225 + 0,2625 + 0,12
    expect(diemVong(v)).toBeCloseTo(0.6075, 5);
    // Hơn chợ GẤP 100 LẦN cũng không chiếm trọn thanh — chặn "một cú may ăn cả".
    const khung = V({ brier: 1, nav_bp: 80_000, cho_bp: 0 });
    expect(diemVong(khung)).toBeLessThan(0.45 * 0.5 + 0.35 + 0.20 * 0.6);
  });

  it('TRỤ chỉ có nghĩa ở vòng chợ SẬP', () => {
    // ⚠ nav_bp phải BẰNG cho_bp thì vế thắng-chợ mới đúng 0,5 — bản đầu của tôi
    // để nav_bp = 0 với cho_bp = −100, tức đã hơn chợ 100bp, và vector tay sai theo.
    const thuong = V({ brier: 1, nav_bp: -100, cho_bp: -100 });   // chợ chưa sập
    expect(diemVong(thuong)).toBeCloseTo(0.45 * 0.5 + 0.35 * 0.5 + 0.20 * 0.6, 5);
    // Chợ sập −1000 mà NAV mình không đổi ⇒ trụ = 1 (không gãy theo).
    const tru = baTruc([V({ brier: 1, nav_bp: 0, cho_bp: -1000 })]);
    expect(tru.tru).toBe(1);
    // Sập theo đúng đáy ⇒ trụ = 0.
    const gay = baTruc([V({ brier: 1, nav_bp: -PC.TRU_DAY_BP, cho_bp: -1000 })]);
    expect(gay.tru).toBe(0);
  });

  it('thang hạng: đơn điệu, phủ kín, SS và SSS KHÔNG có nấc ±', () => {
    for (let i = 1; i < THANG.length; i += 1) {
      expect(THANG[i]!.tu).toBeGreaterThan(THANG[i - 1]!.tu);
    }
    expect(hangCua(0)).toBe('E-');
    expect(hangCua(1000)).toBe('SSS');
    expect(hangCua(THANG.find((x) => x.hang === 'SS')!.tu)).toBe('SS');
    // Founder: "+/-E +-D +-C +-B +-A +-S, SS và SSS" — hai bậc cuối là MỘT thứ.
    const co = THANG.map((x) => x.hang);
    expect(co).not.toContain('SS+' as never);
    expect(co).not.toContain('SSS+' as never);
    expect(co.filter((h) => h.startsWith('S') && !h.startsWith('SS')))
      .toEqual(['S-', 'S', 'S+']);
  });
});

describe('II. ⭐⭐ TRUNG LẬP KHẨU VỊ — thanh không được lái §1.2', () => {
  /*
   * Ba bài dưới là lằn ranh của cả cơ chế. Nếu một "tinh chỉnh" sau này làm bất
   * kỳ bài nào đỏ, thanh đã bắt đầu dạy người chơi phải phơi nhiễm bao nhiêu —
   * và lúc đó chính cột dữ liệu đắt nhất của app bị làm bẩn.
   */
  it('cùng kết quả so với chợ ⇒ cùng điểm, BẤT KỂ ôm 1 mã hay dàn 6 mã', () => {
    // Thanh chỉ nhìn (brier, nav_bp, cho_bp) — không có đầu vào nào là "số mã
    // đang giữ" hay "tỷ lệ tiền mặt". Hai danh mục khác hẳn nhau mà cùng ba số
    // này thì phải cùng điểm.
    const a = V({ brier: 0.4, nav_bp: 500, cho_bp: 100 });
    const b = V({ brier: 0.4, nav_bp: 500, cho_bp: 100 });
    expect(diemVong(a)).toBe(diemVong(b));
  });

  it('ĐU THEO CHỢ không được điểm: chợ lên 1000, mình lên 1000 ⇒ vẫn 0,5 ở trục chợ', () => {
    const theo = baTruc([V({ brier: 1, nav_bp: 1000, cho_bp: 1000 })]);
    expect(theo.thang_cho).toBeCloseTo(0.5, 6);
    // và lãi to hơn chợ mới nhích lên.
    const hon = baTruc([V({ brier: 1, nav_bp: 1800, cho_bp: 1000 })]);
    expect(hon.thang_cho).toBeGreaterThan(0.5);
  });

  it('⭐ NGỒI IM CẢ TRẬN không được hạng cao — "không làm gì" phải bị chấm, không được miễn', () => {
    // 8 vòng toàn tiền mặt, chợ ĐI LÊN đều ⇒ đứng ngoài là đọc SAI mọi vòng.
    const im = Array.from({ length: 8 }, () => V({ brier: null, nav_bp: 0, cho_bp: 600 }));
    const q = chamPhongCach(im);
    expect(q.hang.startsWith('S')).toBe(false);
    expect(q.diem).toBeLessThan(THANG.find((x) => x.hang === 'B-')!.tu);
  });
});

describe('III. ⭐ "Không làm gì" được chấm như MỘT DỰ BÁO', () => {
  it('đứng ngoài lúc chợ SẬP ⇒ đọc ĐÚNG; lúc chợ LÊN ⇒ đọc SAI; đi ngang ⇒ trung tính', () => {
    const sap = diemVong(V({ brier: null, nav_bp: 0, cho_bp: -800 }));
    const len = diemVong(V({ brier: null, nav_bp: 0, cho_bp: 800 }));
    const ngang = diemVong(V({ brier: null, nav_bp: 0, cho_bp: 0 }));
    expect(sap).toBeGreaterThan(ngang);
    expect(ngang).toBeGreaterThan(len);
    /*
     * Trục ĐỌC vẫn nặng ĐÚNG BẰNG W_DOC, KHÔNG bị bỏ đi rồi chia lại trọng số —
     * đó là bản đầu, và nó biến "ngồi im cả trận" thành hạng B (đo được 599 điểm).
     * ⚠ Khoảng cách sập↔lên KHÔNG bằng W_DOC: nó gồm cả ba trục (đọc 0,45 +
     * chợ 0,35·(0,75−0,25) + trụ 0,20·(1−0,6) = 0,705). Vector tay đầu của tôi
     * quên hai trục kia. Khoá bằng đúng con số đã tính lại.
     */
    expect(sap - len).toBeCloseTo(0.705, 3);
    expect(sap - len).toBeGreaterThan(PC.W_DOC);
  });

  it('đứng ngoài đúng lúc bão vẫn thua người ĐỌC ĐÚNG mà có mặt', () => {
    const ngoai = diemVong(V({ brier: null, nav_bp: 0, cho_bp: -800 }));
    const coMat = diemVong(V({ brier: 0, nav_bp: 400, cho_bp: -800 }));
    expect(coMat).toBeGreaterThan(ngoai);
  });
});

describe('IV. Streak — áp lực giữ chuỗi', () => {
  it('chuỗi vòng tốt liên tiếp cộng thưởng, đứt là về 0', () => {
    const tot = V({ brier: 0, nav_bp: 900, cho_bp: 0 });
    const xau = V({ brier: 2, nav_bp: -900, cho_bp: 0 });
    expect(chamPhongCach([tot, tot, tot]).streak).toBe(3);
    expect(chamPhongCach([tot, tot, xau]).streak).toBe(0);
    expect(chamPhongCach([tot, tot, xau]).streak_dai_nhat).toBe(2);
  });

  it('⚠ vòng HẾT GIỜ tự nộp KHÔNG nuôi streak (D38: không kịp bấm ≠ quyết định)', () => {
    const tot = V({ brier: 0, nav_bp: 900, cho_bp: 0 });
    const totNhungHetGio = V({ brier: 0, nav_bp: 900, cho_bp: 0, tu_dong: true });
    expect(chamPhongCach([tot, totNhungHetGio, tot]).streak_dai_nhat).toBe(1);
  });

  it('thưởng streak có TRẦN — không ai giữ chuỗi mãi rồi khoá cứng SSS', () => {
    const tot = V({ brier: 0, nav_bp: 900, cho_bp: 0 });
    const dai = chamPhongCach(Array.from({ length: 30 }, () => tot));
    expect(dai.diem).toBeLessThanOrEqual(1000);
    expect(PC.STREAK_TRAN / PC.STREAK_BONUS).toBeLessThanOrEqual(10);
  });

  it('trận rỗng ⇒ E- và không nổ', () => {
    const q = chamPhongCach([]);
    expect(q.hang).toBe('E-');
    expect(q.diem).toBe(0);
  });
});

describe('V. Vòng gần đây nặng hơn — thanh phải SỐNG trong trận', () => {
  it('cùng bộ vòng, đảo thứ tự ⇒ điểm KHÁC (nếu bằng nhau là trọng số chết)', () => {
    const tot = V({ brier: 0, nav_bp: 900, cho_bp: 0 });
    const xau = V({ brier: 2, nav_bp: -900, cho_bp: 0 });
    const kem_truoc = chamPhongCach([xau, xau, tot, tot]);
    const tot_truoc = chamPhongCach([tot, tot, xau, xau]);
    expect(kem_truoc.diem).toBeGreaterThan(tot_truoc.diem);
  });
});

/**
 * VI. ⭐⭐ CANH CẢ LỚP — thanh không được MỌC THÊM một đầu vào phạm §1.2
 *
 * ⚠ VÌ SAO BÀI NÀY TỒN TẠI: tiêm lỗi ngược mũi hai (thêm trường `pct_phoi` rồi
 * cộng thẳng vào điểm) KHÔNG làm bài nào đỏ. §II chỉ so hai vòng có CÙNG đầu
 * vào, nên một đầu vào MỚI đi lọt im lặng — đúng lớp lỗ D93 ở 19 route `:id`.
 * Bài này đọc chính mã nguồn và khoá TẬP ĐẦU VÀO, nên thêm trục mới là phải
 * sửa test một cách có ý thức, không có cửa im lặng.
 */
describe('VI. canh cả lớp — tập đầu vào bị khoá', () => {
  const nguon = readFileSync('server/holdem/phong_cach.ts', 'utf8');

  it('VongPhongCach chỉ có ĐÚNG bốn trường được phép', () => {
    const than = /export interface VongPhongCach \{([\s\S]*?)\n\}/.exec(nguon)?.[1] ?? '';
    expect(than).not.toBe('');
    const truong = [...than.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
    expect(truong.sort()).toEqual(['brier', 'cho_bp', 'nav_bp', 'tu_dong']);
  });

  it('mã nguồn KHÔNG được nhắc tới ba trục §1.2 cấm thưởng', () => {
    // Bỏ khối chú thích trước khi quét: chính docstring NÓI VỀ ba trục này để
    // giải thích vì sao không dùng chúng — quét thô là báo động giả, mà một bài
    // test báo động giả thì sẽ bị tắt đi (D79).
    const code = nguon.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const cam of ['phoi_nhiem', 'pct_phoi', 'so_ma', 'tien_mat', 'vi_the', 'da_dang']) {
      expect(code).not.toContain(cam);
    }
  });
});

/**
 * VII. ⭐⭐ D337 — KHOÁ THEO THỨ HẠNG (trần theo vị trí + gộp PAV)
 *
 * Founder soi bàn tập 15/09: đứng thứ hạng 7/8 (NAV −15%) mà A+, trong khi ghế
 * NHẤT bàn chỉ A-. Nguyên văn: *"hạng cao thì thứ hạng phải cao mà hạng thấp
 * thì thứ hạng phải thấp"*, nhưng BÁC bảng dải cố định vì *"cả lobby chơi tệ
 * thì có khi B/C là cao nhất"*. Xem khối docstring dài ở `chuToiDaTheoThuHang`
 * trong `server/holdem/phong_cach.ts` cho toán đầy đủ.
 */
describe('VII. D337 — trần theo vị trí (chuToiDaTheoThuHang)', () => {
  it('bàn 8 ghế: SSS·S+·S-·A·A-·B·C+·C (đúng bảng founder đã thấy sai)', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((h) => chuToiDaTheoThuHang(8, h)))
      .toEqual([19, 17, 15, 13, 12, 10, 8, 7]);
  });

  it('bàn 5 ghế', () => {
    expect([1, 2, 3, 4, 5].map((h) => chuToiDaTheoThuHang(5, h)))
      .toEqual([19, 16, 13, 10, 7]);
  });

  it('bàn 4 ghế', () => {
    expect([1, 2, 3, 4].map((h) => chuToiDaTheoThuHang(4, h)))
      .toEqual([19, 15, 11, 7]);
  });

  it('N=1: không ai để so ⇒ không trần, chỉ số SSS', () => {
    expect(chuToiDaTheoThuHang(1, 1)).toBe(19);
  });
});

describe('VIII. D337 — khoá theo thứ hạng (khoaTheoThuHang) — vector tay', () => {
  it('⭐⭐ trận founder, bàn 8: gốc → sau trần → sau gộp → chữ', () => {
    // Thứ tự theo THỨ HẠNG (1 = nhất). Đây đúng là trận founder báo cáo lỗi.
    const goc = [690, 860, 730, 850, 780, 790, 802, 590];
    const dong = goc.map((diem, i) => ({ thu_hang: i + 1, diem }));
    const khoa = khoaTheoThuHang(dong, 8);
    expect(khoa, 'trần rồi PAV phải khớp đúng dãy đã tính tay').toEqual(
      [775, 775, 745, 745, 714, 619, 519, 464],
    );
    expect(khoa.map(hangCua), 'chữ hiện ra cho người chơi').toEqual(
      ['A+', 'A+', 'A', 'A', 'A-', 'B', 'C+', 'C'],
    );
    // Đúng điều founder đòi: hạng KHÔNG TĂNG theo thứ hạng, và NHẤT (775) cao
    // hơn ghế xếp hạng 7/8 cũ (vốn từng ra A+ dù đứng bét — nay bị khoá xuống C+/C).
    for (let i = 1; i < khoa.length; i += 1) expect(khoa[i]!).toBeLessThanOrEqual(khoa[i - 1]!);
  });

  it('bàn chơi TỆ: mọi gốc ≤ C+ và đã đúng thứ tự ⇒ người NHẤT giữ đúng chữ gốc, không bị nâng vô cớ (vẫn có thể là C)', () => {
    // Founder bác bảng dải cố định đúng vì lo ca này: "cả lobby chơi tệ thì có
    // khi B/C là cao nhất" — trần vị trí 1000/924/… KHÔNG được tự ý đẩy hạng
    // NHẤT lên cao hơn năng lực thật của chính họ.
    const canTrenCCong = THANG.find((x) => x.hang === 'B-')!.tu - 1; // 519 — đỉnh của C+
    const goc = [410, 400, 390, 380, 370, 360, 350, 300];
    expect(goc.every((d) => d <= canTrenCCong), 'vector này phải thật sự ≤ C+').toBe(true);
    const dong = goc.map((diem, i) => ({ thu_hang: i + 1, diem }));
    const khoa = khoaTheoThuHang(dong, 8);
    expect(khoa, 'đã không tăng + dưới trần ⇒ trần/PAV không đổi gì cả').toEqual(goc);
    expect(khoa[0]).toBe(410);
    expect(hangCua(khoa[0]!), 'người nhất một bàn chơi tệ vẫn có thể chỉ là C').toBe('C');
  });
});

describe('IX. ⭐⭐ D337 — TÍNH CHẤT (PRNG tất định, N=2..8, vài nghìn dãy ngẫu nhiên)', () => {
  it('không tăng · không vượt trần · người nhất ≥ gốc · bàn 8 hạng 7-8 không chạm S-', () => {
    /*
     * LCG tất định (Numerical Recipes) — KHÔNG `Math.random`: bài đỏ thì phải tái
     * lập được đúng dãy đã đỏ.
     */
    let s = 0x2716001 >>> 0;
    const rand = () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const diemToiDa = (soGhe: number, thuHang: number): number => {
      const chiSo = chuToiDaTheoThuHang(soGhe, thuHang);
      return chiSo >= THANG.length - 1 ? 1000 : THANG[chiSo + 1]!.tu - 1;
    };
    const NGUONG_S_TRU = THANG.find((x) => x.hang === 'S-')!.tu;
    let soLanN8 = 0;
    for (let vong = 0; vong < 4000; vong += 1) {
      const n = 2 + Math.floor(rand() * 7); // 2..8
      const goc = Array.from({ length: n }, () => Math.floor(rand() * 1001)); // 0..1000
      const dong = goc.map((diem, i) => ({ thu_hang: i + 1, diem }));
      const khoa = khoaTheoThuHang(dong, n);

      for (let i = 1; i < n; i += 1) {
        expect(khoa[i]!, `vòng ${vong} n=${n}: TĂNG tại vị trí ${i + 1}`)
          .toBeLessThanOrEqual(khoa[i - 1]!);
      }
      for (let i = 0; i < n; i += 1) {
        expect(khoa[i]!, `vòng ${vong} n=${n}: vị trí ${i + 1} vượt trần`)
          .toBeLessThanOrEqual(diemToiDa(n, i + 1));
      }
      expect(khoa[0]!, `vòng ${vong} n=${n}: người nhất bị hạ dưới điểm gốc`)
        .toBeGreaterThanOrEqual(goc[0]!);
      if (n === 8) {
        soLanN8 += 1;
        expect(khoa[6]!, `vòng ${vong}: hạng 7/8 ghế chạm S-`).toBeLessThan(NGUONG_S_TRU);
        expect(khoa[7]!, `vòng ${vong}: hạng 8/8 ghế chạm S-`).toBeLessThan(NGUONG_S_TRU);
      }
    }
    // Bài không được rỗng ở ca N=8 — nếu PRNG lệch phân phối thì ca này có thể
    // không bao giờ chạm, và khi đó phần (d) không canh gì cả.
    expect(soLanN8, 'phải thực sự lăn ra bàn 8 ghế nhiều lần').toBeGreaterThan(300);
  });
});

/**
 * X. ⭐⭐ D337 — THANG BÀN TẬP (chỉ bàn tập; trận thật giữ `THANG`).
 *
 * Founder: *"giúp user đạt SSS ở phần hướng dẫn để app flex hiệu ứng"* rồi *"chỉ
 * trong phần hướng dẫn thôi nhé"*. Server chấm bàn tập theo `THANG_BAN_TAP` rồi
 * QUY điểm về `THANG` trước khi gửi — client vẫn một thang. Ba thứ phải đúng:
 * quy giữ nguyên CHỮ, quy giữ nguyên THỨ TỰ, và sàn vòng bàn tập vẫn chặn S sớm.
 */
describe('X. D337 — thang bàn tập', () => {
  const chuBanTap = (d: number): string => {
    let ra = THANG_BAN_TAP[0]!.hang as string;
    for (const m of THANG_BAN_TAP) if (d >= m.tu) ra = m.hang;
    return ra;
  };

  it('cùng 20 chữ, cùng thứ tự với THANG; từ B trở xuống TRÙNG mốc', () => {
    expect(THANG_BAN_TAP.map((m) => m.hang)).toEqual(THANG.map((m) => m.hang));
    for (let i = 0; i <= 11; i += 1) expect(THANG_BAN_TAP[i]!.tu).toBe(THANG[i]!.tu);
    expect(THANG_BAN_TAP.find((m) => m.hang === 'SSS')!.tu, 'đỉnh bàn tập phải thấp hơn trận thật')
      .toBeLessThan(THANG.find((m) => m.hang === 'SSS')!.tu);
  });

  it('⭐ mọi mốc bàn tập quy ĐÚNG về mốc chuẩn cùng chữ; 1000 ↦ 1000', () => {
    THANG_BAN_TAP.forEach((m, i) => expect(quyVeThangChuan(m.tu), m.hang).toBe(THANG[i]!.tu));
    expect(quyVeThangChuan(1000)).toBe(1000);
  });

  it('⭐⭐ với MỌI điểm 0..1000: chữ giữ nguyên, thứ tự không đảo, dưới B+ là đồng nhất', () => {
    let truoc = -1;
    for (let d = 0; d <= 1000; d += 1) {
      const q = quyVeThangChuan(d);
      expect(hangCua(q), `điểm ${d}`).toBe(chuBanTap(d));
      expect(q, `điểm ${d} quy ngược thứ tự`).toBeGreaterThanOrEqual(truoc);
      truoc = q;
      if (d < 620) expect(q, `điểm ${d} dưới B+ phải giữ nguyên`).toBe(d);
    }
  });

  it('⭐ chưa đủ vòng thì CHƯA có hạng — cửa cứng thay cho giả-vòng (founder: "ko đủ dữ liệu chấm điểm")', () => {
    for (let n = 0; n < PC.SAN_VONG_TIN_CAY; n += 1) expect(duVongDeCoHang(n), `${n} vòng`).toBe(false);
    expect(duVongDeCoHang(PC.SAN_VONG_TIN_CAY)).toBe(true);
    // Cửa mở đúng ở vòng giả-vòng tan hết ⇒ hạng hiện ra không bị chiết khấu nào chạm
    // (`thang_hang_phai_leo_duoc` §II khoá phép "không chiết khấu từ vòng thứ 4").
    // Map ngắn nhất 8 vòng ⇒ trận nào đi hết map cũng có hạng ở màn kết.
    expect(PC.SAN_VONG_TIN_CAY).toBeLessThan(8);
  });
});
