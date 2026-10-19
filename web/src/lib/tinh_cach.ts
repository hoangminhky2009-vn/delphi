/**
 * TÍNH CÁCH TÀI CHÍNH — catalog CÂU CHỮ + EMOJI cho hồ sơ người chơi (D106).
 *
 * Founder 22/08: *"làm nó tếu tếu và meme tý kiểu dùng icon meme hay là các từ
 * như bro, anh bạn thật sự… Dựa trên độ tuổi được chọn khi đăng nhập tài khoản
 * hoặc phần setting"*. ⇒ MỖI thẻ có BA GIỌNG:
 *   · `tre`   — 16–22: bro, meme, 🗿💀🙏
 *   · `vua`   — 23–30: tếu nhẹ, ít meme
 *   · `chung` — 31+: chững, vẫn có duyên
 * Giọng mặc định suy từ `age_band`; người chơi đổi được ở CÀI ĐẶT (`giong_ho_so`).
 *
 * ⚠ MỤC TIÊU ĐÃ CHỈNH (D106): thẻ là tấm GƯƠNG về CÁCH TIÊU TIỀN / quản lý tiền
 * cá nhân, KHÔNG phải hồ sơ nhà đầu tư. Mọi câu đọc vị nói bằng ngôn ngữ chi
 * tiêu ngoài đời (tiền lệ D28), trận đấu chỉ là nơi đo.
 * ⚠ MÔ TẢ được, KÊ ĐƠN không (A10): mô tả nói về HÀNH VI ĐÃ ĐO; gợi ý kết bằng
 * CÂU HỎI, không một chữ NÊN/HÃY/ĐỪNG/PHẢI — `web/tests/tinh_cach.test.ts` quét
 * cả ba giọng. PFM sau này làm A10 nặng hơn, không nhẹ đi.
 * ⚠ Server chỉ trả ID + SỐ (`/holdem/me/tinh-cach`); mọi chữ nằm ở đây.
 * ⚠ EMOJI LÀ CỐ Ý ở màn này (founder đặt hàng) — khác luật màn TRẬN (D47).
 *
 * THẺ = KHẨU VỊ × NÉT (insight.ts): 3 khẩu vị {để dành · dồn · rải} × 3 nét
 * {lạnh · bị kết quả điều khiển · bị bên ngoài kéo} + 🐣. Bậc ĐỌC (kỹ năng) tách
 * riêng — không vào thẻ.
 */
import type {
  BacDocId, KhauViId, NetId, SauChiSo, TinhCachId,
} from '@server/holdem/insight';

export type Giong = 'tre' | 'vua' | 'chung';
export type GiongChon = 'tu_dong' | Giong;

/**
 * Giọng từ tuổi + lựa chọn. `tu_dong`: 16–17 · 18–22 ⇒ trẻ · 23–30 ⇒ vừa ·
 * 31+ ⇒ chững · chưa khai tuổi (khách bậc 0, D64) ⇒ vừa — giọng giữa là giọng
 * ít sai nhất khi không biết đang nói với ai.
 */
export function giongCua(ageBand: string | null | undefined, chon: GiongChon | null | undefined): Giong {
  if (chon && chon !== 'tu_dong') return chon;
  switch (ageBand) {
    case '16-17': case '18-22': return 'tre';
    case '23-30': return 'vua';
    case '31-45': case '46+': return 'chung';
    default: return 'vua';
  }
}

export const TEN_GIONG: Record<GiongChon, { ten: string; giai: string }> = {
  tu_dong: { ten: 'TỰ ĐỘNG THEO TUỔI', giai: 'đọc tuổi bạn khai lúc đăng ký' },
  tre: { ten: 'GEN Z', giai: 'bro, meme, 🗿 — nói thẳng kiểu bạn bè' },
  vua: { ten: 'VỪA VỪA', giai: 'tếu nhẹ, bớt meme' },
  chung: { ten: 'CHỮNG CHẠC', giai: 'nghiêm túc, vẫn có duyên' },
};

