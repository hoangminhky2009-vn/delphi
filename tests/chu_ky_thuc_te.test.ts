/**
 * CHU KỲ THỰC TẾ — cổng `balance-v39-thucte` (D301).
 *
 * Founder 07/09: máy sinh ô phải "mô phỏng sát chu kỳ kinh tế ngoài đời nhất", và
 * "mỗi chu kỳ đều phải có nguồn dữ liệu để dựa vào làm xác suất tương đối". Thang:
 * 1 ô = 6 tháng (12 ô ≈ 74,5 tháng = một chu kỳ NBER). Nguồn + quy đổi của từng số:
 * `docs/thiet-ke-de-xuat/gameplay/chu-ky-thuc-te-nguon-va-quy-doi.md` và chú thích
 * cạnh `REGIME_TICK_THUC_TE` / `BONG_BONG_PHONG_TIEP_BP` / `TY_LE_TIN_GIA_THUC_TE`.
 *
 *   §I   CỔNG — v39 = v38 + đúng MỘT cờ (bản mới xếp chồng mọi cờ cũ); mọi bản cũ tắt.
 *   §II  BYTE-HỆT — hash 300 map × 3 cỡ của bốn bản đang sống KHOÁ TRƯỚC khi sửa map.ts
 *        (đo 07/09 bằng cùng công thức). Đây là bằng chứng cờ tắt = không xê dịch một cú rút.
 *   §III MỤC TIÊU CÓ NGUỒN — mỗi bài ghi nguồn + quy đổi; ngưỡng là dải quanh số nguồn,
 *        đo trên bàn 12/16 (bàn 8 giữ hồ sơ "ngắn & căng" D177, cố ý không đo).
 *   §IV  HIỆU LỰC — v39 khác được v38; kỳ họp GIỮ thôi cắt chuỗi (gốc của hazard 44%).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  BO_LUAT_THEO_PHIEN_BAN, HOLDEM_DECISIONS, REGIME_TICK, REGIME_TICK_GOC, REGIME_TICK_THUC_TE,
  TY_LE_TIN_GIA_THEO_BOI_CANH, TY_LE_TIN_GIA_THUC_TE, luatCua, moiTruongTienTe,
  thamSoBongBong, thamSoTick, tyLeTinGiaHieuDung,
} from '../config/holdem.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { sinhMap } from '../server/holdem/map.js';

const V39 = 'balance-v39-thucte';
const V36 = 'balance-v36-regime';
const soCua = (t: string) => Number(/balance-v(\d+)/.exec(t)?.[1] ?? 0);
const seedI = (s: number) => (s * 2654435761) >>> 0;

describe('I. Cổng — v39 = v38 + đúng MỘT cờ', () => {
  it('⭐⭐ chuKyThucTe = false ở TỪNG entry trừ v39 (bật ở bản cũ = đổi map trận đã lưu)', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      if (soCua(ten) >= 39) expect(luat.chuKyThucTe, `"${ten}" từ mốc trở đi phải bật`).toBe(true);
      else expect(luat.chuKyThucTe, `"${ten}" bật cờ`).not.toBe(true);
    }
    expect(luatCua(null).chuKyThucTe).toBe(false);
    expect(luatCua('phien-ban-khong-ton-tai').chuKyThucTe).toBe(false);
    expect(soCua(V39)).toBe(39);
  });
  it('v39 khác v38 ĐÚNG một cờ — bản mới xếp chồng mọi cờ cũ (quy ước bảng), hiệu ứng bộ số đọc bằng v38 ↔ v39', () => {
    const a = luatCua('balance-v38-doixung') as unknown as Record<string, boolean>;
    const b = luatCua(V39) as unknown as Record<string, boolean>;
    const khac = Object.keys(b).filter((k) => a[k] !== b[k]);
    expect(khac).toEqual(['chuKyThucTe']);
  });
  it('một cửa: tuyChonSinhMap chở cờ; cờ tắt trả ĐÚNG bộ số gốc (không phải bản gần giống)', () => {
    expect((tuyChonSinhMap(luatCua(V39)) as { chuKyThucTe?: boolean }).chuKyThucTe).toBe(true);
    expect((tuyChonSinhMap(luatCua(V36)) as { chuKyThucTe?: boolean }).chuKyThucTe).toBe(false);
    const goc = thamSoTick(false);
    for (const k of Object.keys(REGIME_TICK) as (keyof typeof REGIME_TICK)[]) {
      expect(goc[k], `REGIME_TICK_GOC.${k} lệch REGIME_TICK`).toBe(REGIME_TICK[k]);
    }
    // Hai tham số mới ở giá trị làm phép tính y hệt bản cũ.
    expect(goc.HAZARD_GIAM_NEN_BP).toBe(REGIME_TICK.HAZARD_NEN_BP);
    expect(goc.HAZARD_GIAM_TUOI_BP).toBe(REGIME_TICK.HAZARD_TUOI_BP);
    expect(goc.NGANG_MO_GIAM_X_BP).toBe(10000);
    expect(REGIME_TICK_GOC).toBe(goc);
    expect(thamSoTick(true)).toBe(REGIME_TICK_THUC_TE);
    expect(thamSoBongBong(false).DAI_TOI_DA).toBe(5);
    expect(thamSoBongBong(true).DAI_TOI_DA).toBe(4);
    // Bảng tin giả: cờ tắt = bảng cũ, bật = tin đơn độc 67% giả (Ahern–Sosyura 2015: 33% thành thật).
    expect(tyLeTinGiaHieuDung('don_doc', 'chien_tranh', 400))
      .toBe(tyLeTinGiaHieuDung('don_doc', 'chien_tranh', 400, false));
    expect(TY_LE_TIN_GIA_THUC_TE.don_doc).toBe(6700);
    expect(TY_LE_TIN_GIA_THUC_TE.noi_chuoi).toBe(TY_LE_TIN_GIA_THEO_BOI_CANH.noi_chuoi);
  });
});

describe('II. BYTE-HỆT — bốn bản đang sống không xê dịch một cú rút (hash khoá 07/09, trước khi sửa map.ts)', () => {
  /*
   * Hash tính bằng ĐÚNG công thức này trên cây làm việc trước khi map.ts có cờ v39.
   * Đổi bất kỳ số nào của REGIME_TICK / BONG_BONG_V27 / bảng tin giả CŨ, hay để
   * nhánh v39 rò vào đường cờ-tắt, là một trong 12 dòng dưới đỏ.
   */
  const KHOA: Record<string, Record<number, string>> = {
    'balance-v36-regime': { 8: '1af8a0e3cc2d9145', 12: 'c8d81ac50f5138e1', 16: '30978f9b1153532f' },
    'balance-v38-doixung': { 8: '1685e4d6e0620796', 12: '86379b74d08602e5', 16: '445302e32135e701' },
    'balance-v31-quycogian': { 8: 'b4ed229c0117f100', 12: '845c24d5b057f72a', 16: '5ec4cf3ffbf9e19a' },
    'balance-v10b-nav': { 8: '7c921925379b1f26', 12: '6b1c70a00c493e97', 16: '757964250cb41b31' },
  };
  for (const [ver, theoCo] of Object.entries(KHOA)) {
    for (const [co, hash] of Object.entries(theoCo)) {
      it(`⭐⭐ ${ver} map ${co}`, () => {
        const tc = tuyChonSinhMap(luatCua(ver));
        const h = createHash('sha256');
        for (let s = 1; s <= 300; s++) h.update(JSON.stringify(sinhMap(seedI(s), Number(co), tc)));
        expect(h.digest('hex').slice(0, 16)).toBe(hash);
      });
    }
  }
});

