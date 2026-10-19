/**
 * D561 — GÓI THANG KỸ NĂNG (khoá v65 `balance-v65-thangkynang`). SPEC `docs/spec/thang-ky-nang-man.md`.
 *   §I   khoá v65 = v64 + đúng sáu cờ
 *   §II  BÁN KHỐNG ×2 (`banKhongX2`): khoá v65 chỉ nhận BÁN ×2, không TĂNG; khoá cũ giữ ×2 · ×4 · ×10
 *   §III BẮT ĐÁY / MUA ĐUỔI BÁN BỚT (`banBotBdMd`): bán nửa phần khoản giữ, tiền đó VÀO lại được; khoá cũ bỏ qua nút
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, SO_NHIP } from '../config/minigame.js';
import { luatCua } from '../config/holdem.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { ketQuaMan, mucDonBay, nutLoiCua, NUT_BAN_BOT, type LenhMan } from '../server/holdem/minigame/khop.js';

const V64 = 'balance-v64-congoi', V65 = 'balance-v65-thangkynang';

function dong(gia: (k: number) => number): NenMin[] {
  const ra: NenMin[] = [];
  for (let i = 0; i < NEN_LS * K_MIN; i++) ra.push({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 0, iSong: i, rut: 0, quet: null });
  let truoc = 100;
  for (let j = 0; j < SO_NHIP / 8; j++) {
    const tick = Array.from({ length: 8 }, (_, t) => gia(j * 8 + t));
    ra.push({ o: truoc, c: tick[7]!, h: Math.max(truoc, ...tick), l: Math.min(truoc, ...tick), tick, v: 0, iSong: j, rut: 0, quet: null });
    truoc = tick[7]!;
  }
  return ra;
}
let seq = 0;
const L = (nhip: number, nut: string): LenhMan => ({ seq: ++seq, nhip, nut });

describe('§I — khoá v65', () => {
  it('khác v64 đúng tám cờ của gói (sáu cờ 07/10 + khoản theo đường · úp lá pha 08/10)', () => {
    const a = luatCua(V64) as unknown as Record<string, unknown>, b = luatCua(V65) as unknown as Record<string, unknown>;
    const khac = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();
    expect(khac).toEqual(['banBotBdMd', 'banKhongX2', 'khoanTheoDuong', 'loiChonTruoc', 'nhieuMa', 'upLaPha', 'vaoGia', 'xepHangE']);
  });
});

describe('§II — Bán Khống ×2', () => {
  const xuong = dong((k) => 100 - k * 0.02);   // giá rơi đều 100 → ~90,4
  const chay = (bk: boolean, lenh: LenhMan[]) => ketQuaMan({ min: xuong, von: 1000, ma: 'cp_cn', la: 'ban_khong', lenh, ...(bk ? { bk_x2: true as const } : {}) });
  it('mức: chiều bán ở khoá v65 chỉ ×2; chiều mua và khoá cũ giữ [2, 4, 10]', () => {
    expect(mucDonBay({ bk_x2: true }, -1)).toEqual([2]);
    expect(mucDonBay({ bk_x2: true }, 1)).toEqual([2, 4, 10]);
    expect(mucDonBay({}, -1)).toEqual([2, 4, 10]);
  });
  it('⭐ khoá v65: BÁN ×4 / ×10 không khớp, BÁN ×2 khớp; TĂNG ×4 sau ×2 không khớp', () => {
    expect(chay(true, [L(10, 'ban_x4'), L(400, 'mua_lai')]).vao).toHaveLength(0);
    expect(chay(true, [L(10, 'ban_x10'), L(400, 'mua_lai')]).vao).toHaveLength(0);
    const x2 = chay(true, [L(10, 'ban_x2'), L(100, 'tang_x4'), L(400, 'mua_lai')]);
    expect(x2.vao).toHaveLength(1);
    expect(x2.db?.L).toBe(2);
  });
  it('khoá cũ: BÁN ×4 vẫn khớp (replay y nguyên)', () => {
    const cu = chay(false, [L(10, 'ban_x4'), L(400, 'mua_lai')]);
    expect(cu.vao).toHaveLength(1);
    expect(cu.db?.L).toBe(4);
  });
});

describe('§III — Bắt Đáy / Mua Đuổi bán bớt', () => {
  // 100 tới nhịp 100 · rơi về 80 ở nhịp 200 · hồi 95 ở cuối
  const hinh = dong((k) => (k <= 100 ? 100 : k <= 200 ? 100 - (k - 100) * 0.2 : 80 + (k - 200) * (15 / (SO_NHIP - 201))));
  const chay = (bot: boolean, la: string, lenh: LenhMan[]) => ketQuaMan({ min: hinh, von: 1000, ma: 'cp_cn', la, lenh, ...(bot ? { banBot: true } : {}) });
  it('nút: chỉ khoá v65 mới có BÁN BỚT ở hai lõi một chiều', () => {
    expect(nutLoiCua('bat_day', false, true)).toContain(NUT_BAN_BOT);
    expect(nutLoiCua('mua_duoi', false, true)).toContain(NUT_BAN_BOT);
    expect(nutLoiCua('bat_day', false, false)).not.toContain(NUT_BAN_BOT);
    expect(nutLoiCua('don_bay', false, true)).not.toContain(NUT_BAN_BOT);
  });
  for (const la of ['bat_day', 'mua_duoi']) {
    it(`⭐ ${la}: bán bớt trước cú rơi rồi VÀO ở đáy bằng tiền vừa bán ⇒ lãi; khoá cũ bỏ qua nút`, () => {
      const vaoNut = la === 'bat_day' ? 'vao_het' : 'vao';
      const co = chay(true, la, [L(50, NUT_BAN_BOT), L(200, vaoNut)]);
      const banBot = co.ra.filter((x) => x.lyDo === 'ban_bot');
      expect(banBot).toHaveLength(1);
      expect(banBot[0]!.tien).toBe(500);                 // nửa khoản giữ
      expect(co.vao).toHaveLength(1);                    // tiền vừa bán dùng được để VÀO
      expect(co.vao[0]!.tien).toBeLessThanOrEqual(500);  // chỉ phần đã bán thành tiền mặt
      expect(co.loi).toBeGreaterThan(30);                // tránh được nửa cú rơi + ăn cú hồi
      const cu = chay(false, la, [L(50, NUT_BAN_BOT)]);
      expect(cu.ra.filter((x) => x.lyDo === 'ban_bot')).toHaveLength(0);
      expect(cu.loi).toBe(0);
    });
  }
  it('đã VÀO thì BÁN BỚT không còn tác dụng (vốn màn lúc ấy là tiền mặt theo lệnh)', () => {
    const kq = chay(true, 'bat_day', [L(50, 'vao_nua'), L(60, NUT_BAN_BOT)]);
    expect(kq.ra.filter((x) => x.lyDo === 'ban_bot')).toHaveLength(0);
  });
});

/* ─── §IV — "đã vào giá" (cờ vaoGia) ─── */
import { taoTran, dungChuoi, loiSuatCongKhai, maVaoGia, vongXetVaoGia, type Ghe, type TrangThaiTran } from '../server/holdem/engine.js';
import { soDoGhe } from '../server/holdem_api.js';
import { boiCanhCuaGhe } from '../server/holdem/minigame/quyet_toan.js';
import { dungDongMan } from '../server/holdem/minigame/man.js';
import { VAO_GIA } from '../config/minigame.js';
import { TAI_SAN } from '../config/holdem.js';

