/**
 * KHỚP LỆNH TRONG MÀN — hàm THUẦN (D475, bước 4 #1: Bắt Đáy). Test vector chép tay: `tests/minigame_khop.test.ts` (viết trước, A8.3).
 *
 * CHÉP từ demo đã chốt `docs/ui-ux/demo/minigame-bat-day.html`: `moVT` · `dongVT` · `chotMini` · `tongLoi` · `nhanHanhVi` (nhánh Bắt Đáy).
 * Chỉ nói bằng SỐ NHỊP (0…479), không đọc đồng hồ, không đụng DB ⇒ replay ra y nguyên từ (bối cảnh màn, danh sách cú bấm).
 *
 * D479 (founder 04/10, demo bản 27): KHOẢN CHẠY THEO ĐƯỜNG GIÁ. Engine đã cộng % thị trường lúc chốt vòng (= GIỮ SUỐT, `giu`); màn chỉ cộng
 * PHẦN CHÊNH `loi = theoLenh − giu`. Không bấm ⇒ theoLenh = giu ⇒ 0. Tiền chưa vào đứng yên (không ăn đoạn trước lúc vào). Hệ số lõi 1.
 *
 * Phạm vi bước 4 #1, cố ý hẹp (A11.22): KHÔNG trait trong màn (#8), KHÔNG tin (#2), KHÔNG tự đẩy giá / lộ lệnh / map chung (#7), KHÔNG phí.
 * Lõi chưa có bảng nút trong `NUT_LOI` ⇒ màn chỉ để xem: lãi lỗ 0, không "tự động".
 *
 * Đơn vị thời gian của NHÃN là nến XEM của khung thường (nến gộp đôi, 16 nhịp — demo `viTri().s` với `G.k = 1`).
 */
import { BAN_BOT_LAN, BOT_BAT_DAY_BA_PHAN, NUT_LOI_BA_PHAN, TI_LE_PHAN, KE_LENH, NUT_KE, PHI_TIN_SOM_BP, TRUOT_LS, MUA_DUOI, TO_CHUC_V57, TU_DAY, HE_SO_LOI, K_MIN, KY_QUY, LAI_VAY_PCT, MA_MINIGAME, MUC_DON_BAY, NAP_TY_LE, NEN_LS, NHIP_MOI_NEN, NHIP_MOI_NEN_GOP, NUT_GAI, NUT_LOI, PHI_BAN_BP, PHI_GAI_BP, SO_NHIP, BOT_BAT_DAY, TIEN_TO_CHON_LA, TL_DAY, TRAIT_MAN, TRUOT_KHOA_CUOI } from '../../../config/minigame.js';
import { DONG_HO_MINIGAME } from '../../../config/holdem.js';
import { TAM_LY_YEU } from '../../../config/trait.js';
import type { NacThanhKhoan } from '../../../config/thanh_khoan_nam_nac.js';
import { heSoThanhKhoan, thacTaiNhip, type NenMin } from './dong_gia.js';
import { tinDayDu, type TinMan } from './tin.js';
import { floorTien, kBanManh, laiVayGop, laiVayTho, laiVi, laLoiKyQuy, LOI_BAN_KHONG, phiKhopLs, tranLo } from './tien.js';

/** Một cú bấm như ghi ở `holdem_minigame_man.lenh` (chỉ những trường khớp cần). */
export interface LenhMan {
  seq: number; nhip: number; nut: string; nguon?: string;
  /** D528 — KÊ LỆNH (`ke_mua` / `ke_ban`): giá lệnh so với GIÁ MỞ MÀN, bp nguyên (−500 = −5 %) · đòn bẩy của lệnh MỞ ký quỹ (2 · 4 · 10). */
  gia_bp?: number; L?: number;
  /** D561 — khoá v65 (`nhieuMa`): mã của màn con lệnh này đánh. Vắng = mã chính (`BoiCanhMan.ma`) — mọi lệnh cũ. */
  ma?: string;
}
/** D528 — một lệnh kê (mỗi chiều một lệnh): giá · đòn bẩy (lệnh mở ký quỹ) · nhịp đặt · số lần dời · khớp ở nhịp nào · vai trò lúc khớp · lý do huỷ. */
export interface LenhKe { gia: number; L: number; dat: number; sua: number; khop: number | null; vt: 'mo' | 'chot' | 'ban_giu' | null; huy: string | null }

export interface PhanVao {
  tien: number; con: number; khop: number; nhip: number; s: number; bung: boolean; loai: 'nua' | 'het' | 'tu_dong' | 'tang' | 'vao' | 'nhoi' | 'ke' | 'short' | 'dao' | 'vay';
  /** D589 — Mua Đuổi ×2: phần VAY (bằng vốn màn) — chịu lãi vay theo thời gian giữ, đóng TRƯỚC, tính vào ngưỡng thanh lý. */
  vay?: true;
  /** D531 — Lướt Sóng: chiều của chân (+1 long · −1 short). Vắng = +1 (mọi lõi khác). */
  chieu?: 1 | -1;
  /** D511 — Mua Đuổi: số nến xem xanh liền nhau lúc vào (trượt ×(1 + 0,25 × chuoi); nhãn ĐUỔI MUỘN). */
  chuoi?: number;
  /** D492 — lõi Đòn Bẩy: hệ số của PHẦN này (VÀO ×L ⇒ L · TĂNG ×K ⇒ K − L) · phần TĂNG vay trọn `he` (không trừ 1). */
  he?: number; them?: true;
}
export interface LanRa {
  tien: number; ra: number; nhip: number; lai: number; tbVao: number; tuDongCuoi?: true; cuoiKhoa?: boolean; /** D486 — NÓNG VỘI tự chốt ở giây 17. */ nongVoi?: true;
  /** D492 — Đòn Bẩy: sàn THANH LÝ (bán cưỡng bức) · BÁN HẾT khi bị gọi (thanh lý thật, demo `banHet`). D499 — Tổ Chức chạm TRẦN THUA. */
  lyDo?: 'thanh_ly' | 'ban_het' | 'tran_thua' | 'ke_lenh' | 'tam_ly_yeu' | 'ban_bot';   // D561 — BÁN BỚT khoản giữ
  /** D528 — lần ra này bán phần KHOẢN GIỮ SUỐT (không phải vị thế mở trong màn): kê bán khoản · Tâm lý yếu · trần thua khi chưa bấm · phần còn lại cuối màn. */
  giu?: true;
  /** D561 — khoá `khoanTheoDuong`: lần CHUYỂN KHOẢN sang vị thế ở cú bấm đầu (Đòn Bẩy · Bán Khống · Lướt Sóng): `lai` = phần khoản đã trôi từ giá mở tới lúc ấy. */
  chuyen?: true;
  /** D531 — Lướt Sóng: chiều của chân vừa đóng. Vắng = +1. */
  chieu?: 1 | -1;
}
/** D499 — một cú TỰ ĐẨY GIÁ của chính lệnh: ở nhịp `nhip`, độ đẩy `mag` (tỷ lệ, dấu = chiều giao dịch), trải `trai` nhịp (Rải lệnh; 0 = tức thì). */
export interface XungBan { nhip: number; mag: number; trai: number }

/** D499 — độ lệch giá ở nhịp k do các cú tự đẩy (demo `lechLuc` nhánh không-tạm): O_LAI ở lại, phần còn lại tan trong TAN_NHIP nhịp. */
export function lechBan(xung: readonly XungBan[], k: number): number {
  let off = 0;
  for (const x of xung) {
    if (k <= x.nhip) continue;
    const r = x.trai > 0 ? Math.min(1, (k - x.nhip) / x.trai) : 1;
    const tan = Math.max(0, 1 - Math.max(0, k - x.nhip - x.trai) / TU_DAY.TAN_NHIP);
    off += x.mag * r * (TU_DAY.O_LAI + (1 - TU_DAY.O_LAI) * tan);
  }
  return off;
}

/**
 * D499 — đường giá NGƯỜI CHƠI THẤY = đường gốc của màn + các cú tự đẩy của chính lệnh (dòng nhịp áp hàm này; khớp lệnh đọc giá qua `lechBan` — cùng
 * một công thức). Không cú nào ⇒ trả NGUYÊN mảng (màn của người không đẩy giá byte-hệt).
 */
/**
 * D521 (founder 05/10 chọn 2: "mua giữa cơn bán tháo bị trượt giá nặng") — hệ số giá khớp của lệnh VÀO chiều `ch` ở nhịp k: vào NGƯỢC dòng cưỡng bức
 * (mua khi bán tháo đang đè · bán khống khi mua cưỡng bức đang đẩy) trượt thêm `TRUOT_THAC` × độ sâu cú thác đang đè (`NenMin.thac`, chỉ màn `thac_v2`).
 * Thuận dòng hay không có cú ⇒ 1.
 */
export function truotThac(min: readonly NenMin[], k: number, ch: 1 | -1): number {
  const t = thacTaiNhip(min, k), nguoc = -ch * t;
  return nguoc > 0 ? 1 + ch * TL_DAY.TRUOT_THAC * nguoc : 1;
}
export function apXungBan(min: readonly NenMin[], xung: readonly XungBan[]): NenMin[] {
  if (!xung.length) return min as NenMin[];
  const n0 = NEN_LS * K_MIN;
  return min.map((c, i) => {
    if (i < n0) return c;
    const j = i - n0, tick = c.tick.map((x, t) => x * (1 + lechBan(xung, j * NHIP_MOI_NEN + t)));
    const o = c.o * (1 + lechBan(xung, j * NHIP_MOI_NEN - 1)), cc = tick[tick.length - 1]!;
    return { ...c, o, c: cc, tick, h: Math.max(o, ...tick, c.h * (1 + lechBan(xung, j * NHIP_MOI_NEN + 3))), l: Math.min(o, ...tick, c.l * (1 + lechBan(xung, j * NHIP_MOI_NEN + 3))) };
  });
}
/** D507 — áp cú đẩy lên ĐƯỜNG BẢNG PHỤ (`duongPhuCua`: chỉ số 0 = mở màn, k + 1 = nhịp k) — cùng `lechBan` với đường chính. Không cú ⇒ nguyên mảng. */
export function apXungMang(gia: readonly number[], xung: readonly XungBan[]): number[] {
  if (!xung.length) return gia as number[];
  return gia.map((v, i) => (i === 0 ? v : v * (1 + lechBan(xung, i - 1))));
}
/** D492 — một cú NẠP THÊM (demo `G.napDs`): lấy `lay` từ khoản `ma`, phí bán `phi`, ký quỹ nhận `nhan`. */
export interface NapMan { ma: string; lay: number; phi: number; nhan: number; nhip: number; luc: 'goi' | 'chu_dong' | 'ban_het' }
/** D507 — khoản nguồn TIỀN MẶT của lõi Đòn Bẩy (`BoiCanhMan.nap_tu.tien`): nạp không phí, không giá biểu đồ, không tự đẩy; quyết toán trừ tiền mặt. */
export const MA_TIEN_MAT = 'tien';
/** D492 — phần riêng của lõi Đòn Bẩy trong kết quả màn. */
export interface KetQuaDonBay {
  /** Mức đang cầm (sau các cú TĂNG) · mức chọn lúc VÀO. 0 = chưa vào. */
  L: number; L0: number;
  nap: NapMan[]; napNhan: number;
  /** D510 — chiều của lõi ký quỹ: 1 Đòn Bẩy (vay mua) · −1 Bán Khống (vay bán — ngưỡng gọi/mua cưỡng bức nằm TRÊN giá, client so ≥). */
  chieu: 1 | -1;
  tang: { nhip: number; tu: number; len: number; khiLoi: boolean }[];
  /** Bị sàn thanh lý ở nhịp nào, giá nào. (`banHet` chỉ còn ở dữ liệu trước D507 — BÁN HẾT nay dồn ký quỹ, không đóng vị thế.) */
  thanhLy: { nhip: number; gia: number; banHet?: true } | null;
  /** D507 — BÁN HẾT: nhịp đã dồn mọi khoản nguồn vào ký quỹ. null = chưa bấm. */
  banHet: number | null;
  /** D507 — cú BÁN của vai lớn trên mã các khoản bị BÁN HẾT (đè lên bảng phụ + màn của ghế khác cùng mã). Rỗng khi không có hệ số đẩy. */
  xungKhoan: Record<string, XungBan[]>;
  daGoi: boolean; catKhiGoi: boolean; rutChan: boolean;
  /**
   * Sổ giữa màn (`denNhip`): NGƯỠNG GIÁ gọi / thanh lý từ nhịp `tu` tới hết màn với vị thế đang cầm — đúng điều kiện server dùng (giá ≤ ngưỡng).
   * Client chỉ SO GIÁ để bật cuộc gọi / lóe đỏ, không tính tiền (C4). null = không cầm / kết quả đủ màn.
   */
  nguong: { tu: number; goi: number[]; thanhLy: number[] } | null;
}
export interface KetQuaMan {
  la: string | null;
  /** D479 — lãi lỗ màn cộng vào khoản = `theoLenh − giu` (chip, nguyên). D521 — màn có vết thác: `theoLenh − (giu − vet)`. */
  loi: number;
  /** D521 — phần của `giu` do VẾT thác để lại (chip; âm = bán tháo kéo khoản xuống). Người giữ suốt có `loi = vet`. Vắng = không vết. */
  vet?: number;
  /** D479 — kết quả THEO LỆNH trên vốn màn (đã trần lỗ = cả vốn). Không bấm ⇒ = `giu`. */
  theoLenh: number;
  /** D479 — GIỮ SUỐT màn = floor(vốn × (giá cuối / giá đầu − 1)) — phần engine đã cộng lúc chốt vòng. */
  giu: number;
  chamTran: boolean;
  /** Không có phần vào nào ⇒ GIỮ suốt màn (D479; trước đó: app vào hộ ở đỉnh). */
  tuDong: boolean;
  vao: PhanVao[];
  ra: LanRa[];
  /** Cú bấm rơi đúng nến trắng phía cần ⇒ không khớp. `ben` = phía bị trắng (mua: không ai mua ⇒ bán hụt). */
  hut: { nhip: number; ben: 'mua' | 'ban' }[];
  /** Giá mở màn (đóng nến lịch sử cuối) · đáy / đỉnh và nến gộp của chúng · giá đóng cuối. */
  giaDau: number; day: number; dinh: number; iDay: number; iDinh: number; giaCuoi: number;
  /** Nhãn hành vi (id — chữ ở client, D26). */
  nhan: string[];
  /** D589 — khoá v70: số cú CHỐT kể từ lần VÀO cuối (0 ⇒ cú kế bán NỬA · 1 ⇒ bán HẾT) — API dựng tiền nút CHỐT từ đây. Vắng = khoá cũ. */
  chotLan?: number;
  /** D483 — phí gài tin giả (TUNG TIN) đã trừ trong `loi`. 0 = không gài. */
  phiGai: number;
  /** D492 — lõi Đòn Bẩy · D510 Bán Khống (`db.chieu` −1). `loi` đã GỒM phần nạp nhận (khoản mã chính nhận lại ký quỹ); các khoản nạp bị trừ `nap[].lay` (quyết toán `apMg`). */
  db?: KetQuaDonBay;
  /** D499 — các cú tự đẩy giá của chính lệnh (dòng nhịp áp bằng `apXungBan`). Rỗng khi ghế không đẩy giá. */
  xungBan: XungBan[];
  /** D499 — Tổ Chức chạm TRẦN THUA: nhịp + giá trần đã tự chốt. */
  tranThua?: { nhip: number; gia: number };
  /** D499 — sổ giữa màn của Tổ Chức đang cầm: GIÁ TRẦN (giá ≤ ⇒ tự chốt) — client so giá để bật búa, không tính tiền (C4). */
  giaTran?: number;
  /**
   * D504 — sổ giữa màn (`denNhip`) đang cầm: lãi lỗ màn TẠM TÍNH nếu bán hết ở giá nhịp k (≥ `denNhip`) — đã chốt + phần đang cầm theo giá trừ trượt
   * (Đòn Bẩy: trừ lãi vay tới k), trần lỗ, trừ phí gài. Server gọi cho từng nhịp ĐÃ LỘ và gửi kèm dòng nhịp — client chỉ in (C4), không lộ giá tương lai.
   * Không xét sự kiện tự động sau `denNhip` (thanh lý · trần thua · Nóng Vội): khi đó client đã đổi dòng tạm tính sang nhãn trạng thái.
   */
  tamTinh?: (k: number) => number;
  /** D528 — lệnh kê của ghế (trait KÊ MUA / KÊ BÁN). Vắng = ghế không có trait. */
  ke?: { mua?: LenhKe; ban?: LenhKe };
  /** D528 — TÂM LÝ YẾU đã bán tháo ở nhịp này. */
  tly?: { nhip: number };
  /** D528 — khoản GIỮ SUỐT đã bị bán một phần / hết (kê bán khoản · Tâm lý yếu · trần thua khi chưa bấm): vốn khoản · phần còn giữ. */
  khoanGiu?: { tien: number; con: number };
  /** D531 — Lướt Sóng: chiều đang cầm (0 = không cầm) · số lần ĐẢO · tổng phí giao dịch (đã trừ trong `theoLenh`). */
  ls?: { chieu: 1 | -1 | 0; soDao: number; phi: number };
  /** D532 — phí MUA TIN SỚM đã trừ trong `loi` (như `phiGai`). Vắng = không mua. */
  phiTin?: number;
}

