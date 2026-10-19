/**
 * TÍNH CÁCH TÀI CHÍNH — test vector CHÉP TAY (nếp A5.2: phần đụng hành vi/
 * con số phải có bộ số tính tay trước, code chứng minh pass sau).
 *
 * ⚠ Mỗi chỉ số một bộ số tự cộng bằng tay trong comment — đổi công thức mà
 * quên đổi vector là đỏ ngay, không có "sửa cho chạy".
 */
import { describe, expect, it } from 'vitest';
import {
  NGUONG_TINH_CACH, dungHoSo, tinhChiSo, xepBacDoc, xepKhauVi, xepNet, xepTinhCach,
  type VongInsight,
} from '../server/holdem/insight.js';

/** Vòng mẫu — mặc định trơn, CÙNG MỘT TRẬN, override từng trường. */
const V = (o: Partial<VongInsight> = {}): VongInsight => ({
  match_id: 'tran-A',
  lenh: [], pnl_bp: null, brier: null, mo_bang: false,
  o_su_kien: false, la_tin_gia: false, chuoi_tang: false, tu_dong: false,
  ...o,
});
/** Vòng của một trận KHÁC — dùng để dựng đúng cú bắc qua ranh giới. */
const W = (o: Partial<VongInsight> = {}): VongInsight => V({ match_id: 'tran-B', ...o });
const MUA = (moc = 2500) => ({ chieu: 'mua' as const, moc_bp: moc });
const BAN = (moc = 10000) => ({ chieu: 'ban' as const, moc_bp: moc });

