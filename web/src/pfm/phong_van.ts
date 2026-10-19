/**
 * PFM — SÁU CÂU PHỎNG VẤN CỬA VÀO. Theo DEMO ĐÃ CHỐT (A11.25/D277):
 * `docs/ui-ux/demo/pfm-lo-trinh.html`, mảng `CAU` trong `#man-pv`.
 *
 * ⚠⚠ RANH ĐỎ CHÉP TỪ DEMO, GIỮ NGUYÊN: mọi lựa chọn là bản TĨNH CÓ MÃ, duyệt được
 * và quét test được — KHÔNG sinh tự do. Lý do demo tự ghi: cá nhân hoá theo tính
 * cách đủ mạnh để thao túng (Matz 2017, PNAS, 3,5M người: +40% click khi khớp
 * tính cách), nên cùng cơ chế phải bị trói bằng danh mục đóng.
 *
 * ─── VÌ SAO MÀN NÀY TỒN TẠI ─────────────────────────────────────────────────
 * `pfm/ho_so.ts` có sẵn `nguonThu` · `khung` · `coNo`, có `ghiHoSo`, có ống ra
 * nghiên cứu `ctx_*`, và `Hu.tsx` ĐANG ĐỌC nó để xếp mẫu hũ. Nhưng `grep ghiHoSo`
 * trong `screens/` + `components/` ra **0**: kho có, ống có, người đọc có — **không
 * màn nào HỎI**. Đúng cái mà docstring của `ho_so.ts` tự than về `ctx_*`. Màn này
 * là mảnh thiếu đó, không phải một hồ sơ thứ hai.
 *
 * ─── BA CÂU RA NGOÀI, BA CÂU Ở LẠI MÁY ──────────────────────────────────────
 * `nguon_thu` · `khung` · `co_no` đổ vào `HoSo` đã có. Ba câu còn lại (`deu` ·
 * `muc_tieu` · `nhip`) **chỉ ở lại máy** — chúng CHƯA có mã trong `SO_DANG_KY`, và
 * A8.2 cấm agent tự thêm một trục đo. Cùng tiền lệ với `coNo` (xem chú thích của
 * nó ở `ho_so.ts`). Muốn đo thì founder chốt và thêm vào `SO_DANG_KY` TRƯỚC.
 */
import type { HoSo, MaNguonThu } from './ho_so.js';
import { NGUONG_TINH_CACH } from '@server/holdem/insight';
import type { TinHieuGameDTO } from '@server/hanh_vi/tin_hieu_ids';

export interface CauPv {
  id: string;
  /** Câu hỏi, nguyên văn demo. */
  hoi: string;
  /** Dòng phụ dưới câu hỏi (nguyên văn demo); vắng thì không hiện dòng nào. */
  phu?: string;
  /** Chọn nhiều được? */
  nhieu?: boolean;
  /** Nhãn các lựa chọn, nguyên văn demo (chữ người đọc — D26). */
  dap: readonly string[];
  /**
   * Câu chỉ hiện khi điều kiện này đúng (`undefined` = luôn hiện).
   *
   * ⚠ Câu ẩn phải được coi như KHÔNG TỒN TẠI ở mọi chỗ đếm/duyệt, không phải "câu chưa trả
   * lời". Nhầm chỗ này thì thanh đếm không bao giờ đầy và nút XONG không bao giờ hiện.
   */
  hienKhi?: (traLoi: Readonly<Record<string, string[] | null | undefined>>) => boolean;
}

/** Câu đang hiện, theo các câu đã trả lời. Mọi chỗ duyệt câu phải đi qua đây. */
export function cauDangHien(
  traLoi: Readonly<Record<string, string[] | null | undefined>>,
): readonly CauPv[] {
  return CAU_PV.filter((c) => c.hienKhi === undefined || c.hienKhi(traLoi));
}

