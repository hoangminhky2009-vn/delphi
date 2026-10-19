/**
 * NỘI DUNG ĐIỀU KHOẢN — NGUỒN CHÂN LÝ DUY NHẤT.
 *
 * Sống ở đây chứ không ở file markdown: có hai bản thì bản thứ hai luôn là bản
 * trôi, và cái trôi luôn là cái không ai đọc lại. `docs/phap-ly/` giữ phần
 * BỐI CẢNH (vì sao viết vậy, chỗ nào cần luật sư) và trỏ về file này.
 *
 * ⚠ GIỌNG (founder chốt 03/08): *"ghi tếu tếu vào đừng nghiêm túc quá như 1
 * bản hợp đồng"*. Ba luật giọng, giống hệt luật đã đặt cho màn hướng dẫn (D52):
 *   1. Không dùng từ chuyên ngành mà không dịch NGAY trong cùng câu.
 *   2. Câu đùa PHẢI chở thông tin — bỏ đi mà không mất gì thì bỏ thật.
 *   3. Nhưng phần NÓI ĐIỀU GÌ ĐƯỢC/KHÔNG ĐƯỢC thì nói rõ, đùa quanh chứ không
 *      đùa vào. Người ta cười xong vẫn phải biết luật là gì.
 *
 * ─── 19/09/2026 — VÌ SAO VIẾT LẠI ────────────────────────────────────────
 * Bản trước đề ngày 03/08 và MÔ TẢ SAI SẢN PHẨM suốt 6 tuần: nó kể app là chỗ
 * đoán số kinh tế (chợ dự báo — đóng băng từ D86), gọi Đấu trường là "một chế
 * độ đấu" trong khi đó là lõi, và KHÔNG CÓ MỘT CHỮ NÀO về ba thứ đã lên prod
 * sau đó: SỔ CHI TIÊU (07/09) · BUỔI ĐO trong lớp học (D333) · cửa nối thẻ với
 * sổ (consent v2, 13/09). Teammate bắt được khi đọc thử 19/09.
 *
 * ⚠ CƠ CHẾ THÌ KHÔNG LẠC HẬU — chỉ trang này lạc hậu. Bốn cửa consent của sổ
 * (`config/pfm_consent.ts` + `lib/pfm_chu.ts`) và văn bản buổi đo
 * (`lib/buoi_do_chu.ts`) đều chặt và có vết phiên bản. Trang này nay chỉ kể
 * lại cho đúng; ĐỪNG chép câu chữ của chúng sang đây (A11.5 — bản sao sẽ trôi).
 * Sửa câu chữ của một cửa ⇒ sửa ở file của cửa đó + tăng phiên bản, không sửa ở đây.
 *
 * ⚠ CÒN NỢ, KHÔNG GIẤU: trang chưa qua luật sư · email vẫn là gmail cá nhân ·
 * chưa có hạn xoá tự động. Cả ba nói thẳng trong văn bản thay vì lờ đi.
 * Ba mốc cần luật sư: `docs/luat/05-phap-ly.md` §2.
 *
 * ─── 11/10/2026 — SPEC chan-truoc-beta ───────────────────────────────────
 * Rà trước beta công khai bắt BA câu hứa không có mã đứng sau: "**Xem** tụi mình
 * giữ gì về bạn" (không endpoint nào trả) · "xoá tài khoản thì xoá ngay" (thật ra
 * ẩn danh hoá; nước đi ở lại) · "**Sửa** nhóm tuổi / vùng / nghề" (không cửa nào
 * sửa được). Nay mục `quyen` dựng từ `QUYEN` — mỗi câu "bạn làm được" khai luôn
 * route + endpoint đứng sau nó, và `web/tests/dieu_khoan_quyen.test.ts` đỏ khi một
 * câu trỏ vào đường không tồn tại. Thêm một quyền ⇒ thêm vào `QUYEN`, kèm đường.
 */

