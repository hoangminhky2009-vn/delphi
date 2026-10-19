/**
 * D532 — TIN TRONG MÀN (demo `lapTin` · `themTinHinh` · `danhSoTin` · `gaiTin`; founder: *"lướt sóng ở demo như nào thì làm như thế"*).
 *
 * Mỗi màn có một dòng TIN theo nến: tin RÒ RỈ THẬT về thẻ sự kiện sắp lật (lớp `truoc` — thẻ còn úp nên đây là thông tin có giá) kèm 0–2 tin LAN và
 * một CẢI CHÍNH; tin CÔNG BỐ của chính thẻ đang nổ (lớp `no`); 3–6 tin NHIỄU (chung / theo chủ đề bối cảnh); bình luận gắn HÌNH đường giá; tin giả
 * Đội Lái gài. Tin THẬT đẩy giá (`troi` → `dungDongMin`, demo `dsTroi`); nhiễu không đẩy.
 *
 * ⚠ Sinh lúc MỞ MÀN và GHI vào bối cảnh màn (`BoiCanhMan.tin` / `.troi`) ⇒ replay đọc lại đúng — không suy lại từ seed ở chỗ khác. Bình luận theo hình
 *   cần đường giá ⇒ thêm khi đọc (`tinDayDu`, thuần theo đường đã dựng). Đơn vị `ci` = NẾN MỊN chạy (0–60, demo k = 2); khung 30 nến chia đôi ở client.
 * ⚠ Server gửi ID chữ (`chu`), không gửi chữ (D26) — chữ ở `config/minigame_tin.ts` qua `chuTin`.
 */
import { TINH_CHAT_NEN, type SuKienId } from '../../../config/holdem.js';
import { K_MIN, NEN_LS } from '../../../config/minigame.js';
import { HINH_TIN, NGUON_TIN, NHIEU_CHU_DE_TIN, NHIEU_TIN, SU_KIEN_KE_TIN, THE_TIN, type ChuDeTin, type NguonTin, type SuKienTin } from '../../../config/minigame_tin.js';
import { keoDoiLaiT0, rngMinigame, type CuDay, type NenMin } from './dong_gia.js';
import type { NguonMan } from './man.js';
import { chuTinViMo, type TinViMo } from '../boi_canh_dai_han.js';

export interface TinMan {
  /** Thứ tự theo `ci` (gán bởi `danhSoTin`). */
  id: number;
  /** Vị trí theo NẾN MỊN chạy (số thực). */
  ci: number;
  ng: NguonTin;
  /** ID chữ (client tra `chuTin`). */
  chu: string;
  /** Hướng LỜI NÓI (+1 tốt · −1 xấu · 0 úp mở) — quyết màu bong bóng. */
  noi: -1 | 0 | 1;
  /** Hướng TÁC ĐỘNG thật lên giá (≠ 0 chỉ ở tin thật). Không gửi client trừ khi đã mua tin sớm. */
  huong: -1 | 0 | 1;
  that: boolean;
  lan?: true; caiChinh?: true; congBo?: true; theoChuDe?: true; theoHinh?: true; gai?: true;
  /** D574 — tin VĨ MÔ của bối cảnh dài hạn (không đẩy giá; đúng 65 % — `that` luôn false, KHÔNG nói đúng/nhầm kể cả khi đã mua tin sớm). */
  viMo?: true;
  /** Hàng xếp chồng 0–2 của ghim (tin sát nhau). */
  tang: number;
}

const K = K_MIN;
const BC_CHU_DE: Readonly<Record<string, ChuDeTin>> = { ky_hop: 'lai_suat', lam_phat: 'lam_phat', sau_tnd: 'sau_tnd' };

/** Thẻ của engine → khoá trong bảng tin của demo. Tin HOẢNG LOẠN (bảy tin) là MỘT lá thiên nga đen (D390) ⇒ dùng chữ thiên nga đen. */
export function suKienTinCua(the: SuKienId): SuKienTin | null {
  if (the in SU_KIEN_KE_TIN) return the as SuKienTin;
  return TINH_CHAT_NEN[the] === 'hoang_loan' ? 'thien_nga_den' : null;
}

