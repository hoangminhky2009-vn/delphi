/**
 * PFM — GƯƠNG: sổ → CHỈ SỐ (nhóm E). Hàm thuần, chạy ở máy user.
 *
 * ⚠⚠ FILE NÀY KHÔNG TRẢ VỀ MỘT CÂU NÀO — chỉ SỐ và ĐẾM. Đó không phải thiếu sót mà là
 * cách thi hành A10 🔒 (*"mô tả được, kê đơn không"*) **bằng cấu trúc thay vì bằng kỷ
 * luật**: chỗ này không có chuỗi hiển thị nào để mà lỡ viết "bạn nên bớt ăn ngoài".
 * Câu chữ sống ở catalog riêng của client (D26) và catalog đó có bài quét `TU_KE_DON`.
 *
 * ⚠⚠ MẪU SỐ LUÔN ĐI KÈM TỬ SỐ (bài học D123). Mỗi chỉ số trả cả `n` — số quan sát đứng
 * sau nó — và **dưới sàn thì trả `null`, không trả 0** (P7/D62). Một tỷ lệ dựng từ hai
 * ngày mà nói cùng giọng với tỷ lệ dựng từ ba mươi ngày là cách app tự tin sai, và người
 * dùng không có đường nào biết.
 *
 * ⚠ RANH VỚI `so.ts`: bên kia chỉ CỘNG; mọi con số có DIỄN GIẢI ở đây. Ranh với
 * `dac_trung/`: bên đó chỉ ĐÓNG GÓI đúng các số này theo sổ đăng ký — không tính lại,
 * vì tính lại là dựng bản thứ hai của cùng một công thức (D61).
 *
 * ⚠ KHÔNG ĐỌC ĐỒNG HỒ. Có phép tính lịch (`ngayKeTiep`) nhưng nó chạy trên chuỗi ngày
 * ĐƯỢC ĐƯA VÀO, không bao giờ hỏi "hôm nay là ngày mấy" — cùng luật với `kho.ts`.
 */
import { PFM } from '@config/pfm';
import { laChiTieu, laPhanBo, laThu, type Khoan } from './so.js';

/** Một chỉ số của gương: giá trị + số quan sát đứng sau nó. `gt === null` = chưa đủ mẫu. */
export interface ChiSo {
  gt: number | null;
  n: number;
}

const CHUA_DU = (n: number): ChiSo => ({ gt: null, n });

