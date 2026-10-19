/**
 * ĐO BỐI CẢNH DÀI HẠN (D574) — số trình founder TRƯỚC khi bật mặc định (A8.2). Chỉ đọc server/ + config/, không sửa gì.
 *
 *   npx tsx scripts/do_boi_canh_dai_han.ts [số_trận=10000] [khoá=balance-v67-boicanh] [cỡ=14]
 *
 * Đo trên BẢN ĐỒ + GIÁ CÔNG KHAI của engine thật (`sinhMap` · `taoTran` · `loiSuatCongKhai`) — không dựng bản mô phỏng thứ hai (D61):
 *   ① phân bố bối cảnh · chuyển nợ · đổ đèo · kỳ họp theo pha nợ
 *   ② số lần ĐẢO CHIỀU KHÔNG NGÒI mỗi trận (D560: mùa giảm mở mà ô liền trước không có tin xấu thật / lá Phân phối)
 *   ③ lợi suất cả trận + ĐỘ SỤT LỚN NHẤT theo bối cảnh, từng mã ("dồn hết một mã" = giữ trọn một mã cả trận — mua & giữ)
 *   ④ độ khó đoán bối cảnh từ tin vĩ mô (Bayes trên đúng luật rút tin: 65 % đúng, mỗi dòng một lớp)
 * Gate G1–G4/G7 chạy riêng bằng `scripts/holdem_montecarlo.ts` (gate không mô phỏng màn).
 */
import { luatCua, TAI_SAN, LICH_CHINH_SACH, coManMinigame } from '../config/holdem.js';
import { BOI_CANH_DAI_HAN, type BoiCanhId } from '../config/boi_canh_dai_han.js';
import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap, taoTran, loiSuatCongKhai, type TrangThaiTran } from '../server/holdem/engine.js';
import { boiCanhDaiHan, idBoiCanh, tinViMoVong } from '../server/holdem/boi_canh_dai_han.js';
import { rngAt } from '../server/sandbox/rng.js';

