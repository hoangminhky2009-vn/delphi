/**
 * TỰ ĐIỂN TRAIT — chữ ở CLIENT, server chỉ trả id + số (D26). Số đọc từ config, không gõ tay (A11.5).
 * Câu luật là MÔ TẢ cách trận đối xử với người mang trait — không kê đơn (A10).
 * v55 (D409 → D422). Bảng id + điểm + loại: `config/trait.ts`. Hình của lá: `lib/trait_hinh.ts` (sinh từ demo).
 *
 * ⚠ Trang demo đã duyệt `docs/ui-ux/demo/the-trait.html` in ĐÚNG chữ của tệp này (trang được sinh từ đây —
 *   `web/tests/the_trait.test.tsx` so từng câu). Sửa một câu ở đây ⇒ sinh lại trang demo cùng commit.
 */
import { LUA } from '@config/lua';
import { RAI_LENH_NEN, TAM_LY_YEU, THAM_SO, TRAIT, diemCoDau, type TraitId } from '@config/trait';
import { LOI_MINIGAME, MANDATE_TO_CHUC, vongChonChienThuat } from '@config/holdem';
import { CO_BAN_MINIGAME } from '@config/luoc_bo';
import { HE_DON_BAY_VAI, PHI_GAI_BP, TRAIT_MAN } from '@config/minigame';
/** D506 — phần cú đẩy còn lại khi Rải lệnh n nến (%): 100/√n — chữ hiển thị, không phải tiền. */
const raiNhe = (n: number) => Math.round(100 / Math.sqrt(n));

/** bp → "25%"; phần lẻ giữ một số sau dấu phẩy ("0,6%"). */
const pc = (bp: number): string => (bp % 100 === 0 ? `${bp / 100}%` : `${(bp / 100).toFixed(1).replace('.', ',')}%`);

export interface ChuTrait {
  /** Tên HOA ngắn trên lá. */
  ten: string;
  /** Một câu luật trong trận. */
  luat: string;
  /** Một câu đặc điểm ngoài đời (tuỳ chọn) — D28: chú thích là chuyện thật, không phải "tác dụng". */
  doi?: string;
}

