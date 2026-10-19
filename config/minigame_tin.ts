/**
 * D532 — TIN TRONG MÀN (founder 06/10: *"lướt sóng ở demo như nào thì làm như thế"* → "Làm cả (a)+(b)"). Bảng CHÉP NGUYÊN VĂN từ demo đã chốt
 * `docs/ui-ux/demo/minigame-bat-day.html` (`NGUON` · `SU_KIEN_KE` · `LAN` · `NHIEU` · `NHIEU_CHU_DE` · `THE` [ng · cb · bc · du] · `HINH[].tin`),
 * sinh bằng `scratchpad/d532_trich.py` — A11.25: demo là nguồn chân lý, đừng sửa chữ ở đây mà quên demo.
 *
 * Server CHỈ dùng phần số (nguồn · uy · p_that · hướng · mag) và gửi ID chữ (`TinMan.chu`); CHỮ ở client (D26) qua `chuTin(id)`.
 * Bỏ khỏi bản chép: icon emoji + tên thẻ của `SU_KIEN_KE` (emoji không vào app, tên thẻ đã có ở tu_dien) · màu CSS của `NGUON` (client suy từ `uy`) ·
 * ma trận `THE.mt` (ma trận là của engine — không chép bản thứ hai).
 */

/** Nguồn tin: tên · độ uy tín 1–5 (sắc độ màu) · xác suất là nguồn của tin rò rỉ THẬT (`rutNguonThat`). */
export const NGUON_TIN = {
  nhtw:       { ten: 'NGÂN HÀNG TW', uy: 5, p_that: .2 },
  bao:        { ten: 'BÁO',          uy: 4, p_that: .35 },
  chinh_tri:  { ten: 'CHÍNH TRỊ GIA', uy: 3, p_that: .15 },
  chuyen_gia: { ten: 'CHUYÊN GIA',   uy: 3, p_that: 0 },
  dien_dan:   { ten: 'DIỄN ĐÀN',     uy: 2, p_that: .15 },
  kol:        { ten: 'KOL · PAGE',   uy: 2, p_that: .1 },
  hoi_nhom:   { ten: 'HỘI NHÓM',     uy: 1, p_that: .05 },
  /** D574 — tin VĨ MÔ (bối cảnh dài hạn). `p_that` 0 + đứng CUỐI bảng ⇒ `rutNguonThat` không xê dịch cú rút nào của khoá cũ. */
  vi_mo:      { ten: 'VĨ MÔ',        uy: 4, p_that: 0 },
} as const;
export type NguonTin = keyof typeof NGUON_TIN;

