/**
 * PFM — MÀN GƯƠNG. **Làm theo DEMO ĐÃ CHỐT** (A11.25), `#manGuong` của
 * `docs/ui-ux/demo/pfm-ban-tien.html` (bản đã sửa 06/09, D290).
 *
 * ⚠ Bố cục demo, đúng thứ tự: tab → thẻ Oracle → BẢY nắp gấp (THÁNG · SO VỚI THÁNG TRƯỚC ·
 * CHI THEO NHÃN · TRÔNG NHƯ LẶP LẠI · HŨ ĐÃ HOÀN THÀNH · LUẬT NẾU-THÌ · CHỐT SỔ TUẦN) →
 * nút neo đáy CHỐT SỔ TUẦN NÀY.
 * ⭐ D426 (founder 26/09 — *"những cái ở vị trí đầu tiên / dễ nhìn nhất thì ưu tiên hữu ích"*): đầu màn giờ là BA THẺ BIỂU
 * ĐỒ luôn mở (tiền vào đi đâu · chi từng ngày · hũ tiêu dùng, có ‹ › lật tháng — `BieuDo.tsx`), rồi mới tới "tiền đi tới
 * ngày nào", thẻ Oracle và các nắp. Nắp mới: 6 THÁNG · THÓI QUEN (thay SO VỚI THÁNG TRƯỚC, thêm hai biểu đồ) · NÓI · LÀM ·
 * TRONG TRẬN (thay TRONG TRẬN — `BaMat.tsx`). Bỏ CHI THEO NHÃN: từ D410 ghi nhanh không hỏi nhãn nữa, bảng ấy chỉ còn một
 * dòng "chưa xếp"; phần phân loại mới là hũ tiêu dùng (D421/D424) — chính là thẻ thứ ba. Lịch THÁNG xuống dưới các nắp
 * phân tích; không nắp nào mở sẵn (ba thẻ đầu đã là phần đang mở).
 *
 * ⚠⚠ HAI RÀNG BUỘC CẤU TRÚC, cả hai đều là ràng buộc CHIỀU CAO chứ không phải lựa chọn
 * tương tác (§4-bis):
 *   · **Mở một nắp tự đóng nắp kia** — hai nắp cùng mở là màn lại vượt khung.
 *   · **Form đặt luật chiếm CẢ THÂN màn** (ẩn thẻ Oracle + sáu nắp kia). Đo ở demo: form
 *     đứng dưới danh sách ⇒ tràn 437px · thay chỗ danh sách ⇒ 248px · chiếm cả thân ⇒ 0.
 *
 * ⚠ A10 🔒 xuyên suốt: màn chỉ ĐẾM và TẢ. Cột "so tháng trước" của hai bảng KHÔNG tô
 * đỏ/xanh (đỏ-xanh là màu phán xét), và app không tự đề xuất một mức tiền nào — ô ngưỡng
 * của form đặt luật để TRỐNG và nói ra là trống có chủ đích.
 * ⚠ P7/D62: chỉ số thiếu mẫu hiện "chưa đủ để nói", KHÔNG BAO GIỜ hiện 0%.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PFM } from '@config/pfm';
import { Mascot } from '@/components/Mascot';
import { NutChinh } from '@/components/ui/OBento';
import { PixelIcon, type PixelIconName } from '@/components/ui/PixelIcon';
import { TamTruot } from '@/components/ui/TamTruot';
import { TamDau } from '@/screens/hub/TamDau';
import b from '@/components/pfm/PfmBento.module.css';
import { MatGuong, TEN_CAP, chuNghi, chuThuc, type OGuongNho, type TamGuong } from './GuongBento';
import { capDoiChieu, capDu, dungBaMat } from './BaMat';
import { TienToiNgay } from '@/components/pfm/TienToiNgay';
import { tienToiNgay } from '@/pfm/tien_toi_ngay';
import { LaKetToan } from '@/components/pfm/LaKetToan';
import {
  KHOA_PFM,
  KhoProvider, useCaiDatMay, useGhiKho, useHoSo, useHu, useKho, useLuat, useSoTatCa, useSoThang,
} from '@/pfm/dung_kho';
import { suaHoSo } from '@/pfm/ho_so';
import { chanDung } from '@/pfm/chan_dung';
import { CUA_CUA_DOAN } from '@/pfm/cham_doan';
import { chamKy, kyCanCham, ngayGhiDauTien, thanhTich } from '@/pfm/so_doan';
import { baoLoiNen } from '@/lib/telemetry';
import { congSo, laChiTieu, laGanChi, tongGopVaoHu, type Khoan } from '@/pfm/so';
import { guongKy, soVoiMoc } from '@/pfm/guong';
import {
  SO_NGAY_BA_MAT, SO_TUAN_THOI_QUEN, khucTienVao, lichSuThang, soCungNgay, soKhung, thangDauTien, tienDiDau, tienTungNgay,
} from '@/pfm/bieu_do';
import { BieuDoSauThang, BieuDoThang, BieuDoThoiQuen, tomSauThang } from './BieuDo';
import { ThePhanTich } from './DinhHuong';
import { TheHuong } from './TheHuong';
import {
  chonNoiDung, docDaHienKy, ghiDaHienKy, ghiHienThi, ghiTuongTac, type NoiDungOracle,
} from '@/pfm/oracle';
import {
  banLuat, dangChoDanhGia, datBat, ghiHieuQuaKy, ghiLyDoLuat, ghiNhanGiuVo, HIEU_QUA_LUAT, moLoiDoanLuat,
  suKienLuat, taoLuatMoi, type Luat, type MaHieuQuaLuat,
} from '@/pfm/luat';
import {
  CHAC, LY_DO_VI_THE, loiDoanHuHienHanh, loiDoanLuatHienHanh, tongLoiDoan,
  type MaChac, type MaLyDoViThe, type TongLoiDoan,
} from '@/pfm/vi_the';
import { MAU_LUAT, mauCanNguong, mauTheoDieuKien, type MauLuat } from '@/pfm/mau_luat';
import { xepHang } from '@/pfm/dong_bo';
import { suaBanGhi } from '@/pfm/sua_ban_ghi';
import { ghiKetQuaKy, ghiLyDoHu, KET_QUA_HU, type Hu, type MaKetQuaHu } from '@/pfm/hu';
import { cauCuoiKy, daXongCuoiKy, ghiXongCuoiKy, type CauCuoiKy } from '@/pfm/cuoi_ky';
import {
  bayGio, homNay, ngayViet, sinhId, soNgayTrongThang, thangNay, thangSauCua, thangTruocCua,
} from '@/pfm/thoi_gian';
import { useNiemPhongTuan, useTrangThaiTuan } from '@/api/pfm';
import { ApiError } from '@/api/client';
import {
  CHU_BENTO as CB, CHU_BIEU_DO as B, CHU_DIEU_KIEN, CHU_HIEU_QUA_LUAT, CHU_KET_QUA_HU, CHU_LY_DO_VI_THE,
  CHU_HUONG as H, CHU_LOI_GHI, CHU_MAN_GUONG as C, CHU_MAN_HU, CHU_VI_THE as CV, O_CHU_LOAI_CHI,
} from '@/lib/pfm_chu';
import {
  banTinThang,
  chamLuaChon, chonDongHoc, cuoiTuan as chuNhatCua, dauTuan, demQuyetDinh, hocTuQuyetDinh, noiLuaChon, tuanVuaKhep,
} from '@/pfm/huong';
import { huongMoiTuan, lanLamUuTien, luaChonTuPhuongAn, phuongAnTuan, type PhuongAnHuong } from '@/pfm/huong_hu';
import { cauHuongDangTheo } from '@/components/pfm/cau_huong';
import { NHIP_RUNG, rung } from '@/lib/rung';
import s from './Guong.module.css';

/*
 * ═══ GÓC KHẤC — ba lớp ghép sẵn ══════════════════════════════════════════════════
 *
 * ⚠⚠ MẤT GÓC KHẤC LÀ HỎNG IM LẶNG TUYỆT ĐỐI: tsc sạch, test tìm chữ vẫn xanh, và cả một
 * màn nguyên vẹn rơi khỏi chữ ký thị giác "Pixel Casino" (§XI luật 1: không bo góc, vát
 * bằng `clip-path`) mà không có gì đỏ. Demo gắn `.khac` lên 13 chỗ của `#manGuong`.
 * ⚠ Ba lớp hay lặp nhất gói sẵn ở đây thay vì chép `${s.khac}` mười lăm lần: chép tay
 * mười lăm lần là quên đúng một lần, và cái quên ấy không có triệu chứng.
 */
const NUT2 = `${s.nut2} ${s.khac}`;
const KHOI2 = `${s.khoi2} ${s.khac}`;
const O_NHO = `${s.oNho} ${s.khac}`;

/* ═══ tiện ích thuần ════════════════════════════════════════════════════════════════ */

/** Tiền ĐỒNG — cùng định dạng với màn SỔ/HŨ, tách khỏi định dạng token (tường lửa A3.5). */
function dinhDangDong(n: number): string {
  return n.toLocaleString('vi-VN');
}

/** `'2026-09'` → `9`. Demo viết "THÁNG 9 CỦA BẠN", không viết "THÁNG 09 · 2026". */
export function soThang(thang: string): number {
  return Number(thang.slice(5, 7));
}

/* `thangTruocCua` dời xuống `pfm/thoi_gian.ts` (D325 — module dữ liệu cần nó); xuất lại giữ tên cũ. */
export { thangTruocCua };

/*
 * Số ngày của một tháng. Demo cứng 30 ô; tháng thật có 28–31 và một ô thừa là một ngày
 * không tồn tại mà người dùng vẫn thấy trống — đọc ra là "hôm ấy tôi không ghi".
 * D426 — phép tính dời xuống `pfm/thoi_gian.ts` (biểu đồ cần nó); xuất lại giữ tên cũ.
 */
export { soNgayTrongThang };

/* ═══ CHỈ SỐ — năm dòng, mỗi dòng một THANH có mốc tháng trước ═══════════════════════ */

export interface DongChiSo {
  id: string;
  ten: string;
  /** Câu mẫu-số/định-nghĩa ngắn — hiện dưới thanh khi thiếu mẫu, hoặc mở đầu ô (?). */
  chu: string;
  giai: string;
  /** `null` = CHƯA ĐỦ MẪU (P7). Không bao giờ là 0 thay cho null. */
  nhan: string | null;
  n: number;
  /** Vị trí trên thanh, [0,1]. `null` khi thiếu mẫu. */
  bar: number | null;
  /** Vị trí vạch mốc tháng trước, [0,1]. `null` khi tháng trước cũng chưa đủ mẫu. */
  moc: number | null;
}

const kep01 = (x: number): number => Math.max(0, Math.min(1, x));
/** Miền [-1,1] → [0,1]: 0 (ngang mức) rơi đúng giữa thanh. */
const tuLech = (x: number): number => kep01((x + 1) / 2);
const phanTram = (x: number): string => `${Math.round(x * 100)}%`;
/** Có dấu — chỉ dùng cho dòng "so tháng trước", nơi con số là một ĐỘ LỆCH. */
const phanTramCoDau = (x: number): string => {
  const n = Math.round(x * 100);
  return n > 0 ? `+${n}%` : `${n}%`;
};

/**
 * ⭐⭐⭐ NHÃN CỦA MỘT GIÁ TRỊ CÓ THỂ ĐÃ BỊ KẸP — và nó phải NÓI RA là đã kẹp.
 *
 * ⚠⚠ `guong.ts` kẹp mọi tỷ lệ so-với-mốc về [−1, 1] rồi bật cờ `chamSan` (§`soVoiMoc`,
 * §`tietKiemRong`). Cờ ấy KHÔNG phải chi tiết nội bộ: bỏ qua nó là in "+100%" cho một
 * tháng chi GẤP BA tháng trước, tức app khẳng định một con số sai về tiền của chính người
 * dùng — và sai theo hướng NHẸ ĐI, thứ không ai kiểm lại. Tiền tố `≥`/`≤` giữ câu đúng mà
 * không phải bịa ra con số thật (miền sổ đăng ký chỉ nhận [−1, 1], A11.5).
 * ⚠ Kẹp trên ⇒ `≥`, kẹp dưới ⇒ `≤`: `kep()` trả đúng biên nên dấu của `gt` phân định được.
 */
