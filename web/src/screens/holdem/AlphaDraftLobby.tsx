/**
 * SẢNH ĐẤU TRƯỜNG — BENTO KHÔNG CUỘN (SPEC `docs/spec/alpha-draft-tang-khong-gian.md` phần A; demo CHỐT
 * `docs/ui-ux/demo/alpha-draft-tang-khong-gian.html`, founder 11/10: *"2 phần này cũng ổn rồi đấy"*). Luật chung: `docs/ui-ux/09-tang-khong-gian.md`.
 *
 * Một khung 390×812 (và 360×640) KHÔNG cuộn: Ô CHÍNH đổi theo tình huống (bàn đang dở · thử thách hôm nay · hôm nay xong) + BỐN Ô CHẾ ĐỘ
 * (ĐẤU VỚI MÁY · XẾP HẠNG · RỦ BẠN · MÀN TẬP). Ba ô đầu chạm = LỚP TRƯỢT cài đặt (`TamTruot` dùng chung với Hub — A11.5); MÀN TẬP đi thẳng.
 * VÀO BÀN / TÌM TRẬN mở PHÒNG CHỜ (lớp đè toàn màn, `PhongCho`). Mọi khối cũ còn tới được trong ≤ 1 chạm + lớp trượt.
 *
 * ⚠ KHẨU VỊ RỦI RO ĐÃ BỊ XOÁ (founder 11/10 — demo vẽ nhầm từ mã cũ): sảnh KHÔNG còn khối chọn khẩu vị dù catalog trả danh sách;
 *   trận luôn dựng với khẩu vị mặc định `can_bang`. Cỡ bàn chỉ vẽ khi catalog còn NHIỀU hơn một cỡ (luật đang chạy: một cỡ).
 *
 * ──── GHI CHÚ TỪ BẢN CŨ (vẫn đúng) ────
 * Tên SẢNH ĐẤU TRƯỜNG — ba chế độ.
 *
 * ⚠ Tên file/component giữ codename nội bộ "AlphaDraft" (D26 cho phép trong
 * code). Chuỗi RENDER lấy từ `lib/vocab.ts` → người chơi chỉ thấy "Đấu trường".
 *
 * Founder 25/07 §2: "giảm text tối đa". Nhưng ổ khoá KHÔNG được trơn — ổ khoá
 * không kèm lý do là kiểu UI bắt người chơi đoán, họ sẽ đoán "sắp có" rồi quay
 * lại mỗi ngày và thất vọng dần. Nên mỗi khoá còn ĐÚNG một dòng nói chờ gì.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { docDiemQuayVe, duongBanTuMa, xoaDiemQuayVe } from '@/lib/diem_quay_ve';
import {
  daChiBachKhoa, daQuaManTap, danhDauQuaManTap, ghiDaChiBachKhoa, lyDoQuaManTap, nhoTranTap, quyetDinhVaoSanh, tranTapDaNho,
} from '@/lib/man_tap_dau';
import { RuBan } from '@/components/holdem/RuBan';
import { PhongCho } from '@/components/holdem/PhongCho';
import { conLai, ngayNgan, phanViGon, trangThaiNgay } from '@/components/holdem/ThuThachNgay';
import { AuthGate } from '@/components/AuthGate';
import { CanDongY } from '@/components/CanDongY';
import { NutChinh, OBento, PixelIcon, TamTruot } from '@/components/ui';
import {
  useHoldemCatalog, useTaoTran, useThuThachNgay, useTienDo, useTranDangDo, type KhauViDTO,
} from '@/api/holdem';
import { CHU_SANH } from '@/lib/sanh_chu';
import { NHIP_RUNG, rung } from '@/lib/rung';
import {
  NAME_ARENA_UPPER, ROUTE_ARENA_GUIDE, ROUTE_BACH_KHOA, duongDanTran,
} from '@/lib/vocab';
import { Mascot } from '@/components/Mascot';
import { TamDau } from '@/screens/hub/TamDau';
import t from '@/screens/hub/HubTam.module.css';
import s from './AlphaDraftLobby.module.css';

/** Khẩu vị đã xoá khỏi game (founder 11/10, D406 `khau_vi_tat`): mọi trận dựng với giá trị mặc định này, sảnh không còn ô chọn. */
const KHAU_VI_MAC_DINH: KhauViDTO['id'] = 'can_bang';
type TamLoai = 'may' | 'xep' | 'ru';