function kep(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

/* ═══ 1. LỊCH — số học trên chuỗi ngày, không hỏi đồng hồ ═════════════════════ */

/**
 * ⚠ Dùng `Date.UTC` cho phép cộng ngày là AN TOÀN vì cả vào lẫn ra đều là chuỗi ngày
 * trần: không có múi giờ nào tham gia, nên không có chỗ cho bug lệch-một-ngày. Cái bị
 * cấm ở tầng này là ĐỌC ĐỒNG HỒ (`Date.now()`, `new Date()` không tham số) — thứ làm
 * kết quả đổi theo lúc chạy và làm test hết tất định.
 */
export function ngayKeTiep(ngay: string): string {
  const [y, m, d] = ngay.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return t.toISOString().slice(0, 10);
}

/** Tổng CHI theo từng ngày (chỉ ngày có chi). Thu không vào đây. */
export function chiTheoNgay(so: readonly Khoan[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of so) {
    if (!laChiTieu(k)) continue;
    m.set(k.ngay, (m.get(k.ngay) ?? 0) + k.soTien);
  }
  return m;
}

/**
 * ⚠ TRUNG VỊ, không phải trung bình — và đây là lựa chọn có hậu quả: một ngày mua điện
 * thoại kéo trung bình lên đủ để chính nó thôi là "ngày lớn", và cả chỉ số chi-bù tự vô
 * hiệu hoá. Trung vị miễn nhiễm với đúng loại ngày mà chỉ số này sinh ra để nhìn.
 */
export function trungVi(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const g = Math.floor(s.length / 2);
  return s.length % 2 ? s[g]! : (s[g - 1]! + s[g]!) / 2;
}

/* ═══ 2. TIẾT KIỆM RÒNG ═══════════════════════════════════════════════════════ */

export interface TietKiem extends ChiSo {
  thu: number;
  chi: number;
  /** `true` khi tỷ lệ thật vượt ngoài [−1,1] và đã bị kẹp — người gọi phải nói ra. */
  chamSan: boolean;
}

/**
 * (thu − chi) / thu, trong [−1, 1].
 *
 * ⚠ `thu === 0` ⇒ `null`, KHÔNG phải −1. Không có thu nhập trong kỳ thì "tiết kiệm được
 * mấy phần trăm thu nhập" là câu KHÔNG CÓ NGHĨA, chứ không phải câu có nghĩa với đáp án
 * xấu. Trả −1 ở đây là bịa ra một phán xét từ một phép chia cho 0.
 * ⚠ Trả kèm `thu`/`chi` thô: chúng là tiền của chính user, ở lại máy, nên giấu đi không
 * bảo vệ ai — mà giấu thì người gọi mất đường kiểm lại con số.
 */
export function tietKiemRong(tatCa: readonly Khoan[]): TietKiem {
  // ⚠ D420 — chuyển vào hũ vẫn là tiền đã để dành, không phải tiêu; và nó không phải một QUAN SÁT: cỡ mẫu `n` đếm cả nó
  //   là quy tắc 50k/ngày tự "đủ mẫu" cho một đặc trưng rời máy (bài `pfm_chi_tieu.test.ts` bắt: n 59 → 118).
  const so = tatCa.filter((k) => !laPhanBo(k));
  let thu = 0; let chi = 0;
  for (const k of so) { if (laThu(k)) thu += k.soTien; else chi += k.soTien; }
  if (thu === 0) return { ...CHUA_DU(so.length), thu, chi, chamSan: false };
  const raw = (thu - chi) / thu;
  return { gt: kep(raw, -1, 1), n: so.length, thu, chi, chamSan: raw < -1 || raw > 1 };
}

/* ═══ 3. VÌ SALE / BẠN RỦ ═════════════════════════════════════════════════════ */

/**
 * ⭐ MẪU SỐ LÀ "ĐÃ HỎI", KHÔNG PHẢI "TẤT CẢ KHOẢN".
 *
 * `viSale === null` nghĩa là CHƯA HỎI (P7) — khác hẳn `false` = đã hỏi và user nói
 * không. Cho khoản chưa-hỏi vào mẫu số là thổi phồng nó bằng những dòng không mang thông
 * tin, và tỷ lệ FOMO đọc ra thấp giả tạo ở đúng người ghi sổ cẩu thả nhất. Đây là lỗi
 * KHÔNG lộ ra ở đâu: con số vẫn nằm trong [0,1] và vẫn trông hợp lý.
 */
export function viSale(so: readonly Khoan[]): ChiSo {
  const daHoi = so.filter((k) => laChiTieu(k) && k.viSale !== null);
  if (daHoi.length < PFM.GUONG_SAN_QUAN_SAT) return CHUA_DU(daHoi.length);
  return { gt: daHoi.filter((k) => k.viSale === true).length / daHoi.length, n: daHoi.length };
}

/* ═══ 4. PROVENANCE — cách ghi ════════════════════════════════════════════════ */

export interface PhanBoCachGhi {
  gt: { tay: number; mau_lap: number; dan_sms: number } | null;
  n: number;
}

/** Phân bố cách ghi, cộng lại = 1. Không phải điểm tin cậy — xem `so.ts`. */
export function cachGhi(tatCa: readonly Khoan[]): PhanBoCachGhi {
  // ⚠ D420 — khoản phân bổ do màn HŨ sinh, không phải một cú GHI của người dùng: đếm nó là thổi phồng `tay`.
  const so = tatCa.filter((k) => !laPhanBo(k));
  if (so.length === 0) return { gt: null, n: 0 };
  const d = { tay: 0, mau_lap: 0, dan_sms: 0 };
  for (const k of so) d[k.cachGhi]++;
  return {
    gt: { tay: d.tay / so.length, mau_lap: d.mau_lap / so.length, dan_sms: d.dan_sms / so.length },
    n: so.length,
  };
}

/* ═══ 5. TIỀN VỀ LÀ TIÊU ══════════════════════════════════════════════════════ */

/**
 * Phần chi rơi vào cửa sổ "tiền vừa về" (ngày nhận + ngày kế) trên TỔNG chi của kỳ.
 *
 * ⚠ Cửa sổ gom vào một TẬP NGÀY trước khi cộng — hai ngày có thu nằm sát nhau thì cửa sổ
 * chồng lên nhau, và cộng thẳng theo từng cửa sổ sẽ đếm hai lần cùng một khoản, cho ra
 * tỷ lệ > 1 (tức ngoài miền sổ đăng ký) mà không ai thấy vì nó vẫn là một con số đẹp.
 *
 * ⚠⚠ VÀ VÌ THẾ **KHÔNG KẸP** KẾT QUẢ VỀ [0,1] Ở ĐÂY — dù mọi chỉ số khác đều kẹp. Với
 * cái `Set` ở trên, `trong ⊆ chi của kỳ` theo CẤU TRÚC, nên phép kẹp không bao giờ có
 * việc để làm; nó chỉ sống dậy khi đã có bug, và lúc đó nó **giấu đúng cái bug ấy đi**.
 * Tôi đã tự dính: bản đầu có kẹp, và mũi tiêm "cộng theo từng cửa sổ" cho ra 2,0 rồi bị
 * kẹp về 1,0 — trùng khít đáp án đúng, nên bài test XANH trên một bản đã hỏng. Một lưới
 * an toàn không đỡ được gì thì tệ hơn không có: nó làm người sau thôi kiểm (nối tiếp
 * đúng phép rỗng mà `so.ts` từng ghi).
 */
export function tienVeTieu(so: readonly Khoan[]): ChiSo {
  const ngayThu = so.filter(laThu).map((k) => k.ngay);
  const tongChi = so.reduce((s, k) => s + (laChiTieu(k) ? k.soTien : 0), 0);
  if (ngayThu.length === 0 || tongChi === 0) return CHUA_DU(ngayThu.length);

  const cuaSo = new Set<string>();
  for (const n0 of ngayThu) {
    let n = n0;
    for (let i = 0; i < PFM.GUONG_CUA_SO_TIEN_VE; i++) { cuaSo.add(n); n = ngayKeTiep(n); }
  }
  const trong = so.reduce(
    (s, k) => s + (laChiTieu(k) && cuaSo.has(k.ngay) ? k.soTien : 0), 0);
  return { gt: trong / tongChi, n: ngayThu.length };
}

/* ═══ 6. CHI BÙ SAU NGÀY LỚN ══════════════════════════════════════════════════ */

export interface ChiBu extends ChiSo {
  /** Ngưỡng đã dùng để gọi một ngày là "lớn" — trả ra để người gọi kiểm lại được. */
  nguong: number | null;
  soNgayLon: number;
  /**
   * MỐC NỀN (D354) — `gt` sẽ ra bao nhiêu nếu KHÔNG có chi bù nào: tỷ lệ NGÀY LỊCH trong dải quan
   * sát có mức chi vượt nền. Hôm sau một ngày lớn cũng chỉ là một ngày lịch như mọi ngày khác, nên
   * đây chính là xác suất "vượt nền" của nó khi không có gì đặc biệt xảy ra.
   *
   * ⚠⚠ THIẾU SỐ NÀY THÌ `gt` KHÔNG ĐỌC ĐƯỢC. Trung vị cắt đôi các ngày CÓ chi, nên người ghi đủ
   * mọi ngày có mốc nền ≈ 0,5 — và `gt` = 0,5 của họ nghĩa là "không có gì", trong khi cùng con số
   * ấy ở người chỉ ghi nửa số ngày (mốc nền ≈ 0,25) là gấp đôi mức tình cờ. D353 đo: so `gt` với
   * một ngưỡng cứng 0,5 làm thẻ Oracle báo nhầm ở 37,5% số tháng của người ghi đều nhất.
   * `null` khi chưa đủ NGÀY CÓ CHI để có nền (P7).
   */
  nenNgauNhien: number | null;
}

/**
 * Tỷ lệ **ngày-ngay-sau-một-ngày-chi-lớn** mà mức chi VƯỢT nền.
 *
 * ⚠⚠ VÌ SAO LÀ MỘT TỶ LỆ ĐẾM CHỨ KHÔNG PHẢI TỶ SỐ TRUNG BÌNH: sổ đăng ký khai
 * `hv_chi_bu` là `ty_le` trong **[0,1]** (`config/pfm_dac_trung.ts`), mà "chi hôm sau
 * chia chi nền" vượt 1 dễ như bỡn ⇒ con số sẽ bị `kiemGiaTri` từ chối ở cửa server, và
 * bị từ chối SAU KHI đã tính cả kỳ. Đếm "bao nhiêu lần trong bao nhiêu lần" thì bị chặn
 * trong [0,1] theo cấu trúc, và nó còn kể được thành câu người thường hiểu: *hai trong
 * ba lần, hôm sau một ngày tiêu lớn thì lại tiêu trên mức thường*.
 *
 * ⚠ NGÀY KHÔNG CHI = 0, KHÔNG PHẢI VẮNG MẶT. Hôm sau một ngày tiêu lớn mà không tiêu gì
 * là quan sát ĐẮT NHẤT của chỉ số này (họ đã ghìm lại) — bỏ nó ra khỏi mẫu số là chỉ đếm
 * những lần chi bù và bảo đảm ra tỷ lệ cao. Nên vòng lặp chạy theo LỊCH, không theo danh
 * sách ngày có khoản.
 */
export interface NguongChiLon { nen: number; nguong: number }

/**
 * Nền (trung vị mức chi/ngày) + ngưỡng "lớn" (nền × hệ số) — `null` khi chưa đủ NGÀY
 * CÓ CHI để nói (P7). Tách riêng để `luat.ts` (GĐ6, điều kiện "hôm nay là ngày chi
 * lớn") dùng LẠI đúng công thức này thay vì dựng bản thứ hai (D61) — `chiBu` cũng gọi
 * qua đây, không tính riêng. D426 — xuất ra cho biểu đồ CHI TỪNG NGÀY (`bieu_do.ts`): vạch
 * "mức thường" và dấu ngày lớn trên cột phải là đúng ngưỡng mà chỉ số chi bù đang đếm.
 */
export function tinhNguongChiLon(theoNgay: ReadonlyMap<string, number>): NguongChiLon | null {
  if (theoNgay.size < PFM.GUONG_SAN_NGAY_CHI) return null;
  const nen = trungVi([...theoNgay.values()])!;
  return { nen, nguong: nen * PFM.GUONG_HE_SO_NGAY_LON };
}

export function chiBu(so: readonly Khoan[]): ChiBu {
  const theoNgay = chiTheoNgay(so);
  const ngayCoChi = [...theoNgay.keys()].sort();
  const nguongThat = tinhNguongChiLon(theoNgay);
  if (nguongThat === null) {
    return { ...CHUA_DU(ngayCoChi.length), nguong: null, soNgayLon: 0, nenNgauNhien: null };
  }
  const { nen, nguong } = nguongThat;
  const dau = ngayCoChi[0]!;
  const cuoi = ngayCoChi[ngayCoChi.length - 1]!;

  // Mốc nền: đi theo LỊCH từ ngày đầu tới ngày cuối của dải — cùng luật "ngày không chi = 0" với
  // vòng lặp bên dưới. Chuỗi ngày ISO so sánh được như chữ, và `ngayKeTiep` luôn tăng ⇒ dừng.
  let ngayLich = 0; let ngayVuotNen = 0;
  for (let d = dau; d <= cuoi; d = ngayKeTiep(d)) {
    ngayLich++;
    if ((theoNgay.get(d) ?? 0) > nen) ngayVuotNen++;
  }
  const nenNgauNhien = ngayVuotNen / ngayLich;

  let vuot = 0; let tong = 0; let soNgayLon = 0;
  for (const [ngay, tien] of theoNgay) {
    if (tien < nguong) continue;
    soNgayLon++;
    const sau = ngayKeTiep(ngay);
    // Ngoài dải quan sát ⇒ KHÔNG có quan sát, không phải "chi 0". Đếm nó là bịa ra một
    // ngày ghìm-lại chưa từng được ghi.
    if (sau < dau || sau > cuoi) continue;
    tong++;
    if ((theoNgay.get(sau) ?? 0) > nen) vuot++;
  }
  if (tong < PFM.GUONG_SAN_QUAN_SAT) {
    return { ...CHUA_DU(tong), nguong, soNgayLon, nenNgauNhien };
  }
  return { gt: vuot / tong, n: tong, nguong, soNgayLon, nenNgauNhien };
}

export interface KetQuaNgayChiLon {
  /** `null` = chưa đủ NGÀY CÓ CHI để nói (P7) — không phải "không phải ngày lớn". */
  laNgayLon: boolean | null;
  nguong: number | null;
}

/**
 * MỘT NGÀY CỤ THỂ có phải "ngày chi lớn" không — đúng ngưỡng `chiBu` dùng (nền × hệ
 * số), nhưng trả lời cho MỘT ngày thay vì gộp cả kỳ thành một tỷ lệ.
 *
 * Sinh ra cho `luat.ts` (GĐ6): điều kiện "nếu hôm nay là ngày tệ thì..." (bậc 3 thang
 * can thiệp) cần đúng câu hỏi này, và dùng lại công thức `tinhNguongChiLon` thay vì
 * định nghĩa "ngày lớn" một lần nữa ở một file khác — hai định nghĩa sẽ trôi (D61),
 * biểu hiện là gương nói "hôm nay không lớn" trong khi luật vừa bắn vì nghĩ nó lớn.
 */
export function ngayChiLon(so: readonly Khoan[], ngay: string): KetQuaNgayChiLon {
  const theoNgay = chiTheoNgay(so);
  const nguongThat = tinhNguongChiLon(theoNgay);
  if (nguongThat === null) return { laNgayLon: null, nguong: null };
  return {
    laNgayLon: (theoNgay.get(ngay) ?? 0) >= nguongThat.nguong,
    nguong: nguongThat.nguong,
  };
}

/* ═══ 7. SO VỚI CHÍNH MÌNH — E3 ═══════════════════════════════════════════════ */

/**
 * ⭐ TRỤC SO SÁNH HỢP LỆ DUY NHẤT (P12 🔒 cấm so tiền giữa người). Đổi tương đối giữa
 * kỳ này và một MỐC của chính user: kỳ trước, trung bình các kỳ trước, hoặc mức user tự
 * đặt.
 *
 * ⚠ `moc === 0` ⇒ `null`. "Kỳ trước không chi đồng nào" thì phần trăm thay đổi là phép
 * chia cho 0 — trả `Infinity` hay `1` đều là bịa.
 * ⚠ Kẹp về [−1, 1] cho khớp miền sổ đăng ký (`am: true`): chạm `1` nghĩa là **chi tăng
 * từ gấp đôi trở lên**, và người gọi biết điều đó nhờ `chamSan`.
 */
export interface SoSanh extends ChiSo {
  chamSan: boolean;
}

export function soVoiMoc(nay: number, moc: number): SoSanh {
  if (moc === 0) return { ...CHUA_DU(0), chamSan: false };
  const raw = (nay - moc) / moc;
  return { gt: kep(raw, -1, 1), n: 1, chamSan: raw < -1 || raw > 1 };
}

/* ═══ 8. GOM MỘT KỲ ═══════════════════════════════════════════════════════════ */

export interface GuongKy {
  tiet_kiem_rong: TietKiem;
  vi_sale: ChiSo;
  cach_ghi: PhanBoCachGhi;
  tien_ve_tieu: ChiSo;
  chi_bu: ChiBu;
}

/**
 * ⚠ MỘT CỬA cho cả kỳ — để `dac_trung/` chỉ việc ĐÓNG GÓI đúng các số này chứ không tính
 * lại. Hai nơi cùng tính một công thức là bản sao sẽ trôi (D61), và ở đây cú trôi biểu
 * hiện là *"màn hình gương nói 42%, hồ sơ cohort nói 38%"* cho cùng một tháng — không ai
 * biết bên nào đúng.
 */
export function guongKy(so: readonly Khoan[]): GuongKy {
  return {
    tiet_kiem_rong: tietKiemRong(so),
    vi_sale: viSale(so),
    cach_ghi: cachGhi(so),
    tien_ve_tieu: tienVeTieu(so),
    chi_bu: chiBu(so),
  };
}
