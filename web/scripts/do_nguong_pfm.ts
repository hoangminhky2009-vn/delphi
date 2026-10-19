// ĐO NGƯỠNG PFM TRÊN SỔ GIẢ — GĐ E (ngưỡng đang chạy) + GĐ B (hai ngưỡng chưa có). Hạt giống cố định, chạy lại ra đúng số.
// Gọi ĐÚNG hàm thật của repo (ngayChiLon · tienVeTieu · chiTheoNgay · trungVi) — không dựng bản sao công thức.
// ⚠ Sổ giả là GIẢ ĐỊNH của người đo: số ở đây để SO các phương án với nhau, không để đoán người thật.
import { ngayChiLon, tienVeTieu, ngayKeTiep, chiTheoNgay, trungVi } from '../src/pfm/guong';
import { PFM } from '@config/pfm';

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
type R = () => number;
const chuan = (r: R) => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
function poisson(r: R, lam: number) { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; }
const NGAY: string[] = []; { let n = '2026-08-03'; for (let i = 0; i < 62; i++) { NGAY.push(n); n = ngayKeTiep(n); } } // 03/08/2026 = thứ Hai
const thu = (ngay: string) => new Date(ngay + 'T00:00:00Z').getUTCDay(); // 0 = CN
let dem = 0;
const khoan = (ngay: string, soTien: number, chieu: 'chi' | 'thu' = 'chi', ghiChu?: string): any =>
  ({ id: 'k' + (dem++), ngay, soTien, chieu, nhan: null, huId: null, cachGhi: 'tay', viSale: null, ghiChu, taoLuc: '', suaLuc: '' });
const pc = (x: number, d = 1) => (100 * x).toFixed(d) + '%';
const tb = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const phanVi = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]!; };

/* ═══ E1 — "NGÀY CHI LỚN" (hệ số 2 × trung vị, sàn 6 ngày có chi) trên sổ KHÔNG có ngày tệ nào ═══════════════ */
console.log(`\n══ E1 · "ngày chi lớn" = tổng chi ngày ≥ ${PFM.GUONG_HE_SO_NGAY_LON} × trung vị (sàn ${PFM.GUONG_SAN_NGAY_CHI} ngày có chi) — sổ KHÔNG có ngày đặc biệt nào`);
console.log('   (mức chi mỗi ngày độc lập, log-chuẩn; σ = độ dao động giữa các ngày. Luật `ngay_chi_lon` bắn đúng những ngày này.)');
for (const sig of [0.5, 0.8, 1.1]) for (const pGhi of [1, 0.6]) {
  const r = rng(20260921); const N = 3000; let xet = 0, lon = 0, xetDau = 0, lonDau = 0; const moiThang: number[] = [];
  for (let u = 0; u < N; u++) {
    const so: any[] = []; let lonThang = 0, daXet = 0;
    for (let d = 0; d < 30; d++) {
      if (r() > pGhi) continue;
      so.push(khoan(NGAY[d]!, Math.round(50_000 * Math.exp(sig * chuan(r)))));
      const kq = ngayChiLon(so, NGAY[d]!).laNgayLon; if (kq === null) continue;
      xet++; daXet++; if (kq) { lon++; lonThang++; }
      if (daXet <= 5) { xetDau++; if (kq) lonDau++; }
    }
    moiThang.push(lonThang);
  }
  console.log(`   σ ${sig} · ghi ${pc(pGhi, 0).padStart(4)} ngày → ${pc(lon / xet).padStart(6)} số ngày bị gọi "lớn" (5 ngày đầu sau sàn: ${pc(lonDau / xetDau)}) · luật bắn TB ${tb(moiThang).toFixed(1)} ngày/tháng · ${pc(moiThang.filter((x) => x >= 4).length / N, 0)} số tháng bắn ≥ 4 lần`);
}
console.log('   thử hệ số khác trên cùng sổ (σ 0.8, ghi đủ) — tính tay từ trung vị, KHÔNG đổi config:');
for (const he of [2, 2.5, 3, 4]) {
  const r = rng(20260921); let xet = 0, lon = 0;
  for (let u = 0; u < 3000; u++) { const xs: number[] = [];
    for (let d = 0; d < 30; d++) { const x = Math.round(50_000 * Math.exp(0.8 * chuan(r))); xs.push(x); if (xs.length < PFM.GUONG_SAN_NGAY_CHI) continue; xet++; if (x >= he * trungVi(xs)!) lon++; } }
  console.log(`     hệ số ${he} → ${pc(lon / xet)} số ngày ≈ ${(30 * lon / xet).toFixed(1)} ngày/tháng`);
}