/**
 * Nhãn ba cỡ bàn (D31: 8/12/16). Nhịp thật đo ở D38: map 8 ≈ 7,5 phút ·
 * 12 ≈ 10,7 · 16 ≈ 14. Danh SÁCH cỡ lấy từ catalog (server); bảng này chỉ
 * là chữ hiển thị — cỡ lạ không có nhãn thì hiện số trần.
 */
const NHAN_CO_MAP: Record<number, { ten: string; phu: string }> = {
  8: { ten: 'NHANH', phu: '8 ô · ~8 phút · không vai' },
  12: { ten: 'CHUẨN', phu: '12 ô · ~11 phút · vai + kỳ ngộ' },
  // D550 — trận thật khoá v63 (13 vòng, chín màn · năm chợ trait; tối đa ~17 phút nếu dùng hết giờ).
  14: { ten: 'CHUẨN', phu: '14 ô · ~15 phút · vai' },
  16: { ten: 'DÀI', phu: '16 ô · ~14 phút · vai + 2 kỳ ngộ' },
};

export function AlphaDraftLobby() {
  return (
    <AuthGate>
      <LobbyInner />
    </AuthGate>
  );
}

function LobbyInner() {
  const navigate = useNavigate();
  /*
   * TẠO TRẬN LÀ HÀNH ĐỘNG CỦA NGƯỜI CHƠI, không phải hệ quả của việc mở URL.
   * Bấm nút → phòng chờ → tạo → điều hướng kèm matchId. Nhờ vậy tải lại trang
   * giữa trận KHÔNG tạo trận mới nữa (lỗi cũ), và bàn đấu chỉ còn việc ĐỌC theo
   * id. (16/08: cú gọi tạo trận nằm trong `PhongCho`, sảnh không giữ hook tạo.)
   */
  const cat = useHoldemCatalog();
  /** Trận còn mở của chính mình — đường về sau khi rớt mạng (rà 11/08). */
  const dangDoQ = useTranDangDo();

  /*
   * D31 + founder 02/08 — CHỌN CỠ BÀN CHỦ ĐỘNG. Mặc định 8 (map nhanh — app
   * điện thoại giữa giờ nghỉ, D38). Danh sách từ catalog; catalog cũ trong
   * cache chưa có trường thì rơi về đúng ba cỡ D31 đã chốt.
   */
  const dsCoMap = cat.data?.quyet_dinh.CO_MAP_CHON ?? [8, 12, 16];
  /*
   * TIẾN ĐỘ (`so_tran_xong`) chỉ còn dùng cho QUYẾT ĐỊNH VÀO SẢNH / BÀN TẬP (bên dưới). Mở khoá khẩu vị theo số trận (D86/D307) đã gỡ
   * cùng khẩu vị (founder 11/10) — không còn `khau_vi` / `con_thieu` để đọc ở sảnh.
   */
  const tienDo = useTienDo();
  /** Link mời `/arena/ban/<mã>` — mã điền sẵn cho khối RỦ BẠN. */
  const banMaTuLink = useParams<{ banMa?: string }>().banMa;
  /*
   * D333 — đã TỚI bàn (qua cổng đăng nhập) thì xoá điểm quay về: chuỗi đăng ký kết thúc ở đây. Chỉ xoá
   * khi điểm đang nhớ đúng là bàn này — mở một bàn khác không được xoá dấu của buổi đo đang dở.
   */
  useEffect(() => {
    if (banMaTuLink && docDiemQuayVe() === duongBanTuMa(banMaTuLink)) xoaDiemQuayVe();
  }, [banMaTuLink]);
  /*
   * D300 — cỡ bàn CHỌN SẴN đọc từ catalog (`MAP_MAC_DINH_SANH` = 12). Bàn 8 không
   * có vai, không có kỳ ngộ (đo 07/09: 8/9 trận prod là bàn 8, founder hỏi "vai
   * đâu, kỳ ngộ đâu"), nên để nó làm cửa vào là giấu hai cơ chế lớn khỏi trận đầu.
   * `null` = người chơi chưa chạm ⇒ dùng số server phát; catalog cũ vắng ⇒ 12.
   */
  const macDinh = cat.data?.quyet_dinh.MAP_MAC_DINH_SANH ?? 12;
  const [soOChon, setSoOChon] = useState<number | null>(null);
  const soO = soOChon ?? macDinh;
  const setSoO = setSoOChon;
  /* LỚP TRƯỢT cài đặt: MỘT khung duy nhất, ruột đổi theo ô vừa chạm (cùng khuôn Hub). Lựa chọn (cỡ bàn) sống qua việc đổi chế độ. */
  const [tam, datTam] = useState<TamLoai>('may');
  const [mo, datMo] = useState(false);
  const moTam = (x: TamLoai): void => { datTam(x); datMo(true); };
  /*
   * ⚠ CỔNG CHỈ ĐỨNG Ở XẾP HẠNG, KHÔNG ĐỨNG Ở CỬA SẢNH (founder chốt 03/08).
   * Chơi tự do là chơi một mình với bot — không ai thấy bạn, nên không có gì
   * để thoả thuận. Xếp hạng mới là lúc tên bạn đứng trên một bảng chung cạnh
   * người lạ; lúc đó đòi đồng ý mới công bằng.
   *
   * ⚠⚠ ĐỌC TỪ CÂU TRẢ LỜI CỦA MÁY CHỦ, KHÔNG TỰ ĐOÁN LẠI LUẬT Ở CLIENT.
   * Bản đầu gọi `useMe()` để tự kiểm `research_consent` — và TƯỜNG LỬA D24
   * bắt được ngay (`holdem_firewall.test.ts`): màn Đấu trường mà import ví
   * token T là đang dựng cầu quy đổi T ↔ ví trận, đúng thứ luật số một cấm.
   * Test ấy cứu một lỗi kiến trúc thật, không phải bắt bẻ.
   *
   * Cách này còn ĐÚNG HƠN về mặt thiết kế: chỉ có MỘT nơi biết luật (server),
   * client chỉ phản ứng với 403 `chua_dong_y`. Không có bản sao luật thứ hai
   * để trôi (C4).
   */
  const [chuaDongY, setChuaDongY] = useState(false);

  /*
   * 16/08 — PHÒNG CHỜ (founder: "bấm phát vào trận luôn thì hơi không quen"):
   * VÀO BÀN / TÌM TRẬN mở phòng chờ; phòng chờ mới gọi tạo trận (sau nhịp "đang
   * xếp bàn"), lộ ghế, rồi vào. Bàn chung (mã) cũng đi qua đây để thấy ĐỘI.
   * Lỗi tạo trận (kể cả 403 rank của khách) hiện NGAY TRONG phòng chờ bằng câu
   * của máy chủ; riêng `chua_dong_y` trả về sảnh để mở khối đồng ý.
   */
  const [phongCho, setPhongCho] = useState<null | { cheDo: 'tu_do' | 'rank_pve'; banMa?: string; epSeed?: number; epBalance?: string }>(null);
  /*
   * 12/09 — ÉP SEED cho TESTER qua `?seed=<số>` trên URL sảnh (không có ô nhập:
   * đây là dụng cụ soi bàn cố định, không phải cơ chế người chơi). Server chỉ
   * nhận `ep_seed` từ tài khoản tester và CHẶN ở cửa nếu sai hình dạng — sảnh
   * không lọc hộ, để tester thấy đúng câu lỗi của máy chủ thay vì âm thầm rơi
   * về seed ngẫu nhiên (cùng lý lẽ với `ep_so_ghe`, migration 0052).
   */
  const [thamSoUrl] = useSearchParams();
  const epSeedUrl = (() => {
    const raw = thamSoUrl.get('seed');
    if (raw === null || !/^\d{1,10}$/.test(raw)) return undefined;
    return Number(raw);
  })();
  /*
   * D456 — ÉP KHOÁ LUẬT cho TESTER qua `?luat=balance-v57-minigame` (cùng nếp `?seed=`: không ô nhập, không UI cho người
   * chơi). Lối vào để founder chơi thử khoá ĐANG DỰNG mà không lật mặc định. Hình dạng lọc theo đúng regex server
   * (`ep_balance`) — sai hình dạng thì lờ, server vẫn là cửa thật (kiểm quyền tester + khoá phải đang sống).
   */
  const epBalanceUrl = (() => {
    const raw = thamSoUrl.get('luat');
    return raw !== null && /^balance-[a-z0-9-]{1,40}$/.test(raw) ? raw : undefined;
  })();
  /** VÀO BÀN (tự do) / TÌM TRẬN (xếp hạng) ⇒ đóng lớp trượt rồi mở PHÒNG CHỜ (lớp đè). */
  const vaoBan = (cheDo: 'tu_do' | 'rank_pve'): void => {
    datMo(false);
    setPhongCho({
      cheDo,
      ...(epSeedUrl !== undefined && cheDo !== 'rank_pve' ? { epSeed: epSeedUrl } : {}),
      ...(epBalanceUrl !== undefined && cheDo !== 'rank_pve' ? { epBalance: epBalanceUrl } : {}),
    });
  };

  /*
   * D336 lượt 2 — LẦN ĐẦU VÀO ĐẤU TRƯỜNG ⇒ VÀO THẲNG MÀN TẬP (founder 15/09). Ai là "lần đầu", ai
   * không bị kéo, vì sao bỏ qua nằm ở máy: `lib/man_tap_dau.ts`.
   * ⚠ CHỈ QUYẾT BẰNG SỐ MỚI (`isFetchedAfterMount`), không bằng cache: vừa xong bàn tập bấm VỀ SẢNH
   * thì cache `tien-do` vẫn còn `so_tran_xong: 0` của lúc trước — đọc cache là dựng bàn tập thứ hai.
   * (Màn kết bàn tập cũng ghi "xong" vào máy; hai lớp, vì một lớp là một chỗ để trượt.)
   */
  const [daQuaMay] = useState(daQuaManTap);
  /*
   * D544 (founder 06/10: *"Delphi ở sảnh sau bàn tập hướng dẫn truy cập và sử dụng bách khoa"*; trước đó *"delphi kết thúc màn hướng dẫn bảo đợi ở
   * sảnh nhưng bấm về sảnh thì ko thấy đâu"* — Oracle ngoài HUB cố ý mờ + thu gọn). Lần đầu tới sảnh sau khi XONG bàn tập: Delphi đứng hẳn ra, chỉ
   * đúng cuốn sách ở góc và cách dùng (ô tìm · ô CÁCH MẤT TIỀN). Một lần, nhớ ở máy.
   */
  const [chiBk, datChiBk] = useState(() => lyDoQuaManTap() === 'xong' && !daChiBachKhoa());
  const xongChiBk = () => { ghiDaChiBachKhoa(); datChiBk(false); };
  const taoTap = useTaoTran();
  const [loiTaoTap, setLoiTaoTap] = useState(false);
  // Hỏi hỏng một lần là coi như lỗi luôn (`failureCount`), không chờ lượt thử lại ~1 giây: người vào
  // sảnh không phải đứng nhìn dòng "đang mở" chỉ vì một endpoint phụ đang trục trặc.
  const quyet = loiTaoTap ? { loai: 'sanh' as const } : quyetDinhVaoSanh({
    daQuaMay,
    soTranXong: tienDo.isError || tienDo.failureCount > 0 ? null
      : tienDo.isFetchedAfterMount ? (tienDo.data?.so_tran_xong ?? null) : undefined,
    tranMo: dangDoQ.isError || dangDoQ.failureCount > 0 ? null
      : dangDoQ.isFetchedAfterMount
        ? (dangDoQ.data?.tran ?? []).filter((t) => t.status === 'dang_choi')
          .map((t) => ({ match_id: t.match_id, tiep_duoc: t.tiep_duoc ?? true }))
        : undefined,
    tranTap: tranTapDaNho(),
    coViecKhac: !!banMaTuLink || epSeedUrl !== undefined || epBalanceUrl !== undefined || docDiemQuayVe() !== null,
  });
  const daDanDi = useRef(false);
  useEffect(() => {
    if (daDanDi.current) return;
    if (quyet.loai === 'sanh') {
      if ('ghi' in quyet && quyet.ghi) danhDauQuaManTap(quyet.ghi);
      return;
    }
    if (quyet.loai === 'tiep_tap') {
      daDanDi.current = true;
      navigate(`${duongDanTran(quyet.matchId)}?tap=1`, { replace: true });
    } else if (quyet.loai === 'tao_tap') {
      daDanDi.current = true;
      taoTap.mutate({ tap: true }, {
        onSuccess: (d) => {
          nhoTranTap(d.match_id);
          // `replace`: nút Back từ bàn tập về Hub, không về một sảnh sẽ lại dắt vào bàn tập.
          navigate(`${duongDanTran(d.match_id)}?tap=1`, { replace: true });
        },
        // Dựng bàn tập hỏng (mạng) ⇒ cho vào sảnh; không ghi "đã qua" — lần sau còn dắt.
        onError: () => setLoiTaoTap(true),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quyet.loai]);


  /*
   * THỬ THÁCH HÔM NAY — hook ở ĐÂY (không còn trong card): ô chính cần biết trạng thái để QUYẾT ĐỊNH nó là gì. Trạng thái suy ra bằng
   * `trangThaiNgay` (một nguồn với card cũ). Hỏi lại khi vào sảnh, thưa 60 s (xem `useThuThachNgay`).
   */
  const ngayQ = useThuThachNgay();
  const banNgay = ngayQ.data;
  const trangThaiThuThach = trangThaiNgay(banNgay, ngayQ.isError);

  /*
   * LINK MỜI `/arena/ban/<mã>` (16/08): người được rủ chỉ việc bấm link ⇒ vào thẳng PHÒNG CHỜ của bàn đó. Trước đây việc này nằm trong
   * `RuBan` (nó tự `vao(maDienSan)` khi mount) — nhưng nay RuBan chỉ sống TRONG lớp trượt, mà lớp trượt đóng thì RuBan không mount ⇒
   * phải làm ở sảnh. Mã SAI hình (không đủ 5 ký tự chữ/số) ⇒ mở lớp RỦ BẠN có sẵn mã đó để RuBan nói lỗi như xưa.
   */
  const maLink = banMaTuLink?.trim().toLowerCase();
  const maLinkDung = maLink !== undefined && /^[a-z0-9]{5}$/.test(maLink);
  const daMoLink = useRef(false);
  useEffect(() => {
    if (!maLink || daMoLink.current) return;
    daMoLink.current = true;
    if (maLinkDung) setPhongCho({ cheDo: 'tu_do', banMa: maLink });
    else { datTam('ru'); datMo(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maLink]);

  // Đang hỏi server / đang dắt vào bàn tập: không vẽ sảnh — vẽ sảnh rồi giật đi là một cú bấm nhầm chờ sẵn.
  if (quyet.loai !== 'sanh') {
    return (
      <div className={s.dangDanVao} aria-busy="true" data-testid="dang-dan-vao-tap">
        {quyet.loai === 'cho' ? CHU_SANH.dangMo : CHU_SANH.dangDungTap}
      </div>
    );
  }

  /*
   * D93 — chỉ mời bàn CÒN TIẾP ĐƯỢC. Server tính `tiep_duoc` bằng đúng luật hạn trận của bộ quét; giữa hai tick một trận quá 45' vẫn
   * `dang_choi` trong DB, và mời nó là dẫn người ta vào một bàn mà cú bấm đầu ăn 409. API cũ không có trường ⇒ rơi về `status`.
   * Bàn dở đứng TRƯỚC thử thách: tạo bàn mới trong khi bàn cũ còn treo chỉ đẻ thêm một trận mồ côi (rà mạng kém 11/08).
   */
  const dangDo = dangDoQ.data?.tran.find((x) => x.status === 'dang_choi' && (x.tiep_duoc ?? true));
  const soGiengCatalog = cat.data ? (cat.data.quyet_dinh.MAP_MAC_DINH_SANH ?? cat.data.quyet_dinh.MAP_SIZE) : 0;

  const choiTiepDo = (): void => {
    if (!dangDo) return;
    // D336 lượt 2 — bàn đang dở là bàn tập đã dắt vào ⇒ về kèm trợ lý (`?tap=1`), không về bàn trơn.
    navigate(`${duongDanTran(dangDo.match_id)}${dangDo.match_id === tranTapDaNho() ? '?tap=1' : ''}`);
  };
  const vaoBanNgay = (): void => {
    if (!banNgay) return;
    rung(NHIP_RUNG.nang);
    if (trangThaiThuThach === 'dang' && banNgay.toi) { navigate(duongDanTran(banNgay.toi.match_id)); return; }
    setPhongCho({ cheDo: 'tu_do', banMa: banNgay.ma });
  };
  const thuLaiNgay = (): void => { if (!ngayQ.isFetching) void ngayQ.refetch(); };

  // ── Ô CHÍNH: MỘT việc nên làm ngay, đổi theo tình huống (SPEC mục 4.1) ──
  let oChinh: React.ReactElement;
  if (dangDo) {
    oChinh = (
      <div className={s.chinhTrong} data-testid="tiep-tuc-tran" data-chinh="dang_do">
        <span className={s.nhan}><PixelIcon name="arena" size={16} />{CHU_SANH.banDo}</span>
        <GiengBan so={soGiengCatalog} />
        <span className={s.dongChip}><span className={`${s.chip} ${s.chipLam}`}>VÒNG {dangDo.vong_hien_tai}</span></span>
        <NutChinh dau="chinh-vao" onChon={choiTiepDo}>{CHU_SANH.choiTiep}</NutChinh>
      </div>
    );
  } else if (trangThaiThuThach === 'xong') {
    const pv = banNgay?.thu_thach ? phanViGon(banNgay.thu_thach) : null;
    oChinh = (
      <div className={s.chinhTrong} data-tap="thu-thach-ngay" data-trang-thai="xong" data-chinh="xong">
        <span className={s.nhan}>{CHU_SANH.thuThach}{banNgay?.thu_thach ? ` · ${ngayNgan(banNgay.thu_thach.ngay)}` : ''}</span>
        <span className={`${s.gieng} ${s.giengChu}`}>
          <b className={s.heroXong}>{pv ? pv.to : CHU_SANH.daXong}</b>
          <span className={s.duoi}>{pv ? `${pv.duoi} · ` : ''}{CHU_SANH.banMoi}</span>
        </span>
        <NutChinh dau="chinh-vao" onChon={() => moTam('may')}>{`▶ ${CHU_SANH.may}`}</NutChinh>
      </div>
    );
  } else {
    const doc = trangThaiThuThach === 'doc';
    const loi = trangThaiThuThach === 'loi';
    oChinh = (
      <div className={s.chinhTrong} data-tap="thu-thach-ngay" data-trang-thai={trangThaiThuThach} data-chinh="thu_thach">
        <span className={s.nhan}><PixelIcon name="flame" size={16} />{CHU_SANH.thuThach}{banNgay?.thu_thach ? ` · ${ngayNgan(banNgay.thu_thach.ngay)}` : ''}</span>
        <GiengBan so={banNgay?.so_o ?? soGiengCatalog} />
        <span className={s.dongChip}>
          {banNgay ? (
            <>
              <span className={s.chip}>{banNgay.so_o} ô · {CHU_SANH.caNuoc}</span>
              <span className={`${s.chip} ${s.chipVang}`}>{conLai(banNgay.het_han)}</span>
            </>
          ) : loi ? (
            <span className={`${s.chip} ${s.chipLoi}`} role="alert">{CHU_SANH.chuaDoc}</span>
          ) : (
            <span className={`${s.chip} ${s.chipCho}`}>{CHU_SANH.dangHoi}</span>
          )}
        </span>
        {loi ? (
          <NutChinh dau="chinh-vao" disabled={ngayQ.isFetching} onChon={thuLaiNgay}>
            {ngayQ.isFetching ? CHU_SANH.dangThuLai : CHU_SANH.thuLai}
          </NutChinh>
        ) : (
          <NutChinh dau="chinh-vao" disabled={doc} onChon={vaoBanNgay}>
            {trangThaiThuThach === 'dang' ? CHU_SANH.choiTiepHomNay : CHU_SANH.vaoBanHomNay}
          </NutChinh>
        )}
      </div>
    );
  }

  // ── RUỘT LỚP TRƯỢT ──
  const coVai = cat.data?.vai !== undefined && Object.keys(cat.data.vai).length > 0;
  const tagBan = cat.data ? `${soO} Ô${coVai ? ' · CÓ VAI' : ''}` : '…';
  const chonCo = dsCoMap.length > 1 ? (
    <div className={t.chiTiet}>
      <p className={t.chonDau}>{CHU_SANH.coBan}</p>
      <div className={s.nhomNut}>
        {dsCoMap.map((so) => (
          <button key={so} type="button" className={s.nutCo} aria-pressed={soO === so} onClick={() => setSoO(so)}>
            <b>{NHAN_CO_MAP[so]?.ten ?? `${so} Ô`}</b>
            <span>{NHAN_CO_MAP[so]?.phu ?? `${so} ô`}</span>
          </button>
        ))}
      </div>
    </div>
  ) : null;

  let ruot: React.ReactNode;
  let chan: React.ReactNode = null;
  let nhanTam: string = CHU_SANH.may;
  if (tam === 'may') {
    ruot = (
      <>
        <TamDau icon={<PixelIcon name="arena" size={32} />} ten={CHU_SANH.may} tag={tagBan} />
        <p className={t.tamMo}>{CHU_SANH.mayMoTa}</p>
        {chonCo}
      </>
    );
    chan = <NutChinh dau="vao-ban" onChon={() => vaoBan('tu_do')}>{CHU_SANH.vaoBan}</NutChinh>;
  } else if (tam === 'xep') {
    nhanTam = CHU_SANH.xepHang;
    ruot = (
      <>
        <TamDau icon={<PixelIcon name="medal" size={32} />} ten={CHU_SANH.xepHang} tag={`${CHU_SANH.xepHangTen} · ${CHU_SANH.xepHangPhu.toUpperCase()}`} />
        {chuaDongY ? <CanDongY onXong={() => setChuaDongY(false)} /> : (
          <>
            <p className={t.tamMo}>{CHU_SANH.xepHangMoTa}</p>
            <p className={t.ghiChu}>{CHU_SANH.xepHangHienTai}</p>
            {chonCo}
          </>
        )}
      </>
    );
    if (!chuaDongY) chan = <NutChinh dau="tim-tran" onChon={() => vaoBan('rank_pve')}>{CHU_SANH.timTran}</NutChinh>;
  } else {
    nhanTam = CHU_SANH.ru;
    ruot = (
      <>
        <TamDau icon={<PixelIcon name="mail" size={32} />} ten="RỦ BẠN CÙNG BÀN" tag="MÃ BÀN HẠN 24 GIỜ" />
        <p className={t.tamMo}>{CHU_SANH.ruMoTa}</p>
        <RuBan
          luonMo
          dsCoMap={dsCoMap} macDinh={macDinh} khauVi={KHAU_VI_MAC_DINH}
          maDienSan={maLink && !maLinkDung ? maLink : undefined}
          onVao={(ma) => { datMo(false); setPhongCho({ cheDo: 'tu_do', banMa: ma }); }}
        />
      </>
    );
  }

  return (
    <div className={s.sanh}>
      {/* LỚP NỀN: vignette dồn mắt vào ô (phủ lên ô, dưới Oracle và lớp trượt) */}
      <div className={s.nen} aria-hidden="true" />
      <div className={s.khung}>
        {/* ── ĐẦU SẢNH: tên bên trái · Bách khoa · ô giữ sẵn cho Oracle (mép phải) ── */}
        <div className={s.dau}>
          <span className={s.tenKhoi}>
            <h1 className={s.ten}>{NAME_ARENA_UPPER}</h1>
            <span className={s.phu}>{CHU_SANH.phu}</span>
          </span>
          {/*
            D334 — CUỐN SÁCH BÁCH KHOA: một icon ở góc, không phải một chế độ chơi. D544: vừa XONG bàn tập ⇒ nút sáng lên (thở) và Delphi chỉ cách dùng.
          */}
          <Link
            to={ROUTE_BACH_KHOA}
            className={`${s.nutSach} ${chiBk ? s.nutSachChi : ''}`}
            data-testid="nut-bach-khoa"
            data-o="bach-khoa"
            aria-label={CHU_SANH.bachKhoa}
            onClick={() => { if (chiBk) ghiDaChiBachKhoa(); }}
          >
            <PixelIcon name="sach" size={32} />
          </Link>
          {/* Ô giữ sẵn cho avatar Oracle (xem `OracleChat` chế độ `neoCho`): KHÔNG nút/ô bấm nào trong đó ⇒ Oracle không bao giờ che sảnh. */}
          <span className={s.choOracle} data-oracle-cho aria-hidden="true" />
        </div>

        {chiBk && (
          <div className={s.delphiSanh} role="note" data-testid="delphi-chi-bach-khoa">
            <Mascot size={36} glow bay />
            <div className={s.delphiSanhChu}>
              <b className={s.delphiSanhNhan}>ORACLE</b>
              <p>
                Bàn tập xong. Trong trận gặp chữ lạ — lãi suất, đòn bẩy, thiên nga đen… — thì mở <b>BÁCH KHOA</b> ở góc trên: gõ vào ô tìm,
                hoặc chạm ô <b>CÁCH MẤT TIỀN</b> để xem những đường người chơi hay mất tiền.
              </p>
              <div className={s.delphiSanhNut}>
                <Link to={ROUTE_BACH_KHOA} className={s.delphiMo} onClick={xongChiBk} data-testid="delphi-mo-bach-khoa">MỞ BÁCH KHOA</Link>
                <button type="button" className={s.delphiSanhBo} onClick={xongChiBk}>ĐỂ SAU</button>
              </div>
            </div>
          </div>
        )}

        {/* ── LƯỚI BENTO: ô chính (cả hàng) + bốn ô chế độ 2×2 ── */}
        <div className={s.luoi}>
          <OBento as="div" noiBat className={s.oChinh} dau="chinh">{oChinh}</OBento>

          <OBento className={s.oChe} nhan="Đấu với máy — mở cài đặt" dau="may" onChon={() => moTam('may')}>
            <span className={s.nhan}>{CHU_SANH.may}</span>
            <span className={s.iconChe}><PixelIcon name="arena" size={32} /></span>
            <span className={s.cheCot}><span className={s.tenChe}>{CHU_SANH.mayTen}</span><span className={s.duoi}>{CHU_SANH.mayPhu}</span></span>
            <span className={s.mui} aria-hidden="true">›</span>
          </OBento>
          <OBento className={s.oChe} nhan="Xếp hạng — mở chi tiết" dau="xep" onChon={() => moTam('xep')}>
            <span className={s.nhan}>{CHU_SANH.xepHang}</span>
            <span className={s.iconChe}><PixelIcon name="medal" size={32} /></span>
            <span className={s.cheCot}><span className={s.tenChe}>{CHU_SANH.xepHangTen}</span><span className={s.duoi}>{CHU_SANH.xepHangPhu}</span></span>
            <span className={s.mui} aria-hidden="true">›</span>
          </OBento>
          <OBento className={s.oChe} nhan="Rủ bạn cùng bàn — mở mã bàn" dau="ru" onChon={() => moTam('ru')}>
            <span className={s.nhan}>{CHU_SANH.ru}</span>
            <span className={s.iconChe}><PixelIcon name="mail" size={32} /></span>
            <span className={s.cheCot}><span className={s.tenChe}>{CHU_SANH.ruTen}</span><span className={s.duoi}>{CHU_SANH.ruPhu}</span></span>
            <span className={s.mui} aria-hidden="true">›</span>
          </OBento>
          {/*
            ⚠ D336 lượt 2 — MÀN TẬP Ở CUỐI (founder 15/09): người mới không cần tìm nó (lần đầu vào Đấu trường được dắt thẳng vào bàn tập);
            chỗ này cho người muốn TẬP LẠI. Đi thẳng tới màn tập, không qua lớp trượt (việc chính 1 chạm).
          */}
          <div className={s.boc} data-testid="sanh-man-tap">
            <OBento className={s.oChe} nhan="Màn tập — học bằng cách chơi" dau="man-tap" onChon={() => navigate(ROUTE_ARENA_GUIDE)}>
              <span className={s.nhan}>{CHU_SANH.manTap}</span>
              <span className={s.iconChe}><PixelIcon name="target" size={32} /></span>
              <span className={s.cheCot}><span className={s.tenChe}>{CHU_SANH.manTapTen}</span><span className={s.duoi}>{CHU_SANH.manTapPhu}</span></span>
              <span className={s.mui} aria-hidden="true">›</span>
            </OBento>
          </div>
        </div>

        <p className={s.mienTru}>{CHU_SANH.canhBao}</p>
      </div>

      {/* ── LỚP TRƯỢT: một khung, ruột đổi theo ô vừa chạm ── */}
      <TamTruot mo={mo} onDong={() => datMo(false)} nhan={nhanTam} chan={chan} dau={tam}>
        {ruot}
      </TamTruot>

      {/* PHÒNG CHỜ — lớp đè toàn màn (đã là lớp đè, z 66 trên lớp trượt): gọi tạo trận, lộ ghế, rồi vào. */}
      {phongCho && (
        <PhongCho
          cheDo={phongCho.cheDo}
          soO={soO}
          khauVi={KHAU_VI_MAC_DINH}
          banMa={phongCho.banMa}
          epSeed={phongCho.epSeed}
          epBalance={phongCho.epBalance}
          onHuy={() => setPhongCho(null)}
          onChuaDongY={() => { setPhongCho(null); setChuaDongY(true); moTam('xep'); }}
        />
      )}
    </div>
  );
}

/** Giếng bàn — hàng `so` lá úp trên mặt nỉ (hình khối, không chữ; `so` = số ô THẬT của bàn, 0 ⇒ giếng rỗng giữ chỗ). */
function GiengBan({ so }: { so: number }): React.ReactElement {
  return (
    <span className={s.gieng} aria-hidden="true">
      <span className={s.hangO}>
        {Array.from({ length: Math.max(0, Math.min(so, 20)) }, (_, i) => <i key={i} className={s.oBan} />)}
      </span>
    </span>
  );
}