/** Demo `rutNguonThat`: nguồn của tin rò rỉ thật theo `p_that`. */
function rutNguonThat(r: () => number): NguonTin {
  let x = r();
  for (const [k, n] of Object.entries(NGUON_TIN) as [NguonTin, (typeof NGUON_TIN)[NguonTin]][]) {
    x -= n.p_that;
    if (x <= 0 && n.p_that > 0) return k;
  }
  return 'bao';
}

/** Trộn theo rng (demo `.sort(() => r() - .5)` — giữ đúng thói của demo: cùng seed cùng thứ tự). */
function tron<T>(xs: readonly T[], r: () => number): T[] {
  return [...xs].sort(() => r() - 0.5);
}

/**
 * Demo `lapTin` (k = 2). `diem` = điểm ma trận thẻ × mã (`BoiCanhMan.diem`, cùng thứ `S.kb.v` của demo): hướng tác động = dấu điểm, độ mạnh theo `goc`.
 */
export function lapTinMan(p: { seed: number; nguon: NguonMan; diem: number }): { tin: TinMan[]; troi: CuDay[] } {
  const r = rngMinigame(p.seed ^ 0x7a3b1c), tin: Omit<TinMan, 'id' | 'tang'>[] = [], troi: CuDay[] = [];
  const goc = Math.max(0.5, Math.min(2, Math.abs(p.diem) / 1200)), dau = Math.sign(p.diem) as -1 | 0 | 1;
  const sk = p.nguon.kind === 'su_kien' ? suKienTinCua(p.nguon.the) : null;
  const lop = p.nguon.kind === 'su_kien' ? p.nguon.lop : null;
  const the = sk ? THE_TIN[sk] : null;
  // Chủ đề nhiễu (demo `chuDe`): lớp trước/nổ ⇒ `bc` của thẻ · dư âm ⇒ `du` (không có ⇒ tu_dong) · tu_dong ⇒ chủ đề của tin rò rỉ (nếu có).
  const bc = !the ? null : lop === 'du_am' ? the.du ?? 'tu_dong' : the.bc;
  const skKe = lop === 'truoc' ? sk : null;
  const cd: ChuDeTin | null = (bc && BC_CHU_DE[bc]) ?? (skKe ? (SU_KIEN_KE_TIN[skKe].chu_de as ChuDeTin | null) : null);
  if (skKe) {
    const k0 = SU_KIEN_KE_TIN[skKe], ng = rutNguonThat(r), noi0 = (k0.that as Record<string, readonly [string, number]>)[ng]![1] as -1 | 0 | 1;
    const hu = dau, mg = k0.mag * goc * 0.5;
    const ci = 5 + Math.floor(r() * 12);
    tin.push({ ci, ng, chu: `sk.${skKe}.${ng}`, noi: noi0, huong: hu, that: true });
    if (hu) troi.push({ ci, huong: hu, mag: mg });
    const soLan = r() < 0.35 ? 0 : r() < 0.6 ? 1 : 2, nguonLan = tron(['kol', 'hoi_nhom', 'dien_dan'] as const, r);
    let cLan = ci;
    for (let i = 0; i < soLan; i++) {
      const ngL = nguonLan[i]!, c2 = (cLan += 0.35 + r() * 0.3);
      tin.push({ ci: c2, ng: ngL, chu: `lan.${ngL}.${skKe}`, noi: Math.sign(k0.huong) as -1 | 0 | 1, huong: hu, that: true, lan: true });
      if (hu) troi.push({ ci: c2, huong: hu, mag: mg * 0.3 });
    }
    const [n2, , h2] = k0.caiChinh;
    tin.push({ ci: Math.min(28, ci + 2 + Math.floor(r() * 9)), ng: n2, chu: `cc.${skKe}`, noi: h2 as -1 | 0 | 1, huong: 0, that: false, caiChinh: true });
  }
  if (lop === 'no' && sk && the) {   // NỔ: đúng MỘT tin THẬT — nến công bố của chính thẻ, đẩy giá theo dấu ma trận
    const ci = 8, mag = +(SU_KIEN_KE_TIN[sk].mag * goc * 0.5).toFixed(1);
    tin.push({ ci, ng: the.ng, chu: `cb.${sk}`, noi: dau, huong: dau, that: true, congBo: true });
    if (dau) troi.push({ ci, huong: dau, mag });
  }
  const soNhieu = 3 + Math.floor(r() * 4), khoChung = tron(NHIEU_TIN.map((_, i) => i), r), khoCd = cd ? tron(NHIEU_CHU_DE_TIN[cd].map((_, i) => i), r) : [];
  const dsCi: number[] = [];
  let conLai = soNhieu;
  for (let d = 0; d < (r() < 0.5 ? 1 : 2) && conLai > 0; d++) {
    let c = 2 + r() * 24;
    const n = Math.min(conLai, 2 + Math.floor(r() * 2));
    for (let i = 0; i < n; i++) { dsCi.push(c); c += 0.35 + r() * 0.3; }
    conLai -= n;
  }
  for (let i = 0; i < conLai; i++) dsCi.push(1 + r() * 27);
  for (const ci of dsCi) {
    if (cd && r() < 0.65 && khoCd.length) {
      const j = khoCd.pop()!, [ng, , noi] = NHIEU_CHU_DE_TIN[cd][j]!;
      tin.push({ ci: Math.min(28.8, ci), ng, chu: `cd.${cd}.${j}`, noi: noi as -1 | 0 | 1, huong: 0, that: false, theoChuDe: true });
    } else {
      const j = khoChung.pop()!, [ng, , noi] = NHIEU_TIN[j]!;
      tin.push({ ci: Math.min(28.8, ci), ng, chu: `nh.${j}`, noi: noi as -1 | 0 | 1, huong: 0, that: false, ...(cd ? { theoChuDe: true as const } : {}) });
    }
  }
  return {
    tin: danhSoTin(tin.map((t) => ({ ...t, ci: +(t.ci * K).toFixed(2) }))),
    troi: troi.map((t) => ({ ...t, ci: +(t.ci * K).toFixed(2) })),
  };
}

