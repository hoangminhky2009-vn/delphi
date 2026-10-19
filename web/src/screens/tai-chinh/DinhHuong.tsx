/**
 * KHỐI ĐỊNH HƯỚNG — hai thẻ ĐẦU GƯƠNG (D429, founder 26/09).
 *
 * Founder xem bản 9: *"Vẫn chỉ là 1 app ghi chép nhỉ. Chưa thấy phần nào là phân tích hay hỗ trợ định hướng"*, rồi chọn cả
 * hai hướng: BẢN TIN (đáng chú ý · đang đi về đâu — `pfm/phan_tich.ts`) + KHUNG CHIA TIỀN APP XẾP TỪ DỮ LIỆU, kèm bước dựng
 * hũ / quy tắc / luật (`pfm/phong_cach.ts`). Chữ ở `pfm_chu.ts` §`CHU_DINH_HUONG`.
 *
 * ⚠ A10 🔒 / P3 — màn chỉ TẢ và MỞ LỐI: khung là gợi ý có vì-sao; CHỌN khung là một chạm của người dùng (`hoSo.khung`);
 *   bước dựng mở màn SẴN CÓ với ô số TRỐNG; số theo công thức của khung chỉ hiện sau khi người dùng đã chọn khung ấy.
 * ⚠ P10 — hiển thị + tương tác đi `telemetry` (`dinh_huong_hien` · `dinh_huong_tuong_tac`): mã khung + đếm, không tiền.
 * ⚠ Màu (nếp D426): họ XANH = tiền đã TIÊU · họ VÀNG = để dành / mốc người dùng đặt. Không `--win`/`--lose`: "trễ 1 tháng"
 *   là một con số, không phải một lời phán.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { PFM } from '@config/pfm';
import { CHU_DINH_HUONG as D, CHU_KHUNG, CHU_LOI_GHI } from '@/lib/pfm_chu';
import { ROUTE_TAI_CHINH_CAM_KET, ROUTE_TAI_CHINH_HU } from '@/lib/vocab';
import { baoLoiNen, ghiDo } from '@/lib/telemetry';
import { NHIP_RUNG, rung } from '@/lib/rung';
import { phutHat, tamPhanTu } from '@/lib/hat_pixel';
import { useGhiKho, useHoSo } from '@/pfm/dung_kho';
import { suaHoSo, type HoSo } from '@/pfm/ho_so';
import { laTieuDung, sua, type Hu } from '@/pfm/hu';
import type { Khoan } from '@/pfm/so';
import type { Luat } from '@/pfm/luat';
import { suaBanGhi } from '@/pfm/sua_ban_ghi';
import { bayGio, soNgayTrongThang, thangNay, thangTruocCua } from '@/pfm/thoi_gian';
import { dangChuY, dangDiVeDau, SO_KHOAN_LON, type ChuY, type DuPhong } from '@/pfm/phan_tich';
import {
  danhGiaPhongCach, hoTroDung, KHUNG_XET, nhap503020, soNgayCoSo, trenSo, TY_LE_50_30_20,
  type DauHieu, type HoTro, type KhungXet, type PhongCach, type TrenSo,
} from '@/pfm/phong_cach';
import { NutHoi, tienNgan } from './BieuDo';
import g from './Guong.module.css';
import b from './BieuDo.module.css';
import m from './BaMat.module.css';
import s from './DinhHuong.module.css';

const soThangCua = (thang: string): number => Number(thang.slice(5, 7));
/** "1/2027" — tháng có năm, cho kỳ hạn/tháng đủ (năm khác năm nay là chuyện thường của một vị thế). */
const thangNam = (thang: string): string => `${soThangCua(thang)}/${thang.slice(0, 4)}`;
const phay1 = (x: number): string => x.toFixed(1).replace('.', ',');
/** Phần trăm làm tròn; khác 0 mà tròn ra 0 ⇒ "<1%" (nếp D426 — 5.000 đồng không phải "0%"). */
const pt = (p: number): string => {
  const r = Math.round(p * 100);
  return r === 0 && p !== 0 ? '<1%' : `${r}%`;
};
const tenHu = (hu: readonly Hu[], id: string | null): string =>
  id === null ? D.cdChuaChia : (hu.find((h) => h.id === id)?.ten ?? '').toUpperCase();

/** Tên ngắn trên thẻ chọn khung. `CHU_KHUNG` là tên đầy đủ (dòng tiêu đề), cùng một nguồn với màn phỏng vấn. */
const TAB: Record<KhungXet, string> = { hu: 'HŨ', '50_30_20': '50/30/20', kakeibo: 'KAKEIBO' };
const CACH: Record<KhungXet, string> = { hu: D.cachHu, '50_30_20': D.cach503020, kakeibo: D.cachKakeibo };

/* ═══ KHỐI — thẻ KHUNG + một lượt đo hiển thị (D453: bản tin đứng riêng dưới tấm HƯỚNG) ═══════════════════ */

