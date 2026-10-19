/**
 * BA KỸ NĂNG (D323, gộp 13/09) — tự điển CÂU CHỮ cho BA DẤU KỸ NĂNG in trên mặt THẺ tính
 * cách, ở dải "GHI VÀO THẺ" đáy khối PHONG CÁCH màn kết, và ở nắp TRONG TRẬN của Gương.
 * Server (`server/holdem/nang_luc.ts`) chỉ trả ID + bậc + số; MỌI chữ nằm ở đây để bài quét
 * A10 đọc được — cùng kiến trúc với `lib/khoanh_khac.ts` và thẻ tính cách (D26).
 *
 * ─── VÌ SAO KHÔNG CÒN KHỐI/TAB RIÊNG (founder 13/09) ─────────────────────────
 * *"chia ra nhiều quá thì thừa thãi và rối"* + *"phong cách cá nhân phải nổi bật nhất để
 * flex"*. Đo lúc ấy: sau một trận người chơi bị chấm ở SÁU chỗ, khối năng lực (469px) cao gấp
 * đôi khối phong cách (219px). Nên kỹ năng thôi là một bảng điểm: nó là DÒNG CHỈ SỐ nhỏ in
 * trên chính lá bài tính cách, cùng một hình ở cả ba chỗ. Tên ngắn (`ngan`) cho người chơi;
 * tên khung đầy đủ nằm sau dấu chấm than và ở trang nhóm.
 *
 * ─── VÌ SAO GỌI TÊN THEO KHUNG NGOÀI ────────────────────────────────────────
 * Người ngoài (giáo viên, nhà tài trợ chương trình) không đọc được `SSS` hay
 * `doan_mo`. Mỗi năng lực mang tên theo OECD/INFE Core Competencies for Youth
 * (2015) và bài tương ứng trong môn GDKT&PL (GDPT 2018) — thứ họ đã quen chấm.
 * Câu chữ theo demo D323 `docs/ui-ux/demo/the-nang-luc.html`; bố cục ở đó (khối riêng ở màn kết
 * + tab NĂNG LỰC riêng) đã được thay bằng ba dấu 13/09.
 *
 * ─── LUẬT VIẾT, KHOÁ BẰNG TEST (`web/tests/nang_luc.test.tsx`) ──────────────
 * · MÔ TẢ, KHÔNG KÊ ĐƠN (A10): không một từ trong `TU_KE_DON` — kể cả "cần" và
 *   "phải" (bộ quét thô không phân biệt được "cần tiền" với "cần bớt").
 * · Ba bậc là BẰNG CHỨNG, không phải điểm: "chưa vững" không phải lỗi, không tô đỏ.
 * · CON SỐ KHÔNG NẰM TRONG CHỮ — số là dữ liệu, đi qua tham số (D26 cùng lý lẽ
 *   `CHU_MAN_GUONG`); thiếu mẫu hiện `—`, KHÔNG BAO GIỜ `0` (P7/D62).
 * · Ngoài đời NÓ LÀ GÌ (D28: đặc điểm thật), không nói "ngoài đời bạn sẽ…".
 */
import { NGUONG_NANG_LUC, type BacNangLuc, type NangLucId } from '@config/nang_luc';
import type { NangLucTran } from '@server/holdem/nang_luc_ids';

export interface TheNangLuc {
  /** Tên năng lực đầy đủ — sau dấu chấm than, trang nhóm. */
  ten: string;
  /**
   * Tên NGẮN in trên dấu — hai chữ, KHÁC hẳn ba trục phong cách (ĐỌC · THẮNG CHỢ · TRỤ) để
   * màn kết không có hai thứ cùng tên "đọc" mang hai con số.
   */
  ngan: string;
  /** Ngoài đời nó là gì — một câu, không thuật ngữ chưa dịch. */
  ngoai_doi: string;
  /** Tên đầy đủ trong khung OECD/INFE, và bài GDKT&PL nếu có. */
  khung: { oecd: string; gdkt?: string };
}