/**
 * ĐÁP ÁN GAME ĐIỀN SẴN ⚑ — SUY TỪ SỐ THẬT CỦA TRẬN (D324).
 *
 * ⚠⚠ Trước D324 hai câu mang ⚑ bằng HẰNG SỐ gõ tay (`khung: 'chưa biết'`, `nhip: 'ngày tệ'`)
 * trong khi câu dẫn trên màn nói *"câu nào game đã trả lời được thì điền sẵn"* — tức app
 * khẳng định một điều nó không hề đo, với MỌI người như nhau. Cờ ⚑ tồn tại để nói thật
 * nguồn gốc của một đáp án; cắm nó lên một hằng số là dùng chính cờ ấy để nói dối.
 *
 * Nay chỉ còn MỘT suy luận có cơ sở, và chỉ khi cửa `noi_game` mở (người gọi quyết):
 *  · `nhip` ⇒ "ngày tệ" khi người chơi DỒN VỐN SAU VÒNG THUA vượt ngưỡng nét "kết quả" đang
 *    dùng cho thẻ tính cách (`NGUONG_TINH_CACH.KET_QUA_X` — đọc lại, không chép số). Cùng
 *    một construct: đuổi gỡ sau cú đau.
 *  · `khung` BỎ HẲN: không tín hiệu nào trong trận nói ai hợp khung chia tiền nào; điền sẵn
 *    một khung là lái người ta về một phương pháp — gần kê đơn hơn là mô tả (A10).
 * Thiếu mẫu (`sau_thua_x` null) ⇒ không điền gì.
 */
export function gameDienSan(t: TinHieuGameDTO | undefined): Partial<Record<string, string>> {
  const ra: Partial<Record<string, string>> = {};
  const sauThua = t?.chi_so.don_von?.sau_thua_x;
  if (sauThua != null && sauThua >= NGUONG_TINH_CACH.KET_QUA_X) ra.nhip = 'ngày tệ';
  return ra;
}

/**
 * ⚠ Thứ tự và chữ CHÉP NGUYÊN từ demo. Đổi chữ ⇒ sửa ở DEMO trước (A11.25/D277).
 *
 * ─── ĐỔI 21/09 SO VỚI BẢN SÁU CÂU ───────────────────────────────────────────────
 * · BỎ câu `khung` ("muốn nhìn tiền của mình kiểu gì": hũ / 50-30-20 / kakeibo). Founder:
 *   *"mấy khung PFM… chưa mang tính Hỗ trợ lắm, làm xong thì người ta cũng chẳng biết bắt
 *   đầu như nào"*. Hỏi tên phương pháp ngay cửa vào là bắt người chưa biết gì chọn giữa ba
 *   chữ họ chưa từng nghe. ⚠ KHÔNG mất đường: `lo_trinh.ts` VẪN hỏi khung, nhưng hỏi lúc
 *   người ta đã có sổ và đã thấy tiền mình đi đâu (`chuaChonKhung`, dòng ~192 tệp ấy).
 * · THÊM `no_so` — chỉ hiện khi có nợ. Mở khoá con số "vì sao" mạnh nhất app nói được:
 *   trả một khoản nợ là khoản có lợi suất CHẮC CHẮN (`pfm-nhu-danh-muc-dau-tu.md` §6).
 * · THÊM BA CÂU ĐO ⇒ chân dung hành tinh (`chan_dung_hanh.ts`).
 *
 * ⚠⚠ BA CÂU ĐO PHẢI LÀ THÓI QUEN TIỀN THẬT. Founder bác hai lần liên tiếp: lần đầu bác cặp
 * câu kiểu bài toán kinh tế (*"200.000 ngay bây giờ / 240.000 sau một tuần"*) vì nó đọc như
 * đề thi; lần sau bác luôn bản sửa theo — hỏi về hạn nộp việc và quyết định lớn chung chung
 * — vì *"phải nối với thói quen tài chính chứ, hỏi linh tinh và mơ hồ thế"*. Hai lời bác kẹp
 * ra đúng một đích: **việc tiền bạc người ta VẪN LÀM hằng tháng, hỏi dạng "thường thì bạn…"**,
 * không con số giả định, không tình huống dựng.
 *
 * ⚠ Câu `luc_tien_ve` hỏi ĐÚNG cửa sổ mà app tự chấm mình (`cham_doan.ts` · `tien_ve` · 48 giờ
 *   sau tiền về ·`GUONG_CUA_SO_TIEN_VE`). Lời khai và phép đo nói về CÙNG một khoảnh khắc, nên
 *   cuối tuần đối chiếu được thẳng — thay vì đo một thứ cạnh tiền rồi suy sang tiền.
 * ⚠ GIÁ ĐÃ TRẢ, GHI ĐỂ KHÔNG QUÊN: cặp câu cũ là LỰA CHỌN (bằng chứng mạnh — thiên vị hiện tại
 *   lộ ra ở chỗ người ta đổi ý giữa hai mốc thời gian); ba câu này là TỰ KHAI, mà P6 xếp tự khai
 *   là bằng chứng yếu. Chỗ kiểm: Phiếu 3 của buổi đo hỏi lại đúng ba câu này TỪ 23/09 (founder chốt,
 *   D385). ⚠ Trước đó câu ở đây ghi "chốt ở buổi đo 30/09" và nó RỖNG: lời khai ở lại máy (P2) mà
 *   phiếu thì không hỏi — xem đính chính ở `docs/yeu-cau-ky-thuat/13-phong-van-va-chan-dung-pfm.md` §3.
 * ⚠ Mọi nhãn ≤ 18 ký tự — dài hơn thì chip tràn ngang thành mảng xám lớn, chỗ founder kêu khó
 *   đọc (xem `.chip.doi` trong demo). Có bài canh.
 */
