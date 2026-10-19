/**
 * D482 — VAI TRONG KHUNG MINIGAME: bỏ LÕI GHIM, đổi thành TRAIT GHIM (founder 04/10: *"Bỏ lõi ghim, đổi thành trait ghim"* · *"Cá mập trait
 * đòn bẩy x1.5 còn đội lái được cái trait cho phép tung tin đồn ở đầu mini game"*). Vector tiền chép tay ở §I (A8.3).
 *   §I   vector tiền ×1,5 (chép tay)
 *   §II  engine: v57 không ghim lõi, cặp vai đọc trait ghim; v56 vế ngược còn ghim
 *   §III màn: ghế Cá mập ⇒ `he` 1,5 vào bối cảnh + quyết toán; giữ suốt vẫn ×1
 *   §IV  câu chữ vai/trait mang đúng số của config
 *   §V   D483 TUNG TIN: vector phí, xung tạm tan hết, phí ở mọi nhánh
 */
import { describe, expect, it } from 'vitest';
import { luatCua } from '../config/holdem_balance.js';
import { GAI_MAG, HE_DON_BAY_VAI, K_MIN, NEN_LS, NUT_GAI, PHI_GAI_BP } from '../config/minigame.js';
import { TRAIT_VAI_MINIGAME } from '../config/trait.js';
import { taoTran, vaiTheoLuat, type GheMoi, type TrangThaiTran } from '../server/holdem/engine.js';
import { traitHieuLuc } from '../server/holdem/trait.js';
import { kBanManh, laiVi, tranLo } from '../server/holdem/minigame/tien.js';
import { dungDongMan } from '../server/holdem/minigame/man.js';
import { gaiCuaMan, ketQuaMan } from '../server/holdem/minigame/khop.js';
import { boiCanhCuaGhe, boiCanhGhe, heManCua, tinhMgCaBan } from '../server/holdem/minigame/quyet_toan.js';
import type { VaiId } from '../server/holdem/vai.js';

const V57 = 'balance-v57-minigame', V56 = 'balance-v56-congdon';
const ghe = (id: string, loai: 'nguoi' | 'bot', vai?: VaiId): GheMoi =>
  ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] }, ...(vai ? { vai } : {}) });
const ban = (khoa: string) => taoTran(7, [ghe('ban', 'nguoi', 'ca_map'), ghe('g1', 'bot', 'doi_lai'), ghe('g2', 'bot', 'ca_nhan')], luatCua(khoa), 12);

describe('§I — vector tiền ×1,5 (chép tay, A8.3)', () => {
  it('hằng số: ×1,5 (founder), phí gài 3 % vốn màn (demo)', () => {
    expect(HE_DON_BAY_VAI).toBe(1.5);
    expect(PHI_GAI_BP).toBe(300);
  });
  it('vào 870 ở 100, ra ở 110, ×1,5: floor(870 × 1,5 × 10/100) = floor(130,5) = 130', () => {
    expect(laiVi(870, 100, 110, 1, 1.5)).toBe(130);
  });
  it('lỗ: vào 870 ở 100, ra ở 93, ×1,5: floor(870 × 1,5 × (−7)/100) = floor(−91,35) = −92', () => {
    expect(laiVi(870, 100, 93, 1, 1.5)).toBe(-92);
  });
  it('trần lỗ vẫn = cả khoản: giá −80 %, ×1,5 ⇒ thô −1.044 ⇒ −870', () => {
    expect(laiVi(870, 100, 20, 1, 1.5)).toBe(-1044);
    expect(tranLo(-1044, 870, 0)).toBe(-870);
  });
  it('bán mạnh của đòn bẩy ×1,5: trượt bán ×(1 + 0,1 × 0,5) = ×1,05', () => {
    expect(kBanManh(1.5, false)).toBeCloseTo(1.05, 12);
  });
});

