/**
 * DELPHI — Tham số SANDBOX "Đấu trường" (GĐ4.5, theo D15 v2.1 + D16 đã duyệt 19/07/2026).
 *
 * Nguồn chân lý duy nhất cho engine sandbox — CẤM magic number rải rác (A4/A8.2).
 * Sửa bất kỳ số nào ở đây = đổi cân bằng game → PHẢI chạy lại Monte Carlo gate
 * (scripts/sandbox_montecarlo.ts) TRƯỚC khi deploy, và ghi Nhật ký quyết định.
 *
 * ─── HAI RÀNG BUỘC SỐNG CÒN CỦA FILE NÀY ───────────────────────────────────
 *
 * (1) TƯỜNG LỬA T↔Q (A3.5). Không một hằng số nào ở đây được biểu diễn bằng
 *     token T. NAV và NSCT là điểm ẢO TRONG TRẬN, sinh ra lúc bắt đầu trận và
 *     biến mất lúc kết thúc — không có đường nào chảy ra `users.bankroll`.
 *     Tầng DB đã chốt cứng thêm một lớp: trigger `users_quest_points_frozen`
 *     (migrations/0002) cấm mọi thay đổi quest_points ở v0.1.
 *
 * (2) TẤT ĐỊNH TỪNG ĐIỂM NGUYÊN (D16 mục 7.2). Mọi đại lượng mô phỏng là số
 *     NGUYÊN. Giá tính bằng bps (10.000 = 1,0000). CẤM float trong engine —
 *     float chỉ được xuất hiện ở giá trị hiển thị. Cùng (mapId, seed,
 *     actionLog) phải cho cùng dãy giá và NAV trên mọi máy, mọi lần chạy.
 */

/** Version tham số — ghi vào sandbox_matches để replay đúng bản đã chơi. */
export const SANDBOX_VERSION = 'arena-v0.4.1';

/**
 * Version của BỘ THAM SỐ CÂN BẰNG (khác SANDBOX_VERSION: cái kia là hợp đồng
 * replay, cái này là "lần vặn cân bằng thứ mấy"). Ghi vào báo cáo Monte Carlo
 * để mùa sau biết số liệu thuộc bản nào.
 *   v1 — 19/07/2026 bản đầu GĐ4.5
 *   v2 — 19/07/2026 D20: thêm trần theo NHÓM tài sản tương quan
 */
export const BALANCE_VERSION = 'balance-v2-D20';

/** 1,0000 = 10.000 bps. Đơn vị chung cho giá và mọi tỷ lệ trong engine. */
export const BPS = 10_000;

// ---------------------------------------------------------------------------
// Cờ tính năng — D18 v2: GĐ4.5 chỉ dựng KHUNG, chưa bật.
// ---------------------------------------------------------------------------

/**
 * ĐIỀU KIỆN GỠ (A8.9 — cấm đường tắt không có ngày chết):
 *   SANDBOX_FEES : bật khi battle pass v0.3 có nguồn phát Q thật. 0015 chỉ nới
 *                  trigger theo MỘT CHIỀU (Q được giảm, không được tăng), nên vé
 *                  bàn thu Q vẫn không thu nổi của ai — cờ này ĐÚNG là còn false.
 *   COSMETICS    : "bật khi founder có art" → **ĐÃ ĐỦ 27/07**: art pixel của diện
 *                  mạo đã vào repo (`config/avatar_art.ts` — LUOI_NEN/KHUNG/DAN),
 *                  và D36 chốt sticker "phải MUA hoặc QUAY, không phát miễn phí",
 *                  tức founder ĐÃ yêu cầu quầy tồn tại. Giá lấy nguyên từ D16.
 *   GACHA        : bật cùng COSMETICS (hộp chỉ rơi cosmetic — D16 mục 3), và chỉ
 *                  sau khi lỗ hút Kho bạc ở §6.6 bị bịt: `duDieuKienMoHop`
 *                  (server/shop_kho.ts) đòi số dư CÒN LẠI trên SUBSIDY_THRESHOLD
 *                  sau khi đốt, nên "quay xuống dưới ngưỡng rồi xin trợ cấp để
 *                  quay tiếp" không còn là một đường đi.
 *   HONOR        : bật khi founder chốt danh sách vinh danh → còn false.
 *
 * ⚠ HAI CỜ BẬT Ở ĐÂY LÀ THI HÀNH ĐIỀU KIỆN ĐÃ GHI, KHÔNG PHẢI THAM SỐ MỚI. Tắt
 * lại là sửa đúng hai chữ `true` → `false`; không có dữ liệu nào cần dọn theo, vì
 * mọi thứ đã bán đều nằm trong `user_cosmetics`/`kho_sticker` và không mất đi.
 */
