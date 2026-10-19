/**
 * PFM — LUẬT NẾU-THÌ: lõi nghiệp vụ ở MÁY USER (nhóm G, bậc 3 thang can thiệp — GĐ6).
 *
 * ⚠⚠ RANH RIÊNG-TƯ/NGỮ-NGHĨA CHẶT HƠN `hu.ts`, VÀ ĐÓ LÀ CÓ CHỦ Ý: gần như MỌI THỨ về
 * một luật là riêng tư. Không có hàm `nhanNguNghia()` nào ở đây — sổ đăng ký hôm nay
 * (`config/pfm_dac_trung.ts`) chưa có nhãn nào mô tả NỘI DUNG một luật, chỉ có nhãn mô
 * tả KẾT QUẢ dùng luật (`kq_giu_luat`, `kq_rule_hieu_qua` — xem `tyLeGiuLuat` cuối
 * file). Nên:
 *
 *   RIÊNG TƯ (không bao giờ rời máy)     `loiNhac` · `dieuKien` · `thamSo` · `mauId`
 *   RA KHỎI MÁY ĐƯỢC (qua `events`, K5)   CHỈ `{luat_id, mau_id, hanh_dong}` — xem
 *                                         `suKienLuat()`; câu luật thật KHÔNG bao giờ
 *                                         nằm trong đó.
 *
 * ⚠ ĐIỀU KIỆN LÀ TẬP ĐÓNG (P13 — nội dung cá nhân hoá là bản TĨNH có id), KHÔNG PHẢI
 * NLP tự do trên câu `loiNhac`. `loiNhac` chỉ là LỜI HIỂN THỊ cho user đọc lại nguyên
 * văn lời họ tự dặn (dan-dat-hanh-vi-ca-nhan-hoa.md §2 bậc 3); máy KHÔNG BAO GIỜ phân
 * tích câu đó để suy ra điều kiện — `dieuKien` là một cú CHỌN từ menu, tách bạch hoàn
 * toàn khỏi câu chữ.
 *
 * ⚠ `hanh_dong` DÙNG ĐÚNG ENUM ĐÃ CHỐT Ở `migrations/0047_pfm.sql` §8 / K5 whitelist
 * (`config/pfm_events.ts`): `dat|sua|xoa|ban|giu|vo`. KHÔNG có 'bat'/'tat' trong đó —
 * bật/tắt một luật vì thế là CẤU HÌNH CỤC BỘ THUẦN, không sinh sự kiện (xem `datBat`).
 * Thêm hành động mới cho luật đòi một migration mới, không phải việc của GĐ6.
 *
 * ⚠ FILE NÀY KHÔNG BIẾT GÌ VỀ MẠNG (nối tiếp `hu.ts`/`so.ts`): các hàm chuyển trạng
 * thái trả về `Luat` mới, KHÔNG tự đẩy `dong_bo/`. `suKienLuat()` là tiện ích RIÊNG cho
 * người gọi (oracle.ts, GĐ7) dựng đúng hình `MonHangDoi` khi họ quyết định xếp hàng —
 * cùng ranh với `hu.ts` (không có transition nào ở đó tự gọi `xepHang` cả).
 */
import { laChiTieu, laThu, type Khoan } from './so.js';
import { ngayChiLon, ngayKeTiep } from './guong.js';
import { PFM } from '@config/pfm';
import { SO_DANG_KY } from '@config/pfm_dac_trung';
import { RE_KY } from '@config/pfm_dong_bo';
import { type MonHangDoi } from './dong_bo.js';

export class LoiLuat extends Error {}

/* ── Điều kiện: TẬP ĐÓNG, không NLP tự do ─────────────────────────────────────── */

export const DIEU_KIEN = ['ngay_chi_lon', 'khoan_vuot_muc', 'tien_vua_ve'] as const;
export type MaDieuKien = (typeof DIEU_KIEN)[number];

/** Tham số của điều kiện — CHỈ `khoan_vuot_muc` cần một ngưỡng; số này KHÔNG rời máy. */
export interface ThamSoDieuKien { nguong?: number }

export const TRANG_THAI_LUAT = ['bat', 'tat'] as const;
export type TrangThaiLuat = (typeof TRANG_THAI_LUAT)[number];

