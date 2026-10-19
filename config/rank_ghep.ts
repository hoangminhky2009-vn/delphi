/**
 * GHÉP BÀN XẾP HẠNG ≥ 4 NGƯỜI THẬT — phần TOÁN THUẦN (không DB, không giờ hệ thống, không Math.random).
 *
 * Nguồn luật: `docs/spec/alpha-draft-tang-khong-gian.md` mục 6 (founder CHỐT 11/10) ← `docs/khao-co/design_rank.md` §7.2–7.6 + §2.10.
 * Tầng DB + scheduler ở `server/rank_ghep.ts`; file này chỉ trả lời "ai ngồi bàn nào, mấy ghế, mấy máy".
 *
 * ─── NĂM LUẬT, MỘT DÒNG MỖI LUẬT ────────────────────────────────────────────────────────────────────────────────────────────────
 *  1. Suất đấu mỗi 15 phút (:00 :15 :30 :45); đúng giờ ghép TRONG DB — không hàng chờ mở, không polling (C1/C3, §7.2).
 *  2. n < 4 người thật ⇒ KHÔNG mở bàn ("suất này chưa đủ người"). n ≥ 4 ⇒ k = ⌈n/20⌉ bàn CHIA ĐỀU, không để 1–3 người lẻ.
 *  3. Bàn m người ⇒ thêm tối đa min(m−1, 20−m) máy: máy LUÔN ít hơn người, trần 20 ghế/trận (D515).
 *  4. Chia bàn TẤT ĐỊNH f(đăng ký, diem_ghep, HASH(slot_id + secret)); client không có input nào tác động chỗ ngồi (§7.5).
 *  5. Cỡ bàn 4/8/12/16/20 bốc theo bậc thấp nhất trong bàn (`CO_BAN_THEO_BAC`); thiếu người thật để giữ máy < người ⇒ co lại.
 *
 * ⚠ SỐ KHÔNG ĐẶT Ở ĐÂY: bảng cỡ bàn theo bậc và bảng vai theo cỡ bàn là số founder chốt, nằm cạnh `VAI_XAC_SUAT` (`config/holdem.ts`)
 *   — agent không tự đặt tham số kinh tế (A8.2). Ở đây chỉ có hằng VẬN HÀNH (phút/suất, ngưỡng 4, trần bàn đồng thời, hạn bàn).
 */
import { CO_BAN_MOC, CO_BAN_THEO_BAC, SO_GHE_TRAN_TRAN } from './holdem.js';

/** Cờ TẮT mặc định: bật bằng biến môi trường `RANK_GHEP_BAT=1` (`ghepBanBat`). Không bật trên prod khi chưa được founder gật. */
export const GHEP_BAN = {
  BAT: false,
  /** Một suất mỗi 15 phút — :00 :15 :30 :45 (giờ UTC; đúng cả giờ Việt Nam vì lệch +7 giờ nguyên). */
  PHUT_MOI_SUAT: 15,
  /** Ít nhất 4 người thật mới mở bàn xếp hạng (founder 11/10). */
  SO_NGUOI_TOI_THIEU: 4,
  /** Trần ghế một bàn = trần một trận (D515). */
  TRAN_GHE: SO_GHE_TRAN_TRAN,
  /**
   * Sàn chống thả rank (§7.5, BẬT mặc định): `diem_ghep = max(diem_hien_tai, diem_dinh − BIEN_TRUOT)`. Dìm điểm xuống vẫn bị ghép
   * với người mạnh, nên mất điểm mà không mua được bàn dễ.
   */
  BIEN_TRUOT: 150,
  /**
   * Trần số bàn rank ĐANG CHƠI đồng thời (§7.6: "beta: 4 bàn" — chặn hết quota giữa tháng). Vượt trần ⇒ người chờ sang suất sau, không mất suất.
   * Hằng VẬN HÀNH, không phải tham số kinh tế; tăng khi có số đo tải (`docs/gioi-han-ha-tang.md`).
   */
  TRAN_BAN_DONG_THOI: 4,
  /** Cửa sổ chơi của một bàn tính từ giờ suất (§7.4: 60 phút); quá hạn mà chưa xong ⇒ ghế bị coi là vắng (§7.7). */
  HAN_BAN_PHUT: 60,
} as const;

