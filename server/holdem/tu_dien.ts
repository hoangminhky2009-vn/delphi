/**
 * TỰ ĐIỂN THẺ — dựng payload giải thích cho nút (!) trên mỗi lá bài.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CHỈ TRẢ SỐ VÀ ID, KHÔNG TRẢ CÂU TIẾNG VIỆT.
 *
 * Câu chữ người chơi đọc được dựng ở client (`web/src`) vì hai lẽ:
 *   1. (lịch sử) lint từ vựng D26 từng phủ `web/src` — đã gỡ 16/08 (D91); lý do
 *      còn lại là câu chữ ở MỘT chỗ để đổi giọng không phải sửa server;
 *   2. đúng cách catalog đang làm sẵn — server phát id + số, client render.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CÓ LỘ THÔNG TIN ẨN KHÔNG? KHÔNG.
 *
 * Đây là LUẬT CHƠI, không phải trạng thái ván. Biết "BTC ăn đòn ở giai đoạn
 * Giảm" là nội dung app muốn DẠY. Thông tin ẩn là thứ khác hẳn: lá kế tiếp là
 * gì, và tin nào là tin bịa — hai thứ đó không có ở đây và không được thêm vào.
 *
 * Trước bản này, ma trận tương tác không có đường nào ra client, nên "chú thích"
 * trên lá bài chỉ là một dòng mô tả chung — người chơi không bao giờ biết được
 * lá mình cầm phản ứng thế nào với cái gì.
 */
import {
  CONG_HUONG, DA_DANG_HOA, DA_DANG_HOA_V52, DAC_QUYEN, GIAM_TRUOT_GIA_BP,
  LAI_VAY_DON_BAY, MT_CHIEN_THUAT_SU_KIEN,
  mtGiaiDoan, mtSuKien, NAV_V10, SU_KIEN, TAI_SAN, type BoMaTran,
  THE_CANH_NHIP, TUONG_QUAN,
  THE_PHONG_THU, XUNG_DOT, betaCua, mucDinhTinh,
  type MucDinhTinh,
} from '../../config/holdem.js';

/**
 * Cặp [id, MỨC] — KHÔNG phải [id, bp].
 *
 * Cắt con số ở đây là cố ý và là điểm chính của bản này: xem docstring
 * `DAI_DINH_TINH` trong config. Trả bp ra client nghĩa là F12 vẫn có bảng tra,
 * tức người chịu khó thì có lợi thế còn người thường thì không — tệ hơn cả việc
 * hiện cho mọi người.
 */
type Cap = [string, MucDinhTinh];

function capSapXep(
  bang: Record<string, number> | undefined,
  thang: 'GIAI_DOAN' | 'SU_KIEN',
): Cap[] {
  if (!bang) return [];
  return Object.entries(bang)
    .filter(([, bp]) => bp !== 0)
    // Sắp theo bp THẬT rồi mới bỏ bp đi: thứ tự vẫn đúng mạnh→yếu mà client
    // không bao giờ thấy con số.
    .sort((a, b) => b[1] - a[1])
    .map(([id, bp]) => [id, mucDinhTinh(bp, thang)] as Cap);
}

