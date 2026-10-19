/**
 * D574 — BỐI CẢNH DÀI HẠN (khoá balance-v67-boicanh · SPEC `docs/spec/boi-canh-dai-han.md` §5).
 * Canh: tất định theo seed · phân bố bốn bối cảnh · pha nợ chuyển đúng một lần · kỳ họp nghiêng · đổ đèo · nghiêng giá theo bảng ·
 * tần suất + độ đúng của tin vĩ mô · tin vĩ mô vào dòng tin màn (MÙ TIN che như mọi tin) · khoá cũ không mang bối cảnh.
 * Khoá cũ byte-hệt thì golden `scripts/holdem_replay_golden.ts --kiem` canh (A11.3).
 */
import { describe, expect, it } from 'vitest';
import { LICH_CHINH_SACH, luatCua } from '../config/holdem.js';
import { BOI_CANH_DAI_HAN, SO_MAU_VI_MO, type BoiCanhId } from '../config/boi_canh_dai_han.js';
import { VI_MO_TIN } from '../config/minigame_tin.js';
import { boiCanhDaiHan, idBoiCanh, nghiengKyHop, tinViMoVong } from '../server/holdem/boi_canh_dai_han.js';
import { sinhMap } from '../server/holdem/map.js';
import { lechBoiCanh, loiSuatCongKhai, taoTran, tuyChonSinhMap, type TrangThaiTran } from '../server/holdem/engine.js';
import { boiCanhMan } from '../server/holdem/minigame/man.js';
import { lapTinMan, tinChoGhe, type TinMan } from '../server/holdem/minigame/tin.js';
import { chuTin } from '../web/src/lib/tin_man.js';

const V67 = luatCua('balance-v67-boicanh');
const V66 = luatCua('balance-v66-laiap');
const CO = 14;
const LICH = LICH_CHINH_SACH.O_THEO_MAP[CO]!;
const mapV67 = (seed: number) => sinhMap(seed, CO, tuyChonSinhMap(V67));
const SEEDS = Array.from({ length: 3000 }, (_, i) => 0x0bcd0000 + i);

describe('D574 — khoá v67 = v66 + đúng MỘT cờ mới', () => {
  it('khác v66 đúng cờ `boiCanhDaiHan`; v66 không mang cờ', () => {
    const a = V66 as unknown as Record<string, unknown>, b = V67 as unknown as Record<string, unknown>;
    const khac = Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);
    expect(khac).toEqual(['boiCanhDaiHan']);
    expect(V66.boiCanhDaiHan).toBeFalsy();
  });
});

describe('D574 — boiCanhDaiHan(seed): một nguồn, tất định', () => {
  it('cùng seed ⇒ cùng bối cảnh + cùng map (từng ô, từng trạng thái)', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      expect(boiCanhDaiHan(seed, LICH)).toEqual(boiCanhDaiHan(seed, LICH));
      expect(JSON.stringify(mapV67(seed))).toBe(JSON.stringify(mapV67(seed)));
    }
  });

  it('⭐ phân bố bốn bối cảnh mở màn ≈ 25 % mỗi ô (đề xuất SONG_LEN 50 % × NO_NOI 50 %) · chuyển nợ ≈ 50 % số trận Nới, chỉ ở kỳ họp', () => {
    const dem: Record<string, number> = {};
    let noi = 0, chuyen = 0;
    for (const seed of SEEDS) {
      const b = boiCanhDaiHan(seed, LICH);
      const id = idBoiCanh(b.song, b.no);
      dem[id] = (dem[id] ?? 0) + 1;
      if (b.no === 'noi') noi += 1;
      if (b.chuyen_no !== undefined) {
        chuyen += 1;
        expect(b.no).toBe('noi');
        expect(LICH).toContain(b.chuyen_no);
      }
    }
    for (const id of ['sieu_bo', 'sieu_gau', 'len_cang', 'bay_gia_tri']) expect(dem[id]! / SEEDS.length, id).toBeGreaterThan(0.22);
    for (const id of ['sieu_bo', 'sieu_gau', 'len_cang', 'bay_gia_tri']) expect(dem[id]! / SEEDS.length, id).toBeLessThan(0.28);
    const pChuyen = BOI_CANH_DAI_HAN.CHUYEN_NO_BP / 10000;
    expect(chuyen / noi).toBeGreaterThan(pChuyen - 0.04);
    expect(chuyen / noi).toBeLessThan(pChuyen + 0.04);
    // bàn không kỳ họp ⇒ không chuyển
    expect(SEEDS.every((s) => boiCanhDaiHan(s, []).chuyen_no === undefined)).toBe(true);
  });
});