export interface TheTinhCach {
  emoji: string;
  ten: string;
  /** Một câu ĐỌC VỊ — thứ người ta muốn chụp màn hình gửi bạn bè. */
  doc_vi: string;
  /** Gợi ý — mô tả + câu hỏi, không kê đơn. */
  goi_y: string;
}

type BaGiong = Record<Giong, TheTinhCach>;

export const THE_TINH_CACH: Record<TinhCachId, BaGiong> = {
  dang_dinh_hinh: {
    tre: {
      emoji: '🐣', ten: 'TRỨNG CHƯA NỞ',
      doc_vi: 'Bro chơi thêm đi, data còn đang loading 🗿 — chưa đủ ván để đọc vị.',
      goi_y: 'Tấm thẻ tự nở khi đủ gói — thanh tiến độ ngay dưới nói còn thiếu gì.',
    },
    vua: {
      emoji: '🐣', ten: 'TRỨNG CHƯA NỞ',
      doc_vi: 'Chưa đủ ván để đọc vị bạn — con số còn đang giữ bí mật.',
      goi_y: 'Chơi đủ gói là thẻ tự lộ mặt; thanh tiến độ bên dưới nói còn thiếu gì.',
    },
    chung: {
      emoji: '🐣', ten: 'CHƯA ĐỦ DỮ LIỆU',
      doc_vi: 'Chưa đủ ván đã hoàn thành để rút ra một chân dung đáng tin.',
      goi_y: 'Thẻ xuất hiện khi gói dữ liệu đầy — tiến độ bên dưới cho biết còn thiếu gì.',
    },
  },

  // ── ĐỂ DÀNH ────────────────────────────────────────────────────────────
  de_danh_lanh: {
    tre: {
      emoji: '🧊', ten: 'TỦ LẠNH CÓ KHOÁ',
      doc_vi: 'Phần lớn tiền bro không động tới, chợ lên chợ xuống bro vẫn lạnh 🗿. Kỷ luật hơi ghê.',
      goi_y: 'Anh bạn thật sự: mấy lần chợ rẻ hẳn mà bro vẫn cất, lần nào là tiếc nhất? 🤔',
    },
    vua: {
      emoji: '🧊', ten: 'TỦ LẠNH CÓ KHOÁ',
      doc_vi: 'Phần lớn tiền nằm yên, và không cảm xúc nào lay được cái tủ đó.',
      goi_y: 'Để dành là sức mạnh — nhưng có nhịp nào đáng mở tủ mà bạn đã đi qua không?',
    },
    chung: {
      emoji: '🧊', ten: 'QUỸ DỰ PHÒNG VỮNG',
      doc_vi: 'Phần lớn tiền được giữ lại, và quyết định không dao động theo kết quả hay tin tức.',
      goi_y: 'Có những thời điểm nào bạn thấy việc giữ lại là đúng — và thời điểm nào là do thói quen?',
    },
  },
  de_danh_ket_qua: {
    tre: {
      emoji: '🐢', ten: 'RÙA NHẠY CẢM',
      doc_vi: 'Bro cất là chính, nhưng một ván đỏ là rụt cổ / một ván xanh là thò ra chi 💀.',
      goi_y: 'Sau một ngày tệ, bro có hay "thưởng cho mình" một món không? Tần suất bao nhiêu? 🙏',
    },
    vua: {
      emoji: '🐢', ten: 'RÙA NHẠY CẢM',
      doc_vi: 'Thường thì cất kỹ, nhưng kết quả vừa rồi quyết định tay bạn mở hay đóng.',
      goi_y: 'Những lần chi sau một ngày tệ — bạn còn kể được mình đã mua gì không?',
    },
    chung: {
      emoji: '🐢', ten: 'GIỮ TIỀN THEO TÂM TRẠNG',
      doc_vi: 'Mức giữ tiền cao, nhưng cách chi tiêu đổi theo thắng thua gần nhất.',
      goi_y: 'Khoản chi nào trong tháng này đến ngay sau một tin không vui?',
    },
  },
  de_danh_ben_ngoai: {
    tre: {
      emoji: '🛒', ten: 'XEM SALE RỒI THÔI',
      doc_vi: 'Bro cất tiền giỏi, nhưng "sắp hết hàng" hay "đang trend" là tay hơi ngứa 🗿.',
      goi_y: 'Món gần nhất mua vì thấy người ta mua — giờ còn dùng không bro? 💀',
    },
    vua: {
      emoji: '🛒', ten: 'XEM SALE RỒI THÔI',
      doc_vi: 'Để dành là bản năng — nhưng một tin nóng hay một đợt giá chạy là bạn nhích tay.',
      goi_y: 'Trong các lần mua vì "deal sắp hết", bao nhiêu lần deal đó thật sự hết?',
    },
    chung: {
      emoji: '🛒', ten: 'THẬN TRỌNG, DỄ BỊ RỦ',
      doc_vi: 'Tỷ lệ giữ tiền cao; các quyết định chi lại tập trung vào lúc có tin hoặc xu hướng mới.',
      goi_y: 'Những khoản chi theo tin tức — bao nhiêu phần bạn đã kiểm chứng trước khi quyết?',
    },
  },

  // ── DỒN ────────────────────────────────────────────────────────────────
  don_lanh: {
    tre: {
      emoji: '🎯', ten: 'MỘT PHÁT MỘT MỤC TIÊU',
      doc_vi: 'Bro dồn tiền vào một hai thứ, và bình tĩnh tới mức đáng ngờ 🫡.',
      goi_y: 'Anh bạn thật sự: cả trứng một giỏ — giỏ đó bro chọn vì hiểu nó hay vì tiện? 🤔',
    },
    vua: {
      emoji: '🎯', ten: 'MỘT PHÁT MỘT MỤC TIÊU',
      doc_vi: 'Dồn vào một hai thứ, và không cảm xúc nào làm bạn đổi ý giữa chừng.',
      goi_y: 'Tập trung là một lựa chọn — bạn có biết rõ mình đang đánh cược vào điều gì không?',
    },
    chung: {
      emoji: '🎯', ten: 'TẬP TRUNG CÓ CHỦ ĐÍCH',
      doc_vi: 'Phần lớn tiền dồn vào ít mục, quyết định ổn định bất kể kết quả gần nhất.',
      goi_y: 'Nếu mục lớn nhất đó hỏng, phần còn lại đủ cho bao lâu?',
    },
  },
  don_ket_qua: {
    tre: {
      emoji: '🎢', ten: 'TÀU LƯỢN CẢM XÚC',
      doc_vi: 'Dồn hết vào một thứ, thắng thì gấp đôi, thua thì gấp đôi để gỡ 💀🙏.',
      goi_y: 'Bro ơi, lần gần nhất "chơi thêm ván nữa để gỡ" — kết quả sao? 🗿',
    },
    vua: {
      emoji: '🎢', ten: 'TÀU LƯỢN CẢM XÚC',
      doc_vi: 'Dồn tiền, và cỡ tay sau mỗi kết quả to nhỏ theo tâm trạng chứ không theo kế hoạch.',
      goi_y: 'Sau một cú đau, thử đứng ngoài đúng một nhịp — cảm giác đòi gỡ có tự nguội không?',
    },
    chung: {
      emoji: '🎢', ten: 'DỒN VÀ DAO ĐỘNG',
      doc_vi: 'Tập trung cao, nhưng quy mô quyết định phụ thuộc mạnh vào kết quả vừa rồi.',
      goi_y: 'Bạn có phân biệt được khoản chi "để bù" và khoản chi "theo kế hoạch" trong tháng này không?',
    },
  },
  don_ben_ngoai: {
    tre: {
      emoji: '🚀', ten: 'LÊN TÀU THEO TRENDING',
      doc_vi: 'Thấy nó chạy là bro dồn hết, lúc tàu đã rời ga được hai ô 🚀💀.',
      goi_y: 'Bro đếm giúp: những lần nhảy vào giữa chuỗi xanh, mấy lần ô sau còn xanh? 🤡',
    },
    vua: {
      emoji: '🚀', ten: 'LÊN TÀU THEO TRENDING',
      doc_vi: 'Dồn tiền vào thứ đang được nói tới nhiều nhất — lúc vé thường đã đắt.',
      goi_y: 'Thử đếm: vào giữa chuỗi xanh bao nhiêu lần, và bao nhiêu lần ô kế tiếp còn xanh?',
    },
    chung: {
      emoji: '🚀', ten: 'TẬP TRUNG THEO XU HƯỚNG',
      doc_vi: 'Phần lớn tiền đi vào mục đang có đà hoặc đang có tin, sau khi đà đã hình thành.',
      goi_y: 'Trong các quyết định theo xu hướng, bao nhiêu phần dựa trên điều bạn tự kiểm chứng?',
    },
  },

  // ── RẢI ────────────────────────────────────────────────────────────────
  rai_lanh: {
    tre: {
      emoji: '🧮', ten: 'KẾ TOÁN RẢI ĐỀU',
      doc_vi: 'Rải đều, lạnh tanh, không đuổi ai không sợ ai — bro là người mà chợ không lừa được dễ 🫡.',
      goi_y: 'Câu khó nhất còn lại: lúc ĐÁNG dồn, bro có dám dồn không hay vẫn rải cho an toàn? 🗿',
    },
    vua: {
      emoji: '🧮', ten: 'KẾ TOÁN RẢI ĐỀU',
      doc_vi: 'Rải nhiều mục, đều tay, không đuổi giá không gỡ gạc — kiểu người mà chợ không lừa được dễ.',
      goi_y: 'Đều là tốt — nhưng có nhịp nào ĐÁNG dồn to mà bạn đã đi qua nhẹ tênh không?',
    },
    chung: {
      emoji: '🧮', ten: 'PHÂN BỔ KỶ LUẬT',
      doc_vi: 'Phân bổ rộng và ổn định; kết quả hay tin tức gần nhất không làm lệch quyết định.',
      goi_y: 'Khi nào việc phân bổ đều là chiến lược, và khi nào nó chỉ là cách né việc chọn?',
    },
  },
  rai_ket_qua: {
    tre: {
      emoji: '🎈', ten: 'RẢI THEO TÂM TRẠNG',
      doc_vi: 'Bro rải nhiều thứ, nhưng vừa thắng là tay to hẳn, vừa thua là chi bù 🎈💀.',
      goi_y: 'Tiền vừa thắng được bro tiêu như tiền nhặt được hả? Lần gần nhất là mua gì? 🗿',
    },
    vua: {
      emoji: '🎈', ten: 'RẢI THEO TÂM TRẠNG',
      doc_vi: 'Rải nhiều mục — nhưng cỡ tay phồng lên sau khi thắng và sau khi thua theo hai cách khác nhau.',
      goi_y: 'Sau một kết quả tốt, thử giữ đúng cỡ cũ một lần: cảm giác "đang hên" có đáng giá bằng con số không?',
    },
    chung: {
      emoji: '🎈', ten: 'PHÂN BỔ THEO KẾT QUẢ',
      doc_vi: 'Phân bổ rộng, song quy mô mỗi lần chi chịu ảnh hưởng rõ từ thắng thua gần nhất.',
      goi_y: 'Khoản thưởng hoặc khoản lời gần nhất — bạn đã dùng nó khác với thu nhập thường thế nào?',
    },
  },
  rai_ben_ngoai: {
    tre: {
      emoji: '📡', ten: 'ĂNG-TEN BẮT SÓNG',
      doc_vi: 'Bro rải nhiều chỗ, mà chỗ nào cũng vào vì "nghe nói" — tin chưa ai kiểm cũng vào 📡🤡.',
      goi_y: 'Trong mấy tin bro ăn theo, mấy tin sau lộ ra là dựng? Số ở dưới đó, bro tự xem 💀',
    },
    vua: {
      emoji: '📡', ten: 'ĂNG-TEN BẮT SÓNG',
      doc_vi: 'Rải nhiều mục, và mỗi mục vào đúng lúc có tin — kể cả tin chưa ai kiểm.',
      goi_y: 'Thử liếc nhãn độ tin trước khi bấm: tin loại nào hay bịa nhất, bạn đoán được không?',
    },
    chung: {
      emoji: '📡', ten: 'PHÂN BỔ THEO TIN TỨC',
      doc_vi: 'Phân bổ rộng; thời điểm chi tập trung vào lúc có tin hoặc xu hướng, trước khi kiểm chứng.',
      goi_y: 'Tỷ lệ tin bạn hành động theo mà về sau hoá ra không đúng — con số đó nói gì với bạn?',
    },
  },
};