export const SANDBOX_FLAGS = {
  SANDBOX_FEES: false,
  COSMETICS: true,
  GACHA: true,
  HONOR: false,
} as const;

// ---------------------------------------------------------------------------
// Cấu trúc trận (D15 mục 2)
// ---------------------------------------------------------------------------

export const MATCH = {
  /** ≤12 vòng; mỗi vòng 22 tick mô phỏng (D16 mục 7.2). */
  ROUNDS: 12,
  TICKS_PER_ROUND: 22,
  /** NAV khởi điểm: 10.000 điểm nguyên = 100,00 hiển thị. Ai cũng bằng nhau. */
  START_NAV: 10_000,
  /** Số ghế một bàn (D15: lobby 5 — 1 người thật + ghost/bot lấp chỗ). */
  SEATS: 5,
  /** Cap tập trung: tối đa 40% NAV vào một tài sản (thẻ cấp 2 nới 55%). */
  CONCENTRATION_CAP_BP: 4_000,
  CONCENTRATION_CAP_BP_LV2: 5_500,
  /** Khớp tối đa 10% thanh khoản mỗi tick; phần dư sang tick sau, giá mới. */
  FILL_CAP_OF_LIQUIDITY_BP: 1_000,
  /** NAV ≤ ngưỡng này → cháy tài khoản, loại khỏi trận. */
  BUST_NAV: 0,
  /** Photo-finish: top 2 chênh < 1% ở vòng cuối → thêm hiệp phụ (tối đa 2). */
  PHOTO_FINISH_BP: 100,
  MAX_OVERTIME_ROUNDS: 2,
  /** Mỗi pipeline kích hoạt tối đa 1 lần/vòng (thẻ cấp 2: 2 lần). */
  PIPELINE_FIRES_PER_ROUND: 1,
  PIPELINE_FIRES_PER_ROUND_LV2: 2,
  MAX_ACTIVE_PIPELINES: 3,
} as const;

// ---------------------------------------------------------------------------
// Bàn cược (D16 mục 3). GĐ4.5: CHỈ 'tap' chạy được (SANDBOX_FEES = false).
// ---------------------------------------------------------------------------

export interface TableSpec {
  id: string;
  label: string;
  /** Vé vào bàn (Q) — ĐỐT khi vào. 0 = bàn tập. */
  ticketQ: number;
  /** Ngân sách chiến thuật cấp cố định theo bàn — ảo, reset mỗi trận. */
  tacticalBudget: number;
  /** Nhân điểm mùa, biểu diễn bp (10.000 = ×1). Bàn tập = 0 → không điểm. */
  seasonMultiplierBp: number;
  /** Rank tối thiểu để mở bàn (null = mở sẵn). */
  requiresTier: string | null;
  /** false → chỉ bật được khi SANDBOX_FLAGS.SANDBOX_FEES = true. */
  availableInV0: boolean;
}

/**
 * Prompt B VIỆC 1 chốt hai bàn cho v0.4.0: TẬP (0đ, không điểm) và XẾP HẠNG
 * (NSCT 20, điểm mùa ×1). Bàn 40/80 để v0.4.5.
 *
 * ĐỌC KỸ chỗ này kẻo hiểu ngược: thứ bị khóa là **PHÍ Q**, không phải bàn.
 * SANDBOX_FEES = false nghĩa là vé vào bàn thu 0 Q (vì nguồn phát Q chưa tồn
 * tại và trigger DB cấm ghi quest_points) — NHƯNG bàn xếp hạng vẫn chơi được
 * và vẫn cộng điểm mùa. Bản trước tôi khóa luôn cả bàn là sai phạm vi.
 */
export const TABLES: readonly TableSpec[] = [
  { id: 'tap',      label: 'BÀN TẬP',    ticketQ:  0, tacticalBudget: 20, seasonMultiplierBp:      0, requiresTier: null,   availableInV0: true },
  { id: 'xep_hang', label: 'BÀN XẾP HẠNG', ticketQ: 15, tacticalBudget: 20, seasonMultiplierBp: 10_000, requiresTier: null,   availableInV0: true },
  { id: 'q40',      label: 'BÀN 40',     ticketQ: 40, tacticalBudget: 30, seasonMultiplierBp: 15_000, requiresTier: 'bac',  availableInV0: false },
  { id: 'q80',      label: 'BÀN 80',     ticketQ: 80, tacticalBudget: 40, seasonMultiplierBp: 20_000, requiresTier: 'vang', availableInV0: false },
] as const;

