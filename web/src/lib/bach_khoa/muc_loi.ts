/**
 * MỤC BÁCH KHOA — LÕI CHIẾN THUẬT (D334; tên nhóm đúng như quầy trong trận, HuongDan.tsx mục 16).
 * Số trên bàn: `%{dq.*}` = catalog.dac_quyen (config DAC_QUYEN) · `%{gia.*}` = catalog.gia_bang · `%{ghim.*}` =
 * vai đang ghim lá đó. ⚠ Bắt Đáy / Mua Đuổi cố ý KHÔNG có số: tu_dien.ts chỉ phát `truot_nang_hon` ("phát ra kết
 * luận chứ không phát hai con số") — bách khoa không đi vòng qua quyết định đó.
 * Ngoài đời kiểm nguồn 14/09: Spread Networks ~300 triệu đô, 16 → 13 mili-giây · Enron 2001 · Nasdaq · GameStop 1/2021
 * · tỷ lệ ký quỹ ban đầu tối thiểu 50% (Quyết định 87/QĐ-UBCK 2017).
 */
import type { MucBK } from './kieu';
import { LOI_CHI_TRONG_MAN_CHU, LOI_NUT_MAN } from '../khung_minigame';

export const MUC_LOI: readonly MucBK[] = [
  {
    id: 'luot_song', nhom: 'ct', ten: 'LƯỚT SÓNG', anh: 'TREND FOLLOWING', icon: 'song',
    nhac: 'Cược rằng xu hướng đang chạy sẽ chạy tiếp.',
    ngoai: 'Người lướt sóng không cố đoán một công ty đáng giá bao nhiêu. Họ chỉ nhìn giá: đang lên thì theo lên, đang xuống thì theo xuống, cho tới khi con sóng gãy. Nhiều quỹ lớn trên thế giới quản lý hàng trăm tỷ đô bằng đúng nguyên tắc ấy.',
    viDu: 'Họ thường sai nhiều lần hơn đúng — vào sóng rồi sóng tắt ngay. Vài con sóng dài bù lại tất cả.',
    chuoi: { ten: 'VÌ SAO THEO SÓNG CÓ THỂ LỜI', buoc: ['Tin tốt lan ra từ từ — không phải ai cũng biết cùng lúc.', 'Người biết trước mua trước, người biết sau mua sau.', 'Giá không nhảy một bước mà leo dần qua nhiều nhịp.'], ket: 'Ai bám từ giữa sóng vẫn kịp ăn một đoạn.' },
    nhung: 'Khi chợ giật qua giật lại không có hướng, người lướt sóng liên tục vào rồi bị hất ra — mỗi lần mất một ít, cộng lại thành nhiều.',
    chuyen: [{ nam: '2008', noi: 'THẾ GIỚI', cau: 'Khủng hoảng tài chính, cổ phiếu toàn cầu lao dốc cả năm. Nhiều quỹ theo xu hướng lại lãi lớn: họ bám đúng con sóng giảm kéo dài.' }],
    doiBan: [
      { doi: 'Cách giao dịch chỉ thành tiền khi bạn thật sự giao dịch.', ban: LOI_CHI_TRONG_MAN_CHU, loai: 'luat' },
      { doi: 'Người lướt sóng sống bằng dữ liệu giá — dữ liệu chậm là tín hiệu chậm. Ở nhiều sàn thế giới, bảng giá miễn phí trễ 15 phút; muốn giá tức thời thì trả tiền.', ban: 'Trong màn lõi, lá cho xem khung nến <b>nhanh</b>: nến ngắn hơn, thấy từng con sóng nhỏ.' },
      { doi: 'Tín hiệu xu hướng chỉ nói điều gì dễ xảy ra hơn, chưa bao giờ nói điều gì chắc chắn.', ban: `Trong màn: ${LOI_NUT_MAN.luot_song}.`, loai: 'luat' },
    ],
    lq: ['doi_lai', 'gia_thong_tin', 'tin_dan_dat'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
  {
    id: 'bat_day', nhom: 'ct', ten: 'BẮT ĐÁY', anh: 'MEAN REVERSION', icon: 'bat_day',
    nhac: 'Tin rằng giá rơi quá đà rồi sẽ bật về mức trung bình.',
    ngoai: 'Bắt đáy là mua vào lúc giá vừa rơi mạnh, tin rằng nó đã rẻ quá mức và sẽ hồi lại. Giới đầu tư gọi đó là "bắt dao rơi": bắt đúng thì lãi đẹp, bắt sai thì giá còn rơi tiếp và vết cắt sâu hơn.',
    chuoi: { ten: 'VÌ SAO GIÁ HAY BẬT LẠI', buoc: ['Tin xấu làm nhiều người bán vội cùng lúc.', 'Giá rơi sâu hơn mức tin xấu thật sự đáng.', 'Người mua thấy rẻ, quay lại gom.'], ket: 'Giá hồi lên một đoạn.', huong: 'len' },
    nhung: 'Có những cú rơi không "quá đà" mà là đúng: công ty thật sự hỏng, bong bóng thật sự vỡ. Khi đó mỗi lần bắt đáy là một lần mua ở giá cao hơn đáy thật.',
    chuyen: [{ nam: '2022', noi: 'THẾ GIỚI', cau: 'Bitcoin rơi từ gần 69.000 đô xuống quanh 30.000 đô (giữa năm) — nhiều người tin "đã đáy". Tới tháng 11 nó còn khoảng 16.000 đô.', so: [['Bitcoin', '30.000 → 16.000 đô', 'xuong']] }],
    doiBan: [
      { doi: 'Cách giao dịch chỉ thành tiền khi bạn thật sự giao dịch.', ban: LOI_CHI_TRONG_MAN_CHU, loai: 'luat' },
      { doi: 'Bắt đáy chỉ có nghĩa sau một cú rơi.', ban: `Trong màn: ${LOI_NUT_MAN.bat_day}.` },
      { doi: 'Hồi phục thật thì ăn một đoạn đẹp; bắt hụt thì dao vẫn đang rơi.', ban: 'Màn cộng phần chênh giữa lệnh của bạn và giữ suốt: vào sát đáy thì hơn, vào giữa cú rơi thì kém — có thể âm.' },
      { doi: 'Mua rẻ tự nó không sinh ra lợi thế.', ban: 'Đường giá trị trễ vài nến và có sai số; nhãn quá bán chỉ nói giá đã rơi xa, không nói đáy đã tới.', loai: 'luat' },
    ],
    lq: ['mua_duoi', 'chu_ky', 'di_nguoc'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'mua_duoi', nhom: 'ct', ten: 'MUA ĐUỔI', anh: 'FOMO', icon: 'ten_lua',
    nhac: 'Mua vì giá đang lên và sợ lỡ chuyến.',
    ngoai: 'FOMO là nỗi sợ bị bỏ lại: thấy bạn bè khoe lãi, thấy giá tăng mỗi ngày, rồi mua vào dù không rõ vì sao nó tăng. Đó là hành vi phổ biến nhất của người mới — và là lý do đỉnh giá thường do chính những người mua sau cùng tạo ra.',
    chuoi: { ten: 'VÌ SAO NGƯỜI MUA ĐUỔI HAY MUA ĐÚNG ĐỈNH', buoc: ['Giá tăng một thời gian, báo chí và mạng xã hội bắt đầu bàn tán.', 'Người mới lao vào, đẩy giá lên thêm.', 'Tới lúc hầu hết những ai muốn mua đều đã mua.'], ket: 'Không còn người mua mới ⇒ giá quay đầu, người vào sau cùng kẹt ở đỉnh.', huong: 'xuong' },
    chuyen: [{ nam: '2021–2022', noi: 'VIỆT NAM', cau: 'Năm 2021 hơn 1,5 triệu tài khoản chứng khoán mới được mở. VN-Index chạm khoảng 1.536 điểm (1/2022) rồi rơi xuống 873 điểm (11/2022).', so: [['VN-Index', '1.536 → 873 điểm', 'xuong']] }],
    doiBan: [
      { doi: 'Cách giao dịch chỉ thành tiền khi bạn thật sự giao dịch.', ban: LOI_CHI_TRONG_MAN_CHU, loai: 'luat' },
      { doi: 'Mua đuổi chỉ xảy ra khi giá vừa tăng.', ban: `Trong màn: ${LOI_NUT_MAN.mua_duoi}.` },
      { doi: 'Sóng tắt thì người vào sau cùng lỗ nặng nhất.', ban: 'Màn cộng phần chênh giữa lệnh của bạn và giữ suốt — vào muộn ở đỉnh thì phần chênh âm.' },
    ],
    lq: ['bat_day', 'chen_chuc', 'phan_than'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'chan_lo', nhom: 'ct', khoanhKhac: 'chan_lo', ten: 'CHẶN LỖ', anh: 'STOP-LOSS', icon: 'chan_lo',
    nhac: 'Mức tự bán đặt sẵn — kỷ luật viết ra trước cơn hoảng.',
    ngoai: 'Lệnh chặn lỗ là dặn trước với sàn: "giá rơi tới mức này thì bán giúp tôi". Nó thay quyết định lúc đang hoảng bằng một quyết định lúc còn tỉnh. Nhưng nó không bảo đảm bán được đúng giá đã đặt: chợ sập nhanh thì lệnh khớp ở giá thấp hơn nhiều.',
    chuoi: { ten: 'VÌ SAO CHẶN LỖ KHÔNG CHẶN ĐÚNG SỐ', buoc: ['Bạn đặt bán khi giá chạm 90.', 'Tin xấu ra ban đêm, sáng hôm sau chợ mở cửa ở 80.', 'Lệnh chỉ được kích hoạt lúc giá đã ở 80.'], ket: 'Bạn bán ở 80, không phải 90.' },
    chuyen: [{ nam: 'Cuối 2022', noi: 'VIỆT NAM', cau: 'Nhiều mã giảm sàn nhiều phiên liền, bảng giá "trắng bên mua" — không ai đặt mua. Lệnh bán treo đó mà không khớp nổi.' }],
    doiBan: [
      { doi: 'Bộ lá của trận thật được lược bớt để mỗi lá còn lại có một việc rõ ràng.', ban: 'Lá này <b>chỉ còn ở bàn tập</b> — quầy trận thật không bày.', loai: 'luat' },
      { doi: 'Chặn lỗ đặt một mức sàn cho khoản thua.', ban: 'Phần <b>lõi</b> của vòng (pha, tin, các lá khác) không sụt quá %{dq.CHAN_LO.SAN_BP:pc}%.' },
      { doi: 'Giá khớp thật còn tuỳ lúc đó có ai mua.', ban: '{truot_gia|Trượt giá} và hàng chờ cộng vào <b>sau</b> sàn ⇒ kết quả cuối có thể thủng sàn.' },
      { doi: 'Chặn lỗ cắt những cú thua quá sâu, không làm khoản thua nhỏ biến mất.', ban: 'Sàn chỉ cắt đuôi cực đoan; vòng thua thường vẫn thua như cũ.' },
      { doi: 'Ngoài đời lệnh chặn lỗ không thu phí, nhưng có giá: bị hất khỏi vị thế bởi một cú rung ngắn rồi giá quay lên.', ban: 'Trên bàn cái giá ấy gói thành phí %{dq.CHAN_LO.PHI_MOI_VONG_BP:pc}% mỗi vòng, dù sàn có chạm hay không.', loai: 'gon' },
    ],
    so: [['Sàn phần lõi mỗi vòng', '−%{dq.CHAN_LO.SAN_BP:pc}%'], ['Phí mỗi vòng', '%{dq.CHAN_LO.PHI_MOI_VONG_BP:pc}%']],
    lq: ['ban_thao', 'truot_gia', 'mua_duoi'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'phong_ho', nhom: 'ct', ten: 'PHÒNG HỘ', anh: 'HEDGE', icon: 'o_du',
    nhac: 'Mở một vị thế ngược chiều để bớt đòn — trả phí như mua bảo hiểm.',
    ngoai: 'Phòng hộ giống mua bảo hiểm xe: năm nào cũng mất một khoản phí, phần lớn các năm chẳng dùng tới, nhưng năm có tai nạn thì không mất trắng. Trong đầu tư, phòng hộ là mở thêm một vị thế sẽ lời đúng lúc vị thế chính lỗ.',
    viDu: 'Hãng hàng không sợ giá nhiên liệu tăng thường mua trước hợp đồng dầu: dầu lên thì hợp đồng lời, bù phần chi phí bay tăng.',
    chuoi: { ten: 'PHÒNG HỘ CHẠY THẾ NÀO', buoc: ['Đang cầm cổ phiếu, sợ chợ giảm.', 'Mở thêm một lệnh sẽ lời nếu chợ giảm.', 'Chợ giảm: cổ phiếu lỗ, lệnh ngược lời — hai bên bù nhau.'], ket: 'Chợ tăng: lệnh ngược lỗ một ít — đó là phí bảo hiểm.' },
    doiBan: [
      { doi: 'Bộ lá của trận thật được lược bớt để mỗi lá còn lại có một việc rõ ràng.', ban: 'Lá này <b>chỉ còn ở bàn tập</b> — quầy trận thật không bày.', loai: 'luat' },
      { doi: 'Không ai bán bảo hiểm cháy cho căn nhà đang cháy.', ban: 'Lệnh ngược chiều đặt <b>ở vòng này, khớp ở vòng sau</b> — đặt trước khi biết kết quả.' },
      { doi: 'Phòng hộ hiếm khi khớp hoàn hảo với khoản nó che.', ban: 'Ăn %{dq.PHONG_HO.HE_SO_BP:pc}% cú nghịch đảo, không ăn trọn.' },
      { doi: 'Bảo hiểm có phí, và có mức bồi thường tối đa.', ban: 'Phí mở %{dq.PHONG_HO.PHI_BP:pc}%, trần %{dq.PHONG_HO.TRAN_BP:pc}% một lệnh.' },
      { doi: 'Tính nhiều năm, người mua bảo hiểm trả nhiều hơn nhận — đó là giá của sự yên tâm.', ban: 'Kỳ vọng của lá hơi âm, có chủ ý: nó bớt đòn, không sinh lời.', loai: 'luat' },
    ],
    so: [['Phần nghịch đảo vào túi', '%{dq.PHONG_HO.HE_SO_BP:pc}%'], ['Phí mở', '%{dq.PHONG_HO.PHI_BP:pc}%'], ['Trần một lệnh', '%{dq.PHONG_HO.TRAN_BP:pc}%']],
    lq: ['ban_khong', 'chan_lo', 'da_dang'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'don_bay', nhom: 'ct', khoanhKhac: 'don_bay', ten: 'ĐÒN BẨY', anh: 'LEVERAGE', icon: 'don_bay',
    nhac: 'Vay để đặt to hơn vốn: phóng cả lãi lẫn lỗ.',
    ngoai: 'Đòn bẩy là dùng tiền vay để mua nhiều hơn số tiền mình có. Có 10 triệu, vay thêm 10 triệu, mua 20 triệu cổ phiếu: giá lên 10% thì bạn lãi 20% trên tiền của mình. Giá xuống 10% thì bạn cũng mất 20% — và khoản vay vẫn còn nguyên.',
    viDu: 'Ở Việt Nam, mua chứng khoán ký quỹ thì tiền của mình tối thiểu 50% giá trị lệnh — tức vay tối đa bằng số tiền mình có, đòn bẩy khoảng 2 lần.',
    chuoi: { ten: 'VÌ SAO NGƯỜI VAY MẤT NHANH HƠN GIÁ GIẢM', buoc: ['Mua 20 triệu cổ phiếu: 10 triệu của mình, 10 triệu vay.', 'Giá giảm 30%: số cổ phiếu còn 14 triệu.', 'Trả 10 triệu nợ, còn lại 4 triệu.'], ket: 'Giá mới giảm 30%, bạn đã mất 60% tiền của mình.', huong: 'xuong' },
    doiBan: [
      { doi: 'Cách giao dịch chỉ thành tiền khi bạn thật sự giao dịch.', ban: LOI_CHI_TRONG_MAN_CHU, loai: 'luat' },
      { doi: 'Đòn bẩy không đổi cửa thắng, chỉ đổi CỠ của mọi kết quả.', ban: `Trong màn: ${LOI_NUT_MAN.don_bay}.` },
      { doi: 'Vay ký quỹ ở Việt Nam tối đa khoảng gấp đôi vốn.', ban: 'Trên bàn có cả những mức nhân cao hơn mức ngoài đời cho phép — nhân càng cao, ngưỡng thanh lý càng gần giá vào.' },
      { doi: 'Tiền vay có lãi.', ban: 'Giữ vị thế vay trong màn trả lãi vay theo thời gian giữ.' },
      { doi: 'Lỗ tới ngưỡng thì bên cho vay đòi tiền ngay, không chờ bạn quyết.', ban: 'Giá chạm ngưỡng ⇒ {goi_ky_quy|gọi ký quỹ}: nạp thêm, hoặc bị thanh lý.' },
      { doi: 'Quỹ gom tiền người dân thường bị cấm vay để đầu tư.', ban: 'Vai {to_chuc|Tổ Chức} không lấy được lá này.' },
    ],
    lq: ['goi_ky_quy', 'ca_map', 'suc_cang'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'ban_khong', nhom: 'ct', khoanhKhac: 'ban_khong', ten: 'BÁN KHỐNG', anh: 'SHORT SELLING', icon: 'ban_khong',
    nhac: 'Mượn để bán trước, mua trả sau — ăn khi giá xuống.',
    ngoai: 'Bán khống là mượn một tài sản mình không có, bán ngay ở giá hôm nay, rồi chờ giá xuống để mua lại trả người cho mượn. Mua cổ phiếu thì lỗ tối đa là số tiền bỏ ra. Bán khống thì ngược lại: lãi nhiều nhất khi giá về 0, còn lỗ thì không có trần — giá có thể tăng mãi.',
    chuoi: { ten: 'VÌ SAO LỖ KHÔNG CÓ ĐÁY', buoc: ['Mượn 1 cổ phiếu, bán ở giá 100.', 'Giá xuống 60: mua lại, trả, lãi 40.', 'Giá lên 300: mua lại tốn 300, lỗ 200.'], ket: 'Giá lên bao nhiêu, lỗ theo bấy nhiêu — không có điểm dừng.' },
    chuyen: [{ nam: '1/2021', noi: 'MỸ', cau: 'Hàng triệu nhà đầu tư nhỏ lẻ rủ nhau mua cổ phiếu GameStop — mã đang bị các quỹ bán khống rất nhiều. Giá tăng khoảng 20 lần trong vài tuần, các quỹ buộc mua lại với giá đắt; có quỹ lỗ hàng tỷ đô.', so: [['GameStop', 'khoảng ×20 trong vài tuần', 'len']] }],
    doiBan: [
      { doi: 'Cách giao dịch chỉ thành tiền khi bạn thật sự giao dịch.', ban: LOI_CHI_TRONG_MAN_CHU, loai: 'luat' },
      { doi: 'Bán khống đòi tài sản thế chấp cho bên cho mượn.', ban: `Trong màn: ${LOI_NUT_MAN.ban_khong}.` },
      { doi: 'Người bán khống lãi đúng bằng phần giá rơi, dù trong tay không có món tài sản đó.', ban: 'Màn bán khống trên mã bạn đang nắm nhiều nhất — ăn phần giá rơi trong màn.' },
      { doi: 'Mượn tài sản thì trả phí mượn theo thời gian.', ban: 'Giữ vị thế khống trong màn trả phí mượn theo thời gian giữ.' },
      { doi: 'Sàn Việt Nam chưa cho bán khống cổ phiếu cơ sở; nhiều quỹ gom tiền người dân cũng bị cấm.', ban: 'Vai {to_chuc|Tổ Chức} không lấy được lá này.' },
      { doi: 'Ngoài đời lỗ khi bán khống không có đáy.', ban: 'Trong màn lỗ dừng ở phần ký quỹ: chạm ngưỡng thì bị gọi ký quỹ rồi thanh lý.', loai: 'gon' },
    ],
    lq: ['phong_ho', 'to_chuc', 'cpck'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'khop_nhanh', nhom: 'ct', ten: 'KHỚP NHANH', anh: 'LOW LATENCY', icon: 'tua_nhanh',
    nhac: 'Lệnh tới sàn trước phần còn lại của thị trường.',
    ngoai: 'Sàn khớp lệnh theo thứ tự: cùng một mức giá, lệnh nào tới trước khớp trước. Vì thế các công ty giao dịch tốc độ cao chi rất nhiều tiền để lệnh đến sàn sớm hơn người khác vài phần nghìn giây — đứng đầu hàng thì mua được giá tốt trước khi giá kịp chạy.',
    viDu: 'Năm 2010, công ty Spread Networks chi khoảng 300 triệu đô đào một tuyến cáp quang gần như thẳng tắp từ Chicago tới New York — chỉ để rút thời gian đi về của lệnh từ 16 xuống 13 phần nghìn giây.',
    chuoi: { ten: 'VÌ SAO NHANH LÀ RẺ', buoc: ['Tin ra, cả chợ cùng muốn mua.', 'Lệnh xếp hàng theo thứ tự tới sàn.', 'Người đầu hàng khớp ở giá cũ; người cuối hàng khớp ở giá đã bị đẩy lên.'], ket: 'Nhanh hơn ⇒ ít trượt giá hơn.' },
    doiBan: [
      { doi: 'Bộ lá của trận thật được lược bớt để mỗi lá còn lại có một việc rõ ràng.', ban: 'Lá này <b>chỉ còn ở bàn tập</b> — quầy trận thật không bày.', loai: 'luat' },
      { doi: 'Đứng đầu hàng chờ thì khớp trước khi giá chạy.', ban: 'Hàng chờ khớp lệnh khi vào một mã chỉ còn %{dq.KHOP_NHANH.XEP_HANG_CON_BP:pc}%.' },
      { doi: 'Tốc độ chỉ có giá trị khi có người để vượt.', ban: 'Được hoàn một phần phạt {chen_chuc|chen chúc} — càng đông người cùng mua, hoàn càng nhiều; vắng người thì không hoàn.' },
      { doi: 'Hạ tầng nhanh giúp đảo lệnh rẻ hơn; lúc tháo chạy, người ra cửa trước bán được giá hơn.', ban: 'Phí đảo danh mục còn %{dq.KHOP_NHANH.DAO_PHI_CON_BP:pc}%; phần rút khẩn khi {ban_thao|BỎ} còn %{dq.KHOP_NHANH.RUT_KHAN_CON_BP:pc}%.' },
      { doi: 'Tốc độ là lợi thế của người, không gắn với tài sản nào.', ban: 'Tác dụng lên mọi mã đang cầm.' },
    ],
    so: [['Hàng chờ khớp mã vừa vào', 'còn %{dq.KHOP_NHANH.XEP_HANG_CON_BP:pc}%'], ['Phí đảo danh mục', 'còn %{dq.KHOP_NHANH.DAO_PHI_CON_BP:pc}%'], ['Phần rút khẩn khi BỎ', 'còn %{dq.KHOP_NHANH.RUT_KHAN_CON_BP:pc}%']],
    lq: ['truot_gia', 'chen_chuc', 'chia_lenh'], khung: 'OECD/INFE · Tiền & giao dịch',
  },
  {
    id: 'chia_lenh', nhom: 'ct', ten: 'CHIA LỆNH', anh: 'ORDER SPLITTING', icon: 'chia_lenh',
    nhac: 'Chẻ một lệnh lớn thành nhiều lệnh nhỏ để không tự đẩy giá.',
    ngoai: 'Muốn mua một lượng lớn mà không làm giá chạy, người ta chia lệnh thành nhiều phần nhỏ, rải ra theo thời gian — như mua nhiều hàng thì chia cho nhiều sạp, nhiều buổi chợ, thay vì vét một sạp. Các quỹ lớn dùng thuật toán để làm việc này tự động.',
    chuoi: { ten: 'VÌ SAO LỆNH NHỎ RẺ HƠN', buoc: ['Một lệnh to ăn hết lớp giá rẻ rồi leo lên lớp đắt.', 'Chia làm nhiều phần, mỗi phần chỉ ăn lớp rẻ nhất.', 'Giữa hai lần mua, người bán kịp treo thêm hàng.'], ket: 'Tổng giá mua thấp hơn một lần mua gộp.' },
    doiBan: [
      { doi: 'Bộ lá của trận thật được lược bớt để mỗi lá còn lại có một việc rõ ràng.', ban: 'Lá này <b>chỉ còn ở bàn tập</b> — quầy trận thật không bày.', loai: 'luat' },
      { doi: 'Chia lệnh là quyền đặt lệnh mịn hơn.', ban: 'Mốc đặt lệnh mịn hơn: bước <b>%{luat.BUOC_MOC_BP:pc}%</b> vốn thay vì %{luat.BUOC_MOC_THO_BP:pc}%.' },
      { doi: 'Trượt giá tăng nhanh theo cỡ lệnh so với lượng hàng đang treo.', ban: 'Rải một vị thế lớn qua nhiều vòng thì phần {truot_gia|phí vội vàng} theo cỡ lệnh không leo.' },
    ],
    so: [['Bước mốc · cầm lá', '%{luat.BUOC_MOC_BP:pc}% vốn'], ['Bước mốc · không lá', '%{luat.BUOC_MOC_THO_BP:pc}% vốn']],
    lq: ['truot_gia', 'khop_nhanh', 'thanh_khoan'], khung: 'OECD/INFE · Tiền & giao dịch',
  },
  {
    id: 'da_dang', nhom: 'ct', ten: 'ĐA DẠNG HOÁ', anh: 'DIVERSIFICATION', icon: 'gio_trung',
    nhac: 'Không bỏ trứng vào một giỏ.',
    ngoai: 'Chia tiền vào nhiều thứ đi khác nhau để một cú xui không cuốn hết. Nhà kinh tế Harry Markowitz — người đoạt Nobel nhờ lý thuyết này — gọi đó là "bữa trưa miễn phí" duy nhất của tài chính: bớt rủi ro mà không buộc bớt phần lời kỳ vọng tương ứng.',
    viDu: 'Giữ mười món cùng lên cùng xuống cũng giống giữ một món — thứ đếm là mức chúng đi KHÁC nhau.',
    chuoi: { ten: 'VÌ SAO CHIA GIỎ BỚT RỦI RO', buoc: ['Cổ phiếu hay rơi khi có chiến tranh, dịch bệnh.', 'Đúng lúc đó vàng, trái phiếu thường lên.', 'Cầm cả hai thì phần lỗ bên này được phần lời bên kia đỡ.'], ket: 'Tổng tài sản lên xuống êm hơn từng món riêng.' },
    chuyen: [{ nam: '2001', noi: 'MỸ', cau: 'Tập đoàn năng lượng Enron phá sản sau bê bối kế toán. Nhiều nhân viên để phần lớn quỹ hưu trong chính cổ phiếu Enron — mất việc và mất luôn tiền hưu cùng một lúc.' }],
    doiBan: [
      { doi: 'Bộ lá của trận thật được lược bớt để mỗi lá còn lại có một việc rõ ràng.', ban: 'Lá này <b>chỉ còn ở bàn tập</b> — quầy trận thật không bày.', loai: 'luat' },
      { doi: 'Đa dạng nghĩa là cầm được nhiều thứ hơn.', ban: 'Mỗi vòng lấy được <b>%{dq.DA_DANG_HOA.TAI_SAN_MOI_VONG:n} lá tài sản</b>, và giữ được thêm %{dq.DA_DANG_HOA.TRAN_TAI_SAN_THEM:n} mã.' },
      /*
       * v52 (D371) — DÒNG NÀY TRƯỚC ĐÓ KHÔNG CÓ, và đó là cùng chỗ hổng mà tờ (!) mắc:
       * cả hai mặt đọc chỉ kể hai điều LỢI, trong khi lá thu tiền MỖI VÒNG trên toàn bộ
       * vị thế. Founder phát hiện bằng cách chơi, không phải bằng cách đọc.
       * Số lấy từ catalog (`ddv`) qua đúng cửa `daDangCua` bên server — không gõ tay.
       */
      { doi: 'Chia giỏ là việc làm một lần rồi thôi.', ban: 'Lá này tính lại MỖI vòng trên toàn bộ vị thế: %{ddv.PHI_BP:pc}% cố định, cộng %{ddv.MOI_MA_BP:pc}% cho mỗi mã khác nhau đang nắm — càng ít mã càng ít lợi.' },
      { doi: 'Đa dạng xét trên cả danh mục, không phải từng món.', ban: 'Không gắn vào mã nào.' },
      { doi: 'Phe rủi ro và phe phòng thủ thường đi ngược nhau.', ban: 'Dấu kỹ năng <b>CHIA GIỎ</b> đọc số vòng bạn giữ cả hai phe.' },
      { doi: 'Luật quỹ đặt trần tỷ trọng để không ai dồn hết vào một chỗ.', ban: 'Mỗi phe có trần tỷ trọng so với tổng tài sản; vai {to_chuc|%{ghim.da_dang_hoa:vai}} ghim sẵn lá này.' },
      { doi: 'Một danh mục thật có hàng chục, hàng trăm mã.', ban: 'Bàn chỉ có sáu mã và giữ được vài mã — mỗi lần chọn là một đánh đổi thật.', loai: 'gon' },
    ],
    so: [['Lá tài sản mỗi vòng', '%{dq.DA_DANG_HOA.TAI_SAN_MOI_VONG:n}'], ['Trần số mã giữ', '+%{dq.DA_DANG_HOA.TRAN_TAI_SAN_THEM:n}'], ['Mỗi vòng · cố định', '%{ddv.PHI_BP:pc}%'], ['Mỗi vòng · mỗi mã', '+%{ddv.MOI_MA_BP:pc}%'], ['Vai ghim sẵn', '%{ghim.da_dang_hoa:vai}']],
    lq: ['to_chuc', 'vang', 'khau_vi'], khung: 'OECD/INFE · Rủi ro & phần thưởng · Kỹ năng CHIA GIỎ',
  },
  {
    id: 'di_nguoc', nhom: 'ct', ten: 'ĐI NGƯỢC', anh: 'CONTRARIAN', icon: 'di_nguoc',
    nhac: 'Mua thứ đám đông bỏ, bán thứ đám đông giành.',
    ngoai: 'Người đi ngược mua lúc ai cũng sợ và bán lúc ai cũng hào hứng. Khó ở chỗ đám đông đúng phần lớn thời gian — họ chỉ sai ở những khúc ngoặt. Vì thế người đi ngược theo dõi rất kỹ xem đám đông đang dồn về đâu.',
    viDu: 'Ở Mỹ, cơ quan quản lý hàng hoá công bố báo cáo vị thế mỗi tuần — cho biết giới đầu cơ đang dồn cửa lên hay cửa xuống. Người đi ngược đọc nó để thấy lúc nào đám đông đã quá lệch.',
    chuoi: { ten: 'VÌ SAO ĐÁM ĐÔNG CÓ LÚC SAI', buoc: ['Ai cũng tin giá lên thì ai cũng đã mua.', 'Không còn ai để mua thêm.', 'Một tin xấu nhỏ là đủ làm mọi người cùng muốn bán.'], ket: 'Chỗ đông nhất lại là chỗ dễ đổ nhất.' },
    doiBan: [
      { doi: 'Bộ lá của trận thật được lược bớt để mỗi lá còn lại có một việc rõ ràng.', ban: 'Lá này <b>chỉ còn ở bàn tập</b> — quầy trận thật không bày.', loai: 'luat' },
      { doi: 'Đi ngược đòi biết đám đông đang cầm gì.', ban: 'Lá nhìn xuyên màn che: thấy <b>%{dq.DI_NGUOC.TY_LE_THAY_BP.0:pc}% số đối thủ</b> đang cầm mã nào; cấp hai %{dq.DI_NGUOC.TY_LE_THAY_BP.1:pc}%, cấp ba %{dq.DI_NGUOC.TY_LE_THAY_BP.2:pc}%.' },
      { doi: 'Báo cáo vị thế cho thấy hướng dồn của cả nhóm, không cho thấy túi tiền từng người.', ban: 'Chỉ lộ tên mã, không lộ số lượng.' },
      { doi: 'Đứng một mình đúng khúc ngoặt thì lời lớn; đứng cùng số đông thì chỉ ăn phần còn lại.', ban: 'Đứng một mình được thưởng, đứng cùng số đông bị phạt — vì thế lá này tự khắc chế mọi lối chơi đang thắng.', loai: 'luat' },
    ],
    so: [['Thấy danh mục của', '%{dq.DI_NGUOC.TY_LE_THAY_BP.0:pc}% · %{dq.DI_NGUOC.TY_LE_THAY_BP.1:pc}% · %{dq.DI_NGUOC.TY_LE_THAY_BP.2:pc}% số đối thủ (cấp một · hai · ba)'], ['Lộ gì', 'tên mã · không lộ số lượng']],
    lq: ['phan_than', 'chen_chuc', 'mua_duoi'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
];
