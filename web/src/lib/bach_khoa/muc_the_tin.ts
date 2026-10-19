/**
 * MỤC BÁCH KHOA — THẺ TIN (11 mặt đang chạy) + huy hiệu tính chất + thiên nga đen (D334).
 *
 * ⚠ MỨC, KHÔNG PHẢI SỐ (founder 25/07): bảng đòn sáu mã của mỗi thẻ vẽ từ `tu_dien.tai_san[].su_kien` — cùng thang
 * rất khoẻ → rất yếu với tờ (!) trong trận; tính chất · báo trước · hay kéo theo · độ giả vẽ từ `bach_khoa.the_tin`.
 * Chữ ở đây chỉ mang LÝ DO ngoài đời, không nhắc lại mức (nhắc lại là bản sao thứ hai — A11.5).
 * Ngoài đời kiểm nguồn 14/09: NHNN 2020 (ba lần hạ, tái cấp vốn 6% → 4%) · NHNN 23/9 và 25/10/2022 (4% → 6%) ·
 * xăng RON95 32.873đ (21/6/2022) · CPI Mỹ 9,1% (6/2022) · FTX 11/2022 · Lehman 9/2008 · Tōhoku 3/2011 · bão Yagi 9/2024.
 */
import type { MucBK } from './kieu';