/**
 * Khoá luật của bàn xếp hạng ghép người: MẶC ĐỊNH + cờ `vaiTheoCoBan` (chia vai theo bảng 5 mốc cỡ bàn). KHÔNG phải mặc định —
 * mọi chế độ khác giữ `HOLDEM_BALANCE_VERSION`. Test canh khoá này CÓ trong `BO_LUAT_THEO_PHIEN_BAN`, mang đúng cờ, và chỉ khác mặc định đúng cờ ấy.
 * D590 (founder 11/10): mặc định lên v70 ⇒ khoá bàn ghép `balance-v71-banxephang` (v70 + cờ); `balance-v67-banxephang` (v66 + cờ) giữ cho replay.
 */
export const RANK_GHEP_KHOA_LUAT = 'balance-v71-banxephang';
/** D590 — các khoá bàn ghép ĐÃ TỪNG dùng (giữ cho replay) — chỉ chúng được mang cờ `vaiTheoCoBan` ngoài khoá hiện hành. */
export const RANK_GHEP_KHOA_CU: readonly string[] = ['balance-v67-banxephang'];

/** Câu nói thẳng khi chưa đủ người — một nguồn cho API, sảnh và test (D62: không giả vờ có người). */
export const THONG_BAO_CAN_NGUOI =
  `Xếp hạng cần ≥ ${GHEP_BAN.SO_NGUOI_TOI_THIEU} người thật. Chưa mở — chơi ĐẤU TỰ DO (không tính điểm) trong lúc chờ.`;

/** Cờ bật tính năng. `env` truyền vào để test đổi được mà không đụng `process.env` toàn cục. */
export function ghepBanBat(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const e = env.RANK_GHEP_BAT;
  if (e === '1') return true;
  if (e === '0') return false;
  return GHEP_BAN.BAT;
}

// ───────────────────────────────────────────────────────────────────────────────
// SUẤT
// ───────────────────────────────────────────────────────────────────────────────

const MS_SUAT = GHEP_BAN.PHUT_MOI_SUAT * 60_000;

/** Giờ suất KẾ TIẾP, nghiêm ngặt sau `now` (đúng :00 :15 :30 :45). */
export function suatKeTiep(now: Date): Date {
  return new Date((Math.floor(now.getTime() / MS_SUAT) + 1) * MS_SUAT);
}

/** `t` có phải một giờ suất hợp lệ không (đúng bội 15 phút, giây = 0). */
export function laGioSuat(t: Date): boolean {
  return Number.isFinite(t.getTime()) && t.getTime() % MS_SUAT === 0;
}

/** Mốc điểm ghép: `max(điểm hiện tại, đỉnh − BIEN_TRUOT)` — chốt lúc ĐĂNG KÝ. */
export function diemGhep(diemHienTai: number, diemDinh: number, bienTruot: number = GHEP_BAN.BIEN_TRUOT): number {
  return Math.max(diemHienTai, diemDinh - bienTruot);
}

// ───────────────────────────────────────────────────────────────────────────────
// SỐ BÀN · SỐ MÁY · CỠ BÀN
// ───────────────────────────────────────────────────────────────────────────────

/** Số bàn cho n người thật (n ≥ 4): k = ⌈n/20⌉. n < 4 ⇒ 0 bàn. */
export function soBan(n: number): number {
  if (!Number.isInteger(n) || n < GHEP_BAN.SO_NGUOI_TOI_THIEU) return 0;
  return Math.ceil(n / GHEP_BAN.TRAN_GHE);
}

/** Chia n người thành k bàn ĐỀU nhất (hiệu hai bàn ≤ 1): n=21,k=2 → [11,10]. Bàn đứng trước (điểm ghép cao hơn) nhận phần dư. */
export function chiaDeu(n: number, k: number): number[] {
  if (k <= 0) return [];
  const co = Math.floor(n / k);
  const du = n % k;
  return Array.from({ length: k }, (_, i) => co + (i < du ? 1 : 0));
}

/** Máy tối đa cho bàn m người: min(m−1, 20−m) — máy luôn ít hơn người, tổng ghế ≤ 20. m<1 ⇒ 0. */
export function soMayToiDa(m: number): number {
  if (!Number.isInteger(m) || m < 1) return 0;
  return Math.max(0, Math.min(m - 1, GHEP_BAN.TRAN_GHE - m));
}