/** Nến gộp đôi của khung thường (demo `gopHaiNen`, phần khớp cần: o · c · h · l · trắng). */
interface NenGop { o: number; c: number; h: number; l: number; trang: boolean; trangBan: boolean }
function gop(chay: readonly NenMin[]): NenGop[] {
  const ra: NenGop[] = [];
  for (let i = 0; i + 1 < chay.length; i += K_MIN) {
    const a = chay[i]!, b = chay[i + 1]!;
    ra.push({ o: a.o, c: b.c, h: Math.max(a.h, b.h), l: Math.min(a.l, b.l), trang: !!(a.trang || b.trang), trangBan: !!(a.trangBan || b.trangBan) });
  }
  return ra;
}

const chayCua = (min: readonly NenMin[]) => min.slice(NEN_LS * K_MIN);
const giaTai = (chay: readonly NenMin[], k: number) => chay[Math.floor(k / NHIP_MOI_NEN)]!.tick[k % NHIP_MOI_NEN]!;
/** Vị trí theo nến xem lúc nhịp k vừa lộ (demo `viTri().s`). */
const sCua = (k: number) => (k + 1) / NHIP_MOI_NEN_GOP;

/** Nến gộp `j` đang chạy tới nhịp `k` (demo `nenTT` của nến đang dở). */
function nenDo(chay: readonly NenMin[], ng: readonly NenGop[], j: number, k: number): { o: number; c: number } {
  return { o: ng[j]!.o, c: giaTai(chay, k) };
}
/** Số nến xanh liền nhau tính lùi từ nến đang chạy (demo `chuoiXanh`). */
function chuoiXanh(chay: readonly NenMin[], ng: readonly NenGop[], k: number): number {
  const j = Math.floor(k / NHIP_MOI_NEN_GOP), cur = nenDo(chay, ng, j, k);
  if (!(cur.c > cur.o)) return 0;
  let n = 1;
  for (let i = j - 1; i >= 0; i--) { if (ng[i]!.c > ng[i]!.o) n++; else break; }
  return n;
}
/** Đang đuổi nến xanh dồn (demo `dangBung`): ≥ 3 nến xanh liền và giá trên trung bình giá đóng các nến trước. */
function dangBung(chay: readonly NenMin[], ng: readonly NenGop[], k: number): boolean {
  const j = Math.floor(k / NHIP_MOI_NEN_GOP);
  if (j < 2) return false;
  let tb = 0;
  for (let i = 0; i < j; i++) tb += ng[i]!.c;
  return chuoiXanh(chay, ng, k) >= 3 && giaTai(chay, k) > tb / j;
}

/** Lá của màn: lần chọn CUỐI (`la_<id>`) trong số lõi đang cầm; không chọn ⇒ Bắt Đáy nếu cầm, không thì lõi đầu; không cầm ⇒ null. */
export function laCuaMan(loiDangCam: readonly string[], lenh: readonly LenhMan[], loiMan?: string): string | null {
  // D561 — khoá v65: lõi đã CHỌN LÚC CHỐT VÒNG (trước khi lá lật) — thắng mọi cú chọn lá trong màn.
  if (loiMan && loiDangCam.includes(loiMan)) return loiMan;
  const chon = [...lenh].sort((a, b) => a.seq - b.seq)
    .filter((x) => x.nut.startsWith(TIEN_TO_CHON_LA) && loiDangCam.includes(x.nut.slice(TIEN_TO_CHON_LA.length)));
  if (chon.length) return chon[chon.length - 1]!.nut.slice(TIEN_TO_CHON_LA.length);
  if (loiDangCam.includes('bat_day')) return 'bat_day';
  return loiDangCam[0] ?? null;
}

/**
 * D486 — CỬA SỔ BẤM của ghế theo trait trong màn, theo NHỊP (một nguồn cho khớp · cửa lệnh · bot · client): [tu, den). KIÊN NHẪN ⇒ tu = nhịp
 * của giây `KIEN_NHAN_KHOA_S` (làm tròn LÊN — chưa đủ 10 s thì còn khoá); NÓNG VỘI ⇒ den = nhịp của giây `NONG_VOI_HAN_S` (tới đó tự chốt).
 */
export function cuaSoTrait(t: { kienNhan?: boolean; nongVoi?: boolean }): { tu: number; den: number } {
  const nhipMoiGiay = SO_NHIP / DONG_HO_MINIGAME.CHAY_S;
  return {
    tu: t.kienNhan ? Math.ceil(TRAIT_MAN.KIEN_NHAN_KHOA_S * nhipMoiGiay) : 0,
    den: t.nongVoi ? Math.min(SO_NHIP, Math.floor(TRAIT_MAN.NONG_VOI_HAN_S * nhipMoiGiay)) : SO_NHIP,
  };
}

/** D483 — chiều tin giả đã gài (TUNG TIN): cú `gai_*` ĐẦU TIÊN trước màn chạy (nhịp −1); 0 = không gài. */
export function gaiCuaMan(lenh: readonly LenhMan[]): 1 | -1 | 0 {
  const l = [...lenh].sort((a, b) => a.seq - b.seq).find((x) => x.nhip < 0 && x.nut in NUT_GAI);
  return l ? NUT_GAI[l.nut as keyof typeof NUT_GAI] : 0;
}

