/**
 * v55 (D409) — LỬA · XU · TRAIT · LƯỚT SÓNG MỚI: bài canh tầng engine.
 *
 * ⚠ MỌI MỤC CÓ VẾ NGƯỢC trên khoá v54 (mặc định 0.0.45): bài một chiều xanh vĩnh viễn khi cả hai khoá cùng hỏng.
 * Véc-tơ chép tay (A5.2 nếp): số ở `config/lua.ts` · `config/trait.ts` · `config/luot_song.ts`.
 */
import { describe, expect, it } from 'vitest';
import { BO_LUAT_THEO_PHIEN_BAN, luatCua } from '../config/holdem_balance.js';
import { HOLDEM_MATCH, boMaTranCua, nhipChonBai } from '../config/holdem.js';
import { LUA } from '../config/lua.js';
import { CHO_TRAIT, MOC_TRAIT, THAM_SO, TRAIT, TRAIT_VAI, TRAIT_VAI_MINIGAME, diemCoDau, type TraitId } from '../config/trait.js';
import {
  apLenhMocNav, apLenhVongNav, chotPhien, choiVongCuoc, daKetThuc, dungChuoi, giaiQuyetVong, maxTaiSanCua,
  taoTran, tyLeCua, xuNhiemVuLoi, viKhaoSat, ghiViKhaoSat, chiPhiKhaoSat, tangCuaMatXich, tinBiChe, tuyChonLenhV55, vongDaLat,
  type Ghe, type GheMoi, type MatXich, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { apLenhGiaoDich, giaiLenhMoc, type GheNav } from '../server/holdem/nav.js';
import {
  biasCua, capNhatLua, heSoTruotLuaBp, matXichLua, nacTheoChuoi,
} from '../server/holdem/lua.js';
import {
  apMocTrait, bayTrait, canHopLe, giaCuon, laMocTrait, rangBuocCua, tongDiem,
} from '../server/holdem/trait.js';
import { apMocTraitCaBan, apNhipLenhBotNav, boiCanhLenhGhe, boiCanhLenhVong } from '../server/holdem/nhip_lenh_bot.js';
import {
  BOT_CHOI_DUOC, BOT_THAM_CHIEU, botTaiCoCau, chonTraitBot, lenhBotNav, timBot, type BoiCanh, type BoiCanhLenh, type Bot,
} from '../server/holdem/bots.js';
import { bayShop, tuyChonShop } from '../server/holdem/shop.js';
import { oCongKhai } from '../server/holdem/map.js';

const V55 = 'balance-v55-build';
const V54 = 'balance-v54-ngare';
const CO_MOI = [
  'lua', 'luaPhi', 'luaQuyetToan', 'luaMuaDuoi', 'nhiemVuLoi', 'trait', 'traitVai', 'chanLoTrait', 'luotSongMoi',
  // D411 — VÀNG gộp vào XU + lần đổi bài đầu miễn phí cho người chơi (đúng luật `CHI_PHI_KHAO_SAT_LAI`).
  'gopXu', 'khaoSatDauMienPhi',
  // D422 — lửa không phạt đảo · KỶ LUẬT / CHỐT NON sau Đòn Bẩy.
  'luaKhongPhatDao', 'kyLuatSauDonBay',
] as const;
/** D422 — khoá v55 nhưng tắt cổng sau-Đòn-Bẩy: đường KỶ LUẬT / CHỐT NON của D409 (sàn/trần trên phần lõi). */
const LUAT_D409_KY_LUAT = () => ({ ...luatCua('balance-v55-build'), kyLuatSauDonBay: false });

/* ═══ I. CỔNG ═══════════════════════════════════════════════════════════════════════════════ */
describe(`I. Cổng — v55 = v54 + đúng ${CO_MOI.length} cờ`, () => {
  it(`v55 đổi ĐÚNG ${CO_MOI.length} cờ so với v54, không lén bật/tắt thứ khác`, () => {
    const a = BO_LUAT_THEO_PHIEN_BAN[V54]! as unknown as Record<string, boolean>;
    const b = BO_LUAT_THEO_PHIEN_BAN[V55]! as unknown as Record<string, boolean>;
    const doi = Object.keys(b).filter((k) => a[k] !== b[k]).sort();
    expect(doi).toEqual([...CO_MOI].sort());
    for (const c of CO_MOI) expect(b[c]).toBe(true);
  });
  it('các cờ mới TẮT ở mọi khoá khác — trận đã lưu replay nguyên (golden --kiem đã khớp 100% lúc thêm)', () => {
    // v56 (D447) trở đi KẾ THỪA v55 — ghim theo SỐ phiên bản, không liệt kê tay (xem banh_xe_mua.test.ts §I).
    const soCua = (k: string): number => Number(/^balance-v(\d+)/.exec(k)?.[1] ?? 0);
    for (const [khoa, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      if (khoa === V55 || soCua(khoa) > 55) continue;
      for (const c of CO_MOI) expect(luat[c], `${khoa}.${c}`).toBe(false);
    }
    for (const c of CO_MOI) expect(luatCua('khoa-la-hoac-thieu')[c]).toBe(false);
  });
});

/* ═══ II. LỬA — véc-tơ chép tay ═════════════════════════════════════════════════════════════ */
describe('II. lua.ts — nấc, bias, cập nhật, mắt xích', () => {
  it('nấc theo chuỗi: 0 → 0 · 1 → 1 · 2 → 2 · 3 → 2 · 4 → 3; lõi Mua Đuổi hạ ngưỡng nấc 3 (1 lõi: 3 vòng · 2 lõi: 2 vòng)', () => {
    expect([0, 1, 2, 3, 4, 9].map((c) => nacTheoChuoi(c, 0))).toEqual([0, 1, 2, 2, 3, 3]);
    expect(nacTheoChuoi(3, 1)).toBe(3);
    expect(nacTheoChuoi(2, 1)).toBe(2);
    expect(nacTheoChuoi(2, 2)).toBe(3);
    expect(nacTheoChuoi(1, 2)).toBe(1);
  });
  it('bias: nhóm chiếm phần lớn vị thế dài · khống khi sổ khống lớn hơn cả hai · null dưới ngưỡng 20% NAV', () => {
    expect(biasCua({ vi_the: { btc: 3000 } }, 10000)).toBe('rui_ro');
    expect(biasCua({ vi_the: { vang: 3000, btc: 1000 } }, 10000)).toBe('phong_thu');
    expect(biasCua({ vi_the: { btc: 1999 } }, 10000)).toBeNull();
    expect(biasCua({ vi_the: { btc: 2000 } }, 10000)).toBe('rui_ro');
    expect(biasCua({ vi_the: { btc: 1000 }, vi_the_khong: { vn30: 2000 } }, 10000)).toBe('khong');
    expect(biasCua({ vi_the: {} }, 10000)).toBeNull();
    expect(biasCua({ vi_the: { btc: 5000 } }, 0)).toBeNull();
  });
  it('tích: vào lần đầu ⇒ chuỗi 1 nấc 1 xu 1; giữ bias ⇒ chuỗi 2 nấc 2 xu 2', () => {
    const a = capNhatLua({ truoc: undefined, biasMoi: 'rui_ro', doiTay: undefined, navDauVong: 10000, soLoiMuaDuoi: 0, muaDuoi: null, ruiRoLai: true, giuNhiet: false });
    expect(a).toEqual({ sau: { nac: 1, chuoi: 1, bias: 'rui_ro' }, dap: null, xu: 1 });
    const b = capNhatLua({ truoc: a.sau, biasMoi: 'rui_ro', doiTay: { ban: 0, mua_khac: 0, mua_rui_ro: 500, mua_tong: 500 }, navDauVong: 10000, soLoiMuaDuoi: 0, muaDuoi: null, ruiRoLai: false, giuNhiet: false });
    expect(b).toEqual({ sau: { nac: 2, chuoi: 2, bias: 'rui_ro' }, dap: null, xu: 2 });
  });
  it('dập theo NGƯỜI CHƠI: đổi bias ⇒ về 0 (`doi_bias`); đổi tay ≥ 50% NAV ⇒ về 0 (`doi_tay`); GIỮ NHIỆT chỉ hạ 1 nấc', () => {
    const truoc = { nac: 2 as const, chuoi: 2, bias: 'rui_ro' as const };
    const doiBias = capNhatLua({ truoc, biasMoi: 'phong_thu', doiTay: undefined, navDauVong: 10000, soLoiMuaDuoi: 0, muaDuoi: null, ruiRoLai: false, giuNhiet: false });
    expect(doiBias).toEqual({ sau: { nac: 0, chuoi: 0, bias: 'phong_thu' }, dap: 'doi_bias', xu: 0 });
    const doiTay = capNhatLua({ truoc, biasMoi: 'rui_ro', doiTay: { ban: 5000, mua_khac: 0, mua_rui_ro: 0, mua_tong: 0 }, navDauVong: 10000, soLoiMuaDuoi: 0, muaDuoi: null, ruiRoLai: true, giuNhiet: false });
    expect(doiTay.dap).toBe('doi_tay');
    expect(doiTay.sau.nac).toBe(0);
    const chuaToi = capNhatLua({ truoc, biasMoi: 'rui_ro', doiTay: { ban: 4999, mua_khac: 0, mua_rui_ro: 0, mua_tong: 0 }, navDauVong: 10000, soLoiMuaDuoi: 0, muaDuoi: null, ruiRoLai: true, giuNhiet: false });
    expect(chuaToi.dap).toBeNull();
    expect(chuaToi.sau.chuoi).toBe(3);
    const giuNhiet = capNhatLua({ truoc, biasMoi: 'phong_thu', doiTay: undefined, navDauVong: 10000, soLoiMuaDuoi: 0, muaDuoi: null, ruiRoLai: false, giuNhiet: true });
    expect(giuNhiet).toEqual({ sau: { nac: 1, chuoi: 1, bias: 'phong_thu' }, dap: 'doi_bias', xu: 1 });
  });
  it('vòng không vị thế (bias null): không tích, không dập, xu theo nấc đang giữ — trừ khi vừa BÁN SẠCH (đổi tay) thì dập', () => {
    const truoc = { nac: 2 as const, chuoi: 2, bias: 'rui_ro' as const };
    const dung = capNhatLua({ truoc, biasMoi: null, doiTay: { ban: 1000, mua_khac: 0, mua_rui_ro: 0, mua_tong: 0 }, navDauVong: 10000, soLoiMuaDuoi: 0, muaDuoi: null, ruiRoLai: false, giuNhiet: false });
    expect(dung).toEqual({ sau: { nac: 2, chuoi: 2, bias: 'rui_ro' }, dap: null, xu: 2 });
    const banSach = capNhatLua({ truoc, biasMoi: null, doiTay: { ban: 9000, mua_khac: 0, mua_rui_ro: 0, mua_tong: 0 }, navDauVong: 10000, soLoiMuaDuoi: 0, muaDuoi: null, ruiRoLai: false, giuNhiet: false });
    expect(banSach.dap).toBe('doi_tay');
    expect(banSach.sau.nac).toBe(0);
  });
  it('Mua Đuổi: muộn ⇒ chuỗi không đếm (`mua_duoi_muon`); đúng lúc và thắng ⇒ chuỗi +1 thêm, 1 lõi lên nấc 3 ở chuỗi 3', () => {
    const truoc = { nac: 1 as const, chuoi: 1, bias: 'rui_ro' as const };
    const muon = capNhatLua({ truoc, biasMoi: 'rui_ro', doiTay: undefined, navDauVong: 10000, soLoiMuaDuoi: 1, muaDuoi: 'muon', ruiRoLai: true, giuNhiet: false });
    expect(muon).toEqual({ sau: { nac: 1, chuoi: 1, bias: 'rui_ro' }, dap: 'mua_duoi_muon', xu: 1 });
    const som = capNhatLua({ truoc, biasMoi: 'rui_ro', doiTay: undefined, navDauVong: 10000, soLoiMuaDuoi: 1, muaDuoi: 'som', ruiRoLai: true, giuNhiet: false });
    expect(som).toEqual({ sau: { nac: 3, chuoi: 3, bias: 'rui_ro' }, dap: null, xu: 3 });
    const somThua = capNhatLua({ truoc, biasMoi: 'rui_ro', doiTay: undefined, navDauVong: 10000, soLoiMuaDuoi: 1, muaDuoi: 'som', ruiRoLai: false, giuNhiet: false });
    expect(somThua.sau.chuoi).toBe(2);
    const dacBiet = capNhatLua({ truoc, biasMoi: 'rui_ro', doiTay: undefined, navDauVong: 10000, soLoiMuaDuoi: 2, muaDuoi: null, ruiRoLai: false, giuNhiet: false });
    expect(dacBiet.sau).toEqual({ nac: 3, chuoi: 2, bias: 'rui_ro', dac_biet: true });
  });
  it('hệ số trượt theo nấc; mắt xích lửa theo mã: lãi cộng thêm, lỗ trừ thêm (đảo nặng hơn thuận), 0 bị lược', () => {
    expect([0, 1, 2, 3].map((n) => heSoTruotLuaBp(n as 0 | 1 | 2 | 3))).toEqual([10000, 9000, 8000, 7000]);
    expect(matXichLua({ btc: 1200, vang: -400, usd: 0 }, 2)).toEqual([
      { ma: 'btc', thuan: true, he_so_bp: 500, delta_bp: 60 },
      { ma: 'vang', thuan: false, he_so_bp: 1000, delta_bp: -40 },
    ]);
    expect(matXichLua({ btc: 1200 }, 0)).toEqual([]);
    expect(matXichLua({ btc: 1 }, 1)).toEqual([]);
    expect(LUA.HE_SO_DAO_BP.every((d, i) => d >= LUA.HE_SO_THUAN_BP[i]!)).toBe(true);
  });
});

/* ═══ III. TRAIT — bảng, chợ, cân, mốc ═════════════════════════════════════════════════════ */
describe('III. trait.ts — bảng, lượt mời, cân, mốc', () => {
  it('bảng: id duy nhất; kho chung ±1..±5 (trần founder); cặp vai tổng 0 từng vai; không trait nào theo trục "thưởng phơi nhiễm"; không lá nào đụng đồng hồ', () => {
    expect(new Set(TRAIT.map((t) => t.id)).size).toBe(TRAIT.length);
    for (const t of TRAIT) {
      if (!t.vai) expect(t.diem, t.id).toBeLessThanOrEqual(5);
    }
    // D422 — BÌNH TĨNH / BÁO TRỄ đổi tác dụng: bàn nhiều người không chịu được đồng hồ riêng từng ghế.
    expect(TRAIT.filter((t) => t.truc === 'nhip').map((t) => t.id)).toEqual([]);
    // D482 — hai bảng cặp (khoá cũ `TRAIT_VAI` · khung minigame `TRAIT_VAI_MINIGAME`): mỗi cặp đúng hai lá CỦA vai ấy, tổng 0.
    for (const bang of [TRAIT_VAI, TRAIT_VAI_MINIGAME]) {
      for (const vai of ['ca_map', 'doi_lai', 'to_chuc'] as const) {
        const cap = bang[vai].map((id) => TRAIT.find((t) => t.id === id)!);
        expect(cap.length, vai).toBe(2);
        for (const t of cap) expect(t.vai, `${t.id} thuộc ${vai}`).toBe(vai);
        expect(cap.reduce((s, t) => s + diemCoDau(t), 0), vai).toBe(0);
      }
    }
    // mọi lá có `vai` nằm trong ít nhất một bảng cặp (không lá vai nào mồ côi)
    for (const t of TRAIT.filter((x) => x.vai)) expect([...TRAIT_VAI[t.vai!], ...TRAIT_VAI_MINIGAME[t.vai!]], t.id).toContain(t.id);
    // §1.2 — trục "danh_muc" chỉ CHO PHÉP / GIỚI HẠN (TẦM RỘNG · MỘT GIỎ), không có trait thưởng tiền mặt/độ đa dạng.
    expect(TRAIT.filter((t) => t.truc === 'danh_muc').map((t) => t.id).sort()).toEqual(['mot_gio', 'tam_rong']);
  });
  it('lượt mời: 3 TÀI + 3 TẬT kho chung, tổng 0, không trùng trait đang mang, không cặp vai; tất định; đổi lần cuộn thì đổi', () => {
    const moi = bayTrait(4242, 'ban', 5, 0, []);
    expect(moi.length).toBe(CHO_TRAIT.SO_TAI + CHO_TRAIT.SO_TAT);
    expect(tongDiem(moi)).toBe(0);
    expect(moi.filter((id) => TRAIT.find((t) => t.id === id)!.loai === 'tai').length).toBe(3);
    expect(moi.every((id) => !TRAIT.find((t) => t.id === id)!.vai)).toBe(true);
    expect(bayTrait(4242, 'ban', 5, 0, [])).toEqual(moi);
    const mang = moi.slice(0, 2);
    expect(bayTrait(4242, 'ban', 9, 0, mang).some((id) => mang.includes(id))).toBe(false);
    const khac = [1, 2, 3, 4, 5].map((k) => bayTrait(4242, 'ban', 5, k, []).join(','));
    expect(new Set([moi.join(','), ...khac]).size).toBeGreaterThan(1);
    // 300 lượt bất kỳ đều cân 0 và đủ 6.
    for (let s = 1; s <= 300; s += 1) {
      const m = bayTrait(s * 7919, `g${s % 5}`, [1, 6, 9, 13][s % 4]!, s % 3, []);
      expect(m.length, `seed ${s}`).toBe(6);
      expect(tongDiem(m), `seed ${s}`).toBe(0);
    }
  });
  it('cân: phần LẤY tổng đúng 0 (founder 25/09) — không gì cũng hợp lệ; lệch dương hay âm đều không', () => {
    expect(canHopLe([])).toBe(true);
    expect(canHopLe(['giu_nhiet', 'gong_cum'])).toBe(true);
    expect(canHopLe(['lenh_min', 'tam_rong', 'gong_cum'])).toBe(true);
    expect(canHopLe(['giu_nhiet'])).toBe(false);
    expect(canHopLe(['gong_cum'])).toBe(false);
    expect(canHopLe(['giu_nhiet', 'gong_cum', 'mu_tin'])).toBe(false);
    expect(canHopLe(['giu_nhiet', 'giu_nhiet', 'gong_cum', 'gong_cum'])).toBe(false);
  });
  it('giá cuộn cộng dồn 2 · 3 · 4 · 5 · 6; mốc bàn 16 = 1 · 6 · 9 · 13 (D428)', () => {
    expect([0, 1, 2, 3, 5, 9].map(giaCuon)).toEqual([0, 2, 5, 9, 20, 20]);
    expect(MOC_TRAIT[16]).toEqual([1, 6, 9, 13]);
    expect([1, 6, 9, 13].every((v) => laMocTrait(v, 16))).toBe(true);
    expect([2, 3, 4, 5, 8, 12, 16].some((v) => laMocTrait(v, 16))).toBe(false);
    expect(laMocTrait(1, 12)).toBe(false);
  });
  it('ràng buộc từ một struct: cổng tắt ⇒ rỗng; từng trait đúng ô; TÊ LIỆT theo vòng', () => {
    const g = { trait: TRAIT.filter((t) => !t.vai).map((t) => t.id), te_liet_den_vong: 7 };
    const rb = rangBuocCua({ trait_bat: true }, g, 6);
    expect(rb).toEqual({
      mocThem: [THAM_SO.LENH_MIN_MOC_BP], tranBanVongBp: THAM_SO.GONG_CUM_TRAN_BAN_VONG_BP,
      themMa: 1, toiDaMa: 2, phiLenhBp: THAM_SO.SO_MONG_PHI_LENH_BP, giuNhiet: true, muLua: true, mayXu: true,
      chanLo: true, chotNon: true, noiGian: 2, muTin: true, suongMu: true, sangSo: true,
      kienNhan: true, nongVoi: true, diSau: true, loLenh: true, teLiet: true,
    });
    expect(rangBuocCua({ trait_bat: true }, g, 8).teLiet).toBe(false);
    expect(rangBuocCua({ trait_bat: false }, g, 6).themMa).toBe(0);
    expect(rangBuocCua({ trait_bat: true }, { trait: [] }, 6).mocThem).toEqual([]);
  });
  it('mốc: lấy hợp lệ ⇒ nhận + trừ xu cuộn; ngoài lượt mời / lệch cân / thiếu xu ⇒ bỏ qua; TÊ LIỆT khoá 2 vòng; MẤT TRÍ xoá 1 TÀI ở mốc kế', () => {
    const moi = bayTrait(99, 'ban', 5, 0, []);
    const tai = moi.find((id) => TRAIT.find((t) => t.id === id)!.loai === 'tai')!;
    const tat = moi.find((id) => TRAIT.find((t) => t.id === id)!.loai === 'tat' && TRAIT.find((t) => t.id === id)!.diem === TRAIT.find((t) => t.id === tai)!.diem);
    const lay = tat ? [tai, tat] : [];
    const ok = apMocTrait(99, 5, { id: 'ban', xu: 3 }, { lay, cuon: 0 });
    expect(ok.trait).toEqual(lay);
    expect(ok.xu).toBe(3);
    expect(ok.su_kien.bo_qua).toBe(false);
    const ngoaiLuot = TRAIT.filter((t) => !t.vai && !moi.includes(t.id));
    const capNgoai = ngoaiLuot.find((t) => t.loai === 'tai' && ngoaiLuot.some((u) => u.loai === 'tat' && u.diem === t.diem));
    if (capNgoai) {
      const tatNgoai = ngoaiLuot.find((u) => u.loai === 'tat' && u.diem === capNgoai.diem)!;
      const ngoai = apMocTrait(99, 5, { id: 'ban', xu: 3 }, { lay: [capNgoai.id, tatNgoai.id], cuon: 0 });
      expect(ngoai.trait).toEqual([]);
      expect(ngoai.su_kien.bo_qua).toBe(true);
    }
    const lech = apMocTrait(99, 5, { id: 'ban', xu: 3 }, { lay: [tai], cuon: 0 });
    expect(lech.trait).toEqual([]);
    expect(lech.su_kien.bo_qua).toBe(true);
    const thieuXu = apMocTrait(99, 5, { id: 'ban', xu: 1 }, { lay: [], cuon: 1 });
    expect(thieuXu.su_kien.bo_qua).toBe(true);
    expect(thieuXu.xu).toBe(1);
    const cuon = apMocTrait(99, 5, { id: 'ban', xu: 6 }, { lay: [], cuon: 2 });
    expect(cuon.xu).toBe(1);
    expect(cuon.su_kien.moi).toEqual(bayTrait(99, 'ban', 5, 2, []));
    // TÊ LIỆT: chọn ở mốc 5 ⇒ khoá tới hết vòng 7.
    let s = 1;
    for (; s < 500; s += 1) { const m = bayTrait(s, 'ban', 5, 0, []); if (m.includes('te_liet')) break; }
    const m = bayTrait(s, 'ban', 5, 0, []);
    const taiCung = m.find((id) => TRAIT.find((t) => t.id === id)!.loai === 'tai' && TRAIT.find((t) => t.id === id)!.diem === 2)!;
    const te = apMocTrait(s, 5, { id: 'ban', xu: 0 }, { lay: [taiCung, 'te_liet'], cuon: 0 });
    expect(te.te_liet_den_vong).toBe(5 + THAM_SO.TE_LIET_SO_VONG);
    // MẤT TRÍ mang từ mốc trước ⇒ mốc kế mất đúng một TÀI, chỉ TÀI, và ghi vào sự kiện.
    const mt = apMocTrait(7, 9, { id: 'ban', xu: 0, trait: ['giu_nhiet', 'mat_tri', 'ky_luat', 'gong_cum'] }, undefined);
    expect(mt.su_kien.mat_tri === 'giu_nhiet' || mt.su_kien.mat_tri === 'ky_luat').toBe(true);
    expect(mt.trait.length).toBe(3);
    expect(mt.trait).toContain('mat_tri');
    expect(mt.trait).toContain('gong_cum');
  });
  it('bot chọn trait: tham chiếu (trừ bấm bừa) không lấy; bot chơi được ghép cặp cùng điểm, tổng 0, tối đa 2 cặp; tất định', () => {
    const moi = bayTrait(4242, 'g1', 5, 0, []);
    expect(chonTraitBot(timBot('ngoi_im')!, moi, { seed: 4242, vong: 5, gheId: 'g1' })).toEqual([]);
    expect(chonTraitBot(timBot('oracle')!, moi, { seed: 4242, vong: 5, gheId: 'g1' })).toEqual([]);
    for (const b of BOT_CHOI_DUOC) {
      const lay = chonTraitBot(b, moi, { seed: 4242, vong: 5, gheId: 'g1' });
      expect(lay.length % 2).toBe(0);
      expect(lay.length).toBeLessThanOrEqual(4);
      expect(canHopLe(lay), b.id).toBe(true);
      expect(lay).toEqual(chonTraitBot(b, moi, { seed: 4242, vong: 5, gheId: 'g1' }));
    }
    const bua = chonTraitBot(timBot('bam_bua')!, moi, { seed: 4242, vong: 5, gheId: 'g1' });
    expect(canHopLe(bua)).toBe(true);
  });
});

/* ═══ IV. ENGINE — trận bot dưới v54 và v55 ═════════════════════════════════════════════════ */
const gheBot = (i: number): GheMoi => ({
  id: `g${i}`, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] },
});
const BOTS: Bot[] = ['tat_tay', 'phong_thu', 'duoi_da', 'bat_day', 'ngoi_im'].map((id) => timBot(id)!);