/* ═══ E2 — "TIỀN VỪA VỀ LÀ TIÊU": con số gương khi KHÔNG có mẫu hình, theo nhịp tiền vào ═══════════════════════ */
console.log(`\n══ E2 · gương "tiền vừa về là tiêu" (cửa sổ ${PFM.GUONG_CUA_SO_TIEN_VE} ngày) — mức chi KHÔNG phụ thuộc ngày tiền về (he = 1) và CÓ (he = 2: tiêu gấp đôi trong cửa sổ)`);
const NHIP: Record<string, (r: R) => number[]> = {
  'lương 1 lần/tháng   ': () => [4],
  'hai lần/tháng       ': () => [0, 14],
  'chu cấp hằng tuần   ': () => [0, 7, 14, 21, 28],
  'thất thường ~8 lần  ': (r) => { const s = new Set<number>(); while (s.size < 8) s.add(Math.floor(r() * 30)); return [...s]; },
};
for (const [ten, sinh] of Object.entries(NHIP)) {
  const dong: string[] = [];
  for (const he of [1, 2]) {
    const r = rng(20260921); const gts: number[] = []; const nens: number[] = []; let luatBan = 0; const N = 3000;
    for (let u = 0; u < N; u++) {
      const ngayThu = sinh(r); const cuaSo = new Set<number>(); for (const t of ngayThu) for (let i = 0; i < PFM.GUONG_CUA_SO_TIEN_VE; i++) if (t + i < 30) cuaSo.add(t + i);
      const so: any[] = ngayThu.map((t) => khoan(NGAY[t]!, 3_000_000, 'thu'));
      for (let d = 0; d < 30; d++) so.push(khoan(NGAY[d]!, Math.round(50_000 * Math.exp(0.8 * chuan(r)) * (cuaSo.has(d) ? he : 1))));
      const g = tienVeTieu(so); if (g.gt === null) continue; gts.push(g.gt); nens.push(cuaSo.size / 30); luatBan += cuaSo.size;
    }
    dong.push(`he ${he}: gương ${pc(tb(gts), 0)} (5–95%: ${pc(phanVi(gts, 0.05), 0)}–${pc(phanVi(gts, 0.95), 0)})` + (he === 1 ? ` · mốc nền lịch ${pc(tb(nens), 0)} · luật \`tien_vua_ve\` bắn ${(luatBan / N).toFixed(1)} ngày/tháng` : ''));
  }
  console.log(`   ${ten}| ${dong.join('  ‖  ')}`);
}

/* ═══ E3 — SÀN 3 QUAN SÁT: con số gương hiện ra khi tỷ lệ THẬT thấp (nhị thức, tính đúng — không mô phỏng) ═══ */
console.log(`\n══ E3 · sàn ${PFM.GUONG_SAN_QUAN_SAT} quan sát của gương (chi bù · vì sale): xác suất màn GƯƠNG hiện ≥ 67% khi tỷ lệ THẬT chỉ là p`);
const C = (n: number, k: number) => { let c = 1; for (let i = 0; i < k; i++) c = c * (n - i) / (i + 1); return c; };
const duoiTren = (n: number, p: number, nguong: number) => { let s = 0; for (let k = 0; k <= n; k++) if (k / n >= nguong - 1e-9) s += C(n, k) * p ** k * (1 - p) ** (n - k); return s; };
for (const p of [0.2, 0.3, 0.4]) console.log(`   p thật ${pc(p, 0)} → ` + [3, 4, 6, 8, 12].map((n) => `n=${n}: ${pc(duoiTren(n, p, 2 / 3), 0)}`).join(' · '));

