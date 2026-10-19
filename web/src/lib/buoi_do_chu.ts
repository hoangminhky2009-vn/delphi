/**
 * BUỔI ĐO — TỰ ĐIỂN CHỮ (D329, D26: chữ ở client). Văn bản đồng ý `buoi_do` + chữ của thẻ đồng ý, dải
 * chế độ tester và màn điều phối.
 *
 * ⚠⚠⚠ SỬA MỘT CHỮ TRONG `VAN_BAN_BUOI_DO` ⇒ TĂNG `CONSENT_PHIEN_BAN.buoi_do` (`config/pfm_consent.ts`),
 * không xoá bản cũ. `web/tests/buoi_do_chu.test.ts` ghim HASH toàn văn ↔ phiên bản: đổi chữ mà giữ phiên
 * bản là bài ấy đỏ. Vết đồng ý trong `events` trỏ về (id, phiên bản) — hai nội dung dưới một tên là vết giả.
 *
 * ⏳ CHƯA AI ĐỒNG Ý BẢN NÀY, VÀ NÓ CHỜ FOUNDER DUYỆT TỪNG CHỮ (tệp 10 §3.6, §9 câu 7). Nháp nguyên văn §3.6;
 * sửa trước khi ship thì không cần lên v2. Từ giây có người bấm đồng ý thì hết.
 *
 * ⚠ Hai bất biến được HỨA VĨNH VIỄN (§3.6): không ai mua được đường tới một cá nhân · không số tiền thô nào
 * rời máy. Mọi câu khác chỉ tả DÒNG DỮ LIỆU của buổi này — dòng mới là phiên bản mới, hỏi lại.
 * ⚠ A11.16: câu mùa 0.0 — không bán, không chia.
 */
import type { VanBanConsent } from './pfm_chu';

/**
 * ⭐ v2 (20/09, D361 — founder: *"Bỏ cái V1 đi, tôi cần kiểm tra chi tiết từng người làm báo cáo"*).
 *
 * ⚠⚠ V1 NÓI SAI VỀ THỨ SẮP XẢY RA, và đó là lý do phải lên bản mới chứ không phải vì câu chữ chưa đẹp.
 * V1 viết *"Tổ chức chỉ nhận số của cả nhóm… không có dòng nào nói về một người"* — người đọc câu đó hiểu
 * là **không ai** thấy dòng của họ. Nhưng đợt tester này nhóm làm app ĐỌC dòng từng người: đó chính là
 * việc cần làm để sửa app và viết báo cáo. Giữ v1 mà vẫn đọc chi tiết là **lách chữ mình tự viết** — thứ
 * A11.17 xếp vào cửa không dẻo. Nên v2 nói thẳng ai đọc gì, và giữ nguyên đúng hai lời hứa đứng vững:
 * tổ chức không nhận dòng theo người · không bán, không chia dữ liệu theo người.
 *
 * ⚠ Đo prod 20/09 trước khi đổi (`npm run do:consent:prod`): **0 vết đồng ý mọi văn bản, 0 bàn `buoi_do`**.
 * Nên v2 thay v1 mà KHÔNG ai phải hỏi lại. Dòng hash `buoi_do@v1` ở `web/tests/buoi_do_chu.test.ts` vẫn
 * giữ — nó là bằng chứng của thứ đã từng ship, kể cả khi chưa ai bấm.
 *
 * ⏳ CHỮ NÀY CHỜ FOUNDER ĐỌC TỪNG CÂU trước khi người đầu tiên bấm. Sửa trước lúc đó thì cập nhật TẠI CHỖ
 * dòng hash `buoi_do@v2`; sau lúc đó thì là v3.
 *
 * ⭐ v3 (24/09, D392) — v2 TẢ SAI DÒNG DỮ LIỆU sau D370 (buổi đo tự phục vụ), ba chỗ:
 *   · "bài giấy bạn tự nộp" — giấy đã thay bằng BA GOOGLE FORM;
 *   · "nối với nhau bằng mã tham gia" — phiếu mang MÃ BUỔI ĐO (app tự điền), tệp xuất nay khoá bằng mã ấy;
 *   · "số tiền bạn viết trên giấy ở lại trên giấy" — Phiếu 1/3 hỏi KHOẢNG chi tiêu, và câu trả lời nằm ở
 *     bảng tính của nhóm làm app, không "ở lại" đâu cả.
 *   Hai lời hứa vĩnh viễn và câu mùa 0.0 giữ NGUYÊN từng chữ. Lên v3 thay vì sửa tại chỗ dòng v2 (dù chưa
 *   ai bấm — đo prod 23/09: 0 vết đồng ý buổi đo): máy còn giữ bản web cũ sẽ gửi `v2` kèm chữ CŨ; server chỉ
 *   nhận bản hiện hành nên cú bấm ấy bị trả `consent_cu` thay vì ghi một vết trỏ về chữ người ấy chưa đọc.
 */
