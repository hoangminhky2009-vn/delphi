/**
 * PFM — LỘ TRÌNH: ba chặng ghép từ hồ sơ phỏng vấn. Theo DEMO ĐÃ CHỐT
 * (A11.25/D277): `#man-lt` của `docs/ui-ux/demo/pfm-lo-trinh.html`.
 *
 * ⚠⚠ "SINH" Ở ĐÂY = CHỌN VÀ XẾP KHỐI TĨNH, KHÔNG PHẢI VIẾT RA CHỮ MỚI.
 * Nguyên văn demo: *"Đó là ranh duy nhất giữ được cả hai: lộ trình thật sự cá
 * nhân hoá, mà vẫn duyệt được từng dòng."* Mọi khối dưới đây có `ma`, chữ cố
 * định, quét test được. Không một câu nào sinh tự do.
 *
 * ⚠ A10 🔒 — app ghép HÌNH, người chơi điền SỐ. Không khối nào chứa một con số
 * tiền, và `mức` của hũ luôn là "do bạn đặt". App đề xuất số tiền là lúc nó thôi
 * mô tả và bắt đầu kê đơn.
 *
 * ⚠ A8.2 — HAI CON SỐ CỔNG (12 ngày ghi · 20 khoản có nhãn) chép NGUYÊN từ demo
 * và **là PLAYTEST-TUNE**, không phải tham số tôi đặt. Demo tự ghi: *"Con số cụ
 * thể là ⏳ PLAYTEST-TUNE — tôi không tự đặt tham số, đây chỉ là chỗ giữ để soi
 * hình."* Đo rồi mới chốt.
 */
import {
  ROUTE_TAI_CHINH_CAM_KET, ROUTE_TAI_CHINH_GUONG, ROUTE_TAI_CHINH_HU,
  ROUTE_TAI_CHINH_PHONG_VAN,
} from '@/lib/vocab';
import { soCauPhongVan } from './ho_so.js';
import type { HoSo, MaKhung } from './ho_so.js';
import type { TrangThaiTaiChinh } from './trang_thai.js';
import type { Khoan } from './so.js';

/* ══ KHỐI TĨNH ════════════════════════════════════════════════════════════ */

/** Hũ gợi theo câu 4 (`muc_tieu`) — khoá là NHÃN người đọc, đúng như hồ sơ lưu. */
export const HU_THEO_MUC_TIEU: Record<string, { ma: string; ten: string; vi: string }> = {
  'quỹ dự phòng': { ma: 'DP', ten: 'Hũ dự phòng', vi: 'thường dùng cho khoản bất ngờ — hỏng xe, khám bệnh' },
  'thiết bị học': { ma: 'MÁY', ten: 'Hũ thiết bị học', vi: 'thường dùng khi món cần mua có giá cố định và không gấp' },
  'chuyến đi': { ma: 'ĐI', ten: 'Hũ chuyến đi', vi: 'thường dùng khi có một ngày đích rõ ràng' },
  'món muốn mua': { ma: 'MUA', ten: 'Hũ món muốn mua', vi: 'thường dùng để tách khoản muốn khỏi khoản cần' },
  'trả nợ': { ma: 'NỢ', ten: 'Hũ trả nợ', vi: 'thường dùng khi có kỳ trả cố định hằng tháng' },
};

/** Một dòng cho mỗi khung — khoá là MÃ trong `HoSo.khung` (`ctx_khung`). */
export const KHUNG_GOI: Record<string, { ten: string; vi: string }> = {
  hu: { ten: 'hũ', vi: 'chia tiền theo TÚI, mỗi túi một việc' },
  '50_30_20': { ten: '50/30/20', vi: 'chia theo TỈ LỆ: cần / muốn / để dành' },
  kakeibo: { ten: 'kakeibo', vi: 'mỗi tuần tự hỏi bốn câu, ghi tay, không tính toán nhiều' },
  tu_do: { ten: 'bạn chọn sau', vi: 'chưa chọn — lộ trình để trống chỗ này cho bạn chọn sau' },
};