/**
 * Vé thực thu = 0 khi SANDBOX_FEES tắt. Một hàm duy nhất quyết định chuyện này
 * để không chỗ nào lỡ tay trừ Q khi chưa có nguồn Q (A3.5 + trigger DB).
 */
export function effectiveTicketQ(table: TableSpec): number {
  return SANDBOX_FLAGS.SANDBOX_FEES ? table.ticketQ : 0;
}

/** Hoàn vé TỪ HỆ THỐNG (không phải từ người thua — D15 mục 4). */
export const TICKET_REFUND_BP = { rank1: 10_000, rank2: 5_000 } as const;

// ---------------------------------------------------------------------------
// Tài sản (8 thẻ lớp TÀI SẢN — D15 mục 3.3)
// ---------------------------------------------------------------------------

export type AssetId =
  | 'tien_gui' | 'tpcp' | 'vang' | 'usd'
  | 'cp_ngan_hang' | 'cp_cong_nghe' | 'cp_ban_le' | 'bds';

export interface AssetSpec {
  id: AssetId;
  label: string;
  /** Độ nhạy với regime, bp. Nhân với μ của regime. */
  betaBp: number;
  /** Biên độ nhiễu riêng mỗi tick, bp (biên ±). */
  noiseBp: number;
  /** Thanh khoản nền — mẫu số của công thức tác động giá. Càng lớn càng khó đẩy. */
  baseLiquidity: number;
  /** Bán bị trễ N vòng (BĐS = 1 — D15 mục 2). */
  sellDelayRounds: number;
}

/**
 * BETA — hiệu chỉnh D19. Bản trước cho vàng beta 0,40: kỳ vọng ~3,1 bp/tick với
 * chỉ 1/3 biến động của cổ phiếu (4,3 bp/tick). Điều chỉnh theo rủi ro thì trú
 * ẩn TRỘI TUYỆT ĐỐI — đo được phe thủ thắng 38–40%. Tài sản trú ẩn phải ăn ÍT
 * khi trời yên (đó là cái giá của sự an toàn) và chỉ ĐỠ ĐÒN khi bão; nếu chúng
 * vừa an toàn vừa lãi khá thì không ai có lý do cầm rủi ro, và game dạy sai.
 */
export const ASSETS: readonly AssetSpec[] = [
  { id: 'tien_gui',     label: 'Tiền gửi',      betaBp:   300, noiseBp:  2, baseLiquidity: 900_000, sellDelayRounds: 0 },
  { id: 'tpcp',         label: 'TPCP',          betaBp: 1_000, noiseBp: 12, baseLiquidity: 600_000, sellDelayRounds: 0 },
  { id: 'vang',         label: 'Vàng',          betaBp: 2_500, noiseBp: 45, baseLiquidity: 300_000, sellDelayRounds: 0 },
  { id: 'usd',          label: 'USD',           betaBp: 2_000, noiseBp: 25, baseLiquidity: 500_000, sellDelayRounds: 0 },
  { id: 'cp_ngan_hang', label: 'CP Ngân hàng',  betaBp: 11_000, noiseBp: 80, baseLiquidity: 200_000, sellDelayRounds: 0 },
  { id: 'cp_cong_nghe', label: 'CP Công nghệ',  betaBp: 14_000, noiseBp: 120, baseLiquidity: 140_000, sellDelayRounds: 0 },
  { id: 'cp_ban_le',    label: 'CP Bán lẻ',     betaBp: 9_000, noiseBp: 70, baseLiquidity: 180_000, sellDelayRounds: 0 },
  { id: 'bds',          label: 'Bất động sản',  betaBp: 7_000, noiseBp: 40, baseLiquidity:  90_000, sellDelayRounds: 1 },
] as const;

export const ASSET_IDS: readonly AssetId[] = ASSETS.map((a) => a.id);

// ---------------------------------------------------------------------------
// D19 (19/07/2026) — TRẦN THEO NHÓM TÀI SẢN TƯƠNG QUAN
// ---------------------------------------------------------------------------

