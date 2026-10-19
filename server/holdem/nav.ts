/**
 * LÕI NAV v10 — hàm THUẦN cho vị thế có kích cỡ tiền (D40 + spec 01).
 *
 * Module RIÊNG, không import engine.ts — engine sẽ import ngược lại module này
 * ở chặng nối (v10b), và một vòng import là build chết câm. Mọi hàm ở đây:
 * · số nguyên tuyệt đối (C5), làm tròn LUÔN LÀ FLOOR (A5);
 * · tất định — không Date, không random;
 * · test vector tính tay đi TRƯỚC (tests/holdem_nav.test.ts, A8.3).
 *
 * BẤT BIẾN HỆ KÍN (test khoá): không chuỗi lệnh nào làm NAV tăng. Tiền chỉ rời
 * người chơi qua trượt giá (→ Quỹ vòng) và lạm phát (→ đốt); định giá là phép
 * nhân trên vị thế, không sinh không huỷ ngoài floor.
 */
import {
  BAN_KHONG_LENH, DAC_QUYEN, HOLDEM_MATCH, NAV_V10, PHI_LENH_V50, PHI_LENH_V51, SUC_CANG, TAI_SAN,
} from '../../config/holdem.js';

/** Phần trạng thái ghế mà lõi NAV cần — `Ghe` của engine thoả cấu trúc này. */
export interface GheNav {
  /** Tiền mặt (tên `von` giữ nguyên: mọi phí hiện có đã trừ vào đúng trường này). */
  von: number;
  /** Giá trị hiện tại từng vị thế, theo chip. KHÔNG có ô 0 — bán sạch là xoá ô. */
  vi_the: Record<string, number>;
  /**
   * v17 — KÝ QUỸ KHỐNG theo mã: mã rơi thì nở, mã tăng thì teo, về 0 là cháy
   * lệnh (xoá ô). Trường OPTIONAL để mọi GheNav cũ trong test khỏi sửa.
   */
  vi_the_khong?: Record<string, number>;
  /**
   * v45 (D318) — VỊ THẾ Ở CUỐI Ô TRƯỚC, dùng cho luật "phải giữ ĐỦ MỘT Ô mới ăn coupon".
   *
   * ⚠ Đây là ảnh chụp CUỐI ô N−1, đọc ở ô N SAU khi lệnh của ô N đã áp. Nên
   * `min(ảnh_chụp, hiện_tại)` chính là phần đã nằm im TRỌN một ô:
   *   · vừa mua ở ô này  ⇒ ảnh chụp 0        ⇒ min 0      ⇒ không coupon;
   *   · giữ nguyên        ⇒ ảnh chụp = hiện tại ⇒ min = cả ⇒ coupon đủ;
   *   · bán bớt           ⇒ min = phần còn lại ⇒ coupon trên phần đã trụ;
   *   · mua thêm          ⇒ min = phần cũ     ⇒ phần mới chưa được tính.
   * Vắng (trận cũ / ô 1) ⇒ coi như 0 ⇒ không coupon, đúng: ô 1 là ô vừa mua vào.
   *
   * ⚠ HAI TRƯỜNG RIÊNG chứ không một record có tiền tố: bản đầu nhét sổ khống vào
   * cùng record bằng khoá `k:<mã>`. Gọn hơn ba dòng, nhưng nó là một quy ước NGẦM
   * mà TypeScript không canh được — ai đọc `vi_the_o_truoc['tpcp']` sẽ tưởng mình
   * đã lấy đủ. Hai trường thì kiểu nói hộ.
   */
  vi_the_o_truoc?: Readonly<Record<string, number>>;
  /** v45 — ký quỹ khống ở cuối ô trước. Cùng vai, cùng luật `min` với trường trên. */
  vi_the_khong_o_truoc?: Readonly<Record<string, number>>;
  /**
   * v43 (D314) — SỔ TIẾT KIỆM. Lõi NAV chỉ cần hai số của mỗi hợp đồng, không cần kỳ
   * hạn hay lãi suất — nên kiểu ở đây hẹp hơn `HopDongTietKiem` của engine, cố ý:
   * `nav.ts` là lõi tiền thuần, không biết gì về vòng hay luật.
   */
  tiet_kiem?: readonly { goc: number; lai_don: number }[];
}

export type LoiLenh =
  | 'khong_du_tien' | 'khong_du_vi_the' | 'ma_khong_ton_tai'
  | 'day_tai_san' | 'lenh_khong_hop_le'
  | 'qua_tran_khong' | 'can_la_ban_khong'
  /** v34 — mandate tổ chức: mua làm một mã vượt trần % NAV · mở khống. */
  | 'mandate_ma' | 'mandate_khong'
  /**
   * v42 (D311) — SÀN KHÔNG CHO KHỐNG MÃ NÀY (`TaiSan.khong_duoc === false`).
   * Khác `can_la_ban_khong` (thiếu lá) và `mandate_khong` (vai cấm): đây là ranh
   * giới của THỊ TRƯỜNG, không phải của người chơi — sàn Việt Nam không có bán
   * khống cổ phiếu cơ sở. Chỉ chặn lệnh MỞ; `dong_khong` không bao giờ bị chặn.
   */
  | 'khong_cam_san'
  /**
   * v55 — trait: GÔNG CÙM (tiền BÁN cộng dồn trong vòng vượt trần NAV — D425; bản D409 là trần MUA) · SỔ MỎNG (lệnh MUA /
   * MỞ KHỐNG không còn gì sau trượt + phí cố định — D425). `cam_moc` của CẤM TẤT TAY gỡ cùng lá (D425).
   */
  | 'gong_cum' | 'so_mong';

/** v34 — ràng buộc mandate của vai tổ chức (xem `MANDATE_TO_CHUC`). */
export interface Mandate { tranMaBp: number; camKhong: boolean; /** D498 — Tổ Chức khung minigame: không margin (không lõi Đòn Bẩy). */ camDonBay?: true }

/**
 * Một lệnh giao dịch: `tien` dương = MUA từ tiền mặt, âm = BÁN về tiền mặt.
 * `khong: true` (v17) chuyển cùng ngữ nghĩa sang SỔ KHỐNG: dương = mở ký quỹ
 * từ tiền mặt, âm = đóng ký quỹ về tiền mặt.
 */
export interface LenhGiaoDich { ma: string; tien: number; khong?: true }