/**
 * Bốc cỡ bàn (4/8/12/16/20) theo bậc THẤP NHẤT trong bàn. `u` ∈ [0,1) tất định (từ HASH). Bậc ngoài 1..7 kẹp vào đầu mút; "chưa xếp"
 * (bậc số 0) tính như bậc 1.
 */
export function bocCoBan(bacThap: number, u: number): number {
  const bac = Math.min(7, Math.max(1, Math.trunc(bacThap) || 1));
  const hang = CO_BAN_THEO_BAC[bac]!;
  const x = Math.min(0.999999999, Math.max(0, u)) * 100;
  let cong = 0;
  for (let i = 0; i < hang.length; i += 1) {
    cong += hang[i]!;
    if (x < cong) return CO_BAN_MOC[i]!;
  }
  return CO_BAN_MOC[CO_BAN_MOC.length - 1]!;
}

/**
 * Số ghế THẬT của bàn m người khi cỡ bốc được là `coBan`:
 *   S = max(m, min(coBan, 2m−1))
 *  · cỡ bốc quá lớn so với số người ⇒ CO LẠI về 2m−1 (khi đó máy = m−1, vừa đủ ít hơn người);
 *  · cỡ bốc nhỏ hơn số người ⇒ giữ nguyên m (người thật không bao giờ bị loại khỏi bàn, máy = 0).
 * Hệ quả: máy = S − m ≤ min(m−1, 20−m) ở MỌI m ∈ [1,20] (chứng minh bằng quét ở test).
 */
export function soGheBan(m: number, coBan: number): number {
  return Math.min(GHEP_BAN.TRAN_GHE, Math.max(m, Math.min(coBan, 2 * m - 1)));
}

/** Mốc cỡ bàn lớn nhất không vượt `soGhe` — hàng bảng vai áp cho bàn giữa hai mốc (`VAI_THEO_CO_BAN`). Dưới 4 ⇒ 4. */
export function mocVaiCuaBan(soGhe: number): number {
  let moc: number = CO_BAN_MOC[0];
  for (const m of CO_BAN_MOC) if (m <= soGhe) moc = m;
  return moc;
}

// ───────────────────────────────────────────────────────────────────────────────
// KẾ HOẠCH GHÉP
// ───────────────────────────────────────────────────────────────────────────────

export interface DangKy {
  userId: string;
  /** `diemGhep` chốt lúc đăng ký. */
  diemGhep: number;
  /** Bậc SỐ 1..7 hiển thị lúc đăng ký (0 = chưa xếp ⇒ tính 1). */
  bacSo: number;
  /** Thời điểm đăng ký (ms) — chỉ để quyết ai ở lại khi vượt trần bàn đồng thời (đăng ký sớm ưu tiên). */
  dangKyLuc: number;
}

export interface BanKeHoach {
  chiSo: number;
  /** userId các ghế người thật, theo thứ tự ghế (ghế 0 = điểm ghép cao nhất). */
  nguoi: string[];
  soNguoi: number;
  soMay: number;
  soGhe: number;
  /** Cỡ bốc được từ bảng theo bậc (4..20) trước khi co. */
  coBanBoc: number;
  bacThap: number;
  /** Seed 32-bit của bàn — tất định theo HASH, KHÔNG BAO GIỜ trả cho client. */
  seed: number;
}

export interface KeHoachGhep {
  trangThai: 'ghep' | 'thieu_nguoi';
  ban: BanKeHoach[];
  /** Người ở lại sang suất sau vì vượt trần bàn đồng thời (không mất suất, không phải lỗi). */
  hoan: string[];
}

/**
 * KẾ HOẠCH GHÉP MỘT SUẤT. Thuần và tất định: cùng đầu vào + cùng `bam` ⇒ cùng kế hoạch.
 * @param bam hàm băm tất định chuỗi → số nguyên không dấu 32 bit; ở server là SHA-256(slot_id + secret + ...) — client không có secret.
 * @param choTrong số bàn còn được mở thêm (trần bàn đồng thời trừ bàn đang chơi). Hết chỗ ⇒ cả suất hoãn.
 */