describe('§IV — tin đã vào giá', () => {
  const tranV65 = (seed: number) => taoTran(seed, soDoGhe(seed, 'u') as never, luatCua(V65), 14);
  const oTien = (st: TrangThaiTran, v: number) => st.map.o[st.o_up === true ? v : v - 1];
  // gom các (seed, vòng) được xét
  const xet: { st: TrangThaiTran; v: number; dao: Set<string> }[] = [];
  for (let s = 0; s < 400 && xet.length < 160; s++) {
    const st = tranV65(4_200_001 + s * 7919);
    for (let v = 1; v <= 13; v++) if (vongXetVaoGia(st, v, oTien(st, v))) xet.push({ st, v, dao: maVaoGia(st, v, oTien(st, v)) });
  }
  it('chỉ ô TIN thật ở vòng có màn được xét; tỷ lệ bị đảo quanh 45 %', () => {
    expect(xet.length).toBeGreaterThan(100);
    for (const x of xet) expect(oTien(x.st, x.v)?.kind).toBe('su_kien');
    const p = xet.filter((x) => x.dao.size > 0).length / xet.length;
    expect(p).toBeGreaterThan(VAO_GIA.XAC_SUAT_BP / 10000 - 0.12);
    expect(p).toBeLessThan(VAO_GIA.XAC_SUAT_BP / 10000 + 0.12);
    // lá pha không bao giờ bị đảo
    const st = tranV65(4_200_001);
    for (let v = 1; v <= 13; v++) if (oTien(st, v)?.kind === 'giai_doan') expect(maVaoGia(st, v, oTien(st, v)).size).toBe(0);
  });
  it('⭐ engine: phần giá của mã bị đảo = −0,7 × phần gốc; bảng công khai = tổng chuỗi', () => {
    const x = xet.find((y) => y.dao.size > 0)!;
    const st = { ...x.st, vong: x.v }, o = oTien(st, x.v)!;
    const gheAo = { id: '__t__', loai: 'bot', bac_rank: '', von: 0, luot_khao_sat: 0, danh_muc: { tai_san: TAI_SAN.map((t) => t.id), chien_thuat: [], gan: {} },
      da_chay: false, vong_chay: null, tu_the: 'choi', vong_roi: null, so_lan_cat_lo: 0, vi_the: {} } as unknown as Ghe;
    const { chain } = dungChuoi(st, gheAo, o), cong = loiSuatCongKhai(st, o);
    for (const ma of x.dao) {
      const goc = chain.filter((m) => (m.kind === 'tai_san' || m.kind === 'echo') && (m as { id?: string }).id === ma).reduce((a, m) => a + m.delta_bp, 0);
      const vg = chain.find((m) => m.kind === 'vao_gia' && (m as { id?: string }).id === ma);
      if (goc === 0) continue;
      expect(vg?.delta_bp).toBe(-Math.trunc((goc * (10000 + VAO_GIA.DAO_BP)) / 10000));
      expect(cong[ma]).toBe(goc + vg!.delta_bp);
      expect(Math.sign(cong[ma]!)).toBe(-Math.sign(goc));
    }
    // cờ tắt ⇒ không có mắt xích vào giá
    expect(dungChuoi({ ...st, vao_gia: false }, gheAo, o).chain.some((m) => m.kind === 'vao_gia')).toBe(false);
  });
  it('⭐ màn: đi theo tin tới đầu gối rồi quay đầu, chốt ở % engine; dấu hiệu ~75 % màn đảo · ~15 % màn thường', () => {
    let dao = 0, daoDh = 0, thuong = 0, thuongDh = 0, kiemHinh = 0, dungHinh = 0;
    for (const x of xet) {
      const st = { ...x.st, vong: x.v }, o = oTien(st, x.v)!, cong = loiSuatCongKhai(st, o);
      for (const ma of ['btc', 'cp_cn', 'vn30']) {
        const g = { id: 'ban', vai: 'ca_nhan', trait: [], vi_the: { [ma]: 10000 }, von: 10000, danh_muc: { tai_san: [ma], chien_thuat: [] } } as never;
        const bc = boiCanhCuaGhe(st, x.st.seed, x.v, g, cong);
        if ('loi' in bc || !bc.vao_gia) continue;
        const min = dungDongMan(bc), n0 = NEN_LS * K_MIN, iK = n0 + VAO_GIA.KNEE_MIN;
        const coDh = min[iK]!.v > 2 * Math.max(...min.slice(iK - 8, iK).map((c) => c.v));
        if (bc.vao_gia === 'dao') {
          dao++; if (coDh) daoDh++;
          const g0 = min[n0 - 1]!.c, xK = min[iK]!.o, cuoi = min[min.length - 1]!.c, goc = -(bc.muc_tieu_bp! * 10000) / VAO_GIA.DAO_BP;
          if (Math.abs(bc.muc_tieu_bp!) > 150) {
            kiemHinh++;
            // trước đầu gối theo tin · sau đầu gối quay đầu (đám đông bot chạy sau có thể lật ca tin nhỏ — đo theo tỷ lệ)
            if (Math.sign(xK - g0) === Math.sign(goc) && Math.sign(cuoi - xK) === -Math.sign(goc)) dungHinh++;
          }
        } else { thuong++; if (coDh) thuongDh++; }
      }
    }
    expect(dao).toBeGreaterThan(30); expect(thuong).toBeGreaterThan(30); expect(kiemHinh).toBeGreaterThan(10);
    expect(dungHinh / kiemHinh).toBeGreaterThanOrEqual(0.9);
    expect(daoDh / dao).toBeGreaterThan(VAO_GIA.DAU_HIEU_BP / 10000 - 0.15);
    expect(thuongDh / thuong).toBeLessThan(VAO_GIA.NHAM_BP / 10000 + 0.15);
  });
});