export interface TuDienTaiSan {
  /** Mô tả khái quát đặc điểm + tác dụng (từ config, chịu lint D26). */
  mo_ta: string;
  /** Phản ứng theo từng giai đoạn thị trường — MỨC, không phải số. */
  giai_doan: Cap[];
  /** Phản ứng khi tin nổ — MỨC. Chỉ ô khác 0. */
  su_kien: Cap[];
  /**
   * D-28/07 (founder chốt phương án A ở 00b §6.3) — DÒNG CẢNH BÁO ĐUÔI.
   *
   * Tồn tại cho đúng một mâu thuẫn có thật: vài mã có KỲ VỌNG dương trong sự
   * kiện khủng hoảng thanh khoản (tờ này in "tốt") nhưng β D39 dương mạnh — tức
   * ở ĐUÔI xấu chúng sập cùng đám đông. "Tốt" là trung bình, không phải lời hứa
   * trong hoảng loạn (tháng 3/2020: vàng cũng bị bán để gom tiền mặt trả ký
   * quỹ). Founder chọn GIỮ SỐ, THÊM CHỮ — dòng này là phần chữ đó.
   *
   * ⚠ SUY TỪ CONFIG, không chép tay danh sách mã (xem `luuYThanhKhoan`): đổi
   * ma trận hay β là dòng này tự xuất hiện/biến mất theo, không ai phải nhớ.
   */
  luu_y?: string;
  /**
   * v42 (D311) — mã này TRẢ DÒNG TIỀN. Chỉ có mặt khi cờ `couponTpcp` bật, vì tờ (!)
   * của trận cũ không được hứa một khoản mà trận ấy không trả.
   * ⚠ Theo D26 đây là ID, không phải câu chữ: client dịch sang tiếng người. Và theo
   * ruling của founder, tờ (!) hiện MỨC ĐỊNH TÍNH — suất coupon cụ thể KHÔNG gửi.
   */
  dong_tien?: 'coupon';
  /**
   * v42 (D311) — mã này KHÔNG bán khống được (sàn VN không có bán khống cổ phiếu cơ
   * sở). Chỉ có mặt khi cờ `khongTheoMa` bật và mã thật sự bị cấm.
   */
  khong_duoc_khong?: true;
}

export interface TuDienChienThuat {
  /** Cầm cùng lá nào thì bị phạt. */
  xung_dot: string[];
  /** Cầm cùng lá nào thì được thưởng. */
  cong_huong: string[];
  /** Phản ứng với tin tức — MỨC, không phải số (chỉ vài thẻ có). */
  su_kien?: Cap[];
  /**
   * Thẻ canh nhịp. `truot_nang_hon` nói cho người chơi biết HÌNH DẠNG rủi ro
   * (bắt trượt trả giá nặng hơn bắt trúng) mà không phát ra con số — đó là thứ
   * cần biết để quyết, còn con số thì không.
   */
  canh_nhip?: {
    sau_giai_doan: string;
    trung_khi: string[];
    truot_nang_hon: boolean;
  };
  /** Thẻ phòng thủ: ăn ở giai đoạn nào, tốn phí ở giai đoạn nào. */
  phong_thu?: { an_khi: string[]; phi_khi: string[] };
  /** Thưởng theo số mã khác nhau, trừ một phí cố định. */
  da_dang?: true;
  /** Nhân đôi toàn bộ kết quả vòng (Đòn Bẩy). */
  nhan_doi?: true;
  /**
   * D530 — khoá v60 (`loiChiTrongMan`): lá chỉ tác động trong MÀN LÕI. Có cờ này thì tờ KHÔNG mang canh nhịp · nhân đôi · tin · cặp · đặc quyền
   * (engine không chạy chúng nữa) — client vẽ hàng nút của lõi trong màn. Vắng ⇒ tờ cũ.
   */
  trong_man?: true;
  /**
   * D-27/07 — ĐẶC QUYỀN: thứ người chơi NHẬN ĐƯỢC khi chọn lá này.
   *
   * Founder: *"chiến thuật cũng phải có dấu ! ở góc như tài sản để mô tả rõ thứ
   * người chơi sẽ nhận được khi chọn chiến thuật này"*.
   *
   * ⚠ Trước bản này tờ (!) của thẻ chiến thuật CÓ nút và CÓ mở ra, nhưng nội
   * dung chỉ gồm xung đột · cộng hưởng · canh nhịp · phòng thủ — tức toàn thứ
   * PHỤ. Đặc quyền, thứ DUY NHẤT quyết định người ta chọn lá nào (D33 biến thẻ
   * thành đặc quyền chứ không còn là con số), không hề có mặt. Nên đây không
   * phải thêm nút, mà là **tờ giải thích trước đây bỏ sót đúng phần chính**.
   *
   * ⚠ KHÔNG chép tay danh sách — mọi dòng dưới suy từ `DAC_QUYEN` trong config
   * (xem `dacQuyenMoTa`). Chỉnh tham số ở config là tờ này tự đúng theo; đó là
   * cùng kỷ luật mà `DAC_QUYEN_THEO_THE` ở holdem_api.ts đã đặt.
   *
   * ⚠ KHÔNG trái D28. D28 buộc **chú thích trên mặt thẻ** tả đặc điểm THẬT ngoài
   * đời (và `holdem_mota.test.ts` canh điều đó). Tờ (!) là lớp khác — chỗ tả CƠ
   * CHẾ. Tài sản đã chạy đúng mô hình hai lớp này sẵn.
   */
  dac_quyen?: readonly string[];
}