export const VAN_BAN_BUOI_DO: VanBanConsent = {
  tieuDe: 'BUỔI ĐO CÙNG NHÓM',
  tomTat: 'Đây là buổi thử sản phẩm. Nhóm làm app đọc dữ liệu của từng người để sửa app và viết báo cáo. '
    + 'Người điều phối và tổ chức chỉ nhận bức tranh của cả nhóm.',
  roiMay: 'Nước đi trong trận (như mọi trận), sổ chi tiêu nếu bạn đang bật, năm sinh dạng khoảng, và ba '
    + 'phiếu hỏi đáp bạn tự nộp — nối với nhau bằng mã buổi đo app tự điền vào phiếu, không bằng tên.',
  mayChuKhongDoc: 'Tên và email không đi kèm dữ liệu. Khoảng chi tiêu bạn chọn trong phiếu nằm ở bảng tính '
    + 'của nhóm làm app. Người điều phối và tổ chức chỉ nhận số của cả nhóm, đã làm tròn — không một dòng '
    + 'nào nói về một người.',
  chot: 'Không bán, không chia dữ liệu theo người cho bất kỳ ai. Bản tổng hợp cả nhóm — không có dòng nào '
    + 'về một người — có thể dùng trong hồ sơ dự thi và khi giới thiệu với trường, viện. Đổi một chữ ở đây '
    + 'là một bản mới và bạn được hỏi lại. Rút lại lúc nào cũng được: số của bạn rời khỏi bản tổng hợp từ '
    + 'lần dựng kế.',
};

/** Chữ quanh văn bản — KHÔNG thuộc văn bản đồng ý (không vào hash): đổi được mà không lên phiên bản. */
export const CHU_BUOI_DO = {
  nhanRoiMay: 'RỜI MÁY',
  /** Vế `mayChuKhongDoc` của cửa này đọc là "tổ chức không nhận" — người nhận khác, nhãn khác (§3.6). */
  nhanKhongNhan: 'TỔ CHỨC KHÔNG NHẬN',
  nutDongY: 'ĐỒNG Ý VÀ VÀO',
  nutKhong: 'KHÔNG, VỀ SẢNH',
  dangGui: 'ĐANG GHI…',
  phienBanPre: 'bản ',
  loiGui: 'Chưa ghi được — kiểm tra mạng rồi thử lại.',
  cheDoPre: 'BUỔI ĐO · ',
  chuPhongCho: 'Cả nhóm cùng một đề — mỗi người một ghế riêng, ai vào lúc nào cũng được. Bạn nhận thẻ của '
    + 'riêng bạn; người điều phối chỉ thấy bức tranh cả nhóm.',
  caNhomPre: 'CẢ NHÓM · ',
  caNhomHau: ' người đã vào',
  /** D396 — khách (bấm "Chơi ngay") mở link buổi đo: nút sang tạo tài khoản, nhớ sẵn bàn để quay lại. */
  taoTaiKhoan: 'TẠO TÀI KHOẢN',
} as const;

