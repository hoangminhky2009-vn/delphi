/**
 * MINIGAME THEO LÕI — số của engine nhịp (D465, bước 3.2 kế hoạch `docs/thiet-ke-de-xuat/gameplay/kien-truc-minigame.md` §7).
 *
 * ⚠ NGUỒN CHÂN LÝ là demo đã chốt `docs/ui-ux/demo/minigame-bat-day.html` (A11.25): mọi số ở đây CHÉP NGUYÊN từ demo, và
 * `tests/minigame_dong_gia.test.ts` bắt bản server ra ĐÚNG TỪNG SỐ của dòng giá demo. Đổi một số ở đây mà không đổi demo ⇒ đỏ.
 * Mọi số PLAYTEST-TUNE (A8.2) — founder chốt qua demo (D459–D463), agent không tự đặt.
 * Điểm thẻ × mã KHÔNG chép ở đây: đọc thẳng `mtSuKien` / `mtGiaiDoan` bộ v42 trong `config/holdem.ts` (một nguồn, A11.5).
 */

/* ── TIỀN (C5: số nguyên, luôn floor) ─────────────────────────────────────────────────────────────────────────────── */

/** Hệ số lãi lỗ lõi (D479: 1 — bỏ ×2); lõi Đòn Bẩy dùng mức đòn bẩy THAY CHỖ hệ số này. */
/**
 * D482 (founder 04/10: *"Cá mập trait đòn bẩy x1.5"*) — đòn bẩy trong màn của ghế mang trait ghim ĐÒN BẨY (`don_bay_man`, cặp vai Cá mập
 * dưới cờ `traitGhimMinigame`): khoản theo lệnh nhân hệ số này (lỗ có trần = cả khoản). "Giữ suốt" vẫn ×1 — không bấm thì không đòn bẩy.
 */
export const HE_DON_BAY_VAI = 1.5;
/**
 * D482/D483 — TUNG TIN của Đội lái (demo `PHI_GAI_BP` · `GAI_MAG`): gài một tin giả đầu màn mất `PHI_GAI_BP` vốn màn; đám đông nhảy theo
 * đẩy giá TẠM `GAI_MAG` × hệ số thanh khoản rồi tan hết. PLAYTEST-TUNE (A8.2) — số chép nguyên từ demo đã chốt.
 */
export const PHI_GAI_BP = 300;
export const GAI_MAG = 0.03;
/** D483 — nút gài tin (TUNG TIN) trước màn: tin TỐT ▲ / tin XẤU ▼. Ghi ở nhịp −1 như chọn lá; cú đầu tiên có hiệu lực. */
export const NUT_GAI = { gai_tot: 1, gai_xau: -1 } as const;
/** D484 — BẢNG PHỤ (demo `lapBangPhu`): bước ngẫu nhiên của mã khác đang cầm = nhiễu của mã × hệ số này mỗi nhịp, rồi nghiêng về % của vòng. */
export const PHU_NHIEU_X = 0.55;
/**
 * D487 → D491 — TƯƠNG QUAN THEO CẶP trên bảng phụ (founder 04/10: bảng phản ứng theo cặp; rồi *"Đừng cho mọi thứ khớp nhau 1-1"* + quy tắc từng cặp;
 * demo bản 33 `CAP_TQ`). Theo GIÁ (`tpcp` là GIÁ trái phiếu Mỹ — lợi suất tăng = giá giảm). Tham số dạng khoảng bốc theo seed của vòng.
 *   khuech_dai  VN30 → CP CK: lên ×len, xuống ×xuong (hoảng loạn F0 mạnh hơn hưng phấn) · bat_on TP → Vàng: ρ nền + lệch theo vòng, thẻ trú ẩn ⇒ ρ âm
 *   nguong      TP → VN30/CP: trơ 6–10 nến, cú lắc dồn vào bồn, vượt ngưỡng ⇒ SẬP BÙ trong `xa` nến · that_thuong TP → Crypto: ρ ngẫu nhiên, crypto nhạy ×nhay
 *   tuyen_tinh  Crypto → USDT: ρ cố định.
 * Cặp không có ở đây ⇒ ρ = β·β của engine theo ô vòng, trễ 0. PLAYTEST-TUNE (A8.2; founder giao agent chốt 04/10).
 */
export type KieuTuongQuan = 'tuyen_tinh' | 'khuech_dai' | 'bat_on' | 'that_thuong' | 'nguong';
export interface CapTuongQuan {
  dan: string; theo: string; kieu: KieuTuongQuan;
  rho?: number | readonly [number, number]; tre?: number | readonly [number, number];
  len?: readonly [number, number]; xuong?: readonly [number, number];
  lech?: readonly [number, number]; soHai?: Readonly<Record<string, number>>;
  nhay?: number; nguong?: number; xa?: readonly [number, number]; boi?: number;
}
export const TUONG_QUAN_CAP: readonly CapTuongQuan[] = [
  { dan: 'btc', theo: 'usd', kieu: 'tuyen_tinh', rho: -0.6, tre: 0 },
  { dan: 'vn30', theo: 'cp_cn', kieu: 'khuech_dai', len: [2, 3], xuong: [3, 3.5], tre: 1 },
  { dan: 'tpcp', theo: 'vang', kieu: 'bat_on', rho: 0.6, lech: [-0.9, 0.2], soHai: { chien_tranh: -0.5, lam_phat: -0.4, cam_van: -0.4, dich_benh: -0.2 }, tre: 1 },
  { dan: 'tpcp', theo: 'btc', kieu: 'that_thuong', rho: [-0.2, 0.7], nhay: 1.6, tre: [2, 4] },
  { dan: 'tpcp', theo: 'vn30', kieu: 'nguong', rho: 0.5, nguong: 0.008, xa: [2, 3] },
  { dan: 'tpcp', theo: 'cp_cn', kieu: 'nguong', rho: 0.45, nguong: 0.015, xa: [2, 3], boi: 2.5 },
];
/** D491 — số nến TRƠ giữa hai cú sập bù (kiểu `nguong`): TRO_TU + ⌊rng × TRO_KHOANG⌋. */
export const TRO_TU = 6, TRO_KHOANG = 5;
/**
 * D486 — TRAIT TRONG MÀN (demo `TR`, D471 · D478). KIÊN NHẪN: mọi nút khoá `KIEN_NHAN_KHOA_S` giây đầu màn chạy, khớp như lệnh chờ — trượt
 * × `KIEN_NHAN_TRUOT`. NÓNG VỘI: chỉ bấm được `NONG_VOI_HAN_S` giây đầu (founder 04/10: *"tăng thời gian cho nóng vội lên thành 1 nửa bảng"*),
 * tới mốc đó TỰ CHỐT (trắng ⇒ trượt ×`TRUOT_KHOA_CUOI`), và xem nến khung nhanh (khớp "trắng" theo nến mịn). PLAYTEST-TUNE (A8.2).
 * ⚠ Phần "Kiên Nhẫn thấy trước tin" của demo CHƯA có: app chưa có tin trong màn (bước 4 #2) — không hứa trên chữ trait.
 */