/**
 * Id lạ (API cũ hơn bundle — trạng thái bình thường ở repo này, xem `types.ts`;
 * hoặc id của bộ thẻ trước D106 còn trong ảnh chụp) ⇒ rơi về 🐣 thay vì sập màn.
 */
export function theCua(id: string, giong: Giong): TheTinhCach {
  return (THE_TINH_CACH[id as TinhCachId] ?? THE_TINH_CACH.dang_dinh_hinh)[giong];
}

/** Hai trục dựng nên thẻ — để màn giải thích "VÌ SAO ra thẻ này". */
export const KHAU_VI_NHAN: Record<KhauViId, Record<Giong, { ten: string; giai: string }>> = {
  de_danh: {
    tre: { ten: 'ĐỂ DÀNH', giai: 'phần lớn tiền không động tới 🔒' },
    vua: { ten: 'ĐỂ DÀNH', giai: 'phần lớn tiền không động tới' },
    chung: { ten: 'ĐỂ DÀNH', giai: 'tỷ lệ giữ tiền cao' },
  },
  don: {
    tre: { ten: 'DỒN', giai: 'tiền đi vào một hai thứ thôi 🎯' },
    vua: { ten: 'DỒN', giai: 'tiền đi vào một hai thứ' },
    chung: { ten: 'TẬP TRUNG', giai: 'tiền tập trung vào ít mục' },
  },
  rai: {
    tre: { ten: 'RẢI', giai: 'chia nhỏ ra nhiều chỗ 🧮' },
    vua: { ten: 'RẢI', giai: 'chia nhỏ ra nhiều chỗ' },
    chung: { ten: 'PHÂN BỔ RỘNG', giai: 'chia ra nhiều mục' },
  },
};

