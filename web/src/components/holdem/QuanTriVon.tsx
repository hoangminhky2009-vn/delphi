/**
 * QUẢN TRỊ VỐN — hai cần gạt của lõi vốn, bấm được ngay trên bàn đấu.
 *
 *   · TÁI CƠ CẤU  (engine: đảo danh mục) — bán một bản mã đang nắm để mua mã
 *     khác. Trả phí chuyển đổi, và còn phải XẾP HÀNG khớp lệnh cùng mọi dòng
 *     tiền mới vào mã đích trong vòng đó.
 *   · KHOÁ NẮM GIỮ (engine: khoá tài sản 2 vòng) — hứa giữ một mã suốt chu kỳ,
 *     đổi lấy đỡ trượt giá + thưởng đi qua bão. Bỏ giữa chừng thì rất đắt.
 *
 * ─── HAI THỨ FILE NÀY TUYỆT ĐỐI KHÔNG LÀM ──────────────────────────────────
 *  1. KHÔNG TÍNH TIỀN. Mọi con số là số server gửi (`catalog.dao_danh_muc` /
 *     `catalog.khoa_tai_san`, đều đánh dấu `MC-TUNE` nên còn đổi mỗi mùa). Gõ
 *     lại một con số ở đây là dựng nguồn chân lý thứ hai, và biểu hiện của việc
 *     nó lệch là màn hình niêm yết một đằng, engine trừ một nẻo (C4).
 *  2. KHÔNG TỰ SUY "được phép hay không". `dao_duoc`/`khoa_duoc`/`von_bi_giam`
 *     do server suy bằng ĐÚNG bộ điều kiện `apDaoDanhMuc`/`apKhoaTaiSan` dùng
 *     để nhận lệnh. Suy lại ở client thì lệch, và lệch ở đây trông đúng như bẫy
 *     số 1 của repo: nút vẫn sáng, bấm vào không có gì xảy ra.
 *
 * ─── VÌ SAO LỰA CHỌN Ở ĐÂY LÀ "CHỜ CHỐT PHIÊN", KHÔNG PHẢI POST NGAY ───────
 * Cả hai lệnh chạy ở NHỊP 1 của vòng, cùng chỗ với việc mua thẻ, và chúng đi
 * kèm lệnh nộp vòng (`POST /rounds`). Nên bấm ở đây là CHỌN — y hệt chọn thẻ ở
 * shop — và panel nói thẳng điều đó. Bắn một POST riêng sẽ đẻ thêm một dòng
 * trong `action_log`, mà log LÀ nguồn dựng lại trận.
 *
 * ─── CẢNH BÁO PHÁ CAM KẾT LÀ MỘT CỔNG, KHÔNG PHẢI MỘT DÒNG CHỮ ────────────
 * Chọn bán đúng mã đang khoá (và đang giữ bản cuối cùng của nó) thì lệnh KHÔNG
 * được nhận ngay: hộp đỏ hiện ra, phải bấm thêm một nút nữa. Cảnh báo chỉ để
 * đọc là cảnh báo bị lướt qua.
 */
import { useState } from 'react';
import { PixelIcon } from '@/components/ui';
import {
  T_KHOA_NAM_GIU_UPPER, T_PHA_CAM_KET_UPPER, T_TAI_CO_CAU_UPPER, T_VON,
} from '@/lib/vocab';
import type {
  DaoDanhMucDTO, KhoaTaiSanDTO, TaiSanDTO, TrangThaiDTO,
} from '@/api/holdem';
import s from './QuanTriVon.module.css';

/** Lệnh đảo đang chọn — cùng hình dạng với `NopVongInput.dao`. */
export interface LenhDao {
  tu: string;
  den: string;
}

export type KhoaDangChay = NonNullable<TrangThaiDTO['ban']['khoa']>;

/**
 * VÌ SAO LỆNH BỊ TỪ CHỐI — dịch mã lỗi của engine sang câu người chơi đọc được.
 *
 * Bảng đầy đủ `LoiDao | LoiKhoa` (server/holdem/engine.ts). Chép tay nên có thể
 * lệch khi engine thêm mã mới — vì vậy nhánh cuối NÓI THẬT là chưa biết thay vì
 * đoán bừa một lý do sai, cùng nếp với bảng nhãn của ChainReveal.
 */
