/**
 * D43 BƯỚC 6 + §4.3 (v15) — chu kỳ có tính cách + lãi suất khẩn là điềm báo.
 * Gate 7.9 nằm trong file: hình dạng map phải PHÂN TÁN theo tham số rút được.
 */
import { describe, expect, it } from 'vitest';
import { CHU_KY, luatCua } from '../config/holdem.js';
import { sinhMap } from '../server/holdem/map.js';

const V15 = { lich: true, quanTinh: true, sucCang: true, chuKy: true, duoiTelegraph: true };
const HUONG = { tang: 1, phuc_hoi: 1, giam: -1, di_ngang: 0, bien_dong: 0 } as const;

function autocorrCua(maps: ReturnType<typeof sinhMap>[]): number {
  const x: number[] = []; const y: number[] = [];
  for (const m of maps) {
    const day = m.o.filter((o) => o.kind === 'giai_doan')
      .map((o) => (o.kind === 'giai_doan' ? HUONG[o.giai_doan] : 0));
    for (let i = 0; i + 1 < day.length; i += 1) { x.push(day[i]!); y.push(day[i + 1]!); }
  }
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let cov = 0; let vx = 0; let vy = 0;
  for (let i = 0; i < x.length; i += 1) {
    cov += (x[i]! - mx) * (y[i]! - my); vx += (x[i]! - mx) ** 2; vy += (y[i]! - my) ** 2;
  }
  return cov / Math.sqrt(vx * vy);
}

describe('bước 6 — ba tham số chu kỳ', () => {
  it('phân phối đều + tất định + v14 không có', () => {
    const dem = { s: [0, 0, 0], a: [0, 0, 0], x: [0, 0] };
    for (let seed = 1; seed <= 600; seed += 1) {
      const ck = sinhMap(seed, 12, V15).chu_ky!;
      dem.s[ck.speed]! += 1; dem.a[ck.amp]! += 1; dem.x[ck.asym]! += 1;
    }
    for (const c of dem.s) expect(c / 600).toBeGreaterThan(0.25);
    for (const c of dem.a) expect(c / 600).toBeGreaterThan(0.25);
    for (const c of dem.x) expect(c / 600).toBeGreaterThan(0.4);
    expect(sinhMap(9, 12, { lich: true, quanTinh: true, sucCang: true }).chu_ky)
      .toBeUndefined();
    expect(JSON.stringify(sinhMap(9, 12, V15))).toBe(JSON.stringify(sinhMap(9, 12, V15)));
  });

  it('gate 7.9 — map CHẬM lì hơn map NHANH rõ rệt (autocorr chênh ≥ 0,04)', () => {
    const cham: ReturnType<typeof sinhMap>[] = [];
    const nhanh: ReturnType<typeof sinhMap>[] = [];
    for (let seed = 1; seed <= 3000; seed += 1) {
      const m = sinhMap(seed, 12, V15);
      if (m.chu_ky!.speed === 0) cham.push(m);
      if (m.chu_ky!.speed === 2) nhanh.push(m);
    }
    expect(autocorrCua(cham) - autocorrCua(nhanh)).toBeGreaterThanOrEqual(0.04);
  });
});

describe('§4.3 — lãi suất ngoài lịch là điềm báo đuôi', () => {
  it('~75% ô ngoài lịch THẬT kéo thiên nga trong 2–3 ô; có cả báo động giả', () => {
    let diem = 0; let ungNghiem = 0;
    for (let seed = 1; seed <= 4000; seed += 1) {
      const m = sinhMap(seed, 12, V15);
      m.trang_thai!.forEach((t, i) => {
        if (!t.ngoai_lich) return;
        expect(t.telegraph_bps).toBe(CHU_KY.TELEGRAPH_TIN_CAY_BP);
        diem += 1;
        for (const j of [i + 2, i + 3]) {
          const o = m.o[j];
          if (o?.kind === 'su_kien' && o.su_kien === 'thien_nga_den' && !o.la_tin_gia) {
            ungNghiem += 1; break;
          }
        }
      });
    }
    expect(diem).toBeGreaterThan(50);
    const tyLe = ungNghiem / diem;
    // Trần lý thuyết 75% trừ hao ô ép bị né (đụng lịch/cuối map) — sàn 55%,
    // và PHẢI dưới 90%: điềm chắc chắn 100% là tín hiệu miễn phí (§4.2 cấm).
    expect(tyLe).toBeGreaterThan(0.55);
    expect(tyLe).toBeLessThan(0.9);
  });
});