/** ⏳ PLAYTEST-TUNE — xem khối ⚠ A8.2 ở đầu tệp. */
export const CONG = { NGAY_GHI: 12, KHOAN_CO_NHAN: 20 } as const;

export interface KhoiChang {
  ma: string;
  ten: string;
  phu: string;
  /** Vì sao khối này ở đây — nền học thuật hoặc chính câu người chơi đã trả lời. */
  vi: string;
  nut: readonly string[];
  /**
   * Nhãn câu 4 sinh ra khối này — CHỈ khối hũ mới có. Nút `BỎ` cần biết nó đang
   * bỏ cái gì, và khoá ấy phải là thứ hồ sơ hiểu được (`HoSo.loTrinhBo`), không
   * phải chỉ số mảng: chỉ số đổi mỗi lần người chơi sửa câu 4.
   */
  nhan?: string;
  /**
   * D325 — khung mà nút `THỬ KHUNG NÀY` sẽ ghi vào hồ sơ. CHỈ khối câu hỏi khung mới có;
   * nút đọc nó thay vì tự suy lại từ nhịp tiền vào (một nguồn — khối đã quyết hỏi khung nào).
   */
  khung?: MaKhung;
}

/**
 * D325 — KHOÁ BỎ của khối TRẠNG THÁI, cùng danh sách `HoSo.loTrinhBo` với nhãn câu 4.
 * ⚠ Tiền tố `#` là thứ giữ hai loại khoá không va nhau: chip câu 4 là chữ thường, không bao
 * giờ mở đầu bằng `#`. Và cùng đường về: trả lời lại câu 4 ⇒ danh sách bị dọn sạch.
 */
export const KHOA_BO_TRANG_THAI = {
  DP_THIEU: '#DP_THIEU', DON_HAN: '#DON_HAN', GOI_Y_KHUNG: '#GOI_Y_KHUNG',
} as const;

/* ══ ĐÍCH CỦA TỪNG NÚT (D308) ═════════════════════════════════════════════ */

/**
 * ⚠⚠ NÚT KHÔNG CÓ ĐÍCH LÀ MỘT LỜI HỨA SUÔNG. Bản D306 vẽ đủ bảy nút mà chỉ
 * `ĐẶT CAM KẾT` đi được — bấm sáu nút kia thì **không có gì xảy ra**, đúng họ
 * lỗi "ngõ cụt" 07/09 mà 1.530 bài xanh không bài nào bắt (A11.21).
 *
 * ⚠ MỌI ĐÍCH ĐỀU LÀ MÀN ĐÃ CÓ, cố ý. Hũ có mức tiền thì đi màn HŨ — nơi ranh
 * A10 ("app không tự điền mức") đã được cài sẵn; dựng một ô nhập mức ngay trên
 * lộ trình là vừa chép lại màn HŨ (A11.5) vừa mở lại đúng chỗ A10 dễ vỡ nhất.
 *
 * ⚠ `lo_trinh.test.ts` §nút canh: MỌI nhãn nút của MỌI khối phải có mặt ở bảng
 * này. Thêm một nút vào khối mà quên đích ⇒ bài đỏ, không phải im lặng.
 */
export type DichNut =
  | { kieu: 'di'; den: string }
  | { kieu: 'lam'; ma: 'bo_khoi' | 'cai_dat' | 'thu_khung' };

