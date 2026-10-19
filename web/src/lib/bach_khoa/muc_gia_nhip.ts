/**
 * MỤC BÁCH KHOA — GIÁ & LỆNH · NHỊP CHỢ (D334). Luật chữ: xem `kieu.ts`.
 * Số của trượt giá, chen chúc, phí rút khẩn, đám đông bẻ ô KHÔNG có trong catalog — nên bảng SỐ ở các mục đó bỏ,
 * không gõ tay (A11.5). Mở chúng ra catalog là một việc riêng, có quyết định riêng.
 * Ngoài đời kiểm nguồn 14/09: AP Twitter bị hack 23/4/2013 (Dow −143 điểm, hồi trong vài phút) · Thứ Hai Đen tối
 * 19/10/1987 (Dow −22,6%) · GDP Việt Nam 2020 ≈ 2,9% / quý III-2021 ≈ −6,2% / 2022 ≈ 8%.
 */
import type { MucBK } from './kieu';

export const MUC_GIA_NHIP: readonly MucBK[] = [
  // ═══ GIÁ & LỆNH ════════════════════════════════════════════════════════
  {
    id: 'truot_gia', nhom: 'gia', khoanhKhac: 'truot_gia', ten: 'TRƯỢT GIÁ', anh: 'SLIPPAGE', icon: 'bac_gia',
    nhac: 'Lệnh càng to so với sổ lệnh, giá khớp càng lệch khỏi giá trên bảng.',
    ngoai: 'Giá trên bảng chỉ là giá của vài lệnh bán rẻ nhất đang xếp hàng. Mua nhiều hơn số đó thì phần còn lại khớp ở giá cao hơn — giống mua mười bó rau lúc chợ sắp tan: ba bó đầu giá cũ, những bó sau người bán nâng dần. Giá trung bình bạn trả xấu hơn con số nhìn thấy lúc bấm.',
    viDu: 'Mua 1.000 cổ phiếu khi bên bán chỉ treo 300 cổ ở 20.000đ — 700 cổ còn lại khớp ở 20.100đ, 20.200đ…',
    chuoi: { ten: 'VÌ SAO LỆNH TO THIỆT HƠN LỆNH NHỎ', buoc: ['Ở mỗi mức giá chỉ có một lượng hàng nhất định.', 'Lệnh nhỏ ăn gọn trong mức giá rẻ nhất.', 'Lệnh to ăn hết mức rẻ, leo sang mức đắt hơn.'], ket: 'Lệnh càng to so với lượng hàng đang treo, giá trung bình càng xấu.' },
    doiBan: [
      { doi: 'Có chợ đông người bán, có chợ thưa.', ban: 'Mỗi mã một độ dày sổ — bảng ở mục {thanh_khoan|Thanh khoản}.' },
      { doi: 'Thiệt hại tăng nhanh theo cỡ lệnh so với lượng hàng.', ban: 'Mỗi mã, mỗi vòng có một <b>phần đầu giá rẻ</b> (ngang ngoài đời) — tính trên TỔNG tiền mọi lệnh của mã ấy trong vòng; phần vượt mới bị đẩy giá, càng vượt nhiều càng xấu. Dồn cả vốn trong MỘT vòng vì thế đắt hơn hẳn vào dần qua nhiều vòng, và chia một lệnh to thành nhiều lệnh nhỏ trong cùng vòng không rẻ hơn.' },
      { doi: 'Nhiều người cùng mua một lúc thì hàng rẻ bị giành hết.', ban: 'Nhiều ghế cùng mua một mã ⇒ bảng VÌ SAO thêm dòng {chen_chuc|Chen chúc}.' },
      { doi: 'Chia nhỏ lệnh, hoặc đi nhanh hơn người khác, thì đỡ thiệt.', ban: 'Lá {chia_lenh|Chia Lệnh} cho mốc mịn để vào dần từng phần nhỏ qua các vòng; {khop_nhanh|Khớp Nhanh} làm nhẹ phí.' },
      { doi: 'Sổ lệnh thật có hàng trăm mức giá, đổi từng giây.', ban: 'Bàn chỉ có vài nấc độ dày sổ và một công thức theo cỡ lệnh.', loai: 'gon' },
    ],
    lq: ['thanh_khoan', 'chen_chuc', 'chia_lenh'], khung: 'OECD/INFE · Tiền & giao dịch',
  },
  {
    id: 'thanh_khoan', nhom: 'gia', ten: 'THANH KHOẢN', anh: 'LIQUIDITY', icon: 'giot_nuoc',
    nhac: 'Mua bán nhanh được bao nhiêu mà giá không chạy.',
    ngoai: 'Một thứ "thanh khoản cao" khi lúc nào cũng có người sẵn sàng mua và bán ở giá gần nhau — như vàng nhẫn ở tiệm vàng. Thứ thanh khoản thấp thì ít người hỏi mua: muốn bán gấp thường là bán rẻ — như một mảnh đất ở vùng ít người qua lại.',
    viDu: 'Bán một chỉ vàng mất vài phút; bán một mảnh đất có thể mất vài tháng, và bán trong tuần thì thường chịu hạ giá.',
    chuoi: { ten: 'VÌ SAO LÚC HOẢNG THANH KHOẢN BIẾN MẤT', buoc: ['Ngày thường, người mua và người bán cân nhau.', 'Tin xấu: ai cũng muốn bán, người mua đứng ngoài chờ giá rẻ hơn.', 'Lệnh bán không ai đỡ, giá rơi từng nấc.'], ket: 'Thứ tưởng "bán lúc nào cũng được" bỗng khó bán.', huong: 'xuong' },
    doiBan: [
      { doi: 'Độ dày sổ quyết định bán nhanh có mất giá hay không.', ban: 'Độ dày sổ quyết định mức {truot_gia|trượt giá} gốc của mỗi mã.' },
      { doi: 'Chợ mỏng dễ bị thổi giá.', ban: 'Sổ mỏng căng nhanh hơn: {suc_cang|sức căng} của mã sổ mỏng nạp nhanh hơn mã sổ vừa.' },
      { doi: 'Lúc hưng phấn tiền đổ vào làm chợ đông lên; lúc hoảng người mua biến mất.', ban: 'Độ dày đổi theo tin: {tb_bong_bong|Bong bóng} làm sổ dày thêm; {tb_chien_tranh|Chiến tranh}, {tb_pha_san|Phá sản dây chuyền} làm sổ mỏng đi.' },
    ],
    so: [
      ['Crypto', 'sổ %{ts.btc.thanh_khoan:so}'], ['Cổ tech', 'sổ %{ts.cp_cn.thanh_khoan:so}'], ['Blue-chip', 'sổ %{ts.vn30.thanh_khoan:so}'],
      ['Vàng', 'sổ %{ts.vang.thanh_khoan:so}'], ['Stablecoin', 'sổ %{ts.usd.thanh_khoan:so}'], ['Trái phiếu', 'sổ %{ts.tpcp.thanh_khoan:so}'],
    ],
    lq: ['truot_gia', 'ban_thao', 'crypto'], khung: 'OECD/INFE · Tiền & giao dịch',
  },
  {
    id: 'chen_chuc', nhom: 'gia', khoanhKhac: 'chen_chuc', ten: 'CHEN CHÚC', anh: 'CROWDED TRADE', icon: 'dam_dong',
    nhac: 'Cả bàn ôm cùng một món thì cửa vào đắt, cửa ra hẹp.',
    ngoai: 'Khi quá nhiều người cùng đặt vào một hướng, giá đã chạy trước khi người đến sau kịp vào; lúc mọi người cùng muốn thoát thì không đủ người mua để đỡ. Giống một quán ăn đang nổi: đến sau thì xếp hàng lâu, và nếu có sự cố thì cả trăm người chen nhau ra một cửa.',
    chuoi: { ten: 'VÌ SAO MÓN ĐÔNG NGƯỜI LẠI DỄ VỠ', buoc: ['Ai cũng mua cùng một mã, giá bị đẩy lên trước.', 'Không còn ai ngoài cuộc để mua tiếp.', 'Một tin xấu: tất cả cùng bán một lúc.'], ket: 'Giá rơi mạnh hơn hẳn những mã ít người ôm.', huong: 'xuong' },
    doiBan: [
      { doi: 'Đến sau khi cả đám đã vào thì mua đắt hơn.', ban: 'Nhiều ghế cùng mua một mã trong một vòng ⇒ dòng <b>Chen chúc</b> cộng vào {truot_gia|trượt giá}.' },
      { doi: 'Món cả làng ôm là món dễ vỡ nhất.', ban: 'Cả bàn ôm cùng mã còn đẩy {suc_cang|sức căng} của mã đó lên.' },
      { doi: 'Ngoài đời không ai biết chính xác người khác cầm gì — chỉ thấy tiền vào, tiền ra.', ban: 'Dải ghế trên đầu bàn cho biết vòng trước ai VÀO, ai RA — không cho biết mã nào.' },
      { doi: 'Người nhanh chân vẫn thoát trước được.', ban: 'Lá {khop_nhanh|Khớp Nhanh} được hoàn một phần phạt chen chúc.' },
    ],
    lq: ['phan_than', 'truot_gia', 'di_nguoc'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'ban_thao', nhom: 'gia', ten: 'BÁN THÁO', anh: 'FIRE SALE', icon: 'ban_thao',
    nhac: 'Cả phòng chạy ra một cửa thì không ai bán được giá mình muốn.',
    ngoai: 'Bán tháo là bán gấp toàn bộ, chấp nhận giá xấu để có tiền mặt ngay. Khi nhiều người bán tháo cùng lúc, người mua rút lui và giá rơi sâu hơn cả tin xấu ban đầu — người ta gọi đó là giẫm đạp.',
    chuoi: { ten: 'VÌ SAO BÁN THÁO TỰ LÀM GIÁ RƠI THÊM', buoc: ['Một số người bán gấp, giá rơi.', 'Người khác thấy giá rơi, sợ, bán theo.', 'Người đi vay bị {goi_ky_quy|gọi ký quỹ}, bị bán thay.'], ket: 'Vòng xoáy: giá rơi → bán → giá rơi tiếp.', huong: 'xuong' },
    chuyen: [{ nam: '19/10/1987', noi: 'MỸ', cau: '"Thứ Hai Đen tối": chỉ số Dow Jones mất 22,6% chỉ trong một ngày — cú rơi một ngày lớn nhất lịch sử của nó — khi các lệnh bán dây chuyền đè lên nhau.', so: [['Dow Jones', '−22,6% trong một ngày', 'xuong']] }],
    doiBan: [
      { doi: 'Bán gấp là chấp nhận giá xấu.', ban: 'Nút <b>BỎ</b> rút cả danh mục về tiền mặt trong một nhịp và trả phí rút khẩn.' },
      { doi: 'Càng nhiều người cùng chạy, cửa càng hẹp.', ban: 'Khi nhiều người cùng BỎ trong một vòng, phí rút khẩn nhân đôi.' },
      { doi: 'Tháo chạy liên tục là cách mất tiền nhanh nhất.', ban: 'Số lần BỎ mỗi trận có hạn.', loai: 'luat' },
    ],
    lq: ['chan_lo', 'thanh_khoan', 'khop_nhanh'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },

  // ═══ NHỊP CHỢ ══════════════════════════════════════════════════════════
  {
    id: 'chu_ky', nhom: 'nhip', ten: 'CHU KỲ KINH TẾ', anh: 'BUSINESS CYCLE', icon: 'chu_ky',
    nhac: 'Tăng, chững, giảm, phục hồi — nối nhau thành vòng.',
    ngoai: 'Nền kinh tế không đi thẳng. Nó mở rộng (người ta làm nhiều, tiêu nhiều), quá nóng (giá cả leo, nợ chồng nợ), co lại (công ty cắt giảm, thất nghiệp tăng), rồi hồi phục. Mỗi pha kéo dài nhiều tháng tới vài năm, và mỗi loại tài sản mạnh ở một pha khác nhau.',
    chuoi: { ten: 'VÌ SAO KINH TẾ ĐI THÀNH VÒNG', buoc: ['Kinh tế tốt: người ta vay và tiêu nhiều, công ty mở rộng.', 'Quá đà: giá cả leo, ngân hàng trung ương tăng lãi.', 'Tiền đắt: chi tiêu giảm, công ty cắt giảm — kinh tế co lại.', 'Ngân hàng trung ương hạ lãi, tiền rẻ quay lại.'], ket: 'Kinh tế hồi phục — và một vòng mới bắt đầu.' },
    chuyen: [{ nam: '2020–2022', noi: 'VIỆT NAM', cau: 'Năm 2020 GDP chỉ tăng khoảng 2,9% vì dịch; quý III/2021 giãn cách làm GDP giảm hơn 6%; năm 2022 kinh tế bật lên, tăng hơn 8%.', so: [['GDP 2020', '≈ +2,9%', ''], ['GDP 2022', '≈ +8%', 'len']] }],
    doiBan: [
      { doi: 'Thời gian của kinh tế đo bằng tháng, bằng năm.', ban: 'Dãy ô trên đầu bàn là dòng thời gian: %{tk.O_MOI_NAM:n} ô là một năm. Một vòng mùa dài nhiều năm — có bàn thấy trọn một vòng, có bàn chỉ thấy một khúc.' },
      { doi: 'Pha kinh tế có quán tính: đang tăng thì hay tăng tiếp một thời gian.', ban: 'Ô pha — Tăng · Giảm · Đi ngang · Quá nóng · Phục hồi — đi thành chuỗi, không nhảy loạn.' },
      { doi: 'Không pha nào kéo dài mãi; cú rơi thường nhanh hơn lúc leo.', ban: 'Chuỗi càng dài càng dễ gãy; chuỗi giảm gãy nhanh hơn chuỗi tăng.' },
      { doi: 'Chu kỳ đi qua các mùa theo thứ tự, nhưng không lần nào giống lần nào: có lúc hạ cánh mềm, có lúc rơi hai lần mới đứng dậy.', ban: 'Chợ có một <b>mùa ẩn</b>: PHỤC HỒI → TĂNG → QUÁ NÓNG → SUY THOÁI (lá Giảm) rồi lại phục hồi, có ngã rẽ — hạ cánh mềm, đáy kép, đình trệ. Lá pha phần lớn khớp mùa; tin THẬT đẩy nhanh hay đổi ngã rẽ, tin bịa không đẩy được gì.' },
    ],
    lq: ['tin_dan_dat', 'lai_suat', 'bat_day'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
  {
    id: 'tin_gia', nhom: 'nhip', khoanhKhac: 'tin_gia', ten: 'TIN GIẢ', anh: 'MISINFORMATION', icon: 'tin_gia',
    nhac: 'Nghe rất thật, giá chạy thật, rồi lộ ra là bịa.',
    ngoai: 'Tin giả trong tài chính là tin bịa nhưng đủ giống thật để nhiều người hành động theo: "công ty X sắp được mua lại", "sàn Y sắp sập". Giá chạy theo tin — rồi khi sự thật lộ ra, giá quay về đúng bằng đoạn nó vừa đi, và người vào theo tin chịu lỗ.',
    chuoi: { ten: 'VÌ SAO TIN GIẢ VẪN LÀM GIÁ CHẠY', buoc: ['Tin lan nhanh hơn việc kiểm chứng.', 'Người đọc sợ lỡ cơ hội, mua bán ngay.', 'Giá chạy thật, vì tiền chạy thật.'], ket: 'Sự thật lộ ra ⇒ giá quay đầu; người vào sau cùng lỗ nặng nhất.' },
    chuyen: [{ nam: '23/4/2013', noi: 'MỸ', cau: 'Tài khoản Twitter của hãng tin AP bị hack, đăng tin giả "hai vụ nổ ở Nhà Trắng". Chỉ số Dow Jones mất 143 điểm trong vài phút, rồi hồi lại gần như ngay sau khi tin được đính chính.', so: [['Dow Jones', '−143 điểm trong vài phút', 'xuong']] }],
    doiBan: [
      { doi: 'Tin giả vẫn làm giá chạy, rồi đảo chiều khi bị lộ.', ban: 'Có ô tin là tin bịa: vòng nó nổ giá vẫn chạy, <b>vòng sau đảo ngược</b>.' },
      { doi: 'Nhìn bề ngoài không phân biệt được tin thật hay giả.', ban: '{tinh_chat|Huy hiệu} góc ô nói KIỂU tác động của tin, không nói thật hay bịa.' },
      { doi: 'Tin khớp với diễn biến đang có thường đáng tin hơn tin xuất hiện đơn độc.', ban: 'Tin nối đúng {day_chuyen|dây chuyền} ít khi là tin bịa hơn tin đứng một mình.' },
      { doi: 'Công bố chính thức (lãi suất, chỉ số giá) khó bịa; tin đồn về sàn, về chiến sự dễ bịa.', ban: 'Mỗi loại thẻ bị làm giả nhiều ít khác nhau — ghi ở từng thẻ, ví dụ {tb_sap_san|Sàn khoá rút tiền}.' },
    ],
    lq: ['hieu_chinh', 'tinh_chat', 'luot_song'], khung: 'OECD/INFE · Bối cảnh tài chính — thông tin sai, lừa đảo · Kỹ năng LỌC TIN',
  },
  {
    id: 'tin_dan_dat', nhom: 'nhip', ten: 'TIN DẪN DẮT', anh: 'LEADING SIGNAL', icon: 'ong_gio',
    nhac: 'Tin hôm nay làm chuyện tiếp theo dễ xảy ra hơn.',
    ngoai: 'Có những tin không tác động hết ngay mà làm việc khác dễ xảy ra hơn: tăng lãi suất hay đi trước một đoạn kinh tế chậm lại, hạ lãi suất hay đi trước một đoạn đi lên. Người theo dõi "chỉ báo dẫn dắt" đọc được hướng gió trước khi gió tới — như thấy mây đen thì biết có thể sắp mưa, dù chưa chắc mưa.',
    chuoi: { ten: 'VÌ SAO TIN HÔM NAY BÁO TRƯỚC NGÀY MAI', buoc: ['Ngân hàng trung ương tăng lãi.', 'Doanh nghiệp hoãn vay để mở rộng; người mua nhà chờ thêm.', 'Vài tháng sau, đơn hàng và việc làm giảm dần.'], ket: 'Tin đi trước, hệ quả tới sau.' },
    doiBan: [
      { doi: 'Mây đen báo mưa nhưng không chắc mưa.', ban: 'Tin <b>thật</b> làm pha của ô kế <b>nghiêng</b> về một phía — gạch màu dưới chân ô còn úp chỉ phía nó nghiêng. Mỗi thẻ báo trước pha nào: ghi ở từng thẻ.' },
      { doi: 'Tin bịa thì lời báo cũng vô nghĩa.', ban: 'Tin {tin_gia|bịa} thì lời báo không có gì bảo đảm.' },
      { doi: 'Ngân hàng trung ương đổi lãi bất thường thường vì có chuyện lớn.', ban: 'Đổi lãi <b>ngoài lịch</b> thường báo trước một cú sốc lớn.' },
      { doi: 'Nhìn lại những gì đã xảy ra giúp nhận ra quy luật.', ban: 'SỔ LIÊN HỆ ghi lại những cú kéo bạn đã đi qua.' },
    ],
    lq: ['day_chuyen', 'chu_ky', 'tb_tang_lai'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
  {
    id: 'day_chuyen', nhom: 'nhip', khoanhKhac: 'day_chuyen', ten: 'DÂY CHUYỀN', anh: 'CONTAGION', icon: 'domino',
    nhac: 'Sự kiện này kéo sự kiện kia qua từng mắt xích.',
    ngoai: 'Trong kinh tế, chuyện này kéo chuyện kia: tiền rẻ thổi bong bóng, bong bóng khiến nhà chức trách siết, siết làm bong bóng sập. Năm 2008, những khoản vay mua nhà xấu ở Mỹ kéo đổ ngân hàng khắp thế giới theo đúng kiểu nối nhau như vậy.',
    chuoi: { ten: 'MỘT CHUỖI QUEN THUỘC', buoc: ['Chiến tranh nổ ra, giá dầu vọt lên.', 'Xăng dầu đắt kéo giá mọi thứ lên — lạm phát nóng.', 'Ngân hàng trung ương tăng lãi để dập lạm phát.'], ket: 'Tiền đắt làm lộ những chỗ vay quá tay.' },
    doiBan: [
      { doi: 'Chuyện đã xảy ra làm chuyện kế dễ xảy ra hơn.', ban: 'Sau một thẻ tin THẬT, những thẻ hay đi theo nó được rút nhiều hơn — ghi "hay kéo theo" ở từng thẻ, ví dụ {tb_chien_tranh|Chiến tranh}.' },
      { doi: 'Chuyện bịa không đẻ ra hệ quả thật.', ban: 'Chỉ tin THẬT mới kéo dây chuyền; tin bịa không kéo gì theo.', loai: 'luat' },
      { doi: 'Người đọc được chuỗi thì chuẩn bị trước.', ban: 'Bảng VÌ SAO chấm bạn bám đúng dây hay nhầm dây; lá {luot_song|Lướt Sóng} được chấm theo nó.' },
    ],
    lq: ['tin_dan_dat', 'tb_pha_san', 'luot_song'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
  {
    id: 'suc_cang', nhom: 'nhip', khoanhKhac: 'suc_cang', ten: 'BONG BÓNG & SỨC CĂNG', anh: 'BUBBLE PRESSURE', icon: 'dong_ho_ap',
    nhac: 'Tăng lâu không nghỉ thì tích căng; quay đầu là bung.',
    ngoai: 'Giá leo càng lâu không nghỉ, càng nhiều người vào bằng tiền vay và càng ít người còn đứng ngoài để mua tiếp. Thị trường giống sợi dây chun bị kéo: kéo càng xa, lúc buông càng bật mạnh. Dân đầu tư có câu: giá lên bằng cầu thang, xuống bằng thang máy.',
    chuoi: { ten: 'VÌ SAO RƠI NHANH HƠN LEO', buoc: ['Giá leo từ từ vì người mua vào dần từng đợt.', 'Nhiều người mua bằng tiền vay.', 'Giá quay đầu: người vay bị gọi ký quỹ, buộc bán cùng lúc.'], ket: 'Vài ngày rơi bằng nhiều tháng leo.', huong: 'xuong' },
    doiBan: [
      { doi: 'Căng tích dần qua những đoạn tăng liên tiếp — nhanh hơn khi tiền vừa rẻ đi.', ban: 'Mỗi mã tích sức căng qua các ô Tăng — nhanh hơn ở sổ mỏng và ngay sau khi hạ lãi.' },
      { doi: 'Không ai đo chính xác được bong bóng, chỉ thấy nó "nóng" tới đâu.', ban: 'Ba dải công bố: <b>ÊM · CĂNG · RẤT CĂNG</b>; con số sức căng thì giấu.' },
      { doi: 'Thứ leo cao nhất rơi đau nhất.', ban: 'Lúc quay đầu, mã căng nhất chịu đòn nặng nhất — nặng hơn hẳn phần nó đã thưởng.' },
      { doi: 'Đám đông cùng ôm một thứ làm nó căng thêm.', ban: '{chen_chuc|Chen chúc} đẩy sức căng của mã lên.' },
    ],
    so: [['Dải CĂNG', 'từ %{luat.DAI_CANG_BP:pc}'], ['Dải RẤT CĂNG', 'từ %{luat.DAI_RAT_CANG_BP:pc}']],
    lq: ['tb_bong_bong', 'chen_chuc', 'don_bay'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'phan_than', nhom: 'nhip', ten: 'ĐÁM ĐÔNG BẺ CHỢ', anh: 'REFLEXIVITY', icon: 'vong_lap',
    nhac: 'Khi ai cũng tin một hướng, chính niềm tin ấy làm chợ đổi hướng.',
    ngoai: 'Nhà đầu tư George Soros gọi là "phản thân": người ta mua vì tin giá sẽ lên, và chính việc mua ồ ạt làm rủi ro dồn lại tới lúc thị trường quay đầu. Đám đông không chỉ đoán thị trường — nó là một phần của thị trường. Giống cả làng đổ xô trồng một loại cây vì đang được giá: tới mùa hàng quá nhiều, giá sập.',
    chuoi: { ten: 'VÌ SAO ĐOÁN ĐÚNG LẠI THÀNH SAI', buoc: ['Ai cũng tin giá lên, ai cũng mua.', 'Giá bị đẩy cao hơn giá trị, rủi ro dồn lại.', 'Không còn người mua mới; một cú đẩy nhỏ là đủ.'], ket: 'Chợ đi ngược đúng điều đám đông tin.' },
    doiBan: [
      { doi: 'Ngoài đời đám đông luôn là một phần của chợ; trên bàn luật này tắt để chu kỳ kể được trọn.', ban: 'Trận thật <b>không</b> có luật này: bản đồ chỉ do seed quyết, không ai đổi được lá. Chỉ bàn tập còn giữ — các dòng dưới là luật của bàn tập.', loai: 'luat' },
      { doi: 'Đám đông dồn một phía đủ lâu thì tự làm phía đó yếu đi.', ban: 'Phần lớn bàn dồn một phe hai vòng liền ⇒ ô sắp lật <b>có thể</b> bị thay.' },
      { doi: 'Dồn hết vào rủi ro thì dễ gặp đòn; trốn hết vào nơi trú thì chợ dễ bật lên.', ban: 'Dồn rủi ro ⇒ ô dễ thành Tăng lãi suất, Sàn khoá rút tiền hoặc Giảm. Trốn vào trú ẩn ⇒ ô dễ thành Hạ lãi suất hoặc Phục hồi.' },
      { doi: 'Lịch họp của ngân hàng trung ương thì đám đông không đổi được.', ban: 'Ô ⚖ KỲ HỌP không bị thay: lịch đã công bố là lịch.' },
      { doi: 'Biết đám đông vừa làm đổi chợ là một bài học.', ban: 'Chợ nói thật khi đổi: chân ô ghi <b>%{nhan.o_doi:chu}</b>.' },
    ],
    lq: ['chen_chuc', 'di_nguoc', 'suc_cang'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
];
