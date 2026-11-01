/**
 * PRNG tất định của engine trận. Vector ghim lấy từ bản cài đặt đang chạy prod:
 * đổi một bit ở đây là mọi replay đã lưu ra trận khác — sửa test cho khớp code
 * thì phải lật `balance_version`.
 */
import { describe, it, expect } from 'vitest';
import {
  applyBpInt,
  assertSeedPartSafe,
  hashString,
  idiv,
  makeRng,
  rngAt,
  seedAt,
  symmetricNoise,
} from '../server/sandbox/rng.js';

const take = <T>(n: number, f: () => T): T[] => Array.from({ length: n }, f);

describe('hashString — FNV-1a 32-bit', () => {
  it('khớp vector chuẩn của FNV-1a', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
    expect(hashString('foobar')).toBe(0xbf9cf968);
  });
});

describe('seedAt — hạt theo tọa độ', () => {
  it('vector ghim', () => {
    expect(seedAt(42, 'gia', 7, 'vang')).toBe(2925620393);
  });

  it('đổi bất kỳ phần nào của tọa độ → hạt khác', () => {
    const goc = seedAt(42, 'gia', 7, 'vang');
    expect(seedAt(43, 'gia', 7, 'vang')).not.toBe(goc);
    expect(seedAt(42, 'gia2', 7, 'vang')).not.toBe(goc);
    expect(seedAt(42, 'gia', 8, 'vang')).not.toBe(goc);
    expect(seedAt(42, 'gia', 7, 'bac')).not.toBe(goc);
  });

  it("id chứa '|' bị chặn — ('a|b','c') và ('a','b|c') sẽ trùng hạt", () => {
    expect(seedAt(1, 'd', 'a|b', 'c')).toBe(seedAt(1, 'd', 'a', 'b|c'));
    expect(() => assertSeedPartSafe('a|b', 'test')).toThrow(/\|/);
    expect(() => assertSeedPartSafe('vang', 'test')).not.toThrow();
  });
});

describe('makeRng — splitmix32', () => {
  it('vector ghim: 8 số đầu của seed 0', () => {
    const r = makeRng(0);
    expect(take(8, () => r.nextU32())).toEqual([
      1684164658, 3653269916, 2939563536, 2141751570,
      3295091513, 4057132772, 2256158761, 2742494325,
    ]);
  });

  it('cùng seed → cùng dãy; hai thể hiện độc lập nhau', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    a.nextU32();
    a.nextU32();
    expect(b.nextU32()).toBe(551831576);
    expect(a.nextU32()).toBe(322543647);
  });

  it('seed ngoài 32-bit được quy về u32 (seed và seed + 2^32 cùng dãy)', () => {
    expect(makeRng(2 ** 32 + 5).nextU32()).toBe(makeRng(5).nextU32());
    expect(makeRng(-1).nextU32()).toBe(makeRng(0xffffffff).nextU32());
  });
});

describe('below — đều, không lệch modulo', () => {
  it('vector ghim seed 7, n = 10', () => {
    const r = makeRng(7);
    expect(take(8, () => r.below(10))).toEqual([9, 3, 6, 7, 6, 9, 2, 0]);
  });

  it('bác bỏ giá trị ≥ giới hạn: n = 2^31+1 bỏ qua 3653269916, 2939563536 của seed 0', () => {
    // Không bác bỏ thì số thứ hai sẽ là 3653269916 % (2^31+1) = 1505786267.
    const r = makeRng(0);
    expect(take(3, () => r.below(2 ** 31 + 1))).toEqual([1684164658, 2141751570, 769961909]);
  });

  it('n không phải số nguyên dương → nổ', () => {
    const r = makeRng(1);
    expect(() => r.below(0)).toThrow(/below/);
    expect(() => r.below(-3)).toThrow(/below/);
    expect(() => r.below(2.5)).toThrow(/below/);
  });

  it('range(lo, hi) gồm hai đầu; hi < lo → nổ', () => {
    const r = makeRng(3);
    expect(take(6, () => r.range(-2, 2))).toEqual([-2, 0, -1, -2, 1, -1]);
    expect(makeRng(9).range(4, 4)).toBe(4);
    expect(() => makeRng(1).range(3, 2)).toThrow(/range/);
  });
});

