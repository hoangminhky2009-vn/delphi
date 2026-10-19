/**
 * BÁCH KHOA — một cửa cho mọi thứ màn bách khoa đọc (D334): danh sách mục · tra theo id · đọc số luật từ catalog
 * · tách từ khoá bấm được · tìm kiếm không dấu.
 *
 * ⚠ Hàm ở đây THUẦN, không React, không fetch — màn gọi, test gọi thẳng.
 */
import { NHAN_O_DOI } from '@/lib/o_doi';
import { NHOM_BACH_KHOA, type MucBK } from './kieu';
import { MUC_VAI_MA } from './muc_vai_ma';
import { MUC_LOI } from './muc_loi';
import { MUC_THE_TIN } from './muc_the_tin';
import { MUC_GIA_NHIP } from './muc_gia_nhip';
import { MUC_LAI_RUI_HV } from './muc_lai_rui_hv';
import { MUC_V55 } from './muc_v55';
import { MUC_MINIGAME } from './muc_minigame';

export { NHOM_BACH_KHOA };
export type { CapBK, ChuoiBK, ChuyenBK, MucBK, MucRef, NhomId } from './kieu';
export { LUOI_BACH_KHOA } from './luoi';
export { CHU_MAT_TIEN, DUONG_MAT_TIEN, type DuongMatTien } from './mat_tien';

export const MUC_BACH_KHOA: readonly MucBK[] = [
  ...MUC_VAI_MA, ...MUC_LOI, ...MUC_THE_TIN, ...MUC_GIA_NHIP, ...MUC_LAI_RUI_HV, ...MUC_V55, ...MUC_MINIGAME,
];

export const MUC_THEO_ID: ReadonlyMap<string, MucBK> = new Map(MUC_BACH_KHOA.map((m) => [m.id, m]));

// ─── SỐ LUẬT: `%{đường.dẫn:định_dạng}` ─────────────────────────────────────────

/** Nguồn số — dựng từ catalog lúc vẽ. Thiếu nhánh nào thì mọi dòng đọc nhánh ấy ẩn. */
export interface NguonSo {
  dq?: unknown; gia?: unknown; luat?: unknown; vai?: unknown; mandate?: unknown; tk?: unknown;
  /** v46 (D338) — mức lãi vay Đòn Bẩy. */
  lv?: unknown;
  /** v52 (D371) — bộ số MỖI VÒNG của lá Đa Dạng Hoá (`ddv.PHI_BP` · `ddv.MOI_MA_BP`). */
  ddv?: unknown;
  /** D406 — ngân hàng đổ vỡ (`nhdv.BAO_HIEM_TOI_DA` · `nhdv.MAT_BP` · `nhdv.SO_LA_XAU_TRUOC`). */
  nhdv?: unknown;
  /** D495 — số của màn lõi (`mg.chay_s` · `mg.muc_don_bay` · `mg.goi_bp` · `mg.thanh_ly_bp` · `mg.nap_bp` …). */
  mg?: unknown;
  ts?: Record<string, unknown>; hang?: Record<string, number>; kv?: Record<string, unknown>;
  /** Tên vai theo lõi nó ghim: `ghim.luot_song` → "ĐỘI LÁI". */
  ghim?: Record<string, string>;
  nhan: { o_doi: string };
}

/** Phần nguồn không phụ thuộc server — từ vựng một nguồn (D26). */
export const NGUON_TINH: Pick<NguonSo, 'nhan'> = { nhan: { o_doi: NHAN_O_DOI } };

const bpPc = (bp: number): string => {
  const v = bp / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
};
const thuc = (x: number): string => (Number.isInteger(x) ? String(x) : String(x).replace('.', ','));

const DINH_DANG: Record<string, (v: unknown) => string | null> = {
  n: (v) => (typeof v === 'number' ? String(v) : null),
  pc: (v) => (typeof v === 'number' ? bpPc(v) : null),
  heso: (v) => (typeof v === 'number' ? `×${thuc(v / 10000)}` : null),
  thuc: (v) => (typeof v === 'number' ? thuc(v) : null),
  ds: (v) => (Array.isArray(v) && v.every((x) => typeof x === 'number') ? v.join(' · ') : null),
  chu: (v) => (typeof v === 'string' ? v : null),
  vai: (v) => (typeof v === 'string' ? v : null),
  phe: (v) => (v === 'rui_ro' ? 'rủi ro' : v === 'phong_thu' ? 'phòng thủ' : null),
  so: (v) => (v === 'mong' ? 'mỏng' : v === 'vua' ? 'vừa' : v === 'day' ? 'dày' : null),
  khong: (v) => (v === true ? 'được' : v === false ? 'không' : null),
};

