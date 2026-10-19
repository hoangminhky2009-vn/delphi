/**
 * D484 — BẢNG PHỤ của màn minigame: mã KHÁC đang cầm chạy cùng màn (demo bản 27–28 `lapBangPhu` · `veBangPhu`).
 *   §I   `duongPhu`: 481 mốc, mở 100, cuối = 100 × (1 + % thị trường engine của vòng), tất định, mỗi mã một hạt
 *   §II  bối cảnh: chỉ mã khác đang cầm (> 0, có dòng giá), kèm bp; không neo ⇒ không bảng phụ
 *   §III `loNhip`: giá bảng phụ đi CÙNG các nhịp của mã chính (mốc k + 1), nhịp cuối = điểm cuối
 * Đường qua HTTP: `tests/minigame_api.test.ts` §V (D484).
 */
import { describe, expect, it } from 'vitest';
import { luatCua } from '../config/holdem_balance.js';
import { SO_NHIP } from '../config/minigame.js';
import { taoTran, type GheMoi } from '../server/holdem/engine.js';
import { cuLacChinh, duongPhu, type TqMan } from '../server/holdem/minigame/dong_gia.js';
import { dungDongMan, duongPhuCua, loNhip, tuongQuanMan } from '../server/holdem/minigame/man.js';
import { boiCanhGhe } from '../server/holdem/minigame/quyet_toan.js';

const ghe = (id: string, loai: 'nguoi' | 'bot'): GheMoi => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } });
const st = { ...taoTran(9, [ghe('ban', 'nguoi'), ghe('g1', 'bot')], luatCua('balance-v57-minigame'), 12), vong: 3 };

describe('§I — `duongPhu`', () => {
  it('⭐ 481 mốc; mở 100; cuối = 100 × (1 + bp/10⁴) đúng tới 1e-9 — giữ suốt màn ăn đúng % thị trường của vòng', () => {
    for (const [ma, bp] of [['vang', 300], ['cp_cn', -1200], ['usd', 0], ['btc', 2500]] as const) {
      const g = duongPhu(77, 0, ma, bp);
      expect(g).toHaveLength(SO_NHIP + 1);
      expect(g[0]).toBe(100);
      expect(g[SO_NHIP]! / 100 - 1).toBeCloseTo(bp / 10000, 9);
    }
  });
  it('tất định theo (seed, thứ tự); khác thứ tự ⇒ khác đường; mã nhiễu hơn ⇒ đường giật hơn', () => {
    expect(duongPhu(5, 1, 'vang', 300)).toEqual(duongPhu(5, 1, 'vang', 300));
    expect(duongPhu(5, 1, 'vang', 300)).not.toEqual(duongPhu(5, 2, 'vang', 300));
    const giat = (g: number[]) => g.slice(1).reduce((a, x, k) => a + Math.abs(x / g[k]! - 1), 0);
    expect(giat(duongPhu(5, 0, 'btc', 0))).toBeGreaterThan(giat(duongPhu(5, 0, 'usd', 0)));
  });
});

describe('§II — bối cảnh màn mang bảng phụ', () => {
  it('⭐ chỉ mã KHÁC đang cầm (> 0, có dòng giá minigame) kèm bp của vòng; mã chính và mã 0 bị bỏ', () => {
    const bc = boiCanhGhe(st, 9, 2, { btc: 1000, vang: 400, cp_cn: 0, tpcp: 200 }, { btc: 1500, vang: 300, tpcp: -50 });
    if ('loi' in bc) throw new Error(bc.loi);
    expect(bc.ma).toBe('btc');
    expect(bc.phu!.map((x) => ({ ma: x.ma, bp: x.bp }))).toEqual([{ ma: 'vang', bp: 300 }, { ma: 'tpcp', bp: -50 }]);
    // D487/D491 — kèm tham số tương quan với mã chính: TP → Crypto là cặp THẤT THƯỜNG (mã chính là mã THEO ⇒ TP đi trước, trễ âm 2–4).
    expect(bc.phu![1]).toMatchObject({ kieu: 'that_thuong', xuoi: false });
    expect([-2, -3, -4]).toContain(bc.phu![1]!.tre);
    expect(bc.phu![1]!.rho).toBeGreaterThanOrEqual(-0.2);
    expect(bc.phu![1]!.rho).toBeLessThanOrEqual(0.7);
  });
  it('vế ngược: không có % thị trường (màn không neo) ⇒ không bảng phụ', () => {
    const bc = boiCanhGhe(st, 9, 2, { btc: 1000, vang: 400 }, null);
    if ('loi' in bc) throw new Error(bc.loi);
    expect(bc.phu).toBeUndefined();
    expect(duongPhuCua(bc)).toEqual({});
  });
});