/** Sự kiện có tin rò rỉ thật trong màn: hướng · độ mạnh (đơn vị hình) · chủ đề nhiễu · tóm tắt (cho tin lan) · lời từng nguồn [chữ, hướng lời] · cải chính. */
export const SU_KIEN_KE_TIN = {
  tang_lai_suat: { huong: -1, mag: 9, chu_de: 'lai_suat', tom: 'sắp tăng lãi suất', that: {
    nhtw: ['Thống đốc: "chúng tôi theo dõi sát lạm phát và sẵn sàng hành động"', 0],
    bao: ['Nguồn tin: ngân hàng trung ương sắp tăng lãi suất', -1],
    chinh_tri: ['Bộ trưởng: "lãi suất sẽ được giữ ổn định để hỗ trợ tăng trưởng"', 1],
    dien_dan: ['Rò rỉ dự thảo: có điều khoản siết tín dụng', -1],
    kol: ['Page tài chính: "lạm phát nóng, lãi suất sắp lên — tin nội bộ"', -1],
    hoi_nhom: ['"Nghe nói sắp tăng lãi suất, xả trước đi"', -1] },
    caiChinh: ['bao', 'Thống đốc: chưa có kế hoạch điều chỉnh lãi suất', 1] },
  ha_lai_suat: { huong: 1, mag: 8, chu_de: 'lai_suat', tom: 'sắp hạ lãi suất', that: {
    nhtw: ['Thống đốc: "dư địa chính sách vẫn còn"', 0],
    bao: ['Chuyên gia kinh tế: dư địa hạ lãi suất đã mở', 1],
    chinh_tri: ['Đại biểu: "không có chuyện nới tiền tệ lúc này"', -1],
    dien_dan: ['Rò rỉ biên bản họp: lãi suất có thể giảm', 1],
    kol: ['KOL: "ngân hàng đang hạ lãi huy động, tiền rẻ sắp về"', 1],
    hoi_nhom: ['"Sắp hạ lãi suất, tiền rẻ sắp về!"', 1] },
    caiChinh: ['chuyen_gia', 'Lãi suất sẽ còn cao rất lâu, đừng mơ', -1] },
  lam_phat: { huong: -1, mag: 9, chu_de: 'lam_phat', tom: 'lạm phát vượt dự báo', that: {
    nhtw: ['Thống đốc: "áp lực giá cả đang được đánh giá kỹ"', 0],
    bao: ['Chỉ số giá tháng này có thể vượt xa dự báo', -1],
    chinh_tri: ['Bộ trưởng: "giá cả cơ bản ổn định"', 1],
    dien_dan: ['Bảng giá nội bộ của chuỗi siêu thị lớn tăng đồng loạt', -1],
    kol: ['Page tài chính: "lạm phát sắp vọt, tiền mặt đang mất giá"', -1],
    hoi_nhom: ['"Giá gì cũng tăng, sắp có biến"', -1] },
    caiChinh: ['chuyen_gia', 'Lạm phát chỉ là tạm thời, không đáng lo', 1] },
  hack_san: { huong: -1, mag: 14, chu_de: null, tom: 'sàn lớn kẹt rút tiền', that: {
    nhtw: ['Cơ quan quản lý: "đang làm việc với một số sàn giao dịch"', 0],
    bao: ['Một sàn lớn tạm ngừng rút tiền "để bảo trì"', -1],
    chinh_tri: ['Quan chức: "hệ thống tài chính hoàn toàn an toàn"', 1],
    dien_dan: ['Ví nóng của một sàn lớn vừa chuyển đi lượng tiền bất thường', -1],
    kol: ['KOL crypto: "rút tiền khỏi sàn ngay, có biến"', -1],
    hoi_nhom: ['"Sàn kẹt rút tiền, chạy ngay!"', -1] },
    caiChinh: ['bao', 'Đại diện sàn: tài sản người dùng an toàn tuyệt đối', 1] },
  bong_bong: { huong: 1, mag: 10, chu_de: null, tom: 'người mới đổ vào ồ ạt', that: {
    nhtw: ['Thống đốc: "chúng tôi quan sát diễn biến các thị trường tài sản"', 0],
    bao: ['Số tài khoản mở mới cao nhất nhiều năm', 1],
    chinh_tri: ['Quan chức: "thị trường đang dần hạ nhiệt"', -1],
    dien_dan: ['Lượng tiền nạp vào các sàn tăng vọt tuần này', 1],
    kol: ['Page tài chính: "người mới vào kỷ lục, sóng lớn bắt đầu"', 1],
    hoi_nhom: ['"Ai chưa vào là lỡ chuyến!"', 1] },
    caiChinh: ['chuyen_gia', 'Tiền đang rút khỏi thị trường, cẩn thận', -1] },
  thien_nga_den: { huong: -1, mag: 12, chu_de: null, tom: 'có sự cố lớn ở nước ngoài', that: {
    nhtw: ['Thống đốc: "sẵn sàng bơm thanh khoản khi cần"', 0],
    bao: ['Nhiều đường bay quốc tế bị tạm dừng đột ngột', -1],
    chinh_tri: ['Quan chức: "tình hình hoàn toàn trong tầm kiểm soát"', 1],
    dien_dan: ['Tin chưa xác nhận về một sự cố lớn ở nước ngoài', -1],
    kol: ['KOL: "quỹ ngoại đang rút ồ ạt, có chuyện lớn"', -1],
    hoi_nhom: ['"Có biến lớn, bán hết đi"', -1] },
    caiChinh: ['chuyen_gia', 'Thị trường đã phản ánh hết rủi ro', 1] },
} as const;
export type SuKienTin = keyof typeof SU_KIEN_KE_TIN;

