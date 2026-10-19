/**
 * MẶT LÁ BÀI (D390 → D393) — chữ + họ màu + icon loại tin của từng lá.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Art (lưới, neon, vệt) do server cấp qua `/holdem/art` (`server/art/la_bai.ts`); CHỮ
 * nằm ở client (D26). Mọi giá trị ở đây chép NGUYÊN từ trang demo đã duyệt
 * `docs/ui-ux/demo/la-bai-phong-cach.html` (A11.25 — demo là nguồn chân lý, token màu
 * không diễn giải lại). `web/tests/la_bai_mat.test.tsx` so từng lá với trang ấy.
 *
 * ⭐ THIÊN NGA ĐEN (D390): mọi tin có tính chất nền `hoang_loan` (`TINH_CHAT_NEN`) mang
 * CÙNG một mặt — tên THIÊN NGA ĐEN, họ hoảng loạn — và LOẠI tin (chiến tranh, phá sản…)
 * chỉ hiện bằng icon góc phải + tên loại ở tooltip. Suy từ bảng tính chất của engine,
 * không gõ danh sách: thêm một tin hoảng loạn là nó tự vào lá thiên nga.
 * ⚠ Tin hoảng loạn CHƯA có icon (vd `thien_nga_den` gốc, trước khi chia mặt) ⇒ mặt thiên
 * nga không icon — vẫn đúng lá, chỉ thiếu loại; không rơi về tranh cũ.
 */
import { TINH_CHAT_NEN, type SuKienId } from '@config/holdem';

/** Họ màu = hệ thông tin: một họ một nghĩa. Hex chép nguyên từ `.len{--ho…}` … của trang demo. */
export type HoLa = 'len' | 'xuong' | 'ngang' | 'dong' | 'hung' | 'hoang' | 'la';
export const HO_MAU: Record<HoLa, { mau: string; sang: string }> = {
  len: { mau: '#4ade80', sang: '#bbf7d0' },
  xuong: { mau: '#f87171', sang: '#fecaca' },
  ngang: { mau: '#94a3b8', sang: '#e2e8f0' },
  dong: { mau: '#fb923c', sang: '#fed7aa' },
  hung: { mau: '#a78bfa', sang: '#ddd6fe' },
  hoang: { mau: '#ef4444', sang: '#fca5a5' },
  la: { mau: '#60a5fa', sang: '#bfdbfe' },
};

export interface MatLa {
  ho: HoLa;
  /** Nhóm (góc trái trên của lá). */
  nhom: string;
  /** Mã/ký hiệu góc phải trên — rỗng ở lá thiên nga (chỗ ấy là icon loại tin). */
  ma: string;
  ten: string;
}