import { laCuaMan } from '../server/holdem/minigame/khop.js';
import { tinhMgCaBan } from '../server/holdem/minigame/quyet_toan.js';
import { DONG_HO_MINIGAME, giayChonLa, giayManMinigame, coManMinigame } from '../config/holdem.js';

describe('§V — lõi chọn trước khi lật', () => {
  it('laCuaMan: lõi chọn lúc chốt thắng cú chọn lá trong màn; lõi không cầm ⇒ rơi về luật cũ', () => {
    const chonBatDay = [L(0, 'la_bat_day')];
    expect(laCuaMan(['bat_day', 'ban_khong'], chonBatDay, 'ban_khong')).toBe('ban_khong');
    expect(laCuaMan(['bat_day', 'ban_khong'], [], 'don_bay')).toBe('bat_day');
    expect(laCuaMan(['bat_day', 'ban_khong'], chonBatDay)).toBe('bat_day');
  });
  it('đồng hồ: khoá v65 bỏ pha chọn lá (0 s), khoá cũ giữ CHON_LA_S', () => {
    expect(giayChonLa(true)).toBe(0);
    expect(giayChonLa()).toBe(DONG_HO_MINIGAME.CHON_LA_S);
    expect(giayManMinigame() - giayManMinigame(true)).toBe(DONG_HO_MINIGAME.CHON_LA_S);
  });
  it('⭐ quyết toán: người CHƯA mở màn vẫn chơi bằng lõi đã chọn lúc chốt', () => {
    let soLan = 0;
    for (let s = 0; s < 30; s++) {
      const seed = 5_100_003 + s * 7919;
      const goc = taoTran(seed, soDoGhe(seed, 'u') as never, luatCua(V65), 14);
      const v = [2, 3, 4, 5, 6].find((x) => coManMinigame(x, goc.map.o.length, goc.nhip_xen_ke === true));
      if (!v) continue;
      const st: TrangThaiTran = { ...goc, vong: v, ghe: goc.ghe.map((g) => (g.id === 'ban'
        ? { ...g, vi_the: { btc: 3000 }, danh_muc: { ...g.danh_muc, chien_thuat: ['bat_day', 'ban_khong'] as never } } : g)) };
      const mac = tinhMgCaBan(st, { seedTran: seed, vong: v, loiSuat: null, ban: { lenh: [] } }).ban;
      const chon = tinhMgCaBan(st, { seedTran: seed, vong: v, loiSuat: null, ban: { lenh: [] }, loiMan: 'ban_khong' }).ban;
      if (!mac || !chon) continue;
      soLan += 1;
      expect(mac.la).toBe('bat_day');
      expect(chon.la).toBe('ban_khong');
    }
    expect(soLan).toBeGreaterThan(10);
  });
});