/** Tin LAN của tin rò rỉ thật (0–2 lần, cùng hướng, 0,3 × tác động). */
export const LAN_TIN = {
  kol: (tom: string) => `KOL: "nghe tin ${tom} chưa? lên kế hoạch đi"`,
  hoi_nhom: (tom: string) => `"Xác nhận rồi anh em: ${tom}!"`,
  dien_dan: (tom: string) => `Thêm nhiều người xác nhận: ${tom}`,
} as const;

/** Tin NHIỄU chung [nguồn, chữ, hướng lời]. */
export const NHIEU_TIN = [
  ['hoi_nhom', 'Mã này sắp x5, vào nhanh kẻo lỡ', 1], ['dien_dan', 'Cá mập đang âm thầm gom hàng', 1],
  ['hoi_nhom', 'Bán hết đi, thị trường sắp sập', -1], ['bao', 'Chuyên gia dự báo thị trường đi ngang tuần tới', 0],
  ['kol', 'Page tài chính: "lãi suất sắp giảm mạnh, all-in đi"', 1], ['bao', 'Tin đồn sáp nhập, chưa có xác nhận', 1],
  ['dien_dan', 'Có người vừa bán khống số lượng lớn', -1], ['chinh_tri', 'Đại biểu: cần hỗ trợ thị trường vốn', 1],
  ['chuyen_gia', 'Biểu đồ đã hình thành vai đầu vai', -1], ['bao', 'Lợi nhuận quý được dự báo vượt kỳ vọng', 1],
  ['nhtw', 'Thống đốc: chính sách tiền tệ sẽ linh hoạt', 0], ['kol', 'KOL: "tôi vừa cắt lỗ hết, các bạn tự cân nhắc"', -1],
] as const;

/** Tin NHIỄU theo chủ đề của bối cảnh vòng. */
export const NHIEU_CHU_DE_TIN = {
  lai_suat: [
    ['bao', 'Kỳ họp tới: giới phân tích chia rẽ về lãi suất', 0], ['chinh_tri', 'Đại biểu đề nghị giữ lãi suất thấp', 1],
    ['dien_dan', 'Lãi suất liên ngân hàng nhích nhẹ sáng nay', -1], ['kol', 'KOL: "kỳ họp này chắc chắn hạ, all-in"', 1],
    ['hoi_nhom', '"Họp xong là bay, gom ngay"', 1], ['nhtw', 'Phó thống đốc: "điều hành thận trọng, linh hoạt"', 0],
    ['bao', 'Vài ngân hàng tăng lãi huy động kỳ hạn ngắn', -1]],
  lam_phat: [
    ['bao', 'Giá xăng tăng phiên thứ ba liên tiếp', -1], ['dien_dan', 'Chợ đầu mối: giá thịt lên mạnh', -1],
    ['kol', 'Page tài chính: "vàng sẽ lên 20% vì lạm phát"', 1], ['chinh_tri', 'Bộ trưởng: "lạm phát trong tầm kiểm soát"', 1],
    ['nhtw', 'Thống đốc: "theo dõi sát mặt bằng giá"', 0], ['hoi_nhom', '"Lạm phát là tiền mất giá, mua gì cũng lời"', 1]],
  sau_tnd: [
    ['bao', 'Chuỗi cung ứng đứt gãy, nhiều nhà máy tạm ngừng', -1], ['dien_dan', 'Hãng bảo hiểm lớn lo đền bù khổng lồ', -1],
    ['kol', 'KOL: "khủng hoảng là cơ hội, bắt đáy đi"', 1], ['chinh_tri', 'Chính phủ hứa gói hỗ trợ khẩn cấp', 1],
    ['nhtw', 'Ngân hàng TW: "sẵn sàng các công cụ cần thiết"', 0], ['hoi_nhom', '"Đáy rồi, không còn gì để sợ"', 1],
    ['bao', 'Giới phân tích: hậu quả có thể kéo dài nhiều tháng', -1]],
} as const;
export type ChuDeTin = keyof typeof NHIEU_CHU_DE_TIN;

