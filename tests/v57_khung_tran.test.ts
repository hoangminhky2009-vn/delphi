/**
 * v57 (D457) — KHOÁ MINIGAME · BƯỚC 2a: KHUNG TRẬN (bàn 12 · đồng hồ nhịp ngắn · vốn theo vai · kho trait hẹp).
 *
 * Kế hoạch: `docs/thiet-ke-de-xuat/gameplay/kien-truc-minigame.md` §7 bước 2a. Bài canh của bước 1 (bỏ cơ chế) là
 * `v57_bo_co_che.test.ts`. Khung này CHƯA có minigame — chỉ là cái hộp: bàn, đồng hồ, vốn, chợ trait.
 *
 * Mỗi bài dưới đây có MỘT VẾ NGƯỢC (cùng phép đo trên khoá cũ) — bài chỉ xanh vì "chưa ai bật" thì vế ngược sẽ đỏ (A11.23).
 *
 *   §I   CỔNG          ba cờ mới chỉ có ở v57 · `chiBan12` thay `chiBan16` · `vonDeu` đổi chiều
 *   §II  BÀN 12        map 12 ô = 11 vòng · lõi 2·4·6 · mốc trait 1·5·9 không trùng lõi · vòng cuối không shop
 *   §III ĐỒNG HỒ       đặt lệnh 15 s · đọc 5 s · phần cộng thêm của D442 GIỮ NGUYÊN · khoá cũ không nhúc nhích
 *   §IV  VỐN THEO VAI  `vonDeu: false` ⇒ vốn = START_VON × hệ số vai; v56 vốn đều
 *   §V   KHO TRAIT HẸP danh sách khoá · lượt mời luôn 3 + 3 cân 0 trong danh sách · bot cũng chỉ lấy trong danh sách
 *   §VI  ĐƯỜNG THẬT    qua HTTP + DB: cột `so_o` · DTO báo cờ · đồng hồ `doc_s` · chợ trait ở mốc 1·5·9
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { HOLDEM_BALANCE_VERSION } from '../config/holdem.js';
import { BO_LUAT_THEO_PHIEN_BAN, luatCua } from '../config/holdem_balance.js';
import {
  DONG_HO, DONG_HO_MINIGAME, HOLDEM_DECISIONS, HOLDEM_MATCH, LOI_MINIGAME, giayChonBai, giayManMinigame, loaiTheVong, nhipChonBai,
  vongChonChienThuat,
} from '../config/holdem.js';
import { CO_BAN_DUY_NHAT, CO_BAN_MINIGAME } from '../config/luoc_bo.js';
import { CHO_TRAIT, KHO_TRAIT_HEP, MOC_TRAIT, MOC_TRAIT_MINIGAME, TRAIT, type TraitId } from '../config/trait.js';
import { soiDongHo, themGiayTrait } from '../server/holdem/dong_ho.js';
import { allInMoCho, coLuotLoi, maxLoiCua, soLoiMoAllIn, taoTran, soVong, type Ghe, type GheMoi, type TrangThaiTran } from '../server/holdem/engine.js';
import { mua } from '../server/holdem/shop.js';
import { HE_SO_VON_V57, VAI, type VaiId } from '../server/holdem/vai.js';
import { apMocTrait, bayTrait, canHopLe, khoTraitCua, laMocTrait, tongDiem } from '../server/holdem/trait.js';
import { apMocTraitCaBan } from '../server/holdem/nhip_lenh_bot.js';
import { timBot, type Bot } from '../server/holdem/bots.js';

const V56 = 'balance-v56-congdon';
const V57 = 'balance-v57-minigame';
const BA_CO_MOI = ['chiBan12', 'dongHoMinigame', 'khoTraitHep'] as const;

const gheNguoi = (vai?: VaiId): GheMoi => ({
  id: 'ban', loai: 'nguoi', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] }, ...(vai ? { vai } : {}),
});
const gheBot = (i: number): GheMoi => ({
  id: `g${i}`, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] },
});
const GHE: GheMoi[] = [gheNguoi(), gheBot(1)];
const tran = (khoa: string, soO: number, seed = 4470, ghe: readonly GheMoi[] = GHE): TrangThaiTran =>
  taoTran(seed, ghe, luatCua(khoa), soO);

const KHO_CHUNG: readonly TraitId[] = TRAIT.filter((t) => !t.vai).map((t) => t.id);
/** D528 — bốn lá MỚI của khoá v59 (`KHO_TRAIT_V59`) không thuộc câu hỏi "kho hẹp v57 gác lá nào" — chúng chưa từng ở kho chung của khoá cũ. */
const LA_V59: readonly TraitId[] = ['ke_mua', 'ke_ban', 'tam_ly_yeu', 'soi_vai'];
const BI_GAC: readonly TraitId[] = KHO_CHUNG.filter((id) => !KHO_TRAIT_HEP.includes(id) && !LA_V59.includes(id));

/* ═══ I. CỔNG ═══════════════════════════════════════════════════════════════════════════════ */
describe('§I — cổng', () => {
  it('⭐ ba cờ khung trận CHỈ có ở v57 — mọi khoá cũ vắng chúng (replay không đổi một bit)', () => {
    for (const [khoa, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      const l = luat as unknown as Record<string, unknown>;
      // D526 — v58 kế thừa v57: hai cờ khung (`dongHoMinigame` · `khoTraitHep`) BẬT, `chiBan12` nhường cho `nhipXenKe` (bàn 8).
      if (l.nhipXenKe === true) {   // D528 → D530 — mọi khoá kế thừa v58 (nhịp xen kẽ): ghim TÍNH CHẤT, không liệt kê tên khoá
        expect([l.chiBan12, l.dongHoMinigame, l.khoTraitHep], khoa).toEqual([false, true, true]);
        continue;
      }
      for (const co of BA_CO_MOI) {
        if (khoa === V57) expect(l[co], `${khoa}.${co} phải BẬT`).toBe(true);
        else expect(l[co], `${khoa}.${co} phải vắng/tắt`).toBeFalsy();
      }
    }
    // Khoá lạ (tắt hết) cũng không được mang chúng.
    for (const co of BA_CO_MOI) {
      expect((luatCua('balance-khong-ton-tai-d457') as unknown as Record<string, unknown>)[co]).toBeFalsy();
    }
  });

  it('`chiBan12` thay `chiBan16`: v57 bật cái trước, tắt cái sau; v56 ngược lại; không khoá nào bật CẢ HAI (mơ hồ)', () => {
    expect(luatCua(V57).chiBan12).toBe(true);
    expect(luatCua(V57).chiBan16).toBe(false);
    expect(luatCua(V56).chiBan12).toBeFalsy();
    expect(luatCua(V56).chiBan16).toBe(true);
    for (const [khoa, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      const l = luat as unknown as Record<string, unknown>;
      expect(Boolean(l.chiBan12) && Boolean(l.chiBan16), `${khoa} bật cả hai cỡ bàn duy nhất`).toBe(false);
    }
  });

  it('`vonDeu` đổi chiều: v57 TẮT (vốn theo vai), v56 BẬT (vốn đều)', () => {
    expect(luatCua(V57).vonDeu).toBe(false);
    expect(luatCua(V56).vonDeu).toBe(true);
    expect(luatCua(V57).vaiCoRang, 'tắt vốn đều mà vai không có răng thì không đổi gì').toBe(true);
  });

  it('D525 → D530 — mặc định kế thừa khung v57 + nhịp xen kẽ v58 + kê lệnh v59; v57 không bao giờ là mặc định', () => {
    expect(HOLDEM_BALANCE_VERSION).not.toBe(V57);
    expect(luatCua(HOLDEM_BALANCE_VERSION).keLenhV59).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).nhipXenKe).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).dongHoMinigame).toBe(true);
  });
});