/**
 * VÌ SAO CÓ: trần 40%/mã KHÔNG chặn được rủi ro thật, vì nó đo sai đơn vị.
 * Ba mã cổ phiếu cùng lên cùng xuống theo regime — dồn 40+40+20 vào chúng là
 * MỘT ván cược chứ không phải ba, mà vẫn "hợp lệ" theo trần từng mã. Đo được:
 * archetype all_in_cp thắng 37%, gấp rưỡi trần 30%, và không lever nào khác
 * hạ nổi vì nó đơn giản là phương sai cao nhất bàn.
 *
 * Quỹ thật giới hạn theo NGÀNH/NHÓM chứ không theo từng mã, đúng vì lý do này.
 *
 * RÀNG BUỘC KHI CHỈNH (founder chốt D19): trần nhóm phải đủ rộng để build
 * "tăng trưởng ≥3 ngành CP" VẪN KHẢ THI — mục tiêu là chặn dồn-tất-tay, không
 * phải cấm phong cách tăng trưởng. Có test khẳng định điều này.
 */
export const ASSET_GROUPS: Readonly<Record<string, readonly AssetId[]>> = {
  /** Cổ phiếu: cùng nhịp regime, tương quan cao nhất bàn. */
  co_phieu: ['cp_ngan_hang', 'cp_cong_nghe', 'cp_ban_le'],
  /** Trú ẩn: cùng hưởng lợi khi thị trường sợ hãi. */
  tru_an: ['tien_gui', 'tpcp', 'vang', 'usd'],
  /** BĐS đứng riêng — thanh khoản mỏng, bán trễ 1 vòng, nhịp riêng. */
  bat_dong_san: ['bds'],
} as const;

/** Trần tổng vị thế của cả NHÓM, tính theo % NAV (bp). */
export const GROUP_CAP_BP: Readonly<Record<string, number>> = {
  co_phieu: 7_000,
  tru_an: 5_500,
  bat_dong_san: 4_000,
} as const;

/** Tra nhóm của một tài sản (tất định, dựng sẵn một lần). */
const GROUP_OF = ((): Readonly<Record<AssetId, string>> => {
  const m = {} as Record<AssetId, string>;
  for (const [group, ids] of Object.entries(ASSET_GROUPS)) {
    for (const id of ids) m[id] = group;
  }
  return m;
})();

export function groupOf(id: AssetId): string {
  return GROUP_OF[id];
}

export function groupCapBp(id: AssetId): number {
  return GROUP_CAP_BP[GROUP_OF[id]] ?? 10_000;
}

// ---------------------------------------------------------------------------
// Regime (động cơ 2 lớp — D15 mục 5)
// ---------------------------------------------------------------------------

export type RegimeId = 'tang_nong' | 'on_dinh' | 'that_chat' | 'khung_hoang' | 'lam_phat';

export interface RegimeSpec {
  id: RegimeId;
  label: string;
  /** Drift nền mỗi tick, bp — nhân với betaBp/10.000 của từng tài sản. */
  driftBp: number;
  /** Hệ số nhân nhiễu, bp (10.000 = giữ nguyên). */
  volMulBp: number;
  /**
   * Lạm phát bào mòn CASH mỗi tick, bp (D15 mục 2).
   *
   * Hiệu chỉnh D19: từng để 1 bp ở các regime thường. Hệ quả đo được rất phản
   * trực giác — SIẾT trần nhóm trú ẩn lại làm phe thủ MẠNH LÊN (32,8% → 33,4%),
   * vì trần đẩy họ vào tiền mặt mà tiền mặt gần như miễn phí. "Không làm gì
   * cả" phải có giá của nó, nếu không mọi luật hạn chế rủi ro đều phản tác dụng.
   */
  cashDecayBp: number;
  /** Ghi đè drift cho tài sản trú ẩn khi khủng hoảng, bp. */
  havenOverrideBp?: Partial<Record<AssetId, number>>;
}