export const TRAIT_CHU: Readonly<Record<TraitId, ChuTrait>> = {
  // ── TÀI ──
  lenh_min: { ten: 'LỆNH MỊN', luat: `Có thêm mốc lệnh ${pc(THAM_SO.LENH_MIN_MOC_BP)} — lệnh nhỏ, trượt giá thấp.`, doi: 'Nhà đầu tư chia lệnh nhỏ thường trả trượt giá ít hơn.' },
  tam_rong: { ten: 'TẦM RỘNG', luat: `Giữ được thêm ${THAM_SO.TAM_RONG_THEM_MA} mã cùng lúc.`, doi: 'Danh mục rộng hơn — chỉ mở thêm chỗ, không thưởng gì cho việc lấp đầy.' },
  may_xu: { ten: 'MÁY XU', luat: `Mỗi vòng còn lửa nhận thêm ${LUA.MAY_XU_THEM} xu.` },
  kien_nhan: { ten: 'KIÊN NHẪN', luat: `Mã giữ liền từ ${THAM_SO.KIEN_NHAN_VONG} vòng: lãi của mã ấy mỗi vòng được cộng thêm ${pc(THAM_SO.KIEN_NHAN_THUONG_BP)}.`, doi: 'Người bán mã đang lãi quá sớm là để lại phần lớn nhất của con sóng.' },
  sang_so: { ten: 'SÁNG SỔ', luat: 'Thấy nấc thanh khoản THẬT của mã đầu cơ (hết sương mù).', doi: 'Người có tài khoản môi giới tốt đọc được sổ lệnh thật.' },
  giu_nhiet: { ten: 'GIỮ NHIỆT', luat: `Lửa bị dập chỉ hạ ${LUA.GIU_NHIET_HA_NAC} nấc, không tắt hẳn.` },
  ky_luat: { ten: 'KỶ LUẬT', luat: `Mỗi vòng, lỗ của bạn không sụt quá ${pc(THAM_SO.KY_LUAT_SAN_BP)}, kể cả phần Đòn Bẩy nhân lên. Phí bảo hiểm ${pc(THAM_SO.KY_LUAT_PHI_BP)} mỗi vòng.`, doi: 'Lệnh cắt lỗ đặt sẵn cắt cả vị thế vay; trượt giá vẫn cộng sau sàn.' },
  noi_gian: { ten: 'NỘI GIÁN', luat: `Biết trước LOẠI (pha hay tin) của ${THAM_SO.NOI_GIAN_SO_LA} lá kế.`, doi: 'Thông tin sớm là lợi thế đắt nhất — và là thứ pháp luật soi kỹ nhất.' },
  di_sau: { ten: 'ĐI SAU', luat: 'Trước khi chốt, thấy cả bàn đang mua hay bán từng mã ở vòng này.', doi: 'Người đi sau trong ván bài thấy người khác ra tay trước khi mình quyết.' },
  // ── TẬT ──
  mu_tin: { ten: 'MÙ TIN', luat: `Mỗi lá TIN lật ra có ${pc(THAM_SO.MU_TIN_CHE_BP)} khả năng bị che với riêng bạn: chỉ thấy mã nào tăng, mã nào giảm.`, doi: 'Thấy giá chạy mà không biết vì sao, như người chỉ nhìn bảng điện mà không đọc tin.' },
  mu_lua: { ten: 'MÙ LỬA', luat: `Lửa của bạn luôn tắt: không giảm trượt giá, không thưởng đà. Đổi lại +${THAM_SO.MU_LUA_XU} xu mỗi vòng.`, doi: 'Không chạy theo cảm giác đang lên tay; nhận đồng lương đều thay cho hoa hồng.' },
  nong_voi: { ten: 'NÓNG VỘI', luat: `Mã giữ liền quá ${THAM_SO.NONG_VOI_VONG} vòng: lãi của mã ấy mỗi vòng bị cắt ${pc(THAM_SO.NONG_VOI_CAT_BP)}.`, doi: 'Không ngồi yên được với một mã: lãi chưa kịp chạy đã chốt, lại đi tìm mã khác.' },
  suong_mu: { ten: 'SƯƠNG MÙ', luat: 'Lá PHA mới lật hiện HAI mặt với riêng bạn, một thật một mồi. Sương tan sau 1 vòng.', doi: 'Không rõ thị trường đang vào mùa nào: tăng thật hay chỉ là nhịp hồi.' },
  gong_cum: { ten: 'GÔNG CÙM', luat: `Mỗi vòng chỉ bán ra được tối đa ${pc(THAM_SO.GONG_CUM_TRAN_BAN_VONG_BP)} NAV — thoát hết một vị thế lớn mất nhiều vòng.`, doi: 'Khó buông vị thế: bán ra từng phần nhỏ, cú thoát nào cũng chậm hơn thị trường.' },
  mot_gio: { ten: 'MỘT GIỎ', luat: `Giữ tối đa ${THAM_SO.MOT_GIO_TOI_DA_MA} mã cùng lúc.` },
  so_mong: { ten: 'SỔ MỎNG', luat: `Mỗi lệnh mua hay bán mất phí cố định ${pc(THAM_SO.SO_MONG_PHI_LENH_BP)} vốn khởi điểm — ra vào càng nhiều lần càng tốn.`, doi: 'Tài khoản ở công ty môi giới thu phí tối thiểu cao: lệnh to hay nhỏ đều mất cùng một khoản.' },
  te_liet: { ten: 'TÊ LIỆT', luat: `${THAM_SO.TE_LIET_SO_VONG} vòng kế lõi không phát huy và không mua được lõi.` },
  chot_non: { ten: 'CHỐT NON', luat: `Mỗi vòng, lãi của bạn bị cắt ở +${pc(THAM_SO.CHOT_NON_TRAN_BP)}, kể cả phần Đòn Bẩy nhân lên.`, doi: 'Chốt lời quá sớm: bán ngay khi vừa lãi, để phần lớn con sóng lại cho người khác.' },
  mat_tri: { ten: 'MẤT TRÍ', luat: 'Ở mỗi mốc kế, mất ngẫu nhiên một TÀI đang mang.' },
  lo_lenh: { ten: 'LỘ LỆNH', luat: `Lệnh của bạn khớp sau cả bàn: phần trượt giá vì đông người của bạn nặng thêm ${pc(THAM_SO.LO_LENH_CHEN_X_BP - 10000)}.`, doi: 'Lệnh chậm và bị nhìn thấy trước: người khác vào trước, mình mua đắt hơn.' },
  // ── CẶP CỦA VAI ──
  ghim_don_bay: { ten: 'ĐÒN BẨY GHIM', luat: 'Đòn Bẩy ghim sẵn; lấy thêm một lá là nhắm được hai mã.' },
  tac_dong_gia: { ten: 'TAY NẶNG', luat: 'Lệnh đẩy giá gấp rưỡi, trượt giá gấp rưỡi; ôm Đòn Bẩy mà lỗ là bị gọi ký quỹ.' },
  ghim_luot_song: { ten: 'LƯỚT SÓNG GHIM', luat: 'Lướt Sóng ghim sẵn; lấy thêm một lá là biết tin thật hay giả.' },
  siet_phap_ly: { ten: 'SOI PHÁP LÝ', luat: 'Ôm vị thế to đúng ô pháp lý là bị siết, trừ thẳng vốn.' },
  dong_tien: { ten: 'THẤY DÒNG TIỀN', luat: 'Thấy dòng tiền cả bàn; khớp lệnh êm (trượt ×0,75).' },
  uy_thac: { ten: 'ỦY THÁC', luat: `Mỗi mã không quá ${pc(MANDATE_TO_CHUC.TRAN_MA_BP)} NAV; không bán khống.` },
  // ── D482 — TRAIT GHIM CỦA KHUNG MINIGAME (thay lõi ghim) ──
  don_bay_man: { ten: `ĐÒN BẨY ×${String(HE_DON_BAY_VAI).replace('.', ',')}`, luat: 'Trong màn minigame, khoản vào/ra của bạn ăn gấp rưỡi biến động giá — lãi lẫn lỗ.' },
  tung_tin: { ten: 'TUNG TIN', luat: `Đầu màn minigame được gài một tin giả (phí ${pc(PHI_GAI_BP)} vốn màn): đám đông nhảy theo đẩy giá tạm rồi tan.` },
  // ── D498 — RẢI LỆNH ba cấp (độc quyền Cá Mập · Đội Lái · Tổ Chức; lấy một cấp thì thôi thấy cấp khác) ──
  // D506 — cú đẩy còn nhẹ đi 1/√n (`raiNhe`): đúng phép chia của server (`khop.ts` `dayLenh`).
  rai_lenh_2: { ten: 'RẢI LỆNH ·2', luat: `Trong màn minigame, cú đẩy/bơm giá của chính lệnh bạn trải ra ${RAI_LENH_NEN.rai_lenh_2} nến và nhẹ đi còn ${raiNhe(RAI_LENH_NEN.rai_lenh_2!)}% — khớp êm hơn.`, doi: 'Chia lệnh lớn thành nhiều lệnh nhỏ đặt rải trong ngày để không tự làm giá chạy.' },
  rai_lenh_3: { ten: 'RẢI LỆNH ·3', luat: `Trong màn minigame, cú đẩy/bơm giá của chính lệnh bạn trải ra ${RAI_LENH_NEN.rai_lenh_3} nến và nhẹ đi còn ${raiNhe(RAI_LENH_NEN.rai_lenh_3!)}% — khớp êm hơn nữa.`, doi: 'Chia lệnh lớn thành nhiều lệnh nhỏ đặt rải trong ngày để không tự làm giá chạy.' },
  rai_lenh_5: { ten: 'RẢI LỆNH ·5', luat: `Trong màn minigame, cú đẩy/bơm giá của chính lệnh bạn trải ra ${RAI_LENH_NEN.rai_lenh_5} nến và nhẹ đi còn ${raiNhe(RAI_LENH_NEN.rai_lenh_5!)}% — gần như không tự làm giá chạy.`, doi: 'Thuật toán chia lệnh (TWAP/VWAP) của tổ chức: rải lệnh theo thời gian để giá khớp sát giá bình quân.' },
  // ── D528 — khoá v59: KÊ LỆNH (Tổ Chức mang sẵn; vai khác cuộn ở chợ) · TÂM LÝ YẾU (thay KỶ LUẬT) · SOI VAI (vai ghế khác bị giấu) ──
  ke_mua: { ten: 'KÊ MUA', luat: 'Trong màn minigame, đặt sẵn một lệnh mua ở mức giá dưới giá đang chạy: giá chạm là khớp trọn đúng giá ấy, không trượt. Đòn Bẩy mở ký quỹ, Bán Khống mua lại.', doi: 'Lệnh giới hạn (LO) của nhà đầu tư đặt sẵn ở vùng giá muốn mua, không ngồi canh bảng.' },
  ke_ban: { ten: 'KÊ BÁN', luat: 'Trong màn minigame, đặt sẵn một lệnh bán ở mức giá trên giá đang chạy: giá chạm là khớp trọn đúng giá ấy — chốt phần đang cầm, bán khoản đang giữ, hoặc mở khống.', doi: 'Lệnh chốt lời đặt sẵn ở đỉnh mình kỳ vọng — kỷ luật của người không muốn ôm qua đỉnh.' },
  tam_ly_yeu: { ten: 'TÂM LÝ YẾU', luat: `Trong màn minigame, lãi lỗ chạm −${pc(TAM_LY_YEU.NGUONG_BP)} vốn màn thì tự bán tháo ${pc(TAM_LY_YEU.BAN_BP)} phần đang cầm (kể cả khoản đang giữ), một lần mỗi màn, ở giá thị trường.`, doi: 'Hoảng loạn bán khi giá rơi sâu — thường bán đúng gần đáy.' },
  soi_vai: { ten: 'SOI VAI', luat: 'Thấy vai của mọi ghế trong trận (người khác đều bị giấu vai).', doi: 'Biết đối diện là cá nhân hay tổ chức thay đổi cách đọc một cú đẩy giá.' },
};