export function ketQuaMan(p: {
  min: readonly NenMin[]; von: number; ma: string; nac?: NacThanhKhoan; la: string | null; lenh: readonly LenhMan[];
  /** D482 — đòn bẩy của ghế trong màn (`BoiCanhMan.he`, trait ghim ĐÒN BẨY). Vắng = `HE_SO_LOI`. "Giữ suốt" luôn ×1. */
  he?: number;
  /** D483 — ghế mang trait TUNG TIN (`BoiCanhMan.tung_tin`): cú gài trong `lenh` mới tính phí. `min` phải dựng CÙNG `lenh` (`dungDongMan`). */
  tungTin?: boolean;
  /** D486 — KIÊN NHẪN: lệnh trước giây 10 bị bỏ, trượt × 0,5. */
  kienNhan?: boolean;
  /** D486 — NÓNG VỘI: lệnh từ giây 17 bị bỏ, đang cầm thì tự chốt ở đó; "trắng" xét theo nến mịn (khung nhanh). */
  nongVoi?: boolean;
  /** D492 — Đòn Bẩy: lãi vay % theo thị trường của màn (`mucLaiVay`). Vắng = ẢM ĐẠM. */
  laiVayPct?: number;
  /** D492 — Đòn Bẩy: giá trị các khoản KHÁC lúc mở màn (nguồn NẠP THÊM, `BoiCanhMan.nap_tu`). D507: có thể gồm `tien` (Tiền mặt). */
  napTu?: Readonly<Record<string, number>>;
  /**
   * D507 — BÁN HẾT khớp ở GIÁ BIỂU ĐỒ của từng khoản: tỷ lệ giá trị ở nhịp k so với khoản (khoản đã gồm % cả vòng) = giá bảng phụ nhịp k / giá cuối
   * màn của nó. Vắng / null ⇒ 1. Thuần, server dựng từ `duongPhuCua` (`thamSoKhop`).
   */
  giaKhoan?: (ma: string, k: number) => number | null;
  /** D507 — hệ số VAI của tự đẩy (`TU_DAY.VAI`) — cú bán trên mã KHÁC tính lại theo thanh khoản của mã đó. Vắng = không đẩy. */
  tuDayVai?: number;
  /** D492 — SỔ GIỮA MÀN: chỉ chạy tới nhịp này (không tự chốt, không lộ cú thanh lý tương lai) + trả ngưỡng. Vắng = cả màn. */
  denNhip?: number;
  /** D499 — hệ số TỰ ĐẨY GIÁ của ghế (`BoiCanhMan.tu_day`): mỗi lệnh khớp đẩy giá theo chiều của nó. Vắng/0 = không đẩy (Cá nhân). */
  tuDay?: number;
  /** D499 — RẢI LỆNH: cú đẩy trải ra n nến gộp, khớp trung bình (n + 1)/(2n) cú đẩy. Vắng = tức thì. */
  rai?: number;
  /** D499 — TỔ CHỨC: khớp thỏa thuận trong nến trắng (trượt ×`TRUOT_THOA_THUAN`) + trần thua (`TRAN_THUA_BP` vốn màn, tự chốt đúng giá trần). */
  toChuc?: boolean;
  /** D528 — trait KÊ MUA / KÊ BÁN của ghế (`BoiCanhMan.ke`). Vắng = không nhận lệnh kê. */
  ke?: { mua?: true; ban?: true };
  /** D561 — Bán Khống chỉ ×2 (`BoiCanhMan.bk_x2`). */
  bk_x2?: true;
  /** D561 — Bắt Đáy / Mua Đuổi có nút BÁN BỚT (`BoiCanhMan.ban_bot`). */
  banBot?: boolean;
  /** D586 — khoá v69: BÁN BỚT bán được hết qua số lần theo cấp Rải lệnh (`luongBanBot`) · màn không lõi cũng có BÁN BỚT (`BoiCanhMan.ban_bot_rai`). */
  banBotRai?: boolean;
  /** D589 — khoá v70: VÀO 3 phần (`TI_LE_PHAN`) · Mua Đuổi có ×2 (vay bằng vốn màn) + CHỐT gộp (nửa rồi hết) · Bắt Đáy gom 3 phần (`BoiCanhMan.ba_phan`). */
  baPhan?: boolean;
  /**
   * D561 — khoá v65 (`khoanTheoDuong`, founder 08/10): khoản CHẠY THEO GIÁ tới cú bấm đầu. Đòn Bẩy / Bán Khống / Lướt Sóng: khoản đổi sang vị thế ở giá lúc
   * bấm (phần đã trôi ghi một lần `chuyen`); Bắt Đáy / Mua Đuổi: VÀO chỉ bằng tiền vừa BÁN BỚT / bán khoản. Khoá cũ: khoản như tiền mặt ở giá mở (lỗ vào muộn).
   */
  khoanTheoDuong?: boolean;
  /** D528 — TÂM LÝ YẾU: lãi lỗ màn chạm −`TAM_LY_YEU.NGUONG_BP` vốn màn ⇒ bán tháo `BAN_BP` phần đang cầm (kể cả khoản giữ suốt), một lần. */
  tamLyYeu?: boolean;
  /** D528 — Tổ Chức: TRẦN THUA áp cả khoản GIỮ SUỐT (chưa bấm gì vẫn bị chốt ở giá trần). */
  tranThuaGiu?: boolean;
  /** D531 — khoá `loiChiTrongMan`: lõi Lướt Sóng có nút (SHORT / ĐẢO / CHỐT). Vắng ⇒ Lướt Sóng chỉ xem như khoá cũ. */
  luotSong?: boolean;
  /** D532 — ghế mang MÙ TIN (không mua tin sớm được). */
  muTin?: boolean;
  /** D532 — dòng tin của màn (`BoiCanhMan.tin` + hình + seed) cho nhãn hành vi tin của Lướt Sóng. Vắng = màn không có tin. */
  tinMan?: { tin?: readonly TinMan[]; hinh: string; seed: number; /** D536 — vai lớn cùng mã (tin của bot Đội Lái). */ lon?: readonly string[] };
}): KetQuaMan {
  // D483 — phí gài tin trừ vào lãi lỗ màn ở MỌI nhánh (demo `tongLoi`: kể cả không bấm / không cầm lõi).
  const phiGai = p.tungTin && gaiCuaMan(p.lenh) !== 0 ? floorTien((p.von * PHI_GAI_BP) / 10000) : 0;
  // D532 — Lướt Sóng MUA TIN SỚM (cú `mua_tin` trước màn): phí trừ ở MỌI nhánh (demo `tongLoi`: − G.phiTin), kể cả không bấm gì trong màn.
  const muaTin = daMuaTin(p);
  const phiTin = muaTin ? floorTien((p.von * PHI_TIN_SOM_BP) / 10000) : 0;
  const phi = phiGai + phiTin;
  const tru = (k: KetQuaMan): KetQuaMan => (phi ? { ...k, loi: k.loi - phi, phiGai, ...(phiTin ? { phiTin } : {}), ...(k.tamTinh ? { tamTinh: (n: number) => k.tamTinh!(n) - phi } : {}) } : k);
  const chay = chayCua(p.min), ng = gop(chay), m = MA_MINIGAME[p.ma]!;
  const truot = m.truot * heSoThanhKhoan(p.ma, p.nac) * (p.kienNhan ? TRAIT_MAN.KIEN_NHAN_TRUOT : 1), he = p.he ?? HE_SO_LOI;
  const cua = cuaSoTrait(p);
  const giaDau = p.min[NEN_LS * K_MIN - 1]!.c;
  const day = Math.min(...ng.map((c) => c.l)), dinh = Math.max(...ng.map((c) => c.h));
  const iDay = ng.findIndex((c) => c.l === day), iDinh = ng.findIndex((c) => c.h === dinh);
  const giaCuoi = ng[ng.length - 1]!.c;
  const giu = floorTien(p.von * (giaCuoi / giaDau - 1));
  /*
   * D521 — MỐC GIỮ của lãi lỗ màn: giữ theo đường TRỪ phần VẾT thác ở cuối màn (`NenMin.thac` tick cuối = Σ vết, chỉ màn `thac_v2`) — tức đúng phần
   * engine đã ra. Cú thanh lý để lại vết ⇒ người giữ suốt chịu đúng phần vết (founder chọn 1: "% của vòng gánh cú thác"); không vết ⇒ mốc = `giu`.
   */
  const vetCuoi = thacTaiNhip(p.min, SO_NHIP - 1);
  const giuMoc = vetCuoi ? floorTien(p.von * (giaCuoi / (1 + vetCuoi) / giaDau - 1)) : giu;
  const rong: KetQuaMan = { la: p.la, loi: giu - giuMoc, ...(giu !== giuMoc ? { vet: giu - giuMoc } : {}), theoLenh: giu, giu, chamTran: false, tuDong: false, vao: [], ra: [], hut: [], giaDau, day, dinh, iDay, iDinh, giaCuoi, nhan: [], phiGai: 0, xungBan: [] };
  const nutLa = nutLoiCua(p.la, p.luotSong, p.banBot, p.banBotRai, p.baPhan);
  // D528 — không cầm lõi (hay lõi chưa có nút) vẫn có thể có lệnh kê / Tâm lý yếu / trần thua khoản giữ ⇒ chạy nhánh thường với bảng nút rỗng.
  const coV59 = !!(p.ke?.mua || p.ke?.ban || p.tamLyYeu || (p.tranThuaGiu && p.toChuc));
  if (!nutLa && !coV59) return tru(rong);   // lõi chưa có trong màn / không cầm lõi ⇒ chỉ xem = giữ
  const nut = nutLa ?? [];
  const keS = taoKe(p, giaDau);
  // D499 — giá có cộng cú TỰ ĐẨY của chính lệnh (cú ở nhịp k chỉ chạm nhịp sau k) + hàm đẩy dùng chung hai nhánh.
  const xung: XungBan[] = [];
  const gia = (k: number) => giaTai(chay, k) * (1 + lechBan(xung, k));
  const dayLenh = (k: number, chieu: 1 | -1, danhNghia: number): number => {
    if (!p.tuDay || danhNghia <= 0) return 0;
    // D506 — quy mô TUYỆT ĐỐI, căn bậc hai (vốn to đẩy thêm, ×10 đẩy √10 chứ không ×10) · Rải lệnh n nến chia thêm √n (founder: "tăng sức mạnh trait rải lệnh").
    const n = p.rai ?? 0, mag = (chieu * p.tuDay * Math.sqrt(danhNghia / TU_DAY.VON_CHUAN)) / (n ? Math.sqrt(n) : 1);
    xung.push({ nhip: k, mag, trai: n * NHIP_MOI_NEN_GOP });
    return Math.abs(mag) * (n ? (n + 1) / (2 * n) : 1);   // demo `tuDay`: khớp ở giá sau cú đẩy (Rải lệnh: khớp dần)
  };
  if (laLoiKyQuy(p.la)) return tru(khopDonBay(p, { chay, ng, rong, truot, cua, nut, gia, dayLenh, xung }));   // D510 — Đòn Bẩy · Bán Khống (chiều bán)
  // D531 — Lướt Sóng: có cú bấm của lõi (hoặc lệnh kê bán — mở short từ thế không cầm) ⇒ nhánh riêng. Không bấm ⇒ nhánh thường (giữ suốt + luật v59).
  if (p.la === 'luot_song' && nutLa?.length && (p.lenh.some((l) => nutLa.includes(l.nut)) || p.ke?.ban)) {
    const kq = khopLuotSong(p, { chay, rong, truot, cua, gia, dayLenh, xung, keS, giuMoc });
    // D532 — nhãn hành vi TIN của Lướt Sóng (demo `nhanHanhVi` nhánh luot_song), chỉ ở quyết toán (không ở sổ giữa màn).
    if (p.denNhip === undefined && !kq.tuDong && p.tinMan?.tin) {
      const tin = tinDayDu(p.tinMan, p.min, p.tungTin ? gaiCuaMan(p.lenh) : 0);
      kq.nhan = [...nhanTinLuotSong(kq, tin, muaTin), ...kq.nhan.filter((x) => x !== 'khong_ro')];
      if (!kq.nhan.length) kq.nhan = ['khong_ro'];
    }
    return tru(kq);
  }

  const vao: PhanVao[] = [], ra: LanRa[] = [], hut: KetQuaMan['hut'] = [];
  /** D528 — KHOẢN GIỮ SUỐT đã bị kéo vào màn (kê bán khoản · Tâm lý yếu · trần thua khi chưa bấm): mua ở giá mở, ×1, bán dần. null = chưa động tới. */
  let kg = null as { tien: number; con: number } | null;   // gán trong closure ⇒ ép kiểu để TS không thu hẹp về null
  let tly = undefined as { nhip: number } | undefined;
  // D561 — khoá v65 (BÁN BỚT): phần khoản giữ đã bán là TIỀN MẶT dùng được để VÀO lại (bán trước cú rơi, mua lại ở đáy); khoá cũ y nguyên.
  // D561 — khoá `khoanTheoDuong`: khoản chưa bán là KHOẢN (không phải tiền mặt) ⇒ chỉ phần đã bán VÀO được.
  // D589 — phần VAY (×2) không phải tiền của ghế ⇒ không trừ vào tiền còn VÀO được.
  const conVon = () => p.von - vao.reduce((a, x) => a + (x.vay ? 0 : x.tien), 0) - (p.khoanTheoDuong ? (kg ? kg.con : p.von) : kg ? (p.banBot ? kg.con : kg.tien) : 0);
  const dangCam = () => vao.reduce((a, x) => a + x.con, 0);
  /*
   * D589 — khoá v70: số phần VÀO (không tính phần vay) · cú CHỐT kể từ lần VÀO cuối · thanh lý của phần vay ×2. Lãi một phần khi đóng = lãi giá −
   * lãi vay theo nến giữ (phần vay, cùng công thức Đòn Bẩy `laiVayGop` — một nguồn). Khoá cũ: không phần nào `vay` ⇒ y nguyên `laiVi`.
   */
  const soPhan = () => vao.reduce((a, x) => a + (x.vay ? 0 : 1), 0);
  let chotLan = 0;
  let thanhLy = undefined as { nhip: number } | undefined;
  const pctVay = p.laiVayPct ?? LAI_VAY_PCT.AM_DAM;
  const laiPhan = (x: PhanVao, t: number, gRa: number, k: number) =>
    laiVi(t, x.khop, gRa, 1, he) - (x.vay ? laiVayGop(t, 1, pctVay, Math.max(0, k - x.nhip) / NHIP_MOI_NEN_GOP) : 0);
  const daRaHet = () => (p.banBot ? ra.some((x) => !x.giu) : ra.length > 0) && dangCam() === 0;
  const tbKhop = () => { const t = vao.reduce((a, x) => a + x.tien, 0); return t ? vao.reduce((a, x) => a + x.khop * x.tien, 0) / t : 0; };
  // D486 — NÓNG VỘI xem khung nhanh ⇒ "trắng" theo NẾN MỊN của nhịp; khung thường theo nến gộp (D475).
  const gopTai = (k: number): { trang?: boolean; trangBan?: boolean } => (p.nongVoi ? chay[Math.floor(k / NHIP_MOI_NEN)]! : ng[Math.floor(k / NHIP_MOI_NEN_GOP)]!);
  // D499 — TỔ CHỨC: khớp thỏa thuận (nến trắng vẫn khớp, trượt ×1,5) · trần thua: giá mà lãi lỗ (đã chốt + đang cầm, theo giá đóng) = −trần.
  const tc = p.toChuc === true, c0 = 1 - truot / 10000, capV = tc ? (p.von * TO_CHUC_V57.TRAN_THUA_BP) / 10000 : 0;
  const heTT = (trang: boolean | undefined) => (tc && trang ? TO_CHUC_V57.TRUOT_THOA_THUAN : 1);
  const giaTranNay = (): number | undefined => {
    let A = 0, B = 0;
    for (const x of vao) if (x.con > 0) { A += x.con * he; B += (x.con * he) / x.khop; }
    return B > 0 ? (A - capV - ra.reduce((a, y) => a + y.lai, 0)) / (c0 * B) : undefined;
  };
  let tranThua: { nhip: number; gia: number } | undefined;
  const xuLy = (l: LenhMan, k: number) => {
    if (tranThua || thanhLy) return;   // đã bị mandate chốt / D589 thanh lý ×2 ⇒ thôi giao dịch tới hết màn
    const g = gia(k);
    if (l.nut === 'vao_nua' || l.nut === 'vao_het') {
      if (conVon() <= 0 || daRaHet()) return;
      const tr = gopTai(k).trangBan;
      if (tr && !tc) { hut.push({ nhip: k, ben: 'ban' }); return; }   // không ai bán ⇒ mua hụt (Tổ Chức: khớp thỏa thuận)
      const tien = l.nut === 'vao_nua' ? Math.min(Math.floor(p.von / 2), conVon()) : conVon();
      if (tien <= 0) return;
      const them = dayLenh(k, 1, tien * he);
      vao.push({ tien, con: tien, khop: g * (1 + (truot * heTT(tr)) / 10000) * (1 + them) * truotThac(p.min, k, 1), nhip: k, s: sCua(k), bung: dangBung(chay, ng, k), loai: l.nut === 'vao_nua' ? 'nua' : 'het' });
    } else if (l.nut === 'vao') {
      // D511 — MUA ĐUỔI: VÀO/NHỒI tối đa 3 phần; trượt nặng dần theo chuỗi nến xanh (đuổi càng muộn càng đắt — demo `truotVao`).
      // D589 — khoá v70: cả Bắt Đáy (gom 3 phần, trượt thường); cỡ phần theo `TI_LE_PHAN` (`tienPhanVao` — một nguồn với API). VÀO lại ⇒ CHỐT đếm lại.
      const n = soPhan();
      if (n >= 3 || conVon() <= 0 || daRaHet()) return;
      const tr = gopTai(k).trangBan;
      if (tr && !tc) { hut.push({ nhip: k, ben: 'ban' }); return; }
      const tien = p.baPhan ? tienPhanVao(p.la, p.von, n, conVon()) : n === 2 ? conVon() : Math.min(Math.floor(p.von / 3), conVon());
      if (tien <= 0) return;
      const cx = p.baPhan && p.la !== 'mua_duoi' ? 0 : chuoiXanh(k), them = dayLenh(k, 1, tien * he);
      vao.push({ tien, con: tien, khop: g * (1 + (truot * (1 + MUA_DUOI.TRUOT_THEO_CHUOI * cx) * heTT(tr)) / 10000) * (1 + them) * truotThac(p.min, k, 1), nhip: k, s: sCua(k),
        bung: dangBung(chay, ng, k), loai: n ? 'nhoi' : 'vao', chuoi: cx });
      chotLan = 0;
    } else if (l.nut === NUT_VAY_X2 && p.baPhan && p.la === 'mua_duoi') {
      // D589 — ×2: đủ 3 phần, CHƯA chốt phần nào, một lần mỗi màn — vay đúng bằng vốn màn, khớp như cú nhồi (trượt theo chuỗi nến xanh, tự đẩy).
      if (soPhan() < 3 || vao.some((x) => x.vay) || ra.some((x) => !x.giu) || dangCam() <= 0) return;
      const tr = gopTai(k).trangBan;
      if (tr && !tc) { hut.push({ nhip: k, ben: 'ban' }); return; }
      const tien = p.von, cx = chuoiXanh(k), them = dayLenh(k, 1, tien * he);
      vao.push({ tien, con: tien, khop: g * (1 + (truot * (1 + MUA_DUOI.TRUOT_THEO_CHUOI * cx) * heTT(tr)) / 10000) * (1 + them) * truotThac(p.min, k, 1), nhip: k, s: sCua(k),
        bung: dangBung(chay, ng, k), loai: 'vay', chuoi: cx, vay: true });
    } else if (l.nut === 'chot' && p.baPhan && p.la === 'mua_duoi') {
      // D589 — CHỐT gộp (founder: "lần 1 bán nửa lần 2 bán hết"): nửa phần ĐANG CẦM rồi hết; phần vay đóng trước (`dongPhan`). Hụt (nến trắng) không đếm.
      const dc = dangCam();
      if (dc <= 0 || chotLan >= 2) return;
      const truocRa = ra.length;
      dongPhan(k, g, chotLan === 0 ? Math.max(1, Math.floor(dc / 2)) : dc);
      if (ra.length > truocRa) chotLan += 1;
    } else if (l.nut === 'thoat' || l.nut === 'chot_het') {
      dongPhan(k, g, dangCam());
    } else if (l.nut === 'chot_nua') {
      dongPhan(k, g, Math.min(dangCam(), Math.max(1, Math.floor(vao.reduce((a, x) => a + x.tien, 0) / 2))));   // D511 — demo `dongVT(.5)`
    } else if (l.nut === NUT_BAN_BOT && (p.banBot || p.banBotRai)) {
      // D561 — BÁN BỚT: bán NỬA phần khoản còn giữ ở giá đang chạy (trượt như lệnh thường, nến trắng ⇒ hụt). Chỉ khi chưa VÀO (đã vào thì vốn
      // màn đã là tiền mặt theo lệnh — không còn khoản giữ để bán).
      if (vao.length > 0 && !p.khoanTheoDuong) return;   // D561 — khoá khoản theo đường: phần còn giữ vẫn bán bớt được sau khi đã VÀO
      const con = kg ? kg.con : p.von;
      if (con <= 0) return;
      const tr = gopTai(k).trang;
      if (tr && !tc) { hut.push({ nhip: k, ben: 'mua' }); return; }
      // D586 — khoá v69: mỗi cú bán một phần CỐ ĐỊNH của khoản ban đầu theo cấp Rải lệnh (`luongBanBot`) — đủ số lần là về 0. Khoá cũ: nửa phần còn.
      const can = p.banBotRai ? luongBanBot(p.von, con, ra.filter((x) => x.giu && x.lyDo === 'ban_bot').length, p.rai) : Math.max(1, Math.floor(con / 2));
      if (can <= 0) return;
      const them = dayLenh(k, -1, can * he);
      banGiu(k, g * (1 - (truot * heTT(tr)) / 10000) * (1 - them), can, 'ban_bot');
    }
  };
  /** Đóng `can` theo FIFO ở nhịp k (THOÁT · CHỐT HẾT: cả phần đang cầm · D511 CHỐT NỬA: nửa số đã mua). Lãi floor TỪNG phần. */
  function dongPhan(k: number, g: number, can: number, lyDo?: 'tam_ly_yeu') {
    if (dangCam() <= 0 || can <= 0) return;
    const tr = gopTai(k).trang;
    if (tr && !tc) { hut.push({ nhip: k, ben: 'mua' }); return; }       // không ai mua ⇒ bán hụt
    const them = dayLenh(k, -1, can * he);
    const gRa = g * (1 - (truot * kBanManh(he, false) * heTT(tr)) / 10000) * (1 - them), tb = tbKhop();
    let tien = 0, lai = 0;
    // D589 — phần VAY (×2) đóng TRƯỚC (luật margin: trả nợ trước), rồi FIFO như cũ.
    for (const x of [...vao.filter((y) => y.vay), ...vao.filter((y) => !y.vay)]) {
      if (can <= 0) break;
      const t = Math.min(x.con, can);
      if (t > 0) { lai += laiPhan(x, t, gRa, k); x.con -= t; tien += t; can -= t; }
    }
    ra.push({ tien, ra: gRa, nhip: k, lai, tbVao: tb, ...(lyDo ? { lyDo } : {}) });
  }
  /** D528 — đóng phần đang cầm ĐÚNG giá `gia` (lệnh kê bán: giới hạn, không trượt, không tự đẩy). */
  function dongGia(k: number, gia: number) {
    const tb = tbKhop();
    let tien = 0, lai = 0;
    for (const x of vao) { if (x.con > 0) { lai += laiPhan(x, x.con, gia, k); tien += x.con; x.con = 0; } }
    if (tien > 0) ra.push({ tien, ra: gia, nhip: k, lai, tbVao: tb, lyDo: 'ke_lenh' });
  }
  /** D528 — bán `can` của KHOẢN GIỮ SUỐT ở giá ra `gRa` (×1, giá vào = giá mở màn). Lần đầu thì dựng khoản giữ = cả vốn màn. */
  function banGiu(k: number, gRa: number, can: number, lyDo: 'ke_lenh' | 'tam_ly_yeu' | 'tran_thua' | 'ban_bot') {
    kg ??= { tien: p.von, con: p.von };
    const t = Math.min(kg.con, Math.max(0, can));
    if (t <= 0) return;
    kg.con -= t;
    ra.push({ tien: t, ra: gRa, nhip: k, lai: laiVi(t, giaDau, gRa, 1, 1), tbVao: giaDau, lyDo, giu: true });
  }
  /** D528 — lệnh kê chiều `ben` khớp NGAY BÂY GIỜ thì làm gì (nhánh thường: không có khống). */
  const vaiTroKe = (ben: 'mua' | 'ban'): LenhKe['vt'] => (ben === 'mua'
    ? (conVon() > 0 && (p.khoanTheoDuong || !kg) && !tranThua ? 'mo' : null)
    : dangCam() > 0 ? 'chot' : vao.length === 0 && (!kg || kg.con > 0) ? 'ban_giu' : null);
  /** D528 — giá chạm lệnh kê ⇒ khớp TRỌN đúng giá lệnh. Nến TRẮNG phía đối ứng ⇒ lệnh chờ. */
  function khopKe(k: number, g: number) {
    keS.quet(k, (ben, b) => {
      if (ben === 'mua' ? g > b.gia : g < b.gia) return 'cho';
      if (ben === 'mua' ? gopTai(k).trangBan : gopTai(k).trang) return 'cho';
      const vt = vaiTroKe(ben);
      if (!vt) return keS.choMoKia(ben, vaiTroKe) ? 'cho' : 'huy';
      if (vt === 'mo') { const tien = conVon(); vao.push({ tien, con: tien, khop: b.gia, nhip: k, s: sCua(k), bung: false, loai: 'ke' }); }
      else if (vt === 'chot') dongGia(k, b.gia);
      else banGiu(k, b.gia, kg ? kg.con : p.von, 'ke_lenh');
      return vt;
    });
  }
  /** D528 — TÂM LÝ YẾU: lãi lỗ màn (đã chốt + đang cầm + khoản giữ, theo giá bất lợi của nhịp) chạm ngưỡng ⇒ bán tháo một phần ở giá thị trường. */
  function xetTly(k: number, g: number) {
    if (!p.tamLyYeu || tly || tranThua) return;
    const giuNguyen = vao.length === 0 && !kg;
    const pnl = giuNguyen ? floorTien(p.von * (g / giaDau - 1))
      : ra.reduce((a, y) => a + y.lai, 0) + vao.reduce((a, x) => a + (x.con > 0 ? laiPhan(x, x.con, g * c0, k) : 0), 0) + (kg ? laiVi(kg.con, giaDau, g, 1, 1) : 0);
    if (pnl > -(p.von * TAM_LY_YEU.NGUONG_BP) / 10000) return;
    if (gopTai(k).trang) return;   // không ai mua ⇒ chưa bán được, xét lại nhịp sau
    const gRa = g * (1 - truot / 10000);
    if (dangCam() > 0) dongPhan(k, g, Math.max(1, Math.floor((dangCam() * TAM_LY_YEU.BAN_BP) / 10000)), 'tam_ly_yeu');
    else banGiu(k, gRa, Math.max(1, Math.floor(((kg ? kg.con : p.von) * TAM_LY_YEU.BAN_BP) / 10000)), 'tam_ly_yeu');
    tly = { nhip: k };
  }
  /** D511 — chuỗi nến XEM xanh liền nhau tính tới nến đang chạy (nến đang chạy xanh khi giá nhịp k > giá mở của nó) — demo `chuoiXanh`. */
  function chuoiXanh(k: number): number {
    const nen: readonly { o: number; c: number }[] = p.nongVoi ? chay : ng, buoc = p.nongVoi ? NHIP_MOI_NEN : NHIP_MOI_NEN_GOP, j = Math.floor(k / buoc);
    if (!(gia(k) > nen[j]!.o)) return 0;
    let n = 1;
    for (let i = j - 1; i >= 0 && nen[i]!.c > nen[i]!.o; i--) n += 1;
    return n;
  }
  const ds = [...p.lenh].filter((l) => Number.isInteger(l.nhip) && l.nhip >= cua.tu && l.nhip < cua.den && l.nhip < SO_NHIP && nut.includes(l.nut))
    .sort((a, b) => a.nhip - b.nhip || a.seq - b.seq);
  const den = Math.min(SO_NHIP - 1, p.denNhip ?? SO_NHIP - 1);
  keS.datTruoc(den);   // D528 — lệnh kê đặt trong đếm ngược (nhịp −1)
  for (let k = 0, i = 0; k <= den; k++) {
    // D528 — Tổ Chức: TRẦN THUA áp cả khoản GIỮ SUỐT — chưa bấm gì mà giá chạm giá trần của khoản ⇒ chốt cả khoản đúng giá trần (khớp thỏa thuận).
    if (tc && p.tranThuaGiu && !tranThua && vao.length === 0 && !kg) {
      const gT = (giaDau * (1 - TO_CHUC_V57.TRAN_THUA_BP / 10000)) / c0;
      if (gia(k) <= gT) { banGiu(k, gT * c0, p.von, 'tran_thua'); tranThua = { nhip: k, gia: gT }; }
    }
    // D499 — trần thua xét TRƯỚC cú bấm cùng nhịp (như sàn thanh lý D492); chốt ĐÚNG giá trần, khớp thỏa thuận: không tự đẩy, không ×bán mạnh.
    if (tc && !tranThua && dangCam() > 0) {
      const gT = giaTranNay();
      if (gT !== undefined && gia(k) <= gT) {
        const gRa = gT * c0, tb = tbKhop();
        let tien = 0, lai = 0;
        for (const x of vao) { if (x.con > 0) { lai += laiPhan(x, x.con, gRa, k); tien += x.con; x.con = 0; } }
        ra.push({ tien, ra: gRa, nhip: k, lai, tbVao: tb, lyDo: 'tran_thua' });
        tranThua = { nhip: k, gia: gT };
      }
    }
    // D589 — THANH LÝ phần ×2 (luật Đòn Bẩy): vốn của ghế (vốn màn + đã chốt + đang cầm theo giá bán, trừ lãi vay) ≤ `KY_QUY.THANH_LY` × vốn màn ⇒
    // bán cưỡng bức hết ở giá nhịp (bán mạnh × thanh lý, nến trắng bên mua ⇒ trượt khoá), thôi giao dịch tới hết màn.
    if (p.baPhan && !thanhLy && vao.some((x) => x.vay && x.con > 0)) {
      const g0 = gia(k);
      const vonNay = p.von + ra.reduce((a, y) => a + (y.giu ? 0 : y.lai), 0) + vao.reduce((a, x) => a + (x.con > 0 ? laiPhan(x, x.con, g0 * c0, k) : 0), 0);
      if (vonNay <= KY_QUY.THANH_LY * p.von) {
        const gRa = g0 * (1 - (truot * (gopTai(k).trang ? TRUOT_KHOA_CUOI : 1) * kBanManh(he, true)) / 10000), tb = tbKhop();
        let tien = 0, lai = 0;
        for (const x of vao) { if (x.con > 0) { lai += laiPhan(x, x.con, gRa, k); tien += x.con; x.con = 0; } }
        ra.push({ tien, ra: gRa, nhip: k, lai, tbVao: tb, lyDo: 'thanh_ly' });
        thanhLy = { nhip: k };
        keS.huyHet('khoa');
      }
    }
    xetTly(k, gia(k));   // D528
    for (; i < ds.length && ds[i]!.nhip === k; i++) xuLy(ds[i]!, k);
    keS.dat(k, gia(k));   // D528 — lệnh kê đặt / dời / huỷ ở nhịp này
    if (tranThua || k < cua.tu) { if (tranThua) keS.huyHet('khoa'); }
    else if (k >= cua.den) keS.huyHet('khoa');
    else khopKe(k, gia(k));
  }
  const v59 = (): Partial<KetQuaMan> => ({ ...(p.baPhan ? { chotLan } : {}), ...(keS.coTrait ? { ke: keS.ra() } : {}), ...(tly ? { tly } : {}), ...(kg ? { khoanGiu: { ...kg } } : {}) });
  if (p.denNhip !== undefined) {
    const gT = tc && !tranThua && dangCam() > 0 ? giaTranNay() : undefined;
    // D504 — bán hết ở giá nhịp k trừ trượt cơ bản (cùng `c0` của giá trần), cộng phần đã chốt, trần lỗ = cả vốn (như quyết toán).
    const chot = ra.reduce((a, y) => a + y.lai, 0);
    const conGiu = kg ? kg.con : 0;
    const tamTinh = (dangCam() > 0 || conGiu > 0) && !(tranThua && dangCam() === 0)
      ? (k: number) => tranLo(chot + vao.reduce((a, x) => a + (x.con > 0 ? laiPhan(x, x.con, gia(k) * c0, k) : 0), 0) + (conGiu > 0 ? laiVi(conGiu, giaDau, gia(k), 1, 1) : 0), p.von, 0) : undefined;
    return tru({ ...rong, vao, ra, hut, xungBan: xung, ...(tranThua ? { tranThua } : {}), ...(gT !== undefined ? { giaTran: gT } : {}), ...(tamTinh ? { tamTinh } : {}), ...v59() });
  }

  // D479 — KHÔNG BẤM = KHÔNG VÀO ⇒ GIỮ suốt màn: đúng phần engine đã cộng, lãi lỗ màn 0 (founder: "chịu biến động như all in từ đầu đến cuối").
  if (vao.length === 0 && !kg) return tru({ ...rong, tuDong: true, hut, nhan: ['giu_suot'], ...v59() });
  // D528 — phần KHOẢN GIỮ còn lại cuối màn: vẫn là giữ ⇒ đúng giá cuối, không trượt.
  if (kg && kg.con > 0) {
    const gC = giaCuoi;
    ra.push({ tien: kg.con, ra: gC, nhip: SO_NHIP, lai: laiVi(kg.con, giaDau, gC, 1, 1), tbVao: giaDau, tuDongCuoi: true, giu: true });
    kg.con = 0;
  }
  // Tự chốt cuối màn: nến cuối trắng bên mua (không ai mua) ⇒ trượt ×3 (Tổ Chức: thỏa thuận ×1,5). D486 — NÓNG VỘI: tự chốt ở mốc 17 s.
  if (dangCam() > 0) {
    const nv = cua.den < SO_NHIP, kChot = nv ? cua.den - 1 : SO_NHIP - 1;
    const cuoiKhoa = !!(nv ? gopTai(kChot).trang : ng[ng.length - 1]!.trang);
    const gChot = gia(kChot);
    const gRa = gChot * (1 - (truot * (cuoiKhoa ? (tc ? TO_CHUC_V57.TRUOT_THOA_THUAN : TRUOT_KHOA_CUOI) : 1) * kBanManh(he, false)) / 10000), tb = tbKhop();
    let tien = 0, lai = 0;
    for (const x of vao) { if (x.con > 0) { lai += laiPhan(x, x.con, gRa, nv ? cua.den : SO_NHIP); tien += x.con; x.con = 0; } }
    ra.push({ tien, ra: gRa, nhip: nv ? cua.den : SO_NHIP, lai, tbVao: tb, tuDongCuoi: true, cuoiKhoa, ...(nv ? { nongVoi: true as const } : {}) });
  }
  const tho = ra.reduce((a, x) => a + x.lai, 0), theoLenh = tranLo(tho, p.von, 0);
  const kq: KetQuaMan = { ...rong, loi: theoLenh - giuMoc, theoLenh, chamTran: theoLenh !== tho, vao, ra, hut, xungBan: xung, ...(tranThua ? { tranThua } : {}), ...v59() };
  kq.nhan = !p.la ? [] : p.la === 'mua_duoi' ? nhanMuaDuoi(kq, ng) : nhanBatDay(kq, ng);   // D511
  if (tranThua) kq.nhan = [...kq.nhan.filter((x) => x !== 'khong_ro'), 'cham_tran_thua'];
  // D589 — nhãn khoá v70 (đo, không thưởng): Bắt Đáy gom các phần ở giá THẤP DẦN (trung bình giá xuống) · Mua Đuổi đã vay ×2 · bị thanh lý.
  if (p.baPhan) {
    const v = kq.vao.filter((x) => !x.vay), them: string[] = [];
    if (p.la === 'bat_day' && v.length >= 2 && v.every((x, i) => i === 0 || x.khop < v[i - 1]!.khop)) them.push('tb_gia_xuong');
    if (kq.vao.some((x) => x.vay)) them.push('vay_x2');
    if (thanhLy) them.push('bi_thanh_ly');
    if (them.length) kq.nhan = [...kq.nhan.filter((x) => x !== 'khong_ro'), ...them];
  }
  kq.nhan = [...kq.nhan, ...nhanV59(kq)];
  if (!kq.nhan.length) kq.nhan = ['khong_ro'];
  return tru(kq);
}

