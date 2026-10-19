/**
 * BÀN ĐẤU ALPHA DRAFT.
 *
 * TRÌNH TỰ MỘT VÒNG — thứ tự này là bắt buộc, đừng đảo:
 *   nộp → KHOẢNH KHẮC LỚN (ALL IN / ×2) → dây chuyền chấm điểm → lật ô mới
 * Khoảnh khắc phải diễn XONG rồi mới tới dây chuyền: hai lớp hoạt hình đè lên
 * nhau thì người chơi không đọc kịp cái nào, và mất luôn cảm giác "cả bàn vừa
 * chứng kiến một chuyện".
 *
 * D25/R1 — `R1-logged ⊆ UI-luôn-hiện`: dải đối thủ (tên · BẬC rank · vốn ·
 * nhãn máy) render VÔ ĐIỀU KIỆN. Không accordion, không tab, không dưới màn
 * cuộn. Server ghi log đúng mảng nó gửi ra; UI giấu là log thành sai sự thật,
 * mà `events` append-only nên hỏng vĩnh viễn.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { heSoVuaKhung } from '@/lib/vua_khung';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthGate } from '@/components/AuthGate';
import { api, ApiError } from '@/api/client';
import { choThuLaiMs, suCoKeTu } from '@/api/mang';
import { PixelIcon } from '@/components/ui';
import { useDemNguocVong, useReducedMotion, useSoChay } from '@/lib/hooks';
import { daToiBuoc, KHOAN_NOI_TOI_DA, lichKetQua, mocKhoanNoiVao, NHIP, type BuocKetQua } from '@/lib/nhip';
import { khoanLaiLo, khoanNoiCuaVong } from '@/lib/khoan_lai_lo';
import { gheNopCuaVong, KHOAN_TU_GIAI, type GheNop } from '@/lib/giai_vong';
import { dangKyKhiRoi, ghiDo } from '@/lib/telemetry';
import {
  ROUTE_ARENA, T_DON_HET_UPPER,
} from '@/lib/vocab';
import {
  MOC_CONG_BO,
  dinhDangChip, khoanhKhacHang, timKhoanhKhac, useAutopsy, useCanhBaoXungDot,
  useHoldemArt, vuaChamMocCongBo,
  useHoldemCatalog, useKhaoSatLai, useNopVong, useTrangThai,
  useCuonTrait, type ChoTraitDTO,
  type CanhBaoDTO, type HanhDongCuoc, type KetQuaGheDTO, type KhoanhKhac,
  type NopVongInput,
  type TrangThaiDTO,
} from '@/api/holdem';
import { BangDienTu, phiNiemYet } from '@/components/holdem/BangDienTu';
import { BieuDoTaiSan } from '@/components/holdem/BieuDoTaiSan';
import { themLenhMoc } from '@/lib/lenh_moc';
import { QuanTriVon, type LenhDao } from '@/components/holdem/QuanTriVon';
import { NganHang, type LenhMoTietKiem } from '@/components/holdem/NganHang';
import { DoiThuStrip } from '@/components/holdem/DoiThuStrip';
import { GheAvatarKet } from '@/components/holdem/BotAvatar';
import { ShopManHinh } from '@/components/holdem/ShopManHinh';
import { SuKienBanner } from '@/components/holdem/SuKienBanner';
import { SheetBoBai, XacNhanThoat } from '@/components/holdem/HopXacNhan';
import { ChuongHoi } from '@/components/holdem/ChuongHoi';
import { ChaoVai } from '@/components/holdem/ChaoVai';
import { KyNgoChip, KyNgoPhu, KyNgoThanh } from '@/components/holdem/KyNgo';
import { chuongHoi } from '@/lib/chuong_hoi';
import { MarketMap, mauCuaO, TC_ICON, TC_TEN } from '@/components/holdem/MarketMap';
import { DaiThiTruong } from '@/components/holdem/DaiThiTruong';
import { SoLienHe } from '@/components/SoLienHe';
import { useSoTay } from '@/api/tinh_cach';
import { danhDauQuaManTap } from '@/lib/man_tap_dau';
import { ChainReveal } from '@/components/holdem/ChainReveal';
import { ChoTrait, NutCuonTrait } from '@/components/holdem/ChoTrait';
import { ChotLoi, type LenhChotLoi } from '@/components/holdem/ChotLoi';
import { KhayTrait } from '@/components/holdem/KhayTrait';
import type { NacLua } from '@/components/holdem/LuaMomentum';
import { tongDiemChon } from '@/lib/trait_chu';
import { nhanVi, viConLai, viDoiBai } from '@/lib/vi_xu';
import { apQuayDoi, choHoiLai, mocHetMan, nenThuLaiMoMan, type QuayDoi } from '@/lib/cho_man';
import { loaiVong } from '@/components/holdem/LangKinh';
import { SoNhipVong } from '@/components/holdem/SoNhipVong';
import { KhoanNoi } from '@/components/holdem/KhoanNoi';
import { GiaiVong, type GheNhanGiai, type PhaGiai } from '@/components/holdem/GiaiVong';
import { HangMaCam, TayBai, type MaCam } from '@/components/holdem/TayBai';
import { ThanhPhongCach, thanhPhongCachCua } from '@/components/holdem/ThanhPhongCach';
import { chuLoiLenh } from '@/lib/loi_lenh';
import { tienMatSauLenhDangXep, tuyChonLenhChoShop } from '@/lib/xemTruocLenh';
import { useBan } from '@/api/holdem';
import { ManKet } from './ManKet';
import { MomentOverlay, NhayDo } from '@/components/holdem/MomentOverlay';
import {
  DongHoVong, NGUONG_GAP_S, NGUONG_KHAN_S, VienGapGio, phaVong,
} from '@/components/holdem/DongHoVong';
import { CoachTap } from '@/components/holdem/CoachTap';
import s from './AlphaDraftMatch.module.css';
import { ManMinigame } from '@/components/holdem/ManMinigame';
import { moMan } from '@/api/minigame';
import { KhungMinigameCtx, LOI_MINIGAME_CHU } from '@/lib/khung_minigame';
import { HO_MAU, matLa } from '@/lib/la_bai';
import type { ChienThuatId } from '@config/holdem';
import { moiTruongCua } from '@/lib/moi_truong';

/** Màu chủ đạo + quầng sáng từng thẻ — khớp bảng màu ảnh tham chiếu. */
const MAU: Record<string, readonly [string, string]> = {
  btc: ['#f7931a', 'rgba(247,147,26,.22)'],
  cp_cn: ['#38bdf8', 'rgba(56,189,248,.2)'],
  vn30: ['#ef4444', 'rgba(239,68,68,.2)'],
  vang: ['#fbbf24', 'rgba(251,191,36,.22)'],
  usd: ['#4ade80', 'rgba(74,222,128,.2)'],
  tpcp: ['#a78bfa', 'rgba(167,139,250,.2)'],
  chan_lo: ['#ef4444', 'rgba(239,68,68,.2)'],
  don_bay: ['#a855f7', 'rgba(168,85,247,.24)'],
};
const MAU_TS = ['#fbbf24', 'rgba(251,191,36,.2)'] as const;
const MAU_CT = ['#8b5cf6', 'rgba(139,92,246,.2)'] as const;

/** Nhãn môi trường tiền tệ — dời từ MarketMap sang cùng chip LX (08/08). */
const NHAN_MT: Record<string, string> = {
  re: 'TIỀN RẺ', trung_tinh: 'TRUNG TÍNH', dat: 'TIỀN ĐẮT',
};
const mau = (id: string, laTS: boolean) => MAU[id] ?? (laTS ? MAU_TS : MAU_CT);

const EN: Record<string, string> = {
  btc: 'BITCOIN', cp_cn: 'TECH STOCKS', vn30: 'BLUE CHIPS', vang: 'GOLD',
  usd: 'STABLECOIN', tpcp: 'GOV BONDS',
  mua_duoi: 'FOMO', luot_song: 'TREND FOLLOWING', bat_day: 'MEAN REVERSION',
  chan_lo: 'STOP-LOSS', phong_ho: 'HEDGE', don_bay: 'LEVERAGE', ban_khong: 'SHORT',
  khop_nhanh: 'LOW LATENCY', chia_lenh: 'ORDER SPLIT', da_dang_hoa: 'DIVERSIFY',
};

export function AlphaDraftMatch() {
  return (
    <AuthGate>
      <MatchInner />
    </AuthGate>
  );
}