/* ═══ SỔ NHIỀU KHOẢN MỖI NGÀY — dùng cho B1 · B2 ═══════════════════════════════════════════════════════════ */
const CHU = ['ăn trưa', 'ăn tối', 'ăn sáng', 'grab', 'trà sữa', 'siêu thị', 'xăng', 'ăn vặt', 'cà phê', 'đồ dùng', 'nạp đt', 'quà'];
const chonChu = (r: R) => CHU[Math.min(CHU.length - 1, Math.floor(-Math.log(1 - r() * 0.95) * 3.2))]!; // lệch về đầu danh sách
function soTienLe(r: R, med: number, sig: number) { const x = Math.max(3000, med * Math.exp(sig * chuan(r))); return r() < 0.7 ? Math.max(5000, Math.round(x / 5000) * 5000) : Math.max(1000, Math.round(x / 1000) * 1000); }
interface Lap { ten: string; tien: number; coNgay: (d: number) => boolean; p: number }
const LAP: Record<string, Lap | null> = {
  'không có khoản lặp thật': null,
  'cà phê 25k ngày thường ': { ten: 'cà phê', tien: 25_000, coNgay: (d) => { const t = thu(NGAY[d]!); return t >= 1 && t <= 5; }, p: 0.9 },
  'gửi xe 5k mỗi ngày     ': { ten: 'gửi xe', tien: 5_000, coNgay: () => true, p: 0.85 },
  'món 45k hai lần/tuần   ': { ten: 'ăn trưa', tien: 45_000, coNgay: (d) => { const t = thu(NGAY[d]!); return t === 2 || t === 4; }, p: 0.9 },
};
function sinhSo(r: R, lap: Lap | null, coChu: boolean, pGhiKhoan: number, soNgay = 30, sigE = 0.8, monLon = false) {
  const so: any[] = []; const lonThat = new Set<string>();
  for (let d = 0; d < soNgay; d++) {
    const k = poisson(r, 2.5);
    for (let i = 0; i < k; i++) if (r() <= pGhiKhoan) so.push(khoan(NGAY[d]!, soTienLe(r, 35_000, sigE), 'chi', coChu ? chonChu(r) : undefined));
    if (lap && lap.coNgay(d) && r() <= lap.p && r() <= pGhiKhoan) so.push(khoan(NGAY[d]!, lap.tien, 'chi', coChu ? lap.ten : undefined));
    if (monLon && r() < 1 / 15) { const kk = khoan(NGAY[d]!, Math.max(200_000, Math.round(400_000 * Math.exp(0.7 * chuan(r)) / 10_000) * 10_000), 'chi', coChu ? 'mua đồ' : undefined); so.push(kk); lonThat.add(kk.id); }
  }
  return { so, lonThat };
}

console.log('\n══ E1b · cùng câu hỏi "ngày chi lớn", trên sổ NHIỀU KHOẢN mỗi ngày (~2,5 khoản/ngày, ~2 món lớn thật/tháng) — xét cuối ngày, sổ tính tới hôm ấy');
for (const sigE of [0.7, 1.0]) {
  const r = rng(20260921); const N = 1500; let tXet = 0, tLon = 0, lXet = 0, lLon = 0; const moiThang: number[] = [];
  for (let u = 0; u < N; u++) {
    const { so, lonThat } = sinhSo(r, null, false, 0.85, 30, sigE, true); let banThang = 0;
    const ngayCoLon = new Set(so.filter((k: any) => lonThat.has(k.id)).map((k: any) => k.ngay));
    for (let d = 0; d < 30; d++) {
      const toiNay = so.filter((k: any) => k.ngay <= NGAY[d]!); if (!toiNay.some((k: any) => k.ngay === NGAY[d])) continue;
      const kq = ngayChiLon(toiNay, NGAY[d]!).laNgayLon; if (kq === null) continue;
      if (ngayCoLon.has(NGAY[d]!)) { lXet++; if (kq) lLon++; } else { tXet++; if (kq) { tLon++; banThang++; } }
    }
    moiThang.push(banThang);
  }
  console.log(`   σ khoản ${sigE} → ngày THƯỜNG bị gọi "lớn": ${pc(tLon / tXet)} (≈ ${tb(moiThang).toFixed(1)} ngày/tháng, ${pc(moiThang.filter((x) => x >= 4).length / N, 0)} số tháng ≥ 4) · ngày CÓ món lớn thật được gọi "lớn": ${pc(lLon / lXet, 0)}`);
}