/* ═══ II. BÀN 12 ════════════════════════════════════════════════════════════════════════════ */
describe('§II — bàn 12 ô', () => {
  it('hằng số: `CO_BAN_MINIGAME` = 12, nằm trong `CO_MAP_CHON` (DB CHECK migration 0023 đã cho 12), khác `CO_BAN_DUY_NHAT`', () => {
    expect(CO_BAN_MINIGAME).toBe(12);
    expect(CO_BAN_DUY_NHAT).toBe(16);
    expect(HOLDEM_DECISIONS.CO_MAP_CHON as readonly number[]).toContain(CO_BAN_MINIGAME);
  });

  it('⭐ trận v57 dựng ở 12 ô: 12 ô, ô đầu lật sẵn ⇒ 11 vòng — vế ngược: v56 ở 16 ô là 15 vòng', () => {
    const a = tran(V57, CO_BAN_MINIGAME);
    expect(a.map.o).toHaveLength(12);
    expect(a.o_up).toBe(true);
    expect(soVong(a)).toBe(11);
    const b = tran(V56, CO_BAN_DUY_NHAT);
    expect(b.map.o).toHaveLength(16);
    expect(soVong(b)).toBe(15);
  });

  it('nhịp bàn 12: thẻ chiến thuật vòng 2·4·6; vòng 11 không còn shop', () => {
    expect(vongChonChienThuat(12)).toEqual([2, 4, 6]);
    for (const v of [2, 4, 6]) expect(loaiTheVong(v, 12)).toBe('chien_thuat');
    expect(loaiTheVong(11, 12)).toBe('khong');
    expect(loaiTheVong(1, 12)).toBe('tai_san');
  });

  it('⭐ D473 — nhịp lõi của KHUNG MINIGAME bàn 12 là 1·4·6 (lõi trước màn đầu tiên ở vòng 2); vắng cờ ⇒ 2·4·6 byte-hệt', () => {
    expect(vongChonChienThuat(12, false, true)).toEqual([1, 4, 6]);
    expect(loaiTheVong(1, 12, false, true)).toBe('chien_thuat');
    expect(loaiTheVong(2, 12, false, true)).toBe('tai_san');
    expect(nhipChonBai(12, false, false, true).filter((x) => x === 'chien_thuat')).toHaveLength(3);
    // Vế ngược: tham số vắng = nhịp cũ.
    expect(nhipChonBai(12)).toEqual(nhipChonBai(12, false, false, false));
    expect(nhipChonBai(16)).toEqual(nhipChonBai(16, false, false, false));
  });

  it('⭐ mốc chợ trait của KHUNG MINIGAME bàn 12 là 5·9 (D473: vòng 1 nhường cho lượt LÕI) — KHÔNG mốc nào trùng vòng lõi 1·4·6, nằm trong 11 vòng; bàn 16 giữ 1·6·9·13', () => {
    expect(MOC_TRAIT_MINIGAME[12]).toEqual([5, 9]);
    expect(MOC_TRAIT[16]).toEqual([1, 6, 9, 13]);
    const lo = vongChonChienThuat(12, false, true);
    for (const m of MOC_TRAIT_MINIGAME[12]!) {
      expect(lo, `mốc ${m} trùng vòng lõi`).not.toContain(m);
      expect(m).toBeLessThanOrEqual(11);
    }
    const st = tran(V57, 12);
    for (let v = 1; v <= 11; v += 1) {
      expect(laMocTrait(v, 12, st), `vòng ${v}`).toBe([5, 9].includes(v));
    }
  });

  it('⭐ REPLAY-SAFETY (golden `--kiem` đã bắt lỗi này ở bản đầu): bàn 12 của khoá CŨ KHÔNG có chợ trait — bảng chung không có cỡ 12, v56 ở 12 ô không mốc nào', () => {
    expect(MOC_TRAIT[12], 'thêm cỡ 12 vào bảng CHUNG là mở chợ cho mọi khoá cũ có `trait`').toBeUndefined();
    expect(Object.keys(MOC_TRAIT).map(Number)).toEqual([16]);
    const st56 = tran(V56, 12);
    expect(st56.trait_bat, 'v56 phải có hệ trait — không thì bài này đo điều luôn đúng').toBe(true);
    expect(st56.trait_kho_hep).toBeUndefined();
    for (let v = 1; v <= 11; v += 1) {
      expect(laMocTrait(v, 12), `v56 bàn 12 vòng ${v}`).toBe(false);
      expect(laMocTrait(v, 12, st56), `v56 bàn 12 vòng ${v} (có st)`).toBe(false);
      expect(themGiayTrait(st56, v), `v56 bàn 12 vòng ${v}: giây cộng thêm`).toBe(0);
    }
    // Vế ngược: cùng cỡ, cùng vòng, nhưng trận mang cờ khung minigame ⇒ có chợ.
    expect(laMocTrait(5, 12, tran(V57, 12))).toBe(true);
    expect(laMocTrait(5, 12, { trait_kho_hep: true })).toBe(true);
    expect(laMocTrait(5, 12, { trait_kho_hep: false })).toBe(false);
    // Cỡ KHÔNG có trong bảng minigame rơi về bảng chung: v57 ở 16 ô (nếu ai dựng) vẫn là 1·6·9·13.
    for (const v of [1, 6, 9, 13]) expect(laMocTrait(v, 16, { trait_kho_hep: true })).toBe(true);
    expect(laMocTrait(5, 16, { trait_kho_hep: true })).toBe(false);
  });
});