function ctxCua(st: TrangThaiTran, seed: number, g: Ghe): BoiCanh {
  const o = st.map.o[st.vong - 1]!;
  return {
    seed, vong: st.vong, o: oCongKhai(o) as never, oThat: o, oTruoc: st.map.o[st.vong - 2], ghe: g,
    shop: bayShop(seed, st.vong, g.id, 0, g.danh_muc, tuyChonShop(st)),
    loiGon: st.loi_gon === true, soNguoiSong: st.ghe.filter((x) => !x.da_chay).length,
    maxTaiSan: maxTaiSanCua(st, g), bo: boMaTranCua(st),
    ...(st.ban_khong_thuan_quyen === true ? { banKhongThuanQuyen: true } : {}),
    ...(rangBuocCua(st, g, st.vong).teLiet ? { khoaLoi: true } : {}),
    ...tyLeCua(st, st.vong),
  };
}

/** Một vòng bot-chỉ, cùng hình với vòng lặp Monte Carlo (mua lõi → lệnh NAV → cược → chốt → mốc trait). */
function chayVong(st: TrangThaiTran, seed: number): { st: TrangThaiTran; kq: ReturnType<typeof chotPhien> } {
  const ghe = st.ghe.map((g, i) => {
    if (g.da_chay) return g;
    const r = botTaiCoCau(BOTS[i]!, { ...ctxCua(st, seed, g), ghe: { ...g, luot_khao_sat: viKhaoSat(st, g) } });
    return { ...ghiViKhaoSat(st, g, r.luot_khao_sat), danh_muc: r.danh_muc };
  });
  st = { ...st, ghe };
  st = apNhipLenhBotNav(st, BOTS);
  const daHoi = new Map<string, number>();
  const vongVua = st.vong;
  const kq = giaiQuyetVong(st, (cuoc) => {
    const g = st.ghe.find((x) => x.id === cuoc.ghe_id)!;
    const bot = BOTS[st.ghe.indexOf(g)]!;
    const ctx = ctxCua(st, seed, g);
    const n = daHoi.get(g.id) ?? 0; daHoi.set(g.id, n + 1);
    if (n === 0) {
      const y = bot.chonCamKet(ctx);
      if (y.hanh_dong === 'cat_lo') return { loai: 'bo' as const };
      if (y.hanh_dong === 'tang_cam_ket' && y.them > 0 && cuoc.duoc.includes('to')) return { loai: 'to' as const, them: Math.max(cuoc.con_thieu + 1, y.them) };
    }
    return bot.chonCuoc(cuoc, ctx);
  });
  const sau = apMocTraitCaBan(kq.trangThai, seed, vongVua, new Map(), (id) => BOTS[Number(id.slice(1))]).st;
  return { st: sau, kq };
}