/** D532 — ghế đã mua tin sớm: lá Lướt Sóng (khoá v60), không MÙ TIN, có cú `mua_tin` trước màn chạy (nhịp −1). */
export function daMuaTin(p: { la: string | null; luotSong?: boolean; muTin?: boolean; lenh: readonly LenhMan[] }): boolean {
  return p.la === 'luot_song' && p.luotSong === true && p.muTin !== true && p.lenh.some((l) => l.nut === 'mua_tin' && l.nhip < 0);
}

/**
 * D532 — demo `nhanHanhVi` nhánh luot_song: KHÔNG MUA / MUA TIN SỚM; mỗi tin THẬT (không tính tin lan): trong 3 nến xem (khung nhanh: 6 nến mịn) sau tin
 * có cú giao dịch CÙNG hướng tác động ⇒ DÙNG THÔNG TIN, không ⇒ MUA RỒI BỎ; mua mà màn không có tin thật; biết là nhiễu mà vẫn theo hướng lời của nó.
 * "Cú giao dịch" = mở chân (hướng = chiều) · đóng chân (hướng = ngược chiều) — demo `G.hd` (lệnh do trait / tự chốt không tính).
 */
function nhanTinLuotSong(kq: KetQuaMan, tin: readonly TinMan[], muaTin: boolean): string[] {
  const n: string[] = [];
  if (!muaTin) n.push('khong_mua_tin_som');
  else {
    n.push('mua_tin_som');
    const hd = [...kq.vao.map((v) => ({ nhip: v.nhip, h: v.chieu ?? 1 })), ...kq.ra.filter((r) => !r.tuDongCuoi && !r.lyDo).map((r) => ({ nhip: r.nhip, h: -(r.chieu ?? 1) }))];
    const trong = (ci: number, h: number) => hd.some((a) => a.nhip >= ci * NHIP_MOI_NEN && a.nhip <= (ci + 3 * K_MIN) * NHIP_MOI_NEN && a.h === h);
    const that = tin.filter((t) => t.that && !t.lan);
    for (const t of that) n.push(trong(t.ci, t.huong) ? 'dung_thong_tin' : 'mua_roi_bo');
    if (!that.length) n.push('mua_khi_khong_co_tin_that');
    if (tin.some((t) => !t.that && t.noi && trong(t.ci, t.noi))) n.push('da_biet_nhieu_van_theo');
  }
  return n;
}