export function keHoachGhep(
  dangKy: readonly DangKy[],
  bam: (chuoi: string) => number,
  choTrong: number = GHEP_BAN.TRAN_BAN_DONG_THOI,
): KeHoachGhep {
  const n = dangKy.length;
  if (n < GHEP_BAN.SO_NGUOI_TOI_THIEU) return { trangThai: 'thieu_nguoi', ban: [], hoan: [] };
  if (choTrong <= 0) return { trangThai: 'ghep', ban: [], hoan: dangKy.map((d) => d.userId) };

  /* Vượt trần bàn đồng thời: giữ người ĐĂNG KÝ SỚM (hoà thì theo hash), phần còn lại hoãn sang suất sau — không bao giờ để 1–3 người lẻ ở bàn. */
  const toiDaNguoi = choTrong * GHEP_BAN.TRAN_GHE;
  let giu = [...dangKy];
  let hoan: string[] = [];
  if (n > toiDaNguoi) {
    giu.sort((a, b) => a.dangKyLuc - b.dangKyLuc || bam(`uu_tien|${a.userId}`) - bam(`uu_tien|${b.userId}`) || (a.userId < b.userId ? -1 : 1));
    hoan = giu.slice(toiDaNguoi).map((d) => d.userId);
    giu = giu.slice(0, toiDaNguoi);
  }

  /* Xếp theo điểm ghép giảm dần; hoà thì theo hash của (người, suất) — người chơi không chọn được chỗ. Rồi cắt thành k khúc ĐỀU. */
  giu.sort((a, b) => b.diemGhep - a.diemGhep || bam(`cho|${a.userId}`) - bam(`cho|${b.userId}`) || (a.userId < b.userId ? -1 : 1));
  const k = soBan(giu.length);
  const co = chiaDeu(giu.length, k);
  const ban: BanKeHoach[] = [];
  let dau = 0;
  for (let i = 0; i < k; i += 1) {
    const khuc = giu.slice(dau, dau + co[i]!);
    dau += co[i]!;
    const bacThap = Math.min(...khuc.map((d) => Math.max(1, d.bacSo)));
    const coBanBoc = bocCoBan(bacThap, bam(`co_ban|${i}`) / 0x1_0000_0000);
    const soGhe = soGheBan(khuc.length, coBanBoc);
    ban.push({
      chiSo: i,
      nguoi: khuc.map((d) => d.userId),
      soNguoi: khuc.length,
      soMay: soGhe - khuc.length,
      soGhe,
      coBanBoc,
      bacThap,
      seed: bam(`seed|${i}`) >>> 0,
    });
  }
  return { trangThai: 'ghep', ban, hoan };
}

// ───────────────────────────────────────────────────────────────────────────────
// XẾP HẠNG TRONG NHÓM (cho điểm người–người)
// ───────────────────────────────────────────────────────────────────────────────

export interface KetQuaNguoi {
  userId: string;
  /** Đã nộp đủ trận chưa; `false` ⇒ ghế vắng (hết hạn mà chưa xong). */
  xong: boolean;
  /** Đầu hàng: THUA LUÔN, không được tính hạng (founder 20/07) — xếp dưới mọi người chưa đầu hàng. */
  dauHang: boolean;
  /** NAV cuối trận (nguyên). Chỉ có nghĩa khi `xong`. */
  nav: number;
}

/**
 * Chia nhóm người thành CÁC TẦNG hạng, tốt nhất trước. Cùng tầng ⇒ hoà (cặp đó chuyển 0 điểm).
 *   tầng theo NAV giảm dần cho người xong và không đầu hàng (NAV bằng nhau ⇒ cùng tầng) · rồi một tầng đầu hàng · rồi một tầng vắng.
 * Điểm chỉ chuyển giữa HAI người khác tầng ⇒ tổng luôn bằng 0 (cùng khuôn `deltaTran`).
 */
export function tangHang(kq: readonly KetQuaNguoi[]): string[][] {
  const choi = kq.filter((x) => x.xong && !x.dauHang).sort((a, b) => b.nav - a.nav);
  const tang: string[][] = [];
  for (const x of choi) {
    const cuoi = tang[tang.length - 1];
    const navCuoi = cuoi ? choi.find((y) => y.userId === cuoi[0])!.nav : null;
    if (cuoi && navCuoi === x.nav) cuoi.push(x.userId);
    else tang.push([x.userId]);
  }
  const dau = kq.filter((x) => x.xong && x.dauHang).map((x) => x.userId);
  if (dau.length > 0) tang.push(dau);
  const vang = kq.filter((x) => !x.xong).map((x) => x.userId);
  if (vang.length > 0) tang.push(vang);
  return tang;
}
