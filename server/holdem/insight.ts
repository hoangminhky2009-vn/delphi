/**
 * TÍNH CÁCH TÀI CHÍNH — sáu chỉ số tâm lý từ hành vi chơi thật (04 §3;
 * founder 08/08: *"phân tích hành vi chơi/tiêu dùng và vào lệnh của người
 * chơi để cho họ 1 bảng profile Tính cách tài chính… vui vui, dễ lan toả"*).
 *
 * ─── BA LUẬT ĐỨNG TRÊN MỌI DÒNG DƯỚI ĐÂY ───────────────────────────────────
 * 1. MÔ TẢ được, KÊ ĐƠN không (A10). File này chỉ ĐO — "bạn hay dồn vốn sau
 *    cú thắng" là hợp lệ; "bạn nên mua X" là vi phạm giấy phép tư vấn. Gợi ý
 *    (nếu có) nói về LỐI CHƠI trong trò, không nói về tiền thật.
 * 2. Server trả ID + SỐ, KHÔNG trả câu tiếng Việt — cùng lý do với tự điển
 *    (!): lint từ vựng D26 chỉ quét `web/src`, chuỗi sinh ở đây là đường để
 *    chữ cấm lọt ra UI. Câu chữ + emoji sống ở `web/src/lib/tinh_cach.ts`.
 * 3. THUẦN + TẤT ĐỊNH: nhận mảng vòng đã trải, trả số. Không DB, không RNG —
 *    test chép tay số như A5.2 và mọi con số kiểm lại được.
 *
 * ─── NGUỒN DỮ LIỆU (caller trải sẵn — xem `/me/tinh-cach` ở holdem_api) ─────
 * Mỗi VÒNG một dòng, ghép từ: `hd_cam_ket` (chuỗi lệnh ĐÃ ÁP + cờ tự động) ·
 * `hd_khop_lenh` (lệnh khớp giữa vòng) · `hd_chot_phien` (pnl_bp vòng) ·
 * `hd_brier_vong` · `hd_mo_bang` · map từ seed (ô sự kiện, thật/giả, chuỗi
 * tăng đã xác nhận). KHÔNG cần replay engine — mọi thứ đã nằm trong sổ.
 */

/** Một lệnh mốc như đã ghi trong events (chỉ phần insight cần). */
export interface LenhInsight {
  chieu: 'mua' | 'ban' | 'khong' | 'dong_khong';
  moc_bp: number;
}