/** Demo `danhSoTin`: xếp theo `ci`, đánh số, hàng xếp chồng 0–2 cho tin sát nhau (< 0,9 nến xem). */
export function danhSoTin(tin: readonly Omit<TinMan, 'id' | 'tang'>[]): TinMan[] {
  const ds = [...tin].sort((x, y) => x.ci - y.ci);
  return ds.map((t, i) => ({ ...t, id: i, tang: ds.slice(0, i).filter((u) => Math.abs(u.ci - t.ci) < 0.9 * K).length % 3 }));
}

/** Demo `themTinHinh`: bình luận của HÌNH (luôn nhiễu); hướng lời = độ dốc giá 3 nến xem trước đó; nguồn suy từ tiền tố chữ. */
export function tinHinh(hinhId: string, min: readonly NenMin[]): Omit<TinMan, 'id' | 'tang'>[] {
  const bang = HINH_TIN[hinhId];
  if (!bang) return [];
  const n0 = NEN_LS * K;
  return Object.entries(bang).map(([cs, chu]) => {
    const ci = +cs * K, a = min[n0 + Math.max(-n0, ci - 3 * K)]!.c, b = min[n0 + ci]!.c;
    const ng: NguonTin = /^chuyên gia/i.test(chu) ? 'chuyen_gia' : /^kol/i.test(chu) ? 'kol' : /hội nhóm|nhóm kín/i.test(chu) ? 'hoi_nhom'
      : /^báo|báo cáo|lãi suất|dự án|đại diện/i.test(chu) ? 'bao' : 'dien_dan';
    return { ci, ng, chu: `hinh.${hinhId}.${cs}`, noi: (b > a ? 1 : -1) as 1 | -1, huong: 0 as const, that: false, theoHinh: true as const };
  });
}