/**
 * D370 — CHỮ CỦA DẢI CHẾ ĐỘ TESTER. Người đọc là TESTER đang tự đi một mình.
 *
 * ⚠⚠ KHÔNG CÒN AI NÓI HỘ. Trước đây thứ dẫn người ta qua năm bước là giọng người điều phối; founder
 * 21/09 chốt không có vai ấy nữa. Nên mỗi câu dưới đây phải đứng một mình và nói ĐÚNG MỘT việc kế
 * tiếp — "bước 3/5" không đủ, phải là "giờ làm gì".
 * ⚠ A10 🔒: chỉ tả việc và chỉ đường, không một chữ khuyên về tiền.
 */
export const CHU_CHE_DO_TESTER = {
  nhan: 'BUỔI ĐO',
  maNhan: 'MÃ CỦA BẠN',
  maGiai: 'App tự điền mã này vào phiếu. Mất tab thì gõ tay cũng được.',
  buocPre: 'Bước ',
  buocGiua: '/',
  /** Năm việc, theo đúng thứ tự `buoi_do_buoc`. Mỗi câu là MỘT việc kế tiếp, không phải mô tả bước. */
  viec: [
    'Làm PHIẾU 1 — trả lời khi chưa mở gì trong app.',
    // D392 — "một trận thật" cũ bị đọc thành bất kỳ trận nào (thẻ THỬ THÁCH HÔM NAY đứng đầu sảnh):
    // chơi trọn 9 phút trên đề khác, bước không tiến. Nay chỉ đích danh bàn, kèm nút ngay dưới.
    'Vào ALPHA DRAFT chơi BÀN TẬP một lượt (có hướng dẫn), rồi bấm VÀO BÀN BUỔI ĐO để chơi trận thật.',
    'Làm PHIẾU 2 — kể lại lúc chơi, trước khi xem thẻ.',
    'Vào PERSONAL FINANCE: trả lời câu hỏi và xem chân dung.',
    'Làm PHIẾU 3 — phiếu cuối.',
  ],
  /** Bước 4 (PFM) không có cửa nào chặn nên server không tự biết — người dùng tự khai. */
  xongPfm: 'Tôi đã xem xong chân dung',
  xong: '🎉 Xong cả năm bước. Cảm ơn bạn — app vẫn chơi bình thường nếu bạn muốn.',
  moPhieu: 'MỞ PHIẾU',
  /** D392 — đường về bàn buổi đo sau bàn tập (dải bước 1 + phòng chờ). */
  vaoBan: 'VÀO BÀN BUỔI ĐO',
  /** D392 — phòng chờ báo "chơi bàn tập trước" thì có nút làm luôn việc ấy. */
  vaoBanTap: 'VÀO BÀN TẬP',
  dangDungBanTap: 'ĐANG DỰNG BÀN TẬP…',
  /** D396 — bước PFM có nút mở thẳng PERSONAL FINANCE (cùng đích thẻ ở Hub). */
  moPfm: 'MỞ PERSONAL FINANCE',
  /** D396 — bước Phiếu 3: phiếu hỏi về THẺ NĂNG LỰC (ở Hồ sơ), link thẳng tới đúng thẻ ấy. */
  xemThe: 'Xem thẻ năng lực của bạn',
  dangChoApp: 'Làm trong app, xong quay lại đây.',
  daNop: 'Tôi đã nộp phiếu rồi',
  dangGhi: 'ĐANG GHI…',
  loiGhi: 'Chưa ghi được — kiểm tra mạng rồi thử lại.',
  /** Hiện ở màn kết khi thẻ đang bị giữ (server trả `the_dang_giu`). */
  theDangGiu: 'Thẻ năng lực mở sau khi bạn nộp PHIẾU 2 — phiếu ấy hỏi bạn nhớ lại, nên phải trả lời trước.',
} as const;

