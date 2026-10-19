/**
 * PFM — BIỂU ĐỒ (D426). Ba thẻ LUÔN MỞ ở đầu màn GƯƠNG (tiền vào đi đâu · chi từng ngày · hũ tiêu dùng) · ruột hai nắp
 * (6 THÁNG · THÓI QUEN) · đường góp của một vị thế trên lá hũ ở màn HŨ. Số từ `pfm/bieu_do.ts`, chữ từ `CHU_BIEU_DO` (D26).
 *
 * ⚠⚠ THỨ TỰ LÀ ĐỘ HỮU ÍCH (founder 26/09: *"những cái ở vị trí đầu tiên / dễ nhìn nhất thì ưu tiên hữu ích"*): người mở
 *   GƯƠNG hỏi trước tiên "tiền tháng này đi đâu" → "ngày nào tiêu" → "hũ tiêu dùng tới đâu so với mức mình đặt". Ba thẻ ấy
 *   không gấp; phân tích sâu hơn nằm trong nắp bên dưới, và lá nắp vẫn mang số (§4-bis).
 * ⚠ A10 🔒 — chỉ TẢ: ▲▼ một màu trung tính (`.delta` của GƯƠNG), vượt mức không tô đỏ, không câu nào bảo tiêu ít đi.
 * ⚠ Hoạt ảnh chỉ `transform` (cột/khúc MỌC từ 0 bằng back-ease-out, so le theo `--nhip-bd-cach`); kích thước THẬT nằm inline
 *   — hoạt ảnh không bao giờ là nguồn chân lý của con số (nếp `ndThanhDay`, D122: khung ẩn thì hoạt ảnh có thể không chạy).
 * ⚠ Nút (?) · góc khấc · ô chênh DÙNG LẠI lớp của `Guong.module.css` (`g.*`) — một định nghĩa cho cả màn (A11.5).
 */
import { useMemo, useState, type CSSProperties, type PointerEvent as SuKienTro } from 'react';
import { Link } from 'react-router-dom';
import {
  chiTheoThu, hangHuTieu, luyKeChi, nguongChiLonThang, sauTienVe, soCungNgay, thangDauTien, tienDiDau, tienTungNgay,
  type DongHuTieu, type DongThang, type LanTienVe, type NgayTien, type TienDiDau,
} from '@/pfm/bieu_do';
import { laChiTieu, laThu, type Khoan } from '@/pfm/so';
import { laTieuDung, type Hu } from '@/pfm/hu';
import {
  ngayViet, soNgayTrongThang, thangSauCua, thangTruocCua, thuTrongTuan,
} from '@/pfm/thoi_gian';
import { CHU_BIEU_DO as B, CHU_MAN_GUONG, CHU_MAN_HU } from '@/lib/pfm_chu';
import { ROUTE_TAI_CHINH_HU } from '@/lib/vocab';
import { NHIP_RUNG, rung } from '@/lib/rung';
import g from './Guong.module.css';
import s from './BieuDo.module.css';
import { tienNgan } from './BieuDoViThe';

/* Biểu đồ vị thế + `tienNgan` sống ở `BieuDoViThe.tsx` (màn HŨ — và qua nó màn SỔ — chỉ cần chừng ấy, không cần cả khối
   biểu đồ của GƯƠNG); xuất lại ở đây giữ một cửa cho người đọc. */
export { BieuDoViThe, tienNgan } from './BieuDoViThe';

/* ═══ tiện ích ═════════════════════════════════════════════════════════════════════════════════ */

const dong = (n: number): string => n.toLocaleString('vi-VN');
const soThangCua = (thang: string): number => Number(thang.slice(5, 7));
const THU = [B.thu0, B.thu1, B.thu2, B.thu3, B.thu4, B.thu5, B.thu6] as const;

/**
 * ▲/▼ so với CHÍNH MÌNH (P12). `null` khi mốc ≤ 0 — "tháng trước chưa có số" không phải "▲ ∞%".
 * ⚠ Không kẹp: đây là nhãn, không phải một trục sổ đăng ký — "▲ 200%" là sự thật, kẹp về 100% là nói nhẹ đi (xem
 *   `Guong.tsx` §`nhanCoKep`).
 */
export function chenh(nay: number, truoc: number): string | null {
  if (truoc <= 0) return null;
  const p = Math.round(((nay - truoc) / truoc) * 100);
  return p === 0 ? '= 0%' : `${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%`;
}

/** Tên hũ để in. Hũ không còn trong danh sách ⇒ "HŨ KHÁC" — không bao giờ in id thô. */
function tenHu(hu: readonly Hu[], id: string): string {
  return hu.find((h) => h.id === id)?.ten.toUpperCase() ?? B.huKhac;
}

