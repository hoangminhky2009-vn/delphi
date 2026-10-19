/**
 * MỤC BÁCH KHOA — v55 (D409): NGỌN LỬA ĐÀ · TRAIT TÀI/TẬT · CHỐT LỜI TRONG Ô. Nhóm HÀNH VI (`hv`) vì cả ba là cơ chế
 * ĐO CÁCH CHƠI (lửa đo sự nhất quán · trait là "tính người chơi" tự nhận · mục tiêu chốt lời đo ngưỡng chốt non) —
 * không phải lá bài hay mã.
 *
 * ⚠ Tầng TRÊN BÀN (vế `ban`) KHÔNG gõ chữ số (§III bài canh bách khoa): số của lửa/trait là PLAYTEST-TUNE ở
 * `config/lua.ts` · `config/trait.ts` và catalog server CHƯA phát chúng ⇒ vế bàn viết bằng lời (bốn nấc · thêm một mốc…).
 * Khi catalog phát `lua`/`trait`, đổi sang `%{…}` — không chép số tay (A11.5).
 * D434 — khoá `balance-v55-build` là MẶC ĐỊNH từ 27/09: mọi trận thường có ba mục này; bàn tập (v54) và đề buổi đo (v52)
 * ghim khoá riêng nên chưa có — câu chữ nói đúng thế.
 */
import type { MucBK } from './kieu';