/**
 * PHẦN BÙ RỦI RO — đọc trước khi chỉnh bất kỳ số nào ở bảng này.
 *
 * Bản nháp đầu (17→19/07) đặt drift: tăng nóng +9 · ổn định +2 · thắt chặt −7
 * · khủng hoảng −18. Monte Carlo 2.000 trận chấm KHÔNG ĐẠT: archetype "trú ẩn"
 * thắng 53,2% (trần 30%). Nguyên nhân không phải bot khôn, mà là kỳ vọng của
 * tài sản rủi ro ÂM: trung bình 4 regime của map "Sàn nóng" ra (9+2−7−18)/4
 * = −3,5 bp/tick, nhân beta 1,1 của cổ phiếu ≈ −3,9 bp/tick × 264 tick ≈ −10%
 * cả trận. Trốn vào trú ẩn thành nước đi luôn đúng → game dạy sai hoàn toàn
 * (thực tế cổ phiếu có phần bù rủi ro DƯƠNG dài hạn, đó là lý do người ta
 * chịu biến động).
 *
 * Sửa vòng 1: kỳ vọng dương nhẹ cho tài sản rủi ro, đổi lại các regime xấu
 * SÂU HƠN nhưng HIẾM HƠN (trọng số ở regimePool).
 *
 * Sửa vòng 2 (sau khi "trú ẩn" vẫn thắng 39,6%): TRÚ ẨN PHẢI CÓ GIÁ CỦA NÓ.
 * Bản trước cho vàng/USD +7/+5 bp khi khủng hoảng — cao hơn cả cổ phiếu lúc
 * bùng nổ, tức là nấp vừa an toàn vừa lãi to, một nước đi không nhược điểm.
 * Nay havenOverride chỉ còn ĐỠ ĐÒN (dương rất nhẹ, 0–3 bp) chứ không phải
 * cỗ máy sinh lời, và cashDecay ≥ 1 bp ở MỌI regime — tiền mặt luôn mất giá
 * theo thời gian, đúng như đời thật. Ngồi im ngoài thị trường từ nay có phí.
 */
export const REGIMES: readonly RegimeSpec[] = [
  { id: 'tang_nong',   label: 'Tăng nóng',    driftBp: 13, volMulBp: 11_000, cashDecayBp: 2 },
  { id: 'on_dinh',     label: 'Ổn định',      driftBp:  9, volMulBp:  8_000, cashDecayBp: 2 },
  { id: 'that_chat',   label: 'Thắt chặt',    driftBp: -4, volMulBp: 13_000, cashDecayBp: 2,
    havenOverrideBp: { tpcp: 1, tien_gui: 0 } },
  // Khủng hoảng: TƯƠNG QUAN TĂNG VỌT — cổ phiếu rơi sâu hơn beta thường ngày
  // gợi ý, đúng như sập thật (mọi thứ rủi ro rơi cùng nhau, không còn "đa dạng
  // hóa" nào cứu được).
  //
  // Hiệu chỉnh D19: mức đạp từng để −46/−38/−33/−42 như một công cụ THÔ để trị
  // "dồn hết vào cổ phiếu". Nó có tác dụng nhưng kéo kỳ vọng CẢ THỊ TRƯỜNG về
  // âm — đo được NAV trung bình của mọi archetype đều dưới vốn, kể cả NGỒI IM
  // (9.625). Khi cầm gì cũng lỗ thì ai cầm ít nhất sẽ thắng, và phe thủ vọt lên
  // 40%. Nay đã có TRẦN NHÓM (công cụ đúng) nên hạ mức đạp về vừa đủ để giữ
  // bài học "khủng hoảng thì đa dạng hóa không cứu được", không hơn.
  { id: 'khung_hoang', label: 'Khủng hoảng',  driftBp: -17, volMulBp: 18_000, cashDecayBp: 2,
    havenOverrideBp: { vang: 1, usd: 0, tien_gui: 0,
                       cp_cong_nghe: -28, cp_ngan_hang: -24, cp_ban_le: -21, bds: -26 } },
  { id: 'lam_phat',    label: 'Lạm phát',     driftBp:  6, volMulBp: 14_000, cashDecayBp: 5,
    // Lạm phát PHẢI phạt thứ "an toàn danh nghĩa": tiền gửi và trái phiếu lãi
    // cố định mất sức mua. Không có hai số âm này thì map lạm phát lại thưởng
    // cho việc nấp — đo được ở Monte Carlo: "ngồi im" thắng 34,8%, sai hẳn
    // bài học map muốn dạy.
    havenOverrideBp: { vang: 5, bds: 4, tien_gui: -3, tpcp: -2 } },
] as const;

// ---------------------------------------------------------------------------
// Map (4 map cho v0.4.0 — D15 mục 8)
// ---------------------------------------------------------------------------