describe('D574 — map: bối cảnh ghi từng ô, pha nợ chuyển ĐÚNG MỘT LẦN', () => {
  it('⭐ ô trước kỳ họp chuyển (kể cả ô kỳ họp) = bối cảnh mở màn; từ ô sau = (cùng sóng, Căng); kỳ họp chuyển TĂNG thật; không đổi lần hai', () => {
    let soChuyen = 0;
    for (const seed of SEEDS.slice(0, 1500)) {
      const b = boiCanhDaiHan(seed, LICH);
      const tt = mapV67(seed).trang_thai!;
      const mo = idBoiCanh(b.song, b.no);
      const ds = tt.map((t) => t.boi_canh_dh);
      expect(ds.every((x) => x !== undefined), `seed ${seed}`).toBe(true);
      const lanDoi = ds.filter((x, i) => i > 0 && x !== ds[i - 1]).length;
      if (b.chuyen_no === undefined) { expect(lanDoi).toBe(0); expect(ds[0]).toBe(mo); continue; }
      soChuyen += 1;
      const k = b.chuyen_no - 1;   // chỉ số ô kỳ họp
      expect(lanDoi).toBe(1);
      expect(ds.slice(0, k + 1).every((x) => x === mo)).toBe(true);
      expect(ds.slice(k + 1).every((x) => x === idBoiCanh(b.song, 'cang'))).toBe(true);
      expect(tt[k]!.o_lich).toBe(true);
      expect(tt[k]!.huong_cs_thuc).toBe('tang');
    }
    expect(soChuyen).toBeGreaterThan(0.6 * 1500 * 0.5 * (BOI_CANH_DAI_HAN.CHUYEN_NO_BP / 10000));
  });

  it('⭐ ĐỔ ĐÈO: Bẫy giá trị chuyển Căng ⇒ ô ngay sau kỳ họp mang `do_deo` · ô pha đầu tiên sau đó là SUY THOÁI gấu chu kỳ · từ đó Siêu Gấu', () => {
    let soDeo = 0;
    for (const seed of SEEDS) {
      const b = boiCanhDaiHan(seed, LICH);
      const m = mapV67(seed), tt = m.trang_thai!;
      const deo = tt.map((t, i) => (t.do_deo ? i : -1)).filter((i) => i >= 0);
      if (!(b.song === 'bao_hoa' && b.no === 'noi' && b.chuyen_no !== undefined)) { expect(deo, `seed ${seed}`).toEqual([]); continue; }
      soDeo += 1;
      expect(deo).toEqual([b.chuyen_no]);
      expect(tt[b.chuyen_no]!.boi_canh_dh).toBe('sieu_gau');
      // ô pha đầu tiên sau kỳ họp (bỏ qua ô tin) — trừ khi chế độ bong bóng / chuỗi ép cầm lái ô đó
      const j = m.o.findIndex((x, i) => i > b.chuyen_no! - 1 && x.kind === 'giai_doan');
      // gấu CHU KỲ; hoặc ĐỊNH GIÁ khi bong bóng đang phồng vỡ đúng lúc ấy (Bẫy giá trị rút bong bóng ×2) — cả hai là cú gãy đã tới.
      if (j >= 0) {
        expect(tt[j]!.mua, `seed ${seed} ô ${j}`).toBe('giam');
        expect(['gau_chu_ky', 'gau_dinh_gia']).toContain(tt[j]!.loai_mua);
      }
    }
    expect(soDeo).toBeGreaterThan(0.6 * SEEDS.length * 0.25 * (BOI_CANH_DAI_HAN.CHUYEN_NO_BP / 10000));
  });

  it('⭐ kỳ họp nghiêng theo pha nợ: Nới hạ nhiều hơn Căng · Căng tăng nhiều hơn Nới (không tính kỳ họp chuyển)', () => {
    const d = { noi: { tang: 0, ha: 0, n: 0 }, cang: { tang: 0, ha: 0, n: 0 } };
    for (const seed of SEEDS) {
      const b = boiCanhDaiHan(seed, LICH);
      mapV67(seed).trang_thai!.forEach((t, i) => {
        if (!t.o_lich || b.chuyen_no === i + 1) return;
        const no = t.boi_canh_dh === 'sieu_bo' || t.boi_canh_dh === 'bay_gia_tri' ? 'noi' : 'cang';
        d[no].n += 1;
        if (t.huong_cs_thuc === 'tang') d[no].tang += 1;
        if (t.huong_cs_thuc === 'ha') d[no].ha += 1;
      });
    }
    // Thước: (hạ − tăng) của Nới vượt của Căng — Căng có nhiều mùa giảm (Siêu Gấu) nên tỉ lệ hạ thô của nó vốn cao.
    const nghieng = (x: { tang: number; ha: number; n: number }) => (x.ha - x.tang) / x.n;
    expect(nghieng(d.noi) - nghieng(d.cang)).toBeGreaterThan(0.04);
  });

  it('nghiengKyHop: đúng luật (Nới giữ ⇒ hạ · tăng ⇒ giữ; Căng đối xứng; cùng chiều giữ nguyên) theo ngưỡng config', () => {
    const r = (x: number) => ({ below: () => x });
    const K = BOI_CANH_DAI_HAN.KY_HOP;
    expect(nghiengKyHop('giu', 'noi', r(K.GIU_THANH_HUONG_BP - 1))).toBe('ha');
    expect(nghiengKyHop('giu', 'noi', r(K.GIU_THANH_HUONG_BP))).toBe('giu');
    expect(nghiengKyHop('tang', 'noi', r(K.NGUOC_THANH_GIU_BP - 1))).toBe('giu');
    expect(nghiengKyHop('tang', 'noi', r(K.NGUOC_THANH_GIU_BP))).toBe('tang');
    expect(nghiengKyHop('ha', 'noi', r(0))).toBe('ha');
    expect(nghiengKyHop('giu', 'cang', r(0))).toBe('tang');
    expect(nghiengKyHop('ha', 'cang', r(0))).toBe('giu');
    expect(nghiengKyHop('tang', 'cang', r(0))).toBe('tang');
  });

  it('bánh xe theo bối cảnh: mùa TĂNG Siêu Bò dài hơn hẳn Siêu Gấu (bảng HAN của SPEC)', () => {
    const dai: Record<string, number[]> = { sieu_bo: [], sieu_gau: [] };
    for (const seed of SEEDS) {
      const tt = mapV67(seed).trang_thai!;
      let chay = 0;
      for (let i = 0; i < tt.length; i++) {
        const t = tt[i]!;
        if (t.mua === 'tang' && (t.boi_canh_dh === 'sieu_bo' || t.boi_canh_dh === 'sieu_gau')) chay += 1;
        else if (chay > 0) { dai[tt[i - 1]!.boi_canh_dh!]!.push(chay); chay = 0; }
      }
    }
    const tb = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(tb(dai.sieu_bo!)).toBeGreaterThan(tb(dai.sieu_gau!) + 1.5);
  });
});