/** Màu khúc thứ `i` — TÊN công năng khai ở `.the` (`BieuDo.module.css`), không một mã màu nào ở đây. */
const mauChi = (i: number): string => `var(--bd-chi-${(i % 4) + 1})`;
const mauDe = (i: number): string => `var(--bd-de-${(i % 3) + 1})`;

/** Nút (?) — NÚT `.cham44` 44px không khấc, HÌNH `.hoi.khac` 21px bên trong (nếp D292 của GƯƠNG). */
/** Nút (?) 44×44 của mọi thẻ đầu GƯƠNG — D429 dùng lại cho hai thẻ định hướng (một hình nút, không bản thứ hai). */
export function NutHoi({ mo, onDoi, nhan }: { mo: boolean; onDoi: () => void; nhan: string }): React.ReactElement {
  return (
    <button
      type="button" className={g.cham44} aria-expanded={mo} aria-label={nhan}
      onClick={() => { rung(NHIP_RUNG.cham); onDoi(); }}
    >
      <span className={`${g.hoi} ${g.khac}`}>{mo ? '✕' : '?'}</span>
    </button>
  );
}

/* ═══ BA THẺ ĐẦU GƯƠNG — một bước tháng chung ═════════════════════════════════════════════════ */

/**
 * ⭐ BƯỚC THÁNG ‹ › — đây là "phân tích cuối tháng": lùi về tháng đã khép là ba thẻ nói trọn tháng ấy (cả tháng, so với
 * cả tháng trước nữa). Mép trái là tháng có khoản SỔ sớm nhất; mép phải là tháng đang chạy.
 * ⚠ `key={thang}` — đổi tháng là ba thẻ dựng lại, cột/khúc mọc lại từ 0: cú lật tháng NHÌN THẤY được, không chỉ đổi số.
 */
export function BieuDoThang({ tatCa, hu, thangNay, ngayNay }: {
  tatCa: readonly Khoan[]; hu: readonly Hu[]; thangNay: string; ngayNay: string;
}): React.ReactElement {
  const dau = useMemo(() => thangDauTien(tatCa), [tatCa]);
  const [thang, datThang] = useState(thangNay);
  const dangChay = thang === thangNay;
  const d = dangChay ? Number(ngayNay.slice(8, 10)) : soNgayTrongThang(thang);
  const x = useMemo(() => tienDiDau(tatCa, thang), [tatCa, thang]);
  const doi = (t: string): void => { rung(NHIP_RUNG.cham); datThang(t); };
  const namKhac = thang.slice(0, 4) !== thangNay.slice(0, 4);
  return (
    <section className={s.khoi} data-testid="bieu-do-thang">
      <div className={`${s.buoc} ${g.khac}`}>
        <button
          type="button" className={s.nutBuoc} aria-label={B.thangTruocAria}
          disabled={dau === null || thang <= dau} onClick={() => doi(thangTruocCua(thang))}
        >
          ‹
        </button>
        <span className={s.tenThang} data-testid="bd-thang">
          {`${B.thangPre}${soThangCua(thang)}${namKhac ? `/${thang.slice(0, 4)}` : ''}`}
        </span>
        <span className={s.phuThang}>{dangChay ? `${B.toiNgayPre}${d}` : B.daKhep}</span>
        <button
          type="button" className={s.nutBuoc} aria-label={B.thangSauAria}
          disabled={thang >= thangNay} onClick={() => doi(thangSauCua(thang))}
        >
          ›
        </button>
      </div>
      <div key={thang}>
        <TheTienDiDau x={x} hu={hu} />
        <TheChiTungNgay tatCa={tatCa} thang={thang} d={d} dangChay={dangChay} />
        {/* D453 — chỉ dựng khi có hũ tiêu dùng: thẻ trống chỉ để nói "chưa có" là chữ không mang tin (lối vào của nó là
            hướng "một hũ tiêu dùng cho phần chưa chia" trên tấm HƯỚNG). */}
        {hu.some(laTieuDung) && (
          <TheHuTieuDung tatCa={tatCa} hu={hu} thang={thang} d={d} dangChay={dangChay} chi={x.chi} />
        )}
      </div>
    </section>
  );
}

/* ── ① TIỀN VÀO ĐI ĐÂU ──────────────────────────────────────────────────────────────────────── */

interface Khuc { khoa: string; so: number; mau?: string; lop?: string }