/** NAV = tiền mặt + tổng giá trị danh mục. Thước xếp hạng DUY NHẤT của v10. */
export function navCua(g: GheNav): number {
  let tong = g.von;
  for (const v of Object.values(g.vi_the)) tong += v;
  // v17 — ký quỹ khống là tài sản của ghế (đã gồm lãi/lỗ tích luỹ).
  for (const v of Object.values(g.vi_the_khong ?? {})) tong += v;
  /*
   * v43 (D314) — HỢP ĐỒNG TIẾT KIỆM: cộng CẢ gốc LẪN lãi treo.
   *
   * ⚠ Gộp lãi treo vào NAV là một quyết định có cân nhắc, không phải mặc định. Bản nháp
   * đầu để NAV chỉ gồm gốc ("huỷ = mất thứ chưa có"), nhưng như thế NAV nhảy cục ở đúng
   * vòng đáo hạn và quỹ vòng thưởng nhầm cho cú đáo hạn thay vì cho việc đọc chợ. Gộp
   * vào thì NAV mượt, và HUỶ trở thành một cú TỤT THẤY ĐƯỢC ngay vòng huỷ — hình phạt
   * là tiền trên màn, không phải một câu chữ trong luật.
   * ⚠ Hệ quả phải nhớ: `daChayNav` đọc `navCua`, nên gửi tiết kiệm KHÔNG cứu khỏi cháy.
   * Đúng luật spec 02 §3.3 ("khoá không cứu") — tiền vẫn là tiền của bạn.
   */
  for (const h of g.tiet_kiem ?? []) tong += h.goc + h.lai_don;
  return tong;
}

/**
 * v43 (D314) — NAV TỰ DO: phần NAV còn rút ra được, tức trừ đi tiền đang khoá trong sổ
 * tiết kiệm. Dùng cho "sức đóng" ở vòng cược nền.
 *
 * ⚠ Không có hàm này thì ghế gửi hết tiền không có gì nộp nền, và NAV RÒ ra khỏi hệ kín
 * — engine trừ một khoản mà không ghế nào trả được.
 */
export function navTuDo(g: GheNav): number {
  let khoa = 0;
  for (const h of g.tiet_kiem ?? []) khoa += h.goc + h.lai_don;
  return navCua(g) - khoa;
}

/**
 * v17 — TRẦN TỔNG KÝ QUỸ KHỐNG của ghế lúc này, và phần ĐANG khống.
 *
 * ⚠ MỘT NGUỒN cho hai câu hỏi (D61): `apLenhGiaoDich` hỏi "lệnh này có vượt trần không",
 * `hanMucKhongCon` (v49) hỏi "còn khống được bao nhiêu". Hai bản công thức NAV khác nhau một
 * chút (ví dụ một bản gộp sổ tiết kiệm, bản kia không) là chip 100% bị chính server bác.
 * NAV ở đây KHÔNG gồm sổ tiết kiệm — đúng như phép kiểm trần có từ v17.
 */
export function tranKhong(
  von: number, viThe: Readonly<Record<string, number>>, viKhong: Readonly<Record<string, number>>,
): { tran: number; dang: number } {
  const dang = Object.values(viKhong).reduce((a, b) => a + b, 0);
  const nav = von + Object.values(viThe).reduce((a, b) => a + b, 0) + dang;
  return { tran: Math.floor((nav * BAN_KHONG_LENH.TRAN_BP) / 10000), dang };
}

/**
 * v49 (D342) — HẠN MỨC KHỐNG CÒN LẠI: trần trừ phần đang khống, không quá tiền mặt (ký quỹ
 * đặt bằng tiền mặt), không âm (giá chạy có thể đẩy sổ khống vượt trần — khi ấy chỉ là hết chỗ).
 *
 * Là cái nền của chip KHỐNG 25/50/75/100% khi cổng `khongTheoHanMuc` bật. Trước đó chip tính
 * trên TIỀN MẶT mà trần lại là 30% NAV ⇒ 50–100% gần như luôn vượt ⇒ cả chuỗi bị bác (trận
 * founder 16/09: vòng 4 và 6 mất luôn lệnh bán đi kèm).
 */
export function hanMucKhongCon(g: GheNav): number {
  const { tran, dang } = tranKhong(g.von, g.vi_the, g.vi_the_khong ?? {});
  return Math.max(0, Math.min(g.von, tran - dang));
}

const truotBpCua = (ma: string, nhe = false, bac = false): number | null => {
  const ts = TAI_SAN.find((t) => t.id === ma);
  if (!ts) return null;
  // v51 (D346) — bậc 1 rẻ như ngoài đời; v50 — bảng gốc nhẹ; trước đó — bảng NAV_V10.
  if (bac) return PHI_LENH_V51.GOC_BP[ts.thanh_khoan];
  return nhe ? PHI_LENH_V50.TRUOT_GIA_BP[ts.thanh_khoan] : NAV_V10.TRUOT_GIA_BP[ts.thanh_khoan];
};

/**
 * v51 (D346) — TRƯỢT GIÁ HAI BẬC của MỘT lệnh, trước khi nhân hệ số vai.
 *
 * Bậc 1 (`NGUONG_BP` đầu, đo trên ĐỘ SÂU CHỢ — không trên vốn riêng của vai) trả đúng `gocBp`; phần
 * VƯỢT chịu hệ số luỹ tiến theo chính cỡ phần vượt, kẹp `TRAN_BP`. Đây là chỗ DUY NHẤT hãm lối "dồn
 * hết vốn trong một vòng" mà không làm lệnh vừa đắt lên — xem bảng đo ở `PHI_LENH_V51`.
 *
 * ⚠ Hai lần floor có chủ ý (bậc 1 và bậc 2 tách nhau) — cùng kỷ luật số nguyên A5.1: mỗi bậc là một
 * phép nhân trên cỡ tiền của bậc đó, không phải một phép nhân trên tổng.
 */
export function truotBacV51Bp(tien: number, sau: number = PHI_LENH_V50.DO_SAU_THI_TRUONG): number {
  const t2 = Math.max(0, Math.abs(tien) - Math.floor((sau * PHI_LENH_V51.NGUONG_BP) / 10000));
  return Math.min(PHI_LENH_V51.TRAN_BP, 10000 + Math.floor((PHI_LENH_V51.DOC_BP * t2) / sau));
}

/** D516 — `sau` = độ sâu chợ của GHẾ (`phiSauVaiV57`); vắng = độ sâu chung (≤ v56 replay nguyên). */
export function truotBacV51(tienAbs: number, gocBp: number, sau: number = PHI_LENH_V50.DO_SAU_THI_TRUONG): number {
  const nguong = Math.floor((sau * PHI_LENH_V51.NGUONG_BP) / 10000);
  const t1 = Math.min(tienAbs, nguong);
  const t2 = tienAbs - t1;
  return Math.floor((t1 * gocBp) / 10000)
    + Math.floor((Math.floor((t2 * gocBp) / 10000) * truotBacV51Bp(tienAbs, sau)) / 10000);
}

/**
 * v50 (D345) — HỆ SỐ VỘI VÀNG theo CỠ TIỀN TUYỆT ĐỐI so với độ sâu chợ (`PHI_LENH_V50`). Khác
 * `heSoVoiVangBp` ở đúng một chỗ có chủ ý: mẫu số là ĐỘ SÂU CHỢ chung, không phải vốn riêng của vai —
 * lệnh 30.000 đẩy giá mạnh hơn lệnh 10.000 bất kể ai đặt, nên vai nhiều tiền mới chịu nặng (founder).
 */