export const TEN_NANG_LUC: Record<NangLucId, TheNangLuc> = {
  cam_ket_tiet_kiem: {
    ten: 'GIỮ CAM KẾT TIẾT KIỆM',
    ngan: 'GIỮ SỔ',
    ngoai_doi: 'Khoá một khoản có kỳ hạn rồi giữ tới hạn, kể cả khi giữa chừng có việc muốn tiêu.',
    khung: {
      oecd: 'Lập kế hoạch & quản lý tài chính',
      gdkt: 'GDKT&PL 10 · Lập kế hoạch tài chính cá nhân',
    },
  },
  doc_tin: {
    ten: 'ĐỌC TIN, HIỆU CHỈNH NIỀM TIN',
    ngan: 'LỌC TIN',
    ngoai_doi: 'Nghe một tin về tiền, không tin ngay cũng không gạt ngay, mà kiểm nó bằng chuyện xảy ra sau đó.',
    khung: { oecd: 'Bối cảnh tài chính — thông tin sai, lừa đảo' },
  },
  phan_tan: {
    ten: 'PHÂN TÁN RỦI RO',
    ngan: 'CHIA GIỎ',
    ngoai_doi: 'Không dồn hết vào những thứ cùng lên cùng xuống.',
    khung: { oecd: 'Rủi ro & phần thưởng' },
  },
};

/** Tên bậc ĐẦY ĐỦ — dòng đầu tấm chi tiết sau dấu `!` (tên kỹ năng · bậc). */
export const NHAN_BAC: Record<BacNangLuc, { ten: string }> = {
  chua_gap: { ten: 'CHƯA GẶP' },
  gap_chua_vung: { ten: 'CHƯA VỮNG' },
  lam_duoc: { ten: 'ĐÃ LÀM ĐƯỢC' },
  chung_minh: { ten: 'ĐÃ CHỨNG MINH' },
};

/**
 * Chữ bậc NHỎ in ngay dưới tên dấu — nhìn thấy, không bắt đoán màu (founder 13/09: "đừng đổi
 * thứ nhìn thấy lấy thứ phải đoán").
 */
export const BAC_NGAN: Record<BacNangLuc, string> = {
  chua_gap: 'chưa gặp',
  gap_chua_vung: 'chưa vững',
  lam_duoc: 'làm được',
  chung_minh: 'chứng minh',
};

/** Chữ cố định — số đi riêng. */
export const CHU_NANG_LUC = {
  /** Nhãn dải đáy khối PHONG CÁCH ở màn kết. */
  ghiVaoThe: 'GHI VÀO THẺ',
  banTap: 'BÀN TẬP · KHÔNG GHI VÀO THẺ',
  xemThe: 'XEM THẺ ›',
  khungPre: 'Khung: ',
  ngoaiDoiPre: 'Ngoài đời: ',
  hoiNhan: 'Chi tiết',
  /** Chi tiết theo NGƯỜI (mặt THẺ · nắp Gương): "Làm được trên 1/2 đề khác nhau · lần đầu 09/09". */
  deLamPre: 'Làm được trên ',
  deLamHau: ' đề khác nhau',
  lanDauPre: ' · lần đầu ',
  chungMinhGiai: 'Bậc chứng minh mở khi làm được trên một đề khác nữa: một lần trúng chưa tính.',
  /** D324 — dòng ở lộ trình PFM (chỉ nêu năng lực đã làm được). */
  tuTranPre: 'Trên các đề đã xong, bạn đã làm được: ',
} as const;

/** Thiếu mẫu hiện `—`, không bao giờ 0 (P7/D62). */
const so = (x: number | null | undefined): string => (x === null || x === undefined ? '—' : String(x));
/** bp → % nguyên: 4000 bp = 40%. */
const pctBp = (bp: number | null | undefined): string =>
  (bp === null || bp === undefined ? '—' : `${Math.round(bp / 100)}%`);
/** tỷ lệ 0..1 → % nguyên. */
const pctTyLe = (t: number | null | undefined): string =>
  (t === null || t === undefined ? '—' : `${Math.round(t * 100)}%`);
/** Hai số lẻ, dấu phẩy Việt. */
export const so2 = (x: number | null | undefined): string =>
  (x === null || x === undefined ? '—' : x.toFixed(2).replace('.', ','));
