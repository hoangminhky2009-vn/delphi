/**
 * DELPHI — BỘ THẺ & PRESET PIPELINE Đấu trường mùa 1 (GĐ4.5).
 *
 * D15 mục 3.3: 40 thẻ / 5 lớp = 8 tài sản · 10 tín hiệu · 8 điều kiện · 10 lệnh
 * · 4 phái sinh. GĐ4.5 KHÔNG có phái sinh (D18 v2) → 36 thẻ.
 *
 * Pipeline = KHI (tín hiệu) → NẾU (điều kiện) → THÌ (lệnh) × tham số.
 * v0.4.0 chỉ cho dùng 12 PRESET dựng sẵn, THAM SỐ KHÓA — tự ghép pipeline và
 * tinh chỉnh tham số là mastery, mở ở v0.4.5 (Prompt B VIỆC 1).
 *
 * TẤT ĐỊNH: mọi tham số ở đây là số nguyên (bp hoặc điểm). Engine không được
 * đọc chữ `label`/`blurb` để tính toán — chỉ dùng để hiển thị.
 */
import type { AssetId } from './sandbox.js';

export type CardLayer = 'tai_san' | 'tin_hieu' | 'dieu_kien' | 'lenh';

export interface CardSpec {
  id: string;
  layer: CardLayer;
  label: string;
  /** Giá mua ở shop, tính bằng NSCT (D15 mục 3.2: 2–6). */
  cost: number;
  /** Hệ mà thẻ này nghiêng về — dùng cho bias shop ×2 và thang trait 2/4. */
  faction: 'phong_thu' | 'da' | 'gia_tri' | 'vi_mo' | null;
  blurb: string;
}

// ---------------------------------------------------------------------------
// Lớp 1 — TÀI SẢN (8). Mua thẻ = mở quyền phân bổ vào tài sản đó.
// ---------------------------------------------------------------------------
export const ASSET_CARDS: readonly (CardSpec & { assetId: AssetId })[] = [
  { id: 'ts_tien_gui',     assetId: 'tien_gui',     layer: 'tai_san', label: 'Tiền gửi',       cost: 2, faction: 'phong_thu', blurb: 'Gần như không biến động. Lãi bé nhưng ngủ ngon.' },
  { id: 'ts_tpcp',         assetId: 'tpcp',         layer: 'tai_san', label: 'TPCP',           cost: 2, faction: 'phong_thu', blurb: 'Trái phiếu chính phủ. Trú ẩn khi thắt chặt.' },
  { id: 'ts_vang',         assetId: 'vang',         layer: 'tai_san', label: 'Vàng',           cost: 3, faction: 'vi_mo',     blurb: 'Lên khi thiên hạ hoảng. Không sinh lãi.' },
  { id: 'ts_usd',          assetId: 'usd',          layer: 'tai_san', label: 'USD',            cost: 3, faction: 'vi_mo',     blurb: 'Neo theo vĩ mô. Ít ăn theo cổ phiếu.' },
  { id: 'ts_cp_ngan_hang', assetId: 'cp_ngan_hang', layer: 'tai_san', label: 'CP Ngân hàng',   cost: 4, faction: 'gia_tri',   blurb: 'Nhạy lãi suất. Sóng to.' },
  { id: 'ts_cp_cong_nghe', assetId: 'cp_cong_nghe', layer: 'tai_san', label: 'CP Công nghệ',   cost: 5, faction: 'da',        blurb: 'Biến động mạnh nhất bàn. Đà lên thì lên dữ.' },
  { id: 'ts_cp_ban_le',    assetId: 'cp_ban_le',    layer: 'tai_san', label: 'CP Bán lẻ',      cost: 4, faction: 'da',        blurb: 'Ăn theo tiêu dùng. Sóng vừa.' },
  { id: 'ts_bds',          assetId: 'bds',          layer: 'tai_san', label: 'Bất động sản',   cost: 4, faction: 'gia_tri',   blurb: 'Thanh khoản mỏng — BÁN TRỄ 1 VÒNG. Nhớ kỹ.' },
] as const;