describe('§III — `loNhip` chở giá bảng phụ', () => {
  const bc = boiCanhGhe(st, 9, 2, { btc: 1000, vang: 400 }, { btc: 1500, vang: 300 });
  if ('loi' in bc) throw new Error(bc.loi);
  const min = dungDongMan(bc), phu = duongPhuCua(bc), g = phu.vang!;
  it('⭐ cùng các nhịp của mã chính: nhịp k ⇒ mốc k + 1; trọn màn ⇒ nhịp cuối = 100 × (1 + 3 %)', () => {
    const a = loNhip(min, 10, 12, phu);
    expect(a.gia).toHaveLength(3);
    expect(a.phu!.vang).toHaveLength(3);
    expect(a.phu!.vang![0]).toBeCloseTo(g[11]!, 3);
    expect(a.phu!.vang![2]).toBeCloseTo(g[13]!, 3);
    const het = loNhip(min, 0, SO_NHIP - 1, phu);
    expect(het.phu!.vang).toHaveLength(SO_NHIP);
    expect(het.phu!.vang![SO_NHIP - 1]).toBeCloseTo(103, 3);
  });
  it('không bảng phụ ⇒ không có trường `phu` (luồng cũ byte-hệt)', () => {
    expect(loNhip(min, 0, 3)).not.toHaveProperty('phu');
    expect(loNhip(min, 0, 3, {})).not.toHaveProperty('phu');
  });
});