export const TRAIT_MAN = { KIEN_NHAN_KHOA_S: 10, KIEN_NHAN_TRUOT: 0.5, NONG_VOI_HAN_S: 17 } as const;
export const HE_SO_LOI = 1;   // D479 (founder 2A): bỏ ×2 — lõi chỉ là CHỌN THỜI ĐIỂM, vào/ra ăn đúng % giá
/** Mức đòn bẩy của lõi Đòn Bẩy (founder 03/10). */
export const MUC_DON_BAY = [2, 4, 10] as const;
/**
 * TRAIT ĐÒN BẨY (D462): nhân lãi lỗ các lõi KHÁC (không áp lõi Đòn Bẩy — founder: "có lõi đòn bẩy rồi mà pick trait đòn bẩy thì sẽ chỉ hiện của
 * lõi đòn bẩy thôi"). Giá theo cơ chế điểm của trait. Phần vượt hệ số lõi là phần VAY.
 */
export const TRAIT_DON_BAY = { 1.5: { diem: 2 }, 2: { diem: 4 }, 3: { diem: 5 } } as const;
/** Phí Lướt Sóng mỗi lần khớp (bp); ĐẢO = 2 lần khớp (D462: 30 → 45). */
export const PHI_LS_BP = 45;
/** Lướt Sóng trượt giá ×1,25 mỗi lần khớp (D462). */
export const TRUOT_LS = 1.25;
/**
 * D532 — Lướt Sóng MUA TIN SỚM trước màn = 2 % vốn màn (demo `PHI_TIN_SOM_BP`, "bù bảng điện tử"): biết trước những tin THẬT sẽ ra trong màn (không
 * biết thứ tự), trong màn mỗi tin mang dấu THẬT / NHIỄU. Trừ vào lãi lỗ màn ở mọi nhánh (như phí gài tin). PLAYTEST-TUNE (số nháp của demo).
 */
export const PHI_TIN_SOM_BP = 200;
/**
 * LÃI VAY theo thị trường (D463, founder chọn B): tính trên SỐ VAY, mức quy về "×10 giữ trọn màn mất X% khoản" ⇒ mỗi màn
 * X%/9 của số vay, cộng dồn theo nến gốc. Thẻ tăng hoặc sức căng RẤT CĂNG ⇒ NÓNG; CĂNG; còn lại ẢM ĐẠM.
 */
export const LAI_VAY_PCT = { NONG: 15, CANG: 12, AM_DAM: 9 } as const;
/** Mức % ở trên quy về khoản vay của ×10 = 9 lần khoản. */
export const LAI_VAY_QUY_VE_VAY = 9;
/** Số nến gốc của một màn chạy (34 s). */
export const NEN_GOC = 30;
/** Bán mạnh trượt sâu (D462): × (1 + THEO_HE × phần vượt hệ số lõi); thanh lý thêm × THANH_LY. */
export const BAN_MANH = { THEO_HE: 0.1, THANH_LY: 1.5 } as const;
/** Ký quỹ: vốn còn ≤ GOI × ký quỹ ⇒ gọi; ≤ THANH_LY × ký quỹ ⇒ thanh lý. */
export const KY_QUY = { GOI: 0.5, THANH_LY: 0.1 } as const;

/** Sai số làm tròn của số thực TRƯỚC khi floor — tránh 1999,9999999 ⇒ 1999 khi đúng ra là 2.000. Không đổi kết quả của số đã có phần lẻ thật. */
export const EPS_TIEN = 1e-9;

/* ── DÒNG GIÁ (chép nguyên demo; `tests/minigame_dong_gia.test.ts` khớp từng số) ───────────────────────────────────── */

/** Nến lịch sử trước màn (theo nến gốc); dòng mịn dựng ở độ mịn K_MIN = 2 ⇒ 20 nến lịch sử + 60 nến chạy. */
export const NEN_LS = 10;
export const K_MIN = 2;
/**
 * Tham số giá theo mã (demo `MA`): biên độ hình · nhiễu · trượt (bp) · ngưỡng trắng · hệ số thanh khoản. Đủ sáu mã của engine (D467).
 * Vàng · Trái phiếu: trượt/liq/trắng theo hạng thanh khoản engine (VỪA, như CP); amp · nhiễu NỘI SUY giữa hai mã cũ kề nhau theo độ giật
 * ngày THẬT 2016→nay (không theo `bien_dong_bp` của engine — engine thổi phồng mã phòng thủ, xem D467).
 */