/*
 * Enum `hanh_dong`. ⚠ ĐỊNH NGHĨA SỐNG Ở `config/pfm_events.ts`, cạnh cửa kiểm K5 (R9);
 * đây là RE-EXPORT, không phải bản sao thứ hai.
 */
import { HANH_DONG_LUAT, type MaHanhDongLuat } from '@config/pfm_events';
import {
  laChac, laLyDo, loiDoanLuatHienHanh, thangCuaLuc, trangThaiLoiDoanLuat,
  type LoiDoanLuat, type MaChac, type MaLyDoViThe,
} from './vi_the.js';
import { thangSauCua } from './thoi_gian.js';

export { HANH_DONG_LUAT };
export type { MaHanhDongLuat };

export interface DauLuat {
  ma: MaHanhDongLuat;
  /** Mốc thời gian máy user. Đủ để dựng quỹ đạo; KHÔNG kèm số tiền (P17: ghi thêm, không ghi đè). */
  luc: string;
}

/**
 * Miền của `kq_rule_hieu_qua` — SUY từ sổ đăng ký, không chép (cùng lý lẽ `KET_QUA_HU` ở
 * `hu.ts`): nhãn này là OUTCOME đi thẳng vào dataset, lệch miền phải là lỗi biên dịch.
 */
export const HIEU_QUA_LUAT = SO_DANG_KY.kq_rule_hieu_qua.mien;
export type MaHieuQuaLuat = (typeof HIEU_QUA_LUAT)[number];

export interface Luat {
  id: string;
  /* ── riêng tư (P2 🔒) ── */
  loiNhac: string;
  dieuKien: MaDieuKien;
  thamSo: ThamSoDieuKien | null;
  /** Mẫu đã dùng để tạo, hoặc `null` nếu user tự viết. Là data (P14), ở lại máy. */
  mauId: string | null;
  /* ── vận hành, cũng ở lại máy — chỉ hanh_dong rời qua events ── */
  trangThai: TrangThaiLuat;
  taoLuc: string;
  lichSu: DauLuat[];
  /**
   * ⭐ LUẬT CÓ TÁC DỤNG KHÔNG — NGƯỜI DÙNG đánh giá sau một kỳ (D325, thẻ CUỐI KỲ), khoá
   * `'YYYY-MM'`. Đây là thứ `kq_rule_hieu_qua` khai "do user đánh giá" mà tới D325 chưa
   * màn nào hỏi. Vắng khoá = chưa trả lời, KHÔNG phải `chua_ro`: "chưa rõ" là một câu trả
   * lời, "chưa hỏi" thì không (P7).
   */
  hieuQuaKy?: Partial<Record<string, MaHieuQuaLuat>>;
  /**
   * ⭐ LỜI ĐOÁN (tệp 15 lát 1) — *"tháng K giữ trọn luật này, chắc N %"*. Chỉ nối thêm; ở lại máy
   * (P2). Kết quả SUY từ `lichSu` (các chạm giữ/vỡ) — `vi_the.ts` §`trangThaiLoiDoanLuat`.
   */
  loiDoan?: LoiDoanLuat[];
}

const CAT_LOI_NHAC = 200;

function chuanLoiNhac(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t.length === 0) throw new LoiLuat('Luật cần một lời nhắc.');
  return t.slice(0, CAT_LOI_NHAC);
}

/**
 * Điều kiện này có cần NGƯỠNG do user đặt không.
 *
 * ⚠ TÁCH RA THÀNH MỘT HÀM vì có HAI người hỏi cùng câu này: bộ kiểm ở dưới, và màn đặt
 * luật (qua `mau_luat.ts`) để biết có hiện ô nhập ngưỡng hay không. Trả lời ở hai chỗ thì
 * hai chỗ sẽ trôi, và kiểu trôi ấy rất êm: màn hình không hỏi ngưỡng, `taoLuatMoi` ném,
 * người dùng thấy "có lỗi" ở một nút trông chẳng liên quan gì.
 */
export function canNguong(dk: MaDieuKien): boolean {
  return dk === 'khoan_vuot_muc';
}

function kiemDieuKien(dk: MaDieuKien, thamSo: ThamSoDieuKien | undefined): void {
  if (!(DIEU_KIEN as readonly string[]).includes(dk)) {
    throw new LoiLuat(`Điều kiện không hợp lệ: ${dk}`);
  }
  if (canNguong(dk)) {
    const n = thamSo?.nguong;
    if (n === undefined || !Number.isFinite(n) || n <= 0) {
      throw new LoiLuat('Điều kiện "khoản vượt mức" cần một ngưỡng dương do user tự đặt.');
    }
  }
}