/** Một VÒNG đã trải phẳng — đơn vị vào của mọi phép đo. */
export interface VongInsight {
  /**
   * ⚠⚠ TRẬN NÀO — BẮT BUỘC, và nó là thứ chặn một lỗi ĐÃ SỐNG TRONG PROD.
   *
   * Hồ sơ trải 60 trận vào MỘT mảng phẳng, nên hai chỉ số đo CẶP VÒNG KỀ (#4
   * chốt-non, #5 dồn-vốn) từng tính cả cặp *"vòng cuối trận A → vòng 1 trận B"*
   * như hai vòng liền nhau. Mà vòng 1 trận mới là lúc vốn vừa reset về
   * `START_VON` và cú mua mở màn thường là `moc_bp` LỚN NHẤT cả trận ⇒ mỗi
   * đường nối trận nhét một cực đại vào `sauThangBp`/`sauThuaBp` tuỳ dấu vòng
   * cuối trận trước. Map 8 ⇒ ~12,5% số cặp là cặp ranh giới, trong khi ngưỡng
   * kích hoạt #4 chỉ cần 4+4 cặp. (#4 còn lệch MỘT CHIỀU xác định: vòng 1 chưa
   * có gì để bán nên `coBan` gần như luôn false ⇒ kéo cả hai tỷ lệ xuống.)
   *
   * BẮT BUỘC chứ không `?:` có chủ ý: optional thì caller mới quên gắn là lọt
   * IM LẶNG và bug này mọc lại — đúng lớp "chỗ thủng là chỗ QUÊN CHÉP" (D93).
   * Bàn tròn 5 vai tìm ra 17/08; vá cùng ngày (D101).
   */
  match_id: string;
  /** Chuỗi lệnh của vòng (nộp + khớp giữa vòng), theo thứ tự áp. */
  lenh: readonly LenhInsight[];
  /** Kết quả vòng: % tăng trưởng NAV (bp) từ `hd_chot_phien.value_num`. */
  pnl_bp: number | null;
  /** Brier vòng (0..2) — null = toàn tiền mặt, KHÔNG dự báo (D67). */
  brier: number | null;
  /** Có mở Bảng điện tử trong vòng này không. */
  mo_bang: boolean;
  /** Ô của vòng là SỰ KIỆN? (tin tức — nơi đo "phản ứng tin chưa kiểm chứng") */
  o_su_kien: boolean;
  /** Nếu là sự kiện: về sau lộ ra là tin GIẢ? */
  la_tin_gia: boolean;
  /**
   * Chuỗi TĂNG ĐÃ XÁC NHẬN đang chạy khi người chơi quyết định (map:
   * run_huong = 1 và run_dai ≥ 2 tính cả ô vừa lật). Nền của chỉ số đuổi giá.
   */
  chuoi_tang: boolean;
  /** D178 — khoá cắt LỚP DATA (cỡ map · vai ghế). Vắng = dòng dựng trước 0046. */
  so_o?: number | null;
  vai?: string | null;
  /**
   * D206 — ô vòng này bị THAY vì hành vi đám đông (`phan_than` đếm ghế · `be_chuoi`
   * đếm vốn), `null`/vắng = không. Vòng đó người chơi vẫn quyết như thường, nhưng
   * ĐỀ BÀI đã bị chính đám đông sửa — trộn với vòng thường rồi kết luận về tính
   * cách là đọc HOÀN CẢNH thành TÍNH CÁCH.
   */
  thay_o_do?: 'phan_than' | 'be_chuoi' | null;
  /** Nước vòng này do HẾT GIỜ tự nộp — không phải quyết định, loại khỏi đo. */
  tu_dong: boolean;
  /**
   * KHẨU VỊ (D106) — tiền mặt/NAV (bp) và số mã đang giữ SAU khi chốt vòng; từ
   * replay qua tầng `hanh_vi_vong`. Optional: caller cũ / trận không NAV không có.
   */
  tien_mat_bp?: number | null;
  so_ma?: number | null;
}

/**
 * SÁU CHỈ SỐ — mỗi cái một con số chính + cỡ mẫu RIÊNG của nó.
 * `null` = không đủ dữ liệu cho chỉ số đó (khác 0 — "chưa đo được" không phải
 * "bằng không"; hiển thị phải phân biệt, cùng bài học D62).
 */