/* ═══ B1 — "KHOẢN LẶP": cùng khoá xuất hiện ≥ k lần trong d ngày ⇒ Oracle ĐỀ NGHỊ lưu mẫu một chạm ══════════ */
console.log('\n══ B1 · "khoản lặp" ⇒ đề nghị lưu mẫu một chạm. Khoá = (số tiền) hoặc (số tiền + ghi chú). Mỗi khoá chỉ đề nghị MỘT lần.');
console.log('   cột: người KHÔNG có khoản lặp thật → số đề nghị/tháng (toàn là trùng hợp) ‖ người CÓ → % được đề nghị ĐÚNG món trong 7 / 14 ngày · ngày trung vị · % đề nghị là đúng món');
function deNghi(so: any[], k: number, dNgay: number, kieu: 'tien' | 'tien_chu') {
  const theoKhoa = new Map<string, number[]>(); const ra: { khoa: string; ngay: number }[] = []; const daHoi = new Set<string>();
  const chiSo = new Map(NGAY.map((n, i) => [n, i] as const));
  for (const kh of so) {
    if (kh.chieu !== 'chi') continue; if (kieu === 'tien_chu' && !kh.ghiChu) continue;
    const khoa = kieu === 'tien' ? String(kh.soTien) : `${kh.soTien}|${kh.ghiChu}`; const d = chiSo.get(kh.ngay)!;
    const ds = theoKhoa.get(khoa) ?? []; ds.push(d); theoKhoa.set(khoa, ds);
    if (daHoi.has(khoa)) continue;
    if (ds.filter((x) => x > d - dNgay).length >= k) { daHoi.add(khoa); ra.push({ khoa, ngay: d }); }
  }
  return ra;
}
for (const kieu of ['tien', 'tien_chu'] as const) for (const [k, dNgay] of [[2, 7], [3, 7], [3, 14], [4, 14], [4, 7], [5, 14]] as const) {
  const o: string[] = [];
  for (const [ten, lap] of Object.entries(LAP)) {
    const r = rng(20260921); const N = 1500; let tongDN = 0, dung7 = 0, dung14 = 0, dungTat = 0; const ngayDung: number[] = [];
    for (let u = 0; u < N; u++) {
      const { so } = sinhSo(r, lap, kieu === 'tien_chu', 0.85); const dn = deNghi(so, k, dNgay, kieu); tongDN += dn.length;
      if (!lap) continue;
      const khoaDung = kieu === 'tien' ? String(lap.tien) : `${lap.tien}|${lap.ten}`; const tim = dn.find((x) => x.khoa === khoaDung);
      if (tim) { dungTat++; ngayDung.push(tim.ngay + 1); if (tim.ngay < 7) dung7++; if (tim.ngay < 14) dung14++; }
    }
    o.push(lap ? `${ten.trim()}: ${pc(dung7 / N, 0)}/${pc(dung14 / N, 0)} · ngày ${ngayDung.length ? phanVi(ngayDung, 0.5) : '–'} · đúng món ${pc(dungTat / Math.max(1, tongDN), 0)}` : `${(tongDN / N).toFixed(1)} đề nghị/tháng`);
  }
  console.log(`   khoá ${kieu === 'tien' ? 'SỐ TIỀN        ' : 'SỐ TIỀN+GHI CHÚ'} · ≥${k} lần/${String(dNgay).padStart(2)} ngày → ${o[0]}  ‖  ${o.slice(1).join('  |  ')}`);
}