const MAU_SO = /%\{([a-zA-Z0-9_.]+)(?::([a-z]+))?\}/g;

/**
 * Thay mọi `%{…}` bằng giá trị từ nguồn. Có MỘT chỗ không đọc được ⇒ trả `null` và người gọi ẩn cả dòng
 * — không bao giờ in nửa câu, không bao giờ đoán số.
 */
export function giaiSo(chuoi: string, nguon: NguonSo): string | null {
  let hong = false;
  const ra = chuoi.replace(MAU_SO, (_, duong: string, dd: string | undefined) => {
    const v = duong.split('.').reduce<unknown>((o, k) => (o !== null && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), nguon);
    const f = DINH_DANG[dd ?? 'n'];
    const s = f ? f(v) : null;
    if (s === null) { hong = true; return ''; }
    return s;
  });
  return hong ? null : ra;
}

// ─── TỪ KHOÁ + ĐẬM ─────────────────────────────────────────────────────────────

export type Doan = { k: 'chu'; s: string; dam: boolean } | { k: 'tu'; id: string; s: string; dam: boolean };

/** Tách `{id|chữ}` và `<b>…</b>` thành đoạn — màn vẽ bằng React, không `innerHTML`. */
export function tachDoan(chuoi: string): Doan[] {
  const ra: Doan[] = [];
  const phan = chuoi.split(/(<b>.*?<\/b>)/g);
  for (const p of phan) {
    if (p === '') continue;
    const dam = p.startsWith('<b>');
    const noi = dam ? p.slice(3, -4) : p;
    const cat = noi.split(/(\{[a-z_0-9]+\|[^}]+\})/g);
    for (const c of cat) {
      if (c === '') continue;
      const m = /^\{([a-z_0-9]+)\|([^}]+)\}$/.exec(c);
      if (m) ra.push({ k: 'tu', id: m[1]!, s: m[2]!, dam });
      else ra.push({ k: 'chu', s: c, dam });
    }
  }
  return ra;
}

/** Chữ trơn (bỏ cú pháp) — cho tìm kiếm và aria. */
export function chuTron(chuoi: string): string {
  return chuoi.replace(MAU_SO, '').replace(/<\/?b>/g, '').replace(/\{[a-z_0-9]+\|([^}]+)\}/g, '$1');
}

/** Bỏ dấu tiếng Việt — gõ "lai suat" vẫn ra "lãi suất". */
export function khongDau(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function khopTim(m: MucBK, tu: string): boolean {
  const q = khongDau(tu.trim());
  if (q === '') return true;
  return khongDau([m.ten, m.anh, m.nhac, chuTron(m.ngoai)].join(' ')).includes(q);
}

/** Mọi chuỗi chữ của một mục — cho bài quét A10 và bài canh chữ số. */
export function moiChuoi(m: MucBK): { tang: 'doi' | 'ban'; s: string }[] {
  const ra: { tang: 'doi' | 'ban'; s: string }[] = [];
  const doi = (s: string | undefined) => { if (s) ra.push({ tang: 'doi', s }); };
  const ban = (s: string | undefined) => { if (s) ra.push({ tang: 'ban', s }); };
  [m.ten, m.anh, m.nhac, m.ngoai, m.viDu, m.nhung, m.khung].forEach(doi);
  const chuoi = m.chuoi === undefined ? [] : Array.isArray(m.chuoi) ? m.chuoi : [m.chuoi];
  for (const c of chuoi as { ten: string; buoc: readonly string[]; ket: string }[]) { doi(c.ten); c.buoc.forEach(doi); doi(c.ket); }
  for (const c of m.chuyen ?? []) { doi(c.nam); doi(c.noi); doi(c.cau); (c.so ?? []).forEach((r) => { doi(r[0]); doi(r[1]); }); }
  for (const c of m.doiBan) { doi(c.doi); ban(c.ban); }
  for (const r of m.so ?? []) { ban(r[0]); ban(r[1]); }
  return ra;
}

export { NHOM_BACH_KHOA as NHOM };
