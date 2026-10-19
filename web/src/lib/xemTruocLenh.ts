/**
 * XEM TRƯỚC LỆNH — "hiện giá lệnh TRƯỚC khi bấm" (§7.4 doc poker-hoá).
 *
 * ⭐ KHÔNG CHÉP PHÉP TÍNH. Hàm này gọi thẳng `giaiLenhMoc` + `apLenhGiaoDich`
 * của lõi NAV — đúng hai hàm server chạy lúc áp lệnh thật. Lý do bắt buộc phải
 * làm vậy chứ không viết lại cho gọn: một bản cài đặt thứ hai của cùng công
 * thức sẽ TRÔI (D61), và cú trôi ở đây biểu hiện là "màn hình báo phí 140, bị
 * trừ 190" — sai IM LẶNG, không ai thấy cho tới khi mất tiền.
 *
 * C4 KHÔNG BỊ NỚI: server vẫn là nơi duy nhất ÁP lệnh. Đây thuần HIỂN THỊ, chạy
 * trên một BẢN SAO của trạng thái ghế, không gửi gì đi đâu.
 */
import { NAV_V10 } from '@config/holdem';
import {
  apLenhGiaoDich, giaiLenhMoc, type GheNav, type LenhMoc, type LoiLenh, type Mandate,
} from '@server/holdem/nav';
import type { TuyChonLenhGhe } from '@server/holdem/engine';

export interface XemTruoc {
  /** Tiền mặt sau khi cả chuỗi lệnh chạy xong. */
  tienMatSau: number;
  /** Vị thế dài sau lệnh — dùng vẽ cột "MUỐN GIỮ". */
  viTheSau: Record<string, number>;
  /** Sổ khống sau lệnh. */
  viKhongSau: Record<string, number>;
  /** Tổng trượt giá cả chuỗi (chảy vào Quỹ vòng, không đốt). */
  phi: number;
  /** v55 (D425) — phí cố định SỔ MỎNG cả chuỗi (ĐỐT, không vào Quỹ vòng). 0 khi ghế không mang lá. */
  phiCoDinh: number;
  /** Từng lệnh đã giải ra TIỀN — dương mua, âm bán. Để in "bán VÀNG 1.200". */
  buoc: { ma: string; tien: number; khong: boolean }[];
}

/** v55 (D425) — ràng buộc lệnh từ trait mà server phát cho ghế mình (chip): phí cố định SỔ MỎNG · phần BÁN còn được GÔNG CÙM. */
export interface TraitLenh { phiCoDinhLenh?: number; tranBanCon?: number }

/**
 * Trả `null` khi chuỗi lệnh chưa hợp lệ theo lõi.
 *
 * ⚠ Cố ý IM chứ không báo lỗi: client không biết trần số mã thật của ghế (đặc
 * quyền Đa Dạng Hoá do server cấp), nên một lỗi `day_tai_san` ở đây có thể là
 * lỗi GIẢ. Thà không nói gì còn hơn doạ người chơi bằng một lời từ chối sai —
 * server mới là nơi có quyền từ chối.
 */
