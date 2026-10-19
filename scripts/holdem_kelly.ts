/**
 * THÍ NGHIỆM KELLY — nghiệm thu spec 01 §4.2b (task #27), "thước thẳng" mà
 * 03-chu-ky-tin-dung §0.3 bắt phải có TRƯỚC khi tune bước 3+.
 *
 * Ràng buộc nghiệm thu, nguyên văn spec: "bot phân bổ theo công thức (Kelly
 * bậc thang) phải xếp trên bot kéo bừa (uniform random) qua Monte Carlo, nếu
 * không thì phân bổ chỉ là trang trí."
 *
 * ─── PHƯƠNG PHÁP (ghi để lặp lại y hệt — nếp D20) ───────────────────────────
 * · Bàn 5 ghế, map mặc định (12 ô), engine v10b THẬT qua giaiQuyetVong — không
 *   mock. N seed liên tiếp từ 1.
 * · BA BOT ĐI VỐN DÙNG CHUNG CHÍNH SÁCH CHỌN MÃ (kỷ luật D37: chênh lệch chỉ
 *   được phép đến từ CÁCH ĐI VỐN): mã tốt nhất = argmax μ_a theo luật CÔNG KHAI
 *   (8.2 — dự báo pha kế: nền di_ngang 3000/others 1500 + telegraph của sự kiện
 *   vừa lộ, chiết khấu theo tỷ lệ tin giả CÔNG KHAI của nhãn bối cảnh; KHÔNG
 *   đọc la_tin_gia — đó là oracle, không phải người chơi).
 *     - kelly    : nửa-Kelly f = ½·μ/σ² trên NAV, bậc thang mốc thô, có kỷ luật
 *                  "không đảo dưới nửa nấc" (chống tự bào bằng trượt giá).
 *     - co_dinh  : luôn nhắm 50% NAV vào mã tốt nhất — công thức nhưng KHÔNG
 *                  theo edge, nấc giữa của gradient.
 *     - bua_size : cùng mã, cỡ lệnh RÚT NGẪU NHIÊN đều (mua/bán 25·50·75·100%
 *                  hoặc đứng im) — đúng "kéo vốn bừa" của founder.
 * · Hai bot nền: bua_full (mã ngẫu nhiên + cỡ ngẫu nhiên — null đầy đủ) và
 *   tien_mat (không bao giờ mua — baseline "không chơi", chịu lạm phát).
 * · Mọi ngẫu nhiên qua rngAt địa chỉ hoá (seed, domain, vòng, ghế) — tất định,
 *   chạy lại ra đúng từng con số.
 * · GATE: hạng TB kelly < bua_size VÀ < bua_full. Kỳ vọng phụ (không chặn):
 *   gradient kelly ≤ co_dinh ≤ bua_size.
 *
 * Chạy: npx tsx scripts/holdem_kelly.ts [N] [fine]
 *   N mặc định 2000; thêm "fine" ⇒ cả ba bot đi vốn cầm Chia Lệnh (mốc 5%) để
 *   đo mốc mịn có đáng là đặc quyền không.
 */
import {
  DUOI_5MAT, GIAI_DOAN, HOLDEM_MATCH, MT_TAI_SAN_GIAI_DOAN, MT_TAI_SAN_SU_KIEN, NAV_V10,
  NHA_CAI, QUAN_TINH, SU_KIEN, TAI_SAN, TY_LE_TIN_GIA_THEO_BOI_CANH, luatCua,
  type GiaiDoanId,
} from '../config/holdem.js';
import {
  apLenhMocNav, daKetThuc, giaiQuyetVong, taoTran, type Ghe, type GheMoi,
  type TrangThaiTran,
} from '../server/holdem/engine.js';
import { navCua, type LenhMoc } from '../server/holdem/nav.js';
import type { OThiTruong } from '../server/holdem/map.js';
import { rngAt } from '../server/sandbox/rng.js';

const N = Number(process.argv[2] ?? 2000);
const FINE = process.argv.includes('fine');
/** Đo trên version nào — v12 quán tính, v13 sức căng (mặc định v10b gốc). */
const PHIEN_BAN = process.argv.includes('v18') ? 'balance-v18-hequa'
  : process.argv.includes('v17') ? 'balance-v17-khong'
  : process.argv.includes('v16') ? 'balance-v16-duoi5'
  : process.argv.includes('v15') ? 'balance-v15-chuky'
  : process.argv.includes('v14') ? 'balance-v14-nennav'
  : (process.argv.includes('v13') ? 'balance-v13-succang'
    : (process.argv.includes('v12') ? 'balance-v12-quantinh' : 'balance-v10b-nav'));