export function heSoVoiVangV50Bp(tien: number, sau: number = PHI_LENH_V50.DO_SAU_THI_TRUONG): number {
  return Math.min(PHI_LENH_V50.TRAN_BP,
    10000 + Math.floor((Math.abs(tien) * PHI_LENH_V50.DOC_BP) / sau));
}

/**
 * v29 — HỆ SỐ VỘI VÀNG (bp) theo CỠ LỆNH: lệnh càng to so với độ sâu sổ
 * (quy ước = vốn khởi điểm) thì trượt càng nặng, luỹ tiến, kẹp trần. Xem
 * docstring `NAV_V10.VOI_VANG` cho toàn bộ lý do — ba việc một cần gạt.
 * THUẦN + số nguyên: client `xemTruocLenh` bundle được, hai màn một con số.
 */
export function heSoVoiVangBp(
  tien: number,
  /**
   * v34 — ĐỘ SÂU SỔ QUY CHIẾU. Mặc định START_VON (y nguyên v29–v33). Với vai
   * vốn to, engine truyền VỐN KHỞI ĐIỂM CỦA VAI: ghế 30k đặt 50% vốn chịu đúng
   * hệ số như ghế 10k đặt 50% — "vốn to đẩy giá mạnh hơn" là việc của
   * `tacDongGia` (một hiệu ứng, MỘT cần gạt). Không quy chiếu thì ghế ×3 chạm
   * trần hệ số ngay ở lệnh 50%, tức bị phạt ngầm qua cần gạt chưa ai đặt cho vai.
   */
  quyChieu: number = HOLDEM_MATCH.START_VON,
): number {
  const t = Math.abs(tien);
  return Math.min(NAV_V10.VOI_VANG.TRAN_BP,
    10000 + Math.floor((t * NAV_V10.VOI_VANG.DOC_BP) / quyChieu));
}

/**
 * Áp MỘT CHUỖI lệnh như MỘT KHỐI — hỏng một lệnh là không áp lệnh nào.
 *
 * Vì sao nguyên khối: chuỗi lệnh nằm trong `action_log`, là nguồn dựng lại trận.
 * Áp nửa chừng nghĩa là log ghi một nửa sự thật và replay dựng lại đúng một nửa.
 * Nên chạy thử trên BẢN NHÁP, chỉ chép về ghế thật khi cả chuỗi sạch.
 *
 * Trượt giá tính trên CỠ LỆNH × thanh khoản của mã (chi phí tập trung chính của
 * v10 — D40). Phần trượt trả về `phi_quy` để tầng gọi gom vào Quỹ vòng.
 */
