/**
 * PFM — ORACLE: nội dung bậc 1 (gương đúng lúc) + bậc 2 (boost) + lời mời bậc 3
 * (luật tự đặt) — GĐ7, thang can thiệp `dan-dat-hanh-vi-ca-nhan-hoa.md` §2.
 *
 * ⚠⚠ NỘI DUNG Ở ĐÂY LÀ CHỖ GIỮ (PLAYTEST-TUNE), KHÔNG PHẢI GIỌNG ORACLE THẬT.
 * Giọng/cá tính cố định + cơ chế khịa-khen đã có luật riêng ở
 * `docs/thiet-ke-de-xuat/noi-dung/oracle-bo-luat-giong.md` — đó là một đợt NỘI DUNG
 * riêng (biên tập + kiểm trích dẫn), không phải việc của GĐ7. File này xây CƠ
 * CHẾ: chọn nội dung nào, khi nào, và ghi nhãn đo — đúng khuôn `hu_mau.ts` cho
 * gói nội dung tĩnh, nhưng KHÔNG tự nhận là bản đã chốt giọng.
 *
 * ⚠ P14 (không màn hình trống) + P13 (nội dung tĩnh có id, minh bạch "vì sao
 * bạn thấy thứ này") đều thi hành ở đây: mọi thẻ có `id` cố định + trường
 * `viSao`; `chonNoiDung()` là hàm THUẦN, tất định — không "thông minh" hơn mức
 * cần, cùng lý lẽ `mauHopVoiHoSo()`.
 *
 * ⚠⚠ KHÔNG TỰ LEO BẬC — ĐÂY LÀ RANH CỨNG. `moi_dat_luat` (bậc 3) chỉ là một LỜI
 * MỜI hiển thị; file này KHÔNG import bất kỳ hàm TẠO/SỬA luật nào từ `luat.ts`
 * (chỉ đọc `Luat`/`tyLeGiuLuat` nếu cần đếm — hiện tại còn không cần cả điều
 * đó). Người dùng phải tự chạm "đặt luật" ở một màn khác thì `taoLuatMoi` mới
 * chạy — Oracle không bao giờ tạo hộ. Có bài test cấu trúc canh đúng import này.
 *
 * ⚠ P10: "gương/boost/lời-mời hiển thị → telemetry" — `ghiHienThi`/
 * `ghiTuongTac` gọi thẳng `ghiDo()` có sẵn, KHÔNG chờ tầng cuốn `iv_*` (GĐ hoãn
 * — xem D233): telemetry thô giữ 90 ngày là đủ để không mất tín hiệu ngay bây
 * giờ, tầng cuốn thành đặc trưng là việc sau.
 */
import { PFM } from '@config/pfm';
import { ghiDo } from '../lib/telemetry.js';
import { type KhoPfm } from './kho.js';
import { type GuongKy } from './guong.js';
import { xacSuatVuotMoc } from './do_chac.js';

/* ── Nội dung: TĨNH, có id (P13) ──────────────────────────────────────────── */

export const BAC_CAN_THIEP = [1, 2, 3] as const;
export type BacCanThiep = (typeof BAC_CAN_THIEP)[number];

export interface NoiDungOracle {
  id: string;
  bac: BacCanThiep;
  /** Câu hiển thị — MÔ TẢ + CÂU HỎI, không kê đơn (A10 🔒). Quét TU_KE_DON. */
  cau: string;
  /** "Vì sao bạn thấy thứ này" (P13, minh bạch). Quét TU_KE_DON. */
  viSao: string;
}

/**
 * GÓI NỘI DUNG v1 — cố ý NGẮN (cùng lý lẽ `MAU_HU`: menu nhỏ thắng menu mở với
 * người mới). Thứ tự trong mảng LÀ thứ tự ưu tiên khi nhiều thẻ cùng đủ điều
 * kiện — `chonNoiDung()` trả thẻ ĐỦ ĐIỀU KIỆN đầu tiên, không trộn ngẫu nhiên.
 */