/** D561 — các mức đòn bẩy của lõi đòn bẩy theo CHIỀU: Bán Khống ở khoá v65 chỉ ×2. MỘT cửa cho khớp + tiền nút + client (qua API). */
export function mucDonBay(bc: { bk_x2?: true } | null | undefined, chieu: 1 | -1): readonly number[] {
  return chieu === -1 && bc?.bk_x2 ? [MUC_DON_BAY[0]] : MUC_DON_BAY;
}

/**
 * D531 — nút của lõi trong màn: Lướt Sóng chỉ có nút ở khoá `loiChiTrongMan` (khoá cũ: màn chỉ xem — replay y nguyên). MỘT cửa cho khớp + API.
 * D586 — khoá v69 (`banBotRai`): BÁN BỚT ở Bắt Đáy · Mua Đuổi và màn KHÔNG lõi (`la` null — mặc định nắm giữ); lượng mỗi cú `luongBanBot`.
 *   Lướt Sóng · Đòn Bẩy · Bán Khống không đổi (không phải lõi vốn mua/bán giữ — founder 11/10).
 */
export function nutLoiCua(la: string | null | undefined, luotSong?: boolean, banBot?: boolean, banBotRai?: boolean, baPhan?: boolean): readonly string[] | undefined {
  if (!la) return banBotRai ? [NUT_BAN_BOT] : undefined;
  if (la === 'luot_song' && !luotSong) return undefined;
  const goc = (baPhan ? NUT_LOI_BA_PHAN[la] : undefined) ?? NUT_LOI[la];   // D589 — khoá v70: VÀO 3 phần · ×2 · CHỐT gộp (Mua Đuổi) / VÀO · THOÁT (Bắt Đáy)
  // D561 — khoá v65: Bắt Đáy / Mua Đuổi thêm BÁN BỚT (bán nửa phần khoản còn giữ — lối ăn chiều xuống của lõi một chiều, founder 07/10).
  if ((banBot || banBotRai) && (la === 'bat_day' || la === 'mua_duoi')) return [...goc!, NUT_BAN_BOT];
  return goc;
}
/** D589 — nút ×2 của Mua Đuổi (khoá v70) — client đặt nó vào CHÍNH ô VÀO khi đã nhồi đủ 3 phần. */
export const NUT_VAY_X2 = 'vay_x2';
/**
 * D589 — tiền của phần VÀO thứ `n` (0-based) theo `TI_LE_PHAN` (phần /6 vốn màn, phần thứ ba = tiền còn): Mua Đuổi 3 : 2 : 1 · Bắt Đáy 1 : 2 : 3.
 * Một nguồn cho khớp và tiền nút của API. Lõi không chia phần / đủ 3 / hết tiền ⇒ 0.
 */
export function tienPhanVao(la: string | null | undefined, von: number, n: number, conVon: number): number {
  const ti = la ? TI_LE_PHAN[la] : undefined;
  if (!ti || n >= 3 || conVon <= 0) return 0;
  return n === 2 ? conVon : Math.min(Math.floor((von * ti[n]!) / 6), conVon);
}
/**
 * D586 — LƯỢNG của cú BÁN BỚT kế (khoá v69, founder 11/10: *"cho bán bớt có khả năng bán hết… quy định số lần để bán và % được phép bán dựa trên
 * trait rải lệnh"*): khoản ban đầu `von` chia đều `soLanBanBot(rai)` phần; cú cuối bán nốt phần còn (`con`). MỘT cửa cho khớp + tiền nút API.
 */
export function luongBanBot(von: number, con: number, daBanLan: number, rai?: number): number {
  if (con <= 0) return 0;
  const n = soLanBanBot(rai);
  return daBanLan >= n - 1 ? con : Math.min(con, Math.floor(von / n));
}
/** D586 — số lần BÁN BỚT để về 0: không Rải lệnh `BAN_BOT_LAN.KHONG_RAI` · có thì theo bảng cấp (`BAN_BOT_LAN.THEO_RAI`). */
export function soLanBanBot(rai?: number): number {
  return (rai ? BAN_BOT_LAN.THEO_RAI[rai] : undefined) ?? BAN_BOT_LAN.KHONG_RAI;
}
/** D561 — mã nút BÁN BỚT (ngoài bảng tĩnh `NUT_LOI`: chỉ có ở khoá v65, qua `nutLoiCua`). */
export const NUT_BAN_BOT = 'ban_bot';

/**
 * D531 — KHỚP LÕI LƯỚT SÓNG (demo `LOI.luot_song` · `moVT` · `dongVT` · `chotMini`; founder: *"lướt sóng ở demo như nào thì làm như thế"*).
 * · Không bấm = giữ suốt (không vào nhánh này). `dao`: không cầm ⇒ mở SHORT trên TRỌN vốn màn; đang cầm ⇒ đóng hết rồi mở chiều kia (ĐẢO; mỗi chân
 *   luôn bằng vốn màn ban đầu — lãi đã chốt không gộp vốn, đúng demo). `chot`: đóng hết về tiền mặt — phần còn lại của màn không ăn gì (demo: nhãn
 *   "về HOLD" nhưng `G.lo` đã có chân ⇒ không dựng lại khoản giữ). Đóng xong bấm `dao` lại là SHORT.
 * · Phí `PHI_LS_BP` mỗi lần khớp (mở: trên vốn màn · đóng: trên số đóng); tự chốt cuối màn KHÔNG phí. Trượt × `TRUOT_LS` cả vào lẫn ra (config, D462).
 * · Nến TRẮNG xét theo NẾN MỊN (khung nhanh 60 nến): bán (mở short / đóng long) cần người mua · mua (mở long / đóng short) cần người bán; Tổ Chức khớp
 *   thỏa thuận. Một cú ĐẢO xét MỘT lần theo chiều mới (đóng + mở cùng chiều giao dịch).
 * · Lệnh kê: chỉ KÊ BÁN mở short khi đang không cầm (demo `vaiTroKe`); kê mua không có vai trò.
 * · Tổ Chức: TRẦN THUA trên lãi lỗ (đã chốt + chân đang cầm, không tính phí) — chạm thì chốt đúng giá trần, thôi giao dịch tới hết màn.
 */