export const CAU_PV: readonly CauPv[] = [
  {
    id: 'nguon_thu', nhieu: true, hoi: 'Tiền vào từ đâu?', phu: 'CHỌN NHIỀU ĐƯỢC',
    dap: ['lương tháng', 'làm thêm', 'gia đình cho', 'học bổng', 'bán hàng', 'đầu tư'],
  },
  { id: 'deu', hoi: 'Tiền vào có đều không?', dap: ['đều mỗi tháng', 'thất thường', 'theo mùa'] },
  {
    id: 'co_no', nhieu: true, hoi: 'Đang có khoản phải trả đều nào?', phu: 'CHỌN NHIỀU ĐƯỢC',
    dap: ['không có', 'trả góp', 'nợ bạn bè', 'học phí', 'tiền nhà'],
  },
  {
    id: 'no_so', hoi: 'Khoản ấy mỗi tháng trả bao nhiêu, còn bao lâu?',
    phu: 'MỞ KHOÁ CON SỐ “VÌ SAO”',
    dap: [
      'dưới 500k · dưới 6 tháng', 'dưới 500k · trên 6 tháng',
      '500k–2tr · dưới 6 tháng', '500k–2tr · trên 6 tháng', 'trên 2tr',
    ],
    /* ⚠ "không có" là câu trả lời PHỦ ĐỊNH (xem `coNoTuNhan`), nên nó ẩn câu này — khác hẳn
       với chưa trả lời câu nợ, lúc ấy cũng chưa hỏi được chi tiết. Hai ca đều ra `false`. */
    hienKhi: (t) => {
      const n = t.co_no;
      return Array.isArray(n) && n.length > 0 && !n.includes('không có');
    },
  },
  {
    id: 'muc_tieu', nhieu: true, hoi: 'Việc bạn muốn tiền làm được?', phu: 'CHỌN NHIỀU ĐƯỢC',
    dap: ['quỹ dự phòng', 'thiết bị học', 'chuyến đi', 'món muốn mua', 'trả nợ'],
  },
  {
    id: 'luc_tien_ve', hoi: 'Tiền vừa về, việc đầu tiên bạn làm với nó là gì?',
    phu: 'ĐO · LÚC TIỀN VỀ',
    dap: ['cất một phần đi', 'trả khoản cố định', 'tiêu cái đang cần', 'chưa nghĩ đã vơi'],
  },
  {
    id: 'sau_khi_tieu', hoi: 'Trả tiền xong một món hơi đắt, bạn thường…',
    phu: 'ĐO · SAU KHI TIÊU',
    dap: ['quên luôn', 'thấy đáng', 'nhẩm lại giá', 'tiếc mất mấy hôm'],
  },
  {
    id: 'dau_thang', hoi: 'Đầu tháng, bạn có biết tháng này tiền sẽ đi đâu không?',
    phu: 'ĐO · ĐẦU THÁNG',
    dap: ['rồi, khá rõ', 'đại khái', 'chưa'],
  },
  {
    id: 'nhip', nhieu: true, hoi: 'Lúc nào bạn dễ tiêu quá tay?', phu: 'CHỌN NHIỀU ĐƯỢC',
    dap: ['lúc vừa có tiền', 'cuối tháng', 'ngày tệ', 'đi chơi cùng bạn'],
  },
];

