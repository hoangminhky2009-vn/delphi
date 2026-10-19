/**
 * CHART TÀI SẢN — nút cửa sổ ở CHỖ CŨ của Bảng điện tử (founder 07/10: *"thêm 1 nút cửa sổ nữa (Dùng cái Nút bảng điện
 * tử cũ) Nhưng thay bằng chart các loại tài sản để bấm vào xem lịch sử qua các vòng. Ko cần làm nhiều nữa"*).
 *
 * · Dữ liệu = `lich_su_thi_truong` của trạng thái trận: % công khai từng mã của mọi vòng ĐÃ CHỐT (cùng số dải 6 mã
 *   vẫn hiện sau mỗi vòng — chỉ gom lại). Màn còn chạy thì vòng vừa nộp chưa có (server cắt, D480).
 * · Miễn phí, không đổi luật trận ⇒ không cần cổng `balance_version`.
 * · Đường giá là CHỈ SỐ 100 nhân dồn từ % từng vòng — để HIỂN THỊ, không phải tiền (C4 không chạm).
 * · Bốn luật màu bàn đấu: xanh/đỏ = tăng/giảm · lam = thứ bấm được · còn lại xám. Kỳ họp ⚖ vạch xám đứt.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { pctBp } from '@/api/holdem';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { htmlTinh } from '@/lib/html_tinh';
import sb from './BangDienTu.module.css';
import s from './BieuDoTaiSan.module.css';

export interface VongThiTruong {
  vong: number;
  /** `cao_bp`/`thap_bp` (râu, so với giá mở vòng) + `kl` (khối lượng tương đối) — D558; vắng ⇒ nến không râu, không cột. */
  thi_truong: readonly { ma: string; delta_bp: number; cao_bp?: number; thap_bp?: number; kl?: number }[];
}

export interface NenVong { vong: number; bp: number; chiSo: number; cao: number; thap: number; kl: number | null }

export interface MaBieuDo {
  id: string;
  ten: string;
  svg?: string | undefined;
  /** Đang cầm mã này — viền nhấn nhẹ trong danh sách. */
  dangCam?: boolean;
}

/** Chuỗi chỉ số (bắt đầu 100) + % từng vòng của một mã. Vòng thiếu mã ⇒ 0 bp (đứng giá). */
export function chuoiCuaMa(lichSu: readonly VongThiTruong[], ma: string): NenVong[] {
  let chiSo = 100;
  return lichSu.map((v) => {
    const x = v.thi_truong.find((t) => t.ma === ma);
    const bp = x?.delta_bp ?? 0, mo = chiSo;
    chiSo *= 1 + bp / 10000;
    return {
      vong: v.vong, bp, chiSo,
      cao: Math.max(mo, chiSo, mo * (1 + (x?.cao_bp ?? 0) / 10000)),
      thap: Math.min(mo, chiSo, mo * (1 + (x?.thap_bp ?? 0) / 10000)),
      kl: x?.kl ?? null,
    };
  });
}

/** % cộng dồn từ đầu trận (bp, làm tròn) — từ chỉ số cuối. */
const tongBp = (c: readonly { chiSo: number }[]): number =>
  c.length === 0 ? 0 : Math.round((c[c.length - 1]!.chiSo - 100) * 100);

const mauBp = (bp: number): string => (bp > 0 ? s.duong! : bp < 0 ? s.am! : s.mo!);

function DuongNho({ c }: { c: readonly { chiSo: number }[] }) {
  if (c.length === 0) return <svg className={s.nho} viewBox="0 0 60 18" aria-hidden />;
  const ds = [100, ...c.map((x) => x.chiSo)];
  const lo = Math.min(...ds), hi = Math.max(...ds), span = hi - lo || 1;
  const pts = ds.map((v, i) => `${(i / (ds.length - 1)) * 58 + 1},${17 - ((v - lo) / span) * 16}`).join(' ');
  const t = tongBp(c);
  return (
    <svg className={`${s.nho} ${mauBp(t)}`} viewBox="0 0 60 18" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" shapeRendering="crispEdges" />
    </svg>
  );
}