/** Demo `gaiTin`: tin giả Đội Lái gài — cùng nến với cú đẩy `apXungGai` (một công thức, cùng seed). */
export function tinGai(seed: number, chieu: 1 | -1): Omit<TinMan, 'id' | 'tang'> {
  const ci = (8 + Math.floor(rngMinigame(seed ^ 0x6a1)() * 8)) * K;
  return { ci, ng: chieu > 0 ? 'kol' : 'hoi_nhom', chu: `gai.${chieu > 0 ? 1 : -1}`, noi: chieu, huong: 0, that: false, gai: true };
}

/** D536 — demo `cungMap === 'doi_lai'`: bot Đội Lái cùng mã gài tin hội nhóm "đang được gom mạnh" MỘT nến hiện sau cú kéo (nhiễu, không đẩy giá). */
export function tinBotDoiLai(seed: number): Omit<TinMan, 'id' | 'tang'> {
  return { ci: keoDoiLaiT0(seed) + K, ng: 'hoi_nhom', chu: 'bot.doi_lai', noi: 1, huong: 0, that: false };
}

/** Dòng tin ĐẦY ĐỦ của màn = tin đã ghi lúc mở + bình luận theo hình (trên đường đã dựng) + tin gài (nếu có) + tin của bot Đội Lái cùng mã, đánh số lại. */
export function tinDayDu(p: { tin?: readonly TinMan[]; hinh: string; seed: number; lon?: readonly string[] }, min: readonly NenMin[], gai: 1 | -1 | 0): TinMan[] {
  if (!p.tin) return [];
  return danhSoTin([...p.tin.map(({ id: _i, tang: _t, ...x }) => x), ...tinHinh(p.hinh, min), ...(gai ? [tinGai(p.seed, gai)] : []),
    ...(p.lon?.includes('doi_lai') ? [tinBotDoiLai(p.seed)] : [])]);
}

/** Nhịp mà tin LỘ (bong bóng mở khi nhịp đang xem ≥ nhịp này) — một nến mịn = `NHIP_MOI_NEN` nhịp. */
export const nhipLoTin = (ci: number, nhipMoiNen: number): number => Math.ceil(ci * nhipMoiNen);

/**
 * D574 — DÒNG TIN VĨ MÔ của bối cảnh dài hạn, dạng tin màn: nguồn `vi_mo`, hướng lời theo trạng thái nó NÓI (Lên / Nới ⇒ tốt · Bão hoà / Căng ⇒
 * xấu), không đẩy giá. Vị trí theo vòng (cùng mọi ghế).
 */
export function tinViMoMan(v: TinViMo): Omit<TinMan, 'id' | 'tang'> {
  return { ci: +((3 + v.nen) * K).toFixed(2), ng: 'vi_mo', chu: chuTinViMo(v), noi: v.noi === 'len' || v.noi === 'noi' ? 1 : -1, huong: 0, that: false, viMo: true };
}

/**
 * Một tin của dòng tin màn GỬI CHO GHẾ (lô nhịp): MÙ TIN ⇒ chỉ vị trí (server không gửi chữ / nguồn / hướng — C4) · đã mua tin sớm ⇒ kèm THẬT / NHIỄU,
 * TRỪ tin vĩ mô (D574: đúng 65 %, không phải tin rò rỉ — gắn nhiễu là nói dối người chơi).
 */
export function tinChoGhe(t: TinMan, o: { muTin: boolean; daMua: boolean }):
  { id: number; ci: number; tang: number; ng?: NguonTin; chu?: string; noi?: -1 | 0 | 1; that?: boolean } {
  if (o.muTin) return { id: t.id, ci: t.ci, tang: t.tang };
  return { id: t.id, ci: t.ci, tang: t.tang, ng: t.ng, chu: t.chu, noi: t.noi, ...(o.daMua && !t.viMo ? { that: t.that } : {}) };
}