export function apLenhGiaoDich(
  g: GheNav, lenh: readonly LenhGiaoDich[],
  opts?: {
    maxTaiSan?: number; voiVang?: boolean; tacDongGia?: number; mandate?: Mandate;
    /** v34 — độ sâu sổ quy chiếu cho phí vội vàng (vốn khởi điểm của vai). Xem `heSoVoiVangBp`. */
    vonQuyChieu?: number;
    /** v50 (D345) — phí mua bán nhẹ: bảng `PHI_LENH_V50`, vội vàng theo cỡ tiền tuyệt đối. */
    phiLenhNhe?: boolean;
    /** v50 (D345) — phần phí lệnh CÒN LẠI (bp) của ghế cầm Khớp Nhanh; vắng = trả đủ. */
    phiLenhConBp?: number;
    /** v51 (D346) — phí HAI BẬC: bậc 1 giá ngoài đời, phần vượt bị đẩy giá. Cần `phiLenhNhe`. */
    phiLenhBac?: boolean;
    /** D516 — độ sâu chợ của ghế (bp, 10000 = ×1) cho phí v50/v51 (`phiSauVaiV57`, `sauPhiVaiBp`). Vắng = ×1. Cần `phiLenhNhe`. */
    sauBp?: number;
    /** v55 (D409) — hệ số trượt giá RIÊNG GHẾ (lửa), 10000 = ×1. */
    heSoTruotBp?: number;
    /** v55 (D409) — Mua Đuổi MUỘN: lệnh MUA vào nhóm rủi ro trượt thêm hệ số này. */
    heSoTruotMuaRuiRoBp?: number;
    /**
     * v55 (D425) — GÔNG CÙM: tiền BÁN (bán dài + đóng khống) cộng dồn trong vòng không vượt `tranTien`; `daBan` = đã bán
     * trước chuỗi này. Chỉ lệnh của người/bot đi qua hàm này — ký quỹ, đáo hạn, đầu hàng không bị trần.
     */
    tranBanVong?: { tranTien: number; daBan: number };
    /** v55 (D409) — mốc lệnh được thêm (LỆNH MỊN). `giaiLenhMoc` đọc; `apLenhGiaoDich` bỏ qua. */
    mocThem?: readonly number[];
    /**
     * v55 (D425) — SỔ MỎNG: phí CỐ ĐỊNH (chip) trừ vào MỖI lệnh, ĐỐT (không vào `phi_quy`). Lệnh MUA / MỞ KHỐNG không còn gì
     * sau trượt + phí ⇒ `so_mong`; lệnh BÁN / ĐÓNG nhỏ hơn phí thì tiền về 0 chứ không bị chặn (không nhốt ai trong mã).
     */
    phiCoDinhLenh?: number;
    /**
     * v56 (D447) — tiền ĐÃ đổi tay theo mã trong vòng TRƯỚC chuỗi này. Có mặt (và `phiLenhBac` bật) ⇒ phí bậc hai
     * tính trên TỔNG cộng dồn: lệnh trả F(đã đổi + lệnh) − F(đã đổi), F = `truotBacV51`. Bấm HẾT một lần hay chia nhỏ
     * nhiều lần (trong chuỗi, hay qua nhiều lần khớp trong vòng) trả cùng một phí. Vắng ⇒ từng lệnh tính từ 0 (≤ v55).
     */
    daDoiMa?: Readonly<Record<string, number>>;
  },
): { loi: LoiLenh | null; phi_quy: number; phi_dot?: number } {
  const maxTaiSan = opts?.maxTaiSan ?? HOLDEM_MATCH.MAX_TAI_SAN;
  /*
   * v34 — MANDATE TỔ CHỨC. Kiểm ở ĐÂY (không ở API) vì đây là hàm client xem
   * trước cũng gọi: server từ chối mà màn không báo trước thì người chơi xếp
   * một chip ALL-IN, bấm CHỐT rồi mới biết vai mình không được phép (C4/D67).
   */
  const mandate = opts?.mandate;
  const daMua = new Set<string>();
  /*
   * v34 — hệ số tác động giá theo VAI, nhân vào trượt giá. Vắng = 1 (trận cũ,
   * client xem trước không truyền ⇒ vẫn ra đúng số cũ). Client PHẢI truyền cùng
   * số để "DANH MỤC SAU LỆNH" báo đúng phí (lớp lỗi "báo 140 trừ 190", D67).
   */
  const tacDong = opts?.tacDongGia ?? 1;
  /*
   * v29 — trượt hiệu dụng = trượt gốc × hệ số vội vàng theo CỠ. Cờ tắt ⇒ đúng
   * số học cũ từng chip (cổng `phiVoiVang` — trận cũ replay nguyên).
   */
  const nhe = opts?.phiLenhNhe === true;
  const bac = nhe && opts?.phiLenhBac === true;
  // v56 (D447) — sổ đổi tay theo mã của RIÊNG chuỗi này (bản sao — cộng dồn từng lệnh, vứt đi nếu chuỗi hỏng).
  const doiMa: Record<string, number> | null = bac && opts?.daDoiMa !== undefined ? { ...opts.daDoiMa } : null;
  // D516 — độ sâu chợ của RIÊNG ghế (vai vốn to, `phiSauVaiV57`): một phép nhân, floor một lần.
  const sau = nhe && opts?.sauBp !== undefined && opts.sauBp !== 10000
    ? Math.floor((PHI_LENH_V50.DO_SAU_THI_TRUONG * opts.sauBp) / 10000) : PHI_LENH_V50.DO_SAU_THI_TRUONG;
  const tinhTruot = (tienAbs: number, truotBp: number, heSoBp = 10000, ma?: string): number => {
    const daDoi = doiMa !== null && ma !== undefined ? (doiMa[ma] ?? 0) : null;
    if (daDoi !== null && ma !== undefined) doiMa![ma] = daDoi + tienAbs;
    const goc = bac
      // v51 (D346) — hai bậc: `NGUONG_BP` đầu giá gốc, phần vượt mới luỹ tiến.
      // v56 (D447) — trên đường phí của TỔNG đổi tay ở mã trong vòng: phần của lệnh này = F(sau) − F(trước).
      ? (daDoi !== null
        ? truotBacV51(daDoi + tienAbs, truotBp, sau) - truotBacV51(daDoi, truotBp, sau)
        : truotBacV51(tienAbs, truotBp, sau))
      : nhe
      // v50 (D345) — vội vàng luôn bật, theo cỡ tiền tuyệt đối (không theo vốn riêng của vai).
      ? Math.floor((tienAbs * Math.floor((truotBp * heSoVoiVangV50Bp(tienAbs, sau)) / 10000)) / 10000)
      : opts?.voiVang === true
        ? Math.floor((tienAbs
          * Math.floor((truotBp * heSoVoiVangBp(tienAbs, opts?.vonQuyChieu)) / 10000)) / 10000)
        : Math.floor((tienAbs * truotBp) / 10000);
    // Nhân SAU cùng, làm tròn MỘT lần — `tacDong` là số thập phân (0,5 / 2).
    const theoVai = tacDong === 1 ? goc : Math.floor(goc * tacDong);
    // v50 (D345) — Khớp Nhanh: phần còn lại, floor một lần cuối.
    const co = nhe && opts?.phiLenhConBp !== undefined
      ? Math.floor((theoVai * opts.phiLenhConBp) / 10000) : theoVai;
    // v55 (D409) — lửa/trait/Mua Đuổi muộn nhân SAU CÙNG: đúng nghĩa 'trượt giá của riêng ghế này', không đụng bảng phí chung.
    return heSoBp === 10000 ? co : Math.floor((co * heSoBp) / 10000);
  };
  let von = g.von;
  const viThe: Record<string, number> = { ...g.vi_the };
  const viKhong: Record<string, number> = { ...(g.vi_the_khong ?? {}) };
  let phiQuy = 0;
  // v55 (D425) — phí cố định ĐÃ ĐỐT (SỔ MỎNG): trả ra để bản nháp in "phí mua bán" đủ; không vào Quỹ vòng.
  let phiDot = 0;
  // v55 — hệ số trượt riêng ghế (lửa) + trần BÁN cộng dồn (GÔNG CÙM) + phí cố định mỗi lệnh (SỔ MỎNG) — D425.
  const heSoChung = opts?.heSoTruotBp ?? 10000;
  const heSoMuaRuiRo = (ma: string): number => {
    const x = opts?.heSoTruotMuaRuiRoBp;
    if (x === undefined || TAI_SAN.find((t) => t.id === ma)?.nhom !== 'rui_ro') return heSoChung;
    return Math.floor((heSoChung * x) / 10000);
  };
  let daBanVong = opts?.tranBanVong?.daBan ?? 0;
  const quaTranBan = (tien: number): boolean =>
    opts?.tranBanVong !== undefined && daBanVong + tien > opts.tranBanVong.tranTien;
  const phiCoDinh = opts?.phiCoDinhLenh ?? 0;
  // Tiền VỀ của lệnh bán/đóng sau phí cố định — kẹp 0 (phí nuốt hết lệnh nhỏ, không đòi thêm). Không phí ⇒ nguyên số cũ.
  const veSauPhi = (tien: number): number => (phiCoDinh > 0 ? Math.max(0, tien - phiCoDinh) : tien);
  for (const l of lenh) {
    if (!Number.isInteger(l.tien) || l.tien === 0) {
      return { loi: 'lenh_khong_hop_le', phi_quy: 0 };
    }
    const truotBp = truotBpCua(l.ma, nhe, bac);
    if (truotBp === null) return { loi: 'ma_khong_ton_tai', phi_quy: 0 };

    /*
     * ─── v17 — SỔ KHỐNG (doc 05) ─────────────────────────────────────────
     * Cùng số học với sổ dài (trượt giá 2 đầu vào Quỹ vòng), khác hai luật:
     * trần TỔNG ký quỹ so NAV (chống dồn hết vào cửa xuống) và không đếm vào
     * trần SỐ MÃ dài — khống là vị thế độc lập, không phải "cầm mã".
     */
    if (l.khong === true) {
      if (l.tien > 0) {
        if (mandate?.camKhong) return { loi: 'mandate_khong', phi_quy: 0 };
        if (l.tien > von) return { loi: 'khong_du_tien', phi_quy: 0 };
        // Trần đọc từ `tranKhong` — MỘT nguồn với hạn mức chip (v49).
        const { tran, dang } = tranKhong(von, viThe, viKhong);
        if (dang + l.tien > tran) {
          return { loi: 'qua_tran_khong', phi_quy: 0 };
        }
        const truot = tinhTruot(l.tien, truotBp, heSoChung, l.ma);
        if (phiCoDinh > 0 && l.tien - truot <= phiCoDinh) return { loi: 'so_mong', phi_quy: 0 };
        von -= l.tien;
        viKhong[l.ma] = (viKhong[l.ma] ?? 0) + l.tien - truot - phiCoDinh;
        phiQuy += truot;
        phiDot += phiCoDinh;
      } else {
        const dong = -l.tien;
        const dang = viKhong[l.ma] ?? 0;
        if (dong > dang) return { loi: 'khong_du_vi_the', phi_quy: 0 };
        if (quaTranBan(dong)) return { loi: 'gong_cum', phi_quy: 0 };
        const truot = tinhTruot(dong, truotBp, heSoChung, l.ma);
        daBanVong += dong;
        const ve = veSauPhi(dong - truot);
        phiDot += dong - truot - ve;
        von += ve;
        phiQuy += truot;
        const conLai = dang - dong;
        if (conLai > 0) viKhong[l.ma] = conLai;
        else delete viKhong[l.ma];
      }
      continue;
    }

    if (l.tien > 0) {
      if (l.tien > von) return { loi: 'khong_du_tien', phi_quy: 0 };
      // Trần đếm VỊ THẾ đồng thời (spec 01 §4 — founder chốt 3, Đa Dạng Hoá nới).
      if (!(l.ma in viThe) && Object.keys(viThe).length >= maxTaiSan) {
        return { loi: 'day_tai_san', phi_quy: 0 };
      }
      const truot = tinhTruot(l.tien, truotBp, heSoMuaRuiRo(l.ma), l.ma);
      if (phiCoDinh > 0 && l.tien - truot <= phiCoDinh) return { loi: 'so_mong', phi_quy: 0 };
      von -= l.tien;
      viThe[l.ma] = (viThe[l.ma] ?? 0) + l.tien - truot - phiCoDinh;
      phiDot += phiCoDinh;
      phiQuy += truot;
      daMua.add(l.ma);
    } else {
      const ban = -l.tien;
      const dang = viThe[l.ma] ?? 0;
      if (ban > dang) return { loi: 'khong_du_vi_the', phi_quy: 0 };
      if (quaTranBan(ban)) return { loi: 'gong_cum', phi_quy: 0 };
      const truot = tinhTruot(ban, truotBp, heSoChung, l.ma);
      daBanVong += ban;
      const ve = veSauPhi(ban - truot);
      phiDot += ban - truot - ve;
      von += ve;
      phiQuy += truot;
      const conLai = dang - ban;
      if (conLai > 0) viThe[l.ma] = conLai;
      else delete viThe[l.ma];
    }
  }

  /*
   * Mandate kiểm SAU khi cả chuỗi chạy, trên NAV SAU lệnh, và chỉ với mã VỪA
   * MUA: bán bớt mã khác để mua thêm mã này vẫn phải giữ trần; mã đã vượt trần
   * vì giá chạy thì không bị ép bán (bán là quyết định của người chơi), chỉ
   * không được mua thêm. Trần tính trên NAV sau lệnh — floor một lần.
   */
  if (mandate && daMua.size > 0) {
    const navSau = von + Object.values(viThe).reduce((a, b) => a + b, 0)
      + Object.values(viKhong).reduce((a, b) => a + b, 0);
    const tran = Math.floor((navSau * mandate.tranMaBp) / 10000);
    for (const ma of daMua) {
      if ((viThe[ma] ?? 0) > tran) return { loi: 'mandate_ma', phi_quy: 0 };
    }
  }

  g.von = von;
  g.vi_the = viThe;
  if (Object.keys(viKhong).length > 0 || g.vi_the_khong !== undefined) {
    g.vi_the_khong = viKhong;
  }
  return { loi: null, phi_quy: phiQuy, ...(phiDot > 0 ? { phi_dot: phiDot } : {}) };
}