export function xemTruocLenh(
  ghe: { tienMat: number; viThe: Record<string, number>; viKhong?: Record<string, number> },
  lenhMoc: readonly LenhMoc[],
  buocMocBp: number,
  coBanKhong: boolean,
  /*
   * v29 — PHÍ VỘI VÀNG của trận này (server phát `phi_voi_vang` trong DTO).
   * Phải đi qua đây vì lý do sống còn của cả module: thiếu nó thì màn báo phí
   * TUYẾN TÍNH trong khi server trừ PHI TUYẾN — đúng cú "màn báo 140, bị trừ
   * 190" mà docstring đầu file tồn tại để chặn.
   */
  voiVang = false,
  /**
   * v34 — HỆ SỐ TÁC ĐỘNG GIÁ theo VAI (server phát `tac_dong_gia`, luôn có; 1
   * khi không vai). Cùng lý do sống còn với `voiVang`: đội lái ×2 mà màn nhân
   * ×1 thì phí báo trước bằng NỬA phí bị trừ.
   */
  tacDongGia = 1,
  /**
   * v34 — MANDATE của vai tổ chức (server phát `ban.mandate`). Đi qua đây vì
   * `apLenhGiaoDich` kiểm nó: thiếu thì màn báo "đủ tiền" rồi server từ chối
   * cả chuỗi — đúng cú nuốt mà D67 dựng module này để chặn.
   */
  mandate?: Mandate,
  /**
   * v42 (D311) — SÀN CẤM KHỐNG THEO MÃ (server phát `ban.khong_theo_ma`). Cùng lý do
   * sống còn với `voiVang`/`mandate`: thiếu nó thì màn cho xếp lệnh khống một mã mà
   * server sẽ từ chối cả chuỗi — đúng cú nuốt lệnh mà D67 dựng module này để chặn.
   */
  khongTheoMa = false,
  /**
   * v49 (D342) — CHIP KHỐNG THEO HẠN MỨC (server phát `ban.khong_theo_han_muc`). Cùng lý do sống
   * còn với ba cờ trên: thiếu nó thì bản nháp giải 100% trên TIỀN MẶT, server giải 100% trên
   * HẠN MỨC — con số "DANH MỤC SAU LỆNH" lệch cả nghìn chip với thứ thật sự khớp.
   */
  khongTheoHanMuc = false,
  /**
   * D342 — ĐỘ SÂU SỔ QUY CHIẾU của phí vội vàng (server phát `ban.von_quy_chieu` = vốn khởi điểm
   * của vai). Server truyền đúng số này vào `apLenhGiaoDich` ở trận có vai; thiếu nó thì ghế vốn
   * ×2/×3 thấy phí báo trước theo sổ 10.000 — cao hơn hẳn phí bị trừ thật.
   * Vắng ⇒ `START_VON` (đúng mặc định của lõi).
   */
  vonQuyChieu?: number,
  /**
   * v50 (D345) — PHÍ LỆNH NHẸ (server phát `ban.phi_lenh_nhe` + `phi_lenh_con_bp`). Cùng lý do sống
   * còn với mọi cờ trên: thiếu nó thì màn báo phí bảng cũ (10–20%) trong khi server trừ bảng mới.
   */
  phiLenh: { phiLenhNhe?: boolean; phiLenhBac?: boolean; phiLenhConBp?: number; sauBp?: number } = {},
  /**
   * v55 (D425) — RÀNG BUỘC LỆNH TỪ TRAIT (server phát `rang_buoc.phi_co_dinh_lenh` · `tran_ban_con`). Cùng lý do sống còn
   * với mọi cờ trên: thiếu phí cố định thì màn báo tiền về nhiều hơn tiền thật; thiếu trần bán thì màn cho xếp lệnh bán
   * mà server bác cả chuỗi.
   */
  trait: TraitLenh = {},
): XemTruoc | null {
  return chayXemTruoc(ghe, lenhMoc, buocMocBp, coBanKhong, voiVang, tacDongGia,
    mandate, khongTheoMa, khongTheoHanMuc, vonQuyChieu, phiLenh, trait).ra;
}

/**
 * v34 — LÝ DO chuỗi bị từ chối (null = chạy được, hoặc rỗng). Tách khỏi
 * `xemTruocLenh` để consumer cũ không phải phân nhánh; ShopManHinh chỉ dùng nó
 * cho hai lỗi MANDATE — những lỗi client BIẾT CHẮC (vai mình do server phát),
 * khác `day_tai_san` có thể là lỗi GIẢ (xem đầu file).
 */