function chayTran(seed: number, khoa: string, soVong = 15): { st: TrangThaiTran; kqs: ReturnType<typeof chotPhien>[] } {
  let st = taoTran(seed, [0, 1, 2, 3, 4].map(gheBot), luatCua(khoa), 16);
  const kqs: ReturnType<typeof chotPhien>[] = [];
  for (let v = 0; v < soVong && !daKetThuc(st); v += 1) {
    const r = chayVong(st, seed);
    st = r.st; kqs.push(r.kq);
  }
  return { st, kqs };
}

describe('IV. Engine — trận bot: v54 không lửa/trait; v55 có, đúng bất biến', () => {
  it('v54: không ghế nào có lửa/xu/trait, kết quả vòng không mang `lua`', () => {
    const { st, kqs } = chayTran(11, V54, 6);
    expect(st.ghe.every((g) => g.lua === undefined && g.xu === undefined && g.trait === undefined)).toBe(true);
    expect(kqs.every((k) => k.ketQua.lua === undefined)).toBe(true);
  });
  it('v55: sau vòng 1 mọi ghế còn chơi có lửa + xu; kết quả vòng mang `lua` với xu_them = nấc (+ nhiệm vụ lõi); ngồi im 0 lửa vì không vị thế', () => {
    const { st, kqs } = chayTran(11, V55, 6);
    for (const g of st.ghe) {
      if (g.da_chay) continue;
      expect(g.lua, g.id).toBeDefined();
      expect(g.xu, g.id).toBeGreaterThanOrEqual(0);
    }
    const ngoiIm = st.ghe[4]!;
    expect(ngoiIm.lua?.nac ?? 0).toBe(0);
    // D411 — ví gộp: ghế ngồi im vẫn nhận phần CẤP mỗi vòng (VÀNG cũ), nhưng KHÔNG một xu nào từ lửa/lõi — trần là
    // phần cấp cộng dồn sáu vòng.
    expect(ngoiIm.xu ?? 0).toBeLessThanOrEqual(HOLDEM_MATCH.START_LUOT_KHAO_SAT + 6 * HOLDEM_MATCH.LUOT_KHAO_SAT_MOI_VONG);
    for (const k of kqs) {
      expect(k.ketQua.lua).toBeDefined();
      for (const l of k.ketQua.lua!) {
        expect(l.sau.nac).toBeGreaterThanOrEqual(0);
        expect(l.xu_them).toBeGreaterThanOrEqual(LUA.XU_THEO_NAC[l.sau.nac]);
      }
    }
    const coLua = kqs.flatMap((k) => k.ketQua.lua ?? []).filter((l) => l.sau.nac >= 1);
    expect(coLua.length).toBeGreaterThan(0);
  });
  it('v55: cờ tắt hết ⇒ y hệt v54 từng ghế (song sinh); từng cờ bật riêng không nổ', () => {
    const luat54 = luatCua(V54);
    const tatHet = { ...luatCua(V55), ...Object.fromEntries(CO_MOI.map((c) => [c, false])) };
    for (const seed of [3, 17, 91]) {
      let a = taoTran(seed, [0, 1, 2, 3, 4].map(gheBot), luat54, 16);
      let b = taoTran(seed, [0, 1, 2, 3, 4].map(gheBot), tatHet, 16);
      for (let v = 0; v < 8; v += 1) {
        a = chayVong(a, seed).st; b = chayVong(b, seed).st;
      }
      expect(JSON.stringify(b.ghe)).toBe(JSON.stringify(a.ghe));
    }
    for (const co of CO_MOI) {
      const luat = { ...luatCua(V54), [co]: true };
      expect(() => {
        let st = taoTran(5, [0, 1, 2, 3, 4].map(gheBot), luat, 16);
        for (let v = 0; v < 6; v += 1) st = chayVong(st, 5).st;
      }, co).not.toThrow();
    }
  });
  it('v55 qua 6.000 ghế-vòng: xu không âm, nấc trong [0,3], dập chỉ ba lý do, chuỗi ≥ nấc; lửa đặc biệt chỉ khi ≥ 2 lõi Mua Đuổi', () => {
    let n = 0;
    for (let seed = 100; seed < 140; seed += 1) {
      const { kqs, st } = chayTran(seed, V55, 15);
      for (const k of kqs) {
        for (const l of k.ketQua.lua ?? []) {
          n += 1;
          expect(l.sau.nac).toBeGreaterThanOrEqual(0);
          expect(l.sau.nac).toBeLessThanOrEqual(3);
          expect(l.sau.chuoi).toBeGreaterThanOrEqual(l.sau.nac === 0 ? 0 : 1);
          expect(l.dap === null || ['doi_bias', 'doi_tay', 'mua_duoi_muon'].includes(l.dap)).toBe(true);
          expect(l.xu_them).toBeGreaterThanOrEqual(0);
        }
      }
      for (const g of st.ghe) expect(g.xu ?? 0).toBeGreaterThanOrEqual(0);
    }
    expect(n).toBeGreaterThan(1000);
  });
  it('mắt xích lửa: xuất hiện ở v55 khi ghế có nấc ≥ 1 lúc quyết, đúng dấu và đúng hệ số; v54 không bao giờ', () => {
    let co = 0;
    for (let seed = 200; seed < 230; seed += 1) {
      const { kqs } = chayTran(seed, V55, 12);
      for (const k of kqs) {
        for (const r of k.ketQua.ket_qua) {
          for (const m of r.chain) {
            if (m.kind !== 'lua') continue;
            co += 1;
            expect(m.thuan ? m.delta_bp > 0 : m.delta_bp < 0).toBe(true);
            expect(m.he_so_bp).toBe(m.thuan ? LUA.HE_SO_THUAN_BP[m.nac] : LUA.HE_SO_DAO_BP[m.nac]);
          }
        }
      }
      const { kqs: cu } = chayTran(seed, V54, 12);
      expect(cu.flatMap((k) => k.ketQua.ket_qua).some((r) => r.chain.some((m) => m.kind === 'lua'))).toBe(false);
    }
    expect(co).toBeGreaterThan(20);
  });
  it('mốc trait là vòng TÀI SẢN thường — không trùng vòng lõi, vòng kỳ ngộ hay vòng hết shop (D428: chợ trait nằm vào CHỖ HÀNG LÕI)', () => {
    const L = luatCua(V55);
    let soCo = 0;
    for (const [co, mocs] of Object.entries(MOC_TRAIT)) {
      // đúng cờ của khoá v55 (kỳ ngộ · giãn lá): mốc phải có shop và hàng lõi đang trống
      const nhip = nhipChonBai(Number(co), L.kyNgo === true, L.gianLaMapNgan === true);
      for (const v of mocs) {
        soCo += 1;
        expect(nhip[v - 1], `bàn ${co} · vòng ${v}`).toBe('tai_san');
        // giãn lá bật hay tắt thì lịch lõi cũng không được rơi vào mốc
        for (const g of [false, true]) expect(nhipChonBai(Number(co), false, g)[v - 1], `bàn ${co} · giãn lá ${g} · vòng ${v}`).not.toBe('chien_thuat');
      }
    }
    expect(soCo, 'bảng mốc rỗng thì bài này không canh gì').toBeGreaterThan(0);
  });
  it('mốc trait: sau vòng 1 · 6 · 9 · 13 bot chơi được mang trait cân 0; bot ngồi im không; ngoài mốc không đổi', () => {
    const { st, kqs } = chayTran(31, V55, 15);
    expect(kqs.length).toBeGreaterThanOrEqual(13);
    for (const g of st.ghe) {
      // MẤT TRÍ mang từ mốc trước xoá một TÀI ⇒ tổng âm đúng 2 mỗi lần nổ; không mang thì cân 0 tuyệt đối.
      const tong = tongDiem(g.trait ?? []);
      if ((g.trait ?? []).includes('mat_tri')) expect(tong, g.id).toBeLessThanOrEqual(0);
      else expect(tong, g.id).toBe(0);
    }
    expect(st.ghe[4]!.trait ?? []).toEqual([]);
    const coTrait = st.ghe.filter((g) => (g.trait?.length ?? 0) > 0).length;
    expect(coTrait).toBeGreaterThan(0);
    // ngoài mốc: chạy tới vòng 2 rồi vòng 3, trait không đổi giữa hai vòng không mốc.
    let s = taoTran(31, [0, 1, 2, 3, 4].map(gheBot), luatCua(V55), 16);
    s = chayVong(s, 31).st; // vòng 1 (mốc)
    const sau1 = s.ghe.map((g) => (g.trait ?? []).join(','));
    s = chayVong(s, 31).st; // vòng 2
    expect(s.ghe.map((g) => (g.trait ?? []).join(','))).toEqual(sau1);
  });
  it('xu nhiệm vụ lõi: mắt xích của lõi dương ⇒ +1 mỗi lõi; âm hay không cầm ⇒ 0', () => {
    const chain: MatXich[] = [
      { kind: 'nhan', id: 'don_bay', he_so_bp: 20000, delta_bp: 300, ma: 'btc' },
      { kind: 'canh_nhip', id: 'bat_day', trung: false, delta_bp: -1800 },
      { kind: 'song', ma: 'btc', nguong_bp: 500, dinh_bp: 800, phan_bp: 5000, delta_bp: 120 },
    ];
    expect(xuNhiemVuLoi(chain, { tai_san: ['btc'], chien_thuat: ['don_bay', 'bat_day', 'luot_song'] })).toBe(2 * LUA.XU_NHIEM_VU_LOI);
    expect(xuNhiemVuLoi(chain, { tai_san: ['btc'], chien_thuat: ['bat_day'] })).toBe(0);
    expect(xuNhiemVuLoi(chain, { tai_san: ['btc'], chien_thuat: [] })).toBe(0);
  });
});