/* ══ NHÃN NGƯỜI ĐỌC → MÃ TRONG KHO ═════════════════════════════════════════ */

/* ⚠ BẢNG `MA_KHUNG` ĐÃ GỠ cùng với câu `khung` (21/09). Nó KHÔNG chết theo: `lo_trinh.ts`
   ghi `hoSo.khung` bằng mã trực tiếp (`bamNut` → `{ khung }`), không qua nhãn, nên không cần
   bảng dịch nào. Gỡ chứ không để lại: một bảng dịch không ai gọi là bản sao thứ hai của
   `SO_DANG_KY.ctx_khung.mien` đứng chờ trôi (A11.5/D61). */

/** `ctx_nguon_thu` — sáu nhãn gộp về bốn mã của sổ đăng ký. */
const MA_NGUON: Record<string, MaNguonThu> = {
  'lương tháng': 'luong',
  'làm thêm': 'tu_do',
  'bán hàng': 'tu_do',
  'gia đình cho': 'tro_cap_gd',
  'học bổng': 'tro_cap_gd',
  'đầu tư': 'khac',
};

/**
 * ⚠⚠ NHIỀU MÃ ⇒ BỎ TRỐNG, KHÔNG CHỌN BỪA MỘT CÁI.
 *
 * Câu nguồn thu cho chọn NHIỀU, còn `ctx_nguon_thu` chỉ nhận MỘT mã. Chỗ này có
 * một cám dỗ: đặt thứ tự ưu tiên ("lương thắng trợ cấp") rồi lấy cái đầu. Không
 * làm, vì hai lẽ:
 *   · đó là một THAM SỐ NGHIÊN CỨU do agent tự đặt — A8.2 cấm thẳng;
 *   · người vừa có lương vừa được gia đình cho là một cohort THẬT, và ép họ vào
 *     một trong hai là bịa dữ liệu cho chính trục mà `ho_so.ts` nói là "trục
 *     cohort mạnh nhất của mọi chỉ số chi tiêu".
 * Không suy ra được một mã duy nhất ⇒ để `undefined`, tức "chưa khai" — đúng
 * trạng thái mà `docHoSo` đã xử lý sẵn. Câu trả lời thô vẫn nằm lại trên máy.
 */
export function nguonThuTuNhan(nhan: readonly string[]): MaNguonThu | undefined {
  const ma = new Set(nhan.map((n) => MA_NGUON[n]).filter((x): x is MaNguonThu => x !== undefined));
  return ma.size === 1 ? [...ma][0] : undefined;
}

/** `coNo` — "không có" là câu trả lời PHỦ ĐỊNH, không phải chưa trả lời. */
export function coNoTuNhan(nhan: readonly string[]): boolean | undefined {
  if (nhan.length === 0) return undefined;
  return !(nhan.length === 1 && nhan[0] === 'không có');
}

