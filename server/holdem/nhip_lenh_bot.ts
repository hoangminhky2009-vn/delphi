/**
 * NHỊP LỆNH NAV CỦA BOT — MỘT HÀM CHO MỌI BÀN ĐO (D156).
 *
 * Trước file này, khối "dựng bối cảnh → mandate → lenhBotNav → apLenhVongNav"
 * tồn tại BA bản: đường thật trong `holdem_api.ts` (replay), bàn đo
 * `holdem_montecarlo.ts`, và một bản THIẾU HẲN ở `holdem_phanthan_gate.ts` —
 * chính cái thiếu đó làm gate phản thân in ra "vốn giống hệt từng chữ số giữa
 * bật/tắt" (D155: ghế không ôm mã nào thì ô thay không chạm được ai). Ba bản
 * của cùng một nhịp là ba bản sẽ trôi (D61), và chỗ trôi này đắt nhất repo:
 * gate lệch đường thật là mọi kết luận cân bằng đứng trên phép đo sai (D83).
 *
 * Hàm đọc CỜ TỪ `st` (bot_doc_tin, co_vi_the, bot_dung_thuoc_that, can_troi,
 * can_troi_2, map_v28) — không nhận object luật riêng, vì `st` là nơi duy nhất
 * hai đường (replay thật + bàn đo) chắc chắn đồng nhất: cả hai đều đi qua
 * `taoTran(luat)`.
 *
 * ⚠ ORACLE (`bietThatGia`) là ưu đãi CHỈ CỦA BÀN ĐO — nhận ô THẬT (giữ cờ
 * `la_tin_gia`) trong khi mọi ghế khác nhận ô đã lọc. Đường thật không có
 * oracle nên không truyền predicate này. Đây đúng định nghĩa của G2: cùng một
 * hàm chấm điểm, khác đúng một mẩu thông tin.
 *
 * ⚠ `holdem_api.ts` CHƯA migrate sang hàm này (kế hoạch D156 ghi ở đây cho
 * người sau): khối của nó thêm ba việc — lọc `duocChonBai`, ghi `hitVongCuoi`,
 * và chạy giữa các nhịp lõi-vốn — nên cú migrate phải đi kèm GOLDEN TEST
 * replay (một bộ trận thật, so từng byte trạng thái trước/sau). Làm ẩu chỗ đó
 * là đổi replay của mọi trận đã lưu. Tới lúc migrate, thêm options
 * (chonGhe/onLenh) chứ KHÔNG chép khối này ra bản thứ tư.
 */
import {
  LAI_SUAT_NEN, bangCanTroi,
} from '../../config/holdem.js';
import {
  apHuyTietKiem, apLenhVongNav, apMoTietKiem, boiCanhUpCua, oVongUp, coV42ChoBot, echoCua, mandateCua,
  maxTaiSanCua, mocKipCua, tinBiChe, tuyChonLenhV55, tyLeGiaCua, vongDaLat, type TrangThaiTran,
} from './engine.js';
import type { OThiTruong } from './map.js';

/**
 * v43 (D314) — "ô này tốt thật không", CHỈ oracle được hỏi. Dùng cho `tk_huy` (trần trên
 * của quyền huỷ). Định nghĩa hẹp và tường minh: pha đi lên, hoặc tin THẬT báo trước pha
 * đi lên. Không đoán bằng ma trận — đoán ở đây là đẻ một máy chấm điểm thứ hai (D61).
 */
function oTot(o: OThiTruong): boolean {
  if (o.kind === 'giai_doan') return o.giai_doan === 'tang' || o.giai_doan === 'phuc_hoi';
  return !o.la_tin_gia && (o.bao_truoc === 'tang' || o.bao_truoc === 'phuc_hoi');
}
import { chonTraitBot, lenhBotNav, type Bot } from './bots.js';
import { apMocTrait, bayTrait, khoTraitCua, laMocTrait, type LuaChonTrait, type SuKienMocTrait } from './trait.js';
import type { BoiCanhLenh } from './bots.js';