/* ═══ V. CHỖ CẮM LỆNH — phí, trần, mốc, số mã ═══════════════════════════════════════════════ */
function tranHaiGhe(khoa: string, sua?: (g: Ghe) => Ghe): TrangThaiTran {
  const st = taoTran(777, [gheBot(0), gheBot(1)], luatCua(khoa), 16);
  return sua ? { ...st, ghe: st.ghe.map((g, i) => (i === 0 ? sua(g) : g)) } : st;
}
const phiCua = (st: TrangThaiTran, gheId: string, lenh: { ma: string; tien: number }[]): number => {
  const r = apLenhVongNav(st, gheId, lenh);
  expect(r.ok, r.loi ?? '').toBe(true);
  return (r.st.phi_giao_dich_vong ?? 0) - (st.phi_giao_dich_vong ?? 0);
};

describe('V. Chỗ cắm lệnh', () => {
  it('lửa nấc 2 ⇒ trượt giá ×0,8 (cổng luaPhi); nấc 0 hay cổng tắt ⇒ y phí v54', () => {
    const goc = phiCua(tranHaiGhe(V54), 'g0', [{ ma: 'btc', tien: 4000 }]);
    const nac0 = phiCua(tranHaiGhe(V55), 'g0', [{ ma: 'btc', tien: 4000 }]);
    expect(nac0).toBe(goc);
    const nac2 = phiCua(tranHaiGhe(V55, (g) => ({ ...g, lua: { nac: 2, chuoi: 2, bias: 'rui_ro' } })), 'g0', [{ ma: 'btc', tien: 4000 }]);
    expect(nac2).toBe(Math.floor((goc * 8000) / 10000));
    const tat = tranHaiGhe(V55, (g) => ({ ...g, lua: { nac: 2, chuoi: 2, bias: 'rui_ro' } }));
    expect(phiCua({ ...tat, lua_phi: false }, 'g0', [{ ma: 'btc', tien: 4000 }])).toBe(goc);
  });
  it('SỔ MỎNG (D425) ⇒ mỗi lệnh mất phí CỐ ĐỊNH, đốt (Quỹ vòng không đổi); mua không đủ trả ⇒ `so_mong`; bán nhỏ hơn phí về 0; v54 không phí', () => {
    const PHI = Math.floor((HOLDEM_MATCH.START_VON * THAM_SO.SO_MONG_PHI_LENH_BP) / 10000);
    expect(PHI).toBeGreaterThan(0);
    const thuong = tranHaiGhe(V55);
    const sm = tranHaiGhe(V55, (g) => ({ ...g, trait: ['so_mong'] }));
    expect(phiCua(sm, 'g0', [{ ma: 'btc', tien: 4000 }]), 'phí cố định không chảy vào Quỹ vòng').toBe(phiCua(thuong, 'g0', [{ ma: 'btc', tien: 4000 }]));
    const a = apLenhVongNav(thuong, 'g0', [{ ma: 'btc', tien: 4000 }, { ma: 'vang', tien: 2000 }]);
    const b = apLenhVongNav(sm, 'g0', [{ ma: 'btc', tien: 4000 }, { ma: 'vang', tien: 2000 }]);
    expect(a.ok && b.ok).toBe(true);
    expect(b.st.ghe[0]!.vi_the.btc, 'mỗi lệnh một lần phí, trừ vào vị thế').toBe(a.st.ghe[0]!.vi_the.btc! - PHI);
    expect(b.st.ghe[0]!.vi_the.vang).toBe(a.st.ghe[0]!.vi_the.vang! - PHI);
    expect(b.st.ghe[0]!.von).toBe(a.st.ghe[0]!.von);
    const a2 = apLenhVongNav(a.st, 'g0', [{ ma: 'btc', tien: -1000 }]);
    const b2 = apLenhVongNav(b.st, 'g0', [{ ma: 'btc', tien: -1000 }]);
    expect(b2.st.ghe[0]!.von, 'bán: phí trừ vào tiền về').toBe(a2.st.ghe[0]!.von - PHI);
    expect(apLenhVongNav(sm, 'g0', [{ ma: 'btc', tien: PHI }]).loi, 'mua 0 đồng sau phí').toBe('so_mong');
    const nho = apLenhVongNav(b.st, 'g0', [{ ma: 'vang', tien: -Math.floor(PHI / 2) }]);
    expect(nho.ok, 'bán nhỏ hơn phí không bị nhốt').toBe(true);
    expect(nho.st.ghe[0]!.von).toBe(b.st.ghe[0]!.von);
    const c0 = apLenhVongNav(tranHaiGhe(V54), 'g0', [{ ma: 'btc', tien: 4000 }]);
    const c1 = apLenhVongNav(tranHaiGhe(V54, (g) => ({ ...g, trait: ['so_mong'] })), 'g0', [{ ma: 'btc', tien: 4000 }]);
    expect(c1.st.ghe[0]!.vi_the).toEqual(c0.st.ghe[0]!.vi_the);
  });
  it('sổ đổi tay ghi tiền bán · mua khác bias · mua rủi ro · tổng mua; v54 không ghi', () => {
    const st = tranHaiGhe(V55, (g) => ({ ...g, lua: { nac: 1, chuoi: 1, bias: 'phong_thu' } }));
    const r = apLenhVongNav(st, 'g0', [{ ma: 'btc', tien: 3000 }, { ma: 'vang', tien: 2000 }]);
    expect(r.ok).toBe(true);
    expect(r.st.ghe[0]!.doi_tay_vong).toEqual({ ban: 0, mua_khac: 3000, mua_rui_ro: 3000, mua_tong: 5000 });
    const r2 = apLenhVongNav(r.st, 'g0', [{ ma: 'btc', tien: -1000 }]);
    expect(r2.st.ghe[0]!.doi_tay_vong!.ban).toBe(1000);
    expect(tranHaiGhe(V54).ghe[0]!.doi_tay_vong).toBeUndefined();
    const cu = apLenhVongNav(tranHaiGhe(V54), 'g0', [{ ma: 'btc', tien: 3000 }]);
    expect(cu.st.ghe[0]!.doi_tay_vong).toBeUndefined();
  });
  it('GÔNG CÙM (D425): BÁN cộng dồn trong vòng > 40% NAV ⇒ `gong_cum`, ≤ thì được; bản nháp cộng dồn qua cả chuỗi; MUA không trần; v54 không chặn', () => {
    // vào ~90% NAV ở vòng TRƯỚC — sổ đổi tay của vòng này trống, đúng như sau `chotPhien`
    const vao = (khoa: string): TrangThaiTran => {
      const r = apLenhMocNav(tranHaiGhe(khoa, (g) => ({ ...g, trait: ['gong_cum'] })), 'g0',
        [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }, { ma: 'vang', chieu: 'mua', moc_bp: 7500 }]);
      expect(r.ok, r.loi ?? '').toBe(true);
      return { ...r.st, ghe: r.st.ghe.map((g) => ({ ...g, doi_tay_vong: { ban: 0, mua_khac: 0, mua_rui_ro: 0, mua_tong: 0 } })) };
    };
    const st = vao(V55);
    const r1 = apLenhMocNav(st, 'g0', [{ ma: 'btc', chieu: 'ban', moc_bp: 10000 }]);
    expect(r1.ok, 'bán sạch btc ≈ 50% NAV > 40%').toBe(false); expect(r1.loi).toBe('gong_cum');
    const r2 = apLenhMocNav(st, 'g0', [{ ma: 'btc', chieu: 'ban', moc_bp: 5000 }]);
    expect(r2.ok, 'bán nửa btc ≈ 25% NAV').toBe(true);
    const r3 = apLenhMocNav(r2.st, 'g0', [{ ma: 'vang', chieu: 'ban', moc_bp: 5000 }]);
    expect(r3.ok, '25% đã bán + nửa vàng ≈ 18% NAV ⇒ ≈ 43% > 40%').toBe(false);
    expect(r3.loi).toBe('gong_cum');
    const chuoi = [{ ma: 'btc', chieu: 'ban' as const, moc_bp: 5000 }, { ma: 'vang', chieu: 'ban' as const, moc_bp: 5000 }];
    expect(apLenhMocNav(st, 'g0', chuoi).loi).toBe('gong_cum');
    // bản nháp (`giaiLenhMoc` — màn xem trước cũng gọi) tự bác, không đợi cú áp thật
    const g0 = st.ghe[0]!;
    expect(giaiLenhMoc(g0, chuoi, false, tuyChonLenhV55(st, g0)).loi).toBe('gong_cum');
    expect(apLenhMocNav(r2.st, 'g0', [{ ma: 'vang', chieu: 'mua', moc_bp: 10000 }]).ok, 'mua không trần').toBe(true);
    expect(apLenhMocNav(vao(V54), 'g0', [{ ma: 'btc', chieu: 'ban', moc_bp: 10000 }]).ok).toBe(true);
  });
  it('lõi nav (D425): trần BÁN đếm cả ĐÓNG KHỐNG; phí cố định trừ cả lệnh khống; `phi_dot` = đúng phần đã đốt', () => {
    const nhan = (g: GheNav): GheNav => ({ von: g.von, vi_the: { ...g.vi_the }, vi_the_khong: { ...(g.vi_the_khong ?? {}) } });
    const g: GheNav = { von: 5000, vi_the: { btc: 3000 }, vi_the_khong: { vang: 3000 } };
    const tran = { tranBanVong: { tranTien: 2000, daBan: 0 } };
    expect(apLenhGiaoDich(nhan(g), [{ ma: 'vang', tien: -2500, khong: true }], tran).loi).toBe('gong_cum');
    expect(apLenhGiaoDich(nhan(g), [{ ma: 'vang', tien: -1500, khong: true }], tran).loi).toBeNull();
    expect(apLenhGiaoDich(nhan(g), [{ ma: 'btc', tien: -1500 }, { ma: 'vang', tien: -1500, khong: true }], tran).loi).toBe('gong_cum');
    expect(apLenhGiaoDich(nhan(g), [{ ma: 'btc', tien: -1500 }], { tranBanVong: { tranTien: 2000, daBan: 600 } }).loi,
      'phần đã bán trước chuỗi được tính').toBe('gong_cum');
    const PHI = 50;
    const co = nhan(g); const ko = nhan(g);
    const r = apLenhGiaoDich(co, [{ ma: 'vang', tien: -1000, khong: true }, { ma: 'btc', tien: -1000 }], { phiCoDinhLenh: PHI });
    apLenhGiaoDich(ko, [{ ma: 'vang', tien: -1000, khong: true }, { ma: 'btc', tien: -1000 }]);
    expect(co.von).toBe(ko.von - 2 * PHI);
    expect(r.phi_dot).toBe(2 * PHI);
    const rong: GheNav = { von: 5000, vi_the: {}, vi_the_khong: {} };
    expect(apLenhGiaoDich(nhan(rong), [{ ma: 'vang', tien: PHI, khong: true }], { phiCoDinhLenh: PHI }).loi).toBe('so_mong');
    const mo = nhan(rong);
    expect(apLenhGiaoDich(mo, [{ ma: 'vang', tien: 1000, khong: true }], { phiCoDinhLenh: PHI }).phi_dot).toBe(PHI);
    const mo0 = nhan(rong);
    apLenhGiaoDich(mo0, [{ ma: 'vang', tien: 1000, khong: true }]);
    expect(mo.vi_the_khong!.vang).toBe(mo0.vi_the_khong!.vang! - PHI);
    expect(apLenhGiaoDich(nhan(g), [{ ma: 'btc', tien: -1000 }]).phi_dot, 'không phí ⇒ không trường').toBeUndefined();
  });
  it('bot mang GÔNG CÙM / SỔ MỎNG (D425): bối cảnh đọc CÙNG `tuyChonLenhV55`; lệnh thoát kẹp vào phần bán còn được, mua quá nhỏ bị bỏ ⇒ engine không bác lệnh bot vì trait', () => {
    let kep = 0; let lenhBot = 0;
    for (const seed of [3, 7, 11, 19, 23, 29, 31, 37]) {
      let st = taoTran(seed, [0, 1, 2, 3, 4].map(gheBot), luatCua(V55), 16);
      st = { ...st, ghe: st.ghe.map((g, i) => (i === 0 ? { ...g, trait: ['gong_cum'] as TraitId[] } : i === 1 ? { ...g, trait: ['so_mong'] as TraitId[] } : g)) };
      for (let v = 0; v < 15 && !daKetThuc(st); v += 1) {
        const bc = boiCanhLenhVong(st);
        for (const i of [0, 1]) {
          const g = st.ghe[i]!;
          if (g.da_chay || !bc) continue;
          const bcG = boiCanhLenhGhe(st, g, bc)!;
          const tc = tuyChonLenhV55(st, g);
          if (i === 0) expect(bcG.tran_ban_con).toBe(Math.max(0, tc.tranBanVong!.tranTien - tc.tranBanVong!.daBan));
          if (i === 1) expect(bcG.phi_co_dinh_lenh).toBe(tc.phiCoDinhLenh);
          const lenh = lenhBotNav(BOTS[i]!, g, st.vong, maxTaiSanCua(st, g), bcG);
          if (i === 0) {
            const tu: BoiCanhLenh = { ...bcG };
            delete tu.tran_ban_con;
            const ban = (ds: { tien: number }[]) => ds.reduce((t, l) => t + (l.tien < 0 ? -l.tien : 0), 0);
            if (ban(lenhBotNav(BOTS[0]!, g, st.vong, maxTaiSanCua(st, g), tu)) > ban(lenh)) kep += 1;
          }
          if (lenh.length === 0) continue;
          lenhBot += 1;
          const r = apLenhVongNav(st, g.id, lenh);
          expect(r.loi === 'gong_cum' || r.loi === 'so_mong', `ghế ${i} vòng ${st.vong}: ${r.loi}`).toBe(false);
        }
        st = chayVong(st, seed).st;
      }
    }
    expect(lenhBot).toBeGreaterThan(0);
    expect(kep, 'phải có vòng bot MUỐN bán quá trần — không thì bài này không canh gì').toBeGreaterThan(0);
    // SỔ MỎNG: phần đầu tư đúng 200 (tiền mặt = nền + 200) ⇒ mọi lệnh mua ≤ 200; phí 100 ⇒ ngưỡng 2 × phí = 200 ⇒ bỏ hết
    let coMua = 0;
    const st0 = taoTran(5, [0, 1, 2, 3, 4].map(gheBot), luatCua(V55), 16);
    const nho = { von: HOLDEM_MATCH.CAM_KET_NEN + 200, vi_the: {} };
    for (let v = 1; v <= 14; v += 1) {
      const bc = boiCanhLenhVong({ ...st0, vong: v });
      if (!bc) continue;
      const mua = (b: BoiCanhLenh) => lenhBotNav(BOTS[1]!, nho, v, 3, b).filter((l) => l.tien > 0);
      if (mua(bc).length > 0) coMua += 1;
      expect(mua({ ...bc, phi_co_dinh_lenh: 100 }), `vòng ${v}`).toEqual([]);
    }
    expect(coMua, 'không phí thì bot có mua — không thì bài này không canh gì').toBeGreaterThan(0);
  });
  it('LỆNH MỊN ⇒ mốc 10% hợp lệ; v54 mốc 10% là `moc_khong_hop_le`; mốc MUA 100% luôn có (CẤM TẤT TAY gỡ ở D425)', () => {
    expect(apLenhMocNav(tranHaiGhe(V55), 'g0', [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }]).ok).toBe(true);
    expect(TRAIT.some((t) => (t.id as string) === 'cam_tat_tay')).toBe(false);
    const min = tranHaiGhe(V55, (g) => ({ ...g, trait: ['lenh_min'] }));
    expect(apLenhMocNav(min, 'g0', [{ ma: 'btc', chieu: 'mua', moc_bp: 1000 }]).ok).toBe(true);
    expect(apLenhMocNav(tranHaiGhe(V55), 'g0', [{ ma: 'btc', chieu: 'mua', moc_bp: 1000 }]).loi).toBe('moc_khong_hop_le');
    expect(apLenhMocNav(tranHaiGhe(V54, (g) => ({ ...g, trait: ['lenh_min'] })), 'g0', [{ ma: 'btc', chieu: 'mua', moc_bp: 1000 }]).loi).toBe('moc_khong_hop_le');
  });
  it('TẦM RỘNG ⇒ trần số mã 4; MỘT GIỎ ⇒ 2; cả hai ⇒ 2; v54 ⇒ 3', () => {
    expect(maxTaiSanCua(tranHaiGhe(V55, (g) => ({ ...g, trait: ['tam_rong'] })), tranHaiGhe(V55, (g) => ({ ...g, trait: ['tam_rong'] })).ghe[0]!)).toBe(HOLDEM_MATCH.MAX_TAI_SAN + 1);
    const mg = tranHaiGhe(V55, (g) => ({ ...g, trait: ['mot_gio'] }));
    expect(maxTaiSanCua(mg, mg.ghe[0]!)).toBe(2);
    const ca = tranHaiGhe(V55, (g) => ({ ...g, trait: ['tam_rong', 'mot_gio'] }));
    expect(maxTaiSanCua(ca, ca.ghe[0]!)).toBe(2);
    const cu = tranHaiGhe(V54, (g) => ({ ...g, trait: ['tam_rong'] }));
    expect(maxTaiSanCua(cu, cu.ghe[0]!)).toBe(HOLDEM_MATCH.MAX_TAI_SAN);
  });
});