export interface MucDieuKhoan {
  id: string;
  tieuDe: string;
  /** Mỗi phần tử là một đoạn. `**đậm**` được render thành <strong>. */
  doan: readonly string[];
  /** Khối nhấn mạnh cuối mục — thứ mà đọc lướt cũng phải thấy. */
  nhan?: string;
}

export const CAP_NHAT_LUC = '12/10/2026';

export const TOM_TAT: readonly string[] = [
  'Đây là **trò chơi**. Token trong này là tiền đồ chơi, không đổi ra tiền thật, không đổi ra trà sữa.',
  'App có chỗ để bạn **ghi chi tiêu thật** của mình — phần này **đang tạm khoá trên web**, mở lại khi app có bản cài trên điện thoại. Sổ nằm **trên máy bạn**; gửi gì ra ngoài thì có **bốn công tắc riêng, mặc định tắt hết**.',
  'Tụi mình **có** ghi lại cách bạn dùng app, để biết chỗ nào khó hiểu mà sửa. **Tắt được** — chơi một mình thì vẫn chơi đủ.',
  'Khi app **vỡ** trên máy bạn, máy gửi về **một mã lỗi không gắn với bạn**: mã lỗi, tên màn, số bản. Cái này không tắt, vì nó chỉ nói app hỏng ở đâu, không nói gì về bạn.',
  'Tụi mình **không** hỏi tên thật, ngày sinh đầy đủ, số điện thoại, địa chỉ hay bạn đang ở đâu. **Không nối với ngân hàng** của bạn.',
  'Mùa này dữ liệu **chỉ để nghiên cứu và sửa app** — không bán, không chia cho ai.',
  '**16 tuổi trở lên** nhé.',
];

/**
 * Một quyền "bạn làm được" — câu chữ + ĐƯỜNG MÃ ĐỨNG SAU (SPEC chan-truoc-beta; luật "câu hứa phải trỏ tới mã đang có").
 *   `man`   — route web nơi người dùng bấm (phải có trong `app/routes.tsx` và KHÔNG bị khoá về Hub).
 *   `duong` — endpoint server làm việc ấy (`METHOD /api/v1/...`, phải được đăng ký ở `server/`), hoặc `mailto` (email cuối trang).
 * `web/tests/dieu_khoan_quyen.test.ts` đỏ khi một câu trỏ vào đường không tồn tại.
 */
export interface QuyenDuLieu {
  chu: string;
  man: string | null;
  duong: readonly string[];
}

export const QUYEN: readonly QuyenDuLieu[] = [
  {
    chu: '**Xem và tải về** mọi thứ tụi mình đang giữ về bạn — **Hồ sơ → Dữ liệu của tôi**: hồ sơ, từng ô đồng ý kèm số bản và lịch sử bật/tắt, số dòng ghi theo loại; nút **Tải về** ra một tệp .json.',
    man: '/ho-so', duong: ['GET /api/v1/account/du-lieu', 'GET /api/v1/account/du-lieu/xuat'],
  },
  {
    chu: '**Sửa** nhóm tuổi / vùng / nghề nếu lỡ khai nhầm — chưa có nút tự sửa; gửi **Báo lỗi** trong Hồ sơ hoặc email ở cuối trang, tụi mình sửa giúp.',
    man: '/ho-so', duong: ['POST /api/v1/bao-loi', 'mailto'],
  },
  {
    chu: '**Tắt** phần nghiên cứu bất cứ lúc nào, ở **Hồ sơ → Dữ liệu của tôi**. Tắt thì phần xếp hạng khoá lại, còn chơi tự do vẫn nguyên.',
    man: '/ho-so', duong: ['POST /api/v1/account/consent'],
  },
  {
    chu: '**Đóng mọi cửa và xoá sạch sổ chi tiêu** — một nút ở **Hồ sơ → Dữ liệu của tôi**: đóng cả bốn cửa, xoá cả bản trên máy lẫn bản trên máy chủ, không cần xoá tài khoản.',
    man: '/ho-so', duong: ['POST /api/v1/pfm/xoa'],
  },
  {
    chu: '**Rút lại đồng ý buổi đo** — thẻ vẫn là của bạn, số của bạn rời khỏi bức tranh nhóm từ lần tổng hợp kế.',
    man: '/arena', duong: ['POST /api/v1/holdem/ban/:ma/rut-dong-y'],
  },
  {
    chu: '**Xoá tài khoản** — ở cuối Hồ sơ. Email và tên hiển thị biến mất, dấu vết cách dùng app và báo lỗi xoá hẳn. Nước đi trong trận ở lại dưới một mã ẩn danh, không còn chỉ về bạn nữa.',
    man: '/ho-so', duong: ['POST /api/v1/account/delete'],
  },
  {
    chu: '**Báo lỗi** ngay trong app — **Hồ sơ → Báo lỗi**. Tụi mình nhận chữ bạn gõ kèm số bản app, màn bạn vừa đứng trước khi vào Hồ sơ, mã lỗi gần nhất, mã tài khoản, và email nếu bạn tự điền.',
    man: '/ho-so', duong: ['POST /api/v1/bao-loi'],
  },
  {
    chu: '**Hỏi bất cứ điều gì** qua email ở cuối trang, hoặc ô **Báo lỗi** trong Hồ sơ. Tụi mình có đúng một người trả lời, nên hơi chậm — nhưng sẽ trả lời, và cố trong vòng một tuần.',
    man: '/ho-so', duong: ['mailto', 'POST /api/v1/bao-loi'],
  },
];

