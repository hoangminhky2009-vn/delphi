/**
 * ĐIỂM XẾP HẠNG + BẬC ĐẤU TRƯỜNG (Hệ A) — nguồn chân lý duy nhất, không magic number.
 *
 * Toàn văn thiết kế: docs/khao-co/design_rank.md §2 (toán) · §3 (thang bậc) · §6 (bảng).
 *
 * ⚠ KHÔNG import gì từ `config/holdem.ts` (§2.12). Quỹ vòng / Vốn là CHIP ẢO sống
 *   và chết trong một trận, còn điểm xếp hạng là thứ RỜI KHỎI trận. Nối hai thứ vào
 *   nhau thì một lần tune split trong trận sẽ âm thầm đổi cả bảng xếp hạng của mùa
 *   đang chạy, và không ai thấy điều đó trong diff.
 * ⚠ L1/A3.5: file này KHÔNG có T, KHÔNG có Q, không đường quy đổi nào. Điểm xếp hạng
 *   không phải tiền, không mua được, không bán được.
 * ⚠ A3.4 đọc sang đây: điểm KHÔNG BAO GIỜ được in. Mỗi trận là một phép CHUYỂN
 *   NHƯỢNG tổng 0 giữa các ghế cùng bàn — xem `deltaTran`.
 */

export const RANK_FORMULA_VERSION = 'rank-v1-beta';

/**
 * Điểm mỗi lần so cặp ở bậc ngang nhau = K/2 = 10.
 *
 * K là biên độ MỘT LẦN SO CẶP, không phải biên độ một trận: bàn 8 có 7 cặp cho mỗi
 * ghế nên biên độ trận tự lớn lên gấp 7/3 so với bàn 4. Đó chính là "bàn đông nhiều
 * điểm hơn" mà founder đòi, và nó KHÔNG cần hệ số nhân nào (xem `HE_SO_CO_BAN`).
 */
export const K = 20;

/**
 * Độ dốc thang kỳ vọng theo bậc: p(d) = 1/(1 + 10^(−d/CHIA)).
 *
 * CHIA = 4 chứ không 2: với CHIA = 2 thì d = 3 đã bão hoà ("thua mất 0 điểm"), tức
 * hai người cách nhau 3 nấc so nhau không còn nghĩa gì.
 */
export const CHIA = 4;

/** Dưới ngưỡng này = "CHƯA XẾP BẬC". Cùng con số với `NGUONG_XEP_BAC` của Hệ B (L4). */
export const NGUONG_XEP_BAC_A = 5;

/**
 * Bậc coi-như của người "chưa xếp bậc" khi tính p().
 *
 * ⚠ TUYỆT ĐỐI KHÔNG dùng K lớn hơn cho trận định bậc. K khác nhau giữa các ghế CÙNG
 * BÀN là vỡ zero-sum ngay (§2.3) — định bậc nhanh là việc của p(), không của K.
 */
export const BAC_MAC_DINH_CHUA_XEP = 2;

export type BacId =
  | 'chua_xep' | 'tap_su' | 'chuyen_vien' | 'nha_giao_dich'
  | 'quan_ly_danh_muc' | 'giam_doc_dau_tu' | 'chu_quy' | 'tao_song';

/**
 * THANG BẬC — 7 bậc, MỘT thang duy nhất cho Đấu trường.
 *
 * Hai giọng có chủ ý: TÊN BẬC là chức danh trong quỹ (giữ giọng D26 "đăng ký quản lý
 * quỹ, không casino"), ICON + biệt danh là SINH VẬT BIỂN. Trên giấy tờ bạn là Chuyên
 * Viên, dưới nước bạn là con cua.
 *
 * ⚠ Thang sinh vật biển đồng thời CHỮA lỗi namespace: không chuỗi nào ở đây trùng
 *   `BAC_BRIER` (Vàng/Bạc/Đồng/Chì) của Hệ B trong `config/progression.ts`. Trước đợt
 *   này badge Đấu trường dùng đúng ba chữ Đồng/Bạc/Vàng của Hệ B, nên hai đại lượng
 *   hoàn toàn khác nhau đọc ra cùng một chữ trên cùng một màn hình.
 *
 * Trục biểu tượng là KHỐI LƯỢNG NƯỚC bạn dịch chuyển được: Tôm → Cua → Cá Mòi → Cá
 * Ngừ → Cá Heo → Cá Mập → Cá Voi. Đơn hướng, đọc được ở 16px mà không cần đọc chữ.
 *
 * `moc_duoi = null` ⇔ bậc apex (xét theo HẠNG bảng, không theo điểm). `so_nac = 3`
 * ⇔ có nấc III/II/I (chỉ chủ nhân thấy, không lưu, không dùng để ghép bàn).
 *
 * ⚠ `icon_lon` hiện TRỎ VÀO CHÍNH `icon` — chỉ có lưới 16×16, chưa có lưới 32×32.
 *   Không phải sơ suất: 16 chia hết 32/48/64/96 nên cùng một lưới phóng lên vẫn nét,
 *   và trỏ vào một tên lưới CHƯA TỒN TẠI thì `PixelIcon` render ô rỗng — icon vô
 *   hình, không lỗi, không test đỏ (đúng dạng "cơ chế trang trí" đã dính 8 lần).
 *   Khi nào vẽ lưới 32 thì đổi trường này, không đổi chỗ gọi.
 */
