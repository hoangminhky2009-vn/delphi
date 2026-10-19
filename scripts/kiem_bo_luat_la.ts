/**
 * KIỂM BỘ LUẬT TỪNG LÁ (D399) — thước founder duyệt 24/09. CHỈ ĐỌC engine.
 *
 *   1. VÔ LÝ — 12 luật thường thức, đã sửa theo lịch sử khi trình: bỏ R10 (hai cú sốc ngoại sinh gần nhau là
 *      chuyện thường — 2011, 2020, 2022), R11 chỉ còn khủng hoảng TÀI CHÍNH, R5 · R9 · R12 nới lý do hợp lệ. Luật
 *      CỨNG phải ra 0. Phần ĐƯỢC PHÉP (kỳ họp sai ngược chiều có hệ quả, NHTW đọc mùa ẩn, sốc ngoại sinh rồi hồi)
 *      in riêng — để thấy nó còn sống mà hiếm.
 *   2. BẮT BÀI — "người thuộc lòng luật" = bảng tần suất có điều kiện học trên nửa số bàn, đoán lá pha kế trên
 *      nửa kia, chỉ bằng thứ người chơi thấy (mặt lá · ô tin theo mặt chữ, kể cả tin giả chưa lộ · lịch kỳ họp).
 *      Trần ở `LUAT_LA.TRAN_BAT_BAI` (founder chốt A: mặt ≤ 60%, vòng chắc ≥ 80% ≤ 10%).
 *
 * Luật được viết LẠI bằng vòng lặp riêng (không gọi máy `server/holdem/luat_la.ts`) — thước không đo chính nó;
 * chỉ SỐ (cửa sổ, danh sách lá) đọc từ `config/luat_la.ts` để đổi số không phải sửa hai nơi.
 *
 * Chạy:  npx tsx scripts/kiem_bo_luat_la.ts [số_bàn=6000] [cỡ=16] [--phien-ban=balance-v54-ngare] [--co=luatLa:0]
 * Thoát mã 1 khi khoá đang đo BẬT `luatLa` mà luật cứng có vi phạm hoặc vượt trần bắt bài.
 */
import { LUAT_LA, type BangChung } from '../config/luat_la.js';
import { TINH_CHAT_NEN, type GiaiDoanId } from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { sinhMap, type OThiTruong, type TrangThaiO } from '../server/holdem/map.js';

const VT = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const N = Math.max(100, Number(VT[0] ?? 6000) | 0);
const SIZE = Math.max(8, Number(VT[1] ?? 16) | 0);
const PB = (process.argv.find((x) => x.startsWith('--phien-ban=')) ?? '').slice(12) || 'balance-v54-ngare';
const CO = (process.argv.find((x) => x.startsWith('--co=')) ?? '').slice(5);
const LUAT = {
  ...luatCua(PB),
  ...Object.fromEntries(CO.split(',').filter(Boolean).map((c) => {
    const [k, v] = c.split(':');
    if (!k || !(k in luatCua(PB)) || (v !== '0' && v !== '1')) throw new Error(`--co=${c}: cờ lạ hoặc không phải 0/1`);
    return [k, v === '1'];
  })),
};
if (!LUAT.banhXe) throw new Error(`${PB} không bật bánh xe — bộ luật lá không có mùa để đọc.`);
const TC = tuyChonSinhMap(LUAT);
const HAT = (s: number): number => s * 7919 + 13;

type Ban = { o: readonly OThiTruong[]; tt: readonly TrangThaiO[] };
const BAN: Ban[] = Array.from({ length: N }, (_, s) => {
  const m = sinhMap(HAT(s), SIZE, TC);
  return { o: m.o, tt: m.trang_thai! };
});

// ─── đọc chuỗi (viết lại, không mượn máy) ────────────────────────────────────────────────────
const that = (t: OThiTruong | undefined, ds: readonly BangChung[]): boolean =>
  t !== undefined && t.kind === 'su_kien' && !t.la_tin_gia
  && (ds.includes(t.su_kien) || (ds.includes('hoang_loan') && TINH_CHAT_NEN[t.su_kien] === 'hoang_loan'));
const pha = (t: OThiTruong | undefined, ds: readonly GiaiDoanId[]): boolean =>
  t !== undefined && t.kind === 'giai_doan' && ds.includes(t.giai_doan);
const trongO = (o: readonly OThiTruong[], i: number, n: number, ds: readonly BangChung[]): boolean =>
  o.slice(Math.max(0, i - n), i).some((t) => that(t, ds));
