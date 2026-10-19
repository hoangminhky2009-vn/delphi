/**
 * SỔ ĐĂNG KÝ ĐẶC TRƯNG PFM — bốn lớp Context → Intent → Behavior → Outcome (+Intervention).
 * MỘT NGUỒN cho cả client (tính) lẫn server (nhận) — D61: bản cài đặt thứ hai sẽ trôi.
 *
 * ⚠⚠ ĐÂY LÀ CỬA MỘT CHIỀU (P2 🔒). Thứ đã đổ lên server thì đã đổ. Nên:
 *   · KHÔNG BAO GIỜ có số tiền tuyệt đối · KHÔNG BAO GIỜ có chữ tự do · không gì
 *     nhận diện được cá nhân. Chỉ nhãn từ miền đóng, tỷ lệ, và đếm.
 *   · Server nhận theo DANH SÁCH TRẮNG đọc từ chính file này (registry-driven): mã lạ,
 *     lớp lệch, giá trị ngoài miền ⇒ từ chối NGAY CỬA (khuôn danh-sách-trắng D61).
 *
 * ⚠ LUẬT THÊM MÃ MỚI (P19 — founder 30/08): mỗi mã phải kèm một dòng `// vì sao:` trả
 * lời được *"biết biến này thì phân biệt được HÀNH VI hay OUTCOME nào?"*. Không trả lời
 * được thì KHÔNG THÊM. `tests/pfm_nen.test.ts` đọc chú thích này và đỏ nếu thiếu.
 *
 * ⚠ ĐỔI DANH MỤC = TĂNG `SCHEMA_VERSION`, không ghi đè dòng cũ. Dữ liệu cũ giữ version
 * cũ để so sánh dọc thời gian không bị gãy.
 *
 * Nguồn: `05b` K14 + T7.2 · `05c` §5 (9 nhãn lòi ra khi đối chiếu 42 chức năng) ·
 * file 07 §2.1 (bốn lớp) · D148/D174/D175.
 */

/**
 * 1 → 2 (D324, 13/09): thêm năm mã GAME `gm_*` do SERVER tính từ `hanh_vi_vong`, ghép theo kỳ
 * dưới cửa `noi_game`. Dòng cũ giữ `schema_version = 1`.
 */
export const SCHEMA_VERSION = 2;

/** Lớp dữ liệu — đúng khung founder (file 07 §2.1) + Intervention (§9). */
export type LopDacTrung = 'context' | 'intent' | 'behavior' | 'outcome' | 'intervention';

/**
 * `chi_server` (D324) — mã chỉ MÁY CHỦ được ghi (tính từ dữ liệu server giữ). Client gửi mã
 * ấy qua cửa đồng bộ ⇒ bị từ chối ngay cửa: một con số server tự đếm được mà cho client gửi
 * là mời một cú lệch không có trọng tài (cùng lý lẽ `MA_CUA_SERVER` phía web).
 */
export type DinhNghiaDacTrung =
  /** Nhãn từ MIỀN ĐÓNG — giá trị phải nằm trong `mien`. */
  | { lop: LopDacTrung; kieu: 'nhan'; mien: readonly string[]; theo_doi_tuong?: boolean; chi_server?: boolean }
  /** Tỷ lệ trong [0,1] (hoặc [-1,1] nếu `am: true`). Làm tròn 3 chữ số khi ghi. */
  | { lop: LopDacTrung; kieu: 'ty_le'; am?: boolean; theo_doi_tuong?: boolean; chi_server?: boolean }
  /** Đếm nguyên, 0..max. */
  | { lop: LopDacTrung; kieu: 'dem'; max: number; theo_doi_tuong?: boolean; chi_server?: boolean }
  /** Phân bố tỷ lệ trên một miền (các khoá cộng lại ≈ 1). */
  | { lop: LopDacTrung; kieu: 'phan_bo'; mien: readonly string[]; theo_doi_tuong?: boolean; chi_server?: boolean };

