/**
 * PFM — MÀN "NGÀY ĐẦU": CHÂN DUNG + BA VIỆC HÔM NAY + THANH "MỨC ĐỘ HIỂU BẠN" + ORACLE.
 * GIAI ĐOẠN A (D355/D356). **Làm theo DEMO ĐÃ CHỐT** (A11.25):
 * `docs/ui-ux/demo/pfm-ngay-dau.html`, màn `cd` (CHÂN DUNG) và `viec` (BA VIỆC) — CHỈ
 * hai bước này. KHÔNG thi công n3/n5/n6/tuần, KHÔNG khung "MÁY ĐANG NGHĨ GÌ", KHÔNG dải
 * tua ngày — ba thứ đó chỉ của demo (xem khối đầu tệp demo).
 *
 * Từ D355 đây là đích SAU KHI PHỎNG VẤN XONG (thay LỘ TRÌNH cũ) — LỘ TRÌNH vẫn sống,
 * vẫn tới được từ ⚙ (xem `CaiDatPfm.tsx` hàng "Chân dung của bạn"/"Xem lại lộ trình").
 *
 * ⚠ A10 🔒 — mọi chữ qua `lib/pfm_chu.ts` (`CHU_NGAY_DAU`/`CHAN_DUNG_NOI_DUNG`/
 * `CHU_NHOM_NGUON_THU`); màn chỉ VẼ. App KHÔNG điền một con số tiền nào (P3).
 * ⚠⚠ KHÔNG NGÕ CỤT (founder 20/09: "bấm nhầm cái là không chọn lại được") — MỌI lựa
 * chọn có ĐỔI/HOÀN TÁC đưa về đúng trạng thái trước, và thanh hiểu không tụt trong các
 * luồng đã canh (đổi đáp án, LÀM ↔ BỎ) — xem `ngay_dau.test.tsx`.
 */
import { useEffect, useState, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ScreenFrame } from '@/components/ScreenFrame';
import { TabTaiChinh } from '@/components/pfm/TabTaiChinh';
import { NutCaiDatPfm } from '@/components/pfm/NutCaiDatPfm';
import { ThanhHieu } from '@/components/pfm/ThanhHieu';
import { BongOracle } from '@/components/pfm/BongOracle';
import { KhoProvider, useGhiKho, useHoSo, useHu, useLuat, useSoTatCa } from '@/pfm/dung_kho';
import { soCauDaTraLoi, soCauPhongVan, suaHoSo, type HoSo } from '@/pfm/ho_so';
import { baoLoiNen } from '@/lib/telemetry';
import { CHU_LOI_GHI } from '@/lib/pfm_chu';
import {
  baViec, chanDung, hoanTacNetTrenHoSo, mucDoHieu, nhomNguonThu, soNetDaTuongTac,
  soNgayCoGhi, soViecDaLamHoacBo,
  type MaNet, type TrangThaiBaViec, type ViecNgayDau,
} from '@/pfm/chan_dung';
import { bayGio } from '@/pfm/thoi_gian';
import { CAU_PV } from '@/pfm/phong_van';
import { CHAN_DUNG_NOI_DUNG, CHU_NGAY_DAU, CHU_NHOM_NGUON_THU } from '@/lib/pfm_chu';
import { donHatPixel, phutHat, tamPhanTu } from '@/lib/hat_pixel';
import { NHIP_RUNG, rung } from '@/lib/rung';
import { ROUTE_TAI_CHINH_SO } from '@/lib/vocab';
import s from './NgayDau.module.css';

/** Danh mục chip câu 6 — CÙNG NGUỒN với màn phỏng vấn (`phong_van.ts` §`CAU_PV`), không chép tay. */
const CHIP_NHIP: readonly string[] = CAU_PV.find((c) => c.id === 'nhip')!.dap;

type Buoc = 'chan_dung' | 'ba_viec';
type TrangThaiNet = 'goc' | 'choChonLai' | 'bac' | 'chot';