function khopLuotSong(p: Parameters<typeof ketQuaMan>[0], x: {
  chay: readonly NenMin[]; rong: KetQuaMan; truot: number; cua: { tu: number; den: number };
  gia: (k: number) => number; dayLenh: (k: number, chieu: 1 | -1, danhNghia: number) => number; xung: XungBan[];
  keS: ReturnType<typeof taoKe>; giuMoc: number;
}): KetQuaMan {
  const { chay, rong, cua, gia, dayLenh, xung, keS } = x;
  const he = p.he ?? HE_SO_LOI, truot = x.truot * TRUOT_LS, tc = p.toChuc === true, c0 = 1 - truot / 10000;
  const capV = tc ? (p.von * TO_CHUC_V57.TRAN_THUA_BP) / 10000 : 0;
  const vao: PhanVao[] = [], ra: LanRa[] = [], hut: KetQuaMan['hut'] = [];
  let phi = 0, soDao = 0;
  let tranThua: { nhip: number; gia: number } | undefined;
  /** D561 — khoá `khoanTheoDuong`: vốn của chân = khoản theo giá lúc chuyển (cú mở đầu); khoá cũ = vốn màn. */
  let vonChan = p.von, daChuyen = false;
  const phiLan = phiKhopLs;   // `PHI_LS_BP` (config, D462) — mỗi lần khớp
  const nenMin = (k: number) => chay[Math.floor(k / NHIP_MOI_NEN)]!;
  /** Chiều giao dịch `ch` (+1 mua · −1 bán) bị nến trắng chặn ở nhịp k? (Tổ Chức: không — khớp thỏa thuận.) */
  const trangPhia = (k: number, ch: 1 | -1) => !!(ch === 1 ? nenMin(k).trangBan : nenMin(k).trang);
  const biKhoa = (k: number, ch: 1 | -1) => !tc && trangPhia(k, ch);
  const heTT = (k: number, ch: 1 | -1) => (tc && trangPhia(k, ch) ? TO_CHUC_V57.TRUOT_THOA_THUAN : 1);
  const chieu = (): 1 | -1 | 0 => vao.find((v) => v.con > 0)?.chieu ?? 0;
  const dangCam = () => vao.reduce((a, v) => a + v.con, 0);
  const daChot = () => ra.reduce((a, y) => a + y.lai, 0);
  function mo(k: number, ch: 1 | -1, loai: 'short' | 'dao', giaEp?: number) {
    if (p.khoanTheoDuong && !daChuyen) {
      // D561 — cú mở ĐẦU: khoản (đang cầm dài từ giá mở) đổi sang chân mới ở giá lúc này — phần đã trôi ghi một lần.
      const gC = giaEp ?? gia(k), lai = laiVi(p.von, rong.giaDau, gC, 1, 1);
      ra.push({ tien: p.von, ra: gC, nhip: k, lai, tbVao: rong.giaDau, giu: true, chuyen: true });
      vonChan = Math.max(0, p.von + lai); daChuyen = true;
    }
    const tien = vonChan;
    const them = giaEp === undefined ? dayLenh(k, ch, tien * he) : 0;
    const khop = giaEp ?? gia(k) * (1 + (ch * truot * heTT(k, ch)) / 10000) * (1 + ch * them) * truotThac(p.min, k, ch);
    vao.push({ tien, con: tien, khop, nhip: k, s: sCua(k), bung: false, loai, chieu: ch });
    phi += phiLan(tien);
  }
  function dong(k: number, lyDo?: 'tran_thua', giaEp?: number) {
    const ch = chieu();
    if (!ch) return;
    const nguoc = (-ch) as 1 | -1;
    const can = dangCam(), them = giaEp === undefined ? dayLenh(k, nguoc, can * he) : 0;
    const gRa = giaEp ?? gia(k) * (1 - (ch * truot * kBanManh(he, false) * heTT(k, nguoc)) / 10000) * (1 - ch * them);
    let tien = 0, lai = 0, tb = 0;
    for (const v of vao) if (v.con > 0) { lai += laiVi(v.con, v.khop, gRa, ch, he); tb += v.khop * v.con; tien += v.con; v.con = 0; }
    ra.push({ tien, ra: gRa, nhip: k, lai, tbVao: tien ? tb / tien : 0, chieu: ch, ...(lyDo ? { lyDo } : {}) });
    if (!lyDo) phi += phiLan(tien);   // chốt TRẦN THUA (khớp thỏa thuận) không phí
  }
  const xuLy = (l: LenhMan, k: number) => {
    if (tranThua) return;
    const ch = chieu();
    if (l.nut === 'dao') {
      const moi = (ch === 0 ? -1 : -ch) as 1 | -1;
      if (biKhoa(k, moi)) { hut.push({ nhip: k, ben: moi === 1 ? 'ban' : 'mua' }); return; }
      if (ch) { dong(k); soDao += 1; }
      mo(k, moi, ch ? 'dao' : 'short');
    } else if (l.nut === 'chot' && ch) {
      const nguoc = (-ch) as 1 | -1;
      if (biKhoa(k, nguoc)) { hut.push({ nhip: k, ben: nguoc === 1 ? 'ban' : 'mua' }); return; }
      dong(k);
    }
  };
  /** Tổ Chức — giá ra mà lãi lỗ (đã chốt + chân đang cầm) đúng bằng −trần (luôn một chân ⇒ giải thẳng). */
  const giaTranNay = (): number | undefined => {
    const v = vao.find((y) => y.con > 0);
    return v ? v.khop * (1 + ((v.chieu ?? 1) * (-capV - daChot())) / (v.con * he)) : undefined;
  };
  const ds = [...p.lenh].filter((l) => Number.isInteger(l.nhip) && l.nhip >= cua.tu && l.nhip < cua.den && l.nhip < SO_NHIP && (l.nut === 'dao' || l.nut === 'chot'))
    .sort((a, b) => a.nhip - b.nhip || a.seq - b.seq);
  const den = Math.min(SO_NHIP - 1, p.denNhip ?? SO_NHIP - 1);
  keS.datTruoc(den);
  for (let k = 0, i = 0; k <= den; k++) {
    const ch0 = chieu();
    if (tc && !tranThua && ch0) {
      const gT = giaTranNay();
      // giá bất lợi của nhịp (đã trừ trượt ra): long xét giá thấp, short xét giá cao
      if (gT !== undefined && (ch0 === 1 ? gia(k) * c0 <= gT : gia(k) * (2 - c0) >= gT)) { dong(k, 'tran_thua', gT); tranThua = { nhip: k, gia: gT }; }
    }
    for (; i < ds.length && ds[i]!.nhip === k; i++) xuLy(ds[i]!, k);
    keS.dat(k, gia(k));
    if (tranThua || k < cua.tu || k >= cua.den) keS.huyHet('khoa');
    else {
      const g = gia(k);
      keS.quet(k, (ben, b) => {
        if (ben === 'mua' || chieu() !== 0) return 'huy';   // demo `vaiTroKe`: Lướt Sóng chỉ KÊ BÁN mở short từ thế không cầm
        if (g < b.gia) return 'cho';
        if (nenMin(k).trang) return 'cho';
        mo(k, -1, 'short', b.gia);
        return 'mo';
      });
    }
  }
  const keRa = () => (keS.coTrait ? { ke: keS.ra() } : {});
  if (p.denNhip !== undefined) {
    const chot = daChot();
    const tamTinh = (k: number) => {
      const ch = chieu();
      const moC = ch ? vao.reduce((a, v) => a + (v.con > 0 ? laiVi(v.con, v.khop, gia(k) * (1 - (ch * truot) / 10000), ch, he) : 0), 0) : 0;
      return tranLo(chot + moC, p.von, 0) - phi;
    };
    return { ...rong, tuDong: vao.length === 0, vao, ra, hut, xungBan: xung, ...(tranThua ? { tranThua } : {}), ...(vao.length ? { tamTinh } : {}),
      ls: { chieu: chieu(), soDao, phi }, ...keRa() };
  }
  // Cả màn không khớp được chân nào (mọi cú bấm hụt nến trắng) ⇒ vẫn là giữ suốt (demo `chotMini`: `G.lo` rỗng ⇒ lô GIỮ).
  if (vao.length === 0) return { ...rong, tuDong: true, hut, nhan: ['giu_suot'], ls: { chieu: 0, soDao, phi }, ...keRa() };
  const ch = chieu();
  if (ch) {   // tự chốt cuối màn (NÓNG VỘI: ở mốc khoá) — không phí; nến trắng phía đối ứng ⇒ trượt ×3 (Tổ Chức: thỏa thuận)
    const nv = cua.den < SO_NHIP, kChot = nv ? cua.den - 1 : SO_NHIP - 1;
    const cuoiKhoa = trangPhia(kChot, (-ch) as 1 | -1);
    const gRa = gia(kChot) * (1 - (ch * truot * (cuoiKhoa ? (tc ? TO_CHUC_V57.TRUOT_THOA_THUAN : TRUOT_KHOA_CUOI) : 1) * kBanManh(he, false)) / 10000);
    let tien = 0, lai = 0, tb = 0;
    for (const v of vao) if (v.con > 0) { lai += laiVi(v.con, v.khop, gRa, ch, he); tb += v.khop * v.con; tien += v.con; v.con = 0; }
    ra.push({ tien, ra: gRa, nhip: nv ? cua.den : SO_NHIP, lai, tbVao: tien ? tb / tien : 0, tuDongCuoi: true, cuoiKhoa, chieu: ch, ...(nv ? { nongVoi: true as const } : {}) });
  }
  const tho = daChot(), tran = tranLo(tho, p.von, 0), theoLenh = tran - phi;
  const nhan = [...(soDao >= 6 ? ['dao_nhieu'] : []), ...(tranThua ? ['cham_tran_thua'] : [])];
  return { ...rong, loi: theoLenh - x.giuMoc, theoLenh, chamTran: tran !== tho, tuDong: false, vao, ra, hut, xungBan: xung, ...(tranThua ? { tranThua } : {}),
    nhan: nhan.length ? nhan : ['khong_ro'], ls: { chieu: 0, soDao, phi }, ...keRa() };
}

/**
 * D492 — KHỚP LÕI ĐÒN BẨY (demo `LOI.don_bay` · `moVT` · `dongVT` · `tangDb` · `nap` · `banHet` · tick gọi/thanh lý). Chạy THEO NHỊP: mỗi nhịp xét
 * thanh lý / gọi TRƯỚC, rồi mới tới cú bấm của nhịp đó (người bấm ở nhịp đã chạm sàn là trễ). Server xét MỌI nhịp nên không cần "giá bất lợi nhất
 * trong nến" của demo (demo lấy mẫu theo khung hình, server thì không bỏ nhịp nào).
 */
