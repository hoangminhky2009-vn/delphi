/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VAI BẤT ĐỐI XỨNG — cá nhân · cá mập · đội lái · tổ chức (founder 22/08)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *"Chia 8 player nhiều vị trí và chức năng và vốn khác nhau: nhà đầu tư cá
 * nhân, cá mập (cá mập thường và đội lái), nhà đầu tư tổ chức (nhỏ-trung)."*
 * Ví dụ founder đưa: *"Đội lái sẽ có vốn lớn, đổi lại lệnh sẽ ảnh hưởng thanh
 * khoản mạnh hơn và bị cố định lõi 1 luôn luôn là Lướt Sóng. Và đội lái có đặc
 * quyền nâng cấp lõi Lướt Sóng thêm 1 tầng lv2."*
 *
 * ─── NGUYÊN TẮC: vai = LÕI GHIM + VỐN + MỘT ĐẶC QUYỀN + MỘT CÁI GIÁ ───────────
 * Không vai nào có đặc quyền mà không có giá — không thì nó là "phe mạnh hơn",
 * không phải "phe khác". Toàn văn: `docs/thiet-ke-de-xuat/gameplay/vai-bat-doi-xung.md`.
 *
 * ─── HAI SỰ THẬT ĐÃ ĐO TRƯỚC KHI THIẾT KẾ ─────────────────────────────────
 * · "Cá mập" hiện KHÔNG tồn tại về cơ chế: `demNguoiNam` đếm SỐ GHẾ, ghế 100k
 *   và ghế 10k đẩy giá y hệt nhau.
 * · Đổi crowding sang đếm-theo-tiền cho CẢ BÀN thì Tất tay mạnh lên (33,2% →
 *   35,5%, G1 đỏ): ghế ôm 25% chỉ tính 0,25 người ⇒ tổng crowding giảm ⇒ all-in
 *   rẻ hơn. ⇒ "ảnh hưởng thanh khoản mạnh hơn" phải là HỆ SỐ RIÊNG CỦA VAI
 *   (`tac_dong_gia`), không phải đổi hàm đếm của cả bàn.
 *
 * ─── VÌ SAO "ĐÃ CHẤM THEO KỸ NĂNG" LÀM BÀI TOÁN DỄ ĐI ──────────────────────
 * Founder: *"giờ chúng ta đã chấm điểm theo kỹ năng rồi chứ không chỉ thuần NAV
 * nên không quá lo về việc mất cân bằng."* Thanh PHONG CÁCH (D105) chấm ba trục
 * trung lập với vốn (Brier là xác suất, thắng-chợ và trụ là bp). Ghế 30k và ghế
 * 10k cùng đọc đúng thì cùng điểm ⇒ vốn to KHÔNG thắng được bảng PHONG CÁCH
 * bằng vốn. Bảng NAV cũng đo theo % tăng trưởng. Cái phải kiểm là QUYỀN của vai.
 *
 * ⚠ §1.2 — vai cá mập/tổ chức ÉP phơi nhiễm (Đòn Bẩy bắt vào to; mandate bắt
 * cân). Người mang vai đó thì hồ sơ đo được là "vai bắt họ làm gì". Hai việc
 * bắt buộc: (a) BỐC THĂM, không cho chọn — cùng một người, khác vai ⇒ phân tích
 * tách được NGƯỜI khỏi VAI (thí nghiệm tự nhiên); (b) NHÃN VAI lên `events`
 * (`hd_match_start.vai`) vì append-only — không nhãn là hồ sơ trộn hai chế độ
 * mãi mãi. ⭐ Founder 22/08: *"nếu ghép người đủ trận thì cũng phải cho player
 * cầm đủ các vai trò"* ⇒ NGƯỜI nhận ĐỦ BỐN vai (bốc thăm), không còn tập
 * cho-người riêng. Hệ quả phải trả cùng lúc (xem `xepHang`/`choiVongCuoc`):
 * xếp hạng cuối theo % TĂNG TRƯỞNG so vốn khởi điểm của vai, nền theo vai —
 * không thì cầm cá mập ×3 vốn là thắng hạng từ lúc chưa bấm gì.
 *
 * ⚠ FILE NÀY THUẦN: không import engine, không import DB. Chỉ mượn `rngAt`
 * (băm tất định). Server lẫn client cùng đọc một bản (A8.9).
 */