/* ═══ VI. DÂY CHUYỀN — KỶ LUẬT · CHỐT NON · SÓNG · TÊ LIỆT ═══════════════════════════════════ */
function ngheCuaBan(o: TrangThaiTran['map']['o'][number]): boolean { return o.kind === 'giai_doan' || o.kind === 'su_kien'; }

describe('VI. Dây chuyền', () => {
  const HO_TRUOT: readonly MatXich['kind'][] = ['crowding', 'hoan_truot', 'khoa_giam_truot', 'xep_hang', 'dao_phi', 'dac_quyen'];
  const loiTruoc = (chain: readonly MatXich[], toi: number): number =>
    chain.slice(0, toi).filter((m) => !HO_TRUOT.includes(m.kind)).reduce((s, m) => s + m.delta_bp, 0);

  it('KỶ LUẬT (chanLoTrait) mở đúng máy sàn `chan_lo_san` + phí bảo hiểm khi lá Chặn Lỗ đã rời shop; v54 ghế mang trait không có gì', () => {
    let coSan = 0; let coPhi = 0;
    for (let seed = 300; seed < 420; seed += 1) {
      const st = taoTran(seed, [gheBot(0), gheBot(1)], luatCua(V55), 16);
      const g: Ghe = { ...st.ghe[0]!, trait: ['ky_luat'], vi_the: { btc: 6000 }, von: 4000, danh_muc: { tai_san: ['btc'], chien_thuat: [] } };
      for (let v = 1; v <= 15; v += 1) {
        const o = st.map.o[v]!; if (!ngheCuaBan(o)) continue;
        const { chain } = dungChuoi({ ...st, vong: v, ghe: [g, st.ghe[1]!] }, g, o);
        const iSan = chain.findIndex((m) => m.kind === 'chan_lo_san');
        if (iSan >= 0) {
          coSan += 1;
          const m = chain[iSan]! as Extract<MatXich, { kind: 'chan_lo_san' }>;
          expect(m.truoc_san_bp).toBeLessThan(m.san_bp);
          expect(m.delta_bp).toBe(m.san_bp - m.truoc_san_bp);
        }
        if (chain.some((m) => m.kind === 'dac_quyen' && m.id === 'chan_lo')) coPhi += 1;
        const cu = dungChuoi({ ...taoTran(seed, [gheBot(0), gheBot(1)], luatCua(V54), 16), vong: v, ghe: [g, st.ghe[1]!] }, g, o).chain;
        expect(cu.some((m) => m.kind === 'chan_lo_san' || (m.kind === 'dac_quyen' && m.id === 'chan_lo'))).toBe(false);
      }
    }
    expect(coPhi).toBeGreaterThan(50);
    expect(coSan).toBeGreaterThan(0);
  });
  it('CHỐT NON (đường D409 — cổng `kyLuatSauDonBay` tắt): phần lõi vượt +25% bị cắt đúng phần vượt (`chot_non_tran`), đứng trước NHÂN; không mang ⇒ không có; v54 không có', () => {
    let co = 0;
    for (let seed = 500; seed < 700; seed += 1) {
      const st = taoTran(seed, [gheBot(0), gheBot(1)], LUAT_D409_KY_LUAT(), 16);
      const g: Ghe = { ...st.ghe[0]!, trait: ['chot_non'], vi_the: { btc: 6000 }, von: 4000, danh_muc: { tai_san: ['btc'], chien_thuat: ['don_bay'] } };
      for (let v = 1; v <= 15; v += 1) {
        const o = st.map.o[v]!;
        const { chain } = dungChuoi({ ...st, vong: v, ghe: [g, st.ghe[1]!] }, g, o);
        const i = chain.findIndex((m) => m.kind === 'chot_non_tran');
        const iNhan = chain.findIndex((m) => m.kind === 'nhan');
        if (i >= 0) {
          co += 1;
          const m = chain[i]! as Extract<MatXich, { kind: 'chot_non_tran' }>;
          expect(m.tran_bp).toBe(THAM_SO.CHOT_NON_TRAN_BP);
          expect(m.truoc_tran_bp).toBeGreaterThan(m.tran_bp);
          expect(m.delta_bp).toBe(m.tran_bp - m.truoc_tran_bp);
          expect(loiTruoc(chain, i)).toBe(m.truoc_tran_bp);
          if (iNhan >= 0) expect(i).toBeLessThan(iNhan);
        }
        const khong = dungChuoi({ ...st, vong: v, ghe: [{ ...g, trait: [] }, st.ghe[1]!] }, { ...g, trait: [] }, o).chain;
        expect(khong.some((m) => m.kind === 'chot_non_tran')).toBe(false);
      }
    }
    expect(co).toBeGreaterThan(0);
  });
  it('LƯỚT SÓNG MỚI: mắt xích `song` chỉ khi đỉnh chạm mục tiêu; delta = (fill − Δ) × phần; v54 và ghế không cầm lá không có', () => {
    let co = 0; let am = 0;
    for (let seed = 800; seed < 1000; seed += 1) {
      const st = taoTran(seed, [gheBot(0), gheBot(1)], luatCua(V55), 16);
      const g: Ghe = {
        ...st.ghe[0]!, vi_the: { btc: 6000 }, von: 4000,
        danh_muc: { tai_san: ['btc'], chien_thuat: ['luot_song'] },
        chot_loi: [{ ma: 'btc', nguong_bp: 500, phan_bp: 5000 }],
      };
      for (let v = 1; v <= 15; v += 1) {
        const o = st.map.o[v]!;
        const { chain } = dungChuoi({ ...st, vong: v, ghe: [g, st.ghe[1]!] }, g, o);
        const delta = chain.filter((m) => ['tai_san', 'echo', 'crowding', 'hoan_truot'].includes(m.kind) && (m as { id?: string }).id === 'btc')
          .reduce((s, m) => s + m.delta_bp, 0);
        const song = chain.find((m) => m.kind === 'song') as Extract<MatXich, { kind: 'song' }> | undefined;
        if (song) {
          co += 1;
          expect(song.dinh_bp).toBeGreaterThanOrEqual(song.nguong_bp);
          expect(song.dinh_bp).toBeGreaterThanOrEqual(Math.max(delta, 0));
          expect(song.delta_bp).toBe(Math.floor(((Math.min(song.nguong_bp, song.dinh_bp) - delta) * song.phan_bp) / 10000));
          if (song.delta_bp < 0) am += 1;
        }
        const khongLa = dungChuoi({ ...st, vong: v, ghe: [{ ...g, danh_muc: { tai_san: ['btc'], chien_thuat: [] } }, st.ghe[1]!] }, { ...g, danh_muc: { tai_san: ['btc'], chien_thuat: [] } }, o).chain;
        expect(khongLa.some((m) => m.kind === 'song')).toBe(false);
        const cu = dungChuoi({ ...taoTran(seed, [gheBot(0), gheBot(1)], luatCua(V54), 16), vong: v, ghe: [g, st.ghe[1]!] }, g, o).chain;
        expect(cu.some((m) => m.kind === 'song')).toBe(false);
      }
    }
    expect(co).toBeGreaterThan(20);
    expect(am, 'phải có ca ra sớm để lại tiền trên bàn (Δ vượt mục tiêu)').toBeGreaterThan(0);
  });
  it('TÊ LIỆT: vòng bị khoá ⇒ lõi câm (không `nhan` của Đòn Bẩy); hết khoá ⇒ có lại', () => {
    const st = taoTran(4242, [gheBot(0), gheBot(1)], luatCua(V55), 16);
    const g: Ghe = { ...st.ghe[0]!, trait: ['te_liet'], te_liet_den_vong: 7, vi_the: { btc: 6000 }, von: 4000, danh_muc: { tai_san: ['btc'], chien_thuat: ['don_bay'] } };
    const o = st.map.o[6]!;
    const khoa = dungChuoi({ ...st, vong: 6, ghe: [g, st.ghe[1]!] }, g, o).chain;
    expect(khoa.some((m) => m.kind === 'nhan')).toBe(false);
    const mo = dungChuoi({ ...st, vong: 8, ghe: [g, st.ghe[1]!] }, g, st.map.o[8]!).chain;
    const moKhongTrait = dungChuoi({ ...st, vong: 8, ghe: [{ ...g, trait: [] }, st.ghe[1]!] }, { ...g, trait: [] }, st.map.o[8]!).chain;
    expect(mo.some((m) => m.kind === 'nhan')).toBe(moKhongTrait.some((m) => m.kind === 'nhan'));
  });
});