/* ── Tạo / sửa ─────────────────────────────────────────────────────────────────── */

export interface DauVaoTaoLuat {
  /** ⭐ Lời user tự viết, hoặc gợi ý từ mẫu mà user đã xác nhận/chỉnh. Không bao giờ app tự sáng tác (P3 🔒). */
  loiNhac: string;
  dieuKien: MaDieuKien;
  thamSo?: ThamSoDieuKien;
  mauId?: string | null;
}

export function taoLuatMoi(v: DauVaoTaoLuat, luc: string, id: string): Luat {
  kiemDieuKien(v.dieuKien, v.thamSo);
  return {
    id,
    loiNhac: chuanLoiNhac(v.loiNhac),
    dieuKien: v.dieuKien,
    thamSo: v.thamSo ?? null,
    mauId: v.mauId ?? null,
    trangThai: 'bat',
    taoLuc: luc,
    lichSu: [{ ma: 'dat', luc }],
  };
}

/**
 * SỬA LUẬT — mọi trường sửa được, mỗi cú sửa để lại một dấu 'sua' (P17: ghi thêm).
 * ⚠ Đổi `dieuKien` mà không kèm `thamSo` mới thì GIỮ `thamSo` cũ — chỉ ném lỗi nếu tổ
 * hợp CUỐI CÙNG (sau khi áp thay đổi) không hợp lệ, không phải nếu từng vế riêng lẻ
 * trông thiếu giữa chừng.
 */
export function suaLuat(luat: Luat, thay: Partial<DauVaoTaoLuat>, luc: string): Luat {
  const dieuKienMoi = thay.dieuKien ?? luat.dieuKien;
  const thamSoMoi = thay.thamSo !== undefined ? thay.thamSo : (luat.thamSo ?? undefined);
  kiemDieuKien(dieuKienMoi, thamSoMoi);

  return {
    ...luat,
    loiNhac: thay.loiNhac !== undefined ? chuanLoiNhac(thay.loiNhac) : luat.loiNhac,
    dieuKien: dieuKienMoi,
    thamSo: thamSoMoi ?? null,
    lichSu: [...luat.lichSu, { ma: 'sua', luc }],
  };
}

/**
 * BẬT/TẮT — cấu hình cục bộ THUẦN, KHÔNG sinh sự kiện (xem docstring đầu file: 'bat'/
 * 'tat' không nằm trong enum `hanh_dong` đã chốt ở DB). Không đụng lịch sử.
 */
export function datBat(luat: Luat, bat: boolean, luc?: string): Luat {
  const ra: Luat = { ...luat, trangThai: bat ? 'bat' : 'tat' };
  /*
   * ⚠ TẮT khi lời đoán còn mở = ĐỔI ĐIỀU KIỆN (tệp 15 R2): luật tắt thì không bắn, "giữ trọn"
   * thành đúng một cách tầm thường. Luật không lưu lịch sử bật/tắt, nên phải khép NGAY lúc tắt —
   * sau đó không còn gì để suy ra. `luc` vắng (chỗ gọi cũ) ⇒ giữ nguyên hành vi cũ.
   */
  if (bat || luc === undefined) return ra;
  const ld = loiDoanLuatHienHanh(luat, thangCuaLuc(luc));
  if (ld === null || trangThaiLoiDoanLuat(luat, ld, thangCuaLuc(luc)) !== 'mo') return ra;
  return { ...ra, loiDoan: [...luat.loiDoan!.slice(0, -1), { ...ld, doiGiuaChung: luc }] };
}

/**
 * ĐẶT LỜI ĐOÁN cho luật — *"tháng liền sau giữ trọn, chắc `chac`"*.
 * ⚠ Kỳ = tháng LIỀN SAU lúc đặt: tháng đang chạy đã có những lần bắn người dùng thấy rồi — đoán
 *   trên nó là đoán khi đã thấy một phần đáp án (cùng luật "chỉ kỳ mở ra sau lời đoán" của D385).
 * ⚠ Một lời đoán sống một lúc; luật đang tắt thì không đặt (nó sẽ không bắn).
 */