export interface ThamSoMa {
  amp: number; nhieu: number; truot: number; trang: number; liq: number;
  /** D468 — mã PHÒNG THỦ ở thẻ SỰ KIỆN (chế độ cực đoan): amp · nhiễu theo độ giật của 5 % giai đoạn dữ nhất có thật. */
  cd?: { amp: number; nhieu: number };
  /** D468 — mã PHÒNG THỦ ở ô GIAI ĐOẠN (chế độ dưỡng sinh): thu biên độ hình × `bien`, nhiễu riêng. */
  ds?: { bien: number; nhieu: number };
}
export const MA_MINIGAME: Record<string, ThamSoMa> = {
  btc: { amp: 1.3, nhieu: 0.011, truot: 120, trang: 0.16, liq: 3 },
  usd: { amp: 0.55, nhieu: 0.003, truot: 15, trang: 0.14, liq: 0.6, cd: { amp: 0.65, nhieu: 0.0035 }, ds: { bien: 0.2, nhieu: 0.0005 } },
  cp_cn: { amp: 1.0, nhieu: 0.0065, truot: 50, trang: 0.14, liq: 1.5 },
  vn30: { amp: 0.7, nhieu: 0.0035, truot: 15, trang: 0.14, liq: 0.6 },
  vang: { amp: 0.65, nhieu: 0.0035, truot: 50, trang: 0.14, liq: 1.5, cd: { amp: 0.9, nhieu: 0.0055 }, ds: { bien: 0.35, nhieu: 0.002 } },
  tpcp: { amp: 0.6, nhieu: 0.003, truot: 50, trang: 0.14, liq: 1.5, cd: { amp: 0.7, nhieu: 0.0035 }, ds: { bien: 0.45, nhieu: 0.002 } },
};
/**
 * Sàn nhiễu ở độ mịn ngắn (demo `CAN.nhieuSanNgan`). D468 (founder chọn A): 0,014 → 0 — sàn nuốt nhiễu riêng của mọi mã trừ Crypto nên VN30 ·
 * USDT · Vàng · Trái phiếu có nến giống hệt. Giá phải trả đo được: Lướt Sóng trên VN30 lãi thêm ~6–7 điểm (đúng điều "sửa 5" từng chặn).
 */
export const NHIEU_SAN_NGAN = 0;
/** Hình TRẦN/BẬT TRẦN nặng hơn trên Crypto/USDT. */
export const SAN_CRYPTO: readonly string[] = ['btc', 'usd'];
/** Nến rút chân + cú quét (demo `RUT`). */
export const RUT = { CO_SO: 0.012, THEO_TK: 0.018, SAU_MIN: 0.03, SAU_THEM: 0.06, SAU_TRAN: 0.14, QUET_MIN: 0.07, QUET_THEM: 0.05 } as const;
/** Xác suất cú quét theo sức căng + thẻ (D460, demo `QUET`). */
export const QUET = {
  Q0: { btc: 0.05, cp_cn: 0.025, vn30: 0.012, usd: 0.01, vang: 0.011, tpcp: 0.011 } as Record<string, number>,
  /** D468 — nền quét của mã phòng thủ ở thẻ sự kiện (cực đoan); dưỡng sinh không có cú quét. */
  Q0_CD: { usd: 0.011, vang: 0.02, tpcp: 0.012 } as Record<string, number>, A_S: 5, A_T: 1.5, TRAN: 0.6, VUNG_CHET: 300, CHIA: 1200,
  L_LOP: { truoc: 0.25, no: 1 } as Record<string, number>, L_DU: [0, 0.5, 0.25, 0] as readonly number[],
  S_DAI: { em: 500, cang: 2800, rat: 5200 }, LEN_DAI: { em: 0, cang: 8, rat: 16 },
  DAI_MAP: { btc: [0.51, 0.27, 0.22], cp_cn: [0.57, 0.26, 0.17], vn30: [0.65, 0.23, 0.12], usd: [1, 0, 0], vang: [1, 0, 0], tpcp: [1, 0, 0] } as Record<string, readonly number[]>,
} as const;
/** Nhịp điều chỉnh + rũ mạnh của xu hướng dài (D462, demo `NHIP`). */
export const NHIP = { SO_MIN: 1, SO_MAX: 2, SAU_MIN: 1.5, HOI_MIN: 0.2, HOI_THEM: 0.2, RU_THEO_TANG: 1, RU_TRAN: 0.4, RU_SAU_MIN: 0.1, RU_SAU_THEM: 0.06 } as const;
/** Hình hồi kỹ thuật — ưu tiên ×3 ở lớp DƯ ÂM. */
export const HOI: ReadonlySet<string> = new Set(['meo_chet_nay', 'bay_hoi_gay_nen', 'hoi_ky_thuat', 'xuong_roi_hoi', 'thung_gia', 'ru_chu_v', 'ru_roi_tang', 'day_kep']);
/** Họ hình theo nhóm thẻ (D460 bộ B, D463 thêm biến động). Thứ tự khoá GIỮ NGUYÊN — bốc ngẫu nhiên đi theo thứ tự. */
export const HO_HINH: Record<string, Record<string, readonly string[]>> = {
  giam: { thang: ['roi_mot_chieu', 'meo_chet_nay', 'sap_gap', 'bay_hoi_gay_nen', 'song_xuong', 'truot_doc', 'roi_deu'],
    nguoc: ['parabol_sap', 'bom_xa', 'ep_roi_sap', 'hoi_ky_thuat'], bay: ['xuong_roi_hoi'], song: ['giat_hai_dau'] },
  tang: { thang: ['bo_len_ben', 'hai_nhip', 'dinh_tham', 'rung_nhe_roi_bung', 'tran_lien_tiep', 'tich_luy_but_pha', 'song_len', 'leo_doc', 'ep_khong_dung'],
    nguoc: ['ru_chu_v', 'day_kep', 'bat_tran_v', 'ru_roi_tang', 'rung_cay'], bay: ['parabol_sap', 'bay_vuot_dinh', 'dinh_phan_phoi'], song: ['giat_hai_dau'] },
  ngang: { song: ['song_hai_chieu', 'giat_hai_dau', 'quet_hai_dau', 'song_ngang'], bay: ['pha_nen_gia', 'bay_vuot_dinh', 'thung_gia', 'day_kep'],
    but: ['tich_luy_but_pha', 'dinh_phan_phoi'] },
  bien_dong: { du: ['song_du', 'quay_dau_lien', 'bien_rong', 'no_hai_chieu'], giat: ['song_hai_chieu', 'giat_hai_dau', 'quet_hai_dau'] },
};
/** D468 — hình ĐI ĐỀU cho mã phòng thủ ở chế độ dưỡng sinh (founder: "như dưỡng sinh thôi nhưng tăng/giảm đều đều"). */
export const HO_DUONG_SINH: Record<'tang' | 'giam' | 'ngang', readonly string[]> = {
  tang: ['bo_len_ben', 'song_len', 'leo_doc'], giam: ['roi_deu', 'song_xuong', 'truot_doc'], ngang: ['song_hai_chieu'],
};
/**
 * D469 — KỊCH BẢN ĐẶC THÙ theo cặp `thẻ|mã`, lá NỔ: dáng của MỘT đợt thật đã đo (giá ngày công khai) thay cho bốc ngẫu nhiên. Chỉ cặp có sự kiện
 * thật đứng sau (founder 04/10: "sợ bị bảo là game dạy linh tinh"). Số đo từng đợt: `docs/nhat-ky/D469.md`. NHÁP (A8.2).
 */