describe('§II — engine: v57 thôi ghim lõi, cặp vai là trait ghim', () => {
  it('⭐ v57: ghế Cá mập · Đội lái vào bàn KHÔNG có lõi ở ô 1; trait hiệu lực = cặp minigame (ĐÒN BẨY ×1,5 · TUNG TIN)', () => {
    const st = ban(V57);
    for (const g of st.ghe) expect(g.danh_muc.chien_thuat, `${g.id} không ghim lõi`).toEqual([]);
    expect(traitHieuLuc(st, st.ghe.find((g) => g.id === 'ban')!)).toEqual([...TRAIT_VAI_MINIGAME.ca_map]);
    expect(traitHieuLuc(st, st.ghe.find((g) => g.id === 'g1')!)).toEqual([...TRAIT_VAI_MINIGAME.doi_lai]);
    expect(traitHieuLuc(st, st.ghe.find((g) => g.id === 'g2')!)).toEqual([]);
  });
  it('vế ngược — v56: Cá mập vẫn ghim Đòn Bẩy ở ô 1, cặp vai cũ', () => {
    const st = ban(V56);
    expect(st.ghe.find((g) => g.id === 'ban')!.danh_muc.chien_thuat[0]).toBe('don_bay');
    expect(traitHieuLuc(st, st.ghe.find((g) => g.id === 'ban')!)).toEqual(['ghim_don_bay', 'tac_dong_gia']);
  });
  it('bảng vai theo luật v57: không vai nào ghim lõi; câu đặc quyền nói trait ghim', () => {
    const b = vaiTheoLuat(luatCua(V57));
    for (const v of Object.values(b)) expect(v.loi_ghim, v.id).toBeNull();
    expect(b.ca_map.dac_quyen).toContain('ĐÒN BẨY ×1,5');
    expect(b.doi_lai.dac_quyen).toContain('TUNG TIN');
    expect(vaiTheoLuat(luatCua(V56)).ca_map.loi_ghim, 'vế ngược').toBe('don_bay');
  });
});

describe('§III — màn: đòn bẩy của ghế Cá mập', () => {
  const LS = { btc: 1500 };
  const dauVong3 = (seed: number): TrangThaiTran => {
    const st = taoTran(seed, [ghe('ban', 'nguoi', 'ca_map'), ghe('g1', 'bot', 'ca_map'), ghe('g2', 'bot', 'ca_nhan')], luatCua(V57), 12);
    return {
      ...st, vong: 3,
      ghe: st.ghe.map((g) => ({ ...g, vi_the: { btc: 1000 }, danh_muc: { ...g.danh_muc, chien_thuat: ['bat_day'] as never } })),
    };
  };
  it('`heManCua`: Cá mập 1,5 · Cá nhân 1', () => {
    const st = dauVong3(11);
    expect(heManCua(st, st.ghe.find((g) => g.id === 'ban')!)).toBe(1.5);
    expect(heManCua(st, st.ghe.find((g) => g.id === 'g2')!)).toBe(1);
  });
  it('⭐ VÀO HẾT ở nhịp 0: cùng giá vào, theo lệnh ×1,5 = floor(vốn × 1,5 × (giá ra − giá vào)/giá vào) (trần −vốn); GIỮ vẫn ×1', () => {
    let doDuoc = 0;
    for (const seed of [11, 22, 33, 44, 55]) {
      const st = dauVong3(seed);
      const bc = boiCanhGhe(st, seed, 2, { btc: 1000 }, LS, 1.5);
      if ('loi' in bc) throw new Error(bc.loi);
      expect(bc.he, 'đòn bẩy ghi vào bối cảnh màn').toBe(1.5);
      const min = dungDongMan(bc), lenh = [{ seq: 1, nhip: 0, nut: 'vao_het' }];
      const k1 = ketQuaMan({ min, von: bc.von, ma: 'btc', ...(bc.nac ? { nac: bc.nac } : {}), la: 'bat_day', lenh });
      const k15 = ketQuaMan({ min, von: bc.von, ma: 'btc', ...(bc.nac ? { nac: bc.nac } : {}), la: 'bat_day', lenh, he: 1.5 });
      if (k15.vao.length === 0) continue;   // nến đầu trắng bên bán ⇒ mua hụt, seed này không đo
      expect(k15.giu, 'giữ suốt không đòn bẩy').toBe(k1.giu);
      expect(k15.vao[0]!.khop).toBe(k1.vao[0]!.khop);
      const r = k15.ra[0]!;
      expect(r.ra, 'bán mạnh ×1,05 ⇒ giá ra thấp hơn ×1').toBeLessThan(k1.ra[0]!.ra);
      expect(k15.theoLenh).toBe(Math.max(Math.floor((bc.von * 1.5 * (r.ra - k15.vao[0]!.khop)) / k15.vao[0]!.khop + 1e-9), -bc.von));
      expect(k15.loi).toBe(k15.theoLenh - k15.giu + (k15.vet ?? 0));   // D521 — vết thác
      doDuoc += 1;
    }
    expect(doDuoc, 'không seed nào vào được thì bài này không đo gì').toBeGreaterThan(0);
  });
  it('quyết toán cả bàn: bot Cá mập cầm Bắt Đáy chơi với ×1,5 (khác bot cùng lệnh ×1)', () => {
    let khac = 0;
    for (const seed of [11, 22, 33, 44, 55]) {
      const st = dauVong3(seed);
      const { mg } = tinhMgCaBan(st, { seedTran: seed, vong: 2, loiSuat: LS, ban: { lenh: [] } });
      const g1 = mg.g1?.loi ?? 0, g2 = mg.g2?.loi ?? 0;   // cùng vị thế, cùng đường giá, cùng lệnh bot — chỉ khác đòn bẩy
      if (g1 !== g2) khac += 1;
    }
    expect(khac, 'đòn bẩy không tới quyết toán của bot').toBeGreaterThan(0);
  });
});

