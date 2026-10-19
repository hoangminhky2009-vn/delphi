/**
 * PFM — MÀN **CHÂN DUNG HÀNH TINH** (`/tai-chinh/the`, 21/09).
 *
 * Làm theo DEMO ĐÃ CHỐT `docs/ui-ux/demo/pfm-chan-dung.html`, màn `cd` (A11.25 — demo đứng
 * trên mọi văn bản kế hoạch; token màu và số đo chép NGUYÊN, không diễn giải lại).
 *
 * ⚠⚠ ĐÂY LÀ THẺ CỦA **PFM**, KHÔNG PHẢI THẺ CỦA ĐẤU TRƯỜNG. Chỉ thị founder 21/09: *"Thẻ tính
 * cách từ alpha draft thì vẫn giữ nguyên nhưng để trên profile còn thẻ PFM thì riêng nhé"*.
 * Tới 20/09, địa chỉ này render `TaiChinh.tsx` — tức thẻ ĐO TỪ TRẬN nằm trong thanh tab PFM.
 * Màn ấy nay ở `/ho-so/the`, nguyên vẹn. Ranh giới là NGUỒN BẰNG CHỨNG:
 *   · `/ho-so/the`     — đo từ hành vi trong trận (mạnh, phải đã chơi)
 *   · màn này          — lời khai ở phỏng vấn (yếu, nói được từ phút đầu)
 * Cả hai đều nói về tiền, nên để chung chỗ là mời người đọc tin lời khai ngang hành vi đã đo.
 *
 * ⚠ A10 🔒 — chỉ MÔ TẢ. Không hành tinh nào hơn hành tinh nào; không một chữ nên/hãy/cần
 *   (bộ quét `TU_KE_DON` chạy trên toàn `pfm_chu.ts`). Mọi chữ ở `lib/pfm_chu.ts` (D26).
 * ⚠ P6 — màn PHẢI nói ra rằng nó dựng từ LỜI KHAI, chưa phải từ sổ. Giấu hạng bằng chứng là
 *   nói dối bằng cách im lặng, và đó đúng là chỗ một "chân dung" trượt thành lá số tử vi.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { coDom, tatDom } from '@/lib/dom_bao';
import { NutChinh } from '@/components/ui/OBento';
import { PixelIcon, type PixelIconName } from '@/components/ui/PixelIcon';
import { TamTruot } from '@/components/ui/TamTruot';
import { TamDau } from '@/screens/hub/TamDau';
import b from '@/components/pfm/PfmBento.module.css';
import { MatThe, type TamThe } from './TheBento';
import { KhoProvider, useCaiDatMay, useGhiKho, useHoSo, useHu, useLuat, useSoTatCa } from '@/pfm/dung_kho';
import { useCuaPfm } from '@/api/pfm';
import { useNangLuc } from '@/api/tinh_cach';
import { demQuyetDinh } from '@/pfm/huong';
import { soNgayCoGhi } from '@/pfm/chan_dung';
import { tongLoiDoan } from '@/pfm/vi_the';
import { MatBaMat, dungBaMat } from './BaMat';
import { soCauDaTraLoi, suaHoSo, tienDoHoSo } from '@/pfm/ho_so';
import { thanhTich } from '@/pfm/so_doan';
import { bayGio, homNay, ngayViet } from '@/pfm/thoi_gian';
import { baoLoiNen } from '@/lib/telemetry';
import { oHanhTinh, toaDoTuNhan, trucSatRia, vanhDai, type ToaDoChanDung } from '@/pfm/chan_dung_hanh';
import { chanDung } from '@/pfm/chan_dung';
import {
  CHAN_DUNG_NOI_DUNG, CHU_BENTO as CB, CHU_COT_HANH, CHU_HANG_HANH, CHU_HANH_TINH, CHU_HUONG,
  CHU_MAN_CHAN_DUNG as C, CHU_MAN_GUONG, CHU_TRUC_HANH, CHU_TU_CHAM, CHU_VANH_HANH,
} from '@/lib/pfm_chu';
import { ROUTE_TAI_CHINH_NGAY_DAU, ROUTE_TAI_CHINH_PHONG_VAN } from '@/lib/vocab';
import s from './ChanDungPfm.module.css';
import { HANH_TINH_MAU } from '@/lib/hanh_tinh_mau';

/**
 * MÀU MẶT HÀNH TINH — chép NGUYÊN từ demo đã chốt (A11.25: *"chép token màu và số đo từ demo
 * sang nguyên vẹn, đừng diễn giải lại"*).
 *
 * ⚠ Đây là DỮ LIỆU của từng ô chứ không phải một tông chủ đề, nên nó ở đây chứ không ở CSS:
 *   chín ô cần chín màu, và viết chín biến CSS rồi chọn bằng tên lớp là dựng bản sao thứ hai
 *   của chính bảng này (A11.5). Màu chỉ vào `style` của đúng một phần tử.
 * ⚠ Ẩn dụ khớp chứ không gán bừa: hàng = khoảng cách tới mặt trời (gần = muốn ngay),
 *   cột = khí quyển dày mỏng (dày = ma sát khi tiền rời tay).
 */