import { rngAt } from '../sandbox/rng.js';
import { CO_BAN_MOC, PHI_SAU_VAI_V57, SO_GHE_TRAN_PHONG, VAI_THEO_CO_BAN, VAI_XAC_SUAT } from '../../config/holdem.js';

export type VaiId = 'ca_nhan' | 'ca_map' | 'doi_lai' | 'to_chuc';

export interface Vai {
  id: VaiId;
  ten: string;
  /** Vốn khởi đầu — bội của `START_VON` chuẩn (10.000). */
  he_so_von: number;
  /** Lõi chiến thuật GHIM ở ô 1 (vào bàn là có, không qua shop). null = tự do. */
  loi_ghim: string | null;
  /**
   * Hệ số tác động giá RIÊNG ghế (nhân lên crowding + trượt giá). 1 = chuẩn.
   * ⚠ Đây là thứ biến "vốn to" thành "cá mập": vào to là tự đẩy giá mình lên.
   */
  tac_dong_gia: number;
  /** Một câu đặc quyền — cho UI; luật thật nằm ở engine theo `id`. */
  dac_quyen: string;
  /** Một câu cái giá — cho UI. */
  cai_gia: string;
  /** Mùa này có cấp cho NGƯỜI không, hay chỉ bot. */
  cho_nguoi: boolean;
}

/**
 * Bảng vai — MỌI SỐ LÀ PLAYTEST-TUNE (A8.2).
 *
 * ─── ĐO 22/08 (Monte Carlo v34, map 12, bàn 8, 4.000 trận/bộ, XẾP HẠNG THEO %
 * TĂNG TRƯỞNG so vốn khởi điểm của vai, phí vội vàng quy chiếu vốn vai) ─────
 * Chuỗi loại trừ — mỗi bước giết một giả thuyết về vì sao đội lái/tổ chức bét:
 *   · hạ vốn ×3→×2            6,38 → 6,24   (không phải cỡ vốn)
 *   · nền ×hệ số vốn → phẳng  (nền theo vai là SAI: suất quỹ chia bằng chip,
 *                              ghế nộp ×3 nhận suất y hệt ⇒ trợ cấp ròng)
 *   · bỏ lõi ghim             6,59 → 6,58   (không phải ghim — với bot)
 *   · phí vội vàng quy chiếu vốn vai (ghế ×3 thôi chạm trần hệ số ở lệnh 50%)
 *   · đội lái ×1 vốn/không ghim/tác động 1 vẫn 6,00 — còn cá nhân ×0,5 ⇒ 4,07
 *   ⇒ ⭐ THỦ PHẠM: chiết khấu ×0,5 của CÁ NHÂN. Cá nhân là 5/8 bàn — đa số trả
 *     nửa phí thì ba vai kia bét theo cấu trúc. Tất cả = 1 ⇒ đội lái 4,55 ≈ cá
 *     nhân 4,52. Cần gạt rất nhạy: 0,25 ≈ một bậc hạng.
 *
 *        bộ                    cá nhân  cá mập   đội lái  tổ chức
 *        cn .75 dl 1.25 cm 2    3,73     5,22     6,21     5,94
 *        cn 1  dl 1  cm 1.5 tc 1  4,09   4,12     5,51     5,90
 *   ★    cn 1  dl 1  cm 1.5 tc .75 4,15  4,15     5,56     5,54   ← CHỐT
 *        (cá mập 27,7% nhất · 6,9% cháy = high risk high reward, D37)
 *
 * ⚠ ĐỌC CHO ĐÚNG: đội lái/tổ chức ~1,4 bậc dưới par trên BÀN BOT là SÀN — bot
 * không mua bảng điện tử (cấp 2 Lướt Sóng vô nghĩa với nó) và không đọc dòng
 * tiền. Với NGƯỜI, hai đặc quyền đó là thật; khoảng 1,4 bậc là giá đã trả trước
 * cho chúng. Mandate tổ chức (rải ≤40%/mã) là cái giá bot CÓ trả ⇒ 0,75 bù.
 * Cá nhân thôi mang chiết khấu — đặc quyền của nó là TỰ DO (không ghim, không
 * siết, không mandate): chơi kiểu gì cũng được.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ BẢNG ĐO Ở TRÊN LÀ CỦA 22/08 (v34) — ĐỪNG TRÍCH NÓ NHƯ SỐ HÔM NAY.
 *
 * Mười tám bộ luật đã đi qua kể từ đó. Đo lại 21/09 trên v51 (4.000 trận · bàn
 * 8 · map 12 · par 12,5%): **ca_nhan 3,93 · to_chuc 4,63 · doi_lai 5,52 ·
 * ca_map 6,17** — tức thứ tự đã đảo so với bảng ★ ở trên (ở đó tổ chức và đội
 * lái cùng ~5,55 còn cá nhân/cá mập ~4,15; nay cá mập rơi xuống BÉT).
 *
 * D371 (21/09) sửa đúng một cấu phần của tổ chức — bộ số lá `da_dang_hoa` mà
 * `loi_ghim` ghim sẵn — và chỉ riêng nó kéo tổ chức 4,63 → 4,14 (8,8% → 13,2%
 * về nhất). Xem `DA_DANG_HOA_V52` ở config/holdem.ts để biết bảng 8 bộ + vì sao
 * bộ số cũ trị giá đúng bằng KHÔNG.
 *
 * ⭐ CÒN MỞ, CHƯA AI ĐO: **cá mập 6,17 và đội lái 5,52** là con số của bàn BOT,
 * và chú thích ngay trên nói đúng vì sao chúng thấp (bot không dùng nổi hai đặc
 * quyền ấy). Nhưng khoảng cách nay là ~2 bậc chứ không phải ~1,4 như lúc chốt.
 * Muốn biết đó là SÀN hay là HỎNG thì phải đo bằng NGƯỜI, không đo thêm bằng
 * bot — bot mãi mãi không biết mua bảng điện tử. Đừng vặn `he_so_von` theo bảng
 * bot (A8.2: số kinh tế do founder chốt, và ở đây bàn đo còn chưa đủ tư cách hỏi).
 */