export const BAC_THANG = [
  {
    id: 'tao_song', bac: 7, ten: 'NGƯỜI TẠO SÓNG', biet_danh: 'Cá Voi',
    kim_loai: 'ELITE', sticker: 'st_hh_ca_voi',
    icon: 'rank_ca_voi', icon_lon: 'rank_ca_voi_lon',
    moc_duoi: null, san_apex: 1_800, apex_top: 10, so_nac: 1,
    y_nghia: 'khối lượng của bạn làm dòng tiền lệch hướng',
  },
  {
    id: 'chu_quy', bac: 6, ten: 'CHỦ QUỸ', biet_danh: 'Cá Mập',
    kim_loai: 'KIM CƯƠNG', sticker: 'st_hh_ca_map',
    icon: 'rank_ca_map', icon_lon: 'rank_ca_map_lon',
    moc_duoi: null, san_apex: 1_800, apex_top: 50, so_nac: 1,
    y_nghia: 'đi săn trong dòng, không bơi theo dòng',
  },
  {
    id: 'giam_doc_dau_tu', bac: 5, ten: 'GIÁM ĐỐC ĐẦU TƯ', biet_danh: 'Cá Heo',
    kim_loai: 'BẠCH KIM', sticker: 'st_hh_ca_duoi',
    icon: 'rank_ca_heo', icon_lon: 'rank_ca_heo_lon',
    moc_duoi: 1_800, san_apex: null, apex_top: null, so_nac: 3,
    y_nghia: 'đọc dòng trước khi dòng tới — trần của thang điểm',
  },
  {
    id: 'quan_ly_danh_muc', bac: 4, ten: 'QUẢN LÝ DANH MỤC', biet_danh: 'Cá Ngừ',
    kim_loai: 'VÀNG', sticker: 'st_hh_ca_ngua',
    icon: 'rank_ca_ngu', icon_lon: 'rank_ca_ngu_lon',
    moc_duoi: 720, san_apex: null, apex_top: null, so_nac: 3,
    y_nghia: 'đi đường dài, giữ tốc độ qua nhiều tầng nước',
  },
  {
    id: 'nha_giao_dich', bac: 3, ten: 'NHÀ GIAO DỊCH', biet_danh: 'Cá Mòi',
    kim_loai: 'BẠC', sticker: 'st_hh_cua',
    icon: 'rank_ca_moi', icon_lon: 'rank_ca_moi_lon',
    moc_duoi: 360, san_apex: null, apex_top: null, so_nac: 3,
    y_nghia: 'sống trong đàn, an toàn nhờ số đông',
  },
  {
    id: 'chuyen_vien', bac: 2, ten: 'CHUYÊN VIÊN', biet_danh: 'Cua',
    kim_loai: 'ĐỒNG', sticker: 'st_hh_tom',
    icon: 'rank_cua', icon_lon: 'rank_cua_lon',
    moc_duoi: 120, san_apex: null, apex_top: null, so_nac: 3,
    y_nghia: 'bò ngang, sát đáy, kẹp chắc từng chút',
  },
  {
    id: 'tap_su', bac: 1, ten: 'TẬP SỰ', biet_danh: 'Tôm',
    kim_loai: 'SẮT', sticker: null,
    icon: 'rank_tom', icon_lon: 'rank_tom_lon',
    moc_duoi: Number.NEGATIVE_INFINITY, san_apex: null, apex_top: null, so_nac: 1,
    y_nghia: 'dòng đẩy đâu thì đi đó',
  },
] as const;