function khopDonBay(p: Parameters<typeof ketQuaMan>[0], x: {
  chay: readonly NenMin[]; ng: readonly NenGop[]; rong: KetQuaMan; truot: number; cua: { tu: number; den: number }; nut: readonly string[];
  /** D499 — giá có cộng cú tự đẩy · hàm đẩy · danh sách cú (chung với nhánh Bắt Đáy). */
  gia: (k: number) => number; dayLenh: (k: number, chieu: 1 | -1, danhNghia: number) => number; xung: XungBan[];
}): KetQuaMan {
  const { chay, ng, rong, truot, cua, gia, dayLenh, xung } = x;
  /*
   * D510 — CHIỀU: Đòn Bẩy 1 (vay mua) · Bán Khống −1 (vay bán; founder: "ký quỹ … thanh lý bù hay call margin tương tự đòn bẩy … cả lãi vay").
   * `c` = hệ số giá khi ĐÓNG ở trượt cơ bản: mua thì bán ra g(1 − t), khống thì mua lại g(1 + t). Mọi phép dưới đây chỉ đổi dấu theo `ch`.
   */
  const ch: 1 | -1 = p.la === LOI_BAN_KHONG ? -1 : 1, nutVao = ch === 1 ? 'vao_x' : 'ban_x', nutDong = ch === 1 ? 'chot' : 'mua_lai';
  const pct = p.laiVayPct ?? LAI_VAY_PCT.AM_DAM, c = 1 - (ch * truot) / 10000;
  /** Nến chặn VÀO (mua: trắng bên bán · khống: trắng bên mua) / chặn ĐÓNG (ngược lại) + phía bị trắng ghi vào `hut`. */
  const chanVao = (k: number) => (ch === 1 ? !!gopTai(k).trangBan : !!gopTai(k).trang), benVao: 'ban' | 'mua' = ch === 1 ? 'ban' : 'mua';
  const chanDong = (k: number) => (ch === 1 ? !!gopTai(k).trang : !!gopTai(k).trangBan), benDong: 'ban' | 'mua' = ch === 1 ? 'mua' : 'ban';
  const gopTai = (k: number): { trang?: boolean; trangBan?: boolean } => (p.nongVoi ? chay[Math.floor(k / NHIP_MOI_NEN)]! : ng[Math.floor(k / NHIP_MOI_NEN_GOP)]!);
  const lo: PhanVao[] = [], ra: LanRa[] = [], hut: KetQuaMan['hut'] = [];
  const keS = taoKe(p, rong.giaDau), giaDau = rong.giaDau;
  /** D528 — khoản GIỮ SUỐT đã kéo vào màn (kê bán khoản · Tâm lý yếu khi chưa vào): mua ở giá mở, ×1, chiều MUA, không vay. */
  let kg = null as { tien: number; con: number } | null;   // gán trong closure ⇒ ép kiểu để TS không thu hẹp về null
  let tly = undefined as { nhip: number } | undefined;
  const db: KetQuaDonBay = { L: 0, L0: 0, nap: [], napNhan: 0, chieu: ch, tang: [], thanhLy: null, banHet: null, xungKhoan: {}, daGoi: false, catKhiGoi: false, rutChan: false, nguong: null };
  const con: Record<string, number> = { ...(p.napTu ?? {}) };
  /**
   * D561 — khoá `khoanTheoDuong`: vốn ký quỹ = khoản theo giá lúc VÀO (`chuyenKhoan`). Phần đã trôi nằm ở dòng `chuyen` — ngoài `daChot` (đã gồm trong `vonKq`),
   * vào lại ở tạm tính / Tâm lý yếu / kết quả (tổng lãi lỗ thật). Khoá cũ: vonKq = vốn màn, không có dòng `chuyen`.
   */
  let vonKq = p.von;
  const truoc = () => ra.reduce((a, y) => a + (y.chuyen ? y.lai : 0), 0);
  const chuyenKhoan = (k: number, g: number) => {
    if (!p.khoanTheoDuong || ra.some((y) => y.chuyen)) return;
    const lai = laiVi(p.von, giaDau, g, 1, 1);
    ra.push({ tien: p.von, ra: g, nhip: k, lai, tbVao: giaDau, giu: true, chuyen: true });
    vonKq = Math.max(0, p.von + lai);
  };
  const Q = () => vonKq + db.napNhan;
  const daChot = () => ra.reduce((a, y) => a + (y.chuyen ? 0 : y.lai), 0);
  const dangCam = () => lo.reduce((a, y) => a + y.con, 0);
  const vayX = (y: PhanVao) => (y.them ? y.he! : y.he! - 1);
  const nenGiu = (y: PhanVao, k: number) => Math.max(0, k - y.nhip) / NHIP_MOI_NEN_GOP;
  const tbKhop = () => { const t = lo.reduce((a, y) => a + y.tien, 0); return t ? lo.reduce((a, y) => a + y.khop * y.tien, 0) / t : 0; };
  const heTb = () => { const t = dangCam(); return t ? lo.reduce((a, y) => a + y.con * y.he!, 0) / t : HE_SO_LOI; };
  /** Giá mà vốn còn = tyLe × ký quỹ ở nhịp k (demo `dbGia`, cộng lãi vay tới nhịp k + trượt khi đóng ⇒ đúng điều kiện `dbVonCon`). */
  const nguong = (tyLe: number, k: number): number => {
    let A = 0, B = 0, vay = 0;
    for (const y of lo) if (y.con > 0) { A += y.con * y.he!; B += (y.con * y.he!) / y.khop; vay += laiVayTho(y.con, vayX(y), pct, nenGiu(y, k)); }
    // vốn còn = Q + đã chốt + ch × (c·g·B − A) − vay = tyLe × Q  ⇒  g = (tyLe·Q − Q − đã chốt + vay + ch·A) / (ch · c · B)
    if (B <= 0) return ch === 1 ? -Infinity : Infinity;
    return (tyLe * Q() - Q() - daChot() + vay + ch * A) / (ch * c * B);
  };
  /** Giá đã chạm ngưỡng: mua ⇒ giá ≤ ngưỡng · khống ⇒ giá ≥ ngưỡng. */
  const cham = (g: number, ng: number) => (ch === 1 ? g <= ng : g >= ng);
  const dangGoi = (g: number, k: number) => dangCam() > 0 && cham(g, nguong(KY_QUY.GOI, k));
  /** Lãi lỗ thô nếu bán hết ở giá g tại nhịp k (trượt cơ bản, trừ lãi vay tới k) — TĂNG xét "khi lời" (D492) + tạm tính sổ giữa màn (D504). */
  const laiNay = (k: number, g: number) =>
    daChot() + lo.reduce((a, y) => a + (y.con > 0 ? laiVi(y.con, y.khop, g * c, ch, y.he!) - laiVayGop(y.con, vayX(y), pct, nenGiu(y, k)) : 0), 0);
  const dong = (k: number, g: number, lyDo?: 'thanh_ly' | 'ban_het', cuoi?: { cuoiKhoa: boolean; nongVoi?: true }) => {
    const tl = lyDo !== undefined, boi = (tl && chanDong(k)) || cuoi?.cuoiKhoa ? TRUOT_KHOA_CUOI : 1;
    // D499 — lệnh đóng (cả thanh lý / mua cưỡng bức) tự đẩy giá NGƯỢC chiều vị thế; tự chốt cuối màn thì không. D510: theo `ch`.
    const them = cuoi ? 0 : dayLenh(k, ch === 1 ? -1 : 1, dangCam() * heTb());
    const gRa = g * (1 - (ch * truot * boi * kBanManh(heTb(), tl)) / 10000) * (1 - ch * them), tb = tbKhop(), kLai = cuoi && !cuoi.nongVoi ? SO_NHIP : k;
    let tien = 0, lai = 0;
    for (const y of lo) {
      if (y.con <= 0) continue;
      lai += laiVi(y.con, y.khop, gRa, ch, y.he!) - laiVayGop(y.con, vayX(y), pct, nenGiu(y, kLai));
      tien += y.con; y.con = 0;
    }
    ra.push({ tien, ra: gRa, nhip: cuoi ? (cuoi.nongVoi ? cua.den : SO_NHIP) : k, lai, tbVao: tb, ...(lyDo ? { lyDo } : {}),
      ...(cuoi ? { tuDongCuoi: true as const, cuoiKhoa: cuoi.cuoiKhoa, ...(cuoi.nongVoi ? { nongVoi: true as const } : {}) } : {}) });
  };
  const xong = () => db.thanhLy !== null || (ra.some((y) => !y.giu) && dangCam() === 0) || (kg !== null && kg.con === 0);
  /** D528 — bán `can` của KHOẢN GIỮ SUỐT ở giá `gRa` (×1, chiều mua, không lãi vay). */
  const banGiu = (k: number, gRa: number, can: number, lyDo: 'ke_lenh' | 'tam_ly_yeu') => {
    kg ??= { tien: p.von, con: p.von };
    const t = Math.min(kg.con, Math.max(0, can));
    if (t <= 0) return;
    kg.con -= t;
    ra.push({ tien: t, ra: gRa, nhip: k, lai: laiVi(t, giaDau, gRa, 1, 1), tbVao: giaDau, lyDo, giu: true });
  };
  /** D528 — đóng vị thế ký quỹ ĐÚNG giá lệnh kê (giới hạn: không trượt, không tự đẩy, vẫn trả lãi vay tới nhịp k). */
  const dongGia = (k: number, gia: number) => {
    const tb = tbKhop();
    let tien = 0, lai = 0;
    for (const y of lo) { if (y.con > 0) { lai += laiVi(y.con, y.khop, gia, ch, y.he!) - laiVayGop(y.con, vayX(y), pct, nenGiu(y, k)); tien += y.con; y.con = 0; } }
    if (tien > 0) ra.push({ tien, ra: gia, nhip: k, lai, tbVao: tb, lyDo: 'ke_lenh' });
  };
  /** D528 — đóng một PHẦN `phan` (0..1) vị thế ký quỹ ở giá thị trường (Tâm lý yếu): cùng giá ra + tự đẩy như `dong`, lãi vay theo phần. */
  const dongMot = (k: number, g: number, phan: number) => {
    const can0 = Math.max(1, Math.floor(dangCam() * phan));
    const them = dayLenh(k, ch === 1 ? -1 : 1, can0 * heTb());
    const gRa = g * (1 - (ch * truot * kBanManh(heTb(), false)) / 10000) * (1 - ch * them), tb = tbKhop();
    let can = can0, tien = 0, lai = 0;
    for (const y of lo) {
      if (can <= 0) break;
      const t = Math.min(y.con, can);
      if (t > 0) { lai += laiVi(t, y.khop, gRa, ch, y.he!) - laiVayGop(t, vayX(y), pct, nenGiu(y, k)); y.con -= t; tien += t; can -= t; }
    }
    ra.push({ tien, ra: gRa, nhip: k, lai, tbVao: tb, lyDo: 'tam_ly_yeu' });
  };
  /** D528 — lệnh kê chiều `ben` khớp NGAY BÂY GIỜ thì làm gì: Đòn Bẩy mua = mở ×L · bán = chốt / bán khoản giữ; Bán Khống bán = mở khống ×L · mua = mua lại. */
  const vaiTroKe = (ben: 'mua' | 'ban'): LenhKe['vt'] => {
    if (db.thanhLy) return null;
    if (dangCam() > 0) return (ben === 'mua') === (ch === -1) ? 'chot' : null;
    if (lo.length || kg) return ben === 'ban' && ch === 1 && kg && kg.con > 0 && !lo.length ? 'ban_giu' : null;
    return ch === 1 ? (ben === 'mua' ? 'mo' : 'ban_giu') : ben === 'ban' ? 'mo' : null;
  };
  const khopKe = (k: number, g: number) => keS.quet(k, (ben, b) => {
    if (ben === 'mua' ? g > b.gia : g < b.gia) return 'cho';
    if (ben === 'mua' ? gopTai(k).trangBan : gopTai(k).trang) return 'cho';
    const vt = vaiTroKe(ben);
    if (!vt) return keS.choMoKia(ben, vaiTroKe) ? 'cho' : 'huy';
    if (vt === 'mo') {
      chuyenKhoan(k, b.gia);   // D561
      lo.push({ tien: vonKq, con: vonKq, khop: b.gia, nhip: k, s: sCua(k), bung: false, loai: 'ke', he: b.L });
      db.L = db.L0 = b.L;
    } else if (vt === 'chot') dongGia(k, b.gia);
    else banGiu(k, b.gia, kg ? kg.con : p.von, 'ke_lenh');
    return vt;
  });
  const xetTly = (k: number, g: number) => {
    if (!p.tamLyYeu || tly || db.thanhLy) return;
    const giuNguyen = !lo.length && !kg;
    const pnl = giuNguyen ? floorTien(p.von * (g / giaDau - 1)) : (dangCam() > 0 ? laiNay(k, g) : daChot()) + truoc() + (kg ? laiVi(kg.con, giaDau, g, 1, 1) : 0);
    if (pnl > -(p.von * TAM_LY_YEU.NGUONG_BP) / 10000) return;
    if (dangCam() > 0) { if (chanDong(k)) return; dongMot(k, g, TAM_LY_YEU.BAN_BP / 10000); }
    else if (giuNguyen || (kg && kg.con > 0)) { if (gopTai(k).trang) return; banGiu(k, g * (1 - truot / 10000), Math.max(1, Math.floor(((kg ? kg.con : p.von) * TAM_LY_YEU.BAN_BP) / 10000)), 'tam_ly_yeu'); }
    else return;
    tly = { nhip: k };
  };
  const xuLy = (l: LenhMan, k: number, g: number) => {
    if (xong()) return;
    const n = l.nut;
    if (n.startsWith(nutVao)) {
      const L = Number(n.slice(nutVao.length));
      if (lo.length || kg || !mucDonBay(p, ch).includes(L)) return;   // D561 — Bán Khống ×2 ở khoá v65   // D528 — khoản giữ đã bán dở (Tâm lý yếu) ⇒ không vào ký quỹ chồng lên
      if (chanVao(k)) { hut.push({ nhip: k, ben: benVao }); return; }
      chuyenKhoan(k, g);   // D561 — khoá khoản theo đường: khoản đổi sang ký quỹ ở giá lúc bấm
      const them = dayLenh(k, ch, vonKq * L);   // D499 — vào ×L đẩy giá theo GIÁ TRỊ vị thế (D510: khống đẩy xuống)
      lo.push({ tien: vonKq, con: vonKq, khop: g * (1 + (ch * truot) / 10000) * (1 + ch * them) * truotThac(p.min, k, ch), nhip: k, s: sCua(k), bung: dangBung(chay, ng, k), loai: 'het', he: L });
      db.L = db.L0 = L;
    } else if (n.startsWith('tang_x')) {
      const MUC = mucDonBay(p, ch), ke = Number(n.slice(6)), i = MUC.indexOf(db.L);
      if (!dangCam() || i < 0 || MUC[i + 1] !== ke || dangGoi(g, k)) return;   // founder 03/10 (B): đang bị gọi thì KHÔNG tăng
      if (chanVao(k)) { hut.push({ nhip: k, ben: benVao }); return; }
      const laiTang = laiNay(k, g);
      const them = dayLenh(k, ch, vonKq * (ke - db.L));
      lo.push({ tien: vonKq, con: vonKq, khop: g * (1 + (ch * truot) / 10000) * (1 + ch * them) * truotThac(p.min, k, ch), nhip: k, s: sCua(k), bung: dangBung(chay, ng, k), loai: 'tang', he: ke - db.L, them: true });
      db.tang.push({ nhip: k, tu: db.L, len: ke, khiLoi: laiTang >= 0 });
      db.L = ke;
    } else if (n.startsWith('nap_')) {
      const ma = n.slice(4), cl = con[ma] ?? 0, m = MA_MINIGAME[ma], tien = ma === MA_TIEN_MAT;
      if (!dangCam() || !db.daGoi || (!m && !tien)) return;
      const lay = Math.min(Math.floor(p.von * NAP_TY_LE), cl);
      if (lay <= 0) return;
      const phi = tien ? 0 : floorTien((lay * (m!.truot + PHI_BAN_BP)) / 10000);   // D507 — Tiền mặt không phí bán
      con[ma] = cl - lay;
      db.nap.push({ ma, lay, phi, nhan: lay - phi, nhip: k, luc: dangGoi(g, k) ? 'goi' : 'chu_dong' });
      db.napNhan += lay - phi;
    } else if (n === 'ban_het') {
      /*
       * D507 (founder 04/10: "làm như ngoài đời. Bán vào để đỡ đòn bẩy nhưng nếu vẫn ko cắt lỗ thì margin call và mất phần vay + lãi" · "BÁN HẾT dồn cả
       * Tiền mặt") — chỉ khi đang bị gọi: MỌI khoản nguồn còn lại bán TRỌN ở giá biểu đồ của nó (trừ phí) ⇒ dồn vào ký quỹ. Vị thế VẪN MỞ; trần lỗ nới
       * theo ký quỹ ⇒ bị thanh lý về sau là mất cả phần dồn vào. Vai lớn: cú bán đẩy giá mã của khoản (đè lên ghế khác cùng mã — quyết toán cả bàn).
       */
      if (!dangGoi(g, k) || db.banHet !== null) return;
      for (const [ma, cl] of Object.entries(con)) {
        if (cl <= 0) continue;
        const tien = ma === MA_TIEN_MAT, m = MA_MINIGAME[ma];
        if (!tien && !m) continue;
        const giaTri = tien ? cl : floorTien(cl * (p.giaKhoan?.(ma, k) ?? 1));
        const phi = tien ? 0 : floorTien((giaTri * (m!.truot + PHI_BAN_BP)) / 10000);
        con[ma] = 0;
        db.nap.push({ ma, lay: cl, phi, nhan: giaTri - phi, nhip: k, luc: 'ban_het' });
        db.napNhan += giaTri - phi;
        if (!tien && p.tuDayVai && giaTri > 0) {
          const hs = TU_DAY.CO_SO * p.tuDayVai * m!.liq, nr = p.rai ?? 0;
          const mag = -(hs * Math.sqrt(giaTri / TU_DAY.VON_CHUAN)) / (nr ? Math.sqrt(nr) : 1);   // D506 — cùng luật căn bậc hai với `dayLenh`
          (db.xungKhoan[ma] ??= []).push({ nhip: k, mag, trai: nr * NHIP_MOI_NEN_GOP });
        }
        if (db.banHet === null) db.banHet = k;
      }
    } else if (n === nutDong) {
      if (!dangCam()) return;
      if (chanDong(k)) { hut.push({ nhip: k, ben: benDong }); return; }
      if (dangGoi(g, k)) db.catKhiGoi = true;
      dong(k, g);
    }
  };

  const ds = [...p.lenh].filter((l) => Number.isInteger(l.nhip) && l.nhip >= cua.tu && l.nhip < cua.den && l.nhip < SO_NHIP && x.nut.includes(l.nut))
    .sort((a, b) => a.nhip - b.nhip || a.seq - b.seq);
  const den = Math.min(SO_NHIP - 1, p.denNhip ?? SO_NHIP - 1), nv = cua.den < SO_NHIP;
  let i = 0;
  keS.datTruoc(den);   // D528
  for (let k = 0; k <= den; k++) {
    const g = gia(k);
    if (dangCam() > 0) {
      if (cham(g, nguong(KY_QUY.THANH_LY, k))) {   // SÀN thanh lý: bán (khống: MUA) cưỡng bức ở giá nhịp này (demo `dongVT(1, 'thanh_ly')`)
        db.thanhLy = { nhip: k, gia: g };
        db.rutChan = chay[Math.floor(k / NHIP_MOI_NEN)]!.rut === -1;
        dong(k, g, 'thanh_ly');
      } else if (cham(g, nguong(KY_QUY.GOI, k))) db.daGoi = true;
    }
    xetTly(k, g);   // D528
    for (; i < ds.length && ds[i]!.nhip === k; i++) xuLy(ds[i]!, k, g);
    keS.dat(k, g);   // D528
    if (db.thanhLy || k >= cua.den) keS.huyHet('khoa'); else if (k >= cua.tu) khopKe(k, g);
    // D486 — NÓNG VỘI: tới mốc thì tự chốt (giá + nến của nhịp ngay trước mốc).
    if (nv && k === cua.den - 1 && dangCam() > 0 && p.denNhip === undefined) dong(k, gia(k), undefined, { cuoiKhoa: chanDong(k), nongVoi: true });
  }
  const v59 = (): Partial<KetQuaMan> => ({ ...(keS.coTrait ? { ke: keS.ra() } : {}), ...(tly ? { tly } : {}), ...(kg ? { khoanGiu: { ...kg } } : {}) });
  if (p.denNhip !== undefined) {
    if (dangCam() > 0 && !xong()) {
      const tu = den + 1, goi: number[] = [], thanhLy: number[] = [];
      for (let k = tu; k < SO_NHIP; k++) { goi.push(nguong(KY_QUY.GOI, k)); thanhLy.push(nguong(KY_QUY.THANH_LY, k)); }
      db.nguong = { tu, goi, thanhLy };
    }
    const conGiu = kg ? kg.con : 0;
    const tamTinh = (dangCam() > 0 && !db.thanhLy) || conGiu > 0
      ? (k: number) => tranLo((dangCam() > 0 ? laiNay(k, gia(k)) : daChot()) + truoc() + (conGiu > 0 ? laiVi(conGiu, giaDau, gia(k), 1, 1) : 0), p.von, db.napNhan) : undefined;
    return { ...rong, theoLenh: rong.giu, vao: lo, ra, hut, db, xungBan: xung, ...(tamTinh ? { tamTinh } : {}), ...v59() };
  }
  if (lo.length === 0 && !kg) return { ...rong, tuDong: true, hut, nhan: ['giu_suot'], db, ...v59() };
  if (dangCam() > 0) dong(SO_NHIP - 1, gia(SO_NHIP - 1), undefined, { cuoiKhoa: ch === 1 ? !!ng[ng.length - 1]!.trang : !!ng[ng.length - 1]!.trangBan });
  if (kg && kg.con > 0) {   // D528 — phần khoản giữ còn lại: vẫn là giữ ⇒ giá cuối, không trượt
    ra.push({ tien: kg.con, ra: rong.giaCuoi, nhip: SO_NHIP, lai: laiVi(kg.con, giaDau, rong.giaCuoi, 1, 1), tbVao: giaDau, tuDongCuoi: true, giu: true });
    kg.con = 0;
  }
  const tho = ra.reduce((a, y) => a + y.lai, 0), theoLenh = tranLo(tho, p.von, db.napNhan);
  const n: string[] = db.L0 ? [`${ch === 1 ? 'db' : 'bk'}_x${db.L0}`] : [];   // D510 — Bán Khống: `bk_x<L>` · D528: chỉ bán khoản giữ ⇒ không mức
  if (db.tang.length) {
    n.push('tang_don_bay');
    if (db.tang.some((y) => !y.khiLoi)) n.push('gap_thep_khi_lo');
    if (db.tang.some((y) => y.khiLoi)) n.push('nhoi_khi_loi');
  }
  if (db.nap.some((x) => x.luc !== 'ban_het')) n.push('pha_quy_du_phong', 'ban_tai_san_nap');
  if (db.banHet !== null) n.push('ban_het_vao_ky_quy');   // D507
  if (db.catKhiGoi) n.push('cat_khi_goi');
  if (db.thanhLy) n.push(db.nap.length ? 'nap_roi_van_mat' : 'bi_thanh_ly');
  if (db.rutChan) n.push('thanh_ly_vi_rut_chan');
  if (db.daGoi && !db.nap.length && !db.catKhiGoi && !db.thanhLy) n.push('gong_qua_cu_goi');
  const kq: KetQuaMan = { ...rong, loi: theoLenh - (rong.giu - rong.loi) + db.napNhan, theoLenh, chamTran: theoLenh !== tho, vao: lo, ra, hut, nhan: n, db, xungBan: xung, ...v59() };
  kq.nhan = [...kq.nhan, ...nhanV59(kq)];
  return kq;
}

