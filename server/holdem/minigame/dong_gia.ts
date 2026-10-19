/**
 * DÒNG GIÁ MINIGAME — engine nhịp THUẦN (D465, bước 3.2). Chép từ demo đã chốt `docs/ui-ux/demo/minigame-bat-day.html` (A11.25):
 * `chonHinh` · `dungDai` (ở độ mịn chung k = 2) · `gopHaiNen` · `kichBan` · `daiCang` · `xacSuatQuet`. Giữ NGUYÊN thứ tự từng phép tính số thực —
 * `tests/minigame_dong_gia.test.ts` bắt bản này ra đúng từng số của demo trên 40 bối cảnh (mã băm 80 nến mịn + 40 nến gộp).
 *
 * Giá = f(seed, mã, hình, kịch bản thẻ, dải sức căng, các cú đẩy của tin). KHÔNG đọc đồng hồ, không đụng DB ⇒ replay được. Một nhịp = một mốc giá
 * (`tick`) trong nến mịn: 60 nến chạy × 8 mốc = 480 nhịp trong 34 s. Dòng lệnh của người/bot cộng lên sau (bước 3.x), không nằm ở đây.
 * Chữ (tên hình, câu tin) ở client (D26) — ở đây chỉ id và số.
 */
import { SU_KIEN, TAI_SAN, mtSuKien, type SuKienId } from '../../../config/holdem.js';
import { DO_SAU_L_NAM, type NacThanhKhoan } from '../../../config/thanh_khoan_nam_nac.js';
import {
  DAC_THU, HO_DUONG_SINH, HO_HINH, HOI, HON_HOP, K_MIN, KICH_BAN, MA_MINIGAME, NEN_LS, NHIEU_SAN_NGAN, NHIP, QUET, RUT, SAN_CRYPTO, GAI_MAG, PHU_NHIEU_X, SO_NHIP, NHIP_MOI_NEN_GOP, NHIP_MOI_NEN, TRO_KHOANG, TRO_TU, TL_DAY, DAY_CHUYEN, DAM_DONG_NEN, KY_QUY, BAY_CA_NHAN, GIA_TRI, LENH_LON_BOT, HINH_NGANG, VAO_GIA, type KieuTuongQuan } from '../../../config/minigame.js';
import { HINH_CHUNG, type HinhMinigame } from '../../../config/minigame_hinh.js';

export type NhomThe = 'giam' | 'tang' | 'ngang' | 'bien_dong';
export type LopThe = 'truoc' | 'no' | 'du_am';
export type DaiCang = 'em' | 'cang' | 'rat';
/** D468 — chế độ dòng giá: mã rủi ro luôn `thuong`; mã PHÒNG THỦ (nhóm `phong_thu` của engine) `duong_sinh` ở ô giai đoạn, `cuc_doan` ở thẻ sự kiện. */
export type CheDo = 'thuong' | 'duong_sinh' | 'cuc_doan';
export function cheDoCua(ma: string, laSuKien: boolean): CheDo {
  if (TAI_SAN.find((t) => t.id === ma)?.nhom !== 'phong_thu') return 'thuong';
  return laSuKien ? 'cuc_doan' : 'duong_sinh';
}
/** Nhóm thẻ của chế độ dưỡng sinh: theo DẤU điểm ma trận (demo `nhomDuongSinh`). */
export function nhomDuongSinh(diem: number): 'tang' | 'giam' | 'ngang' {
  return diem >= 300 ? 'tang' : diem <= -300 ? 'giam' : 'ngang';
}