// ---------------------------------------------------------------------------
// Lớp 2 — TÍN HIỆU "KHI" (10)
// ---------------------------------------------------------------------------
export type SignalId =
  | 'th_tang_manh' | 'th_giam_manh' | 'th_da_hai_vong' | 'th_qua_ban'
  | 'th_qua_mua' | 'th_tin_lai_suat' | 'th_tin_ty_gia' | 'th_tin_chinh_sach'
  | 'th_bien_dong_cao' | 'th_thanh_khoan_mong';

export const SIGNAL_CARDS: readonly (CardSpec & { id: SignalId })[] = [
  { id: 'th_tang_manh',        layer: 'tin_hieu', label: 'KHI giá tăng mạnh',      cost: 2, faction: 'da',        blurb: 'Tài sản tăng ≥ ngưỡng trong một vòng.' },
  { id: 'th_giam_manh',        layer: 'tin_hieu', label: 'KHI giá giảm mạnh',      cost: 2, faction: 'phong_thu', blurb: 'Tài sản giảm ≥ ngưỡng trong một vòng.' },
  { id: 'th_da_hai_vong',      layer: 'tin_hieu', label: 'KHI đà giữ 2 vòng',      cost: 3, faction: 'da',        blurb: 'Tăng liên tiếp hai vòng — đà thật, không phải nhiễu.' },
  { id: 'th_qua_ban',          layer: 'tin_hieu', label: 'KHI quá bán',            cost: 3, faction: 'gia_tri',   blurb: 'Giá rơi sâu dưới nền — vùng bắt đáy.' },
  { id: 'th_qua_mua',          layer: 'tin_hieu', label: 'KHI quá mua',            cost: 3, faction: 'gia_tri',   blurb: 'Giá vượt xa nền — vùng chốt lời.' },
  { id: 'th_tin_lai_suat',     layer: 'tin_hieu', label: 'KHI có tin LÃI SUẤT',    cost: 4, faction: 'vi_mo',     blurb: 'Bắt tin lãi suất ngay khi ra.' },
  { id: 'th_tin_ty_gia',       layer: 'tin_hieu', label: 'KHI có tin TỶ GIÁ',      cost: 4, faction: 'vi_mo',     blurb: 'Bắt tin tỷ giá ngay khi ra.' },
  { id: 'th_tin_chinh_sach',   layer: 'tin_hieu', label: 'KHI có tin CHÍNH SÁCH',  cost: 4, faction: 'vi_mo',     blurb: 'Bắt tin chính sách ngay khi ra.' },
  { id: 'th_bien_dong_cao',    layer: 'tin_hieu', label: 'KHI biến động cao',      cost: 3, faction: 'phong_thu', blurb: 'Thị trường rung lắc mạnh hơn bình thường.' },
  { id: 'th_thanh_khoan_mong', layer: 'tin_hieu', label: 'KHI thanh khoản mỏng',   cost: 3, faction: 'phong_thu', blurb: 'Sổ lệnh cạn — lệnh to sẽ tự đạp giá mình.' },
] as const;

// ---------------------------------------------------------------------------
// Lớp 3 — ĐIỀU KIỆN "NẾU" (8)
// ---------------------------------------------------------------------------
export type ConditionId =
  | 'dk_dang_nam' | 'dk_chua_nam' | 'dk_du_tien' | 'dk_dang_lo'
  | 'dk_dang_lai' | 'dk_dau_tran' | 'dk_cuoi_tran' | 'dk_qua_tap_trung';