function trangThaiNet(khoa: MaNet, hoSo: HoSo): TrangThaiNet {
  if (khoa === 'nhip' && hoSo.chanDungNhip !== undefined) return 'chot';
  const daBac = (hoSo.chanDungBac ?? []).includes(khoa);
  if (!daBac) return 'goc';
  return khoa === 'nhip' ? 'choChonLai' : 'bac';
}

/**
 * MỘT NÉT của chân dung — ba trạng thái hiển thị (goc/bác/chốt), luôn có đường quay lại
 * (KHÔNG NGÕ CỤT). `nhip` có thêm sự "chọn lại" (chip khác); `deu`/`nguon` chỉ bác/hoàn.
 */
function KhoiNet({ khoa, ten, cau, giaTri, hoSo, onBac, onChonChip, onHoanTac }: {
  khoa: MaNet; ten: string; cau: string; giaTri: string; hoSo: HoSo;
  onBac: (khoa: MaNet, el: HTMLElement) => void;
  onChonChip: (chip: string, el: HTMLElement) => void;
  onHoanTac: (khoa: MaNet) => void;
}): React.ReactElement {
  const tt = trangThaiNet(khoa, hoSo);
  const bac = tt === 'bac' || tt === 'choChonLai';
  return (
    <div className={`${s.net} ${bac ? s.netBac : ''}`}>
      <div className={s.netDau}>
        <span className={s.netTen}>{ten} · {cau}</span>
        {tt === 'goc' && (
          <button
            type="button"
            className={s.nutNho}
            onClick={(e) => onBac(khoa, e.currentTarget)}
          >
            {CHU_NGAY_DAU.khongHan}
          </button>
        )}
      </div>
      <p className={s.netGt}>{giaTri}</p>
      {tt === 'chot' && (
        <p className={s.chot}>
          {CHU_NGAY_DAU.daTuChon}{' '}
          <button type="button" className={s.nutNho} onClick={() => onHoanTac(khoa)}>
            {CHU_NGAY_DAU.doi}
          </button>
        </p>
      )}
      {tt === 'choChonLai' && (
        <>
          <p className={s.mo}>
            {CHU_NGAY_DAU.chonLaiHoi}{' '}
            <button type="button" className={s.nutNho} onClick={() => onHoanTac(khoa)}>
              {CHU_NGAY_DAU.thoiGiuNhuCu}
            </button>
          </p>
          <div className={s.doi}>
            {CHIP_NHIP.filter((c) => c !== (hoSo.nhip?.[0] ?? '')).map((c) => (
              <button
                key={c}
                type="button"
                className={s.nutNho}
                onClick={(e) => onChonChip(c, e.currentTarget)}
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}
      {tt === 'bac' && (
        <p className={s.mo}>
          {CHU_NGAY_DAU.daBoNet}{' '}
          <button type="button" className={s.nutNho} onClick={() => onHoanTac(khoa)}>
            {CHU_NGAY_DAU.hoanTac}
          </button>
        </p>
      )}
    </div>
  );
}

interface NoiDungViec { ten: string; vi: string; nutChinh: string; phu?: React.ReactNode }

/** Ghép nội dung hiển thị của MỘT việc từ mẫu đã chọn (`chan_dung.ts` không chở chữ). */
function noiDungViec(v: ViecNgayDau, coNoChip: string | undefined): NoiDungViec {
  if (v.loai === 'hu') {
    return {
      ten: v.mau.tenGoiY,
      vi: v.mau.viSao,
      nutChinh: CHU_NGAY_DAU.huNut,
      phu: v.coNo && coNoChip ? (
        <p className={s.mo}>{CHU_NGAY_DAU.huCoNoViPre}{coNoChip}{CHU_NGAY_DAU.huCoNoViHau}</p>
      ) : undefined,
    };
  }
  if (v.loai === 'luat') {
    const ten = v.mau.ten.toUpperCase();
    return {
      ten: v.mau.ten,
      vi: v.mau.viSao,
      nutChinh: v.haiCham
        ? `${CHU_NGAY_DAU.luatNutHaiChamPre}${ten}${CHU_NGAY_DAU.luatNutHaiChamHau}`
        : `${CHU_NGAY_DAU.luatNutBatPre}${ten}${CHU_NGAY_DAU.luatNutBatHau}`,
      phu: (
        <>
          <p className={s.loiBan}>{v.mau.loiNhacGoiY}</p>
          {v.haiCham && <p className={s.mo}>{CHU_NGAY_DAU.luatHaiChamGhiChu}</p>}
        </>
      ),
    };
  }
  return { ten: CHU_NGAY_DAU.ghiTen, vi: CHU_NGAY_DAU.ghiVi, nutChinh: CHU_NGAY_DAU.ghiNut };
}

/**
 * MỘT VIỆC — ba trạng thái (chưa/xong/bỏ), luôn có đường quay lại. "SỬA" (khi đã xong)
 * đi ĐÚNG cùng đích với nút chính lúc chưa làm (A3: "SỬA đi cùng đích").
 */
function TheViec({ so, viec, coNoChip, onLam, onSua, onBo, onHoanTac }: {
  so: number; viec: ViecNgayDau; coNoChip: string | undefined;
  onLam: (el: HTMLElement) => void; onSua: () => void; onBo: () => void; onHoanTac: () => void;
}): React.ReactElement {
  const { ten, vi, nutChinh, phu } = noiDungViec(viec, coNoChip);
  const tt = viec.trangThai;
  return (
    <div
      className={`${s.viec} ${tt === 'xong' ? s.viecXong : ''} ${tt === 'bo' ? s.viecBo : ''}`}
      data-testid={`viec-${so}`}
      data-trang-thai={tt}
    >
      <span className={s.viecSo}>{tt === 'xong' ? '✓' : so}</span>
      <div className={s.viecThan}>
        <div className={s.viecDau}>
          <p className={s.viecTen}>{ten}</p>
          {tt === 'chua' && (
            <button type="button" className={s.nutNho} onClick={onBo}>{CHU_NGAY_DAU.boViec}</button>
          )}
        </div>
        <p className={s.mo}>{vi}</p>
        {phu}
        {tt === 'chua' && (
          <button
            type="button"
            className={s.viecNut}
            onClick={(e) => onLam(e.currentTarget)}
          >
            {nutChinh}
          </button>
        )}
        {tt !== 'chua' && (
          <p className={`${s.chot} ${tt === 'bo' ? s.chotBo : ''}`}>
            {tt === 'xong' ? CHU_NGAY_DAU.daXong : CHU_NGAY_DAU.daBoViec}{' '}
            <button type="button" className={s.nutNho} onClick={tt === 'xong' ? onSua : onHoanTac}>
              {tt === 'xong' ? CHU_NGAY_DAU.sua : CHU_NGAY_DAU.hoanTac}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

/** ⚠ Xuất ra cho bài test — bản mặc định tự mở IndexedDB thật; test bơm kho của mình. */
export function RuotNgayDau(): React.ReactElement {
  const navigate = useNavigate();
  const ghi = useGhiKho();
  const { data: hoSo, sanSang: coHoSo } = useHoSo();
  const { data: huDs } = useHu();
  const { data: luatDs } = useLuat();
  const { data: soDs } = useSoTatCa();

  /*
   * ⚠ BƯỚC SỐNG TRÊN URL (`?buoc=viec`), KHÔNG trong state (D358 — soi mắt bắt được): bấm việc 2 sang CAM KẾT rồi
   * bấm Back thì màn dựng lại từ đầu; bước giữ trong `useState` ⇒ người dùng rơi về CHÂN DUNG và phải bấm LÀM THEO
   * lần nữa mới thấy dấu ✓ của việc mình vừa làm. Để trên URL thì Back đưa về đúng danh sách ba việc.
   */
  /** Câu báo khi cú ghi hồ sơ hỏng — xem `ghiChanDung`. `null` = không có gì để nói. */
  const [loiGhi, setLoiGhi] = useState<string | null>(null);
  const [thamSo, datThamSo] = useSearchParams();
  const buoc: Buoc = thamSo.get('buoc') === 'viec' ? 'ba_viec' : 'chan_dung';

  useEffect(() => () => donHatPixel(), []);

  const tt: TrangThaiBaViec = {
    coHuDangMo: huDs.some((h) => h.trangThai === 'dang_chay' || h.trangThai === 'tam_dung'),
    coLuat: luatDs.length > 0,
    coGhiSo: soDs.length > 0,
  };
  const viec = baViec(hoSo, tt);
  const ma = chanDung(hoSo);
  const noiDungChanDung = CHAN_DUNG_NOI_DUNG[ma];
  const nhom = nhomNguonThu(hoSo);

  const hieu = mucDoHieu({
    soCauDaTraLoi: soCauDaTraLoi(hoSo),
    /* Mẫu theo TỪNG NGƯỜI: câu `no_so` chỉ hỏi người có nợ, nên tổng số câu là 8 hoặc 9.
       Trước 21/09 `mucDoHieu` chôn số 6 bên trong — xem `ho_so.ts` §`soCauPhongVan`. */
    soCauToiDa: soCauPhongVan(hoSo),
    soNetDaTuongTac: soNetDaTuongTac(hoSo),
    soViecDaLamHoacBo: soViecDaLamHoacBo(viec),
    soNgayCoGhi: soNgayCoGhi(soDs),
  });

  /*
   * ⚠⚠ ĐỌC–SỬA–GHI TRONG CÙNG MỘT LƯỢT GHI, KHÔNG GHI TỪ STATE CỦA MÀN. `useHoSo()` trả `{}` trong lúc
   * hồ sơ CHƯA nạp xong; bản đầu ghi `f(hoSo)` từ state ấy ⇒ chạm KHÔNG HẲN trước khi nạp xong là GHI ĐÈ
   * cả hồ sơ bằng `{chanDungBac:[…]}` — sáu câu phỏng vấn bay sạch, im lặng. Bài "bác nét TIỀN VÀO rồi HOÀN
   * TÁC" bắt được đúng ca này (giá trị câu 2 biến mất). Đọc lại từ kho ngay trong lượt ghi thì state cũ
   * hay chưa nạp đều không còn là nguồn của dữ liệu.
   * ⚠ D360 — đi qua `suaHoSo` (`ho_so.ts` §2b), MỘT cửa với màn LỘ TRÌNH và PHỎNG VẤN: đọc lại từ kho một mình chưa
   * đủ — hai cú chạm sát nhau (BỎ việc 1 rồi BỎ việc 2) cùng ĐỌC trước khi cú nào kịp GHI, và cú sau nuốt cú trước
   * (`ngayDauBo` ra `[1]` thay vì `[0, 1]` — bài §VIII). `suaHoSo` xếp hàng các phép sửa theo từng kho.
   */
  async function ghiChanDung(f: (h: HoSo) => HoSo): Promise<void> {
    setLoiGhi(null);
    try {
      await ghi(['meta'], (kho) => suaHoSo(kho, f, bayGio()));
    } catch (e) {
      /*
       * ⚠ BÁO CHO NGƯỜI DÙNG, rồi mới để lại dấu cho người vận hành (D360). Trước bản này cú ghi hỏng đi vào
       * `void` ⇒ không chữ, không log, không đếm được: người dùng chỉ thấy "bấm không ăn". Câu chữ ở
       * `pfm_chu.ts` §`CHU_LOI_GHI` — một nguồn cho mọi màn PFM.
       */
      setLoiGhi(CHU_LOI_GHI);
      baoLoiNen(e);
    }
  }

  /** ⚠ `.catch` chứ không `void` (D360): cú ghi hỏng mà vứt lời hứa đi là hỏng IM LẶNG hoàn toàn. */
  function ghiChanDungBao(f: (h: HoSo) => HoSo): void {
    ghiChanDung(f).catch(baoLoiNen);
  }

  function bacNet(khoa: MaNet, el: HTMLElement): void {
    rung(NHIP_RUNG.cham);
    phutHat(tamPhanTu(el), 'var(--c-4)', 8);
    ghiChanDungBao((h) => ({
      ...h,
      chanDungBac: [...new Set([...(h.chanDungBac ?? []), khoa])],
      chanDungDaCham: [...new Set([...(h.chanDungDaCham ?? []), khoa])],
    }));
  }

  function chonChipNhip(chip: string, el: HTMLElement): void {
    rung(NHIP_RUNG.cham);
    phutHat(tamPhanTu(el), 'var(--v-3)', 12);
    ghiChanDungBao((h) => ({
      ...h,
      chanDungNhip: chip,
      chanDungBac: [...new Set([...(h.chanDungBac ?? []), 'nhip'])],
      chanDungDaCham: [...new Set([...(h.chanDungDaCham ?? []), 'nhip'])],
    }));
  }

  /** ĐỔI / HOÀN TÁC / THÔI GIỮ NHƯ CŨ — MỘT hàm cho cả ba nhãn: luôn về lại "gốc". KHÔNG gỡ `chanDungDaCham`. */
  function hoanTacNet(khoa: MaNet): void {
    ghiChanDungBao((h) => hoanTacNetTrenHoSo(h, khoa));
  }

  function lamViec(route: string, el: HTMLElement): void {
    rung(NHIP_RUNG.cham);
    phutHat(tamPhanTu(el), 'var(--win)', 14);
    navigate(route);
  }

  function boViec(chiSo: number): void {
    ghiChanDungBao((h) => ({
      ...h, ngayDauBo: [...new Set([...(h.ngayDauBo ?? []), chiSo])],
    }));
  }

  function hoanTacViec(chiSo: number): void {
    ghiChanDungBao((h) => ({
      ...h, ngayDauBo: (h.ngayDauBo ?? []).filter((i) => i !== chiSo),
    }));
  }

  function bamNeo(e: MouseEvent<HTMLButtonElement>): void {
    rung(NHIP_RUNG.cham);
    phutHat(tamPhanTu(e.currentTarget), 'var(--c-4)', 12);
    if (buoc === 'chan_dung') { datThamSo({ buoc: 'viec' }); return; }
    navigate(ROUTE_TAI_CHINH_SO);
  }

  const neoKhoa = buoc === 'ba_viec' && viec.every((v) => v.trangThai === 'chua');

  // Chưa nạp xong hồ sơ ⇒ KHÔNG vẽ gì bấm được: một chân dung "CHƯA RÕ NÉT" loé lên rồi đổi là kể sai chuyện
  // của người dùng, và mọi nút vẽ ra lúc này đều đứng trên dữ liệu rỗng (cùng nếp `taiHu` của LoTrinh — D325).
  // ⚠ D360 — cổng là `sanSang`, KHÔNG phải `dangTai`: cờ kia TẮT trong lúc kho ĐANG MỞ (`dangTai = isPending &&
  // kho !== null`), tức mở app nguội thẳng vào màn này thì chân dung "CHƯA RÕ NÉT" vẫn loé đúng một nhịp trước
  // khung chờ — chính cái cổng này sinh ra để chặn. Lý lẽ đầy đủ ở `dung_kho.tsx` §`useHoSo`.
  if (!coHoSo) return <div data-testid="man-ngay-dau" aria-busy="true" />;

  return (
    <div data-testid="man-ngay-dau">
      <ThanhHieu
        ket={hieu}
        lenTiepPre={buoc === 'chan_dung' ? CHU_NGAY_DAU.hieuKeChanDungPre : CHU_NGAY_DAU.hieuKeBaViecPre}
        lenTiepBold={buoc === 'chan_dung' ? CHU_NGAY_DAU.hieuKeChanDungBold : CHU_NGAY_DAU.hieuKeBaViecBold}
      />

      {/* `prefers-reduced-motion` tắt animation của `.vao` bằng CSS, không bằng nhánh JS
          (D116) — khối vẫn hiện đủ nội dung ngay lập tức. */}
      <div key={buoc} className={s.vao}>
        {buoc === 'chan_dung' ? (
          <>
            <BongOracle nhan={CHU_NGAY_DAU.oracleNhan} loi={CHU_NGAY_DAU.oracleLoiChanDung} />

            <div className={s.cd} data-testid="the-chan-dung">
              <div className={s.cdDau}>
                <span className={s.glyph} aria-hidden>{noiDungChanDung.glyph}</span>
                <div>
                  <p className={s.cdTen}>{noiDungChanDung.ten}</p>
                  <p className={s.cdNhom}>
                    {nhom ? CHU_NHOM_NGUON_THU[nhom] : CHU_NGAY_DAU.nhomChuaRo}
                    {hoSo.deu ? ` · ${CHU_NGAY_DAU.tienVaoPre}${hoSo.deu.toUpperCase()}` : ''}
                  </p>
                </div>
              </div>
              {ma !== 'chua_ro' ? (
                <p className={s.cdDoan}>
                  <b className={s.cdDoanTieu}>{CHU_NGAY_DAU.doanTieu}</b>
                  {noiDungChanDung.doan}
                  <small className={s.cdDoanGhiChu}>{CHU_NGAY_DAU.doanGhiChu}</small>
                </p>
              ) : (
                <p className={s.cdDoan}>{CHU_NGAY_DAU.chuaRoGhiChu}</p>
              )}
            </div>

            <div className={s.khoi2} data-testid="khoi-net">
              <KhoiNet
                khoa="nhip" ten={CHU_NGAY_DAU.netNhipTen} cau={CHU_NGAY_DAU.netNhipCau}
                giaTri={hoSo.chanDungNhip ?? hoSo.nhip?.[0] ?? ''} hoSo={hoSo}
                onBac={bacNet} onChonChip={chonChipNhip} onHoanTac={hoanTacNet}
              />
              <KhoiNet
                khoa="deu" ten={CHU_NGAY_DAU.netDeuTen} cau={CHU_NGAY_DAU.netDeuCau}
                giaTri={hoSo.deu ?? ''} hoSo={hoSo}
                onBac={bacNet} onChonChip={chonChipNhip} onHoanTac={hoanTacNet}
              />
              <KhoiNet
                khoa="nguon" ten={CHU_NGAY_DAU.netNguonTen} cau={CHU_NGAY_DAU.netNguonCau}
                giaTri={(hoSo.nguonThuNhan ?? []).join(' + ')} hoSo={hoSo}
                onBac={bacNet} onChonChip={chonChipNhip} onHoanTac={hoanTacNet}
              />
            </div>
          </>
        ) : (
          <>
            <BongOracle
              nhan={<>{CHU_NGAY_DAU.oracleNhan} <em>{CHU_NGAY_DAU.oracleNhanBaViecPhu}</em></>}
              loi={CHU_NGAY_DAU.oracleLoiBaViec}
            />

            <div data-testid="ds-ba-viec">
              <TheViec
                so={1} viec={viec[0]} coNoChip={hoSo.coNoNhan?.[0]}
                onLam={(el) => lamViec(viec[0].route, el)}
                onSua={() => navigate(viec[0].route)}
                onBo={() => boViec(0)} onHoanTac={() => hoanTacViec(0)}
              />
              <TheViec
                so={2} viec={viec[1]} coNoChip={hoSo.coNoNhan?.[0]}
                onLam={(el) => lamViec(viec[1].route, el)}
                onSua={() => navigate(viec[1].route)}
                onBo={() => boViec(1)} onHoanTac={() => hoanTacViec(1)}
              />
              <TheViec
                so={3} viec={viec[2]} coNoChip={hoSo.coNoNhan?.[0]}
                onLam={(el) => lamViec(viec[2].route, el)}
                onSua={() => navigate(viec[2].route)}
                onBo={() => boViec(2)} onHoanTac={() => hoanTacViec(2)}
              />
            </div>
          </>
        )}
      </div>

      {loiGhi && <p className={s.loi} role="alert">✕ {loiGhi}</p>}
      <div className={s.neo}>
        <button type="button" className={s.nutChinh} disabled={neoKhoa} onClick={bamNeo}>
          {buoc === 'chan_dung' ? CHU_NGAY_DAU.neoChanDung : CHU_NGAY_DAU.neoBaViec}
        </button>
      </div>
    </div>
  );
}

export default function NgayDau(): React.ReactElement {
  return (
    <ScreenFrame title="Ngày đầu" live goc={<NutCaiDatPfm />} gon>
      <TabTaiChinh />
      <KhoProvider>
        <RuotNgayDau />
      </KhoProvider>
    </ScreenFrame>
  );
}