/* ═══ III. ĐỒNG HỒ ══════════════════════════════════════════════════════════════════════════ */
describe('§III — đồng hồ nhịp ngắn', () => {
  it('số của founder (03/10): đặt lệnh 15 s · đọc kết quả 5 s · cộng thêm vòng lõi/mốc trait 20 s (D459) · khung minigame chừa 8 + 4 + 34', () => {
    expect(DONG_HO_MINIGAME.CHON_BAI_S).toBe(15);
    expect(DONG_HO_MINIGAME.XEM_KET_QUA_S).toBe(5);
    expect(DONG_HO_MINIGAME.CHON_BAI_THEM_KHI_CO_THE_S).toBe(20);
    expect(DONG_HO_MINIGAME.CHON_TRAIT_THEM_S).toBe(20);
    // Vế ngược: số của khoá cũ (D442) không bị kéo theo.
    expect(DONG_HO.CHON_BAI_THEM_KHI_CO_THE_S).toBe(25);
    expect(DONG_HO.CHON_TRAIT_THEM_S).toBe(25);
    expect(DONG_HO_MINIGAME.CHON_LA_S).toBe(8);
    expect(DONG_HO_MINIGAME.DEM_NGUOC_S).toBe(4);
    expect(DONG_HO_MINIGAME.CHAY_S).toBe(34);
  });

  it('⭐ D473 — màn minigame của vòng TRƯỚC nằm TRONG hạn vòng này: lật thẻ 3 + chọn lá 8 + đếm 4 + chạy 34 = 49 s, chỉ từ vòng 3 (màn đầu là của vòng 2)', () => {
    expect(DONG_HO_MINIGAME.LAT_THE_S).toBe(3);
    expect(giayManMinigame()).toBe(49);
    expect(giayChonBai(2, 12, false, true)).toBe(DONG_HO_MINIGAME.CHON_BAI_S + DONG_HO_MINIGAME.XEM_KET_QUA_S);
    expect(giayChonBai(3, 12, false, true) - giayChonBai(2, 12, false, true)).toBe(giayManMinigame());
    // Vế ngược: đồng hồ cũ không có màn — hai vòng thường (3 và 5 ở nhịp cũ 2·4·6) bằng nhau.
    expect(giayChonBai(3, 12, false, false)).toBe(giayChonBai(5, 12, false, false));
  });

  it('⭐ vòng thường (≥ 3, không lõi, không mốc trait): 15 + 5 + màn 49 = 69 s — vế ngược: đồng hồ cũ cùng vòng là 25 + 15 = 40 s', () => {
    expect(giayChonBai(7, 12, false, true)).toBe(DONG_HO_MINIGAME.CHON_BAI_S + DONG_HO_MINIGAME.XEM_KET_QUA_S + giayManMinigame());
    expect(giayChonBai(7, 12, false, true)).toBe(69);
    expect(giayChonBai(7, 12, false, false)).toBe(DONG_HO.CHON_BAI_S + DONG_HO.XEM_KET_QUA_S);
    expect(giayChonBai(7, 12, false, false)).toBe(40);
    // Tham số mới vắng = đồng hồ cũ, byte-hệt (golden còn khoá cả đường dài; đây là nhát đo ngắn).
    expect(giayChonBai(7, 12)).toBe(giayChonBai(7, 12, false, false));
    expect(giayChonBai(7, 16)).toBe(giayChonBai(7, 16, false, false));
  });

  it('vòng 1: không có kết quả để đọc, không có màn — nhưng D473 là lượt LÕI ⇒ 45 + 20; đồng hồ cũ (vòng 1 tài sản) giữ 45', () => {
    expect(giayChonBai(1, 12, false, true)).toBe(DONG_HO.CHON_BAI_VONG_1_S + DONG_HO_MINIGAME.CHON_BAI_THEM_KHI_CO_THE_S);
    expect(giayChonBai(1, 12, false, false)).toBe(DONG_HO.CHON_BAI_VONG_1_S);
  });

  it('⭐ phần CỘNG THÊM co về +20 s (D459): vòng lõi + `DONG_HO_MINIGAME.CHON_BAI_THEM_KHI_CO_THE_S`, mốc trait + `DONG_HO_MINIGAME.CHON_TRAIT_THEM_S` (qua `themGiayTrait`)', () => {
    for (const v of [4, 6]) {
      expect(giayChonBai(v, 12, false, true)).toBe(20 + DONG_HO_MINIGAME.CHON_BAI_THEM_KHI_CO_THE_S + giayManMinigame());
      expect(giayChonBai(v, 12, false, true)).toBe(89);
    }
    for (const v of [2, 4, 6]) {
      // Vế ngược: đồng hồ cũ cùng vòng (nhịp cũ 2·4·6) vẫn cộng 25 s của D442.
      expect(giayChonBai(v, 12, false, false)).toBe(40 + DONG_HO.CHON_BAI_THEM_KHI_CO_THE_S);
    }
    const st = tran(V57, 12);
    for (const v of MOC_TRAIT_MINIGAME[12]!) expect(themGiayTrait(st, v), `mốc ${v}`).toBe(DONG_HO_MINIGAME.CHON_TRAIT_THEM_S);
    for (const v of [1, 2, 3, 4, 6, 7, 8, 10, 11]) expect(themGiayTrait(st, v), `vòng ${v}`).toBe(0);
    // Vế ngược: trận KHÔNG có hệ trait thì không có phần cộng.
    expect(themGiayTrait({ ...st, trait_bat: false }, 5)).toBe(0);
    // Vế ngược: cổng là CỜ ĐỒNG HỒ của trận, không phải cỡ bàn — gỡ cờ thì về 25 s; khoá cũ ở bàn 16 vẫn 25 s.
    expect(themGiayTrait({ ...st, dong_ho_minigame: false }, 5)).toBe(DONG_HO.CHON_TRAIT_THEM_S);
    const st56 = tran(V56, 16);
    for (const v of [1, 6, 9, 13]) expect(themGiayTrait(st56, v), `v56 mốc ${v}`).toBe(DONG_HO.CHON_TRAIT_THEM_S);
  });

  it('⭐ `soiDongHo` chuyền cờ tới `giayChonBai`: từng vòng bàn 12 = đặt lệnh + đọc + lõi + màn + mốc trait, đúng từng phần', () => {
    const st = tran(V57, 12);
    const moLuc = new Date('2026-10-03T00:00:00Z');
    const now = new Date('2026-10-03T00:00:01Z');
    const loi = new Set(vongChonChienThuat(12, false, true));
    let tong = 0;
    for (let v = 1; v <= 11; v += 1) {
      const them = themGiayTrait(st, v);
      const ngan = soiDongHo(moLuc, v, 12, now, them, false, true).tong_s;
      expect(ngan, `vòng ${v}`).toBe(giayChonBai(v, 12, false, true) + them);
      const tung = (v === 1 ? DONG_HO.CHON_BAI_VONG_1_S : DONG_HO_MINIGAME.CHON_BAI_S + DONG_HO_MINIGAME.XEM_KET_QUA_S)
        + (loi.has(v) ? DONG_HO_MINIGAME.CHON_BAI_THEM_KHI_CO_THE_S : 0) + (v >= 3 ? giayManMinigame() : 0) + them;
      expect(ngan, `vòng ${v}`).toBe(tung);
      // Vế ngược: cờ tắt ⇒ đúng đồng hồ cũ của `giayChonBai` (không màn, nhịp lõi cũ).
      expect(soiDongHo(moLuc, v, 12, now, them, false, false).tong_s).toBe(giayChonBai(v, 12, false, false) + them);
      tong += ngan;
    }
    // Số đo để người sau biết trận dài cỡ nào (D473): 11 vòng gồm cả 9 màn = 786 s (13 phút 06).
    // (D459 chưa tính màn: 365 s.) 65 · 20 · 69 · 89 · 89 · 89 · 69 · 69 · 89 · 69 · 69.
    expect(tong).toBe(786);
  });

  it('trạng thái trận v57 mang cờ; v56 vắng', () => {
    expect(tran(V57, 12).dong_ho_minigame).toBe(true);
    expect(tran(V56, 16).dong_ho_minigame).toBeUndefined();
  });
});