describe('I. Sáu chỉ số — số chép tay', () => {
  it('1 HIỆU CHỈNH: trung bình + xu hướng nửa sau − nửa đầu', () => {
    // Brier: 0,8 · 0,6 · 0,4 · 0,9 · 0,3 · 0,2  → TB = 3,2/6 = 0,5333…
    // nửa đầu (0,8+0,6+0,4)/3 = 0,6 · nửa sau (0,9+0,3+0,2)/3 = 0,4666…
    // xu hướng = 0,4666… − 0,6 = −0,1333… (đang khá lên)
    const cs = tinhChiSo([0.8, 0.6, 0.4, 0.9, 0.3, 0.2].map((b) => V({ brier: b })));
    expect(cs.hieu_chinh!.n).toBe(6);
    expect(cs.hieu_chinh!.brier_tb).toBeCloseTo(0.5333, 3);
    expect(cs.hieu_chinh!.xu_huong).toBeCloseTo(-0.1333, 3);
  });

  it('2 ĐUỔI GIÁ so với nền: mua 3/4 vòng chuỗi = 0,75; mua 1/4 vòng thường = 0,25 ⇒ lệch +0,5', () => {
    // Hiệu chuẩn null 22/08: bản cũ ("mấy phần cú mua rơi vào chuỗi") ra đúng tần
    // suất nền của ô chuỗi (~0,10 ở mọi bot) — đo bản đồ. Nay đo SO VỚI NỀN.
    const cs = tinhChiSo([
      V({ lenh: [MUA()], chuoi_tang: true }),
      V({ lenh: [MUA()], chuoi_tang: true }),
      V({ lenh: [MUA()], chuoi_tang: true }),
      V({ lenh: [BAN()], chuoi_tang: true }), // bán — vòng chuỗi KHÔNG mua
      V({ lenh: [MUA()] }),
      V({}), V({}), V({ lenh: [BAN()] }),
    ]);
    expect(cs.duoi_gia).toEqual({ ty_le: 0.75, nen: 0.25, lech: 0.5, n: 4 });
    // Mua đều MỌI vòng (bot tái cân bằng) ⇒ lệch 0 — đúng null.
    const deu = tinhChiSo([
      ...Array.from({ length: 4 }, () => V({ lenh: [MUA()], chuoi_tang: true })),
      ...Array.from({ length: 4 }, () => V({ lenh: [MUA()] })),
    ]);
    expect(deu.duoi_gia!.lech).toBe(0);
  });

  it('3 THEO TIN so với nền: vào 4/5 sự kiện = 0,8; vào 1/5 thường = 0,2 ⇒ lệch +0,6; tin giả 3/4 vs nền 3/5', () => {
    const sk = (vao: boolean, gia: boolean) =>
      V({ o_su_kien: true, la_tin_gia: gia, lenh: vao ? [MUA()] : [] });
    const cs = tinhChiSo([
      sk(true, true), sk(true, true), sk(true, true), sk(true, false), sk(false, false),
      V({ lenh: [MUA()] }), V({}), V({}), V({}), V({}),
    ]);
    expect(cs.theo_tin!.n).toBe(5);
    expect(cs.theo_tin!.ty_le).toBeCloseTo(0.8, 5);
    expect(cs.theo_tin!.nen).toBeCloseTo(0.2, 5);
    expect(cs.theo_tin!.lech).toBeCloseTo(0.6, 5);
    expect(cs.theo_tin!.phan_tin_gia).toBeCloseTo(0.75, 5);   // 3 giả / 4 cú vào
    expect(cs.theo_tin!.nen_tin_gia).toBeCloseTo(0.6, 5);     // 3 giả / 5 sự kiện
    expect(cs.theo_tin!.lech_tin_gia).toBeCloseTo(0.15, 5);
  });

  it('KV KHẨU VỊ: tiền mặt 7000/3000 bp, 1/3 mã, 2/8 vòng đứng ngoài', () => {
    const cs = tinhChiSo([
      ...Array.from({ length: 4 }, () => V({ tien_mat_bp: 7000, so_ma: 1 })),
      ...Array.from({ length: 2 }, () => V({ tien_mat_bp: 3000, so_ma: 3 })),
      ...Array.from({ length: 2 }, () => V({ tien_mat_bp: 10000, so_ma: 0 })),
    ]);
    // phơi nhiễm: (0,3×4 + 0,7×2 + 0×2)/8 = 2,6/8 = 0,325 · số mã (4+6+0)/8 = 1,25
    expect(cs.khau_vi).toEqual({ phoi_nhiem_tb: 0.325, so_ma_tb: 1.25, dung_ngoai: 0.25, n: 8 });
    // Thiếu số khẩu vị (caller cũ) ⇒ null, không bịa.
    expect(tinhChiSo(Array.from({ length: 8 }, () => V({ lenh: [MUA()] }))).khau_vi).toBeNull();
  });

  it('4 CHỐT NON: bán sau xanh 3/4 − bán sau đỏ 1/4 = +0,5', () => {
    // Cặp (kết quả vòng i, hành vi vòng i+1). Dựng xen kẽ để đủ 4 xanh 4 đỏ.
    const cap = (kq: number, banSau: boolean) =>
      [V({ pnl_bp: kq }), V({ lenh: banSau ? [BAN()] : [] })];
    const cs = tinhChiSo([
      ...cap(500, true), ...cap(400, true), ...cap(300, true), ...cap(200, false),
      ...cap(-500, true), ...cap(-400, false), ...cap(-300, false), ...cap(-200, false),
    ]);
    expect(cs.chot_non!.ban_sau_xanh).toBeCloseTo(0.75, 5);
    expect(cs.chot_non!.ban_sau_do).toBeCloseTo(0.25, 5);
    expect(cs.chot_non!.lech).toBeCloseTo(0.5, 5);
  });

  it('5 DỒN VỐN: nền 2500, sau thua trung bình 5000 ⇒ ×2', () => {
    // Vòng có mua: 2500 ×3 (nền trơn) + 5000 ×3 (đều đứng sau vòng thua)
    // → nền = (2500×3 + 5000×3)/6 = 3750; sau_thua = 5000/3750 = 1,333…
    const cs = tinhChiSo([
      V({ lenh: [MUA(2500)] }), V({ lenh: [MUA(2500)] }), V({ lenh: [MUA(2500)] }),
      V({ pnl_bp: -300 }), V({ lenh: [MUA(5000)] }),
      V({ pnl_bp: -300 }), V({ lenh: [MUA(5000)] }),
      V({ pnl_bp: -300 }), V({ lenh: [MUA(5000)] }),
    ]);
    expect(cs.don_von!.nen_bp).toBeCloseTo(3750, 5);
    expect(cs.don_von!.sau_thua_x).toBeCloseTo(5000 / 3750, 4);
    expect(cs.don_von!.sau_thang_x).toBeNull(); // chưa đủ 3 mẫu sau thắng
  });

  it('6 GIÁ THÔNG TIN: mở 3/6 vòng; Brier khi mở 0,3 < khi không 0,7', () => {
    const cs = tinhChiSo([
      V({ mo_bang: true, brier: 0.3 }), V({ mo_bang: true, brier: 0.3 }),
      V({ mo_bang: true, brier: 0.3 }),
      V({ brier: 0.7 }), V({ brier: 0.7 }), V({ brier: 0.7 }),
    ]);
    expect(cs.mua_tin!.ty_le).toBeCloseTo(0.5, 5);
    expect(cs.mua_tin!.brier_mo).toBeCloseTo(0.3, 5);
    expect(cs.mua_tin!.brier_khong).toBeCloseTo(0.7, 5);
  });

  it('⚠ vòng TỰ ĐỘNG bị loại khỏi đo hành vi nhưng Brier vẫn tính (D38)', () => {
    const cs = tinhChiSo([
      ...Array.from({ length: 5 }, () => V({ lenh: [MUA()], chuoi_tang: true })),
      // 5 vòng hết-giờ: có "lệnh" rỗng, có brier — không được đếm vào đuổi giá.
      ...Array.from({ length: 5 }, () => V({ tu_dong: true, brier: 1.2, chuoi_tang: true })),
    ]);
    expect(cs.duoi_gia, 'chỉ còn 5 vòng chuỗi, 0 vòng thường ⇒ chưa đủ nền').toBeNull();
    expect(cs.hieu_chinh!.n).toBe(5); // brier của vòng tự động VẪN là niềm tin thật
  });

  it('⚠ thiếu mẫu ⇒ null, không phải 0 — "chưa đo được" khác "bằng không"', () => {
    const cs = tinhChiSo([V({ lenh: [MUA()] }), V({ lenh: [MUA()] })]);
    expect(cs.duoi_gia).toBeNull();
    expect(cs.theo_tin).toBeNull();
    expect(cs.chot_non).toBeNull();
  });
});