/** Khoá = khoá art: `gd_*` · `sk_*` · mã tài sản · mã chiến thuật (khớp `/holdem/art`). */
const MAT: Record<string, MatLa> = {
  gd_tang: { ho: 'len', nhom: 'XU HƯỚNG', ma: '▲', ten: 'TĂNG' },
  gd_giam: { ho: 'xuong', nhom: 'XU HƯỚNG', ma: '▼', ten: 'GIẢM' },
  gd_di_ngang: { ho: 'ngang', nhom: 'XU HƯỚNG', ma: '≈', ten: 'ĐI NGANG' },
  // ♨ + U+FE0E (xin vẽ dạng CHỮ, cùng ký tự của demo). Soi mắt D393: không có nó, ♨ ra emoji
  // màu và ô xám biến nó thành một cục mờ. ⚠ FE0E chỉ cứu được máy CÓ font chữ chứa ♨ (Android ·
  // iOS); Chrome/Windows không có ⇒ vẫn ra emoji. Muốn đồng đều mọi máy thì phải đổi ký hiệu.
  gd_bien_dong: { ho: 'dong', nhom: 'XU HƯỚNG', ma: '♨︎', ten: 'QUÁ NÓNG' },
  gd_phuc_hoi: { ho: 'len', nhom: 'XU HƯỚNG', ma: '↗', ten: 'PHỤC HỒI' },
  sk_ha_lai_suat: { ho: 'len', nhom: 'VAN TIỀN', ma: '%↓', ten: 'HẠ LÃI SUẤT' },
  sk_tang_lai_suat: { ho: 'xuong', nhom: 'VAN TIỀN', ma: '%↑', ten: 'TĂNG LÃI SUẤT' },
  sk_lam_phat: { ho: 'xuong', nhom: 'VAN TIỀN', ma: '₫↓', ten: 'LẠM PHÁT' },
  sk_hack_san: { ho: 'xuong', nhom: 'VAN TIỀN', ma: '∅', ten: 'CẠN THANH KHOẢN' },
  sk_bong_bong: { ho: 'hung', nhom: 'HƯNG PHẤN', ma: '◎', ten: 'BONG BÓNG' },
  sk_thien_nga_den: { ho: 'hoang', nhom: 'HOẢNG LOẠN', ma: '', ten: 'THIÊN NGA ĐEN' },
  don_bay: { ho: 'la', nhom: 'CHIẾN THUẬT', ma: '×2', ten: 'ĐÒN BẨY' },
  mua_duoi: { ho: 'la', nhom: 'CHIẾN THUẬT', ma: '»', ten: 'MUA ĐUỔI' },
  bat_day: { ho: 'la', nhom: 'CHIẾN THUẬT', ma: '∪', ten: 'BẮT ĐÁY' },
  luot_song: { ho: 'la', nhom: 'CHIẾN THUẬT', ma: '∿', ten: 'LƯỚT SÓNG' },
  ban_khong: { ho: 'la', nhom: 'CHIẾN THUẬT', ma: '↘', ten: 'BÁN KHỐNG' },
  btc: { ho: 'dong', nhom: 'RỦI RO', ma: '₿', ten: 'CRYPTO' },
  // Sổ chốt 10/10 — tên lớp chung, không tên cụ thể ngoài đời (₮ là ký hiệu riêng của một đồng ⇒ thôi dùng).
  cp_cn: { ho: 'dong', nhom: 'RỦI RO', ma: 'CP', ten: 'CỔ TECH' },
  vn30: { ho: 'dong', nhom: 'RỦI RO', ma: 'BC', ten: 'BLUE-CHIP' },
  vang: { ho: 'ngang', nhom: 'TRÚ ẨN', ma: 'Au', ten: 'VÀNG' },
  usd: { ho: 'ngang', nhom: 'TRÚ ẨN', ma: '$', ten: 'STABLECOIN' },
  tpcp: { ho: 'ngang', nhom: 'TRÚ ẨN', ma: 'TP', ten: 'TRÁI PHIẾU' },
};