/** Bộ sinh số giả ngẫu nhiên của demo (mulberry32) — dùng ĐÚNG hàm này để khớp demo. */
export function rngMinigame(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface KichBan { o: NhomThe; bien: number; nghieng: number; nhieuX: number }

/** Thẻ SỰ KIỆN → kịch bản map của mã (demo `kichBan`): điểm ma trận v42 chọn nhóm + biên độ; lớp TRƯỚC · NỔ · DƯ ÂM. */
export function kichBanThe(ma: string, the: SuKienId, lop: LopThe, xa = 1): KichBan {
  const v = mtSuKien('v42')[ma]?.[the] ?? 0;
  const mo: NhomThe = v >= KICH_BAN.NGUONG ? 'tang' : v <= -KICH_BAN.NGUONG ? 'giam' : 'ngang';
  const goc = Math.max(KICH_BAN.GOC_MIN, Math.min(KICH_BAN.GOC_MAX, Math.abs(v) / KICH_BAN.CHIA));
  const nguoc: Record<string, NhomThe> = { tang: 'giam', giam: 'tang', ngang: 'ngang' };
  const truoc = SU_KIEN.find((s) => s.id === the)?.bao_truoc;
  // D469 — nhóm hình + độ giật theo PHA thẻ báo trước; HƯỚNG nghiêng theo DẤU của mã với thẻ (bản cũ: theo pha, chung mọi mã ⇒ USDT nghiêng xuống trước Tăng lãi suất)
  const phaDong = truoc !== 'tang' && truoc !== 'giam', hs = phaDong ? 0 : Math.sign(v);
  if (lop === 'truoc') return { o: phaDong ? 'bien_dong' : 'ngang', bien: 1, nghieng: +(KICH_BAN.NGHIENG * goc * hs).toFixed(3), nhieuX: phaDong ? KICH_BAN.NHIEU_BIEN_DONG : 1 };
  const bienNo = +(1 + (goc - 1) * 0.5).toFixed(2);
  if (lop === 'no') return { o: mo, bien: bienNo, nghieng: 0, nhieuX: 1 };
  const x = Math.max(1, Math.min(3, xa)), o = x === 1 ? mo : x === 2 ? nguoc[mo]! : 'ngang';
  return { o, bien: +Math.max(KICH_BAN.DU_SAN, bienNo * Math.pow(0.5, x)).toFixed(2), nghieng: 0, nhieuX: 1 };
}

/** Dải sức căng "theo map": rút theo tỉ lệ đo trên map thật (demo `daiCang`). Trong engine thật đọc từ `suc_cang_bp` của ô. */
export function daiCangTheoMap(seed: number, ma: string): DaiCang {
  const p = QUET.DAI_MAP[ma] ?? [1, 0, 0], x = rngMinigame(seed ^ 0x5c4a1d)();
  return x < p[0]! ? 'em' : x < p[0]! + p[1]! ? 'cang' : 'rat';
}

/** Hệ số lớp của độ xấu thẻ: TRƯỚC ¼ · NỔ 1 · DƯ ÂM ½ / ¼ / 0. Ô giai đoạn (không phải sự kiện) = 1. */
export function heSoLop(lop: LopThe, xa = 1): number {
  return lop === 'du_am' ? (QUET.L_DU[Math.max(1, Math.min(3, xa))] ?? 0) : (QUET.L_LOP[lop] ?? 1);
}

/** Xác suất cú quét (D460): nền theo mã × (1 + A_S × sức căng) × (1 + A_T × độ xấu của thẻ với mã), trần 60%. `diem` = điểm thẻ với mã. */
export function xacSuatQuet(seed: number, ma: string, diem: number, L: number, cangEp?: DaiCang, cheDo: CheDo = 'thuong'): { q: number; dai: DaiCang } {
  const dai = cangEp ?? daiCangTheoMap(seed, ma), sBp = QUET.S_DAI[dai], kCang = 1 + QUET.A_S * sBp / 10000;
  const xau = Math.max(0, -diem - QUET.VUNG_CHET) / QUET.CHIA * L, kThe = 1 + QUET.A_T * xau;
  const q0 = cheDo === 'duong_sinh' ? 0 : (cheDo === 'cuc_doan' ? QUET.Q0_CD[ma] : QUET.Q0[ma]) ?? 0.01;   // D468: dưỡng sinh không có cú quét
  return { q: Math.min(QUET.TRAN, q0 * kCang * kThe), dai };
}

/** Bốc hình (D460): rút HỌ theo `HON_HOP[nhóm]`, rồi hình trong họ theo `w`/`wCrypto` (DƯ ÂM: hình hồi ×3). */
export function chonHinh(seed: number, ma: string, nhom: NhomThe, lop: LopThe, cheDo: CheDo = 'thuong', diem = 0, the?: SuKienId): HinhMinigame {
  const kho = HINH_CHUNG;
  const dt = the && lop === 'no' ? DAC_THU[`${the}|${ma}`] : undefined;   // D469 — kịch bản đặc thù, không rút số ngẫu nhiên
  if (dt) return kho.find((h) => h.id === dt)!;
  const w = (h: HinhMinigame) => (SAN_CRYPTO.includes(ma) && h.wCrypto ? h.wCrypto : (h.w ?? 1)) * (lop === 'du_am' ? (HOI.has(h.id) ? 3 : 1) : 1);
  const r = rngMinigame(seed ^ 0x9e3779b9), ho = HO_HINH[nhom], hh = HON_HOP[nhom];
  const rut = <T>(ds: readonly T[], trongSo: (d: T) => number): T => {
    let x = r() * ds.reduce((a, d) => a + trongSo(d), 0);
    for (const d of ds) { x -= trongSo(d); if (x <= 0) return d; }
    return ds[ds.length - 1]!;
  };
  if (cheDo === 'duong_sinh') return rut(HO_DUONG_SINH[nhomDuongSinh(diem)].map((id) => kho.find((h) => h.id === id)!), w);   // D468
  if (ho && hh) {
    const ten = rut(Object.keys(hh), (k) => hh[k]!);
    const ds = (ho[ten] ?? []).map((id) => kho.find((h) => h.id === id)).filter((h): h is HinhMinigame => !!h);
    if (ds.length) return rut(ds, w);
  }
  const hop = kho.filter((h) => h.o.includes(nhom)); return rut(hop.length ? hop : kho, w);
}

export interface NenMin {
  o: number; c: number; h: number; l: number; tick: number[]; v: number; iSong: number;
  rut: number; quet: 'sap' | 'rut' | null; trang?: boolean; trangBan?: boolean;
  /** D521 — độ lệch giá do cú THANH LÝ đang đè ở từng tick (âm = bán cưỡng bức đè xuống). Chỉ màn `thac_v2`; khớp tính trượt lệnh vào ngược dòng. */
  thac?: number[];
  /** D523 — giá trị NỀN của nến (đích của kịch bản, chưa nhiễu/râu/đám đông) — ĐƯỜNG GIÁ TRỊ của Bắt Đáy (đã trễ, ở `soiGiaTri`). */
  gt?: number;
  /** D523 — nến là cao trào cuối một sóng GIẢM của hình (nhãn QUÁ BÁN đúng) · nến đỏ do tin thật (nhãn nhầm). */
  ctx?: boolean; tinDo?: boolean;
}
/** Một cú đẩy của tin THẬT: ở nến `ci` (đơn vị nến mịn), chiều ±1, độ lớn (đơn vị hình). */
export interface CuDay { ci: number; huong: number; mag: number }

export interface DauVaoDong {
  seed: number; ma: string; hinh: HinhMinigame; bien: number; nghieng: number; nhieuX: number;
  dai: DaiCang; q: number; troi: readonly CuDay[];
  nhip?: boolean; rutChan?: boolean; quetEp?: number;
  /** D468 — vắng = `thuong`. */
  cheDo?: CheDo;
  /** D470 — nấc thanh khoản của VÒNG (engine `nacHieuDung`); vắng = nấc nền của mã ⇒ r = 1, dòng như trước. */
  nac?: NacThanhKhoan;
}

const HO_THANG: ReadonlySet<string> = new Set([...HO_HINH.giam!.thang!, ...HO_HINH.tang!.thang!]);

/**
 * D479 (founder 04/10, demo bản 27 `nghiengVeDich`) — NEO điểm cuối đường giá vào % engine của mã ở vòng: nhân từng mốc giá của phần CHẠY với
 * r^f (f = tiến độ trong màn 0 → 1) cho giá đóng cuối / giá mở màn = 1 + bp/10⁴. Dáng hình (đỉnh, đáy, cú quét) giữ, cả đường nghiêng dần về
 * đúng đích; 20 nến lịch sử không đổi. Sửa TẠI CHỖ. THUẦN.
 */
export function neoVeDich(min: NenMin[], bp: number): void {
  const n0 = NEN_LS * K_MIN, chay = min.length - n0, g0 = min[n0 - 1]!.c, cuoi = min[min.length - 1]!.c;
  if (!(chay > 0) || !(cuoi > 0)) return;
  const r = (g0 * (1 + bp / 10000)) / cuoi, m = (f: number) => Math.pow(r, f);
  for (let j = 0; j < chay; j++) {
    const c = min[n0 + j]!, fa = j / chay, fb = (j + 1) / chay, so = c.tick.length;
    c.tick = c.tick.map((x, t) => x * m((j + (t + 1) / so) / chay));
    c.o *= m(fa);
    c.c = c.tick[so - 1]!;
    if (c.gt !== undefined) c.gt *= m(fb);   // D523 — giá trị nền nghiêng CÙNG nến
    c.h = Math.max(c.h * m((fa + fb) / 2), c.o, c.c, ...c.tick);
    c.l = Math.min(c.l * m((fa + fb) / 2), c.o, c.c, ...c.tick);
  }
}

/**
 * D560 phần 2 — HÌNH ĐI NGANG theo tính chất (`HINH_NGANG`): biến đổi giá trong không gian log quanh ĐƯỜNG NỐI giá mở → giá đóng cuối của phần
 * chạy (x' = đường · (x / đường)^k), nên hai đầu giữ nguyên và % engine (neo D479) không đổi. Rồi khối lượng theo chiều cây, rồi bẫy. Sửa TẠI
 * CHỖ, THUẦN theo seed màn. Trả chỉ số nến mịn (trong phần chạy) của cây bẫy, hoặc null.
 */
export function apTinhChatNgang(min: NenMin[], seed: number, tc: 'tich_luy' | 'phan_phoi'): { bay: number | null } {
  const n0 = NEN_LS * K_MIN, N = min.length - n0;
  if (!(N > 4)) return { bay: null };
  const P0 = min[n0 - 1]!.c, P1 = min[min.length - 1]!.c;
  if (!(P0 > 0) || !(P1 > 0)) return { bay: null };
  const TL = HINH_NGANG.TICH_LUY, PP = HINH_NGANG.PHAN_PHOI;
  const k = tc === 'tich_luy' ? TL.NEN : PP.GIAN;
  const duong = (f: number) => P0 * Math.pow(P1 / P0, f);
  const bien = (x: number, f: number) => { const d = duong(f); return d * Math.pow(x / d, k); };
  // Trần phần kéo râu (phân phối) = thân nến TB của màn — cú quét sẵn có của hình không bị nhân dài thêm (đo: một râu −12 % ép bẹp cả màn).
  const thanTb = min.slice(n0).reduce((a, x) => a + Math.abs(x.c - x.o), 0) / N;
  for (let j = 0; j < N; j++) {
    const c = min[n0 + j]!, so = c.tick.length, fa = j / N, fm = (j + 0.5) / N;
    c.tick = c.tick.map((x, t) => bien(x, (j + (t + 1) / so) / N));
    c.o = bien(c.o, fa);
    c.c = c.tick[so - 1]!;
    let h = bien(c.h, fm), l = bien(c.l, fm);
    if (tc === 'phan_phoi') {
      const tren = Math.max(c.o, c.c), duoi = Math.min(c.o, c.c);
      h += Math.min(Math.max(0, h - tren) * PP.RAU, thanTb); l -= Math.min(Math.max(0, duoi - l) * PP.RAU, thanTb);
    }
    c.h = Math.max(h, c.o, c.c, ...c.tick);
    c.l = Math.max(1e-9, Math.min(l, c.o, c.c, ...c.tick));
    if (tc === 'tich_luy') { if (j >= N / 2) c.v *= TL.KL_CAN; if (c.c > c.o) c.v *= TL.KL_TANG; }
    else { c.v *= PP.KL; if (c.c < c.o) c.v *= PP.KL_GIAM; }
  }
  // Bẫy: một cây trong khúc giữa-sau màn, râu xuyên qua mép dải đã chạy rồi giá quay về (giá đóng của cây KHÔNG đổi ⇒ cây kế liền mạch).
  const r = rngMinigame(seed ^ 0x5b1e);
  if (!(r() * 10000 < HINH_NGANG.BAY_BP)) return { bay: null };
  // Cây GẦN MÉP DẢI nhất trong khúc (Spring: đáy cây gần đáy dải đã chạy · Upthrust: đỉnh cây gần đỉnh dải) — cú chọc thủng mép, không phải cú rơi
  // từ đỉnh xuống. Hoà ⇒ cây sớm hơn. `r()` đã tiêu cho xác suất; không rút thêm.
  const tu = Math.max(1, Math.floor(N * HINH_NGANG.BAY_TU)), den = Math.max(tu, Math.floor(N * HINH_NGANG.BAY_DEN));
  let j = tu, tot = Infinity;
  for (let k = tu; k <= den && k < N; k++) {
    const tr = min.slice(n0, n0 + k), x = min[n0 + k]!;
    const kc = tc === 'tich_luy' ? x.l - Math.min(...tr.map((y) => y.l)) : Math.max(...tr.map((y) => y.h)) - x.h;
    if (kc < tot) { tot = kc; j = k; }
  }
  const truoc = min.slice(n0, n0 + j), c = min[n0 + j];
  if (!truoc.length || !c) return { bay: null };
  const day = Math.min(...truoc.map((x) => x.l)), dinh = Math.max(...truoc.map((x) => x.h)), rong = Math.max(dinh - day, P0 * 0.004);
  const so = c.tick.length, giua = Math.max(1, Math.floor(so / 2) - 1);
  if (tc === 'tich_luy') {
    const muc = day - rong * HINH_NGANG.BAY_SAU;   // SPRING
    c.tick = c.tick.map((x, t) => (t === giua ? muc : t === giua + 1 ? (muc + x) / 2 : x));
    c.l = Math.min(c.l, muc);
  } else {
    const muc = dinh + rong * HINH_NGANG.BAY_SAU;   // UPTHRUST
    c.tick = c.tick.map((x, t) => (t === giua ? muc : t === giua + 1 ? (muc + x) / 2 : x));
    c.h = Math.max(c.h, muc);
  }
  c.c = c.tick[so - 1]!;
  c.v *= HINH_NGANG.BAY_KL;
  return { bay: j };
}

/**
 * D561 — màn ĐÃ VÀO GIÁ: đường đã neo về phần giá GỐC của tin (đi theo tin) ⇒ lật phần sau ĐẦU GỐI (`VAO_GIA.KNEE_MIN`) quanh giá ở đầu gối
 * với hệ số r sao cho giá đóng cuối = đích `bp` (đã đảo, đúng % engine), rồi neo lại cho đúng từng số lẻ. Giá mở + phần trước đầu gối giữ.
 * Sửa TẠI CHỖ, THUẦN.
 */
export function quayDauVaoGia(min: NenMin[], bp: number, goc: number): void {
  const n0 = NEN_LS * K_MIN, iK = n0 + VAO_GIA.KNEE_MIN;
  if (iK >= min.length - 1) { neoVeDich(min, bp); return; }
  const g0 = min[n0 - 1]!.c, dich = g0 * (1 + bp / 10000);
  // Trước đầu gối giá phải ĐI THEO TIN (hình bốc theo lá có khi mở bằng nhịp ngược): nghiêng dần đoạn [mở → đầu gối] cho tới đầu gối đã đi
  // `TRUOC_GOI_BP` phần gốc theo chiều tin; phần sau đầu gối dời cùng hệ số (liền mạch). Rồi mới lật.
  const muon = g0 * (1 + (Math.sign(goc) * Math.max((Math.abs(goc) * VAO_GIA.TRUOC_GOI_BP) / 10000, VAO_GIA.TRUOC_GOI_SAN_BP)) / 10000);
  const he = muon / min[iK]!.o;
  if (Math.sign(goc) !== 0 && Math.abs(he - 1) > 1e-12) {
    const m = (f: number) => Math.pow(he, Math.min(1, Math.max(0, f)));
    for (let i = n0; i < min.length; i++) {
      const c = min[i]!, fa = (i - n0) / VAO_GIA.KNEE_MIN, so = c.tick.length;
      c.tick = c.tick.map((x, t) => x * m(fa + (t + 1) / so / VAO_GIA.KNEE_MIN));
      c.o *= m(fa); c.c = c.tick[so - 1]!;
      c.h = Math.max(c.h * m(fa + 0.5 / VAO_GIA.KNEE_MIN), c.o, c.c, ...c.tick); c.l = Math.min(c.l * m(fa + 0.5 / VAO_GIA.KNEE_MIN), c.o, c.c, ...c.tick);
      if (c.gt !== undefined) c.gt *= m(fa + 1 / VAO_GIA.KNEE_MIN);
    }
  }
  const xK = min[iK]!.o, cuoi = min[min.length - 1]!.c;
  const r = Math.abs(cuoi - xK) > 1e-9 ? (xK - dich) / (cuoi - xK) : 0;
  // Lật gương chỉ khi hệ số hợp lý (đoạn sau đầu gối có chuyển động rõ); không thì chỉ nghiêng (bước dưới) — đo: hình "parabol sập" có đoạn sau
  // đầu gối gần ngang ⇒ r ≈ 39, kẹp 3 rồi neo TOÀN ĐƯỜNG xoá mất pha đi theo tin.
  if (r >= 0.3 && r <= 3) {
    const rr = r, f = (x: number) => Math.max(1e-6, xK - rr * (x - xK));
    for (let i = iK; i < min.length; i++) {
      const c = min[i]!, h = c.h, l = c.l;
      c.tick = c.tick.map(f);
      if (i > iK) c.o = f(c.o);
      c.c = c.tick[c.tick.length - 1]!;
      c.h = Math.max(f(l), c.o, c.c, ...c.tick); c.l = Math.min(f(h), c.o, c.c, ...c.tick);
      if (c.gt !== undefined) c.gt = f(c.gt);
    }
  }
  // Khớp đích bằng cú nghiêng NEO Ở ĐẦU GỐI: đoạn trước đầu gối (pha đi theo tin) giữ nguyên, giá đóng cuối = đích từng số lẻ.
  const N = min.length - iK, R = dich / min[min.length - 1]!.c, m = (f: number) => Math.pow(R, Math.min(1, Math.max(0, f)));
  for (let i = iK; i < min.length; i++) {
    const c = min[i]!, fa = (i - iK) / N, so = c.tick.length;
    c.tick = c.tick.map((x, t) => x * m(fa + (t + 1) / so / N));
    if (i > iK) c.o *= m(fa);
    c.c = c.tick[so - 1]!;
    c.h = Math.max(c.h * m(fa + 0.5 / N), c.o, c.c, ...c.tick); c.l = Math.min(c.l * m(fa + 0.5 / N), c.o, c.c, ...c.tick);
    if (c.gt !== undefined) c.gt *= m(fa + 1 / N);
  }
}

/**
 * D561 — DẤU HIỆU "đã vào giá" (founder 08/10: khối lượng cạn + nến rút chân, không nhãn): khối lượng `KL_CAN_NEN` cây trước đầu gối × `KL_CAN`,
 * cây đầu gối mang râu ngược chiều đoạn vừa chạy (rút chân) dài `RUT` × biên cây, khối lượng × `KL_RUT`. Màn đã vào giá hiện với xác suất
 * `DAU_HIEU_BP`, màn tin thường hiện NHẦM `NHAM_BP`. Giá đóng mỗi cây giữ ⇒ đường liền mạch, % không đổi. Trả có hiện không. THUẦN theo seed màn.
 */
export function dauHieuVaoGia(min: NenMin[], seed: number, loai: 'dao' | 'thuong'): boolean {
  const n0 = NEN_LS * K_MIN, iK = n0 + VAO_GIA.KNEE_MIN, c = min[iK];
  if (!c) return false;
  const r = rngMinigame(seed ^ 0x7a6e);
  if (!(r() * 10000 < (loai === 'dao' ? VAO_GIA.DAU_HIEU_BP : VAO_GIA.NHAM_BP))) return false;
  for (let i = Math.max(n0, iK - VAO_GIA.KL_CAN_NEN); i < iK; i++) min[i]!.v *= VAO_GIA.KL_CAN;
  const g0 = min[n0 - 1]!.c, chieu = c.o >= g0 ? 1 : -1;   // đoạn trước đầu gối chạy lên ⇒ râu TRÊN (đẩy lên rồi bị bán) · chạy xuống ⇒ râu DƯỚI
  const rr = Math.max(c.h - c.l, Math.abs(c.c - c.o), c.o * 0.004), so = c.tick.length, giua = Math.max(1, Math.floor(so / 2) - 1);
  const muc = chieu === 1 ? Math.max(c.o, c.c) + VAO_GIA.RUT * rr : Math.max(1e-6, Math.min(c.o, c.c) - VAO_GIA.RUT * rr);
  c.tick = c.tick.map((x, t) => (t === giua ? muc : t === giua + 1 ? (muc + x) / 2 : x));
  c.c = c.tick[so - 1]!;
  c.h = Math.max(c.h, ...c.tick); c.l = Math.min(c.l, ...c.tick);
  c.v *= VAO_GIA.KL_RUT;
  return true;
}

/** D523 — lớp soi Bắt Đáy (màn `gia_tri`): điểm ĐƯỜNG GIÁ TRỊ theo nến hiện `j` (đã trễ + sai số) · độ rộng dải dưới (tỷ lệ) · nến hiện có nhãn QUÁ BÁN. */
export interface SoiGiaTri { diem: { j: number; g: number }[]; rong: number; quaBan: number[] }

/**
 * D523 — ĐƯỜNG GIÁ TRỊ + QUÁ BÁN ở nhịp k (demo bản 46 `giaTriTai` · `quaBanCua`). Nến hiện = `NHIP_MOI_NEN_GOP` nhịp (Nóng Vội: nến mịn). Điểm ở nến j đọc
 * `gt` của nến j − TRE (đường TRỄ ⇒ không biết trước cú sập/gap/tin mạnh — "phi logic" ở cực đoan, founder) × (1 ± SAI); chỉ nến j ≤ nến đang chạy.
 * Nhãn QUÁ BÁN chỉ ở nến ĐÃ đóng. THUẦN, tất định theo seed màn — không lộ tương lai: mọi số đọc nến ≤ nến đang chạy.
 */
export function soiGiaTri(min: readonly NenMin[], k: number, p: { seed: number; ma: string; cheDo?: CheDo; nongVoi?: boolean }): SoiGiaTri {
  const chay = min.slice(NEN_LS * K_MIN), cd = p.cheDo === 'cuc_doan', G = GIA_TRI;
  const nhipNen = p.nongVoi ? NHIP_MOI_NEN : NHIP_MOI_NEN_GOP, moi = nhipNen / NHIP_MOI_NEN, jNay = Math.floor(k / nhipNen), tre = cd ? G.TRE_CD : G.TRE;
  const diem: { j: number; g: number }[] = [];
  for (let j = tre; j <= jNay; j++) {
    const c = chay[(j - tre) * moi + moi - 1];
    if (c?.gt === undefined) continue;
    diem.push({ j, g: c.gt * (1 + (rngMinigame(p.seed ^ 0x6a7 ^ Math.imul(j + 1, 0x27d4eb2d))() - 0.5) * 2 * G.SAI) });
  }
  const m = MA_MINIGAME[p.ma]!, amp = cd && m.cd ? m.cd.amp : m.amp;
  const quaBan: number[] = [];
  for (let j = 0; j < jNay; j++) {
    const ds = chay.slice(j * moi, j * moi + moi), u = rngMinigame(p.seed ^ 0x9b1 ^ Math.imul(j + 1, 0x165667b1))();
    // Nhãn NHẦM (như chỉ báo quá bán ngoài đời — hay báo sai trong xu hướng giảm): nến đỏ do tin, hoặc nến đỏ đóng ĐÁY MỚI so với 3 nến hiện trước.
    const dong = (jj: number) => chay[jj * moi + moi - 1]?.c ?? Infinity, c = dong(j), o = chay[j * moi]!.o;
    const dayMoi = j >= 3 && c < o && c < Math.min(dong(j - 1), dong(j - 2), dong(j - 3));
    if (ds.some((x) => x.ctx) ? u < G.QB_DUNG : ds.some((x) => x.tinDo) || dayMoi ? u < G.QB_NHAM : false) quaBan.push(j);
  }
  return { diem, rong: G.DAI * amp * (cd ? G.DAI_CD : 1), quaBan };
}

/**
 * D483 (demo `gaiTin` + `lechLuc` nhánh `tam`) — TIN GIẢ ĐỘI LÁI GÀI ở đầu màn: đám đông nhảy theo đẩy giá TẠM rồi tan HẾT. Cú đẩy bắt đầu ở nến mịn
 * chạy `ci + 0,5k` (ci = (8 + ⌊rng(seed ^ 0x6a1) × 8⌋) × k — rơi vào nửa đầu màn), dâng đủ trong 2k nến, tan trong 4k nến kế; độ lớn
 * `chieu × GAI_MAG × liq` (liq = thanh khoản hiệu dụng của mã: mã mỏng nhảy mạnh). Tan hết trước cuối màn ⇒ giá đầu / giá cuối không đổi (neo D479
 * giữ). Nhân từng mốc giá của phần CHẠY. Sửa TẠI CHỖ, trả nến bắt đầu. THUẦN.
 */
export function apXungGai(min: NenMin[], seed: number, chieu: 1 | -1, liq: number): number {
  const x = xungGai(seed, chieu, liq);
  apLech(min, (s) => lechTl([x], s));
  return x.ci;
}

/** D536 — cú đẩy của tin gài (`apXungGai`) ở dạng MỘT cú: nhãn LỆNH LỚN + khối lượng đọc cùng số (một công thức). Tan HẾT (`con` vắng). */
export function xungGai(seed: number, chieu: 1 | -1, liq: number): XungTl & { ci: number } {
  const k = K_MIN, ci = (8 + Math.floor(rngMinigame(seed ^ 0x6a1)() * 8)) * k;
  return { ci, t0: ci + 0.5 * k, mag: chieu * GAI_MAG * liq, trai: 2 * k, tan: 4 * k };
}

/** D536 — một cú LỆNH LỚN của bot vai lớn cùng mã (`LENH_LON_BOT`) hoặc tin gài: cú + ai đặt. */
export type XungLon = XungTl & { ai: 'ca_map' | 'doi_lai' | 'gai' };

/**
 * D536 — các cú LỆNH LỚN của bot vai lớn cùng mã (demo `datBot` nhánh `cungMap` ca_map / doi_lai), đơn vị nến mịn chạy. CÁ MẬP đọc ĐÁY của đường
 * GỐC (`min` chưa áp cú nào — demo đọc `G.nen`). Thứ tự cố định ca_map → doi_lai (cả hai có thể cùng có). THUẦN.
 */
export function xungLenhLon(min: readonly NenMin[], seed: number, ai: readonly ('ca_map' | 'doi_lai')[]): XungLon[] {
  const k = K_MIN, L = LENH_LON_BOT, nenSong = SO_NHIP / NHIP_MOI_NEN, tan = L.TAN * k, con = L.O_LAI, ra: XungLon[] = [];
  if (ai.includes('ca_map')) {
    const C = L.CA_MAP, kk = min.slice(NEN_LS * K_MIN), day = Math.min(...kk.map((c) => c.l)), iDay = kk.findIndex((c) => c.l === day);
    ra.push({ ai: 'ca_map', t0: Math.min(nenSong - C.SAT_CUOI, iDay + k), mag: C.KEO, trai: C.KEO_TRAI * k, tan, con },
      { ai: 'ca_map', t0: nenSong - C.XA_TRUOC_CUOI * k, mag: C.XA, trai: C.XA_TRAI * k, tan, con });
  }
  if (ai.includes('doi_lai')) {
    const D = L.DOI_LAI, t0 = keoDoiLaiT0(seed);
    ra.push({ ai: 'doi_lai', t0, mag: D.KEO, trai: D.KEO_TRAI * k, tan, con }, { ai: 'doi_lai', t0: t0 + D.XA_SAU * k, mag: D.XA, trai: D.XA_TRAI * k, tan, con });
  }
  return ra;
}

/** D536 — nến mịn bắt đầu cú KÉO của bot Đội Lái (demo `rng(G.seed ^ 0x2222)`): một nguồn cho cú đẩy và tin gài của nó (`tinBotDoiLai`). */
export function keoDoiLaiT0(seed: number): number {
  const D = LENH_LON_BOT.DOI_LAI;
  return (D.TU + Math.floor(rngMinigame(seed ^ 0x2222)() * D.THEM)) * K_MIN;
}

/** D536 — áp các cú LỆNH LỚN lên phần CHẠY (cú ở lại `con` — demo `lechLuc` nhánh không-tạm). Sửa TẠI CHỖ. THUẦN. */
export function apLenhLon(min: NenMin[], xung: readonly XungLon[]): void {
  if (xung.length) apLech(min, (s) => lechTl(xung, s));
}

/**
 * D536 — KHỐI LƯỢNG từng nến mịn CHẠY (demo `c.v + volXung(j)`): khối lượng nền của nến + |mag| × `LENH_LON_BOT.VOL` / số nến mịn trải của MỌI cú đè
 * lên nến đó (thanh lý · bầy · lệnh lớn · tin gài · cú tự đẩy của chính ghế). Chỉ hiển thị — không vào khớp, không vào tiền. THUẦN.
 */
export function khoiLuongChay(min: readonly NenMin[], xung: readonly { t0: number; mag: number; trai: number }[]): number[] {
  return min.slice(NEN_LS * K_MIN).map((c, j) => c.v + xung.reduce((a, x) =>
    a + (j >= Math.floor(x.t0) && j <= Math.floor(x.t0 + Math.max(0, x.trai - 0.01)) ? (Math.abs(x.mag) * LENH_LON_BOT.VOL) / Math.max(1, Math.ceil(x.trai)) : 0), 0));
}

/** Áp độ lệch giá `lech(s)` (s = nến mịn chạy, số thực) lên phần CHẠY: từng mốc giá, giá mở, râu. Một cách áp cho tin gài + lệnh lớn. Sửa TẠI CHỖ. */
function apLech(min: NenMin[], lech: (s: number) => number): void {
  const n0 = NEN_LS * K_MIN;
  for (let j = 0; j < min.length - n0; j++) {
    const c = min[n0 + j]!, so = c.tick.length;
    c.tick = c.tick.map((x, t) => x * (1 + lech(j + (t + 1) / so)));
    c.o *= 1 + lech(j);
    c.c = c.tick[so - 1]!;
    c.h = Math.max(c.h * (1 + lech(j + 0.5)), c.o, c.c, ...c.tick);
    c.l = Math.min(c.l * (1 + lech(j + 0.5)), c.o, c.c, ...c.tick);
  }
}

/** D494 — một vị thế đòn bẩy của đám đông trên mã chính: vào ở nến mịn `vao` (giá lúc đó = giá vào), tiền theo bội vốn chuẩn. */
/** D512 — `chieu`: 1 phe VAY MUA (giá rơi tới sàn ⇒ bán cưỡng bức) · −1 phe BÁN KHỐNG (giá lên tới ngưỡng ⇒ mua cưỡng bức). `nen` = đám đông nền. */
export interface BotDonBay { ai: 'ca_map' | 'dam_dong' | 'nen'; chieu?: 1 | -1; L: number; tien: number; vao: number }   // vắng = 1 (đám đông D494)
/** D494 — một cú bán cưỡng bức: lúc `t0` (nến mịn), độ đẩy `mag`, trải `trai`, tan trong `tan` (nến mịn). */
export interface XungTl { t0: number; mag: number; trai: number; tan: number; /** D521 — phần ở lại tới hết màn (0 = tan hết). */ con?: number }
export interface SuKienTl { nhip: number; ai: BotDonBay['ai']; L: number; mag: number }
/** D517 — một cú vào của BẦY CÁ NHÂN: nhịp (cuối nến hiện thứ CHUOI của chuỗi) · cỡ bầy · cú đẩy (dấu = chiều). */
export interface SuKienBay { nhip: number; n: number; mag: number }
/** D513 — trạng thái một vị thế đám đông trên dòng nhịp (lớp soi): nhịp mở `i0` + giá vào `p0` (vắng = chưa mở cả màn) · nhịp bị xử lý `iChet` · cỡ cú đẩy nếu bị xử lý. */
export interface VtDamDong { chieu: 1 | -1; L: number; tien: number; p0?: number; i0?: number; iChet: number | null; mag: number }
/** D513 — lớp soi của một lõi ở nhịp k: mức xử lý từng vị thế (Bán Khống: sàn phe mua · Mua Đuổi: mức ép phe khống) hoặc đáy thác (Bắt Đáy). */
export type SoiLo = { muc: { gia: number; L: number; tien: number; vao: number }[] } | { thac: { ngoi: number; day: number; n: number; tu?: number; den?: number } | null }
  | { gt: SoiGiaTri };

/**
 * D513 — LỚP SOI ở nhịp k (giá đang lộ `g`): CHỈ vị thế đã mở (i0 ≤ k) và còn sống (chưa bị xử lý tới k) — không lộ vị thế tương lai, không lộ cú xử lý chưa
 * tới. Bán Khống ⇒ sàn thanh lý phe MUA · Mua Đuổi ⇒ mức ép phe KHỐNG · Bắt Đáy ⇒ ĐÁY THÁC (châm sàn cao nhất dưới giá, mỗi cú bán cưỡng bức đẩy giá theo `mag`,
 * chạm sàn kế thì đổ tiếp — demo bản 41 `dayThac`). Lõi khác ⇒ null. THUẦN.
 */
export function soiTai(vt: readonly VtDamDong[], k: number, g: number, la: string | null,
  /** D521 — màn `thac_v2`: cỡ cú thật ngẫu nhiên ⇒ báo KHOẢNG (phân vị SOI_TU–SOI_DEN của SOI_SO lần rút cỡ) thay vì một con số. Hạt RIÊNG, không phải hạt cú thật. */
  mapMo?: { hat: number },
): SoiLo | null {
  const song = (ch: 1 | -1) => vt.filter((b) => b.chieu === ch && b.p0 !== undefined && b.i0 !== undefined && b.i0 <= k && (b.iChet === null || b.iChet > k));
  const muc = (b: VtDamDong) => b.p0! * (1 - (b.chieu * (1 - KY_QUY.THANH_LY)) / b.L);
  if (la === 'ban_khong' || la === 'mua_duoi') {
    return { muc: song(la === 'ban_khong' ? 1 : -1).map((b) => ({ gia: muc(b), L: b.L, tien: b.tien, vao: b.i0! })) };
  }
  if (la !== 'bat_day') return null;
  const ds = song(1).map((b) => ({ m: muc(b), mag: b.mag })).filter((x) => x.m < g).sort((a, b) => b.m - a.m);
  if (!ds.length) return { thac: null };
  const chuoi = (he: (j: number) => number) => {
    let cur = ds[0]!.m, n = 0;
    for (const [j, x] of ds.entries()) { if (x.m < cur) break; cur *= 1 + x.mag * he(j); n += 1; }
    return { cur, n };
  };
  const giua = chuoi(() => 1);
  if (!mapMo) return { thac: { ngoi: ds[0]!.m, day: giua.cur, n: giua.n } };
  // D521 — "mập mờ hơn chứ ko phải lừa xác suất": rút cỡ từng cú theo ĐÚNG phân bố cú thật, báo phân vị ⇒ khoảng chứa đáy (chỉ phần cú thác) đúng tỷ lệ.
  const r = rngMinigame(mapMo.hat ^ 0x50a1 ^ Math.imul(k + 1, 0x9e3779b1)), T = TL_DAY;
  const day = Array.from({ length: T.SOI_SO }, () => chuoi(() => T.CO_TU + r() * (T.CO_DEN - T.CO_TU)).cur).sort((a, b) => a - b);
  const q = (f: number) => day[Math.min(day.length - 1, Math.floor(f * day.length))]!;
  return { thac: { ngoi: ds[0]!.m, day: giua.cur, n: giua.n, tu: q(1 - T.SOI_TU), den: q(1 - T.SOI_DEN) } };
}

/** Độ lệch giá TẠM (tỷ lệ) ở thời điểm `s` (nến mịn) do các cú bán cưỡng bức (demo `lechLuc` nhánh `tam` — tan HẾT). */
export function lechTl(xung: readonly XungTl[], s: number): number {
  let off = 0;
  for (const x of xung) {
    if (s < x.t0) continue;
    const tan = Math.max(0, 1 - Math.max(0, s - x.t0 - x.trai) / x.tan), con = x.con ?? 0;
    off += x.mag * Math.min(1, (s - x.t0) / x.trai) * (con + (1 - con) * tan);
  }
  return off;
}

/**
 * D494 — đám đông đòn bẩy của màn (demo `datBot`, nhánh cùng map Đòn Bẩy): cá mập ×4 + 3–5 người ×10/×5 xen kẽ. THUẦN theo seed; thứ tự rút số
 * y demo (số người → giờ vào cá mập → giờ vào từng người).
 */
export function damDongDonBay(seed: number): BotDonBay[] {
  const r = rngMinigame(seed ^ 0x7d1), k = K_MIN, C = DAY_CHUYEN.CA_MAP, D = DAY_CHUYEN.DAM_DONG;
  const n = D.SO_TU + Math.floor(r() * D.SO_THEM);
  return [{ ai: 'ca_map', chieu: 1, L: C.L, tien: C.TIEN, vao: (C.VAO_TU + Math.floor(r() * C.VAO_THEM)) * k },
    ...Array.from({ length: n }, (_, i): BotDonBay => ({ ai: 'dam_dong', chieu: 1, L: D.L[i % 2]!, tien: D.TIEN, vao: (D.VAO_TU + D.VAO_BUOC * i + Math.floor(r() * D.VAO_THEM)) * k }))];
}

/** D512 — đám đông BÁN KHỐNG cùng map (ghế khác cầm lõi Bán Khống giữ mã này): GƯƠNG của `damDongDonBay` (hạt riêng — demo `datBot` nhánh ban_khong). */
export function damDongKhong(seed: number): BotDonBay[] {
  const r = rngMinigame(seed ^ 0x6b1), k = K_MIN, C = DAY_CHUYEN.CA_MAP, D = DAY_CHUYEN.DAM_DONG;
  const n = D.SO_TU + Math.floor(r() * D.SO_THEM);
  return [{ ai: 'ca_map', chieu: -1, L: C.L, tien: C.TIEN, vao: (C.VAO_TU + Math.floor(r() * C.VAO_THEM)) * k },
    ...Array.from({ length: n }, (_, i): BotDonBay => ({ ai: 'dam_dong', chieu: -1, L: D.L[i % 2]!, tien: D.TIEN, vao: (D.VAO_TU + D.VAO_BUOC * i + Math.floor(r() * D.VAO_THEM)) * k }))];
}

/**
 * D512 — ĐÁM ĐÔNG NỀN của màn (luôn có): số người theo hướng ô `o` (`DAM_DONG_NEN.SO`). THUẦN theo seed — demo bản 41 `datBot`.
 * D518 — `bb` (bong bóng): thêm `DAM_DONG_NEN.BONG_BONG` người, vào XEN GIỮA người thường (lệch 2 nến hiện); rút số SAU người thường ⇒ người thường y hệt.
 */
export function damDongNen(seed: number, o: string, bb = false,
  /** D574 — bối cảnh Bẫy giá trị: số người mỗi phe gấp đôi (cùng luật vào lệnh, nối tiếp chỉ số). Vắng ⇒ đám đông cũ byte-hệt. */
  x2 = false,
): BotDonBay[] {
  const r = rngMinigame(seed ^ 0x6e6e), k = K_MIN, N = DAM_DONG_NEN, [nMua0, nBan0] = o === 'tang' ? N.SO.tang : o === 'giam' ? N.SO.giam : N.SO.khac;
  const nMua = x2 ? 2 * nMua0 : nMua0, nBan = x2 ? 2 * nBan0 : nBan0;
  const mot = (chieu: 1 | -1, i: number, tre: number): BotDonBay => ({ ai: 'nen', chieu, L: N.L[i % 2]!, tien: N.TIEN, vao: (N.VAO_TU + tre + N.VAO_BUOC * i + Math.floor(r() * N.VAO_THEM)) * k });
  const thuong = [...Array.from({ length: nMua }, (_, i) => mot(1, i, 0)), ...Array.from({ length: nBan }, (_, i) => mot(-1, i, 1))];
  if (!bb) return thuong;
  const them = (chieu: 1 | -1, n: number, i0: number) => Array.from({ length: n }, (_, j): BotDonBay =>
    ({ ai: 'nen', chieu, L: N.L[(i0 + j) % 2]!, tien: N.TIEN, vao: (N.VAO_TU + 2 + N.VAO_BUOC * j + Math.floor(r() * N.VAO_THEM)) * k }));
  return [...thuong, ...them(1, N.BONG_BONG[0], nMua), ...them(-1, N.BONG_BONG[1], nBan)];
}

/**
 * D494 — THANH LÝ DÂY CHUYỀN trên dãy giá `P` (480 nhịp): chạy THEO NHỊP, giá = P × (1 + lệch của các cú đã bán TRƯỚC đó); bot vào ở nhịp đầu tiên
 * qua `vao`, chạm giá ≤ giá vào × (1 − 0,9/L) (cùng luật ký quỹ D492) ⇒ bán cưỡng bức ⇒ cú đẩy làm bot kế chạm ngưỡng ⇒ dây chuyền. Cú bán phải tan hết
 * trước mốc cuối trừ `BIEN_CUOI` (để mã đi sau trên bảng phụ cũng tan) — không kịp thì phiên đã đóng, không bán. Trả lệch từng nhịp + cú + sự kiện.
 */
export function dayChuyen(P: readonly number[], bots: readonly BotDonBay[], liq: number,
  /** D512 — lệch giá do cú TỰ ĐẨY của người chơi ở nhịp i (vai lớn): đám đông xét ngưỡng trên giá ĐÃ bị đẩy ⇒ lệnh của người CHÂM NGÒI được dây chuyền. */
  lechNguoi?: (i: number) => number,
  /** D517 — BẦY CÁ NHÂN của màn (`BoiCanhMan.bay`). Vắng = không bầy (màn trước D517 dựng y cũ). */
  bay?: { n: number },
  /** D521 — màn `thac_v2` (hạt = seed màn): cú thanh lý cỡ ngẫu nhiên + để lại `CON_LAI`. Vắng = cỡ cố định, tan hết (màn trước D521). */
  thac?: { hat: number },
): { lech: number[]; xung: XungTl[]; suKien: SuKienTl[]; vt: VtDamDong[]; bay: SuKienBay[]; xungTl: XungTl[] } {
  const k = K_MIN, ketThuc = SO_NHIP / NHIP_MOI_NEN - TL_DAY.BIEN_CUOI * k;
  const xung: XungTl[] = [], suKien: SuKienTl[] = [], lech: number[] = [], suBay: SuKienBay[] = [], xungTl: XungTl[] = [];
  // D517 — nến HIỆN = k nến mịn; chuỗi: + đếm nến xanh liền, − nến đỏ liền, nến đứng yên xoá chuỗi.
  const NH = k * NHIP_MOI_NEN, xungBay: XungTl[] = [];
  let gMo = 0, chuoi = 0;
  const st = bots.map((b) => ({ ...b, p0: undefined as number | undefined, i0: undefined as number | undefined, iChet: null as number | null, chet: false }));
  /** D513 — cỡ cú đẩy nếu vị thế bị xử lý (cùng công thức với cú thật bên dưới). */
  const magCua = (b: BotDonBay) => -(b.chieu ?? 1) * TL_DAY.MAG * liq * Math.min(TL_DAY.TRAN, (b.tien * b.L) / TL_DAY.CHUAN);
  for (let i = 0; i < P.length; i++) {
    const s = (i + 1) / NHIP_MOI_NEN, off = lechTl(xung, s), g = P[i]! * (1 + (lechNguoi?.(i) ?? 0)) * (1 + off);
    lech.push(off);
    for (const b of st) {
      if (b.chet) continue;
      if (b.p0 === undefined) { if (s >= b.vao) { b.p0 = g; b.i0 = i; } continue; }
      // D512 — phe mua: giá ≤ p0(1 − 0,9/L) ⇒ bán cưỡng bức · phe khống: giá ≥ p0(1 + 0,9/L) ⇒ mua cưỡng bức.
      const ch = b.chieu ?? 1, nguong = b.p0 * (1 - (ch * (1 - KY_QUY.THANH_LY)) / b.L);
      if (ch === 1 ? g > nguong : g < nguong) continue;
      b.chet = true; b.iChet = i;
      const tan = Math.min(TL_DAY.TAN * k, ketThuc - s - k);
      if (tan <= 0) continue;   // sát cuối màn: phiên đã đóng, không còn ai khớp lệnh bán
      // D521 — cỡ thật = cỡ danh nghĩa × hệ số ngẫu nhiên (hạt riêng mỗi vị thế — lớp soi không biết) · để lại CON_LAI tới hết màn.
      const he = thac ? TL_DAY.CO_TU + rngMinigame(thac.hat ^ 0x7c3 ^ Math.imul(st.indexOf(b) + 1, 0x85ebca6b))() * (TL_DAY.CO_DEN - TL_DAY.CO_TU) : 1;
      const mag = magCua(b) * he, x: XungTl = { t0: s, mag, trai: k, tan, ...(thac ? { con: TL_DAY.CON_LAI } : {}) };
      xung.push(x); xungTl.push(x);
      suKien.push({ nhip: i, ai: b.ai, L: b.L, mag });
    }
    // D517 — BẦY: cuối mỗi nến hiện xét màu trên giá đã cộng cú thanh lý + cú của người, TRỪ cú của chính bầy — không thế thì cú bầy tan dần vẽ ra
    // đúng CHUOI nến ngược màu ⇒ bầy tự đuổi theo bóng mình, dao động mãi trên giá đứng yên (bài vector §I bắt được). Đủ CHUOI ⇒ vào theo, chuỗi về 0.
    if (!bay) continue;
    const gBay = P[i]! * (1 + (lechNguoi?.(i) ?? 0)) * (1 + off - lechTl(xungBay, s));
    if (i % NH === 0) gMo = gBay;
    if ((i + 1) % NH !== 0) continue;
    const mau = Math.sign(gBay - gMo);
    chuoi = mau === 0 ? 0 : Math.sign(chuoi) === mau ? chuoi + mau : mau;
    if (Math.abs(chuoi) < BAY_CA_NHAN.CHUOI) continue;
    chuoi = 0;
    const tan = Math.min(BAY_CA_NHAN.TAN * k, ketThuc - s - k);
    if (tan <= 0) continue;   // sát cuối màn: phiên đã đóng
    const mag = mau * BAY_CA_NHAN.MAG * liq * Math.min(BAY_CA_NHAN.TRAN, Math.sqrt(bay.n / BAY_CA_NHAN.CHUAN));
    xung.push({ t0: s, mag, trai: k, tan });
    xungBay.push({ t0: s, mag, trai: k, tan });
    suBay.push({ nhip: i, n: bay.n, mag });
  }
  return { lech, xung, suKien, bay: suBay, xungTl, vt: st.map((b) => ({ chieu: b.chieu ?? 1, L: b.L, tien: b.tien, ...(b.p0 !== undefined ? { p0: b.p0, i0: b.i0! } : {}), iChet: b.iChet, mag: magCua(b) })) };
}

/** D494 — áp các cú bán cưỡng bức lên dòng mịn (cùng cách áp như `apXungGai`); trả sự kiện. */
export function apDayChuyen(min: NenMin[], seed: number, liq: number): { xung: XungTl[]; suKien: SuKienTl[]; vt: VtDamDong[] } {
  return apDamDong(min, damDongDonBay(seed), liq);
}

/** D512 — áp dây chuyền của một ĐÁM ĐÔNG bất kỳ (hai phe · nền · cùng map) lên dòng mịn; `lechNguoi` = cú tự đẩy của người (châm ngòi). */
export function apDamDong(min: NenMin[], bots: readonly BotDonBay[], liq: number, lechNguoi?: (i: number) => number, bay?: { n: number }, thac?: { hat: number }): { xung: XungTl[]; suKien: SuKienTl[]; vt: VtDamDong[]; bay: SuKienBay[] } {
  const n0 = NEN_LS * K_MIN, P: number[] = [];
  for (let k = 0; k < SO_NHIP; k++) P.push(min[n0 + Math.floor(k / NHIP_MOI_NEN)]!.tick[k % NHIP_MOI_NEN]!);
  const r = dayChuyen(P, bots, liq, lechNguoi, bay, thac);
  if (!r.xung.length) return r;
  // D521 — ghi độ sâu cú thác đang đè vào từng tick (chỉ phần THANH LÝ — không có bầy) cho khớp tính trượt lệnh vào ngược dòng.
  if (thac && r.xungTl.length) for (let j = 0; j < min.length - n0; j++) {
    const c = min[n0 + j]!, so = c.tick.length;
    c.thac = c.tick.map((_, t) => lechTl(r.xungTl, j + (t + 1) / so));
  }
  for (let j = 0; j < min.length - n0; j++) {
    const c = min[n0 + j]!, so = c.tick.length, l = (s: number) => lechTl(r.xung, s);
    c.tick = c.tick.map((x, t) => x * (1 + l(j + (t + 1) / so)));
    c.o *= 1 + l(j);
    c.c = c.tick[so - 1]!;
    c.h = Math.max(c.h * (1 + l(j + 0.5)), c.o, c.c, ...c.tick);
    c.l = Math.min(c.l * (1 + l(j + 0.5)), c.o, c.c, ...c.tick);
  }
  return r;
}

/**
 * D484 (demo `lapBangPhu`) — ĐƯỜNG GIÁ của một mã KHÁC đang cầm (bảng phụ): `SO_NHIP + 1` mốc (mốc 0 = 100 = giá mở màn), bước ngẫu nhiên
 * theo nhiễu của mã, rồi nghiêng (r^(k/480)) cho mốc cuối = 100 × (1 + bp/10⁴) — đúng % thị trường engine của mã ở vòng (giữ suốt). `i` = thứ tự
 * của mã trong bảng phụ (hạt riêng mỗi mã). THUẦN.
 */
export function duongPhu(
  seed: number, i: number, ma: string, bp: number,
  /**
   * D487 (demo bản 30 `lapBangPhu`) — TƯƠNG QUAN: cú lắc của mã chính (log-lợi suất từng nhịp trừ phần trôi đều, `SO_NHIP` số) + mã chính + ρ + trễ
   * (nến gộp; > 0 đi SAU mã chính, < 0 đi TRƯỚC). Mỗi nhịp: ρ × biên độ mã / biên độ mã chính × cú lắc (đã dời theo trễ) + √(1 − ρ²) × nhiễu riêng.
   * Vắng ⇒ đường độc lập như D484 (màn mở trước D487).
   */
  tq?: { soc: readonly number[]; chinh: string } & TqMan,
): number[] {
  const m = MA_MINIGAME[ma], ng = rngMinigame(seed ^ (0x51ed + i * 0x9e37)), n = SO_NHIP;
  const nhieu = m ? m.nhieu : 0.005;
  let g: number[];
  if (!tq) {
    g = [100];
    for (let k = 1; k <= n; k++) g.push(g[k - 1]! * (1 + (ng() - 0.5) * 2 * nhieu * PHU_NHIEU_X));
  } else {
    // D491 (demo bản 33 `lapBangPhu`) — mỗi kiểu một cách ăn theo cú lắc; nhiễu riêng √(1 − ρ²) như nhau. Bản D487 (không `kieu`) = tuyến tính.
    const kieu = tq.kieu ?? 'tuyen_tinh', xuoi = tq.xuoi !== false, amp = (m?.amp ?? 1) / (MA_MINIGAME[tq.chinh]?.amp ?? 1);
    const keo = tq.rho * amp * (kieu === 'that_thuong' ? (ma === 'btc' ? tq.nhay ?? 1 : 1 / (tq.nhay ?? 1)) : 1);
    const rieng = Math.sqrt(Math.max(0, 1 - tq.rho * tq.rho));
    const nt = rngMinigame(seed ^ (0x7e0 + i * 0x9e37));   // hạt RIÊNG cho số nến trơ — nhiễu riêng không lệch theo cú lắc
    let bon = 0, xaCon = 0, xaBuoc = 0, kXa = 0, troCon = TRO_TU + Math.floor(nt() * TRO_KHOANG);
    const lg = [0];
    for (let k = 1; k <= n; k++) {
      const j = k - 1 - tq.tre * NHIP_MOI_NEN_GOP, sc = j >= 0 && j < n ? tq.soc[j]! : 0;
      let d: number;
      if (kieu === 'khuech_dai') d = xuoi ? sc * (sc > 0 ? tq.len! : tq.xuong!) : sc / (sc > 0 ? tq.len! : tq.xuong!);
      else if (kieu === 'nguong' && xuoi) {
        bon += tq.rho * amp * (tq.boi ?? 1) * tq.soc[k - 1]!;
        if (xaCon <= 0 && k - kXa >= troCon * NHIP_MOI_NEN_GOP && Math.abs(bon) >= tq.nguong!) {
          kXa = k; troCon = TRO_TU + Math.floor(nt() * TRO_KHOANG); xaCon = tq.xa! * NHIP_MOI_NEN_GOP; xaBuoc = bon / xaCon; bon = 0;
        }
        d = xaCon > 0 ? (xaCon--, xaBuoc) : 0;
      } else d = keo * sc;
      lg.push(lg[k - 1]! + d + rieng * Math.log(1 + (ng() - 0.5) * 2 * nhieu * PHU_NHIEU_X));
    }
    g = lg.map((v) => 100 * Math.exp(v));
  }
  const r = (100 * (1 + bp / 10000)) / g[n]!;
  return g.map((x, k) => x * Math.pow(r, k / n));
}

/** D491 — tham số tương quan của MỘT cặp đã bốc cho vòng (ghi vào `BoiCanhMan.phu`). `xuoi` false = mã chính là mã THEO (mã kia đi trước). */
export interface TqMan {
  rho: number; tre: number; kieu?: KieuTuongQuan; xuoi?: boolean;
  len?: number; xuong?: number; nguong?: number; xa?: number; boi?: number; nhay?: number; soHai?: boolean;
}

/** D487 — cú lắc của mã chính: log-lợi suất từng nhịp của phần chạy, trừ phần trôi đều (để chỉ còn đường đi, không còn điểm cuối). */
export function cuLacChinh(min: readonly NenMin[]): number[] {
  const n0 = NEN_LS * K_MIN, gm = [min[n0 - 1]!.c];
  for (let k = 0; k < SO_NHIP; k++) gm.push(min[n0 + Math.floor(k / NHIP_MOI_NEN)]!.tick[k % NHIP_MOI_NEN]!);
  const troi = Math.log(gm[SO_NHIP]! / gm[0]!) / SO_NHIP;
  return gm.slice(1).map((g, k) => Math.log(g / gm[k]!) - troi);
}

/**
 * D470 — demo `heSoTk`: r = độ sâu sổ nấc NỀN của mã ÷ nấc của VÒNG (vắng ⇒ 1). MỘT nguồn cho dòng giá (râu · tự đẩy · trắng) và khớp lệnh
 * (trượt × r, D475).
 */
export function heSoThanhKhoan(ma: string, nac?: NacThanhKhoan): number {
  const nacNen = TAI_SAN.find((t) => t.id === ma)?.thanh_khoan ?? 'vua';
  return nac ? DO_SAU_L_NAM[nacNen] / DO_SAU_L_NAM[nac] : 1;
}

/** Dựng DÒNG MỊN (demo `dungDai`, k = 2): 20 nến lịch sử + 60 nến chạy, mỗi nến 8 mốc giá. */
export function dungDongMin(p: DauVaoDong): NenMin[] {
  const g = MA_MINIGAME[p.ma]!, cd = p.cheDo ?? 'thuong', dsinh = cd === 'duong_sinh';
  const m0 = cd === 'cuc_doan' && g.cd ? { ...g, ...g.cd } : dsinh && g.ds ? { ...g, nhieu: g.ds.nhieu } : g;   // demo `maHieuLuc`
  // D470 — demo `coTk`: r = độ sâu sổ nấc NỀN ÷ nấc VÒNG; râu + tự đẩy × r, ngưỡng trắng ÷ √r. Biên độ không đổi (của thẻ).
  const rTk = heSoThanhKhoan(p.ma, p.nac);
  const m = rTk === 1 ? m0 : { ...m0, liq: m0.liq * rTk, truot: m0.truot * rTk, trang: m0.trang / Math.sqrt(rTk) };
  const r = rngMinigame(p.seed), k = K_MIN, nhieu = Math.max(m.nhieu * 1.9, NHIEU_SAN_NGAN) * (p.nhieuX ?? 1);
  const rutChan = p.rutChan !== false && !dsinh;   // D468: dưỡng sinh — không rút chân, không quét, không rũ
  const nLs = NEN_LS * k, B = (p.bien ?? 1) * (dsinh && g.ds ? g.ds.bien : 1), bd = (x: number) => 100 + (x - 100) * B;
  interface Muc { v: number; gap?: boolean; lang?: boolean; caoTrao?: boolean; xuong?: boolean; tinThat?: boolean; rut?: number; quet?: 'sap' | 'rut' }
  const muc: Muc[] = [];
  const dau0 = bd(p.hinh.dau) - (QUET.LEN_DAI[p.dai] ?? 0);
  for (let i = 1; i <= nLs; i++) muc.push({ v: dau0 + (100 - dau0) * i / nLs });
  let truoc = 100;
  for (const [n0, den0, kieu, co] of p.hinh.song) {
    const n = n0 * k, den = bd(den0);
    for (let i = 1; i <= n; i++) {
      const f = i / n, g = kieu === 'tang_toc' ? f * f : kieu === 'giam_toc' ? Math.sqrt(f) : f;
      muc.push({ v: kieu === 'gap' ? den : truoc + (den - truoc) * g, gap: kieu === 'gap' && i === 1, lang: co === 'lang', caoTrao: co === 'cao_trao' && i === n,
        ...(den < truoc ? { xuong: true } : {}) });   // D523 — sóng giảm (nhãn QUÁ BÁN ở cao trào cuối sóng)
    }
    truoc = den;
  }
  if (p.nhip !== false && HO_THANG.has(p.hinh.id)) {
    const rr = rngMinigame(p.seed ^ 0x3c6ef372), n = muc.length, chieu = Math.sign(muc[n - 1]!.v - muc[nLs]!.v) || 1;
    const lom = (c: number, xuong: number, len: number, sau: number) => {
      for (let i = Math.max(nLs, c - xuong); i <= Math.min(n - 1, c + len); i++) {
        const f = i <= c ? (i - (c - xuong)) / xuong : 1 - (i - c) / len; muc[i]!.v -= chieu * sau * Math.max(0, f);
      }
    };
    const soNhip = NHIP.SO_MIN + Math.floor(rr() * (NHIP.SO_MAX - NHIP.SO_MIN + 1));
    for (let j = 0; j < soNhip; j++) {
      const c = nLs + Math.floor((6 + rr() * 18) * k), chay = Math.abs(muc[c]!.v - muc[Math.max(nLs, c - 8 * k)]!.v);
      lom(c, Math.round((2 + rr() * 2) * k), Math.round((3 + rr() * 3) * k), Math.max(NHIP.SAU_MIN, chay * (NHIP.HOI_MIN + rr() * NHIP.HOI_THEM)));
    }
    const tangCa = (muc[n - 1]!.v - muc[nLs]!.v) / 100;
    if (chieu > 0 && rr() < Math.min(NHIP.RU_TRAN, NHIP.RU_THEO_TANG * tangCa) && !dsinh) {
      const c = nLs + Math.floor((3 + rr() * 21) * k), P = 100 + (muc[c]!.v - 100) * m.amp;
      lom(c, Math.max(1, Math.round(k * (1 + rr()))), Math.round((3 + rr() * 2) * k), (NHIP.RU_SAU_MIN + rr() * NHIP.RU_SAU_THEM) * P / m.amp);
    }
  }
  if (p.nghieng) { const nn = muc.length - nLs; muc.forEach((x, i) => { if (i >= nLs) x.v += 100 * p.nghieng * (i - nLs + 1) / nn; }); }
  p.troi.forEach((tr) => muc.forEach((x, i) => {
    const kk = (i - nLs - Math.floor(tr.ci)) / k; if (kk < 1 / k) return;
    x.v += tr.huong * tr.mag * (kk <= 1 ? 0.6 : kk <= 2 ? 0.8 : Math.min(1, 0.8 + (kk - 2) * 0.07));
    if (kk <= 2) x.tinThat = true;
  }));
  let quet: { i: number; sau: number; sap: boolean } | null = null;
  if (rutChan && r() < (p.quetEp ?? p.q ?? 0)) {
    quet = { i: nLs + (6 + Math.floor(r() * 18)) * k, sau: RUT.QUET_MIN + r() * RUT.QUET_THEM, sap: r() < 0.5 };
    const q = quet;
    if (q.sap) muc.forEach((x, i) => { if (i >= q.i) x.v -= q.sau * 100 * 0.85 / m.amp; });
  }
  const nen: NenMin[] = []; let dong = 100 + (dau0 - 100) * m.amp;
  muc.forEach((x, i) => {
    const dich = 100 + (x.v - 100) * m.amp;
    const o = x.gap ? dich * (1 + (r() - 0.5) * nhieu * 0.4) : dong;
    const c = dich * (1 + (r() - 0.5) * nhieu * 0.7), tick: number[] = [];
    for (let j = 1; j <= 8; j++) { const b = o + (c - o) * j / 8; tick.push(j === 8 ? c : b + (r() - 0.5) * 2 * nhieu * b * 0.6); }
    if (quet && i === quet.i) { tick[2] = o * (1 - quet.sau); x.rut = -1; x.quet = quet.sap ? 'sap' : 'rut'; }
    else if (rutChan && i - nLs >= 1 && r() < (RUT.CO_SO + RUT.THEO_TK * m.liq) / k) {
      const xuong = r() < 0.75, sau = (RUT.SAU_MIN + r() * RUT.SAU_THEM) * m.amp;
      const day5 = Math.min(...nen.slice(Math.max(0, nen.length - 5 * k)).map((z) => z.l));
      const j = 1 + Math.floor(r() * 6), goc = tick[j]!;
      tick[j] = xuong ? Math.min(goc * (1 - sau), Math.max(day5 * 0.99, goc * (1 - RUT.SAU_TRAN * m.amp))) : goc * (1 + sau * 0.7);
      x.rut = xuong ? -1 : 1;
    }
    const h = Math.max(o, ...tick) + r() * nhieu * c * 0.5, l = Math.min(o, ...tick) - r() * nhieu * c * 0.5;
    let v = 0.35 + 6 * Math.abs(c - o) / o * k; if (x.lang) v *= 0.4; if (x.caoTrao || x.gap) v *= 2.4; if (x.tinThat) v *= 2.6;
    // D523 — `gt` giá trị nền (chưa nhiễu) · `ctx` cao trào cuối sóng giảm · `tinDo` nến đỏ do tin thật (khối lượng cũng vọt — dễ nhầm với cao trào)
    nen.push({ o, c, h, l, tick, v, iSong: i - nLs, rut: x.rut ?? 0, quet: x.quet ?? null, gt: dich,
      ...(x.caoTrao && x.xuong ? { ctx: true } : {}), ...(x.tinThat && c < o ? { tinDo: true } : {}) }); dong = c;
  });
  for (let i = 1; i < nen.length; i++) { let n = 0; for (let j = i; j >= 0 && nen[j]!.c > nen[j]!.o; j--) n++; if (n >= 2) nen[i]!.v *= 1 + 0.35 * n / k; }
  const cs = 5 * k, tran3 = 3 * k; let cm = 0, cb = 0;
  nen.forEach((c, i) => {
    if (c.iSong < 0) return; const t = m.trang;
    const truocC = nen.slice(Math.max(0, i - cs), i), dinh = Math.max(...truocC.map((x) => x.h)), day = Math.min(...truocC.map((x) => x.l));
    const sap = (c.c < c.o * (1 - t / 3 / k) || c.o < nen[i - 1]!.c * (1 - t / 2)) && c.c < dinh * (1 - t);
    const ep = (c.c > c.o * (1 + t / 3 / k) || c.o > nen[i - 1]!.c * (1 + t / 2)) && c.c > day * (1 + t);
    c.trang = sap && cm < tran3; cm = c.trang ? cm + 1 : 0;
    c.trangBan = ep && cb < tran3; cb = c.trangBan ? cb + 1 : 0;
  });
  return nen;
}

/** Gộp hai nến mịn làm một (demo `gopHaiNen`): mở của nến đầu, đóng của nến sau, râu = cực trị CẢ HAI; 8 mốc giữ cả đáy lẫn đỉnh. */
export function gopHaiNen(min: readonly NenMin[]): NenMin[] {
  const ra: NenMin[] = [];
  for (let i = 0; i + 1 < min.length; i += 2) {
    const a = min[i]!, b = min[i + 1]!, F = [...a.tick, ...b.tick], tick = [1, 3, 5, 7, 9, 11, 13, 15].map((j) => F[j]!);
    const dat = (idx: number, v: number) => { if (idx !== 15) tick[Math.min(6, Math.floor(idx / 2))] = v; };
    const iMax = F.indexOf(Math.max(...F)), iMin = F.indexOf(Math.min(...F));
    if (Math.max(...tick) < F[iMax]!) dat(iMax, F[iMax]!);
    if (Math.min(...tick) > F[iMin]!) dat(iMin, F[iMin]!);
    ra.push({ o: a.o, c: b.c, h: Math.max(a.h, b.h), l: Math.min(a.l, b.l), tick, v: a.v + b.v, iSong: Math.floor(a.iSong / 2),
      rut: a.rut || b.rut || 0, quet: a.quet ?? b.quet ?? null, trang: !!(a.trang || b.trang), trangBan: !!(a.trangBan || b.trangBan) });
  }
  return ra;
}

/** Giá tại NHỊP `n` của màn chạy (0 ≤ n < 480): mốc thứ n % 8 của nến mịn chạy thứ ⌊n / 8⌋. Hàm của số nhịp, không của giờ. */
/** D521 — độ sâu cú thác đang đè ở nhịp n (0 nếu màn không ghi `thac`). Cùng cách đánh chỉ số với `giaTaiNhip`. */
export function thacTaiNhip(min: readonly NenMin[], n: number): number {
  const chay = min.slice(NEN_LS * K_MIN), j = Math.max(0, Math.min(chay.length * 8 - 1, Math.floor(n)));
  return chay[Math.floor(j / 8)]!.thac?.[j % 8] ?? 0;
}
export function giaTaiNhip(min: readonly NenMin[], n: number): number {
  const chay = min.slice(NEN_LS * K_MIN), j = Math.max(0, Math.min(chay.length * 8 - 1, Math.floor(n)));
  return chay[Math.floor(j / 8)]!.tick[j % 8]!;
}
