/**
 * PFM — HŨ CON (SPEC `pfm-tang-khong-gian` câu 3 = A, founder 11/10: *"làm trong việc này, CHỈ ở máy, một tầng, tổng hũ cha =
 * tổng con"*; kiểu Money Lover: Đà Lạt → vé xe · ở · ăn chơi).
 *
 * ─── BỐN LUẬT ────────────────────────────────────────────────────────────────────────────────────────────────────────
 * 1. MỘT TẦNG: hũ con luôn trỏ vào một `Hu` (hũ cha), và hũ con không có con. Hình dạng bản ghi KHÔNG cho cha của hũ con là một
 *    hũ con (`chaId` là id của `Hu`, ngăn `hu`; ngăn `hu_con` không có hũ nào là cha của hũ nào) — `taoHuCon` kiểm cha nằm ở ngăn `hu`.
 * 2. CHỈ Ở MÁY: ngăn `hu_con` có `KIEU_LAT = 'khong'` (không vào két, không `nhanNguNghia`, không dòng nào đi `outbox`). Bài
 *    `pfm_hu_con.test.ts` quét: tệp này không import `dong_bo`/`telemetry`/`api`.
 * 3. KHÔNG CẤT SỐ TIỀN (cùng lý lẽ `Hu` — "không có `daGop` ở đây"): tiền vẫn là KHOẢN trong sổ nối vào hũ CHA (`Khoan.huId` =
 *    id cha) — nên ví, danh mục, Hub, lời đoán của cha vẫn đọc ĐÚNG con số cũ. Hũ con chỉ giữ `khoanIds`: những khoản của cha
 *    được GÁN cho nó. "Đã góp" của hũ con TÍNH ra từ các khoản ấy lúc đọc (xoá khoản / hoàn tác ⇒ tự rớt khỏi hũ con).
 * 4. TỔNG CHA = TỔNG CON: hũ cha có con thì con số của cha là `tongCon + chuaChia`, trong đó `chuaChia` là phần tiền đã nằm ở cha
 *    trước khi có con (hoặc nạp thẳng vào cha). Nạp vào hũ cha-có-con đi qua một hũ con ⇒ `chuaChia` không tăng; hàng "chưa chia"
 *    là một HÀNG của bảng (không phải một hũ con), nên đẳng thức `Σ hàng = tổng cha` đúng trong mọi trạng thái.
 *
 * ⚠ Mức của hũ con (đồng, số nguyên > 0) là mức NGƯỜI DÙNG gõ (P3) — app không điền, không gợi. Cha đã có mức thì tổng mức con
 *   không vượt mức cha (`taoHuCon` ném `LoiHuCon`): một hũ không thể có phần con lớn hơn cả hũ.
 * ⚠ Hàm THUẦN: không đọc đồng hồ, không đọc kho, không chuỗi hiển thị (chữ ở `lib/pfm_chu.ts`).
 */
import { laTichLuy, tienDo, type Hu } from './hu.js';
import { daTieuTrongThang, laGanChi, laGopVaoHu, soGan, soGop, tongGopVaoHu, type Khoan } from './so.js';

export class LoiHuCon extends Error {}

const CAT_TEN = 60;

export interface HuCon {
  id: string;
  /** Id của `Hu` cha (ngăn `hu`) — KHÔNG BAO GIỜ là id của một hũ con khác (một tầng). */
  chaId: string;
  ten: string;
  /** Mức người dùng tự đặt (đồng, số nguyên > 0). */
  muc: number;
  /** Id những khoản của hũ cha được gán cho hũ con này (nạp / rút ở tích lũy · chia / gỡ ở tiêu dùng). Chỉ NỐI THÊM. */
  khoanIds: string[];
  taoLuc: string;
}

/** Mọi hũ con của một hũ cha, theo thứ tự tạo. */
export function conCua(cac: readonly HuCon[], chaId: string): HuCon[] {
  return cac.filter((c) => c.chaId === chaId).sort((a, b) => (a.taoLuc < b.taoLuc ? -1 : a.taoLuc > b.taoLuc ? 1 : a.id < b.id ? -1 : 1));
}

function chuanTen(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t.length === 0) throw new LoiHuCon('Hũ con cần một cái tên.');
  return t.slice(0, CAT_TEN);
}

/**
 * Tạo hũ con dưới `cha`. `daCo` = các hũ con ĐÃ có của cha (để kiểm trần mức). Ném `LoiHuCon` khi: tên rỗng · mức không phải số
 * nguyên dương · tổng mức con vượt mức cha (cha đã có mức) · cha đã xong/bỏ (không thêm phần con vào hũ đã đóng).
 */