export type BacThang = (typeof BAC_THANG)[number];

/** Nhãn của trạng thái tạm "chưa đủ trận" — không vẽ art cho một trạng thái tạm. */
export const BAC_CHUA_XEP = {
  id: 'chua_xep', bac: 0, ten: 'CHƯA XẾP BẬC', biet_danh: '',
  kim_loai: '', sticker: null,
  icon: 'lock', icon_lon: 'lock', so_nac: 1,
  y_nghia: `còn thiếu trận Giải xếp hạng (cần ${NGUONG_XEP_BAC_A})`,
} as const;

/**
 * HUY HIỆU HẠNG (SPEC huy-hieu-hang-sticker, founder 11/10) — tên kim loại và sticker vinh danh
 * KHAI Ở CHÍNH BẢNG `BAC_THANG` ở trên (`kim_loai`, `sticker`), không có bảng thứ hai (A11.5).
 * Art ở `web/src/lib/huy_hieu.ts` tra theo `bac` (1..7) của bảng này.
 *
 * Sticker vinh danh là MERIT: không bán, không gacha, không quy đổi (design_sticker_shop Q7/Q8).
 * `sticker` là id trong `NHAN_DAN` (config/avatar.ts, nguon 'merit'); SẮT không có.
 */

/** "ĐỒNG · Chuyên viên" — kim loại in hoa, chức danh viết hoa chữ đầu (một bảng, suy ra từ `ten`). */
export function nhanHuyHieu(id: BacId): string {
  const b = dinhNghiaBac(id);
  if (!b.kim_loai) return b.ten;
  const chucDanh = b.ten.charAt(0) + b.ten.slice(1).toLocaleLowerCase('vi');
  return `${b.kim_loai} · ${chucDanh}`;
}

/** Bậc có sticker vinh danh (mọi bậc trừ SẮT). */
export const BAC_CO_STICKER: readonly BacId[] =
  BAC_THANG.filter((b) => b.sticker !== null).map((b) => b.id);

/** Mùa beta: KHOÁ apex, trần là Cá Heo (§3.3) — "top 10" giữa vài chục người là nhãn rỗng. */
export const APEX_BAT = false;

/**
 * Hệ số theo cỡ bàn — MẶC ĐỊNH 1,00 HẾT, CÓ CHỦ ĐÍCH.
 *
 * "Bàn đông nhiều điểm hơn" ĐÃ nằm trong công thức (bàn 8 có 7 cặp/ghế vs bàn 4 có 3).
 * Nhân thêm ở đây là ĐẾM HAI LẦN, và đo được là phá công bằng chéo cỡ bàn → mọi người
 * dồn về một cỡ, các cỡ còn lại chết. Trong beta vài chục người, đó là chí tử.
 * Để lại làm cần gạt cho founder; KHÔNG bật khi chưa chạy lại gate Monte Carlo.
 */
export const HE_SO_CO_BAN: Readonly<Record<number, number>> =
  { 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0, 8: 1.0 };

/**
 * Hao điểm do nghỉ — TẮT mặc định ở beta.
 * Điều kiện BẬT (A8.9: mọi lever phải có điều kiện, không để ngỏ): guardrail tuần đo
 * thấy "Cá Mập+ vượt 8% người hoạt động". Mỗi lần hao là MỘT DÒNG SỔ đối ứng Quỹ điểm.
 */
export const HAO_KHONG_HOAT_DONG = {
  BAT: false, BAC_TOI_THIEU: 5, SAU_NGAY: 14, MOI_NGAY: 20, SAN: 1_800,
} as const;

/** Bảng xếp hạng — §6. Số ở đây là config, không phải hằng số rải trong code. */
export const BXH = {
  SO_DONG: 100,
  CHU_KY_SNAPSHOT_PHUT: 10,
  S_MAXAGE_GIAY: 600,
  LAM_MOI_CHAN_GIAY: 60,
  /** Icon lưới 32 chỉ cho top 3; dòng 4–100 dùng chip chữ (cảnh báo box-shadow §4.2). */
  SO_DONG_CO_ICON: 3,
  /** ⬅ OFF tới khi rà handle prod = 0 vi phạm blocklist (D25/R2, §9 P1). */
  BAT: false,
} as const;