export interface MapSpec {
  id: string;
  label: string;
  blurb: string;
  /**
   * K trong Δp_bps = K × flow_net × 10.000 / L(t). Càng lớn thị trường càng "mỏng".
   *
   * Hiệu chỉnh 19/07 sau Monte Carlo: bản đầu để K = 100–210, khiến một lệnh
   * 2.000 điểm đạp giá ~2% NGAY LẬP TỨC — mức của quỹ nuốt cả sàn, không phải
   * lệnh của người chơi bình thường. Hệ quả đo được: mọi chiến thuật chủ động
   * đều lỗ so với ngồi im, "trú ẩn" thắng 44–53%. Hạ về 18–45: lệnh cỡ đó đạp
   * ~0,3–0,8%, đủ để DẠY trượt giá và chia lệnh mà không biến giao dịch thành
   * cái bẫy. Map "Đóng băng thanh khoản" giữ K cao nhất — đó là cá tính của nó.
   *
   * LƯU Ý khi mở mode QUỸ LỚN (v0.4.5): ở đó người chơi CỐ Ý nắm 10–40% thanh
   * khoản map, tác động lớn là đúng thiết kế — chỉnh bằng thanh khoản map,
   * đừng vặn lại K.
   */
  impactK: number;
  /** Hệ số nhân thanh khoản nền của map, bp. */
  liquidityMulBp: number;
  /** Regime khởi điểm. */
  startRegime: RegimeId;
  /** Xác suất lật regime mỗi VÒNG, bp. */
  regimeSwitchBp: number;
  /**
   * Bảng regime map này được phép rơi vào. TRỌNG SỐ MÃ HÓA BẰNG SỐ LẦN LẶP —
   * engine bốc đều trên mảng, nên regime nào muốn hiếm thì xuất hiện 1 lần,
   * muốn thường thì lặp nhiều lần. Cố ý chọn cách này thay vì bảng trọng số
   * riêng: bốc đều trên mảng là phép rút TẤT ĐỊNH đơn giản nhất, không có
   * phép chia float nào lọt vào (xem ghi chú tất định ở đầu file).
   */
  regimePool: readonly RegimeId[];
  /** Số sự kiện tin tức trong trận. */
  newsCount: number;
}

export const MAPS: readonly MapSpec[] = [
  {
    id: 'san_nong', label: 'Sàn nóng',
    blurb: 'Cổ phiếu dẫn dắt, tin ra liên tục. Đất của phe đà.',
    impactK: 22, liquidityMulBp: 9_000, startRegime: 'tang_nong', regimeSwitchBp: 2_800,
    regimePool: ['tang_nong', 'tang_nong', 'tang_nong', 'on_dinh', 'that_chat', 'khung_hoang'], newsCount: 5,
  },
  {
    id: 'kim_loai_quy', label: 'Kim loại quý',
    blurb: 'Vàng và USD dẫn sóng, cổ phiếu chịu đòn. Trú ẩn có giá của nó.',
    impactK: 20, liquidityMulBp: 9_500, startRegime: 'on_dinh', regimeSwitchBp: 3_200,
    regimePool: ['on_dinh', 'on_dinh', 'lam_phat', 'that_chat', 'khung_hoang'], newsCount: 5,
  },
  {
    id: 'sot_dat', label: 'Sốt đất',
    // Cơn sốt PHẢI có lúc vỡ, nếu không "Sốt đất" chỉ là bản sao của "Sàn nóng":
    // đo được all_in_cp thắng 67,1% ở đây, và 2/4 map cùng thưởng liều thì
    // tổng hợp lại không archetype nào nằm dưới trần được.
    blurb: 'Bất động sản phi mã rồi kẹt thanh khoản. Nhớ: BĐS bán trễ 1 vòng.',
    impactK: 30, liquidityMulBp: 7_000, startRegime: 'lam_phat', regimeSwitchBp: 2_400,
    regimePool: ['lam_phat', 'lam_phat', 'tang_nong', 'that_chat', 'khung_hoang'], newsCount: 4,
  },
  {
    id: 'bao_no', label: 'Bão nợ',
    blurb: 'Thắt chặt kéo dài, thanh khoản mỏng. Sống sót trước, lãi sau.',
    impactK: 45, liquidityMulBp: 5_500, startRegime: 'that_chat', regimeSwitchBp: 2_200,
    regimePool: ['that_chat', 'that_chat', 'on_dinh', 'khung_hoang'], newsCount: 3,
  },
] as const;

// ---------------------------------------------------------------------------
// HỆ (4 hệ mùa đầu — founder chốt D15 câu hỏi 3, KHÔNG có Phái sinh ở GĐ4.5)
// ---------------------------------------------------------------------------