/**
 * HAI NGƯỠNG HIỂN THỊ (quyết định có in một dòng chữ hay không — KHÔNG phải
 * tham số kinh tế, không đụng phép tính nào):
 *
 * · `NGUONG_NOI_TRU_BI_KEO` = 3000: một sự kiện tính là KHỦNG HOẢNG THANH KHOẢN
 *   khi β nhóm PHÒNG THỦ ≥ mức này — nơi trú bị kéo mạnh cùng đám đông, đúng
 *   chữ ký D39 (hack_san 4000 · thien_nga_den 3000 lọt; tang_lai_suat 2500 và
 *   chien_tranh −4000 thì không).
 *
 *   ⚠ Bản đầu chỉ hỏi "β của CHÍNH MÃ có dương mạnh không" — SAI, và test bắt
 *   được ngay: btc × hạ_lãi_suất dính cảnh báo, trong khi β dương trong một sự
 *   kiện TỐT nghĩa là cùng bay LÊN — chẳng có đuôi nào để cảnh báo. Mâu thuẫn
 *   thật chỉ tồn tại khi đuôi xấu của cú sốc chung kéo XUỐNG cả nơi trú.
 *
 * · `NGUONG_BETA_MA` = 2500: mã đó phải thật sự bị kéo đáng kể mới đáng một dòng.
 */
const NGUONG_NOI_TRU_BI_KEO = 3000;
const NGUONG_BETA_MA = 2500;

/**
 * Dòng ⚠ cho mã vừa "tốt trên giấy" vừa "sập cùng đám đông ở đuôi" trong sự
 * kiện khủng hoảng thanh khoản. Suy từ MT_TAI_SAN_SU_KIEN × TUONG_QUAN — hai
 * nguồn thật engine đang chạy — nên không bao giờ lệch với gameplay.
 *
 * `bo` optional, truyền từ `dungTuDien` — một cửa `mtSuKien`, xem config.
 */
function luuYThanhKhoan(maTaiSan: string, bo: BoMaTran = 'v40'): string | null {
  const ts = TAI_SAN.find((t) => t.id === maTaiSan);
  if (!ts) return null;
  const keo = SU_KIEN.filter((sk) => {
    const laKhungHoangThanhKhoan =
      (TUONG_QUAN.BETA_SU_KIEN[sk.id]?.phong_thu ?? 0) >= NGUONG_NOI_TRU_BI_KEO;
    const kyVong = mtSuKien(bo)[maTaiSan]?.[sk.id as never] ?? 0;
    return laKhungHoangThanhKhoan && kyVong > 0
      && betaCua(maTaiSan, ts.nhom, sk.id) >= NGUONG_BETA_MA;
  });
  if (keo.length === 0) return null;
  return `Khủng hoảng thanh khoản (${keo.map((x) => x.label).join(' · ')}): `
    + 'đám đông bán cả nơi trú để gom tiền mặt — mức "tốt" ở đây là trung bình '
    + 'nhiều trận, không phải lời hứa trong cơn hoảng loạn.';
}

export interface TuDien {
  tai_san: Record<string, TuDienTaiSan>;
  chien_thuat: Record<string, TuDienChienThuat>;
}

/** bp → chuỗi phần trăm kiểu Việt ("5000" → "50", "120" → "1,2"). */
function pc(bp: number): string {
  const v = bp / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
}