export const MUC_V55: readonly MucBK[] = [
  {
    id: 'lua_da', nhom: 'hv', ten: 'NGỌN LỬA ĐÀ', anh: 'MOMENTUM STREAK', icon: 'flame',
    nhac: 'Giữ một phía qua nhiều vòng thì lửa lên; đổi phía hay đổi tay lớn thì lửa tắt.',
    ngoai: 'Nhà đầu tư giữ được một luận điểm qua nhiều tháng thường trả ít phí giao dịch hơn người đảo danh mục liên tục — nhưng cũng là người bị bất ngờ nặng nhất khi chợ đảo chiều, vì họ đã quen thắng. Giới nghiên cứu gọi đó là quá tự tin sau chuỗi thắng.',
    viDu: 'Một người ôm cổ phiếu công nghệ suốt 2020–2021 lãi đều từng quý; sang 2022 cùng danh mục ấy mất gần một nửa trong sáu tháng.',
    chuoi: { ten: 'VÌ SAO CHUỖI THẮNG LÀM NGƯỜI TA MẠNH TAY HƠN', buoc: ['Vài vòng đúng liên tiếp — cảm giác "mình đọc được chợ".', 'Cỡ lệnh to dần, phí trên mỗi lệnh nhẹ đi vì khớp quen tay.', 'Chợ đảo một nhịp — vị thế to nhất đứng đúng lúc sai nhất.'], ket: 'Cú đảo ăn mất nhiều hơn cả chuỗi thắng gộp lại.' },
    nhung: 'Không đổi phía không có nghĩa là đúng: lửa chỉ đo sự NHẤT QUÁN của bạn, không đo chợ. Người giữ sai phía qua bốn vòng vẫn có lửa nấc ba — lửa chỉ thưởng mã đang lãi, không cứu mã đang lỗ.',
    doiBan: [
      { doi: 'Luật trận thật từ 27/09.', ban: 'Ngọn lửa hiện cạnh thanh phong cách và trên ghế đối thủ ở mọi trận thường; bàn tập và đề buổi đo chưa có.', loai: 'luat' },
      { doi: 'Nhất quán là giữ cùng một luận điểm qua thời gian.', ban: 'Mỗi vòng giữ cùng PHÍA (nhóm mã chiếm phần lớn vị thế) thì chuỗi cộng một; lửa có bốn nấc từ tàn tới bùng.' },
      { doi: 'Đảo danh mục là một quyết định, không phải một tai nạn.', ban: 'Đổi phía, hoặc đổi tay quá lớn trong một vòng, thì lửa TẮT — chợ đảo chiều không dập lửa của bạn.' },
      { doi: 'Người quen thắng trả phí nhẹ hơn và để lãi chạy xa hơn.', ban: 'Lửa cao ⇒ trượt giá giảm và mã đang lãi được cộng thêm theo nấc; mã đang lỗ không bị trừ thêm — không giữ được lửa thì lợi thế đã mất rồi.' },
      { doi: 'Mua đuổi sớm là bám đà; mua đuổi muộn là FOMO.', ban: 'Cầm {mua_duoi|Mua Đuổi}: vào sớm mà lá lật ra lãi thì chuỗi cộng thêm; vào khi chuỗi tăng đã xác nhận thì vòng ấy không đếm và trượt giá cao hơn.' },
      { doi: 'Thứ nhận được là quyền xem thêm, không phải tiền.', ban: 'XU là ví duy nhất của trận: mỗi vòng được cấp một ít, còn lửa thì nhận thêm theo nấc, lõi phát huy thêm một xu; xu trả cho đổi bài trong shop và cuộn lại {trait|chợ trait}, không bao giờ đổi ra chip.', loai: 'luat' },
    ],
    lq: ['mua_duoi', 'trait', 'luot_song'], khung: 'OECD/INFE · Hành vi — quá tự tin',
  },
  {
    id: 'trait', nhom: 'hv', ten: 'TRAIT — TÀI VÀ TRAIT', anh: 'TRAITS', icon: 'shield',
    nhac: 'Ở vòng mốc bạn nhận vài TÀI kèm vài TRAIT — phần lấy luôn cân đúng không.',
    ngoai: 'Không có nhà đầu tư nào chỉ có ưu điểm. Người kỷ luật thường chốt lời sớm; người tầm rộng thường ôm quá nhiều mã; người có nguồn tin riêng thường mù trước tin công khai. Mỗi lợi thế ngoài đời đi kèm một cái giá — và người ta thường chỉ nhìn thấy nửa đầu.',
    chuoi: { ten: 'VÌ SAO TÀI LUÔN ĐI KÈM TRAIT', buoc: ['Lợi thế nào cũng là một thói quen được luyện.', 'Thói quen ấy làm mờ những gì nằm ngoài nó.', 'Chỗ mờ đó là nơi cái giá xuất hiện.'], ket: 'Biết mình có trait nào là một nửa của việc có tài.' },
    nhung: 'Trait không phải điểm cộng để sưu tập: mang thêm trait là mang thêm luật ràng buộc mình tới hết trận, không gỡ được.',
    doiBan: [
      { doi: 'Luật trận thật từ 27/09.', ban: 'Chợ trait mở ở vài vòng MỐC của bàn mười sáu ô ở mọi trận thường; bàn tập và đề buổi đo chưa có.', loai: 'luat' },
      { doi: 'Ưu điểm và nhược điểm đi thành cặp.', ban: 'Mỗi lượt mời có ba TÀI (điểm dương) và ba TRAIT (điểm âm), tổng đúng không; phần bạn lấy cũng tổng đúng không — lấy tài là nhận trait.', loai: 'luat' },
      { doi: 'Xem thêm phương án có giá của nó.', ban: 'Không ưng thì CUỘN LẠI bằng xu (giá tăng dần mỗi lần); xu đến từ {lua_da|ngọn lửa đà}.' },
      { doi: 'Kỷ luật ngoài đời là lệnh dừng lỗ viết trước cơn hoảng — và tay ngứa chốt non là mặt kia của nó.', ban: 'Cặp KỶ LUẬT ↔ CHỐT NON: sàn chặn lỗ mỗi vòng, đỡ cả phần Đòn Bẩy nhân lên, trả phí bảo hiểm đều mỗi vòng — đi cùng trần lãi mỗi vòng, cắt cả phần Đòn Bẩy ({chan_lo|Chặn Lỗ} đã rời quầy).' },
      { doi: 'Để lãi chạy và sốt ruột bán sớm là hai mặt của cùng một thói quen.', ban: 'KIÊN NHẪN cộng thêm vào phần lãi của mã giữ liền đủ lâu; NÓNG VỘI cắt bớt phần lãi của mã ôm quá lâu — người mang trait này sống bằng cách xoay mã.' },
      { doi: 'Vai trong chợ có sẵn tính cách nghề nghiệp.', ban: 'Đội Lái · Cá Mập · Tổ Chức mang sẵn một cặp trait của vai; Cá Nhân bắt đầu trắng.' },
      { doi: 'Kỹ năng có bậc, và người ta chỉ giỏi tới một bậc.', ban: 'Trait nhiều cấp (như RẢI LỆNH ba cấp) chỉ lấy được một cấp — lấy rồi thì chợ thôi chào các cấp khác. RẢI LỆNH chỉ có ở chợ của vai lớn.' },
      { doi: 'Có trait làm thay đổi cả cách nhìn bảng.', ban: 'MÙ TIN che ngẫu nhiên lá TIN vừa lật — chỉ còn thấy mã nào tăng, mã nào giảm; SƯƠNG MÙ cho lá PHA mới lật hai mặt tới vòng sau; NỘI GIÁN cho biết LOẠI của lá kế — chỉ loại, không nội dung; ĐI SAU thấy cả bàn đang mua hay bán từng mã.' },
    ],
    lq: ['lua_da', 'chan_lo', 'mua_duoi'], khung: 'OECD/INFE · Hành vi — tự nhận thức',
  },
];