/**
 * D333 — CHỮ CỦA MÀN ĐIỀU PHỐI (`/buoi-do`). Người đọc là người TỔ CHỨC buổi đo (và giám khảo nhìn xem tổ
 * chức nhận được gì), không phải người chơi. Số đi riêng qua tham số (D26); `web/tests/buoi_do_dieu_phoi`
 * quét A10 trên mọi chuỗi ở đây như `CHU_BUOI_DO`.
 * ⚠ Không thuộc văn bản đồng ý, không vào hash: đổi được mà không lên phiên bản.
 */
export const CHU_DIEU_PHOI = {
  tieuDe: 'Buổi đo',
  dan: 'Cả nhóm chơi cùng một đề, mỗi người một trận riêng. Người chơi nhận thẻ của riêng họ; bạn nhận bức '
    + 'tranh cả nhóm — không một dòng nào nói về một người.',
  khongQuyen: 'Màn này dành cho người điều phối buổi đo. Tài khoản này chưa có quyền điều phối.',
  loiTai: 'Chưa tải được danh sách buổi đo — kiểm tra mạng rồi thử lại.',

  taoTieuDe: 'TẠO BUỔI ĐO',
  nhanDe: 'ĐỀ',
  deGiai: 'Buổi đầu dùng một đề, buổi đo lại dùng đề kia — cùng các mặt sự kiện, khác bàn cờ.',
  // D392 — de-a/de-b thôi dùng (luật v45); vẫn giữ tên để danh sách buổi cũ đọc ra chữ, không ra mã.
  tenDe: { 'de-a': 'ĐỀ A', 'de-b': 'ĐỀ B', 'de-c': 'ĐỀ C', 'de-d': 'ĐỀ D', 'de-e': 'ĐỀ E' } as Readonly<Record<string, string>>,
  oSau: ' ô',
  nhanNhom: 'NHÃN NHÓM',
  nhanNhomGoiY: 'vd lop-10a-buoi-1',
  nhanNhomGiai: 'Chỉ a–z, 0–9 và dấu gạch. Không ghi tên người hay tên trường.',
  nutTao: '▶ TẠO BÀN',
  dangTao: 'ĐANG TẠO…',

  dsTieuDe: 'BUỔI ĐO CỦA BẠN',
  dsRong: 'Chưa có buổi đo nào.',
  dangMo: 'ĐANG MỞ',
  daDong: 'ĐÃ ĐÓNG',
  ma: 'MÃ BÀN',
  daVaoHau: ' đã vào',
  daXongHau: ' đã xong',
  nutChiaSe: 'CHIA SẺ LINK',
  daChep: 'ĐÃ CHÉP LINK',
  chiaSeChu: 'Link buổi đo DELPHI — mở link, tạo tài khoản rồi bấm ĐỒNG Ý VÀ VÀO.',
  nutDong: 'ĐÓNG BUỔI',
  nutDongChac: 'BẤM LẦN NỮA ĐỂ ĐÓNG',
  dongGiai: 'Đóng rồi thì không ai vào thêm được, và bức tranh nhóm mở ra.',
  nutNhom: 'BỨC TRANH NHÓM',

  nhomTieuDe: 'BỨC TRANH NHÓM',
  nhomNPre: 'Trận đếm được: ',
  nhomSanPre: ' · sàn ',
  nhomChuaDu: 'Chưa đủ trận đếm được để có số — dưới sàn thì trang nhóm chỉ báo số trận.',
  bacLamDuoc: 'làm được',
  bacChuaVung: 'chưa vững',
  bacChuaGap: 'chưa gặp',
  phuongPhap: [
    'Mỗi người một trận trên cùng một đề; chỉ đếm trận đã xong của người đang đồng ý.',
    'Làm tròn tới 5%. Không có dòng nào nói về một người.',
    '"Chưa gặp": trận ấy chưa có đủ tình huống để đọc năng lực đó — không phải điểm kém.',
  ] as readonly string[],
} as const;