/**
 * Đặc quyền của từng lá, DỰNG TỪ CONFIG chứ không chép tay.
 *
 * ⚠ CHỈ liệt kê những lá ĐÃ XÂY đặc quyền — nay 8 lá (Đi Ngược + Chia Lệnh thêm
 * 28/07; Đòn Bẩy thêm 24/08), khớp `DAC_QUYEN_THEO_THE` ở holdem_api.ts. BA lá
 * còn lại (Bắt Đáy · Bán Khống · Mua Đuổi) KHÔNG có dòng nào ở đây, và đó là CÓ
 * CHỦ Ý: viết mô tả cho một đặc quyền chưa tồn tại là nói dối ngay trên tờ.
 * Nợ này ghi ở `docs/thiet-ke-da-chot/00-ra-co-che-27-07.md` §5.
 *
 * ⚠ Riêng Đòn Bẩy: founder chốt 27/07 rằng gắn thẻ vào mã sẽ thành đòn bẩy CỦA
 * MÃ ĐÓ (spec 01 §4.2). Điều kiện "thêm dòng khi engine đổi thật" ĐÃ TỚI 24/08:
 * D109 cho cấp 2 nhắm mã thứ hai, nên lá này nay CÓ mục ở dưới — nhưng chỉ nói
 * đúng phần đang chạy (nhân toàn vòng + đích phụ), KHÔNG hứa phần §4.2 chưa có.
 * Ba lá còn trống: Bắt Đáy · Bán Khống · Mua Đuổi.
 */