const muaCua = (b: Ban, i: number): GiaiDoanId => b.tt[i]!.mua!;
const laKyHop = (b: Ban, i: number): boolean => b.tt[i]!.o_lich === true;

/** Từ lá pha gần nhất thuộc `moc` (trước ô i): có phần tử thoả `f`? `null` = chưa có mốc (bàn mở giữa chừng). */
function tuMoc(o: readonly OThiTruong[], i: number, moc: readonly GiaiDoanId[]): readonly OThiTruong[] | null {
  for (let k = i - 1; k >= 0; k -= 1) if (pha(o[k], moc)) return o.slice(k + 1, i);
  return null;
}

const dem = new Map<string, number>();
const vd = new Map<string, string>();
const TEN: Record<string, string> = { tang: 'TĂNG', giam: 'GIẢM', di_ngang: 'NGANG', bien_dong: 'NÓNG', phuc_hoi: 'PHỤC' };
const nhan = (t: OThiTruong): string => (t.kind === 'giai_doan' ? TEN[t.giai_doan]! : `·${t.su_kien}${t.la_tin_gia ? '(giả)' : ''}`);
const ghi = (k: string, b: Ban, i: number): void => {
  dem.set(k, (dem.get(k) ?? 0) + 1);
  if (!vd.has(k)) vd.set(k, b.o.slice(Math.max(0, i - 4), i + 1).map(nhan).join(' → '));
};

const T = LUAT_LA.TIN;
let kyHopDoi = 0; let kyHopNguoc = 0; let nguocCoSuaSai = 0; let nguocCoKyHopSau = 0;
for (const b of BAN) {
  const { o } = b;
  let kyHopTruoc: TrangThaiO | null = null;
  for (let i = 0; i < o.length; i += 1) {
    const x = o[i]!;
    const mua = muaCua(b, i);
    if (x.kind === 'giai_doan') {
      const g = x.giai_doan;
      if (g === 'phuc_hoi') {
        const sau = tuMoc(o, i, ['tang', 'bien_dong']);
        if (sau !== null && !sau.some((t) => pha(t, ['giam']) || that(t, LUAT_LA.DAY.TIN))) ghi('R1 PHỤC HỒI không đáy', b, i);
      }
      if (g === 'bien_dong') {
        const sau = tuMoc(o, i, ['giam', 'phuc_hoi']);
        const so = sau === null ? Infinity : sau.filter((t) => pha(t, ['tang', 'bien_dong'])).length;
        const can = trongO(o, i, LUAT_LA.NHIET.TRONG_O, LUAT_LA.NHIET.TIN) ? LUAT_LA.NHIET.SO_LA_KHI_CO_TIN : LUAT_LA.NHIET.SO_LA;
        if (so < can) ghi('R2 QUÁ NÓNG không nhiệt', b, i);
        if (mua === 'giam' || mua === 'di_ngang') ghi('R3 QUÁ NÓNG giữa suy thoái/đình trệ', b, i);
      }
      if ((g === 'tang' || g === 'bien_dong') && i > 0) {
        if (that(o[i - 1], LUAT_LA.KHUNG_HOANG_TAI_CHINH)) ghi('R11 TĂNG/NÓNG ngay sau khủng hoảng tài chính', b, i);
        else if (that(o[i - 1], ['hoang_loan'])) ghi('~ sốc ngoại sinh rồi TĂNG lại (được phép — 9/11, Brexit)', b, i);
      }
      continue;
    }
    const id = x.su_kien;
    const kh = laKyHop(b, i);
    const luat = (T as Record<string, { mua: readonly GiaiDoanId[]; can: readonly BangChung[]; trong_o: number }>)[id];
    if (luat && luat.mua.includes(mua) && !trongO(o, i, luat.trong_o, luat.can)) {
      const ten: Record<string, string> = {
        bong_bong: 'R4 BONG BÓNG giữa suy thoái không tiền rẻ',
        tang_lai_suat: 'R5 TĂNG LÃI giữa suy thoái/đình trệ không lý do',
        ha_lai_suat: 'R6 HẠ LÃI giữa quá nóng không khủng hoảng',
        hack_san: 'R7 SÀN KHOÁ RÚT TIỀN giữa mùa lành không cú sốc thật',
        pha_san: 'R8 PHÁ SẢN DÂY CHUYỀN giữa mùa lành không ngòi',
        lam_phat: 'R9 LẠM PHÁT giữa suy thoái không nguyên nhân',
      };
      // Lá lãi suất ở KỲ HỌP đi đường sai lầm chính sách — được phép, có hệ quả; in riêng.
      if (kh) ghi(`~ kỳ họp ${id === 'tang_lai_suat' ? 'TĂNG giữa suy thoái' : 'HẠ giữa quá nóng'} (sai lầm có hệ quả)`, b, i);
      else ghi(ten[id]!, b, i);
    }
    if (id === 'tang_lai_suat' || id === 'ha_lai_suat') {
      let k = i - 1;
      while (k >= 0 && !that(o[k], ['tang_lai_suat', 'ha_lai_suat'])) k -= 1;
      const truoc = k >= 0 ? o[k]! : null;
      if (truoc !== null && truoc.kind === 'su_kien' && truoc.su_kien !== id) {
        const r = LUAT_LA.DAO_CHIEU[id];
        const giua = o.slice(k + 1, i);
        const coLyDo = giua.some((t) => that(t, r.tin) || pha(t, r.mat))
          || (r.so_la_tang > 0 && giua.filter((t) => pha(t, ['tang'])).length >= r.so_la_tang);
        if (!coLyDo) {
          if (!kh) ghi('R12 LÃI SUẤT (ngoài kỳ họp) đảo chiều vô cớ', b, i);
          else if (b.tt[k]!.o_lich && b.tt[k]!.huong_cs_thuc !== b.tt[k]!.huong_cs_ky_vong) ghi('~ kỳ họp đảo chiều = sửa sai lần trước', b, i);
          else if (b.tt[i]!.huong_cs_thuc !== b.tt[i]!.huong_cs_ky_vong) ghi('~ kỳ họp đảo chiều do chính nó sai', b, i);
          else ghi('~ kỳ họp đảo chiều theo mùa ẩn (NHTW thấy trước chợ)', b, i);
        }
      }
    }
  }
  // Kỳ họp: tỷ lệ đi NGƯỢC hàm phản ứng, và kỳ họp kế sau lần ngược có sửa sai không.
  for (let i = 0; i < o.length; i += 1) {
    const t = b.tt[i]!;
    if (!t.o_lich) continue;
    if (kyHopTruoc && ((kyHopTruoc.huong_cs_ky_vong === 'ha' && kyHopTruoc.huong_cs_thuc === 'tang')
      || (kyHopTruoc.huong_cs_ky_vong === 'tang' && kyHopTruoc.huong_cs_thuc === 'ha'))) {
      nguocCoKyHopSau += 1;
      if (t.huong_cs_thuc === t.huong_cs_ky_vong) nguocCoSuaSai += 1;
    }
    if (t.huong_cs_ky_vong !== 'giu') {
      kyHopDoi += 1;
      if (t.huong_cs_thuc !== 'giu' && t.huong_cs_thuc !== t.huong_cs_ky_vong) kyHopNguoc += 1;
    }
    kyHopTruoc = t;
  }
}