export type FactionId = 'phong_thu' | 'da' | 'gia_tri' | 'vi_mo';

export interface FactionSpec {
  id: FactionId;
  label: string;
  icon: string;
  /** Thẻ thuộc hệ xuất hiện trong shop với rate ×2 (biểu diễn bp). */
  shopBiasBp: number;
  /** Mở khóa: 2 hệ đầu free, còn lại 350 Q niêm yết (D16 mục 3). */
  unlockQ: number;
  passive: string;
  trait2: string;
  trait4: string;
  teaches: string;
}

export const FACTIONS: readonly FactionSpec[] = [
  {
    id: 'phong_thu', label: 'PHÒNG THỦ', icon: '🛡', shopBiasBp: 20_000, unlockQ: 0,
    passive: '+1 NSCT mỗi 3 vòng',
    trait2: 'Drawdown −10%', trait4: 'Drawdown −25%', teaches: 'Đa dạng hóa',
  },
  {
    id: 'da', label: 'ĐÀ', icon: '🚀', shopBiasBp: 20_000, unlockQ: 0,
    passive: '—',
    trait2: '+8% lợi suất tài sản đang tăng ≥2 vòng',
    trait4: '+20% lợi suất tài sản đang tăng ≥2 vòng', teaches: 'Momentum & đu đỉnh',
  },
  {
    id: 'gia_tri', label: 'GIÁ TRỊ', icon: '💎', shopBiasBp: 20_000, unlockQ: 350,
    passive: '—',
    trait2: 'Giảm 5% giá mua tài sản đang âm sâu',
    trait4: 'Giảm 12% giá mua tài sản đang âm sâu', teaches: 'Contrarian & dao rơi',
  },
  {
    id: 'vi_mo', label: 'VĨ MÔ', icon: '🌍', shopBiasBp: 20_000, unlockQ: 350,
    passive: 'Thấy trước loại tin 1 tick',
    trait2: 'Cửa sổ phản ứng tin ×1,5',
    trait4: 'Cửa sổ phản ứng tin ×2', teaches: 'Cập nhật niềm tin',
  },
] as const;

/** Hiệu ứng trait quy ra số — engine đọc cái này, không đọc chữ mô tả. */
export const FACTION_EFFECTS = {
  phong_thu: { drawdownCutBp: { t2: 1_000, t4: 2_500 }, nsctEveryNRounds: 3, nsctAmount: 1 },
  da:        { momentumBonusBp: { t2: 800, t4: 2_000 }, momentumMinRounds: 2 },
  gia_tri:   { buyDiscountBp: { t2: 500, t4: 1_200 }, deepDownBp: -1_200 },
  vi_mo:     { newsPreviewTicks: 1, reactionWindowMulBp: { t2: 15_000, t4: 20_000 } },
} as const;

/** Số thẻ cùng hệ đang hoạt động để mở nấc trait. */
export const TRAIT_LADDER = { t2: 2, t4: 4 } as const;

// ---------------------------------------------------------------------------
// Shop trong trận (TFT-like — D15 mục 3.2)
// ---------------------------------------------------------------------------

export const SHOP = {
  SLOTS: 5,
  FREE_REFRESH_PER_ROUND: 1,
  REROLL_COST: 2,
  SELL_REFUND_BP: 5_000,
  /** Pity: N lần reroll liên tiếp không ra thẻ hệ mình → lần sau đảm bảo. */
  PITY_REROLLS: 3,
  /** 2 bản sao cùng thẻ = cấp 2. */
  COPIES_FOR_LV2: 2,
} as const;

// ---------------------------------------------------------------------------
// Mastery — quyền căn chỉnh tham số kiếm bằng CHƠI, không mua được (D15 mục 4.4)
// ---------------------------------------------------------------------------

export const MASTERY = {
  /** Số trận TÍNH ĐIỂM dùng thẻ để mở từng nấc. */
  TIERS: [5, 15, 40],
  /** Nấc 0 = preset cố định · 1 = chỉnh hẹp · 2 = chỉnh rộng · 3 = đầy đủ. */
  LABELS: ['Preset cố định', 'Chỉnh khoảng hẹp', 'Chỉnh khoảng rộng', 'Toàn quyền'],
} as const;

// ---------------------------------------------------------------------------
// Điểm mùa & tier (D16 mục 7.3)
// ---------------------------------------------------------------------------