export const VAI: Record<VaiId, Vai> = {
  ca_nhan: {
    id: 'ca_nhan', ten: 'NHÀ ĐẦU TƯ CÁ NHÂN',
    he_so_von: 1, loi_ghim: null, tac_dong_gia: 1,
    dac_quyen: 'TỰ DO — không lõi ghim, không bị siết, không mandate; chơi kiểu gì cũng được',
    cai_gia: 'Vốn nhỏ nhất bàn; không đặc quyền thông tin',
    cho_nguoi: true,
  },
  doi_lai: {
    id: 'doi_lai', ten: 'ĐỘI LÁI',
    he_so_von: 3, loi_ghim: 'luot_song', tac_dong_gia: 1,
    dac_quyen: 'Lướt Sóng ghim sẵn; lấy thêm một lá nữa là lên CẤP 2 — xác thực tin giả/thật',
    cai_gia: 'Lõi 1 bị ghim; ôm vị thế to đúng ô pháp lý là bị SIẾT PHÁP LÝ trừ thẳng vốn',
    cho_nguoi: true,
  },
  ca_map: {
    id: 'ca_map', ten: 'CÁ MẬP',
    he_so_von: 3, loi_ghim: 'don_bay', tac_dong_gia: 1.5,
    dac_quyen: 'Đòn Bẩy ghim sẵn; lấy thêm một lá nữa là lên CẤP 2 — nhắm được HAI mã',
    cai_gia: 'Lệnh to đẩy giá gấp rưỡi, trượt giá gấp rưỡi; ôm Đòn Bẩy mà lỗ là bị gọi ký quỹ trừ thẳng vốn',
    cho_nguoi: true,
  },
  to_chuc: {
    id: 'to_chuc', ten: 'TỔ CHỨC',
    he_so_von: 2, loi_ghim: 'da_dang_hoa', tac_dong_gia: 0.75,
    dac_quyen: 'Đa Dạng Hoá ghim sẵn (thêm mã được giữ); thấy DÒNG TIỀN cả bàn — mã nào đang đông, mã nào vắng; khớp lệnh êm (tác động giá ×0,75)',
    cai_gia: 'Mandate: không mua mã nào quá 40% NAV; không được Bán Khống',
    cho_nguoi: true,
  },
};