export function lyDoTuChoi(
  ghe: { tienMat: number; viThe: Record<string, number>; viKhong?: Record<string, number> },
  lenhMoc: readonly LenhMoc[], buocMocBp: number, coBanKhong: boolean,
  voiVang = false, tacDongGia = 1, mandate?: Mandate, khongTheoMa = false,
  khongTheoHanMuc = false, vonQuyChieu?: number,
  phiLenh: { phiLenhNhe?: boolean; phiLenhBac?: boolean; phiLenhConBp?: number; sauBp?: number } = {},
  trait: TraitLenh = {},
): LoiLenh | 'moc_khong_hop_le' | null {
  return chayXemTruoc(ghe, lenhMoc, buocMocBp, coBanKhong, voiVang, tacDongGia,
    mandate, khongTheoMa, khongTheoHanMuc, vonQuyChieu, phiLenh, trait).loi;
}

function chayXemTruoc(
  ghe: { tienMat: number; viThe: Record<string, number>; viKhong?: Record<string, number> },
  lenhMoc: readonly LenhMoc[], buocMocBp: number, coBanKhong: boolean,
  voiVang: boolean, tacDongGia: number, mandate: Mandate | undefined,
  khongTheoMa: boolean,
  khongTheoHanMuc: boolean,
  vonQuyChieu: number | undefined,
  phiLenh: { phiLenhNhe?: boolean; phiLenhBac?: boolean; phiLenhConBp?: number; sauBp?: number },
  trait: TraitLenh,
): { ra: XemTruoc | null; loi: LoiLenh | 'moc_khong_hop_le' | null } {
  // v50 (D345) — chỉ đưa khoá có mặt (exactOptionalPropertyTypes): cờ tắt ⇒ lõi chạy bảng cũ.
  const pl = {
    ...(phiLenh.phiLenhNhe === true ? { phiLenhNhe: true } : {}),
    ...(phiLenh.phiLenhNhe === true && phiLenh.phiLenhBac === true ? { phiLenhBac: true } : {}),
    ...(phiLenh.phiLenhNhe === true && phiLenh.phiLenhConBp !== undefined
      ? { phiLenhConBp: phiLenh.phiLenhConBp } : {}),
    // D516 — độ sâu chợ của ghế (vai vốn to): cùng số server áp.
    ...(phiLenh.phiLenhNhe === true && phiLenh.sauBp !== undefined ? { sauBp: phiLenh.sauBp } : {}),
  };
  // v55 (D425) — phần BÁN còn được đưa về dạng trần của lõi (`daBan` 0: server đã trừ phần bán trước khi phát số).
  const tr = {
    ...(trait.phiCoDinhLenh !== undefined && trait.phiCoDinhLenh > 0 ? { phiCoDinhLenh: trait.phiCoDinhLenh } : {}),
    ...(trait.tranBanCon !== undefined ? { tranBanVong: { tranTien: trait.tranBanCon, daBan: 0 } } : {}),
  };
  if (lenhMoc.length === 0) return { ra: null, loi: null };

  // BẢN SAO — `apLenhGiaoDich` ghi đè vào ghế được truyền vào.
  const nhap: GheNav = {
    von: ghe.tienMat,
    vi_the: { ...ghe.viThe },
    vi_the_khong: { ...(ghe.viKhong ?? {}) },
  };
  const coChiaLenh = buocMocBp === NAV_V10.BUOC_MOC_BP;
  // v42 (D311) — CÙNG hàm, CÙNG cờ với server: bản nháp phải từ chối đúng chỗ server
  // từ chối, không thì màn cho xếp lệnh rồi server mới báo (lớp lỗi D67).
  const giai = giaiLenhMoc(nhap, lenhMoc, coChiaLenh,
    {
      coBanKhong, voiVang, tacDongGia, khongTheoMa, khongTheoHanMuc,
      ...(vonQuyChieu !== undefined ? { vonQuyChieu } : {}),
      ...pl, ...tr,
    });
  if (giai.loi !== null) return { ra: null, loi: giai.loi };
  if (giai.lenh.length === 0) return { ra: null, loi: null };

  const sau: GheNav = {
    von: ghe.tienMat,
    vi_the: { ...ghe.viThe },
    vi_the_khong: { ...(ghe.viKhong ?? {}) },
  };
  const ap = apLenhGiaoDich(sau, giai.lenh, {
    voiVang, tacDongGia, ...(mandate ? { mandate } : {}),
    ...(vonQuyChieu !== undefined ? { vonQuyChieu } : {}),
    ...pl, ...tr,
  });
  if (ap.loi !== null) return { ra: null, loi: ap.loi };

  return {
    ra: {
      tienMatSau: sau.von,
      viTheSau: sau.vi_the,
      viKhongSau: sau.vi_the_khong ?? {},
      phi: ap.phi_quy,
      phiCoDinh: ap.phi_dot ?? 0,
      buoc: giai.lenh.map((l) => ({ ma: l.ma, tien: l.tien, khong: l.khong === true })),
    },
    loi: null,
  };
}