/* ═══ B2 — "MÓN LỚN": một KHOẢN đủ lớn để Oracle quy ra "ngày chi thường" ngay trên bàn tiền ═══════════════ */
console.log('\n══ B2 · "món lớn" — xét lúc GHI, trên sổ TRƯỚC khoản ấy (sàn 6 ngày có chi). Sổ có ~2 món lớn thật/tháng (trung vị 400k) lẫn trong ~75 khoản thường.');
const UNG: Record<string, (tien: number, nenNgay: number, nenKhoan: number) => boolean> = {
  'A · ≥ 2 × trung vị NGÀY (dùng lại GUONG_HE_SO_NGAY_LON)': (t, n) => t >= 2 * n,
  'B · ≥ 1 × trung vị NGÀY ("món này bằng một ngày thường")': (t, n) => t >= n,
  'C · ≥ 3 × trung vị NGÀY                                 ': (t, n) => t >= 3 * n,
  'D · ≥ 5 × trung vị KHOẢN                                ': (t, _n, k) => t >= 5 * k,
};
for (const sigE of [0.7, 1.0]) for (const [ten, luat] of Object.entries(UNG)) {
  const r = rng(20260921); const N = 1200; const thuongMoiThang: number[] = []; let lonCo = 0, lonBat = 0, lonCam = 0; const ngayDau: number[] = [];
  for (let u = 0; u < N; u++) {
    const { so, lonThat } = sinhSo(r, null, false, 0.85, 30, sigE, true); let thuongBi = 0; let dau = -1;
    for (let i = 0; i < so.length; i++) {
      const truoc = so.slice(0, i); const theoNgay = chiTheoNgay(truoc); if (theoNgay.size < PFM.GUONG_SAN_NGAY_CHI) { if (lonThat.has(so[i].id)) lonCam++; continue; }
      if (dau < 0) dau = NGAY.indexOf(so[i].ngay) + 1;
      const nenNgay = trungVi([...theoNgay.values()])!; const nenKhoan = trungVi(truoc.map((x: any) => x.soTien))!;
      const bi = luat(so[i].soTien, nenNgay, nenKhoan);
      if (lonThat.has(so[i].id)) { lonCo++; if (bi) lonBat++; } else if (bi) thuongBi++;
    }
    thuongMoiThang.push(thuongBi); if (dau > 0) ngayDau.push(dau);
  }
  console.log(`   σ khoản ${sigE} · ${ten} → bắt ${pc(lonBat / lonCo, 0).padStart(4)} món lớn thật SAU sàn (${pc(lonCam / (lonCam + lonCo), 0)} số món lớn rơi vào tuần đầu câm) · gọi nhầm ${tb(thuongMoiThang).toFixed(1).padStart(4)} khoản thường/tháng (${pc(thuongMoiThang.filter((x) => x > 4).length / N, 0)} số tháng > 4) · nói được từ ngày ${phanVi(ngayDau, 0.5)}`);
}