describe('D574 — engine: nghiêng giá mỗi ô theo bảng (lechBoiCanh một cửa)', () => {
  it('⭐ lechBoiCanh = NGHIENG_BP của bối cảnh ô · ô đổ đèo ⇒ đầu cơ DO_DEO_BP · khoá v66 ⇒ 0', () => {
    let daGapDeo = false;
    for (const seed of SEEDS.slice(0, 600)) {
      const st = taoTran(seed, [], V67, CO);
      st.map.o.forEach((o, i) => {
        const t = st.map.trang_thai![i]!;
        for (const ma of ['btc', 'cp_cn', 'vn30', 'vang', 'usd', 'tpcp']) {
          const ky = t.do_deo && ma in BOI_CANH_DAI_HAN.DO_DEO_BP ? BOI_CANH_DAI_HAN.DO_DEO_BP[ma]
            : (BOI_CANH_DAI_HAN.NGHIENG_BP[t.boi_canh_dh!] as Record<string, number>)[ma];
          expect(lechBoiCanh(st, o, ma)).toBe(ky);
        }
        if (t.do_deo) { daGapDeo = true; expect(lechBoiCanh(st, o, 'btc')).toBe(-300); }
      });
      const s66 = taoTran(seed, [], V66, CO);
      expect(s66.map.trang_thai!.some((t) => t.boi_canh_dh !== undefined || t.do_deo)).toBe(false);
      expect(lechBoiCanh(s66, s66.map.o[3]!, 'btc')).toBe(0);
    }
    expect(daGapDeo).toBe(true);
  });

  it('⭐ bảng lợi suất công khai của engine dời đúng HƯỚNG nghiêng: tắt cờ trên CÙNG map ⇒ Crypto Siêu Bò thấp đi, Siêu Gấu cao lên', () => {
    let soSB = 0, soSG = 0;
    for (const seed of SEEDS.slice(0, 400)) {
      const st0 = taoTran(seed, [], V67, CO);
      for (let v = 1; v < st0.map.o.length; v++) {
        const st = { ...st0, vong: v } as TrangThaiTran;
        const o = st.map.o[st.o_up === true ? v : v - 1]!;
        const bc = st.map.trang_thai![st.o_up === true ? v : v - 1]!.boi_canh_dh as BoiCanhId;
        if (bc !== 'sieu_bo' && bc !== 'sieu_gau') continue;
        const co = loiSuatCongKhai(st, o).btc!, khong = loiSuatCongKhai({ ...st, boi_canh_dai_han: false }, o).btc!;
        if (bc === 'sieu_bo') { soSB += 1; expect(co).toBeGreaterThan(khong); } else { soSG += 1; expect(co).toBeLessThan(khong); }
      }
    }
    expect(soSB).toBeGreaterThan(100);
    expect(soSG).toBeGreaterThan(100);
  });
});