/**
 * BỐI CẢNH LỆNH CỦA MỘT VÒNG — MỘT NGUỒN CHO ĐƯỜNG THẬT VÀ MỌI BÀN ĐO (D386).
 *
 * ⚠⚠ VÌ SAO HÀM NÀY TỒN TẠI: object bối cảnh này đã TRÔI BA LẦN, và cả ba lần
 * đều im lặng — `can_troi` v21↔v23 (rà soát 11/08), ba cờ v42 (D311), và `nen`
 * v36 R3, cái cuối sống từ D166 tới D386 mà không test nào đỏ. Cùng một lớp
 * lỗi, cùng một object, ba lần: đó không còn là sơ suất mà là hình dạng sai.
 * Hai bản của cùng một bối cảnh là hai bản sẽ trôi (D61), và ở ĐÂY cú trôi
 * luôn biểu hiện là "gate chấm một con bot mà người chơi không bao giờ gặp"
 * (D83) — thứ không ném lỗi, không đỏ test, chỉ lặng lẽ ra một bảng số đẹp.
 *
 * Nên chỗ chống trôi phải là CHỖ DỰNG, không phải một bài test đếm trường: hàm
 * này là nơi duy nhất biết bối cảnh gồm những gì, và người gọi chỉ còn thêm
 * phần PHỤ THUỘC GHẾ (`tran_ma_bp` của mandate).
 *
 * `oracle` là ưu đãi CHỈ CỦA BÀN ĐO: nhận ô THẬT (giữ `la_tin_gia`) và KHÔNG
 * nhận `ty_le_gia_bp` — nó biết thật/giả rồi thì không còn gì để chiết khấu.
 * Đường thật không có oracle nên không bao giờ truyền cờ này.
 *
 * Trả `undefined` khi `bot_doc_tin` tắt ⇒ chính sách vòng tròn cũ, trận cũ
 * replay nguyên.
 */