/* ═══ B1-bis — "KHOẢN CỐ ĐỊNH THEO THÁNG" (founder 21/09: chỉ tính khoản chi cố định/ngày tháng) ═══════════ */
console.log('\n══ B1-bis · khoản CỐ ĐỊNH theo THÁNG — luật ≥3/14 ngày của B1 KHÔNG BAO GIỜ bắt được tiền trọ mùng 5.');
console.log('   Luật thử: cùng khoá xuất hiện ở ≥ m THÁNG khác nhau, mỗi lần cách nhau ~1 tháng (lệch ≤ d ngày so với cùng ngày trong tháng).');
{
  const THANG = 4;                                   // 4 tháng sổ = 120 ngày
  const NGAY4: string[] = []; { let n = '2026-06-01'; for (let i = 0; i < 130; i++) { NGAY4.push(n); n = ngayKeTiep(n); } }
  const chiSo = new Map(NGAY4.map((n, i) => [n, i] as const));
  const ngayTrongThang = (n: string) => Number(n.slice(8, 10));
  interface CoDinh { ten: string; tien: number; ngay: number }
  const CD: Record<string, CoDinh | null> = {
    'không có khoản cố định ': null,
    'trọ 2tr mùng 5         ': { ten: 'tiền trọ', tien: 2_000_000, ngay: 5 },
    'gói cước 90k mùng 12   ': { ten: 'nạp đt', tien: 90_000, ngay: 12 },
  };
  function sinh4Thang(r: R, cd: CoDinh | null, coChu: boolean) {
    const so: any[] = [];
    for (let d = 0; d < 120; d++) {
      const k = poisson(r, 2.5);
      for (let i = 0; i < k; i++) so.push(khoan(NGAY4[d]!, soTienLe(r, 35_000, 0.8), 'chi', coChu ? chonChu(r) : undefined));
      if (r() < 1 / 15) so.push(khoan(NGAY4[d]!, Math.max(200_000, Math.round(400_000 * Math.exp(0.7 * chuan(r)) / 10_000) * 10_000), 'chi', coChu ? 'mua đồ' : undefined));
    }
    if (cd) for (let t = 0; t < THANG; t++) {
      const n = NGAY4.find((x) => ngayTrongThang(x) === cd.ngay && chiSo.get(x)! >= t * 28 && chiSo.get(x)! < (t + 1) * 31);
      if (n && r() < 0.95) so.push(khoan(n, cd.tien, 'chi', coChu ? cd.ten : undefined));
    }
    return so;
  }
  /** Trả về danh sách khoá đủ điều kiện "cố định tháng" tại thời điểm cuối sổ. */
  function coDinhThang(so: any[], coChu: boolean, m: number, d: number): string[] {
    const theo = new Map<string, number[]>();
    for (const kh of so) {
      if (coChu && !kh.ghiChu) continue;
      const khoa = coChu ? `${kh.soTien}|${kh.ghiChu}` : String(kh.soTien);
      const ds = theo.get(khoa) ?? []; ds.push(chiSo.get(kh.ngay)!); theo.set(khoa, ds);
    }
    const ra: string[] = [];
    for (const [khoa, ds] of theo) {
      const x = [...new Set(ds)].sort((a, b) => a - b);
      // chuỗi dài nhất mà mỗi bước cách ~28–31 ngày (lệch ≤ d)
      let tot = 1;
      for (let i = 0; i < x.length; i++) {
        let dai = 1, cuoi = x[i]!;
        for (let j = i + 1; j < x.length; j++) {
          const b = x[j]! - cuoi;
          if (b >= 28 - d && b <= 31 + d) { dai++; cuoi = x[j]!; }
        }
        tot = Math.max(tot, dai);
      }
      if (tot >= m) ra.push(khoa);
    }
    return ra;
  }
  for (const coChu of [false, true]) for (const [m, d] of [[2, 3], [2, 5], [3, 3], [3, 5]] as const) {
    const o: string[] = [];
    for (const [ten, cd] of Object.entries(CD)) {
      const r = rng(20260921); const N = 800; let tong = 0, batDuoc = 0;
      for (let u = 0; u < N; u++) {
        const so = sinh4Thang(r, cd, coChu);
        const ds = coDinhThang(so, coChu, m, d);
        tong += ds.length;
        if (cd) { const dung = coChu ? `${cd.tien}|${cd.ten}` : String(cd.tien); if (ds.includes(dung)) batDuoc++; }
      }
      o.push(cd ? `${ten.trim()}: bắt ${pc(batDuoc / N, 0)}` : `${(tong / N).toFixed(1)} khoá/4 tháng`);
    }
    console.log(`   khoá ${coChu ? 'TIỀN+CHÚ' : 'TIỀN    '} · ≥${m} tháng liền, lệch ≤${d} ngày → trùng hợp ${o[0]}  ‖  ${o.slice(1).join('  |  ')}`);
  }
}