export interface SauChiSo {
  /** 1 — HIỆU CHỈNH NIỀM TIN: Brier trung bình (0..2, thấp = niềm tin khớp
   *  thực tế) + xu hướng (nửa sau − nửa đầu; âm = đang khá lên). */
  hieu_chinh: { brier_tb: number; xu_huong: number | null; n: number } | null;
  /**
   * 2 — ĐUỔI GIÁ, đo SO VỚI NỀN (hiệu chuẩn null 22/08): `ty_le` = P(mua | chuỗi
   * tăng đã chạy) · `nen` = P(mua | không chuỗi) · `lech` = ty_le − nen.
   * ⚠ Bản cũ đo "trong các vòng có mua, mấy phần rơi vào chuỗi" — con số ấy bằng
   * đúng tần suất nền của ô chuỗi-tăng (~0,10 ở MỌI bot, kể cả bot không nhìn
   * giá), tức đo BẢN ĐỒ chứ không đo người; ngưỡng 0,6 không bao giờ chạm. Đo so
   * với nền thì bot mua đều mọi vòng ra lech ≈ 0 — đúng null.
   */
  duoi_gia: { ty_le: number; nen: number; lech: number; n: number } | null;
  /**
   * 3 — PHẢN ỨNG TIN CHƯA KIỂM CHỨNG, đo SO VỚI NỀN: `ty_le` = P(vào lệnh | vòng
   * sự kiện) · `nen` = P(vào lệnh | vòng thường) · `lech` = ty_le − nen ·
   * `phan_tin_gia` = trong các cú vào ở vòng sự kiện, mấy phần là tin sau lộ GIẢ ·
   * `nen_tin_gia` = tỷ lệ giả của MỌI vòng sự kiện đã gặp · `lech_tin_gia` = hiệu.
   * ⚠ Bản cũ: bot nào cũng giao dịch mọi vòng ⇒ ty_le = 1,00 ở cả oracle, và
   * phan_tin_gia = tỷ lệ giả nền của map ⇒ ⚡ dán lên 25–50% mọi bot. Đo so với
   * nền thì "bị tin kéo" = vào ở vòng sự kiện NHIỀU HƠN vòng thường.
   */
  theo_tin: {
    ty_le: number; nen: number; lech: number;
    phan_tin_gia: number | null; nen_tin_gia: number; lech_tin_gia: number | null;
    n: number;
  } | null;
  /** 4 — CHỐT NON / GỒNG LỖ (disposition): share vòng-sau-XANH có bán trừ
   *  share vòng-sau-ĐỎ có bán. Dương = chốt lãi non + ôm lỗ. */
  chot_non: { lech: number; ban_sau_xanh: number; ban_sau_do: number; n: number } | null;
  /** 5 — DỒN VỐN SAU KẾT QUẢ: cỡ mua trung bình (tổng mốc bp/vòng) sau
   *  thắng và sau thua, so nền chung. >1 = đạp ga. */
  don_von: {
    nen_bp: number; sau_thang_x: number | null; sau_thua_x: number | null; n: number;
  } | null;
  /** 6 — GIÁ CỦA THÔNG TIN: tỷ lệ vòng mở bảng + Brier khi mở vs không. */
  mua_tin: {
    ty_le: number; brier_mo: number | null; brier_khong: number | null; n: number;
  } | null;
  /**
   * KV — KHẨU VỊ (D106, §1.2: ĐO chứ không THƯỞNG): phơi nhiễm trung bình
   * (1 − tiền mặt/NAV, 0..1), số mã trung bình, tỷ lệ vòng ĐỨNG NGOÀI (tiền mặt
   * ≥ 95%). Đọc ngoài đời: quỹ dự phòng / thói quen để dành / dồn hay rải.
   * Chỉ trên vòng quyết định có số khẩu vị (trận NAV qua kho).
   */
  khau_vi: { phoi_nhiem_tb: number; so_ma_tb: number; dung_ngoai: number; n: number } | null;
}