export const NET_NHAN: Record<NetId, Record<Giong, { ten: string; giai: string }>> = {
  lanh: {
    tre: { ten: 'LẠNH', giai: 'không ai điều khiển được tay bro 🧊' },
    vua: { ten: 'LẠNH', giai: 'kết quả hay tin tức không lay được' },
    chung: { ten: 'ỔN ĐỊNH', giai: 'quyết định không dao động theo kết quả hay tin tức' },
  },
  ket_qua: {
    tre: { ten: 'BỊ KẾT QUẢ ĐIỀU KHIỂN', giai: 'thắng thua vừa rồi cầm lái tay bro 🎢' },
    vua: { ten: 'BỊ KẾT QUẢ ĐIỀU KHIỂN', giai: 'thắng thua vừa rồi quyết định cỡ tay' },
    chung: { ten: 'PHỤ THUỘC KẾT QUẢ', giai: 'quy mô quyết định đổi theo thắng thua gần nhất' },
  },
  ben_ngoai: {
    tre: { ten: 'BỊ BÊN NGOÀI KÉO', giai: 'trend với tin nóng kéo được bro đi 📡' },
    vua: { ten: 'BỊ BÊN NGOÀI KÉO', giai: 'đà giá và tin chưa kiểm kéo được bạn đi' },
    chung: { ten: 'THEO XU HƯỚNG', giai: 'thời điểm quyết định trùng với tin tức hoặc đà giá' },
  },
};