export const SO_DANG_KY = {
  /* ══ CONTEXT — hoàn cảnh, khai bằng MENU ở cửa vào (A1/A4) ═══════════════ */
  /*
   * ⚠ KHÔNG THÊM CỘT `cohort_key`. Quyết định B4 (founder 03/09/2026, D216):
   * cohort_key SUY LÚC ĐỌC bằng `users.age_band` × `users.region` × các mã
   * context dưới đây — KHÔNG lưu sẵn (một khoá lưu sẵn là bản sao thứ hai của
   * chính ba trường này, D61, và đóng băng taxonomy cohort lúc GHI thay vì lúc
   * ĐỌC). Chi tiết + lý do đầy đủ: `05b-pfm-kien-truc.md` T7.3.
   */

  ctx_tu_lap: { lop: 'context', kieu: 'nhan', mien: ['phu_thuoc', 'ban_tu_lap', 'tu_lap'] },
  // vì sao: mức tự lập chia đôi ý nghĩa của MỌI chỉ số chi tiêu — "chi 2tr/tháng" của
  // người phụ thuộc gia đình và người tự trả tiền nhà là hai hành vi khác hẳn nhau.

  ctx_nguon_thu: { lop: 'context', kieu: 'nhan', mien: ['tro_cap_gd', 'luong', 'tu_do', 'khac'] },
  // vì sao: nguồn thu quyết định NHỊP tiền vào (đều/thất thường) ⇒ phân biệt được
  // "tiền về là tiêu" do bốc đồng với do thu nhập không đều.

  ctx_khung: { lop: 'context', kieu: 'nhan', mien: ['hu', '50_30_20', 'kakeibo', 'tu_do'] },
  // vì sao: khung phương pháp user CHỌN (A2) là biến cohort mạnh nhất của P14 —
  // "người chọn khung nào thì hoàn thành mục tiêu cao hơn" là câu hỏi nghiên cứu của
  // chính G6. Thiếu nó thì cú chọn đường trở thành dữ liệu chết.

  /* ══ INTENT — sinh từ CÚ CHỌN menu lúc tạo hũ (C1) ═══════════════════════ */

  y_loai: {
    lop: 'intent', kieu: 'nhan', theo_doi_tuong: true,
    mien: ['an_uong', 'di_lai', 'giao_duc', 'thiet_bi', 'du_lich', 'du_phong',
      'tra_no', 'qua_tang', 'su_kien', 'suc_khoe', 'choi', 'khac'],
  },
  // vì sao: loại mục tiêu là trục cohort trung tâm ("nhóm có mục tiêu giáo dục hoàn
  // thành cao hơn nhóm mục tiêu du lịch không?"). Sinh từ menu nên đúng 100%, không NLP.

  y_han: { lop: 'intent', kieu: 'nhan', mien: ['ngan', 'vua', 'dai'], theo_doi_tuong: true },
  // vì sao: horizon (<3 · 3–6 · >6 tháng) phân biệt được kiên nhẫn với bốc đồng mà
  // KHÔNG cần biết số tiền — đúng thứ present-bias đo được.

  y_uu_tien: { lop: 'intent', kieu: 'nhan', mien: ['cao', 'vua', 'thap'], theo_doi_tuong: true },
  // vì sao: ưu tiên user TỰ gán cho biết khi phải hy sinh thì hũ nào bị bỏ trước.

  y_thiet_yeu: { lop: 'intent', kieu: 'nhan', mien: ['thiet_yeu', 'khong'], theo_doi_tuong: true },
  // vì sao: nhãn thiết-yếu do CHÍNH USER gắn là định nghĩa "túng quẫn thật" của Oracle
  // (D139 Q1) — app không tự suy đoán cái gì thiết yếu với ai.

  /* ══ BEHAVIOR — user thực sự làm gì theo thời gian ═══════════════════════ */

  hv_ngay_co_mat: { lop: 'behavior', kieu: 'dem', max: 31 },
  // vì sao: đơn vị đếm SẠCH của mọi phần thưởng (P5) và là mẫu số của mọi tỷ lệ kỳ.

  hv_ngay_co_ghi: { lop: 'behavior', kieu: 'dem', max: 31 },
  // vì sao: tách ĐỘ ĐẦY DỮ LIỆU khỏi GIỮ CHÂN (D139) — hai trục có chủ đích tách nhau.

  hv_khai_0: { lop: 'behavior', kieu: 'dem', max: 31 },
  // vì sao: ngày CHỦ ĐỘNG không tiêu là loại ngày đáng ghi nhận nhất, và là số 0 THẬT
  // chứ không phải null (D140) — thiếu nhãn này thì nó biến mất y hệt ngày không mở app.

  hv_tieu_it: { lop: 'behavior', kieu: 'dem', max: 31 },
  // vì sao: trạng thái thứ ba — có tiêu, không rõ bao nhiêu; gộp vào 0 là sai lệch
  // xuống, gộp vào null là bỏ phí tín hiệu (D140).

  hv_cach_ghi: { lop: 'behavior', kieu: 'phan_bo', mien: ['tay', 'mau_lap', 'dan_sms'] },
  // vì sao: PROVENANCE (file 07 §4) — không phải điểm tin cậy. Phân tích calibration
  // phải biết đang so với loại số nào: dòng dán-SMS đúng máy móc, dòng gõ tay hay làm tròn.

  hv_chi_bu: { lop: 'behavior', kieu: 'ty_le' },
  // vì sao: chi tuỳ ý ngày N+1 sau ngày chi lớn ÷ nền — nhân chứng phía SỔ của trục
  // "chi bù sau cú tệ", đối chất với #5 phía game.

  hv_tien_ve_tieu: { lop: 'behavior', kieu: 'ty_le' },
  // vì sao: % chi trong 48h sau ngày tiền về — proxy present-bias đo NGOÀI trận.

  hv_doan_lech: { lop: 'behavior', kieu: 'ty_le', am: true },
  // vì sao: |đoán − thực| ÷ thực của hoá đơn tháng — calibration đời thật, đối chất
  // với Brier trong game. Âm được vì đoán thiếu và đoán thừa là hai lỗi khác nhau.

  hv_tiet_kiem_rong: { lop: 'behavior', kieu: 'ty_le', am: true },
  // vì sao: (thu − chi)/thu — quỹ dự phòng bản tối giản. Âm = tiêu quá thu, một tín
  // hiệu khác hẳn "tiết kiệm ít".

  hv_vi_sale: { lop: 'behavior', kieu: 'ty_le' },
  // vì sao: tỷ lệ khoản user tự gắn nhãn "vì sale/bạn rủ" — nhân chứng phía SỔ của
  // trục FOMO. Thiếu nó thì trục FOMO chỉ có một nhân chứng (game), không đối chất được.

  hv_sua_muc_tieu: { lop: 'behavior', kieu: 'phan_bo', mien: ['tang', 'giam', 'khong'], theo_doi_tuong: true },
  // vì sao: HƯỚNG sửa target (không phải số tiền) — "thường xuyên hạ mục tiêu" là một
  // chân dung khác hẳn "giữ nguyên rồi bỏ".

  hv_tam_dung_hu: { lop: 'behavior', kieu: 'dem', max: 99, theo_doi_tuong: true },
  // vì sao: TẠM DỪNG rồi QUAY LẠI là quỹ đạo khác hẳn BỎ HẲN (C8, founder 30/08) —
  // và là tín hiệu phục hồi quý nhất cho retention. Thiếu nó thì hai thứ trộn làm một.

  hv_doi_duong: { lop: 'behavior', kieu: 'dem', max: 9 },
  // vì sao: cú đổi khung/đường là DATA của chính P14 ("đường nào giữ chân được").

  hv_so_voi_ky_truoc: { lop: 'behavior', kieu: 'ty_le', am: true },
  // vì sao: trục so sánh NỘI TẠI (E3) — P12 cấm so tiền giữa người, nên so-mình-với-
  // chính-mình là trục so sánh hợp lệ DUY NHẤT.

  hv_tat_oracle: { lop: 'behavior', kieu: 'nhan', mien: ['bat', 'tat'] },
  // vì sao: phiếu chống trung thực nhất về giọng (D138 §9) VÀ là nấc THOÁT của phễu
  // can thiệp — thiếu thì intervention lift bị thổi phồng.

  hv_mau_thuan: { lop: 'behavior', kieu: 'ty_le' },
  // vì sao: tỷ lệ ngày tự-khai cãi nhau với sổ. KHÔNG phải "data bẩn" — là tín hiệu
  // (P17): giữ cả hai vế, cú giải quyết của user là một sự kiện mới.

  /* ══ GAME — tín hiệu từ Alpha Draft, SERVER tính từ `hanh_vi_vong`, ghép theo kỳ dưới
   *    cửa `noi_game` (D324, founder chốt 13/09 — A8.2). ⚠ CHƯA HIỆU CHUẨN: Test A (độ tin
   *    cậy lặp lại, tệp 10 §4.3) chưa chạy; đọc như tín hiệu, không như phép đo đã kiểm. ══ */

  gm_n_tran: { lop: 'behavior', kieu: 'dem', max: 999, chi_server: true },
  // vì sao: cỡ mẫu của bốn mã game dưới — không có n thì 0,4 của một trận và 0,4 của ba
  // mươi trận đọc như nhau, và mọi tương quan game↔sổ sau này cân sai trọng số.

  gm_tk_giu: { lop: 'behavior', kieu: 'ty_le', chi_server: true },
  // vì sao: tỷ lệ trận CÓ GỬI tiết kiệm mà giữ đủ kỳ — cam kết tự nguyện dưới áp lực; tách
  // người giữ khỏi người phá (present bias, tệp 10 §3.3 N1), đối chiếu được với hũ bỏ dở.

  gm_tk_huy: { lop: 'behavior', kieu: 'dem', max: 99, chi_server: true },
  // vì sao: số cú PHÁ cam kết trong kỳ — thứ đắt nhất của cơ chế (0063: một cam kết bị bẻ,
  // có giá tiền, đúng vòng); cùng tỷ lệ giữ mà 1 cú khác 9 cú.

  gm_brier_tb: { lop: 'behavior', kieu: 'ty_le', chi_server: true },
  // vì sao: Brier trung bình ÷ 2 (thang 0..2 về [0,1]) — niềm tin có khớp thực tế không;
  // nền của năng lực "đọc tin", đối chiếu được với độ lệch giữa dự tính và thực chi của sổ.

  gm_phoi_nhiem: { lop: 'behavior', kieu: 'ty_le', chi_server: true },
  // vì sao: phơi nhiễm TB (1 − tiền mặt/NAV) — khẩu vị rủi ro đo bằng HÀNH VI, đối chiếu
  // với khẩu vị tự khai (Dohmen) và với tỷ lệ tiền để dành thật của sổ.

  /* ══ INTERVENTION — phễu 5 nấc, tách bạch từ ngày 1 (T7.5, founder D173) ══ */

  iv_du_dieu_kien: { lop: 'intervention', kieu: 'dem', max: 999, theo_doi_tuong: true },
  // vì sao: eligible-mà-không-được-chọn CHÍNH LÀ nhóm so sánh tự nhiên; gộp nó vào
  // "assigned" là tự tay vứt mẫu đối chứng.

  iv_duoc_chon: { lop: 'intervention', kieu: 'dem', max: 999, theo_doi_tuong: true },
  // vì sao: hệ thống CHỌN — ghi RIÊNG kể cả khi policy tất định. Thiếu nấc này thì
  // selection bias đội lốt experimental data ngay trong schema (founder D173).

  iv_phoi_nhiem: { lop: 'intervention', kieu: 'dem', max: 999, theo_doi_tuong: true },
  // vì sao: RENDER THẬT trên màn ≠ được xếp hàng. Không biết user có THẤY không thì
  // mọi con số "lift" chỉ là tương quan.

  iv_tuong_tac: { lop: 'intervention', kieu: 'dem', max: 999, theo_doi_tuong: true },
  // vì sao: chạm/mở/đọc chi tiết — tách "thấy" khỏi "để ý".

  iv_bo_qua: { lop: 'intervention', kieu: 'dem', max: 999, theo_doi_tuong: true },
  // vì sao: DISMISS ≠ không thấy (F9, founder 30/08). Thiếu nó thì lift thổi phồng vì
  // người chủ động từ chối bị đếm chung với người chưa gặp.

  /* ══ OUTCOME — thứ biến dataset từ "mô tả" thành "bằng chứng" ════════════ */

  kq_dat_muc_tieu: {
    lop: 'outcome', kieu: 'nhan', theo_doi_tuong: true,
    mien: ['du', 'gan_du', 'dang_tien', 'xa'],
  },
  // vì sao: bucket kết quả do USER chốt ở quyết toán (C7) — bucket chứ không phải %
  // chính xác, vì % chính xác là suy ra từ số tiền (P2 🔒).

  kq_bo_giua_chung: {
    lop: 'outcome', kieu: 'nhan', theo_doi_tuong: true,
    mien: ['bo', 'con_theo', 'xong'],
  },
  // vì sao: ⭐ BỎ giữa chừng là OUTCOME KHÁC HẲN "đạt 20% rồi hết tháng" (file 07 §2.1
  // xếp abandonment là outcome hạng nhất). Thiếu nó thì goal-completion-rate — số bán
  // được nhất của cohort intelligence — TÍNH SAI THEO HƯỚNG ĐẸP LÊN, vì người bỏ cuộc
  // biến mất khỏi mẫu số. Và đây là loại lỗi KHÔNG SỬA ĐƯỢC SAU.

  kq_con_dung_so: { lop: 'outcome', kieu: 'nhan', mien: ['con', 'thua'] },
  // vì sao: retention ở cấp KỲ — điều kiện của mọi phân tích dọc thời gian.

  kq_giu_luat: { lop: 'outcome', kieu: 'ty_le' },
  // vì sao: tỷ lệ luật nếu-thì giữ được — khoảng cách LỜI HỨA ↔ VIỆC LÀM, nhân chứng
  // mà không nguồn nào khác có.

  kq_rule_hieu_qua: { lop: 'outcome', kieu: 'nhan', mien: ['co', 'khong', 'chua_ro'], theo_doi_tuong: true },
  // vì sao: G8 — luật này có tác dụng không, do user đánh giá sau một kỳ. Đây là
  // intervention lift ở cấp CÁ NHÂN, thứ duy nhất đo được khi n còn nhỏ (P11).
} as const satisfies Record<string, DinhNghiaDacTrung>;