export function KhoiDinhHuong({ tatCa, hu, luat, ngayNay, tatHanhVi, onChotTuan, onDi }: {
  tatCa: readonly Khoan[];
  hu: readonly Hu[];
  luat: readonly Luat[];
  ngayNay: string;
  /** "Tắt Gương" — bỏ các dòng / bước chỉ đứng trên tỷ số hành vi. */
  tatHanhVi: boolean;
  /** Bước "bốn câu cuối tuần" (kakeibo) mở ô chốt sổ tuần ngay trên màn này. */
  onChotTuan: () => void;
  /** Chủ khối (lớp trượt) ĐÓNG TRƯỚC khi một bước dựng đưa sang màn khác — lớp của vỏ sống sót qua đổi route (RÀ 12/10 C1). */
  onDi: () => void;
}): React.ReactElement {
  /*
   * D453 — khối chỉ còn thẻ KHUNG (nằm trong nắp KHUNG CHIA TIỀN cuối GƯƠNG). Bản tin đứng riêng dưới tấm HƯỚNG
   *   (`ThePhanTich` + `banTinThang`), nên khối không vẽ lại nó — trước đó một cờ `chiKhung` giữ đường vẽ cũ mà không ai
   *   gọi, một cái bẫy cho người gọi sau (hai bản tin trên một màn).
   * ⚠ `chuY`/`duPhong` dưới đây chỉ còn phục vụ lượt đo `dinh_huong_hien` (đếm dòng của `phan_tich`, không phải dòng hiện
   *   trên bản tin gọn). Lượt đo bắn MỘT lần mỗi lần khối dựng — tức mỗi lần nắp KHUNG được mở.
   */
  const { data: hoSo, sanSang: coHoSo } = useHoSo();
  const vao = { so: tatCa, hu, homNay: ngayNay, tatHanhVi };
  const chuY = useMemo(() => dangChuY(vao), [tatCa, hu, ngayNay, tatHanhVi]);
  const duPhong = useMemo(() => dangDiVeDau(vao), [tatCa, hu, ngayNay, tatHanhVi]);
  const pc = useMemo(
    () => danhGiaPhongCach({ so: tatCa, hu, hoSo, homNay: ngayNay }), [tatCa, hu, hoSo, ngayNay],
  );

  /* ⚠ P10 — MỘT lượt hiển thị mỗi lần mở màn, và chỉ khi hồ sơ đã THẬT (`sanSang`): đo trên hồ sơ rỗng của nhịp đầu là
     ghi một gợi ý khác gợi ý người dùng thấy. */
  const daDo = useRef(false);
  useEffect(() => {
    if (daDo.current || !coHoSo) return;
    daDo.current = true;
    const k = pc.daChon ?? pc.goiY;
    ghiDo('dinh_huong_hien', {
      chi_tiet: {
        khung: k ?? 'khong',
        dau_hieu: k === null ? 0 : pc.hang.find((x) => x.khung === k)!.dauHieu.length,
        so_bo: pc.soBo ? 1 : 0, chu_y: chuY.length, du_phong: duPhong.length,
      },
    });
  }, [coHoSo, pc, chuY.length, duPhong.length]);

  return (
    <div className={s.khoi} data-testid="dinh-huong">
      {/* ⚠ `key` = khung đã chọn: chọn xong là thẻ dựng lại quanh khung ấy (tiêu đề "KHUNG BẠN CHỌN", vạch của công thức
          hiện ra) — không giữ một `xem` cũ trỏ sang khung khác. */}
      {coHoSo && (
        <ThePhongCach
          key={pc.daChon ?? 'chua_chon'}
          pc={pc} hoSo={hoSo} tatCa={tatCa} hu={hu} luat={luat} ngayNay={ngayNay} tatHanhVi={tatHanhVi}
          onChotTuan={onChotTuan} onDi={onDi}
        />
      )}
    </div>
  );
}

/* ═══ THẺ 1 — BẢN TIN ══════════════════════════════════════════════════════════════════════════════ */

export function ThePhanTich({ chuY, duPhong, hu, tatCa, ngayNay, gon = false }: {
  chuY: readonly ChuY[];
  duPhong: readonly DuPhong[];
  hu: readonly Hu[];
  tatCa: readonly Khoan[];
  ngayNay: string;
  /** D453 — bản GỌN dưới tấm HƯỚNG: bỏ câu chân (mỗi dòng đã có (?) riêng nói cách tính — chữ giải thích sau `?`). */
  gon?: boolean;
}): React.ReactElement {
  const thang = ngayNay.slice(0, 7);
  const d = Number(ngayNay.slice(8, 10));
  const rong = chuY.length === 0 && duPhong.length === 0;
  const soNgaySo = useMemo(() => soNgayCoSo(tatCa, ngayNay), [tatCa, ngayNay]);
  return (
    <section className={`${b.the} ${g.khac} ${s.the}`} data-testid="phan-tich">
      <div className={b.dau}>
        <span className={b.tieu}>{D.phanTich}</span>
        <span className={b.phuDau}>{`${D.thangPre}${soThangCua(thang)}${D.ngayGiua}${d}`}</span>
      </div>
      {rong ? (
        <p className={b.chu} data-testid="phan-tich-rong">
          {`${D.chuaDu} ${D.chuaDuSoPre}${soNgaySo}${D.chuaDuSoHau}`}
        </p>
      ) : (
        <>
          {chuY.length > 0 && (
            <>
              <p className={s.muc}>{D.chuY}</p>
              {chuY.map((c, i) => <DongChuY key={c.ma} c={c} i={i} hu={hu} thang={thang} />)}
            </>
          )}
          {duPhong.length > 0 && (
            <>
              <p className={s.muc}>{D.diVeDau}</p>
              {duPhong.map((x, i) => (
                <DongDuPhong
                  key={x.ma === 'chi_het_thang' ? x.ma : `${x.ma}-${x.huId}`}
                  x={x} i={chuY.length + i} hu={hu} ngayNay={ngayNay}
                />
              ))}
            </>
          )}
          {!gon && <p className={s.chan}>{D.chanBanTin}</p>}
        </>
      )}
    </section>
  );
}