/** BẬC ĐỌC — kỹ năng, tách khỏi thẻ (hội tụ khi giỏi lên). */
export const BAC_DOC_NHAN: Record<BacDocId, Record<Giong, { emoji: string; ten: string; giai: string }>> = {
  chua: {
    tre: { emoji: '❔', ten: 'CHƯA ĐO', giai: 'chưa có ván nào có vị thế để chấm' },
    vua: { emoji: '❔', ten: 'CHƯA ĐO', giai: 'chưa có ván nào có vị thế để chấm' },
    chung: { emoji: '❔', ten: 'CHƯA ĐO', giai: 'chưa có dữ liệu để chấm' },
  },
  doan_mo: {
    tre: { emoji: '🎲', ten: 'ĐOÁN MÒ', giai: 'ước lượng của bro ngang tung xu 💀' },
    vua: { emoji: '🎲', ten: 'ĐOÁN MÒ', giai: 'ước lượng ngang tung xu' },
    chung: { emoji: '🎲', ten: 'CHƯA SÁT', giai: 'dự tính còn xa thực tế' },
  },
  dang_hoc: {
    tre: { emoji: '📖', ten: 'ĐANG HỌC ĐỌC', giai: 'có nét rồi, chưa ổn định' },
    vua: { emoji: '📖', ten: 'ĐANG HỌC ĐỌC', giai: 'có nét rồi, chưa ổn định' },
    chung: { emoji: '📖', ten: 'ĐANG TIẾN BỘ', giai: 'dự tính bắt đầu bám thực tế' },
  },
  doc_duoc: {
    tre: { emoji: '👓', ten: 'ĐỌC ĐƯỢC', giai: 'ước lượng khớp thực tế kha khá 🫡' },
    vua: { emoji: '👓', ten: 'ĐỌC ĐƯỢC', giai: 'ước lượng khớp thực tế kha khá' },
    chung: { emoji: '👓', ten: 'SÁT THỰC TẾ', giai: 'dự tính khớp với kết quả' },
  },
  mat_than: {
    tre: { emoji: '🧠', ten: 'MẮT THẦN', giai: 'bro đọc chợ như đọc tin nhắn 🗿' },
    vua: { emoji: '🧠', ten: 'MẮT THẦN', giai: 'ước lượng gần như khớp thực tế' },
    chung: { emoji: '🧠', ten: 'RẤT SÁT', giai: 'dự tính gần như khớp với kết quả' },
  },
};