const CHU_LOI: Record<string, string> = {
  luat_tat: 'Trận này chạy bộ luật cũ, chưa có cần gạt vốn.',
  chua_toi_vong: 'Chưa tới vòng được tái cơ cấu.',
  khong_chon_bai_duoc: 'Tư thế hiện tại không cho đổi danh mục.',
  ma_khong_ton_tai: 'Mã đích không có trong trò.',
  trung_ma: 'Bán và mua cùng một mã thì không đổi được gì.',
  khong_nam_ma: 'Bạn không nắm mã đó ở thời điểm lệnh chạy.',
  da_dao_vong_nay: 'Mỗi vòng chỉ tái cơ cấu được một lần.',
  day_tai_san: 'Danh mục đã đầy — mã đích là mã thứ năm.',
  da_toi_da_ban_sao: 'Đã tới trần số bản sao của mã đích.',
  sai_nhip_vong: 'Chỉ khoá được ở vòng chọn tài sản.',
  dang_khoa: 'Đang có một chu kỳ khoá chạy dở.',
  khong_co_ghe: 'Không tìm thấy ghế của bạn.',
  // D33 — đặc quyền Phòng Hộ (`LoiShort`).
  khong_co_dac_quyen: 'Bạn không cầm thẻ Phòng Hộ nên chưa mở được lệnh này.',
  da_dat_vong_nay: 'Mỗi vòng chỉ đặt được một lệnh phòng hộ.',
  vong_cuoi: 'Lệnh khớp ở vòng sau, mà vòng này là vòng cuối.',
  // v34 — mandate tổ chức (`LoiLenh`).
  mandate_ma: 'MANDATE tổ chức: không mua mã nào quá 40% NAV — chia vốn ra.',
  mandate_khong: 'MANDATE tổ chức: vai này không được Bán Khống.',
  /*
   * v42 (D311/D313) — sàn cấm khống mã này. Nói rõ đây là giới hạn của THỊ TRƯỜNG
   * chứ không phải hình phạt của trò chơi, và nói luôn ngoại lệ VN30 — không thì
   * người chơi đọc thành "game dở" thay vì học được một sự thật về sàn VN.
   */
  khong_cam_san:
    'Sàn Việt Nam chưa cho bán khống cổ phiếu cơ sở. Blue-chip thì khống được — nó có '
    + 'hợp đồng phái sinh.',
};

const chuLoi = (ma: string): string =>
  CHU_LOI[ma] ?? `Lệnh bị từ chối (mã: ${ma}).`;

/** bp → phần trăm gọn. 5000 → "50%". Chỉ để đọc, không dùng để tính gì. */
const pct = (bp: number): string => `${Math.round(bp / 100)}%`;

export interface QuanTriVonProps {
  /** Mã ĐANG NẮM, giữ nguyên bản sao — số lượng quyết định bán một bản có phá
   *  cam kết hay không, nên tuyệt đối đừng lọc trùng trước khi truyền vào. */
  danhMuc: string[];
  /** Toàn bộ mã trong trò — đích của lệnh tái cơ cấu. */
  moiMa: TaiSanDTO[];
  /**
   * Mã khoá được: danh mục ∪ lá tài sản đang chọn mua vòng này.
   *
   * Lá đang chọn CÓ trong tập này vì hai hàm engine chạy SAU `mua` — khoá được
   * đúng lá vừa lấy ở quầy, và đó là nước đi tự nhiên nhất của vòng chọn bài.
   */
  maKhoaDuoc: string[];
  giaDao: DaoDanhMucDTO;
  giaKhoa: KhoaTaiSanDTO;
  /** Dịch id giai đoạn sang nhãn — bảng nhãn ở catalog, không gõ tay. */
  nhanGiaiDoan: (id: string) => string;
  khoa: KhoaDangChay | null;
  daoDuoc: boolean;
  khoaDuoc: boolean;
  vonBiGiam: boolean;
  chonDao: LenhDao | null;
  chonKhoa: string | null;
  onChonDao: (v: LenhDao | null) => void;
  onChonKhoa: (v: string | null) => void;
  /** Lệnh vòng TRƯỚC bị engine bỏ qua — `TrangThaiDTO.loi_von`. */
  loi?: { dao?: string; khoa?: string; short?: string } | null;
  /** Đang nộp vòng / đang diễn vòng — khoá thao tác, đúng như quầy thẻ. */
  vohieu?: boolean;