/** Kết quả gộp: chỉ số + id tính cách + cỡ mẫu tổng. */
export interface HoSoTinhCach {
  chi_so: SauChiSo;
  /** Id tính cách — catalog câu chữ ở client (`web/src/lib/tinh_cach.ts`). */
  tinh_cach: TinhCachId;
  /** Hai trục dựng nên thẻ (D106 §3.2) — null khi chưa đủ mẫu. */
  khau_vi: KhauViId | null;
  net: NetId | null;
  /** BẬC ĐỌC — kỹ năng, TÁCH khỏi thẻ (hội tụ khi giỏi lên, không phải chân dung). */
  bac_doc: BacDocId;
  /**
   * D178 — HỒ SƠ NÀY ĐƯỢC DỰNG TỪ NHỮNG LỚP DATA NÀO.
   *
   * ⚠⚠ Vì sao phải KHAI RA thay vì cứ gộp: mỗi (cỡ map × vai) là một loại quan
   * sát khác bản chất (map 8 ép thời gian · cá mập có vốn ×3 và bị ghim Đòn
   * Bẩy — xem `LOP_DATA`). Một hồ sơ dựng 80% từ map 8 nói về "quyết khi gấp",
   * dựng 80% từ ghế cá mập thì con số phơi nhiễm là của HOÀN CẢNH. Trộn rồi im
   * lặng là đọc hoàn cảnh thành tính cách — đúng lỗi cả tầng D106 dựng ra để
   * tránh, và §1.2 cấm.
   *
   * Đây là NHÃN, không phải bộ lọc: hồ sơ vẫn dựng như cũ (mùa này n≈3–5, lọc
   * theo lớp là còn 0 mẫu). Người đọc gộp — và ngày mai là người mua data —
   * thấy được mình đang cầm hỗn hợp nào.
   */
  lop_data: readonly { ma: string; n_vong: number }[];
  /**
   * D206 — bao nhiêu vòng trong gói này có ĐỀ BÀI bị đám đông sửa.
   *
   * ⚠ KHAI RA, KHÔNG LỌC (cùng nếp `lop_data`): mùa này n≈3–5, lọc là còn 0 mẫu.
   * Người đọc hồ sơ tự quyết có chiết khấu hay không — nhưng phải BIẾT là có.
   */
  n_vong_thay_o: number;
  /**
   * Chuỗi Brier theo thời gian (tối đa 48 vòng gần nhất) — nguyên liệu cho
   * đường "độ chuẩn niềm tin" trên trang Tài chính cá nhân. Chỉ SỐ, không câu.
   */
  brier_chuoi: number[];
  n_vong: number;
  n_tran: number;
}

/**
 * THẺ = KHẨU VỊ × NÉT (D106 §3.2) — 3 × 3 = 9 thẻ + 🐣.
 *
 * Vì sao bỏ chuỗi `if` ưu tiên cũ (phan_xa → tra_thu → du_song → …): hiệu chuẩn
 * null 22/08 cho thấy nó đo BẢN ĐỒ — ⚡ rơi vào 25–50% MỌI bot kể cả oracle, 🦈
 * không bot hoạt động nào đạt được — và nó xếp mọi người chơi lâu năm vào 🧊/🦈
 * (thiên kiến học được thì giảm, kỹ năng thì hội tụ). Thứ KHÔNG hội tụ theo kỹ
 * năng là KHẨU VỊ; thứ phân biệt hai người cùng khẩu vị là cái gì đang điều
 * khiển họ. Hai trục, tất định, người chơi hiểu VÌ SAO ra thẻ đó.
 *
 *   KHẨU VỊ   de_danh  — phơi nhiễm TB < 40%: phần lớn tiền "không động tới"
 *             don      — phơi nhiễm ≥ 40% và ít mã (< 2,5): dồn vào một hai thứ
 *             rai      — phơi nhiễm ≥ 40% và nhiều mã: rải
 *   NÉT       ket_qua  — bị KẾT QUẢ VỪA RỒI điều khiển (chốt non/ôm lỗ, dồn sau
 *                        thua/thắng) — nền học thuật vững nhất (D100)
 *             ben_ngoai— bị THỨ BÊN NGOÀI kéo (chuỗi giá đã chạy, tin chưa kiểm)
 *             lanh     — không nét nào vượt ngưỡng so với nền
 *   Cả hai nét vượt ⇒ ket_qua thắng (có dấu thần kinh, Frydman 2014) — thứ tự này
 *   là một phần của luật, ghi ở đây chứ không ẩn trong code.
 *
 * KỸ NĂNG (bậc đọc, từ Brier) đứng RIÊNG — không vào thẻ. Hai người cùng Brier
 * 0,5 vẫn ra hai thẻ khác nhau nếu một người dồn còn người kia để dành.
 */