/**
 * ĐỊNH GIÁ — chỗ giá cắn vào vị thế, tức chỗ "Vốn đứng im" chết.
 *
 * Hai tầng, đúng thứ tự dây chuyền của engine:
 *  1. phần RIÊNG từng mã (`rTheoMaBp`): giai đoạn + tin + nhiễu tương quan +
 *     trượt chen chúc — mọi mắt xích có `id` mã;
 *  2. phần DANH MỤC (`rDanhMucBp`): thẻ chiến thuật, khẩu vị — mắt xích không
 *     gắn mã, áp lên TỔNG sau tầng 1 (nhân từng vị thế cho cùng hệ số).
 *
 * Trả `tien_theo_ma` = delta chip từng mã qua CẢ HAI tầng — mắt xích hiển thị
 * đo bằng TIỀN nên tổng luôn khớp NAV delta theo cấu trúc, không cần đối soát.
 * Vị thế kẹp ≥ 0 (lỗ hết là hết, không nợ) và về 0 thì xoá ô.
 */
export function apDinhGia(
  g: GheNav, rTheoMaBp: Record<string, number>, rDanhMucBp: number,
  /**
   * v49 (D342) — LỢI SUẤT RIÊNG CỦA SỔ KHỐNG theo mã, ĐÃ mang dấu của người khống (giá rơi
   * 10% ⇒ +1000). Có mặt ⇒ sổ khống đọc bảng NÀY, không đảo dấu bảng sổ dài nữa.
   *
   * ⚠ Vì sao phải là bảng riêng chứ không đảo dấu `rTheoMaBp` như v17–v48: bảng sổ dài chỉ có
   * mã ĐANG CẦM DÀI (khống mã không cầm ⇒ 0bp giá — lỗi có từ v17), và nó mang cả phần riêng
   * của người cầm dài (chen chúc, xếp hàng) mà người khống không chịu — đảo dấu là biến phí
   * của người mua thành lãi của người khống.
   * ⚠ Vắng ⇒ số học cũ từng chip (trận ≤ v48 replay nguyên).
   */
  rKhongTheoMaBp?: Readonly<Record<string, number>>,
): { tien_theo_ma: Record<string, number> } {
  const tienTheoMa: Record<string, number> = {};
  for (const ma of Object.keys(g.vi_the)) {
    const truoc = g.vi_the[ma]!;
    const rRieng = rTheoMaBp[ma] ?? 0;
    let sau = Math.max(0, Math.floor((truoc * (10000 + rRieng)) / 10000));
    sau = Math.max(0, Math.floor((sau * (10000 + rDanhMucBp)) / 10000));
    tienTheoMa[ma] = sau - truoc;
    if (sau > 0) g.vi_the[ma] = sau;
    else delete g.vi_the[ma];
  }
  /*
   * v17 — SỔ KHỐNG định giá ĐẢO DẤU phần theo-mã: mã rơi r âm ⇒ ký quỹ nở.
   * Phần DANH MỤC (thẻ) áp THUẬN như sổ dài — nó là hệ số của cả ghế, không phải
   * chiều giá của mã. Kẹp ≥ 0: ký quỹ cháy là hết lệnh, không nợ.
   * ⚠ v47 (D339) — KHẨU VỊ KHÔNG CÒN Ở TẦNG NÀY. Nó là hệ số BIÊN ĐỘ, nên phần của
   * mỗi mã đi theo mã ấy và phải ĐẢO DẤU cùng nó: khống một mã đang lên thì quyết
   * liệt lỗ ×1,35 chứ không phải lỗ rồi lại được cộng thuận. Chỉ phần khẩu vị của
   * danh mục (thẻ, sự kiện thẻ) còn ở lại đây. Xem `tangCuaMatXich`.
   * ⭐ v49 (D342) — có `rKhongTheoMaBp` ⇒ sổ khống đọc bảng RIÊNG (đã mang dấu người khống),
   * không đảo dấu bảng sổ dài nữa. Xem docstring tham số.
   */
  for (const ma of Object.keys(g.vi_the_khong ?? {})) {
    const truoc = g.vi_the_khong![ma]!;
    let sau = rKhongTheoMaBp
      ? Math.max(0, Math.floor((truoc * (10000 + (rKhongTheoMaBp[ma] ?? 0))) / 10000))
      : Math.max(0, Math.floor((truoc * (10000 - (rTheoMaBp[ma] ?? 0))) / 10000));
    sau = Math.max(0, Math.floor((sau * (10000 + rDanhMucBp)) / 10000));
    tienTheoMa[`khong:${ma}`] = sau - truoc;
    if (sau > 0) g.vi_the_khong![ma] = sau;
    else delete g.vi_the_khong![ma];
  }
  return { tien_theo_ma: tienTheoMa };
}

