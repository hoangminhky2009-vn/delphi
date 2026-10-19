/**
 * CHỐT LỜI TRONG Ô — Lướt Sóng mới (v55, D409, cổng `luotSongMoi`). Mỗi mã đang giữ: một hàng chip MỤC TIÊU (bp giá
 * của mã trong ô) + một hàng chip PHẦN BÁN. Đặt xong thì gửi cùng cú CHỐT VÒNG; server kiểm và khớp ở đỉnh sóng (C4).
 * Ngưỡng/bước/phần đọc từ `chot_loi_cho_phep` server gửi — không gõ tay (A11.5). Chữ MÔ TẢ, không kê đơn (A10).
 */
import { NHIP_RUNG, rung } from '@/lib/rung';
import px from '@/styles/pixel.module.css';
import s from './ChotLoi.module.css';

export interface LenhChotLoi { ma: string; nguong_bp: number; phan_bp: number }
export interface ChotLoiChoPhep {
  nguong_min_bp: number; nguong_max_bp: number; buoc_bp: number; phan_ban: readonly number[]; toi_da: number;
}

/** Bộ mốc mục tiêu gợi ý: thưa ở đầu, dày ở giữa — luôn là bội của bước và nằm trong [min, max]. */
export function mocMucTieu(cp: ChotLoiChoPhep): number[] {
  const goc = [300, 500, 800, 1200, 2000, 3000];
  const ds = goc
    .map((m) => Math.round(m / cp.buoc_bp) * cp.buoc_bp)
    .filter((m) => m >= cp.nguong_min_bp && m <= cp.nguong_max_bp);
  if (ds.length === 0) ds.push(cp.nguong_min_bp);
  return Array.from(new Set(ds)).sort((a, b) => a - b);
}

export function ChotLoi({ maDangGiu, tenMa, choPhep, lenh, onDoi, vohieu = false }: {
  maDangGiu: readonly string[];
  tenMa: (ma: string) => string;
  choPhep: ChotLoiChoPhep;
  lenh: readonly LenhChotLoi[];
  /** null = bỏ lệnh của mã ấy. */
  onDoi: (ma: string, l: Omit<LenhChotLoi, 'ma'> | null) => void;
  vohieu?: boolean;
}) {
  if (maDangGiu.length === 0) return null;
  const mocs = mocMucTieu(choPhep);
  const daDay = lenh.length >= choPhep.toi_da;
  return (
    <section className={s.khoi} data-tap="chot-loi" data-so-lenh={lenh.length}>
      <header className={s.dau}>
        <span className={s.tieuDe}>CHỐT LỜI TRONG Ô</span>
        <span className={s.dem}>{lenh.length}/{choPhep.toi_da}</span>
      </header>
      <p className={s.goiY}>
        Giá trong ô có đỉnh sóng cao hơn giá đóng ô. Đặt mục tiêu cho một phần vị thế: đỉnh chạm mục tiêu thì phần ấy
        khớp ở mục tiêu thay vì giá đóng ô — kể cả khi ô chạy quá mục tiêu.
      </p>
      {maDangGiu.map((ma) => {
        const l = lenh.find((x) => x.ma === ma);
        const khoaMoi = !l && daDay;
        return (
          <div key={ma} className={`${s.hangMa} ${l ? s.coLenh : ''}`} data-ma={ma} data-co-lenh={l ? '1' : '0'}>
            <span className={s.tenMa}>{tenMa(ma).toUpperCase()}</span>
            <div className={s.chips} data-hang="nguong">
              {mocs.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`${px.nut} ${s.chip} ${l?.nguong_bp === m ? s.chipCam : ''}`}
                  data-nguong={m}
                  aria-pressed={l?.nguong_bp === m}
                  disabled={vohieu || khoaMoi}
                  onClick={() => {
                    rung(NHIP_RUNG.cham);
                    onDoi(ma, { nguong_bp: m, phan_bp: l?.phan_bp ?? choPhep.phan_ban[1] ?? choPhep.phan_ban[0] ?? 10000 });
                  }}
                >
                  +{m / 100}%
                </button>
              ))}
            </div>
            {l && (
              <div className={s.chips} data-hang="phan">
                {choPhep.phan_ban.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`${px.nut} ${s.chip} ${s.chipPhan} ${l.phan_bp === p ? s.chipCam : ''}`}
                    data-phan={p}
                    aria-pressed={l.phan_bp === p}
                    disabled={vohieu}
                    onClick={() => { rung(NHIP_RUNG.cham); onDoi(ma, { nguong_bp: l.nguong_bp, phan_bp: p }); }}
                  >
                    {p === 10000 ? 'HẾT' : `${p / 100}%`}
                  </button>
                ))}
                <button
                  type="button"
                  className={`${px.nutCanh} ${s.bo}`}
                  data-tap="bo-chot-loi"
                  disabled={vohieu}
                  onClick={() => { rung(NHIP_RUNG.cham); onDoi(ma, null); }}
                >
                  BỎ
                </button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
