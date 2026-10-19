/**
 * MỤC BÁCH KHOA — VAI · SÁU MÃ (D334). Luật chữ: xem `kieu.ts`.
 * Số liệu NGOÀI ĐỜI kiểm nguồn 14/09: FiinTrade (cá nhân > 80% giá trị giao dịch 2024) · VSD (1,5 triệu tài khoản
 * mới 2021) · Luật Chứng khoán 2019 Đ.110 (quỹ đại chúng ≤ 20%/tổ chức phát hành) · CNBC/ESMA (Archegos 3/2021) ·
 * VN-Index 12/03/2007 1.170,67 → 24/02/2009 235,5.
 */
import type { MucBK } from './kieu';

export const MUC_VAI_MA: readonly MucBK[] = [
  // ═══ VAI ═══════════════════════════════════════════════════════════════
  {
    id: 'chia_vai', nhom: 'vai', ten: 'CHIA VAI', anh: 'ROLE DRAW', icon: 'la_vai',
    nhac: 'Đầu trận mỗi ghế bốc một vai: một quyền riêng và một cái giá riêng.',
    ngoai: 'Ngoài đời không ai bắt đầu giống ai. Người đi làm có vài chục triệu để dành; một quỹ đầu tư cầm tiền của hàng nghìn người; một tay chơi lớn có cả trăm tỷ. Mỗi người một lượng tiền, một bộ luật áp lên mình, một lợi thế riêng — và không ai được chọn hoàn cảnh xuất phát.',
    viDu: 'Trên sàn chứng khoán Việt Nam, nhà đầu tư cá nhân tạo ra hơn 80% giá trị giao dịch, nhưng mỗi người chỉ cầm một phần rất nhỏ. Bàn đông ghế cũng vậy: phần lớn là ghế cá nhân, mỗi vai lớn tối đa một ghế.',
    doiBan: [
      { doi: 'Không ai chọn được hoàn cảnh xuất phát của mình.', ban: 'Vai được bốc thăm lúc dựng bàn — không chọn, không đổi giữa trận.' },
      { doi: 'Cổ đông lớn có nghĩa vụ công bố khi mua bán; cả chợ biết ai là cá lớn.', ban: 'Vai lộ cho cả bàn ngay màn CHIA VAI.' },
      { doi: 'Một quỹ nghìn tỷ lãi 10% vẫn kém một người vốn nhỏ lãi 20% — hiệu quả đo bằng phần trăm.', ban: 'Hạng tính theo <b>% tăng so với vốn khởi điểm của chính vai</b>, không theo số chip.' },
      { doi: 'Ngoài đời tay chơi lớn có vốn to hơn hẳn; trên bàn vốn to che mất cái thật sự khác nhau giữa các vai.', ban: 'Trận thật: <b>mọi ghế cùng vốn</b> — vai khác nhau ở quyền và cái giá. Bàn tập còn luật cũ: vai lớn cầm vốn to hơn.', loai: 'luat' },
      { doi: 'Cùng một người cầm nhiều vai qua nhiều trận thì tách được thói quen của NGƯỜI khỏi áp lực của VAI.', ban: 'Mỗi trận ghi lại vai; con số mà vai ép ra (cá mập buộc vào to) không bị đọc thành tính cách.', loai: 'luat' },
      { doi: 'Chợ càng đông càng có chỗ cho nhiều tay to cùng lúc — và quỹ đại chúng gần như luôn có mặt.', ban: 'Trận có màn lõi: bàn nhỏ một vai lớn; bàn vừa luôn có {to_chuc|Tổ Chức} cùng {ca_map|Cá Mập} hoặc {doi_lai|Đội Lái} — không bao giờ Cá Mập cùng Đội Lái; bàn đầy đủ thì cả ba, mỗi vai một ghế.', loai: 'luat' },
    ],
    so: [['Bàn đông ghế', 'mỗi vai lớn tối đa một ghế · còn lại cá nhân'], ['Xếp hạng', '% tăng so vốn khởi điểm của vai']],
    lq: ['ca_nhan', 'doi_lai', 'ca_map', 'to_chuc'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
  {
    id: 'ca_nhan', nhom: 'vai', vai: 'ca_nhan', ten: 'NHÀ ĐẦU TƯ CÁ NHÂN', anh: 'RETAIL INVESTOR', icon: 'user',
    nhac: 'Không đặc quyền nào, nhưng cũng không luật nào trói tay.',
    ngoai: 'Người tự bỏ tiền túi ra đầu tư: nhân viên văn phòng mua vài trăm cổ phiếu, sinh viên mua chút vàng, chút crypto. Không báo cáo cho ai, không có hạn mức nào — muốn dồn hết vào một mã hay ngồi cầm tiền mặt cả năm đều được.',
    viDu: 'Năm 2021 người Việt mở mới hơn 1,5 triệu tài khoản chứng khoán — gấp rưỡi bốn năm trước đó cộng lại.',
    doiBan: [
      { doi: 'Người đầu tư nhỏ lẻ là số đông trên sàn.', ban: 'Phần lớn ghế ở bàn là ghế cá nhân.' },
      { doi: 'Tiền ít thì mua bán không làm giá nhúc nhích.', ban: 'Lệnh đẩy giá ở mức chuẩn của bàn — nhẹ hơn hẳn {ca_map|cá mập}.' },
      { doi: 'Không quỹ nào đặt hạn mức, không ai soi hồ sơ.', ban: 'Không lõi nào ghim sẵn, không siết pháp lý, không trần tỷ trọng riêng.' },
      { doi: 'Người lẻ cũng hay biết tin muộn nhất.', ban: 'Vai không kèm quyền thông tin nào.' },
    ],
    so: [['Vốn khởi điểm', '×%{vai.ca_nhan.he_so_von:thuc}'], ['Tác động giá', '×%{vai.ca_nhan.tac_dong_gia:thuc}']],
    lq: ['chia_vai', 'mua_duoi', 'chen_chuc'], khung: 'OECD/INFE · Bối cảnh tài chính',
  },
  {
    id: 'doi_lai', nhom: 'vai', vai: 'doi_lai', ten: 'ĐỘI LÁI', anh: 'PUMP GROUP', icon: 'bolt',
    nhac: 'Gom vốn lớn tạo sóng giá, rồi lướt trên chính con sóng đó.',
    ngoai: 'Ở chứng khoán Việt Nam, "đội lái" là cách gọi nhóm người gom nhiều tiền, cùng mua một mã để kéo giá, tung tin để người khác lao vào mua đuổi, rồi bán ra ở giá cao. Làm giá như vậy là thao túng thị trường — Bộ luật Hình sự Việt Nam có riêng một tội danh cho hành vi này.',
    viDu: 'Kịch bản quen thuộc: một mã ít tên tuổi tăng trần nhiều phiên liền, hội nhóm rỉ tai "sắp có tin lớn", người vào sau mua ở đỉnh — rồi giá rơi về chỗ cũ.',
    chuoi: { ten: 'MỘT CON SÓNG DO ĐỘI LÁI DỰNG', buoc: ['Gom hàng lặng lẽ khi giá còn thấp.', 'Kéo giá lên vài phiên để bảng giá "đẹp".', 'Tung tin, hội nhóm hô hào — người mới nhảy vào.', 'Bán dần cho chính những người mới ấy.'], ket: 'Hết người mua, giá sập; người vào sau ôm hàng.' },
    doiBan: [
      // D525 — khung minigame (v57+, D482/D483): vai ghim TRAIT, không ghim lõi.
      { doi: 'Đội lái sống bằng việc dựng nhịp giá — và tung tin để người khác lao vào.', ban: 'Trait ghim TUNG TIN: đầu màn lõi được gài một tin giả, đám đông nhảy theo đẩy giá tạm rồi tan. Gài tin mất phí.' },
      { doi: 'Người tung tin biết tin nào do mình bịa.', ban: 'Thêm một lá Lướt Sóng là lên cấp hai: xác thực được tin thật, tin giả.' },
      { doi: 'Làm giá đòi một khoản tiền lớn.', ban: 'Vốn khởi điểm ×%{vai.doi_lai.he_so_von:thuc} so với vốn cơ bản.' },
      { doi: 'Nhà chức trách soi kỹ ai ôm quá nhiều một mã lúc giá bất thường.', ban: 'Ôm vị thế to đúng lúc ô {tb_phap_ly|Siết pháp lý} nổ ⇒ bị trừ thẳng vốn.' },
      { doi: 'Ngoài đời đội lái kéo giá bằng sức mua của chính mình.', ban: 'Trên bàn phần "lái" nằm ở quyền đọc tin; sức đẩy giá của lệnh là ×%{vai.doi_lai.tac_dong_gia:thuc}.', loai: 'gon' },
    ],
    so: [['Vốn khởi điểm', '×%{vai.doi_lai.he_so_von:thuc}'], ['Tác động giá', '×%{vai.doi_lai.tac_dong_gia:thuc}']],
    lq: ['luot_song', 'tin_gia', 'tb_phap_ly'], khung: 'OECD/INFE · Bối cảnh tài chính — thông tin sai, lừa đảo',
  },
  {
    id: 'ca_map', nhom: 'vai', vai: 'ca_map', ten: 'CÁ MẬP', anh: 'WHALE', icon: 'rank_ca_map',
    nhac: 'Vay thêm để đánh to — và mỗi lệnh tự đẩy giá chống lại mình.',
    ngoai: '"Cá mập" là cách gọi nhà đầu tư có lượng tiền đủ lớn để làm giá dịch chuyển mỗi khi họ mua bán. Nhiều tay chơi lớn còn vay thêm để vị thế to hơn vốn thật: đúng thì lãi rất đậm, sai thì bên cho vay đòi tiền ngay.',
    chuoi: { ten: 'VÌ SAO LỆNH TO TỰ ĐẨY GIÁ', buoc: ['Cá mập muốn mua một triệu cổ phiếu.', 'Người bán ở giá rẻ nhất chỉ treo vài chục nghìn cổ.', 'Lệnh ăn hết lớp giá rẻ, leo sang lớp đắt hơn, rồi lớp đắt hơn nữa.'], ket: 'Giá trung bình cá mập trả cao hơn hẳn giá lúc bấm — và cả chợ thấy giá đang chạy.' },
    doiBan: [
      // D525 — khung minigame (v57+, D482): vai ghim TRAIT, không ghim lõi.
      { doi: 'Tiền lớn thường đi cùng tiền vay: tay chơi lớn được cấp hạn mức vay rộng.', ban: 'Trait ghim ĐÒN BẨY: trong màn lõi, {don_bay|Đòn Bẩy} của cá mập ăn mạnh hơn ghế thường (số ở dòng QUYỀN).' },
      { doi: 'Tay to dàn tiền vay lên nhiều mã cùng lúc.', ban: 'Thêm một lá Đòn Bẩy là lên cấp hai: nhắm được hai mã.' },
      { doi: 'Lệnh càng to so với lượng hàng đang treo, giá khớp càng xấu.', ban: 'Lệnh của cá mập đẩy giá và chịu {truot_gia|trượt giá} ×%{vai.ca_map.tac_dong_gia:thuc} so với ghế thường.' },
      { doi: 'Vay để đầu tư thì lỗ tới ngưỡng là bị thu tiền ngay.', ban: 'Vòng lỗ quá ngưỡng lúc cầm Đòn Bẩy ⇒ {goi_ky_quy|gọi ký quỹ}.' },
      { doi: 'Vốn to không có nghĩa là giỏi.', ban: 'Hạng tính theo % tăng so với vốn khởi điểm của chính mình.' },
    ],
    so: [['Vốn khởi điểm', '×%{vai.ca_map.he_so_von:thuc}'], ['Tác động giá · trượt giá', '×%{vai.ca_map.tac_dong_gia:thuc}']],
    lq: ['don_bay', 'goi_ky_quy', 'truot_gia'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'to_chuc', nhom: 'vai', vai: 'to_chuc', ten: 'TỔ CHỨC', anh: 'INSTITUTION', icon: 'hall',
    nhac: 'Cầm tiền của người khác — bị luật đặt trần, bù lại có dữ liệu và khớp lệnh êm.',
    ngoai: 'Quỹ đầu tư, công ty bảo hiểm, quỹ hưu trí gom tiền của rất nhiều người rồi đầu tư thay họ. Vì là tiền của người khác, luật và điều lệ quỹ trói tay khá chặt: mỗi mã chỉ được bỏ tới một mức, nhiều kiểu lệnh bị cấm. Đổi lại họ có đội phân tích, dữ liệu dòng tiền và bàn giao dịch chuyên nghiệp.',
    viDu: 'Luật Chứng khoán 2019 của Việt Nam: quỹ đại chúng không được bỏ quá 20% tổng tài sản vào chứng khoán của một tổ chức phát hành (trừ trái phiếu chính phủ).',
    doiBan: [
      { doi: 'Quỹ bị luật buộc rải tiền ra nhiều nơi.', ban: 'Trần %{mandate.TRAN_MA_BP:pc}% tổng tài sản cho mỗi mã — càng vào chợ nhiều, tiền càng bị rải ra nhiều mã.' },
      { doi: 'Nhiều quỹ gom tiền của người dân không được bán khống.', ban: 'Ghế tổ chức không mở được {ban_khong|Bán Khống}.' },
      { doi: 'Quỹ lớn mua dữ liệu dòng tiền, theo dõi khối ngoại, tự doanh — biết tiền đang chảy về đâu.', ban: 'Thấy DÒNG TIỀN cả bàn: mã nào đang đông, mã nào vắng.' },
      { doi: 'Lô lớn được chia nhỏ bằng thuật toán hoặc giao dịch thoả thuận ngoài sổ lệnh, ít làm giá chạy.', ban: 'Lệnh của tổ chức chịu tác động giá ×%{vai.to_chuc.tac_dong_gia:thuc} so với ghế thường.' },
      { doi: 'Trần mỗi mã của quỹ đại chúng Việt Nam thấp hơn nhiều.', ban: 'Bàn chỉ có sáu mã và giữ được vài mã một lúc; trần của vai đặt rộng hơn luật quỹ thật.', loai: 'gon' },
      // D501 — trận có màn lõi (D498–D500)
      { doi: 'Quỹ gom tiền của người dân không được vay ký quỹ để mua thêm.', ban: 'Trận có màn lõi: Tổ Chức <b>không margin</b> — không có lõi {don_bay|Đòn Bẩy}, không {ban_khong|Bán Khống}.' },
      { doi: 'Quy chế quỹ có hạn mức dừng lỗ; chạm là bộ phận rủi ro tự cắt, người quản lý quỹ không gồng tiếp được.', ban: 'Trong {man_loi|màn lõi}, lỗ chạm %{mg.to_chuc_tran_bp:pc}% vốn màn thì tự chốt đúng giá trần — búa pháp lý hiện ra, nút khoá tới hết màn.' },
      { doi: 'Lô lớn khớp được bằng giao dịch thoả thuận ngay cả khi sổ lệnh cạn người mua.', ban: 'Nến TRẮNG vẫn khớp được (thoả thuận), chỉ trượt giá ×%{mg.thoa_thuan:thuc}.' },
      { doi: 'Quỹ thu phí quản lý cố định, lời hay lỗ đều thu.', ban: 'Mỗi vòng nhận phí quản lý %{mg.phi_ql_bp:pc}% NAV vào tiền mặt.' },
      { doi: 'Quỹ có đội phân tích đưa ra kịch bản và xác suất, không đưa ra đáp án.', ban: 'Màn lõi có dải XÁC SUẤT dưới chân đồ thị: khả năng tạo đáy (đỏ) và tạo đỉnh (xanh) theo từng khúc thời gian — xác suất của mô hình, không phải toạ độ giá.' },
    ],
    so: [['Vốn khởi điểm', '×%{vai.to_chuc.he_so_von:thuc}'], ['Trần mỗi mã', '%{mandate.TRAN_MA_BP:pc}% tổng tài sản'], ['Tác động giá', '×%{vai.to_chuc.tac_dong_gia:thuc}']],
    lq: ['da_dang', 'ban_khong', 'chen_chuc'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },

  // ═══ SÁU MÃ ════════════════════════════════════════════════════════════
  {
    id: 'crypto', nhom: 'ma', ma: 'btc', ten: 'CRYPTO', anh: 'CRYPTOCURRENCY', icon: 'crypto',
    nhac: 'Sổ lệnh mỏng, lên xuống mạnh nhất bàn.',
    ngoai: 'Tiền mã hoá như Bitcoin là tiền chỉ tồn tại trên mạng. Không ngân hàng nào phát hành, không công ty nào đứng sau trả lãi hay chia lời. Giá của nó chỉ đến từ việc lúc đó bao nhiêu người muốn mua — vì thế nó có thể gấp đôi trong vài tháng, hoặc mất một nửa trong vài tuần.',
    chuoi: { ten: 'VÌ SAO NÓ LÊN XUỐNG MẠNH', buoc: ['Không có lợi nhuận hay tiền lãi nào neo giá.', 'Giá chỉ còn dựa vào niềm tin và dòng tiền.', 'Tiền rẻ, tin tốt: người mua đổ vào dồn dập.', 'Tiền đắt, tin xấu: ai cũng muốn thoát cùng lúc, người mua thưa thớt.'], ket: 'Biên độ lớn nhất trong sáu mã.' },
    chuyen: [
      { nam: '2020–2021', noi: 'THẾ GIỚI', cau: 'Các ngân hàng trung ương hạ lãi suất về gần 0 để chống dịch. Bitcoin từ dưới 5.000 đô (giữa tháng 3/2020) lên gần 69.000 đô (11/2021).', so: [['Bitcoin', 'dưới 5.000 → gần 69.000 đô', 'len']] },
      { nam: '2022', noi: 'THẾ GIỚI', cau: 'Mỹ tăng lãi suất nhanh nhất mấy chục năm, sàn FTX sụp đổ. Bitcoin kết thúc năm quanh 16.500 đô.', so: [['Bitcoin cả năm', 'mất khoảng 2/3', 'xuong']] },
    ],
    doiBan: [
      { doi: 'Ít người treo sẵn lệnh ở mỗi mức giá, nhất là lúc hoảng.', ban: 'Sổ lệnh %{ts.btc.thanh_khoan:so} — {truot_gia|trượt giá} gốc cao nhất bàn.' },
      { doi: 'Biến động một năm của Bitcoin thường khoảng 65% — gấp ba rổ cổ phiếu lớn.', ban: 'Biến động nền hạng %{hang.btc:n} trong sáu mã.' },
      { doi: 'Tiền đổ vào nhanh thì bong bóng thổi nhanh.', ban: '{suc_cang|Sức căng} nạp nhanh hơn mã sổ vừa.' },
      { doi: 'Tin tiền rẻ nâng nó mạnh nhất; tin sàn khoá rút tiền đánh nó đau nhất.', muc: { loai: 'ma_sk', ma: 'btc', sk: ['ha_lai_suat', 'bong_bong', 'hack_san', 'dich_benh'] } },
      { doi: 'Ngoài đời crypto còn dữ dội hơn nữa.', ban: 'Biến động trên bàn được nén lại một chút, để một cú đoán đúng không thành chắc thắng.', loai: 'gon' },
    ],
    so: [['Phe', '%{ts.btc.nhom:phe}'], ['Sổ lệnh', '%{ts.btc.thanh_khoan:so}'], ['Biến động nền', 'hạng %{hang.btc:n} trong sáu mã'], ['Bán khống', '%{ts.btc.khong_duoc:khong}']],
    lq: ['thanh_khoan', 'suc_cang', 'tb_sap_san'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'cpck', nhom: 'ma', ma: 'cp_cn', ten: 'CỔ TECH', anh: 'TECH STOCK', icon: 'bang_dien',
    nhac: 'Cổ phiếu nhóm công nghệ — chợ lên nó lên mạnh hơn, chợ xuống nó rơi sâu hơn.',
    ngoai: 'Cổ tech trên bàn giống nhóm cổ phiếu công nghệ ngoài đời — kiểu rổ Nasdaq 100 ở Mỹ: phần mềm, chip, mạng, thương mại điện tử. Người mua trả giá cao hôm nay cho lợi nhuận họ tin sẽ đến nhiều năm sau. Tiền rẻ và niềm tin cao thì giá bay xa; lãi suất lên hay niềm tin nguội thì rơi cũng xa.',
    chuoi: { ten: 'VÌ SAO NÓ CHẠY XA HƠN CHỢ', buoc: ['Phần lớn giá trị nằm ở lợi nhuận còn xa trong tương lai.', 'Lãi suất thấp: khoản lợi nhuận xa ấy được định giá cao.', 'Lãi suất lên: chính khoản ấy bị chiết khấu mạnh nhất.'], ket: 'Giá cổ phiếu của nó đi xa hơn chỉ số — theo cả hai chiều.' },
    chuyen: [
      { nam: '2020', noi: 'MỸ', cau: 'Lãi suất về gần 0, cả thế giới làm việc và mua sắm qua mạng.', so: [['Rổ 500 mã lớn (S&P 500)', '≈ +16%', 'len'], ['Rổ công nghệ (Nasdaq 100)', '≈ +48%', 'len']] },
      { nam: '2022', noi: 'MỸ', cau: 'Mỹ tăng lãi suất nhanh nhất mấy chục năm.', so: [['Rổ 500 mã lớn (S&P 500)', '≈ −19%', 'xuong'], ['Rổ công nghệ (Nasdaq 100)', '≈ −33%', 'xuong']] },
    ],
    doiBan: [
      { doi: 'Cổ phiếu công nghệ đi cùng nhịp chợ nhưng biên độ lớn hơn.', ban: 'Phe %{ts.cp_cn.nhom:phe}, bám nhịp chung của chợ còn chặt hơn Blue-chip.' },
      { doi: 'Luật siết (độc quyền, dữ liệu), chợ cạn tiền, lạm phát kéo lãi suất lên — đều đánh mạnh vào nhóm định giá bằng tương lai.', muc: { loai: 'ma_sk', ma: 'cp_cn', sk: ['phap_ly', 'hack_san', 'lam_phat'] } },
      { doi: 'Sàn Việt Nam chưa cho bán khống cổ phiếu cơ sở.', ban: 'Bán khống: <b>%{ts.cp_cn.khong_duoc:khong}</b>.' },
      { doi: 'Một nhóm ngành hẹp dao động mạnh hơn rổ trải đều nhiều ngành.', ban: 'Biến động nền hạng %{hang.cp_cn:n} trong sáu mã.' },
    ],
    so: [['Phe', '%{ts.cp_cn.nhom:phe}'], ['Sổ lệnh', '%{ts.cp_cn.thanh_khoan:so}'], ['Biến động nền', 'hạng %{hang.cp_cn:n} trong sáu mã'], ['Bán khống', '%{ts.cp_cn.khong_duoc:khong}']],
    lq: ['vn30', 'ban_khong', 'tb_phap_ly'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'vn30', nhom: 'ma', ma: 'vn30', ten: 'BLUE-CHIP', anh: 'LARGE-CAP STOCKS', icon: 'ro30',
    nhac: 'Cổ phiếu của những công ty lớn nhất sàn — một lát cắt cả nền kinh tế.',
    ngoai: 'Blue-chip trên bàn giống rổ VN30 ngoài đời: 30 cổ phiếu vốn hoá lớn và giao dịch nhiều nhất sàn TP.HCM — ngân hàng, bất động sản, thép, bán lẻ… Mua cả rổ giống mua một lát cắt nền kinh tế thay vì đặt cược vào một công ty: một mã rơi thì các mã khác đỡ bớt.',
    chuoi: { ten: 'VÌ SAO RỔ ÊM HƠN MỘT MÃ', buoc: ['Một công ty có thể làm ăn thua lỗ, 30 công ty lớn hiếm khi cùng lúc.', 'Cái xui riêng của từng công ty bù trừ nhau trong rổ.', 'Còn lại chủ yếu là cái chung của cả nền kinh tế.'], ket: 'Dao động ít hơn một cổ phiếu lẻ, nhưng vẫn theo nhịp kinh tế.' },
    chuyen: [
      { nam: '2007–2009', noi: 'VIỆT NAM', cau: 'Chỉ số chung VN-Index lập đỉnh 1.170 điểm (3/2007) giữa cơn sốt, rồi rơi còn 235 điểm (2/2009) sau bong bóng và khủng hoảng toàn cầu.', so: [['VN-Index', '1.170 → 235 điểm', 'xuong']] },
    ],
    doiBan: [
      { doi: '30 mã lớn nhất có rất nhiều người mua bán mỗi ngày.', ban: 'Sổ lệnh %{ts.vn30.thanh_khoan:so} — lệnh to ít trượt.' },
      { doi: 'Có hợp đồng tương lai VN30 để đặt cửa giảm.', ban: 'Bán khống: %{ts.vn30.khong_duoc:khong}.' },
      { doi: 'Chợ Việt Nam lên thì từ từ, xuống thì rất sâu: nhiều năm tăng nhẹ, vài năm giảm mạnh.', muc: { loai: 'ma_gd', ma: 'vn30', gd: ['tang', 'giam'] } },
      { doi: 'Biến động một năm của rổ lớn khoảng 20%.', ban: 'Biến động nền hạng %{hang.vn30:n} — là mốc để so các mã khác.' },
    ],
    so: [['Phe', '%{ts.vn30.nhom:phe}'], ['Sổ lệnh', '%{ts.vn30.thanh_khoan:so}'], ['Biến động nền', 'hạng %{hang.vn30:n} trong sáu mã'], ['Bán khống', '%{ts.vn30.khong_duoc:khong}']],
    lq: ['da_dang', 'thanh_khoan', 'chu_ky'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'vang', nhom: 'ma', ma: 'vang', ten: 'VÀNG', anh: 'GOLD', icon: 'vang',
    nhac: 'Không trả lãi — giá trị nằm ở chỗ ai cũng tin nó.',
    ngoai: 'Người ta cất vàng suốt hàng nghìn năm. Vàng không sinh lãi, không chia cổ tức — một chỉ vàng để mười năm vẫn là một chỉ. Nhưng khi tiền giấy mất giá, chiến tranh nổ ra hay ngân hàng lung lay, vàng là thứ nhiều người tìm đến đầu tiên.',
    chuoi: { ten: 'VÌ SAO LÚC HOẢNG THÌ VÀNG LÊN', buoc: ['Tin xấu lớn: chiến tranh, dịch bệnh, ngân hàng đổ.', 'Người ta sợ mất tiền trong cổ phiếu, crypto, cả tiền gửi.', 'Họ tìm thứ không phụ thuộc lời hứa của công ty hay ngân hàng nào.'], ket: 'Nhiều người cùng mua vàng ⇒ giá vàng lên.', huong: 'len' },
    nhung: 'Vàng không phải lúc nào cũng thắng. Khi lãi suất cao, gửi tiết kiệm có lãi còn vàng thì không — giữ vàng là bỏ lỡ phần lãi ấy. Và lúc chợ đang tăng đều, vàng thường đứng yên hoặc giảm.',
    chuyen: [
      { nam: '2020', noi: 'THẾ GIỚI', cau: 'Dịch bệnh lan khắp thế giới, lãi suất về gần 0: giá vàng lập đỉnh khoảng 2.070 đô/ounce (8/2020).', so: [['Vàng', 'đỉnh lịch sử khi đó', 'len']] },
      { nam: '2022', noi: 'THẾ GIỚI', cau: 'Chiến sự Nga–Ukraine nổ ra, các nước cấm vận Nga: vàng vọt lên quanh 2.050 đô/ounce (3/2022).' },
    ],
    doiBan: [
      { doi: 'Người ta chạy vào vàng khi hoảng loạn.', muc: { loai: 'ma_sk', ma: 'vang', sk: ['chien_tranh', 'cam_van', 'dich_benh', 'hack_san'] } },
      { doi: 'Không sinh lãi ⇒ lúc chợ êm, giữ vàng là chịu thiệt.', muc: { loai: 'ma_gd', ma: 'vang', gd: ['tang', 'di_ngang', 'phuc_hoi'] } },
      { doi: 'Biến động một năm của vàng khoảng 15% — êm hơn rổ cổ phiếu lớn.', ban: 'Biến động nền hạng %{hang.vang:n} trong sáu mã.' },
      { doi: 'Chạy vào vàng chỉ có nghĩa khi vàng đi khác cổ phiếu.', ban: 'Cầm cả phe rủi ro lẫn vàng thì tổng tài sản dao động ít hơn — nền của lá {da_dang|Đa Dạng Hoá}.' },
    ],
    so: [['Phe', '%{ts.vang.nhom:phe}'], ['Sổ lệnh', '%{ts.vang.thanh_khoan:so}'], ['Biến động nền', 'hạng %{hang.vang:n} trong sáu mã'], ['Bán khống', '%{ts.vang.khong_duoc:khong}']],
    lq: ['da_dang', 'lam_phat', 'tb_chien_tranh'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'usdt', nhom: 'ma', ma: 'usd', ten: 'STABLECOIN', anh: 'DIGITAL DOLLAR', icon: 'usdt',
    nhac: 'Neo 1:1 vào đô la — nhưng sàn rung thì neo cũng rung.',
    ngoai: 'Stablecoin trên bàn giống USDT hay USDC ngoài đời: "đô la số" do một công ty phát hành, mỗi đồng hứa đổi được một đô la thật. Người chơi crypto dùng nó để tạm trú khi muốn rời Bitcoin mà không rút tiền về ngân hàng. Giá của nó vì thế đi theo tỷ giá đô la — cho tới ngày người ta nghi ngờ lời hứa ấy.',
    chuoi: { ten: 'VÌ SAO "ĐỒNG TIỀN ỔN ĐỊNH" VẪN RƠI', buoc: ['Mỗi đồng ổn định là một lời hứa của một công ty.', 'Tin xấu về sàn, về công ty phát hành hay về ngân hàng giữ tiền.', 'Người ta đua nhau đổi nó ra đô la thật.'], ket: 'Giá trượt khỏi mức 1 đô — gọi là mất neo.', huong: 'xuong' },
    chuyen: [
      { nam: '5/2022', noi: 'THẾ GIỚI', cau: 'Đồng UST và LUNA sụp đổ, hoảng loạn lan khắp crypto: USDT có lúc chỉ còn khoảng 0,95 đô.', so: [['USDT', '≈ 0,95 đô', 'xuong']] },
      { nam: '3/2023', noi: 'MỸ', cau: 'Ngân hàng Silicon Valley sập; đồng USDC — một stablecoin có tiền gửi ở đó — rớt còn khoảng 0,88 đô.', so: [['USDC', '≈ 0,88 đô', 'xuong']] },
    ],
    doiBan: [
      { doi: 'Neo vào đô la ⇒ ngày thường gần như không nhúc nhích.', ban: 'Phe %{ts.usd.nhom:phe}, biến động nền hạng %{hang.usd:n} trong sáu mã.' },
      { doi: 'Đô la là nơi trú khi chiến tranh, cấm vận.', muc: { loai: 'ma_sk', ma: 'usd', sk: ['chien_tranh', 'cam_van'] } },
      { doi: 'Nhưng đồng ổn định là giấy nợ của một công ty nằm trên sàn crypto: sàn sập hay bị siết là người ta chạy khỏi nó.', muc: { loai: 'ma_sk', ma: 'usd', sk: ['hack_san', 'phap_ly', 'pha_san'] } },
      { doi: 'Tiền rẻ làm đô la bớt sức hút; tiền đắt làm nó mạnh lên.', muc: { loai: 'ma_sk', ma: 'usd', sk: ['ha_lai_suat', 'tang_lai_suat'] } },
      { doi: 'Ngoài đời stablecoin gần như đứng yên — biến động một năm dưới 1%.', ban: 'Trên bàn nó được nhúc nhích nhiều hơn thật, để không thành một ô chết không ai nghĩ tới.', loai: 'gon' },
    ],
    so: [['Phe', '%{ts.usd.nhom:phe}'], ['Sổ lệnh', '%{ts.usd.thanh_khoan:so}'], ['Biến động nền', 'hạng %{hang.usd:n} trong sáu mã'], ['Bán khống', '%{ts.usd.khong_duoc:khong}']],
    lq: ['lai_suat', 'tb_sap_san', 'thanh_khoan'], khung: 'OECD/INFE · Tiền & giao dịch',
  },
  {
    id: 'tpm', nhom: 'ma', ma: 'tpcp', ten: 'TRÁI PHIẾU', anh: 'GOVERNMENT BOND', icon: 'trai_phieu',
    nhac: 'Trả lãi vào tiền mặt mỗi kỳ — kể cả lúc giá của chính nó rơi.',
    ngoai: 'Mua trái phiếu là cho người phát hành vay tiền. Trái phiếu trên bàn giống trái phiếu kho bạc Mỹ kỳ hạn 10 năm ngoài đời: trả lãi cố định mỗi kỳ và hoàn gốc khi đáo hạn — gần như không ai lo nước Mỹ quỵt nợ. Nhưng giá của tờ trái phiếu vẫn lên xuống mỗi ngày.',
    chuoi: { ten: 'VÌ SAO LÃI TĂNG THÌ TỜ CŨ MẤT GIÁ', buoc: ['Bạn cầm tờ cũ trả lãi 2% một năm.', 'Lãi suất thị trường tăng, tờ mới phát hành trả 4%.', 'Không ai muốn mua lại tờ 2% của bạn với giá cũ.'], ket: 'Muốn bán, bạn buộc hạ giá ⇒ giá trái phiếu giảm.', huong: 'xuong' },
    nhung: 'Trái phiếu thường là nơi trú khi chợ hoảng — tiền chạy vào làm giá tăng. Nhưng khi nỗi sợ đến từ lạm phát, trái phiếu rơi cùng cổ phiếu: lạm phát ăn mòn chính khoản lãi cố định.',
    chuyen: [
      { nam: '2022', noi: 'MỸ', cau: 'Lợi suất trái phiếu Mỹ 10 năm tăng từ khoảng 1,5% lên gần 3,9%. Trái phiếu dài hạn có năm tệ nhất nhiều thập kỷ.', so: [['Giá trái phiếu dài hạn', 'năm tệ nhất nhiều thập kỷ', 'xuong']] },
      { nam: '3/2023', noi: 'MỸ', cau: 'Ngân hàng Silicon Valley sụp đổ, một phần vì ôm nhiều trái phiếu mua lúc lãi thấp — lãi tăng làm số trái phiếu ấy mất giá nặng khi ngân hàng buộc bán ra.' },
    ],
    doiBan: [
      { doi: 'Trái phiếu trả lãi đều theo kỳ.', ban: 'Giữ đủ một ô thì nhận lãi theo {loi_suat_dai|lợi suất dài}, trả thẳng vào tiền mặt.' },
      { doi: 'Lãi đã dồn giữa kỳ thuộc về người đang giữ.', ban: 'Mua giữa ô thì không nhận lãi của ô đó.' },
      { doi: 'Lãi suất lên thì giá tờ cũ xuống; lạm phát ăn mòn lãi cố định.', muc: { loai: 'ma_sk', ma: 'tpcp', sk: ['tang_lai_suat', 'lam_phat', 'ha_lai_suat'] } },
      { doi: 'Lúc hoảng loạn, tiền chạy về nơi an toàn nhất.', muc: { loai: 'ma_sk', ma: 'tpcp', sk: ['dich_benh', 'pha_san'] } },
      { doi: 'Người bán khống trái phiếu trả phần lãi cho người cho mượn.', ban: 'Khống trái phiếu thì bạn là người trả khoản lãi đó.' },
      { doi: 'Ngoài đời lợi suất có cả một đường cong nhiều kỳ hạn, cộng phần bù cho việc cho vay lâu.', ban: 'Bàn chỉ có hai điểm: lãi nền và lợi suất dài; chưa có phần bù kỳ hạn.', loai: 'gon' },
    ],
    so: [['Phe', '%{ts.tpcp.nhom:phe}'], ['Sổ lệnh', '%{ts.tpcp.thanh_khoan:so}'], ['Biến động nền', 'hạng %{hang.tpcp:n} trong sáu mã'], ['Bán khống', '%{ts.tpcp.khong_duoc:khong}']],
    lq: ['loi_suat_dai', 'duong_cong', 'lai_suat'], khung: 'GDKT&PL 10 · Tín dụng',
  },
];
