/**
 * BANNER Ô ĐẤU TRƯỜNG CỦA HUB — phần THUẦN (không React, không DOM): chọn cảnh, dựng câu "BẠN CÓ BIẾT?", vẽ lưới lá bài
 * thành đường SVG.
 *
 * ─── LUẬT (SPEC `ui-tang-khong-gian` 11/10) ──────────────────────────────────────────────────────────────────────
 * · Nội dung banner = kiến thức tài chính NỀN TẢNG để chơi game, LẤY TỪ BÁCH KHOA (`lib/bach_khoa`) — không chép chữ tay:
 *   đổi chữ ở bách khoa là banner đổi theo (A11.5).
 * · Cảnh ĐẦU luôn là tay bài xoè (TĂNG → THIÊN NGA ĐEN → GIẢM), mở bài THIÊN NGA ĐEN. Các cảnh sau xoay vòng theo thứ tự cố
 *   định dưới đây. (Ý chờ của SPEC "ngẫu nhiên hay ưu tiên mục CHƯA gặp" — chọn thứ tự cố định: ưu tiên mục chưa gặp cần sổ tay
 *   `/holdem/me/so-tay`, tức một request mới ở Hub, mà Hub bị cấm thêm request. Mở lại khi sổ tay đã nằm sẵn trong cache.)
 * · Câu gợi mở = câu "VÌ SAO…" của mục; mục không có câu hỏi thì lấy câu `nhac` (một câu kết).
 */
import type { ChuoiBK, MucBK } from '@/lib/bach_khoa/kieu';

/** Tám mục NỀN TẢNG của banner, theo thứ tự cảnh. Mục đầu đi với cảnh tay bài. */
export const ID_BANNER = [
  'thien_nga', 'lai_suat', 'lam_phat', 'da_dang', 'khau_vi', 'thanh_khoan', 'goi_ky_quy', 'chu_ky',
] as const;

/** Chuỗi "vì sao" ĐẦU của mục (mục có thể mang một chuỗi hoặc nhiều chuỗi). */
export function chuoiDau(m: Pick<MucBK, 'chuoi'>): ChuoiBK | null {
  const c = m.chuoi;
  if (c === undefined) return null;
  const dau = Array.isArray(c) ? (c as readonly ChuoiBK[])[0] : (c as ChuoiBK);
  return dau ?? null;
}

/**
 * Câu "BẠN CÓ BIẾT?": "VÌ SAO LẠM PHÁT LÀM TIỀN MẤT GIÁ" ⇒ "Vì sao lạm phát làm tiền mất giá?". Mục không có chuỗi "vì sao"
 * ⇒ câu `nhac`.
 */
export function goiMo(m: Pick<MucBK, 'chuoi' | 'nhac'>): string {
  const ten = chuoiDau(m)?.ten.trim() ?? '';
  if (/^VÌ SAO /.test(ten)) return `Vì sao ${ten.slice('VÌ SAO '.length).toLocaleLowerCase('vi')}?`;
  return m.nhac;
}

// ─── LÁ BÀI: lưới ký tự → đường SVG ────────────────────────────────────────────────────────────────────────────────

/**
 * Gộp các ô cùng màu liền nhau theo hàng thành một đoạn `h` — đường SVG ngắn hơn ~10 lần so với một `<rect>` mỗi ô.
 * `bang` = bảng ký tự → màu (`BANG_MAU` ở `config/pixel_luoi.ts`). `.` và ký tự lạ là trong suốt.
 */
export function duongVeLuoi(luoi: readonly string[], bang: Readonly<Record<string, string>>): Map<string, string> {
  const ra = new Map<string, string[]>();
  luoi.forEach((hang, y) => {
    let x = 0;
    while (x < hang.length) {
      const ch = hang[x]!;
      if (ch === '.' || bang[ch] === undefined) { x += 1; continue; }
      let r = 1;
      while (x + r < hang.length && hang[x + r] === ch) r += 1;
      (ra.get(ch) ?? ra.set(ch, []).get(ch)!).push(`M${x},${y}h${r}v1h-${r}z`);
      x += r;
    }
  });
  return new Map([...ra].map(([k, v]) => [k, v.join('')]));
}

/** `viewBox` vuông ôm sát phần có hình (cắt khung trống) để art lấp đầy mặt lá. Lưới rỗng ⇒ cả lưới. */
export function khungCat(luoi: readonly string[], bang: Readonly<Record<string, string>>): string {
  let t = luoi.length; let b = -1; let l = luoi[0]?.length ?? 0; let r = -1;
  luoi.forEach((hang, y) => {
    for (let x = 0; x < hang.length; x += 1) {
      const c = hang[x]!;
      if (c === '.' || bang[c] === undefined) continue;
      t = Math.min(t, y); b = Math.max(b, y); l = Math.min(l, x); r = Math.max(r, x);
    }
  });
  if (b < 0) return `0 0 ${luoi[0]?.length ?? 1} ${luoi.length || 1}`;
  const n = Math.max(b - t, r - l) + 1;
  const cy = (t + b + 1) / 2; const cx = (l + r + 1) / 2;
  return `${cx - n / 2} ${cy - n / 2} ${n} ${n}`;
}

/** Hệ số thu tay bài theo bề rộng banner: tay bài rộng 350 px ở cỡ gốc; kẹp 0,4–0,8 (demo). */
export function heSoTayBai(beRongBanner: number): number {
  return Math.min(0.8, Math.max(0.4, (beRongBanner - 8) / 350));
}
