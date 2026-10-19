/**
 * GHÉP BÀN XẾP HẠNG ≥ 4 NGƯỜI THẬT — TOÁN THUẦN (SPEC alpha-draft-tang-khong-gian mục 6, founder CHỐT 11/10; design_rank §7.3–7.5, §2.10).
 *
 * Bài này canh những thứ founder đã chốt bằng SỐ chép tay từ SPEC (đề bài, không phải kết quả của code):
 *   §I   n < 4 người thật ⇒ không mở bàn · n ≥ 4 ⇒ k = ⌈n/20⌉ bàn chia ĐỀU, không bao giờ để 1–3 người lẻ.
 *   §II  máy = min(m−1, 20−m): máy luôn ít hơn người, trần 20 ghế — quét MỌI m ∈ [1,20] × MỌI cỡ bốc.
 *   §III bảng cỡ bàn theo bậc (7 hàng × 5 mốc) chép tay + tần suất bốc khớp bảng + bốc theo bậc THẤP NHẤT trong bàn.
 *   §IV  kế hoạch ghép tất định: cùng đầu vào ⇒ cùng bàn; đảo thứ tự đăng ký ⇒ không đổi; client không chọn được chỗ.
 *   §V   điểm khi có máy CHỈ tính cặp người–người: zero-sum, hoà không chuyển điểm, vắng về đáy.
 *   §VI  suất 15 phút + điểm ghép có sàn chống thả rank.
 *
 * ⚠ Kiểm KHOẢNG / QUAN HỆ ở chỗ có thể, chỉ so số cứng ở chỗ số là ĐỀ BÀI (bảng founder chốt).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CO_BAN_MOC, CO_BAN_THEO_BAC, VAI_THEO_CO_BAN } from '../config/holdem.js';
import { deltaTheoTang, deltaTran, K } from '../config/rank.js';
import { taoBam, vaiChoGheNguoi } from '../server/rank_ghep.js';
import type { VaiId } from '../server/holdem/vai.js';
import {
  GHEP_BAN, bocCoBan, chiaDeu, diemGhep, ghepBanBat, keHoachGhep, laGioSuat, mocVaiCuaBan, soBan, soGheBan, soMayToiDa,
  suatKeTiep, tangHang, type DangKy, type KetQuaNguoi,
} from '../config/rank_ghep.js';

/** Băm giống server (SHA-256 có secret + slot). Test dùng secret riêng. */
const bamMau = (slot = '2026-10-12T03:00:00.000Z', secret = 'secret-test-ghep') => (s: string): number =>
  createHash('sha256').update(`${secret}|${slot}|${s}`).digest().readUInt32BE(0);

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x1_0000_0000; };
}

const dk = (n: number, tao: (i: number) => Partial<DangKy> = () => ({})): DangKy[] =>
  Array.from({ length: n }, (_, i) => ({ userId: `u${String(i).padStart(3, '0')}`, diemGhep: 0, bacSo: 1, dangKyLuc: i, ...tao(i) }));