/* ═══ VII. VÍ GỘP XU (D411) ════════════════════════════════════════════════════════════════════════ */
describe('VII. Ví gộp XU (D411)', () => {
  const GIA = HOLDEM_MATCH.CHI_PHI_KHAO_SAT_LAI;
  it('chiPhiKhaoSat: có cổng ⇒ lần đầu miễn phí; không cổng ⇒ trừ từ lần đầu (replay khoá cũ nguyên)', () => {
    expect([0, 1, 2, 3].map((n) => chiPhiKhaoSat({ khao_sat_dau_mien_phi: true }, n))).toEqual([0, 0, GIA, 2 * GIA]);
    expect([0, 1, 2, 3].map((n) => chiPhiKhaoSat({}, n))).toEqual([0, GIA, 2 * GIA, 3 * GIA]);
  });
  it('viKhaoSat / ghiViKhaoSat: gộp ⇒ đọc/ghi xu; không gộp ⇒ luot_khao_sat, trường kia không đụng', () => {
    const g = { xu: 7, luot_khao_sat: 3 };
    expect(viKhaoSat({ gop_xu: true }, g)).toBe(7);
    expect(viKhaoSat({}, g)).toBe(3);
    expect(ghiViKhaoSat({ gop_xu: true }, g, 1)).toEqual({ xu: 1, luot_khao_sat: 3 });
    expect(ghiViKhaoSat({}, g, 1)).toEqual({ xu: 7, luot_khao_sat: 1 });
    expect(g, 'không sửa đầu vào').toEqual({ xu: 7, luot_khao_sat: 3 });
  });
  it('taoTran: v55 ví khởi điểm ở xu, luot_khao_sat 0; v54 luot_khao_sat khởi điểm, không xu', () => {
    const a = taoTran(3, [0, 1, 2, 3, 4].map(gheBot), luatCua(V55), 16);
    const b = taoTran(3, [0, 1, 2, 3, 4].map(gheBot), luatCua(V54), 16);
    expect(a.ghe.every((g) => g.xu === HOLDEM_MATCH.START_LUOT_KHAO_SAT && g.luot_khao_sat === 0)).toBe(true);
    expect(b.ghe.every((g) => g.xu === undefined && g.luot_khao_sat === HOLDEM_MATCH.START_LUOT_KHAO_SAT)).toBe(true);
  });
  it('chốt vòng: phần cấp chảy vào xu khi gộp, vào luot_khao_sat khi tắt riêng gopXu', () => {
    const khongLua = { ...luatCua(V55), lua: false, nhiemVuLoi: false };
    let a = taoTran(9, [0, 1, 2, 3, 4].map(gheBot), khongLua, 16);
    let b = taoTran(9, [0, 1, 2, 3, 4].map(gheBot), { ...khongLua, gopXu: false }, 16);
    const xuA = a.ghe.map((g) => g.xu ?? 0);
    const ksB = b.ghe.map((g) => g.luot_khao_sat);
    const theo = () => ({ loai: 'theo' as const });
    a = giaiQuyetVong(a, theo).trangThai; b = giaiQuyetVong(b, theo).trangThai;
    a.ghe.forEach((g, i) => { if (!g.da_chay) expect(g.xu, g.id).toBe(xuA[i]! + HOLDEM_MATCH.LUOT_KHAO_SAT_MOI_VONG); });
    b.ghe.forEach((g, i) => { if (!g.da_chay) expect(g.luot_khao_sat, g.id).toBe(ksB[i]! + HOLDEM_MATCH.LUOT_KHAO_SAT_MOI_VONG); });
  });
});