/** Sáu loại thiên nga đen — id = `SuKienId`; icon lưới 16×16 theo `BANG_MAU` (vẽ bằng `PixelLuoi`). */
export const LOAI_THIEN_NGA: Record<string, { ten: string; icon: readonly string[] }> = {
  chien_tranh: { ten: 'CHIẾN TRANH', icon: [
    '..........z....Y',
    '..............sO',
    '........z....xx.',
    '......YO....ss..',
    '.....sO....Sx...',
    '....xx....Sx..z.',
    '...ss....qq.YO..',
    '..Sx.......sO...',
    '.Sx.......xx....',
    'qq.......ss.....',
    '........Sx......',
    '.......Sx.......',
    '.....Wqq........',
    '....Y...........',
    '.q.OYOq....O....',
    '..rqOqrr..qqr...',
  ] },
  pha_san: { ten: 'PHÁ SẢN', icon: [
    '................',
    '....ooo.........',
    '...oobb.........',
    '..ooby....oo....',
    '.ooby.....boo...',
    '.obyYJ...yyboo..',
    'oobyJYY.JYYyboo.',
    'ooyJYYY..YYYybo.',
    'oobyYY....YYyboo',
    '.obyYY....YJYyoo',
    '.oobyYJ..YJYyboo',
    '..oobyy..JYYybo.',
    '...oob....Yyboo.',
    '....oo....yboo..',
    '.......o.bboo...',
    '........yooo....',
  ] },
  dich_benh: { ten: 'DỊCH BỆNH', icon: [
    '................',
    '.....G....G.....',
    '.....g....g.....',
    '......g..g......',
    '......gggg......',
    '.Gg..gNnGng..gG.',
    '...ggnGnnnngg...',
    '....gnnnnGng....',
    '....gnnnnnng....',
    '...ggnnGnnngg...',
    '.Gg..gnnnng..gG.',
    '......gggg......',
    '......g..g......',
    '.....g....g.....',
    '.....G....G.....',
    '................',
  ] },
  phap_ly: { ten: 'PHÁP LÝ', icon: [
    '................',
    '................',
    '......yTTTTTTTy.',
    '......yTTBTBTTy.',
    '......ybbBbBbby.',
    '......ybbbbbbby.',
    '.........bT.....',
    '........bT......',
    '.......bT.......',
    '......bT........',
    '.....bT.........',
    '....bT.....Y....',
    '...bT.....Y..Y..',
    '............Y...',
    'TTTTTTTTT..Y....',
    'BBBBBBBBB.......',
  ] },
  cam_van: { ten: 'CẤM VẬN', icon: [
    '................',
    '................',
    '................',
    '.......SS.......',
    '......S..S......',
    's..xs.SxsS.xs..x',
    'ssxxssSxsSxxssxx',
    's..xs.SxsS.xs..x',
    '.....yyyyyy.....',
    '.....yYYYYy.....',
    '.....yYkkYy.....',
    '.....yYkkYy.....',
    '.....yYkYYy.....',
    '.....yYYYYy.....',
    '.....yyyyyy.....',
    '................',
  ] },
  tham_hoa: { ten: 'THẢM HOẠ', icon: [
    '................',
    '.ASSSSSSSSSSSSA.',
    '.LLLLLLLLLLL....',
    '..ASSSSSSSSSSA.b',
    'b..LLLLLLLLL....',
    '....ASSSSSSSA...',
    '.....LLLLLL.....',
    '.....ASSSSAA....',
    '.....LLLL.......',
    '.....ASSSA....b.',
    '.b...LL.........',
    '.....ASA........',
    '................',
    '..b...AA....b...',
    '................',
    '......xxx.......',
  ] },
};

/**
 * D560 — TÍNH CHẤT LÁ PHA (khoá chu kỳ có ngòi): icon GÓC PHẢI như loại tin của lá thiên nga (founder 08/10: *"Làm giống trường hợp lá
 * thiên nga đen ấy, 1 icon ở góc"*). Server gửi `o.tinh_chat`, client chỉ vẽ (D26); tên ở aria + tooltip (D123). Lưới 16×16, bảng màu
 * `config/pixel_luoi.ts`. Tích lũy = chồng xu · Phân phối = túi lật xu rơi · Bò dòng tiền = vòi nhỏ giọt ra xu · Bò tăng trưởng = cột
 * tăng dần · Gấu sự kiện = tia sét · Gấu định giá = bong bóng vỡ · Gấu chu kỳ = đồng hồ cát.
 */
