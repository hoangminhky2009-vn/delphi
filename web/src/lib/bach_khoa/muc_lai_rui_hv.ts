/**
 * MỤC BÁCH KHOA — LÃI SUẤT & TIỀN · RỦI RO · HÀNH VI (D334). Luật chữ: xem `kieu.ts`.
 * Founder 14/09 (lần hai): *"tại sao tiền lại rẻ khi lãi suất giảm hoặc tăng và tại sao lãi suất không phải yếu tố
 * duy nhất cũng như tại sao tiền rẻ thì lại đổ vào đầu cơ… lạm phát cũng tương tự, chưa giải thích được vì sao lại có
 * lạm phát hay là lãi suất liên quan gì đến lạm phát"* — hai mục đầu trả lời đúng ba câu đó bằng chuỗi vì sao.
 * Ngoài đời kiểm nguồn 14/09: NHNN hạ lãi 17/3/2020, VN-Index 24/3/2020 ≈ 659 · lạm phát 2008 ≈ 23%, lãi cơ bản 14%
 * (11/6/2008), lãi huy động đỉnh 19,2% · Save More Tomorrow 3,5% → 13,6% sau 40 tháng · ký quỹ ban đầu ≥ 50%, duy
 * trì ≥ 30% (QĐ 87/QĐ-UBCK) · Archegos 3/2021 · suy thoái Mỹ 12/2007–6/2009.
 */
import type { MucBK } from './kieu';

