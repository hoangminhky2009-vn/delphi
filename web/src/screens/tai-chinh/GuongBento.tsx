/**
 * GƯƠNG TẦNG KHÔNG GIAN — MẶT BENTO của tab GƯƠNG (SPEC `pfm-tang-khong-gian` mục 4.3; demo CHỐT `guong()`): HƯỚNG · tầng PHÂN TÍCH NÂNG CAO
 * (ĐOÁN ↔ THẬT · KẾT TOÁN) · TIỀN VÀO ĐI ĐÂU · CHI TỪNG NGÀY · sáu ô nhỏ · CHỐT SỔ TUẦN. THUẦN TRÌNH BÀY: số do `RuotGuong` (Guong.tsx) tính.
 *
 * ─── LUẬT ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 * · KHÔNG NHÃN NGUỒN trên tầng PHÂN TÍCH (founder 11/10): chỉ "bạn nghĩ → thực tế" — không NÓI / LÀM / TRẬN / "bạn khai" / "sổ ghi". Tấm CĂN CỨ
 *   ở THẺ là chỗ DUY NHẤT kể căn cứ. Bài `pfm_bento_guong.test.tsx` quét chữ ở mặt GƯƠNG và trong từng lớp.
 * · A10: tả + đặt cạnh nhau, không "nên/cần", không chấm khớp/lệch (xem `capDoiChieu`). Thiếu mẫu ⇒ "chưa đủ để nói", KHÔNG 0 (D62).
 * · Nhịp: ô vào so le (`ndVaoLen`) · cột mọc (`bdMocDoc`) · vòng QUÉT (`--quet`, ngoại lệ đã duyệt: không phải transform/opacity).
 */
import type { CSSProperties } from 'react';
import { OBento, NutChinh } from '@/components/ui/OBento';
import { PixelIcon, type PixelIconName } from '@/components/ui/PixelIcon';
import { tienGon } from '@/lib/hub_tai_chinh';
import { PFM } from '@config/pfm';
import { CHU_BENTO as CB, CHU_BIEU_DO as B, CHU_VI_THE as CV } from '@/lib/pfm_chu';
import type { KhucVong, MaKhucVong } from '@/pfm/bieu_do';
import type { MaChac } from '@/pfm/vi_the';
import type { CapDoi, MaCapDoi, ThucTe } from './BaMat';
import b from '@/components/pfm/PfmBento.module.css';
import gb from './GuongBento.module.css';

const gon = (n: number): string => { const g = tienGon(n); return g.don === 'đ' ? `${g.so}đ` : `${g.so}${g.don}`; };
const sole = (i: number): CSSProperties => ({ '--i': i } as CSSProperties);

/** Tên một cặp — dùng chung mặt GƯƠNG và lớp ĐOÁN ↔ THẬT. Chữ của bảng cũ (`CHU_BIEU_DO.cap*`), không có tên nguồn. */
export const TEN_CAP: Record<MaCapDoi, string> = {
  tien_ve: B.capTienVe, sau_tieu: B.capSauTieu, dau_thang: B.capDauThang, qua_tay: B.capQuaTay,
};

const lan = (x: number): string => `${B.lanPre}${x.toFixed(1).replace('.', ',')}`;

/** Điều người dùng nghĩ — một chuỗi ngắn (các chip nối bằng ·). */
export const chuNghi = (c: CapDoi): string => (c.nghi === null ? CB.chuaTraLoi : c.nghi.join(' · '));

/** Thực tế đo được — một chuỗi ngắn; thiếu mẫu ⇒ "chưa đủ để nói". */
export function chuThuc(t: ThucTe | null): string {
  if (t === null) return CB.chuaDuDeNoi;
  if (t.k === 'dem') return `${t.co}/${t.n}${CB.guLanHau}`;
  if (t.k === 'phan') return `${Math.round(t.ty * 100)}%`;
  const co = t.ds.filter((x) => x.tyLe !== null);
  return co.length === 0 ? CB.chuaDuDeNoi : co.map((x) => lan(x.tyLe!)).join(' · ');
}

export const MAU_KHUC: Record<MaKhucVong, string> = {
  de_danh: 'var(--c-2)', chi_hu: 'var(--c-3)', chi_chua_chia: 'var(--v-2b)', du: 'var(--n-4)',
};
export const TEN_KHUC: Record<MaKhucVong, string> = {
  de_danh: B.deDanh, chi_hu: CB.guChiDaChia, chi_chua_chia: B.chuaChia, du: B.du,
};

/** `conic-gradient` từ các khúc: mỗi khúc một đoạn liền nhau, tổng đúng 360°. */
export function nenVong(khuc: readonly KhucVong[]): string {
  let t = 0;
  const dung = khuc.map((k, i) => {
    const tu = t;
    t = i === khuc.length - 1 ? 100 : Math.min(100, t + k.phan * 100);
    return `${MAU_KHUC[k.ma]} ${tu.toFixed(2)}% ${t.toFixed(2)}%`;
  });
  return `conic-gradient(${dung.join(', ')})`;
}

