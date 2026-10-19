/**
 * MỤC BÁCH KHOA — MÀN LÕI (D495, founder 04/10: *"cập nhật luôn bách khoa toàn thư và phần hướng dẫn đầu app"*). Bốn mục cho các cơ chế của khung
 * minigame (D473–D494): MÀN LÕI · BẢNG PHỤ (tương quan) · SÀN THANH LÝ (gọi ký quỹ trong màn + nạp thêm) · THANH LÝ DÂY CHUYỀN.
 *
 * ⚠ Tầng TRÊN BÀN không gõ chữ số (§III bài canh): số đọc từ catalog `bach_khoa.minigame` (`%{mg.…}`, server `soMinigameBK` ← `config/minigame.ts`).
 * ⚠ Câu chữ nói "trận có màn lõi", không hứa cho mọi trận (khoá cũ không có màn). D530: từ v60 mặc định CÓ màn và lõi CHỈ tác động trong màn —
 *   hàng nút từng lõi đọc từ `LOI_NUT_MAN` (một nguồn với tờ (!) và Hướng dẫn).
 * ⚠ Số NGOÀI ĐỜI ở tầng đời đã kiểm nguồn 04/10 (ký quỹ VN theo quy định UBCKNN; đợt thanh lý crypto 19/05/2021).
 */
import type { MucBK } from './kieu';
import { LOI_CHI_TRONG_MAN_CHU, LOI_NUT_MAN } from '../khung_minigame';

/** D530 — câu hàng nút của mục MÀN LÕI dựng từ `LOI_NUT_MAN` (không chép lại chữ). */
const HANG_NUT = ([['bat_day', 'Bắt Đáy'], ['mua_duoi', 'Mua Đuổi'], ['don_bay', 'Đòn Bẩy'], ['ban_khong', 'Bán Khống'], ['luot_song', 'Lướt Sóng']] as const)
  .map(([id, ten]) => `{${id}|${ten}} ${LOI_NUT_MAN[id]}`).join('; ');

