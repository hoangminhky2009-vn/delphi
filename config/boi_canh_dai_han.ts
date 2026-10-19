/**
 * ═══ BỐI CẢNH DÀI HẠN — sóng công nghệ × pha nợ (D574, cổng `boiCanhDaiHan`, khoá balance-v67-boicanh) ═══════════════════
 *
 * SPEC `docs/spec/boi-canh-dai-han.md` (CHỐT bản 1, founder 10/10) · demo `docs/ui-ux/demo/boi-canh-dai-han.html`.
 * Founder 10/10: ba chu kỳ lồng nhau — năng suất & công nghệ (siêu dài hạn) · nợ & tín dụng (trung hạn) · tâm lý (ngắn hạn, dùng
 * cơ chế sẵn có). Mỗi trận ẩn HAI lớp, rút một lần từ seed:
 *   SÓNG CÔNG NGHỆ  len | bao_hoa      PHA NỢ  noi | cang   (Nới có thể chuyển sang Căng ĐÚNG MỘT LẦN, ở một kỳ họp)
 * Hai lớp cùng chiều ⇒ CỘNG HƯỞNG (Siêu Bò / Siêu Gấu, ±150 bp/ô). Ngược chiều ⇒ BÙ TRỪ: thị trường chung gần ngang, Tech
 * (= Cổ tech, mã `cp_cn`) và Đầu cơ (= Crypto, mã `btc`) tách nhau. Ô Bão hoà + Nới là BẪY GIÁ TRỊ; Bẫy chuyển Căng = ĐỔ ĐÈO.
 *
 * ⚠ A8.2 — MỌI SỐ DƯỚI ĐÂY LÀ PLAYTEST-TUNE. Số trong bảng nghiêng / độ dài mùa chép từ SPEC §5 (founder đề xuất, lấy giữa
 *   khoảng khi SPEC ghi khoảng); số KHÔNG có trong SPEC (tần suất bốn bối cảnh, xác suất chuyển nợ, độ nghiêng kỳ họp) là đề
 *   xuất của agent — đo gate rồi founder chốt. Không người chơi thật nào đã chơi trên bảng này.
 * ⚠ Bảng này CHỈ được đọc qua `server/holdem/boi_canh_dai_han.ts` + `sinhMap` + `lechBoiCanh` (engine) — không bản sao (A11.5).
 */
import type { TinhChatPha } from './holdem.js';

export type SongCongNghe = 'len' | 'bao_hoa';
export type PhaNo = 'noi' | 'cang';
/** Bốn bối cảnh = (sóng, nợ). Tên theo founder 10/10. */
export type BoiCanhId = 'sieu_bo' | 'sieu_gau' | 'len_cang' | 'bay_gia_tri';

export const BOI_CANH_CUA: Readonly<Record<SongCongNghe, Readonly<Record<PhaNo, BoiCanhId>>>> = {
  len: { noi: 'sieu_bo', cang: 'len_cang' },
  bao_hoa: { noi: 'bay_gia_tri', cang: 'sieu_gau' },
};

export interface BanhXeBoiCanh {
  /** Độ dài (ô pha) theo LOẠI mùa — đè `BANH_XE_MUA.CO_NGOI.HAN`; loại vắng ⇒ bảng gốc. */
  HAN?: Partial<Record<TinhChatPha, readonly [number, number]>>;
  /** Hết PHÂN PHỐI: khả năng tăng lại — đè `CO_NGOI.PHAN_PHOI_LEN_BP` (gốc 2000). */
  PHAN_PHOI_LEN_BP?: number;
  /** Hết TÍCH LŨY: khả năng đáy kép KHÔNG cần ngòi tin xấu (gốc: chỉ khi có tin xấu thật). */
  TICH_LUY_ROI_BP?: number;
  /** Mùa TĂNG vào lúc tiền rẻ vẫn là bò DÒNG TIỀN với khả năng này (gốc 10000 = luôn). */
  DONG_TIEN_BP?: number;
  /** Hệ số nhân trọng số rút lá Bong bóng (10000 = ×1). */
  BONG_BONG_X_BP?: number;
  /** Hệ số nhân trọng số rút các lá hoảng loạn (D390: bảy tin hiện là MỘT lá Thiên nga đen — `TINH_CHAT_NEN` 'hoang_loan'). */
  HOANG_LOAN_X_BP?: number;
  /** Đám đông nền trong màn minigame dày gấp đôi (`damDongNen`). */
  DAM_DONG_X2?: true;
}