describe('D574 — tin vĩ mô trong màn', () => {
  it('⭐ tỉ lệ vòng có tin = TY_LE_MAN_BP (founder: 1/2), mỗi dòng MỘT lớp (đều hai lớp), đúng DUNG_BP (founder: 85 %) — so với bối cảnh của ô', () => {
    let co = 0, dung = 0, n = 0, song = 0;
    const BC: BoiCanhId[] = ['sieu_bo', 'sieu_gau', 'len_cang', 'bay_gia_tri'];
    for (let seed = 1; seed <= 4000; seed++) {
      for (let v = 2; v <= 13; v++) {
        const bc = BC[(seed + v) % 4]!;
        const t = tinViMoVong(seed, v, bc);
        n += 1;
        if (!t) continue;
        co += 1;
        if (t.lop === 'song') song += 1;
        const that = t.lop === 'song' ? (bc === 'sieu_bo' || bc === 'len_cang' ? 'len' : 'bao_hoa') : (bc === 'sieu_bo' || bc === 'bay_gia_tri' ? 'noi' : 'cang');
        expect(t.dung).toBe(t.noi === that);
        if (t.dung) dung += 1;
        expect(t.mau).toBeGreaterThanOrEqual(0);
        expect(t.mau).toBeLessThan(SO_MAU_VI_MO);
      }
    }
    const T = BOI_CANH_DAI_HAN.TIN_VI_MO;
    expect(Math.abs(co / n - T.TY_LE_MAN_BP / 10000)).toBeLessThan(0.025);
    expect(Math.abs(dung / co - T.DUNG_BP / 10000)).toBeLessThan(0.025);
    expect(song / co).toBeGreaterThan(0.46); expect(song / co).toBeLessThan(0.54);
  });

  it('cùng (seed, vòng) ⇒ cùng một dòng cho mọi ghế (không phụ thuộc mã) · mọi ID có chữ ở client, đủ SO_MAU_VI_MO mẫu mỗi trạng thái', () => {
    expect(tinViMoVong(77, 5, 'bay_gia_tri')).toEqual(tinViMoVong(77, 5, 'bay_gia_tri'));
    for (const [k, ds] of Object.entries(VI_MO_TIN)) {
      expect(ds, k).toHaveLength(SO_MAU_VI_MO);
      for (let j = 0; j < SO_MAU_VI_MO; j++) expect(chuTin(`vm.${k}.${j}`)).toBe(ds[j]);
    }
  });

  it('⭐ dòng tin màn: khoá v67 ⇒ vòng có tin vĩ mô thì dòng tin màn mang ĐÚNG một dòng `vi_mo` (không đẩy giá) · vòng không có ⇒ không · khoá v66 ⇒ không bao giờ', () => {
    let soCo = 0;
    for (const seed of SEEDS.slice(0, 300)) {
      for (const [luat, laV67] of [[V67, true], [V66, false]] as const) {
        const st = taoTran(seed, [], luat, CO);
        for (const vong of [2, 3, 6, 8]) {
          const i = st.o_up === true ? vong : vong - 1;
          const bc = boiCanhMan({ seedTran: seed, vong, map: st.map, oUp: st.o_up === true, viThe: { btc: 1000 }, tinMan: true });
          if ('loi' in bc) continue;
          const vm = (bc.tin ?? []).filter((t) => t.viMo);
          const ky = laV67 ? tinViMoVong(seed, vong, st.map.trang_thai![i]!.boi_canh_dh!) : null;
          expect(vm.length, `seed ${seed} vòng ${vong} ${laV67 ? 'v67' : 'v66'}`).toBe(ky ? 1 : 0);
          if (ky) {
            soCo += 1;
            expect(vm[0]).toMatchObject({ ng: 'vi_mo', chu: `vm.${ky.noi}.${ky.mau}`, huong: 0, that: false });
            expect(bc.troi, 'tin vĩ mô không đẩy giá').toEqual(lapTinMan({ seed: bc.seed, nguon: bc.nguon, diem: bc.diem }).troi);
          }
        }
      }
    }
    expect(soCo).toBeGreaterThan(250);
  });

  it('⭐ gửi cho ghế: MÙ TIN ⇒ dòng vĩ mô chỉ còn vị trí (không chữ / nguồn / hướng) · đã mua tin sớm ⇒ tin thường kèm THẬT/NHIỄU, dòng vĩ mô KHÔNG', () => {
    const vm: TinMan = { id: 3, ci: 10, tang: 0, ng: 'vi_mo', chu: 'vm.cang.1', noi: -1, huong: 0, that: false, viMo: true };
    const thuong: TinMan = { id: 4, ci: 12, tang: 0, ng: 'bao', chu: 'nh.0', noi: 1, huong: 0, that: false };
    expect(tinChoGhe(vm, { muTin: true, daMua: false })).toEqual({ id: 3, ci: 10, tang: 0 });
    expect(tinChoGhe(vm, { muTin: false, daMua: true })).toEqual({ id: 3, ci: 10, tang: 0, ng: 'vi_mo', chu: 'vm.cang.1', noi: -1 });
    expect(tinChoGhe(thuong, { muTin: false, daMua: true }).that).toBe(false);
    expect(tinChoGhe(vm, { muTin: false, daMua: false })).not.toHaveProperty('that');
  });

  it('Bẫy giá trị ⇒ đám đông nền trong màn ×2 (`dam_dong.x2`); bối cảnh khác ⇒ không', () => {
    let bay = 0, khac = 0;
    for (const seed of SEEDS.slice(0, 300)) {
      const st = taoTran(seed, [], V67, CO);
      const vong = 3, i = st.o_up === true ? vong : vong - 1;
      const bc = boiCanhMan({ seedTran: seed, vong, map: st.map, oUp: st.o_up === true, viThe: { btc: 1000 } });
      if ('loi' in bc) continue;
      if (st.map.trang_thai![i]!.boi_canh_dh === 'bay_gia_tri') { bay += 1; expect(bc.dam_dong?.x2).toBe(true); } else { khac += 1; expect(bc.dam_dong?.x2).toBeUndefined(); }
    }
    expect(bay).toBeGreaterThan(20);
    expect(khac).toBeGreaterThan(20);
  });
});
