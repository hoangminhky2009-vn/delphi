/**
 * ART DIỆN MẠO — lưới ký tự 32x32 cho nền · khung · nhãn dán · bot.
 *
 * ---------------------------------------------------------------------------
 * VÌ SAO ART Ở `config/` CHỨ KHÔNG Ở `server/art/`.
 *
 * Avatar phải vẽ ở CẢ HAI phía: React (`web/src`) và trang server-render. `config/`
 * là thư mục duy nhất cả hai cùng đọc được. Nếu chép lưới sang `web/` thì có hai
 * nguồn art và chúng SẼ trôi lệch — avatar bot đã từng có hai bản (`BotAvatar.tsx`
 * và `holdem_ui.ts`) và hai bản đó đã khác nhau thật.
 *
 * ---------------------------------------------------------------------------
 * VẼ LẠI 27/07 THEO D36 — founder: "avt gốc trông bựa quá", muốn giống ẢNH ĐẠI
 * DIỆN FACEBOOK nhưng NGẦU HƠN, phong cách PIXEL TERMINAL.
 *
 * Bản cũ hỏng ở BỐ CỤC chứ không ở độ phân giải, và hỏng theo đúng ba cách:
 *   · Cái đầu chiếm gần trọn khung, không có khoảng thở → ra "mặt nạ", không ra
 *     ảnh chân dung. Bản này: đầu cao 19 ô trên vùng vẽ 28 ô, có vai, có nền.
 *   · Mặt tô gần như một sắc cam phẳng, mắt là hai đốm. Bản này: 4 nấc da
 *     (`y O o B`), hốc mắt tối làm mắt LÕM, sống mũi bắt sáng, môi dưới bắt sáng,
 *     và MỘT Ô `W` bắt sáng trong mắt — thứ tách "mắt sống" khỏi "hai lỗ đen".
 *   · Không có ánh sáng nào kể một câu chuyện. Bản này có VIỀN HẮT SÁNG: một cột
 *     ô màu nhấn nằm NGOÀI khối, ở mép trái — ánh màn hình hắt từ sau-trái. Đó
 *     chính là chỗ chữ "terminal" nằm; nó cũng là thứ làm hình trông "ngầu" mà
 *     không cần thêm một chi tiết nào lên mặt.
 *
 * Cộng thêm nền có VIGNETTE (vành 2 ô tối hơn) và QUÉT DÒNG CRT (mỗi 4 hàng một
 * vạch tối, CHỈ trên nền, không chạm chủ thể).
 *
 * QUY ƯỚC SÁNG: NGUỒN SÁNG TRÊN-TRÁI cho cả bộ (cùng quy ước D29 và art thẻ).
 * Dải da 4 nấc dùng chung cho cả ba nền: `y` bắt sáng · `O` sáng · `o` bóng ·
 * `B` khe sâu. Ba nền dùng CHUNG cấu trúc mắt/mũi/miệng từng ô (P3) — khác nhau
 * ở thứ đội trên đầu, không khác nhau ở "được vẽ kỹ hơn".
 *
 * ⚠ ĐỘ PHỦ 100%: không ô `.` nào trong ba nền. Avatar là một Ô GẠCH KÍN, không
 * phải hình nổi trên nền trong suốt — và chính điều đó làm khung viền có chỗ đứng.
 */
import {
  docDienMao, KHUNG, NHAN_DAN, O_LUOI, VANH_KHUNG,
} from './avatar.js';
import { BANG_MAU, docLuoi, veDai } from './pixel_luoi.js';

/**
 * BỐN NỀN. Ba lá TẶNG (A · B · D) + một lá THƯỞNG LỘ TRÌNH (C, bản Beta Access).
 *
 * ⚠ ĐỔI SO VỚI D36: bản cũ là "hai lá TẶNG (A·B) + một lá BÁN Ở SHOP (C)". D41
 * (founder 27/07 tối) thêm lá **D — ẨN DANH** vào nhóm tặng, và chuyển C từ hàng
 * bán 600 Q sang phần thưởng lộ trình mùa. Giữ câu này để truy vết.
 *
 * Bốn silhouette là bốn TRỤC HÌNH khác nhau, không phải bốn biến thể của một trục —
 * đó là cách duy nhất bảo đảm chúng rời nhau ở 32px mà không phải cãi nhau về gu:
 *   A NGANG (vành mũ chìa trái) · B DỌC (búi nhô phải) · C KHỐI (mũ trùm liền mảng)
 *   D TRỐNG (không có gì nhô ra cả — và chính cái không-có-gì là hình dạng của nó).
 */
