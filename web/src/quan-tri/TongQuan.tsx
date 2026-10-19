/**
 * KHU TỔNG QUAN (D335) — bám demo `docs/ui-ux/demo/phan-tich-quan-tri.html` (A11.25).
 *
 * ⚠ Màn KHÔNG tính lại một con số nào — mọi số là số server trả (C4 cùng tinh thần). Việc duy nhất ở đây là
 *   NÓI ĐÚNG phạm vi của từng số: "tất cả tài khoản" hay "người bật ghi", đo được hay chưa, dưới sàn thì "<5".
 * ⚠ null ≠ 0: ô không đo được hiện "—" kèm lý do, không bao giờ hiện 0 (A11.2).
 */
import type { OSoDTO, TongQuanPTDTO } from '@/api/phantich';
import { TEN_TUAN_GIU, tenMan } from './chu';
import { ngayDu, ngayNgan, pt, so, so1, thoiLuong } from './khoang';
import s from './QuanTriApp.module.css';

type Kieu = 'so' | 'phut' | 'pt';

/** Chênh so với kỳ trước — cùng câu chữ với demo. */
function Chenh({ gt, cu, kieu }: { gt: number | null; cu: number | null; kieu: Kieu }) {
  if (gt === null || cu === null) return null;
  if (kieu === 'pt') {
    const d = gt - cu;
    if (Math.abs(d) < 0.05) return <span className={s.an}>= kỳ trước</span>;
    return (
      <>
        <span className={d > 0 ? s.len : s.xuong}>{d > 0 ? '▲' : '▼'} {so1(Math.abs(d))} điểm %</span>{' '}
        <span className={s.an}>so với {so1(cu)}%</span>
      </>
    );
  }
  if (cu === 0) return <span className={s.an}>{gt === 0 ? '= kỳ trước' : 'kỳ trước 0'}</span>;
  const d = ((gt - cu) / cu) * 100;
  if (Math.abs(d) < 0.5) return <span className={s.an}>= kỳ trước</span>;
  return (
    <>
      <span className={d > 0 ? s.len : s.xuong}>{d > 0 ? '▲' : '▼'} {Math.round(Math.abs(d)).toLocaleString('vi-VN')}%</span>{' '}
      <span className={s.an}>so với {kieu === 'phut' ? so1(cu) : so(cu)}</span>
    </>
  );
}

function O({ nhan, gt, don, chenh, pham, testid }: {
  nhan: string; gt: React.ReactNode; don?: string; chenh?: React.ReactNode; pham: string; testid?: string;
}) {
  return (
    <div className={s.o} data-testid={testid}>
      <div className={s.oNhan}>{nhan}</div>
      <div className={s.oGt}>{gt}{don ? <small>{don}</small> : null}</div>
      <div className={s.oDelta}>{chenh ?? ' '}</div>
      <div className={s.oPham}>{pham}</div>
    </div>
  );
}

const phut = (ms: number | null): number | null => (ms === null ? null : ms / 60_000);

function tyLeQuay(o: OSoDTO, san: number): number | null {
  return o.quay_lai.nhom < san ? null : pt(o.quay_lai.co, o.quay_lai.nhom);
}