/* ═══ VIII. VÒNG 3 (D422) ════════════════════════════════════════════════════════════════════════════════════
 * Founder 26/09: KỶ LUẬT chọn B (sàn đỡ cả phần vay, vẫn thu phí mỗi vòng) · CHỐT NON nặng tương xứng · lửa không phạt
 * khi đảo chiều · LỬA GIẢ → MÙ LỬA · BÌNH TĨNH/BÁO TRỄ → KIÊN NHẪN/NÓNG VỘI · MÙ TIN che NGẪU NHIÊN (tier 4) · SƯƠNG MÙ
 * lá PHA hai mặt · thêm ĐI SAU ↔ LỘ LỆNH. Mỗi mục có vế ngược (không mang / cổng tắt ⇒ không có). */
describe('VIII. Vòng 3 (D422)', () => {
  const HO_TRUOT3: readonly MatXich['kind'][] = ['crowding', 'hoan_truot', 'khoa_giam_truot', 'xep_hang', 'dao_phi', 'dac_quyen'];
  const loiTruoc3 = (chain: readonly MatXich[], toi: number): number =>
    chain.slice(0, toi).filter((m) => !HO_TRUOT3.includes(m.kind)).reduce((t, m) => t + m.delta_bp, 0);
  const dm = (ma: string, ct: string[] = []) => ({ tai_san: [ma], chien_thuat: ct as never[], ...(ct.includes('don_bay') ? { gan: { don_bay: ma } } : {}) });

  it('lửa không phạt đảo: `matXichLua(…, true)` bỏ vế lỗ, giữ vế lãi; v55 không sinh mắt xích lửa âm, tắt cờ thì có', () => {
    const phan = { btc: 1000, vang: -800 };
    const co = matXichLua(phan, 3, true);
    expect(co.map((x) => x.ma)).toEqual(['btc']);
    expect(matXichLua(phan, 3, false).some((x) => !x.thuan)).toBe(true);
    let am = 0; let amTat = 0;
    for (let seed = 700; seed < 760; seed += 1) {
      const st = taoTran(seed, [gheBot(0), gheBot(1)], luatCua(V55), 16);
      const stTat = taoTran(seed, [gheBot(0), gheBot(1)], { ...luatCua(V55), luaKhongPhatDao: false }, 16);
      const g: Ghe = { ...st.ghe[0]!, lua: { nac: 3, chuoi: 4, bias: 'rui_ro' }, vi_the: { btc: 6000 }, von: 4000, danh_muc: dm('btc') };
      for (let v = 1; v <= 15; v += 1) {
        const o = st.map.o[v]!;
        am += dungChuoi({ ...st, vong: v, ghe: [g, st.ghe[1]!] }, g, o).chain.filter((m) => m.kind === 'lua' && !m.thuan).length;
        amTat += dungChuoi({ ...stTat, vong: v, ghe: [g, stTat.ghe[1]!] }, g, o).chain.filter((m) => m.kind === 'lua' && !m.thuan).length;
      }
    }
    expect(am).toBe(0);
    expect(amTat).toBeGreaterThan(0);
  });

  it('KỶ LUẬT (cổng sau-Đòn-Bẩy): sàn đặt SAU `nhan` (đỡ cả phần vay), phí mỗi vòng; tắt cổng ⇒ sàn đứng TRƯỚC `nhan` như D409', () => {
    let sau = 0; let truoc = 0; let phi = 0; let vong = 0;
    for (let seed = 300; seed < 460; seed += 1) {
      for (const [luat, laSau] of [[luatCua(V55), true], [LUAT_D409_KY_LUAT(), false]] as const) {
        const st = taoTran(seed, [gheBot(0), gheBot(1)], luat, 16);
        const g: Ghe = { ...st.ghe[0]!, trait: ['ky_luat'], vi_the: { btc: 6000 }, von: 4000, danh_muc: dm('btc', ['don_bay']) };
        for (let v = 1; v <= 15; v += 1) {
          const o = st.map.o[v]!;
          const { chain } = dungChuoi({ ...st, vong: v, ghe: [g, st.ghe[1]!] }, g, o);
          if (laSau) {
            vong += 1;
            if (chain.some((m) => m.kind === 'dac_quyen' && m.id === 'chan_lo' && m.delta_bp === -THAM_SO.KY_LUAT_PHI_BP)) phi += 1;
          }
          const iSan = chain.findIndex((m) => m.kind === 'chan_lo_san');
          const iNhan = chain.findIndex((m) => m.kind === 'nhan');
          if (iSan < 0 || iNhan < 0) continue;
          const m = chain[iSan] as Extract<MatXich, { kind: 'chan_lo_san' }>;
          expect(m.delta_bp).toBe(m.san_bp - m.truoc_san_bp);
          if (laSau) {
            sau += 1;
            expect(iSan).toBeGreaterThan(iNhan);
            expect(m.san_bp).toBe(-THAM_SO.KY_LUAT_SAN_BP);
            expect(loiTruoc3(chain, iSan)).toBe(m.truoc_san_bp);
          } else {
            truoc += 1;
            expect(iSan).toBeLessThan(iNhan);
          }
        }
      }
    }
    expect(phi).toBe(vong);
    expect(sau).toBeGreaterThan(0);
    expect(truoc).toBeGreaterThan(0);
  });

  it('CHỐT NON (cổng sau-Đòn-Bẩy): trần đặt SAU `nhan` — cắt cả phần vay; delta = trần − phần lãi trước trần (trừ họ trượt)', () => {
    let co = 0; let sauNhan = 0;
    for (let seed = 500; seed < 700; seed += 1) {
      const st = taoTran(seed, [gheBot(0), gheBot(1)], luatCua(V55), 16);
      const g: Ghe = { ...st.ghe[0]!, trait: ['chot_non'], vi_the: { btc: 6000 }, von: 4000, danh_muc: dm('btc', ['don_bay']) };
      for (let v = 1; v <= 15; v += 1) {
        const o = st.map.o[v]!;
        const { chain } = dungChuoi({ ...st, vong: v, ghe: [g, st.ghe[1]!] }, g, o);
        const i = chain.findIndex((m) => m.kind === 'chot_non_tran');
        if (i < 0) continue;
        co += 1;
        const m = chain[i] as Extract<MatXich, { kind: 'chot_non_tran' }>;
        expect(m.tran_bp).toBe(THAM_SO.CHOT_NON_TRAN_BP);
        expect(m.delta_bp).toBe(m.tran_bp - m.truoc_tran_bp);
        expect(loiTruoc3(chain, i)).toBe(m.truoc_tran_bp);
        const iNhan = chain.findIndex((x) => x.kind === 'nhan');
        if (iNhan >= 0) { sauNhan += 1; expect(i).toBeGreaterThan(iNhan); }
      }
    }
    expect(co).toBeGreaterThan(0);
    expect(sauNhan).toBeGreaterThan(0);
  });

  it('MÙ LỬA: lửa luôn tắt (nấc 0, không mắt xích lửa) và nhận đúng +2 xu mỗi vòng thay xu của lửa', () => {
    const seed = 4242;
    let st = taoTran(seed, [0, 1, 2, 3, 4].map(gheBot), luatCua(V55), 16);
    st = { ...st, ghe: st.ghe.map((g, i) => (i === 2 ? { ...g, trait: ['mu_lua'] as TraitId[], trait_tu_vong: { mu_lua: 1 } } : g)) };
    let soVong = 0;
    for (let v = 0; v < 8 && !daKetThuc(st); v += 1) {
      const r = chayVong(st, seed);
      const l = r.kq.ketQua.lua?.find((x) => x.ghe_id === 'g2');
      if (l) {
        soVong += 1;
        expect(l.sau.nac).toBe(0);
        const loi = xuNhiemVuLoi(r.kq.ketQua.ket_qua.find((k) => k.ghe_id === 'g2')!.chain, r.st.ghe[2]!.danh_muc);
        expect(l.xu_them).toBe(THAM_SO.MU_LUA_XU + loi);
      }
      expect(r.kq.ketQua.ket_qua.find((k) => k.ghe_id === 'g2')?.chain.some((m) => m.kind === 'lua') ?? false).toBe(false);
      st = r.st;
    }
    expect(soVong).toBeGreaterThan(3);
    // Lấy MÙ LỬA ở mốc giữa trận: vòng đầu mang tật, nấc cũ vẫn còn (chốt phiên vòng trước chưa thấy tật) ⇒ chuỗi vẫn
    // không có mắt xích lửa. Vế đối chứng: cùng ghế không mang ⇒ lửa có mặt, để bài này không canh rỗng.
    let coLuaKhiKhongMang = 0;
    for (let sd = 300; sd < 340; sd += 1) {
      const s0 = taoTran(sd, [gheBot(0), gheBot(1)], luatCua(V55), 16);
      const g: Ghe = { ...s0.ghe[0]!, lua: { nac: 2, chuoi: 3, bias: 'rui_ro' }, trait: ['mu_lua'], vi_the: { btc: 6000 }, von: 4000, danh_muc: dm('btc') };
      for (let v = 1; v <= 15; v += 1) {
        const s2 = { ...s0, vong: v, ghe: [g, s0.ghe[1]!] };
        expect(dungChuoi(s2, g, s0.map.o[v]!).chain.some((m) => m.kind === 'lua')).toBe(false);
        const gT = { ...g, trait: [] as TraitId[] };
        if (dungChuoi({ ...s2, ghe: [gT, s0.ghe[1]!] }, gT, s0.map.o[v]!).chain.some((m) => m.kind === 'lua')) coLuaKhiKhongMang += 1;
      }
    }
    expect(coLuaKhiKhongMang).toBeGreaterThan(20);
  });

  it('KIÊN NHẪN: mã giữ liền ≥ 3 vòng có lãi ⇒ `kien_nhan` = 10 % phần lãi theo mã; giữ 2 vòng, lỗ, hay không mang ⇒ không', () => {
    let co = 0;
    for (let seed = 800; seed < 900; seed += 1) {
      const st = taoTran(seed, [gheBot(0), gheBot(1)], luatCua(V55), 16);
      const g: Ghe = { ...st.ghe[0]!, trait: ['kien_nhan'], giu_lien: { btc: 3 }, vi_the: { btc: 6000 }, von: 4000, danh_muc: dm('btc') };
      for (let v = 1; v <= 15; v += 1) {
        const o = st.map.o[v]!;
        const s2 = { ...st, vong: v, ghe: [g, st.ghe[1]!] };
        const { chain } = dungChuoi(s2, g, o);
        const i = chain.findIndex((m) => m.kind === 'kien_nhan');
        const phan = chain.filter((m) => m.kind !== 'lua' && m.kind !== 'kien_nhan')
          .filter((m) => { const t = tangCuaMatXich(s2, m); return t.tang === 'ma' && t.ma === 'btc'; })
          .reduce((t, m) => t + m.delta_bp, 0);
        if (phan > 0 && Math.floor((phan * THAM_SO.KIEN_NHAN_THUONG_BP) / 10000) > 0) {
          co += 1;
          expect(i).toBeGreaterThanOrEqual(0);
          const m = chain[i] as Extract<MatXich, { kind: 'kien_nhan' }>;
          expect(m.ma).toBe('btc');
          expect(m.delta_bp).toBe(Math.floor((phan * THAM_SO.KIEN_NHAN_THUONG_BP) / 10000));
        } else {
          expect(i).toBe(-1);
        }
        const g2 = { ...g, giu_lien: { btc: 2 } };
        expect(dungChuoi({ ...s2, ghe: [g2, st.ghe[1]!] }, g2, o).chain.some((m) => m.kind === 'kien_nhan')).toBe(false);
        const g3 = { ...g, trait: [] as TraitId[] };
        expect(dungChuoi({ ...s2, ghe: [g3, st.ghe[1]!] }, g3, o).chain.some((m) => m.kind === 'kien_nhan')).toBe(false);
      }
    }
    expect(co).toBeGreaterThan(20);
  });

  it('NÓNG VỘI (gương KIÊN NHẪN): mã giữ liền QUÁ 3 vòng có lãi ⇒ `nong_voi` cắt `NONG_VOI_CAT_BP` phần lãi theo mã; giữ 3 vòng, lỗ, hay không mang ⇒ không', () => {
    let co = 0;
    for (let seed = 800; seed < 900; seed += 1) {
      const st = taoTran(seed, [gheBot(0), gheBot(1)], luatCua(V55), 16);
      const g: Ghe = { ...st.ghe[0]!, trait: ['nong_voi'], giu_lien: { btc: 4 }, vi_the: { btc: 6000 }, von: 4000, danh_muc: dm('btc') };
      for (let v = 1; v <= 15; v += 1) {
        const o = st.map.o[v]!;
        const s2 = { ...st, vong: v, ghe: [g, st.ghe[1]!] };
        const { chain } = dungChuoi(s2, g, o);
        const i = chain.findIndex((m) => m.kind === 'nong_voi');
        const phan = chain.filter((m) => m.kind !== 'lua' && m.kind !== 'kien_nhan' && m.kind !== 'nong_voi')
          .filter((m) => { const t = tangCuaMatXich(s2, m); return t.tang === 'ma' && t.ma === 'btc'; })
          .reduce((t, m) => t + m.delta_bp, 0);
        if (phan > 0 && Math.floor((phan * THAM_SO.NONG_VOI_CAT_BP) / 10000) > 0) {
          co += 1;
          const m = chain[i] as Extract<MatXich, { kind: 'nong_voi' }>;
          expect(m.ma).toBe('btc');
          expect(m.delta_bp).toBe(-Math.floor((phan * THAM_SO.NONG_VOI_CAT_BP) / 10000));
        } else {
          expect(i).toBe(-1);
        }
        const g3 = { ...g, giu_lien: { btc: 3 } };
        expect(dungChuoi({ ...s2, ghe: [g3, st.ghe[1]!] }, g3, o).chain.some((m) => m.kind === 'nong_voi')).toBe(false);
        const gT = { ...g, trait: [] as TraitId[] };
        expect(dungChuoi({ ...s2, ghe: [gT, st.ghe[1]!] }, gT, o).chain.some((m) => m.kind === 'nong_voi')).toBe(false);
      }
    }
    expect(co).toBeGreaterThan(20);
  });

  it('số vòng giữ liền: cuối vòng +1 cho mã còn vị thế, bán sạch thì đứt, mã mới bắt đầu từ 1', () => {
    const theo = () => ({ loai: 'theo' as const });
    const st = taoTran(21, [0, 1, 2, 3, 4].map(gheBot), luatCua(V55), 16);
    const truoc = { ...st, ghe: st.ghe.map((g, i) => (i === 0 ? { ...g, giu_lien: { btc: 3, vang: 2 }, vi_the: { btc: 6000 }, von: 4000, danh_muc: { ...g.danh_muc, tai_san: ['btc'] } } : g)) };
    const sau = giaiQuyetVong(truoc, theo).trangThai.ghe[0]!;
    expect(sau.giu_lien).toEqual({ btc: 4 });
    const v54 = giaiQuyetVong(taoTran(21, [0, 1, 2, 3, 4].map(gheBot), luatCua(V54), 16), theo).trangThai.ghe[0]!;
    expect(v54.giu_lien).toBeUndefined();
  });

  it('LỘ LỆNH: chen chúc của riêng ghế × `LO_LENH_CHEN_X_BP` (floor); không mang ⇒ như cũ', () => {
    let co = 0;
    for (let seed = 900; seed < 960; seed += 1) {
      const st = taoTran(seed, [gheBot(0), gheBot(1), gheBot(2)], luatCua(V55), 16);
      const g0: Ghe = { ...st.ghe[0]!, trait: ['lo_lenh'], vi_the: { btc: 5000 }, danh_muc: dm('btc') };
      const g1: Ghe = { ...st.ghe[1]!, vi_the: { btc: 5000 }, danh_muc: dm('btc') };
      const g2: Ghe = { ...st.ghe[2]!, vi_the: { btc: 5000 }, danh_muc: dm('btc') };
      for (let v = 1; v <= 15; v += 1) {
        const o = st.map.o[v]!;
        const s2 = { ...st, vong: v, ghe: [g0, g1, g2] };
        const lo = dungChuoi(s2, g0, o).chain.find((m) => m.kind === 'crowding');
        const g0t = { ...g0, trait: [] as TraitId[] };
        const thuong = dungChuoi({ ...s2, ghe: [g0t, g1, g2] }, g0t, o).chain.find((m) => m.kind === 'crowding');
        if (!lo || !thuong) continue;
        co += 1;
        expect(lo.delta_bp).toBe(-Math.floor((-thuong.delta_bp * THAM_SO.LO_LENH_CHEN_X_BP) / 10000));
      }
    }
    expect(co).toBeGreaterThan(0);
  });

  it('MÙ TIN: che NGẪU NHIÊN ≈ tỷ lệ cấu hình, chỉ lá TIN, chỉ từ vòng tật có hiệu lực, tất định; bot mang tật mất "báo trước" của lá bị che', () => {
    let tin = 0; let che = 0; let botChe = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const st = taoTran(seed, [gheBot(0), gheBot(1)], luatCua(V55), 16);
      const g: Ghe = { ...st.ghe[0]!, trait: ['mu_tin'], trait_tu_vong: { mu_tin: 5 } };
      for (let k = 0; k < st.map.o.length; k += 1) {
        const o = st.map.o[k]!;
        const c = tinBiChe(st, g, k);
        expect(c).toBe(tinBiChe(st, g, k));
        if (c) { expect(o.kind).toBe('su_kien'); expect(k).toBeGreaterThanOrEqual(5); }
        if (o.kind === 'su_kien' && k >= 5) { tin += 1; if (c) che += 1; }
        expect(tinBiChe(st, { ...g, trait: [] }, k)).toBe(false);
        expect(tinBiChe({ ...st, trait_bat: false }, g, k)).toBe(false);
      }
      // bối cảnh bot: vòng mà lá vừa lật bị che ⇒ `up.bao_truoc` null; ghế không tật ⇒ nguyên bối cảnh bàn
      for (let v = 6; v <= 15; v += 1) {
        const s2 = { ...st, vong: v };
        const bc = boiCanhLenhVong(s2);
        if (!bc?.up) continue;
        const g2 = { ...g, id: 'g0' };
        const bcG = boiCanhLenhGhe(s2, g2, bc)!;
        if (tinBiChe(s2, g2, vongDaLat(s2) - 1)) { botChe += 1; expect(bcG.up?.bao_truoc).toBeNull(); }
        const bcT = boiCanhLenhGhe(s2, { ...g2, trait: [] }, bc)!;
        expect(bcT.up).toEqual(bc.up);
      }
    }
    expect(Math.abs(che / tin - THAM_SO.MU_TIN_CHE_BP / 10000)).toBeLessThan(0.06);
    expect(botChe).toBeGreaterThan(0);
  });

  it('mốc: lá nhận ghi vòng hiệu lực = mốc + 1 (lớp che đọc); lá không nhận không ghi', () => {
    const moi = bayTrait(77, 'ban', 5, 0, []);
    const d = (id: TraitId) => TRAIT.find((t) => t.id === id)!;
    const tai = moi.find((id) => d(id).loai === 'tai' && moi.some((u) => d(u).loai === 'tat' && d(u).diem === d(id).diem))!;
    const tat = moi.find((u) => d(u).loai === 'tat' && d(u).diem === d(tai).diem)!;
    const r = apMocTrait(77, 5, { id: 'ban', trait: [], xu: 0 }, { lay: [tai, tat], cuon: 0 });
    expect(r.trait_tu_vong[tai]).toBe(6);
    expect(r.trait_tu_vong[tat]).toBe(6);
    const khong = apMocTrait(77, 5, { id: 'ban', trait: [], xu: 0 }, undefined);
    expect(Object.keys(khong.trait_tu_vong)).toEqual([]);
  });
});