export const SCORING = {
  /** Đấu 5: hạng 1..5. CÓ ÂM (founder chốt D16 câu 5). */
  DUEL5_POINTS: [3, 1, 0, -1, -2],
  /** Thử thách ngày (PvE) — KHÔNG âm. */
  DAILY_TOP20_PCT: 2,
  DAILY_MID_PCT: 1,
  DAILY_REST: 0,
  /** Tier ngưỡng điểm mùa. */
  TIERS: [
    { id: 'dong', label: 'Đồng', min: 0 },
    { id: 'bac', label: 'Bạc', min: 25 },
    { id: 'vang', label: 'Vàng', min: 60 },
    { id: 'bach_kim', label: 'Bạch kim', min: 120 },
    { id: 'kim_cuong', label: 'Kim cương', min: 200 },
  ],
  /** Reset mềm mỗi mùa: giữ 50% điểm. */
  SEASON_SOFT_RESET_BP: 5_000,
  /** Đền Vinh danh "Chiến lược gia của mùa" cần tối thiểu N trận. */
  HONOR_MIN_MATCHES: 15,
} as const;

// ---------------------------------------------------------------------------
// Monte Carlo gate (D15 mục 8) — điều kiện ĐẠT để được deploy
// ---------------------------------------------------------------------------

export const MC_GATE = {
  MIN_MATCHES: 10_000,
  /**
   * Không archetype nào thắng > 30%.
   *
   * ═══ CÁCH ĐỌC (founder chốt 19/07 đợt 4 — SỐ 30% GIỮ NGUYÊN) ═══════════
   * Câu hỏi D15 muốn trả lời là "có chiến lược nào CHẠY TRỐN khỏi phần còn
   * lại không", chứ không phải "có ai chạm 30,1% không". Hai tình huống rất
   * khác nhau mà cùng vượt ngưỡng:
   *
   *   CHẠY TRỐN (= HỎNG THẬT): một chiến lược bỏ xa cả bàn. Đó là meta độc
   *     quyền — ai không chơi nó thì thiệt, và dữ liệu hành vi thu về chỉ
   *     phản ánh "mọi người copy build mạnh nhất". Đúng thứ đã gặp:
   *     all_in_cp 63,6%.
   *
   *   CHEN CHÚC (= CHẤP NHẬN ĐƯỢC): nhiều chiến lược LÀNH MẠNH KHÁC NHAU
   *     cùng nhỉnh nhẹ trên 30% và sát nhau. Ví dụ phòng thủ (mix tài sản)
   *     và DCA (kỷ luật thời gian) cùng ~33% — đó là hai triết lý khác hẳn
   *     nhau cùng hoạt động tốt, tức là cân bằng KHỎE.
   *
   * Thêm nữa, số của BOT PHÓNG ĐẠI mức thống trị so với người thật: bot chơi
   * hoàn hảo mọi ván, người thật chơi lệch và khẩu vị rủi ro đa dạng — mà
   * chính sự đa dạng đó là thứ app muốn ĐO.
   *
   * Nên: vượt 30% mà chen chúc → ĐẠT CÓ KHAI LỆCH, đo lại bằng dữ liệu NGƯỜI
   * THẬT sau 4–6 tuần beta (đúng hẹn D16). Chạy trốn → KHÔNG ĐẠT, chặn deploy.
   */
  MAX_ARCHETYPE_WINRATE_BP: 3_000,

  /** Vượt mức này là chạy trốn về ĐỘ LỚN, không bàn cãi — chặn cứng. */
  RUNAWAY_ABSOLUTE_BP: 4_500,

  /**
   * Vượt 30% VÀ bỏ xa á quân từng này trở lên = chạy trốn về KHOẢNG CÁCH.
   * 8 điểm: đủ để phân biệt "một mình một ngựa" với "vài đứa ngang nhau".
   */
  RUNAWAY_GAP_BP: 800,
  /** Không HỆ nào thắng > 22% (nền 4 hệ = 25%... nền lobby 5 = 20%). */
  MAX_FACTION_WINRATE_BP: 2_200,
  /** Tỷ lệ cháy tài khoản phải nằm trong 8–15%. */
  BUST_RATE_MIN_BP: 800,
  BUST_RATE_MAX_BP: 1_500,
  /** "NGỒI IM" (buy-and-hold) phải rơi vào nhóm giữa: hạng trung bình 2,2–3,8. */
  HOLD_RANK_MIN_X10: 22,
  HOLD_RANK_MAX_X10: 38,
} as const;