/**
 * MỘT thanh cho cả tháng: khúc CHI (màu theo hũ tiêu dùng · sọc = chưa chia) → khúc ĐỂ DÀNH (theo hũ tích lũy) → CÒN DƯ.
 * Thước của thanh là tiền vào; tiêu + để dành vượt tiền vào thì thước là tổng ấy và vạch vàng đánh dấu chỗ hết tiền vào.
 * ⚠ Có hũ bị RÚT RÒNG trong tháng ⇒ để dành vẽ MỘT khúc ròng: vẽ từng hũ dương thì các khúc cộng lại lớn hơn con số
 *   ĐỂ DÀNH in ngay dưới (`TienDiDau.deDanhTheoHu`). Chú giải vẫn kể từng hũ, kể cả hũ bị rút.
 */
function TheTienDiDau({ x, hu }: { x: TienDiDau; hu: readonly Hu[] }): React.ReactElement {
  const [moGiai, datMoGiai] = useState(false);
  const trong = x.nThu + x.nChi + x.nChuyen === 0;
  const deDuong = Math.max(0, x.deDanh);
  const coRut = x.deDanhTheoHu.some((k) => k.so < 0);
  const khucDe: Khuc[] = coRut
    ? (deDuong > 0 ? [{ khoa: 'de', so: deDuong, mau: mauDe(0) }] : [])
    : x.deDanhTheoHu.map((k, i) => ({ khoa: `d-${k.huId}`, so: k.so, mau: mauDe(i) }));
  const khuc: Khuc[] = [
    ...x.chiTheoHu.map((k, i) => ({ khoa: `c-${k.huId}`, so: k.so, mau: mauChi(i) })),
    ...(x.chuaChia > 0 ? [{ khoa: 'chua', so: x.chuaChia, lop: s.khucSoc }] : []),
    ...khucDe,
    ...(x.du > 0 ? [{ khoa: 'du', so: x.du, lop: s.khucDu }] : []),
  ];
  const thuoc = Math.max(1, khuc.reduce((a, k) => a + k.so, 0));
  const vuot = x.thu > 0 && x.du < 0;
  /* ⚠ Phần khác 0 mà làm tròn ra 0 ⇒ "<1%": 5.000 đồng không phải "0%" (soi ảnh 26/09 — "CÒN DƯ 5.000 · 0%"). */
  const phanVao = (n: number): string => {
    if (x.thu <= 0) return '—';
    const p = Math.round((n / x.thu) * 100);
    return p === 0 && n !== 0 ? '<1%' : `${p}%`;
  };
  /* ⚠ P7 — phần nào không có một khoản nào đứng sau thì là "—", không phải "0": "chưa ghi" ≠ "0 đồng". */
  const soHoacGach = (so: number, n: number): string => (n === 0 ? '—' : dong(so));
  const phanHoacGach = (so: number, n: number): string => (n === 0 ? '—' : phanVao(so));
  return (
    <div className={`${s.the} ${g.khac}`} data-testid="the-di-dau">
      <div className={s.dau}>
        <span className={s.tieu}>{B.diDauTieu}</span>
        <NutHoi mo={moGiai} onDoi={() => datMoGiai((v) => !v)} nhan={B.diDauTieu} />
      </div>
      {moGiai && <p className={g.giai}>{B.giaiDiDau}</p>}
      {trong ? <p className={s.chu}>{B.thangTrong}</p> : (
        <>
          <div className={s.hangTong}>
            <span className={s.nhan}>{B.vao}</span>
            <span className={s.soLon} data-testid="dd-vao">{soHoacGach(x.thu, x.nThu)}</span>
            <span className={s.donVi}>đ</span>
          </div>
          <div className={s.thanhChia} role="img" aria-label={B.diDauTieu}>
            {khuc.map((k, i) => (
              <i
                key={k.khoa} className={k.lop}
                style={{ width: `${(k.so / thuoc) * 100}%`, background: k.mau, '--i': i } as CSSProperties}
              />
            ))}
            {vuot && <u className={s.mocVao} style={{ left: `${(x.thu / thuoc) * 100}%` }} aria-hidden="true" />}
          </div>
          <div className={s.ba}>
            <div className={`${s.o} ${s.oChi}`} data-testid="dd-chi">
              <span className={s.nhan}>{B.chi}</span>
              <b className={s.soVua}>{soHoacGach(x.chi, x.nChi)}</b>
              <span className={s.phu}>{phanHoacGach(x.chi, x.nChi)}</span>
            </div>
            <div className={`${s.o} ${s.oDe}`} data-testid="dd-de">
              <span className={s.nhan}>{B.deDanh}</span>
              <b className={s.soVua}>{soHoacGach(x.deDanh, x.nChuyen)}</b>
              <span className={s.phu}>{phanHoacGach(x.deDanh, x.nChuyen)}</span>
            </div>
            <div className={s.o} data-testid="dd-du">
              <span className={s.nhan}>{x.du < 0 ? B.vuot : B.du}</span>
              <b className={s.soVua}>{soHoacGach(Math.abs(x.du), x.nThu)}</b>
              <span className={s.phu}>{phanHoacGach(Math.abs(x.du), x.nThu)}</span>
            </div>
          </div>
          <div className={s.chuGiai}>
            {x.chiTheoHu.map((k, i) => (
              <span key={k.huId} className={s.chip}>
                <b style={{ background: mauChi(i) }} />{`${tenHu(hu, k.huId)} ${tienNgan(k.so)}`}
              </span>
            ))}
            {x.chuaChia > 0 && (
              <span className={s.chip}><b className={s.khucSoc} />{`${B.chuaChia} ${tienNgan(x.chuaChia)}`}</span>
            )}
            {x.deDanhTheoHu.map((k, i) => (
              <span key={k.huId} className={s.chip}>
                <b className={k.so < 0 ? s.oRut : undefined} style={k.so > 0 ? { background: mauDe(i) } : undefined} />
                {`${k.so < 0 ? B.rutPre : ''}${tenHu(hu, k.huId)} ${tienNgan(Math.abs(k.so))}`}
              </span>
            ))}
          </div>
          {x.thu === 0 && <p className={s.chu}>{B.chuaVao}</p>}
          {vuot && <p className={s.chu}>{`${B.vuotPre}${dong(-x.du)} đ.`}</p>}
        </>
      )}
    </div>
  );
}