/**
 * Bậc thang XUỐNG CẤP CÓ KIỂM SOÁT (C2) — ghi sẵn, không ứng biến giữa sự cố.
 * Đọc theo % ngân sách request đã dùng (D11: kiểm dashboard mỗi tuần).
 */
export const BXH_XUONG_CAP = [
  { toi_da_pct: 50, chu_ky_phut: 10, lam_moi_giay: 60 },
  { toi_da_pct: 70, chu_ky_phut: 20, lam_moi_giay: 180 },
  { toi_da_pct: 85, chu_ky_phut: 60, lam_moi_giay: 0 },
  { toi_da_pct: 100, chu_ky_phut: 360, lam_moi_giay: 0 },
] as const;

// ───────────────────────────────────────────────────────────────────────────────
// TOÁN ĐIỂM — tất định, số nguyên, zero-sum theo CẤU TRÚC
// ───────────────────────────────────────────────────────────────────────────────

/** Xác suất (bp) người bậc cao hơn `d` nấc thắng một lần so cặp. */
export function pThangCapBp(d: number): number {
  return Math.round(10_000 / (1 + 10 ** (-d / CHIA)));
}

/**
 * Điểm chuyển trong MỘT lần so cặp: người xếp trên thu, người xếp dưới trả.
 *
 * ⚠ LÀM TRÒN Ở ĐÂY, ĐÚNG MỘT LẦN, RỒI GÁN +x/−x cho hai đầu. Đây là luật cài đặt
 * KHÔNG THƯƠNG LƯỢNG (§2.4). Đo trên 300.000 bàn ngẫu nhiên (N = 4..8, bậc 1..7):
 *     làm tròn THEO CẶP   →       0 / 300.000 bàn vỡ zero-sum
 *     làm tròn THEO NGƯỜI → 153.027 / 300.000 bàn vỡ (51,0%)
 * Cộng delta theo người rồi mới làm tròn thì hơn nửa số bàn tự sinh hoặc tự đốt
 * điểm — và vỡ theo cách VẪN RA SỐ TRÔNG HỢP LÝ, nên đó là chỗ bug sẽ lọt qua
 * review. Cùng tinh thần A5.1 ("nhân trước, chia sau, floor một lần").
 *
 * @param d hiệu BẬC (người trên − người dưới) lúc VÀO BÀN, không phải lúc kết trận.
 */
export function chuyenNhuongCap(d: number, k: number = K): number {
  return Math.round((k * (10_000 - pThangCapBp(d))) / 10_000);
}

/**
 * Δ điểm của cả bàn cho một trận Giải xếp hạng.
 *
 * @param hangTheoGhe id ghế xếp theo thứ hạng cuối trận, TỐT NHẤT TRƯỚC.
 * @param bacLucVaoBan bậc SỐ (1..7) của từng ghế lúc vào bàn — đúng cái badge đối thủ
 *   đã thấy (D25/R4 + A7: mọi đầu vào của delta đều đang ở trên màn hình).
 */
export function deltaTran(
  hangTheoGhe: readonly string[],
  bacLucVaoBan: Readonly<Record<string, number>>,
  k: number = K,
): Record<string, number> {
  if (hangTheoGhe.length < 2) {
    throw new Error(`Bàn xếp hạng phải ≥2 ghế, nhận ${hangTheoGhe.length}`);
  }
  const d: Record<string, number> = {};
  for (const g of hangTheoGhe) d[g] = 0;
  for (let a = 0; a < hangTheoGhe.length; a += 1) {
    for (let b = a + 1; b < hangTheoGhe.length; b += 1) {
      const i = hangTheoGhe[a]!;
      const j = hangTheoGhe[b]!;
      const chuyen = chuyenNhuongCap(bacLucVaoBan[i]! - bacLucVaoBan[j]!, k);
      d[i]! += chuyen;
      d[j]! -= chuyen;   // ← làm tròn ĐÃ xong bên trong, theo CẶP
    }
  }
  // Bất biến kiểm TẠI CHỖ, không để trôi ra tới DB mới phát hiện.
  let tong = 0;
  for (const g of hangTheoGhe) tong += d[g]!;
  if (tong !== 0) throw new Error(`rank delta không zero-sum: ${tong}`);
  return d;
}