/** Thẻ sự kiện → nguồn + chữ của tin CÔNG BỐ (lớp nổ) · bối cảnh nhiễu (`bc`) · bối cảnh dư âm (`du`). */
export const THE_TIN: Readonly<Record<SuKienTin, { ng: NguonTin; cb: string; bc: 'ky_hop' | 'lam_phat' | 'tu_dong'; du?: 'sau_tnd' }>> = {
  tang_lai_suat: {"ng": "nhtw", "cb": "Ngân hàng trung ương công bố TĂNG lãi suất", "bc": "ky_hop"},
  ha_lai_suat: {"ng": "nhtw", "cb": "Ngân hàng trung ương công bố HẠ lãi suất", "bc": "ky_hop"},
  lam_phat: {"ng": "bao", "cb": "Chỉ số giá công bố vượt xa dự báo", "bc": "lam_phat"},
  hack_san: {"ng": "bao", "cb": "Một sàn lớn thông báo KHOÁ rút tiền", "bc": "tu_dong", "du": "sau_tnd"},
  bong_bong: {"ng": "bao", "cb": "Dòng tiền mới đổ vào thị trường vượt mọi kỷ lục", "bc": "tu_dong"},
  thien_nga_den: {"ng": "bao", "cb": "Sự cố lớn ở nước ngoài được xác nhận", "bc": "tu_dong", "du": "sau_tnd"},
};

/** Bình luận gắn với từng HÌNH đường giá (vị trí theo nến GỐC 0–29) — luôn là nhiễu; nguồn suy từ tiền tố chữ (demo `themTinHinh`). */
export const HINH_TIN: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  roi_mot_chieu: { 5: "Dự án tuyên bố: mọi thứ vẫn ổn", 17: "Tạm dừng rút tiền" },
  meo_chet_nay: { 8: "Chuyên gia: đáy đã hình thành" },
  sap_gap: { 5: "Tin sốc lúc nửa đêm", 11: "Hội nhóm: \"giá này là cho không\"" },
  bay_hoi_gay_nen: { 6: "Hội nhóm: \"x10 tới nơi\"" },
  ru_chu_v: { 8: "Quỹ lớn bị gọi ký quỹ, bán tháo" },
  day_kep: { 15: "Lãi suất có thể hạ" },
  bat_tran_v: { 6: "Diễn đàn: \"chưa đáy đâu, chờ thêm\"" },
  ru_roi_tang: { 1: "Tin đồn bị điều tra, bán tháo", 15: "Tin đồn đã được bác bỏ" },
  pha_nen_gia: { 7: "Thủng hỗ trợ! Cắt lỗ ngay" },
  parabol_sap: { 10: "Ai cũng đang nói về mã này", 16: "Lượng mua lập kỷ lục" },
  bom_xa: { 4: "Hội nhóm: \"lên thuyền ngay\"", 10: "Nhóm kín bỗng im lặng" },
  bay_vuot_dinh: { 9: "Vượt đỉnh lịch sử!" },
  bo_len_ben: { 8: "Có người chốt lời, giá chững lại", 18: "Báo cáo lãi tăng đều" },
  hai_nhip: { 10: "Chốt lời mạnh, chưa có tin xấu" },
  dinh_tham: { 12: "Ai cũng đang nói về mã này", 19: "Chuyên gia: điều chỉnh lành mạnh" },
  rung_nhe_roi_bung: { 8: "Chuyên gia: \"đà tăng đã gãy\"" },
  tran_lien_tiep: { 6: "Hội nhóm: \"trần liên tiếp, không mua được!\"" },
  tich_luy_but_pha: { 10: "KOL: \"lại sideway, chán quá\"" },
  hoi_ky_thuat: { 7: "Đã thoát đáy? Dòng tiền quay lại" },
  song_ngang: { 6: "Vượt kháng cự!", 18: "Lần này là thật?" },
  song_len: { 9: "Hội nhóm: \"sóng này còn dài\"" },
  song_xuong: { 10: "Chuyên gia: lực bán đã cạn" },
  song_hai_chieu: { 14: "Diễn đàn: \"sắp phá biên rồi\"" },
  giat_hai_dau: { 6: "Hội nhóm: \"vào lệnh theo tôi, chắc thắng\"" },
  song_du: { 8: "Diễn đàn: \"đỉnh rồi, bán hết đi\"", 18: "Hội nhóm: \"đáy rồi, múc\"" },
  quay_dau_lien: { 10: "KOL: \"thị trường điên rồi, đứng ngoài\"" },
  bien_rong: { 6: "Báo: thanh khoản mỏng, giá giật mạnh" },
  no_hai_chieu: { 5: "Hội nhóm: \"tin lớn sắp ra\"" },
  rung_cay: { 7: "KOL: \"đòn bẩy đang bị thanh lý hàng loạt\"" },
  leo_doc: { 10: "Chuyên gia: \"điều chỉnh lành mạnh\"" },
  truot_doc: { 14: "Hội nhóm: \"nạp thêm đi, sắp hồi rồi\"" },
  xuong_roi_hoi: { 9: "Diễn đàn: \"đáy rồi, ai gồng được thì thắng\"" },
  quet_hai_dau: { 8: "Diễn đàn: \"cá mập vừa quét stop\"" },
  ep_roi_sap: { 6: "Hội nhóm: \"ép short đi anh em!\"" },
  roi_deu: { 8: "Chuyên gia: \"đáy đã hình thành\"" },
  ep_khong_dung: { 13: "Diễn đàn: \"phe bán khống sắp cháy\"" },
  dinh_phan_phoi: { 12: "KOL: \"vượt đỉnh là bay tiếp\"" },
  thung_gia: { 8: "Báo: tin xấu đã được phản ánh" },
};