/* ═══ B1-ter — cùng luật tháng, NHƯNG chỉ xét khoản ĐỦ LỚN (≥ hệ số × trung vị ngày) ═══════════════════════ */
console.log('\n══ B1-ter · thêm MỘT điều kiện: chỉ xét khoản ≥ hệ số × trung vị ngày. Khoản cố định (trọ, học phí, gói cước)');
console.log('   gần như luôn là khoản LỚN; khoản 35k lặt vặt trùng số tiền thì không. Cùng sổ, cùng luật tháng.');
{
  const THANG = 4;
  const NGAY4: string[] = []; { let n = '2026-06-01'; for (let i = 0; i < 130; i++) { NGAY4.push(n); n = ngayKeTiep(n); } }
  const chiSo = new Map(NGAY4.map((n, i) => [n, i] as const));
  const ngayTrongThang = (n: string) => Number(n.slice(8, 10));
  interface CoDinh { ten: string; tien: number; ngay: number }
  const CD: Record<string, CoDinh | null> = {
    'không có khoản cố định': null,
    'trọ 2tr mùng 5       ': { ten: 'tiền trọ', tien: 2_000_000, ngay: 5 },
    'gói cước 90k mùng 12 ': { ten: 'nạp đt', tien: 90_000, ngay: 12 },
  };
  function sinh4Thang(r: R, cd: CoDinh | null) {
    const so: any[] = [];
    for (let d = 0; d < 120; d++) {
      const k = poisson(r, 2.5);
      for (let i = 0; i < k; i++) so.push(khoan(NGAY4[d]!, soTienLe(r, 35_000, 0.8), 'chi', chonChu(r)));
      if (r() < 1 / 15) so.push(khoan(NGAY4[d]!, Math.max(200_000, Math.round(400_000 * Math.exp(0.7 * chuan(r)) / 10_000) * 10_000), 'chi', 'mua đồ'));
    }
    if (cd) for (let t = 0; t < THANG; t++) {
      const n = NGAY4.find((x) => ngayTrongThang(x) === cd.ngay && chiSo.get(x)! >= t * 28 && chiSo.get(x)! < (t + 1) * 31);
      if (n && r() < 0.95) so.push(khoan(n, cd.tien, 'chi', cd.ten));
    }
    return so;
  }
  function coDinhLon(so: any[], m: number, d: number, he: number): string[] {
    const nen = trungVi([...chiTheoNgay(so).values()]) ?? 0;
    const san = he * nen;
    const theo = new Map<string, number[]>();
    for (const kh of so) {
      if (kh.soTien < san) continue;
      const khoa = `${kh.soTien}|${kh.ghiChu ?? ''}`;
      const ds = theo.get(khoa) ?? []; ds.push(chiSo.get(kh.ngay)!); theo.set(khoa, ds);
    }
    const ra: string[] = [];
    for (const [khoa, ds] of theo) {
      const x = [...new Set(ds)].sort((a, b) => a - b);
      let tot = 1;
      for (let i = 0; i < x.length; i++) {
        let dai = 1, cuoi = x[i]!;
        for (let j = i + 1; j < x.length; j++) { const b = x[j]! - cuoi; if (b >= 28 - d && b <= 31 + d) { dai++; cuoi = x[j]!; } }
        tot = Math.max(tot, dai);
      }
      if (tot >= m) ra.push(khoa);
    }
    return ra;
  }
  for (const he of [1, 2]) for (const [m, d] of [[2, 3], [2, 5], [3, 3]] as const) {
    const o: string[] = [];
    for (const [ten, cd] of Object.entries(CD)) {
      const r = rng(20260921); const N = 800; let tong = 0, bat = 0;
      for (let u = 0; u < N; u++) {
        const ds = coDinhLon(sinh4Thang(r, cd), m, d, he);
        tong += ds.length;
        if (cd && ds.includes(`${cd.tien}|${cd.ten}`)) bat++;
      }
      o.push(cd ? `${ten.trim()}: bắt ${pc(bat / N, 0)}` : `${(tong / N).toFixed(2)} khoá/4 tháng`);
    }
    console.log(`   ≥${he}× trung vị ngày · ≥${m} tháng liền, lệch ≤${d} → trùng hợp ${o[0]}  ‖  ${o.slice(1).join('  |  ')}`);
  }
}