export const MUC_LAI_RUI_HV: readonly MucBK[] = [
  // ═══ LÃI SUẤT & TIỀN ═══════════════════════════════════════════════════
  {
    id: 'lai_suat', nhom: 'lai', ten: 'LÃI SUẤT', anh: 'INTEREST RATE', icon: 'can_lai',
    nhac: 'Giá thuê tiền. Rẻ thì tiền chảy ra chợ, đắt thì tiền quay về ngân hàng.',
    ngoai: 'Lãi suất là giá của việc dùng tiền của người khác. Gửi tiết kiệm là cho ngân hàng thuê tiền — vì thế ngân hàng trả lãi cho bạn; đi vay là thuê tiền của ngân hàng — vì thế bạn trả lãi. Ngân hàng trung ương — ở Việt Nam là Ngân hàng Nhà nước — đặt lãi suất điều hành, và lãi của các ngân hàng thương mại nhích theo nó.',
    viDu: 'Gửi 100 triệu, lãi 6% một năm thì mỗi năm được 6 triệu. Lãi xuống 3% thì chỉ còn 3 triệu — và 100 triệu ấy bắt đầu muốn đi tìm chỗ lời hơn.',
    chuoi: [
      { ten: 'KHI LÃI HẠ', buoc: ['Gửi tiết kiệm bớt lời.', 'Vay mua nhà, vay kinh doanh rẻ hơn.', 'Tiền rời ngân hàng, đi tìm chỗ lời hơn.'], ket: 'Cổ phiếu, crypto, đất dễ lên.', huong: 'len' },
      { ten: 'KHI LÃI TĂNG', buoc: ['Gửi tiết kiệm lời hơn và chắc chắn.', 'Vay đắt: người ta bớt vay, bớt tiêu.', 'Tiền rút khỏi chỗ rủi ro, về ngân hàng.'], ket: 'Cổ phiếu, crypto, đất dễ xuống.', huong: 'xuong' },
    ],
    nhung: 'Lãi suất không phải thứ duy nhất đẩy giá. Lợi nhuận doanh nghiệp, nỗi sợ (chiến tranh, dịch bệnh), tin đồn, dòng tiền nước ngoài đều có lúc lấn át nó. Ngày 17/3/2020 Ngân hàng Nhà nước hạ lãi, vậy mà một tuần sau VN-Index vẫn rơi xuống khoảng 660 điểm — người ta sợ mất tiền hơn là tiếc lãi. Tiền rẻ chỉ đẩy giá khi người ta còn dám mua.',
    doiBan: [
      { doi: 'Lãi suất là cái nền, đổi chậm và ảnh hưởng tới mọi thứ.', ban: 'Mặt bằng lãi suất chạy nền, hiện ở góc màn.' },
      { doi: 'Ngân hàng trung ương họp theo lịch công bố trước: biết ngày họp, không biết kết quả.', ban: 'Ô <b>⚖ KỲ HỌP</b> là lịch công khai: biết trước vòng họp, không biết họ quyết gì — xem {tb_ha_lai|Hạ lãi suất}, {tb_tang_lai|Tăng lãi suất}.' },
      { doi: 'Ngân hàng trung ương cũng có lúc quyết khác điều thị trường chờ.', ban: 'Bảng kỳ họp hiện cả kỳ vọng lẫn quyết định thật.' },
      { doi: 'Phần lớn các kỳ họp giữ nguyên lãi suất.', ban: 'GIỮ NGUYÊN là chuyện thường, không phải cú đảo xu hướng.' },
      { doi: 'Ngoài đời có hàng chục mức lãi (tiết kiệm, cho vay, trái phiếu) nhích theo nhau.', ban: 'Bàn có một lãi nền; {tiet_kiem|tiết kiệm} và {loi_suat_dai|lợi suất dài} suy ra từ nó.', loai: 'gon' },
    ],
    lq: ['lam_phat', 'tb_ha_lai', 'tb_tang_lai'], khung: 'GDKT&PL 10 · Tín dụng',
  },
  {
    id: 'lam_phat', nhom: 'lai', ten: 'LẠM PHÁT', anh: 'INFLATION', icon: 'xu_chay',
    nhac: 'Tiền nằm im vẫn mất sức mua.',
    ngoai: 'Lạm phát là mức tăng chung của giá cả: cùng một số tiền, mỗi năm mua được ít hàng hơn. Nếu giá mọi thứ tăng 4% một năm thì 100 nghìn hôm nay, sang năm chỉ mua được lượng hàng bằng khoảng 96 nghìn hôm nay. Người giữ tiền mặt lâu chịu phần mất ấy mà không thấy dòng nào bị trừ trong ví.',
    chuoi: [
      { ten: 'VÌ SAO CÓ LẠM PHÁT', buoc: ['Tiền rẻ, vay nhiều, tiêu nhiều — hàng làm ra không kịp.', 'Hoặc chi phí tăng: xăng, điện, nguyên liệu đắt lên.', 'Người bán tăng giá; người đi làm đòi tăng lương.'], ket: 'Giá tăng khiến ai cũng tin giá còn tăng — lạm phát tự nuôi mình.' },
      { ten: 'LÃI SUẤT CHỮA THẾ NÀO', buoc: ['Ngân hàng trung ương tăng lãi.', 'Vay đắt, gửi tiết kiệm lời: người ta bớt vay, bớt tiêu.', 'Hàng bán chậm, người bán thôi tăng giá.'], ket: 'Lạm phát hạ — sau vài tháng tới hơn một năm.' },
    ],
    nhung: 'Lạm phát thấp và đều, khoảng vài phần trăm một năm, được coi là bình thường của một nền kinh tế đang lớn. Thứ nguy hiểm là lạm phát nóng và khó đoán. Ngược lại, giá cả giảm kéo dài cũng xấu: người ta hoãn mua để chờ rẻ hơn, và kinh tế chững lại.',
    chuyen: [{ nam: '2008–2009', noi: 'VIỆT NAM', cau: 'Lạm phát năm 2008 gần 23%. Ngân hàng Nhà nước nâng lãi suất cơ bản lên 14% (6/2008); có ngân hàng trả lãi tiết kiệm hơn 19% một năm. Vay mượn và tiêu dùng hạ nhiệt; năm 2009 lạm phát còn khoảng 7%.', so: [['Lạm phát 2008', '≈ 23%', ''], ['Lạm phát 2009', '≈ 7%', '']] }],
    doiBan: [
      { doi: 'Tiền mặt mòn đều theo thời gian.', ban: 'Tiền mặt mòn một chút mỗi vòng; thẻ {tb_lam_phat|Lạm phát nóng} ăn một miếng lớn ngay.' },
      { doi: 'Không đầu tư cũng không thoát lạm phát.', ban: 'Đứng ngoài không thoát: vẫn là tiền mặt.' },
      { doi: 'Giá cả không thật sự tăng thì tiền không thật sự mất sức mua.', ban: 'Tin lạm phát hoá ra bịa thì phần đã mất được trả lại ở vòng lộ.' },
      { doi: 'Trả phí cho ai đó thì tiền chỉ đổi chủ; lạm phát thì sức mua mất đi, không ai nhận.', ban: 'Phí là tiền <b>đổi chủ</b> (vào Quỹ vòng); lạm phát là tiền <b>mất giá</b> — không ai nhận.' },
      { doi: 'Tiền gửi cũng mất sức mua; lãi chỉ bù lại được phần lạm phát khi nó cao hơn lạm phát.', ban: 'Tiền trong sổ {tiet_kiem|tiết kiệm} cũng bị lạm phát ăn như tiền mặt — lãi thấp hơn lạm phát là lỗ thật.' },
    ],
    lq: ['lai_suat', 'tb_lam_phat', 'tiet_kiem'], khung: 'GDKT&PL 11 · Lạm phát',
  },
  {
    id: 'tiet_kiem', nhom: 'lai', ten: 'TIẾT KIỆM CÓ KỲ HẠN', anh: 'TERM DEPOSIT', icon: 'vault',
    nhac: 'Khoá tiền một thời gian để ăn lãi — lạm phát vẫn gặm vào sổ.',
    ngoai: 'Gửi có kỳ hạn là thoả thuận không rút tiền trong một khoảng thời gian (6 tháng, 12 tháng…), đổi lại ngân hàng trả lãi cao hơn tiền gửi không kỳ hạn. Rút trước hạn thì phần lãi đã hứa gần như mất hết — chỉ còn lãi không kỳ hạn rất thấp.',
    chuoi: { ten: 'VÌ SAO KHOÁ LÂU THÌ LÃI CAO HƠN', buoc: ['Ngân hàng lấy tiền gửi đi cho người khác vay.', 'Biết chắc tiền nằm yên 12 tháng, ngân hàng cho vay dài được.', 'Cho vay dài lời hơn, ngân hàng chia bớt phần lời cho người gửi.'], ket: 'Chịu khoá lâu ⇒ lãi cao hơn.' },
    doiBan: [
      { doi: 'Kỳ hạn gửi tính bằng tháng.', ban: 'Ô <b>NGÂN HÀNG</b> trong shop: khoá một phần tiền mặt %{tk.MOC:ds} ô.' },
      { doi: 'Ngoài đời sổ có kỳ hạn thường chốt lãi lúc gửi; loại lãi thả nổi thì đổi theo mặt bằng lãi suất chung.', ban: 'Trên bàn chỉ có loại <b>thả nổi</b>: lãi đi theo lãi suất nền, mỗi ô tính lại — kỳ họp đổi lãi là cả sổ cũ đổi theo.', loai: 'gon' },
      { doi: 'Rút trước hạn mất gần hết lãi.', ban: 'Tất toán sớm mất <b>toàn bộ</b> lãi đã dồn; tổng tài sản tụt thấy rõ.' },
      { doi: 'Tiền gửi chỉ được bảo hiểm tới một hạn mức — ở Việt Nam là 125 triệu đồng mỗi người ở mỗi ngân hàng. Ngân hàng đổ vỡ thì phần vượt có thể mất.', ban: 'Hiếm: %{nhdv.SO_LA_XAU_TRUOC:n} lá tin xấu liền nhau rồi tới lá phá sản hay cạn thanh khoản thì ngân hàng <b>đổ vỡ</b> — phần gửi vượt %{nhdv.BAO_HIEM_TOI_DA:n} chip mất %{nhdv.MAT_BP:pc}%.' },
      { doi: 'Ngân hàng chỉ nhận kỳ hạn mà nó trả nổi.', ban: 'Kỳ hạn không kịp đáo hạn trước khi bàn đóng thì không nhận.' },
      { doi: 'Ở Việt Nam, lãi kỳ hạn 12 tháng và 24 tháng thường chênh rất ít.', ban: 'Trên bàn kỳ hạn ngắn nhất được đặt thấp hơn một chút, để việc chọn kỳ hạn là một lựa chọn thật.', loai: 'gon' },
    ],
    so: [['Kỳ hạn', '%{tk.MOC:ds} ô'], ['Một năm trên bàn', '%{tk.O_MOI_NAM:n} ô'], ['Tất toán sớm', 'mất toàn bộ lãi dồn'], ['Bảo hiểm tiền gửi', 'tới %{nhdv.BAO_HIEM_TOI_DA:n} chip']],
    lq: ['cam_ket', 'lam_phat', 'duong_cong'], khung: 'GDKT&PL 10 · Lập kế hoạch tài chính cá nhân · Kỹ năng GIỮ SỔ',
  },
  {
    id: 'loi_suat_dai', nhom: 'lai', ten: 'LỢI SUẤT DÀI', anh: 'LONG-TERM YIELD', icon: 'dong_ho_cat',
    nhac: 'Lãi của tờ vay 10 năm — nhích chậm hơn lãi nền.',
    ngoai: 'Lãi ngắn hạn là thứ ngân hàng trung ương bấm được. Lãi dài hạn — như lãi trái phiếu 10 năm — là thứ cả thị trường đoán về nhiều năm tới: tăng trưởng, lạm phát, lãi suất tương lai. Vì thế khi ngân hàng trung ương tăng lãi hôm nay, lãi dài chỉ nhích theo một phần.',
    chuoi: { ten: 'VÌ SAO LÃI DÀI NHÍCH CHẬM', buoc: ['Ngân hàng trung ương tăng lãi ngắn hạn thêm 1%.', 'Người mua trái phiếu 10 năm nghĩ: vài năm nữa lãi sẽ hạ lại.', 'Họ chỉ đòi thêm một phần nhỏ cho tờ 10 năm.'], ket: 'Lãi dài tăng ít hơn lãi ngắn.' },
    doiBan: [
      { doi: 'Trái phiếu dài trả lãi theo lợi suất dài.', ban: '{tpm|Trái phiếu} trả lãi theo lợi suất dài, thẳng vào tiền mặt mỗi ô.' },
      { doi: 'Lãi dài thường chỉ đi theo một phần nhỏ mỗi cú đổi lãi chính sách.', ban: 'Lãi nền nhích thì lợi suất dài chỉ nhích theo một phần.' },
      { doi: 'Khi lãi ngắn tăng liên tiếp, lãi dài có thể thấp hơn lãi ngắn.', ban: 'Lãi tăng liên tiếp ⇒ lợi suất dài có thể tụt dưới lãi nền — {duong_cong|đường cong đảo ngược}.' },
    ],
    lq: ['duong_cong', 'tpm', 'lai_suat'], khung: 'GDKT&PL 10 · Tín dụng',
  },
  {
    id: 'duong_cong', nhom: 'lai', ten: 'ĐƯỜNG CONG ĐẢO NGƯỢC', anh: 'INVERTED YIELD CURVE', icon: 'duong_cong',
    nhac: 'Lãi ngắn cao hơn lãi dài — chỉ báo suy thoái được theo dõi kỹ nhất.',
    ngoai: 'Bình thường cho vay càng lâu thì đòi lãi càng cao, vì chờ lâu thì rủi ro hơn. Khi lãi ngắn hạn vượt lãi dài hạn, đường cong lợi suất "đảo ngược": thị trường đang đoán lãi suất sắp bị hạ vì kinh tế yếu đi.',
    chuoi: { ten: 'VÌ SAO NÓ BÁO SUY THOÁI', buoc: ['Ngân hàng trung ương tăng lãi ngắn hạn liên tục để dập lạm phát.', 'Nhà đầu tư đoán tiền đắt sẽ làm kinh tế yếu, rồi lãi sẽ bị hạ.', 'Họ mua trái phiếu dài để giữ mức lãi hiện tại, đẩy lãi dài xuống.'], ket: 'Lãi ngắn cao hơn lãi dài: thị trường đang cược vào một đoạn kinh tế yếu.' },
    nhung: 'Không phải lần đảo ngược nào cũng kéo theo suy thoái ngay: ở Mỹ, đường cong đảo ngược kéo dài từ 2022 tới 2024 mà kinh tế vẫn chưa rơi vào suy thoái trong thời gian đó.',
    chuyen: [{ nam: '2006–2009', noi: 'MỸ', cau: 'Đường cong lợi suất Mỹ đảo ngược trong 2006–2007; cuối 2007 kinh tế Mỹ bắt đầu suy thoái, kéo dài tới giữa 2009.' }],
    doiBan: [
      { doi: 'Lãi ngắn tăng nhanh hơn lãi dài.', ban: 'Lãi tăng liên tiếp ⇒ {loi_suat_dai|lợi suất dài} tụt dưới lãi nền, màn báo <b>ĐƯỜNG CONG ĐẢO NGƯỢC</b>.' },
      { doi: 'Lúc đó gửi ngắn hạn lời hơn cho vay dài.', ban: '{tiet_kiem|Gửi tiết kiệm} trả cao hơn trái phiếu dài.' },
      { doi: 'Đường cong thật có đủ các kỳ hạn, từ 3 tháng tới 30 năm.', ban: 'Bàn chỉ có hai điểm: lãi nền và lợi suất dài.', loai: 'gon' },
    ],
    lq: ['loi_suat_dai', 'tiet_kiem', 'chu_ky'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },

  // ═══ RỦI RO ════════════════════════════════════════════════════════════
  {
    id: 'goi_ky_quy', nhom: 'rui', ten: 'GỌI KÝ QUỸ', anh: 'MARGIN CALL', icon: 'dien_thoai',
    nhac: 'Vốn tụt dưới mức duy trì thì bị thu ngay, không chờ bạn bán.',
    ngoai: 'Vay tiền công ty chứng khoán để mua cổ phiếu (mua ký quỹ) thì tài khoản buộc giữ một tỷ lệ vốn của chính mình. Giá rơi làm tỷ lệ ấy tụt dưới ngưỡng thì bị "gọi ký quỹ": nộp thêm tiền, hoặc công ty chứng khoán tự bán bớt cổ phiếu của bạn — thường đúng lúc giá xấu nhất.',
    viDu: 'Ở Việt Nam, tiền của mình tối thiểu 50% lúc mua, và tỷ lệ duy trì tối thiểu là 30%.',
    chuoi: { ten: 'VÌ SAO GỌI KÝ QUỸ LÀM GIÁ RƠI THÊM', buoc: ['Giá rơi, hàng loạt tài khoản vay chạm ngưỡng.', 'Công ty chứng khoán bán giải chấp cổ phiếu của những người đó.', 'Lệnh bán dồn dập đẩy giá rơi thêm, chạm ngưỡng của người khác.'], ket: 'Vòng xoáy bán tháo.', huong: 'xuong' },
    chuyen: [
      { nam: '3/2021', noi: 'MỸ', cau: 'Quỹ Archegos dùng đòn bẩy rất cao. Cổ phiếu quỹ ôm giảm khoảng 30% trong bốn ngày; ngân hàng gọi ký quỹ, quỹ không nộp nổi, ngân hàng bán tháo khoảng 20 tỷ đô cổ phiếu và tự mất hơn 10 tỷ đô.', so: [['Bán tháo', '≈ 20 tỷ đô trong vài ngày', 'xuong']] },
      { nam: 'Cuối 2022', noi: 'VIỆT NAM', cau: 'Chợ giảm sâu, công ty chứng khoán liên tục bán giải chấp cổ phiếu của người vay ký quỹ; nhiều mã giảm sàn nhiều phiên liền.' },
    ],
    doiBan: [
      { doi: 'Chỉ người vay mới bị gọi ký quỹ.', ban: 'Chỉ xảy ra trong màn lõi, khi đang vay bằng {don_bay|Đòn Bẩy} hoặc {ban_khong|Bán Khống}.' },   // D530 — v60: hết ký quỹ tầng vòng
      { doi: 'Bên cho vay không chờ bạn quyết định.', ban: 'Giá chạm ngưỡng ⇒ bị gọi: nạp thêm, hoặc bán hết; chạm {san_thanh_ly|sàn thanh lý} thì bị bán cưỡng bức.' },
      { doi: 'Cú sập nhanh làm lỗ vượt xa ngưỡng trước khi kịp phản ứng.', ban: 'Cú bán cưỡng bức đẩy giá chạm sàn của người vay kế tiếp — {thanh_ly_day_chuyen|thanh lý dây chuyền}.' },
      { doi: 'Ngoài đời bị bán giải chấp thì mất bao nhiêu tuỳ giá lúc bán.', ban: 'Trong màn cũng vậy: bị thanh lý ở giá lúc chạm sàn, trượt thêm nếu cả bầy cùng bán.' },
    ],
    lq: ['don_bay', 'ca_map', 'ban_thao'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'khau_vi', nhom: 'rui', ten: 'KHẨU VỊ RỦI RO', anh: 'RISK APPETITE', icon: 'ot',
    nhac: 'Chịu được lên xuống tới đâu — lộ ra ở cách bạn chia tiền.',
    ngoai: 'Khẩu vị rủi ro là mức lên xuống của tiền mà một người chịu được mà vẫn ngủ ngon và giữ kế hoạch. Nó khác nhau theo tuổi, thu nhập, mục tiêu. Người ta hay tự nhận mình "chịu chơi" lúc chợ đang tăng — rồi đổi ý rất nhanh khi tài khoản đỏ.',
    viDu: 'Câu hỏi khảo sát quen thuộc: "Nếu danh mục của bạn giảm 20% trong một tháng, bạn làm gì?"',
    chuoi: { ten: 'VÌ SAO KHẨU VỊ ĐO LÚC BÌNH TĨNH', buoc: ['Chợ tăng: ai cũng thấy mình gan.', 'Chợ giảm: nỗi đau mất tiền nặng khoảng gấp đôi niềm vui được chừng ấy tiền.', 'Người chọn mức rủi ro lúc hưng phấn thường bán tháo lúc hoảng.'], ket: 'Chọn trước, lúc còn tỉnh, thì giữ được kế hoạch.' },
    doiBan: [
      { doi: 'Khẩu vị là lựa chọn của từng người.', ban: 'Mọi ghế chơi <b>cùng một hệ số</b>; khẩu vị hiện ra ở cách bạn chia tiền — dồn vào mã biến động mạnh là phóng to cả lãi lẫn lỗ, gửi {tiet_kiem|sổ} là thu nhỏ cả hai.' },
      { doi: 'Đổi khẩu vị giữa cơn hoảng là lúc dễ sai nhất.', ban: 'Chia lại tiền giữa trận thì tốn phí và {truot_gia|trượt giá} — đổi ý có giá.' },
    ],
    lq: ['don_bay', 'da_dang', 'cam_ket'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },

  // ═══ HÀNH VI ═══════════════════════════════════════════════════════════
  {
    id: 'hieu_chinh', nhom: 'hv', ten: 'HIỆU CHỈNH NIỀM TIN', anh: 'CALIBRATION', icon: 'ngam',
    nhac: 'Tin chắc bao nhiêu thì đúng bấy nhiêu.',
    ngoai: 'Một người "hiệu chỉnh tốt" khi những việc họ nói chắc 70% thì xảy ra khoảng 70% số lần. Dự báo thời tiết là ví dụ quen: những ngày báo 30% khả năng mưa thì khoảng 3 trên 10 ngày như vậy có mưa. Nhà nghiên cứu Philip Tetlock theo dõi hàng nghìn dự báo và thấy kỹ năng này luyện được.',
    chuoi: { ten: 'VÌ SAO "CHẮC CHẮN" LÀ CÁI BẪY', buoc: ['Người tự tin quá mức đặt cược to vào những điều chỉ đúng một nửa.', 'Họ thắng vài lần, tin mình giỏi.', 'Một lần sai to xoá sạch mọi lần thắng.'], ket: 'Biết mình chắc tới đâu quý hơn đoán trúng một lần.' },
    doiBan: [
      { doi: 'Đo hiệu chỉnh đòi nhiều dự báo, đem so với kết quả thật.', ban: 'Dấu kỹ năng <b>LỌC TIN</b> đọc điểm Brier trên các vòng có tin — càng thấp càng bám kết quả.' },
      { doi: 'Vài lần đoán không nói lên gì.', ban: 'Chưa đủ vòng hoặc đủ tin thì dấu ghi <b>chưa gặp</b>, không ghi điểm kém.' },
    ],
    lq: ['tin_gia', 'tin_dan_dat'], khung: 'OECD/INFE · Bối cảnh tài chính — thông tin sai, lừa đảo · Kỹ năng LỌC TIN',
  },
  {
    id: 'cam_ket', nhom: 'hv', ten: 'CAM KẾT TRƯỚC', anh: 'COMMITMENT DEVICE', icon: 'lock',
    nhac: 'Tự khoá lựa chọn của mình trước khi cám dỗ tới.',
    ngoai: 'Kinh tế học hành vi gọi đó là cơ chế cam kết: tự đặt ràng buộc lúc đầu óc còn tỉnh — như chuyển tiền sang tài khoản khó rút ngay ngày nhận lương. Thần thoại Hy Lạp kể Ulysses bảo thuỷ thủ trói mình vào cột buồm, để nghe tiếng hát mê hoặc mà không lao xuống biển.',
    chuyen: [{ nam: '2004', noi: 'MỸ', cau: 'Chương trình "Tiết kiệm nhiều hơn vào ngày mai" của hai nhà kinh tế Richard Thaler và Shlomo Benartzi: nhân viên cam kết từ trước sẽ dành một phần các lần tăng lương sau này để tiết kiệm. Sau khoảng 40 tháng, tỷ lệ tiết kiệm của người tham gia tăng từ 3,5% lên 13,6%.', so: [['Tỷ lệ tiết kiệm', '3,5% → 13,6%', 'len']] }],
    doiBan: [
      { doi: 'Cam kết có giá trị vì phá nó thì mất gì đó.', ban: 'Kiểu cam kết trên bàn là {tiet_kiem|gửi tiết kiệm}: đổi ý giữa chừng thì mất phần thưởng.' },
      { doi: 'Giữ được cam kết là một thói quen đo được.', ban: 'Dấu kỹ năng <b>GIỮ SỔ</b>: mở sổ và giữ tới hạn, không rút sớm lần nào.' },
    ],
    lq: ['tiet_kiem', 'khau_vi'], khung: 'GDKT&PL 10 · Lập kế hoạch tài chính cá nhân · Kỹ năng GIỮ SỔ',
  },
  {
    id: 'gia_thong_tin', nhom: 'hv', ten: 'THÔNG TIN CÓ GIÁ', anh: 'COST OF INFORMATION', icon: 'chart',
    nhac: 'Thông tin không làm bạn thắng — nó thu hẹp chỗ đoán mò.',
    ngoai: 'Dữ liệu tốt tốn tiền hoặc tốn thời gian: báo cáo phân tích, bảng giá thời gian thực, dịch vụ tin tức. Một màn hình Bloomberg — công cụ quen thuộc của dân tài chính — tốn hơn 20.000 đô mỗi năm. Câu hỏi đáng giá: thông tin thêm có đổi được quyết định không, hay chỉ làm người ta tự tin hơn?',
    chuoi: { ten: 'KHI NÀO THÔNG TIN ĐÁNG TIỀN', buoc: ['Bạn sắp quyết một việc giữa vài lựa chọn.', 'Thông tin mới loại bớt được lựa chọn sai.'], ket: 'Không loại được gì thì dù hay tới đâu, nó cũng không đáng tiền.' },
    doiBan: [
      { doi: 'Có loại dữ liệu cho thấy dư âm của tin và chỗ đám đông đang dồn.', ban: '<b>BẢNG ĐIỆN TỬ</b> cho thấy dư âm tin cũ còn vang cỡ nào và mã nào đang bị đám đông đè.' },
      { doi: 'Dữ liệu tính tiền theo kỳ; xem lại trong cùng kỳ không tốn thêm.', ban: 'Mỗi vòng, lần mở đầu tốn phí; mở lại trong cùng vòng không tốn thêm. Phí vào Quỹ vòng.' },
      { doi: 'Dữ liệu sạch và nhanh đắt hơn dữ liệu trễ — người sống bằng dữ liệu giá sẵn lòng trả.', ban: 'Không cầm lá thì bảng trễ một vòng; lá {luot_song|Lướt Sóng} mở hạng bảng sạch.' },
    ],
    so: [['Phí mở bảng · không lá', '%{gia.thuong:n} chip · một lần mỗi vòng'], ['Phí mở bảng · cầm Lướt Sóng', '%{gia.luot_song:n} chip']],
    lq: ['luot_song', 'hieu_chinh'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
];