import { XEP_HANG_E, phanViBang } from '../config/holdem.js';
import { xepHang, diemCachE, vonDauCua } from '../server/holdem/engine.js';

describe('§VI — xếp hạng cách E', () => {
  it('phanViBang: ngoài hai đầu kẹp 0 / 10000; nội suy giữa hai điểm; đoạn phẳng lấy giữa', () => {
    const b = [0, 10, 20, 20, 20, 50];   // 5 khoảng ⇒ mỗi điểm 2000 bp
    expect(phanViBang(b, -5)).toBe(0);
    expect(phanViBang(b, 99)).toBe(10000);
    expect(phanViBang(b, 5)).toBe(1000);
    expect(phanViBang(b, 20)).toBe(6000);   // điểm 2..4 ⇒ giữa = 3
    expect(phanViBang(b, 35)).toBe(9000);
    for (const v of Object.values(XEP_HANG_E)) {
      expect(v).toHaveLength(21);
      for (let i = 1; i < v.length; i++) expect(v[i]!).toBeGreaterThanOrEqual(v[i - 1]!);
    }
  });
  /** bàn: ghế `ban` đổi vai `ca_map`, lỗ 20 % · một bot Cá nhân lãi 5 % · còn lại hoà vốn ⇒ trung vị 0. */
  const ban = (khoa: string) => {
    const goc = taoTran(7_700_001, soDoGhe(7_700_001, 'u') as never, luatCua(khoa), 14);
    const ghe = goc.ghe.map((g, i) => ({ ...g, vai: (i === 0 ? 'ca_map' : 'ca_nhan') as never, vi_the: {}, so_khong: undefined } as Ghe));
    const st0: TrangThaiTran = { ...goc, ghe };
    return { ...st0, ghe: st0.ghe.map((g, i) => ({ ...g, von: Math.round(vonDauCua(st0, g) * (i === 0 ? 0.8 : i === 1 ? 1.05 : 1)) })) };
  };
  it('⭐ khoá v65: Cá Mập lỗ 20 % (≈ p77 trong vai) xếp TRÊN Cá nhân lãi 5 % (≈ p55); khoá v64 thì ngược lại', () => {
    const e = ban(V65), cu = ban(V64);
    const d = diemCachE(e);
    expect(d[e.ghe[0]!.id]!).toBeGreaterThan(d[e.ghe[1]!.id]!);
    expect(xepHang(e)[0]).toBe(e.ghe[0]!.id);
    expect(xepHang(cu)[0]).toBe(cu.ghe[1]!.id);
  });
});