export const DICH_NUT: Record<string, DichNut> = {
  // Ba nút của khối hũ + nút khi câu 4 trống: tất cả về màn HŨ.
  'ĐỔI MẪU': { kieu: 'di', den: ROUTE_TAI_CHINH_HU },
  'ĐẶT MỨC': { kieu: 'di', den: ROUTE_TAI_CHINH_HU },
  'CHỌN MẪU': { kieu: 'di', den: ROUTE_TAI_CHINH_HU },
  BỎ: { kieu: 'lam', ma: 'bo_khoi' },
  // Công tắc `nhacTat` sống ở board ⚙ (khối ⑥ `CaiDatPfm`) — mở đúng nó.
  'TẮT NHẮC': { kieu: 'lam', ma: 'cai_dat' },
  'XEM THỬ': { kieu: 'di', den: ROUTE_TAI_CHINH_GUONG },
  // Khung là CÂU 5 của phỏng vấn; đổi khung = trả lời lại câu ấy, không phải
  // một màn chọn khung thứ hai.
  'ĐỔI KHUNG': { kieu: 'di', den: ROUTE_TAI_CHINH_PHONG_VAN },
  'ĐẶT CAM KẾT': { kieu: 'di', den: ROUTE_TAI_CHINH_CAM_KET },
  /*
   * ⚠ RÀO: nửa "hỏi lại tôi trước khoản > X" CHÍNH LÀ luật `khoan_vuot_muc` đã
   * có, nên nút này mở màn CAM KẾT với điều kiện ấy chọn sẵn. Nửa còn lại của
   * khối ("ẩn mục nhạy cảm") **chưa tồn tại trong app** — đã ghi vào D308 §Còn
   * nợ và vào tờ câu hỏi cho founder; đừng đọc nút này là "rào đã xong".
   */
  XEM: { kieu: 'di', den: `${ROUTE_TAI_CHINH_CAM_KET}?dk=khoan_vuot_muc` },
  // D325 — khối TRẠNG THÁI đọc từ sổ.
  'XEM HŨ': { kieu: 'di', den: ROUTE_TAI_CHINH_HU },
  // Câu hỏi khung: đồng ý thì ghi ĐÚNG `hoSo.khung`, không gì khác; ĐỂ SAU dùng chung cơ chế BỎ.
  'THỬ KHUNG NÀY': { kieu: 'lam', ma: 'thu_khung' },
  'ĐỂ SAU': { kieu: 'lam', ma: 'bo_khoi' },
};

export interface CongChang {
  nhan: string;
  co: number;
  can: number;
  vi: string;
}

export interface Chang {
  so: string;
  ten: string;
  /** `null` ở chặng 1 — nó luôn mở. */
  cong: CongChang | null;
  mo: boolean;
  khoi: readonly KhoiChang[];
}

/* ══ ĐẾM THẬT, KHÔNG ĐẾM NGÀY ═════════════════════════════════════════════ */

/**
 * ⚠ CỔNG ĐẾM **VIỆC ĐÃ LÀM**, KHÔNG ĐẾM NGÀY (demo: *"Nhập một tháng cũ trong
 * một tối là mở ngay tối đó"*). Đó không phải chi tiết kỹ thuật mà là một phát
 * biểu về công bằng: người ghi bù cả tháng trong một buổi đã làm đúng việc mà
 * chặng sau cần, nên chặng sau phải mở.
 */
export function demNgayGhi(so: readonly Khoan[]): number {
  // ⚠ D420 — khoản phân bổ (chuyển vào hũ ở màn HŨ, kể cả quy tắc tự chia) không phải một ngày GHI SỔ.
  return new Set(so.filter((k) => k.phanBo === undefined).map((k) => k.ngay)).size;
}

/**
 * Khoản ĐÃ PHÂN LOẠI — có nhãn (luồng ghi trước D410) HOẶC đã vào một hũ (phân bổ tối, D410).
 * ⚠⚠ D410 bỏ câu hỏi nhãn lúc ghi ⇒ đếm riêng nhãn thì cổng chặng 3 KẸT VĨNH VIỄN với mọi người ghi sau 26/09 (không
 *   ai còn gắn nhãn được), im lặng. Việc "phân loại" giờ làm ở khay phân bổ, nên cổng đếm cả hai đường.
 */
export function demKhoanCoNhan(so: readonly Khoan[]): number {
  // ⚠ D420 — khoản do QUY TẮC tự chia không phải việc người dùng làm (P5: tiến độ không mua được bằng số dòng).
  return so.filter((k) => (k.nhan !== null && k.nhan !== undefined)
    || (k.huId !== null && k.huId !== undefined && k.phanBo !== 'tu_dong')).length;
}

/* ══ GHÉP LỘ TRÌNH ════════════════════════════════════════════════════════ */