export const MUC: readonly MucDieuKhoan[] = [
  {
    id: 'la-gi',
    tieuDe: 'ĐÂY LÀ CÁI GÌ',
    doan: [
      'Ba thứ trong một app, và hiện tại chỉ ba thứ đó.',
      '**1. Đấu trường** — phần chính. Một trận 12 vòng: mỗi vòng thị trường lật một ô, bạn chia tiền (tiền ảo) vào sáu loại tài sản, bấm chốt, rồi xem mình lời lỗ bao nhiêu và vì sao. Hết trận có thứ hạng và một thẻ nói về cách bạn chơi.',
      '**2. Sổ chi tiêu** — chỗ bạn tự ghi tiền thật của mình, nếu bạn muốn. Nằm trên máy bạn. Mục riêng ở dưới nói kỹ.',
      '**3. Thẻ tính cách và thẻ năng lực** — thứ app trả về cho bạn sau khi bạn chơi: bạn đọc thị trường thế nào, có giữ được cam kết tiết kiệm không, có chia trứng ra nhiều giỏ không.',
      'Còn một phần nữa gọi là **chợ dự báo** — đoán mấy con số kinh tế ngoài đời bằng token. **Mùa này nó đang đóng băng**: không mở kèo mới. Kèo cũ nếu còn thì vẫn chốt đúng luật ghi ở mục dưới.',
      'Đồ thị trong app trông rất nghiêm túc. Đừng để nó lừa: đây vẫn là game, và tiền trong đó là tiền giả.',
    ],
  },
  {
    id: 'khong-phai',
    tieuDe: 'VÀ ĐÂY KHÔNG PHẢI CÁI GÌ',
    doan: [
      '**Không phải chỗ đầu tư.** Không có đồng nào của bạn đi vào đây, và cũng không có đồng nào đi ra. Nếu bạn đang tìm chỗ để tiền sinh lời thì bạn vào nhầm app rồi, thật đấy.',
      '**Không nối với ngân hàng của bạn.** Sổ chi tiêu là bạn tự gõ vào. App không đọc tin nhắn ngân hàng, không xin mã OTP, không liên kết tài khoản, không đọc app ngân hàng nào. Ai bảo bạn nhập mấy thứ đó nhân danh tụi mình thì đó là lừa đảo — chụp màn hình gửi tụi mình.',
      '**Không phải lời khuyên tài chính.** Tụi mình không phải chuyên gia được cấp phép, và mấy con số trong app là để chơi. Thắng 100 ván ở đây không có nghĩa bạn nên thuyết phục mẹ dồn tiền tiết kiệm vào vàng. Thị trường thật không đọc luật chơi của tụi mình, và nó cũng chẳng quan tâm bạn đang là Cá Mập hay Cá Voi.',
      '**Không phải thuốc.** App này không chữa gì hết — không chữa bệnh, không chữa lo âu, không chữa thói quen xấu. Nếu bạn đang thấy khó khăn về sức khoẻ tinh thần, hãy nói chuyện với người có chuyên môn. Tụi mình làm game, không làm bác sĩ. Và app này cũng không thay được việc ngủ đủ giấc.',
      '**Không phải khoá học có bằng.** Bạn sẽ học được kha khá về cách thị trường vận hành — đó là chủ đích. Nhưng không có chứng chỉ nào ở cuối, và chưa có nhà tuyển dụng nào nhận người vì thành tích trong app này. Tụi mình đã hỏi. Chưa ai gọi lại.',
    ],
  },
  {
    id: 'ai-vao',
    tieuDe: 'AI VÀO ĐƯỢC',
    doan: [
      '**Từ 16 tuổi.** Lúc lập hồ sơ bạn khai năm sinh để hệ thống kiểm tra, xong nó **quên luôn con số đó** — chỉ giữ lại "nhóm 18–22" chẳng hạn. Thứ không lưu thì không lộ được.',
      '**Chơi thử không cần tài khoản.** Vào bằng KHÁCH là chơi được ngay, không cần email. Lúc đó tụi mình cũng không ghi gì về bạn cho nghiên cứu cả — chỉ có báo lỗi ẩn danh ở mục Dữ liệu, thứ không biết bạn là ai.',
      '**Một người một tài khoản.** Đừng lập ba tài khoản để tự tặng điểm cho nhau. Nó vừa làm bảng xếp hạng thành trò cười, vừa làm bẩn đúng thứ dữ liệu mà tụi mình xây cả app để thu. Bắt được là khoá, không nhắc trước.',
      '**Không dùng máy thay tay.** Không script, không bot. Nếu bạn giỏi tới mức viết được bot chơi thay, tụi mình thật lòng muốn nói chuyện — nhưng là qua email, không phải qua bảng xếp hạng.',
    ],
    nhan: 'Nếu bạn từ 16 đến dưới 18: nói với bố mẹ là bạn đang dùng app này nhé, nhất là phần dữ liệu và phần sổ chi tiêu ở dưới. Không phải vì tụi mình làm gì mờ ám, mà vì đó là chuyện nên nói.',
  },
  {
    id: 'token',
    tieuDe: 'TOKEN T — TIỀN ĐỒ CHƠI, VÀ TỤI MÌNH NÓI THẬT',
    doan: [
      'Token T, điểm Q, đồ trang trí, thứ hạng — **không có giá trị thật**. Không mua được bằng tiền, không bán lại, không đổi ra tiền mặt, thẻ cào, hay bất cứ thứ gì ăn được.',
      'Không chuyển được sang tài khoản khác. Mỗi mùa (3 tháng) có thể được sắp xếp lại theo luật báo trước.',
      'Nếu có lỗi kỹ thuật làm số dư của bạn sai, tụi mình sẽ **sửa cho đúng** — kể cả khi sửa xong bạn nghèo đi. Xin lỗi trước.',
    ],
    nhan: 'Tụi mình không bán token, không bán lợi thế. Không có gói nạp nào giúp bạn đoán giỏi hơn. Nếu có ngày app bán gì đó thì chỉ là đồ trang trí, và điều khoản này sẽ được sửa TRƯỚC chứ không phải sau.',
  },
  {
    id: 'so-chi-tieu',
    tieuDe: 'SỔ CHI TIÊU — SỔ CỦA BẠN, TRÊN MÁY BẠN',
    doan: [
      'App có một cuốn sổ để bạn ghi tiền thật: tiêu gì, bao nhiêu, bỏ ống được bao nhiêu. **Không bắt buộc.** Không ghi thì phần còn lại của app vẫn chạy đủ.',
      '**Hiện đang tạm khoá trên web** — sẽ mở lại khi app có bản cài trên điện thoại. Lúc khoá, app không mở sổ và không gửi gì của sổ đi đâu. Sổ cũ bạn đã ghi vẫn nằm yên trên máy; muốn xoá thì vào **Hồ sơ → Dữ liệu của tôi**.',
      '**Sổ nằm trên máy bạn.** Mặc định nó không đi đâu cả. Muốn gửi thứ gì ra ngoài thì có **bốn công tắc riêng, mặc định tắt hết**, và ngay cạnh mỗi công tắc luôn có một dòng nói **chính xác cái gì rời máy** — không giấu sau nút bấm nào.',
      '**Sao lưu két** — giữ một bản sao sổ ngoài máy để đổi máy hay mất máy vẫn còn sổ. Bản sao đó **đã khoá bằng mã khôi phục mà chỉ máy bạn giữ**: máy chủ cất được mà không mở được. Mất mã là mất bản sao, không ai khôi phục hộ được.',
      '**Đặc trưng nghiên cứu** — gửi vài con số đã gộp của cả tháng (kiểu tỷ lệ ngày có ghi) và dấu vết thao tác dạng mã. **Không một số tiền, tên hũ hay ghi chú nào.**',
      '**Điểm danh và token** — máy chủ đếm chuỗi ngày bạn có mặt và phát token khi bạn chốt sổ tuần. Chỉ ngày và trạng thái, không kèm số tiền.',
      '**Nối thẻ tính cách với sổ** — không gửi thêm gì; chỉ cho phép ghép nhãn sổ đã gộp với cách bạn chơi, để nghiên cứu xem hai bên có giống nhau không.',
      '**Tắt lúc nào cũng được**, và có nút **xoá sạch** — xoá cả trên máy lẫn trên máy chủ (lúc sổ khoá, nút ấy ở **Hồ sơ → Dữ liệu của tôi**).',
    ],
    nhan: 'Mỗi cái công tắc trên đây có một bản văn riêng, và **sửa một chữ trong đó là một bản mới — lúc ấy tụi mình hỏi lại bạn.** Tụi mình không xài lại cái gật đầu cũ cho một nội dung mới. Đó là lý do bạn thấy số hiệu bản nhỏ nhỏ cạnh mỗi công tắc.',
  },
  {
    id: 'buoi-do',
    tieuDe: 'BUỔI ĐO CÙNG NHÓM',
    doan: [
      'Đôi khi app chạy một **buổi đo**: cả một nhóm (lớp học, câu lạc bộ) cùng chơi một đề, mỗi người một ghế riêng, có một người điều phối. Bạn chỉ vào nếu có ai đó gửi link mời và bạn bấm đồng ý.',
      '**Đồng ý riêng.** Cái ô lúc lập hồ sơ không kéo bạn vào buổi đo. Trước khi vào bàn, bạn đọc một văn bản riêng và bấm đồng ý, hoặc quay về sảnh.',
      '**Rời máy:** nước đi trong trận (như mọi trận), năm sinh dạng khoảng, và bài giấy bạn tự nộp cho người điều phối.',
      '**Tổ chức nhận gì:** chỉ **bức tranh của cả nhóm**, đã làm tròn, và chỉ khi nhóm đủ đông — không có dòng nào nói về một người cụ thể. Thẻ của riêng bạn là của bạn.',
      'Bài giấy được ghép với trận chơi bằng một **mã tham gia** bạn tự chép, **không bằng tên bạn**.',
      '**Rút lại lúc nào cũng được:** thẻ vẫn là của bạn, còn số của bạn rời khỏi bức tranh nhóm từ lần tổng hợp kế tiếp.',
    ],
    nhan: 'Hai điều này tụi mình hứa vĩnh viễn, không kèm điều kiện: **không ai mua được đường đi tới một cá nhân**, và **không số tiền thô nào của bạn rời máy**. Mọi câu khác ở trên chỉ tả dòng dữ liệu của buổi này — buổi khác kiểu khác thì là một bản mới, và bạn được hỏi lại.',
  },
  {
    id: 'keo',
    tieuDe: 'CHỢ DỰ BÁO — KẾT QUẢ CHỐT THẾ NÀO',
    doan: [
      'Phần này **mùa 0.0 đang đóng băng** (không mở kèo mới). Luật dưới đây vẫn áp cho kèo cũ nếu còn, và sẽ là luật khi mở lại.',
      '**Nguồn chốt kết quả được ghi ngay trên kèo, TRƯỚC khi kèo mở.** Bạn biết trước tụi mình sẽ nhìn vào đâu để xử.',
      '**Số công bố lần đầu của nguồn đó là chung thẩm** — kể cả khi hôm sau nguồn sửa lại cho đúng hơn. Nghe hơi cứng, nhưng nó tồn tại để không ai phải cãi nhau sau khi đã biết kết quả. Ranh giới vẽ trước thì rẻ; vẽ sau thì luôn có người thấy mình bị xử ép.',
      '**Nguồn im lặng quá 7 ngày** ⇒ kèo tự huỷ, hoàn 100% token, không trừ phí gì.',
      'Tụi mình chỉ hỏi về **kinh tế và đời sống**, nguồn chính thức công khai. Không thể thao, không chính trị, không đời tư người nổi tiếng.',
    ],
  },
  {
    id: 'du-lieu',
    tieuDe: 'DỮ LIỆU — PHẦN NGƯỜI TA HAY BỎ QUA, ĐỌC CÁI NÀY THÔI CŨNG ĐƯỢC',
    doan: [
      '**Mùa này dữ liệu của bạn đi đúng một chỗ: làm app đỡ dở hơn, và nghiên cứu xem người trẻ Việt quyết định với tiền thế nào. Không bán, không chia cho ai.** Không quảng cáo, không doanh thu, không có phòng marketing nào ngồi phân tích bạn.',
      '**Tụi mình ghi lại:** email và mật khẩu (mật khẩu ở dạng **băm** — tức tụi mình cũng không đọc được, chỉ so được), tên hiển thị bạn tự chọn, nhóm tuổi / vùng / nhóm nghề dạng **khoảng**, và cách bạn dùng app: nước đi trong trận, ở màn nào bao lâu, bỏ hướng dẫn ở bước nào, màn nào hay lỗi.',
      '**Tụi mình KHÔNG hỏi:** tên thật · ngày sinh đầy đủ · số điện thoại · địa chỉ · căn cước · thẻ ngân hàng · vị trí GPS · danh bạ · ảnh. Không phải vì tử tế đâu — mà vì thứ không có thì không mất được.',
      '**Có ba loại ghi, và chỉ một loại tắt được.** Nước đi trong trận thì phải ghi, vì nó **chính là số dư của bạn** — không ghi thì không chơi tiếp được. Dấu vết thao tác (bạn dừng ở màn nào, bỏ hướng dẫn ở đâu) là phần nghiên cứu, và phần đó **tắt được**. Loại thứ ba là báo lỗi ẩn danh, ngay dưới đây.',
      '**Cách tụi mình thi hành lời hứa đó:** không tích ô thì **không có dòng nào được tạo ra ngay từ đầu** — chứ không phải tạo rồi hứa sẽ lọc sau. Lọc sau là thứ sẽ hỏng vào ngày có người quên.',
      '**Báo lỗi ẩn danh — loại thứ ba.** Khi app vỡ trên máy bạn, máy gửi về đúng ba thứ: **một mã lỗi** (kiểu `route:typeerror:1f3kq2` — một chuỗi băm, không chở lời nhắn lỗi), **tên màn** đang mở, và **số bản app**. Không mã tài khoản, không email, không chữ bạn gõ. Nó đi qua máy chủ của tụi mình rồi mới tới **Sentry** — một dịch vụ cất báo cáo lỗi, máy chủ đặt ở nước ngoài — nên Sentry cũng không thấy địa chỉ mạng của bạn. Áp cho mọi người, kể cả khách và cả khi bạn đã tắt phần nghiên cứu: nó không biết bạn là ai, nên cũng chẳng có gì về bạn để tắt. Lỗi phía máy chủ của tụi mình cũng báo về cùng chỗ đó.',
      '**Ô Báo lỗi trong Hồ sơ thì khác: đó là bạn tự gửi.** Nó mang đi **đúng chữ bạn gõ**, kèm **số bản app**, **màn bạn vừa đứng trước khi vào Hồ sơ**, **mã lỗi gần nhất** trên máy (nếu có), **mã tài khoản** (một chuỗi ngẫu nhiên để tụi mình tìm đúng trận của bạn mà dựng lại lỗi — không phải email, không phải tên) và **email nếu bạn tự điền** để được trả lời. Cái này cất trong cơ sở dữ liệu của app ở Singapore — cùng chỗ với tài khoản, xoá tài khoản là xoá luôn. Sentry chỉ nhận một tiếng chuông \'có báo lỗi mới\' kèm số bản, tên màn và mã lỗi — không có chữ bạn gõ, không mã tài khoản, không email. Ngay dưới ô luôn có một dòng ghi chính xác cái gì đi kèm. Đừng dán mật khẩu hay số tài khoản ngân hàng vào đó — tụi mình không cần, và cũng không muốn giữ.',
      '**Chơi một mình thì cứ chơi** — đấu máy, ghi sổ, mở ví, xem lịch sử, đủ hết, không cần bật gì. **Xếp hạng** thì cần bật, vì lúc đó tên bạn đứng cạnh tên người lạ và điểm của bạn đẩy hạng người khác xuống.',
      '**Tắt lúc nào cũng được**, trong **Hồ sơ → Dữ liệu của tôi**, và tụi mình ngừng ghi dấu vết thao tác **ngay lập tức** (báo lỗi ẩn danh ở trên vẫn chạy — nó không gắn với bạn). Bật lại là leo hạng tiếp — token, thứ hạng, đồ trang trí vẫn nguyên.',
      '**Ô này cũng có số bản** như mọi công tắc dữ liệu khác: mỗi lần bật/tắt để lại một dòng ghi bạn đã đồng ý với bản nào. Văn bản đổi là một bản mới — tới lúc đó tụi mình hỏi lại, và chưa trả lời thì coi như **tắt**.',
      '**Dữ liệu nằm ở đâu:** cơ sở dữ liệu đặt ở **Singapore**, app chạy nhờ hai dịch vụ hạ tầng có máy chủ nhiều nơi trên thế giới, nên đường truyền có thể đi qua nước khác; báo lỗi thì cất ở **Sentry** (ở trên), máy chủ ở nước ngoài. Tụi mình không tự dựng máy chủ, và cũng không gửi dữ liệu của bạn cho bên nào khác ngoài chính mấy dịch vụ chạy app này.',
      '**Giữ bao lâu:** nói thật là **hiện chưa có lịch xoá tự động** — app mới, và tụi mình chưa muốn hứa một con số rồi không giữ. Cái chắc chắn: **bạn xoá tài khoản thì email và tên hiển thị biến mất ngay**, dấu vết cách dùng app và báo lỗi bị **xoá hẳn**; còn nước đi trong trận thì **ở lại dưới một mã ẩn danh** — không còn đường nào từ mã đó về email hay tên bạn. Nút xoá sạch của sổ chi tiêu xoá cả hai đầu. Khi nào có lịch cố định, tụi mình ghi vào đây và báo trong app.',
      '**Về lâu dài**, dữ liệu **tổng hợp** (kiểu "nhóm 18–22 miền Nam hay đổi ý sau khi thấy đám đông chọn gì") có thể trở thành phần giá trị của dự án. Nếu tới ngày đó, tụi mình sẽ **hỏi lại bạn**, chứ không dựa vào một dòng cho phép rộng viết sẵn từ hôm nay. Viết sẵn để dùng dần là kiểu xin phép mà ai đọc kỹ cũng thấy khó chịu.',
    ],
    nhan: 'Thứ gắn với danh tính của bạn — email, tên hiển thị, hồ sơ một người cụ thể — thì KHÔNG BAO GIỜ bán, không có ngoại lệ nào cả.',
  },
  {
    id: 'quyen',
    tieuDe: 'BẠN LÀM GÌ ĐƯỢC VỚI DỮ LIỆU CỦA MÌNH',
    doan: QUYEN.map((q) => q.chu),
  },
  {
    id: 'ten',
    tieuDe: 'TÊN HIỂN THỊ',
    doan: [
      'Tên của bạn **người lạ nhìn thấy được**. Nên: không từ tục, không từ phân biệt, không giả danh người khác hay giả danh ban quản trị.',
      'Tụi mình có thể đổi tên hoặc khoá tài khoản vi phạm, và với ca nặng thì làm luôn, không báo trước.',
    ],
    nhan: 'Quy tắc thực dụng: đặt tên nào mà bạn đọc to lên trong bữa cơm gia đình được, không ai phải bỏ đũa xuống.',
  },
  {
    id: 'doi-luat',
    tieuDe: 'TỤI MÌNH SẼ ĐỔI LUẬT, VÀ ĐÂY LÀ CÁCH',
    doan: [
      'App đang lớn lên, nên luật chơi, con số cân bằng, tính năng, giao diện **sẽ thay đổi**. Cụ thể tụi mình có quyền chỉnh số, đổi luật một chế độ, thêm bớt tính năng, sắp xếp lại token và thứ hạng khi sang mùa mới, và tạm dừng app để sửa lỗi.',
      '**Đổi luật giữa chừng không làm hỏng trận bạn đang chơi.** Mỗi trận chạy theo đúng bộ luật lúc nó được tạo ra, và giữ bộ luật đó tới hết trận. Luật mới chỉ áp cho trận mở sau đó.',
      '**Thay đổi lớn về điều khoản hoặc về dữ liệu sẽ được báo trong app trước.** Đổi vặt (sửa lỗi chính tả, viết lại cho dễ hiểu) thì tụi mình đổi ngày ở cuối trang là xong.',
      '**Riêng mấy cái công tắc dữ liệu thì không đổi thầm được:** mỗi văn bản đồng ý có số hiệu bản, và sửa một chữ là một bản mới — tới lúc đó tụi mình hỏi lại bạn chứ không xài tiếp cái gật đầu cũ.',
    ],
  },
  {
    id: 'beta',
    tieuDe: 'ĐANG LÀ BẢN THỬ — NÓI TRƯỚC CHO ĐỠ GIẬN',
    doan: [
      '**Sẽ có lỗi.** Có thể lỗi làm sai số dư, sai thứ hạng, hoặc mất tiến độ.',
      'Trong giai đoạn thử, tụi mình có thể **đặt lại toàn bộ dữ liệu chơi** — và sẽ báo trước khi làm.',
      'App có thể chậm hoặc sập một lúc. Hạ tầng chạy trên gói miễn phí, và gói miễn phí thì cũng có tâm trạng của nó.',
      '**Trang này do tụi mình tự viết, chưa có luật sư rà.** Tụi mình viết đúng nhất có thể theo những gì app thật sự làm. Nếu bạn thấy chỗ nào trang này hứa mà app làm khác, báo ngay (nút **Báo lỗi** trong Hồ sơ) — đó là lỗi nặng nhất một trang như thế này có thể có, và tụi mình sẽ sửa trước mọi việc khác.',
      'Trong phạm vi pháp luật cho phép, tụi mình không chịu trách nhiệm cho thiệt hại phát sinh từ việc dùng app.',
    ],
    nhan: 'Nếu bạn tìm ra một lỗi làm bạn giàu bất thường: báo tụi mình. Tụi mình sẽ vá, ghi công bạn, và không kiện ai hết. Còn nếu im lặng cày tới lúc bảng xếp hạng thành trò cười thì tụi mình sẽ xoá sạch — và lúc đó chẳng ai vui, kể cả bạn.',
  },
];