/**
 * D506 — HỆ SỐ VỐN ĐẦU dưới cờ `vonVaiV57` (founder 04/10 chọn mức 3: Đội lái ×10 · Cá mập ×20 · Tổ chức ×50 so với Cá nhân). Xếp hạng tính theo %
 * trên vốn đầu (`vonDauCua`) nên không lệch bảng. PLAYTEST-TUNE (A8.2) — số do founder chốt, agent không tự vặn.
 */
export const HE_SO_VON_V57: Readonly<Record<VaiId, number>> = { ca_nhan: 1, doi_lai: 10, ca_map: 20, to_chuc: 50 };
/** D506 — MỘT cửa cho hệ số vốn của vai theo luật (taoTran · vonDauCua · vaiTheoLuat). */
export function heSoVonCua(vai: VaiId, luat: { vonDeu?: boolean; vonVaiV57?: boolean }): number {
  if (luat.vonDeu === true) return 1;
  return luat.vonVaiV57 === true ? HE_SO_VON_V57[vai] : VAI[vai].he_so_von;
}

/**
 * D516 — ĐỘ SÂU CHỢ (bp, 10000 = ×1) mà phí hai bậc của ghế quy chiếu dưới cờ `phiSauVaiV57`: hệ_số_vốn^MU (`PHI_SAU_VAI_V57`). Cờ tắt hay vốn ×1
 * ⇒ 10000. Server tính một lần rồi phát số (`phiLenhCua` → DTO `phi_lenh_sau_bp`) — client không gọi `Math.pow` (C4).
 */
export function sauPhiVaiBp(vai: VaiId, luat: { vonDeu?: boolean; vonVaiV57?: boolean; phiSauVaiV57?: boolean }): number {
  if (luat.phiSauVaiV57 !== true) return 10000;
  const k = heSoVonCua(vai, luat);
  return k <= 1 ? 10000 : Math.floor(10000 * Math.pow(k, PHI_SAU_VAI_V57.MU_BP / 10000));
}

/*
 * D406 — CÂU CHỮ VAI KHI LUẬT LƯỢC BỎ (v54: `vonDeu` · `loiGon`). Câu gốc ở `VAI` là của luật có vốn theo vai và đủ lõi;
 * v54 thành mặc định thì hai câu thành hứa suông ngay trên màn chào vai: cá nhân "vốn nhỏ nhất bàn" (mọi ghế vốn đều) và
 * tổ chức "Đa Dạng Hoá ghim sẵn" (lá đã rời quầy). Chỉ đè ĐÚNG trường sai — phần còn lại của câu đọc từ `VAI`. Áp ở
 * `vaiTheoLuat` (engine), không ở client: chữ vai là chữ server từ v34 (D61 — một nguồn).
 */
export const CHU_VAI_VON_DEU: Partial<Record<VaiId, Pick<Vai, 'cai_gia'>>> = {
  ca_nhan: { cai_gia: 'Không đặc quyền thông tin' },
};
/**
 * D482 — câu chữ vai dưới cờ `traitGhimMinigame` (khung minigame): lõi ghim đổi thành TRAIT ghim. Chỉ đè `dac_quyen` / `cai_gia` có nhắc lá
 * ghim; số trong câu chép từ `HE_DON_BAY_VAI` / `PHI_GAI_BP` (config/minigame.ts) — đổi số ở đó thì sửa câu ở đây (bài canh trong
 * `tests/minigame_vai.test.ts`).
 */