/** Tên vai trên chip "GHIM THEO VAI …" của cặp độc quyền. */
export const TEN_VAI_TRAIT: Readonly<Record<string, string>> = {
  ca_map: 'CÁ MẬP', doi_lai: 'ĐỘI LÁI', to_chuc: 'TỔ CHỨC',
};

/** Điểm có dấu để in lên huy hiệu ("+2" / "−2"). */
export function diemChu(id: TraitId): string {
  const t = TRAIT.find((x) => x.id === id);
  if (!t) return '';
  const d = diemCoDau(t);
  return d > 0 ? `+${d}` : `−${Math.abs(d)}`;
}

export function loaiCua(id: TraitId): 'tai' | 'tat' | 'vai' {
  const t = TRAIT.find((x) => x.id === id);
  if (!t) return 'tai';
  return t.vai ? 'vai' : t.loai;
}

/** Họ màu của lá: TÀI xanh / TẬT đỏ — cặp của vai tô theo TÍNH CHẤT của chính nó (luật màu của demo). */
export function hoMau(id: string): 'tai' | 'tat' {
  return TRAIT.find((x) => x.id === id)?.loai ?? 'tai';
}

/** Vai sở hữu cặp độc quyền (vắng = lá kho chung). */
export function vaiCua(id: string): string | undefined {
  return TRAIT.find((x) => x.id === id)?.vai;
}

