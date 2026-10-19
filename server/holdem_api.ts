/**
 * MARKET HOLD'EM — API (/api/v1/holdem/*). Lát 1.
 *
 * MÔ HÌNH: chơi THEO VÒNG, server là chân lý (C4). Client nộp quyết định của
 * một vòng → server replay engine từ action_log → trả trạng thái mới. Client
 * KHÔNG mô phỏng gì.
 *
 * KHÔNG GIỮ STATE: mỗi request dựng lại trận từ `action_log`. Đắt hơn giữ RAM
 * một chút nhưng loại hẳn hai lớp bug — state trôi lệch khỏi log, và state mất
 * khi serverless cold start.
 *
 * ─── D25/R1 — BỐI CẢNH ĐỐI THỦ ─────────────────────────────────────────────
 * Response của mỗi vòng LUÔN kèm `doi_thu[]` (bậc rank, loại người/bot, vốn,
 * còn sống). Event `hd_cam_ket` ghi ĐÚNG mảng đó. Nhờ vậy bất biến
 * `R1-logged ⊆ API-đã-gửi` đúng ở tầng server — phần còn lại (UI phải render
 * vô điều kiện, không accordion) là nghĩa vụ frontend, ghi ở
 * docs/ui-ux/market_holdem_ui_directives.md mục 7.
 *
 * ─── TƯỜNG LỬA ─────────────────────────────────────────────────────────────
 * Không endpoint nào ở đây đọc/ghi users.bankroll hay quest_points, không
 * import config/economy, không chạm ledger. `holdem_firewall.test.ts` khoá.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import {
  BANG_DIEN_TU,
  CAP_STACK_BP, CHIEN_THUAT, DAO_DANH_MUC, DONG_HO, DONG_HO_MINIGAME, GIAI_DOAN, HOLDEM_BALANCE_VERSION,
  HOLDEM_DECISIONS, HOLDEM_MATCH, HOLDEM_VERSION, KHOA_TAI_SAN,
  CONG_HUONG, CONG_HUONG_V20,
  MAX_BAN_SAO, mtKeTiep, SU_KIEN, XUNG_DOT, XUNG_DOT_V19,
  KHAU_VI, KHAU_VI_MAC_DINH, LAI_SUAT_NEN, laiSuatDaiBp, LICH_CHINH_SACH, MANDATE_TO_CHUC, NAV_V10, QUAN_TINH, SUC_CANG, TAI_SAN, fxCuaGhe, khauViCua, loaiTheVong, luatCua, moiTruongTienTe,
  soGheTuSeed, soLanCatLo, SO_GHE_MIN, SO_GHE_MAX, SO_GHE_TRAN_TRAN, BO_LUAT_THEO_PHIEN_BAN,
  DAC_QUYEN, SO_THE_CHIEN_THUAT, giaMoBang, nhipChonBai, vongChonChienThuat, coManMinigame, giayManMinigame, giayChonLa, doiLoiToiDa,
  KY_NGO, NHIEM_VU_KY_NGO, boNhiemVuMoi, boNhiemVuTheoHoi, laVongKyNgo,
  type BoLuatCanBang, type DacQuyenKyNgoId, type KhauViId, type NhiemVuId,
  seedManTap, laSeedManTap, laSeedManTapCoDinh, SEED_MAN_TAP_MOI_THOI, soOManTap,
  boMaTranCua, laiTietKiemBp, TIET_KIEM, LAI_VAY_DON_BAY,
  tongXuGiai,
} from '../config/holdem.js';
import {
  chonKyNgoBot, dacQuyenKyNgo, doiPhaCuaMap, ongKinhVong, phieuConLai,
  themGiayKyNgo, tienTrinhKyNgo,
  type LanKyNgo, type OngKinh, type VongKyNgo,
} from './holdem/ky_ngo.js';
import { chuongHoi } from './holdem/chuong_hoi.js';
import { ngayVN, phanVi } from './holdem/ban_ngay.js';
import { dauMocCuaTran } from './holdem/dau_moc.js';
import { maThamGia } from './holdem/ma_tham_gia.js';
import {
  PHONG_CACH_DAU_HANG, chamPhongCach, duVongDeCoHang, hangCua, khoaTheoThuHang, quyVeThangChuan,
  type KetQuaPhongCach, type VongPhongCach,
} from './holdem/phong_cach.js';
import { VAI, VAI_TAT_CA, bocThamVai, bocThamVaiTheoCoBan, bocThamVaiXacSuat, type VaiId } from './holdem/vai.js';
import { dungBachKhoa } from './holdem/bach_khoa.js';
import type { KhauViVong } from './hanh_vi/trai.js';
import {
  capNhatCuaUser, docVongCuaTran, docVongCuaUser, dungHanhViTran, dungTranCu,
  hoSoTheoGoi, type Deps as HanhViDeps, type HangHanhVi, type HangTran, type HoSoGoi,
} from './hanh_vi/kho.js';
import { chamNangLucTran, gopNangLuc } from './holdem/nang_luc.js';
import { tinhTinHieu } from './hanh_vi/tin_hieu.js';
import { laUuid } from './uuid.js';
import {
  apPhiMoBang, coDuMoBang, dungBangDienTu, hangBangCua, phiMoBang, soLanMoBang, thanhKhoanCongKhai,
  type HangBang,
} from './holdem/bang_dien_tu.js';
import {
  daKetThuc, giaiQuyetVong, taoTran, xepHang,
  apDaoDanhMuc, apDatShort, apHuyTietKiem, apKhoaTaiSan, apMoTietKiem, biGiamVon,
  doiTuThe, duocChonBai, mocKipCua, tatToanKhiDongTran, tongTietKiem,
  dongTienThoCua,
  heSoTacDongGia,
  mandateCua,
  allInMoCho, coLuotLoi, maxLoiCua, soLoiMoAllIn, apLenhMocNav, apLenhVongNav, khoaDangChay, phiLenhCua, khoaKipChot, laVongChotKhoa, maxTaiSanCua, shortKhopO, soOChienThuat, tyLeCua,
  tuyChonLenhV55, tuyChonLenhGhe,
  oDoiCua,
  vonDauCua, vaiTheoLuat,
  daDangCua,
  vongDaLat, iLaBaoTruoc,
  soVong, oVongUp, laiSuatThayDuoc, boiCanhUpCua, nenVongCua, conCuoc,
  type BoiCanhCuoc, type Ghe, type GheMoi, type HanhDongVong, type LoiDao,
  type LoiKhoa, type LoiShort, type LoiTietKiem, type TrangThaiTran,
  viKhaoSat, ghiViKhaoSat, chiPhiKhaoSat,
} from './holdem/engine.js';
import type { BacId } from '../config/rank.js';
import { BAC_BOT, bacVaoBanChoNguoi, ghiDiemPve, ghiDiemTran, nhanBacNgan } from './rank.js';
import { THONG_BAO_CAN_NGUOI, ghepBanBat } from '../config/rank_ghep.js';
import { ghiKetQuaVaoBan, ghiTranVaoBan, layBanDangChoi, vaiChoGheNguoi } from './rank_ghep.js';
import type { LoaiHanhDong } from './holdem/cuoc.js';
import { rngAt } from './sandbox/rng.js';
import { oCongKhai, sinhMap, thanhPhanCongKhai, THU_TU_MA_SUC_CANG, type OThiTruong } from './holdem/map.js';
import { dungHoSo, type HoSoTinhCach, type VongInsight } from './holdem/insight.js';
import { daiSucCang } from './holdem/nav.js';
import { apMocTraitCaBan, boiCanhLenhGhe, boiCanhLenhVong } from './holdem/nhip_lenh_bot.js';
import {
  RANG_BUOC_TRONG, bayTrait, canHopLe, giaCuon, khoTraitCua, laMocTrait, rangBuocCua, traitHieuLuc, type SuKienMocTrait,
} from './holdem/trait.js';
import { CHO_TRAIT, TRAIT_IDS, type TraitId } from '../config/trait.js';
import { LUA } from '../config/lua.js';
import { LUOT_SONG_MOI } from '../config/luot_song.js';
import { LOI_BI_CAT, coBanGhim } from '../config/luoc_bo.js';
import { NGAN_HANG_DO_VO } from '../config/tiet_kiem_kinh_te.js';
import { laiSuatLuc, maVaoGia, sucCangLuc, tinBiChe, vongXetVaoGia, type MatXich } from './holdem/engine.js';
import { khoanhKhacCuaTran, soTayKhaiNiem } from './holdem/khoanh_khac.js';
import { soLienHe } from './holdem/lien_he.js';
import {
  bayShop, canhBaoXungDot, capThe, muaCaVong, KHONG_TRAN, tuyChonShop, type TranMoiVong,
} from './holdem/shop.js';
import { dungTuDien } from './holdem/tu_dien.js';
import { navCua, soDoiThuThay, type LoiLenh } from './holdem/nav.js';
import { NUOC_HET_GIO, soiDongHo, themGiayTrait, tranHetHan } from './holdem/dong_ho.js';
import {
  BOT_CHOI_DUOC, BOT_V1_DONG_BANG, botTaiCoCau, lenhBotNav, timBot, type BoiCanh,
} from './holdem/bots.js';
import { consumeLimit } from './auth/rate_limit.js';
import { stream } from 'hono/streaming';
import { CUA_SO_LENH_MS, DONG_TOI_DA_MS, HE_SO_LOI, KE_LENH, K_MIN, NHIP_MOI_NEN, PHI_LS_BP, PHI_TIN_SOM_BP, NEN_LS, NUT_GAI, NUT_KE, PHI_GAI_BP, TRAIT_MAN, LO_NHIP_MS, MINIGAME_DONG_GIA_VERSION, NUT_LOI, SO_NHIP, TIEN_TO_CHON_LA, TRAN_LENH_MOI_MAN, MUC_DON_BAY, NAP_TY_LE, MA_MINIGAME, PHI_BAN_BP } from '../config/minigame.js';
import {
  CHAY_MS, DEM_MS, boiCanhMan, dungDongMan, dungDongManDu, kiemNhipLenh, lichSuMan, loNhip, nhipMay,
  type BoiCanhMan, type KetQuaNhip, type LyDoKhongMan, duongPhuCua, bcCuaMa, lenhXemMa } from './holdem/minigame/man.js';
import { nhipLoTin, tinChoGhe, tinDayDu } from './holdem/minigame/tin.js';
import { NGUON_TIN } from '../config/minigame_tin.js';
import { cuaSoTrait, daMuaTin, gaiCuaMan, ketQuaMan, laCuaMan, MA_TIEN_MAT, mucDonBay, NUT_BAN_BOT, NUT_VAY_X2, luongBanBot, nutLoiCua, tienPhanVao, type KetQuaDonBay, type KetQuaMan, type LenhKe, type LenhMan, type XungBan } from './holdem/minigame/khop.js';
import { laLoiKyQuy } from './holdem/minigame/tien.js';
import { khoiLuongChay, soiGiaTri, soiTai, type NenMin, type SoiLo, type VtDamDong, type XungLon, type XungTl } from './holdem/minigame/dong_gia.js';
import { apMg, boiCanhCuaGhe, boiCanhNguoi, dungDongManKhop, dungDongManNhin, duongNhieuNhin, duongPhuNhin, thamSoKhop, tinhMgCaBan, type KetQuaManGhe, type MgVong } from './holdem/minigame/quyet_toan.js';
import { currentSeasonId } from './season.js';
import { ART } from './holdem_art.js';
import type { SessionActor } from './auth/session.js';
import { laTester } from './admin_bao_mat.js';
import { createHash } from 'node:crypto';
import { HetSuatNgay, hoiLaiSauHetNgay, mienSuat, tranNgayHieuLuc, trongLuoiNgay } from './suat_tran.js';
import { BUOI_DO, DE_DANG_DUNG, deCua } from '../config/holdem_de.js';
import { CONSENT_PHIEN_BAN, laConsentHienHanh } from '../config/pfm_consent.js';
import { PFM } from '../config/pfm.js';
import { NANG_LUC_FORMULA_VERSION, NANG_LUC_HIEN, chiNangLucHien } from '../config/nang_luc.js';
import { docNghienCuuHieuLuc } from './nghien_cuu.js';

import type { Env, Mw as Middleware } from './http/types.js';

const GIOI_HAN = {
  TAO_MOI_GIO: 30,
  VONG_MOI_GIO: 240,
  /**
   * Mở Bảng điện tử: XÔ RIÊNG, không chung với `vong`.
   *
   * Chung xô là mỗi lần mở bảng ăn mất một lượt nộp vòng — người chơi dùng đúng
   * tính năng lại bị khoá đường chơi tiếp. Trần bằng nhau vì luật đã chặn ở
   * `TOI_DA_MOI_VONG` (≤1 lần thu phí mỗi vòng); xô này chỉ chống spam thô.
   */
  BANG_MOI_GIO: 240,
  /**
   * KHỚP LỆNH GIỮA VÒNG (founder 08/08): xô riêng, trần cao hơn `vong` vì một
   * vòng hợp lệ có thể khớp vài nhịp (bán → nhìn tiền về → mua). Chống spam
   * thô, không phải luật chơi — luật thật là kiểm tra lệnh ở tầng dưới.
   */
  KHOP_MOI_GIO: 480,
  /** D466 — mở màn + nối dòng nhịp: 10 màn/trận × vài lần nối lại; chống spam thô, mỗi lần nối là một function sống tới 45 s. */
  MG_NHIP_MOI_GIO: 600,
  /** D466 — cú bấm trong màn: trần mỗi màn đã chặn ở `TRAN_LENH_MOI_MAN`; xô này chặn spam thô qua nhiều trận. */
  MG_LENH_MOI_GIO: 1500,
  /**
   * B15 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — xem bàn `GET /holdem/ban/:ma`: client hỏi lặp 20 s/tab (`web/src/api/holdem.ts`
   * `refetchInterval: 20_000`) ⇒ 180 lượt/giờ một tab; 600 chừa hai–ba tab. Chống quét mã bàn thô, không phải luật chơi.
   */
  BAN_XEM_MOI_GIO: 600,
} as const;

class HoldemError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    public readonly code: string,
    message: string,
    /**
     * D342 — MÃ CHI TIẾT đi kèm (vd `{ ly_do: 'qua_tran_khong' }`), để client dựng chữ theo
     * D26 thay vì in mã thô trong `message`. Vắng ở mọi lỗi cũ ⇒ JSON trả về y như trước.
     */
    public readonly chiTiet?: Readonly<Record<string, string>>,
  ) { super(message); }
}

/**
 * D38 — MỘT CÂU TRẢ LỜI DUY NHẤT CHO "TRẬN NÀY HẾT HẠN RỒI".
 *
 * Hàm chứ không phải hằng: `Error` mang stack, dùng chung một thể hiện cho mọi
 * request là stack của người này hiện trong log của người kia.
 *
 * Mã lỗi `tran_het_han` tách hẳn khỏi `match_closed` là cố ý — hai chuyện khác
 * nhau với người chơi ("tôi đánh xong rồi" vs "tôi bỏ đó quá lâu"), và client
 * phải nói được câu thứ hai thay vì đổ cho lỗi mạng.
 */
/**
 * D38 — DỊCH nước hết giờ sang tên hành động của TẦNG VÒNG.
 *
 * `NUOC_HET_GIO.hanh_dong` là `'giu'` — tên chung của tầng đồng hồ, cố ý không
 * biết gì về từ vựng của engine. Ở tầng vòng nó là `'giu_vi_the'`; ở vòng CƯỢC nó
 * là "không gửi nước nào", và `replay` mặc định THEO — tức vẫn đứng trong quỹ
 * vòng chứ KHÔNG bỏ bài. Đó là `DONG_HO.HET_GIO_LA_GIU_NGUYEN`, không phải lựa
 * chọn của file này (A8.2): đổi sang "hết giờ là bỏ bài" là tự động cắt lỗ hộ
 * người chơi, một quyết định thiết kế nặng phải đi qua founder.
 *
 * `satisfies` chứ không phải một phép gán thường: ai đó đổi `NUOC_HET_GIO.hanh_dong`
 * mà quên chỗ này thì tsc đỏ ngay, thay vì im lặng rơi về `undefined` và biến mọi
 * vòng hết giờ thành `'giu_vi_the'` do trùng mặc định — đúng loại lỗi không ai thấy.
 */
const HANH_DONG_HET_GIO = {
  giu: 'giu_vi_the',
} as const satisfies Record<typeof NUOC_HET_GIO.hanh_dong, HanhDongVong['hanh_dong']>;

const LOI_TRAN_HET_HAN = () => new HoldemError(
  409, 'tran_het_han',
  `Trận này đã quá ${DONG_HO.HAN_TRAN_PHUT} phút không có nước đi nên đã đóng. `
  + 'Vào trận mới nhé.',
);

/**
 * `requireOnboarded` đã trả 403 khi userId null, nên tới đây chắc chắn có.
 * Hàm này chỉ biến bảo đảm ĐÃ CÓ của middleware thành KIỂU — không phải kiểm
 * tra thừa, và không dùng `!` để khỏi che mất bug thật nếu ai đó gỡ guard.
 */
function uid(actor: SessionActor): string {
  if (!actor.userId) {
    throw new HoldemError(403, 'not_onboarded', 'Bạn cần hoàn tất hồ sơ trước.');
  }
  return actor.userId;
}

/** Một dòng trong action_log. */
/**
 * D3 — chuẩn hoá bảng gắn từ payload client.
 *
 * Chỉ giữ cặp (id thẻ có thật, id mã có thật) và chỉ với thẻ `pham_vi:'tai_san'`.
 * Lọc ở TẦNG NHẬN chứ không chỉ lúc áp: `action_log` là nguồn dựng lại trận, nên
 * rác lọt vào log là rác vĩnh viễn — `events` append-only, không sửa lại được.
 */
function chuanHoaGan(x: unknown): Record<string, string> | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [the, ma] of Object.entries(x as Record<string, unknown>)) {
    if (typeof ma !== 'string') continue;
    const ct = CHIEN_THUAT.find((c) => c.id === the);
    if (!ct || ct.pham_vi !== 'tai_san') continue;
    if (!TAI_SAN.some((t) => t.id === ma)) continue;
    out[ct.id] = ma;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Id có thật trong bảng tài sản. Lọc ở TẦNG NHẬN — xem `chuanHoaGan`. */
const laMaThat = (x: unknown): x is string =>
  typeof x === 'string' && TAI_SAN.some((t) => t.id === x);

/**
 * LÕI VỐN A — chuẩn hoá cặp đảo danh mục từ body.
 *
 * Cùng lý do với `chuanHoaGan`: `action_log` LÀ nguồn dựng lại trận, nên một id
 * rác lọt vào là rác VĨNH VIỄN — `events` append-only, log không sửa lại được.
 * Hai id phải khác nhau: `tu === den` là lệnh rỗng mà vẫn thu phí chuyển đổi,
 * tức người chơi trả tiền cho một cú bấm không làm gì.
 */
function chuanHoaDao(x: unknown): { tu: string; den: string } | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const { tu, den } = x as { tu?: unknown; den?: unknown };
  if (!laMaThat(tu) || !laMaThat(den) || tu === den) return undefined;
  return { tu, den };
}

/** LÕI VỐN B — mã được khoá, chỉ nhận id có thật. */
function chuanHoaKhoa(x: unknown): string | undefined {
  return laMaThat(x) ? x : undefined;
}

/** D33 — mã bị SHORT (đặc quyền Phòng Hộ). Cùng lớp lọc với `chuanHoaKhoa`. */
function chuanHoaShort(x: unknown): string | undefined {
  return laMaThat(x) ? x : undefined;
}

/**
 * v43 (D314) — NGÂN HÀNG: lọc rác cho `tiet_kiem` của cú nộp vòng.
 *
 * ⚠ Lọc ở ĐÂY chứ không ở engine, cùng nếp `chuanHoaLenh`: engine nhận đầu vào đã sạch
 * nên nó chỉ phải lo LUẬT CHƠI (kỳ hạn có kịp không, gốc có đủ không), không phải lo
 * `so_vong` là một chuỗi hay `huy` là một object. Rác vào engine là rác vào `action_log`,
 * mà log là APPEND-ONLY — một dòng rác nằm đó vĩnh viễn (A3.3).
 * ⚠ Trả `undefined` khi rỗng sạch, để bản ghi vòng KHÔNG mọc trường thừa: `HanhDongLog`
 * của trận cũ không có `tiet_kiem`, và mọi so sánh golden dựa vào đúng hình dạng đó.
 */
function chuanHoaTietKiem(x: unknown): HanhDongLog['tiet_kiem'] {
  if (!x || typeof x !== 'object') return undefined;
  const o = x as { huy?: unknown; mo?: unknown };
  const huy = Array.isArray(o.huy)
    ? o.huy.filter((v): v is string => typeof v === 'string' && /^tk\d+_\d+$/.test(v))
      .slice(0, TIET_KIEM.TRAN_MO_MOI_VONG)
    : [];
  const mo = Array.isArray(o.mo)
    ? o.mo.flatMap((v) => {
      if (!v || typeof v !== 'object') return [];
      const { moc_bp: mocBp, so_vong: soVong } = v as { moc_bp?: unknown; so_vong?: unknown };
      if (!Number.isInteger(mocBp) || !Number.isInteger(soVong)) return [];
      // Kỳ hạn lạ bị CẮT ở đây; engine vẫn kiểm lại (`ky_han_la`) vì bot không đi qua cửa này.
      if (!TIET_KIEM.MOC.includes(soVong as number)) return [];
      return [{ moc_bp: mocBp as number, so_vong: soVong as number }];
    }).slice(0, TIET_KIEM.TRAN_MO_MOI_VONG)
    : [];
  if (huy.length === 0 && mo.length === 0) return undefined;
  return { ...(huy.length ? { huy } : {}), ...(mo.length ? { mo } : {}) };
}

/** Lời khai sự cố của client (D93) — xem `HanhDongLog.su_co_khai`. */
export interface SuCoKhai {
  /** Số lần gọi máy chủ HỎNG trong vòng này (kể từ lúc client thấy vòng mở). 1..99. */
  so_lan_hong: number;
  /** Lỗi cuối: chưa tới máy chủ (timeout/network) hay máy chủ trả 5xx (server). */
  loi_cuoi: 'timeout' | 'network' | 'server';
}
const LOI_CUOI_HOP_LE = new Set(['timeout', 'network', 'server']);
const TRAN_SO_LAN_HONG = 99;

/**
 * D93 — lọc lời khai sự cố. Danh sách trắng + kẹp số, cùng kỷ luật `bo_cuc`/`chi_tiet`
 * (A9): rác ⇒ `undefined` = KHÔNG CÓ NHÃN, không phải nhãn sai. Không ném — một
 * lời khai hỏng không được làm hỏng cú chốt vòng.
 */
export function chuanHoaSuCoKhai(x: unknown): SuCoKhai | undefined {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return undefined;
  const o = x as Record<string, unknown>;
  const so = Number(o.so_lan_hong);
  if (!Number.isFinite(so) || so < 1) return undefined;
  const loi = o.loi_cuoi;
  if (typeof loi !== 'string' || !LOI_CUOI_HOP_LE.has(loi)) return undefined;
  return {
    so_lan_hong: Math.min(TRAN_SO_LAN_HONG, Math.floor(so)),
    loi_cuoi: loi as SuCoKhai['loi_cuoi'],
  };
}

/**
 * v32 — LỰA CHỌN KỲ NGỘ của vòng này. Cùng lớp lọc với `chuanHoaKhoa`/`chuanHoaGan`.
 *
 * ⚠ Lọc theo BỘ ĐƯỢC MỜI của đúng (seed, vòng) chứ không chỉ theo "có phải một
 * trong bốn id không" (C4). Mời 3 trong 4 là một phần của luật — nhận id thứ tư
 * là cho client tự chọn món không được chào, và `action_log` là nguồn dựng lại
 * trận nên cái sai đó nằm lại vĩnh viễn.
 * ⚠ Vòng không phải vòng kỳ ngộ ⇒ `undefined`: trường phải VẮNG MẶT khỏi dòng
 * log, không được gán `undefined` (`exactOptionalPropertyTypes` — dòng của vòng
 * thường phải trông y hệt dòng của trận cũ).
 */
function chuanHoaKyNgo(
  x: unknown, vong: number, soO: number, bat: boolean,
  /**
   * BỘ ĐƯỢC MỜI của đúng vòng này — từ D88 sinh theo HỒI nên không tự tính
   * lại ở đây được (cần trạng thái map); caller đưa từ `replay().kyNgo.lan`
   * — MỘT nguồn cho cả lời mời đã hiện lẫn phép lọc ở tầng nhận (D61).
   */
  moi: readonly NhiemVuId[] | undefined,
): NhiemVuId | undefined {
  /*
   * ⚠⚠ CỔNG PHIÊN BẢN KIỂM Ở ĐÂY, KHÔNG CHỈ Ở CHỖ ĐỌC. Bản đầu chỉ hỏi "có
   * phải vòng kỳ ngộ không", nên một trận v31 gửi kèm `ky_ngo` vẫn ghi được
   * trường vào `action_log` VÀ đẻ ra một dòng `hd_chon_ky_ngo` — trong bảng
   * APPEND-ONLY (A3.3), của một phiên bản không có kỳ ngộ, không xoá lại được.
   * Bài test v31 bắt được đúng cú này.
   */
  if (!bat || typeof x !== 'string' || !laVongKyNgo(vong, soO)) return undefined;
  if (!moi) return undefined;
  return moi.includes(x as NhiemVuId) ? (x as NhiemVuId) : undefined;
}

interface HanhDongLog {
  vong: number;
  khao_sat_lai: number;
  /**
   * D475 — KẾT QUẢ MÀN MINIGAME của vòng TRƯỚC (vòng `vong − 1`), áp ở ĐẦU vòng này: `vi_the[ma] += loi` theo từng ghế. SỐ NGUYÊN do server
   * tính lúc nộp (`tinhMgCaBan` — cùng hàm đã áp ở đuôi `manCho` khi người chơi đặt lệnh), không phải do client gửi. Chỉ trận cờ
   * `dong_ho_minigame` đọc. ⚠ OPTIONAL VĨNH VIỄN, cùng lý do với `dao`.
   */
  mg?: MgVong;
  /**
   * D481 — kết quả màn của CHÍNH vòng này, áp SAU khi vòng chốt. Chỉ có ở dòng VÒNG CUỐI của trận khung minigame: màn cuối chạy sau cú nộp
   * cuối, trận chỉ khép (lưu kết quả, xếp hạng) khi màn xong — lúc đó server chép số vào đây (`chotManCuoi`). ⚠ OPTIONAL VĨNH VIỄN.
   */
  mg_sau?: MgVong;
  /**
   * LÕI VỐN A — đảo danh mục ở nhịp 1 vòng này: bán một bản `tu`, mua `den`.
   *
   * ⚠ OPTIONAL VĨNH VIỄN, y hệt `gan`/`cuoc`/`mo_bang`. Log của trận CŨ không có
   * trường này, và log LÀ nguồn dựng lại trận: vắng ⇒ không đảo ⇒ replay ra ĐÚNG
   * kết quả trận đó từng có. Tối đa một lần mỗi vòng (engine tự chặn).
   */
  dao?: { tu: string; den: string };
  /**
   * LÕI VỐN B — bật khoá 2 vòng lên mã này ở nhịp 1 vòng này.
   *
   * ⚠ OPTIONAL VĨNH VIỄN, cùng lý do với `dao`.
   */
  khoa?: string;
  /**
   * v43 (D314) — NGÂN HÀNG: mở / huỷ hợp đồng gửi tiết kiệm ở vòng này.
   *
   * ⚠ OPTIONAL VĨNH VIỄN, cùng lý do với `dao`/`khoa`: log của trận CŨ không có trường
   * này, và log LÀ nguồn dựng lại trận.
   * ⚠ Đi CÙNG cú nộp vòng, KHÔNG có POST riêng — cùng luật với mọi cơ chế khác của vòng
   * (docstring `QuanTriVon`: log là nguồn, một hành động ngoài log là một hành động không
   * replay được).
   */
  tiet_kiem?: {
    /** id hợp đồng tất toán sớm. Tất-cả-hoặc-không. */
    huy?: string[];
    /** mốc % tiền mặt + kỳ hạn (ô). Áp TUẦN TỰ trên tiền mặt còn lại. */
    mo?: { moc_bp: number; so_vong: number }[];
  };
  /**
   * D33 — ĐẶC QUYỀN PHÒNG HỘ: mã bị bán khống ở nhịp 1 vòng này, KHỚP VÒNG SAU.
   *
   * ⚠ OPTIONAL VĨNH VIỄN, y hệt `dao`/`khoa`. Log của trận CŨ không có trường
   * này ⇒ không short ⇒ replay ra ĐÚNG kết quả trận đó từng có.
   */
  short?: string;
  /**
   * v10 NAV — chuỗi lệnh giao dịch của vòng, LƯU THEO MỐC (28/07: mốc mịn là
   * đặc quyền Chia Lệnh, nên log phải giữ Ý ĐỊNH MỐC để replay kiểm lại đúng
   * luật trên trạng thái lúc áp — lưu tiền thô là mất dấu vết mốc).
   * Đã CHUẨN HOÁ CẤU TRÚC ở tầng nhận (`chuanHoaLenh`) — rác không vào log
   * vĩnh viễn. Hợp lệ NGỮ NGHĨA (bước mốc, đủ tiền, trần mã) do engine quyết.
   */
  lenh?: { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[];
  /**
   * KHỚP LỆNH GIỮA VÒNG (08/08) — các nhóm lệnh ĐÃ KHỚP trước cú nộp, gộp từ
   * đuôi `MoBangCho.khop` khi nộp vòng. Replay áp TỪNG NHÓM theo thứ tự, TRƯỚC
   * `lenh` — xem lý do giữ-nhóm ở `MoBangCho.khop`.
   * ⚠ OPTIONAL VĨNH VIỄN như `dao`/`khoa`: log trận cũ không có ⇒ replay nguyên.
   */
  khop_truoc?: { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[][];
  /** v55 (D409) — chọn trait ở vòng MỐC (đi cùng cú nộp vòng ấy): lá lấy + số lần cuộn đã trả bằng xu. */
  trait?: { lay: TraitId[]; cuon: number };
  /** v55 (D409) — Lướt Sóng mới: lệnh CHỐT LỜI TRONG Ô cho vòng này (mỗi mã một lệnh). */
  chot_loi?: { ma: string; nguong_bp: number; phan_bp: number }[];
  /** D561 — lõi cho màn của vòng này, chọn lúc CHỐT (khoá v65 `loiChonTruoc`). Lõi không đang cầm ⇒ bỏ qua (màn rơi về mặc định). */
  loi_man?: string;
  /**
   * D33 — lần mở bảng của vòng này có mua kèm DỰ BÁO (+30) hay không.
   *
   * ⚠ CHỈ CÓ NGHĨA KHI `mo_bang > 0`, và cũng như `mo_bang`, con số này do
   * SERVER ghi lúc mở bảng chứ KHÔNG đọc từ body lúc nộp vòng (C4). Tin client
   * ở đây là mở hạng 110 rồi khai `du_bao: false` để trả 80.
   *
   * Hạng `luot_song` KHÔNG lưu: nó suy lại được từ danh mục đầu vòng — mà danh
   * mục là hàm thuần của log. Lưu thêm một thứ suy được là mở đường cho hai
   * nguồn chân lý lệch nhau.
   */
  du_bao?: boolean;
  /**
   * D3 — thẻ chiến thuật vừa mua gắn vào mã nào: `{ [chien_thuat_id]: tai_san_id }`.
   *
   * ⚠ OPTIONAL vĩnh viễn — log của trận CŨ không có trường này, và log LÀ nguồn dựng
   * lại trận. Thiếu ⇒ không gắn ⇒ thẻ tác động toàn danh mục, đúng hành vi trước D3.
   */
  gan?: Record<string, string>;
  /** v34 — đích PHỤ của Đòn Bẩy cấp 2 (cá mập). OPTIONAL vĩnh viễn như `gan`. */
  gan_phu?: Record<string, string>;
  /**
   * Thẻ đã mua trong vòng. MẢNG chứ không phải một lá.
   *
   * ⚠ Bản đầu để `string | null` — chỉ mua được MỘT lá mỗi vòng, nên không
   * bao giờ lấy được cả Tài sản LẪN Chiến thuật. Sai với Chương II của thiết
   * kế: hai bộ bài "tách biệt hoàn toàn để người chơi KẾT HỢP thành một Danh
   * mục đầu tư". Founder bắt đúng 20/07.
   *
   * Đọc được cả dạng cũ (chuỗi) để log trận đang chơi dở không gãy.
   */
  mua: string[] | string | null;
  hanh_dong: HanhDongVong['hanh_dong'];
  them: number;
  /**
   * CHUỖI hành động cược của người chơi trong vòng — theo đúng thứ tự bị hỏi.
   *
   * Vì sao là MẢNG chứ không phải một hành động: từ khi vòng cược chạy TUẦN TỰ
   * (20/07), người chơi có thể bị hỏi nhiều lần trong cùng một vòng — theo
   * xong bị tố lại thì phải quyết định lại. Một ô `hanh_dong` không tả nổi.
   *
   * `hanh_dong`/`them` giữ lại để đọc log trận cũ, và làm hành động ĐẦU TIÊN
   * khi `cuoc` vắng mặt.
   */
  cuoc?: { loai: LoaiHanhDong; them?: number }[];
  /**
   * LUẬT 3 — số lần MỞ BẢNG ĐIỆN TỬ có thu phí trong vòng này.
   *
   * ⚠ OPTIONAL VĨNH VIỄN, y hệt `gan` và `cuoc`. Trận đang chơi dở trên prod
   * không có trường này, mà `action_log` LÀ nguồn dựng lại trận: thiếu ⇒ 0 lần
   * ⇒ không trừ gì ⇒ replay ra ĐÚNG kết quả trận đó từng có.
   *
   * ⚠ KHÔNG đọc từ body client. Con số này do SERVER ghi lúc mở bảng (endpoint
   * `/bang`) rồi gộp vào dòng vòng khi nộp — xem `MoBangCho`. Tin client ở đây
   * là mở bảng xong khai `mo_bang: 0` để xem thông tin miễn phí, tức LUẬT 3
   * biến mất mà không ai thấy (C4: client không bao giờ tự tính tiền).
   */
  mo_bang?: number;
  /**
   * D38 — VÒNG NÀY DO HẾT GIỜ CHỐT HỘ, không phải người chơi bấm.
   *
   * ⚠ ĐIỂM CHẠM A1, KHÔNG PHẢI CỜ KỸ THUẬT. Hết giờ ⇒ `NUOC_HET_GIO` = "giữ
   * nguyên", mà "giữ nguyên" cũng là một nút người chơi bấm CỐ Ý. Hai hành vi ra
   * cùng một dòng log nhưng khác hẳn nhau về tâm lý: một bên là quyết định, một
   * bên là đang bận. Không có cờ này thì cột khẩu vị rủi ro — tín hiệu B2B đắt
   * nhất — bị pha loãng bởi những vòng người chơi không hề nhìn màn hình, và
   * `events` append-only nên KHÔNG tách lại được về sau (A3.3).
   *
   * ⚠ OPTIONAL VĨNH VIỄN, và KHÔNG được vào phép tính nào của engine: replay chỉ
   * đọc `hanh_dong`/`them`/`mua`/… Cờ này là NHÃN, đọc bởi phân tích dữ liệu.
   * Cho nó ảnh hưởng kết quả là kéo đồng hồ vào đường tính tiền (xem dong_ho.ts).
   */
  tu_dong?: true;
  /**
   * D93 (16/08) — LỜI KHAI CỦA MÁY NGƯỜI CHƠI: vòng này đã gửi hỏng mấy lần
   * trước khi bị chốt hộ. CHỈ có mặt cùng `tu_dong` (server không ghi ở vòng
   * bấm kịp — nhãn chỉ có nghĩa khi MẤT LƯỢT).
   *
   * Vì sao: đồng hồ vòng chạy bằng timestamp server, không biết server có sập
   * hay không. Vercel/Supabase chết dài hơn số giây còn lại ⇒ cú nộp đến muộn ⇒
   * `het_gio` ⇒ người chơi mất lượt không phải lỗi họ — mà trong `events` nó y
   * hệt một người AFK. Founder chốt: "dán nhãn, không đổi luật". Tên có chữ KHAI
   * cố ý: đây là lời khai của client, không phải sự thật server chứng kiến;
   * người phân tích đọc tên là biết độ tin. Khai gian không được gì (lượt vẫn
   * mất) nên không phải cửa gian lận — nhưng server vẫn KHÔNG bịa: rác ⇒ vắng.
   *
   * ⚠ OPTIONAL VĨNH VIỄN, KHÔNG vào phép tính engine (cùng luật với `tu_dong`).
   */
  su_co_khai?: SuCoKhai;
  /**
   * v32 (D85/D86 §1) — NHIỆM VỤ KỲ NGỘ người chơi chọn ở vòng này.
   *
   * ⚠ OPTIONAL VĨNH VIỄN, y hệt `dao`/`khoa`/`short`. `action_log` LÀ nguồn dựng
   * lại trận: vắng ⇒ không chọn ⇒ không nhiệm vụ, không đặc quyền ⇒ trận cũ
   * replay ra ĐÚNG kết quả nó từng có. Không phạt việc bỏ qua (doc 06 §1.4:
   * "thất bại KHÔNG phạt" — phạt thì cú chọn thành né rủi ro, sập đúng cái đa
   * dạng cần đo).
   *
   * ⚠ CHỈ có nghĩa ở vòng kỳ ngộ (`laVongKyNgo`), và `chuanHoaKyNgo` cưỡng chế
   * điều đó ở TẦNG NHẬN — rác lọt vào log là rác vĩnh viễn.
   *
   * BỘ ĐƯỢC MỜI KHÔNG LƯU: nó là hàm thuần của (seed, vòng) qua `boNhiemVuMoi`,
   * cùng lý lẽ `bayShop`. Lưu thêm một thứ suy được là mở đường cho hai nguồn
   * chân lý lệch nhau.
   */
  ky_ngo?: NhiemVuId;
}

/**
 * Dòng ĐUÔI "đã trả phí mở bảng, chưa nộp vòng".
 *
 * Vì sao phải là một dòng riêng trong `action_log` thay vì đợi client gửi kèm
 * lúc nộp vòng: bảng mở ở ĐẦU vòng, còn dòng vòng chỉ sinh ra khi người chơi
 * nộp quyết định. Giữa hai mốc đó phí phải đã CÓ THẬT trong nguồn dựng lại trận
 * — nếu không thì đóng tab (hoặc đơn giản là không nộp vòng) là xem bảng miễn
 * phí, và F5 lại mở được lần nữa.
 *
 * Dòng này CHỈ TỒN TẠI TẠM: `/rounds` và `/luot` gộp nó vào dòng vòng rồi bỏ đi,
 * nên sau khi nộp, `action_log.length` vẫn đúng bằng số vòng đã chơi như trước.
 */
interface MoBangCho {
  vong: number;
  mo_bang: number;
  /** D33 — đuôi này đã trả tiền cho hạng CÓ DỰ BÁO chưa. Xem `HanhDongLog.du_bao`. */
  du_bao?: boolean;
  /**
   * KHỚP LỆNH GIỮA VÒNG (08/08) — các NHÓM lệnh đã khớp trước khi nộp vòng,
   * đúng thứ tự bấm. Mỗi phần tử là MỘT cú bấm KHỚP NGAY.
   *
   * ⚠ PHẢI GIỮ NHÓM, KHÔNG GỘP PHẲNG: `giaiLenhMoc` xếp bán-trước-mua TRONG
   * TỪNG NHÓM. Gộp phẳng rồi giải một lần là mọi lệnh bán của cả vòng nhảy lên
   * trước mọi lệnh mua — "khớp1 mua B, khớp2 bán B" gộp phẳng thành bán B (chưa
   * có gì để bán) rồi mua B: kết quả KHÁC HẲN thứ người chơi đã thấy trên màn.
   */
  khop?: { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[][];
  /**
   * KHOÁ CHỐNG ÁP HAI LẦN cho KHỚP NGAY (rà mạng kém 11/08) — mỗi cú BẤM một
   * khoá, giữ nguyên qua mọi lần gửi lại.
   *
   * ⚠ LỖ MẤT TIỀN THẬT, không phải phòng xa. `khop` NỐI THÊM, mà hai cửa chặn
   * duy nhất của endpoint là số vòng và hạn giờ — cú gửi lại TRONG CÙNG VÒNG
   * lọt qua cả hai. Tệ hơn: khi `fetch` hết hạn chờ 15s, client TRẢ HÀNG LỆNH
   * VỀ và mời bấm lại — đúng ca server rất có thể đã áp xong rồi mà response
   * rớt trên đường về. Bán 50% BTC hai lần, không ai thấy.
   *
   * `/rounds` không cần khoá này vì nó đã có COMPARE-AND-SET trên `action_log`
   * (gửi lại ⇒ 409 `vong_da_nop`, rollback trọn gói). Endpoint này thì không:
   * nó CỘNG vào đuôi nên mỗi cú gửi là một cú áp mới.
   *
   * ⚠ Trận cũ không có trường này ⇒ `undefined`; replay bỏ qua hoàn toàn
   * (khoá không vào phép tính nào), nên trận đã lưu dựng lại y hệt từng chip.
   */
  khop_keys?: string[];
  cho_nop: true;
}

/** Một phần tử `action_log` — dòng vòng đã nộp, hoặc đuôi chờ nộp. */
type DongLog = HanhDongLog | MoBangCho;

const laChoNop = (h: DongLog): h is MoBangCho =>
  (h as MoBangCho).cho_nop === true;

/**
 * MỘT DÒNG `action_log` DỰNG TỪ BODY — dùng chung cho `/luot` và `/rounds`.
 *
 * ⚠ PHẢI LÀ MỘT HÀM, không phải hai khối chép nhau. Hai endpoint dựng cùng một
 * dòng cho cùng một vòng; lệch một trường là `/luot` phát lại một vòng KHÁC với
 * vòng `/rounds` sẽ ghi, và biểu hiện là "diễn biến vòng cược xem một đằng, kết
 * quả chốt ra một nẻo". Trước bản này hai khối đã chép nhau và đã lệch thật:
 * `/luot` bỏ mất `gan`.
 *
 * `exactOptionalPropertyTypes`: mọi trường optional phải VẮNG MẶT chứ không được
 * gán `undefined` — dòng của vòng không đảo/không khoá phải trông y hệt dòng của
 * trận cũ, nếu không thì so sánh log giữa hai thời kỳ không còn nghĩa.
 */
function dongVongTuBody(
  vong: number, body: unknown,
  bangCho: {
    soLan: number; duBao: boolean;
    khop?: { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[][];
  },
  hanhDong: HanhDongVong['hanh_dong'], them: number,
  /**
   * v32 — bối cảnh lọc lựa chọn kỳ ngộ: cổng phiên bản + bộ ĐƯỢC MỜI của đúng
   * vòng này (từ D88 mời sinh theo HỒI nên phải lấy từ replay, không tự tính).
   * Optional để mọi chỗ gọi cũ (và test) không gãy: vắng ⇒ không nhận
   * `ky_ngo`, tức hướng an toàn (không bịa ra một lựa chọn).
   */
  kyNgoCtx?: { soO: number; bat: boolean; moi: readonly NhiemVuId[] | undefined },
): HanhDongLog {
  const b = (body ?? {}) as Record<string, unknown>;
  const gan = chuanHoaGan(b.gan);
  const ganPhu = chuanHoaGan(b.gan_phu);
  const dao = chuanHoaDao(b.dao);
  const khoa = chuanHoaKhoa(b.khoa);
  const short = chuanHoaShort(b.short);
  const tietKiem = chuanHoaTietKiem(b.tiet_kiem);
  const lenh = chuanHoaLenh(b.lenh);
  const trait = chuanHoaTrait(b.trait);
  const chotLoi = chuanHoaChotLoi(b.chot_loi);
  const kyNgo = kyNgoCtx
    ? chuanHoaKyNgo(b.ky_ngo, vong, kyNgoCtx.soO, kyNgoCtx.bat, kyNgoCtx.moi)
    : undefined;
  return {
    vong,
    khao_sat_lai: Math.max(0, Math.min(5, Number(b.khao_sat_lai ?? 0) | 0)),
    mua: chuanHoaMua(b.mua),
    ...(gan ? { gan } : {}),
    ...(ganPhu ? { gan_phu: ganPhu } : {}),
    ...(dao ? { dao } : {}),
    ...(khoa ? { khoa } : {}),
    ...(short ? { short } : {}),
    ...(tietKiem ? { tiet_kiem: tietKiem } : {}),
    ...(lenh ? { lenh } : {}),
    ...(trait ? { trait } : {}),
    ...(chotLoi ? { chot_loi: chotLoi } : {}),
    ...(kyNgo ? { ky_ngo: kyNgo } : {}),
    // D561 — lõi màn chọn lúc chốt: chỉ là id; lõi có đang cầm hay không do `laCuaMan` xét (một nguồn).
    ...(typeof b.loi_man === 'string' && /^[a-z_]{1,32}$/.test(b.loi_man) ? { loi_man: b.loi_man } : {}),
    hanh_dong: hanhDong,
    them,
    cuoc: chuanHoaChuoiCuoc(b.cuoc),
    // Phí bảng đã trả ở đầu vòng — GỘP vào dòng vòng, không truyền qua đuôi:
    // dòng này CHẠY vòng, nên đuôi (áp sau vòng lặp) sẽ trừ muộn một vòng.
    ...(bangCho.soLan ? { mo_bang: bangCho.soLan } : {}),
    ...(bangCho.soLan && bangCho.duBao ? { du_bao: true } : {}),
    // KHỚP GIỮA VÒNG gộp vào dòng vòng — như `mo_bang`, do SERVER ghi từ đuôi
    // chờ, KHÔNG đọc từ body (C4). Kể cả hết giờ vẫn gộp: các cú khớp ĐÃ xảy ra.
    ...(bangCho.khop?.length ? { khop_truoc: bangCho.khop } : {}),
  };
}

/** Ném ra khi phát lại chạm đúng lượt người chơi mà log đã hết hành động. */
class DungOLuotBan extends Error {
  constructor(readonly boiCanh: BoiCanhCuoc, readonly nhatKy: NhatKyCuoc[]) {
    super('cho_nguoi_choi');
  }
}

export interface NhatKyCuoc {
  ghe_id: string;
  loai: LoaiHanhDong;
  /** Chip bỏ thêm lần này. */
  them: number;
  /** Giá phải theo TẠI thời điểm hành động — UI dựng lại được áp lực lúc đó. */
  gia: number;
  /**
   * Bot "nghĩ" bao lâu trước khi ra tay (ms).
   *
   * ⚠ ĐÂY LÀ ĐỘ TRỄ GIẢ, và nó tách hẳn khỏi đường đi của bản người thật.
   * Founder hỏi đúng chỗ 20/07: bản người thật thì đừng có trễ như vậy mà phải
   * có đếm ngược. Nên hợp đồng chia làm hai trường, UI dùng chung một component:
   *   • `nghi_ms` — CHỈ có với bot. Client tự đợi. Server không hề chờ, phát
   *     lại vẫn tức thì, tất định theo seed nên xem lại trận ra y hệt.
   *   • `han_ts`  — dành cho người thật: MỐC HẾT HẠN tuyệt đối do server chấm.
   *     Client vẽ đồng hồ đếm ngược tới mốc đó; quá hạn thì server tự ghi một
   *     hành động mặc định vào log rồi đi tiếp.
   * Đổi bot→người chỉ là đổi trường nào có mặt, KHÔNG viết lại luồng UI.
   */
  nghi_ms?: number;
  han_ts?: string;
}

/** Độ trễ "nghĩ" của bot — tất định theo seed, không bao giờ lệch khi replay. */
function nghiMs(seed: number, vong: number, gheId: string, buoc: number): number {
  return 420 + rngAt(seed, 'holdem_nghi', vong, gheId, buoc).below(880);
}

/** Đọc chuỗi hành động cược từ body, bỏ rác. */
function chuanHoaChuoiCuoc(v: unknown): { loai: LoaiHanhDong; them?: number }[] {
  if (!Array.isArray(v)) return [];
  const ra: { loai: LoaiHanhDong; them?: number }[] = [];
  for (const x of v.slice(0, 24)) {
    const loai = (x as { loai?: unknown })?.loai;
    if (loai !== 'theo' && loai !== 'to' && loai !== 'bo') continue;
    const them = Math.max(0, Number((x as { them?: unknown })?.them ?? 0) | 0);
    ra.push(loai === 'to' ? { loai, them } : { loai });
  }
  return ra;
}

/*
 * ⚠ ĐÃ GỠ `BAC_RANK = ['Đồng','Bạc','Vàng']` + `BAC_RANK[(seed + i*3) % 3]`.
 *
 * Hai lỗi trong một dòng:
 *   (1) NGẪU NHIÊN theo seed — badge "bậc đối thủ" không dựa trên bất cứ thứ gì.
 *       D25/R1 log nó như "bối cảnh người chơi ĐÃ THẤY" để khử nhiễu nể-cao /
 *       lấn-thấp; khử nhiễu bằng một nhãn ngẫu nhiên thì ra kết luận SAI, tệ hơn
 *       là không đo (A1: cơ chế làm bẩn dữ liệu = phá nguồn thu).
 *   (2) TRÙNG TÊN ba chữ Đồng/Bạc/Vàng của bậc Brier ở Hệ B
 *       (`config/progression.ts` BAC_BRIER) — hai đại lượng không liên quan gì
 *       nhau đọc ra cùng một chữ trên cùng một màn hình.
 *
 * Nay: người thật lấy bậc THẬT từ `rank_diem` (config/rank.ts, thang sinh vật
 * biển), bot lấy `BAC_BOT = 'chua_xep'` vì bot không có điểm xếp hạng và không
 * bao giờ có (D31: rank toàn người thật).
 */

/**
 * Bộ luật của một trận KHÔNG BIẾT PHIÊN BẢN — tắt hết.
 *
 * Dùng làm mặc định của `replay`, đúng hướng an toàn: trận cổ nhất (chưa có cột
 * `balance_version`) phải chạy bằng bộ luật cổ nhất. Đoán "chắc là bản mới" ở
 * đây là đoán trên dữ liệu sống.
 */
const LUAT_TAT: BoLuatCanBang = luatCua(null);

/**
 * D302 — BỘ LUẬT CHO MỘT TRẬN = luật theo phiên bản + ngoại lệ bàn tập cố định
 * (`laSeedManTapCoDinh`: tắt phản thân + bẻ chuỗi bằng vốn, xem docstring bên
 * config). MỘT cửa cho tạo trận · đọc trận · ghost bàn chung · tầng hành vi —
 * gọi `luatCua` thẳng ở một chỗ là chỗ đó thấy bàn tập bị đám đông đổi ô trong
 * khi ba chỗ kia không (D61). Trận thường: y hệt `luatCua`.
 */
/** D329 — mã tham gia (4 ký tự từ sha-256 match_id). K7: dời xuống `holdem/ma_tham_gia.ts`; xuất lại cho người gọi cũ. */
export { maThamGia };

/**
 * D370 — MÃ BUỔI ĐO của (người, bàn). Cùng bảng chữ, cùng độ dài với `maThamGia` để người chép tay
 * và người nhập số không phải học hai luật; khác ở NGUỒN.
 *
 * ⚠⚠ VÌ SAO KHÔNG DÙNG LẠI `maThamGia`: mã ấy sinh từ `match_id`, tức **chỉ có sau khi đã chơi một
 * trận**. Phiếu ĐẦU TIÊN của buổi đo điền lúc chưa ai chơi gì — đúng chỗ cần khoá nhất thì mã kia
 * chưa tồn tại. Mã này sinh từ (người, bàn) nên có ngay lúc bấm đồng ý.
 *
 * ⚠ TẤT ĐỊNH theo (userId, banMa): cùng cặp ⇒ cùng mã. Nên rút rồi đồng ý lại vẫn ra mã cũ, và
 * `COALESCE` ở chỗ gọi là hàng rào thứ hai chứ không phải hàng rào duy nhất.
 * ⚠ Không tra ngược ra người: sha-256 một chiều, và 4 ký tự thì vô số tiền ảnh (C7).
 */
/**
 * D370 — HAI KHỐI CỦA MÀN KẾT BỊ GIỮ TỚI KHI NỘP PHIẾU 2, gom vào một hàm thuần.
 *
 * `nang_luc` (ba dấu kỹ năng **kèm chữ bậc**) và `khoanh_khac` (khối "vừa chạm", kể ra đề có cơ chế
 * gì) đều trả lời hộ đúng những câu PHIẾU 2 sắp hỏi. Giữ cả hai, hoặc không giữ gì.
 *
 * ⚠⚠ VÌ SAO LÀ HÀM RIÊNG chứ không hai toán tử ba ngôi tại chỗ: bài canh tích hợp kiểm được
 * `khoanh_khac` rỗng, nhưng một trận bình thường CŨNG hay rỗng — nên bài canh ấy xanh cả khi quên
 * giấu (đã tiêm thử: 0 đỏ). Tách ra thì canh được bằng dữ liệu KHÔNG rỗng, và mũi tiêm đỏ đúng chỗ.
 * Đây là lần thứ hai trong D370 một bài canh xanh vì lý do sai — xem `tests/buoi_do_tu_phuc_vu` §IV.
 */
export function khoiKetBuoiDo<N, K>(
  giu: boolean, nangLuc: N, khoanhKhac: readonly K[],
): { nang_luc: N | undefined; khoanh_khac: readonly K[] } {
  return { nang_luc: giu ? undefined : nangLuc, khoanh_khac: giu ? [] : khoanhKhac };
}

export function maBuoiDo(userId: string, banMa: string): string {
  const KY = 'abcdefghjkmnpqrstuvwxyz23456789';
  const h = createHash('sha256').update(`buoi_do:${userId}:${banMa}`).digest();
  return Array.from({ length: 4 }, (_, i) => KY[h[i]! % KY.length]).join('');
}

/**
 * D329 — trạng thái ĐỒNG Ý buổi đo của (người, bàn), đọc từ VẾT MỚI NHẤT trong `events` (append-only).
 * Không cột trạng thái nào song song — một nguồn (D61): cột và vết lệch nhau thì không ai biết bên nào
 * nói thật. `hien_hanh` = vết mới nhất là ĐỒNG Ý với bản ĐANG hiệu lực; đồng ý bản cũ thì phải đồng ý
 * lại (đổi một chữ ⇒ tăng phiên bản ⇒ hỏi lại, `config/pfm_consent.ts`).
 */
export async function trangThaiDongYBuoiDo(
  db: pg.Pool | pg.PoolClient, userId: string, banMa: string,
): Promise<{ dong_y: boolean; hien_hanh: boolean; phien_ban: string | null }> {
  const r = await db.query(
    `SELECT action_type, value_json->>'phien_ban' AS phien_ban FROM events
      WHERE user_id = $1 AND action_type IN ('hd_dong_y_buoi_do', 'hd_rut_buoi_do')
        AND value_json->>'ban_ma' = $2
      ORDER BY event_id DESC LIMIT 1`, [userId, banMa]);
  const h = r.rows[0] as { action_type: string; phien_ban: string | null } | undefined;
  const dongY = h?.action_type === 'hd_dong_y_buoi_do';
  const pb = dongY ? h!.phien_ban : null;
  return { dong_y: dongY, hien_hanh: dongY && laConsentHienHanh('buoi_do', pb), phien_ban: pb };
}

export function luatChoTran(phienBan: string | null | undefined, seed: number): BoLuatCanBang {
  const luat = luatCua(phienBan ?? null);
  return laSeedManTapCoDinh(seed) ? { ...luat, phanThan: false, beChuoiVon: false } : luat;
}

/*
 * ⚠⚠ TRẦN ĐỘ DÀI, KHÔNG CHỈ TRẦN SỐ LƯỢNG (siết 12/08).
 *
 * Trước đây `mua` chỉ bị đếm SỐ PHẦN TỬ (tối đa 3), không đếm BYTE. Mà id lạ
 * thì engine lặng lẽ bỏ qua — không ném lỗi — nên ba chuỗi rác cỡ MB đi lọt
 * trọn vẹn và đáp xuống HAI chỗ: `action_log` của trận, và `value_json` của
 * `events`. `events` là APPEND-ONLY (A3.3): không có đường dọn nào ngoài một
 * migration phá chính luật đó.
 *
 * Đo ra: một tài khoản khách + 240 request/giờ (đúng trần sẵn có) ≈ 1 GB/giờ,
 * trên một free tier 500 MB (C1). Kho đầy thì MỌI đường ghi của người thật chết
 * theo — ledger, đặt lệnh, kết trận — và backup đêm gãy vì vượt hạn mức GitHub.
 * Đây là thứ duy nhất trong đợt rà giết được hệ thống trong VÀI PHÚT.
 *
 * Vì sao nó sót: mọi trường nhận chuỗi từ client trong repo này đều lọc theo
 * danh sách trắng hoặc `slice()` — `mua` là trường tự do DUY NHẤT còn lại, và
 * nó lại ghi thẳng vào bảng không xoá được.
 *
 * Cắt bằng `slice` chứ không TỪ CHỐI: id hợp lệ dài nhất chưa tới 20 ký tự, nên
 * mọi thứ bị cắt vốn đã là id không tồn tại và engine vẫn bỏ qua y như cũ ⇒
 * hành vi của mọi lượt chơi THẬT không đổi một chip, không cần cổng version.
 */
const MUA_ID_MAX = 64;

/** Chấp nhận cả `null | "btc" | ["btc","don_bay"]`. Bỏ trùng, giữ thứ tự. */
function chuanHoaMua(raw: unknown): string[] {
  if (raw == null) return [];
  const arr = (Array.isArray(raw) ? raw : [raw]).slice(0, 8);
  const out: string[] = [];
  for (const x of arr) {
    const id = String(x).trim().slice(0, MUA_ID_MAX);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * v10 NAV — chuẩn hoá CẤU TRÚC chuỗi lệnh ở tầng nhận. Cùng triết lý
 * `chuanHoaDao`/`chuanHoaKhoa`: `action_log` là nguồn dựng lại trận, rác lọt
 * vào là rác VĨNH VIỄN. Ngữ nghĩa (đủ tiền, trần mã) là việc của engine.
 */
/** v55 (D409) — lựa chọn trait từ body: id trong bảng, không trùng, ≤ 6, cuộn 0..5. Kiểm LUẬT (mốc · lượt mời · cân · xu) ở route. */
function chuanHoaTrait(raw: unknown): { lay: TraitId[]; cuon: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { lay?: unknown; cuon?: unknown };
  const lay: TraitId[] = [];
  for (const x of Array.isArray(o.lay) ? o.lay.slice(0, 6) : []) {
    if (typeof x === 'string' && (TRAIT_IDS as readonly string[]).includes(x) && !lay.includes(x as TraitId)) lay.push(x as TraitId);
  }
  const cuon = Math.max(0, Math.min(CHO_TRAIT.CUON_TOI_DA, Number(o.cuon ?? 0) | 0));
  return lay.length > 0 || cuon > 0 ? { lay, cuon } : null;
}
/** v55 (D409) — lệnh chốt lời trong ô: mã hợp lệ, mục tiêu là bội của bước trong [MIN, MAX], phần bán trong thang cho phép, mỗi mã một lệnh. */
function chuanHoaChotLoi(raw: unknown): { ma: string; nguong_bp: number; phan_bp: number }[] | null {
  if (!Array.isArray(raw)) return null;
  const ra: { ma: string; nguong_bp: number; phan_bp: number }[] = [];
  for (const x of raw.slice(0, LUOT_SONG_MOI.LENH_TOI_DA)) {
    const o = x as { ma?: unknown; nguong_bp?: unknown; phan_bp?: unknown };
    if (typeof o?.ma !== 'string' || !TAI_SAN.some((t) => t.id === o.ma) || ra.some((l) => l.ma === o.ma)) continue;
    const nguong = Number(o.nguong_bp); const phan = Number(o.phan_bp);
    if (!Number.isInteger(nguong) || nguong < LUOT_SONG_MOI.NGUONG_MIN_BP || nguong > LUOT_SONG_MOI.NGUONG_MAX_BP
      || nguong % LUOT_SONG_MOI.NGUONG_BUOC_BP !== 0) continue;
    if (!(LUOT_SONG_MOI.PHAN_BAN_CHO_PHEP as readonly number[]).includes(phan)) continue;
    ra.push({ ma: o.ma, nguong_bp: nguong, phan_bp: phan });
  }
  return ra.length > 0 ? ra : null;
}
/** v55 (D409) — SÁNG SỔ: ghế mình thấy nấc thanh khoản THẬT của mã đầu cơ (bảng 'sạch'). */
function sangSoCua(st: TrangThaiTran): boolean {
  const g = st.ghe.find((x) => x.id === 'ban');
  return st.trait_bat === true && g !== undefined && rangBuocCua(st, g, st.vong).sangSo;
}
/** v55 (D409) — mốc MUA được phép của ghế (server suy, client vẽ — C4): bước thô + LỆNH MỊN (CẤM TẤT TAY gỡ ở D425). */
function mocChoPhepCua(st: TrangThaiTran, g: Ghe): number[] {
  const rb = st.trait_bat === true ? rangBuocCua(st, g, st.vong) : RANG_BUOC_TRONG;
  const goc: number[] = [];
  for (let m = NAV_V10.BUOC_MOC_THO_BP; m <= 10000; m += NAV_V10.BUOC_MOC_THO_BP) goc.push(m);
  return [...new Set([...goc, ...rb.mocThem])].sort((a, b) => a - b);
}

function chuanHoaLenh(
  raw: unknown,
): { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[] | null {
  if (!Array.isArray(raw)) return null;
  const ra: { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[] = [];
  for (const x of raw.slice(0, 12)) {
    const o = x as { ma?: unknown; chieu?: unknown; moc_bp?: unknown };
    if (typeof o?.ma !== 'string' || !/^[a-z0-9_]{1,16}$/.test(o.ma)) continue;
    if (o.chieu !== 'mua' && o.chieu !== 'ban'
      && o.chieu !== 'khong' && o.chieu !== 'dong_khong') continue;
    const moc = Number(o.moc_bp);
    // Chỉ chặn CẤU TRÚC (nguyên, trong thang). Bước thô/mịn là NGỮ NGHĨA — nó
    // phụ thuộc ghế có cầm Chia Lệnh LÚC ÁP, chỉ engine biết (apLenhMocNav).
    if (!Number.isInteger(moc) || moc <= 0 || moc > 10000) continue;
    ra.push({ ma: o.ma, chieu: o.chieu, moc_bp: moc });
  }
  return ra.length > 0 ? ra : null;
}

/**
 * Sơ đồ ghế: 1 người + (soGhe−1) bot. D25/R3 — bot lộ mặt là bot, cấm tên người.
 *
 * D3 (25/07/2026): số ghế BIẾN THIÊN 4–8, rút từ seed. Nhưng sơ đồ sinh ra ở đây
 * được **LƯU vào `ghe_json`** và replay ĐỌC LẠI từ đó — xem `layTran`. Không bao
 * giờ suy lại sơ đồ từ seed lúc replay: làm vậy là mọi trận đã lưu trên prod (đều
 * 5 ghế) replay ra 4–8 ghế, tức phá sạch lịch sử không dựng lại được.
 */
/**
 * ⚠ EXPORT 03/09/2026 (task A3) — CHỈ cho `scripts/do_cpu_vong_cuoi.ts` dựng sơ đồ
 * ghế giống hệt đường tạo trận thật (kể cả bốc VAI cho map ≥12). Cùng nếp export-
 * cho-đo đã có sẵn của file này (`chuanHoaSuCoKhai`, `hoiTaiTran`, `demTranXong`,
 * `moKhoaTheoTran`) — không đổi hành vi, không đổi chữ ký, chỉ thêm từ khoá.
 */
export function soDoGhe(
  seed: number, userId: string, soGhe = soGheTuSeed(seed),
  khauVi: KhauViId = KHAU_VI_MAC_DINH,
  /**
   * Bậc THẬT của người chơi lúc vào bàn — đọc từ `rank_diem` ở chỗ gọi (hàm này
   * đồng bộ và replay cũng gọi nó, nên nó không được tự truy vấn DB).
   * Mặc định 'chua_xep' là đúng cho replay: bậc lúc vào bàn đã nằm trong
   * `ghe_json` của trận cũ, không bao giờ suy lại từ trạng thái HÔM NAY.
   */
  bacNguoi: BacId = 'chua_xep',
): GheMoi[] {
  const out: GheMoi[] = [{
    id: 'ban', loai: 'nguoi', bac_rank: bacNguoi,
    danh_muc: { tai_san: [], chien_thuat: [] },
    // D6 — khẩu vị LƯU VÀO SƠ ĐỒ GHẾ, không phải state rời: replay đọc lại từ
    // `ghe_json` nên trận cũ giữ nguyên khẩu vị lúc nó được tạo.
    khau_vi: khauVi,
  }];
  for (let i = 0; i < soGhe - 1; i += 1) {
    const bot = BOT_CHOI_DUOC[(seed + i) % BOT_CHOI_DUOC.length]!;
    out.push({
      id: `bot_${i + 1}`, loai: 'bot',
      // GHI danh tính bot xuống sơ đồ. Trước đây `bot` được tính ra rồi bỏ đi,
      // nên đối thủ của trận cũ bị suy lại mỗi lần replay — xem `Ghe.bot_id`.
      bot_id: bot.id,
      bac_rank: BAC_BOT,
      danh_muc: { tai_san: [], chien_thuat: [] },
    });
  }
  void userId;
  return out;
}

/**
 * Bot nào ngồi ghế này.
 *
 * ƯU TIÊN `bot_id` ĐÃ LƯU, chỉ suy lại từ seed khi không có (trận cũ). Suy lại là
 * đường mà thêm/bớt/đổi thứ tự `BOT_CHOI_DUOC` viết lại đối thủ của mọi trận đã
 * lưu — xem docstring `Ghe.bot_id`. Nhánh fallback ở đây KHÔNG gỡ được: trận cũ
 * trên prod không có trường đó và `events` là append-only.
 */
function botCuaGhe(
  seed: number, gheId: string, ghe?: readonly { id: string; bot_id?: string }[],
) {
  const daLuu = ghe?.find((g) => g.id === gheId)?.bot_id;
  if (daLuu) {
    const b = BOT_CHOI_DUOC.find((x) => x.id === daLuu) ?? timBot(daLuu);
    if (b) return b;
    // Archetype đã lưu mà nay không còn trong code: thà suy lại còn hơn nổ giữa
    // trận, nhưng đây là dấu hiệu ai đó vừa xoá một bot khỏi đàn.
  }
  /*
   * Nhánh TRẬN CŨ: suy lại trên ĐÀN BẢN 1 ĐÃ ĐÓNG BĂNG, không phải đàn đang sống.
   * Dùng đàn sống ở đây thì mỗi archetype thêm vào là viết lại đối thủ của mọi trận
   * chưa có `bot_id` — xem `BOT_V1_DONG_BANG`.
   */
  const i = Number(gheId.replace('bot_', '')) - 1;
  const idV1 = BOT_V1_DONG_BANG[(seed + i) % BOT_V1_DONG_BANG.length]!;
  return BOT_CHOI_DUOC.find((b) => b.id === idV1)!;
}

/**
 * D88 — CHƯƠNG HỒI tại trạng thái hiện của trận, suy từ ĐÚNG những biểu
 * thức mà payload công khai dùng (`lich_su_o`/`o_hien_tai`/`xu_huong`/
 * `lai_suat.moi_truong` trong `trangThaiCongKhai`).
 *
 * ⚠⚠ PHẢI ĐỒNG NHẤT VỚI PAYLOAD, không phải "gần giống": client tính chương
 * từ payload bằng CÙNG hàm `chuongHoi` (re-export từ server, D61) — nên hễ
 * hai bên cùng đầu vào là cùng kết quả. Lệch đầu vào ở đây là LờI MỜI khai
 * một hồi trong khi MÀN hiện hồi khác — đổi biểu thức nào dưới đây thì phải
 * đổi cả chỗ tương ứng trong `trangThaiCongKhai` (và ngược lại).
 * Chỉ đọc thông tin CÔNG KHAI (ô qua `oCongKhai` — cờ tin giả đã bị lột).
 */
/**
 * v55 (D422) — LỚP CHE THÔNG TIN của người chơi (MÙ TIN · SƯƠNG MÙ). Một cửa cho mọi chỗ phát ô ra màn (lịch sử ô,
 * lá kết quả vòng, thiên hướng, kỳ họp, chương hồi, chuỗi VÌ SAO): server lột nội dung TRƯỚC khi gửi — client không
 * nhận thứ bị che nên F12 cũng không moi ra được (C4).
 *   · MÙ TIN (founder 26/09): lá TIN lật ra từ vòng tật có hiệu lực ⇒ `{ kind: 'che' }` (mắt gạch chéo), chỉ còn dải
 *     sáu mã tăng/giảm (lợi suất công khai ex-post — không che).
 *   · SƯƠNG MÙ: lá PHA mới lật nhất (chỉ nó — sang vòng sau là tan) ⇒ `{ kind: 'suong', hai_mat }`: mặt thật + một mặt
 *     mồi, thứ tự tất định theo seed.
 * `k` = chỉ số ô trong `map.o` (ô `k` quyết toán vòng `k`, lật ở đầu vòng `k + 1`).
 */
function lopChe(st: TrangThaiTran): {
  cheTin: (k: number, o: OThiTruong | undefined) => boolean;
  suong: (k: number, o: OThiTruong | undefined) => boolean;
  o: (k: number, o: OThiTruong) => ReturnType<typeof oCongKhai> | { kind: 'che' } | { kind: 'suong'; hai_mat: string[] };
} {
  const g = st.ghe.find((x) => x.id === 'ban');
  const tu = (id: TraitId): number | null => (
    g && st.trait_bat === true && (g.trait ?? []).includes(id) ? (g.trait_tu_vong?.[id] ?? null) : null);
  const tuSuong = tu('suong_mu');
  const moiNhat = vongDaLat(st) - 1;
  // MÙ TIN che NGẪU NHIÊN — cùng một cửa với bối cảnh bot (`tinBiChe`, engine).
  const cheTin = (k: number, _o?: OThiTruong) => g !== undefined && tinBiChe(st, g, k);
  const suong = (k: number, o: OThiTruong | undefined) => (
    tuSuong !== null && k >= tuSuong && k === moiNhat && o?.kind === 'giai_doan');
  return {
    cheTin,
    suong,
    o: (k, o) => {
      if (cheTin(k, o)) return { kind: 'che' as const };
      if (suong(k, o) && o.kind === 'giai_doan') {
        const khac = GIAI_DOAN.map((x) => x.id).filter((id) => id !== o.giai_doan);
        const r = rngAt(st.seed, 'holdem_suong_mu', k);
        const moi = khac[r.below(khac.length)]!;
        return { kind: 'suong' as const, hai_mat: r.below(2) === 0 ? [o.giai_doan, moi] : [moi, o.giai_doan] };
      }
      return oCongKhai(o);
    },
  };
}

/** Chuỗi VÌ SAO của người chơi sau lớp che: tên tin / tên pha bị che thì thay bằng dấu che, số giữ nguyên. */
function cheChuoi(chain: readonly MatXich[], cheTin: boolean, suong: boolean): MatXich[] {
  if (!cheTin && !suong) return [...chain];
  return chain.map((m) => {
    if (cheTin && (m.kind === 'echo' || m.kind === 'ct_su_kien')) {
      return { ...m, su_kien: 'che', ...('tu_nhanh' in m && m.tu_nhanh ? { tu_nhanh: 'che' } : {}) } as MatXich;
    }
    if (suong && m.kind === 'tai_san') return { ...m, giai_doan: 'suong' } as MatXich;
    return m;
  });
}

/**
 * v55 (D422) — ĐI SAU: dòng lệnh VÒNG NÀY của các ghế bot, tính trước bằng đúng chuỗi `replay` dùng (`boiCanhLenhVong`
 * → `boiCanhLenhGhe` → `lenhBotNav`). Bot chỉ đọc thông tin công khai + ghế của chính nó (không đọc lệnh người) ⇒ lệnh
 * tính trước khớp lệnh bot sẽ đặt, trừ vòng bot đổi lõi ở nhịp 1 (lõi đổi thì lệnh có thể lệch — "dự kiến").
 * Trả MỨC −3…+3 từng mã theo tiền ròng / NAV cả bàn (1 % · 4 % · 10 %) — server tính, client chỉ vẽ mũi tên (C4).
 */
function dongLenhBan(st: TrangThaiTran, seed: number): { ma: string; muc: number }[] {
  const bc = boiCanhLenhVong(st);
  const rong: Record<string, number> = {};
  let navBan = 0;
  for (const g of st.ghe) if (!g.da_chay) navBan += navCua(g);
  for (const g of st.ghe) {
    if (g.loai !== 'bot' || g.da_chay || !duocChonBai(g)) continue;
    const lb = lenhBotNav(botCuaGhe(seed, g.id, st.ghe), g, st.vong, maxTaiSanCua(st, g), boiCanhLenhGhe(st, g, bc));
    for (const l of lb) rong[l.ma] = (rong[l.ma] ?? 0) + l.tien;
  }
  return TAI_SAN.map((t) => {
    const x = rong[t.id] ?? 0;
    const bp = navBan > 0 ? Math.floor((Math.abs(x) * 10000) / navBan) : 0;
    const muc = bp >= 1000 ? 3 : bp >= 400 ? 2 : bp >= 100 ? 1 : 0;
    return { ma: t.id, muc: x < 0 ? -muc : muc };
  });
}

export function hoiTaiTran(st: TrangThaiTran) {
  /*
   * v53 (D373) — CHƯƠNG HỒI KỂ BẰNG Ô ĐÃ LẬT. Ở v53 ô của vòng còn úp, nên nó KHÔNG được
   * vào lời mời cũng như vào màn: `vongDaLat` là một cửa cho cả hai (xem ⚠ ngay trên —
   * lệch đầu vào ở đây là lời mời khai một hồi còn màn hiện hồi khác).
   */
  const daLat = vongDaLat(st);
  // D422 — lá bị MÙ TIN / SƯƠNG MÙ che thì chương hồi không kể (kể là lộ đúng thứ vừa che).
  const che = lopChe(st);
  const lichSu = st.map.o.slice(0, Math.max(0, daLat - 1))
    .filter((o, k) => !che.cheTin(k, o) && !che.suong(k, o)).map(oCongKhai);
  const oHT0 = daLat >= 1 ? st.map.o[daLat - 1] : undefined;
  const oHT = oHT0 && !che.cheTin(daLat - 1, oHT0) && !che.suong(daLat - 1, oHT0) ? oHT0 : undefined;
  const t = daLat >= 1 ? st.map.trang_thai?.[daLat - 1] : undefined;
  const xuHuong = t && t.run_huong !== 0 && t.run_dai >= QUAN_TINH.NGUONG_CHUOI
    ? { huong: t.run_huong, dai: t.run_dai } : null;
  const moiTruong = st.lai_suat_nen === true
    ? moiTruongTienTe(laiSuatThayDuoc(st) ?? LAI_SUAT_NEN.KHOI_DIEM) : undefined;
  return chuongHoi(lichSu, oHT ? oCongKhai(oHT) : null, xuHuong, moiTruong);
}

/**
 * Replay trận từ log. Trả trạng thái ở đầu vòng `log.length + 1`.
 * Bot chơi nhịp 1 và nhịp 2 của chính chúng ở mỗi vòng.
 */
/**
 * ⭐⭐ DỰNG `ket_qua_vong` — MỘT NGUỒN CHO CẢ `POST /rounds` LẪN `GET /matches/:id`.
 *
 * Tách ra 24/08, trả món nợ D116 tự khai (*"CÒN NỢ: `GET /matches/:id` không phát
 * `ket_qua_vong` ⇒ NẠP LẠI TRANG hoặc vào bằng deep link thì vẫn không có con số
 * và không mở được VÌ SAO"*). Trước hôm nay khối này chỉ tồn tại trong thân route
 * POST, nên mọi thứ nó mang — con số vòng, chuỗi VÌ SAO, phí riêng, SIẾT PHÁP LÝ,
 * gọi ký quỹ — đều sống đúng MỘT phiên: F5 là mất sạch.
 *
 * ⚠ TÁCH THÀNH HÀM DÙNG CHUNG, KHÔNG CHÉP RA BẢN THỨ HAI — D116 ghi rõ điều đó, và
 * lý do thì cả repo biết: bản sao thứ hai không sai lúc viết, nó sai lúc bên kia
 * đổi (D61). Cú trôi ở đây sẽ biểu hiện là "bấm vào con số thì ra một lý do, F5
 * xong bấm lại thì ra lý do khác" — không lỗi, không ai báo.
 *
 * ⚠ Rẻ hơn vẻ ngoài: GET VỐN ĐÃ gọi `replay()` để dựng trạng thái, và `replay` VỐN
 * ĐÃ trả `ketQuaCuoi`. Dữ liệu nằm sẵn ở đó suốt thời gian qua — GET chỉ không đọc.
 * Không thêm một lượt replay nào.
 */
function dungKetQuaVong(
  kq: NonNullable<ReturnType<typeof replay>['ketQuaCuoi']>,
  sau: ReturnType<typeof replay>,
) {
  const cuaBan = kq.ket_qua.find((k) => k.ghe_id === 'ban') ?? null;
  // D302 — cú đổi ô của CHÍNH vòng vừa chốt (ex-post, luật 03 §3). Sổ `phan_than`
  // đã có dòng của vòng KẾ (apPhanThan chạy lúc mở vòng) — hỏi đích danh `kq.vong`.
  const oDoi = oDoiCua(sau.st, kq.vong);
  return {
    /*
     * ⭐ MẪU SỐ ĐI KÈM TỬ SỐ (D123). NAV headline ngay TRƯỚC vòng này — thứ con
     * số lãi/lỗ vòng phải chia cho. Trước hôm nay client tự chụp lúc bấm nộp,
     * nên nạp lại trang là mất mẫu số và con số không dựng lại được.
     * ⚠ KHÔNG dùng `cua_ban.nav_truoc` của engine: D116 đo ra nó lệch dấu 15–40%
     * số vòng vì engine chụp trước Quỹ vòng / ký quỹ / SIẾT PHÁP LÝ.
     * VẮNG MẶT ở trận cũ không NAV.
     */
    ...(sau.navTruocCuoi !== null ? { nav_truoc: sau.navTruocCuoi } : {}),
    /*
     * ⭐ D342 — CẦU NỐI NAV: mọi khoản làm NAV đổi ở vòng này ngoài phần GIÁ (đã ở `tien_theo_ma`).
     * Founder 16/09 (ảnh vòng 2): tấm VÌ SAO nói "Crypto +89" trong khi NAV −1.855 — thiếu phí mua
     * bán −1.832, nộp quỹ −500, nhận quỹ +388. Đây là nợ ghi từ D336 ("server phát bảng cầu nối,
     * không để client tự trừ" — C4). Cộng `tien_theo_ma` + các dòng này = NAV sau − NAV trước,
     * ĐÚNG TỪNG CHIP theo cấu trúc (các mốc nối tiếp nhau, dòng `trong_vong` là phần giữa hai mốc
     * engine sau khi trừ giá). Dòng 0 bị lược. Vắng ở trận không NAV / ghế đã cháy.
     */
    ...((() => {
      const cn = sau.cauNoiCuoi;
      if (!cn || !cuaBan || cuaBan.nav_truoc === undefined || cuaBan.nav_sau === undefined) return {};
      const gia = Object.values(cuaBan.tien_theo_ma ?? {}).reduce((a, b) => a + b, 0);
      const dong = [
        { id: 'huy_so', tien: cn.huy_so },
        { id: 'phi_giao_dich', tien: cn.phi_giao_dich },
        { id: 'phi_bang', tien: cn.phi_bang },
        { id: 'nop_quy', tien: cuaBan.nav_truoc - cn.nav_truoc_chot },
        { id: 'trong_vong', tien: cuaBan.nav_sau - cuaBan.nav_truoc - gia },
        { id: 'quy_vong', tien: cn.nav_sau_chot - cuaBan.nav_sau },
      ].filter((d) => d.tien !== 0);
      return { cau_noi_nav: dong };
    })()),
    /*
     * 12/09 (Q3 — LIÊN KẾT NHÌN THẤY) — THỊ TRƯỜNG CỦA VÒNG: lợi suất công khai
     * (bp) của ĐỦ mọi mã trên bảng, kể cả mã mình không cầm. Thông tin EX-POST và
     * CÔNG KHAI (bảng giá đã lật, ai cũng thấy được nếu nhìn), không phải β, không
     * phải ma trận — đúng M.6.3 HOP-MOAT "cái gì động cùng cái gì, không phải số
     * beta". Client dùng để sáu lá cùng nhích SAU CHỐT (M.2: trước quyết định
     * không tín hiệu). Thứ tự = thứ tự bảng `TAI_SAN`. VẮNG MẶT ở trận không NAV.
     */
    ...(sau.loiSuatCongCuoi
      ? {
        thi_truong_vong: Object.entries(sau.loiSuatCongCuoi)
          .map(([ma, delta_bp]) => ({ ma, delta_bp })),
      }
      : {}),
    /*
     * v54 (D395) — THANH KHOẢN CỦA VÒNG: sổ lệnh sáu mã NGAY SAU lá vừa lật, đúng phép tính của Bảng
     * điện tử (`thanhKhoanCongKhai` — tin coi là THẬT, mã đầu cơ `vach: null`). Founder 24/09: thước
     * thanh khoản *"co dãn theo thẻ sự kiện đang được lật"*. Client cho thước ở dải 6 mã co/giãn TRONG
     * nhịp lật rồi thả về vạch nền khi vào vòng mới (M.2: trước quyết định không tín hiệu).
     * ⚠ Tin coi là THẬT cố ý: tin giả chỉ lộ sau một vòng (`daLoTinGia`); trả nấc engine thật ở đây là
     * lộ cờ giả sớm một vòng qua cửa miễn phí — đúng thứ gate G4 đo. Cùng quy ước với bảng.
     * ⚠ Mã đầu cơ (sương mù) chỉ có `vach: null`, KHÔNG kèm `bien_vach`: biên của bảng cố ý lệch khỏi nấc
     * thật 30% số lần (luật 2, founder 26/07) — thứ chấp nhận được ở hàng TRẢ PHÍ, nhưng trên thước miễn phí
     * nó làm Crypto "giãn" dưới một lá không chạm sổ (soi mắt D395 bắt đúng ca này), và còn bán lại hàng của bảng.
     * ⚠ CHỈ trận bật cổng năm nấc (`thanh_khoan_nam_nac`, v54) — không phải mọi trận NAV. Trận v53 (mặc định
     * prod) và v45 (đề buổi đo) giữ nguyên màn: thêm một kênh thông tin giữa đợt đo là đổi phép đo; và dưới thang
     * ba nấc lá CẠN THANH KHOẢN không chạm sổ nào, nên thước ở đó sẽ phơi đúng chỗ lệch mà D395 sinh ra để sửa.
     */
    ...(sau.loiSuatCongCuoi && sau.st.thanh_khoan_nam_nac === true
      ? {
        thanh_khoan_vong: thanhKhoanCongKhai(sau.st, sangSoCua(sau.st)).thanh_khoan.map((t) => ({
          ma: t.tai_san_id, tong_vach: t.tong_vach, vach_nen: t.vach_nen, vach: t.vach,
        })),
      }
      : {}),
    vong: kq.vong,
    // D422 — lá của vòng vừa chốt đi qua lớp che (MÙ TIN: che · SƯƠNG MÙ: hai mặt).
    o: lopChe(sau.st).o(kq.vong, kq.o),
    // Tin giả vừa lộ mà chính lá tin ấy đang bị MÙ TIN che ⇒ không lộ tên (lộ là mở lại đúng lá đã che).
    tin_gia_lo: kq.tin_gia_lo && lopChe(sau.st).cheTin(kq.tin_gia_lo.vong, sau.st.map.o[kq.tin_gia_lo.vong])
      ? null : kq.tin_gia_lo,
    quy_vong: kq.quy_vong,
    /*
     * ⭐ D402 — GIẢI VÒNG TRẢ VỀ GHẾ: phần quỹ từng ghế nhận (chỉ ghế > 0), hạng theo đúng thứ tự engine chia (lãi/lỗ
     * vòng giảm dần). Founder 24/09: *"TRẢ giải về 3 ghế đầu cùng nhịp LÃI/LỖ"* — client vẽ xu bay từ hộp GIẢI về từng
     * ghế; số là của server (C4). EX-POST: chỉ có trong kết quả vòng ĐÃ chốt (lá đã lật), nên không lộ gì trước lá.
     * Không lộ thêm thông tin: vốn trước/sau của đối thủ đã có trong `cua_doi_thu` từ lâu. Vắng khi không ai nhận gì.
     */
    ...(sau.chiaQuyCuoi && sau.chiaQuyCuoi.length > 0 ? { chia_quy_vong: sau.chiaQuyCuoi } : {}),
    /*
     * v55 (D409) — LỬA của mình cuối vòng: nấc trước/sau, lý do dập, xu thêm, lửa đặc biệt. Diễn ở bước PHONG CÁCH của
     * nhịp kết quả (A11.26). Vắng ở trận không lửa. D422: MÙ LỬA thay LỬA GIẢ — lửa người mang luôn tắt ngay ở engine,
     * nên đây là số thật; cờ `mu_lua` để màn vẽ ngọn lửa bịt mắt thay vì lửa tàn.
     */
    ...((): Record<string, unknown> => {
      const l = (kq.lua ?? []).find((x) => x.ghe_id === 'ban');
      const gb = sau.st.ghe.find((g) => g.id === 'ban');
      if (!l || !gb) return {};
      const rb = sau.st.trait_bat === true ? rangBuocCua(sau.st, gb, sau.st.vong) : RANG_BUOC_TRONG;
      return {
        lua: {
          truoc: l.truoc?.nac ?? 0, sau: l.sau.nac, dap: l.dap, xu_them: l.xu_them,
          xu: gb.xu ?? 0, dac_biet: l.sau.dac_biet === true, ...(rb.muLua ? { mu_lua: true } : {}),
        },
      };
    })(),
    ghe_thang: kq.ghe_thang,
    chay_vong_nay: kq.chay_vong_nay,
    /*
     * PHÍ CỦA RIÊNG MÌNH — phải gửi, và UI phải VẼ.
     *
     * ⚠ `phi_dung_ngoai` đã tồn tại trong `KetQuaVong` của engine từ lâu,
     * kèm docstring "Phải trả ra để UI cho thấy — đứng ngoài mà không thấy
     * mình đang chảy máu thì người chơi tưởng đó là lựa chọn miễn phí,
     * đúng thứ cơ chế này chống." Nhưng response CHƯA BAO GIỜ mang nó ra,
     * và `web/src` chưa có một dòng nào đọc nó. Lại là một bất biến chỉ nằm
     * trong comment.
     *
     * `giam_dap` là thứ RIÊNG và quan trọng nhất phải nói: "tôi mất gấp đôi
     * vì cả bàn cùng chạy một cửa" là bài học khác hẳn "tôi mất phí".
     */
    /*
     * ⭐ SỔ TIẾT KIỆM CỦA RIÊNG MÌNH — v43, và nó phải ra khỏi engine vì ĐÚNG lý do
     * `phi_cua_ban` ngay dưới tồn tại: tiền vừa đổi chỗ mà màn hình không nói vì sao
     * là lớp lỗi D67. Ba loại, ba câu khác hẳn nhau:
     *   · `lai`     — sổ vừa cộng lãi, tiền đang lớn lên trong lúc mình không làm gì;
     *   · `dao_han` — gốc + lãi vừa về ví, đây là lúc tiền dùng được trở lại;
     *   · `huy`     — `lai_mat` là con số MẤT SẠCH vì đổi ý sớm. Đây là câu quan
     *     trọng nhất cả cơ chế, và nếu chỉ để NAV tụt thì người chơi thấy mình nghèo
     *     đi mà không biết chính cú bấm của mình vừa đốt bao nhiêu.
     * ⚠ A3.1 — LỌC VỀ GHẾ MÌNH. Sổ của đối thủ là thông tin ẩn (biết họ khoá bao
     * nhiêu tới vòng nào là đọc được lúc nào họ không thể mua).
     * ⚠ VẮNG MẶT khi không có gì xảy ra — trận cũ và trận không ngân hàng phải trông
     * y hệt như trước, nếu không thì mọi so sánh golden lệch mà chẳng luật nào đổi.
     */
    ...(() => {
      const cua = (kq.tiet_kiem ?? []).filter((x) => x.ghe_id === 'ban');
      return cua.length > 0
        ? { tiet_kiem: cua.map(({ ghe_id, ...r }) => r) }
        : {};
    })(),
    phi_cua_ban: (() => {
      const cl = kq.phi_cat_lo.find((x) => x.ghe_id === 'ban');
      if (cl) return { loai: 'cat_lo' as const, mat: cl.mat, giam_dap: cl.giam_dap };
      const dn = kq.phi_dung_ngoai.find((x) => x.ghe_id === 'ban');
      if (dn) return { loai: 'dung_ngoai' as const, mat: dn.mat, giam_dap: false };
      return null;
    })(),
    /** Bao nhiêu phần lobby cùng cắt lỗ vòng này (bp) — để kể chuyện giẫm đạp. */
    ty_le_cat_lo_bp: kq.ty_le_cat_lo_bp,
    /*
     * v42 (D311) — HAI DÒNG TIỀN MỚI CỦA RIÊNG MÌNH, cùng lý lẽ với `phi_cua_ban`
     * ngay trên: một khoản tiền chạy vào/ra ví mà màn không kể được thì người chơi
     * đọc nó là "NAV tự nhúc nhích". Engine trả ra rồi mà response không mang đi là
     * đúng cái nợ mà docstring `phi_dung_ngoai` phía trên đã kể một lần.
     * VẮNG khi cổng tắt (trận cũ không có trường này) hoặc khi vòng đó không có gì.
     */
    ...((() => {
      const cp = (kq.coupon ?? []).filter((x) => x.ghe_id === 'ban');
      if (cp.length === 0) return {};
      return {
        coupon_cua_ban: cp.map((x) => ({ ma: x.ma, tien: x.tien, khong: x.khong })),
      };
    })()),
    // D498 — PHÍ QUẢN LÝ của Tổ Chức: chip vào ví mỗi vòng, cùng lý lẽ `coupon_cua_ban` (không kể thì người chơi đọc là "NAV tự nhúc nhích").
    ...((() => {
      const ql = (kq.quan_ly ?? []).find((x) => x.ghe_id === 'ban');
      return ql && ql.tien > 0 ? { quan_ly_cua_ban: { nav: ql.nav, tien: ql.tien } } : {};
    })()),
    /*
     * v46 (D338) — LÃI VAY ĐÒN BẨY của riêng mình, cùng lý lẽ `coupon_cua_ban`: chip rời ví mỗi ô
     * mà màn không kể thì người chơi đọc là "NAV tự tụt". VẮNG khi cổng tắt hoặc ô này không trả gì.
     */
    ...((() => {
      const lv = (kq.lai_vay_don_bay ?? []).find((x) => x.ghe_id === 'ban');
      return lv && lv.lai > 0
        ? { lai_vay_cua_ban: { vay: lv.vay, lai_bp: lv.lai_bp, lai: lv.lai } } : {};
    })()),
    ...((() => {
      const tm = (kq.tien_mat_su_kien ?? []).find((x) => x.ghe_id === 'ban');
      return tm && tm.mat !== 0
        ? { tien_mat_cua_ban: { mat: tm.mat, chi_tiet: tm.chi_tiet } } : {};
    })()),
    /*
     * v34 — SIẾT PHÁP LÝ của riêng mình. VẮNG MẶT khi không bị siết (không
     * null): trận không vai và client cũ không phải phân nhánh. Phải gửi
     * vì cùng lý do với `phi_cua_ban`: đội lái mất 1.500 chip mà màn không
     * nói một chữ thì đó là "Vốn tự tụt", không phải một cái giá học được.
     */
    ...((() => {
      const sd = kq.siet_doi_lai.find((x) => x.ghe_id === 'ban');
      return sd ? { siet_cua_ban: { mat: sd.mat } } : {};
    })()),
    /*
     * ⚠⚠ GỌI KÝ QUỸ CỦA RIÊNG MÌNH — nối 24/08, nợ khai từ D37 (27/07) và
     * nhắc lại ở D108. Engine tính `goi_ky_quy` từ v8 và trả ra ở
     * `chotPhien` (`engine.ts:3266`), nhưng KHÔNG một dòng nào đọc: grep
     * `goi_ky_quy` trong `server/holdem_api.ts` lẫn `web/src` đều ra RỖNG,
     * trong khi các trường ANH EM cùng return object (`phi_cat_lo`,
     * `siet_doi_lai`, `ty_le_cat_lo_bp`) đều đã đi trọn đường.
     *
     * ⚠ Nói đúng phạm vi: engine KHÔNG "lấy tiền im lặng" — tiền CÓ hiện,
     * nó nằm trong con số NAV headline (ảnh chụp trạng thái lấy SAU cú
     * trừ). Thứ chết là LỜI GIẢI THÍCH, và điều đó làm bệnh NẶNG hơn chứ
     * không nhẹ hơn: người chơi thấy NAV tụt một khoản không ai kể được vì
     * sao — đúng bệnh "Vốn tự tụt" mà D110/D114 đi vá cho `siet_cua_ban`.
     *
     * ⚠ Và nó đang nổ THẬT, không phải cơ chế ngủ: v34 bật cả `kyQuyRong`
     * (nổ ở ô THƯỜNG, không riêng Sập sàn) lẫn `kyQuyTuNav` (trừ từ NAV
     * nên all-in không né được). Đo 4.000 trận × 8 vòng × 5 ghế trên đúng
     * bộ luật v34: 1.069 cú / 32.000 vòng-ghế = 3,34%, **19,3% số trận có
     * ít nhất một cú**, trung bình 684 chip mỗi cú, và dồn về cuối trận
     * (v1=1 · v4=102 · v6=203 · v8=288).
     *
     * VẮNG MẶT khi không bị gọi (không null) — cùng lý lẽ với `siet_cua_ban`.
     */
    ...((() => {
      const gk = kq.goi_ky_quy.find((x) => x.ghe_id === 'ban');
      return gk ? { ky_quy_cua_ban: { mat: gk.mat } } : {};
    })()),
    /*
     * D88 §11.2 — ỐNG KÍNH CON ĐƯỜNG: một dòng hồi cố do con đường đã
     * chọn quyết định. VẮNG MẶT khi chưa chọn (không phải null) — client
     * cũ không phải phân nhánh. Không một bit thông tin MỚI nào: toàn số
     * engine đã tính cho vòng VỪA chốt (xem `ongKinhVong`).
     */
    ...(sau.kyNgo.ongKinh ? { ong_kinh: sau.kyNgo.ongKinh } : {}),
    // Diễn biến cược theo thứ tự — UI diễn lại từng nước của đối thủ.
    nhat_ky: sau.nhatKyCuoi,
    // DÂY CHUYỀN — vừa là bảng "vì sao" vừa là kịch bản hoạt hình.
    cua_ban: cuaBan
      ? {
        ...cuaBan,
        // D422 — chuỗi VÌ SAO qua lớp che: tên tin (MÙ TIN) / tên pha (SƯƠNG MÙ) của lá vừa lật bị thay bằng dấu che.
        chain: cheChuoi(cuaBan.chain, lopChe(sau.st).cheTin(kq.vong, kq.o), lopChe(sau.st).suong(kq.vong, kq.o)),
        hanh_dong: suyHanhDong(cuaBan, nenVongCua(sau.st)), da_hit: sau.hitVongCuoi.has('ban'),
        ...huongLenhDTO(sau.huongLenhCuoi, 'ban'),
      }
      : null,
    // Kèm cam kết + vốn trước/sau để UI dựng khoảnh khắc ALL IN / ×2.
    // KHÔNG kèm `chain` của đối thủ — danh mục đối thủ là thông tin ẩn.
    cua_doi_thu: kq.ket_qua.filter((k) => k.ghe_id !== 'ban')
      .map((k) => ({
        ghe_id: k.ghe_id, pnl_bp: k.pnl_bp, da_cat_lo: k.da_cat_lo,
        cam_ket: k.cam_ket, von_truoc: k.von_truoc, von_sau: k.von_sau,
        hanh_dong: suyHanhDong(k, nenVongCua(sau.st)),
        da_hit: sau.hitVongCuoi.has(k.ghe_id),
        // D302 — VÀO/RA/ĐẢO/ĐỨNG của vòng vừa chốt: cái đối thủ ĐÃ làm, lộ sau khi ô
        // lật (cùng luật ex-post với `da_hit`); trận cũ không NAV thì vắng mặt.
        ...huongLenhDTO(sau.huongLenhCuoi, k.ghe_id),
      })),
    ...(oDoi ? { o_doi: oDoi } : {}),
  };
}

/**
 * ⚠ EXPORT 03/09/2026 (task A3) — CHỈ cho `scripts/do_cpu_vong_cuoi.ts` gọi ĐÚNG
 * hàm production dùng ở `POST /rounds` (hai lần, dòng ~3910/~3976 — số đã lệch vài
 * dòng sau khi thêm docstring này) để đo CPU thật, thay vì dựng một bản mô phỏng
 * thứ hai mà chắc chắn sẽ trôi (D61). Cùng nếp export-cho-đo đã có sẵn của file
 * này (`chuanHoaSuCoKhai`, `hoiTaiTran`, `demTranXong`, `moKhoaTheoTran`) — không
 * đổi hành vi, không đổi chữ ký, chỉ thêm từ khoá.
 */
export function replay(
  seed: number, log: readonly HanhDongLog[],
  /**
   * true → khi chạm lượt người chơi mà chuỗi `cuoc` đã cạn thì NÉM
   * `DungOLuotBan` thay vì mặc định THEO. Dùng cho endpoint lượt-chờ.
   */
  dungOLuotBan = false,
  /**
   * D3 — SƠ ĐỒ GHẾ ĐÃ LƯU của trận này (`ghe_json`).
   *
   * ⚠ TRUYỀN VÀO, ĐỪNG SUY LẠI. Bản trước gọi `soDoGhe(seed, '')` — chuỗi rỗng,
   * khác hẳn `soDoGhe(seed, uid)` lúc tạo trận. Vô hại lúc đó CHỈ VÌ `soDoGhe` bỏ
   * qua userId; một cái bẫy đang ngủ. Với lobby 4–8 thì suy lại còn tệ hơn nhiều:
   * mọi trận đã lưu trên prod (đều 5 ghế) sẽ replay ra số ghế khác.
   */
  gheDaLuu?: readonly GheMoi[],
  /**
   * BỘ LUẬT CÂN BẰNG CỦA CHÍNH TRẬN NÀY (mặc định TẮT HẾT, và mặc định đó là
   * bắt buộc). Lấy bằng `luatCua(row.balance_version)` — xem `layTran`.
   *
   * · `botTuQuyetCamKet` (D30) — bot dùng `chonCamKet` cho lượt ĐẦU của nó trong
   *   vòng, y hệt cách người chơi dùng `hanh_dong`.
   * · `luatVon` (27/07) — bật Đảo danh mục + Khoá tài sản 2 vòng trong engine.
   *
   * ⚠ VÌ SAO PHẢI CÓ CỔNG, KHÔNG BẬT THẲNG: hành vi bot được SUY LẠI mỗi lần
   * replay chứ không đọc từ log, và luật vốn đổi cả dây chuyền chấm điểm. Đổi
   * hai thứ đó mà không gán cổng = mọi trận đã lưu replay ra kết quả KHÁC — im
   * lặng, không lỗi, lịch sử hỏng vĩnh viễn.
   *
   * ⚠ MỘT THAM SỐ OBJECT, KHÔNG PHẢI HAI BOOLEAN CẠNH NHAU. Hai boolean cùng
   * kiểu đứng liền nhau thì gọi nhầm thứ tự là trình biên dịch IM LẶNG — đúng
   * cái bẫy đã dính trong repo này. Object bắt gọi đúng tên trường.
   */
  luat: BoLuatCanBang = LUAT_TAT,
  /**
   * LUẬT 3 — phí mở bảng của vòng ĐANG CHƠI, chưa có dòng vòng để gộp vào
   * (`MoBangCho`). Áp SAU khi chạy hết log, tức lên đúng trạng thái đầu vòng
   * hiện tại — cùng mốc mà nhánh trong vòng lặp áp cho các vòng đã nộp.
   */
  moBangCho = 0,
  /** D33 — đuôi chờ nộp của vòng đang chơi đã trả tiền cho hạng CÓ DỰ BÁO chưa. */
  duBaoCho = false,
  /**
   * D31/02-08 — cỡ map ĐÃ LƯU của trận (`holdem_matches.so_o`). Vắng = trận
   * cũ → MAP_SIZE mặc định. Lấy từ `layTran`, KHÔNG bao giờ từ request.
   */
  soO?: number,
  /**
   * KHỚP LỆNH GIỮA VÒNG đang chờ nộp (đuôi `MoBangCho.khop` của vòng hiện tại).
   * Áp SAU phí bảng chờ — cùng thứ tự với dòng vòng đã nộp (phí đầu vòng, lệnh
   * ở nhịp giao dịch), nên Vốn người chơi thấy lúc khớp đúng bằng Vốn replay
   * dựng lại sau khi vòng được nộp.
   */
  khopCho: readonly { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[][] = [],
  /**
   * D475 — MÀN MINIGAME của vòng vừa nộp ĐÃ HẾT GIỜ (chỉ `layTran` quyết, theo đồng hồ — replay vẫn thuần): áp kết quả màn vào khoản ở đầu
   * vòng đang chơi, TRƯỚC phí bảng và khớp giữa vòng — đúng chỗ trường `mg` của dòng log vòng này sẽ áp khi đã nộp.
   */
  manCho?: { vong: number; lenh: readonly LenhMan[]; bc?: BoiCanhMan },
): {
  st: TrangThaiTran;
  /** D475 — kết quả màn đã áp ở đuôi `manCho` (cả bàn) — cú nộp chép NGUYÊN vào `mg` của dòng log. Null khi không áp. */
  mgCho: MgVong | null;
  /** D475 — kết quả màn của ghế người chơi (đuôi `manCho`) — để màn KẾT QUẢ / QUYẾT TOÁN hiện. */
  manKetQua: KetQuaManGhe | null;
  /** D561 — kết quả từng màn con của người (khoá nhiều mã). */
  manKetQuaNhieu?: KetQuaManGhe[];
  ketQuaCuoi: ReturnType<typeof giaiQuyetVong>['ketQua'] | null;
  /**
   * 12/09 (Q3) — bảng lợi suất CÔNG KHAI (bp theo mã, đủ mọi mã) của vòng vừa
   * chốt; engine đã tính sẵn (`chotPhien().loiSuatCong`), replay chỉ nhặt. Đứng
   * ngoài `ketQuaCuoi` để golden không đổi. `null` khi chưa chốt vòng nào / trận
   * không NAV.
   */
  loiSuatCongCuoi: Record<string, number> | null;
  /**
   * CHART TÀI SẢN (founder 07/10: *"thêm 1 nút cửa sổ … chart các loại tài sản để bấm vào xem lịch sử qua các vòng"*) —
   * `loiSuatCongCuoi` của MỌI vòng đã chốt, theo thứ tự vòng. Công khai ex-post như `thi_truong_vong`: chỉ gom lại thứ
   * từng vòng đã phát. Đứng ngoài `ketQuaCuoi` ⇒ golden không đổi. Rỗng ở trận không NAV / chưa chốt vòng nào.
   */
  lichSuThiTruong: { vong: number; ls: Record<string, number>; laiSuat: number | null }[];
  /**
   * D402 — phần quỹ vòng từng ghế nhận ở vòng vừa chốt (engine `chotPhien().chiaQuy`, replay chỉ nhặt). Đứng ngoài
   * `ketQuaCuoi` để golden không đổi. `null` khi chưa chốt vòng nào / không ai nhận gì.
   */
  chiaQuyCuoi: readonly { ghe_id: string; hang: number; tien: number; xu?: number }[] | null;
  /** v55 (D409) — sự kiện MỐC TRAIT của vòng vừa chốt (mọi ghế); null khi vòng ấy không phải mốc. */
  mocTraitCuoi: SuKienMocTrait[] | null;
  /** NAV headline ngay TRƯỚC vòng vừa chốt — mẫu số của con số lãi/lỗ vòng. */
  navTruocCuoi: number | null;
  /**
   * D342 — CẦU NỐI NAV của vòng vừa chốt, phần TRƯỚC khi engine chốt phiên: NAV mất vì huỷ sổ,
   * vì phí mua bán (trượt giá + vội vàng), vì phí mở bảng; cùng NAV ngay trước và ngay sau chốt.
   * `dungKetQuaVong` ghép với số của engine thành `cau_noi_nav`. ⚠ Golden KHÔNG băm trường này
   * (`trichXuat` chọn trường đích danh). Null ở trận không NAV / ghế đã cháy.
   */
  cauNoiCuoi: {
    huy_so: number; phi_giao_dich: number; phi_bang: number;
    nav_truoc_chot: number; nav_sau_chot: number;
  } | null;
  /** Ghế nào đã HIT (mua thẻ) ở vòng VỪA XỬ LÝ — để UI cho thấy bot làm gì. */
  hitVongCuoi: Set<string>;
  /**
   * PHONG CÁCH — từng vòng ĐÃ CHỐT của ghế `'ban'`, gom NGAY TRONG REPLAY.
   *
   * ⚠ Gom ở đây chứ không query `events`: replay vốn đã chạy `chotPhien` cho mọi
   * vòng, nên số này là SẢN PHẨM PHỤ MIỄN PHÍ và tất định theo (seed, log). Đọc
   * lại từ events thì vừa tốn một câu truy vấn mỗi request, vừa đẻ nguồn chân lý
   * thứ hai cho cùng một con số (D61).
   */
  pcVong: VongPhongCach[];
  /**
   * PHONG CÁCH THEO TỪNG GHẾ — cùng dữ liệu, khoá theo `ghe_id` (D312).
   *
   * ⚠ `pcVong` ở trên là LÁT `'ban'` của bản đồ này, không phải một nguồn thứ
   * hai: nó được gán từ chính `pcTheoGhe.get('ban')`. Founder 08/09 bỏ số tiền
   * của đối thủ khỏi dải ghế và thay bằng HẠNG PHONG CÁCH, nên hạng ấy phải
   * chấm trên hành vi của CHÍNH ghế đó — chép hạng của người chơi sang là nói
   * dối, và nói dối ở đúng chỗ D25 gọi là "cái để mất".
   */
  pcTheoGhe: Map<string, VongPhongCach[]>;
  /** KHẨU VỊ (D106) — tiền mặt/NAV + số mã sau mỗi vòng đã chốt, ghế `'ban'`. */
  kvVong: KhauViVong[];
  /** Diễn biến vòng cược VỪA XỬ LÝ, theo đúng thứ tự — UI diễn lại được. */
  nhatKyCuoi: NhatKyCuoc[];
  /** D302 — hướng lệnh từng ghế ở vòng vừa chốt (trận NAV); rỗng ở trận cũ. */
  huongLenhCuoi: Map<string, HuongLenh>;
  /**
   * LÕI VỐN — vì sao lệnh đảo / khoá của vòng VỪA XỬ LÝ bị bỏ qua (nếu có).
   *
   * ⚠ Lấy TỪ CHÍNH ĐƯỜNG CHẠY THẬT chứ không kiểm lại một lần nữa ở endpoint.
   * Kiểm lại là dựng nguồn chân lý thứ hai cho cùng một luật, và nó sẽ lệch ngay
   * ở ca đầu tiên: hai hàm `ap*` chạy SAU `mua`, nên "khoá lá vừa mua vòng này"
   * hợp lệ ở đây mà một phép kiểm trên trạng thái đầu vòng sẽ báo `khong_nam_ma`.
   * Cả hai `ap*` bỏ qua im lặng khi hỏng (giống `mua`); trường này là chỗ duy
   * nhất người chơi biết được vì sao nút mình bấm không có tác dụng.
   */
  loiVonCuoi: {
    dao?: LoiDao; khoa?: LoiKhoa; short?: LoiShort; tiet_kiem?: LoiTietKiem;
    lenh?: LoiLenh | 'moc_khong_hop_le' | 'nav_tat' | 'khong_chon_bai_duoc';
  };
  /**
   * v32 — TIẾN TRÌNH KỲ NGỘ suy từ log (doc 06 §1.4).
   *
   * Trả ra từ ĐÂY chứ không tính lại ở endpoint: đây là chỗ duy nhất chạy qua
   * từng vòng và cầm `KetQuaGhe` của mỗi vòng. Tính lại ở tầng trên là bản cài
   * đặt thứ hai của cùng một phép chấm, và bản thứ hai sẽ trôi (D61) — cú trôi
   * ở đây biểu hiện là màn báo "đã xong nhiệm vụ" trong khi Vốn vẫn bị trừ phí
   * mở bảng, tức người chơi thấy một đặc quyền không tồn tại.
   */
  kyNgo: {
    lan: LanKyNgo[];
    /**
     * D88 §11.2 — ỐNG KÍNH: dòng soi của VÒNG VỪA XỬ LÝ, theo con đường
     * MỚI NHẤT đã chốt. `null` = chưa chọn con đường nào / vòng không có
     * số liệu (trận không NAV). Tính ở ĐÂY vì đây là chỗ duy nhất cầm
     * `VongKyNgo` của từng vòng — tính lại ở endpoint là bản sao thứ hai (D61).
     */
    ongKinh: OngKinh | null;
    /** Đặc quyền → vòng ĐẦU TIÊN nó có hiệu lực. Xem `dacQuyenKyNgo`. */
    dacQuyen: Map<DacQuyenKyNgoId, number>;
    /**
     * PHIẾU QUYẾT ĐỊNH — còn phiếu để MIỄN vòng đang chơi hay không.
     *
     * ⚠⚠ CỐ Ý ĐẾM TỚI ĐẦU VÒNG NÀY, chưa trừ lần mở đang treo của chính vòng
     * này. `/bang-dien-tu` PHẢI dùng đúng con số này để quyết miễn/thu, vì
     * `apPhiMoBang` trong replay cũng quyết bằng nó. Trừ sớm ở đây thì ca "còn
     * ĐÚNG 1 phiếu, mở bảng rồi nâng hạng trong cùng vòng" sẽ ra: endpoint thu
     * 30 chênh lệch trong khi replay miễn trọn vòng — đúng lớp lỗi "màn báo một
     * đằng, engine trừ một nẻo" (D67). Muốn HIỆN cho người chơi thì dùng
     * `phieuHienThi`.
     */
    phieu: number;
    /**
     * PHIẾU ĐỂ HIỂN THỊ — đã trừ lần mở của CHÍNH vòng này.
     *
     * Tách khỏi `phieu` vì hai câu hỏi khác nhau: "còn quyền miễn không" (quyết
     * định) và "tôi còn mấy phiếu" (hiển thị). Dùng chung một số thì hoặc màn
     * nói dối (khoe 2 phiếu trong khi 1 đang bị tiêu), hoặc đường tiền lệch.
     */
    phieuHienThi: number;
    /** Ô nào là ô ĐỔI PHA (chỉ số 0 = ô 1) — nền của CHUÔNG ĐỔI PHA. */
    doiPha: boolean[];
  };
  /** D475 — NAV của ghế người chơi ngay TRƯỚC khi áp màn ở đuôi (null khi không áp) — dòng QUYẾT TOÁN "NAV trước → sau". */
  navTruocMan: number | null;
} {
  /*
   * ⚠ TRUYỀN TRỌN BỘ LUẬT, KHÔNG CHÉP TAY TỪNG CỜ — sửa 28/07, và đây là lỗi
   * nặng nhất đợt rà: bản cũ chỉ truyền `{luatVon, dacQuyen}`, nên Ở TẦNG API —
   * tức SẢN PHẨM THẬT — `tuongQuan` (ma trận D39), `kyQuyRong` (D37.5) và cả
   * `cuocTat` (bản vá chặn cú chảy máu 10.000 → 2.886) CHƯA BAO GIỜ BẬT.
   * Mọi test engine xanh vì chúng gọi `taoTran` với đủ cờ; trận thật thì không.
   * Cơ chế trang trí lần thứ 11 — lần này ở đúng cửa ngõ sản phẩm.
   *
   * Hệ quả replay đã cân nhắc: trận v8/v9 đã lưu nay replay DƯỚI ĐÚNG BỘ LUẬT
   * PHIÊN BẢN CHÚNG KHAI (trước đây replay thiếu cờ). Kết quả dựng lại có thể
   * đổi so với thứ từng hiện — chấp nhận theo D40 ("beta, chưa trận thật nào
   * đáng giữ; cắt sạch mô hình cũ") thay vì phong thánh một bug thành lịch sử.
   *
   * `BoLuatCanBang` ⊇ `CongLuatTran` về cấu trúc — cờ thừa (`botTuQuyetCamKet`)
   * taoTran không đọc; cờ THIẾU thì hết đường thiếu vì không còn ai chép tay.
   */
  let st = taoTran(seed, gheDaLuu ?? soDoGhe(seed, ''), luat, soO);
  let cuoi: ReturnType<typeof giaiQuyetVong>['ketQua'] | null = null;
  let loiSuatCongCuoi: Record<string, number> | null = null;
  const lichSuThiTruong: { vong: number; ls: Record<string, number>; laiSuat: number | null }[] = [];
  let chiaQuyCuoi: readonly { ghe_id: string; hang: number; tien: number; xu?: number }[] | null = null;
  let mocTraitCuoi: SuKienMocTrait[] | null = null;
  /**
   * ⭐ NAV HEADLINE NGAY TRƯỚC VÒNG VỪA CHỐT — mẫu số của con số lãi/lỗ vòng.
   *
   * ⚠⚠ PHẢI LÀ HEADLINE, KHÔNG PHẢI `cua_ban.nav_truoc` CỦA ENGINE. D116 đo ra
   * engine chụp `nav_truoc`/`nav_sau` TRƯỚC khi chia Quỹ vòng, trước gọi ký quỹ
   * và trước SIẾT PHÁP LÝ, nên hiệu của chúng lệch với cú đổi NAV mà người chơi
   * NHÌN THẤY ở 100% số vòng có lệnh và ĐỔI DẤU ở 15–40%. Client vì thế tự chụp
   * NAV lúc bấm nộp — đúng, nhưng cú chụp ấy chết khi nạp lại trang.
   * ⇒ Server chụp CÙNG một đại lượng (`navCua` — thứ `trangThaiCongKhai` phát ra
   *   dưới tên `ban.nav`) ngay trước khi vòng giải. Nay mẫu số ĐI KÈM tử số
   *   (D123), nên POST và GET không thể lệch nhau: cả hai đọc một con số.
   */
  let navTruocCuoi: number | null = null;
  let cauNoiCuoi: ReturnType<typeof replay>['cauNoiCuoi'] = null;
  /**
   * NAV ghế người chơi (null nếu không NAV / đã cháy) — mốc đo cầu nối D342.
   *
   * ⚠ `keCaChay` (D346): ở ĐÚNG vòng ghế cháy, NAV sau chốt vẫn là một con số thật và `ban.nav`
   * của DTO vẫn phát nó ra. Chụp null ở đó thì cả cầu nối rơi về `null` ⇒ tấm VÌ SAO của chính cái
   * vòng người chơi mất nhiều nhất KHÔNG kể một dòng nào (đo được: thiếu đúng 500 nộp quỹ). Vòng
   * SAU khi đã cháy thì không có `ket_qua_vong` nữa nên không có gì để nối.
   */
  const navBanCua = (s0: TrangThaiTran, keCaChay = false): number | null => {
    const g = s0.ghe.find((x) => x.id === 'ban');
    if (s0.nav !== true || !g) return null;
    return keCaChay || !g.da_chay ? navCua(g) : null;
  };
  let hitVongCuoi = new Set<string>();
  let nhatKyCuoi: NhatKyCuoc[] = [];
  let huongLenhCuoi = new Map<string, HuongLenh>();
  const pcTheoGhe = new Map<string, VongPhongCach[]>();
  const kvVong: KhauViVong[] = [];
  let loiVonCuoi: {
    dao?: LoiDao; khoa?: LoiKhoa; short?: LoiShort; tiet_kiem?: LoiTietKiem;
    lenh?: LoiLenh | 'moc_khong_hop_le' | 'nav_tat' | 'khong_chon_bai_duoc';
  } = {};

  /*
   * ─── v32 KỲ NGỘ — ba sổ suy từ log, không cột DB nào ─────────────────────
   *
   * `chonKyNgo` đọc từ `HanhDongLog.ky_ngo`; `soLieuKyNgo` gom từ `KetQuaGhe`
   * của ghế `'ban'` mỗi vòng (`vi_the_truoc`/`loi_suat_ma`/`brier` — engine phát
   * ra từ đúng chỗ tính Brier, không tính lại); `moBangTheoVong` để đếm phiếu.
   * Cả ba là hàm thuần của `action_log` ⇒ replay dựng lại y hệt.
   */
  const soOThat = st.map.o.length;
  const doiPhaMap = doiPhaCuaMap(
    st.map.trang_thai?.map((t) => t.giai_doan_nen), soOThat);
  const chonKyNgo = new Map<number, NhiemVuId>();
  const soLieuKyNgo = new Map<number, VongKyNgo>();
  const moBangTheoVong = new Map<number, number>();
  const kyNgoBat = st.ky_ngo === true;
  /**
   * D88 — bộ mời + hồi của TỪNG vòng kỳ ngộ ĐÃ TỚI, suy từ trạng thái trận
   * tại đúng vòng đó (hồi là nhãn HỒI CỐ của ô đã lật — công khai, không rò
   * một bit nào về ô chưa lật). Gom TRONG vòng lặp để trạng thái đúng là thứ
   * người chơi đã thấy lúc được mời — replay dựng lại y hệt.
   */
  const moiHoi = new Map<number, { moi: readonly NhiemVuId[]; hoi: string | null }>();
  const ghiMoiHoi = () => {
    if (!kyNgoBat || !laVongKyNgo(st.vong, soOThat) || moiHoi.has(st.vong)) return;
    const hoi = hoiTaiTran(st).id;
    moiHoi.set(st.vong, { moi: boNhiemVuTheoHoi(seed, st.vong, hoi), hoi });
  };
  /** Ống kính của vòng VỪA xử lý — khuôn `loiVonCuoi`. */
  let ongKinhCuoi: OngKinh | null = null;
  /** Phiếu mở bảng còn lại tại vòng `v` — MỘT nguồn, xem `phieuConLai`. */
  const phieuTaiVong = (v: number): number => {
    if (!kyNgoBat || chonKyNgo.size === 0) return 0;
    const dq = dacQuyenKyNgo(
      tienTrinhKyNgo(seed, soOThat, chonKyNgo, soLieuKyNgo, moiHoi));
    return phieuConLai(dq.get('phieu_mo_bang'), moBangTheoVong, v);
  };

  for (const h of log) {
    // D475 — kết quả màn của vòng trước, ĐẦU vòng này (trước cả mốc NAV người chơi thấy lúc bấm).
    if (st.dong_ho_minigame === true && h.mg) st = apMg(st, h.mg);
    /*
     * ⚠⚠ CHỤP Ở ĐÂY, TRƯỚC MỌI THAO TÁC CỦA VÒNG — không phải ngay trước
     * `giaiQuyetVong`. Bản đầu chụp muộn và bài test bắt ngay: lúc đó phí mở
     * bảng và LỆNH của chính vòng này đã áp (trượt giá đã trừ), nên số ra 9.460
     * trong khi màn hình người chơi đang hiện 10.000. Client chụp `navTruoc` tại
     * cú BẤM NÚT, nên mốc của server phải là cùng khoảnh khắc đó — lệch một
     * nhịp là hai đường POST/GET cho hai con số khác nhau cho cùng một vòng.
     */
    { const gb = st.ghe.find((x) => x.id === 'ban');
      navTruocCuoi = gb && st.nav === true ? navCua(gb) : null; }
    const o = st.map.o[st.vong - 1]!;
    // Mời TRƯỚC, chọn SAU — bộ mời phải có trước khi phép lọc `chon ∈ moi` chạy.
    ghiMoiHoi();
    // Chọn TRƯỚC khi vòng chạy: lựa chọn được chốt cùng cú nộp vòng, nên chính
    // vòng này đã nằm trong "phần còn lại của trận" mà nhiệm vụ được chấm trên.
    if (kyNgoBat && h.ky_ngo && laVongKyNgo(st.vong, soOThat)) {
      chonKyNgo.set(st.vong, h.ky_ngo);
    }
    /*
     * D33 — HẠNG BẢNG CHỐT TRÊN DANH MỤC ĐẦU VÒNG, TRƯỚC MỌI CÚ MUA.
     *
     * ⚠ Phải chụp Ở ĐÂY, không được hỏi lại sau khối `mua`. Endpoint `/bang`
     * chạy ở ĐẦU vòng — lúc đó thẻ của vòng này chưa mua — nên nó thấy danh mục
     * cũ và báo giá theo danh mục cũ. Nếu replay hỏi lại sau `mua` thì người vừa
     * lấy Lướt Sóng ở chính vòng này sẽ được tính 80 khi phát lại trong khi đã
     * trả 100 lúc bấm: Vốn replay dựng ra KHÁC Vốn người chơi đã nhìn thấy, im
     * lặng và không cách nào dựng lại.
     */
    const hangBang = hangBangCua(st, 'ban', h.du_bao === true);
    const ghe = [...st.ghe];
    hitVongCuoi = new Set<string>();
    loiVonCuoi = {};
    // D342 — cầu nối NAV của vòng này (điền trong khối lệnh, chốt ngay trước giaiQuyetVong).
    let cnHuy: number | null = null; let cnLenh: number | null = null;
    let cnSauLenh: number | null = null;
    if (chuanHoaMua(h.mua).length) hitVongCuoi.add('ban');

    // Nhịp 1 — người chơi
    const iNguoi = ghe.findIndex((g) => g.id === 'ban');
    const nguoi = ghe[iNguoi]!;
    if (!nguoi.da_chay) {
      /*
       * LÕI VỐN B — VỐN BỊ GIAM THÌ KHÔNG KHẢO SÁT LẠI ĐƯỢC.
       *
       * Đây là NỬA CÒN LẠI của hình phạt bẻ kèo; nửa kia (cấm Tăng cam kết) engine
       * tự thi hành trong `choiVongCuoc`. Nửa này bắt buộc nằm ở đây vì nhịp 1 của
       * người chơi chỉ tồn tại trong replay — engine không có chỗ nào nhìn thấy
       * `khao_sat_lai`. Bỏ qua là hình phạt chỉ còn một nửa, và cái nửa mất đi
       * đúng là nửa người chơi cảm nhận được.
       *
       * Ép về 0 chứ không ném lỗi: log có thể đã ghi từ trước khi phạt nổ (bẻ kèo
       * chốt ở `chotPhien`, tức SAU khi vòng trước được nộp), nên đây không phải
       * client gian lận mà là một lệnh đã hết hiệu lực.
       */
      const lanKhaoSat = luat.luatVon && biGiamVon(nguoi, st.vong)
        ? 0 : h.khao_sat_lai;
      const shop = bayShop(seed, st.vong, 'ban', lanKhaoSat, nguoi.danh_muc, tuyChonShop(st));
      // v55 (D411) — ví + giá qua MỘT cửa (`viKhaoSat` · `chiPhiKhaoSat`): trận gộp XU trừ vào xu, lần đầu miễn phí.
      let luot = viKhaoSat(st, nguoi) - chiPhiKhaoSat(st, lanKhaoSat);
      if (luot < 0) luot = 0;
      let dm = nguoi.danh_muc;
      /*
       * ─── D33 — TRẦN SỐ THẺ MỖI VÒNG, CƯỠNG CHẾ Ở SERVER ────────────────────
       *
       * Đặc quyền ĐA DẠNG HOÁ là "được chọn 2 tài sản một vòng thay vì 1", nên
       * cái "1" phải TỒN TẠI ở server trước đã. Trước bản này không có: replay
       * gọi `mua()` cho mọi phần tử của `h.mua`, và trần duy nhất là `length > 2`
       * ở `/rounds` — tức trần đó cũng chính là thứ Đa Dạng Hoá phải nới, và nó
       * đếm TỔNG chứ không đếm theo loại.
       *
       * Đếm trên danh mục ĐẦU VÒNG: mua chính lá Đa Dạng Hoá ở vòng này thì đặc
       * quyền có hiệu lực từ vòng SAU, không phải ngay trong cú bấm lập ra nó.
       *
       * ⚠ CỐ Ý KHÔNG CƯỠNG CHẾ NHỊP LOẠI THẺ Ở ĐÂY. `mua()` có sẵn luật đó
       * (`boiCanh.vong`) và docstring của nó còn ghi "enforce ở đây chứ không
       * phải ở UI", nhưng đường chạy thật chưa bao giờ truyền `boiCanh` vào —
       * một lỗ có thật, và cũ hơn cụm này. Bật nó lên trong cùng commit sẽ lật
       * ngược một quyết định của founder ("sao t đ** chọn được cả tài sản và
       * chiến thuật?", 20/07 — có test riêng canh) mà founder chưa duyệt. Đã ghi
       * vào báo cáo để founder quyết riêng.
       *
       * `daAllIn` thì CÓ cưỡng chế: D34 gắn thẳng All-in với việc khoá chọn bài,
       * nên nó nằm trong phạm vi cụm này. Cổng `dacQuyen` giữ cho trận cũ không
       * bị siết ngược.
       */
      const tran: TranMoiVong = st.dac_quyen === true
        ? {
          tai_san: nguoi.danh_muc.chien_thuat.includes('da_dang_hoa')
            ? DAC_QUYEN.DA_DANG_HOA.TAI_SAN_MOI_VONG : 1,
          chien_thuat: 1,
        }
        : KHONG_TRAN;
      /*
       * ⚠ `maxTaiSan` PHẢI ĐI QUA ĐÂY. Thiếu nó thì `shop.ts` rơi về hằng số
       * `HOLDEM_MATCH.MAX_TAI_SAN` và đặc quyền Đa Dạng Hoá nới trần (v8, chỉ đạo
       * founder 27/07 điều 3) chỉ có tác dụng ở `apDaoDanhMuc` — tức người chơi
       * giữ được mã thứ 5 bằng cách ĐẢO danh mục nhưng không MUA nổi nó. Đường
       * mua mới là đường chính, nên bỏ sót ở đây là bỏ sót gần hết đặc quyền.
       * (Đúng khuôn "cơ chế trang trí" đã dính 6 lần: hàm có, cổng có, call site
       * không truyền tham số.) `maxTaiSanCua` tự trả về đúng hằng số cũ khi cổng
       * v8 tắt, nên trận cũ replay không đổi.
       */
      /*
       * v10 NAV — TÀI SẢN mua bằng TIỀN (`lenh`), không bằng lá. Lá tài sản
       * trong `mua` bị LỌC: cho qua là gương vi_the ⇄ danh_muc.tai_san lệch
       * nhau ngay lệnh đầu tiên, và mọi cơ chế đọc danh sách mã lệch theo.
       */
      const muaLoc0 = st.nav === true
        ? chuanHoaMua(h.mua).filter((id) => !TAI_SAN.some((t) => t.id === id))
        : chuanHoaMua(h.mua);
      // v34 — mandate tổ chức cấm khống ⇒ lá Bán Khống bị lọc ở cả CỬA MUA (shop
      // payload đã giấu, nhưng body là của client — lọc ở tầng nhận, không tin client).
      const mdNguoi = mandateCua(st, nguoi);
      const muaLoc = mdNguoi?.camKhong === true
        ? muaLoc0.filter((id) => id !== 'ban_khong' && !(mdNguoi.camDonBay && id === 'don_bay')) : muaLoc0;   // D498 — không margin
      // v55 (D409) — TÊ LIỆT: vòng bị khoá thì không mua lõi (bot cùng cửa qua `khoaLoi`).
      // D473 — khung minigame: lõi chỉ lấy ở lượt lõi của CHÍNH ghế (`coLuotLoi`), trần theo ghế (`maxLoiCua`). Lọc ở tầng nhận như
      // TÊ LIỆT — body là của client. Ngoài khung: `coLuotLoi` luôn true và `maxLoi` = hằng cũ ⇒ byte-hệt.
      const khoaLoiBan = (st.trait_bat === true && rangBuocCua(st, nguoi, st.vong).teLiet) || !coLuotLoi(st, nguoi);
      dm = muaCaVong(dm, shop, khoaLoiBan ? [] : muaLoc, tran,
        st.dac_quyen === true
          ? {
            daAllIn: nguoi.tu_the === 'all_in', maxTaiSan: maxTaiSanCua(st, nguoi),
            ...(st.dong_ho_minigame === true ? { maxLoi: maxLoiCua(st, nguoi) } : {}),
          }
          : undefined).danh_muc;
      /*
       * D3 — GHI BẢNG GẮN sau khi mua.
       *
       * Chỉ nhận cặp (thẻ ĐANG CẦM, mã ĐANG CẦM) và chỉ với thẻ `pham_vi:'tai_san'`.
       * Ba lớp lọc này ở SERVER chứ không tin client: gắn vào mã mình không có, gắn
       * thẻ mình không cầm, hay gắn một thẻ toàn-danh-mục đều là trạng thái vô nghĩa
       * mà engine sẽ đọc phải về sau — và `action_log` là nguồn dựng lại trận, sai ở
       * đây là sai vĩnh viễn.
       */
      const ganMoi = { ...(dm.gan ?? {}) };
      for (const [the, ma] of Object.entries(h.gan ?? {})) {
        const ct = CHIEN_THUAT.find((x) => x.id === the);
        if (!ct || ct.pham_vi !== 'tai_san') continue;
        if (!dm.chien_thuat.includes(ct.id)) continue;
        if (!dm.tai_san.includes(ma)) continue;
        ganMoi[ct.id] = ma;
      }
      if (Object.keys(ganMoi).length) dm = { ...dm, gan: ganMoi };
      /*
       * v34 — ĐÍCH PHỤ (Đòn Bẩy cấp 2). Năm lớp lọc, cùng lý do với `gan`: chỉ
       * `don_bay`, cổng vai bật, cấp thẻ ≥ 2, mã đang cầm, KHÁC đích chính.
       * Đích chính đổi sang đúng mã phụ ⇒ phụ tự rụng (một mã không nhắm hai lần).
       */
      if (st.vai_co_rang === true) {
        const ganPhuMoi: Record<string, string> = { ...(dm.gan_phu ?? {}) };
        const maPhu = h.gan_phu?.don_bay;
        if (maPhu !== undefined) {
          if (maPhu === '' ) delete ganPhuMoi.don_bay;
          else if (capThe(dm, 'don_bay') >= 2 && dm.tai_san.includes(maPhu)
            && ganMoi.don_bay && ganMoi.don_bay !== maPhu) ganPhuMoi.don_bay = maPhu;
        }
        if (ganPhuMoi.don_bay && ganPhuMoi.don_bay === ganMoi.don_bay) delete ganPhuMoi.don_bay;
        if (Object.keys(ganPhuMoi).length) dm = { ...dm, gan_phu: ganPhuMoi };
        else if (dm.gan_phu) { const { gan_phu: _bo, ...conLai } = dm; dm = conLai; }
      }
      ghe[iNguoi] = {
        ...ghiViKhaoSat(st, nguoi, luot), danh_muc: dm,
        // v55 (D409) — lệnh chốt lời trong ô của vòng này (Lướt Sóng mới); engine bỏ qua nếu không cầm lá.
        ...(st.luot_song_moi === true && (h.chot_loi?.length ?? 0) > 0 ? { chot_loi: h.chot_loi! } : {}),
      };
    }

    // Nhịp 1 — bot
    for (let i = 0; i < ghe.length; i += 1) {
      const g = ghe[i]!;
      if (g.loai !== 'bot' || g.da_chay) continue;
      const ctx: BoiCanh = {
        seed, vong: st.vong, o: oCongKhai(o) as never, oThat: o,
        oTruoc: st.map.o[st.vong - 2], ghe: g,
        // v10 NAV — quầy TÀI SẢN đóng với bot (tài sản đi bằng TIỀN qua
        // `lenhBotNav`); để mở là bot nhặt lá không tiền và gương vi_the lệch.
        shop: locDonBayBot(st.nav === true
          ? { ...bayShop(seed, st.vong, g.id, 0, g.danh_muc, tuyChonShop(st)), tai_san: [] }
          : bayShop(seed, st.vong, g.id, 0, g.danh_muc, tuyChonShop(st)), mandateCua(st, g)),
        ...(mandateCua(st, g)?.camDonBay ? { camDonBay: true } : {}),
        gianLa: st.gian_la === true,
        loiGon: st.loi_gon === true,
        ...((st.trait_bat === true ? rangBuocCua(st, g, st.vong) : RANG_BUOC_TRONG).teLiet || !coLuotLoi(st, g) ? { khoaLoi: true } : {}),
        ...(st.dong_ho_minigame === true ? { maxLoi: maxLoiCua(st, g) } : {}),
        soNguoiSong: ghe.filter((x) => !x.da_chay).length,
        // Bot cũng được hưởng đặc quyền nới trần của CHÍNH nó — nếu không thì
        // đối thủ máy tự chơi dưới luật, và lá Đa Dạng Hoá không đo được.
        maxTaiSan: maxTaiSanCua(st, g),
        // v41 (D307) — LỚP VN: bot chọn lá phải chấm mã bằng ĐÚNG bảng engine
        // đang chạy (bài học `bangCanTroi` — đọc thẳng hằng số là gate đo
        // chênh lệch hai bảng, không đo kỹ năng, và không ném lỗi).
        bo: boMaTranCua(st),
        // v49 (D342) — lá Bán Khống thuần quyền: bot chấm lá theo đúng cổng engine.
        ...(st.ban_khong_thuan_quyen === true ? { banKhongThuanQuyen: true } : {}),
        // v30 — bot hoài nghi chiết khấu theo tỷ lệ HIỆU DỤNG ở nhịp CHỌN LÁ
        // (trước đây 35% phẳng, xem `tyLeCua`). Tự có cổng bên trong.
        ...tyLeCua(st, st.vong),
      };
      // v55 (D411) — bot đổi bài bằng CÙNG ví với người (`viKhaoSat`): trận gộp XU thì ví là xu.
      const r = botTaiCoCau(botCuaGhe(seed, g.id, st.ghe), { ...ctx, ghe: { ...g, luot_khao_sat: viKhaoSat(st, g) } });
      if (r.da_mua) hitVongCuoi.add(g.id);
      ghe[i] = { ...ghiViKhaoSat(st, g, r.luot_khao_sat), danh_muc: r.danh_muc };
    }

    st = { ...st, ghe };

    /*
     * ── v10 NAV — NHỊP GIAO DỊCH ────────────────────────────────────────────
     * Người chơi trước (lệnh từ log — đã chuẩn hoá cấu trúc ở tầng nhận, ngữ
     * nghĩa quyết ở đây và LỖI PHẢI NÓI RA qua `loi_von.lenh`), bot sau (lệnh
     * TỰ SUY từ chính sách tất định `lenhBotNav` — cùng khuôn bot cũ: hành vi
     * bot không nằm trong log, replay dựng lại được). Lỗi lệnh bot thì bỏ qua
     * im lặng: bot tự chịu, không có ai để báo.
     */
    if (st.nav === true) {
      // D302 — chụp sổ TRƯỚC mọi lệnh của vòng (người lẫn bot) để suy hướng lệnh.
      const soTruocLenh = new Map(st.ghe.map((g) => [g.id, chupSoLenh(g)]));
      /*
       * KHỚP GIỮA VÒNG (08/08) — áp TỪNG NHÓM đúng thứ tự bấm, TRƯỚC chuỗi lệnh
       * nộp cuối. Nhóm đã được kiểm lúc khớp trên CHÍNH trạng thái tất định này
       * nên không thể lỗi lại; nếu lỗi (log ngoài tầm kiểm soát) thì bỏ qua nhóm
       * đó — im lặng đúng chỗ, vì không còn ai để báo.
       */
      /*
       * v43 (D314) — HUỶ HỢP ĐỒNG chạy TRƯỚC mọi lệnh của vòng, kể cả khớp-giữa-vòng.
       *
       * Vì sao trước: huỷ chỉ LÀM TIỀN MẶT TĂNG (gốc về ví), nên nhóm khớp-giữa-vòng đã
       * được kiểm trên trạng thái tất định trước đó KHÔNG THỂ lỗi lại vì nó. Đặt sau thì
       * ngược lại: người chơi tất toán để lấy tiền mua một mã, mà lệnh mua chạy trước
       * lúc tiền về ⇒ "không đủ tiền" ở đúng cú họ vừa lấy tiền về.
       */
      const cnA = navBanCua(st);
      if ((h.tiet_kiem?.huy?.length ?? 0) > 0) {
        const rh = apHuyTietKiem(st, 'ban', h.tiet_kiem!.huy!);
        st = rh.st;
        if (rh.loi) loiVonCuoi = { ...loiVonCuoi, tiet_kiem: rh.loi };
      }
      const cnB = navBanCua(st);
      for (const nhom of h.khop_truoc ?? []) {
        const rk = apLenhMocNav(st, 'ban', nhom);
        if (!rk.loi) { st = rk.st; hitVongCuoi.add('ban'); }
      }
      if ((h.lenh?.length ?? 0) > 0) {
        const rl = apLenhMocNav(st, 'ban', h.lenh!);
        st = rl.st;
        if (rl.loi) loiVonCuoi = { ...loiVonCuoi, lenh: rl.loi };
        else hitVongCuoi.add('ban');
      }
      cnSauLenh = navBanCua(st);
      if (cnA !== null && cnB !== null && cnSauLenh !== null) {
        cnHuy = cnB - cnA; cnLenh = cnSauLenh - cnB;
      }
      /*
       * v34 — GẮN LẠI SAU LỆNH. Khối `gan`/`gan_phu` ở trên chạy TRƯỚC khi lệnh
       * áp, nên gắn Đòn Bẩy vào mã VỪA MUA cùng vòng (UI cho phép: "mã đang xếp
       * mua") bị lọc IM LẶNG vì `tai_san` chưa có mã đó — lỗi có sẵn từ D45.
       * Sửa dưới cổng: trận ≤ v33 replay nguyên (cú gắn đó từng bị vứt là sự
       * thật lịch sử). Cùng năm lớp lọc, chỉ khác là đọc `tai_san` SAU lệnh.
       */
      if (st.vai_co_rang === true && (h.gan || h.gan_phu)) {
        const iB = st.ghe.findIndex((g) => g.id === 'ban');
        if (iB >= 0) {
          const gB = st.ghe[iB]!;
          let dmB = gB.danh_muc;
          const ganB: Record<string, string> = { ...(dmB.gan ?? {}) };
          for (const [the, ma] of Object.entries(h.gan ?? {})) {
            const ct = CHIEN_THUAT.find((x) => x.id === the);
            if (!ct || ct.pham_vi !== 'tai_san') continue;
            if (!dmB.chien_thuat.includes(ct.id) || !dmB.tai_san.includes(ma)) continue;
            ganB[ct.id] = ma;
          }
          const ganPhuB: Record<string, string> = { ...(dmB.gan_phu ?? {}) };
          const maPhu = h.gan_phu?.don_bay;
          if (maPhu !== undefined) {
            if (maPhu === '') delete ganPhuB.don_bay;
            else if (capThe(dmB, 'don_bay') >= 2 && dmB.tai_san.includes(maPhu)
              && ganB.don_bay && ganB.don_bay !== maPhu) ganPhuB.don_bay = maPhu;
          }
          if (ganPhuB.don_bay && ganPhuB.don_bay === ganB.don_bay) delete ganPhuB.don_bay;
          dmB = { ...dmB, ...(Object.keys(ganB).length ? { gan: ganB } : {}) };
          if (Object.keys(ganPhuB).length) dmB = { ...dmB, gan_phu: ganPhuB };
          else if (dmB.gan_phu) { const { gan_phu: _bo2, ...conLaiB } = dmB; dmB = conLaiB; }
          st = { ...st, ghe: st.ghe.map((g, i) => (i === iB ? { ...g, danh_muc: dmB } : g)) };
        }
      }
      /*
       * v22 — BỐI CẢNH BOT ĐỌC ĐỂ MUA (D56). Ô đã LỌC `la_tin_gia`: bot ở bàn
       * người chơi không được biết trước tin nào dựng — nó phải chiết khấu như
       * người chơi. Tắt cờ ⇒ `undefined` ⇒ chính sách vòng tròn cũ, replay nguyên.
       *
       * ⚠⚠ D386 — KHỐI NÀY TỪNG ĐƯỢC DỰNG TAY Ở ĐÂY, VÀ NÓ ĐÃ TRÔI.
       *
       * Bản gõ tay cũ chép đủ `can_troi` · `lop_vn` · ba cờ v42 · `ty_le_gia_bp`
       * nhưng KHÔNG BAO GIỜ chép `nen` (v36 R3, D166/D172) — nên từ v36 tới v52,
       * bot ở bàn NGƯỜI CHƠI chấm mã bằng TIN không, trong khi engine định giá
       * vòng tin bằng NỀN × TIN và bot ở BÀN ĐO chấm bằng đúng NỀN × TIN. Hai đàn
       * bot khác nhau suốt 17 phiên bản, không một test nào đỏ.
       *
       * Nay dựng bằng `boiCanhLenhVong` — CÙNG hàm bàn đo gọi. Thêm một trường
       * vào bối cảnh từ nay là sửa một chỗ, và không còn chỗ thứ hai để quên.
       */
      const bcLenh = boiCanhLenhVong(st);
      for (const g of st.ghe) {
        if (g.loai !== 'bot' || g.da_chay || !duocChonBai(g)) continue;
        // v34 — bot tổ chức đọc mandate từ CÙNG một cửa engine kiểm người (D61).
        const bcG = boiCanhLenhGhe(st, g, bcLenh);
        const lb = lenhBotNav(
          botCuaGhe(seed, g.id, st.ghe), g, st.vong, maxTaiSanCua(st, g), bcG);
        if (lb.length > 0) {
          const rb = apLenhVongNav(st, g.id, lb);
          st = rb.st;
          if (rb.ok) hitVongCuoi.add(g.id);
        }
      }
      // D302 — sổ SAU lệnh, TRƯỚC khi ô lật: chỉ lệnh mới đổi được vị thế ở đây.
      huongLenhCuoi = new Map(
        st.ghe.map((g) => [g.id, suyHuongLenh(soTruocLenh.get(g.id), chupSoLenh(g))]));
    }

    /*
     * Nhịp 1a — LÕI VỐN: ĐẢO DANH MỤC rồi KHOÁ TÀI SẢN.
     *
     * Hai hàm THUẦN (state vào, state ra) nên đặt được ở đây, sau khi `ghe` đã
     * nhập lại vào `st`. Chúng chỉ chạm ghế `'ban'`, còn vòng lặp bot ngay trên
     * chỉ chạm ghế bot — nên thứ tự giữa hai khối không đổi kết quả.
     *
     * ⚠ ĐẢO TRƯỚC KHOÁ LÀ CỐ Ý: không ai khoá được mã mình vừa bán trong cùng một
     * vòng. Đảo sau thì "khoá X rồi bán X ngay" thành một nước hợp lệ, tức lời hứa
     * 2 vòng bị bẻ ngay trong vòng lập nó.
     *
     * Cả hai chạy SAU khối `mua`/`gan`, nên khoá được lá vừa lấy ở shop vòng này.
     * Cả hai tự vô hiệu khi `luat_von` tắt (`taoTran` không bật cờ) — đó là thứ
     * giữ cho trận cũ replay ra đúng kết quả cũ kể cả khi log có hai trường này.
     */
    /*
     * v43 (D314) — MỞ HỢP ĐỒNG chạy SAU chuỗi lệnh và sau khối "gắn lại", TRƯỚC
     * `dao`/`khoa`/`short`.
     *
     * Sau lệnh vì mốc % tính trên TIỀN MẶT CÒN LẠI: người chơi mua xong rồi mới gửi phần
     * dư, đúng thứ tự họ bấm trên màn. Đặt trước lệnh thì "gửi 50%" ăn vào tiền chưa
     * tiêu và mọi lệnh mua sau đó thiếu tiền.
     */
    if ((h.tiet_kiem?.mo?.length ?? 0) > 0) {
      const rm = apMoTietKiem(st, 'ban', h.tiet_kiem!.mo!);
      st = rm.st;
      if (rm.loi) loiVonCuoi = { ...loiVonCuoi, tiet_kiem: rm.loi };
    }
    if (h.dao) {
      /*
       * v10 NAV — đảo danh mục ĐI BẰNG LỆNH (bán A, mua B): đường cũ mutate
       * danh sách lá mà không đụng tiền, tức gương vi_the ⇄ tai_san lệch ngay.
       * Từ chối RÕ — nút cũ nào còn gửi `dao` sẽ thấy vì sao nó không chạy.
       */
      if (st.nav === true) {
        loiVonCuoi = { ...loiVonCuoi, dao: 'nav_dung_lenh' };
      } else {
        const r = apDaoDanhMuc(st, 'ban', h.dao.tu, h.dao.den);
        st = r.st;
        if (r.loi) loiVonCuoi = { ...loiVonCuoi, dao: r.loi };
      }
    }
    if (h.khoa) {
      const r = apKhoaTaiSan(st, 'ban', h.khoa);
      st = r.st;
      if (r.loi) loiVonCuoi = { ...loiVonCuoi, khoa: r.loi };
    }
    /*
     * D33 — ĐẶC QUYỀN PHÒNG HỘ: đặt lệnh SHORT, khớp ở VÒNG SAU.
     *
     * Đứng SAU khối `mua` cùng lý do với đảo/khoá: short được đúng lá Phòng Hộ
     * vừa lấy ở quầy. `apDatShort` tự vô hiệu khi cổng `dac_quyen` tắt, nên log
     * của trận cũ (không thể có trường này) và trận v6 đều ra kết quả cũ.
     */
    if (h.short) {
      const r = apDatShort(st, 'ban', h.short);
      st = r.st;
      if (r.loi) loiVonCuoi = { ...loiVonCuoi, short: r.loi };
    }

    /*
     * Nhịp 1b — BA CÁCH RA LÀ BA HÀNH ĐỘNG KHÁC NHAU.
     *
     * `dung_ngoai` / `dau_hang` đổi TƯ THẾ ghế, không chỉ bỏ một vòng. Áp ở ĐÂY
     * (trong replay, trước vòng cược) nên tư thế là hàm thuần của log → replay
     * ra kết quả y hệt, và `conCuoc()` loại họ khỏi vòng cược ngay vòng này.
     *
     * ⚠ Trước 25/07/2026 hai nhánh này KHÔNG hề tồn tại ở tầng server: UI gửi
     * `cat_lo` cho cả hai, nên `tu_the` không bao giờ rời `'choi'`. Hậu quả:
     * `PHI_DUNG_NGOAI` và luật xếp-bét-bảng của người đầu hàng đều là code chết,
     * còn nút thì hứa "ngồi xem tới hết trận" / "tính là THUA" mà không có gì
     * xảy ra. Nút "Đầu hàng" chỉ điều hướng về sảnh — trận vẫn mở, nên từ khi
     * bàn đấu có địa chỉ (`/arena/tran/:id`) người chơi đi thẳng lại vào được.
     */
    /*
     * LUẬT 3 — PHÍ BẢNG ĐIỆN TỬ, áp TRƯỚC vòng cược.
     *
     * Đúng nhịp thật: bảng mở ở ĐẦU vòng, nên Vốn đã bị bào khi engine tính
     * trần Tăng cam kết. Áp sau vòng cược là cho người chơi tố bằng tiền họ
     * không còn.
     *
     * Đặt TRƯỚC nhánh đổi tư thế để trùng khít mốc của `moBangCho` (áp trên
     * trạng thái đầu vòng, trước mọi khoản trừ khác của vòng đó): nhờ vậy Vốn
     * người chơi thấy ngay sau khi mở bảng đúng bằng Vốn mà replay dựng lại sau
     * khi vòng được nộp — không có khoảnh khắc nào hai con số lệch nhau.
     *
     * `apPhiMoBang` tự bỏ qua ghế đã cháy và tự kẹp Vốn ≥ 0.
     */
    /*
     * v32 — PHIẾU MỞ BẢNG miễn TRỌN phí mở bảng của vòng này.
     *
     * ⚠ Miễn theo VÒNG chứ không theo lần: `BANG_DIEN_TU.TOI_DA_MOI_VONG = 1`
     * nên một vòng chỉ có đúng một lần mở tính phí — "2 lượt mở miễn phí" và
     * "2 vòng miễn phí" là cùng một câu. Nếu ai nới trần đó lên thì phải quay
     * lại đây và quyết lại, đừng để phiếu âm thầm bao nhiều hơn lời hứa.
     */
    const moBangVong = h.mo_bang ?? 0;
    const duocMien = moBangVong > 0 && phieuTaiVong(st.vong) > 0;
    st = apPhiMoBang(st, 'ban', duocMien ? 0 : moBangVong, hangBang);
    if (moBangVong > 0) moBangTheoVong.set(st.vong, moBangVong);

    if (h.hanh_dong === 'dung_ngoai' || h.hanh_dong === 'dau_hang') {
      st = doiTuThe(st, 'ban', h.hanh_dong, st.vong);
    }

    // Nhịp 2 — VÒNG CƯỢC TUẦN TỰ.
    // Người chơi có thể bị hỏi NHIỀU LẦN một vòng (theo xong bị tố lại), nên
    // hành động của họ đọc lần lượt từ chuỗi `h.cuoc`. Log trận cũ không có
    // chuỗi thì suy hành động đầu từ `hanh_dong`, các lần sau mặc định THEO.
    const chuoi = [...(h.cuoc ?? [])];
    let daHoiBan = 0;
    /** Đếm RIÊNG từng ghế bot — vòng cược hỏi một ghế nhiều lần khi bị tố lại. */
    const daHoiBot = new Map<string, number>();
    let buoc = 0;
    nhatKyCuoi = [];

    const cnTruocChot = navBanCua(st);
    const r = giaiQuyetVong(st, (cuoc) => {
      const ghiNhat = (
        qdVao: { loai: LoaiHanhDong; them?: number }, laBot: boolean,
      ) => {
        /*
         * v54 (D403) — BỎ BÀI TẮT: engine ép 'bo' về THEO (`choiVongCuoc`), nên nhật ký ghi đúng nước ĐƯỢC THI HÀNH —
         * không thì dải đối thủ đọc ra "CẮT" cho một ghế vẫn ngồi trong pot. Trận cờ tắt: y như cũ.
         */
        const qd = st.bo_bai_tat === true && qdVao.loai === 'bo' ? { loai: 'theo' as const } : qdVao;
        nhatKyCuoi.push({
          ghe_id: cuoc.ghe_id, loai: qd.loai,
          them: qd.loai === 'to' ? (qd.them ?? 0) : (qd.loai === 'theo' ? cuoc.con_thieu : 0),
          gia: cuoc.gia,
          ...(laBot ? { nghi_ms: nghiMs(seed, st.vong, cuoc.ghe_id, buoc) } : {}),
        });
        buoc += 1;
        return qd;
      };

      if (cuoc.ghe_id === 'ban') {
        const tiep = chuoi.shift();
        if (tiep) return ghiNhat(tiep, false);
        if (daHoiBan === 0) {
          daHoiBan += 1;
          if (h.hanh_dong === 'cat_lo' || h.hanh_dong === 'dung_ngoai'
            || h.hanh_dong === 'dau_hang') {
            return ghiNhat({ loai: 'bo' }, false);
          }
          if (h.hanh_dong === 'tang_cam_ket' && h.them > 0 && cuoc.duoc.includes('to')) {
            return ghiNhat(
              { loai: 'to', them: Math.max(cuoc.con_thieu + 1, h.them) }, false);
          }
          return ghiNhat({ loai: 'theo' }, false);
        }
        if (dungOLuotBan) throw new DungOLuotBan(cuoc, nhatKyCuoi);
        return ghiNhat({ loai: 'theo' }, false);
      }

      const g = st.ghe.find((x) => x.id === cuoc.ghe_id)!;
      const ctx: BoiCanh = {
        seed, vong: st.vong, o: oCongKhai(o) as never, oThat: o,
        oTruoc: st.map.o[st.vong - 2], ghe: g,
        shop: bayShop(seed, st.vong, g.id, 0, g.danh_muc, tuyChonShop(st)),
        loiGon: st.loi_gon === true,
        soNguoiSong: st.ghe.filter((x) => !x.da_chay).length,
        maxTaiSan: maxTaiSanCua(st, g),
        // v41 (D307) — LỚP VN, cùng lý do với `ctx` ở nhịp chọn lá phía trên.
        bo: boMaTranCua(st),
        ...(st.ban_khong_thuan_quyen === true ? { banKhongThuanQuyen: true } : {}),
        ...tyLeCua(st, st.vong),
      };
      const bot = botCuaGhe(seed, g.id, st.ghe);

      /*
       * LƯỢT ĐẦU của bot trong vòng = Ý ĐỊNH VÒNG, đúng đối xứng với người chơi:
       * `daHoiBan === 0` áp `h.hanh_dong` cho ghế người, còn ở đây `daHoiBot`
       * đếm riêng từng ghế bot. Các lượt sau (bị tố lại) mới là phản ứng, và
       * phản ứng thì vẫn `chonCuoc` như cũ.
       *
       * Không đối xứng thì người chơi có một cần gạt mà đối thủ không có — vừa
       * lệch cán cân, vừa làm gate đo kỹ năng vô nghĩa: mọi bot đều cam kết y
       * hệt nhau bất kể đọc thị trường giỏi hay dở.
       */
      const soLan = daHoiBot.get(g.id) ?? 0;
      daHoiBot.set(g.id, soLan + 1);
      if (luat.botTuQuyetCamKet && soLan === 0) {
        const yDinh = bot.chonCamKet(ctx);
        if (yDinh.hanh_dong === 'cat_lo') return ghiNhat({ loai: 'bo' }, true);
        if (yDinh.hanh_dong === 'tang_cam_ket' && yDinh.them > 0
          && cuoc.duoc.includes('to')) {
          return ghiNhat(
            { loai: 'to', them: Math.max(cuoc.con_thieu + 1, yDinh.them) }, true);
        }
        // `giu_vi_the` KHÔNG phải là "theo mù": vẫn để `chonCuoc` cân pot odds,
        // nếu không thì bot giữ vị thế sẽ theo tới chết ở mọi mức cược.
      }
      return ghiNhat(bot.chonCuoc(cuoc, ctx), true);
    });
    st = r.trangThai;
    cuoi = r.ketQua;
    // v55 (D409) — MỐC TRAIT: cùng hàm với bàn đo; người thật lấy từ log của chính vòng mốc, bot theo chính sách.
    {
      const mt = apMocTraitCaBan(
        st, seed, r.ketQua.vong, new Map(h.trait ? [['ban', h.trait]] : []),
        (id) => botCuaGhe(seed, id, st.ghe));
      st = mt.st;
      mocTraitCuoi = mt.su_kien.length > 0 ? mt.su_kien : null;
    }
    {
      // D342 — chốt cầu nối của vòng NÀY (vòng sau ghi đè; vòng cuối cùng là cái được trả ra).
      const cnSauChot = navBanCua(st, true);
      cauNoiCuoi = cnHuy !== null && cnLenh !== null && cnSauLenh !== null
        && cnTruocChot !== null && cnSauChot !== null
        ? {
          huy_so: cnHuy, phi_giao_dich: cnLenh, phi_bang: cnTruocChot - cnSauLenh,
          nav_truoc_chot: cnTruocChot, nav_sau_chot: cnSauChot,
        }
        : null;
    }
    loiSuatCongCuoi = r.loiSuatCong ?? null;
    if (r.loiSuatCong) lichSuThiTruong.push({ vong: r.ketQua.vong, ls: r.loiSuatCong, laiSuat: laiSuatLuc({ ...st, vong: r.ketQua.vong }) });
    chiaQuyCuoi = r.chiaQuy ?? null;
    {
      /*
       * PHONG CÁCH: một dòng mỗi vòng đã chốt, cho MỌI ghế (D312 — trước đây
       * chỉ ghế `'ban'`). `cho_bp` là mốc CHUNG của vòng nên cùng một số cho cả
       * bàn; phần riêng của mỗi ghế là `brier` + `pnl_bp` của chính nó.
       * ⚠ Rẻ: `r.ketQua.ket_qua` đã có sẵn đủ số, không thêm một phép tính nào.
       */
      if (r.ketQua.cho_bp !== null) {
        for (const x of r.ketQua.ket_qua) {
          const ds = pcTheoGhe.get(x.ghe_id) ?? [];
          ds.push({
            brier: x.brier ?? null,
            nav_bp: x.pnl_bp,
            cho_bp: r.ketQua.cho_bp,
            tu_dong: h.tu_dong === true,
          });
          pcTheoGhe.set(x.ghe_id, ds);
        }
      }
      /*
       * KHẨU VỊ (D106) — tiền mặt/NAV và số mã đang giữ SAU khi chốt vòng, của
       * ghế người chơi. Thuần quan sát, rẻ (số đã có trong `st`), và là thứ duy
       * nhất tầng `hanh_vi_vong` KHÔNG đọc được từ `events` (event không ghi
       * danh mục của chính mình mỗi vòng). Trận không NAV ⇒ bỏ qua (khẩu vị
       * không có nghĩa khi chưa có chợ).
       */
      const gheBan = st.ghe.find((g) => g.id === 'ban');
      if (gheBan && st.nav === true) {
        const nav = navCua(gheBan);
        /*
         * D206 — Ô VÒNG NÀY CÓ BỊ THAY VÌ ĐÁM ĐÔNG KHÔNG.
         *
         * ⚠ Đọc từ `st` chứ không ghi thêm nguồn nào: cả hai máy thay ô đã ghi
         * sổ riêng (`phan_than` / `be_chuoi`) với đúng SỐ VÒNG của ô bị thay, và
         * `replay` chạy chúng nên trận CŨ dựng lại cũng có — không mất một dòng
         * dữ liệu nào (đây là cái lợi của tầng phái sinh D106; nếu cờ này phải
         * nằm trong `events` thì mọi trận trước hôm nay đã vĩnh viễn không tách
         * được, vì `events` append-only).
         * ⚠ Phản thân đứng TRƯỚC bẻ-chuỗi trong dây chuyền và bẻ-chuỗi tự nhường
         * khi phản thân đã thay ô vòng đó, nên hai sổ không bao giờ cùng ghi một
         * vòng — thứ tự `??` dưới đây phản ánh đúng luật ấy, không phải ưu tiên
         * tuỳ ý.
         */
        const vongDo = st.vong - 1;
        // D302 — đọc qua `oDoiCua` (một nguồn với DTO vòng + ô lịch sử, D61).
        const thayDo: 'phan_than' | 'be_chuoi' | null = oDoiCua(st, vongDo)?.boi ?? null;
        kvVong.push({
          vong: vongDo,
          tien_mat_bp: nav > 0 ? Math.round((gheBan.von / nav) * 10_000) : 10_000,
          so_ma: Object.values(gheBan.vi_the ?? {}).filter((x) => x > 0).length,
          thay_o_do: thayDo,
          /*
           * D317 — TỶ TRỌNG ĐANG KHOÁ TRONG SỔ TIẾT KIỆM.
           *
           * ⚠⚠ VẮNG MẶT HẲN khi trận không chạy luật ngân hàng — không phải `null`,
           * càng không phải 0. Ba trạng thái, ba nghĩa khác nhau:
           *   · vắng  = luật chưa có cơ chế (tầng trải đọc ra `null`);
           *   · 0     = có cửa mà ghế không gửi đồng nào — một QUAN SÁT;
           *   · > 0   = tỷ trọng thật.
           *
           * ⚠ VÌ SAO PHẢI VẮNG chứ không `null`: `kvVong` nằm TRONG kết quả
           * `replay()`, mà golden băm nguyên kết quả đó. Một trường LUÔN CÓ MẶT
           * làm 4 bài golden đỏ — kể cả 11 trận THẬT của founder trên prod — vì
           * ảnh chụp cũ có `undefined` còn bản mới trả `null`. Đã dính đúng lỗi
           * này ở D314 với `KetQuaVong`, và dính lại ở đây trong cùng một tuần:
           * thêm trường vào một cấu trúc golden băm thì phải phát ra CÓ ĐIỀU KIỆN.
           *
           * ⚠ Và đây
           * là chỗ duy nhất trong repo biết được điều đó, nên nó là NGUỒN cho cả
           * `tiet_kiem_bp` lẫn `tk_huy_so` ở tầng trải (A11.2, chi tiết ở
           * migrations/0063). Trận có cơ chế mà ghế không gửi đồng nào ⇒ 0, và
           * số 0 ấy là một quan sát thật về khẩu vị.
           *
           * ⚠ Mẫu số là `navCua` (ĐÃ gồm gốc + lãi treo, xem `nav.ts`), không
           * phải `navTuDo` — nếu chia cho NAV tự do thì ghế gửi gần hết tiền cho
           * ra tỷ trọng vọt quá 10.000 và cột thôi đọc được như "phần trăm gia
           * sản". Cùng mẫu số với `tien_mat_bp` ngay trên, nên hai cột cộng lại
           * vẫn có nghĩa.
           */
          ...(st.ngan_hang === true
            ? { tiet_kiem_bp: nav > 0 ? Math.round((tongTietKiem(gheBan) / nav) * 10_000) : 0 }
            : {}),
        });
      }
    }

    /*
     * v32 — SỐ LIỆU CHẤM NHIỆM VỤ của vòng vừa chốt, ghế `'ban'`.
     *
     * ⚠ ĐỌC THẲNG `KetQuaGhe`, KHÔNG TÍNH LẠI. `vi_the_truoc` là ảnh chụp TRƯỚC
     * định giá và `loi_suat_ma` là lợi suất của đúng vòng đó — cả hai engine
     * phát ra từ đúng chỗ tính Brier, nên "đúng hướng" và "độ chuẩn" nhìn CÙNG
     * một vòng bằng CÙNG một số. Dựng lại ở đây là bản sao thứ hai (D61).
     *
     * Trận cũ / trận không NAV không có hai trường đó ⇒ vòng KHÔNG vào sổ ⇒
     * nhiệm vụ bỏ qua nó. Đó là hướng an toàn: thà chấm thiếu một vòng còn hơn
     * chấm nó bằng một con số bịa.
     */
    const kqBan = r.ketQua.ket_qua.find((k) => k.ghe_id === 'ban');
    ongKinhCuoi = null;
    if (kyNgoBat && kqBan?.vi_the_truoc && kqBan.loi_suat_ma) {
      const soLieu: VongKyNgo = {
        viThe: kqBan.vi_the_truoc,
        loiSuatBp: kqBan.loi_suat_ma,
        brier: kqBan.brier ?? null,
        doiPha: doiPhaMap[r.ketQua.vong - 1] ?? false,
      };
      soLieuKyNgo.set(r.ketQua.vong, soLieu);
      /*
       * D88 §11.2 — ỐNG KÍNH của vòng vừa chốt, theo con đường MỚI NHẤT đã
       * chốt ở kỳ ngộ ≤ vòng này (cùng luật với icon `conDuongCuaGhe`).
       * Hiệu lực từ CHÍNH vòng chọn — lựa chọn chốt cùng cú nộp nên kết quả
       * vòng đó đã được soi. Không cần đạt gì: ống kính là BẢN SẮC của con
       * đường, đặc quyền mới là PHẦN THƯỞ NG phải kiếm.
       */
      let duong: NhiemVuId | null = null;
      let duongVong = -1;
      for (const [vk, id] of chonKyNgo) {
        if (vk <= r.ketQua.vong && vk > duongVong) { duongVong = vk; duong = id; }
      }
      if (duong) ongKinhCuoi = ongKinhVong(duong, soLieu);
    }
  }
  // D475 — màn của vòng vừa nộp đã hết giờ ⇒ áp ở đầu vòng đang chơi, cùng chỗ với `h.mg` trong vòng lặp.
  let mgCho: MgVong | null = null, manKetQua: KetQuaManGhe | null = null, navTruocMan: number | null = null;
  let manKetQuaNhieu: KetQuaManGhe[] | undefined;   // D561 — màn con (khoá nhiều mã)
  // D481 — màn VÒNG CUỐI đã quyết toán (trận đã khép): áp sau vòng cuối — một nguồn với `mg_sau` của dòng log.
  const dongCuoi = log[log.length - 1];
  if (st.dong_ho_minigame === true && dongCuoi?.mg_sau) st = apMg(st, dongCuoi.mg_sau);
  // D481: bỏ điều kiện "trận chưa kết thúc" — màn vòng cuối cũng áp ở đây trước khi trận khép.
  if (manCho && st.dong_ho_minigame === true && manCho.vong === log.length && !dongCuoi?.mg_sau) {
    const loiManCho = st.loi_chon_truoc === true ? log[manCho.vong - 1]?.loi_man : undefined;   // D561
    const r = tinhMgCaBan(st, { seedTran: seed, vong: manCho.vong, loiSuat: loiSuatCongCuoi, ban: { lenh: manCho.lenh, ...(manCho.bc ? { bc: manCho.bc } : {}) }, ...(loiManCho ? { loiMan: loiManCho } : {}) });
    const gb = st.ghe.find((x) => x.id === 'ban');
    navTruocMan = gb ? navCua(gb) : null;
    st = apMg(st, r.mg);
    mgCho = r.mg; manKetQua = r.ban; manKetQuaNhieu = r.nhieu;
  }
  // Phí bảng của vòng ĐANG CHƠI (chưa nộp). Cùng hàm, cùng mốc với nhánh trong
  // vòng lặp — chỉ khác là chưa có dòng vòng nào để gộp vào.
  // v32: phiếu kỳ ngộ miễn ở đây y hệt nhánh trong vòng lặp, cùng một cửa hỏi.
  const phieuVongNay = phieuTaiVong(st.vong);
  st = apPhiMoBang(st, 'ban',
    moBangCho > 0 && phieuVongNay > 0 ? 0 : moBangCho,
    hangBangCua(st, 'ban', duBaoCho));
  // Nhóm lệnh đã KHỚP GIỮA VÒNG của vòng đang chơi — sau phí, cùng thứ tự với
  // dòng vòng đã nộp. Lỗi thì NÓI RA qua loi_von: đây là trạng thái đang hiển
  // thị cho người chơi, không phải log chết.
  if (st.nav === true) {
    for (const nhom of khopCho) {
      const rk = apLenhMocNav(st, 'ban', nhom);
      if (rk.loi) loiVonCuoi = { ...loiVonCuoi, lenh: rk.loi };
      else st = rk.st;
    }
  }
  // Vòng ĐANG chơi (chưa nộp) cũng cần bộ mời — đây là lời mời payload sẽ hiện.
  ghiMoiHoi();
  const lanKyNgo = kyNgoBat
    ? tienTrinhKyNgo(seed, soOThat, chonKyNgo, soLieuKyNgo, moiHoi) : [];
  return {
    st,
    mgCho,
    manKetQua,
    ...(manKetQuaNhieu ? { manKetQuaNhieu } : {}),
    navTruocMan,
    ketQuaCuoi: cuoi,
    loiSuatCongCuoi,
    lichSuThiTruong,
    chiaQuyCuoi,
    mocTraitCuoi,
    navTruocCuoi,
    cauNoiCuoi,
    hitVongCuoi,
    nhatKyCuoi,
    huongLenhCuoi,
    loiVonCuoi,
    // Lát `'ban'` của bản đồ — MỘT nguồn, xem chú thích của `pcTheoGhe`.
    pcVong: pcTheoGhe.get('ban') ?? [],
    pcTheoGhe,
    kvVong,
    kyNgo: {
      lan: lanKyNgo,
      ongKinh: ongKinhCuoi,
      dacQuyen: dacQuyenKyNgo(lanKyNgo),
      phieu: phieuVongNay,
      // Lần mở đang treo của vòng này ĐANG tiêu một phiếu — trừ đi để con số
      // khoe ra là số THẬT CÒN LẠI, không phải số của đầu vòng.
      phieuHienThi: Math.max(
        0, phieuVongNay - (moBangCho > 0 && phieuVongNay > 0 ? 1 : 0)),
      doiPha: doiPhaMap,
    },
  };
}

/**
 * Suy hành động từ kết quả — poker: hành động cược là THÔNG TIN CÔNG KHAI.
 * Người chơi phải thấy đối thủ theo hay bỏ, không thì chơi với tường.
 * Danh mục của họ vẫn ẩn — đó mới là thứ phải giấu.
 */
function suyHanhDong(
  k: { da_cat_lo: boolean; cam_ket: number },
  /** Nền vòng của CHÍNH trận này (`nenVongCua`) — D403: bàn "quỹ theo cỡ bàn" nộp 312…625, không phải 500. */
  nen: number,
): 'cat_lo' | 'tang_cam_ket' | 'giu_vi_the' {
  if (k.da_cat_lo) return 'cat_lo';
  return k.cam_ket > nen ? 'tang_cam_ket' : 'giu_vi_the';
}

/**
 * D302 — HƯỚNG LỆNH của một ghế trong vòng NAV: thứ dải đối thủ hiện thay cho
 * GIỮ VỊ THẾ / TĂNG CAM KẾT.
 *
 * Từ v10a (`cuocTat`) máy cược tắt: mọi ghế đều `cam_ket = nền`, nên `suyHanhDong`
 * trả `giu_vi_the` cho CẢ BÀN ở MỌI vòng (trừ cắt lỗ) — nhãn 5 ghế giống nhau suốt
 * trận, tức là không có thông tin. Founder 20/07: *"phải thấy thằng kia stand/hit
 * hay fold chứ"* — ở trận NAV, "stand/hit" là VÀO / RA / ĐẢO / ĐỨNG.
 *
 * Suy từ hiệu hai ảnh chụp sổ (dài + khống) quanh khối áp lệnh của `replay()`:
 * mua hoặc mở khống = `vao` · bán hoặc đóng khống = `ra` · vừa vào vừa ra = `dao`
 * · không đổi = `dung`. KHÔNG lộ mã, không lộ cỡ — chỉ hướng (cùng ranh với
 * `so_the`/`da_hit`: hành động công khai, danh mục vẫn ẩn). Trận cũ không NAV:
 * map rỗng, DTO không có trường.
 */
export type HuongLenh = 'vao' | 'ra' | 'dao' | 'dung';

type SoLenh = { dai: Record<string, number>; khong: Record<string, number> };

function chupSoLenh(
  g: { vi_the: Record<string, number>; vi_the_khong?: Record<string, number> },
): SoLenh {
  return { dai: { ...g.vi_the }, khong: { ...(g.vi_the_khong ?? {}) } };
}

export function suyHuongLenh(truoc: SoLenh | undefined, sau: SoLenh): HuongLenh {
  if (!truoc) return 'dung';
  let vao = false;
  let ra = false;
  for (const so of ['dai', 'khong'] as const) {
    const ma = new Set([...Object.keys(truoc[so]), ...Object.keys(sau[so])]);
    for (const m of ma) {
      const a = truoc[so][m] ?? 0;
      const b = sau[so][m] ?? 0;
      if (b > a) vao = true;
      else if (b < a) ra = true;
    }
  }
  if (vao && ra) return 'dao';
  if (vao) return 'vao';
  if (ra) return 'ra';
  return 'dung';
}

function huongLenhDTO(
  m: ReadonlyMap<string, HuongLenh>, gheId: string,
): { huong_lenh?: HuongLenh } {
  const h = m.get(gheId);
  return h ? { huong_lenh: h } : {};
}

/**
 * v32 — CON ĐƯỜNG KỲ NGỘ CỦA MỘT GHẾ, và luật CHE của nó (doc 06 §1.5).
 *
 * ⚠⚠ ĐÂY LÀ KHUÔN A3.1, KHÔNG PHẢI MỘT LỰA CHỌN THẨM MỸ. Icon chỉ hiện SAU KHI
 * CHÍNH NGƯỜI XEM đã chốt lựa chọn của mình ở kỳ ngộ ĐÓ — y hệt luật "ẩn pool
 * tới lần đặt đầu". Được cả hai: cú chọn có khán giả (D25), mà không ai copy
 * được vì không thấy trước khi chọn. Che Ở TẦNG API: chưa chốt thì trường VẮNG
 * MẶT khỏi response — F12 không moi ra được (cùng kỷ luật `suc_cang_dai`).
 *
 * ⚠ "sau khi CHÍNH MÌNH chốt", KHÔNG phải "sau khi kỳ ngộ 1 xong": ở map 16 có
 * hai kỳ ngộ, và ai chưa chọn ở kỳ ngộ 2 thì vẫn không được thấy đường của
 * người khác Ở KỲ NGỘ 2 — dù đã thấy của kỳ ngộ 1.
 */
function conDuongCuaGhe(
  seed: number, gheId: string, laBot: boolean,
  lans: readonly LanKyNgo[], vongHienTai: number,
  /**
   * Màn kết: LẬT NGỬA HẾT (doc 06 §1.4 — "giấu trong trận, lật ở màn kết").
   * Trận đã xong thì không còn gì để bảo vệ, kể cả khi chính người xem BỎ QUA
   * cú chọn: khoá ở đó là phạt việc bỏ qua, mà "thất bại KHÔNG phạt" là luật
   * của cụm này.
   */
  boQuaKhoa = false,
): string | null {
  // Duyệt NGƯỢC: icon hiện là con đường của kỳ ngộ GẦN NHẤT đã mở khoá.
  for (let i = lans.length - 1; i >= 0; i -= 1) {
    const l = lans[i]!;
    if (l.vong > vongHienTai) continue;       // kỳ ngộ chưa tới
    // CHÍNH NGƯỜI XEM chưa chốt ⇒ khoá (trừ màn kết).
    if (!l.chon && !boQuaKhoa) continue;
    if (!l.chon && !laBot) continue;          // mình bỏ qua thì mình không có đường
    const id = laBot
      ? chonKyNgoBot(l.moi, (n) => rngAt(seed, 'holdem_ky_ngo', l.vong, gheId).below(n))
      : l.chon;
    const nv = NHIEM_VU_KY_NGO.find((x) => x.id === id);
    if (nv) return nv.icon;
  }
  return null;
}

/**
 * D337 — HẠNG PHONG CÁCH CỦA CẢ BÀN, ĐÃ KHOÁ THEO THỨ HẠNG.
 *
 * MỘT hàm dùng chung cho BA chỗ từng chấm từng ghế ĐỘC LẬP (`trangThaiCongKhai`,
 * `bangDoiThu`, autopsy) — trước D337 một ghế xếp bét bàn (NAV −15%, thứ hạng
 * 7/8) vẫn có thể hiện A+ trong khi ghế NHẤT bàn chỉ A-, vì mỗi ghế được
 * `chamPhongCach` một mình, không ai so với ai. Gọi CHUNG một hàm — thay vì mỗi
 * chỗ tự PAV lấy — vì PAV phải chạy trên NGUYÊN BÀN một lần; chạy riêng từng ghế
 * là không PAV được gì cả (D61: bản cài đặt thứ hai của cùng phép khoá SẼ trôi).
 *
 * Toán khoá (trần theo vị trí + gộp PAV) nằm ở `chuToiDaTheoThuHang`/
 * `khoaTheoThuHang` (`holdem/phong_cach.ts`) — khối docstring D337 ở đó có đủ
 * nguyên văn founder + vì sao bác bảng dải cố định. Hàm này chỉ lo phần RIÊNG
 * của `holdem_api.ts`: đọc `xepHang(st)` làm thứ hạng SỐNG, chấm điểm GỐC từng
 * ghế từ `pcTheoGhe` (sản phẩm phụ của `replay`), rồi khoá.
 *
 * Ghế ĐẦU HÀNG (`tu_the === 'dau_hang'`) luôn vào dãy với `PHONG_CACH_DAU_HANG`
 * (điểm 0) — kể cả khi họ có vài vòng đẹp trước lúc bỏ cuộc, cùng luật `xepHang`
 * đã xếp đầu hàng xuống bét bảng. Ghế CHƯA có vòng nào (không đầu hàng,
 * `pcTheoGhe` rỗng/vắng) KHÔNG vào dãy — trần/gộp không có nghĩa với ai chưa
 * chơi vòng nào, và giữ ĐÚNG hành vi hiện nay: ghế đó vắng mặt khỏi map trả về
 * (`bangDoiThu` cũ cũng bỏ trống `phong_cach_hang` trong ca này).
 *
 * `ghiDeBan` — ghi đè bản GỐC (CHƯA khoá) của một vài ghế trước khi khoá, dùng
 * ở autopsy: ghế `'ban'` phải chấm từ `events` (nguồn cũ của màn kết), không
 * phải từ `pcTheoGhe` của `replay()` — xem chú thích dài ở chỗ gọi.
 *
 * `tamTinh` — D343: ghế có ≥ 1 vòng cũng vào dãy khoá dù chưa qua `duVongDeCoHang`.
 * CHỈ dùng để vẽ thanh XÁM của chính người chơi ở mấy vòng đầu (`phong_cach_tam_tinh`
 * trong `trangThaiCongKhai`) — kết quả chế độ này KHÔNG được chảy vào `bangDoiThu`,
 * autopsy hay bất cứ thứ gì vào `events`. Khoá CÙNG một phép (trần + PAV) như bản
 * thật, nên lúc thanh bật sáng ở vòng đủ tin nó không giật vì đổi luật tính.
 */
function phongCachCaBan(
  st: TrangThaiTran,
  pcTheoGhe: ReadonlyMap<string, readonly VongPhongCach[]>,
  /** `null` = ghế đó CHƯA có hạng theo nguồn ghi đè (vd events chưa đủ vòng) — không rơi về `pcTheoGhe`. */
  ghiDeBan?: ReadonlyMap<string, KetQuaPhongCach | null>,
  { tamTinh = false }: { tamTinh?: boolean } = {},
): Map<string, KetQuaPhongCach> {
  const thuTu = xepHang(st);
  const soGhe = thuTu.length;
  /*
   * BÀN TẬP chấm bằng thang nới đỉnh rồi QUY về thang chuẩn TRƯỚC khi khoá (founder:
   * *"chỉ trong phần hướng dẫn thôi nhé"*) — xem `THANG_BAN_TAP`. Nhận ra bàn tập bằng
   * seed (`laSeedManTap`), cùng cửa với `luatChoTran`. Trận thật không quy gì.
   */
  const banTap = laSeedManTap(st.seed);
  const quy = (k: KetQuaPhongCach): KetQuaPhongCach => {
    if (!banTap) return k;
    const diem = quyVeThangChuan(k.diem);
    return { ...k, diem, hang: hangCua(diem) };
  };
  const goc = new Map<string, KetQuaPhongCach>();
  for (const id of thuTu) {
    if (ghiDeBan?.has(id)) {
      const de = ghiDeBan.get(id);
      if (de) goc.set(id, quy(de));
      continue;
    }
    const gio = st.ghe.find((g) => g.id === id);
    if (gio?.tu_the === 'dau_hang') { goc.set(id, PHONG_CACH_DAU_HANG); continue; }
    const ds = pcTheoGhe.get(id);
    if (ds && (tamTinh ? ds.length > 0 : duVongDeCoHang(ds.length))) goc.set(id, quy(chamPhongCach(ds)));
    // Còn lại: chưa đủ vòng để có hạng (`duVongDeCoHang`) — không vào `goc`, không vào dãy khoá.
  }
  const dong = thuTu
    .map((id, i) => ({ id, thu_hang: i + 1, ket: goc.get(id) }))
    .filter((x): x is { id: string; thu_hang: number; ket: KetQuaPhongCach } => (
      x.ket !== undefined
    ));
  const khoa = khoaTheoThuHang(
    dong.map((x) => ({ thu_hang: x.thu_hang, diem: x.ket.diem })), soGhe,
  );
  const ra = new Map<string, KetQuaPhongCach>();
  dong.forEach((x, i) => {
    const diem = khoa[i]!;
    ra.set(x.id, { ...x.ket, diem, hang: hangCua(diem) });
  });
  return ra;
}

/** Bảng đối thủ — R1: đúng những gì API gửi ra là những gì được log. */
function bangDoiThu(
  st: TrangThaiTran, seed: number,
  /** v32 — tiến trình kỳ ngộ của NGƯỜI XEM. Vắng ⇒ không icon (trận cũ). */
  lanKyNgo: readonly LanKyNgo[] = [],
  /**
   * D312 — phong cách theo TỪNG ghế (`replay().pcTheoGhe`). Vắng ⇒ khối
   * `phong_cach_hang` vắng mặt: trận cũ dựng lại không có, và một hạng bịa còn
   * tệ hơn không hạng.
   */
  pcTheoGhe?: ReadonlyMap<string, readonly VongPhongCach[]>,
) {
  /*
   * ── v10 NAV — DANH MỤC ĐỐI THỦ ẨN, và ĐI NGƯỢC SỐ ĐÔNG là con dao xuyên ────
   *
   * D40: "lừa nhau bằng THÔNG TIN (danh mục ẩn...)". Mặc định đối thủ chỉ lộ
   * NAV; founder 28/07: "đặc quyền của đi ngược số đông sẽ cho mình biết bên
   * kia cầm gì" ⇒ ai cầm lá `di_nguoc` thấy DANH SÁCH MÃ (không thấy SỐ TIỀN —
   * "cầm gì", không phải "cầm bao nhiêu") của một phần bàn, cân theo TỶ LỆ
   * (`soDoiThuThay`, cấp theo số bản sao — D40 "săn chiến thuật").
   *
   * Chọn AI được thấy: các ghế còn sống theo THỨ TỰ GHẾ — tất định, không rút
   * thăm, để replay và log khớp nhau tuyệt đối.
   */
  const banGhe = st.ghe.find((g) => g.id === 'ban');
  const capDiNguoc = st.nav === true && st.dac_quyen === true
    && banGhe && banGhe.danh_muc.chien_thuat.includes('di_nguoc' as never)
    ? capThe(banGhe.danh_muc, 'di_nguoc') : 0;
  const doiThuSong = st.ghe.filter((g) => g.id !== 'ban' && !g.da_chay);
  const soThay = soDoiThuThay(capDiNguoc, doiThuSong.length);
  const thayDuoc = new Set(doiThuSong.slice(0, soThay).map((g) => g.id));
  /*
   * D337 — khoá MỘT LẦN cho CẢ BÀN (kể cả ghế 'ban', dù nó bị lọc khỏi output
   * dưới đây) — PAV cần đúng thứ hạng sống của toàn bàn để so, tính riêng từng
   * ghế đối thủ là không PAV được gì. Xem `phongCachCaBan`.
   */
  const pcKhoa = pcTheoGhe ? phongCachCaBan(st, pcTheoGhe) : null;
  /*
   * D528 (founder 05/10: "vào trận giấu role trừ khi có trait +2 cho phép thấy role mọi user") — khoá v59: VAI ghế khác KHÔNG rời server, chỉ còn cờ
   * `vai_an`; ghế mang SOI VAI thấy như cũ. Cắt ở đây (không giấu bằng CSS) — cùng khuôn với số tiền đối thủ (D312).
   */
  // D530 — bàn tập từng KHÔNG giấu (seed tập dựng để người học thấy đủ ba vai). D542 (founder 06/10: "phần role thì lộ ngay đầu trận rồi, đầu
  // trận chỉ nên báo là 'Trận có X role (icon)(số)'") ⇒ bàn tập giấu như trận thật; số vai của bàn đi riêng (`dem_vai`).
  const anVai = st.ke_lenh_v59 === true && !(banGhe && traitHieuLuc(st, banGhe).includes('soi_vai'));

  return st.ghe.filter((g) => g.id !== 'ban').map((g) => ({
    ghe_id: g.id,
    // D25/R3: lộ mặt đúng bản chất. Nhãn hiển thị cũng nói rõ là máy.
    loai: g.loai,
    ten: g.loai === 'bot' ? `Máy · ${botCuaGhe(seed, g.id, st.ghe).label}` : g.id,
    /*
     * D25/R4: BẬC, không phải điểm. Gửi ra NHÃN ĐỌC ĐƯỢC vì đúng chuỗi này là
     * chuỗi được log ở `hd_match_start` — R1 đòi thứ log ra phải là thứ đã hiện.
     * Ghế bot: '—'. Bot không có bậc, và bịa một bậc cho nó là bịa mất mát xã hội
     * không tồn tại (D25 — "đối thủ thấy mình là cái để mất").
     */
    bac_rank: g.loai === 'bot' ? '—' : nhanBacNgan(g.bac_rank),
    ...(g.vai ? (anVai ? { vai_an: true as const } : { vai: g.vai }) : {}),   // VAI lộ cả bàn từ đầu (22/08) · D528: khoá v59 giấu trừ SOI VAI
    /*
     * ⭐⭐ D312 — SỐ TIỀN CỦA ĐỐI THỦ KHÔNG CÒN RỜI SERVER NỮA.
     *
     * Founder 08/09: *"tôi cũng nói là ẩn số tiền chi tiết mà đối thủ đang cầm
     * đi cơ mà"* — và dải ghế vẫn in `18.247 · 29.012 · 31.364` vì chỉ thị ấy
     * chưa từng được ghi xuống chỗ nào (grep cả `docs/` ra rỗng).
     *
     * ⚠ CẮT Ở ĐÂY, KHÔNG GIẤU BẰNG CSS. Che ở client thì con số vẫn nằm trong
     * payload — ai mở tab Network cũng đọc được, tức không che gì cả. Cùng
     * khuôn với `tai_san_thay` ngay dưới: cái gì không được thấy thì không được
     * GỬI (C4 · A3.1).
     *
     * ⚠ Và vì `bangDoiThu()` chảy vào cả `hd_cam_ket`, cú cắt này LÀM ĐÚNG R1
     * chứ không phá: event ghi "thứ đã hiện trên màn hình lúc bấm", nên khi màn
     * không còn hiện NAV đối thủ thì event cũng không được ghi. Chú thích ở
     * chỗ gọi đã nói trước điều đó: *"ghi lại một mức Vốn chưa từng hiện trên
     * màn hình nào"* là lỗi cần tránh.
     *
     * Thay bằng ba thứ founder chốt: HẠNG PHONG CÁCH (dưới) · `so_the` (đã có)
     * · `ky_ngo_icon` (đã có).
     */
    ...(() => {
      const ket = pcKhoa?.get(g.id);
      return ket ? { phong_cach_hang: ket.hang } : {};
    })(),
    ...(thayDuoc.has(g.id)
      ? { tai_san_thay: Object.keys(g.vi_the) }
      : {}),
    con_song: !g.da_chay,
    ...(st.lua === true && g.lua ? { lua_nac: g.lua.nac } : {}),
    // SỐ thẻ đang cầm — công khai như poker (thấy người ta cầm mấy lá).
    // Danh mục CỤ THỂ vẫn ẩn, đó mới là thông tin cần giấu.
    so_the: g.danh_muc.tai_san.length + g.danh_muc.chien_thuat.length,
    /**
     * TRẠNG THÁI CẢM XÚC — thứ CẢ BÀN cùng thấy trên ghế này (D25: xã hội là
     * stakes engine; đối thủ thấy mình chính là cái để mất).
     *
     * Thêm vào ĐÂY chứ không ở chỗ khác vì `bangDoiThu()` chảy vào ĐỒNG THỜI ba
     * nơi: response mỗi vòng, event `hd_match_start`, và state_snapshot của
     * `hd_cam_ket`. Nên một field thêm ở đây tự động giữ bất biến
     * `R1-logged ⊆ API-đã-gửi` — không có đường nào log lệch với thứ đã hiện.
     *
     * ⚠ NAV, không phải tiền mặt (founder 02/08: all-in mua vàng mà avatar
     * nhấp nháy "SẮP CHÁY" — cùng lớp lỗi D44 ở `xepHang`). Trận cũ không nav
     * thì `navCua ≡ von` nên một công thức phủ cả hai, không cần cổng.
     */
    fx: fxCuaGhe(navCua(g), g.da_chay, g.tu_the, vonDauCua(st, g)),
    // v32 — ICON CON ĐƯỜNG. Vắng mặt khi người xem chưa chốt (xem `conDuongCuaGhe`).
    ...(() => {
      const ic = conDuongCuaGhe(seed, g.id, g.loai === 'bot', lanKyNgo, st.vong);
      return ic ? { ky_ngo_icon: ic } : {};
    })(),
  }));
}

/**
 * LÕI VỐN — TRẠNG THÁI HAI CẦN GẠT MỚI, SUY Ở SERVER (C4).
 *
 * Client KHÔNG được tự suy ba cờ này. Chúng là hàm của cùng bộ điều kiện mà
 * `apDaoDanhMuc`/`apKhoaTaiSan` dùng để chấp nhận lệnh, nên tính lại ở client là
 * dựng nguồn chân lý thứ hai — và biểu hiện của việc nó lệch sẽ là "nút vẫn
 * sáng, bấm vào thì không có gì xảy ra", đúng lớp lỗi tệ nhất của repo này.
 *
 * Cả ba đọc trạng thái ĐẦU VÒNG. `khoa_duoc` cố ý KHÔNG đòi đang cầm mã nào:
 * hai hàm `ap*` chạy SAU `mua`, nên lá vừa lấy ở shop vòng này khoá được — UI
 * chào đúng tập đó (danh mục ∪ lá đang chọn mua).
 */
function canGatVon(st: TrangThaiTran, nguoi: Ghe) {
  const luatVon = st.luat_von === true;
  const khoa = luatVon ? khoaDangChay(nguoi, st.vong) : null;
  return {
    luat_von: luatVon,
    khoa: khoa ? {
      ma: khoa.ma,
      vong_bat_dau: khoa.vong_bat_dau,
      /** Còn mấy vòng nữa mới hết chu kỳ, TÍNH CẢ vòng này. */
      con_vong: khoa.vong_bat_dau + KHOA_TAI_SAN.SO_VONG - st.vong,
      /** Vòng nghiệm thu lời hứa — chỉ ở đây bẻ kèo mới bị phạt. */
      la_vong_chot: laVongChotKhoa(khoa, st.vong),
      /** Thưởng sống sót đã nhận trong chu kỳ — bẻ kèo thu hồi đúng bằng số này. */
      thuong_da_nhan_bp: khoa.thuong_bp,
    } : null,
    dao_duoc: luatVon
      && st.nav !== true
      && st.vong >= DAO_DANH_MUC.TU_VONG
      && duocChonBai(nguoi)
      && nguoi.dao?.vong !== st.vong,
    /*
     * ⚠ 27/07 — cùng điều kiện với `apKhoaTaiSan`, gọi CHUNG một hàm
     * (`khoaKipChot`) thay vì chép lại. Cổng cũ hỏi "có phải vòng chọn tài sản
     * không"; spec 01 mở chợ tài sản ở mọi vòng nên câu hỏi đó hết nghĩa. Cái
     * còn phải giữ là chu kỳ khoá phải kịp chốt trước khi hết map.
     */
    /*
     * v43 (D314) — CƠ CHẾ CHẾT thì `khoa_duoc` PHẢI false, không phải "true nhưng bấm
     * vào báo lỗi". Client vẽ theo cờ server (C4): để true là màn còn mời người chơi
     * làm một việc chắc chắn bị từ chối.
     */
    khoa_duoc: st.khoa_tai_san_tat !== true
      && luatVon
      && duocChonBai(nguoi)
      && khoaKipChot(st.vong, st.map.o.length)
      && !khoa,
    /*
     * v43 (D314) — NGÂN HÀNG. `tiet_kiem_duoc` gộp cả ba điều kiện để client khỏi tự
     * suy: cổng bật · ghế được chọn bài · CÒN mốc kỳ hạn nào kịp đáo hạn. Vế thứ ba là
     * thứ tắt dần về cuối bàn — vòng áp chót thì không mốc nào kịp nữa.
     * `tiet_kiem_bao_gia` là BÁO GIÁ của chính vòng này (lãi chốt lúc mở), server tính
     * từ `laiSuatLuc` — client vẽ, không nhân chia.
     */
    /*
     * ⚠ CỐ Ý KHÔNG CÓ `khoa_tat` Ở ĐÂY, và ghi lại để người sau khỏi thêm lại.
     *
     * Tôi đã thêm nó trong D317 với lý lẽ nghe rất xuôi: `khoa_duoc: false` một
     * mình không phân biệt "cơ chế chết hẳn" với "chưa mở lúc này", mà dòng thu
     * gọn của `QuanTriVon` còn IN TÊN cơ chế ("TÁI CƠ CẤU · KHOÁ NẮM GIỮ — mở
     * khi…"). Rồi đo lại đường gọi: `hienQuanTriVon` đòi `b.nav === undefined`,
     * mà `khoa_tai_san_tat` chỉ bật từ v43 và MỌI trận v43 đều là NAV. Nên cờ ấy
     * không bao giờ đúng ở đúng chỗ duy nhất định dùng nó — một trường DTO chết
     * ngay lúc sinh. Gỡ thay vì để lại (A11.13, chiều ngược: đo trước khi tin
     * rằng một nhánh code CẦN sống).
     */
    /*
     * ⚠⚠ VẮNG MẶT HẲN khi trận không có ngân hàng — KHÔNG phải `false` + `[]`.
     *
     * Bản đầu trả `tiet_kiem_bao_gia: []` cho mọi trận, và client dùng
     * `!== undefined` để quyết có vẽ ô NGÂN HÀNG hay không. Hệ quả: một trận v42
     * (không hề có ngân hàng) vẫn hiện ô ấy, kèm câu "không kỳ hạn nào kịp đáo
     * hạn" — tức màn hình IN TÊN một cơ chế không tồn tại và còn bịa cho nó một
     * lý do. Đúng lớp lỗi tôi vừa gỡ `khoa_tat` để tránh, mắc lại ở đầu kia.
     *
     * "Cơ chế không có ở trận này" và "cơ chế có nhưng đang đóng" là hai câu
     * khác nhau, và chỉ VẮNG MẶT mới nói được câu thứ nhất.
     */
    ...(st.ngan_hang === true
      ? {
        tiet_kiem_duoc: duocChonBai(nguoi)
          && mocKipCua(st.vong, st.map.o.length).length > 0,
        tiet_kiem_bao_gia: mocKipCua(st.vong, st.map.o.length).map((n: number) => ({
          so_vong: n,
          // v53 (D373) — BÁO GIÁ PHẢI TRÙNG MỨC ENGINE SẼ KHOÁ (`apMoTietKiem` cũng đọc
          // `laiSuatThayDuoc`). Báo một đằng khoá một nẻo là lớp lỗi D67.
          lai_bp: laiTietKiemBp(laiSuatThayDuoc(st) ?? LAI_SUAT_NEN.KHOI_DIEM, n),
        })),
      }
      : {}),
    /** Hậu quả bẻ kèo: không Tăng cam kết, không Khảo sát lại ở vòng này. */
    von_bi_giam: luatVon && biGiamVon(nguoi, st.vong),
  };
}

/**
 * D33/D34 — TRẠNG THÁI ĐẶC QUYỀN, SUY Ở SERVER (C4).
 *
 * ⚠ Client TUYỆT ĐỐI không tự suy mấy cờ này. Chúng là hàm của cùng bộ điều kiện
 * mà `apDatShort` / `mua` / `allInMoCho` dùng để chấp nhận lệnh; tính lại ở client
 * là dựng nguồn chân lý thứ hai, và biểu hiện của việc nó lệch sẽ là "nút vẫn
 * sáng, bấm vào thì không có gì xảy ra" — lớp lỗi tệ nhất của repo này, đã gặp
 * sáu lần.
 *
 * Bảng này cũng là hợp đồng R1: mọi trường ở đây LÀ thứ UI phải render, và là
 * thứ event `hd_*` được phép ghi là "đã cho thấy".
 */
function dacQuyenCua(st: TrangThaiTran, nguoi: Ghe) {
  const bat = st.dac_quyen === true;
  const co = (id: string) => bat && nguoi.danh_muc.chien_thuat.includes(id as never);
  const soO = st.map.o.length;
  return {
    dac_quyen: bat,
    /** Thẻ nào đang cho đặc quyền — UI vẽ huy hiệu, không tự đoán theo tên lá. */
    the_dac_quyen: bat
      ? [...new Set(nguoi.danh_muc.chien_thuat)].filter((x) => x in DAC_QUYEN_THEO_THE)
      : [],
    /** Số thẻ TÀI SẢN lấy được ở vòng này (Đa Dạng Hoá cho 2). */
    toi_da_tai_san_vong: co('da_dang_hoa')
      ? DAC_QUYEN.DA_DANG_HOA.TAI_SAN_MOI_VONG : 1,
    /** D34 — All-in + "lật bài đến hết giờ" đã mở chưa. */
    all_in_mo: allInMoCho(st, nguoi),
    /** Còn thiếu mấy thẻ chiến thuật nữa mới mở All-in. */
    con_thieu_the: Math.max(0, soLoiMoAllIn(st) - soOChienThuat(nguoi)),
    /*
     * Nhịp chọn bài của CHÍNH map này (D34 — co theo cỡ map).
     * v32: vòng kỳ ngộ hiện ra ở đây dưới nhãn `'ky_ngo'` — nó THAY một vòng
     * `tai_san`, không chèn thêm vòng nào (doc 06 §1.4).
     */
    /*
     * D473 — khung minigame: nhịp lõi 1 · 4 · 6, và lượt thứ ba chỉ của ghế khẩu vị đa dạng ⇒ nhịp hiện cho CHÍNH ghế này (vòng không có
     * lượt thì báo `khong`, không bày quầy lõi người chơi bấm rồi bị chối).
     */
    nhip_chon_bai: nhipChonBai(soO, st.ky_ngo === true, st.gian_la === true, st.dong_ho_minigame === true, st.nhip_xen_ke === true)
      .map((x, i) => (x === 'chien_thuat' && !coLuotLoi(st, nguoi, i + 1) ? 'khong' : x)),
    /** Đặc quyền Phòng Hộ: được đặt lệnh short ở vòng này không. */
    short_duoc: co('phong_ho')
      && duocChonBai(nguoi)
      && st.vong < soO
      && nguoi.short?.vong_dat !== st.vong,
    /** Lệnh short đang treo (đặt vòng trước, khớp vòng này) — hoặc vừa đặt. */
    short: nguoi.short ?? null,
    /** Lệnh short KHỚP ở vòng này — UI báo "lệnh của bạn vừa khớp". */
    short_khop: shortKhopO(nguoi, st.vong),
    /** Ba hạng giá Bảng điện tử ÁP CHO GHẾ NÀY (đã tính thẻ Lướt Sóng). */
    gia_bang: {
      co_ban: giaMoBang(co('luot_song'), false),
      du_bao: co('luot_song') ? giaMoBang(true, true) : null,
    },
    /**
     * v57 (D456) — luật của trận này KHÔNG bán Bảng điện tử. CHỈ có mặt khi bật (vắng = vẫn bán): bản web cũ trong cache
     * không biết trường này thì vẫn vẽ bảng cho trận ≤ v56, đúng như trước.
     */
    ...(st.khong_bang_dien_tu === true ? { khong_bang_dien_tu: true as const } : {}),
  };
}

/**
 * Thẻ nào có đặc quyền — suy từ chính bảng `DAC_QUYEN` thay vì chép tay danh
 * sách. Thêm một đặc quyền vào config là UI tự biết, không phải sửa hai chỗ.
 */
const DAC_QUYEN_THEO_THE: Record<string, true> = {
  khop_nhanh: true, da_dang_hoa: true, phong_ho: true,
  luot_song: true, chan_lo: true,
  // 28/07 — Đi Ngược Số Đông: thấy đối thủ cầm gì (v10, xem `bangDoiThu`).
  di_nguoc: true,
  // 28/07 — Chia Lệnh: mốc đi vốn MỊN 5% (không lá: mốc thô) + giảm trượt giá.
  chia_lenh: true,
};

/**
 * D38 — ĐỒNG HỒ TRONG PAYLOAD TRẠNG THÁI.
 *
 * `vongMoLuc`/`now` truyền vào chứ không đọc `Date.now()` ở đây: `trangThaiCongKhai`
 * nằm trên đường replay, và một lời gọi đồng hồ hệ thống trong đường đó là trận
 * dựng lại ra kết quả khác mỗi lần chạy (xem đầu `dong_ho.ts`). Ở đây đồng hồ chỉ
 * đi RA màn hình, không đi vào phép tính nào.
 *
 * Vắng cả hai ⇒ trường `dong_ho` VẮNG MẶT khỏi payload, không phải bằng 0. Client
 * phân biệt được "trận này không có hạn" (trận cũ) với "hết giờ rồi".
 */
/**
 * MÀN TẬP MIỄN GIỜ (founder 02/08) — mấy vòng hướng dẫn đầu KHÔNG chạy đồng
 * hồ. Một cửa hỏi duy nhất, dùng chung cho cả payload trạng thái lẫn đường
 * NỘP VÒNG: hai chỗ lệch nhau nghĩa là màn hiện "tạm dừng" mà server vẫn chốt
 * hộ — đúng lớp lỗi tệ nhất (người chơi mất lượt trong khi tin mình còn giờ).
 */
function manTapMienGio(seed: number, vong: number): boolean {
  // ⚠ `laSeedManTap` chứ không so một hằng: trận tập ĐÃ LƯU chạy seed cũ vẫn
  // phải được miễn giờ sau khi v36 đổi seed — người chơi đang dở bàn không
  // được mất lượt vì repo bump phiên bản (D168).
  return laSeedManTap(seed)
    && vong <= HOLDEM_DECISIONS.MAN_TAP_MIEN_GIO_DEN_VONG;
}

/**
 * CỬA HỎI DUY NHẤT "vòng này có chạy đồng hồ không" (16/08 — tầng 2).
 *
 * Hai lý do miễn giờ, MỘT cửa: (a) màn tập vòng 1–4 (D53, theo seed + vòng);
 * (b) cờ `mien_gio` trên dòng trận — ⚠ TỪ 16/08 CHIỀU KHÔNG CÒN ĐƯỜNG NÀO GHI
 * TRUE: luật "hai trận đầu không giờ" (sáng 16/08) bị founder BÁC ngay chiều
 * cùng ngày ("chỉ miễn giờ khi chơi hướng dẫn thôi"). Cột 0039 giữ lại vì hai
 * trận prod đã tạo dưới luật đó phải giữ đúng sự thật của chúng; trận mới luôn
 * ghi false. Đường đọc giữ nguyên để hai trận ấy không đổi hành vi giữa chừng.
 * Mọi đường — payload đồng hồ · nộp vòng · khớp lệnh · mở bảng · quét dọn —
 * PHẢI hỏi qua đây. Hai chỗ tự hỏi hai kiểu là màn hiện "không tính giờ" mà
 * server vẫn chốt hộ: đúng lớp lỗi D53 đặt tên, ở dạng người chơi mất lượt
 * trong khi tin mình còn giờ.
 */
function vongMienGio(t: { seed: number; mienGio: boolean }, vong: number): boolean {
  return t.mienGio || manTapMienGio(t.seed, vong);
}

/**
 * SỐ TRẬN ĐÃ XONG của một người — thước D62/D86: đếm dòng `holdem_results`
 * (chỉ ghi khi trận đi tới màn kết), KHÔNG đếm trận mở (105 bỏ dở / 50 xong
 * ⇒ đếm trận mở là farm được). `tienDoQuaBeta` (server/qua_beta.ts) dùng cùng
 * biểu thức trong CTE của nó; gate mở khoá map 12/16 (D86) sẽ dùng lại ở đây.
 */
/** Ghế người đã ĐẦU HÀNG (tư thế 'dau_hang'). */
function banDauHang(st: TrangThaiTran): boolean {
  return st.ghe.find((g) => g.id === 'ban')?.tu_the === 'dau_hang';
}

/**
 * Trận đã KHÉP với người chơi: lật hết ô / còn ≤1 ghế (`daKetThuc`) HOẶC người
 * chơi đã đầu hàng. Hai cửa dùng chung: `xong` ở /rounds và cổng mổ xẻ — lệch
 * là trận "xong" mà màn kết từ chối mở (409 chua_xong).
 */
function tranKhepLai(st: TrangThaiTran): boolean {
  return daKetThuc(st) || banDauHang(st);
}

export async function demTranXong(db: pg.Pool | pg.PoolClient, userId: string): Promise<number> {
  // Đầu hàng khép trận thành 'xong' (22/08) nhưng KHÔNG đếm là trận xong — nếu
  // không thì đầu hàng ở vòng 1 ba lần là mở khoá map 12 (D86: đếm được là farm được).
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM holdem_results WHERE user_id = $1 AND dau_hang = false`, [userId]);
  return Number(rows[0]?.n ?? 0);
}

/** Trần số GHOST dựng trong một lần đọc bàn — xem chỗ dùng trong `dungBan`. */
const GHOST_TOI_DA = 6;

/**
 * ĐƯỜNG NAV THEO VÒNG (17/08) — nền của THẺ KẾT TRẬN (`man-ket-de-khoe.md`) và
 * của GHOST bạn cùng bàn. Trả NAV mọi ghế SAU mỗi vòng đã chốt.
 *
 * ⚠ Dựng bằng REPLAY THEO TIỀN TỐ, không bịa từ trạng thái cuối và không ghi
 * thêm event nào: engine là hàm tất định của (seed, log) nên `replay(prefix)`
 * là đúng trạng thái người chơi ĐÃ sống qua ở vòng đó — cùng lý lẽ với
 * `khoanhKhacCuaTran`. Chi phí O(vòng²) trên một endpoint chạy MỘT LẦN sau
 * trận (16 vòng ⇒ 16 lượt replay ~vài ms), không nằm trên đường nóng.
 * ⚠ KHÔNG truyền đuôi `moBangCho`/`khopCho` cho tiền tố: đuôi là thứ đang CHỜ
 * của vòng hiện tại, áp nó vào một vòng trong quá khứ là dựng lại một trạng
 * thái chưa từng tồn tại.
 */
function duongNav(
  t: { seed: number; log: readonly HanhDongLog[]; ghe: readonly GheMoi[] | null;
       luat: ReturnType<typeof luatCua>; soO?: number | null | undefined },
): { vong: number; nav: Record<string, number>; phoi_ban_bp: number }[] {
  const ra: { vong: number; nav: Record<string, number>; phoi_ban_bp: number }[] = [];
  for (let n = 1; n <= t.log.length; n++) {
    const { st } = replay(
      t.seed, t.log.slice(0, n), false, t.ghe ?? undefined, t.luat, 0, false,
      t.soO ?? undefined);
    const nav: Record<string, number> = {};
    for (const g of st.ghe) nav[g.id] = navCua(g);
    /*
     * PHƠI NHIỄM của ghế mình cuối vòng (bp của NAV) — nền của dấu mốc "cắt lỗ
     * trước cú sập" (§5.1). Tính ở đây vì tiền tố replay đã dựng sẵn trạng thái;
     * tính lại ở chỗ khác là bản sao thứ hai của cùng một phép (D61).
     */
    const ban = st.ghe.find((g) => g.id === 'ban');
    const navBan = ban ? navCua(ban) : 0;
    const viThe = ban
      ? Object.values(ban.vi_the).reduce((a, b) => a + b, 0)
        + Object.values(ban.vi_the_khong ?? {}).reduce((a, b) => a + b, 0)
      : 0;
    ra.push({ vong: n, nav, phoi_ban_bp: navBan > 0 ? Math.round((viThe * 10000) / navBan) : 0 });
  }
  return ra;
}

/**
 * MỞ KHOÁ THEO TRẬN XONG (D86; config `MO_KHOA`) — hàm THUẦN, một nguồn cho
 * cả cửa CHẶN (`POST /matches`) lẫn cửa KHAI (`GET /me/tien-do`). Hai chỗ tự
 * tính là hai chỗ sẽ trôi, và cú trôi ở đây là sảnh mời một cỡ bàn mà server
 * từ chối (D61).
 */
export function moKhoaTheoTran(soTranXong: number): {
  co_map: number[]; khau_vi: boolean; con_thieu: Record<string, number>;
} {
  /*
   * D307 — KHOÁ CỠ BÀN ĐÃ GỠ HẲN (founder 08/09). `co_map` GIỮ trong DTO và luôn
   * trả ĐỦ cỡ: client cũ nằm trong cache vẫn đọc được, sảnh không phải phân nhánh,
   * và `con_thieu` từ nay chỉ còn đúng một khoá `khau_vi`. Xem `MO_KHOA` ở config
   * cho đường đi của quyết định (D86 khoá cả ba cỡ → D300 gỡ 12 → D307 gỡ nốt 16).
   */
  const coMap = [...(HOLDEM_DECISIONS.CO_MAP_CHON as readonly number[])];
  const conThieu: Record<string, number> = {};
  const khauVi = soTranXong >= HOLDEM_DECISIONS.MO_KHOA.KHAU_VI;
  if (!khauVi) conThieu.khau_vi = HOLDEM_DECISIONS.MO_KHOA.KHAU_VI - soTranXong;
  return { co_map: coMap, khau_vi: khauVi, con_thieu: conThieu };
}

function dongHoCongKhai(
  st: TrangThaiTran, vongMoLuc: Date | null, now: Date,
  /** v32 — giây cộng thêm của THẺ GIỜ. Xem `themGiayKyNgo` (một nguồn). */
  themS = 0,
  /** Cờ `holdem_matches.mien_gio` của trận — xem `vongMienGio`. */
  mienGioTran = false,
) {
  // D442 — vòng mốc chợ trait được cộng giờ nghĩ (`themGiayTrait`, một nguồn với mọi cửa soi hạn bên dưới).
  const d = soiDongHo(vongMoLuc, st.vong, st.map.o.length, now, themS + themGiayTrait(st, st.vong), st.gian_la === true,
    st.dong_ho_minigame === true, st.nhip_xen_ke === true, st.loi_chon_truoc === true);
  if (vongMienGio({ seed: st.seed, mienGio: mienGioTran }, st.vong)) {
    // Đồng hồ ĐỨNG YÊN ở mức đầy: client vẽ "TẠM DỪNG"/"KHÔNG TÍNH GIỜ" thay
    // vì đếm lùi, và `het_gio: false` khiến cả hai đường tự-nộp của client im.
    return {
      con_lai_s: d.tong_s, tong_s: d.tong_s, het_gio: false,
      an_han_s: DONG_HO.AN_HAN_S, tam_dung: true as const,
      /*
       * VÌ SAO tạm dừng — client đổi NHÃN theo đây, không tự suy từ seed.
       * `tran_lam_quen` chỉ còn xảy ra với hai trận prod tạo sáng 16/08 (cột
       * `mien_gio` true) — trận mới không bao giờ mang nó nữa.
       */
      ly_do: (mienGioTran ? 'tran_lam_quen' : 'man_tap') as 'tran_lam_quen' | 'man_tap',
    };
  }
  /*
   * M2 — ĐỒNG HỒ HAI PHA "ĐỌC → QUYẾT" (D90, thi công 17/08).
   *
   * D76 đã CỘNG `XEM_KET_QUA_S` giây vào vòng ≥ 2 để người chơi có thời gian đọc
   * kết quả vòng trước — nhưng nó lẫn vào MỘT mặt số, nên người mới nhìn "40s"
   * rồi tưởng cả 40 giây đó là để quyết, và bị hụt đúng lúc đang đọc. Chia đôi
   * mặt số bằng nhãn: `pha='doc'` trong khoảng đầu, `pha='quyet'` phần còn lại.
   * ⚠ TỔNG GIÂY KHÔNG ĐỔI MỘT LI (D90 M2 ghi rõ) — đây là chuyện GỌI TÊN, không
   * phải chuyện nới giờ; nới giờ đã bị founder bác ở D90.
   * ⚠ Server phát pha, client KHÔNG tự suy từ `tong_s - 15`: THẺ GIỜ (v32) cộng
   * giây vào `tong_s`, nên phép trừ ở client sẽ lệch đúng với người có đặc quyền.
   */
  const docS = st.vong >= 2 ? (st.dong_ho_minigame === true ? DONG_HO_MINIGAME.XEM_KET_QUA_S : DONG_HO.XEM_KET_QUA_S) : 0;
  const daTroi = d.tong_s - d.con_lai_s;
  return {
    con_lai_s: d.con_lai_s,
    tong_s: d.tong_s,
    /** Pha ĐỌC kết quả vòng trước (vòng 1 không có gì để đọc ⇒ vào QUYẾT ngay). */
    pha: (docS > 0 && daTroi < docS ? 'doc' : 'quyet') as 'doc' | 'quyet',
    /** Số giây của pha ĐỌC (0 ở vòng 1) — client vẽ vạch chia, không tự tính. */
    doc_s: docS,
    /*
     * SERVER NÓI HẾT GIỜ THÌ MỚI LÀ HẾT GIỜ (C4). Client đếm lùi từ `con_lai_s`
     * cho mượt, nhưng con số client tự đếm KHÔNG được dùng để khoá nút: đồng hồ
     * client chạy nhanh hơn thì người chơi mất lượt oan, chạy chậm hơn thì tưởng
     * còn giờ. Cờ này là câu trả lời của server tại thời điểm response.
     */
    het_gio: d.qua_han_vong,
    /** Ân hạn đã hết ⇒ vòng kế tiếp nộp lên sẽ bị chốt hộ. */
    an_han_s: DONG_HO.AN_HAN_S,
  };
}

/**
 * v32 — KHỐI KỲ NGỘ trong payload trạng thái (doc 06 §1.4 + §1.5).
 *
 * Tách hàm riêng vì nó có BỐN luật che khác nhau, và trộn chúng vào giữa
 * `trangThaiCongKhai` là cách chắc nhất để một luật bị sửa nhầm sau này.
 */
function khoiKyNgo(
  st: TrangThaiTran, kn: ReturnType<typeof replay>['kyNgo'],
) {
  const vong = st.vong;
  const dangCo = (id: DacQuyenKyNgoId) => {
    const tu = kn.dacQuyen.get(id);
    return tu !== undefined && vong >= tu;
  };
  const lanNay = kn.lan.find((l) => l.vong === vong);
  return {
    /** Vòng nào của map này là vòng kỳ ngộ — client vẽ mốc trên thanh tiến độ. */
    vong_ky_ngo: (KY_NGO.VONG[st.map.o.length] ?? []),
    /**
     * LỜI MỜI của vòng này — chỉ khi ĐANG ở vòng kỳ ngộ và CHƯA chốt.
     * Chốt rồi thì lời mời biến mất: bộ được mời đã nằm trong `lan[].moi`, và
     * để nó ở đây nữa là mời client vẽ hai màn chọn cho cùng một cú chọn.
     */
    moi: lanNay && !lanNay.chon ? lanNay.moi : null,
    /** Từng lần kỳ ngộ ĐÃ TỚI: chọn gì, tiến độ tới đâu, xong ở vòng nào. */
    lan: kn.lan.filter((l) => l.vong <= vong).map((l) => ({
      vong: l.vong,
      // D88 — lời mời có tác giả: chương hồi tại vòng kỳ ngộ đó. Cùng giá
      // trị đi vào `hd_chon_ky_ngo` — một nguồn, hai chỗ đọc.
      hoi: l.hoi,
      chon: l.chon,
      tien_do: l.tien_do,
      xong_o_vong: l.xong_o_vong,
      dac_quyen: l.chon
        ? NHIEM_VU_KY_NGO.find((x) => x.id === l.chon)?.dac_quyen ?? null : null,
    })),
    /** Đặc quyền ĐANG hiệu lực ở vòng này — UI vẽ huy hiệu, không tự suy. */
    dang_co: ([
      'ban_do_chu_ky', 'phieu_mo_bang', 'the_gio', 'chuong_doi_pha',
    ] as const).filter(dangCo),
    /** PHIẾU MỞ BẢNG còn lại. 0 khi không có đặc quyền — số, không phải null. */
    phieu_mo_bang: dangCo('phieu_mo_bang') ? kn.phieuHienThi : 0,
    /** THẺ GIỜ — số giây ĐÃ được cộng vào `dong_ho.tong_s` của vòng này. */
    the_gio_s: themGiayKyNgo(kn.dacQuyen, vong),
    /*
     * BẢN ĐỒ CHU KỲ — nhãn pha của MỌI Ô ĐÃ LẬT. Thông tin HỒI CỐ: nó nói về
     * quá khứ, nên nó không giẫm lên bất kỳ lá chiến thuật nào (mọi lá đều nói
     * về tương lai) — đúng ràng buộc founder đặt 15/08.
     * ⚠ CHỈ ô đã lật (`slice(0, vong)`): kèm ô chưa lật là phát không một máy
     * dò tương lai, thứ mà cả trò dựng lên để bán bằng Bảng điện tử.
     */
    ...(dangCo('ban_do_chu_ky') ? {
      ban_do_chu_ky: (st.map.trang_thai ?? [])
        .slice(0, vong).map((t) => t.giai_doan_nen),
    } : {}),
    /*
     * CHUÔNG ĐỔI PHA — ô KẾ TIẾP có phải ô đổi pha không. CỐ Ý không nói pha
     * nào: đó là ranh giới với Lướt Sóng (lá đó đoán NỘI DUNG — tên sự kiện),
     * còn chuông chỉ nói CẤU TRÚC. Bỏ ranh giới này là lá Lướt Sóng thành thừa.
     */
    ...(dangCo('chuong_doi_pha')
      ? { chuong_doi_pha: kn.doiPha[vong] ?? false } : {}),
  };
}

/**
 * D480 (founder 04/10: % thị trường + NAV giấu tới QUYẾT TOÁN) — MÀN CỦA VÒNG VỪA NỘP CÒN CHẠY ⇒ trạng thái trận chưa được công bố. Trả đúng
 * thứ người chơi thấy LÚC BẤM NỘP (trạng thái đầu vòng `vong`, chưa chốt) + cờ `cho_man` (vòng + lá vừa lật — lá đã lật là công khai). Không
 * đồng hồ (không ai nộp hộ trong lúc màn), không kết quả vòng, không vị thế sau chốt: điểm cuối đồ thị màn = % thị trường của vòng, lộ
 * trạng thái sau chốt là lộ đáp án của màn (F12).
 */
/**
 * CHART TÀI SẢN — `lich_su_thi_truong`: % công khai (bp) từng mã của mọi vòng ĐÃ CHỐT trong replay. Màn còn chạy thì
 * replay chưa chốt vòng vừa nộp (D480) ⇒ nó tự vắng — `tests/chart_tai_san_api.test.ts` canh. Rỗng ⇒ không gửi trường.
 */
function lichSuThiTruongDTO(r: ReturnType<typeof replay>, seed: number) {
  const ds = r.lichSuThiTruong
    .map((x) => ({ vong: x.vong, thi_truong: Object.entries(x.ls).map(([ma, delta_bp]) => ({ ma, delta_bp, ...nenThiTruong(r.st, seed, x.vong, ma, delta_bp, x.laiSuat) })) }));
  return ds.length > 0 ? { lich_su_thi_truong: ds } : {};
}

/**
 * D558 — RÂU + KHỐI LƯỢNG của nến vòng (founder 08/10: *"thêm râu và khối lượng đi"*). Đường giá "thị trường không có bạn": CÙNG bộ sinh màn
 * (`boiCanhMan` + `dungDongManDu`, cùng `seedMan(seed, vòng, mã)`), đám đông nền, KHÔNG có lớp riêng theo ghế (lệnh người, đòn bẩy, bầy Cá nhân, lệnh
 * lớn của bot vai lớn) — điểm cuối neo về % engine (D479) nên thân nến = `delta_bp`. Chỉ gọi cho vòng ĐÃ chốt. Đo: 78 đường (13 vòng × 6 mã) ~43 ms.
 * `cao_bp`/`thap_bp` so với giá mở vòng (đã kẹp phủ thân); `kl` = tổng khối lượng phần chạy (đơn vị tương đối, client chỉ so trong cùng mã).
 */
function nenThiTruong(st: TrangThaiTran, seed: number, vong: number, ma: string, bp: number, laiSuat: number | null): { cao_bp?: number; thap_bp?: number; kl?: number } {
  if (!MA_MINIGAME[ma]) return {};
  const bc = boiCanhMan({ seedTran: seed, vong, map: st.map, oUp: st.o_up === true, viThe: { [ma]: 1 }, loiSuat: { [ma]: bp },
    laiSuatDiem: laiSuat, namNac: st.thanh_khoan_nam_nac === true, ...(st.beta_tai_san_v2 === true ? { betaV2: true } : {}),
    // D561 — vòng đã vào giá: nến của vòng cũng đi theo tin rồi quay đầu (một nguồn với engine + màn).
    ...((() => { const o = st.map.o[st.o_up === true ? vong : vong - 1]; return vongXetVaoGia(st, vong, o) ? { vaoGiaMa: [...maVaoGia(st, vong, o)] } : {}; })()) });
  if ('loi' in bc) return {};
  const d = dungDongManDu(bc), chay = d.min.slice(NEN_LS * K_MIN), o0 = chay[0]?.o;
  if (!o0) return {};
  const bpCua = (g: number) => Math.round((g / o0 - 1) * 10000);
  return {
    cao_bp: Math.max(0, bp, bpCua(Math.max(...chay.map((c) => c.h)))),
    thap_bp: Math.min(0, bp, bpCua(Math.min(...chay.map((c) => c.l)))),
    kl: Math.round(khoiLuongChay(d.min, d.lon).reduce((a, b) => a + b, 0) * 10) / 10,
  };
}

/**
 * THÂN TRẢ LỜI CỦA CÚ NỘP VÒNG — MỘT nơi dựng (A11.5) cho cả cú nộp thật lẫn cú GỬI LẠI (SPEC chan-truoc-beta: server đã commit mà
 * client mất phản hồi ⇒ gửi lại nhận đúng thân lần một, trừ đồng hồ). Hai bản dựng thì bản thứ hai trôi, và trôi ở đây là màn trận
 * của người vừa mất sóng vẽ một vòng khác với vòng họ đã nộp.
 *   `choMan` — D480: vòng có màn ⇒ trả trạng thái TRƯỚC chốt (giấu kết quả vòng tới quyết toán); `hetMan` = mốc (ms) màn hết giờ.
 *   `dongHo` — đồng hồ của vòng VỪA MỞ; vắng khi trận đã khép.
 */
function thanNopVong(a: {
  matchId: string; banMa: string | null; seed: number; vong: number;
  truoc: ReturnType<typeof replay>; sau: ReturnType<typeof replay>;
  hetGio: boolean; xong: boolean; choMan: boolean; hetMan: number | undefined;
  dongHo: { vongMoLuc: Date | null; now: Date; mienGio?: boolean } | undefined;
}) {
  const lv = a.sau.loiVonCuoi;
  /*
   * D533 — LÕI VỐN: VÌ SAO LỆNH CỦA BẠN KHÔNG CHẠY — dựng MỘT lần, đi kèm CẢ nhánh chờ màn bên dưới. Trước đây nhánh ấy trả
   * `dtoChoMan` và bỏ mất trường này ⇒ ở mọi vòng có màn (bàn 8: 5/7 vòng) lệnh bị bác IM LẶNG: người chơi chỉ thấy "không có màn".
   * Lý do bị bác không lộ gì của màn (không giá, không kết quả vòng).
   *
   * `apDaoDanhMuc`/`apKhoaTaiSan` bỏ qua IM LẶNG khi không hợp lệ (giống `mua`), nên nếu response không mang lý do ra thì người chơi
   * bấm nút, thấy vòng chốt bình thường, và không đời nào biết danh mục mình không hề đổi. `null` khi lệnh chạy trót lọt.
   */
  const loiVonDto = (lv.dao || lv.khoa || lv.short || lv.lenh || lv.tiet_kiem)
    ? {
      ...(lv.dao ? { dao: lv.dao } : {}),
      ...(lv.khoa ? { khoa: lv.khoa } : {}),
      ...(lv.short ? { short: lv.short } : {}),
      // v10 NAV — lệnh giao dịch bị từ chối cũng phải NÓI RA, cùng luật.
      ...(lv.lenh ? { lenh: lv.lenh } : {}),
      /*
       * ⚠⚠ v43 — THIẾU DÒNG NÀY LÀ MỘT LỖI THẬT (sống qua D314 lẫn bản đầu D317): khi CHỈ lệnh gửi hỏng thì cả `loi_von` là `null` —
       * người chơi bấm gửi, thấy vòng chốt bình thường, không đời nào biết tiền mình chưa hề vào sổ. Lộ ra ở bài API đi hết đường chính
       * (`ngan_hang_api.test.ts`), không bài đơn vị nào bắt được.
       */
      ...(lv.tiet_kiem ? { tiet_kiem: lv.tiet_kiem } : {}),
    }
    : null;
  if (a.choMan) {
    return {
      match_id: a.matchId, ban_ma: a.banMa, status: 'dang_choi', tu_dong: a.hetGio,
      ...dtoChoMan(a.truoc, a.seed, a.vong, a.hetMan), loi_von: loiVonDto,
    };
  }
  return {
    match_id: a.matchId,
    // BÀN CHUNG: màn kết dựng từ response cú nộp cuối ⇒ phải mang mã bàn ở đây nữa.
    ban_ma: a.banMa,
    ket_qua_vong: dungKetQuaVong(a.sau.ketQuaCuoi!, a.sau),
    xong: a.xong,
    loi_von: loiVonDto,
    /*
     * D38 — VÒNG NÀY DO HẾT GIỜ CHỐT HỘ. Phải nói ra, không được để người chơi tự đoán từ việc "sao Vốn của tôi không đổi": họ vừa
     * mất một lượt quyết định, và một cơ chế trừng phạt mà nạn nhân không nhận ra là một cơ chế chỉ gây bực chứ không dạy được gì.
     */
    tu_dong: a.hetGio,
    ...trangThaiCongKhai(a.sau.st, a.seed, a.dongHo, a.sau.kyNgo, a.sau.pcVong, a.sau.pcTheoGhe),
    ...lichSuThiTruongDTO(a.sau, a.seed),
  };
}

function dtoChoMan(r: ReturnType<typeof replay>, seed: number, vong: number, hetLuc?: number) {
  const st = r.st, i = st.o_up === true ? vong : vong - 1, o = st.map.o[i];
  return {
    ...trangThaiCongKhai(st, seed, undefined, r.kyNgo, r.pcVong, r.pcTheoGhe),
    ...lichSuThiTruongDTO(r, seed),
    /*
     * D533 — `het_ms`: còn bấy nhiêu ms nữa thì màn hết giờ (đo ở server lúc trả) ⇒ web tự hỏi lại trạng thái đúng lúc đó. Trước đây web chỉ hỏi lại
     * khi người chơi ĐÓNG màn, mà hỏi bằng `refetch` không đè được trạng thái cục bộ ⇒ bàn kẹt ở vòng vừa nộp, CHỐT VÒNG mờ, vòng sau bị chốt hộ
     * (founder 06/10, ảnh vòng 1). Giờ hết màn là thông tin công khai — không lộ gì của màn. Vắng = không biết (trận miễn giờ chưa mở màn).
     */
    cho_man: { vong, ...(o ? { o: upLaPha(st, vong, o) ? { kind: 'giai_doan' as const, up: true as const } : oCongKhai(o) } : {}), ...(hetLuc ? { het_ms: Math.max(0, hetLuc - Date.now()) } : {}) },
  };
}

/**
 * D561 — khoá úp lá pha (`up_la_pha`, founder 08/10): ô PHA của vòng có màn giữ ÚP tới hết màn — trạng thái chờ màn chỉ nói "lá úp" (mặt lá đi kèm
 * `/ket-qua` để màn lật lúc kết quả). Ô tin giữ như cũ (tin biết trước; kỹ năng là đọc dấu hiệu "đã vào giá").
 */
function upLaPha(st: TrangThaiTran, vong: number, o: OThiTruong): boolean {
  return st.up_la_pha === true && o.kind === 'giai_doan' && coManMinigame(vong, st.map.o.length, st.nhip_xen_ke === true);
}

function trangThaiCongKhai(
  st: TrangThaiTran, seed: number,
  /**
   * D38 — mốc mở vòng + mốc "bây giờ" của CHÍNH request này. Xem `dongHoCongKhai`.
   * `mienGio` = cờ trận làm quen (16/08) — vắng ⇒ false, tức trận có giờ như cũ.
   */
  dongHo?: { vongMoLuc: Date | null; now: Date; mienGio?: boolean },
  /** v32 — tiến trình kỳ ngộ do `replay` suy ra. Vắng ⇒ khối `ky_ngo` VẮNG MẶT. */
  kyNgo?: ReturnType<typeof replay>['kyNgo'],
  /** PHONG CÁCH — các vòng đã chốt, do `replay` gom. Vắng ⇒ khối VẮNG MẶT. */
  pcVong?: readonly VongPhongCach[],
  /** D312 — phong cách của MỌI ghế, để dải ghế đối thủ có hạng thay cho số tiền. */
  pcTheoGhe?: ReadonlyMap<string, readonly VongPhongCach[]>,
) {
  const nguoi = st.ghe.find((g) => g.id === 'ban')!;
  const oHienTai = st.map.o[st.vong - 1];
  /*
   * D433 — lá tin mà lời báo rọi vào ô đang cược: luật ô úp đọc lá VỪA LẬT (cùng lá bot đọc), luật ngửa đọc ô
   * ngay trước ô của vòng — xem `iLaBaoTruoc`. Chỉ tầng HIỂN THỊ (`telegraph`): engine, bot, replay không đọc nó.
   */
  const iTruoc = iLaBaoTruoc(st);
  const oTruoc = st.map.o[iTruoc];
  /*
   * D337 — 'ban' cũng đi qua khoá-theo-thứ-hạng CỦA CẢ BÀN khi có `pcTheoGhe`
   * (mọi chỗ gọi thật đều truyền — xem `phongCachCaBan`). Không có `pcTheoGhe`
   * (trận mới / client cũ) ⇒ rơi về `chamPhongCach(pcVong)` KHÔNG khoá, đúng
   * hành vi trước D337 — `pcVong` vốn LÀ lát 'ban' của `pcTheoGhe` (một nguồn).
   */
  const pc = (pcTheoGhe ? phongCachCaBan(st, pcTheoGhe).get('ban') : undefined)
    ?? (!pcTheoGhe && pcVong && duVongDeCoHang(pcVong.length) ? chamPhongCach(pcVong) : null);
  /*
   * D343 — CHƯA ĐỦ VÒNG ⇒ ĐIỂM TẠM TÍNH, KHÔNG HẠNG. Founder 16/09: *"ít nhất bạn phải
   * cho nó hiện ngay từ đầu nhưng màu xám vì chưa quyết định điểm, thanh vẫn chạy/ được
   * chấm bình thường nhưng màu nhạt và điểm là dấu '?'"*.
   * ⚠ CỬA CỨNG D337 GIỮ NGUYÊN: khối này KHÔNG mang `hang` — client không có chữ nào để
   * hiện, kể cả khi ai đó quên nhánh xám. Và nó là trường RIÊNG, không nằm trong
   * `phong_cach`: bản web cũ (service worker giữ nó thêm 2–3 lần mở) SUY hạng từ `diem`
   * (`hangCua` trong `ThanhPhongCach`), nên nhét điểm tạm vào `phong_cach` là cho bản cũ
   * hiện hạng thật — và nổ lớp phủ S — ngay vòng 2.
   * Vòng 1 chưa chốt gì ⇒ 0 điểm: thanh rỗng, xám, dấu ?. Trận không NAV ⇒ không khối.
   */
  const pcTamTinh = pc || st.nav !== true ? null
    : (pcTheoGhe
      ? phongCachCaBan(st, pcTheoGhe, undefined, { tamTinh: true }).get('ban')
      : (pcVong?.length ? chamPhongCach(pcVong) : undefined))
      ?? { diem: 0, streak: 0 };
  return {
    vong: st.vong,
    // D382 — lá cuối chỉ để quyết toán vòng áp chót, không mở thêm một vòng.
    tong_vong: soVong(st),
    /*
     * ⭐ PHONG CÁCH CHƠI — thanh E→SSS trong trận (founder 17/08).
     *
     * Chỉ gửi ĐIỂM · HẠNG · STREAK. Ba trục KHÔNG gửi ở đây, có chủ ý: founder
     * chốt *"kết trận thì ở menu kết thúc mới khoe mấy chỉ số kia cụ thể thôi để
     * flex"* — trong trận đúng MỘT thanh. Gửi thừa thì sớm muộn cũng có người vẽ
     * nó ra, và lúc đó màn trận có bốn mặt số thay vì một.
     * Vắng khi chưa đủ `PC.SAN_VONG_TIN_CAY` vòng (D337 — thay bằng `phong_cach_tam_tinh`
     * ngay dưới, D343) hoặc trận không NAV. Hai khối không bao giờ cùng có mặt.
     */
    ...(pc ? {
      phong_cach: { diem: pc.diem, hang: pc.hang, streak: pc.streak },
    } : {}),
    ...(pcTamTinh ? {
      phong_cach_tam_tinh: { diem: pcTamTinh.diem, streak: pcTamTinh.streak },
    } : {}),
    ...(dongHo
      ? {
        dong_ho: dongHoCongKhai(st, dongHo.vongMoLuc, dongHo.now,
          (kyNgo ? themGiayKyNgo(kyNgo.dacQuyen, st.vong) : 0),
          dongHo.mienGio === true),
      }
      : {}),
    ban: {
      von: nguoi.von,
      /*
       * v10 NAV — ba trường tiền của CHÍNH MÌNH: thấy đủ (vi_the là của mình,
       * không phải thông tin ẩn). Đối thủ thì NGƯỢC LẠI — xem `bangDoiThu`.
       */
      ...(st.nav === true
        ? {
          nav: navCua(nguoi), tien_mat: nguoi.von, vi_the: { ...nguoi.vi_the },
          // v17 — sổ khống CHÍNH MÌNH (đối thủ vẫn chỉ lộ NAV) + cờ đặc quyền
          // để UI vẽ hàng KHỐNG mà không tự đoán theo tên lá.
          vi_the_khong: { ...(nguoi.vi_the_khong ?? {}) },
          co_ban_khong: st.lenh_khong === true && st.dac_quyen === true && st.loi_chi_trong_man !== true   // D530 — cùng cổng `coBanKhong` của engine
            && nguoi.danh_muc.chien_thuat.includes('ban_khong' as never),
          // v29 — cờ PHÍ VỘI VÀNG để `xemTruocLenh` client tính đúng phí phi
          // tuyến. Thiếu nó là "màn báo 140, bị trừ 190" — lớp lỗi D67 chặn.
          ...(st.phi_voi_vang === true ? { phi_voi_vang: true } : {}),
          /*
           * v42 (D311) — cờ SÀN CẤM KHỐNG THEO MÃ, cùng khuôn `phi_voi_vang` ngay
           * trên và cùng lý do: `xemTruocLenh` ở client gọi CHÍNH `giaiLenhMoc` với
           * cờ này, nên bản nháp tự từ chối — không có luật thứ hai ở client (C4/D61).
           * Thiếu nó là "màn cho xếp lệnh, server mới báo không được".
           */
          ...(st.khong_theo_ma === true ? { khong_theo_ma: true } : {}),
          /*
           * v49 (D342) — cờ CHIP KHỐNG THEO HẠN MỨC, cùng khuôn `khong_theo_ma`: `xemTruocLenh` ở
           * client gọi CHÍNH `giaiLenhMoc` với cờ này nên chip 100% ra đúng số server sẽ khớp.
           * Thiếu cờ là màn tính 100% tiền mặt còn server tính 100% hạn mức — lệch cả nghìn chip.
           */
          ...(st.khong_theo_han_muc === true ? { khong_theo_han_muc: true } : {}),
          /*
           * v43 (D314) — SỔ TIẾT KIỆM: CHỈ MÌNH THẤY.
           *
           * ⚠ Đối thủ chỉ thấy NAV, không thấy chi tiết sổ — cùng luật A3.1 với `vi_the`.
           * Biết đối thủ đang khoá bao nhiêu tiền và tới vòng nào là biết chính xác lúc
           * nào họ KHÔNG THỂ mua, tức đọc được nước đi của họ mà không phải đoán.
           * `con_vong` server tính hộ (C4) — client không suy từ `vong_mo`.
           */
          ...(st.ngan_hang === true && (nguoi.tiet_kiem ?? []).length > 0
            ? {
              tiet_kiem: (nguoi.tiet_kiem ?? []).map((h) => ({
                id: h.id,
                goc: h.goc,
                so_vong: h.so_vong,
                vong_mo: h.vong_mo,
                lai_bp: h.lai_bp,
                lai_don: h.lai_don,
                con_vong: h.vong_mo + h.so_vong - 1 - st.vong,
              })),
            }
            : {}),
        }
        : {}),
      // v55 (D411) — ví khảo sát lại (trận gộp XU: chính là `xu`) + cờ gộp để client đổi nhãn VÀNG → XU (nếp `up_o`).
      luot_khao_sat: viKhaoSat(st, nguoi),
      ...(st.gop_xu === true ? { xu_gop: true } : {}),
      /*
       * v55 (D409) — LỬA · XU · TRAIT đang mang (cặp vai đứng đầu) · RÀNG BUỘC (client chỉ vẽ)
       * · MỐC MUA cho phép (server suy — C4) · CHỢ TRAIT ở vòng mốc (lượt mời lần 0; cuộn qua GET /shop?cuon=k)
       * · NỘI GIÁN: LOẠI của các lá kế · CHỐT LỜI cho phép khi cầm Lướt Sóng. Vắng hết ở trận không cổng.
       */
      ...(st.lua === true
        ? ((): Record<string, unknown> => {
          const rb = st.trait_bat === true ? rangBuocCua(st, nguoi, st.vong) : RANG_BUOC_TRONG;
          const nac = nguoi.lua?.nac ?? 0;
          return {
            lua: {
              nac,
              chuoi: nguoi.lua?.chuoi ?? 0, bias: nguoi.lua?.bias ?? null, dac_biet: nguoi.lua?.dac_biet === true,
            },
            xu: nguoi.xu ?? 0,
          };
        })()
        : {}),
      ...(st.trait_bat === true
        ? ((): Record<string, unknown> => {
          const rb = rangBuocCua(st, nguoi, st.vong);
          const tcLenh = tuyChonLenhV55(st, nguoi);
          const moc = laMocTrait(st.vong, st.map.o.length, st) && !nguoi.da_chay && nguoi.tu_the !== 'dau_hang';
          const daLat = vongDaLat(st);
          return {
            trait: traitHieuLuc(st, nguoi),
            rang_buoc: {
              toi_da_ma: maxTaiSanCua(st, nguoi), te_liet: rb.teLiet,
              noi_gian: rb.noiGian, mu_tin: rb.muTin, suong_mu: rb.suongMu, sang_so: rb.sangSo,
              // D425 — GÔNG CÙM: trần BÁN (bp, để in luật) + phần BÁN còn được vòng này (chip, bản nháp kiểm trước — C4);
              // SỔ MỎNG: phí cố định mỗi lệnh (chip). Đọc từ CÙNG `tuyChonLenhV55` engine kiểm lúc áp.
              tran_ban_vong_bp: rb.tranBanVongBp,
              ...(tcLenh.tranBanVong
                ? { tran_ban_con: Math.max(0, tcLenh.tranBanVong.tranTien - tcLenh.tranBanVong.daBan) } : {}),
              phi_co_dinh_lenh: tcLenh.phiCoDinhLenh ?? 0,
              // D422 — cờ để màn vẽ đúng lá đang mang (không số tiền nào suy ở client — C4).
              mu_lua: rb.muLua, kien_nhan: rb.kienNhan, nong_voi: rb.nongVoi, di_sau: rb.diSau, lo_lenh: rb.loLenh,
            },
            // D422 — số vòng giữ liền từng mã (KIÊN NHẪN / NÓNG VỘI đọc); vắng khi chưa giữ gì.
            ...(Object.keys(nguoi.giu_lien ?? {}).length > 0 ? { giu_lien: nguoi.giu_lien } : {}),
            // D422 — ĐI SAU: dòng lệnh vòng này của các ghế bot, tính trước (xem `dongLenhBan`).
            ...(rb.diSau && !nguoi.da_chay ? { dong_lenh_ban: dongLenhBan(st, seed) } : {}),
            moc_cho_phep: mocChoPhepCua(st, nguoi),
            ...(rb.noiGian > 0
              ? { loai_la_ke: st.map.o.slice(daLat, daLat + rb.noiGian).map((o) => (o.kind === 'giai_doan' ? 'pha' : 'tin')) }
              : {}),
            ...(moc
              ? {
                cho_trait: {
                  moc: st.vong, lan_cuon: 0, moi: bayTrait(seed, 'ban', st.vong, 0, nguoi.trait ?? [], khoTraitCua(st), nguoi.vai),
                  gia_cuon: CHO_TRAIT.GIA_CUON_XU, cuon_toi_da: CHO_TRAIT.CUON_TOI_DA,
                },
              }
              : {}),
          };
        })()
        : {}),
      ...(st.luot_song_moi === true && nguoi.danh_muc.chien_thuat.includes('luot_song')
        ? {
          chot_loi_cho_phep: {
            nguong_min_bp: LUOT_SONG_MOI.NGUONG_MIN_BP, nguong_max_bp: LUOT_SONG_MOI.NGUONG_MAX_BP,
            buoc_bp: LUOT_SONG_MOI.NGUONG_BUOC_BP, phan_ban: LUOT_SONG_MOI.PHAN_BAN_CHO_PHEP,
            toi_da: LUOT_SONG_MOI.LENH_TOI_DA,
          },
        }
        : {}),
      danh_muc: nguoi.danh_muc,
      da_chay: nguoi.da_chay,
      // ⚠ THIẾU TRƯỜNG NÀY ĐÃ GIẾT CẢ TÍNH NĂNG ALL IN.
      // Client đọc `st.ban.tu_the` để biết khi nào khoá thao tác và tự lật nốt
      // board. API không gửi, mà bên client lại ép kiểu `as { tu_the?: string }`
      // nên trình biên dịch im lặng — cờ luôn false, auto-run không bao giờ
      // chạy, băng "ĐÃ ALL IN" không bao giờ hiện. Ép kiểu để bịt lỗi thiếu
      // trường là cách chắc chắn nhất để một tính năng chết mà không ai biết.
      tu_the: nguoi.tu_the,
      vong_roi: nguoi.vong_roi,
      /*
       * D2 — CÒN MẤY LƯỢT CẮT LỖ. Phải gửi ra, không để client tự suy.
       *
       * Nếu client tự tính `soLanCatLo(so_o) - da_dung` thì luật quota tồn tại ở
       * HAI nơi và sẽ lệch nhau ngay lần đầu đổi bảng theo cỡ map — mà engine là
       * bên thắng, nên biểu hiện sẽ là "nút vẫn sáng, bấm vào thì không có gì
       * xảy ra". Server suy, client vẽ (C4).
       */
      /** D6 — khẩu vị đã chốt của trận này. Client vẽ, không tự suy. */
      khau_vi: khauViCua(nguoi.khau_vi).id,
      /*
       * VAI (22/08) — LỘ cho cả bàn từ đầu (không ẩn kiểu Among Us: trò đã đủ
       * thông tin ẩn, thêm lớp ẩn là làm khó HIỂU chứ không khó GIỎI — D67).
       * Vắng = map 8 / trận cũ.
       */
      ...(nguoi.vai ? { vai: nguoi.vai } : {}),
      /*
       * v34 — hệ số tác động giá của CHÍNH MÌNH. Client `xemTruocLenh` phải
       * nhân đúng số này để phí báo trước = phí bị trừ (C4; lớp lỗi D67). Luôn
       * gửi (1 khi không vai) để client không phải đoán "vắng nghĩa là gì".
       */
      tac_dong_gia: heSoTacDongGia(st, nguoi),
      /*
       * D342 — ĐỘ SÂU SỔ QUY CHIẾU của phí vội vàng: vốn khởi điểm của vai, ĐÚNG số `apLenhMocNav`
       * truyền cho `apLenhGiaoDich` khi trận có vai. Cùng lý do `tac_dong_gia` ngay trên: thiếu
       * nó thì ghế vốn ×2/×3 thấy phí báo trước theo sổ 10.000, cao hơn phí bị trừ thật (D67).
       * Vắng khi trận không vai — lõi tự dùng `START_VON`, client không phải đoán.
       */
      ...(st.vai_co_rang === true ? { von_quy_chieu: vonDauCua(st, nguoi) } : {}),
      /*
       * D446 — TOÀN BỘ tham số lệnh của ghế, đúng bộ `apLenhMocNav` dùng lúc áp (`tuyChonLenhGhe`). Bản xem trước ở màn
       * shop đưa NGUYÊN bộ này vào `giaiLenhMoc` + `apLenhGiaoDich` — hết cảnh chép tay từng cờ (các cờ lẻ ngay dưới còn
       * giữ cho chỗ khác đọc và cho client cũ). Chỉ số + cờ, không chữ (D26).
       */
      tuy_chon_lenh: tuyChonLenhGhe(st, nguoi),
      /*
       * v50 (D345) — CỜ PHÍ LỆNH của chính mình, từ CÙNG hàm engine dùng (`phiLenhCua`): bản nháp
       * client phải tính đúng bảng phí nhẹ + phần còn lại của Khớp Nhanh, không thì màn báo phí cũ.
       */
      ...((() => {
        const pl = phiLenhCua(st, nguoi);
        return pl.phiLenhNhe ? {
          phi_lenh_nhe: true,
          // v51 (D346) — phí hai bậc; bản nháp ở client phải tính cùng bảng, không thì báo phí v50.
          ...(pl.phiLenhBac === true ? { phi_lenh_bac: true } : {}),
          ...(pl.phiLenhConBp !== undefined ? { phi_lenh_con_bp: pl.phiLenhConBp } : {}),
          // D516 — độ sâu chợ của ghế (vai vốn to): bản nháp client tính phí cùng số server.
          ...(pl.sauBp !== undefined ? { phi_lenh_sau_bp: pl.sauBp } : {}),
        } : {};
      })()),
      /*
       * v34 — CÁI GIÁ của tổ chức (mandate) và ĐẶC QUYỀN của nó (dòng tiền thô).
       * Cả hai VẮNG MẶT khi không phải tổ chức — client cũ/không vai không phân
       * nhánh. Dòng tiền chỉ phát cho ghế tổ chức: đây là đặc quyền, không phải
       * thông tin chung (D67 chốt thô; A3.1: không gắn tên ai).
       */
      ...((() => {
        const md = mandateCua(st, nguoi);
        return md ? { mandate: { tran_ma_bp: md.tranMaBp, cam_khong: md.camKhong },
          dong_tien: dongTienThoCua(st) } : {};
      })()),
      // v34 — Đòn Bẩy CẤP 2 ⇒ được nhắm đích PHỤ (cá mập ghim sẵn một lá). Server
      // khai cờ, client không suy "có 2 lá thì được" (engine là bên quyết — C4).
      ...(st.vai_co_rang === true && st.loi_chi_trong_man !== true && capThe(nguoi.danh_muc, 'don_bay') >= 2   // D530 — lõi chỉ trong màn: không nhắm mã
        ? { gan_phu_duoc: true } : {}),
      /*
       * D435 — founder 27/09: *"Đòn bẩy lv 2 đ** cho gán đòn bẩy 2 mã"*. `gan_phu_duoc` đọc tay TRƯỚC khi mua, nên đúng
       * vòng lấy lá thứ hai (lên cấp 2) nó còn tắt — trong khi tầng nhận đếm cấp SAU khi mua (`muaCaVong` rồi mới lọc
       * `gan_phu`) và NHẬN đích phụ ngay vòng ấy. Cờ này nói: đang cầm đúng MỘT lá, mua thêm lá nữa vòng này là đủ cấp 2
       * ⇒ client mở đường nhắm đích phụ khi người chơi đang chọn Đòn Bẩy ở quầy. Vẫn là server khai (C4).
       */
      ...(st.vai_co_rang === true && st.loi_chi_trong_man !== true && capThe(nguoi.danh_muc, 'don_bay') === 1
        ? { gan_phu_khi_mua: true } : {}),
      so_lan_cat_lo: nguoi.so_lan_cat_lo,
      con_lai_cat_lo: Math.max(0, soLanCatLo(st.map.o.length) - nguoi.so_lan_cat_lo),
      // Ghế của CHÍNH mình cũng có trạng thái cảm xúc: "cả bàn thấy" gồm cả bạn,
      // và avatar mình phải cháy/sáng cùng luật với đối thủ, không có ngoại lệ.
      // NAV chứ không phải tiền mặt — xem ghi chú cùng tên ở `bangDoiThu`.
      fx: fxCuaGhe(navCua(nguoi), nguoi.da_chay, nguoi.tu_the, vonDauCua(st, nguoi)),
      // LÕI VỐN — xem `canGatVon`. Nằm trong `ban` vì cả năm trường đều nói về
      // ghế của chính người chơi, không phải về bàn.
      ...canGatVon(st, nguoi),
      // D33/D34 — đặc quyền thẻ + nhịp chọn thẻ. Cùng chỗ, cùng lý do.
      ...dacQuyenCua(st, nguoi),
    },
    doi_thu: bangDoiThu(st, seed, kyNgo?.lan ?? [], pcTheoGhe),
    // D542 — SỐ VAI của các ghế KHÁC (đầu trận báo "Trận có 1 Cá Mập · 1 Đội Lái · 1 Tổ Chức"): biết bàn có bao nhiêu tay to, không biết ai.
    ...((() => { const dem: Record<string, number> = {}; for (const g of st.ghe) if (g.id !== 'ban' && g.vai) dem[g.vai] = (dem[g.vai] ?? 0) + 1; return Object.keys(dem).length ? { dem_vai: dem } : {}; })()),
    so_nguoi_song: st.ghe.filter((g) => !g.da_chay).length,
    /*
     * ─── v32 — KỲ NGỘ (doc 06 §1) ───────────────────────────────────────────
     *
     * Khối VẮNG MẶT hẳn khi trận không bật kỳ ngộ (map 8, hoặc trận ≤ v31):
     * vắng = "trò này không có kỳ ngộ", `null` = "có mà chưa tới". Hai nghĩa
     * khác nhau, và client cũ không phải phân nhánh theo phiên bản.
     *
     * ⚠ BA ĐẶC QUYỀN THÔNG TIN CHE Ở TẦNG API, không giấu bằng UI (A3.1 và
     * tiền lệ `suc_cang_dai`): chưa hoàn thành nhiệm vụ thì trường không có
     * mặt trong response, nên F12 không moi ra được.
     */
    ...(kyNgo && st.ky_ngo === true ? { ky_ngo: khoiKyNgo(st, kyNgo) } : {}),
    /*
     * v53 (D373) — Ô CỦA VÒNG CÒN ÚP. `null` ở đây nghĩa là "chưa lật", và `up_o` là thứ
     * phân biệt nó với `null` của trận đã kết thúc: client cũ không phân nhánh theo phiên
     * bản, nó chỉ hỏi cờ. Ô ấy KHÔNG được ló ra bằng bất kỳ cửa nào khác — xem `vongDaLat`,
     * cửa chung của `xu_huong` · `chinh_sach` · `lai_suat` · `bo_bai_con_lai` · bảng điện tử.
     */
    ...(oVongUp(st) ? { up_o: true as const } : {}),
    /*
     * v54 (D395) — THANG THANH KHOẢN NĂM NẤC. Cờ để client GIỮ CHỖ hàng thước ở dải 6 mã ngay từ trước
     * chốt đầu tiên (không thì dải cao thêm 6px đúng nhịp kết quả, mọi khối bên dưới giật theo) — cùng
     * nếp `up_o`: client hỏi cờ, không phân nhánh theo phiên bản. Luật công khai, không phải thông tin ẩn.
     */
    ...(st.thanh_khoan_nam_nac === true ? { thanh_khoan_nam_nac: true as const } : {}),
    /*
     * v54 (D403) — BỎ BÀI TẮT. Cờ để client GỠ nút BỎ (cùng nếp `up_o` / `thanh_khoan_nam_nac`: client hỏi cờ, không
     * phân nhánh theo phiên bản). Engine đã gỡ 'bo' khỏi danh sách được-làm — nút mà còn thì bấm vào chỉ ra THEO.
     */
    ...(st.bo_bai_tat === true ? { bo_bai_tat: true as const } : {}),
    /*
     * D406 — BẢNG VAI CỦA CHÍNH TRẬN NÀY (lời chào vai · nút vai ở chợ). Catalog chỉ nói khoá MẶC ĐỊNH; từ khi mặc định là
     * v54 (vốn đều · lõi gọn) mà bàn tập vẫn v53 thì đọc catalog là bàn tập hiện Cá Mập "×1" trong khi vốn thật ×3.
     * Vai không có răng (`vai_co_rang` tắt) thì vốn không nhân ⇒ hệ số 1, đúng như `vonDauCua`. Vắng = trận không vai.
     */
    ...(st.ghe.some((g) => g.vai)
      ? { vai_bang: vaiTheoLuat({ vonDeu: st.von_deu === true || st.vai_co_rang !== true, loiGon: st.loi_gon === true, traitGhimMinigame: st.trait_ghim_minigame === true, toChucV57: st.to_chuc_v57 === true, vonVaiV57: st.von_vai_v57 === true }) }
      : {}),
    /*
     * v54 (D405) — SỔ CHỊU NỀN KINH TẾ. Màn ngân hàng niêm yết LUẬT của sổ (lãi chốt hay thả nổi · có bị lạm phát ăn
     * không · đổ vỡ ở ngưỡng nào) — ba câu ấy đổi theo cờ, nên server phát cờ + SỐ (D26: số ở server, chữ ở client).
     * Vắng = sổ cổ điển (v43–v53): lãi chốt lúc gửi, miễn lạm phát, không đổ vỡ.
     */
    ...(st.tiet_kiem_lam_phat === true || st.tiet_kiem_tha_noi === true || st.ngan_hang_do_vo === true
      ? {
        tiet_kiem_kinh_te: {
          lam_phat: st.tiet_kiem_lam_phat === true,
          tha_noi: st.tiet_kiem_tha_noi === true,
          do_vo: st.ngan_hang_do_vo === true
            ? { bao_hiem_toi_da: NGAN_HANG_DO_VO.BAO_HIEM_TOI_DA, mat_bp: NGAN_HANG_DO_VO.MAT_BP }
            : null,
        },
      }
      : {}),
    o_hien_tai: oVongUp(st) ? null : (oHienTai ? oCongKhai(oHienTai) : null),
    // Các ô ĐÃ LẬT — cho người chơi nhìn lại dòng thời gian thị trường.
    // Vẫn đi qua oCongKhai() nên KHÔNG lộ cờ tin giả của ô chưa tới lúc lộ.
    // D302 — ô ĐÃ LẬT mang dấu cú đổi (`doi`), nếu có: đám đông đổi ô là luật
    // "lộ ex-post bắt buộc" (03 §3). `o_hien_tai` cố ý KHÔNG mang — ô đang mở
    // vẫn giấu (ex-ante), dù sổ đã có dòng của nó.
    // D382 — lá đã lật ở vòng N là o[0..N-1]. Vắng dòng này thì LÁ MỞ MÀN không được gửi
    // ra, và dải ô úp bắt đầu từ chính nó ⇒ "lá đầu vẫn úp".
    lich_su_o: st.map.o.slice(0, Math.max(0, oVongUp(st) ? st.vong : st.vong - 1)).map((o, i) => {
      // D422 — lớp che MÙ TIN / SƯƠNG MÙ đi trước dấu cú đổi (ô bị che thì cú đổi cũng không lộ).
      const ra = lopChe(st).o(i, o);
      if (ra.kind === 'che' || ra.kind === 'suong') return ra;
      const doi = oDoiCua(st, i + 1);
      return doi ? { ...ra, doi } : ra;
    }),
    // Quỹ vòng TỐI THIỂU của vòng này (cam kết nền × số người còn sống).
    // Con số thật chỉ chốt sau khi mọi ghế cam kết xong.
    quy_vong_hien_tai:
      nenVongCua(st) * st.ghe.filter((g) => !g.da_chay).length,
    // D584 — khoá giải bằng xu trait: hộp GIẢI nói tổng XU của giải vòng này (số suất co giãn theo ghế còn cược), không nói tiền.
    ...(st.giai_xu === true ? { giai_xu_hien_tai: tongXuGiai(st.ghe.filter((g) => conCuoc(g)).length, st.quy_co_gian === true) } : {}),
    // TELEGRAPH: ô trước là sự kiện → báo trước tính chất ô này. Cố ý KHÔNG
    // nói tin đó thật hay giả — đó là thông tin ẩn, lõi của cơ chế (17.3).
    telegraph: oTruoc?.kind === 'su_kien' && !lopChe(st).cheTin(iTruoc, oTruoc)
      ? {
        tu_su_kien: oTruoc.su_kien,
        nghieng_ve: oTruoc.bao_truoc,
        /**
         * DÂY CHUYỀN: tin này thường kéo theo tin gì.
         *
         * Phải lộ ra, nếu không thì cả cơ chế nhân quả vừa dựng là vô hình —
         * mà một tương tác người chơi không bao giờ nhận ra thì bằng không.
         *
         * ⚠ CỐ Ý chỉ nói "thường kéo theo", KHÔNG nói tin hiện tại thật hay
         * giả. Dây chuyền chỉ nổ khi tin THẬT, nên đúng chỗ này mới là chỗ
         * người chơi phải tự cân: tin thì đón đầu, không tin thì đứng ngoài.
         * Nói thẳng thật/giả là giết luôn quyết định đó.
         */
        // v35: một cửa mtKeTiep — lời hứa "thường kéo theo" phải khớp bảng
        // map đang dùng, không thì telegraph hứa một đằng map rút một nẻo.
        keo_theo: Object.entries(mtKeTiep(st.chuoi_mo_rong === true)[oTruoc.su_kien] ?? {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([id]) => id),
      }
      : null,
    /*
     * Đếm bài: thành phần công khai, thứ tự bí mật (16.8).
     *
     * ⚠ SỬA LỆCH-MỘT 28/07: bản cũ truyền `st.vong - 1`, tức đếm cả Ô ĐANG NGỬA
     * (`o_hien_tai` phơi nó ngay trong cùng payload) vào "còn lại". Founder thấy
     * đúng cảnh này trên prod: vòng 1 map 8 hiện "còn 8 ô" trong khi ô 1 đã ngửa
     * giữa màn — hai vùng của cùng một màn hình cãi nhau. "Còn" nghĩa là còn ÚP:
     * vòng v thì các ô 1..v đã ngửa, còn úp là `o.length − v`.
     */
    /*
     * v53 (D373) — "CÒN" NGHĨA LÀ CÒN ÚP, và ở v53 ô của vòng cũng còn úp ⇒ đếm cả nó.
     * Đây KHÔNG phải quay về lỗi lệch-một 28/07 ghi ngay trên: lần đó sai vì `o_hien_tai`
     * phơi ô ấy ra ngay trong cùng payload, nên "còn 8" cãi nhau với một ô đang ngửa giữa
     * màn. Ở v53 không ô nào ngửa giữa màn, nên cùng con số ấy nay là con số ĐÚNG.
     */
    bo_bai_con_lai: thanhPhanCongKhai(st.map, vongDaLat(st), st.the_luon_that === true),
    /** D457 — đồng hồ nhịp ngắn: web ẩn khoảnh khắc từng vòng (dồn về màn cuối trận). CHỈ có mặt khi bật. */
    ...(st.dong_ho_minigame === true ? { dong_ho_minigame: true as const } : {}),
    /** D561 — lõi của màn chọn LÚC CHỐT VÒNG (web hiện chip "MÀN: lõi" ở thanh đáy, gửi `loi_man`). CHỈ có mặt khi bật. */
    ...(st.loi_chon_truoc === true ? { loi_chon_truoc: true as const } : {}),
    /** D530 — lõi chỉ tác động trong màn: web thôi bày nhắm mã cho Đòn Bẩy · chữ (!) / gợi ý nói đúng luật. CHỈ có mặt khi bật. */
    ...(st.loi_chi_trong_man === true ? { loi_chi_trong_man: true as const } : {}),
    /**
     * D526 — các vòng mà sau khi chốt có màn minigame, dẫn xuất từ `coManMinigame` (MỘT nguồn — web chỉ hỏi danh sách này, không tự suy
     * "vòng ≥ 2"). Khung v57: 2 … hết; nhịp xen kẽ: theo `NHIP_XEN_KE`. CHỈ có mặt ở trận có màn.
     */
    /** D526 — trần đổi lõi mỗi vòng (`doiLoiToiDa`); CHỈ có mặt khi khác trần cũ (nhịp xen kẽ: 1). */
    ...(st.nhip_xen_ke === true ? { doi_loi_toi_da: doiLoiToiDa(st) } : {}),
    ...(st.dong_ho_minigame === true
      ? { lich_man: Array.from({ length: soVong(st) }, (_, i) => i + 1).filter((v) => coManMinigame(v, st.map.o.length, st.nhip_xen_ke === true)) }
      : {}),
    /*
     * ─── D43 — ĐƯỜNG ĐỌC CỦA MÁY TRẠNG THÁI (bất biến 8.4) ──────────────────
     * Ship cơ chế mà không hiện được đường đọc = cấm ship. Ba trường dưới đây
     * toàn thông tin CÔNG KHAI theo 8.2 — lịch là luật, xu hướng suy từ các ô
     * đã ngửa, cặp kỳ vọng/thực chỉ gửi khi ô ĐÃ ngửa giữa màn:
     * · `o_lich` — vị trí kỳ họp (1-indexed), client vẽ badge cả ô tương lai:
     *   "còn 2 ô nữa là kỳ họp" chính là thứ người chơi phải đếm được.
     * · `xu_huong` — chuỗi ĐÃ XÁC NHẬN (≥ ngưỡng máy dùng) tính hết ô đang
     *   ngửa; dưới ngưỡng gửi null: hiện "chuỗi ×1" là dạy sai luật quán tính.
     * · `chinh_sach` — chỉ khi ô hiện tại là kỳ họp: hàm phản ứng nói gì và
     *   thực tế ra gì — khoảnh khắc dạy học chính, kể cả cú "sai lầm chính sách".
     */
    o_lich: (st.map.trang_thai ?? [])
      .flatMap((t, i) => (t.o_lich ? [i + 1] : [])),
    xu_huong: (() => {
      // v53 (D373) — chuỗi tính tới Ô ĐÃ LẬT gần nhất. Tính cả ô còn úp là nói cho người chơi
      // biết pha của nó (chuỗi ×3 ở một ô chưa lật = ô ấy thuận chiều) — rò qua cửa sau.
      const t = st.map.trang_thai?.[vongDaLat(st) - 1];
      /*
       * v36 R4b (D168) — NGƯỠNG HIỆN PHẢI KHỚP NGƯỠNG MÁY.
       *
       * Máy rút cũ: chuỗi chỉ "xác nhận" từ 2 ô (QUAN_TINH.NGUONG_CHUOI) nên
       * hiện chuỗi ×1 là dạy sai luật quán tính. Máy TICK thì ngược: nền sống
       * NGAY khi mở (hazard/mặt-thuận áp từ ô đầu; nguồn LÌ còn hạ ngưỡng về
       * 1) ⇒ giấu chuỗi ×1 là màn hình nói "không có xu hướng" trong khi
       * engine đang chạy một xu hướng — và bảng điện tử TRẢ PHÍ (K4) thì lại
       * hiện nó, tức hai tầng thông tin nói ngược nhau về cùng một sự thật.
       * Thông tin vẫn CÔNG KHAI: suy từ chính các ô đã ngửa (8.2).
       */
      const nguong = st.regime_tick === true ? 1 : QUAN_TINH.NGUONG_CHUOI;
      return t && t.run_huong !== 0 && t.run_dai >= nguong
        ? { huong: t.run_huong, dai: t.run_dai } : null;
    })(),
    /*
     * v26 — LÃI SUẤT NỀN, CÔNG KHAI VÔ ĐIỀU KIỆN (founder 04/08).
     *
     * ⚠ Khác `suc_cang_dai` ngay dưới — cái kia phải MUA bằng một ô deck vì nó
     * là suy luận per-mã. Lãi suất là con số vĩ mô công khai nhất ngoài đời;
     * bán nó là bịa ra một thế giới không có bản tin nào.
     * ⚠ Gửi cả `moi_truong` để client KHỎI TỰ SUY từ ngưỡng: hai bản cài đặt
     * của cùng một phép so sẽ trôi, và cú trôi ở đây là màn hiện "tiền rẻ"
     * trong khi engine đang tính theo "trung tính".
     */
    ...(st.lai_suat_nen === true ? {
      lai_suat: {
        /*
         * v53 (D373) — MỨC NHÌN THẤY, không phải mức đang chạy giá. `laiSuatLuc` trả mức SAU
         * kỳ họp của CHÍNH vòng này; ở v53 kỳ họp ấy chưa lật, nên in nó ra là lộ kết quả họp
         * bằng một con số. `laiSuatThayDuoc` trùng `laiSuatLuc` ở mọi trận ≤ v52.
         */
        diem: laiSuatThayDuoc(st) ?? LAI_SUAT_NEN.KHOI_DIEM,
        moi_truong: moiTruongTienTe(laiSuatThayDuoc(st) ?? LAI_SUAT_NEN.KHOI_DIEM),
        nguong_thap: LAI_SUAT_NEN.NGUONG_THAP,
        nguong_cao: LAI_SUAT_NEN.NGUONG_CAO,
        /*
         * v45 (D318) — LỢI SUẤT DÀI. VẮNG MẶT khi cổng chưa lật: trận cũ không có
         * khái niệm này, và một trường luôn-có-mặt là chỗ golden đổi hash (bài học
         * D317 với `kvVong`).
         *
         * ⚠ PHẢI RA MÀN, không được để nó chỉ sống trong engine. Cả cơ chế chơi được
         * là ở chỗ người chơi THẤY hai con số đổi ngôi khi lãi lên cao — coupon trái
         * phiếu dài tụt dưới lãi gửi tiết kiệm. Giấu nó đi thì đường cong đảo ngược
         * vẫn xảy ra nhưng không ai đọc được, tức lại là một cơ chế trang trí.
         */
        ...(st.duong_cong === true
          ? { dai: laiSuatDaiBp(laiSuatThayDuoc(st) ?? LAI_SUAT_NEN.KHOI_DIEM) }
          : {}),
      },
    } : {}),
    chinh_sach: (() => {
      // v53 (D373) — cặp kỳ vọng/thực chỉ ra màn khi ô kỳ họp ĐÃ LẬT. Ở v53 ô của vòng còn úp,
      // nên đọc `[st.vong - 1]` là phát thẳng kết quả cuộc họp trước khi nó họp.
      const t = st.map.trang_thai?.[vongDaLat(st) - 1];
      // D422 — lá kỳ họp vừa lật đang bị MÙ TIN che ⇒ không phát kỳ vọng/thực của nó.
      if (lopChe(st).cheTin(vongDaLat(st) - 1, st.map.o[vongDaLat(st) - 1])) return null;
      return t?.o_lich
        ? { ky_vong: t.huong_cs_ky_vong!, thuc: t.huong_cs_thuc! } : null;
    })(),
    /*
     * BƯỚC 5 — BỘ ĐO SỨC CĂNG, đặc quyền Lướt Sóng (03 §5.5). Ba dải, không
     * số (Q2). Che Ở TẦNG API: ghế không cầm lá thì field VẮNG MẶT — F12
     * không moi ra được. Giá của thông tin = một ô deck (Lướt Sóng), đúng
     * ranh giới "bán thực thi, không bán suy luận — trừ khi giá là một ô deck".
     */
    // Bước 6 — BỐI CẢNH map công bố đầu trận cho MỌI NGƯỜI (8.2).
    chu_ky: st.map.chu_ky ?? null,
    ...(st.suc_cang === true && st.dac_quyen === true
      && nguoi.danh_muc.chien_thuat.includes('luot_song' as never)
      ? {
        suc_cang_dai: Object.fromEntries(
          TAI_SAN.map((t) => [t.id, daiSucCang(sucCangLuc(st, t.id))])),
      } : {}),
    shop: nguoi.da_chay ? null
      : locTheChet(bayShop(seed, st.vong, 'ban', 0, nguoi.danh_muc, tuyChonShop(st)), nguoi.danh_muc,
        mandateCua(st, nguoi)?.camKhong === true, { max: maxLoiCua(st, nguoi), coLuot: coLuotLoi(st, nguoi) }, mandateCua(st, nguoi)?.camDonBay === true),
  };
}

/**
 * Founder 02/08 — "chiến thuật pick xong rồi vẫn hiện": `bayShop` bày cả lá
 * mà `mua()` chắc chắn TỪ CHỐI (đã đủ MAX_BAN_SAO bản, hoặc ô chiến thuật đã
 * kín mà lá chưa cầm) — người chơi bấm vào một lá chết. Lọc Ở TẦNG TRÌNH BÀY,
 * tuyệt đối KHÔNG lọc trong `bayShop`: bot chọn lá theo NỘI DUNG list đó và
 * replay trận cũ dựng lại đúng list đó — đổi list gốc là đổi hành vi bot của
 * mọi trận đã lưu, vỡ im lặng. Lá trùng CHƯA đủ bản vẫn bày: trùng = nâng cấp
 * (D40 "săn chiến thuật", founder: "chọn 2 lần lướt sóng sẽ lên lv2").
 */
/** D498 — bot TỔ CHỨC khung minigame không margin: bỏ Đòn Bẩy khỏi quầy của nó. Khoá cũ (không `camDonBay`) ⇒ trả nguyên quầy (byte-hệt). */
function locDonBayBot<T extends { chien_thuat: readonly string[] }>(shop: T, md: { camDonBay?: true } | undefined): T {
  return md?.camDonBay ? { ...shop, chien_thuat: shop.chien_thuat.filter((id) => id !== 'don_bay') } : shop;
}

function locTheChet(
  shop: ReturnType<typeof bayShop>, dm: { chien_thuat: readonly string[] },
  /** v34 — tổ chức (mandate cấm khống) không được bày Bán Khống: lá mua rồi không dùng được là lá chết. */
  camKhong = false,
  /** D473 — trần lõi theo ghế + vòng này ghế có lượt lõi không (khung minigame). Vắng ⇒ hằng cũ, luôn có lượt. */
  loi: { max: number; coLuot: boolean } = { max: HOLDEM_MATCH.MAX_CHIEN_THUAT, coLuot: true },
  /** D498 — Tổ Chức khung minigame không margin: không bày Đòn Bẩy. */
  camDonBay = false,
): ReturnType<typeof bayShop> {
  const kinO = new Set(dm.chien_thuat).size >= loi.max;
  return {
    ...shop,
    chien_thuat: !loi.coLuot ? [] : shop.chien_thuat.filter((id) => {
      if (camKhong && id === 'ban_khong') return false;
      if (camDonBay && id === 'don_bay') return false;   // D498 — Tổ Chức không margin
      const soBan = dm.chien_thuat.filter((x) => x === id).length;
      return soBan < MAX_BAN_SAO && (soBan > 0 || !kinO);
    }),
  };
}

export function registerHoldemRoutes(
  app: Hono<Env>, pool: pg.Pool,
  mw: {
    requireAuth: Middleware; requireOnboarded: Middleware;
  },
  /** Suất trận (SPEC tran-tran-ngay): lưới trần ngày — `null` = tắt. `createApp` truyền `tranNgayHieuLuc(deps.tranNgaySuat)`. */
  suat: { tranNgaySuat: number | null } = { tranNgaySuat: tranNgayHieuLuc(undefined) },
): void {
  const guard = [mw.requireAuth, mw.requireOnboarded] as const;

  async function chanTanSuat(
    userId: string, kind: 'tao' | 'vong' | 'bang' | 'khop' | 'mg_nhip' | 'mg_lenh' | 'ban_xem', max: number,
  ) {
    const r = await consumeLimit(pool, `holdem:${kind}:${userId}`, max, 60);
    if (!r.allowed) {
      throw new HoldemError(409, 'rate_limited',
        `Bạn thao tác hơi nhanh. Thử lại sau ${Math.ceil(r.retryAfterSeconds / 60)} phút nhé.`);
    }
  }

  /**
   * Đọc trận. `db` cho phép chạy TRONG transaction (`/bang` cần), `khoa` bật
   * `FOR UPDATE` để hai cú bấm mở bảng cùng lúc không thu phí hai lần.
   */
  /**
   * D481 — KHÉP TRẬN SAU MÀN CUỐI. Gọi ở cửa đọc trạng thái / kết quả: trận khung minigame còn `dang_choi`, đã nộp vòng cuối, màn cuối đã hết
   * giờ (`manCho`) ⇒ chép kết quả màn vào `mg_sau` của dòng vòng cuối, lưu kết quả + xếp hạng trên trạng thái ĐÃ gồm màn, khép trận. Một
   * transaction, khoá dòng trận (hai tab cùng hỏi thì một bên thấy đã khép, không lưu hai lần). Không phải vòng cuối ⇒ không làm gì.
   */
  async function chotManCuoi(matchId: string, userId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const t = await layTran(matchId, userId, client, true);
      if (t.status !== 'dang_choi' || !t.manCho || t.luat.dongHoMinigame !== true) { await client.query('ROLLBACK'); return false; }
      const r = replay(t.seed, t.log, false, t.ghe ?? undefined, t.luat, t.moBangCho, t.duBaoCho, t.soO, t.khopCho, t.manCho);
      if (!daKetThuc(r.st)) { await client.query('ROLLBACK'); return false; }
      const iCuoi = t.logRaw.map((h) => laChoNop(h)).lastIndexOf(false);
      const logMoi = t.logRaw.map((h, i) => (i === iCuoi ? { ...h, mg_sau: r.mgCho ?? {} } : h));
      await client.query(
        `UPDATE holdem_matches SET action_log = $1, status = 'xong', ended_at = now(), vong_mo_luc = NULL WHERE match_id = $2`,
        [JSON.stringify(logMoi), t.matchId]);
      const r2 = replay(t.seed, logMoi.filter((h): h is HanhDongLog => !laChoNop(h)), false, t.ghe ?? undefined, t.luat, 0, false, t.soO);
      await luuKetQua(client, t.matchId, userId, r2.st, t.seed, r2.kyNgo.lan);
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  // D481 — tick dọn trận quá hạn khép trận chờ màn cuối bằng ĐÚNG hàm này (xem `KHEP_SAU_MAN_CUOI`).
  KHEP_SAU_MAN_CUOI.set(pool, chotManCuoi);

  async function layTran(
    matchId: string, userId: string,
    db: pg.Pool | pg.PoolClient = pool, khoa = false,
  ) {
    /*
     * MỘT CÂU TRẢ LỜI CHO CẢ HAI CÁCH "KHÔNG CÓ TRẬN NÀY". Hàm chứ không phải
     * hằng, cùng lý do `tranHetHan`: `Error` mang stack, dùng chung một thể
     * hiện cho mọi request là stack của người này hiện trong log người kia.
     */
    const khongThay = () => new HoldemError(404, 'not_found', 'Không thấy trận này.');
    /*
     * ID SAI HÌNH DẠNG = KHÔNG THẤY TRẬN, KHÔNG PHẢI LỖI MÁY CHỦ.
     *
     * `match_id` là cột `uuid`: đưa thẳng chuỗi rác vào `$1` thì Postgres ném
     * 22P02 chứ không trả 0 dòng ⇒ không ai bắt ⇒ `app.onError` trả 500, và từ
     * D93 mỗi cú 500 là một event Sentry. Chặn TRƯỚC khi chạm DB, trả đúng câu
     * của "không tìm thấy": người gõ nhầm id không cần biết ta lưu id kiểu gì.
     *
     * ⚠ Route này sau `requireAuth` (đo prod 16/08: không phiên ⇒ 401), nên
     * đây KHÔNG phải lỗ cho kẻ quét vô danh — xem `server/uuid.ts`. Nó là
     * chuyện của NGƯỜI ĐÃ ĐĂNG NHẬP mở một link cũ, và của một chuông báo cháy
     * kêu vì chuyện không phải sự cố.
     */
    if (!laUuid(matchId)) throw khongThay();
    const q = await db.query(
      `SELECT match_id, seed, status, action_log, vong_hien_tai, ghe_json,
              balance_version, vong_mo_luc, so_o, mien_gio, ban_ma
         FROM holdem_matches WHERE match_id = $1 AND owner_user_id = $2
         ${khoa ? 'FOR UPDATE' : ''}`,
      [matchId, userId]);
    if (q.rowCount === 0) throw khongThay();
    const row = q.rows[0]!;
    /*
     * TÁCH ĐUÔI CHỜ NỘP khỏi các dòng vòng. Mọi chỗ đếm vòng (`log.length + 1`)
     * phải nhìn thấy ĐÚNG số vòng đã nộp, nếu không thì vừa mở bảng xong là
     * người chơi bị báo "sai vòng" ở chính vòng mình đang đứng.
     */
    const raw = (row.action_log ?? []) as DongLog[];
    const log = raw.filter((h): h is HanhDongLog => !laChoNop(h));
    // Chỉ tính đuôi của ĐÚNG vòng hiện tại: dòng sót lại của vòng khác (không
    // sinh ra được ở đường nào, nhưng log là dữ liệu ngoài tầm kiểm soát) không
    // được âm thầm trừ Vốn của vòng này.
    const duoiVongNay = raw.filter(
      (h): h is MoBangCho => laChoNop(h) && h.vong === log.length + 1);
    const moBangCho = soLanMoBang(
      duoiVongNay.reduce((s, h) => s + soLanMoBang(h.mo_bang), 0));
    // KHỚP LỆNH GIỮA VÒNG — các nhóm đã khớp của vòng đang chơi, đúng thứ tự.
    const khopCho = duoiVongNay.flatMap((h) => h.khop ?? []);
    /** Khoá của những cú KHỚP NGAY đã áp ở vòng này — xem `MoBangCho.khop_keys`. */
    const khopKeys = duoiVongNay.flatMap((h) => h.khop_keys ?? []);
    // D33 — đã trả tiền cho hạng CÓ DỰ BÁO chưa. Chỉ cần MỘT đuôi khai true:
    // nâng hạng là một chiều, không có đường hạ lại để đòi hoàn 30.
    const duBaoCho = duoiVongNay.some((h) => h.du_bao === true);
    const luat = luatChoTran(row.balance_version as string | null, Number(row.seed));
    /*
     * D475 — MÀN CỦA VÒNG VỪA NỘP đã hết giờ chưa (giờ do server neo, D473). Hết ⇒ `manCho` (kết quả màn áp ở đuôi replay — người chơi đặt
     * lệnh vòng này trên NAV đã gồm màn); chưa ⇒ `manChuaXong` (cú nộp vòng này bị chặn: nộp giữa màn là bỏ phần màn còn lại). Chưa ai mở màn
     * thì giờ suy từ mốc mở vòng (cùng công thức cửa mở màn); trận miễn giờ chưa mở màn ⇒ coi như hết (không bấm ⇒ tự động).
     */
    let manCho: { vong: number; lenh: LenhMan[]; bc?: BoiCanhMan } | undefined;
    let manChuaXong = false;
    /** D533 — mốc (ms) màn vòng vừa nộp HẾT GIỜ, khi `manChuaXong` — trả kèm `cho_man` để web tự đồng bộ đúng lúc (không ai phải bấm). */
    let manKetThuc = 0;
    // D526 — vòng có màn: một nguồn `coManMinigame` (nhịp xen kẽ có màn ở vòng 1, bỏ màn ở vòng mở chợ trait).
    if (luat.dongHoMinigame === true && log.length >= 1 && row.status === 'dang_choi'
      && coManMinigame(log.length, Number(row.so_o ?? HOLDEM_DECISIONS.MAP_SIZE), luat.nhipXenKe === true)) {
      const mq = await db.query('SELECT boi_canh, bat_dau, lenh FROM holdem_minigame_man WHERE match_id = $1 AND vong = $2',
        [row.match_id, log.length]);
      const mr = mq.rows[0] as { boi_canh: BoiCanhMan; bat_dau: string | Date; lenh: LenhMan[] | null } | undefined;
      const moLuc = (row.vong_mo_luc ?? null) as Date | null;
      const ketThuc = mr ? new Date(mr.bat_dau).getTime() + DEM_MS + CHAY_MS
        : moLuc && !vongMienGio({ seed: Number(row.seed), mienGio: row.mien_gio === true }, log.length + 1)
          ? moLuc.getTime() + (DONG_HO_MINIGAME.LAT_THE_S + giayChonLa(luat.loiChonTruoc === true)) * 1000 + DEM_MS + CHAY_MS
          : 0;
      if (Date.now() >= ketThuc) manCho = { vong: log.length, lenh: mr?.lenh ?? [], ...(mr ? { bc: mr.boi_canh } : {}) };
      else { manChuaXong = true; manKetThuc = ketThuc; }
    }
    return {
      matchId: row.match_id as string,
      /** D475 — màn vòng vừa nộp đã hết giờ: truyền vào `replay(…, manCho)` ở mọi cửa dựng trạng thái vòng đang chơi. */
      manCho,
      /** D475 — màn vòng vừa nộp còn đang chạy ⇒ chưa nộp được vòng này. */
      manChuaXong,
      /** D533 — mốc (ms) màn đó hết giờ (0 khi không chờ màn). */
      manKetThuc,
      /** Số lần mở bảng đã TRẢ PHÍ ở vòng đang chơi mà chưa gộp vào dòng vòng. */
      moBangCho,
      /** Hạng đã trả của lần mở đang treo — xem `HanhDongLog.du_bao`. */
      duBaoCho,
      /** Nhóm lệnh đã KHỚP GIỮA VÒNG của vòng đang chơi (đúng thứ tự bấm). */
      khopCho,
      /** Khoá chống áp hai lần của các cú khớp đã ghi ở vòng này. */
      khopKeys,
      // BIGINT → pg trả BigInt. Không ép Number là nổ "Cannot mix BigInt"
      // ngay lúc replay — đúng lỗi đã dính ở GĐ3 prod.
      seed: Number(row.seed),
      status: row.status as string,
      /*
       * D38 — MỐC MỞ VÒNG HIỆN TẠI. Nguồn chân lý DUY NHẤT của mọi phép tính thời
       * gian trong trận (C4: client không bao giờ tự tính hạn).
       *
       * ⚠ NULL LÀ MỘT GIÁ TRỊ HỢP LỆ, KHÔNG PHẢI THIẾU DỮ LIỆU: trận tạo trước
       * migration 0018 không có mốc, và `soiDongHo`/`tranHetHan` cố ý trả "chưa hết
       * hạn" cho nó. Bịa một mốc ở đây (vd `?? new Date()`) là bịa ra chuyện trận cũ
       * vừa mở vòng — đúng loại kết luận sai mà `events` append-only không xoá lại
       * được (A3.3).
       */
      vongMoLuc: (row.vong_mo_luc ?? null) as Date | null,
      /**
       * 16/08 — TRẬN LÀM QUEN không chạy đồng hồ (hai trận đầu, không áp xếp
       * hạng). Cờ chốt lúc tạo; mọi cửa hỏi giờ đi qua `vongMienGio`. Trận
       * trước migration 0039 đọc ra false = có giờ như đã từng.
       */
      mienGio: row.mien_gio === true,
      /**
       * LOG THÔ Y NGUYÊN TRONG DB (kể cả đuôi `MoBangCho`) — chỉ dùng làm
       * ĐIỀU KIỆN COMPARE-AND-SET khi ghi lại (xem UPDATE ở `/rounds`).
       *
       * ⚠ KHÔNG dùng cái này để replay: `log` (đã lọc đuôi) mới là nguồn dựng
       * trận. Hai trường tồn tại song song vì chúng trả lời hai câu khác nhau:
       * "trận diễn ra thế nào" và "hàng trong DB có còn y như lúc tôi đọc không".
       */
      logRaw: raw,
      /**
       * D31/02-08 — cỡ map ĐÃ LƯU. NULL = trận trước migration 0023 / không
       * chọn → replay dùng MAP_SIZE mặc định (taoTran tự rơi về khi undefined).
       */
      soO: row.so_o === null || row.so_o === undefined ? undefined : Number(row.so_o),
      /** BÀN CHUNG (0040): mã bàn nếu trận thuộc một bàn mời bạn; null = trận đơn. */
      banMa: (row.ban_ma ?? null) as string | null,
      log,
      /*
       * D3 — SƠ ĐỒ GHẾ ĐÃ LƯU. Cột này được GHI từ ngày đầu nhưng CHƯA AI ĐỌC:
       * replay tự suy lại sơ đồ từ seed. Vô hại khi số ghế là hằng số, nhưng với
       * lobby biến thiên 4–8 thì suy lại = trận cũ (5 ghế) replay ra số ghế khác,
       * tức hỏng lịch sử vĩnh viễn. Đọc cột đã có cũng là lý do cụm này KHÔNG cần
       * migration nào.
       */
      ghe: (row.ghe_json ?? null) as GheMoi[] | null,
      /*
       * CỔNG PHIÊN BẢN — bộ luật của CHÍNH trận này, tra bằng BẢNG.
       *
       * ⚠ TUYỆT ĐỐI KHÔNG so `=== HOLDEM_BALANCE_VERSION` như bản trước. Phép so
       * đó đúng đúng một khoảnh khắc: khoảnh khắc chỉ tồn tại MỘT phiên bản. Ngay
       * lúc chuỗi được bump lên v6, mọi trận v5 đang lưu đọc ra `false` và bot của
       * chúng tụt về hành vi trước D30 — tức cổng dựng lên để giữ lịch sử lại tự
       * viết lại lịch sử, im lặng và không cách nào biết.
       * `luatCua` khai từng phiên bản riêng nên thêm bản mới không đụng bản cũ.
       */
      luat,
    };
  }

  /*
   * K5 (SPEC va-bao-mat-chuan-hoa-api-dot-1, Q4 = A) — `GET /api/v1/holdem/choi` (302 về `/arena`, di sản trang chơi thử gỡ 27/07)
   * ĐÃ XOÁ cùng `guardTrang`: không client nào gọi, link cũ nay 404 như mọi đường lạ. Trang server-render còn lại duy nhất là `/admin`.
   */

  // ── Artwork thẻ bài ─────────────────────────────────────────────────────
  // Tách khỏi /catalog: 252KB, đổi rất hiếm, nhưng /catalog thì gọi mỗi lần
  // vào bàn. Nhồi chung là bắt người chơi tải lại tranh mỗi ván.
  // `immutable` + version trong path-key: đổi art thì đổi engine_version,
  // trình duyệt tự lấy bản mới, không cần xoá cache tay.
  /*
   * ART THẺ — cache PHẢI REVALIDATE, không được `immutable`.
   *
   * ⚠ Bản trước đặt `public, max-age=86400, immutable`. `immutable` nghĩa là trình
   * duyệt KHÔNG kiểm lại trong 24 giờ — kể cả khi người chơi tải lại trang. Mà URL
   * này cố định, nên không có cách nào busted. Hậu quả: đổi art xong thì mọi người
   * chơi cũ giữ art cũ tới một ngày, và mình không biết vì máy mình cũng cache.
   *
   * Bắt được đúng như thế 26/07 khi pixel hoá: API đã trả 29 art pixel mà trình
   * duyệt vẫn vẽ 28 art vector cũ; chỉ khi gọi kèm `?t=` mới thấy bản mới. Cùng họ
   * với lỗi vỏ HTML bị biên Cloudflare giữ — luật cache đặt sai tầng thì mọi lần
   * deploy đều vô hình.
   *
   * Nay dùng ETag theo NỘI DUNG: trình duyệt hỏi lại mỗi lần nhưng nhận 304 rỗng
   * khi art không đổi (vài trăm byte), và tự lấy bản mới ngay khi đổi. Giữ được
   * gần hết lợi ích cache mà không mất tính đúng đắn.
   */
  const artJson = JSON.stringify({ version: HOLDEM_VERSION, art: ART });
  // Chữ ký nội dung: rẻ, tất định, đủ để phân biệt hai bộ art khác nhau.
  let artEtag = 0;
  for (let i = 0; i < artJson.length; i += 1) {
    artEtag = (artEtag * 31 + artJson.charCodeAt(i)) | 0;
  }
  const ART_ETAG = `W/"art-${(artEtag >>> 0).toString(36)}"`;

  app.get('/api/v1/holdem/art', ...guard, (c) => {
    c.header('Cache-Control', 'public, max-age=0, must-revalidate');
    c.header('ETag', ART_ETAG);
    if (c.req.header('if-none-match') === ART_ETAG) return c.body(null, 304);
    return c.json({ version: HOLDEM_VERSION, art: ART });
  });

  // ── Catalog ─────────────────────────────────────────────────────────────
  app.get('/api/v1/holdem/catalog', ...guard, (c) => c.json({
    engine_version: HOLDEM_VERSION,
    balance_version: HOLDEM_BALANCE_VERSION,
    /*
     * ⚠ PHÍ MỞ BẢNG ĐI KÈM CATALOG, không để client gõ lại số 25.
     *
     * Nút mở bảng phải NIÊM YẾT GIÁ TRƯỚC khi bấm — thu tiền mà không báo giá là
     * lừa — nhưng giá thật chỉ nằm trong payload của lần mở ĐÃ trả tiền, tức
     * vòng lặp không đóng được nếu catalog im lặng. Hằng số dự phòng phía client
     * (`PHI_BANG_DIEN_TU_MAC_DINH`) tồn tại đúng vì chỗ này từng thiếu; nó có
     * điều kiện gỡ là "catalog trả PHI_BANG_DIEN_TU", nên dòng này chính là ngày
     * chết của nó (A8.9: đường tắt tạm phải có ngày chết).
     */
    luat: {
      ...HOLDEM_MATCH,
      PHI_BANG_DIEN_TU: BANG_DIEN_TU.PHI_MO,
      // v10 — hai bước mốc phân bổ (thô mặc định · mịn = đặc quyền Chia Lệnh).
      // Client vẽ nấc từ đây, KHÔNG chép số (D33 nếp cũ: chép tay là màn niêm
      // yết một đằng engine trừ một nẻo).
      BUOC_MOC_BP: NAV_V10.BUOC_MOC_BP,
      BUOC_MOC_THO_BP: NAV_V10.BUOC_MOC_THO_BP,
      /*
       * D43 bước 2 — LỊCH CHÍNH SÁCH CÔNG KHAI TOÀN PHẦN (bất biến 8.2): vị
       * trí ô lịch + cửa sổ + ngưỡng + tỷ lệ sai lầm đều là LUẬT, người chơi
       * được đếm bài trên nó; chỉ realization (hướng thực từng kỳ họp) bị
       * giấu tới lúc lật. Có mặt ở catalog từ TRƯỚC khi v11 thành mặc định —
       * bách khoa dạy luật trước, luật ứng sau.
       */
      LICH_CHINH_SACH,
      // Bước 5 — ngưỡng ba dải sức căng: LUẬT công khai (8.2); giá trị S thì giấu.
      DAI_CANG_BP: SUC_CANG.DAI_CANG_BP,
      DAI_RAT_CANG_BP: SUC_CANG.DAI_RAT_CANG_BP,
    },
    // Nhịp chọn bài + hệ số stack đi kèm catalog để client KHÔNG tự chép lại
    // bảng luật. Một nguồn chân lý: server enforce, client chỉ hiển thị.
    /*
     * ⚠ NHỊP LẤY THEO CỠ MAP MẶC ĐỊNH — client PHẢI ưu tiên `nhip_chon_bai`
     * trong trạng thái trận (`trangThaiCongKhai`), thứ tính theo map THẬT. Từ
     * D34 nhịp co theo cỡ map, nên bảng ở catalog chỉ còn là mặc định cho lúc
     * chưa vào bàn. Giữ lại vì sảnh cần vẽ nhịp trước khi có trận.
     */
    nhip_chon_bai: nhipChonBai(HOLDEM_DECISIONS.MAP_SIZE),
    cap_stack_bp: CAP_STACK_BP,
    /*
     * D33 — BẢNG ĐẶC QUYỀN + BA HẠNG GIÁ BẢNG ĐIỆN TỬ.
     *
     * Cùng lý do với `PHI_BANG_DIEN_TU` / `dao_danh_muc` / `khoa_tai_san`: người
     * chơi phải thấy GIÁ và TÁC DỤNG trước khi bấm, mà client gõ tay mấy con số
     * này thì lần Monte Carlo sau (mọi số đều `MC-TUNE`) sẽ làm màn hình niêm
     * yết một đằng, engine trừ một nẻo.
     */
    dac_quyen: DAC_QUYEN,
    /*
     * v32 — BỐN NHIỆM VỤ KỲ NGỘ: tên · mô tả · icon · đặc quyền.
     *
     * Cùng lý do với `dac_quyen` ngay trên: câu chữ và tên icon ở MỘT chỗ
     * (config), client chỉ vẽ. Chép sang client là hai bản sẽ trôi (D61), và
     * cú trôi ở đây là màn chào một nhiệm vụ mà server chấm theo luật khác.
     * ⚠ Catalog trả CẢ BỐN; bộ được MỜI (3 trong 4) là chuyện của từng vòng và
     * nằm trong `trangThaiCongKhai` — server quyết, client không tự rút.
     */
    nhiem_vu_ky_ngo: NHIEM_VU_KY_NGO,
    gia_bang: {
      thuong: giaMoBang(false, false),
      luot_song: giaMoBang(true, false),
      luot_song_du_bao: giaMoBang(true, true),
    },
    /** D34 — ba vòng chọn thẻ chiến thuật ở cỡ map mặc định. */
    vong_chon_chien_thuat: vongChonChienThuat(HOLDEM_DECISIONS.MAP_SIZE),
    so_the_chien_thuat: SO_THE_CHIEN_THUAT,
    /*
     * BẢNG GIÁ HAI CẦN GẠT VỐN — cùng lý do với `PHI_BANG_DIEN_TU`.
     *
     * Trước khi bấm, người chơi phải thấy RÕ cái giá: đảo mất phí chuyển đổi rồi
     * còn phải xếp hàng khớp lệnh; khoá mà bẻ thì mất phạt CỘNG thu hồi thưởng
     * CỘNG bị giam vốn. Thu tiền mà không niêm yết giá trước là lừa — và nếu
     * client gõ tay mấy con số này thì lần Monte Carlo sau (mọi số đều `MC-TUNE`)
     * sẽ làm màn hình niêm yết một đằng, engine trừ một nẻo.
     */
    dao_danh_muc: DAO_DANH_MUC,
    khoa_tai_san: KHOA_TAI_SAN,
    /*
     * v43 — bảng ngân hàng. Client cần `GOC_TOI_THIEU` (câu cảnh báo "nâng mốc
     * lên") và `MOC` chỉ để hiểu hình dạng; LÃI thì KHÔNG lấy từ đây mà từ
     * `tiet_kiem_bao_gia` của trạng thái vòng — lãi neo lãi suất nền ĐANG công
     * bố, nên một hằng số ở catalog sẽ là con số của vòng nào đó không xác định.
     */
    tiet_kiem: TIET_KIEM,
    /*
     * D406 — số của cờ ngân hàng đổ vỡ (D405) cho Bách khoa, CHỈ khi bộ luật mặc định bật cờ: vắng ⇒ dòng đọc nó tự ẩn,
     * nên lật ngược mặc định thì Bách khoa thôi nói đổ vỡ mà không ai phải sửa chữ. Chỉ SỐ, không mang danh sách lá.
     */
    ...(luatCua(HOLDEM_BALANCE_VERSION).nganHangDoVo ? {
      ngan_hang_do_vo: {
        BAO_HIEM_TOI_DA: NGAN_HANG_DO_VO.BAO_HIEM_TOI_DA,
        MAT_BP: NGAN_HANG_DO_VO.MAT_BP,
        SO_LA_XAU_TRUOC: NGAN_HANG_DO_VO.SO_LA_XAU_TRUOC,
      },
    } : {}),
    /** v46 (D338) — mức lãi vay Đòn Bẩy cho bách khoa (neo lãi nền; lãi THẬT mỗi ô ở `lai_vay_cua_ban`). */
    ...(luatCua(HOLDEM_BALANCE_VERSION).laiVayDonBay ? { lai_vay_don_bay: LAI_VAY_DON_BAY } : {}),
    /*
     * D406 — v54 `chiBan16`: server luôn dựng bàn 16 ô (`CO_BAN_DUY_NHAT`), nên sảnh chỉ được mời ĐÚNG cỡ ấy — mời
     * 8/12 mà server lặng lẽ dựng 16 là hứa một thứ không giao (D61). Bàn tập/đề buổi đo dựng cỡ riêng ở server.
     */
    // D526 — mọi cỡ ghim (`coBanGhim`), không riêng `chiBan16`.
    quyet_dinh: ((co) => (co !== null ? { ...HOLDEM_DECISIONS, CO_MAP_CHON: [co], MAP_MAC_DINH_SANH: co } : HOLDEM_DECISIONS))(
      coBanGhim(luatCua(HOLDEM_BALANCE_VERSION))),
    /** v34 — bảng vai: tên · đặc quyền · cái giá · hệ số. Client đọc, không chép (D61).
     *  v54 (D389) — số + lõi ghim theo khoá MẶC ĐỊNH (vốn đều · lõi gọn), xem `vaiTheoLuat`. */
    vai: vaiTheoLuat(luatCua(HOLDEM_BALANCE_VERSION)),
    mandate_to_chuc: MANDATE_TO_CHUC,
    /*
     * v52 (D371) — BỘ SỐ MỖI VÒNG của lá Đa Dạng Hoá, lấy qua ĐÚNG cửa engine (`daDangCua`)
     * chứ không gõ hằng: Bách khoa là mặt đọc thứ HAI của cùng cơ chế mà tờ (!) đã khai, và
     * hai mặt đọc lệch nhau là đúng thứ D61 cấm. Vắng ⇒ dòng bách khoa đọc nó TỰ ẨN.
     */
    da_dang_moi_vong: daDangCua(
      { da_dang_v52: luatCua(HOLDEM_BALANCE_VERSION).daDangV52 }),
    tai_san: TAI_SAN,
    chien_thuat: CHIEN_THUAT,
    giai_doan: GIAI_DOAN,
    su_kien: SU_KIEN.map((s) => ({ id: s.id, label: s.label, icon: s.icon })),
    /*
     * TỰ ĐIỂN — nội dung cho nút (!) trên mỗi lá bài (§16).
     *
     * Trước bản này ma trận tương tác không có đường nào ra client, nên "chú
     * thích" trên thẻ chỉ là một dòng mô tả chung: người chơi cầm lá Bán Khống
     * mà không hề biết nó ăn tin gì và chết vì tin gì.
     *
     * Chỉ SỐ và ID — câu tiếng Việt dựng ở client, vì lint từ vựng D26 phủ
     * `web/src` chứ không phủ `server/holdem/`. Xem docstring tu_dien.ts.
     */
    tu_dien: dungTuDien(TAI_SAN, CHIEN_THUAT.map((x) => x.id),
      luatCua(HOLDEM_BALANCE_VERSION).xungDotGon ? XUNG_DOT_V19 : XUNG_DOT,
      luatCua(HOLDEM_BALANCE_VERSION).congHuongGon ? CONG_HUONG_V20 : CONG_HUONG,
      // v41/v42 (D307/D311) — BỘ MA TRẬN, cùng lý do với hai cờ ngay trên:
      // catalog không gắn một trận cụ thể nên đọc bộ luật MẶC ĐỊNH hiện hành.
      boMaTranCua({
        lop_vn: luatCua(HOLDEM_BALANCE_VERSION).lopVn,
        tai_san_v42: luatCua(HOLDEM_BALANCE_VERSION).taiSanV42,
      }),
      // v42 (D311) — hai CƠ CHẾ (khác bảng số ở trên): tờ (!) chỉ hứa coupon và chỉ
      // báo "sàn cấm khống" khi bộ luật mặc định thật sự bật hai cổng ấy.
      luatCua(HOLDEM_BALANCE_VERSION).couponTpcp,
      luatCua(HOLDEM_BALANCE_VERSION).khongTheoMa,
      // v46 (D338) — tờ Đòn Bẩy nói luật nhân từng mã + lãi vay chỉ khi bộ luật mặc định bật.
      luatCua(HOLDEM_BALANCE_VERSION).donBayTheoMa,
      luatCua(HOLDEM_BALANCE_VERSION).laiVayDonBay,
      // v49 (D342) — tờ lá Bán Khống thôi hứa hiệu ứng tin khi bộ luật mặc định gỡ nó.
      luatCua(HOLDEM_BALANCE_VERSION).banKhongThuanQuyen,
      // v50 (D345) — tờ Khớp Nhanh nói phần phí lệnh còn lại khi bộ luật mặc định bật.
      luatCua(HOLDEM_BALANCE_VERSION).phiLenhNhe,
      // v52 (D371) — tờ Đa Dạng Hoá khai bộ số MỖI VÒNG của bộ luật mặc định.
      luatCua(HOLDEM_BALANCE_VERSION).daDangV52,
      // D530 — v60: lõi chỉ tác động trong màn ⇒ tờ (!) thôi kể canh nhịp · ×2 · tin · cặp · đặc quyền.
      luatCua(HOLDEM_BALANCE_VERSION).loiChiTrongMan === true),
    // D6 — danh sách khẩu vị + hệ số, để sảnh vẽ mà không chép lại bảng luật.
    khau_vi: KHAU_VI,
    /*
     * D406 — v54 `khauViTat`: mọi ghế chơi `KHAU_VI_MAC_DINH` ⇒ sảnh ẩn khối chọn (không bày nút vô tác dụng).
     * Cờ RIÊNG chứ không rút rỗng `khau_vi`: Bách khoa và các trận cũ vẫn đọc bảng hệ số ấy (D61 — một nguồn).
     */
    ...(luatCua(HOLDEM_BALANCE_VERSION).khauViTat ? { khau_vi_tat: true as const } : {}),
    /*
     * D334 — BÁCH KHOA: hạng ồn hiệu dụng của sáu mã + luật của từng mặt tin (tính chất · báo
     * trước · hay kéo theo · độ hay bị làm giả). Chỉ ID + MỨC; mức phản ứng từng mã vẫn ở
     * `tu_dien` phía trên — một nguồn. Xem server/holdem/bach_khoa.ts.
     */
    bach_khoa: dungBachKhoa(HOLDEM_BALANCE_VERSION),
  }));

  // ── Tạo trận ────────────────────────────────────────────────────────────
  app.post('/api/v1/holdem/matches', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      await chanTanSuat(userId, 'tao', GIOI_HAN.TAO_MOI_GIO);
      const body0 = await c.req.json().catch(() => ({})) as { khau_vi?: string };
      /*
       * TESTER MODE (0052) — `eTester` đọc MỘT LẦN, dùng cho mọi nhánh `ep_*`
       * dưới đây. `coEpThamSo` gom lại: bật `true` ở bất kỳ chỗ nào một tham số
       * ép tay THỰC SỰ có hiệu lực (không phải chỉ vì actor là tester) — cờ này
       * ghi xuống `holdem_matches.co_ep_tham_so` CÙNG câu INSERT tạo trận, để
       * phân tích sản phẩm loại được trận này ĐỘC LẬP với việc chủ tài khoản
       * còn là tester hay không sau này (xem migrations/0052).
       */
      const eTester = laTester(actor);
      let coEpThamSo = false;
      /*
       * MÀN TẬP (founder 02/08 — "thiết kế riêng 1 màn chơi cố định để dạy
       * họ"): body `{tap: true}` ⇒ seed GHIM một hằng số + bàn 8 ô. Cùng một
       * bàn cho mọi người chơi mới nên lời coach ở client nói đúng thứ đang
       * diễn ra. Chỉ ghim được ĐÚNG hằng số này — không nhận seed tuỳ ý từ
       * client (ghim seed tự do = farm bàn đã biết trước). Trận tập là trận
       * `tu_do` bình thường về mọi mặt còn lại: không điểm mùa, events vẫn ghi.
       */
      const laTap = (body0 as { tap?: unknown }).tap === true;
      /*
       * BÀN CHUNG THEO SEED (16/08, migration 0040, đề xuất `moi-ban-vao-doi.md` A):
       * body `{ban_ma}` ⇒ seed + cỡ map lấy từ bàn (server đã phát), KHÔNG từ
       * client; một tài khoản một trận mỗi bàn (UNIQUE ở DB — chơi lần hai cùng
       * seed là biết trước ô); bàn hết hạn thì đóng. Mọi mặt khác y trận tự do:
       * bot như nhau, giá không ảnh hưởng nhau — "cùng đề" theo khuôn Wordle.
       */
      const banMaRaw = (body0 as { ban_ma?: unknown }).ban_ma;
      let ban: {
        ma: string; seed: number; so_o: number; loai: 'doi' | 'ngay' | 'buoi_do';
        balance_version: string | null; de_id: string | null;
      } | null = null;
      if (typeof banMaRaw === 'string' && banMaRaw !== '') {
        const ma = banMaRaw.trim().toLowerCase();
        if (!/^[a-z0-9]{5}$/.test(ma)) {
          throw new HoldemError(404, 'ban_khong_co', 'Không có bàn này.');
        }
        const rb = await pool.query(
          `SELECT ma, seed, so_o, het_han, loai, balance_version, de_id FROM holdem_ban WHERE ma = $1`, [ma]);
        const row = rb.rows[0] as {
          ma: string; seed: string | number; so_o: number; het_han: Date; loai: 'doi' | 'ngay' | 'buoi_do';
          balance_version: string | null; de_id: string | null;
        } | undefined;
        if (!row) throw new HoldemError(404, 'ban_khong_co', 'Không có bàn này.');
        if (new Date(row.het_han).getTime() < Date.now()) {
          throw new HoldemError(409, 'ban_het_han', row.loai === 'ngay'
            ? 'Bàn hôm đó đã đóng — hôm nay có bàn mới.'
            : row.loai === 'buoi_do'
              ? 'Buổi đo này đã đóng — hỏi người điều phối nếu bạn cần vào.'
              : 'Bàn này đã đóng (quá 24 giờ).');
        }
        const cu = await pool.query(
          `SELECT match_id FROM holdem_matches WHERE ban_ma = $1 AND owner_user_id = $2`,
          [ma, userId]);
        if (cu.rows[0]) {
          return c.json({
            error: 'da_vao_ban',
            message: 'Bạn đã có trận ở bàn này — vào tiếp trận đó.',
            match_id: cu.rows[0].match_id,
          }, 409);
        }
        /*
         * D329 — BÀN BUỔI ĐO: hai cổng, SAU cổng "đã có trận" (người đã đồng ý rồi rút lại vẫn
         * chơi tiếp được trận đang dở — rút lại chỉ đưa số của họ ra khỏi bức tranh nhóm).
         * ⚠ Khách không vào: buổi đo có đo lại, mà khách không có danh tính để đo lại (tệp 10 §9 câu 4).
         * ⚠ Đồng ý phải là bản ĐANG hiệu lực — vết là của (người, bàn), đọc từ `events`.
         */
        if (row.loai === 'buoi_do') {
          if (actor.laKhach) {
            throw new HoldemError(403, 'khach_khong_vao_buoi_do',
              'Buổi đo cần một tài khoản — tạo tài khoản rồi mở lại link này nhé.');
          }
          if (!(await trangThaiDongYBuoiDo(pool, userId, ma)).hien_hanh) {
            throw new HoldemError(403, 'chua_dong_y_buoi_do',
              'Bàn buổi đo cần bạn đọc và đồng ý trước khi vào.');
          }
          /*
           * D370 — CỬA MỘT CHIỀU THỨ NHẤT: chưa nộp PHIẾU 1 thì chưa được vào trận.
           *
           * ⚠⚠ ĐÂY LÀ PHÉP ĐO, KHÔNG PHẢI THỦ TỤC. Phiếu 1 hỏi họ ĐOÁN tháng trước tiêu bao nhiêu.
           *   Mở app trước thì họ không còn đoán nữa — và `hv_doan_lech`, phép đo mạnh nhất cả buổi,
           *   mất sạch nghĩa. Trong phòng học, thứ canh điều này là giọng người điều phối; không có
           *   phòng (founder 21/09) nên nó phải là một câu `if` ở server.
           * ⚠ CHẶN Ở SERVER, không chỉ ẩn nút ở client (C4): ẩn nút là lời khuyên, đây là cửa.
           */
          const { rows: bd } = await pool.query(
            `SELECT buoi_do_buoc FROM users WHERE user_id = $1`, [userId]);
          if (Number(bd[0]?.buoi_do_buoc ?? 0) < 1) {
            throw new HoldemError(409, 'chua_nop_phieu_1',
              'Làm PHIẾU 1 trước đã — nó hỏi bạn ĐOÁN, nên phải trả lời khi chưa mở app.');
          }
          /*
           * D370 lượt 5 — CỬA BÀN TẬP (founder 21/09: *"phải cho là 1 trận hướng dẫn, tiếp theo để
           * họ tự chọn và chơi 1 trận ko có hướng dẫn"*).
           *
           * ⚠ Không phải phép lịch sự. Trận của bàn buổi đo là thứ mọi số đo đọc ra; người chưa từng
           *   thấy cơ chế nào mà vào thẳng thì số của họ đo sự bỡ ngỡ, không đo hành vi tài chính.
           *   Bàn tập dạy phí · tin giả · khoá sổ — đúng những thứ PHIẾU 2 hỏi lại.
           * ⚠ Đếm trận tập ĐÃ XONG, không phải đã tạo: mở rồi bỏ giữa chừng thì chưa học gì.
           */
          const { rows: tap } = await pool.query(
            `SELECT 1 FROM holdem_matches
              WHERE owner_user_id = $1 AND status = 'xong' AND seed = ANY($2::bigint[]) LIMIT 1`,
            [userId, SEED_MAN_TAP_MOI_THOI]);
          if (tap.length === 0) {
            throw new HoldemError(409, 'chua_xong_ban_tap',
              'Chơi BÀN TẬP một lượt trước đã — nó dạy phí, tin giả và khoá sổ, đúng những thứ trận thật sẽ hỏi.');
          }
        }
        ban = {
          ma: row.ma, seed: Number(row.seed), so_o: Number(row.so_o), loai: row.loai,
          balance_version: row.balance_version ?? null, de_id: row.de_id ?? null,
        };
      }
      /*
       * ÉP SEED — CHỈ tester, CHỈ trận tự do (màn tập/bàn chung có seed CHỐT
       * theo cơ chế riêng của chúng — ép đè lên đó là phá đúng thứ hai cơ chế
       * kia đảm bảo: seed tập trùng CoachTap, seed bàn giống nhau giữa các
       * ghế mời). Ép sai hình dạng bị chặn Ở CỬA — không âm thầm rơi về ngẫu
       * nhiên, vì "im lặng bỏ qua tham số ép" đúng là lỗi mà tester khó phát
       * hiện nhất (họ sẽ tưởng seed đã ép, rồi đọc lệch mọi thứ suy ra từ nó).
       */
      let epSeed: number | undefined;
      if (eTester && !laTap && !ban) {
        const raw = (body0 as { ep_seed?: unknown } | undefined)?.ep_seed;
        if (raw !== undefined) {
          if (!(Number.isInteger(raw) && (raw as number) >= 0 && (raw as number) <= 0xffffffff)) {
            throw new HoldemError(400, 'ep_seed_khong_hop_le',
              'ep_seed phải là số nguyên trong khoảng 0..4294967295.');
          }
          epSeed = raw as number;
          coEpThamSo = true;
        }
      }
      const seed = laTap
        // D168 — seed bàn tập theo PHIÊN BẢN LUẬT: v36 đổi luật sinh nên bàn
        // cũ thôi kể đúng kịch bản CoachTap (xem `MAN_TAP_SEED_V36`).
        // D392 — theo luật GHIM của bàn tập (một nguồn: `HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION`), xem `phienBan` dưới.
        // D527 — bàn tập ép khoá (vitest · tester, cùng cửa `ep_balance` bên dưới) thì seed theo CHÍNH khoá ép: bàn tập v54
        // (12 ô, kịch bản `KICH_BAN` cũ) còn dựng lại được để canh, trong khi bàn tập mặc định đã sang v58 6 ô.
        ? seedManTap(((x) => ((process.env.VITEST || eTester) && typeof x === 'string' && x in BO_LUAT_THEO_PHIEN_BAN
          ? x : HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION))((body0 as { ep_balance?: unknown } | undefined)?.ep_balance))
        : ban ? ban.seed
          : epSeed !== undefined ? epSeed
            : Math.floor(Math.random() * 0xffffffff) >>> 0;
    /*
     * D6 — KHẨU VỊ RỦI RO chọn ở SẢNH, chốt lúc tạo trận, không đổi giữa chừng.
     * Giá trị lạ ⇒ về mặc định (`khauViCua`), không ném lỗi: đây là tuỳ chọn trải
     * nghiệm, không phải thứ đáng chặn người chơi vào trận.
     */
    /*
     * BÀN NGÀY (17/08, D85 §5.2): khẩu vị GHIM cho mọi người — phân vị so NAV
     * mà hệ số PnL khác nhau thì bảng hết công bằng; xem `THU_THACH_NGAY`.
     * Server quyết, không tin client gửi gì.
     */
    /*
     * 28/07 — MỞ KHOÁ XẾP HẠNG MÙA BETA (founder). Chỉ hai chế độ được tạo từ
     * client: tự do và rank_pve. `rank_slot`/`rank_bu` (PvP thật) vẫn đóng —
     * chúng thuộc lớp ghép trận chưa xây, cho client tự xưng là mở đường farm.
     */
    // Bàn chung = đấu TỰ DO (D31: rank đòi toàn người thật; và trong bàn thì
    // seed công khai giữa bạn bè — công bằng cho đội, không công bằng cho hạng).
    const cheDoTao = !ban && (body0 as { che_do?: unknown } | undefined)?.che_do === 'rank_pve'
      ? 'rank_pve' : 'tu_do';
    /*
     * ── CỔNG ĐIỀU KHOẢN ĐỨNG Ở CHỖ CÓ NGƯỜI KHÁC (founder chốt 03/08) ──────
     *
     * Chơi TỰ DO thì không cần đồng ý gì — bạn với mấy con bot, không ai thấy
     * bạn. Nhưng XẾP HẠNG là lúc bạn bước vào một bảng chung: tên hiển thị của
     * bạn đứng cạnh tên người lạ, điểm của bạn đẩy hạng người khác xuống. Lúc
     * đó mới cần một thoả thuận chung, và lúc đó mới công bằng khi đòi nó.
     *
     * ⚠ Bản đầu (cùng ngày) chặn MỌI trận, kể cả chơi một mình. Founder sửa —
     * và sửa đúng: ép đồng ý để được chơi thì "đồng ý" không còn là đồng ý,
     * nó là phí vào cửa trả bằng dữ liệu. Ranh giới đúng không phải "chơi hay
     * không chơi" mà là "một mình hay có người khác".
     */
    /*
     * GHÉP BÀN XẾP HẠNG (SPEC alpha-draft-tang-khong-gian mục 6, 11/10) — khi cờ BẬT, xếp hạng KHÔNG còn là bàn 1 người + máy: bấm XẾP HẠNG
     * phải đi qua suất đấu (`/holdem/rank/suat`) và chỉ mở khi có ≥ 4 người thật. Cờ TẮT (mặc định) ⇒ `rank_pve` giữ nguyên như beta.
     */
    if (cheDoTao === 'rank_pve' && ghepBanBat()) {
      return c.json({ error: 'xep_hang_can_ghep_ban', message: THONG_BAO_CAN_NGUOI }, 409);
    }
    if (cheDoTao === 'rank_pve') {
      /*
       * ⚠ KHOÁ RANK CHO KHÁCH — TẦNG MỘT (founder chốt 04/08).
       *
       * Chặn ở CỬA VÀO chứ không chỉ ở chỗ trả điểm: cho người ta chơi trọn một
       * trận xếp hạng rồi mới nói "trận này không tính" là đúng cái "chế độ tự
       * phủ nhận" mà bản rà MVP đã liệt là món chặn beta. Ở đây họ biết trước.
       *
       * Tầng hai nằm ở `server/rank.ts` (không ghi điểm cho ghế khách) — hai
       * tầng vì tầng này là lời hứa với người dùng, còn tầng kia là bất biến của
       * thang xếp hạng, và hai thứ đó hỏng theo hai cách khác nhau.
       */
      if (actor.laKhach) {
        return c.json({
          error: 'khach_khong_xep_hang',
          message: 'Chế độ khách chơi tự do thoải mái, nhưng chưa lên bảng xếp hạng được. '
            + 'Tạo tài khoản là giữ được thành tích.',
        }, 403);
      }
      // 0079 — đồng ý có hiệu lực (bật + đúng bản văn hiện hành), một nguồn `server/nghien_cuu.ts`.
      if (!(await docNghienCuuHieuLuc(pool, userId))) {
        return c.json({
          error: 'chua_dong_y',
          message: 'Xếp hạng cần đồng ý điều khoản (tên bạn sẽ đứng trên bảng chung). '
            + 'Chơi tự do thì không cần. Bật ở Hồ sơ → DỮ LIỆU CỦA TÔI.',
        }, 403);
      }
    }
    /*
     * A8.9 — ĐƯỜNG TẠM: ép `balance_version` qua body dưới vitest HOẶC tester
     * (0052 nới `process.env.VITEST` thành `VITEST || eTester` — CÙNG một
     * đường, không dựng bản sao song song, xem lý lẽ đầy đủ ở D-số nhật ký).
     * KHÔNG phải cửa cho client thường: ngoài hai nhánh trên bị lờ hẳn.
     * 28/07 — mặc định ĐÃ lật sang v10b; nhánh vitest nay phục vụ chiều NGƯỢC:
     * bộ test DI SẢN ghim v10a để canh luật mà trận cũ đã lưu vẫn replay bằng.
     * ĐIỀU KIỆN GỠ MỚI: khi prod không còn trận ≤ v10a cần replay (reset mùa).
     */
    const epBalanceRaw = (body0 as { ep_balance?: unknown } | undefined)?.ep_balance;
    const choPhepEpBalance = process.env.VITEST || eTester;
    /*
     * D392 → gộp 0.0.46 — BÀN TẬP CHẠY LUẬT GHIM CỦA NÓ, một nguồn `HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION` (seed ở trên
     * đọc cùng hằng). Prod D389/D406 từng đi `khoaBanTap(mặc định)` — lưới an toàn khi mặc định mang bánh xe; hằng ghim là
     * quyết định founder (24/09 v52 → 27/09 v54, D433) và seed đi theo cờ `banhXe` của chính luật ấy (`seedManTap`) nên lưới
     * ấy không cần ở đây. `ep_balance` (vitest · tester) vẫn đè.
     */
    let phienBan: string = laTap ? HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION : HOLDEM_BALANCE_VERSION;
    if (choPhepEpBalance && typeof epBalanceRaw === 'string') {
      if (!/^balance-[a-z0-9-]{1,40}$/.test(epBalanceRaw)) {
        throw new HoldemError(400, 'ep_balance_khong_hop_le', 'ep_balance sai định dạng.');
      }
      /*
       * ⚠⚠ KHOÁ PHẢI ĐANG SỐNG (D217) — CHẶN Ở CỬA, không để lọt tới
       * `luatCua()`. Một khoá không nằm trong `BO_LUAT_THEO_PHIEN_BAN` khiến
       * `luatCua()` chỉ `console.warn` MỘT LẦN (`canhBaoKhoaLa`) rồi lặng lẽ
       * trả bộ cờ TẮT HẾT — nghĩa là một `ep_balance` gõ sai một ký tự sẽ tạo
       * ra một trận "luật ma" mà không một lỗi 4xx nào báo cho tester biết,
       * và mọi con số họ đo trên trận đó là hư cấu (xem
       * `config/giai_doan.ts` — đúng định nghĩa `khong_dung_lai_duoc`). Áp
       * đều cho cả hai nhánh (vitest lẫn tester): mọi khoá test hiện có trong
       * repo (v10a/v10b/v11/v17/v18/v31/v32…) đều là khoá CÒN SỐNG nên siết
       * này không đổi một bài test cũ nào.
       */
      if (!(epBalanceRaw in BO_LUAT_THEO_PHIEN_BAN)) {
        throw new HoldemError(400, 'ep_balance_khong_hop_le',
          `"${epBalanceRaw}" không phải balance_version đang sống `
          + '(xem BO_LUAT_THEO_PHIEN_BAN, config/holdem_balance.ts).');
      }
      phienBan = epBalanceRaw;
      if (eTester) coEpThamSo = true;
    }
    /*
     * D329 — ⚠⚠ BÀN BUỔI ĐO GHIM LUẬT CỦA ĐỀ, và đứng SAU `ep_balance` để không gì đè được nó. Buổi 1
     * và buổi đo lại phải cùng một đề; lấy `HOLDEM_BALANCE_VERSION` hiện hành ở đây là để một cú lật
     * cổng luật giữa hai buổi âm thầm đổi đề dưới chân người đang được đo.
     */
    if (ban?.loai === 'buoi_do' && ban.balance_version) phienBan = ban.balance_version;
    /*
     * v54 (D389) — KHOÁ LUẬT PHẢI BIẾT TRƯỚC KHI DỰNG GHẾ: cỡ bàn (`chiBan16`) quyết có bốc vai
     * không, khẩu vị (`khauViTat`) nằm trong sơ đồ ghế. Nên khối chọn `phienBan` đứng ở đây, trước
     * cả hai — dời lên, không chép lại (A11.5).
     */
    const luatTao = luatCua(phienBan);
    /*
     * D31 + founder 02/08 — CHỌN CỠ MAP CHỦ ĐỘNG (8/12/16). Giá trị lạ ⇒ về
     * mặc định như `khau_vi`, không chặn vào trận. LƯU VÀO DB rồi mọi replay
     * đọc lại từ cột `so_o` — cỡ map là một nửa danh tính map (seed là nửa
     * kia), suy lại từ đâu khác là trận dựng lại sai im lặng.
     */
    const soORaw = Number((body0 as { so_o?: unknown } | undefined)?.so_o);
    // Màn tập GHIM cỡ bàn (D300: 12 ô — bàn 8 không có vai lẫn kỳ ngộ nên không
    // dạy được chúng); CoachTap viết cho đúng bàn này.
    const soO = laTap ? soOManTap(luatTao)
      : ban ? ban.so_o
        // Cỡ ghim của luật (`coBanGhim`): v58 nhịp xen kẽ 8 (D526) · v57 minigame 12 (D457, 11 vòng vì `o_up`) · v54 16 (D389).
        // Client gửi gì cũng ra cỡ ghim; bàn tập/bàn chung giữ cỡ riêng.
        : coBanGhim(luatTao) ?? ((HOLDEM_DECISIONS.CO_MAP_CHON as readonly number[]).includes(soORaw)
          ? soORaw : undefined);
    /*
     * MỞ KHOÁ (D86, 17/08; D307 rút còn MỘT khoá là khẩu vị) — CHỈ áp cho thứ
     * người chơi TỰ CHỌN. Bàn chung/bàn ngày miễn: ở đó khẩu vị bị ghim (xem
     * `MO_KHOA`). Màn tập cũng miễn — nó là bàn ghim, chặn cửa dạy là vô nghĩa.
     * Đếm MỘT LẦN, dùng cho cả hai phép kiểm (pool max:1 — D65).
     */
    const soTranXong = (ban || laTap) ? 0 : await demTranXong(pool, uid(actor));
    const moKhoa = moKhoaTheoTran(soTranXong);
    /*
     * TESTER MODE (0052) — bỏ qua cổng "chưa chơi đủ trận" của CHÍNH map/khẩu
     * vị này. Đây là quyền "ép so_o" mà founder duyệt: không dựng một tham số
     * `ep_so_o` song song — `so_o` đã là trường công khai của mọi người chơi
     * (chỉ khác ở chỗ tester được BỎ QUA cổng mở khoá phía dưới), đúng tinh
     * thần A11.5 "một nguồn, không bản sao".
     */
    // D307 — cổng `chua_mo_co_map` ĐÃ GỠ: không cỡ bàn nào còn bị khoá, nên nhánh
    // chặn (và nhánh tester đi vòng qua nó) không còn gì để chặn. `soO` vẫn phải
    // nằm trong `CO_MAP_CHON` — phép kiểm đó ở ngay trên, không đụng tới.
    /*
     * KHẨU VỊ chưa mở ⇒ VỀ `can_bang`, KHÔNG chặn vào trận. Chặn là chặn nhầm
     * chỗ: người ta muốn CHƠI, cái chưa mở chỉ là một hệ số. Sảnh không bày nút
     * nên đường thường không bao giờ chạm nhánh này; nó tồn tại cho curl và cho
     * client cũ trong cache. Cùng tinh thần "giá trị lạ ⇒ mặc định" của D6.
     *
     * TESTER MODE: `eTester` cũng mở khẩu vị sớm — cùng cổng `moKhoa`, cùng lý
     * lẽ với `so_o` ngay trên (một cổng, không phải hai).
     */
    // D329 — bàn buổi đo ghim khẩu vị mặc định: hệ số PnL khác nhau giữa người trong CÙNG một buổi
    // là đo mỗi người một đề, và bức tranh nhóm trộn chúng lại thì không còn nghĩa.
    const khauVi = ban?.loai === 'buoi_do'
      ? KHAU_VI_MAC_DINH
      : ban?.loai === 'ngay'
      ? HOLDEM_DECISIONS.THU_THACH_NGAY.KHAU_VI
      // v54 (D389) — KHẨU VỊ TẮT: server không tin client gửi gì, mọi ghế về mặc định.
      : luatTao.khauViTat
      ? KHAU_VI_MAC_DINH
      : (!ban && !laTap && !moKhoa.khau_vi && !eTester)
        ? 'can_bang'
        : khauViCua(body0?.khau_vi).id;
    if (!ban && !laTap && !luatTao.khauViTat && !moKhoa.khau_vi && eTester
      && khauViCua(body0?.khau_vi).id !== 'can_bang') {
      coEpThamSo = true;
    }
    /*
     * BẬC THẬT, đọc một lần lúc tạo trận rồi CHỐT vào `ghe_json`. Đây là đầu vào
     * của p() khi tính điểm chuyển nhượng (config/rank.ts), nên nó phải là bậc
     * lúc VÀO BÀN — đọc lại lúc kết trận thì người vừa lên bậc giữa trận sẽ được
     * tính bằng bậc mới, và hai ghế cùng bàn đọc hai thời điểm khác nhau là vỡ
     * đối xứng của cặp.
     */
    /*
     * ÉP SỐ GHẾ — CHỈ tester, CHỈ trận tự do. Kẹp vào ĐÚNG khoảng
     * `soGheTuSeed` vốn đã dùng (SO_GHE_MIN..SO_GHE_MAX) — không mở một
     * khoảng RỘNG HƠN cho tester, vì engine (bốc thăm vai, phân bổ bot…)
     * chưa từng được đo ngoài khoảng này; nới khoảng là đổi một tham số kinh
     * tế/engine ngầm, thứ A8.2 cấm agent tự quyết.
     */
    let epSoGhe: number | undefined;
    if (eTester && !laTap && !ban) {
      const raw = (body0 as { ep_so_ghe?: unknown } | undefined)?.ep_so_ghe;
      if (raw !== undefined) {
        // D515 — v57: trần một trận `SO_GHE_TRAN_TRAN` ghế (founder: "trần 1 trận là 20 người"); khoá cũ giữ 4..8.
        const tran = luatTao.toChucV57 === true ? SO_GHE_TRAN_TRAN : SO_GHE_MAX;
        if (!(Number.isInteger(raw) && (raw as number) >= SO_GHE_MIN && (raw as number) <= tran)) {
          throw new HoldemError(400, 'ep_so_ghe_khong_hop_le',
            `ep_so_ghe phải là số nguyên ${SO_GHE_MIN}..${tran}.`);
        }
        epSoGhe = raw as number;
        coEpThamSo = true;
      }
    }
    const bacNguoi = await bacVaoBanChoNguoi(pool, userId, currentSeasonId());
    const ghe = soDoGhe(seed, uid(actor), epSoGhe, khauVi, bacNguoi);
    /*
     * ═══ VAI BẤT ĐỐI XỨNG — bước 1: NHÃN, chưa đổi chip (22/08) ═══
     * Bốc thăm tất định theo seed, ghi VÀO sơ đồ ghế (cùng khuôn `khau_vi` /
     * `bot_id`: replay đọc lại từ `ghe_json`, trận cũ không có trường thì
     * không có vai). CHỈ map ≥ 12 — map 8 giữ THUẦN làm mẫu đối chứng (D85/D86).
     * ⚠ Vai ở bước này CHƯA đổi vốn / hệ số giá / lõi ghim — những thứ đó chạm
     * tiền nên đi cổng `balance_version` riêng. Bước này chỉ để (a) nhãn lên
     * `events` có mặt TRƯỚC khi cơ chế bật (append-only: gắn nhãn sau là không
     * được), (b) UI tập nói tên vai, (c) cấp 2 Lướt Sóng đã chạy được độc lập.
     */
    const soOThat = soO ?? HOLDEM_DECISIONS.MAP_SIZE;
    // D526 — nhịp xen kẽ chơi bàn 8 (trận thật) / 6 (bàn tập) mà vẫn có vai: vai là một nửa của khung v57, không phải đặc ân bàn lớn.
    const coVai = soOThat >= 12 || luatTao.nhipXenKe === true;
    if (coVai) {
      // D515 — v57: chia vai THEO XÁC SUẤT, trần theo cỡ bàn (founder chọn bảng A); khoá cũ giữ luật bốc cũ (D498 / trước đó) — vai ghi vào sơ đồ ghế, replay đọc lại.
      // v67 (ghép bàn xếp hạng) — `vaiTheoCoBan`: bảng 5 mốc cỡ bàn thay bảng 3 nhóm D515 (chỉ khoá v67; mặc định v66 giữ D515).
      const vai = luatTao.vaiTheoCoBan === true ? bocThamVaiTheoCoBan(seed, ghe.length)
        : luatTao.toChucV57 === true ? bocThamVaiXacSuat(seed, ghe.length) : bocThamVai(seed, ghe.length);
      for (const [i, g] of ghe.entries()) { const v = vai[i]; if (v) g.vai = v; }
    }
    /*
     * ÉP VAI — CHỈ tester. Gán THẲNG lên ghế 'ban' SAU khi bốc thăm xong,
     * KHÔNG đi qua tham số `chiCho` của `bocThamVai`: bàn nhỏ (<8 ghế) chỉ bốc
     * MỘT vai đặc biệt nên vai xin có thể không hề xuất hiện ở bàn đó, và khi
     * đó cơ chế hoán đổi của `bocThamVai` (đổi ghế với một ghế ĐANG CẦM vai
     * trong `chiCho`) không có gì để đổi — tester xin 'to_chuc' ở bàn 4 ghế sẽ
     * lặng lẽ KHÔNG được, đúng loại "ép mà không ép" tệ nhất. Gán thẳng đảm
     * bảo ép luôn có hiệu lực, và giá trị được gán XUỐNG `ghe_json` (nguồn
     * chân lý — A11.3) nên replay đọc lại y hệt, không suy lại từ `bocThamVai`.
     */
    if (eTester) {
      const epVaiRaw = (body0 as { ep_vai?: unknown } | undefined)?.ep_vai;
      if (epVaiRaw !== undefined) {
        if (typeof epVaiRaw !== 'string' || !(VAI_TAT_CA as readonly string[]).includes(epVaiRaw)) {
          throw new HoldemError(400, 'ep_vai_khong_hop_le',
            `ep_vai phải là một trong: ${VAI_TAT_CA.join(', ')}.`);
        }
        if (!coVai) {
          throw new HoldemError(400, 'ep_vai_can_map_lon',
            'ep_vai chỉ dùng được ở bàn ≥12 ô — map 8 là mẫu đối chứng, không gán vai (D85/D86).');
        }
        const iBanVai = ghe.findIndex((g) => g.id === 'ban');
        if (iBanVai >= 0) {
          ghe[iBanVai]!.vai = epVaiRaw as VaiId;
          coEpThamSo = true;
        }
      }
    }
    /*
     * `mien_gio` LUÔN false từ 16/08 chiều — luật "hai trận đầu không giờ" bị
     * founder bác ("chỉ miễn giờ khi chơi hướng dẫn thôi"; xem `vongMienGio`).
     * Giữ cột + ghi tường minh false thay vì bỏ tham số: hai trận prod đã tạo
     * với true là sự thật lịch sử, và một cột không ai ghi thì người sau đoán.
     *
     * TESTER MODE (0052) — đường ghi được PHỤC HỒI, CHỈ cho tester: founder
     * muốn quyền này lại để thử luồng "không đồng hồ" mà không cần dựng bàn
     * hướng dẫn. Đường ghi công khai (client thường) vẫn đóng nguyên như cũ.
     */
    const mienGio = eTester
      && (body0 as { ep_mien_gio?: unknown } | undefined)?.ep_mien_gio === true;
    if (mienGio) coEpThamSo = true;
    /*
     * D38 — VÒNG 1 MỞ RA NGAY TẠI ĐÂY, nên mốc phải ghi CÙNG câu INSERT.
     *
     * Không để `DEFAULT now()` ở schema và cũng không ghi bằng câu UPDATE thứ hai:
     * mốc là thứ quyết định trận còn sống hay không, nên nó phải sinh ra trong cùng
     * một câu lệnh với trận. Một trận tồn tại mà mốc chưa kịp ghi là một trận không
     * có hạn — đúng cái bệnh D38 đi sửa.
     *
     * `now()` của DB chứ không phải `new Date()` của Node: mọi so sánh về sau
     * (`tranHetHan` trong tick) đọc mốc này cạnh giờ DB, hai đồng hồ lệch nhau vài
     * giây là đủ để sinh ra "hạn âm" trên một trận vừa tạo.
     */
    /*
     * A8.9 — cùng họ ep_balance: ép thẻ chiến thuật khởi điểm cho ghế 'ban' để
     * test đặc quyền (shop bày ngẫu nhiên nên không điều khiển được qua đường
     * thật). CHỈ vitest HOẶC tester — cùng nới như `ep_balance` ngay trên.
     */
    if (process.env.VITEST || eTester) {
      const epCT = (body0 as { ep_chien_thuat?: unknown } | undefined)?.ep_chien_thuat;
      if (Array.isArray(epCT)) {
        const hopLe = epCT.filter((x) => typeof x === 'string'
          && CHIEN_THUAT.some((t) => t.id === x)
          // v54 (D389) — lõi đã rời shop thì tester cũng không ép vào tay được.
          && !(luatTao.loiGon && (LOI_BI_CAT as readonly string[]).includes(x))).slice(0, 3);
        const iBan = ghe.findIndex((g) => g.id === 'ban');
        if (iBan >= 0 && hopLe.length > 0) {
          ghe[iBan] = {
            ...ghe[iBan]!,
            danh_muc: { ...ghe[iBan]!.danh_muc, chien_thuat: hopLe as never },
          };
          if (eTester) coEpThamSo = true;
        }
      }
    }
    /*
     * SUẤT TRẬN (SPEC tran-tran-ngay) — LƯỚI TRẦN NGÀY: đếm + INSERT trong MỘT transaction dưới khoá tư vấn, để hai request sát
     * trần không cùng lọt (xem `server/suat_tran.ts`). Chạm trần ⇒ `HetSuatNgay`, không dòng nào được tạo. Admin miễn.
     */
    const ins = await trongLuoiNgay(pool, mienSuat(actor) || suat.tranNgaySuat === null, (db) => db.query(
      `INSERT INTO holdem_matches
         (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id,
          vong_mo_luc, che_do, so_o, mien_gio, ban_ma, co_ep_tham_so)
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $8, $9, $10, $11) RETURNING match_id, vong_mo_luc`,
      [uid(actor), seed, JSON.stringify(ghe), HOLDEM_VERSION,
       phienBan, currentSeasonId(), cheDoTao, soO ?? null, mienGio, ban?.ma ?? null, coEpThamSo]),
      Date.now(), suat.tranNgaySuat ?? undefined);
    const matchId = ins.rows[0]!.match_id as string;
    const vongMoLuc = ins.rows[0]!.vong_mo_luc as Date;

    // Dùng ĐÚNG sơ đồ vừa lưu, không suy lại (xem docstring `replay`).
    // Trận MỚI luôn mang balance_version hiện hành → bot tự quyết cam kết.
    const { st, kyNgo } = replay(seed, [], false, ghe, luatChoTran(phienBan, seed), 0, false, soO);
    await pool.query(
      `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
       VALUES ($1, 'holdem', $2, 'hd_match_start', $3)`,
      [uid(actor), matchId, JSON.stringify({
        // Số ghế THẬT của trận này (D3: 4–8), không phải hằng số mặc định.
        seed, so_ghe: ghe.length, doi_thu: bangDoiThu(st, seed),
        // NHÃN cho phân tích (A1): luôn false từ 16/08 chiều — giữ khoá để hai
        // trận prod ghi true sáng 16/08 phân biệt được với mọi trận khác.
        mien_gio: mienGio,
        // VAI (22/08) — nhãn cho phân tích tách NGƯỜI khỏi VAI. Vắng = map 8 / trận cũ.
        ...(ghe[0]?.vai ? { vai: ghe[0].vai } : {}),
        /*
         * CỠ MAP (D178) — khoá cắt LỚP DATA thứ hai, cạnh `vai`. Cỡ map vốn nằm
         * ở cột `holdem_matches.so_o`, nhưng `events` là SẢN PHẨM (A1) và phải
         * TỰ MÔ TẢ: ai đọc kho event mà không join được bảng trận thì không biết
         * dòng này sinh ra dưới áp lực nào (map 8 = áp lực thời gian, map 16 =
         * chu kỳ dài — xem `LOP_DATA`). Thêm trường vào `value_json` của một
         * action_type ĐÃ KHAI ⇒ không cần migration (tiền lệ `dau_hang` D110,
         * `ky_quy_mat` D127).
         */
        so_o: soO,
        // BÀN CHUNG (16/08): cohort "được rủ / cùng đề" — câu D62 chưa đo được.
        ...(ban ? {
          ban_ma: ban.ma,
          nguon: ban.loai === 'ngay' ? 'ban_ngay' : ban.loai === 'buoi_do' ? 'ban_buoi_do' : 'ban_chung',
          // D329 — đề của buổi đo: cắt lớp data "cùng đề" không cần join bảng bàn (events tự mô tả).
          ...(ban.loai === 'buoi_do' && ban.de_id ? { de_id: ban.de_id } : {}),
        } : {}),
      })]);

      return c.json({
        match_id: matchId,
        ban_ma: ban?.ma ?? null,
        // Mốc vừa ghi + giờ DB làm `now`: đồng hồ của trận mới luôn khởi hành ở
        // ĐÚNG thời lượng đầy đủ, không phụ thuộc lệch giờ giữa Node và Postgres.
        // Trận MỚI chưa chốt vòng nào ⇒ chưa có phong cách để chấm; dải ghế
        // hiện "—" cho tới vòng đầu tiên. Đó là sự thật, không phải thiếu sót.
        ...trangThaiCongKhai(st, seed, { vongMoLuc, now: vongMoLuc, mienGio }, kyNgo),
      }, 201);
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      // Lưới trần ngày (SPEC tran-tran-ngay): 503 + mốc mở lại — cùng hình với hàng chờ ở cổng, client nói "mở lại 0:00".
      if (e instanceof HetSuatNgay) {
        c.header('Retry-After', String(hoiLaiSauHetNgay(Date.now())));
        return c.json({ error: 'het_suat_ngay', message: e.message, mo_lai_luc: e.moLaiLuc }, 503);
      }
      throw e;
    }
  });

  /*
   * ── VÀO BÀN XẾP HẠNG GHÉP NGƯỜI (SPEC alpha-draft-tang-khong-gian mục 6) ─────────────────────────────────────────────────────────────
   * POST /holdem/rank/vao ⇒ tạo (hoặc trả lại) TRẬN RIÊNG của mình ở bàn đã được ghép: cùng seed · cùng số ghế · cùng bộ vai với cả bàn
   * (`rank_ban`), che_do `rank_slot`, khoá luật v67. Client không có input nào: seed, ghế, vai đều do server đọc từ bảng ghép (§7.5).
   * Idempotent — gọi lại trả đúng trận cũ (bấm đúp / quay lại tab không đẻ hai trận). Đồng hồ vòng 1 chạy từ LÚC VÀO, không từ lúc ghép.
   * ⚠ Ghế "người khác" trong trận của bạn do engine lái (engine hôm nay chỉ có MỘT ghế người) — xem báo cáo, mục 4.
   */
  app.post('/api/v1/holdem/rank/vao', ...guard, async (c) => {
    if (!ghepBanBat()) {
      return c.json({ error: 'ghep_ban_chua_mo', bat: false, message: THONG_BAO_CAN_NGUOI }, 403);
    }
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      const client = await pool.connect();
      let matchId: string; let vongMoLuc: Date; let ghe: GheMoi[]; let seed: number; let soO: number | undefined; let phienBan: string; let moi = false;
      try {
        await client.query('BEGIN');
        const b = await layBanDangChoi(client, userId, true);
        if (!b) {
          await client.query('ROLLBACK');
          return c.json({ error: 'khong_co_ban', message: 'Bạn chưa có bàn xếp hạng nào đang mở.' }, 404);
        }
        if (b.matchId) {
          await client.query('ROLLBACK');
          return c.json({ match_id: b.matchId, da_vao: true }, 200);
        }
        if (Date.now() >= b.hanLuc.getTime()) {
          await client.query('ROLLBACK');
          return c.json({ error: 'ban_het_han', message: 'Bàn xếp hạng này đã hết giờ chơi.' }, 409);
        }
        phienBan = b.balanceVersion;
        const luatTao = luatCua(phienBan);
        soO = coBanGhim(luatTao) ?? undefined;
        seed = b.seed;
        // Sơ đồ ghế: 'ban' + (soGhe−1) ghế còn lại. Bậc người = bậc lúc ĐĂNG KÝ (đầu vào của p(), đối thủ đã thấy đúng nhãn này).
        ghe = soDoGhe(seed, userId, b.soGhe, KHAU_VI_MAC_DINH, b.bacId);
        const vai = vaiChoGheNguoi(b.vai, b.gheChiSo);
        for (const [i, g] of ghe.entries()) { const v = vai[i]; if (v) g.vai = v; }
        const ins = await client.query(
          `INSERT INTO holdem_matches
             (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id,
              vong_mo_luc, che_do, so_o, mien_gio, ban_ma, co_ep_tham_so)
           VALUES ($1, $2, $3, $4, $5, $6, now(), 'rank_slot', $7, false, NULL, false) RETURNING match_id, vong_mo_luc`,
          [userId, seed, JSON.stringify(ghe), HOLDEM_VERSION, phienBan, b.seasonId, soO ?? null]);
        matchId = ins.rows[0]!.match_id as string;
        vongMoLuc = ins.rows[0]!.vong_mo_luc as Date;
        if (!(await ghiTranVaoBan(client, b.banId, userId, matchId))) throw new Error('rank_ban_nguoi.match_id đã bị gán trong lúc vào bàn');
        await client.query('COMMIT');
        moi = true;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
      const { st, kyNgo } = replay(seed, [], false, ghe, luatChoTran(phienBan, seed), 0, false, soO);
      await pool.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
         VALUES ($1, 'holdem', $2, 'hd_match_start', $3)`,
        [userId, matchId, JSON.stringify({
          seed, so_ghe: ghe.length, doi_thu: bangDoiThu(st, seed), mien_gio: false,
          ...(ghe[0]?.vai ? { vai: ghe[0].vai } : {}),
          so_o: soO,
          // Nhãn cho phân tích: trận thuộc bàn xếp hạng ghép người (cohort cùng seed).
          nguon: 'rank_ghep',
        })]);
      return c.json({
        match_id: matchId, da_vao: !moi, ban_ma: null,
        ...trangThaiCongKhai(st, seed, { vongMoLuc, now: vongMoLuc, mienGio: false }, kyNgo),
      }, 201);
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  /*
   * GET /holdem/me/tien-do ⇒ số trận ĐÃ XONG + thứ đã mở khoá (D86). Sảnh vẽ
   * mốc "còn N trận nữa" từ đây; LUẬT (bảng `MO_KHOA`) đi trong catalog, nên
   * client không gõ lại số nào. Kênh ĐỌC THUẦN, không đổi gì.
   */
  app.get('/api/v1/holdem/me/tien-do', ...guard, async (c) => {
    const so = await demTranXong(pool, uid(c.get('actor')));
    return c.json({ so_tran_xong: so, ...moKhoaTheoTran(so) });
  });

  // ── BÀN CHUNG THEO SEED (16/08, migration 0040) ──────────────────────────
  /*
   * POST /holdem/ban {so_o?} ⇒ phát MÃ 5 ký tự ↔ (seed, cỡ map), hạn 24h. Người
   * tạo rồi tự vào bằng POST /matches {ban_ma} như mọi người khác — một đường
   * vào cho cả chủ lẫn khách, không có đường riêng để lệch.
   * Khách CHƠI NGAY (D64/D89) vào được — người được rủ chưa có tài khoản là đúng
   * người cần cửa này. Trần: cùng nhóm rate limit 'tao'.
   */
  app.post('/api/v1/holdem/ban', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      await chanTanSuat(userId, 'tao', GIOI_HAN.TAO_MOI_GIO);
      const body0 = await c.req.json().catch(() => ({})) as {
        so_o?: unknown; loai?: unknown; de_id?: unknown; nhan?: unknown; ngay_dong?: unknown;
      };
      /*
       * D329 — BÀN BUỔI ĐO. Chỉ người điều phối (`users.la_dieu_phoi`, bật tay bằng SQL). Không nhận
       * seed: chỉ `de_id` của ngân hàng đề — seed, cỡ bàn và BỘ LUẬT đều lấy từ đề và GHI VÀO BÀN.
       */
      if (body0?.loai === 'buoi_do') {
        const dp = actor.laKhach ? undefined
          : (await pool.query(`SELECT la_dieu_phoi FROM users WHERE user_id = $1`, [userId])).rows[0];
        if (dp?.la_dieu_phoi !== true) {
          throw new HoldemError(403, 'khong_phai_dieu_phoi', 'Chỉ người điều phối được tạo bàn buổi đo.');
        }
        const de = deCua(body0.de_id);
        if (!de) {
          throw new HoldemError(400, 'de_khong_co',
            `Không có đề này. Đề hợp lệ: ${DE_DANG_DUNG.map((d) => d.id).join(', ')}.`);
        }
        /*
         * D392 — ĐỀ THÔI DÙNG không mở được bàn mới. Chặn ở server, không chỉ giấu khỏi màn điều phối
         * (C4): de-a/de-b ghim luật v45 trong khi bàn tập và lời Oracle đi luật v52 — một buổi đo tạo trên
         * đề ấy là tester tập một luật rồi bị đo bằng luật khác.
         */
        if (de.thoi_dung !== undefined) {
          throw new HoldemError(400, 'de_thoi_dung',
            `Đề này đã thôi dùng. Đề hợp lệ: ${DE_DANG_DUNG.map((d) => d.id).join(', ')}.`);
        }
        const nhan = typeof body0.nhan === 'string' ? body0.nhan : '';
        if (!/^[a-z0-9-]{1,32}$/.test(nhan)) {
          throw new HoldemError(400, 'nhan_khong_hop_le',
            'Nhãn chỉ gồm a-z, 0-9 và dấu gạch, tối đa 32 ký tự — không ghi tên người hay tên trường.');
        }
        const NGAY_MS = 86_400_000;
        let hetHan = new Date(Date.now() + BUOI_DO.HAN_MAC_DINH_NGAY * NGAY_MS);
        if (body0.ngay_dong !== undefined) {
          const t = Date.parse(String(body0.ngay_dong));
          if (!Number.isFinite(t) || t <= Date.now() || t > Date.now() + BUOI_DO.HAN_TOI_DA_NGAY * NGAY_MS) {
            throw new HoldemError(400, 'ngay_dong_khong_hop_le',
              `Ngày đóng phải ở tương lai và không quá ${BUOI_DO.HAN_TOI_DA_NGAY} ngày.`);
          }
          hetHan = new Date(t);
        }
        const KY = 'abcdefghijklmnopqrstuvwxyz0123456789';
        for (let lan = 0; lan < 5; lan++) {
          const ma = Array.from({ length: 5 }, () => KY[Math.floor(Math.random() * KY.length)]).join('');
          const ins = await pool.query(
            `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, loai, het_han, de_id, nhan, balance_version)
             VALUES ($1, $2, $3, $4, 'buoi_do', $5, $6, $7, $8)
             ON CONFLICT (ma) DO NOTHING RETURNING ma, het_han`,
            [ma, de.seed, de.so_o, userId, hetHan, de.id, nhan, de.balance_version]);
          if (ins.rowCount === 1) {
            return c.json({
              ma, loai: 'buoi_do', so_o: de.so_o, het_han: ins.rows[0]!.het_han, de_id: de.id, nhan,
            }, 201);
          }
        }
        throw new HoldemError(409, 'khong_phat_duoc_ma', 'Chưa phát được mã bàn — thử lại.');
      }
      const soORaw = Number(body0?.so_o);
      // v54 (D389) — bàn chung chơi luật MẶC ĐỊNH lúc vào trận ⇒ khoá mặc định có `chiBan16` thì bàn 16.
      // D526 — cỡ ghim của khoá mặc định (`coBanGhim`): v58 ⇒ 8, v54 ⇒ 16.
      const soO = coBanGhim(luatCua(HOLDEM_BALANCE_VERSION))
        ?? ((HOLDEM_DECISIONS.CO_MAP_CHON as readonly number[]).includes(soORaw) ? soORaw : HOLDEM_DECISIONS.MAP_SIZE);
      const seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
      // Mã: base36 5 ký tự, thử lại khi trùng (36^5 ≈ 60 triệu; trùng gần như không).
      const KY_TU = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let ma = '';
      for (let lan = 0; lan < 5; lan++) {
        ma = Array.from({ length: 5 }, () => KY_TU[Math.floor(Math.random() * KY_TU.length)]).join('');
        const ins = await pool.query(
          `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, het_han)
           VALUES ($1, $2, $3, $4, now() + interval '24 hours')
           ON CONFLICT (ma) DO NOTHING RETURNING ma, het_han`,
          [ma, seed, soO, userId]);
        if (ins.rowCount === 1) {
          return c.json({ ma, so_o: soO, het_han: ins.rows[0]!.het_han }, 201);
        }
      }
      throw new HoldemError(409, 'khong_phat_duoc_ma', 'Chưa phát được mã bàn — thử lại.');
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  /*
   * DỰNG PHẢN HỒI MỘT BÀN (đội hoặc ngày) — một nguồn cho `GET /holdem/ban/:ma`
   * lẫn `GET /holdem/ngay`.
   * ⚠ Khuôn A3.1: NAV/hạng của người khác CHỈ hiện khi CHÍNH người hỏi đã xong
   * trận của mình ở bàn này (hoặc chưa vào — thì họ chỉ thấy AI đang chơi, không
   * thấy số). Đội là "cùng đề mù": thấy đáp án người khác trước khi làm là hết
   * đề. Người chưa xong thấy tên + "đang chơi", không thấy số.
   * BÀN NGÀY: KHÔNG trả danh sách tên (D32 — phân vị cho mọi người, không top-N;
   * và người lạ không cần thấy handle của nhau) — chỉ `thu_thach` = số người +
   * hạng/phân vị CỦA MÌNH sau khi mình xong (`phanVi`, một nguồn).
   */
  async function dungBan(ma: string, me: string) {
    const rb = await pool.query(
      `SELECT b.ma, b.seed, b.so_o, b.het_han, b.created_at, b.loai, b.de_id, b.nhan,
              -- DATE đọc thành CHUỖI: node-postgres parse DATE ra Date ở nửa đêm
              -- giờ MÁY, toISOString() trên máy UTC+7 lùi mất một ngày.
              to_char(b.ngay, 'YYYY-MM-DD') AS ngay,
              u.handle AS chu_handle, b.chu_user_id
         FROM holdem_ban b LEFT JOIN users u ON u.user_id = b.chu_user_id
        WHERE b.ma = $1`, [ma]);
    const b = rb.rows[0];
    if (!b) throw new HoldemError(404, 'ban_khong_co', 'Không có bàn này.');
    const rows = await pool.query(
      `SELECT m.match_id, m.owner_user_id, m.status, u.handle, m.seed, m.so_o,
              m.action_log, m.ghe_json, m.balance_version,
              r.hang, r.von_cuoi
         FROM holdem_matches m
         JOIN users u ON u.user_id = m.owner_user_id
         LEFT JOIN holdem_results r ON r.match_id = m.match_id AND r.user_id = m.owner_user_id
        WHERE m.ban_ma = $1
        ORDER BY m.started_at ASC`, [ma]);
    const cuaToi = rows.rows.find((r) => r.owner_user_id === me);
    const toiDaXong = cuaToi?.status === 'xong';
    const laNgay = b.loai === 'ngay';
    // D329 — bàn buổi đo cũng KHÔNG danh sách tên: người lạ cùng buổi không thấy nhau (D32), và
    // người điều phối đọc bức tranh nhóm ở `/nhom`, không đọc từng dòng ở đây.
    const laBuoiDo = b.loai === 'buoi_do';
    let soGhost = 0;
    const doi = laNgay || laBuoiDo ? [] : rows.rows.map((r) => {
      const xong = r.status === 'xong';
      const laToi = r.owner_user_id === me;
      // Số của NGƯỜI KHÁC chỉ lộ khi tôi đã xong (A3.1); số của tôi luôn lộ.
      const loSo = xong && (laToi || toiDaXong);
      /*
       * GHOST — đường NAV từng vòng của bạn cùng bàn, để thẻ kết trận vẽ đường
       * mình TRÊN NỀN đường họ ("cùng một đề" kiểu Wordle). Chỉ dựng khi số của
       * họ ĐÃ được phép lộ (`loSo` — khuôn A3.1), tức mình đã chốt bàn xong;
       * trước đó không có gì để rò. Trần `GHOST_TOI_DA` giữ chi phí replay có
       * đáy: mỗi ghost là O(vòng²) lượt replay, và bàn đội có thể đông hơn ta
       * tưởng — một endpoint đọc không được phép phình theo số người.
       */
      const ghost = loSo && !laToi && soGhost < GHOST_TOI_DA
        ? (() => {
          soGhost += 1;
          try {
            return duongNav({
              seed: Number(r.seed),
              log: (r.action_log ?? []) as HanhDongLog[],
              ghe: (r.ghe_json ?? null) as GheMoi[] | null,
              luat: luatChoTran(r.balance_version as string | null, Number(r.seed)),
              soO: r.so_o === null ? null : Number(r.so_o),
            }).map((d) => d.nav.ban ?? 0);
          } catch { return undefined; }   // trận hỏng ⇒ mất ghost, không mất bảng
        })()
        : undefined;
      return {
        handle: r.handle as string, la_toi: laToi, xong,
        dang_choi: r.status === 'dang_choi',
        ...(loSo ? { von_cuoi: Number(r.von_cuoi), hang: Number(r.hang) } : {}),
        ...(ghost && ghost.length > 0 ? { duong: ghost } : {}),
      };
    });
    // Bàn ngày: sân = mọi trận ĐÃ XONG có kết quả; phân vị của tôi chỉ khi tôi xong.
    const xongCaSan = rows.rows.filter((r) => r.status === 'xong' && r.von_cuoi != null);
    const thuThach = laNgay ? {
      ngay: String(b.ngay),
      so_nguoi_vao: rows.rowCount ?? 0,
      so_nguoi_xong: xongCaSan.length,
      ...(toiDaXong && cuaToi?.von_cuoi != null
        ? { nav: Number(cuaToi.von_cuoi), ...phanVi(Number(cuaToi.von_cuoi), xongCaSan.map((r) => Number(r.von_cuoi))) }
        : {}),
    } : null;
    return {
      ma: b.ma as string, so_o: Number(b.so_o), het_han: b.het_han as Date, created_at: b.created_at as Date,
      loai: b.loai as 'doi' | 'ngay' | 'buoi_do',
      chu: (b.chu_handle as string | null) ?? 'DELPHI', la_chu: b.chu_user_id === me,
      so_nguoi: rows.rowCount ?? 0,
      toi: cuaToi ? { match_id: cuaToi.match_id as string, status: cuaToi.status as string } : null,
      toi_da_xong: toiDaXong,
      doi,
      ...(thuThach ? { thu_thach: thuThach } : {}),
      ...(laBuoiDo ? {
        buoi_do: {
          nhan: b.nhan as string | null,
          de_id: b.de_id as string,
          ma_tham_gia: cuaToi ? maThamGia(cuaToi.match_id as string) : null,
          da_dong_y: (await trangThaiDongYBuoiDo(pool, me, ma)).hien_hanh,
          phien_ban_hien_hanh: CONSENT_PHIEN_BAN.buoi_do,
        },
      } : {}),
    };
  }

  app.get('/api/v1/holdem/ban/:ma', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const ma = String(c.req.param('ma') ?? '').trim().toLowerCase();
      if (!/^[a-z0-9]{5}$/.test(ma)) throw new HoldemError(404, 'ban_khong_co', 'Không có bàn này.');
      await chanTanSuat(uid(actor), 'ban_xem', GIOI_HAN.BAN_XEM_MOI_GIO);
      return c.json(await dungBan(ma, uid(actor)));
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  /* ═══ D329 — BUỔI ĐO: đồng ý · rút lại · đóng sớm · trang NHÓM ═══════════════════════════════ */

  /** Đọc bàn buổi đo theo mã; không có hoặc không phải buổi đo ⇒ 404 (không lộ bàn loại khác tồn tại). */
  async function banBuoiDo(maTho: string | undefined) {
    const ma = String(maTho ?? '').trim().toLowerCase();
    if (!/^[a-z0-9]{5}$/.test(ma)) throw new HoldemError(404, 'ban_khong_co', 'Không có bàn này.');
    /*
     * D392 — "đã đóng" so bằng ĐỒNG HỒ DB, không bằng `Date.now()` của Node: cú đóng ghi `het_han = now()`
     * của DB, rồi so với giờ Node là so hai đồng hồ. Trên Windows giờ Node thô (~15 ms) nên vừa đóng xong
     * vẫn có lúc đọc ra "chưa đóng" (bài trang nhóm chập chờn). Danh sách buổi đo đã so trong SQL.
     */
    const r = await pool.query(
      `SELECT ma, loai, chu_user_id, het_han, de_id, nhan, (het_han <= now()) AS da_dong
         FROM holdem_ban WHERE ma = $1`, [ma]);
    const b = r.rows[0] as {
      ma: string; loai: string; chu_user_id: string | null; het_han: Date; de_id: string | null; nhan: string | null;
      da_dong: boolean;
    } | undefined;
    if (!b || b.loai !== 'buoi_do') throw new HoldemError(404, 'ban_khong_co', 'Không có bàn này.');
    const { da_dong: daDong, ...con } = b;
    return { ...con, daDong: daDong === true };
  }

  /*
   * ĐỒNG Ý — ghi VẾT (id + phiên bản + bàn) vào `events`. Đồng ý hai lần = hai vết, không lỗi: vết là
   * lịch sử, không phải trạng thái. Bàn đã đóng ⇒ 409 — đồng ý cho một buổi không còn vào được là vết
   * vô nghĩa.
   */
  app.post('/api/v1/holdem/ban/:ma/dong-y', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      if (actor.laKhach) {
        throw new HoldemError(403, 'khach_khong_vao_buoi_do',
          'Buổi đo cần một tài khoản — tạo tài khoản rồi mở lại link này nhé.');
      }
      const userId = uid(actor);
      await chanTanSuat(userId, 'tao', GIOI_HAN.TAO_MOI_GIO);
      const b = await banBuoiDo(c.req.param('ma'));
      if (b.daDong) throw new HoldemError(409, 'ban_het_han', 'Buổi đo này đã đóng.');
      const body = await c.req.json().catch(() => ({})) as { phien_ban?: unknown };
      if (!laConsentHienHanh('buoi_do', body.phien_ban)) {
        throw new HoldemError(400, 'consent_cu',
          `Văn bản đã đổi — bản hiện hành là ${CONSENT_PHIEN_BAN.buoi_do}. Tải lại trang để đọc bản mới.`);
      }
      /*
       * D362 — VẾT + CỜ TRONG MỘT TRANSACTION. Link bàn buổi đo LÀ link tester (founder 20/09), nên cú bấm
       * này vừa ghi vết đồng ý vừa bật `users.thu_chi_tiet` để khu TESTER của `/quan-tri` đọc từng người.
       * ⚠ Cùng transaction là bắt buộc, không phải cho gọn: cờ bật mà vết ghi hỏng ⇒ dashboard soi một
       * người không có bằng chứng đã đồng ý — đúng tình trạng cả cơ chế consent sinh ra để tránh.
       * ⚠ Cờ này KHÔNG mở cửa dữ liệu nào mới (xem 0068): thu gì vẫn do `research_consent` + bốn cửa PFM
       * quyết. Nó chỉ nói "người này thuộc đợt thử nghiệm đang cần soi từng người".
       */
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
           VALUES ($1, 'holdem', $2, 'hd_dong_y_buoi_do', $3)`,
          [userId, b.ma, JSON.stringify({ ban_ma: b.ma, van_ban_id: 'buoi_do', phien_ban: body.phien_ban })]);
        /*
         * D370 — CẤP MÃ BUỔI ĐO trong CHÍNH transaction này.
         *
         * ⚠ Vì sao ở đây chứ không lúc đăng ký: mã chỉ có nghĩa khi đã đồng ý. Cấp lúc đăng ký là phát
         *   khoá ghép cho người chưa bấm đồng ý — đúng thứ `dot_thu.ts` được viết ra để chặn.
         * ⚠ GIỮ NGUYÊN MÃ CŨ khi rút rồi đồng ý lại — cấp mã mới làm mọi phiếu họ đã nộp thành mồ côi
         *   (bảng tính Form chở mã cũ, không ai đi sửa lại được). Có HAI lớp giữ, và chúng khác vai:
         *     · `maBuoiDo` TẤT ĐỊNH — cùng (người, bàn) ra cùng mã. Đây là lớp đang thực sự làm việc.
         *     · `COALESCE` — giữ giá trị ĐÃ LƯU kể cả khi hàm sinh ra giá trị khác.
         *   ⚠ Hôm nay lớp hai KHÔNG canh được gì (tiêm thử bỏ COALESCE: 0 bài đỏ, vì tất định nên hai
         *   lớp luôn cho cùng kết quả). Nó có nghĩa đúng một ngày nào đó mã thôi tất định — ví dụ thêm
         *   vòng thử lại khi đụng unique index 0069. Giữ lại vì ngày ấy gần, và `tests/buoi_do_tu_phuc_vu`
         *   §II có bài canh đặt mã khác tay rồi đồng ý lại — bài ấy mới thật sự canh dòng này.
         * ⚠ Đụng độ mã (unique index 0069) ⇒ ném ra ngoài, transaction rollback, người dùng bấm lại.
         *   Thử lại tự động ngay trong đây sẽ phải lặp trong transaction đang mở; hiếm tới mức không đáng
         *   (31^4 ≈ 923k, 60 người/bàn), và im lặng nuốt nó thì lần đụng thật sẽ không ai biết.
         */
        await client.query(
          `UPDATE users
              SET thu_chi_tiet = true, thu_chi_tiet_luc = now(), thu_chi_tiet_nhan = $2,
                  ma_buoi_do = COALESCE(ma_buoi_do, $3)
            WHERE user_id = $1`, [userId, b.nhan, maBuoiDo(userId, b.ma)]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
      return c.json({ ok: true, phien_ban: body.phien_ban });
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  /*
   * RÚT LẠI — lời văn bản hứa: *"Rút lại lúc nào cũng được: thẻ vẫn là của bạn, số của bạn rời khỏi
   * bức tranh nhóm từ lần tổng hợp kế."* ⇒ được cả khi bàn đã đóng, và `/nhom` tính lại mỗi lần đọc.
   * Chưa đồng ý (hoặc đã rút) ⇒ không ghi vết thứ hai, trả `doi: false`.
   */
  /*
   * D370 — TIẾN MỘT BƯỚC TRONG LỘ TRÌNH TESTER. `POST /buoi-do/buoc` với `{ buoc }`.
   *
   * Không có người điều phối (founder 21/09) ⇒ app là thứ canh thứ tự. Cột `users.buoi_do_buoc`
   * (0069) là bộ nhớ của nó: 0 chưa đồng ý · 1 nộp PHIẾU 1 · 2 xong Alpha Draft · 3 nộp PHIẾU 2 ·
   * 4 xong PFM · 5 nộp PHIẾU 3.
   *
   * ⚠⚠ CHỈ TIẾN, KHÔNG LÙI, và chỉ tiến tới con số ĐƯỢC XIN. `GREATEST` làm việc ấy ngay trong SQL nên
   *   hai tab mở song song không đua nhau hạ số xuống. Cho lùi là mở đường làm lại phiếu sau khi đã xem
   *   thẻ — đúng thứ cả lộ trình này sinh ra để chặn.
   * ⚠ KHÔNG kiểm "bước xin có đúng bước kế không". Ba bước phiếu (1·3·5) do người dùng tự khai đã nộp,
   *   mà `GREATEST` đã chặn chiều lùi; thêm luật "phải đúng +1" chỉ làm người mất mạng giữa chừng bị kẹt
   *   vĩnh viễn, đổi lấy một thứ không ai có động cơ phá (họ tự làm khó chính mình).
   * ⚠ Chỉ cho người ĐANG ở chế độ tester. Người thường gọi vào đây không có gì để tiến.
   */
  app.post('/api/v1/holdem/buoi-do/buoc', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      const body = await c.req.json().catch(() => ({})) as { buoc?: unknown };
      const buoc = Number(body.buoc);
      if (!Number.isInteger(buoc) || buoc < 1 || buoc > 5) {
        throw new HoldemError(400, 'buoc_khong_hop_le', 'Bước phải là số nguyên 1–5.');
      }
      const { rows } = await pool.query(
        `UPDATE users SET buoi_do_buoc = GREATEST(buoi_do_buoc, $2)
          WHERE user_id = $1 AND thu_chi_tiet
        RETURNING buoi_do_buoc`, [userId, buoc]);
      if (rows.length === 0) {
        throw new HoldemError(409, 'khong_o_che_do_tester', 'Bạn không đang ở chế độ tester của buổi đo.');
      }
      return c.json({ ok: true, buoc: Number(rows[0].buoi_do_buoc) });
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  app.post('/api/v1/holdem/ban/:ma/rut-dong-y', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      const b = await banBuoiDo(c.req.param('ma'));
      if (!(await trangThaiDongYBuoiDo(pool, userId, b.ma)).dong_y) return c.json({ ok: true, doi: false });
      /*
       * D362 — RÚT THÌ TẮT CỜ, cùng transaction với vết rút. Cờ còn bật sau khi người ta đã rút là đúng
       * thứ biến nút "rút lại" thành một nút không làm gì.
       * ⚠ Tắt VÔ ĐIỀU KIỆN, không kiểm "còn bàn nào khác đang đồng ý không". Mùa này một người chỉ thuộc
       *   một đợt; kiểm chéo nhiều bàn là thêm một nhánh chưa ai dùng, và nhánh chưa ai dùng thì chưa ai
       *   biết nó đúng. Nếu sau này một người vào hai đợt, đây là chỗ phải sửa — không phải chỗ để đoán trước.
       */
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
           VALUES ($1, 'holdem', $2, 'hd_rut_buoi_do', $3)`,
          [userId, b.ma, JSON.stringify({ ban_ma: b.ma })]);
        await client.query(
          `UPDATE users SET thu_chi_tiet = false, thu_chi_tiet_luc = NULL WHERE user_id = $1`, [userId]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
      return c.json({ ok: true, doi: true });
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  /** ĐÓNG SỚM — người điều phối khép buổi khi hết giờ (bức tranh nhóm chỉ mở SAU khi đóng). */
  app.post('/api/v1/holdem/ban/:ma/dong', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      const b = await banBuoiDo(c.req.param('ma'));
      if (b.chu_user_id !== userId) throw new HoldemError(403, 'khong_phai_chu_ban', 'Chỉ người tạo bàn được đóng.');
      await pool.query(
        `UPDATE holdem_ban SET het_han = now() WHERE ma = $1 AND het_han > now()`, [b.ma]);
      return c.json({ ok: true });
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  /*
   * TRANG NHÓM (tệp 10 §4.2) — thứ DUY NHẤT tổ chức nhận. Chỉ người tạo bàn.
   * ⚠⚠ BA RÀO, cả ba là cấu trúc chứ không phải lời hứa:
   *  (1) CHỈ SAU KHI BÀN ĐÓNG. Đọc được lúc bàn còn mở thì người điều phối hỏi lại sau MỖI người xong
   *      và trừ hai lần đọc liền nhau là ra đúng thẻ của người vừa xong — phép tấn công hiệu số (P18)
   *      không cần hai truy vấn khác nhau, chỉ cần hai thời điểm.
   *  (2) SÀN MẪU `PFM.SAN_MAU_BAN` — dưới sàn thì chỉ có `n`, không một con số nào khác.
   *  (3) LÀM TRÒN `PFM.BUOC_LAM_TRON` và KHÔNG MỘT DÒNG THEO NGƯỜI.
   * Chỉ tính trận đã xong của người mà vết MỚI NHẤT với bàn này là ĐỒNG Ý, và trận vào thẻ được
   * (`tinh_vao_the` — trận chạy máy/bỏ dở không phải một quyết định để đếm).
   * ⚠ Rút lại SAU khi đóng vẫn làm số đổi ở lần đọc kế — đúng lời hứa, nhưng hiệu số của lần rút ấy
   *   lộ bậc của người rút. Hai lối, founder chọn: D329 §Nghiệm thu.
   */
  app.get('/api/v1/holdem/ban/:ma/nhom', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      const b = await banBuoiDo(c.req.param('ma'));
      if (b.chu_user_id !== userId) throw new HoldemError(403, 'khong_phai_chu_ban', 'Chỉ người tạo bàn đọc được trang nhóm.');
      /*
       * D396 — trận ĐẦU HÀNG không vào n: đầu hàng ở vòng 1 là "xong" về trạng thái nhưng không có quyết định
       * nào để chấm — đếm nó thì 12 người bỏ cuộc cũng đủ sàn và bức tranh nhóm nói về thứ không ai làm.
       * Cùng điều kiện với "đã xong" ở màn điều phối (`/holdem/ban-buoi-do`) để hai con số khớp nhau.
       */
      const tran = await pool.query(
        `SELECT m.match_id FROM holdem_matches m
          WHERE m.ban_ma = $1 AND m.status = 'xong'
            AND NOT EXISTS (SELECT 1 FROM holdem_results r
                             WHERE r.match_id = m.match_id AND r.user_id = m.owner_user_id AND r.dau_hang)
            AND (SELECT e.action_type FROM events e
                  WHERE e.user_id = m.owner_user_id
                    AND e.action_type IN ('hd_dong_y_buoi_do', 'hd_rut_buoi_do')
                    AND e.value_json->>'ban_ma' = $1
                  ORDER BY e.event_id DESC LIMIT 1) = 'hd_dong_y_buoi_do'
          ORDER BY m.started_at ASC`, [b.ma]);
      const ids = tran.rows.map((r) => String(r.match_id));
      const goc = { ma: b.ma, nhan: b.nhan, de_id: b.de_id, da_dong: b.daDong, san: PFM.SAN_MAU_BAN };
      if (!b.daDong || ids.length < PFM.SAN_MAU_BAN) {
        return c.json({ ...goc, n: ids.length, du_mau: false });
      }
      await dungTranCu(pool, ids, hanhViDeps);
      const theoTran = new Map<string, HangHanhVi[]>();
      for (const v of await docVongCuaTran(pool, ids)) {
        const ds = theoTran.get(v.match_id);
        if (ds) ds.push(v); else theoTran.set(v.match_id, [v]);
      }
      const the = ids.map((id) => chamNangLucTran(theoTran.get(id) ?? []))
        .filter((t) => t.tinh_vao_the);
      const n = the.length;
      if (n < PFM.SAN_MAU_BAN) return c.json({ ...goc, n, du_mau: false });
      const tron = (dem: number): number =>
        Math.round((dem * 100) / n / PFM.BUOC_LAM_TRON) * PFM.BUOC_LAM_TRON;
      return c.json({
        ...goc, n, du_mau: true,
        // D396 — chỉ năng lực đang HIỆN (N2 ẩn: xem `NANG_LUC_AN`).
        nang_luc: NANG_LUC_HIEN.map((id) => {
          const bac = the.map((t) => t.nang_luc.find((x) => x.id === id)?.bac ?? 'chua_gap');
          return {
            id,
            pct: {
              chua_gap: tron(bac.filter((x) => x === 'chua_gap').length),
              gap_chua_vung: tron(bac.filter((x) => x === 'gap_chua_vung').length),
              lam_duoc: tron(bac.filter((x) => x === 'lam_duoc').length),
            },
          };
        }),
      });
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  /*
   * D333 — BUỔI ĐO CỦA TÔI (màn `/buoi-do` của người điều phối). D329 để người điều phối giữ mã trong đầu
   * và gõ `fetch` trong console, với điều kiện kích hoạt *"người điều phối đầu tiên không phải founder"* —
   * buổi đầu do người khác tổ chức, nên điều kiện đã tới.
   * ⚠ CHỈ HAI SỐ ĐẾM mỗi bàn: người đã vào · trận đã xong. Không tên, không hạng, không bậc. Con số về NĂNG
   *   LỰC chỉ đi qua `/nhom` — sau khi bàn đóng, trên sàn mẫu, đã làm tròn. Hai số đếm đọc lúc bàn mở không
   *   trừ ra được gì: bức tranh có thể bị trừ hiệu số chưa tồn tại cho tới khi đóng.
   * ⚠ Cùng cổng với cú TẠO bàn (cờ `la_dieu_phoi`): gỡ cờ là mất màn quản lý. `/dong` và `/nhom` vẫn chỉ
   *   hỏi "có phải người tạo bàn không" như D329.
   * `de` = danh sách ĐỀ để chọn khi tạo bàn — chỉ id và cỡ. KHÔNG gửi seed ra client: `config/holdem_de.ts`
   *   không được lọt vào gói web (tập trước đúng đề là hết đo lại).
   */
  app.get('/api/v1/holdem/ban-buoi-do', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      const dp = actor.laKhach ? undefined
        : (await pool.query(`SELECT la_dieu_phoi FROM users WHERE user_id = $1`, [userId])).rows[0];
      if (dp?.la_dieu_phoi !== true) {
        throw new HoldemError(403, 'khong_phai_dieu_phoi', 'Chỉ người điều phối xem được các buổi đo.');
      }
      const r = await pool.query(
        `SELECT b.ma, b.nhan, b.de_id, b.het_han, b.created_at,
                (b.het_han <= now()) AS da_dong,
                count(m.match_id)::int AS so_nguoi,
                -- D396 — "đã xong" không gồm trận ĐẦU HÀNG: cùng điều kiện với n của trang nhóm.
                (count(m.match_id) FILTER (WHERE m.status = 'xong' AND NOT EXISTS (
                   SELECT 1 FROM holdem_results r
                    WHERE r.match_id = m.match_id AND r.user_id = m.owner_user_id AND r.dau_hang)))::int AS so_xong
           FROM holdem_ban b
           LEFT JOIN holdem_matches m ON m.ban_ma = b.ma
          WHERE b.loai = 'buoi_do' AND b.chu_user_id = $1
          GROUP BY b.ma
          ORDER BY b.created_at DESC
          LIMIT 50`, [userId]);
      return c.json({
        de: DE_DANG_DUNG.map((d) => ({ id: d.id, so_o: d.so_o })),
        san: PFM.SAN_MAU_BAN,
        ban: r.rows.map((b) => ({
          ma: b.ma as string, nhan: b.nhan as string | null, de_id: b.de_id as string,
          het_han: b.het_han as Date, created_at: b.created_at as Date, da_dong: b.da_dong === true,
          so_nguoi: Number(b.so_nguoi), so_xong: Number(b.so_xong),
        })),
      });
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  /*
   * GET /holdem/ngay ⇒ BÀN HÔM NAY (D85 §5.2 — thử thách hôm nay), tự phát nếu
   * chưa có: một dòng `holdem_ban` loai 'ngay' mỗi ngày VN, seed ngẫu nhiên do
   * server rút lúc phát (không suy từ ngày — suy được là đoán trước được map),
   * het_han = 0:00 VN kế tiếp (`ngayVN`, một nguồn). Hai người hỏi cùng lúc
   * sáng sớm ⇒ UNIQUE (ngay) WHERE loai='ngay' cho đúng một dòng, người kia
   * đọc lại. Trả CÙNG hình dạng với GET /holdem/ban/:ma (`dungBan`) — client
   * dùng chung một kiểu.
   */
  app.get('/api/v1/holdem/ngay', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const { ngay, het_han } = ngayVN(new Date());
      let ma: string | null = null;
      const co = await pool.query(
        `SELECT ma FROM holdem_ban WHERE loai = 'ngay' AND ngay = $1`, [ngay]);
      if (co.rows[0]) ma = co.rows[0].ma as string;
      const KY_TU = 'abcdefghijklmnopqrstuvwxyz0123456789';
      for (let lan = 0; ma === null && lan < 5; lan++) {
        const thu = Array.from({ length: 5 }, () => KY_TU[Math.floor(Math.random() * KY_TU.length)]).join('');
        const seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
        const ins = await pool.query(
          `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, loai, ngay, het_han)
           VALUES ($1, $2, $3, NULL, 'ngay', $4, $5)
           ON CONFLICT (ngay) WHERE loai = 'ngay' DO NOTHING RETURNING ma`,
          // v54 (D389) — khoá mặc định ghim cỡ thì bàn ngày theo cỡ ấy (D526: `coBanGhim` — v58 ⇒ 8); bàn ngày cũ giữ cỡ đã lưu.
          [thu, seed, coBanGhim(luatCua(HOLDEM_BALANCE_VERSION)) ?? HOLDEM_DECISIONS.THU_THACH_NGAY.SO_O, ngay, het_han]);
        if (ins.rowCount === 1) { ma = thu; break; }
        // Thua cuộc đua NGÀY (không phải trùng mã) ⇒ đọc dòng người kia vừa tạo.
        const lai = await pool.query(
          `SELECT ma FROM holdem_ban WHERE loai = 'ngay' AND ngay = $1`, [ngay]);
        if (lai.rows[0]) { ma = lai.rows[0].ma as string; break; }
        // Còn lại là trùng MÃ 5 ký tự (36^5) — thử mã khác.
      }
      if (ma === null) throw new HoldemError(409, 'khong_phat_duoc_ma', 'Chưa dựng được bàn hôm nay — thử lại.');
      return c.json(await dungBan(ma, uid(actor)));
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  // ── Shop ở lần khảo sát thứ N ───────────────────────────────────────────
  // Trạng thái chung luôn bày shop lượt 0; nút "Khảo sát lại" cần lượt N.
  // Lượt khảo sát bị TRỪ khi nộp vòng (server tính lại từ action_log), nên
  // endpoint này chỉ ĐỌC — gọi bao nhiêu lần cũng không tiêu tài nguyên,
  // và không phải đường lách vì shop tất định theo (seed, vòng, ghế, lượt).
  app.get('/api/v1/holdem/matches/:id/shop', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const t = await layTran(c.req.param('id'), uid(actor));
      const lan = Math.max(0, Math.min(5, Number(c.req.query('lan') ?? 0) | 0));
      const { st } = replay(
        t.seed, t.log, false, t.ghe ?? undefined, t.luat, t.moBangCho, t.duBaoCho, t.soO,
        t.khopCho, t.manCho);
      const nguoi = st.ghe.find((g) => g.id === 'ban')!;
      // D526 — nhịp xen kẽ: đổi lõi một lần mỗi vòng (`doiLoiToiDa`).
      if (lan > doiLoiToiDa(st)) throw new HoldemError(409, 'het_doi_loi', 'Vòng này chỉ đổi lõi được một lần.');
      const conLuot = viKhaoSat(st, nguoi) - chiPhiKhaoSat(st, lan);
      if (conLuot < 0) {
        throw new HoldemError(409, 'het_luot_khao_sat',
          st.gop_xu === true ? 'Không đủ xu để đổi bài.' : 'Bạn hết Lượt khảo sát rồi.');
      }
      return c.json({
        // Cùng bộ lọc lá chết với trạng thái vòng — hai cửa lệch là roll xong
        // lá chết lại hiện về.
        shop: locTheChet(
          bayShop(t.seed, st.vong, 'ban', lan, nguoi.danh_muc, tuyChonShop(st)), nguoi.danh_muc,
          mandateCua(st, nguoi)?.camKhong === true, { max: maxLoiCua(st, nguoi), coLuot: coLuotLoi(st, nguoi) }, mandateCua(st, nguoi)?.camDonBay === true),
        lan_khao_sat: lan,
        luot_con_lai: conLuot,
        // v55 (D409) — lượt mời trait ở lần cuộn `cuon` (chỉ vòng mốc). Không trạng thái: xu trừ lúc chốt vòng, cùng nếp
        // `khao_sat_lai`; hỏi lượt k là phải trả đủ giá cộng dồn tới k khi nộp — không có gì để xem trước miễn phí.
        ...(st.trait_bat === true && laMocTrait(st.vong, st.map.o.length, st)
          ? ((): Record<string, unknown> => {
            const cuon = Math.max(0, Math.min(CHO_TRAIT.CUON_TOI_DA, Number(c.req.query('cuon') ?? 0) | 0));
            return {
              cho_trait: {
                moc: st.vong, lan_cuon: cuon, moi: bayTrait(t.seed, 'ban', st.vong, cuon, nguoi.trait ?? [], khoTraitCua(st), nguoi.vai),
                gia: giaCuon(cuon), xu: nguoi.xu ?? 0, gia_cuon: CHO_TRAIT.GIA_CUON_XU, cuon_toi_da: CHO_TRAIT.CUON_TOI_DA,
              },
            };
          })()
          : {}),
      });
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  /**
   * ── MỞ BẢNG ĐIỆN TỬ (LUẬT 3 — CÓ THU PHÍ) ────────────────────────────────
   * `POST /api/v1/holdem/matches/:id/bang-dien-tu`, body `{ vong }`.
   *
   * POST chứ không GET vì nó TRỪ VỐN và ghi `action_log`: một GET có tác dụng
   * phụ là thứ trình duyệt, proxy, prefetch và nút back đều được phép gọi lại
   * tuỳ ý — mỗi lần như vậy là một lần người chơi mất Vốn mà không bấm gì.
   *
   * ─── VÌ SAO PHẢI LÀ MỘT DÒNG LOG RIÊNG, NGAY BÂY GIỜ ──────────────────────
   * Bảng mở ở ĐẦU vòng, còn dòng vòng chỉ sinh ra khi người chơi nộp quyết định.
   * Đợi client gửi kèm lúc nộp thì đóng tab (hoặc chỉ đơn giản là không nộp) =
   * xem bảng miễn phí, và F5 lại mở được lần nữa. Nên phí phải CÓ THẬT trong
   * nguồn dựng lại trận ngay tại lần mở — xem `MoBangCho`.
   *
   * ─── TRẬN CŨ ─────────────────────────────────────────────────────────────
   * Không cần cổng `balance_version`. Trận tạo trước bản này không có dòng
   * `mo_bang` nào trong log ⇒ `h.mo_bang ?? 0` ⇒ `apPhiMoBang` trả nguyên trạng
   * thái ⇒ replay ra ĐÚNG kết quả trận đó từng có. Cổng phiên bản chỉ cần cho
   * thứ được SUY LẠI lúc replay (hành vi bot — D30); phí bảng thì được ĐỌC TỪ
   * LOG, mà log cũ không có nên không có gì để lệch.
   */
  /**
   * ─── KHỚP LỆNH GIỮA VÒNG (founder 08/08) ────────────────────────────────
   * `POST /api/v1/holdem/matches/:id/khop-lenh`, body `{ vong, lenh: [...] }`.
   *
   * Trước bản này lệnh chỉ khớp GỘP lúc CHỐT VÒNG — người chơi phải lên kế
   * hoạch cả cú đảo danh mục "mù", không thấy tiền về giữa chừng. Founder:
   * *"không có nút chốt mua/bán ngay trong phiên… dẫn đến nhiều lỗi ngớ ngẩn
   * khi chuyển đổi tài sản, phân bổ danh mục"*.
   *
   * Cùng khuôn với phí mở bảng: ghi một ĐUÔI `cho_nop` vào `action_log`, nộp
   * vòng thì gộp vào dòng vòng (`khop_truoc`) rồi đuôi biến mất — `log.length`
   * đếm vòng không đổi, trận cũ không có dòng loại này nên replay nguyên vẹn,
   * KHÔNG cần cổng balance.
   *
   * ⚠ KHÔNG có lợi thế thông tin: ô của vòng này vẫn ÚP lúc khớp — khớp sớm hay
   * khớp lúc chốt nhìn thấy cùng một thứ. Khác biệt duy nhất là UX: bán xong
   * THẤY tiền về rồi mới quyết mua gì.
   * ⚠ HẾT GIỜ thì từ chối: vòng đã đáng lẽ đóng, mọi hành động mới là lách giờ.
   */
  app.post('/api/v1/holdem/matches/:id/khop-lenh', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      await chanTanSuat(userId, 'khop', GIOI_HAN.KHOP_MOI_GIO);
      const body = await c.req.json().catch(() => ({}));
      const vongXin = Number(body?.vong);
      const lenhMoi = chuanHoaLenh(body?.lenh);
      if (!lenhMoi || lenhMoi.length === 0) {
        throw new HoldemError(400, 'lenh_rong', 'Chưa có lệnh nào để khớp.');
      }
      /*
       * KHOÁ CHỐNG ÁP HAI LẦN — xem `MoBangCho.khop_keys`. Kẹp độ dài để một
       * client hỏng không nhét được chuỗi khổng lồ vào `action_log` (log nuôi
       * replay, phình là phình vĩnh viễn).
       */
      const khoa = typeof body?.idempotency_key === 'string'
        && body.idempotency_key.length > 0 && body.idempotency_key.length <= 64
        ? body.idempotency_key as string : null;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // FOR UPDATE — hai cú bấm cùng lúc phải xếp hàng, không cùng đọc một đuôi.
        const t = await layTran(c.req.param('id'), userId, client, true);
        // D480 — màn vòng trước còn chạy ⇒ vòng này chưa mở lệnh; phản hồi khớp mang vị thế sau chốt = lộ kết quả màn.
        if (t.manChuaXong) throw new HoldemError(409, 'man_chua_xong', 'Màn minigame của vòng trước còn đang chạy.');
        if (t.status !== 'dang_choi') {
          throw new HoldemError(409, 'match_closed', 'Trận này đã kết thúc rồi.');
        }
        /*
         * ĐÃ ÁP RỒI ⇒ TRẢ TRẠNG THÁI HIỆN TẠI, KHÔNG ÁP THÊM, KHÔNG BÁO LỖI.
         *
         * Phải đứng TRƯỚC mọi cửa khác: cú gửi lại sau khi server đã áp xong
         * hoàn toàn có thể rơi vào lúc vòng đã hết giờ hoặc trận vừa đóng —
         * ném lỗi ở đó là nói dối, vì lệnh của họ ĐÃ khớp thật. Idempotent
         * đúng nghĩa là "gọi mấy lần cũng ra một kết quả", không phải "lần
         * hai thì báo lỗi".
         */
        if (khoa && t.khopKeys.includes(khoa)) {
          await client.query('ROLLBACK');
          const daCo = replay(
            t.seed, t.log, false, t.ghe ?? undefined, t.luat,
            t.moBangCho, t.duBaoCho, t.soO, t.khopCho, t.manCho).st;
          const bd = daCo.ghe.find((g) => g.id === 'ban')!;
          return c.json({
            ok: true,
            da_ap_truoc_do: true,
            ban: {
              von: bd.von, vi_the: bd.vi_the, vi_the_khong: bd.vi_the_khong ?? {},
            },
          });
        }
        const vong = t.log.length + 1;
        if (vongXin !== vong) {
          throw new HoldemError(409, 'sai_vong',
            `Đang ở vòng ${vong}, không phải ${vongXin}.`);
        }
        if (tranHetHan(t.vongMoLuc, new Date(), vongMienGio(t, vong))) {
          throw LOI_TRAN_HET_HAN();
        }

        const rTruoc = replay(
          t.seed, t.log, false, t.ghe ?? undefined, t.luat,
          t.moBangCho, t.duBaoCho, t.soO, t.khopCho, t.manCho);
        const truoc = rTruoc.st;
        // Hết giờ vòng ⇒ đóng cửa khớp (trừ màn tập miễn giờ). Không có chốt này
        // thì đồng hồ chỉ khoá cú NỘP mà vẫn mở cửa GIAO DỊCH — lách giờ hợp lệ.
        // (cửa này chưa từng truyền `gianLa` — giữ nguyên; chỉ thêm cờ nhịp ngắn, D457)
        const dh = soiDongHo(t.vongMoLuc, vong, truoc.map.o.length, new Date(), themGiayTrait(truoc, vong),
          false, truoc.dong_ho_minigame === true, truoc.nhip_xen_ke === true, truoc.loi_chon_truoc === true);
        if (dh.qua_han_vong && !vongMienGio(t, vong)) {
          throw new HoldemError(409, 'het_gio',
            'Vòng này đã hết giờ — lệnh sẽ không khớp nữa. Chốt vòng để đi tiếp nhé.');
        }
        const nguoi = truoc.ghe.find((g) => g.id === 'ban')!;
        if (nguoi.da_chay) {
          throw new HoldemError(409, 'da_chay', 'Bạn đã cháy tài khoản.');
        }

        /*
         * Thử áp trên CHÍNH trạng thái tất định người chơi đang thấy. Lỗi thì
         * NÓI RA và không ghi gì — nút bấm phải có câu trả lời, không phải một
         * cú nuốt im lặng (nếp `loi_von`).
         */
        const thu = apLenhMocNav(truoc, 'ban', lenhMoi);
        if (thu.loi) {
          /*
           * D342 — LÝ DO ĐI RIÊNG, BẰNG MÃ (D26: server trả ID, chữ ở client). Bản cũ nhét mã thô
           * vào câu ("Lệnh không khớp được: qua_tran_khong.") và màn in nguyên câu đó ra.
           */
          throw new HoldemError(409, 'lenh_khong_khop',
            'Lệnh không khớp được.', { ly_do: thu.loi });
        }
        /*
         * ⚠ NO-OP CŨNG LÀ TỪ CHỐI. `giaiLenhMoc` giải "mua khi 0 tiền" thành
         * 0 lệnh và trả ok (đúng cho đường CHỐT VÒNG: mốc trên ví rỗng =
         * "không làm gì"). Nhưng đây là NÚT BẤM — trả 200 mà không đổi một
         * chip là cú nuốt im lặng, và đuôi/`events` sẽ chép một cú khớp không
         * khớp gì. Engine trả CÙNG THAM CHIẾU st khi không có lệnh nào chạy.
         */
        if (thu.st === truoc) {
          throw new HoldemError(409, 'lenh_khong_khop',
            'Không có gì để khớp: không đủ tiền mặt hoặc không có vị thế để bán.');
        }

        // Ghi ĐÈ đuôi bằng MỘT dòng chuẩn — giữ nguyên phí bảng đang chờ.
        const logMoi: DongLog[] = [...t.log, {
          vong, mo_bang: t.moBangCho, cho_nop: true,
          ...(t.duBaoCho ? { du_bao: true } : {}),
          khop: [...t.khopCho, lenhMoi],
          // Khoá đi CÙNG transaction với cú áp — ghi rời là có cửa áp xong mà
          // khoá chưa kịp lưu, tức đúng lỗ đang vá.
          ...(khoa ? { khop_keys: [...t.khopKeys, khoa] } : {}),
        }];
        await client.query(
          'UPDATE holdem_matches SET action_log = $1 WHERE match_id = $2',
          [JSON.stringify(logMoi), t.matchId]);

        // A9: cú khớp CÓ TIỀN ⇒ `events`, cùng transaction (A7).
        await client.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type,
                               value_num, value_json, state_snapshot_json)
           VALUES ($1, 'holdem', $2, 'hd_khop_lenh', $3, $4, NULL)`,
          [userId, t.matchId, lenhMoi.length,
            JSON.stringify({ vong, lenh: lenhMoi })]);

        await client.query('COMMIT');
        const banSau = thu.st.ghe.find((g) => g.id === 'ban')!;
        return c.json({
          ok: true,
          ban: {
            von: banSau.von,
            vi_the: banSau.vi_the,
            vi_the_khong: banSau.vi_the_khong ?? {},
          },
        });
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      if (e instanceof HoldemError) {
        return c.json({ error: e.code, message: e.message, ...(e.chiTiet ?? {}) }, e.status);
      }
      throw e;
    }
  });

  /*
   * ─── TÍNH CÁCH TÀI CHÍNH (04 §3; founder 08/08 chốt hướng B2C) ────────────
   * Trả ID + SỐ cho CHÍNH CHỦ (A3.8 — không bảng đua); câu chữ + emoji client
   * dựng. Tính từ events + map, không replay — xem `holdem/insight.ts`.
   */
  app.get('/api/v1/holdem/me/tinh-cach', ...guard, async (c) => {
    const actor = c.get('actor');
    const hoSo = await hoSoTinhCachCuaUser(pool, uid(actor));
    return c.json(hoSo);
  });

  /*
   * ─── SỔ TAY KHÁI NIỆM (16/08, "vá lối chơi" tầng 3) ───────────────────────
   * Cùng luật với "HÔM NAY BẠN VỪA CHẠM" (`khoanh_khac.ts`) nhưng gom qua MỌI
   * trận đã xong: khái niệm nào tôi đã gặp, mấy trận, lần đầu khi nào, cú nặng
   * nhất bao nhiêu. Chỉ ID + SỐ cho CHÍNH CHỦ (A3.8); câu chữ ở client, kênh
   * đọc thuần `api/tinh_cach` (tường lửa D24). Đọc `hd_chot_phien` (append-only)
   * — không replay, không event mới; trận đã xong = dòng `holdem_results`
   * (thước D62/D86), nên trận bỏ dở KHÔNG vào sổ dù có dây chuyền.
   */
  app.get('/api/v1/holdem/me/so-tay', ...guard, async (c) => {
    const actor = c.get('actor');
    const userId = uid(actor);
    const soTran = await demTranXong(pool, userId);
    /*
     * MỘT câu: trận đã xong (thứ tự cũ → mới) nối với dây chuyền từng vòng.
     * `context_id` là text nên ép `match_id::text` ở vế join — index
     * `events(context_id)` (A6) vẫn dùng được vì vế trái không đổi.
     */
    const { rows } = await pool.query(
      `SELECT r.match_id, r.created_at, e.value_json
         FROM holdem_results r
         JOIN events e
           ON e.context_type = 'holdem' AND e.context_id = r.match_id::text
          AND e.user_id = r.user_id AND e.action_type = 'hd_chot_phien'
        WHERE r.user_id = $1
        ORDER BY r.created_at ASC, (e.value_json->>'vong')::int ASC, e.ts ASC`,
      [userId]);
    const theoTran = new Map<string, { luc: Date | null; chains: MatXich[][] }>();
    for (const r of rows) {
      const id = String(r.match_id);
      let t = theoTran.get(id);
      if (!t) {
        t = { luc: (r.created_at as Date | null) ?? null, chains: [] };
        theoTran.set(id, t);
      }
      const v = Number((r.value_json as { vong?: unknown })?.vong);
      const chain = (r.value_json as { chain?: unknown })?.chain;
      if (!Number.isInteger(v) || v < 1 || !Array.isArray(chain)) continue;
      t.chains[v - 1] = chain as MatXich[];
    }
    const tran = [...theoTran.values()].map((t) => ({
      luc: t.luc,
      chains: Array.from({ length: t.chains.length }, (_, i) => t.chains[i] ?? []),
    }));
    /*
     * 12/09 (Q3 — LIÊN KẾT NHÌN THẤY) — SỔ LIÊN HỆ: cái kéo nào đã SỐNG QUA. Đọc
     * seed + cỡ bàn + luật của trận đã xong (`holdem_matches`, thứ tự cũ → mới) rồi
     * `sinhMap` lại — tất định, không replay, không event mới (`server/holdem/lien_he.ts`).
     * Trận không ghi `so_o` (trước D31) ⇒ cỡ mặc định, cùng nếp `layTran`.
     */
    const { rows: tranSeed } = await pool.query(
      `SELECT m.seed, m.so_o, m.balance_version, r.created_at
         FROM holdem_results r
         JOIN holdem_matches m ON m.match_id = r.match_id
        WHERE r.user_id = $1
        ORDER BY r.created_at ASC`,
      [userId]);
    const lienHe = soLienHe(tranSeed.map((r) => ({
      luc: (r.created_at as Date | null) ?? null,
      seed: Number(r.seed),
      so_o: Number(r.so_o ?? HOLDEM_DECISIONS.MAP_SIZE),
      balance_version: String(r.balance_version),
    })));
    return c.json({ so_tran: soTran, khai_niem: soTayKhaiNiem(tran), lien_he: lienHe });
  });

  /*
   * ─── THẺ NĂNG LỰC (D323) — thẻ theo NGƯỜI, gộp từ thẻ theo TỪNG TRẬN ───────
   * Làm tươi kho hành vi trước khi đọc (cùng nếp `/me/tinh-cach`/`capNhatCuaUser`),
   * chấm từng trận đã có dòng bằng hàm THUẦN (`chamNangLucTran`), rồi gộp qua
   * seed (`gopNangLuc`, nơi bậc `chung_minh` mới xuất hiện). Chỉ ID + SỐ (A10,
   * D26) — tên khung ngoài + câu chữ hiển thị ở client.
   */
  app.get('/api/v1/holdem/me/nang-luc', ...guard, async (c) => {
    const actor = c.get('actor');
    const userId = uid(actor);
    /*
     * D404 — CỬA 2 (chưa nộp PHIẾU 2 ⇒ chưa xem thẻ) phải đứng ở MỌI đường ra thẻ, không riêng màn kết.
     * D370 giấu thẻ ở `/autopsy`; nhưng Hồ sơ → Thẻ (và Gương · Lộ trình của PFM) đọc qua đường này và
     * vẫn trả đủ bậc ⇒ tester bấm sang Hồ sơ là thấy thẻ trước khi nhớ lại. Cùng điều kiện với `giauThe`
     * ở `/autopsy` (`thu_chi_tiet` ∧ `buoi_do_buoc < 3`); người thường không chạm nhánh này.
     * ⚠ Trả 200 + cờ, không 4xx: ba màn đang gọi hook này chỉ có nhánh "có data / không", một 4xx là im lặng.
     */
    const { rows: bdThe } = await pool.query(
      `SELECT thu_chi_tiet, buoi_do_buoc FROM users WHERE user_id = $1`, [userId]);
    if (bdThe[0]?.thu_chi_tiet === true && Number(bdThe[0]?.buoi_do_buoc ?? 0) < 3) {
      return c.json({ formula_version: NANG_LUC_FORMULA_VERSION, so_de: 0, nang_luc: [], the_dang_giu: true });
    }
    await capNhatCuaUser(pool, userId, hanhViDeps);
    const vongs = await docVongCuaUser(pool, userId);
    const theoTran = new Map<string, HangHanhVi[]>();
    for (const v of vongs) {
      const ds = theoTran.get(v.match_id);
      if (ds) ds.push(v); else theoTran.set(v.match_id, [v]);
    }
    const matchIds = [...theoTran.keys()];
    // MỘT câu SELECT theo owner cho seed + ended_at — `docVongCuaUser` đã lọc
    // đúng trận của user này rồi, đây chỉ là tra thêm hai cột `hanh_vi_vong`
    // không giữ (nó không phải bảng của MỘT trận, không có chỗ cho seed).
    const { rows: meta } = await pool.query(
      `SELECT match_id, seed, ended_at FROM holdem_matches
         WHERE owner_user_id = $1 AND match_id = ANY($2::uuid[])`,
      [userId, matchIds]);
    const metaById = new Map(meta.map((r) => [String(r.match_id), r]));
    const tran = matchIds.map((id) => {
      const m = metaById.get(id);
      return {
        seed: Number(m?.seed ?? 0),
        luc: m?.ended_at ? new Date(m.ended_at as string | Date).toISOString() : null,
        the: chamNangLucTran(theoTran.get(id)!),
      };
    });
    const gop = gopNangLuc(tran);
    // D396 — chỉ năng lực đang HIỆN (N2 ẩn: xem `NANG_LUC_AN`); phép gộp vẫn chạy trên đủ ba.
    return c.json({ ...gop, nang_luc: chiNangLucHien(gop.nang_luc) });
  });

  /*
   * ─── TÍN HIỆU GAME CHO PFM (D324) ─────────────────────────────────────────
   * Mặt "TRONG TRẬN" của gương + điền sẵn ⚑ ở phỏng vấn. Không chờ gói (thẻ tính cách cần
   * 10 trận) — trả ngay từ trận đầu kèm cỡ mẫu; chỉ số thiếu mẫu là null (D62). Chỉ ID +
   * SỐ cho CHÍNH CHỦ (A3.8). Client chỉ gọi khi cửa `noi_game` mở — cổng ở màn, vì đây là
   * dữ liệu CỦA người chơi trả về CHO người chơi; cửa canh việc GHÉP vào nghiên cứu
   * (`server/pfm/tin_hieu_ky.ts`), không canh việc tự xem trận của mình.
   */
  app.get('/api/v1/holdem/me/tin-hieu', ...guard, async (c) => {
    const actor = c.get('actor');
    const userId = uid(actor);
    await capNhatCuaUser(pool, userId, hanhViDeps);
    return c.json(tinhTinHieu(await docVongCuaUser(pool, userId)));
  });

  app.post('/api/v1/holdem/matches/:id/bang-dien-tu', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      await chanTanSuat(userId, 'bang', GIOI_HAN.BANG_MOI_GIO);
      const body = await c.req.json().catch(() => ({}));
      const vongXin = Number(body?.vong);

      /*
       * MỘT TRANSACTION cho cả ba việc: đọc-khoá trận, ghi phí vào `action_log`,
       * ghi event. A7 cấm fire-and-forget event, mà ở đây còn nặng hơn — phí đã
       * trừ mà event rớt là mất vĩnh viễn tín hiệu "chịu trả tiền ở tình huống
       * nào" (events append-only, không backfill được).
       *
       * `FOR UPDATE` vì hai cú bấm cùng lúc (double-click, hoặc hai tab) đọc
       * cùng một `moBangCho = 0` thì cả hai đều thấy mình là lần mở đầu tiên.
       */
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const t = await layTran(c.req.param('id'), userId, client, true);
        if (t.status !== 'dang_choi') {
          throw new HoldemError(409, 'match_closed', 'Trận này đã kết thúc rồi.');
        }
        /*
         * v57 (D456) — LUẬT CỦA TRẬN NÀY KHÔNG BÁN BẢNG ĐIỆN TỬ. Chặn TRƯỚC mọi thứ khác: không nhìn vòng, không nhìn Vốn,
         * không ghi phí, không ghi event. `luat_tat` là mã lỗi engine đã dùng cho cơ chế tắt (sổ tiết kiệm).
         */
        if (t.luat.khongBangDienTu === true) {
          throw new HoldemError(403, 'luat_tat', 'Luật của trận này không có Bảng điện tử.');
        }
        const vong = t.log.length + 1;
        if (vongXin !== vong) {
          throw new HoldemError(409, 'sai_vong',
            `Đang ở vòng ${vong}, không phải ${vongXin}.`);
        }
        /*
         * D38 — TRẬN QUÁ HẠN THÌ KHÔNG BÁN THÔNG TIN NỮA.
         *
         * Thiếu chốt này là bán một món hàng dùng không được: `/rounds` ngay sau đó
         * trả `tran_het_han`, Vốn đã trừ mà vòng thì không nộp được. Thu tiền cho
         * một quyết định người chơi không còn quyền ra là lỗi tệ hơn hẳn từ chối.
         * CÙNG hàm `tranHetHan` với ba đường kia — không có công thức thứ hai.
         */
        if (tranHetHan(t.vongMoLuc, new Date(), vongMienGio(t, vong))) {
          throw LOI_TRAN_HET_HAN();
        }

        // Trạng thái NGƯỜI CHƠI ĐANG NHÌN THẤY: đã gồm lần mở đã trả phí của
        // chính vòng này (`t.moBangCho`), nên `von` dưới đây là Vốn thật lúc bấm.
        const rTruoc = replay(
          t.seed, t.log, false, t.ghe ?? undefined, t.luat,
          t.moBangCho, t.duBaoCho, t.soO, t.khopCho, t.manCho);
        const truoc = rTruoc.st;
        /*
         * HẠN VÒNG cũng đóng cửa bán thông tin (rà đồng hồ 08/08): quá ân hạn
         * thì mọi quyết định của vòng này sắp bị vứt (`/rounds` chốt hộ GIỮ
         * NGUYÊN) — thu phí cho một quyết định không còn quyền ra là bán hàng
         * dùng không được, cùng lý lẽ với chốt `tranHetHan` ngay trên. Cùng
         * điều kiện với cửa KHỚP LỆNH, trừ màn tập miễn giờ.
         */
        // v32 — THẺ GIỜ cũng nới cửa bán thông tin: cùng một cửa hỏi với
        // `/rounds` và với payload, không có phép tính hạn thứ hai.
        const dhBang = soiDongHo(t.vongMoLuc, vong, truoc.map.o.length, new Date(),
          themGiayKyNgo(rTruoc.kyNgo.dacQuyen, vong) + themGiayTrait(truoc, vong), false, truoc.dong_ho_minigame === true,
          truoc.nhip_xen_ke === true, truoc.loi_chon_truoc === true);
        if (dhBang.qua_han_vong && !vongMienGio(t, vong)) {
          throw new HoldemError(409, 'het_gio',
            'Vòng này đã hết giờ — chốt vòng để đi tiếp rồi hãy mở bảng.');
        }
        const nguoi = truoc.ghe.find((g) => g.id === 'ban')!;
        if (nguoi.da_chay) {
          throw new HoldemError(409, 'da_chay',
            'Bạn đã cháy tài khoản — không còn Bảng điện tử để mở.');
        }

        /*
         * ─── D33 — BA HẠNG GIÁ, VÀ ĐƯỜNG NÂNG HẠNG ────────────────────────────
         *
         * `hangBangCua` suy `luot_song` từ danh mục ĐẦU VÒNG (server, C4): người
         * chơi không khai được mình có thẻ. `du_bao` chỉ bật khi có Lướt Sóng —
         * nấc +30 là nấc CAO HƠN của cùng đặc quyền, không phải món bán rời.
         *
         * ⚠ NÂNG HẠNG PHẢI THU CHÊNH LỆCH, KHÔNG ĐƯỢC MIỄN PHÍ. Luật "mở lại
         * trong cùng vòng thì miễn phí" đúng vì lần hai không bán thêm mẩu tin
         * nào — nhưng nâng từ 80 lên 110 thì CÓ bán thêm (ba tên ô kế). Miễn phí
         * ở đây là mở hạng rẻ rồi bấm lại để lấy hạng đắt, tức nấc +30 tự biến
         * mất mà không ai thấy. Nên phí lần này = giá hạng muốn − giá đã trả.
         */
        const muonDuBao = body?.du_bao === true;
        const hang = hangBangCua(truoc, 'ban', muonDuBao);
        const daTra = t.moBangCho > 0
          ? giaMoBang(hang.luot_song, t.duBaoCho) : 0;
        const giaMuon = giaMoBang(hang.luot_song, hang.du_bao);
        const thieu = Math.max(0, giaMuon - daTra);

        /*
         * MỞ LẠI TRONG CÙNG VÒNG THÌ MIỄN PHÍ, không phải bị từ chối.
         *
         * Nội dung bảng là hàm thuần của (seed, vòng, danh mục) nên lần thứ hai
         * KHÔNG bán thêm một mẩu thông tin nào — thu tiếp là đánh thuế cú bấm lỡ
         * tay và double-submit của client. Trả 409 cũng sai kiểu khác: người chơi
         * ĐÃ trả tiền cho vòng này, chặn họ xem lại là bán hàng rồi giữ hàng.
         * Trần nằm ở `BANG_DIEN_TU.TOI_DA_MOI_VONG`, đọc từ config chứ không
         * ghim số 1 ở đây.
         */
        /*
         * v32 — PHIẾU MỞ BẢNG: miễn TRỌN phí của vòng này, mọi hạng.
         *
         * ⚠ Đọc từ `replay` (`rTruoc.kyNgo.phieu`) chứ không đếm lại ở đây —
         * `phieuConLai` là MỘT nguồn cho cả chỗ TRỪ tiền (replay) lẫn chỗ BÁO
         * GIÁ (endpoint này). Hai bản cài đặt sẽ trôi, và cú trôi ở đây biểu
         * hiện là "màn báo miễn phí, Vốn vẫn bị trừ" (lớp lỗi D67).
         * ⚠ Miễn cả nấc NÂNG HẠNG: replay miễn theo VÒNG chứ không theo hạng,
         * nên thu chênh lệch ở đây là thu một khoản replay không hề trừ.
         */
        const mienPhiKyNgo = rTruoc.kyNgo.phieu > 0;
        const lanDau = t.moBangCho < BANG_DIEN_TU.TOI_DA_MOI_VONG;
        const conThuPhi = !mienPhiKyNgo && (lanDau || thieu > 0);
        if (conThuPhi && nguoi.von < thieu) {
          throw new HoldemError(409, 'khong_du_von',
            `Mở Bảng điện tử hạng này tốn ${thieu} Vốn, bạn còn ${nguoi.von}.`);
        }

        // Phiếu KHÔNG làm mất lần mở: `mo_bang` vẫn phải tăng, nếu không thì
        // vòng sau người chơi mở lại như chưa từng mở (và phiếu không bao giờ
        // bị tiêu — nó đếm theo VÒNG CÓ MỞ, xem `phieuConLai`).
        const soLan = lanDau ? t.moBangCho + 1 : t.moBangCho;
        // Hạng ĐÃ TRẢ sau lần gọi này: một chiều, không hạ lại được.
        const duBaoSau = t.duBaoCho || hang.du_bao;
        // Phí THẬT SỰ thu lần này = chênh lệch hạng. `phiMoBang` bên trong
        // `apPhiMoBang` kẹp theo Vốn nên không bao giờ đẩy xuống âm.
        const phi = conThuPhi ? Math.min(nguoi.von, thieu) : 0;
        // Phải GHI LOG cả khi phiếu miễn phí: `mo_bang` là thứ tiêu phiếu và là
        // thứ mở nội dung bảng ở vòng sau. `ghiLog` ≠ `conThuPhi` từ v32.
        const ghiLog = conThuPhi || (mienPhiKyNgo && (lanDau || thieu > 0));
        const sau = ghiLog
          ? replay(t.seed, t.log, false, t.ghe ?? undefined,
            t.luat, soLan, duBaoSau, t.soO, t.khopCho, t.manCho).st
          : truoc;

        if (ghiLog) {
          /*
           * Ghi ĐÈ mọi đuôi chờ nộp bằng đúng MỘT dòng chuẩn của vòng hiện tại.
           * Dồn thành một dòng (thay vì `[...raw, dòng mới]`) để đuôi sót lại của
           * vòng khác — thứ `layTran` vốn đã bỏ qua — không nằm mãi trong log rồi
           * một ngày nào đó có người đọc lại và trừ nhầm.
           */
          const logMoi: DongLog[] = [...t.log, {
            vong, mo_bang: soLan, cho_nop: true,
            ...(duBaoSau ? { du_bao: true } : {}),
            // ⚠ GIỮ các nhóm KHỚP GIỮA VÒNG đang chờ — ghi đè đuôi mà quên
            // trường này là lệnh đã khớp BỐC HƠI đúng lúc mở bảng (cùng lớp lỗi
            // "phí bốc hơi" mà chính chú thích trên vừa kể).
            ...(t.khopCho.length ? { khop: [...t.khopCho] } : {}),
          }];
          await client.query(
            'UPDATE holdem_matches SET action_log = $1 WHERE match_id = $2',
            [JSON.stringify(logMoi), t.matchId]);
        }

        const bang = dungBangDienTu(sau, 'ban',
          hangBangCua(sau, 'ban', duBaoSau));
        const o = sau.map.o[sau.vong - 1]!;
        await client.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type,
                               value_num, value_json, state_snapshot_json)
           VALUES ($1, 'holdem', $2, 'hd_mo_bang', $3, $4, $5)`,
          [userId, t.matchId, phi,
            /*
             * D33 — LOG HAI HẠNG RIÊNG, ĐỪNG GỘP MỘT TRƯỜNG (chỉ đạo founder).
             * "Ai chịu trả thêm cho thông tin DỰ BÁO vs ai bằng lòng với thông
             * tin MÔ TẢ HIỆN TRẠNG là hai kiểu người khác nhau." Gộp thành một
             * cờ `mo_bang` là mất vĩnh viễn phép phân biệt đó — events
             * append-only, không backfill được.
             */
            JSON.stringify({
              vong, so_lan: soLan,
              hang_sach: hang.luot_song, hang_du_bao: duBaoSau,
            }),
            /*
             * SNAPSHOT GỌN (~200 byte, A7). Ghi ĐÚNG những gì người chơi vừa
             * nhìn thấy, không dump cả `BangDienTu`:
             *  · `von_truoc` — mẫu số để đọc "25 Vốn đắt hay rẻ với người này".
             *  · `tong_rong_bp` + `so_dong_chua_ro` — bức tranh họ mua được, và
             *    họ mua nó trong tình trạng mù bao nhiêu phần.
             *  · `o_kind`/`o_id` — bối cảnh môi trường lúc quyết định chi tiền.
             *    KHÔNG kèm `la_tin_gia`: event cũng không được biết thứ người
             *    chơi chưa được biết, nếu không thì phân tích sau này sẽ vô tình
             *    điều kiện hoá trên thông tin chưa lộ.
             *  · `so_nguoi_song` — D25/R1, bối cảnh đối thủ, bắt buộc từ dòng đầu
             *    vì không backfill được. Bảng đầy đủ đối thủ đã hiện vô điều kiện
             *    ở màn trận (`trangThaiCongKhai`), nên bất biến
             *    `R1-logged ⊆ UI-luôn-hiện` vẫn đúng.
             */
            JSON.stringify({
              vong,
              o_kind: o.kind,
              o_id: o.kind === 'giai_doan' ? o.giai_doan : o.su_kien,
              von_truoc: nguoi.von,
              tong_rong_bp: bang.tong_rong_bp,
              so_dong_chua_ro: bang.so_dong_chua_ro,
              gia_dinh_tin_that: bang.gia_dinh_tin_that,
              so_nguoi_song: sau.ghe.filter((g) => !g.da_chay).length,
            })]);

        await client.query('COMMIT');
        return c.json({
          ...bang,
          /*
           * VỐN SAU KHI TRỪ — server suy, client vẽ (C4). Không gửi thì client
           * còn giữ Vốn cũ tới lần nộp vòng kế: màn hình niêm yết một đằng, số
           * thật một nẻo, đúng ở màn người chơi vừa trả tiền để nhìn cho rõ.
           */
          von: sau.ghe.find((g) => g.id === 'ban')!.von,
          /** Phí THỰC THU lần gọi này — 0 khi mở lại trong cùng vòng. */
          phi_da_thu: phi,
          so_nguoi_song: sau.ghe.filter((g) => !g.da_chay).length,
        });
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  // ── Đọc trạng thái ──────────────────────────────────────────────────────
  app.get('/api/v1/holdem/matches/:id', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      // D481 — màn vòng cuối vừa xong ⇒ khép trận trước khi đọc (no-op ở mọi trường hợp khác).
      const t0 = await layTran(c.req.param('id'), uid(actor));
      if (t0.status === 'dang_choi' && t0.manCho && t0.luat.dongHoMinigame === true) await chotManCuoi(t0.matchId, uid(actor));
      const t = t0.status === 'dang_choi' && t0.manCho ? await layTran(c.req.param('id'), uid(actor)) : t0;
      // D480 — màn vòng vừa nộp còn chạy ⇒ trạng thái TRƯỚC chốt (giấu kết quả vòng tới quyết toán).
      if (t.manChuaXong) {
        const r0 = replay(t.seed, t.log.slice(0, -1), false, t.ghe ?? undefined, t.luat, 0, false, t.soO);
        return c.json({ match_id: t.matchId, status: t.status, ban_ma: t.banMa, ...dtoChoMan(r0, t.seed, t.log.length, t.manKetThuc) });
      }
      const rp = replay(
        t.seed, t.log, false, t.ghe ?? undefined, t.luat, t.moBangCho, t.duBaoCho, t.soO,
        t.khopCho, t.manCho);
      const { st, kyNgo, pcVong } = rp;
      /*
       * MỘT mốc `now` cho cả request (xem `dong_ho.ts` lý do 2). Gọi `new Date()`
       * ở hai chỗ trong cùng một response là hai mốc lệch vài chục ms — đủ để
       * "còn 0,01s" và "đã hết giờ" cùng đúng, và bug đó không tái lập được.
       */
      const now = new Date();
      return c.json({
        match_id: t.matchId,
        status: t.status,
        // BÀN CHUNG (16/08): màn kết đọc mã này để hỏi bảng ĐỘI. null = trận đơn.
        ban_ma: t.banMa,
        /*
         * ⭐⭐ KẾT QUẢ VÒNG VỪA CHỐT — nối 24/08, trả nợ D116.
         *
         * Trước hôm nay chỉ `POST /rounds` mang trường này, nên MỌI thứ nó chở —
         * con số lãi/lỗ của vòng, chuỗi VÌ SAO, phí riêng, SIẾT PHÁP LÝ, gọi ký
         * quỹ — sống đúng một phiên. Nạp lại trang hay vào bằng deep link thì con
         * số biến mất, và vì con số LÀ CÁI NÚT (D119) nên mất luôn đường vào bảng
         * VÌ SAO. D116 khai nợ này rồi để đó.
         *
         * ⚠ VẮNG MẶT khi chưa có vòng nào chốt (`ketQuaCuoi === null` ở vòng 1) —
         * không gửi `null`, cùng hợp đồng với `siet_cua_ban`/`ky_quy_cua_ban`:
         * client cũ không phải phân nhánh.
         * ⚠ Dữ liệu KHÔNG tốn thêm gì: `replay()` ở trên vốn đã tính `ketQuaCuoi`,
         * route này chỉ chưa bao giờ đọc nó.
         */
        ...(rp.ketQuaCuoi ? { ket_qua_vong: dungKetQuaVong(rp.ketQuaCuoi, rp) } : {}),
        // Trận đã đóng thì KHÔNG có vòng nào đang mở ⇒ không có đồng hồ. Trả một
        // đồng hồ đầy cho trận đã xong là mời client vẽ một cái đếm ngược vô nghĩa.
        ...trangThaiCongKhai(st, t.seed,
          t.status === 'dang_choi' ? { vongMoLuc: t.vongMoLuc, now, mienGio: t.mienGio } : undefined,
          kyNgo, pcVong, rp.pcTheoGhe),
        ...lichSuThiTruongDTO(rp, t.seed),
      });
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  /*
   * ⚠ POST /matches/:id/luot ĐÃ GỠ 11/08 — xem D81.
   *
   * Đây là mảnh cuối của cỗ máy CƯỢC TUẦN TỰ mà D40 (27/07) tuyên "CHẾT HẲN".
   * Client chưa bao giờ gọi nó: `moVong()` — cửa duy nhất dẫn tới đây — không
   * có một người gọi nào, nên `choBan` luôn null và `chon()` cũng không bao
   * giờ chạy. Tức endpoint sống, nhận request, CHẠY REPLAY TOÀN TRẬN mỗi lần
   * gọi, và là endpoint DUY NHẤT của cụm holdem không có `chanTanSuat`.
   *
   * Một cửa vào không ai dùng mà lại đắt nhất về CPU là bề mặt tấn công không
   * ai canh — không phải "code thừa cho gọn".
   */


  /**
   * GỬI LẠI MỘT CÚ NỘP ĐÃ COMMIT (SPEC chan-truoc-beta mục 5) — server đã ghi vòng mà client mất phản hồi (mất sóng · hết 15 s chờ)
   * nên gửi lại đúng thân cũ. Trước đây người ấy nhận 409 `sai_vong`/`vong_da_nop` thay vì kết quả cú bấm của chính mình.
   *
   * ⚠ ĐỐI CHIẾU NỘI DUNG, KHÔNG THÊM KHOÁ VÀO `action_log` (agent tự quyết, SPEC mục 6): khoá mới là đổi hình dạng log — chạm golden
   * và replay mọi trận cũ. Là gửi lại khi: `vong` = vòng VỪA nộp (dòng cuối của log) và cùng `hanh_dong`. Dòng cuối do HẾT GIỜ chốt hộ
   * (`tu_dong`) thì thân client đã bị vứt lúc ghi — mọi cú gửi lại của vòng ấy nhận đúng kết quả đã chốt (chính nó tới đây cũng bị vứt).
   * Khác `hanh_dong` ⇒ `null` ⇒ đường thường ⇒ 409 như cũ.
   *
   * Trả `null` hoặc ĐÚNG thân lần một (trừ đồng hồ): dựng lại bằng replay từ log đã lưu, qua `thanNopVong` — cùng hàm cú nộp thật dùng.
   * Trạng thái TRƯỚC chốt (nhánh chờ màn) dựng lại từ các đuôi đã gộp vào dòng vòng (`mo_bang` · `du_bao` · `khop_truoc`) + màn của
   * vòng trước đọc từ `holdem_minigame_man` — đúng các đầu vào `replay` nhận lúc nộp. Không ghi gì: chỉ đọc.
   */
  async function traLoiGuiLai(
    t: Awaited<ReturnType<typeof layTran>>, vong: number, hd: string, xinChotHo: boolean,
  ): Promise<ReturnType<typeof thanNopVong> | null> {
    if (!Number.isInteger(vong) || vong < 1 || vong !== t.log.length) return null;
    const cuoi = t.log[vong - 1]!;
    const hetGio = cuoi.tu_dong === true;
    if (!hetGio && cuoi.hanh_dong !== hd) return null;
    if (!hetGio && xinChotHo) return null;   // xin chốt hộ một vòng đã chốt tay = không phải cùng một cú bấm
    const sau = replay(t.seed, t.log, false, t.ghe ?? undefined, t.luat, 0, false, t.soO);
    const soO = sau.st.map.o.length, xenKe = sau.st.nhip_xen_ke === true;
    let manTruoc: { vong: number; lenh: LenhMan[]; bc?: BoiCanhMan } | undefined;
    if (t.luat.dongHoMinigame === true && vong >= 2 && coManMinigame(vong - 1, soO, xenKe)) {
      const mq = await pool.query('SELECT boi_canh, lenh FROM holdem_minigame_man WHERE match_id = $1 AND vong = $2', [t.matchId, vong - 1]);
      const mr = mq.rows[0] as { boi_canh: BoiCanhMan; lenh: LenhMan[] | null } | undefined;
      manTruoc = { vong: vong - 1, lenh: mr?.lenh ?? [], ...(mr ? { bc: mr.boi_canh } : {}) };
    }
    const truoc = replay(t.seed, t.log.slice(0, -1), false, t.ghe ?? undefined, t.luat,
      cuoi.mo_bang ?? 0, cuoi.du_bao === true, t.soO, cuoi.khop_truoc ?? [], manTruoc);
    const coMan = sau.st.dong_ho_minigame === true && coManMinigame(vong, soO, xenKe);
    const choManCuoi = coMan && daKetThuc(sau.st) && !banDauHang(sau.st);
    const xong = tranKhepLai(sau.st) && !choManCuoi;
    return thanNopVong({
      matchId: t.matchId, banMa: t.banMa, seed: t.seed, vong, truoc, sau, hetGio, xong,
      choMan: coMan && (!xong || choManCuoi),
      // Màn còn chạy ⇒ đúng mốc nó hết; đã hết (hoặc trận đã khép) ⇒ hết ngay, web hỏi lại và nhận vòng mới.
      hetMan: vongMienGio(t, vong + 1) ? undefined : t.manChuaXong ? t.manKetThuc : Date.now(),
      dongHo: t.status === 'dang_choi' && t.vongMoLuc ? { vongMoLuc: t.vongMoLuc, now: new Date(), mienGio: t.mienGio } : undefined,
    });
  }

  // ── Nộp một vòng ────────────────────────────────────────────────────────
  app.post('/api/v1/holdem/matches/:id/rounds', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      await chanTanSuat(uid(actor), 'vong', GIOI_HAN.VONG_MOI_GIO);
      const t = await layTran(c.req.param('id'), uid(actor));
      const body = await c.req.json().catch(() => ({}));
      const vong = Number(body?.vong);
      const hd = String(body?.hanh_dong ?? 'giu_vi_the');
      const xinChotHo = body?.tu_dong === true;
      /*
       * SPEC chan-truoc-beta — GỬI LẠI CÚ NỘP ĐÃ COMMIT. Phải đứng TRƯỚC cửa `match_closed`: cú nộp vòng cuối (hoặc đầu hàng) khép
       * trận, và chính cú gửi lại của nó là cú cần kết quả nhất. Không ghi gì — chỉ đọc lại.
       */
      const lap = await traLoiGuiLai(t, vong, hd, xinChotHo);
      if (lap) return c.json(lap);
      if (t.status !== 'dang_choi') {
        throw new HoldemError(409, 'match_closed', 'Trận này đã kết thúc rồi.');
      }
      /*
       * D38 — MỘT MỐC `now` CHO CẢ REQUEST, lấy ngay đây rồi truyền đi khắp nơi.
       *
       * Gọi `new Date()` ở ba chỗ trong cùng một request là ba mốc lệch nhau vài
       * chục ms — đủ để phép kiểm hạn TRẬN nói "còn sống" trong khi phép kiểm hạn
       * VÒNG ngay sau đó nói "quá hạn", và bug đó không tái lập được (dong_ho.ts).
       */
      const now = new Date();
      // Quá hạn TRẬN thì đóng NGAY tại đây, không đợi tiến trình dọn chạy phút sau:
      // để người chơi bấm thêm vài vòng vào một trận mà tick sắp đóng là hứa suông.
      // CÙNG hàm `tranHetHan` mà tick dùng — không có công thức thứ hai.
      if (tranHetHan(t.vongMoLuc, now, vongMienGio(t, t.log.length + 1))) {
        await dongTranQuaHan(pool, t.matchId, uid(actor));
        throw LOI_TRAN_HET_HAN();
      }

      if (vong !== t.log.length + 1) {
        throw new HoldemError(409, 'sai_vong',
          `Đang ở vòng ${t.log.length + 1}, không phải ${vong}.`);
      }
      if (!['giu_vi_the', 'tang_cam_ket', 'cat_lo', 'dung_ngoai', 'dau_hang'].includes(hd)) {
        throw new HoldemError(400, 'hanh_dong_la', 'Hành động không hợp lệ.');
      }
      /*
       * 22/08 — CLIENT XIN CHỐT HỘ (`tu_dong: true`): đồng hồ client chạm 0 ⇒ nộp
       * NGAY thay vì chờ hết 8s ân hạn + 2s đệm (10s màn đứng im "HẾT GIỜ" mỗi
       * vòng — founder: *"đếm xong không lật bài tiếp theo"*). Cờ này chỉ là
       * LỜI XIN: server soi đồng hồ của CHÍNH NÓ — đã qua mốc ⇒ xử như hết giờ
       * (vứt body, dán `tu_dong`, đúng luật D38); chưa qua (lệch đồng hồ) ⇒ 409
       * `chua_het_gio` kèm số giây để client hẹn lại. Cờ dữ liệu vẫn do server quyết.
       * (`xinChotHo` đọc ở đầu handler — cửa gửi lại cũng cần nó.)
       */
      const khaoSatLai = Math.max(0, Math.min(5, Number(body?.khao_sat_lai ?? 0) | 0));
      /*
       * ⚠⚠ BỐ CỤC LÀ MỘT BIẾN CỦA HÀNH VI, KHÔNG PHẢI CHUYỆN TRANG TRÍ.
       *
       * Trên màn ngang, shop đứng thường trực CẠNH bản đồ — người chơi thấy thẻ,
       * map và đối thủ CÙNG LÚC. Trên điện thoại, mở shop là che hết. Hai người
       * ra cùng một quyết định từ hai lượng thông tin khác nhau.
       *
       * Không ghi cờ này thì mọi so sánh hành vi của mùa 0.0 mang một BIẾN ẨN
       * không ai gỡ ra được: "người này đọc thị trường giỏi hơn" lẫn hẳn với
       * "người này nhìn thấy nhiều hơn". Và `events` append-only (A3.3) nên
       * KHÔNG gắn nhãn lại được về sau — phải có TRƯỚC người chơi màn ngang đầu tiên.
       *
       * Danh sách trắng chứ không nhận chuỗi tuỳ ý (cùng kỷ luật `chi_tiet` của
       * A9): giá trị lạ rơi về `null` = "không biết", chứ không bịa ra một nhóm.
       */
      const boCuc: 'doc' | 'ngang' | null =
        body?.bo_cuc === 'ngang' ? 'ngang' : body?.bo_cuc === 'doc' ? 'doc' : null;
      /*
       * D93 — lời khai sự cố. Đọc ở đây (TRƯỚC khi body bị vứt vì hết giờ) vì
       * đây chính là trường phải SỐNG SÓT qua cú vứt đó: nó tả vì sao body đến
       * muộn. Chỉ ghi khi `hetGio` — xem chỗ dựng dòng log bên dưới.
       */
      const suCoKhai = chuanHoaSuCoKhai(body?.su_co_khai);
      /*
       * Trần THÔ ở tầng nhận: 1 Chiến thuật + tối đa `TAI_SAN_MOI_VONG` Tài sản.
       *
       * ⚠ Đây chỉ là lưới chắn rác, KHÔNG phải chỗ cưỡng chế luật. Trần THẬT
       * (có phân biệt loại thẻ, có xét đặc quyền Đa Dạng Hoá của đúng ghế đó ở
       * đúng vòng đó) nằm trong `replay` — chỗ duy nhất biết danh mục đầu vòng.
       * Kiểm hai lần bằng hai công thức là dựng nguồn chân lý thứ hai; ở đây cố
       * ý nới rộng để không bao giờ chặn nhầm một lệnh hợp lệ.
       */
      const muaThe = chuanHoaMua(body?.mua);
      if (muaThe.length > DAC_QUYEN.DA_DANG_HOA.TAI_SAN_MOI_VONG + 1) {
        throw new HoldemError(400, 'mua_qua_nhieu',
          'Mỗi vòng chỉ lấy tối đa 2 thẻ Tài sản và 1 thẻ Chiến thuật.');
      }
      const them = Math.max(0, Number(body?.them ?? 0) | 0);
      const chuoiCuoc = chuanHoaChuoiCuoc(body?.cuoc);

      // Trạng thái TRƯỚC khi giải quyết — đây là thứ người chơi ĐANG NHÌN THẤY
      // lúc bấm, nên là thứ phải ghi vào event (R1). Gồm cả phí bảng đã trả ở
      // đầu vòng: bỏ `moBangCho` ra là `opponent_fx_state['ban']` ghi lại một
      // mức Vốn chưa từng hiện trên màn hình nào.
      const truoc = replay(
        t.seed, t.log, false, t.ghe ?? undefined, t.luat, t.moBangCho, t.duBaoCho, t.soO,
        t.khopCho, t.manCho);
      /*
       * D525 — trận đã chạy hết vòng (khung minigame: vòng cuối đã nộp, chờ màn cuối khép trận — `chotManCuoi`) ⇒ không còn vòng nào để
       * nộp. Trước đây cú nộp vòng soVong + 1 lọt qua phép kiểm `sai_vong` (log mới dài soVong) rồi nổ trong replay ("vượt quá map") ⇒ 500.
       */
      if (daKetThuc(truoc.st)) throw new HoldemError(409, 'tran_da_het', 'Trận đã hết vòng — đang chờ màn cuối khép trận.');
      const doiThuLucQuyetDinh = bangDoiThu(
        truoc.st, t.seed, truoc.kyNgo.lan, truoc.pcTheoGhe);

      /*
       * ─── D38 — CƯỠNG CHẾ HẠN VÒNG, Ở SERVER VÀ CHỈ Ở SERVER (C4) ─────────────
       *
       * Đến sau hạn (đã trừ ân hạn) thì nội dung người chơi gửi lên KHÔNG được áp:
       * áp nó là bán được thời gian — đóng tab, ngồi nghĩ mười phút rồi mới bấm,
       * trong khi luật của trò này là quyết định dưới sức ép đồng hồ.
       *
       * ⚠ `soO` LẤY TỪ MAP THẬT (`truoc.st.map.o.length`), không phải hằng số mặc
       * định: từ D34 thời lượng pha chọn bài co theo cỡ map, nên gõ cỡ mặc định
       * vào đây là hạn SAI ở hai trong ba cỡ bàn — và sai theo hướng cắt sớm.
       *
       * ⚠ MỐC MỞ BẢNG VẪN GIỮ (`t.moBangCho`). Người chơi đã trả tiền xem bảng ở
       * đầu vòng rồi mới hết giờ; bỏ nó ra là hoàn phí lặng lẽ, tức xem bảng miễn
       * phí bằng cách ngồi im — đúng đường lách mà LUẬT 3 dựng lên để chặn.
       */
      /*
       * v32 — THẺ GIỜ cộng vào ĐÂY nữa, không chỉ vào payload. Hai chỗ lệch
       * nhau nghĩa là màn hiện "còn 8 giây" trong khi server đã chốt hộ — lớp
       * lỗi tệ nhất của cụm đồng hồ (D53/D76), và nạn nhân mất một lượt quyết
       * định mà không hiểu vì sao. `themGiayKyNgo` là MỘT nguồn cho cả hai.
       */
      const dongHoVong = soiDongHo(t.vongMoLuc, vong, truoc.st.map.o.length, now,
        themGiayKyNgo(truoc.kyNgo.dacQuyen, vong) + themGiayTrait(truoc.st, vong), false, truoc.st.dong_ho_minigame === true,
        truoc.st.nhip_xen_ke === true, truoc.st.loi_chon_truoc === true);
      // Màn tập miễn giờ: KHÔNG chốt hộ dù mốc đã trôi — người mới đang đọc
      // lời Oracle, không phải đang rê giờ. Cùng một cửa hỏi với payload.
      if (xinChotHo && !vongMienGio(t, vong) && !dongHoVong.qua_moc_vong) {
        throw new HoldemError(409, 'chua_het_gio',
          `Đồng hồ server còn ${dongHoVong.con_lai_s}s — chưa tới lúc chốt hộ.`);
      }
      const hetGio = (dongHoVong.qua_han_vong || (xinChotHo && dongHoVong.qua_moc_vong))
        && !vongMienGio(t, vong);
      /*
       * D475 — màn của vòng trước còn chạy thì CHƯA nộp vòng này được: nộp là chốt NAV đầu vòng, mà phần màn còn lại chưa xảy ra (người chơi
       * đóng màn rồi bấm nộp sớm thì kết quả màn sẽ không bao giờ vào trận). Hạn vòng đã gồm cả màn (D473) nên chốt hộ luôn tới SAU màn.
       */
      if (t.manChuaXong && !hetGio) {
        throw new HoldemError(409, 'man_chua_xong', 'Màn minigame của vòng trước còn đang chạy.');
      }
      const hdApDung = hetGio
        ? HANH_DONG_HET_GIO[NUOC_HET_GIO.hanh_dong]
        : hd as HanhDongVong['hanh_dong'];
      const themApDung = hetGio ? 0 : them;

      /*
       * ⚠ `mo_bang` GỘP VÀO DÒNG VÒNG (do `dongVongTuBody` lo) là BẮT BUỘC, không
       * phải tối ưu: UPDATE bên dưới ghi đè `action_log` bằng `log`, tức xoá luôn
       * đuôi `MoBangCho`. Thiếu là phí mở bảng BỐC HƠI đúng lúc người chơi nộp
       * vòng — không lỗi, không test đỏ, và LUẬT 3 chỉ còn là văn bản.
       */
      // v55 (D409) — TRAIT: chỉ ở vòng mốc, nằm trong lượt mời (cùng lần cuộn), cân đúng 0, đủ xu; CHỐT LỜI: cần lá Lướt
      // Sóng. Cổng tắt ⇒ lột khỏi body (không ghi vào log của một trận không có luật ấy).
      const banTruoc = truoc.st.ghe.find((g) => g.id === 'ban')!;
      // D526 — trần đổi lõi theo luật trận (nhịp xen kẽ: 1). Web khoá nút; tới đây là client cũ/curl ⇒ nói rõ thay vì bỏ qua im.
      if (!hetGio && khaoSatLai > doiLoiToiDa(truoc.st)) {
        throw new HoldemError(409, 'het_doi_loi', 'Vòng này chỉ đổi lõi được một lần.');
      }
      const traitXin = hetGio ? null : chuanHoaTrait(body?.trait);
      if (traitXin && truoc.st.trait_bat === true) {
        if (!laMocTrait(vong, truoc.st.map.o.length, truoc.st)) {
          throw new HoldemError(409, 'khong_phai_moc', 'Vòng này không mở chợ trait.');
        }
        const moi = bayTrait(t.seed, 'ban', vong, traitXin.cuon, banTruoc.trait ?? [], khoTraitCua(truoc.st), banTruoc.vai);
        if (!traitXin.lay.every((id) => moi.includes(id))) {
          throw new HoldemError(400, 'trait_ngoai_luot', 'Trait không nằm trong lượt mời này.');
        }
        if (!canHopLe(traitXin.lay)) throw new HoldemError(400, 'trait_lech_can', 'Phần lấy phải cân đúng 0 điểm.');
        // v55 (D411) — ví gộp: đổi bài shop và cuộn chợ cùng rút từ MỘT ví xu ⇒ phải đủ cho CẢ HAI.
        const daDoiBai = truoc.st.gop_xu === true ? chiPhiKhaoSat(truoc.st, khaoSatLai) : 0;
        if (giaCuon(traitXin.cuon) + daDoiBai > (banTruoc.xu ?? 0)) {
          throw new HoldemError(409, 'thieu_xu', 'Không đủ xu cho số lần cuộn.');
        }
      }
      const chotLoiXin = hetGio ? null : chuanHoaChotLoi(body?.chot_loi);
      if (chotLoiXin && truoc.st.luot_song_moi === true && !banTruoc.danh_muc.chien_thuat.includes('luot_song')) {
        throw new HoldemError(400, 'can_la_luot_song', 'Chốt lời trong ô cần lá Lướt Sóng.');
      }
      const bodyV55 = {
        ...((body ?? {}) as Record<string, unknown>),
        ...(truoc.st.trait_bat === true ? {} : { trait: undefined }),
        ...(truoc.st.luot_song_moi === true ? {} : { chot_loi: undefined }),
      };
      const log: HanhDongLog[] = [
        ...t.log,
        {
          // Hết giờ ⇒ dựng dòng từ BODY RỖNG, không phải từ body client: mua thẻ,
          // gắn thẻ, đảo, khoá, short và chuỗi cược đều là quyết định của vòng đã
          // đóng. Lọc từng trường một thì lần thêm trường thứ tám sẽ quên một cái.
          ...dongVongTuBody(vong, hetGio ? {} : bodyV55,
            { soLan: t.moBangCho, duBao: t.duBaoCho, khop: t.khopCho }, hdApDung, themApDung,
            // v32 — lọc theo ĐÚNG bộ đã MỜI (D88: sinh theo hồi, suy từ replay).
            {
              soO: truoc.st.map.o.length, bat: truoc.st.ky_ngo === true,
              moi: truoc.kyNgo.lan.find((l) => l.vong === vong)?.moi,
            }),
          ...(hetGio ? { tu_dong: NUOC_HET_GIO.tu_dong } : {}),
          // D93 — nhãn "mất lượt vì hệ thống" đi CÙNG `tu_dong`, không bao giờ một mình.
          ...(hetGio && suCoKhai ? { su_co_khai: suCoKhai } : {}),
          // D475 — kết quả màn vòng trước ĐÃ áp ở đuôi `truoc` (người chơi đặt lệnh trên NAV đó) ⇒ chép nguyên số vào dòng vòng.
          ...(truoc.mgCho && Object.keys(truoc.mgCho).length ? { mg: truoc.mgCho } : {}),
        },
      ];
      const dongMoi = log[log.length - 1]!;
      const sau = replay(
        t.seed, log, false, t.ghe ?? undefined, t.luat, 0, false, t.soO);
      const kq = sau.ketQuaCuoi!;
      /*
       * 22/08 — ĐẦU HÀNG = KHÉP TRẬN NGAY (founder: *"thoát trận với lý do đầu
       * hàng thì đâu thể vào lại trận được? Cho người đó hạng E- luôn"*). Trước
       * đó trận vẫn `dang_choi` sau cú đầu hàng: sảnh mời TIẾP TỤC, URL cũ vào
       * lại được, và tick 45' mới đóng nó thành bỏ dở. Engine không đổi (`daKetThuc`
       * vẫn đếm ghế — replay trận cũ nguyên); cửa khép nằm ở API: `tranKhepLai`.
       */
      /*
       * D481 (founder 04/10: màn vòng cuối *"Chiếu nó trước rồi tính chứ sao lại ko tính"*) — khung minigame, vòng cuối (không đầu hàng): CHƯA
       * khép trận ở cú nộp này. Vòng chốt bình thường, màn cuối chạy theo lịch chung, trận khép + lưu kết quả khi màn xong (`chotManCuoi`).
       */
      const coMan = sau.st.dong_ho_minigame === true && coManMinigame(vong, sau.st.map.o.length, sau.st.nhip_xen_ke === true);
      const choManCuoi = coMan && daKetThuc(sau.st) && !banDauHang(sau.st);
      /*
       * D549 (founder 07/10: *"cái chốt xong bị kẹt trong khi bàn toàn bot thì vô lý quá"*) — vòng có màn mà người chơi KHÔNG có màn riêng (không
       * cầm mã nào / mã chưa có dòng giá — đúng cửa mở màn `boiCanhCuaGhe` sẽ bác) và mọi ghế khác là máy ⇒ không ai cần cửa sổ màn ~49 s. Bỏ
       * qua bằng cách lùi mốc mở vòng đúng `giayManMinigame()`: màn coi như đã hết (cùng công thức `layTran`), đồng hồ vòng sau còn nguyên phần
       * QUYẾT. Kết quả trận KHÔNG đổi: màn không ai bấm áp y như hết giờ (`manCho` lệnh rỗng) — chỉ đổi giờ tường, không vào replay.
       * Trận miễn giờ (bàn tập) vốn đã không chờ. Còn ghế người khác (bàn nhiều người) ⇒ giữ lịch chung.
       */
      const boQuaMan = coMan && !vongMienGio(t, vong + 1)
        && sau.st.ghe.every((g) => g.id === 'ban' || g.loai !== 'nguoi')
        && 'loi' in boiCanhCuaGhe(sau.st, Number(t.seed), vong, sau.st.ghe.find((g) => g.id === 'ban')!, sau.loiSuatCongCuoi ?? null);
      const xong = tranKhepLai(sau.st) && !choManCuoi;
      /** LÕI VỐN — lệnh nào bị engine bỏ qua, và vì sao. Xem `replay.loiVonCuoi`. */
      const loiVon = sau.loiVonCuoi;
      const cuaBan = kq.ket_qua.find((k) => k.ghe_id === 'ban') ?? null;

      /*
       * ─── §8.3 (03-chu-ky-tin-dung) — TRẠNG THÁI MÁY CỦA Ô VỪA LẬT ──────────
       *
       * Định nghĩa NGAY từ commit đầu của máy trạng thái, vì events append-only
       * không backfill được: mọi vòng đánh trước khi field tồn tại là vĩnh viễn
       * không có nó. Bước 1 sức căng khoá 0 — số 0 đó CHÍNH LÀ ground truth của
       * giai đoạn này, không phải placeholder. Field của cơ chế CHƯA tồn tại
       * (lịch chính sách, chu kỳ, telegraph) cố ý VẮNG MẶT thay vì null: vắng =
       * cơ chế chưa ship, có = giá trị thật — hai nghĩa không được trộn.
       */
      const oMay = sau.st.map.trang_thai?.[vong - 1] ?? null;
      const trangThaiMay = oMay ? {
        market_state: oMay.giai_doan_nen,
        run_direction: oMay.run_huong,
        run_length: oMay.run_dai,
        face_prior_bps: oMay.face_prior_bp,
        tension_true_bps: oMay.suc_cang_bp,
        /*
         * Bước 5 — CỜ HIỂN THỊ (chống confound thứ tư, 03 §5.5c): hai quần thể
         * thấy/không thấy bộ đo phải tách được VĨNH VIỄN. Đo theo lá ghế cầm
         * LÚC QUYẾT ĐỊNH (trạng thái trước vòng).
         */
        tension_visible: (() => {
          const banTruoc = truoc.st.ghe.find((g) => g.id === 'ban')!;
          return truoc.st.suc_cang === true && truoc.st.dac_quyen === true
            && banTruoc.danh_muc.chien_thuat.includes('luot_song' as never);
        })(),
        tension_band_shown: (() => {
          const banTruoc = truoc.st.ghe.find((g) => g.id === 'ban')!;
          return truoc.st.suc_cang === true && truoc.st.dac_quyen === true
            && banTruoc.danh_muc.chien_thuat.includes('luot_song' as never)
            ? oMay.suc_cang_bp.map((x) => daiSucCang(x)) : null;
        })(),
        is_policy_cell: oMay.o_lich,
        // v26 — mức lãi suất nền tại ô này. Vào `events` vì nó là ĐIỀU KIỆN
        // KINH TẾ của quyết định (A9: có tiền/niềm tin trong đó), và append-only
        // nên không gắn nhãn lại được về sau.
        policy_rate: oMay.lai_suat_diem,
        // Chỉ ô lịch mới có cặp hướng chính sách — vắng mặt = không phải kỳ họp.
        ...(oMay.o_lich ? {
          policy_expected_dir: oMay.huong_cs_ky_vong,
          policy_actual_dir: oMay.huong_cs_thuc,
        } : {}),
        tail_face: oMay.tail_face,
        // Bước 6 + §4.3 — cycle_* hằng theo map; điềm báo chỉ có trên ô nó nổ.
        ...(sau.st.map.chu_ky ? {
          cycle_speed: sau.st.map.chu_ky.speed,
          cycle_amplitude: sau.st.map.chu_ky.amp,
          cycle_asymmetry: sau.st.map.chu_ky.asym,
        } : {}),
        ...(oMay.ngoai_lich ? {
          is_offcalendar_rate: true,
          telegraph_reliability_bps: oMay.telegraph_bps,
        } : {}),
      } : null;
      /*
       * `tension_at_exit_bps` — cột vàng §8.3: sức căng THẬT tại lúc người chơi
       * RỜI HẲN một mã (vị thế > 0 → 0 trong vòng này). Ghép với tension_visible
       * sau này đo được "biết thì thoát sớm hơn bao nhiêu".
       */
      const viTruocBan = truoc.st.ghe.find((g) => g.id === 'ban')!.vi_the;
      const viSauBan = sau.st.ghe.find((g) => g.id === 'ban')!.vi_the;
      const sExit = Object.fromEntries(Object.entries(viTruocBan)
        .filter(([ma, chip]) => chip > 0 && !(viSauBan[ma]! > 0))
        .map(([ma]) => [
          ma, oMay?.suc_cang_bp[THU_TU_MA_SUC_CANG.indexOf(ma)] ?? 0,
        ]));

      /*
       * ─── MỘT TRANSACTION CHO CẢ VÒNG ────────────────────────────────────────
       *
       * A7: "Mọi event ghi CÙNG transaction với hành động nghiệp vụ (không
       * fire-and-forget)". Trước bản này khối dưới là 3–5 lệnh `pool.query` rời:
       * `action_log` ghi xong mà một event rớt là mất VĨNH VIỄN tín hiệu hành vi
       * của đúng vòng đó — `events` append-only, không backfill được (D25/R1).
       * Với hai event mới (đảo/khoá) thì mất mát còn đắt hơn: chúng đo cam kết
       * dài hạn và phản ứng hoảng, hai thứ không suy lại được từ kết quả.
       *
       * Đọc trận vẫn nằm NGOÀI transaction: nó là read thuần, và kéo nó vào chỉ
       * để giữ khoá dòng suốt quãng replay mà không đổi bất biến nào.
       */
      const client = await pool.connect();
      /** Mốc mở của vòng VỪA MỞ RA — để response trả về đồng hồ đã chạy lại từ đầu. */
      let mocVongSau: Date | null = null;
      /** Lỗi trong transaction — giữ lại để xử SAU khi trả kết nối (xem cửa thua CAS ngay dưới khối). */
      let loiGhi: unknown = null;
      try {
        await client.query('BEGIN');
        /*
         * D38 — VÒNG KẾ VỪA MỞ RA, MỐC PHẢI TIẾN THEO, và phải tiến TRONG CHÍNH
         * transaction này (A7 áp cho event; ở đây lý do còn thẳng hơn).
         *
         * Ghi mốc bằng câu UPDATE thứ hai ngoài tx là có một khoảnh khắc vòng mới
         * đã mở mà mốc vẫn là của vòng cũ — tick chạy đúng khoảnh khắc đó sẽ đóng
         * một trận đang được chơi. Người chơi mất trận, log không có gì bất thường.
         *
         * `xong` ⇒ NULL: không còn vòng nào đang mở thì không có mốc. Để lại mốc cũ
         * là mời `tranHetHan` kết luận về một trận đã đóng — vô hại hôm nay vì tick
         * lọc `status='dang_choi'`, nhưng đó là bất biến của MỘT câu truy vấn khác,
         * không phải của dữ liệu.
         */
        /*
         * ─── COMPARE-AND-SET TRÊN CHÍNH `action_log` (kiểm 02/08) ──────────
         *
         * Trước bản này handler đọc trận NGOÀI transaction rồi ghi đè vô điều
         * kiện. Hai request cùng vòng đều qua cửa `vong !== log.length + 1`
         * (chúng đọc cùng một log) rồi CẢ HAI cùng ghi. Đo được ba hậu quả:
         *   1. điểm mùa rank_pve NHÂN theo số request song song (19/20 lần
         *      lệch; 4 request ⇒ so_tran=4, diem=12) — đường gian lận thang
         *      xếp hạng, và nó rút quá tay `rank_quy_diem` nên phá luôn bất
         *      biến 0017 (Σ diem + quỹ = 0);
         *   2. `events` nhân bản (V7: hd_cam_ket ×8 cho 7 vòng) — A3.3
         *      append-only nên KHÔNG xoá lại được;
         *   3. phí Bảng điện tử BỐC HƠI 11/12 lần: `/bang-dien-tu` có
         *      FOR UPDATE nhưng khoá chỉ có tác dụng khi MỌI writer cùng lấy;
         *      `/rounds` không lấy nên nó ghi đè mất đuôi `MoBangCho`.
         *
         * Điều kiện là CHÍNH `action_log` chứ không phải `vong_hien_tai`: cửa
         * mở bảng ghi log mà KHÔNG đụng `vong_hien_tai`, nên CAS theo số vòng
         * bịt được (1)(2) mà vẫn để (3) sống. So `jsonb = jsonb` là so nội
         * dung đã chuẩn hoá, nên bất kỳ writer nào chen vào — kể cả nó chỉ
         * thêm một đuôi phí — đều làm câu này khớp 0 dòng.
         *
         * rowCount === 0 ⇒ NÉM, tức rollback trọn gói: không event ma, không
         * điểm mùa nhân bản, không kết quả trận nhân bản (`luuKetQua` nằm sau
         * câu này trong cùng transaction).
         */
        const upd = await client.query(
          `UPDATE holdem_matches
              SET action_log = $1, vong_hien_tai = $2,
                  status = $3, ended_at = CASE WHEN $3 = 'xong' THEN now() ELSE NULL END,
                  vong_mo_luc = CASE WHEN $3 = 'xong' THEN NULL
                                     WHEN $6::boolean THEN now() - make_interval(secs => $7) ELSE now() END
            WHERE match_id = $4 AND action_log = $5::jsonb
        RETURNING vong_mo_luc`,
          [JSON.stringify(log), sau.st.vong, xong ? 'xong' : 'dang_choi', t.matchId,
           JSON.stringify(t.logRaw), boQuaMan, giayManMinigame(truoc.st.loi_chon_truoc === true)]);
        if (upd.rowCount === 0) {
          throw new HoldemError(409, 'vong_da_nop',
            'Vòng này vừa được nộp ở nơi khác. Tải lại để xem trạng thái mới nhé.');
        }
        mocVongSau = (upd.rows[0]?.vong_mo_luc ?? null) as Date | null;

        // R1: bối cảnh đối thủ ĐANG HIỂN THỊ tại thời điểm quyết định.
        await client.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type,
                               value_num, value_json, state_snapshot_json)
           VALUES ($1, 'holdem', $2, 'hd_cam_ket', $3, $4, $5)`,
          [uid(actor), t.matchId, themApDung, JSON.stringify({
            /*
             * ⚠ GHI NƯỚC ĐÃ ÁP, KHÔNG PHẢI NƯỚC CLIENT GỬI. Hết giờ thì engine chạy
             * `giu_vi_the`/0 trong khi body có thể là `tang_cam_ket`/400 — log lại
             * ý định là dựng một bộ dữ liệu tả một ván không hề xảy ra.
             *
             * ⚠ VÀ `tu_dong` PHẢI CÓ MẶT. Chạm A1: "không kịp bấm" với "cố ý giữ
             * vị thế" ra cùng một nước nhưng là hai hành vi khác hẳn về tâm lý.
             * Gộp chúng là pha loãng cột khẩu vị rủi ro — tín hiệu B2B đắt nhất —
             * và `events` append-only nên KHÔNG tách lại được về sau (A3.3).
             */
            vong, hanh_dong: hdApDung, them: themApDung,
            mua: hetGio ? [] : muaThe,
            khao_sat_lai: hetGio ? 0 : khaoSatLai,
            // `dongMoi` dựng từ body RỖNG khi hết giờ nên lenh ở đây luôn là
            // lệnh ĐÃ ÁP — cùng kỷ luật "ghi nước đã áp" của cả event này.
            ...(dongMoi.lenh?.length ? { lenh: dongMoi.lenh } : {}),
            ...(Object.keys(sExit).length ? { tension_at_exit_bps: sExit } : {}),
            ...(hetGio ? { tu_dong: NUOC_HET_GIO.tu_dong } : {}),
            // D93 — cùng nhãn với dòng log; event và log là hai chỗ đọc của MỘT sự thật.
            ...(hetGio && suCoKhai ? { su_co_khai: suCoKhai } : {}),
          }), JSON.stringify({
            doi_thu: doiThuLucQuyetDinh,
            so_nguoi_song: truoc.st.ghe.filter((g) => !g.da_chay).length,
            quy_vong_truoc: kq.quy_vong,
            /**
             * TRẠNG THÁI CẢM XÚC CẢ BÀN tại đúng khoảnh khắc quyết định — gồm CẢ
             * ghế mình. Đây là biến gây nhiễu phải khử khi đọc dữ liệu khẩu vị rủi
             * ro: người ta tố mạnh hơn khi thấy đối thủ đang cháy, và nhường khi
             * thấy đối thủ đang thắng đậm. Không có cột này thì mọi phân tích
             * "mức cam kết ↔ độ tự tin" đều lẫn hiệu ứng xã hội vào.
             *
             * Dạng map gọn `{ghe_id: fx}` chứ không lặp lại cả object đối thủ —
             * A7 đặt mục tiêu ≤~300 byte/event, và `doi_thu[]` ngay trên đã chứa
             * bản đầy đủ rồi.
             *
             * ⚠ KHÔNG BACKFILL ĐƯỢC (D25/R1): trận đã đánh trước commit này vĩnh
             * viễn không có cột này. Query phân tích phải chịu được nó vắng mặt.
             */
            // Xem ghi chú dài ở chỗ đọc `bo_cuc`. `null` = client cũ chưa gửi,
            // và đó là một câu trả lời hợp lệ chứ không phải thiếu dữ liệu.
            bo_cuc: boCuc,
            opponent_fx_state: Object.fromEntries([
              // NAV chứ không phải tiền mặt — xem ghi chú ở `bangDoiThu`.
              ['ban', fxCuaGhe(
                navCua(truoc.st.ghe.find((g) => g.id === 'ban')!),
                truoc.st.ghe.find((g) => g.id === 'ban')!.da_chay,
                truoc.st.ghe.find((g) => g.id === 'ban')!.tu_the,
                vonDauCua(truoc.st, truoc.st.ghe.find((g) => g.id === 'ban')!),
              )],
              ...doiThuLucQuyetDinh.map((d) => [d.ghe_id, d.fx] as const),
            ]),
          })]);

        /*
         * ─── BRIER MỖI VÒNG — CẮM VÀO SỔ, THÔI TÍNH-RỒI-VỨT (04 §2.1) ──────────
         *
         * D67 dựng thước này rồi chỉ HIỆN nó; không bảng nào giữ ⇒ mỗi vòng chơi
         * là một dòng mất vĩnh viễn (append-only, không backfill). Nó là đầu vào
         * của chỉ số tâm lý số 1 và số 6 (04 §3), nên đứng đầu thứ tự thi công.
         *
         * ⚠ CHỈ ghi khi Brier ≠ null: toàn tiền mặt = KHÔNG dự báo (D67), ghi 0
         * là thưởng người không bao giờ vào lệnh. "Vòng nào đứng ngoài" đọc từ
         * `hd_cam_ket` — không cần dòng null ở đây (A9: dòng thừa là chỗ chiếm
         * vĩnh viễn).
         * ⚠ CÙNG transaction với nộp vòng (A7) — và nhờ CAS phía trên, request
         * nộp trùng bị 409 TRƯỚC khi tới đây, nên không có dòng Brier nhân bản.
         */
        if (typeof cuaBan?.brier === 'number') {
          await client.query(
            `INSERT INTO events (user_id, context_type, context_id, action_type,
                                 value_num, value_json, state_snapshot_json)
             VALUES ($1, 'holdem', $2, 'hd_brier_vong', $3, $4, NULL)`,
            /*
             * ⚠ `brier_v` — PHIÊN BẢN CÔNG THỨC, bắt buộc từ D102.
             *
             * v1 (tới 17/08) chấm bằng bảng lợi suất RIÊNG GHẾ, gán 0 cho mọi
             * mã không cầm ⇒ thước thưởng việc ôm một mã. v2 chấm bằng bảng
             * CÔNG KHAI (`loiSuatCongKhai`). Đo trên 48.000 vòng-ghế: 63,4% số
             * vòng ĐỔI "mã thắng", Brier trung bình 0,762 → 1,295.
             * `events` append-only nên hai thước sẽ nằm cạnh nhau vĩnh viễn —
             * không có cờ này thì mọi phân tích bắc qua mốc hôm nay im lặng
             * trộn hai đại lượng khác nhau.
             */
            [uid(actor), t.matchId, cuaBan.brier, JSON.stringify({ vong, brier_v: 2 })]);
        }

        /*
         * ─── HAI EVENT LÕI VỐN — TÍN HIỆU HÀNH VI ĐẮT NHẤT CỦA VÒNG ─────────────
         *
         * Vì sao tách khỏi `hd_cam_ket` chứ không nhét thêm hai trường vào đó:
         * hai hành động này trả lời hai câu hỏi KHÁC hẳn câu "cam kết bao nhiêu",
         * và chúng xảy ra ở nhịp 1 chứ không ở vòng cược.
         *   · `hd_khoa_tai_san` đo CAM KẾT DÀI HẠN — dám hứa nắm giữ 2 vòng TRƯỚC
         *     khi biết ô kế lật ra gì. Đây là loại tín hiệu A1 muốn bán: lựa chọn
         *     xảy ra trước kết quả, nên nó là niềm tin chứ không phải phản xạ.
         *   · `hd_dao_danh_muc` đo PHẢN ỨNG HOẢNG — bán mã đang nắm ngay sau một ô
         *     xấu. Cùng một cú bấm, đọc cùng `o_kind`/`o_id` thì phân biệt được
         *     "tái cơ cấu có kế hoạch" với "chạy theo ô vừa lật".
         *
         * SNAPSHOT GỌN (~200 byte, A7): bối cảnh môi trường + bối cảnh đối thủ
         * (D25/R1 — bắt buộc từ dòng đầu, không backfill được), KHÔNG dump danh mục.
         * `so_nguoi_song` + `fx_ban` là bảng đối thủ rút gọn; bản đầy đủ đã hiện vô
         * điều kiện ở màn trận nên bất biến `R1-logged ⊆ UI-luôn-hiện` vẫn đúng.
         *
         * GHI CẢ KHI BỊ TỪ CHỐI (`ok:false` + `loi`): ý ĐỊNH cũng là dữ liệu, và
         * "định đảo nhưng hết chỗ danh mục" là một tình huống hành vi có thật.
         */
        const oNay = truoc.st.map.o[truoc.st.vong - 1]!;
        const boiCanhVon = {
          vong,
          o_kind: oNay.kind,
          o_id: oNay.kind === 'giai_doan' ? oNay.giai_doan : oNay.su_kien,
          von_truoc: truoc.st.ghe.find((g) => g.id === 'ban')!.von,
          so_nguoi_song: truoc.st.ghe.filter((g) => !g.da_chay).length,
          fx_ban: fxCuaGhe(
            truoc.st.ghe.find((g) => g.id === 'ban')!.von,
            truoc.st.ghe.find((g) => g.id === 'ban')!.da_chay,
            truoc.st.ghe.find((g) => g.id === 'ban')!.tu_the,
            vonDauCua(truoc.st, truoc.st.ghe.find((g) => g.id === 'ban')!),
          ),
        };
        const khoaTruoc = khoaDangChay(
          truoc.st.ghe.find((g) => g.id === 'ban')!, truoc.st.vong);

        if (dongMoi.dao) {
          await client.query(
            `INSERT INTO events (user_id, context_type, context_id, action_type,
                                 value_json, state_snapshot_json)
             VALUES ($1, 'holdem', $2, 'hd_dao_danh_muc', $3, $4)`,
            [uid(actor), t.matchId,
              JSON.stringify({
                vong, tu: dongMoi.dao.tu, den: dongMoi.dao.den,
                ok: !loiVon.dao, ...(loiVon.dao ? { loi: loiVon.dao } : {}),
              }),
              JSON.stringify({
                ...boiCanhVon,
                // Đảo ĐÚNG mã đang khoá ở vòng chốt = bẻ kèo. Ghi ngay tại đây để
                // đọc dữ liệu không phải nối chéo hai bảng mới biết cú đảo này đắt.
                ...(khoaTruoc ? { khoa_ma: khoaTruoc.ma } : {}),
              })]);
        }

        /*
         * v43 (D314) — HỢP ĐỒNG GỬI TIẾT KIỆM. Một dòng mỗi vòng CÓ `tiet_kiem` trong
         * body, kể cả khi bị từ chối (`ok:false` + `loi`) — ý định là dữ liệu, cùng nếp
         * `hd_khoa_tai_san` ngay dưới.
         *
         * ⚠ `action_type` MỚI ⇒ migration `0062_hd_tiet_kiem.sql` phải đi CÙNG COMMIT
         * (A11.4). INSERT này nằm TRONG transaction nộp vòng, nên DB từ chối một loại
         * chưa khai là HỎNG CẢ CÚ CHỐT VÒNG chứ không phải mất một dòng log — đúng ca
         * `hd_dat_short` đã trả giá ở D79.
         */
        if (dongMoi.tiet_kiem) {
          await client.query(
            `INSERT INTO events (user_id, context_type, context_id, action_type,
                                 value_json, state_snapshot_json)
             VALUES ($1, 'holdem', $2, 'hd_tiet_kiem', $3, $4)`,
            [uid(actor), t.matchId,
              JSON.stringify({
                vong,
                ...(dongMoi.tiet_kiem.mo ? { mo: dongMoi.tiet_kiem.mo } : {}),
                ...(dongMoi.tiet_kiem.huy ? { huy: dongMoi.tiet_kiem.huy } : {}),
                ok: !loiVon.tiet_kiem,
                ...(loiVon.tiet_kiem ? { loi: loiVon.tiet_kiem } : {}),
              }),
              JSON.stringify(boiCanhVon)]);
        }

        if (dongMoi.khoa) {
          await client.query(
            `INSERT INTO events (user_id, context_type, context_id, action_type,
                                 value_json, state_snapshot_json)
             VALUES ($1, 'holdem', $2, 'hd_khoa_tai_san', $3, $4)`,
            [uid(actor), t.matchId,
              JSON.stringify({
                vong, ma: dongMoi.khoa, so_vong: KHOA_TAI_SAN.SO_VONG,
                ok: !loiVon.khoa, ...(loiVon.khoa ? { loi: loiVon.khoa } : {}),
              }),
              JSON.stringify(boiCanhVon)]);
        }

        /*
         * D33 — ĐẶT LỆNH SHORT: tín hiệu "dám cược NGƯỢC đám đông TRƯỚC khi biết
         * kết quả", và nó khác hẳn ba event kia.
         *
         * `hd_khoa_tai_san` đo cam kết GIỮ; `hd_dao_danh_muc` đo phản ứng CHẠY;
         * event này đo một thứ thứ ba mà không cái nào suy ra được: dám đặt cược
         * vào việc thị trường ĐI XUỐNG. Gộp vào `hd_cam_ket` là mất nó, vì cam
         * kết chỉ nói ĐỘ LỚN chứ không nói CHIỀU.
         *
         * `khop_o_vong` ghi thẳng để đọc dữ liệu không phải tự cộng 1 — độ trễ
         * một vòng là cả nội dung của lá bài, phải hiện ra trong dữ liệu.
         */
        if (dongMoi.short) {
          await client.query(
            `INSERT INTO events (user_id, context_type, context_id, action_type,
                                 value_json, state_snapshot_json)
             VALUES ($1, 'holdem', $2, 'hd_dat_short', $3, $4)`,
            [uid(actor), t.matchId,
              JSON.stringify({
                vong, ma: dongMoi.short, khop_o_vong: vong + 1,
                ok: !loiVon.short, ...(loiVon.short ? { loi: loiVon.short } : {}),
              }),
              JSON.stringify(boiCanhVon)]);
        }

        /*
         * ─── v32 — CÚ CHỌN KỲ NGỘ: TRỤC HÀNH VI MỚI (doc 06 §4) ───────────────
         *
         * Đây là phần data đắt nhất của cả cụm, và là thứ bản THUẦN (map 8)
         * không bao giờ đo được — vì ở đó không ai bị hỏi. Ghi ĐỦ BA thứ:
         *   · `moi`  — bộ được chào. Mời 3 trong 4 nên "chọn LA BÀN" có nghĩa
         *     khác hẳn tuỳ món nào vắng mặt; thiếu nó là mất phép so "lựa chọn
         *     thứ hai khi món ruột không có".
         *   · `chon` — con đường đã đi.
         *   · bối cảnh (snapshot) — chọn trong lúc đang thắng hay đang cháy.
         * "Xong hay không" nằm ở `hd_match_end`: nó chỉ biết được lúc kết trận.
         *
         * ⚠ `action_type` MỚI ⇒ migration 0038 phải đi CÙNG COMMIT. INSERT này
         * nằm TRONG transaction nộp vòng, nên DB từ chối một loại chưa khai là
         * HỎNG CẢ CÚ CHỐT VÒNG, không phải mất một dòng log (D79 đã trả giá
         * đúng chỗ này với `hd_dat_short`).
         */
        if (dongMoi.ky_ngo) {
          /*
           * D88 — `moi` + `hoi` lấy từ ĐÚNG lần kỳ ngộ mà replay đã dựng
           * (mời sinh theo hồi), không tự tính lại — tự tính là bản sao thứ
           * hai và cú trôi ở đây ghi vào bảng APPEND-ONLY một bộ mời chưa
           * từng hiện trên màn nào (phản R1). `hoi` là trục data mới của
           * §11.3: "chọn gì KHI đang ở chế độ thị trường nào".
           */
          const lanNay = truoc.kyNgo.lan.find((l) => l.vong === vong);
          await client.query(
            `INSERT INTO events (user_id, context_type, context_id, action_type,
                                 value_json, state_snapshot_json)
             VALUES ($1, 'holdem', $2, 'hd_chon_ky_ngo', $3, $4)`,
            [uid(actor), t.matchId,
              JSON.stringify({
                vong, chon: dongMoi.ky_ngo,
                moi: lanNay?.moi ?? boNhiemVuMoi(t.seed, vong),
                ...(lanNay?.hoi ? { hoi: lanNay.hoi } : {}),
              }),
              JSON.stringify(boiCanhVon)]);
        }

        /*
         * v55 (D409) — `hd_chon_trait`: LỜI TỰ KHAI PHONG CÁCH ở vòng mốc — lượt mời · lá lấy · số lần cuộn · xu, kể
         * cả cú bị bỏ qua. Lớp INTENT của bốn lớp (kiến trúc 25/09 §5). Migration 0070 CÙNG COMMIT (A11.4).
         */
        {
          const mtBan = (sau.mocTraitCuoi ?? []).find((x) => x.ghe_id === 'ban');
          if (mtBan) {
            await client.query(
              `INSERT INTO events (user_id, context_type, context_id, action_type,
                                   value_num, value_json, state_snapshot_json)
               VALUES ($1, 'holdem', $2, 'hd_chon_trait', $3, $4, NULL)`,
              [uid(actor), t.matchId, mtBan.lay.length, JSON.stringify({
                vong, moc: mtBan.moc, moi: mtBan.moi, lay: mtBan.lay, cuon: mtBan.cuon,
                xu_truoc: mtBan.xu_truoc, xu_sau: mtBan.xu_sau, mat_tri: mtBan.mat_tri, bo_qua: mtBan.bo_qua,
                // đang mang = MỌI trait có hiệu lực (cặp vai đứng đầu) — cùng danh sách `hd_chot_phien.trait` đọc.
                dang_mang: ((): unknown => { const gb = sau.st.ghe.find((g) => g.id === 'ban'); return gb ? traitHieuLuc(sau.st, gb) : []; })(),
                ...(hetGio ? { tu_dong: true } : {}),
              })]);
          }
        }
        await client.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type,
                               value_num, value_json, state_snapshot_json)
           VALUES ($1, 'holdem', $2, 'hd_chot_phien', $3, $4, $5)`,
          [uid(actor), t.matchId, cuaBan?.pnl_bp ?? 0, JSON.stringify({
            vong, chain: cuaBan?.chain ?? [], ghe_thang: kq.ghe_thang,
            quy_vong: kq.quy_vong,
            /*
             * v55 (D409) — lửa/xu của ghế mình cuối vòng + trait đang mang: CỘNG THÊM trường; dòng cũ vắng = trận
             * trước v55 (null ≠ 0, A11.2). Kho hành vi (trai.ts) trải sáu cột từ đây — không đọc lại replay.
             */
            ...((): Record<string, unknown> => {
              const l = (kq.lua ?? []).find((x) => x.ghe_id === 'ban');
              const gb = sau.st.ghe.find((g) => g.id === 'ban');
              const g0 = truoc.st.ghe.find((g) => g.id === 'ban');
              return {
                ...(l && gb
                  ? {
                    lua: {
                      truoc: l.truoc?.nac ?? 0, sau: l.sau.nac, chuoi: l.sau.chuoi, bias: l.sau.bias, dap: l.dap,
                      xu_them: l.xu_them, xu: gb.xu ?? 0,
                    },
                  }
                  : {}),
                /*
                 * HAI danh sách, hai nghĩa (D409): `trait` = đang mang SAU vòng (gồm lá vừa lấy ở vòng mốc); `trait_vong` =
                 * CÓ HIỆU LỰC TRONG vòng vừa chốt (lá vừa lấy chỉ tính từ vòng KẾ; lá MẤT TRÍ vừa xoá vẫn tính cho vòng
                 * này). Kho hành vi đọc `trait_vong` cho hai cột ngữ cảnh — bản đầu đọc `trait` và gán NỘI GIÁN / KỶ LUẬT
                 * cho đúng vòng mốc, lúc người chơi chưa có chúng. Tách khỏi khối lửa: cổng trait không được phụ thuộc
                 * cổng lửa để còn được ghi (dữ liệu là cửa một chiều).
                 */
                ...(sau.st.trait_bat === true && gb && g0
                  ? { trait: traitHieuLuc(sau.st, gb), trait_vong: traitHieuLuc(truoc.st, g0) }
                  : {}),
              };
            })(),
            /*
             * v42 (D311) — HAI DÒNG TIỀN MỚI. Thêm trường vào `value_json` của một
             * `action_type` ĐÃ CÓ là phép cộng thuần: hàng cũ không đổi nghĩa, hàng
             * mới có thêm khoá (A3.3 append-only vẫn nguyên, không cần migration).
             *
             * ⚠ Ghi TỪ DÒNG ĐẦU TIÊN của v42 chứ không đợi lật cổng. Dữ liệu là cửa
             * MỘT CHIỀU: trận đã lưu mà thiếu trường thì không có cách nào bù lại —
             * `chain` chỉ chở mắt xích GIÁ, còn coupon và cú sốc tiền mặt KHÔNG nằm
             * trong đó (cố ý — chúng là dòng tiền, không phải mắt xích giá), nên
             * không suy ngược được từ những gì đang ghi.
             * VẮNG khi cổng tắt ⇒ trận cũ giữ nguyên hình dạng `value_json`.
             */
            ...((kq.coupon ?? []).some((x) => x.ghe_id === 'ban')
              ? { coupon: (kq.coupon ?? []).filter((x) => x.ghe_id === 'ban') } : {}),
            ...((kq.tien_mat_su_kien ?? []).some((x) => x.ghe_id === 'ban')
              ? {
                tien_mat_su_kien: (kq.tien_mat_su_kien ?? [])
                  .filter((x) => x.ghe_id === 'ban'),
              } : {}),
            /*
             * D105 — CHỢ đổi bao nhiêu ở vòng này (TRUNG VỊ lợi suất công khai).
             * Trường SỐ trên event ĐÃ CÓ ⇒ không action_type mới, không migration.
             * Nền của thanh PHONG CÁCH: nó cho phép tính lại hạng từ lịch sử sau
             * khi tải lại trang, và cho phép chấm "đứng ngoài" như một dự báo —
             * hai thứ không suy được từ `pnl_bp` của riêng người chơi.
             * `null` ở trận không NAV (không có bảng công khai để lấy trung vị).
             */
            ...(kq.cho_bp !== null ? { cho_bp: kq.cho_bp } : {}),
            /*
             * D327 — MỐC MỞ VÒNG. `holdem_matches.vong_mo_luc` giữ đúng VÒNG HIỆN TẠI và bị ghi
             * đè ở câu UPDATE ngay trên, nên sau cú chốt này không còn chỗ nào biết vòng vừa
             * xong đã mở lúc nào — thời gian quyết định MẤT VĨNH VIỄN nếu không ghi ở đây
             * (cửa một chiều, A11.1). `t.vongMoLuc` là giá trị đọc lúc `layTran`, TRƯỚC UPDATE.
             * Phép cộng thuần vào `value_json` (tiền lệ `cho_bp`): không action_type mới.
             * `hanh_vi/trai.ts` suy `ms_quyet = ts(hd_cam_ket) − mo_luc`.
             */
            ...(t.vongMoLuc !== null ? { mo_luc: t.vongMoLuc.toISOString() } : {}),
            /*
             * ⚠ GỌI KÝ QUỸ — số chip bị lấy khỏi NAV vì cầm Đòn Bẩy mà lỗ quá
             * ngưỡng. A9 xếp dòng này vào `events` vì nó CÓ TIỀN trong đó, và
             * trước hôm nay khoản mất ấy KHÔNG tái dựng được từ `events`:
             * `chain` không có mắt xích ký quỹ, nên phân tích sau này thấy NAV
             * tụt mà không có dòng nào giải thích.
             *
             * ⚠⚠ THÊM TRƯỜNG vào dòng ĐÃ CÓ, KHÔNG đẻ `action_type` mới — đúng
             * tiền lệ `cho_bp` ngay trên. D79 đã trả giá cho `hd_dat_short`:
             * loại chưa khai trong migration bị DB TỪ CHỐI, mà INSERT nằm TRONG
             * transaction chốt vòng nên hỏng CẢ CÚ CHỐT VÒNG, không chỉ mất một
             * dòng log. Thêm trường thì không đụng CHECK nào.
             */
            ...((() => {
              const gk = kq.goi_ky_quy.find((x) => x.ghe_id === 'ban');
              return gk ? { ky_quy_mat: gk.mat } : {};
            })()),
          }),
          // §8.3 — trạng thái máy của ô vừa lật, ghi MỌI vòng bất kể có gì
          // hiển thị hay không (~230 byte, trong mục tiêu A7 ≤ ~300).
          trangThaiMay ? JSON.stringify(trangThaiMay) : null]);

        if (kq.tin_gia_lo) {
          await client.query(
            `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
             VALUES ($1, 'holdem', $2, 'hd_tin_gia_lo', $3)`,
            [uid(actor), t.matchId, JSON.stringify(kq.tin_gia_lo)]);
        }

        if (xong) {
          await luuKetQua(client, t.matchId, uid(actor), sau.st, t.seed, sau.kyNgo.lan);
        }

        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        loiGhi = e;
      } finally {
        client.release();
      }
      if (loiGhi !== null) {
        /*
         * SPEC chan-truoc-beta — THUA CUỘC ĐUA CAS VỚI CHÍNH CÚ NỘP CÙNG THÂN (hai tab · client gửi lại khi cú đầu còn đang bay): đọc
         * lại, cú thắng đúng là vòng này với cùng hành động ⇒ trả kết quả của nó. Đọc SAU khi trả kết nối — pool trên Vercel chỉ có 1.
         * Kẻ chen vào là cửa khác (mở bảng ghi đuôi phí) ⇒ không phải gửi lại ⇒ 409 `vong_da_nop` như cũ.
         */
        if (loiGhi instanceof HoldemError && loiGhi.code === 'vong_da_nop') {
          const lap = await traLoiGuiLai(await layTran(t.matchId, uid(actor)), vong, hd, xinChotHo);
          if (lap) return c.json(lap);
        }
        throw loiGhi;
      }

      /*
       * THÂN TRẢ LỜI — dựng ở `thanNopVong`: MỘT nơi cho cả cú nộp này lẫn cú GỬI LẠI (SPEC chan-truoc-beta). Đồng hồ = mốc RETURNING
       * của câu UPDATE ở trên (`now()` của Postgres), không tính lại bằng `new Date()`: trộn hai đồng hồ là đếm ngược khởi hành ở
       * "còn 24s" trên một vòng vừa mở.
       */
      return c.json(thanNopVong({
        matchId: t.matchId, banMa: t.banMa, seed: t.seed, vong, truoc, sau, hetGio, xong,
        choMan: coMan && (!xong || choManCuoi),
        hetMan: vongMienGio(t, vong + 1) ? undefined
          : boQuaMan ? Date.now()   // D549 — không ai cần màn ⇒ hết ngay: web hỏi lại sau mức tối thiểu và nhận vòng mới
          : Date.now() + (DONG_HO_MINIGAME.LAT_THE_S + giayChonLa(truoc.st.loi_chon_truoc === true)) * 1000 + DEM_MS + CHAY_MS,   // D533
        dongHo: mocVongSau ? { vongMoLuc: mocVongSau, now: mocVongSau, mienGio: t.mienGio } : undefined,
      }));
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  // ── Màn minigame (D466, bước 3.3–3.4 kế hoạch minigame) ─────────────────
  /*
   * BA CỬA, đều chỉ cho trận mang cờ khung minigame (`dong_ho_minigame`, khoá v57 — chỉ tester mở được):
   *   POST …/minigame               mở màn của vòng VỪA NỘP (idempotent: mở lại trả đúng màn cũ)
   *   GET  …/minigame/:vong/nhip    dòng nhịp NDJSON mỗi giây một lô; `?mot_lan=1` = hỏi một lần (đường lui khi dòng đứt, D464)
   *   POST …/minigame/:vong/lenh    cú bấm kèm SỐ NHỊP đang thấy — ghi nhật ký màn + `events` (`mg_lenh`) cùng transaction
   *
   * ⚠ MÀN VÒNG v CHỈ MỞ SAU KHI ĐÃ NỘP VÒNG v. Dòng giá chở kịch bản của lá vòng v: mở trước khi chốt lệnh là lộ đáp án.
   * Bước 4 #1 dựng lại nhịp vòng (khoá lệnh → lật → chọn lá → màn → quyết toán) và màn khi đó mới tính tiền vào NAV;
   * tới lúc đó màn KHÔNG đổi kết quả trận — nó là khung chạy thử dòng giá của server thật.
   * ⚠ Dòng phát KHÔNG giữ kết nối DB: đọc màn một câu rồi trả kết nối, giá tính thuần từ bối cảnh (pool max = 1 trên Vercel).
   */
  const mgLoi = (code: LyDoKhongMan | KetQuaNhip): string => ({
    khong_co_ma: 'Bạn không nắm mã nào — vòng này không có màn.',
    ma_chua_co_dong_gia: 'Mã bạn nắm nhiều nhất chưa có dòng giá minigame.',
    ngoai_map: 'Vòng này nằm ngoài map.',
    ok: '',
    ngoai_man: 'Số nhịp không thuộc màn.',
    chua_chay: 'Màn còn đang đếm ngược.',
    tuong_lai: 'Nhịp này chưa tới.',
    qua_cu: 'Lệnh tới trễ quá cửa sổ — mạng chậm?',
  })[code];

  async function layMan(matchId: string, vong: number, userId: string, db: pg.Pool | pg.PoolClient = pool, khoa = false) {
    if (!laUuid(matchId) || !Number.isInteger(vong)) throw new HoldemError(404, 'not_found', 'Không thấy màn này.');
    const q = await db.query(
      `SELECT m.boi_canh, m.bat_dau, m.phien_ban, m.lenh
         FROM holdem_minigame_man m JOIN holdem_matches t USING (match_id)
        WHERE m.match_id = $1 AND m.vong = $2 AND t.owner_user_id = $3
        ${khoa ? 'FOR UPDATE OF m' : ''}`,
      [matchId, vong, userId]);
    if (q.rowCount === 0) throw new HoldemError(404, 'not_found', 'Màn này chưa mở.');
    const r = q.rows[0]!;
    if (r.phien_ban !== MINIGAME_DONG_GIA_VERSION) {
      // Mới có MỘT phiên bản. Ngày có bản thứ hai thì đây là chỗ chọn bộ dựng theo `phien_ban`, không phải chỗ ném lỗi.
      throw new HoldemError(409, 'phien_ban_cu', 'Màn này dựng bằng một bản dòng giá khác.');
    }
    return {
      bc: r.boi_canh as BoiCanhMan,
      batDau: new Date(r.bat_dau as string | Date).getTime(),
      lenh: (r.lenh ?? []) as (LenhMan & { khoa?: string })[],
    };
  }

  /**
   * D561 — KHUNG NHÌN mã `ma` của màn (vắng = mã chính): bối cảnh màn con + lệnh của nó (kèm cú chọn lá chung). Khoá một mã ⇒ chỉ mã chính hợp lệ.
   * `goc` = bối cảnh gốc (danh sách mã + bảng phụ đường thật).
   */
  function xemMa<T extends { bc: BoiCanhMan; lenh: (LenhMan & { khoa?: string })[] }>(m: T, ma: unknown): T & { goc: BoiCanhMan; lenhGoc: T['lenh'] } {
    const bc = bcCuaMa(m.bc, typeof ma === 'string' && ma.length > 0 ? ma : undefined);
    if (!bc) throw new HoldemError(400, 'ma_sai', 'Mã này không có màn trong vòng này.');
    return { ...m, goc: m.bc, lenhGoc: m.lenh, bc, lenh: lenhXemMa(m.bc, m.lenh, bc.ma) };
  }

  const dauMan = (vong: number, bc: BoiCanhMan, batDau: number, min: ReturnType<typeof dungDongMan>, now: number, lenh: readonly LenhMan[] = [], goc: BoiCanhMan = bc) => {
    const loiCam = bc.loi_cam ?? [], la = laCuaMan(loiCam, lenh, bc.loi_man);
    return {
      vong, ma: bc.ma, von: bc.von, dai: bc.dai, nac: bc.nac ?? null,
      // D561 — khoá nhiều mã: mọi mã có màn (mã chính trước) — client chạm bảng phụ để sang khung nhìn mã khác (`?ma=`).
      ...(goc.nhieu?.length ? { nhieu_ma: [goc.ma, ...goc.nhieu.map((x) => x.ma)], ma_chinh: goc.ma } : {}),
      bat_dau: new Date(batDau).toISOString(), gio_may: new Date(now).toISOString(),
      dem_ms: DEM_MS, chay_ms: CHAY_MS, so_nhip: SO_NHIP, cua_so_ms: CUA_SO_LENH_MS,
      phien_ban: MINIGAME_DONG_GIA_VERSION, lich_su: lichSuMan(min),
      // D536 — khoá có lệnh lớn: khối lượng 20 nến mịn lịch sử (cột dưới nến). Phần chạy đi theo lô (`kemKhoiLuong`).
      ...(bc.lon ? { lich_su_v: min.slice(0, NEN_LS * K_MIN).map((c) => Math.round(c.v * 1e3) / 1e3) } : {}),
      // D475 — màn CHỌN LÁ + nút của lá đang chơi (id; chữ ở client). Lõi chưa có trong màn ⇒ `nut` rỗng (chỉ xem).
      loi_cam: loiCam, la, nut: nutLoiCua(la, bc.luot_song, bc.ban_bot, bc.ban_bot_rai, bc.ba_phan) ?? [],   // D586 — màn không lõi cũng có nút (khoá v69)   // D531 — Lướt Sóng có nút chỉ ở khoá v60
      ...(bc.bk_x2 ? { muc_db_khong: [...mucDonBay(bc, -1)] } : {}),   // D561 — Bán Khống chỉ ×2: client vẽ đúng số nút
      ...(bc.loi_man ? { chon_la_s: 0 } : {}),   // D561 — lõi đã chọn lúc chốt: màn không có pha chọn lá
      ...(bc.up_la ? { up_la: true } : {}),   // D561 — ô pha: lá úp tới hết màn (client không lật thẻ vòng vừa chốt)
      ...tinDau(bc, min, lenh, la),   // D532 — mua tin sớm · tin thật đã mua · Kiên Nhẫn thấy trước vị trí tin · MÙ TIN
      he: bc.he ?? HE_SO_LOI,   // D482 — đòn bẩy trong màn của ghế (trait ghim ĐÒN BẨY ×1,5); client chỉ in
      ...(bc.to_chuc ? { to_chuc: true } : {}),   // D499 — Tổ Chức: khớp thỏa thuận (nút không khoá khi trắng) + búa khi chạm trần
      ...(bc.nghien_cuu ? { nghien_cuu: bc.nghien_cuu } : {}),   // D500 — bàn nghiên cứu: xác suất đáy/đỉnh theo khúc (không toạ độ giá)
      // D483 — TUNG TIN: ghế được gài (null = không) · phí · chiều đã gài (0 = chưa). Nút ▲/▼ chỉ trước khi màn chạy.
      gai: bc.tung_tin ? { phi: Math.floor((bc.von * PHI_GAI_BP) / 10000), chieu: gaiCuaMan(lenh) } : null,
      // D486 — cửa sổ bấm theo trait trong màn (giây; client vẽ vạch, khoá nút — server vẫn tự chặn).
      trait_man: { ...(bc.kien_nhan ? { khoa_s: TRAIT_MAN.KIEN_NHAN_KHOA_S } : {}), ...(bc.nong_voi ? { han_s: TRAIT_MAN.NONG_VOI_HAN_S } : {}) },
      // D528 — trait trong màn của khoá v59: KÊ MUA / KÊ BÁN (client vẽ hai nút + vạch lệnh) · TÂM LÝ YẾU · trần thua Tổ Chức áp khoản giữ (client chỉ hiện).
      ...(bc.ke ? { ke_trait: bc.ke } : {}), ...(bc.tam_ly_yeu ? { tam_ly_yeu: true } : {}), ...(bc.tran_thua_giu ? { tran_thua_giu: true } : {}),
      // D484 — BẢNG PHỤ: chỉ mã (thứ tự cố định); giá đi dần theo nhịp (`loNhip.phu`), % cuối không lộ trước.
      phu: goc.nhieu?.length ? [goc.ma, ...goc.nhieu.map((x) => x.ma)].filter((x) => x !== bc.ma) : (bc.phu ?? []).map((x) => x.ma),
      so: soLenhDaQua(bc.tu_day ? dungDongManKhop(bc, lenh) : min, bc, la, lenh),   // D499 — sổ khớp trên đường GỐC (khớp tự cộng cú đẩy); `min` có thể là đường người chơi thấy
    };
  };
  /**
   * D475 — SỔ của người chơi trong màn TÍNH TỚI cú bấm cuối (phần vào · lần ra · hụt): đúng thứ đã xảy ra, KHÔNG gồm phần app tự làm ở cuối
   * màn hay khi không bấm — hai thứ đó đọc đỉnh / giá cuối của cả màn, trả ra giữa màn là lộ kịch bản. Client chỉ hiện (C4).
   */
  function soLenhDaQua(min: ReturnType<typeof dungDongMan>, bc: BoiCanhMan, la: string | null, lenh: readonly LenhMan[]) {
    // D492 — Đòn Bẩy: sổ chạy THEO NHỊP tới cú bấm cuối (gọi / thanh lý tự động xảy ra giữa các cú bấm — không lộ cú thanh lý tương lai).
    // D499 — mọi lõi: Tổ Chức có trần thua tự động (Bắt Đáy) ⇒ sổ cũng phải dừng ở cú bấm cuối như Đòn Bẩy.
    const denNhip = Math.max(-1, ...lenh.map((x) => x.nhip));
    const kq = ketQuaMan({ min, ...thamSoKhop(bc), kienNhan: bc.kien_nhan === true, nongVoi: bc.nong_voi === true, la, lenh, ...(denNhip !== undefined ? { denNhip } : {}) });
    const tron4 = (x: number) => Math.round(x * 1e4) / 1e4;
    const vao = kq.tuDong ? [] : kq.vao, ra = kq.ra.filter((x) => !x.tuDongCuoi && !x.giu);   // D528 — lần bán KHOẢN GIỮ không phải vị thế mở trong màn
    const daVao = vao.reduce((a, x) => a + x.tien, 0), daRa = ra.reduce((a, x) => a + x.tien, 0);
    // D589 — khoá v70: phần VAY (×2) là vị thế (đang cầm) nhưng không phải tiền của ghế ⇒ không trừ vào tiền còn VÀO được; số phần không tính nó.
    const daVaoTien = vao.reduce((a, x) => a + (x.vay ? 0 : x.tien), 0), soPhan = vao.filter((x) => !x.vay).length, daVay = vao.some((x) => x.vay);
    // D561 — khoá khoản theo đường: tiền VÀO được chỉ là phần khoản đã BÁN (bán bớt · kê bán · Tâm lý yếu), không phải cả vốn màn.
    const daBanGiu = kq.ra.filter((x) => x.giu && !x.tuDongCuoi && !x.chuyen).reduce((a, x) => a + x.tien, 0);
    const conVon = (bc.khoan_theo_duong ? daBanGiu : bc.von) - daVaoTien, dangCam = daVao - daRa, raHet = ra.length > 0 && dangCam === 0;
    const chotLan = kq.chotLan ?? 0;
    return {
      vao: vao.map((x) => ({ tien: x.tien, khop: tron4(x.khop), nhip: x.nhip, ...(x.vay ? { vay: true as const } : {}) })),
      ra: ra.map((x) => ({ tien: x.tien, ra: tron4(x.ra), nhip: x.nhip, lai: x.lai })),
      hut: kq.hut,
      con_von: conVon, dang_cam: dangCam,
      // Tiền mỗi nút sẽ đặt (demo `LOI[...].nut().phu`) — 0 = nút tắt. Client hiện nguyên số (C4).
      tien_nut: la === 'bat_day' && bc.ba_phan ? {   // D589 — khoá v70: GOM 3 phần 1 : 2 : 3 · THOÁT
        vao: !raHet ? tienPhanVao(la, bc.von, soPhan, conVon) : 0,
        thoat: dangCam,
        ...(bc.ban_bot ? { ban_bot: banBotTien(bc, kq) } : {}),
      } : la === 'mua_duoi' && bc.ba_phan ? {   // D589 — khoá v70: NHỒI 3 phần 3 : 2 : 1 · ×2 (đủ 3 phần, chưa chốt, một lần) · CHỐT nửa rồi hết
        vao: !raHet ? tienPhanVao(la, bc.von, soPhan, conVon) : 0,
        [NUT_VAY_X2]: soPhan >= 3 && !daVay && ra.length === 0 && dangCam > 0 ? bc.von : 0,
        chot: dangCam > 0 && chotLan < 2 ? (chotLan === 0 ? Math.max(1, Math.floor(dangCam / 2)) : dangCam) : 0,
        ...(bc.ban_bot ? { ban_bot: banBotTien(bc, kq) } : {}),
      } : la === 'bat_day' ? {
        vao_nua: conVon > 0 && !raHet ? Math.min(Math.floor(bc.von / 2), conVon) : 0,
        vao_het: conVon > 0 && !raHet ? conVon : 0,
        thoat: dangCam,
        ...(bc.ban_bot ? { ban_bot: banBotTien(bc, kq) } : {}),   // D561
      } : la === 'mua_duoi' ? {   // D511 — VÀO/NHỒI tối đa 3 phần (1/3 · 1/3 · phần còn) · CHỐT NỬA (nửa số đã mua, FIFO) · CHỐT HẾT
        vao: vao.length < 3 && conVon > 0 && !raHet ? (vao.length === 2 ? conVon : Math.min(Math.floor(bc.von / 3), conVon)) : 0,
        chot_nua: dangCam > 0 ? Math.min(dangCam, Math.max(1, Math.floor(daVao / 2))) : 0,
        chot_het: dangCam,
        ...(bc.ban_bot ? { ban_bot: banBotTien(bc, kq) } : {}),   // D561
      } : !la && bc.ban_bot_rai ? {   // D586 — màn không lõi (mặc định nắm giữ): BÁN BỚT
        ban_bot: banBotTien(bc, kq),
      } : la === 'luot_song' && bc.luot_song ? {   // D531 — phí của cú bấm kế (ĐẢO = 2 lần khớp) · CHỐT = phần đang cầm
        dao: Math.floor((bc.von * PHI_LS_BP) / 10000) * (kq.ls?.chieu ? 2 : 1),
        chot: kq.ls?.chieu ? dangCam : 0,
      } : laLoiKyQuy(la) ? tienNutDonBay(bc, kq, dangCam) : {},   // D510 — Đòn Bẩy · Bán Khống (chiều bán) cùng bàn phím ký quỹ
      ...(laLoiKyQuy(la) && kq.db ? { db: soDonBay(bc, kq.db) } : {}),
      // D499 — số cú TỰ ĐẨY đã có (tăng ⇒ client nối lại dòng nhịp từ nhịp đang xem để nhận đường có cú đẩy) · GIÁ TRẦN của Tổ Chức đang cầm.
      ...(kq.xungBan.length ? { xung: kq.xungBan.length } : {}),
      ...(kq.giaTran !== undefined ? { gia_tran: tron4(kq.giaTran) } : {}),
      ...(kq.tranThua ? { tran_thua: { nhip: kq.tranThua.nhip } } : {}),
      ...soV59(kq),   // D528
    };
  }
  /**
   * D532 — phần TIN của đầu màn (và câu trả lời cú `mua_tin`): giá mua tin sớm (chỉ lá Lướt Sóng khoá v60, không MÙ TIN) · danh sách tin THẬT sau khi
   * mua (demo `dsTinThat`: không theo thứ tự — xáo theo id) · KIÊN NHẪN thấy trước VỊ TRÍ + uy tín mọi tin (MÙ TIN: chỉ vị trí). ID chữ, không chữ (D26).
   */
  function tinDau(bc: BoiCanhMan, min: readonly NenMin[], lenh: readonly LenhMan[], la: string | null) {
    if (!bc.tin) return {};
    const tin = tinDayDu(bc, min, bc.tung_tin ? gaiCuaMan(lenh) : 0);
    const mua = daMuaTin({ la, ...(bc.luot_song ? { luotSong: true } : {}), ...(bc.mu_tin ? { muTin: true } : {}), lenh });
    const coTheMua = la === 'luot_song' && bc.luot_song === true && bc.mu_tin !== true;
    return {
      ...(bc.mu_tin ? { mu_tin: true as const } : {}),
      ...(coTheMua ? { tin_mua: { phi: Math.floor((bc.von * PHI_TIN_SOM_BP) / 10000), da_mua: mua } } : {}),
      ...(mua ? { tin_that: tin.filter((t) => t.that).sort((a, b) => ((a.id * 7919) % 13) - ((b.id * 7919) % 13)).map((t) => ({ ng: t.ng, chu: t.chu, noi: t.noi })) } : {}),   // noi: màu theo hướng lời nói (demo `mauTin`)
      ...(bc.kien_nhan ? { tin_truoc: tin.map((t) => ({ ci: t.ci, tang: t.tang, ...(bc.mu_tin ? {} : { uy: NGUON_TIN[t.ng].uy }) })) } : {}),
    };
  }
  /**
   * D532 — tin LỘ trong lô nhịp [tu, den] (nhịp lộ = nến mịn của tin × `NHIP_MOI_NEN` — không gửi tin của nhịp chưa tới). MÙ TIN: chỉ vị trí (server
   * không gửi chữ / nguồn / hướng — C4). Đã mua tin sớm: kèm THẬT / NHIỄU. Màn không có tin ⇒ undefined (lô y như cũ).
   */
  function tinLo(bc: BoiCanhMan, min: readonly NenMin[], lenh: readonly LenhMan[], tu: number, den: number) {
    if (!bc.tin) return undefined;
    const la = laCuaMan(bc.loi_cam ?? [], lenh, bc.loi_man);
    const mua = daMuaTin({ la, ...(bc.luot_song ? { luotSong: true } : {}), ...(bc.mu_tin ? { muTin: true } : {}), lenh });
    return tinDayDu(bc, min, bc.tung_tin ? gaiCuaMan(lenh) : 0)
      .filter((t) => { const n = nhipLoTin(t.ci, NHIP_MOI_NEN); return n >= tu && n <= den; })
      .map((t) => tinChoGhe(t, { muTin: bc.mu_tin === true, daMua: mua }));
  }
  /** D528 — phần sổ của khoá v59: lệnh kê (giá theo bp so với giá mở, như cú gửi lên) · Tâm lý yếu · khoản giữ đã bán. Client chỉ hiện (C4). */
  function soV59(kq: KetQuaMan) {
    const bp = (gia: number) => Math.round((gia / kq.giaDau - 1) * 10000);
    const keRa = (b: LenhKe | undefined) => (b ? { gia_bp: bp(b.gia), L: b.L, khop: b.khop, vt: b.vt, huy: b.huy, sua: b.sua } : null);
    return {
      ...(kq.ke ? { ke: { mua: keRa(kq.ke.mua), ban: keRa(kq.ke.ban) } } : {}),
      ...(kq.tly ? { tly: { nhip: kq.tly.nhip } } : {}),
      ...(kq.khoanGiu ? { khoan_giu: { tien: kq.khoanGiu.tien, con: kq.khoanGiu.con } } : {}),
      ...(kq.ls ? { ls: { chieu: kq.ls.chieu, so_dao: kq.ls.soDao, phi: kq.ls.phi } } : {}),   // D531 — Lướt Sóng
    };
  }
  /**
   * D528 — màn có luật TỰ ĐỘNG giữa các cú bấm (lệnh kê khớp · Tâm lý yếu · trần thua khoản giữ): mỗi lô nhịp tính lại sổ tới nhịp CUỐI của lô (không lộ tương
   * lai) ⇒ client thấy lệnh kê vừa khớp, tạm tính đúng vị thế mới. Màn không có luật ấy ⇒ null (lô y như cũ).
   */
  function tuDongCua(bc: BoiCanhMan, lenh: readonly LenhMan[], den: number) {
    if (!bc.ke && !bc.tam_ly_yeu && !bc.tran_thua_giu) return null;
    const la = laCuaMan(bc.loi_cam ?? [], lenh, bc.loi_man), denNhip = Math.max(den, ...lenh.map((x) => x.nhip));
    const kq = ketQuaMan({ min: dungDongManKhop(bc, lenh), ...thamSoKhop(bc), kienNhan: bc.kien_nhan === true, nongVoi: bc.nong_voi === true, la, lenh, denNhip });
    return { ...soV59(kq), ...(kq.tranThua ? { tran_thua: { nhip: kq.tranThua.nhip } } : {}), tt: kq.tamTinh ? kq.tamTinh(den) : null };
  }
  /**
   * D504 — LÃI LỖ TẠM TÍNH của vị thế đang cầm theo nhịp (`KetQuaMan.tamTinh`), dựng MỘT lần mỗi lần mở dòng nhịp từ đúng sổ tới cú bấm cuối
   * (đường GỐC — khớp tự cộng cú đẩy, như `soLenhDaQua`). null = không cầm gì. Mỗi nhịp sau đó chỉ cộng vài phần ⇒ dòng nhịp không nặng thêm.
   */
  function tamTinhCua(bc: BoiCanhMan, lenh: readonly LenhMan[]): { tu: number; f: (k: number) => number } | null {
    const la = laCuaMan(bc.loi_cam ?? [], lenh, bc.loi_man), denNhip = Math.max(-1, ...lenh.map((x) => x.nhip));
    const kq = ketQuaMan({ min: dungDongManKhop(bc, lenh), ...thamSoKhop(bc), kienNhan: bc.kien_nhan === true, nongVoi: bc.nong_voi === true, la, lenh, denNhip });
    return kq.tamTinh ? { tu: Math.max(0, denNhip), f: kq.tamTinh } : null;
  }
  /**
   * D536 — khối lượng từng nến mịn CHẠY + các cú LỆNH LỚN của màn (khoá có `bc.lon`). Khối lượng gồm mọi cú đè lên nến: thanh lý · bầy · lệnh lớn · tin gài ·
   * cú tự đẩy của chính ghế (demo `volXung`). Khoá cũ ⇒ null (lô y như cũ).
   */
  const khoiLuongCua = (bc: BoiCanhMan, du: { min: readonly NenMin[]; xung: readonly XungTl[]; lon: readonly XungLon[]; xungBan: readonly XungBan[] }) =>
    (bc.lon === undefined ? null : {
      vol: khoiLuongChay(du.min, [...du.xung, ...du.lon, ...du.xungBan.map((x) => ({ t0: x.nhip / NHIP_MOI_NEN, mag: x.mag, trai: x.trai / NHIP_MOI_NEN }))]),
      // Nhãn "◆ LỆNH LỚN" bật từ nhịp mở cú tới hết max(1,2 nến hiện, dốc) như demo · AI đặt chỉ gửi cho Tổ Chức (demo `thayChuLenh`).
      lon: du.lon.map((x) => ({ nhip: Math.ceil(x.t0 * NHIP_MOI_NEN), het: Math.ceil((x.t0 + Math.max(1.2 * K_MIN, x.trai)) * NHIP_MOI_NEN), ...(bc.to_chuc ? { ai: x.ai } : {}) })),
    });
  /**
   * D536 — kèm `v` (khối lượng TÍCH LUỸ của nến mịn chứa nhịp, ở chính nhịp ấy — nến đang chạy lớn dần như demo `v × f`) cho từng nhịp của lô, và các
   * cú lệnh lớn MỞ trong lô (không gửi cú của nhịp chưa tới). Không có ⇒ lô giữ nguyên.
   */
  const kemKhoiLuong = <T extends { tu: number; gia: number[] }>(lo: T, kl: ReturnType<typeof khoiLuongCua>): T & { v?: number[]; lon?: { nhip: number; het: number; ai?: string }[] } => {
    if (!kl || !lo.gia.length) return lo;
    const b = lo.tu + lo.gia.length - 1, lon = kl.lon.filter((x) => x.nhip >= lo.tu && x.nhip <= b);
    return { ...lo, v: lo.gia.map((_, i) => { const k = lo.tu + i; return Math.round(((kl.vol[Math.floor(k / NHIP_MOI_NEN)] ?? 0) * ((k % NHIP_MOI_NEN) + 1)) / NHIP_MOI_NEN * 1e3) / 1e3; }), ...(lon.length ? { lon } : {}) };
  };
  /** D504 — kèm `tt` (số tiền tạm tính, server tính) cho từng nhịp ĐÃ LỘ của lô; nhịp trước cú bấm cuối = null. Không cầm ⇒ lô giữ nguyên. */
  const kemTamTinh = <T extends { tu: number; gia: number[] }>(lo: T, tt: ReturnType<typeof tamTinhCua>): T & { tt?: (number | null)[] } =>
    (tt && lo.gia.length ? { ...lo, tt: lo.gia.map((_, i) => (lo.tu + i >= tt.tu ? tt.f(lo.tu + i) : null)) } : lo);
  /**
   * D513 — LỚP SOI của lõi đang cầm ở nhịp CUỐI của lô (giá đang lộ): Bán Khống thấy sàn phe mua · Mua Đuổi mức ép phe khống · Bắt Đáy đáy thác. Chỉ vị thế
   * đã mở + còn sống tới nhịp đó (`soiTai`) — không lộ tương lai. Lõi khác / lô rỗng ⇒ lô giữ nguyên.
   */
  const kemSoi = <T extends { tu: number; gia: number[] }>(lo: T, vt: readonly VtDamDong[], la: string | null, bc?: BoiCanhMan, min?: readonly NenMin[]): T & { soi?: SoiLo } => {
    if (!lo.gia.length) return lo;
    // D523 — màn `gia_tri`: Bắt Đáy thấy ĐƯỜNG GIÁ TRỊ (trễ) + QUÁ BÁN ở nhịp cuối lô, không còn vạch đáy thác (vạch đó là của Bán Khống).
    if (la === 'bat_day' && bc?.gia_tri && min) {
      return { ...lo, soi: { gt: soiGiaTri(min, lo.tu + lo.gia.length - 1, { seed: bc.seed, ma: bc.ma, ...(bc.che_do ? { cheDo: bc.che_do } : {}), ...(bc.nong_voi ? { nongVoi: true } : {}) }) } };
    }
    // D521 — màn `thac_v2`: Bắt Đáy thấy KHOẢNG đáy thác (cỡ cú thật ngẫu nhiên, lớp soi không biết) — mập mờ nhưng đúng tỷ lệ.
    const soi = soiTai(vt, lo.tu + lo.gia.length - 1, lo.gia[lo.gia.length - 1]!, la, bc?.thac_v2 ? { hat: bc.seed } : undefined);
    return soi ? { ...lo, soi } : lo;
  };
  /**
   * D492 — tiền mỗi nút lõi Đòn Bẩy (demo `LOI.don_bay.nut`): chưa vào ⇒ ba nút VÀO ×L (vốn màn) · đã vào ⇒ TĂNG mức kế · BÁN HẾT · CHỐT (khoản đang cầm)
   * + NẠP từ từng khoản (số sẽ lấy). Đã ra / bị thanh lý ⇒ mọi nút 0. "Khoá khi bị gọi" là việc của client theo NGƯỠNG giá (server vẫn tự chặn).
   */
  /** D561 — tiền của cú BÁN BỚT kế: nửa phần khoản còn giữ (0 khi đã VÀO — vốn màn khi ấy là tiền mặt theo lệnh — hoặc đã bán hết). */
  function banBotTien(bc: BoiCanhMan, kq: KetQuaMan): number {
    if (kq.tuDong ? false : kq.vao.length > 0 && !bc.khoan_theo_duong) return 0;   // khoá khoản theo đường: còn khoản thì vẫn bán bớt được (cùng điều kiện với khớp)
    const daBan = kq.ra.filter((x) => x.giu).reduce((a, x) => a + x.tien, 0), con = bc.von - daBan;
    // D586 — khoá v69: phần cố định theo cấp Rải lệnh (một cửa với khớp — `luongBanBot`).
    if (bc.ban_bot_rai) return luongBanBot(bc.von, con, kq.ra.filter((x) => x.giu && x.lyDo === 'ban_bot').length, bc.rai);
    return con > 0 ? Math.max(1, Math.floor(con / 2)) : 0;
  }
  function tienNutDonBay(bc: BoiCanhMan, kq: KetQuaMan, dangCam: number): Record<string, number> {
    const db = kq.db!, xong = db.thanhLy !== null || (kq.ra.length > 0 && dangCam === 0), ra: Record<string, number> = {};
    const vao = db.chieu === -1 ? 'ban_x' : 'vao_x', dong = db.chieu === -1 ? 'mua_lai' : 'chot';   // D510 — Bán Khống: BÁN ×L · MUA LẠI
    const MUC = mucDonBay(bc, db.chieu === -1 ? -1 : 1);   // D561 — Bán Khống ×2 ở khoá v65: nút ×4 · ×10 · TĂNG không có
    for (const L of MUC) ra[`${vao}${L}`] = !xong && kq.vao.length === 0 ? bc.von : 0;
    const i = MUC.indexOf(db.L), ke = i >= 0 ? MUC[i + 1] : undefined;
    for (const L of MUC.slice(1)) ra[`tang_x${L}`] = !xong && dangCam > 0 && ke === L ? bc.von : 0;
    // D507 — BÁN HẾT dồn mọi khoản nguồn (kể cả Tiền mặt) vào ký quỹ: số = tổng khoản còn (chưa trừ phí); 0 ⇒ nút tắt. Chỉ khớp khi đang bị gọi.
    ra['ban_het'] = !xong && dangCam > 0 && db.banHet === null ? Object.values(napCon(bc, db)).reduce((a, x) => a + Math.max(0, x), 0) : 0;
    ra[dong] = !xong ? dangCam : 0;
    for (const [ma, con] of Object.entries(napCon(bc, db))) ra[`nap_${ma}`] = !xong && dangCam > 0 ? Math.min(Math.floor(bc.von * NAP_TY_LE), con) : 0;
    return ra;
  }
  /** D492 — phần còn lại của từng khoản nguồn NẠP sau các cú nạp đã khớp. */
  function napCon(bc: BoiCanhMan, db: KetQuaDonBay): Record<string, number> {
    const con: Record<string, number> = { ...(bc.nap_tu ?? {}) };
    for (const n of db.nap) con[n.ma] = (con[n.ma] ?? 0) - n.lay;
    return con;
  }
  /** D492 — phần Đòn Bẩy của sổ giữa màn: mức · ký quỹ · nạp · NGƯỠNG giá gọi/thanh lý theo nhịp (client chỉ so giá — C4). */
  function soDonBay(bc: BoiCanhMan, db: KetQuaDonBay) {
    const tron4 = (x: number) => Math.round(x * 1e4) / 1e4;
    return {
      L: db.L, ky_quy: bc.von + db.napNhan, nap_nhan: db.napNhan, da_goi: db.daGoi,
      chieu: db.chieu,   // D510 — −1 Bán Khống: ngưỡng gọi / mua cưỡng bức nằm TRÊN giá, client so giá ≥ ngưỡng (C4 — chỉ so giá)
      nap: db.nap.map((n) => ({ ma: n.ma, lay: n.lay, phi: n.phi, nhan: n.nhan, nhip: n.nhip, luc: n.luc })),
      nap_con: napCon(bc, db),
      // Phí bán của cú nạp KẾ từ mỗi khoản (demo hộp NẠP in "bán X · phí Y") — số do server tính, client chỉ in (C4).
      nap_phi: Object.fromEntries(Object.entries(napCon(bc, db)).map(([ma, con]) => [ma, ma === MA_TIEN_MAT ? 0   // D507 — Tiền mặt không phí
        : Math.floor((Math.min(Math.floor(bc.von * NAP_TY_LE), con) * ((MA_MINIGAME[ma]?.truot ?? 0) + PHI_BAN_BP)) / 10000)])),
      ...(db.banHet !== null ? { ban_het: db.banHet } : {}),   // D507 — nhịp đã BÁN HẾT (dồn ký quỹ)
      thanh_ly: db.thanhLy ? { nhip: db.thanhLy.nhip, ban_het: db.thanhLy.banHet === true } : null,
      nguong: db.nguong ? { tu: db.nguong.tu, goi: db.nguong.goi.map(tron4), thanh_ly: db.nguong.thanhLy.map(tron4) } : null,
    };
  }

  app.post('/api/v1/holdem/matches/:id/minigame', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      await chanTanSuat(userId, 'mg_nhip', GIOI_HAN.MG_NHIP_MOI_GIO);
      const body = await c.req.json().catch(() => ({}));
      const vong = Number(body?.vong);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const t = await layTran(c.req.param('id'), userId, client, true);
        const daCo = await client.query('SELECT 1 FROM holdem_minigame_man WHERE match_id = $1 AND vong = $2', [t.matchId, vong]);
        if (daCo.rowCount === 0) {
          const rp = replay(t.seed, t.log, false, t.ghe ?? undefined, t.luat, t.moBangCho, t.duBaoCho, t.soO, t.khopCho), st = rp.st;
          if (st.dong_ho_minigame !== true) throw new HoldemError(403, 'luat_tat', 'Luật của trận này không có màn minigame.');
          if (!Number.isInteger(vong) || t.log.length !== vong || !coManMinigame(vong, st.map.o.length, st.nhip_xen_ke === true)) {
            throw new HoldemError(409, 'sai_vong', `Màn chỉ mở cho vòng vừa nộp (vòng ${t.log.length}).`);
          }
          const nguoi = st.ghe.find((g) => g.id === 'ban')!;
          // D475 — MỘT nguồn với quyết toán (`boiCanhCuaGhe` — D482/D483: kèm đòn bẩy + TUNG TIN của ghế); kèm lõi đang cầm cho màn CHỌN LÁ.
          const bc0 = boiCanhNguoi(st, Number(t.seed), vong, nguoi, rp.loiSuatCongCuoi);   // D479 — neo % engine của vòng vừa chốt · D561 — kèm màn con
          if ('loi' in bc0) throw new HoldemError(409, bc0.loi, mgLoi(bc0.loi));
          const loiCam = [...new Set(nguoi.danh_muc.chien_thuat as readonly string[])];
          // D561 — khoá v65: lõi của màn chốt LÚC NỘP VÒNG (không chọn ⇒ mặc định của `laCuaMan`) ⇒ màn không có pha chọn lá.
          const loiMan = st.loi_chon_truoc === true ? laCuaMan(loiCam, [], t.log[vong - 1]?.loi_man) ?? undefined : undefined;
          const loiX = { loi_cam: loiCam, ...(loiMan ? { loi_man: loiMan } : {}) };
          const bc: BoiCanhMan = { ...bc0, ...loiX, ...(bc0.nhieu ? { nhieu: bc0.nhieu.map((x: BoiCanhMan) => ({ ...x, ...loiX })) } : {}) };
          /*
           * D473 (founder 04/10: *"Màn tự mở sau chốt vòng đúng timeline để đồng bộ thời gian giữa mọi người"*) — giờ màn neo vào LÚC CHỐT
           * vòng (`vong_mo_luc` của vòng kế), không vào lúc ai đó bấm mở: lật thẻ + chọn lá rồi mới đếm ngược. Người mở muộn vào giữa màn,
           * đúng như mọi người khác. Trận không đồng hồ (miễn giờ) không có lịch chung ⇒ đếm từ lúc mở.
           */
          const batDau = t.vongMoLuc && !vongMienGio(t, vong + 1)
            ? new Date(t.vongMoLuc.getTime() + (DONG_HO_MINIGAME.LAT_THE_S + giayChonLa(st.loi_chon_truoc === true)) * 1000)
            : new Date();
          await client.query(
            `INSERT INTO holdem_minigame_man (match_id, vong, phien_ban, boi_canh, bat_dau) VALUES ($1, $2, $3, $4, $5)`,
            [t.matchId, vong, MINIGAME_DONG_GIA_VERSION, JSON.stringify(bc), batDau]);
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
      const m = xemMa(await layMan(c.req.param('id'), vong, userId), c.req.query('ma'));   // D561 — `?ma=`: khung nhìn mã khác
      const now = Date.now();
      return c.json({ ...dauMan(vong, m.bc, m.batDau, dungDongManKhop(m.bc, m.lenh), now, m.lenh, m.goc), nhip_may: nhipMay(m.batDau, now) });
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  /*
   * D475 — KẾT QUẢ + QUYẾT TOÁN của màn vòng vừa nộp, SAU khi màn hết giờ. Chính con số đã áp vào NAV vòng đang chơi (đuôi `manCho` của
   * replay — một nguồn với `mg` sẽ ghi lúc nộp). Số + id; chữ ở client (D26).
   */
  app.get('/api/v1/holdem/matches/:id/minigame/:vong/ket-qua', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      const vong = Number(c.req.param('vong'));
      const t = await layTran(c.req.param('id'), userId);
      if (t.luat.dongHoMinigame !== true) throw new HoldemError(403, 'luat_tat', 'Luật của trận này không có màn minigame.');
      if (t.manChuaXong && t.log.length === vong) throw new HoldemError(409, 'chua_het', 'Màn chưa chạy xong.');
      // D481 — màn VÒNG CUỐI đã khép trận (`mg_sau` đã chép): dựng lại kết quả từ dòng màn đã lưu, trên log bỏ `mg_sau` (cùng số đã áp).
      let manCho = t.manCho, logDung: readonly HanhDongLog[] = t.log;
      const cuoi = t.log[t.log.length - 1];
      if (!manCho && t.status === 'xong' && cuoi?.mg_sau && vong === t.log.length) {
        const mq = await pool.query('SELECT boi_canh, lenh FROM holdem_minigame_man WHERE match_id = $1 AND vong = $2', [t.matchId, vong]);
        const mr = mq.rows[0] as { boi_canh: BoiCanhMan; lenh: LenhMan[] | null } | undefined;
        manCho = { vong, lenh: mr?.lenh ?? [], ...(mr ? { bc: mr.boi_canh } : {}) };
        logDung = t.log.map((h, i) => (i === t.log.length - 1 ? (({ mg_sau: _bo, ...con }) => con)(h) : h));
      }
      if (!manCho || manCho.vong !== vong) throw new HoldemError(404, 'not_found', 'Chỉ xem được kết quả màn của vòng vừa nộp.');
      const r = replay(t.seed, logDung, false, t.ghe ?? undefined, t.luat, t.moBangCho, t.duBaoCho, t.soO, t.khopCho, manCho);
      const kq = r.manKetQua;
      if (!kq) throw new HoldemError(404, 'khong_co_ma', mgLoi('khong_co_ma'));
      const tron4 = (x: number) => Math.round(x * 1e4) / 1e4;
      // D494 — các cú bán cưỡng bức của dây chuyền trong màn (VÌ SAO: "bán cưỡng bức · n vị thế · cá mập ×4 → đám đông ×10").
      const tl = manCho.bc ? dungDongManDu(manCho.bc, manCho.lenh).tl : [];
      return c.json({
        vong, ma: kq.ma, von: kq.von, la: kq.la, tl: tl.map((e) => ({ nhip: e.nhip, ai: e.ai, L: e.L })), nut: nutLoiCua(kq.la, manCho.bc?.luot_song, manCho.bc?.ban_bot, manCho.bc?.ban_bot_rai, manCho.bc?.ba_phan) ?? [],
        // D479 — khoản chạy theo đường: vốn màn `von` (trước thị trường) · giữ suốt `giu` (engine đã cộng) · theo lệnh `theo_lenh` · màn = chênh.
        von_sau: kq.von_sau, loi: kq.loi, giu: kq.giu, theo_lenh: kq.theoLenh, cham_tran: kq.chamTran, tu_dong: kq.tuDong,
        phi_gai: kq.phiGai,   // D483 — đã trừ trong `loi` (loi = theo_lenh − giu − phi_gai)
        ...(kq.phiTin ? { phi_tin: kq.phiTin } : {}),   // D532 — phí MUA TIN SỚM, cũng đã trừ trong `loi`
        ...(kq.vet ? { vet: kq.vet } : {}),   // D521 — tiền do vết thác (đã gồm trong `loi`: loi = theo_lenh − giu + vet − phi_gai)
        // D492 — Đòn Bẩy: mức · cú nạp (khoản nguồn bị trừ `lay`; `loi` đã gồm `nap_nhan`) · bị thanh lý / BÁN HẾT · từng bị gọi · các cú TĂNG.
        ...(kq.db ? { db: {
          L: kq.db.L, L0: kq.db.L0, nap_nhan: kq.db.napNhan, da_goi: kq.db.daGoi,
          nap: kq.db.nap.map((n) => ({ ma: n.ma, lay: n.lay, phi: n.phi, nhan: n.nhan, nhip: n.nhip, luc: n.luc })),   // D507 — `luc: 'ban_het'`
          thanh_ly: kq.db.thanhLy ? { nhip: kq.db.thanhLy.nhip, gia: tron4(kq.db.thanhLy.gia), ban_het: kq.db.thanhLy.banHet === true } : null,
          tang: kq.db.tang.map((x) => ({ nhip: x.nhip, tu: x.tu, len: x.len })),
        } } : {}),
        // Mã KHÁC đang cầm: giữ suốt màn theo % thị trường của vòng (khoản trước → sau) — dòng QUYẾT TOÁN + bảng phụ.
        ma_khac: Object.entries(r.st.ghe.find((g) => g.id === 'ban')?.vi_the ?? {}).filter(([ma, v]) => ma !== kq.ma && v > 0 && !r.manKetQuaNhieu?.some((x) => x.ma === ma))
          .map(([ma, v]) => {
            const bp = r.loiSuatCongCuoi?.[ma] ?? 0;
            return { ma, von_truoc: 1 + bp / 10000 > 0.01 ? Math.round(v / (1 + bp / 10000)) : v, von_sau: v, bp };
          }),
        vao: kq.vao.map((x) => ({ tien: x.tien, khop: tron4(x.khop), nhip: x.nhip, loai: x.loai })),
        ra: kq.ra.map((x) => ({ tien: x.tien, ra: tron4(x.ra), nhip: x.nhip, lai: x.lai, tu_dong_cuoi: x.tuDongCuoi === true, cuoi_khoa: x.cuoiKhoa === true, ...(x.lyDo ? { ly_do: x.lyDo } : {}), ...(x.giu ? { giu: true } : {}) })),   // D528 — `giu`: bán KHOẢN GIỮ
        ...soV59(kq),   // D528 — lệnh kê · Tâm lý yếu · khoản giữ
        hut: kq.hut, gia_dau: tron4(kq.giaDau), day: tron4(kq.day), dinh: tron4(kq.dinh), gia_cuoi: tron4(kq.giaCuoi), nhan: kq.nhan,
        // D561 — khoá úp lá pha: mặt lá ô pha của vòng (lúc màn chạy chỉ là lá úp) — màn lật ở KẾT QUẢ.
        ...((() => { const o = r.st.map.o[r.st.o_up === true ? vong : vong - 1]; return o && upLaPha(r.st, vong, o) ? { the_vong: oCongKhai(o) } : {}; })()),
        // D561 — khoá nhiều mã: kết quả từng màn con (mã · vốn = cả khoản · theo lệnh · lãi lỗ so với giữ) — dòng QUYẾT TOÁN mỗi mã một cặp.
        ...(r.manKetQuaNhieu?.length ? { nhieu: r.manKetQuaNhieu.map((x) => ({
          ma: x.ma, von: x.von, von_sau: x.von_sau, loi: x.loi, giu: x.giu, theo_lenh: x.theoLenh, tu_dong: x.tuDong,
          vao: x.vao.length, ra: x.ra.filter((y) => !y.tuDongCuoi).length,
        })) } : {}),
        // D479 — NAV đầu vòng (trước lệnh + thị trường) → NAV sau màn: cả vòng gồm thị trường lẫn màn, như QUYẾT TOÁN của demo.
        // D492 — khoản nạp đã trừ (`mg.nap`) cũng là một phần của NAV sau màn. D561 — + lãi lỗ các màn con.
        nav_truoc: r.navTruocCuoi, nav_sau: r.navTruocMan === null ? null
          : r.navTruocMan + (r.mgCho?.['ban']?.loi ?? 0) + (r.mgCho?.['ban']?.them ?? []).reduce((a, x) => a + x.loi, 0)
            - Object.values(r.mgCho?.['ban']?.nap ?? {}).reduce((a, x) => a + x, 0),
      });
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  app.get('/api/v1/holdem/matches/:id/minigame/:vong/nhip', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      await chanTanSuat(userId, 'mg_nhip', GIOI_HAN.MG_NHIP_MOI_GIO);
      const vong = Number(c.req.param('vong'));
      const maXin = c.req.query('ma');
      const m = xemMa(await layMan(c.req.param('id'), vong, userId), maXin);   // D561 — `?ma=`: khung nhìn mã khác
      // D494 — kèm cú bán cưỡng bức của dây chuyền (gửi dần theo lô) · D499 — đường NGƯỜI CHƠI THẤY: cộng cú tự đẩy giá của chính lệnh đã ghi.
      let du = dungDongManNhin(m.bc, m.lenh), min = du.min, kl = khoiLuongCua(m.bc, du);   // D536 — khối lượng + lệnh lớn
      const tt = tamTinhCua(m.bc, m.lenh);   // D504 — lãi lỗ tạm tính (số tiền) gửi kèm từng nhịp đã lộ
      const laSoi = laCuaMan(m.bc.loi_cam ?? [], m.lenh, m.bc.loi_man);   // D513 — lớp soi theo lõi đang cầm
      // D484 — bảng phụ · D507: + cú bán BÁN HẾT của chính ghế (vai lớn) · D561 — khoá nhiều mã: đường THẬT của các màn khác.
      const phu = m.goc.nhieu?.length ? duongNhieuNhin(m.goc, m.lenhGoc, m.bc.ma) : duongPhuNhin(m.bc, du.xungKhoan);
      // D483 — luồng mở TRƯỚC nhịp 0 (lật thẻ / chọn lá / đếm) mà ghế được gài tin: cú gài nhận tới nhịp 0 ⇒ dựng lại đường lúc màn chạy.
      let canDungLai = m.bc.tung_tin === true && Date.now() < m.batDau + DEM_MS;
      const tuXin = Number(c.req.query('tu') ?? 0);
      let tu = Number.isInteger(tuXin) && tuXin > 0 ? Math.min(tuXin, SO_NHIP) : 0;
      const daLo = () => Math.min(nhipMay(m.batDau, Date.now()), SO_NHIP - 1);
      if (c.req.query('mot_lan') === '1') {
        const now = Date.now(), den = Math.min(nhipMay(m.batDau, now), SO_NHIP - 1);
        const td = den >= 0 ? tuDongCua(m.bc, m.lenh, den) : null;   // D528
        const tl = den >= 0 ? tinLo(m.bc, min, m.lenh, tu, den) : undefined;   // D532
        return c.json({ dau: dauMan(vong, m.bc, m.batDau, min, now, m.lenh, m.goc), lo: { ...kemKhoiLuong(kemSoi(kemTamTinh(loNhip(min, tu, den, phu, du.tl), tt), du.vt, laSoi, m.bc, min), kl), ...(td ? { tu_dong: td } : {}), ...(tl?.length ? { tin: tl } : {}) }, het: den >= SO_NHIP - 1 });
      }
      c.header('content-type', 'application/x-ndjson; charset=utf-8');
      c.header('cache-control', 'no-store');
      return stream(c, async (s) => {
        const moLuc = Date.now();
        await s.write(JSON.stringify({ loai: 'dau', ...dauMan(vong, m.bc, m.batDau, min, moLuc, m.lenh, m.goc) }) + '\n');
        for (;;) {
          const den = daLo();
          if (canDungLai && Date.now() >= m.batDau + DEM_MS) {
            canDungLai = false;
            const m2 = xemMa(await layMan(c.req.param('id'), vong, userId), maXin);
            du = dungDongManNhin(m2.bc, m2.lenh); min = du.min; kl = khoiLuongCua(m2.bc, du);
          }
          if (den >= tu) {
            const td = tuDongCua(m.bc, m.lenh, den);   // D528 — lệnh kê khớp · Tâm lý yếu · trần thua khoản giữ tới nhịp cuối lô
            const tl = tinLo(m.bc, min, m.lenh, tu, den);   // D532 — tin lộ trong lô
            await s.write(JSON.stringify({ loai: 'nhip', ...kemKhoiLuong(kemSoi(kemTamTinh(loNhip(min, tu, den, phu, du.tl), tt), du.vt, laSoi, m.bc, min), kl), ...(td ? { tu_dong: td } : {}), ...(tl?.length ? { tin: tl } : {}) }) + '\n');
            tu = den + 1;
          }
          if (tu >= SO_NHIP) { await s.write('{"loai":"het"}\n'); return; }
          if (s.aborted) return;
          if (Date.now() - moLuc >= DONG_TOI_DA_MS) { await s.write(JSON.stringify({ loai: 'noi_lai', tu }) + '\n'); return; }
          await s.sleep(LO_NHIP_MS - ((Date.now() - moLuc) % LO_NHIP_MS));
        }
      });
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  app.post('/api/v1/holdem/matches/:id/minigame/:vong/lenh', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const userId = uid(actor);
      await chanTanSuat(userId, 'mg_lenh', GIOI_HAN.MG_LENH_MOI_GIO);
      const body = await c.req.json().catch(() => ({}));
      const nhip = Number(body?.nhip);
      const nut = typeof body?.nut === 'string' && /^[a-z][a-z0-9_]{0,23}$/.test(body.nut) ? body.nut as string : null;
      // D475 — chỉ nút có thật: nút của một lõi trong màn, hoặc CHỌN LÁ `la_<lõi>`. Nút đúng mà sai lõi thì quyết toán bỏ qua (`ketQuaMan`).
      const laChonLa = !!nut && nut.startsWith(TIEN_TO_CHON_LA) && CHIEN_THUAT.some((x) => x.id === nut.slice(TIEN_TO_CHON_LA.length));
      // D483 — GÀI TIN (TUNG TIN của Đội lái): `gai_tot` / `gai_xau`, trước khi màn chạy, một lần.
      const laGai = !!nut && Object.prototype.hasOwnProperty.call(NUT_GAI, nut);
      // D528 — KÊ LỆNH (trait KÊ MUA / KÊ BÁN): `ke_mua` · `ke_ban` kèm `gia_bp` (nguyên, so với giá mở màn) + `L` (lệnh mở ký quỹ); huỷ `ke_huy_*`.
      const laKe = !!nut && (NUT_KE as readonly string[]).includes(nut);
      // D532 — Lướt Sóng MUA TIN SỚM: trước khi màn chạy, một lần (demo `veTruocMan`).
      const laMuaTin = nut === 'mua_tin';
      const giaBp = laKe && !nut!.startsWith('ke_huy_') ? Number(body?.gia_bp) : undefined;
      if (giaBp !== undefined && (!Number.isInteger(giaBp) || Math.abs(giaBp) > KE_LENH.TRAN_BP)) throw new HoldemError(400, 'ke_gia_sai', 'Giá lệnh kê không hợp lệ.');
      const kL = laKe && body?.L !== undefined ? Number(body.L) : undefined;
      if (kL !== undefined && !(MUC_DON_BAY as readonly number[]).includes(kL)) throw new HoldemError(400, 'ke_L_sai', 'Mức đòn bẩy không hợp lệ.');
      // D561 — `ban_bot` ngoài bảng tĩnh (chỉ khoá v65); khớp lọc theo `nutLoiCua` của chính màn nên khoá cũ bấm nút này không có tác dụng.
      if (!nut || !(laChonLa || laGai || laKe || laMuaTin || nut === NUT_BAN_BOT || nut === NUT_VAY_X2 || Object.values(NUT_LOI).some((ds) => ds.includes(nut)))) throw new HoldemError(400, 'nut_sai', 'Nút không hợp lệ.');
      const khoa = typeof body?.khoa === 'string' && body.khoa.length > 0 && body.khoa.length <= 64 ? body.khoa as string : null;
      const vong = Number(c.req.param('vong'));
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const m0 = await layMan(c.req.param('id'), vong, userId, client, true);
        // D561 — khoá nhiều mã: lệnh đánh trên màn con `body.ma` (vắng = mã chính). Chọn lá · gài tin · mua tin là việc của CẢ màn ⇒ chỉ mã chính.
        const m = xemMa(m0, body?.ma);
        const laMaPhu = m.bc !== m0.bc;
        if (laMaPhu && (laChonLa || laGai || laMuaTin)) throw new HoldemError(400, 'ma_sai', 'Việc này làm ở mã chính của màn.');
        const min = dungDongManKhop(m.bc, m.lenh);
        // Gửi lại cùng khoá (mạng chập chờn) ⇒ trả đúng cú đã ghi, không ghi thêm, không báo lỗi.
        const cu = khoa ? m0.lenh.find((x) => x.khoa === khoa) : undefined;
        if (cu) {
          await client.query('ROLLBACK');
          return c.json({ nhan: true, da_ghi_truoc_do: true, seq: cu.seq, nhip: cu.nhip, ...(cu.nhip >= 0 ? { gia: loNhip(min, cu.nhip, cu.nhip).gia[0] } : {}) });
        }
        const nhipNay = nhipMay(m.batDau, Date.now());
        if (laChonLa) {
          // CHỌN LÁ chỉ trước khi màn chạy (pha chọn lá + đếm ngược); ghi ở nhịp −1.
          if (nhipNay >= 0) throw new HoldemError(409, 'het_chon_la', 'Màn đã chạy — hết giờ chọn lá.');
        } else if (laGai) {
          if (m.bc.tung_tin !== true) throw new HoldemError(403, 'khong_tung_tin', 'Ghế của bạn không mang trait TUNG TIN.');
          if (nhipNay >= 0) throw new HoldemError(409, 'het_chon_la', 'Màn đã chạy — hết giờ gài tin.');
          if (gaiCuaMan(m.lenh) !== 0) throw new HoldemError(409, 'da_gai', 'Màn này đã gài tin.');
        } else if (laMuaTin) {
          const laNay = laCuaMan(m.bc.loi_cam ?? [], m.lenh, m.bc.loi_man);
          if (laNay !== 'luot_song' || m.bc.luot_song !== true || !m.bc.tin) throw new HoldemError(403, 'khong_mua_tin', 'Chỉ lõi Lướt Sóng mua được tin sớm.');
          if (m.bc.mu_tin === true) throw new HoldemError(403, 'mu_tin', 'MÙ TIN: không mua tin sớm được.');
          if (nhipNay >= 0) throw new HoldemError(409, 'het_chon_la', 'Màn đã chạy — hết giờ mua tin sớm.');
          if (daMuaTin({ la: laNay, luotSong: true, lenh: m.lenh })) throw new HoldemError(409, 'da_mua_tin', 'Màn này đã mua tin sớm.');
        } else if (laKe) {
          // D528 — lệnh kê đặt được cả trong đếm ngược (ghi nhịp −1, so với giá mở) và trước mốc mở của Kiên Nhẫn; hết cửa Nóng Vội thì thôi.
          const ben = nut.endsWith('mua') ? 'mua' : 'ban';
          if (!m.bc.ke?.[ben]) throw new HoldemError(403, 'khong_ke', ben === 'mua' ? 'Ghế của bạn không mang trait KÊ MUA.' : 'Ghế của bạn không mang trait KÊ BÁN.');
          if (nhipNay >= 0) {
            const kq = kiemNhipLenh(nhip, nhipNay);
            if (kq !== 'ok') throw new HoldemError(kq === 'ngoai_man' ? 400 : 409, kq, mgLoi(kq));
            const cua = cuaSoTrait({ kienNhan: m.bc.kien_nhan === true, nongVoi: m.bc.nong_voi === true });
            if (nhip >= cua.den) throw new HoldemError(409, 'trait_khoa', 'Nóng Vội: đã hết giờ bấm.');
          }
          if (giaBp !== undefined) {
            const g0 = min[NEN_LS * K_MIN - 1]!.c, gNay = nhipNay >= 0 ? loNhip(min, nhip, nhip).gia[0]! : g0, gia = g0 * (1 + giaBp / 10000);
            if (ben === 'mua' ? gia >= gNay : gia <= gNay) throw new HoldemError(409, 'ke_sai_phia', ben === 'mua' ? 'Lệnh mua phải nằm dưới giá đang chạy.' : 'Lệnh bán phải nằm trên giá đang chạy.');
          }
        } else {
          const kq = kiemNhipLenh(nhip, nhipNay);
          if (kq !== 'ok') {
            throw new HoldemError(kq === 'ngoai_man' ? 400 : 409, kq, mgLoi(kq));
          }
          // D486 — ngoài cửa sổ bấm của trait (Kiên Nhẫn chưa mở · Nóng Vội đã hết) ⇒ không nhận (khớp cũng bỏ qua).
          const cua = cuaSoTrait({ kienNhan: m.bc.kien_nhan === true, nongVoi: m.bc.nong_voi === true });
          if (nhip < cua.tu || nhip >= cua.den) throw new HoldemError(409, 'trait_khoa', nhip < cua.tu ? 'Kiên Nhẫn: chưa tới giờ bấm.' : 'Nóng Vội: đã hết giờ bấm.');
        }
        if (m0.lenh.length >= TRAN_LENH_MOI_MAN) throw new HoldemError(409, 'qua_nhieu_lenh', 'Màn này đã đủ số lệnh.');
        const seq = m0.lenh.length + 1;
        // ⚠ CỬA MỘT CHIỀU — định dạng cú bấm (0073). Chỉ THÊM trường; `nguon` 'trait' / 'tu_dong' do server tự ghi ở bước 4.
        const nhipGhi = laChonLa || laGai || laMuaTin || (laKe && nhipNay < 0) ? -1 : nhip;
        const lenh = { seq, nhip: nhipGhi, nhip_may: nhipNay, nut, nguon: 'nguoi' as const, ...(khoa ? { khoa } : {}),
          ...(giaBp !== undefined ? { gia_bp: giaBp } : {}), ...(kL !== undefined ? { L: kL } : {}),   // D528 — chỉ THÊM trường
          ...(laMaPhu ? { ma: m.bc.ma } : {}) };   // D561 — màn con
        await client.query(
          `UPDATE holdem_minigame_man SET lenh = lenh || $3::jsonb WHERE match_id = $1 AND vong = $2`,
          [c.req.param('id'), vong, JSON.stringify([lenh])]);
        await client.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
           VALUES ($1, 'holdem', $2, 'mg_lenh', $3)`,
          [userId, c.req.param('id'), JSON.stringify({
            vong, seq, nhip: lenh.nhip, nhip_may: nhipNay, nut, nguon: 'nguoi', ma: m.bc.ma, phien_ban: MINIGAME_DONG_GIA_VERSION,
            ...(giaBp !== undefined ? { gia_bp: giaBp } : {}), ...(kL !== undefined ? { L: kL } : {}),   // D528
          })]);
        await client.query('COMMIT');
        const tatCa = [...m.lenh, lenh], la = laCuaMan(m.bc.loi_cam ?? [], tatCa, m.bc.loi_man);
        return c.json({
          nhan: true, seq, nhip: lenh.nhip, ...(laChonLa || laGai || laMuaTin || lenh.nhip < 0 ? {} : { gia: loNhip(min, nhip, nhip).gia[0] }),
          la, nut: nutLoiCua(la, m.bc.luot_song, m.bc.ban_bot, m.bc.ban_bot_rai, m.bc.ba_phan) ?? [], so: soLenhDaQua(min, m.bc, la, tatCa),
          ...(m.bc.tung_tin ? { gai: { phi: Math.floor((m.bc.von * PHI_GAI_BP) / 10000), chieu: gaiCuaMan(tatCa) } } : {}),
          ...tinDau(m.bc, min, tatCa, la),   // D532 — mua xong ⇒ danh sách tin thật
        });
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  // ── Tổng kết ────────────────────────────────────────────────────────────
  app.get('/api/v1/holdem/matches/:id/autopsy', ...guard, async (c) => {
    const actor = c.get('actor');
    try {
      const t = await layTran(c.req.param('id'), uid(actor));
      /*
       * D337 — `pcTheoGhe` này (KHÔNG tính lại) là nguồn khoá-theo-thứ-hạng cho
       * mọi ghế TRỪ 'ban' — xem chú thích dài ở cục `phong_cach:` phía dưới.
       */
      const { st, kyNgo, pcTheoGhe } = replay(
        t.seed, t.log, false, t.ghe ?? undefined, t.luat, t.moBangCho, t.duBaoCho, t.soO,
        t.khopCho, t.manCho);

      /*
       * ⚠ CỔNG BẮT BUỘC: CHỈ TRẢ KHI TRẬN ĐÃ XONG.
       *
       * Endpoint này trả `map_da_lo: st.map.o` = TOÀN BỘ map kèm cờ `la_tin_gia`,
       * cộng danh mục của mọi đối thủ. Comment bên dưới vẫn ghi đúng bất biến
       * ("trước đó là thông tin ẩn") nhưng TRƯỚC 25/07/2026 không một dòng code
       * nào thực thi nó — khác hẳn `/rounds` và `/luot`, hai endpoint đều kiểm
       * trạng thái. Bất biến chỉ tồn tại trong comment là bất biến không tồn tại.
       *
       * Đo được trên trận thật: đang ở VÒNG 1, gọi endpoint này trả về `xong:false`
       * kèm đủ 8 ô của map. Tức ai mở F12 là biết trước từng ô sắp lật và tin nào
       * là bịa — thắng mọi ván, và tệ hơn: theo A1, "% vốn đặt vào = độ tự tin"
       * không còn phản ánh niềm tin nào nữa, tức PHÁ CHÍNH TÀI SẢN DỮ LIỆU.
       *
       * Test cũ không bắt được vì chỉ gọi SAU khi trận kết thúc (tests/holdem_api
       * .test.ts) — kiểm "khi xong thì trả đúng", chưa bao giờ kiểm "khi CHƯA xong
       * thì có từ chối không".
       *
       * Trả 409 chứ không trả payload rút gọn: mục đích duy nhất của endpoint là
       * mổ xẻ SAU trận, nên nửa vời chỉ tạo thêm một bề mặt phải canh.
       */
      if (!tranKhepLai(st)) {
        throw new HoldemError(409, 'chua_xong',
          'Trận chưa kết thúc — bản mổ xẻ chỉ mở sau khi lật hết ô.');
      }

      const hang = xepHang(st);
      /*
       * Điểm xếp hạng của trận — đọc từ `holdem_results`, không tính lại. Một
       * lookup theo index `(match_id)`; ghế nào không có dòng thì không có điểm.
       */
      const diemQ = await pool.query(
        `SELECT ghe_id, diem_truoc, diem_sau FROM holdem_results WHERE match_id = $1`,
        [t.matchId]);
      const diemTheoGhe = new Map<string, { truoc: number | null; sau: number | null }>(
        diemQ.rows.map((r) => [String(r.ghe_id), {
          truoc: r.diem_truoc === null ? null : Number(r.diem_truoc),
          sau: r.diem_sau === null ? null : Number(r.diem_sau),
        }]));
      /*
       * 16/08 — "HÔM NAY BẠN VỪA CHẠM": dây chuyền của CHÍNH người chơi qua các
       * vòng, đọc từ `hd_chot_phien` (append-only, cùng nguồn insight D73) chứ
       * không từ replay — engine không giữ dây chuyền từng vòng, và bịa lại từ
       * trạng thái cuối là bịa. Trận cũ thiếu dòng ⇒ mảng rỗng ⇒ khối im.
       * Xếp theo `vong` trong value_json (không theo ts): ts là giờ ghi, vòng
       * mới là thứ tự người chơi đã sống qua.
       */
      const chotPhien = await pool.query(
        `SELECT value_json, value_num, action_type FROM events
          WHERE user_id = $1 AND context_type = 'holdem' AND context_id = $2
            AND action_type IN ('hd_chot_phien', 'hd_brier_vong', 'hd_cam_ket')
          ORDER BY (value_json->>'vong')::int ASC, ts ASC`,
        [uid(actor), t.matchId]);
      const chains: MatXich[][] = [];
      const pnlVong: (number | null)[] = [];
      const brierVong: (number | null)[] = [];
      /** D105 — chợ đổi bao nhiêu (trung vị lợi suất mã) và vòng nào bị chốt hộ. */
      const choVong: (number | null)[] = [];
      const tuDongVong: boolean[] = [];
      for (const r of chotPhien.rows) {
        const v = Number((r.value_json as { vong?: unknown })?.vong);
        if (!Number.isInteger(v) || v < 1) continue;
        if (r.action_type === 'hd_brier_vong') {
          brierVong[v - 1] = r.value_num === null ? null : Number(r.value_num);
          continue;
        }
        if (r.action_type === 'hd_cam_ket') {
          tuDongVong[v - 1] = (r.value_json as { tu_dong?: unknown })?.tu_dong === true;
          continue;
        }
        const cb = (r.value_json as { cho_bp?: unknown })?.cho_bp;
        choVong[v - 1] = typeof cb === 'number' ? cb : null;
        const chain = (r.value_json as { chain?: unknown })?.chain;
        if (Array.isArray(chain)) chains[v - 1] = chain as MatXich[];
        pnlVong[v - 1] = r.value_num === null ? null : Number(r.value_num);
      }
      const duong = duongNav(t);
      /*
       * Brier trung bình của các trận TRƯỚC (không tính trận này) — một câu gộp,
       * dùng index `events(user_id, ts)`; trận nào không có dòng Brier nào thì
       * không có mặt, đúng luật "toàn tiền mặt = không dự báo" (D67).
       */
      const brTruoc = await pool.query(
        `SELECT AVG(value_num)::float8 AS tb
           FROM events
          WHERE user_id = $1 AND context_type = 'holdem'
            AND action_type = 'hd_brier_vong' AND context_id <> $2
          GROUP BY context_id`,
        [uid(actor), t.matchId]);
      const brierTranTruoc = brTruoc.rows
        .map((r) => Number(r.tb)).filter((x) => Number.isFinite(x));
      /*
       * D337 — hạng phong cách CỦA CẢ BÀN màn kết, khoá theo thứ hạng cuối
       * (`hang` = `xepHang(st)`, tính ngay trên).
       *
       * ⚠ Ghế 'ban' CHẤM TỪ `events` (`duong`/`brierVong`/`pnlVong`/`choVong` —
       * nguồn cũ, y hệt trước D337: trận CŨ thiếu `cho_bp` trên event thì vòng
       * đó bỏ qua, không bịa), KHÔNG phải từ `pcTheoGhe` của `replay()` bên
       * trên — `events` là thứ người chơi TỪNG THẤY lúc chơi; ở trận mới hai
       * nguồn trùng nhau, còn trận cũ thiếu `cho_bp` trên event thì chỉ nguồn
       * events biết bỏ đúng vòng ấy. Ghế ĐỐI THỦ thì ngược lại —
       * không có `events` riêng cho từng đối thủ, nên phải dùng `pcTheoGhe`
       * (sản phẩm phụ của CHÍNH `replay()` đã chạy ở đầu handler). `ghiDeBan`
       * là chỗ nối hai nguồn đó lại mà không phải chép tay bước trần+gộp lần
       * hai (D61).
       */
      const vongBanEvents = duong
        .map((d, i) => ({
          brier: brierVong[i] ?? null,
          nav_bp: pnlVong[i] ?? 0,
          cho_bp: choVong[i] ?? null,
          tu_dong: tuDongVong[i] === true,
        }))
        .filter((v): v is typeof v & { cho_bp: number } => v.cho_bp !== null);
      // Đầu hàng vẫn E- ở mọi vòng; còn lại chưa đủ vòng thì CHƯA có hạng (`duVongDeCoHang`).
      const pcBanGoc: KetQuaPhongCach | null = banDauHang(st) ? PHONG_CACH_DAU_HANG
        : duVongDeCoHang(vongBanEvents.length) ? chamPhongCach(vongBanEvents) : null;
      const pcCaBan = phongCachCaBan(st, pcTheoGhe, new Map([['ban', pcBanGoc]]));
      const khoanhKhac = khoanhKhacCuaTran(
        Array.from({ length: chains.length }, (_, i) => chains[i] ?? []));
      /*
       * D323 — THẺ NĂNG LỰC CỦA TRẬN NÀY. Dựng TẠI CHỖ (không đợi tick hay lần
       * đầu `/me/nang-luc` mở): `hanh_vi_vong` có thể CHƯA có dòng nào lúc kết
       * trận — chưa request nào khác chạm `capNhatCuaUser`/`dungHanhViTran` cho
       * đúng trận này. `dungHanhViTran` idempotent (xoá rồi chèn lại) nên gọi ở
       * đây không nhân đôi dòng nào, kể cả khi `/me/nang-luc` đã dựng trước đó.
       */
      await dungHanhViTran(pool, t.matchId, hanhViDeps);
      const nangLucDu = chamNangLucTran(await docVongCuaTran(pool, [t.matchId]));
      // D396 — chỉ trả năng lực đang HIỆN (`NANG_LUC_AN`: N2 ẩn tới khi đổi thước); vẫn chấm đủ ba.
      const nangLuc = { ...nangLucDu, nang_luc: chiNangLucHien(nangLucDu.nang_luc) };
      /*
       * D370 — CỬA MỘT CHIỀU THỨ HAI: người đang ở chế độ tester mà CHƯA nộp PHIẾU 2 thì màn kết
       * KHÔNG được trả thẻ năng lực và khoảnh khắc.
       *
       * ⚠⚠ ĐÂY LÀ CHỖ RÒ TÌM RA Ở D367 LƯỢT 2. `GhiVaoThe` hiện **ba dấu kỹ năng kèm chữ bậc** ngay
       *   khi hết trận. Phiếu 2 hỏi họ NHỚ LẠI mình vừa làm gì, và một phần hỏi họ tự đánh giá — đọc
       *   bậc trước thì họ chép lại thứ vừa thấy, không kể lại thứ vừa làm. Trong phòng học có người
       *   dặn "đừng xem"; không có phòng thì phải là một câu `if`.
       *   Ở D367 tôi né bằng cách BỎ hai câu hỏi. Nay chặn được đúng chỗ nên không phải né nữa.
       * ⚠ Ẩn Ở SERVER, không chỉ ở client (C4): dữ liệu không rời máy chủ thì không có tab nào,
       *   devtools nào, bản web cache nào lộ được.
       * ⚠ Chỉ ẩn HAI khối ấy. Hạng · vốn cuối · xếp hạng vẫn trả bình thường — trận vẫn phải ra một
       *   màn kết có nghĩa, và mấy thứ đó không phải thứ Phiếu 2 hỏi.
       * ⚠ Người thường (`buoi_do` null) không chạm nhánh này.
       */
      /*
       * D370 lượt 5 — TỰ TIẾN BƯỚC 1 ⇒ 2 khi xong TRẬN THẬT của bàn buổi đo.
       *
       * ⚠⚠ LỖI CỦA LƯỢT 4: dải ghi "app tự biết" nhưng KHÔNG có đoạn nào làm việc ấy — tester chơi
       *   xong sẽ kẹt vĩnh viễn ở bước 2, không nút, không đường đi. Đã lên prod 0.0.30 rồi mới lộ.
       * ⚠ CHỈ trận của bàn buổi đo, KHÔNG tính bàn tập: bàn tập là bước học, không phải bước đo.
       * ⚠ `GREATEST` nên gọi lại (mở lại màn kết) không hạ được gì.
       */
      if (t.banMa) {
        await pool.query(
          `UPDATE users SET buoi_do_buoc = GREATEST(buoi_do_buoc, 2)
            WHERE user_id = $1 AND thu_chi_tiet
              AND EXISTS (SELECT 1 FROM holdem_ban b WHERE b.ma = $2 AND b.loai = 'buoi_do')`,
          [uid(actor), t.banMa]);
      }
      const { rows: bdKet } = await pool.query(
        `SELECT thu_chi_tiet, buoi_do_buoc FROM users WHERE user_id = $1`, [uid(actor)]);
      const giauThe = bdKet[0]?.thu_chi_tiet === true && Number(bdKet[0]?.buoi_do_buoc ?? 0) < 3;
      return c.json({
        match_id: t.matchId,
        xong: true,
        /**
         * D370 — `true` nghĩa là thẻ CÓ nhưng đang bị giữ tới khi nộp PHIẾU 2. Client dùng cờ này để
         * nói đúng câu ("làm phiếu 2 rồi mở thẻ") thay vì im lặng — im lặng thì người ta tưởng hỏng.
         */
        the_dang_giu: giauThe,
        /*
         * KHOẢNH KHẮC ĐÃ CHẠM — chỉ ID + vòng + số (server không viết câu chữ,
         * A10 kê-đơn cấm và lint D26 phủ `web/src`). Rỗng khi không có gì —
         * client KHÔNG vẽ khối. Xem docstring `server/holdem/khoanh_khac.ts`.
         */
        ...khoiKetBuoiDo(giauThe, nangLuc, khoanhKhac),
        xep_hang: hang.map((id, i) => {
          const g = st.ghe.find((x) => x.id === id)!;
          return {
            hang: i + 1, ghe_id: id, loai: g.loai,
            ten: g.id === 'ban' ? 'Bạn' : `Máy · ${botCuaGhe(t.seed, g.id, st.ghe).label}`,
            bac_rank: g.loai === 'bot' ? '—' : nhanBacNgan(g.bac_rank),
            // 01/08 — founder bắt lỗi: màn tổng kết từng hiện TIỀN MẶT lẻ.
            // "Vốn" cuối trận = NAV (tổng tài sản); trận cũ navCua ≡ von.
            von: navCua(g), vong_chay: g.vong_chay,
            danh_muc: g.danh_muc,
            // Điểm xếp hạng của trận — chỉ có ở trận Giải xếp hạng. `null` ở đấu
            // tự do là CÓ NGHĨA và màn Chốt phiên phải nói ra: bàn có bot thì
            // không tính điểm (D31), chứ không phải "đang tải".
            diem_truoc: diemTheoGhe.get(g.id)?.truoc ?? null,
            diem_sau: diemTheoGhe.get(g.id)?.sau ?? null,
            /*
             * v32 — CON ĐƯỜNG KỲ NGỘ, LẬT NGỬA HẾT Ở MÀN KẾT (doc 06 §1.4).
             *
             * Trong trận icon chỉ hiện sau khi CHÍNH người xem đã chốt (§1.5,
             * khuôn A3.1); ở đây trận đã xong nên không còn gì để bảo vệ — và
             * đây đúng là khối "khoe" mà D78 dựng màn kết để có. Lối vào cùng
             * một hàm với trong trận (`conDuongCuaGhe`) nên hai chỗ không thể
             * kể hai câu chuyện khác nhau về cùng một ghế.
             */
            ...(() => {
              const ic = conDuongCuaGhe(
                t.seed, g.id, g.loai === 'bot', kyNgo.lan, st.map.o.length, true);
              return ic ? { ky_ngo_icon: ic } : {};
            })(),
          };
        }),
        // Map lật hết rồi → giờ mới lộ tin nào giả. Trước đó là thông tin ẩn.
        map_da_lo: st.map.o,
        /*
         * ĐƯỜNG NAV TỪNG VÒNG của MỌI ghế (17/08) — thẻ kết trận vẽ đường của
         * mình trên nền dải đối thủ. Chỉ có ở đây (endpoint đã khoá `xong`),
         * nên không rò gì trong trận.
         */
        nav_theo_vong: duong,
        /*
         * DẤU MỐC KỸ NĂNG (doc 06 §5.1) — ghi nhận VỀ SAU nên không lái được
         * hành vi; chỉ ID + SỐ (câu chữ ở client, A10). Rỗng ⇒ client IM.
         * Brier các trận TRƯỚC đọc một câu gọn để biết "chuẩn nhất từ trước tới
         * nay" — không có thì mốc đó tự vắng, không bịa.
         */
        dau_moc: dauMocCuaTran(
          duong.map((d, i) => {
            /*
             * CHỢ đổi bao nhiêu ở vòng này = đổi của NAV TRUNG VỊ CẢ BÀN. Trung
             * vị chứ không phải trung bình: một ghế cháy hoặc một ghế all-in
             * trúng kéo trung bình đi, còn trung vị nói "đa số bàn đang thế nào".
             */
            const trungVi = (ds: number[]): number => {
              const x = [...ds].sort((a, b) => a - b);
              const m = Math.floor(x.length / 2);
              return x.length === 0 ? 0
                : x.length % 2 ? x[m]! : ((x[m - 1]! + x[m]!) / 2);
            };
            const nayTV = trungVi(Object.values(d.nav));
            const truocTV = i > 0 ? trungVi(Object.values(duong[i - 1]!.nav)) : nayTV;
            return {
              vong: d.vong,
              brier: brierVong[i] ?? null,
              pnl_bp: pnlVong[i] ?? null,
              phoi_nhiem_bp: d.phoi_ban_bp,
              cho_bp: truocTV > 0 ? Math.round(((nayTV - truocTV) * 10000) / truocTV) : null,
            };
          }),
          brierTranTruoc,
        ),
        /*
         * ⭐ PHONG CÁCH CHƠI (D105) — hạng E→SSS của cả trận, TỔNG HOÀ ba trục
         * chứ không chỉ NAV (founder: *"tránh player chỉ tập trung tối ưu 1 mục
         * tiêu tăng NAV mà làm bẩn data"*). Ba trục banh ra ở ĐÂY và chỉ ở đây —
         * trong trận người chơi thấy đúng một thanh (*"kết trận thì ở menu kết
         * thúc mới khoe mấy chỉ số kia cụ thể thôi để flex"*).
         * ⚠ Trận CŨ không có `cho_bp` trên event ⇒ vòng đó bỏ qua, không bịa mốc
         * chợ bằng 0 (bịa thì mọi vòng cũ thành "ngang chợ" và hạng sai im lặng).
         * ⚠⚠ D337 — hạng đã KHOÁ THEO THỨ HẠNG (`pcCaBan`, tính ở trên): thứ hạng
         * BÉT bàn không thể mang hạng cao hơn thứ hạng NHẤT. VẮNG khi trận khép
         * trước khi đủ vòng để có hạng (founder: mấy vòng đầu *"ko đủ dữ liệu chấm
         * điểm"*) — màn kết đã có nhánh không vẽ khối phong cách.
         */
        ...(pcCaBan.get('ban') ? { phong_cach: pcCaBan.get('ban')! } : {}),
        // Bàn chung/bàn ngày — thẻ kết trận in mã để rủ chơi CÙNG BÀN (khuôn Wordle).
        ban_ma: t.banMa,
        /*
         * KỲ NGỘ CỦA CHÍNH MÌNH — mời gì, chọn gì, xong hay không. Khối này là
         * thứ trả lời câu người chơi hỏi khi màn kết hiện ra: "con đường tôi
         * chọn có đưa tôi tới đâu không?".
         */
        ...(kyNgo.lan.length ? {
          ky_ngo: kyNgo.lan.map((l) => ({
            vong: l.vong, moi: l.moi, chon: l.chon,
            tien_do: l.tien_do, xong_o_vong: l.xong_o_vong,
            dac_quyen: l.chon
              ? NHIEM_VU_KY_NGO.find((x) => x.id === l.chon)?.dac_quyen ?? null
              : null,
          })),
        } : {}),
      });
    } catch (e) {
      if (e instanceof HoldemError) return c.json({ error: e.code, message: e.message }, e.status);
      throw e;
    }
  });

  // ── Lịch sử + đường về trận đang dở ──────────────────────────────────────
  app.get('/api/v1/holdem/me/matches', ...guard, async (c) => {
    const actor = c.get('actor');
    const now = new Date();
    const q = await pool.query(
      `SELECT match_id, status, vong_hien_tai, started_at, ended_at,
              vong_mo_luc, seed, mien_gio
         FROM holdem_matches WHERE owner_user_id = $1
        ORDER BY started_at DESC LIMIT 20`, [uid(actor)]);
    return c.json({
      tran: q.rows.map((r) => ({
        match_id: r.match_id, status: r.status, vong_hien_tai: r.vong_hien_tai,
        started_at: r.started_at, ended_at: r.ended_at,
        /*
         * D93 (3/3) — CÒN TIẾP ĐƯỢC KHÔNG, tính bằng ĐÚNG hàm bộ quét dùng
         * (`tranHetHan` + `vongMienGio`), không phải chỉ `status`. Bộ quét chạy
         * theo tick (mỗi phút, và chỉ khi cron-job.org sống): giữa hai tick một
         * trận quá 45' vẫn `dang_choi` trong DB. Sảnh dựa vào `status` sẽ mời
         * người chơi "TIẾP TỤC" một bàn mà cú bấm đầu tiên ăn 409 `qua_han_tran`
         * — đúng nợ D78 "trận quá 45' trông như còn sống tới khi ăn 409".
         * Hai công thức rời nhau là có ngày sảnh nói "còn" mà bàn nói "hết".
         */
        tiep_duoc: r.status === 'dang_choi'
          && !tranHetHan(r.vong_mo_luc as Date | null, now,
            vongMienGio({ seed: Number(r.seed), mienGio: r.mien_gio === true },
              Number(r.vong_hien_tai))),
      })),
    });
  });

  // ── Cảnh báo xung đột (UI gọi TRƯỚC khi xác nhận mua) ───────────────────
  app.post('/api/v1/holdem/canh-bao-xung-dot', ...guard, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const the = String(body?.the ?? '');
    const dm = {
      tai_san: Array.isArray(body?.tai_san) ? body.tai_san.map(String) : [],
      chien_thuat: Array.isArray(body?.chien_thuat) ? body.chien_thuat.map(String) : [],
    };
    /*
     * v19 — cảnh báo theo bảng của LUẬT HIỆN HÀNH (founder 02/08: cảnh báo
     * khắc chế thừa cho lá đã đổi chức năng). Endpoint không mang matchId nên
     * lấy theo version mặc định — trận mới nào cũng là version đó; trận cũ
     * đang dở thấy thiếu cảnh báo cặp cũ trong VÀI vòng cuối của nó, đổi lại
     * trận mới không bị doạ về một hình phạt không tồn tại.
     */
    const bangXD = luatCua(HOLDEM_BALANCE_VERSION).xungDotGon ? XUNG_DOT_V19 : XUNG_DOT;
    return c.json({ canh_bao: canhBaoXungDot(the as never, dm as never, bangXD) });
  });
}

/**
 * ─── D38 — ĐÓNG MỘT TRẬN VÌ HẾT HẠN ────────────────────────────────────────
 *
 * Đây là ĐƯỜNG CHẠY DUY NHẤT ghi `status = 'bo_dở'`. Trước 27/07 giá trị đó tồn
 * tại trong CHECK của migration 0010 mà KHÔNG dòng code nào ghi — bẫy số 1 của
 * repo (nhánh tồn tại không có đường chạy) ở dạng schema, lần thứ 9.
 *
 * ⚠ TRẬN `bo_dở` KHÔNG GHI KẾT QUẢ, KHÔNG TÍNH RANK. Cố ý, và đây là chỗ dễ sai
 * nhất: `luuKetQua` nằm ngay dưới và trông rất "nên gọi cho đủ bộ". Gọi nó ở đây
 * là chấm điểm một ván chưa đánh xong — bảng xếp hạng sẽ đầy những trận người
 * chơi bỏ giữa chừng, và điểm rank thì không rút lại được.
 *
 * IDEMPOTENT: `WHERE status = 'dang_choi'` nên tick và `/rounds` giẫm nhau vô
 * hại — cái thứ hai khớp 0 dòng và không ghi event thứ hai.
 */
export async function dongTranQuaHan(
  pool: pg.Pool, matchId: string, userId: string,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE holdem_matches
          SET status = 'bo_dở', ly_do_dong = 'het_han', ended_at = now(),
              vong_mo_luc = NULL
        WHERE match_id = $1 AND status = 'dang_choi'
    RETURNING vong_hien_tai`,
      [matchId]);
    if (upd.rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    /*
     * EVENT CÙNG TRANSACTION (A7). "Trận bị đóng vì bỏ dở" là dữ liệu hành vi
     * thật — nó đo TỶ LỆ RỜI TRẬN, đúng con số founder cần để biết trận có quá
     * dài không. Ghi rời ngoài tx là có ngày trận đóng mà không event nào kể, và
     * `events` append-only nên không backfill được (A3.3).
     */
    await client.query(
      `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
       VALUES ($1, 'holdem', $2, 'hd_tran_het_han', $3)`,
      [userId, matchId, JSON.stringify({
        vong: upd.rows[0]!.vong_hien_tai,
        han_tran_phut: DONG_HO.HAN_TRAN_PHUT,
        ly_do: 'het_han',
      })]);
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * ─── D38 — QUÉT TRẬN QUÁ HẠN, gọi từ `/internal/tick` (mỗi phút, D11) ───────
 *
 * ĐỪNG dựng hạ tầng lịch mới cho việc này: tick đã chạy sẵn mỗi phút và C1 bắt
 * ngân sách hạ tầng 0đ.
 *
 * ⚠ CÂU SQL DƯỚI ĐÂY LÀ LƯỚI LỌC THÔ, KHÔNG PHẢI LUẬT. Quyết định cuối cùng
 * "trận này hết hạn chưa" do `tranHetHan` trả lời — CÙNG hàm mà `/rounds` và
 * `/luot` gọi. Hai công thức rời nhau thì sẽ có ngày người chơi thấy "trận còn
 * sống" mà tiến trình dọn đã đóng nó, hoặc ngược lại: một trận không ai đóng
 * được mà cũng không ai chơi được.
 * Điều kiện SQL cố ý RỘNG HƠN (`<=` so với `>` của `tranHetHan`, cùng một hằng
 * số) nên nó không bao giờ bỏ sót thứ mà `tranHetHan` sẽ gắn cờ — nó chỉ giúp
 * partial index `idx_holdem_matches_qua_han` làm việc thay vì kéo cả bảng.
 *
 * `vong_mo_luc IS NULL` bị loại ngay ở SQL: trận trước migration 0018 KHÔNG có
 * hạn (xem `soiDongHo`), và kết luận sai về chúng không xoá lại được.
 */
/**
 * D481 — cửa KHÉP TRẬN SAU MÀN CUỐI (`chotManCuoi`, sống trong `registerHoldemRoutes` vì cần `layTran`), tra theo pool. Tick dùng nó TRƯỚC khi
 * đóng một trận thành bỏ dở: người chơi đóng app giữa màn vòng cuối đã nộp đủ mọi vòng — trận đó XONG, không phải bỏ dở. Thiếu mục này (pool
 * chưa đăng ký route) ⇒ tick làm như cũ.
 */
const KHEP_SAU_MAN_CUOI = new WeakMap<pg.Pool, (matchId: string, userId: string) => Promise<boolean>>();

export async function quetTranQuaHan(
  pool: pg.Pool, now: Date = new Date(),
): Promise<{ dong: string[] }> {
  const { rows } = await pool.query(
    `SELECT match_id, owner_user_id, vong_mo_luc, seed, vong_hien_tai, mien_gio
       FROM holdem_matches
      WHERE status = 'dang_choi'
        AND vong_mo_luc IS NOT NULL
        AND vong_mo_luc <= $1::timestamptz - make_interval(mins => $2)
      ORDER BY vong_mo_luc
      LIMIT 500`,
    [now.toISOString(), DONG_HO.HAN_TRAN_PHUT]);

  const dong: string[] = [];
  for (const r of rows) {
    // LUẬT nằm ở đây, không ở câu SQL trên. Cờ miễn giờ (màn tập vòng 1–4 D53,
    // trận làm quen 16/08) đi CÙNG cửa `vongMienGio` với mọi đường khác: màn
    // đang hứa "không tính giờ" thì tick không được đóng trận ở phút 46 — hạn
    // của nhóm này là `HAN_TRAN_TAP_PHUT` (SQL trên lọc theo hạn NGẮN nên
    // không bỏ sót ai).
    if (!tranHetHan(r.vong_mo_luc as Date, now,
      vongMienGio({ seed: Number(r.seed), mienGio: r.mien_gio === true },
        Number(r.vong_hien_tai)))) continue;
    // D481 — đã nộp đủ vòng, chỉ còn màn cuối chưa ai mở lại ⇒ khép như trận xong (lưu kết quả), không đóng bỏ dở.
    const khep = KHEP_SAU_MAN_CUOI.get(pool);
    if (khep && await khep(r.match_id as string, r.owner_user_id as string)) continue;
    if (await dongTranQuaHan(pool, r.match_id as string, r.owner_user_id as string)) {
      dong.push(r.match_id as string);
    }
  }
  return { dong };
}

/**
 * `db` nhận cả Pool lẫn PoolClient: `/rounds` gọi hàm này TRONG transaction của
 * vòng cuối, nên bảng kết quả + event kết trận phải cùng chìm cùng nổi với
 * `action_log` — nửa vời ở đây là trận "xong" mà không có bảng xếp hạng.
 */
async function luuKetQua(
  db: pg.Pool | pg.PoolClient, matchId: string, userId: string,
  st: TrangThaiTran, seed: number,
  /**
   * v32 — kết cục KỲ NGỘ của trận. Vào `hd_match_end` chứ không thành một
   * `action_type` riêng: nó là một THUỘC TÍNH của cú kết trận, và A9 nói dòng
   * thừa trong `events` là chỗ chiếm vĩnh viễn (append-only). "Được mời gì /
   * chọn gì" đã nằm ở `hd_chon_ky_ngo`; ở đây chỉ còn "xong hay không".
   */
  lanKyNgo: readonly LanKyNgo[] = [],
): Promise<void> {
  /*
   * v43 (D314) — hợp đồng còn mở lúc trận đóng ⇒ tất toán như HUỶ (founder chốt 08/09).
   * NO-OP ở kết thúc tự nhiên (không hợp đồng nào sống qua ô cuối — xem
   * `tatToanKhiDongTran`); nó chỉ cắn ở trận bị đóng quá hạn. Đặt TRƯỚC `xepHang` vì
   * `navCua` cộng lãi treo: xếp hạng trước khi tất toán là thưởng cho người bỏ dở đúng
   * khoản lãi mà luật vừa nói là họ mất.
   */
  const stCuoi = tatToanKhiDongTran(st);
  const hang = xepHang(stCuoi);
  for (let i = 0; i < hang.length; i += 1) {
    const g = stCuoi.ghe.find((x) => x.id === hang[i])!;
    await db.query(
      `INSERT INTO holdem_results
         (match_id, user_id, ghe_id, loai, bot_id, bac_rank, hang, von_cuoi,
          vong_chay, danh_muc_json, dau_hang)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (match_id, ghe_id) DO NOTHING`,
      [matchId, g.id === 'ban' ? userId : null, g.id, g.loai,
       g.loai === 'bot' ? botCuaGhe(seed, g.id, st.ghe).id : null,
       // v10+: 'vốn cuối' lưu NAV — tổng tài sản, không phải tiền mặt lẻ.
       g.bac_rank, i + 1, navCua(g), g.vong_chay, JSON.stringify(g.danh_muc),
       g.tu_the === 'dau_hang']);
  }

  /*
   * ĐIỂM XẾP HẠNG — chỉ khi trận là trận Giải xếp hạng.
   *
   * `che_do` đọc từ DB chứ không suy từ sơ đồ ghế: "bàn toàn người" là ĐIỀU KIỆN
   * CẦN, không phải điều kiện đủ (phòng riêng cũng toàn người mà luôn 0 điểm —
   * nếu không thì mời bạn vào phòng riêng là đường farm điểm hoàn hảo).
   *
   * ⚠ KHAI THẲNG: hôm nay MỌI trận đều `che_do = 'tu_do'` vì lát ghép trận nhiều
   *   người (suất đấu theo giờ hẹn) CHƯA XÂY. Nên nhánh dưới đây chưa chạy trên
   *   prod. Nó KHÔNG phải cơ chế trang trí: `tests/rank.test.ts` lái đúng đường
   *   này qua DB thật (transaction thật, trigger zero-sum thật) bằng cách đặt
   *   `che_do = 'rank_slot'`. Ngày trận nhiều người có mặt, điểm chảy mà không
   *   phải sửa dòng nào ở đây.
   */
  const mQ = await db.query(
    `SELECT che_do, season_id, ban_ma FROM holdem_matches WHERE match_id = $1`, [matchId]);
  const cheDo = String(mQ.rows[0]?.che_do ?? 'tu_do');
  if (cheDo === 'rank_pve') {
    /*
     * XẾP HẠNG MÙA BETA — đấu máy, thang PvE KHÔNG ÂM (D16), điểm là QUỸ CHI
     * (rank_quy_diem, reason 'chi_pve') chứ không đi qua rank_ledger zero-sum.
     * Chỉ ghế người nhận điểm — bot không có bậc để tiến (D25/R3).
     */
    const hangBan = hang.indexOf('ban') + 1;
    if (hangBan >= 1) {
      await ghiDiemPve(db, {
        userId, seasonId: String(mQ.rows[0]!.season_id), hang: hangBan,
      });
    }
  } else if (cheDo === 'rank_slot' && 'release' in db && await ghiKetQuaVaoBan(db as pg.PoolClient, matchId) !== null) {
    /*
     * BÀN GHÉP CÓ MÁY (server/rank_ghep.ts): trận này là một trong các trận CÙNG SEED của một bàn ghép. Kết quả của nó chỉ ghi vào chỗ ngồi;
     * điểm chia khi cả bàn xong / hết hạn, CHỈ giữa cặp người–người. KHÔNG đi nhánh `ghiDiemTran` dưới (nó từ chối mọi bàn có ghế máy).
     * `'release' in db` = đang chạy trên PoolClient trong transaction kết trận (luôn đúng ở hai chỗ gọi `luuKetQua`).
     */
  } else if (cheDo === 'rank_slot' || cheDo === 'rank_bu') {
    await ghiDiemTran(db, {
      matchId,
      seasonId: String(mQ.rows[0]!.season_id),
      cheDo,
      soLa: st.map.o.length,
      hangTheoGhe: hang,
      ghe: st.ghe.map((g) => ({
        gheId: g.id,
        // Trận rank không có bot, nên ghế nào không phải người là ghế làm hỏng
        // zero-sum — `ghiDiemTran` từ chối cả bàn chứ không bỏ qua ghế đó.
        userId: g.id === 'ban' ? userId : (g.loai === 'nguoi' ? g.id : null),
        bacVaoBan: g.bac_rank,
      })),
    });
  }
  await db.query(
    `INSERT INTO events (user_id, context_type, context_id, action_type, value_num, value_json)
     VALUES ($1, 'holdem', $2, 'hd_match_end', $3, $4)`,
    [userId, matchId, hang.indexOf('ban') + 1,
     JSON.stringify({
       xep_hang: hang,
       von_cuoi: (() => { const b = st.ghe.find((g) => g.id === 'ban'); return b ? navCua(b) : 0; })(),
       // 22/08 — nhãn cho phân tích: trận khép vì ĐẦU HÀNG, không phải lật hết ô.
       ...(banDauHang(st) ? { dau_hang: true } : {}),
       ...(lanKyNgo.length ? {
         ky_ngo: lanKyNgo.map((l) => ({
           vong: l.vong, chon: l.chon, xong: l.xong_o_vong !== null,
           xong_o_vong: l.xong_o_vong,
         })),
       } : {}),
     })]);
  /*
   * D404 — TỰ TIẾN BƯỚC 1 ⇒ 2 NGAY LÚC TRẬN KHÉP, không đợi người chơi mở màn kết.
   * D370 lượt 5 đặt cú tiến ở `/autopsy`; nhưng tester thoát app đúng lúc ô cuối lật (hết pin, mất tab)
   * thì không bao giờ mở màn kết ⇒ đứng mãi ở bước 1 với dải bảo "chơi hết một trận" trong khi trận
   * đã xong. Giữ cú ở `/autopsy` (idempotent, `GREATEST`) và thêm cú này trong CÙNG transaction khép
   * trận. Cùng điều kiện: chỉ trận của bàn `buoi_do`, chỉ người đang ở chế độ tester; bàn tập không có
   * `ban_ma` nên không chạm.
   */
  const banMaKhep = mQ.rows[0]?.ban_ma as string | null | undefined;
  if (banMaKhep) {
    await db.query(
      `UPDATE users SET buoi_do_buoc = GREATEST(buoi_do_buoc, 2)
        WHERE user_id = $1 AND thu_chi_tiet
          AND EXISTS (SELECT 1 FROM holdem_ban b WHERE b.ma = $2 AND b.loai = 'buoi_do')`,
      [userId, banMaKhep]);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * TÍNH CÁCH TÀI CHÍNH — trải events thành VongInsight rồi giao cho lõi thuần
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Export để admin (`admin_thongke`) tái dụng cho bảng tỷ lệ — MỘT đường trải,
 * hai người đọc; hai bản trải là hai bản sẽ trôi (D61).
 * KHÔNG replay engine: mọi thứ cần đã nằm trong events (`hd_cam_ket` lệnh đã
 * áp · `hd_chot_phien` pnl vòng · `hd_brier_vong` · `hd_mo_bang` ·
 * `hd_khop_lenh`) + map dựng lại từ seed. Rẻ và không đụng đường tiền.
 */
export async function hoSoTinhCachCuaUser(
  db: pg.Pool | pg.PoolClient, userId: string,
): Promise<HoSoGoi> {
  /*
   * D106 (22/08) — vòng lặp trải events dời sang `server/hanh_vi/trai.ts`; bảng
   * `hanh_vi_vong` là tầng chung chuyển, đọc thì tự làm tươi (`capNhatCuaUser`).
   * Phép TRẢI giữ nguyên từng chữ số so với bản 17/08 (`tests/hanh_vi_kho.test.ts`
   * §I so với oracle chép nguyên văn). Cái ĐỔI là cửa sổ: hồ sơ = GÓI ĐẦY gần
   * nhất (`server/hanh_vi/goi.ts`), không còn "60 trận gần nhất, cứ 12 vòng là
   * xếp thẻ". Replay được TIÊM vào kho (tránh vòng import).
   */
  return hoSoTheoGoi(db, userId, hanhViDeps);
}

/**
 * KHẨU VỊ THEO VÒNG của ghế người chơi — từ `replay` (tất định theo seed+log),
 * tiêm cho tầng hành vi. Lọc đuôi `cho_nop` y hệt `layTran` (đuôi là trạng thái
 * vòng ĐANG chơi, không phải lịch sử). Trận không NAV ⇒ rỗng.
 */
export function khauViCuaTran(row: HangTran): KhauViVong[] {
  const luat = luatChoTran(row.balance_version, row.seed);
  if (!luat.nav) return [];
  const raw = (row.action_log ?? []) as DongLog[];
  const log = raw.filter((h): h is HanhDongLog => !laChoNop(h));
  const ghe = (row.ghe_json ?? null) as GheMoi[] | null;
  const soO = row.so_o === null ? undefined : row.so_o;
  return replay(row.seed, log, false, ghe ?? undefined, luat, 0, false, soO).kvVong;
}

/** Phụ thuộc tầng hành vi — MỘT chỗ cho endpoint, tick và script dựng lại. */
export const hanhViDeps: HanhViDeps = { khauViCuaTran };
