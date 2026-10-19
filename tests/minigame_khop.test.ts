/**
 * D475 → D479 — KHỚP LỆNH BẮT ĐÁY TRONG MÀN. TEST VECTOR CHÉP TAY, viết TRƯỚC code (A8.3).
 *
 * D479 (founder 04/10, demo bản 27): KHOẢN CHẠY THEO ĐƯỜNG GIÁ. Engine vẫn cộng % thị trường lúc chốt vòng (= GIỮ SUỐT); màn chỉ cộng PHẦN CHÊNH:
 *   khớp vào   = giá × (1 + trượt/10⁴)                     trượt = MA_MINIGAME[mã].truot × r (nấc thanh khoản, `heSoThanhKhoan`)
 *   ra (bán)   = giá × (1 − trượt × bội/10⁴)               bội = 3 khi tự chốt cuối màn đúng lúc nến cuối TRẮNG BÊN MUA, còn lại 1
 *   theo lệnh T = Σ floor(tiền × (ra − khớp) / khớp)       hệ số lõi = 1 (founder 2A: bỏ ×2); tiền chưa vào đứng yên; trần lỗ = cả vốn màn
 *   giữ suốt  H = floor(V × (giá cuối / giá đầu − 1))       V = vốn màn (khoản TRƯỚC khi thị trường chạy)
 *   lãi lỗ màn = T − H                                      ⇒ khoản cuối = V + T. Không bấm ⇒ T = H ⇒ 0.
 * Mã thử: CP Chứng khoán (trượt 50 bp, nấc nền VỪA). V = 1.000, giá đầu 100.
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, SO_NHIP } from '../config/minigame.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { ketQuaMan, laCuaMan, lenhBotBatDay, type LenhMan } from '../server/holdem/minigame/khop.js';
import { neoVeDich } from '../server/holdem/minigame/dong_gia.js';
import { apMg, boiCanhCuaGhe, tinhMgCaBan } from '../server/holdem/minigame/quyet_toan.js';
import { dungDongMan } from '../server/holdem/minigame/man.js';
import { taoTran, type GheMoi, type TrangThaiTran } from '../server/holdem/engine.js';
import { luatCua } from '../config/holdem_balance.js';

/** Dòng mịn thử: 20 nến lịch sử phẳng 100 + 60 nến chạy dựng từ 480 nhịp; `trang`/`trangBan` theo chỉ số nến mịn CHẠY. */
function dong(gia: (k: number) => number, co: { trang?: number[]; trangBan?: number[] } = {}): NenMin[] {
  const ra: NenMin[] = [];
  for (let i = 0; i < NEN_LS * K_MIN; i++) ra.push({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 0, iSong: i, rut: 0, quet: null });
  let truoc = 100;
  for (let j = 0; j < SO_NHIP / 8; j++) {
    const tick = Array.from({ length: 8 }, (_, t) => gia(j * 8 + t));
    ra.push({
      o: truoc, c: tick[7]!, h: Math.max(truoc, ...tick), l: Math.min(truoc, ...tick), tick, v: 0, iSong: j, rut: 0, quet: null,
      ...(co.trang?.includes(j) ? { trang: true } : {}), ...(co.trangBan?.includes(j) ? { trangBan: true } : {}),
    });
    truoc = tick[7]!;
  }
  return ra;
}
const diem = (m: Record<number, number>, nen = 100) => (k: number) => m[k] ?? nen;
let seq = 0;
const L = (nhip: number, nut: string): LenhMan => ({ seq: ++seq, nhip, nut });
const chay = (min: NenMin[], lenh: LenhMan[], p: { la?: string | null; nac?: 'can' | 'mong' | 'vua' | 'day' | 'rat_day' } = {}) =>
  ketQuaMan({ min, von: 1000, ma: 'cp_cn', la: p.la === undefined ? 'bat_day' : p.la, lenh, ...(p.nac ? { nac: p.nac } : {}) });

