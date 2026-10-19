/**
 * MARKET HOLD'EM — MONTE CARLO GATE.
 *
 * Chạy: npx tsx scripts/holdem_montecarlo.ts [số_trận]
 *
 * ─── PHƯƠNG PHÁP (ghi lại để mùa sau lặp lại y hệt) ────────────────────────
 * Mỗi trận: 5 ghế bốc từ bể bot, seed tất định theo chỉ số trận. Bot chơi cả
 * nhịp 1 (tái cơ cấu) lẫn nhịp 2 (cam kết). Ghi thứ hạng cuối từng ghế.
 * Chỉ số chính là HẠNG TRUNG BÌNH (1 = tốt nhất, 5 = bét) chứ không phải
 * win-rate thô — hạng trung bình ổn định hơn nhiều ở cỡ mẫu nhỏ.
 *
 * ─── BỐN GATE ──────────────────────────────────────────────────────────────
 * G1 KHÔNG CHẠY TRỐN (D21) — không archetype nào >45% thắng tuyệt đối, và
 *    không ai vừa >30% vừa bỏ xa á quân ≥8 điểm. "Chen chúc" quanh 30% là
 *    LÀNH; "chạy trốn" mới là meta chết.
 * G2 GRADIENT KỸ NĂNG — oracle phải hơn nhóm chơi được ≥0,25 bậc; bấm bừa
 *    phải kém ≥0,25 bậc. Không có gradient = trò thuần may rủi = data hành vi
 *    mất giá trị (phá thẳng A1).
 * G3 NGỒI IM ở nhóm giữa — không được là chiến lược tốt nhất.
 * G4 TIN TỨC ĐẺ RA KỸ NĂNG (D24 mục 17.6) — bot "tin mọi tin" VÀ bot "phớt
 *    mọi tin" phải CÙNG thua bot "hoài nghi hiệu chỉnh". Gate này chặn deploy:
 *    nếu tin-mọi-tin thắng thì tỷ lệ tin giả quá thấp; nếu phớt-mọi-tin thắng
 *    thì tín hiệu quá yếu. Cả hai đều giết biến hành vi đắt nhất (17.4).
 */
import {
  daKetThuc, giaiQuyetVong, maxTaiSanCua, taoTran,
  tyLeCua, xepHang, viKhaoSat, ghiViKhaoSat,
  type Ghe,
  coLuotLoi, maxLoiCua,
} from '../server/holdem/engine.js';
import { bocThamVai, bocThamVaiTheoCoBan, bocThamVaiXacSuat } from '../server/holdem/vai.js';
import {
  BOT_CHOI_DUOC, BOT_NGAN_HANG, BOT_THAM_CHIEU, BOT_TIN_HIEU, botTaiCoCau, timBot,
  type BoiCanh, type Bot,
} from '../server/holdem/bots.js';
import { bayShop } from '../server/holdem/shop.js';
import { oCongKhai } from '../server/holdem/map.js';
import { apMocTraitCaBan, apNhipLenhBotNav } from '../server/holdem/nhip_lenh_bot.js';
import { RANG_BUOC_TRONG, rangBuocCua } from '../server/holdem/trait.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, HOLDEM_VERSION,
  luatCua,
} from '../config/holdem.js';
import { CHIA } from '../config/rank.js';

/**
 * BỘ LUẬT GATE ĐEM ĐI ĐO = ĐÚNG BỘ LUẬT SẮP SHIP, suy từ `HOLDEM_BALANCE_VERSION`.
 *
 * ⚠ TRƯỚC 27/07 CHỖ NÀY GÕ TAY `{ luatVon: true, dacQuyen: true }`, và nó đã LỆCH
 * THẬT: v8 thêm `daDangHoaTranTaiSan` + `kyQuyRong` mà danh sách gõ tay không có,
 * nên bốn gate G1–G4 chấm luật v7 trong khi bản đem cho người chơi là v8. Cổng
 * quyết định deploy mà không đo bộ luật sẽ deploy thì nó xanh cho một trò khác —
 * và đó là kiểu sai tệ nhất, vì vẫn ra số đẹp.
 *
 * Suy từ `luatCua()` thì mỗi lần bump phiên bản, gate tự đo bộ mới. Không còn chỗ
 * để quên.
 */
/**
 * ⚠ THAM SỐ THỨ NĂM — CHỈ ĐỂ BISECT, MẶC ĐỊNH VẪN LÀ BỘ SẮP SHIP.
 *
 * `npx tsx scripts/holdem_montecarlo.ts 12000 5 8 balance-v13-succang`
 *
 * Vì sao thêm: G1–G4 đo lần cuối ở v12/v13 (D43 bước 7 ghi nợ "re-run trên
 * v12"), rồi v14→v21 đi qua mà không ai chấm lại — đúng món nợ D54 tự khai
 * ("nợ đo cộng dồn… nay gánh thêm v18→v21"). Khi gate đỏ ở v21 thì câu hỏi
 * đắt nhất KHÔNG phải "đỏ bao nhiêu" mà là "đỏ TỪ BAO GIỜ" — không trả lời
 * được câu đó thì phải dò mù qua 9 phiên bản.
 *
 * ⚠ MẶC ĐỊNH KHÔNG ĐỔI: vắng tham số ⇒ vẫn là `HOLDEM_BALANCE_VERSION`. Lý lẽ
 * của docstring cũ (gate phải chấm ĐÚNG bộ sắp ship, đã lệch thật một lần
 * 27/07) giữ nguyên hiệu lực — đây là cửa DÒ, không phải cửa cấu hình. Truyền
 * tay một phiên bản cũ rồi coi đó là "gate xanh" là tự lừa mình; script in rõ
 * phiên bản đang đo ở dòng đầu để không ai đọc nhầm.
 */
/*
 * ⚠ THAM SỐ VỊ TRÍ PHẢI BỎ QUA CỜ `--…`, nếu không thì thêm một cờ là đẩy lệch
 * mọi ô phía sau. Đúng lỗi vừa mắc: `--be=choi_duoc` rơi vào ô PHIÊN BẢN LUẬT và
 * bị chốt chặn ngay bên dưới bắt được — may là hôm nay đã có chốt đó.
 */
const VT = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const PHIEN_BAN_DO = VT[3] ?? HOLDEM_BALANCE_VERSION;
/*
 * `--co=ten:0|1,…` — D389: GHI ĐÈ CỜ của khoá đang đo, CHỈ để cô lập từng cần gạt khi trình số
 * founder (khuôn `{...luatCua(v), phanThan: false}` của holdem_phanthan_gate.ts). Cờ lạ ⇒ chết to,
 * và dòng đầu báo cáo in rõ bộ ghi đè — số ra KHÔNG phải số của khoá trần.
 */
const GHI_CO: Record<string, boolean> = Object.fromEntries(
  (process.argv.find((x) => x.startsWith('--co=')) ?? '').slice(5).split(',').filter(Boolean)
    .map((c) => {
      const [k, v] = c.split(':');
      if (!k || !(k in luatCua(PHIEN_BAN_DO)) || (v !== '0' && v !== '1')) {
        console.error(`✖ --co=${c}: cờ lạ hoặc giá trị không phải 0/1`); process.exit(1);
      }
      return [k, v === '1'];
    }));
const LUAT_DANG_SHIP = { ...luatCua(PHIEN_BAN_DO), ...GHI_CO };

/*
 * ⚠⚠ PHIÊN BẢN LẠ PHẢI CHẾT TO Ở ĐÂY, DÙ `luatCua` CỐ Ý IM.
 *
 * `luatCua` trả về một bộ luật TOÀN FALSE khi không khớp bảng, và đó là ĐÚNG cho
 * REPLAY: trận lưu từ trước khi có cờ nào phải dựng lại với mọi cờ tắt. Nhưng với
 * một DỤNG CỤ ĐO thì phiên bản lạ luôn là gõ nhầm — và im lặng nhận nó nghĩa là
 * đo đúng cái trò TRƯỚC D40 (không NAV, không vị thế) rồi in ra một bảng số trông
 * rất hợp lý.
 *
 * Đây là bẫy repo đã dính BỐN LẦN (D55 · D56 · D58 ×2): thứ không dò được thì
 * không đo được, và nó im lặng cho ra số đẹp. Chỗ chữa đúng là ở dụng cụ, không
 * phải ở `luatCua`.
 */