export type TamGuong =
  | 'huong' | 'doan-that' | 'ket-toan' | 'bieu-do' | 'phan-tich' | 'thoi-quen' | 'luat' | 'sau-thang' | 'nhin-lai' | 'tien-toi' | 'chot';

export interface OGuongNho { id: TamGuong; icon: PixelIconName; ten: string; phu: string }

export interface MatGuongProps {
  dangTai: boolean;
  /** Công tắc "Tắt Gương": các chỉ số mô tả hành vi ngừng tính (D426). */
  guongTat: boolean;
  /** `dangTheo` = CÂU một dòng của hướng đang theo ("Ưu tiên … — làm đúng k/n lần"), `null` = chưa chọn. */
  huong: { canCu: number; dangTheo: string | null };
  doiChieu: { cap: CapDoi | null; nDu: number; tong: number };
  ketToan: { song: number; theo: { chac: MaChac; n: number; toi: number }[]; ds: readonly { id: string; ten: string; chac: MaChac }[] };
  vong: readonly KhucVong[] | null;
  thu: number;
  cotNgay: { chi: number; nay: boolean; chuaToi: boolean }[];
  cungNgay: { nay: number; truoc: number } | null;
  nho: readonly OGuongNho[];
  daChot: boolean;
  onMo: (t: TamGuong) => void;
  onChot: () => void;
}

const CHAC_CHU: Record<MaChac, string> = { cao: CB.huChacCao.toLowerCase(), vua: CB.huChacVua.toLowerCase(), thap: CB.huChacThap.toLowerCase() };

/** Vật đếm của một cặp: mỗi lần một ô (đặc = có) tới 12 ô, quá thì thanh tỉ lệ — nói đúng con số đứng cạnh (nếp `ODem` của bảng cũ). */
function VatDem({ t }: { t: ThucTe | null }): React.ReactElement | null {
  if (t === null) return null;
  if (t.k === 'dem') {
    if (t.n > 12) {
      return <span className={b.thanh} aria-hidden="true"><i className={b.mocNgang} style={{ width: `${Math.round((t.co / t.n) * 100)}%` }} /></span>;
    }
    return (
      <span className={gb.oDem} aria-hidden="true">
        {Array.from({ length: t.n }, (_, k) => <i key={k} className={k < t.co ? gb.toi : ''} />)}
      </span>
    );
  }
  if (t.k === 'phan') {
    return <span className={b.thanh} aria-hidden="true"><i className={b.mocNgang} style={{ width: `${Math.round(t.ty * 100)}%` }} /></span>;
  }
  return null;
}