/**
 * Δ điểm của một NHÓM NGƯỜI THẬT trong bàn GHÉP CÓ MÁY (SPEC ghép bàn 11/10, phương án B3 của §2.10): CHỈ tính cặp NGƯỜI–NGƯỜI, bỏ mọi cặp có máy.
 * Giữ zero-sum tuyệt đối (mỗi cặp +x/−x, làm tròn đúng một lần theo cặp) và tự co giãn theo số người; máy không có tài khoản điểm nên không
 * thể là máy in điểm. Giá phải trả (§2.10): máy đổi thanh khoản và đám đông, nên đây là phép so hai người trong MỘT bàn khác bàn toàn người.
 *
 * @param tang các TẦNG hạng, tốt nhất trước; người cùng tầng HOÀ (cặp chuyển 0). Một người = một tầng ⇒ trùng `deltaTran`.
 * @param bacLucVaoBan bậc SỐ (1..7) của từng người lúc vào bàn.
 */
export function deltaTheoTang(
  tang: readonly (readonly string[])[],
  bacLucVaoBan: Readonly<Record<string, number>>,
  k: number = K,
): Record<string, number> {
  const d: Record<string, number> = {};
  for (const t of tang) for (const u of t) d[u] = 0;
  for (let a = 0; a < tang.length; a += 1) {
    for (let b = a + 1; b < tang.length; b += 1) {
      for (const i of tang[a]!) {
        for (const j of tang[b]!) {
          const chuyen = chuyenNhuongCap(bacLucVaoBan[i]! - bacLucVaoBan[j]!, k);
          d[i]! += chuyen;
          d[j]! -= chuyen;
        }
      }
    }
  }
  let tong = 0;
  for (const u of Object.keys(d)) tong += d[u]!;
  if (tong !== 0) throw new Error(`rank delta nhóm không zero-sum: ${tong}`);
  return d;
}

/** Số cặp mình xếp TRÊN — câu trả lời "vì sao +37" hiện thẳng trên màn chốt phiên. */
export function soCapThang(soGhe: number, hang: number): number {
  return soGhe - hang;
}

/**
 * Vector Δ khi MỌI ghế cùng bậc — trường hợp riêng đẹp để IN CHO NGƯỜI CHƠI XEM.
 * Tính thật thì luôn đi qua từng cặp (`deltaTran`). Σ = 0 với mọi N.
 */
export function vectorDiemCungBac(soGhe: number): number[] {
  if (!Number.isInteger(soGhe) || soGhe < 4 || soGhe > 8) {
    throw new Error(`Bàn rank phải 4–8 người thật, nhận ${soGhe}`);
  }
  return Array.from({ length: soGhe }, (_, i) => (K / 2) * (soGhe + 1 - 2 * (i + 1)));
}

// ───────────────────────────────────────────────────────────────────────────────
// BẬC — DẪN XUẤT từ điểm, KHÔNG lưu cột
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Bậc từ điểm. KHÔNG hysteresis, KHÔNG lưu: bậc là ĐẦU VÀO của p(), nên giữ một nhãn
 * bậc cao hơn điểm thật = tạo trạng thái thứ hai trôi lệch khỏi sổ VÀ mở đường lách
 * (được tính như bậc cao trong khi điểm đã tụt).
 *
 * @param hang hạng trong bảng mùa (1 = dẫn đầu), `null` nếu chưa lên bảng. Chỉ hai bậc
 *   apex dùng tới nó — và apex KHOÁ ở mùa beta (`APEX_BAT`).
 */
export function bacTuDiem(
  diem: number, soTran: number, hang: number | null = null, apexBat: boolean = APEX_BAT,
): BacId {
  if (soTran < NGUONG_XEP_BAC_A) return 'chua_xep';
  if (apexBat && hang !== null) {
    for (const b of BAC_THANG) {
      if (b.moc_duoi !== null || b.san_apex === null || b.apex_top === null) continue;
      if (diem >= b.san_apex && hang <= b.apex_top) return b.id;
    }
  }
  for (const b of BAC_THANG) {
    if (b.moc_duoi === null) continue;         // apex xét ở trên
    if (diem >= b.moc_duoi) return b.id;
  }
  return 'tap_su';
}

/** Tra định nghĩa bậc theo id — dùng cho cả nhãn UI lẫn số bậc đưa vào p(). */
export function dinhNghiaBac(id: BacId): BacThang | typeof BAC_CHUA_XEP {
  if (id === 'chua_xep') return BAC_CHUA_XEP;
  return BAC_THANG.find((b) => b.id === id) ?? BAC_CHUA_XEP;
}