describe('§IV — D487 tương quan', () => {
  it('⭐ ρ + trễ (vector chép tay): cặp trong bảng theo chiều dẫn → theo; chiều ngược ⇒ trễ âm; còn lại β·β của engine', () => {
    const kd = tuongQuanMan('vn30', 'cp_cn', null, true, 9);
    expect(kd).toMatchObject({ kieu: 'khuech_dai', xuoi: true, tre: 1 });
    expect(kd.len!).toBeGreaterThanOrEqual(2); expect(kd.len!).toBeLessThanOrEqual(3);
    expect(kd.xuong!).toBeGreaterThanOrEqual(3); expect(kd.xuong!).toBeLessThanOrEqual(3.5);
    expect(tuongQuanMan('cp_cn', 'vn30', null, true, 9)).toMatchObject({ kieu: 'khuech_dai', xuoi: false, tre: -1 });
    expect(tuongQuanMan('btc', 'usd', 'thien_nga_den', true)).toEqual({ kieu: 'tuyen_tinh', xuoi: true, rho: -0.6, tre: 0 });
    expect(tuongQuanMan('vang', 'tpcp', null, true, 9)).toMatchObject({ kieu: 'bat_on', xuoi: false, tre: -1 });
    // Thiên nga đen: β rủi ro 0,80 · phòng thủ 0,30 ⇒ Crypto–Vàng 0,8 × 0,3 = 0,24
    expect(tuongQuanMan('btc', 'vang', 'thien_nga_den', true).rho).toBeCloseTo(0.24, 12);
    // Chiến tranh: vàng β −0,40 ⇒ Crypto–Vàng 0,7 × (−0,4) = −0,28 (vàng hộ giá)
    expect(tuongQuanMan('btc', 'vang', 'chien_tranh', true).rho).toBeCloseTo(-0.28, 12);
    // Ô giai đoạn, β v2: CP CN 0,55 (BETA_V44.NEN_RIENG) · Crypto 0,30 ⇒ 0,165; v1: 0,30 × 0,30 = 0,09
    expect(tuongQuanMan('btc', 'cp_cn', null, true).rho).toBeCloseTo(0.165, 12);
    expect(tuongQuanMan('btc', 'cp_cn', null, false).rho).toBeCloseTo(0.09, 12);
  });
  const corr = (a: number[], b: number[]) => {
    const n = Math.min(a.length, b.length), ma = a.slice(0, n).reduce((x, y) => x + y, 0) / n, mb = b.slice(0, n).reduce((x, y) => x + y, 0) / n;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { sab += (a[i]! - ma) * (b[i]! - mb); saa += (a[i]! - ma) ** 2; sbb += (b[i]! - mb) ** 2; }
    return sab / Math.sqrt(saa * sbb);
  };
  const lsuat = (g: number[]) => g.slice(1).map((x, k) => Math.log(x / g[k]!));
  const bc = boiCanhGhe(st, 9, 2, { btc: 1000 }, { btc: 1500 });
  if ('loi' in bc) throw new Error(bc.loi);
  const soc = cuLacChinh(dungDongMan(bc));
  it('⭐ đường đi ăn theo cú lắc mã chính đúng dấu: ρ 0,9 ⇒ tương quan lợi suất cao, ρ −0,6 ⇒ âm; điểm cuối vẫn đúng bp', () => {
    const thuan = duongPhu(9, 0, 'cp_cn', 400, { soc, chinh: 'btc', rho: 0.9, tre: 0 });
    const nguoc = duongPhu(9, 1, 'usd', -100, { soc, chinh: 'btc', rho: -0.6, tre: 0 });
    expect(corr(soc, lsuat(thuan))).toBeGreaterThan(0.8);
    expect(corr(soc, lsuat(nguoc))).toBeLessThan(-0.4);
    expect(thuan[SO_NHIP]! / 100 - 1).toBeCloseTo(0.04, 9);
    expect(nguoc[SO_NHIP]! / 100 - 1).toBeCloseTo(-0.01, 9);
    expect(Math.abs(corr(soc, lsuat(duongPhu(9, 0, 'cp_cn', 400)))), 'vế ngược: không ρ ⇒ độc lập').toBeLessThan(0.2);
  });
  it('⭐ trễ: mã đi SAU 3 nến ⇒ tương quan đạt đỉnh ở độ dời 48 nhịp; đi TRƯỚC 3 nến ⇒ đỉnh ở −48', () => {
    const dinhO = (g: number[]) => {
      const r = lsuat(g); let tot = -2, o = 0;
      for (let d = -64; d <= 64; d += 16) {
        const a = d >= 0 ? soc.slice(0, SO_NHIP - d) : soc.slice(-d), b = d >= 0 ? r.slice(d) : r.slice(0, SO_NHIP + d);
        const c = corr(a, b); if (c > tot) { tot = c; o = d; }
      }
      return o;
    };
    expect(dinhO(duongPhu(9, 0, 'cp_cn', 0, { soc, chinh: 'btc', rho: 0.9, tre: 3 }))).toBe(48);
    expect(dinhO(duongPhu(9, 0, 'cp_cn', 0, { soc, chinh: 'btc', rho: 0.9, tre: -3 }))).toBe(-48);
  });
  it('⭐ `duongPhuCua` dùng ρ đã ghi trong bối cảnh (ăn theo đường GỐC mã chính); bối cảnh ghi ρ bằng bảng β v2 của trận v57', () => {
    const co = { ...bc, phu: [{ ma: 'cp_cn', bp: 0, rho: 0.9, tre: 0 }] };
    expect(corr(soc, lsuat(duongPhuCua(co).cp_cn!))).toBeGreaterThan(0.8);
    // Dò seed có ô vòng 2 là ô GIAI ĐOẠN — ở đó β v2 của CP CN (0,55) khác v1 (0,30), nên bài đo được cờ.
    let b2: Exclude<ReturnType<typeof boiCanhGhe>, { loi: unknown }> | null = null;
    for (let sd = 1; sd < 200 && !b2; sd++) {
      const s2 = { ...taoTran(sd, [ghe('ban', 'nguoi'), ghe('g1', 'bot')], luatCua('balance-v57-minigame'), 12), vong: 3 };
      const x = boiCanhGhe(s2, sd, 2, { btc: 1000, cp_cn: 400 }, { btc: 1500, cp_cn: 0 });
      if (!('loi' in x) && x.nguon.kind === 'giai_doan') b2 = x;
    }
    if (!b2) throw new Error('200 seed không ra ô giai đoạn');
    const sk = b2.nguon.kind === 'su_kien' ? b2.nguon.the : null;
    expect(b2.phu![0]!.rho).toBeCloseTo(tuongQuanMan('btc', 'cp_cn', sk, true).rho, 12);
    expect(tuongQuanMan('btc', 'cp_cn', sk, true).rho, 'ô này v1 ≠ v2 thì bài mới đo được cờ').not.toBeCloseTo(tuongQuanMan('btc', 'cp_cn', sk, false).rho, 6);
  });
  it('màn mở trước D487 (bảng phụ không có ρ) ⇒ đường độc lập như D484, byte-hệt', () => {
    const cu = { ...bc, phu: [{ ma: 'vang', bp: 300 }] };
    expect(duongPhuCua(cu).vang).toEqual(duongPhu(bc.seed, 0, 'vang', 300));
  });
});