/** Thước dùng chung với `scripts/do_chu_ky_thuc_te.ts` — cùng định nghĩa, cùng seed. */
function do_(ver: string, size: number, n: number) {
  const tc = tuyChonSinhMap(luatCua(ver));
  let songTang = 0, gayTang = 0, giamRuns = 0, giamTong = 0, mo = 0, moLen = 0;
  let donDoc = 0, donDocGia = 0, bb = 0, bbVo = 0, tang = 0, giam = 0;
  let kyHopGiu = 0, kyHopGiuGiuChuoi = 0;
  for (let s = 1; s <= n; s++) {
    const m = sinhMap(seedI(s), size, tc);
    const o = m.o;
    const tt = m.trang_thai!;
    for (let i = 0; i < o.length; i++) {
      const oi = o[i]!;
      if (oi.kind === 'su_kien') {
        if (oi.boi_canh === 'don_doc') { donDoc++; if (oi.la_tin_gia) donDocGia++; }
        if (oi.su_kien === 'bong_bong' && !oi.la_tin_gia) {
          if (i + 4 < o.length) {
            bb++;
            if (o.slice(i + 1, i + 5).some((x) => x.kind === 'giai_doan' && x.giai_doan === 'giam')) bbVo++;
          }
        }
      } else {
        if (oi.giai_doan === 'tang') tang++;
        if (oi.giai_doan === 'giam') giam++;
      }
      const oi1 = o[i + 1];
      if (oi1 && oi.kind === 'giai_doan' && oi1.kind === 'giai_doan') {
        const a = tt[i]!, b = tt[i + 1]!;
        if (a.run_huong === 1) { songTang++; if (b.run_huong !== 1) gayTang++; }
        if (a.run_huong === 0 && b.run_huong !== 0) { mo++; if (b.run_huong === 1) moLen++; }
      }
      // Kỳ họp GIỮ = ô lịch mà mặt là đi ngang; chuỗi trước đó có hướng ⇒ sau ô này còn hướng không?
      if (tt[i]!.o_lich && oi.kind === 'giai_doan' && oi.giai_doan === 'di_ngang' && i > 0
        && tt[i - 1]!.run_huong !== 0) {
        kyHopGiu++;
        if (tt[i]!.run_huong === tt[i - 1]!.run_huong) kyHopGiuGiuChuoi++;
      }
    }
    for (let i = 1; i < tt.length; i++) {
      if (tt[i - 1]!.run_huong === -1 && tt[i]!.run_huong !== -1) { giamRuns++; giamTong += tt[i - 1]!.run_dai; }
    }
  }
  return {
    hazardTang: gayTang / Math.max(1, songTang),
    daiGiam: giamTong / Math.max(1, giamRuns),
    moLen: moLen / Math.max(1, mo),
    giaDonDoc: donDocGia / Math.max(1, donDoc),
    bbVo4: bbVo / Math.max(1, bb),
    tangHonGiam: tang > giam,
    kyHopGiuGiuChuoi: kyHopGiuGiuChuoi / Math.max(1, kyHopGiu),
    kyHopGiu,
  };
}