export function TongQuan({ d, soKy }: { d: TongQuanPTDTO; soKy: boolean }) {
  const { nay, truoc, san } = d;
  const c = (gt: number | null, cu: number | null, kieu: Kieu = 'so') =>
    (soKy ? <Chenh gt={gt} cu={cu} kieu={kieu} /> : null);
  /*
   * Ba ô hành vi (người hoạt động · phiên · mỗi phiên) chỉ so khi kỳ trước ĐO ĐƯỢC TRỌN. Kỳ trước bị cắt ở `tho_tu`
   * thì đếm của nó chỉ phủ vài ngày — so 30 ngày đủ với 5 ngày còn dữ liệu là dựng một cú "▲" giả. Và nói ra thay
   * vì để trống: ô trống đọc như "không đổi". (Quay lại tuần 2 là TỶ LỆ trên người đo được nên vẫn so được.)
   */
  const cHanhVi = (gt: number | null, cu: number | null, kieu: Kieu = 'so') => {
    if (!soKy || !nay.do_duoc) return null;
    if (!truoc.do_duoc) return <span className={s.an}>kỳ trước chưa đo được</span>;
    if (truoc.cat_tho) return <span className={s.an}>kỳ trước chỉ đo được một phần</span>;
    return <Chenh gt={gt} cu={cu} kieu={kieu} />;
  };
  const hanhVi = (gt: number | null) => (nay.do_duoc ? so(gt) : <span className={s.an}>—</span>);
  const quay = tyLeQuay(nay, san);
  return (
    <>
      <div className={s.khuDau}>
        <h1 className={s.khuTen}>TỔNG QUAN</h1>
        <span className={s.khuMo}>mọi số theo khoảng thời gian ở trên</span>
      </div>
      {!nay.do_duoc ? (
        <p className={`${s.ghiChu} ${s.tgCanh}`} data-testid="khong-do-duoc">
          Khoảng này nằm trước {ngayDu(d.khoang.tho_tu)} — chưa có dữ liệu phiên để đo số hành vi (chỉ còn số tài khoản
          và trận).
        </p>
      ) : nay.cat_tho ? (
        <p className={`${s.ghiChu} ${s.tgCanh}`}>Số hành vi chỉ tính từ {ngayDu(d.khoang.tho_tu)} — phần trước đó đã hết hạn lưu.</p>
      ) : null}
      <div className={s.hangO}>
        <O testid="o-tai-khoan-moi" nhan="TÀI KHOẢN MỚI" gt={so(nay.tai_khoan_moi)} chenh={c(nay.tai_khoan_moi, truoc.tai_khoan_moi)}
          pham={`tất cả tài khoản · ${so(nay.tai_khoan_moi_khach)} khách`} />
        <O testid="o-tran" nhan="TRẬN ĐÃ CHƠI" gt={so(nay.tran)} chenh={c(nay.tran, truoc.tran)}
          pham={`tất cả tài khoản · ${so(nay.tran_xong)} xong · ${so(nay.tran_bo_do)} bỏ dở`} />
        <O testid="o-hoat-dong" nhan="NGƯỜI HOẠT ĐỘNG" gt={hanhVi(nay.nguoi_hoat_dong)}
          chenh={cHanhVi(nay.nguoi_hoat_dong, truoc.nguoi_hoat_dong)} pham="người bật ghi · có ≥1 phiên" />
        <O testid="o-phien" nhan="PHIÊN" gt={hanhVi(nay.phien)} chenh={cHanhVi(nay.phien, truoc.phien)}
          pham="người bật ghi" />
        <O testid="o-moi-phien" nhan="MỖI PHIÊN"
          gt={nay.ms_moi_phien_tv === null ? <span className={s.an}>—</span> : so1(nay.ms_moi_phien_tv / 60_000)}
          don={nay.ms_moi_phien_tv === null ? undefined : 'phút'}
          chenh={cHanhVi(phut(nay.ms_moi_phien_tv), phut(truoc.ms_moi_phien_tv), 'phut')}
          pham={`trung vị · ${so(nay.phien_co_thoi_luong)} phiên có thời lượng`} />
        <O testid="o-quay-lai" nhan="QUAY LẠI TUẦN 2"
          gt={quay === null ? <span className={s.an}>&lt;{san}</span> : Math.round(quay).toLocaleString('vi-VN')}
          don={quay === null ? undefined : '%'}
          chenh={quay === null ? null : c(quay, tyLeQuay(truoc, san), 'pt')}
          pham={`người mới trong khoảng · n = ${nay.quay_lai.nhom < san ? `<${san}` : so(nay.quay_lai.nhom)}`
            + (nay.quay_lai.chua_toi ? ` · ${so(nay.quay_lai.chua_toi)} chưa tới tuần 2` : '')} />
      </div>

      <div className={s.khoi}>
        <div className={s.khoiTen}>
          HOẠT ĐỘNG THEO NGÀY
          <span className={s.chuGiai}>
            <span><i style={{ background: 'rgba(34,211,238,.55)' }} />người hoạt động</span>
            <span><i style={{ background: 'var(--vang)' }} />tài khoản mới</span>
          </span>
        </div>
        <BieuDo chuoi={d.chuoi} />
        <p className={s.ghiChu}>Rê chuột lên cột để xem số từng ngày. Ngày trước {ngayNgan(d.khoang.tho_tu)} không có cột người hoạt động: chưa có dữ liệu phiên.</p>
      </div>

      <div className={s.luoi2}>
        <div className={s.khoi}>
          <div className={s.khoiTen}>PHỄU NGƯỜI MỚI <span>tài khoản email tạo trong khoảng</span></div>
          <Pheu p={d.pheu} san={san} />
        </div>
        <div className={s.khoi}>
          <div className={s.khoiTen}>GIỮ CHÂN THEO TUẦN TẠO TÀI KHOẢN <span>người bật ghi · ô dưới {san} người ẩn</span></div>
          <GiuChan hang={d.giu_chan} san={san} />
        </div>
      </div>

      <div className={s.luoi2}>
        <div className={s.khoi}>
          <div className={s.khoiTen}>MÀN ĐƯỢC DÙNG <span>người bật ghi</span></div>
          <div className={s.cuon}>
            <table className={s.bang}>
              <thead><tr><th>màn</th><th className={s.so}>lượt vào</th><th className={s.so}>người</th><th className={s.so}>thời gian mỗi người (trung vị)</th></tr></thead>
              <tbody>
                {d.man.length === 0 ? <tr><td colSpan={4} className={s.an}>chưa có dữ liệu</td></tr> : d.man.map((m) => (
                  <tr key={m.man}>
                    <td>{tenMan(m.man)} <span className={s.it}>{m.man}</span></td>
                    <td className={s.so}>{so(m.luot)}</td>
                    <td className={s.so}>{m.nguoi < san ? <span className={s.an}>&lt;{san}</span> : so(m.nguoi)}</td>
                    <td className={s.so}>{thoiLuong(m.ms_moi_nguoi_tv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={s.khoi}>
          <div className={s.khoiTen}>LỖI <span>người bật ghi · theo màn</span></div>
          <div className={s.cuon}>
            <table className={s.bang}>
              <thead><tr><th>màn</th><th>loại</th><th className={s.so}>lượt</th></tr></thead>
              <tbody>
                {d.loi.length === 0 ? <tr><td colSpan={3} className={s.an}>không có lỗi nào</td></tr> : d.loi.map((l) => (
                  <tr key={`${l.man}-${l.loai}-${l.ma}`}>
                    <td>{tenMan(l.man)}</td>
                    <td>{l.loai === 'loi_api' ? 'gọi máy chủ' : 'giao diện'} · {l.ma ?? '?'}</td>
                    <td className={s.so}>{so(l.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.ghiChu}>Tổng {so(d.loi.reduce((a, l) => a + l.n, 0))} lỗi trong khoảng.</p>
        </div>
      </div>
    </>
  );
}

function BieuDo({ chuoi }: { chuoi: TongQuanPTDTO['chuoi'] }) {
  const n = chuoi.length;
  if (n === 0) return null;
  const max = Math.max(4, ...chuoi.map((x) => Math.max(x.nguoi_hoat_dong ?? 0, x.tai_khoan_moi)));
  const W = 1000; const H = 200; const trai = 34; const day = 22; const rong = (W - trai) / n;
  const buoc = Math.max(1, Math.ceil(n / 10));
  const diem = chuoi.map((x, i) => `${trai + i * rong + rong / 2},${H - (x.tai_khoan_moi / max) * H}`).join(' ');
  return (
    <div className={s.cuon}>
      <svg viewBox={`0 0 ${W} ${H + day}`} width="100%" style={{ minWidth: 560, display: 'block' }} role="img" aria-label="Hoạt động theo ngày">
        {[0, 1, 2, 3, 4].map((k) => {
          const y = H - (H * k) / 4;
          return (
            <g key={k}>
              <line x1={trai} x2={W} y1={y} y2={y} stroke="#24303f" strokeWidth={1} />
              <text x={trai - 6} y={y + 4} fill="#7b8494" fontSize={12} textAnchor="end">{Math.round((max * k) / 4)}</text>
            </g>
          );
        })}
        {chuoi.map((x, i) => {
          const h = x.nguoi_hoat_dong === null ? 0 : (x.nguoi_hoat_dong / max) * H;
          return (
            <rect key={x.ngay} x={trai + i * rong + rong * 0.15} y={H - h} width={Math.max(1, rong * 0.7)} height={h} fill="rgba(34,211,238,.5)">
              <title>{`${ngayNgan(x.ngay)} · ${x.nguoi_hoat_dong === null ? 'chưa có dữ liệu phiên' : `${x.nguoi_hoat_dong} người hoạt động`} · ${x.tai_khoan_moi} tài khoản mới`}</title>
            </rect>
          );
        })}
        <polyline points={diem} fill="none" stroke="#fbbf24" strokeWidth={2} />
        {chuoi.map((x, i) => (i % buoc === 0 ? (
          <text key={`t${x.ngay}`} x={trai + i * rong + rong / 2} y={H + 16} fill="#7b8494" fontSize={12} textAnchor="middle">{ngayNgan(x.ngay)}</text>
        ) : null))}
      </svg>
    </div>
  );
}

function Pheu({ p, san }: { p: TongQuanPTDTO['pheu']; san: number }) {
  const hang = (ten: string, gt: number | null, goc: number, thuong: boolean, key: string) => {
    const an = gt !== null && gt > 0 && gt < san;
    const tyLe = gt === null || goc === 0 ? 0 : pt(gt, goc);
    return (
      <div className={s.pheuHang} key={key} data-testid={`pheu-${key}`}>
        <span>{ten}</span>
        <span className={`${s.pheuThanh} ${thuong ? s.pheuThanhThuong : ''}`}><i style={{ width: `${an ? 0 : tyLe}%` }} /></span>
        <span className={s.pheuSo}>
          {gt === null ? <span className={s.an}>không đo được</span>
            : an ? <span className={s.an}>&lt;{san}</span>
              : <><b>{so(gt)}</b><span className={s.it}>{goc ? ` · ${Math.round(tyLe)}%` : ''}</span></>}
        </span>
      </div>
    );
  };
  return (
    <>
      <div className={s.pheu}>
        {hang('Tạo tài khoản', p.tao_tai_khoan, p.tao_tai_khoan, true, 'tao')}
        {hang('Xác minh email', p.xac_minh, p.tao_tai_khoan, true, 'xac-minh')}
        {hang('Lập hồ sơ', p.lap_ho_so, p.tao_tai_khoan, true, 'ho-so')}
        {hang('Bật ghi cách dùng app', p.bat_ghi, p.tao_tai_khoan, true, 'bat-ghi')}
        <div className={s.pheuNgan}>TRONG SỐ NGƯỜI BẬT GHI</div>
        {hang('Xong màn tập', p.xong_tap, p.bat_ghi, false, 'xong-tap')}
        {hang('Vào trận đầu', p.vao_tran, p.bat_ghi, false, 'vao-tran')}
        {hang('Xong 3 trận', p.xong_3_tran, p.bat_ghi, false, 'xong-3')}
        {p.quay_lai.nhom >= san
          ? hang('Quay lại tuần 2', p.quay_lai.co, p.quay_lai.nhom, false, 'quay-lai')
          : (
            <div className={s.pheuHang} data-testid="pheu-quay-lai">
              <span>Quay lại tuần 2</span>
              <span className={s.pheuThanh}><i style={{ width: 0 }} /></span>
              {/* Mẫu số là người ĐÃ tới tuần 2 — dưới sàn thì tỷ lệ không lộ, kể cả khi tử số bằng 0. */}
              <span className={s.pheuSo}><span className={s.an}>{p.quay_lai.nhom === 0 ? 'chưa ai tới tuần 2' : `<${san} người tới tuần 2`}</span></span>
            </div>
          )}
      </div>
      <p className={s.ghiChu}>
        Bốn bậc đầu đếm mọi tài khoản email tạo trong khoảng (khách không có email nên không vào phễu). Từ "Xong màn tập"
        chỉ đếm người bật ghi. Quay lại tuần 2 = có phiên trong ngày 7–13 sau khi lập hồ sơ
        {p.quay_lai.chua_toi ? ` · ${so(p.quay_lai.chua_toi)} người chưa tới tuần 2` : ''}.
      </p>
    </>
  );
}

function GiuChan({ hang, san }: { hang: TongQuanPTDTO['giu_chan']; san: number }) {
  return (
    <>
      <div className={s.cuon}>
        <table className={s.bang}>
          <thead>
            <tr><th>tuần tạo tài khoản</th><th className={s.so}>người</th>{TEN_TUAN_GIU.map((t) => <th key={t} className={s.so}>{t}</th>)}</tr>
          </thead>
          <tbody>
            {hang.map((h) => (
              <tr key={h.tu}>
                <td>{ngayNgan(h.tu)} → {ngayNgan(h.den)}</td>
                <td className={s.so}>{h.n === null ? <span className={s.an}>&lt;{san}</span> : so(h.n)}</td>
                {h.tuan.map((o, k) => {
                  if (o.trang_thai === 'co') {
                    const p = pt(o.co, o.n);
                    return <td key={k} className={`${s.so} ${s.oNhiet}`} style={{ background: `rgba(34,211,238,${((p / 100) * 0.55).toFixed(2)})` }}>{Math.round(p)}%</td>;
                  }
                  return (
                    <td key={k} className={`${s.so} ${s.oNhiet} ${s.an}`}>
                      {o.trang_thai === 'it' ? `<${san}` : o.trang_thai === 'het_tho' ? 'hết hạn' : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={s.ghiChu}>Ô "—": nhóm chưa tới tuần đó. "hết hạn": dữ liệu phiên của tuần đó đã quá hạn lưu. Tuần 1 gồm cả ngày tạo tài khoản.</p>
    </>
  );
}