/**
 * MỘT DÒNG BẢN TIN: số LỚN bên trái (nhấn bằng CỠ — gu founder 13/09), hai dòng chữ bên phải, chạm cả dòng để đọc cách
 * tính (P13 — mọi dòng nói được "vì sao"). `ho` = họ màu của con số: tiền TIÊU (xanh) hay ĐỂ DÀNH / mốc tự đặt (vàng).
 */
function DongTin({ id, i, lon, don, ho, tieu, phu, giai }: {
  id: string; i: number; lon: string; don?: string; ho: 'tieu' | 'de';
  tieu: string; phu: string; giai: string;
}): React.ReactElement {
  const [mo, datMo] = useState(false);
  return (
    <button
      type="button" className={s.dong} aria-expanded={mo} data-testid={`tin-${id}`}
      style={{ '--i': i } as CSSProperties}
      onClick={() => { rung(NHIP_RUNG.cham); datMo((v) => !v); }}
    >
      <span className={`${s.lon} ${ho === 'de' ? s.lonDe : s.lonTieu}`}>
        <b>{lon}</b>{don !== undefined && <small>{don}</small>}
      </span>
      <span className={s.noi}>
        <span className={s.tieuDong}>{tieu}</span>
        <span className={s.phuDong}>{phu}</span>
        {mo && <span className={`${g.giai} ${s.giaiDong}`} data-testid={`giai-${id}`}>{giai}</span>}
      </span>
      <span className={`${g.hoi} ${g.khac} ${s.hoiDong}`} aria-hidden="true">{mo ? '✕' : '?'}</span>
    </button>
  );
}

function DongChuY({ c, i, hu, thang }: {
  c: ChuY; i: number; hu: readonly Hu[]; thang: string;
}): React.ReactElement {
  const truoc = thangTruocCua(thang);
  switch (c.ma) {
    case 'chi_doi': {
      const rel = (c.nay - c.truoc) / c.truoc;
      const nguon = c.nguon === null ? ''
        : ` · ${D.cdNguonPre}${tenHu(hu, c.nguon.huId)} ${c.nguon.lech > 0 ? '+' : ''}${tienNgan(c.nguon.lech)}`;
      return (
        <DongTin
          id={c.ma} i={i} ho="tieu"
          lon={`${rel < 0 ? '−' : '+'}${Math.abs(Math.round(rel * 100))}`} don="%"
          tieu={`${D.cdTieuPre}${c.ngay}`}
          phu={`${tienNgan(c.nay)} · ${D.thangNho}${soThangCua(truoc)}${D.cdCungNgayHau}${tienNgan(c.truoc)}${nguon}`}
          giai={D.cdGiai}
        />
      );
    }
    case 'cuoi_tuan':
      return (
        <DongTin
          id={c.ma} i={i} ho="tieu" lon={`×${phay1(c.tyLe)}`}
          tieu={D.ctTieu} phu={`${D.ctPhu} · ${c.soNgay}${D.ngayQuaHau}`} giai={D.ctGiai}
        />
      );
    case 'sau_tien_ve':
      return (
        <DongTin
          id={c.ma} i={i} ho="tieu" lon={`×${phay1(c.tyLe)}`}
          tieu={`${c.cuaSo}${D.svTieuHau}`} phu={`${D.svPhu} · ${c.soNgay}${D.ngayQuaHau}`} giai={D.svGiai}
        />
      );
    case 'khoan_lon':
      return (
        <DongTin
          id={c.ma} i={i} ho="tieu" lon={`${Math.round(c.phan * 100)}`} don="%"
          tieu={`${SO_KHOAN_LON}${D.klTieuHau}`}
          phu={c.lon.map((k) => `${k.ghiChu ?? `${D.klNgayPre}${Number(k.ngay.slice(8, 10))}`} ${tienNgan(k.soTien)}`).join(' · ')}
          giai={D.klGiai}
        />
      );
    case 'de_danh': {
      const cuoi = c.dong[c.dong.length - 1]!;
      return (
        <DongTin
          id={c.ma} i={i} ho="de" lon={`${Math.round(cuoi.tyLe * 100)}`} don="%"
          tieu={cuoi.tyLe > c.dong[0]!.tyLe ? D.ddTieuLen : D.ddTieuXuong}
          phu={`${c.dong.map((t) => `${D.thangNho}${soThangCua(t.thang)}: ${pt(t.tyLe)}`).join(' · ')}${D.ddPhuHau}`}
          giai={D.ddGiai}
        />
      );
    }
  }
}