export function moLoiDoanLuat(luat: Luat, chac: MaChac, luc: string): Luat {
  if (!laChac(chac)) throw new LoiLuat(`Độ chắc không hợp lệ: ${String(chac)}`);
  if (luat.trangThai !== 'bat') throw new LoiLuat('Luật đang tắt — bật lại rồi mới đặt lời đoán.');
  const thang = thangCuaLuc(luc);
  if (loiDoanLuatHienHanh(luat, thang) !== null) {
    throw new LoiLuat('Luật này đang có một lời đoán chưa tới hạn.');
  }
  const ld: LoiDoanLuat = { ky: thangSauCua(thang), chac, datLuc: luc };
  return { ...luat, loiDoan: [...(luat.loiDoan ?? []), ld] };
}

/** NHÃN VÌ SAO cho lời đoán kỳ `ky` (thẻ CUỐI KỲ). Chạm lại thì đè. */
export function ghiLyDoLuat(luat: Luat, ky: string, lyDo: MaLyDoViThe): Luat {
  if (!laLyDo(lyDo)) throw new LoiLuat(`Lý do không hợp lệ: ${String(lyDo)}`);
  const i = luat.loiDoan?.findIndex((x) => x.ky === ky) ?? -1;
  if (i < 0) throw new LoiLuat('Không thấy lời đoán của kỳ này.');
  const ld = luat.loiDoan![i]!;
  if (ld.doiGiuaChung !== undefined) throw new LoiLuat('Lời đoán đã khép giữa chừng — không xét.');
  const moi = [...luat.loiDoan!];
  moi[i] = { ...ld, lyDo };
  return { ...luat, loiDoan: moi };
}

/* ── Bắn điều kiện + đánh giá giữ/vỡ ──────────────────────────────────────────── */

/** Có một lần BẮN đang chờ đánh giá giữ/vỡ không (dòng lịch sử cuối là 'ban'). */
export function dangChoDanhGia(luat: Luat): boolean {
  return luat.lichSu[luat.lichSu.length - 1]?.ma === 'ban';
}

/**
 * GHI NHẬN một lần BẮN — điều kiện vừa được đánh giá là ĐÚNG (xem `danhGiaDieuKien`).
 * ⚠ Không bắn chồng lên một lần bắn CHƯA được đánh giá — mỗi lần bắn phải có đúng một
 * kết quả giữ/vỡ trước khi bắn tiếp, không thì lịch sử có hai 'ban' liền nhau và không
 * ai biết 'giu'/'vo' kế tiếp thuộc về lần nào.
 */
export function banLuat(luat: Luat, luc: string): Luat {
  if (dangChoDanhGia(luat)) {
    throw new LoiLuat('Luật đang chờ đánh giá giữ/vỡ — chưa bắn lại được.');
  }
  return { ...luat, lichSu: [...luat.lichSu, { ma: 'ban', luc }] };
}

/**
 * NGƯỜI DÙNG đánh dấu giữ được hay vỡ lời — MỘT CHẠM, không hỏi thêm gì (dan-dat-
 * hanh-vi-ca-nhan-hoa.md §2 bậc 3). ⚠ KHÔNG PHẠT khi vỡ: vỡ luật là DATA, không phải
 * tội (cấm ở bậc 3 — phạt là dạy user giấu).
 */
export function ghiNhanGiuVo(luat: Luat, ketQua: 'giu' | 'vo', luc: string): Luat {
  if (!dangChoDanhGia(luat)) {
    throw new LoiLuat('Không có lần bắn nào đang chờ đánh giá.');
  }
  return { ...luat, lichSu: [...luat.lichSu, { ma: ketQua, luc }] };
}

/**
 * Sự kiện SẴN SÀNG xếp hàng (`dong_bo.xepHang`) cho một hành động vừa xảy ra trên một
 * luật — tiện ích cho NGƯỜI GỌI (không tự động hoá): file này không biết gì về mạng.
 * ⚠ `mau_id` rỗng khi không có mẫu — KHÔNG gửi `null` (K5 whitelist không phân biệt,
 * nhưng `''` khớp quy ước đã dùng cho `doi_tuong` ở `dac_trung.ts`).
 */
export function suKienLuat(
  luat: Luat, hanhDong: MaHanhDongLuat,
): Extract<MonHangDoi, { loai: 'nhip' }> {
  return {
    loai: 'nhip', ma: 'pfm_luat',
    v: { luat_id: luat.id, mau_id: luat.mauId ?? '', hanh_dong: hanhDong },
  };
}