describe('§I — vector chép tay', () => {
  it('A · VÀO HẾT ở 90, THOÁT ở 99, giá cuối 100: T = floor(1000 × 8,055 / 90,45) = 89 · H = 0 ⇒ +89', () => {
    const kq = chay(dong(diem({ 100: 90, 300: 99 })), [L(100, 'vao_het'), L(300, 'thoat')]);
    expect(kq.vao[0]!.khop).toBeCloseTo(90.45, 10);
    expect(kq.ra[0]!.ra).toBeCloseTo(98.505, 10);
    expect(kq.theoLenh).toBe(89);
    expect(kq.giu).toBe(0);
    expect(kq.loi).toBe(89);
    expect(kq.tuDong).toBe(false);
  });

  it('B · KHÔNG BẤM = GIỮ: giá cuối 95 ⇒ H = −50, T = H ⇒ lãi lỗ màn 0 (khoản đã ăn −50 qua engine)', () => {
    const kq = chay(dong(diem({ 50: 110, 479: 95 })), []);
    expect(kq.tuDong).toBe(true);
    expect(kq.giu).toBe(-50);
    expect(kq.theoLenh).toBe(-50);
    expect(kq.loi).toBe(0);
    expect(kq.vao).toEqual([]);
    expect(kq.nhan).toEqual(['giu_suot']);
  });

  it('C · VÀO NỬA ở 100 rồi ở 80, cuối 90: T = −55 + 56 = 1 · H = −100 ⇒ +101 (đứng ngoài nửa đầu cú rơi)', () => {
    const kq = chay(dong(diem({ 200: 80, 479: 90 })), [L(50, 'vao_nua'), L(200, 'vao_nua')]);
    expect(kq.vao.map((x) => x.tien)).toEqual([500, 500]);
    expect(kq.ra[0]!.tuDongCuoi).toBe(true);
    expect(kq.theoLenh).toBe(1);
    expect(kq.giu).toBe(-100);
    expect(kq.loi).toBe(101);
  });

  it('D · bấm VÀO đúng nến TRẮNG BÊN BÁN ⇒ hụt ⇒ như không bấm (0); nến kế không trắng thì khớp: −10', () => {
    const kq = chay(dong(diem({}), { trangBan: [13] }), [L(100, 'vao_het')]);
    expect(kq.hut).toEqual([{ nhip: 100, ben: 'ban' }]);
    expect(kq.tuDong).toBe(true);
    expect(kq.loi).toBe(0);
    const sau = chay(dong(diem({}), { trangBan: [14] }), [L(100, 'vao_het')]);
    expect(sau.hut).toEqual([]);
    expect(sau.loi).toBe(-10);   // khớp 100,5 · ra 99,5 ⇒ floor(1000 × −1 / 100,5) = −10 · H = 0
  });

  it('E · tự chốt cuối màn đúng lúc nến cuối TRẮNG BÊN MUA ⇒ trượt ×3: ra 98,5 ⇒ −20 (không trắng: −10)', () => {
    expect(chay(dong(diem({})), [L(100, 'vao_het')]).loi).toBe(-10);
    const kq = chay(dong(diem({}), { trang: [58] }), [L(100, 'vao_het')]);
    expect(kq.ra[0]!.cuoiKhoa).toBe(true);
    expect(kq.ra[0]!.ra).toBeCloseTo(98.5, 10);
    expect(kq.loi).toBe(-20);
  });

  it('F · vào ở 100 rồi chợ rơi 60 %: T = −604 · H = −600 ⇒ −4 (chỉ mất phần trượt so với giữ)', () => {
    const kq = chay(dong((k) => (k >= 400 ? 40 : 100)), [L(10, 'vao_het')]);
    expect(kq.theoLenh).toBe(-604);
    expect(kq.giu).toBe(-600);
    expect(kq.loi).toBe(-4);
  });

  it('G · đã THOÁT hết thì không vào lại; tiền chưa vào đứng yên: T = −5 ⇒ −5', () => {
    const kq = chay(dong(diem({})), [L(10, 'vao_nua'), L(20, 'thoat'), L(30, 'vao_het')]);
    expect(kq.vao).toHaveLength(1);
    expect(kq.loi).toBe(-5);   // floor(500 × (99,5 − 100,5) / 100,5) = floor(−4,975)
  });

  it('H · nấc CẠN trên mã nền VỪA ⇒ trượt 200 bp: khớp 91,8 · ra 97,02 ⇒ 56', () => {
    const kq = chay(dong(diem({ 100: 90, 300: 99 })), [L(100, 'vao_het'), L(300, 'thoat')], { nac: 'can' });
    expect(kq.vao[0]!.khop).toBeCloseTo(91.8, 10);
    expect(kq.loi).toBe(56);
  });

  it('I · THOÁT đúng nến TRẮNG BÊN MUA ⇒ hụt, vị thế giữ tới cuối: −10', () => {
    const kq = chay(dong(diem({}), { trang: [37] }), [L(10, 'vao_het'), L(300, 'thoat')]);
    expect(kq.hut).toEqual([{ nhip: 300, ben: 'mua' }]);
    expect(kq.ra[0]!.tuDongCuoi).toBe(true);
    expect(kq.loi).toBe(-10);
  });

  it('J · lệnh lạ bị bỏ qua: nút không thuộc lõi, nhịp ngoài màn, thứ tự theo seq', () => {
    const lenh = [{ seq: 2, nhip: 300, nut: 'thoat' }, { seq: 1, nhip: 100, nut: 'vao_het' }, { seq: 3, nhip: 9999, nut: 'vao_het' }, { seq: 4, nhip: 5, nut: 'nhoi' }];
    expect(chay(dong(diem({ 100: 90, 300: 99 })), lenh).loi).toBe(89);
  });

  it('K · lõi chưa có trong màn hoặc không cầm lõi ⇒ chỉ xem = giữ, lãi lỗ màn 0', () => {
    for (const la of ['mua_duoi', null]) {
      const kq = chay(dong(diem({ 50: 110, 479: 95 })), [L(100, 'vao_het')], { la });
      expect(kq.loi).toBe(0);
      expect(kq.vao).toEqual([]);
    }
  });
});