/**
 * CÂU NÀO SỞ HỮU KHOÁ NÀO của hồ sơ — dùng khi người chơi mở lại một câu đã trả
 * lời rồi chạm "để sau" (D308: từ nay phỏng vấn SỬA LẠI ĐƯỢC, nên "để sau" phải
 * XOÁ được câu cũ; trước đây chưa có đường quay lại nên chưa ai gặp).
 *
 * ⚠ MỘT NGUỒN cho cả hai chiều: `hoSoTuTraLoi` ghi đúng những khoá này, và
 * `PhongVan.xong` xoá đúng những khoá này. Bảng lệch = câu trả lời cũ sống sót
 * sau khi người dùng đã bỏ nó, im lặng.
 */
export const KHOA_THEO_CAU: Record<string, readonly (keyof HoSo)[]> = {
  nguon_thu: ['nguonThu', 'nguonThuNhan'],
  deu: ['deu'],
  co_no: ['coNo', 'coNoNhan'],
  /* ⚠ Bỏ chip nợ về "không có" ⇒ câu `no_so` biến mất khỏi `cauDangHien`, mà giá trị cũ của nó
     vẫn nằm trong hồ sơ. `PhongVan.xong` phải xoá theo — xem `KHOA_CAU_AN`. */
  no_so: ['noSo'],
  muc_tieu: ['mucTieu'],
  luc_tien_ve: ['lucTienVe'],
  sau_khi_tieu: ['sauKhiTieu'],
  dau_thang: ['dauThang'],
  nhip: ['nhip'],
};

/**
 * Khoá hồ sơ của những câu ĐANG BỊ ẨN — phải bị xoá khi lưu.
 *
 * ⚠⚠ VÌ SAO CẦN RIÊNG: câu điều kiện (`no_so`) trả lời rồi vẫn có thể biến mất, khi người dùng
 * mở lại câu nợ và đổi sang "không có". Lúc ấy `cauDangHien` không còn `no_so`, nên không vòng
 * lặp nào chạm tới nó, nên `hoSoTuTraLoi` không ghi gì — và giá trị CŨ sống sót im lặng. Người
 * dùng đã nói "tôi không có nợ" mà hồ sơ vẫn giữ "500k–2tr · trên 6 tháng".
 */
export function khoaCauAn(
  traLoi: Readonly<Record<string, string[] | null | undefined>>,
): readonly (keyof HoSo)[] {
  const hien = new Set(cauDangHien(traLoi).map((c) => c.id));
  return CAU_PV.filter((c) => !hien.has(c.id)).flatMap((c) => KHOA_THEO_CAU[c.id] ?? []);
}