if (!(PHIEN_BAN_DO in BO_LUAT_THEO_PHIEN_BAN)) {
  console.error(
    `✖ Phiên bản luật không có trong bảng: ${JSON.stringify(PHIEN_BAN_DO)}
` +
    `  Nhận nó nghĩa là đo bộ luật TOÀN TẮT — tức đo một trò khác.
` +
    `  Các phiên bản hợp lệ: ${Object.keys(BO_LUAT_THEO_PHIEN_BAN).join(', ')}`,
  );
  process.exit(1);
}

/**
 * ⚠ MẶC ĐỊNH 12.000, KHÔNG PHẢI 4.000 (sửa 20/07 sau khi bị lừa).
 *
 * Ở 4.000 trận, gate G4 cho DƯƠNG TÍNH GIẢ CÓ HỆ THỐNG: chạy 4.000 ra "đạt",
 * chạy lại đúng cấu hình đó ở 12.000–24.000 thì đỏ, và giá trị hội tụ về phía
 * đỏ. Đã báo nhầm lên founder một lần vì chuyện này. G4 so ba con số rất sát
 * nhau (chênh ~0,05 hạng), nên nhiễu lấy mẫu ở N nhỏ nuốt trọn tín hiệu.
 *
 * Hạ N xuống dưới ngưỡng vẫn chạy được, nhưng script sẽ CẢNH BÁO to — không
 * bao giờ để một kết luận gate ở N nhỏ trôi đi lặng lẽ nữa.
 */
const N_TOI_THIEU_TIN_CAY = 12000;
const SO_TRAN = Number(VT[0] ?? N_TOI_THIEU_TIN_CAY);

/**
 * D3 — CỠ BÀN đo được. `npx tsx scripts/holdem_montecarlo.ts 12000 6` → bàn 6 ghế.
 *
 * ⚠ Vì sao phải đo lại ở từng cỡ: trước D3 mọi ngưỡng đám đông đếm ĐẦU NGƯỜI, nên
 * bàn 8 phạt hơn gấp đôi bàn 4 cho cùng hành vi dồn mã — tức cỡ bàn tự nó đổi cân
 * bằng, và một kết luận gate đo ở bàn 5 không nói gì về bàn 4 hay 8. D3 chuẩn hoá
 * sang TỶ LỆ lobby; số dưới đây là cách kiểm việc chuẩn hoá có thật hay không.
 */
const SO_GHE_DO = Math.max(2, Number(VT[1] ?? 5) | 0);

/**
 * CỠ MAP (số ô) — tham số thứ tư, mặc định lấy từ config.
 *
 * D31 sắp mở phòng 8/12/16 lá, nên cỡ map phải đo được RIÊNG khỏi cỡ bàn: hai
 * trục đó độc lập trong thiết kế mà lại tác động lẫn nhau ở kết quả. Cụ thể là
 * giả thuyết cần kiểm ngay: bàn ĐÔNG có ít suất thưởng hơn theo tỷ lệ (3 suất
 * cố định, phương án 1) nên PHƯƠNG SAI cao hơn, và phương sai cao thì nhiễu lấn
 * kỹ năng. Map DÀI hơn = nhiều vòng hơn = nhiều mẫu hơn cho cùng một kỹ năng,
 * nên đáng lẽ phải kéo gradient kỹ năng trở lại.
 *
 * Đo trước rồi hãy tin: bàn 4 có khoảng cách oracle↔bấm-bừa 0,37 còn bàn 8 chỉ
 * 0,07 (12.000 trận mỗi cỡ) — sụp 12 lần sau khi chuẩn hoá theo dải hạng.
 */
const CO_MAP = Math.max(4, Number(VT[2] ?? HOLDEM_DECISIONS.MAP_SIZE) | 0);
/*
 * ⚠⚠ HAI BỂ, HAI CÂU HỎI KHÁC NHAU — đừng nhầm.
 *
 * MẶC ĐỊNH (trộn cả ba): bể của BỐN GATE. Nó CỐ Ý nhét dụng cụ đo vào bàn, vì
 * G2 hỏi "oracle có tách khỏi nhóm chơi được không" và G4 hỏi "đọc tin có lợi
 * thế không" — không có oracle và bấm-bừa ngồi cùng thì hai câu đó vô nghĩa.
 *
 * `--be=choi_duoc`: bể của ĐO SỨC MẠNH BOT để suy bậc rank. Ghế máy trong trận
 * THẬT chỉ bốc từ `BOT_CHOI_DUOC` (`server/holdem_api.ts:499`), nên đo archetype
 * trong một bàn có ngồi-im và bấm-bừa là đo hạng trong MỘT CÁI BÀN KHÔNG BAO GIỜ
 * XẢY RA — và mấy con bao cát ấy thổi hạng archetype lên.
 *
 * ⚠ Thêm CHẾ ĐỘ chứ không đổi mặc định: đổi bể mặc định là giết bốn gate.
 * ⚠ Và KHÔNG chép vòng lặp này sang một script thứ hai — bản sao thứ hai luôn là
 * bản sẽ trôi, và cái trôi luôn là cái không ai nhìn (D61).
 */
const BE_HEP = process.argv.includes('--be=choi_duoc');
/*
 * v43 (D314) — SÁU BOT ĐO NGÂN HÀNG chỉ vào bể khi phiên bản ĐANG ĐO có cờ `tietKiem`.
 *
 * ⚠ Cổng ở đây chứ không ở `BOT_CHOI_DUOC`: trận THẬT bốc ghế máy từ `BOT_CHOI_DUOC`
 * (`holdem_api.ts`), nên nhét `tk_*` vào đó là đổi dàn đối thủ của mọi trận đang chạy —
 * đổi hành vi bot ngoài cổng luật (D80). Và đo chúng ở một phiên bản CHƯA có ngân hàng
 * thì chúng chỉ là sáu bản sao của `phong_thu`, làm loãng mọi phép đếm.
 */
const CO_NGAN_HANG = luatCua(PHIEN_BAN_DO).tietKiem === true;
const BE_BOT: Bot[] = BE_HEP
  ? [...BOT_CHOI_DUOC, ...(CO_NGAN_HANG ? BOT_NGAN_HANG : [])]
  : [...BOT_CHOI_DUOC, ...(CO_NGAN_HANG ? BOT_NGAN_HANG : []),
    ...BOT_TIN_HIEU, ...BOT_THAM_CHIEU];

interface ThongKe {
  tran: number; tongHang: number; nhat: number; chay: number; tongVongChay: number;
  /** v55 (D409) — xu cuối trận và nấc lửa cuối trận (chỉ cộng ở khoá có cổng `lua`). */
  tongXu: number; tongNac: number; soLua: number;
}
const tk = new Map<string, ThongKe>();
function ghi(id: string, hang: number, vongChay: number | null, xu: number | null, nac: number | null) {
  const t = tk.get(id) ?? { tran: 0, tongHang: 0, nhat: 0, chay: 0, tongVongChay: 0, tongXu: 0, tongNac: 0, soLua: 0 };
  t.tran += 1; t.tongHang += hang;
  if (hang === 1) t.nhat += 1;
  if (vongChay !== null) { t.chay += 1; t.tongVongChay += vongChay; }
  if (xu !== null) t.tongXu += xu;
  if (nac !== null) { t.tongNac += nac; t.soLua += 1; }
  tk.set(id, t);
}