export type KhauViId = 'de_danh' | 'don' | 'rai';
export type NetId = 'ket_qua' | 'ben_ngoai' | 'lanh';
export type BacDocId = 'chua' | 'doan_mo' | 'dang_hoc' | 'doc_duoc' | 'mat_than';
export type TinhCachId =
  | 'dang_dinh_hinh'
  | 'de_danh_lanh' | 'de_danh_ket_qua' | 'de_danh_ben_ngoai'
  | 'don_lanh' | 'don_ket_qua' | 'don_ben_ngoai'
  | 'rai_lanh' | 'rai_ket_qua' | 'rai_ben_ngoai';

/**
 * Ngưỡng — MỘT chỗ, PLAYTEST-TUNE (A8.2). Nền null đo 22/08 trên bot (map 8,
 * 40 người × 10 trận, `scripts/hieu_chuan_null.ts`): sau_thua_x p90 ≤ 1,25 ·
 * chot_non lech p90 ≤ +0,13 · duoi_gia lech p90 ≤ 0,21 (bấm bừa) · theo_tin lech p90
 * ≤ 0,06 · thẻ ra *_lanh 93–100%. Ngưỡng đặt trên p90 của null với biên ≥ 0,1.
 */
export const NGUONG_TINH_CACH = {
  /** Dưới ngần này vòng có dữ liệu thì chưa xếp ai vào đâu cả (gói còn đòi 40). */
  N_VONG_TOI_THIEU: 12,
  /** KHẨU VỊ */
  DE_DANH_PHOI_NHIEM: 0.40,
  DON_SO_MA: 2.5,
  /** NÉT kết quả */
  KET_QUA_CHOT_NON: 0.25,
  KET_QUA_X: 1.5,
  /** NÉT bên ngoài — lệch so với nền */
  BEN_NGOAI_LECH: 0.30,
  /** BẬC ĐỌC — Brier TB (thang 0–2): oracle ~0,48 · bấm bừa ~1,06 (null 22/08). */
  BAC_DOC: { DOAN_MO: 1.0, DANG_HOC: 0.75, DOC_DUOC: 0.55 },
} as const;

const tb = (xs: readonly number[]): number =>
  xs.reduce((a, b) => a + b, 0) / xs.length;

/** Tổng mốc MUA của một vòng (bp) — thước "cỡ ý định vào" so sánh được. */
const mocMua = (v: VongInsight): number =>
  v.lenh.filter((l) => l.chieu === 'mua' || l.chieu === 'khong')
    .reduce((a, l) => a + l.moc_bp, 0);

const coBan = (v: VongInsight): boolean =>
  v.lenh.some((l) => l.chieu === 'ban' || l.chieu === 'dong_khong');

/**
 * Cặp (i, i+1) có phải HAI VÒNG LIỀN NHAU TRONG CÙNG MỘT TRẬN không.
 * MỘT nguồn cho cả #4 lẫn #5 — hai bản kiểm là hai bản sẽ trôi (D61), và cú
 * trôi ở đây không ném lỗi, nó chỉ làm một chỉ số sai im lặng. Xem `match_id`.
 */
const capLienTiep = (a: VongInsight, b: VongInsight): boolean =>
  a.match_id === b.match_id && !b.tu_dong;

/**
 * SÁU CHỈ SỐ từ mảng vòng đã trải (gộp mọi trận, thứ tự thời gian).
 *
 * ⚠ Vòng `tu_dong` (hết giờ tự nộp) bị LOẠI khỏi mọi phép đo hành vi —
 * "không kịp bấm" không phải một quyết định (D38), trộn vào là pha loãng
 * đúng cột đắt nhất. Riêng Brier vẫn tính: danh mục họ ĐANG giữ là niềm tin
 * thật của họ, dù vòng đó không bấm gì.
 */