export type MaDacTrung = keyof typeof SO_DANG_KY;

/** Có phải mã hợp lệ không (server dùng trước khi ghi — registry-driven). */
export function laMaHopLe(ma: string): ma is MaDacTrung {
  return Object.prototype.hasOwnProperty.call(SO_DANG_KY, ma);
}

/**
 * Kiểm một giá trị có hợp miền của mã không.
 * Trả `null` nếu hợp lệ, hoặc CHUỖI LÝ DO nếu không — lý do đi thẳng vào câu 400 để
 * người thi công client biết mình sai chỗ nào, không phải đoán.
 */
export function kiemGiaTri(ma: MaDacTrung, gt: unknown): string | null {
  const d = SO_DANG_KY[ma] as DinhNghiaDacTrung;
  switch (d.kieu) {
    case 'nhan':
      if (typeof gt !== 'string') return `${ma}: cần chuỗi nhãn`;
      return d.mien.includes(gt) ? null : `${ma}: nhãn "${gt}" ngoài miền [${d.mien.join('|')}]`;
    case 'ty_le': {
      if (typeof gt !== 'number' || !Number.isFinite(gt)) return `${ma}: cần số hữu hạn`;
      const min = d.am ? -1 : 0;
      return gt >= min && gt <= 1 ? null : `${ma}: tỷ lệ ${gt} ngoài [${min},1]`;
    }
    case 'dem':
      if (!Number.isInteger(gt)) return `${ma}: cần số nguyên`;
      return (gt as number) >= 0 && (gt as number) <= d.max
        ? null : `${ma}: đếm ${gt} ngoài [0,${d.max}]`;
    case 'phan_bo': {
      if (typeof gt !== 'object' || gt === null || Array.isArray(gt)) return `${ma}: cần object phân bố`;
      const o = gt as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        if (!d.mien.includes(k)) return `${ma}: khoá "${k}" ngoài miền [${d.mien.join('|')}]`;
        const v = o[k];
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
          return `${ma}: phần "${k}" phải là tỷ lệ trong [0,1]`;
        }
      }
      return null;
    }
  }
}