export function nhanCoKep(
  gt: number | null, chamSan: boolean, ve: (x: number) => string,
): string | null {
  if (gt === null) return null;
  return chamSan ? `${gt > 0 ? C.vuotTran : C.duoiSan}${ve(gt)}` : ve(gt);
}

/**
 * Dựng năm dòng chỉ số từ `guongKy` (bốn dòng) + `soVoiMoc` (dòng thứ năm).
 *
 * ⚠ HAI MIỀN, HAI PHÉP ĐẶT LÊN THANH, và phải nói ra chứ không giấu: `tiet_kiem_rong` và
 * độ lệch tổng chi nằm trong **[-1,1]** (âm được), ba chỉ số còn lại nằm trong **[0,1]**.
 * Đặt thẳng một giá trị âm lên thanh là vẽ ra bề rộng âm — trình duyệt kẹp về 0 và người
 * đọc thấy "0%", đúng con số P7 cấm. Nên miền lệch đi qua `tuLech()`.
 * ⚠⚠ CON SỐ HIỂN THỊ KHÔNG PHẢI LÚC NÀO CŨNG LÀ GIÁ TRỊ THẬT — và chú thích cũ ở đây
 * khẳng định ngược lại, sai sự thật. Phép KẸP xảy ra ở tầng trên, trong `guong.ts`
 * (`soVoiMoc`, `tietKiemRong` đều `kep(raw, -1, 1)`), nên `gt` tới đây có thể đã chạm
 * biên; chỉ có cờ `chamSan` biết. `nhanCoKep()` là chỗ duy nhất đọc cờ ấy — mọi nhãn
 * của hai chỉ số bị kẹp phải đi qua nó, không nhãn nào gọi thẳng `phanTram*`.
 * ⚠ Riêng phép chuyển trục `tuLech()` thì đúng là chỉ sống trong HÌNH VẼ, không đụng nhãn.
 * ⭐ D426 — `cungNgay` (từ `bieu_do.ts` §`soCungNgay`): dòng "tổng chi" so CÙNG NGÀY tháng trước, đúng cặp số ở đầu thẻ
 *   CHI TỪNG NGÀY. Trước đó nó so tháng đang chạy với CẢ tháng trước — mùng 3 thì nói "−90%" cho một người tiêu y như cũ,
 *   và một màn có hai con số "so tháng trước" khác nhau. Vắng ⇒ cả hai tháng trọn (cách cũ — cho bài gọi thẳng hàm thuần).
 * ⭐ D426 — dòng "vì sale / bạn rủ" chỉ dựng khi sổ CÓ câu trả lời nào cho nó (tháng này hoặc tháng trước). Từ D410 không
 *   màn nào hỏi câu ấy nữa; dựng nó là một dòng "chưa đủ để nói" vĩnh viễn — hứa một con số sẽ tới mà không đường nào tới.
 */
export function dungChiSo(
  soNay: readonly Khoan[], soTruoc: readonly Khoan[], cungNgay?: { nay: number; truoc: number },
): DongChiSo[] {
  const g = guongKy(soNay);
  const gT = guongKy(soTruoc);
  const lech = cungNgay
    ? soVoiMoc(cungNgay.nay, cungNgay.truoc)
    : soVoiMoc(congSo(soNay).chi, congSo(soTruoc).chi);
  const coViSale = g.vi_sale.n > 0 || gT.vi_sale.n > 0;

  const tyLe = (
    id: string, ten: string, chu: string, giai: string,
    gt: number | null, n: number, mocGt: number | null,
  ): DongChiSo => ({
    id, ten, chu, giai, n,
    nhan: gt === null ? null : phanTram(gt),
    bar: gt === null ? null : kep01(gt),
    moc: mocGt === null ? null : kep01(mocGt),
  });

  return [
    {
      id: 'tiet_kiem', ten: C.csTietKiem, chu: C.chuTietKiem, giai: C.giaiTietKiem,
      n: g.tiet_kiem_rong.n,
      // ⚠ Chi vượt gấp đôi thu ⇒ `raw < −1` ⇒ kẹp; "−100%" trần là nói nhẹ đi sự thật.
      nhan: nhanCoKep(g.tiet_kiem_rong.gt, g.tiet_kiem_rong.chamSan, phanTram),
      bar: g.tiet_kiem_rong.gt === null ? null : tuLech(g.tiet_kiem_rong.gt),
      moc: gT.tiet_kiem_rong.gt === null ? null : tuLech(gT.tiet_kiem_rong.gt),
    },
    tyLe('chi_bu', C.csChiBu, C.chuChiBu, C.giaiChiBu,
      g.chi_bu.gt, g.chi_bu.n, gT.chi_bu.gt),
    tyLe('tien_ve', C.csTienVe, C.chuTienVe, C.giaiTienVe,
      g.tien_ve_tieu.gt, g.tien_ve_tieu.n, gT.tien_ve_tieu.gt),
    ...(coViSale ? [tyLe('vi_sale', C.csViSale, C.chuViSale, C.giaiViSale,
      g.vi_sale.gt, g.vi_sale.n, gT.vi_sale.gt)] : []),
    {
      id: 'tong_chi',
      ten: `${C.csTongChiPre}${soThang(thangTruocCua(thangNay()))}${cungNgay ? B.csTongChiCungNgay : ''}`,
      chu: C.chuTongChi, giai: C.giaiTongChi,
      n: lech.n,
      /* ⚠⚠ CA THẬT: tháng trước 1.000.000, tháng này 3.000.000 ⇒ `raw = 2` ⇒ kẹp về 1.
         In "+100%" ở đây là màn nói "bạn tiêu GẤP ĐÔI" trong khi sự thật là GẤP BA. */
      nhan: nhanCoKep(lech.gt, lech.chamSan, phanTramCoDau),
      bar: lech.gt === null ? null : tuLech(lech.gt),
      // Mốc của dòng này là "bằng đúng tháng trước" = độ lệch 0 = giữa thanh.
      moc: lech.gt === null ? null : tuLech(0),
    },
  ];
}

/* ═══ BẢNG "TRÔNG NHƯ LẶP LẠI" ══════════════════════════════════════════════════════ */

export interface NhomLap {
  ten: string;
  khoan: Khoan[];
}

/**
 * Khoản TRÔNG NHƯ lặp lại — cùng bốn điều kiện demo, và cả bốn đều NÓI RA ĐƯỢC:
 * cùng tên · ít nhất hai tháng khác nhau · tiền chênh dưới 15% · **không quá ~1 lần mỗi
 * tháng**.
 *
 * ⚠⚠ ĐIỀU KIỆN TẦN SUẤT LÀ THỨ TÁCH KHOẢN ĐỊNH KỲ KHỎI THÓI QUEN. Thiếu nó thì bảng bắt
 * luôn "cơm trưa" 5 lần/tháng — đúng luật đã viết, mà vô dụng: một danh sách "lặp lại" có
 * cơm trưa trong đó thì không ai đọc. ⇒ Một bộ lọc đúng theo định nghĩa của mình vẫn có
 * thể sai theo việc nó phải làm; nghiệm thu phải nhìn DANH SÁCH KẾT QUẢ, không chỉ luật.
 *
 * ⚠ KHOÁ GOM LÀ `ghiChu` — demo gom theo trường `ten`, thứ KHÔNG có trong `Khoan` (xem
 * `so.ts`). Khoản không có ghi chú thì không có gì để so tên, nên nó đứng ngoài bảng chứ
 * không rơi vào một nhóm "không tên" gộp mọi thứ lại.
 */
export function nhomTrongNhuLap(tatCa: readonly Khoan[]): NhomLap[] {
  const gom = new Map<string, NhomLap>();
  for (const k of tatCa) {
    if (!laChiTieu(k)) continue;
    const ten = (k.ghiChu ?? '').trim();
    if (ten === '') continue;
    const khoa = ten.toLowerCase();
    const nhom = gom.get(khoa) ?? { ten, khoan: [] };
    nhom.khoan.push(k);
    gom.set(khoa, nhom);
  }
  const ra: NhomLap[] = [];
  for (const nhom of gom.values()) {
    const ds = [...nhom.khoan].sort((a, b) => (a.ngay < b.ngay ? -1 : 1));
    if (ds.length < 2) continue;
    const thang = new Set(ds.map((k) => k.ngay.slice(0, 7)));
    if (thang.size < 2) continue;
    const min = Math.min(...ds.map((k) => k.soTien));
    const max = Math.max(...ds.map((k) => k.soTien));
    if (max === 0 || (max - min) / max > 0.15) continue;
    if (ds.length / thang.size > 1.3) continue;
    ra.push({ ten: nhom.ten, khoan: ds });
  }
  return ra.sort((a, b) => b.khoan[b.khoan.length - 1]!.soTien - a.khoan[a.khoan.length - 1]!.soTien);
}

/**
 * "Rơi vào ngày nào" — hoá đơn thật rơi gần như cùng một ngày mỗi tháng, thói quen thì
 * rải. Dấu hiệu rẻ nhất mà mạnh nhất để người dùng TỰ phán, thay vì app phán hộ.
 */
export function ngayDeu(nhom: NhomLap): { deu: boolean; ngay: number } {
  const ng = nhom.khoan.map((k) => Number(k.ngay.slice(8, 10)));
  return { deu: Math.max(...ng) - Math.min(...ng) <= 3, ngay: ng[0]! };
}

/* ═══ màn ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Các nắp — mở một nắp là đóng nắp kia (ràng buộc CHIỀU CAO, không phải lựa chọn).
 * D426: `sauThang` (6 THÁNG) mới · `chiSo` nay là THÓI QUEN · `tran` nay là NÓI · LÀM · TRONG TRẬN · bỏ `nhan`.
 */
/*
 * ⭐ D453 — CHÍN NẮP CÒN BỐN (founder 28/09: *"UI-UX … chưa thấy rõ cái gì"*; đo 0.0.51: GƯƠNG cao 3.043px ≈ 3,7 màn,
 * 5/9 nắp ghi "chưa có"). THÁNG = 6 tháng · thói quen · lịch ghi · khoản lặp · HŨ = hũ đã xong · lời đoán của bạn (chỉ
 * dựng khi có) · LUẬT · KHUNG chia tiền. NÓI · LÀM · TRONG TRẬN dời sang THẺ (màn "bạn là ai"); CHỐT SỔ TUẦN thành dải
 * CHẤM của tấm HƯỚNG + nút neo đáy.
 */

/**
 * Ô ăn mừng đợi MỘT NHỊP rồi mới rơi xuống (demo: 520ms).
 *
 * ⚠ Nó bắn SAU khi máy chủ xác nhận, không phải lúc bấm: vỗ tay cho một cú niêm phong
 * rồi mới báo lỗi là tệ hơn không vỗ tay. Và có độ trễ vì con dấu `dongDau` chạy 420ms —
 * hai vật cùng rơi một lúc thì không vật nào được nhìn.
 */
export const NHIP_AN_MUNG = 520;

export default function Guong(): React.ReactElement {
  return (
    <KhoProvider>
      <RuotGuong />
    </KhoProvider>
  );
}

