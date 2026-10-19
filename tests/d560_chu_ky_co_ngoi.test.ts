/**
 * D560 — CHU KỲ CÓ NGÒI (khoá balance-v64-congoi, cờ `chuKyCoNgoi`). SPEC `docs/spec/chu-ky-co-ngoi.md` §5.
 *   §I   khoá v64 = v63 + ĐÚNG một cờ
 *   §II  lá pha mang tính chất: mọi lá ĐI NGANG có tích lũy / phân phối; khoá cũ không mang; DTO công khai chở nó
 *   §III ⭐ không ngòi không vào SUY THOÁI: gấu chu kỳ chỉ sau phân phối · gấu sự kiện chỉ sau tin xấu thật · gấu định giá chỉ sau bong bóng
 *   §IV  sức căng có đèn: khoá v64 không phóng đại khi lá pha vừa lật không phải Quá nóng / Phân phối (và không có Bong bóng chưa vỡ)
 */
import { describe, expect, it } from 'vitest';
import { luatCua } from '../config/holdem.js';
import { sinhMap, oCongKhai, HUONG_GIAI_DOAN, type OThiTruong } from '../server/holdem/map.js';
import { tuyChonSinhMap, denQuaNong } from '../server/holdem/engine.js';

const V63 = 'balance-v63-ban14', V64 = 'balance-v64-congoi';
const SEEDS = Array.from({ length: 2000 }, (_, i) => 7_000_001 + i * 7919);
const mapCua = (khoa: string, seed: number) => sinhMap(seed, 14, tuyChonSinhMap(luatCua(khoa)));

describe('§I — khoá v64', () => {
  it('khác v63 đúng cờ chuKyCoNgoi', () => {
    const a = luatCua(V63) as unknown as Record<string, unknown>, b = luatCua(V64) as unknown as Record<string, unknown>;
    const khac = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
    expect(khac).toEqual(['chuKyCoNgoi']);
  });
});

describe('§II — tính chất lá pha', () => {
  it('v64: mọi lá Đi ngang mang tích lũy / phân phối; tính chất chỉ là 7 loại đã khai', () => {
    const LOAI = new Set(['tich_luy', 'phan_phoi', 'dong_tien', 'tang_truong', 'gau_su_kien', 'gau_dinh_gia', 'gau_chu_ky']);
    let ngang = 0, coTc = 0;
    for (const s of SEEDS.slice(0, 500)) {
      for (const o of mapCua(V64, s).o) {
        if (o.kind !== 'giai_doan') continue;
        if (o.tinh_chat) { coTc += 1; expect(LOAI.has(o.tinh_chat)).toBe(true); }
        if (o.giai_doan === 'di_ngang') { ngang += 1; expect(['tich_luy', 'phan_phoi']).toContain(o.tinh_chat); }
      }
    }
    expect(ngang).toBeGreaterThan(200);
    expect(coTc).toBeGreaterThan(ngang);
  });
  it('v63: không lá pha nào mang tính chất (map cũ nguyên)', () => {
    for (const s of SEEDS.slice(0, 300)) for (const o of mapCua(V63, s).o) if (o.kind === 'giai_doan') expect(o.tinh_chat).toBeUndefined();
  });
  it('DTO công khai chở tính chất của lá pha', () => {
    const o = mapCua(V64, SEEDS[0]!).o.find((x) => x.kind === 'giai_doan' && x.tinh_chat)!;
    expect((oCongKhai(o) as { tinh_chat?: string }).tinh_chat).toBe((o as { tinh_chat?: string }).tinh_chat);
  });
});