export const CONDITION_CARDS: readonly (CardSpec & { id: ConditionId })[] = [
  { id: 'dk_dang_nam',       layer: 'dieu_kien', label: 'NẾU đang nắm',           cost: 2, faction: null,        blurb: 'Chỉ chạy khi đang có vị thế ở tài sản đó.' },
  { id: 'dk_chua_nam',       layer: 'dieu_kien', label: 'NẾU chưa nắm',           cost: 2, faction: null,        blurb: 'Chỉ chạy khi chưa có vị thế.' },
  { id: 'dk_du_tien',        layer: 'dieu_kien', label: 'NẾU còn nhiều tiền mặt', cost: 2, faction: 'gia_tri',   blurb: 'Tiền mặt còn trên ngưỡng.' },
  { id: 'dk_dang_lo',        layer: 'dieu_kien', label: 'NẾU đang lỗ',            cost: 3, faction: 'phong_thu', blurb: 'NAV dưới vốn ban đầu.' },
  { id: 'dk_dang_lai',       layer: 'dieu_kien', label: 'NẾU đang lãi',           cost: 3, faction: 'da',        blurb: 'NAV trên vốn ban đầu.' },
  { id: 'dk_dau_tran',       layer: 'dieu_kien', label: 'NẾU còn đầu trận',       cost: 2, faction: null,        blurb: 'Vòng ≤ ngưỡng — còn thời gian sửa sai.' },
  { id: 'dk_cuoi_tran',      layer: 'dieu_kien', label: 'NẾU đã cuối trận',       cost: 2, faction: null,        blurb: 'Vòng ≥ ngưỡng — hết đường lùi.' },
  { id: 'dk_qua_tap_trung',  layer: 'dieu_kien', label: 'NẾU quá tập trung',      cost: 3, faction: 'phong_thu', blurb: 'Một tài sản chiếm quá ngưỡng NAV.' },
] as const;

// ---------------------------------------------------------------------------
// Lớp 4 — LỆNH "THÌ" (10)
// ---------------------------------------------------------------------------
export type ActionId =
  | 'l_mua' | 'l_ban_mot_phan' | 'l_ban_het' | 'l_cat_lo' | 'l_chot_loi'
  | 'l_dao_sang' | 'l_dca' | 'l_can_bang' | 'l_don_tru_an' | 'l_giu_nguyen';

export const ACTION_CARDS: readonly (CardSpec & { id: ActionId })[] = [
  { id: 'l_mua',           layer: 'lenh', label: 'THÌ mua thêm',        cost: 2, faction: 'da',        blurb: 'Mua thêm theo % NAV.' },
  { id: 'l_ban_mot_phan',  layer: 'lenh', label: 'THÌ bán bớt',         cost: 2, faction: null,        blurb: 'Bán một phần vị thế.' },
  { id: 'l_ban_het',       layer: 'lenh', label: 'THÌ bán sạch',        cost: 3, faction: 'phong_thu', blurb: 'Đóng toàn bộ vị thế tài sản đó.' },
  { id: 'l_cat_lo',        layer: 'lenh', label: 'THÌ cắt lỗ',          cost: 3, faction: 'phong_thu', blurb: 'Bán khi lỗ chạm ngưỡng. Kỷ luật sống còn.' },
  { id: 'l_chot_loi',      layer: 'lenh', label: 'THÌ chốt lời',        cost: 3, faction: 'gia_tri',   blurb: 'Bán khi lãi chạm ngưỡng.' },
  { id: 'l_dao_sang',      layer: 'lenh', label: 'THÌ đảo sang',        cost: 4, faction: 'vi_mo',     blurb: 'Bán tài sản này, mua ngay tài sản kia.' },
  { id: 'l_dca',           layer: 'lenh', label: 'THÌ mua đều tay',     cost: 3, faction: 'gia_tri',   blurb: 'Rải đều nhiều vòng thay vì dồn một lần.' },
  { id: 'l_can_bang',      layer: 'lenh', label: 'THÌ cân bằng lại',    cost: 4, faction: 'phong_thu', blurb: 'Kéo mọi tài sản về tỷ trọng mục tiêu.' },
  { id: 'l_don_tru_an',    layer: 'lenh', label: 'THÌ dồn về trú ẩn',   cost: 4, faction: 'vi_mo',     blurb: 'Chuyển sang vàng/USD/TPCP/tiền gửi.' },
  { id: 'l_giu_nguyen',    layer: 'lenh', label: 'THÌ không làm gì',    cost: 2, faction: null,        blurb: 'Cố ý đứng yên. Đôi khi là nước hay nhất.' },
] as const;