/**
 * SÁU TRỤC RADAR — chuẩn hoá về 0..100, chiều CAO = ĐẸP để hình radar to là hình
 * đáng khoe (giá trị flex, founder 08/08). Thuần + tất định để test tay được;
 * chỉ số null ⇒ 50 (trung tính) kèm cờ `mo` cho UI vẽ mờ.
 *
 * ⚠ Chuẩn hoá là TRÌNH BÀY, không phải thước mới — mỗi trục ghi rõ nó là biến
 * hình của chỉ số nào, và bảng số thật vẫn hiện ngay dưới radar.
 * D106: #2/#3 đo SO VỚI NỀN (`lech`, −1..1); lệch ≤ 0 là "không bị kéo" = 100.
 */
export interface TrucRadar { ten: string; diem: number; mo: boolean }

export function trucRadar(cs: SauChiSo): TrucRadar[] {
  const kep = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
  return [
    {
      ten: 'CHUẨN', mo: cs.hieu_chinh === null,
      // Brier 0..2, thấp = chuẩn ⇒ đảo chiều.
      diem: cs.hieu_chinh ? kep(((2 - cs.hieu_chinh.brier_tb) / 2) * 100) : 50,
    },
    {
      ten: 'KỶ LUẬT GIÁ', mo: cs.duoi_gia === null,
      diem: cs.duoi_gia ? kep((1 - Math.max(0, cs.duoi_gia.lech)) * 100) : 50,
    },
    {
      ten: 'TỈNH TIN', mo: cs.theo_tin === null,
      diem: cs.theo_tin ? kep((1 - Math.max(0, cs.theo_tin.lech)) * 100) : 50,
    },
    {
      ten: 'TAY LẠNH', mo: cs.chot_non === null,
      // |lệch| 0 = cân; 1 = nghiêng hẳn một bên.
      diem: cs.chot_non ? kep((1 - Math.min(1, Math.abs(cs.chot_non.lech))) * 100) : 50,
    },
    {
      ten: 'ĐIỀM TĨNH', mo: cs.don_von === null,
      // Cách xa ×1 (dù ga sau thắng hay sau thua) đều là kết quả cũ cầm lái.
      diem: cs.don_von
        ? kep((1 - Math.min(1, Math.max(
          Math.abs((cs.don_von.sau_thang_x ?? 1) - 1),
          Math.abs((cs.don_von.sau_thua_x ?? 1) - 1)))) * 100)
        : 50,
    },
    {
      ten: 'SĂN TIN', mo: cs.mua_tin === null,
      diem: cs.mua_tin ? kep(cs.mua_tin.ty_le * 100) : 50,
    },
  ];
}

