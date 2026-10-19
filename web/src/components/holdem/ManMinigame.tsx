/**
 * MÀN MINIGAME TRONG TRẬN (D472 vỏ → D476 đủ nhịp, bước 4 #1) — `docs/thiet-ke-de-xuat/gameplay/kien-truc-minigame.md` §2 · §7.
 *
 * CHÉP TỪ CODE DEMO đã chốt `docs/ui-ux/demo/minigame-bat-day.html` (A11.25): thanh PHA (tên · thanh giờ · giây) · mặt nỉ hai ô thẻ (thẻ vòng
 * cũ đóng, thẻ vòng mới lật) · màn CHỌN LÕI (lá kiểu TFT, bấm vào lá là chọn) · màn chơi (`mgDau` · `doThi` + `veDoThi` · đếm ngược · nhãn TRẮNG ·
 * dòng tạm tính · ba nút) · KẾT QUẢ + QUYẾT TOÁN · VÒNG KẾ. Khác demo ghi ở D476.
 *
 * Mọi mốc giờ là của SERVER (`bat_dau` = lúc chốt vòng + lật thẻ + chọn lá, D473) ⇒ mọi người cùng pha. Client chỉ HIỂN THỊ (C4): giá, nến,
 * cờ trắng, tiền mỗi nút, sổ, lãi lỗ, NAV đều do server trả; cú bấm gửi SỐ NHỊP đang thấy, server khớp (D475).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { DONG_HO_MINIGAME, TAI_SAN } from '@config/holdem';
import { HE_SO_LOI, PHI_TIN_SOM_BP } from '@config/minigame';
import type { ODTO } from '@/api/holdem';
import { bamNut, docDongNhip, hoiMotLan, layKetQuaMan, type DauManDTO, type KetQuaManDTO, type LoNhipDTO, type LonLoDTO, type SoiLoDTO, type SoManDTO, type SoV59DTO, type SuKienTlDTO, type TinLoDTO } from '@/api/minigame';
import { ApiError } from '@/api/client';
import { dungNenHienThi, NHIP_MOI_NEN } from '@/lib/minigame_nen';
import { LOI_MINIGAME_CHU } from '@/lib/khung_minigame';
import { chuTin, mauTin, nguonTin, xaoChu } from '@/lib/tin_man';
import { phutHat, tamPhanTu } from '@/lib/hat_pixel';
import { NHIP } from '@/lib/nhip';
import { duocBay, EASING_BAY, VOM_BAY } from '@/lib/duong_bay';
import { useReducedMotion } from '@/lib/hooks';
import { loiOracleMan } from '@/lib/coach_minigame';
import { Mascot } from '@/components/Mascot';
import { htmlTinh } from '@/lib/html_tinh';
import { PixelIcon, PixelLuoi } from '@/components/ui/PixelIcon';
import { LUOI_BACH_KHOA } from '@/lib/bach_khoa/luoi';
import type { ChienThuatId } from '@config/holdem';
import s from './ManMinigame.module.css';

/* ── hằng của demo `veDoThi` ── */
const TREN = 12, CAO = 120, NEN_LS = 10;
/** D536 — dải CỘT KHỐI LƯỢNG dưới nến (demo `VOL0` · `VOLH`): đỉnh dải 130, cao 18 px; vạch ngăn ở VOL0 − 3. */
const VOL0 = 130, VOLH = 18;
/** D536 — ai đặt lệnh lớn (server chỉ gửi cho Tổ Chức — demo `thayChuLenh`). Không emoji (luật founder). */
const AI_LENH_LON: Readonly<Record<string, string>> = { ca_map: 'CÁ MẬP', doi_lai: 'ĐỘI LÁI', gai: 'ĐÁM ĐÔNG' };
/**
 * Xem trễ sau đồng hồ máy. ⚠ D529: TỪNG là 1000 = đúng một lô phát (`LO_NHIP_MS`) ⇒ đệm dày đúng một lô, lô nào tới trễ bao nhiêu thì đồ thị
 * ĐỨNG bấy nhiêu, mỗi giây một lần (đo local 30–60 ms; điện thoại VN → máy chủ Singapore vài trăm ms) — founder: "khựng, không mượt bằng demo".
 * 1400 chịu được lô trễ 400 ms mà vẫn chừa 600 ms cho cú bấm đi lên trong cửa sổ nhận lệnh của server (`CUA_SO_LENH_MS` 2000).
 */
const TRE_XEM_MS = 1400;
/** Kết quả hiện bao lâu rồi tự về vòng (hạn vòng đã gồm phần màn — D473). Nút VÒNG KẾ về sớm hơn. */
const KQ_TU_DONG_MS = 8000;
/** Đồng hồ máy lệch vài trăm ms ⇒ hỏi kết quả lại mỗi nhịp này, tối đa bấy nhiêu lần. */
const KQ_HOI_LAI_MS = 600, KQ_HOI_TOI_DA = 12;

/**
 * D473 — PHA của màn theo đồng hồ server: `bat_dau` = lúc chốt vòng + lật thẻ + chọn lá (server neo, chung mọi người). Thuần để test được.
 */
export type PhaMan = { loai: 'lat' | 'chon' | 'dem'; giay: number } | { loai: 'chay' } | { loai: 'het' };
export function phaMan(nayMs: number, batDauMs: number, demMs: number, chayMs: number,
  /** D561 — giây chọn lá của màn (server gửi `chon_la_s`; khoá v65 = 0: lõi chọn lúc chốt vòng). */
  chonLaS: number = DONG_HO_MINIGAME.CHON_LA_S,
): PhaMan {
  const conTruoc = batDauMs - nayMs;
  if (conTruoc > chonLaS * 1000) return { loai: 'lat', giay: Math.ceil((conTruoc - chonLaS * 1000) / 1000) };
  if (conTruoc > 0) return { loai: 'chon', giay: Math.ceil(conTruoc / 1000) };
  if (conTruoc > -demMs) return { loai: 'dem', giay: Math.ceil((conTruoc + demMs) / 1000) };
  return nayMs < batDauMs + demMs + chayMs ? { loai: 'chay' } : { loai: 'het' };
}

/** Nút của từng lõi — chữ + màu + chiều giao dịch (demo `LOI[...].nut`). Server trả id nút + tiền mỗi nút. */
const NUT: Record<string, { chu: string; mau: 'xanh' | 'vang' | 'lam'; can: 1 | -1; rung?: true }> = {
  vao_nua: { chu: 'VÀO NỬA', mau: 'xanh', can: 1 },
  vao_het: { chu: 'VÀO HẾT', mau: 'vang', can: 1, rung: true },
  thoat: { chu: 'THOÁT', mau: 'lam', can: -1 },
  // D511 — Mua Đuổi (demo `LOI.mua_duoi`): VÀO → NHỒI (n/3) · CHỐT NỬA · CHỐT HẾT.
  vao: { chu: 'VÀO', mau: 'xanh', can: 1 },
  chot_nua: { chu: 'CHỐT NỬA', mau: 'vang', can: -1 },
  chot_het: { chu: 'CHỐT HẾT', mau: 'lam', can: -1 },
  // D561 — khoá v65: Bắt Đáy / Mua Đuổi bán NỬA phần khoản còn giữ (bán trước cú rơi, VÀO lại ở đáy bằng tiền vừa bán).
  ban_bot: { chu: 'BÁN BỚT', mau: 'lam', can: -1 },
  // D589 — khoá v70: Mua Đuổi CHỐT gộp (lần 1 nửa · lần 2 hết) · ×2 đứng ở CHÍNH ô VÀO khi đã nhồi đủ 3 phần (xem `oNut`).
  chot: { chu: 'CHỐT', mau: 'vang', can: -1 },
  vay_x2: { chu: 'VAY ×2', mau: 'vang', can: 1, rung: true },
};
const TEN_NAC = { can: 'CẠN', mong: 'MỎNG', vua: 'VỪA', day: 'DÀY', rat_day: 'RẤT DÀY' } as const;
const fmt = (x: number) => Math.round(x).toLocaleString('vi-VN');
const fmtDau = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmt(Math.abs(x));
/** D485 — chữ nhãn hành vi (server trả id, D26) — chép chữ của demo `nhanHanhVi`. `khong_ro` không in. */
const NHAN_MAN: Readonly<Record<string, string>> = {
  dao_nhieu: 'ĐẢO NHIỀU',   // D531 — Lướt Sóng (demo `nhanHanhVi`: ĐẢO NHIỀU khi ≥ 6 lần)
  giu_suot: 'KHÔNG BẤM · GIỮ SUỐT', fomo: 'FOMO', kien_nhan: 'KIÊN NHẪN', bat_dao_roi: 'BẮT DAO RƠI', hoang_ban_day: 'HOẢNG · BÁN ĐÁY',
  cat_lo_kip: 'CẮT LỖ KỊP', ban_hut_trang_mua: 'BÁN HỤT · TRẮNG BÊN MUA', mua_hut_trang_ban: 'MUA HỤT · TRẮNG BÊN BÁN',
  // D492 — lõi Đòn Bẩy (demo `nhanHanhVi` nhánh don_bay)
  db_x2: 'CHỌN ×2', db_x4: 'CHỌN ×4', db_x10: 'CHỌN ×10', bk_x2: 'KHỐNG ×2', bk_x4: 'KHỐNG ×4', bk_x10: 'KHỐNG ×10',
  duoi_muon: 'ĐUỔI MUỘN', nhoi_sat_dinh: 'NHỒI SÁT ĐỈNH', chot_sat_dinh: 'CHỐT SÁT ĐỈNH', chot_som: 'CHỐT SỚM', om_qua_dinh: 'ÔM QUA ĐỈNH', tang_don_bay: 'TĂNG ĐÒN BẨY', gap_thep_khi_lo: 'GẤP THẾP KHI LỖ', nhoi_khi_loi: 'NHỒI KHI LỜI',
  pha_quy_du_phong: 'PHÁ QUỸ DỰ PHÒNG', ban_het_vao_ky_quy: 'BÁN HẾT VÀO KÝ QUỸ', ban_tai_san_nap: 'BÁN TÀI SẢN KHÁC ĐỂ NẠP', cat_khi_goi: 'CẮT KHI BỊ GỌI', nap_roi_van_mat: 'NẠP RỒI VẪN MẤT',
  bi_thanh_ly: 'BỊ THANH LÝ', thanh_ly_vi_rut_chan: 'THANH LÝ VÌ RÚT CHÂN', gong_qua_cu_goi: 'GỒNG QUA CÚ GỌI',
  cham_tran_thua: 'CHẠM TRẦN THUA · TỰ CHỐT',   // D499 — Tổ Chức
  ke_mua_khop: 'KÊ MUA KHỚP', ke_ban_khop: 'KÊ BÁN KHỚP', tam_ly_yeu_ban: 'TÂM LÝ YẾU · BÁN THÁO',   // D528
  // D532 — Lướt Sóng MUA TIN SỚM (demo `nhanHanhVi` nhánh luot_song)
  mua_tin_som: 'MUA TIN SỚM', khong_mua_tin_som: 'KHÔNG MUA TIN SỚM', dung_thong_tin: 'DÙNG THÔNG TIN', mua_roi_bo: 'MUA RỒI BỎ',
  mua_khi_khong_co_tin_that: 'MUA KHI KHÔNG CÓ TIN THẬT', da_biet_nhieu_van_theo: 'ĐÃ BIẾT NHIỄU VẪN THEO',
  tb_gia_xuong: 'TRUNG BÌNH GIÁ XUỐNG', vay_x2: 'VAY ×2',   // D589 — khoá v70
};
/** D532 — bong bóng tin mở bấy nhiêu NẾN MỊN sau tin (demo `BONG_NEN` = 3 nến xem) · bấm ghim đọc lại bấy nhiêu nến mịn (demo 2,5 nến xem). */
const BONG_NEN_MIN = 6, MO_LAI_NEN_MIN = 5;
/** D532 — danh sách tin thật (demo `veTruocMan` · `.dsTin`): nguồn · chữ, màu theo hướng lời nói × uy tín. */
function DsTinThat({ ds }: { ds: { ng: string; chu: string; noi: number }[] }) {
  return (
    <div className={s.dsTin} data-khoi="ds-tin-that">
      {ds.length ? ds.map((t, i) => (
        <div key={i} style={{ '--c': mauTin({ ...t, that: true }) } as CSSProperties}>{nguonTin(t.ng)?.ten ?? ''} · {chuTin(t.chu) ?? ''}</div>
      )) : <div>Màn này không có tin thật nào.</div>}
    </div>
  );
}
/** D528 — vai trò lệnh kê lúc khớp (server trả id). */
const TEN_VT_KE = { mo: 'MỞ', chot: 'CHỐT', ban_giu: 'BÁN KHOẢN' } as const;
/** D528 — lệnh kê mới đặt cách giá đang chạy bấy nhiêu (demo bản 49 `KE.CACH`, gần đúng cho mọi mã) · khoảng cách tối thiểu tới giá. */
const KE_CACH = 0.02, KE_SAT = 0.001;
/** D528 — KÍNH LÚP: mỗi lần bấm nới khung giá thêm 25 % → 50 % → 100 %, bấm nữa về khung gốc (founder 05/10). */
const THU_PHONG = [1, 1.25, 1.5, 2] as const;

/** D492 — mức đòn bẩy của lõi Đòn Bẩy (chép `MUC_DON_BAY` của config — chỉ để dựng nhãn nút; tiền mỗi nút do server trả). */
const MUC_DB = [2, 4, 10] as const;
/** Một ô của hàng nút (demo `LOI[...].nut()`): `id` rỗng = ô chỉ hiện, không gửi gì. */
interface ONut { id: string; chu: string; phu: string; mau: 'xanh' | 'vang' | 'lam' | 'do'; can: 1 | -1 | 0; rung?: boolean; duoc: boolean; bam?: () => void }

/** D484 — màu mỗi mã trên bảng phụ (demo `MAU_MA`). */
const MAU_MA: Readonly<Record<string, string>> = { btc: '#fb923c', cp_cn: '#a78bfa', vn30: '#22d3ee', vang: '#fbbf24', usd: '#4ade80', tpcp: '#93c5fd' };

/**
 * D484 — vẽ một ô bảng phụ (demo `veBangPhu`): NẾN như bảng chính — 30 nến × 16 nhịp, thân 3 px, bước 5 px; nến đang chạy dở vẫn vẽ. Trục co theo
 * phần ĐÃ chạy + mốc mở màn (co theo cả đường là lộ đỉnh/đáy tương lai). `g[k]` = giá sau nhịp k − 1 (g[0] = 100).
 */
function veOPhu(cv: HTMLCanvasElement, g: readonly number[], win: string, lose: string) {
  const cx = cv.getContext('2d');
  if (!cx) return;
  const W = cv.width, H = cv.height, NHIP = 16, k = g.length - 1, nen: { o: number; c: number; h: number; l: number }[] = [];
  for (let i = 0; i * NHIP < k + 1 && i < 30; i++) {
    const t = g.slice(i * NHIP + 1, Math.min(k, (i + 1) * NHIP) + 1), o = g[i * NHIP]!;
    if (!t.length) break;
    nen.push({ o, c: t[t.length - 1]!, h: Math.max(o, ...t), l: Math.min(o, ...t) });
  }
  const lo = Math.min(100, ...nen.map((m) => m.l)) * 0.997, hi = Math.max(100, ...nen.map((m) => m.h)) * 1.003;
  const TR = 14, y = (v: number) => Math.round(TR + (H - TR - 3) * (1 - (v - lo) / (hi - lo)));
  cx.imageSmoothingEnabled = false;
  cx.fillStyle = '#050b12'; cx.fillRect(0, 0, W, H);
  cx.fillStyle = 'rgba(93,114,144,.25)'; cx.fillRect(0, y(100), W, 1);
  nen.forEach((m, i) => {
    const xx = 2 + i * 5;
    cx.fillStyle = m.c >= m.o ? win : lose;
    cx.fillRect(xx + 1, y(m.h), 1, Math.max(1, y(m.l) - y(m.h)));
    const tp = Math.min(y(m.o), y(m.c)), bt = Math.max(y(m.o), y(m.c)); cx.fillRect(xx, tp, 3, Math.max(1, bt - tp));
  });
}

/**
 * D529 — MÀU của canvas đọc MỘT lần mỗi phần tử (biến CSS của theme không đổi giữa màn). Trước đây vòng vẽ gọi `getComputedStyle` 60 lần/giây cho
 * canvas chính + từng bảng phụ, xen giữa các cú ghi DOM ⇒ ép trình duyệt tính lại style mỗi khung (một nguồn giật trên điện thoại).
 */
const MAU_CANVAS = new WeakMap<Element, { win: string; lose: string; bien: (k: string) => string }>();
function mauCua(el: Element) {
  let m = MAU_CANVAS.get(el);
  if (!m) {
    const cs = getComputedStyle(el), nho = new Map<string, string>();
    const bien = (k: string) => { let v = nho.get(k); if (v === undefined) { v = cs.getPropertyValue(k).trim(); nho.set(k, v); } return v; };
    m = { win: bien('--win') || '#4ade80', lose: bien('--lose') || '#f87171', bien };
    MAU_CANVAS.set(el, m);
  }
  return m;
}

/**
 * D529 — dãy giá ĐỂ VẼ: nhịp cuối đã tới được kéo dần về nhịp kế theo phần lẻ của đồng hồ (`uNhip` = nhịp thực, số thực) — y như demo `giaGoc`
 * (a + (b − a) × phần lẻ). Chưa có nhịp kế / ngoài pha chạy / nhịp kế ngoài màn ⇒ trả nguyên dãy (đứng yên, không đoán). Thuần để test được.
 */
export function thayDeVe(thay: readonly number[], sau: number | undefined, uNhip: number, dangChay: boolean, soNhip: number): readonly number[] {
  const k = thay.length - 1;
  if (!dangChay || k < 0 || sau === undefined || k + 1 >= soNhip || uNhip < k) return thay;
  const f = Math.min(1, uNhip - k), a = thay[k]!;
  return [...thay.slice(0, k), a + (sau - a) * f];
}