/**
 * v17 — PHÍ GIỮ KHỐNG mỗi vòng (funding): trừ trên từng ký quỹ, TRẢ VỀ tổng để
 * tầng gọi đổ vào Quỹ vòng (không đốt — bên "cho vay" của bàn nhận). Van hãm
 * chính chống ôm khống vĩnh viễn — vé một chiều bị bào mỗi vòng nó không nổ.
 */
export function apPhiGiuKhong(g: GheNav): number {
  let tong = 0;
  for (const ma of Object.keys(g.vi_the_khong ?? {})) {
    const phi = Math.floor(
      (g.vi_the_khong![ma]! * BAN_KHONG_LENH.PHI_GIU_BP) / 10000);
    g.vi_the_khong![ma] = g.vi_the_khong![ma]! - phi;
    if (g.vi_the_khong![ma]! <= 0) delete g.vi_the_khong![ma];
    tong += phi;
  }
  return tong;
}

/**
 * v42 (D311) — COUPON: mã `dong_tien === 'coupon'` trả lãi vào TIỀN MẶT.
 *
 * `bp` là suất mỗi ô, do `couponBpCua(st)` cấp từ lãi suất nền đang công bố —
 * hàm này KHÔNG tự đọc lãi suất, vì nó là lõi NAV thuần (không thấy `st`).
 *
 * HAI CHIỀU, và chiều thứ hai mới là chỗ dễ quên:
 *  · SỔ DÀI: cộng thẳng vào `von`. Tiền vào ví, KHÔNG cộng vào giá — đó là điểm
 *    dạy được: trái phiếu trả bạn tiền đều trong khi GIÁ của nó vẫn có thể rơi.
 *  · SỔ KHỐNG: người khống đang đi vay tờ trái phiếu, mà chủ tờ vẫn phải nhận lãi
 *    của họ ⇒ TRỪ vào ký quỹ. Khoản này ĐỐT (rời khỏi hệ kín, không ai nhận trong
 *    bàn), cùng quy ước lệch-doc với phần trượt giá của `apPhiGiuKhong`.
 *
 * Kẹp ≥ 0 và xoá ô rỗng, y hệt `apPhiGiuKhong`: ký quỹ cạn là hết lệnh, không nợ.
 */
export function apCoupon(
  g: GheNav, bp: number, giuDuKy = false,
): { ma: string; tien: number; khong: number }[] {
  if (bp <= 0) return [];
  const ra: { ma: string; tien: number; khong: number }[] = [];
  for (const ts of TAI_SAN) {
    if (ts.dong_tien !== 'coupon') continue;
    /*
     * v45 (D318) — PHẢI GIỮ ĐỦ MỘT Ô. Trái phiếu Mỹ trả lãi NỬA NĂM MỘT LẦN, mà
     * 1 ô = nửa năm ⇒ đúng một kỳ trả lãi mỗi ô. Trước v45 ai mua ở ô này cũng
     * ăn coupon ngay ô ấy — founder chỉ ra 09/09 là sai, và sai theo đúng nghĩa
     * kinh tế: ngoài đời mua giữa kỳ thì người mua phải TRẢ phần lãi đã dồn cho
     * người bán, nên không ai nhặt được coupon miễn phí bằng cách nhảy vào sát
     * ngày chốt.
     * `min` là cách rẻ nhất diễn đạt "phần đã nằm im trọn một ô" — xem docstring
     * `GheNav.vi_the_o_truoc`. Sổ khống đối xứng: chỉ TRẢ lãi trên phần đã khống
     * trọn kỳ, mở khống sát ngày chốt không phải trả.
     */
    const daiNay = g.vi_the[ts.id] ?? 0;
    const kyNay = g.vi_the_khong?.[ts.id] ?? 0;
    const dai = giuDuKy
      ? Math.min(daiNay, g.vi_the_o_truoc?.[ts.id] ?? 0) : daiNay;
    const ky = giuDuKy
      ? Math.min(kyNay, g.vi_the_khong_o_truoc?.[ts.id] ?? 0) : kyNay;
    if (dai <= 0 && ky <= 0) continue;
    const tien = Math.floor((dai * bp) / 10000);
    const khong = Math.floor((ky * bp) / 10000);
    g.von += tien;
    if (khong > 0) {
      // ⚠ Trừ vào SỐ KÝ QUỸ HIỆN TẠI (`kyNay`), không phải phần tính lãi (`ky`) —
      // hai số khác nhau từ v45, và trừ nhầm là ký quỹ bốc hơi quá tay.
      g.vi_the_khong![ts.id] = kyNay - khong;
      if (g.vi_the_khong![ts.id]! <= 0) delete g.vi_the_khong![ts.id];
    }
    if (tien !== 0 || khong !== 0) ra.push({ ma: ts.id, tien, khong });
  }
  return ra;
}

/**
 * Lạm phát NỀN một vòng trên một khoản tiền (chip, làm tròn xuống). MỘT nguồn cho tiền mặt (`apLamPhat`) và — từ v54
 * `tietKiemLamPhat` (D405) — tiền gốc trong sổ tiết kiệm: hai chỗ cùng một mức, cùng một phép làm tròn.
 */
export function matLamPhatNen(soTien: number): number {
  return Math.floor((soTien * NAV_V10.LAM_PHAT_TIEN_MAT_BP) / 10000);
}