// Màu dời về `lib/hanh_tinh_mau.ts` (11/10) — bản xem trước PFM ở Hub dùng chung, không chép bảng thứ hai (A11.5).
const MAU_HANH = HANH_TINH_MAU;

/** Thanh một trục. `dao` vì hai thang NGƯỢC CHIỀU nhau — xem chú thích tại chỗ gọi. */
function Thang({ trai, phai, gt, dao }: {
  trai: string; phai: string; gt: number | null; dao: boolean;
}): React.ReactElement {
  const coSo = gt !== null;
  const phanTram = coSo ? (dao ? 100 - gt : gt) : 0;
  return (
    <div className={s.thang}>
      <div className={s.thangTen}><span>{trai}</span><span>{phai}</span></div>
      <div className={`${s.thangRanh} ${coSo ? '' : s.chuaDo}`}>
        <i style={{ left: '33.33%' }} />
        <i style={{ left: '66.66%' }} />
        {coSo && (
          /* Phần trăm đặt lên KHUNG CHẠY, không đặt lên chấm — xem `.chamChay` trong CSS. */
          <span className={s.chamChay} style={{ transform: `translateX(${phanTram}%)` }}>
            <i className={s.cham} />
          </span>
        )}
      </div>
      {!coSo && <p className={s.chuaDoChu}>{CHU_TRUC_HANH.chuaDo}</p>}
    </div>
  );
}