export const CHU_VAI_TRAIT_GHIM: Partial<Record<VaiId, Partial<Pick<Vai, 'dac_quyen' | 'cai_gia'>>>> = {
  ca_map: {
    dac_quyen: 'Trait ghim ĐÒN BẨY ×1,5: trong màn minigame, khoản vào/ra của bạn ăn gấp rưỡi biến động giá',
    cai_gia: 'Lệnh to đẩy giá gấp rưỡi, trượt giá gấp rưỡi; đòn bẩy cũng nhân gấp rưỡi phần lỗ',
  },
  doi_lai: {
    dac_quyen: 'Trait ghim TUNG TIN: đầu màn minigame được gài một tin giả — đám đông nhảy theo đẩy giá tạm rồi tan',
    cai_gia: 'Gài tin mất phí; ôm vị thế to đúng ô pháp lý là bị SIẾT PHÁP LÝ trừ thẳng vốn',
  },
};
/**
 * D498 — câu chữ TỔ CHỨC dưới cờ `toChucV57` (founder 04/10). Số trong câu chép từ `TO_CHUC_V57` / `MANDATE_TO_CHUC` — đổi số ở config thì sửa câu
 * ở đây; bài canh `tests/to_chuc_v57.test.ts` khớp câu với số.
 */
export const CHU_VAI_TO_CHUC_V57: Partial<Record<VaiId, Partial<Pick<Vai, 'dac_quyen' | 'cai_gia'>>>> = {
  to_chuc: {
    dac_quyen: 'Khớp thỏa thuận trong nến trắng (trượt ×1,5) · phí quản lý +0,3% NAV mỗi vòng · bàn nghiên cứu: xác suất tạo đáy/đỉnh của màn · thấy dòng tiền cả bàn',
    cai_gia: 'Không margin: không Đòn Bẩy, không Bán Khống · trần thua −8% vốn màn, chạm là tự chốt · mỗi mã không quá 40% NAV',
  },
};
export const CHU_VAI_MAT_LOI_GHIM: Partial<Record<VaiId, Pick<Vai, 'dac_quyen'>>> = {
  to_chuc: { dac_quyen: 'Thấy DÒNG TIỀN cả bàn — mã nào đang đông, mã nào vắng; khớp lệnh êm (tác động giá ×0,75)' },
};

export const VAI_TAT_CA: readonly VaiId[] = ['ca_nhan', 'doi_lai', 'ca_map', 'to_chuc'];

/**
 * BỐC THĂM vai cho một bàn — TẤT ĐỊNH theo seed (replay ra y hệt), và KHÔNG
 * cho chọn (xem §1.2 ở đầu file).
 *
 * Phân bố cố ý: đa số là cá nhân, mỗi bàn tối đa một đội lái và một cá mập —
 * hai vai mạnh mà đông thì bàn thành cuộc đua ai to hơn, đúng thứ Evolve chết
 * vì. Bàn 4 ghế: 1 đội lái + 3 cá nhân. Bàn 8: 1 đội lái · 1 cá mập · 1 tổ
 * chức · 5 cá nhân.
 * @param chiCho tập vai ghế 0 (NGƯỜI) được nhận. Mặc định ĐỦ BỐN (founder
 *   22/08); thu hẹp chỉ để đo/thử — không còn mùa "người chỉ cầm hai vai".
 */
/** D515 — xác suất từng ô vai của bàn `n` ghế (`VAI_XAC_SUAT`). */
export function xacSuatVai(n: number): { cmdl: number[]; tc: number[] } {
  const X = VAI_XAC_SUAT;
  if (n <= 3) return { cmdl: [...X.NHO.cmdl], tc: [...X.NHO.tc] };
  if (n <= 10) return { cmdl: [...X.VUA.cmdl], tc: [...X.VUA.tc] };
  const d = X.TANG_MOI_2 * Math.floor((n - 11) / 2), them = (p: number) => Math.min(X.TRAN_P, p + d);
  return { cmdl: X.LON.cmdl.map(them), tc: X.LON.tc.map(them) };
}

/**
 * D515 — CHIA VAI THEO XÁC SUẤT (founder 05/10, bảng A): mỗi ô vai bốc ĐỘC LẬP theo `xacSuatVai`, ô Cá Mập/Đội Lái ra một trong hai 50/50; ghế còn
 * lại Cá nhân; xáo chỗ ngồi; ghế 0 (người) đổi chỗ nếu vai không thuộc `chiCho`. Bàn nhỏ phần lớn chỉ Cá nhân. Trần `SO_GHE_TRAN_PHONG` ghế.
 * Tất định theo seed (`rngAt`, domain riêng — không xê dịch lần rút nào khác của trận).
 */
