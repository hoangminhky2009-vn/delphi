/**
 * Icon pixel-art vẽ bằng box-shadow (chữ ký Mẫu E — không dùng bộ icon ngoài).
 * Lưới vuông, kích cỡ tuỳ icon (8x8 hoặc 16x16) — component tự suy từ số hàng.
 */
import type { CSSProperties } from 'react';

const PALETTE: Record<string, string> = {
  // ⚠ SINH TỰ ĐỘNG bởi `npm run pixel:hibit -- --ap-dung` (D182).
  // Nguồn chân lý là BANG_MAU ở config/pixel_luoi.ts — ĐỪNG sửa tay ở đây,
  // sửa bên đó rồi chạy lại lệnh, nếu không hai bảng lại trôi khỏi nhau.
  C: '#cffafe',
  D: '#67e8f9',
  E: '#22d3ee',
  e: '#0e7490',
  V: '#ddd6fe',
  v: '#a78bfa',
  u: '#8b5cf6',
  w: '#4c1d95',
  W: '#ffffff',
  S: '#e2e8f0',
  s: '#94a3b8',
  x: '#475569',
  z: '#1e293b',
  R: '#fca5a5',
  q: '#ef4444',
  Q: '#b91c1c',
  r: '#7f1d1d',
  Y: '#fef08a',
  J: '#fde047',
  y: '#fbbf24',
  O: '#fb923c',
  o: '#c2410c',
  N: '#bbf7d0',
  G: '#4ade80',
  n: '#16a34a',
  g: '#14532d',
  K: '#1e1b3a',
  k: '#0a0618',
  A: '#bfdbfe',
  L: '#60a5fa',
  l: '#2563eb',
  a: '#1e3a8a',
  H: '#fbcfe8',
  P: '#f472b6',
  p: '#db2777',
  h: '#831843',
  T: '#c8a27a',
  b: '#92400e',
  B: '#78350f',
  t: '#451a03',
};