/* ═══ III-b. LUẬT LÕI CỦA KHUNG (D473) ════════════════════════════════════════════════════ */
describe('§III-b — tối đa 2 lõi, lượt 1·4, lượt 3 (vòng 6) chỉ cho KHẨU VỊ ĐA DẠNG', () => {
  const ban = (st: TrangThaiTran): Ghe => st.ghe.find((g) => g.id === 'ban')!;
  const voiTrait = (st: TrangThaiTran, trait: TraitId[]): Ghe => ({ ...ban(st), trait });
  const voiLoi = (st: TrangThaiTran, loi: string[]): Ghe => ({ ...ban(st), danh_muc: { ...ban(st).danh_muc, chien_thuat: loi as never } });

  it('⭐ trần lõi theo ghế: v57 = 2, cầm `tam_rong` = 3; v56 = hằng cũ', () => {
    const a = tran(V57, 12);
    expect(LOI_MINIGAME.TRAIT_LUOT_3).toBe('tam_rong');
    expect(maxLoiCua(a, ban(a))).toBe(2);
    expect(maxLoiCua(a, voiTrait(a, ['tam_rong']))).toBe(3);
    expect(maxLoiCua(a, voiTrait(a, ['may_xu']))).toBe(2);
    const b = tran(V56, 16);
    expect(maxLoiCua(b, voiTrait(b, ['tam_rong']))).toBe(HOLDEM_MATCH.MAX_CHIEN_THUAT);
  });

  it('⭐ lượt lõi theo ghế: v57 vòng 1 · 4 có, vòng 6 CHỈ ghế khẩu vị đa dạng, mọi vòng khác không; v56 luôn có (D441, byte-hệt)', () => {
    const a = tran(V57, 12);
    const thuong = ban(a), khauVi = voiTrait(a, ['tam_rong']);
    for (let v = 1; v <= 11; v += 1) {
      expect(coLuotLoi(a, thuong, v), `thường vòng ${v}`).toBe([1, 4].includes(v));
      expect(coLuotLoi(a, khauVi, v), `khẩu vị vòng ${v}`).toBe([1, 4, 6].includes(v));
    }
    const b = tran(V56, 16);
    for (let v = 1; v <= 15; v += 1) expect(coLuotLoi(b, ban(b), v)).toBe(true);
  });

  it('⭐ All-in mở ở 2 lõi KHÁC NHAU trong khung (ngưỡng 3 không bao giờ tới khi trần là 2); v56 vẫn 3', () => {
    const a = tran(V57, 12);
    expect(soLoiMoAllIn(a)).toBe(2);
    expect(allInMoCho(a, voiLoi(a, ['bat_day']))).toBe(false);
    expect(allInMoCho(a, voiLoi(a, ['bat_day', 'bat_day']))).toBe(false);
    expect(allInMoCho(a, voiLoi(a, ['bat_day', 'ban_khong']))).toBe(true);
    const b = tran(V56, 16);
    expect(soLoiMoAllIn(b)).toBe(3);
    expect(allInMoCho(b, voiLoi(b, ['bat_day', 'ban_khong']))).toBe(false);
  });

  it('`mua` nhận trần lõi: lõi KHÁC thứ ba bị chối `day_chien_thuat`, bản sao (nâng cấp) vẫn qua; vắng trần ⇒ hằng cũ', () => {
    const dm = { tai_san: [], chien_thuat: ['bat_day', 'ban_khong'] } as never;
    const shop = { tai_san: [], chien_thuat: ['mua_duoi', 'bat_day'] } as never;
    const ba = mua(dm, shop, 'mua_duoi', { maxLoi: 2 });
    expect(ba.ok).toBe(false);
    expect(!ba.ok && ba.loi).toBe('day_chien_thuat');
    expect(mua(dm, shop, 'bat_day', { maxLoi: 2 }).ok).toBe(true);
    expect(mua(dm, shop, 'mua_duoi', { maxLoi: 3 }).ok).toBe(true);
    expect(mua(dm, shop, 'mua_duoi').ok, 'vắng trần = MAX_CHIEN_THUAT (3)').toBe(true);
  });
});

/* ═══ IV. VỐN THEO VAI ══════════════════════════════════════════════════════════════════════ */
describe('§IV — vốn theo vai (`vonDeu: false`)', () => {
  const vonBan = (st: TrangThaiTran): number => st.ghe.find((g) => g.id === 'ban')!.von;
  const VAI_ID = Object.keys(VAI) as VaiId[];

  it('⭐ v57 (D506 `vonVaiV57`): vốn khởi điểm = START_VON × HE_SO_VON_V57 — Cá nhân ×1 · Đội lái ×10 · Cá mập ×20 · Tổ chức ×50 (founder chọn mức 3)', () => {
    expect(HE_SO_VON_V57).toEqual({ ca_nhan: 1, doi_lai: 10, ca_map: 20, to_chuc: 50 });
    for (const vai of VAI_ID) {
      const st = tran(V57, 12, 7, [gheNguoi(vai), gheBot(1)]);
      expect(vonBan(st), vai).toBe(HOLDEM_MATCH.START_VON * HE_SO_VON_V57[vai]);
      expect(st.von_vai_v57).toBe(true);
    }
  });

  it('vế ngược: v56 vốn ĐỀU — mọi vai đều START_VON; và hệ số vai có KHÁC nhau thật (không thì bài trên đo điều luôn đúng)', () => {
    for (const vai of VAI_ID) {
      const st = tran(V56, 16, 7, [gheNguoi(vai), gheBot(1)]);
      expect(vonBan(st), vai).toBe(HOLDEM_MATCH.START_VON);
    }
    expect(new Set(VAI_ID.map((v) => VAI[v].he_so_von)).size).toBeGreaterThan(1);
    expect(VAI.ca_nhan.he_so_von).toBe(1);
    expect(VAI.ca_map.he_so_von).toBeGreaterThan(1);
  });

  it('`von_deu` không có mặt trên trạng thái v57; có ở v56 (cờ trạng thái đi theo luật)', () => {
    expect(tran(V57, 12).von_deu).toBeUndefined();
    expect(tran(V56, 16).von_deu).toBe(true);
  });
});