// ⚠ Xuất ra cho bài test — nếp `RuotGuong`/`RuotPhongVan` (bản mặc định tự bọc `<KhoProvider>` thật).
export function RuotChanDung(): React.ReactElement {
  const navigate = useNavigate();
  /*
   * ⚠⚠ TỚI NƠI LÀ TẮT — đây là nửa sau bắt buộc của cơ chế đốm. Một đốm không tắt được bằng
   * cách nhìn thì thành lời nhắc dai, và người dùng học cách phớt lờ MỌI đốm trong hai ngày
   * (xem luật ở `lib/dom_bao.ts`). Tắt ngay khi màn dựng, không chờ thao tác nào.
   * ⚠ Đọc TRƯỚC khi tắt: nút "việc đầu tiên" bên dưới phải còn thấy đốm ở chính lượt này —
   *   người ta vừa được mời tới đây, lời mời tiếp theo phải nhìn thấy ngay.
   */
  const [domViec] = useState(() => coDom('hu_dau_tien'));
  useEffect(() => { tatDom('hu_dau_tien'); }, []);
  const { data: hoSo, sanSang } = useHoSo();
  const ghiKho = useGhiKho();

  /*
   * ⚠⚠ D385 — LỜI ĐOÁN "ĐƯỢC ĐƯA RA" LÀ LÚC NÓ HIỆN Ở ĐÂY. Đặt mốc `doanTu` một lần, lúc lời đoán hiện
   * lần đầu. App chỉ tự chấm những kỳ mở ra TỪ mốc này (`so_doan.ts`) — không có mốc thì không cách nào
   * phân biệt "đoán trước" với "đoán sau khi đã biết".
   * ⚠ Người phỏng vấn TRƯỚC D385 không có mốc nào được lưu ⇒ mốc của họ là lần xem tới, KHÔNG bịa một
   *   ngày sớm hơn cho họ. Mất một tuần chấm còn hơn một lượt "trúng" dựng trên ngày đoán giả.
   * ⚠ Hook đặt TRÊN các `return` sớm bên dưới — hook đứng sau một `return` có điều kiện là thứ tự hook
   *   đổi giữa hai lần dựng, React sập cả màn.
   * ⚠ Kiểm lại TRONG lượt ghi (`suaHoSo` đọc bản trong kho): nếu chip nhịp đã đổi từ lúc màn dựng thì
   *   lời đoán trên màn không còn là lời đoán hiện tại — không đặt mốc cho nó.
   */
  const maDoanNay = chanDung(hoSo);
  const coLoiDoan = CHAN_DUNG_NOI_DUNG[maDoanNay].doan !== '';
  const daDatMoc = useRef(false);
  useEffect(() => {
    if (!sanSang || !coLoiDoan || hoSo.doanTu !== undefined || daDatMoc.current) return;
    daDatMoc.current = true;
    const ngay = homNay();
    ghiKho(['meta'], (k) => suaHoSo(k, (cu) => (
      cu.doanTu !== undefined || chanDung(cu) !== maDoanNay ? null : { ...cu, doanTu: ngay }
    ), bayGio())).catch(baoLoiNen);
  }, [sanSang, coLoiDoan, hoSo.doanTu, maDoanNay, ghiKho]);
  const ttDoan = thanhTich(hoSo.soDoan);
  /*
   * ⭐ D453 — HAI CON SỐ ĐẦU THẺ, TÁCH NHAU (đề xuất 28/09, founder duyệt): CĂN CỨ = app có gì để hiểu bạn (quyết định bạn
   *   bấm + ngày sổ có ghi) · APP ĐOÁN ĐÚNG = lời đoán tuần của app trúng mấy lần. Tách để không nói dối: nhiều căn cứ
   *   không có nghĩa là đoán đúng. Thay chỗ thanh "mức độ hiểu bạn" nằm ở màn ngày đầu mà không ai quay lại.
   * ⚠ Hook đặt TRÊN các `return` sớm (xem chú thích mốc lời đoán ở trên).
   */
  const { data: tatCa, sanSang: coSo } = useSoTatCa();
  const { data: hu } = useHu();
  const { data: luat } = useLuat();
  /* Lớp trượt (SPEC `pfm-tang-khong-gian`): MỘT lớp dùng chung, nội dung theo `tam` — hook đặt TRƯỚC các `return` sớm bên dưới. */
  const [tam, datTam] = useState<TamThe>('hanh-tinh');
  const [moTam, datMoTam] = useState(false);
  const mo = useCallback((x: TamThe): void => { datTam(x); datMoTam(true); }, []);
  const dongTam = useCallback((): void => datMoTam(false), []);
  const canCu = demQuyetDinh({ so: tatCa, hu, luat, hoSo });
  const ngaySo = soNgayCoGhi(tatCa);
  /* D453 — NÓI · LÀM · TRONG TRẬN dời từ GƯƠNG về đây: THẺ là màn "bạn là ai", GƯƠNG là màn "tháng này lệch bao nhiêu".
     Cùng cửa `noi_game` (D324), cùng đường đọc `/me/nang-luc` — không một byte mới rời máy. */
  const noiGame = useCuaPfm()?.noi_game === true;
  const nangLuc = useNangLuc(noiGame);
  const [ngayNay_] = useState(() => homNay());
  const thang_ = ngayNay_.slice(0, 7);
  /* ⚠ "Tắt Gương" hứa NGỪNG TÍNH chỉ số mô tả — nên tắt thì không dựng mặt SỔ luôn, không chỉ giấu nó. */
  /* ⚠ Chờ đọc xong công tắc (`sanSang`) rồi mới dựng khối: cổng đọc mặc định lúc chưa về thì người đã tắt Gương vẫn
     thấy mặt SỔ lóe lên một nhịp. */
  const caiDat = useCaiDatMay();
  const guongTat = caiDat.data.guongTat === true;
  const baMat = coSo && caiDat.sanSang && !guongTat ? dungBaMat(tatCa, hu, ngayNay_, thang_) : null;
  const tongDoan = tongLoiDoan(hu, luat, thang_);

  const t: ToaDoChanDung = toaDoTuNhan(hoSo.lucTienVe, hoSo.sauKhiTieu, hoSo.dauThang);
  const o = oHanhTinh(t);
  const ria = trucSatRia(t);
  /*
   * ⚠ "Chưa làm phỏng vấn" KHÁC "đã làm nhưng bỏ qua mấy câu đo". Ca đầu đưa người ta đi trả
   *   lời; ca sau đã có câu trả lời rồi, nói "chưa có chân dung" là phủ nhận việc họ vừa làm.
   * ⚠⚠ PHẢI CHỜ `sanSang`, KHÔNG dùng `dangTai`: hồ sơ chưa nạp xong thì `hoSo` là `{}`, mà
   *   `{}` trông y hệt "chưa trả lời câu nào". Không chờ thì mỗi lần mở màn sẽ loé một nhịp
   *   "CHƯA CÓ CHÂN DUNG" rồi mới nhảy sang chân dung thật — người dùng đọc ra là app quên mình.
   */
  if (!sanSang) return <div className={s.than} aria-busy="true" />;

  if (soCauDaTraLoi(hoSo) === 0) {
    return (
      <div className={s.than}>
        <p className={s.tieu}>{C.chuaLamTieu}</p>
        <div className={s.khoi}><p className={s.mo}>{C.chuaLamThan}</p></div>
        <button
          type="button" className={`${s.nutChinh} ${s.khac}`}
          onClick={() => navigate(ROUTE_TAI_CHINH_PHONG_VAN)}
        >
          {C.chuaLamNut}
        </button>
      </div>
    );
  }

  const maDoan = chanDung(hoSo);
  const doan = CHAN_DUNG_NOI_DUNG[maDoan].doan;

  /* ── MẶT BENTO (SPEC `pfm-tang-khong-gian` mục 4.3): hành tinh · căn cứ · đoán đúng · độ nhất quán; chi tiết ở lớp trượt ── */
  const dangTaiMat = !coSo || !caiDat.sanSang;
  const hanh = o === null ? null : {
    ten: CHU_HANH_TINH[`${o.hang}${o.cot}` as keyof typeof CHU_HANH_TINH],
    hang: o.hang, cot: o.cot, vanh: vanhDai(t),
    mau: MAU_HANH[`${o.hang}${o.cot}`] ?? MAU_HANH['11']!,
    phu: `${CHU_HANG_HANH[String(o.hang) as '0' | '1' | '2']} · ${CHU_COT_HANH[String(o.cot) as '0' | '1' | '2']} · ${
      CHU_VANH_HANH[String(vanhDai(t)) as '0' | '1' | '2'].split(' — ')[0]}`,
  };
  /* ĐỘ NHẤT QUÁN: ba thước từ DỮ LIỆU ĐÃ CÓ của mặt cũ (`dungBaMat` · `tongLoiDoan`) — không công thức mới; bỏ tên nguồn. Thiếu mẫu ⇒ null. */
  const nhatQuan = (() => {
    const giuTong = baMat === null ? 0 : baMat.giu.giu + baMat.giu.bo;
    const xet = tongDoan.theoChac.reduce((a, x) => a + x.n, 0);
    const toi = tongDoan.theoChac.reduce((a, x) => a + x.toi, 0);
    return [
      { ma: 'giu', ten: CB.theGiuCamKet, pct: baMat === null || giuTong === 0 ? null : Math.round((baMat.giu.giu / giuTong) * 100) },
      { ma: 'doan', ten: CB.theLoiDoanDung, pct: baMat === null || xet === 0 ? null : Math.round((toi / xet) * 100) },
      { ma: 'chia', ten: CB.theChiaHu, pct: baMat === null || baMat.daChia === null ? null : Math.round(baMat.daChia * 100) },
    ];
  })();

  const dauSheet = (icon: PixelIconName, ten: string, tag: string): React.ReactElement => (
    <TamDau icon={<PixelIcon name={icon} size={32} />} ten={ten} tag={tag} />
  );
  const chotNhan = tam === 'hanh-tinh' ? CB.theChanDung : tam === 'can-cu' ? CB.theCanCu : tam === 'doan-dung' ? CB.theDoanDung : CB.theNhatQuan;
  let ruot: React.ReactNode = null;
  let chan: React.ReactNode;
  if (tam === 'hanh-tinh') {
    ruot = (
      <>
        {dauSheet('analyze', hanh === null ? CB.theChuaVe : hanh.ten, CB.theChanDung)}
        {o === null ? (
          <div className={s.khoi}>
            <p className={s.mo}>
              {C.chuaDuPre}
              <b>{t.b === null ? C.chuaDuB : C.chuaDuDau}</b>
              {C.chuaDuHau}
            </p>
          </div>
        ) : (
          <>
            {/*
              ⚠⚠ HAI THANG NGƯỢC CHIỀU NHAU (chỗ đã sai một lần ở demo): β — nhãn TRÁI là MUỐN NGAY mà `b` CAO nghĩa là muốn ngay ⇒ chấm
              về TRÁI ⇒ đảo; đau — nhãn PHẢI là TIẾC KHI TIÊU và `dau` CAO là tiếc ⇒ chấm về PHẢI ⇒ KHÔNG đảo.
            */}
            <Thang trai={CHU_TRUC_HANH.bTrai} phai={CHU_TRUC_HANH.bPhai} gt={t.b} dao />
            <Thang trai={CHU_TRUC_HANH.dauTrai} phai={CHU_TRUC_HANH.dauPhai} gt={t.dau} dao={false} />
            {ria.length > 0 && (
              <p className={s.riaChu}>
                {C.riaPre}<b>{C.riaDam}</b>{C.riaGiua}
                {ria[0] === 'b' ? CHU_TRUC_HANH.riaB : CHU_TRUC_HANH.riaDau}
                {C.riaHau}
              </p>
            )}
          </>
        )}
        {/* ⚠ P6 — khai thẳng hạng bằng chứng: lời khai là bằng chứng yếu; giấu nó là nói dối bằng cách im lặng. */}
        <p className={s.mo}>{C.nguonPre}<b>{C.nguonDam}</b>{C.nguonHau}</p>
      </>
    );
    chan = (
      <NutChinh dau="the-sua-lai" onChon={() => navigate(ROUTE_TAI_CHINH_PHONG_VAN)}>{C.nutSuaLai}</NutChinh>
    );
  } else if (tam === 'can-cu') {
    const td = tienDoHoSo(hoSo);
    ruot = (
      <>
        {dauSheet('sach', CB.theCanCu, CB.theCanCuTag)}
        <div className={b.dongL}><span>{CB.theHangPhongVan}</span><b>{`${td.daTraLoi}/${td.tong}${CB.theCauHau}`}</b></div>
        <div className={b.dongL}><span>{CB.theHangSo}</span><b>{`${ngaySo}${CB.theNgayGhiHau}`}</b></div>
        <div className={b.dongL}>
          <span>{CB.theHangTran}</span>
          <em>
            {noiGame && nangLuc.data !== undefined && nangLuc.data.so_de > 0
              ? `${nangLuc.data.so_de}${CB.theDeHau}` : CB.chuaDuDeNoi}
          </em>
        </div>
        <div className={b.dongL}><span>{CHU_HUONG.theCanCu}</span><b data-testid="the-can-cu-sheet">{canCu}</b></div>
        <p className={b.ghiChu}>{CHU_HUONG.theHaiSoGiai}</p>
      </>
    );
  } else if (tam === 'doan-dung') {
    ruot = (
      <>
        {dauSheet('target', CB.theDoanDung, CB.theDoanDungTag)}
        {doan !== '' ? (
          <>
            <div className={b.khoiDoan}>
              <span className={b.nhanDoan}>{`${C.doanTieu} · ${C.doanNhan}`}</span>
              <b>{doan}</b>
            </div>
            <p className={s.mo} data-testid="cham-o">
              {C.chamOPre}<b>{C.chamODam}</b>
              {hoSo.doanTu !== undefined ? <>{C.chamOTuMoc}<b>{ngayViet(hoSo.doanTu)}</b>.</> : C.chamOChuaMoc}
            </p>
          </>
        ) : <p className={b.ghiChu}>{CB.theChuaCoDoan}</p>}
        {ttDoan.trung + ttDoan.trat > 0 ? (
          <p className={s.mo} data-testid="thanh-tich-doan">
            {CHU_TU_CHAM.thanhTichPre}<b>{ttDoan.trung}</b>{CHU_TU_CHAM.thanhTichTrung}<b>{ttDoan.trat}</b>{CHU_TU_CHAM.thanhTichTrat}
          </p>
        ) : <p className={b.ghiChu}>{CHU_HUONG.theChuaCham}</p>}
      </>
    );
  } else {
    ruot = (
      <>
        {dauSheet('analyze', CB.theNhatQuan, CB.theNhatQuanTag)}
        {baMat === null
          ? <p className={b.ghiChu} data-testid="guong-tat-ba-mat">{CHU_MAN_GUONG.guongTat}</p>
          : <MatBaMat so={baMat} hoSo={hoSo} noiGame={noiGame} nl={nangLuc.data} tongDoan={tongDoan} thang={thang_} gonNguon />}
      </>
    );
  }

  return (
    <div className={b.trang} data-testid="the-bento-goc">
      <MatThe
        dangTai={dangTaiMat}
        hanh={hanh}
        thieu={o === null ? (t.b === null ? C.chuaDuB : C.chuaDuDau) : null}
        canCu={{ so: canCu, ngaySo }}
        doanDung={{ trung: ttDoan.trung, trat: ttDoan.trat }}
        nhatQuan={nhatQuan}
        domViec={domViec}
        onMo={mo}
        onViec={() => navigate(ROUTE_TAI_CHINH_NGAY_DAU)}
      />
      <TamTruot mo={moTam} onDong={dongTam} nhan={chotNhan} dau="the" cao="lon" chan={chan}>
        {ruot}
      </TamTruot>
    </div>
  );
}

export default function ChanDungPfm(): React.ReactElement {
  return (
    <KhoProvider>
      <RuotChanDung />
    </KhoProvider>
  );
}