/** Một trận toàn bot. */
function chayTran(seed: number, botIds: readonly string[]): void {
  const bots = botIds.map((id) => timBot(id)!);
  /*
   * ⚠⚠ CỠ MAP ĐI QUA `taoTran`, KHÔNG BAO GIỜ SINH MAP LẦN THỨ HAI (sửa 11/08).
   *
   * Chỗ này TỪNG là `st = { ...st, map: sinhMap(seed, CO_MAP) }` — ghi đè map
   * ngay sau taoTran. Chú thích cũ khai đúng lý do ra đời của nó: hồi ấy
   * `taoTran` chưa nhận cỡ map, và người viết không sửa được config vì "đang có
   * workflow khác giữ file đó". Một đường tắt vì kẹt công cụ, không có ngày chết
   * (A8.9). D31 (02/08) thêm tham số `soO` cho `taoTran` — đường tắt hết lý do
   * tồn tại từ hôm đó, nhưng không ai quay lại gỡ.
   *
   * ⚠ VÌ SAO NÓ ĐẮT: `sinhMap(seed, size)` thiếu tham số thứ ba thì MẶC ĐỊNH
   * TẮT HẾT cổng hành vi — không lịch, không quán tính, không sức căng, không
   * chu kỳ, không telegraph, KHÔNG CẢ `mapV28`. Mà `st` thì vẫn mang cờ của bộ
   * luật đang ship. Tức bàn đo chạy một trạng thái NÓI RẰNG có v28 trên một
   * TẤM MAP KHÔNG CÓ v28: bot hiệu chỉnh theo tỷ lệ tin giả v28 trong khi map
   * phát tin theo bảng cũ. Không có gì đỏ, và nó ra một bảng số trông rất hợp lý.
   * Hệ quả: MỌI số G1–G4 từng đo ở map 12/16 đều đo một trò không tồn tại từ D43.
   * Chỉ ô map 8 (= MAP_SIZE mặc định) là thoát, vì ở đó điều kiện không khớp nên
   * dòng ghi đè không chạy — đúng ô mà mọi người quen nhìn.
   *
   * Bài học chung: KHÔNG DỰNG NGUỒN THỨ HAI cho một thứ đã có nguồn (D61). Bản
   * sao thứ hai luôn là bản sẽ trôi, và cú trôi ở đây trôi lặng.
   *
   * ⚠⚠ VÀ NÓ QUAY LẠI MỘT LẦN NỮA — gỡ THẬT ngày 15/08. Commit của D83
   * (`734cc81`) viết trọn đoạn chú thích ở trên nhưng **để nguyên dòng code**:
   * `taoTran(...)` vẫn gọi ba tham số (không có `soO`) và dòng
   * `if (CO_MAP !== MAP_SIZE) st = { ...st, map: sinhMap(seed, CO_MAP) }` vẫn
   * đứng ngay dưới. Tức từ 11/08 tới 15/08, file này KHAI đã sửa trong khi
   * chưa sửa — và mọi số G1–G4 đo ở map 12/16 trong quãng đó (gồm cả bảng
   * "G1 xanh khắp nơi" của chính D83) vẫn đo một tấm map TẮT HẾT cổng hành vi.
   * Bài học nằm trên bài học: **một chú thích tuyên bố đã sửa là thứ nguy hiểm
   * hơn không có chú thích nào** — nó làm người sau thôi kiểm.
   */
  /*
   * ⚠ BỘ LUẬT LẤY TỪ `LUAT_DANG_SHIP` (đầu file), KHÔNG GÕ TAY.
   *
   * Mọi cổng luật mặc định TẮT ở engine để trận cũ replay ra đúng kết quả cũ (xem
   * `TrangThaiTran.luat_von`). Gate phải đo bộ luật HIỆN HÀNH — tức đúng bộ mà
   * `HOLDEM_BALANCE_VERSION` đang trỏ tới — nếu không thì gate xanh cho một trò
   * khác với trò người chơi sắp chơi, và đó là kiểu sai tệ nhất vì nó vẫn ra số đẹp.
   * Chỗ này TỪNG gõ tay và ĐÃ lệch thật (27/07): xem docstring `LUAT_DANG_SHIP`.
   *
   * Bot chưa biết ĐẢO hay KHOÁ (`bots.ts` không có hai quyết định đó), nên số
   * dưới đây đo LỚP HÀNG CHỜ KHỚP LỆNH — phần áp lên mọi dòng tiền mới, kể cả
   * lệnh mua thẳng của bot. Phần "người chơi chủ động đảo/khoá" chỉ đo được sau
   * khi đàn bot có hai cần gạt đó.
   *
   * ⚠ `dacQuyen: true` (D33/D34) đo được BỐN trong năm đặc quyền: Chặn Lỗ (sàn +
   * phí bảo hiểm), Khớp Nhanh (ba khoản trượt giá), Đa Dạng Hoá (ô danh mục lên
   * 3 thẻ chiến thuật) và gate All-in giữa trận. KHÔNG đo được: Phòng Hộ (bot
   * chưa biết đặt short) và Lướt Sóng (bot không mua Bảng điện tử) — hai lá đó
   * chỉ đo được sau khi đàn bot có hai cần gạt tương ứng, và cho tới lúc ấy phải
   * coi chúng là CHƯA ĐO, không phải "đo ra trung tính".
   */
  /*
   * v34 — VAI: khi cổng `vaiCoRang` bật, mỗi ghế PHẢI mang vai (bốc thăm tất
   * định như prod), nếu không gate đo một bộ luật có răng trên một bàn không ai
   * cắn — đúng lớp lỗi D83 (đo một trò không tồn tại). Map 8 không vai (đối
   * chứng), cùng luật với `soDoGhe` ở API.
   */
  const vaiBan = LUAT_DANG_SHIP.vaiCoRang && CO_MAP >= 12
    ? (LUAT_DANG_SHIP.vaiTheoCoBan ? bocThamVaiTheoCoBan(seed, botIds.length)   // v67 — bảng 5 mốc cỡ bàn (ghép bàn xếp hạng)
      : LUAT_DANG_SHIP.toChucV57 ? bocThamVaiXacSuat(seed, botIds.length) : bocThamVai(seed, botIds.length, ['ca_nhan', 'doi_lai', 'ca_map', 'to_chuc']))   // D515
    : null;
  let st = taoTran(seed, botIds.map((id, i) => ({
    id: `g${i}`, loai: 'bot' as const,
    bac_rank: ['Đồng', 'Bạc', 'Vàng'][(seed + i) % 3]!,
    danh_muc: { tai_san: [], chien_thuat: [] },
    ...(vaiBan ? { vai: vaiBan[i]! } : {}),
  })), LUAT_DANG_SHIP, CO_MAP);

  let guard = 0;
  while (!daKetThuc(st) && guard < 40) {
    guard += 1;
    const o = st.map.o[st.vong - 1]!;
    const ctxCua = (g: Ghe): BoiCanh => ({
      seed, vong: st.vong, o: oCongKhai(o) as never, oThat: o,
      oTruoc: st.map.o[st.vong - 2], ghe: g,
      // v54 (D389) — kệ lõi của CHÍNH khoá đang đo (lõi gọn). Không truyền `gianLa`: bàn đo xưa
      // nay không đọc nhịp giãn (chỉ map 8), đổi ở đây là đổi số của mọi phép đo cũ.
      shop: bayShop(seed, st.vong, g.id, 0, g.danh_muc, { loiGon: st.loi_gon === true }),
      loiGon: st.loi_gon === true,
      // v55 (D409) — TÊ LIỆT: bot không mua lõi ở vòng bị khoá (cùng cửa với người thật ở replay).
      ...((st.trait_bat === true ? rangBuocCua(st, g, st.vong) : RANG_BUOC_TRONG).teLiet || !coLuotLoi(st, g) ? { khoaLoi: true } : {}),
      // D473 — khung minigame: trần lõi theo ghế (cùng cửa với người thật).
      ...(st.dong_ho_minigame === true ? { maxLoi: maxLoiCua(st, g) } : {}),
      soNguoiSong: st.ghe.filter((x) => !x.da_chay).length,
      maxTaiSan: maxTaiSanCua(st, g),
      // v49 (D342) — cùng cổng engine: lá Bán Khống hết hàng T1 thì bot cũng thôi chấm nó.
      ...(st.ban_khong_thuan_quyen === true ? { banKhongThuanQuyen: true } : {}),
      /*
       * ⚠ TỶ LỆ TIN GIẢ HIỆU DỤNG cho NHỊP CHỌN LÁ (rà soát 11/08).
       * Bot hoài-nghi có BA kênh dùng tỷ lệ này; `heSoTin` (chấm điểm mã) đã
       * dùng tỷ lệ v28 từ D71, còn hai kênh kia vẫn 35% PHẲNG trong khi tỷ lệ
       * thật chạy 5–80%. Tức gate G4 đang chấm một con bot hoài nghi SAI MỨC —
       * đúng thứ G4 sinh ra để đo.
       */
      ...tyLeCua(st, st.vong),
    });

    // Nhịp 1
    const ghe = st.ghe.map((g, i) => {
      if (g.da_chay) return g;
      // v55 (D411) — cùng ví với replay (`viKhaoSat`): trận gộp XU thì bot đổi bài bằng xu.
      const r = botTaiCoCau(bots[i]!, { ...ctxCua(g), ghe: { ...g, luot_khao_sat: viKhaoSat(st, g) } });
      return { ...ghiViKhaoSat(st, g, r.luot_khao_sat), danh_muc: r.danh_muc };
    });
    st = { ...st, ghe };

    /*
     * ─── NHỊP GIAO DỊCH — VÁ 02/08, ĐÂY LÀ LỖ HỔNG ĐO LƯỜNG NẶNG NHẤT ────
     *
     * Trước bản này gate KHÔNG BAO GIỜ gọi `lenhBotNav`, tức không ghế nào
     * mua tài sản bằng TIỀN. Đo được: 1500 ghế-trận ⇒ 0 ghế có `vi_the`, 0
     * ghế có NAV khác tiền mặt, nhưng 3601 LÁ tài sản được nhặt — tức gate
     * đang chấm trò TRƯỚC D40 (nhặt lá + pot), thứ D40 đã khai tử.
     *
     * Hậu quả đo được: G1–G4 ra số GIỐNG NHAU TỚI TỪNG CHỮ SỐ ở v13 → v20.
     * Năm phiên bản (chu kỳ, đuôi 5 mặt, bán khống, hệ quả, cộng hưởng) không
     * dịch nổi 0,01 hạng — vì mọi cơ chế đó cắn vào GIÁ TRỊ VỊ THẾ, mà không
     * ghế nào có vị thế. `CAN_TROI_BP` của D54 cũng vô hình vì lý do đó.
     *
     * Chính docstring đầu file này viết "gate phải đo bộ luật HIỆN HÀNH…
     * không thì nó xanh cho một trò khác" — nó lấy đúng cờ luật nhưng sai
     * HÀNH VI BOT: cùng cái bẫy, lùi lên một tầng.
     *
     * Vá bằng cách mượn THẲNG `lenhBotNav` mà `holdem_api.ts` dùng cho bot
     * thật — không tự chế chính sách vốn cho gate. Hai đường cùng một hàm thì
     * không có chỗ cho chúng lệch nhau lần nữa.
     */
    /*
     * D156 — khối lệnh NAV tách thành `apNhipLenhBotNav` (server/holdem/
     * nhip_lenh_bot.ts) dùng CHUNG cho mọi bàn đo: chính khối này từng thiếu
     * hẳn ở holdem_phanthan_gate và cái thiếu đó cho ra "vốn giống hệt từng
     * chữ số giữa bật/tắt" (D155). Oracle vẫn là ghế duy nhất thấy ô thật —
     * predicate truyền vào, không nằm trong hàm.
     */
    st = apNhipLenhBotNav(st, bots, (b) => b.id === 'oracle');
    // Nhịp 2 (vòng cược TUẦN TỰ) + nhịp 3 (chốt phiên).
    // Mỗi lần tới lượt, hỏi đúng con bot của ghế đó — kể cả khi nó đã hành
    // động rồi mà bị tố lại. Đó là chỗ pot odds và bịp phát huy tác dụng.
    /*
     * D30 — LƯỢT ĐẦU MỖI VÒNG LÀ Ý ĐỊNH, các lượt sau là phản ứng.
     *
     * Phải khớp ĐÚNG với `replay()` trong holdem_api.ts, nếu không thì gate đo
     * một trò khác với trò người chơi thật đang chơi — và đó là kiểu sai tệ
     * nhất, vì nó vẫn ra số đẹp.
     */
    const daHoiBot = new Map<string, number>();
    const vongVua = st.vong;
    st = giaiQuyetVong(st, (cuoc) => {
      const g = st.ghe.find((x) => x.id === cuoc.ghe_id)!;
      const bot = bots[st.ghe.indexOf(g)]!;
      const ctx = ctxCua(g);
      const soLan = daHoiBot.get(g.id) ?? 0;
      daHoiBot.set(g.id, soLan + 1);
      if (soLan === 0) {
        const yDinh = bot.chonCamKet(ctx);
        if (yDinh.hanh_dong === 'cat_lo') return { loai: 'bo' as const };
        if (yDinh.hanh_dong === 'tang_cam_ket' && yDinh.them > 0
          && cuoc.duoc.includes('to')) {
          return {
            loai: 'to' as const,
            them: Math.max(cuoc.con_thieu + 1, yDinh.them),
          };
        }
      }
      return bot.chonCuoc(cuoc, ctx);
    }).trangThai;
    // v55 (D409) — mốc trait cho cả bàn, cùng hàm với đường thật.
    st = apMocTraitCaBan(st, seed, vongVua, new Map(), (id) => bots[Number(id.slice(1))]).st;
  }

  const hang = xepHang(st);
  for (let i = 0; i < hang.length; i += 1) {
    const g = st.ghe.find((x) => x.id === hang[i])!;
    ghi(botIds[Number(g.id.slice(1))]!, i + 1, g.vong_chay, g.xu ?? null, g.lua ? g.lua.nac : null);
    // v55 (D409) — thống kê THEO TRAIT đang mang (cặp của vai tính riêng theo id) + ghế không trait làm mốc so.
    const dsTrait = g.trait ?? [];
    for (const tr of dsTrait) {
      const t = theoTrait.get(tr) ?? { tran: 0, tongHang: 0, nhat: 0 };
      t.tran += 1; t.tongHang += i + 1; if (i === 0) t.nhat += 1;
      theoTrait.set(tr, t);
    }
    if (dsTrait.length === 0) { khongTrait.tran += 1; khongTrait.tongHang += i + 1; if (i === 0) khongTrait.nhat += 1; }
    // v34 — thống kê THEO VAI, song song với theo bot. Gate chấm TÍNH CÁCH bot;
    // bảng này chấm xem VAI nào thắng — câu cân bằng vai mà gate không hỏi.
    if (g.vai) {
      const t = theoVai.get(g.vai) ?? { tran: 0, tongHang: 0, nhat: 0, chay: 0 };
      t.tran += 1; t.tongHang += i + 1; if (i === 0) t.nhat += 1; if (g.da_chay) t.chay += 1;
      theoVai.set(g.vai, t);
    }
  }
}
const theoVai = new Map<string, { tran: number; tongHang: number; nhat: number; chay: number }>();
const theoTrait = new Map<string, { tran: number; tongHang: number; nhat: number }>();
const khongTrait = { tran: 0, tongHang: 0, nhat: 0 };