/**
 * D528 — LỆNH KÊ (trait KÊ MUA / KÊ BÁN): mỗi chiều một lệnh giới hạn ở MỘT mức giá. Đặt / dời bằng cú `ke_mua` · `ke_ban` (kèm `gia_bp` so với giá mở
 * màn, `L` cho lệnh mở ký quỹ), huỷ bằng `ke_huy_mua` · `ke_huy_ban`. Mua phải nằm DƯỚI giá đang chạy, bán TRÊN (cú sai bị bỏ qua). Đã khớp thì thôi dời.
 * Mỗi nhánh khớp tự quyết VAI TRÒ lúc khớp (`quet` gọi lại nhánh) — bộ này chỉ giữ sổ lệnh.
 */
function taoKe(p: { lenh: readonly LenhMan[]; ke?: { mua?: true; ban?: true }; min: readonly NenMin[] }, giaDau: number) {
  const coTrait = !!(p.ke?.mua || p.ke?.ban);
  const ke: { mua?: LenhKe; ban?: LenhKe } = {};
  const ds = coTrait ? [...p.lenh].filter((l) => Number.isInteger(l.nhip) && l.nhip >= -1 && l.nhip < SO_NHIP && (NUT_KE as readonly string[]).includes(l.nut))
    .sort((a, b) => a.nhip - b.nhip || a.seq - b.seq) : [];
  let i = 0;
  const chay = chayCua(p.min);
  const xuLy = (l: LenhMan, k: number, g: number) => {
    const ben: 'mua' | 'ban' = l.nut.endsWith('mua') ? 'mua' : 'ban';
    if (!p.ke?.[ben]) return;
    const cu = ke[ben], song = !!cu && !cu.huy && cu.khop === null;
    if (l.nut.startsWith('ke_huy_')) { if (song) cu!.huy = 'nguoi_huy'; return; }
    if (cu && !cu.huy && cu.khop !== null) return;   // đã khớp: thôi dời
    const bp = Math.trunc(Number(l.gia_bp));
    if (!Number.isFinite(bp) || Math.abs(bp) > KE_LENH.TRAN_BP) return;
    const gia = giaDau * (1 + bp / 10000);
    if (!(gia > 0) || (ben === 'mua' ? gia >= g : gia <= g)) return;   // mua dưới giá đang chạy, bán trên
    const L = (MUC_DON_BAY as readonly number[]).includes(Number(l.L)) ? Number(l.L) : MUC_DON_BAY[0];
    ke[ben] = { gia, L, dat: song ? cu!.dat : k, sua: song ? cu!.sua + 1 : 0, khop: null, vt: null, huy: null };
  };
  return {
    coTrait,
    /** Cú đặt trong đếm ngược (nhịp −1): so với GIÁ MỞ màn. */
    datTruoc(den: number) { void den; for (; i < ds.length && ds[i]!.nhip < 0; i++) xuLy(ds[i]!, -1, giaDau); },
    /** Cú đặt / dời / huỷ ở nhịp k (giá đang chạy `g`). */
    dat(k: number, g: number) { void chay; for (; i < ds.length && ds[i]!.nhip === k; i++) xuLy(ds[i]!, k, g); },
    /** Mỗi lệnh còn sống: nhánh trả 'cho' (chưa khớp) · 'huy' (lõi không làm được chiều này) · vai trò đã khớp. */
    quet(k: number, f: (ben: 'mua' | 'ban', b: LenhKe) => 'cho' | 'huy' | 'mo' | 'chot' | 'ban_giu') {
      for (const ben of ['mua', 'ban'] as const) {
        const b = ke[ben];
        if (!b || b.huy || b.khop !== null) continue;
        const r = f(ben, b);
        if (r === 'cho') continue;
        if (r === 'huy') { b.huy = 'khong_hop'; continue; }
        b.vt = r; b.khop = k;
      }
    },
    /** Chiều kia đang chờ MỞ vị thế ⇒ lệnh này kê sẵn làm CHỐT: chờ, đừng huỷ. */
    choMoKia(ben: 'mua' | 'ban', vaiTro: (b: 'mua' | 'ban') => LenhKe['vt']) {
      const kia = ke[ben === 'mua' ? 'ban' : 'mua'];
      return !!kia && !kia.huy && kia.khop === null && vaiTro(ben === 'mua' ? 'ban' : 'mua') === 'mo';
    },
    huyHet(ly: string) { for (const ben of ['mua', 'ban'] as const) { const b = ke[ben]; if (b && !b.huy && b.khop === null) b.huy = ly; } },
    ra(): { mua?: LenhKe; ban?: LenhKe } { return { ...(ke.mua ? { mua: { ...ke.mua } } : {}), ...(ke.ban ? { ban: { ...ke.ban } } : {}) }; },
  };
}

/** D528 — nhãn hành vi của trait v59 (id, chữ ở client): lệnh kê đã khớp · Tâm lý yếu bán tháo. */
function nhanV59(kq: KetQuaMan): string[] {
  const n: string[] = [];
  if (kq.ke?.mua?.khop != null) n.push('ke_mua_khop');
  if (kq.ke?.ban?.khop != null) n.push('ke_ban_khop');
  if (kq.tly) n.push('tam_ly_yeu_ban');
  return n;
}

/** Nhãn hành vi nhánh Bắt Đáy (demo `nhanHanhVi`) — id, chữ ở client. Nhãn tin / tự đẩy / đội lái chờ #2 · #7. */
/** D511 — nhãn hành vi Mua Đuổi (demo `nhanHanhVi` nhánh mua_duoi) — id, chữ ở client. Hành vi chính đo: CÁCH RA LỆNH. */
function nhanMuaDuoi(kq: KetQuaMan, ng: readonly NenGop[]): string[] {
  if (kq.tuDong) return ['giu_suot'];
  const n: string[] = [], cuoi = ng.length - 1, ban = kq.ra.filter((x) => !x.tuDongCuoi && !x.lyDo);
  const sauRa = (nhip: number) => ng.slice(Math.min(cuoi, Math.floor(sCua(nhip)) + 1));
  if ((kq.vao[0]?.chuoi ?? 0) >= 4) n.push('duoi_muon');
  if (kq.vao.slice(1).some((e) => e.s >= kq.iDinh - 3 && e.s <= kq.iDinh)) n.push('nhoi_sat_dinh');
  for (const b of ban) {
    const sau = sauRa(b.nhip);
    if (!sau.length) continue;
    if (Math.abs(sCua(b.nhip) - kq.iDinh) <= 2) n.push('chot_sat_dinh');
    else if (b.ra > b.tbVao && Math.max(...sau.map((c) => c.h)) > b.ra * 1.08) n.push('chot_som');
  }
  const muaToiDinh = kq.vao.filter((e) => e.s <= kq.iDinh).reduce((a, e) => a + e.tien, 0);
  const banToiDinh = ban.filter((x) => sCua(x.nhip) <= kq.iDinh + 3).reduce((a, x) => a + x.tien, 0);
  if (muaToiDinh > 0 && (muaToiDinh - banToiDinh) / muaToiDinh >= 0.4 && kq.giaCuoi < kq.dinh * 0.9) n.push('om_qua_dinh');
  return n.length ? [...new Set(n)] : ['khong_ro'];
}

function nhanBatDay(kq: KetQuaMan, ng: readonly NenGop[]): string[] {
  if (kq.tuDong) return ['giu_suot'];
  const n: string[] = [], K = 1, cuoi = ng.length - 1;
  const sauRa = (nhip: number) => ng.slice(Math.min(cuoi, Math.floor(sCua(nhip)) + 1));
  if (kq.vao.some((e) => e.bung)) n.push('fomo');
  if (kq.vao.some((e) => !e.bung && e.s >= kq.iDay - K && e.s <= kq.iDay + 2 * K)) n.push('kien_nhan');
  if (kq.vao.some((e) => e.s < kq.iDay - 3 * K && e.khop > kq.day * 1.08 && !e.bung)) n.push('bat_dao_roi');
  for (const b of kq.ra.filter((x) => !x.tuDongCuoi)) {
    const sau = sauRa(b.nhip);
    if (!sau.length) continue;
    if (b.ra < b.tbVao && Math.max(...sau.map((c) => c.h)) > b.tbVao) n.push('hoang_ban_day');
    else if (b.ra < b.tbVao && Math.min(...sau.map((c) => c.l)) < b.ra * 0.95) n.push('cat_lo_kip');
  }
  if (kq.hut.length) n.push(kq.hut.some((x) => x.ben === 'mua') ? 'ban_hut_trang_mua' : 'mua_hut_trang_ban');
  return n.length ? [...new Set(n)] : ['khong_ro'];
}

/**
 * BOT BẮT ĐÁY (`BOT_BAT_DAY`, NHÁP) — tất định, chỉ đọc nhịp đã qua: từ nhịp `TU_NHIP`, giá ≤ đỉnh đã qua × (1 − `NGUONG_RUT`) và nến gộp không
 * trắng bên bán ⇒ VÀO HẾT; tới `MUON_NHAT` chưa vào ⇒ vào ở nhịp không trắng đầu tiên từ đó; giữ tới cuối (tự chốt).
 */
export function lenhBotBatDay(min: readonly NenMin[], cuaSo: { tu: number; den: number } = { tu: 0, den: SO_NHIP },
  /** D561 — khoá `khoanTheoDuong`: VÀO cần tiền ⇒ BÁN BỚT ở nhịp đầu cửa sổ rồi mới chờ đáy. */ banTruoc = false,
  /** D589 — khoá v70: gom 3 phần theo mức rút (`BOT_BAT_DAY_BA_PHAN`) thay một cú VÀO HẾT. */ baPhan = false): LenhMan[] {
  const chay = chayCua(min), ng = gop(chay);
  if (baPhan) {
    // D589 — bán HẾT khoản giữ trước (đủ số cú BÁN BỚT của cấp cao nhất — cú thừa không làm gì), rồi gom phần n khi rút ≥ ngưỡng n hoặc tới mốc muộn.
    const ds: LenhMan[] = [];
    const tu0 = Math.max(BOT_BAT_DAY.TU_NHIP, cuaSo.tu), muon0 = Math.min(BOT_BAT_DAY.MUON_NHAT, cuaSo.den - 1);
    if (banTruoc) for (let i = 0; i < BAN_BOT_LAN.KHONG_RAI + 2; i++) ds.push({ seq: ds.length + 1, nhip: Math.max(0, cuaSo.tu), nut: NUT_BAN_BOT });
    let dinh0 = min[NEN_LS * K_MIN - 1]!.c, phan = 0;
    for (let k = 0; k < cuaSo.den && phan < 3; k++) {
      const g = giaTai(chay, k);
      dinh0 = Math.max(dinh0, g);
      if (k < tu0 || ng[Math.floor(k / NHIP_MOI_NEN_GOP)]!.trangBan) continue;
      if (k >= muon0 || g <= dinh0 * (1 - BOT_BAT_DAY_BA_PHAN.NGUONG_RUT[phan]!)) { ds.push({ seq: ds.length + 1, nhip: k, nut: 'vao' }); phan += 1; }
    }
    return ds;
  }
  // D486 — bot mang KIÊN NHẪN / NÓNG VỘI đặt lệnh TRONG cửa sổ của nó (sớm nhất ở mốc mở khoá, muộn nhất trước mốc tự chốt).
  const tu = Math.max(BOT_BAT_DAY.TU_NHIP, cuaSo.tu), muon = Math.min(BOT_BAT_DAY.MUON_NHAT, cuaSo.den - 1);
  let dinh = min[NEN_LS * K_MIN - 1]!.c;
  for (let k = 0; k < cuaSo.den; k++) {
    const g = giaTai(chay, k);
    dinh = Math.max(dinh, g);
    if (k < tu || ng[Math.floor(k / NHIP_MOI_NEN_GOP)]!.trangBan) continue;
    if (k >= muon || g <= dinh * (1 - BOT_BAT_DAY.NGUONG_RUT)) {
      return banTruoc ? [{ seq: 1, nhip: Math.max(0, cuaSo.tu), nut: NUT_BAN_BOT }, { seq: 2, nhip: k, nut: 'vao_het' }] : [{ seq: 1, nhip: k, nut: 'vao_het' }];
    }
  }
  return [];
}