describe('III. MỤC TIÊU CÓ NGUỒN — đo trên bàn 12 và 16 (1 ô = 6 tháng)', () => {
  const N = 1500;
  const d12 = do_(V39, 12, N);
  const d16 = do_(V39, 16, N);
  it('⭐⭐ hazard chuỗi TĂNG ≈ 1/5,4 (bull TB 2,7 năm — Hartford Funds; expansions không có duration dependence — Diebold–Rudebusch)', () => {
    for (const d of [d12, d16]) {
      expect(d.hazardTang).toBeGreaterThan(0.14);
      expect(d.hazardTang).toBeLessThan(0.30);
    }
  });
  it('⭐ chuỗi GIẢM dài ≈ 1,6 ô (bear TB 9,6 tháng — Hartford; contraction NBER 10,3 tháng; có tuổi — Diebold–Rudebusch)', () => {
    for (const d of [d12, d16]) {
      expect(d.daiGiam).toBeGreaterThan(1.35);
      expect(d.daiGiam).toBeLessThan(1.95);
    }
  });
  it('⭐ từ ngang mở LÊN ≈ 65% (S&P dương 65% số tháng — Crestmont)', () => {
    for (const d of [d12, d16]) {
      expect(d.moLen).toBeGreaterThan(0.58);
      expect(d.moLen).toBeLessThan(0.72);
    }
  });
  it('⭐ tin đơn độc GIẢ ≈ 67% (Ahern & Sosyura 2015: 167/501 tin đồn thành thật)', () => {
    for (const d of [d12, d16]) {
      expect(d.giaDonDoc).toBeGreaterThan(0.58);
      expect(d.giaDonDoc).toBeLessThan(0.76);
    }
  });
  it('⭐⭐ bong bóng thật VỠ trong 2 năm ≈ 53% (Greenwood–Shleifer–You 2019: 21/40)', () => {
    for (const d of [d12, d16]) {
      expect(d.bbVo4).toBeGreaterThan(0.42);
      expect(d.bbVo4).toBeLessThan(0.70);
    }
    // Quy đổi được kiểm thẳng: rẻ (1 − 0,53)^(1/4) ≈ 0,83.
    expect(Math.abs(Math.pow(1 - 0.53, 1 / 4) - 0.83)).toBeLessThan(0.005);
    expect(moiTruongTienTe(325)).toBe('re');
  });
  it('ô TĂNG nhiều hơn ô GIẢM (drift dương)', () => {
    expect(d12.tangHonGiam).toBe(true);
    expect(d16.tangHonGiam).toBe(true);
  });
});

describe('IV. HIỆU LỰC — cơ chế phải ĐỔI SỐ, không chạy cho có', () => {
  it('v39 vs v38 (cùng nền) phải khác được', () => {
    let khac = 0;
    for (let s = 1; s <= 40; s++) {
      if (JSON.stringify(sinhMap(seedI(s), 12, tuyChonSinhMap(luatCua(V39))))
        !== JSON.stringify(sinhMap(seedI(s), 12, tuyChonSinhMap(luatCua('balance-v38-doixung'))))) khac++;
    }
    expect(khac).toBeGreaterThan(0);
  });
  it('⭐⭐ kỳ họp GIỮ là ô NGHỈ trong chuỗi ở v39 (≥ 95% giữ hướng); ở v36 nó cắt chuỗi (0%)', () => {
    const a = do_(V39, 16, 800);
    const b = do_(V36, 16, 800);
    expect(a.kyHopGiu, 'mẫu kỳ họp GIỮ quá ít để đo').toBeGreaterThan(200);
    expect(a.kyHopGiuGiuChuoi).toBeGreaterThan(0.95);
    expect(b.kyHopGiuGiuChuoi).toBe(0);
  });
  it('bàn tập 12 ô (D300) VẪN kể đúng dưới v36 — v39 ở cổng không đụng bàn tập', () => {
    expect(HOLDEM_DECISIONS.MAN_TAP_SO_O).toBe(12);
    const m = sinhMap(HOLDEM_DECISIONS.MAN_TAP_SEED_12, 12, tuyChonSinhMap(luatCua(V36)));
    expect(m.o[1]!.kind).toBe('su_kien');
    expect(m.o[4]).toEqual({ kind: 'giai_doan', giai_doan: 'phuc_hoi' });
  });
});