describe('§I — số bàn: < 4 người thật thì không mở, ≥ 4 thì ⌈n/20⌉ bàn chia đều', () => {
  it('⭐ vector chép tay: n=3 ⇒ 0 bàn · 4 ⇒ 1 · 20 ⇒ 1 · 21 ⇒ 2 · 40 ⇒ 2 · 41 ⇒ 3 · 61 ⇒ 4', () => {
    const mong: [number, number][] = [[0, 0], [1, 0], [3, 0], [4, 1], [20, 1], [21, 2], [40, 2], [41, 3], [60, 3], [61, 4]];
    for (const [n, k] of mong) expect(soBan(n), `n=${n}`).toBe(k);
  });

  it('⭐ 3 người thật ⇒ kế hoạch "thiếu người": KHÔNG có bàn nào, KHÔNG ai bị hoãn; 4 ⇒ ghép', () => {
    for (let n = 0; n <= 3; n += 1) {
      const kh = keHoachGhep(dk(n), bamMau());
      expect(kh.trangThai).toBe('thieu_nguoi');
      expect(kh.ban).toEqual([]);
      expect(kh.hoan).toEqual([]);
    }
    expect(keHoachGhep(dk(GHEP_BAN.SO_NGUOI_TOI_THIEU), bamMau()).trangThai).toBe('ghep');
    expect(GHEP_BAN.SO_NGUOI_TOI_THIEU).toBe(4);
  });

  it('⭐ chia đều: (21→11+10) (41→14+14+13) và với MỌI n∈[4,600] hiệu hai bàn ≤ 1, bàn nhỏ nhất ≥ 4, lớn nhất ≤ 20 — không bao giờ 1–3 người lẻ', () => {
    expect(chiaDeu(21, 2)).toEqual([11, 10]);
    expect(chiaDeu(41, 3)).toEqual([14, 14, 13]);
    for (let n = 4; n <= 600; n += 1) {
      const k = soBan(n);
      const c = chiaDeu(n, k);
      expect(c.reduce((a, b) => a + b, 0), `n=${n}`).toBe(n);
      expect(Math.max(...c) - Math.min(...c), `n=${n}`).toBeLessThanOrEqual(1);
      expect(Math.min(...c), `n=${n} có bàn lẻ`).toBeGreaterThanOrEqual(4);
      expect(Math.max(...c), `n=${n}`).toBeLessThanOrEqual(20);
    }
  });
});

describe('§II — máy luôn ÍT HƠN người, tổng ghế ≤ 20', () => {
  it('⭐ vector chép tay từ SPEC: 4→+3 (7 ghế) · 8→+7 (15) · 10→+9 (19) · 11→+9 (20) · 20→+0', () => {
    expect([4, 8, 10, 11, 20].map(soMayToiDa)).toEqual([3, 7, 9, 9, 0]);
    expect(soGheBan(4, 20)).toBe(7);
    expect(soGheBan(8, 20)).toBe(15);
    expect(soGheBan(10, 20)).toBe(19);
    expect(soGheBan(11, 20)).toBe(20);
    expect(soGheBan(20, 20)).toBe(20);
  });

  it('⭐ n người ⇒ bot ≤ n−1 VÀ ≤ 20−n; quét m∈[1,20] × cỡ bốc {4,8,12,16,20}: máy < người, ghế ≤ 20, người thật không bị loại', () => {
    for (let m = 1; m <= 20; m += 1) {
      for (const co of CO_BAN_MOC) {
        const ghe = soGheBan(m, co);
        const may = ghe - m;
        expect(may, `m=${m} co=${co}`).toBeGreaterThanOrEqual(0);
        expect(may, `m=${m} co=${co}: máy ≤ m−1`).toBeLessThanOrEqual(m - 1);
        expect(may, `m=${m} co=${co}: máy ≤ 20−m`).toBeLessThanOrEqual(20 - m);
        expect(may).toBeLessThanOrEqual(soMayToiDa(m));
        expect(ghe).toBeLessThanOrEqual(20);
        expect(ghe).toBeGreaterThanOrEqual(m);
      }
    }
  });

  it('thiếu người thật để giữ máy < người ⇒ CO LẠI: 4 người bốc cỡ 20 ⇒ 7 ghế (3 máy); 5 người bốc 12 ⇒ 9; bốc cỡ NHỎ hơn số người ⇒ không máy', () => {
    expect(soGheBan(4, 12)).toBe(7);
    expect(soGheBan(5, 12)).toBe(9);
    expect(soGheBan(4, 4)).toBe(4);
    expect(soGheBan(10, 4)).toBe(10);
    expect(soGheBan(6, 8)).toBe(8);
  });

  it('mốc áp bảng vai: ghế giữa hai mốc ⇒ hàng của mốc NHỎ HƠN (7→4 · 11→8 · 15→12 · 19→16)', () => {
    expect([4, 7, 8, 11, 12, 15, 16, 19, 20].map(mocVaiCuaBan)).toEqual([4, 4, 8, 8, 12, 12, 16, 16, 20]);
  });
});

