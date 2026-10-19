/**
 * LẦN ĐẦU VÀO ĐẤU TRƯỜNG ⇒ VÀO THẲNG MÀN TẬP (D336 lượt 2, founder 15/09).
 *
 * Nguyên văn: *"từ bây giờ khi bấm vào chọn alpha draft ở sảnh lần đầu tiên thì user sẽ được điều
 * ngay vào phòng tập, sau khi hoàn thành hoặc bỏ qua thì sẽ ko còn bị điều hướng nữa, ai muốn chơi
 * lại thì lướt xuống cuối."*
 *
 * ─── AI LÀ "LẦN ĐẦU" ────────────────────────────────────────────────────────
 * · Server nói: `so_tran_xong === 0` (`/holdem/me/tien-do` — đếm `holdem_results`, trận tập XONG
 *   cũng đếm). Người đã xong bất kỳ trận nào — kể cả trước ngày có luật này — không bị kéo đi đâu.
 * · Máy nói: chưa từng BỎ QUA. Bỏ qua không để lại dòng nào ở server (Oracle "BỎ QUA ✕", thoát
 *   bàn tập), nên nó nằm ở kho trình duyệt. Hệ quả chấp nhận được ở mùa này (A11.1): người bỏ qua
 *   trên điện thoại rồi mở máy khác thì bị dắt vào bàn tập MỘT lần nữa, và bỏ qua được ngay.
 * · KHÔNG kéo khi người ta tới vì một việc khác: link mời bàn (`/arena/ban/<mã>` — buổi đo cả lớp
 *   đang chờ), `?seed=` của tester, điểm quay về của chuỗi đăng ký buổi đo.
 * · Đang dở MỘT trận khác ⇒ không kéo (sảnh có thẻ TIẾP TỤC). Đang dở chính bàn tập mình được dắt
 *   vào ⇒ dắt về đúng bàn ấy (kèm `?tap=1`), không dựng bàn thứ hai.
 *
 * ─── VÌ SAO KHO TRÌNH DUYỆT HỎNG THÌ COI NHƯ "ĐÃ QUA" ──────────────────────
 * Không nhớ được cú bỏ qua ⇒ mỗi lần vào Đấu trường lại bị kéo vào bàn tập — một vòng lặp không lối
 * ra. Thà để người ở chế độ riêng tư tự tìm màn tập ở cuối sảnh.
 *
 * ⚠ C4: tệp này không đếm trận, không suy luật — chỉ đọc số server trả và cờ trình bày của máy.
 */
const KHOA = 'delphi:man-tap:da-qua';
const KHOA_TRAN = 'delphi:man-tap:tran';

/** Vì sao thôi dắt: xong bàn tập · tự bỏ qua · đã có trận xong từ trước (người chơi cũ). */
export type LyDoQuaManTap = 'xong' | 'bo_qua' | 'da_choi';

export function daQuaManTap(): boolean {
  try {
    return window.localStorage.getItem(KHOA) !== null;
  } catch {
    return true;
  }
}

/** D544 — lý do đã qua màn tập (null = chưa qua / không đọc được). Sảnh đọc để biết người chơi vừa XONG bàn tập (không phải bỏ qua). */
export function lyDoQuaManTap(): LyDoQuaManTap | null {
  try { return window.localStorage.getItem(KHOA) as LyDoQuaManTap | null; } catch { return null; }
}

/*
 * D544 — Delphi chỉ Bách khoa ở sảnh MỘT lần sau bàn tập. Nhớ ở máy; hỏng bộ nhớ ⇒ coi như đã chỉ (không làm phiền mãi).
 */
const KHOA_CHI_BK = 'delphi:sanh:da-chi-bach-khoa';
export function daChiBachKhoa(): boolean {
  try { return window.localStorage.getItem(KHOA_CHI_BK) !== null; } catch { return true; }
}
export function ghiDaChiBachKhoa(): void {
  try { window.localStorage.setItem(KHOA_CHI_BK, '1'); } catch { /* chế độ riêng tư */ }
}

/** Ghi MỘT lần — lý do đầu tiên thắng (xong rồi mới bấm BỎ QUA thì vẫn là "xong"). */
export function danhDauQuaManTap(lyDo: LyDoQuaManTap): void {
  try {
    if (window.localStorage.getItem(KHOA) === null) window.localStorage.setItem(KHOA, lyDo);
  } catch { /* chế độ riêng tư — `daQuaManTap` đã coi như qua */ }
}

/** Nhớ id bàn tập vừa dựng — để sảnh dắt về đúng bàn ấy kèm trợ lý, không dựng bàn thứ hai. */
export function nhoTranTap(matchId: string): void {
  try { window.localStorage.setItem(KHOA_TRAN, matchId); } catch { /* không nhớ được thì thôi */ }
}

export function tranTapDaNho(): string | null {
  try { return window.localStorage.getItem(KHOA_TRAN); } catch { return null; }
}

export interface BoiCanhVaoSanh {
  /** Máy đã ghi "đã qua màn tập". */
  daQuaMay: boolean;
  /** `so_tran_xong` của server: `undefined` = chưa có số MỚI, `null` = hỏi lỗi. */
  soTranXong: number | null | undefined;
  /** Trận `dang_choi` của mình: `undefined` = chưa có số mới, `null` = hỏi lỗi. */
  tranMo: readonly { match_id: string; tiep_duoc: boolean }[] | null | undefined;
  /** Id bàn tập đã nhớ (`nhoTranTap`). */
  tranTap: string | null;
  /** Tới sảnh vì một việc khác (link bàn · ép seed · chuỗi đăng ký buổi đo). */
  coViecKhac: boolean;
}

export type QuyetDinhVaoSanh =
  | { loai: 'cho' }
  | { loai: 'sanh'; ghi?: LyDoQuaManTap }
  | { loai: 'tiep_tap'; matchId: string }
  | { loai: 'tao_tap' };

/** Hàm THUẦN — sảnh và bài canh gọi cùng một hàm. */
export function quyetDinhVaoSanh(b: BoiCanhVaoSanh): QuyetDinhVaoSanh {
  if (b.daQuaMay || b.coViecKhac) return { loai: 'sanh' };
  // Hỏi lỗi ⇒ để người ta vào sảnh. Kéo người vào bàn tập dựa trên một câu trả lời không có là đoán.
  if (b.soTranXong === null || b.tranMo === null) return { loai: 'sanh' };
  if (b.soTranXong === undefined || b.tranMo === undefined) return { loai: 'cho' };
  if (b.soTranXong > 0) return { loai: 'sanh', ghi: 'da_choi' };
  const mo = b.tranMo.filter((t) => t.tiep_duoc);
  if (b.tranTap !== null && mo.some((t) => t.match_id === b.tranTap)) {
    return { loai: 'tiep_tap', matchId: b.tranTap };
  }
  if (mo.length > 0) return { loai: 'sanh' };
  return { loai: 'tao_tap' };
}