export const NOI_DUNG: readonly NoiDungOracle[] = [
  {
    id: 'boost_chi_bu', bac: 2,
    cau: 'Một mẫu hình xuất hiện trong sổ của bạn: ngày sau một ngày chi nhiều, '
      + 'mức chi thường vẫn cao hơn bình thường.',
    viSao: 'Chỉ số chi-bù tháng này của bạn đang ở mức đáng nhìn qua.',
  },
  {
    id: 'boost_vi_sale', bac: 2,
    cau: 'Một phần khoản chi tháng này được chính bạn gắn nhãn "vì sale" hoặc "bạn rủ".',
    viSao: 'Đây là tỷ lệ bạn tự khai — app không đoán con số này.',
  },
  {
    id: 'guong_tien_ve', bac: 1,
    cau: 'Có khoản tiền về trong sổ tháng này. Muốn xem 48 giờ sau đó thường trôi qua thế nào không?',
    viSao: 'Cửa sổ "tiền vừa về" là lúc gương này có ý nghĩa nhất.',
  },
  {
    id: 'guong_dau_thang', bac: 1,
    cau: 'Tháng mới bắt đầu. Muốn xem lại tháng trước bạn ghi được bao nhiêu ngày không?',
    viSao: 'Đầu tháng là lúc nhìn lại tháng cũ rõ nhất, trước khi ký ức mờ dần.',
  },
  /*
   * ⭐ LỜI MỜI ĐẶT LUẬT ĐỨNG CUỐI, KHÔNG ĐỨNG ĐẦU (R13).
   * Thứ tự mảng LÀ thứ tự ưu tiên, nên để nó đầu danh sách nghĩa là: hễ user chưa
   * có luật nào thì Oracle LUÔN mời đặt luật, che mất mọi tấm gương và mọi boost
   * đang đủ điều kiện. Tức thẻ MỜI LEO BẬC lấn át thẻ MÔ TẢ — đúng thứ §2 của thang
   * can thiệp cấm: "user leo thang theo lựa chọn của HỌ, không bị đẩy".
   * Gương và boost tả thứ ĐÃ XẢY RA trong sổ; lời mời chỉ là một cánh cửa. Cánh cửa
   * nhường chỗ cho tấm gương, không phải ngược lại.
   */
  {
    id: 'moi_dat_luat', bac: 3,
    cau: 'Sổ của bạn đang chạy. Muốn tự đặt một luật nếu-thì cho chính mình không? '
      + 'Bạn viết, Oracle chỉ nhắc lại đúng lời bạn khi điều kiện đó xảy ra.',
    viSao: 'Bạn chưa có luật nào đang bật — đây là lối vào bậc sâu nhất của thang can thiệp.',
  },
] as const;

/* ── Chọn nội dung: hàm THUẦN, tất định ───────────────────────────────────── */

export interface TinHieuChonNoiDung {
  /** Ngày hôm nay, `'YYYY-MM-DD'` — người gọi đưa vào, file này không đọc đồng hồ. */
  homNay: string;
  guong: GuongKy;
  /** Số luật đang BẬT (không tính luật đã tắt/xoá). */
  soLuatDangBat: number;
  /** id nội dung đã hiện TRONG KỲ NÀY — xem `docDaHienKy`. */
  daHienKy: ReadonlySet<string>;
}