export function taoHuCon(
  v: { ten: string; muc: number }, cha: Pick<Hu, 'id' | 'muc' | 'trangThai'>, daCo: readonly HuCon[], luc: string, id: string,
): HuCon {
  if (!Number.isSafeInteger(v.muc) || v.muc <= 0) throw new LoiHuCon('Mức hũ con phải là số nguyên dương.');
  if (cha.trangThai === 'xong' || cha.trangThai === 'bo_do') throw new LoiHuCon('Hũ đã đóng thì không thêm hũ con.');
  const da = daCo.filter((c) => c.chaId === cha.id).reduce((a, c) => a + c.muc, 0);
  if (cha.muc !== null && da + v.muc > cha.muc) throw new LoiHuCon('Tổng mức hũ con không vượt mức hũ cha.');
  return { id, chaId: cha.id, ten: chuanTen(v.ten), muc: v.muc, khoanIds: [], taoLuc: luc };
}

/** Gán thêm một khoản của cha cho hũ con (idempotent — gán hai lần cùng id không đếm hai lần). */
export function ganKhoan(con: HuCon, khoanId: string): HuCon {
  return con.khoanIds.includes(khoanId) ? con : { ...con, khoanIds: [...con.khoanIds, khoanId] };
}

/**
 * ĐÃ GÓP của hũ con (cha tích lũy) — tổng có dấu các khoản ĐƯỢC GÁN, tính qua `laGopVaoHu` của cha (cùng luật mốc RESET,
 * cùng bỏ khoản gán). Khoản đã bị xoá / không còn trong sổ ⇒ rớt ra. KHÔNG kẹp về 0 (cùng lý lẽ `tongGopVaoHu`).
 */
export function daGopCon(con: HuCon, cha: Pick<Hu, 'id' | 'mocGop'>, so: readonly Khoan[]): number {
  const ids = new Set(con.khoanIds);
  let n = 0;
  for (const k of so) {
    if (!ids.has(k.id) || !laGopVaoHu(k, cha.id, cha.mocGop)) continue;
    n += soGop(k);
  }
  return n;
}

/** ĐÃ TIÊU tháng `thang` của hũ con (cha tiêu dùng) — tổng có dấu các khoản GÁN được gán cho nó, đề ngày trong tháng. */
export function daTieuCon(con: HuCon, cha: Pick<Hu, 'id'>, so: readonly Khoan[], thang: string): number {
  const ids = new Set(con.khoanIds);
  let n = 0;
  for (const k of so) {
    if (!ids.has(k.id) || k.huId !== cha.id || !k.ngay.startsWith(thang) || !laGanChi(k)) continue;
    n += soGan(k);
  }
  return n;
}

export interface HangCon { con: HuCon; so: number; pct: number | null }

export interface TongHopCha {
  /** Con số của hũ cha đọc từ sổ (`tongGopVaoHu` / `daTieuTrongThang`) — nguồn sự thật, không đổi vì có hũ con. */
  tongCha: number;
  hang: HangCon[];
  tongCon: number;
  /** Phần của cha chưa gán cho hũ con nào: `tongCha − tongCon`. Có thể âm nếu rút từ hũ con nhiều hơn phần của nó — nói thật, không kẹp. */
  chuaChia: number;
  /** Tổng mức các hũ con. */
  mucCon: number;
  /** Mức còn nhận thêm cho hũ con mới: `mức cha − tổng mức con` (cha chưa có mức ⇒ `null`: không giới hạn). */
  conNhan: number | null;
}

/**
 * BẢNG HŨ CHA CÓ CON — một chỗ cho đẳng thức `tongCon + chuaChia === tongCha` (bài canh `pfm_hu_con.test.ts` §II).
 * Cha tích lũy đếm "đã góp" (theo mốc RESET), cha tiêu dùng đếm "đã tiêu tháng này".
 */
export function tongHopCha(cha: Hu, cac: readonly HuCon[], so: readonly Khoan[], thang: string): TongHopCha {
  const tich = laTichLuy(cha);
  const tongCha = tich ? tongGopVaoHu(so, cha.id, cha.mocGop) : daTieuTrongThang(so, cha.id, thang);
  const hang = conCua(cac, cha.id).map((con): HangCon => {
    const x = tich ? daGopCon(con, cha, so) : daTieuCon(con, cha, so, thang);
    const p = tienDo({ ...cha, muc: con.muc }, x);
    return { con, so: x, pct: p === null ? null : Math.round(p * 100) };
  });
  const tongCon = hang.reduce((a, h) => a + h.so, 0);
  const mucCon = hang.reduce((a, h) => a + h.con.muc, 0);
  return { tongCha, hang, tongCon, chuaChia: tongCha - tongCon, mucCon, conNhan: cha.muc === null ? null : cha.muc - mucCon };
}