/**
 * D325 — KHỐI ĐỌC TỪ SỔ, đứng ĐẦU chặng 1. Ba khối, mỗi khối một điều kiện đếm được:
 *   · `DP_THIEU` — không hũ dự phòng nào đang mở, và câu 4 cũng không chọn nó (chọn rồi thì
 *     khối DP của câu 4 đã đứng đó; bỏ rồi thì người dùng đã nói không — nhắc lại là giục).
 *   · `DON_HAN` — từ HAI hũ đang mở cùng hạn ngắn trở lên. Con số là dữ liệu, không phải phán.
 *   · `GOI_Y_KHUNG` — chưa chọn khung VÀ câu 2 nói được nhịp tiền vào ⇒ MỘT câu hỏi có nút đồng
 *     ý. Nhịp `chua_ro` ⇒ không hỏi gì: hỏi thử một khung khi không biết hoàn cảnh là đoán.
 * ⚠ A10 🔒 — `vi` của cả ba là câu TẢ nguồn gốc khối (đọc từ đâu), không một chữ "nên".
 * ⚠ Cả ba đều BỎ được: lộ trình "sửa được hết" — khối nào không bỏ được là một lời nhắc cưỡng.
 */
function khoiTrangThai(hoSo: HoSo, tt: TrangThaiTaiChinh): KhoiChang[] {
  const k: KhoiChang[] = [];
  const bo = new Set(hoSo.loTrinhBo ?? []);
  const dp = HU_THEO_MUC_TIEU['quỹ dự phòng']!;
  if (!tt.co_hu_du_phong && !(hoSo.mucTieu ?? []).includes('quỹ dự phòng')
    && !bo.has(KHOA_BO_TRANG_THAI.DP_THIEU)) {
    k.push({
      ma: dp.ma,
      ten: dp.ten,
      phu: `${dp.vi} · mức: do bạn đặt`,
      vi: 'sổ của bạn đang không có hũ dự phòng nào mở — khối này đọc từ sổ, không từ câu trả lời',
      nut: ['CHỌN MẪU', 'BỎ'],
      nhan: KHOA_BO_TRANG_THAI.DP_THIEU,
    });
  }
  if (tt.hu_han_ngan >= 2 && !bo.has(KHOA_BO_TRANG_THAI.DON_HAN)) {
    k.push({
      ma: 'HẠN',
      ten: 'Nhiều hũ cùng hạn ngắn',
      phu: 'các hũ hạn dưới 3 tháng cùng chờ tiền trong một quãng ngắn',
      vi: `${tt.hu_han_ngan} hũ đang mở cùng hạn dưới 3 tháng — đọc từ sổ của bạn`,
      nut: ['XEM HŨ', 'BỎ'],
      nhan: KHOA_BO_TRANG_THAI.DON_HAN,
    });
  }
  const chuaChonKhung = hoSo.khung === undefined || hoSo.khung === 'tu_do';
  if (chuaChonKhung && tt.nhip_thu !== 'chua_ro' && !bo.has(KHOA_BO_TRANG_THAI.GOI_Y_KHUNG)) {
    const thatThuong = tt.nhip_thu === 'that_thuong';
    k.push({
      ma: 'HỎI',
      ten: thatThuong ? 'Thử khung hũ?' : 'Thử khung 50/30/20?',
      phu: thatThuong
        ? 'khung hũ chia tiền theo TÚI, mỗi túi một việc — không dựa vào một khoản vào cố định'
        : 'khung 50/30/20 chia theo TỈ LỆ của khoản vào — dễ áp khi khoản vào đều mỗi tháng',
      vi: `bạn trả lời tiền vào “${hoSo.deu ?? ''}” ở câu 2 và chưa chọn khung ở câu 5 — `
        + 'đây là một câu hỏi: không bấm gì thì không có gì đổi',
      nut: ['THỬ KHUNG NÀY', 'ĐỂ SAU'],
      nhan: KHOA_BO_TRANG_THAI.GOI_Y_KHUNG,
      khung: thatThuong ? 'hu' : '50_30_20',
    });
  }
  return k;
}