/** Lạm phát tiền mặt mỗi vòng — chỉ chạm TIỀN MẶT, vị thế miễn. Trả số đã mất (đốt). */
export function apLamPhat(g: GheNav): number {
  const mat = matLamPhatNen(g.von);
  g.von -= mat;
  return mat;
}

/** Cháy khi NAV ≤ ngưỡng × vốn khởi điểm. Vị thế TÍNH VÀO — khoá không cứu (spec 02 §3.3). */
export function daChayNav(g: GheNav, startVon: number): boolean {
  return navCua(g) <= Math.floor((startVon * NAV_V10.NGUONG_CHAY_BP) / 10000);
}

/**
 * Mốc % → số tiền. Mốc hợp lệ: bội của `BUOC_MOC_BP` trong (0, 10000].
 * ALL-IN (10000) dồn HẾT không qua bước 10 — "kéo tới cùng" phải ra đúng số dư,
 * để lại 7 chip lẻ thì không còn là all-in.
 */
export function tienTuMoc(mocBp: number, tienMat: number): number {
  if (tienMat <= 0 || mocBp <= 0 || mocBp > 10000) return 0;
  if (mocBp === 10000) return tienMat;
  const tho = Math.floor((tienMat * mocBp) / 10000);
  return Math.floor(tho / NAV_V10.BUOC_TIEN) * NAV_V10.BUOC_TIEN;
}

/**
 * ĐI NGƯỢC SỐ ĐÔNG — thấy được BAO NHIÊU đối thủ, cân theo cỡ bàn (D40).
 *
 * Sàn 1: đã trả một ô chiến thuật cho lá này thì phải thấy ít nhất một người.
 * Floor cho phần còn lại — thà hẹp hơn lời hứa một chút còn hơn rộng hơn.
 */
export function soDoiThuThay(cap: number, soDoiThu: number): number {
  if (cap <= 0 || soDoiThu <= 0) return 0;
  const bang = DAC_QUYEN.DI_NGUOC.TY_LE_THAY_BP;
  const tyLe = bang[Math.min(cap, bang.length) - 1]!;
  return Math.max(1, Math.floor((soDoiThu * tyLe) / 10000));
}

/**
 * BA DẢI SỨC CĂNG (bước 5, Q2 founder chốt 3 dải): 0 êm · 1 căng · 2 rất căng.
 * Bộ đo phải THÔ — hiện dải, không hiện số: ngoài đời không ai thấy "bong
 * bóng = 63%", và tín hiệu chính xác giết cột calibration (03 §5.5a).
 */
export function daiSucCang(sBp: number): 0 | 1 | 2 {
  if (sBp >= SUC_CANG.DAI_RAT_CANG_BP) return 2;
  if (sBp >= SUC_CANG.DAI_CANG_BP) return 1;
  return 0;
}

/** Bước mốc của ghế: MỊN khi cầm Chia Lệnh (đặc quyền 28/07), THÔ khi không. */
export function buocMocCua(coChiaLenh: boolean): number {
  return coChiaLenh ? NAV_V10.BUOC_MOC_BP : NAV_V10.BUOC_MOC_THO_BP;
}

/** Mốc hợp lệ: bội của bước cho phép, trong (0, 10000]. ALL-IN luôn hợp lệ. */
export function mocHopLe(mocBp: number, coChiaLenh: boolean): boolean {
  if (!Number.isInteger(mocBp) || mocBp <= 0 || mocBp > 10000) return false;
  if (mocBp === 10000) return true;
  return mocBp % buocMocCua(coChiaLenh) === 0;
}

/** Một lệnh THEO MỐC — dạng API nhận và dạng nằm trong action_log của v10b. */
export interface LenhMoc {
  ma: string;
  chieu: 'mua' | 'ban' | 'khong' | 'dong_khong';
  moc_bp: number;
}

/**
 * GIẢI CHUỖI MỐC RA CHUỖI TIỀN — "xử lý logic tính toán phần này kỹ" (founder).
 *
 * Ba luật, mỗi luật chặn một đường sai:
 * 1. TUẦN TỰ TRÊN BẢN NHÁP THẬT: mỗi mốc giải trên trạng thái SAU các lệnh
 *    trước — và bản nháp áp bằng CHÍNH `apLenhGiaoDich` (có trượt giá), không
 *    xấp xỉ. Xấp xỉ bỏ trượt là "mua rồi bán cùng mã trong một chuỗi" bán vượt
 *    vị thế thật đúng phần trượt — lỗi chỉ nổ ở ca hiếm, tức loại tệ nhất.
 * 2. MỐC SAI BƯỚC = TỪ CHỐI CẢ CHUỖI, không lặng lẽ làm tròn: làm tròn hộ là
 *    client 5% mà không có Chia Lệnh vẫn đi được 5% qua cửa sau tích luỹ.
 * 3. BÁN ALL (10000bp) = SẠCH VỊ THẾ, không qua bước 10 — cùng lý với mua.
 *
 * Mốc trên ví/vị thế RỖNG cho ra 0 ⇒ bỏ qua lệnh đó (không phải lỗi: bấm 25%
 * của 0 là "không làm gì", không phải một cú phạm luật).
 */