/* ── ② CHI TỪNG NGÀY ────────────────────────────────────────────────────────────────────────── */

/**
 * Cột = tiêu của một ngày; ▲ vàng dưới trục = ngày tiền về; đỉnh vàng = ngày LỚN (đúng ngưỡng chỉ số chi bù đếm); vạch
 * đứt = mức thường (trung vị ngày có chi). Ngày KHÔNG GHI là một chấm mờ trên trục, khác cột 0 của ngày có ghi (P7).
 * ⚠ Chạm hoặc VUỐT qua các cột để đọc từng ngày: cột một ngày chỉ rộng ~10px, chạm trúng từng cột trên điện thoại là
 *   đánh đố — nên cả dải nhận vuốt (`touch-action: pan-y` giữ cuộn dọc cho màn).
 * ⚠ Tháng đang chạy: chọn sẵn HÔM NAY — "hôm nay đã chi gì" là câu hỏi đứng đầu lúc mở màn.
 */
function TheChiTungNgay({ tatCa, thang, d, dangChay }: {
  tatCa: readonly Khoan[]; thang: string; d: number; dangChay: boolean;
}): React.ReactElement {
  const ngay = useMemo(() => tienTungNgay(tatCa, thang), [tatCa, thang]);
  const cung = useMemo(() => soCungNgay(tatCa, thang, d), [tatCa, thang, d]);
  const nguong = useMemo(() => nguongChiLonThang(tatCa, thang), [tatCa, thang]);
  const [cheDo, datCheDo] = useState<'ngay' | 'don'>('ngay');
  const [chon, datChon] = useState<number | null>(dangChay ? d - 1 : null);
  const [keo, datKeo] = useState(false);
  const max = Math.max(1, ...ngay.map((o) => o.chi));
  const ch = chenh(cung.nay, cung.truoc);
  const chonCot = (i: number): void => {
    if (i === chon) return;
    rung(NHIP_RUNG.cham);
    datChon(i);
  };
  const cotDuoiTro = (e: SuKienTro<HTMLDivElement>): number => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(ngay.length - 1, Math.floor(((e.clientX - r.left) / Math.max(1, r.width)) * ngay.length)));
  };
  const doiCheDo = (c: 'ngay' | 'don'): void => { rung(NHIP_RUNG.cham); datCheDo(c); };
  const oChon = chon !== null ? ngay[chon] : undefined;
  /* P7 — tới hôm nay chưa một khoản chi nào ⇒ "—", không "0": sổ chưa nói gì về tiêu, không phải nói "không tiêu". */
  const coChi = ngay.slice(0, d).some((o) => o.chi > 0);
  return (
    <div className={`${s.the} ${g.khac}`} data-testid="the-tung-ngay">
      <div className={s.dau}>
        <span className={s.tieu}>{B.ngayTieu}</span>
        <span className={s.cheDo}>
          <button type="button" aria-pressed={cheDo === 'ngay'} onClick={() => doiCheDo('ngay')}>{B.cheDoNgay}</button>
          <button type="button" aria-pressed={cheDo === 'don'} onClick={() => doiCheDo('don')}>{B.cheDoDon}</button>
        </span>
      </div>
      <div className={s.hangTong}>
        <span className={s.nhan}>{dangChay ? `${B.toiNgayPre}${d}` : `${B.caThangPre}${soThangCua(thang)}`}</span>
        <span className={s.soLon} data-testid="tn-nay">{coChi ? dong(cung.nay) : '—'}</span>
        <span className={s.donVi}>đ</span>
      </div>
      <p className={s.dongSo} data-testid="tn-truoc">
        {cung.truoc > 0 ? (
          <>
            {`${B.thangNganPre}${soThangCua(thangTruocCua(thang))}${dangChay ? B.cungNgayHau : B.caThangHau}`}
            {dong(cung.truoc)}
            {ch !== null && <span className={g.delta}>{` · ${ch}`}</span>}
          </>
        ) : B.chuaCoTruoc}
      </p>
      {cheDo === 'ngay' ? (
        <>
          <div
            className={s.cotKhung} role="group" aria-label={B.bieuDoNgayAria}
            onPointerDown={(e) => { datKeo(true); chonCot(cotDuoiTro(e)); }}
            onPointerMove={(e) => { if (keo) chonCot(cotDuoiTro(e)); }}
            onPointerUp={() => datKeo(false)}
            onPointerLeave={() => datKeo(false)}
            onPointerCancel={() => datKeo(false)}
          >
            {nguong !== null && (
              <span className={s.vachThuong} style={{ bottom: `${(nguong.nen / max) * 100}%` }} aria-hidden="true" />
            )}
            {ngay.map((o, i) => {
              const sau = dangChay && i + 1 > d;
              const lop = [
                s.cot, i === chon ? s.cotChon : '', dangChay && i + 1 === d ? s.cotNay : '',
                sau ? s.cotSau : '', !sau && o.soKhoan === 0 ? s.cotTrong : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={o.ngay} type="button" className={lop} aria-pressed={i === chon}
                  aria-label={`${ngayViet(o.ngay)}: ${dong(o.chi)} đ`} onClick={() => chonCot(i)}
                >
                  {o.chi > 0 && (
                    <i
                      className={nguong !== null && o.chi >= nguong.nguong ? s.lon : undefined}
                      style={{ height: `${Math.max(4, (o.chi / max) * 100)}%`, '--i': i } as CSSProperties}
                    />
                  )}
                  {o.thu > 0 && <b className={s.ve} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <div className={s.truc} aria-hidden="true">
            {ngay.map((o, i) => <span key={o.ngay}>{i % 7 === 0 ? i + 1 : ''}</span>)}
          </div>
          <div className={s.ghiChu}>
            <span className={s.gVe}>{B.ghiTienVe}</span>
            {nguong !== null && <span className={s.gThuong}>{`${B.ghiMucThuongPre}${tienNgan(nguong.nen)}`}</span>}
            {nguong !== null && <span className={s.gLon}>{B.ghiNgayLon}</span>}
          </div>
          {oChon !== undefined
            ? <ChiTietNgay tatCa={tatCa} o={oChon} />
            : <p className={s.chu}>{B.chamCot}</p>}
        </>
      ) : (
        <DuongCongDon tatCa={tatCa} thang={thang} d={d} dangChay={dangChay} />
      )}
    </div>
  );
}

/** Khoản của một ngày — ghi chú người dùng tự gõ, không có thì "chi"/"tiền vào". Bốn dòng đầu + "N khoản nữa". */
function ChiTietNgay({ tatCa, o }: { tatCa: readonly Khoan[]; o: NgayTien }): React.ReactElement {
  const ds = tatCa.filter((k) => k.ngay === o.ngay && (laChiTieu(k) || laThu(k)));
  return (
    <div className={s.chiTiet} data-testid="tn-chi-tiet">
      <div className={s.hangChiTiet}>
        <b>{`${THU[thuTrongTuan(o.ngay)]} · ${ngayViet(o.ngay)}`}</b>
        {o.soKhoan > 0 && <span className={s.phu}>{`${o.soKhoan}${B.khoanDonVi}`}</span>}
        <b className={s.soPhai}>{dong(o.chi)}</b>
      </div>
      {ds.length === 0 && <p className={s.chu}>{B.ngayKhongGhi}</p>}
      {ds.length > 0 && o.chi === 0 && <p className={s.chu}>{B.ngayKhongChi}</p>}
      {ds.slice(0, 4).map((k) => (
        <div key={k.id} className={s.dongKhoan}>
          <span>{k.ghiChu?.trim() || (laThu(k) ? B.khoanVe : B.khoanChi)}</span>
          <span className={laThu(k) ? s.soVao : undefined}>{`${laThu(k) ? '+' : '−'}${dong(k.soTien)}`}</span>
        </div>
      ))}
      {ds.length > 4 && <p className={s.chu}>{`${B.themKhoanPre}${ds.length - 4}${B.themKhoanHau}`}</p>}
    </div>
  );
}

/** Đường BẬC THANG của một dãy cộng dồn trong khung `0..n × 0..100` — mỗi ngày một bậc, đúng hình của tiền cộng dồn. */
function duongBac(l: readonly number[], top: number): string {
  let p = 'M0 100';
  l.forEach((v, i) => { p += ` V${(100 - (v / top) * 94).toFixed(2)} H${i + 1}`; });
  return p;
}

/** CỘNG DỒN: tháng này (tới hôm nay) chồng lên tháng trước (cả tháng) — "đang nhanh hay chậm hơn chính mình tháng trước". */
function DuongCongDon({ tatCa, thang, d, dangChay }: {
  tatCa: readonly Khoan[]; thang: string; d: number; dangChay: boolean;
}): React.ReactElement {
  const nay = useMemo(() => luyKeChi(tatCa, thang, dangChay ? d : undefined), [tatCa, thang, d, dangChay]);
  const truoc = useMemo(() => luyKeChi(tatCa, thangTruocCua(thang)), [tatCa, thang]);
  const n = Math.max(soNgayTrongThang(thang), truoc.length);
  const top = Math.max(1, nay.at(-1) ?? 0, truoc.at(-1) ?? 0);
  return (
    <>
      <svg
        className={s.svgDon} viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" role="img"
        aria-label={B.cheDoDon} data-testid="tn-cong-don"
      >
        <path className={s.dTruoc} d={duongBac(truoc, top)} />
        <path className={s.dNay} d={duongBac(nay, top)} />
      </svg>
      <div className={s.ghiChu}>
        <span className={s.gNay}>{`${B.duongNayPre}${soThangCua(thang)} `}<b>{tienNgan(nay.at(-1) ?? 0)}</b></span>
        <span className={s.gTruoc}>
          {`${B.duongTruocPre}${soThangCua(thangTruocCua(thang))} `}<b>{tienNgan(truoc.at(-1) ?? 0)}</b>
        </span>
      </div>
    </>
  );
}

/* ── ③ HŨ TIÊU DÙNG ─────────────────────────────────────────────────────────────────────────── */

/**
 * Mỗi hũ tiêu dùng một thanh: phần đã chia so với MỨC THÁNG người dùng tự đặt (P3 — app không đặt mức nào). Vạch ┆ vàng
 * là hôm nay trên cả tháng: tiêu đều thì thanh chạm đúng vạch — một mốc của LỊCH, không phải một chỉ tiêu app đặt ra.
 * ⚠ Vượt mức: thanh đầy, dòng dưới nói "vượt mức X" — cùng màu với mọi dòng khác (A10: không đỏ).
 */
function TheHuTieuDung({ tatCa, hu, thang, d, dangChay, chi }: {
  tatCa: readonly Khoan[]; hu: readonly Hu[]; thang: string; d: number; dangChay: boolean; chi: number;
}): React.ReactElement {
  const r = useMemo(() => hangHuTieu(tatCa, hu, thang, dangChay ? d : null), [tatCa, hu, thang, d, dangChay]);
  const [moGiai, datMoGiai] = useState(false);
  const soNgay = soNgayTrongThang(thang);
  const nhip = dangChay ? d / soNgay : null;
  return (
    <div className={`${s.the} ${g.khac}`} data-testid="the-hu-tieu">
      <div className={s.dau}>
        <span className={s.tieu}>{B.huTieuTieu}</span>
        {nhip !== null && r.dong.length > 0 && <span className={s.phuDau}>{`${B.nhipNgayPre}${d}/${soNgay}`}</span>}
        <NutHoi mo={moGiai} onDoi={() => datMoGiai((v) => !v)} nhan={B.huTieuTieu} />
      </div>
      {moGiai && <p className={g.giai}>{B.giaiHuTieu}</p>}
      {r.dong.length === 0 ? (
        <>
          <p className={s.chu}>{B.chuaCoHuTieu}</p>
          <Link to={ROUTE_TAI_CHINH_HU} className={s.nutLink}>{B.moHu}</Link>
        </>
      ) : (
        <>
          {r.dong.map((dh, i) => <HangHuTieu key={dh.hu.id} dh={dh} nhip={nhip} i={i} />)}
          {r.chuaChia > 0 && chi > 0 && (
            <div className={s.hangHu} data-testid="ht-chua-chia">
              <div className={s.hangSo}>
                <span className={s.tenHu}>{B.chuaChia}</span>
                <b className={s.soVua}>{dong(r.chuaChia)}</b>
                <span className={s.phu}>{`${Math.round((r.chuaChia / chi) * 100)}${B.phanTienChiHau}`}</span>
              </div>
              <div className={`${s.thanhHu} ${s.thanhSoc}`}>
                <i style={{ width: `${Math.min(100, (r.chuaChia / chi) * 100)}%`, '--i': r.dong.length } as CSSProperties} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HangHuTieu({ dh, nhip, i }: { dh: DongHuTieu; nhip: number | null; i: number }): React.ReactElement {
  const muc = dh.hu.muc;
  const p = muc !== null && muc > 0 ? dh.daTieu / muc : null;
  const ch = chenh(dh.daTieu, dh.truoc);
  return (
    <div className={s.hangHu} data-testid="ht-hang" data-hu={dh.hu.id}>
      <div className={s.hangSo}>
        <span className={s.tenHu}>{dh.hu.ten.toUpperCase()}</span>
        <b className={s.soVua}>{dong(dh.daTieu)}</b>
        <span className={s.phu}>{muc !== null ? `/ ${dong(muc)}` : CHU_MAN_HU.chuaDatMuc}</span>
        {ch !== null && <span className={`${g.delta} ${s.soPhai}`}>{ch}</span>}
      </div>
      {p !== null && (
        <div className={s.thanhHu}>
          <i style={{ width: `${Math.min(1, p) * 100}%`, '--i': i } as CSSProperties} />
          {nhip !== null && <u style={{ left: `${nhip * 100}%` }} aria-hidden="true" />}
        </div>
      )}
      {p !== null && p > 1 && muc !== null && <p className={s.chu}>{`${B.vuotMucPre}${dong(dh.daTieu - muc)} đ`}</p>}
    </div>
  );
}

/* ═══ RUỘT NẮP 6 THÁNG ═════════════════════════════════════════════════════════════════════════ */

/** Chữ trên lá nắp 6 THÁNG: "để dành TB 17%" trên các tháng ĐÃ KHÉP có tiền vào; chưa có tháng nào như thế ⇒ "3 tháng". */
export function tomSauThang(ds: readonly DongThang[], thangNay: string): string {
  if (ds.length === 0) return CHU_MAN_GUONG.chuaCo;
  const du = ds.filter((m) => m.thang !== thangNay && m.thu > 0);
  if (du.length === 0) return `${ds.length}${B.donViThang}`;
  const tb = Math.round((du.reduce((a, m) => a + m.deDanh / m.thu, 0) / du.length) * 100);
  return `${B.deDanhTbPre}${tb}%`;
}

/**
 * Mỗi tháng ba cột: tiền vào · chi · để dành. Tháng đang chạy mang dấu "·nay" và cột sọc — nó mới tới hôm nay, đặt cạnh
 * tháng trọn vẹn mà không đánh dấu là mời người ta so hai thứ không cùng cỡ.
 */
export function BieuDoSauThang({ ds, thangNay }: { ds: readonly DongThang[]; thangNay: string }): React.ReactElement {
  if (ds.length === 0) return <p className={s.chu}>{CHU_MAN_GUONG.chuaCo}</p>;
  const max = Math.max(1, ...ds.flatMap((m) => [m.thu, m.chi, Math.max(0, m.deDanh)]));
  const cao = (n: number): string => `${Math.max(0, n / max) * 100}%`;
  return (
    <div data-testid="bd-sau-thang">
      <div className={s.cotThang} role="img" aria-label={B.napSauThang}>
        {ds.map((m, j) => (
          <div key={m.thang} className={`${s.nhomThang} ${m.thang === thangNay ? s.thangNay : ''}`}>
            <div className={s.baCot}>
              <i className={s.cVao} style={{ height: cao(m.thu), '--i': j * 3 } as CSSProperties} />
              <i className={s.cChi} style={{ height: cao(m.chi), '--i': j * 3 + 1 } as CSSProperties} />
              <i className={s.cDe} style={{ height: cao(m.deDanh), '--i': j * 3 + 2 } as CSSProperties} />
            </div>
            <span className={s.nhanThang}>
              {`${B.thangNganPre}${soThangCua(m.thang)}${m.thang === thangNay ? B.thangDangChayHau : ''}`}
            </span>
            {/* Tỷ lệ để dành của CHÍNH tháng ấy, ngay dưới cột của nó — dồn thành một hàng riêng thì mắt phải đếm cột. */}
            <span className={s.tyLeThang} data-testid={`ty-le-${m.thang}`}>
              {m.thu > 0 ? `${Math.round((m.deDanh / m.thu) * 100)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
      <div className={s.ghiChu}>
        <span className={s.gVao}>{B.vao}</span>
        <span className={s.gChi}>{B.chi}</span>
        <span className={s.gDe}>{B.deDanh}</span>
        <span className={s.gTyLe}>{`% = ${B.tyLeDeDanh}`}</span>
      </div>
      <p className={s.chu}>{B.giaiSauThang}</p>
    </div>
  );
}

/* ═══ RUỘT NẮP THÓI QUEN (phần biểu đồ, trên các dòng chỉ số) ════════════════════════════════════ */

export function BieuDoThoiQuen({ tatCa, ngayNay }: { tatCa: readonly Khoan[]; ngayNay: string }): React.ReactElement {
  const tt = useMemo(() => chiTheoThu(tatCa, ngayNay), [tatCa, ngayNay]);
  const ve = useMemo(() => sauTienVe(tatCa, ngayNay), [tatCa, ngayNay]);
  const coSo = tt.dong.filter((x) => x.tb !== null);
  const maxThu = Math.max(1, ...coSo.map((x) => x.tb!));
  const thuLon = coSo.length === 0 ? -1 : coSo.reduce((a, x) => (x.tb! > a.tb! ? x : a)).thu;
  return (
    <div data-testid="bd-thoi-quen">
      <div className={s.tieuNho}>{B.theoThuTieu}</div>
      <div className={s.cotThu} role="img" aria-label={B.theoThuTieu}>
        {tt.dong.map((x) => (
          <div key={x.thu} className={s.oThu}>
            <div className={s.khungThu}>
              {x.tb === null
                ? <i className={s.thieu} />
                : (
                  <i
                    className={x.thu === thuLon ? s.lon : undefined}
                    style={{ height: `${Math.max(3, (x.tb / maxThu) * 100)}%`, '--i': x.thu } as CSSProperties}
                  />
                )}
            </div>
            <span className={s.nhanThu}>{THU[x.thu]}</span>
            <span className={s.soThu}>{x.tb === null ? '—' : tienNgan(Math.round(x.tb))}</span>
          </div>
        ))}
      </div>
      <p className={s.chu}>
        {coSo.length === 0 ? CHU_MAN_GUONG.thieuMau : `${B.theoThuChuPre}${tt.soNgay}${B.theoThuChuHau}`}
      </p>
      <div className={s.tieuNho}>{B.sauVeTieu}</div>
      {ve.length === 0 ? <p className={s.chu}>{CHU_MAN_GUONG.thieuMau}</p> : <DuongSauVe ve={ve} />}
    </div>
  );
}

/** Mỗi lần tiền về một đường bậc thang (mới nhất sáng nhất), cùng trục: hôm về → +6 ngày. */
function DuongSauVe({ ve }: { ve: readonly LanTienVe[] }): React.ReactElement {
  const n = 7;
  const top = Math.max(1, ...ve.flatMap((x) => x.luyKe));
  const LOP = [s.ve1, s.ve2, s.ve3] as const;
  return (
    <>
      <svg className={s.svgVe} viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" role="img" aria-label={B.sauVeTieu}>
        {[...ve].reverse().map((x) => (
          <path key={x.ngay} className={LOP[ve.indexOf(x)]} d={duongBac(x.luyKe, top)} />
        ))}
      </svg>
      <div className={s.trucVe} aria-hidden="true">
        {Array.from({ length: n }, (_, i) => <span key={i}>{i === 0 ? B.sauVeHomVe : `${B.sauVeNgayPre}${i}`}</span>)}
      </div>
      <div className={s.ghiChu}>
        {ve.map((x, i) => (
          <span key={x.ngay} className={s[`gVe${i + 1}`]}>
            {`${ngayViet(x.ngay)} · ${tienNgan(x.tien)} → `}<b>{tienNgan(x.luyKe.at(-1) ?? 0)}</b>
          </span>
        ))}
      </div>
      <p className={s.chu}>{B.sauVeChu}</p>
    </>
  );
}
