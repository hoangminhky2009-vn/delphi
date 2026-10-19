/**
 * KHU NGƯỜI DÙNG (D335) — danh sách + trang một người, bám demo đã chốt.
 *
 * ⚠ RIÊNG TƯ Ở MÀN chỉ là NÓI RA; chặn thật ở server (`admin_phan_tich.ts` luật 4): người đang tắt ghi không có
 *   một dòng telemetry nào rời máy chủ, kể cả dòng cũ. Màn tắt các chip lọc không có dữ liệu cho khỏi bấm vào khoảng
 *   trắng rồi tưởng lỗi.
 * ⚠ Không có email ở đâu cả — `web/tests/quantri.test.tsx` quét mã nguồn thư mục này.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AGE_BAND_LABELS, OCCUPATION_LABELS, REGION_LABELS } from '@/lib/labels';
import {
  useDsNguoiPT, useMotNguoiPT, type PhienDTO, type SapNguoi, type SuKienDTO, type ThamSoKhoang,
} from '@/api/phantich';
import { Cho } from '@/screens/admin/Cho';
import { tenBuocHuongDan, tenCheDo, tenLyDoToken, tenMan, tenNut, tenTaiChinh } from './chu';
import { gioVN, ngayDu, ngayGioVN, ngayVN, so, tenThu, thoiLuong } from './khoang';
import s from './QuanTriApp.module.css';

const nhan = (bang: Record<string, string>, k: string) => bang[k] ?? k;

export function NguoiDung({ k, homNay, nguoi, moNguoi }: {
  k: ThamSoKhoang; homNay: string; nguoi: string | null; moNguoi: (h: string | null) => void;
}) {
  if (nguoi) return <MotNguoi handle={nguoi} k={k} veDs={() => moNguoi(null)} />;
  return <DanhSach k={k} homNay={homNay} moNguoi={moNguoi} />;
}

/* ══ Danh sách ════════════════════════════════════════════════════════════ */