const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1).replace('.', ',')}%`;
const khoaMoi = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Mặt một ô thẻ: ART CÓ SẴN của lá (cùng `art[khoá]` bản đồ dùng) + tên mặt lá + màu họ. */
export interface MatThe { svg: string; ten: string; mau?: string }
interface Props {
  matchId: string; vong: number; dong: () => void;
  /** HUD: tổng vòng + NAV lúc mở màn (sau màn, QUYẾT TOÁN hiện NAV server trả). */
  tongVong?: number; nav?: number;
  /** Hai ô thẻ trên mặt nỉ: vòng trước (đóng) · vòng vừa chốt (lật trước khi chọn lá). */
  theCu?: MatThe; theMoi?: MatThe;
  /** ART CÓ SẴN của app (`useHoldemArt`, khoá = id lõi) — lá chọn lõi vẽ bằng đúng tranh của quầy lõi (founder 04/10: "card dùng art có sẵn"). */
  art?: Readonly<Record<string, string>>;
  /** D527 — màn của BÀN TẬP: dải Oracle trong màn (`loiOracleMan` — lời theo vòng + lõi vừa chọn). Khung thoại CoachTap đứng dưới lớp phủ này. */
  tap?: boolean;
  /** D561 — dựng mặt lá từ ô (cùng `matO` của bàn) — màn ô pha của khoá úp lá lật lá bằng `kq.the_vong` lúc kết quả. */
  matTheCua?: (o: ODTO) => MatThe | undefined;
  /**
   * D585 — thẻ vòng đã lật TRÊN BÀN trước khi màn mở ⇒ màn KHÔNG lật lần hai: lá có mặt hiện ngửa ngay; lá pha úp (D561) giữ úp suốt màn, kể cả
   * quyết toán (tên lá vẫn hiện ở VÌ SAO) — bàn lật nó một lần sau khi đóng màn. Vắng = lật trong màn như cũ.
   */
  latTrenBan?: boolean;
}

/** D519 — demo bản 42: bàn phím vừa đổi thì khoá chừng này (ms). */
const KHOA_DOI_PHIM_MS = 250;

/**
 * D561 — khoá nhiều mã (founder 08/10, demo `minigame-nhieu-ma.html`): mỗi khoản có dòng giá là một MÀN CON cùng đồng hồ. Chạm ô bảng phụ ⇒ dựng lại
 * khung nhìn cho mã ấy (khoá `key` theo mã — mọi số đọc lại từ server: sổ, đường, nhịp; không có trạng thái riêng phải chép sang). Khoá một mã ⇒
 * bảng phụ chỉ xem như cũ.
 */
export function ManMinigame(p: Props) {
  const [maXem, setMaXem] = useState<string | undefined>(undefined);
  /*
   * D588 — CHUYỂN CẢNH (founder 11/10: "chuyển tiếp từ màn chính sang màn mini-game chưa mượt"). Ở vỏ ngoài chứ không ở `ManMinigameMot`:
   * đổi mã xem dựng lại thân màn (key) — cú VÀO không được diễn lại. `vao` đứng đúng `MAN_VAO` rồi gỡ; `dong` của màn đi qua `dongMuot`
   * (khung hạ + mờ `MAN_RA` rồi mới gỡ màn). Giảm chuyển động ⇒ đóng tức thì.
   */
  const giam = useReducedMotion();
  const [vao, setVao] = useState(true);
  useEffect(() => { const t = setTimeout(() => setVao(false), NHIP.MAN_VAO); return () => clearTimeout(t); }, []);
  const [ra, setRa] = useState(false);
  const raRef = useRef(false);
  const dongRef = useRef(p.dong);
  dongRef.current = p.dong;
  const dongMuot = useCallback(() => {
    if (raRef.current) return;
    raRef.current = true;
    if (giam) { dongRef.current(); return; }
    setRa(true);
    setTimeout(() => dongRef.current(), NHIP.MAN_RA);
  }, [giam]);
  return <ManMinigameMot key={maXem ?? '_'} {...p} dong={dongMuot} chuyen={ra ? 'ra' : vao ? 'vao' : undefined} ma={maXem} doiMa={setMaXem} />;
}

function ManMinigameMot({ matchId, vong, dong, tongVong, nav, theCu, theMoi: theMoi0, art = {}, tap = false, ma: maXem, doiMa, matTheCua, latTrenBan = false, chuyen }: Props & { ma?: string; doiMa?: (ma: string) => void; chuyen?: 'vao' | 'ra' }) {
  /*
   * D588 — LÁ VỪA LẬT BAY VÀO MÀN: lá vòng vừa lật trên bàn (`[data-o-dang-lat]`, D585 — một cú lật) nhấc lên theo vòm rồi đáp vào ô
   * "VÒNG N" của màn — mắt theo một lá từ bàn sang màn thay vì màn cắt phụt. Chỉ khi màn mở bằng cú VÀO, bàn đã lật lá và lá có mặt
   * (lá úp của khoá úp lá pha thì không bay). Animate chính ô thẻ (WAAPI, chỉ transform, tự gỡ khi xong — không cần dọn).
   */
  const theMoiEl = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (chuyen !== 'vao' || !latTrenBan || !theMoi0) return;
    const dich = theMoiEl.current, nguon = document.querySelector('[data-o-dang-lat]');
    if (!nguon || !duocBay(dich)) return;
    const a = nguon.getBoundingClientRect(), b = dich.getBoundingClientRect();
    if (!a.width || !b.width) return;
    const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2), k = a.width / b.width;
    dich.animate([
      { transform: `translate(${dx}px,${dy}px) scale(${k})` },
      { transform: `translate(${dx / 2}px,${dy / 2 - VOM_BAY}px) scale(${(k + 1) / 2})`, offset: 0.5 },
      { transform: 'none' },
    ], { duration: NHIP.THE_VAO_MAN, easing: EASING_BAY });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ một lần, lúc màn mở
  }, []);
  const [dau, setDau] = useState<DauManDTO | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [pha, setPha] = useState<PhaMan | null>(null);
  const [so, setSo] = useState<SoManDTO | null>(null);
  const [la, setLa] = useState<string | null>(null);
  /** D513 — lõi đang chơi cho vòng vẽ (requestAnimationFrame đọc ref, không đọc state cũ). */
  const laRef = useRef<string | null>(null);
  useEffect(() => { laRef.current = la; }, [la]);
  const [daChon, setDaChon] = useState<string | null>(null);
  const [kq, setKq] = useState<KetQuaManDTO | null>(null);
  const [trangNay, setTrangNay] = useState<'mua' | 'ban' | null>(null);
  const [giaNay, setGiaNay] = useState<number | null>(null);
  /** D504 — lãi lỗ tạm tính (số tiền server gửi kèm dòng nhịp) ở nhịp ĐANG XEM; null = chưa có (đang chờ dòng mới sau cú bấm). */
  const ttNhip = useRef<(number | null)[]>([]);
  /** D513 — lớp soi theo nhịp server gửi (nhịp cuối mỗi lô); vẽ bản mới nhất có nhịp ≤ nhịp đang xem (không vẽ trước cái chưa lộ). */
  const soiLich = useRef<{ k: number; soi: SoiLoDTO }[]>([]);
  const soiNhan = useRef<HTMLDivElement>(null);
  const [ttNay, setTtNay] = useState<number | null>(null);
  const [giayChay, setGiayChay] = useState<number | null>(null);
  const [lun, setLun] = useState<string | null>(null);
  /** D534 — nút vừa bấm HỤT (nến trắng chặn chiều đó — demo `.nut.hut`): rung tại chỗ 130 ms. */
  const [hut, setHut] = useState<string | null>(null);
  /** D534 — nhãn đà của lõi trên đồ thị (demo `#bung`): Bắt Đáy "ĐANG BÙNG" · Mua Đuổi "×n NẾN XANH"; null = tắt. Đổi tối đa một lần mỗi nến. */
  const [bung, setBung] = useState<string | null>(null);
  /**
   * D534 — nhãn BÁN CƯỠNG BỨC (demo `#nhanLon`): một vị thế đòn bẩy của bàn vừa bị thanh lý (sự kiện `tl` đã tới nhịp đang xem).
   * D536 — cùng ô: "◆ LỆNH LỚN" khi một cú lệnh lớn (bot Cá Mập / Đội Lái cùng mã · đám đông theo tin gài) đang đè — ưu tiên như demo (`G.xung.find`).
   */
  const [nhanLon, setNhanLon] = useState<string | null>(null);
  /** D534 — kê lệnh đã KHỚP đã ăn mừng (hạt + rung) — mỗi lệnh một lần. */
  const keMung = useRef(new Set<string>());
  const doThiEl = useRef<HTMLDivElement>(null);
  const soKq = useRef<HTMLDivElement>(null);
  /** D519 — câu trả lời của cú bấm có `seq` lớn nhất đã áp: câu trả lời CŨ về muộn (hai cú bấm bay cùng lúc) không ghi đè sổ mới. */
  const seqDaAp = useRef(0);
  /** D519 — bàn phím vừa ĐỔI (demo bản 42 `KHOA_DOI_PHIM_MS`): mốc hết khoá + lớp lật phím. */
  const khoaPhimDen = useRef(0);
  const [doiPhim, setDoiPhim] = useState(false);
  const [rung, setRung] = useState(false);
  /*
   * HẸN GIỜ MỘT PHÁT của hiệu ứng (lún nút · rung bàn) — GIỮ MÃ để huỷ khi màn gỡ. Trước đây `setTimeout` trần: gỡ màn ngay sau một
   * cú bấm thì hẹn giờ vẫn bắn `setState` — trình duyệt bỏ qua im lặng, nhưng ở test nó bắn sau khi jsdom đã đóng ⇒ "window is not
   * defined" ⇒ CI frontend thoát 1 dù mọi bài xanh (run 38030597768 · 38039548529, 10/10). Hẹn giờ trong effect có cleanup riêng thì giữ nguyên.
   */
  const henRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const hen = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => { henRef.current.delete(t); fn(); }, ms);
    henRef.current.add(t);
  }, []);
  useEffect(() => () => { for (const t of henRef.current) clearTimeout(t); henRef.current.clear(); }, []);
  const cv = useRef<HTMLCanvasElement>(null);
  const tag = useRef<HTMLSpanElement>(null);
  const thanh = useRef<HTMLElement>(null);
  const gia = useRef<number[]>([]);
  const trang = useRef(new Map<number, [boolean, boolean]>());
  const lech = useRef(0);               // đồng hồ server − đồng hồ máy
  const dauRef = useRef<DauManDTO | null>(null);
  const yKhung = useRef<{ lo: number; hi: number } | null>(null);
  const nhipXem = useRef(-1);
  /* D484 — BẢNG PHỤ: giá từng mã theo nhịp (mốc 0 = 100), ô % của chip + ô lưới, canvas của lưới. */
  const giaPhu = useRef(new Map<string, number[]>());
  const soPhu = useRef(new Map<string, HTMLElement>());
  const cvPhu = useRef(new Map<string, HTMLCanvasElement>());
  /** D529 — bảng phụ đã vẽ tới đâu (khoá = số nhịp|giá cuối) + canvas đã vẽ lên: không đổi thì khung này bỏ qua. */
  const phuDaVe = useRef(new Map<string, string>());
  const phuCv = useRef(new Map<string, HTMLCanvasElement | undefined>());
  /** D529 — chiều cao hiển thị của canvas chính (ResizeObserver) — thay `getBoundingClientRect` mỗi khung. */
  const caoCv = useRef(0);
  const [moPhu, setMoPhu] = useState(true);   // D490 — mặc định MỞ (founder: "mặc định là bung ra, bấm vào thì ẩn đi")
  /** D485 — VÌ SAO mở thì THAY CHỖ câu mô tả + bảng QUYẾT TOÁN (bàn cố định — demo bản 29). */
  const [moViSao, setMoViSao] = useState(false);
  /** D486 — nút đang bị trait khoá (demo `khoaTrait`): KIÊN NHẪN còn `con` giây · NÓNG VỘI hết giờ. */
  const [khoaTr, setKhoaTr] = useState<{ ly: 'kien_nhan' | 'nong_voi'; con: number } | null>(null);
  /*
   * D492 — ĐÒN BẨY: đang bị GỌI ký quỹ / đã chạm SÀN thanh lý ở nhịp đang xem — so GIÁ đang thấy với NGƯỠNG server gửi trong sổ (`so.db.nguong`);
   * server tự gọi / thanh lý ở đúng điều kiện ấy (C4: client không tính tiền). Hộp NẠP mở ngay lúc bắt đầu bị gọi (demo `goiKyQuyTick`).
   */
  const [goi, setGoi] = useState(false);
  const [tlNhip, setTlNhip] = useState<number | null>(null);
  const [moNap, setMoNap] = useState(false);
  /*
   * D493 — CUỘC GỌI KÝ QUỸ (demo `phatCuocGoi`, founder 04/10): cạnh lên của bị gọi ⇒ thẻ 0,6 s (vào 0–0,25 s · rung 0,25–0,45 s · thu vào góc) rồi
   * thành icon điện thoại rung lặp tới khi hết bị gọi; bấm icon ⇒ phát lại. `phatGoi` = số lần phát (key lại để hoạt ảnh chạy lại từ đầu).
   */
  const [phatGoi, setPhatGoi] = useState(0);
  const [dangPhat, setDangPhat] = useState(false);
  useEffect(() => {
    if (!phatGoi) return;
    setDangPhat(true);
    const t = setTimeout(() => setDangPhat(false), 600);
    return () => clearTimeout(t);
  }, [phatGoi]);
  /* D493 — lóe đỏ một phát khi bị SÀN thanh lý (demo `chopThanhLy`, 420 ms) rồi gỡ khỏi cây. */
  const [loeDo, setLoeDo] = useState(false);
  /*
   * D499 — TỔ CHỨC chạm TRẦN THUA (giá đang xem ≤ `so.gia_tran`, server tự chốt đúng giá đó): búa pháp lý đập (demo bản 34 `dapBua`) rồi thu về
   * góc, hàng nút xám tới hết màn — đồ thị giữ màu. `buaThu` = búa đã thu nhỏ.
   */
  const [tranNhip, setTranNhip] = useState<number | null>(null);
  const [buaThu, setBuaThu] = useState(false);
  const tranRef = useRef(false);
  useEffect(() => {
    if (tranNhip === null) return;
    // D534 — demo `dapBua`: búa chạm mặt bàn ở 0,23 s ⇒ hạt gỗ tung từ búa + cả bàn rung.
    const t0 = setTimeout(() => {
      phutHat(tamPhanTu(document.querySelector('[data-khoi="bua"]')), '#c8a27a', 16);
      setRung(true); hen(() => setRung(false), 140);
    }, 230);
    const t = setTimeout(() => setBuaThu(true), 1100);
    return () => { clearTimeout(t0); clearTimeout(t); };
  }, [tranNhip]);
  /** D499 — lần nối lại dòng nhịp (cú tự đẩy mới ⇒ đường giá đổi từ nhịp đang xem). */
  const [phienNhip, setPhienNhip] = useState(0);
  const soRef = useRef<SoManDTO | null>(null);
  const goiRef = useRef(false);
  /** D494 — cú bán cưỡng bức của dây chuyền đã tới (theo lô — không biết trước). */
  const tlDay = useRef<SuKienTlDTO[]>([]);
  /** D536 — khối lượng TÍCH LUỸ theo nhịp (server `v`, nến đang chạy lớn dần) · các cú LỆNH LỚN đã mở (theo lô — không biết trước). */
  const klNhip = useRef<number[]>([]);
  const lonDay = useRef<LonLoDTO[]>([]);
  const tlRef = useRef(false);
  useEffect(() => { soRef.current = so; }, [so]);
  /*
   * D528 — KÊ LỆNH (demo bản 49): `keSv` = lệnh server đang giữ (sổ sau cú bấm · luật tự động từng lô) — vạch + chữ nhãn vẽ trong vòng rAF từ ref này;
   * `keKeo` = vạch đang bị kéo (chỉ hiển thị, thả tay mới gửi). `keHien` chỉ để React biết dựng nhãn / bật nút nào.
   */
  const keSv = useRef<SoV59DTO['ke'] | null>(null);
  const [keHien, setKeHien] = useState<SoV59DTO['ke'] | null>(null);
  const keKeo = useRef<{ ben: 'mua' | 'ban'; bp: number; dg: number; bp0: number; /** D539 — đang kéo vạch NHÁP (thả tay không gửi). */ nhap?: boolean } | null>(null);
  const keL = useRef<{ mua: number; ban: number }>({ mua: MUC_DB[0], ban: MUC_DB[0] });
  const [keLHien, setKeLHien] = useState<{ mua: number; ban: number }>({ mua: MUC_DB[0], ban: MUC_DB[0] });
  const keNhanEl = useRef<{ mua: HTMLDivElement | null; ban: HTMLDivElement | null }>({ mua: null, ban: null });
  /*
   * D539 (founder 06/10: "bấm 1 phát hiện trên chart và nếu lỡ có nến nào chạm nhẹ là bán luôn hoặc mua luôn thay vì cho t thời gian set up" — chọn
   * "vạch NHÁP rồi bấm ĐẶT") — KÊ MUA / KÊ BÁN chỉ dựng VẠCH NHÁP ở client: mờ, kéo chỉnh + đổi ×L thoải mái, KHÔNG gửi server ⇒ không bao giờ tự khớp.
   * Bấm ✓ ĐẶT mới gửi (như cú đặt cũ). Giá nháp neo theo % so giá mở (đứng yên khi chart chạy).
   */
  const keNhap = useRef<{ mua: number | null; ban: number | null }>({ mua: null, ban: null });
  const [keNhapHien, setKeNhapHien] = useState<{ mua: number | null; ban: number | null }>({ mua: null, ban: null });
  const datNhap = (ben: 'mua' | 'ban', bp: number | null) => { keNhap.current = { ...keNhap.current, [ben]: bp }; setKeNhapHien(keNhap.current); };
  const apKe = useCallback((ke: SoV59DTO['ke'] | null | undefined) => {
    const moi = ke ?? null;
    if (JSON.stringify(moi) === JSON.stringify(keSv.current)) return;
    keSv.current = moi; setKeHien(moi);
  }, []);
  /* D528 — TÂM LÝ YẾU / trần thua khoản giữ: nhịp server báo (từng lô) — hiện khi nhịp ĐANG XEM đã qua (không lộ trước). */
  const tlySv = useRef<number | null>(null);
  const tranGiuSv = useRef<number | null>(null);
  const [tlyBao, setTlyBao] = useState(false);
  const tlyDaHien = useRef(false);
  const thuPhongRef = useRef(0);
  const [thuPhong, setThuPhong] = useState(0);
  /*
   * D532 — TIN TRONG MÀN (demo `veTin`): tin tới theo lô (server không gửi tin của nhịp chưa tới) · ghim + bong bóng dựng THẲNG trên DOM trong vòng vẽ
   * như demo (vị trí đổi mỗi khung, không qua React). `tinMua` = giá mua tin sớm / đã mua · `tinThat` = danh sách tin thật sau khi mua.
   */
  const tinDs = useRef(new Map<number, TinLoDTO>());
  const tinLop = useRef<HTMLDivElement>(null);
  const chongEl = useRef<HTMLDivElement>(null);
  const tinVe = useRef<{ khoa: string; xao: number; moLai: { id: number; den: number } | null; sMin: number; bw: number; bh: number; ghim: Map<string, HTMLButtonElement> }>(
    { khoa: '', xao: 0, moLai: null, sMin: -1, bw: 0, bh: 0, ghim: new Map() });
  const [tinMua, setTinMua] = useState<DauManDTO['tin_mua']>(undefined);
  const [tinThat, setTinThat] = useState<DauManDTO['tin_that']>(undefined);
  const tinMuaRef = useRef<DauManDTO['tin_mua']>(undefined);
  useEffect(() => { tinMuaRef.current = tinMua; }, [tinMua]);
  const apTin = useCallback((r: Pick<DauManDTO, 'tin_mua' | 'tin_that'>) => {
    if (r.tin_mua) setTinMua(r.tin_mua);
    if (r.tin_that) setTinThat(r.tin_that);
  }, []);
  /** D532 — bề ngang hiển thị của canvas chính (ResizeObserver): canvas 60 nến rộng hơn 202 mà khung giữ tỉ lệ 202:150 ⇒ hệ số ngang ≠ dọc. */
  const rongCv = useRef(0);

  /* ── nhận nhịp: dòng → nối lại → hỏi mỗi giây ── */
  useEffect(() => {
    const bo = new AbortController();
    let het = false;
    const nhanDau = (d: DauManDTO) => {
      dauRef.current = d; setDau(d);
      if (d.so) { setSo(d.so); apKe(d.so.ke); }
      apTin(d);   // D532
      setLa((cu) => cu ?? d.la);
      lech.current = new Date(d.gio_may).getTime() - Date.now();
    };
    const nhanLo = (tu: number, g: number[], nen: [number, number, number][], phu?: Record<string, number[]>, tl?: SuKienTlDTO[], tt?: (number | null)[], soi?: SoiLoDTO,
      td?: LoNhipDTO['tu_dong'], tin?: TinLoDTO[], v?: number[], lon?: LonLoDTO[]) => {
      v?.forEach((x, i) => { klNhip.current[tu + i] = x; });   // D536
      lon?.forEach((e) => { if (!lonDay.current.some((x) => x.nhip === e.nhip && x.het === e.het)) lonDay.current.push(e); });
      g.forEach((_, i) => { ttNhip.current[tu + i] = tt?.[i] ?? null; });
      tin?.forEach((t) => tinDs.current.set(t.id, t));   // D532 — bản mới nhất thắng (sau khi mua tin sớm có thêm THẬT / NHIỄU)
      // D528 — luật tự động tới nhịp cuối lô: lệnh kê vừa khớp · Tâm lý yếu · trần thua khoản giữ · tạm tính của vị thế mới.
      if (td) {
        apKe(td.ke);
        if (td.tly) tlySv.current = td.tly.nhip;
        if (td.tran_thua) tranGiuSv.current = td.tran_thua.nhip;
        if (td.tt !== null && g.length) ttNhip.current[tu + g.length - 1] = td.tt;
      }
      if (soi && g.length) soiLich.current = [...soiLich.current.filter((x) => x.k < tu + g.length - 1).slice(-30), { k: tu + g.length - 1, soi }];
      tl?.forEach((e) => { if (!tlDay.current.some((x) => x.nhip === e.nhip && x.L === e.L)) tlDay.current.push(e); });
      g.forEach((x, i) => { gia.current[tu + i] = x; });
      Object.entries(phu ?? {}).forEach(([ma, xs]) => {
        const a = giaPhu.current.get(ma) ?? [100];
        xs.forEach((x, i) => { a[tu + i + 1] = x; });
        giaPhu.current.set(ma, a);
      });
      nen.forEach(([j, a, b]) => trang.current.set(j, [a === 1, b === 1]));
    };
    (async () => {
      let lanLoi = 0;
      while (!het && !bo.signal.aborted && lanLoi < 2) {
        try {
          await docDongNhip(matchId, vong, gia.current.length, (d) => {
            if (d.loai === 'dau') nhanDau(d);
            else if (d.loai === 'nhip') nhanLo(d.tu, d.gia, d.nen, d.phu, d.tl, d.tt, d.soi, d.tu_dong, d.tin, d.v, d.lon);
            else if (d.loai === 'het') het = true;
          }, bo.signal, maXem);
          lanLoi = 0;
          // Dòng đóng mà chưa hết màn (`noi_lai` sau 45 s, hoặc mạng cắt êm) ⇒ nghỉ một nhịp rồi nối lại — không quay vòng không nghỉ.
          if (!het) await new Promise((ok) => setTimeout(ok, 300));
        } catch {
          if (bo.signal.aborted) return;
          lanLoi += 1;
        }
      }
      while (!het && !bo.signal.aborted) {   // đường lui: hỏi mỗi giây
        try {
          const r = await hoiMotLan(matchId, vong, gia.current.length, maXem);
          if (!dauRef.current) nhanDau(r.dau);
          nhanLo(r.lo.tu, r.lo.gia, r.lo.nen, r.lo.phu, r.lo.tl, r.lo.tt, r.lo.soi, r.lo.tu_dong, r.lo.tin, r.lo.v, r.lo.lon);
          het = r.het;
        } catch (e) {
          setLoi(e instanceof Error ? e.message : String(e));
          return;
        }
        await new Promise((ok) => setTimeout(ok, 1000));
      }
    })();
    return () => bo.abort();
  }, [matchId, vong, phienNhip]);

  /* ── vẽ + pha: chép `veDoThi` của demo (phần đồ thị) ── */
  useEffect(() => {
    let raf = 0, roCv: ResizeObserver | null = null, cvTheoDoi: HTMLCanvasElement | null = null;
    const ve = () => {
      raf = requestAnimationFrame(ve);
      const d = dauRef.current;
      if (!d) return;
      const nayMay = Date.now() + lech.current - TRE_XEM_MS, bd = new Date(d.bat_dau).getTime();
      const chonLaS = d.chon_la_s ?? DONG_HO_MINIGAME.CHON_LA_S;   // D561
      const p = phaMan(nayMay, bd, d.dem_ms, d.chay_ms, chonLaS);
      setPha((cu) => (cu && cu.loai === p.loai && ('giay' in cu ? cu.giay : 0) === ('giay' in p ? p.giay : 0) ? cu : p));
      // Thanh giờ của pha: phần còn lại / độ dài pha (demo `.pha .thanhGio`).
      const conPha = p.loai === 'lat' ? bd - chonLaS * 1000 - nayMay : p.loai === 'chon' ? bd - nayMay
        : p.loai === 'dem' ? bd + d.dem_ms - nayMay : p.loai === 'chay' ? bd + d.dem_ms + d.chay_ms - nayMay : 0;
      const daiPha = p.loai === 'lat' ? DONG_HO_MINIGAME.LAT_THE_S * 1000 : p.loai === 'chon' ? Math.max(1, chonLaS * 1000)
        : p.loai === 'dem' ? d.dem_ms : p.loai === 'chay' ? d.chay_ms : 1;
      if (thanh.current) thanh.current.style.transform = `scaleX(${Math.max(0, Math.min(1, conPha / daiPha))})`;
      const gc = p.loai === 'chay' ? Math.ceil(conPha / 1000) : null;   // demo: pha chạy cũng đếm giây còn lại
      setGiayChay((cu) => (cu === gc ? cu : gc));
      // D486 — khoá trait (demo `khoaTrait`) theo GIÂY ĐÃ CHẠY của màn — server cũng chặn cùng cửa sổ (`cuaSoTrait`).
      const tm = d.trait_man, gSong = (nayMay - bd - d.dem_ms) / 1000;
      const kt = p.loai !== 'chay' || !tm ? null
        : tm.khoa_s !== undefined && gSong < tm.khoa_s ? { ly: 'kien_nhan' as const, con: Math.ceil(tm.khoa_s - gSong) }
          : tm.han_s !== undefined && gSong >= tm.han_s ? { ly: 'nong_voi' as const, con: 0 } : null;
      setKhoaTr((cu) => (cu?.ly === kt?.ly && cu?.con === kt?.con ? cu : kt));
      const uNhip = ((nayMay - bd - d.dem_ms) * d.so_nhip) / d.chay_ms - 1, nx = Math.floor(uNhip);
      const thay = gia.current.slice(0, Math.max(0, Math.min(gia.current.length, nx + 1)));
      nhipXem.current = Math.min(thay.length - 1, d.so_nhip - 1);
      /*
       * D529 — NỘI SUY ĐỂ VẼ (demo `giaGoc`: a + (b − a) × phần lẻ): giá + nến đang chạy trượt mượt giữa hai nhịp thay vì nhảy 14 lần/giây. CHỈ
       * phần vẽ — khớp lệnh · ngưỡng ký quỹ · tạm tính · số trên màn vẫn theo nhịp nguyên `nhipXem` (server quyết, C4). Không có nhịp kế ⇒ đứng yên.
       */
      const thayVe = thayDeVe(thay, gia.current[thay.length], uNhip, p.loai === 'chay', d.so_nhip);
      // D492 — Đòn Bẩy: so giá ĐANG XEM với ngưỡng server (đứng TRƯỚC phần vẽ — không phụ thuộc canvas). Chạm sàn thì chốt cứng tới hết màn.
      const ngD = soRef.current?.db?.nguong, iD = ngD ? nhipXem.current - ngD.tu : -1, gNay = thay[thay.length - 1];
      if (ngD && p.loai === 'chay' && gNay !== undefined && iD >= 0 && iD < ngD.goi.length && (soRef.current?.dang_cam ?? 0) > 0) {
        const kD = nhipXem.current;
        // D510 — Bán Khống (`chieu` −1): ngưỡng nằm TRÊN giá ⇒ chạm khi giá ≥ ngưỡng (client chỉ so giá — C4).
        const cham = (gv: number, ngv: number) => (soRef.current?.db?.chieu === -1 ? gv >= ngv : gv <= ngv);
        if (cham(gNay, ngD.thanh_ly[iD]!) && !tlRef.current) { tlRef.current = true; setTlNhip(kD); setLoeDo(true); setTimeout(() => setLoeDo(false), 500); }
        const g = cham(gNay, ngD.goi[iD]!);
        if (g !== goiRef.current) { goiRef.current = g; setGoi(g); if (g) { setMoNap(true); setPhatGoi((x) => x + 1); } }
      } else if (goiRef.current) { goiRef.current = false; setGoi(false); }
      // D499 — TỔ CHỨC: giá đang xem chạm GIÁ TRẦN ⇒ búa (một lần). Server đã chốt đúng giá trần (khớp thỏa thuận).
      const gTran = soRef.current?.gia_tran;
      if (gTran !== undefined && p.loai === 'chay' && gNay !== undefined && !tranRef.current && (soRef.current?.dang_cam ?? 0) > 0 && gNay <= gTran) {
        tranRef.current = true; setTranNhip(nhipXem.current);
      }
      // D528 — Tổ Chức: trần thua trên KHOẢN GIỮ (server báo nhịp) ⇒ búa như khi đang cầm · Tâm lý yếu ⇒ nhãn bán tháo (một lần).
      if (tranGiuSv.current !== null && p.loai === 'chay' && !tranRef.current && nhipXem.current >= tranGiuSv.current) { tranRef.current = true; setTranNhip(nhipXem.current); }
      if (tlySv.current !== null && (p.loai === 'chay' || p.loai === 'het') && !tlyDaHien.current && nhipXem.current >= tlySv.current) {
        tlyDaHien.current = true; setTlyBao(true); setTimeout(() => setTlyBao(false), 1600);
      }
      // D504 — tạm tính của nhịp đang xem (đứng TRƯỚC phần vẽ — không phụ thuộc canvas).
      const ttK = p.loai === 'chay' || p.loai === 'het' ? ttNhip.current[nhipXem.current] ?? null : null;
      setTtNay((cu) => (cu === ttK ? cu : ttK));
      // D484 — BẢNG PHỤ chạy CÙNG nhịp đang xem của bảng chính (trễ xem như nhau): % trên chip + nến trong lưới. Không phụ thuộc canvas chính.
      const kPhu = p.loai === 'chay' || p.loai === 'het' ? Math.max(0, nhipXem.current + 1) : 0;
      giaPhu.current.forEach((g, ma) => {
        // D529 — chỉ vẽ lại khi bảng phụ có gì mới (nhịp đổi / dữ liệu tới / canvas mới gắn): trước đây 60 lần/giây + `getComputedStyle` mỗi lần.
        const thayP = g.slice(0, Math.min(g.length, kPhu + 1)), cvp = cvPhu.current.get(ma), khoa = `${thayP.length}|${thayP[thayP.length - 1]}`;
        if (phuDaVe.current.get(ma) === khoa && phuCv.current.get(ma) === cvp) return;
        phuDaVe.current.set(ma, khoa); phuCv.current.set(ma, cvp);
        const cuoi = thayP[thayP.length - 1] ?? 100, p0 = cuoi / 100 - 1;
        const o = soPhu.current.get(ma);
        if (o) { o.textContent = pct(p0); o.className = p0 >= 0 ? s.lai! : s.lo!; }
        if (cvp) { const m = mauCua(cvp); veOPhu(cvp, thayP, m.win, m.lose); }
      });
      const c = cv.current;
      if (!c) return;
      // Khung thường 30 nến gộp; khung nhanh 60 nến cho Lướt Sóng (bước 4 #6) và D486 NÓNG VỘI (demo D471: "xem nến khung nhanh").
      // D531 — demo `kXem`: Lướt Sóng (và Nóng Vội) xem khung NHANH 60 nến; lõi khác gộp đôi 30 nến.
      const gop = d.trait_man?.han_s === undefined && laRef.current !== 'luot_song';
      const tat = dungNenHienThi(d.lich_su, thayVe, trang.current, gop);
      const hien = tat.slice(Math.max(0, tat.findIndex((x) => !x.lichSu) - NEN_LS));
      const buoc = gop ? 5 : 4, rn = 3, nenSong = gop ? 30 : 60;
      const W = (NEN_LS + nenSong) * buoc + 2;
      if (c.width !== W) c.width = W;
      const cx = c.getContext('2d');
      if (!cx) return;
      cx.imageSmoothingEnabled = false;
      let lo = Infinity, hi = -Infinity;
      hien.forEach((n) => { lo = Math.min(lo, n.l); hi = Math.max(hi, n.h); });
      // D513 — lớp soi: bản mới nhất có nhịp ≤ nhịp đang xem; mức trong ±30 % giá nằm trong khung (demo bản 41 `soiMuc`).
      const soiNay = p.loai === 'chay' ? [...soiLich.current].reverse().find((x) => x.k <= nhipXem.current)?.soi : undefined;
      const gtCuoi = soiNay && 'gt' in soiNay ? soiNay.gt.diem.filter((d) => d.j * (gop ? 16 : 8) <= nhipXem.current).pop() : undefined;
      const mucSoi = !soiNay ? [] : 'muc' in soiNay ? soiNay.muc.map((m) => m.gia) : 'gt' in soiNay ? (gtCuoi ? [gtCuoi.g, gtCuoi.g * (1 - soiNay.gt.rong)] : [])
        : soiNay.thac ? [soiNay.thac.ngoi, soiNay.thac.den ?? soiNay.thac.day] : [];
      const gRef = hien[hien.length - 1]?.c ?? 100;
      mucSoi.forEach((m) => { if (Math.abs(m / gRef - 1) < 0.3) { lo = Math.min(lo, m); hi = Math.max(hi, m); } });
      const dm = (hi - lo) * 0.12 + 0.3; lo -= dm; hi += dm;
      const yk = yKhung.current;
      // D528 — KÍNH LÚP (founder 05/10: "Bấm vào là thu ra 25%, 50% rồi 100% rồi bấm thêm thì trở về mốc ban đầu"): nới khung giá quanh tâm.
      { const f = THU_PHONG[thuPhongRef.current] ?? 1; if (f !== 1) { const giua = (lo + hi) / 2, nua = ((hi - lo) / 2) * f; lo = giua - nua; hi = giua + nua; } }
      const khungMoi = !keKeo.current || !yk ? (yk ? { lo: yk.lo + (lo - yk.lo) * 0.12, hi: yk.hi + (hi - yk.hi) * 0.12 } : { lo, hi }) : yk;   // D528 — đang kéo vạch kê: thang đứng yên
      yKhung.current = khungMoi;
      const { lo: yLo, hi: yHi } = khungMoi;
      const y = (gv: number) => Math.round(TREN + 2 + ((yHi - gv) / (yHi - yLo)) * (CAO - TREN - 4));
      const mauC = mauCua(c), mau = { getPropertyValue: (k: string) => mauC.bien(k) };   // D529 — màu đọc một lần (không ép tính style mỗi khung)
      const WIN = mauC.win, LOSE = mauC.lose;
      const ACC = mauC.bien('--accent') || '#22d3ee';
      cx.fillStyle = '#050b12'; cx.fillRect(0, 0, W, c.height);
      cx.fillStyle = 'rgba(93,114,144,.16)'; for (let gy = TREN + 10; gy < CAO; gy += 21) cx.fillRect(0, gy, W, 1);
      cx.fillRect(0, TREN, W, 1);
      /*
       * D536 — CỘT KHỐI LƯỢNG (demo `veDoThi`): khối lượng nến mịn (lịch sử `lich_su_v` + tích luỹ theo nhịp `v`), gộp đôi như nến khung thường, cắt cùng
       * chỗ với `hien`. Thang theo cột lớn nhất ĐANG THẤY (demo lấy cả nến tương lai — client không có, và không được có). Khoá cũ (không `lich_su_v`) ⇒ null.
       */
      const klHien = (() => {
        if (!d.lich_su_v) return null;
        const nSong = Math.ceil(thayVe.length / NHIP_MOI_NEN), cuoi = thayVe.length - 1;
        const klTai = (j: number) => { for (let k = Math.min(j * NHIP_MOI_NEN + NHIP_MOI_NEN - 1, cuoi); k >= j * NHIP_MOI_NEN; k--) { const x = klNhip.current[k]; if (x !== undefined) return x; } return 0; };
        const min = [...d.lich_su_v, ...Array.from({ length: nSong }, (_, j) => klTai(j))];
        const ra = gop ? Array.from({ length: Math.ceil(min.length / 2) }, (_, i) => min[2 * i]! + (min[2 * i + 1] ?? 0)) : min;
        return ra.slice(Math.max(0, tat.findIndex((x) => !x.lichSu) - NEN_LS));
      })();
      const dayV = klHien ? VOL0 + VOLH : CAO;   // D536 — vạch thời gian trait kéo xuống hết dải khối lượng (demo `dayV`)
      if (klHien) cx.fillRect(0, VOL0 - 3, W, 1);
      /*
       * D478/D486 (founder 04/10: "phải hiện 1 đường kẻ thẳng (trục Oy) … để user biết khi nào bị cấm/ được mở hành động"; "Ko cần chữ") — demo
       * `veDoThi`: KIÊN NHẪN tô VÙNG PHẢI ĐỢI + vạch vàng ở giây mở khoá · NÓNG VỘI vạch đỏ ở giây tự chốt + tô vùng hết bấm. Mốc là GIỜ, không lộ giá.
       */
      const giayNen = d.chay_ms / 1000 / nenSong;
      const xGiay = (gi: number) => 1 + (NEN_LS + Math.min(nenSong, gi / giayNen)) * buoc + Math.floor(rn / 2), x0 = 1 + NEN_LS * buoc - 1;
      const vach = (x: number, m: string) => { cx.fillStyle = m; for (let yy = TREN + 1; yy < dayV; yy += 4) cx.fillRect(Math.round(x), yy, 1, 2); };
      if (tm?.khoa_s !== undefined) {
        const x = xGiay(tm.khoa_s); cx.fillStyle = 'rgba(251,191,36,.13)'; cx.fillRect(x0, TREN + 1, x - x0, dayV - TREN - 1);
        vach(x, mau.getPropertyValue('--gold-amber').trim() || '#fbbf24');
      }
      if (tm?.han_s !== undefined) {
        const x = xGiay(tm.han_s); cx.fillStyle = 'rgba(248,113,113,.08)'; cx.fillRect(x, TREN + 1, W - x, dayV - TREN - 1); vach(x, LOSE);
      }
      /*
       * D532 — TIN (demo `tinDangMo` · `veDoThi`): đơn vị NẾN MỊN (0–60). Tin đã LỘ = nhịp lộ (nến mịn × 8, như server) ≤ nhịp đang xem. Bong bóng mở:
       * ghim vừa bấm (đọc lại) hoặc tin mới nhất trong 6 nến mịn vừa qua; vạch chấm màu tin từ mép trên xuống đỉnh cây nến của tin.
       */
      const xemTin = p.loai === 'chay' || p.loai === 'het';
      const sMin = p.loai === 'chay' ? Math.max(0, uNhip) / NHIP_MOI_NEN : p.loai === 'het' ? 99 : -1;
      const tinDaLo = !xemTin ? [] : [...tinDs.current.values()]
        .filter((t) => p.loai === 'het' || Math.ceil(t.ci * NHIP_MOI_NEN) <= nhipXem.current).sort((a, b) => a.ci - b.ci || a.id - b.id);
      const tv = tinVe.current;
      tv.sMin = sMin;
      if (tv.moLai && (p.loai !== 'chay' || sMin >= tv.moLai.den)) tv.moLai = null;
      const tinMo = p.loai !== 'chay' ? null : (tv.moLai && tinDs.current.get(tv.moLai.id)) || tinDaLo.filter((t) => t.ci <= sMin && sMin - t.ci < BONG_NEN_MIN).pop() || null;
      const ciVe = (ci: number) => (gop ? ci / 2 : ci), xTin = (ci: number) => 1 + (NEN_LS + ciVe(ci)) * buoc;
      const oTin = { muTin: d.mu_tin === true, daMua: tinMuaRef.current?.da_mua === true };
      if (tinMo) {
        const n = hien[NEN_LS + Math.floor(ciVe(tinMo.ci))];
        if (n) {
          const x = Math.round(xTin(tinMo.ci)) + 1, bienMau = mauTin(tinMo, oTin).match(/--[\w-]+/)?.[0];
          cx.fillStyle = (bienMau && mauC.bien(bienMau)) || '#93aac8'; cx.globalAlpha = 0.6;
          for (let yy = TREN + 1; yy < y(n.h) - 1; yy += 3) cx.fillRect(x, yy, 1, 1);
          cx.globalAlpha = 1;
        }
      }
      const vMax = klHien ? Math.max(0, ...klHien) : 0;
      hien.forEach((n, i) => {
        const x = 1 + i * buoc;
        if (n.trang || n.trangBan) { cx.fillStyle = n.trang ? 'rgba(248,113,113,.14)' : 'rgba(74,222,128,.12)'; cx.fillRect(x - 1, TREN + 1, rn + 2, CAO - TREN - 1); }
        cx.fillStyle = n.c >= n.o ? WIN : LOSE; cx.globalAlpha = n.lichSu ? 0.55 : 1;
        cx.fillRect(x + Math.floor(rn / 2), y(n.h), 1, Math.max(1, y(n.l) - y(n.h)));
        const t = Math.min(y(n.o), y(n.c)), b = Math.max(y(n.o), y(n.c)); cx.fillRect(x, t, rn, Math.max(1, b - t));
        const v = klHien?.[i];
        if (v !== undefined && vMax > 0) { const vh = Math.max(1, Math.round((v / vMax) * VOLH)); cx.globalAlpha = n.lichSu ? 0.35 : 0.7; cx.fillRect(x, VOL0 + VOLH - vh, rn, vh); }   // D536
        cx.globalAlpha = 1;
      });
      /*
       * D494 — dấu THANH LÝ của đám đông (demo D488): vạch chấm đỏ từ mép trên + ô 3×3 ở nến bị bán cưỡng bức — không chữ, màu làm thay (founder 04/10).
       * Chỉ nến đã chạy tới (nhịp ≤ nhịp đang xem).
       */
      for (const e of tlDay.current) {
        if (e.nhip > nhipXem.current) continue;
        const x = 1 + (NEN_LS + Math.floor(e.nhip / (gop ? 16 : 8))) * buoc + Math.floor(rn / 2);
        cx.fillStyle = LOSE;
        for (let yy = TREN + 1; yy < TREN + 40; yy += 3) cx.fillRect(x, yy, 1, 1);
        cx.fillRect(x - 1, TREN + 1, 3, 3);
      }
      // D529 — `nay` (vẽ: vạch giá, nhãn %) trượt theo nội suy; `nayThat` (state: số trên màn) đứng theo nhịp nguyên.
      const giaDau = d.lich_su[d.lich_su.length - 1]?.[3] ?? 100, nay = thayVe[thayVe.length - 1] ?? giaDau, nayThat = thay[thay.length - 1] ?? giaDau;
      // D492 — Đòn Bẩy: vạch GỌI (hổ phách) + vạch THANH LÝ (đỏ) ở nhịp đang xem (demo `veDoThi`), và dò cạnh gọi / chạm sàn.
      // D538 — demo BẢN 49 `veNgoaiKhung`: vạch nằm ngoài khung giá ⇒ dấu ▼/▲ ở mép phải (trước đây không vẽ gì — founder: "phải zoom mới hiện").
      // Nhịp đang xem còn trước mốc đầu của ngưỡng (vừa bấm, xem trễ ~1,4 s) ⇒ dùng mốc đầu, không để trống vạch.
      const ng = soRef.current?.db?.nguong, iNg = ng ? Math.max(0, nhipXem.current - ng.tu) : -1;
      if (ng && p.loai === 'chay' && !tlRef.current && iNg < ng.goi.length && (soRef.current?.dang_cam ?? 0) > 0) {
        const gG = ng.goi[iNg]!, gT = ng.thanh_ly[iNg]!;
        ([[gG, mau.getPropertyValue('--gold-amber').trim() || '#fbbf24'], [gT, LOSE]] as const).forEach(([gv, m], i) => {
          cx.fillStyle = m;
          const yy = y(gv);
          if (yy > CAO - 1 || yy < TREN + 1) {
            const xm = W - 6 - 6 * i, y0 = yy > CAO - 1 ? CAO - 4 : TREN + 2, ch = yy > CAO - 1 ? 1 : -1;
            for (let k = 0; k < 3; k++) cx.fillRect(xm - 2 + k, y0 + ch * k, 5 - 2 * k, 1);
            return;
          }
          for (let x = 0; x < W; x += 6) cx.fillRect(x, yy, 3, 1);
        });
      }
      /*
       * D513 — LỚP SOI (chuỗi săn; demo bản 41 `veSoi`): Bán Khống thấy SÀN THANH LÝ phe mua (dải đỏ) · Mua Đuổi thấy MỨC ÉP phe khống (dải xanh) — từ nến
       * vị thế mở tới mép phải, độ đậm theo cỡ · Bắt Đáy thấy ĐÁY THÁC (vạch đứt đỏ) + mức châm ngòi (vạch mờ). Chữ: chỉ ×L và % (học game — ít chữ).
       */
      const nhanSoi: string[] = [];
      if (soiNay && 'muc' in soiNay) {
        const khong = laRef.current === 'mua_duoi', mauSoi = khong ? WIN : LOSE;
        for (const m of soiNay.muc) {
          if (m.gia <= yLo || m.gia >= yHi) continue;
          const xa = 1 + (NEN_LS + Math.floor(m.vao / (gop ? 16 : 8))) * buoc;
          cx.globalAlpha = 0.35 + 0.5 * Math.min(1, (m.tien * m.L) / 8); cx.fillStyle = mauSoi; cx.fillRect(xa, y(m.gia) - 1, W - xa, 3); cx.globalAlpha = 1;
          nhanSoi.push(`<b style="top:${y(m.gia)}px" data-k="${khong ? 'ep' : 'san'}">×${m.L}</b>`);
        }
        if (!soiNay.muc.length) nhanSoi.push(`<i>${laRef.current === 'mua_duoi' ? 'chưa ai bán khống' : 'chưa ai vay mua'}</i>`);
      } else if (soiNay && 'thac' in soiNay) {
        const t = soiNay.thac;
        if (!t) nhanSoi.push('<i>chợ vắng đòn bẩy</i>');
        else {
          /*
           * D521 (demo bản 44) — kịch bản CÓ ĐIỀU KIỆN: vạch NẾU CHẠM (sàn cao nhất dưới giá) + DẢI khoảng thác (phần cú thanh lý đẩy thêm, phân vị
           * 10–90 % do server rút đúng phân bố cỡ thật). Bỏ chữ HỒI — hồi không chắc. Màn cũ (không `tu`/`den`) ⇒ dải co về một vạch.
           */
          const mo = mau.getPropertyValue('--text-muted').trim() || '#93aac8', tu = t.tu ?? t.day, den = t.den ?? t.day;
          if (t.ngoi > yLo && t.ngoi < yHi) { cx.fillStyle = mo; for (let x = 0; x < W; x += 6) cx.fillRect(x, y(t.ngoi), 3, 1); }
          const yT = y(Math.min(tu, yHi)), yD = y(Math.max(den, yLo));
          cx.globalAlpha = 0.22; cx.fillStyle = LOSE; cx.fillRect(0, Math.min(yT, yD), W, Math.max(2, Math.abs(yD - yT))); cx.globalAlpha = 1;
          nhanSoi.push(`<b style="top:${y(t.ngoi)}px" data-k="ngoi">NẾU CHẠM · ${t.n} sàn nối nhau</b>`,
            `<b style="top:${y(den)}px" data-k="thac">▸ THÁC ${pct(tu / t.ngoi - 1)} … ${pct(den / t.ngoi - 1)}</b>`);
        }
      }
      if (soiNay && 'gt' in soiNay) {
        /*
         * D523 (demo bản 46 `veGiaTri`) — ĐƯỜNG GIÁ TRỊ (hổ phách, liền) + DẢI DƯỚI (chấm) + nền mờ giữa hai đường, chỉ tới nến đã tới nhịp đang xem;
         * nhãn "GIÁ TRỊ ↗/→/↘" (dốc 3 nến) ở mép phải · QUÁ BÁN dưới nến ĐÃ đóng. Server đã trễ + sai số (C4: client chỉ vẽ).
         */
        const { rong, quaBan } = soiNay.gt, nn = gop ? 16 : 8, xem = nhipXem.current;
        const ds = soiNay.gt.diem.filter((d) => d.j * nn <= xem), AMB = mau.getPropertyValue('--gold-amber').trim() || '#fbbf24';
        const xj = (j: number) => 1 + (NEN_LS + j) * buoc + Math.floor(rn / 2);
        cx.fillStyle = 'rgba(251,191,36,.08)';
        ds.forEach((d, i) => { const x = xj(d.j), xn = ds[i + 1] ? xj(ds[i + 1]!.j) : x + buoc; cx.fillRect(x, y(d.g), xn - x, Math.max(1, y(d.g * (1 - rong)) - y(d.g))); });
        cx.fillStyle = AMB;
        ds.forEach((d, i) => {
          const n = ds[i + 1], x = xj(d.j), y0 = y(d.g);
          if (!n) { cx.fillRect(x, y0, 2, 1); return; }
          const y1 = y(n.g); cx.fillRect(x, y0, xj(n.j) - x, 1); if (y1 !== y0) cx.fillRect(xj(n.j), Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1);
        });
        cx.globalAlpha = 0.8;
        ds.forEach((d, i) => { const x = xj(d.j), xn = ds[i + 1] ? xj(ds[i + 1]!.j) : x + buoc; for (let xx = x; xx < xn; xx += 3) cx.fillRect(xx, y(d.g * (1 - rong)), 1, 1); });
        cx.globalAlpha = 1;
        const cuoi = ds[ds.length - 1], truoc = ds[ds.length - 4];
        if (cuoi) {
          const doc = truoc ? (cuoi.g / truoc.g - 1 > 0.003 ? '↗' : cuoi.g / truoc.g - 1 < -0.003 ? '↘' : '→') : '';
          nhanSoi.push(`<b style="top:${y(cuoi.g) - 6}px" data-k="gt">GIÁ TRỊ ${doc}</b>`);
        }
        quaBan.filter((j) => (j + 1) * nn - 1 <= xem).forEach((j) => {
          const n = hien[NEN_LS + j]; if (!n) return;
          nhanSoi.push(`<b style="top:${y(n.l) + 10}px;left:${((xj(j) / W) * 100).toFixed(2)}%" data-k="qb">QUÁ BÁN</b>`);
        });
      }
      cx.fillStyle = ACC; for (let x = 0; x < W; x += 4) cx.fillRect(x, y(nay), 2, 1);
      if (c !== cvTheoDoi) {   // canvas mới gắn (pha chạy mở ra) ⇒ đo một lần rồi để ResizeObserver báo khi đổi cỡ
        roCv?.disconnect(); cvTheoDoi = c; { const R = c.getBoundingClientRect(); caoCv.current = R.height; rongCv.current = R.width; }
        if (typeof ResizeObserver !== 'undefined') { roCv = new ResizeObserver(([e]) => { if (e) { caoCv.current = e.contentRect.height; rongCv.current = e.contentRect.width; } }); roCv.observe(c); }
      }
      const ky = caoCv.current / c.height;   // D529 — cao thật của canvas từ ResizeObserver, không `getBoundingClientRect` (ép tính bố cục) mỗi khung
      if (soiNhan.current) {
        const html = nhanSoi.join('').replace(/top:(\d+)px/g, (_m, v: string) => `top:${Math.round(Number(v) * ky) - 7}px`);
        if (soiNhan.current.innerHTML !== html) soiNhan.current.innerHTML = html;   // chỉ số + chữ hằng — không có dữ liệu người dùng
      }
      /*
       * D528 — KÊ LỆNH (demo bản 49 `veKe` · `veKeNhan`): vạch đứt khi chờ, liền khi ĐÃ khớp (chỉ khi nhịp đang xem đã qua nhịp khớp — không lộ trước);
       * dải mờ 3 px quanh vạch; ngoài khung thì nhãn dính mép. Nhãn ở mép phải là tay cầm kéo — chữ đổi ở đây (không qua React mỗi khung).
       */
      {
        const keNay = keSv.current, kk = keKeo.current, xs: [HTMLDivElement, number][] = [];
        for (const ben of ['mua', 'ban'] as const) {
          const el = keNhanEl.current[ben];
          const b = keNay?.[ben] ?? null, nhap = keNhap.current[ben];
          const laNhap = nhap !== null && !(b && !b.huy && b.khop === null);   // D539 — có nháp và không có lệnh thật đang chờ cùng phía
          const bp = kk?.ben === ben ? kk.bp : laNhap ? nhap : b && !b.huy ? b.gia_bp : null;
          if (bp === null) { if (el) { el.style.display = 'none'; el.dataset.nhap = ''; } continue; }
          const gk = giaDau * (1 + bp / 10000), yy = y(gk), khop = !laNhap && !!b && !b.huy && b.khop !== null && b.khop <= nhipXem.current && kk?.ben !== ben;
          // D534 — demo `veKe` · khớp: hạt (màu phía lệnh) tung từ nhãn + cả bàn rung — MỘT lần mỗi lệnh.
          if (khop && b) {
            const khoaMung = `${ben}:${b.gia_bp}:${b.khop}`;
            if (!keMung.current.has(khoaMung)) {
              keMung.current.add(khoaMung);
              phutHat(tamPhanTu(el ?? c), ben === 'mua' ? 'var(--win)' : 'var(--lose)', 16);
              setRung(true); hen(() => setRung(false), 140);
            }
          }
          const mauK = ben === 'mua' ? WIN : LOSE;
          if (yy > TREN && yy < CAO) {
            if (laNhap && kk?.ben !== ben) {   // D539 — NHÁP: chấm thưa, mờ, không dải sáng
              cx.globalAlpha = 0.55; cx.fillStyle = mauK; for (let x = x0; x < W; x += 6) cx.fillRect(x, yy, 2, 1); cx.globalAlpha = 1;
            } else {
              cx.globalAlpha = 0.12; cx.fillStyle = mauK; cx.fillRect(x0, yy - 1, W - x0, 3); cx.globalAlpha = 1; cx.fillStyle = mauK;
              if (khop) cx.fillRect(x0, yy, W - x0, 1); else for (let x = x0; x < W; x += 5) cx.fillRect(x, yy, 3, 1);
            }
          }
          if (!el) continue;
          el.style.display = '';
          const so0 = soRef.current, laK = laRef.current, kq0 = laK === 'don_bay' || laK === 'ban_khong', bk = laK === 'ban_khong', cam = (so0?.dang_cam ?? 0) > 0;
          const vt = khop && b?.vt ? b.vt : ben === 'mua' ? (cam && bk ? 'chot' : 'mo') : cam && !bk ? 'chot' : bk ? 'mo' : 'ban_giu';
          const t = el.querySelector<HTMLElement>('[data-ke="t"]');
          if (t) t.textContent = `${ben === 'mua' ? 'MUA' : 'BÁN'} ${pct(bp / 10000)}${khop ? ' ✓' : laNhap ? ' · NHÁP' : ` · ${TEN_VT_KE[vt]}`}`;
          el.dataset.khop = khop ? '1' : '';
          el.dataset.nhap = laNhap ? '1' : '';
          el.dataset.l = kq0 && vt === 'mo' && !khop ? '1' : '';
          xs.push([el, Math.max(TREN + 8, Math.min(CAO - 8, yy)) * ky]);
        }
        if (xs.length === 2 && Math.abs(xs[0]![1] - xs[1]![1]) < 34) {   // hai nhãn sát nhau ⇒ đẩy tách (bán lên, mua xuống)
          const [m, b] = xs, can = (34 - Math.abs(m![1] - b![1])) / 2;
          if (m![1] >= b![1]) { m![1] += can; b![1] -= can; } else { m![1] -= can; b![1] += can; }
        }
        xs.forEach(([el, top]) => { el.style.top = `${top}px`; });
      }
      if (tag.current) {
        tag.current.textContent = pct(nay / giaDau - 1);
        tag.current.style.transform = `translateY(${y(nay) * ky - 9}px)`;
      }
      setGiaNay((cu) => (cu === nayThat ? cu : nayThat));
      /*
       * D532 — GHIM + BONG BÓNG TIN (demo `veTin`, chép nguyên): ghim màu ở mép trên đúng cây nến (tầng xếp chồng 9 px) · KIÊN NHẪN thấy trước ghim
       * mờ của tin chưa tới (màu = uy tín, xám — không lộ hướng/thật; MÙ TIN chỉ vị trí) · bong bóng tại cây nến, né nhãn giá · MÙ TIN: chữ xáo mỗi
       * 90 ms, nguồn bị che · đã mua tin sớm: dấu ✓ THẬT / ✗ NHIỄU. Dựng bằng `textContent` (chữ là hằng của client — D26 — vẫn không qua HTML).
       */
      {
        const lop = tinLop.current, chong = chongEl.current, kx = rongCv.current / W, xPx = (ci: number) => (xTin(ci) + 1.5) * kx, dung = new Set<string>();
        /** D534 — ghi màu / vị trí của ghim CHỈ khi đổi: vòng vẽ chạy mỗi khung, ghi `--c` mỗi khung là ép trình duyệt tính lại kiểu mỗi khung. */
        const datKieu = (g: HTMLElement, mau: string, tf: string) => {
          if (g.dataset.c !== mau) { g.dataset.c = mau; g.style.setProperty('--c', mau); }
          if (g.dataset.tf !== tf) { g.dataset.tf = tf; g.style.transform = tf; }
        };
        const ghim = (khoa: string, truoc: boolean): HTMLButtonElement | null => {
          if (!lop) return null;
          let g = tv.ghim.get(khoa);
          if (!g || g.parentNode !== lop) {
            g = document.createElement('button'); g.type = 'button'; g.className = truoc ? `${s.ghim} ${s.ghimTruoc}` : s.ghim!;
            g.appendChild(document.createElement('i'));
            if (truoc) { g.tabIndex = -1; g.setAttribute('aria-hidden', 'true'); } else g.dataset.tin = khoa.slice(1);
            lop.appendChild(g); tv.ghim.set(khoa, g);
          }
          dung.add(khoa); return g;
        };
        (d.tin_truoc ?? []).forEach((t, i) => {
          if (t.ci <= sMin) return;
          const g = ghim(`t${i}`, true); if (!g) return;
          datKieu(g, `var(--mo-${oTin.muTin || !t.uy ? 3 : t.uy})`, `translate(${xPx(t.ci)}px, ${t.tang * 9}px)`);
        });
        tinDaLo.forEach((t) => {
          const g = ghim(`r${t.id}`, false); if (!g) return;
          const ng = t.ng ? nguonTin(t.ng) : null, nhan = oTin.muTin || !ng ? 'Tin (chữ bị che)' : `${ng.ten}: ${t.chu ? chuTin(t.chu) ?? '' : ''}`;
          if (g.getAttribute('aria-label') !== nhan) g.setAttribute('aria-label', nhan);
          datKieu(g, mauTin(t, oTin), `translate(${xPx(t.ci)}px, ${t.tang * 9}px)`);
        });
        tv.ghim.forEach((g, k) => { const an = !dung.has(k); if (g.hidden !== an) g.hidden = an; });
        if (chong) {
          const khoa = tinMo ? `${tinMo.id}|${oTin.daMua ? tinMo.that ?? '' : ''}|${tv.moLai ? 'l' : ''}` : '';
          if (khoa !== tv.khoa) {
            tv.khoa = khoa; chong.textContent = '';
            if (tinMo) {
              const b = document.createElement('div'), dau0 = document.createElement('div'), ngEl = document.createElement('span');
              b.className = `${s.bong} ${s.bongVao}`; dau0.className = s.bongDau!; ngEl.className = s.bongNg!; dau0.appendChild(ngEl); b.appendChild(dau0);
              const ng = tinMo.ng ? nguonTin(tinMo.ng) : null;
              if (oTin.muTin || !ng) {
                b.style.setProperty('--c', 'var(--mo-3)'); ngEl.textContent = 'NGUỒN BỊ CHE';
                const txt = document.createElement('span'); txt.dataset.xao = '1'; txt.textContent = xaoChu(); b.appendChild(txt);
              } else {
                b.style.setProperty('--c', mauTin(tinMo, oTin)); ngEl.textContent = ng.ten;
                const uy = document.createElement('span'), mo = document.createElement('s');
                uy.className = s.bongUy!; uy.textContent = '■'.repeat(ng.uy); mo.textContent = '■'.repeat(5 - ng.uy); uy.appendChild(mo); dau0.appendChild(uy);
                if (oTin.daMua && tinMo.that !== undefined) {
                  const xm = document.createElement('span'); xm.className = `${s.dauXM} ${tinMo.that ? s.xmThat : s.xmNhieu}`;
                  xm.textContent = tinMo.that ? '✓ THẬT' : '✗ NHIỄU'; dau0.appendChild(xm);
                }
                b.appendChild(document.createTextNode(tinMo.chu ? chuTin(tinMo.chu) ?? '' : ''));
              }
              chong.appendChild(b); tv.bw = chong.offsetWidth; tv.bh = chong.offsetHeight;   // đo MỘT lần lúc dựng (không ép bố cục mỗi khung)
            }
          }
          if (tinMo && oTin.muTin) {
            const bay = performance.now();
            if (bay - tv.xao > 90) { const el = chong.querySelector<HTMLElement>('[data-xao]'); if (el) el.textContent = xaoChu(); tv.xao = bay; }
          }
          if (tinMo) {
            const yGia = y(nay) * ky, trai = Math.max(4, Math.min(rongCv.current - tv.bw - 4, xPx(tinMo.ci) - tv.bw * 0.6)), duoi = yGia < tv.bh + 34;
            chong.style.transform = `translate(${trai}px, ${duoi ? yGia + 14 : 22}px)`;
          }
        }
      }
      // TRẮNG của NẾN GỘP đang chạy (server khoá khớp theo nến gộp — D475; cờ tới lúc nến gộp mở).
      // D486 — khung nhanh (Nóng Vội): server xét trắng theo NẾN MỊN của nhịp; khung thường theo nến gộp.
      const jMin = Math.floor(Math.max(0, nhipXem.current) / NHIP_MOI_NEN), jGop = Math.floor(jMin / 2);
      const a = gop ? trang.current.get(2 * jGop) : trang.current.get(jMin), b2 = gop ? trang.current.get(2 * jGop + 1) : undefined;
      const tr = p.loai === 'chay' ? (a?.[0] || b2?.[0] ? 'mua' : a?.[1] || b2?.[1] ? 'ban' : null) : null;
      setTrangNay((cu) => (cu === tr ? cu : tr));
      /*
       * D534 — demo `veDoThi` (`#bung` · `#nhanLon`). NHÃN ĐÀ của lõi, tính trên chính các nến đang vẽ: Bắt Đáy "ĐANG BÙNG" khi ≥ 3 nến xanh liền
       * tới nến hiện tại VÀ giá trên trung bình giá đóng các nến đã chạy (demo `dangBung`) · Mua Đuổi "×n NẾN XANH" từ 2 nến (demo `chuoiXanh`).
       * Chỉ là đọc đồ thị đang thấy — không phải tiền (C4). Nhãn BÁN CƯỠNG BỨC: một vị thế đòn bẩy của bàn bị thanh lý (sự kiện `tl` đã tới nhịp
       * đang xem), giữ ~1,2 nến như demo.
       */
      {
        const song = hien.filter((n) => !n.lichSu), cur = song[song.length - 1];
        let xanh = 0;
        if (p.loai === 'chay' && cur && cur.c > cur.o) { xanh = 1; for (let i = song.length - 2; i >= 0 && song[i]!.c > song[i]!.o; i--) xanh++; }
        const laNay = laRef.current;
        const bungMoi = p.loai !== 'chay' ? null
          : laNay === 'bat_day' ? (song.length >= 3 && xanh >= 3 && nay > song.slice(0, -1).reduce((a, n) => a + n.c, 0) / (song.length - 1) ? 'ĐANG BÙNG' : null)
            : laNay === 'mua_duoi' ? (xanh >= 2 ? `×${xanh} NẾN XANH` : null) : null;
        setBung((cu) => (cu === bungMoi ? cu : bungMoi));
        const nhipNen = NHIP_MOI_NEN * (gop ? 2 : 1);
        // D536 — lệnh lớn đang đè (nhịp mở … hết, server tính như demo) thắng nhãn bán cưỡng bức (demo `G.xung.find`: cú dựng sẵn đứng trước cú thanh lý).
        const xem = nhipXem.current, lon = p.loai === 'chay' ? lonDay.current.find((e) => xem >= e.nhip && xem < e.het) : undefined;
        const lonMoi = p.loai !== 'chay' ? null : lon ? `◆ LỆNH LỚN${lon.ai && AI_LENH_LON[lon.ai] ? ` · ${AI_LENH_LON[lon.ai]}` : ''}`
          : tlDay.current.some((e) => xem >= e.nhip && xem < e.nhip + Math.ceil(1.2 * nhipNen)) ? 'BÁN CƯỠNG BỨC' : null;
        setNhanLon((cu) => (cu === lonMoi ? cu : lonMoi));
      }
    };
    raf = requestAnimationFrame(ve);
    return () => { cancelAnimationFrame(raf); roCv?.disconnect(); };
  }, []);

  /* ── hết màn ⇒ hỏi KẾT QUẢ (server quyết toán khi đồng hồ của nó qua mốc) ── */
  useEffect(() => {
    if (pha?.loai !== 'het' || kq) return;
    let huy = false;
    (async () => {
      for (let lan = 0; lan < KQ_HOI_TOI_DA && !huy; lan++) {
        try { const r = await layKetQuaMan(matchId, vong); if (!huy) setKq(r); return; } catch (e) {
          if (e instanceof ApiError && e.code !== 'chua_het') { if (!huy) setLoi(e.code); return; }
        }
        await new Promise((ok) => setTimeout(ok, KQ_HOI_LAI_MS));
      }
    })();
    return () => { huy = true; };
  }, [pha?.loai, kq, matchId, vong]);

  /*
   * D534 — demo `G.dem` · `phut(so, 22, MAU.gold)`: số lãi lỗ của màn CHẠY từ 0 tới đích trong 1,1 s, chậm dần (1 − (1 − f)³), + 22 hạt vàng khi có
   * lãi. Ghi thẳng chữ của MỘT ô (không kéo cả màn vẽ lại mỗi khung); giảm chuyển động ⇒ đứng ngay ở đích (chữ React đã là đích).
   */
  useEffect(() => {
    const el = soKq.current;
    if (!kq || !el) return;
    const den = soLonKq(kq);
    if (den > 0) phutHat(tamPhanTu(el), 'var(--gold)', 22);
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t0 = performance.now();
    let raf = 0;
    const buoc = () => {
      const f = Math.min(1, (performance.now() - t0) / 1100);
      el.textContent = fmtDau(Math.round(den * (1 - Math.pow(1 - f, 3))));
      if (f < 1) raf = requestAnimationFrame(buoc);
    };
    buoc();
    return () => { cancelAnimationFrame(raf); el.textContent = fmtDau(den); };
  }, [kq]);

  /* D473 → D476 — kết quả hiện xong thì tự về vòng; nút VÒNG KẾ về sớm. Không có kết quả (lỗi) ⇒ về sau 1,5 s. */
  useEffect(() => {
    if (pha?.loai !== 'het') return;
    const t = setTimeout(dong, kq ? KQ_TU_DONG_MS : loi ? 1500 : KQ_HOI_LAI_MS * KQ_HOI_TOI_DA + 1500);
    return () => clearTimeout(t);
  }, [pha?.loai, kq, loi, dong]);

  /* ── chọn lá (trước khi màn chạy) ── */
  const chonLa = useCallback((id: string, el?: Element) => {
    if (pha?.loai !== 'chon' || daChon) return;
    phutHat(tamPhanTu(el ?? null), 'var(--gold)', 14);   // D534 — demo `chonLa`: hạt vàng từ lá vừa chọn
    setDaChon(id); setLa(id);
    bamNut(matchId, vong, { nhip: -1, nut: `la_${id}`, khoa: khoaMoi() })
      .then((r) => { setLa(r.la); setSo(r.so); apTin(r); }).catch(() => undefined);
  }, [pha?.loai, daChon, matchId, vong, apTin]);

  /* ── D532 — Lướt Sóng MUA TIN SỚM, trước khi màn chạy, một lần (demo `veTruocMan`): server trừ phí ở quyết toán + trả danh sách tin thật ── */
  const [dangMuaTin, setDangMuaTin] = useState(false);
  const muaTin = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (pha?.loai !== 'chon' || dangMuaTin || tinMua?.da_mua) return;
    setDangMuaTin(true);
    phutHat(tamPhanTu(e.currentTarget), 'var(--gold)', 12);   // demo `phut(b, 12, MAU.gold)`
    bamNut(matchId, vong, { nhip: -1, nut: 'mua_tin', khoa: khoaMoi() })
      .then((r) => { apTin(r); if (r.so) setSo(r.so); }).catch(() => undefined).finally(() => setDangMuaTin(false));
  }, [pha?.loai, dangMuaTin, tinMua?.da_mua, matchId, vong, apTin]);
  /** D532 — bấm ghim = đọc lại tin (miễn phí, demo `bamGhim`): mở bong bóng của tin đó thêm 2,5 nến xem. */
  const bamGhim = (e: React.MouseEvent) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-tin]')?.dataset.tin;
    if (id === undefined || pha?.loai !== 'chay') return;
    tinVe.current.moLai = { id: Number(id), den: tinVe.current.sMin + MO_LAI_NEN_MIN }; tinVe.current.khoa = '';
  };

  /* ── D483 — GÀI TIN GIẢ (TUNG TIN của Đội lái), trước khi màn chạy, một lần (demo `veTruocMan` · `gaiTin`) ── */
  const [gai, setGai] = useState<1 | -1 | 0>(0);
  useEffect(() => { if (dau?.gai?.chieu) setGai(dau.gai.chieu); }, [dau?.gai?.chieu]);
  const gaiTin = useCallback((chieu: 1 | -1) => {
    if (pha?.loai !== 'chon' || gai !== 0) return;
    setGai(chieu);
    bamNut(matchId, vong, { nhip: -1, nut: chieu > 0 ? 'gai_tot' : 'gai_xau', khoa: khoaMoi() })
      .then((r) => { if (r.gai) setGai(r.gai.chieu); }).catch(() => setGai(0));
  }, [pha?.loai, gai, matchId, vong]);

  /* ── bấm nút: gửi SỐ NHỊP đang thấy; server khớp, trả sổ ── */
  const bam = useCallback((nut: string) => {
    const d = dauRef.current, k = nhipXem.current;
    if (!d || pha?.loai !== 'chay' || k < 0 || khoaTr || tlNhip !== null || tranRef.current) return;   // D486 — trait đang khoá nút · D492 — đã chạm sàn thanh lý
    setLun(nut); hen(() => setLun(null), 90);
    if (NUT[nut]?.rung || nut === 'vao_x10' || nut === 'tang_x10' || nut === 'ban_het') { setRung(true); hen(() => setRung(false), 140); }
    bamNut(matchId, vong, { nhip: k, nut, khoa: khoaMoi(), ...(maXem ? { ma: maXem } : {}) })
      .then((r) => {
        // D499 — lệnh này sinh cú TỰ ĐẨY giá ⇒ đường từ nhịp kế đã đổi. D504 — mọi cú bấm được ghi đều đổi vị thế ⇒ tạm tính từ nhịp kế đã đổi.
        // Cả hai: cắt phần đã nhận trước mà chưa xem, nối lại dòng từ nhịp đang xem (server dựng lại đường + tạm tính từ sổ mới).
        if (r.da_ghi_truoc_do) return;   // cú gửi lại: sổ không đổi (server không kèm sổ)
        if (r.seq <= seqDaAp.current) return;   // D519 — câu trả lời cũ về sau câu mới: sổ mới đã có (server ghi tuần tự, seq tăng dần)
        seqDaAp.current = r.seq;
        const giu = Math.max(0, nhipXem.current + 1);
        gia.current.length = giu; ttNhip.current.length = giu;
        setPhienNhip((x) => x + 1);
        setSo(r.so);
      }).catch(() => undefined);
  }, [pha?.loai, matchId, vong, khoaTr, tlNhip]);   // tranRef là ref — đọc giá trị mới nhất, không cần trong deps

  /* ── D528 — KÊ LỆNH: đặt / dời / huỷ — gửi SỐ NHỊP đang thấy (−1 trong đếm ngược) + giá theo bp so với giá mở; server kiểm phía + khớp ── */
  const giaMoMan = () => dauRef.current?.lich_su[dauRef.current.lich_su.length - 1]?.[3] ?? 100;
  const giaDangXem = () => (nhipXem.current >= 0 ? gia.current[nhipXem.current] ?? giaMoMan() : giaMoMan());
  const giaTaiY = (clientY: number): number | null => {
    const c = cv.current, yk = yKhung.current;
    if (!c || !yk) return null;
    const R = c.getBoundingClientRect(), py = ((clientY - R.top) * c.height) / R.height;
    return yk.hi - ((py - TREN - 2) / (CAO - TREN - 4)) * (yk.hi - yk.lo);
  };
  /** Mua nằm dưới giá đang thấy, bán trên; không ra ngoài khung đang thấy (kéo quá mép thì dính mép). Trả bp so với giá mở. */
  const kepKe = (ben: 'mua' | 'ban', gv: number): number => {
    const nayG = giaDangXem(), yk = yKhung.current;
    let v = ben === 'mua' ? Math.min(gv, nayG * (1 - KE_SAT)) : Math.max(gv, nayG * (1 + KE_SAT));
    if (yk) v = Math.max(yk.lo, Math.min(yk.hi, v));
    return Math.round((v / giaMoMan() - 1) * 10000);
  };
  const keDuocBam = () => (pha?.loai === 'dem' || pha?.loai === 'chay') && tlNhip === null && !tranRef.current && khoaTr?.ly !== 'nong_voi';
  const songKe = (ben: 'mua' | 'ban') => { const b = keHien?.[ben]; return !!b && !b.huy && b.khop === null; };
  const guiKe = useCallback((ben: 'mua' | 'ban', bp: number | null) => {
    const d = dauRef.current;
    if (!d?.ke_trait?.[ben] || !keDuocBam()) return;
    const k = pha?.loai === 'chay' ? Math.max(0, nhipXem.current) : -1, cu = keSv.current;
    // Hiện ngay (chỉ hiển thị); câu trả lời của server thay bằng lệnh thật — sai phía / hết cửa thì server từ chối, vạch về như cũ.
    const tam: SoV59DTO['ke'] = { mua: cu?.mua ?? null, ban: cu?.ban ?? null };
    tam[ben] = bp === null ? null : { gia_bp: bp, L: keL.current[ben], khop: null, vt: null, huy: null, sua: 0 };
    apKe(tam);
    if (bp !== null) phutHat(tamPhanTu(doThiEl.current), ben === 'mua' ? 'var(--win)' : 'var(--lose)', 10);   // D534 — demo `datKe`
    bamNut(matchId, vong, { nhip: k, nut: bp === null ? `ke_huy_${ben}` : `ke_${ben}`, ...(bp === null ? {} : { gia_bp: bp, L: keL.current[ben] }), khoa: khoaMoi(), ...(maXem ? { ma: maXem } : {}) })
      .then((r) => {
        if (r.da_ghi_truoc_do || r.seq <= seqDaAp.current) return;
        seqDaAp.current = r.seq;
        if (k >= 0) {   // luật tự động đọc theo lệnh mới ⇒ nối lại dòng từ nhịp đang xem (như cú bấm thường)
          const giu = Math.max(0, nhipXem.current + 1);
          gia.current.length = giu; ttNhip.current.length = giu;
          setPhienNhip((x) => x + 1);
        } else setPhienNhip((x) => x + 1);
        setSo(r.so); apKe(r.so.ke);
      }).catch(() => apKe(cu));
  }, [matchId, vong, pha?.loai, tlNhip, khoaTr?.ly, apKe]);   // keDuocBam đọc tranRef (ref) + các state trong deps
  /** D539 — nút KÊ: lệnh thật đang chờ ⇒ huỷ · đang có nháp ⇒ bỏ nháp · chưa có ⇒ dựng NHÁP (chưa gửi gì). */
  const datKeSan = (ben: 'mua' | 'ban') => {
    if (songKe(ben)) { guiKe(ben, null); return; }   // nút đang bật ⇒ chạm lại là huỷ
    if (keNhap.current[ben] !== null) { datNhap(ben, null); return; }
    if (!keDuocBam()) return;
    datNhap(ben, kepKe(ben, giaDangXem() * (ben === 'mua' ? 1 - KE_CACH : 1 + KE_CACH)));
  };
  /** D539 — ✓ ĐẶT: nháp thành lệnh thật (kẹp lại theo giá đang thấy — nháp nằm lâu có thể đã bị giá vượt qua). */
  const datThat = (ben: 'mua' | 'ban') => {
    const bp = keNhap.current[ben]; if (bp === null) return;
    datNhap(ben, null);
    guiKe(ben, kepKe(ben, giaMoMan() * (1 + bp / 10000)));
  };
  const doiKeL = (ben: 'mua' | 'ban') => {
    const ds = MUC_DB as readonly number[], L = ds[(ds.indexOf(keL.current[ben]) + 1) % ds.length]!;
    keL.current = { ...keL.current, [ben]: L }; setKeLHien(keL.current);
    if (keNhap.current[ben] !== null && !songKe(ben)) return;   // D539 — nháp: chỉ đổi mức ở client
    const b = keSv.current?.[ben];
    if (b && !b.huy && b.khop === null) guiKe(ben, b.gia_bp);   // đổi mức của lệnh đang chờ = đặt lại cùng giá
  };
  const batDauKeo = (ben: 'mua' | 'ban', e: React.PointerEvent) => {
    const b = keSv.current?.[ben], gv = giaTaiY(e.clientY), nhap = keNhap.current[ben];
    const song = !!b && !b.huy && b.khop === null;
    if ((!song && nhap === null) || gv === null || !keDuocBam()) return;
    const bp0 = song ? b!.gia_bp : nhap!;
    const gk = giaMoMan() * (1 + bp0 / 10000);
    keKeo.current = { ben, bp: bp0, dg: gk - gv, bp0, nhap: !song };
    try { (e.currentTarget.closest('[data-khoi="do-thi"]') as HTMLElement | null)?.setPointerCapture(e.pointerId); } catch { /* sự kiện tổng hợp */ }
    e.preventDefault(); e.stopPropagation();
  };
  const keDown = (e: React.PointerEvent) => {   // chạm sát một vạch đang chờ (≤ 18 px) cũng là nắm vạch
    if (!dau?.ke_trait || !cv.current || !yKhung.current || (e.target as HTMLElement).closest('button')) return;
    const R = cv.current.getBoundingClientRect(), ky = R.height / cv.current.height, yk = yKhung.current;
    const yMan = (gv: number) => R.top + (TREN + 2 + ((yk.hi - gv) / (yk.hi - yk.lo)) * (CAO - TREN - 4)) * ky;
    const gan = (['mua', 'ban'] as const).find((ben) => {
      const b = keSv.current?.[ben], bp = b && !b.huy && b.khop === null ? b.gia_bp : keNhap.current[ben];   // D539 — nắm được cả vạch nháp
      return bp !== null && Math.abs(yMan(giaMoMan() * (1 + bp / 10000)) - e.clientY) <= 18;
    });
    if (gan) batDauKeo(gan, e);
  };
  const keMove = (e: React.PointerEvent) => {
    const kk = keKeo.current; if (!kk) return;
    const gv = giaTaiY(e.clientY); if (gv === null) return;
    kk.bp = kepKe(kk.ben, gv + kk.dg);
  };
  const keUp = () => {
    const kk = keKeo.current; if (!kk) return;
    keKeo.current = null;
    if (kk.nhap) { datNhap(kk.ben, kk.bp); return; }   // D539 — nháp: chỉ dời ở client
    if (kk.bp !== kk.bp0) guiKe(kk.ben, kk.bp);
  };

  const ts = dau ? TAI_SAN.find((t) => t.id === dau.ma) : undefined;
  // D532 — phí MUA TIN SỚM trừ giống phí gài: `loi` của server đã gồm cả hai, số lớn = theo lệnh − hai phí.
  const phiGai = (kq?.phi_gai ?? 0) + (kq?.phi_tin ?? 0);
  // D561 — khoá nhiều mã: ô bảng phụ là cửa sang màn con của mã ấy.
  const choDoi = !!doiMa && (dau?.nhieu_ma?.length ?? 0) > 1;
  /* D492 — Đòn Bẩy: đã chạm sàn (dò ở client hoặc server báo trong sổ) ⇒ khoá mọi nút tới hết màn. */
  const db = so?.db;
  const daTl = tlNhip !== null || !!db?.thanh_ly;
  /* D499 — Tổ Chức đã chạm trần (client dò hoặc server báo) ⇒ khoá + xám hàng nút (không xám đồ thị). */
  const daTran = tranNhip !== null || !!so?.tran_thua;
  const toChuc = dau?.to_chuc === true;
  /* D489/D493 — founder 04/10: "chỉ xám phần nút bấm và chart thôi" — đồ thị xám khi bị SÀN thanh lý (không khi tự BÁN HẾT, như demo). */
  const biSan = tlNhip !== null || (!!db?.thanh_ly && !db.thanh_ly.ban_het);
  /** D510 — lõi chơi bằng KÝ QUỸ: Đòn Bẩy (vay mua) · Bán Khống (vay bán, `chieuKq` −1) — cùng bàn phím (demo bản 41 `nutKyQuy`). */
  const kyQuy = la === 'don_bay' || la === 'ban_khong', chieuKq: 1 | -1 = la === 'ban_khong' ? -1 : 1;
  const moDb = kyQuy && !!so && so.dang_cam > 0 && !daTl;
  const chuLa = la ? LOI_MINIGAME_CHU[la as ChienThuatId] : undefined;
  const nut = dau?.nut ?? [];
  /*
   * D490 (founder 04/10: "những lõi khác sau khi chốt lệnh thì các nút bấm cũng xám (chỉ là không xám chart như đòn bẩy)") — đã ra và KHÔNG còn nút
   * nào có tiền (Bắt Đáy: ra rồi không vào lại), hoặc NÓNG VỘI đã tự chốt ⇒ hàng nút xám tới hết màn. Đồ thị giữ màu.
   */
  const daChotXong = !!so && ((so.ra.length > 0 && so.dang_cam === 0 && nut.every((id) => (so.tien_nut[id] ?? 0) <= 0))
    || (khoaTr?.ly === 'nong_voi' && so.dang_cam > 0)) || daTl || daTran;
  /*
   * Ô của hàng nút. Bắt Đáy: ba nút cố định (`NUT`). D492 — Đòn Bẩy (demo `LOI.don_bay.nut`, bàn phím CỐ ĐỊNH 3 ô): chưa vào ⇒ VÀO ×2 · ×4 · ×10;
   * đã vào ⇒ TĂNG mức kế (khoá khi bị gọi) · NẠP THÊM (đang bị gọi ⇒ BÁN HẾT) · CHỐT.
   */
  const tienNut = (id: string) => so?.tien_nut[id] ?? 0;
  // D561 — Bán Khống ở khoá v65 chỉ ×2: server gửi danh sách mức (`muc_db_khong`); vắng ⇒ [2, 4, 10] như trước.
  const mucDb: readonly number[] = chieuKq === -1 && dau?.muc_db_khong?.length ? dau.muc_db_khong : MUC_DB;
  /*
   * D531 — LƯỚT SÓNG (demo `LOI.luot_song.nut`, chép nguyên): MỘT nút đổi chiều — không cầm ⇒ SHORT ▼ · đang LONG ⇒ ĐẢO ▼ SHORT · đang SHORT ⇒
   * ĐẢO ▲ LONG (phí của cú bấm, đảo = 2 lần khớp) — và CHỐT (đang LONG/SHORT · về HOLD; không cầm ⇒ tắt). Chiều + phí do server trả (C4).
   */
  const chLs = so?.ls?.chieu ?? 0;
  const oNutLs: ONut[] | null = la === 'luot_song' && nut.includes('dao') ? [
    { id: 'dao', chu: chLs === 0 ? 'SHORT ▼' : chLs === 1 ? 'ĐẢO ▼ SHORT' : 'ĐẢO ▲ LONG', phu: `phí ${fmt(tienNut('dao'))}`,
      mau: chLs === -1 ? 'xanh' : 'do', can: chLs === -1 ? 1 : -1, duoc: true },
    { id: 'chot', chu: 'CHỐT', phu: chLs === 1 ? 'đang LONG · về HOLD' : chLs === -1 ? 'đang SHORT · về HOLD' : 'đang HOLD', mau: 'lam', can: (chLs === 1 ? -1 : 1), duoc: chLs !== 0 },
  ] : null;
  const oNut: ONut[] = oNutLs ?? (!kyQuy ? nut.flatMap((id) => {
    const c = NUT[id];
    if (!c) return [];
    const soPhan = so?.vao.filter((x) => !x.vay).length ?? 0;   // D511 — Mua Đuổi: VÀO thành NHỒI sau phần đầu, kèm đếm phần (D589: không tính phần vay)
    // D589 — khoá v70 (founder: "sau khi bấm hết 3 nút nhồi lệnh thì thay nút nhồi lệnh thành ×2"): ô ×2 không đứng riêng — nó THAY ô VÀO khi đủ 3 phần.
    if (id === 'vay_x2') return [];
    if (id === 'vao' && soPhan >= 3 && nut.includes('vay_x2')) {
      const t = tienNut('vay_x2'), daVay = !!so?.vao.some((x) => x.vay), cv = NUT.vay_x2!;
      return [{ id: 'vay_x2', chu: daVay ? '×2 ĐANG VAY' : cv.chu, phu: daVay ? 'đã vay' : t > 0 ? `vay ${fmt(t)}` : 'đã chốt · khoá', mau: cv.mau, can: cv.can, rung: true as const, duoc: t > 0 }];
    }
    const tien = tienNut(id);
    // D589 — CHỐT gộp nói lần này bán NỬA hay HẾT (số do server). Bắt Đáy khoá v70: phần 2–3 là GOM (gom bình quân giá xuống), Mua Đuổi là NHỒI.
    const phu = id === 'thoat' ? (tien > 0 ? 'chốt ngay' : '—') : id === 'vao' ? `${soPhan}/3 · ${fmt(tien)}`
      : id === 'chot' ? (tien <= 0 ? '—' : tien >= (so?.dang_cam ?? 0) ? `hết · ${fmt(tien)}` : `nửa · ${fmt(tien)}`) : fmt(tien);
    return [{ id, chu: id === 'vao' && soPhan ? (la === 'bat_day' ? 'GOM' : 'NHỒI') : c.chu, phu,
      mau: c.mau, can: c.can, ...(c.rung || (id === 'vao' && soPhan === 2) ? { rung: true as const } : {}), duoc: tien > 0 }];
  }) : !moDb ? mucDb.map((L, i): ONut => {
    const id = `${chieuKq === 1 ? 'vao_x' : 'ban_x'}${L}`;
    return { id, chu: `${chieuKq === 1 ? 'VÀO' : 'BÁN'} ×${L}`, phu: fmt(tienNut(id) || (dau?.von ?? 0)),
      mau: (chieuKq === 1 ? ['xanh', 'vang', 'do'] as const : ['do', 'vang', 'do'] as const)[i]!, can: chieuKq, rung: L === 10, duoc: tienNut(id) > 0 && !daTl };
  }) : (() => {
    const L = db?.L ?? 0, ke = mucDb[mucDb.indexOf(L) + 1];
    const tang: ONut = ke
      ? { id: `tang_x${ke}`, chu: `TĂNG ×${ke}`, phu: goi ? 'khoá khi bị gọi' : `đang ×${L} · vay thêm`, mau: goi ? 'lam' : 'vang', can: chieuKq, rung: ke === 10, duoc: !goi && tienNut(`tang_x${ke}`) > 0 }
      : { id: '', chu: `×${L} TỐI ĐA`, phu: `ký quỹ ${fmt(db?.ky_quy ?? 0)}`, mau: 'lam', can: 0, duoc: false };
    const giua: ONut = goi
      // D507 — BÁN HẾT dồn mọi khoản khác + Tiền mặt vào ký quỹ (giá biểu đồ, trừ phí); vị thế vẫn mở. Số = tổng khoản còn (server).
      ? { id: 'ban_het', chu: chieuKq === 1 ? 'BÁN HẾT' : 'DỒN HẾT', phu: chieuKq === 1 ? 'dồn hết ký quỹ' : 'bán tài sản khác', mau: 'do', can: (chieuKq === 1 ? -1 : 1), rung: true, duoc: tienNut('ban_het') > 0 }
      : { id: '', chu: 'NẠP THÊM', phu: moNap ? 'chọn khoản ↑' : db?.da_goi ? 'mở hộp nạp' : 'chưa bị gọi', mau: moNap ? 'do' : 'lam', can: 0,
        duoc: !!db?.da_goi || moNap, bam: () => setMoNap((x) => !x) };
    const idDong = chieuKq === 1 ? 'chot' : 'mua_lai';   // D510 — Bán Khống đóng bằng MUA LẠI
    return [tang, giua, { id: idDong, chu: chieuKq === 1 ? 'CHỐT' : 'MUA LẠI', phu: goi ? 'cắt ngay' : 'đóng vị thế', mau: chieuKq === 1 ? 'lam' : 'xanh', can: (chieuKq === 1 ? -1 : 1), duoc: true,
      bam: () => { setMoNap(false); bam(idDong); } }];
  })());
  /*
   * D519 (founder 05/10: "Đòn bẩy bấm 2 nút 1 lúc bị lỗi" — nút nhảy chỗ; demo bản 42) — chữ trên hàng nút ĐỔI (VÀO ×2 ⇒ TĂNG · NẠP · CHỐT) trong lúc màn
   * chạy ⇒ khoá cả hàng KHOA_DOI_PHIM_MS + lật phím: cú bấm thứ hai không rơi vào ô vừa đổi nghĩa.
   */
  const chuPhim = oNut.map((c) => c.chu).join('|');
  const chuPhimTruoc = useRef(chuPhim);
  useEffect(() => {
    if (chuPhimTruoc.current === chuPhim) return;
    const cu = chuPhimTruoc.current;
    chuPhimTruoc.current = chuPhim;
    if (!cu || pha?.loai !== 'chay') return;
    khoaPhimDen.current = performance.now() + KHOA_DOI_PHIM_MS;
    setDoiPhim(true);
    const t = setTimeout(() => setDoiPhim(false), KHOA_DOI_PHIM_MS);
    return () => clearTimeout(t);
  }, [chuPhim, pha?.loai]);
  /* D492 — hộp NẠP THÊM (demo `veNap`): mỗi khoản khác một ô — số sẽ bán + phí do server trả. */
  const oNap = moDb && moNap && db ? Object.entries(db.nap_con).map(([ma, con]) => {
    return { ma, ten: tenKhoan(ma), con, lay: tienNut(`nap_${ma}`), phi: db.nap_phi?.[ma] ?? 0 };
  }) : null;
  const nacTen = dau ? TEN_NAC[dau.nac ?? (ts?.thanh_khoan as keyof typeof TEN_NAC) ?? 'vua'] : '';
  // D588 — lá đã lật trên bàn (D585) ⇒ pha chờ đầu màn là VÀO MÀN, không còn "LẬT THẺ" (không có lá nào lật ở đây — founder: "lật bài rối").
  const tenPha = !pha ? '…' : pha.loai === 'lat' ? (latTrenBan ? 'VÀO MÀN' : `LẬT THẺ VÒNG ${vong}`) : pha.loai === 'chon' ? 'CHỌN LÕI'
    : pha.loai === 'het' ? (kq ? 'QUYẾT TOÁN' : 'KẾT QUẢ LÕI') : `${chuLa ? chuLa.ten.toUpperCase() : 'MÀN'} · VÒNG ${vong}`;
  const giayPha = pha && 'giay' in pha ? pha.giay : giayChay;
  // D561 — khoá úp lá pha: lá vòng vừa chốt (ô PHA) giữ úp tới khi màn hết — chiều phải đọc từ nến, không từ lá. Mặt lá tới cùng kết quả.
  const upLa = dau?.up_la === true && (latTrenBan || !(pha?.loai === 'het' && kq));
  const theMoi = (kq?.the_vong && matTheCua ? matTheCua(kq.the_vong) : undefined) ?? theMoi0;
  const sanKhau = !pha || pha.loai === 'lat' ? null : pha.loai === 'chon' ? 'chon' : pha.loai === 'het' && kq ? 'kq' : 'mini';

  /* dòng tạm tính (demo `.tamTinh`) — số do server trả; phần "giá so với lúc vào" là PHẦN TRĂM GIÁ, không phải tiền (C4) */
  const daChot = so ? so.ra.reduce((a, x) => a + x.lai, 0) : 0;
  const tbVao = so && so.vao.length ? so.vao.reduce((a, x) => a + x.khop * x.tien, 0) / so.vao.reduce((a, x) => a + x.tien, 0) : null;
  // D479 — không bấm = GIỮ suốt màn (demo bản 27): dòng tạm tính nói % giá so với lúc mở màn — phần trăm GIÁ, không phải tiền (C4).
  const giaMo = dau?.lich_su[dau.lich_su.length - 1]?.[3];
  // D486 — NÓNG VỘI qua mốc: server đã tự chốt khoản đang cầm (demo `traitTick` · `dongVT(1, 'trait_nong_voi')`) — đừng in "đang long".
  // D503 — bớt chữ (founder: "làm game ko nên nhét quá nhiều chữ"; demo bản 36): nhãn NHỎ + một số TO. % là phần trăm GIÁ, không phải tiền (C4).
  const soPct = (a: number, b: number) => <b className={a >= b ? s.lai : s.lo}>{pct(a / b - 1)}</b>;
  // D504 (founder chọn A) — đang cầm: SỐ TIỀN lãi lỗ server tính theo nhịp (`tt` của dòng nhịp); chưa tới thì % giá so với lúc vào.
  const soCam = ttNay !== null ? <b className={ttNay >= 0 ? s.lai : s.lo} data-khoi="tam-tinh-tien">{fmtDau(ttNay)}</b> : tbVao && giaNay ? soPct(giaNay, tbVao) : null;
  const tamTinh = daTran ? <b className={s.lo}>CHẠM TRẦN THUA</b>
    : kyQuy && daTl ? <b className={s.lo}>{chieuKq === 1 ? 'BỊ THANH LÝ' : 'BỊ MUA CƯỠNG BỨC'}</b>
    : moDb && db ? <><small className={goi ? s.lo : undefined}>{goi ? 'BỊ GỌI' : chieuKq === 1 ? 'LONG' : 'SHORT'} ×{db.L}</small>{soCam}</>
    : so && so.dang_cam > 0 && khoaTr?.ly === 'nong_voi' ? <small>ĐÃ TỰ CHỐT · GIÂY {dau?.trait_man?.han_s}</small>
    : so && so.dang_cam > 0 ? <><small>LONG</small>{soCam}</>
    : so && so.ra.length ? <><small>ĐÃ ĐÓNG</small><b className={daChot >= 0 ? s.lai : s.lo}>{fmtDau(daChot)}</b></>
      : ttNay !== null && pha?.loai === 'chay' ? <><small>TẠM TÍNH</small>{soCam}</>   // D528 — lệnh kê vừa khớp / khoản giữ đã bán một phần
      : pha?.loai === 'chay' && giaMo && giaNay ? <><small>GIỮ</small>{soPct(giaNay, giaMo)}</>
        : null;

  return (
    <div className={`${s.phu} ${chuyen === 'vao' ? s.vao : chuyen === 'ra' ? s.ra : ''}`} role="dialog" aria-label={`Màn minigame vòng ${vong}`} data-chuyen={chuyen}>
      {loeDo && <div className={s.chopDo} aria-hidden data-khoi="chop-do" />}
      <div className={`${s.dt} ${rung ? s.rung : ''}`}>
        <div className={s.hud}>
          <span className={s.vongHud}>VÒNG {tongVong ? Math.min(vong + 1, tongVong) : vong + 1}{tongVong ? `/${tongVong}` : ''}</span><span>Alpha Draft</span>
          <span className={s.navHud}>NAV <b>{fmt(kq?.nav_sau ?? nav ?? 0)}</b></span>
        </div>
        <div className={s.pha}>
          <span className={s.tenPha}>{tenPha}</span>
          <span className={s.thanhGio}><i ref={thanh} /></span>
          <span className={s.giay}>{giayPha ?? ''}</span>
        </div>
        {/* D527 — bàn tập: Oracle nói ngay trong màn (từ lúc chọn lá tới hết màn chạy; quyết toán thì nhường chỗ cho số). */}
        {(() => {
          const loi = tap && pha && pha.loai !== 'lat' && pha.loai !== 'het' ? loiOracleMan(vong, la) : null;
          return loi ? (
            <div className={s.oracleTap} data-tap="oracle-man" role="note">
              {/* D538 — bay như Oracle của trợ lý hướng dẫn ngoài */}
              <Mascot size={22} glow bay />
              <span>{loi}</span>
            </div>
          ) : null;
        })()}

        <div className={s.ban}>
          <div className={s.oThe}>
            {/* D526 — nhịp xen kẽ có màn ở vòng 1: thẻ cũ là lá MỞ MÀN (ô đầu lật sẵn), không có "vòng 0". */}
            <div className={s.cot1}><span>{vong > 1 ? `VÒNG ${vong - 1}` : 'MỞ MÀN'}</span>
              <div className={s.the}>
                <MatO the={theCu} />
                <div className={s.lung}>?</div>
              </div></div>
            <div className={s.cot1}><span>VÒNG {vong}{upLa ? ' · LẬT SAU MÀN' : ''}</span>
              {/* Úp tới khi pha LẬT THẺ bắt đầu rồi lật (demo `sangPha('lat')` gỡ `up`, trễ 0,45 s). D561 — ô pha của khoá úp lá: úp tới hết màn. */}
              <div ref={theMoiEl} className={`${s.the} ${s.theMoi} ${(!pha && !latTrenBan) || upLa ? s.up : ''}`} data-khoi="the-moi">
                <MatO the={theMoi} />
                <div className={s.lung}>?</div>
              </div></div>
          </div>

          {sanKhau === 'chon' && (
            <div className={s.sanKhau}>
              <div className={s.chonDau}>
                <span className={s.t}>CHỌN LÕI</span>
                <span className={s.p}>{dau?.loi_cam.length ? 'bấm vào một lá' : 'chưa cầm lõi'}</span>
                {theMoi && <span className={s.oChip}>THẺ VÒNG {vong}: {theMoi.ten.toUpperCase()}</span>}
              </div>
              <div className={`${s.haiLa} ${(dau?.loi_cam.length ?? 0) >= 3 ? s.ba : ''}`}>
                {(dau?.loi_cam ?? []).map((id) => {
                  const l = LOI_MINIGAME_CHU[id as ChienThuatId];
                  const trangThai = daChon ? (daChon === id ? s.da : s.bo) : '';
                  return (
                    <button key={id} type="button" className={`${s.la} ${trangThai}`} aria-label={l?.ten ?? id} onClick={(e) => chonLa(id, e.currentTarget)}>
                      {/* eslint-disable-next-line react/no-danger -- SVG hằng số trong repo, xem GameCard */}
                      <span className={s.icon} aria-hidden dangerouslySetInnerHTML={htmlTinh(art[id] ?? '')} /><span className={s.ten}>{l?.ten ?? id}</span>
                      <span className={s.mt}>{l?.mt ?? ''}</span><span className={s.day}>{l?.day ?? ''}</span>
                    </button>
                  );
                })}
              </div>
              {!dau?.loi_cam.length && <div className={s.loiKhoa}>Chưa cầm lõi nào · màn này chỉ để xem</div>}
              {dau?.gai && (
                <div className={s.gaiTin} data-khoi="gai-tin">
                  <div className={s.tmT}>GÀI TIN GIẢ? · {fmt(dau.gai.phi)}</div>
                  <div className={s.tmGhi}>Bỏ vốn tung một tin giả vào màn. Đám đông nhảy theo đẩy giá tạm thời rồi tan.</div>
                  <div className={s.tmH}>
                    <button type="button" aria-pressed={gai === 1} disabled={gai !== 0} onClick={() => gaiTin(1)}>▲ TIN TỐT</button>
                    <button type="button" aria-pressed={gai === -1} disabled={gai !== 0} onClick={() => gaiTin(-1)}>▼ TIN XẤU</button>
                  </div>
                </div>
              )}
              {/* D532 — Lướt Sóng: MUA TIN SỚM (demo `veTruocMan`, cùng khung `.truocMan` ⇒ `.gaiTin`). MÙ TIN: không mua được. */}
              {la === 'luot_song' && (dau?.mu_tin || tinMua) && (
                <div className={s.gaiTin} data-khoi="mua-tin">
                  {dau?.mu_tin ? <>
                    <div className={s.tmT}>MÙ TIN</div><div className={s.tmGhi}>Trait này che MỌI tin trong màn — không mua tin sớm được.</div>
                  </> : !tinMua!.da_mua ? <>
                    <div className={s.tmT}>MUA TIN SỚM?</div><div className={s.tmGhi}>Biết trước những TIN THẬT sẽ ra trong màn. Không biết tin nào ra trước.</div>
                    <div className={s.tmH}>
                      <button type="button" className={s.tmChinh} disabled={pha?.loai !== 'chon' || dangMuaTin} onClick={muaTin}>
                        MUA · {fmt(tinMua!.phi)}<small>{(PHI_TIN_SOM_BP / 100).toFixed(0)}% vốn</small>
                      </button>
                    </div>
                  </> : <>
                    <div className={s.tmT}>TIN THẬT SẼ RA · không theo thứ tự</div><DsTinThat ds={tinThat ?? []} />
                  </>}
                </div>
              )}
            </div>
          )}

          {sanKhau === 'mini' && (
            <div className={s.sanKhau}>
              {(dau?.phu?.length ?? 0) > 0 && (
                <div className={s.bangPhu} data-khoi="bang-phu" {...(choDoi ? { 'data-nhieu-ma': '' } : {})}>
                  {/* D490 — mở thì CHỈ lưới (ô có tên + % nhảy) + nút GỌN; chip là dạng THU GỌN (founder: "bấm ẩn đi thì chỉ còn tên, màu và con số"). */}
                  <div className={s.bpHang}>
                    {!moPhu && dau!.phu!.map((ma) => {
                      const t = TAI_SAN.find((a) => a.id === ma);
                      return (
                        <span key={ma} className={s.bpChip} style={{ '--c': MAU_MA[ma] ?? '#93aac8' } as CSSProperties}
                          {...(choDoi ? { role: 'button', tabIndex: 0, 'data-doi-ma': ma, 'aria-label': `Đánh màn trên ${t?.label ?? ma}`, onClick: () => doiMa!(ma),
                            onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doiMa!(ma); } } } : {})}>
                          <i />{t?.label ?? ma} <b ref={(el) => { if (el) soPhu.current.set(ma, el); else soPhu.current.delete(ma); }}>+0,0%</b>
                        </span>
                      );
                    })}
                    <button type="button" className={s.bpMo} aria-expanded={moPhu} onClick={() => setMoPhu((x) => !x)}>{moPhu ? '▴ GỌN' : '▾ BẢNG'}</button>
                  </div>
                  {moPhu && (
                    <div className={`${s.bpLuoi} ${dau!.phu!.length >= 3 ? s.ba : ''}`}>
                      {dau!.phu!.map((ma) => {
                        const t = TAI_SAN.find((a) => a.id === ma);
                        return (
                          <div key={ma} className={`${s.bpO} ${choDoi ? s.bpDoi : ''}`} style={{ '--c': MAU_MA[ma] ?? '#93aac8' } as CSSProperties}
                            {...(choDoi ? { role: 'button', tabIndex: 0, 'data-doi-ma': ma, 'aria-label': `Đánh màn trên ${t?.label ?? ma}`, onClick: () => doiMa!(ma),
                              onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doiMa!(ma); } } } : {})}>
                            <canvas width={154} height={56} ref={(el) => { if (el) cvPhu.current.set(ma, el); else cvPhu.current.delete(ma); }} />
                            <span><IconMa ma={ma} art={art} />{t?.label ?? ma}</span>
                            <b ref={(el) => { if (el) soPhu.current.set(ma, el); else soPhu.current.delete(ma); }}>+0,0%</b>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className={s.mgDau}>
                {la && art[la] && <span className={s.loArt} aria-hidden dangerouslySetInnerHTML={htmlTinh(art[la])} />}
                <span className={s.lo}>{chuLa ? chuLa.ten.toUpperCase() : nut.length ? 'NẮM GIỮ' : 'CHỈ XEM'}</span>
                <span className={s.maTen}>{ts ? <><IconMa ma={ts.id} art={art} />{ts.label}</> : '…'}</span>
                {dau && <span className={s.tk}>THANH KHOẢN {nacTen}</span>}
                <span className={s.von}>vốn <b>{dau ? fmt(dau.von) : '…'}</b>{kyQuy ? (db?.L ? ` ×${db.L}` : '') : nut.length ? ` ×${String(dau?.he ?? HE_SO_LOI).replace('.', ',')}` : ''}</span>
              </div>
              <div ref={doThiEl} className={`${s.doThi} ${biSan ? s.xamMan : ''} ${dau?.ke_trait ? s.coKe : ''}`} data-khoi="do-thi"
                onPointerDown={keDown} onPointerMove={keMove} onPointerUp={keUp} onPointerCancel={keUp}>
                <canvas ref={cv} width={202} height={150} className={s.cv} />
                {/* D493 — CUỘC GỌI KÝ QUỸ: thẻ (demo `.cuocGoi`) rồi icon điện thoại rung ở góc (demo `.dtGoi`). Icon = art pixel, không ký tự ✆. */}
                {dangPhat && (
                  <div key={phatGoi} className={s.cuocGoi} aria-live="assertive" data-khoi="cuoc-goi">
                    <div className={s.goiThe}>
                      <span className={s.goiTieu}>KÝ QUỸ</span><span className={s.goiPhu}>Cuộc gọi đến…</span>
                      <span className={s.goiHai}><i className={s.cup}><PixelIcon name="dien_thoai" size={16} /></i><i className={s.nghe}><PixelIcon name="dien_thoai" size={16} /></i></span>
                    </div>
                  </div>
                )}
                {/* D499 — BÚA PHÁP LÝ (Tổ Chức chạm trần): đập ở góc trái trên rồi thu nhỏ, không che đồ thị (founder: "che mẹ hết nửa cái chart"). */}
                {daTran && (
                  <div className={`${s.bua} ${buaThu ? s.buaThu : s.buaDap}`} aria-live="assertive" data-khoi="bua">
                    <PixelLuoi luoi={LUOI_BACH_KHOA.tb_phap_ly ?? []} ten="tb_phap_ly" size={buaThu ? 32 : 48} className={s.buaHinh} />
                    {!buaThu && <span className={s.buaChu}>TRẦN THUA</span>}
                  </div>
                )}
                {goi && !dangPhat && !daTl && (
                  <button type="button" className={s.dtGoi} aria-label="Đang bị gọi ký quỹ" data-khoi="dt-goi" onClick={() => setPhatGoi((x) => x + 1)}>
                    <PixelIcon name="dien_thoai" size={16} />
                  </button>
                )}
                <span ref={tag} className={s.giaTag}>0,0%</span>
                {/* D528 — nhãn lệnh kê = tay cầm kéo (≥ 30 px, ngón cái); ×L chỉ ở lệnh MỞ ký quỹ; ✕ huỷ phần chưa khớp. Chữ + vị trí đặt trong vòng vẽ. */}
                {(['mua', 'ban'] as const).filter((ben) => dau?.ke_trait?.[ben]).map((ben) => (
                  <div key={ben} ref={(el) => { keNhanEl.current[ben] = el; }} className={`${s.keNhan} ${ben === 'mua' ? s.kMua : s.kBan}`} style={{ display: 'none' }}
                    data-khoi={`ke-nhan-${ben}`} onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('button')) batDauKeo(ben, e); }}>
                    <span className={s.keT}><span data-ke="t" /><i aria-hidden>↕</i></span>
                    <button type="button" className={s.keL} aria-label="Đổi đòn bẩy của lệnh" onClick={() => doiKeL(ben)}>×{keLHien[ben]}</button>
                    {/* D539 — NHÁP: ✓ ĐẶT gửi lệnh thật · ✕ bỏ nháp. Lệnh thật đang chờ: ✕ huỷ như cũ. */}
                    {keNhapHien[ben] !== null && !songKe(ben) && (
                      <button type="button" className={s.keDat} aria-label="Đặt lệnh" data-khoi={`ke-dat-${ben}`} disabled={!keDuocBam()} onClick={() => datThat(ben)}>✓ ĐẶT</button>
                    )}
                    {keNhapHien[ben] !== null && !songKe(ben) && <button type="button" className={s.keX} aria-label="Bỏ nháp" onClick={() => datNhap(ben, null)}>✕</button>}
                    {songKe(ben) && <button type="button" className={s.keX} aria-label="Huỷ lệnh" onClick={() => guiKe(ben, null)}>✕</button>}
                  </div>
                ))}
                {tlyBao && <div className={s.tlyBao} aria-live="assertive" data-khoi="tam-ly-yeu">TÂM LÝ YẾU · BÁN THÁO 60%</div>}
                {/* D534 — demo `#bung` · `#nhanLon` (icon pixel thay emoji 🔥/💥 — founder: emoji của demo không vào app). */}
                {(la === 'bat_day' || la === 'mua_duoi') && (
                  <span className={`${s.bung} ${bung ? s.bungOn : ''}`} aria-hidden={!bung} data-khoi="bung"><PixelIcon name="flame" size={16} />{bung ?? ''}</span>
                )}
                {nhanLon && <span className={s.nhanLon} data-khoi="nhan-lon">{nhanLon === 'BÁN CƯỠNG BỨC' && <PixelIcon name="bolt" size={16} />}{nhanLon}</span>}
                {/* D528 — KÍNH LÚP ở góc dưới trái: thu ra 25 % → 50 % → 100 % → về gốc. */}
                <button type="button" className={s.kinhLup} data-khoi="kinh-lup" aria-label={`Thu phóng đồ thị${thuPhong ? ` · đang thu ra ${(THU_PHONG[thuPhong]! - 1) * 100}%` : ''}`}
                  onClick={() => { const n = (thuPhongRef.current + 1) % THU_PHONG.length; thuPhongRef.current = n; setThuPhong(n); }}>
                  <PixelIcon name="analyze" size={16} />{thuPhong > 0 && <b>{Math.round((THU_PHONG[thuPhong]! - 1) * 100)}%</b>}
                </button>
                <div ref={soiNhan} className={s.soiNhan} aria-hidden data-khoi="soi" />
                {/* D532 — lớp ghim tin (bấm ghim = đọc lại) + chồng bong bóng — phần tử con dựng trong vòng vẽ. */}
                <div ref={tinLop} className={s.tinLop} data-khoi="tin-lop" onClick={bamGhim} />
                <div ref={chongEl} className={s.chong} aria-live="polite" data-khoi="chong-tin" />
                {trangNay && <span className={s.nhanDo}>{trangNay === 'mua' ? 'TRẮNG BÊN MUA' : 'TRẮNG BÊN BÁN'}</span>}
                {pha?.loai === 'dem' && <div className={s.demNguoc}>{pha.giay}</div>}
                {/* D532 — đã mua tin sớm: danh sách tin thật che đồ thị suốt lúc đếm ngược (demo `#tinThatRa`). */}
                {pha?.loai === 'dem' && tinMua?.da_mua && (
                  <div className={s.tinThatRa} data-khoi="tin-that-ra">
                    <div className={s.ttrT}>TIN THẬT SẼ RA · không theo thứ tự · vào sau {pha.giay}</div><DsTinThat ds={tinThat ?? []} />
                  </div>
                )}
                {pha?.loai === 'het' && <div className={s.truocMan}><span className={s.truocTen}>HẾT MÀN</span></div>}
              </div>
              {/* D500 — BÀN NGHIÊN CỨU (demo bản 34 `veNghienCuu`): dưới chân đồ thị, cột lịch sử để trống, mỗi khúc thời gian ▼ % tạo đáy (đỏ) ·
                  ▲ % tạo đỉnh (xanh). Xác suất của mô hình — không toạ độ giá (founder 04/10). */}
              {dau?.nghien_cuu && (
                <div className={s.ncDai} data-khoi="nghien-cuu"
                  style={{ gridTemplateColumns: `${NEN_LS}fr repeat(${dau.nghien_cuu.day.length}, ${(dau.trait_man?.han_s === undefined ? 30 : 60) / dau.nghien_cuu.day.length}fr)` }}>
                  <span className={s.ncNhan}>XÁC SUẤT</span>
                  {dau.nghien_cuu.day.map((d0, i) => {
                    const p0 = dau.nghien_cuu!.dinh[i] ?? 0, chu = (x: number) => (x >= 0.05 ? `${Math.round(x * 100)}%` : '·');
                    return (
                      <span key={i} className={s.ncO}>
                        <b className={s.ncD} style={{ opacity: 0.35 + 0.65 * Math.min(1, d0 * 2.5) }}>▼{chu(d0)}</b>
                        <b className={s.ncP} style={{ opacity: 0.35 + 0.65 * Math.min(1, p0 * 2.5) }}>▲{chu(p0)}</b>
                      </span>
                    );
                  })}
                  {/* D520 — chú thích cho người mới (demo bản 43 `.ncNhan`): server tính bằng mô hình CHỈ BIẾT THẺ, ô kẹp 70 %. */}
                  <span className={s.ncChu} data-khoi="nc-chu">▼ ĐÁY · ▲ ĐỈNH hay rơi vào khúc này · mô hình chỉ biết thẻ</span>
                </div>
              )}
              {/*
                * D503 (founder 04/10: "đã sửa cái lỗi Bán hết rồi các loại tài sản hiện ra che mất nửa chart đâu" → "cho phép che phần này khi bị call margin,
                * đổi thành chỗ để bán tài sản … phải rướn tay lên trên để bán thì bất tiện"; demo bản 36 `.oDuoi`) — DẢI DƯỚI ĐỒ THỊ cao CỐ ĐỊNH: thường = dòng
                * tạm tính; bị gọi / mở NẠP = thêm HÀNG NÚT BÁN TÀI SẢN sát ngón cái (số bán + phí do server trả — C4). Không khối nào mọc thêm ⇒ bàn không xô.
                */}
              <div className={s.oDuoi} data-khoi="o-duoi">
                <div className={s.tamTinh}>{tamTinh}</div>
                {/* D528 — KÊ MUA / KÊ BÁN ở dải dưới đồ thị (founder: "khó dùng thao tác" khi nút đè lên đồ thị). Bật = đang có lệnh chờ; chạm lại là huỷ. */}
                {dau?.ke_trait && (
                  <div className={s.keHang} data-khoi="ke-hang">
                    {(['mua', 'ban'] as const).filter((ben) => dau.ke_trait![ben]).map((ben) => (
                      <button key={ben} type="button" className={ben === 'mua' ? s.keNutMua : s.keNutBan} aria-pressed={songKe(ben) || keNhapHien[ben] !== null}
                        disabled={!keDuocBam()} onClick={() => datKeSan(ben)}>KÊ {ben === 'mua' ? 'MUA' : 'BÁN'}</button>
                    ))}
                  </div>
                )}
                {oNap && (
                  <div className={s.napHang} data-khoi="nap-hang">
                    {oNap.map((x) => (
                      <button key={x.ma} type="button" data-khoi="nut-nap" disabled={x.lay <= 0 || pha?.loai !== 'chay'} onClick={(e) => { phutHat(tamPhanTu(e.currentTarget), 'var(--lose)', 10); bam(`nap_${x.ma}`); }}>
                        <span><IconMa ma={x.ma} art={art} />{x.ten}</span><b>−{fmt(x.lay)}{x.phi ? ` · ${fmt(x.phi)}` : ''}</b>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {loi && <p className={s.loi}>Mất kết nối màn ({loi}).</p>}
              {oNut.length > 0 && (
                <div data-khoi="hang-nut" className={`${s.nut3} ${oNut.length === 2 ? s.hai : ''} ${daChotXong ? s.xamMan : ''} ${doiPhim ? s.doiPhim : ''}`}>
                  {oNut.map((c, i) => {
                    // D499 — Tổ Chức KHỚP THỎA THUẬN: nến trắng không khoá, chỉ nói trượt nặng hơn.
                    const trangDung = c.duoc && ((c.can === -1 && trangNay === 'mua') || (c.can === 1 && trangNay === 'ban'));
                    const khoa = trangDung && !toChuc, thoa = trangDung && toChuc;
                    return (
                      <button key={c.id || `o${i}`} type="button" disabled={pha?.loai !== 'chay' || !c.duoc || !!khoaTr || (daTl && kyQuy) || daTran}
                        className={`${s.nut} ${khoa ? s.do : s[c.mau]} ${lun === c.id ? s.lun : ''} ${hut === c.id ? s.hut : ''}`} onClick={(e) => {
                          if (performance.now() < khoaPhimDen.current) return;
                          // D534 — demo `bamNut`: nến trắng chặn chiều này ⇒ nút RUNG tại chỗ (bấm hụt); khớp được ⇒ hạt pixel tung từ nút (nút mạnh: vàng, nhiều hạt).
                          if (khoa) { setHut(c.id); setTimeout(() => setHut(null), 140); }
                          else phutHat(tamPhanTu(e.currentTarget), c.rung ? 'var(--gold)' : c.can === -1 ? 'var(--accent)' : 'var(--win)', c.rung ? 18 : 10);
                          if (c.bam) c.bam(); else bam(c.id);
                        }}>
                        {khoa ? (c.can === -1 ? 'TRẮNG BÊN MUA' : 'TRẮNG BÊN BÁN') : c.chu}
                        {/* D486 — demo `capNhatNut`: nút bị trait khoá nói vì sao, ngay trên nút. */}
                        <small>{khoaTr ? (khoaTr.ly === 'kien_nhan' ? `🧘 mở sau ${khoaTr.con}s` : '⚡ hết giờ bấm')
                          : khoa ? 'không khớp được' : thoa ? 'thỏa thuận · trượt ×1,5' : c.phu}</small>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {sanKhau === 'kq' && kq && (
            <div className={`${s.sanKhau} ${s.skKq}`}>
              <div className={s.kq}>
                <div className={s.nhan}>{kq.nut.length ? `NHỜ LÕI · ${(LOI_MINIGAME_CHU[kq.la as ChienThuatId]?.ten ?? '').toUpperCase()} · ${kq.nhieu?.length ? `TRÊN ${kq.nhieu.length + 1} KHOẢN` : `TRÊN KHOẢN ${(ts?.label ?? kq.ma).toUpperCase()}`}` : 'LÕI CHỈ XEM VÒNG NÀY'}</div>
                {/* D479 — số lớn = khoản chạy theo đường (theo lệnh; không bấm = giữ suốt), như `G.kq.tien` của demo bản 27. */}
                {/* D485 — số lớn = khoản theo đường ĐÃ trừ phí gài (demo `G.kq.tien` = `tongLoi`); trước đây in số chưa trừ phí ⇒ lệch dòng quyết toán. */}
                <div ref={soKq} data-khoi="so-kq" className={`${s.so} ${soLonKq(kq) > 0 ? s.lai : soLonKq(kq) < 0 ? s.lo : s.khong}`}>{fmtDau(soLonKq(kq))}</div>
                {kq.tu_dong && <span className={s.tu}>KHÔNG BẤM · GIỮ SUỐT MÀN</span>}
                {!moViSao && <div className={s.mo}>{moTaKq(kq)}</div>}
                {/* D485 — VÌ SAO (demo bản 29 `veViSao`): THỊ TRƯỜNG · ĐƯỜNG ĐI · CỦA BẠN. Chỉ tả, không khuyên (A10). */}
                <details className={s.viSao} data-khoi="vi-sao" open={moViSao}
                  onToggle={(e) => setMoViSao((e.currentTarget as HTMLDetailsElement).open)}>
                  <summary>{moViSao ? 'QUYẾT TOÁN ▴' : 'VÌ SAO ▾'}</summary>
                  <ViSao kq={kq} ten={ts?.label ?? kq.ma} the={theMoi?.ten} art={art} />
                </details>
                {/* Bỏ khỏi cây khi VÌ SAO mở — KHÔNG dùng `hidden`: `.qt { display: flex }` của module đè thuộc tính, bảng vẫn hiện, bàn tràn. */}
                {!moViSao && <div className={s.qt}>
                  <div><span><IconMa ma={kq.ma} art={art} />{ts?.label ?? kq.ma} · {kq.tu_dong || !kq.nut.length ? 'giữ suốt màn' : 'theo lệnh lõi'}</span><span className={kq.theo_lenh - phiGai >= 0 ? s.lai : s.lo}>{fmtDau(kq.theo_lenh - phiGai)}</span></div>
                  <div className={s.phuQt}><span>khoản {ts?.label ?? kq.ma}</span><span>{fmt(kq.von)} → {fmt(Math.max(0, kq.von + (kq.db?.nap_nhan ?? 0) + kq.theo_lenh - phiGai))}</span></div>
                  {/* D492 — mỗi cú nạp: khoản nguồn bị bán (trừ ở dòng mã đó), phí bán mất; phần nhận vào ký quỹ (đã gồm ở khoản trên). */}
                  {(kq.db?.nap ?? []).map((n, i) => (
                    // D507 — BÁN HẾT bán trọn khoản (vòng sau 0 chip) · Tiền mặt nạp không phí.
                    <div key={i} className={s.phuQt} data-khoi="nap-qt"><span>{n.luc === 'ban_het' ? 'BÁN HẾT' : 'nạp ký quỹ'} · {n.ma === 'tien' ? 'Tiền mặt' : `bán ${tenKhoan(n.ma)}`}{n.phi ? ` (phí ${fmt(n.phi)})` : ''}</span><span className={s.lo}>−{fmt(n.lay)}</span></div>
                  ))}
                  {(kq.phi_gai ?? 0) > 0 && <div className={s.phuQt} data-khoi="phi-gai"><span>trong đó phí gài tin giả</span><span>−{fmt(kq.phi_gai!)}</span></div>}
                  {/* D531/D532 — demo `veQuyetToan`: Lướt Sóng có dòng phí giao dịch (+ phí mua tin sớm ở khoá có tin). */}
                  {kq.la === 'luot_song' && (kq.ls || kq.phi_tin) && (() => {
                    const coTin = kq.nhan.includes('mua_tin_som') || kq.nhan.includes('khong_mua_tin_som');
                    return <div className={s.phuQt} data-khoi="phi-ls"><span>trong đó phí giao dịch{coTin ? ' · phí mua tin sớm' : ''}</span>
                      <span>−{fmt(kq.ls?.phi ?? 0)}{coTin ? ` · −${fmt(kq.phi_tin ?? 0)}` : ''}</span></div>;
                  })()}
                  {/* D561 — khoá nhiều mã: mỗi màn con một dòng (theo lệnh / giữ suốt) — cùng khuôn dòng mã chính. */}
                  {(kq.nhieu ?? []).map((x) => {
                    const t = TAI_SAN.find((a) => a.id === x.ma);
                    return <div key={x.ma} data-khoi="qt-nhieu"><span><IconMa ma={x.ma} art={art} />{t?.label ?? x.ma} · {x.tu_dong || !kq.nut.length ? 'giữ suốt màn' : 'theo lệnh lõi'}</span><span className={x.theo_lenh >= 0 ? s.lai : s.lo}>{fmtDau(x.theo_lenh)}</span></div>;
                  })}
                  {kq.ma_khac.map((x) => {
                    const t = TAI_SAN.find((a) => a.id === x.ma), l = x.von_sau - x.von_truoc;
                    return <div key={x.ma}><span><IconMa ma={x.ma} art={art} />{t?.label ?? x.ma} · giữ suốt màn</span><span className={l >= 0 ? s.lai : s.lo}>{fmtDau(l)}</span></div>;
                  })}
                  {kq.nav_truoc !== null && kq.nav_sau !== null && (
                    <div className={s.tong}><span>NAV</span><span>{fmt(kq.nav_truoc)} → {fmt(kq.nav_sau)}</span></div>
                  )}
                </div>}
                <button type="button" className={s.nutKe} onClick={dong}>VÒNG KẾ ▶</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** D561 — số lớn của màn KẾT QUẢ: khoản theo đường của mã chính (trừ phí gài · mua tin) + mọi màn con (khoá nhiều mã). */
function soLonKq(kq: KetQuaManDTO): number {
  return kq.theo_lenh - (kq.phi_gai ?? 0) - (kq.phi_tin ?? 0) + (kq.nhieu ?? []).reduce((a, x) => a + x.theo_lenh, 0);
}

/** Câu mô tả kết quả (demo `moKetQua` bản 27) — phần trăm GIÁ so với giá mở màn, số do server trả. */
/** D485 — nội dung VÌ SAO (chép `veViSao` của demo bản 29). Số đều từ server (`/ket-qua`); client chỉ trừ/chia để in (C4). */
function ViSao({ kq, ten, the, art }: { kq: KetQuaManDTO; ten: string; the?: string; art: Readonly<Record<string, string>> }) {
  const g0 = kq.gia_dau, cuoi = kq.gia_cuoi / g0 - 1, tien = kq.theo_lenh - (kq.phi_gai ?? 0) - (kq.phi_tin ?? 0);
  const lop = (x: number) => (x >= 0 ? s.lai : s.lo);
  const nhan = kq.nhan.map((x) => NHAN_MAN[x]).filter(Boolean).join(' · ');
  return (
    <div className={s.vsND}>
      <div className={s.vsMuc}>THỊ TRƯỜNG<span>{the ?? ''}</span></div>
      <div className={s.vsDong}><span><IconMa ma={kq.ma} art={art} />{ten}</span><span className={lop(cuoi)}>{pct(cuoi)}</span></div>
      {kq.ma_khac.map((x) => {
        const t = TAI_SAN.find((a) => a.id === x.ma);
        return <div key={x.ma} className={s.vsDong}><span><IconMa ma={x.ma} art={art} />{t?.label ?? x.ma}</span><span className={lop(x.bp)}>{pct(x.bp / 10000)}</span></div>;
      })}
      <div className={s.vsGhi}>giữ suốt màn thì khoản đi đúng chừng này — đã vào NAV, bấm hay không</div>
      <div className={s.vsMuc}>ĐƯỜNG ĐI<span>{ten}</span></div>
      <div className={s.vsDong}><span>đáy · đỉnh · cuối</span><span>{pct(kq.day / g0 - 1)} · {pct(kq.dinh / g0 - 1)} · {pct(cuoi)}</span></div>
      <div className={s.vsGhi}>thẻ nặn đường đi; điểm cuối là của thị trường</div>
      {/* D494 — demo `veViSao`: dây chuyền bán cưỡng bức của đám đông đòn bẩy cùng mã. */}
      {(kq.tl?.length ?? 0) > 0 && (
        <div className={s.vsDong} data-khoi="vs-day-chuyen"><span>bán cưỡng bức</span>
          <span className={s.lo}>{kq.tl!.length} vị thế · {kq.tl!.map((e) => `${e.ai === 'ca_map' ? 'cá mập' : 'đám đông'} ×${e.L}`).join(' → ')}</span></div>
      )}
      <div className={s.vsMuc}>CỦA BẠN<span>{nhan}</span></div>
      {kq.tu_dong
        ? <div className={s.vsDong}><span>không bấm · giữ suốt</span><span>{fmtDau(tien)}</span></div>
        : kq.db?.nap_nhan ? <div className={s.vsDong}><span>theo lệnh − giữ suốt + nạp nhận</span><span className={lop(kq.loi)}>{fmtDau(tien)} − {fmtDau(kq.giu)} + {fmt(kq.db.nap_nhan)} = {fmtDau(kq.loi)}</span></div>
          : <div className={s.vsDong}><span>theo lệnh − giữ suốt</span><span className={lop(kq.loi)}>{fmtDau(tien)} − {fmtDau(kq.giu)} = {fmtDau(kq.loi)}</span></div>}
      {(kq.phi_gai ?? 0) > 0 && <div className={s.vsGhi}>gồm phí gài tin giả −{fmt(kq.phi_gai!)}</div>}
      {(kq.phi_tin ?? 0) > 0 && <div className={s.vsGhi}>gồm phí mua tin sớm −{fmt(kq.phi_tin!)}</div>}
    </div>
  );
}

function moTaKq(kq: KetQuaManDTO): string {
  const g0 = kq.gia_dau, tVao = kq.vao.reduce((a, x) => a + x.tien, 0), tRa = kq.ra.reduce((a, x) => a + x.tien, 0);
  // D528 — chưa vào gì nhưng KHOẢN GIỮ đã bị bán (trần thua · Tâm lý yếu · kê bán khoản)
  const banGiu = kq.ra.filter((x) => x.giu && !x.tu_dong_cuoi);
  if (!kq.vao.length && banGiu.length) {
    const x = banGiu[0]!, o = `ở ${pct(x.ra / g0 - 1)}`;
    const dau0 = x.ly_do === 'tran_thua' ? `Không bấm · trần thua chốt cả khoản ${o}` : x.ly_do === 'tam_ly_yeu' ? `Tâm lý yếu bán tháo 60% khoản ${o}` : `Kê bán khoản ${o}`;
    return `${dau0} · giữ suốt sẽ là ${pct(kq.gia_cuoi / g0 - 1)}`;
  }
  if (kq.tu_dong || !kq.vao.length) return `Không bấm: giữ suốt màn · giá cuối ${pct(kq.gia_cuoi / g0 - 1)}`;
  const vao = tVao ? kq.vao.reduce((a, x) => a + x.khop * x.tien, 0) / tVao : g0;
  const ra = tRa ? kq.ra.reduce((a, x) => a + x.ra * x.tien, 0) / tRa : g0;
  let mo = `Bạn vào ở ${pct(vao / g0 - 1)} · ra ở ${pct(ra / g0 - 1)} · giữ suốt sẽ là ${pct(kq.gia_cuoi / g0 - 1)}`;
  if (kq.la === 'bat_day') mo += ` · đáy dải ${pct(kq.day / g0 - 1)}`;
  // D492 — demo `moKetQua` nhánh don_bay.
  if (kq.db) {
    mo = `Đòn bẩy ×${kq.db.L0}${kq.db.tang.length ? ` → ×${kq.db.L}` : ''} · ${kq.db.thanh_ly ? (kq.db.thanh_ly.ban_het ? 'bán hết khi bị gọi' : 'bị sàn thanh lý') : 'tự đóng'}`
      + (kq.db.nap.length ? ` · nạp thêm ${kq.db.nap.length} lần (${fmt(kq.db.nap_nhan)})` : '') + ` · giữ suốt sẽ là ${pct(kq.gia_cuoi / g0 - 1)}`;
  }
  // D531 — demo `moKetQua` nhánh luot_song: số lần ĐẢO + phí giao dịch thay câu vào/ra.
  // D532 — khoá có tin: thêm vế mua / không mua tin sớm (demo: `mua tin sớm (phí)` / `không mua tin sớm`).
  const veTin = kq.nhan.includes('mua_tin_som') ? ` · mua tin sớm (${fmt(kq.phi_tin ?? 0)})` : kq.nhan.includes('khong_mua_tin_som') ? ' · không mua tin sớm' : '';
  if (kq.la === 'luot_song' && (kq.ls || veTin)) mo = `Đảo ${kq.ls?.so_dao ?? 0} lần · phí giao dịch ${fmt(kq.ls?.phi ?? 0)}${veTin} · giữ suốt sẽ là ${pct(kq.gia_cuoi / g0 - 1)}`;
  if (kq.hut.length) mo += ` · ${kq.hut.length} lần bấm không khớp`;
  if (kq.cham_tran) mo += ' · chạm trần lỗ';
  return mo;
}

/**
 * Icon PIXEL của một mã — ART CÓ SẴN của app (`art[mã]` từ `/holdem/art`, cùng bộ màn trận dùng). Founder 04/10: emoji của demo không vào app;
 * art chưa tải ⇒ không vẽ gì (chữ tên mã vẫn đứng cạnh), KHÔNG rơi về emoji `TAI_SAN.icon`.
 */
/** D507 — tên khoản nguồn nạp: Tiền mặt (`tien`) không có trong `TAI_SAN`. */
function tenKhoan(ma: string): string {
  return ma === 'tien' ? 'Tiền mặt' : TAI_SAN.find((a) => a.id === ma)?.label ?? ma;
}

function IconMa({ ma, art }: { ma: string; art: Readonly<Record<string, string>> }) {
  // D507 — Tiền mặt dùng lại icon pixel ví (founder: "cái nào có rồi thì dùng lại").
  if (ma === 'tien') return <i className={s.icTien} aria-hidden data-icon="wallet"><PixelIcon name="wallet" size={16} /></i>;
  const svg = art[ma];
  if (!svg) return null;
  // eslint-disable-next-line react/no-danger -- SVG hằng số trong repo, xem GameCard
  // <i>, không <span>: ô bảng phụ / quyết toán có luật `span` (định vị tuyệt đối · `span:last-child` đẩy phải) — icon lồng trong span sẽ bị kéo theo.
  return <i className={s.icMa} aria-hidden dangerouslySetInnerHTML={htmlTinh(svg)} />;
}

/** Mặt ô thẻ trên nỉ — art của lá + tên, viền màu họ (cùng nguồn với bản đồ: `art[khoá]` · `matLa` · `HO_MAU`). */
function MatO({ the }: { the: MatThe | undefined }) {
  return (
    <div className={s.mat} style={the?.mau ? { borderColor: the.mau } : undefined}>
      {/* eslint-disable-next-line react/no-danger -- SVG hằng số trong repo, xem GameCard */}
      {the && <span className={s.matArt} aria-hidden dangerouslySetInnerHTML={htmlTinh(the.svg)} />}
      {the && <span className={s.matTen}>{the.ten}</span>}
    </div>
  );
}
