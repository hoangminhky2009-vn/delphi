/**
 * Sandbox — PRNG TẤT ĐỊNH, HÀM THUẦN (GĐ4.5).
 *
 * Vì sao tự cài chứ không dùng Math.random: bất biến cốt lõi của Đấu trường là
 * "cùng (mapId, seed, actionLog) → cùng dãy giá và NAV TỪNG ĐIỂM NGUYÊN, chạy
 * ở server, ở client, hay lúc replay" (D16 mục 7.2). Math.random không có seed
 * và khác nhau giữa các engine → replay vô nghĩa → không chống được gian lận.
 *
 * ─── HAI QUYẾT ĐỊNH KỸ THUẬT ĐÁNG GHI LẠI ──────────────────────────────────
 *
 * (1) SỐ HỌC 32-BIT NGUYÊN, KHÔNG FLOAT. Dùng Math.imul + `>>> 0` — cả hai
 *     được ECMAScript định nghĩa chính xác từng bit, nên V8/JSC/SpiderMonkey
 *     cho cùng kết quả. Nếu dùng float (vd trả về 0..1 rồi nhân) thì sai số
 *     làm tròn khác nhau giữa nền tảng sẽ làm lệch giá sau vài nghìn tick.
 *
 * (2) DÒNG ĐỊA CHỈ HÓA THEO TỌA ĐỘ, KHÔNG PHẢI DÒNG TUẦN TỰ. Thay vì một
 *     generator chạy dài rồi ai gọi trước lấy trước, mỗi lần rút số được định
 *     danh bằng (seed, tên miền, tọa độ...) rồi băm ra hạt riêng.
 *     Vì sao quan trọng: với dòng tuần tự, chỉ cần THÊM một người chơi vào
 *     lobby — hoặc đổi thứ tự duyệt tài sản — là toàn bộ nhiễu của mọi tài sản
 *     sau đó xê dịch, và trận replay ra khác trận gốc. Với địa chỉ hóa,
 *     nhiễu của (tick 7, tài sản 'vang') luôn là một số cố định bất kể xung
 *     quanh có gì. Đây là lớp phòng thủ chính chống bug replay.
 */

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
  /** true với xác suất bp/10.000. */
  chanceBp(bp: number): boolean;
}

/**
 * splitmix32 — băm bộ đếm, không phải LCG chuỗi. Chất lượng đủ tốt cho mô
 * phỏng game (qua được các test thống kê cơ bản), rẻ, và quan trọng nhất:
 * chỉ dùng phép nguyên 32-bit đã được chuẩn hóa chính xác.
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
   * Loại bỏ lệch modulo bằng phương pháp bác bỏ (rejection sampling).
   * Lấy thẳng `nextU32() % n` sẽ khiến các giá trị nhỏ hơi nhiều hơn khi n
   * không chia hết 2^32 — nhỏ, nhưng qua 10.000 trận Monte Carlo thì đủ để
   * bẻ cong kết luận cân bằng. Vòng lặp này tất định (cùng hạt → cùng số lần
   * bác bỏ) nên không phá tính tái lập.
   */
  const below = (n: number): number => {
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`Rng.below: n phải là số nguyên dương, nhận ${n}`);
    }
    const limit = 0x1_0000_0000 - (0x1_0000_0000 % n);
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
    chanceBp: (bp) => below(10_000) < bp,
  };
}

/** Tiện ích: dòng riêng cho một tọa độ, dùng một lần rồi bỏ. */
export function rngAt(
  seed: number,
  domain: string,
  ...coords: readonly (number | string)[]
): Rng {
  return makeRng(seedAt(seed, domain, ...coords));
}

/**
 * Nhiễu đối xứng trong [-amp, +amp], TRUNG BÌNH 0 chính xác.
 *
 * Cẩn thận cái bẫy: `below(2*amp+1) - amp` cho khoảng đúng nhưng nếu ai đó
 * đổi thành `below(2*amp) - amp` thì kỳ vọng lệch −0,5 mỗi tick — qua
 * 12 vòng × 22 tick = 264 tick, giá trôi xuống có hệ thống mà nhìn biểu đồ
 * không phát hiện được. Viết ra đây để lần sau không ai "tối ưu" nhầm.
 */
export function symmetricNoise(rng: Rng, amp: number): number {
  if (amp <= 0) return 0;
  return rng.below(2 * amp + 1) - amp;
}

/**
 * Chia số nguyên LÀM TRÒN XUỐNG kể cả với số âm.
 *
 * Bẫy: toán tử `/` của JS trả về float, và `(a/b)|0` cắt về phía 0 — nên
 * −7/2 ra −3 thay vì −4. Trong engine giá, chia là chỗ xuất hiện dày đặc
 * (tác động giá, chiết khấu, phân bổ) và một nửa số lần là số âm. Cắt về 0
 * tạo thiên lệch có lợi cho phe bán — đúng loại lỗi chạy 6 tháng không ai
 * thấy. Dùng hàm này ở MỌI phép chia trong engine.
 */
export function idiv(a: number, b: number): number {
  if (b === 0) throw new Error('idiv: chia cho 0');
  return Math.floor(a / b);
}

/** floor(value × bp / 10.000) — an toàn với số âm nhờ idiv. */
export function applyBpInt(value: number, bp: number): number {
  return idiv(value * bp, 10_000);
}