function DongDuPhong({ x, i, hu, ngayNay }: {
  x: DuPhong; i: number; hu: readonly Hu[]; ngayNay: string;
}): React.ReactElement {
  const thang = ngayNay.slice(0, 7);
  if (x.ma === 'chi_het_thang') {
    const lich = x.thangTruoc === null ? ''
      : ` · ${D.thangNho}${soThangCua(thangTruocCua(thang))}: ${tienNgan(x.thangTruoc)}`;
    return (
      <DongTin
        id={x.ma} i={i} ho="tieu" lon={`~${tienNgan(x.duKien)}`}
        tieu={`${D.htTieuPre}${soThangCua(thang)}`}
        phu={`${D.giuNhipPre}${x.soNgayNhip}${D.giuNhipHau} (${tienNgan(Math.round(x.nhip))}${D.moiNgay})${lich}`}
        giai={D.htGiai}
      />
    );
  }
  const ten = tenHu(hu, x.huId);
  if (x.ma === 'hu_muc') {
    const conNgay = soNgayTrongThang(thang) - Number(ngayNay.slice(8, 10));
    const soVoiMuc = `${tienNgan(x.daTieu)} / ${D.hmMucBanDatPre}${tienNgan(x.muc)}`;
    if (x.daVuot) {
      return (
        <DongTin
          id={`hu-${x.huId}`} i={i} ho="tieu" lon={`${Math.round((x.daTieu / x.muc) * 100)}`} don="%"
          tieu={`${ten}${D.hmVuotHau}`} phu={`${soVoiMuc} · ${D.hmConPre}${conNgay}${D.hmConHau}`} giai={D.hmGiai}
        />
      );
    }
    const nhip = `${D.giuNhipPre}${x.soNgayNhip}${D.giuNhipHau} (${tienNgan(Math.round(x.nhip))}${D.moiNgay})`;
    if (x.ngayCham !== null) {
      return (
        <DongTin
          id={`hu-${x.huId}`} i={i} ho="tieu" lon={`${Number(x.ngayCham.slice(8, 10))}`} don={`/${soThangCua(thang)}`}
          tieu={`${ten}${D.hmChamHau}`} phu={`${nhip} · ${soVoiMuc}`} giai={D.hmGiai}
        />
      );
    }
    return (
      <DongTin
        id={`hu-${x.huId}`} i={i} ho="tieu" lon={`~${Math.round((x.duKienCuoi / x.muc) * 100)}`} don="%"
        tieu={`${ten}${D.hmDuoiHau}`} phu={`${nhip} · ~${tienNgan(x.duKienCuoi)} / ${D.hmMucBanDatPre}${tienNgan(x.muc)}`}
        giai={D.hmGiai}
      />
    );
  }
  const han = `${D.vtHanPre}${thangNam(x.kyHan.slice(0, 7))}`;
  if (x.thangDu === null || x.lechThang === null) {
    const soNgay = x.coSo.kieu === 'gop' ? x.coSo.soNgay : 0;
    return (
      <DongTin
        id={`vt-${x.huId}`} i={i} ho="de" lon="—"
        tieu={`${ten}${D.vtDuPre}${tienNgan(x.muc)}`}
        phu={`${D.vtChuaGopPre}${soNgay}${D.vtChuaGopHau} · ${han}`} giai={D.vtGiai}
      />
    );
  }
  const hanNgan = thangNam(x.kyHan.slice(0, 7));
  const lech = x.lechThang > 0 ? `${D.vtTrePre}${x.lechThang}${D.vtThangHau}${D.vtSoHanPre}${hanNgan}`
    : x.lechThang < 0 ? `${D.vtSomPre}${-x.lechThang}${D.vtThangHau}${D.vtSoHanPre}${hanNgan}`
      : `${D.vtKipPre}${hanNgan}`;
  const coSo = x.coSo.kieu === 'gop'
    ? `${D.vtGopPre}${x.coSo.soNgay}${D.ngayQuaHau} (${tienNgan(x.nhipThang)}${D.moiThang})`
    : x.coSo.tuDong === 'ngay'
      ? `${D.vtQuyTacPre}${tienNgan(x.coSo.gt)}${D.moiNgay}`
      : `${D.vtQuyTacPre}${x.coSo.gt}${D.vtPhanTramHau}`;
  return (
    <DongTin
      id={`vt-${x.huId}`} i={i} ho="de"
      lon={`T${soThangCua(x.thangDu)}`} don={`/${x.thangDu.slice(2, 4)}`}
      tieu={`${ten}${D.vtDuPre}${tienNgan(x.muc)}`}
      phu={`${lech} · ${coSo}`} giai={D.vtGiai}
    />
  );
}

