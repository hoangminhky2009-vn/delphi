/**
 * CHIA VAI THEO CỠ BÀN (5 mốc 4/8/12/16/20) — bàn XẾP HẠNG GHÉP NGƯỜI, khoá `balance-v67-banxephang` (SPEC alpha-draft-tang-khong-gian mục 6,
 * founder CHỐT 11/10: *"tương tự với công thức chia role nhưng thay vì cấp thì là cỡ bàn và role vẫn có trần theo bàn"* → *"Chốt"*).
 *
 *   §I   ghế giữa hai mốc dùng hàng của mốc NHỎ hơn.
 *   §II  trần vai theo bàn (bàn 4: 1 · 8: 2+1 · 12: 3+2 · 16: 4+2 · 20: 4+2), tất định theo seed.
 *   §III tần suất khớp bảng (kỳ vọng số ô tính TAY từ bảng founder).
 *   §IV  cổng luật: khoá v67 có cờ `vaiTheoCoBan`; MẶC ĐỊNH vẫn v66 và KHÔNG có cờ — luật mới chỉ gắn cho bàn xếp hạng ghép người.
 */
import { describe, expect, it } from 'vitest';
import { BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION, luatCua } from '../config/holdem.js';
import { RANK_GHEP_KHOA_CU, RANK_GHEP_KHOA_LUAT } from '../config/rank_ghep.js';
import { bocThamVaiTheoCoBan, bocThamVaiXacSuat, xacSuatVaiTheoCoBan } from '../server/holdem/vai.js';

const dem = (v: readonly string[]) => ({
  cmdl: v.filter((x) => x === 'ca_map' || x === 'doi_lai').length,
  tc: v.filter((x) => x === 'to_chuc').length,
});

describe('§I — hàng của mốc nhỏ hơn cho ghế giữa hai mốc', () => {
  it('⭐ vector chép tay từ SPEC (xác suất 0..1) và mốc áp dụng', () => {
    expect(xacSuatVaiTheoCoBan(4)).toEqual({ cmdl: [0.3], tc: [], moc: 4 });
    expect(xacSuatVaiTheoCoBan(8)).toEqual({ cmdl: [0.45, 0.2], tc: [0.2], moc: 8 });
    expect(xacSuatVaiTheoCoBan(12)).toEqual({ cmdl: [0.55, 0.35, 0.15], tc: [0.35, 0.1], moc: 12 });
    expect(xacSuatVaiTheoCoBan(16)).toEqual({ cmdl: [0.6, 0.45, 0.25, 0.1], tc: [0.45, 0.2], moc: 16 });
    expect(xacSuatVaiTheoCoBan(20)).toEqual({ cmdl: [0.65, 0.5, 0.35, 0.2], tc: [0.55, 0.3], moc: 20 });
  });
  it('ghế giữa mốc: 5,6,7 → hàng 4 · 9,10,11 → hàng 8 · 13,15 → hàng 12 · 17,19 → hàng 16; dưới 4 vẫn hàng 4', () => {
    for (const n of [2, 3, 5, 6, 7]) expect(xacSuatVaiTheoCoBan(n).moc, `n=${n}`).toBe(4);
    for (const n of [9, 10, 11]) expect(xacSuatVaiTheoCoBan(n).moc, `n=${n}`).toBe(8);
    for (const n of [13, 15]) expect(xacSuatVaiTheoCoBan(n).moc, `n=${n}`).toBe(12);
    for (const n of [17, 19]) expect(xacSuatVaiTheoCoBan(n).moc, `n=${n}`).toBe(16);
  });
});

describe('§II — trần vai theo bàn và tính tất định', () => {
  it('⭐ không bao giờ vượt trần: 4–7 ghế ≤ 1 CM/ĐL, 0 TC · 8–11 ≤ 2+1 · 12–15 ≤ 3+2 · 16–20 ≤ 4+2 (mỗi cỡ 500 seed)', () => {
    const tran = (n: number) => (n < 8 ? [1, 0] : n < 12 ? [2, 1] : n < 16 ? [3, 2] : [4, 2]);
    for (let n = 4; n <= 20; n += 1) {
      for (let seed = 1; seed <= 500; seed += 1) {
        const v = bocThamVaiTheoCoBan(seed, n);
        const d = dem(v);
        expect(v).toHaveLength(n);
        expect(d.cmdl, `n=${n} seed=${seed}`).toBeLessThanOrEqual(tran(n)[0]!);
        expect(d.tc, `n=${n} seed=${seed}`).toBeLessThanOrEqual(tran(n)[1]!);
      }
    }
  });
  it('tất định theo seed; ngoài 1..20 ghế thì báo lỗi (trận, không phải phòng 40)', () => {
    expect(bocThamVaiTheoCoBan(777, 9)).toEqual(bocThamVaiTheoCoBan(777, 9));
    expect(() => bocThamVaiTheoCoBan(1, 21)).toThrow();
    expect(() => bocThamVaiTheoCoBan(1, 0)).toThrow();
  });
  it('khác luật D515 thật: cùng seed·cùng cỡ ghế hai bộ bốc cho ra bộ vai khác (không phải bản sao đội lốt)', () => {
    let khac = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      if (JSON.stringify(bocThamVaiTheoCoBan(seed, 20)) !== JSON.stringify(bocThamVaiXacSuat(seed, 20))) khac += 1;
    }
    expect(khac).toBeGreaterThan(100);
  });
});