/**
 * D574 — TIN VĨ MÔ của bối cảnh dài hạn (`server/holdem/boi_canh_dai_han.ts` `tinViMoVong`): mỗi trạng thái của hai lớp ẩn năm mẫu, CHÉP
 * NGUYÊN VĂN demo `docs/ui-ux/demo/boi-canh-dai-han.html` (`TIN`) — A11.25. Không tên thật (D570). ID `vm.<trạng thái>.<mẫu>`.
 * ⚠ Độ dài mỗi dòng = `SO_MAU_VI_MO` (config/boi_canh_dai_han.ts) — bài canh `tests/boi_canh_dai_han.test.ts` khoá.
 */
export const VI_MO_TIN = {
  len: ['AI đẩy năng suất nhà máy lên kỷ lục', 'Chip thế hệ mới giảm nửa chi phí điện toán', 'Robot giao hàng phủ khắp 10 thành phố',
    'Đơn hàng phần mềm doanh nghiệp tăng gấp đôi', 'Năng suất lao động lập đỉnh 20 năm'],
  bao_hoa: ['Giá điện thoại giảm năm thứ ba, biên lãi teo tóp', 'Công ty công nghệ cắt 20 % nhân sự', 'Doanh số phần mềm đi ngang sáu quý liền',
    'Cuộc đua giảm giá dịch vụ đám mây bào mòn lợi nhuận', 'Ba năm không có phát minh lớn nào'],
  noi: ['Ngân hàng trung ương giữ lãi thấp thêm hai năm', 'Lãi vay mua nhà xuống đáy 10 năm', 'Tín dụng tiêu dùng tăng 30 %',
    'Doanh nghiệp đảo nợ dễ, phát hành trái phiếu kỷ lục', 'Tiền rẻ chảy vào mọi kênh'],
  cang: ['Nợ doanh nghiệp lên đỉnh 10 năm', 'Lạm phát vượt mục tiêu, ngân hàng trung ương phát tín hiệu siết', 'Lãi suất liên ngân hàng tăng vọt',
    'Ngân hàng siết cho vay tiêu dùng', 'Hàng loạt doanh nghiệp chậm trả lãi trái phiếu'],
} as const satisfies Record<'len' | 'bao_hoa' | 'noi' | 'cang', readonly string[]>;