/**
 * Chart LỚN = NẾN, mỗi vòng một cây (founder 07/10: *"bấm vào phóng to phải ra hình nến … Ở ngoài thì nhỏ thì là line"*).
 * Mở = giá đóng vòng trước, đóng = sau % của vòng. Râu + khối lượng (founder 08/10) do server dựng bằng bộ sinh màn — xem
 * `nenThiTruong` (server/holdem_api.ts). Khối lượng: cột XÁM ở đáy, cột trên trung bình sáng hơn một bậc (luật màu bàn đấu).
 */
function NenLon({ c, oLich }: { c: readonly NenVong[]; oLich: readonly number[] }) {
  const W = 320, H = 170, L = 34, R = 8, T = 12, B = 22, KL = 26;
  const ds = [100, ...c.map((x) => x.chiSo)];
  const lo = Math.min(...ds, ...c.map((x) => x.thap)), hi = Math.max(...ds, ...c.map((x) => x.cao));
  const klMax = Math.max(0, ...c.map((x) => x.kl ?? 0));
  const klTb = c.filter((x) => x.kl !== null).reduce((a, x) => a + x.kl!, 0) / Math.max(1, c.filter((x) => x.kl !== null).length);
  const dem = Math.max(1, (hi - lo) * 0.1);
  const y0 = lo - dem, y1 = hi + dem;
  const n = Math.max(1, c.length);
  const buoc = (W - L - R) / n;
  const rong = Math.max(3, Math.min(18, Math.floor(buoc * 0.6)));
  const xg = (i: number) => L + buoc * (i + 0.5);
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B - KL);
  const dayKl = H - B;
  return (
    <svg className={s.lon} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Nến giá qua ${c.length} vòng, ${pctBp(tongBp(c))} từ đầu trận`}>
      {/* mốc 100 = giá đầu trận */}
      <line x1={L} x2={W - R} y1={y(100)} y2={y(100)} className={s.moc} strokeDasharray="2 3" />
      <text x={L - 4} y={y(100) + 3} className={s.nhanTruc} textAnchor="end">100</text>
      {hi > 100 && <text x={L - 4} y={y(hi) + 3} className={s.nhanTruc} textAnchor="end">{Math.round(hi)}</text>}
      {lo < 100 && <text x={L - 4} y={y(lo) + 3} className={s.nhanTruc} textAnchor="end">{Math.round(lo)}</text>}
      {c.map((v, i) => {
        const mo = ds[i]!, dong = ds[i + 1]!;
        const top = y(Math.max(mo, dong)), cao = Math.max(1, Math.abs(y(mo) - y(dong)));
        return (
          <g key={v.vong}>
            {oLich.includes(v.vong) && (
              <>
                <line x1={xg(i)} x2={xg(i)} y1={T} y2={dayKl} className={s.moc} strokeDasharray="1 3" />
                <text x={xg(i)} y={T - 2} className={s.nhanTruc} textAnchor="middle">⚖</text>
              </>
            )}
            {v.kl !== null && klMax > 0 && (
              <rect x={Math.round(xg(i) - rong / 2)} y={dayKl - (v.kl / klMax) * (KL - 4)} width={rong} height={(v.kl / klMax) * (KL - 4)}
                className={v.kl > klTb ? s.klCao : s.kl} />
            )}
            <line x1={Math.round(xg(i)) + 0.5} x2={Math.round(xg(i)) + 0.5} y1={y(v.cao)} y2={y(v.thap)} className={`${s.rau} ${mauBp(v.bp)}`} />
            <rect x={Math.round(xg(i) - rong / 2)} y={top} width={rong} height={cao} className={`${s.than} ${mauBp(v.bp)}`} />
            <text x={xg(i)} y={H - 6} className={s.nhanTruc} textAnchor="middle">{v.vong}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function BieuDoTaiSan({
  lichSu, ma, oLich = [],
}: {
  lichSu: readonly VongThiTruong[];
  ma: readonly MaBieuDo[];
  /** Vòng có kỳ họp lãi suất (`o_lich`) — vạch ⚖ trên chart. */
  oLich?: readonly number[];
}) {
  const [mo, setMo] = useState(false);
  const [chon, setChon] = useState<string | null>(null);
  const chuoi = useMemo(() => new Map(ma.map((m) => [m.id, chuoiCuaMa(lichSu, m.id)])), [lichSu, ma]);
  const maChon = chon ?? ma.find((m) => m.dangCam)?.id ?? ma[0]?.id ?? null;
  const c = maChon ? chuoi.get(maChon) ?? [] : [];

  useEffect(() => {
    if (!mo) return undefined;
    const nghe = (e: KeyboardEvent) => { if (e.key === 'Escape') setMo(false); };
    window.addEventListener('keydown', nghe);
    return () => window.removeEventListener('keydown', nghe);
  }, [mo]);

  return (
    <>
      <button
        type="button"
        className={`${sb.nutMo} ${sb.nutMoGon}`}
        onClick={() => setMo(true)}
        aria-label="Mở Bảng điện tử — chart giá các mã qua từng vòng, miễn phí"
      >
        <PixelIcon name="chart" size={16} />
        <span className={sb.nutChu}>BẢNG</span>
        <span className={`${sb.gia} ${sb.giaMienPhi}`}>MIỄN PHÍ</span>
      </button>
      {mo && createPortal(
        <div className={sb.lop} role="dialog" aria-label="Bảng điện tử" onClick={(e) => { if (e.target === e.currentTarget) setMo(false); }}>
          <div className={sb.tam}>
            <div className={sb.dau}>
              <span className={sb.ten}>BẢNG ĐIỆN TỬ <span className={sb.tenVong}>· TỚI VÒNG {lichSu[lichSu.length - 1]?.vong ?? 0}</span></span>
              <button type="button" className={sb.dong} onClick={() => setMo(false)} aria-label="Đóng">✕</button>
            </div>
            <div className={sb.than}>
              {lichSu.length === 0 ? (
                <p className={s.rong}>Chưa có vòng nào chốt. Giá từng mã hiện ở đây sau vòng đầu tiên.</p>
              ) : (
                <>
                  <div className={s.khungLon}>
                    <div className={s.dauLon}>
                      <span className={s.tenLon}>{ma.find((m) => m.id === maChon)?.ten ?? ''}</span>
                      <span className={`${s.tongLon} ${mauBp(tongBp(c))}`}>{pctBp(tongBp(c))}</span>
                      <span className={s.phu}>từ đầu trận</span>
                    </div>
                    <NenLon c={c} oLich={oLich} />
                    <div className={s.hangVong}>
                      {c.map((v) => (
                        <span key={v.vong} className={s.chipVong}>
                          <i>V{v.vong}</i> <b className={mauBp(v.bp)}>{pctBp(v.bp)}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                  <ul className={s.ds}>
                    {ma.map((m) => {
                      const cm = chuoi.get(m.id) ?? [];
                      const t = tongBp(cm);
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            className={`${s.hang} ${m.id === maChon ? s.hangChon : ''} ${m.dangCam ? s.hangCam : ''}`}
                            aria-pressed={m.id === maChon}
                            onClick={() => setChon(m.id)}
                          >
                            <span className={s.hinh} dangerouslySetInnerHTML={htmlTinh(m.svg ?? '')} />
                            <span className={s.tenMa}>{m.ten}{m.dangCam ? <em> · đang cầm</em> : null}</span>
                            <DuongNho c={cm} />
                            <span className={`${s.tong} ${mauBp(t)}`}>{pctBp(t)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
