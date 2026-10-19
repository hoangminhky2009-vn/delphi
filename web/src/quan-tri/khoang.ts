/**
 * TRẠNG THÁI SỐNG Ở URL + ĐỊNH DẠNG (D335). Hàm thuần — test gọi thẳng.
 *
 * ⚠ URL là nguồn của mọi bộ lọc (khuôn cũ của mặt quản trị): một lát cắt đáng chú ý thì gửi lại được, F5 không mất.
 * ⚠ Chỉ query, KHÔNG đường con: `/quan-tri` là một tệp HTML riêng ở biên Cloudflare; `/quan-tri/nguoi/x` sẽ rơi
 *   vào SPA người chơi (not_found_handling). Nên khu/người/tab đều là tham số.
 * ⚠ Ngày tính theo giờ Việt Nam ở CLIENT chỉ để dựng nút chọn nhanh; máy chủ vẫn tự kẹp và trả `khoang` thật.
 */
import { KHU_DS, type Khu } from './chu';

const MS_NGAY = 86_400_000;
const LECH_VN_MS = 7 * 3_600_000;

export const ngayVN = (ms: number): string => new Date(ms + LECH_VN_MS).toISOString().slice(0, 10);
export const congNgay = (ngay: string, n: number): string =>
  new Date(Date.parse(`${ngay}T00:00:00Z`) + n * MS_NGAY).toISOString().slice(0, 10);
const laNgay = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export type Moc = 'hom_nay' | '7' | '30' | '90' | 'tuy';
/** Nút chọn nhanh → số ngày lùi thêm từ hôm nay. */
export const MOC_LUI: Readonly<Record<Exclude<Moc, 'tuy'>, number>> = { hom_nay: 0, '7': 6, '30': 29, '90': 89 };
export const TEN_MOC: Readonly<Record<Exclude<Moc, 'tuy'>, string>> = { hom_nay: 'Hôm nay', '7': '7 ngày', '30': '30 ngày', '90': '90 ngày' };
/**
 * Thứ tự nút trên thanh — theo demo. ⚠ KHÔNG dựng bằng `Object.keys(MOC_LUI)`: JS xếp khoá dạng số ('7', '30', '90')
 * lên TRƯỚC khoá chữ, nên "Hôm nay" rơi xuống cuối (bản đầu dính đúng chỗ này, soi mắt 15/09 mới thấy).
 */
export const THU_TU_MOC: ReadonlyArray<Exclude<Moc, 'tuy'>> = ['hom_nay', '7', '30', '90'];
/** Số ngày của khoảng, tính cả hai đầu. */
export const soNgayKhoang = (tu: string, den: string): number =>
  Math.round((Date.parse(`${den}T00:00:00Z`) - Date.parse(`${tu}T00:00:00Z`)) / MS_NGAY) + 1;

export interface TrangThai {
  khu: Khu;
  moc: Moc;
  tu: string;
  den: string;
  soKy: boolean;
  gom: boolean;
  /** Handle đang mở ở khu NGƯỜI DÙNG (null = danh sách). */
  nguoi: string | null;
  /** Tab con của khu SẢN PHẨM / VẬN HÀNH / DỮ LIỆU. */
  tab: string | null;
}

export function docTrangThai(q: URLSearchParams, bayGio = Date.now()): TrangThai {
  const homNay = ngayVN(bayGio);
  const khu = (KHU_DS as readonly string[]).includes(q.get('khu') ?? '') ? q.get('khu') as Khu : 'tong';
  const mocRaw = q.get('moc');
  let moc: Moc = mocRaw && (mocRaw in MOC_LUI || mocRaw === 'tuy') ? mocRaw as Moc : '30';
  let tu: string;
  let den: string;
  if (moc === 'tuy' && laNgay(q.get('tu')) && laNgay(q.get('den'))) {
    tu = q.get('tu')!; den = q.get('den')!;
    if (tu > den) [tu, den] = [den, tu];
    if (den > homNay) den = homNay;
  } else {
    if (moc === 'tuy') moc = '30';
    den = homNay;
    tu = congNgay(homNay, -MOC_LUI[moc as Exclude<Moc, 'tuy'>]);
  }
  const nguoi = q.get('nguoi');
  return {
    khu, moc, tu, den,
    soKy: q.get('so_ky') !== '0',
    gom: q.get('gom') === '1',
    nguoi: khu === 'nguoi' && nguoi && /^[a-z0-9_]{3,20}$/.test(nguoi) ? nguoi : null,
    tab: q.get('tab'),
  };
}

/** Ghi một phần trạng thái vào query, giữ nguyên các khoá khác (bộ lọc danh sách, v.v.). */
export function ghiTrangThai(q: URLSearchParams, doi: Partial<TrangThai>): URLSearchParams {
  const t = new URLSearchParams(q);
  const dat = (k: string, v: string | null) => { if (v === null) t.delete(k); else t.set(k, v); };
  if (doi.khu !== undefined) { dat('khu', doi.khu); if (doi.khu !== 'nguoi') dat('nguoi', null); dat('tab', null); }
  if (doi.moc !== undefined) {
    dat('moc', doi.moc);
    if (doi.moc !== 'tuy') { dat('tu', null); dat('den', null); }
  }
  if (doi.tu !== undefined) dat('tu', doi.tu);
  if (doi.den !== undefined) dat('den', doi.den);
  if (doi.soKy !== undefined) dat('so_ky', doi.soKy ? null : '0');
  if (doi.gom !== undefined) dat('gom', doi.gom ? '1' : null);
  if (doi.nguoi !== undefined) dat('nguoi', doi.nguoi);
  if (doi.tab !== undefined) dat('tab', doi.tab);
  return t;
}

/* ── Định dạng — ghim giờ Việt Nam, không để máy người xem tự chọn ────────── */

const dinhGio = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });
const dinhNgayGio = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
export const gioVN = (iso: string): string => dinhGio.format(new Date(iso));
export const ngayGioVN = (iso: string | null): string => (iso ? dinhNgayGio.format(new Date(iso)) : '—');
/** "15/09" từ "2026-09-15". */
export const ngayNgan = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const ngayDu = (d: string): string => `${ngayNgan(d)}/${d.slice(0, 4)}`;
export const so = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : n.toLocaleString('vi-VN'));
export const so1 = (n: number): string => (Math.round(n * 10) / 10).toLocaleString('vi-VN');
export const pt = (co: number, n: number): number => (n === 0 ? 0 : (co / n) * 100);

/** Thời lượng từ mili-giây, đọc được: "45 giây" · "3 phút 20 giây" · "1 giờ 5 phút". */
export function thoiLuong(ms: number | null): string {
  if (ms === null) return '—';
  const giay = Math.round(ms / 1000);
  if (giay < 60) return `${giay} giây`;
  const phut = Math.floor(giay / 60);
  if (phut < 60) return giay % 60 ? `${phut} phút ${giay % 60} giây` : `${phut} phút`;
  return `${Math.floor(phut / 60)} giờ ${phut % 60} phút`;
}

const THU = ['THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY', 'CHỦ NHẬT'];
export const tenThu = (d: string): string => THU[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7]!;