function khoiChang1(hoSo: HoSo, tt: TrangThaiTaiChinh | null): KhoiChang[] {
  const k: KhoiChang[] = tt === null ? [] : khoiTrangThai(hoSo, tt);
  const bo = new Set(hoSo.loTrinhBo ?? []);
  const mt = hoSo.mucTieu ?? [];
  // Khối đã bấm BỎ thì biến mất khỏi lộ trình, nhưng câu 4 KHÔNG bị sửa — xem
  // `HoSo.loTrinhBo`. Trả lời lại câu 4 là đường mang chúng trở lại.
  const con = mt.filter((m) => !bo.has(m));
  // ⚠ Nhánh "chưa có hũ nào" dưới đây hỏi `con.length` — khoá BỎ `#…` của khối trạng thái
  // không nằm trong `mt`, nên không bao giờ lọt vào `con`.
  if (con.length) {
    for (const m of con) {
      const hu = HU_THEO_MUC_TIEU[m];
      if (!hu) continue;
      k.push({
        ma: hu.ma,
        ten: hu.ten,
        phu: `${hu.vi} · mức: do bạn đặt`,
        vi: `bạn chọn “${m}” ở câu 4`,
        nut: ['ĐỔI MẪU', 'ĐẶT MỨC', 'BỎ'],
        nhan: m,
      });
    }
  } else {
    /*
     * ⚠ HAI ĐƯỜNG VÀO CÙNG MỘT Ô TRỐNG, và câu `vi` phải nói đúng đường nào:
     * chưa trả lời câu 4, hay đã trả lời rồi tự bỏ hết. Nói "câu 4 đang để
     * trống" với người vừa bỏ tay ba khối là app kể sai chuyện của chính họ.
     */
    const daBoHet = mt.length > 0;
    k.push({
      ma: '?',
      ten: 'Chưa có hũ nào',
      phu: daBoHet
        ? 'bạn đã bỏ hết khối hũ — trả lời lại câu 4 thì chúng quay lại'
        : 'trả lời câu 4 thì lộ trình gắn hũ vào đây',
      vi: daBoHet ? 'bạn đã bỏ mọi khối hũ của chặng này' : 'câu 4 đang để trống',
      nut: ['CHỌN MẪU'],
    });
  }
  k.push({
    ma: 'GHI',
    ten: 'Ghi hằng ngày · 2 chạm',
    phu: 'chuỗi có bảo hiểm: lỡ 1 ngày/tuần không gãy',
    vi: 'thói quen cần ~66 ngày để tự động hoá, và lỡ một ngày KHÔNG phá đường cong đó '
      + '(Lally 2010) — nên chuỗi ở đây không phải để phạt bạn',
    nut: ['TẮT NHẮC'],
  });
  return k;
}

function khoiChang2(hoSo: HoSo): KhoiChang[] {
  const kh = hoSo.khung ? KHUNG_GOI[hoSo.khung] : undefined;
  return [
    {
      ma: '5',
      ten: 'Năm chỉ số của bạn',
      phu: 'mô tả, không chấm điểm; thiếu mẫu thì nói thẳng là thiếu',
      vi: 'gương thuần mô tả tự nó đã là can thiệp — thư so sánh của OPOWER giảm 2% '
        + 'tiêu thụ, bền nhiều năm, mà không có một lời khuyên nào',
      nut: ['XEM THỬ'],
    },
    {
      ma: 'KHUNG',
      ten: kh && hoSo.khung !== 'tu_do' ? `Khung: ${kh.ten}` : 'Khung: bạn chọn sau',
      phu: kh ? kh.vi : 'ba khung để chọn, app không chọn hộ',
      vi: 'app giới thiệu khung nào HAY ĐƯỢC DÙNG cho kiểu như bạn và vì sao — bạn chọn, '
        + 'bạn đặt số. Đây là boost (dạy năng lực), không phải nudge (lái ngầm)',
      nut: ['ĐỔI KHUNG'],
    },
  ];
}