export function MatGuong(p: MatGuongProps): React.ReactElement {
  const max = Math.max(...p.cotNgay.map((c) => c.chi), 1);
  let i = 0;
  const theoHien = p.ketToan.theo.filter((x) => x.n > 0).slice(0, 2);
  return (
    <div className={b.trang} data-testid="guong-bento">
      <OBento
        dau="guong-huong" className={`${b.vao} ${gb.oHuong}`} style={sole(i++)} nhan={CB.guHuongTen} onChon={() => p.onMo('huong')}
      >
        <span className={b.nhan}><span className={b.ten}>{CB.guHuongTen}</span><span className={b.mui} aria-hidden="true">›</span></span>
        <span className={`${b.duoi} ${b.mot}`}>
          {p.dangTai ? CB.dangTai : p.huong.dangTheo !== null ? p.huong.dangTheo
            : p.huong.canCu > 0 ? `${p.huong.canCu}${CB.guHuongCanCuHau}` : CB.guHuongChuaDu}
        </span>
      </OBento>

      <p className={gb.tieuTang} data-testid="guong-tieu-tang">{CB.guTieuTang}</p>

      <div className={gb.luoi}>
        <OBento
          dau="guong-doan-that" className={`${b.vao} ${gb.oHang} ${b.oVang}`} style={sole(i++)}
          nhan={CB.guDoanThat} onChon={() => p.onMo('doan-that')}
        >
          <span className={b.nhan}><span className={b.ten}>{CB.guDoanThat}</span><span className={b.mui} aria-hidden="true">›</span></span>
          {p.guongTat ? (
            <span className={`${b.duoi}`}>{CB.guDaTat}</span>
          ) : p.doiChieu.cap === null ? (
            <span className={`${b.duoi} ${b.mot}`}>{p.dangTai ? CB.dangTai : CB.chuaDuDeNoi}</span>
          ) : (
            <>
              <span className={`${b.duoi} ${b.mot}`}>{TEN_CAP[p.doiChieu.cap.ma].toLowerCase()}</span>
              <span className={gb.lech}>
                <span><em>{CB.guBanNghi}</em><b className={b.mot}>{chuNghi(p.doiChieu.cap)}</b></span>
                <span><em>{CB.guThucTe}</em><b className={`${b.mot} ${b.vang}`}>{chuThuc(p.doiChieu.cap.thuc)}</b></span>
              </span>
              <VatDem t={p.doiChieu.cap.thuc} />
              <span className={`${b.duoi} ${b.mot}`} style={{ marginTop: 'auto' }}>
                {`${p.doiChieu.nDu}/${p.doiChieu.tong}${CB.guCapDu}`}
              </span>
            </>
          )}
        </OBento>
        <OBento
          dau="guong-ket-toan" className={`${b.vao} ${gb.oHang}`} style={sole(i++)} nhan={CB.guKetToan} onChon={() => p.onMo('ket-toan')}
        >
          <span className={b.nhan}><span className={b.ten}>{CB.guKetToan}</span><span className={b.mui} aria-hidden="true">›</span></span>
          <span className={`${b.soTo} ${b.soVua} ${p.dangTai ? b.cho : ''}`} data-testid="guong-song">
            {p.dangTai ? '—' : <>{p.ketToan.song}<small>{CB.guDangMo}</small></>}
          </span>
          {p.ketToan.ds.map((x) => (
            <span key={x.id} className={`${b.duoi} ${b.mot}`} data-testid="guong-song-dong">
              {`${x.ten} · ${CV.chacPre}${PFM.VI_THE_CHAC[x.chac]}%`}
            </span>
          ))}
          {theoHien.length === 0 ? (
            <span className={`${b.duoi}`} style={{ marginTop: 'auto' }}>{p.dangTai ? ' ' : B.chuaXet}</span>
          ) : (
            theoHien.map((x, k) => (
              <span key={x.chac} className={`${b.duoi} ${b.mot}`} style={k === 0 ? { marginTop: 'auto' } : undefined}>
                {`${CB.guNoiPre}"${CHAC_CHU[x.chac]}" → ${CB.guDungPre}${x.toi}/${x.n}`}
              </span>
            ))
          )}
        </OBento>

        <OBento
          dau="guong-tien-vao" className={`${b.vao} ${gb.oHang}`} style={sole(i++)} nhan={B.diDauTieu} onChon={() => p.onMo('bieu-do')}
        >
          <span className={b.nhan}><span className={b.ten}>{B.diDauTieu}</span><span className={b.mui} aria-hidden="true">›</span></span>
          {p.vong === null ? (
            <span className={`${b.duoi}`} style={{ margin: 'auto 0' }}>{p.dangTai ? CB.dangTai : CB.chuaDuDeNoi}</span>
          ) : (
            <span className={gb.vong} aria-hidden="true">
              <span className={gb.quet} data-testid="guong-vong" style={{ background: nenVong(p.vong) }} />
            </span>
          )}
          <span className={`${b.duoi} ${b.mot}`} style={{ textAlign: 'center' }}>
            {p.thu > 0 ? `${gon(p.thu)}${CB.guVaoThangHau}` : p.vong === null ? ' ' : CB.guChuaCoThu}
          </span>
        </OBento>
        <OBento
          dau="guong-chi-ngay" className={`${b.vao} ${gb.oHang}`} style={sole(i++)} nhan={B.ngayTieu} onChon={() => p.onMo('bieu-do')}
        >
          <span className={b.nhan}><span className={b.ten}>{B.ngayTieu}</span><span className={b.mui} aria-hidden="true">›</span></span>
          <span className={gb.cotG} aria-hidden="true">
            {p.cotNgay.map((c, k) => (
              <i
                key={k}
                className={`${c.chuaToi ? gb.trong : b.mocDoc} ${c.nay ? gb.nay : ''}`}
                style={c.chuaToi ? undefined : { height: `${c.chi > 0 ? Math.max(5, Math.round((c.chi / max) * 100)) : 4}%`, '--j': k } as CSSProperties}
              />
            ))}
          </span>
          <span className={`${b.duoi} ${b.mot}`}>
            {p.cungNgay === null ? CB.chuaDuDeNoi
              : p.cungNgay.truoc > 0 ? `${gon(p.cungNgay.nay)} · ${CB.guThangTruoc} ${gon(p.cungNgay.truoc)}`
                : `${gon(p.cungNgay.nay)} · ${CB.guThangTruocChua}`}
          </span>
        </OBento>

        <div className={gb.hangNho}>
          {p.nho.map((o) => (
            <OBento
              key={o.id} dau={`guong-${o.id}`} className={`${b.vao} ${gb.oNho}`} style={sole(i++)}
              nhan={o.ten} onChon={() => p.onMo(o.id)}
            >
              <PixelIcon name={o.icon} size={16} />
              <b>{o.ten}</b>
              <span className={gb.phu}>{o.phu}</span>
            </OBento>
          ))}
        </div>
      </div>

      <NutChinh dau="guong-chot" className={gb.nutChot} onChon={() => p.onChot()}>
        {p.daChot ? CB.guDaChot : CB.guChot}
      </NutChinh>
    </div>
  );
}