const VT = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const N = Number(VT[0] ?? 10000);
const KHOA = VT[1] ?? 'balance-v67-boicanh';
const CO = Number(VT[2] ?? 14);
const luat = luatCua(KHOA);
const BC: readonly BoiCanhId[] = ['sieu_bo', 'sieu_gau', 'len_cang', 'bay_gia_tri'];
const TEN: Record<string, string> = { sieu_bo: 'Siêu Bò', sieu_gau: 'Siêu Gấu', len_cang: 'Lên+Căng', bay_gia_tri: 'Bẫy giá trị' };
const MA = TAI_SAN.map((t) => t.id);
const pct = (x: number): string => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1).replace('.', ',')} %`;
const tb = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const phanVi = (xs: readonly number[], p: number): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]!; };

/** Nhãn bối cảnh MỞ MÀN + có chuyển không (khoá theo kiểu trận người chơi sống qua). */
function kieuTran(bcMo: BoiCanhId, chuyen: boolean): string {
  return chuyen ? (bcMo === 'bay_gia_tri' ? 'bay→đổ đèo' : 'sieu_bo→Lên+Căng') : bcMo;
}

const oLich = LICH_CHINH_SACH.O_THEO_MAP[CO] ?? [];
const dem: Record<string, number> = {};
const kyHop: Record<string, Record<string, number>> = { noi: {}, cang: {}, chuyen: {} };
const daoKhongNgoi: Record<string, number[]> = {};
const loiSuat: Record<string, Record<string, number[]>> = {};
const sut: Record<string, Record<string, number[]>> = {};
const nemGau: Record<string, number[]> = {};
let tongKhongNgoiKhoaCu = 0;

const CHI_4 = process.argv.includes('--chi-4');
for (let s = 1; s <= (CHI_4 ? 0 : N); s++) {
  const seed = 0x5bc00000 + s;
  const bc0 = boiCanhDaiHan(seed, oLich);
  const st0: TrangThaiTran = taoTran(seed, [], luat, CO);
  const tt = st0.map.trang_thai ?? [];
  const bcMo = idBoiCanh(bc0.song, bc0.no);
  const k = kieuTran(bcMo, bc0.chuyen_no !== undefined);
  dem[k] = (dem[k] ?? 0) + 1;
  // ① kỳ họp theo pha nợ của ô (bối cảnh ở chính ô kỳ họp = trước chuyển)
  tt.forEach((t, i) => {
    if (!t.o_lich || !t.huong_cs_thuc) return;
    const nhom = bc0.chuyen_no === i + 1 ? 'chuyen' : t.boi_canh_dh === 'sieu_bo' || t.boi_canh_dh === 'bay_gia_tri' ? 'noi' : 'cang';
    kyHop[nhom]![t.huong_cs_thuc] = (kyHop[nhom]![t.huong_cs_thuc] ?? 0) + 1;
  });
  // ② đảo chiều không ngòi: ô pha GIẢM đầu một mùa giảm (mùa đổi sang giam) mà hai ô trước không có tin xấu thật và không có lá Phân phối.
  let dao = 0, viTriGau = -1;
  for (let i = 1; i < st0.map.o.length; i++) {
    if (tt[i]?.mua === 'giam' && tt[i - 1]?.mua !== 'giam') {
      if (viTriGau < 0) viTriGau = i;
      const truoc = [st0.map.o[i - 1], st0.map.o[i - 2]];
      const ngoi = truoc.some((x) => x && ((x.kind === 'su_kien' && !x.la_tin_gia) || (x.kind === 'giai_doan' && x.tinh_chat === 'phan_phoi')))
        || tt[i - 1]?.o_lich === true;
      if (!ngoi) dao += 1;
    }
  }
  (daoKhongNgoi[k] ??= []).push(dao);
  if (bc0.chuyen_no !== undefined) (nemGau[k] ??= []).push(viTriGau >= 0 && viTriGau >= bc0.chuyen_no ? viTriGau + 1 - bc0.chuyen_no : NaN);
  // ③ đường giá công khai (bảng lợi suất engine) từng mã, cả trận — "mua & giữ" một mã.
  const gia: Record<string, number[]> = Object.fromEntries(MA.map((m) => [m, [1]]));
  for (let v = 1; v < st0.map.o.length; v++) {
    const st = { ...st0, vong: v } as TrangThaiTran;
    const o = st.map.o[st.o_up === true ? v : v - 1];
    if (!o) break;
    const ls = loiSuatCongKhai(st, o);
    for (const m of MA) { const g = gia[m]!; g.push(Math.max(0.001, g[g.length - 1]! * (1 + (ls[m] ?? 0) / 10000))); }
  }
  for (const m of MA) {
    const g = gia[m]!;
    ((loiSuat[k] ??= {})[m] ??= []).push(g[g.length - 1]! - 1);
    let dinh = g[0]!, sutMax = 0;
    for (const x of g) { dinh = Math.max(dinh, x); sutMax = Math.max(sutMax, 1 - x / dinh); }
    ((sut[k] ??= {})[m] ??= []).push(sutMax);
  }
}

console.log(`ĐO BỐI CẢNH DÀI HẠN — khoá ${KHOA} · bàn ${CO} · ${N} trận · kỳ họp ô ${oLich.join(' · ')}`);
console.log('\n① Kiểu trận (bối cảnh mở màn · chuyển nợ):');
for (const [k, n] of Object.entries(dem).sort()) console.log(`  ${k.padEnd(18)} ${(100 * n / N).toFixed(1)} %`);
console.log('\n① Kỳ họp theo pha nợ (tăng · giữ · hạ):');
for (const [nhom, d] of Object.entries(kyHop)) {
  const t = (d.tang ?? 0) + (d.giu ?? 0) + (d.ha ?? 0);
  console.log(`  ${nhom.padEnd(7)} n=${t}  tăng ${(100 * (d.tang ?? 0) / t).toFixed(0)} % · giữ ${(100 * (d.giu ?? 0) / t).toFixed(0)} % · hạ ${(100 * (d.ha ?? 0) / t).toFixed(0)} %`);
}
console.log('\n② Đảo chiều không ngòi / trận (TB · tỉ lệ trận có ≥ 1):');
for (const [k, xs] of Object.entries(daoKhongNgoi).sort()) console.log(`  ${k.padEnd(18)} ${tb(xs).toFixed(3)} · ${(100 * xs.filter((x) => x > 0).length / xs.length).toFixed(1)} %`);
for (const [k, xs] of Object.entries(nemGau)) {
  const co = xs.filter((x) => !Number.isNaN(x));
  console.log(`  ${k}: gấu mở sau chuyển nợ ở ${(100 * co.length / xs.length).toFixed(0)} % trận, TB ${tb(co).toFixed(1)} ô sau kỳ họp`);
}
console.log('\n③ Mua & giữ MỘT mã cả trận — lợi suất TB [P10 · P90] · độ sụt lớn nhất TB:');
for (const k of Object.keys(loiSuat).sort()) {
  console.log(`  ${k}`);
  for (const m of MA) {
    const ls = loiSuat[k]![m]!, ss = sut[k]![m]!;
    console.log(`    ${m.padEnd(6)} ${pct(tb(ls)).padStart(9)}  [${pct(phanVi(ls, 0.1))} · ${pct(phanVi(ls, 0.9))}]  sụt ${pct(-tb(ss))} (P90 ${pct(-phanVi(ss, 0.9))})  thắng tiền mặt ${(100 * ls.filter((x) => x > 0).length / ls.length).toFixed(0)} %`);
  }
}

// ④ Bayes: chấm đoán bối cảnh từ tin vĩ mô (log-odds, tiên nghiệm đều) — đúng luật rút của `tinViMoVong` (cùng domain RNG), quét (tỷ lệ màn có tin ×
// độ đúng) để founder chọn; dòng khớp config dùng chính `tinViMoVong` (kiểm tái tạo khớp). Đáp án = bối cảnh CUỐI trận và bối cảnh MỞ MÀN.
const D = BOI_CANH_DAI_HAN.TIN_VI_MO;
function tinThu(seed: number, v: number, bc: BoiCanhId, tyLe: number, dung: number) {
  const r = rngAt(seed, 'holdem_bcdh_tin', v);
  if (!r.chanceBp(tyLe)) return null;
  const lop = r.chanceBp(D.LOP_SONG_BP) ? 'song' : 'no';
  const ok = r.chanceBp(dung);
  const that = lop === 'song' ? (bc === 'sieu_bo' || bc === 'len_cang' ? 'len' : 'bao_hoa') : (bc === 'sieu_bo' || bc === 'bay_gia_tri' ? 'noi' : 'cang');
  const nguoc: Record<string, string> = { len: 'bao_hoa', bao_hoa: 'len', noi: 'cang', cang: 'noi' };
  return { lop, noi: ok ? that : nguoc[that]! };
}
const MAN = (st: TrangThaiTran) => Array.from({ length: st.map.o.length }, (_, k) => k + 1).filter((v) => coManMinigame(v, st.map.o.length, st.nhip_xen_ke === true));
const N4 = Math.min(N, 10000);
const tranMau = Array.from({ length: N4 }, (_, s) => taoTran(0x7ac00000 + s, [], luat, CO));
console.log(`
④ Đoán bối cảnh từ tin vĩ mô (Bayes, ${N4} trận, ${MAN(tranMau[0]!).length} màn/trận) — đúng sóng · đúng nợ · đúng cả bối cảnh CUỐI trận · đúng bối cảnh MỞ MÀN (mò 25 %):`);
for (const tyLe of [3333, 5000, 10000]) for (const dung of [6500, 7500, 8500]) {
  let dS = 0, dN = 0, dCuoi = 0, dMo = 0, dong = 0, tran = 0;
  for (const st of tranMau) {
    const tt = st.map.trang_thai ?? [];
    if (!tt[0]?.boi_canh_dh) continue;
    tran += 1;
    let lS = 0, lN = 0;
    const w = Math.log(dung / (10000 - dung));
    for (const v of MAN(st)) {
      const bc = tt[st.o_up === true ? v : v - 1]?.boi_canh_dh;
      if (!bc) continue;
      const t = tinThu(st.seed, v, bc, tyLe, dung);
      if (tyLe === D.TY_LE_MAN_BP && dung === D.DUNG_BP) {
        const that = tinViMoVong(st.seed, v, bc);
        if ((that === null) !== (t === null) || (that && t && (that.lop !== t.lop || that.noi !== t.noi))) throw new Error('mô phỏng tin lệch tinViMoVong');
      }
      if (!t) continue;
      dong += 1;
      if (t.lop === 'song') lS += t.noi === 'len' ? w : -w; else lN += t.noi === 'noi' ? w : -w;
    }
    // Tiên nghiệm: sóng đều; nợ MỞ MÀN đều; nợ CUỐI trận = Nới × (1 − chuyển) (Bayes chấm đúng đáp án nó được hỏi).
    const pNoiCuoi = (BOI_CANH_DAI_HAN.NO_NOI_BP / 10000) * (1 - BOI_CANH_DAI_HAN.CHUYEN_NO_BP / 10000);
    const doanS = lS >= 0 ? 'len' : 'bao_hoa', doanN = lN + Math.log(pNoiCuoi / (1 - pNoiCuoi)) >= 0 ? 'noi' : 'cang', doanNMo = lN >= 0 ? 'noi' : 'cang';
    const cuoi = tt[tt.length - 1]!.boi_canh_dh!, mo = tt[0]!.boi_canh_dh!;
    const sOf = (b: string) => (b === 'sieu_bo' || b === 'len_cang' ? 'len' : 'bao_hoa'), nOf = (b: string) => (b === 'sieu_bo' || b === 'bay_gia_tri' ? 'noi' : 'cang');
    if (doanS === sOf(cuoi)) dS += 1;
    if (doanN === nOf(cuoi)) dN += 1;
    if (doanS === sOf(cuoi) && doanN === nOf(cuoi)) dCuoi += 1;
    if (doanS === sOf(mo) && doanNMo === nOf(mo)) dMo += 1;
  }
  const f = (x: number) => `${(100 * x / tran).toFixed(0)} %`;
  console.log(`  tin ${(tyLe / 100).toFixed(0).padStart(3)} % số màn · đúng ${dung / 100} %: ${(dong / tran).toFixed(1)} dòng/trận → sóng ${f(dS)} · nợ ${f(dN)} · cả bối cảnh cuối ${f(dCuoi)} · mở màn ${f(dMo)}${tyLe === D.TY_LE_MAN_BP && dung === D.DUNG_BP ? '   ← config' : ''}`);
}
void sinhMap; void tuyChonSinhMap;