export const MUC_MINIGAME: readonly MucBK[] = [
  {
    id: 'man_loi', nhom: 'gia', ten: 'MÀN LÕI — ĐƯỜNG GIÁ SAU MỖI VÒNG', anh: 'INTRADAY RUN', icon: 'candle',
    nhac: 'Chốt vòng xong, mã nắm nhiều nhất chạy một đường giá ngắn — lõi của bạn bấm trên đó.',
    ngoai: 'Hai người cùng đúng hướng một năm vẫn có thể ra hai kết quả khác hẳn: một người mua lúc giá vừa giật lên, người kia mua lúc giá vừa rũ xuống. Giữa điểm đầu và điểm cuối là cả một đường đi — rút chân, quét, nến đứng — và lúc bạn bấm nằm ở đâu trên đường đó quyết định phần chênh.',
    chuoi: { ten: 'VÌ SAO CÙNG MỘT NĂM MÀ KHÁC KẾT QUẢ', buoc: ['Giá đầu năm và cuối năm là của thị trường — ai giữ suốt cũng ăn đúng phần đó.', 'Ở giữa, giá đi lên đi xuống nhiều lần.', 'Người vào ở đáy cục bộ ăn hơn người vào ở đỉnh cục bộ.'], ket: 'Phần hơn kém nằm ở THỜI ĐIỂM, không ở hướng.' },
    nhung: 'Không bấm không có nghĩa là thua: không bấm là giữ suốt, khoản đi đúng như thị trường.',
    doiBan: [
      { doi: 'Kết quả cả năm đã định; cái đổi được là lúc vào và lúc ra.', ban: 'Trận có màn lõi: sau khi chốt vòng, lật thẻ, chọn một lõi đang cầm, rồi mã nắm nhiều nhất chạy %{mg.chay_s:n} giây. Điểm cuối đường giá là đúng phần trăm thị trường của vòng.', loai: 'luat' },
      { doi: 'Giữ suốt là ăn đúng thị trường.', ban: 'Không bấm ⇒ GIỮ SUỐT: khoản đi đúng phần trăm của vòng, màn cộng thêm không. Bấm thì màn cộng phần chênh giữa theo lệnh và giữ suốt — có thể âm.' },
      { doi: 'Mỗi cách giao dịch có một bộ thao tác riêng.', ban: `Mỗi lõi một hàng nút: ${HANG_NUT}.` },
      { doi: 'Cách giao dịch chỉ thành tiền khi bạn thật sự giao dịch.', ban: LOI_CHI_TRONG_MAN_CHU, loai: 'luat' },
      { doi: 'Có lúc cả chợ chỉ bán, không ai mua — lệnh bán treo không khớp.', ban: 'Nến TRẮNG BÊN MUA thì lệnh bán không khớp; TRẮNG BÊN BÁN thì lệnh mua không khớp. Tự chốt cuối màn đúng nến trắng thì trượt giá nặng hơn.' },
      { doi: 'Người kiên nhẫn chịu đợi tín hiệu; người nóng vội chốt sớm.', ban: 'Trait KIÊN NHẪN khoá nút %{mg.kien_nhan_s:n} giây đầu nhưng khớp trượt nhẹ hơn; NÓNG VỘI chỉ bấm được tới giây %{mg.nong_voi_s:n} rồi tự chốt.' },
      { doi: 'Lệnh lớn tự làm giá chạy; người khôn chia nhỏ lệnh theo thời gian.', ban: 'Lệnh của vai lớn tự đẩy giá theo chiều của nó — một phần ở lại, phần còn lại tan; Cá nhân không đẩy. Cú đẩy theo quy mô lệnh — vốn càng to đẩy càng mạnh, nhưng lệnh to gấp trăm lần chỉ đẩy mạnh gấp chục lần. Trait RẢI LỆNH trải cú đẩy ra %{mg.rai_nen:ds} nến và làm nó nhẹ đi, khớp êm hơn.' },
      { doi: 'Người có loa có thể tung tin để đám đông chạy theo một lúc.', ban: 'Vai {doi_lai|Đội Lái} mang trait TUNG TIN: gài một tin tốt hoặc xấu trước màn, mất %{mg.phi_gai_bp:pc}% vốn màn; giá bị đẩy tạm rồi tan.' },
    ],
    so: [['Thời lượng', '%{mg.chay_s:n} giây'], ['Kiên Nhẫn khoá', '%{mg.kien_nhan_s:n} giây đầu'], ['Nóng Vội tự chốt', 'giây %{mg.nong_voi_s:n}'], ['Phí gài tin', '%{mg.phi_gai_bp:pc}% vốn màn']],
    lq: ['bang_phu', 'san_thanh_ly', 'truot_gia', 'thanh_khoan'], khung: 'OECD/INFE · Ra quyết định tài chính',
  },
  {
    id: 'bang_phu', nhom: 'gia', ten: 'BẢNG PHỤ — MÃ NÀY KÉO MÃ KIA', anh: 'CORRELATION', icon: 'chart',
    nhac: 'Các mã khác đang cầm chạy cùng màn — có cặp đi theo nhau, có cặp lúc theo lúc ngược.',
    ngoai: 'Tài sản không đi một mình. Cổ phiếu công nghệ là nhóm nhạy nhất của chỉ số — chỉ số chung nhích nhẹ là nó chạy mạnh hơn hẳn — và khi chỉ số rơi, nó rơi sâu hơn nữa vì nhà đầu tư nhỏ hoảng loạn. Vàng thường yếu khi lợi suất trái phiếu chính phủ Mỹ tăng, nhưng lúc chiến tranh hay lạm phát thì vàng vẫn tăng bất chấp. Còn lãi suất Mỹ chạm tới chứng khoán Việt Nam chậm, qua tỷ giá: ngân hàng nhà nước giữ tỷ giá một thời gian, rồi khi chạm ngưỡng thì chỉ số điều chỉnh một lèo.',
    chuoi: { ten: 'VÌ SAO BLUE-CHIP TRƠ RỒI SẬP BÙ', buoc: ['Lợi suất Mỹ tăng, đô la mạnh lên.', 'Tỷ giá bị giữ trong biên — chứng khoán chưa phản ứng.', 'Tới ngưỡng, tỷ giá được nới, dòng tiền ngoại rút.'], ket: 'Blue-chip điều chỉnh dồn một lần thay vì đi theo từng ngày.', huong: 'xuong' },
    doiBan: [
      { doi: 'Cổ phiếu công nghệ là kính lúp của chỉ số.', ban: 'Blue-chip → Cổ tech: khuếch đại, chiều xuống mạnh hơn chiều lên.' },
      { doi: 'Vàng và trái phiếu chính phủ không có quan hệ cố định.', ban: 'Trái phiếu → Vàng: bất ổn — có vòng cùng chiều, có vòng ngược chiều; thẻ chiến tranh, lạm phát, cấm vận thì vàng đi ngược trái phiếu.' },
      { doi: 'Lãi suất Mỹ tới Việt Nam qua tỷ giá, chậm và giật cục.', ban: 'Trái phiếu → Blue-chip và Cổ tech: trơ một lúc, rồi sập bù cả phần dồn lại trong vài nến.' },
      { doi: 'Crypto lúc gắn với lãi suất, lúc chạy theo cá voi.', ban: 'Trái phiếu → Crypto: thất thường, độ gắn đổi theo vòng, Crypto nhạy hơn.' },
      { doi: 'Điểm cuối năm là của từng tài sản.', ban: 'Mỗi đường ở bảng phụ vẫn kết thúc đúng phần trăm thị trường của mã đó trong vòng — tương quan chỉ nặn đường đi.', loai: 'luat' },
    ],
    lq: ['man_loi', 'cpck', 'vn30', 'vang', 'tpm', 'crypto'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'san_thanh_ly', nhom: 'rui', ten: 'SÀN THANH LÝ — KÝ QUỸ TRONG MÀN', anh: 'MARGIN CALL & LIQUIDATION', icon: 'dien_thoai',
    nhac: 'Vay để vào to: lỗ chạm ngưỡng thì bị gọi, chạm sàn thì bị bán thay bạn.',
    ngoai: 'Mua ký quỹ ở Việt Nam, công ty chứng khoán theo dõi tỷ lệ tiền của bạn trên giá trị danh mục. Tụt dưới mức duy trì thì họ gọi bạn nộp thêm tiền hoặc bán bớt; tụt tiếp tới mức xử lý thì họ tự bán — gọi là bán giải chấp — ở bất cứ giá nào khớp được.',
    viDu: 'Bán giải chấp diễn ra đúng lúc giá đang rơi và chợ đang thiếu người mua — giá khớp thường xấu hơn giá trên bảng.',
    chuoi: { ten: 'VÌ SAO NẠP THÊM CÓ THỂ MẤT CẢ HAI', buoc: ['Bị gọi, bạn bán một khoản khác để nộp thêm.', 'Sàn thanh lý lùi xuống, vị thế sống thêm một đoạn.', 'Giá rơi tiếp qua sàn mới.'], ket: 'Mất cả ký quỹ cũ lẫn phần vừa nạp, và khoản đã bán không còn.', huong: 'xuong' },
    doiBan: [
      { doi: 'Đòn bẩy chọn trước khi vào.', ban: 'Lõi {don_bay|Đòn Bẩy} trong màn: vào ×%{mg.muc_don_bay:ds} cả vốn màn; đang cầm thì tăng lên mức kế (vay thêm). Lãi vay gộp theo thời gian giữ, mức theo thị trường của vòng.', loai: 'luat' },
      { doi: 'Bên cho vay gọi khi tiền của bạn mỏng đi.', ban: 'Vốn còn ≤ %{mg.goi_bp:pc}% ký quỹ ⇒ CUỘC GỌI KÝ QUỸ: điện thoại rung, vạch hổ phách trên đồ thị, đang bị gọi thì không tăng được.' },
      { doi: 'Nộp thêm là bán thứ khác để giữ vị thế.', ban: 'NẠP THÊM: mỗi lần bán %{mg.nap_bp:pc}% vốn màn từ một khoản khác đang cầm, chịu trượt giá của mã đó cộng phí bán %{mg.phi_ban_bp:pc}% (Tiền mặt nạp thẳng, không phí); phần nhận vào ký quỹ, sàn lùi xuống.' },
      { doi: 'Tới mức xử lý thì không ai hỏi ý bạn.', ban: 'Vốn còn ≤ %{mg.thanh_ly_bp:pc}% ký quỹ ⇒ SÀN THANH LÝ: bán cưỡng bức ở giá đó, trượt nặng hơn bán thường; màn hình lóe đỏ, đồ thị và nút xám tới hết màn.' },
      { doi: 'Dồn hết vốn liếng để cứu một vị thế là canh bạc lớn nhất.', ban: 'BÁN HẾT (chỉ khi đang bị gọi): bán sạch mọi khoản khác và cả Tiền mặt theo giá đang chạy trên biểu đồ của từng khoản, trừ phí, dồn hết vào ký quỹ. Vị thế vẫn mở; giá còn sập tới sàn là mất cả phần vừa dồn, vòng sau các khoản đó không còn đồng nào.' },
      { doi: 'Lệnh bán của tay to làm giá của người khác rơi theo.', ban: 'Cá Mập, Đội Lái, Tổ Chức bị thanh lý hay BÁN HẾT thì cú bán của họ đè giá mã đó xuống — cả trên màn của các ghế khác đang cầm cùng mã.' },
      { doi: 'Bán khống cũng là vay: vay cổ phiếu để bán trước.', ban: '{ban_khong|Bán Khống} trong màn có ký quỹ y như Đòn Bẩy, chỉ ngược chiều: giá LÊN tới ngưỡng thì bị gọi, lên tiếp thì bị MUA cưỡng bức; chịu lãi vay như Đòn Bẩy.' },
      { doi: 'Mất tối đa là tiền mình bỏ vào.', ban: 'Lỗ có trần = ký quỹ (vốn màn cộng phần đã nạp hay đã dồn); khoản đã bán để nạp không quay lại.', loai: 'gon' },
    ],
    so: [['Mức vào', '×%{mg.muc_don_bay:ds}'], ['Bị gọi khi', 'vốn còn ≤ %{mg.goi_bp:pc}% ký quỹ'], ['Sàn thanh lý', 'vốn còn ≤ %{mg.thanh_ly_bp:pc}% ký quỹ'], ['Mỗi lần nạp', '%{mg.nap_bp:pc}% vốn màn · phí bán %{mg.phi_ban_bp:pc}%']],
    lq: ['don_bay', 'goi_ky_quy', 'thanh_ly_day_chuyen', 'man_loi'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'thanh_ly_day_chuyen', nhom: 'rui', ten: 'THANH LÝ DÂY CHUYỀN', anh: 'LIQUIDATION CASCADE', icon: 'mui_xuong',
    nhac: 'Một người vay bị bán giải chấp đẩy giá xuống — đủ để người vay kế tiếp chạm sàn.',
    ngoai: 'Khi nhiều người cùng vay để mua một tài sản, ngưỡng bán giải chấp của họ nằm rải bên dưới giá. Giá rơi chạm ngưỡng của người đầu tiên, lệnh bán cưỡng bức của họ đẩy giá xuống thêm, chạm ngưỡng của người thứ hai — và cứ thế. Giá rơi nhanh hơn chính tin xấu đã khơi mào nó.',
    chuoi: { ten: 'VÌ SAO GIÁ RƠI THEO BẬC', buoc: ['Giá chạm sàn của người vay mạnh nhất.', 'Lệnh bán cưỡng bức đẩy giá xuống một nấc.', 'Nấc đó chạm sàn của người kế tiếp.'], ket: 'Mỗi người bị thanh lý là một cú đẩy cho người sau.', huong: 'xuong' },
    chuyen: [{ nam: '19/05/2021', noi: 'CRYPTO', cau: 'Trong một ngày, hàng tỷ đô la vị thế vay trên các sàn crypto bị thanh lý liên tiếp; Bitcoin có lúc rơi khoảng 30% trong ngày trước khi hồi lại một phần.', so: [['Bitcoin trong ngày', 'khoảng −30% lúc thấp nhất', 'xuong']] }],
    doiBan: [
      { doi: 'Dây chuyền chỉ xảy ra khi có nhiều người cùng vay trên một tài sản.', ban: 'Trận có màn lõi: khi có ghế KHÁC đang cầm lõi Đòn Bẩy và cầm cùng mã của màn, đường giá có một đám đông đòn bẩy — một {ca_map|cá mập} và vài người vay mỏng.', loai: 'luat' },
      { doi: 'Người vay càng mỏng thì sàn càng gần giá.', ban: 'Ai chạm sàn thì bị bán cưỡng bức: giá bị đẩy xuống tạm thời, mã càng mỏng thanh khoản càng đau; cú đẩy có thể kéo người kế tiếp chạm sàn.' },
      { doi: 'Bán tháo lan sang tài sản đi sau.', ban: 'Cú đẩy lan sang mã đi cùng hoặc đi sau trên {bang_phu|bảng phụ}, không ngược về mã đang dẫn; rồi tan hết — điểm cuối vẫn là của thị trường.' },
      { doi: 'Đang vay giữa đám đông vay là đứng chung một chuỗi.', ban: 'Đang cầm Đòn Bẩy giữa dây chuyền thì sàn của bạn cũng bị kéo tới gần — mỗi cú bán hiện bằng một dấu đỏ trên đồ thị, VÌ SAO kể lại cả chuỗi.' },
      { doi: 'Chợ lúc nào cũng có người vay — cả để mua lẫn để bán khống.', ban: 'Mọi màn đều có ĐÁM ĐÔNG NỀN hai phe (ô tăng đông phe vay mua, ô giảm đông phe bán khống). Phe bán khống chạm ngưỡng thì bị MUA cưỡng bức — giá vọt lên, có thể kéo người kế tiếp.' },
      { doi: 'Tiền rẻ thì người vay để mua đổ xô vào — bong bóng thổi bằng tiền vay.', ban: 'Trước và trong ô {tb_bong_bong|Bong bóng}, đám đông nền dày hơn hẳn (thêm ba người vay mua, một người bán khống) — sàn thanh lý chồng nhau dày, cú dây chuyền dễ nổ gấp đôi. Sau khi vỡ thì như thường: phe vay đã bị quét.' },
      { doi: 'Tay to có thể châm ngòi cho cả chuỗi.', ban: 'Lệnh của vai lớn tự đẩy giá — đủ để đẩy giá chạm sàn (hay ngưỡng ép) của đám đông ngay trong màn, mở ra cú dây chuyền.' },
      { doi: 'Nhà đầu tư nhỏ một mình không đẩy nổi giá, nhưng cả bầy cùng làm một việc thì đẩy được.', ban: 'Mỗi màn có một BẦY CÁ NHÂN: vài người nền cộng mọi ghế Cá nhân khác (bot hay người) đang giữ mã. Ba nến cùng màu liền nhau thì cả bầy đuổi theo — mua khi xanh, bán khi đỏ — đẩy giá thêm một chút rồi tan. Bầy càng đông cú càng to, nhưng luôn nhỏ hơn một cú thanh lý.' },
      { doi: 'Tay to gom hàng quanh vùng đáy, hoặc kéo giá rồi xả — khối lượng giao dịch vọt lên đúng những phiên ấy.', ban: 'Khi một ghế bot Cá Mập hay Đội Lái cũng giữ mã của màn, đường giá có LỆNH LỚN của họ: Cá Mập gom ngay sau đáy rồi bán bớt gần cuối; Đội Lái kéo giá, tung tin "đang được gom mạnh" trong hội nhóm, rồi xả mạnh hơn lúc kéo. Lúc cú đè hiện nhãn ◆ LỆNH LỚN (Tổ Chức thấy ai đặt); cột khối lượng dưới nến cao vọt ở những nến ấy. Điểm cuối màn vẫn là của thị trường — trừ khi cú xả kéo đám đông vay vào dây chuyền.' },
    ],
    lq: ['san_thanh_ly', 'ban_thao', 'thanh_khoan', 'ca_map'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
  {
    id: 'chuoi_san', nhom: 'rui', ten: 'CHUỖI SĂN — LÕI NÀY THẤY ĐIỂM YẾU CỦA LÕI KIA', anh: 'LIQUIDATION MAP', icon: 'target',
    nhac: 'Mỗi lõi được soi một lớp trên đồ thị: chỗ đám đông sẽ bị buộc bán, chỗ họ sẽ bị buộc mua, chỗ cơn bán tháo dừng lại.',
    ngoai: 'Trên các sàn có đòn bẩy, người ta theo dõi bản đồ thanh lý: những mức giá mà ở đó nhiều vị thế vay sẽ bị đóng cưỡng bức. Người bán khống nhìn các mức bên dưới — chạm vào là có lệnh bán dồn dập. Người mua đuổi nhìn các mức bên trên — chạm vào là phe bán khống bị ép mua lại, giá vọt. Người bắt đáy chờ cơn bán tháo cạn — lệnh cưỡng bức đẩy giá quá đà rồi hồi.',
    chuoi: { ten: 'VÌ SAO BA LÕI KHẮC NHAU', buoc: ['Bán Khống thấy sàn của phe vay mua và đè giá xuống chạm nó.', 'Mua Đuổi thấy ngưỡng ép của phe bán khống và đẩy giá lên chạm nó.', 'Bắt Đáy không săn ai: nó canh giá lệch khỏi giá trị gốc — kể cả khi cú cưỡng bức của hai lõi kia đẩy giá quá đà.'], ket: 'Không lõi nào thắng mọi lúc: mỗi lõi là con mồi của một lõi khác.' },
    doiBan: [
      { doi: 'Biết chỗ người khác sẽ bị buộc bán là một lợi thế.', ban: '{ban_khong|Bán Khống}: dải ĐỎ trên đồ thị là sàn thanh lý của phe vay mua (đã mở và còn sống), đậm theo cỡ vị thế.' },
      { doi: 'Biết chỗ phe bán khống sẽ bị ép mua cũng vậy.', ban: '{mua_duoi|Mua Đuổi}: dải XANH là mức ép của phe bán khống — giá chạm vào thì họ bị mua cưỡng bức, giá vọt thêm.' },
      { doi: 'Giá hay lệch khỏi giá trị rồi kéo về — dải Bollinger, chỉ báo quá bán ngoài đời đều canh chỗ đó.', ban: '{bat_day|Bắt Đáy}: ĐƯỜNG GIÁ TRỊ (giá trị gốc của kịch bản, người khác không thấy) với DẢI DƯỚI — giá trong dải là đang rẻ hơn giá trị; đường dốc xuống là cả giá trị đang sụt, đó là dao rơi. Đường TRỄ vài nến, vì thế không biết trước cú sập hay tin mạnh — ở thị trường cực đoan giá có thể rẻ mãi. Nhãn QUÁ BÁN dưới nến đã đóng: hay đúng ở cuối sóng giảm, nhưng cũng báo nhầm ở nến đỏ tạo đáy mới.' },
      { doi: 'Bản đồ chỉ cho biết chỗ, không cho biết giá có tới đó không.', ban: 'Lớp soi chỉ hiện vị thế ĐÃ mở; vị thế chưa vào và cú cưỡng bức chưa xảy ra không bao giờ hiện trước. Chợ vắng thì ghi chợ vắng.', loai: 'gon' },
    ],
    lq: ['thanh_ly_day_chuyen', 'san_thanh_ly', 'ca_map'], khung: 'OECD/INFE · Rủi ro & phần thưởng',
  },
];