function khoiChang3(hoSo: HoSo): KhoiChang[] {
  const nh = hoSo.nhip ?? [];
  return [
    {
      ma: 'LUẬT',
      ten: 'Một luật “nếu–thì” do bạn viết',
      phu: nh.length ? `khung gợi theo câu 6: “${nh.join('”, “')}”` : 'khung gợi theo thẻ tính cách',
      vi: 'd ≈ 0,65 — hàng lớn nhất của ngành hành vi (Gollwitzer & Sheeran 2006, '
        + '94 nghiên cứu). App không đặt số trong luật, và vỡ luật không bị phạt',
      nut: ['ĐẶT CAM KẾT'],
    },
    {
      ma: 'RÀO',
      ten: 'Rào tự dựng',
      phu: '“hỏi lại tôi trước khoản > X” · ẩn mục nhạy cảm',
      vi: 'bạn cầm kiến trúc lựa chọn của chính mình. Mặc định LUÔN là không rào — '
        + 'mọi cái rào bật sẵn đều là lái ngầm',
      nut: ['XEM'],
    },
  ];
}

/**
 * Ghép ba chặng. `moHet` = người chơi tự bấm "MỞ HẾT" — demo cố ý KHÔNG chặn:
 * *"Không ai chặn bạn — chỉ nói trước cho đúng."*
 */
export function loTrinh(
  hoSo: HoSo, so: readonly Khoan[], moHet = false,
  /** D325 — trạng thái sổ; `null` (đang tải hũ) ⇒ chưa vẽ khối trạng thái nào, không vẽ bừa. */
  tt: TrangThaiTaiChinh | null = null,
): Chang[] {
  const ngayGhi = demNgayGhi(so);
  const coNhan = demKhoanCoNhan(so);
  const cong2: CongChang = {
    nhan: 'ngày có ghi trong sổ',
    co: ngayGhi,
    can: CONG.NGAY_GHI,
    vi: 'gương cần đủ số mới nói được câu thật — thiếu thì mọi dòng đều là “chưa đủ để nói”',
  };
  const cong3: CongChang = {
    nhan: 'khoản đã phân loại (nhãn hoặc hũ)',
    co: coNhan,
    can: CONG.KHOAN_CO_NHAN,
    vi: 'luật “nếu-thì” cần đủ lịch sử mới đánh giá được điều kiện — chưa đủ thì nó '
      + 'không bao giờ bắn',
  };
  return [
    { so: '1', ten: 'GHI ĐÃ', cong: null, mo: true, khoi: khoiChang1(hoSo, tt) },
    { so: '2', ten: 'SOI GƯƠNG', cong: cong2, mo: moHet || cong2.co >= cong2.can, khoi: khoiChang2(hoSo) },
    { so: '3', ten: 'TỰ ĐẶT LUẬT', cong: cong3, mo: moHet || cong3.co >= cong3.can, khoi: khoiChang3(hoSo) },
  ];
}

/** Câu tóm tắt đầu màn — nói rõ lộ trình ghép từ ĐÂU, và thiếu gì thì nói thiếu. */
export function tomTatLoTrinh(hoSo: HoSo, tenThe: string | null, soCauDaTraLoi: number): string {
  /* ⚠ Mẫu lấy từ `soCauPhongVan(hoSo)`, KHÔNG chôn số: câu `no_so` chỉ hỏi người có nợ, nên
     tổng số câu khác nhau theo từng người. Chôn 6 (bản cũ) thì sau khi bộ câu đổi, dòng này
     nói sai với MỌI người mà không gì đỏ. */
  const mau = soCauPhongVan(hoSo);
  const goc = tenThe ? `Ghép từ thẻ ${tenThe} + ${soCauDaTraLoi}/${mau} câu.` : `Ghép từ ${soCauDaTraLoi}/${mau} câu bạn đã trả lời.`;
  const thieuMucTieu = (hoSo.mucTieu ?? []).length === 0;
  return thieuMucTieu
    ? `${goc} Câu 4 (việc bạn muốn tiền làm được) còn trống, nên chặng 1 chưa gắn được `
      + 'hũ nào — đó là câu nặng nhất trong sáu câu.'
    : goc;
}