export function tinhChiSo(vongs: readonly VongInsight[]): SauChiSo {
  const quyet = vongs.filter((v) => !v.tu_dong);

  // 1 — Brier: trung bình + xu hướng nửa sau so nửa đầu.
  const brier = vongs.map((v) => v.brier).filter((b): b is number => b !== null);
  let hieuChinh: SauChiSo['hieu_chinh'] = null;
  if (brier.length >= 3) {
    const nua = Math.floor(brier.length / 2);
    hieuChinh = {
      brier_tb: tb(brier),
      xu_huong: brier.length >= 6 ? tb(brier.slice(nua)) - tb(brier.slice(0, nua)) : null,
      n: brier.length,
    };
  }

  // 2 — Đuổi giá SO VỚI NỀN: P(mua | chuỗi tăng) − P(mua | không chuỗi).
  const chuoi = quyet.filter((v) => v.chuoi_tang);
  const khongChuoi = quyet.filter((v) => !v.chuoi_tang);
  const tyLeMua = (xs: readonly VongInsight[]) =>
    xs.filter((v) => mocMua(v) > 0).length / xs.length;
  const duoiGia = chuoi.length >= 4 && khongChuoi.length >= 4
    ? (() => {
      const tl = tyLeMua(chuoi); const nen = tyLeMua(khongChuoi);
      return { ty_le: tl, nen, lech: tl - nen, n: chuoi.length };
    })()
    : null;

  // 3 — Theo tin SO VỚI NỀN: P(vào | sự kiện) − P(vào | thường); tin giả so nền.
  const vongTin = quyet.filter((v) => v.o_su_kien);
  const vongThuong = quyet.filter((v) => !v.o_su_kien);
  const vaoTheoTin = vongTin.filter((v) => v.lenh.length > 0);
  const theoTin = vongTin.length >= 5 && vongThuong.length >= 5
    ? (() => {
      const tl = vaoTheoTin.length / vongTin.length;
      const nen = vongThuong.filter((v) => v.lenh.length > 0).length / vongThuong.length;
      const nenGia = vongTin.filter((v) => v.la_tin_gia).length / vongTin.length;
      const phanGia = vaoTheoTin.length > 0
        ? vaoTheoTin.filter((v) => v.la_tin_gia).length / vaoTheoTin.length : null;
      return {
        ty_le: tl, nen, lech: tl - nen,
        phan_tin_gia: phanGia, nen_tin_gia: nenGia,
        lech_tin_gia: phanGia === null ? null : phanGia - nenGia,
        n: vongTin.length,
      };
    })()
    : null;

  // KV — Khẩu vị: trên vòng quyết định có số khẩu vị (trận NAV qua kho).
  const coKv = quyet.filter((v) => typeof v.tien_mat_bp === 'number' && typeof v.so_ma === 'number');
  const khauVi = coKv.length >= 8
    ? {
      phoi_nhiem_tb: tb(coKv.map((v) => 1 - (v.tien_mat_bp as number) / 10_000)),
      so_ma_tb: tb(coKv.map((v) => v.so_ma as number)),
      dung_ngoai: coKv.filter((v) => (v.tien_mat_bp as number) >= 9_500).length / coKv.length,
      n: coKv.length,
    }
    : null;

  // 4 — Chốt non: share bán sau vòng XANH − share bán sau vòng ĐỎ.
  // "Sau" = vòng kế tiếp TRONG CÙNG MỘT TRẬN (xem `capLienTiep`).
  let sauXanh = 0; let sauXanhBan = 0; let sauDo = 0; let sauDoBan = 0;
  for (let i = 0; i + 1 < vongs.length; i += 1) {
    const kq = vongs[i]!.pnl_bp;
    const ke = vongs[i + 1]!;
    if (kq === null || !capLienTiep(vongs[i]!, ke)) continue;
    if (kq > 0) { sauXanh += 1; if (coBan(ke)) sauXanhBan += 1; }
    if (kq < 0) { sauDo += 1; if (coBan(ke)) sauDoBan += 1; }
  }
  const chotNon = sauXanh >= 4 && sauDo >= 4
    ? {
      ban_sau_xanh: sauXanhBan / sauXanh,
      ban_sau_do: sauDoBan / sauDo,
      lech: sauXanhBan / sauXanh - sauDoBan / sauDo,
      n: sauXanh + sauDo,
    }
    : null;

  // 5 — Dồn vốn: cỡ mua vòng-kế sau thắng / sau thua, so NỀN chung.
  const coMuaBp = quyet.map(mocMua).filter((x) => x > 0);
  const nenBp = coMuaBp.length > 0 ? tb(coMuaBp) : 0;
  const sauThangBp: number[] = []; const sauThuaBp: number[] = [];
  for (let i = 0; i + 1 < vongs.length; i += 1) {
    const kq = vongs[i]!.pnl_bp;
    const ke = vongs[i + 1]!;
    if (kq === null || !capLienTiep(vongs[i]!, ke)) continue;
    const m = mocMua(ke);
    if (m <= 0) continue;
    if (kq > 0) sauThangBp.push(m);
    if (kq < 0) sauThuaBp.push(m);
  }
  const donVon = nenBp > 0 && (sauThangBp.length >= 3 || sauThuaBp.length >= 3)
    ? {
      nen_bp: nenBp,
      sau_thang_x: sauThangBp.length >= 3 ? tb(sauThangBp) / nenBp : null,
      sau_thua_x: sauThuaBp.length >= 3 ? tb(sauThuaBp) / nenBp : null,
      n: sauThangBp.length + sauThuaBp.length,
    }
    : null;

  // 6 — Giá của thông tin: tỷ lệ mở bảng + Brier có/không mở.
  const brierMo = vongs.filter((v) => v.mo_bang && v.brier !== null).map((v) => v.brier!);
  const brierKhong = vongs.filter((v) => !v.mo_bang && v.brier !== null).map((v) => v.brier!);
  const muaTin = quyet.length >= 5
    ? {
      ty_le: quyet.filter((v) => v.mo_bang).length / quyet.length,
      brier_mo: brierMo.length >= 3 ? tb(brierMo) : null,
      brier_khong: brierKhong.length >= 3 ? tb(brierKhong) : null,
      n: quyet.length,
    }
    : null;

  return {
    hieu_chinh: hieuChinh, duoi_gia: duoiGia, theo_tin: theoTin,
    chot_non: chotNon, don_von: donVon, mua_tin: muaTin, khau_vi: khauVi,
  };
}