describe('§I-b — neo điểm cuối của đường giá vào % engine (D479)', () => {
  it('⭐ `neoVeDich`: giá đóng cuối / giá mở màn = 1 + % đích, đúng tới 1e-9; lịch sử không đổi; dáng giữ (nến lên vẫn lên)', () => {
    const goc = dong((k) => 100 + Math.sin(k / 30) * 5 + k * 0.01);
    for (const bp of [3000, -2500, 0, 450]) {
      const min = goc.map((c) => ({ ...c, tick: [...c.tick] }));
      neoVeDich(min, bp);
      expect(min[min.length - 1]!.c / min[NEN_LS * K_MIN - 1]!.c).toBeCloseTo(1 + bp / 10000, 9);
      for (let i = 0; i < NEN_LS * K_MIN; i++) expect(min[i]).toEqual(goc[i]);
      for (const c of min) { expect(c.h).toBeGreaterThanOrEqual(Math.max(c.o, c.c, ...c.tick) - 1e-9); expect(c.l).toBeLessThanOrEqual(Math.min(c.o, c.c, ...c.tick) + 1e-9); }
    }
  });
});

describe('§II — nhãn hành vi (id; chữ ở client — D26)', () => {
  // Đáy duy nhất 80 ở nhịp 160–175 ⇒ nến gộp 10.
  const day = (k: number) => (k >= 160 && k < 176 ? 80 : 100);
  it('vào trong cửa sổ quanh đáy (nến 9…12), không đuổi nến xanh ⇒ KIÊN NHẪN', () => {
    expect(chay(dong(day), [L(165, 'vao_het')]).nhan).toContain('kien_nhan');
  });
  it('vào sớm hơn đáy ≥ 3 nến và khớp cao hơn đáy > 8 % ⇒ BẮT DAO RƠI', () => {
    expect(chay(dong(day), [L(40, 'vao_het')]).nhan).toContain('bat_dao_roi');
  });
  it('đuổi chuỗi ≥ 3 nến xanh, giá trên trung bình các nến trước ⇒ FOMO', () => {
    const len = (k: number) => 100 + Math.min(k, 95) * 0.06;
    expect(chay(dong(len), [L(94, 'vao_het')]).nhan).toContain('fomo');
  });
  it('bán dưới giá vốn rồi giá quay lên trên giá vốn ⇒ HOẢNG · BÁN ĐÁY', () => {
    const g = (k: number) => (k < 200 ? 100 : k < 260 ? 90 : 105);
    expect(chay(dong(g), [L(10, 'vao_het'), L(210, 'thoat')]).nhan).toContain('hoang_ban_day');
  });
  it('hụt lúc trắng ⇒ nhãn hụt theo phía; không bấm ⇒ chỉ GIỮ SUỐT', () => {
    expect(chay(dong(diem({}), { trang: [37] }), [L(10, 'vao_het'), L(300, 'thoat')]).nhan).toContain('ban_hut_trang_mua');
    expect(chay(dong(day), []).nhan).toEqual(['giu_suot']);
  });
});