export const MUC_THE_TIN: readonly MucBK[] = [
  {
    id: 'tb_ha_lai', nhom: 'the', suKien: 'ha_lai_suat', ten: 'HẠ LÃI SUẤT', anh: 'RATE CUT', icon: 'tb_ha_lai',
    nhac: 'Tiền rẻ đi: gửi tiết kiệm bớt lời, vay rẻ hơn — tiền đi tìm chỗ sinh lời.',
    ngoai: 'Ngân hàng trung ương hạ lãi suất điều hành để đỡ nền kinh tế lúc nó yếu. Ngân hàng thương mại vay rẻ hơn, liền hạ lãi cho vay và lãi tiết kiệm. Báo chí quốc tế gọi phe muốn hạ lãi là "chim bồ câu".',
    chuoi: { ten: 'VÌ SAO HẠ LÃI THÌ CHỨNG KHOÁN, CRYPTO LÊN', buoc: ['Gửi tiết kiệm chỉ còn lãi thấp.', 'Người có tiền nhàn rỗi đi tìm chỗ lời hơn: cổ phiếu, crypto, đất.', 'Doanh nghiệp và người mua nhà vay rẻ hơn, chi tiêu nhiều hơn.'], ket: 'Tiền đổ vào tài sản rủi ro ⇒ giá lên.', huong: 'len' },
    nhung: 'Hạ lãi giữa lúc người ta đang sợ thì chưa đẩy được giá lên — tiền rẻ chỉ có tác dụng khi còn người dám mua. Chuyện tháng 3/2020 ở mục {lai_suat|Lãi suất}.',
    chuyen: [{ nam: '2020–2021', noi: 'VIỆT NAM', cau: 'Năm 2020 Ngân hàng Nhà nước hạ lãi suất điều hành ba lần, lãi tái cấp vốn từ 6% xuống 4%. Năm 2021 hơn 1,5 triệu tài khoản chứng khoán mới được mở.', so: [['VN-Index năm 2021', '+35,7%', 'len']] }],
    doiBan: [
      { doi: 'Tiền rẻ nâng gần như mọi tài sản rủi ro; đô la mất sức hút.', muc: { loai: 'sk_ma', sk: 'ha_lai_suat', ma: ['btc', 'cp_cn', 'usd'] } },
      { doi: 'Lãi thấp làm tờ trái phiếu cũ trả lãi cao đáng giá hơn.', muc: { loai: 'sk_ma', sk: 'ha_lai_suat', ma: ['tpcp'] } },
      { doi: 'Hạ lãi thường đi trước một đoạn kinh tế đi lên.', luatThe: 'bao_truoc' },
      { doi: 'Tiền rẻ kéo dài hay thổi bong bóng.', luatThe: 'keo_theo' },
      { doi: 'Quyết định lãi suất là công bố chính thức, khó làm giả.', luatThe: 'do_gia' },
    ],
    lq: ['lai_suat', 'tb_tang_lai', 'suc_cang'], khung: 'GDKT&PL 10 · Tín dụng',
  },
  {
    id: 'tb_tang_lai', nhom: 'the', suKien: 'tang_lai_suat', ten: 'TĂNG LÃI SUẤT', anh: 'RATE HIKE', icon: 'tb_tang_lai',
    nhac: 'Tiền đắt lên: gửi tiết kiệm lời hơn, vay đắt hơn — tiền rút khỏi chỗ rủi ro.',
    ngoai: 'Ngân hàng trung ương tăng lãi suất để hãm lạm phát: vay tiền đắt lên thì người ta bớt vay, bớt tiêu, giá cả thôi leo nhanh. Phe muốn tăng lãi được gọi là "diều hâu".',
    chuoi: { ten: 'VÌ SAO TĂNG LÃI THÌ CHỢ NẶNG', buoc: ['Gửi tiết kiệm được lãi cao và chắc chắn.', 'Cổ phiếu, crypto chỉ giữ chân được người mua nếu hứa lời nhiều hơn thế.', 'Người vay ký quỹ trả lãi đắt hơn, bán bớt để trả nợ.'], ket: 'Tiền rút khỏi tài sản rủi ro ⇒ giá xuống.', huong: 'xuong' },
    nhung: 'Tăng lãi đúng lúc lạm phát đang nóng là chữa đúng bệnh: thị trường có khi nhẹ nhõm vì biết ngân hàng đã ra tay, và cú rơi nhẹ hơn dự đoán.',
    chuyen: [{ nam: '2022', noi: 'VIỆT NAM', cau: 'Tháng 9 và tháng 10/2022, Ngân hàng Nhà nước tăng lãi suất điều hành hai lần, mỗi lần 1 điểm phần trăm (lãi tái cấp vốn từ 4% lên 6%).', so: [['VN-Index năm 2022', '−32,8%', 'xuong']] }],
    doiBan: [
      { doi: 'Tiền đắt đánh gần hết tài sản rủi ro; đô la mạnh lên.', muc: { loai: 'sk_ma', sk: 'tang_lai_suat', ma: ['btc', 'cp_cn', 'usd'] } },
      { doi: 'Lãi mới cao hơn làm tờ trái phiếu cũ mất giá.', muc: { loai: 'sk_ma', sk: 'tang_lai_suat', ma: ['tpcp'] } },
      { doi: 'Tăng lãi thường đi trước một đoạn kinh tế chậm lại.', luatThe: 'bao_truoc' },
      { doi: 'Tiền đắt làm lộ những chỗ vay quá tay — sàn yếu, công ty yếu đổ trước.', luatThe: 'keo_theo' },
      { doi: 'Lịch họp về lãi suất được công bố trước.', ban: 'Phần lớn thẻ lãi suất nằm ở ô ⚖ KỲ HỌP — xem {lai_suat|Lãi suất}.' },
    ],
    lq: ['lai_suat', 'tb_ha_lai', 'tb_lam_phat'], khung: 'GDKT&PL 10 · Tín dụng',
  },
  {
    id: 'tb_sap_san', nhom: 'the', suKien: 'hack_san', ten: 'SÀN KHOÁ RÚT TIỀN', anh: 'EXCHANGE COLLAPSE', icon: 'tb_sap_san',
    nhac: 'Một sàn giao dịch sụp đổ — tiền khách kẹt lại, niềm tin vào cả nhóm tài sản ấy lung lay.',
    ngoai: 'Sàn giao dịch giữ tiền và tài sản của khách. Nếu sàn bị hack, bị rút ruột hay dùng tiền khách sai mục đích, nó có thể sụp chỉ trong vài ngày: khách không rút được tiền, và người ta đổ xô khỏi mọi thứ dính tới sàn đó.',
    chuoi: { ten: 'VÌ SAO MỘT SÀN SẬP KÉO CẢ CHỢ CRYPTO', buoc: ['Tin sàn không trả nổi tiền cho khách lan ra.', 'Khách ở các sàn khác sợ chuyện tương tự, rút tiền ồ ạt.', 'Người ta bán crypto, bán cả stablecoin để lấy tiền thật.'], ket: 'Crypto rơi mạnh; vàng — thứ không nằm trên sàn nào — được tìm đến.' },
    chuyen: [{ nam: '11/2022', noi: 'THẾ GIỚI', cau: 'Sàn FTX — từng thuộc nhóm sàn crypto lớn nhất thế giới — sụp đổ trong khoảng một tuần; hơn một triệu khách không rút được tiền.' }],
    doiBan: [
      { doi: 'Crypto sống trên sàn; stablecoin là giấy nợ nằm trên sàn; cổ phiếu công nghệ là thứ bị bán trước khi chợ cạn tiền.', muc: { loai: 'sk_ma', sk: 'hack_san', ma: ['btc', 'usd', 'cp_cn'] } },
      { doi: 'Vàng không nằm trên sàn nào.', muc: { loai: 'sk_ma', sk: 'hack_san', ma: ['vang'] } },
      { doi: 'Mỗi cú sập chỉ đánh nhóm tài sản dính tới nó, không đánh đều cả chợ.', luatThe: 'tinh_chat' },
      { doi: 'Tin "sàn sắp sập" hay là tin đồn — và loại tin đồn này lan cực nhanh.', luatThe: 'do_gia' },
    ],
    lq: ['crypto', 'usdt', 'tin_gia'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'tb_lam_phat', nhom: 'the', suKien: 'lam_phat', ten: 'LẠM PHÁT NÓNG', anh: 'INFLATION SHOCK', icon: 'tb_lam_phat',
    nhac: 'Giá cả leo nhanh: tiền mặt và khoản lãi cố định mất sức mua.',
    ngoai: 'Lạm phát nóng là lúc giá cả tăng nhanh bất thường — xăng, gạo, tiền nhà cùng leo. Nó thường tới từ ba nguồn: tiền trong dân quá nhiều so với hàng hoá; chi phí sản xuất bị đẩy lên; và khi ai cũng tin giá còn tăng, người bán tăng giá trước.',
    chuoi: [
      { ten: 'TIỀN NHIỀU HƠN HÀNG', buoc: ['Tiền rẻ kéo dài, người ta vay nhiều, tiêu nhiều.', 'Nhu cầu tăng nhanh hơn lượng hàng làm ra.'], ket: 'Người bán tăng giá.' },
      { ten: 'CHI PHÍ BỊ ĐẨY LÊN', buoc: ['Chiến tranh, cấm vận làm giá dầu vọt lên.', 'Sản xuất và chở hàng đắt hơn.'], ket: 'Giá mọi thứ leo theo.' },
    ],
    nhung: 'Lãi suất là liều thuốc chính: tăng lãi để người ta bớt vay, bớt tiêu. Nhưng thuốc ngấm chậm — thường mất nhiều tháng — và nếu lạm phát do xăng dầu đắt thì tăng lãi không làm dầu rẻ đi.',
    chuyen: [{ nam: '6/2022', noi: 'VIỆT NAM · MỸ', cau: 'Chiến sự Nga–Ukraine đẩy giá dầu thế giới: xăng RON95 trong nước có lúc gần 32.900 đồng một lít. Cùng tháng, lạm phát ở Mỹ lên 9,1% — cao nhất khoảng 40 năm — và Mỹ tăng lãi suất dồn dập.', so: [['Xăng RON95', '≈ 32.900đ/lít', 'len'], ['Lạm phát Mỹ', '9,1%', '']] }],
    doiBan: [
      { doi: 'Lạm phát ăn khoản lãi cố định: tờ trái phiếu trả 3% vô nghĩa khi giá cả tăng 9%.', muc: { loai: 'sk_ma', sk: 'lam_phat', ma: ['tpcp'] } },
      { doi: 'Người ta tìm tới vàng và những thứ không in thêm được; cổ phiếu công nghệ khổ vì lạm phát kéo lãi suất lên.', muc: { loai: 'sk_ma', sk: 'lam_phat', ma: ['vang', 'btc', 'cp_cn'] } },
      { doi: 'Tiền mặt nằm im vẫn mất sức mua.', ban: 'Tiền mặt mất một miếng ngay khi thẻ nổ — xem {lam_phat|Lạm phát}.' },
      { doi: 'Lạm phát cao thì ngân hàng trung ương tăng lãi; và kỳ vọng giá tăng tự nuôi lạm phát.', luatThe: 'keo_theo' },
      { doi: 'Chỉ số giá do cơ quan thống kê công bố, khó bịa.', luatThe: 'do_gia' },
    ],
    lq: ['lam_phat', 'tb_tang_lai', 'tpm'], khung: 'GDKT&PL 11 · Lạm phát',
  },
  {
    id: 'tb_chien_tranh', nhom: 'the', suKien: 'chien_tranh', ten: 'CHIẾN TRANH', anh: 'WAR', icon: 'tb_chien_tranh',
    nhac: 'Nỗi sợ lớn nhất của thị trường: cổ phiếu rơi, tiền chạy về vàng và đô la.',
    ngoai: 'Chiến tranh làm đứt chuỗi cung ứng, đẩy giá dầu và lương thực lên, và khiến tương lai của rất nhiều công ty mù mờ hẳn đi. Khi không ai biết chuyện gì xảy ra tiếp theo, người ta bán thứ rủi ro và giữ thứ an toàn.',
    chuoi: { ten: 'VÌ SAO CHIẾN TRANH ĐẨY VÀNG LÊN', buoc: ['Tin chiến sự nổ ra.', 'Người ta bán cổ phiếu vì không đoán nổi lợi nhuận công ty.', 'Tiền tìm nơi trú: vàng, đô la, trái phiếu Mỹ.'], ket: 'Tài sản trú ẩn lên, tài sản rủi ro xuống.' },
    chuyen: [{ nam: '2/2022', noi: 'THẾ GIỚI', cau: 'Nga tấn công Ukraine. Giá dầu và vàng vọt lên, nhiều nước cấm vận Nga, cổ phiếu toàn cầu lao dốc.' }],
    doiBan: [
      { doi: 'Chiến tranh là nỗi sợ chung, đánh vào mọi thứ rủi ro.', muc: { loai: 'sk_ma', sk: 'chien_tranh', ma: ['cp_cn', 'vn30', 'btc'] } },
      { doi: 'Tiền chạy về nơi trú.', muc: { loai: 'sk_ma', sk: 'chien_tranh', ma: ['vang', 'usd', 'tpcp'] } },
      { doi: 'Chiến tranh đẩy giá dầu, đẩy lạm phát, và kéo theo cấm vận.', luatThe: 'keo_theo' },
      { doi: 'Tin đồn chiến sự lan nhanh và hay bị thổi phồng.', luatThe: 'do_gia' },
    ],
    lq: ['vang', 'tb_cam_van', 'tb_lam_phat'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
  {
    id: 'tb_bong_bong', nhom: 'the', suKien: 'bong_bong', ten: 'BONG BÓNG', anh: 'BUBBLE', icon: 'tb_bong_bong',
    nhac: 'Giá bị thổi xa khỏi giá trị vì người mua trông vào người mua sau.',
    ngoai: 'Bong bóng là lúc giá một thứ tăng rất nhanh, không phải vì nó làm ra nhiều giá trị hơn, mà vì ai cũng tin sẽ có người mua lại ở giá cao hơn. Cuộc vui kéo dài tới lúc không còn người mua mới.',
    chuoi: { ten: 'MỘT BONG BÓNG PHỒNG RỒI VỠ', buoc: ['Tiền rẻ, tin tốt: giá bắt đầu tăng.', 'Người thấy người khác lời, vay thêm để vào.', 'Giá tăng nhờ người mua mới, không nhờ giá trị thật.'], ket: 'Hết người mua mới ⇒ giá gãy, rơi nhanh hơn lúc leo.', huong: 'xuong' },
    chuyen: [{ nam: '2000–2002', noi: 'MỸ', cau: 'Bong bóng cổ phiếu Internet vỡ: chỉ số Nasdaq mất khoảng 78% từ đỉnh tháng 3/2000 tới đáy tháng 10/2002.', so: [['Nasdaq', '≈ −78%', 'xuong']] }],
    doiBan: [
      { doi: 'Lúc bong bóng phồng, tiền rời chỗ an toàn để đổ vào chỗ nóng.', muc: { loai: 'sk_ma', sk: 'bong_bong', ma: ['btc', 'cp_cn', 'vn30', 'vang'] } },
      { doi: 'Bong bóng hay đi sau một giai đoạn tiền rẻ, và đi trước một đoạn giá còn chạy.', luatThe: 'bao_truoc' },
      { doi: 'Bong bóng kết thúc bằng ngân hàng trung ương dập lửa, hoặc bằng một cú sập.', luatThe: 'keo_theo' },
      { doi: 'Lời đồn "bong bóng" giữa lúc tiền đắt thường là thổi phồng; lúc tiền rẻ thì hay là thật.', luatThe: 'do_gia' },
      { doi: 'Bong bóng thật cũng có thể xì hơi từ từ.', ban: 'Trên bàn bong bóng chỉ có hai kết cục: phồng tiếp hoặc vỡ.', loai: 'gon' },
    ],
    lq: ['suc_cang', 'mua_duoi', 'tb_ha_lai'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'tb_phap_ly', nhom: 'the', suKien: 'phap_ly', ten: 'SIẾT PHÁP LÝ', anh: 'CRACKDOWN', icon: 'tb_phap_ly',
    nhac: 'Nhà chức trách ra tay: cấm, phạt, điều tra — nhóm tài sản bị nhắm rơi mạnh.',
    ngoai: 'Khi thị trường có dấu hiệu làm giá, lừa đảo hay rủi ro lan rộng, cơ quan quản lý có thể siết luật: cấm một kiểu giao dịch, điều tra, bắt người. Nhóm tài sản bị nhắm tới rơi mạnh vì luật chơi của nó đổi chỉ sau một đêm.',
    chuoi: { ten: 'VÌ SAO SIẾT LUẬT LÀM GIÁ RƠI', buoc: ['Một vụ bê bối hay làm giá bị phát hiện.', 'Nhà chức trách cấm, phạt, điều tra.', 'Người đang giữ lo tài sản của mình bị đóng băng hay khó bán.'], ket: 'Nhóm bị nhắm bị bán tháo; tiền chuyển sang chỗ không bị soi.' },
    chuyen: [
      { nam: '9/2021', noi: 'TRUNG QUỐC', cau: 'Ngân hàng Trung ương Trung Quốc tuyên bố mọi giao dịch tiền mã hoá là bất hợp pháp; giá crypto rơi ngay trong ngày.' },
      { nam: '2022', noi: 'VIỆT NAM', cau: 'Nhiều vụ thao túng cổ phiếu và sai phạm phát hành trái phiếu doanh nghiệp bị khởi tố; thị trường trái phiếu doanh nghiệp gần như đóng băng.' },
    ],
    doiBan: [
      { doi: 'Crypto, công ty công nghệ lớn và stablecoin là nơi luật hay nhắm tới nhất.', muc: { loai: 'sk_ma', sk: 'phap_ly', ma: ['btc', 'cp_cn', 'usd'] } },
      { doi: 'Tiền rời chỗ bị soi, về chỗ an toàn.', muc: { loai: 'sk_ma', sk: 'phap_ly', ma: ['vang', 'tpcp'] } },
      { doi: 'Người ôm quá nhiều một mã lúc bị điều tra là người bị hỏi đầu tiên.', ban: 'Ghế {doi_lai|Đội Lái} ôm vị thế to lúc thẻ này nổ thì bị trừ thẳng vốn.' },
      { doi: 'Sau khi siết, chính phủ hay nới tiền để đỡ kinh tế.', luatThe: 'keo_theo' },
    ],
    lq: ['doi_lai', 'crypto', 'thien_nga'], khung: 'OECD/INFE · Bối cảnh tài chính — thông tin sai, lừa đảo',
  },
  {
    id: 'tb_pha_san', nhom: 'the', suKien: 'pha_san', ten: 'PHÁ SẢN DÂY CHUYỀN', anh: 'CONTAGION', icon: 'tb_pha_san',
    nhac: 'Một tổ chức lớn đổ, kéo theo những ai đang cho nó vay hoặc giữ tiền ở đó.',
    ngoai: 'Ngân hàng, quỹ, công ty lớn cho nhau vay và giữ tiền của nhau. Khi một mắt xích lớn phá sản, những bên có tiền ở đó cũng lung lay, rồi tới lượt người gửi tiền ở các bên ấy — như một hàng domino.',
    chuoi: { ten: 'VÌ SAO MỘT CÚ ĐỔ LAN RỘNG', buoc: ['Ngân hàng A phá sản, không trả được nợ.', 'Ngân hàng B cho A vay nhiều — giờ B cũng thiếu tiền.', 'Người gửi tiền ở B hoảng, rút tiền ồ ạt.'], ket: 'Nỗi sợ lan khắp hệ thống; ai cũng ôm tiền mặt.' },
    chuyen: [{ nam: '9/2008', noi: 'MỸ', cau: 'Ngân hàng đầu tư Lehman Brothers phá sản. Khủng hoảng lan sang ngân hàng khắp thế giới, kéo nhiều nền kinh tế vào suy thoái.' }],
    doiBan: [
      { doi: 'Cú đổ dây chuyền đánh vào mọi thứ dựa trên vay nợ và niềm tin.', muc: { loai: 'sk_ma', sk: 'pha_san', ma: ['btc', 'cp_cn', 'vn30'] } },
      { doi: 'Lúc hệ thống ngân hàng lung lay, người ta chạy về trái phiếu chính phủ.', muc: { loai: 'sk_ma', sk: 'pha_san', ma: ['tpcp'] } },
      { doi: 'Stablecoin gửi tiền ở ngân hàng — ngân hàng đổ thì neo rung, không khoẻ như đô la thật.', muc: { loai: 'sk_ma', sk: 'pha_san', ma: ['usd'] } },
      { doi: 'Để chặn cú lan, ngân hàng trung ương hạ lãi và bơm tiền.', luatThe: 'keo_theo' },
    ],
    lq: ['day_chuyen', 'tpm', 'thien_nga'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
  {
    id: 'tb_cam_van', nhom: 'the', suKien: 'cam_van', ten: 'CẤM VẬN', anh: 'SANCTIONS', icon: 'tb_cam_van',
    nhac: 'Một nước bị chặn buôn bán và chặn tiền — hàng hoá đắt lên, tiền chạy về vàng.',
    ngoai: 'Cấm vận là khi nhiều nước cùng chặn buôn bán, chặn giao dịch tiền với một nước khác. Hàng hoá từ nước đó (dầu, khí, lúa mì…) khan hiếm và đắt lên; tài sản của nước bị cấm vận gửi ở nước ngoài có thể bị đóng băng.',
    chuoi: { ten: 'VÌ SAO CẤM VẬN ĐẨY GIÁ VÀNG', buoc: ['Dự trữ bằng đô la của một quốc gia bị đóng băng.', 'Các nước khác lo chuyện tương tự xảy ra với mình.', 'Họ mua thêm vàng — thứ không ai đóng băng hộ được.'], ket: 'Giá vàng lên.', huong: 'len' },
    chuyen: [{ nam: '2022', noi: 'THẾ GIỚI', cau: 'Mỹ và châu Âu đóng băng phần lớn dự trữ ngoại hối của Nga và loại nhiều ngân hàng Nga khỏi hệ thống thanh toán quốc tế SWIFT. Cả năm, các ngân hàng trung ương mua vàng nhiều kỷ lục.' }],
    doiBan: [
      { doi: 'Cấm vận làm buôn bán chậm lại, lợi nhuận công ty giảm.', muc: { loai: 'sk_ma', sk: 'cam_van', ma: ['btc', 'cp_cn', 'vn30'] } },
      { doi: 'Vàng và đô la là nơi trú.', muc: { loai: 'sk_ma', sk: 'cam_van', ma: ['vang', 'usd'] } },
      { doi: 'Cấm vận bằng đô la làm nhiều nước dè chừng tài sản bằng đô la, kể cả trái phiếu Mỹ.', muc: { loai: 'sk_ma', sk: 'cam_van', ma: ['tpcp'] } },
      { doi: 'Hàng hoá khan hiếm đẩy giá cả lên.', luatThe: 'keo_theo' },
    ],
    lq: ['vang', 'tb_chien_tranh', 'tb_lam_phat'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
  {
    id: 'tb_tham_hoa', nhom: 'the', suKien: 'tham_hoa', ten: 'THẢM HOẠ TỰ NHIÊN', anh: 'NATURAL DISASTER', icon: 'tb_tham_hoa',
    nhac: 'Bão, động đất, lũ — nhà máy ngừng, chuỗi cung ứng đứt, giá hàng hoá lên.',
    ngoai: 'Thảm hoạ tự nhiên phá nhà máy, cảng, đường sá. Công ty ở vùng bị ảnh hưởng mất doanh thu, hàng hoá thiếu hụt đẩy giá lên, và chính phủ chi tiền tái thiết.',
    chuoi: { ten: 'VÌ SAO BÃO LŨ ĐẨY GIÁ CẢ', buoc: ['Nhà máy, ruộng đồng, cảng biển hư hại.', 'Hàng làm ra ít đi trong khi nhu cầu vẫn còn nguyên.', 'Nguyên liệu, linh kiện thiếu; chở hàng đắt hơn.'], ket: 'Giá cả tăng; kinh tế vùng đó chậm lại.' },
    chuyen: [
      { nam: '3/2011', noi: 'NHẬT BẢN', cau: 'Động đất và sóng thần Tōhoku làm tê liệt nhiều nhà máy linh kiện; ngành ô tô, điện tử toàn cầu thiếu hàng suốt nhiều tháng.' },
      { nam: '9/2024', noi: 'VIỆT NAM', cau: 'Bão Yagi tàn phá nhiều tỉnh miền Bắc; ruộng rau ngập, giá rau xanh ở Hà Nội tăng vọt trong nhiều tuần.' },
    ],
    doiBan: [
      { doi: 'Cú đánh tập trung vào công ty có nhà máy, hàng hoá thật; tiền số gần như đứng ngoài.', muc: { loai: 'sk_ma', sk: 'tham_hoa', ma: ['vn30', 'cp_cn', 'btc'] } },
      { doi: 'Lúc bất ổn, vàng và đô la vẫn được giữ.', muc: { loai: 'sk_ma', sk: 'tham_hoa', ma: ['vang', 'usd'] } },
      { doi: 'Thiếu hàng đẩy giá; chính phủ nới tiền để tái thiết.', luatThe: 'keo_theo' },
    ],
    lq: ['tb_lam_phat', 'vn30', 'thien_nga'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
  {
    id: 'tb_dich_benh', nhom: 'the', suKien: 'dich_benh', ten: 'KHỦNG HOẢNG SINH HỌC', anh: 'PANDEMIC', icon: 'tb_dich_benh',
    nhac: 'Dịch bệnh làm cả nền kinh tế đứng lại — chợ hoảng loạn, rồi tiền rẻ tràn về.',
    ngoai: 'Một đại dịch buộc người ta ở nhà: cửa hàng đóng, nhà máy ngừng, chuyến bay huỷ. Vài tuần đầu, gần như mọi tài sản rủi ro bị bán tháo. Sau đó các chính phủ bơm tiền và hạ lãi suất để đỡ nền kinh tế.',
    chuoi: { ten: 'TỪ HOẢNG LOẠN TỚI TIỀN RẺ', buoc: ['Giãn cách: doanh nghiệp mất doanh thu gần như ngay lập tức.', 'Nhà đầu tư bán tháo, ôm tiền mặt và trái phiếu chính phủ.', 'Ngân hàng trung ương hạ lãi, chính phủ bơm tiền hỗ trợ.'], ket: 'Tiền rẻ quay lại đẩy giá tài sản lên.', huong: 'len' },
    chuyen: [{ nam: '2020', noi: 'VIỆT NAM', cau: 'VN-Index rơi xuống khoảng 660 điểm (24/3/2020) giữa lúc giãn cách, rồi hồi mạnh khi tiền rẻ đổ vào; cả năm chỉ số vẫn tăng.', so: [['VN-Index năm 2020', '≈ +15%', 'len']] }],
    doiBan: [
      { doi: 'Cả nền kinh tế đứng lại — mọi thứ rủi ro chịu đòn.', muc: { loai: 'sk_ma', sk: 'dich_benh', ma: ['btc', 'cp_cn', 'vn30'] } },
      { doi: 'Lúc sợ nhất, trái phiếu chính phủ và vàng là nơi trú.', muc: { loai: 'sk_ma', sk: 'dich_benh', ma: ['tpcp', 'vang', 'usd'] } },
      { doi: 'Sau cú sốc là tiền rẻ để cứu kinh tế.', luatThe: 'keo_theo' },
      { doi: 'Dịch lan thì kinh tế co lại trước khi kịp cứu.', luatThe: 'bao_truoc' },
    ],
    lq: ['tb_ha_lai', 'tpm', 'thien_nga'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
  {
    id: 'tinh_chat', nhom: 'the', ten: 'HUY HIỆU TÍNH CHẤT', anh: 'MARKET REGIME BADGE', icon: 'medal',
    nhac: 'Góc mỗi ô tin có một huy hiệu: tin ấy đánh chợ theo kiểu nào — không nói tin thật hay bịa.',
    ngoai: 'Người đọc tin giỏi không chỉ hỏi "tin tốt hay xấu" mà hỏi "tiền sẽ chảy đi đâu". Cùng một tin có thể nâng thứ này và dìm thứ kia. Có bốn kiểu hay gặp: van tiền mở hay đóng; tiền hưng phấn đổ vào chỗ nóng; hoảng loạn chạy về nơi trú; và cú đánh chỉ nhắm vài mã.',
    doiBan: [
      { doi: 'Lãi suất là cái van của cả chợ: mở thì tiền chảy vào gần hết, đóng thì rút khỏi gần hết.', ban: '<b>VAN TIỀN</b> — {tb_ha_lai|Hạ lãi suất}, {tb_tang_lai|Tăng lãi suất}.' },
      { doi: 'Lúc hưng phấn, tiền rời chỗ an toàn để đổ vào chỗ đang nóng.', ban: '<b>HƯNG PHẤN</b> — {tb_bong_bong|Bong bóng}.' },
      { doi: 'Lúc hoảng loạn, tiền rời tài sản rủi ro, chạy về vàng, đô la, trái phiếu.', ban: '<b>HOẢNG LOẠN</b> — Chiến tranh, Siết pháp lý, Phá sản dây chuyền, Cấm vận, Thảm hoạ, Khủng hoảng sinh học.' },
      { doi: 'Có tin chỉ đánh chọn lọc vài mã, không theo phe.', ban: '<b>LỆCH MÃ</b> — {tb_sap_san|Sàn khoá rút tiền}, {tb_lam_phat|Lạm phát nóng}.' },
      { doi: 'Tin giả vẫn "mặc áo" của tin nó giả dạng.', ban: 'Huy hiệu tính theo mặt chữ của tin — tin giả mang đúng huy hiệu của tin thật cùng tên.', loai: 'luat' },
      { doi: 'Cùng một tin, hoàn cảnh khác thì tác động khác.', ban: 'Huy hiệu của một ô có thể đổi theo những ô đi trước nó.' },
    ],
    lq: ['tin_gia', 'tin_dan_dat', 'tb_ha_lai'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
  {
    id: 'thien_nga', nhom: 'the', ten: 'THIÊN NGA ĐEN', anh: 'BLACK SWAN', icon: 'thien_nga',
    // founder 11/10: câu cũ ("…không in lên tấm thẻ nào") khó hiểu ⇒ câu của founder; banner Hub đọc câu này làm "BẠN CÓ BIẾT?".
    nhac: 'Thị trường không tăng mãi — một tin tức vĩ mô đủ sức quét sạch tài sản của bạn.',
    ngoai: 'Nhà thống kê, nhà văn Nassim Taleb gọi những biến cố hiếm, không ai ngờ tới nhưng tác động khổng lồ là "thiên nga đen" — vì người châu Âu từng tin mọi con thiên nga đều trắng, cho tới khi gặp thiên nga đen ở Úc. Sau khi xảy ra, ai cũng giải thích được; trước đó thì không ai nói tới.',
    doiBan: [
      { doi: 'Thứ đã có tên và có xác suất thì không còn là thiên nga đen.', ban: 'Bàn không có thẻ "Thiên nga đen": năm cú sốc hiếm được đặt tên thật — {tb_phap_ly|Siết pháp lý}, {tb_pha_san|Phá sản dây chuyền}, {tb_cam_van|Cấm vận}, {tb_tham_hoa|Thảm hoạ tự nhiên}, {tb_dich_benh|Khủng hoảng sinh học}.' },
      { doi: 'Biến cố càng hiếm thường càng nặng.', ban: 'Năm thẻ ấy hiếm dần theo đúng thứ tự trên, và nặng dần.' },
      { doi: 'Ngoài đời, thiên nga đen thật vẫn có thể tới từ chỗ chưa ai liệt kê.', ban: 'Trên bàn, mọi cú sốc đều nằm sẵn trong bộ thẻ.', loai: 'gon' },
    ],
    lq: ['tb_dich_benh', 'tb_pha_san', 'tinh_chat'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
];