/** Kết quả một lượt phỏng vấn → mảnh `HoSo` để trộn vào bản đã có. */
export function hoSoTuTraLoi(traLoi: Record<string, string[] | null>): Partial<HoSo> {
  const ra: Partial<HoSo> = {};
  const lay = (id: string): string[] => traLoi[id] ?? [];

  const nhanNguon = lay('nguon_thu');
  const nguon = nguonThuTuNhan(nhanNguon);
  if (nguon !== undefined) ra.nguonThu = nguon;
  /*
   * ⚠ GIỮ NHÃN THÔ kể cả khi KHÔNG đúc ra mã (nhiều mã ⇒ `nguonThu` để trống).
   * Đúng ca "vừa có lương vừa được gia đình cho" mà `nguonThuTuNhan` cố ý không
   * chọn bừa: cohort thì bỏ trống, nhưng người dùng vẫn phải thấy lại đúng hai
   * chip họ đã chạm khi mở lại câu hỏi.
   */
  if (nhanNguon.length) ra.nguonThuNhan = nhanNguon;

  /* ⚠ KHÔNG còn câu `khung` ở cửa vào (xem đầu `CAU_PV`). `hoSo.khung` vẫn sống và vẫn được
     ghi — nhưng bởi `lo_trinh.ts`, lúc người ta đã có sổ. Ở đây không đụng tới nó: ghi
     `khung: undefined` ở đây sẽ XOÁ lựa chọn họ đã làm trên lộ trình. */

  const nhanNo = lay('co_no');
  const coNo = coNoTuNhan(nhanNo);
  if (coNo !== undefined) ra.coNo = coNo;
  // Năm nhãn đúc về một boolean ⇒ phải giữ nhãn thô, xem `nguonThuNhan`.
  if (nhanNo.length) ra.coNoNhan = nhanNo;

  // Ba câu chỉ-ở-lại-máy: giữ NGUYÊN NHÃN, không đúc mã. Chưa có mã nào để đúc
  // (SO_DANG_KY chưa khai), và đúc trước là tự đặt trục đo (A8.2).
  const deu = lay('deu')[0];
  if (deu !== undefined) ra.deu = deu;
  const mucTieu = lay('muc_tieu');
  if (mucTieu.length) ra.mucTieu = mucTieu;
  const nhip = lay('nhip');
  if (nhip.length) ra.nhip = nhip;

  // Bốn câu thêm 21/09 — một lựa chọn, giữ nguyên nhãn, không đúc mã (xem `HoSo`).
  const mot = (id: string, khoa: 'noSo' | 'lucTienVe' | 'sauKhiTieu' | 'dauThang'): void => {
    const v = lay(id)[0];
    if (v !== undefined) ra[khoa] = v;
  };
  mot('no_so', 'noSo');
  mot('luc_tien_ve', 'lucTienVe');
  mot('sau_khi_tieu', 'sauKhiTieu');
  mot('dau_thang', 'dauThang');

  return ra;
}

/* ══ CHIỀU NGƯỢC — MỞ LẠI CÂU ĐÃ TRẢ LỜI ĐÚNG NHƯ CŨ (D308) ════════════════ */

/**
 * HỒ SƠ → BẢNG TRẢ LỜI, để màn phỏng vấn mở lại đúng chip người chơi đã chạm.
 *
 * ⚠ VÌ SAO CẦN: từ D308 phỏng vấn sửa lại được (⚙ › SỬA SÁU CÂU, và nút ĐỔI
 * KHUNG trên lộ trình). Mở ra mà sáu câu trống trơn thì người dùng phải khai
 * lại tất cả để đổi một câu — đúng thứ founder gọi là *"user chỉ cần sửa 1 tý"*.
 *
 * ⚠ CÂU KHÔNG DỰNG LẠI ĐƯỢC THÌ VẮNG MẶT, không đoán một nhãn đại diện. Hồ sơ
 * cũ (ghi trước D308) có `nguonThu` mà không có `nguonThuNhan` ⇒ câu 1 mở ra
 * trống, và giá trị cũ VẪN SỐNG vì `xong()` chỉ trộn câu có trả lời. Bịa một
 * nhãn cho khớp mã là tự đặt dữ liệu hộ người dùng (A8.2 · P14).
 */
export function traLoiTuHoSo(hoSo: HoSo): Record<string, string[]> {
  const ra: Record<string, string[]> = {};
  const dat = (id: string, v: readonly string[] | undefined): void => {
    if (v && v.length) ra[id] = [...v];
  };
  const motNhan = (v: string | undefined): string[] | undefined => (v === undefined ? undefined : [v]);
  dat('nguon_thu', hoSo.nguonThuNhan);
  dat('deu', motNhan(hoSo.deu));
  dat('co_no', hoSo.coNoNhan);
  dat('no_so', motNhan(hoSo.noSo));
  dat('muc_tieu', hoSo.mucTieu);
  dat('luc_tien_ve', motNhan(hoSo.lucTienVe));
  dat('sau_khi_tieu', motNhan(hoSo.sauKhiTieu));
  dat('dau_thang', motNhan(hoSo.dauThang));
  dat('nhip', hoSo.nhip);
  return ra;
}