export const DAC_THU: Readonly<Record<string, string>> = {
  'thien_nga_den|vang': 'ru_chu_v',      // Covid 2020: −10,2 % tới 16/03 rồi +9,8 % tới 14/04
  'thien_nga_den|tpcp': 'parabol_sap',   // Covid 2020: +22,5 % tới 09/03 rồi về −5,2 % tới 18/03
  'tang_lai_suat|tpcp': 'truot_doc',     // Fed 2022: −30,8 %, đỉnh chỉ +0,5 %
  'tang_lai_suat|usd': 'bo_len_ben',     // 2022: USD/VND lên từng bậc theo tháng, +8,7 %
  'hack_san|usd': 'xuong_roi_hoi',       // USDT lệch neo 05/2022 −5,1 % · 10/2018 −6,9 % rồi về neo
  'hack_san|btc': 'sap_gap',             // FTX 11/2022: −26,7 %, đỉnh chỉ +0,8 %
};
export const HON_HOP: Record<string, Record<string, number>> = {
  giam: { thang: 0.5, nguoc: 0.3, bay: 0.12, song: 0.08 }, tang: { thang: 0.5, nguoc: 0.3, bay: 0.12, song: 0.08 },
  ngang: { song: 0.4, bay: 0.4, but: 0.2 }, bien_dong: { du: 0.7, giat: 0.3 },
};
/** Thẻ → kịch bản map (D458): ngưỡng nhóm ±300 · |điểm|/1.200 kẹp 0,5–2 · nghiêng TRƯỚC 3% · giật TRƯỚC biến động ×1,5 · DƯ ÂM ½ mỗi vòng, sàn 0,3. */
export const KICH_BAN = { NGUONG: 300, CHIA: 1200, GOC_MIN: 0.5, GOC_MAX: 2, NGHIENG: 0.03, NHIEU_BIEN_DONG: 1.5, DU_SAN: 0.3 } as const;

/* ── MÀN CHẠY TRÊN SERVER (D466, bước 3.3) ──────────────────────────────────────────────────────────────────────────── */

/**
 * PHIÊN BẢN DÒNG GIÁ của màn — ghi vào từng dòng `holdem_minigame_man` (A11.19: `<miền>-v<N>-<biệt danh>`, không D-số). Đổi
 * `dungDongMin` hay bộ số trên theo cách làm màn cũ dựng lại ra giá khác ⇒ THÊM giá trị mới, dòng cũ giữ chuỗi cũ.
 */
export const MINIGAME_DONG_GIA_VERSION = 'minigame-v3-neo';   // D479: điểm cuối neo % engine (v2 = D468 dưỡng sinh, chưa từng lên prod)   // v1 (D466) chưa từng lên prod; D468 đổi dòng giá ⇒ v2
/** Nến mịn mỗi nến gốc × nến gốc × 8 mốc giá mỗi nến mịn = 480 nhịp trong 34 s chạy. */
export const NHIP_MOI_NEN = 8;
export const SO_NHIP = K_MIN * NEN_GOC * NHIP_MOI_NEN;
/**
 * Lệnh khớp ở giá của nhịp người chơi ĐANG THẤY, nhận nếu nhịp đó cách nhịp máy ≤ cửa sổ này. ⚠ "Cửa sổ 2 nhịp" của kế hoạch §5 là
 * 2 NHỊP PHÁT (mỗi giây một lô), không phải 2 nhịp giá (71 ms) — xem D466. Rộng hơn = mạng yếu ít bị từ chối, nhưng người chơi
 * được khớp ở giá cũ hơn trong khi đã thấy thêm từng ấy giây ⇒ lợi thế nhìn trước. // PLAYTEST-TUNE (đo tỷ lệ từ chối ở buổi test)
 */
export const CUA_SO_LENH_MS = 2000;
/** Dòng phát gửi một lô nhịp mỗi chừng này (D464 đo: 40 dòng/1 s đủ 40/40 cả trên 3G yếu). */
export const LO_NHIP_MS = 1000;
/** Một dòng phát tự đóng sau chừng này dù màn chưa hết — chặn function treo (`maxDuration` 60 s, D464). Client nối lại bằng `?tu=`. */
export const DONG_TOI_DA_MS = 45_000;
/** Trần cú bấm ghi nhận mỗi màn — chống spam thô (Lướt Sóng bấm dày nhất trong demo < 40 cú/màn); luật thật nằm ở lõi (bước 4). */
export const TRAN_LENH_MOI_MAN = 120;

/* ── LÕI TRONG MÀN (D475, bước 4 #1) ─────────────────────────────────────────────────────────────────────────────────── */

/** Số nhịp giá trong một nến XEM của khung thường (nến gộp đôi của demo `gopHaiNen`): 2 nến mịn × 8 nhịp. */
export const NHIP_MOI_NEN_GOP = K_MIN * NHIP_MOI_NEN;
/** Nút của từng lõi — server chỉ nhận đúng những mã nút này (demo `LOI[...].nut`). Lõi chưa có trong bảng: màn chỉ để xem, lãi lỗ 0. */
/**
 * D586 — SỐ LẦN BÁN BỚT để bán hết khoản giữ (khoá v69; founder 11/10 chọn "2 / 3 / 4 lần"): mỗi cú = khoản ban đầu ÷ số lần, cú cuối bán nốt.
 * Không Rải lệnh 2 lần (50 %) · Rải lệnh 2 → 3 lần · Rải lệnh 3 → 4 lần · Rải lệnh 5 → 4 lần (founder 11/10: "4 lần" — trần 4; cấp 5 hơn cấp 3 ở
 * phần chia nhỏ cú tự đẩy, không ở số lần). Đo: số lần gần như không đổi chi phí bán (cá mập 100k: 4 lần −642 · 6 lần −625). ⚠ A8.2 — PLAYTEST-TUNE.
 */