/** ⚠ Xuất ra cho bài test — bản mặc định tự mở IndexedDB thật; test bơm kho của mình. */
export function RuotGuong(): React.ReactElement {
  /* ⚠ Đọc đồng hồ ĐÚNG MỘT LẦN lúc dựng state (nếp `So.tsx`): mọi phép tính phía dưới
     phải nói về cùng một tháng, kể cả khi người dùng để app mở qua nửa đêm. */
  const [thang] = useState(() => thangNay());
  const [ngayNay] = useState(() => homNay());
  const thangTruoc = useMemo(() => thangTruocCua(thang), [thang]);

  const kho = useKho();
  const ghiKho = useGhiKho();
  const { data: soNay, dangTai: taiSo } = useSoThang(thang);
  const { data: soTruoc } = useSoThang(thangTruoc);
  const { data: tatCa, dangTai: taiTatCa } = useSoTatCa();
  const { data: hu, dangTai: taiHu } = useHu();
  const { data: luat, dangTai: taiLuat } = useLuat();

  const [dangDatLuat, datDangDatLuat] = useState(false);
  /* D453 — nắp NÓI · LÀM · TRONG TRẬN (và cửa `noi_game` của nó) dời sang THẺ (`ChanDungPfm.tsx`). */
  /* Đích cuộn — một STATE, không `requestAnimationFrame` (nếp `Hu.tsx` 27/09: rAF chạy trước khi React vẽ khối vừa mở). */
  const [cuonToi, datCuonToi] = useState<string | null>(null);
  useEffect(() => {
    if (cuonToi === null) return;
    document.querySelector(cuonToi)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    datCuonToi(null);
  }, [cuonToi]);

  /*
   * D325 — THẺ NHÌN LẠI THÁNG TRƯỚC. ⚠ Chỉ dựng khi CẢ BA ngăn đã tải: dựng trên mảng rỗng của
   * nhịp render đầu là thẻ hiện thiếu luật rồi tự thêm một bước — người đang bấm câu 1 thấy bộ
   * đếm nhảy từ 1/2 lên 1/3 dưới tay.
   */
  const cauCk = useMemo(
    () => (taiTatCa || taiHu || taiLuat ? null : cauCuoiKy(thangTruoc, tatCa, hu, luat)),
    [taiTatCa, taiHu, taiLuat, thangTruoc, tatCa, hu, luat],
  );
  /* ⚠ Cùng TIỀN TỐ khoá với chỗ ghi (`ghiKho(['nhip'])`) — khác tiền tố thì bấm XONG xong, lần
     tải lại query vẫn trả `false` cho tới khi mở lại màn. */
  const daXongCk = useQuery({
    queryKey: [...KHOA_PFM.ngan('nhip'), 'cuoi_ky', thangTruoc],
    enabled: kho !== null && cauCk !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => daXongCuoiKy(kho!, thangTruoc),
  });
  /* ĐỂ SAU = state của lần mở này, cố ý KHÔNG lưu: "ẩn tới lần mở Gương sau", không nhắc dồn. */
  const [ckAn, datCkAn] = useState(false);

  /*
   * ⚠ Bốn cú ghi của thẻ đi qua `suaBanGhi` (đọc bản trong kho + xếp hàng): từ tệp 15 lát 1 một bước của thẻ
   * có HAI cú ghi nối tiếp lên cùng một bản ghi (câu cũ rồi VÌ SAO) — dựng cú thứ hai từ bản trong state là
   * ghi đè mất cú thứ nhất (xem `sua_ban_ghi.ts`).
   */
  async function traLoiHuCk(h: Hu, kq: MaKetQuaHu): Promise<void> {
    rung(NHIP_RUNG.cham);
    const luc = bayGio();
    await ghiKho(['hu'], (k) => suaBanGhi<Hu>(k, 'hu', h.id, (cu) => ghiKetQuaKy(cu, thangTruoc, kq), luc, thang));
  }
  async function traLoiLuatCk(l: Luat, v: MaHieuQuaLuat): Promise<void> {
    rung(NHIP_RUNG.cham);
    const luc = bayGio();
    await ghiKho(['luat'], (k) => suaBanGhi<Luat>(k, 'luat', l.id, (cu) => ghiHieuQuaKy(cu, thangTruoc, v), luc, thang));
  }
  /* Tệp 15 lát 1 — nhãn VÌ SAO cho lời đoán vừa được xét trên thẻ. Ghi vào CHÍNH bản ghi gốc. */
  async function lyDoHuCk(h: Hu, datLuc: string, lyDo: MaLyDoViThe): Promise<void> {
    rung(NHIP_RUNG.cham);
    const luc = bayGio();
    await ghiKho(['hu'], (k) => suaBanGhi<Hu>(k, 'hu', h.id, (cu) => ghiLyDoHu(cu, datLuc, lyDo), luc, thang));
  }
  async function lyDoLuatCk(l: Luat, lyDo: MaLyDoViThe): Promise<void> {
    rung(NHIP_RUNG.cham);
    const luc = bayGio();
    await ghiKho(['luat'], (k) => suaBanGhi<Luat>(k, 'luat', l.id, (cu) => ghiLyDoLuat(cu, thangTruoc, lyDo), luc, thang));
  }
  async function xongCk(): Promise<void> {
    rung(NHIP_RUNG.cham);
    datCkAn(true);
    // ⚠ `thang` (tháng ĐANG SỐNG) làm lát của dấu, không phải `thangTruoc` — xem `ghiXongCuoiKy`.
    await ghiKho(['nhip'], (k) => ghiXongCuoiKy(k, thangTruoc, thang, bayGio()));
  }

  /* ── Thẻ Oracle ────────────────────────────────────────────────────────────────── */
  const [the, datThe] = useState<NoiDungOracle | null>(null);
  const daChonRef = useRef(false);

  /*
   * ⚠⚠ CHỌN ĐÚNG MỘT LẦN, VÀ CHỈ SAU KHI SỔ ĐÃ TẢI XONG. Hai lý do, cả hai đều tốn được
   * một kỳ nếu bỏ:
   *   · `chonNoiDung` đọc `guongKy(sổ)`; chạy nó trên mảng rỗng của nhịp render đầu là
   *     chọn thẻ bằng dữ liệu chưa có, rồi `ghiDaHienKy` KHOÁ id ấy cho cả tháng.
   *   · `daChonRef` khoá TRƯỚC khi vào nhánh async, nên StrictMode gọi effect hai lần
   *     vẫn chỉ một lượt chọn — và một lượt `ghiHienThi`.
   * ⚠ Không đặt cleanup huỷ: StrictMode chạy effect → cleanup → effect, nên một cờ
   * "đã huỷ" sẽ nuốt đúng lượt chạy thật rồi lượt sau bị `daChonRef` chặn ⇒ thẻ không
   * bao giờ hiện lúc dev.
   */
  /* D453 — MỘT bong bóng Oracle một màn: có "tiền đi tới ngày nào" (việc cụ thể, D365) thì thẻ Oracle chung nhường chỗ —
     và KHÔNG được chọn/ghi hiển thị (chọn rồi không vẽ là ghi một lượt hiển thị không ai thấy). */
  const coNhip = useMemo(() => !taiTatCa && tienToiNgay(tatCa, ngayNay) !== null, [taiTatCa, tatCa, ngayNay]);
  useEffect(() => {
    if (daChonRef.current || kho === null || taiSo || taiLuat || taiTatCa || coNhip) return;
    daChonRef.current = true;
    void (async () => {
      const daHienKy = await docDaHienKy(kho, thang);
      const nd = chonNoiDung({
        homNay: ngayNay,
        guong: guongKy(soNay),
        soLuatDangBat: luat.filter((l) => l.trangThai === 'bat').length,
        daHienKy,
      });
      // `null` là kết quả HỢP LỆ — im lặng, không dựng thẻ rỗng (P14 không cấm im lặng).
      if (nd === null) return;
      datThe(nd);
      // ⚠ Tầng không gian: thẻ chỉ HIỆN khi mở lớp TIỀN TỚI ⇒ lượt hiển thị + dấu "đã hiện kỳ này" ghi ở effect dưới (lúc lớp mở),
      //   không phải lúc chọn — ghi lúc chọn là đếm một thẻ chưa ai thấy (mẫu số của phễu T7.5 phồng lên).
    })();
  }, [kho, taiSo, taiLuat, taiTatCa, coNhip, thang, ngayNay, soNay, luat]);

  /* ── Dữ liệu bảy nắp ───────────────────────────────────────────────────────────── */
  const ngayCoGhi = useMemo(() => new Set(soNay.map((k) => k.ngay)), [soNay]);
  /*
   * ⚠⚠ CÔNG TẮC "TẮT GƯƠNG" (Cài đặt › SỔ CHI TIÊU › KHÁC) PHẢI CÓ NGƯỜI ĐỌC. Chữ đã duyệt
   * hứa *"Màn Gương ngừng tính các chỉ số mô tả"* — mà trước dòng này không ai đọc cờ, tức
   * công tắc là một cái nút giả và câu chữ mô tả một trạng thái không xảy ra. A10 🔒 nói
   * app chỉ được MÔ TẢ; mô tả sai còn nặng hơn kê đơn.
   * ⚠ Cùng KHOÁ QUERY với chỗ ghi (`CaiDatPfm` §KhoiKhac) — khác khoá thì cú gạt công tắc
   * không làm tươi được màn này, và người dùng thấy nó "không ăn" cho tới lần tải sau.
   * ⚠ Chỉ chặn NẮP CHỈ SỐ: câu chữ hứa đúng "các chỉ số mô tả", không hứa cả màn.
   * ⭐ D426 — nay chặn cả hai nắp đo HÀNH VI: THÓI QUEN (chỉ số + chi theo thứ + sau tiền về) và NÓI · LÀM · TRONG TRẬN
   *   (mặt SỔ là chỉ số mô tả). Ba thẻ đầu và 6 THÁNG thì không: chúng là TỔNG của sổ (vào · chi · để dành) như số ở màn
   *   SỔ, không phải một phép suy về thói quen.
   */
  const guongTat = useCaiDatMay().data.guongTat === true;
  /* D426 — "tổng chi so tháng trước" là so CÙNG NGÀY, một cặp số với đầu thẻ CHI TỪNG NGÀY (`soCungNgay`). */
  const cungNgay = useMemo(
    () => soCungNgay(tatCa, thang, Number(ngayNay.slice(8, 10))), [tatCa, thang, ngayNay]);
  const chiSo = useMemo(
    () => (guongTat ? [] : dungChiSo(soNay, soTruoc, cungNgay)), [guongTat, soNay, soTruoc, cungNgay]);
  /* D426 — lá nắp THÓI QUEN mang một con số hành vi ngay cả khi đóng: cuối tuần tiêu gấp mấy ngày thường (8 tuần). */
  const cuoiTuan = useMemo(
    () => (guongTat ? null : soKhung(tatCa, ngayNay, 'cuoi_tuan', SO_TUAN_THOI_QUEN * 7)), [guongTat, tatCa, ngayNay]);
  /* D426 — 6 THÁNG: bắt đầu từ tháng có khoản SỔ sớm nhất, không vẽ những tháng app chưa có mặt (P7). */
  const sauThang = useMemo(() => {
    const dau = thangDauTien(tatCa);
    return dau === null ? [] : lichSuThang(tatCa, thang, 6).filter((m) => m.thang >= dau);
  }, [tatCa, thang]);
  const dsLap = useMemo(() => nhomTrongNhuLap(tatCa), [tatCa]);
  const tongLap = useMemo(
    () => dsLap.reduce((a, g) => a + g.khoan[g.khoan.length - 1]!.soTien, 0), [dsLap],
  );
  const huXong = useMemo(() => hu.filter((h) => h.trangThai === 'xong'), [hu]);
  /* Tệp 15 lát 1 — nắp LỜI ĐOÁN CỦA BẠN: ĐẾM LẠI mỗi lần đọc (`tongLoiDoan`), không cộng dồn. */
  const tongDoan = useMemo(() => tongLoiDoan(hu, luat, thang), [hu, luat, thang]);
  const doanSong = useMemo(() => [
    ...hu.flatMap((h) => {
      const ld = loiDoanHuHienHanh(h, thang);
      /* ⚠ Kỳ hạn sang NĂM KHÁC thì in cả năm — "tới 10/07" cho một ngày của năm sau đọc ra như đã qua (soi mắt 26/09). */
      return ld ? [{
        id: h.id, ten: h.ten.toUpperCase(), chac: ld.chac,
        khi: `${CV.toiPre}${ngayViet(ld.han, ld.han.slice(0, 4) !== ld.datLuc.slice(0, 4))}`,
      }] : [];
    }),
    ...luat.flatMap((l) => {
      const ld = loiDoanLuatHienHanh(l, thang);
      const ten = mauTheoDieuKien(l.dieuKien)?.ten ?? CHU_DIEU_KIEN[l.dieuKien];
      return ld ? [{ id: l.id, ten: ten.toUpperCase(), chac: ld.chac, khi: `${CV.hoiLuatPre}${soThang(ld.ky)}` }] : [];
    }),
  ], [hu, luat, thang]);
  const demGiuVo = useMemo(() => {
    let giu = 0; let vo = 0;
    for (const l of luat) for (const d of l.lichSu) { if (d.ma === 'giu') giu++; else if (d.ma === 'vo') vo++; }
    return { giu, tong: giu + vo };
  }, [luat]);

  /* ── Chốt sổ tuần ──────────────────────────────────────────────────────────────── */
  const tuan = useTrangThaiTuan();
  const niemPhong = useNiemPhongTuan();
  const [loiTuan, datLoiTuan] = useState<string | null>(null);
  const [anMung, datAnMung] = useState(false);
  const henAnMung = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ⚠ Dọn hẹn giờ khi rời màn: `setState` trên một cây đã tháo là một cảnh báo im lặng
     đúng loại mà không ai đọc, và nó nhân lên mỗi lần người dùng đi ra đi vào. */
  useEffect(() => () => { if (henAnMung.current) clearTimeout(henAnMung.current); }, []);

  /*
   * ── APP TỰ CHẤM LỜI ĐOÁN (D385) ────────────────────────────────────────────────────
   * ⚠⚠ Trước D385 màn chân dung dán nhãn "KIỂM ĐƯỢC" mà KHÔNG màn nào gọi `chamDoan()`. Ô chốt sổ tuần
   * là chỗ tự nhiên để giữ lời hứa ấy: tuần ở đây đã KẾT THÚC và đã được niêm phong, tức một cửa sổ
   * đóng, không còn gì để người dùng (hay app) chỉnh cho khớp lời đoán.
   * ⚠ CHỈ LƯU TRÚNG/TRẬT. "Chưa đủ số" tính lại mỗi lần xem: người dùng ghi bù chi tiêu của tuần cũ thì
   *   tuần ấy vẫn chấm được sau; lưu `chua_du` là khoá nó lại vĩnh viễn ở "chưa đủ".
   * ⚠ Lưu MỘT lần theo khoá kỳ, kiểm lại ngay trong lượt ghi (`suaHoSo` đọc bản trong kho): mở màn hai lần
   *   liền nhau không thành hai lượt, và bản đã lưu KHÔNG bị chấm lại bằng lời đoán mới.
   */
  const { data: hoSo, sanSang: coHoSo } = useHoSo();
  const maDoan = chanDung(hoSo);
  const kyCham = useMemo(
    () => (tuan?.daNiemPhong && coHoSo && CUA_CUA_DOAN[maDoan] !== null && !taiTatCa
      ? kyCanCham(maDoan, tuan.tuan, hoSo.doanTu, ngayGhiDauTien(tatCa))
      : null),
    [tuan, coHoSo, maDoan, hoSo.doanTu, tatCa, taiTatCa],
  );
  const daLuu = kyCham ? hoSo.soDoan?.[kyCham.khoa] : undefined;
  const dongCham = useMemo(
    () => daLuu ?? (kyCham ? chamKy(maDoan, tatCa, kyCham) : null),
    [daLuu, kyCham, maDoan, tatCa],
  );
  const thanhTichDoan = thanhTich(hoSo.soDoan);
  useEffect(() => {
    if (!kyCham || daLuu || !dongCham || dongCham.kq === 'chua_du') return;
    const khoa = kyCham.khoa;
    ghiKho(['meta'], (k) => suaHoSo(k, (cu) => (
      cu.soDoan?.[khoa] ? null : { ...cu, soDoan: { ...cu.soDoan, [khoa]: dongCham } }
    ), bayGio())).catch(baoLoiNen);
  }, [kyCham, daLuu, dongCham, ghiKho]);
  /* Lời đoán có mốc mà kỳ này không chấm được (khép trước lời đoán · tháng chưa ghi từ ngày 1). */
  const khongCham = Boolean(
    tuan?.daNiemPhong && coHoSo && hoSo.doanTu !== undefined
    && CUA_CUA_DOAN[maDoan] !== null && !taiTatCa && kyCham === null,
  );

  /*
   * ── TẤM HƯỚNG (D453) — HỌC trên quyết định · HƯỚNG hợp với bạn · CHẤM tuần ──────────────────────────────────────
   * ⚠ Chỉ dựng khi sổ + hũ + luật + hồ sơ đều đã THẬT (nếp D426/D429): dựng trên mảng rỗng của nhịp đầu là tấm nói "chưa
   *   học được gì" rồi tự đổi — một câu sai trong một nhịp vẫn là câu sai về chính người dùng.
   * ⚠ Mọi phép đếm ở `pfm/huong.ts`; ở đây chỉ gọi, cắt số dòng, và nối lựa chọn vào hồ sơ qua `suaHoSo` (D360).
   */
  const tuanNay = useMemo(() => dauTuan(ngayNay), [ngayNay]);
  const [loiHuong, datLoiHuong] = useState<string | null>(null);
  const huongSan = !taiTatCa && !taiHu && !taiLuat && coHoSo;
  const tamHuong = useMemo(() => {
    if (!huongSan) return null;
    const v = { so: tatCa, hu, luat, hoSo, homNay: ngayNay, tatHanhVi: guongTat };
    const lich = hoSo.huong ?? [];
    /* Hướng ĐANG THEO của mô hình mới (bản ghi D453 cũ đọc ra là "chưa chọn" — `huongMoiTuan`). */
    const dangTheo = huongMoiTuan(lich, tuanNay);
    const lcKhep = tuanVuaKhep(lich, ngayNay);
    return {
      canCu: demQuyetDinh(v),
      hoc: chonDongHoc(hocTuQuyetDinh(v)),
      phuongAn: phuongAnTuan(hu, tatCa, dangTheo),
      dangTheo,
      lanLam: dangTheo === null ? null : lanLamUuTien(dangTheo, tatCa, ngayNay),
      vuaKhep: lcKhep === null ? null : {
        lc: lcKhep, kq: chamLuaChon(lcKhep, v, chuNhatCua(lcKhep.tuan)), lan: lanLamUuTien(lcKhep, tatCa, chuNhatCua(lcKhep.tuan)),
      },
    };
  }, [huongSan, tatCa, hu, luat, hoSo, ngayNay, guongTat, tuanNay]);

  /*
   * Bản tin GỌN dưới tấm: chỉ các dòng về THÁNG (chi so cùng ngày · để dành ba tháng · khoản lớn · cả tháng đi về đâu · hũ
   * tiêu dùng chạm mức). Dòng nhịp hành vi (cuối tuần · sau tiền về) và dòng vị thế lệch hạn đã lên tấm HƯỚNG thành dòng HỌC —
   * in hai chỗ là hai con số cho một sự thật.
   */
  const banTin = useMemo(() => {
    if (!huongSan) return null;
    return banTinThang({ so: tatCa, hu, homNay: ngayNay, tatHanhVi: guongTat });
  }, [huongSan, tatCa, hu, ngayNay, guongTat]);

  /** Nối MỘT lựa chọn vào hồ sơ — cửa ghi duy nhất `suaHoSo` (đọc bản trong kho + xếp hàng, D360). */
  async function ghiLuaChon(f: (cu: typeof hoSo) => typeof hoSo | null): Promise<boolean> {
    datLoiHuong(null);
    try {
      await ghiKho(['meta'], (k) => suaHoSo(k, f, bayGio()));
      return true;
    } catch (e) {
      datLoiHuong(CHU_LOI_GHI);
      baoLoiNen(e);
      return false;
    }
  }

  /**
   * CHỌN một phương án hướng tuần tới = MỘT cú ghi vào `HoSo.huong` (qua `noiLuaChon` + `suaHoSo`), KHÔNG chuyển màn.
   * ⚠ Không `ghiDo` nào: lựa chọn ở lại máy, không mã sự kiện mới (P2). Chạm lại phương án đang chọn ⇒ `noiLuaChon` trả `null` ⇒ không ghi.
   */
  async function chonPhuongAn(p: PhuongAnHuong): Promise<void> {
    await ghiLuaChon((cu) => noiLuaChon(cu, luaChonTuPhuongAn(p, 'theo', tuanNay, bayGio())));
  }

  function chotTuan(): void {
    rung(NHIP_RUNG.nang);
    datLoiTuan(null);
    niemPhong.mutate(undefined, {
      onSuccess: () => {
        /* D453 — kết quả tuần nằm ở dải CHẤM của tấm HƯỚNG (con dấu · ngày có ghi · app tự chấm): chuyển lớp sang HƯỚNG. */
        mo('huong');
        datCuonToi('[data-testid="huong-cham"]');
        // ⚠ Vỗ tay CHỈ SAU khi máy chủ xác nhận token đã vào sổ (demo: sau một nhịp).
        if (henAnMung.current) clearTimeout(henAnMung.current);
        henAnMung.current = setTimeout(() => datAnMung(true), NHIP_AN_MUNG);
      },
      /*
       * ⚠⚠ 409 `chua_diem_danh_hom_nay` KHÔNG PHẢI MỘT SỰ CỐ — nó là câu trả lời có
       * nghĩa: đúng vào Chủ nhật, tuần được niêm phong kết thúc HÔM NAY. Dịch thành một
       * câu người đọc hiểu; MÃ LỖI không bao giờ ra tới màn hình.
       */
      onError: (e) => {
        const ma = e instanceof ApiError ? e.code : '';
        datLoiTuan(ma === 'chua_diem_danh_hom_nay' ? C.loiChuaDiemDanh : C.loiChotTuanKhac);
      },
    });
  }

  /* ── Form đặt luật ─────────────────────────────────────────────────────────────── */
  const [mauChon, datMauChon] = useState(0);
  const [nguongGo, datNguongGo] = useState('');
  const [loiNguong, datLoiNguong] = useState(false);
  /* Tệp 15 lát 1 — lời đoán cho THÁNG LIỀN SAU; tuỳ chọn, không chip nào sáng sẵn (P3). */
  const [chacLuat, datChacLuat] = useState<MaChac | null>(null);
  const mau = MAU_LUAT[mauChon] ?? MAU_LUAT[0]!;

  function moForm(): void {
    rung(NHIP_RUNG.cham);
    datMauChon(0); datNguongGo(''); datLoiNguong(false); datChacLuat(null);
    datDangDatLuat(true);
    mo('luat');
  }

  function dongForm(): void {
    rung(NHIP_RUNG.cham);
    datDangDatLuat(false); datNguongGo(''); datLoiNguong(false);
  }

  async function chotDatLuat(): Promise<void> {
    const nguong = Number.parseInt(nguongGo, 10);
    /*
     * ⚠ CHỐT KHI NGƯỠNG TRỐNG ⇒ TỪ CHỐI, không "đoán một số cho tiện". `taoLuatMoi` cũng
     * ném ở cửa của nó (`kiemDieuKien`), nhưng chặn ở đây là để người dùng thấy ĐÚNG ô
     * đang thiếu chứ không thấy một lỗi chung chung ở một nút trông chẳng liên quan.
     */
    if (mauCanNguong(mau) && !(Number.isFinite(nguong) && nguong > 0)) {
      datLoiNguong(true); rung(NHIP_RUNG.nang); return;
    }
    rung(NHIP_RUNG.nang);
    const luc = bayGio();
    const id = sinhId();
    const luatMoi = taoLuatMoi({
      // ⚠ NGUYÊN VĂN `loiNhacGoiY` — app ghép HÌNH, người dùng điền SỐ (D290).
      loiNhac: mau.loiNhacGoiY,
      dieuKien: mau.dieuKien,
      ...(mauCanNguong(mau) ? { thamSo: { nguong } } : {}),
      mauId: mau.id,
    }, luc, id);
    // ⚠ Lời đoán nằm TRONG bản ghi luật, ở lại máy — sự kiện `dat` vẫn chỉ chở ba trường (K5 🔒).
    const moi = chacLuat !== null ? moLoiDoanLuat(luatMoi, chacLuat, luc) : luatMoi;
    await ghiKho(['luat', 'outbox'], async (k) => {
      await k.ghi('luat', { id, thang, suaLuc: luc, d: moi });
      // ⚠ CHỈ `{luat_id, mau_id, hanh_dong}` rời máy — câu luật ở lại (P2 🔒, `luat.ts`).
      await xepHang(k, suKienLuat(moi, 'dat'), luc, id, thang);
    });
    datDangDatLuat(false); datNguongGo(''); datLoiNguong(false);
  }

  async function tacDongLuat(l: Luat, viec: 'ban' | 'giu' | 'vo' | 'tat'): Promise<void> {
    rung(viec === 'ban' ? NHIP_RUNG.nang : NHIP_RUNG.cham);
    const luc = bayGio();
    let moi: Luat;
    if (viec === 'tat') {
      // ⚠ Bật/tắt là CẤU HÌNH CỤC BỘ THUẦN — không có 'bat'/'tat' trong enum `hanh_dong`
      //   đã chốt ở DB, nên tuyệt đối không xếp hàng sự kiện cho nó (`luat.ts` §`datBat`).
      // ⚠ Kèm mốc: tắt khi lời đoán còn mở là khép nó (tệp 15 R2 — `luat.ts` §`datBat`).
      moi = datBat(l, l.trangThai !== 'bat', luc);
      await ghiKho(['luat'], (k) => k.ghi('luat', { id: l.id, thang, suaLuc: luc, d: moi }));
      return;
    }
    if (viec === 'ban') {
      if (dangChoDanhGia(l)) return;
      moi = banLuat(l, luc);
    } else {
      if (!dangChoDanhGia(l)) return;
      moi = ghiNhanGiuVo(l, viec, luc);
    }
    await ghiKho(['luat', 'outbox'], async (k) => {
      await k.ghi('luat', { id: l.id, thang, suaLuc: luc, d: moi });
      await xepHang(k, suKienLuat(moi, viec), luc, `${l.id}-${luc}`, thang);
    });
  }

  /* ── Vẽ ──────────────────────────────────────────────────────────────── */
  const coDoan = tomNapDoan(tongDoan) !== CV.napChuaCo;
  const tomSau = tomSauThang(sauThang, thang);

  /* ══ MẶT BENTO (SPEC `pfm-tang-khong-gian` mục 4.3): ô + lớp trượt; mọi khối cũ của GƯƠNG tới được qua một ô ══════════════════ */
  const [tam, datTam] = useState<TamGuong>('huong');
  const [moTam, datMoTam] = useState(false);
  const mo = useCallback((t: TamGuong): void => { datTam(t); datMoTam(true); }, []);
  /* Lối vào từ NƠI KHÁC: khung kakeibo ở lớp CÀI ĐẶT có bước "bốn câu cuối tuần" ⇒ `/tai-chinh/guong?mo=chot` mở thẳng lớp CHỐT SỔ TUẦN. */
  const [timKiem] = useSearchParams();
  const moTheoUrl = timKiem.get('mo');
  useEffect(() => { if (moTheoUrl === 'chot') mo('chot'); }, [moTheoUrl, mo]);
  const dongTam = useCallback((): void => datMoTam(false), []);

  /*
   * ⭐ HIỂN THỊ THẺ ORACLE = lúc thẻ THẬT SỰ HIỆN: lớp TIỀN TỚI đang mở và có thẻ. Ghi đúng MỘT lần mỗi id (khoá ref TRƯỚC khi vào nhánh
   * async — StrictMode gọi effect hai lần, nếp `daChonRef`), cùng lúc đánh dấu "đã hiện kỳ này".
   */
  const daGhiHienRef = useRef<string | null>(null);
  useEffect(() => {
    if (!moTam || tam !== 'tien-toi' || the === null || coNhip || kho === null) return;
    if (daGhiHienRef.current === the.id) return;
    daGhiHienRef.current = the.id;
    ghiHienThi(the);
    void ghiDaHienKy(kho, thang, the.id, bayGio());
  }, [moTam, tam, the, coNhip, kho, thang]);
  const dangTaiMat = taiTatCa || taiHu || taiLuat || !coHoSo;

  /* Tầng PHÂN TÍCH: bốn cặp bạn nghĩ → thực tế (không nhãn nguồn). "Tắt Gương" ⇒ không tính (cùng luật chỉ số mô tả, D426). */
  const baMat = useMemo(
    () => (guongTat || taiTatCa || taiHu ? null : dungBaMat(tatCa, hu, ngayNay, thang)),
    [guongTat, taiTatCa, taiHu, tatCa, hu, ngayNay, thang],
  );
  const caps = useMemo(() => (baMat === null ? [] : capDoiChieu(baMat, hoSo)), [baMat, hoSo]);
  const capDau = caps.find(capDu) ?? caps.find((c) => c.nghi !== null) ?? null;
  const tienDi = useMemo(() => tienDiDau(tatCa, thang), [tatCa, thang]);
  const vong = useMemo(() => khucTienVao(tienDi), [tienDi]);
  const cotNgay = useMemo(
    () => tienTungNgay(tatCa, thang).map((n) => ({ chi: n.chi, nay: n.ngay === ngayNay, chuaToi: n.ngay > ngayNay })),
    [tatCa, thang, ngayNay],
  );
  const soLoiDoanDangMo = tongDoan.song;
  const soNgayGhiTuan = useMemo(() => demNgayGhiTuan(tatCa, ngayNay), [tatCa, ngayNay]);
  const soCauCk = cauCk === null ? 0 : cauCk.hu.length + cauCk.luat.length;
  const taiNhinLai = taiTatCa || taiHu || taiLuat;
  const choNhinLai = cauCk !== null && daXongCk.data === false && !ckAn;
  const nhipTien = useMemo(() => (taiTatCa ? null : tienToiNgay(tatCa, ngayNay)), [taiTatCa, tatCa, ngayNay]);
  const soDieuChuY = banTin === null ? 0 : banTin.chuY.length + banTin.duPhong.length;

  const nho: OGuongNho[] = [
    { id: 'phan-tich', icon: 'analyze', ten: CB.guPhanTich, phu: dangTaiMat ? CB.dangTai : soDieuChuY > 0 ? `${soDieuChuY}${CB.guDieuHau}` : CB.chuaDuDeNoi },
    {
      id: 'thoi-quen', icon: 'candle', ten: CB.guThoiQuen,
      phu: guongTat ? CB.guDaTatNgan : cuoiTuan !== null ? `${B.cuoiTuanPre}${cuoiTuan.tyLe.toFixed(1).replace('.', ',')}` : CB.chuaDuDeNoi,
    },
    { id: 'luat', icon: 'news', ten: CB.guLuat, phu: taiLuat ? CB.dangTai : luat.length === 0 ? CB.guChuaCoLuat : `${luat.length} ${C.donViLuat}` },
    { id: 'sau-thang', icon: 'chart', ten: CB.guSauThang, phu: tomSau !== '' ? tomSau : CB.chuaDuDeNoi },
    {
      id: 'nhin-lai', icon: 'sach', ten: CB.guNhinLai,
      // Đang tải ≠ không có gì để nhìn lại: `cauCk` null vì CẢ HAI lẽ — chỉ lẽ đầu là "đang tải" (lẽ sau mà ghi "đang tải" là treo mãi).
      phu: !choNhinLai ? (taiNhinLai ? CB.dangTai : cauCk === null ? CB.chuaDuDeNoi : CB.guDaXong) : `${B.thangNganPre}${soThang(thangTruoc)} · ${soCauCk}${CB.guCauHau}`,
    },
    {
      id: 'tien-toi', icon: 'flame', ten: CB.guTienToi,
      phu: nhipTien === null ? CB.chuaDuDeNoi : nhipTien.ngayHet === null ? CB.guTienToiDu
        : `${Number(nhipTien.ngayHet.slice(8, 10))}/${Number(nhipTien.ngayHet.slice(5, 7))}`,
    },
  ];

  /* ── RUỘT LỚP TRƯỢT ── */
  let ruot: React.ReactNode = null;
  let chan: React.ReactNode;
  let nhan: string = CB.guHuongTen;
  const dau = (icon: PixelIconName, ten: string, tag: string): React.ReactElement => (
    <TamDau icon={<PixelIcon name={icon} size={32} />} ten={ten} tag={tag} />
  );

  if (tam === 'huong') {
    nhan = H.tieu;
    ruot = (
      <>
        {dau('target', H.tieu, CB.guHuongTag)}
        {tamHuong !== null ? (
          <TheHuong
            hoc={tamHuong.hoc}
            phuongAn={tamHuong.phuongAn}
            dangTheo={tamHuong.dangTheo}
            lanLam={tamHuong.lanLam}
            vuaKhep={tamHuong.vuaKhep}
            hu={hu}
            luat={luat}
            cham={{ tuanTT: tuan ?? null, dongCham: dongCham ?? null, khongCham, thanhTichDoan, anMung }}
            onChon={(p) => { void chonPhuongAn(p); }}
          />
        ) : <p className={b.ghiChu}>{CB.dangTai}</p>}
        {loiHuong !== null && <p className={b.loiMo} role="alert">{`✕ ${loiHuong}`}</p>}
      </>
    );
  } else if (tam === 'doan-that') {
    nhan = CB.guDoanThat;
    ruot = (
      <>
        {dau('analyze', CB.guDoanThat, CB.guDoanThatTag)}
        {guongTat ? <p className={b.ghiChu} data-testid="guong-tat">{C.guongTat}</p> : (
          <>
            {caps.map((c) => (
              <div key={c.ma} data-testid={`cap-${c.ma}`}>
                <p className={b.tieuNho}>{TEN_CAP[c.ma]}</p>
                <div className={b.dongL}><span>{CB.guBanNghi}</span><em>{chuNghi(c)}</em></div>
                <div className={b.dongL}>
                  <span>{CB.guThucTe}</span>
                  <b className={c.thuc === null ? '' : b.vang}>{chuThuc(c.thuc)}</b>
                  <span className={`${b.theSo} ${capDu(c) ? b.khop : b.chua}`}>{capDu(c) ? CB.guDu : CB.chuaDuDeNoi}</span>
                </div>
              </div>
            ))}
            {caps.length === 0 && <p className={b.ghiChu}>{CB.dangTai}</p>}
            <p className={b.ghiChu}>{`${CB.guGiaiPre}${SO_NGAY_BA_MAT}${CB.guGiaiHau}`}</p>
          </>
        )}
      </>
    );
  } else if (tam === 'ket-toan') {
    nhan = CB.guKetToan;
    ruot = (
      <>
        {dau('target', CB.guKetToan, CB.guKetToanTag)}
        {coDoan ? <MatLoiDoan tong={tongDoan} song={doanSong} /> : <p className={b.ghiChu} data-testid="doan-trong">{CV.chuaCoGi}</p>}
        {huXong.length > 0 && (
          <>
            <p className={b.tieuNho}>{CHU_MAN_HU.daHoanThanh}</p>
            {huXong.map((h) => (
              <div key={h.id} className={b.dongL}>
                <span>{h.ten.toUpperCase()}</span>
                {/* Cùng mốc RESET với màn SỔ/HŨ — con số ghi nhận phải là con số hũ nói. */}
                <b className={b.vang}>{dinhDangDong(tongGopVaoHu(tatCa, h.id, h.mocGop))}</b>
              </div>
            ))}
          </>
        )}
        {choNhinLai && <p className={b.ghiChu}>{`${CB.guKetToanNhinLai}${soThang(thangTruoc)}${CB.guKetToanNhinLaiHau}`}</p>}
      </>
    );
    chan = choNhinLai ? <NutChinh dau="ket-toan-nhin-lai" onChon={() => mo('nhin-lai')}>{CB.guNhinLai}</NutChinh> : undefined;
  } else if (tam === 'bieu-do') {
    nhan = B.diDauTieu;
    ruot = (
      <>
        {dau('chart', B.diDauTieu, CB.guBieuDoTag)}
        {!taiTatCa && !taiHu ? <BieuDoThang tatCa={tatCa} hu={hu} thangNay={thang} ngayNay={ngayNay} /> : <p className={b.ghiChu}>{CB.dangTai}</p>}
      </>
    );
  } else if (tam === 'phan-tich') {
    nhan = CB.guPhanTich;
    ruot = (
      <>
        {dau('analyze', CB.guPhanTich, CB.guPhanTichTag)}
        {banTin !== null && soDieuChuY > 0
          ? <ThePhanTich chuY={banTin.chuY} duPhong={banTin.duPhong} hu={hu} tatCa={tatCa} ngayNay={ngayNay} gon />
          : <p className={b.ghiChu}>{dangTaiMat ? CB.dangTai : CB.guPhanTichChua}</p>}
      </>
    );
  } else if (tam === 'thoi-quen') {
    nhan = CB.guThoiQuen;
    ruot = (
      <>
        {dau('candle', CB.guThoiQuen, CB.guThoiQuenTag)}
        {guongTat ? <p className={b.ghiChu} data-testid="guong-tat">{C.guongTat}</p> : (
          <>
            <p className={b.tieuNho}>
              {`${B.napThoiQuenPre}${soThang(thangTruoc)}`}
              {cuoiTuan !== null && ` · ${B.cuoiTuanPre}${cuoiTuan.tyLe.toFixed(1).replace('.', ',')}`}
            </p>
            <BieuDoThoiQuen tatCa={tatCa} ngayNay={ngayNay} />
            <p className={b.tieuNho}>{`${C.napChiSoPre}${soThang(thangTruoc)}`}</p>
            <p className={s.chuThich}>
              {`${C.vachPre}${soThang(thangTruoc)}${C.vachGiua}`}
              <span className={s.mucNay}>{'sáng'}</span>
              {C.vachHau}
            </p>
            {chiSo.map((c) => <ChiSoDong key={c.id} c={c} />)}
          </>
        )}
        <p className={b.tieuNho}>
          {`${C.napLap} · ${dsLap.length === 0 ? C.chuaThay : `${dsLap.length} ${C.donViKhoan} · ${dinhDangDong(tongLap)}${C.moiThang}`}`}
        </p>
        <BangLap ds={dsLap} />
      </>
    );
  } else if (tam === 'luat') {
    nhan = CB.guLuat;
    ruot = (
      <>
        {dau('news', CB.guLuat, CB.guLuatTag)}
        {dangDatLuat ? (
          <FormDatLuat
            mau={mau}
            mauChon={mauChon}
            onChonMau={(i) => { rung(NHIP_RUNG.cham); datMauChon(i); datLoiNguong(false); }}
            nguongGo={nguongGo}
            loiNguong={loiNguong}
            onGo={(k) => {
              rung(NHIP_RUNG.cham); datLoiNguong(false);
              datNguongGo((cur) => (k === '⌫' ? cur.slice(0, -1) : `${cur}${k}`.slice(0, 9)));
            }}
            onHuy={dongForm}
            onChot={() => void chotDatLuat()}
            chac={chacLuat}
            onChac={(c) => { rung(NHIP_RUNG.cham); datChacLuat((cu) => (cu === c ? null : c)); }}
            thangDoan={soThang(thangSauCua(thang))}
          />
        ) : (
          <>
            {luat.length === 0 && <p className={b.ghiChu}>{C.khoiChuaCoLuat}</p>}
            {luat.map((l) => <TheLuat key={l.id} l={l} onViec={(v) => void tacDongLuat(l, v)} />)}
          </>
        )}
      </>
    );
    chan = dangDatLuat ? undefined : <NutChinh dau="luat-them" onChon={moForm}>{C.themLuat}</NutChinh>;
  } else if (tam === 'sau-thang') {
    nhan = CB.guSauThang;
    ruot = (
      <>
        {dau('chart', CB.guSauThang, CB.guSauThangTag)}
        <BieuDoSauThang ds={sauThang} thangNay={thang} />
        <p className={b.tieuNho}>{`${C.napThangPre}${soThang(thang)}${C.napThangHau}`}</p>
        <div className={s.lich} aria-hidden="true">
          {Array.from({ length: soNgayTrongThang(thang) }, (_, i) => {
            const ngay = `${thang}-${String(i + 1).padStart(2, '0')}`;
            const lop = [ngayCoGhi.has(ngay) ? s.on : '', ngay === ngayNay ? s.nay : ''].filter(Boolean).join(' ');
            return <i key={ngay} className={lop} />;
          })}
        </div>
        <p className={s.chuThich}>{`${C.chuThichLichPre}${PFM.GOI_THANG_NGAY}${C.chuThichLichHau}`}</p>
      </>
    );
  } else if (tam === 'nhin-lai') {
    nhan = CB.guNhinLai;
    ruot = (
      <>
        {dau('sach', CB.guNhinLai, `${CB.guNhinLaiTagPre}${soThang(thangTruoc)}`)}
        {choNhinLai && cauCk !== null ? (
          <TheCuoiKy
            cau={cauCk}
            onHu={(h, kq) => { void traLoiHuCk(h, kq); }}
            onLuat={(l, v) => { void traLoiLuatCk(l, v); }}
            onLyDoHu={(h, datLuc, ld) => { void lyDoHuCk(h, datLuc, ld); }}
            onLyDoLuat={(l, ld) => { void lyDoLuatCk(l, ld); }}
            onXong={() => { void xongCk(); }}
            onDeSau={() => { rung(NHIP_RUNG.cham); datCkAn(true); dongTam(); }}
            tong={tongDoan}
          />
        ) : <p className={b.ghiChu} data-testid="nhin-lai-trong">{taiNhinLai ? CB.dangTai : cauCk === null ? CB.chuaDuDeNoi : CB.guNhinLaiXong}</p>}
      </>
    );
  } else if (tam === 'tien-toi') {
    nhan = CB.guTienToi;
    ruot = (
      <>
        {dau('flame', CB.guTienToi, CB.guTienToiTag)}
        {coNhip ? <TienToiNgay /> : the !== null ? (
          <TheOracle
            nd={the}
            onBoQua={() => { rung(NHIP_RUNG.cham); ghiTuongTac(the, 'bo_qua'); datThe(null); }}
            onXemThem={() => ghiTuongTac(the, 'xem_them')}
          />
        ) : <p className={b.ghiChu}>{dangTaiMat ? CB.dangTai : CB.chuaDuDeNoi}</p>}
      </>
    );
  } else {
    nhan = CB.guChotTen;
    ruot = (
      <>
        {dau('sach', CB.guChotTen, tuan?.tuan ?? CB.guChotTag)}
        <div className={b.dongL}><span>{CB.guChotNgayGhi}</span><b>{`${soNgayGhiTuan} / 7`}</b></div>
        {demGiuVo.tong > 0 && <div className={b.dongL}><span>{CB.guChotLuat}</span><b>{`${demGiuVo.giu} / ${demGiuVo.tong}`}</b></div>}
        <p className={b.ghiChu}>{tuan?.daNiemPhong === true ? C.tuanDaChot : CB.guChotGiai}</p>
        {loiTuan !== null && <p className={b.loiMo} role="status">{loiTuan}</p>}
      </>
    );
    chan = tuan?.daNiemPhong === true ? undefined : (
      <NutChinh dau="chot-tuan" disabled={niemPhong.isPending} onChon={chotTuan}>{CB.guChotNut}</NutChinh>
    );
  }

  return (
    <div className={b.trang} data-testid="guong-bento-goc">
      <MatGuong
        dangTai={dangTaiMat} guongTat={guongTat}
        huong={{
          canCu: tamHuong?.canCu ?? 0,
          dangTheo: tamHuong?.dangTheo == null ? null : cauHuongDangTheo(tamHuong.dangTheo, hu, tamHuong.lanLam),
        }}
        doiChieu={{ cap: capDau, nDu: caps.filter(capDu).length, tong: caps.length }}
        ketToan={{ song: soLoiDoanDangMo, theo: tongDoan.theoChac, ds: doanSong.slice(0, 3) }}
        vong={vong} thu={tienDi.thu} cotNgay={cotNgay}
        cungNgay={taiTatCa ? null : cungNgay}
        nho={nho}
        daChot={tuan?.daNiemPhong === true}
        onMo={mo}
        onChot={() => mo(tuan?.daNiemPhong === true ? 'huong' : 'chot')}
      />
      <TamTruot mo={moTam} onDong={dongTam} nhan={nhan} dau="guong" cao="lon" chan={chan}>
        {ruot}
      </TamTruot>
    </div>
  );
}

