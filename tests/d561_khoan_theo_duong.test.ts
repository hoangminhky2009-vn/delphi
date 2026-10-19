/**
 * D561 — KHOẢN CHẠY THEO ĐƯỜNG TỚI CÚ BẤM ĐẦU (khoá v65 `khoanTheoDuong`, founder 08/10 chốt "Chữa trong v65"). Lỗ cũ (có trên prod v64): hễ có cú
 * VÀO / ĐẢO thì khoản được tính như tiền mặt ở GIÁ MỞ màn ⇒ màn giảm vào–ra sát cuối né trọn cú rơi (+15…+26 % khoản), màn tăng thì không bấm.
 * Vector chép tay trên đường giảm đều 100 → 75: mọi lõi vào–ra trong 10 nhịp cuối ⇒ lãi lỗ so với giữ ≈ 0 (chỉ phí / trượt); khoá cũ giữ lỗ (replay y nguyên).
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, SO_NHIP } from '../config/minigame.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { ketQuaMan, lenhBotBatDay, type LenhMan } from '../server/holdem/minigame/khop.js';

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
const GIAM = dong((k) => 100 - (25 * (k + 1)) / SO_NHIP);   // −25 % đều, không nến trắng
const VON = 10_000;
let seq = 0;
const L = (nhip: number, nut: string): LenhMan => ({ seq: ++seq, nhip, nut });
const chay = (la: string, lenh: LenhMan[], ktd: boolean) =>
  ketQuaMan({ min: GIAM, von: VON, ma: 'vn30', la, lenh, banBot: true, bk_x2: true, luotSong: true, ...(ktd ? { khoanTheoDuong: true } : {}) });
const VAO_RA: [string, string, string][] = [
  ['ban_khong', 'ban_x2', 'mua_lai'], ['don_bay', 'vao_x2', 'chot'], ['luot_song', 'dao', 'chot'],
  ['bat_day', 'vao_het', 'thoat'], ['mua_duoi', 'vao', 'chot_het'],
];

describe('D561 — khoản chạy theo đường tới cú bấm đầu', () => {
  for (const [la, vao, ra] of VAO_RA) {
    it(`⭐ ${la}: vào–ra trong 10 nhịp cuối của màn giảm 25 % ⇒ |lãi lỗ so với giữ| < 2,5 % khoản — chỉ phần thật trong 10 nhịp + 15 nhịp đứng ngoài (khoá cũ: > +15 %)`, () => {
      const lenh = [L(455, vao), L(465, ra)];
      const moi = chay(la, lenh, true), cu = chay(la, lenh, false);
      expect(cu.loi, 'khoá cũ còn lỗ — replay trận cũ y nguyên').toBeGreaterThan(0.15 * VON);
      expect(Math.abs(moi.loi)).toBeLessThan(0.025 * VON);
    });
  }
  it('⭐ Bắt Đáy: VÀO chỉ bằng tiền vừa BÁN BỚT — chưa bán thì cú VÀO không khớp (giữ suốt)', () => {
    const k = chay('bat_day', [L(100, 'vao_het')], true);
    expect(k.vao).toHaveLength(0);
    expect(k.tuDong).toBe(true);
    const b = chay('bat_day', [L(10, 'ban_bot'), L(400, 'vao_het')], true);
    expect(b.vao).toHaveLength(1);
    expect(b.vao[0]!.tien).toBe(VON / 2);   // đúng phần vừa bán
    // bán nửa ở ~99,5 rồi mua lại ở ~79 ⇒ lãi thật so với giữ, nhưng nhỏ hơn hẳn lỗ cũ
    expect(b.loi).toBeGreaterThan(0);
    expect(b.loi).toBeLessThan(0.15 * VON);
  });
  it('Đòn Bẩy vào từ đầu màn: kết quả gần như khoá cũ (khoản chưa kịp trôi)', () => {
    const lenh = [L(1, 'vao_x2'), L(470, 'chot')];
    const moi = chay('don_bay', lenh, true), cu = chay('don_bay', lenh, false);
    expect(Math.abs(moi.theoLenh - cu.theoLenh)).toBeLessThan(0.01 * VON);
  });
  it('Lướt Sóng đảo sang short từ nhịp 1 trên màn giảm ⇒ lãi thật (≈ 2 × cú rơi so với giữ)', () => {
    const x = chay('luot_song', [L(1, 'dao'), L(470, 'chot')], true);
    expect(x.loi).toBeGreaterThan(0.35 * VON);
  });
  it('bot Bắt Đáy khoá mới: bán bớt trước rồi mới VÀO (không thì cú VÀO không có tiền)', () => {
    const lenh = lenhBotBatDay(GIAM, { tu: 0, den: SO_NHIP }, true);
    expect(lenh[0]?.nut).toBe('ban_bot');
    expect(lenhBotBatDay(GIAM, { tu: 0, den: SO_NHIP }).some((x) => x.nut === 'ban_bot')).toBe(false);
  });
});

import { taoTran, type TrangThaiTran } from '../server/holdem/engine.js';
import { soDoGhe } from '../server/holdem_api.js';
import { luatCua, coManMinigame } from '../config/holdem.js';
import { boiCanhCuaGhe, dungDongManKhop, thamSoKhop } from '../server/holdem/minigame/quyet_toan.js';

describe('D561 — cờ đi tới màn thật (khoá → bối cảnh → khớp)', () => {
  const bcCua = (khoa: string, seed: number) => {
    const st0 = taoTran(seed, soDoGhe(seed, 'u') as never, luatCua(khoa), 14);
    const v = [2, 3, 4, 5].find((x) => coManMinigame(x, st0.map.o.length, st0.nhip_xen_ke === true))!;
    const st: TrangThaiTran = { ...st0, vong: v };
    return boiCanhCuaGhe(st, seed, v, { id: 'ban', vai: 'ca_nhan', trait: [], vi_the: { btc: 10000 }, von: 0 } as never, { btc: -2500 });
  };
  it('⭐ khoá v65: bối cảnh mang `khoan_theo_duong` ⇒ vào–ra sát cuối màn giảm không né được cú rơi; khoá v64 vẫn né (replay y nguyên)', () => {
    const moi = bcCua('balance-v65-thangkynang', 7_300_001), cu = bcCua('balance-v64-congoi', 7_300_001);
    if ('loi' in moi || 'loi' in cu) throw new Error('không dựng được màn');
    expect(moi.khoan_theo_duong).toBe(true);
    expect(cu.khoan_theo_duong).toBeUndefined();
    const lenh = [L(455, 'vao_x2'), L(465, 'chot')];
    const k = (bc: typeof moi) => ketQuaMan({ min: dungDongManKhop(bc, []), ...thamSoKhop(bc), la: 'don_bay', lenh });
    expect(k(cu).loi).toBeGreaterThan(0.1 * cu.von);
    // mua ×2 vào đường đang rơi rồi chốt: lỗ thật hoặc gần 0 — không còn khoản 'né cú rơi' miễn phí
    expect(k(moi).loi).toBeLessThan(0.02 * moi.von);
  });
});

describe('D561 — úp lá pha theo LOẠI Ô (cùng luật với API `upLaPha`)', () => {
  it('⭐ khoá v65: màn nằm trên ô pha (kể cả nguồn là lớp tin trước / dư âm) đều mang `up_la`; ô tin thì không; khoá v64 không bao giờ', () => {
    let pha = 0, lopTin = 0;
    for (let s = 0; s < 40; s++) {
      const seed = 2_000_003 + s * 7919;
      for (const khoa of ['balance-v65-thangkynang', 'balance-v64-congoi']) {
        const st0 = taoTran(seed, soDoGhe(seed, 'u') as never, luatCua(khoa), 14);
        for (let v = 1; v <= 13; v++) {
          if (!coManMinigame(v, st0.map.o.length, st0.nhip_xen_ke === true)) continue;
          const bc = boiCanhCuaGhe({ ...st0, vong: v }, seed, v, { id: 'ban', vai: 'ca_nhan', trait: [], vi_the: { btc: 10000 }, von: 0 } as never, null);
          if ('loi' in bc) continue;
          const o = st0.map.o[st0.o_up === true ? v : v - 1]!;
          expect(bc.up_la === true).toBe(khoa === 'balance-v65-thangkynang' && o.kind === 'giai_doan');
          if (khoa.includes('v65') && o.kind === 'giai_doan') { pha += 1; if (bc.nguon.kind === 'su_kien') lopTin += 1; }
        }
      }
    }
    expect(pha).toBeGreaterThan(50);
    expect(lopTin, 'bài không rỗng: có màn ô pha mà nguồn là lớp tin').toBeGreaterThan(5);
  });
});