describe('chanceBp', () => {
  it('vector ghim rngAt(1, "x"), 50 %', () => {
    const r = rngAt(1, 'x');
    expect(take(10, () => r.chanceBp(5000))).toEqual([
      true, true, false, false, false, true, false, true, false, false,
    ]);
  });

  it('0 bp không bao giờ đúng, 10.000 bp luôn đúng', () => {
    const r = makeRng(11);
    expect(take(200, () => r.chanceBp(0)).some(Boolean)).toBe(false);
    expect(take(200, () => r.chanceBp(10_000)).every(Boolean)).toBe(true);
  });

  it('1 bp đúng khi và chỉ khi below(10.000) rút ra 0', () => {
    for (let seed = 0; seed < 500; seed += 1) {
      expect(makeRng(seed).chanceBp(1)).toBe(makeRng(seed).below(10_000) === 0);
    }
  });

  it('bp ngoài [0, 10.000] hoặc không nguyên → nổ', () => {
    const r = makeRng(1);
    expect(() => r.chanceBp(-1)).toThrow(/chanceBp/);
    expect(() => r.chanceBp(10_001)).toThrow(/chanceBp/);
    expect(() => r.chanceBp(2500.5)).toThrow(/chanceBp/);
    expect(() => r.chanceBp(Number.NaN)).toThrow(/chanceBp/);
  });
});

describe('symmetricNoise — trong [-amp, +amp], trung bình 0', () => {
  it('chạm cả hai đầu và không vượt ra ngoài', () => {
    const r = makeRng(5);
    const xs = take(2000, () => symmetricNoise(r, 3));
    expect(Math.min(...xs)).toBe(-3);
    expect(Math.max(...xs)).toBe(3);
  });

  it('dùng đúng 2·amp+1 giá trị — vẽ lại bằng below() phải khớp từng số', () => {
    const a = makeRng(8);
    const b = makeRng(8);
    for (let i = 0; i < 50; i += 1) expect(symmetricNoise(a, 4)).toBe(b.below(9) - 4);
  });

  it('amp ≤ 0 → 0 và không tiêu số nào của dòng', () => {
    const r = makeRng(2);
    expect(symmetricNoise(r, 0)).toBe(0);
    expect(symmetricNoise(r, -1)).toBe(0);
    expect(r.nextU32()).toBe(makeRng(2).nextU32());
  });
});

describe('idiv — chia làm tròn xuống, kể cả số âm', () => {
  it('vector', () => {
    expect(idiv(7, 2)).toBe(3);
    expect(idiv(-7, 2)).toBe(-4);
    expect(idiv(7, -2)).toBe(-4);
    expect(idiv(-7, -2)).toBe(3);
    expect(idiv(-8, 2)).toBe(-4);
    expect(idiv(0, 5)).toBe(0);
  });

  it('chia cho 0 → nổ', () => {
    expect(() => idiv(1, 0)).toThrow(/chia cho 0/);
  });

  it('không phải số nguyên an toàn → nổ thay vì trả số sai', () => {
    expect(() => idiv(1.5, 2)).toThrow(/an toàn/);
    expect(() => idiv(4, 0.5)).toThrow(/an toàn/);
    expect(() => idiv(2 ** 53, 3)).toThrow(/an toàn/);
    expect(() => idiv(Number.NaN, 3)).toThrow(/an toàn/);
    expect(idiv(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('applyBpInt', () => {
  it('floor(value × bp / 10.000), làm tròn xuống ở số âm', () => {
    expect(applyBpInt(199, 5000)).toBe(99);
    expect(applyBpInt(-1, 5000)).toBe(-1);
    expect(applyBpInt(-199, 5000)).toBe(-100);
    expect(applyBpInt(1000, 300)).toBe(30);
  });
});