export const BAN_BOT_LAN: { KHONG_RAI: number; THEO_RAI: Readonly<Record<number, number>> } = { KHONG_RAI: 2, THEO_RAI: { 2: 3, 3: 4, 5: 4 } };
/**
 * D589 — khoá v70 (`baPhan`, founder 11/10): VÀO chia 3 PHẦN theo tỉ lệ (phần /6 vốn màn; phần cuối = tiền còn) — Mua Đuổi 3 : 2 : 1 ("lệnh sau nhỏ
 * hơn lệnh trước"), Bắt Đáy 1 : 2 : 3 ("ngược lại" — gom bình quân giá xuống). Founder chọn B (3:2:1) thay A (50 · 30 · 20). PLAYTEST-TUNE (A8.2).
 */
export const TI_LE_PHAN: Readonly<Record<string, readonly [number, number, number]>> = { mua_duoi: [3, 2, 1], bat_day: [1, 2, 3] };
/**
 * D589 — nút của khoá v70: Mua Đuổi VÀO (nhồi 3 phần; đủ 3 thì CHÍNH ô ấy đổi thành ×2 — client) · ×2 (`vay_x2`) · CHỐT (lần 1 nửa, lần 2 hết — gộp
 * CHỐT NỬA / CHỐT HẾT); Bắt Đáy VÀO (gom 3 phần) · THOÁT. BÁN BỚT ghép thêm ở `nutLoiCua`.
 */
export const NUT_LOI_BA_PHAN: Readonly<Record<string, readonly string[]>> = { mua_duoi: ['vao', 'vay_x2', 'chot'], bat_day: ['vao', 'thoat'] };
export const NUT_LOI: Readonly<Record<string, readonly string[]>> = {
  bat_day: ['vao_nua', 'vao_het', 'thoat'],
  // D511 — MUA ĐUỔI (demo `LOI.mua_duoi`): VÀO/NHỒI tối đa 3 phần (1/3 · 1/3 · phần còn lại; trượt ×(1 + 0,25 × chuỗi nến xanh)) · CHỐT NỬA · CHỐT HẾT.
  mua_duoi: ['vao', 'chot_nua', 'chot_het'],
  // D492 — ĐÒN BẨY (demo `LOI.don_bay`): VÀO ×L · TĂNG lên mức kế · NẠP từ một khoản khác (`nap_<mã>`) · BÁN HẾT (đang bị gọi) · CHỐT.
  don_bay: ['vao_x2', 'vao_x4', 'vao_x10', 'tang_x4', 'tang_x10', 'ban_het', 'chot', 'nap_btc', 'nap_usd', 'nap_cp_cn', 'nap_vn30', 'nap_vang', 'nap_tpcp', 'nap_tien'],   // D507 — Tiền mặt nạp được (phí 0)
  // D510 — BÁN KHỐNG = ĐÒN BẨY CHIỀU BÁN (founder 05/10; demo bản 41 `nutKyQuy(-1)`): BÁN ×L · TĂNG · DỒN HẾT (`ban_het`, khi bị gọi) · MUA LẠI · nạp.
  ban_khong: ['ban_x2', 'ban_x4', 'ban_x10', 'tang_x4', 'tang_x10', 'ban_het', 'mua_lai', 'nap_btc', 'nap_usd', 'nap_cp_cn', 'nap_vn30', 'nap_vang', 'nap_tpcp', 'nap_tien'],
  // D531 — LƯỚT SÓNG (demo `LOI.luot_song`, founder: "lướt sóng ở demo như nào thì làm như thế"): `dao` = SHORT khi đang không cầm · ĐẢO sang chiều
  // kia khi đang cầm (đảo trọn 100 % vị thế) · `chot` = về tiền mặt. CHỈ chạy ở khoá `loiChiTrongMan` (v60) — khoá cũ: Lướt Sóng chỉ xem như trước.
  luot_song: ['dao', 'chot'],
};
/**
 * D492 — NẠP THÊM của lõi Đòn Bẩy (demo `nap`): mỗi cú lấy `NAP_TY_LE` × vốn màn từ MỘT khoản khác (demo 1.000 trên vốn 4.960 ≈ 0,2), chịu phí bán
 * = trượt của mã nạp + `PHI_BAN_BP`. Phần nhận vào ký quỹ. Chỉ nhận sau khi đã bị GỌI ít nhất một lần (demo: hộp NẠP chỉ mở khi bị gọi). PLAYTEST-TUNE.
 */
export const NAP_TY_LE = 0.2;
/**
 * D528 — KÊ LỆNH (trait KÊ MUA / KÊ BÁN, cờ `keLenhV59`): cú đặt / dời `ke_mua` · `ke_ban` (kèm `gia_bp` so với giá mở màn, `L` cho lệnh mở ký quỹ),
 * cú huỷ `ke_huy_mua` · `ke_huy_ban`. Không thuộc bảng nút của lõi nào — trait đi với mọi lõi (và cả khi không cầm lõi).
 */
export const NUT_KE = ['ke_mua', 'ke_ban', 'ke_huy_mua', 'ke_huy_ban'] as const;
/** D528 — giá lệnh kê cách giá mở màn tối đa ±TRAN_BP (chặn số rác; khung đồ thị không bao giờ rộng tới vậy). */
export const KE_LENH = { TRAN_BP: 5000 } as const;
export const PHI_BAN_BP = 20;
/**
 * D494 — THANH LÝ DÂY CHUYỀN (demo bản 32 `TL_DAY` · `datBot`; founder 04/10: "Làm cả thanh lý dây chuyền", "2 đám đông thì hơi ít, phải từ 3-4 trở lên",
 * "còn lại bạn tự chốt"). Bán cưỡng bức đẩy giá TẠM: −MAG × thanh khoản × min(TRAN, tiền × L / CHUAN) (tiền theo bội vốn chuẩn), trải 1 nến gốc, tan
 * hết sau TAN nến gốc. Đám đông: cá mập ×4 tiền 3 + SO_TU…SO_TU+SO_THEM−1 người tiền 0,6, ×10/×5 xen kẽ, vào rải theo seed. Cú bán phải tan hết
 * trước cuối màn cả ở mã đi sau (BIEN_CUOI nến gốc ≥ trễ lớn nhất của bảng phụ) — điểm cuối giữ % engine. PLAYTEST-TUNE (A8.2).
 */