/** Nhãn dòng token theo `wallet_ledger.reason` — trang Tài chính cá nhân. */
export const NHAN_DONG_TOKEN: Record<string, { emoji: string; ten: string }> = {
  signup_grant: { emoji: '🎁', ten: 'Vốn chào sân' },
  bet_place: { emoji: '📤', ten: 'Vào kèo dự báo' },
  bet_adjust: { emoji: '🔧', ten: 'Chỉnh phân bổ kèo' },
  payout: { emoji: '🏆', ten: 'Thắng kèo về ví' },
  refund: { emoji: '↩', ten: 'Hoàn kèo huỷ' },
  subsidy: { emoji: '🌱', ten: 'Trợ cấp ngày' },
  admin_adjust: { emoji: '🛠', ten: 'Điều chỉnh hệ thống' },
  season_reset: { emoji: '🍂', ten: 'Tái phân phối mùa' },
  gacha: { emoji: '🎲', ten: 'Quay diện mạo' },
};

/**
 * Nhãn + diễn giải NGẮN cho các chỉ số — hiện kèm con số của chính chủ.
 * D106: mỗi chỉ số đọc ra một ĐẶC ĐIỂM CHI TIÊU ngoài đời (tiền lệ D28).
 */
export const NHAN_CHI_SO = {
  hieu_chinh: {
    ten: 'ƯỚC LƯỢNG CÓ SÁT KHÔNG',
    giai: 'Điểm Brier 0–2: rải tiền có khớp kết quả không — như ngân sách dự tính so với thực chi. Càng THẤP càng sát.',
  },
  duoi_gia: {
    ten: 'MUA VÌ THẤY NGƯỜI TA MUA',
    giai: 'Tỷ lệ vào hàng khi chuỗi xanh đã chạy, so với lúc bình thường. Dương = FOMO, mua lúc vé đã đắt.',
  },
  theo_tin: {
    ten: 'QUYẾT ĐỊNH THEO LỜI ĐỒN',
    giai: 'Vào lệnh ở vòng có tin (chưa rõ thật/dựng) nhiều hơn vòng thường bao nhiêu — và ăn tin dựng nhiều hơn nền không.',
  },
  chot_non: {
    ten: 'TIẾC TIỀN ĐÃ BỎ',
    giai: 'Bán sau vòng xanh trừ bán sau vòng đỏ. Dương = hái lãi non, ôm lỗ lâu — giữ thứ không dùng vì đã lỡ mua.',
  },
  don_von: {
    ten: 'CHI BÙ SAU NGÀY TỆ · TIÊU THƯỞNG NGAY',
    giai: 'Cỡ mua sau vòng thua / sau vòng thắng so nền. Trên ×1 là kết quả cũ đang cầm lái.',
  },
  mua_tin: {
    ten: 'TRẢ CÔNG CHO KẾ HOẠCH',
    giai: 'Tỷ lệ vòng chịu mở Bảng điện tử trước khi quyết — và mở rồi thì ước lượng có sát hơn.',
  },
  khau_vi: {
    ten: 'QUỸ DỰ PHÒNG · SỐ RỔ',
    giai: 'Phơi nhiễm trung bình (tiền đang "làm việc"), số mục đang giữ, tỷ lệ vòng đứng ngoài hẳn.',
  },
} as const;