/* ═══ B1-quater — lọc cỡ theo TRUNG VỊ KHOẢN, không theo trung vị NGÀY ═════════════════════════════════════ */
console.log('\n══ B1-quater · cùng luật tháng, lọc cỡ theo TRUNG VỊ KHOẢN. (Trung vị NGÀY quá cao: một ngày gộp ~2,5 khoản,');
console.log('   nên gói cước 90k nằm DƯỚI một ngày thường và bị loại — xem B1-ter.)');
{
  const THANG = 4;
  const NGAY4: string[] = []; { let n = '2026-06-01'; for (let i = 0; i < 130; i++) { NGAY4.push(n); n = ngayKeTiep(n); } }
  const chiSo = new Map(NGAY4.map((n, i) => [n, i] as const));
  const ngayTrongThang = (n: string) => Number(n.slice(8, 10));
  interface CoDinh { ten: string; tien: number; ngay: number }
  const CD: Record<string, CoDinh | null> = {
    'không có khoản cố định': null,
    'trọ 2tr mùng 5       ': { ten: 'tiền trọ', tien: 2_000_000, ngay: 5 },
    'gói cước 90k mùng 12 ': { ten: 'nạp đt', tien: 90_000, ngay: 12 },
    'học phí 600k mùng 20 ': { ten: 'học phí', tien: 600_000, ngay: 20 },
  };
  function sinh4Thang(r: R, cd: CoDinh | null) {
    const so: any[] = [];
    for (let d = 0; d < 120; d++) {
      const k = poisson(r, 2.5);
      for (let i = 0; i < k; i++) so.push(khoan(NGAY4[d]!, soTienLe(r, 35_000, 0.8), 'chi', chonChu(r)));
      if (r() < 1 / 15) so.push(khoan(NGAY4[d]!, Math.max(200_000, Math.round(400_000 * Math.exp(0.7 * chuan(r)) / 10_000) * 10_000), 'chi', 'mua đồ'));
    }
    if (cd) for (let t = 0; t < THANG; t++) {
      const n = NGAY4.find((x) => ngayTrongThang(x) === cd.ngay && chiSo.get(x)! >= t * 28 && chiSo.get(x)! < (t + 1) * 31);
      if (n && r() < 0.95) so.push(khoan(n, cd.tien, 'chi', cd.ten));
    }
    return so;
  }
  function coDinh(so: any[], m: number, d: number, he: number): string[] {
    const san = he * (trungVi(so.map((k: any) => k.soTien)) ?? 0);
    const theo = new Map<string, number[]>();
    for (const kh of so) {
      if (kh.soTien < san) continue;
      const khoa = `${kh.soTien}|${kh.ghiChu ?? ''}`;
      const ds = theo.get(khoa) ?? []; ds.push(chiSo.get(kh.ngay)!); theo.set(khoa, ds);
    }
    const ra: string[] = [];
    for (const [khoa, ds] of theo) {
      const x = [...new Set(ds)].sort((a, b) => a - b);
      let tot = 1;
      for (let i = 0; i < x.length; i++) {
        let dai = 1, cuoi = x[i]!;
        for (let j = i + 1; j < x.length; j++) { const b = x[j]! - cuoi; if (b >= 28 - d && b <= 31 + d) { dai++; cuoi = x[j]!; } }
        tot = Math.max(tot, dai);
      }
      if (tot >= m) ra.push(khoa);
    }
    return ra;
  }
  for (const he of [2, 3, 5]) for (const [m, d] of [[2, 3], [3, 3]] as const) {
    const o: string[] = [];
    for (const [ten, cd] of Object.entries(CD)) {
      const r = rng(20260921); const N = 800; let tong = 0, bat = 0;
      for (let u = 0; u < N; u++) {
        const ds = coDinh(sinh4Thang(r, cd), m, d, he);
        tong += ds.length;
        if (cd && ds.includes(`${cd.tien}|${cd.ten}`)) bat++;
      }
      o.push(cd ? `${ten.trim()}: ${pc(bat / N, 0)}` : `${(tong / N).toFixed(2)} khoá/4 tháng`);
    }
    console.log(`   ≥${he}× trung vị KHOẢN · ≥${m} tháng, lệch ≤${d} → trùng hợp ${o[0]}  ‖  ${o.slice(1).join(' | ')}`);
  }
}