/**
 * D498/D499 — TỔ CHỨC dưới cờ `toChucV57` (founder 04/10; demo bản 34 `TO_CHUC`): không margin · TRẦN THUA trong màn (phần vốn màn, chạm là tự chốt
 * đúng giá trần) · đền bù: KHỚP THỎA THUẬN trong nến trắng (trượt ×TRUOT_THOA_THUAN) · PHÍ QUẢN LÝ mỗi vòng (bp NAV) · BÀN NGHIÊN CỨU (số mô phỏng ·
 * số khúc thời gian). Trần −8 % founder chốt; còn lại agent đề xuất, founder nhận "cả 3". PLAYTEST-TUNE (A8.2).
 */
/**
 * D499 — TỰ ĐẨY GIÁ của chính lệnh trong màn (demo `heSoDay` · `tuDay` · `lechLuc` nhánh không-tạm): hệ số đẩy = CO_SO × VAI[vai] × thanh khoản mã;
 * cú đẩy để lại O_LAI vĩnh viễn, phần còn lại tan trong TAN_NHIP nhịp (4 nến gộp). Cá nhân không đẩy. Số chép demo — PLAYTEST-TUNE (A8.2).
 * D506 (founder 04/10: "tăng vốn … cân bằng lại tỷ lệ đẩy giá" → "cứ như ngoài đời thôi, cân bằng lại cho phù hợp game") — cú đẩy theo QUY MÔ TUYỆT
 * ĐỐI, căn bậc hai như tác động giá ngoài đời: mag = hệ số × √(giá trị lệnh / VON_CHUAN) (÷ √n khi Rải lệnh n nến). VON_CHUAN = vốn đầu một nhà đầu tư
 * cá nhân. CO_SO 0,0014: Cá Mập vào hết 100.000 Crypto ×1 đẩy ~2 % (trước: 6,75 % bất kể vốn; ×10: 67 % ⇒ thanh lý gần chắc).
 * Trước D506: CO_SO 0,03 (D499) → 0,015 (D502) theo công thức × tiền/vốn màn.
 */
/** D511 — MUA ĐUỔI: trượt khi vào × (1 + TRUOT_THEO_CHUOI × số nến xanh liền nhau) — số chép demo `truotVao` (PLAYTEST-TUNE). */
export const MUA_DUOI = { TRUOT_THEO_CHUOI: 0.25 } as const;
export const TU_DAY = { CO_SO: 0.0014, VON_CHUAN: 10000,
  VAI: { ca_nhan: 0, doi_lai: 1.3, ca_map: 1.5, to_chuc: 0.75 } as Readonly<Record<string, number>>, O_LAI: 0.3, TAN_NHIP: 64 } as const;
/**
 * D520 (founder 05/10: "xác suất phản ánh hơi bịp" · "Chứ > 70% thì bá quá") — bàn nghiên cứu chỉ biết THẺ: mỗi mô phỏng neo về giá cuối thật LỆCH
 * chuẩn × (NC_LECH_TY_LE × |bp| + NC_LECH_SAN_BP) — biết hướng và cỡ phỏng chừng, không biết kết quả; ô kẹp NC_TRAN. PLAYTEST-TUNE (A8.2).
 */
export const TO_CHUC_V57 = { TRAN_THUA_BP: 800, TRUOT_THOA_THUAN: 1.5, PHI_QL_BP: 30, NC_SO_MO_PHONG: 80, NC_SO_CUA: 6,
  NC_LECH_TY_LE: 0.6, NC_LECH_SAN_BP: 300, NC_TRAN: 0.67 } as const;   // D522 — trần 67 % (founder)
/**
 * D523 (founder 05/10: "Cái vạch của bắt đáy vô dụng thế, nhái bán khống à? … giống các chỉ số ngoài đời hay được dùng để đoán đáy" → "A chính, B phụ
 * (Nhãn quá bán …). Đồng thời dải kia chỉ tương đối vì có những trường hợp 'Phi logic' trong các trường hợp cực đoan"; demo bản 46 `GT`) — ĐƯỜNG GIÁ TRỊ
 * của Bắt Đáy: giá trị NỀN ẩn của kịch bản (`NenMin.gt`), TRỄ `TRE` nến hiện (cực đoan `TRE_CD`) + sai số ±`SAI`; dải dưới `DAI` × biên độ mã (cực đoan
 * × `DAI_CD`). Nhãn QUÁ BÁN: cao trào cuối sóng giảm `QB_DUNG`; nhãn NHẦM `QB_NHAM` ở nến đỏ do tin hoặc nến đỏ đóng đáy mới so với 3 nến trước (như quá
 * bán ngoài đời). Đo 1.800 màn, lệnh thật: vào sau nhãn đầu, giữ tới cuối ⇒ thắng giữ suốt 63 %, lãi màn TB +1,5 % (QB_NHAM 0,5 ⇒ 86 %, 0,1 ⇒ 60 %). PLAYTEST-TUNE.
 */