describe('§V — D491 không khớp 1-1 (founder: "Đừng cho mọi thứ khớp nhau 1-1")', () => {
  /** Phần ĂN THEO cú lắc ở từng bước: hiệu log-lợi suất giữa đường có cú lắc và đường cú lắc = 0 (cùng seed ⇒ nhiễu riêng y hệt), trừ bước `ref`. */
  const tachTin = (ma: string, chinh: string, tq: object, soc: number[], ref: number) => {
    const d = (g: number[]) => g.slice(1).map((v, k) => Math.log(v / g[k]!));
    const a = d(duongPhu(9, 0, ma, 0, { ...(tq as TqMan), soc, chinh })), b = d(duongPhu(9, 0, ma, 0, { ...(tq as TqMan), soc: soc.map(() => 0), chinh }));
    const h = a.map((v, k) => v - b[k]!);
    return h.map((v) => v - h[ref]!);
  };
  const xung = (m: Record<number, number>) => Array.from({ length: SO_NHIP }, (_, k) => m[k] ?? 0);
  it('⭐ khuếch đại LỆCH CHIỀU (vector chép tay): VN30 +1 % ⇒ CP +2,5 %; VN30 −1 % ⇒ CP −3,25 % · chiều ngược (mã chính CP) ⇒ CHIA', () => {
    const tq = { kieu: 'khuech_dai', xuoi: true, rho: 0.9, len: 2.5, xuong: 3.25, tre: 0 };
    const t = tachTin('cp_cn', 'vn30', tq, xung({ 100: 0.01, 200: -0.01 }), 5);
    expect(t[100]).toBeCloseTo(0.025, 9);
    expect(t[200]).toBeCloseTo(-0.0325, 9);
    const n = tachTin('vn30', 'cp_cn', { ...tq, xuoi: false }, xung({ 100: 0.01, 200: -0.01 }), 5);
    expect(n[100]).toBeCloseTo(0.004, 9);
    expect(n[200]).toBeCloseTo(-0.01 / 3.25, 9);
  });
  it('⭐ ngưỡng: VN30 TRƠ ≥ 6 nến dù TP lắc đều; rồi SẬP BÙ cả bồn trong `xa` nến — không đi theo từng nhịp', () => {
    const tq = { kieu: 'nguong', xuoi: true, rho: 0.5, nguong: 0.008, xa: 2, boi: 1, tre: 0 };
    const t = tachTin('vn30', 'tpcp', tq, Array(SO_NHIP).fill(0.0004), 0);
    for (let k = 0; k < 6 * 16; k++) expect(Math.abs(t[k]!), `nhịp ${k} còn trơ`).toBeLessThan(1e-9);
    const co = t.map((v, k) => [k, v] as const).filter(([, v]) => Math.abs(v) > 1e-9);
    expect(co.length, 'có sập bù').toBeGreaterThan(0);
    // Khối xả liền nhau: mỗi khối đúng 2 nến = 32 nhịp, trừ khối chạm cuối màn (bị cắt — điểm cuối đã neo nên phần dư không cần).
    const khoi: number[][] = [];
    for (const [k] of co) { const cuoi = khoi[khoi.length - 1]; if (cuoi && cuoi[cuoi.length - 1] === k - 1) cuoi.push(k); else khoi.push([k]); }
    expect(khoi.length, 'trơ rồi sập bù, không bám từng nhịp').toBeLessThanOrEqual(5);
    for (const b of khoi) if (b[b.length - 1] !== SO_NHIP - 1) expect(b.length, `khối bắt đầu nhịp ${b[0]}`).toBe(32);
    const tong = co.reduce((a, [, v]) => a + v, 0), tich = 0.5 * (0.7 / 0.6) * 0.0004 * SO_NHIP;
    expect(tong).toBeGreaterThan(0.4 * tich);
    expect(tong).toBeLessThanOrEqual(tich + 1e-9);
  });
  it('⭐ TP–Vàng BẤT ỔN: qua nhiều vòng có vòng ngược chiều lẫn cùng chiều; thẻ trú ẩn (lạm phát) ⇒ ρ ÂM', () => {
    const r = Array.from({ length: 40 }, (_, sd) => tuongQuanMan('tpcp', 'vang', null, true, sd).rho);
    expect(r.some((x) => x < 0), 'có vòng ngược chiều').toBe(true);
    expect(r.some((x) => x > 0.3), 'có vòng cùng chiều').toBe(true);
    for (let sd = 0; sd < 20; sd++) {
      const q = tuongQuanMan('tpcp', 'vang', 'lam_phat', true, sd);
      expect(q.rho, `seed ${sd}`).toBeLessThan(0);
      expect(q.soHai).toBe(true);
    }
  });
  it('TP–Crypto THẤT THƯỜNG: ρ đổi theo vòng; Crypto nhạy ×1,6 (vector: ρ 0,5 · biên độ 1,3/0,6 · 1,6 · 1 % ⇒ 1,7333 %)', () => {
    const r = new Set(Array.from({ length: 10 }, (_, sd) => tuongQuanMan('tpcp', 'btc', null, true, sd).rho.toFixed(3)));
    expect(r.size).toBeGreaterThan(5);
    const t = tachTin('btc', 'tpcp', { kieu: 'that_thuong', xuoi: true, rho: 0.5, nhay: 1.6, tre: 0 }, xung({ 100: 0.01 }), 5);
    expect(t[100]).toBeCloseTo(0.5 * (1.3 / 0.6) * 1.6 * 0.01, 9);
  });
});