const THEO = () => ({ loai: 'theo' as const });
const BUOC = FINE ? NAV_V10.BUOC_MOC_BP : NAV_V10.BUOC_MOC_THO_BP;
const MOC_GRID = Array.from(
  { length: Math.floor(10000 / BUOC) }, (_, i) => (i + 1) * BUOC);

/**
 * Dự báo phân bố pha kế từ luật CÔNG KHAI — không đọc la_tin_gia.
 * Khi đo v12, bot cũng đọc LUẬT QUÁN TÍNH công khai: dựng lại run từ các ô
 * ĐÃ LỘ (sự kiện đóng băng run) rồi nghiêng đúng như máy — người chơi try-hard
 * ngoài đời sẽ tính y hệt, vì QUAN_TINH nằm trong bách khoa (bất biến 8.2).
 */
function duBaoPha(daLo: readonly OThiTruong[]): Record<GiaiDoanId, number> {
  const oLo = daLo[daLo.length - 1];
  const w: Record<GiaiDoanId, number> = {
    di_ngang: 3000, tang: 1500, giam: 1500, bien_dong: 1500, phuc_hoi: 1500,
  };
  if (oLo?.kind === 'su_kien') {
    const pThat = 10000 - TY_LE_TIN_GIA_THEO_BOI_CANH[oLo.boi_canh];
    w[oLo.bao_truoc] += Math.floor((NHA_CAI.SUC_MANH_TELEGRAPH_BP * pThat) / 10000);
  }
  if (PHIEN_BAN !== 'balance-v10b-nav') {
    const HUONG = { tang: 1, phuc_hoi: 1, giam: -1, di_ngang: 0, bien_dong: 0 } as const;
    let phaCuoi: GiaiDoanId | null = null;
    let huong = 0;
    let dai = 0;
    for (const o of daLo) {
      if (o.kind !== 'giai_doan') continue;
      const h = HUONG[o.giai_doan];
      if (h === huong) dai += 1;
      else { huong = h; dai = 1; }
      phaCuoi = o.giai_doan;
    }
    if (dai >= QUAN_TINH.NGUONG_CHUOI && phaCuoi) {
      if (huong === 1) w[phaCuoi] += QUAN_TINH.TU_LAP_BP;
      if (huong === -1) {
        w.giam += QUAN_TINH.TU_LAP_BP;
        w.bien_dong += QUAN_TINH.KEM_BIEN_DONG_BP;
      }
    }
    if (phaCuoi === 'giam' && dai < QUAN_TINH.PHUC_HOI_SAU_GIAM_O) w.phuc_hoi = 0;
  }
  const tong = GIAI_DOAN.reduce((a, g) => a + w[g.id], 0);
  const p = {} as Record<GiaiDoanId, number>;
  for (const g of GIAI_DOAN) p[g.id] = w[g.id] / tong;
  return p;
}

/**
 * μ (bp/vòng) và phương sai (bp²) của từng mã theo dự báo pha + RỦI RO SỰ KIỆN.
 *
 * ⚠ BẢN ĐẦU (đo 01/08, 2.000 trận) CHỈ mô hình pha ⇒ Var thiếu vế sự kiện
 * ⇒ f = ½μ/σ² kẹp trần 1.0 ⇒ "Kelly" hoá thành bot all-in đảo mã, hạng TB
 * 3,025 — THUA cả hai bot bừa (2,881/2,891). Kelly over-bet đúng sách là tệ
 * hơn under-bet. Vế sự kiện dưới đây toàn số CÔNG KHAI: P(ô sự kiện) ≈ 35%,
 * bảng MT_TAI_SAN_SU_KIEN, tỷ lệ tin giả nền (tin giả = sốc không nổ).
 */
