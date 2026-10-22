/**
 * MIỀN CỦA BẢNG — chỉ để `scripts/sinh_erd.ts` gom ERD thành tám sơ đồ đọc được (D3, SPEC
 * `va-bao-mat-chuan-hoa-api-dot-1.md`). Không phải luật dữ liệu: không code nghiệp vụ nào đọc tệp này.
 *
 * Luật chia: TIỀN TỐ dài nhất khớp tên bảng thắng; `NGOAI_LE` (tên đúng) thắng mọi tiền tố. Bảng mới không
 * khớp gì ⇒ `erd:ghi` NÉM, bắt người thêm bảng khai miền ở đây — không có ô "khác" để bảng lạc vào im lặng.
 */
export interface Mien {
  ma: string;
  ten: string;
  /** Tiền tố tên bảng; một tên bảng trọn vẹn cũng là tiền tố của chính nó. */
  tienTo: readonly string[];
}

export const MIEN: readonly Mien[] = [
  { ma: 'auth', ten: 'Sign-in (auth)', tienTo: ['auth_'] },
  {
    ma: 'nguoi_dung',
    ten: 'Users & profiles',
    tienTo: [
      'users', 'user_', 'ho_so_', 'tu_khai', 'avatar_', 'cosmetic_', 'kho_sticker', 'huy_hieu_', 'gacha_',
      'vat_pham_', 'dot_phat_hanh', 'lo_trinh_', 'nhiem_vu_', 'qua_beta_', 'season_',
    ],
  },
  { ma: 'dau_truong', ten: 'Arena', tienTo: ['holdem_', 'rank_', 'sandbox_', 'bxh_'] },
  // Bảy sổ append-only (A3): đuôi `_ledger`; hai sổ mang tiền tố miền khác nằm ở NGOAI_LE.
  { ma: 'kinh_te', ten: 'Economy — seven ledgers', tienTo: ['wallet_', 'treasury_', 'burn_', 'quest_', 'quy_cho_'] },
  { ma: 'cho', ten: 'Prediction market (frozen)', tienTo: ['market', 'bet', 'scores'] },
  { ma: 'pfm', ten: 'PFM — spending ledger', tienTo: ['pfm_'] },
  { ma: 'du_lieu', ten: 'Data & telemetry', tienTo: ['events', 'telemetry', 'hanh_vi_', 'khach_'] },
  { ma: 'van_hanh', ten: 'Operations / admin', tienTo: ['admin_', 'scheduler_', 'schema_', 'bao_loi'] },
];

/** Bảng mà tiền tố đặt nhầm miền. */
export const NGOAI_LE: Readonly<Record<string, string>> = {
  rank_ledger: 'kinh_te',
  pfm_token_ledger: 'kinh_te',
  // Bảng xếp hạng Brier của chợ (0001, A6), không phải hạng đấu trường.
  rank_snapshots: 'cho',
};