export function giaiLenhMoc(
  g: GheNav, lenhMoc: readonly LenhMoc[], coChiaLenh: boolean,
  // `voiVang` đi xuyên xuống bản nháp `apLenhGiaoDich` — bản nháp phải tính
  // đúng phí thật, không thì kiểm "đủ tiền" của chuỗi lệch với lúc áp.
  opts?: {
    maxTaiSan?: number; coBanKhong?: boolean; voiVang?: boolean; tacDongGia?: number;
    mandate?: Mandate; vonQuyChieu?: number;
    /** v42 (D311) — bật cổng `khongTheoMa`: chặn MỞ khống mã `khong_duoc === false`. */
    khongTheoMa?: boolean;
    /** v49 (D342) — mốc KHỐNG tính trên `hanMucKhongCon`, không trên tiền mặt. */
    khongTheoHanMuc?: boolean;
    /** v50 (D345) — đi xuyên xuống `apLenhGiaoDich` (bản nháp phải tính đúng phí thật). */
    phiLenhNhe?: boolean;
    phiLenhConBp?: number;
    /** v51 (D346) — phí hai bậc; bản nháp phải tính cùng bảng với engine (C4/D67). */
    phiLenhBac?: boolean;
    /** v55 (D409) — hệ số trượt giá RIÊNG GHẾ (lửa), 10000 = ×1. */
    heSoTruotBp?: number;
    /** v55 (D409) — Mua Đuổi MUỘN: lệnh MUA vào nhóm rủi ro trượt thêm hệ số này. */
    heSoTruotMuaRuiRoBp?: number;
    /** v55 (D425) — GÔNG CÙM: trần BÁN cộng dồn trong vòng (xem `apLenhGiaoDich`); bản nháp cộng dồn qua từng lệnh. */
    tranBanVong?: { tranTien: number; daBan: number };
    /** v55 (D409) — mốc lệnh được thêm (LỆNH MỊN). `giaiLenhMoc` đọc; `apLenhGiaoDich` bỏ qua. */
    mocThem?: readonly number[];
    /** v55 (D425) — SỔ MỎNG: phí cố định mỗi lệnh (xem `apLenhGiaoDich`) — bản nháp trừ cùng số. */
    phiCoDinhLenh?: number;
    /** v56 (D447) — đổi tay theo mã đã có trong vòng (xem `apLenhGiaoDich`); bản nháp cộng dồn qua từng lệnh của chuỗi. */
    daDoiMa?: Readonly<Record<string, number>>;
  },
): { lenh: LenhGiaoDich[]; loi: 'moc_khong_hop_le' | LoiLenh | null } {
  const nhap: GheNav = {
    von: g.von, vi_the: { ...g.vi_the },
    vi_the_khong: { ...(g.vi_the_khong ?? {}) },
  };
  const ra: LenhGiaoDich[] = [];
  // v55 (D425) — GÔNG CÙM: tiền đã bán của các lệnh TRƯỚC trong chuỗi (bản nháp áp từng lệnh một).
  let daBanNhap = 0;
  // v56 (D447) — đổi tay theo mã: vòng này + các lệnh TRƯỚC trong chuỗi (cùng lý do với `daBanNhap`).
  const doiNhap: Record<string, number> | null = opts?.daDoiMa !== undefined ? { ...opts.daDoiMa } : null;
  /*
   * BÁN TRƯỚC MUA (founder báo 01/08): all-in xong tiền mặt = 0, muốn đảo mã
   * phải bán để có tiền — mà lệnh mua đứng trước lệnh bán trong danh sách bấm
   * thì mua giải ra 0 đồng/thiếu tiền và người chơi "đ** bán được". Ngoài đời
   * broker cũng tất toán bán trước để bù tiền mua trong ngày. Sắp ổn định
   * (giữ thứ tự nội bộ từng chiều) nên vẫn tất định, replay nguyên.
   */
  // BÁN + ĐÓNG KHỐNG giải trước (tiền về), MUA + MỞ KHỐNG sau (tiền ra) —
  // cùng luật broker-bù-tiền-trong-ngày đã chốt 01/08.
  const veTien = (c: LenhMoc['chieu']) => c === 'ban' || c === 'dong_khong';
  const thuTu = [...lenhMoc].sort(
    (a, b) => (veTien(a.chieu) === veTien(b.chieu) ? 0 : (veTien(a.chieu) ? -1 : 1)));
  for (const l of thuTu) {
    if (!mocHopLe(l.moc_bp, coChiaLenh) && !(opts?.mocThem ?? []).includes(l.moc_bp)) {
      return { lenh: [], loi: 'moc_khong_hop_le' };
    }
    // v17 — MỞ khống là đặc quyền lá ban_khong; ĐÓNG thì luôn được (không ai
    // bị giam trong vị thế vì lỡ bán lá).
    if (l.chieu === 'khong' && opts?.coBanKhong !== true) {
      return { lenh: [], loi: 'can_la_ban_khong' };
    }
    /*
     * v42 (D311) — SÀN CẤM KHỐNG MÃ NÀY. Đứng SAU `can_la_ban_khong` và SAU
     * mandate: thứ tự lỗi là "bạn thiếu lá" → "vai bạn cấm" → "sàn không có".
     *
     * ⚠ `mandate?.camKhong !== true` KHÔNG phải kiểm thừa và cũng không phải bản
     * cài đặt thứ hai của mandate (D61): mandate vẫn do `apLenhGiaoDich` thi hành,
     * đây chỉ NHƯỜNG QUYỀN BÁO LỖI cho nó khi cả hai cùng chặn — bỏ dòng này thì
     * ghế tổ chức khống `cp_cn` nhận `khong_cam_san` thay vì `mandate_khong`.
     * ⚠ Chỉ `chieu === 'khong'` (MỞ). `dong_khong` cố ý không nằm trong nhánh này:
     * cấm đóng một vị thế đang mở là nhốt người chơi trong đó.
     */
    if (l.chieu === 'khong' && opts?.khongTheoMa === true
      && opts?.mandate?.camKhong !== true
      && TAI_SAN.find((t) => t.id === l.ma)?.khong_duoc === false) {
      return { lenh: [], loi: 'khong_cam_san' };
    }
    let tien: number;
    let laKhong: true | undefined;
    if (l.chieu === 'mua') {
      tien = tienTuMoc(l.moc_bp, nhap.von);
    } else if (l.chieu === 'khong') {
      /*
       * v49 (D342) — MỐC TRÊN HẠN MỨC. 100% = khống tối đa được phép lúc này (trên bản nháp
       * SAU các lệnh trước — bán xong thì tiền về và NAV đổi, hạn mức đổi theo). Nên chip
       * KHỐNG không bao giờ tự vượt trần, và không kéo chết lệnh khác trong chuỗi.
       * Hết hạn mức ⇒ giải ra 0 ⇒ bỏ qua (cùng luật "mốc trên ví rỗng" ở cuối docstring).
       */
      tien = tienTuMoc(l.moc_bp,
        opts?.khongTheoHanMuc === true ? hanMucKhongCon(nhap) : nhap.von);
      laKhong = true;
    } else if (l.chieu === 'dong_khong') {
      const dang = nhap.vi_the_khong?.[l.ma] ?? 0;
      tien = -(l.moc_bp === 10000 ? dang : tienTuMoc(l.moc_bp, dang));
      laKhong = true;
    } else {
      const dang = nhap.vi_the[l.ma] ?? 0;
      tien = -(l.moc_bp === 10000 ? dang : tienTuMoc(l.moc_bp, dang));
    }
    if (tien === 0) continue;
    const lenhMot: LenhGiaoDich = laKhong
      ? { ma: l.ma, tien, khong: true } : { ma: l.ma, tien };
    // Không cộng dồn thì mỗi lệnh lẻ đều lọt trần mà cả chuỗi thì vượt — màn báo "đi được", cú áp thật bác cả chuỗi.
    const thu = apLenhGiaoDich(nhap, [lenhMot], opts === undefined ? undefined : {
      ...opts,
      ...(opts.tranBanVong !== undefined
        ? { tranBanVong: { tranTien: opts.tranBanVong.tranTien, daBan: opts.tranBanVong.daBan + daBanNhap } } : {}),
      ...(doiNhap !== null ? { daDoiMa: doiNhap } : {}),
    });
    if (thu.loi) return { lenh: [], loi: thu.loi };
    if (tien < 0) daBanNhap += -tien;
    if (doiNhap !== null) doiNhap[l.ma] = (doiNhap[l.ma] ?? 0) + Math.abs(tien);
    ra.push(lenhMot);
  }
  return { lenh: ra, loi: null };
}