function muVa(daLo: readonly OThiTruong[]): Record<string, { mu: number; va: number }> {
  const p = duBaoPha(daLo);
  const pe = NHA_CAI.TY_LE_O_SU_KIEN_BP / 10000;
  const pThatNen = 1 - NHA_CAI.TY_LE_TIN_GIA_BP / 10000;
  const r: Record<string, { mu: number; va: number }> = {};
  for (const ts of TAI_SAN) {
    const hang = MT_TAI_SAN_GIAI_DOAN[ts.id]!;
    let muPha = 0;
    for (const g of GIAI_DOAN) muPha += p[g.id] * hang[g.id];
    let m2Pha = 0;
    for (const g of GIAI_DOAN) m2Pha += p[g.id] * hang[g.id] * hang[g.id];
    // Sự kiện: người chơi khiêm tốn coi 7 mặt đều nhau (dây chuyền công khai
    // nhưng phụ thuộc vòng — bỏ qua có chủ ý, ghi lại ở đây).
    const sk = MT_TAI_SAN_SU_KIEN[ts.id]!;
    // ⚠ Vá 01/08: chỉ tính các mặt CÓ THỂ NỔ ở version đang đo — SU_KIEN nay
    // 12 mặt (5 mặt đuôi v16), trộn mặt không nổ vào là pha loãng μ/σ của bot
    // và điểm Kelly tụt oan (đã dính: 2,84 → 3,31 không vì thế giới đổi).
    const duoi5 = PHIEN_BAN === 'balance-v16-duoi5';
    const noDuoc = SU_KIEN.filter((e) => (duoi5
      ? e.id !== 'thien_nga_den' : !(e.id in DUOI_5MAT)));
    let muSk = 0;
    let m2Sk = 0;
    for (const e of noDuoc) {
      muSk += sk[e.id] / noDuoc.length;
      m2Sk += (sk[e.id] * sk[e.id]) / noDuoc.length;
    }
    const mu = (1 - pe) * muPha + pe * pThatNen * muSk;
    const m2 = (1 - pe) * m2Pha + pe * pThatNen * m2Sk;
    r[ts.id] = { mu, va: Math.max(1, m2 - mu * mu) + ts.bien_dong_bp * ts.bien_dong_bp };
  }
  return r;
}

/**
 * Mã tốt nhất — CHUNG cho cả ba bot đi vốn (kỷ luật D37), có TRỄ ĐẢO MÃ:
 * giữ mã đang cầm trừ khi mã mới hơn ≥ 100 bp — mỗi cú đảo trả trượt giá
 * hai đầu, đảo theo từng cú nhích μ là tự bào NAV của mọi chính sách cỡ.
 */
function maTotNhat(
  bang: Record<string, { mu: number; va: number }>, dangCam?: string,
): string {
  const uuTien = { day: 0, vua: 1, mong: 2 } as const;
  const tot = [...TAI_SAN].sort((a, b) => (bang[b.id]!.mu - bang[a.id]!.mu)
    || (uuTien[a.thanh_khoan] - uuTien[b.thanh_khoan]))[0]!.id;
  if (dangCam && bang[dangCam]
    && bang[tot]!.mu - bang[dangCam].mu < 100) return dangCam;
  return tot;
}

/** Mã đang cầm nặng nhất của ghế — đầu vào cho trễ đảo mã. */
function maDangCam(g: Ghe): string | undefined {
  const cap = Object.entries(g.vi_the).filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])[0];
  return cap?.[0];
}

/** Ép một tỷ lệ mong muốn về nấc mốc DƯỚI gần nhất (bậc thang). */
function vaoNac(bp: number): number {
  const nac = Math.floor(bp / BUOC) * BUOC;
  return Math.max(0, Math.min(10000, nac));
}

type ChinhSach = (g: Ghe, st: TrangThaiTran, seed: number) => LenhMoc[];

/** Bán sạch mọi mã ngoài `giu` — cả ba bot đi vốn tập trung một mã. */
function banNgoai(g: Ghe, giu: string): LenhMoc[] {
  return Object.keys(g.vi_the).filter((ma) => ma !== giu && g.vi_the[ma]! > 0)
    .map((ma) => ({ ma, chieu: 'ban' as const, moc_bp: 10000 }));
}