describe('§IV b — màn đã vào giá khi % engine lớn (bắt 08/10: phần gốc suy ngược ≤ −100 % ⇒ giá âm ⇒ NaN)', () => {
  it('⭐ % engine ±90 %: mọi nến hữu hạn, dương; điểm cuối quanh % engine', () => {
    let dem = 0;
    for (let s = 0; s < 120 && dem < 12; s++) {
      const seed = 9_000_001 + s * 7919;
      const st0 = taoTran(seed, soDoGhe(seed, 'u') as never, luatCua(V65), 14);
      for (let v = 1; v <= 13; v++) {
        const st = { ...st0, vong: v };
        const bc = boiCanhCuaGhe(st, seed, v, { id: 'ban', vai: 'ca_nhan', trait: [], vi_the: { cp_cn: 10000 }, von: 0 } as never, null);
        if ('loi' in bc || bc.vao_gia !== 'dao') continue;
        for (const muc of [9000, -9000]) {
          const min = dungDongMan({ ...bc, muc_tieu_bp: muc, von_sau: Math.round(10000 * (1 + muc / 10000)) });
          for (const c of min) for (const x of [c.o, c.c, c.h, c.l, c.v, ...c.tick]) { expect(Number.isFinite(x)).toBe(true); expect(x).toBeGreaterThanOrEqual(0); }
          const g0 = min[NEN_LS * K_MIN - 1]!.c, cuoi = min[min.length - 1]!.c;
          // đám đông chạy SAU neo lệch điểm cuối vài trăm bp ở MỌI màn (quyết toán qua `vet`, D521) ⇒ canh thô
          expect(Math.abs(Math.round((cuoi / g0 - 1) * 10000) - muc)).toBeLessThan(1000);
        }
        dem += 1;
      }
    }
    expect(dem).toBeGreaterThan(5);
  });
});