/** KHẨU VỊ từ chỉ số — null khi chưa có số khẩu vị. */
export function xepKhauVi(chiSo: SauChiSo): KhauViId | null {
  const kv = chiSo.khau_vi;
  if (!kv) return null;
  if (kv.phoi_nhiem_tb < NGUONG_TINH_CACH.DE_DANH_PHOI_NHIEM) return 'de_danh';
  return kv.so_ma_tb < NGUONG_TINH_CACH.DON_SO_MA ? 'don' : 'rai';
}

/**
 * NÉT — cái gì đang điều khiển. `lanh` cũng là một câu trả lời (không nét nào
 * vượt nền), KHÁC null (chưa đo được nét nào cả).
 */
export function xepNet(chiSo: SauChiSo): NetId | null {
  const N = NGUONG_TINH_CACH;
  const coKetQua = chiSo.chot_non !== null || chiSo.don_von !== null;
  const coBenNgoai = chiSo.duoi_gia !== null || chiSo.theo_tin !== null;
  if (!coKetQua && !coBenNgoai) return null;
  const ketQua = (chiSo.chot_non !== null && chiSo.chot_non.lech >= N.KET_QUA_CHOT_NON)
    || (chiSo.don_von?.sau_thua_x != null && chiSo.don_von.sau_thua_x >= N.KET_QUA_X)
    || (chiSo.don_von?.sau_thang_x != null && chiSo.don_von.sau_thang_x >= N.KET_QUA_X);
  if (ketQua) return 'ket_qua';
  const benNgoai = (chiSo.duoi_gia !== null && chiSo.duoi_gia.lech >= N.BEN_NGOAI_LECH)
    || (chiSo.theo_tin !== null && chiSo.theo_tin.lech >= N.BEN_NGOAI_LECH);
  return benNgoai ? 'ben_ngoai' : 'lanh';
}