/** Số ngày CÓ GHI trong tuần đang sống (thứ Hai → hôm nay) — một dòng của lớp CHỐT SỔ TUẦN; đếm từ chính sổ, không phép đo mới. */
export function demNgayGhiTuan(tatCa: readonly Khoan[], ngayNay: string): number {
  const dau = dauTuan(ngayNay);
  const co = new Set<string>();
  for (const k of tatCa) if (k.ngay >= dau && k.ngay <= ngayNay && !laGanChi(k)) co.add(k.ngay);
  return co.size;
}

/* ═══ Thẻ NHÌN LẠI THÁNG TRƯỚC (D325) — mỗi lần MỘT câu ════════════════════════════════ */

type BuocCk = { loai: 'hu'; h: Hu } | { loai: 'luat'; l: Luat } | { loai: 'tong' };

/**
 * ⚠ MỖI LẦN MỘT CÂU, không bày cả danh sách: bốn nấc chữ dài ("ĐƯỢC KHOẢNG NỬA") không vừa một
 * hàng 375px, nên mỗi hũ là hai hàng nút — ba hũ + hai luật bày một lượt là ~600px đè lên đầu
 * một màn đã đo từng px (§4-bis). Một câu một lần giữ thẻ ở chiều cao của hộp quyết toán.
 * ⚠ Bấm nấc = LƯU rồi sang câu sau. BỎ QUA không ghi gì — trống là trống, không phải `chua_ro`.
 * ⚠ Nấc đang sáng đọc từ CHÍNH bản ghi (`ketQuaKy[ky]` · `hieuQuaKy[ky]`), không từ state của
 *   thẻ: mở lại Gương sau ĐỂ SAU thì câu đã trả lời hiện đúng câu đã trả lời.
 */