function MatchInner() {
  const navigate = useNavigate();
  const itMotion = useReducedMotion();
  const cat = useHoldemCatalog();
  /*
   * Art đi theo `engine_version` của catalog — xem docstring `useHoldemArt`.
   * Không truyền version thì hook tự nằm im (`enabled:false`), nên art không bao
   * giờ bị tải bằng một URL không có phiên bản rồi kẹt trong cache `immutable`.
   */
  const artQ = useHoldemArt(cat.data?.engine_version);

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * MÀN NÀY CHỈ ĐỌC TRẬN, KHÔNG TẠO TRẬN (đổi 25/07/2026).
   *
   * Bản cũ tự gọi `POST /matches` trong `useEffect` rồi giữ id trong state.
   * Hai lỗi thật, cùng một gốc "trận không có địa chỉ":
   *   1. TẢI LẠI TRANG GIỮA TRẬN = TẠO TRẬN MỚI. Người chơi mất sạch trận đang
   *      chơi chỉ vì bấm F5 hoặc bị OS gọi ra rồi quay lại. Nút Back cũng vậy.
   *   2. Màn ĐỨNG SKELETON VĨNH VIỄN: react-query bỏ callback truyền theo lệnh
   *      `mutate` khi observer bị dọn, mà StrictMode dev chạy effect → cleanup →
   *      effect và lần hai bị ref chặn. POST trả 201 năm lần, màn treo im, không
   *      một dòng log. Đổi sang `mutateAsync` vá được lỗi 2 nhưng lỗi 1 còn đó,
   *      và cả hai chỉ chết hẳn khi trận CÓ ĐỊA CHỈ.
   *
   * Nay: sảnh tạo trận → điều hướng `/arena/tran/:matchId` → màn này GET theo
   * id. Cùng lối loop cũ `/dau-truong/tran/:matchId` vốn chưa bao giờ có lỗi này.
   */
  const { matchId = null } = useParams<{ matchId: string }>();
  /*
   * MÀN TẬP (founder 02/08) — cờ `?tap=1` ở URL: trợ lý CoachTap dẫn từng
   * bước. Sống ở URL chứ không ở state để F5 giữa bàn tập vẫn còn trợ lý.
   * Cờ này thuần trình bày — engine/server không đọc.
   */
  const [thamSo] = useSearchParams();
  const laManTap = thamSo.get('tap') === '1';
  const tt = useTrangThai(matchId);

  /** Trạng thái CỤC BỘ (cập nhật sau mỗi vòng); chưa có thì lấy bản server GET về. */
  const [stCuc, setSt] = useState<TrangThaiDTO | null>(null);
  const st = stCuc ?? tt.data ?? null;

  /*
   * MÀN MINIGAME (khoá v57 — cờ `dong_ho_minigame`). D473 (founder 04/10: *"Màn tự mở sau chốt vòng đúng timeline để đồng bộ thời gian giữa mọi
   * người"*): vòng v chốt ⇒ trạng thái sang vòng v + 1 ⇒ TỰ MỞ màn vòng v (v ≥ 2). Giờ màn do server neo vào lúc chốt (lật thẻ + chọn lá rồi
   * đếm), hạn vòng v + 1 đã cộng sẵn phần màn — mở trễ (tải lại) là vào GIỮA màn như mọi người; màn đã hết thì không mở.
   * ⚠ D533 — BỎ nút "▶ MÀN VÒNG v" (founder 06/10: *"Đã bảo là bỏ cái nút 'Màn vòng 1' đi mà. Mini game tự động mở"*): nút chỉ còn hiện SAU khi
   * lớp màn tự đóng ở quyết toán, trên một bàn đang kẹt. Rớt mạng lúc mở ⇒ tự thử lại; lỗi nghiệp vụ (không cầm mã, vòng đã qua) ⇒ thôi, bàn hiện
   * dòng chờ màn và tự đồng bộ khi màn của bàn hết (`choManMoc` bên dưới).
   */
  const [manVong, setManVong] = useState<number | null>(null);
  const thuMoMan = useRef(0);
  const moManVong = useCallback((v: number) => {
    if (!matchId) return;
    moMan(matchId, v).then((r) => { thuMoMan.current = 0; if (r.nhip_may < r.so_nhip - 1) setManVong(v); }).catch((e: unknown) => {
      if (!nenThuLaiMoMan(e instanceof ApiError ? e.status : undefined) || thuMoMan.current >= 3) return;
      thuMoMan.current += 1;
      setTimeout(() => moManVong(v), 1500 * thuMoMan.current);
    });
  }, [matchId]);
  const daTuMoMan = useRef<number | null>(null);
  // D480 — trong lúc màn chạy server trả trạng thái TRƯỚC chốt + `cho_man` ⇒ vòng của màn đọc từ cờ, không suy từ `st.vong`.
  const vongMan = st?.cho_man?.vong ?? (st?.dong_ho_minigame === true ? st.vong - 1 : 0);
  useEffect(() => {
    // D526 — vòng có màn đọc lịch server (`lich_man`; nhịp xen kẽ: vòng 1 có màn, vòng mở chợ không) — không tự suy "vòng ≥ 2".
    if (st?.lich_man?.includes(vongMan) !== true || daTuMoMan.current === vongMan) return;
    daTuMoMan.current = vongMan;
    moManVong(vongMan);
  }, [vongMan, moManVong, st?.lich_man]);

  /*
   * ── ĐỒNG HỒ NEO TẠI THỜI ĐIỂM NHẬN (rà đồng hồ 08/08) ────────────────────
   *
   * `st.dong_ho` là ảnh chụp, và `st` bị GIỮ LẠI có chủ đích trong lúc overlay
   * khoảnh khắc diễn (tối đa 12s) — vẽ đồng hồ từ nó là vẽ ảnh chụp bị áp trễ:
   * suốt overlay màn đếm tiếp đồng hồ vòng ĐÃ CHẾT, xong overlay lại khởi hành
   * ở con số ĐẦY đã cũ. Server thì đếm từ commit, nên màn nói dối LÊN đúng
   * bằng thời lượng diễn — đo prod 08/08: founder ĐANG NGỒI CHƠI vẫn bị chốt
   * hộ `tu_dong` hai vòng một trận.
   *
   * Đồng hồ vì thế sống ở kênh RIÊNG: mỗi cửa nhận response đóng dấu
   * `{dh, luc}` NGAY LÚC NHẬN, bất kể phần còn lại của state được áp lúc nào.
   * `apDung` (chạy SAU overlay) cố ý KHÔNG đóng dấu — nó áp bản đã cũ.
   */
  const [dhNeo, setDhNeo] = useState<
    { dh: TrangThaiDTO['dong_ho'] | null; luc: number } | null
  >(null);
  const apNeo = useCallback((moi: TrangThaiDTO, luc?: number) => {
    setDhNeo({ dh: moi.dong_ho ?? null, luc: luc ?? Date.now() });
  }, []);
  /*
   * Đường QUERY (GET đầu + cache tạo trận): mốc nhận là `dataUpdatedAt` của
   * react-query — chính xác cả khi bản trong cache được vẽ ra trước lúc
   * `refetchOnMount: 'always'` kịp về (ảnh cũ thì đếm tiếp từ mốc cũ, không
   * coi là vừa nhận).
   */
  useEffect(() => {
    if (tt.data) apNeo(tt.data, tt.dataUpdatedAt);
  }, [tt.data, tt.dataUpdatedAt, apNeo]);

  /*
   * Số giây còn lại ĐANG CHẠY — CÙNG bộ đếm mà mặt đồng hồ dùng (`useDemNguocVong`).
   * Ở đây nó nuôi VIỀN CẢNH BÁO; không được tự trừ lại lần nữa, xem lý do
   * chống-trôi trong docstring của hook.
   */
  const conNguoc = useDemNguocVong(dhNeo?.dh?.con_lai_s ?? 0, dhNeo?.luc ?? 0);
  useEffect(() => {
    if (!st?.ky_ngo?.moi || st.ky_ngo.moi.length === 0) return;
    if (kyNgoDaTuMo.current === st.vong) return;
    kyNgoDaTuMo.current = st.vong;
    setKyNgoMo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.vong, st?.ky_ngo?.moi]);

  /*
   * MỐC LẦN ĐẦU THẤY VÒNG N (D93) — cửa sổ đếm sự cố cho lời khai `su_co_khai`.
   *
   * ⚠ KHÔNG dùng `dhNeo.luc`: nó được đóng dấu lại ở MỌI cửa nhận response, kể cả
   * cú `dongBoLaiTuServer` chạy SAU một cú nộp hỏng — tức đúng lúc server vừa
   * sống lại thì mốc nhảy lên và toàn bộ số lần hỏng trước đó rơi ra ngoài cửa
   * sổ. Lời khai sẽ luôn rỗng ở đúng ca nó sinh ra để tả. Mốc này chỉ đặt khi SỐ
   * VÒNG đổi, không đặt lại khi cùng vòng được nhận lần nữa.
   */
  const mocVongRef = useRef<{ vong: number; luc: number } | null>(null);
  useEffect(() => {
    if (!st) return;
    if (mocVongRef.current?.vong !== st.vong) mocVongRef.current = { vong: st.vong, luc: Date.now() };
  }, [st?.vong]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** Vòng mới nhất màn ĐÃ BIẾT — chốt đơn điệu cho response về muộn (xem nơi dùng). */
  const vongMoiNhat = useRef(0);
  useEffect(() => {
    if (st) vongMoiNhat.current = Math.max(vongMoiNhat.current, st.vong);
  }, [st?.vong]);   // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * D414 — SỐ LẦN NỘP HỎNG LIÊN TIẾP của một vòng + lúc hỏng gần nhất: nguồn của nhịp GIÃN cho hai đường tự-nộp
   * (hết giờ D38 · đã all-in). Neo vào SỐ VÒNG nên sang vòng mới là tự về 0; nộp thành công thì xoá hẳn.
   * Lưu MỐC TUYỆT ĐỐI (`luc`) chứ không lưu "còn bao lâu": hai effect tự-nộp chạy lại nhiều lần giữa hai cú hỏng
   * (isPending tắt, đồng bộ lại đổi `dhNeo`…) — đếm tương đối thì mỗi lần chạy lại là đẩy hẹn ra xa thêm.
   * Nút CHỐT VÒNG bấm tay KHÔNG bị giãn: đó là ý người chơi, không phải một cái máy hỏi lại.
   * ⚠ STATE chứ không REF, và nằm trong danh sách phụ thuộc của CẢ HAI effect tự-nộp: mỗi cú hỏng PHẢI hẹn lại. Đường
   * all-in trước đây chỉ được hẹn lại nhờ `nop.isPending` lật true → false trong một lần vẽ; cú hỏng tức thì (react-query
   * gộp hai lần báo vào một) thì không lần vẽ nào thấy `true` ⇒ effect không chạy lại ⇒ board đứng im. Bắt được khi viết
   * bài §III đường all-in (tests/nop_vong_hong.test.tsx).
   */
  const [hongNop, setHongNop] = useState<{ vong: number; n: number; luc: number } | null>(null);
  /** Còn phải chờ bao nhiêu ms nữa mới được TỰ nộp lại vòng `vong` (0 = không phải chờ thêm). */
  const conChoThuLai = (vong: number): number => {
    if (!hongNop || hongNop.vong !== vong) return 0;
    return Math.max(0, hongNop.luc + choThuLaiMs(hongNop.n) - Date.now());
  };

  /**
   * D33 — MẢNG, không phải một lá.
   *
   * Đặc quyền ĐA DẠNG HOÁ cho lấy 2 thẻ tài sản một vòng thay vì 1, nên "một lá"
   * không tả nổi trạng thái nữa. Trần THẬT do server cấp (`toi_da_tai_san_vong`)
   * — client chỉ kẹp theo con số đó, không tự suy "có thẻ Đa Dạng Hoá thì 2".
   */
  const [chonTS, setChonTS] = useState<string[]>([]);
  const [chonCT, setChonCT] = useState<string | null>(null);
  /*
   * D3 — GẮN thẻ chiến thuật đang chọn vào mã nào.
   *
   * Chỉ hỏi khi thẻ có `pham_vi: 'tai_san'` VÀ người chơi đang cầm ít nhất một mã.
   * Chưa cầm mã nào mà bắt chọn thì đó là một ô trống không trả lời được — nên lúc
   * đó thẻ mua không gắn, và engine coi như tác động toàn danh mục (đúng hành vi
   * trước D3, xem `DanhMuc.gan`).
   */
  const [ganVao, setGanVao] = useState<string | null>(null);
  /*
   * v32 — KỲ NGỘ: nhiệm vụ đang chọn ở vòng kỳ ngộ, gửi kèm CÚ NỘP VÒNG.
   *
   * ⚠ Không có nút "xác nhận" riêng, và đó là cố ý: một cú bấm thứ hai ở giữa
   * vòng là thêm một NƯỚC ĐI mới (phép thử D67 — chỉ được đổi GIÁ/THÔNG TIN
   * của ba nước cũ). Chọn rồi CHỐT VÒNG như mọi vòng khác.
   */
  const [chonKyNgo, setChonKyNgo] = useState<string | null>(null);
  /*
   * Founder 02/08 — "đòn bẩy giờ chọn xong gán được đúng 1 lần, sau đó chả
   * biết gán lại hay đổi kiểu gì". D40 đã chốt "ghim không còn vĩnh viễn —
   * chỉnh lại mỗi vòng" mà chưa ai xây đường bấm; server thì NHẬN đổi `gan`
   * mỗi vòng từ lâu (holdem_api merge bảng gắn ở mọi dòng log). Đây là bảng
   * ĐỔI ĐÍCH đang chờ: {thẻ ghim → mã mới}, gửi kèm CHỐT VÒNG rồi xoá.
   */
  const [doiGan, setDoiGan] = useState<Record<string, string>>({});
  /** v34 — đích PHỤ Đòn Bẩy cấp 2 đang chờ chốt: mã, '' = bỏ, null = không đổi. */
  const [doiGanPhu, setDoiGanPhu] = useState<string | null>(null);
  /*
   * LÕI VỐN — hai lệnh của nhịp 1, giữ ở ĐÂY chứ không trong panel.
   *
   * Chúng đi kèm lệnh nộp vòng (`POST /rounds`) y hệt `chonTS`/`chonCT`, nên
   * chủ sở hữu phải là màn hình nộp vòng. Để state trong panel thì panel phải
   * tự bắn POST — tức thêm một dòng trong `action_log`, mà log LÀ nguồn dựng
   * lại trận.
   */
  const [chonDao, setChonDao] = useState<LenhDao | null>(null);
  /*
   * ⚠ CAM KẾT NEO VÀO SỐ VÒNG, không phải một chuỗi trần (D104).
   *
   * Đo trên stack thật 17/08 mới lộ: chọn cam kết ở vòng 1 mà khoá lại bật ở
   * VÒNG 3. Gốc là cuộc đua giữa cú tự-nộp (hết giờ) và effect dọn theo
   * `vongHienTai` — payload dựng từ `chonKhoa` HIỆN TẠI, nên một lựa chọn của
   * vòng cũ đi nhờ được sang vòng sau. Người chơi bị khoá tài sản ở một vòng
   * họ KHÔNG hề chọn, và đó là cách hỏng tệ nhất cho một cơ chế CAM KẾT.
   *
   * Neo `{vong, ma}` thì tính đúng đắn nằm trong DỮ LIỆU, không phụ thuộc effect
   * nào chạy trước — dọn trễ cũng không sao vì số vòng đã không khớp.
   */
  const [chonKhoa, setChonKhoa] = useState<{ vong: number; ma: string } | null>(null);
  /** D33 — đặc quyền Phòng Hộ: mã đặt lệnh short vòng này (khớp vòng sau). */
  const [chonShort, setChonShort] = useState<string | null>(null);
  /*
   * v43 — NGÂN HÀNG. NEO THEO SỐ VÒNG, y hệt `chonKhoa` ngay trên và vì ĐÚNG
   * một lý do (D104): payload dựng từ state HIỆN TẠI, nên một lựa chọn của vòng
   * cũ đi nhờ được sang vòng sau nếu effect dọn chạy sau cú tự-nộp. Với cam kết
   * thì hậu quả là bị khoá một mã mình không chọn; với ngân hàng còn nặng hơn —
   * bị KHOÁ TIỀN MẶT ở một vòng mình không hề bấm gửi, giữa lúc cần tiền nhất.
   * Tính đúng đắn nằm trong DỮ LIỆU, không phụ thuộc effect nào chạy trước.
   */
  const [chonTK, setChonTK] = useState<{ vong: number; mo: LenhMoTietKiem | null } | null>(null);
  const [huyTK, setHuyTK] = useState<{ vong: number; ids: string[] } | null>(null);
  /** v10 NAV — chuỗi lệnh mốc đã xếp, gửi cùng CHỐT VÒNG. */
  /*
   * Founder 01/08 (SỬA luật hiển thị 26/07): số LÃI/LỖ luôn hiện ngay,
   * còn chuỗi "VÌ SAO" chi tiết THU GỌN — bấm mới mở. Màn đang rối vì mọi
   * thứ cùng hiện; cái phải-thấy-ngay là kết quả, cái muốn-hiểu-sâu là chain.
   */
  const [moLyDo, setMoLyDo] = useState(false);
  const [lenhNhap, setLenhNhap] = useState<
    { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[]>([]);
  /**
   * LẶP (bàn cược 16/08) — các lá ĐÃ GỬI của vòng trước, để shop xếp lại y hệt
   * bằng một cú bấm. Gom cả cú KHỚP NGAY giữa vòng lẫn hàng gửi cùng CHỐT:
   * `lenhVongNay` tích trong vòng, đổ sang `lenhTruoc` khi vòng đóng.
   * Chỉ là TIỆN TAY ở client — server không biết gì về "lặp": mỗi lá lặp đi
   * đúng đường onThem như một lá bấm tay (C4).
   */
  const [lenhTruoc, setLenhTruoc] = useState<
    { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[]>([]);
  const lenhVongNay = useRef<
    { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[]>([]);
  /** Dòng lỗi dưới hàng lệnh (trait lệch cân…). Tên giữ từ thời KHỚP NGAY (08/08 — nút đã bỏ ở D447). */
  const [khopLoi, setKhopLoi] = useState<string | null>(null);
  /*
   * v55 (D409) — CHỢ TRAIT (vòng mốc): lượt mời đang xem (lượt 0 từ trạng thái, cuộn thêm qua `useCuonTrait`) + id đã
   * lấy; neo theo `vong` để lượt/lựa chọn của vòng cũ không đi nhờ sang vòng mới (cùng nếp `chonTK`). CHỐT LỜI TRONG Ô
   * (Lướt Sóng mới) cũng neo theo vòng. Cả hai đi kèm `POST /rounds` — server kiểm và tính (C4).
   */
  // `gia` = xu cộng dồn của các lần cuộn đã xem (server gửi) — trừ khỏi ví để khoá nút; server kiểm lại lúc chốt (D411).
  const [choTrait, setChoTrait] = useState<{ vong: number; moi: ChoTraitDTO; gia: number } | null>(null);
  const [chonTrait, setChonTrait] = useState<string[]>([]);
  // D430 — tăng khi CHỐT bị chặn vì phần trait đã lấy lệch cân ⇒ cái cân của chợ (trong hàng lõi của shop) rung.
  const [rungCanTrait, setRungCanTrait] = useState(0);
  /*
   * D432 — vòng có lượt chọn (lõi / chợ trait) mở shop vào MÀN CHỌN; số vòng ở đây = vòng người chơi đã sang BÀN CƯỢC.
   * Giữ ở màn nộp vòng (không trong shop) để đóng/mở shop giữa vòng không bắt chọn lại từ đầu. Vòng sau tự khác số ⇒
   * màn chọn của vòng mới hiện lại, không cần dọn.
   */
  const [daQuaChon, setDaQuaChon] = useState<number | null>(null);
  const mocTraitRef = useRef<number | null>(null);
  const [chonChotLoi, setChonChotLoi] = useState<{ vong: number; lenh: LenhChotLoi[] } | null>(null);
  /** Chip LÃI SUẤT (08/08) — bấm mới mở bảng thông tin công khai, miễn phí. */
  const [moLX, setMoLX] = useState(false);
  const [khaoSat, setKhaoSat] = useState(0);
  /** D533 — quầy lượt `khaoSat` của vòng đang mở (câu trả lời cú ĐỔI LÕI) — xem `lib/cho_man.ts`. */
  const quayDoi = useRef<QuayDoi<NonNullable<TrangThaiDTO['shop']>> | null>(null);
  /**
   * D533 — lý do lệnh của cú nộp bị bác (`loi_von` của response nộp). Vòng có màn: GET trạng thái sau màn KHÔNG mang trường này ⇒ đồng bộ lại
   * làm mất dòng "lệnh vòng trước bị bác" của shop. Giữ ở đây, gắn lại vào trạng thái của vòng kế (`kemLoiVon`).
   */
  const loiVonNop = useRef<{ vong: number; loi: NonNullable<TrangThaiDTO['loi_von']> } | null>(null);
  const [canhBao, setCanhBao] = useState<CanhBaoDTO | null>(null);
  const [hangDoi, setHangDoi] = useState<KhoanhKhac[]>([]);
  const [choDienXong, setChoDienXong] = useState(false);
  /*
   * ⚠ Giữ CẢ HAI mốc trước-vòng, và đó không phải thừa: `vonTruoc` là TIỀN MẶT
   * (ChainReveal dựng dây chuyền trên nó), `navTruoc` là TỔNG TÀI SẢN — đúng
   * đại lượng cái headline đang vẽ. Con số một-vòng-một-số phải đo bằng cái thứ
   * hai; xem lý do dài ở `nhipVong`.
   */
  const [ketQuaCho, setKetQuaCho] = useState<
    {
      tt: TrangThaiDTO; vonTruoc: number; navTruoc: number;
      /**
       * D398 — ẢNH TRẠNG THÁI TRƯỚC VÒNG (chụp lúc bấm chốt): số lãi/lỗ và thanh phong cách đọc ảnh này
       * cho tới ĐÚNG bước của chúng trong nhịp kết quả. Vắng (nạp lại trang giữa pha đọc) ⇒ không giữ gì.
       */
      stTruoc?: TrangThaiDTO | undefined;
    } | null
  >(null);
  /*
   * D376 — CỜ "ĐÃ ĐỌC XONG KẾT QUẢ" (xem chú thích dài tại `vongHienThi`).
   *
   * ⚠⚠ HAI HOOK NÀY PHẢI NẰM ĐÂY, KHÔNG ĐƯỢC NẰM CẠNH `vongHienThi`. Bản đầu của D376
   * đặt chúng ngay trên chỗ dùng (~dòng 1985) cho dễ đọc, và thế là MÀN TRẬN CHẾT HẲN:
   * *"Rendered more hooks than during the previous render"*. Giữa đây và đó có NĂM cửa
   * `return` sớm (lỗi tải · trận bỏ dở · đang chờ catalog/art · màn kết) — nên lượt render
   * đầu (catalog chưa về) dừng ở cửa thứ ba, lượt sau đi tiếp, số hook đổi giữa hai lượt.
   * Tức KHÔNG phải ca hiếm: nó gãy 100% số lần mở trận, và bài `mot_vong_mot_luc` bắt được
   * chính là nhờ dựng trên đường thật thay vì gọi thẳng hàm.
   * ⇒ LUẬT CỦA TỆP NÀY: mọi hook sống TRÊN dòng ~1338; dưới đó chỉ còn suy ra và vẽ.
   */
  /*
   * ⚠ KHỞI TẠO `false` (= CHƯA đọc), không phải `true`. Vào màn giữa pha ĐỌC là chuyện
   * thường: F5, mất mạng chớp một cái, mở lại app từ nền. Người ấy CHƯA đọc kết quả, mà
   * `true` thì màn đã nhảy sang vòng kế trước khi họ kịp nhìn — đúng lại cái founder báo,
   * chỉ khác đường vào. Khởi tạo `false` không mở cửa nào mới: cờ chỉ có nghĩa TRONG pha
   * ĐỌC, mà pha ĐỌC là `XEM_KET_QUA_S` giây đầu vòng do SERVER phát và tự hết.
   */
  /*
   * ⭐ D379 — MỘT VÒNG CHỐT ĐƯỢC ĐÚNG MỘT LẦN.
   *
   * Founder: *"ở các thẻ sự kiện thì tôi được chốt vòng tận 2 lần??"* — và *"không phải
   * 1 trong 2 đường mà là cả 2 đường"* (nút trên bàn VÀ nút trong shop).
   *
   * `dangBan` chỉ khoá theo `nop.isPending || choDienXong`. Vòng nào KHÔNG có khoảnh khắc
   * nào để diễn thì `choDienXong` không bật, nên cửa sổ giữa lúc cú nộp trả về và lúc `st`
   * tiến sang vòng mới là cửa sổ MỞ — bấm lần hai lọt vào đó. Server chặn đúng
   * (`409 vong_da_nop`, compare-and-set trên `action_log`) nên KHÔNG hỏng dữ liệu, nhưng
   * người chơi ăn nguyên lời báo lỗi cho một thao tác họ tưởng là hợp lệ.
   * ⚠ Khoá bằng SỐ VÒNG chứ không bằng một cờ boolean: cờ thì phải nhớ tắt đúng lúc, còn
   * số vòng tự hết hiệu lực khi vòng tiến — không có trạng thái nào để quên dọn.
   * ⚠⚠ D412 — TRỪ MỘT CA: cú nộp HỎNG thì vòng không tiến, nên số vòng KHÔNG tự hết hiệu
   * lực. `onError` của `nopVong` nhả khoá — xem chú thích ở đó.
   */
  const vongDaChot = useRef<number | null>(null);
  const [daXemKq, setDaXemKq] = useState(false);
  /** Người chơi tự đi tiếp sớm (mở shop, đóng tấm lý do) — không phải đợi hết pha ĐỌC. */
  const xongDocKq = useCallback(() => setDaXemKq(true), []);
  /*
   * ⭐⭐ DỰNG LẠI KẾT QUẢ VÒNG SAU KHI NẠP LẠI TRANG (24/08, nửa client của nợ D116).
   *
   * Server nay phát `ket_qua_vong` ở CẢ `GET /matches/:id` — nhưng chừng nào chỗ
   * này không đọc thì đó chỉ là một cơ chế chôn thứ hai: màn hình vẫn trắng con
   * số, và vì con số LÀ CÁI NÚT (D119) nên bảng VÌ SAO vẫn không có đường vào.
   *
   * ⚠⚠ CHỈ DỰNG LẠI SỐ LIỆU, TUYỆT ĐỐI KHÔNG BẮN LẠI LỚP PHỦ. Hàng đợi khoảnh
   * khắc (`setHangDoi`) chỉ do nhánh `POST /rounds` nạp, và phải giữ đúng như
   * vậy: nếu seeding ở đây cũng bắn thì F5 một cái là diễn lại cú SSS — hay tệ
   * hơn, diễn lại cú GÃY LÁ ký quỹ — cho một chuyện đã xảy ra từ lâu. Ăn mừng
   * hoặc phạt lại một khoảnh khắc cũ mỗi lần nạp trang là nói dối về thời gian.
   *
   * ⚠ `navTruoc` lấy từ `nav_truoc` của CHÍNH payload (mẫu số đi kèm tử số, D123),
   * không suy lại từ `ban.nav` hiện tại — `ban.nav` là NAV SAU vòng, dùng nó thì
   * con số ra 0 ở mọi lần nạp lại.
   * ⚠ Chỉ seed khi chưa có gì: người chơi vừa chốt vòng xong thì bản POST mới là
   * bản đúng, và nó đã mang theo ảnh chụp `navTruoc` của chính cú bấm đó.
   */
  useEffect(() => {
    const kq = tt.data?.ket_qua_vong;
    if (!kq || kq.nav_truoc === undefined) return;
    setKetQuaCho((cu) => (cu ? cu : {
      tt: tt.data!, vonTruoc: kq.nav_truoc!, navTruoc: kq.nav_truoc!,
    }));
  }, [tt.data]);

  const [nhayDo, setNhayDo] = useState(false);
  /**
   * Các mốc hạng ĐÃ công bố trong trận này (founder 22/08) — mỗi mốc MỘT LẦN.
   *
   * `useRef` chứ không `useState`: nó không vẽ ra gì, và đọc/ghi ngay trong
   * `onSuccess` của cú nộp nên phải thấy giá trị mới tức thì.
   *
   * ⚠ Là một ĐỈNH, không phải một cờ và cũng không phải một TẬP: người chơi leo
   * S → SS → SSS trong cùng trận thì được ăn mừng cả ba lần, mỗi lần một bậc to
   * hơn — đó chính là thứ làm thang bậc đáng leo. Nhưng tụt rồi leo lại thì im.
   *
   * ⚠⚠ BẢN ĐẦU DÙNG `Set` VÀ NÓ NỔ NGƯỢC BẬC. `vuaChamMocCongBo` chỉ so hạng
   * SAU với hạng NGAY TRƯỚC, nên chuỗi SS → (tụt xuống A) → S cho ra mốc `S`
   * hợp lệ, mà `Set` chưa có `S` ⇒ lớp phủ toàn màn ăn mừng một mốc THẤP HƠN
   * đỉnh vừa đạt. Đúng lớp lỗi D113 đã tự cảnh báo cho cú TỤT ("ăn mừng một cú
   * thua là khen nhầm khoảnh khắc"), chỉ khác là ở đây nó lọt qua cửa.
   * Giữ ĐỈNH thì cả hai vế đúng theo cấu trúc: leo tiếp luôn cao hơn đỉnh, còn
   * leo lại thì không.
   */
  const dinhDaNo = useRef(-1);
  /*
   * ⚠ ĐỈNH NÀY PHẢI THEO TRẬN, KHÔNG THEO PHIÊN. Route là `/arena/tran/:matchId`
   * và không mang `key`, nên đi thẳng từ trận này sang trận khác (đổi param)
   * KHÔNG dựng lại component — `useRef` sống tiếp, và trận mới chạm SSS sẽ IM
   * vì nó còn nhớ đỉnh của trận trước. Hỏng im lặng đúng ở khoảnh khắc đắt nhất
   * của trò. Về sảnh rồi vào lại thì có unmount nên không lộ; chính vì thế nó
   * dễ sống sót qua mọi lần thử tay.
   */
  /*
   * MÀN CHÀO VAI — 5s đầu trận, MỘT LẦN mỗi trận (founder 23/08).
   * ⚠ Cùng khuôn với `dinhDaNo`: neo theo `matchId` vì route `/arena/tran/:id`
   * không mang `key`, nên đổi trận KHÔNG dựng lại component — không neo thì
   * trận thứ hai mất màn chào, im lặng.
   * ⚠ Chỉ chào ở VÒNG 1: vào lại một bàn đang dở ở vòng 6 mà bị chặn 5 giây để
   * nghe lại thứ mình đã biết là phạt đúng người quay lại.
   */
  const [daChaoVai, setDaChaoVai] = useState(false);
  /** 12/09 — pha của màn chào vai (coach bàn tập rọi đúng khối); null = không hiện. */
  const [chaoVaiPha, setChaoVaiPha] = useState<'chia' | 'toi' | null>(null);
  const tranCuaChao = useRef<string | null>(matchId);
  if (tranCuaChao.current !== matchId) {
    tranCuaChao.current = matchId;
    if (daChaoVai) setDaChaoVai(false);
  }
  const tranCuaMoc = useRef<string | null>(matchId);
  if (tranCuaMoc.current !== matchId) {
    tranCuaMoc.current = matchId;
    dinhDaNo.current = -1;
  }
  /*
   * ⚠ `rungAllIn`/`nhipRung` GỠ 22/08 cùng cụm ALL-IN toàn màn. Chúng rung cả
   * BÀN ĐẤU đúng nhịp chữ ALL-IN hiện (founder 27/07: "mỗi một người all-in sẽ
   * rung 1 nhịp"). Không còn chữ đó thì không còn nhịp để bám vào — và khoảnh
   * khắc SSS CỐ Ý không rung bàn: rung là ngôn ngữ của cú va chạm, còn đây là
   * phần thưởng. Nó đã có rung riêng ở chính ba chữ S (`sssRung`).
   */
  /** Sự kiện vừa nổ ở vòng vừa chốt — để bắn băng-rôn "lá nào của mình dính". */
  const [suKienNo, setSuKienNo] = useState<{ id: string; giA: boolean; vongGoc?: number } | null>(null);
  /**
   * CHỜ LẬT XONG RỒI MỚI KỂ KẾT QUẢ.
   *
   * Founder: "hiệu ứng lật bài cũng đang bị lỗi vì t không thấy gì". Kiểm ra
   * thì hoạt hình CÓ vào bundle và CÓ chạy — nhưng nó diễn ĐÚNG LÚC bảng kết
   * quả bung ra, nên mắt người chơi ở chỗ khác và cú lật bị nuốt trọn.
   *
   * Không phải lỗi CSS, là lỗi DÀN CẢNH: hai sự kiện tranh nhau cùng một
   * khoảnh khắc. Nay tách làm hai nhịp — lật trước, kể sau.
   * D398 — cờ `dangLat` riêng đã gỡ: "đang lật" nay là bước 'lat_la' của nhịp kết quả (`buocKq`), cùng
   * một lịch với mọi bước khác — hai nguồn cho cùng một khoảnh khắc là đúng bệnh giẫm chân vừa chữa.
   */
  /**
   * 12/09 (Q3) — NHỊP NHÍCH của dải thị trường (`DaiThiTruong`): bật đúng lúc cửa
   * sổ lật đóng (ô đã lật xong, huy hiệu đã hiện) ⇒ sáu lá nhích ngay dưới ô vừa
   * kéo chúng. Tắt lại mỗi khi kết quả mới tới, để vòng sau diễn lại từ đầu.
   */
  const [nhichLa, setNhichLa] = useState(false);
  /**
   * ⭐ D398 — BƯỚC CỦA NHỊP KẾT QUẢ (`lichKetQua`, lib/nhip.ts). 'xong' = không có gì đang diễn.
   * Founder 24/09: *"hiện tại chúng ta có hiệu ứng nhưng chúng đang bị giẫm chân nhau"* — lá bắt đầu lật
   * CÙNG LÚC NAV · dải ghế · thanh phong cách nhảy số và băng tin bung ra. Nay mỗi thứ đổi ĐÚNG bước của nó.
   */
  const [buocKq, setBuocKq] = useState<BuocKetQua>('xong');
  /**
   * D401 — vòng mà GIẢI đã chia xong: hộp "Ăn chia cược" vừa rời giải (hoặc mình không được chia gì) ⇒ con số giải
   * về 0 NGAY lúc ấy, không đợi hết bước LÃI/LỖ. Khoá theo số vòng nên vòng sau tự bắt đầu lại từ "chưa chia".
   */
  const [giaiDaChia, setGiaiDaChia] = useState(-1);
  /** Hẹn của bước đang chờ, và lời "đi tiếp" giữ cho tới khi lớp phủ khoảnh khắc diễn xong. */
  const henKq = useRef<number | null>(null);
  const tiepKq = useRef<(() => void) | null>(null);
  useEffect(() => () => { if (henKq.current !== null) window.clearTimeout(henKq.current); }, []);
  /**
   * 12/09 (Q3) — SỔ LIÊN HỆ mở/đóng trong trận. Mở được cả TRƯỚC quyết định
   * (founder chốt câu 4): sổ là trí nhớ của chính họ về trận đã xong, không phải
   * gợi ý của máy; cú mở là hành vi đo được (`cham_nut/so-lien-he`). Dữ liệu chỉ
   * tải khi mở — kênh đọc thuần `/holdem/me/so-tay`, không chạm ví trận.
   */
  const [moSo, setMoSo] = useState(false);
  /** D561 — khoá v65: lõi cho màn của vòng, chọn LÚC CHỐT (trước khi lá lật). null = mặc định (Bắt Đáy nếu cầm, không thì lõi đầu). */
  const [loiManChon, setLoiManChon] = useState<string | null>(null);
  /** 12/09 — ĐÃ TỪNG mở tờ (!) trong trận (mốc cho bước coach `doc-loi`). */
  const [daDocTo, setDaDocTo] = useState(false);
  const [toMo, setToMo] = useState(false);
  /** D321 — tấm trượt đang mở trong shop ('bank' | null); coach dàn cảnh qua onMoTam. */
  const [tamShop, setTamShop] = useState<string | null>(null);
  const soTayQ = useSoTay(moSo);
  /** Bấm BỎ mở ngã ba (đứng ngoài / đầu hàng), không bỏ thẳng nữa. */
  const [hoiBo, setHoiBo] = useState(false);
  const [hoiThoat, setHoiThoat] = useState(false);
  /*
   * ⚠ `nhipTim` giữ nguyên biến đọc, nhưng KHÔNG CÒN AI BẬT nó sau khi gỡ hai
   * nút poker — hiệu ứng nhịp tim dồn dập vốn chạy trước cú all-in trong
   * `batDauVong`. Để `false` cứng thay vì xoá lớp CSS: mốc ALL-IN sắp quay lại ở
   * PHÂN BỔ VỐN VÀO MÃ (founder 27/07) và đó đúng là chỗ nó nên nổ.
   * ĐIỀU KIỆN GỠ: nếu phân bổ vốn ship mà không nối lại hiệu ứng này thì xoá cả
   * biến lẫn lớp `.nhipTim`, đừng để một hiệu ứng chết nằm lại.
   */
  const nhipTim = false;
  const [xong, setXong] = useState(false);
  /*
   * D336 lượt 2 — XONG BÀN TẬP ⇒ máy ghi "đã qua màn tập": vào Đấu trường lần sau là vào sảnh, không
   * bị dắt lại (`lib/man_tap_dau.ts`). Server cũng đã đếm trận này, nhưng cache `tien-do` của sảnh
   * còn số cũ — cú ghi này là lớp thứ hai, không phải bản sao của lớp thứ nhất.
   */
  const trangThaiXong = xong || st?.status === 'xong';
  useEffect(() => { if (laManTap && trangThaiXong) danhDauQuaManTap('xong'); }, [laManTap, trangThaiXong]);

  /*
   * ĐO LƯỜNG (§2.3 `tran_thoat`) — "thoát trận giữa chừng ở GIAI ĐOẠN NÀO".
   *
   * ⚠ Đọc vòng và trạng thái qua `ref` chứ không qua closure: hàm dọn của
   * `useEffect([])` chạy lúc rời màn và sẽ nhìn thấy giá trị của lần render ĐẦU
   * (vòng 1) nếu bắt trực tiếp — tức mọi người đều "thoát ở vòng 1", một con số
   * trông rất hợp lý và sai hoàn toàn.
   */
  const dauVetRef = useRef<{ vong: number; xong: boolean; tu: number }>(
    { vong: 0, xong: false, tu: Date.now() },
  );
  dauVetRef.current = {
    ...dauVetRef.current,
    vong: st?.vong ?? 0,
    xong: xong || st?.status === 'xong',
  };
  /*
   * ⚠⚠ RỜI TRẬN PHẢI BẮT ĐƯỢC CẢ ĐƯỜNG ĐÓNG APP, KHÔNG CHỈ ĐƯỜNG BẤM ✕.
   *
   * Bản đầu chỉ đặt trong hàm dọn của useEffect, mà React không chạy hàm dọn khi
   * tab bị đóng. Nên nó chỉ bắt được nhóm người bấm nút để thoát — trong khi số
   * liệu prod nói bỏ dở LÀ HÀNH VI ĐA SỐ (90 bỏ dở / 47 xong). Một biểu đồ vẽ
   * đúng nhóm thiểu số rồi trông như phân bố đầy đủ thì tệ hơn không có biểu đồ.
   *
   * ⚠ Ghi ĐÚNG MỘT LẦN mỗi lượt vào trận (`daGhi`). Ẩn app rồi quay lại chơi
   * tiếp là chuyện thường trên điện thoại; ghi lại lần nữa sẽ thổi phồng số lượt
   * bỏ. Ở đây thà báo sớm một lần còn hơn đếm trùng.
   *
   * ⚠ Đây là tín hiệu PHỤ. Con số chính thức về bỏ trận đọc từ `holdem_matches`
   * ở máy chủ — nguồn đó không mất khi mạng rớt và có sẵn cho mọi trận cũ.
   */
  useEffect(() => {
    let daGhi = false;
    const ghiThoat = (): void => {
      const d = dauVetRef.current;
      if (daGhi || d.xong || d.vong <= 0) return;
      daGhi = true;
      ghiDo('tran_thoat', {
        chi_tiet: { vong: d.vong, giay: Math.round((Date.now() - d.tu) / 1000) },
      });
    };
    const boDangKy = dangKyKhiRoi(ghiThoat);
    return () => {
      boDangKy();
      ghiThoat();
    };
  }, []);
  /** Kết quả vòng vừa rồi theo ghế — giữ tới vòng sau để dải đối thủ còn nhãn. */
  const [vongTruoc, setVongTruoc] = useState<Map<string, KetQuaGheDTO>>(new Map());
  /** Shop mở/đóng — TỰ MỞ mỗi vòng mới (kiểu TFT), bấm icon để cất đi. */
  const [shopMo, setShopMo] = useState(false);
  /*
   * KỲ NGỘ = LỚP PHỦ (16/08, doc 06 §12): tự MỞ một lần khi bước vào vòng kỳ ngộ
   * (bộ mời `st.ky_ngo.moi` xuất hiện), đóng khi chọn/bỏ qua, mở lại bằng thanh
   * gọn. Nhớ vòng đã tự mở để không bật lại sau mỗi lần GET đồng bộ.
   */
  const [kyNgoMo, setKyNgoMo] = useState(false);
  const kyNgoDaTuMo = useRef<number | null>(null);
  /** Mã bàn chung — nhớ từ bất kỳ response nào mang nó (GET có, /rounds có; overlay khoảnh khắc thì không). */
  const banMaRef = useRef<string | null>(null);
  useEffect(() => { if (st?.ban_ma) banMaRef.current = st.ban_ma; }, [st?.ban_ma]);
  /*
   * BÀN CHUNG — đọc bảng đội để lấy GHOST (đường NAV bạn cùng bàn) cho thẻ kết
   * trận. Chỉ hỏi khi trận ĐÃ XONG: trước đó server không gửi số của ai (A3.1)
   * nên request chỉ tốn hạn mức mà không mang về gì (D64 ngân sách request).
   */
  const banQ = useBan(st?.status === 'xong' ? (st?.ban_ma ?? banMaRef.current) : null);
  /** Đã từng mở Bảng điện tử trong trận — trợ lý màn tập chờ mốc này. */
  const [daMoBang, setDaMoBang] = useState(false);
  /**
   * D336 — Bảng điện tử ĐANG mở. Lớp phủ bảng (z-index 85) nằm trên trợ lý (80): lúc
   * nó mở, trợ lý không được rọi vào thứ nằm dưới bảng (nút SỔ) — mà phải chờ bảng đóng.
   */
  const [bangDangMo, setBangDangMo] = useState(false);
  /** Vòng này đã mở shop lần nào chưa — để chấm "hàng mới" trên nút. */
  const [daXemShop, setDaXemShop] = useState(false);

  // ── VÒNG CƯỢC TUẦN TỰ ───────────────────────────────────────────────────
  /*
   * ⚠ VÒNG CƯỢC TUẦN TỰ ĐÃ GỠ 11/08 — xem D81.
   *
   * `useHoiLuot` (hook gọi `/luot`), `useVongCuoc`, và cụm `tenGhe`/
   * `gheDangCho`/`hanCho` chỉ phục vụ dải lượt cược — thứ D40 (27/07) tuyên
   * CHẾT HẲN. Cửa duy nhất bật nó là `moVong()`, và hàm đó không có một người
   * gọi nào từ đó tới nay, nên cả cụm chưa bao giờ chạy một lần.
   * Endpoint `/luot` bên server đã gỡ cùng đợt.
   */


  const nop = useNopVong(matchId);
  const lamMoiShop = useKhaoSatLai(matchId);
  const cuonTrait = useCuonTrait(matchId);
  const kiemXung = useCanhBaoXungDot();
  /*
   * 16/08 — TẢI LẠI một trận ĐÃ XONG phải ra màn kết, không phải bàn "ROUND 13/12"
   * (đo trên stack thật khi kiểm bàn chung): `xong` chỉ được set từ response cú
   * nộp, còn GET trận đã xong mang `status: 'xong'` mà không ai đọc. Đọc cả hai.
   */
  const daXong = xong || st?.status === 'xong';
  const autopsy = useAutopsy(matchId, daXong);

  /**
   * Sang vòng mới → shop ĐÓNG, và đánh dấu là có hàng chưa xem.
   *
   * ⚠ Bản trước tự bung shop ngay đầu vòng (nhịp TFT). Nhưng shop giờ là lớp
   * phủ TOÀN MÀN, nên nó che đúng khoảnh khắc ô thị trường đang lật — founder
   * bắt được ngay: "làm timeline kiểu gì mà khi vòng mới hiện ngay chợ thế thì
   * t xem cái thiết kế lật bài kiểu gì?".
   *
   * Không chữa bằng cách hoãn vài trăm ms rồi vẫn tự bung: bung lên giữa lúc
   * người ta đang đọc lãi/lỗ còn khó chịu hơn. Nên shop chỉ mở khi được bấm,
   * và nút SHOP có chấm "hàng mới" để không ai quên mất là có hàng.
   */
  /**
   * 23/08 — SHOP QUAY LẠI Ở PHA QUYẾT (founder: *"Sửa đi"* — thứ tôi vừa đề
   * xuất giữ). Đóng shop lúc ô lật là ĐÚNG (nó là lớp phủ toàn màn, che đúng
   * khoảnh khắc đang kể); cái sai là KHÔNG BAO GIỜ TRẢ LẠI: mỗi vòng người chơi
   * phải bấm SHOP lần nữa, 8–16 lần một trận.
   *
   * ⚠ KHÔNG PHẢI "tự bung shop" — thứ founder bắt lỗi trước đây (bung ngay đầu
   * vòng, che ô đang lật). Hai khác biệt làm nó thành KHÔI PHỤC chứ không phải
   * BUNG: (a) chỉ trả cho người ĐANG ở trong shop lúc vòng lật — ai đã bấm ✕ để
   * xem bàn thì không; (b) trả ở TÍN HIỆU NGỮ NGHĨA của chính trò — `pha` đổi
   * sang 'quyet' (D76: vòng có ngân sách ĐỌC riêng, hết pha đọc mới tới lúc ra
   * quyết định), không phải hoãn vài trăm ms rồi vẫn bung giữa lúc đang đọc
   * lãi/lỗ. Trận cũ không phát `pha` ⇒ không khôi phục, giữ nguyên hành vi cũ.
   */
  const shopMoLucLat = useRef(false);
  const vongHienTai = st?.vong;
  /*
   * ⭐ NAV CHẠY SỐ (31/08) — con số TO NHẤT màn hình, và tới hôm nay nó THAY
   * lạnh: 10.000 → 8.551 trong một khung hình, không một nhịp nào.
   *
   * Đây là chỗ tiêu ngược ngân sách rõ nhất mà khảo sát đo được: 40 vòng lặp
   * vô hạn chạy suốt trận để nói "tôi đang nhấp nháy", trong khi khoảnh khắc
   * DUY NHẤT thật sự có tiền thì câm. Hook `useSoChay` đã có từ D68 và đang
   * chạy ở ba chỗ khác (ví trong shop, con số vòng) — thiếu đúng một dây nối.
   *
   * ⚠ HOOK PHẢI Ở ĐÂY, KHÔNG PHẢI CẠNH `const b = st.ban`: chỗ đó nằm SAU một
   * `return` sớm, gọi hook ở đó là vi phạm luật hook và vỡ khi trận chưa tải.
   * ⚠ 8 nấc × 40ms = 320ms, chậm hơn mặc định (4×34): NAV là số lớn nên ít nấc
   * đọc ra "giật ba cái" chứ không ra "đang đếm".
   */
  /*
   * ⭐ D398 — SỐ GIỮ ẢNH TRƯỚC VÒNG tới đúng bước của nó: NAV · tiền mặt · dải ghế tới bước LÃI/LỖ, thanh
   * phong cách tới bước PHONG CÁCH. Suy ra (không phải hook) — đặt trên chỗ `useSoChay` đọc nó.
   */
  const stSo = !daToiBuoc(buocKq, 'lai_lo') && ketQuaCho?.stTruoc ? ketQuaCho.stTruoc : st;
  const stPc = !daToiBuoc(buocKq, 'phong_cach') && ketQuaCho?.stTruoc ? ketQuaCho.stTruoc : st;
  /** Nhịp kết quả còn đang diễn — sân khấu của mặt bàn (trợ lý · shop mở lại · màn kết đứng ngoài). */
  const dangDienKq = buocKq !== 'xong';
  const navChay = useSoChay(stSo?.ban.nav ?? stSo?.ban.von ?? 0, { nac: 8, msMoiNac: 40 });
  /*
   * ⚠⚠ BUG ĐÃ VÁ (D185) — TẤM TRƯỢT "VÌ SAO" KHÔNG BAO GIỜ TỰ ĐÓNG THEO VÒNG.
   *
   * `moLyDo` trước đây chỉ được gạt về `false` bởi HÀNH ĐỘNG NGƯỜI CHƠI (chạm
   * nền, bấm lại con số). Không một lời gọi nào theo vòng. Mà điều kiện hiện
   * tấm trượt là `ket_qua_vong && !choDienXong && (nay: đã tới bước LÃI/LỖ) && moLyDo`, nên:
   * chạm MỘT LẦN ở vòng 3 thì từ vòng 4 trở đi tấm 70vh TỰ BUNG mỗi vòng, kèm
   * màn chắn bắt hết cú chạm — che đúng khoảnh khắc kết quả đang diễn.
   *
   * Đây gần như chắc chắn là nửa còn lại của lời founder *"phần hiển thị lãi lỗ
   * do bị ẩn nên chẳng có tý cảm giác nào"*: không phải hiệu ứng yếu, mà là có
   * một tấm che 70vh nằm sẵn trên đó. Không bài test nào phủ.
   *
   * ⇒ Vòng mới thì đóng lại. Người chơi muốn xem lý do vòng mới thì chạm lại —
   * đúng câu founder: *"bấm vào chỉ để xem nguyên nhân thôi"*, tức cú bấm thuộc
   * về MỘT vòng, không phải một thiết lập dính vĩnh viễn.
   */
  useEffect(() => { setMoLyDo(false); }, [vongHienTai]);
  useEffect(() => {
    // Ghi cờ theo trạng thái MỚI NHẤT (functional update) — đọc `shopMo` qua
    // closure của effect là đọc giá trị của lần render đã cũ.
    setShopMo((dangMo) => { if (dangMo) shopMoLucLat.current = true; return false; });
    setDaXemShop(false);
    // Lệnh vốn là lệnh CỦA MỘT VÒNG. Giữ lại sang vòng sau là âm thầm nộp lại
    // một lệnh người chơi đã dùng xong — đảo hai lần liên tiếp mà chỉ bấm một.
    setChonDao(null);
    setChonKhoa(null);
    setChonShort(null);
    // Cùng lý do: lựa chọn kỳ ngộ thuộc về ĐÚNG vòng kỳ ngộ đó.
    setChonKyNgo(null);
    // D321 — tấm trượt thuộc về MỘT lần mở shop; sang vòng là đóng.
    setTamShop(null);
  }, [vongHienTai]);

  /** Xem `shopMoLucLat`: trả shop lại đúng lúc pha QUYẾT mở ra. */
  /*
   * ⚠ SUY pha từ giây ĐANG ĐẾM (`phaVong`), KHÔNG đọc `dhNeo.dh.pha` thô: pha
   * thô là ảnh chụp lúc nhận response, mà màn trận không polling ⇒ nó đứng yên
   * ở 'doc' suốt vòng và cần gạt này sẽ KHÔNG BAO GIỜ chạy (cơ chế trang trí).
   * Cùng hàm mặt đồng hồ dùng để vẽ nhãn ⇒ shop mở lại đúng lúc chữ đổi QUYẾT.
   */
  const phaDongHo = phaVong(
    conNguoc, dhNeo?.dh?.tong_s ?? 0, dhNeo?.dh?.doc_s ?? 0, dhNeo?.dh?.pha);
  // `st?.ban.tu_the` chứ không phải `daAllIn`: biến đó khai ở dưới (dòng ~860),
  // dùng ở đây là TDZ — tsc bắt được, ghi ra để không ai "gọn hoá" ngược lại.
  const tuTheBan = st?.ban.tu_the;
  /*
   * ⚠ D533 — ĐANG CHỜ MÀN (`cho_man`): trạng thái là của vòng VỪA CHỐT ⇒ trả shop lúc này là bày lại đúng quầy vừa chốt, nút CHỐT VÒNG bấm
   * không làm gì (khoá D379), và che dòng chờ màn của người không cầm mã (bộ thử 06/10, vòng 1: shop hiện lại "CHỌN LÕI" dưới lớp màn). Chờ
   * đồng bộ sang vòng mới rồi mới trả.
   */
  const dangChoMan = !!st?.cho_man;
  useEffect(() => {
    if (!shopMoLucLat.current) return;
    // `dangDienKq`/`choDienXong`: nhịp kết quả hoặc khoảnh khắc đang diễn (D398) — sân
    // khấu của mặt bàn, chưa tới lượt shop. Đã all-in / trận xong thì không còn chợ.
    if (choDienXong || dangDienKq || xong || tuTheBan === 'all_in' || dangChoMan) return;
    /*
     * ⭐ D441 — trận thật mở NGAY khi nhịp kết quả diễn xong, không chờ pha QUYẾT (founder 27/09); chỉ nhường khi người
     * chơi đang mở tấm VÌ SAO — đóng tấm là shop mở. Bàn tập giữ nhịp 23/08: chỉ trả shop cho người đang ở trong shop lúc
     * lật, và ở pha QUYẾT.
     */
    if (laManTap ? phaDongHo !== 'quyet' : moLyDo) return;
    shopMoLucLat.current = false;
    setShopMo(true);
    setDaXemShop(true);
    // Mở shop = đi tiếp sang vòng mới — y như bấm SHOP tay (`onMoShop`): đầu màn thôi nói vòng vừa đóng.
    xongDocKq();
  }, [phaDongHo, choDienXong, dangDienKq, xong, tuTheBan, laManTap, moLyDo, xongDocKq, dangChoMan]);

  const art = artQ.data?.art ?? {};
  const c = cat.data;
  /*
   * D561 — khoá v65 (`loi_chon_truoc`): lõi cho màn chọn LÚC CHỐT VÒNG, trước khi lá lật. Danh sách = lõi đang cầm + lõi vừa chọn mua
   * (server dựng `loi_cam` sau khi mua); mặc định giống `laCuaMan` (Bắt Đáy nếu cầm, không thì lõi đầu) — server xét lại, một nguồn.
   */
  const loiManDs = st ? [...new Set([...st.ban.danh_muc.chien_thuat, ...(chonCT ? [chonCT] : [])])] : [];
  const loiManVong = loiManChon && loiManDs.includes(loiManChon) ? loiManChon : loiManDs.includes('bat_day') ? 'bat_day' : loiManDs[0] ?? null;
  const tenLoiMan = (loiManVong && c?.chien_thuat.find((x) => x.id === loiManVong)?.label) || loiManVong || '';

  // ── Nhịp chọn bài (V1,2,4,5 tài sản · V3,6 chiến thuật · V7,8 không shop) ──
  // Bảng nhịp lấy từ catalog để CHỈ CÓ MỘT nguồn chân lý: server enforce bằng
  // đúng bảng này, client chỉ hiển thị. Thiếu catalog thì coi như không có
  // shop — thà khoá nhầm còn hơn cho bấm rồi server chối.
  /*
   * ⚠ NHỊP CỦA TRẬN THẮNG NHỊP CỦA CATALOG (D34). Nhịp nay CO THEO CỠ MAP, mà
   * catalog chỉ biết cỡ mặc định — dùng bảng catalog cho một bàn map khác là
   * hiện sai vòng nào có quầy thẻ, ở đúng cái màn quyết định người chơi lấy gì.
   */
  const nhip = st?.ban.nhip_chon_bai ?? c?.nhip_chon_bai ?? [];
  const loaiVongNay = (st ? nhip[st.vong - 1] : undefined) ?? 'khong';
  const vongMoTiepTheo = {
    tai_san: st
      ? (nhip.findIndex((x, i) => i >= st.vong - 1 && x === 'tai_san') + 1) || null
      : null,
    chien_thuat: st
      ? (nhip.findIndex((x, i) => i >= st.vong - 1 && x === 'chien_thuat') + 1) || null
      : null,
  };

  /** Danh mục hiện tại gom theo Ô (bản sao gộp thành CẤP). */
  const oDanhMuc = st ? [
    ...[...new Set(st.ban.danh_muc.tai_san)].map((id) => ({
      id, ten: c?.tai_san.find((x) => x.id === id)?.label ?? id,
      mau: mau(id, true),
      cap: st.ban.danh_muc.tai_san.filter((x) => x === id).length,
      loai: 'tai_san' as const,
    })),
    ...[...new Set(st.ban.danh_muc.chien_thuat)].map((id) => ({
      id, ten: c?.chien_thuat.find((x) => x.id === id)?.label ?? id,
      mau: mau(id, false),
      cap: st.ban.danh_muc.chien_thuat.filter((x) => x === id).length,
      loai: 'chien_thuat' as const,
    })),
  ] : [];

  const kiemXungDot = useCallback((the: string | null) => {
    if (!the || !st) { setCanhBao(null); return; }
    kiemXung.mutate(
      { the, tai_san: st.ban.danh_muc.tai_san, chien_thuat: st.ban.danh_muc.chien_thuat },
      { onSuccess: (r) => setCanhBao(r.canh_bao) },
    );
  }, [st, kiemXung]);

  /*
   * ⚠⚠ CHỐT LÀ CHỐT — bấm một phát là chọn, không đổi qua đổi lại (founder 12/08).
   *
   * Bản cũ toggle: bấm lại bỏ chọn, bấm cái khác thì đổi. Nghe như tiện, nhưng nó
   * giết đúng thứ làm cú chọn có nghĩa. Lá chiến thuật là quyết định DUY NHẤT mỗi
   * vòng mà người chơi phải ra TRƯỚC khi biết ô lật ra gì — tức đúng một cú cam
   * kết dưới bất định. Cho đổi tự do thì nó tụt xuống thành một cái menu: người
   * ta bấm thử từng cái, đọc mô tả, so đi so lại, rồi chốt cái "an toàn nhất".
   * Không có gì để mất thì cũng không có gì để quyết.
   *
   * Theo phép thử D67: cái này KHÔNG thêm nước đi nào — vẫn đúng ba động từ. Nó
   * đổi GIÁ của một nước đi sẵn có, từ "miễn phí, đổi thoải mái" thành "một lần,
   * dứt khoát". Đó là loại thay đổi làm khó GIỎI mà không làm khó HIỂU.
   *
   * Và vì đã chốt nên nó DÙNG ĐƯỢC NGAY trong vòng: đặc quyền của lá hiện tức thì
   * (Chia Lệnh ⇒ mốc mịn, Bán Khống ⇒ hàng khống — D72 §4.5c đã nối dây sẵn), giờ
   * không còn cái cảm giác "mới chọn tạm, chưa biết có ăn không".
   *
   * ⚠ Không đụng server: engine VỐN áp lá trước khi giải lệnh trong cùng vòng.
   * Cái đổi ở đây thuần là client thôi cho phép rút lại — nên không cần cổng
   * `balance_version`, và mọi trận đã lưu replay y nguyên.
   */
  const doiCT = (id: string) => {
    if (chonCT !== null) return;          // đã chốt vòng này rồi
    setChonCT(id);
    setGanVao(null);
    kiemXungDot(id);
  };

  /** v55 (D409) — CUỘN LẠI chợ trait: hỏi lượt k+1 (tất định theo seed); xu trừ lúc chốt vòng theo `cuon` gửi kèm. */
  function cuonTraitLai() {
    if (!st || !choTrait || choTrait.vong !== st.vong) return;
    const vong = st.vong;
    cuonTrait.mutate(choTrait.moi.lan_cuon + 1, {
      onSuccess: (r) => {
        if (!r.cho_trait) return;
        setChoTrait({ vong, moi: r.cho_trait, gia: r.cho_trait.gia });
        setChonTrait([]);
      },
    });
  }

  async function khaoSatLai() {
    if (!st?.shop) return;
    const vongDoi = st.vong;
    lamMoiShop.mutate(khaoSat + 1, {
      onSuccess: (r) => {
        setKhaoSat((x) => x + 1);
        setChonCT(null);
        setCanhBao(null);
        /*
         * ⚠⚠ D533 — trận mới chưa có trạng thái CỤC BỘ (`stCuc` null, màn đang vẽ bản của query) ⇒ trước đây `(cu) => cu ? … : cu` trả lại null:
         * cú đổi KHÔNG hiện ra (vòng 1 — đúng lượt lõi đầu), nút vẫn thành "ĐÃ ĐỔI LÕI", còn cú nộp gửi `khao_sat_lai: 1` ⇒ lõi chọn từ quầy cũ bị
         * server bỏ qua ⇒ màn "chỉ xem". Dựng từ bản đang vẽ, và GIỮ quầy đã đổi để mọi lần đồng bộ lại cùng vòng đè lại nó (`apQuayDoi`).
         */
        quayDoi.current = { vong: vongDoi, shop: r.shop, luot: r.luot_con_lai };
        setSt((cu) => { const goc = cu ?? tt.data ?? null; return goc ? apQuayDoi(goc, quayDoi.current) : goc; });
      },
    });
  }

  /*
   * ⚠ `batDauVong` ĐÃ GỠ cùng hai nút poker. Nó mở pha cược tuần tự, và pha đó
   * nay không có nút nào bấm vào. Nhịp tim dồn dập trước cú all-in nằm trong
   * hàm này — hiệu ứng đó phải sống lại khi mốc ALL-IN quay về ở phân bổ vốn;
   * đọc lại trong git history, đừng viết mới từ đầu.
   */

  /*
   * ⚠ `datCuoc` ĐÃ GỠ cùng hai nút poker (founder 27/07). Nó quy đổi mốc kéo vốn
   * thành nước `theo`/`to` của pha cược tuần tự — pha đó không còn ai bấm vào.
   *
   * Phần lý lẽ của nó thì KHÔNG mất và sẽ cần lại: "chưa vượt giá thì đó là THEO,
   * không phải tố" là bài học từ một lỗi thật (người chơi kéo 50% mà giá đã cao
   * hơn thì ý họ vẫn là 'tôi theo'). Khi các mốc quay lại ở PHÂN BỔ VỐN VÀO MÃ,
   * đọc lại đoạn này trong git history trước khi viết mới.
   */

  /**
   * Nộp trọn vòng kèm CHUỖI hành động, sau khi vòng cược đã đóng.
   *
   * `cachRa` là BA CÁCH RA của D2 — mặc định `giu_vi_the` (chỉ để log cũ đọc
   * được, vì server ưu tiên chuỗi `cuoc`). Nhưng `dung_ngoai`/`dau_hang` thì
   * server ĐỌC THẬT trường này để đổi tư thế ghế, nên không được để mặc định.
   */
  /** D430 — phần trait đã lấy ở vòng mốc này lệch cân ⇒ CHỐT bị chặn (server cũng bác `trait_lech_can`). */
  const traitLechCan = (): boolean => !!st && choTrait?.vong === st.vong && chonTrait.length > 0
    && tongDiemChon(chonTrait) !== 0;
  /** D430 — chặn CHỐT vì lệch cân: nói ở hàng lệnh, mở shop (chợ nằm ở chỗ hàng lõi), cho cái cân rung + câu báo. */
  const chanTraitLech = (): void => {
    setKhopLoi('Phần trait đã lấy chưa cân 0 điểm — lấy thêm hoặc bỏ bớt ở chợ rồi chốt.');
    // D432 — chợ nay ở MÀN CHỌN: chặn CHỐT thì mở shop THẲNG vào chợ, đúng chỗ phải sửa.
    setDaQuaChon(null);
    setShopMo(true);
    setRungCanTrait((n) => n + 1);
  };

  function nopVong(
    chuoi: HanhDongCuoc[], cachRa: NopVongInput['hanh_dong'] = 'giu_vi_the',
    /*
     * Lệnh mốc ĐI KÈM CÚ NỘP NÀY, thay cho `lenhNhap` trong state. Cần cho BỎ
     * (bán sạch): `setLenhNhap` là cập nhật ASYNC — gọi nó rồi `nopVong` ngay
     * sau là body vẫn đọc giá trị CŨ, chuỗi bán không bao giờ được gửi. Truyền
     * thẳng là cách duy nhất không dính bẫy closure đó.
     */
    lenhThem?: { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[],
    /** 22/08 — cú TỰ NỘP lúc đồng hồ chạm 0 (xem effect D38 bên dưới). */
    opts?: { tuDong?: boolean },
  ) {
    if (!st) return;
    /*
     * v55 (D409) — phần trait đã lấy phải CÂN ĐÚNG 0 (founder 25/09). Chặn ở tay cầm và NÓI ở hàng lệnh, mở lại tấm chợ;
     * cú tự nộp hết giờ thì server vứt body nên không chặn. Đặt TRƯỚC `vongDaChot` để cú bấm sau còn đi được.
     */
    if (!opts?.tuDong && traitLechCan()) {
      // D430 — chợ nằm ở chỗ hàng lõi của shop (không còn tấm riêng): mở shop và cho cái cân rung.
      chanTraitLech();
      return;
    }
    const vonTruoc = st.ban.von;
    /*
     * ⭐ Chụp NAV ngay trước khi nộp — đúng con số headline đang hiện. Đây là
     * mốc của "một vòng, một con số"; `vonTruoc` (tiền mặt) không thay được nó.
     */
    const navTruoc = st.ban.nav ?? st.ban.von;
    // D379 — chặn CỨNG ở tay cầm, không chỉ ở nút: nút có thể bật lại vì bất kỳ lý do nào,
    // còn cửa này thì không. Đặt TRƯỚC `mutate` để cú thứ hai không kịp rời máy.
    if (vongDaChot.current === st.vong) return;
    vongDaChot.current = st.vong;
    const vongNop = st.vong;
    nop.mutate(
      {
        vong: st.vong, khao_sat_lai: khaoSat,
        // D561 — khoá v65: lõi cho màn chọn ngay lúc chốt (server xét lõi có đang cầm không).
        ...(st.loi_chon_truoc && loiManVong ? { loi_man: loiManVong } : {}),
        /*
         * v10 NAV — tài sản đi bằng LỆNH MỐC, không bằng lá: lọc mã tài sản
         * khỏi `mua` (server cũng lọc — đây chỉ là không gửi thứ sẽ bị vứt).
         */
        mua: (st.ban.vi_the !== undefined
          ? [chonCT]
          : [...chonTS, chonCT]).filter(Boolean) as string[],
        ...((lenhThem ?? lenhNhap).length > 0 ? { lenh: lenhThem ?? lenhNhap } : {}),
        // D3 — gắn thẻ vừa mua + ĐỔI ĐÍCH thẻ ghim đang cầm (founder 02/08),
        // chung một bảng `gan` vì server merge từng cặp như nhau.
        ...(Object.keys(doiGan).length > 0 || (chonCT && ganVao)
          ? { gan: { ...doiGan, ...(chonCT && ganVao ? { [chonCT]: ganVao } : {}) } }
          : {}),
        // v34 — đích phụ Đòn Bẩy cấp 2 ('' = bỏ). Vắng khi không đổi.
        ...(doiGanPhu !== null ? { gan_phu: { don_bay: doiGanPhu } } : {}),
        /*
         * LÕI VỐN — VẮNG MẶT khi không chọn, không gửi `undefined`.
         *
         * `exactOptionalPropertyTypes` phân biệt hai thứ đó, và server cũng vậy:
         * `chuanHoaDao`/`chuanHoaKhoa` chỉ ghi vào `action_log` khi có giá trị,
         * để dòng của vòng không đảo trông y hệt dòng của trận cũ.
         */
        ...(chonDao ? { dao: chonDao } : {}),
        ...(chonKhoa && chonKhoa.vong === st.vong ? { khoa: chonKhoa.ma } : {}),
        ...(chonShort ? { short: chonShort } : {}),
        /*
         * v43 — NGÂN HÀNG. Cả hai vế lọc theo `st.vong` (xem chú thích chỗ khai
         * state): lựa chọn của vòng cũ KHÔNG được đi nhờ sang vòng này.
         * VẮNG MẶT khi rỗng — `chuanHoaTietKiem` chỉ ghi vào `action_log` khi có
         * giá trị, để dòng của vòng không gửi trông y hệt dòng của trận cũ.
         */
        ...(() => {
          const mo = chonTK?.vong === st.vong && chonTK.mo ? [chonTK.mo] : [];
          const huy = huyTK?.vong === st.vong ? huyTK.ids : [];
          if (mo.length === 0 && huy.length === 0) return {};
          return {
            tiet_kiem: {
              ...(mo.length > 0 ? { mo } : {}),
              ...(huy.length > 0 ? { huy } : {}),
            },
          };
        })(),
        // v32 — VẮNG MẶT khi bỏ qua (không phạt). Server lọc theo bộ ĐƯỢC MỜI.
        ...(chonKyNgo ? { ky_ngo: chonKyNgo as NopVongInput['ky_ngo'] } : {}),
        /*
         * v55 (D409) — CHỢ TRAIT: gửi khi có lấy HOẶC đã cuộn (cuộn mất xu kể cả không lấy gì — giá của việc xem thêm).
         * VẮNG = bỏ qua lượt, không phạt. CHỐT LỜI TRONG Ô đi cùng, neo theo vòng như ngân hàng.
         */
        ...(choTrait?.vong === st.vong && !opts?.tuDong && (chonTrait.length > 0 || choTrait.moi.lan_cuon > 0)
          ? { trait: { lay: chonTrait, cuon: choTrait.moi.lan_cuon } } : {}),
        ...(chonChotLoi?.vong === st.vong && chonChotLoi.lenh.length > 0 && !opts?.tuDong
          ? { chot_loi: chonChotLoi.lenh } : {}),
        /*
         * D93 — LỜI KHAI SỰ CỐ. Gửi kèm MỌI cú nộp có gì để khai (client không
         * biết trước server sẽ xử hết giờ hay không); server chỉ ghi khi vòng bị
         * chốt hộ. Vắng mặt = không có gì để khai — đừng gửi `null` tường minh.
         */
        ...(() => {
          const khai = suCoKeTu(mocVongRef.current?.luc ?? Date.now());
          return khai ? { su_co_khai: khai } : {};
        })(),
        hanh_dong: cachRa, them: 0,
        cuoc: chuoi,
        ...(opts?.tuDong ? { tu_dong: true } : {}),
      },
      {
        /*
         * Nộp lỗi → HỎI LẠI SERVER, không ngồi im trên trạng thái cũ. 409
         * `sai_vong` sau cú tự-nộp hết giờ là ca thường gặp nhất: vòng ĐÃ tiến
         * ở server, chỉ có màn là chưa biết.
         *
         * ⚠⚠ D412 — VÀ NHẢ KHOÁ D379 CỦA ĐÚNG VÒNG NÀY. Khoá ấy hứa "số vòng tự hết hiệu lực
         * khi vòng tiến" — nhưng cú nộp HỎNG thì vòng KHÔNG tiến: rớt mạng / hết hạn chờ /
         * 5xx ⇒ server chưa nhận (hoặc chưa chắc đã nhận), 409 `chua_het_gio` ⇒ server từ
         * chối hẳn. Giữ khoá thì nút CHỐT VÒNG mờ vĩnh viễn, tự-nộp D38 cũng `return` ngay
         * cửa, trong khi băng lỗi bên dưới đang bảo người chơi "bấm CHỐT VÒNG lại nhé" ⇒ bàn
         * đứng im tới khi bộ quét đóng trận sau 45 phút. Nhả là AN TOÀN về dữ liệu: nếu server
         * thực ra đã chốt (response rớt trên đường về), cú nộp lại ăn 409 nhờ compare-and-set
         * trên `action_log`, rồi lại vào đúng nhánh này để đồng bộ — không vòng nào chốt hai lần.
         * So SỐ VÒNG trước khi nhả: chỉ gỡ đúng cái khoá cú nộp này đã đặt.
         */
        onError: () => {
          if (vongDaChot.current === vongNop) vongDaChot.current = null;
          // D414 — đếm lần hỏng liên tiếp của vòng này ⇒ tự-nộp lần sau chờ theo thang giãn (`conChoThuLai`).
          setHongNop((h) => ({ vong: vongNop, n: (h?.vong === vongNop ? h.n : 0) + 1, luc: Date.now() }));
          void dongBoLaiTuServer();
        },
        onSuccess: (tt) => {
          /*
           * ĐÓNG DẤU ĐỒNG HỒ NGAY LÚC NHẬN — trước mọi quyết định giữ/diễn.
           * Phần còn lại của state có thể bị giữ tới hết overlay khoảnh khắc,
           * nhưng vòng mới đã chạy trên server từ commit: đồng hồ không đợi ai.
           */
          apNeo(tt);
          setHongNop(null);   // D414 — tới nơi ⇒ hết chuỗi hỏng, nhịp giãn về 0
          // LẶP: vòng vừa đóng ⇒ hàng gửi kèm cú chốt + các cú khớp giữa vòng
          // thành "lá của vòng trước"; bộ tích của vòng mới trống.
          setLenhTruoc([...lenhVongNay.current, ...(lenhThem ?? lenhNhap)]);
          lenhVongNay.current = [];
          setChonTS([]); setChonCT(null); setGanVao(null); setDoiGan({}); setDoiGanPhu(null); setCanhBao(null);
          setChonDao(null); setChonKhoa(null); setChonShort(null);
          setChonKyNgo(null);
          setChonTrait([]);
          setLenhNhap([]);
          setKhaoSat(0);
          quayDoi.current = null;   // D533 — quầy đã đổi thuộc vòng vừa nộp
          loiVonNop.current = tt.loi_von ? { vong: vongNop, loi: tt.loi_von } : null;
          /*
           * ⭐ KHOẢNH KHẮC HẠNG S/SS/SSS (founder 22/08) — lớp phủ toàn màn nay
           * thuộc về thang phong cách, không còn thuộc về ALL-IN.
           *
           * Ghép ở ĐÂY chứ không trong `timKhoanhKhac` vì hạng nằm trên
           * `TrangThaiDTO.phong_cach`, không nằm trong `ket_qua_vong` — hàm kia
           * chỉ nhìn thấy kết quả vòng. Và so hạng phải so TRƯỚC↔SAU, mà "trước"
           * chính là `st` đang hiện trên màn.
           *
           * ĐỨNG ĐẦU hàng đợi: lên hạng là đỉnh của trận, ×2 chỉ là một vòng
           * đẹp — thứ lớn nhất diễn trước, không bắt người chơi xem màn phụ rồi
           * mới tới màn chính.
           */
          const mocMoi = vuaChamMocCongBo(st.phong_cach?.hang, tt.phong_cach?.hang);
          const bacMoc = mocMoi ? MOC_CONG_BO.indexOf(mocMoi) : -1;
          const noMoc = mocMoi !== null && bacMoc > dinhDaNo.current;
          if (noMoc) dinhDaNo.current = bacMoc;
          /*
           * D457 — khoá v57 (đồng hồ nhịp ngắn, đọc kết quả 5 s): KHÔNG diễn khoảnh khắc từng vòng (×2 · +50% · hạng · ký quỹ).
           * Lớp phủ này khoá mọi nút tới ~2,1 s mỗi cái (trần 12 s) — vượt hẳn 5 s, nên người chơi sẽ mất giờ đặt lệnh để xem.
           * Founder 03/10: khoảnh khắc dồn về màn cuối trận. ⚠ MÀN CUỐI TRẬN CHƯA CÓ chỗ diễn lại chúng (khối "vừa chạm" của
           * `autopsy.khoanh_khac` là THỨ KHÁC — khái niệm đã chạm, không phải các cú nổ này) — thiết kế phải đi qua demo (A11.25),
           * nên trận v57 hiện KHÔNG có khoảnh khắc nào; D457 ghi đây là việc mở.
           */
          const kk = tt.dong_ho_minigame === true ? [] : [
            ...(noMoc ? [khoanhKhacHang(mocMoi)] : []),
            ...(tt.ket_qua_vong ? timKhoanhKhac(tt.ket_qua_vong, st.doi_thu) : []),
          ];
          /*
           * ⭐ D398 — lớp phủ khoảnh khắc thôi diễn TRƯỚC khi lá lật (lên hạng SSS từng nổ khi lá còn
           * úp). Áp kết quả NGAY; ×2 / ký quỹ diễn ở bước LÃI/LỖ, lên hạng ở bước PHONG CÁCH.
           */
          /*
           * ⭐ D441 (founder 27/09: *"mỗi 1 màn thẻ lật xong, hiệu ứng chạy hết thì shop sẽ tự động mở"*) — có kết quả
           * vòng là có lá lật ⇒ đặt cờ; effect `shopMoLucLat` mở shop khi nhịp kết quả diễn XONG (không che lá đang lật).
           * Bàn tập giữ nhịp cũ: Oracle kể ô vừa lật trên mặt bàn trống.
           */
          if (!laManTap && tt.ket_qua_vong) shopMoLucLat.current = true;
          apDung(tt, vonTruoc, navTruoc, st, kk);
        },
      },
    );
  }

  /*
   * D447 (founder 28/09) — KHỚP NGAY ĐÃ BỎ. Phí mua bán tính trên TỔNG đổi tay mỗi mã trong vòng (v56), nên khớp sớm
   * không còn khác gì khớp lúc CHỐT: lúc chốt server tự chạy huỷ tiết kiệm → lệnh (bán trước, mua sau) → gửi tiết kiệm
   * trên tiền còn lại, và ô vòng này vẫn úp nên khớp sớm không biết thêm gì. Endpoint `/khop-lenh` giữ ở server cho trận
   * đang chơi dở trên bản cũ và cho replay (`khop_truoc`).
   */

  /*
   * ⚠ HAI EFFECT CỦA VÒNG CƯỢC ĐÃ GỠ 11/08 (D81): "áp nước đầu khi tới lượt"
   * và "vòng cược đóng → nộp". Cả hai chờ `vc.choBan` / `vc.xongVong`, mà hai
   * cờ đó chỉ đổi bên trong `moVong()` — hàm không có người gọi từ D40. Chúng
   * chưa bao giờ chạy một lần nào.
   */

  /**
   * ĐÃ ALL IN → DỪNG MỌI THAO TÁC, LẬT HẾT BÀI TỚI CUỐI.
   *
   * Founder 20/07: "Khi all in thì phải dừng mọi hành động chơi rồi lật hết bài
   * đến cuối như poker". Bản trước mới khoá được việc MUA THẺ, còn vẫn hỏi
   * người chơi từng vòng — tức là vẫn bắt quyết định trong khi họ không còn gì
   * để quyết. Đúng như poker: dồn hết vốn rồi thì chỉ còn ngồi xem board chạy.
   *
   * Engine đã không hỏi lượt ghế `all_in` nữa (xem `conCuoc`), nên ở đây chỉ
   * cần tự nộp vòng cho tới hết trận, có nhịp nghỉ để người chơi kịp xem từng
   * lá lật.
   */
  const daAllIn = st?.ban.tu_the === 'all_in';

  /**
   * TỰ CUỘN TỚI LÁ ĐANG LẬT.
   *
   * Founder 20/07: "lật tuần tự từng cái một cách tự động và TỰ KÉO THEO lá bài
   * được lật lên thay vì phải lướt". Khi đã all-in thì người chơi không còn thao
   * tác nào — bắt họ tự vuốt tìm lá vừa lật là hỏng hẳn cảm giác ngồi xem board
   * chạy.
   */
  /*
   * v55 (D409) — VÒNG MỐC: server gửi `cho_trait` (lượt 0) ⇒ nhận lượt mời, xoá lựa chọn cũ, MỞ tấm chợ (sự kiện của
   * vòng, không giấu sau ngăn kéo — người chơi đóng bằng XONG). Không phải vòng mốc ⇒ dọn sạch. `mocTraitRef` chặn
   * việc `st` đồng bộ lại nhiều lần trong cùng vòng ghi đè lượt đã cuộn.
   */
  useEffect(() => {
    const ct = st?.ban.cho_trait;
    if (!st || !ct) {
      if (mocTraitRef.current !== null) { mocTraitRef.current = null; setChoTrait(null); setChonTrait([]); }
      return;
    }
    if (mocTraitRef.current === st.vong) return;
    mocTraitRef.current = st.vong;
    setChoTrait({ vong: st.vong, moi: ct, gia: 0 });
    setChonTrait([]);
    setRungCanTrait(0);
  }, [st?.vong, st?.ban.cho_trait]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!st) return;
    document.querySelector('[data-o-dang-lat]')?.scrollIntoView({
      behavior: itMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center',
    });
  }, [st?.vong, itMotion]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!daAllIn || !st || xong || nop.isPending || choDienXong || hangDoi.length) {
      return undefined;
    }
    // D414 — cú trước hỏng thì chờ thêm theo thang giãn, không dội lại mỗi nhịp.
    const t = setTimeout(() => nopVong([]),
      Math.max(itMotion ? 300 : NHIP.TU_NOP_VONG, conChoThuLai(st.vong)));
    return () => clearTimeout(t);
  }, [daAllIn, st?.vong, xong, nop.isPending, choDienXong, hangDoi.length, hongNop]);   // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * D38 — TỰ NỘP KHI QUÁ HẠN VÒNG. Sửa lỗi founder gặp 27/07 trên prod:
   * *"hết vòng 1 nó đ** thèm tự lật... vòng 2 diễn ra thì bộ đếm giờ chết"*.
   *
   * Server CHỈ cưỡng chế hạn khi có request tới (holdem_api, khối "CƯỠNG CHẾ HẠN
   * VÒNG") — đúng theo C4, nhưng ở chế độ đấu bot thì không ai khác gửi request
   * hộ: đồng hồ chạm 0 và trận đứng im vĩnh viễn. Ai đó phải bấm chuông, và
   * người duy nhất còn lại là client.
   *
   * ⚠ VÌ SAO CHỜ THÊM `TRE_TU_NOP_S` chứ không nộp ngay lúc 0: server đếm ân hạn
   * 8s (`DONG_HO.AN_HAN_S`) SAU mốc hết giờ rồi mới coi là quá hạn. Nộp sớm hơn
   * mốc đó thì server áp body như một lượt bình thường — KHÔNG có cờ `tu_dong`,
   * tức log ghi "cố ý giữ nguyên" cho một người thực ra là hết giờ. Đó là điểm
   * chạm A1 mà D38 dựng cờ `tu_dong` để giữ: `events` append-only, ghi sai một
   * lần là sai vĩnh viễn. 10s = 8s ân hạn + 2s đệm mạng/lệch đồng hồ.
   *
   * Nộp body RỖNG qua chính `nopVong` (server vứt body khi quá hạn nên lựa chọn
   * dở dang trong shop không bị lặng lẽ commit). KHÔNG chạy khi: trận cũ không
   * có đồng hồ (`dong_ho` vắng — bịa hạn cho trận cũ là sai), đã all-in (đường
   * tự nộp riêng ở trên, nhịp nhanh hơn), đang nộp, hay đã xong.
   */
  useEffect(() => {
    // `tam_dung` (màn tập miễn giờ) — server không chốt hộ thì client cũng
    // không được tự nộp, nếu không thì vòng vẫn bị cướp đúng như cũ.
    const dh = dhNeo?.dh;
    if (!dh || dh.tam_dung || xong || daAllIn
      || nop.isPending || choDienXong) {
      return undefined;
    }
    /*
     * 22/08 — KHÔNG CÒN CHỜ 10s. Đo trên stack (22/08): màn ghi HẾT GIỜ ở giây 50,
     * vòng mới hiện ở giây 60 — mười giây đứng im mỗi vòng, founder đọc là
     * *"đếm xong không lật bài tiếp theo"*. Nay nộp NGAY sau mốc 0 (+1s đệm) kèm
     * `tu_dong: true`: server soi đồng hồ CỦA NÓ, qua mốc ⇒ dán cờ hết giờ (A1
     * giữ nguyên: cờ do server quyết, không phải client khai); lệch đồng hồ ⇒
     * 409 `chua_het_gio` ⇒ `onError` đồng bộ lại ⇒ `dhNeo` mới ⇒ effect hẹn lại.
     */
    const TRE_TU_NOP_S = 1;
    /*
     * Founder 02/08 — "đang chơi thoát ra ngoài thì nó ko đếm nữa": app chạy
     * nền là timer JS bị treo; quay lại thì visibilitychange đã GET bản mới,
     * nhưng bản mới nói HẾT GIỜ mà nhánh cũ vẫn hẹn thêm con_lai_s(0) + 10s
     * NỮA — mỗi vòng đứng im chục giây, trông như trận chết. Server đã tuyên
     * hết giờ (họ vắng mặt lâu hơn ân hạn từ lâu) thì nộp ngay sau nhịp ngắn;
     * 10s chỉ dành cho đường thường (đồng hồ đang chạy, chừa đủ 8s ân hạn).
     *
     * Rà đồng hồ 08/08 — tính từ MỐC NHẬN (`dhNeo`), không phải từ lúc effect
     * chạy: effect này bị khoá suốt overlay khoảnh khắc (`choDienXong`), nên
     * lấy `con_lai_s` thô tại đây là cộng thêm cả thời lượng diễn vào hẹn giờ.
     */
    const conThat = Math.max(
      0, dh.con_lai_s - Math.floor((Date.now() - dhNeo.luc) / 1000));
    const cho = dh.het_gio ? 1 : conThat + TRE_TU_NOP_S;
    /*
     * D414 — cú tự-nộp trước HỎNG (rớt mạng · 5xx · hết hạn chờ) thì chờ thêm theo thang giãn của `mang.ts`
     * (3 · 6 · 12 · 30 s). Không giãn thì quá hạn vòng mà máy chủ còn lỗi là mỗi máy khách hỏi lại mỗi ~1 s, kèm một
     * GET đồng bộ mỗi lần — dồn đúng vào máy chủ đang hỏng (C2). 409 `chua_het_gio` cũng đi đây: server đã trả số giây
     * thật qua đồng bộ lại, nên `cho` mới lớn hơn nhịp giãn thì vẫn là `cho` thắng.
     */
    const t = setTimeout(() => nopVong([], 'giu_vi_the', undefined, { tuDong: true }),
      Math.max(cho * 1000, st ? conChoThuLai(st.vong) : 0));
    return () => clearTimeout(t);
  }, [st?.vong, dhNeo, xong, daAllIn, nop.isPending, choDienXong, hongNop]);   // eslint-disable-line react-hooks/exhaustive-deps



  /** D398 — cắt ngang nhịp kết quả (đồng bộ lại từ server · vào trận mới): nhảy thẳng tới trạng thái cuối. */
  function dungNhipKq() {
    if (henKq.current !== null) { window.clearTimeout(henKq.current); henKq.current = null; }
    tiepKq.current = null;
    setNhichLa(true);
    setBuocKq('xong');
  }

  function apDung(
    tt: TrangThaiDTO, vonTruoc: number, navTruoc: number,
    stTruoc?: TrangThaiDTO, kk: readonly KhoanhKhac[] = [],
  ) {
    dungNhipKq();
    setSt({ ...tt, ban: tt.ban });
    // D376 — kết quả mới tới ⇒ màn quay về nói vòng VỪA ĐÓNG cho tới khi người chơi đi tiếp.
    setDaXemKq(false);
    const kq = tt.ket_qua_vong;
    setKetQuaCho({ tt, vonTruoc, navTruoc, stTruoc });

    /*
     * ⭐⭐ D398 — NHỊP KẾT QUẢ MỘT HÀNG (lib/nhip.ts `lichKetQua`, luật A11.26):
     *   chia quỹ (chỗ giữ — Giải Vòng chưa thi công) → LÁ LẬT → băng TIN (ô tin / tin cũ lộ giả) →
     *   DẢI 6 MÃ hiện mũi tên + thước → [khoảnh khắc ×2 · ký quỹ] → LÃI/LỖ nhảy (NAV · tiền mặt · dải
     *   ghế · con số vòng · nháy cháy) → PHONG CÁCH đổi → [khoảnh khắc lên hạng] → xong.
     * Mỗi bước một tiêu điểm; bước sau chỉ mở khi bước trước diễn xong. Lớp phủ khoảnh khắc là tiêu
     * điểm của chính nó: chuỗi DỪNG chờ nó (watchdog 12 s vẫn cứu được nếu nó kẹt).
     */
    const coTin = !!(kq?.tin_gia_lo || kq?.o.kind === 'su_kien');
    // D400 — bước LÃI/LỖ chờ đủ cho hàng hộp khoản nổi (cùng danh sách bảng VÌ SAO) diễn xong.
    const khoanVong = kq ? khoanNoiCuaVong(khoanLaiLo(kq, c?.tai_san ?? []), KHOAN_NOI_TOI_DA) : [];
    const soKhoan = khoanVong.length;
    // D401 — bước CHIA QUỸ dài theo số ghế thả xu vào GIẢI (mức góp `cam_ket` của server — `gheNopCuaVong`).
    const soGheNop = kq ? gheNopCuaVong(kq).length : 0;
    // D402 — giải trả về các ghế nhận bắt đầu lúc giải cạn: lúc hộp "Ăn chia cược" vào hàng, hoặc đầu bước nếu mình
    // không được chia. Bước LÃI/LỖ chờ đủ cú trả diễn xong.
    const iQuy = khoanVong.findIndex((k) => k.khoa === KHOAN_TU_GIAI);
    const soGheNhan = kq?.chia_quy_vong?.length ?? 0;
    const traGiai = soGheNhan > 0 ? { luc: iQuy >= 0 ? mocKhoanNoiVao(iQuy) : 0, soGhe: soGheNhan } : undefined;
    // D442 — xu hướng (nền bàn thẻ) đổi ở vòng này thì chuỗi có bước MÔI TRƯỜNG riêng (đổi màu + rung), sau lá lật + tin.
    const doiMoiTruong = !!stTruoc && moiTruongCua(stTruoc.xu_huong) !== moiTruongCua(tt.xu_huong);
    const lich = lichKetQua({ soGheNop, coTin, giamChuyenDong: itMotion, soKhoan, doiMoiTruong, ...(traGiai ? { traGiai } : {}) });
    const kkLaiLo = kk.filter((x) => x.chu === '×2' || x.chu === '+50%' || x.chu === 'KY_QUY');
    const kkHang = kk.filter((x) => !kkLaiLo.includes(x));
    setNhichLa(false);
    const hieuUng = (buoc: BuocKetQua) => {
      if (buoc === 'tin') {
        /*
         * ⭐ TIN GIẢ LỘ RA CŨNG LÀ MỘT SỰ KIỆN TOÀN MAP (founder 23/08) — và ưu tiên nó khi cả hai cùng
         * xảy ra: "tin kia là bịa" đảo nghĩa chính con số vòng này. (Chuyển nguyên từ bản trước D398.)
         */
        if (kq?.tin_gia_lo) setSuKienNo({ id: kq.tin_gia_lo.su_kien, giA: true, vongGoc: kq.tin_gia_lo.vong });
        else if (kq?.o.kind === 'su_kien') setSuKienNo({ id: kq.o.su_kien, giA: false });
      }
      if (buoc === 'thi_truong') setNhichLa(true);
      if (buoc === 'lai_lo') {
        /*
         * D401 — GIẢI CẠN ở bước LÃI/LỖ: có hộp "Ăn chia cược" thì giải cạn đúng lúc hộp ấy rời giải (`KhoanNoi` báo
         * `khiRa`); mình không được chia gì (hoặc giảm chuyển động — không hộp nào dựng) thì cạn ngay đầu bước.
         */
        if (kq && (itMotion || !khoanVong.some((k) => k.khoa === KHOAN_TU_GIAI))) setGiaiDaChia(kq.vong);
        if (kq) {
          const m = new Map<string, KetQuaGheDTO>();
          for (const d of kq.cua_doi_thu) m.set(d.ghe_id, d);
          setVongTruoc(m);
        }
        if (tt.ban.da_chay && !itMotion) {
          /*
           * Cháy tài khoản: nháy đỏ MỘT cái (chỉ đạo founder 20/07) — nay ở ĐÚNG bước lãi/lỗ.
           * ⚠ Vế RUNG đã mất khi D122 gỡ cụm `rungNhe/Vua/Manh`; ai muốn trả lại thì dùng `rung()`
           * của `lib/rung.ts`, đừng dựng lại lớp CSS đã gỡ.
           */
          setNhayDo(true);
          window.setTimeout(() => setNhayDo(false), NHIP.NHAY_DO);
        }
      }
    };
    const choPhu = (ds: readonly KhoanhKhac[], diTiep: () => void) => {
      tiepKq.current = diTiep;
      setHangDoi([...ds]);
      setChoDienXong(true);
    };
    const chay = (i: number) => {
      const muc = lich[i];
      if (!muc) return;
      const vao = () => {
        setBuocKq(muc.buoc);
        hieuUng(muc.buoc);
        const ket = () => chay(i + 1);
        henKq.current = window.setTimeout(() => {
          henKq.current = null;
          // Lên hạng diễn SAU khi thanh phong cách đã đổi — thanh chạm mốc rồi mới ăn mừng.
          if (muc.buoc === 'phong_cach' && kkHang.length) choPhu(kkHang, ket);
          else ket();
        }, muc.ms);
      };
      // ×2 / ký quỹ diễn TRƯỚC khi số lãi/lỗ nhảy — cú lớn được báo rồi con số mới chạy.
      if (muc.buoc === 'lai_lo' && kkLaiLo.length) choPhu(kkLaiLo, vao);
      else vao();
    };
    chay(0);

    if (tt.xong) setXong(true);
  }

  /*
   * D398 — lớp phủ khoảnh khắc diễn xong (hoặc watchdog cưỡng chế) ⇒ nhịp kết quả ĐI TIẾP từ đúng chỗ nó
   * dừng chờ. Trước D398 hàm này gọi lại `apDung` vì khoảnh khắc diễn TRƯỚC khi kết quả được áp.
   */
  const khoanhKhacXong = useCallback(() => {
    setHangDoi([]);
    setChoDienXong(false);
    const t = tiepKq.current;
    tiepKq.current = null;
    t?.();
  }, []);

  /*
   * ── HAI TẤM LƯỚI CHỐNG CỨNG ĐƠ (founder báo 28/07: "nhiều lỗi khi tương tác
   * hoặc đếm ngược dẫn đến lỗi cứng đơ") ────────────────────────────────────
   *
   * ĐƠ 1 — overlay khoảnh khắc kẹt. `choDienXong` bật là MỌI nút chết
   * (`dangBan`) VÀ cả hai effect tự-nộp bị khoá (`|| choDienXong`): đồng hồ về
   * 0 cũng không ai cứu. Trên điện thoại, tab chạy nền giữa lúc overlay diễn
   * là timer của nó bị trình duyệt hoãn vô hạn định — màn chết cứng toàn phần.
   * WATCHDOG: overlay có 12 giây (dài hơn tổng mọi hoạt hình khoảnh khắc) để
   * tự xong; quá hạn thì cưỡng chế `khoanhKhacXong()` — kết quả vẫn áp đủ, chỉ
   * mất phần diễn. Nút không bao giờ được phép chết quá 12 giây.
   */
  useEffect(() => {
    if (!choDienXong) return undefined;
    const t = setTimeout(khoanhKhacXong, 12_000);
    return () => clearTimeout(t);
  }, [choDienXong, khoanhKhacXong]);

  /*
   * ĐƠ 2 — nộp vòng LỖI mà không có đường về. `useNopVong` chỉ có onSuccess;
   * cú nộp lỗi (đua giữa TỰ NỘP hết giờ và bấm tay → kẻ thua nhận 409
   * `sai_vong`; hoặc mạng di động rớt giữa response) bỏ client kẹt ở vòng CŨ —
   * và từ đó MỌI cú nộp sau đều 409 vĩnh viễn: trận tiến ở server, màn đứng im.
   * Lối về duy nhất đúng C4: HỎI LẠI SERVER rồi đặt màn về đúng sự thật của nó,
   * xoá mọi trạng thái dở dang (lựa chọn shop thuộc về vòng đã đóng).
   */
  const dangDongBo = useRef(false);
  /*
   * D38 vá 3 (01/08 — founder: "bộ đếm thời gian vẫn đôi khi bị lỗi"): hai
   * lưới trước (watchdog 12s + resync khi 409) không đỡ được kịch bản app
   * CHẠY NỀN trên điện thoại — timer JS bị hệ điều hành treo, quay lại thì
   * đồng hồ client kể chuyện cũ. Nghe visibilitychange → hỏi lại server.
   */
  useEffect(() => {
    const khiHien = () => {
      if (document.visibilityState === 'visible') void dongBoLaiTuServerRef.current();
    };
    document.addEventListener('visibilitychange', khiHien);
    return () => document.removeEventListener('visibilitychange', khiHien);
  }, []);

  const dongBoLaiTuServerRef = useRef<() => Promise<void> | void>(() => {});
  /*
   * Bản mới nhất của `ketQuaCho` cho các callback không nằm trong danh sách phụ
   * thuộc của chúng — `dongBoLaiTuServer` được giữ trong một ref và gọi từ
   * listener `visibilitychange`, nên đọc state qua closure là đọc ảnh cũ.
   */
  const ketQuaChoRef = useRef<typeof ketQuaCho>(null);
  ketQuaChoRef.current = ketQuaCho;
  const dongBoLaiTuServer = useCallback(async () => {
    if (!matchId || dangDongBo.current) return;
    dangDongBo.current = true;
    try {
      const tuoi = await api<TrangThaiDTO>(`/holdem/matches/${matchId}`);
      // Chốt đơn điệu (rà đồng hồ 08/08): response về muộn hơn một cú nộp
      // chen ngang thì vứt — cùng lý lẽ với cửa khớp lệnh, xem chú thích ở đó.
      // (Trận chỉ tiến, không lùi — kể cả bản "trận đã đóng" cũng mang vòng
      // cuối cùng, không bao giờ nhỏ hơn vòng màn đã thấy.)
      if (tuoi.vong < vongMoiNhat.current) return;
      /*
       * ⚠⚠ KHÔNG XOÁ KẾT QUẢ VÒNG KHI KHÔNG CÓ GÌ MỚI (sửa 23/08).
       *
       * Cửa đơn điệu ở trên KHÔNG đỡ ca thường: sau khi nộp vòng N, `tt.vong`
       * đã là N+1 nên `vongMoiNhat` = N+1, và GET cũng trả N+1 ⇒ `N+1 < N+1`
       * sai ⇒ rơi thẳng xuống dòng xoá. Nghĩa là chỉ cần liếc thông báo 5 giây
       * rồi quay lại app là con số lãi/lỗ vòng biến mất — KỂ CẢ khi server
       * không tiến thêm gì. Và mất con số là mất luôn cái NÚT: nó là đường duy
       * nhất còn lại tới dây chuyền VÌ SAO (D26 §18.5), nên ba ca TỰ MỞ
       * (`tu_dong` · `tin_gia_lo` · `siet_cua_ban`) cũng câm theo — ra nền đúng
       * vòng bị chốt hộ là mất luôn lời báo rằng vòng đó bị chốt hộ.
       *
       * ⚠ SỬA 24/08: `GET /matches/:id` NAY CŨNG phát `ket_qua_vong` (trả nợ
       * D116). Nên xoá ở đây thôi là mất hẳn — lần đồng bộ sau dựng lại được.
       * Vẫn chỉ xoá khi vòng THỰC SỰ tiến, vì lý do cũ không đổi: liếc thông báo
       * 5 giây rồi quay lại không được làm mất con số đang đọc dở.
       */
      const daTien = tuoi.vong > (ketQuaChoRef.current?.tt.vong ?? -1);
      setHangDoi([]); setChoDienXong(false);
      // D398 — sự thật của server thắng nhịp đang diễn dở: nhảy thẳng tới trạng thái cuối.
      if (henKq.current !== null) { window.clearTimeout(henKq.current); henKq.current = null; }
      tiepKq.current = null;
      setNhichLa(true); setBuocKq('xong');
      if (daTien) setKetQuaCho(null);
      /*
       * ⚠⚠ D414 — CHỈ XOÁ LỰA CHỌN DỞ KHI VÒNG TRÊN SERVER ĐÃ ĐI QUA VÒNG MÀN ĐANG ĐỨNG.
       * Khối xoá này viết cho ca "vòng đã tiến, lựa chọn thuộc vòng đã đóng" (409 `sai_vong`, trận chạy ở tab khác).
       * Nhưng hàm này còn chạy sau MỌI cú nộp hỏng và mỗi lần quay lại từ nền — hai ca vòng KHÔNG tiến. Xoá ở đó là:
       * cú CHỐT VÒNG rớt mạng ⇒ đồng bộ lại ⇒ hàng lệnh biến mất ⇒ người chơi bấm lại theo đúng lời băng lỗi và nộp
       * một vòng KHÔNG LỆNH, im lặng; liếc thông báo 5 giây rồi quay lại cũng mất sạch hàng lệnh đang xếp.
       * Vòng chưa tiến thì các lựa chọn vẫn thuộc đúng vòng đang mở — giữ nguyên. Cú nộp lại mà server thực ra đã chốt
       * (response rớt trên đường về) ăn 409 nhờ compare-and-set rồi lại vào đây, lần này với vòng đã tiến ⇒ xoá.
       * So với `vongMoiNhat` (vòng mới nhất màn đã thấy) chứ không với `ketQuaCho`: cái sau là vòng của KẾT QUẢ đang
       * hiện, trễ một vòng so với vòng đang chơi.
       */
      if (tuoi.vong > vongMoiNhat.current) {
        setChonTS([]); setChonCT(null); setGanVao(null); setCanhBao(null);
        setChonDao(null); setChonKhoa(null); setChonShort(null); setChonKyNgo(null);
        setKhaoSat(0);
        setLenhNhap([]);
        quayDoi.current = null;
      }
      // D533 — GET luôn bày quầy lượt 0: cùng vòng mà đã ĐỔI LÕI thì đè lại quầy đã đổi (cú nộp sẽ gửi `khao_sat_lai` của nó).
      // D533 — vòng kế của cú nộp có lệnh bị bác: gắn lại lý do (GET sau màn không mang `loi_von`).
      const lv = loiVonNop.current;
      const kemLoiVon = !tuoi.loi_von && lv && tuoi.vong === lv.vong + 1 && !tuoi.cho_man ? { ...tuoi, loi_von: lv.loi } : tuoi;
      setSt(apQuayDoi(kemLoiVon, quayDoi.current));
      apNeo(tuoi);
    } catch {
      // Mạng vẫn đứt: giữ màn, người chơi bấm tiếp sẽ thử đồng bộ lại.
    } finally {
      dangDongBo.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);
  dongBoLaiTuServerRef.current = dongBoLaiTuServer;

  /*
   * D533 — ĐANG CHỜ MÀN (`cho_man`, trạng thái không có đồng hồ): hỏi lại trạng thái đúng lúc màn của bàn hết (server báo `het_ms`, đóng dấu lúc
   * nhận). Trước đây không ai hỏi ⇒ không cầm mã / lớp màn đã đóng là bàn đứng ở vòng vừa nộp, CHỐT VÒNG mờ, vòng sau bị chốt hộ. Lớp màn đang mở
   * thì để nó tự đóng rồi hỏi (trạng thái đổi ngay dưới màn quyết toán là đổi luôn hai ô thẻ của màn).
   */
  const choManMoc = useRef<{ cm: object; moc: number } | null>(null);
  const choMan = st?.cho_man;
  if (choMan && choManMoc.current?.cm !== choMan) choManMoc.current = { cm: choMan, moc: mocHetMan(choMan.het_ms, Date.now()) };
  if (!choMan && choManMoc.current) choManMoc.current = null;
  useEffect(() => {
    if (!choMan || manVong !== null || !choManMoc.current) return;
    const t = setTimeout(() => { void dongBoLaiTuServerRef.current(); }, choHoiLai(choManMoc.current.moc, Date.now()));
    return () => clearTimeout(t);
  }, [choMan, manVong]);

  /*
   * NHÁNH LỖI — phải có, và phải có TRƯỚC skeleton.
   *
   * Trước 25/07 màn này KHÔNG có nhánh lỗi nào: tải trạng thái thất bại thì
   * skeleton quay vĩnh viễn. Đó chính là hình dạng lỗi founder gặp, và nó là
   * lỗi thiết kế chứ không phải lỗi mạng — một màn chỉ có trạng thái "đang chờ"
   * thì mọi thất bại đều biến thành "chờ mãi".
   */
  /*
   * D541 (founder 06/10: "màn chơi phải cố định trong 1 khung hình để user nhìn được bao quát bàn") — thu các khối TRONG LUỒNG của bàn
   * (`.banDau > .strip/.pnl/.foot/.thanhDay`, biến `--vua`) cho vừa chiều cao khung nhìn thật (`visualViewport` — trừ thanh trình duyệt). Lớp phủ
   * cố định (shop · trợ lý · bảng) không thu. Đo lại khi nội dung đổi cỡ (ResizeObserver) hoặc khung nhìn đổi (xoay máy, thanh địa chỉ co/giãn).
   */
  // Ref dạng STATE: bàn chỉ dựng sau khi mọi truy vấn (trạng thái · danh mục · art) về — đo khi phần tử thật sự gắn, không theo `st`.
  const [banEl, banRef] = useState<HTMLDivElement | null>(null);
  const [vua, setVua] = useState(1);
  const vuaRef = useRef(1);
  useLayoutEffect(() => {
    const el = banEl;
    if (!el) return undefined;
    const do_ = () => {
      const khung = (window.visualViewport?.height ?? window.innerHeight) - Math.max(0, el.getBoundingClientRect().top + window.scrollY);
      // Chỉ các khối TRONG LUỒNG bị thu; khe `gap` + lề đáy thì không ⇒ trừ phần không thu khỏi khung trước khi chia.
      let thu = 0;
      for (const c of el.children) { const vt = getComputedStyle(c).position; if (vt !== 'fixed' && vt !== 'absolute') thu += c.getBoundingClientRect().height; }
      const khongThu = el.scrollHeight - thu;
      const moi = heSoVuaKhung(thu / vuaRef.current, khung - khongThu, vuaRef.current);
      if (moi !== vuaRef.current) { vuaRef.current = moi; setVua(moi); }
    };
    do_();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(do_) : null;
    ro?.observe(el);
    window.addEventListener('resize', do_);
    window.visualViewport?.addEventListener('resize', do_);
    return () => { ro?.disconnect(); window.removeEventListener('resize', do_); window.visualViewport?.removeEventListener('resize', do_); };
  }, [banEl]);

  /*
   * ⚠ `cat.isError`/`artQ.isError` PHẢI Ở ĐÂY (rà mạng kém 11/08). Trước bản
   * này chỉ `tt.isError` được kiểm, còn cửa skeleton phía dưới chặn `!c` — nên
   * catalog hỏng MỘT LẦN là màn trận thành ô xám trống VĨNH VIỄN: `staleTime`
   * một giờ + `refetchOnWindowFocus: false` nghĩa là nó không tự thử lại, kể cả
   * khi sóng đã về. Người chơi chỉ còn cách tắt app.
   */
  if (!matchId || tt.isError || cat.isError || artQ.isError) {
    return (
      <div className={s.pnl}>
        <div className={s.loi} role="alert">
          {!matchId
            ? 'Đường dẫn này thiếu mã bàn.'
            : 'Không mở được bàn đấu. Có thể trận đã kết thúc hoặc mạng vừa gián đoạn.'}
        </div>
        <div className={s.loiNut}>
          {matchId && (
            <button
              type="button"
              className={s.nutPhu}
              onClick={() => {
                // Thử lại CẢ BA: hỏng cái nào cũng ra cùng một màn này, nên nút
                // phải chữa được cả ba, nếu không nó chỉ chữa được một phần ba số ca.
                void tt.refetch();
                void cat.refetch();
                void artQ.refetch();
              }}
            >
              ↻ THỬ LẠI
            </button>
          )}
          <button type="button" className={s.nutPhu} onClick={() => navigate(ROUTE_ARENA)}>
            ‹ VỀ SẢNH
          </button>
        </div>
      </div>
    );
  }

  /*
   * D38 — TRẬN ĐÃ BỊ ĐÓNG VÌ QUÁ HẠN.
   *
   * Phải là một MÀN RIÊNG, không phải một dòng chữ nhỏ trên bàn đấu: bàn vẫn tải
   * được (server trả đủ trạng thái) nên nếu không chặn ở đây, người chơi sẽ ngồi
   * bấm mua thẻ, chọn cam kết, rồi mới nhận 409 ở lần chốt phiên — mất công vô ích
   * và đọc ra như một lỗi mạng ngẫu nhiên.
   *
   * KHÔNG có nút "chơi tiếp": trận `bo_dở` không hồi sinh được, đó là cả điểm của
   * hạn trận. Nói rõ nó không tính kết quả để người chơi biết mình không mất hạng.
   */
  if (st?.status === 'bo_dở') {
    return (
      <div className={s.pnl}>
        <div className={s.loi} role="alert">
          Trận này đã đóng vì để quá lâu không có nước đi. Kết quả không được tính.
        </div>
        <div className={s.loiNut}>
          <button type="button" className={s.nutPhu} onClick={() => navigate(ROUTE_ARENA)}>
            ‹ VỀ SẢNH
          </button>
        </div>
      </div>
    );
  }

  if (cat.isPending || artQ.isPending || !st || !c) {
    /*
     * `data-cho` nói RÕ đang chờ cái gì. Skeleton vô danh đã làm tôi mất một
     * quãng dài hôm 25/07: bàn đấu đứng ở đây trong khi POST /matches đã trả 201,
     * mà không có cách nào biết cờ nào đang chặn ngoài việc đọc lại code.
     * Rẻ, không lộ gì cho người chơi, và cứu đúng lớp lỗi khó nhất: màn treo im.
     */
    return (
      <div
        className="skeleton"
        style={{ height: 480 }}
        aria-busy="true"
        data-cho={[
          cat.isPending && 'catalog',
          artQ.isPending && 'art',
          !st && 'trang-thai',
          !c && 'catalog-data',
          tt.isPending && 'dang-tai',
        ].filter(Boolean).join(',')}
      />
    );
  }

  /*
   * ── ĐỪNG CHẶT NGANG HOẠT ẢNH VÒNG CUỐI (rà 11/08) ─────────────────────
   *
   * PEAK-END RULE: người ta nhớ ĐỈNH và KẾT. Trước bản này màn kết swap NGAY
   * khi `xong` bật + GET /autopsy về — tức cái "kết" là một hoạt ảnh bị chặt
   * ngang, và ĐIỂM CHẶT do độ trễ mạng quyết định nên mỗi trận cắt một kiểu.
   * Không thiết kế được cảm xúc trên một thứ ngẫu nhiên. Mà vòng cuối lại
   * thường là vòng quyết định thứ hạng — đúng khoảnh khắc đáng xem nhất.
   *
   * ⚠ KHÔNG chờ vô hạn: `choDienXong` đã có watchdog 12 giây cưỡng chế
   * (`khoanhKhacXong`), nên chờ ở đây có trần và không đẻ ra một cửa treo mới.
   */
  const sanSangKet = daXong && !choDienXong && !dangDienKq && hangDoi.length === 0;

  /*
   * ── KẾT TRẬN KHÔNG TẢI ĐƯỢC (rà mạng kém 11/08) ───────────────────────
   *
   * `useAutopsy` chỉ retry một lần. Mạng chập chờn ⇒ `xong === true` mà
   * `autopsy.data === undefined` ⇒ code rơi thẳng xuống render BÀN ĐẤU SỐNG
   * của một trận ĐÃ CHẾT: người chơi bấm gì cũng ăn 409, không một lời giải
   * thích, không đường về sảnh. Phải có màn riêng — cùng khuôn với trận
   * `bo_dở` ngay phía trên.
   */
  if (sanSangKet && !autopsy.data) {
    return (
      <div className={s.pnl}>
        <div className={s.loi} role="alert">
          {autopsy.isError
            ? 'Trận đã xong nhưng chưa tải được bảng kết quả — có vẻ mạng vừa gián đoạn.'
            : 'Đang tổng kết trận…'}
        </div>
        {autopsy.isError && (
          <div className={s.loiNut}>
            <button type="button" className={s.nutPhu} onClick={() => void autopsy.refetch()}>
              ↻ THỬ LẠI
            </button>
            <button type="button" className={s.nutPhu} onClick={() => navigate(ROUTE_ARENA)}>
              ‹ VỀ SẢNH
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Kết trận ── (BENTO KHÔNG CUỘN: `screens/holdem/ManKet.tsx`, SPEC `alpha-draft-tang-khong-gian` phần A)
  if (sanSangKet && autopsy.data) {
    return (
      <>
        <ManKet
          du={autopsy.data}
          cat={c}
          art={artQ.data?.art}
          tongVong={st.tong_vong}
          banMa={st.ban_ma ?? banMaRef.current}
          doiBan={banQ.data?.doi}
          onVeSanh={() => navigate(ROUTE_ARENA)}
        />
        {laManTap && (
          <CoachTap
            vong={st.vong}
            tongVong={st.tong_vong}
            shopMo={false}
            bangMo={daMoBang}
            shopChonMa={false}
            coKetQua={false}
            loaiVongNay="khong"
            xong
            onMoShop={() => {}}
            khoaLuu={matchId}
            minigame={st.dong_ho_minigame === true}
          />
        )}
      </>
    );
  }

  const b = st.ban;
  /*
   * D406 — bảng vai của CHÍNH trận này (`vai_bang`, server). Catalog chỉ nói khoá MẶC ĐỊNH: từ khi mặc định là v54 (vốn
   * đều · lõi gọn) mà bàn tập vẫn v53, đọc catalog là bàn tập hiện Cá Mập "×1" trong khi vốn thật ×3. Server cũ chưa
   * phát ⇒ rơi về catalog như trước.
   */
  const vaiBang = st.vai_bang ?? c.vai;
  /** D398 — phần SỐ của `b`: giữ ảnh trước vòng tới bước LÃI/LỖ (xem `stSo`). */
  const bSo = (stSo ?? st).ban;
  /** D411 — xu đã "tiêu" vào các lần cuộn chợ trait đã xem trong vòng (giá cộng dồn server gửi). */
  const giaCuonDaXem = choTrait && choTrait.vong === st.vong ? choTrait.gia : 0;
  /* D343 — thanh phong cách vẽ trạng thái nào (đủ vòng · xám dấu ? · không có): một chỗ quyết.
     D398 — đọc ảnh giữ tới bước PHONG CÁCH. */
  const thanhPC = thanhPhongCachCua(stPc ?? st);
  /*
   * v55 (D409) — NGỌN LỬA ĐÀ đứng cạnh thanh phong cách và diễn ở bước PHONG CÁCH (A11.26): đọc từ `stPc` — ảnh trước
   * vòng giữ tới đúng bước ấy, nên lửa lên/dập cùng lúc thanh sáng. Lý do dập đọc từ kết quả vòng vừa chốt (dữ liệu/test).
   * `null` = trận không cổng ⇒ thanh y như cũ.
   */
  const luaPc = (stPc ?? st).ban.lua;
  const luaThanh = luaPc
    ? {
      nac: Math.max(0, Math.min(3, luaPc.nac)) as NacLua,
      dacBiet: luaPc.dac_biet,
      // D422 — MÙ LỬA: cờ server (C4), khe lửa vẽ lá bịt mắt thay ngọn lửa.
      muLua: (stPc ?? st).ban.rang_buoc?.mu_lua === true,
      dap: daToiBuoc(buocKq, 'phong_cach') ? (ketQuaCho?.tt.ket_qua_vong?.lua?.dap ?? null) : null,
    }
    : null;
  /*
   * Founder 02/08 — thanh sức khoẻ đo TỔNG TÀI SẢN (NAV), không phải tiền mặt:
   * "tiền t dùng all-in để mua vàng nhưng avatar lại nhấp nháy đỏ báo sắp
   * cháy". Trận cũ không nav thì NAV vắng → rơi về von, hành vi cũ giữ nguyên.
   */
  const hp = Math.round(((bSo.nav ?? bSo.von) / c.luat.START_VON) * 100);
  /*
   * ⭐ NHỊP VÒNG — MỘT NGUỒN cho ba chỗ đọc (23/08): con số ở hàng lăng kính ·
   * nhịp đỏ/xanh của chính thanh lăng kính · điều kiện bung khối chi tiết.
   *
   * ⚠ Ba bản cài đặt của cùng phép trừ sẽ TRÔI (D61), và cú trôi ở đây biểu
   * hiện là "thanh nháy xanh trong khi con số ghi số âm" — sai IM LẶNG.
   *
   * ⚠ NGUỒN DUY NHẤT LÀ `ketQuaCho`, và nó sống qua cả pha chọn bài của vòng
   * sau vì chính nó bền — không phải nhờ một nguồn thứ hai.
   * Bản đầu viết `(ketQuaCho?.tt ?? st)` như một lưới an toàn; đó là PHÉP RỖNG
   * theo hai đường độc lập: (a) nhánh `?? st` không bao giờ chạy vì ngay dưới
   * đã `return null` khi thiếu `ketQuaCho`; (b) kể cả gỡ cửa đó ra thì `st` vẫn
   * không có gì để cho — `ket_qua_vong` CHỈ do `POST /rounds` phát, `GET
   * /matches/:id` không hề mang trường đó. Một lưới an toàn không đỡ được gì
   * còn tệ hơn không có: nó làm người sau thôi kiểm (D87).
   */
  /*
   * ⭐ DỮ LIỆU KHỐI TAY (D184) — *đang GIỮ gì*, không phải *đang ĐẶT gì*.
   * Cọc trên LÁ vẫn nói cú đặt (và chip MẢNH của Chia Lệnh sống ở đó); khối TAY
   * nói vị thế. Hai câu khác nhau, nên hai cọc khác nhau — gộp lại là dựng lại
   * đúng bệnh "một câu hỏi, nhiều mẫu số".
   */
  const donViChipTay = Math.max(1, Math.floor(c.luat.START_VON / 4));
  const maCamTay: MaCam[] = [
    ...Object.entries(b.vi_the ?? {})
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([id, v]) => ({
        ma: id,
        ten: c.tai_san.find((t) => t.id === id)?.label ?? id,
        giaTri: v ?? 0,
        chipDay: Math.max(1, Math.round((v ?? 0) / donViChipTay)),
        chipManh: 0,
      })),
    /*
     * D342 — CỌC KHỐNG lên thanh TAY. `TayBai` đã có sẵn kiểu vẽ (`khong` · viền và chip đỏ) từ
     * D184 mà chưa ai nối dây, nên người chỉ đang khống thấy "CHƯA CẦM MÃ NÀO" (trận founder
     * 16/09, vòng 8–11). `ma` mang tiền tố để khoá React không trùng với cọc dài cùng mã.
     */
    ...Object.entries(b.vi_the_khong ?? {})
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([id, v]) => ({
        ma: `khong:${id}`,
        ten: `KHỐNG ${c.tai_san.find((t) => t.id === id)?.label ?? id}`,
        giaTri: v ?? 0,
        chipDay: Math.max(1, Math.round((v ?? 0) / donViChipTay)),
        chipManh: 0,
        khong: true,
      })),
  ].sort((x, y) => y.giaTri - x.giaTri);
  // D443 — hàng LÕI gỡ khỏi màn chính (founder 28/09: "Bỏ cái phần hiển thị lõi ở màn hình chính"); lõi xem ở SHOP.

  const nhipVong = (() => {
    const kq = ketQuaCho?.tt.ket_qua_vong;
    /*
     * ⚠⚠ ĐO BẰNG CHÍNH ĐẠI LƯỢNG HEADLINE VẼ, KHÔNG BẰNG `nav_sau` CỦA ENGINE.
     *
     * Bản đầu lấy `cua_ban.nav_sau − cua_ban.nav_truoc`, nghe rất đúng tên. Đo
     * bằng engine thật (v34, bàn 5, 120 seed × 6 vòng) thì nó lệch với NAV
     * headline ở **100% số vòng có lệnh**, và ĐỔI DẤU ở **15–40%**: engine chụp
     * `nav_sau` TRƯỚC khi chia Quỹ vòng, trước gọi ký quỹ và trước SIẾT PHÁP LÝ,
     * nên chênh đúng bằng (suất quỹ nhận − cược nền 500). Người chơi đọc "vừa
     * mất 77" trong khi tài sản vừa TĂNG 704, và không gì trên màn giải thích
     * khoảng chênh — vế "VÒNG" ở thanh đáy thì D114 vừa gỡ.
     *
     * ⇒ Lấy hiệu của hai ẢNH CHỤP headline: `navTruoc` ghi ngay lúc bấm nộp,
     * `ban.nav` của trạng thái sau. Hai chỗ nay là MỘT đại lượng theo cấu trúc,
     * không phải hai bản cài đặt phải trông nhau (D61).
     * ⚠ KHÔNG sửa engine: `nav_sau` là đầu vào của xếp hạng và nằm trên đường
     * replay — đổi nó là viết lại kết quả mọi trận đã lưu.
     */
    if (!ketQuaCho) return null;
    // D398 — con số vòng nhảy ở bước LÃI/LỖ, không phải lúc lá còn đang lật.
    if (!daToiBuoc(buocKq, 'lai_lo')) return null;
    const navSau = ketQuaCho.tt.ban.nav;
    if (navSau !== undefined) {
      const delta = navSau - ketQuaCho.navTruoc;
      return {
        delta,
        /*
         * ⚠ MẪU SỐ ĐI KÈM TỬ SỐ, KHÔNG ĐỂ CON SỐ TỰ ĐI TÌM (founder 23/08 lượt
         * 3: con số đổi sang %). `goc` là ĐÚNG cái `navTruoc` đã trừ ở trên, nên
         * `delta/goc` là % của cùng một đại lượng — không phải `pnl_bp` (thước
         * xếp hạng tiền-chia-quỹ, lệch dấu 22–41% số vòng, D116 đã gỡ khỏi đây).
         * Tách hai chỗ tính là dựng lại đúng bệnh "bốn con số bốn mẫu số" mà
         * D114 dỡ đi.
         */
        goc: ketQuaCho.navTruoc,
        vong: kq?.vong ?? st.vong,
        dau: (delta > 0 ? 1 : delta < 0 ? -1 : 0) as -1 | 0 | 1,
      };
    }
    /*
     * Không có thước NAV: trận cũ (≤ v10a, cổng `nav` tắt) hoặc ghế đã CHÁY
     * (engine bỏ ghế cháy khỏi `ket_qua` ⇒ `cua_ban` null). Vẫn phải ra MỘT con
     * số — nó là cửa vào DUY NHẤT của khối VÌ SAO, và D26 §18.5 cho thu gọn chứ
     * không cho chôn mất. Rơi về tiền mặt, đúng thước bản trước D114 đã dùng.
     */
    const d = ketQuaCho.tt.ban.von - ketQuaCho.vonTruoc;
    return {
      delta: d,
      // Nhánh này đo TIỀN MẶT, nên mẫu số cũng phải là tiền mặt — lấy `navTruoc`
      // ở đây là chia hai đại lượng khác nhau và ra một % vô nghĩa.
      goc: ketQuaCho.vonTruoc,
      vong: kq?.vong ?? st.vong,
      dau: (d > 0 ? 1 : d < 0 ? -1 : 0) as -1 | 0 | 1,
    };
  })();
  /*
   * ⭐⭐ D376 (founder 22/09) — MÀN CHỈ ĐƯỢC NÓI VỀ MỘT VÒNG MỘT LÚC.
   *
   * Nguyên văn, lần thứ ba founder phải nói: *"Round này đoán kịch bản, thẻ round sau lật
   * lên là biết mình đoán đúng hay sai chứ sao lại hiện kết quả của round trước?"*.
   *
   * Gốc nằm ở `apDung`: nó `setSt(tt)` và `setKetQuaCho(tt)` CÙNG MỘT NHỊP, mà `tt` đã là
   * trạng thái của vòng SAU. Nên ngay khi tấm lãi/lỗ bung ra, mọi chỗ đọc `st.vong` — nhãn
   * Oracle, bảng điện tử, shop — đã nhảy sang vòng kế. Màn hình khi ấy nói HAI con số vòng
   * cùng lúc: tấm báo vòng 4, nhãn trên đầu báo vòng 5. Đúng ảnh founder gửi.
   *
   * ⚠ D374 ĐÃ CHỮA NHẦM CHỖ: nó thêm dòng "KẾT QUẢ VÒNG 4" lên tấm — tức VIẾT CHÚ THÍCH
   * cho mâu thuẫn thay vì bỏ mâu thuẫn đi. Giải thích được, vẫn khó chịu, vì màn vẫn đang
   * nói hai điều. Founder chốt 22/09: cả màn nói CÙNG một vòng cho tới khi người chơi đi tiếp.
   *
   * ⚠⚠ VÌ SAO KHÔNG ĐƠN THUẦN ĐÓNG BĂNG SỐ: đồng hồ vòng sau ĐÃ CHẠY từ lúc chốt
   * (`holdem_api.ts`: `vong_mo_luc = now()`). Đóng băng nhãn mà để đồng hồ im là dựng một
   * cái bẫy mới — người chơi đọc kết quả, hết giờ vòng sau, bị nộp hộ mà không hiểu vì sao.
   * Nên đồng hồ NÓI THẬT: suốt lúc đóng băng nó tự khai đang đếm cho vòng nào.
   */
  /*
   * ⭐ KHÔNG TỰ NGHĨ RA MỘT PHA MỚI — SERVER ĐÃ CÓ MỘT PHA TÊN LÀ "ĐỌC".
   *
   * `pha='doc'` (M2/D90) là `XEM_KET_QUA_S` giây ĐẦU của mọi vòng ≥ 2, do server phát, và
   * nó nghĩa đúng một điều: *người chơi đang đọc kết quả vòng trước*. Đó chính là quãng mà
   * founder nói màn phải nói vòng vừa đóng. Dùng nó thay vì bịa một cờ mới có ba cái lợi
   * không thương lượng được:
   *   · TỰ HẾT — quãng đọc nằm TRONG ngân sách giây của vòng, nên không ai đọc quá giờ rồi
   *     mất vòng. Một cờ do client tự giữ thì phải tự dựng lưới an toàn, và lưới ấy là chỗ
   *     để trượt;
   *   · KHÔNG ĐẺ CON SỐ THỨ HAI — mặt đồng hồ lúc này đã mang nhãn ĐỌC/QUYẾT chứ không mang
   *     số vòng, nên màn chỉ còn đúng một số vòng;
   *   · MỘT NGUỒN — cùng `phaVong()` mà mặt đồng hồ và cửa mở-lại-shop đang đọc.
   * ⚠ `phaDongHo` SUY TỪ GIÂY ĐANG ĐẾM, không đọc `dh.pha` thô: pha thô là ảnh chụp lúc nhận
   * response nên nó đứng im ở 'doc' cả vòng (xem chú thích tại `phaDongHo`).
   */
  const vongHienThi = phaDongHo === 'doc' && !daXemKq && ketQuaCho?.tt.ket_qua_vong
    ? ketQuaCho.tt.ket_qua_vong.vong : st.vong;

  /*
   * ⭐ D401 — GIẢI VÒNG: con số và nhịp của hộp GIẢI theo đúng bước của nhịp kết quả (A11.26):
   *  · ngoài nhịp: quỹ TỐI THIỂU vòng đang chơi — server `quy_vong_hien_tai` (nền × số ghế còn sống);
   *  · CHIA QUỸ (trước lá): xu các ghế bay vào, số chạy từ con số đã hiện suốt pha chọn bài tới tổng giải server
   *    (`quy_vong`, gồm cả phí mua bán đổ vào) — lá còn úp nên chưa lộ ai thắng;
   *  · lá lật → dải 6 mã: giải đứng đầy;
   *  · LÃI/LỖ: cạn về 0 đúng lúc hộp "Ăn chia cược" rời giải (`giaiDaChia`); PHONG CÁCH: 0;
   *  · xong: quỹ tối thiểu của vòng MỚI.
   * Vắng `quy_vong_hien_tai` (API cũ) ⇒ không vẽ hộp. Trận đã đóng ⇒ chỉ vẽ khi nhịp vòng cuối còn đang diễn.
   */
  /*
   * D584 — khoá giải bằng XU TRAIT (`giai_xu_hien_tai` có mặt): không ai nộp gì (nền 0) ⇒ hộp nói tổng XU của giải; ở nhịp kết quả con số là tổng xu
   * server chia (`chia_quy_vong[].xu`), bay về ghế theo hạng ở bước LÃI/LỖ (không còn hộp "Ăn chia cược" ⇒ giải cạn ngay đầu bước).
   */
  const giaiLaXu = typeof st.giai_xu_hien_tai === 'number';
  const giai: {
    so: number; pha: PhaGiai; lan: number; gheNop: GheNop[]; traVe: GheNhanGiai[]; tuSo: number | undefined;
  } | null = (() => {
    if (typeof st.quy_vong_hien_tai !== 'number' || (xong && !dangDienKq)) return null;
    const kq = ketQuaCho?.tt.ket_qua_vong;
    if (!dangDienKq || !kq) {
      return { so: giaiLaXu ? st.giai_xu_hien_tai! : st.quy_vong_hien_tai, pha: 'nghi', lan: st.vong, gheNop: [], traVe: [], tuSo: undefined };
    }
    const vuaChia = buocKq === 'lai_lo' && giaiDaChia === kq.vong;
    const tongXu = (kq.chia_quy_vong ?? []).reduce((a, x) => a + (x.xu ?? 0), 0);
    return {
      so: vuaChia || buocKq === 'phong_cach' ? 0 : giaiLaXu ? tongXu : kq.quy_vong,
      // D402 — `tra`: giải vừa cạn ở bước LÃI/LỖ ⇒ xu bay về các ghế nhận (`chia_quy_vong` của server).
      pha: buocKq === 'chia_quy' ? 'nop' : vuaChia ? 'tra' : 'nghi',
      lan: kq.vong,
      gheNop: gheNopCuaVong(kq),
      traVe: (kq.chia_quy_vong ?? []).map((x) => ({ ghe: x.ghe_id, hang: x.hang, tien: x.tien, ...(x.xu !== undefined ? { xu: x.xu } : {}) })),
      tuSo: giaiLaXu ? tongXu : ketQuaCho.stTruoc?.quy_vong_hien_tai,
    };
  })();
  /*
   * ⭐ D401 — MẶT BÀN GIỮ ẢNH TRƯỚC VÒNG tới bước LÁ LẬT: bản đồ (lá mới) · tên chương · đếm bộ bài · chip lãi suất.
   * Trước D401 bước CHIA QUỸ dài 0 ms nên lá lật đúng lúc kết quả về; nay xu các ghế bay vào GIẢI trước (~1,5 s), mà
   * bản đồ đọc `st` mới thì lật lá NGAY lúc ấy — hai tiêu điểm chồng nhau (soi màn thật 24/09: lá đang quay giữa lúc xu
   * đang bay). Cùng khuôn `stSo`/`stPc` (D398): thứ chưa tới bước thì GIỮ trạng thái cũ, không ẩn, không nhảy trước.
   */
  const stBan = !daToiBuoc(buocKq, 'lat_la') && ketQuaCho?.stTruoc ? ketQuaCho.stTruoc : st;
  /*
   * D585 — THẺ VÒNG LẬT MỘT LẦN, TRÊN BÀN, TRƯỚC KHI MÀN MỞ (founder 10/10: *"1 thẻ có tận 2 hoạt ảnh lật (1 trong mini-game 1 ngoài màn
   * chính) nên cảm giác 1 cái bị thừa"*). Vòng có màn: server trả trạng thái TRƯỚC chốt + lá vừa chốt riêng ở `cho_man.o` ⇒ bàn nhận lá ấy ở
   * bước LẬT LÁ (MarketMap lật ô cuối mới) và màn mở sau bước đó. Đóng màn ⇒ `lich_su_o` mới có đúng lá ấy ở đúng chỗ ⇒ cùng `key` ô, không lật
   * lại. Lá PHA úp (D561, `{ up: true }`) không có mặt ⇒ không vào đây: nó lật một lần trên bàn SAU màn (màn giữ úp — `latTrenBan`).
   */
  const laChoMan = st.cho_man?.o && !('up' in st.cho_man.o) && daToiBuoc(buocKq, 'lat_la') ? st.cho_man.o : null;
  const daLatBan = laChoMan ? [...stBan.lich_su_o, laChoMan] : stBan.lich_su_o;
  // D442 — NỀN bàn thẻ đổi ở bước MÔI TRƯỜNG (sau lá lật + tin), không cùng lúc lá lật: mỗi bước một tiêu điểm (A11.26).
  const stNen = !daToiBuoc(buocKq, 'moi_truong') && ketQuaCho?.stTruoc ? ketQuaCho.stTruoc : st;

  // D379 — cộng thêm vế "vòng này đã chốt rồi": bịt cửa sổ hở khi vòng không có khoảnh khắc.
  const dangBan = nop.isPending || choDienXong || vongDaChot.current === st.vong;
  const soTheChon = chonTS.length + (chonCT ? 1 : 0);
  /*
   * D447 — TIỀN MẶT SAU CÁC LỆNH ĐANG XẾP, cho ngăn ngân hàng. Lúc CHỐT server mở hợp đồng tiết kiệm SAU chuỗi lệnh, trên
   * tiền còn lại — nên "bán rồi gửi" trong một vòng là hợp lệ, nhưng ngăn cũ tính trên tiền mặt HIỆN CÓ (ví 0 ⇒ khoá gửi).
   * Đường vòng cũ là bấm KHỚP NGAY cho tiền về trước; nút ấy đã bỏ. Tính bằng CHÍNH hàm xem trước của shop (một nguồn).
   */
  const tienMatSauLenh = tienMatSauLenhDangXep(b, lenhNhap, chonCT);

  /*
   * ─── LÕI VỐN — ĐIỀU KIỆN HIỆN PANEL ────────────────────────────────────────
   *
   * Cần CẢ BA: trận bật luật (`balance_version` v6 trở lên) VÀ catalog có đủ hai
   * bảng giá. Thiếu bảng giá thì panel TỰ ẨN chứ không được đoán số rồi vẫn cho
   * bấm — frontend và API deploy bằng hai lệnh riêng, nên "API cũ hơn bundle" là
   * trạng thái bình thường, và niêm yết một con số bịa còn tệ hơn không có nút.
   */
  const giaDao = c.dao_danh_muc;
  const giaKhoa = c.khoa_tai_san;
  const khoaVon = b.khoa ?? null;
  /*
   * Trận NAV: panel Quản trị vốn ẨN HẲN (founder 01/08: "bỏ phần phân bổ vốn
   * ở ngoài bàn cược... đa số thao tác phải trong shop"). Đảo danh mục đã chết
   * chính thức trên nav (nav_dung_lenh); KHOÁ tài sản sẽ về shop cùng thẻ Đầu
   * Tư Dài Hạn (spec 02) — ghi nợ ở doc 05.
   */
  const hienQuanTriVon = b.luat_von === true && !!giaDao && !!giaKhoa
    && !b.da_chay && b.tu_the === 'choi' && b.nav === undefined;

  /**
   * Mã khoá được = danh mục ∪ lá tài sản đang chọn mua vòng này.
   *
   * Lá đang chọn có mặt vì engine chạy `apKhoaTaiSan` SAU `mua` — khoá được đúng
   * lá vừa lấy ở quầy. Bỏ vế đó là vòng 1 (chưa cầm gì) không bao giờ khoá được,
   * dù luật cho phép.
   */
  const maKhoaDuoc = [...new Set([
    ...b.danh_muc.tai_san,
    ...(loaiVongNay === 'tai_san' ? chonTS : []),
  ])];

  /*
   * BỎ VÒNG Ở VÒNG CHỐT = PHÁ CAM KẾT, và cả ba nhánh của sheet bỏ bài đều tính.
   * Engine chấm theo "có bỏ bài không", không theo nhánh nào — nên cảnh báo phải
   * đứng trên cả ba, không nhét vào một nút.
   */
  const phaCamKetKhiBo = khoaVon?.la_vong_chot && giaKhoa
    ? {
      ma: c.tai_san.find((x) => x.id === khoaVon.ma)?.label ?? khoaVon.ma,
      phat_bp: giaKhoa.PHAT_BE_KEO_BP,
      thu_hoi_bp: khoaVon.thuong_da_nhan_bp,
      giam_vong: giaKhoa.GIAM_VON_SO_VONG,
    }
    : null;

  /*
   * ── SẮP HẾT GIỜ (founder 09/08) ──────────────────────────────────────────
   *
   * Điều kiện phải TRUNG THỰC — viền đỏ nghĩa là *"còn kịp, làm nhanh lên"*,
   * nên nó chỉ được sáng khi người chơi THẬT SỰ còn nước để đi:
   *  · `dhNeo?.dh` — trận cũ không có đồng hồ thì không bịa hạn (nếp D38);
   *  · `!tam_dung` — màn tập đang hứa "TẠM DỪNG ∞", giục là nói dối (D53);
   *  · `!het_gio` — hết rồi thì đồng hồ đã ghi HẾT GIỜ; nháy đỏ vĩnh viễn là
   *    nhắc mãi một chuyện đã xong, đúng lý lẽ `.het` đứng yên trong CSS;
   *  · `!xong && !daAllIn` — dồn hết vốn rồi thì chỉ còn ngồi xem board chạy
   *    (D40), giục một người không còn nút nào để bấm là gây bực suông.
   * NGƯỠNG dùng chung với mặt đồng hồ (`NGUONG_GAP_S`) — hai số rời nhau là có
   * lúc viền đỏ mà đồng hồ còn xanh, và người chơi không biết tin cái nào.
   */
  const sapHetGio = !!dhNeo?.dh && !dhNeo.dh.tam_dung && !dhNeo.dh.het_gio
    && !xong && !daAllIn && conNguoc > 0 && conNguoc <= NGUONG_GAP_S;

  return (
    <KhungMinigameCtx.Provider value={st?.dong_ho_minigame === true}>
    {/*
     * ⚠ CẢ BÀN KHÔNG CÒN RUNG. Lịch sử hai bước, ghi để không ai nối lại nhầm:
     * 27/07 rung bị gỡ khỏi `nhayDo` ("vòng này lỗ nặng") và gắn vào chữ ALL-IN
     * toàn màn ("chẳng khớp tý nào" — hai sự kiện khác hẳn); 22/08 chữ ALL-IN
     * toàn màn bị gỡ hẳn, nên nhịp để bám cũng hết. Rung nay chỉ còn ở nơi có
     * cú chạm thật: nút chip trong shop.
     */}
    <div
      ref={banRef}
      style={{ '--vua': vua } as CSSProperties}
      className={[s.banDau, nhipTim ? s.nhipTim : ''].filter(Boolean).join(' ')}
      // D398 — bước hiện tại của nhịp kết quả: móc cho bài canh và ảnh chụp dòng thời gian (không vẽ gì).
      data-buoc-kq={buocKq}
    >
      <NhayDo hien={nhayDo} />
      <VienGapGio hien={sapHetGio} khan={conNguoc <= NGUONG_KHAN_S} />
      {hangDoi.length > 0 && (
        <MomentOverlay hangDoi={hangDoi} onXong={khoanhKhacXong} art={art} />
      )}
      {/*
        MÀN CHÀO VAI — 5s, một lần mỗi trận, chỉ ở vòng 1 và chỉ khi trận CÓ vai
        (map ≥ 12; map 8 là mẫu đối chứng thuần nên không có vai — D107).
        ⚠ Đứng SAU `MomentOverlay` trong cây nhưng z-index thấp hơn: hai lớp phủ
        không bao giờ chồng nhau ở đời thật (chào ở vòng 1 trước cú chốt đầu
        tiên), nhưng nếu có thì khoảnh khắc phải thắng — nó là thứ vừa xảy ra.
      */}
      {!daChaoVai && st.vong === 1 && b.vai && vaiBang?.[b.vai] && (
        <ChaoVai
          vai={{
            id: b.vai,
            ten: vaiBang[b.vai]!.ten,
            dacQuyen: vaiBang[b.vai]!.dac_quyen,
            caiGia: vaiBang[b.vai]!.cai_gia,
            heSoVon: vaiBang[b.vai]!.he_so_von,
          }}
          onXong={() => { setDaChaoVai(true); setChaoVaiPha(null); }}
          /*
           * 12/09 — pha CHIA VAI: cả bàn nhận lá vai trước, rồi mới tới vai của
           * mình. Avatar của mình đi qua `GheAvatarKet` (cần `useMe`, tường lửa D24)
           * nên truyền từ đây thay vì để ChaoVai tự gọi. Bàn tập ĐÓNG BĂNG ở đây
           * (founder 12/09) — Oracle giới thiệu vai trên chính màn này.
           */
          doiThu={st.doi_thu}
          {...(st.dem_vai ? { demVai: st.dem_vai } : {})}
          vaiBang={vaiBang}
          avatarToi={<GheAvatarKet loai="nguoi" ten="Bạn" laToi size={32} />}
          dongBang={laManTap}
          onPha={setChaoVaiPha}
        />
      )}

      {/* ── Dải trạng thái ── */}
      <div className={s.strip}>
        {/* Thoát giữa trận phải đi qua hỏi xác nhận: từ 20/07 thoát = ĐẦU HÀNG
            = thua và mất hạng, nên lỡ tay bấm là mất cả ván. */}
        {!xong && (
          <button
            type="button"
            className={s.nutThoat}
            onClick={() => setHoiThoat(true)}
            aria-label="Thoát trận"
          >
            ✕
          </button>
        )}
        {/*
          ⚠ Chữ "ROUND" gỡ 23/08. Đo ở 375px: thêm nhãn loại vòng vào hàng này
          làm nó XUỐNG DÒNG, cao 45 → 74px — tức gọn được ở dải lịch bao nhiêu
          thì đội lại ở đây bấy nhiêu. Và nó là chữ thừa theo đúng nghĩa: "4/12"
          cạnh một cái đồng hồ thì không ai đọc thành gì khác. (Kèm: nó là chữ
          Anh duy nhất còn sót ở đầu bàn — D26 đặt giọng tiếng Việt.)
        */}
        {/*
          D376 — CON SỐ TO NHẤT MÀN PHẢI THEO `vongHienThi`, không theo `st.vong`.
          Đây chính là "VÒNG 4/12 ← đồng hồ" trong bản founder chốt 22/09. Nhãn Oracle
          đổi một mình thì vẫn còn hai con số vòng trên màn — tức chưa chữa gì.
          ⚠ CHỈ hai chỗ này đổi (số to + nhãn Oracle). BẢN ĐỒ và BẢNG ĐIỆN TỬ vẫn đọc
          `st.vong` CÓ CHỦ Ý: chúng đang hiện DỮ LIỆU của vòng đang chơi (`o_hien_tai`,
          báo giá, dự báo), nên dán nhãn vòng trước lên đó là đổi một lời nói dối lấy
          một lời nói dối to hơn — mislabel nội dung thật. Chỗ khớp nốt mâu thuẫn ấy là
          v53 (D373: ô của vòng ÚP lại, ô vừa lật mang dấu VỪA LẬT ✓) — đúng thứ founder
          vẽ trong bản chốt, và nó chờ gate G1 bàn 16.
          ⚠ Mặt đồng hồ bên cạnh đang mang nhãn ĐỌC/QUYẾT nên cặp "VÒNG 4 · ĐỌC" đọc
          ra đủ nghĩa: giây đang đếm là của vòng sau, và nhãn ĐỌC nói ra điều đó.
        */}
        <span className={s.v} data-vong-man>{vongHienThi}</span>
        {/* D443 — cỡ theo thang (`.kTong`), không gõ số inline. */}
        <span className={`${s.k} ${s.kTong}`}>/ {st.tong_vong}</span>
        {/*
          LOẠI VÒNG dời lên đây 23/08. Trước đó nó là ô nở ra giữa dải lịch
          ("4 LÁ"), và chính dải đó vừa thu còn vạch màu để trả lại 15px cho bàn.
          Đặt cạnh số vòng là đúng chỗ: "vòng mấy" và "vòng này làm gì" là MỘT
          câu hỏi, mà mắt vốn đã ở đây để xem đồng hồ.
        */}
        {/*
          D376 — theo `vongHienThi` cùng con số bên cạnh. Chính chú thích trên đã nói
          "vòng mấy" và "vòng này làm gì" là MỘT câu hỏi, nên để hai thứ nói hai vòng
          khác nhau là tự cãi nhau trong đúng một hàng chữ.
          ⚠ Khác bản đồ/bảng điện tử ở chỗ: đây là một NHÃN suy thuần từ số vòng
          (`nhip` + danh sách vòng kỳ ngộ), không phải dữ liệu sống của vòng đang chơi —
          nên đổi theo được mà không mislabel gì.
        */}
        {nhip.length > 0 && (
          <span className={s.loaiVong} data-loai-vong>
            {loaiVong(nhip, vongHienThi, (st.ky_ngo?.lan ?? []).map((l) => l.vong))}
          </span>
        )}
        {/*
          * ĐỒNG HỒ VÒNG (D38) — trong DẢI TRẠNG THÁI, tức LUÔN HIỆN ở đầu màn
          * trận, không cuộn mất, không thu gọn được (D25/R1).
          *
          * Đây là chỗ đúng vì đồng hồ là ràng buộc của CẢ vòng, ngang hàng với
          * "vòng mấy trên mấy" và "Quỹ vòng bao nhiêu" — không thuộc riêng khối
          * mua thẻ hay khối cam kết. Nhét vào một trong hai khối là nó biến mất
          * đúng lúc người chơi cuộn xuống khối kia.
          *
          * Ẩn khi trận đã đóng: server không gửi `dong_ho` nữa (xem
          * `trangThaiCongKhai`), và client KHÔNG bịa một đồng hồ thay thế.
          */}
        {/*
          * ⭐ D401 — CỤM PHẢI: đồng hồ + GIẢI là MỘT khối không tự xuống dòng (`.cumPhai`). Đo ở 375px (soi màn thật
          * 24/09): "QUYẾT 35s" + thanh 46px + hộp GIẢI là quá hàng ⇒ GIẢI rơi xuống dòng hai, cả bàn tụt 30px — đúng
          * cú giật D398 vừa dẹp. Khối co bằng THANH đồng hồ (26px như demo, co tới 12px khi chật — vòng hai chữ số ·
          * "KỲ NGỘ" · giải 6–7 chữ số sau một cú tất tay), không bằng cách đẩy GIẢI xuống dòng.
          */}
        <span className={s.cumPhai}>
        {!xong && dhNeo?.dh && (
          <>
            <span className={s.sep} />
            {/*
              Rà đồng hồ 08/08 — đọc từ KÊNH NEO `dhNeo`, không đọc `st.dong_ho`:
              `st` bị giữ lại suốt overlay khoảnh khắc nên ảnh đồng hồ trong nó
              luôn trễ đúng bằng thời lượng diễn (xem chú thích tại `dhNeo`).
              Mốc `nhanLuc` thay luôn vai của `key={st.vong}` cũ (bản vá 27/07):
              mỗi response một dấu mới nên hai vòng liên tiếp cùng thời lượng
              không còn làm effect đứng im — có test khoá ở dongho.test.tsx.
            */}
            <span data-tap="dong-ho" className={s.oDongHo}>
              <DongHoVong
                conLaiS={dhNeo.dh.con_lai_s}
                tongS={dhNeo.dh.tong_s}
                hetGio={dhNeo.dh.het_gio}
                pha={dhNeo.dh.pha}
                docS={dhNeo.dh.doc_s ?? 0}
                tamDung={dhNeo.dh.tam_dung === true}
                lyDo={dhNeo.dh.ly_do}
                nhanLuc={dhNeo.luc}
              />
            </span>
          </>
        )}
        {/*
          * Founder 02/08 — KHỐI THỐNG KÊ (QUỸ VÒNG · NAV · TIỀN MẶT) GỠ KHỎI
          * ĐÂY: "bỏ phần trong ảnh đi và cho vị trí hiển thị người chơi và đối
          * thủ lên trên". Số không mất, chỉ dời về đúng chỗ đọc:
          *   · NAV của mình = trên chính ghế BẠN ở dải bên dưới (cùng thước
          *     với mọi ghế khác — so sánh được, đúng việc người chơi làm);
          *   · TIỀN MẶT = trong SHOP, nơi duy nhất tiêu nó;
          *   · QUỸ VÒNG = chân bảng kết quả mỗi lần chốt (ChainReveal).
          * Dải này chỉ còn ba thứ thuộc về CẢ VÒNG: thoát · vòng mấy · đồng hồ
          * (D38 — đồng hồ vẫn luôn hiện, không thu gọn).
          * ⭐ D401 — và thứ tư: GIẢI VÒNG (quỹ vòng thành một cái hũ nhìn thấy, cuối hàng). Xem `giai` ở trên.
          */}
        {giai && (
          <span data-tap="giai-vong" className={s.oGiai}>
            <GiaiVong
              so={giai.so}
              pha={giai.pha}
              tuSo={giai.tuSo}
              gheNop={giai.gheNop}
              traVe={giai.traVe}
              lan={giai.lan}
              giamChuyenDong={itMotion}
              laXu={giaiLaXu}
            />
          </span>
        )}
        </span>
      </div>

      {/* Trợ lý màn tập — spotlight cầm tay chỉ việc, chỉ khi vào từ MÀN TẬP. */}
      {laManTap && (
        <CoachTap
          vong={st.vong}
          tongVong={st.tong_vong}
          /*
           * D376 — NHÃN đọc vòng đang hiển thị, còn `vong` (thứ lái BƯỚC DẠY) giữ nguyên
           * `st.vong`. Hai vai khác nhau: đóng băng cái lái bước là bước dạy chạy lại,
           * đúng họ lỗi "trợ lý chết câm" đã trả giá nhiều lần.
           */
          vongNhan={vongHienThi}
          // D336 — sổ đã-qua lưu theo trận: nạp lại trang không bắt nghe lại bước đã nghe.
          khoaLuu={matchId}
          // D336 lượt 2 — dải hai phe trong khung thoại: art + phe từ catalog, mức từ tờ (!) (server đã cắt bp).
          taiSanTap={c.tai_san.map((t) => ({ id: t.id, label: t.label, nhom: t.nhom, svg: art[t.id] }))}
          tuDienTap={c.tu_dien?.tai_san}
          shopMo={shopMo}
          bangMo={daMoBang}
          bangDangMo={bangDangMo}
          shopChonMa={chonTS.length === 1}
          shopCoLenh={lenhNhap.length > 0}
          coKetQua={!!ketQuaCho && !choDienXong && !dangDienKq}
          // Sân khấu (nhịp kết quả D398 · lớp phủ khoảnh khắc) là màn diễn của trò — trợ lý đứng ngoài.
          sanKhau={choDienXong || dangDienKq || nop.isPending}
          tinGiaLo={!!ketQuaCho?.tt.ket_qua_vong?.tin_gia_lo}
          kyNgoMo={kyNgoMo}
          kyNgoDaMo={kyNgoDaTuMo.current === st.vong}
          /*
            13/09 — BA CỜ DẠY ĐÚNG LÚC. Đọc thẳng từ dữ liệu vòng, không suy lại luật:
            client không được tự đoán khi nào đám đông bẻ ô (C4) — server đã gửi `doi`
            trên chính ô đã lật, `telegraph` cho ô kế, và mắt xích chuỗi cho trượt giá.
          */
          oVuaDoi={(() => {
            const ds = st.lich_su_o ?? [];
            return ds.length > 0 && ds[ds.length - 1]?.doi !== undefined;
          })()}
          coTinTruoc={!!st.telegraph}
          coChenChuc={(ketQuaCho?.tt.ket_qua_vong?.cua_ban?.chain ?? []).some(
            (m) => m.kind === 'crowding' || m.kind === 'hoan_truot' || m.kind === 'khoa_giam_truot',
          )}
          loaiVongNay={loaiVongNay}
          xong={xong}
          // D376 — mở shop là đã bước sang vòng mới ⇒ nhãn thôi đóng băng.
          onMoShop={(mo) => { setShopMo(mo); if (mo) { setDaXemShop(true); xongDocKq(); } }}
          // 16/08 — coach nói ĐÚNG đồng hồ đang hiện (D53: bốn vòng đầu màn tập
          // TẠM DỪNG). Số đọc từ catalog, coach không gõ tay.
          vongTamDungDen={c.quyet_dinh.MAN_TAP_MIEN_GIO_DEN_VONG}
          // 16/08 — ba mốc "đã làm" để coach CHỜ TAY (không nút TIẾP): mở VÌ SAO ·
          // chọn lá ở vòng lá · mở chip 🏦 lãi suất.
          moLyDo={moLyDo}
          // 12/09 — trợ lý đóng tấm VÌ SAO khi bước kế cần chạm nút ở thanh tay
          // cầm (tấm `fixed` che kín đáy màn). Xem `Buoc.lyDo`.
          onMoLyDo={setMoLyDo}
          chonLoi={chonCT !== null}
          daDocTo={daDocTo}
          toMo={toMo}
          tamMo={tamShop}
          onMoTam={setTamShop}
          moLaiSuat={moLX}
          // 07/09 — bàn 12 ô: chờ chào vai xong rồi mới dạy, và biết kỳ ngộ
          // đang mời/đã chọn để dắt đúng lúc (VIỆC 2, chỉ nối dây — không đụng
          // logic vai/kỳ ngộ đã có).
          chaoVaiXong={b.vai && vaiBang?.[b.vai] ? daChaoVai : undefined}
          chaoVaiPha={chaoVaiPha}
          kyNgoMoi={!!(st.ky_ngo?.moi && st.ky_ngo.moi.length > 0)}
          kyNgoDaChon={chonKyNgo !== null}
          /*
           * 09/09 (D319) — NGÂN HÀNG: chỉ nối dây, cờ do server quyết (C4).
           * `c.tiet_kiem` vắng ⇒ trận không có ngân hàng (luật trước v43) ⇒ trả
           * `undefined` để bước tự ẩn, KHÔNG trả `false`: "không có cơ chế" và
           * "có nhưng đang đóng" là hai câu khác nhau, và chỉ vắng mặt nói được
           * câu thứ nhất (cùng luật đã áp cho `tiet_kiem_bao_gia` ở D317).
           */
          nganHangMo={c.tiet_kiem ? b.tiet_kiem_duoc === true : undefined}
          chonGui={chonTK?.vong === st.vong && chonTK.mo !== null}
          // D527 — trận tập khung minigame ⇒ kịch bản minigame (cờ trận, không hằng bàn tập — trận tập v54 dở giữ kịch bản cũ).
          minigame={st.dong_ho_minigame === true}
          coChoTrait={!!choTrait && choTrait.vong === st.vong}
        />
      )}

      {/*
        ── M4 · LỊCH TRÌNH VÒNG + M3 · LĂNG KÍNH DANH MỤC (D90, 17/08) ────────
        Hai dải mỏng ngay dưới dải trạng thái, LUÔN HIỆN (D25/R1 — thứ nuôi
        quyết định thì không được thu gọn). Lịch nói CẤU TRÚC ván (vòng nào có
        chợ / có lá / kỳ ngộ), không nói NỘI DUNG ô; lăng kính nói danh mục
        mình ĐANG LÀ GÌ, không gợi ý nên là gì (A10 + D85 §1.2).
      */}
      {/*
        ⚠⚠ LĂNG KÍNH + LỊCH VÒNG ĐÃ GỠ (D184, founder khoanh đỏ trên ảnh chụp).
        Chúng nói cùng một câu hỏi *"tôi đang đứng ở đâu"* với khối TAY ở đáy
        màn, chỉ khác đơn vị và khác chỗ — mà "một câu hỏi, nhiều chỗ trả lời,
        mỗi chỗ một mẫu số" đúng là bệnh D114 sinh ra để chữa.
        · phân bổ danh mục  → nay đọc bằng CỌC CHIP trên từng mã ở khối TAY;
        · `SoNhipVong`      → DỜI xuống khối TAY (nó là cửa DUY NHẤT tới bảng
          VÌ SAO — D119; gỡ theo lăng kính là chôn mất bảng đó).
        THANH PHONG CÁCH ở lại: nó đo THÀNH TÍCH, không đo danh mục.
      */}
      {/* 13/09 — THANH PHONG CÁCH dời xuống KHUNG NAV cuối màn (founder: "phần chấm
          điểm này cũng là core design, phải để nó ở chỗ nổi bật… gộp luôn vào phần
          NAV"). Ở đây nó đứng dưới dải đối thủ, 22px, mắt lướt qua. Xem `.foot`. */}

      {/* ── Cả bàn — LÊN ĐẦU MÀN (founder 02/08) ──
          Người chơi + đối thủ là thứ nhìn đầu tiên; ghế BẠN mang NAV cùng
          thước với đối thủ (R1: dải luôn hiện, không thu gọn). */}
      <div className={s.pnl} data-tap="ban">
        <div className={s.bd}>
          <DoiThuStrip
            doiThu={(stSo ?? st).doi_thu}
            vongTruoc={vongTruoc}
            tenTaiSan={Object.fromEntries(c.tai_san.map((t) => [t.id, t.label]))}
            ban={{
              // NAV, không phải tiền mặt: đối thủ đã hiện NAV (server đặt
              // `von := navCua`), ghế mình hiện tiền mặt là hai thước trên
              // cùng một hàng — đúng lỗi "all-in xong trông như sắp cháy".
              von: bSo.nav ?? bSo.von,
              so_the: b.danh_muc.tai_san.length + b.danh_muc.chien_thuat.length,
              bac_rank: 'Bạn',
              ...(b.vai ? { vai: b.vai } : {}),   // VAI (22/08) — server cấp
              // 13/09 — tấm chi tiết của CHÍNH mình phải nói cùng ngôn ngữ với ghế đối thủ:
              // hạng phong cách (cùng thang) và danh mục của mình (không qua luật che).
              ...((stPc ?? st).phong_cach ? { phong_cach_hang: (stPc ?? st).phong_cach!.hang } : {}),
              tai_san: b.danh_muc.tai_san,
              con_song: !bSo.da_chay,
              // Ghế mình cháy/sáng cùng luật với đối thủ — server suy, không tự tính
              fx: bSo.fx,
              // v55 (D409) — nấc lửa của mình, cùng bước PHONG CÁCH với thanh (đối thủ đọc `lua_nac` server gửi).
              ...((stPc ?? st).ban.lua ? { lua_nac: (stPc ?? st).ban.lua!.nac } : {}),
              /*
               * v32 — icon con đường của CHÍNH mình. Suy từ `lan[]` chứ không
               * từ `chonKyNgo` (state đang bấm dở): icon là thứ CẢ BÀN thấy,
               * nên nó chỉ được xuất hiện sau khi lựa chọn ĐÃ CHỐT ở server.
               * Lấy kỳ ngộ GẦN NHẤT đã chọn — cùng luật với `conDuongCuaGhe`.
               */
              ...(() => {
                const l = [...(st.ky_ngo?.lan ?? [])].reverse().find((x) => x.chon);
                const nv = l && c.nhiem_vu_ky_ngo?.find((x) => x.id === l.chon);
                return nv ? { ky_ngo_icon: nv.icon } : {};
              })(),
            }}
          />
        </div>
      </div>

      {/*
        * ── BA TẦNG CỨNG (founder 02/08) ───────────────────────────────────────
        * "3 thứ bắt buộc trong khung hình mà không phải lướt: Player · Thẻ bài
        * thị trường · +/- lãi lỗ ở dưới cùng." Nên thứ tự là: cả bàn (trên) →
        * THỊ TRƯỜNG (giữa, thẻ đang lật tự cuộn vào tầm mắt) → khối kết quả
        * chi tiết ngay dưới map → hàng lãi/lỗ GHIM ĐÁY trong `.thanhDay`
        * (không bao giờ rời khung hình, kể cả đang cuộn).
        */}
      <div className={s.pnl} data-tap="map">
        {/*
          Founder 08/08: header THU CÒN MỘT DÒNG. Founder 23/08 (khoanh đỏ trên
          ảnh bàn đấu): thu tiếp — **bỏ nhãn "THỊ TRƯỜNG"**, và **gộp CHƯƠNG HỒI
          vào chính hàng này**.
          · Nhãn thừa: ngay dưới nó là các thẻ thị trường, không ai nhầm được.
          · Trước đó tên hồi chiếm một hàng RIÊNG (24px) ở giữa bàn, và câu mô tả
            của nó bị cắt cụt ở 375px ("chưa thành chuyệ…") — tức đã hỏng sẵn:
            một câu kể chuyện đọc không hết thì không kể được gì. Giữ TÊN hồi
            (nó là nhãn trạng thái chợ, ngắn và đọc được), bỏ câu mô tả.
          Hai hàng 33 + 24px thành một hàng.
        */}
        <div className={s.hdr}>
          <ChuongHoi
            lichSuO={stBan.lich_su_o}
            oHienTai={stBan.o_hien_tai}
            xuHuong={stBan.xu_huong}
            moiTruong={stBan.lai_suat?.moi_truong}
            gon
          />
          <span className={s.nhanNho}>
            còn {stBan.bo_bai_con_lai.con_lai} ô · {stBan.bo_bai_con_lai.so_su_kien} tin
            {stBan.bo_bai_con_lai.the_luon_that ? '' : ` · ~${stBan.bo_bai_con_lai.tin_gia_ky_vong} giả`}
          </span>
        </div>
        <div className={s.bd}>
          {/*
            D443 — hàng chip LÃI SUẤT · SỔ và nút BẢNG ĐIỆN TỬ đã DỜI XUỐNG thanh đáy (founder 28/09: *"Những gì user
            ko thao tác được (Ngoại trừ avatar đối thủ) Thì hiện ở trên, những gì cần thao tác như bảng điện tử thì hiện
            ở dưới"*). Khối này chỉ còn thứ để XEM: bản đồ + dải sáu mã. Bảng lãi suất + sổ liên hệ mở thành NGĂN KÉO
            ngay trên thanh đáy (cạnh nút đã mở nó).
          */}
          {/* Chương hồi (doc 06 §2 — món 1): tên đoạn đang chơi, suy TỪ
              thông tin công khai (ô đã lật + chuỗi xác nhận + môi trường).
              Mọi người cùng bàn thấy CÙNG một chương — không ai có thêm gì. */}
          {/*
            ─── v32 KỲ NGỘ (doc 06 §1) ─────────────────────────────────────
            Đặt NGAY TRÊN chương hồi vì hai thứ kể cùng một câu chuyện: chương
            là đoạn đang chơi, kỳ ngộ là mốc chia hồi. Người chơi đọc "đang ở
            SÓNG GIÓ" rồi ngay dưới là "chọn con đường cho phần còn lại".
          */}
          {st.ky_ngo?.moi && c.nhiem_vu_ky_ngo && (
            <KyNgoThanh
              dangChon={chonKyNgo}
              bang={c.nhiem_vu_ky_ngo}
              onMo={() => setKyNgoMo(true)}
            />
          )}
          {kyNgoMo && st.ky_ngo?.moi && c.nhiem_vu_ky_ngo && (() => {
            const ch = chuongHoi(st.lich_su_o, st.o_hien_tai, st.xu_huong, st.lai_suat?.moi_truong);
            const dh = dhNeo?.dh;
            const dongHo = dh
              ? (dh.tam_dung === true ? 'ĐỒNG HỒ TẠM DỪNG' : dh.het_gio ? 'HẾT GIỜ' : `CÒN ${Math.max(0, conNguoc)}s`)
              : undefined;
            return (
              <KyNgoPhu
                moi={st.ky_ngo!.moi!}
                bang={c.nhiem_vu_ky_ngo!}
                dangChon={chonKyNgo}
                onChon={(id) => setChonKyNgo((cu) => (cu === id ? null : id))}
                tenHoi={ch.ten}
                phuHoi={ch.phu}
                dongHo={dongHo}
                onDong={() => setKyNgoMo(false)}
              />
            );
          })()}
          {/*
            CHIP TIẾN ĐỘ — đứng suốt phần còn lại của trận. Vẽ MỌI lần kỳ ngộ
            đã chọn (map 16 có hai), theo đúng thứ tự vòng.
          */}
          {st.ky_ngo && c.nhiem_vu_ky_ngo && st.ky_ngo.lan.some((l) => l.chon) && (
            <div className={s.hangChip}>
              {st.ky_ngo.lan.filter((l) => l.chon).map((l) => (
                <KyNgoChip
                  key={l.vong}
                  nv={c.nhiem_vu_ky_ngo!.find((x) => x.id === l.chon)}
                  tienDo={l.tien_do}
                  xong={l.xong_o_vong !== null}
                  tenDacQuyen={c.nhiem_vu_ky_ngo!.find(
                    (x) => x.id === l.chon)?.ten_dac_quyen ?? null}
                />
              ))}
            </div>
          )}
          {/* CHƯƠNG HỒI đã dời LÊN hàng đầu khối này (founder 23/08) — xem chú
              thích ở đó. Nó thôi chiếm một hàng riêng giữa bàn. */}
          <MarketMap
            daLat={daLatBan}
            hienTai={stBan.o_hien_tai}
            vong={stBan.vong}
            tongVong={stBan.tong_vong}
            conLai={stBan.bo_bai_con_lai.con_lai}
            art={art}
            giaiDoan={c.giai_doan}
            suKien={c.su_kien}
            telegraph={stBan.telegraph}
            oLich={stBan.o_lich}
            xuHuong={stBan.xu_huong}
            xuHuongNen={stNen.xu_huong ?? null}
            // D442 — suốt nhịp kết quả (và khoảnh khắc) hiệu ứng nền dịu + đứng: không tranh tiêu điểm với bước đang diễn.
            dangDien={dangDienKq || choDienXong}
            chinhSach={stBan.chinh_sach}
            upO={stBan.up_o === true}
            // v55 (D409) — trait đọc bản đồ: SƯƠNG MÙ (lá cũ mờ) · NỘI GIÁN (loại lá kế) · MÙ TIN (không huy hiệu, không
            // gạch thiên hướng). REEL (lật kiểu slot) đã bỏ ở D588.
            loaiLaKe={stBan.ban.loai_la_ke}
          />
          {/*
            12/09 (Q3 — LIÊN KẾT NHÌN THẤY) — DẢI THỊ TRƯỜNG: cả SÁU mã, kể cả mã
            không cầm, ngay DƯỚI bản đồ và trong CÙNG khung: ô vừa lật ở trên là
            "cái kéo", sáu lá ở dưới là "thứ bị kéo", cùng nhích một nhịp khi cửa
            sổ lật đóng. Trước chốt dải đứng yên (M.2). Dữ liệu = lợi suất công
            khai ex-post `thi_truong_vong` (không β). Founder 12/09: *"hiển thị cả
            6 mã cùng lúc trong trận … bằng hình ảnh/hiệu ứng thay vì chữ"*.
          */}
          <DaiThiTruong
            la={c.tai_san.map((t) => ({
              id: t.id, ten: t.label, nhom: t.nhom, svg: art[t.id],
              chipDay: maCamTay.find((m) => m.ma === t.id)?.chipDay ?? 0,
            }))}
            thiTruong={ketQuaCho?.tt.ket_qua_vong?.thi_truong_vong}
            keo={(() => {
              const o = ketQuaCho?.tt.ket_qua_vong?.o;
              if (!o || o.kind !== 'su_kien') return null;
              const tc = o.tinh_chat;
              return {
                icon: tc !== undefined ? TC_ICON[tc] : undefined,
                ten: tc !== undefined
                  ? (TC_TEN[tc] ?? tc)
                  : (c.su_kien.find((x) => x.id === o.su_kien)?.label ?? o.su_kien),
                mau: mauCuaO(o),
              };
            })()}
            vong={ketQuaCho?.tt.ket_qua_vong?.vong ?? 0}
            nhich={nhichLa}
            thanhKhoan={ketQuaCho?.tt.ket_qua_vong?.thanh_khoan_vong}
            coThuoc={st.thanh_khoan_nam_nac === true}
          />
        </div>
      </div>

      {/*
        ⭐⭐ KHỐI CHI TIẾT — CHỈ BUNG KHI CHẠM, KHÔNG CÒN NGOẠI LỆ NÀO TỰ MỞ.
        Founder 23/08: *"Toàn bộ phần ở ảnh 1 thu nhỏ lại chỉ còn 1 con chữ …
        bấm vào thì mới hiện ra nguyên nhân và nó sẽ cứ lấp láy nhẹ ở đó nếu
        không được bấm vào"*.

        ⚠ BA NGOẠI LỆ TỰ MỞ (D114) ĐÃ GỠ — nhưng KHÔNG phải bằng cách vứt tin.
        Cả ba vốn tự mở vì chúng là thứ người chơi không suy được từ một con số;
        nay mỗi cái có đường đi riêng, TO HƠN chỗ cũ:
        · `tin_gia_lo` → BĂNG-RÔN TOÀN MAP (đúng chỉ thị founder cùng lượt) —
          trước đây nó nằm im trong bảng VÌ SAO, và băng-rôn thì chỉ bắn khi ô
          VỪA LẬT là sự kiện, tức cú bóc tin giả thường rơi vào nhánh KHÔNG bắn;
        · `tu_dong` và `siet_cua_ban` → con số LẤP LÁY MẠNH và đổi màu, tức lời
          mời chạm rõ hơn hẳn một vòng thường (`SoNhipVong.gap`).
        ⇒ Không tin nào bị chôn; chúng chỉ thôi CHIẾM CẢ MÀN để tự kể.
      */}
      {/*
        ⭐ 24/08 — CHI TIẾT NAY LÀ TẤM TRƯỢT TỪ ĐÁY, KHÔNG BUNG TẠI CHỖ.
        Founder: *"khi bấm vào sẽ hiện 1 màn hình thể hiện chi tiết lí do, thay
        thế cho chức năng hiển thị cũ"*, và chốt dạng *"trượt từ dưới lên, bấm
        vào 30% còn lại để nó thụt xuống"*.

        Nội dung BÊN TRONG giữ nguyên từng dòng — đây là đổi CHỖ ĐỨNG, không
        phải viết lại thứ được nói. Cái được lợi: `fixed` nên mở/đóng không đẩy
        bố cục bàn một pixel nào (bản cũ bung tại chỗ và làm cả trang nhảy đúng
        lúc người chơi đang đọc số), và 30% trên vẫn thấy ô vừa lật + đồng hồ.
      */}
      {/*
        ⚠ KHỐI NÀY LUÔN Ở LẠI trong luồng, kể cả lúc tấm trượt đang mở.
        Bản đầu để nó ở nhánh `else` của tấm trượt ⇒ mở tấm là khối biến mất và
        cả trang NGẮN LẠI 86px (đo trên stack). Tức đúng cú nhảy bố cục mà việc
        chuyển sang `fixed` sinh ra để tránh — chỉ là nhảy ở chỗ khác.
      */}
      {/*
        ⚠ KHỐI "Chọn bài ở SHOP rồi chốt phiên — lãi lỗ và lý do hiện ngay đây"
        ĐÃ GỠ (D184, founder khoanh đỏ: *"nhất là cái (lãi lỗ hiện ngay đây)"*).
        Nó chiếm một khối ngang màn để nói một câu hướng dẫn mà khối TAY ở đáy
        đã nói bằng chính hình dạng của nó — nút SHOP nằm ngay cạnh thứ nó mở,
        nút CHỐT VÒNG nằm ngay cạnh thứ nó chốt. Hướng dẫn bằng BỐ CỤC rẻ hơn
        hướng dẫn bằng câu, và không tốn một hàng nào.
      */}

      {ketQuaCho?.tt.ket_qua_vong && !choDienXong && daToiBuoc(buocKq, 'lai_lo') && moLyDo && (
        <>
        <button
          type="button"
          className={s.viSaoNen}
          onClick={() => { setMoLyDo(false); xongDocKq(); }}
          aria-label="Đóng bảng vì sao"
        />
        <div
          className={s.viSaoTam}
          data-tap="ketqua"
          role="dialog"
          aria-label={`Vì sao vòng ${nhipVong?.vong ?? st.vong} lãi lỗ`}
        >
        <div className={s.viSaoNam} aria-hidden />
          {/*
            ⭐ D373 — TẤM NÀY THUỘC VỀ VÒNG NÀO, và Ô NÀO vừa lật ra nó.
            Founder 21/09: *"sao lại hiển thị ở round trước?"*. Bàn đã sang vòng kế khi tấm
            bung ra, nên không có mốc nào neo con số vào vòng đã đóng. Một dòng, đọc một nhịp.
          */}
          <div className={s.viSaoVong}>
            KẾT QUẢ VÒNG {nhipVong?.vong ?? st.vong}
            {(() => {
              const o = ketQuaCho.tt.ket_qua_vong.o;
              // D422 — ô che (MÙ TIN) / ô sương (SƯƠNG MÙ): nói đúng thứ người mang lá thấy, không tên lá thật.
              const ten = o.kind === 'che' ? 'TIN BỊ CHE'
                : o.kind === 'suong' ? 'SƯƠNG MÙ'
                  : o.kind === 'su_kien'
                    ? c.su_kien.find((x) => x.id === o.su_kien)?.label
                    : c.giai_doan.find((x) => x.id === o.giai_doan)?.label;
              return ten ? <> · <span className={s.viSaoVongO}>{ten}</span></> : null;
            })()}
          </div>
          {/*
            * D38 — VÒNG NÀY BỊ CHỐT HỘ VÌ HẾT GIỜ. Phải nói, và nói ở ĐÂY.
            *
            * Cùng lý do với khối phí ngay dưới: người chơi vừa mất một lượt quyết
            * định: thẻ không mua được, cam kết không vào. Im lặng thì họ chỉ thấy
            * "sao chẳng có gì xảy ra" và học ra bài học sai — một hình phạt nạn
            * nhân không nhận ra là hình phạt chỉ gây bực chứ không dạy được gì.
            *
            * Cờ do SERVER gửi (`tu_dong`), client KHÔNG tự suy từ đồng hồ của mình:
            * server còn ân hạn, nên "đồng hồ tôi về 0" ≠ "tôi đã mất lượt" (C4).
            */}
          {ketQuaCho.tt.tu_dong && (
            <div className={s.phi} role="status">
              <span className={s.phiNhan}>HẾT GIỜ</span>
              <span className={s.phiSo}>GIỮ NGUYÊN</span>
              <span className={s.phiVi}>
                vòng này chốt hộ theo vị thế cũ — không lấy thẻ, không đổi cam kết
              </span>
            </div>
          )}
          {/*
            * D342 — CHUỖI LỆNH CỦA VÒNG NÀY BỊ BÁC. Cùng khuôn dòng HẾT GIỜ ngay trên và cùng lý do:
            * server bác nguyên chuỗi (kể cả lệnh hợp lệ đi kèm) nên vị thế đứng yên, và người chơi
            * chỉ thấy "sao không đổi gì". Trận founder 16/09: bốn vòng như thế, không một chữ.
            */}
          {ketQuaCho.tt.loi_von?.lenh && (
            <div className={s.phi} role="alert" data-testid="loi-lenh-vong">
              <span className={s.phiNhan}>LỆNH KHÔNG KHỚP</span>
              <span className={s.phiSo}>GIỮ NGUYÊN</span>
              <span className={s.phiVi}>{chuLoiLenh(ketQuaCho.tt.loi_von.lenh)}</span>
            </div>
          )}
          {/*
            * PHÍ CỦA MÌNH — nói NGAY, nói RÕ VÌ SAO.
            *
            * Đo trên trận thật: cắt lỗ trừ 950 (phí gấp đôi vì cả bàn cùng chạy)
            * mà màn hình KHÔNG nói một chữ nào — người chơi chỉ thấy Vốn tụt.
            * `web/src` trước 25/07 không có một dòng nào đọc `phi_dung_ngoai` /
            * `phi_cat_lo`, dù docstring engine ghi rõ "phải trả ra để UI cho
            * thấy". Mất tiền mà không biết vì sao thì không học được gì, và đó
            * đúng là thứ chỉ đạo feedback-clarity cấm.
            */}
          {ketQuaCho.tt.ket_qua_vong.phi_cua_ban && (
            <div className={s.phi} role="status">
              <span className={s.phiNhan}>
                {/* ✂ và 🪑 gỡ 26/07: cả hai là emoji do font hệ điều hành vẽ,
                    và nhãn đã nói đúng loại phí nên icon chỉ là chữ thứ hai. */}
                {ketQuaCho.tt.ket_qua_vong.phi_cua_ban.loai === 'cat_lo'
                  ? 'PHÍ CẮT LỖ' : 'PHÍ ĐỨNG NGOÀI'}
              </span>
              <span className={s.phiSo}>
                −{dinhDangChip(ketQuaCho.tt.ket_qua_vong.phi_cua_ban.mat)}
              </span>
              <span className={s.phiVi}>
                {ketQuaCho.tt.ket_qua_vong.phi_cua_ban.giam_dap
                  ? `GẤP ĐÔI — ${Math.round(
                    ketQuaCho.tt.ket_qua_vong.ty_le_cat_lo_bp / 100)}% cả bàn cùng chạy một cửa`
                  : ketQuaCho.tt.ket_qua_vong.phi_cua_ban.loai === 'cat_lo'
                    ? 'giữ tiền mặt + bán gấp cả danh mục'
                    : 'lạm phát bào vốn đang đóng băng'}
              </span>
            </div>
          )}
          {/*
            * v42 (D313) — HAI DÒNG TIỀN MỚI, cùng khuôn `phi_cua_ban` ngay trên và
            * cùng lý do đã ghi ở đó: một khoản tiền chạy vào/ra ví mà màn không kể
            * được thì người chơi đọc nó là "NAV tự nhúc nhích".
            *
            * COUPON là khoản DUY NHẤT ở khối này CỘNG vào ví, nên nó mang dấu **+**
            * — đọc nhầm nó thành phí là hiểu ngược cả bài học của lá Trái phiếu Mỹ
            * ("trả bạn tiền đều trong khi GIÁ của nó vẫn có thể rơi").
            * ⚠ Dùng lại nguyên bốn lớp của khối phí (`phi`/`phiNhan`/`phiSo`/`phiVi`),
            * KHÔNG thêm lớp mới: đây là một dòng dữ liệu trong danh sách đã có, không
            * phải một bố cục mới — nên nó không phải qua cửa demo A11.25.
            */}
          {(ketQuaCho.tt.ket_qua_vong.coupon_cua_ban ?? []).some((c) => c.tien > 0) && (
            <div className={s.phi} role="status">
              <span className={s.phiNhan}>COUPON TRÁI PHIẾU</span>
              <span className={s.phiSo}>
                +{dinhDangChip((ketQuaCho.tt.ket_qua_vong.coupon_cua_ban ?? [])
                  .reduce((t, c) => t + c.tien, 0))}
              </span>
              <span className={s.phiVi}>lãi vào tiền mặt, không cộng vào giá</span>
            </div>
          )}
          {/* D498 — PHÍ QUẢN LÝ của Tổ Chức: một dòng dữ liệu cùng khuôn COUPON ngay trên, không bố cục mới (cùng lý lẽ: không qua cửa demo). */}
          {(ketQuaCho.tt.ket_qua_vong.quan_ly_cua_ban?.tien ?? 0) > 0 && (
            <div className={s.phi} role="status" data-khoi="phi-quan-ly">
              <span className={s.phiNhan}>PHÍ QUẢN LÝ · TỔ CHỨC</span>
              <span className={s.phiSo}>+{dinhDangChip(ketQuaCho.tt.ket_qua_vong.quan_ly_cua_ban!.tien)}</span>
              <span className={s.phiVi}>phần NAV vào tiền mặt, bất kể lời lỗ</span>
            </div>
          )}
          {/* v46 (D338) — LÃI VAY ĐÒN BẨY: một dòng dữ liệu cùng khuôn COUPON ngay trên, không bố cục mới. */}
          {(ketQuaCho.tt.ket_qua_vong.lai_vay_cua_ban?.lai ?? 0) > 0 && (
            <div className={s.phi} role="status">
              <span className={s.phiNhan}>LÃI VAY ĐÒN BẨY</span>
              <span className={s.phiSo}>
                −{dinhDangChip(ketQuaCho.tt.ket_qua_vong.lai_vay_cua_ban!.lai)}
              </span>
              <span className={s.phiVi}>
                vay {dinhDangChip(ketQuaCho.tt.ket_qua_vong.lai_vay_cua_ban!.vay)} ·{' '}
                {(ketQuaCho.tt.ket_qua_vong.lai_vay_cua_ban!.lai_bp / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%
                /ô — tiền rẻ thì vay rẻ
              </span>
            </div>
          )}
          {/*
            * v43 (D317) — SỔ TIẾT KIỆM, cùng khuôn và cùng lý do hai khối trên.
            *
            * ⚠ HUỶ để RIÊNG và để TRƯỚC hai dòng kia: nó là khoản duy nhất ở đây
            * do CHÍNH cú bấm của người chơi đốt đi, và nếu chỉ để NAV tụt thì họ
            * thấy mình nghèo đi mà không biết vì sao. Đó đúng là lớp lỗi D67, và
            * server mới trả trường này ra ở D317 — trước đó nó nằm im trong engine.
            */}
          {(ketQuaCho.tt.ket_qua_vong.tiet_kiem ?? []).some((x) => x.loai === 'huy') && (
            <div className={s.phi} role="status">
              <span className={s.phiNhan}>HUỶ SỔ TRƯỚC HẠN</span>
              <span className={s.phiSo}>
                −{dinhDangChip((ketQuaCho.tt.ket_qua_vong.tiet_kiem ?? [])
                  .reduce((t, x) => t + (x.lai_mat ?? 0), 0))}
              </span>
              <span className={s.phiVi}>lãi treo mất sạch — gốc thì về đủ</span>
            </div>
          )}
          {/*
            * v54 (D405) — SỔ CHỊU NỀN KINH TẾ: hai dòng cùng khuôn ngay trên, chỉ hiện khi server trả loại tương ứng
            * (cờ tắt ⇒ không bao giờ có). Không có hai dòng này thì sổ tụt mà không ai nói vì sao — đúng lớp lỗi của
            * dòng HUỶ ở trên (D317). `mat` âm ở LẠM PHÁT = tin giả lộ, sổ được trả ngược ⇒ dấu cộng.
            */}
          {(ketQuaCho.tt.ket_qua_vong.tiet_kiem ?? []).some((x) => x.loai === 'lam_phat') && (() => {
            const mat = (ketQuaCho.tt.ket_qua_vong.tiet_kiem ?? [])
              .filter((x) => x.loai === 'lam_phat').reduce((t, x) => t + (x.mat ?? 0), 0);
            return (
              <div className={s.phi} role="status" data-dong-so="lam_phat">
                <span className={s.phiNhan}>LẠM PHÁT ĂN SỔ</span>
                <span className={s.phiSo}>{mat >= 0 ? '−' : '+'}{dinhDangChip(Math.abs(mat))}</span>
                <span className={s.phiVi}>tiền gửi cũng mất giá như tiền mặt — lãi thấp hơn lạm phát là lỗ thật</span>
              </div>
            );
          })()}
          {(ketQuaCho.tt.ket_qua_vong.tiet_kiem ?? []).some((x) => x.loai === 'do_vo') && (
            <div className={s.phi} role="status" data-dong-so="do_vo">
              <span className={s.phiNhan}>NGÂN HÀNG ĐỔ VỠ</span>
              <span className={s.phiSo}>
                −{dinhDangChip((ketQuaCho.tt.ket_qua_vong.tiet_kiem ?? [])
                  .filter((x) => x.loai === 'do_vo').reduce((t, x) => t + (x.mat ?? 0), 0))}
              </span>
              <span className={s.phiVi}>chuỗi tin xấu làm dân rút tiền — phần gửi vượt hạn mức bảo hiểm bị cắt</span>
            </div>
          )}
          {(ketQuaCho.tt.ket_qua_vong.tiet_kiem ?? []).some((x) => x.loai === 'dao_han') && (
            <div className={s.phi} role="status">
              <span className={s.phiNhan}>SỔ ĐÁO HẠN</span>
              <span className={s.phiSo}>
                +{dinhDangChip((ketQuaCho.tt.ket_qua_vong.tiet_kiem ?? [])
                  .filter((x) => x.loai === 'dao_han')
                  .reduce((t, x) => t + x.goc + x.lai, 0))}
              </span>
              <span className={s.phiVi}>gốc và lãi về ví — tiền dùng được trở lại</span>
            </div>
          )}
          {(ketQuaCho.tt.ket_qua_vong.tiet_kiem ?? []).some((x) => x.loai === 'lai') && (
            <div className={s.phi} role="status">
              <span className={s.phiNhan}>LÃI TIẾT KIỆM</span>
              <span className={s.phiSo}>
                +{dinhDangChip((ketQuaCho.tt.ket_qua_vong.tiet_kiem ?? [])
                  .filter((x) => x.loai === 'lai').reduce((t, x) => t + x.lai, 0))}
              </span>
              <span className={s.phiVi}>đã tính vào tổng tài sản — huỷ sớm là mất</span>
            </div>
          )}
          {(ketQuaCho.tt.ket_qua_vong.coupon_cua_ban ?? []).some((c) => c.khong > 0) && (
            <div className={s.phi} role="status">
              <span className={s.phiNhan}>COUPON TRẢ CHO SỔ KHỐNG</span>
              <span className={s.phiSo}>
                −{dinhDangChip((ketQuaCho.tt.ket_qua_vong.coupon_cua_ban ?? [])
                  .reduce((t, c) => t + c.khong, 0))}
              </span>
              <span className={s.phiVi}>khống trái phiếu thì bạn trả lãi cho chủ tờ</span>
            </div>
          )}
          {ketQuaCho.tt.ket_qua_vong.tien_mat_cua_ban
            && ketQuaCho.tt.ket_qua_vong.tien_mat_cua_ban.mat !== 0 && (
            <div className={s.phi} role="status">
              <span className={s.phiNhan}>
                {ketQuaCho.tt.ket_qua_vong.tien_mat_cua_ban.mat < 0
                  ? 'LẠM PHÁT ĂN TIỀN MẶT' : 'DƯ ÂM LẠM PHÁT HOÀN LẠI'}
              </span>
              <span className={s.phiSo}>
                {ketQuaCho.tt.ket_qua_vong.tien_mat_cua_ban.mat < 0 ? '−' : '+'}
                {dinhDangChip(Math.abs(ketQuaCho.tt.ket_qua_vong.tien_mat_cua_ban.mat))}
              </span>
              <span className={s.phiVi}>
                {ketQuaCho.tt.ket_qua_vong.tien_mat_cua_ban.chi_tiet.some((x) => x.dao)
                  ? 'tin đồn lộ ra là giả — trả lại phần đã ăn'
                  : 'ôm tiền mặt không né được lạm phát'}
              </span>
            </div>
          )}
          {/* v34 — SIẾT PHÁP LÝ: cái giá của vai đội lái, nói ngay cạnh phí. */}
          {ketQuaCho.tt.ket_qua_vong.siet_cua_ban && (
            <div className={s.phi} role="status" data-testid="siet-phap-ly">
              <span className={s.phiNhan}>SIẾT PHÁP LÝ</span>
              <span className={s.phiSo}>
                −{dinhDangChip(ketQuaCho.tt.ket_qua_vong.siet_cua_ban.mat)}
              </span>
              <span className={s.phiVi}>đội lái ôm vị thế to đúng ô pháp lý — phạt thẳng vốn</span>
            </div>
          )}
          {/* ── §7.3 — ĐỘ CHUẨN (Brier) ────────────────────────────────────
              Vòng phản hồi cho kỹ năng khó nhất của trò: cỡ vị thế theo độ
              tin. Trước đây không ai học được nó vì không ai ĐO được nó.

              ⚠ Đúng công thức A5.4 mà chợ dự báo dùng — hai nửa app nói cùng
              một ngôn ngữ kỹ năng, và nó là cột dữ liệu B2B đúng nghĩa (A1).
              ⚠ THẤP là tốt (0 = dồn đúng mã thắng, 2 = dồn đúng mã thua) nên
              câu chú thích phải nói ra, không để người chơi tự đoán chiều.
              ⚠ `null` = vòng toàn tiền mặt ⇒ KHÔNG hiện. Đứng ngoài không
              phải dự báo sai, nó là không dự báo — chấm điểm nó là bịa.
              ⚠ A3.8: hiện cho CHÍNH CHỦ, không dựng bảng đua. */}
          {typeof ketQuaCho.tt.ket_qua_vong.cua_ban?.brier === 'number' && (
            <div className={s.phi} role="status">
              <span className={s.phiNhan}>ĐỘ CHUẨN</span>
              <span className={s.phiSo}>
                {ketQuaCho.tt.ket_qua_vong.cua_ban.brier.toFixed(2).replace('.', ',')}
              </span>
              {/*
                D336 — nói "phần đã vào lệnh", không nói "tiền": Brier chấm trên VỊ THẾ, tiền mặt
                không vào phép chấm. Vòng 1 bàn tập cầm 25% Crypto, 75% tiền mặt mà câu cũ bảo
                "tiền nằm gần hết ở mã thua".
              */}
              <span className={s.phiVi}>
                {/* D402 — thước chỉ tính "trúng" ở mã LỜI NHẤT vòng (brier.ts). Chữ cũ nói "mã thua" ⇒ founder 25/09
                    thấy 2,00 khi mã mình cầm vẫn TĂNG 1,88% và hỏi "lỗi hiển thị hay logic" — số đúng, chữ sai. */}
                {ketQuaCho.tt.ket_qua_vong.cua_ban.brier < 0.5
                  ? 'càng gần 0 càng chuẩn — phần đã vào lệnh nằm đúng mã lời nhất vòng này'
                  : ketQuaCho.tt.ket_qua_vong.cua_ban.brier < 1.2
                    ? 'thang 0–2, thấp là tốt — phần đã vào lệnh rải hơi đều hoặc trật một phần'
                    : 'thang 0–2 — phần đã vào lệnh nằm gần hết NGOÀI mã lời nhất vòng này'}
              </span>
            </div>
          )}
          {/*
            ⚠ HEADLINE ĐÃ RỜI KHỎI ĐÂY 23/08 — con số lãi/lỗ vòng nay nằm ở mép
            phải hàng nhãn lăng kính, đầu màn (`SoNhipVong`), theo chỉ thị
            founder *"thu nhỏ lại chỉ còn 1 con số … đặt ở vị trí t khoanh đỏ"*.
            Giữ lại đúng NÚT ĐÓNG: khối này chỉ bung khi người chơi chạm con số
            đó, nên phải có đường đóng ngay trong khối — không thì muốn đóng lại
            phải cuộn ngược lên đầu màn.
          */}
          {/*
            ⚠⚠ NÚT NÀY PHẢI LÀ TOGGLE, KHÔNG PHẢI CHỈ-ĐÓNG (sửa 23/08). Bản đầu
            gán cứng `setMoLyDo(false)` + nhãn cứng "ẨN LÝ DO ▴", và nó CHẾT ở
            đúng BA CA TỰ MỞ (`tu_dong` · `tin_gia_lo` · `siet_cua_ban`): khối
            bung ra vì cờ ngoại lệ chứ không vì `moLyDo`, nên danh sách VÌ SAO
            vẫn ĐÓNG, nhãn nói ngược, `aria-expanded` báo sai, và bấm thì không
            có gì xảy ra. Ba ca đó chính là ba ca chú thích ở trên khai là quan
            trọng nhất — D26 §18.5 thủng đúng chỗ nó cần nhất.
            Ở vòng THƯỜNG hành vi không đổi một chút nào: khối chỉ tồn tại khi
            `moLyDo` bật, nên gạt về false vẫn làm cả khối biến mất như trước.
          */}
          <div className={s.pnlHead}>
          {/*
            ⭐ NÚT NÀY KHÔNG CÒN MANG NEO COACH (sửa 12/09) — nó nằm trong khối
            `… && moLyDo && (`, tức chỉ sống khi lý do ĐÃ mở, nên nó không bao giờ
            là thứ người chơi bấm ĐỂ mở. D312 (08/09) dời neo từ tấm sang nút này
            và tưởng đã xong, nhưng cả hai cùng đứng sau một cái cổng: bước
            `ketqua` vẫn rọi vào hư không suốt bốn ngày, và vì bước ấy chờ tay nên
            người chơi kẹt cứng (founder 12/09). Neo nay ở cụm số thanh tay cầm —
            xem `.cumViSao` ở prop `nhipPhai` của `TayBai`.
            ⚠ Bài canh cũ KHÔNG bắt được: nó chỉ hỏi "neo có tồn tại trong
            web/src không", không hỏi "lúc bước ấy chạy thì neo có đang được vẽ
            không". Bài mới (`coach_ban_tap` mục VI) canh đúng chỗ đó: neo phải
            NGOÀI cái cổng mà chính bước ấy có nhiệm vụ mở.
            ⚠ Chú thích để NGOÀI thẻ `<button>`: `mot_con_so.test.tsx` quét
            nguồn trong cửa sổ 200 ký tự sau `<button`, nhét một khối chú thích
            vào giữa là đẩy `onClick` ra khỏi tầm và bài ấy đỏ.
          */}
            <button
              type="button"
              className={s.nutLyDo}
              aria-expanded={moLyDo}
              onClick={() => setMoLyDo((x) => !x)}
            >
              {moLyDo ? 'ẨN LÝ DO' : 'VÌ SAO'}<i className={`${s.mui} ${moLyDo ? s.muiLen : ''}`} aria-hidden />
            </button>
          </div>
          {/*
            * Founder 01/08 (lần 2): "thu gọn nhưng phải GIỮ cái số +/-% nhảy
            * đỏ và neon, không phải ấn lý do mới thấy". Bản đầu gate CẢ
            * ChainReveal sau nút — tức giấu luôn con số neon đếm nhảy + chớp
            * sáng, hiệu ứng diễn cho không ai xem. Nay ChainReveal render
            * VÔ ĐIỀU KIỆN; thứ duy nhất thu sau nút là DANH SÁCH "VÌ SAO"
            * (`moChain`).
            */}
          <ChainReveal
            kq={ketQuaCho.tt.ket_qua_vong}
            deltaVon={ketQuaCho.tt.ban.von - ketQuaCho.vonTruoc}
            // D336 — CÙNG object con số ngoài bàn đọc: số to trong tấm = số % ngoài bàn.
            nhip={nhipVong ? { delta: nhipVong.delta, goc: nhipVong.goc } : null}
            taiSan={c.tai_san}
            chienThuat={c.chien_thuat}
            giaiDoan={c.giai_doan}
            suKien={c.su_kien}
            moChain={moLyDo}
            trait={ketQuaCho.tt.ban.trait ?? []}
          />
        </div>
        </>
      )}


      {/* THỊ TRƯỜNG đã dời LÊN TRÊN khối kết quả (founder 02/08 — ba tầng
          cứng: cả bàn → thẻ bài thị trường → lãi/lỗ ghim đáy). */}

      {/* Đối thủ đã DỜI LÊN ĐẦU MÀN cùng ghế mình (founder 02/08) — xem khối
          "Cả bàn" ngay dưới dải trạng thái. */}

      {/*
        * ── QUẢN TRỊ VỐN ──
        *
        * LUÔN HIỆN trên bàn, KHÔNG nhét vào lớp phủ quầy thẻ. Hai lý do:
        *   1. Tái cơ cấu mở cả ở vòng 7·8 — hai vòng KHÔNG có quầy thẻ. Nhét vào
        *      quầy là hai vòng cuối mất luôn cần gạt.
        *   2. Chu kỳ khoá đang chạy là thông tin phải thấy MỌI vòng: nó quyết định
        *      bỏ bài vòng này đắt hay rẻ. Giấu sau một cú bấm là giấu cái giá.
        */}
      {hienQuanTriVon && (
        <div className={s.pnl}>
          <div className={s.hdr}>
            <span className={s.hdrT}>QUẢN TRỊ VỐN <small>(CAPITAL DESK)</small></span>
          </div>
          <div className={s.bd}>
            <QuanTriVon
              danhMuc={b.danh_muc.tai_san}
              moiMa={c.tai_san}
              maKhoaDuoc={maKhoaDuoc}
              giaDao={giaDao}
              giaKhoa={giaKhoa}
              nhanGiaiDoan={(id) => c.giai_doan.find((x) => x.id === id)?.label ?? id}
              khoa={khoaVon}
              daoDuoc={b.dao_duoc === true}
              khoaDuoc={b.khoa_duoc === true}
              vonBiGiam={b.von_bi_giam === true}
              chonDao={chonDao}
              chonKhoa={chonKhoa?.vong === st.vong ? chonKhoa.ma : null}
              onChonDao={setChonDao}
              onChonKhoa={(ma) => setChonKhoa(ma ? { vong: st.vong, ma } : null)}
              shortDuoc={b.short_duoc === true}
              shortDangCo={b.short ?? null}
              shortKhop={b.short_khop ?? null}
              chonShort={chonShort}
              onChonShort={setChonShort}
              loi={st.loi_von ?? null}
              vohieu={dangBan}
            />
          </div>
        </div>
      )}

      {/* ── Cửa hàng (bật/tắt bằng icon ở thanh đáy) ── */}
      {hoiBo && (
        <SheetBoBai
          vongConLai={Math.max(0, st.tong_vong - st.vong)}
          conLaiCatLo={st.ban.con_lai_cat_lo}
          phaCamKet={phaCamKetKhiBo}
          /*
           * CẮT LỖ — NỘP TRỰC TIẾP, không đi qua lớp vòng-cược tuần tự.
           *
           * ⚠ Bản đầu của tôi chép y đường cũ (đường cược tuần tự cũ với nước
           * 'bo'). Đo trên trận thật: bấm xong `so_lan_cat_lo` VẪN 0 và Vốn TĂNG
           * 250 — tức người chơi không hề bỏ bài. Đường đó không đưa cú 'bo' tới
           * server; và vì "Đứng ngoài" cũ dùng ĐÚNG đường ấy, nghĩa là nút đó
           * cũng chưa bao giờ bỏ bài thật, suốt từ khi có nó.
           *
           * Hợp đồng API đã được chốt bằng test (`CẮT LỖ qua API`): nộp vòng với
           * `hanh_dong:'cat_lo'` + `cuoc:[{loai:'bo'}]` thì trừ quota, thu phí, và
           * tư thế giữ 'choi'. Gọi thẳng đúng thứ đó.
           */
          onCatLo={() => {
            setHoiBo(false);
            /*
             * v10 NAV — BỎ = BÁN SẠCH về tiền mặt (spec 01 §2.1): chuỗi bán ALL
             * mọi vị thế TRUYỀN THẲNG vào cú nộp (không qua setLenhNhap — state
             * async, body sẽ đọc giá trị cũ). Trận cũ giữ nước 'bo' như cũ.
             */
            const banSach = st?.ban.vi_the
              ? Object.keys(st.ban.vi_the).map((ma) => (
                { ma, chieu: 'ban' as const, moc_bp: 10000 }))
              : undefined;
            nopVong([{ loai: 'bo' }], 'cat_lo',
              banSach && banSach.length > 0 ? banSach : undefined);
          }}
          /*
           * ĐỨNG NGOÀI — đổi TƯ THẾ ghế, không chỉ bỏ một vòng. Phải nộp vòng
           * kèm `hanh_dong: 'dung_ngoai'`; gửi mỗi nước 'bo' như bản cũ là nhãn
           * hứa "ngồi xem tới hết trận" mà engine không làm gì.
           */
          onDungNgoai={() => { setHoiBo(false); nopVong([{ loai: 'bo' }], 'dung_ngoai'); }}
          /*
           * ĐẦU HÀNG — cũng phải NỘP LÊN SERVER trước khi rời màn. Bản cũ chỉ
           * `navigate` về sảnh: trận vẫn mở, tư thế vẫn 'choi', nên luật "đầu
           * hàng xếp bét bảng" không bao giờ chạy — và từ khi bàn đấu có địa chỉ
           * thì người chơi đi thẳng lại vào trận vừa "đầu hàng".
           */
          onDauHang={() => { setHoiBo(false); setHoiThoat(true); }}
          onHuy={() => setHoiBo(false)}
        />
      )}

      {hoiThoat && (
        <XacNhanThoat
          laTap={laManTap}
          onThoat={() => {
            setHoiThoat(false);
            // D336 lượt 2 — rời bàn tập giữa chừng LÀ bỏ qua: sảnh thôi dắt vào lại (founder 15/09).
            if (laManTap) danhDauQuaManTap('bo_qua');
            // GHI ĐẦU HÀNG LÊN SERVER rồi mới rời màn. Không ghi = trận vẫn mở
            // và người chơi quay lại được bằng chính URL vừa thoát.
            nopVong([{ loai: 'bo' }], 'dau_hang');
            navigate(ROUTE_ARENA);
          }}
          onHuy={() => setHoiThoat(false)}
        />
      )}

      {suKienNo && st.ket_qua_vong && (
        <SuKienBanner
          suKienId={suKienNo.id}
          chain={st.ket_qua_vong.cua_ban?.chain ?? []}
          taiSan={c.tai_san}
          suKien={c.su_kien}
          laTinGia={suKienNo.giA}
          {...(suKienNo.vongGoc !== undefined ? { vongGoc: suKienNo.vongGoc } : {})}
          onXong={() => setSuKienNo(null)}
        />
      )}

      {st.shop && shopMo && (
        <ShopManHinh
          onDocTo={(mo) => { setToMo(mo); if (mo) setDaDocTo(true); }}
          tam={tamShop}
          onTam={setTamShop}
          // D432 — màn chọn / bàn cược: bước sống qua đóng-mở shop (xem `daQuaChon`).
          buocChon={daQuaChon === st.vong ? 'ban' : 'chon'}
          onBuocChon={(buoc) => setDaQuaChon(buoc === 'ban' ? st.vong : null)}
          canTrait={choTrait && choTrait.vong === st.vong
            ? { can: tongDiemChon(chonTrait), soChon: chonTrait.length } : undefined}
          // D432 — founder 27/09: *"hiện lõi đang nắm và trait đang giữ"* ở chỗ trống của bàn cược (hàng TAY).
          traitDangGiu={b.trait}
          // D569 (founder 10/10) — thẻ VỪA LẬT ▸ ô SẮP LẬT trên nỉ shop, cùng dữ liệu + cùng chữ với `MarketMap` (o_lich ·
          // loai_la_ke · luật đếm ô D382) để hai nơi không nói hai câu. Lớp che của trait (MÙ TIN · SƯƠNG MÙ) giữ nguyên.
          theLat={(() => {
            const ls = st.lich_su_o;
            const upO = st.up_o === true;
            const o = upO ? ls[ls.length - 1] : (st.o_hien_tai ?? undefined);
            let vua: { svg: string; ten: string; mau?: string } | undefined;
            if (o?.kind === 'su_kien' || o?.kind === 'giai_doan') {
              const khoa = o.kind === 'su_kien' ? `sk_${o.su_kien}` : `gd_${o.giai_doan}`;
              const nhan = o.kind === 'su_kien'
                ? c.su_kien.find((x) => x.id === o.su_kien)?.label : c.giai_doan.find((x) => x.id === o.giai_doan)?.label;
              const mat = matLa(khoa);
              vua = { svg: art[khoa] ?? '', ten: mat?.ten ?? nhan ?? khoa, ...(mat ? { mau: HO_MAU[mat.ho].mau } : {}) };
            } else if (o?.kind === 'che') vua = { svg: '', ten: 'TIN BỊ CHE' };
            else if (o?.kind === 'suong') vua = { svg: '', ten: 'SƯƠNG MÙ' };
            const so = upO ? ls.length + 1 : st.vong + 1;
            const kyHop = st.o_lich?.includes(so) === true;
            const loai = kyHop ? undefined : st.ban.loai_la_ke?.[0];
            const sap = st.bo_bai_con_lai.con_lai > 0
              ? { so, glyph: kyHop ? '⚖' : loai === 'tin' ? 'TIN' : loai === 'pha' ? 'PHA' : '?', nhan: kyHop ? 'KỲ HỌP' : 'SẮP LẬT' }
              : undefined;
            return { vua, sap };
          })()}
          taiSanCat={c.tai_san}
          vong={st.vong}
          loaiVongNay={loaiVongNay}
          vongMoTiepTheo={vongMoTiepTheo}
          taiSan={st.shop.tai_san.map((id) => {
            const t = c.tai_san.find((x) => x.id === id);
            return {
              id, ten: t?.label ?? id, en: EN[id], svg: art[id], mau: mau(id, true),
              sao: Math.max(1, Math.min(5, Math.round((t?.bien_dong_bp ?? 200) / 100))),
            };
          })}
          chienThuat={st.shop.chien_thuat.map((id) => {
            const t = c.chien_thuat.find((x) => x.id === id);
            return {
              id, ten: t?.label ?? id, en: EN[id], svg: art[id],
              // D474 — khung minigame (v57): một câu của lá trong demo đã chốt; trận khác giữ mô tả catalog.
              mau: mau(id, false), nhan: (st.dong_ho_minigame === true ? LOI_MINIGAME_CHU[id as ChienThuatId]?.mt : undefined) ?? t?.mo_ta,
            };
          })}
          chonTS={chonTS}
          toiDaTaiSan={b.toi_da_tai_san_vong ?? 1}
          chonCT={chonCT}
          /*
           * D33 — chọn tối đa `toi_da_tai_san_vong` lá. Bấm lá đã chọn = bỏ
           * chọn; bấm lá mới khi đã đầy thì KHÔNG âm thầm thay lá cũ — quầy đã
           * vô hiệu hoá các lá chưa chọn, nên nhánh này chỉ còn là lưới chắn.
           */
          onChonTS={(id) => setChonTS((cu) => (
            cu.includes(id) ? cu.filter((x) => x !== id)
              : cu.length >= (b.toi_da_tai_san_vong ?? 1) ? cu : [...cu, id]))}
          onChonCT={doiCT}
          ganVao={ganVao}
          onGan={setGanVao}
          /*
           * Tra TỪ CATALOG (server), không gõ lại danh sách ở client.
           * Founder 01/08: chỉ lá `ghim` (server đánh dấu — ba lá engine thật
           * sự đọc mã gắn) mới hỏi "GẮN VÀO MÃ NÀO?"; lá chức năng thôi hỏi.
           * Vắng cờ (catalog cũ trong cache) ⇒ KHÔNG hỏi — hướng an toàn: gắn
           * là tuỳ chọn, không gắn thẻ vẫn chạy toàn danh mục như trước.
           */
          // D530 — lõi chỉ tác động trong màn ⇒ không lá nào nhắm mã (Đòn Bẩy nhân trong màn, không qua mã gắn).
          phamViThe={(id) => (st.loi_chi_trong_man !== true && c.chien_thuat.find((x) => x.id === id)?.ghim ? 'tai_san' : 'danh_muc')}
          // Founder 02/08 — thẻ ghim ĐANG CẦM đổi đích được mỗi vòng (D40).
          ganHienTai={st.ban.danh_muc.gan}
          doiGan={doiGan}
          onDoiGan={(the, ma) => setDoiGan((cu) => {
            // Bấm lại mã đang chờ = huỷ chờ; bấm mã khác = đổi đích.
            if (cu[the] === ma) {
              const { [the]: _, ...conLai } = cu;
              return conLai;
            }
            return { ...cu, [the]: ma };
          })}
          danhMuc={oDanhMuc}
          /*
           * 22/08 — đồng hồ NGAY TRÊN SHOP: shop là lớp phủ che cả mặt đồng hồ,
           * người chơi cân chip mà không biết còn mấy giây (founder: *"lúc mở shop
           * đ** thấy nháy gì nên không biết luôn"*). Cùng bộ đếm `conNguoc`.
           */
          dongHo={dhNeo?.dh ? {
            conLai: Math.max(0, conNguoc),
            hetGio: dhNeo.dh.het_gio,
            tamDung: dhNeo.dh.tam_dung === true,
          } : undefined}
          /*
           * v34 — VAI CỦA BẠN: chữ từ bảng vai của trận (`vaiBang`, server — D406), cờ từ `ban`
           * (mandate · dòng tiền · gắn đích phụ). Catalog cũ/trận không vai ⇒ vắng.
           */
          vai={b.vai && vaiBang?.[b.vai] ? {
            id: b.vai,
            ten: vaiBang[b.vai]!.ten,
            dacQuyen: vaiBang[b.vai]!.dac_quyen,
            caiGia: vaiBang[b.vai]!.cai_gia,
            ...(b.mandate ? { mandate: b.mandate } : {}),
            ...(b.dong_tien ? { dongTien: b.dong_tien } : {}),
            ...(b.gan_phu_duoc ? { ganPhuDuoc: true } : {}),
            ...(b.gan_phu_khi_mua ? { ganPhuKhiMua: true } : {}),
            ganPhuHienTai: b.danh_muc.gan_phu?.don_bay,
            doiGanPhu,
            onDoiGanPhu: (ma) => setDoiGanPhu((cu) => (cu === ma ? null : ma)),
          } : undefined}
          sucChuaTaiSan={c.luat.MAX_TAI_SAN}
          sucChuaChienThuat={c.luat.MAX_CHIEN_THUAT}
          art={art}
          chiPhiRoll={st.shop.chi_phi_lan_sau}
          // D411 — trận gộp ví: đổi bài và cuộn chợ trait chung MỘT ví xu (xem `lib/vi_xu.ts`).
          luotConLai={viDoiBai(b, giaCuonDaXem)}
          onRoll={khaoSatLai}
          /*
           * ✕ = "tôi muốn xem bàn" ⇒ THÔI giữ chỗ: vòng sau không trả shop lại.
           * Khác hẳn CHỐT VÒNG từ trong shop (ngay dưới) — người đó vẫn đang
           * làm việc trong shop, chỉ là đã xong vòng này.
           */
          onDong={() => { shopMoLucLat.current = false; setShopMo(false); }}
          onChotVong={b.nav !== undefined ? () => {
            // D430 — trait lệch cân: KHÔNG đóng shop (chợ nằm ngay trong đó); trả false để shop nhả khoá chốt.
            if (traitLechCan()) { chanTraitLech(); return false; }
            shopMoLucLat.current = true;
            setShopMo(false);
            void nopVong([], 'giu_vi_the');
            return true;
          } : undefined}
          canhBao={canhBao}
          vohieu={dangBan}
          daAllIn={b.tu_the === 'all_in'}
          tuDien={c.tu_dien}
          giaiDoanNhan={c.giai_doan}
          suKienNhan={c.su_kien}
          moTaChienThuat={(id) => c.chien_thuat.find((x) => x.id === id)?.mo_ta}
                  /*
           * v10 NAV — panel lệnh mốc. Bước mốc đọc từ catalog (server cấp),
           * mịn khi cầm Chia Lệnh — CLIENT chỉ bày nấc, server kiểm lại lúc áp.
           *
           * §4.5c (08/08) — "thẻ đang mở lại chẳng ảnh hưởng gì đến danh mục":
           * lá VỪA CHỌN (`chonCT`, chưa nộp) đã bày được đặc quyền, vì server
           * áp lá TRƯỚC khi giải lệnh trong cùng cú nộp (test API khoá). Riêng
           * KHỚP NGAY chạy trước cú nộp nên lệnh cần lá-chưa-nộp phải NHỐT nút
           * lại — xem `lenhCanLaChuaCam` bên lib.
           */
          /*
           * CAM KẾT GIỮ về SHOP (founder 17/08, D104): *"khóa tài sản là 1 lựa
           * chọn trong shop khi mua, ko phải thêm thao tác bắt buộc"*.
           * ⚠ Mọi cờ đọc từ SERVER (`khoa_duoc`, `khoa`) — C4. Client tự suy
           * điều kiện khoá là dựng nguồn chân lý thứ hai, và biểu hiện của việc
           * nó lệch là "nút vẫn sáng, bấm vào không có gì xảy ra".
           */
          khoa={b.luat_von === true && giaKhoa ? {
            duoc: b.khoa_duoc === true,
            dangChay: khoaVon
              ? {
                ma: khoaVon.ma,
                con_vong: khoaVon.con_vong,
                la_vong_chot: khoaVon.la_vong_chot === true,
              }
              : null,
            chon: chonKhoa?.vong === st.vong ? chonKhoa.ma : null,
            onChon: (ma: string | null) => setChonKhoa(ma ? { vong: st.vong, ma } : null),
            soVong: giaKhoa.SO_VONG,
          } : undefined}
          /*
           * v43 — NGÂN HÀNG. Dựng ở ĐÂY chứ không trong shop vì lệnh đi kèm
           * `POST /rounds`, nên chủ sở hữu state phải là màn nộp vòng (cùng lý do
           * `chonKhoa`/`chonDao` ngay trên). Shop chỉ đặt chỗ.
           *
           * ⚠ Điều kiện hiện CHỈ đọc cờ server, không suy lại một vế nào:
           * `tiet_kiem_bao_gia` vắng ⇒ API cũ hơn bundle (bình thường — hai lệnh
           * deploy riêng) ⇒ vùng không render, KHÔNG đoán số rồi vẫn cho bấm.
           *
           * ⚠ `mocBp` mặc định của thanh trượt do component giữ; ở đây chỉ neo
           * lựa chọn ĐÃ chốt vào số vòng.
           */
          /*
           * v55 (D409) — CHỢ TRAIT + CHỐT LỜI TRONG Ô. State ở màn nộp vòng vì cả hai đi kèm `POST /rounds`. Vắng ở trận
           * không cổng ⇒ shop y như cũ.
           * D430 (founder 26/09) — chợ đứng ở CHỖ HÀNG LÕI của shop, không còn tấm trượt: thẻ gọn hai hàng + hàng huy hiệu
           * "đang mang" ngay dưới (lá vừa chọn viền đứt "TỪ VÒNG n"). Không còn XONG — CHỐT VÒNG là cú nộp; lệch cân thì
           * `nopVong` chặn, mở shop và đổi `rungCan`.
           */
          // D526 — đổi lõi một lần mỗi vòng ở nhịp xen kẽ (server báo trần `doi_loi_toi_da`, server chặn lại ở cửa nộp).
          doiLoiHet={st.doi_loi_toi_da !== undefined && khaoSat >= st.doi_loi_toi_da}
          choTrait={choTrait && choTrait.vong === st.vong ? (
            <ChoTrait
              moc={choTrait.moi.moc}
              moi={choTrait.moi.moi}
              xu={viConLai(b, giaCuonDaXem)}
              lanCuon={choTrait.moi.lan_cuon}
              chon={chonTrait}
              onChon={(id) => { setKhopLoi(null); setChonTrait((cu) => (cu.includes(id) ? cu.filter((x) => x !== id) : [...cu, id])); }}
              vohieu={daAllIn || nop.isPending}
              dangMang={b.trait ?? []}
              vai={b.vai}
              rungCan={rungCanTrait}
              // D526 — nút ĐỔI TRAIT dưới ô XU của chợ (founder 05/10), không còn ở đáy màn chọn.
              nutCuon={(
                <NutCuonTrait
                  xu={viConLai(b, giaCuonDaXem)}
                  giaCuon={choTrait.moi.gia_cuon}
                  lanCuon={choTrait.moi.lan_cuon}
                  cuonToiDa={choTrait.moi.cuon_toi_da}
                  onCuon={cuonTraitLai}
                  dangCuon={cuonTrait.isPending}
                  vohieu={daAllIn || nop.isPending}
                />
              )}
            />
          ) : undefined}
          dongLenh={b.dong_lenh_ban ? Object.fromEntries(b.dong_lenh_ban.map((x) => [x.ma, x.muc])) : undefined}
          chotLoi={b.chot_loi_cho_phep && b.vi_the ? (
            <ChotLoi
              maDangGiu={Object.entries(b.vi_the).filter(([, v]) => v > 0).map(([m]) => m)}
              tenMa={(m) => c.tai_san.find((t) => t.id === m)?.label ?? m}
              choPhep={b.chot_loi_cho_phep}
              lenh={chonChotLoi?.vong === st.vong ? chonChotLoi.lenh : []}
              onDoi={(ma, l) => setChonChotLoi((cu) => {
                const ds = (cu?.vong === st.vong ? cu.lenh : []).filter((x) => x.ma !== ma);
                return { vong: st.vong, lenh: l ? [...ds, { ma, ...l }] : ds };
              })}
              vohieu={daAllIn || nop.isPending}
            />
          ) : undefined}
          nganHang={c.tiet_kiem && b.tiet_kiem_bao_gia !== undefined
            && st.ban.tien_mat !== undefined ? (
              <NganHang
                sauLenh={tienMatSauLenh !== null}
                tienMat={tienMatSauLenh ?? st.ban.tien_mat}
                hopDong={b.tiet_kiem ?? []}
                baoGia={b.tiet_kiem_bao_gia}
                guiDuoc={b.tiet_kiem_duoc === true}
                gocToiThieu={c.tiet_kiem.GOC_TOI_THIEU}
                buocMocBp={c.luat.BUOC_MOC_BP ?? 500}
                chonMo={chonTK?.vong === st.vong ? chonTK.mo : null}
                chonHuy={huyTK?.vong === st.vong ? huyTK.ids : []}
                onChonMo={(l) => setChonTK(l ? { vong: st.vong, mo: l } : null)}
                onChonHuy={(ids) => setHuyTK(ids.length > 0 ? { vong: st.vong, ids } : null)}
                {...(st.tiet_kiem_kinh_te ? { kinhTe: st.tiet_kiem_kinh_te } : {})}
              />
            ) : undefined}
          nav={st.ban.vi_the !== undefined ? {
            tienMat: st.ban.tien_mat ?? st.ban.von,
            viThe: st.ban.vi_the,
            // D446 — bộ tham số lệnh server áp, dùng NGUYÊN cho xem trước (+ lá lõi đang chọn, `laVuaChon`).
            ...tuyChonLenhChoShop(b.tuy_chon_lenh, chonCT),
            buocMocBp: b.danh_muc.chien_thuat.includes('chia_lenh')
              || chonCT === 'chia_lenh'
              ? (c.luat.BUOC_MOC_BP ?? 500)
              : (c.luat.BUOC_MOC_THO_BP ?? 2500),
            lenh: lenhNhap,
              // v55 (D409) — mốc MUA của ghế này (LỆNH MỊN thêm 10%) — server suy (C4).
              ...(b.moc_cho_phep ? { mocChoPhep: b.moc_cho_phep } : {}),
              sucCangDai: st.suc_cang_dai,
              viKhong: b.vi_the_khong,
              coBanKhong: b.co_ban_khong === true || chonCT === 'ban_khong',
              phiVoiVang: b.phi_voi_vang === true,
              tacDongGia: b.tac_dong_gia ?? 1,   // v34 — C4: cùng số server trừ
              /*
               * D342 — BA CỜ LÕI GIẢI LỆNH, trước đây KHÔNG cờ nào tới shop: `khong_theo_ma`
               * có trong DTO từ D311 mà không ai truyền (bản nháp mù sàn cấm khống),
               * `khong_theo_han_muc` và `von_quy_chieu` mới. Thiếu một cờ là bản nháp giải
               * khác server — "DANH MỤC SAU LỆNH" nói một số, tiền đi một số khác.
               */
              khongTheoMa: b.khong_theo_ma === true,
              khongTheoHanMuc: b.khong_theo_han_muc === true,
              ...(b.von_quy_chieu !== undefined ? { vonQuyChieu: b.von_quy_chieu } : {}),
              loiLenhVongTruoc: st.loi_von?.lenh ?? null,
              // v50 (D345) — bảng phí lệnh nhẹ + Khớp Nhanh: cùng cờ server áp.
              phiLenhNhe: b.phi_lenh_nhe === true,
              phiLenhBac: b.phi_lenh_bac === true,
              ...(b.phi_lenh_con_bp !== undefined ? { phiLenhConBp: b.phi_lenh_con_bp } : {}),
              ...(b.phi_lenh_sau_bp !== undefined ? { sauBp: b.phi_lenh_sau_bp } : {}),
              // v55 (D425) — SỔ MỎNG phí cố định · GÔNG CÙM phần bán còn được: bản nháp trừ/kiểm cùng số server (C4).
              ...(b.rang_buoc?.phi_co_dinh_lenh ? { phiCoDinhLenh: b.rang_buoc.phi_co_dinh_lenh } : {}),
              ...(b.rang_buoc?.tran_ban_con !== undefined ? { tranBanCon: b.rang_buoc.tran_ban_con } : {}),
              // v54 (D403) — trận không còn BỎ ⇒ shop có nút BÁN SẠCH (cờ của server, cùng nếp `up_o`).
              banSach: st.bo_bai_tat === true,
            // Luật gộp nằm ở `lib/lenh_moc` — 08/08 nó vá bug xung đột
            // mua/bán cùng mã (hai ý ngược nhau cùng nằm hàng đợi, engine chạy
            // cả hai). Đọc docstring ở đó trước khi đổi.
            onThem: (l) => { setKhopLoi(null); setLenhNhap((ds) => themLenhMoc(ds, l)); },
            onXoa: (i2) => { setKhopLoi(null); setLenhNhap((ds) => ds.filter((_, k) => k !== i2)); },
            // D447 — KHỚP NGAY đã bỏ; dòng lỗi dưới hàng lệnh (trait lệch cân…) giữ.
            khopLoi,
            // Bàn cược (16/08): đơn vị cọc = ¼ vốn khởi điểm (catalog); LẶP đọc
            // lá của vòng trước.
            startVon: c.luat.START_VON,
            lenhTruoc,
          } : undefined}
          />
      )}

      {/*
        * ── LÃI/LỖ + VÌ SAO ──
        *
        * Chỗ này TRƯỚC ĐÂY là khối "BỘ BÀI CỦA BẠN". Founder 20/07 chỉ ra nó
        * thừa: danh mục đã nằm sẵn trong màn shop rồi, hiện hai lần chỉ tổ
        * chiếm chỗ. Lấy lại khoảng trống đó để đặt kết quả vòng.
        *
        * Và đây không phải chuyện thẩm mỹ — nó vá một vi phạm R1 đang tồn tại:
        * ChainReveal vốn nằm CUỐI trang (~1.700px của trang 1.847px), nên
        * "vì sao lãi/lỗ" phải cuộn mới thấy, trái chỉ đạo feedback-clarity
        * "hiện RÕ + NGAY thắng/thua và VÌ SAO". Nay nó ở ngay tầm mắt.
        */}
      {/* ── Thanh cuối ── */}
      <div className={s.foot}>
        {/* 13/09 — hàng đầu của khung NAV là THANH PHONG CÁCH: điểm và tiền đứng
            chung một khung, cùng tầm mắt. Ẩn khi trận xong.
            D343 — hiện TỪ VÒNG 1: chưa đủ vòng thì xám, hạng là dấu ? (founder 16/09);
            trước đó thanh vắng tới vòng 4 rồi bật ra đẩy cả khung xuống. */}
        {!xong && thanhPC && (
          <div className={s.footPC}>
            <ThanhPhongCach pc={thanhPC.pc} chuaXep={thanhPC.chuaXep} lua={luaThanh} />
          </div>
        )}
        {/* v55 (D409) — KHAY TRAIT dưới thanh phong cách: huy hiệu đang mang (chữ ở lib/trait_chu.ts). Rỗng ⇒ không vẽ.
            D411 — XU thôi ở đây: nó là ô ví bên phải, thay chỗ VÀNG. */}
        {!xong && ((b.trait?.length ?? 0) > 0 || b.rang_buoc?.te_liet === true) && (
          <div className={s.footPC} data-tap="foot-trait">
            <KhayTrait
              trait={b.trait ?? []}
              teLiet={b.rang_buoc?.te_liet === true}
              gon
              {...(choTrait?.vong === st.vong ? { choSau: chonTrait } : {})}
            />
          </div>
        )}
        {/* ❤️ gỡ 26/07 vì HAI lý do chồng nhau: nó là emoji màu do font hệ điều
            hành vẽ, VÀ nó là ẩn dụ "thanh máu" mà D26 đã gạch khỏi từ vựng
            người chơi. Nhãn "VỐN HIỆN TẠI" ngay bên phải nói đúng thứ nó là. */}
        <div className={s.hpWrap}>
          {/* Trận nav: thước là TỔNG TÀI SẢN (founder 02/08) — tiền mặt có ô
              riêng bên cạnh vì nó là thứ còn tiêu được. */}
          <div className={s.nhanNho}>{b.nav !== undefined ? 'NAV · TỔNG TÀI SẢN' : 'VỐN HIỆN TẠI'}</div>
          {/*
            13/09 tối — NAV LÀ ĐIỂM NEO của cả màn: 26px vàng, một mình một bậc. Tiền mặt và
            vàng tụt xuống 13px xám ngay bên phải. Trước đó cả ba cùng 15px đậm nên mắt
            không biết nhìn đâu trước (brief founder: thiếu phân cấp thông tin).
          */}
          <div className={s.navSo}>
            {dinhDangChip(navChay)}{' '}
            <span className={s.navPhan}>({hp}%)</span>
          </div>
          {/*
            ⚠ THANH Ở ĐÂY ĐÃ GỠ 23/08 (founder: *"Nav tổng tài sản có thanh ở
            trên rồi đ** cần thanh ở dưới nữa"*). Bàn đấu đang vẽ HAI thanh cho
            cùng một đại lượng: LĂNG KÍNH trên đầu đã chia NAV thành ba đoạn
            (rủi ro · phòng thủ · tiền mặt), còn thanh này nói lại tổng của đúng
            ba đoạn đó dưới dạng % so vốn khởi điểm. Con số và `(155%)` giữ
            nguyên — thứ bỏ đi là hình vẽ nói lại một điều đã vẽ, không phải
            thông tin. `hp` vẫn nuôi con số %; `.hpBar`/`.hpFill`/`.hpThap` gỡ
            khỏi CSS vì không nhánh nào còn gọi tới (kể cả trận cũ không NAV).
          */}
        </div>
        {b.nav !== undefined && (
          <div className={s.oSo}>
            <div className={s.nhanNho}>TIỀN MẶT</div>
            <div className={s.soPhu}>
              <PixelIcon name="coin" size={8} className={s.iconDong} />
              {' '}{dinhDangChip(bSo.tien_mat ?? bSo.von)}
            </div>
          </div>
        )}
        {/* D411 — trận gộp ví (v55): VÀNG thôi là một đồng tiền riêng; ô này là XU, cùng ví với chợ trait (founder 26/09:
            "vàng kia là cái gì? Gộp với xu đi"). Trận cũ giữ nhãn VÀNG = lượt khảo sát như trước. */}
        <div className={s.oSo} data-tap={bSo.xu_gop === true ? 'xu' : undefined}>
          <div className={s.nhanNho}>{nhanVi(bSo)}</div>
          <div className={s.soPhu}>
            <PixelIcon name={bSo.xu_gop === true ? 'coin' : 'wallet'} size={16} className={s.iconDong} />
            {' '}{viDoiBai(bSo, giaCuonDaXem)}
          </div>
        </div>
        {/* D443 — MÃ ĐANG CẦM dời từ thanh đáy lên đây: chỉ để XEM, đứng ngay dưới NAV mà nó cộng thành. */}
        <div className={s.footCam}>
          {/* D472 — nút mở màn minigame (khoá v57) nằm TRONG dòng: bản nổi đè lên nút BỎ rồi lên chân shop. Không có nút ⇒ đúng bố cục cũ. */}
          {/* D533 — chờ màn của bàn mà lớp màn không mở: một dòng NÓI vì sao bàn đang khoá + còn bao lâu. Không phải nút (founder 06/10). */}
          {st.cho_man && manVong === null && choManMoc.current ? (
            <div className={s.hangMan}>
              <HangMaCam maCam={maCamTay} />
              <ChoManDong moc={choManMoc.current.moc} loi={st.loi_von?.lenh ? chuLoiLenh(st.loi_von.lenh) : null} />
            </div>
          ) : <HangMaCam maCam={maCamTay} />}
        </div>
      </div>

      {/* ── THANH HÀNH ĐỘNG GỌN (kiểu TFT) ── */}
      <div className={s.thanhDay}>
        {/*
          CÚ NỘP HỎNG PHẢI NÓI RA (rà mạng kém 11/08). `useNopVong` có onError
          gọi `dongBoLaiTuServer` nhưng KHÔNG vẽ gì — nên cú nộp hỏng biểu hiện
          y hệt cú nộp thành công đang chậm. Với lỗi CHƯA TỚI MÁY CHỦ thì nói
          thêm một câu quan trọng: "chưa gửi được" — vì đó là ca duy nhất người
          chơi bấm lại mà CHẮC CHẮN an toàn (server chưa nhận gì).
        */}
        {nop.isError && !nop.isPending && (
          <div className={s.nopLoi} role="alert">
            {nop.error instanceof ApiError && nop.error.chuaToiMayChu
              ? 'CHƯA GỬI ĐƯỢC — máy chủ không trả lời. Bấm CHỐT VÒNG lại nhé.'
              : (nop.error instanceof ApiError && nop.error.message)
                || 'Chốt vòng chưa xong — thử lại nhé.'}
          </div>
        )}
        {/*
          * ── LÃI/LỖ GHIM ĐÁY (founder 02/08 — tầng thứ ba của "ba tầng cứng") ──
          * Nằm TRONG .thanhDay (sticky) nên không bao giờ rời khung hình.
          * Trái = vòng gần nhất (lấy từ kết quả đang diễn hoặc kết quả đã áp
          * vào state — sống qua cả pha chọn bài của vòng sau); phải = danh mục
          * so vốn đầu trận. Chi tiết "VÌ SAO" vẫn ở khối kết quả dưới map.
          */}
        {/*
          ⚠ "DANH MỤC ±%" ĐÃ GỠ (D184, nằm trong khoanh đỏ dưới). Nó là con số
          thứ ba nói về cùng một ví: TỔNG TIỀN ở khối TAY nói mình đang có bao
          nhiêu, con số % vòng nói vừa được/mất bao nhiêu — thêm một tỷ lệ
          "cả trận so vốn đầu" là bắt người chơi tự chọn xem cái nào là thật.
          Mất gì: đường đọc nhanh "cả trận đang lãi hay lỗ". Nó quay lại ở màn
          KẾT TRẬN, nơi tổng cả trận mới là câu hỏi đúng.
        */}
        {/*
          ⚠ KHAY KÉO VỐN ĐÃ GỠ cùng hai nút poker. Nó chỉ hiện khi `dangTheo`,
          mà `dangTheo` chỉ do nút TĂNG CAM KẾT bật — nút đó không còn, nên giữ
          khay lại là giữ một khối JSX không đường nào tới được. Đúng bẫy số 1
          của repo này (đã gặp 9 lần), và lần này nó sẽ nằm ngay giữa màn chơi.

          `BetBar` bản thân nó KHÔNG bị xoá khỏi repo: founder chốt các mốc +
          ALL-IN sẽ quay lại ở chỗ đúng của nó — PHÂN BỔ VỐN VÀO MÃ.
        */}
        {/*
          ⚠ DẢI LƯỢT CƯỢC ĐÃ GỠ 11/08 — xem D81. Máy cược tuần tự chết từ D40
          (27/07) và khối này chưa bao giờ hiện được: `moVong()` — cửa duy nhất
          bật `dangDien`/`choBan` — không có một người gọi nào, nên cả ba điều
          kiện luôn falsy. Nó kéo theo `useVongCuoc`, hook `/luot`, và một bài
          test xanh vĩnh viễn.

          ⚠⚠ KHỐI NÀY TỪNG IN RA MÀN HÌNH NGƯỜI CHƠI (sửa 12/08). Lúc gỡ dải
          lượt cược tôi để lại `/* … *\/` TRẦN, không bọc `{}` — trong JSX thì
          đó không phải chú thích, đó là VĂN BẢN. Nguyên đoạn ghi chú kỹ thuật
          tiếng Việt nằm chình ình giữa màn đấu, ngay trên nút CHỐT VÒNG, suốt
          từ 11/08 tới khi founder chụp màn gửi.
          Không `tsc` nào bắt, không lint nào bắt, không test nào bắt — vì nó
          hợp lệ hoàn toàn: JSX được phép chứa chữ. Chỉ MẮT NGƯỜI mới bắt được,
          và đó chính là lý do phải soi màn thật chứ không chỉ chạy test.
        */}

        <TayBai
          /*
           * D443 — THANH ĐÁY = MỌI THỨ BẤM ĐƯỢC. Chip lãi suất + SỔ (thu nhỏ — founder: *"Thu nhỏ phần lãi suất và sổ
           * lại tý"*) ở hàng đầu, cạnh con số vòng; bảng lãi suất / sổ liên hệ mở thành NGĂN KÉO ngay trên hàng ấy, mỗi
           * lúc MỘT ngăn (mở cái này là cất cái kia). BẢNG ĐIỆN TỬ (bản gọn) đứng cạnh SHOP. ALL-IN: hàng nút nhường chỗ
           * cho dòng báo, hàng công cụ vẫn đứng (xem sổ / lãi suất / VÌ SAO vẫn được).
           */
          congCu={(
            <>
              {stBan.lai_suat && (
                <button
                  type="button"
                  className={`${s.lxChip} ${moLX ? s.lxChipMo : ''}`}
                  data-tap="lai-suat"
                  onClick={() => { setMoSo(false); setMoLX((v) => !v); }}
                  aria-expanded={moLX}
                >
                  🏦 <b>{(stBan.lai_suat.diem / 100).toFixed(2)}%</b>
                  {' '}{NHAN_MT[stBan.lai_suat.moi_truong] ?? ''}
                  <i className={`${s.mui} ${moLX ? s.muiLen : ''}`} aria-hidden />
                </button>
              )}
              {/*
                12/09 (Q3) — SỔ LIÊN HỆ: cái kéo nào đã sống qua ở trận đã xong. Mở được trước quyết định (trí nhớ
                của chính họ, không phải gợi ý — câu 4 founder chốt); mỗi cú MỞ ghi một dòng `cham_nut/so-lien-he` (C4).
              */}
              <button
                type="button"
                className={`${s.soChip} ${moSo ? s.soChipMo : ''}`}
                data-tap="so-lien-he"
                onClick={() => {
                  setMoLX(false);
                  setMoSo((x) => {
                    if (!x) ghiDo('cham_nut', { chi_tiet: { nut: 'so-lien-he' } });
                    return !x;
                  });
                }}
                aria-expanded={moSo}
                aria-label={moSo ? 'Cất sổ liên hệ' : 'Mở sổ liên hệ'}
              >
                SỔ<i className={`${s.mui} ${moSo ? s.muiLen : ''}`} aria-hidden />
              </button>
              {/*
                D561 — LÕI CHO MÀN, CHỌN TRƯỚC KHI LÁ LẬT (khoá v65; founder 07/10 chốt "chọn lõi TRƯỚC khi lật"): chip ở hàng công cụ, chạm để đổi
                vòng qua các lõi đang cầm (+ lõi vừa chọn mua). Chỉ ở vòng có màn. Màn của vòng không còn pha chọn lá.
              */}
              {st.loi_chon_truoc && (st.lich_man ?? []).includes(st.vong) && loiManDs.length > 0 && (
                <button
                  type="button"
                  className={s.soChip}
                  disabled={loiManDs.length < 2}
                  onClick={() => setLoiManChon(loiManDs[(loiManDs.indexOf(loiManVong ?? '') + 1) % loiManDs.length] ?? null)}
                  aria-label={`Lõi cho màn vòng này: ${tenLoiMan}${loiManDs.length > 1 ? '. Chạm để đổi' : ''}`}
                >
                  MÀN <b>{tenLoiMan}</b>
                </button>
              )}
            </>
          )}
          ngan={moLX && stBan.lai_suat ? (
            <div className={s.lxPanel}>
              <div className={s.lxDong}>
                LÃI SUẤT NỀN <b>{(stBan.lai_suat.diem / 100).toFixed(2)}%</b> ·{' '}
                <b>{NHAN_MT[stBan.lai_suat.moi_truong] ?? ''}</b>
              </div>
              <div className={s.lxPhu}>
                {'≤'}{(stBan.lai_suat.nguong_thap / 100).toFixed(2)}% tiền rẻ — dễ
                ra bong bóng, sổ lệnh dày hơn · {'≥'}
                {(stBan.lai_suat.nguong_cao / 100).toFixed(2)}% tiền đắt — dễ ra
                đổ vỡ tín dụng, sổ lệnh mỏng đi
              </div>
              {/*
                * v45 (D318) — LỢI SUẤT DÀI, thứ coupon Trái phiếu Mỹ neo vào.
                *
                * ⚠ MỘT DÒNG trong panel đã có, KHÔNG dựng khối mới (founder 09/09:
                * "cái nào ko phải nút bấm thì làm cơ chế tiết lộ khi tương tác" —
                * panel này vốn đã phải bấm mới bung). Nhưng nó PHẢI có mặt: cả cơ
                * chế chơi được nằm ở chỗ người chơi thấy hai con số ĐỔI NGÔI.
                *
                * ⚠ Câu "đảo ngược" chỉ hiện khi nó THẬT SỰ đảo — dán sẵn một dòng
                * cảnh báo lúc nào cũng thấy là dạy người ta bỏ qua vùng đó.
                */}
              {stBan.lai_suat.dai !== undefined && (
                <div className={s.lxDong}>
                  LỢI SUẤT DÀI <b>{(stBan.lai_suat.dai / 100).toFixed(2)}%</b>
                  {' — '}Trái phiếu trả lãi theo số này, không theo lãi nền.
                  {stBan.lai_suat.dai < stBan.lai_suat.diem && (
                    <>
                      {' '}
                      <b>ĐƯỜNG CONG ĐẢO NGƯỢC</b>: gửi tiết kiệm đang trả cao hơn
                      trái phiếu dài.
                    </>
                  )}
                </div>
              )}
              {st.chu_ky && (
                <div className={s.lxPhu}>
                  BỐI CẢNH: thị trường{' '}
                  <b>{['CHẬM', 'VỪA', 'NHANH'][st.chu_ky.speed]}</b> · biên độ{' '}
                  <b>{['NHỎ', 'VỪA', 'LỚN'][st.chu_ky.amp]}</b> · chiều xuống{' '}
                  <b>{['NHẸ', 'GẮT'][st.chu_ky.asym]}</b>
                </div>
              )}
              <div className={s.lxPhu}>
                Thông tin công khai của thị trường — xem miễn phí. Số liệu dòng
                tiền theo mã nằm ở BẢNG ĐIỆN TỬ (trả Vốn).
              </div>
            </div>
          ) : moSo ? (
            <>
              <SoLienHe
                lienHe={soTayQ.data?.lien_he}
                suKien={c.su_kien}
                taiSan={c.tai_san.map((t) => ({ id: t.id, label: t.label }))}
                gon
                onDong={() => setMoSo(false)}
              />
              {/*
                ⚠ D336 lượt 2 — BÁCH KHOA CƠ CHẾ GỠ KHỎI BÀN (13/09 nó đứng ngay dưới sổ trong cùng
                một cú mở). Founder 15/09: *"đ** nên xuất hiện bách khoa toàn thư ở đây, chỉ nên là 1 lời
                nhắc kiểu 'Nếu bạn muốn hiểu sâu hơn thì...' thôi"*. Bàn là chỗ CHƠI; ba đoạn giải thích
                dài dưới bản đồ đẩy cả khối kết quả xuống. Chữ ở lại màn Bách khoa (icon sách ở sảnh) —
                một dòng nhắc chỗ ấy, không kéo ai rời bàn giữa vòng đang chạy đồng hồ.
              */}
              <p className={s.soNhac}>
                <PixelIcon name="sach" size={16} /> Muốn hiểu sâu hơn thì mở <b>BÁCH KHOA</b> — icon sách ở sảnh Đấu trường.
              </p>
            </>
          ) : undefined}
          bang={!b.da_chay && b.tu_the !== 'all_in' && !b.khong_bang_dien_tu ? (
            <BangDienTu
              matchId={matchId}
              vong={st.vong}
              von={b.von}
              /*
               * ⭐ 24/08 — NỐI ART VÀO BẢNG. Lưới pixel cho cả 6 mã, 12 sự kiện
               * và 5 giai đoạn ĐÃ CÓ SẴN trong `server/holdem_art_grids.ts` và
               * `art` đã nạp ở màn này từ lâu (đang truyền cho MarketMap +
               * ShopManHinh) — chỉ riêng bảng là chưa ai nối. Nên đây là việc
               * NỐI DÂY, không phải vẽ thêm.
               * Cái lợi không chỉ là bớt chữ: dòng sổ cái "Sập sàn" nay mang
               * ĐÚNG hình người chơi vừa thấy lật trên bản đồ, nên hai chỗ thôi
               * nói về cùng một sự kiện bằng hai ngôn ngữ khác nhau.
               */
              art={art}
              /*
               * D33 — GIÁ THEO GHẾ, không theo bảng chung: người cầm Lướt Sóng
               * mua hạng SẠCH ở giá khác. `ban.gia_bang` do server suy (đã tính
               * thẻ); catalog chỉ còn là lưới đỡ cho bản API cũ hơn bundle.
               */
              phi={phiNiemYet(b.gia_bang?.co_ban ?? c.luat.PHI_BANG_DIEN_TU)}
              phiDuBao={b.gia_bang?.du_bao ?? null}
              onMo={() => setDaMoBang(true)}
              onDoiTrangThai={setBangDangMo}
              gon
            />
          ) : b.khong_bang_dien_tu ? (
            /*
              CHART TÀI SẢN (founder 07/10) — trận không còn bán Bảng điện tử thì CHỖ nút ấy thành cửa sổ chart: giá sáu mã qua
              các vòng đã chốt. Đọc `stBan` (không phải `st`): trong nhịp kết quả, trước bước lật lá, vòng vừa chốt chưa được diễn ⇒
              chart chưa được lộ nó.
            */
            <BieuDoTaiSan
              lichSu={stBan.lich_su_thi_truong ?? []}
              ma={c.tai_san.map((t) => ({
                id: t.id, ten: t.label, svg: art[t.id],
                dangCam: maCamTay.some((m) => m.ma === t.id),
              }))}
              oLich={stBan.o_lich ?? []}
            />
          ) : undefined}
          thayHangNut={daAllIn ? (
            <div className={s.baoAllIn}>
              {/* Lấy TỪ vocab, không gõ tay: chuỗi này từng bị bỏ sót khi đổi nhãn
                  26/07 — đúng thứ module từ vựng sinh ra để chặn. */}
              <PixelIcon name="flame" size={16} className={s.iconDong} />
              {' '}ĐÃ {T_DON_HET_UPPER} — đang lật hết thẻ tới cuối trận
            </div>
          ) : undefined}
          nhipPhai={nhipVong ? (
            /*
              ⭐⭐ 12/09 — NEO COACH `vi-sao` VỀ ĐÂY, VÀ ĐÂY LÀ MỘT BUG THẬT ĐÃ SỐNG
              TỪ D312 (08/09). Neo cũ đặt trên nút VÌ SAO của khối kết quả — mà nút
              ấy nằm TRONG khối `… && moLyDo && (`, tức chỉ tồn tại khi lý do ĐÃ mở.
              Bước `ketqua` bảo "chạm để mở lý do" nên nó chạy đúng lúc `moLyDo` còn
              tắt ⇒ `querySelector` không thấy gì ⇒ màn nhuộm đều, không ô nào sáng,
              và vì bước ấy CHỜ TAY (`tuXong: moLyDo === true`) nên người chơi kẹt
              cứng: không có gì để bấm, cũng không có nút TIẾP. Founder 12/09:
              *"nó vẫn đ** tô sáng vùng này để t bấm vào, bước này bị kẹt"*.
              ⚠ Chú thích D312 ở nút kia nói "neo nằm TRÊN NÚT, không trên tấm" —
              đúng ý định, sai thực tế: cả hai cùng nằm sau một cái cổng.
              ⇒ Neo phải ở thứ LUÔN HIỆN khi có kết quả vòng, và đó chính là cụm
              con số ở thanh tay cầm (D119: cửa duy nhất tới bảng VÌ SAO).
            */
            <span className={s.cumViSao} data-tap="vi-sao">
            {/*
              ⭐ D400 — KHOẢN NỔI: lãi/lỗ TỪNG KHOẢN trôi lên trên con số vòng ở đúng bước LÃI/LỖ (founder 24/09:
              *"số nhảy kiểu Scrolling combat box text … trôi lên trên phần lãi lỗ"*). Danh sách = đúng khối "PHẦN
              TIỀN CỦA BẠN" của bảng VÌ SAO (`khoanLaiLo`), nên màu và số trùng từng chip. `key` theo vòng: vòng mới
              dựng lại hàng hộp từ đầu.
            */}
            {buocKq === 'lai_lo' && ketQuaCho?.tt.ket_qua_vong && (
              <KhoanNoi
                key={`kn-${ketQuaCho.tt.ket_qua_vong.vong}`}
                khoan={khoanNoiCuaVong(khoanLaiLo(ketQuaCho.tt.ket_qua_vong, c?.tai_san ?? []), KHOAN_NOI_TOI_DA)}
                goc={nhipVong.goc}
                giamChuyenDong={itMotion}
                // D401 — "Ăn chia cược" rơi từ hộp GIẢI; rời giải là giải cạn.
                tuGiai={{ khoa: KHOAN_TU_GIAI, khiRa: () => setGiaiDaChia(ketQuaCho.tt.ket_qua_vong!.vong) }}
              />
            )}
            {/*
              12/09 — founder chạm con số rồi nói: "nó chẳng nói cho t biết phải
              bấm vào đây để xem lý do". Nhãn chữ đứng cạnh số, cùng chữ với nút
              VÌ SAO trong khối kết quả; `aria-hidden` vì nút số đã mang lời mời
              cho trình đọc màn hình, không nói hai lần.
            */}
            <span
              className={`${s.moiViSao} ${moLyDo ? s.moiViSaoMo : ''}`}
              aria-hidden
              onClick={() => setMoLyDo((x) => {
                if (!x) ghiDo('cham_nut', { chi_tiet: { nut: 'vi-sao' } });
                return !x;
              })}
            >
              {moLyDo ? 'ẨN' : 'VÌ SAO'}<i className={`${s.mui} ${moLyDo ? '' : s.muiPhai}`} aria-hidden />
            </span>
            <SoNhipVong
              delta={nhipVong.delta}
              goc={nhipVong.goc}
              vong={nhipVong.vong}
              // D435 — con số bước theo đúng hàng hộp `KhoanNoi` (cùng hàm, cùng trần) rồi rung khớp tổng.
              khoan={ketQuaCho?.tt.ket_qua_vong
                ? khoanNoiCuaVong(khoanLaiLo(ketQuaCho.tt.ket_qua_vong, c?.tai_san ?? []), KHOAN_NOI_TOI_DA).map((k) => k.tien)
                : undefined}
              dienKhoan={buocKq === 'lai_lo'}
              gap={!!ketQuaCho?.tt.tu_dong
                || !!ketQuaCho?.tt.ket_qua_vong?.siet_cua_ban
                // D342 — lệnh vòng vừa chốt bị bác: con số lấp láy mời mở VÌ SAO, nơi nói lý do.
                || !!ketQuaCho?.tt.loi_von?.lenh}
              dangMo={moLyDo}
              // 12/09 (C4 "hỏi là đo") — chỉ cú MỞ ghi một dòng; đóng thì không.
              onCham={() => setMoLyDo((x) => {
                if (!x) ghiDo('cham_nut', { chi_tiet: { nut: 'vi-sao' } });
                return !x;
              })}
            />
            </span>
          ) : undefined}
          shopMo={shopMo}
          onShop={() => {
            setShopMo((x) => { if (x) shopMoLucLat.current = false; return !x; });
            setDaXemShop(true);
          }}
          soTheChon={soTheChon}
          // D430 — vòng MỐC TRAIT mời mở shop như vòng lõi: chợ trait đứng ở đúng chỗ hàng lõi.
          chamMoi={!daXemShop && ((soTheChon === 0 && loaiVongNay === 'chien_thuat')
            || (choTrait?.vong === st.vong && chonTrait.length === 0))}
          {...(choTrait?.vong === st.vong ? { chamMoiNhan: 'Có chợ trait chờ chọn' } : {})}
          onChotVong={() => { void nopVong([], 'giu_vi_the'); }}
          onBo={() => setHoiBo(true)}
          // v54 (D403) — trận không còn nước BỎ ⇒ gỡ nút (về tiền mặt: BÁN SẠCH trong shop; đầu hàng: nút thoát).
          coBo={st.bo_bai_tat !== true}
          dangGui={nop.isPending}
          vohieu={dangBan}
          // D548 — chờ màn của bàn (không có màn riêng mở): CTA đếm giây thay vì sáng như chưa chốt.
          choDen={st.cho_man && manVong === null ? choManMoc.current?.moc : undefined}
        />
      </div>

      {/* D585 — màn mở SAU bước lật lá của bàn (lá vừa chốt lật trên bàn trước — một cú lật). */}
      {manVong !== null && matchId && !(st.cho_man?.vong === manVong && dangDienKq && !daToiBuoc(buocKq, 'tin')) && (() => {
        // D476 — hai ô thẻ trên mặt nỉ của màn: ô vòng trước + ô vòng vừa chốt (ô cuối của `lich_su_o`), nhãn + icon từ catalog.
        // Art CÓ SẴN của lá (cùng `art[khoá]` + `matLa` + `HO_MAU` bản đồ dùng); lá bị che (MÙ TIN / SƯƠNG MÙ) ⇒ mặt trống.
        const matO = (o: (typeof st)['lich_su_o'][number] | { kind: 'giai_doan'; up: true } | undefined) => {
          if (!o || !c || (o.kind !== 'su_kien' && o.kind !== 'giai_doan') || 'up' in o) return undefined;   // D561 — lá úp: không mặt
          const khoa = o.kind === 'su_kien' ? `sk_${o.su_kien}` : `gd_${o.giai_doan}`;
          const nhan = o.kind === 'su_kien' ? c.su_kien.find((x) => x.id === o.su_kien)?.label : c.giai_doan.find((x) => x.id === o.giai_doan)?.label;
          const mat = matLa(khoa);
          return { svg: art[khoa] ?? '', ten: mat?.ten ?? nhan ?? khoa, ...(mat ? { mau: HO_MAU[mat.ho].mau } : {}) };
        };
        const ls = st?.lich_su_o ?? [];
        // D480 — đang chờ màn: lá vừa lật đi riêng trong `cho_man` (trạng thái là của TRƯỚC chốt), lá cũ là ô cuối đã lật.
        const choMan = st?.cho_man?.vong === manVong ? st.cho_man : undefined;
        return (
          <ManMinigame matchId={matchId} vong={manVong} tongVong={st?.tong_vong} nav={st?.ban.nav ?? st?.ban.von} art={art} tap={laManTap} matTheCua={matO} latTrenBan
            theCu={matO(choMan ? ls[ls.length - 1] : ls[ls.length - 2])} theMoi={matO(choMan ? choMan.o : ls[ls.length - 1])}
            // Đóng màn ⇒ hỏi lại trạng thái: hết màn thì NAV của vòng đang chơi đã gồm kết quả màn (D475).
            // ⚠ D533 — qua ĐỒNG BỘ LẠI (đè trạng thái cục bộ). `tt.refetch()` chỉ làm mới bản query, mà `st = stCuc ?? tt.data` ⇒ bàn kẹt ở vòng cũ.
            dong={() => { setManVong(null); void dongBoLaiTuServerRef.current(); }} />
        );
      })()}
    </div>
    </KhungMinigameCtx.Provider>
  );
}

/**
 * D533 — dòng chờ màn của bàn (lớp màn không mở): đếm giây tới khi màn hết — tự đếm, không kéo cả màn trận vẽ lại mỗi giây. Lệnh vừa nộp bị bác
 * (lý do server trả kèm `cho_man`) ⇒ nói lý do NGAY — đó thường chính là vì sao không có màn (không cầm mã nào).
 */
function ChoManDong({ moc, loi }: { moc: number; loi: string | null }) {
  const [bay, setBay] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setBay(Date.now()), 1000); return () => clearInterval(t); }, []);
  const con = Math.ceil((moc - bay) / 1000);
  return (
    <span className={s.choMan} role="status" data-khoi="cho-man">
      {loi && <b className={s.choManLoi} data-khoi="cho-man-loi">LỆNH BỊ BÁC · {loi}</b>}
      <span>{con > 0 ? `MÀN CỦA BÀN · ${con}s` : 'ĐANG MỞ VÒNG SAU…'}</span>
    </span>
  );
}