export function boiCanhLenhVong(
  st: TrangThaiTran, oracle = false,
): Parameters<typeof lenhBotNav>[4] {
  const oVong = st.map.o[st.vong - 1];
  // Cờ tắt ⇒ `undefined` ⇒ bot rơi về chính sách vòng tròn cũ, trận cũ replay nguyên.
  if (st.bot_doc_tin !== true || !oVong) return undefined;
  const oLoc = oVong.kind === 'su_kien'
    ? { ...oVong, la_tin_gia: false } : oVong;
  /*
   * v53 (D373) — Ô CỦA VÒNG CÒN ÚP ⇒ bot chấm bằng Ô KỲ VỌNG, KHÔNG đụng `oVong`/`oLoc`.
   * Cửa chung với đường thật: `boiCanhUpCua` (engine). `null` ở mọi trận ≤ v52.
   */
  const up = boiCanhUpCua(st);
  const echo = echoCua(st, st.vong);
  const cvt = st.co_vi_the === true ? { co_vi_the: true as const } : {};
  /*
   * ⚠ BẢNG CÂN TRÔI PHẢI LÀ BẢNG ENGINE ĐANG DÙNG (rà soát 11/08): không cấp
   * thì bot rơi về bảng v21 trong khi engine định giá bằng v23 — mọi số cân
   * bằng khi đó đo CHÊNH LỆCH GIỮA HAI BẢNG chứ không đo kỹ năng.
   */
  const ct = st.bot_dung_thuoc_that === true
    ? { can_troi: bangCanTroi(st.can_troi === true, st.can_troi_2 === true) }
    : {};
  // v41 (D307) — LỚP VN, cùng lý do MỘT NGUỒN với `ct` (bangCanTroi) ngay trên:
  // bot phải chấm mã bằng ĐÚNG bảng engine đang chạy trận này.
  const lv = st.lop_vn === true ? { lop_vn: true as const } : {};
  /*
   * v42 (D311) — BA CỜ, và chỗ này là chỗ ĐẮT NHẤT để quên chúng.
   *
   * Đã quên một lần trong chính đợt này: tôi nối `tai_san_v42`/`coupon_bp` ở
   * `holdem_api.ts` rồi chạy gate 12.000×3, ra 12/12 — và số GIỐNG HỆT lần chạy
   * trước khi nối, tới từng chữ số thập phân. Đó là dấu hiệu: bàn đo không đi qua
   * `holdem_api.ts` mà đi qua ĐÂY, nên bot vẫn chấm mã bằng bảng v41 trong khi
   * engine định giá bằng V42. Gate khi ấy đo CHÊNH LỆCH HAI BẢNG, không đo kỹ năng —
   * đúng lỗi `can_troi` v21↔v23 mà docstring ngay trên đã cảnh báo, tái diễn.
   *
   * ⚠ `coupon_bp` nặng hơn nữa: hàng giá của Trái phiếu Mỹ ở V42 là GIÁ-THUẦN (âm ở
   * `tang`/`phuc_hoi`). Bot không biết coupon thì thấy nó là mã dở toàn tập và không
   * bao giờ mua, trong khi engine vẫn trả lãi mỗi ô cho ai cầm.
   */
  const v42 = coV42ChoBot(st);
  /*
   * v28 — bot hoài nghi chiết khấu theo tỷ lệ hiệu dụng CÔNG KHAI.
   * ⚠ Mức lãi lấy TRƯỚC ô này ([vong−2]) — lấy [vong−1] là mức SAU, mà mức sau
   * chỉ nhúc nhích khi tin THẬT, tức tự tay phát máy dò tin giả cho bot và
   * giết phép đo G4.
   */
  const tlg = st.map_v28 === true && oVong && oVong.kind === 'su_kien' ? {
    ty_le_gia_bp: tyLeGiaCua(
      st, oVong.boi_canh, oVong.su_kien,
      st.map.trang_thai?.[st.vong - 2]?.lai_suat_diem ?? LAI_SUAT_NEN.KHOI_DIEM),
  } : {};

  /*
   * v36 R3 (D166) — NỀN regime của vòng, cấp từ CHÍNH `st` (một nguồn với
   * engine). Chỉ khi `gia_chong_nen` bật: engine chưa cộng nền thì bot cũng
   * không được cộng, nếu không bot lại đọc một trò khác trò đang chấm.
   */
  // D172 — bản C: cấp nền cho MỌI vòng tin; hệ số nhân tự trả 10000 khi nền
  // ngang, nên chỗ này không được tự lọc (lọc là bot thấy khác engine).
  /*
   * ⚠ D386 — CỔNG `bot_doc_nen`, KHÔNG phải `gia_chong_nen`.
   *
   * Đọc thẳng `gia_chong_nen` ở đây thì mọi trận v36–v52 ĐÃ LƯU bỗng replay ra
   * vị thế bot khác — cổng dựng lên để giữ lịch sử lại chính là thứ viết lại nó
   * (đúng cái bẫy `balance_version` sinh ra để chặn).
   *
   * Và cổng này gác CẢ BÀN ĐO: trước D386 bàn đo cấp `nen` cho v36–v52 trong khi
   * đường thật không cấp, nên gate của quãng đó chấm một con bot chưa từng ngồi
   * bàn người chơi. Gác một phía là giữ nguyên drift dưới một cái tên mới.
   */
  const nenVong = st.gia_chong_nen === true && st.bot_doc_nen === true
    && oVong.kind === 'su_kien'
    ? st.map.trang_thai?.[st.vong - 1]?.giai_doan_nen : undefined;
  const nen = nenVong !== undefined ? { nen: nenVong } : {};
  /*
   * v53 (D373) — Ô CỦA VÒNG CÒN ÚP ⇒ bot chấm bằng Ô KỲ VỌNG, KHÔNG đụng `oVong`/`oLoc`.
   *
   * ⚠⚠ D386 — DÒNG NÀY LÀ CẢ LÝ DO CÚ GỘP PHẢI LÀM TAY. Hàm gom này sinh ra trên nhánh
   * `claude/practical-pascal-845604`, tách TRƯỚC khi có v53, nên nó chỉ biết ô ngửa: lấy
   * nguyên bản ấy là CẢ HAI đường (thật + ba bàn đo) cho bot chấm `o[vong−1]` như thể đó là
   * ô tính tiền — trong khi ở v53 ô ấy chỉ là lá vừa lật, còn lá tính tiền là `o[vong]`,
   * đang úp. Tức bot chơi một trò khác hẳn trò người chơi đang chơi.
   *
   * · ORACLE KHÔNG NHÌN THẤY Ô ÚP — ưu đãi của nó là biết lá tin vừa lật THẬT hay BỊA (`that`).
   * · Không `nen`, không `tlg`: ô kỳ vọng LUÔN là ô pha ⇒ hệ số nền trả 10000 và tỷ lệ tin
   *   giả đã nằm trong `up`. Hệ quả đáng ghi: ở v53, cờ `botDocNen` KHÔNG có tác dụng gì —
   *   nó chỉ mang nghĩa ở luật ô-ngửa (xem bài canh `boi_canh_lenh_mot_nguon`).
   */
  if (up !== null) {
    return {
      o: up.o,
      up: { ...up.up, ...(oracle && up.that !== undefined ? { that: up.that } : {}) },
      echo,
      ...(oracle ? { biet_that_gia: true as const } : {}),
      ...cvt, ...ct, ...lv, ...v42,
    };
  }
  return oracle
    ? { o: oVong, echo, biet_that_gia: true as const, ...cvt, ...ct, ...lv, ...v42, ...nen }
    : { o: oLoc, echo, ...cvt, ...ct, ...lv, ...v42, ...tlg, ...nen };
}