function dacQuyenMoTa(
  coDonBayTheoMa = false, coLaiVay = false, coPhiLenhNhe = false,
  coDaDangV52 = false,
): Record<string, readonly string[]> {
  const { KHOP_NHANH: kn, DA_DANG_HOA: dd, PHONG_HO: ph,
    LUOT_SONG: ls, CHAN_LO: cl, DI_NGUOC: dn } = DAC_QUYEN;
  /*
   * D371 — BỘ SỐ MỖI VÒNG của lá này. Cùng cặp hằng số mà `daDangCua()` bên
   * engine chọn, đọc qua đúng một cờ — tờ (!) và engine lệch nhau là "màn báo
   * một đằng, trừ một nẻo" (D67).
   */
  const ddBo = coDaDangV52 ? DA_DANG_HOA_V52 : DA_DANG_HOA;
  /** Số mã tối thiểu để mắt xích mỗi vòng hết âm (làm tròn LÊN — 2,69 ⇒ 3). */
  const ddHoaVon = Math.ceil(-ddBo.PHI_BP / ddBo.MOI_MA_BP);
  return {
    /*
     * ⚠ 24/08 — ĐÒN BẨY NAY CÓ MỘT DÒNG, và điều kiện mà chú thích đầu hàm đặt
     * ra đã thành hiện thực: D109 (22/08) cho CẤP 2 nhắm mã THỨ HAI
     * (`engine.ts:2269` đọc `danh_muc.gan_phu.don_bay`, cổng ở `holdem_api`).
     * Đây là "thêm dòng khi engine đổi thật" chứ không phải thêm trước.
     * ⚠ Chỉ nói ĐÚNG cái đang chạy: nhân toàn vòng ở cấp 1, thêm đích phụ ở cấp
     * 2. KHÔNG hứa "đòn bẩy của riêng mã đó" (spec 01 §4.2) — phần ấy vẫn chưa
     * có, và viết ra là nói dối ngay trên tờ.
     */
    /*
     * v46 (D338) — founder: *"nhớ ghi rõ trong phần mô tả lõi"*. Luật mới nói ĐÚNG đơn vị (nhân
     * phần giá của TỪNG mã, không nhân cả ví) + lãi vay neo lãi suất nền (founder: *"như ngoài đời
     * thôi · theo trạng thái nền kinh tế"*). Số đọc từ `LAI_VAY_DON_BAY`, không gõ tay (D61).
     * Bộ luật cũ (cờ tắt) giữ đúng ba dòng trước v46 — tờ phục vụ trận đang chơi.
     */
    don_bay: coDonBayTheoMa ? [
      'Nhân ĐÔI phần giá của TỪNG mã đang cầm — cả chiều lãi lẫn chiều lỗ.',
      'Chưa nhắm ⇒ nhân mọi mã đang cầm. Chạm lá rồi chạm một mã ⇒ chỉ nhân mã đó (đổi được mỗi vòng).',
      ...(coLaiVay ? [
        `Mỗi ô trả LÃI VAY trên phần tiền đang được nhân đôi: lãi suất nền quy ra ô + ${pc(LAI_VAY_DON_BAY.PHAN_BU_BP)}%. Tiền rẻ thì vay rẻ; kỳ họp tăng lãi thì vay đắt lên.`,
      ] : []),
      'CẤP 2 → nhắm được mã THỨ HAI: chạm lá rồi chạm thêm một mã khác.',
    ] : [
      'Nhân ĐÔI lãi/lỗ của vòng — cả hai chiều, không có mặt tốt riêng.',
      'Chạm lá rồi chạm một mã trên bàn để nhắm; chưa nhắm thì nhân cả danh mục.',
      'CẤP 2 → nhắm được mã THỨ HAI: chạm lá rồi chạm thêm một mã khác.',
    ],
    /*
     * 28/07 — founder: "đặc quyền của đi ngược số đông sẽ cho mình biết bên kia
     * cầm gì". Chỉ có nghĩa từ v10 (danh mục đối thủ ẩn); ba mức là TỶ LỆ bàn
     * theo yêu cầu cân-theo-lobby của D40, suy từ config.
     */
    /*
     * 28/07 — founder: "Chỉ chiến thuật chia lệnh mới cho phép đi vốn cụ thể
     * (các mốc 5-10-15...100)". Lá này nay có HAI đặc quyền, cả hai đúng bản
     * chất "chẻ nhỏ lệnh": mốc mịn + giảm trượt giá của chính mình (D33).
     */
    chia_lenh: [
      `Đi vốn theo mốc MỊN bước ${pc(NAV_V10.BUOC_MOC_BP)}% — không lá chỉ có bước ${pc(NAV_V10.BUOC_MOC_THO_BP)}%.`,
      `Trượt giá lệnh của CHÍNH MÌNH: còn ${pc(GIAM_TRUOT_GIA_BP.chia_lenh)}%.`,
    ],
    di_nguoc: [
      `Nhìn xuyên màn che: thấy ĐỐI THỦ ĐANG CẦM MÃ GÌ — ${pc(dn.TY_LE_THAY_BP[0]!)}% số đối thủ.`,
      `Cấp 2 → ${pc(dn.TY_LE_THAY_BP[1]!)}% · cấp 3 → ${pc(dn.TY_LE_THAY_BP[2]!)}% bàn. Cân theo cỡ bàn, không theo số tuyệt đối.`,
      'Thấy họ cầm GÌ, không thấy cầm BAO NHIÊU.',
    ],
    khop_nhanh: [
      // v50 (D345) — khoản phí lớn nhất của trận NAV, chỉ hứa khi bộ luật đang phục vụ bật.
      ...(coPhiLenhNhe ? [`Phí mua bán (trượt giá) của lệnh: còn ${pc(kn.LENH_CON_BP)}%.`] : []),
      `Hàng chờ khớp lệnh của mã vừa vào: còn ${pc(kn.XEP_HANG_CON_BP)}%.`,
      `Phí Đảo danh mục: còn ${pc(kn.DAO_PHI_CON_BP)}%.`,
      `Phí rút khẩn khi Cắt lỗ: còn ${pc(kn.RUT_KHAN_CON_BP)}%.`,
    ],
    /*
     * ⚠⚠ D371 — TỜ NÀY TỪNG CHỈ LIỆT KÊ HAI ĐIỀU LỢI, trong khi mắt xích
     * `da_dang` vẫn chạy MỖI VÒNG và rơi vào tầng DANH MỤC, tức nhân thẳng vào
     * MỌI vị thế đang cầm. Với bộ số cũ (−700 + 260/mã) người cầm 2 mã mất
     * 1,8% toàn bộ vị thế mỗi vòng — và không có một chữ nào trên tờ nói điều
     * đó. Lá `chan_lo` ngay dưới khai đúng kiểu này từ đầu ("phí bảo hiểm…
     * MỖI vòng, kể cả vòng không chạm sàn"); lá này thiếu đúng một dòng.
     * Founder báo 21/09: *"mỗi round trừ tiền trong khi t đã giữ vị thế rồi"*.
     */
    da_dang_hoa: [
      `Lấy ${dd.TAI_SAN_MOI_VONG} tài sản mỗi vòng thay vì 1.`,
      `Trần số mã giữ đồng thời: +${dd.TRAN_TAI_SAN_THEM}.`,
      // Bộ số 0/0 ⇒ lá thuần đặc quyền, không có vế mỗi-vòng để khai.
      ...(ddBo.PHI_BP !== 0 || ddBo.MOI_MA_BP !== 0 ? [
        `MỖI vòng, tính trên TOÀN BỘ vị thế: ${pc(ddBo.PHI_BP)}% cố định`
        + ` + ${pc(ddBo.MOI_MA_BP)}% cho mỗi mã KHÁC NHAU đang nắm.`,
        `⇒ từ ${ddHoaVon} mã trở lên mới có lãi; ít hơn là lỗ mỗi vòng.`,
      ] : []),
    ],
    phong_ho: [
      'Mở được lệnh phòng hộ: đặt ở vòng này, KHỚP ở vòng sau.',
      `Ăn ${pc(ph.HE_SO_BP)}% cú nghịch đảo, trần ${pc(ph.TRAN_BP)}% một lệnh.`,
      `Phí mở vị thế ${pc(ph.PHI_BP)}%, trừ ở vòng khớp.`,
    ],
    luot_song: [
      'Bảng điện tử SẠCH: hết trễ 1 vòng, hết sương mù.',
      `Mở thêm hạng dự báo: ${ls.SO_TEN} tên sự kiện khả năng cao ở vòng sau.`,
      `⚠ Trong ${ls.SO_TEN} tên đó LUÔN có ${ls.SO_TEN_SAI} tên sai.`,
      /*
       * ⚠ 24/08 — DÒNG NÀY THIẾU TỪ D107 (22/08). Cấp 2 mở XÁC THỰC TIN và cơ
       * chế chạy thật (`bang_dien_tu.ts:307` đặt cờ `cap2`, dòng 660 gọi
       * `dungXacThuc`) — nhưng tờ (!) không có một chữ nào về nó, tức người chơi
       * lấy lá thứ hai mà không đọc được ở đâu rằng mình vừa mua cái gì.
       * Đây là câu chữ suy từ cơ chế đã có, không phải tham số kinh tế.
       */
      'CẤP 2 → XÁC THỰC TIN: biết khả năng ô đang lật là tin BỊA, và tin bịa ở ô trước lộ sớm một vòng.',
    ],
    chan_lo: [
      `Sàn chống lỗ: phần lõi không sụt quá ${pc(cl.SAN_BP)}% một vòng.`,
      `Phí bảo hiểm ${pc(cl.PHI_MOI_VONG_BP)}% MỖI vòng, kể cả vòng không chạm sàn.`,
    ],
  };
}