// ── Chạy ───────────────────────────────────────────────────────────────────
console.log(`Market Hold'em Monte Carlo — ${SO_TRAN} trận`);
console.log(`engine=${HOLDEM_VERSION} balance=${PHIEN_BAN_DO} `
  + `map=${CO_MAP} ô · bàn ${SO_GHE_DO} ghế`
  + (Object.keys(GHI_CO).length > 0
    ? `\n⚠ GHI ĐÈ CỜ: ${Object.entries(GHI_CO).map(([k, v]) => `${k}=${v}`).join(' · ')} — số dò, không phải khoá trần.`
    : '')
  // Đo một bộ luật KHÔNG PHẢI bộ sắp ship thì phải nói to — kết quả đó là số
  // dò, không phải kết luận gate.
  + (PHIEN_BAN_DO === HOLDEM_BALANCE_VERSION
    ? '' : `\n⚠ ĐANG DÒ phiên bản CŨ (bộ sắp ship là ${HOLDEM_BALANCE_VERSION}) `
      + '— số dưới KHÔNG phải kết luận gate của bản deploy.'));
if (SO_TRAN < N_TOI_THIEU_TIN_CAY) {
  console.log(
    `\n⚠ CẢNH BÁO: ${SO_TRAN} trận < ${N_TOI_THIEU_TIN_CAY} — KẾT LUẬN GATE KHÔNG DÙNG ĐƯỢC.\n`
    + `  G4 đã từng "đạt" ở 4.000 rồi đỏ lại ở 12.000. Chỉ dùng N nhỏ để thử nhanh,\n`
    + '  TUYỆT ĐỐI không dùng để chốt tham số hay báo cáo.');
}
console.log('');