export function bocThamVaiXacSuat(seed: number, soGhe: number, chiCho: readonly VaiId[] = VAI_TAT_CA): VaiId[] {
  if (!Number.isInteger(soGhe) || soGhe < 1 || soGhe > SO_GHE_TRAN_PHONG) throw new Error(`Số ghế ${soGhe} ngoài 1..${SO_GHE_TRAN_PHONG}`);
  const rng = rngAt(seed, 'holdem_vai_xs', soGhe), p = xacSuatVai(soGhe), dacBiet: VaiId[] = [];
  const tung = (x: number) => rng.below(1_000_000) < Math.round(x * 1_000_000);
  for (const x of p.cmdl) if (tung(x)) dacBiet.push(rng.below(2) === 0 ? 'ca_map' : 'doi_lai');
  for (const x of p.tc) if (tung(x)) dacBiet.push('to_chuc');
  const goi: VaiId[] = Array.from({ length: soGhe }, (_, i) => dacBiet[i] ?? 'ca_nhan');
  for (let i = goi.length - 1; i > 0; i -= 1) { const j = rng.below(i + 1); [goi[i], goi[j]] = [goi[j]!, goi[i]!]; }
  if (!chiCho.includes(goi[0]!)) {
    const k = goi.findIndex((v, i) => i > 0 && chiCho.includes(v));
    if (k > 0) [goi[0], goi[k]] = [goi[k]!, goi[0]!];
  }
  return goi;
}

/**
 * GHÉP BÀN XẾP HẠNG (cờ `vaiTheoCoBan`, khoá v67; founder CHỐT 11/10) — xác suất từng ô vai theo CỠ BÀN thay cho 3 nhóm D515: hàng của MỐC cỡ bàn
 * lớn nhất không vượt `n` ghế (bàn 7 ghế ⇒ hàng mốc 4; bàn 15 ⇒ hàng mốc 12). Trả về xác suất 0..1; số gốc là PHẦN TRĂM ở `VAI_THEO_CO_BAN`.
 */
export function xacSuatVaiTheoCoBan(n: number): { cmdl: number[]; tc: number[]; moc: number } {
  let moc: number = CO_BAN_MOC[0];
  for (const m of CO_BAN_MOC) if (m <= n) moc = m;
  const h = VAI_THEO_CO_BAN[moc]!;
  return { cmdl: h.cmdl.map((x) => x / 100), tc: h.tc.map((x) => x / 100), moc };
}

/**
 * Chia vai bàn XẾP HẠNG GHÉP NGƯỜI — cùng khuôn `bocThamVaiXacSuat` (mỗi ô độc lập, ô CM/ĐL ra Cá Mập hoặc Đội Lái 50/50, ghế còn lại Cá nhân,
 * xáo chỗ), chỉ khác bảng xác suất (`xacSuatVaiTheoCoBan`) và trần ghế 20 (`SO_GHE_TRAN_TRAN`: trận, không phải phòng). Tất định theo seed.
 * rng domain RIÊNG (`holdem_vai_cb`) — không xê dịch lần rút nào của luật bốc cũ.
 */
export function bocThamVaiTheoCoBan(seed: number, soGhe: number, chiCho: readonly VaiId[] = VAI_TAT_CA): VaiId[] {
  if (!Number.isInteger(soGhe) || soGhe < 1 || soGhe > 20) throw new Error(`Số ghế ${soGhe} ngoài 1..20`);
  const rng = rngAt(seed, 'holdem_vai_cb', soGhe), p = xacSuatVaiTheoCoBan(soGhe), dacBiet: VaiId[] = [];
  const tung = (x: number) => rng.below(1_000_000) < Math.round(x * 1_000_000);
  for (const x of p.cmdl) if (tung(x)) dacBiet.push(rng.below(2) === 0 ? 'ca_map' : 'doi_lai');
  for (const x of p.tc) if (tung(x)) dacBiet.push('to_chuc');
  const goi: VaiId[] = Array.from({ length: soGhe }, (_, i) => dacBiet[i] ?? 'ca_nhan');
  for (let i = goi.length - 1; i > 0; i -= 1) { const j = rng.below(i + 1); [goi[i], goi[j]] = [goi[j]!, goi[i]!]; }
  if (!chiCho.includes(goi[0]!)) {
    const k = goi.findIndex((v, i) => i > 0 && chiCho.includes(v));
    if (k > 0) [goi[0], goi[k]] = [goi[k]!, goi[0]!];
  }
  return goi;
}