/* ═══ V. KHO TRAIT HẸP ══════════════════════════════════════════════════════════════════════ */
describe('§V — kho trait hẹp', () => {
  const SEEDS = Array.from({ length: 120 }, (_, i) => 1000 + i * 37);

  it('⭐ danh sách KHOÁ: mười sáu lá, thuộc kho chung (không cặp vai), mười TÀI (D473 `tam_rong`, D486 KIÊN NHẪN, D498 RẢI LỆNH ba cấp độc quyền) + sáu TẬT', () => {
    expect([...KHO_TRAIT_HEP].sort()).toEqual([
      'di_sau', 'giu_nhiet', 'gong_cum', 'kien_nhan', 'mat_tri', 'may_xu', 'mu_lua', 'noi_gian', 'nong_voi', 'rai_lenh_2', 'rai_lenh_3', 'rai_lenh_5',
      'sang_so', 'suong_mu', 'tam_rong', 'te_liet',
    ]);
    for (const id of KHO_TRAIT_HEP) expect(KHO_CHUNG, id).toContain(id);
    const tai = KHO_TRAIT_HEP.filter((id) => TRAIT.find((t) => t.id === id)!.loai === 'tai');
    expect(tai).toHaveLength(10);
    expect(KHO_TRAIT_HEP.length - tai.length).toBe(6);
  });

  it('bảy lá còn bị GÁC là đúng những lá đổi nghĩa khi lãi/lỗ dồn vào màn chơi (kiến trúc §6b) — D486 đã mở KIÊN NHẪN · NÓNG VỘI (chạy trong màn)', () => {
    expect([...BI_GAC].sort()).toEqual([
      'chot_non', 'ky_luat', 'lenh_min', 'lo_lenh', 'mot_gio', 'mu_tin', 'so_mong',
    ]);
  });

  it('⭐ lượt mời ở mốc 5·9, 120 seed: luôn 3 TÀI + 3 TẬT, cân đúng 0, TOÀN BỘ nằm trong danh sách', () => {
    for (const seed of SEEDS) {
      for (const moc of MOC_TRAIT_MINIGAME[12]!) {
        const moi = bayTrait(seed, 'ban', moc, 0, [], KHO_TRAIT_HEP);
        expect(moi, `seed ${seed} mốc ${moc}`).toHaveLength(6);
        expect(tongDiem(moi), `seed ${seed} mốc ${moc} lệch cân`).toBe(0);
        for (const id of moi) expect(KHO_TRAIT_HEP, `seed ${seed} mốc ${moc}: ${id} ngoài danh sách`).toContain(id);
        expect(new Set(moi).size).toBe(6);
        expect(moi.filter((id) => TRAIT.find((t) => t.id === id)!.loai === 'tai')).toHaveLength(3);
        expect(canHopLe(moi)).toBe(true);
      }
    }
  });

  it('vế ngược: CÙNG dải seed không khoá kho thì có lượt mời chào lá bị gác (không thì bài trên đo điều luôn đúng)', () => {
    let coGac = 0;
    for (const seed of SEEDS) {
      const moi = bayTrait(seed, 'ban', 1, 0, []);
      if (moi.some((id) => BI_GAC.includes(id))) coGac += 1;
    }
    expect(coGac / SEEDS.length, 'kho đầy phải chào lá bị gác ở đa số lượt').toBeGreaterThan(0.8);
  });

  it('đang mang lá: lá đó không chào lại, lượt mời vẫn trong danh sách và vẫn cân 0 (kho cạn thì ngắn hơn)', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const mang: TraitId[] = ['noi_gian', 'gong_cum'];
      const moi = bayTrait(seed, 'ban', 5, 0, mang, KHO_TRAIT_HEP);
      for (const id of moi) {
        expect(mang, `seed ${seed}: chào lại lá đang mang`).not.toContain(id);
        expect(KHO_TRAIT_HEP).toContain(id);
      }
      expect(tongDiem(moi)).toBe(0);
    }
  });

  it('`khoTraitCua`: cờ bật ⇒ danh sách hẹp; vắng/tắt ⇒ undefined (cả kho chung)', () => {
    expect(khoTraitCua({ trait_kho_hep: true })).toBe(KHO_TRAIT_HEP);
    expect(khoTraitCua({})).toBeUndefined();
    expect(khoTraitCua({ trait_kho_hep: false })).toBeUndefined();
    expect(tran(V57, 12).trait_kho_hep).toBe(true);
    expect(tran(V56, 16).trait_kho_hep).toBeUndefined();
  });

  it('⭐ `apMocTrait` nhận kho: lượt mời trong danh sách; lấy lá bị gác (cân 0 nhưng ngoài lượt mời) bị BỎ QUA, không mất xu', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const r = apMocTrait(seed, 1, { id: 'ban', xu: 99 }, undefined, KHO_TRAIT_HEP);
      for (const id of r.su_kien.moi) expect(KHO_TRAIT_HEP).toContain(id);
    }
    // KỶ LUẬT (+5, TÀI) cân với CHỐT NON (−5, TẬT): cân 0 nên `canHopLe` cho qua — chỉ có "ngoài lượt mời" chặn được.
    const doiGac = ['ky_luat', 'chot_non'] as TraitId[];
    expect(canHopLe(doiGac)).toBe(true);
    const bi = apMocTrait(2026, 1, { id: 'ban', xu: 99 }, { lay: doiGac, cuon: 0 }, KHO_TRAIT_HEP);
    expect(bi.su_kien.bo_qua).toBe(true);
    expect(bi.trait).toEqual([]);
    expect(bi.xu).toBe(99);
    // Vế ngược: lượt mời của KHO ĐẦY có thể chào đúng cặp ấy — tìm một seed như vậy rồi cho lấy ⇒ được nhận.
    let thay = false;
    for (let seed = 1; seed <= 4000 && !thay; seed += 1) {
      const moi = bayTrait(seed, 'ban', 1, 0, []);
      if (!moi.includes('ky_luat') || !moi.includes('chot_non')) continue;
      thay = true;
      const nhan = apMocTrait(seed, 1, { id: 'ban', xu: 99 }, { lay: doiGac, cuon: 0 });
      expect(nhan.su_kien.bo_qua, 'kho đầy phải nhận cặp này').toBe(false);
      expect(nhan.trait).toEqual(doiGac);
    }
    expect(thay, 'không tìm được seed chào cặp KỶ LUẬT/CHỐT NON — nới dải seed').toBe(true);
  });

  const BOTS: Bot[] = ['tat_tay', 'phong_thu', 'duoi_da', 'bat_day', 'ngoi_im'].map((id) => timBot(id)!);
  const gheCaBan = (): GheMoi[] => [0, 1, 2, 3, 4].map(gheBot);
  const traitCuaBot = (khoa: string, soO: number, seed: number, moc: number): TraitId[] => {
    const st = taoTran(seed, gheCaBan(), luatCua(khoa), soO);
    const sau = apMocTraitCaBan({ ...st, vong: moc }, seed, moc, new Map(), (id) => BOTS[Number(id.slice(1))]).st;
    return sau.ghe.flatMap((g) => g.trait ?? []);
  };

  it('⭐ BOT cũng chỉ lấy trong danh sách ở mốc 5 (đường chung `apMocTraitCaBan` — đường thật lẫn bàn đo)', () => {
    let tongLay = 0;
    for (const seed of SEEDS.slice(0, 60)) {
      const lay = traitCuaBot(V57, 12, seed, 5);
      tongLay += lay.length;
      for (const id of lay) expect(KHO_TRAIT_HEP, `seed ${seed}: bot lấy ${id}`).toContain(id);
    }
    expect(tongLay, 'bot không lấy gì thì bài này không đo gì').toBeGreaterThan(20);
  });

  it('vế ngược: dưới v56 bot LẤY lá ngoài danh sách (cùng phép đo, cùng dải seed)', () => {
    let ngoai = 0;
    for (const seed of SEEDS.slice(0, 60)) {
      for (const id of traitCuaBot(V56, 16, seed, 1)) if (!KHO_TRAIT_HEP.includes(id)) ngoai += 1;
    }
    expect(ngoai).toBeGreaterThan(0);
  });
});