  /*
   * ─── D33 — ĐẶC QUYỀN PHÒNG HỘ (SHORT) ─────────────────────────────────────
   *
   * Ở CHUNG PANEL với hai cần gạt kia vì cả ba là lệnh của NHỊP 1 và cả ba đi
   * kèm cùng một lệnh nộp vòng. Tách ra một panel riêng sẽ có ngày một cái bắn
   * POST riêng — tức thêm một dòng trong `action_log`, mà log LÀ nguồn dựng lại
   * trận.
   *
   * `shortDuoc` do SERVER suy (nhịp vòng · cỡ map · tư thế · đã đặt chưa). Đừng
   * suy lại: xem luật 2 ở đầu file.
   */
  shortDuoc?: boolean;
  /** Lệnh đang treo — đặt vòng trước, hoặc vừa đặt vòng này. */
  shortDangCo?: { ma: string; vong_dat: number } | null;
  /** Lệnh KHỚP ở vòng này — người chơi phải thấy nó ăn/thua vào lúc nào. */
  shortKhop?: { ma: string; vong_dat: number } | null;
  chonShort?: string | null;
  onChonShort?: (v: string | null) => void;
}

export function QuanTriVon({
  danhMuc, moiMa, maKhoaDuoc, giaDao, giaKhoa, nhanGiaiDoan, khoa,
  daoDuoc, khoaDuoc, vonBiGiam, chonDao, chonKhoa, onChonDao, onChonKhoa,
  loi, vohieu = false,
  shortDuoc = false, shortDangCo = null, shortKhop = null,
  chonShort = null, onChonShort,
}: QuanTriVonProps) {
  /** Mã đã chọn để BÁN, đang chờ chọn mã mua. Bước 1 của lệnh hai vế. */
  const [banTam, setBanTam] = useState<string | null>(null);
  /** Mã đang chờ người chơi xác nhận phá cam kết. Không phải lựa chọn đã nhận. */
  const [hoiPha, setHoiPha] = useState<string | null>(null);

  const ten = (id: string) => moiMa.find((x) => x.id === id)?.label ?? id;
  const demBan = (id: string) => danhMuc.filter((x) => x === id).length;
  const dangNam = [...new Set(danhMuc)];

  /**
   * Bán mã này có PHÁ CAM KẾT không.
   *
   * Chỉ khi đây là mã đang khoá VÀ đang giữ bản cuối cùng: engine chấm bẻ kèo
   * bằng "mã khoá còn trong danh mục hay không", nên bán một trong hai bản sao
   * thì lời hứa vẫn nguyên.
   */
  const laPhaCamKet = (id: string) => !!khoa && khoa.ma === id && demBan(id) <= 1;

  function chonBan(id: string) {
    if (chonDao) return;
    if (banTam === id) { setBanTam(null); return; }
    if (laPhaCamKet(id)) { setHoiPha(id); return; }
    setBanTam(id);
  }

  function chonMua(id: string) {
    if (!banTam || id === banTam) return;
    onChonDao({ tu: banTam, den: id });
    setBanTam(null);
  }

  function huyDao() {
    onChonDao(null);
    setBanTam(null);
    setHoiPha(null);
  }

  const buoc = chonDao ? 'xong' : banTam ? 'mua' : 'ban';

  /*
   * ── THU GỌN KHI KHÔNG CÓ GÌ ĐỂ LÀM (founder 27/07) ────────────────────────
   *
   * Founder mở bàn đấu và thấy nguyên khối này ở vòng 1:
   *     "TÁI CƠ CẤU · mở từ vòng 2 · Giá: −100 bp phí chuyển đổi, CỘNG xếp hàng
   *      khớp lệnh… · 1 · BÁN MÃ NÀO · Chưa nắm mã nào để bán. · KHOÁ NẮM GIỮ 2
   *      VÒNG · chọn 1 mã · Được:… Trả:… · Chưa có mã nào để khoá."
   * — hai bảng giá dài cho hai chức năng KHÔNG BẤM ĐƯỢC, kết bằng hai câu "chưa
   * có gì". Founder gọi đúng tên: *"thừa thãi… đang bị lỗi và vô giá trị hiển thị"*.
   *
   * ⚠ NGUYÊN TẮC, không phải một cú che tạm: **giá của một nước đi chỉ đáng chỗ
   * trên màn hình khi nước đi đó bấm được.** Bày bảng giá cho thứ chưa mở là dạy
   * người chơi bỏ qua vùng đó — và khi nó mở thật thì họ đã quen không đọc.
   * Đây cũng là chỗ khác nhau giữa "hiện vô điều kiện" của D25/R1 và cái này:
   * R1 buộc hiện thứ ĐANG ẢNH HƯỞNG quyết định. Ở đây không có quyết định nào để
   * ảnh hưởng — không mã nào để bán, không mã nào để khoá, không hậu quả nào đang
   * chạy. Thu gọn ở trạng thái đó KHÔNG giấu thông tin ai cần.
   *
   * Vẫn giữ MỘT DÒNG nói khi nào nó mở, để người chơi biết vùng này tồn tại và
   * đáng quay lại — biến mất hẳn thì lần đầu nó hiện ra sẽ như một thứ lạ.
   */
  const coViecLam = (daoDuoc && dangNam.length > 0)
    || (khoaDuoc && maKhoaDuoc.length > 0)
    || shortDuoc;
  const coHauQua = !!khoa || !!shortDangCo || !!shortKhop
    || vonBiGiam || !!loi?.dao || !!loi?.khoa;

  if (!coViecLam && !coHauQua) {
    return (
      <div className={s.hop}>
        <div className={s.trong}>
          {T_TAI_CO_CAU_UPPER} · {T_KHOA_NAM_GIU_UPPER}
          {' — '}
          {dangNam.length === 0
            ? 'mở khi bạn đã nắm ít nhất một mã.'
            : `mở từ vòng ${giaDao.TU_VONG}.`}
        </div>
      </div>
    );
  }

  return (
    <div className={s.hop}>
      {/* ── Chu kỳ khoá đang chạy: còn mấy vòng, và bỏ giữa chừng mất gì ── */}
      {khoa && (
        <div className={s.bangKhoa} role="status">
          <div className={s.bangDau}>
            <PixelIcon name="lock" size={16} className={s.iconDong} />
            {' '}{T_KHOA_NAM_GIU_UPPER}: {ten(khoa.ma)}
            <span className={`${s.demVong} ${khoa.la_vong_chot ? s.demChot : ''}`}>
              {khoa.la_vong_chot
                ? 'VÒNG CHỐT'
                : `CÒN ${khoa.con_vong} VÒNG`}
            </span>
          </div>
          <ul className={s.loiIch}>
            <li>Trượt giá do đông ở {ten(khoa.ma)} chỉ còn {pct(giaKhoa.TRUOT_GIA_CON_BP)}.</li>
            <li>
              +{giaKhoa.THUONG_SONG_SOT_BP} bp mỗi vòng nếu vẫn còn cầm khi thị
              trường ở {giaKhoa.GIAI_DOAN_BAO.map(nhanGiaiDoan).join(' / ')}.
              {' '}Đã nhận <b>{khoa.thuong_da_nhan_bp} bp</b>.
            </li>
          </ul>
          <div className={`${s.gia} ${s.giaDo}`}>
            {T_PHA_CAM_KET_UPPER} (bán {ten(khoa.ma)} hoặc bỏ vòng ở vòng chốt):
            {' '}−{giaKhoa.PHAT_BE_KEO_BP} bp, thu hồi {khoa.thuong_da_nhan_bp} bp
            {' '}đã thưởng, và {T_VON} bị giam {giaKhoa.GIAM_VON_SO_VONG} vòng.
          </div>
        </div>
      )}

      {/* ── Hậu quả đang chạy: nói ra, đừng để người chơi tự đoán ── */}
      {vonBiGiam && (
        <div className={s.bangGiam} role="status">
          {T_VON} ĐANG BỊ GIAM — vòng này không Tăng cam kết và không Khảo sát
          lại được. Hậu quả của lần {T_PHA_CAM_KET_UPPER.toLowerCase()} vừa rồi.
        </div>
      )}

      {/* ── Lệnh vòng trước bị từ chối ── */}
      {loi?.dao && (
        <div className={s.bangLoi} role="alert">
          Lệnh {T_TAI_CO_CAU_UPPER.toLowerCase()} vòng trước KHÔNG chạy: {chuLoi(loi.dao)}
        </div>
      )}
      {loi?.khoa && (
        <div className={s.bangLoi} role="alert">
          Lệnh {T_KHOA_NAM_GIU_UPPER.toLowerCase()} vòng trước KHÔNG chạy: {chuLoi(loi.khoa)}
        </div>
      )}

      {/*
        * ── TÁI CƠ CẤU ──
        *
        * `<section aria-label>` chứ không phải `<div>`: hai mục dưới đây chào
        * CÙNG một danh sách mã, nên không có ranh giới đọc được thì cả người
        * dùng trình đọc màn hình lẫn test đều không phân biệt nổi "bán BTC" với
        * "khoá BTC". Đây là ranh giới ngữ nghĩa thật, không phải móc cho test.
        */}
      <section
        aria-label={T_TAI_CO_CAU_UPPER}
        className={`${s.muc} ${daoDuoc ? '' : s.mucKhoa}`}
      >
        <div className={s.mucTen}>
          {T_TAI_CO_CAU_UPPER}
          <span className={s.mucVi}>
            {daoDuoc ? 'bán 1 mã · mua 1 mã' : `mở từ vòng ${giaDao.TU_VONG}`}
          </span>
        </div>

        {/* GIÁ TRƯỚC KHI BẤM — cả hai vế, kể cả vế không phải con số cố định. */}
        <div className={s.gia}>
          Giá: −{giaDao.PHI_CHUYEN_DOI_BP} bp phí chuyển đổi, CỘNG xếp hàng khớp
          lệnh ở mã mua — càng nhiều người cùng vào mã đó trong vòng thì trượt giá
          càng nặng (từ {giaDao.NGUONG_XEP_HANG} người trở lên).
        </div>

        {chonDao ? (
          <div className={s.daChon}>
            {ten(chonDao.tu)} → {ten(chonDao.den)}
            <button type="button" className={s.huy} onClick={huyDao}>
              ✕ HUỶ
            </button>
          </div>
        ) : hoiPha ? (
          /*
           * CỔNG XÁC NHẬN. Lựa chọn CHƯA được nhận ở đây — `onChonDao` chỉ chạy
           * sau khi bấm nút đỏ, nên lỡ tay một cú không mất gì.
           */
          <div className={s.canhBao} role="alert">
            Bán {ten(hoiPha)} là {T_PHA_CAM_KET_UPPER.toLowerCase()}:
            {' '}−{giaKhoa.PHAT_BE_KEO_BP} bp, thu hồi {khoa?.thuong_da_nhan_bp ?? 0} bp
            {' '}đã thưởng, và {T_VON} bị giam {giaKhoa.GIAM_VON_SO_VONG} vòng
            (không Tăng cam kết, không Khảo sát lại).
            <div className={s.hangNut}>
              <button
                type="button" className={s.nutPha} disabled={vohieu}
                onClick={() => { setBanTam(hoiPha); setHoiPha(null); }}
              >
                {T_PHA_CAM_KET_UPPER}
              </button>
              <button
                type="button" className={s.nutGiu}
                onClick={() => setHoiPha(null)}
              >
                ‹ GIỮ CAM KẾT
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={s.nhanBuoc}>
              {buoc === 'mua' ? `2 · MUA MÃ NÀO (đang bán ${ten(banTam!)})` : '1 · BÁN MÃ NÀO'}
            </div>
            <div className={s.hangMa}>
              {buoc === 'mua'
                ? moiMa.filter((t) => t.id !== banTam).map((t) => (
                  <button
                    key={t.id} type="button" className={s.vien}
                    disabled={!daoDuoc || vohieu}
                    onClick={() => chonMua(t.id)}
                  >
                    {t.label}
                  </button>
                ))
                : dangNam.length === 0
                  ? <span className={s.trong}>Chưa nắm mã nào để bán.</span>
                  : dangNam.map((id) => (
                    <button
                      key={id} type="button"
                      className={laPhaCamKet(id) ? s.vienKhoa : s.vien}
                      disabled={!daoDuoc || vohieu}
                      onClick={() => chonBan(id)}
                    >
                      {ten(id)}
                      {demBan(id) > 1 && <span className={s.capMa}>×{demBan(id)}</span>}
                    </button>
                  ))}
            </div>
          </>
        )}
      </section>

      {/* ── KHOÁ NẮM GIỮ ── */}
      <section
        aria-label={T_KHOA_NAM_GIU_UPPER}
        className={`${s.muc} ${khoaDuoc ? '' : s.mucKhoa}`}
      >
        <div className={s.mucTen}>
          <PixelIcon name="lock" size={16} className={s.iconDong} />
          {' '}{T_KHOA_NAM_GIU_UPPER} {giaKhoa.SO_VONG} VÒNG
          <span className={s.mucVi}>
            {khoaDuoc ? 'chọn 1 mã' : khoa ? 'đang có chu kỳ chạy' : 'chỉ ở vòng chọn tài sản'}
          </span>
        </div>

        <div className={s.gia}>
          Được: trượt giá do đông chỉ còn {pct(giaKhoa.TRUOT_GIA_CON_BP)}, và
          {' '}+{giaKhoa.THUONG_SONG_SOT_BP} bp mỗi vòng còn cầm khi thị trường ở
          {' '}{giaKhoa.GIAI_DOAN_BAO.map(nhanGiaiDoan).join(' / ')}.
        </div>
        <div className={`${s.gia} ${s.giaDo}`}>
          Trả: bỏ giữa chừng là −{giaKhoa.PHAT_BE_KEO_BP} bp, thu hồi toàn bộ
          thưởng đã nhận, và {T_VON} bị giam {giaKhoa.GIAM_VON_SO_VONG} vòng.
        </div>

        {chonKhoa ? (
          <div className={s.daChon}>
            Sẽ khoá {ten(chonKhoa)}
            <button
              type="button" className={s.huy} onClick={() => onChonKhoa(null)}
            >
              ✕ HUỶ
            </button>
          </div>
        ) : maKhoaDuoc.length === 0 ? (
          <span className={s.trong}>Chưa có mã nào để khoá.</span>
        ) : (
          <div className={s.hangMa}>
            {maKhoaDuoc.map((id) => (
              <button
                key={id} type="button" className={s.vien}
                disabled={!khoaDuoc || vohieu}
                onClick={() => onChonKhoa(id)}
              >
                {ten(id)}
              </button>
            ))}
          </div>
        )}
      </section>

      {/*
        * ── D33 — PHÒNG HỘ: ĐẶT VÒNG NÀY, KHỚP VÒNG SAU ──
        *
        * ⚠ CÂU "KHỚP Ở VÒNG SAU" PHẢI ĐỨNG NGAY TRÊN NÚT, không nằm trong một
        * tooltip: độ trễ một vòng LÀ toàn bộ nội dung của lá bài. Người chơi
        * tưởng lệnh khớp ngay sẽ đọc kết quả vòng này rồi kết luận thẻ hỏng, và
        * đó là hiểu lầm mà UI gây ra chứ không phải engine.
        *
        * `onChonShort` optional nên panel vẫn dựng được ở bản chưa nối — nhưng
        * lúc đó mục tự ẩn, KHÔNG hiện một nút chết.
        */}
      {onChonShort && (shortDuoc || shortDangCo || shortKhop) && (
        <section aria-label="PHÒNG HỘ" className={`${s.muc} ${shortDuoc ? '' : s.mucKhoa}`}>
          <div className={s.mucTen}>
            PHÒNG HỘ
            <span className={s.mucVi}>
              {shortDuoc ? 'chọn 1 mã · khớp VÒNG SAU' : 'đặc quyền thẻ Phòng Hộ'}
            </span>
          </div>

          <div className={s.gia}>
            Đặt ở vòng này, <b>lệnh khớp ở VÒNG SAU</b>: ăn đúng phần NGƯỢC LẠI
            với việc nắm giữ mã đó. Đoán đúng thì bù cho danh mục; đoán sai thì
            lỗ chồng lỗ.
          </div>

          {shortKhop && (
            <div className={s.daChon} role="status">
              Lệnh {ten(shortKhop.ma)} đặt ở vòng {shortKhop.vong_dat} KHỚP vòng này.
            </div>
          )}

          {chonShort ? (
            <div className={s.daChon}>
              Sẽ phòng hộ {ten(chonShort)}
              <button
                type="button" className={s.huy}
                onClick={() => onChonShort(null)}
              >
                ✕ HUỶ
              </button>
            </div>
          ) : (
            <div className={s.hangMa}>
              {moiMa.map((t) => (
                <button
                  key={t.id} type="button" className={s.vien}
                  disabled={!shortDuoc || vohieu}
                  onClick={() => onChonShort(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {loi?.short && (
        <div className={s.bangLoi} role="alert">
          Lệnh phòng hộ vòng trước KHÔNG chạy: {chuLoi(loi.short)}
        </div>
      )}

      <span className={s.trong}>
        Mọi lệnh trên chạy khi bạn chốt phiên vòng này — chọn xong vẫn huỷ được.
      </span>
    </div>
  );
}