export function apNhipLenhBotNav(
  st: TrangThaiTran,
  /** Bot của từng ghế, theo THỨ TỰ ghế trong `st.ghe` (khuôn cả hai bàn đo). */
  bots: readonly Bot[],
  /**
   * Ghế nào được thấy ô THẬT (giữ `la_tin_gia`) — chỉ bàn đo dùng, cho oracle.
   * Vắng = không ai (mọi ghế nhận ô đã lọc, như bàn người chơi thật).
   */
  bietThatGia?: (bot: Bot) => boolean,
): TrangThaiTran {
  if (st.nav !== true) return st;

  const oVong = st.map.o[st.vong - 1];
  const bcThuong = boiCanhLenhVong(st);
  const bcOracle = bietThatGia ? boiCanhLenhVong(st, true) : undefined;

  for (let i = 0; i < st.ghe.length; i += 1) {
    const g = st.ghe[i]!;
    if (g.da_chay) continue;
    const bot = bots[i]!;
    const bc = bietThatGia?.(bot) === true ? bcOracle : bcThuong;
    // v34 — bot tổ chức đọc mandate từ CÙNG cửa engine kiểm người (D61).
    const bcG = boiCanhLenhGhe(st, g, bc);
    const lenh = lenhBotNav(bot, g, st.vong, maxTaiSanCua(st, g), bcG);
    if (lenh.length > 0) {
      const r = apLenhVongNav(st, g.id, lenh);
      if (r.ok) st = r.st;
    }
    /*
     * v43 (D314) — NGÂN HÀNG. Chạy SAU lệnh giao dịch, cùng thứ tự với đường thật
     * (`replay()`: `mo` sau `lenh`) — mốc % tính trên TIỀN MẶT CÒN LẠI. Hai đường lệch
     * thứ tự ở đây là gate đo một trò khác trò người chơi đang chơi.
     * Huỷ chạy TRƯỚC mở, cũng như đường thật: tiền về rồi mới gửi lại được.
     */
    if (st.ngan_hang === true && bot.chonTietKiem) {
      const gNay = st.ghe.find((x) => x.id === g.id)!;
      const qd = bot.chonTietKiem({
        vong: st.vong,
        so_o: st.map.o.length,
        tien_mat: gNay.von,
        moc_kip: mocKipCua(st.vong, st.map.o.length),
        dang_giu: (gNay.tiet_kiem ?? []).map((h) => ({
          id: h.id, con_vong: h.vong_mo + h.so_vong - 1 - st.vong,
        })),
        /*
         * v53 (D373) — KHÔNG CÒN `o_that_tot`: nó là câu "ô sắp lật có tốt không", tức đúng
         * thứ v53 vừa úp đi. Ở v53 oracle quyết tiết kiệm bằng chính thông tin công khai.
         */
        ...(bietThatGia?.(bot) === true && oVong && !oVongUp(st)
          ? { o_that_tot: oTot(oVong) } : {}),
      });
      if (qd?.huy?.length) {
        const rh = apHuyTietKiem(st, g.id, qd.huy);
        if (rh.ok) st = rh.st;
      }
      if (qd?.mo?.length) {
        const rm = apMoTietKiem(st, g.id, qd.mo);
        if (rm.ok) st = rm.st;
      }
    }
  }
  return st;
}