export function bocThamVai(
  seed: number, soGhe: number, chiCho: readonly VaiId[] = VAI_TAT_CA,
  /**
   * D498 (cờ `toChucV57`; founder 04/10: *"nếu 1 trận dưới 4 người thì chỉ có 1 cá mập hoặc 1 đội lái hoặc 1 tổ chức còn đâu nếu dưới 6 người thì chỉ
   * có 1 cá mập và 1 tổ chức hoặc 1 đội lái và 1 tổ chức. Bàn 8 người mới được đầy đủ 3 role"* — bàn 6–7 founder chọn 2 vai): < 4 ghế ⇒ 1 vai (xoay
   * như cũ) · 4–7 ghế ⇒ TỔ CHỨC + một trong Cá Mập / Đội Lái (không bao giờ Cá Mập + Đội Lái) · ≥ 8 ⇒ đủ ba. Mỗi vai tối đa một ghế.
   */
  chiaToChuc = false,
): VaiId[] {
  const uuTien: VaiId[] = ['doi_lai', 'ca_map', 'to_chuc'];
  const soDacBiet = chiaToChuc ? (soGhe >= 8 ? 3 : soGhe >= 4 ? 2 : 1) : soGhe >= 8 ? 3 : soGhe >= 6 ? 2 : 1;
  /*
   * Xáo tất định theo seed — qua `rngAt` (BĂM seed + domain) chứ không LCG thô:
   * LCG gieo bằng hai seed KỀ NHAU cho hai dãy gần giống hệt, và phép đo bắt
   * được ngay (seed 20260841 và 20260842 ra cùng bộ vai). Domain riêng để lần
   * rút này không xê dịch bất kỳ lần rút nào khác của trận.
   */
  const rng = rngAt(seed, 'holdem_vai', soGhe);
  /*
   * Bàn nhỏ (≤5 ghế: 1 vai đặc biệt · 6–7: 2) XOAY vai đặc biệt theo seed — bản
   * đầu lấy cố định từ đầu danh sách nên bàn 4–5 KHÔNG BAO GIỜ có cá mập/tổ chức,
   * tức người ở bàn nhỏ bị giấu hai vai (founder 22/08: "cho player cầm đủ các
   * vai"). Bàn 8 đủ ba nên phép xoay không đổi gì.
   */
  const batDau = rng.below(uuTien.length);
  // D498 — hai vai ⇒ Tổ Chức + (Cá Mập | Đội Lái) theo cùng cú rút `batDau` (không thêm cú rút ⇒ phần xáo phía sau giữ dãy số như cũ).
  const dacBiet: VaiId[] = chiaToChuc && soDacBiet === 2 ? ['to_chuc', batDau % 2 === 0 ? 'ca_map' : 'doi_lai']
    : Array.from({ length: soDacBiet }, (_, i) => uuTien[(batDau + i) % uuTien.length]!);
  const goi: VaiId[] = [];
  for (let i = 0; i < soGhe; i += 1) {
    goi.push(i < soDacBiet ? dacBiet[i]! : 'ca_nhan');
  }
  for (let i = goi.length - 1; i > 0; i -= 1) {
    const j = rng.below(i + 1);   // đều, không lệch modulo
    [goi[i], goi[j]] = [goi[j]!, goi[i]!];
  }
  // Ghế 0 là NGƯỜI: nếu vai bốc ra không thuộc tập cho người thì đổi chỗ với
  // một ghế bot đang cầm vai cho-người. Bot nhận vai còn lại — bot đo được.
  if (!chiCho.includes(goi[0]!)) {
    const k = goi.findIndex((v, i) => i > 0 && chiCho.includes(v));
    if (k > 0) [goi[0], goi[k]] = [goi[k]!, goi[0]!];
  }
  return goi;
}