/**
 * SỐ BẢN SAO CÙNG CHIẾN THUẬT trên một bàn — tham số thứ năm, mặc định 1.
 *
 * ⚠ VÌ SAO PHẢI CÓ: vòng lặp gốc bốc SO_GHE_DO bot KHÁC NHAU mỗi trận, nên nó
 * CHƯA BAO GIỜ đo bàn có nhiều người chung một chiến thuật. Mà đó lại chính là
 * điều kiện mà giả định thiết kế của founder (26/07) dựa vào:
 *
 *   "cứ để mỗi map là 1 meta riêng, nhưng cũng không được để quá bất công và áp
 *    đảo — kiểu là nhiều người chơi chung chiến thuật thì sẽ tự bóp nhau"
 *
 * Nếu crowding CÓ cắn thật thì meta riêng theo map là an toàn: chính sự phổ biến
 * bị trừng phạt, không cần cân bằng thủ công. Nếu KHÔNG cắn thì build mạnh vẫn
 * mạnh khi đông người copy, và "meta riêng" biến thành "một build đúng duy nhất".
 * Đây là giả định về CƠ CHẾ, và trong repo này đã bốn lần một cơ chế hoá ra
 * không hề chạy — nên phải đo, không được tin.
 *
 * CÁCH ĐO: giữ NGUYÊN mọi thứ khác, chỉ nhồi K ghế cùng một bot tiêu điểm (xoay
 * tiêu điểm qua từng trận để mọi bot đều được đo), phần còn lại vẫn khác nhau.
 * So thắng%/BẢN SAO ở K=1 với K>1:
 *   · giảm rõ  → crowding cắn thật, tự điều tiết hoạt động
 *   · đi ngang → crowding không cắn, cần cân bằng bằng tay
 *   · TĂNG     → nguy: đông người cùng build lại LỢI (cộng hưởng ngoài ý muốn)
 */
/*
 * ⚠ argv[6], KHÔNG PHẢI argv[5]. Trước 04/08 hai thứ này dùng CHUNG argv[5]:
 * dòng ~68 đọc nó làm PHIÊN BẢN LUẬT, dòng này đọc nó làm SỐ BẢN SAO. Truyền
 * `BAN_SAO=3` là `luatCua('3')` không khớp bảng ⇒ bộ luật toàn tắt ⇒ nhánh giao
 * dịch NAV bị bỏ qua ⇒ đo đúng trò TRƯỚC D40 mà D55 đã khai tử — im lặng, và
 * vẫn in ra một bảng số trông hợp lý.
 */
const BAN_SAO = Math.max(1, Math.min(SO_GHE_DO, Number(VT[4] ?? 1) | 0));

/*
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ XẾP BÀN — VÁ 04/08. CÔNG THỨC CŨ LÀM CẢ BÀN THÀNH BẢN SAO CỦA MỘT CON.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Cũ: `BE_BOT[(i * SO_GHE_DO + k * 7) % BE_BOT.length]`, kèm chú thích
 * "xoay vòng để mọi bot gặp mọi bot" — đúng thứ nó KHÔNG làm.
 *
 * BƯỚC NHẢY 7 CHIA HẾT CHO CỠ BỂ. Đếm ra:
 *      bể hẹp  (7 bot)  → 1 archetype mỗi bàn  (8 BẢN SAO của cùng một con)
 *      bể trộn (14 bot) → ĐÚNG 2 archetype, và CẶP ĐẤU CỐ ĐỊNH VĨNH VIỄN
 *                         (oracle chỉ từng gặp bat_day, hoài-nghi chỉ gặp
 *                          da_dang, tin-mọi-tin chỉ gặp tat_tay…)
 *      cả hai bể chỉ sinh ĐÚNG 7 kiểu bàn trên toàn bộ số trận.
 *
 * Hệ quả ở bể hẹp là một ĐỒNG NHẤT THỨC SỐ HỌC, không phải một phép đo: bàn
 * toàn bản sao thì con đó ôm trọn hạng 1..N mỗi trận ⇒ hạng TB = (N+1)/2 CHÍNH
 * XÁC, phương sai 0, thắng% = 1/N. Đúng cái bảng phẳng đã thấy.
 *
 * ⚠ NGÀY HỎNG 26/07 (D5, commit 3ad16e4) — thêm ĐÚNG MỘT bot `nguoc_dong` vào
 * `BOT_CHOI_DUOC` (6→7) ⇒ bể trộn 13→14. Trước đó gcd(7,13)=1 và dụng cụ chạy
 * đúng. KHÔNG AI CHẠM FILE NÀY HÔM ĐÓ — nó hỏng vì một file KHÁC đổi độ dài mảng.
 * Đó là lý do phải XÁO chứ không phải đổi sang một bước nhảy nguyên tố khác:
 * bước nhảy nào cũng lại phụ thuộc độ dài bể, và độ dài bể sẽ còn đổi nữa.
 *
 * ⚠ Và bước nhảy nguyên tố cùng nhau VẪN chưa đủ: đếm ra bể 14 / bàn 5 thì mỗi
 * bot chỉ từng gặp 8/13 loại đối thủ, và luôn CÙNG một tập.
 */
function xaoBe(i: number): Bot[] {
  const a = [...BE_BOT];
  // Fisher–Yates tất định theo số thứ tự trận — cùng i cho cùng một bàn, nên
  // chạy lại vẫn tái lập được từng chip.
  let h = (i * 2654435761) >>> 0;
  for (let k = a.length - 1; k > 0; k -= 1) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (k + 1);
    [a[k], a[j]] = [a[j]!, a[k]!];
  }
  return a;
}

if (BAN_SAO > 1) {
  console.log(`⚠ CHẾ ĐỘ ĐÔNG ĐÚC: ${BAN_SAO}/${SO_GHE_DO} ghế cùng một chiến thuật.`);
  console.log('  Thắng% dưới đây là THEO BẢN SAO, so với chạy K=1 để biết crowding có cắn.');
  console.log('');
}

for (let i = 0; i < SO_TRAN; i += 1) {
  const ids: string[] = [];
  if (BAN_SAO > 1) {
    // Bot tiêu điểm xoay theo trận → mọi bot đều được đo ở thế đông đúc.
    const tieuDiem = BE_BOT[i % BE_BOT.length]!.id;
    for (let k = 0; k < BAN_SAO; k += 1) ids.push(tieuDiem);
    const con = xaoBe(i).filter((b) => b.id !== tieuDiem);
    for (let k = BAN_SAO; k < SO_GHE_DO; k += 1) ids.push(con[k - BAN_SAO]!.id);
  } else {
    /*
     * Bàn LỚN HƠN bể bot (≤ 14): trước đây `slice(0, SO_GHE_DO)` âm thầm cắt còn đúng cỡ bể — đo bàn 16 và bàn 20 ra CÙNG một bảng số vì cả hai
     * thật ra là bàn 14 (phát hiện 11/10 khi đo luật chia vai theo cỡ bàn v67). Nay nối thêm lượt xáo kế tiếp (bot lặp lại) tới đủ ghế.
     * Bàn ≤ 14 ghế: một lượt xáo như cũ ⇒ mọi số đo cũ không đổi.
     */
    for (let lan = 0; ids.length < SO_GHE_DO; lan += 1) {
      for (const b of xaoBe(i + lan * 100_003)) { if (ids.length >= SO_GHE_DO) break; ids.push(b.id); }
    }
  }
  chayTran((i * 2654435761) >>> 0, ids);
}

const bang = [...tk.entries()]
  .map(([id, t]) => ({
    id,
    label: timBot(id)!.label,
    nhom: timBot(id)!.nhom,
    tran: t.tran,
    hangTB: t.tongHang / t.tran,
    thang: (t.nhat / t.tran) * 100,
    chay: (t.chay / t.tran) * 100,
    xuTB: t.tongXu / t.tran,
    nacTB: t.soLua > 0 ? t.tongNac / t.soLua : 0,
  }))
  .sort((a, b) => a.hangTB - b.hangTB);

