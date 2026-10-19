/**
 * D515 — CHIA VAI THEO XÁC SUẤT (founder 05/10: "tỷ lệ các role như cá mập/đội lái/tổ chức sẽ có xác suất xuất hiện trong 1 ván chứ ko phải cố định …
 * (<4 thì 1 cá mập/đội lái) (=<10 thì 2 cá mập/đội lái và xác suất 1 tổ chức) (>10 thì trần là 2 tổ chức, 4 cá mập/đội lái xác suất tăng nhẹ theo mỗi
 * 2 user) trần 1 trận là 20 người. Còn tạo phòng thì cho phép trần 40" · "đại đa số game ở các bàn ít/nhỏ thì sẽ chỉ có cá nhân" → bảng chọn A):
 *   ≤ 3 ghế  : 1 ô Cá Mập/Đội Lái p 25 %                                                   (75 % ván chỉ Cá nhân)
 *   4–10 ghế : ô CM/ĐL 40 % · 20 % · ô Tổ Chức 20 %                                          (~38 % ván không vai lớn)
 *   11–40    : ô CM/ĐL 50 · 35 · 20 · 10 % · ô Tổ Chức 35 · 15 % — mỗi 2 ghế trên 11 cộng 2 điểm % mọi ô (trần 95 %)
 *   mỗi ô độc lập; ô CM/ĐL ra Cá Mập hoặc Đội Lái 50/50. Trận ≤ 20 ghế · phòng ≤ 40.
 */
import { describe, expect, it } from 'vitest';
import { SO_GHE_TRAN_PHONG, SO_GHE_TRAN_TRAN } from '../config/holdem.js';
import { bocThamVaiXacSuat, xacSuatVai } from '../server/holdem/vai.js';

describe('§I — bảng xác suất (vector chép tay)', () => {
  it('⭐ ≤3 ghế: một ô CM/ĐL 25 %, không Tổ Chức · 4–10: 40/20 + TC 20 · 11: 50/35/20/10 + TC 35/15', () => {
    expect(xacSuatVai(2)).toEqual({ cmdl: [0.25], tc: [] });
    expect(xacSuatVai(3)).toEqual({ cmdl: [0.25], tc: [] });
    expect(xacSuatVai(4)).toEqual({ cmdl: [0.4, 0.2], tc: [0.2] });
    expect(xacSuatVai(10)).toEqual({ cmdl: [0.4, 0.2], tc: [0.2] });
    expect(xacSuatVai(11)).toEqual({ cmdl: [0.5, 0.35, 0.2, 0.1], tc: [0.35, 0.15] });
  });
  it('⭐ tăng 2 điểm % mỗi 2 ghế trên 11: 13 ghế +2 · 20 ghế +8 · 40 ghế +28', () => {
    const cong = (n: number, d: number) => ({ cmdl: [0.5, 0.35, 0.2, 0.1].map((p) => +(p + d).toFixed(10)), tc: [0.35, 0.15].map((p) => +(p + d).toFixed(10)) });
    const tron = (x: { cmdl: number[]; tc: number[] }) => ({ cmdl: x.cmdl.map((p) => +p.toFixed(10)), tc: x.tc.map((p) => +p.toFixed(10)) });
    expect(tron(xacSuatVai(12))).toEqual(cong(12, 0));
    expect(tron(xacSuatVai(13))).toEqual(cong(13, 0.02));
    expect(tron(xacSuatVai(20))).toEqual(cong(20, 0.08));
    expect(tron(xacSuatVai(40))).toEqual(cong(40, 0.28));
  });
  it('trần ghế: trận 20 · phòng 40; quá 40 ⇒ báo lỗi', () => {
    expect(SO_GHE_TRAN_TRAN).toBe(20);
    expect(SO_GHE_TRAN_PHONG).toBe(40);
    expect(() => bocThamVaiXacSuat(1, 41)).toThrow();
  });
});

describe('§II — bốc thăm', () => {
  const dem = (v: readonly string[]) => ({ cmdl: v.filter((x) => x === 'ca_map' || x === 'doi_lai').length, tc: v.filter((x) => x === 'to_chuc').length });
  it('⭐ không bao giờ vượt trần (≤3: 1 · ≤10: 2 CM/ĐL + 1 TC · >10: 4 + 2) và tất định theo seed', () => {
    for (const n of [2, 3, 4, 7, 10, 11, 16, 20, 40]) {
      for (let seed = 1; seed <= 400; seed++) {
        const v = bocThamVaiXacSuat(seed, n), d = dem(v);
        expect(v).toHaveLength(n);
        expect(d.cmdl).toBeLessThanOrEqual(n <= 3 ? 1 : n <= 10 ? 2 : 4);
        expect(d.tc).toBeLessThanOrEqual(n <= 3 ? 0 : n <= 10 ? 1 : 2);
      }
    }
    expect(bocThamVaiXacSuat(777, 9)).toEqual(bocThamVaiXacSuat(777, 9));
  });
  it('⭐ tần suất khớp bảng (4.000 seed): 3 ghế ~25 % có vai lớn · 8 ghế ~38,4 % không vai lớn · 20 ghế trung bình 0,66 Tổ Chức', () => {
    const N = 4000;
    let co3 = 0, khong8 = 0, tc20 = 0;
    for (let seed = 1; seed <= N; seed++) {
      if (dem(bocThamVaiXacSuat(seed, 3)).cmdl > 0) co3++;
      const d8 = dem(bocThamVaiXacSuat(seed, 8)); if (d8.cmdl + d8.tc === 0) khong8++;
      tc20 += dem(bocThamVaiXacSuat(seed, 20)).tc;
    }
    expect(co3 / N).toBeGreaterThan(0.22); expect(co3 / N).toBeLessThan(0.28);
    expect(khong8 / N).toBeGreaterThan(0.354); expect(khong8 / N).toBeLessThan(0.414);
    expect(tc20 / N).toBeGreaterThan(0.61); expect(tc20 / N).toBeLessThan(0.71);
  });
  it('ghế 0 (người) luôn mang vai thuộc tập cho người', () => {
    for (let seed = 1; seed <= 300; seed++) expect(['ca_nhan', 'ca_map']).toContain(bocThamVaiXacSuat(seed, 8, ['ca_nhan', 'ca_map'])[0]);
  });
});