/** BẬC ĐỌC — kỹ năng từ Brier, tách khỏi thẻ. */
export function xepBacDoc(chiSo: SauChiSo): BacDocId {
  const b = chiSo.hieu_chinh?.brier_tb;
  const B = NGUONG_TINH_CACH.BAC_DOC;
  if (b === undefined) return 'chua';
  if (b >= B.DOAN_MO) return 'doan_mo';
  if (b >= B.DANG_HOC) return 'dang_hoc';
  if (b >= B.DOC_DUOC) return 'doc_duoc';
  return 'mat_than';
}

/**
 * XẾP THẺ = KHẨU VỊ × NÉT. Thiếu một trong hai (chưa đủ mẫu) ⇒ 🐣 — thà nói
 * "chưa đọc được" còn hơn dựng nửa tấm thẻ.
 */
export function xepTinhCach(chiSo: SauChiSo, nVong: number): TinhCachId {
  if (nVong < NGUONG_TINH_CACH.N_VONG_TOI_THIEU) return 'dang_dinh_hinh';
  const kv = xepKhauVi(chiSo);
  const net = xepNet(chiSo);
  if (kv === null || net === null) return 'dang_dinh_hinh';
  return `${kv}_${net}` as TinhCachId;
}

/**
 * Hỗn hợp lớp data của một tập vòng — xếp giảm dần theo số vòng, giữ TẤT CẢ
 * (không cắt top-N: một lớp chiếm 2% vẫn là lớp phải nhìn thấy khi đọc hồ sơ).
 *
 * ⚠ Trả `ma` (id `"<cỡ map>:<vai>"`), KHÔNG trả tên tiếng Việt — LUẬT 2 đầu
 * file. Chữ của từng lớp sống ở `LOP_DATA` (config, cho admin + doc) và ở
 * catalog client, không sinh từ đây.
 * ⚠ THUẦN vẫn nguyên (luật 3): `ma` ghép từ hai trường CÓ SẴN trên dòng vòng,
 * không đọc DB, không RNG — nên file này giữ được tính chép-tay-kiểm-được.
 */
export function mixLopData(
  vongs: readonly VongInsight[],
): { ma: string; n_vong: number }[] {
  const dem = new Map<string, { ma: string; n_vong: number }>();
  for (const v of vongs) {
    const ma = `${v.so_o ?? '?'}:${v.vai ?? 'khong_vai'}`;
    const cu = dem.get(ma);
    if (cu) cu.n_vong += 1;
    else dem.set(ma, { ma, n_vong: 1 });
  }
  return [...dem.values()].sort((a, b) => b.n_vong - a.n_vong || (a.ma < b.ma ? -1 : 1));
}

export function dungHoSo(
  vongs: readonly VongInsight[], nTran: number,
): HoSoTinhCach {
  const chiSo = tinhChiSo(vongs);
  const tinhCach = xepTinhCach(chiSo, vongs.length);
  return {
    chi_so: chiSo,
    tinh_cach: tinhCach,
    khau_vi: tinhCach === 'dang_dinh_hinh' ? null : xepKhauVi(chiSo),
    net: tinhCach === 'dang_dinh_hinh' ? null : xepNet(chiSo),
    bac_doc: xepBacDoc(chiSo),
    lop_data: mixLopData(vongs),
    n_vong_thay_o: vongs.filter((v) => v.thay_o_do != null).length,
    brier_chuoi: vongs.map((v) => v.brier)
      .filter((b): b is number => b !== null).slice(-48),
    n_vong: vongs.length,
    n_tran: nTran,
  };
}