/** ISO → dd/mm (giờ máy người xem). */
export function ngayNgan(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface OBangChung { so: string; nhan: string }

/**
 * Ba ô số bằng chứng cho một năng lực trên MỘT đề — nhãn đúng demo. `chua_gap`
 * của phân tán che hai ô sau bằng `—` (chưa đủ vòng để đọc, không phải "0%").
 */
export function bangChungHien(id: NangLucId, tran: NangLucTran): OBangChung[] {
  const bc = tran.bang_chung;
  switch (id) {
    case 'cam_ket_tiet_kiem':
      return [
        { so: so(bc.so_vong_gui), nhan: 'SỔ ĐÃ MỞ' },
        { so: so(bc.so_huy), nhan: 'RÚT SỚM' },
        { so: pctBp(bc.ty_trong_max_bp), nhan: 'KHOÁ TỐI ĐA' },
      ];
    case 'doc_tin':
      return [
        { so: so2(bc.brier_tb), nhan: 'BRIER TB' },
        { so: so(bc.so_su_kien), nhan: 'TIN' },
        { so: so(bc.so_tin_gia), nhan: 'TIN BỊA' },
      ];
    case 'phan_tan': {
      const thieu = tran.bac === 'chua_gap';
      const nVt = bc.so_vong_vi_the ?? null;
      const tyLe = bc.ty_le_hai_nhom ?? null;
      const haiPhe = !thieu && nVt !== null && tyLe !== null ? Math.round(nVt * tyLe) : null;
      return [
        { so: so(nVt), nhan: 'VÒNG VỊ THẾ' },
        { so: so(haiPhe), nhan: 'HAI PHE' },
        { so: thieu ? '—' : pctTyLe(tyLe), nhan: 'TỶ LỆ' },
      ];
    }
  }
}

/** Câu "Trên đề này: …" theo bậc — chỉ TẢ thứ đã xảy ra; số đi qua tham số. */
export function cauTrenDe(id: NangLucId, tran: NangLucTran): string {
  const bc = tran.bang_chung;
  const dau = 'Trên đề này: ';
  switch (id) {
    case 'cam_ket_tiet_kiem':
      if (tran.bac === 'chua_gap') {
        return bc.so_vong_gui === null
          ? `${dau}luật của đề này chưa có ngân hàng, chưa có gì để đo.`
          : `${dau}bạn chưa mở sổ tiết kiệm nào.`;
      }
      if (tran.bac === 'gap_chua_vung') {
        return `${dau}có sổ bị rút trước hạn — phần lãi treo của sổ ấy đã mất.`;
      }
      return `${dau}mở sổ và giữ tới hạn, không rút sớm lần nào.`;
    case 'doc_tin':
      if (tran.bac === 'chua_gap') return `${dau}chưa đủ vòng có dự tính hoặc chưa đủ tin để đọc.`;
      if (tran.bac === 'gap_chua_vung') {
        return `${dau}dự tính của bạn còn xa kết quả (mốc "đã làm được" là Brier dưới ${so2(NGUONG_NANG_LUC.DOC_TIN.BRIER_LAM_DUOC)}).`;
      }
      return `${dau}dự tính của bạn bám kết quả.`;
    case 'phan_tan':
      if (tran.bac === 'chua_gap') {
        return `${dau}bạn chỉ có vị thế ở ${so(bc.so_vong_vi_the)} vòng — chưa đủ để đọc (mốc đọc là ${NGUONG_NANG_LUC.PHAN_TAN.VONG_VI_THE_TOI_THIEU} vòng).`;
      }
      if (tran.bac === 'gap_chua_vung') return `${dau}phần lớn vòng bạn cầm mã cùng một phe.`;
      return `${dau}từ nửa số vòng có vị thế trở lên, bạn giữ cả hai phe.`;
  }
}

/** Mọi chuỗi tự điển xuất ra — bài quét A10 đọc danh sách này, không đoán tên trường. */
export function moiChuNangLuc(): string[] {
  const ra: string[] = [];
  for (const t of Object.values(TEN_NANG_LUC)) {
    ra.push(t.ten, t.ngan, t.ngoai_doi, t.khung.oecd);
    if (t.khung.gdkt) ra.push(t.khung.gdkt);
  }
  for (const b of Object.values(NHAN_BAC)) ra.push(b.ten);
  ra.push(...Object.values(BAC_NGAN));
  ra.push(...Object.values(CHU_NANG_LUC));
  return ra;
}
