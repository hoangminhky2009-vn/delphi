/**
 * PRNG tất định, hàm thuần — nguồn ngẫu nhiên duy nhất của engine trận.
 *
 * Vì sao tự cài chứ không dùng Math.random: cùng (map, seed, actionLog) phải ra
 * cùng dãy giá và NAV từng điểm nguyên, dù chạy ở server, ở client hay lúc
 * replay. Math.random không có seed và khác nhau giữa các engine JS → replay
 * vô nghĩa → không chống được gian lận.
 *
 * Hai quyết định kỹ thuật:
 *
 * (1) Số học 32-bit nguyên, không float. Math.imul và `>>> 0` được ECMAScript
 *     định nghĩa chính xác từng bit, nên V8/JSC/SpiderMonkey cho cùng kết quả.
 *     Float (trả 0..1 rồi nhân) làm tròn khác nhau giữa nền tảng và lệch giá
 *     sau vài nghìn tick.
 *
 * (2) Dòng địa chỉ hóa theo tọa độ, không phải dòng tuần tự. Mỗi lần rút số
 *     được định danh bằng (seed, miền, tọa độ…) rồi băm ra hạt riêng. Với dòng
 *     tuần tự, thêm một người chơi hoặc đổi thứ tự duyệt tài sản là toàn bộ
 *     nhiễu phía sau xê dịch và replay ra trận khác. Với địa chỉ hóa, nhiễu của
 *     (tick 7, tài sản 'vang') luôn là một số cố định bất kể xung quanh có gì.
 */

/** 2^32 — số giá trị của một số nguyên không dấu 32-bit. */
const U32_RANGE = 0x1_0000_0000;

/** 100 % tính bằng basis point. */
const BP_DENOMINATOR = 10_000;

/** Băm FNV-1a 32-bit trên chuỗi — ổn định, không phụ thuộc nền tảng. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Hạt cho MỘT tọa độ. Các phần được nối bằng '|' — ký tự này bị cấm trong id
 * (xem assertSeedPartSafe) nên không có hai tọa độ khác nhau nào băm cùng chuỗi.
 */
export function seedAt(seed: number, domain: string, ...coords: readonly (number | string)[]): number {
  return hashString(`${seed >>> 0}|${domain}|${coords.join('|')}`);
}

/**
 * Chặn ký tự phân tách lọt vào id (nếu không, ('a|b', 'c') và ('a', 'b|c')
 * sẽ trùng hạt — cùng một nhiễu cho hai tọa độ khác nhau).
 * Gọi ở tầng nạp cấu hình, không gọi trong vòng lặp nóng.
 */
export function assertSeedPartSafe(part: string, where: string): void {
  if (part.includes('|')) {
    throw new Error(`Sandbox RNG: id "${part}" (${where}) chứa ký tự '|' — cấm, sẽ gây trùng hạt.`);
  }
}

/** Bộ sinh số nguyên tất định. Mỗi thể hiện là MỘT dòng độc lập. */
export interface Rng {
  /** Số nguyên không dấu 32-bit kế tiếp. */
  nextU32(): number;
  /** Số nguyên trong [0, n) — n phải > 0. Phân bố đều, không lệch modulo. */
  below(n: number): number;
  /** Số nguyên trong [lo, hi] (bao gồm hai đầu). */
  range(lo: number, hi: number): number;
  /** true với xác suất bp/10.000; bp là số nguyên trong [0, 10.000]. */
  chanceBp(bp: number): boolean;
}

/**
 * splitmix32 — băm bộ đếm, không phải LCG chuỗi. Đủ tốt cho mô phỏng game
 * (qua các test thống kê cơ bản), rẻ, và chỉ dùng phép nguyên 32-bit đã được
 * chuẩn hóa chính xác.
 */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;

  const nextU32 = (): number => {
    state = (state + 0x9e3779b9) >>> 0;
    let t = state;
    t ^= t >>> 16;
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };

  /**
   * Bác bỏ (rejection sampling) để không lệch modulo: `nextU32() % n` làm các
   * giá trị nhỏ hơi nhiều hơn khi n không chia hết 2^32 — nhỏ, nhưng qua
   * 10.000 trận Monte Carlo đủ bẻ cong kết luận cân bằng. Cùng hạt → cùng số
   * lần bác bỏ, nên vẫn tái lập.
   */
  const below = (n: number): number => {
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`Rng.below: n phải là số nguyên dương, nhận ${n}`);
    }
    const limit = U32_RANGE - (U32_RANGE % n);
    let v = nextU32();
    while (v >= limit) v = nextU32();
    return v % n;
  };

  return {
    nextU32,
    below,
    range: (lo, hi) => {
      if (hi < lo) throw new Error(`Rng.range: hi(${hi}) < lo(${lo})`);
      return lo + below(hi - lo + 1);
    },
    chanceBp: (bp) => {
      if (!Number.isInteger(bp) || bp < 0 || bp > BP_DENOMINATOR) {
        throw new Error(`Rng.chanceBp: bp phải là số nguyên trong [0, ${BP_DENOMINATOR}], nhận ${bp}`);
      }
      return below(BP_DENOMINATOR) < bp;
    },
  };
}

/** Dòng riêng cho một tọa độ, dùng một lần rồi bỏ. */
export function rngAt(
  seed: number,
  domain: string,
  ...coords: readonly (number | string)[]
): Rng {
  return makeRng(seedAt(seed, domain, ...coords));
}

/**
 * Nhiễu đối xứng trong [-amp, +amp], trung bình 0 chính xác.
 *
 * Bẫy: `below(2*amp) - amp` trông gần giống nhưng kỳ vọng lệch −0,5 mỗi tick —
 * qua 264 tick một trận, giá trôi xuống có hệ thống mà biểu đồ không lộ ra.
 */
export function symmetricNoise(rng: Rng, amp: number): number {
  if (amp <= 0) return 0;
  return rng.below(2 * amp + 1) - amp;
}

/**
 * Chia số nguyên làm tròn XUỐNG kể cả với số âm: idiv(-7, 2) = -4.
 *
 * Bẫy: `/` của JS trả float, và `(a/b)|0` cắt về phía 0 nên −7/2 ra −3. Engine
 * giá chia dày đặc (tác động giá, chiết khấu, phân bổ) và một nửa số lần là số
 * âm; cắt về 0 thiên lệch có lợi cho phe bán. Dùng hàm này ở MỌI phép chia
 * trong engine. Ngoài vùng số nguyên an toàn (2^53) float không còn biểu diễn
 * đúng a và b, nên nổ thay vì trả một số sai lặng lẽ.
 */
export function idiv(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    throw new Error(`idiv: cần số nguyên an toàn, nhận ${a} / ${b}`);
  }
  if (b === 0) throw new Error('idiv: chia cho 0');
  return Math.floor(a / b);
}

/** floor(value × bp / 10.000) — an toàn với số âm nhờ idiv. */
export function applyBpInt(value: number, bp: number): number {
  return idiv(value * bp, BP_DENOMINATOR);
}