describe('§III — cỡ bàn 4/8/12/16/20 mở khoá theo bậc (bảng founder CHỐT 11/10, PLAYTEST-TUNE)', () => {
  const BANG_TAY: Record<number, number[]> = {
    1: [75, 25, 0, 0, 0],      // SẮT
    2: [55, 35, 10, 0, 0],     // ĐỒNG
    3: [40, 38, 20, 2, 0],     // BẠC
    4: [25, 37, 30, 8, 0],     // VÀNG
    5: [15, 30, 35, 18, 2],    // BẠCH KIM
    6: [10, 22, 35, 28, 5],    // KIM CƯƠNG
    7: [5, 15, 30, 40, 10],    // ELITE
  };

  it('⭐ bảng chép tay từ SPEC: đúng 7 hàng × 5 mốc, mỗi hàng tổng 100', () => {
    expect([...CO_BAN_MOC]).toEqual([4, 8, 12, 16, 20]);
    expect(Object.keys(CO_BAN_THEO_BAC).map(Number).sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const [bac, hang] of Object.entries(BANG_TAY)) {
      expect([...CO_BAN_THEO_BAC[Number(bac)]!], `bậc ${bac}`).toEqual(hang);
      expect(hang.reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  it('nguyên tắc TFT: cỡ 20 chỉ từ Bạch Kim và luôn hiếm (≤ 10 %, không bao giờ là đỉnh); cỡ 16 từ Bạc; đỉnh dịch lên theo bậc', () => {
    for (const bac of [1, 2, 3, 4]) expect(CO_BAN_THEO_BAC[bac]![4], `bậc ${bac} chưa có bàn 20`).toBe(0);
    for (const bac of [5, 6, 7]) {
      const h = CO_BAN_THEO_BAC[bac]!;
      expect(h[4]).toBeGreaterThan(0);
      expect(h[4], `bậc ${bac}: bàn 20 hiếm hơn bàn 16 và không bao giờ là đỉnh`).toBeLessThan(h[3]!);
      expect(h[4], `bậc ${bac}: bàn 20 không là đỉnh`).toBeLessThan(Math.max(...h));
      expect(h[4], `bậc ${bac}: bàn 20 tối đa 10 %`).toBeLessThanOrEqual(10);
    }
    expect(CO_BAN_THEO_BAC[1]![3]).toBe(0);
    expect(CO_BAN_THEO_BAC[3]![3]).toBeGreaterThan(0);
    const dinh = (bac: number) => CO_BAN_THEO_BAC[bac]!.indexOf(Math.max(...CO_BAN_THEO_BAC[bac]!));
    for (let bac = 2; bac <= 7; bac += 1) expect(dinh(bac), `đỉnh bậc ${bac} không tụt`).toBeGreaterThanOrEqual(dinh(bac - 1));
  });

  it('⭐ bốc theo cỡ: ngưỡng cộng dồn đúng ở biên (SẮT u=0,74→4 · 0,75→8 · ELITE u=0,05→8 · 0,89→16 · 0,90→20)', () => {
    expect(bocCoBan(1, 0.74)).toBe(4);
    expect(bocCoBan(1, 0.75)).toBe(8);
    expect(bocCoBan(1, 0.999)).toBe(8);
    expect(bocCoBan(7, 0.049)).toBe(4);
    expect(bocCoBan(7, 0.05)).toBe(8);
    expect(bocCoBan(7, 0.89)).toBe(16);
    expect(bocCoBan(7, 0.90)).toBe(20);
    // "chưa xếp" (bậc số 0) tính bậc 1 — không bốc được cỡ lớn bằng cách chưa từng chơi.
    expect(bocCoBan(0, 0.999)).toBe(8);
  });

  it('⭐ Monte Carlo 60.000 lần/bậc: tần suất cỡ bàn khớp bảng trong ±1,2 điểm %', () => {
    const r = rng(20261011);
    for (let bac = 1; bac <= 7; bac += 1) {
      const dem = [0, 0, 0, 0, 0];
      const N = 60_000;
      for (let i = 0; i < N; i += 1) dem[CO_BAN_MOC.indexOf(bocCoBan(bac, r()) as 4)]! += 1;
      for (let j = 0; j < 5; j += 1) {
        expect(Math.abs((100 * dem[j]!) / N - BANG_TAY[bac]![j]!), `bậc ${bac} cỡ ${CO_BAN_MOC[j]}`).toBeLessThan(1.2);
      }
    }
  });

  it('⭐ nhóm bốc theo bậc THẤP NHẤT: một bàn có 1 Sắt + 3 Elite KHÔNG bao giờ ra bàn 12+ (hàng Sắt không có), bàn 4 Elite thì có', () => {
    const bam = bamMau();
    const manh = keHoachGhep(dk(4, () => ({ bacSo: 7 })), bam);
    const lan = keHoachGhep(dk(4, (i) => ({ bacSo: i === 0 ? 1 : 7 })), bam);
    expect(lan.ban[0]!.bacThap).toBe(1);
    expect(manh.ban[0]!.bacThap).toBe(7);
    for (let slot = 0; slot < 300; slot += 1) {
      const b = bamMau(new Date(Date.UTC(2026, 9, 12, 3, 0) + slot * 900_000).toISOString());
      const k = keHoachGhep(dk(12, (i) => ({ bacSo: i === 0 ? 1 : 7 })), b).ban[0]!;
      expect(k.coBanBoc, `slot ${slot}`).toBeLessThanOrEqual(8);   // hàng SẮT chỉ có 4 và 8
    }
  });
});

describe('§IV — kế hoạch ghép tất định, client không chọn được chỗ ngồi', () => {
  it('⭐ n ngẫu nhiên 4..120: mọi người đúng MỘT chỗ · ⌈n/20⌉ bàn · máy < người · ghế ≤ 20 · bàn nhỏ nhất ≥ 4', () => {
    const r = rng(7);
    for (let lan = 0; lan < 300; lan += 1) {
      const n = 4 + Math.floor(r() * 117);
      const d = dk(n, () => ({ diemGhep: Math.floor(r() * 2000) - 200, bacSo: 1 + Math.floor(r() * 7) }));
      const kh = keHoachGhep(d, bamMau(`slot-${lan}`), 99);
      expect(kh.trangThai).toBe('ghep');
      expect(kh.ban).toHaveLength(Math.ceil(n / 20));
      const thay = kh.ban.flatMap((b) => b.nguoi);
      expect(new Set(thay).size).toBe(n);
      expect([...thay].sort()).toEqual(d.map((x) => x.userId).sort());
      for (const b of kh.ban) {
        expect(b.soNguoi).toBe(b.nguoi.length);
        expect(b.soNguoi).toBeGreaterThanOrEqual(4);
        expect(b.soMay).toBeLessThan(b.soNguoi);
        expect(b.soMay).toBeLessThanOrEqual(soMayToiDa(b.soNguoi));
        expect(b.soGhe).toBe(b.soNguoi + b.soMay);
        expect(b.soGhe).toBeLessThanOrEqual(20);
        expect(Number.isInteger(b.seed) && b.seed >= 0 && b.seed <= 0xffffffff).toBe(true);
      }
    }
  });

  it('⭐ 4 người ⇒ mở bàn, máy ≤ 3 (SPEC mục 4.3); quét 500 suất: không lần nào > 3 máy, và có lần đủ 3 máy lẫn 0 máy', () => {
    const co = new Set<number>();
    for (let i = 0; i < 500; i += 1) {
      const kh = keHoachGhep(dk(4, () => ({ bacSo: 6 })), bamMau(`s${i}`));
      expect(kh.ban).toHaveLength(1);
      expect(kh.ban[0]!.soMay).toBeLessThanOrEqual(3);
      co.add(kh.ban[0]!.soMay);
    }
    expect(co.has(0) && co.has(3)).toBe(true);
  });

  it('tất định: cùng đầu vào + cùng băm ⇒ cùng kế hoạch; ĐẢO thứ tự đăng ký ⇒ không đổi gì (client không có input nào tác động chỗ ngồi)', () => {
    const r = rng(99);
    const d = dk(37, () => ({ diemGhep: Math.floor(r() * 300), bacSo: 1 + Math.floor(r() * 7) }));
    const a = keHoachGhep(d, bamMau('x'), 99);
    expect(keHoachGhep(d, bamMau('x'), 99)).toEqual(a);
    const dao = [...d].reverse();
    // dangKyLuc chỉ dùng khi vượt trần → với choTrong đủ lớn, thứ tự mảng không được ảnh hưởng.
    expect(keHoachGhep(dao, bamMau('x'), 99)).toEqual(a);
    // Khác slot/secret ⇒ khác bàn (băm có tác dụng) — không phải mọi lần đều giống nhau.
    const khac = keHoachGhep(d, bamMau('y'), 99);
    expect(khac.ban.map((b) => b.seed)).not.toEqual(a.ban.map((b) => b.seed));
  });

  it('sàn chống thả rank: điểm ghép = max(điểm, đỉnh − 150) — dìm điểm xuống không đổi mốc ghép quá 150', () => {
    expect(GHEP_BAN.BIEN_TRUOT).toBe(150);
    expect(diemGhep(400, 400)).toBe(400);
    expect(diemGhep(100, 400)).toBe(250);       // thả từ 400 xuống 100 ⇒ vẫn ghép như 250
    expect(diemGhep(-300, 200)).toBe(50);
    expect(diemGhep(300, 400)).toBe(300);       // tụt tự nhiên < 150 ⇒ giữ điểm thật
  });

  it('bàn được xếp theo điểm ghép: người mạnh nhất ở bàn đầu, yếu nhất ở bàn cuối (khúc liên tục)', () => {
    const d = dk(40, (i) => ({ diemGhep: 1000 - i * 10 }));
    const kh = keHoachGhep(d, bamMau(), 99);
    expect(kh.ban).toHaveLength(2);
    const diem = (u: string) => d.find((x) => x.userId === u)!.diemGhep;
    expect(Math.min(...kh.ban[0]!.nguoi.map(diem))).toBeGreaterThan(Math.max(...kh.ban[1]!.nguoi.map(diem)));
  });

  it('⭐ trần bàn rank đồng thời (§7.6): hết chỗ ⇒ hoãn CẢ suất, còn 1 chỗ & 45 người ⇒ giữ 20 người đăng ký SỚM, 25 người sang suất sau', () => {
    const het = keHoachGhep(dk(8), bamMau(), 0);
    expect(het.ban).toEqual([]);
    expect(het.hoan).toHaveLength(8);
    const d = dk(45);
    const kh = keHoachGhep(d, bamMau(), 1);
    expect(kh.ban).toHaveLength(1);
    expect(kh.ban[0]!.soNguoi).toBe(20);
    expect(kh.hoan).toHaveLength(25);
    const giu = new Set(kh.ban[0]!.nguoi);
    for (const u of d.slice(0, 20)) expect(giu.has(u.userId)).toBe(true);      // 20 người đầu (dangKyLuc nhỏ nhất)
    for (const u of kh.hoan) expect(giu.has(u)).toBe(false);
    expect(GHEP_BAN.TRAN_BAN_DONG_THOI).toBe(4);
  });
});

describe('§V — điểm khi có máy: CHỈ cặp người–người (B3, §2.10), zero-sum', () => {
  const kq = (u: string, nav: number, p: Partial<KetQuaNguoi> = {}): KetQuaNguoi => ({ userId: u, xong: true, dauHang: false, nav, ...p });

  it('mỗi người một tầng ⇒ TRÙNG ĐÚNG `deltaTran` của bàn toàn người (vector tay §2.4: 4 người cùng bậc = +30 +10 −10 −30)', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const bac = { a: 4, b: 4, c: 4, d: 4 };
    const d = deltaTheoTang(ids.map((x) => [x]), bac);
    expect(ids.map((x) => d[x])).toEqual([30, 10, -10, -30]);
    expect(d).toEqual(deltaTran(ids, bac));
  });

  it('biên độ: bàn 4 người cùng bậc nhận tối đa K/2 × 3 cặp = 30 — số máy ngồi cùng bàn không có chỗ nào để cộng thêm (phép tính chỉ nhận NGƯỜI)', () => {
    const tang = tangHang([kq('a', 1500), kq('b', 1200), kq('c', 1100), kq('d', 900)]);
    const d = deltaTheoTang(tang, { a: 3, b: 3, c: 3, d: 3 });
    expect(Math.max(...Object.values(d))).toBe((K / 2) * 3);
    expect(Math.min(...Object.values(d))).toBe(-(K / 2) * 3);
  });

  it('⭐ 20.000 nhóm ngẫu nhiên (4..20 người, hoà, đầu hàng, vắng): tổng delta luôn 0 và mọi người đều có mặt', () => {
    const r = rng(31415);
    let vo = 0;
    for (let lan = 0; lan < 20_000; lan += 1) {
      const m = 4 + Math.floor(r() * 17);
      const nguoi: KetQuaNguoi[] = Array.from({ length: m }, (_, i) => ({
        userId: `p${i}`, xong: r() > 0.2, dauHang: r() > 0.85, nav: 800 + Math.floor(r() * 5) * 100,
      }));
      const bac = Object.fromEntries(nguoi.map((x) => [x.userId, 1 + Math.floor(r() * 7)]));
      const tang = tangHang(nguoi);
      const d = deltaTheoTang(tang, bac);
      if (Object.values(d).reduce((a, b) => a + b, 0) !== 0) vo += 1;
      expect(Object.keys(d).length).toBe(m);
    }
    expect(vo).toBe(0);
  });

  it('hoà NAV ⇒ cùng tầng ⇒ cặp đó chuyển 0; đầu hàng thua mọi người chưa đầu hàng; vắng nằm dưới đầu hàng', () => {
    const t = tangHang([kq('a', 1000), kq('b', 1000), kq('c', 700), kq('d', 5000, { dauHang: true }), kq('e', 0, { xong: false })]);
    expect(t).toEqual([['a', 'b'], ['c'], ['d'], ['e']]);
    const bac = { a: 4, b: 4, c: 4, d: 4, e: 4 };
    const d = deltaTheoTang(t, bac);
    expect(d.a).toBe(d.b);
    expect(d.e).toBeLessThan(d.d!);
    expect(d.d).toBeLessThan(d.c!);
    // a và b hoà nhau ⇒ cặp (a,b) chuyển 0: mỗi người chỉ ăn 3 cặp (c,d,e) = 3 × 10
    expect(d.a).toBe(30);
  });

  it('chênh bậc: người bậc thấp thắng người bậc cao được NHIỀU hơn (cùng công thức p() của `deltaTran`)', () => {
    const yeuThang = deltaTheoTang([['y'], ['m']], { y: 1, m: 7 });
    const manhThang = deltaTheoTang([['m'], ['y']], { y: 1, m: 7 });
    expect(yeuThang.y!).toBeGreaterThan(manhThang.m!);
  });
});

describe('§VI — suất đấu 15 phút', () => {
  it('⭐ suất kế tiếp nghiêm ngặt SAU now, đúng :00 :15 :30 :45; đúng giờ suất thì nhảy sang suất sau', () => {
    const t = (s: string) => new Date(s);
    expect(suatKeTiep(t('2026-10-12T03:00:00.000Z')).toISOString()).toBe('2026-10-12T03:15:00.000Z');
    expect(suatKeTiep(t('2026-10-12T03:14:59.999Z')).toISOString()).toBe('2026-10-12T03:15:00.000Z');
    expect(suatKeTiep(t('2026-10-12T03:15:00.000Z')).toISOString()).toBe('2026-10-12T03:30:00.000Z');
    expect(suatKeTiep(t('2026-10-12T03:46:10.000Z')).toISOString()).toBe('2026-10-12T04:00:00.000Z');
    expect(suatKeTiep(t('2026-10-12T23:50:00.000Z')).toISOString()).toBe('2026-10-13T00:00:00.000Z');
    expect(laGioSuat(t('2026-10-12T03:45:00.000Z'))).toBe(true);
    expect(laGioSuat(t('2026-10-12T03:44:00.000Z'))).toBe(false);
    expect(laGioSuat(t('2026-10-12T03:45:00.001Z'))).toBe(false);
    expect(GHEP_BAN.PHUT_MOI_SUAT).toBe(15);
  });

  it('cờ TẮT mặc định; bật bằng RANK_GHEP_BAT=1 (không đổi hằng trong mã)', () => {
    expect(GHEP_BAN.BAT).toBe(false);
    expect(ghepBanBat({})).toBe(false);
    expect(ghepBanBat({ RANK_GHEP_BAT: '1' })).toBe(true);
    expect(ghepBanBat({ RANK_GHEP_BAT: '0' })).toBe(false);
  });
});

describe('bảng vai theo cỡ bàn — dữ liệu (chép tay từ SPEC)', () => {
  it('⭐ 5 mốc: bàn 4 [30]·[] · 8 [45,20]·[20] · 12 [55,35,15]·[35,10] · 16 [60,45,25,10]·[45,20] · 20 [65,50,35,20]·[55,30]', () => {
    expect(Object.keys(VAI_THEO_CO_BAN).map(Number)).toEqual([4, 8, 12, 16, 20]);
    expect(VAI_THEO_CO_BAN[4]).toEqual({ cmdl: [30], tc: [] });
    expect(VAI_THEO_CO_BAN[8]).toEqual({ cmdl: [45, 20], tc: [20] });
    expect(VAI_THEO_CO_BAN[12]).toEqual({ cmdl: [55, 35, 15], tc: [35, 10] });
    expect(VAI_THEO_CO_BAN[16]).toEqual({ cmdl: [60, 45, 25, 10], tc: [45, 20] });
    expect(VAI_THEO_CO_BAN[20]).toEqual({ cmdl: [65, 50, 35, 20], tc: [55, 30] });
  });
});

describe('§VII — vai của từng người trong bàn ghép', () => {
  const VAI: VaiId[] = ['ca_nhan', 'ca_map', 'to_chuc', 'ca_nhan', 'doi_lai', 'ca_nhan'];
  it('⭐ ghế `ban` của người thứ j mang ĐÚNG vai chỗ j; tập vai cả bàn là một (chỉ khác ai cầm vai nào) — quét mọi j', () => {
    for (let j = 0; j < 4; j += 1) {
      const v = vaiChoGheNguoi(VAI, j);
      expect(v).toHaveLength(VAI.length);
      expect(v[0]).toBe(VAI[j]);
      expect([...v].sort()).toEqual([...VAI].sort());
    }
  });
  it('các ghế còn lại giữ thứ tự bàn (bỏ chỗ j): người 1 thấy ca_nhan · to_chuc · ca_nhan · doi_lai · ca_nhan', () => {
    expect(vaiChoGheNguoi(VAI, 1)).toEqual(['ca_map', 'ca_nhan', 'to_chuc', 'ca_nhan', 'doi_lai', 'ca_nhan']);
  });
  it('băm có secret: cùng (secret, slot, chuỗi) ⇒ cùng số; đổi secret hoặc slot ⇒ khác', () => {
    const a = taoBam(new Date('2026-10-12T03:15:00Z'), 'bi-mat-1');
    expect(a('x')).toBe(taoBam(new Date('2026-10-12T03:15:00Z'), 'bi-mat-1')('x'));
    expect(a('x')).not.toBe(taoBam(new Date('2026-10-12T03:15:00Z'), 'bi-mat-2')('x'));
    expect(a('x')).not.toBe(taoBam(new Date('2026-10-12T03:30:00Z'), 'bi-mat-1')('x'));
  });
});