/* ═══ VI. ĐƯỜNG THẬT QUA HTTP + DB ═════════════════════════════════════════════════════════ */
describe('§VI — đường thật qua HTTP + DB', () => {
  let db: TestDb;
  let pool: pg.Pool;
  let app: Hono<any>;
  let user: TestUser;

  beforeAll(async () => {
    db = await startTestDb();
    pool = db.pool;
    app = createApp({
      pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
    }) as Hono<any>;
    user = await createTestUser(pool);
  }, 120_000);
  afterAll(async () => { await db?.stop(); });

  const req = (path: string, init: RequestInit = {}) => app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
  const json = async (path: string, init: RequestInit = {}): Promise<any> => (await req(path, init)).json();
  const taoTranHttp = (khoa: string) => json('/api/v1/holdem/matches', {
    method: 'POST', body: JSON.stringify({ ep_balance: khoa }),
  });
  const xem = (id: string) => json(`/api/v1/holdem/matches/${id}`);
  /**
   * D475 — từ vòng 3 trận v57 có màn của vòng trước chạy ở đầu vòng (49 s, D473), và CHƯA nộp được khi màn chưa hết. Bài chơi nhanh qua đường
   * chính thì lùi mốc mở vòng qua hết phần màn (vẫn còn trong hạn đặt lệnh) — giả lập thời gian bằng SQL, không giả đồng hồ toàn cục.
   */
  const nopVong = async (id: string, vong: number, them: Record<string, unknown> = {}) => {
    if (vong >= 3) {
      const bv = (await pool.query('SELECT balance_version FROM holdem_matches WHERE match_id = $1', [id])).rows[0]?.balance_version;
      if (bv === V57) await luiMoc(id, giayManMinigame() + 1);
    }
    return json(`/api/v1/holdem/matches/${id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, ...them }),
    });
  };
  const soO = async (id: string): Promise<number> =>
    Number((await pool.query('SELECT so_o FROM holdem_matches WHERE match_id = $1', [id])).rows[0]!.so_o);
  /** Lùi mốc mở vòng về quá khứ — giả lập thời gian bằng SQL (nếp `holdem_dong_ho_api.test.ts`), không giả đồng hồ toàn cục. */
  const luiMoc = (id: string, giay: number) => pool.query(
    'UPDATE holdem_matches SET vong_mo_luc = now() - make_interval(secs => $2) WHERE match_id = $1', [id, giay]);
  const bodyTuDong = (vong: number) => ({
    vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [], tu_dong: true,
  });
  /** Đưa trận tới đầu vòng `n` bằng n − 1 cú nộp mặc định; trả DTO trận ở đầu vòng ấy (kèm `match_id`). */
  const toiVong = async (khoa: string, n: number): Promise<any> => {
    const t = await taoTranHttp(khoa);
    for (let v = 1; v < n; v += 1) {
      const r = await nopVong(t.match_id, v);
      expect(r.error, `vòng ${v}: ${JSON.stringify(r).slice(0, 160)}`).toBeUndefined();
    }
    return n === 1 ? t : { ...(await xemSauMan(t.match_id)), match_id: t.match_id };
  };
  /** D480 — trong lúc màn vòng vừa nộp còn chạy, trạng thái là của TRƯỚC chốt ⇒ xem trạng thái thật thì lùi mốc qua hết phần màn trước. */
  const xemSauMan = async (id: string): Promise<any> => {
    const bv = (await pool.query('SELECT balance_version, jsonb_array_length(action_log) AS n FROM holdem_matches WHERE match_id = $1', [id])).rows[0];
    if (bv?.balance_version === V57 && Number(bv.n) >= 2) await luiMoc(id, giayManMinigame() + 1);
    return xem(id);
  };
  /** Đầu vòng 3 (vòng thường: không lõi, không mốc trait). */
  const toiVong3 = (khoa: string): Promise<any> => toiVong(khoa, 3);

  it('⭐ cột `so_o` của trận v57 tạo qua API là 12 (cỡ ĐÃ LƯU là một nửa danh tính của map); v56 vẫn 16 (vế ngược)', async () => {
    const a = await taoTranHttp(V57);
    expect(await soO(a.match_id)).toBe(CO_BAN_MINIGAME);
    expect(a.tong_vong).toBe(11);
    const b = await taoTranHttp(V56);
    expect(await soO(b.match_id)).toBe(CO_BAN_DUY_NHAT);
    expect(b.tong_vong).toBe(15);
  });

  it('⭐ D473 qua đường chính: vòng 1 bày lõi và nhận lõi; vòng 2 quầy lõi rỗng, nộp lõi bị lọc; nhịp DTO 1·4 (vòng 6 `khong` cho ghế thường)', async () => {
    const t = await taoTranHttp(V57);
    const nhip = t.ban.nhip_chon_bai as string[];
    expect(nhip[0]).toBe('chien_thuat');
    expect(nhip[3]).toBe('chien_thuat');
    expect(nhip[5], 'ghế thường không có lượt lõi thứ ba').toBe('khong');
    expect(nhip.filter((x) => x === 'chien_thuat')).toHaveLength(2);
    const loi1 = t.shop.chien_thuat as string[];
    expect(loi1.length, 'vòng 1 phải bày lõi').toBeGreaterThan(0);
    // Vai có lõi ghim (cá mập · đội lái · tổ chức) đã cầm sẵn một lõi — nó TÍNH vào trần 2.
    const ghim = t.ban.danh_muc.chien_thuat as string[];
    const r1 = await nopVong(t.match_id, 1, { mua: [loi1[0]] });
    expect(r1.error, JSON.stringify(r1).slice(0, 200)).toBeUndefined();
    const s2 = await xem(t.match_id);
    const sauV1 = s2.ban.danh_muc.chien_thuat as string[];
    expect([...sauV1].sort()).toEqual([...ghim, loi1[0]].sort());
    expect(s2.shop.chien_thuat, 'vòng 2 không phải lượt lõi').toEqual([]);
    // Ép mua lõi ở vòng 2 (body là của client): lọc ở tầng nhận, không lỗi, không lá.
    const khac = ['ban_khong', 'mua_duoi', 'bat_day', 'chan_lo'].find((x) => !sauV1.includes(x));
    const r2 = await nopVong(t.match_id, 2, { mua: [khac] });
    expect(r2.error, JSON.stringify(r2).slice(0, 200)).toBeUndefined();
    expect((await xem(t.match_id)).ban.danh_muc.chien_thuat).toEqual(sauV1);
  });

  it('⭐ D473 trần 2 qua đường chính (D482: không lõi ghim — hai lõi đều tự mua): kín 2 ⇒ quầy không bày lõi mới, ép lõi thứ ba bị lọc', async () => {
    const t = await taoTranHttp(V57);
    expect(t.ban.danh_muc.chien_thuat, 'D482 — vai thôi ghim lõi: vào bàn tay trắng').toEqual([]);
    let s = t, kin = false;
    for (let v = 1; v <= 10 && !kin; v += 1) {
      const cam = s.ban.danh_muc.chien_thuat as string[];
      const quay = (s.shop?.chien_thuat ?? []) as string[];
      if (cam.length === 2) {
        kin = true;
        for (const id of quay) expect(cam, `vòng ${v} bày lõi mới ${id} khi đã kín`).toContain(id);
        const thuBa = ['ban_khong', 'mua_duoi', 'bat_day', 'chan_lo', 'luot_song', 'don_bay'].find((x) => !cam.includes(x))!;
        expect((await nopVong(t.match_id, v, { mua: [thuBa] })).error).toBeUndefined();
        expect((await xemSauMan(t.match_id)).ban.danh_muc.chien_thuat, 'lõi thứ ba lọt qua trần 2').toEqual(cam);
        break;
      }
      const moi = quay.find((x) => !cam.includes(x));
      expect((await nopVong(t.match_id, v, moi ? { mua: [moi] } : {})).error, `vòng ${v}`).toBeUndefined();
      s = await xemSauMan(t.match_id);
    }
    expect(kin, 'tới vòng 10 không kín hai lõi — lịch vòng lõi đã đổi?').toBe(true);
  });

  it('⭐ DTO: v57 báo `dong_ho_minigame` để web thôi diễn khoảnh khắc từng vòng; v56 không có trường này', async () => {
    const a = await taoTranHttp(V57);
    expect(a.dong_ho_minigame).toBe(true);
    expect((await xem(a.match_id)).dong_ho_minigame).toBe(true);
    const b = await taoTranHttp(V56);
    expect(b.dong_ho_minigame).toBeUndefined();
  });

  it('⭐ vốn theo vai qua API: `ban.von` = START_VON × HE_SO_VON_V57 của vai bốc được (D506) — và v56 luôn START_VON (vế ngược)', async () => {
    const a = await taoTranHttp(V57);
    expect(a.ban.vai, 'bàn 12 ô phải bốc vai (chỉ bàn ≥ 12)').toBeDefined();
    expect(a.ban.von).toBe(HOLDEM_MATCH.START_VON * HE_SO_VON_V57[a.ban.vai as VaiId]);
    const b = await taoTranHttp(V56);
    expect(b.ban.von).toBe(HOLDEM_MATCH.START_VON);
  });

  it('⭐ chợ trait mở ở mốc 5·9 (không mốc nào khác), mỗi lượt mời 6 lá TRONG danh sách — chơi qua đường chính tới vòng 10', async () => {
    const t = await taoTranHttp(V57);
    const moc: number[] = [];
    const ghi = (st: any): void => {
      const ct = st.ban?.cho_trait;
      if (!ct) return;
      moc.push(ct.moc);
      expect(ct.moi, `mốc ${ct.moc}`).toHaveLength(6);
      for (const id of ct.moi as TraitId[]) expect(KHO_TRAIT_HEP, `mốc ${ct.moc}: ${id} ngoài danh sách`).toContain(id);
    };
    ghi(t);
    let xong = false;
    for (let v = 1; v <= 10 && !xong; v += 1) {
      const r = await nopVong(t.match_id, v);
      expect(r.error, `vòng ${v}: ${JSON.stringify(r).slice(0, 200)}`).toBeUndefined();
      xong = r.xong === true;
      ghi(r);
    }
    expect([...new Set(moc)].sort((x, y) => x - y)).toEqual([5, 9]);
  }, 120_000);

  it('vế ngược: dưới v56 chợ trait chào lá bị gác (thử tới bốn trận — lượt mời là ngẫu nhiên theo seed)', async () => {
    let thay = false;
    for (let i = 0; i < 4 && !thay; i += 1) {
      const b = await taoTranHttp(V56);
      const moi = (b.ban?.cho_trait?.moi ?? []) as TraitId[];
      expect(moi.length, 'v56 mốc 1 phải có lượt mời').toBeGreaterThan(0);
      thay = moi.some((id) => BI_GAC.includes(id));
    }
    expect(thay).toBe(true);
  });

  it('⭐ CUỘN lượt mời (`GET /shop?cuon=k`, k = 0..tối đa) cũng chỉ chào lá TRONG danh sách, lượt 0 trùng DTO trận — vế ngược: v56 cuộn ra lá bị gác', async () => {
    const t = await toiVong(V57, 5);
    const goc = t.ban.cho_trait.moi as TraitId[];
    for (let k = 0; k <= CHO_TRAIT.CUON_TOI_DA; k += 1) {
      const sh = await json(`/api/v1/holdem/matches/${t.match_id}/shop?cuon=${k}`);
      expect(sh.cho_trait?.lan_cuon, `cuộn ${k}`).toBe(k);
      const moi = sh.cho_trait.moi as TraitId[];
      expect(moi.length, `cuộn ${k}: lượt mời rỗng`).toBeGreaterThan(0);
      for (const id of moi) expect(KHO_TRAIT_HEP, `cuộn ${k}: ${id} ngoài danh sách`).toContain(id);
      if (k === 0) expect(moi, 'lượt 0 của /shop phải trùng DTO trận').toEqual(goc);
    }
    // Vế ngược: cùng thao tác dưới v56 — ít nhất một lần cuộn ở ít nhất một trận chào lá bị gác.
    let thay = false;
    for (let i = 0; i < 3 && !thay; i += 1) {
      const b = await taoTranHttp(V56);
      for (let k = 1; k <= CHO_TRAIT.CUON_TOI_DA; k += 1) {
        const sh = await json(`/api/v1/holdem/matches/${b.match_id}/shop?cuon=${k}`);
        if (((sh.cho_trait?.moi ?? []) as TraitId[]).some((id) => BI_GAC.includes(id))) thay = true;
      }
    }
    expect(thay, 'v56 cuộn 15 lần mà không lần nào chào lá bị gác — không thể').toBe(true);
  });

  it('⭐ ép lấy lá BỊ GÁC qua cú nộp vòng mốc: server từ chối `trait_ngoai_luot`, không trừ xu, không nhận lá — kể cả khi lá ấy nằm trong lượt mời của KHO ĐẦY', async () => {
    let da = false;
    for (let thu = 0; thu < 6 && !da; thu += 1) {
      const t = await toiVong(V57, 5);
      const seed = Number((await pool.query('SELECT seed FROM holdem_matches WHERE match_id = $1', [t.match_id])).rows[0]!.seed);
      // Lượt mời mà kho ĐẦY sẽ chào ở mốc 5 — cân 0 nên `canHopLe` cho qua; chỉ "ngoài lượt mời hẹp" chặn được nó.
      const khoDay = bayTrait(seed, 'ban', 5, 0, []);
      if (!khoDay.some((id) => BI_GAC.includes(id))) continue;
      da = true;
      expect(canHopLe(khoDay)).toBe(true);
      const xuTruoc = t.ban.xu as number;
      await luiMoc(t.match_id, giayManMinigame() + 1);   // D475 — qua hết màn vòng 4 (nếp `nopVong`)
      const r = await req(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
        method: 'POST',
        body: JSON.stringify({
          vong: 5, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0,
          trait: { lay: khoDay, cuon: 0 },
        }),
      });
      expect(r.status).toBe(400);
      expect((await r.json() as { error: string }).error).toBe('trait_ngoai_luot');
      const sau = await xem(t.match_id);
      expect(sau.ban.xu).toBe(xuTruoc);
      expect(sau.vong, 'cú nộp bị từ chối thì vòng không được đi').toBe(5);
    }
    expect(da, 'sáu trận liền mà lượt mời kho đầy không chào lá bị gác — không thể (xác suất ~0)').toBe(true);
  });

  it('đối chứng: nộp ĐÚNG lượt mời hẹp (cả sáu lá, cân 0, đủ xu) thì được nhận — bài trên không chặn nhầm cả cửa', async () => {
    const t = await toiVong(V57, 5);
    const moi = t.ban.cho_trait.moi as TraitId[];
    expect(canHopLe(moi)).toBe(true);
    const r = await nopVong(t.match_id, 5, { trait: { lay: moi, cuon: 0 } });
    expect(r.error, JSON.stringify(r).slice(0, 200)).toBeUndefined();
    const sau = await xemSauMan(t.match_id);
    expect(sau.vong).toBe(6);
  });

  it('⭐ server SOI HẠN bằng đồng hồ của khung — chốt hộ: vòng 3 bàn 12 (15 + 5 + màn 49 = 69 s), lùi mốc 71 s ⇒ 200 `tu_dong`; lùi 22 s (đủ cho đồng hồ KHÔNG màn) ⇒ 409 `chua_het_gio`', async () => {
    const gioV57 = giayChonBai(3, CO_BAN_MINIGAME, false, true);
    expect(gioV57).toBe(69);
    const khongMan = gioV57 - giayManMinigame();
    expect(khongMan + 2, 'vế ngược chỉ có nghĩa khi mốc lùi nằm TRONG phần màn').toBeLessThan(gioV57);

    const a = await toiVong3(V57);
    await luiMoc(a.match_id, gioV57 + 2); // qua mốc, còn trong ân hạn 8 s
    const ra = await req(`/api/v1/holdem/matches/${a.match_id}/rounds`, { method: 'POST', body: JSON.stringify(bodyTuDong(3)) });
    expect(ra.status).toBe(200);
    expect((await ra.json() as { tu_dong?: boolean }).tu_dong).toBe(true);

    // Vế ngược (D473): màn vòng 2 đang chạy trong hạn vòng 3 — đồng hồ thiếu phần màn sẽ chốt hộ ở đây.
    const b = await toiVong3(V57);
    await luiMoc(b.match_id, khongMan + 2);
    const rb = await req(`/api/v1/holdem/matches/${b.match_id}/rounds`, { method: 'POST', body: JSON.stringify(bodyTuDong(3)) });
    expect(rb.status).toBe(409);
    expect((await rb.json() as { error: string }).error).toBe('chua_het_gio');
  });

  it('⭐ server SOI HẠN bằng đồng hồ ngắn — khớp lệnh giữa vòng: vòng 2 bàn 12 (chưa có màn: 20 s), lùi mốc quá cả ân hạn ⇒ 409 `het_gio`; v56 cùng số giây ⇒ KHÔNG `het_gio`', async () => {
    const lui = giayChonBai(2, CO_BAN_MINIGAME, false, true) + DONG_HO.AN_HAN_S + 3;
    expect(giayChonBai(2, CO_BAN_DUY_NHAT, false, false), 'đồng hồ cũ vòng 2 phải dài hơn').toBeGreaterThan(lui);
    const lenh = { vong: 2, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }] };

    const a = await toiVong(V57, 2);
    await luiMoc(a.match_id, lui);
    const ra = await req(`/api/v1/holdem/matches/${a.match_id}/khop-lenh`, { method: 'POST', body: JSON.stringify(lenh) });
    expect(ra.status).toBe(409);
    expect((await ra.json() as { error: string }).error).toBe('het_gio');

    const b = await toiVong(V56, 2);
    await luiMoc(b.match_id, lui);
    const rb = await req(`/api/v1/holdem/matches/${b.match_id}/khop-lenh`, { method: 'POST', body: JSON.stringify(lenh) });
    expect(((await rb.json()) as { error?: string }).error, 'đồng hồ cũ của v56 còn chưa hết ở số giây này').not.toBe('het_gio');
  });

  it('đồng hồ qua API: vòng 1 `doc_s` = 0; sang vòng 2 `doc_s` = 5 (v57) và = 15 (v56, vế ngược); `tong_s` vòng 3 gánh màn', async () => {
    const a = await taoTranHttp(V57);
    expect(a.dong_ho?.doc_s).toBe(0);
    // D473 — vòng 1 là lượt LÕI (không còn mốc chợ trait): 45 + 20 = 65 s — cùng số với D459 nhưng khác lý do.
    expect(a.dong_ho?.tong_s).toBe(DONG_HO.CHON_BAI_VONG_1_S + DONG_HO_MINIGAME.CHON_BAI_THEM_KHI_CO_THE_S);
    expect(a.dong_ho?.tong_s).toBe(65);
    const a2 = await nopVong(a.match_id, 1);
    expect(a2.error).toBeUndefined();
    const sa = await xem(a.match_id);
    expect(sa.vong).toBe(2);
    expect(sa.dong_ho.doc_s).toBe(DONG_HO_MINIGAME.XEM_KET_QUA_S);
    // Vòng 2: không lõi (nhịp 1·4·6), chưa có màn (màn đầu là của vòng 2, chạy ở vòng 3) ⇒ 15 + 5.
    expect(sa.dong_ho.tong_s).toBe(DONG_HO_MINIGAME.CHON_BAI_S + DONG_HO_MINIGAME.XEM_KET_QUA_S);
    expect(sa.dong_ho.tong_s).toBe(20);
    await nopVong(a.match_id, 2);
    expect((await xemSauMan(a.match_id)).dong_ho.tong_s, 'vòng 3 gánh màn vòng 2').toBe(20 + giayManMinigame());

    const b = await taoTranHttp(V56);
    // Vế ngược: v56 (bàn 16, mốc trait 1) vẫn 45 + 25 = 70 s.
    expect(b.dong_ho?.tong_s).toBe(DONG_HO.CHON_BAI_VONG_1_S + DONG_HO.CHON_TRAIT_THEM_S);
    await nopVong(b.match_id, 1);
    const sb = await xem(b.match_id);
    expect(sb.vong).toBe(2);
    expect(sb.dong_ho.doc_s).toBe(DONG_HO.XEM_KET_QUA_S);
    expect(sb.dong_ho.tong_s).toBe(DONG_HO.CHON_BAI_S + DONG_HO.XEM_KET_QUA_S + DONG_HO.CHON_BAI_THEM_KHI_CO_THE_S);
  });
});