function DanhSach({ k, homNay, moNguoi }: { k: ThamSoKhoang; homNay: string; moNguoi: (h: string) => void }) {
  const [tham, datTham] = useSearchParams();
  const loc = (tham.get('loc') ?? '').split(',').filter((x) => ['ghi', 'tran', 'moi'].includes(x));
  const sap = (['cuoi', 'phien', 'tran', 'tao'] as const).find((x) => x === tham.get('sap')) ?? 'cuoi';
  const trang = Math.max(0, Number(tham.get('trang')) || 0);
  const [go, datGo] = useState(tham.get('tim') ?? '');
  const tim = tham.get('tim') ?? '';
  const dat = (doi: Record<string, string | null>) => {
    const t = new URLSearchParams(tham);
    for (const [key, v] of Object.entries(doi)) { if (v === null || v === '') t.delete(key); else t.set(key, v); }
    datTham(t, { replace: true });
  };
  // Gõ tìm: đợi 300ms mới hỏi server — mỗi phím một request là nhân tải cho một bảng quét cả người dùng.
  useEffect(() => {
    if (go === tim) return undefined;
    const h = window.setTimeout(() => dat({ tim: go.trim().toLowerCase(), trang: null }), 300);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go]);
  const q = useDsNguoiPT(k, { tim, loc, sap, trang });
  const batLoc = (x: string) => {
    const moi = loc.includes(x) ? loc.filter((y) => y !== x) : [...loc, x];
    dat({ loc: moi.join(','), trang: null });
  };
  const chip = (x: string, ten: string) => (
    <button type="button" className={s.chip} aria-pressed={loc.includes(x)} onClick={() => batLoc(x)}>{ten}</button>
  );
  const truocDay = (iso: string | null) => {
    if (!iso) return <span className={s.an}>chưa vào</span>;
    const d = ngayVN(Date.parse(iso));
    const cach = Math.round((Date.parse(`${homNay}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86_400_000);
    return cach <= 0 ? 'hôm nay' : `${cach} ngày trước`;
  };
  return (
    <>
      <div className={s.khuDau}>
        <h1 className={s.khuTen}>NGƯỜI DÙNG</h1>
        <span className={s.khuMo}>{q.data ? `${so(q.data.tong)} tài khoản · ` : ''}bấm một dòng để xem dòng thời gian</span>
      </div>
      <div className={s.timO}>
        <input type="search" id="pt-tim" aria-label="Tìm theo tên hiển thị" placeholder="tìm theo tên hiển thị…"
          value={go} onChange={(e) => datGo(e.target.value)} />
        {chip('ghi', 'đang bật ghi')} {chip('tran', 'có trận trong khoảng')} {chip('moi', 'mới trong khoảng')}
        <select id="pt-sap" aria-label="Sắp xếp" value={sap} onChange={(e) => dat({ sap: e.target.value as SapNguoi, trang: null })}>
          <option value="cuoi">sắp: lần cuối vào</option>
          <option value="phien">sắp: số phiên</option>
          <option value="tran">sắp: số trận</option>
          <option value="tao">sắp: mới tạo</option>
        </select>
      </div>
      <Cho q={q} con={q.data ? (
        <div className={s.khoi}>
          <div className={s.cuon}>
            <table className={s.bang}>
              <thead>
                <tr>
                  <th>tên hiển thị</th><th>tạo lúc</th><th>lần cuối vào</th><th className={s.so}>phiên</th>
                  <th className={s.so}>trận</th><th>tuổi</th><th>vùng</th><th>nghề</th><th>ghi cách dùng</th>
                </tr>
              </thead>
              <tbody>
                {q.data.nguoi.length === 0 ? <tr><td colSpan={9} className={s.an}>không có ai khớp bộ lọc</td></tr> : null}
                {q.data.nguoi.map((u) => (
                  <tr key={u.handle} className={s.bam} data-testid={`dong-${u.handle}`} onClick={() => moNguoi(u.handle)}>
                    <td>
                      <b>{u.handle}</b>
                      {u.quan_tri ? <> <span className={s.nhan2}>quản trị</span></> : null}
                      {u.thu ? <> <span className={s.nhan2}>thử</span></> : null}
                      {u.khach ? <> <span className={s.nhan2}>khách</span></> : null}
                    </td>
                    <td>{ngayGioVN(u.tao)}</td>
                    <td>{truocDay(u.lan_cuoi)}</td>
                    <td className={s.so}>{u.phien === null ? <span className={s.an}>—</span> : so(u.phien)}</td>
                    <td className={s.so}>{so(u.tran)}</td>
                    <td>{nhan(AGE_BAND_LABELS, u.tuoi)}</td>
                    <td>{nhan(REGION_LABELS, u.vung)}</td>
                    <td>{nhan(OCCUPATION_LABELS, u.nghe)}</td>
                    <td>{u.bat_ghi ? <span className={s.ghiOn}>✓ bật</span> : <span className={s.ghiTat}>tắt</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={s.tgHang} style={{ marginTop: 8 }}>
            <button type="button" className={s.nutPhu} disabled={trang === 0} onClick={() => dat({ trang: String(trang - 1) })}>‹ TRANG TRƯỚC</button>
            <span className={s.it}>
              {q.data.tong === 0 ? '0' : `${so(trang * q.data.moi_trang + 1)}–${so(trang * q.data.moi_trang + q.data.nguoi.length)}`} / {so(q.data.tong)}
            </span>
            <button type="button" className={s.nutPhu} disabled={(trang + 1) * q.data.moi_trang >= q.data.tong}
              onClick={() => dat({ trang: String(trang + 1) })}>TRANG SAU ›</button>
          </div>
          <p className={s.ghiChu}>Cột phiên chỉ có ở người bật ghi. Trận: trận đã mở trong khoảng. Không có cột email.</p>
        </div>
      ) : null} />
    </>
  );
}

/* ══ Một người ════════════════════════════════════════════════════════════ */

type Loc = 'tat_ca' | 'man' | 'cham' | 'tran' | 'tc' | 'loi';
const LOC: ReadonlyArray<[Loc, string]> = [
  ['tat_ca', 'TẤT CẢ'], ['man', 'MÀN HÌNH'], ['cham', 'CHẠM NÚT'], ['tran', 'TRẬN & TOKEN'], ['tc', 'TÀI CHÍNH'], ['loi', 'LỖI'],
];
const nhomSu = (su: SuKienDTO): Loc | 'khac' => {
  switch (su.loai) {
    case 'man': case 'roi_man': return 'man';
    case 'cham': return 'cham';
    case 'tran_vao': case 'tran_ket': case 'token': return 'tran';
    case 'tai_chinh': return 'tc';
    case 'loi': return 'loi';
    default: return 'khac';
  }
};

function DongSu({ su }: { su: SuKienDTO }) {
  let dau = '·'; let chu: React.ReactNode = ''; let phu: React.ReactNode = ''; let lop: string | undefined = '';
  switch (su.loai) {
    case 'man': dau = '▸'; lop = s.kMan; chu = tenMan(su.man); phu = thoiLuong(su.ms); break;
    case 'roi_man': dau = '▸'; lop = s.kMan; chu = `rời ${tenMan(su.man)}`; phu = thoiLuong(su.ms); break;
    case 'cham': dau = '●'; lop = s.kCham; chu = tenNut(su.nut); phu = su.man ? tenMan(su.man) : ''; break;
    case 'loi': dau = '✕'; lop = s.kLoi; chu = `Lỗi ${su.nguon === 'api' ? 'gọi máy chủ' : 'giao diện'} · ${su.ma ?? '?'}`; phu = su.man ? tenMan(su.man) : ''; break;
    case 'tai_chinh': dau = '₫'; lop = s.kTc; chu = tenTaiChinh(su.ma); phu = 'không có số tiền'; break;
    case 'huong_dan': dau = '◆'; chu = tenBuocHuongDan(su.buoc); break;
    case 'dang_nhap': dau = '→'; chu = 'Đăng nhập'; break;
    case 'tran_vao':
      dau = '⚑'; lop = s.kTran;
      chu = su.buoi_do ? 'Vào trận buổi đo' : `Vào trận bàn ${su.so_o ?? '?'} ô${su.che_do ? ` · ${tenCheDo(su.che_do)}` : ''}`;
      break;
    case 'tran_ket':
      dau = '⚑'; lop = s.kTran;
      if (su.buoi_do) { chu = 'Kết trận buổi đo'; phu = 'không hiện bàn, nhóm, hạng'; }
      else if (su.trang_thai === 'bo_do') { chu = 'Bỏ dở trận'; phu = 'lúc nước đi cuối'; }
      else { chu = su.hang !== null && su.so_ghe !== null ? `Kết trận · hạng ${su.hang}/${su.so_ghe}` : 'Kết trận'; }
      break;
    case 'token':
      dau = 'T'; lop = s.kTran;
      chu = `${su.delta > 0 ? '+' : ''}${su.delta.toLocaleString('vi-VN')} T · ${tenLyDoToken(su.ly_do)}`;
      break;
    default: break;
  }
  return (
    <div className={`${s.su} ${lop ?? ''}`}>
      <span className={s.suGio}>{gioVN(su.ts)}</span>
      <span className={s.suDau} aria-hidden>{dau}</span>
      <span className={s.suChu}>{chu}</span>
      <span className={s.suPhu}>{phu}</span>
    </div>
  );
}

function MotNguoi({ handle, k, veDs }: { handle: string; k: ThamSoKhoang; veDs: () => void }) {
  const q = useMotNguoiPT(handle, k);
  const [loc, datLoc] = useState<Loc>('tat_ca');
  const dau = q.data?.pages[0];
  const ngayDs = q.data?.pages.flatMap((p) => p.ngay) ?? [];
  const bat = dau?.ho_so.bat_ghi ?? false;
  const hop = (su: SuKienDTO) => loc === 'tat_ca' || nhomSu(su) === loc;
  const maxGio = Math.max(1, ...(dau?.gio?.flat() ?? [0]));

  return (
    <>
      <button type="button" className={s.lui} onClick={veDs}>‹ DANH SÁCH NGƯỜI DÙNG</button>
      <Cho q={q} con={dau ? (
        <>
          <div className={s.nguoiDau}>
            <h1 className={s.nguoiTen}>{dau.ho_so.handle}</h1>
            {bat ? <span className={`${s.nhan2} ${s.nhan2Ok}`}>✓ ĐANG BẬT GHI CÁCH DÙNG APP</span>
              : <span className={`${s.nhan2} ${s.nhan2Tat}`}>ĐANG TẮT GHI CÁCH DÙNG APP</span>}
            <span className={s.nhan2}>
              {nhan(AGE_BAND_LABELS, dau.ho_so.tuoi)} · {nhan(REGION_LABELS, dau.ho_so.vung)} · {nhan(OCCUPATION_LABELS, dau.ho_so.nghe)}
            </span>
            <span className={s.nhan2}>tạo {ngayGioVN(dau.ho_so.tao)}</span>
            {dau.ho_so.quan_tri ? <span className={s.nhan2}>quản trị</span> : null}
            {dau.ho_so.thu ? <span className={s.nhan2}>thử</span> : null}
            {dau.ho_so.khach ? <span className={s.nhan2}>khách</span> : null}
          </div>
          <div className={s.rao} data-testid="rao-rieng-tu">
            <b>RIÊNG TƯ</b> · chỉ tên hiển thị, không email · lượt mở trang này đã ghi vào nhật ký quản trị
            {bat ? '' : <> · <b>người này đang tắt ghi</b>: không hiện màn hình, lượt chạm, lỗi, tài chính — kể cả dữ liệu cũ; chỉ còn trận &amp; token</>}
          </div>
          <div className={s.hangO}>
            <div className={s.o}><div className={s.oNhan}>PHIÊN</div><div className={s.oGt}>{so(dau.o.phien)}</div><div className={s.oPham}>trong khoảng</div></div>
            <div className={s.o}>
              <div className={s.oNhan}>THỜI GIAN TRONG APP</div>
              <div className={s.oGt}>{dau.o.ms_trong_app === null ? '—' : so(Math.round(dau.o.ms_trong_app / 60_000))}{dau.o.ms_trong_app === null ? null : <small>phút</small>}</div>
              <div className={s.oPham}>trong khoảng · cộng thời lượng các phiên có dòng đóng</div>
            </div>
            <div className={s.o}><div className={s.oNhan}>TRẬN</div><div className={s.oGt}>{so(dau.o.tran)}</div><div className={s.oPham}>trong khoảng · tổng {so(dau.ho_so.tong_tran)}</div></div>
            <div className={s.o}><div className={s.oNhan}>LỖI GẶP</div><div className={s.oGt}>{so(dau.o.loi)}</div><div className={s.oPham}>trong khoảng</div></div>
          </div>
          {dau.gio ? (
            <div className={s.khoi}>
              <div className={s.khoiTen}>GIỜ VÀO APP <span>số phiên theo thứ × giờ trong khoảng</span></div>
              <div className={s.heatMini}>
                <span />
                {Array.from({ length: 24 }, (_, g) => <span key={`g${g}`} style={{ textAlign: 'center' }}>{g % 3 === 0 ? g : ''}</span>)}
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((t, i) => (
                  <HangNhiet key={t} ten={t} dong={dau.gio![i]!} max={maxGio} />
                ))}
              </div>
            </div>
          ) : null}
          <div className={s.khoi}>
            <div className={s.khoiTen}>DÒNG THỜI GIAN <span>mới nhất ở trên · theo phiên</span></div>
            <div className={s.tgHang} style={{ marginBottom: 6 }}>
              {LOC.map(([id, ten]) => (
                <button key={id} type="button" className={s.chip} aria-pressed={loc === id}
                  disabled={!bat && id !== 'tat_ca' && id !== 'tran'} onClick={() => datLoc(id)}>{ten}</button>
              ))}
            </div>
            <p className={s.ghiChu}>Giờ màn hình và lượt chạm là lúc máy chủ nhận lô (lệch tới 30 giây); giờ trận và token đúng tới giây.</p>
            <div className={s.dongTg}>
              {ngayDs.length === 0 ? <p className={s.ghiChu}>Không có hoạt động nào trong khoảng này.</p> : null}
              {ngayDs.map((ng) => {
                const phien = ng.phien.map((p) => ({ p, su: p.su.filter(hop) })).filter((x) => x.su.length > 0);
                const ngoai = ng.ngoai_phien.filter(hop);
                if (phien.length === 0 && ngoai.length === 0) return null;
                return (
                  <div key={ng.ngay} data-testid={`ngay-${ng.ngay}`}>
                    <div className={s.ngayDau}>{tenThu(ng.ngay)} · {ngayDu(ng.ngay)}</div>
                    {phien.map(({ p, su }, i) => <KhoiPhien key={`${p.bd ?? p.kt}-${i}`} p={p} su={su} />)}
                    {ngoai.length ? (
                      <div className={s.phien}>
                        <div className={s.phienDau}><b>NGOÀI PHIÊN</b><span className={s.an}>{bat ? 'không thuộc phiên đo được' : 'chỉ trận & token'}</span></div>
                        {ngoai.map((x, j) => <DongSu key={j} su={x} />)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {q.hasNextPage ? (
              <button type="button" className={s.nutPhu} style={{ marginTop: 8 }} disabled={q.isFetchingNextPage}
                onClick={() => void q.fetchNextPage()}>
                {q.isFetchingNextPage ? 'ĐANG TẢI…' : 'TẢI THÊM NGÀY CŨ HƠN'}
              </button>
            ) : null}
          </div>
        </>
      ) : null} />
    </>
  );
}

function HangNhiet({ ten, dong, max }: { ten: string; dong: number[]; max: number }) {
  return (
    <>
      <span>{ten}</span>
      {dong.map((v, g) => (
        <i key={g} title={`${ten} ${g}:00 · ${v} phiên`}
          style={{ background: v ? `rgba(34,211,238,${(0.15 + (0.75 * v) / max).toFixed(2)})` : 'var(--gieng)' }} />
      ))}
    </>
  );
}

function KhoiPhien({ p, su }: { p: PhienDTO; su: SuKienDTO[] }) {
  const tu = p.bd ? gioVN(p.bd) : 'trước khoảng';
  const den = p.kt ? gioVN(p.kt) : 'không có dòng đóng';
  return (
    <div className={s.phien}>
      <div className={s.phienDau}>
        <b>PHIÊN {tu} → {den}</b>
        <span className={s.an}>
          {p.thieu_dong ? 'thời lượng không rõ (app tắt đột ngột hoặc mất mạng)' : thoiLuong(p.ms)} · {so(p.su.length)} sự kiện
        </span>
      </div>
      {[...su].reverse().map((x, j) => <DongSu key={j} su={x} />)}
    </div>
  );
}
