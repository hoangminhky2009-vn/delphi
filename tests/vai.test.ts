/**
 * VAI BẤT ĐỐI XỨNG — lõi thuần (founder 22/08).
 * Canh: bốc thăm TẤT ĐỊNH · mỗi bàn ≤1 đội lái/cá mập · người chỉ nhận vai
 * cho-người mùa này · mọi vai có ĐỦ bốn thứ (ghim, vốn, đặc quyền, giá).
 */
import { describe, expect, it } from 'vitest';
import { VAI, VAI_TAT_CA, bocThamVai, type VaiId } from '../server/holdem/vai.js';

describe('I. bảng vai — mỗi vai đủ bốn thứ, không vai nào "mạnh hơn" suông', () => {
  it('mọi vai có tên, vốn > 0, một câu đặc quyền và một câu cái giá', () => {
    for (const v of Object.values(VAI)) {
      expect(v.ten.length).toBeGreaterThan(0);
      expect(v.he_so_von).toBeGreaterThan(0);
      expect(v.dac_quyen.length).toBeGreaterThan(10);
      expect(v.cai_gia.length).toBeGreaterThan(10);
    }
  });

  it('vai vốn to PHẢI có một cái giá CẤU TRÚC: lõi ghim (mất một ô tự do) — không có bữa trưa miễn phí', () => {
    // Đo 22/08: vốn to KHÔNG còn là lợi thế (xếp hạng theo % tăng trưởng), nên cái
    // giá không nhất thiết là tác động giá > 1 — tổ chức trả bằng mandate + ghim.
    for (const v of Object.values(VAI)) {
      if (v.he_so_von > 1) expect(v.loi_ghim).not.toBeNull();
    }
    // Và vai ĐA SỐ (cá nhân) không được mang chiết khấu tác động giá — đo 22/08:
    // cá nhân ×0,5 làm ba vai còn lại bét bàn theo cấu trúc (5/8 ghế trả nửa phí).
    expect(VAI.ca_nhan.tac_dong_gia).toBe(1);
    expect(VAI.ca_map.tac_dong_gia).toBeGreaterThan(1);
  });

  it('đội lái ghim Lướt Sóng (đúng ví dụ founder); cá nhân KHÔNG ghim', () => {
    expect(VAI.doi_lai.loi_ghim).toBe('luot_song');
    expect(VAI.ca_nhan.loi_ghim).toBeNull();
  });

  it('NGƯỜI nhận ĐỦ BỐN vai (founder 22/08: "ghép người đủ trận thì phải cho player cầm đủ các vai")', () => {
    const choNguoi = Object.values(VAI).filter((v) => v.cho_nguoi).map((v) => v.id).sort();
    expect(choNguoi).toEqual(['ca_map', 'ca_nhan', 'doi_lai', 'to_chuc']);
    expect(VAI_TAT_CA.length).toBe(4);
  });
});

describe('II. bốc thăm — tất định, hỗn hợp, không cho chọn', () => {
  it('cùng seed ⇒ cùng bộ vai (replay ra y hệt)', () => {
    expect(bocThamVai(20260841, 8)).toEqual(bocThamVai(20260841, 8));
    expect(bocThamVai(20260841, 8)).not.toEqual(bocThamVai(20260842, 8));
  });

  it('bàn 8: đúng 1 đội lái · 1 cá mập · 1 tổ chức · 5 cá nhân', () => {
    const dem = (vs: VaiId[]) => vs.reduce((a, v) => ({ ...a, [v]: (a[v] ?? 0) + 1 }), {} as Record<string, number>);
    for (const seed of [1, 2, 3, 77, 999]) {
      expect(dem(bocThamVai(seed, 8))).toEqual({ doi_lai: 1, ca_map: 1, to_chuc: 1, ca_nhan: 5 });
    }
  });

  it('bàn 4: 1 vai đặc biệt (XOAY theo seed) + 3 cá nhân — bàn nhỏ không nhồi ba vai, nhưng không giấu vai nào', () => {
    const dacBiet = new Set<VaiId>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const vs = bocThamVai(seed, 4);
      const db = vs.filter((v) => v !== 'ca_nhan');
      expect(db).toHaveLength(1);
      expect(vs.filter((v) => v === 'ca_nhan')).toHaveLength(3);
      dacBiet.add(db[0]!);
    }
    expect([...dacBiet].sort()).toEqual(['ca_map', 'doi_lai', 'to_chuc']);
  });

  it('⭐ ghế 0 (NGƯỜI) bốc được CẢ BỐN vai qua 400 seed — không vai nào bị giấu khỏi người', () => {
    const thay = new Set<VaiId>();
    for (let seed = 1; seed <= 400; seed += 1) thay.add(bocThamVai(seed, 8)[0]!);
    expect([...thay].sort()).toEqual(['ca_map', 'ca_nhan', 'doi_lai', 'to_chuc']);
    // Thu hẹp tập cho-người (dùng để đo) thì ghế 0 vẫn tôn trọng tập đó.
    for (let seed = 1; seed <= 50; seed += 1) {
      expect(['ca_nhan', 'doi_lai']).toContain(bocThamVai(seed, 8, ['ca_nhan', 'doi_lai'])[0]);
    }
  });

  it('người có cơ hội làm ĐỘI LÁI thật sự (không phải lúc nào cũng cá nhân)', () => {
    let doiLai = 0;
    for (let seed = 1; seed <= 400; seed += 1) if (bocThamVai(seed, 8)[0] === 'doi_lai') doiLai += 1;
    // ~1/8 lần bốc trúng đội lái (mọi vai đều cho người nên không còn đổi chỗ).
    // Dải rộng để không giòn theo bộ sinh số.
    expect(doiLai).toBeGreaterThan(20);
    expect(doiLai).toBeLessThan(120);
  });
});