if (theoVai.size > 0) {
  console.log('\nVAI (v34)        TRẬN   HẠNG TB   NHẤT%   CHÁY%');
  for (const [v, t] of [...theoVai.entries()].sort((x, y) => x[1].tongHang / x[1].tran - y[1].tongHang / y[1].tran)) {
    console.log(v.padEnd(14) + String(t.tran).padStart(7) + (t.tongHang / t.tran).toFixed(2).padStart(10)
      + (100 * t.nhat / t.tran).toFixed(1).padStart(8) + '%' + (100 * t.chay / t.tran).toFixed(1).padStart(7) + '%');
  }
  console.log('');
}
console.log('BOT                        NHÓM        TRẬN   HẠNG TB   THẮNG%   CHÁY%');
for (const r of bang) {
  console.log(
    r.label.padEnd(26) + r.nhom.padEnd(12) +
    String(r.tran).padStart(5) + r.hangTB.toFixed(2).padStart(10) +
    r.thang.toFixed(1).padStart(9) + r.chay.toFixed(1).padStart(8));
}

/*
 * ═══ SUY BẬC CHO GHẾ MÁY (founder chốt 04/08, phương án B) ═══════════════════
 *
 * Chỉ chạy ở `--be=choi_duoc`, vì chỉ bể đó mới là thành phần bàn thật.
 *
 * ĐẢO NGƯỢC CHÍNH HÀM CỦA REPO, không đẻ hằng số kinh tế mới:
 * điểm rank tính bằng `p(d) = 1/(1 + 10^(−d/CHIA))` (config/rank.ts), nên
 *     w   = (N − hangTB) / (N − 1)        tỷ lệ thắng khi so từng cặp
 *     bậc = NEO + CHIA · log10( w / (1 − w) )
 *
 * ⭐ `w` CHUẨN HOÁ BỎ N — mấu chốt, vì hạng trung bình KHÔNG so được chéo cỡ bàn
 * (mốc trung tính là (N+1)/2: bàn 5 là 3,00, bàn 8 là 4,50).
 *
 * NEO = 2 giữ nguyên giá trị bot đang có ngầm hôm nay ⇒ không thêm số nào cần
 * founder duyệt (A8.2). Bậc là SỐ THỰC — an toàn vì `chuyenNhuongCap` làm tròn
 * đúng một lần THEO CẶP.
 */
if (BE_HEP) {
  const NEO = 2;
  const NGUONG_DO_TRAI = 0.8;
  const bacTu = (w: number) => {
    const kep = Math.min(0.999, Math.max(0.001, w));
    return NEO + CHIA * Math.log10(kep / (1 - kep));
  };
  const bacBang = bang
    .map((b) => {
      const w = (SO_GHE_DO - b.hangTB) / (SO_GHE_DO - 1);
      return {
        id: b.id, ten: b.label, tran: b.tran,
        hang_tb: Number(b.hangTB.toFixed(3)),
        thang_cap: Number(w.toFixed(4)),
        bac: Number(bacTu(w).toFixed(2)),
      };
    })
    .sort((x, y) => y.bac - x.bac);
  const doTrai = bacBang.length ? bacBang[0]!.bac - bacBang[bacBang.length - 1]!.bac : 0;

  console.log([String.fromCharCode(10), '──────── BẬC GHẾ MÁY ────────'].join(''));
  console.log('BOT                  HẠNG TB   THẮNG CẶP    BẬC');
  for (const r of bacBang) {
    console.log(`${r.ten.padEnd(20)}${r.hang_tb.toFixed(2).padStart(9)}` +
      `${(r.thang_cap * 100).toFixed(1).padStart(11)}%${r.bac.toFixed(2).padStart(8)}`);
  }
  console.log(`ĐỘ TRẢI: ${doTrai.toFixed(2)} (ngưỡng ${NGUONG_DO_TRAI})`);
  if (doTrai < NGUONG_DO_TRAI) {
    console.log('✖ KHÔNG ĐẠT — "thắng bot khôn" gần bằng "thắng bot kém".');
    console.log('  BÁO LẠI FOUNDER. ⚠ KHÔNG nhân hệ số cho nó trông có tác dụng (D22).');
  } else {
    console.log('✓ ĐẠT — bậc đủ trải.');
  }

  if (SO_TRAN >= 12_000) {
    const thuMuc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'do-luong');
    mkdirSync(thuMuc, { recursive: true });
    const duong = path.join(thuMuc, 'bot_manh.json');
    writeFileSync(duong, `${JSON.stringify({
      balance_version: PHIEN_BAN_DO, so_tran: SO_TRAN, co_map: CO_MAP, so_ghe: SO_GHE_DO,
      neo: NEO, chia: CHIA, do_trai: Number(doTrai.toFixed(2)), bang: bacBang,
    }, null, 2)}${String.fromCharCode(10)}`, 'utf8');
    console.log(`✔ Đã ghi docs/do-luong/bot_manh.json`);
  } else {
    console.log('(không ghi golden — cần ≥12.000 trận)');
  }
  process.exit(0);
}

const lay = (id: string) => bang.find((b) => b.id === id)!;
const choiDuoc = bang.filter((b) => b.nhom === 'choi_duoc');
const tbChoiDuoc = choiDuoc.reduce((s, b) => s + b.hangTB, 0) / choiDuoc.length;

console.log('\n──────── GATE ────────');
const fail: string[] = [];

/*
 * G1 — chạy trốn.
 *
 * ─── D307 (08/09/2026): BÀN NGẮN PHẢI CÓ HẠNG TB CHỨNG THỰC ──────────────────
 *
 * Founder chốt sau khi xem bảng đo của lớp VN (`balance-v41-lopvn`): *"Giữ v41"* —
 * tức giữ bộ số trung thành dữ liệu, và nới G1 cho riêng cỡ bàn ngắn.
 *
 * VÌ SAO NỚI ĐÚNG CHỖ NÀY, không phải nâng ngưỡng 30/45 (D21 chốt, giữ nguyên):
 * vế thứ hai của G1 đo bằng **tỷ lệ THẮNG**, mà tỷ lệ thắng bị PHƯƠNG SAI thổi khi
 * ván ngắn — ít vòng thì một chiến lược tất-tay trúng cú lớn là về nhất, còn những
 * lần nó cháy thì cũng chỉ tính là một lần thua. Đo v41 bàn 8, 12.000 trận:
 *
 *   Tất tay   THẮNG 34,9%  ·  HẠNG TB 3,00  ·  CHÁY 12,9%
 *   Khắc chế  THẮNG 24,6%  ·  HẠNG TB 2,62  ·  CHÁY  0,5%
 *
 * Tất tay dẫn tỷ lệ thắng nhưng **hạng TB gần bét nhóm chơi được** (chỉ trên Phòng
 * thủ 3,08 và Đa dạng hoá 3,11) và cháy tài khoản gấp 26 lần mã kế. Đó là hồ sơ
 * PHƯƠNG SAI CAO, không phải meta độc quyền — đúng chữ trong chính docstring G1 ở
 * đầu tệp: *"Chen chúc quanh 30% là LÀNH; chạy trốn mới là meta chết."* Một chiến
 * lược mà nửa số ván xếp dưới trung bình thì không ai bị ép phải chọn nó.
 *
 * Nên ở bàn NGẮN HƠN CỠ CHUẨN, vế tỷ lệ-thắng chỉ thành "chạy trốn" khi **cùng một
 * archetype dẫn đầu CẢ hạng TB** — hai thước cùng chỉ một tên thì mới là trội thật.
 * Vế tuyệt đối (>45%) KHÔNG đổi và vẫn chặn ở mọi cỡ.
 *
 * ⚠ PHẠM VI: chỉ bàn ngắn hơn `MAP_MAC_DINH_SANH`. Lập luận phương sai đúng cho mọi
 * cỡ, và mở rộng ra cả bàn 12/16 sẽ làm gate SẮC hơn chứ không lỏng hơn (runaway
 * thật thì dẫn cả hai thước) — nhưng đó là một quyết định gate khác, phải hỏi
 * founder lần nữa. Founder 08/09 chỉ nới "riêng cỡ đó".
 * ⚠ Bàn 12 và 16 của v41 ĐẠT G1 mà không cần vé này (cách 1,1 và 5,5).
 *
 * ⚠ TIÊM LỖI NGƯỢC đã chạy (12.000 trận, bàn 8): ép `dinhCaHaiThuoc = true` ⇒ G1 ✗ trở lại
 * (vé phụ thuộc đúng phép chứng thực). Ép `banNgan = true` ⇒ bàn 8 vẫn ✓ — mũi này KHÔNG
 * quan sát được vì ở bàn 8 điều kiện vốn đã đúng, tức **cổng phạm vi hiện là phòng xa, chưa
 * gánh gì**; đừng đọc nó như một hàng rào đã được chứng minh.
 */
