/**
 * D43 BƯỚC 2 — Ô LỊCH CHÍNH SÁCH + HÀM PHẢN ỨNG NỘI SINH (v11).
 *
 * Gate 7.6 nằm NGAY TRONG file này (mục cuối): bot theo dõi công thức công khai
 * phải đoán đúng hướng ~85% (trần = 1 − sai lầm), bot bấm bừa ≈ 33%, và cả ba
 * hướng phải THẬT SỰ xảy ra — hàm phản ứng chỉ ra một hướng là hàng trang trí.
 */
import { describe, expect, it } from 'vitest';
import { LICH_CHINH_SACH } from '../config/holdem.js';
import {
  huongChinhSachKyVong, sinhMap, type OThiTruong,
} from '../server/holdem/map.js';

const O_MAP_12 = LICH_CHINH_SACH.O_THEO_MAP[12]!;

describe('cấu trúc ô lịch', () => {
  it('v11: đúng các ô 4·9 (map 12) là ô lịch — lãi suất hoặc GIỮ NGUYÊN', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const m = sinhMap(seed, 12, true);
      for (const viTri of O_MAP_12) {
        const o = m.o[viTri - 1]!;
        const tt = m.trang_thai![viTri - 1]!;
        expect(tt.o_lich).toBe(true);
        expect(tt.huong_cs_ky_vong).toBeDefined();
        expect(tt.huong_cs_thuc).toBeDefined();
        if (o.kind === 'su_kien') {
          expect(['tang_lai_suat', 'ha_lai_suat']).toContain(o.su_kien);
          // Chính sách theo lịch không phải tin đồn.
          expect(o.la_tin_gia).toBe(false);
        } else {
          expect(o.giai_doan).toBe('di_ngang');
          expect(tt.huong_cs_thuc).toBe('giu');
        }
      }
      // Ô thường không được mang cờ lịch.
      const soLich = m.trang_thai!.filter((t) => t.o_lich).length;
      expect(soLich).toBe(O_MAP_12.length);
    }
  });

  it('không sự kiện nào đứng NGAY TRƯỚC ô lịch (hàm phản ứng phải tính được)', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const m = sinhMap(seed, 12, true);
      for (const viTri of O_MAP_12) {
        expect(m.o[viTri - 2]!.kind, `seed=${seed} ô=${viTri - 1}`)
          .toBe('giai_doan');
      }
    }
  });

  it('tắt cờ (≤ v10b) → không ô lịch nào, phân phối cũ nguyên vẹn', () => {
    // Gate 7.1 (holdem_map_regression) đã khoá byte-hệt; đây chỉ khoá cờ.
    const m = sinhMap(42, 12, false);
    expect(m.trang_thai!.every((t) => !t.o_lich)).toBe(true);
  });

  it('tất định: cùng seed → cùng map, cùng hướng chính sách', () => {
    const a = sinhMap(777, 12, true);
    const b = sinhMap(777, 12, true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('hàm phản ứng — đúng thứ tự ưu tiên v2 §4.2', () => {
  const gd = (g: 'di_ngang' | 'tang' | 'giam' | 'bien_dong' | 'phuc_hoi'): OThiTruong =>
    ({ kind: 'giai_doan', giai_doan: g });
  const sk = (id: 'lam_phat' | 'hack_san', gia = false): OThiTruong => ({
    kind: 'su_kien', su_kien: id, la_tin_gia: gia, bao_truoc: 'bien_dong',
    boi_canh: 'don_doc',
  });

  it('lạm phát THẬT trong cửa sổ → Tăng, kể cả khi thị trường đang giảm', () => {
    expect(huongChinhSachKyVong([gd('tang'), sk('lam_phat'), gd('giam')], 'giam'))
      .toBe('tang');
  });
  it('tin lạm phát GIẢ không kéo được chính sách', () => {
    expect(huongChinhSachKyVong([gd('tang'), sk('lam_phat', true), gd('tang')], 'tang'))
      .toBe('giu');
  });
  it('thị trường Giảm/Biến động hoặc cú sập thật → Hạ', () => {
    expect(huongChinhSachKyVong([gd('di_ngang'), gd('giam')], 'giam')).toBe('ha');
    expect(huongChinhSachKyVong([sk('hack_san'), gd('di_ngang')], 'di_ngang')).toBe('ha');
  });
  it('êm ả → GIỮ NGUYÊN', () => {
    expect(huongChinhSachKyVong([gd('di_ngang'), gd('tang')], 'tang')).toBe('giu');
  });
  it('sự kiện NGOÀI cửa sổ không còn tiếng nói', () => {
    const xa = [sk('lam_phat'), gd('tang'), gd('tang'), gd('di_ngang'), gd('tang')];
    expect(xa.length).toBeGreaterThan(LICH_CHINH_SACH.CUA_SO_O);
    expect(huongChinhSachKyVong(xa, 'tang')).toBe('giu');
  });
});

describe('gate 7.6 — ô lịch phải đọc được', () => {
  it('bot theo dõi ≈ 1−sai lầm; bot bừa ≈ 33%; đủ cả ba hướng', () => {
    let tong = 0;
    let dung = 0;
    const demHuong: Record<string, number> = { tang: 0, ha: 0, giu: 0 };
    for (let seed = 1; seed <= 1500; seed += 1) {
      const m = sinhMap(seed, 12, true);
      for (const viTri of O_MAP_12) {
        const tt = m.trang_thai![viTri - 1]!;
        tong += 1;
        // Bot theo dõi: tự tính từ các ô ĐÃ LỘ — đúng công thức công khai.
        const doan = huongChinhSachKyVong(m.o.slice(0, viTri - 1), tt.giai_doan_nen);
        expect(doan).toBe(tt.huong_cs_ky_vong);
        if (doan === tt.huong_cs_thuc) dung += 1;
        demHuong[tt.huong_cs_thuc!]! += 1;
      }
    }
    const tyLeDung = dung / tong;
    // Trần lý thuyết 85% (sai lầm 15%); sàn gate 7.6 là 80%.
    expect(tyLeDung).toBeGreaterThanOrEqual(0.80);
    expect(tyLeDung).toBeLessThanOrEqual(0.90);
    // Bot bấm bừa (uniform 3 hướng) đúng 1/3 theo cấu trúc — và khoảng cách
    // với bot theo dõi phải RÕ, không phải một phần trăm lẻ.
    expect(tyLeDung - 1 / 3).toBeGreaterThan(0.4);
    // Không hướng nào thoái hoá về 0 — mỗi hướng phải chiếm ≥ 3% số kỳ họp
    // (hướng 'tang' hiếm nhất: cần đúng chuỗi lạm phát thật trong cửa sổ).
    for (const h of ['tang', 'ha', 'giu'] as const) {
      expect(demHuong[h]! / tong, `hướng ${h}`).toBeGreaterThan(0.03);
    }
  });
});