describe('§IV — câu chữ mang đúng số config', () => {
  it('đặc quyền Cá mập in ×1,5 = HE_DON_BAY_VAI; trait chữ (web) in phí gài = PHI_GAI_BP', () => {
    const b = vaiTheoLuat(luatCua(V57));
    expect(b.ca_map.dac_quyen).toContain(`×${String(HE_DON_BAY_VAI).replace('.', ',')}`);
  });
});

describe('§V — D483 TUNG TIN: gài tin giả đầu màn (thuần)', () => {
  const LS = { btc: 1500 };
  const dauVong3 = (seed: number): TrangThaiTran => {
    const st = taoTran(seed, [ghe('ban', 'nguoi', 'doi_lai'), ghe('g1', 'bot', 'ca_nhan')], luatCua(V57), 12);
    return { ...st, vong: 3, ghe: st.ghe.map((g) => ({ ...g, vi_the: { btc: 1000 }, danh_muc: { ...g.danh_muc, chien_thuat: ['bat_day'] as never } })) };
  };
  const GAI = [{ seq: 1, nhip: -1, nut: 'gai_tot' }];
  it('vector phí chép tay: vốn màn 870 × 3 % = 26,1 ⇒ floor 26; vốn 1.000 ⇒ 30', () => {
    expect(Math.floor((870 * PHI_GAI_BP) / 10000)).toBe(26);
    expect(Math.floor((1000 * PHI_GAI_BP) / 10000)).toBe(30);
    expect(NUT_GAI).toEqual({ gai_tot: 1, gai_xau: -1 });
    expect(GAI_MAG).toBe(0.03);
  });
  it('⭐ `boiCanhCuaGhe` (cửa mở màn + quyết toán): Đội lái ⇒ `tung_tin`, Cá mập ⇒ `he` 1,5, Cá nhân ⇒ không cả hai', () => {
    const st0 = taoTran(5, [ghe('ban', 'nguoi', 'doi_lai'), ghe('g1', 'bot', 'ca_map'), ghe('g2', 'bot', 'ca_nhan')], luatCua(V57), 12);
    const st = { ...st0, vong: 3, ghe: st0.ghe.map((g) => ({ ...g, vi_the: { btc: 1000 } })) };
    const bc = (id: string) => { const x = boiCanhCuaGhe(st, 5, 2, st.ghe.find((g) => g.id === id)!, LS); if ('loi' in x) throw new Error(x.loi); return x; };
    expect(bc('ban').tung_tin).toBe(true);
    expect(bc('ban').he).toBeUndefined();
    expect(bc('g1').he).toBe(1.5);
    expect(bc('g1').tung_tin).toBeUndefined();
    expect(bc('g2').he ?? 1).toBe(1);
    expect(bc('g2').tung_tin).toBeUndefined();
  });
  it('`gaiCuaMan`: cú gài ĐẦU TIÊN trước màn; cú gài trong màn (nhịp ≥ 0) không tính; không gài ⇒ 0', () => {
    expect(gaiCuaMan([])).toBe(0);
    expect(gaiCuaMan([{ seq: 2, nhip: -1, nut: 'gai_xau' }, { seq: 1, nhip: -1, nut: 'gai_tot' }])).toBe(1);
    expect(gaiCuaMan([{ seq: 1, nhip: 5, nut: 'gai_xau' }])).toBe(0);
    expect(gaiCuaMan([{ seq: 1, nhip: -1, nut: 'la_bat_day' }])).toBe(0);
  });
  it('⭐ đường giá: ghế TUNG TIN gài ▲ ⇒ giữa màn bị đẩy LÊN (đỉnh lệch ≈ 3 % × thanh khoản), giá đầu + giá cuối GIỮ NGUYÊN; ▼ đẩy xuống; ghế không trait ⇒ bỏ qua cú gài', () => {
    for (const seed of [11, 22, 33]) {
      const st = dauVong3(seed);
      const bc0 = boiCanhGhe(st, seed, 2, { btc: 1000 }, LS, 1, true);
      if ('loi' in bc0) throw new Error(bc0.loi);
      // D521 — bài này canh cú GÀI (tan hết); bỏ vết thanh lý của `thac_v2` để cú gài đổi đường không kéo theo vết khác nhau ở cuối màn.
      const { thac_v2: _v, ...bc } = bc0;
      expect(bc.tung_tin).toBe(true);
      const goc = dungDongMan(bc), len = dungDongMan(bc, GAI), xuong = dungDongMan(bc, [{ seq: 1, nhip: -1, nut: 'gai_xau' }]);
      const n0 = NEN_LS * K_MIN, cuoi = goc.length - 1;
      expect(len[n0 - 1]!.c).toBe(goc[n0 - 1]!.c);
      expect(len[cuoi]!.c).toBeCloseTo(goc[cuoi]!.c, 9);
      expect(xuong[cuoi]!.c).toBeCloseTo(goc[cuoi]!.c, 9);
      const lech = len.map((c, i) => c.c / goc[i]!.c - 1), lechX = xuong.map((c, i) => c.c / goc[i]!.c - 1);
      const dinh = Math.max(...lech), iDinh = lech.indexOf(dinh);
      const liq = 3;   // btc, nấc nền (bối cảnh dựng không qua nấc vòng ⇒ hệ số 1 nếu `nac` vắng)
      expect(dinh, `seed ${seed}: đỉnh xung`).toBeGreaterThan(0.5 * GAI_MAG * liq * (bc.nac ? 0.3 : 1));
      expect(iDinh - n0, 'xung rơi vào nửa đầu màn (nến 16..30 + dâng)').toBeGreaterThanOrEqual(16);
      expect(iDinh - n0).toBeLessThanOrEqual(36);
      expect(Math.min(...lechX)).toBeLessThan(0);
      for (let i = 0; i < n0 + 16; i++) expect(lech[i], 'trước cú gài không lệch').toBeCloseTo(0, 12);
      const khong = { ...bc }; delete (khong as { tung_tin?: true }).tung_tin;
      expect(dungDongMan(khong, GAI).map((c) => c.c), 'không trait ⇒ cú gài vô hiệu').toEqual(goc.map((c) => c.c));
    }
  });
  it('⭐ phí trừ ở MỌI nhánh: không bấm ⇒ loi = −phí; không cầm lõi ⇒ −phí; không trait ⇒ 0; giữ suốt không đổi', () => {
    const st = dauVong3(11);
    const bc = boiCanhGhe(st, 11, 2, { btc: 1000 }, LS, 1, true);
    if ('loi' in bc) throw new Error(bc.loi);
    const min = dungDongMan(bc, GAI), phi = Math.floor((bc.von * PHI_GAI_BP) / 10000);
    const coBan = { min, von: bc.von, ma: 'btc', ...(bc.nac ? { nac: bc.nac } : {}), lenh: GAI };
    const a = ketQuaMan({ ...coBan, la: 'bat_day', tungTin: true });
    expect(a.tuDong).toBe(true);
    expect(a.phiGai).toBe(phi);
    expect(a.loi).toBe(-phi + (a.vet ?? 0));   // D521 — người giữ suốt chịu đúng phần vết thác
    expect(a.giu).toBe(ketQuaMan({ ...coBan, min: dungDongMan(bc), la: 'bat_day', lenh: [] }).giu);
    expect(ketQuaMan({ ...coBan, la: null, tungTin: true }).loi, 'không cầm lõi').toBe(-phi + (a.vet ?? 0));
    expect(ketQuaMan({ ...coBan, la: 'bat_day' }).loi, 'không trait ⇒ không phí').toBe(a.vet ?? 0);
  });
  it('quyết toán cả bàn: người gài tin, không bấm ⇒ mg.ban = −phí trên mã của màn', () => {
    const st = dauVong3(22);
    const bc = boiCanhGhe(st, 22, 2, { btc: 1000 }, LS, 1, true);
    if ('loi' in bc) throw new Error(bc.loi);
    const { mg, ban } = tinhMgCaBan(st, { seedTran: 22, vong: 2, loiSuat: LS, ban: { lenh: GAI, bc } });
    expect(ban!.phiGai).toBe(Math.floor((bc.von * PHI_GAI_BP) / 10000));
    expect(mg.ban).toEqual({ ma: 'btc', loi: -ban!.phiGai + (ban!.vet ?? 0) });   // D521 — vết thác
  });
  it('⭐ quyết toán dựng đường CÙNG cú gài: vào ở nhịp 0, thoát ở ĐỈNH xung ⇒ kết quả = khớp trên đường đã gài, khác đường gốc', () => {
    const st = dauVong3(33);
    const bc = boiCanhGhe(st, 33, 2, { btc: 1000 }, LS, 1, true);
    if ('loi' in bc) throw new Error(bc.loi);
    const goc = dungDongMan(bc), gai = dungDongMan(bc, GAI), n0 = NEN_LS * K_MIN;
    const lech = gai.slice(n0).map((c, j) => c.c / goc[n0 + j]!.c - 1), jDinh = lech.indexOf(Math.max(...lech));
    const lenh = [...GAI, { seq: 2, nhip: 0, nut: 'vao_het' }, { seq: 3, nhip: jDinh * 8 + 7, nut: 'thoat' }];
    const { ban } = tinhMgCaBan(st, { seedTran: 33, vong: 2, loiSuat: LS, ban: { lenh, bc } });
    const coBan = { von: bc.von, ma: 'btc', ...(bc.nac ? { nac: bc.nac } : {}), la: 'bat_day', lenh, tungTin: true };
    const tren = ketQuaMan({ ...coBan, min: dungDongMan(bc, lenh) }), lech0 = ketQuaMan({ ...coBan, min: goc });
    expect(tren.ra.length + tren.hut.length, 'cú thoát phải được xét').toBeGreaterThan(0);
    expect(ban!.theoLenh).toBe(tren.theoLenh);
    expect(ban!.loi).toBe(tren.loi);
    if (tren.ra.length && !tren.ra[0]!.tuDongCuoi) expect(tren.theoLenh, 'thoát ở đỉnh xung ăn phần đẩy').toBeGreaterThan(lech0.theoLenh);
  });
});
