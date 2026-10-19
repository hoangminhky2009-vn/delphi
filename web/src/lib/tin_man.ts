/**
 * D532 — CHỮ của tin trong màn (server gửi ID, chữ ở client — D26). Tra từ bảng chép nguyên văn demo (`config/minigame_tin.ts`).
 * ⚠ Import TƯƠNG ĐỐI (không alias `@config`) để bài canh phía gốc gọi được cùng hàm — một cửa tra chữ cho mọi nơi.
 */
import { HINH_TIN, LAN_TIN, NGUON_TIN, NHIEU_CHU_DE_TIN, NHIEU_TIN, SU_KIEN_KE_TIN, THE_TIN, VI_MO_TIN, type ChuDeTin, type NguonTin, type SuKienTin } from '../../../config/minigame_tin.js';

/** Chữ của một ID tin; ID lạ ⇒ null (client không in gì — không đoán). */
export function chuTin(id: string): string | null {
  const [loai, a, b] = id.split('.');
  if (!loai || a === undefined) return null;
  if (loai === 'sk' && b) return (SU_KIEN_KE_TIN[a as SuKienTin]?.that as Record<string, readonly [string, number]> | undefined)?.[b]?.[0] ?? null;
  if (loai === 'cc') return SU_KIEN_KE_TIN[a as SuKienTin]?.caiChinh[1] ?? null;
  if (loai === 'lan' && b) { const f = (LAN_TIN as Record<string, (tom: string) => string>)[a], sk = SU_KIEN_KE_TIN[b as SuKienTin]; return f && sk ? f(sk.tom) : null; }
  if (loai === 'cb') return THE_TIN[a as SuKienTin]?.cb ?? null;
  if (loai === 'nh') return NHIEU_TIN[Number(a)]?.[1] ?? null;
  if (loai === 'cd' && b !== undefined) return NHIEU_CHU_DE_TIN[a as ChuDeTin]?.[Number(b)]?.[1] ?? null;
  if (loai === 'hinh' && b !== undefined) {
    const chu = HINH_TIN[a]?.[Number(b)];
    return chu === undefined ? null : chu.replace(/^(Hội nhóm|Chuyên gia|Diễn đàn|Báo|KOL): /, '');   // demo `themTinHinh`: bỏ tiền tố nguồn
  }
  if (loai === 'vm' && b !== undefined) return (VI_MO_TIN as Record<string, readonly string[]>)[a]?.[Number(b)] ?? null;   // D574 — tin vĩ mô
  if (loai === 'bot' && a === 'doi_lai') return 'Mã này đang được gom mạnh, lên thuyền!';   // D536 — demo `cungMap === 'doi_lai'`
  if (loai === 'gai') return a === '1' ? 'Nguồn tin nội bộ: sắp có thông tin rất tốt cho mã này' : 'Rò rỉ: mã này sắp bị điều tra';   // demo `gaiTin`
  return null;
}

/** Tên + độ uy tín (1–5) của nguồn — client vẽ "■■■□□". */
export function nguonTin(ng: string): { ten: string; uy: number } | null {
  const n = NGUON_TIN[ng as NguonTin];
  return n ? { ten: n.ten, uy: n.uy } : null;
}

/**
 * Biến màu của một tin (demo `mauTin`): HƯỚNG LỜI NÓI × UY TÍN nguồn — tốt xanh · xấu đỏ · úp mở xám; nhạt (1) → đậm (5). MÙ TIN ⇒ xám nấc 3.
 * Đã mua tin sớm ⇒ tin NHIỄU xám (chỉ tin thật giữ màu).
 */
export function mauTin(t: { noi?: number; ng?: string; that?: boolean }, o: { muTin?: boolean; daMua?: boolean } = {}): string {
  if (o.muTin || !t.ng) return 'var(--mo-3)';
  const uy = NGUON_TIN[t.ng as NguonTin]?.uy ?? 3;
  const ho = o.daMua && t.that === false ? 'mo' : (t.noi ?? 0) > 0 ? 'tot' : (t.noi ?? 0) < 0 ? 'xau' : 'mo';
  return `var(--${ho}-${uy})`;
}

/** MÙ TIN: chữ xáo liên tục ở độ dài CỐ ĐỊNH (độ dài thật cũng lộ tin) — client tự xáo, server không gửi chữ (demo `xaoChu`). */
const GLYPH = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789§#%&@$';
export function xaoChu(rnd: () => number = Math.random): string {
  let o = '', n = 0;
  while (n < 40) {
    const w = 2 + Math.floor(rnd() * 6);
    for (let i = 0; i < w; i++) o += GLYPH[Math.floor(rnd() * GLYPH.length)];
    o += ' '; n += w + 1;
  }
  return o.trim();
}