/** Toàn bộ 36 thẻ — nguồn của shop. */
export const ALL_CARDS: readonly CardSpec[] = [
  ...ASSET_CARDS, ...SIGNAL_CARDS, ...CONDITION_CARDS, ...ACTION_CARDS,
];

export function findCard(id: string): CardSpec | undefined {
  return ALL_CARDS.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// 12 PRESET PIPELINE — tham số KHÓA ở v0.4.0 (mastery mở ở v0.4.5)
// ---------------------------------------------------------------------------

export interface PresetSpec {
  id: string;
  label: string;
  faction: 'phong_thu' | 'da' | 'gia_tri' | 'vi_mo';
  signal: SignalId;
  condition: ConditionId;
  action: ActionId;
  /** Tham số đã chốt (bp hoặc % NAV) — v0.4.0 người chơi KHÔNG sửa được. */
  params: {
    /** Ngưỡng kích hoạt tín hiệu, bp. */
    thresholdBp: number;
    /** Độ lớn lệnh: % NAV (mua) hoặc % vị thế (bán), bp. */
    sizeBp: number;
    /** Tài sản đích — null = áp cho tài sản đang xét. */
    targetAsset?: AssetId;
  };
  /** Giá bật pipeline vào trận, NSCT. */
  cost: number;
  teaches: string;
}

export const PRESETS: readonly PresetSpec[] = [
  // --- PHÒNG THỦ (3) ---
  { id: 'ps_cat_lo_8', label: 'Cắt lỗ 8%', faction: 'phong_thu',
    signal: 'th_giam_manh', condition: 'dk_dang_nam', action: 'l_cat_lo',
    params: { thresholdBp: 800, sizeBp: 10_000 }, cost: 3,
    teaches: 'Giới hạn thiệt hại trước khi nó thành thảm họa.' },
  { id: 'ps_ha_rui_ro_khi_lo', label: 'Lỗ thì hạ rủi ro', faction: 'phong_thu',
    signal: 'th_bien_dong_cao', condition: 'dk_dang_lo', action: 'l_don_tru_an',
    params: { thresholdBp: 500, sizeBp: 4_000 }, cost: 4,
    teaches: 'Rung lắc + đang lỗ = giảm tay lái, đừng gồng.' },
  { id: 'ps_chong_tap_trung', label: 'Chống dồn một cửa', faction: 'phong_thu',
    signal: 'th_tang_manh', condition: 'dk_qua_tap_trung', action: 'l_can_bang',
    params: { thresholdBp: 400, sizeBp: 3_000 }, cost: 4,
    teaches: 'Thắng đậm một mã là lúc dễ mất kỷ luật nhất.' },

  // --- ĐÀ (3) ---
  { id: 'ps_duoi_da', label: 'Đuổi theo đà', faction: 'da',
    signal: 'th_da_hai_vong', condition: 'dk_du_tien', action: 'l_mua',
    params: { thresholdBp: 300, sizeBp: 1_500 }, cost: 3,
    teaches: 'Đà thật thường kéo dài hơn ta tưởng — và kết thúc đột ngột.' },
  { id: 'ps_bam_song', label: 'Bám sóng, lãi thì thêm', faction: 'da',
    signal: 'th_tang_manh', condition: 'dk_dang_lai', action: 'l_mua',
    params: { thresholdBp: 600, sizeBp: 1_200 }, cost: 3,
    teaches: 'Cộng dồn vào thứ đang chạy. Rủi ro: đu đúng đỉnh.' },
  { id: 'ps_thoat_khi_gay_da', label: 'Gãy đà thì rút', faction: 'da',
    signal: 'th_giam_manh', condition: 'dk_dang_nam', action: 'l_ban_mot_phan',
    params: { thresholdBp: 500, sizeBp: 5_000 }, cost: 3,
    teaches: 'Momentum không có stop thì chỉ là đánh bạc có biểu đồ.' },

  // --- GIÁ TRỊ (3) ---
  { id: 'ps_bat_day', label: 'Quá bán thì mua', faction: 'gia_tri',
    signal: 'th_qua_ban', condition: 'dk_du_tien', action: 'l_mua',
    params: { thresholdBp: 1_000, sizeBp: 1_500 }, cost: 3,
    teaches: 'Mua rẻ — nếu rẻ không phải vì công ty sắp chết.' },
  { id: 'ps_chot_khi_qua_mua', label: 'Quá mua thì chốt', faction: 'gia_tri',
    signal: 'th_qua_mua', condition: 'dk_dang_nam', action: 'l_chot_loi',
    params: { thresholdBp: 1_200, sizeBp: 3_000 }, cost: 3,
    teaches: 'Chốt lời là quyết định, không phải may mắn.' },
  { id: 'ps_dca', label: 'Mua đều tay', faction: 'gia_tri',
    signal: 'th_giam_manh', condition: 'dk_du_tien', action: 'l_dca',
    params: { thresholdBp: 400, sizeBp: 800 }, cost: 3,
    teaches: 'Rải lệnh nhiều vòng để khỏi phải đoán đúng đáy.' },

  // --- VĨ MÔ (3) ---
  { id: 'ps_tin_lai_suat', label: 'Tin lãi suất → về TPCP', faction: 'vi_mo',
    signal: 'th_tin_lai_suat', condition: 'dk_dang_nam', action: 'l_dao_sang',
    params: { thresholdBp: 0, sizeBp: 5_000, targetAsset: 'tpcp' }, cost: 4,
    teaches: 'Lãi suất tăng đạp cổ phiếu, nâng trái phiếu mới phát hành.' },
  { id: 'ps_tin_ty_gia', label: 'Tin tỷ giá → giữ USD', faction: 'vi_mo',
    signal: 'th_tin_ty_gia', condition: 'dk_du_tien', action: 'l_mua',
    params: { thresholdBp: 0, sizeBp: 1_500, targetAsset: 'usd' }, cost: 4,
    teaches: 'Cập nhật niềm tin khi có thông tin mới — không phải khi giá đã chạy.' },
  { id: 'ps_tin_chinh_sach', label: 'Tin chính sách → trú ẩn', faction: 'vi_mo',
    signal: 'th_tin_chinh_sach', condition: 'dk_dang_lo', action: 'l_don_tru_an',
    params: { thresholdBp: 0, sizeBp: 3_000 }, cost: 4,
    teaches: 'Bất định chính sách là loại rủi ro không tính bằng biểu đồ.' },
] as const;

export function findPreset(id: string): PresetSpec | undefined {
  return PRESETS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// TIN TỨC — sự kiện giữa phase (D15 mục 5, Prompt B VIỆC 3)
// ---------------------------------------------------------------------------

export type NewsKind = 'lai_suat' | 'ty_gia' | 'chinh_sach' | 'nhieu';

export interface NewsSpec {
  id: string;
  kind: NewsKind;
  headline: string;
  /** Tác động drift tức thời lên từng tài sản, bp/tick trong 3 tick. */
  impactBp: Partial<Record<AssetId, number>>;
  /** Bóp thanh khoản trong 3 tick (bp, 10.000 = không đổi). */
  liquiditySqueezeBp: number;
  /** true = tin NHIỄU: nghe kêu to nhưng tác động ~0. Dạy phân biệt tín hiệu. */
  isNoise: boolean;
}

export const NEWS: readonly NewsSpec[] = [
  { id: 'n_tang_lai', kind: 'lai_suat', headline: 'NHNN tăng lãi suất điều hành +50bps',
    impactBp: { cp_ngan_hang: -260, cp_cong_nghe: -330, cp_ban_le: -220, bds: -300, tpcp: 90, tien_gui: 35 },
    liquiditySqueezeBp: 6_000, isNoise: false },
  { id: 'n_giam_lai', kind: 'lai_suat', headline: 'NHNN hạ lãi suất điều hành −25bps',
    impactBp: { cp_ngan_hang: 200, cp_cong_nghe: 260, cp_ban_le: 165, bds: 220, tpcp: -55 },
    liquiditySqueezeBp: 10_000, isNoise: false },
  { id: 'n_ty_gia_cang', kind: 'ty_gia', headline: 'Tỷ giá USD/VND chạm trần biên độ',
    impactBp: { usd: 290, vang: 180, cp_cong_nghe: -185, cp_ban_le: -130 },
    liquiditySqueezeBp: 7_000, isNoise: false },
  { id: 'n_ty_gia_ha', kind: 'ty_gia', headline: 'NHNN bán ngoại tệ can thiệp, tỷ giá hạ nhiệt',
    impactBp: { usd: -220, vang: -110, cp_ngan_hang: 110 },
    liquiditySqueezeBp: 10_000, isNoise: false },
  { id: 'n_room_ngoai', kind: 'chinh_sach', headline: 'Nới room ngoại khối ngân hàng',
    impactBp: { cp_ngan_hang: 330, cp_ban_le: 110 },
    liquiditySqueezeBp: 10_000, isNoise: false },
  { id: 'n_siet_bds', kind: 'chinh_sach', headline: 'Siết tín dụng bất động sản',
    impactBp: { bds: -400, cp_ngan_hang: -145 },
    liquiditySqueezeBp: 5_000, isNoise: false },
  { id: 'n_goi_kich_cau', kind: 'chinh_sach', headline: 'Công bố gói kích cầu tiêu dùng',
    impactBp: { cp_ban_le: 310, cp_cong_nghe: 145 },
    liquiditySqueezeBp: 10_000, isNoise: false },
  // --- Tin NHIỄU: tiêu đề kêu to, tác động ~0. Người chơi phải học phân biệt. ---
  { id: 'n_nhieu_tin_dung', kind: 'nhieu', headline: 'Tín dụng toàn hệ thống tăng trần quý',
    impactBp: { cp_ngan_hang: 5 }, liquiditySqueezeBp: 10_000, isNoise: true },
  { id: 'n_nhieu_hoi_thao', kind: 'nhieu', headline: 'Hội thảo triển vọng thị trường 2027',
    impactBp: {}, liquiditySqueezeBp: 10_000, isNoise: true },
  { id: 'n_nhieu_bao_cao', kind: 'nhieu', headline: 'Báo cáo phân tích khuyến nghị MUA hàng loạt',
    impactBp: { cp_cong_nghe: 8, cp_ban_le: 5 }, liquiditySqueezeBp: 10_000, isNoise: true },
] as const;

/**
 * Số tick tin tức còn tác động sau khi ra.
 *
 * Hiệu chỉnh 19/07 sau Monte Carlo: bản đầu để tin tác động 50–110 bp trong
 * 3 tick, trong khi riêng nhiễu mỗi tick của CP Công nghệ đã ±132 bp. Tin bị
 * nhiễu nuốt chửng → bot "phản ứng tin hoàn hảo" KHÔNG hơn nổi bot thường
 * (hạng 2,90 vs 2,96), tức là đọc tin vô dụng, tức là trò chơi thuần may rủi.
 * Đó là hỏng thẳng A1: dữ liệu hành vi thu về sẽ không đo được kỹ năng gì.
 * Nay tin tác động ~3× và kéo dài 5 tick — đủ nổi trên nền nhiễu để việc đọc
 * đúng tin (và BỎ QUA tin nhiễu) trở thành kỹ năng có thưởng.
 */
export const NEWS_EFFECT_TICKS = 5;

/**
 * Cửa sổ phản ứng: sau khi tin ra, người chơi có N tick để đặt LỆNH KHẨN.
 * Lệnh khẩn chịu phí 1% (floor) — trả giá cho việc chen ngang giữa vòng.
 */
export const URGENT_ORDER = {
  WINDOW_TICKS: 4,
  FEE_BP: 100,
  MAX_PER_ROUND: 1,
} as const;