describe('§III — ⭐ không ngòi không vào suy thoái (2.000 map 14 ô)', () => {
  const tinXauThat = (x: OThiTruong | undefined) => x?.kind === 'su_kien' && !x.la_tin_gia
    && (HUONG_GIAI_DOAN[x.bao_truoc] === -1 || x.bao_truoc === 'bien_dong');
  it('mỗi lần vào mùa Giảm: chu kỳ ⇐ phân phối · sự kiện ⇐ tin xấu thật ngay trước · định giá ⇐ bong bóng chưa vỡ', () => {
    let vao = 0;
    const loi: string[] = [];
    for (const s of SEEDS) {
      const m = mapCua(V64, s), tt = m.trang_thai ?? [];
      for (let i = 1; i < tt.length; i++) {
        if (tt[i]?.mua !== 'giam' || tt[i - 1]?.mua === 'giam') continue;
        vao += 1;
        const loai = tt[i]!.loai_mua, truoc = tt[i - 1]!;
        const ok = loai === 'gau_chu_ky' ? truoc.mua === 'di_ngang' && truoc.loai_mua === 'phan_phoi'
          : loai === 'gau_su_kien' ? tinXauThat(m.o[i]) || tinXauThat(m.o[i - 1])
            : loai === 'gau_dinh_gia' ? m.o.slice(0, i + 1).some((x) => x.kind === 'su_kien' && x.su_kien === 'bong_bong' && !x.la_tin_gia)
              : false;
        if (!ok && loi.length < 5) loi.push(`seed ${s} ô ${i}: ${truoc.mua}:${truoc.loai_mua ?? ''} → giam:${loai ?? ''}`);
      }
    }
    expect(vao).toBeGreaterThan(500);
    expect(loi).toEqual([]);
  });
});

describe('§IV — sức căng có đèn', () => {
  const st = (o: OThiTruong[], vong: number) => ({ vong, o_up: true, map: { o } }) as never;
  const pha = (g: string, tc?: string) => ({ kind: 'giai_doan', giai_doan: g, ...(tc ? { tinh_chat: tc } : {}) }) as OThiTruong;
  const tin = (sk: string) => ({ kind: 'su_kien', su_kien: sk, bao_truoc: 'tang', la_tin_gia: false }) as unknown as OThiTruong;
  it('đèn bật: lá vừa lật là Quá nóng / Đi ngang phân phối; Bong bóng chưa vỡ trong 6 ô', () => {
    expect(denQuaNong(st([pha('tang'), pha('bien_dong'), pha('tang')], 2))).toBe(true);
    expect(denQuaNong(st([pha('tang'), pha('di_ngang', 'phan_phoi'), pha('tang')], 2))).toBe(true);
    expect(denQuaNong(st([tin('bong_bong'), pha('tang'), pha('tang'), pha('tang')], 3))).toBe(true);
  });
  it('đèn tắt: lá vừa lật là Tăng / Tích lũy; bong bóng đã vỡ (có lá Giảm sau nó)', () => {
    expect(denQuaNong(st([pha('tang'), pha('tang'), pha('tang')], 2))).toBe(false);
    expect(denQuaNong(st([pha('di_ngang', 'tich_luy'), pha('tang')], 1))).toBe(false);
    expect(denQuaNong(st([tin('bong_bong'), pha('giam'), pha('tang'), pha('tang')], 3))).toBe(false);
  });
});

/* ─── §V — phần 2: hình đi ngang trong màn (tích lũy / phân phối · Spring / Upthrust) ─── */
import { boiCanhMan } from '../server/holdem/minigame/man.js';
import { dungDongMin, neoVeDich, apTinhChatNgang, type NenMin } from '../server/holdem/minigame/dong_gia.js';
import { HINH_CHUNG } from '../config/minigame_hinh.js';
import { NEN_LS, K_MIN, HINH_NGANG } from '../config/minigame.js';