const top = [...choiDuoc].sort((a, b) => b.thang - a.thang);
const nhat = top[0]!, nhi = top[1]!;
const dauHangTB = [...choiDuoc].sort((a, b) => a.hangTB - b.hangTB)[0]!;
const banNgan = CO_MAP < HOLDEM_DECISIONS.MAP_MAC_DINH_SANH;
const dinhCaHaiThuoc = dauHangTB.label === nhat.label;
const bungTheoThang = nhat.thang > 30 && nhat.thang - nhi.thang >= 8;
const chayTron = nhat.thang > 45
  || (bungTheoThang && (!banNgan || dinhCaHaiThuoc));
console.log(`G1 không chạy trốn : ${chayTron ? '✗' : '✓'} — cao nhất ${nhat.label} ${nhat.thang.toFixed(1)}%, á quân ${nhi.thang.toFixed(1)}% (cách ${(nhat.thang - nhi.thang).toFixed(1)})`);
if (banNgan && bungTheoThang) {
  console.log(`   (bàn ngắn — D307) hạng TB dẫn đầu là ${dauHangTB.label} ${dauHangTB.hangTB.toFixed(2)}`
    + ` vs ${nhat.label} ${nhat.hangTB.toFixed(2)} (cháy ${nhat.chay.toFixed(1)}%)`
    + ` ⇒ ${dinhCaHaiThuoc ? 'CÙNG một tên ⇒ trội THẬT' : 'KHÁC tên ⇒ phương sai, không phải chạy trốn'}`);
}
if (chayTron) fail.push('G1 meta độc quyền — có chiến lược CHẠY TRỐN khỏi phần còn lại');

/*
 * ── DÒNG BỔ TRỢ, KHÔNG PHẢI GATE ─────────────────────────────────────────────
 *
 * Ngưỡng G1 (30% / 45%) là số TUYỆT ĐỐI do founder chốt ở D21, và tôi KHÔNG tự
 * đổi nó. Nhưng D3 mở bàn 4–8, và ngưỡng tuyệt đối đọc khác nhau hẳn theo cỡ bàn:
 *
 *   bàn 4 → mốc ngẫu nhiên đã là 25%, nên 30% chỉ hơn mốc 1,2 lần;
 *   bàn 8 → mốc ngẫu nhiên 12,5%, nên G1 gần như KHÔNG THỂ fail dù có chiến lược
 *           trội gấp đôi phần còn lại.
 *
 * Nên in thêm mức trội TƯƠNG ĐỐI so với mốc 1/N. Đo được ở 12.000 trận/cỡ:
 * bàn 4 = 1,32× · bàn 5 = 1,35× · bàn 6 = 1,35× · bàn 8 = 1,41× — gần như không
 * đổi, tức việc chuẩn hoá theo tỷ lệ lobby của D3 CÓ thật. Nếu con số này bung ra
 * ở một cỡ bàn nào đó thì đó là dấu hiệu sớm, dù G1 tuyệt đối vẫn xanh.
 *
 * ⚠ Đây là THÔNG TIN, không phải điều kiện chặn deploy. Muốn biến nó thành gate
 * thì phải hỏi founder — D21 nói rõ số 30% giữ nguyên.
 */
const mocNgauNhien = 100 / SO_GHE_DO;
const troi = nhat.thang / mocNgauNhien;
console.log(`   (bổ trợ, không phải gate) mức trội so với mốc ngẫu nhiên `
  + `${mocNgauNhien.toFixed(1)}%: ${troi.toFixed(2)}×`);

// G2 — gradient kỹ năng
const oracle = lay('oracle'), bua = lay('bam_bua');
const g2a = tbChoiDuoc - oracle.hangTB >= 0.25;
const g2b = bua.hangTB - tbChoiDuoc >= 0.25;
console.log(`G2 gradient kỹ năng: ${g2a && g2b ? '✓' : '✗'} — oracle ${oracle.hangTB.toFixed(2)} < chơi-được ${tbChoiDuoc.toFixed(2)} < bấm-bừa ${bua.hangTB.toFixed(2)}`);
if (!g2a) fail.push('G2 oracle không hơn rõ nhóm chơi được — kỹ năng đọc thị trường vô dụng');
if (!g2b) fail.push('G2 bấm bừa không kém rõ — trò gần như thuần may rủi');

// G3 — ngồi im
const ngoiIm = lay('ngoi_im');
const g3 = ngoiIm.hangTB > oracle.hangTB;
console.log(`G3 ngồi im không trội: ${g3 ? '✓' : '✗'} — hạng TB ${ngoiIm.hangTB.toFixed(2)}`);
if (!g3) fail.push('G3 NGỒI IM quá mạnh — không hành động là chiến lược tốt nhất');

/*
 * ═══ G7 · G8 (v55, D409) — LỬA/XU KHÔNG CHẢY VỀ GHẾ NGỒI IM · BẢNG THEO TRAIT ══════════════════════════════
 * G7: xu (tiền tệ duy nhất của chợ trait) sinh từ lửa — mà lửa chỉ tích khi CÓ vị thế và giữ phía. Ghế ngồi im
 *     (toàn tiền mặt) không được nhận xu bằng/hơn nhóm chơi được; nếu có thì lửa đang thưởng cho việc không làm gì
 *     (đúng thứ §1.2 cấm). Cũng in xu/nấc từng bot để founder đọc lửa có BÃO HOÀ không (khảo sát 25/09: 93% ghế ôm
 *     LÊN thụ động chạm chuỗi ≥ 4).
 * G8: bảng hạng TB theo trait đang mang, kèm mốc "không trait" — CHỈ IN (như G5b): bot chọn trait theo sở thích nên
 *     đây là so sánh quan sát, không phải thí nghiệm đối chứng; số để founder chốt PLAYTEST-TUNE, không tự kết luận.
 */
if (luatCua(PHIEN_BAN_DO).lua === true) {
  console.log('\nLỬA · XU (v55)              XU TB   NẤC CUỐI TB');
  for (const r of bang) {
    console.log(`${r.label.padEnd(26)}${r.xuTB.toFixed(2).padStart(8)}${r.nacTB.toFixed(2).padStart(14)}`);
  }
  const xuChoiDuoc = choiDuoc.reduce((t, b) => t + b.xuTB, 0) / choiDuoc.length;
  const g7 = ngoiIm.xuTB < xuChoiDuoc;
  console.log(`G7 xu không về ghế ngồi im: ${g7 ? '✓' : '✗'} — ngồi-im ${ngoiIm.xuTB.toFixed(2)} xu vs chơi-được ${xuChoiDuoc.toFixed(2)} xu`);
  if (!g7) fail.push('G7 lửa/xu thưởng cho ghế KHÔNG làm gì — bias null đang tích chuỗi, hoặc xu chảy không qua lửa');
}
if (luatCua(PHIEN_BAN_DO).trait === true && theoTrait.size > 0) {
  console.log('\nTRAIT (v55, chỉ in — G8)     GHẾ   HẠNG TB   NHẤT%');
  const dong = (ten: string, t: { tran: number; tongHang: number; nhat: number }) =>
    console.log(`${ten.padEnd(28)}${String(t.tran).padStart(5)}${(t.tongHang / t.tran).toFixed(2).padStart(10)}${(100 * t.nhat / t.tran).toFixed(1).padStart(8)}%`);
  if (khongTrait.tran > 0) dong('(không trait)', khongTrait);
  for (const [id, t] of [...theoTrait.entries()].sort((a, b) => a[1].tongHang / a[1].tran - b[1].tongHang / b[1].tran)) dong(id, t);
}