const bat = LUAT.luatLa === true;
console.log(`══ KIỂM BỘ LUẬT TỪNG LÁ · ${PB}${CO ? ` --co=${CO}` : ''} · ${N} bàn ${SIZE} · luatLa ${bat ? 'BẬT' : 'TẮT'} ══`);
console.log('\n1. VÔ LÝ — luật CỨNG (phải 0 khi bật):');
let cung = 0;
for (const k of [...dem.keys()].filter((x) => x.startsWith('R')).sort((a, b) => Number(a.slice(1, 3)) - Number(b.slice(1, 3)))) {
  cung += dem.get(k)!;
  console.log(`   ✖ ${k.padEnd(52)} ${String(dem.get(k)).padStart(5)}   vd: ${vd.get(k)}`);
}
if (cung === 0) console.log('   ✓ không vi phạm nào');
console.log('   ĐƯỢC PHÉP (còn sống mà hiếm):');
for (const k of [...dem.keys()].filter((x) => x.startsWith('~')).sort()) {
  console.log(`   · ${k.slice(2).padEnd(52)} ${String(dem.get(k)).padStart(5)} (${((dem.get(k)! * 100) / N).toFixed(1)}% bàn-lần)`);
}
const pct = (a: number, b: number): string => (b ? `${((a * 100) / b).toFixed(1)}%` : '—');
console.log(`   kỳ họp NGƯỢC hàm phản ứng: ${pct(kyHopNguoc, kyHopDoi)} số kỳ họp đòi đổi · kỳ họp kế sau lần ngược đi đúng hàm phản ứng: ${pct(nguocCoSuaSai, nguocCoKyHopSau)}`);