export const BOI_CANH_DAI_HAN = {
  /** Khả năng sóng công nghệ LÊN · pha nợ mở màn NỚI (đề xuất: đều ⇒ bốn bối cảnh 25 % mỗi ô). */
  SONG_LEN_BP: 5000,
  NO_NOI_BP: 5000,
  /** Trận mở màn Nới: khả năng chuyển sang Căng ở MỘT kỳ họp (rút đều trong các kỳ họp của bàn). Founder 10/10 chọn P3: 25 % (đề xuất đầu 50 %). */
  CHUYEN_NO_BP: 2500,
  /**
   * KỲ HỌP NGHIÊNG THEO PHA NỢ (đề xuất): Nới ⇒ hàm phản ứng đòi GIỮ thì HẠ với khả năng `GIU_THANH_HUONG_BP`, đòi TĂNG thì GIỮ
   * với khả năng `NGUOC_THANH_GIU_BP`; Căng đối xứng (giữ ⇒ tăng · hạ ⇒ giữ). Kỳ họp CHUYỂN NỢ luôn TĂNG thật (SPEC §4.2).
   */
  // Founder 10/10 chọn P3: nửa đề xuất đầu (5000 / 3000) — bộ đầu đẩy "Đa dạng hoá" thắng 39,8 % (G1 ✗, D574).
  KY_HOP: { GIU_THANH_HUONG_BP: 2500, NGUOC_THANH_GIU_BP: 1500 },
  /**
   * NGHIÊNG MỖI Ô (bp, cộng vào lợi suất nền của mã ở mọi ô). Founder 10/10 chọn P3: NỬA bảng SPEC §5, cắt về 0 (bộ đầu Siêu Bò / Siêu Gấu
   * ±150 · Tech/Đầu cơ ±100 · Bẫy giá trị Crypto +250 / lõi −35 / Vàng +75 làm G1 đỏ — D574).
   */
  NGHIENG_BP: {
    sieu_bo: { btc: 75, cp_cn: 75, vn30: 50, vang: -25, usd: 0, tpcp: -25 },
    sieu_gau: { btc: -75, cp_cn: -75, vn30: -50, vang: 50, usd: 25, tpcp: 0 },
    // Bù trừ — năng suất thật, tiền đắt: Tech ↔ Đầu cơ tách nhau, thị trường chung gần ngang.
    len_cang: { btc: -50, cp_cn: 50, vn30: 0, vang: -10, usd: 15, tpcp: -15 },
    // Bẫy giá trị — Đầu cơ xanh nhất bàn · lõi (Blue-chip, Cổ tech) rỉ xuống · Vàng nhích (tiền mất giá) · TP 0.
    bay_gia_tri: { btc: 125, cp_cn: -17, vn30: -17, vang: 37, usd: 0, tpcp: 0 },
  } satisfies Record<BoiCanhId, Record<string, number>>,
  /**
   * ĐỔ ĐÈO (SPEC §5): Bẫy giá trị chuyển Căng ở kỳ họp TĂNG lãi ⇒ ô NGAY SAU kỳ họp, đầu cơ đảo thành −300 bp (thay cho dòng của
   * bối cảnh mới); mã khác theo bối cảnh mới (Siêu Gấu). Không trễ tâm lý. Giữ −300 của SPEC (founder đặt) — KHÔNG nhân nửa như bảng nghiêng.
   */
  DO_DEO_BP: { btc: -300 } as Readonly<Record<string, number>>,
  /** Sau kỳ họp chuyển nợ (không phải Bẫy giá trị): NGÒI gấu chu kỳ — mùa lên còn lại rút ngắn, phân phối luôn phá xuống. */
  NGOI_NO: {
    /** Hạn của mùa lên / quá nóng / phân phối rút SAU khi ngòi mở (thay cho bảng của bối cảnh). */
    HAN: { tang_truong: [1, 2], dong_tien: [1, 2], phan_phoi: [1, 1] } as Partial<Record<TinhChatPha, readonly [number, number]>>,
    /** Quá nóng (`bien_dong`, không có loại) dưới ngòi. */
    HAN_QUA_NONG: [1, 1] as readonly [number, number],
  },
  /** Bánh xe mùa theo bối cảnh — SPEC §5 cột "độ dài / rẽ mùa". */
  BANH_XE: {
    // Tăng 6–10 ô · Giảm 1–2 · hết Phân phối 40 % quay lên · Bong bóng ×1,5.
    sieu_bo: { HAN: { tang_truong: [6, 10], dong_tien: [6, 10], gau_chu_ky: [1, 2], gau_dinh_gia: [1, 2] }, PHAN_PHOI_LEN_BP: 4000, BONG_BONG_X_BP: 15000 },
    // Tăng 2–4 ô (hồi trong gấu) · Giảm 3–5 · đáy kép 30 %.
    sieu_gau: { HAN: { tang_truong: [2, 4], dong_tien: [2, 4], gau_chu_ky: [3, 5], gau_dinh_gia: [3, 5] }, TICH_LUY_ROI_BP: 3000 },
    // Bò tăng trưởng nhiều, bò dòng tiền ít (30 % số lần tiền rẻ) · Đi ngang dài hơn (2–3 ô).
    len_cang: { HAN: { phan_phoi: [2, 3], tich_luy: [2, 3] }, DONG_TIEN_BP: 3000 },
    // Phân phối 2–3 ô · Bong bóng, Thiên nga đen ×2 · đám đông trong màn ×2.
    bay_gia_tri: { HAN: { phan_phoi: [2, 3] }, BONG_BONG_X_BP: 20000, HOANG_LOAN_X_BP: 20000, DAM_DONG_X2: true },
  } satisfies Record<BoiCanhId, BanhXeBoiCanh>,
  /**
   * TIN VĨ MÔ trong màn (SPEC §5): ~1/3 số màn có MỘT dòng, nói về MỘT lớp (đều hai lớp), đúng `DUNG_BP`. Cùng một dòng cho mọi ghế
   * ở cùng vòng (tin vĩ mô là của cả chợ). MÙ TIN che như mọi tin trong màn.
   */
  // Founder 10/10 chọn B: 1/2 số màn × đúng 85 % (SPEC đầu 1/3 × 65 % ⇒ đoán đúng cả bối cảnh 48 %, lớp nợ gần như không đọc được — D574).
  TIN_VI_MO: { TY_LE_MAN_BP: 5000, LOP_SONG_BP: 5000, DUNG_BP: 8500 },
} as const;

/** Lớp + trạng thái mà một dòng tin vĩ mô NÓI (có thể nói sai — 35 %). */
export type TrangThaiLop = SongCongNghe | PhaNo;

/**
 * Số mẫu chữ cho từng (lớp, trạng thái) — chữ ở client (`config/minigame_tin.ts` `VI_MO_TIN`, D26). Bài canh khoá hai bảng cùng độ dài.
 */
export const SO_MAU_VI_MO = 5;