export function TheCuoiKy({ cau, onHu, onLuat, onXong, onDeSau, onLyDoHu, onLyDoLuat, tong }: {
  cau: CauCuoiKy;
  onHu: (h: Hu, kq: MaKetQuaHu) => void;
  onLuat: (l: Luat, v: MaHieuQuaLuat) => void;
  onXong: () => void;
  onDeSau: () => void;
  /* Tệp 15 lát 1 — nhãn VÌ SAO cho lời đoán vừa được xét. Vắng ⇒ thẻ không hỏi (chỗ gọi cũ, bài test cũ). */
  onLyDoHu?: (h: Hu, datLuc: string, lyDo: MaLyDoViThe) => void;
  onLyDoLuat?: (l: Luat, lyDo: MaLyDoViThe) => void;
  /** Tổng lời đoán của người dùng — cho dòng ĐỘ KHỚP ở lưng lá ("Chắc 70%: 2 vị thế, tới 1"). Vắng ⇒ không dòng ấy. */
  tong?: TongLoiDoan;
}): React.ReactElement {
  const buoc: BuocCk[] = [
    ...cau.hu.map((h) => ({ loai: 'hu' as const, h })),
    ...cau.luat.map((l) => ({ loai: 'luat' as const, l })),
    { loai: 'tong' },
  ];
  const [i, datI] = useState(0);
  /*
   * ⚠ Bước có lời đoán có HAI câu: câu cũ (nấc / có tác dụng không) rồi VÌ SAO. Bấm câu cũ thì GHI ngay
   * (như trước) nhưng chưa sang bước — hàng VÌ SAO mọc ra bên dưới. Chạm lại nấc khác vẫn đè được.
   */
  const [hoiLyDo, datHoiLyDo] = useState(false);
  const j = Math.min(i, buoc.length - 1);
  const b = buoc[j]!;
  const n = soThang(cau.ky);
  const tiep = (): void => { datHoiLyDo(false); datI(j + 1); };
  const nut = (dang: boolean): string => (dang ? `${NUT2} ${s.chinh}` : NUT2);
  const doanHu = b.loai === 'hu' && onLyDoHu ? cau.doanHu[b.h.id] : undefined;
  const doanLuat = b.loai === 'luat' && onLyDoLuat ? cau.doanLuat[b.l.id] : undefined;
  /* ⚠ MỘT chỗ quyết "lời đoán luật xét được" — cả cú bấm lẫn hàng VÌ SAO đọc biến này (hai chốt chồng nhau
     thì tiêm lỗi vào một chốt không đỏ). "Chưa đủ để xét" không có gì để giải thích ⇒ bấm là đi tiếp. */
  const xetDuocLuat = doanLuat !== undefined && (doanLuat.tt === 'toi' || doanLuat.tt === 'khong_toi');
  const nacHu = b.loai === 'hu' ? b.h.ketQuaKy?.[cau.ky] : undefined;
  const tenLuat = b.loai === 'luat'
    ? (mauTheoDieuKien(b.l.dieuKien)?.ten ?? CHU_DIEU_KIEN[b.l.dieuKien]).toUpperCase() : '';
  return (
    <div className={KHOI2} data-testid="the-cuoi-ky">
      <div className={s.hang2}>
        <span className={s.ten2}>{`${C.ckTieuPre}${n}`}</span>
        <span className={s.phu2s}>{`${j + 1}/${buoc.length}`}</span>
      </div>
      {b.loai === 'hu' && (
        <>
          <p className={s.cauCk}>{`${C.ckHoiHuPre}${b.h.ten.toUpperCase()}${C.ckHoiGiua}${n}${C.ckHoiHuHau}`}</p>
          {/*
            ⭐ LÁ KẾT TOÁN: mặt trước là điều đã đặt lúc vào lệnh; bấm nấc ⇒ lá LẬT sang kết quả suy từ chính nấc
            ấy (lật khi nấc đã nằm trong bản ghi — mở lại sau ĐỂ SAU thì lá đã ngửa sẵn).
          */}
          {doanHu && (
            <div data-testid="ck-doan-hu">
              <LaKetToan
                nhan={`${CV.ktPre}${b.h.ten.toUpperCase()}`}
                lat={nacHu !== undefined}
                dieu={<>{CV.matDuPre}<b>{dinhDangDong(doanHu.ld.muc)}</b>{`${CV.matToiGiua}${ngayViet(doanHu.ld.han)}`}</>}
                chac={PFM.VI_THE_CHAC[doanHu.ld.chac]}
                phu={`${CV.quaAppPre}${dinhDangDong(doanHu.daGop)}${CV.quaAppHau}`}
                ket={nacHu === undefined ? null : nacHu === 'du' ? CV.ketToi : CV.ketKhongToi}
                khai={nacHu === undefined ? undefined : `${CV.lungNacPre}${CHU_KET_QUA_HU[nacHu]}`}
                dem={nacHu === undefined ? undefined : dongDoKhop(tong, doanHu.ld.chac)}
              />
            </div>
          )}
          {[KET_QUA_HU.slice(0, 2), KET_QUA_HU.slice(2)].map((hang) => (
            <div key={hang[0]} className={s.nutHang}>
              {hang.map((ma) => {
                const dang = nacHu === ma;
                return (
                  <button
                    key={ma} type="button" className={nut(dang)} aria-pressed={dang}
                    onClick={() => { onHu(b.h, ma); if (doanHu) datHoiLyDo(true); else tiep(); }}
                  >
                    {CHU_KET_QUA_HU[ma]}
                  </button>
                );
              })}
            </div>
          ))}
          {doanHu && hoiLyDo && nacHu !== undefined && (
            <HangLyDoCk
              dang={doanHu.ld.lyDo}
              onLyDo={(ld) => { onLyDoHu!(b.h, doanHu.ld.datLuc, ld); tiep(); }}
            />
          )}
        </>
      )}
      {b.loai === 'luat' && (
        <>
          <p className={s.cauCk}>{`${C.ckHoiLuatPre}${tenLuat}${C.ckHoiGiua}${n}${C.ckHoiLuatHau}`}</p>
          <div className={s.cau}>{`“${b.l.loiNhac}”`}</div>
          {/*
            ⭐ Luật: mặt trước là điều đã đặt; LƯNG là kết quả APP TỰ ĐẾM (bắn · giữ · vỡ) — không hỏi thêm câu nào.
            Lá lật khi câu "có tác dụng không" đã có trong bản ghi, cùng nhịp với hũ.
          */}
          {doanLuat && (
            <div data-testid="ck-doan-luat">
              <LaKetToan
                nhan={`${CV.ktPre}${tenLuat}`}
                lat={b.l.hieuQuaKy?.[cau.ky] !== undefined}
                dieu={`${CV.luatMatPre}${n}${CV.luatMatGiua}`}
                chac={PFM.VI_THE_CHAC[doanLuat.ld.chac]}
                ket={doanLuat.tt === 'toi' ? CV.ketToi : doanLuat.tt === 'khong_toi' ? CV.ketKhongToi : CV.ketChuaXet}
                khai={`${CV.luatDemBan}${doanLuat.dem.ban}${CV.luatDemGiu}${doanLuat.dem.giu}${CV.luatDemVo}${doanLuat.dem.vo}`}
                dem={xetDuocLuat ? dongDoKhop(tong, doanLuat.ld.chac) : undefined}
              />
            </div>
          )}
          <div className={s.nutHang}>
            {HIEU_QUA_LUAT.map((ma) => {
              const dang = b.l.hieuQuaKy?.[cau.ky] === ma;
              return (
                <button
                  key={ma} type="button" className={nut(dang)} aria-pressed={dang}
                  onClick={() => { onLuat(b.l, ma); if (xetDuocLuat) datHoiLyDo(true); else tiep(); }}
                >
                  {CHU_HIEU_QUA_LUAT[ma]}
                </button>
              );
            })}
          </div>
          {doanLuat && hoiLyDo && xetDuocLuat && (
            <HangLyDoCk
              dang={doanLuat.ld.lyDo}
              onLyDo={(ld) => { onLyDoLuat!(b.l, ld); tiep(); }}
            />
          )}
        </>
      )}
      {b.loai === 'tong' && (
        <>
          <p className={s.chuThich}>{C.ckTuDem}</p>
          <div className={s.cs}>
            <span className={s.csTen}>{`${C.ckHuBoPre}${n}`}</span>
            <span className={s.csGt} data-testid="ck-hu-bo">{cau.soHuBo}</span>
          </div>
          <div className={s.cs}>
            <span className={s.csTen}>{`${C.ckNgayGhiPre}${n}`}</span>
            <span className={s.csGt} data-testid="ck-ngay-ghi">{cau.soNgayGhi}</span>
          </div>
        </>
      )}
      <div className={s.nutHang}>
        {b.loai !== 'tong' && <button type="button" className={NUT2} onClick={tiep}>{C.ckBoQua}</button>}
        <button type="button" className={NUT2} onClick={onDeSau}>{C.ckDeSau}</button>
        {b.loai === 'tong' && (
          <button type="button" className={nut(true)} onClick={onXong}>{C.ckXong}</button>
        )}
      </div>
    </div>
  );
}