describe('§III — tần suất khớp bảng founder (kỳ vọng số ô tính tay)', () => {
  /** [cỡ ghế, kỳ vọng số ô CM/ĐL, kỳ vọng số ô TC] — cộng các % của hàng chia 100. */
  const KY_VONG: [number, number, number][] = [
    [4, 0.30, 0], [8, 0.65, 0.20], [12, 1.05, 0.45], [16, 1.40, 0.65], [20, 1.70, 0.85],
    // ghế giữa mốc dùng hàng nhỏ hơn:
    [7, 0.30, 0], [11, 0.65, 0.20], [15, 1.05, 0.45], [19, 1.40, 0.65],
  ];
  it.each(KY_VONG)('⭐ %i ghế: trung bình %f ô CM/ĐL · %f ô Tổ Chức trên 6.000 seed (sai số ±0,05)', (n, kvCm, kvTc) => {
    const N = 6000;
    let cm = 0, tc = 0;
    for (let seed = 1; seed <= N; seed += 1) {
      const d = dem(bocThamVaiTheoCoBan(seed, n));
      cm += d.cmdl; tc += d.tc;
    }
    expect(Math.abs(cm / N - kvCm), `cm ${cm / N}`).toBeLessThan(0.05);
    expect(Math.abs(tc / N - kvTc), `tc ${tc / N}`).toBeLessThan(0.05);
  });
  it('Cá Mập và Đội Lái ra 50/50 trong ô CM/ĐL (bàn 20, 6.000 seed)', () => {
    let cmap = 0, dlai = 0;
    for (let seed = 1; seed <= 6000; seed += 1) {
      const v = bocThamVaiTheoCoBan(seed, 20);
      cmap += v.filter((x) => x === 'ca_map').length;
      dlai += v.filter((x) => x === 'doi_lai').length;
    }
    expect(Math.abs(cmap / (cmap + dlai) - 0.5)).toBeLessThan(0.02);
  });
});

describe('§IV — cổng luật (A11.3): khoá mới chỉ cho bàn xếp hạng ghép người', () => {
  it('⭐ khoá v67 tồn tại, mang cờ `vaiTheoCoBan`, và KHÔNG phải mặc định; mặc định vẫn không có cờ', () => {
    expect(RANK_GHEP_KHOA_LUAT in BO_LUAT_THEO_PHIEN_BAN).toBe(true);
    expect(luatCua(RANK_GHEP_KHOA_LUAT).vaiTheoCoBan).toBe(true);
    expect(RANK_GHEP_KHOA_LUAT).not.toBe(HOLDEM_BALANCE_VERSION);
    expect(luatCua(HOLDEM_BALANCE_VERSION).vaiTheoCoBan).not.toBe(true);
  });
  it('⭐ chỉ khoá bàn ghép mang cờ (hiện hành + khoá bàn ghép cũ giữ cho replay — D590); mọi khoá khác (kể cả mặc định) không có', () => {
    const co = Object.keys(BO_LUAT_THEO_PHIEN_BAN).filter((k) => luatCua(k).vaiTheoCoBan === true);
    expect(co.sort()).toEqual([...RANK_GHEP_KHOA_CU, RANK_GHEP_KHOA_LUAT].sort());
  });
  it('khoá bàn ghép hiện hành chỉ khác MẶC ĐỊNH đúng một cờ (không lén đổi luật nào khác — D590: v71 = v70 + cờ)', () => {
    const a = luatCua(HOLDEM_BALANCE_VERSION) as unknown as Record<string, unknown>;
    const b = luatCua(RANK_GHEP_KHOA_LUAT) as unknown as Record<string, unknown>;
    const khac = Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);
    expect(khac).toEqual(['vaiTheoCoBan']);
  });
  it('tên khoá mới viết thường hết (khuôn `<miền>-v<N>-<biệt danh>`)', () => {
    expect(RANK_GHEP_KHOA_LUAT).toMatch(/^balance-v\d+-[a-z0-9]+$/);
  });
});