/** Lệnh đưa vị thế mã `ma` về `target` chip — chung cho kelly/co_dinh. */
function veMucTieu(g: Ghe, ma: string, target: number): LenhMoc[] {
  const lenh = banNgoai(g, ma);
  const cur = g.vi_the[ma] ?? 0;
  const nav = navCua(g);
  const delta = target - cur;
  // Kỷ luật chống churn: lệch dưới nửa nấc thô thì đứng im — mỗi cú đảo trả
  // trượt giá thật, đảo vặt là tự bào NAV.
  if (Math.abs(delta) < Math.floor((nav * NAV_V10.BUOC_MOC_THO_BP) / 20000)) return lenh;
  if (delta > 0) {
    // Mua theo mốc trên TIỀN MẶT sau khi các lệnh bán phía trước khớp
    // (giaiLenhMoc giải tuần tự nên cộng ước lượng tiền về từ bán).
    const tienSau = g.von + Object.keys(g.vi_the)
      .filter((m) => m !== ma).reduce((a, m) => a + (g.vi_the[m] ?? 0), 0);
    if (tienSau <= 0) return lenh;
    const moc = vaoNac(Math.floor((delta * 10000) / tienSau));
    if (moc >= BUOC) lenh.push({ ma, chieu: 'mua', moc_bp: moc });
  } else if (cur > 0) {
    const moc = vaoNac(Math.floor((-delta * 10000) / cur));
    if (moc >= BUOC) lenh.push({ ma, chieu: 'ban', moc_bp: moc });
  }
  return lenh;
}

const CHINH_SACH: Record<string, ChinhSach> = {
  kelly: (g, st) => {
    /*
     * ⚠ SỬA LẦN 3 (01/08, sau v13): Kelly ĐA MÃ. Từ khi sức căng trừng phạt
     * tập trung (crowding + trừng phạt cá biệt §5.4), "argmax μ rồi dồn" chính
     * là chiến lược đu-mã-căng-nhất mà gate 7.3 đòi phải thua. Công thức phân
     * bổ thật ngoài đời có chiều CHỌN RỔ: f_a = ½·μ_vượt/σ² từng mã, lấy tối
     * đa 3 mã f > 0, chuẩn hoá nếu Σf > 1. Lần 2 đã sửa μ → μ vượt numeraire
     * (tiền mặt mất giá 150 bp/vòng); lần 1 thiếu var sự kiện — xem đầu file.
     */
    const bang = muVa(st.map.o.slice(0, st.vong - 1));
    const nav = navCua(g);
    const ung = TAI_SAN.map((ts) => {
      const { mu, va } = bang[ts.id]!;
      const muVuot = mu + NAV_V10.LAM_PHAT_TIEN_MAT_BP;
      const f = muVuot <= 40 ? 0
        : Math.max(0, Math.min(1, (0.5 * muVuot * 10000) / va));
      return { id: ts.id, f };
    }).filter((x) => x.f > 0).sort((a, b) => b.f - a.f).slice(0, 3);
    const tongF = ung.reduce((a, x) => a + x.f, 0);
    const coDan = tongF > 1 ? 1 / tongF : 1;
    const nguong = Math.floor((nav * NAV_V10.BUOC_MOC_THO_BP) / 20000);
    const lenh: LenhMoc[] = Object.keys(g.vi_the)
      .filter((ma) => g.vi_the[ma]! > 0 && !ung.some((u) => u.id === ma))
      .map((ma) => ({ ma, chieu: 'ban' as const, moc_bp: 10000 }));
    let tienUoc = g.von + lenh.reduce((a, l) => a + (g.vi_the[l.ma] ?? 0), 0);
    for (const u of ung) {
      const target = Math.floor(u.f * coDan * nav);
      const cur = g.vi_the[u.id] ?? 0;
      const delta = target - cur;
      if (delta > nguong && tienUoc > 0) {
        const moc = vaoNac(Math.floor((delta * 10000) / tienUoc));
        if (moc >= BUOC) {
          lenh.push({ ma: u.id, chieu: 'mua', moc_bp: moc });
          tienUoc -= Math.floor((tienUoc * moc) / 10000);
        }
      } else if (delta < -nguong && cur > 0) {
        const moc = vaoNac(Math.floor((-delta * 10000) / cur));
        if (moc >= BUOC) {
          lenh.push({ ma: u.id, chieu: 'ban', moc_bp: moc });
          tienUoc += Math.floor((cur * moc) / 10000);
        }
      }
    }
    return lenh;
  },
  co_dinh: (g, st) => {
    const ma = maTotNhat(muVa(st.map.o.slice(0, st.vong - 1)), maDangCam(g));
    return veMucTieu(g, ma, Math.floor(navCua(g) / 2));
  },
  bua_size: (g, st, seed) => {
    const ma = maTotNhat(muVa(st.map.o.slice(0, st.vong - 1)), maDangCam(g));
    const lenh = banNgoai(g, ma);
    // 9 cửa đều nhau: mua 25/50/75/100 · bán 25/50/75/100 · đứng im.
    const r = rngAt(seed, 'xp_kelly_size', st.vong).below(9);
    if (r < 4) lenh.push({ ma, chieu: 'mua', moc_bp: (r + 1) * 2500 });
    else if (r < 8 && (g.vi_the[ma] ?? 0) > 0) {
      lenh.push({ ma, chieu: 'ban', moc_bp: (r - 3) * 2500 });
    }
    return lenh;
  },
  bua_full: (g, st, seed) => {
    const rng = rngAt(seed, 'xp_kelly_full', st.vong);
    const ma = TAI_SAN[rng.below(TAI_SAN.length)]!.id;
    const r = rng.below(9);
    if (r < 4) return [{ ma, chieu: 'mua', moc_bp: (r + 1) * 2500 }];
    if (r < 8 && (g.vi_the[ma] ?? 0) > 0) {
      return [{ ma, chieu: 'ban', moc_bp: (r - 3) * 2500 }];
    }
    return [];
  },
  tien_mat: () => [],
};

