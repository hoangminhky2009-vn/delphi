/**
 * PFM — ĐỘ CHẮC (D354): từ "mấy lần trên mấy lần" ra "chắc tới đâu là tỷ lệ THẬT vượt mốc".
 * Hàm thuần, số học thuần, không thư viện (A11.18), chạy ở máy user.
 *
 * ⚠⚠ VÌ SAO FILE NÀY TỒN TẠI. D353 đo được: trên sổ KHÔNG có chi bù nào, `chiBu()` vẫn ra trung
 * bình 0,484 — vì "hôm sau có vượt trung vị không" vốn đã ≈ ½ × tỷ lệ ngày có chi — và thẻ
 * `boost_chi_bu` (ngưỡng 0,5) bắn ở 37,5% số tháng của người ghi đủ mọi ngày. So một tỷ lệ dựng
 * từ 3 quan sát với một ngưỡng cứng là hỏi sai câu: câu đúng là *"với chừng này quan sát, ta chắc
 * tới đâu rằng tỷ lệ thật nằm TRÊN mốc"*.
 *
 * ⚠ CÁCH TRẢ LỜI (khuôn D307, founder chốt k = 4 ngày 20/09/2026): tiên nghiệm đặt TẠI mốc và nặng
 * bằng `k` quan sát — Beta(k·mốc, k·(1−mốc)) — tức mặc định tin là "không có gì xảy ra", và dữ liệu
 * phải thắng được `k` quan sát giả ấy. Thấy `lan` lần vượt trên `n` lần ⇒ hậu nghiệm
 * Beta(k·mốc + lan, k·(1−mốc) + n − lan); trả P(tỷ lệ > mốc).
 *
 * ⚠ Trung bình co rút `(k·mốc + lan)/(k + n)` KHÔNG dùng được làm luật bắn: nó vượt mốc ⇔ tỷ lệ
 * thô vượt mốc, tức co về chính cái mốc thì không đổi dấu của câu trả lời. Phải hỏi ĐUÔI phân bố.
 */

/** Mốc bị kẹp vào [ε, 1−ε]: mốc đúng 0 hoặc 1 làm một tham số Beta bằng 0 (phân bố suy biến). */
const MOC_KEP = 0.01;

/** ln Γ(x), x > 0 — xấp xỉ Lanczos (g = 7, 9 hệ số), sai số ~1e−15 trên miền đang dùng. */
function logGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let s = c[0]!;
  for (let i = 1; i < 9; i++) s += c[i]! / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(s);
}

/** Liên phân số của hàm beta không đầy đủ (Lentz cải biên). Hội tụ nhanh khi x < (a+1)/(a+b+2). */
function lienPhanSoBeta(x: number, a: number, b: number): number {
  const NHO = 1e-300;
  const qab = a + b; const qap = a + 1; const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < NHO) d = NHO;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < NHO) d = NHO;
    c = 1 + aa / c; if (Math.abs(c) < NHO) c = NHO;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < NHO) d = NHO;
    c = 1 + aa / c; if (Math.abs(c) < NHO) c = NHO;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-15) break;
  }
  return h;
}

/** Hàm beta không đầy đủ CHÍNH QUY I_x(a,b) = P(Beta(a,b) ≤ x). a, b > 0; x ∈ [0,1]. */
export function betaChinhQuy(x: number, a: number, b: number): number {
  if (!(a > 0) || !(b > 0) || !(x >= 0 && x <= 1)) {
    throw new RangeError(`betaChinhQuy: tham số ngoài miền (x=${x}, a=${a}, b=${b})`);
  }
  if (x === 0) return 0;
  if (x === 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (bt * lienPhanSoBeta(x, a, b)) / a
    : 1 - (bt * lienPhanSoBeta(1 - x, b, a)) / b;
}

/**
 * P(tỷ lệ thật > `moc`) sau khi thấy `lan` lần trên `n` lần, tiên nghiệm đặt tại `moc` nặng `k`.
 *
 * ⚠ NÉM khi đầu vào hỏng, không trả một con số "tạm": người gọi duy nhất là luật bắn thẻ, và một
 * con số bịa ở đây là một thẻ nói sai với người dùng mà không bài test nào thấy.
 */
export function xacSuatVuotMoc(lan: number, n: number, moc: number, k: number): number {
  if (!Number.isInteger(lan) || !Number.isInteger(n) || lan < 0 || n < 0 || lan > n) {
    throw new RangeError(`xacSuatVuotMoc: đếm không hợp lệ (lan=${lan}, n=${n})`);
  }
  if (!(k > 0) || !Number.isFinite(moc)) {
    throw new RangeError(`xacSuatVuotMoc: tham số không hợp lệ (moc=${moc}, k=${k})`);
  }
  const m = Math.max(MOC_KEP, Math.min(1 - MOC_KEP, moc));
  return 1 - betaChinhQuy(m, k * m + lan, k * (1 - m) + (n - lan));
}