export const GIA_TRI = { TRE: 2, TRE_CD: 3, SAI: 0.003, DAI: 0.012, DAI_CD: 1.6, QB_DUNG: 0.8, QB_NHAM: 0.06 } as const;
export const TL_DAY = { MAG: 0.01, CHUAN: 10, TRAN: 3, TAN: 4, BIEN_CUOI: 4,
  /**
   * D521 (founder 05/10 chọn 1 + 2 + "nerf bộ tính %" · "Mập mờ hơn chứ ko phải lừa xác suất") — màn có `thac_v2`: mỗi cú thanh lý (1) để lại CON_LAI
   * phần vĩnh viễn tới hết màn (bán tháo để lại vết — giá cuối màn lệch khỏi % vòng đúng phần này); (2) cỡ ngẫu nhiên ×[CO_TU, CO_DEN] (ẩn); lệnh VÀO
   * ngược dòng cưỡng bức trượt thêm TRUOT_THAC × độ sâu cú thác đang đè; vạch soi báo khoảng SOI_TU–SOI_DEN (phân vị) của SOI_SO lần rút. PLAYTEST-TUNE.
   */
  CON_LAI: 0.4, CO_TU: 0.5, CO_DEN: 1.5, TRUOT_THAC: 0.5, SOI_SO: 64, SOI_TU: 0.1, SOI_DEN: 0.9 } as const;
/**
 * D512 — ĐÁM ĐÔNG NỀN (demo bản 41 `datBot`; founder chốt "chuỗi săn" + đám đông nền): luôn có người vay mua và người bán khống trên mọi màn. Số người
 * theo hướng ô (ô tăng đông phe mua, ô giảm đông phe khống), mỗi người TIEN vốn chuẩn, đòn bẩy ×10/×5 xen kẽ, vào rải từ nến VAO_TU (bước VAO_BUOC).
 * Agent tự chốt — PLAYTEST-TUNE (A8.2).
 */
/**
 * D517 — BẦY CÁ NHÂN (founder 05/10 chọn B "nhưng hệ số thấp hơn"; "Bot cá nhân ko được tính ư mà phải đợi người thật?"): mỗi Cá nhân không tự đẩy
 * giá, nhưng cả bầy đuổi theo chuỗi nến — đủ CHUOI nến hiện liền cùng màu thì bầy vào CÙNG chiều ⇒ một cú đẩy TẠM (dốc 1 nến hiện, tan TAN nến hiện,
 * như cú thanh lý `TL_DAY`). Cỡ bầy n = NPC Cá nhân nền + ghế Cá nhân KHÁC (bot hay người) đang giữ mã; mag = MAG × liq × min(TRAN, √(n / CHUAN)).
 * Hệ số THẤP: n 4 ⇒ 0,2 % × liq, trần 0,4 % (một cú thanh lý tới 3 %). Bản đầu 0,4 % bắn ~4,8 cú/màn, lệch giá đóng tới 3,8 % — hạ một nửa
 * theo "hệ số thấp hơn" (D517). PLAYTEST-TUNE (A8.2) — agent tự đặt, founder chốt.
 */
export const BAY_CA_NHAN = { NPC: 3, CHUOI: 3, MAG: 0.002, CHUAN: 4, TRAN: 2, TAN: 3 } as const;
/**
 * D536 (founder 06/10: *"Làm đủ như demo"*) — LỆNH LỚN của bot vai lớn CÙNG MÃ trên màn (demo `cungMap` ca_map / doi_lai · `lechLuc` nhánh không-tạm):
 * - CÁ MẬP gom ở đáy: cú KEO dốc KEO_TRAI nến hiện, bắt đầu một nến hiện sau ĐÁY của màn (trần: SAT_CUOI nến mịn trước hết màn); rồi cú XA dốc XA_TRAI
 *   nến hiện khi còn XA_TRUOC_CUOI nến hiện.
 * - ĐỘI LÁI kéo rồi xả: cú KEO dốc KEO_TRAI nến hiện ở nến hiện TU…TU + THEM − 1 (theo seed); cú XA dốc XA_TRAI nến hiện, XA_SAU nến hiện sau cú kéo; gài một
 *   tin hội nhóm "đang được gom mạnh" một nến hiện sau cú kéo (nhiễu, không đẩy giá).
 * Mỗi cú: O_LAI ở lại, phần còn lại tan trong TAN nến hiện sau khi dốc xong. Đường neo lại về % engine SAU các cú (D479 giữ điểm cuối).
 * Khối lượng nến bị đè cộng |mag| × VOL / số nến mịn trải (demo `volXung` — cùng hệ cho thanh lý, bầy, tin gài, cú tự đẩy).
 * Số chép nguyên demo đã chốt — PLAYTEST-TUNE (A8.2).
 */
export const LENH_LON_BOT = {
  CA_MAP: { KEO: 0.06, KEO_TRAI: 3, SAT_CUOI: 3, XA: -0.03, XA_TRAI: 2, XA_TRUOC_CUOI: 4 },
  DOI_LAI: { TU: 4, THEM: 4, KEO: 0.06, KEO_TRAI: 2, XA_SAU: 7, XA: -0.08, XA_TRAI: 1 },
  O_LAI: 0.3, TAN: 4, VOL: 30,
} as const;
export const DAM_DONG_NEN = { TIEN: 0.4, L: [10, 5] as const, VAO_TU: 4, VAO_BUOC: 4, VAO_THEM: 3, SO: { tang: [3, 1], giam: [1, 3], khac: [2, 2] } as const,
  /**
   * D518 (founder 05/10: "Đám đông nền sẽ 'dày hơn bình thường' ở những sự kiện bong bóng") — lớp TRƯỚC + NỔ của thẻ Bong bóng thêm [vay mua, bán
   * khống]: tiền rẻ đẻ người vay mua đổ xô. DƯ ÂM như thường (phe vay đã bị quét). PLAYTEST-TUNE (A8.2).
   */
  BONG_BONG: [3, 1] as const } as const;