describe('II. Xếp thẻ = KHẨU VỊ × NÉT (D106)', () => {
  const du = NGUONG_TINH_CACH.N_VONG_TOI_THIEU;
  /** Nền: 16 vòng dồn một mã 80% vốn, có mua, có kết quả xen kẽ — đủ mọi mẫu. */
  const nen = (o: Partial<VongInsight> = {}) => [
    ...Array.from({ length: 8 }, (_, i) => [
      V({ pnl_bp: i % 2 ? 300 : -300, tien_mat_bp: 2000, so_ma: 1, ...o }),
      V({ lenh: [MUA(2500)], tien_mat_bp: 2000, so_ma: 1, ...o }),
    ]).flat(),
  ];

  it('chưa đủ vòng ⇒ 🐣, bất kể chỉ số', () => {
    expect(xepTinhCach(tinhChiSo(nen()), du - 1)).toBe('dang_dinh_hinh');
  });

  it('KHẨU VỊ: để dành < 40% phơi nhiễm · dồn < 2,5 mã · rải', () => {
    expect(xepKhauVi(tinhChiSo(Array.from({ length: 8 }, () => V({ tien_mat_bp: 7000, so_ma: 1 }))))).toBe('de_danh');
    expect(xepKhauVi(tinhChiSo(Array.from({ length: 8 }, () => V({ tien_mat_bp: 2000, so_ma: 2 }))))).toBe('don');
    expect(xepKhauVi(tinhChiSo(Array.from({ length: 8 }, () => V({ tien_mat_bp: 2000, so_ma: 4 }))))).toBe('rai');
    expect(xepKhauVi(tinhChiSo(Array.from({ length: 8 }, () => V({ lenh: [MUA()] }))))).toBeNull();
  });

  it('NÉT kết quả: dồn sau thua ×1,5 ⇒ ket_qua, và nó THẮNG nét bên ngoài khi cả hai vượt', () => {
    const vongs = [
      // 4 lần: thua rồi mua 5000; 4 lần: thắng rồi mua 1000 ⇒ nền 3000, sau thua ×1,67.
      ...Array.from({ length: 4 }, () => [V({ pnl_bp: -300 }), V({ lenh: [MUA(5000)] })]).flat(),
      ...Array.from({ length: 4 }, () => [V({ pnl_bp: 300 }), V({ lenh: [MUA(1000)] })]).flat(),
      // và cũng đuổi giá nặng: 4 vòng chuỗi đều mua, 4 vòng thường không mua.
      ...Array.from({ length: 4 }, () => V({ lenh: [MUA(1000)], chuoi_tang: true })),
      ...Array.from({ length: 4 }, () => V({})),
    ];
    const cs = tinhChiSo(vongs);
    expect(cs.don_von!.sau_thua_x).toBeGreaterThanOrEqual(NGUONG_TINH_CACH.KET_QUA_X);
    expect(cs.duoi_gia!.lech).toBeGreaterThanOrEqual(NGUONG_TINH_CACH.BEN_NGOAI_LECH);
    expect(xepNet(cs)).toBe('ket_qua');
  });

  it('NÉT bên ngoài: mua ở chuỗi tăng nhiều hơn nền ≥ 0,25 ⇒ ben_ngoai', () => {
    const cs = tinhChiSo([
      ...Array.from({ length: 4 }, () => V({ lenh: [MUA()], chuoi_tang: true })),
      ...Array.from({ length: 4 }, () => V({})),
    ]);
    expect(cs.duoi_gia!.lech).toBe(1);
    expect(xepNet(cs)).toBe('ben_ngoai');
  });

  it('NÉT lạnh: mua đều mọi vòng, chốt non âm ⇒ lanh (≠ null)', () => {
    const cs = tinhChiSo(nen());
    expect(xepNet(cs)).toBe('lanh');
    expect(xepNet(tinhChiSo([]))).toBeNull();
  });

  it('THẺ = khẩu vị × nét; thiếu một trong hai ⇒ 🐣', () => {
    const vongs = nen();
    expect(xepTinhCach(tinhChiSo(vongs), vongs.length)).toBe('don_lanh');
    // Không có số khẩu vị (caller cũ) ⇒ không dựng nửa tấm thẻ.
    const cu = nen().map((v) => ({ ...v, tien_mat_bp: null, so_ma: null }));
    expect(xepTinhCach(tinhChiSo(cu), cu.length)).toBe('dang_dinh_hinh');
  });

  it('BẬC ĐỌC tách khỏi thẻ: Brier 0,5 ⇒ mắt thần, 1,1 ⇒ đoán mò, không Brier ⇒ chưa', () => {
    expect(xepBacDoc(tinhChiSo(Array.from({ length: 3 }, () => V({ brier: 0.5 }))))).toBe('mat_than');
    expect(xepBacDoc(tinhChiSo(Array.from({ length: 3 }, () => V({ brier: 1.1 }))))).toBe('doan_mo');
    expect(xepBacDoc(tinhChiSo([]))).toBe('chua');
  });

  it('dungHoSo gói đủ: chỉ số + thẻ + hai trục + bậc + cỡ mẫu', () => {
    const hs = dungHoSo([V({ brier: 0.5 })], 1);
    expect(hs.n_vong).toBe(1);
    expect(hs.n_tran).toBe(1);
    expect(hs.tinh_cach).toBe('dang_dinh_hinh');
    expect(hs.khau_vi).toBeNull();
    expect(hs.net).toBeNull();
    expect(hs.bac_doc).toBe('chua');
    const vongs = nen();
    const hs2 = dungHoSo(vongs, 1);
    expect(hs2.tinh_cach).toBe('don_lanh');
    expect(hs2.khau_vi).toBe('don');
    expect(hs2.net).toBe('lanh');
  });
});