/* ═══ LỜI ĐOÁN CỦA BẠN (tệp 15 lát 1) — trên thẻ NHÌN LẠI và trong nắp riêng ════════════ */

/**
 * Hàng VÌ SAO trên thẻ NHÌN LẠI — mọc ra dưới lá vừa lật (kết quả đã nằm trên lưng lá), ba nhãn cùng trọng lượng.
 * ⚠ Nút BỎ QUA của thẻ (ở hàng đáy) vẫn đi tiếp được — nhãn là tuỳ chọn.
 */
function HangLyDoCk({ dang, onLyDo }: {
  dang: MaLyDoViThe | undefined; onLyDo: (ld: MaLyDoViThe) => void;
}): React.ReactElement {
  return (
    <div className={s.vaoLoiDoan} data-testid="ck-ly-do">
      <p className={s.cauCk}>{CV.hoiLyDo}</p>
      <div className={s.nutHang}>
        {LY_DO_VI_THE.map((ld) => (
          <button
            key={ld} type="button" className={`${NUT2} ${dang === ld ? s.chinh : ''}`} aria-pressed={dang === ld}
            onClick={() => onLyDo(ld)}
          >
            {CHU_LY_DO_VI_THE[ld]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Dòng ĐỘ KHỚP ở lưng lá — "Chắc 70%: 2 vị thế, tới 1": ĐẾM theo đúng mức chắc của lá vừa lật, không một con số điểm
 * (tệp 15 R5). Cùng phép đếm với nắp ĐỘ KHỚP (`tongLoiDoan`), không phép thứ hai. Chưa có lượt xét nào ⇒ không dòng.
 */
function dongDoKhop(tong: TongLoiDoan | undefined, chac: MaChac): string | undefined {
  const x = tong?.theoChac.find((d) => d.chac === chac);
  if (x === undefined || x.n === 0) return undefined;
  return `${CV.doKhopPre}${PFM.VI_THE_CHAC[chac]}%${CV.doKhopGiua}${x.n}${CV.doKhopLan}${x.toi}`;
}

/** Chữ trên lá nắp: "2 đang mở · 3 đã xét", hoặc "chưa có". */
function tomNapDoan(t: TongLoiDoan): string {
  const daXet = t.theoChac.reduce((a, x) => a + x.n, 0);
  if (t.song + daXet + t.doiGiuaChung + t.boTrong === 0) return CV.napChuaCo;
  return `${t.song}${CV.napTom} · ${daXet}${CV.napTomXet}`;
}

/**
 * ⭐ NẮP "LỜI ĐOÁN CỦA BẠN" — soi gương với "LỜI ĐOÁN CỦA TÔI" (D385, nắp CHỐT SỔ TUẦN): ở đây là người
 * dùng đoán về mình. ĐẾM theo mức chắc, không một con số điểm nào (tệp 15 R5): *"Nói 70%: 5 lần, tới 3"*.
 * Mỗi lượt xét là một ô vuông — đặc = tới, rỗng = chưa tới: đếm bằng VẬT, đọc được trước khi đọc chữ.
 */
function MatLoiDoan({ tong, song }: {
  tong: TongLoiDoan;
  song: readonly { id: string; ten: string; chac: MaChac; khi: string }[];
}): React.ReactElement {
  const coXet = tong.theoChac.some((x) => x.n > 0);
  if (song.length === 0 && !coXet && tong.doiGiuaChung + tong.boTrong === 0) {
    return <p className={s.chuThich} data-testid="doan-trong">{CV.chuaCoGi}</p>;
  }
  return (
    <div data-testid="mat-loi-doan">
      {song.length > 0 && (
        <>
          <div className={`${s.tieu} ${s.tieuForm}`}>{CV.dangMo}</div>
          {song.map((x) => (
            <div key={x.id} className={s.hang2}>
              <span className={s.ten2}>{x.ten}</span>
              <span className={s.phu2s}>{`${CV.chacPre}${PFM.VI_THE_CHAC[x.chac]}% · ${x.khi}`}</span>
            </div>
          ))}
        </>
      )}
      {coXet && (
        <>
          <div className={`${s.tieu} ${s.tieuForm}`}>{CV.daXet}</div>
          {tong.theoChac.filter((x) => x.n > 0).map((x) => (
            <div key={x.chac} className={s.hangChacDem} data-testid={`dem-chac-${x.chac}`}>
              <span className={s.soChac}>{`${PFM.VI_THE_CHAC[x.chac]}%`}</span>
              <span className={s.oDem} aria-hidden="true">
                {Array.from({ length: x.n }, (_, k) => <i key={k} className={k < x.toi ? s.oToi : ''} />)}
              </span>
              <span className={s.phu2s}>
                {`${CV.doKhopPre}${PFM.VI_THE_CHAC[x.chac]}%${CV.doKhopGiua}${x.n}${CV.doKhopLan}${x.toi}`}
              </span>
            </div>
          ))}
        </>
      )}
      {tong.hoanCanhDoi > 0 && <p className={s.chuThich}>{`${tong.hoanCanhDoi}${CV.hoanCanhDoiHau}`}</p>}
      {tong.doiGiuaChung > 0 && <p className={s.chuThich}>{`${tong.doiGiuaChung}${CV.doiGiuaChungHau}`}</p>}
      {tong.boTrong > 0 && <p className={s.chuThich}>{`${tong.boTrong}${CV.boTrongHau}`}</p>}
      <p className={s.csChu}>{CV.giaiNap}</p>
    </div>
  );
}

/* ═══ Thẻ Oracle — P13: mọi thẻ nói được VÌ SAO bạn thấy nó ═════════════════════════ */

function TheOracle(
  { nd, onBoQua, onXemThem }: {
    nd: NoiDungOracle; onBoQua: () => void; onXemThem: () => void;
  },
): React.ReactElement {
  const [moViSao, datMoViSao] = useState(false);
  return (
    <div className={`${s.oracle} ${s.khac}`}>
      {/* D366 — Mascot THẬT thay khối pixel chỗ-giữ; xem `.linh` ở CSS. */}
      <span className={`${s.linh} ${s.khac}`} aria-hidden="true"><Mascot size={38} /></span>
      <span className={s.noi}>
        <span className={s.cauOracle}>{nd.cau}</span>
        {moViSao && <span className={s.viSao}>{nd.viSao}</span>}
        <span className={`${s.nutHang} ${s.hangOracle}`}>
          <button
            type="button"
            className={NUT2}
            aria-expanded={moViSao}
            onClick={() => {
              rung(NHIP_RUNG.cham);
              if (!moViSao) onXemThem();
              datMoViSao((v) => !v);
            }}
          >
            {moViSao ? C.nutAnLyDo : C.nutViSao}
          </button>
          <button type="button" className={NUT2} onClick={onBoQua}>{C.nutBoQua}</button>
        </span>
      </span>
    </div>
  );
}

/* ═══ Mặt TRONG TRẬN — dời sang `BaMat.tsx` (D426), xuất lại giữ tên cho các bài đang gọi nó ═══════════ */

export { MatTrongTran } from './BaMat';

/* ═══ Một chỉ số ═══════════════════════════════════════════════════════════════════ */

function ChiSoDong({ c }: { c: DongChiSo }): React.ReactElement {
  const [moGiai, datMoGiai] = useState(false);
  const thieu = c.nhan === null;
  const bar = c.bar ?? 0;
  const moc = c.moc;
  return (
    <div className={s.csD}>
      <div className={s.csTop}>
        <span className={s.t}>{c.ten}</span>
        {/* ⚠⚠ THIẾU MẪU ⇒ MỘT CÂU, KHÔNG PHẢI SỐ 0 (P7/D62). */}
        <span className={thieu ? `${s.v} ${s.thieuMau}` : s.v}>{thieu ? C.thieuMau : c.nhan}</span>
        <span className={s.n}>{`n=${c.n}`}</span>
        {/*
          ⚠⚠ NÚT ≠ HÌNH (founder chốt phương án (c), D292). `clip-path` xén cả VÙNG NHẬN
          CHẠM, nên khấc trên chính nút là lớp phủ 44px bị cắt về 21×21 — chạm trượt, im lặng.
          NÚT là `.cham44` (44×44, trong suốt, KHÔNG khấc) và mang trạng thái; HÌNH là span
          `.hoi.khac` 21×21 bên trong, chỉ để nhìn. Cùng nếp `.cham44` của `CaiDatPfm`.
        */}
        <button
          type="button" className={s.cham44} aria-expanded={moGiai}
          onClick={() => { rung(NHIP_RUNG.cham); datMoGiai((v) => !v); }}
        >
          <span className={`${s.hoi} ${s.khac}`}>{moGiai ? '✕' : '?'}</span>
        </button>
      </div>
      <div className={thieu ? `${s.csBar} ${s.thieu}` : s.csBar}>
        {!thieu && <i style={{ width: `${Math.round(Math.min(bar, moc ?? bar) * 100)}%` }} />}
        {!thieu && moc !== null && bar > moc && (
          <s style={{ left: `${Math.round(moc * 100)}%`, width: `${Math.round((bar - moc) * 100)}%` }} />
        )}
        {!thieu && moc !== null && <u style={{ left: `${Math.round(moc * 100)}%` }} />}
      </div>
      {thieu && <div className={s.csChu}>{c.chu}</div>}
      {moGiai && <p className={s.giai}><b>{`${c.chu}.`}</b>{` ${c.giai}`}</p>}
    </div>
  );
}

/* ═══ Bảng TRÔNG NHƯ LẶP LẠI ═══════════════════════════════════════════════════════ */

function BangLap({ ds }: { ds: NhomLap[] }): React.ReactElement {
  return (
    <>
      <div className={s.cuonBang}>
        <table className={s.bang}>
          <thead>
            <tr>
              <th>{C.cotKhoan}</th><th>{C.cotMoiLan}</th><th>{C.cotLan}</th><th>{C.cotRoiVao}</th>
            </tr>
          </thead>
          <tbody>
            {ds.map((g) => {
              const cuoi = g.khoan[g.khoan.length - 1]!;
              const { deu, ngay } = ngayDeu(g);
              return (
                <tr key={g.ten.toLowerCase()}>
                  <td>
                    {g.ten}<br />
                    <span className={s.it}>
                      <span className={O_NHO}>
                        {cuoi.nhan === null ? C.oChuaXep : O_CHU_LOAI_CHI[cuoi.nhan]}
                      </span>
                    </span>
                  </td>
                  <td>{dinhDangDong(cuoi.soTien)}</td>
                  <td>{g.khoan.length}</td>
                  <td>
                    {deu
                      ? `${C.roiVaoPre}${ngay}`
                      : <span className={s.it}>{C.thatThuong}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={s.csChu}>{C.chuThichLap}</p>
    </>
  );
}

/* ═══ Một luật ═════════════════════════════════════════════════════════════════════ */

function TheLuat(
  { l, onViec }: { l: Luat; onViec: (v: 'ban' | 'giu' | 'vo' | 'tat') => void },
): React.ReactElement {
  const cho = dangChoDanhGia(l);
  let giu = 0; let vo = 0;
  for (const d of l.lichSu) { if (d.ma === 'giu') giu++; else if (d.ma === 'vo') vo++; }
  const tong = giu + vo;
  /* ⚠ Tên điều kiện lấy từ MẪU (`mauTheoDieuKien`) chứ không khai lại — một nguồn (D61).
     `CHU_DIEU_KIEN` là câu dài, dùng làm bản lùi khi một điều kiện chưa có mẫu. */
  const ten = mauTheoDieuKien(l.dieuKien)?.ten ?? CHU_DIEU_KIEN[l.dieuKien];

  return (
    <div className={KHOI2}>
      <div className={s.hang2}>
        <span className={`${s.pill} ${l.trangThai === 'bat' ? s.chay : s.dung}`}>
          {ten.toUpperCase()}
        </span>
        <span className={`${s.phu2s} ${s.soPhai}`}>
          {tong ? `${C.giuPre}${giu}/${tong}` : C.chuaBan}
        </span>
      </div>
      <div className={s.cau}>{`“${l.loiNhac}”`}</div>
      {cho ? (
        <>
          <p className={s.chuThich}>{C.hoiGiuVo}</p>
          <div className={s.nutHang}>
            <button type="button" className={`${NUT2} ${s.chinh}`} onClick={() => onViec('giu')}>
              {C.nutGiuDuoc}
            </button>
            {/* ⚠ Vỡ luật là DATA, không phải tội — không phạt, không màu cảnh báo. */}
            <button type="button" className={NUT2} onClick={() => onViec('vo')}>
              {C.nutKhongGiu}
            </button>
          </div>
        </>
      ) : (
        <div className={s.nutHang}>
          <button type="button" className={NUT2} onClick={() => onViec('ban')}>
            {C.nutThuBan}
          </button>
          <button type="button" className={NUT2} onClick={() => onViec('tat')}>
            {l.trangThai === 'bat' ? C.nutTat : C.nutBat}
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══ FORM ĐẶT LUẬT — app ghép HÌNH, người dùng điền SỐ (D290) ══════════════════════ */

/**
 * Bàn gõ ngưỡng, đúng SÁU phím của demo. Không có phím "gợi ý mức" nào.
 *
 * ⚠⚠ PHẢI CÓ PHÍM '0'. Bỏ nó cho form gọn một hàng thì tập số gõ được chỉ còn ghép từ
 * {1, 2, 5} với các cụm '000' — và trong dải 20.000–600.000 KHÔNG một giá trị nào chia hết
 * cho 10.000: 50k · 100k · 200k · 500k đều KHÔNG GÕ ĐƯỢC, còn 125.000 thì được. Đó là bỏ
 * neo ở ô trống rồi dựng lại đúng cái neo ấy ở bàn phím — cùng họ A10 🔒 với
 * `NGUONG_GOI_Y = null`, chỉ sâu hơn một lớp (demo sửa 06/09).
 * ⚠ Xuất ra cho bài canh: bài đi TÌM một chuỗi phím cho từng mức tròn, thay vì gõ tay
 * từng ca — gõ tay là chép lại đúng giả định đang sai.
 */
export const PHIM_NGUONG = ['1', '2', '5', '0', '000', '⌫'] as const;

function FormDatLuat(props: {
  mau: MauLuat; mauChon: number; onChonMau: (i: number) => void;
  nguongGo: string; loiNguong: boolean; onGo: (k: string) => void;
  onHuy: () => void; onChot: () => void;
  /* Tệp 15 lát 1 — chip lời đoán cho tháng liền sau (tuỳ chọn). */
  chac: MaChac | null; onChac: (c: MaChac) => void; thangDoan: number;
}): React.ReactElement {
  const { mau, mauChon, onChonMau, nguongGo, loiNguong, onGo, onHuy, onChot, chac, onChac, thangDoan } = props;
  const canNguongForm = mauCanNguong(mau);
  const soNguong = Number.parseInt(nguongGo, 10);

  return (
    <div className={KHOI2}>
      <div className={s.ten2}>{C.formHoi}</div>

      <div className={`${s.tieu} ${s.tieuForm}`}>{C.tieuKhiNao}</div>
      <div className={s.nutHang}>
        {MAU_LUAT.map((m, i) => (
          <button
            key={m.id} type="button"
            className={`${NUT2} ${i === mauChon ? s.chinh : ''}`}
            aria-pressed={i === mauChon}
            onClick={() => onChonMau(i)}
          >
            {m.ten.toUpperCase()}
          </button>
        ))}
      </div>

      {/*
        ⚠⚠ Ô NGƯỠNG CHỈ HIỆN VỚI ĐIỀU KIỆN THẬT SỰ CẦN NGƯỠNG (`canNguong` ở `luat.ts` trả
        true CHỈ cho `khoan_vuot_muc`). Hiện nó với MỌI điều kiện là vừa hỏi thừa vừa hỏi
        thiếu: engine không có trường nào cho một số tiền ở vế hành động (D290).
      */}
      {canNguongForm && (
        <>
          <div className={`${s.tieu} ${s.tieuForm}`}>{C.tieuMucCuaBan}</div>
          <div className={s.hang2}>
            <span
              className={`${s.so2} ${s.oTrong} ${loiNguong ? s.loi : ''}`}
              data-loi={loiNguong ? 'co' : 'khong'}
            >
              {nguongGo && Number.isFinite(soNguong) ? dinhDangDong(soNguong) : '—'}
            </span>
            <span className={s.phu2s}>đ</span>
          </div>
          <p className={s.chuThich}>{C.giaiOTrong}</p>
          <div className={s.nutHang}>
            {PHIM_NGUONG.map((k) => (
              <button key={k} type="button" className={NUT2} onClick={() => onGo(k)}>{k}</button>
            ))}
          </div>
        </>
      )}

      <div className={`${s.tieu} ${s.tieuForm}`}>{C.tieuLoiNhac}</div>
      <div className={s.cau}>{`“${mau.loiNhacGoiY}”`}</div>
      <p className={s.chuThich}>{C.giaiLoiNhac}</p>

      {/*
        ⭐ LỜI ĐOÁN (tệp 15 lát 1) — một chạm, tuỳ chọn. Kỳ là THÁNG LIỀN SAU: tháng đang chạy đã có những
        lần bắn người dùng thấy rồi (cùng luật "chỉ kỳ mở ra sau lời đoán" của D385). Kết quả suy từ các
        chạm giữ/vỡ — không một câu hỏi nào thêm lúc tới hạn ngoài hàng VÌ SAO.
      */}
      <div className={`${s.tieu} ${s.tieuForm}`}>{`${CV.hoiLuatPre}${thangDoan}${CV.hoiLuatHau}`}</div>
      <div className={`${s.nutHang} ${s.hangChac}`}>
        {CHAC.map((c) => (
          <button
            key={c} type="button" className={`${NUT2} ${s.chacLuat} ${chac === c ? s.chinh : ''}`}
            aria-pressed={chac === c} onClick={() => onChac(c)}
          >
            {`${PFM.VI_THE_CHAC[c]}%`}
          </button>
        ))}
      </div>
      <p className={s.chuThich}>{CV.luatBoQuaDuoc}</p>

      <div className={s.nutHang}>
        <button type="button" className={NUT2} onClick={onHuy}>{CHU_MAN_HU.huy}</button>
        <button type="button" className={`${NUT2} ${s.chinh}`} onClick={onChot}>
          {C.nutDatLuat}
        </button>
      </div>
    </div>
  );
}