/* ── ĐÁNH GIÁ ĐIỀU KIỆN — hàm THUẦN, đọc sổ local ─────────────────────────────── */

export interface KetQuaDanhGiaDieuKien {
  /** `null` = chưa đủ dữ liệu để nói (P7) — KHÔNG PHẢI "điều kiện sai". */
  dung: boolean | null;
}

/**
 * Điều kiện của MỘT luật có đang ĐÚNG cho `homNay` không — đọc sổ LOCAL, không gọi
 * mạng, không đụng lịch sử (đó là việc của `banLuat`, do NGƯỜI GỌI quyết định làm sau
 * khi thấy `dung === true`).
 */
export function danhGiaDieuKien(
  luat: Luat, so: readonly Khoan[], homNay: string,
): KetQuaDanhGiaDieuKien {
  switch (luat.dieuKien) {
    case 'ngay_chi_lon':
      return { dung: ngayChiLon(so, homNay).laNgayLon };

    case 'khoan_vuot_muc': {
      const nguong = luat.thamSo?.nguong;
      if (nguong === undefined) return { dung: null };   // luật hỏng dữ liệu — không đoán
      const homNayChi = so.filter((k) => laChiTieu(k) && k.ngay === homNay);
      // Có ngày (dù 0 khoản) là MỘT QUAN SÁT thật — không phải thiếu mẫu (P7).
      return { dung: homNayChi.some((k) => k.soTien >= nguong) };
    }

    case 'tien_vua_ve': {
      const ngayThu = so.filter(laThu).map((k) => k.ngay);
      if (ngayThu.length === 0) return { dung: null };
      for (const goc of ngayThu) {
        let n = goc;
        for (let i = 0; i < PFM.GUONG_CUA_SO_TIEN_VE; i++) {
          if (n === homNay) return { dung: true };
          n = ngayKeTiep(n);
        }
      }
      return { dung: false };
    }
  }
}

/**
 * Ghi đánh giá của người dùng cho MỘT kỳ đã khép (D325). Không đụng `lichSu`: đánh giá
 * không phải một `hanh_dong` (enum DB đã chốt — 0047 §8), nó rời máy trong GÓI KỲ
 * (`kq_rule_hieu_qua`), không qua `events`. Trả lời lại thì đè.
 */
export function ghiHieuQuaKy(luat: Luat, ky: string, v: MaHieuQuaLuat): Luat {
  if (!RE_KY.test(ky)) throw new LoiLuat(`Mã kỳ không hợp lệ: ${ky}`);
  if (!(HIEU_QUA_LUAT as readonly string[]).includes(v)) {
    throw new LoiLuat(`Đánh giá không hợp lệ: ${v}`);
  }
  return { ...luat, hieuQuaKy: { ...(luat.hieuQuaKy ?? {}), [ky]: v } };
}

/* ── Đóng góp cho đặc trưng KỲ (nhóm J — `dac_trung.ts` gọi, không tính lại) ──── */

/**
 * Tỷ lệ GIỮ được trong số các lần đã BẮN VÀ ĐÃ ĐÁNH GIÁ — `kq_giu_luat` (outcome, KHÔNG
 * theo_doi_tuong — một số GỘP cho cả kỳ, không tách theo từng luật). Đếm bằng đúng
 * `hanh_dong` trong lịch sử, không suy diễn gì thêm.
 *
 * ⚠ Không phát `kq_rule_hieu_qua` ở đây: nhãn đó (registry: "do USER đánh giá") đòi
 * một câu hỏi trực tiếp — phát một giá trị suy diễn dưới tên "user đánh giá" là bịa lời
 * chứng (P17 cấm). D325 dựng câu hỏi ấy (thẻ CUỐI KỲ ở GƯƠNG ⇒ `hieuQuaKy`), và
 * `dongGoiKy` phát NGUYÊN câu trả lời; hàm này vẫn không suy gì.
 */
export function tyLeGiuLuat(dsLuat: readonly Luat[]): number | null {
  let giu = 0; let vo = 0;
  for (const l of dsLuat) {
    for (const d of l.lichSu) {
      if (d.ma === 'giu') giu++;
      else if (d.ma === 'vo') vo++;
    }
  }
  const tong = giu + vo;
  return tong === 0 ? null : giu / tong;
}