// prettier-ignore
const GRIDS = {
  /** Bảng giá / dự báo — cụm cột giá cao dần */
  chart: [
    '................',
    '................',
    '.....vvv........',
    '.....vvu........',
    '.....vvu........',
    '.eee.vvu........',
    '.eee.vvu.DDD....',
    '.eee.vvu.DDD.EEE',
    '.eee.vvu.DDD.EEE',
    '.eee.vvu.DDD.EEE',
    '.eee.vvu.DDD.EEE',
    '.eee.vvu.DDD.EEE',
    '.eee.vvu.DDD.EEE',
    '.eee.vuu.DDD.EEE',
    '................',
    '................',
  ],
  /** Đấu trường TÀI CHÍNH — ba cây nến xanh/đỏ trên đường cơ sở (D187: song kiếm
   *  không nói gì về thị trường; founder: "đấu trường + candlestick/coin"). */
  arena: [
    '................',
    '................',
    '.......s...s....',
    '.......s..NGG...',
    '...s..RRq.NGG...',
    '...s..qqQ.NGG...',
    '..NGG.qqQ.NGG...',
    '..NGG.qqQ.NGG...',
    '..NGG.qqQ.NGG...',
    '..NGG..s..NGG...',
    '..NGG..s..NGG...',
    '..NGG..s...s....',
    '...s...s...s....',
    '.xxxxxxxxxxxxxx.',
    '................',
    '................',
  ],
  /** Quản lý tài chính cá nhân — KÉT có núm xoay vàng (D187: két trơn không có
   *  đồng nào; núm vàng vừa là chữ ký của két vừa là "tiền", một vật thay hai). */
  vault: [
    '................',
    '..ssssssssssss..',
    '.sSSSSSSSSSSSSs.',
    '.sSzzzzzzzzzzSs.',
    '.sSz..SSSS..zSs.',
    '.sSz.SJJJJS.zSs.',
    '.sSz.SJyyJS.zSs.',
    '.sSz.SJyyJS.zSs.',
    '.sSz.SJJJJS.zSs.',
    '.sSz..SSSS..zSs.',
    '.sSz........zSs.',
    '.sSzzzzzzzzzzSs.',
    '.sSSSSSSSSSSSSs.',
    '..ssssssssssss..',
    '...s........s...',
    '................',
  ],
  /** Phân tích dữ liệu — cột dữ liệu + KÍNH LÚP có biểu đồ trong lòng kính
   *  (D187: founder "bỏ sách → màn hình/chart + magnifying glass/data"). */
  analyze: [
    '................',
    '.........SSSS...',
    '........S....S..',
    '.......S......S.',
    '.......S..D...S.',
    '.......S.DDD..S.',
    '........S....S..',
    '.........SSSS...',
    '............SS..',
    '.DD..........SS.',
    '.DD..DD.......SS',
    '.DD..DD..DD....S',
    '.DD..DD..DD.....',
    'xxxxxxxxxxxx....',
    '................',
    '................',
  ],
  /** Sảnh — toà nhà cột (sàn giao dịch) */
  hall: [
    '................',
    '.......E........',
    '......EEE.......',
    '.....EEEEE......',
    '....EEEEEEE.....',
    '...EEEEEEEEE....',
    '..EEEEEEEEEEE...',
    '..E.........E...',
    '..E.D.D.D.D.E...',
    '..E.D.D.D.D.E...',
    '..E.D.D.D.D.E...',
    '..E.D.D.D.D.E...',
    '..E.D.D.D.D.E...',
    '..EEEEEEEEEEE...',
    '.EEEEEEEEEEEEE..',
    '................',
  ],
  /** Bia bắn — huy hiệu "Ngược đám đông" (spec handoff Mẫu E) */
  target: [
    '..qqqq..',
    '.qSSSSq.',
    'qSWSSWSq',
    'qSSqqSSq',
    'qSSqQSSq',
    'qSWSSWSq',
    '.qSSSSq.',
    '..qqqq..',
  ],
  /** Ngọn lửa — huy hiệu chuỗi (spec handoff Mẫu E) */
  flame: [
    '....y...',
    '...yo...',
    '..yOoq..',
    '..yJOy..',
    '.yJJJoq.',
    '.yJJJJy.',
    '..yJJo..',
    '...yo...',
  ],
  /** Mặt mếu — ca thua (chỉ đạo founder 19/07) */
  sad: [
    '..DDDD..',
    '.DSSSSD.',
    'DSaSSaSD',
    'DDSWWSSD',
    'DSWSSWSD',
    'DSSaaSSD',
    'DSaSSaSD',
    '..DDDD..',
  ],
  /**
   * BÁCH KHOA — cuốn sách bìa tím, nhãn trắng, dải đánh dấu cam thò đáy (D334).
   * Founder 14/09: *"bách khoa thành cái icon cuốn sách ở màn hình hub của alpha draft"*.
   * ⚠ Khác `analyze` (kính lúp + cột — D187 bỏ sách khỏi icon PHÂN TÍCH): ở đây sách
   * đúng là vật được gọi tên, không phải ẩn dụ cho dữ liệu.
   */
  sach: [
    '................',
    '...wuuuuuuuuu...',
    '...wvvvvvvvvvS..',
    '...wvVVVVVVvvS..',
    '...wvVxxxxVvvS..',
    '...wvVVVVVVvvS..',
    '...wvvvvvvvvvS..',
    '...wvvvvvvvvvS..',
    '...wvvvvvvvvvS..',
    '...wvvvvvvvvvS..',
    '...wvvvvvvvvvS..',
    '...wvvvvvvvvvS..',
    '...wuuuuuuuuuS..',
    '....SSSSSSOSSs..',
    '..........O.....',
    '................',
  ],
  /** Kết quả — huy chương */
  medal: [
    '................',
    '.qq..........qq.',
    '.qQ..........qQ.',
    '..qq........qQ..',
    '...qq......qQ...',
    '....qq....qQ....',
    '.....JJJJJJ.....',
    '....JJJyyJJJ....',
    '...JJJySSJJJJ...',
    '...JJySWWSJJy...',
    '...JJJJSSJJJy...',
    '....JJJJJJJy....',
    '.....Jyyyyy.....',
    '................',
    '................',
    '................',
  ],
  /** Token — đồng xu dày */
  wallet: [
    '................',
    '.....JJJJJJ.....',
    '...JJOOOOOOJJ...',
    '..JOOOOOOOOOOJ..',
    '..JOOyJJJJyOOy..',
    '.JOOy.Jyyy.JOOJ.',
    '.JOOy.J..J.JOOy.',
    '.JOOy.JJJy.JOOy.',
    '.JOOy..Jy..JOOy.',
    '.JOOy..Jy..JOOy.',
    '..JOOJJJJJJOOy..',
    '..JOOOOOOOOOOy..',
    '...yOOOOOOOOo...',
    '....yooooooo....',
    '................',
    '................',
  ],
  /** Hồ sơ — chân dung */
  user: [
    '................',
    '......vvvv......',
    '.....vuuuuv.....',
    '....vuSSSSvv....',
    '....vuSWWSvu....',
    '.....SSWWSS.....',
    '.....S.SS.S.....',
    '......SWWS......',
    '.......SS.......',
    '....vvvvvvvv....',
    '...vuuuuuuuuv...',
    '..vuuvvvvvvuuv..',
    '..vuvvvvvvvvuw..',
    '..vuvvvvvvvvuw..',
    '..vwuuuuuuuuww..',
    '................',
  ],
  /** Cửa hàng — túi mua sắm (tab Shop, thay tab Kết quả cũ) */
  shop: [
    '................',
    '.....vv..vv.....',
    '....vu....vv....',
    '....vu....vu....',
    '...vvvvvvvvvv...',
    '..vuuuuuuuuuuv..',
    '..vuvvuuuuvvuw..',
    '..vuvvuuuuvvuw..',
    '..vuuuuuuuuuuw..',
    '..vuuuuvvuuuuw..',
    '..vuuuvvvvuuuw..',
    '..vuuuuvvuuuuw..',
    '..vuuuuuuuuuuw..',
    '...vwwwwwwwww...',
    '................',
    '................',
  ],
  /** Nến thị trường */
  candle: [
    '................',
    '....G...........',
    '....G......q....',
    '...GGG.....q....',
    '...GGG....qqq...',
    '...GGG....qqq...',
    '...GGG.G..qqq...',
    '...GGG.G..qqq...',
    '....G..G...q....',
    '....G.GGG..q....',
    '......GGG.......',
    '......GGG.......',
    '.......G........',
    '.......G........',
    '................',
    '................',
  ],

  /*
   * ── ĐỢT 26/07/2026 — thay emoji màu (luật 4 ở styles/pixel.module.css) ─────
   *
   * Sáu lưới cho 66 chỗ hardcode emoji. Sáu chứ không hai mươi: phần lớn chỗ
   * hoặc dùng lại được lưới sẵn có (target · flame · arena · candle · wallet ·
   * shop · hall · medal), hoặc BỎ HẲN icon vì chữ bên cạnh đã nói đủ. Icon 16px
   * sống bằng silhouette, không bằng chi tiết — thêm một lưới chỉ để dùng một
   * lần là đổi một tệp ô vuông lấy một thứ không ai đọc ra.
   */

  /** Chưa mở khoá — ổ khoá. Dùng chung cho cả "đổi mật khẩu" (khỏi vẽ chìa riêng). */
  lock: [
    '................',
    '......SSSS......',
    '.....SW..xx.....',
    '.....SW..xx.....',
    '.....SW..xx.....',
    '.....SW..xx.....',
    '...WWWWWWWWWW...',
    '...WSSSSSSSSx...',
    '...WSSllllSSx...',
    '...WSSlaaaSSx...',
    '...WSSSlaSSSx...',
    '...WSSSlaSSSx...',
    '...WSSSSSSSSx...',
    '...xxxxxxxxxx...',
    '................',
    '................',
  ],
  /** Tin tức — trang báo có măng-sét. Nhánh TIN GIẢ dùng CÙNG lưới, đổi màu ở CSS. */
  news: [
    '................',
    '................',
    '................',
    '..WWWWWWWWWWWW..',
    '..Wllllllllllx..',
    '..WSSSSSSSSSSx..',
    '..WxxxxxxSSSSx..',
    '..WSSSSSSSSSSx..',
    '..WxxxxxxxxSSx..',
    '..WSSSSSSSSSSx..',
    '..WxxxxxxxSSSx..',
    '..WSSSSSSSSSSx..',
    '..xxxxxxxxxxxx..',
    '................',
    '................',
    '................',
  ],
  /** Đã gửi thư — phong bì, nắp gập chữ V. Dùng lại được cho mọi luồng email. */
  /**
   * D493 — ống nghe điện thoại: CUỘC GỌI KÝ QUỸ của lõi Đòn Bẩy (founder 04/10: "Hiện tại demo thì icon được chứ vào app phải vẽ lại art pixel";
   * demo dùng ký tự ✆). Nghiêng 45°, hai đầu tròn; nét trắng trên nền nút đỏ/xanh.
   */
  dien_thoai: [
    '................',
    '..WWW...........',
    '.WSSSW..........',
    '.WSSSSW.........',
    '.WSSSSx.........',
    '..WSSx..........',
    '..WSSx..........',
    '...WSSx.........',
    '....WSSx........',
    '.....WSSx..WWW..',
    '......WSSxWSSSW.',
    '.......WSSSSSSSW',
    '........xSSSSSSx',
    '.........xxSSSx.',
    '...........xxx..',
    '................',
  ],
  mail: [
    '................',
    '................',
    '................',
    '................',
    '..SSSSSSSSSSSS..',
    '..SDEEEEEEEEDD..',
    '..SEDeeeeeeDeE..',
    '..SEeDeeeeDeeE..',
    '..SEeeDDDDeeeE..',
    '..SEeeeeeeeeeE..',
    '..SEeeeeeeeeeE..',
    '..llllllllllll..',
    '................',
    '................',
    '................',
    '................',
  ],
  /** Phòng thủ / được che chắn — khiên có chevron. */
  shield: [
    '................',
    '...WWWWWWWWWW...',
    '...WSSSSSSSSx...',
    '...WSSSSSSSSx...',
    '...WDDSSSSDDx...',
    '...WSDDSSDeSx...',
    '...WSSDDDeSSx...',
    '...WSSSSSSSSx...',
    '....WSSSSSSx....',
    '....WSSSSSSx....',
    '.....WSSSSx.....',
    '.....WSSSSx.....',
    '......WSSx......',
    '.......Sx.......',
    '................',
    '................',
  ],
  /** Cú sốc / đòn bẩy — tia sét. 8 hàng: đứng được cạnh chữ 16px mà không lấn dòng. */
  bolt: [
    '.....JO.',
    '....JO..',
    '...JO...',
    '..JJJJO.',
    '....JO..',
    '...JO...',
    '..JO....',
    '.JO.....',
  ],
  /*
   * ─── HAI MŨI TÊN CHIỀU (13/09) ───────────────────────────────────────────
   * Founder: *"hiệu ứng tương quan của 6 lá m làm chán quá, thôi thêm vào icon
   * tăng/giảm biểu thị đi"* — tức ĐẢO lại chỉ thị 12/09 đã bỏ tam giác dưới lá.
   * Lần này không dựng lại tam giác CSS mà cho nó vào đúng hệ icon pixel: cùng
   * lưới, cùng cách đổ bóng (thân + một sắc tối ở mép phải) như `bolt`/`coin`.
   *
   * Lưới 8 hàng vì chỗ đặt là góc lá rộng ~50px trên dải sáu mã — lưới 16 hàng
   * ở cỡ nhỏ nhất đã cao bằng nửa cái lá.
   * ⚠ MÀU NẰM TRONG LƯỚI, không đặt bằng CSS: xanh lên / đỏ xuống là VAI màu đã
   * chốt 13/09 (xanh-đỏ chỉ dành cho tăng/giảm và lời/lỗ), nên hai icon này
   * không được phép dùng lại cho việc khác.
   */
  mui_len: [
    '........',
    '...Gn...',
    '..GGGn..',
    '.GGGGGn.',
    'GGGGGGGn',
    '...GGn..',
    '...GGn..',
    '...GGn..',
  ],
  mui_xuong: [
    '...qQ...',
    '...qQ...',
    '...qQ...',
    'qqqqqqqQ',
    '.qqqqqQ.',
    '..qqqQ..',
    '...qQ...',
    '........',
  ],
  /**
   * Đồng xu 8 hàng — BẢN NHỎ của `wallet`, thêm vì lý do CỠ chứ không vì nghĩa.
   * `wallet` là lưới 16 hàng nên cỡ nhỏ nhất render được là 16px; nhét nó vào
   * dòng chữ 13–15px (dải đối thủ, nhật ký nước đi) thì icon cao hơn cả cap-height.
   * Trong khối chữ lớn và trên nút thì vẫn dùng `wallet` — đừng thay bừa.
   */
  coin: [
    '..JJJJ..',
    '.JWyOOJ.',
    'JWyOOOOJ',
    'JyOJJOOy',
    'JOOJJOOy',
    'JOOOOOOy',
    '.JOOOOy.',
    '..Jyyy..',
  ],

  /*
   * ─── BẬC ĐẤU TRƯỜNG — 7 sinh vật biển (config/rank.ts BAC_THANG) ───────────
   *
   * Trục biểu tượng là KHỐI LƯỢNG NƯỚC dịch chuyển được, đơn hướng: Tôm → Cua →
   * Cá Mòi → Cá Ngừ → Cá Heo → Cá Mập → Cá Voi. Đọc ra bậc bằng SILHOUETTE, không
   * cần đọc chữ — đó là điều kiện để badge dùng được ở 16px.
   *
   * ⚠ VẼ LẠI 02/08 (founder: "trông không giống con cá và không có giá trị
   * khoe") — mỗi bậc nay có HAI lưới: bản 16×16 (`rank_*`, thang bậc + chỗ
   * hẹp) và bản 32×32 (`rank_*_lon`, khối BẬC ĐẤU TRƯỜNG size 64 ⇒ 2px/ô —
   * đủ nét để khoe). `icon_lon` trong config/rank.ts trỏ bản _lon.
   *
   * ⚠ BỐN LUẬT KHI SỬA BỘ NÀY:
   *  1. `size` PHẢI là bội số của SỐ HÀNG lưới (16-grid: 16·32·48·64; 32-grid:
   *     32·64·96). `PixelIcon` suy px = round(size/cells) rồi IM LẶNG làm tròn.
   *  2. Bám bảng màu sinh vật thật: Tôm cam-đỏ cong mình + râu · Cua cam-đỏ
   *     càng giơ · Cá Mòi ĐÀN bạc · Cá Ngừ lưng lam A + vây vàng · Cá Heo xám
   *     M nhảy vòng cung · Cá Mập xám s + MẮT ĐỎ + răng · Cá Voi navy N đồ sộ.
   *  3. SILHOUETTE đọc được ở 16px — nhận hình trước, màu sau.
   *  4. LUẬT NHIỆT MÀU CHO APEX: bậc 6-7 có ánh VÀNG/TIA NƯỚC riêng để không
   *     lẫn với Cá Heo dù cùng họ "khối xám hình cá".
   *
   * ⚠ KHÔNG dùng `server/holdem_art_pixel.ts` cho mấy lá này: `lint:pixel-art`
   *   kiểm ĐÚNG 60 hàng × 80 cột nên badge vuông sẽ vỡ build. Icon nhỏ ở đây,
   *   art thẻ ở đó, không đẻ hệ thứ ba.
   */

  /** Bậc 1 — TẬP SỰ · Tôm: mình cong, râu dài, đuôi quạt — dòng đẩy đâu đi đó. */
  rank_tom: [
    '................',
    '............x.x.',
    '...........x.x..',
    '......qqq..xx...',
    '....qqyyyqqyy...',
    '...qyyOoOyqya...',
    '..qQyqyqyoqyyy..',
    '..qyoqyqyOyoo...',
    '..qqyyoyOooq....',
    '...Jqqqyoqq.....',
    '..JJJ..qq.......',
    '...Jy...........',
    '................',
    '................',
    '................',
    '................',
  ],
  /** Bậc 2 — CHUYÊN VIÊN · Cua: bò ngang, sát đáy, kẹp chắc từng chút. */
  rank_cua: [
    '................',
    '..qqq......qqq..',
    '.qQ..q....q..qq.',
    '.qQ.W......W.qQ.',
    '..q.a......a.q..',
    '....qqqqqqqq....',
    '...qQyyyyyyqq...',
    '..qQyOOOOOOyqq..',
    '..qyOOOOOOOOyq..',
    '..qqyoOOOOooqQ..',
    '...qyqyoooqyq...',
    '..q.q.q..q.q.q..',
    '................',
    '................',
    '................',
    '................',
  ],
  /** Bậc 3 — NHÀ GIAO DỊCH · Cá Mòi: sống trong đàn, an toàn nhờ số đông. */
  rank_ca_moi: [
    '................',
    '...S.SSSS.......',
    '..SsSSSSsa......',
    '...S.Ssss.......',
    '................',
    '.......S.SSSS...',
    '......SsSSSSsa..',
    '.......S.Ssss...',
    '................',
    '..S.SSSS........',
    '.SsSSSSsa.......',
    '..S.Ssss........',
    '................',
    '................',
    '................',
    '................',
  ],
  /** Bậc 4 — QUẢN LÝ DANH MỤC · Cá Ngừ: đi đường dài, giữ tốc độ qua nhiều tầng nước. */
  rank_ca_ngu: [
    '................',
    '......J..J......',
    '.J...LLLLLL.....',
    '.JL.LllllllLL...',
    '.JLLlllllllllL..',
    '.JLlaaaaaaaaaa..',
    '.JLaSSSSSSSSSS..',
    '.JLSSSSSSSSSS...',
    '.JL.SSSSSSSs....',
    '.J...Ssssss.....',
    '......J..J......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  /** Bậc 5 — GIÁM ĐỐC ĐẦU TƯ · Cá Heo: đọc dòng trước khi dòng tới. Trần thang điểm. */
  rank_ca_heo: [
    '................',
    '......ss........',
    '.....sssss......',
    '....ssssssss....',
    '..s.sssssssss...',
    '.ss.ssasssssss..',
    '.ssssssssssSSss.',
    '..ssSSSSSSSSSWW.',
    '....SSSSSSSW....',
    '......SSSW......',
    '.....D..........',
    '....D.D.........',
    '................',
    '................',
    '................',
    '................',
  ],
  /** Bậc 6 — CHỦ QUỸ · Cá Mập (apex): mép VÀNG + mắt ĐỎ, không lẫn với Cá Heo. */
  rank_ca_map: [
    '................',
    '.......xJ.......',
    '......xxJ.......',
    '.....xxx........',
    '..x.xxxxxx......',
    '.xx.xxxxxxxxx...',
    '.xxxxxxqxxxxxxx.',
    '.xSWSWSWSWSWSxx.',
    '..SSWSWSWSWSSx..',
    '..x.SSSSSSSS....',
    '.x....xx..x.....',
    '......x....x....',
    '................',
    '................',
    '................',
    '................',
  ],
  /** Bậc 7 — NGƯỜI TẠO SÓNG · Cá Voi (apex): khối lượng của bạn làm dòng lệch. */
  rank_ca_voi: [
    '............aa..',
    '...........aLa..',
    '....D.......aLLa',
    '...JaaaJ...aLLa.',
    '..aLLLLLaa.aLa..',
    '.aLLLLLLLLaLa...',
    '.aLWaLLLLLLLa...',
    'aLLaaLLLLLLLa...',
    'aLlllllllllla...',
    'aSSSSSSSSSlla...',
    'aWSSWSSWSSla....',
    '.SSSSSSSSla.....',
    '..aaSSSaa.......',
    '................',
    '................',
    '................',
  ],
  /**
   * CÁ VOI ĐỘI VƯƠNG MIỆN — TOP SERVER (founder 30/08: *"rank cao nhất ý tôi là
   * top server ấy, còn rank cao bình thường nhưng chưa top chỉ cá voi thôi — như
   * cao thủ và thách đấu trong LOL"*).
   *
   * ⚠ Vương miện THAY vòi phun nước, không chồng lên: vòi ở rows 0–1 của bản
   * thường, mà hai thứ cùng mọc trên đầu thì ở 16 ô chúng dính thành một cục.
   * ⚠⚠ CHƯA NỐI DÂY. Khi nối thì **ĐỪNG gán lưới này làm icon bậc** — D298 chốt:
   *   **miện là MỘT TRỤC RIÊNG, suy từ `hang`, KHÔNG phải icon của bậc.** Có hàng rào
   *   canh đúng cú đó (`web/tests/rank.test.tsx` — "vương miện là MỘT TRỤC KHÁC").
   *   Lý do gọn: dính miện vào art bậc thì mỗi lần đổi ngưỡng lại phải VẼ LẠI lưới cho
   *   bậc mới, mà vẽ lưới là việc chậm nhất repo. Tách ra thì đổi luật = đổi một số.
   *   (Bối cảnh: luật truyền miệng *"top 1–50 đội miện"* — ghi là founder 31/08 — không
   *   có một dòng nào trong `docs/nhat-ky/`, và nó VA với `apex_top`: Cá Mập 50 · Cá Voi
   *   10, nối thẳng là nuốt mất bậc CÁ MẬP. Xem D297 → D298.)
   * ⚠ Dù sao cũng chưa gấp: apex đang KHOÁ mùa beta (`APEX_BAT = false`, config/rank.ts)
   * nên bậc Cá Voi hiện chưa ai với tới. Art vẽ trước là cố ý: nó rẻ bây giờ và sẵn khi mở.
   */
  rank_ca_voi_vuong: [
    '.J.J.J......aa..',
    '.JJJJJ.....aLa..',
    '.JyyyJ......aLLa',
    '...JaaaJ...aLLa.',
    '..aLLLLLaa.aLa..',
    '.aLLLLLLLLaLa...',
    '.aLWaLLLLLLLa...',
    'aLLaaLLLLLLLa...',
    'aLlllllllllla...',
    'aSSSSSSSSSlla...',
    'aWSSWSSWSSla....',
    '.SSSSSSSSla.....',
    '..aaSSSaa.......',
    '................',
    '................',
    '................',
  ],

  /*
   * ─── BẢN LỚN 32×32 (`icon_lon` — khối BẬC ĐẤU TRƯỜNG, size 64 ⇒ 2px/ô) ────
   * Cùng sinh vật, thêm chi tiết: vân mai cua, đàn 4 con, vây lưng/kỳ vàng,
   * hàm răng cá mập, rãnh bụng cá voi. Đây là bản "để khoe" founder đòi 02/08.
   */
  rank_tom_lon: [
    '................................',
    '.......................s...s...',
    '......................s...s....',
    '.....................s...s.....',
    '....................sz..s......',
    '..........qqqqqq....sz.sz......',
    '........qqQyyyyqqq...ssz.......',
    '.......qQyyOOOOyyqq.sz.........',
    '......qQyOOOOOOOOyqqqq.........',
    '.....qQyOJOOOOOOOOyyqQy........',
    '....qQyOJJOoOOOOoOOOyyOy.......',
    '....qyOJJOoqyOOoqyOOOOoOy......',
    '...qQyOJOOoqqyOoqqyOOoayo......',
    '...qyOOOOOoqQyOoqQyOOOyOo......',
    '...qyOOOOOoqQyOoqQyOOOOOo......',
    '...qqyOOOOoqQyOoqQyOOOOo.......',
    '....qqyOOOOyyOOOyyOOOoo........',
    '....JqqyoOOOOOOOOoooo..........',
    '...JJJqqqyoooooooqqq...........',
    '..JJJy..qqqqqqqqq..............',
    '.JJJJy.....qqQ.................',
    '..JJy......qQ..................',
    '...Jy......q...................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  rank_cua_lon: [
    '................................',
    '....qqq..................qqq....',
    '...qQQqq................qqQQq...',
    '..qQ..qQ................qQ..qq..',
    '..qQ...q................q...qQ..',
    '..qQ...q.....W....W.....q...qQ..',
    '...qq........W....W........qQ...',
    '....q........a....a........q....',
    '....qq.......a....a.......qQ....',
    '.....qqq..qqqqqqqqqq..qqq.......',
    '......qqqqQyyyyyyyyqqqqQ........',
    '.......qQyyOOOOOOOOyyqQ.........',
    '......qQyOOOOOOOOOOOOyqq........',
    '.....qQyOOOOOOOOOOOOOOyqq.......',
    '.....qyOOOOOOOOOOOOOOOOyq.......',
    '.....qyOOOOOOOOOOOOOOOOoq.......',
    '.....qqyOOOOOOOOOOOOOOoq........',
    '......qqyOOOOOOOOOOOOoqQ........',
    '.......qqyOoOOoOOoOOoqQ.........',
    '........qyoqyoqyoqyoq...........',
    '.......qy..qy..yq..yq...........',
    '......qQ..qQ....qq..qq..........',
    '.....qQ..qQ......qq..qq.........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  rank_ca_moi_lon: [
    '................................',
    '......SS..SSSSSS................',
    '.....S.SSSSSSSSSSl..............',
    '....Sx.SSSSSSSSSsSS.............',
    '.....S.SxsSSSSSsl...............',
    '......Sx..Sxssss................',
    '................................',
    '..............SS..SSSSSS........',
    '.............S.SSSSSSSSSSl......',
    '............Sx.SSSSSSSSSsSS.....',
    '.............S.SxsSSSSSsl.......',
    '..............Sx..Sxssss........',
    '................................',
    '....SS..SSSSSS..................',
    '...S.SSSSSSSSSSl................',
    '..Sx.SSSSSSSSSsSS...............',
    '...S.SxsSSSSSsl.................',
    '....Sx..Sxssss..................',
    '................................',
    '..............SS..SSSSSS........',
    '.............S.SSSSSSSSSSl......',
    '............Sx.SSSSSSSSSsSS.....',
    '.............S.SxsSSSSSsl.......',
    '..............Sx..Sxssss........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  rank_ca_ngu_lon: [
    '................................',
    '................................',
    '...........J...J...J............',
    '..J.......LLLLLLLLLLL...........',
    '..JJ....LLlllllllllllLL.........',
    '..JyL..LlllllllllllllllLL.......',
    '..JyLLLllllllllllllllllllL......',
    '..JyLlllllllllllllllllllllL.....',
    '..JLllaaaaaaaaaaaaaaalllllll....',
    '..JLlasssssssssssssssLalllllL...',
    '..JLassSSSSSSSSSSSSSsssLallaW...',
    '..JLssSSSSSSSSSSSSSSSSsssLaa....',
    '..JLsSSSSSSSSSSSSSSSSSSSsWW.....',
    '..JJLSSSSSSSSSSSSSSSSSSW........',
    '..J.LLSSSSSSSSSSSSSSSW..........',
    '..J...LSSSSSSSSSSSW.............',
    '........J...J...J...............',
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
  ],
  rank_ca_heo_lon: [
    '................................',
    '............sss.................',
    '...........ssssss...............',
    '..........sssssssss.............',
    '.........ssssssssssss...........',
    '......s..ssssssssssssss.........',
    '.....ss.sssasssssssssssss.......',
    '....sss.ssssssssssssssssss......',
    '....sssssssssssssssssssssss.....',
    '...ssssssssssssssssssssSSss.....',
    '...sssssssssssssssssSSSSSWW.....',
    '....sssSSSSSSSSSSSSSSSSSWWW.....',
    '.....sSSSSSSSSSSSSSSSSWW........',
    '......SSSSSSSSSSSSSWW...........',
    '.......SSSSSSSSSWW..............',
    '.........SSSSWW.................',
    '..........SW....................',
    '......D.........................',
    '.....D.D.......D................',
    '......D.......D.D...............',
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
  ],
  rank_ca_map_lon: [
    '................................',
    '..............xx................',
    '.............xxx................',
    '............xxxx................',
    '...........xxxxxx...............',
    '..........xxxxxxx...............',
    '.........xxxxxxxx...............',
    '...x....xxxxxxxxxxxxx...........',
    '...xx..xxxxxxxxxxxxxxxxxx.......',
    '...xxx.xxxxxxxxxxxxxxxxxxxxx....',
    '...xxxxxxxxxxqxxxxxxxxxxxxxxxx..',
    '...xxxxxxxxxxxxxxxxxxxxxxxxxJx..',
    '....xxSSSSSSSSSSSSSSSSSSSxxx....',
    '....SSWWSWWSWWSWWSWWSWWSSx......',
    '...SSSWSSWSSWSSWSSWSSWSSx.......',
    '...x.SSSSSSSSSSSSSSSSSx.........',
    '..xx....xxxx...xxx..............',
    '..x......xx.....xx..............',
    '.........x.......x..............',
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
  ],
  rank_ca_voi_lon: [
    '.......................aa....aa.',
    '.......................aLa..aLa.',
    '........D...............aLaaLLa.',
    '.......D.D..............aLLLLa..',
    '........D...............aLLLa...',
    '.....JaaaaaaaJ.........aaLLa....',
    '...aaLLLLLLLLLaa......aLLLa.....',
    '..aLLLLLLLLLLLLLaa...aLLLa......',
    '.aLLLLLLLLLLLLLLLLa.aLLLa.......',
    '.aLLWaLLLLLLLLLLLLLaLLLa........',
    'aLLLaaLLLLLLLLLLLLLLLa..........',
    'aLLLLLLLLLLLLLLLLLLLLa..........',
    'aLllllllllllllllllllla..........',
    'allllllllllllllllllla...........',
    'aSSSSSSSSSSSSSSSSllla...........',
    'aWSSWSSWSSWSSWSSSlla............',
    '.SSSSSSSSSSSSSSSlla.............',
    '.WSSWSSWSSWSSWSlla..............',
    '..SSSSSSSSSSSSla................',
    '...aaSSSSSSSaa..................',
    '.....aaaaaaa....................',
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
  ],
  /** Bản 32×32 của cá voi đội vương miện — xem lý lẽ ở bản 16. */
  rank_ca_voi_vuong_lon: [
    '...J..J..J..J..J.......aa....aa.',
    '...JJ.JJ.JJ.JJ.JJ......aLa..aLa.',
    '...JJJJJJJJJJJJJ........aLaaLLa.',
    '...JyyyyyyyyyyyJ........aLLLLa..',
    '...JJJJJJJJJJJJJ........aLLLa...',
    '.....JaaaaaaaJ.........aaLLa....',
    '...aaLLLLLLLLLaa......aLLLa.....',
    '..aLLLLLLLLLLLLLaa...aLLLa......',
    '.aLLLLLLLLLLLLLLLLa.aLLLa.......',
    '.aLLWaLLLLLLLLLLLLLaLLLa........',
    'aLLLaaLLLLLLLLLLLLLLLa..........',
    'aLLLLLLLLLLLLLLLLLLLLa..........',
    'aLllllllllllllllllllla..........',
    'allllllllllllllllllla...........',
    'aSSSSSSSSSSSSSSSSllla...........',
    'aWSSWSSWSSWSSWSSSlla............',
    '.SSSSSSSSSSSSSSSlla.............',
    '.WSSWSSWSSWSSWSlla..............',
    '..SSSSSSSSSSSSla................',
    '...aaSSSSSSSaa..................',
    '.....aaaaaaa....................',
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
  ],
};

export type PixelIconName = keyof typeof GRIDS;

function buildShadow(grid: readonly string[], px: number): string {
  const parts: string[] = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = PALETTE[row[x] ?? '.'];
      if (color) parts.push(`${x * px}px ${y * px}px ${color}`);
    }
  });
  return parts.join(',');
}