export const DAY_CHUYEN = {
  CA_MAP: { L: 4, TIEN: 3, VAO_TU: 3, VAO_THEM: 4 },
  DAM_DONG: { SO_TU: 3, SO_THEM: 3, TIEN: 0.6, L: [10, 5] as const, VAO_TU: 4, VAO_BUOC: 3, VAO_THEM: 3 },
} as const;
/** Tiền tố nút CHỌN LÁ (gửi trước khi màn chạy, nhịp −1): `la_<id lõi>`. */
export const TIEN_TO_CHON_LA = 'la_';
/** Trượt giá ×3 khi tự chốt cuối màn đúng lúc nến cuối TRẮNG phía mình cần (demo `chotMini`). */
export const TRUOT_KHOA_CUOI = 3;
/**
 * BOT BẮT ĐÁY (D475) — chính sách TẤT ĐỊNH chỉ đọc nhịp đã qua: từ nhịp `TU_NHIP`, giá rút ≥ `NGUONG_RUT` so với đỉnh đã qua và nến không trắng
 * bên bán ⇒ VÀO HẾT; tới `MUON_NHAT` chưa vào ⇒ vào ở đó; giữ tới cuối (tự chốt). Số NHÁP — gate bước 4 #9 đo, founder chốt (A8.2).
 */
export const BOT_BAT_DAY = { TU_NHIP: 80, NGUONG_RUT: 0.02, MUON_NHAT: 400 } as const;   // PLAYTEST-TUNE
/**
 * D589 — BOT BẮT ĐÁY khoá v70 (founder 11/10 A: "vào đủ 3 phần tăng dần theo mức giá rơi thêm"): bán hết khoản giữ ở đầu cửa sổ, rồi phần thứ n
 * VÀO khi giá rút ≥ `NGUONG_RUT[n]` so với đỉnh đã qua; tới `BOT_BAT_DAY.MUON_NHAT` thì vào nốt các phần còn. Ngưỡng agent đề xuất,
 * founder chốt 11/10 ("Cho bot bắt đáy theo bạn chọn đi"). PLAYTEST-TUNE.
 */
export const BOT_BAT_DAY_BA_PHAN = { NGUONG_RUT: [0.02, 0.04, 0.06] } as const;

/**
 * D560 phần 2 — HÌNH ĐI NGANG THEO TÍNH CHẤT (founder 08/10 gửi bảng đặc điểm Wyckoff): áp lên màn của ô ĐI NGANG có `tinh_chat` (khoá v64),
 * SAU neo điểm cuối, TRƯỚC đám đông — giữ giá mở + giá đóng cuối (% engine không đổi).
 *   TÍCH LŨY — biên nén (`NEN`), khối lượng cạn nửa sau (`KL_CAN`), cây TĂNG khối lượng lớn (`KL_TANG`); bẫy SPRING: quét thủng đáy dải rồi rút chân.
 *   PHÂN PHỐI — biên giãn (`GIAN`), râu dài thêm (`RAU`), khối lượng cao (`KL`), cây GIẢM khối lượng lớn (`KL_GIAM`); bẫy UPTHRUST: vọt qua đỉnh dải rồi rơi lại.
 * Bẫy ra với xác suất `BAY_BP`, ở cây GẦN MÉP DẢI nhất trong khúc [`BAY_TU`, `BAY_DEN`] của màn (Spring: gần đáy · Upthrust: gần đỉnh — cú chọc
 * thủng mép, không phải cú rơi từ đỉnh xuống); sâu/cao thêm `BAY_SAU` × bề rộng dải. ⚠ A8.2 — PLAYTEST-TUNE.
 */
export const HINH_NGANG = {
  TICH_LUY: { NEN: 0.45, KL_CAN: 0.45, KL_TANG: 1.6 },
  PHAN_PHOI: { GIAN: 1.1, RAU: 0.5, KL: 1.25, KL_GIAM: 1.8 },   // bản đầu GIAN 1,35 · RAU 0,6: biên TB 26 %, một râu −12 % ⇒ mất chất đi ngang
  BAY_BP: 6000, BAY_TU: 0.5, BAY_DEN: 0.8, BAY_SAU: 0.35, BAY_KL: 2.2,
} as const;

/**
 * D561 — "ĐÃ VÀO GIÁ" (khoá v65 `vaoGia`; founder 07/10 chốt ~45 %, 08/10 chốt dấu hiệu = khối lượng cạn + nến rút chân). CHỈ ô TIN thật, CHỈ vòng có màn:
 * thị trường đã phản ánh tin từ trước ⇒ lúc tin ra, giá đi theo tin một nhịp rồi QUAY ĐẦU. Không áp lá pha — tăng/giảm vô cớ là thứ D560 vừa gỡ.
 *   XAC_SUAT_BP — một lần rút mỗi vòng (cả chợ cùng đã phản ánh MỘT tin).
 *   DAO_BP      — phần giá của mã (tài sản + tin) thành −DAO × phần ấy (10000 = đảo trọn).
 *   KNEE_MIN    — nến mịn (của phần chạy) nơi giá quay đầu (demo `KNEE_MIN`: nến công bố + 2).
 *   DAU_HIEU_BP / NHAM_BP — dấu hiệu hiện ở màn đã vào giá · hiện NHẦM ở màn tin thường (người đọc giỏi vẫn có thể bị lừa).
 *   KL_CAN · KL_CAN_NEN — khối lượng × hệ số trong chừng ấy nến trước đầu gối · RUT · KL_RUT — râu rút chân (× biên nến) + khối lượng cây đầu gối.
 * ⚠ A8.2 — PLAYTEST-TUNE: đo bằng gate + thang kỹ năng rồi founder chốt.
 */
export const VAO_GIA = {
  XAC_SUAT_BP: 4500, DAO_BP: 7000, KNEE_MIN: 18,
  /** Tới đầu gối giá đã đi theo tin chừng này phần gốc (bp của 10000), tối thiểu `TRUOC_GOI_SAN_BP` bp — pha "giật theo tin" trước cú quay đầu. */
  TRUOC_GOI_BP: 3500, TRUOC_GOI_SAN_BP: 80,
  DAU_HIEU_BP: 7500, NHAM_BP: 1500,
  KL_CAN: 0.3, KL_CAN_NEN: 8, RUT: 2.5, KL_RUT: 2.2,
  /** Kẹp phần giá GỐC mà đoạn đầu đi theo (bp): suy ngược −% engine ÷ DAO có thể ≤ −100 % khi % engine lớn (giá âm ⇒ NaN — bắt 08/10). Chỉ là
   *  HÌNH đoạn trước đầu gối; điểm cuối vẫn đúng % engine. */
  GOC_SAN_BP: -6000, GOC_TRAN_BP: 15000,
} as const;
