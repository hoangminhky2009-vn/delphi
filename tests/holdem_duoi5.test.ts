/**
 * D43 BƯỚC 7 (v16) — 5 mặt đuôi thay thẻ Thiên nga đen. Hai bất biến đắt nhất:
 * NGÂN SÁCH P_TAIL BẢO TOÀN (không đặt số mới) và trận cũ nguyên vẹn.
 */
import { describe, expect, it } from 'vitest';
import { DUOI_5MAT, luatCua } from '../config/holdem.js';
import { sinhMap } from '../server/holdem/map.js';

const V15 = { lich: true, quanTinh: true, sucCang: true, chuKy: true, duoiTelegraph: true };
const V16 = { ...V15, duoi5: true };
const DUOI = Object.keys(DUOI_5MAT);

describe('ngân sách đuôi bảo toàn + phân bố 30/25/20/15/10', () => {
  it('tổng tần suất 5 mặt v16 ≈ tần suất thiên nga v15 (±20% tương đối)', () => {
    let nga15 = 0; let duoi16 = 0; let o15 = 0; let o16 = 0;
    const dem: Record<string, number> = Object.fromEntries(DUOI.map((d) => [d, 0]));
    for (let seed = 1; seed <= 4000; seed += 1) {
      for (const o of sinhMap(seed, 12, V15).o) {
        o15 += 1;
        if (o.kind === 'su_kien' && o.su_kien === 'thien_nga_den') nga15 += 1;
      }
      for (const o of sinhMap(seed, 12, V16).o) {
        o16 += 1;
        if (o.kind === 'su_kien' && DUOI.includes(o.su_kien)) {
          duoi16 += 1;
          dem[o.su_kien]! += 1;
        }
        // v16: thiên nga TUYỆT CHỦNG khỏi bộ bài.
        if (o.kind === 'su_kien') expect(o.su_kien).not.toBe('thien_nga_den');
      }
    }
    const p15 = nga15 / o15;
    const p16 = duoi16 / o16;
    expect(Math.abs(p16 - p15) / p15).toBeLessThan(0.2);
    // Thứ tự tần suất đúng bảng 30/25/20/15/10 — "tần suất giảm dần".
    expect(dem.phap_ly!).toBeGreaterThan(dem.pha_san!);
    expect(dem.pha_san!).toBeGreaterThan(dem.cam_van!);
    expect(dem.cam_van!).toBeGreaterThan(dem.tham_hoa!);
    expect(dem.tham_hoa!).toBeGreaterThan(dem.dich_benh!);
  });

  it('v15 nguyên vẹn: vẫn rút thiên nga, không mặt mới nào lọt', () => {
    let nga = 0;
    for (let seed = 1; seed <= 800; seed += 1) {
      for (const o of sinhMap(seed, 12, V15).o) {
        if (o.kind !== 'su_kien') continue;
        expect(DUOI.includes(o.su_kien)).toBe(false);
        if (o.su_kien === 'thien_nga_den') nga += 1;
      }
    }
    expect(nga).toBeGreaterThan(0);
  });

  it('điềm báo v16 ép MẶT MỚI (không còn ép thiên nga); tail_face ghi mặt đuôi', () => {
    let epMoi = 0;
    for (let seed = 1; seed <= 3000; seed += 1) {
      const m = sinhMap(seed, 12, V16);
      m.trang_thai!.forEach((t) => {
        if (t.tail_face) {
          expect(DUOI.includes(t.tail_face)).toBe(true);
          epMoi += 1;
        }
      });
    }
    expect(epMoi).toBeGreaterThan(100);
  });

  it('v16 trong bảng luật: duoi5 bật, các bản cũ tắt', () => {
    expect(luatCua('balance-v16-duoi5').duoi5).toBe(true);
    expect(luatCua('balance-v15-chuky').duoi5).toBe(false);
  });
});