/*
 * ═══ D446 — XEM TRƯỚC BẰNG ĐÚNG BỘ THAM SỐ SERVER ÁP ═════════════════════════════════════════════════════════
 * Server phát `ban.tuy_chon_lenh` = CHÍNH bộ `apLenhMocNav` dùng (`tuyChonLenhGhe`: vai · sàn khống · hạn mức khống ·
 * phí lệnh · lửa · Mua Đuổi muộn · trait · trần số mã · mốc thêm). Hàm dưới đưa NGUYÊN bộ ấy vào CHÍNH `giaiLenhMoc` +
 * `apLenhGiaoDich` — không còn cờ nào chép tay ở client (cách cũ phía trên rơi mất bốn khoá v55: lệch phí tới 31 chip,
 * lệch vị thế ở hơn nửa số lần khớp, mốc 10% của LỆNH MỊN bị báo sai). Cách cũ giữ làm đường lùi cho server chưa phát.
 * ⚠ ĐIỀU KIỆN GỠ đường lùi (A8.9): bản phát hành đầu tiên mang D446 đã lên prod CẢ API lẫn web (deploy API trước web
 * ⇒ web mới không bao giờ gặp DTO thiếu `tuy_chon_lenh`) ⇒ bản kế gỡ `xemTruocLenh` · `lyDoTuChoi` và các cờ lẻ
 * trùng bộ này trong `nav` của shop. Chưa gỡ ngay vì một bản vá lỗi tiền không nên kèm một cú dọn chạm 20+ bài test.
 */
/**
 * D446 — bộ tham số lệnh cho SHOP ở một vòng: bộ server phát (`ban.tuy_chon_lenh`) + hai cờ của lá lõi người chơi ĐANG
 * CHỌN (lá chỉ vào tay lúc chốt — Bán Khống mở mặt KHỐNG, Chia Lệnh mở bước mốc mịn; đúng hai cờ đường cũ vẫn cộng), kèm
 * `laVuaChon` để shop biết vòng này trần số mã / bước chip chưa chắc. Server chưa phát ⇒ rỗng: shop đi đường cũ.
 * Hàm thuần để bài canh gọi thẳng — dây nối viết inline ở màn trận đã từng bị vô hiệu mà bài dò chữ vẫn xanh.
 */
export function tuyChonLenhChoShop(
  tc: TuyChonLenhGhe | undefined, chonCT: string | null,
): { tuyChonLenh?: TuyChonLenhGhe; laVuaChon?: boolean } {
  if (!tc) return {};
  return {
    tuyChonLenh: {
      ...tc,
      coBanKhong: tc.coBanKhong || chonCT === 'ban_khong',
      coChiaLenh: tc.coChiaLenh || chonCT === 'chia_lenh',
    },
    laVuaChon: chonCT !== null,
  };
}