/**
 * Bậc SỐ để đưa vào p(). Nhận cả nhãn cũ đã nằm trên prod.
 *
 * ⚠ `holdem_results.bac_rank` trước đợt này lưu 'Đồng'/'Bạc'/'Vàng' — vừa TRÙNG TÊN
 * với bậc Brier của Hệ B, vừa được sinh ra bằng `(seed + i*3) % 3` tức NGẪU NHIÊN,
 * không dựa trên gì. Trận cũ vì thế không có bậc thật để replay: coi như bậc mặc định
 * của người chưa xếp. Đoán "chắc là bậc tương ứng" ở đây là đoán trên dữ liệu sống.
 */
export function bacSoTuNhan(raw: string | null | undefined): number {
  if (!raw) return BAC_MAC_DINH_CHUA_XEP;
  const b = BAC_THANG.find((x) => x.id === raw);
  if (b) return b.bac;
  return BAC_MAC_DINH_CHUA_XEP;
}

/**
 * Nấc III / II / I trong một bậc — CHỈ là tiến độ của chính chủ.
 * Không phải nhãn công khai, không lưu, không dùng để ghép bàn, đối thủ không thấy.
 * Nó tồn tại để mỗi ~8–12 trận có một lần "lên" mà không cần thêm bề mặt hiển thị.
 * Trả `null` với bậc không có nấc (Tập Sự và hai bậc apex).
 */
export function nacTuDiem(diem: number, id: BacId): number | null {
  const b = dinhNghiaBac(id);
  if (b.so_nac !== 3 || !('moc_duoi' in b) || b.moc_duoi === null) return null;
  const tren = BAC_THANG.find((x) => x.bac === b.bac + 1);
  const mocTren = tren && tren.moc_duoi !== null ? tren.moc_duoi : b.moc_duoi + 1_080;
  const tienDo = (diem - b.moc_duoi) / (mocTren - b.moc_duoi);
  return Math.min(3, Math.max(1, 3 - Math.floor(3 * tienDo)));
}

/** Điểm còn thiếu để lên bậc kế tiếp. `null` khi đã ở trần thang điểm. */
export function conThieuLenBac(diem: number, id: BacId): number | null {
  const hienTai = dinhNghiaBac(id);
  const bacSo = id === 'chua_xep' ? 0 : hienTai.bac;
  const ke = BAC_THANG.filter((b) => b.moc_duoi !== null && b.bac > bacSo)
    .sort((x, y) => x.bac - y.bac)[0];
  if (!ke || ke.moc_duoi === null) return null;
  return Math.max(0, ke.moc_duoi - diem);
}

/**
 * Reset mùa: neo 0 nên "giữ 50%" đọc thẳng là ×0,5, `trunc` VỀ 0 cho cả dương lẫn âm.
 *
 * Vì `Σ users + Quỹ điểm = 0` và Quỹ = 0 lúc bắt đầu, chia đôi tất cả là TRUNG TÍNH
 * CHÍNH XÁC — phần nén của người dương bằng đúng phần được xoá của người âm. Dư làm
 * tròn luôn là số nguyên (chứng minh §3.4), và nó đi vào Quỹ điểm chứ không bay hơi.
 *
 * ⚠ Beta → mùa 2 là reset CỨNG về 0, không dùng hàm này: số beta méo vì thiếu người,
 *   kéo một nửa cái méo sang mùa 2 là làm bẩn mùa đầu tiên chạy thật.
 */
export function nenDiemQuaMua(diem: number): number {
  return Math.trunc(diem / 2);
}

/**
 * ĐIỂM MÙA PvE — chế độ XẾP HẠNG mùa Beta (đấu máy, founder mở khoá 28/07).
 *
 * Thang lấy từ D16 đã duyệt ("điểm mùa +3/+1/0/−1/−2 (Đấu 5), PvE không âm"):
 * giữ hai vế dương, cắt vế âm. [hạng 1, hạng 2]; từ hạng 3 = 0. Cháy/đầu hàng
 * cũng 0 — PvE không âm nghĩa là thua máy không tụt bậc, chỉ không tiến.
 */
export const DIEM_PVE: readonly number[] = [3, 1];

/** Điểm PvE cho một thứ hạng (1-indexed). Ngoài thang → 0. */
export function diemPveTheoHang(hang: number): number {
  return DIEM_PVE[hang - 1] ?? 0;
}