const GHE_IDS = Object.keys(CHINH_SACH);
const V10B = luatCua(PHIEN_BAN);

const tk = Object.fromEntries(GHE_IDS.map((id) => [id, {
  tongHang: 0, top1: 0, chay: 0, tongNav: 0, lenhTuChoi: 0,
}]));

for (let seed = 1; seed <= N; seed += 1) {
  const ghe: GheMoi[] = GHE_IDS.map((id) => ({
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: {
      tai_san: [],
      chien_thuat: FINE && id !== 'tien_mat' ? ['chia_lenh'] : [],
    },
  }));
  let st = taoTran(seed, ghe, V10B);
  let guard = 0;
  while (!daKetThuc(st) && guard < 40) {
    guard += 1;
    for (const id of GHE_IDS) {
      const g = st.ghe.find((x) => x.id === id)!;
      if (g.da_chay) continue;
      const lenh = CHINH_SACH[id]!(g, st, seed);
      if (lenh.length === 0) continue;
      const r = apLenhMocNav(st, id, lenh);
      st = r.st;
      if (!r.ok) tk[id]!.lenhTuChoi += 1;
    }
    st = giaiQuyetVong(st, THEO).trangThai;
  }
  const xep = [...st.ghe].sort((a, b) => navCua(b) - navCua(a));
  xep.forEach((g, i) => {
    const t = tk[g.id]!;
    t.tongHang += i + 1;
    if (i === 0) t.top1 += 1;
    if (g.da_chay) t.chay += 1;
    t.tongNav += navCua(g);
  });
}

console.log(`THÍ NGHIỆM KELLY — ${N} trận, bàn 5, map mặc định, ${PHIEN_BAN}, mốc ${FINE ? 'MỊN 5%' : 'THÔ 25%'}`);
for (const id of GHE_IDS) {
  const t = tk[id]!;
  console.log(`  ${id.padEnd(9)} hạng TB ${(t.tongHang / N).toFixed(3)}`
    + ` · nhất ${(100 * t.top1 / N).toFixed(1)}%`
    + ` · cháy ${(100 * t.chay / N).toFixed(1)}%`
    + ` · NAV cuối TB ${Math.round(t.tongNav / N)}`
    + (t.lenhTuChoi ? ` · lệnh từ chối ${t.lenhTuChoi}` : ''));
}
const hang = (id: string) => tk[id]!.tongHang / N;
const gate = hang('kelly') < hang('bua_size') && hang('kelly') < hang('bua_full');
console.log(`GATE §4.2b (kelly < cả hai bot bừa): ${gate ? 'ĐẠT ✓' : 'KHÔNG ĐẠT ✗'}`);
console.log(`gradient kelly ≤ co_dinh ≤ bua_size: ${
  hang('kelly') <= hang('co_dinh') && hang('co_dinh') <= hang('bua_size') ? 'ĐÚNG' : 'LỆCH'}`);