/*
 * Cache theo CHÍNH mảng lưới (WeakMap) chứ không theo tên: `PixelLuoi` vẽ cả lưới không có tên
 * trong `GRIDS` (bộ icon của bách khoa sống trong chunk nạp trễ của nó — D334), nên khoá bằng
 * tên sẽ đè nhau.
 */
const CACHE = new WeakMap<readonly string[], Map<number, string>>();

interface Props {
  name: PixelIconName;
  /** Cạnh icon (px) — nên là bội của số ô lưới để nét sắc. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function PixelIcon({ name, size = 16, className, style }: Props) {
  return <PixelLuoi luoi={GRIDS[name] ?? []} ten={name} size={size} className={className} style={style} />;
}

/**
 * Vẽ MỘT lưới bất kỳ bằng đúng bảng màu và đúng cách đổ bóng của `PixelIcon`.
 *
 * D334 — bộ ~50 icon của BÁCH KHOA không nhét vào `GRIDS`: `GRIDS` nằm trong gói mọi người chơi
 * tải, còn bách khoa là màn nạp trễ. Nhưng MÀU và CÁCH VẼ phải là một nguồn (A11.5) — nên thứ tách
 * ra là dữ liệu lưới, không phải bộ vẽ.
 */
export function PixelLuoi({ luoi, ten = 'luoi', size = 16, className, style }: {
  luoi: readonly string[];
  /** Chỉ để cảnh báo dev đọc được icon nào sai cỡ. */
  ten?: string;
  size?: number;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  const grid = luoi;
  const name = ten;
  const cells = grid.length || 8;
  /*
   * ⚠ px PHẢI LÀ SỐ NGUYÊN — đó là cả lý do icon pixel nhìn sắc. Nhưng hệ quả:
   * `size` không phải bội số của `cells` thì cỡ render KHÁC cỡ khai báo, và
   * component im lặng làm tròn.
   *
   * Đo được 25/07 (lưới 16 hàng): size 20 → render 16 (nhỏ hơn 20% so với khai
   * báo, đúng 4 icon thanh nav); size 26 → render 32; size 30 → render 32.
   * Không ai thấy vì không ai đo — chỉ thấy "icon trông lệch nhau".
   *
   * Nay cảnh báo Ở DEV. Không `throw`: một icon sai cỡ không đáng làm sập màn
   * người chơi, nhưng đáng hiện đỏ trong console lúc dựng.
   */
  const px = Math.max(1, Math.round(size / cells));
  if (import.meta.env.DEV && px * cells !== size) {
    // eslint-disable-next-line no-console
    console.warn(
      `[PixelIcon] "${name}" size=${size} không phải bội số của ${cells} hàng lưới `
      + `→ render THẬT ${px * cells}px. Dùng ${cells}/${cells * 2}/${cells * 3}px.`,
    );
  }
  let theoCo = CACHE.get(grid);
  if (!theoCo) {
    theoCo = new Map<number, string>();
    CACHE.set(grid, theoCo);
  }
  let shadow = theoCo.get(px);
  if (shadow === undefined) {
    shadow = buildShadow(grid, px);
    theoCo.set(px, shadow);
  }
  const side = px * cells;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-block', width: side, height: side, position: 'relative', ...style }}
    >
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: px,
          height: px,
          background: 'transparent',
          boxShadow: shadow,
        }}
      />
    </span>
  );
}