describe('§III — lá của màn và bot', () => {
  it('lá: lần chọn CUỐI trong số lõi đang cầm; không chọn ⇒ Bắt Đáy nếu cầm, không thì lõi đầu; không cầm ⇒ null', () => {
    expect(laCuaMan(['mua_duoi', 'bat_day'], [])).toBe('bat_day');
    expect(laCuaMan(['mua_duoi'], [])).toBe('mua_duoi');
    expect(laCuaMan([], [])).toBeNull();
    expect(laCuaMan(['mua_duoi', 'bat_day'], [{ seq: 1, nhip: -1, nut: 'la_mua_duoi' }])).toBe('mua_duoi');
    expect(laCuaMan(['mua_duoi', 'bat_day'], [{ seq: 1, nhip: -1, nut: 'la_mua_duoi' }, { seq: 2, nhip: -1, nut: 'la_bat_day' }])).toBe('bat_day');
    expect(laCuaMan(['bat_day'], [{ seq: 1, nhip: -1, nut: 'la_don_bay' }]), 'chọn lá không cầm ⇒ bỏ qua').toBe('bat_day');
  });

  it('bot Bắt Đáy: vào HẾT ở nhịp đầu tiên ≥ 80 mà giá rút ≥ 2 % khỏi đỉnh đã qua; không có ⇒ vào ở 400; chỉ đọc nhịp đã qua', () => {
    const g = (k: number) => (k < 120 ? 100 : k < 130 ? 99 : 97.9);
    expect(lenhBotBatDay(dong(g))).toEqual([{ seq: 1, nhip: 130, nut: 'vao_het' }]);
    // Rút sớm hơn nhịp 80 không tính.
    expect(lenhBotBatDay(dong((k) => (k >= 10 ? 97 : 100)))).toEqual([{ seq: 1, nhip: 80, nut: 'vao_het' }]);
    // Nến gộp của nhịp 80 (gộp 5 = mịn 10 + 11) trắng bên bán ⇒ chờ nến gộp kế (nhịp 96).
    expect(lenhBotBatDay(dong((k) => (k >= 10 ? 97 : 100), { trangBan: [11] }))).toEqual([{ seq: 1, nhip: 96, nut: 'vao_het' }]);
    expect(lenhBotBatDay(dong(diem({})))).toEqual([{ seq: 1, nhip: 400, nut: 'vao_het' }]);
  });
});