/**
 * D447 — TIỀN MẶT SAU CÁC LỆNH ĐANG XẾP (null = không có lệnh · chuỗi sẽ bị bác · server chưa phát bộ tham số). Ngăn
 * ngân hàng gửi trên số này: lúc CHỐT server mở hợp đồng tiết kiệm SAU chuỗi lệnh, trên tiền còn lại — nên "bán rồi gửi"
 * trong một vòng hợp lệ, mà ngăn cũ tính trên tiền mặt HIỆN CÓ (ví 0 ⇒ khoá gửi; đường vòng cũ là KHỚP NGAY, đã bỏ).
 * Chạy bằng CHÍNH `xemTruocTheoTuyChon` của shop, cộng lá lõi đang chọn như shop (một nguồn).
 */
export function tienMatSauLenhDangXep(
  ban: {
    von: number; tien_mat?: number; vi_the?: Record<string, number>; vi_the_khong?: Record<string, number>;
    tuy_chon_lenh?: TuyChonLenhGhe;
  },
  lenh: readonly LenhMoc[], chonCT: string | null,
): number | null {
  if (lenh.length === 0 || !ban.tuy_chon_lenh || ban.vi_the === undefined) return null;
  const tc = tuyChonLenhChoShop(ban.tuy_chon_lenh, chonCT).tuyChonLenh;
  if (!tc) return null;
  const xt = xemTruocTheoTuyChon(
    { tienMat: ban.tien_mat ?? ban.von, viThe: ban.vi_the, viKhong: ban.vi_the_khong }, lenh, tc);
  return xt ? xt.tienMatSau : null;
}

export function xemTruocTheoTuyChon(
  ghe: { tienMat: number; viThe: Record<string, number>; viKhong?: Record<string, number> },
  lenhMoc: readonly LenhMoc[], tc: TuyChonLenhGhe,
): XemTruoc | null {
  return chayTheoTuyChon(ghe, lenhMoc, tc).ra;
}

export function lyDoTuChoiTheoTuyChon(
  ghe: { tienMat: number; viThe: Record<string, number>; viKhong?: Record<string, number> },
  lenhMoc: readonly LenhMoc[], tc: TuyChonLenhGhe,
): LoiLenh | 'moc_khong_hop_le' | null {
  return chayTheoTuyChon(ghe, lenhMoc, tc).loi;
}

function chayTheoTuyChon(
  ghe: { tienMat: number; viThe: Record<string, number>; viKhong?: Record<string, number> },
  lenhMoc: readonly LenhMoc[], tc: TuyChonLenhGhe,
): { ra: XemTruoc | null; loi: LoiLenh | 'moc_khong_hop_le' | null } {
  if (lenhMoc.length === 0) return { ra: null, loi: null };
  const nhap: GheNav = { von: ghe.tienMat, vi_the: { ...ghe.viThe }, vi_the_khong: { ...(ghe.viKhong ?? {}) } };
  const giai = giaiLenhMoc(nhap, lenhMoc, tc.coChiaLenh, tc);
  if (giai.loi !== null) return { ra: null, loi: giai.loi };
  if (giai.lenh.length === 0) return { ra: null, loi: null };
  const sau: GheNav = { von: ghe.tienMat, vi_the: { ...ghe.viThe }, vi_the_khong: { ...(ghe.viKhong ?? {}) } };
  const ap = apLenhGiaoDich(sau, giai.lenh, tc);
  if (ap.loi !== null) return { ra: null, loi: ap.loi };
  return {
    ra: {
      tienMatSau: sau.von,
      viTheSau: sau.vi_the,
      viKhongSau: sau.vi_the_khong ?? {},
      phi: ap.phi_quy,
      phiCoDinh: ap.phi_dot ?? 0,
      buoc: giai.lenh.map((l) => ({ ma: l.ma, tien: l.tien, khong: l.khong === true })),
    },
    loi: null,
  };
}