/* ═══ THẺ 2 — PHONG CÁCH HỢP VỚI BẠN ═══════════════════════════════════════════════════════════════ */

function ThePhongCach({ pc, hoSo, tatCa, hu, luat, ngayNay, tatHanhVi, onChotTuan, onDi }: {
  pc: PhongCach; hoSo: HoSo;
  tatCa: readonly Khoan[]; hu: readonly Hu[]; luat: readonly Luat[]; ngayNay: string; tatHanhVi: boolean;
  onChotTuan: () => void;
  onDi: () => void;
}): React.ReactElement {
  const ghi = useGhiKho();
  const navigate = useNavigate();
  const nutDung = useRef<HTMLButtonElement>(null);
  const [moGiai, datMoGiai] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  /* Khung đang XEM: khung đã chọn → khung app gợi ý → khung đầu. Xem khác là state của lần mở này — không ghi gì. */
  const [xem, datXem] = useState<KhungXet>(() => pc.daChon ?? pc.goiY ?? KHUNG_XET[0]);
  const dg = pc.hang.find((x) => x.khung === xem)!;
  const buoc = useMemo(
    () => hoTroDung(xem, { so: tatCa, hu, luat, hoSo, homNay: ngayNay, tatHanhVi }),
    [xem, tatCa, hu, luat, hoSo, ngayNay, tatHanhVi],
  );
  const ts = useMemo(() => trenSo(xem, { so: tatCa, hu, hoSo, homNay: ngayNay }), [xem, tatCa, hu, hoSo, ngayNay]);
  const dangDung = pc.daChon === xem;

  function xemKhung(k: KhungXet): void {
    if (k === xem) return;
    rung(NHIP_RUNG.cham);
    datXem(k);
    ghiDo('dinh_huong_tuong_tac', { chi_tiet: { khung: k, hanh_dong: 'xem' } });
  }

  /* ⚠ Ghi đi qua `suaHoSo` (đọc bản TRONG KHO + xếp hàng — D360): dựng `{ ...hoSo, khung }` từ state là nuốt mọi câu
     phỏng vấn nếu state còn cũ. Chọn là THỨ DUY NHẤT được ghi: không hũ nào mở, không số nào đặt hộ. */
  async function dungKhung(): Promise<void> {
    rung(NHIP_RUNG.nang);
    phutHat(tamPhanTu(nutDung.current), 'var(--gold)', 12);
    datLoi(null);
    ghiDo('dinh_huong_tuong_tac', { chi_tiet: { khung: xem, hanh_dong: 'dung' } });
    try {
      await ghi(['meta'], (kho) => suaHoSo(kho, (cu) => (cu.khung === xem ? null : { ...cu, khung: xem }), bayGio()));
    } catch (e) {
      datLoi(CHU_LOI_GHI);
      baoLoiNen(e);
    }
  }

  /* 50/30/20 — phân loại một hũ tiêu dùng: một cú chọn MENU (nhãn `thietYeu` đã có trên hũ), không phải một con số. */
  async function phanLoai(h: Hu, thietYeu: boolean): Promise<void> {
    rung(NHIP_RUNG.cham);
    datLoi(null);
    const luc = bayGio();
    try {
      await ghi(['hu'], (kho) => suaBanGhi<Hu>(kho, 'hu', h.id, (cu) => sua(cu, { thietYeu }, luc), luc, thangNay()));
    } catch (e) {
      datLoi(CHU_LOI_GHI);
      baoLoiNen(e);
    }
  }

  function diBuoc(x: HoTro): void {
    rung(NHIP_RUNG.cham);
    ghiDo('dinh_huong_tuong_tac', { chi_tiet: { khung: xem, hanh_dong: `buoc:${x.ma}` } });
    const dich = x.dich;
    /* Đổi màn trong SPA giữ vị trí cuộn của GƯƠNG ⇒ màn đích mở ở lưng chừng (soi 26/09). Về đầu trước khi đi; màn HŨ tự
       cuộn tới khối quy tắc khi lối tắt chọn sẵn kiểu. */
    if (dich.kieu !== 'phan_loai' && dich.kieu !== 'chot_tuan') window.scrollTo?.(0, 0);
    /* Đóng lớp chủ TRƯỚC khi đi: một bước dựng luôn đổi màn/query (tạo hũ · quy tắc · luật), lớp còn mở là lớp đè lên màn đích. */
    if (dich.kieu === 'tao_hu' || dich.kieu === 'lenh_hu' || dich.kieu === 'cam_ket') onDi();
    if (dich.kieu === 'tao_hu') navigate(`${ROUTE_TAI_CHINH_HU}?tao=${dich.nhom}`);
    else if (dich.kieu === 'lenh_hu') navigate(`${ROUTE_TAI_CHINH_HU}?lenh=${encodeURIComponent(dich.huId)}&td=${dich.td}`);
    else if (dich.kieu === 'cam_ket') navigate(`${ROUTE_TAI_CHINH_CAM_KET}?dk=${dich.dk}`);
    else if (dich.kieu === 'chot_tuan') onChotTuan();
  }

  const nhanDau = pc.goiY === null ? null
    : pc.soBo ? `${D.pcSoBoPre}${pc.soNgaySo}${D.pcSoBoHau}` : `${dg.dauHieu.length}${D.pcDauHieuHau}`;

  return (
    <section className={`${b.the} ${g.khac} ${s.the}`} data-testid="phong-cach">
      <div className={b.dau}>
        {/* ⚠ "KHUNG BẠN CHỌN" chỉ khi đang XEM đúng khung đã chọn — xem khung khác mà vẫn đề thế là nói sai (soi 26/09). */}
        <span className={b.tieu}>{dangDung ? D.pcTieuDaChon : D.pcTieu}</span>
        {nhanDau !== null && <span className={b.phuDau} data-testid="pc-nhan">{nhanDau}</span>}
        <NutHoi mo={moGiai} onDoi={() => datMoGiai((v) => !v)} nhan={D.pcGiaiAria} />
      </div>
      {moGiai && <p className={g.giai}>{D.pcGiai}</p>}

      <div className={s.tab} role="tablist">
        {KHUNG_XET.map((k) => {
          const n = pc.hang.find((x) => x.khung === k)!.dauHieu.length;
          return (
            <button
              key={k} type="button" role="tab" aria-selected={xem === k} aria-label={`${D.pcKhungAria}${TAB[k]}`}
              className={`${s.oTab} ${xem === k ? s.oTabChon : ''} ${pc.goiY === k ? s.oTabGoiY : ''}`}
              data-testid={`khung-${k}`} onClick={() => xemKhung(k)}
            >
              <span>{TAB[k]}</span>
              <small>{n}</small>
            </button>
          );
        })}
      </div>

      {pc.goiY === null && <p className={b.chu} data-testid="pc-chua-xep">{D.pcChuaXep}</p>}

      <div className={s.tenKhung} key={xem}>
        <b data-testid="pc-ten">{CHU_KHUNG[xem].toUpperCase()}</b>
        {dangDung ? <span className={`${s.nhanKhung} ${s.nhanDung}`} data-testid="pc-dang-dung">{D.pcDangDung}</span>
          : pc.goiY === xem ? <span className={s.nhanKhung} data-testid="pc-goi-y">{D.pcGoiY}</span> : null}
      </div>
      <p className={s.cach}>{CACH[xem]}</p>

      <p className={s.muc}>{D.pcViSao}</p>
      {dg.dauHieu.length === 0 ? <p className={b.chu}>{D.pcKhongDauHieu}</p> : (
        <ul className={s.dauHieu} data-testid="pc-dau-hieu">
          {dg.dauHieu.map((x) => (
            <li key={x.ma} className={m.mat} data-testid={`dh-${x.ma}`}>
              {/* Không chip nguồn SỔ/NÓI (founder 11/10: luật "không nói nguồn dữ liệu" áp cả HƯỚNG — khớp demo bản 6). */}
              <span className={m.matNoi}>{cauDauHieu(x)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className={s.muc}>{D.pcTrenSo}</p>
      <TrenSoCua ts={ts} daChon={dangDung} />

      {buoc.length > 0 && (
        <>
          <p className={s.muc}>{D.pcBuoc}</p>
          {buoc.map((x, i) => (
            <BuocDung
              key={x.ma} x={x} i={i} hu={hu} onDi={() => diBuoc(x)}
              onPhanLoai={(h, v) => { void phanLoai(h, v); }}
            />
          ))}
          <p className={s.chan}>{D.pcBuocChan}</p>
        </>
      )}

      {loi !== null && <p className={s.loi} role="alert">{loi}</p>}
      {!dangDung && (
        <button
          ref={nutDung} type="button" className={`${g.nut2} ${g.khac} ${g.vang} ${g.rong100} ${s.nutDung}`}
          data-testid="pc-dung" onClick={() => { void dungKhung(); }}
        >
          {`${D.pcDungPre}${TAB[xem]}`}
        </button>
      )}
    </section>
  );
}

function cauDauHieu(x: DauHieu): string {
  const n = x.n ?? 0;
  const p = pt(x.p ?? 0);
  switch (x.ma) {
    case 'thu_that_thuong': return `${D.dhThuThatPre}${p}${D.dhThuThatGiua}${n}${D.dhThuThatHau}`;
    case 'noi_that_thuong':
    case 'noi_deu': return `${D.dhNoiPre}"${x.nhan ?? ''}"`;
    case 'da_chia_hu': return `${D.dhChiaPre}${p}${D.dhChiaGiua}${n}${D.dhChiaHau}`;
    case 'nhieu_muc_tieu': return `${n}${D.dhMucTieuHau}`;
    case 'co_tu_chia': return `${n}${D.dhQuyTacHau}`;
    case 'thu_deu': return `${D.dhThuDeuPre}${n}${D.dhThuDeuGiua}${p}${D.dhThuDeuHau}`;
    case 'it_tui': return n === 0 ? D.dhKhongTui : `${D.dhItTuiPre}${n}${D.dhItTuiHau}`;
    case 'ghi_deu_it_chia': return `${D.dhGhiPre}${n}/${x.m ?? 0}${D.dhGhiGiua}${p}${D.dhGhiHau}`;
    case 'tuan_lech': return `${D.dhTuanPre}${n}${D.dhTuanGiua}${p}${D.dhTuanHau}`;
    case 'chua_muc_tieu': return D.dhChuaMucTieu;
  }
}

/** KHUNG NÀY TRÊN SỔ CỦA BẠN — số của chính người dùng, xếp theo cách khung ấy nhìn. */
function TrenSoCua({ ts, daChon }: { ts: TrenSo; daChon: boolean }): React.ReactElement {
  if (ts.khung === 'hu') {
    return (
      <>
        <div className={b.ba} data-testid="ts-hu">
          <div className={`${b.o} ${b.oDe}`}>
            <span className={b.nhan}>{D.tsTuiGom}</span><b className={b.soVua}>{ts.tuiTich}</b>
          </div>
          <div className={`${b.o} ${b.oChi}`}>
            <span className={b.nhan}>{D.tsTuiTieu}</span><b className={b.soVua}>{ts.tuiTieu}</b>
          </div>
          <div className={b.o}>
            <span className={b.nhan}>{D.tsChuaVaoTui}</span>
            <b className={b.soVua}>{ts.chuaVaoTui === null ? '—' : pt(ts.chuaVaoTui)}</b>
          </div>
        </div>
      </>
    );
  }
  if (ts.khung === '50_30_20') {
    if (ts.thu <= 0) return <p className={b.chu} data-testid="ts-503020">{D.tsChuaCoThu}</p>;
    /* ⚠ P7 — nhóm không có hũ nào mang nhãn ấy thì là "—", không phải "0%": chưa phân loại ≠ không tiêu (chữ ở chú giải). */
    const khuc = [
      { k: 'ty', so: ts.thietYeu, lop: s.khucThietYeu, ten: D.tsThietYeu, co: ts.nThietYeu > 0 },
      { k: 'mu', so: ts.muon, lop: s.khucMuon, ten: D.tsMuon, co: ts.nMuon > 0 },
      { k: 'cr', so: ts.chuaRo, lop: b.khucSoc, ten: D.tsChuaRo, co: true },
      { k: 'dd', so: ts.deDanh, lop: s.khucDeDanh, ten: D.tsDeDanh, co: true },
    ];
    const thuoc = Math.max(ts.thu, khuc.reduce((a, x) => a + x.so, 0));
    const nhap = nhap503020(ts.thu);
    return (
      <div data-testid="ts-503020">
        <div className={b.thanhChia} role="img" aria-label={D.pcTrenSo}>
          {khuc.filter((x) => x.so > 0).map((x, i) => (
            <i
              key={x.k} className={x.lop}
              style={{ width: `${(x.so / thuoc) * 100}%`, '--i': i } as CSSProperties}
            />
          ))}
          {/* Khung đã CHỌN ⇒ hai vạch của công thức công khai (50 · 80) nằm trên chính thanh của người dùng (P3). */}
          {daChon && [TY_LE_50_30_20.thietYeu, TY_LE_50_30_20.thietYeu + TY_LE_50_30_20.muon].map((v) => (
            <u
              key={v} className={s.vachKhung} style={{ left: `${(ts.thu * v) / 100 / thuoc * 100}%` }}
              aria-hidden="true" data-testid="ts-vach"
            />
          ))}
        </div>
        <div className={b.chuGiai}>
          {khuc.map((x) => (
            <span key={x.k} className={b.chip}>
              <b className={x.lop} />{`${x.ten} ${x.co ? pt(x.so / ts.thu) : '—'}`}
            </span>
          ))}
        </div>
        <p className={b.dongSo}>{`${D.thangNho}${soThangCua(ts.thang)} · ${D.tsTienVaoPre}${tienNgan(ts.thu)}`}</p>
        {daChon && (
          <p className={s.nhap} data-testid="ts-nhap">
            {`${D.tsNhapPre}${D.thangNho}${soThangCua(ts.thang)}: ${D.tsThietYeu} ${tienNgan(nhap.thietYeu)} · `
              + `${D.tsMuon} ${tienNgan(nhap.muon)} · ${D.tsDeDanh} ${tienNgan(nhap.deDanh)}`}
          </p>
        )}
      </div>
    );
  }
  const hang: [string, string][] = [
    [D.kq1, `${D.thangNho}${soThangCua(ts.thang)}: ${ts.thu > 0 ? tienNgan(ts.thu) : '—'}`],
    [D.kq2, D.kqCuaBan],
    [D.kq3, `${D.kqTuanNay}${tienNgan(ts.chiTuan)}`],
    [D.kq4, D.kqCuaBan],
  ];
  return (
    <ol className={s.bonCau} data-testid="ts-kakeibo">
      {hang.map(([cau, dap]) => (
        <li key={cau}><span className={s.cauKq}>{cau}</span><span className={s.dapKq}>{dap}</span></li>
      ))}
    </ol>
  );
}

/**
 * TÊN + LÝ DO + NHÃN NÚT của một bước dựng — MỘT nguồn cho hai chỗ: bước dựng của thẻ PHONG CÁCH (dưới) và tên hướng trên
 * tấm HƯỚNG (D453, `components/pfm/TheHuong.tsx`). Hai chỗ tự ghép câu là hai câu cho cùng một việc, và một câu sẽ trôi.
 */
export function tieuVaLyBuoc(x: HoTro, hu: readonly Hu[]): { tieu: string; ly: string; nut: string | null } {
  const ten = x.huId === undefined ? '' : (hu.find((h) => h.id === x.huId)?.ten ?? '').toUpperCase();
  const cuaSo = PFM.GUONG_CUA_SO_TIEN_VE;
  let tieu = '';
  let ly = '';
  let nut: string | null = D.nutQuyTac;
  switch (x.ma) {
    case 'tu_chia_vi_the':
      tieu = `${ten}${D.htTuChiaNgayHau}`;
      ly = x.thang !== undefined && x.x !== undefined
        ? `${D.htTrePre}${thangNam(x.thang)}${D.htTreGiua}${x.x}${D.htTreHau}(${thangNam((x.kyHan ?? '').slice(0, 7))})`
        : `${D.htChuaNhipPre}${thangNam((x.kyHan ?? '').slice(0, 7))}`;
      break;
    case 'tu_chia_tien_ve':
      tieu = `${ten}${D.htPhanTramHau}`;
      ly = x.x !== undefined ? `${cuaSo}${D.htSauVePre}${phay1(x.x)}${D.htSauVeHau}` : D.htNoiTienVe;
      break;
    case 'hu_cho_chua_chia':
      tieu = D.htHuTieu;
      ly = `${pt(x.p ?? 0)}${D.htChuaChiaGiua}${tienNgan(x.so ?? 0)}${D.htChuaChiaHau}`;
      nut = D.nutTaoHu;
      break;
    case 'hu_tich_dau':
      tieu = D.htHuTich;
      ly = D.htHuTichLy;
      nut = D.nutTaoHu;
      break;
    case 'luat_tien_ve':
      tieu = D.htLuatVe;
      ly = x.x !== undefined ? `${cuaSo}${D.htSauVePre}${phay1(x.x)}${D.htSauVeNgan}` : D.htNoiTienVeNgan;
      nut = D.nutVietLuat;
      break;
    case 'luat_ngay_dam':
      tieu = D.htLuatDam;
      ly = x.x !== undefined ? `${D.htCuoiTuanPre}${phay1(x.x)}${D.htCuoiTuanHau}` : D.htNoiNgayDam;
      nut = D.nutVietLuat;
      break;
    case 'phan_loai':
      tieu = D.htPhanLoai;
      ly = `${D.htPhanLoaiPre}${x.n ?? 0}${D.htPhanLoaiHau}`;
      nut = null;
      break;
    case 'chot_tuan':
      tieu = D.htChotTuan;
      ly = D.htChotTuanLy;
      nut = D.nutMo;
      break;
  }
  return { tieu, ly, nut };
}

function BuocDung({ x, i, hu, onDi, onPhanLoai }: {
  x: HoTro; i: number; hu: readonly Hu[]; onDi: () => void; onPhanLoai: (h: Hu, thietYeu: boolean) => void;
}): React.ReactElement {
  const { tieu, ly, nut } = tieuVaLyBuoc(x, hu);
  return (
    <div className={s.buoc} style={{ '--i': i } as CSSProperties} data-testid={`buoc-${x.ma}`}>
      <div className={s.hangBuoc}>
        <span className={s.noi}>
          <span className={s.tieuDong}>{tieu}</span>
          <span className={s.phuDong}>{ly}</span>
        </span>
        {nut !== null && (
          <button type="button" className={`${g.nut2} ${g.khac} ${g.chinh} ${s.nutBuoc}`} onClick={onDi}>{nut}</button>
        )}
      </div>
      {x.ma === 'phan_loai' && (
        <div className={s.phanLoai}>
          {hu.filter((h) => laTieuDung(h) && h.trangThai === 'dang_chay').map((h) => (
            <div key={h.id} className={s.hangLoai} data-testid={`loai-${h.id}`}>
              <span className={s.tenLoai}>{h.ten.toUpperCase()}</span>
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)} type="button" aria-pressed={h.thietYeu === v}
                  className={`${s.chipLoai} ${h.thietYeu === v ? s.chipChon : ''}`}
                  onClick={() => onPhanLoai(h, v)}
                >
                  {v ? D.tsThietYeu : D.tsMuon}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