describe('III. RANH GIỚI TRẬN — cặp kề chỉ tính TRONG cùng một trận (D101)', () => {
  /*
   * Bàn tròn 5 vai (17/08) tìm ra: hồ sơ trải 60 trận vào MỘT mảng, nên cặp
   * "vòng cuối trận A → vòng 1 trận B" từng được tính như hai vòng liền nhau.
   * Vòng 1 trận mới là lúc vốn vừa reset và cú mua mở màn thường là mốc LỚN
   * NHẤT cả trận ⇒ nó bơm một cực đại vào #5 và kéo lệch #4 một chiều.
   * Hai bài dưới dựng đúng cú đó — gỡ `capLienTiep` là ĐỎ.
   */
  it('⭐ #5 DỒN VỐN: cú mở màn trận sau KHÔNG được tính là "sau thua"', () => {
    // Trận A: 3 vòng mua đều 1.000bp, vòng cuối ĐỎ.
    // Trận B: vòng 1 mua 10.000bp (all-in mở màn, vốn vừa reset).
    // Nếu tính cặp ranh giới: sauThua = [10000] ⇒ 10000/nền ⇒ "🌋 trả thù" giả.
    const vongs = [
      V({ lenh: [MUA(1000)], pnl_bp: 100 }), V({ lenh: [MUA(1000)], pnl_bp: 100 }),
      V({ lenh: [MUA(1000)], pnl_bp: 100 }), V({ lenh: [MUA(1000)], pnl_bp: -500 }),
      W({ lenh: [MUA(10000)], pnl_bp: 100 }),
    ];
    const cs = tinhChiSo(vongs);
    // Chỉ còn 3 cặp sau-thắng TRONG trận A, KHÔNG cặp sau-thua nào.
    // nền = (1000×4 + 10000)/5 = 2800 · sau_thắng = 1000/2800 = 0,3571…
    expect(cs.don_von!.sau_thua_x).toBeNull();
    expect(cs.don_von!.sau_thang_x).toBeCloseTo(1000 / 2800, 5);
    expect(cs.don_von!.n).toBe(3);
  });

  it('⭐ #4 CHỐT NON: vòng 1 trận sau (chưa có gì để bán) không kéo tỷ lệ xuống', () => {
    // 5 cặp sau-XANH và 5 cặp sau-ĐỎ TRONG cùng trận A, cả 10 vòng kế đều CÓ bán
    // ⇒ lệch phải = 0. Chèn thêm 4 vòng đầu-trận-mới không bán: nếu tính cặp
    // ranh giới thì chúng chỉ rơi vào một phía và đẻ ra lệch giả.
    const capA = [
      V({ pnl_bp: 100 }), V({ lenh: [BAN()] }), V({ pnl_bp: 100 }), V({ lenh: [BAN()] }),
      V({ pnl_bp: 100 }), V({ lenh: [BAN()] }), V({ pnl_bp: 100 }), V({ lenh: [BAN()] }),
      V({ pnl_bp: -100 }), V({ lenh: [BAN()] }), V({ pnl_bp: -100 }), V({ lenh: [BAN()] }),
      V({ pnl_bp: -100 }), V({ lenh: [BAN()] }), V({ pnl_bp: -100 }), V({ lenh: [BAN()] }),
    ];
    // Vòng cuối trận A XANH, vòng 1 trận B không bán gì (đúng đời thật).
    const cs = tinhChiSo([...capA, V({ pnl_bp: 100 }), W({ lenh: [MUA()] })]);
    expect(cs.chot_non!.ban_sau_xanh).toBe(1);
    expect(cs.chot_non!.ban_sau_do).toBe(1);
    expect(cs.chot_non!.lech).toBe(0);
    expect(cs.chot_non!.n).toBe(8);   // 4 xanh + 4 đỏ, KHÔNG có cặp ranh giới
  });

  it('cặp trong cùng trận VẪN tính (bản vá không giết luôn phép đo)', () => {
    const cs = tinhChiSo([
      V({ lenh: [MUA(1000)], pnl_bp: -100 }), V({ lenh: [MUA(9000)] }),
      V({ lenh: [MUA(1000)], pnl_bp: -100 }), V({ lenh: [MUA(9000)] }),
      V({ lenh: [MUA(1000)], pnl_bp: -100 }), V({ lenh: [MUA(9000)] }),
    ]);
    expect(cs.don_von!.sau_thua_x).toBeGreaterThan(1.5);
  });
});