describe('§V — hình đi ngang trong màn', () => {
  const n0 = NEN_LS * K_MIN;
  type Mau = { tc: 'tich_luy' | 'phan_phoi'; goc: NenMin[]; co: NenMin[]; bay: number | null };
  const mau: Mau[] = [];
  for (const s of SEEDS.slice(0, 400)) {
    const m = mapCua(V64, s);
    for (let i = 1; i < m.o.length && mau.length < 300; i++) {
      const o = m.o[i]!;
      if (o.kind !== 'giai_doan' || o.giai_doan !== 'di_ngang') continue;
      const bc = boiCanhMan({ seedTran: s, vong: i, map: m, oUp: true, viThe: { vn30: 1000 }, loiSuat: { vn30: 80 }, laiSuatDiem: null, namNac: true });
      if ('loi' in bc || !bc.tc) continue;
      const hinh = HINH_CHUNG.find((h) => h.id === bc.hinh)!;
      const dung = () => { const x = dungDongMin({ seed: bc.seed, ma: bc.ma, hinh, bien: bc.kb.bien, nghieng: bc.kb.nghieng, nhieuX: bc.kb.nhieuX, dai: bc.dai, q: bc.q, troi: [], cheDo: bc.che_do ?? 'thuong', ...(bc.nac ? { nac: bc.nac } : {}) }); neoVeDich(x, bc.muc_tieu_bp!); return x; };
      const goc = dung(), co = dung();
      mau.push({ tc: bc.tc, goc, co, bay: apTinhChatNgang(co, bc.seed, bc.tc).bay });
    }
  }
  const bien = (x: NenMin[]) => { const c = x.slice(n0); return (Math.max(...c.map((y) => y.h)) - Math.min(...c.map((y) => y.l))) / x[n0 - 1]!.c; };
  const tb = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const nhom = (tc: string) => mau.filter((x) => x.tc === tc);

  it('chỉ ô Đi ngang có tính chất mới mang `tc`; đủ mẫu hai loại', () => {
    expect(nhom('tich_luy').length).toBeGreaterThan(40);
    expect(nhom('phan_phoi').length).toBeGreaterThan(40);
    const m63 = mapCua(V63, SEEDS[0]!);
    const i = m63.o.findIndex((o, k) => k > 0 && o.kind === 'giai_doan');
    const bc = boiCanhMan({ seedTran: SEEDS[0]!, vong: i, map: m63, oUp: true, viThe: { vn30: 1000 }, loiSuat: { vn30: 80 }, laiSuatDiem: null, namNac: true });
    expect('loi' in bc ? undefined : bc.tc).toBeUndefined();
  });
  it('⭐ giữ giá mở và giá đóng cuối (% engine không đổi)', () => {
    for (const x of mau) {
      expect(x.co[n0]!.o).toBeCloseTo(x.goc[n0]!.o, 9);
      expect(x.co[x.co.length - 1]!.c).toBeCloseTo(x.goc[x.goc.length - 1]!.c, 9);
    }
  });
  it('⭐ tích lũy hẹp hơn, khối lượng cạn nửa sau; phân phối rộng hơn, cây giảm nặng hơn', () => {
    const tl = nhom('tich_luy'), pp = nhom('phan_phoi');
    expect(tb(tl.map((x) => bien(x.co) / bien(x.goc)))).toBeLessThan(0.75);
    expect(tb(pp.map((x) => bien(x.co) / bien(x.goc)))).toBeGreaterThan(1.05);
    const klNua = (x: NenMin[]) => { const c = x.slice(n0), h = c.length / 2; return tb(c.slice(h).map((y) => y.v)) / tb(c.slice(0, h).map((y) => y.v)); };
    expect(tb(tl.map((x) => klNua(x.co) / klNua(x.goc)))).toBeLessThan(0.6);
    const klGiam = (x: NenMin[]) => tb(x.slice(n0).filter((y) => y.c < y.o).map((y) => y.v)) / tb(x.slice(n0).filter((y) => y.c > y.o).map((y) => y.v));
    expect(tb(pp.map((x) => klGiam(x.co) / klGiam(x.goc)))).toBeGreaterThan(1.3);
  });
  it('bẫy: tỷ lệ quanh BAY_BP, ở khúc đã khai, đúng phía (Spring thủng đáy · Upthrust vượt đỉnh dải đã chạy)', () => {
    const coBay = mau.filter((x) => x.bay !== null);
    expect(coBay.length / mau.length).toBeGreaterThan(HINH_NGANG.BAY_BP / 10000 - 0.12);
    expect(coBay.length / mau.length).toBeLessThan(HINH_NGANG.BAY_BP / 10000 + 0.12);
    for (const x of coBay) {
      const N = x.co.length - n0, j = x.bay!;
      expect(j).toBeGreaterThanOrEqual(Math.floor(N * HINH_NGANG.BAY_TU));
      expect(j).toBeLessThanOrEqual(Math.floor(N * HINH_NGANG.BAY_DEN));
      const truoc = x.co.slice(n0, n0 + j), c = x.co[n0 + j]!;
      if (x.tc === 'tich_luy') expect(c.l).toBeLessThan(Math.min(...truoc.map((y) => y.l)));
      else expect(c.h).toBeGreaterThan(Math.max(...truoc.map((y) => y.h)));
    }
  });
});