export const TINH_CHAT_PHA: Record<string, { ten: string; icon: readonly string[] }> = {
  tich_luy: { ten: 'TÍCH LŨY', icon: [
    '................', '................', '................', '.....yJJJy......',
    '....yJYYYJy.....', '.....yJJJy......', '....byyyyyb.....', '.....yJJJy......',
    '....byyyyyb.....', '.....yJJJy......', '....byyyyyb.....', '.....yJJJy......',
    '....byyyyyb.....', '...xxxxxxxxx....', '................', '................',
  ] },
  phan_phoi: { ten: 'PHÂN PHỐI', icon: [
    '................', '....bb..........', '...bTTb.........', '..bTTTTb........',
    '.bTTTTTTb.......', '.bTTTTTTTb......', '.bTTTTTTTTb.yJ..', '..bTTTTTTTbyJy..',
    '...bbbbbbb..yy..', '.............yJ.', '...........yJ.y.', '............yy..',
    '..........yJ....', '...........y....', '................', '................',
  ] },
  dong_tien: { ten: 'BÒ DÒNG TIỀN', icon: [
    '................', '...xxxxx........', '...xSSSx........', '.xxxxSxxxxxx....',
    '.xSSSSSSSSSx....', '.xxxxxxxxxSx....', '.........xSx....', '.........xxx....',
    '..........L.....', '.........LAL....', '..........L.....', '.........yJy....',
    '........yJYJy...', '.........yJy....', '................', '................',
  ] },
  tang_truong: { ten: 'BÒ TĂNG TRƯỞNG', icon: [
    '................', '.............G..', '............GGG.', '...........G.G..',
    '.............G..', '...........nn...', '.......nn..nn...', '.......nn..nn...',
    '...nn..nn..nn...', '...nn..nn..nn...', '...nn..nn..nn...', '...nn..nn..nn...',
    '..xxxxxxxxxxxx..', '................', '................', '................',
  ] },
  gau_su_kien: { ten: 'GẤU SỰ KIỆN', icon: [
    '................', '.........OJO....', '........OJJO....', '.......OJJO.....',
    '......OJJO......', '.....OJJJJJJO...', '....OJJJJJJO....', '.......OJJO.....',
    '......OJJO......', '.....OJJO.......', '....OJJO........', '...OJO..........',
    '...OO...........', '................', '................', '................',
  ] },
  gau_dinh_gia: { ten: 'GẤU ĐỊNH GIÁ', icon: [
    '................', '.......P........', '..P....H....P...', '...P.......P....',
    '.......HH.......', '.....HP..PH.....', '.P..H......H..P.', '...........H....',
    '....H......H....', '.....HP..PH.....', '.......HH.......', '...P.......P....',
    '..P....H....P...', '.......P........', '................', '................',
  ] },
  gau_chu_ky: { ten: 'GẤU CHU KỲ', icon: [
    '................', '...xxxxxxxxxx...', '....xSSSSSSx....', '....xyyyyyyx....',
    '.....xyyyyx.....', '......xyyx......', '.......xx.......', '.......xx.......',
    '......xSyx......', '.....xSSyyx.....', '....xSSyyyyx....', '....xyyyyyyx....',
    '...xxxxxxxxxx...', '................', '................', '................',
  ] },
};

export interface MatLaDayDu extends MatLa {
  /** Chỉ có ở lá thiên nga: loại tin cụ thể (icon góc phải + tên ở tooltip). */
  loai?: { id: string; ten: string; icon: readonly string[] };
}

/** Tin này có hiện bằng lá thiên nga đen không (theo tính chất NỀN của engine). */
export const laThienNga = (suKien: string): boolean =>
  TINH_CHAT_NEN[suKien as SuKienId] === 'hoang_loan';

/** Mặt lá của một khoá art; `undefined` = lá chưa có mặt mới (sáu lõi cảnh cũ). */
export function matLa(khoa: string): MatLaDayDu | undefined {
  if (khoa.startsWith('sk_') && laThienNga(khoa.slice(3))) {
    const id = khoa.slice(3);
    const loai = LOAI_THIEN_NGA[id];
    return { ...MAT.sk_thien_nga_den!, ...(loai ? { loai: { id, ...loai } } : {}) };
  }
  return MAT[khoa];
}

/** Mọi khoá có mặt riêng (bài canh dùng để so với trang demo). */
export const KHOA_MAT: readonly string[] = Object.keys(MAT);