function duDieuKien(nd: NoiDungOracle, tin: TinHieuChonNoiDung): boolean {
  if (tin.daHienKy.has(nd.id)) return false;
  switch (nd.id) {
    case 'moi_dat_luat':
      // ⚠ KHÔNG gate theo tuổi sổ — founder chốt "làm cả bậc 3 ngay từ đầu",
      // không đợi sổ ổn định 1 tháng như đề xuất mặc định (03/09).
      return tin.soLuatDangBat === 0;
    /*
     * ⚠⚠ D354 — HAI THẺ BOOST TẢ MỘT "MẪU HÌNH", NÊN PHẢI CHẮC LÀ CÓ MẪU HÌNH. Luật cũ (`gt` vượt
     * ngưỡng, sàn 3 quan sát) bắn `boost_chi_bu` ở 37,5% số tháng của một cuốn sổ KHÔNG có chi bù
     * nào (D353) — thẻ nói "một mẫu hình xuất hiện trong sổ của bạn" với người không có mẫu hình.
     * Nay hai điều kiện cùng phải đúng:
     *   · ngưỡng cũ GIỮ NGUYÊN — nó giữ cho chữ "thường" trong câu của thẻ còn đúng;
     *   · hậu nghiệm nói tỷ lệ thật vượt MỐC với xác suất ≥ `ORACLE_DO_CHAC`.
     * Mốc của chi bù là MỐC NỀN của chính sổ này (`nenNgauNhien`), không phải một hằng số: người
     * ghi đủ ngày có nền ≈ 0,5, người ghi thưa có nền thấp hơn nhiều.
     * `Math.round(gt × n)` lấy lại đúng số đếm: `gt` là một phân số trên `n` nguyên nhỏ.
     */
    case 'boost_chi_bu': {
      const c = tin.guong.chi_bu;
      if (c.gt === null || c.nenNgauNhien === null) return false;
      if (c.gt <= PFM.ORACLE_NGUONG_CHI_BU) return false;
      return xacSuatVuotMoc(Math.round(c.gt * c.n), c.n, c.nenNgauNhien, PFM.TIEN_NGHIEM_K)
        >= PFM.ORACLE_DO_CHAC;
    }
    case 'boost_vi_sale': {
      const v = tin.guong.vi_sale;
      if (v.gt === null) return false;
      return xacSuatVuotMoc(Math.round(v.gt * v.n), v.n, PFM.ORACLE_NGUONG_VI_SALE, PFM.TIEN_NGHIEM_K)
        >= PFM.ORACLE_DO_CHAC;
    }
    case 'guong_tien_ve':
      return tin.guong.tien_ve_tieu.gt !== null;
    case 'guong_dau_thang':
      return Number(tin.homNay.slice(8, 10)) <= 3;
    default:
      return false;
  }
}

/**
 * Chọn MỘT thẻ để hiện, hoặc `null` nếu không có gì đủ điều kiện — im lặng là
 * một kết quả hợp lệ (không phải lỗi), đúng tinh thần "không giục" của gương.
 */
export function chonNoiDung(tin: TinHieuChonNoiDung): NoiDungOracle | null {
  return NOI_DUNG.find((nd) => duDieuKien(nd, tin)) ?? null;
}

/* ── "Đã hiện kỳ này chưa" — dùng ngăn kho `nhip` (đã khai sẵn, GĐ5) ──────── */

interface TrangThaiHienKy { ky: string; daHien: string[] }

const idBanGhiHien = (ky: string): string => `oracle_hien_${ky}`;

/** Đọc tập id đã hiện trong kỳ `ky` ('YYYY-MM'). Không mở ghi. */
export async function docDaHienKy(kho: KhoPfm, ky: string): Promise<ReadonlySet<string>> {
  const b = await kho.doc<TrangThaiHienKy>('nhip', idBanGhiHien(ky));
  return new Set(b?.d.daHien ?? []);
}

/** Ghi nhận MỘT id vừa hiện — idempotent (gọi hai lần không nhân đôi). */
export async function ghiDaHienKy(
  kho: KhoPfm, ky: string, idNoiDung: string, luc: string,
): Promise<void> {
  const hienTai = await docDaHienKy(kho, ky);
  if (hienTai.has(idNoiDung)) return;
  await kho.ghi('nhip', {
    id: idBanGhiHien(ky), thang: ky, suaLuc: luc,
    d: { ky, daHien: [...hienTai, idNoiDung] } satisfies TrangThaiHienKy,
  });
}

/* ── Đo (P10 — can thiệp có nhãn từ commit đầu) ───────────────────────────── */

/** Một thẻ Oracle vừa HIỆN LÊN MÀN — gương/boost/lời-mời hiển thị → telemetry. */
export function ghiHienThi(nd: NoiDungOracle): void {
  ghiDo('oracle_hien', { chi_tiet: { noi_dung: nd.id, bac: nd.bac } });
}

export const TUONG_TAC_ORACLE = ['xem_them', 'bo_qua', 'chap_nhan_moi'] as const;
export type MaTuongTacOracle = (typeof TUONG_TAC_ORACLE)[number];

/**
 * User vừa TƯƠNG TÁC với một thẻ (mở rộng xem, bỏ qua, hoặc — cho `moi_dat_luat`
 * — chấp nhận lời mời và ĐI SANG màn đặt luật, KHÔNG PHẢI đã đặt luật xong).
 */
export function ghiTuongTac(nd: NoiDungOracle, hanhDong: MaTuongTacOracle): void {
  ghiDo('oracle_tuong_tac', { chi_tiet: { noi_dung: nd.id, hanh_dong: hanhDong } });
}