/**
 * Dựng tự điển từ config. Thuần, tất định, không I/O — gọi mỗi request cũng
 * không sao, nhưng catalog cache 1 giờ ở client nên thực tế gọi rất thưa.
 */
export function dungTuDien(
  // v42 (D311) — thêm hai trường; `?` để mọi fixture test cũ khỏi phải sửa.
  taiSan: readonly {
    id: string; mo_ta: string; dong_tien?: 'coupon' | 'khong'; khong_duoc?: boolean;
  }[],
  chienThuatIds: readonly string[],
  /**
   * v19 — bảng xung đột theo LUẬT HIỆN HÀNH: tờ (!) phục vụ trận đang chơi,
   * kể cặp đã gỡ là doạ người chơi về một hình phạt không tồn tại (founder
   * 02/08: "trong chú thích… hiện cảnh báo khắc chế dù không còn liên quan").
   * Mặc định bảng cũ để test đơn vị cũ giữ nghĩa; catalog truyền bảng thật.
   */
  bangXungDot: readonly (readonly [string, string])[] = XUNG_DOT,
  /** v20 — cùng lý do với `bangXungDot`, cho chiều CỘNG HƯỞNG. */
  bangCongHuong: readonly (readonly [string, string])[] = CONG_HUONG,
  /**
   * v41 (D307) — LỚP VN: catalog không có `st` (không gắn một trận cụ thể) nên
   * nơi gọi phải truyền cờ của bộ luật đang phục vụ — xem `mtGiaiDoan` trong
   * config. Vắng ⇒ bảng toàn cầu cũ.
   */
  bo: BoMaTran = 'v40',
  /**
   * v42 (D311) — hai cờ của cổng `balance-v42-taisan`. Tách khỏi `bo` vì chúng là
   * CƠ CHẾ, không phải bảng số: một trận có thể đọc bảng V42 mà chưa bật coupon chỉ
   * khi ai đó dựng khoá luật sai — và bài `tai_san_v42.test.ts` §V canh đúng chuyện đó.
   */
  coCoupon = false,
  coKhongTheoMa = false,
  /** v46 (D338) — hai cờ Đòn Bẩy của bộ luật đang phục vụ; vắng ⇒ mô tả trước v46. */
  coDonBayTheoMa = false,
  coLaiVay = false,
  /**
   * v49 (D342) — lá Bán Khống THUẦN QUYỀN: engine gỡ hàng T1 của lá, nên tờ (!) cũng thôi hứa
   * "ăn tin Sập sàn +15%…". Vắng ⇒ tờ cũ (fixture test cũ giữ nghĩa).
   */
  coBanKhongThuanQuyen = false,
  /** v50 (D345) — tờ Khớp Nhanh hứa giảm phí lệnh chỉ khi bộ luật bật `phiLenhNhe`. */
  coPhiLenhNhe = false,
  /** v52 (D371) — tờ Đa Dạng Hoá khai bộ số MỖI VÒNG của bộ luật đang phục vụ. */
  coDaDangV52 = false,
  /** D530 — v60 `loiChiTrongMan`: mọi lá chiến thuật chỉ còn `trong_man` (tờ không hứa thứ engine đã thôi chạy). */
  coLoiChiTrongMan = false,
): TuDien {
  const tai_san: Record<string, TuDienTaiSan> = {};
  for (const t of taiSan) {
    tai_san[t.id] = {
      mo_ta: t.mo_ta,
      giai_doan: capSapXep(mtGiaiDoan(bo)[t.id], 'GIAI_DOAN'),
      su_kien: capSapXep(mtSuKien(bo)[t.id], 'SU_KIEN'),
      ...(() => {
        const luuY = luuYThanhKhoan(t.id, bo);
        return luuY ? { luu_y: luuY } : {};
      })(),
      // v42 (D311) — SUY TỪ CONFIG, không chép tay danh sách mã (cùng nếp `luu_y`).
      ...(coCoupon && t.dong_tien === 'coupon' ? { dong_tien: 'coupon' as const } : {}),
      ...(coKhongTheoMa && !t.khong_duoc ? { khong_duoc_khong: true as const } : {}),
    };
  }

  const DQ = dacQuyenMoTa(coDonBayTheoMa, coLaiVay, coPhiLenhNhe, coDaDangV52);
  const chien_thuat: Record<string, TuDienChienThuat> = {};
  for (const id of chienThuatIds) {
    if (coLoiChiTrongMan) { chien_thuat[id] = { xung_dot: [], cong_huong: [], trong_man: true }; continue; }   // D530
    const ct: TuDienChienThuat = {
      xung_dot: bangXungDot.filter((c) => c.includes(id as never))
        .map((c) => (c[0] === id ? c[1] : c[0])),
      cong_huong: bangCongHuong.filter((c) => c.includes(id as never))
        .map((c) => (c[0] === id ? c[1] : c[0])),
    };

    const sk = coBanKhongThuanQuyen && id === 'ban_khong' ? [] : capSapXep(
      MT_CHIEN_THUAT_SU_KIEN[id as never] as Record<string, number>, 'SU_KIEN',
    );
    if (sk.length > 0) ct.su_kien = sk;

    const cn = THE_CANH_NHIP[id as 'bat_day' | 'mua_duoi'];
    if (cn) {
      ct.canh_nhip = {
        sau_giai_doan: cn.sau_giai_doan,
        trung_khi: [...cn.trung_khi],
        // So SÁNH ở server, phát ra kết luận chứ không phát hai con số.
        truot_nang_hon: Math.abs(cn.truot_bp) > Math.abs(cn.trung_bp),
      };
    }

    const pt = THE_PHONG_THU[id as 'chan_lo' | 'phong_ho'];
    if (pt) {
      ct.phong_thu = { an_khi: [...pt.an_khi], phi_khi: [...pt.phi_khi] };
    }

    if (id === 'da_dang_hoa') ct.da_dang = true;
    if (id === 'don_bay') ct.nhan_doi = true;

    const dq = DQ[id];
    if (dq) ct.dac_quyen = dq;

    chien_thuat[id] = ct;
  }

  return { tai_san, chien_thuat };
}