/**
 * D474 — chữ của trait mà KHUNG MINIGAME (khoá v57) đã đổi nghĩa trong code. Chỉ đè khi trận mang cờ (`useKhungMinigame`); thiếu ⇒ câu cũ.
 * ⚠ Không thêm lá nào ở đây trước khi engine đổi nghĩa nó — câu trên lá là lời hứa về luật đang chạy.
 */
export const TRAIT_CHU_MINIGAME: Readonly<Partial<Record<TraitId, ChuTrait>>> = {
  // D473: `tam_rong` vừa giữ thêm mã (luật cũ) vừa nâng trần lõi + mở lượt lõi thứ ba (`maxLoiCua` · `coLuotLoi`).
  tam_rong: {
    ten: 'KHẨU VỊ ĐA DẠNG',
    luat: `Giữ được ${LOI_MINIGAME.TOI_DA_KHAU_VI} lõi thay vì ${LOI_MINIGAME.TOI_DA}, có thêm lượt chọn lõi ở vòng `
      + `${vongChonChienThuat(CO_BAN_MINIGAME, false, true)[LOI_MINIGAME.TOI_DA]}, và giữ thêm ${THAM_SO.TAM_RONG_THEM_MA} mã cùng lúc.`,
    doi: 'Người thích thử nhiều kiểu chơi cùng lúc: nhiều cửa hơn, mỗi cửa được ít sự chú ý hơn.',
  },
  // D486 — hai lá sống TRONG MÀN ở khung minigame (`cuaSoTrait`); tác dụng theo vòng tắt. Không hứa "thấy trước tin" (chưa có tin trong màn).
  kien_nhan: {
    ten: 'KIÊN NHẪN',
    luat: `Trong màn minigame: mọi nút khoá ${TRAIT_MAN.KIEN_NHAN_KHOA_S} giây đầu; khớp như lệnh chờ — trượt giá ×${String(TRAIT_MAN.KIEN_NHAN_TRUOT).replace('.', ',')}.`,
    doi: TRAIT_CHU.kien_nhan.doi,
  },
  nong_voi: {
    ten: 'NÓNG VỘI',
    luat: `Trong màn minigame: chỉ bấm được ${TRAIT_MAN.NONG_VOI_HAN_S} giây đầu, tới đó tự chốt; xem nến khung nhanh.`,
    doi: TRAIT_CHU.nong_voi.doi,
  },
};

export function chuTrait(id: string, khungMinigame = false): ChuTrait {
  return (khungMinigame ? TRAIT_CHU_MINIGAME[id as TraitId] : undefined)
    ?? TRAIT_CHU[id as TraitId] ?? { ten: id.toUpperCase(), luat: '' };
}

/** Tổng điểm có dấu của một danh sách id (dùng cho cái cân ở chợ). */
export function tongDiemChon(ids: readonly string[]): number {
  return ids.reduce((s, id) => {
    const t = TRAIT.find((x) => x.id === id);
    return t ? s + diemCoDau(t) : s;
  }, 0);
}

export const NHAN_DAP: Readonly<Record<string, string>> = {
  doi_bias: 'Đổi phía ôm — lửa tắt',
  doi_tay: 'Đổi tay quá lớn — lửa tắt',
  mua_duoi_muon: 'Đuổi giá muộn — vòng này không tích lửa',
};