// ─── 2. BẮT BÀI ─────────────────────────────────────────────────────────────────────────────
function khoa(o: readonly OThiTruong[], tt: readonly TrangThaiO[], i: number, muc: number): string {
  const mat: string[] = [];
  for (let k = i - 1; k >= 0; k -= 1) { const t = o[k]!; if (t.kind === 'giai_doan') mat.push(t.giai_doan); }
  const cuoi = mat[0] ?? '-';
  let chay = 0; for (const m of mat) { if (m === cuoi) chay += 1; else break; }
  const khac = mat.find((m) => m !== cuoi) ?? '-';
  const tin = (k: number): string => { const t = o[k]; return t?.kind === 'su_kien' ? t.su_kien : '-'; };
  if (muc === 0) return `${cuoi}|${Math.min(chay, 4)}|${khac}|${tin(i - 1)}|${tin(i - 2)}|${tt[i]?.o_lich ? 'L' : ''}`;
  if (muc === 1) return `${cuoi}|${Math.min(chay, 4)}|${khac}|${tin(i - 1)}`;
  return cuoi;
}
const hoc = BAN.slice(0, N / 2); const cham = BAN.slice(N / 2);
const bang = [new Map<string, Map<string, number>>(), new Map<string, Map<string, number>>(), new Map<string, Map<string, number>>()];
const demMat = new Map<string, number>();
for (const b of hoc) {
  for (let i = 1; i < b.o.length; i += 1) {
    const t = b.o[i]!; if (t.kind !== 'giai_doan') continue;
    demMat.set(t.giai_doan, (demMat.get(t.giai_doan) ?? 0) + 1);
    for (let m = 0; m < 3; m += 1) {
      const k = khoa(b.o, b.tt, i, m);
      if (!bang[m]!.has(k)) bang[m]!.set(k, new Map());
      const mp = bang[m]!.get(k)!; mp.set(t.giai_doan, (mp.get(t.giai_doan) ?? 0) + 1);
    }
  }
}
const mode = [...demMat].sort((a, b) => b[1] - a[1])[0]![0];
let tong = 0; let dMu = 0; let dLuat = 0; let chac = 0; let chacDung = 0;
for (const b of cham) {
  for (let i = 1; i < b.o.length; i += 1) {
    const t = b.o[i]!; if (t.kind !== 'giai_doan') continue;
    tong += 1;
    let mp: Map<string, number> | undefined;
    for (let m = 0; m < 3 && !mp; m += 1) {
      const c = bang[m]!.get(khoa(b.o, b.tt, i, m));
      if (c && [...c.values()].reduce((a, v) => a + v, 0) >= 30) mp = c;
    }
    let du = mode; let p = 0;
    if (mp) {
      const s = [...mp.values()].reduce((a, v) => a + v, 0);
      const [k, v] = [...mp].sort((a, c) => c[1] - a[1])[0]!;
      du = k; p = (v * 10000) / s;
    }
    if (t.giai_doan === mode) dMu += 1;
    if (t.giai_doan === du) dLuat += 1;
    if (p >= LUAT_LA.TRAN_BAT_BAI.NGUONG_CHAC_BP) { chac += 1; if (t.giai_doan === du) chacDung += 1; }
  }
}
const TB = LUAT_LA.TRAN_BAT_BAI;
const doanBp = Math.round((dLuat * 10000) / tong);
const chacBp = Math.round((chac * 10000) / tong);
const quaMat = doanBp > TB.DOAN_MAT_BP; const quaChac = chacBp > TB.VONG_CHAC_BP;
console.log(`\n2. BẮT BÀI (${tong} lượt đoán lá pha kế):`);
console.log(`   đoán mù "${TEN[mode]}" ${pct(dMu, tong)} · THUỘC LÒNG LUẬT ${pct(dLuat, tong)} (trần ${TB.DOAN_MAT_BP / 100}%) ${quaMat ? '✖' : '✓'}`);
console.log(`   vòng chắc ≥ ${TB.NGUONG_CHAC_BP / 100}%: ${pct(chac, tong)} số lượt (trần ${TB.VONG_CHAC_BP / 100}%) ${quaChac ? '✖' : '✓'} · trúng ${pct(chacDung, chac)}`);

if (bat && (cung > 0 || quaMat || quaChac)) {
  console.error(`\n✖ KHÔNG QUA: ${cung} vi phạm luật cứng${quaMat || quaChac ? ' · vượt trần bắt bài' : ''}`);
  process.exit(1);
}