describe('§IV — quyết toán cả bàn (thuần)', () => {
  const ghe = (id: string, loai: 'nguoi' | 'bot'): GheMoi => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } });
  /** Trận v57 bàn 12 ở đầu vòng 3 (màn vòng 2 vừa hết), người và hai bot đều cầm BTC 1.000; chỉ bot g1 cầm Bắt Đáy. */
  const banThu = (seed: number): TrangThaiTran => {
    const st = taoTran(seed, [ghe('ban', 'nguoi'), ghe('g1', 'bot'), ghe('g2', 'bot')], luatCua('balance-v57-minigame'), 12);
    return {
      ...st, vong: 3,
      ghe: st.ghe.map((g) => ({
        ...g, vi_the: { btc: 1000 },
        danh_muc: { ...g.danh_muc, chien_thuat: (g.id === 'g1' ? ['bat_day'] : g.id === 'ban' ? ['bat_day'] : ['mua_duoi']) as never },
      })),
    };
  };

  it('⭐ bot cầm Bắt Đáy chơi theo `lenhBotBatDay`; bot cầm lõi khác không có dòng; người không bấm ⇒ GIỮ = 0 (D479)', () => {
    let coLoiBot = 0;
    const LS = { btc: 1500 };   // % thị trường engine của Crypto ở vòng: +15 %
    for (const seed of [11, 22, 33, 44, 55]) {
      const st = banThu(seed);
      const { mg, ban } = tinhMgCaBan(st, { seedTran: seed, vong: 2, loiSuat: LS, ban: { lenh: [] } });
      expect(mg.g2, 'Mua Đuổi chưa có trong màn').toBeUndefined();
      // D517 — CÙNG cửa với quyết toán (`boiCanhCuaGhe`: kèm bầy Cá nhân của ghế g1); tự ghép tham số là bản dựng thứ hai, trôi im lặng.
      const bc = boiCanhCuaGhe(st, seed, 2, st.ghe.find((g) => g.id === 'g1')!, LS);
      if ('loi' in bc) throw new Error(bc.loi);
      // D479 — khoản sau thị trường 1.000 ⇒ vốn màn = round(1000 / 1,15) = 870; đường giá cuối / đầu = +15 %.
      expect(bc.von).toBe(870);
      expect(bc.von_sau).toBe(1000);
      const min = dungDongMan(bc);
      // D521 — cú thanh lý để lại vết ⇒ đường của màn `thac_v2` lệch khỏi +15 % đúng phần vết; bỏ cờ (màn cũ) thì giữ đúng +15 %.
      const goc = dungDongMan({ ...bc, thac_v2: undefined } as never);
      expect(goc[goc.length - 1]!.c / goc[19]!.c).toBeCloseTo(1.15, 9);
      const bot = ketQuaMan({ min, von: bc.von, ma: 'btc', ...(bc.nac ? { nac: bc.nac } : {}), la: 'bat_day', lenh: lenhBotBatDay(min) });
      expect(bot.giu).toBe(Math.floor(870 * (min[min.length - 1]!.c / min[19]!.c - 1) + 1e-9));
      expect(mg.g1?.loi ?? 0).toBe(bot.loi);
      if (bot.loi !== 0) coLoiBot += 1;
      expect(ban?.tuDong).toBe(true);
      expect(ban!.loi, 'D521 — người không bấm chịu đúng phần vết thác').toBe(ban!.vet ?? 0);
      expect(mg.ban?.loi ?? 0).toBe(ban!.vet ?? 0);
    }
    expect(coLoiBot, 'bot không có lãi lỗ ở seed nào thì bài này không đo gì').toBeGreaterThan(0);
  });

  it('`apMg`: cộng vào đúng khoản, sàn 0, ghế cháy / mã không còn ⇒ bỏ qua; mg rỗng ⇒ cùng tham chiếu', () => {
    const st = banThu(11);
    const sau = apMg(st, { ban: { ma: 'btc', loi: 250 }, g1: { ma: 'btc', loi: -5000 }, g2: { ma: 'vang', loi: 10 } });
    expect(sau.ghe.find((g) => g.id === 'ban')!.vi_the.btc).toBe(1250);
    expect(sau.ghe.find((g) => g.id === 'g1')!.vi_the.btc).toBe(0);
    expect(sau.ghe.find((g) => g.id === 'g2')!.vi_the).toEqual({ btc: 1000 });
    const chay = { ...st, ghe: st.ghe.map((g) => (g.id === 'ban' ? { ...g, da_chay: true } : g)) };
    expect(apMg(chay, { ban: { ma: 'btc', loi: 250 } }).ghe.find((g) => g.id === 'ban')!.vi_the.btc).toBe(1000);
    expect(apMg(st, {})).toBe(st);
  });
});