/**
 * v55 (D409) — PHẦN PHỤ THUỘC GHẾ của bối cảnh lệnh: mandate của vai (đã có từ v34) + ràng buộc lệnh từ trait (D425: phần
 * BÁN còn được của GÔNG CÙM, phí cố định của SỔ MỎNG — đọc từ CHÍNH `tuyChonLenhV55` engine dùng để kiểm). MỘT nguồn cho
 * đường thật (`replay`) lẫn bàn đo (`apNhipLenhBotNav`) — trước đây hai bên tự ghép mandate, thêm một trường nữa mà chép
 * hai lần là lặp đúng cú trôi D386.
 */
export function boiCanhLenhGhe(
  st: TrangThaiTran, g: TrangThaiTran['ghe'][number], bc: BoiCanhLenh | undefined,
): BoiCanhLenh | undefined {
  if (!bc) return undefined;
  const md = mandateCua(st, g);
  const tc = tuyChonLenhV55(st, g);
  // v55 (D422) — MÙ TIN: lá tin vừa lật bị che với ghế này ⇒ bot không đọc được nó báo trước gì (cùng cửa màn người chơi).
  const cheTin = bc.up !== undefined && tinBiChe(st, g, vongDaLat(st) - 1);
  return {
    ...bc,
    ...(cheTin ? { up: { bao_truoc: null } } : {}),
    ...(md ? { tran_ma_bp: md.tranMaBp } : {}),
    ...(tc.tranBanVong ? { tran_ban_con: Math.max(0, tc.tranBanVong.tranTien - tc.tranBanVong.daBan) } : {}),
    ...(tc.phiCoDinhLenh ? { phi_co_dinh_lenh: tc.phiCoDinhLenh } : {}),
  };
}

/**
 * v55 (D409) — MỐC TRAIT CHO CẢ BÀN, gọi SAU khi vòng `vongVua` đã chốt (cổng `trait`). Người thật đưa lựa chọn từ log
 * (`luaChonNguoi`), bot chọn bằng chính sách tất định `chonTraitBot`. MỘT hàm cho đường thật lẫn bàn đo — thêm trait vào
 * hai chỗ là chắc chắn lệch (bẫy D55/D83 'gate xanh mà đo sai'). Không mốc ⇒ trả nguyên `st`, không sự kiện.
 */
export function apMocTraitCaBan(
  st: TrangThaiTran, seed: number, vongVua: number,
  luaChonNguoi: ReadonlyMap<string, LuaChonTrait>,
  botCua: (gheId: string) => Bot | undefined,
): { st: TrangThaiTran; su_kien: SuKienMocTrait[] } {
  if (st.trait_bat !== true || !laMocTrait(vongVua, st.map.o.length, st)) return { st, su_kien: [] };
  const suKien: SuKienMocTrait[] = [];
  const ghe = st.ghe.map((g) => {
    if (g.da_chay || g.tu_the === 'dau_hang') return g;
    let luaChon: LuaChonTrait | undefined;
    if (g.loai === 'bot') {
      const bot = botCua(g.id);
      const moi = bayTrait(seed, g.id, vongVua, 0, g.trait ?? [], khoTraitCua(st), g.vai);
      luaChon = bot ? { lay: chonTraitBot(bot, moi, { seed, vong: vongVua, gheId: g.id }), cuon: 0 } : undefined;
    } else {
      luaChon = luaChonNguoi.get(g.id);
    }
    const r = apMocTrait(seed, vongVua, g, luaChon, khoTraitCua(st));
    suKien.push(r.su_kien);
    return {
      ...g, trait: r.trait, xu: r.xu,
      ...(r.te_liet_den_vong !== undefined ? { te_liet_den_vong: r.te_liet_den_vong } : {}),
      ...(Object.keys(r.trait_tu_vong).length > 0 ? { trait_tu_vong: r.trait_tu_vong } : {}),
    };
  });
  return { st: { ...st, ghe }, su_kien: suKien };
}