// G4 — tin tức đẻ ra kỹ năng (17.6)
const tin = lay('tin_moi_tin'), phot = lay('phot_moi_tin'), hn = lay('hoai_nghi');
const g4a = hn.hangTB < tin.hangTB;
const g4b = hn.hangTB < phot.hangTB;
console.log(`G4 tin tức có kỹ năng: ${g4a && g4b ? '✓' : '✗'} — hoài-nghi ${hn.hangTB.toFixed(2)} vs tin-mọi-tin ${tin.hangTB.toFixed(2)} vs phớt-tin ${phot.hangTB.toFixed(2)}`);
if (!g4a || !g4b) fail.push('G4 đọc tin không đẻ ra lợi thế');

/*
 * ═══ G5 (v43, D314) — NGÂN HÀNG KHÔNG ĐƯỢC LÀ BẾN AN TOÀN ════════════════════
 *
 * Chỉ chạy khi phiên bản đang đo có cờ `tietKiem`; các bản cũ không có ngân hàng nên
 * ba câu hỏi dưới đây vô nghĩa với chúng.
 *
 * Vì sao cần một gate RIÊNG chứ G1 không đủ: G1 hỏi "có archetype nào chạy trốn khỏi
 * phần còn lại không" — nó đo TỶ LỆ THẮNG. Nhưng cái hỏng của một ngân hàng quá hào
 * phóng KHÔNG hiện ra ở tỷ lệ thắng: bot gửi hết hiếm khi về NHẤT (nó không bao giờ
 * ăn to), nó chỉ đều đặn không bao giờ về BÉT. Thứ nó phá là HẠNG TRUNG BÌNH — tức
 * "không cần đọc chợ vẫn sống khoẻ", đúng thứ A1 nói game này tồn tại để dạy ngược lại.
 *
 * (a) KHÔNG BẾN AN TOÀN — `tk_max` (gửi hết, kỳ hạn dài nhất, không bao giờ huỷ) phải
 *     có hạng TB KHÔNG TỐT HƠN trung bình nhóm chơi được, và thắng < 30%.
 * (b) KHÔNG MỐC TRỘI TUYỆT ĐỐI — chỉ kết luận được khi có cả ba cỡ map, nên ở đây chỉ
 *     IN BẢNG; người đọc (hoặc founder) so ba lần chạy. Cố tình không tự kết luận từ
 *     một cỡ: đó là cách đẻ ra một gate nói dối.
 * (c) QUYỀN HUỶ KHÔNG MIỄN PHÍ — `tk_huy` là ORACLE (huỷ đúng lúc tin tốt thật tới),
 *     tức TRẦN TRÊN của giá trị quyền huỷ. Nó chỉ được hơn `tk_4` tối đa 0,30 hạng.
 *     Hơn nhiều = phạt huỷ quá nhẹ, gửi tiết kiệm thành quyền chọn miễn phí.
 *
 * ⭐ Ba ngưỡng dưới là KHỞI ĐIỂM (A8.2) — founder chốt sau khi xem bảng.
 */
if (luatCua(PHIEN_BAN_DO).tietKiem === true) {
  const TK = ['tk_2', 'tk_3', 'tk_4', 'tk_thang', 'tk_max', 'tk_huy'];
  const coDo = TK.every((id) => tk.has(id));
  if (!coDo) {
    console.log('G5 ngân hàng        : ✗ — thiếu bot đo (bể không có `tk_*`)');
    fail.push('G5 không đo được — bể bot thiếu archetype ngân hàng');
  } else {
    console.log('\nSỔ TIẾT KIỆM — theo mốc');
    console.log('BOT                  TRẬN   HẠNG TB   THẮNG%   CHÁY%');
    for (const id of TK) {
      const b = lay(id);
      console.log(`${timBot(id)!.label.padEnd(20)} ${String(b.tran).padStart(5)}`
        + `   ${b.hangTB.toFixed(2).padStart(7)}   ${b.thang.toFixed(1).padStart(6)}`
        + `   ${b.chay.toFixed(1).padStart(5)}`);
    }
    const choiDuocTB = choiDuoc.reduce((t, b) => t + b.hangTB, 0) / choiDuoc.length;
    const tkMax = lay('tk_max');
    const g5a = tkMax.hangTB >= choiDuocTB && tkMax.thang < 30;
    console.log(`G5a không bến an toàn: ${g5a ? '✓' : '✗'} — gửi-hết hạng TB `
      + `${tkMax.hangTB.toFixed(2)} vs nhóm chơi-được ${choiDuocTB.toFixed(2)}, `
      + `thắng ${tkMax.thang.toFixed(1)}%`);
    if (!g5a) fail.push('G5a ngân hàng thành BẾN AN TOÀN — gửi hết mà vẫn trên trung bình');

    const bien = lay('tk_4').hangTB - lay('tk_huy').hangTB;
    const g5c = bien <= 0.30;
    console.log(`G5c quyền huỷ có giá: ${g5c ? '✓' : '✗'} — oracle-huỷ hơn gửi-4 `
      + `${bien.toFixed(2)} hạng (trần 0,30)`);
    if (!g5c) fail.push('G5c phạt huỷ quá nhẹ — quyền huỷ gần như miễn phí');

    const theoMoc = ['tk_2', 'tk_3', 'tk_4'].map((id) => ({ id, h: lay(id).hangTB }));
    const tot = [...theoMoc].sort((a, b) => a.h - b.h)[0]!;
    console.log(`G5b (cần CẢ BA cỡ map) mốc tốt nhất ở cỡ này: ${tot.id} `
      + `(${theoMoc.map((x) => `${x.id} ${x.h.toFixed(2)}`).join(' · ')})`);
  }
}
/*
 * ⚠ HAI DÒNG NÀY TỪNG CHỈ TÊN MỘT CẦN GẠT ĐÃ CHẾT (sửa 11/08).
 *
 * Chúng nói `TY_LE_TIN_GIA_BP`, nhưng từ v28 tỷ lệ tin giả THẬT là tích của ba
 * bảng (bối cảnh × loại sự kiện × môi trường tiền tệ) — dò ba nấc của hằng số
 * ấy ra số GIỐNG HỆT tới từng chữ số. Một thông điệp gate chỉ sai địa chỉ thì
 * tệ hơn không có thông điệp: nó khiến người đọc dò một cần gạt chết rồi kết
 * luận "trò không phản ứng với tỷ lệ tin giả" — kết luận sai, tốn cả phiên.
 * Cần gạt SỐNG là `HOLDEM_TIN_GIA_NHAN_BP` (config/holdem.ts,
 * `tyLeTinGiaHieuDung` — chỗ duy nhất cả ba bảng hội tụ).
 *
 * Và thôi ĐOÁN nguyên nhân: hai dòng cũ đưa hai chẩn đoán NGƯỢC NHAU cho cùng
 * một lần đỏ ("quá THẤP" ở dòng trên, "quá NHIỀU" ở dòng dưới) nên bất kỳ ai
 * đọc cũng tìm được câu hợp ý mình. Nay chỉ NÊU SỰ VIỆC + trỏ cần gạt dò được.
 */
if (!g4a) {
  fail.push('G4 "tin mọi tin" không thua hoài nghi'
    + ' — dò HOLDEM_TIN_GIA_NHAN_BP (KHÔNG phải TY_LE_TIN_GIA_BP, đã chết từ v28)');
}
if (!g4b) {
  fail.push('G4 "phớt mọi tin" không thua hoài nghi'
    + ' — tín hiệu tin tức quá yếu so với nhiễu nền, hoặc chiết khấu của hoài-nghi sai mức');
}

console.log('\n' + (fail.length === 0
  ? '✓ ĐẠT — bộ tham số dùng được'
  : '✗ KHÔNG ĐẠT:\n  - ' + fail.join('\n  - ')));
process.exit(fail.length === 0 ? 0 : 1);