export const LUOI_NEN: Readonly<Record<string, readonly string[]>> = {
  // A — ĐỘI MŨ. Vành chìa SANG TRÁI (hàng 9–10): gai NGANG. Chân mũ có một đường
  // cyan — chỗ DUY NHẤT của lá này có màu nhấn, để mũ không thành khối màu chói.
  A: [
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkKKKKKKKKKKKKKKKKKKKKKKKKKKKKkk',
    'kkKKKKKKKKKKKKKKKKKKKKKKKKKKKKkk',
    'kkkkkkkkkkkDxxxxxzzzkkkkkkkkkkkk',
    'kkKKKKKKKKDxxxxzzzzzzKKKKKKKKKkk',
    'kkKKKKKKKKDzzzzzzzzzzKKKKKKKKKkk',
    'kkKKKKKKKDzzzzzzzzzzzzKKKKKKKKkk',
    'kkkkkkkkkDEEEEeeeeeeeekkkkkkkkkk',
    'kkKKDxxxxzzzzzzzzzzzzzKKKKKKKKkk',
    'kkKKDEeeeeeOOOOOOOOOozKKKKKKKKkk',
    'kkKKKKKKKDOBBBOOOBBBooKKKKKKKKkk',
    'kkkkkkkkDOOWzSOyOWzSoookkkkkkkkk',
    'kkKKKKKKDoOzzzOyOzzzoooKKKKKKKkk',
    'kkKKKKKKDoOoooOyOooooooKKKKKKKkk',
    'kkKKKKKKKDOyyOOyoOOOooKKKKKKKKkk',
    'kkkkkkkkkkDyyOBOBOOookkkkkkkkkkk',
    'kkKKKKKKKKDOOoOOOoOooKKKKKKKKKkk',
    'kkKKKKKKKKKDOBBBBBOooKKKKKKKKKkk',
    'kkKKKKKKKKKDOOyyyOooKKKKKKKKKKkk',
    'kkkkkkkkkkkkDOOOOookkkkkkkkkkkkk',
    'kkKKKKKKKKKKKDoooooKKKKKKKKKKKkk',
    'kkKKKKKKKKKKKKDBBBKKKKKKKKKKKKkk',
    'kkKKKKKKKKKKKDOOoooKKKKKKKKKKKkk',
    'kkkkkkkkkkkkkDOOoookkkkkkkkkkkkk',
    'kkKKKKKKKDssEEEoooeeezzKKKKKKKkk',
    'kkKKKKDssxxxxxoooooxxxxxzzKKKKkk',
    'kkKDssxxxxxxxxxxxxxxxxxxxxzzKKkk',
    'kkssxxxxxxxxxxxxxxxxxxxxxxxxzzkk',
    'kkssxxxxxxxxxxxxxxxxxxxxxxxxzzkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  ],
  // B — BÚI TÓC. Búi lệch PHẢI trên đỉnh (hàng 2–5) + dây buộc violet: cục NHÔ.
  // Đối xứng bị phá bằng VỊ TRÍ BÚI, không bằng nghiêng đầu — nghiêng đầu ở 32 ô
  // là ra méo, không ra nghiêng.
  B: [
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkKKKKKKKKKKKKKKKKKvxxxzKKKKKKkk',
    'kkKKKKKKKKKvxxxxxzzzzzzzKKKKKKkk',
    'kkkkkkkkkkvxxxxxzzzzzzzzkkkkkkkk',
    'kkKKKKKKKvxxxxzzzzzzvuuuKKKKKKkk',
    'kkKKKKKKKvxzzzzzzzzzzKKKKKKKKKkk',
    'kkKKKKKKKvzzzzzzzzzzzzKKKKKKKKkk',
    'kkkkkkkkkvzzzzzzzzzzzzkkkkkkkkkk',
    'kkKKKKKKKvzzzzzzzzzzzzKKKKKKKKkk',
    'kkKKKKKKvxzOOOOOOOOOozzKKKKKKKkk',
    'kkKKKKKKvxOBBBOOOBBBoozKKKKKKKkk',
    'kkkkkkkkvzOWzSOyOWzSoozkkkkkkkkk',
    'kkKKKKKKvzOzzzOyOzzzoozKKKKKKKkk',
    'kkKKKKKKvzOoooOyOooooozKKKKKKKkk',
    'kkKKKKKKvzOyyOOyoOOOoozKKKKKKKkk',
    'kkkkkkkkvzzyyOBOBOOoozzkkkkkkkkk',
    'kkKKKKKKvzzOOoOOOoOoozzKKKKKKKkk',
    'kkKKKKKKKKKvOBBBBBOoozzKKKKKKKkk',
    'kkKKKKKKKKKvOOyyyOooKKKKKKKKKKkk',
    'kkkkkkkkkkkkvOOOOookkkkkkkkkkkkk',
    'kkKKKKKKKKKKKvoooooKKKKKKKKKKKkk',
    'kkKKKKKKKKKKKKvBBBKKKKKKKKKKKKkk',
    'kkKKKKKKKKKKKvOOoooKKKKKKKKKKKkk',
    'kkkkkkkkkkkkkvOOoookkkkkkkkkkkkk',
    'kkKKKKKKKvsvvvvooouuuuzKKKKKKKkk',
    'kkKKKKvssxxxuuooooouuxxxzzKKKKkk',
    'kkKvssxxxxxxxxxwwwxxxxxxxxzzKKkk',
    'kkssxxxxxxxxxxxxxxxxxxxxxxxxzzkk',
    'kkssxxxxxxxxxxxxxxxxxxxxxxxxzzkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  ],
  /*
   * C — ÁO TRÙM ĐẦU (hàng bán, bản Beta Access). Mũ trùm mở liên tục hàng 3 → 29:
   * KHỐI liền một mảng, khối lớn nhất bộ.
   *
   * KHIẾM KHUYẾT ĐÃ KHAI, đừng phát hiện lại: với lá này CÁI MẶT KHÔNG XUẤT HIỆN
   * TRONG PHÉP THỬ SILHOUETTE — nó nằm bên trong khối chứ không nhô ra. Lá C nhận
   * diện bằng HÌNH MŨ TRÙM (rất mạnh) nhưng cái mặt nhận diện bằng TƯƠNG PHẢN MÀU
   * (vệt da ấm trong mảng lục sẫm). Nên đây là lá phải xem lại ĐẦU TIÊN nếu app có
   * chế độ tương phản cao hoặc theme sáng.
   *
   * Đừng "sửa" bằng cách khoét khoang mũ to ra: làm vậy là mất đúng cái silhouette
   * khối liền — lý do lá C tồn tại.
   */
  C: [
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkKKKKKKKKKKKKKKKKKKKKKKKKKKKKkk',
    'kkKKKKKKKKKGnnnnnnnnKKKKKKKKKKkk',
    'kkkkkkkkGggggggggggggggkkkkkkkkk',
    'kkKKKKKGnnggggggggggggggKKKKKKkk',
    'kkKKKKGnnggxxxxxzzzzzggggKKKKKkk',
    'kkKKKGnnggzzzzzzzzzzzzggggKKKKkk',
    'kkkkkGnnggzzzzzzzzzzzzggggkkkkkk',
    'kkKKGnngggOyyyyyOOOOoogggggKKKkk',
    'kkKKGnngggOOOOOOOOOOoogggggKKKkk',
    'kkKKGnngggOBBBOOOBBBoogggggKKKkk',
    'kkkkGnngggOWzSOyOWzSoogggggkkkkk',
    'kkKKGnngggOzzzOyOzzzoogggggKKKkk',
    'kkKKGnngggOoooOyOooooogggggKKKkk',
    'kkKGnnngggOyyOOyoOOOooggggggKKkk',
    'kkkGnngngggyyOBOBOOoogggggzgkkkk',
    'kkKGnngggggOOoOOOoOoogggggzgKKkk',
    'kkKGnnggggggOBBBBBOooggggzggKKkk',
    'kkKGnnggggggOOyyyOooggggggggKKkk',
    'kkkGnngngggggOOOOoogggggggggkkkk',
    'kkKGnnggngggggoooooggggggzggKKkk',
    'kkGnnggggngggggBBBggggggzggggKkk',
    'kkGnngggggngggOOoooggggzgggggKkk',
    'kknngggggggnggOOooogggzgggggggkk',
    'kknnggggggggnNNBBBGGgzggggggggkk',
    'kknngggggggggNNoooGGzgggggggggkk',
    'kknngggggggggNNgggGGggggggggggkk',
    'kknngggggggggNNgggGGggggggggggkk',
    'kknnggggggggggggggggggggggggggkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  ],
  /*
   * D — ẨN DANH (D41). Bóng người vô danh kiểu ảnh mặc định Facebook, nhưng PIXEL.
   *
   * ⚠ LÁ NÀY CỐ Ý KHÔNG CÓ MẶT. Không mắt, không mũi, không miệng, không phụ kiện —
   * và đó là toàn bộ nội dung của nó, không phải một bản vẽ dở. Ba lá kia nói "tôi
   * là kiểu người này"; lá này nói "tôi không nói".
   *
   * VÌ SAO NÓ PHẢI ĐẶC, KHÔNG PHẢI VIỀN RỖNG: ở 32px một hình viền rỗng đọc ra là
   * "chưa tải xong", còn khối đặc đọc ra là "cố tình". Cùng lý do ảnh mặc định của
   * mọi mạng xã hội đều là khối đặc.
   *
   * VÌ SAO KHÔNG GIỐNG BOT (D25/R3): bot có ngôn ngữ hình riêng (xem `LUOI_BOT` —
   * mảng khối vuông, ăng-ten, mắt đơn). Lá này là ĐƯỜNG CONG NGƯỜI: đầu tròn, vai
   * xuôi. Người giấu mặt vẫn phải đọc ra là NGƯỜI, nếu không thì nó nói dối về việc
   * ai đang ngồi đối diện.
   *
   * Nguồn sáng trên-trái theo quy ước repo: viền cyan `D` ở mép trái (Terminal Neon),
   * rồi `C`/`S` bắt sáng, thân `s`→`x`, đổ bóng `z`→`w`/`u` về phía dưới-phải.
   */
  D: [
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkKKKKKKKKKKKKKKKKKKKKKKKKKKKKkk',
    'kkKKKKKKKKKKKKKKKKKKKKKKKKKKKKkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkKKKKKKKKKKKKKKKKKKKKKKKKKKKKkk',
    'kkKKKKKKKKKDSssxzKKKKKKKKKKKKKkk',
    'kkKKKKKKKKKDSssssxxzzKKKKKKKKKkk',
    'kkkkkkkkkkDCsssssxxxzzkkkkkkkkkk',
    'kkKKKKKKKKDSsssssxxxzzKKKKKKKKkk',
    'kkKKKKKKKDEssssssxxxxzwKKKKKKKkk',
    'kkKKKKKKKDSssssssxxxxzzKKKKKKKkk',
    'kkkkkkkkkDWssssssxxxxzwkkkkkkkkk',
    'kkKKKKKKKKDSsssssxxxzzKKKKKKKKkk',
    'kkKKKKKKKKDSsssssxxxzzKKKKKKKKkk',
    'kkKKKKKKKKKDSssssxxzzKKKKKKKKKkk',
    'kkkkkkkkkkkkDSssxxzzkkkkkkkkkkkk',
    'kkKKKKKKKKKKDsxzKKKKKKKKKKKKKKkk',
    'kkKKKKKKKKKKDsxzKKKKKKKKKKKKKKkk',
    'kkKKKKKKKKKDSsxxzKKKKKKKKKKKKKkk',
    'kkkkkkkkkkkDSssssxxzzkkkkkkkkkkk',
    'kkKKKKKKKDSssssssxxxxzzKKKKKKKkk',
    'kkKKKDSssssssssxxxxxxzzKKKKKKKkk',
    'kkKDSssssssssssxxxxxxxxzzKKKKKkk',
    'kkkkDEssssssssssssxxxxxxxxzwkkkk',
    'kkKDSssssssssssssssxxxxxxxxzzKkk',
    'kkDSssssssssssssssssxxxxxxxxzzkk',
    'kkDSssssssssssssssssxxxxxxxxzukk',
    'kkDEssssssssssssssssxxxxxxxxzwkk',
    'kkDSssssssssssssssssxxxxxxxxzzkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  ],
  /*
   * E — TRADER #1 (VEST). Nửa TRÊN của câu chuyện: chỉnh tề, thành đạt.
   * Trục hình: KHỐI VAI — vest đổ rộng ra hai bên ở đáy khung, khác hẳn bốn
   * lá cũ vốn thu về cổ. Ở 32px thì cái đọc ra trước là SILHOUETTE, không
   * phải chi tiết mặt.
   * Mặt dùng CHUNG cấu trúc mắt/mũi/miệng từng ô với A·B·C·D (P3) — khác ở
   * thứ MẶC, không khác ở "được vẽ kỹ hơn".
   */
  E: [
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkKKKKKKKKKKKKKKKKKKKKKKKKKKKKkk',
    'kkKKKKKKKKKKKKKKKKKKKKKKKKKKKKkk',
    'kkkkkkkkkkDzzzzzzzzzzzkkkkkkkkkk',
    'kkKKKKKKKDzxxxxxxxxxxzKKKKKKKKkk',
    'kkKKKKKKKDzxxxxxxxxxxxzKKKKKKKkk',
    'kkKKKKKKKDzxxxxxxxxxxxzKKKKKKKkk',
    'kkkkkkkkkDzzOOOOOOOOOzzkkkkkkkkk',
    'kkKKKKKKKDzOOOOOOOOOOozKKKKKKKkk',
    'kkKKKKKKKDOBBBOOOBBBoozKKKKKKKkk',
    'kkKKKKKKKDOOWzSOyOWzSooKKKKKKKkk',
    'kkkkkkkkkDoOzzzOyOzzzookkkkkkkkk',
    'kkKKKKKKKDoOoooOyOooooooKKKKKKkk',
    'kkKKKKKKKKDOyyOOyoOOOooKKKKKKKkk',
    'kkKKKKKKKKKDyyOBOBOOooKKKKKKKKkk',
    'kkkkkkkkkkkDOOoOOOoOookkkkkkkkkk',
    'kkKKKKKKKKKKDOBBBBBOooKKKKKKKKkk',
    'kkKKKKKKKKKKDOOyyyOooKKKKKKKKKkk',
    'kkKKKKKKKKKKKDOOOOooKKKKKKKKKKkk',
    'kkkkkkkkkkkkkDoooookkkkkkkkkkkkk',
    'kkKKKKKKKKKKKKDBBBBKKKKKKKKKKKkk',
    'kkKKKKKKKKKKKDOOoooKKKKKKKKKKKkk',
    'kkKKKKKKKKKKDWSOOoSSKKKKKKKKKKkk',
    'kkkkkkkkkDzzWWSQSSSzzkkkkkkkkkkk',
    'kkKKKKKDzzxxWSQqQSSxxzzKKKKKKKkk',
    'kkKKKDzzxxxxWSQQQSSxxxxzzKKKKKkk',
    'kkKDzzxxxxxxWSQQQSSxxxxxxzzKKKkk',
    'kkkDzxxxxxxxxWSQQSSxxxxxxxxzkkkk',
    'kkDzxxxxxxxxxxWSSxxxxxxxxxxzzzkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  ],
  /*
   * F — TRADER #2 (QUẦN ĐÙI HOA). Nửa DƯỚI, và là cú lật: KHÔNG CÓ MẶT.
   * ⚠ Đừng "sửa cho hợp bộ" bằng cách thêm đầu — cả trò đùa nằm ở chỗ nó là
   * nửa còn lại của lá E. Trên vest, dưới quần đùi.
   * Đọc ra ở 32px nhờ TƯƠNG PHẢN BỐ CỤC (vải sáng cắt ngang, chân tối bên
   * dưới) chứ không nhờ chi tiết: hoa 2x2 ô và thưa (hoa nhỏ thành nhiễu,
   * đọc ra "vải bẩn"), lông chân là ô B RẢI THƯA (thành mảng là vết bẩn).
   */
  F: [
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkKKKKKKKKKKKKKKKKKKKKKKKKKKKKkk',
    'kkKKKKKKKKKKKKKKKKKKKKKKKKKKKKkk',
    'kkkkkkDSSSSSSSSSSSSSSSSSSskkkkkk',
    'kkKKKDsSSSSSSSSSSSSSSSSSssKKKKkk',
    'kkKKKDsssssssssssssssssssSKKKKkk',
    'kkKKKKDOOOOOOOOOOOOOOOOOOoKKKKkk',
    'kkkkkkkDSSSSSSSSSSSSSSSSSSkkkkkk',
    'kkKKKKDSSqqSSSSSGGSSSSSSsKKKKKkk',
    'kkKKKKDSSqrSSSSSGnSSyySSsKKKKKkk',
    'kkKKKKDSSSSSSyySSSSSyySSsKKKKKkk',
    'kkkkkkkDSSSSSSyySSSSSSSSSSkkkkkk',
    'kkKKKKDSGGSSSSSSSqqSSSSSsKKKKKkk',
    'kkKKKKDSGnSSSSSSSqrSSSSSsKKKKKkk',
    'kkKKKKDsssssssSSssssssssSKKKKKkk',
    'kkkkkkkDOOOOOOSSOOOOOOOOOokkkkkk',
    'kkKKKKKDOOBOOOKKOOOOBOOoKKKKKKkk',
    'kkKKKKKDOOOOOBKKOBOOOOOoKKKKKKkk',
    'kkKKKKKDOBOOOOKKOOOOOBOoKKKKKKkk',
    'kkkkkkkkDOOOOBOKKOOOBOOOokkkkkkk',
    'kkKKKKKDOOBOOOKKOBOOOOOoKKKKKKkk',
    'kkKKKKKKDOOOOBKKOOOOBOoKKKKKKKkk',
    'kkKKKKKKDoOBOOKKOOBOOooKKKKKKKkk',
    'kkkkkkkkkDooOOOKKOOOBookkkkkkkkk',
    'kkKKKKKKKKDooOOKKOOBooKKKKKKKKkk',
    'kkKKKKKKKKDooOOKKOOOooKKKKKKKKkk',
    'kkKKKKKKKKKDoooKKOoooKKKKKKKKKkk',
    'kkkkkkkkkkkDoooKKoookkkkkkkkkkkk',
    'kkKKKKKKKKKDBBBKKBBBKKKKKKKKKKkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  ],
};

/**
 * KHUNG VIỀN — lớp RIÊNG, không nướng vào nền.
 *
 * 3 nền × N khung = **3 + N** lưới chứ không phải 3×N. Và khung THAY THẾ vành mặc
 * định chứ không cộng vào nó, nên ô gạch không bao giờ to ra — nếu khung nới lưới
 * ra thì lưới 8 ghế NHẢY theo việc đối thủ mua gì, đúng lớp lỗi bố cục D27 vừa
 * phải chữa.
 *
 * `.` = trong suốt, để lộ lớp dưới. Mọi ô có màu PHẢI nằm trong vành 2 ô —
 * `tests/avatar.test.ts` kiểm điều này trên toàn catalog.
 */
export const LUOI_KHUNG: Readonly<Record<string, readonly string[]>> = {
  /** MÓC NEO — bốn góc móc L dày 2 ô + hai vạch giữa mép trên/dưới.
   * Sáng trên-trái (`S`), tối dưới-phải (`x`): khung NẰM CÙNG MỘT ÁNH SÁNG với
   * avatar chứ không dán lên trên nó. */
  kh_moc_neo: [
    'WSSSSSS........SS........SSSSSSS',
    'SYSSSSS........yy........SSSSSSS',
    'SS............................SS',
    'SS............................SS',
    'SS............................SS',
    'SS............................SS',
    'SS............................SS',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    'ss............................xx',
    'ss............................xx',
    'ss............................xx',
    'ss............................xx',
    'ss............................xx',
    'sssssss..................xxxxxxx',
    'sssssss........ss........xxxxxxx',
  ],
  /** Nét mảnh MỘT hàng, cyan sáng ở mép trên-trái và tối ở mép dưới-phải. */
  kh_manh_cyan: [
    '................................',
    '.DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.D............................e.',
    '.Deeeeeeeeeeeeeeeeeeeeeeeeeeeee.',
    '................................',
  ],
  /** Hai đường: vành ngoài sáng, vành trong tối — đọc ra "khung kép" ở 32px. */
  kh_kep_violet: [
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VV............................uw',
    'VVuuuuuuuuuuuuuuuuuuuuuuuuuuuuuw',
    'VVwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
  ],
};

/**
 * NHÃN DÁN — lưới nhỏ, DÁN Ở BẤT KỲ Ô NÀO (D36, phương án B).
 *
 * Bản trước neo mỗi món vào một "ô neo" cố định; D36 gỡ hẳn hệ đó. Hệ quả kỹ thuật
 * đáng ghi: art nhãn dán nay phải đọc được Ở MỌI CHỖ, nên không món nào được vẽ
 * dựa vào chỗ nó sẽ nằm (không "râu vẽ cong theo môi", không "kính có gọng ôm vào
 * thái dương"). Mỗi món là một CON TEM đứng một mình — đúng nghĩa sticker.
 *
 * Cỡ giữ trong ~14×8: nhỏ hơn thì ở 32px thành đốm, lớn hơn thì một nhãn dán che
 * gần hết mặt và người chơi mất thứ duy nhất họ tiêu tiền vào — chính khuôn mặt.
 * (Ngoại lệ DUY NHẤT: sáu sticker vinh danh hạng, nguon 'merit', ở cuối bảng — xem chú thích tại chỗ.)
 */
export const LUOI_DAN: Readonly<Record<string, readonly string[]>> = {
  /** Kính râm 14×4 — hai tròng sẫm, gọng bắt sáng, hai chấm loé trên tròng. */
  st_kinh_ram: [
    'SSSSSSxxSSSSSS',
    'SzzzzWSSWzzzzS',
    'Szzzzzxxzzzzzz',
    '.SSSSS..SSSSS.',
  ],
  /** Ria mép 9×3. */
  st_ria_mep: [
    '.zz...zz.',
    'zzzzxzzzz',
    '.zz...zz.',
  ],
  /** Khẩu trang 11×6 — hai quai mảnh, thân gấp nếp. */
  st_khau_trang: [
    's.sssssss.s',
    'sSSSSSSSSSs',
    '.SssssssSS.',
    '.SssssssSS.',
    '..SsssssS..',
    '...SSSSS...',
  ],
  /** Mũi tên tăng 7×8. */
  st_mui_ten_len: [
    '...G...',
    '..GNG..',
    '.GNNNG.',
    'GNNGNNG',
    'gGGGGGg',
    '..GnG..',
    '..GnG..',
    '..ggg..',
  ],
  /** Đồng xu 7×7 — mặt xu có khe khắc, cạnh dưới đổ bóng. */
  st_xu_vang: [
    '..yyy..',
    '.yYYYy.',
    'yYyByYy',
    'yYBBByy',
    'yYyByYy',
    '.yOOOy.',
    '..ooo..',
  ],
  /** Biển cảnh báo 9×8 — tam giác vàng viền đỏ, dấu chấm than. */
  st_canh_bao: [
    '....q....',
    '...qYq...',
    '..qYzYq..',
    '..qYzYq..',
    '.qYYzYYq.',
    '.qYYYYYq.',
    'qYYYzYYYq',
    'qqqqqqqqq',
  ],
  /**
   * Dấu niêm Beta 8×8 — món ĐỘC QUYỀN (D36: số lượng cực ít).
   *
   * Vẽ khác hẳn sáu món kia: đối xứng tròn, hai họ màu chồng nhau (đỏ ngoài,
   * violet trong) và một ô `W` loé. Ở 32px thứ đọc ra trước là "cái này khác bọn
   * kia" — đúng việc của một món hiếm, và nó KHÔNG mượn ngôn ngữ hình của Hệ A
   * (không sinh vật biển, không cặp vàng-trên-bạc apex).
   */
  st_niem_beta: [
    '..QQQQ..',
    '.QqqqqQ.',
    'QqqVVqqQ',
    'QqVWVVqQ',
    'QqVVVVqQ',
    'QqqVVqqQ',
    '.QqqqqQ.',
    '..QQQQ..',
  ],
  /*
   * STICKER VINH DANH HẠNG (merit — SPEC huy-hieu-hang-sticker, founder 11/10). Lưới LẤY TỪ ART DEMO
   * (`docs/ui-ux/demo/hub-tang-khong-gian.html` · STK, cùng nguồn với `web/src/lib/huy_hieu.ts`) rồi
   * ÉP MÀU về `BANG_MAU` (khớp gần nhất, tổng khoảng cách nhỏ nhất, mỗi màu demo một chữ riêng) — bảng
   * màu avatar là MỘT bảng chung, thêm hex lẻ cho riêng sáu món là "hệ art thứ ba" (pixel_luoi.ts).
   * Hệ quả đã biết: đúng DÁNG và CỠ hình mẫu, lệch nhẹ vài sắc so với màn Hạng (nơi vẽ nguyên hex demo).
   *
   * ⚠ CỠ vượt trần 14×8 của sáu món gacha: hình mẫu founder to (Cá Voi 17×23, Tôm 25×13) và SPEC bắt GIỮ
   * NGUYÊN cỡ + dáng. Trần riêng cho nhóm merit nằm ở `tests/avatar.test.ts` (DAN_VINH_DANH_TOI_DA).
   */
  /** Tôm 25×13. */
  st_hh_tom: [
    '....OOOOOOOOOOOOOOOOOOOO.',
    '..OOOOOOOOOOOOOOOO.OOO...',
    '.OOOOOOOOOOOOOOOOOOOO.OO.',
    '.OOOOOOOOOOOOOOOOOOO....O',
    'OOOOOOOOOOOOOOOO........O',
    'OOOOO.....O.O.O...OOOOOO.',
    'OOOO.....O.O.O...O.......',
    'OOO.....O.O.O.....OO.....',
    'OOO......O.O.............',
    '.OO.......O..............',
    '.OOO.....................',
    '..OOO...OOO..............',
    '....OOOOOOO..............',
  ],
  /** Cua 16×13. */
  st_hh_cua: [
    '..QQQQ....QQQQ..',
    '.QQQ........QQQ.',
    '.QQQQQ....QQQQQ.',
    'QQQQQ......QQQQQ',
    'QQ...k....k...QQ',
    'QQ..QQQQQQQQ..QQ',
    'QQQQQQQQQQQQQQQQ',
    '.QQQQqQqQQQQQQQ.',
    '...QQQqQQQqQQ...',
    '.QQQQQQQQqQQQQQ.',
    'QQ..QQqQQQQQ..QQ',
    '...QQQQqQQQQQ...',
    '.QQQ..QQQQ..QQQ.',
  ],
  /** Cá Ngựa 12×19. */
  st_hh_ca_ngua: [
    '.....yy.....',
    '....yOOyy...',
    '....OOOOOy..',
    'OO.OOOOkOy..',
    'OOOOOOOOOy..',
    'O...OOOOoy..',
    '.....OOOo...',
    '....yOOOo...',
    '...yyOOOoy..',
    '...yyOOOOoy.',
    '....yOOOOOo.',
    '....yyOOOOo.',
    '.....yOOOOo.',
    '......yOOOo.',
    '.....O.yOOo.',
    '....OO..Ooo.',
    '....O..Ooo..',
    '....OO.Oo...',
    '.....Ooo....',
  ],
  /** Cá Đuối 21×18. */
  st_hh_ca_duoi: [
    '.......a.....a.......',
    '.......a.....a.......',
    '.......aaaaaaa.......',
    '......aeeeeeeea......',
    '.....aeeLeeeLeea.....',
    '....aeeeLLLLLeeea....',
    '...aeeeLLDLDLLeeea...',
    '.aaeeeeLLDDDLLeeeeaa.',
    'aeeeeeeLLLDLLLeeeeeea',
    'aeeeaaeeLLDLLeeaaeeea',
    'aeea...aeLLLea...aeea',
    'aea.....aeLea.....aea',
    'aa......aeLea......aa',
    '.........aea.........',
    '.........aea.........',
    '..........a..........',
    '..........a..........',
    '...........a.........',
  ],
  /** Cá Mập 15×14. */
  st_hh_ca_map: [
    '.......x.......',
    '......xxx......',
    '.....xxxxx.....',
    '....zxxxxxx....',
    '...zxxxxxxxz...',
    '..zxxxWWWxxxz..',
    '..kxWWWWWWWxk..',
    '.zxWWWQWQWWWxx.',
    '.zxWWQQQQQWWxx.',
    'zxWWQQQQQQQWWxx',
    'zWWQWQQQQQWQWWx',
    'zWWQWQWQWQWQWWx',
    'zWWWWWWWWWWWWWx',
    'zzxWWWWWWWWWxxx',
  ],
  /** Cá Voi vàng đội vương miện 17×23. */
  st_hh_ca_voi: [
    '.....J...........',
    '....JWJ..........',
    '.....J...........',
    '.JJ.JQJ.JJ.......',
    'JQQJQQQJQQJ......',
    'JQQJQQQJQQJ......',
    '.JQJQQQJQJ.......',
    '..JJJJJJJ........',
    '..JJJJJJJ........',
    '...yyyyy.........',
    '..yyYYyyy........',
    '.yyYyyyyyy.......',
    '.yyyyyyyyyy......',
    '.yyyyyyytyy.O...O',
    '.SSSSSSyyyy.OO.OO',
    '.STSTSSOOOO.OOOOO',
    '.STSTSSOOOO...O..',
    '..TSTSTOOOOO.OO..',
    '..SSTSSTOOOOOOS..',
    '...TSTSSyOOOOS...',
    '...OSSSSyySSS....',
    '...OO...yy.......',
    '...O....y........',
  ],
};

/**
 * BOT — CÙNG lưới 32x32, CÙNG bảng màu, CÙNG renderer. Khác ở NGÔN NGỮ HÌNH.
 *
 * Vì sao bot cũng là pixel: nếu người thành pixel mà bot vẫn là SVG vector bo góc,
 * thì R4 TỰ THOẢ MỘT CÁCH TÌNH CỜ — bot khác người chỉ vì nó *chưa được làm pixel*.
 * Tín hiệu đó biến mất đúng vào ngày ai đó sửa art bot, và người sửa sẽ không biết
 * mình vừa tháo một lớp bảo vệ D25/R3.
 *
 * SÁU ĐIỂM PHÂN BIỆT, đọc được ở 32px, không cái nào dựa vào chi tiết nhỏ:
 *   1. Vành NÉT ĐỨT — không sản phẩm Họ 1 nào có vành đứt.
 *   2. MỘT màu duy nhất, KHÔNG có dải da ấm 4 nấc.
 *   3. ĐỐI XỨNG TRỤC DỌC hoàn toàn (người thì lệch có chủ ý: vành trái · búi phải).
 *   4. KHÔNG CÓ VAI — đầu trôi lơ lửng, mép dưới trống.
 *   5. ĂNG-TEN trên đỉnh (người thì đỉnh đầu là mũ/tóc/trùm).
 *   6. Mắt = KHỐI ĐẶC không lòng trắng; miệng = LƯỚI KHE.
 *
 * Cộng một dấu hiệu ở tầng CẤU TẠO, mạnh hơn cả sáu điểm trên vì nó không phụ
 * thuộc nét vẽ: bot không có `user_id` nên không có dòng sở hữu nào, không có bản
 * ghi `avatar_so_huu` nào — bot không thể có khung, không thể có nhãn dán, kể cả
 * khi ai đó muốn.
 */
export const LUOI_BOT: readonly (readonly string[])[] = [
  [
    'ss..ss..ss..ss....ss..ss..ss..ss',
    's..ss..ss..ss..ss..ss..ss..ss..s',
    '..............CCCC..............',
    '.s............CCCC............s.',
    'ss............CEEC............ss',
    's..............EE..............s',
    '...............EE...............',
    '.s.............EE.............s.',
    'ss.............EE.............ss',
    's..............EE..............s',
    '......EEEEEEEEEEEEEEEEEEEE......',
    '.s....EeeeeeeeeeeeeeeeeeeE....s.',
    'ss....EeeeeeeeeeeeeeeeeeeE....ss',
    's.....EeeeeeeeeeeeeeeeeeeE.....s',
    '......EeeeeeeeeeeeeeeeeeeE......',
    '.s....EeeeCCCCeeeeCCCCeeeE....s.',
    '.s.EE.EeeeCCCCeeeeCCCCeeeE.EE.s.',
    '...EE.EeeeCCCCeeeeCCCCeeeE.EE...',
    's..EE.EeeeeeeeeeeeeeeeeeeE.EE..s',
    'ss.EE.EeeeeeeeeeeeeeeeeeeE.EE.ss',
    '.s.EE.EeeeeeeeeeeeeeeeeeeE.EE.s.',
    '......EeeeeEEeEEEEeEEeeeeE......',
    's.....EeeeeEEeEEEEeEEeeeeE.....s',
    'ss....EeeeeEEeEEEEeEEeeeeE....ss',
    '.s....EeeeeeeeeeeeeeeeeeeE....s.',
    '......EeeeeeeeeeeeeeeeeeeE......',
    's.....EEEEEEEEEEEEEEEEEEEE.....s',
    'ss.C........................C.ss',
    '.s..C......................C..s.',
    '................................',
    's..ss..ss..ss..ss..ss..ss..ss..s',
    'ss..ss..ss..ss....ss..ss..ss..ss',
  ],
  [
    'ss..ss..ss..ss....ss..ss..ss..ss',
    's..ss..ss..ss..ss..ss..ss..ss..s',
    '..............VVVV..............',
    '.s............VVVV............s.',
    'ss............VuuV............ss',
    's..............uu..............s',
    '...............uu...............',
    '.s.............uu.............s.',
    'ss.............uu.............ss',
    's..............uu..............s',
    '......uuuuuuuuuuuuuuuuuuuu......',
    '.s....uwwwwwwwwwwwwwwwwwwu....s.',
    'ss....uwwwwwwwwwwwwwwwwwwu....ss',
    's.....uwwwwwwwwwwwwwwwwwwu.....s',
    '......uwwwwwwwwwwwwwwwwwwu......',
    '.s....uwwwVVVVwwwwVVVVwwwu....s.',
    '.s.uu.uwwwVVVVwwwwVVVVwwwu.uu.s.',
    '...uu.uwwwVVVVwwwwVVVVwwwu.uu...',
    's..uu.uwwwwwwwwwwwwwwwwwwu.uu..s',
    'ss.uu.uwwwwwwwwwwwwwwwwwwu.uu.ss',
    '.s.uu.uwwwwwwwwwwwwwwwwwwu.uu.s.',
    '......uwwwwuuwuuuuwuuwwwwu......',
    's.....uwwwwuuwuuuuwuuwwwwu.....s',
    'ss....uwwwwuuwuuuuwuuwwwwu....ss',
    '.s....uwwwwwwwwwwwwwwwwwwu....s.',
    '......uwwwwwwwwwwwwwwwwwwu......',
    's.....uuuuuuuuuuuuuuuuuuuu.....s',
    'ss.V........................V.ss',
    '.s..V......................V..s.',
    '................................',
    's..ss..ss..ss..ss..ss..ss..ss..s',
    'ss..ss..ss..ss....ss..ss..ss..ss',
  ],
  [
    'ss..ss..ss..ss....ss..ss..ss..ss',
    's..ss..ss..ss..ss..ss..ss..ss..s',
    '..............NNNN..............',
    '.s............NNNN............s.',
    'ss............NGGN............ss',
    's..............GG..............s',
    '...............GG...............',
    '.s.............GG.............s.',
    'ss.............GG.............ss',
    's..............GG..............s',
    '......GGGGGGGGGGGGGGGGGGGG......',
    '.s....GggggggggggggggggggG....s.',
    'ss....GggggggggggggggggggG....ss',
    's.....GggggggggggggggggggG.....s',
    '......GggggggggggggggggggG......',
    '.s....GgggNNNNggggNNNNgggG....s.',
    '.s.GG.GgggNNNNggggNNNNgggG.GG.s.',
    '...GG.GgggNNNNggggNNNNgggG.GG...',
    's..GG.GggggggggggggggggggG.GG..s',
    'ss.GG.GggggggggggggggggggG.GG.ss',
    '.s.GG.GggggggggggggggggggG.GG.s.',
    '......GggggGGgGGGGgGGggggG......',
    's.....GggggGGgGGGGgGGggggG.....s',
    'ss....GggggGGgGGGGgGGggggG....ss',
    '.s....GggggggggggggggggggG....s.',
    '......GggggggggggggggggggG......',
    's.....GGGGGGGGGGGGGGGGGGGG.....s',
    'ss.N........................N.ss',
    '.s..N......................N..s.',
    '................................',
    's..ss..ss..ss..ss..ss..ss..ss..s',
    'ss..ss..ss..ss....ss..ss..ss..ss',
  ],
];

/**
 * BẢNG MÀU THAY THẾ — CỐ Ý RỖNG Ở LÁT NÀY.
 *
 * Ký tự thứ 3 của chuỗi diện mạo dành chỗ cho nó (đổi dạng chuỗi sau này là một
 * migration trên dữ liệu sống, nên chỗ phải chừa TRƯỚC). Rỗng và có test khẳng
 * định nó rỗng, để không ai tưởng tính năng này đang chạy.
 */
export const BANG_MAU_DOI: Readonly<Record<string, Readonly<Record<string, string>>>> = {};

/** Đặt một lưới món vào bộ đệm canvas tại (x0,y0), có thể LẬT NGANG. */
function datLuoi(
  dem: string[][], luoi: readonly string[], x0: number, y0: number, lat: boolean,
): void {
  luoi.forEach((hang, dy) => {
    for (let dx = 0; dx < hang.length; dx += 1) {
      // Lật = ĐẢO CHỈ SỐ CỘT, phép nguyên tuyệt đối. Không xoay, không co giãn:
      // xoay một lưới pixel buộc phải nội suy lại từng ô -> mép nhoè -> phá §XI.
      const ch = hang[lat ? hang.length - 1 - dx : dx]!;
      if (ch === '.') continue;
      const y = y0 + dy; const x = x0 + dx;
      // Dán tràn mép thì phần tràn BỊ CẮT, không quấn sang cạnh kia. Cắt là hành
      // vi người chơi đoán được ("kéo ra ngoài thì mất phần ngoài"); quấn thì không.
      if (y < 0 || x < 0 || y >= O_LUOI || x >= O_LUOI) continue;
      dem[y]![x] = ch;
    }
  });
}

/**
 * Chuỗi diện mạo → SVG.
 *
 * GỘP MỌI LỚP VÀO MỘT BỘ ĐỆM RỒI MỚI VẼ, không vẽ từng lớp một. Hai lý do, cả hai
 * đều đo được:
 *   - Ô bị che thì KHÔNG được emit — vẽ từng lớp thì phần dưới vẫn nằm trong file
 *     dù không ai thấy, và bàn 8 ghế nhân số đó lên 8 lần.
 *   - Gộp xong mới chạy `veDai` thì các dải cùng màu ở HAI lớp khác nhau vẫn nối
 *     được thành một khối — thứ vẽ-từng-lớp không bao giờ làm được.
 *
 * viewBox 32×32 (1 ô = 1 đơn vị): phóng to là việc của CSS `width`/`height` với
 * bội số nguyên, nên KHÔNG có phép làm tròn nào xảy ra ở tầng này. Đó là chỗ bản
 * cũ trượt: `px = round(size/cells)` khiến `size=26` render ra 32 một cách im lặng.
 */
export function veAvatarSVG(chuoi: string | null | undefined): string {
  const dm = docDienMao(chuoi);
  const nen = LUOI_NEN[dm.goc] ?? LUOI_NEN.A!;
  const dem: string[][] = nen.map((h) => [...h]);

  // NHÃN DÁN theo ĐÚNG thứ tự dán — dán sau đè lên dán trước. Thứ tự này là thứ
  // tự trong chuỗi, mà chuỗi dựng từ `avatar_dan` (append-only) nên nó KHÔNG sắp
  // xếp lại được: "vĩnh viễn" là một tính chất của cấu trúc, không phải lời hứa.
  for (const d of dm.dan) {
    const luoi = LUOI_DAN[d.mon.id];
    if (!luoi) continue;   // món khai trong catalog mà chưa vẽ → bỏ; test chặn ở CI
    datLuoi(dem, luoi, d.x, d.y, d.lat);
  }

  // Khung SAU CÙNG — nó THAY THẾ vành mặc định của lá nền, không cộng vào. Vẽ sau
  // nhãn dán là có chủ ý: một nhãn dán ném ra mép không được che mất khung người
  // ta đã mua.
  if (dm.khung) {
    const luoi = LUOI_KHUNG[dm.khung.id];
    if (luoi) datLuoi(dem, luoi, 0, 0, false);
  }

  const cells = docLuoi(dem.map((h) => h.join('')));
  return `<svg viewBox="0 0 ${O_LUOI} ${O_LUOI}" xmlns="http://www.w3.org/2000/svg" `
    + `shape-rendering="crispEdges">${veDai(cells, 1)}</svg>`;
}

/** Một nhãn dán đứng riêng (xem trước trong shop/kho) — nền trong suốt. */
export function veDanSVG(id: string): string {
  const luoi = LUOI_DAN[id];
  if (!luoi) return '';
  const w = luoi[0]!.length; const h = luoi.length;
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" `
    + `shape-rendering="crispEdges">${veDai(docLuoi(luoi), 1)}</svg>`;
}

/**
 * Băm chuỗi → số. Tất định, không phụ thuộc thứ tự chạy.
 * Giữ nguyên phép băm của bản cũ để bot không đổi mặt qua một lần deploy.
 */
export function bam(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Bot → SVG.
 *
 * `hat` là DANH TÍNH bot (nhãn archetype), KHÔNG PHẢI MÃ GHẾ. Bản cũ băm mã ghế,
 * mà mã ghế là VỊ TRÍ chứ không phải danh tính — nên "lại con này" mà docstring cũ
 * hứa thực ra là "lại cái ghế này", và ghế của người chơi (`'ban'`) băm ra đúng
 * MỘT khuôn mặt giống hệt nhau ở mọi trận với mọi người.
 */
export function veBotSVG(hat: string): string {
  const luoi = LUOI_BOT[bam(hat) % LUOI_BOT.length]!;
  const cells = docLuoi(luoi);
  return `<svg viewBox="0 0 ${O_LUOI} ${O_LUOI}" xmlns="http://www.w3.org/2000/svg" `
    + 'shape-rendering="crispEdges">'
    // Cạnh thứ ba bắt buộc — `h w v h z` mà thiếu `h-w` thì ra TAM GIÁC.
    // Xem docstring `veDai` trong `config/pixel_luoi.ts`.
    + `<path fill="${BANG_MAU.k}" d="M0,0h${O_LUOI}v${O_LUOI}h${-O_LUOI}z"/>`
    + `${veDai(cells, 1)}</svg>`;
}

/** Mọi lưới của tầng diện mạo — lint/test quét qua đây, không liệt kê tay. */
export const MOI_LUOI_DIEN_MAO: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(Object.entries(LUOI_NEN).map(([k, v]) => [`nen_${k}`, v])),
  ...LUOI_KHUNG,
  ...LUOI_DAN,
  ...Object.fromEntries(LUOI_BOT.map((v, i) => [`bot_${i}`, v])),
};

/** Catalog khai gì thì phải có lưới đó — dùng cho test, không liệt kê tay. */
export const CATALOG_CAN_LUOI: readonly string[] = [
  ...KHUNG.map((k) => k.id), ...NHAN_DAN.map((n) => n.id),
];

/** Vành khung, tái xuất để test hình học không phải import hai file. */
export const VANH = VANH_KHUNG;
