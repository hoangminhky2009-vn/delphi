/**
 * THẺ TẦNG KHÔNG GIAN — MẶT BENTO của tab THẺ (SPEC `pfm-tang-khong-gian` mục 4.3; demo CHỐT `the()`): CHÂN DUNG hành tinh (lớn) · CĂN CỨ · APP ĐOÁN ĐÚNG ·
 * ĐỘ NHẤT QUÁN · nút VIỆC ĐẦU TIÊN. THUẦN TRÌNH BÀY: số do `RuotChanDung` (ChanDungPfm.tsx) tính từ các hàm đã có — không công thức mới.
 *
 * ─── LUẬT ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 * · HÀNH TINH MỖI LẦN DỰNG THẺ (founder 11/10: "sao Thổ hiện mỗi lần mở THẺ"): cầu RƠI xuống · vành QUÉT vào · tên BẬT lên · ô của bạn trên bản đồ BẬT ·
 *   rồi phụt HẠT SAO. Đổi tab = dựng lại màn = chạy lại. Hạt dọn bằng hẹn giờ của `phutHat` (không `onfinish`); giảm chuyển động ⇒ không hạt, không nháy.
 * · ĐỘ NHẤT QUÁN KHÔNG nói tên nguồn (founder 11/10): chỉ tên điều được đo + thanh; thiếu mẫu ⇒ "chưa đủ để nói" (D62), KHÔNG thanh 0.
 *   Tấm CĂN CỨ là chỗ DUY NHẤT kể căn cứ (lớp của ô CĂN CỨ).
 * · P6: chân dung dựng từ LỜI KHAI — chip nói thẳng; A10: chỉ mô tả, không "hành tinh nào hơn".
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { OBento, NutChinh } from '@/components/ui/OBento';
import { DomBao } from '@/components/DomBao';
import { phutHat, tamPhanTu } from '@/lib/hat_pixel';
import { NHIP } from '@/lib/nhip';
import { CHU_BENTO as CB, CHU_TRUC_HANH as TR } from '@/lib/pfm_chu';
import b from '@/components/pfm/PfmBento.module.css';
import tb from './TheBento.module.css';

const sole = (i: number): CSSProperties => ({ '--i': i } as CSSProperties);

export type TamThe = 'hanh-tinh' | 'can-cu' | 'doan-dung' | 'nhat-quan';

export interface MatTheProps {
  dangTai: boolean;
  hanh: { ten: string; hang: 0 | 1 | 2; cot: 0 | 1 | 2; vanh: 0 | 1 | 2; mau: string; phu: string } | null;
  /** Chưa vẽ được hành tinh: câu nói còn THIẾU câu nào (không lấp bằng vùng giữa — P7). */
  thieu: string | null;
  canCu: { so: number; ngaySo: number };
  doanDung: { trung: number; trat: number };
  nhatQuan: { ma: string; ten: string; pct: number | null }[];
  domViec: boolean;
  onMo: (t: TamThe) => void;
  onViec: () => void;
}

export function MatThe(p: MatTheProps): React.ReactElement {
  const hanhRef = useRef<HTMLSpanElement | null>(null);
  /* SAO THỔ — hạt sao phụt SAU khi cầu rơi + vành quét + tên bật (mốc `PFM_SAO_HAT_TRE`); huỷ hẹn khi rời màn giữa chừng. */
  const coHanh = p.hanh !== null;
  useEffect(() => {
    if (!coHanh) return undefined;
    const t = setTimeout(() => { phutHat(tamPhanTu(hanhRef.current), 'var(--v-3)', 10); }, NHIP.PFM_SAO_HAT_TRE);
    return () => clearTimeout(t);
  }, [coHanh]);
  const daCham = p.doanDung.trung + p.doanDung.trat;
  return (
    <div className={b.trang} data-testid="the-bento">
      <OBento
        dau="the-hanh-tinh" className={`${b.vao} ${tb.oHanh}`} style={sole(0)}
        nhan={p.hanh === null ? CB.theChuaVe : `${CB.theChanDung}: ${p.hanh.ten}`} onChon={() => p.onMo('hanh-tinh')}
      >
        <span className={`${b.nhan} ${tb.nhanGiua}`}><span className={b.ten}>{CB.theChanDung}</span></span>
        {p.hanh === null ? (
          <span className={tb.chuaVe}>
            <span className={tb.tenHanh}>{p.dangTai ? CB.dangTai : CB.theChuaVe}</span>
            {p.thieu !== null && <span className={b.duoi}>{`${CB.theThieuPre}${p.thieu}`}</span>}
          </span>
        ) : (
          <>
            <span ref={hanhRef} className={tb.hanhTinh} aria-hidden="true">
              <span className={tb.cau} style={{ '--mau': p.hanh.mau } as CSSProperties} />
              <i className={`${tb.vanh} ${p.hanh.vanh === 2 ? tb.vanhDay : p.hanh.vanh === 0 ? tb.vanhKhong : ''}`} />
            </span>
            <span className={tb.tenHanh} data-testid="the-ten-hanh">{p.hanh.ten}</span>
            <span className={`${b.duoi} ${b.mot}`} style={{ width: '100%', textAlign: 'center' }}>{p.hanh.phu}</span>
            <span className={tb.chip}>{CB.theChipNguon}</span>
            <span className={tb.banDo} aria-label={CB.theBanDoAria}>
              <span className={tb.truc} style={{ gridColumn: 1, gridRow: 1 }}>{TR.bTrai.toLowerCase()}</span>
              <span className={tb.truc} style={{ gridColumn: 1, gridRow: 3, alignSelf: 'end' }}>{TR.bPhai.toLowerCase()}</span>
              {Array.from({ length: 9 }, (_, k) => (
                <i
                  key={k}
                  className={`${p.hanh!.hang * 3 + p.hanh!.cot === k ? tb.day : ''}`}
                  style={{ gridColumn: 2 + (k % 3), gridRow: 1 + Math.floor(k / 3) }}
                />
              ))}
              <span className={`${tb.truc} ${tb.trucDay}`} style={{ gridColumn: '2 / 5', gridRow: 4 }}>
                <span>{TR.dauTrai.toLowerCase()}</span><span>{TR.dauPhai.toLowerCase()}</span>
              </span>
            </span>
          </>
        )}
      </OBento>

      <div className={tb.hangSo}>
        <OBento
          dau="the-can-cu" className={`${b.vao} ${tb.oSo}`} style={sole(1)} nhan={CB.theCanCu} onChon={() => p.onMo('can-cu')}
        >
          <span className={b.nhan}><span className={b.ten}>{CB.theCanCu}</span><span className={b.mui} aria-hidden="true">›</span></span>
          <span className={`${b.soTo} ${b.soVua}`} data-testid="the-can-cu">{p.dangTai ? '—' : <>{p.canCu.so}<small>{CB.theQuyetDinh}</small></>}</span>
          <span className={`${b.duoi} ${b.mot}`}>{p.dangTai ? ' ' : `+ ${p.canCu.ngaySo}${CB.theNgaySo}`}</span>
        </OBento>
        <OBento
          dau="the-doan-dung" className={`${b.vao} ${tb.oSo}`} style={sole(2)} nhan={CB.theDoanDung} onChon={() => p.onMo('doan-dung')}
        >
          <span className={b.nhan}><span className={b.ten}>{CB.theDoanDung}</span><span className={b.mui} aria-hidden="true">›</span></span>
          <span className={`${b.soTo} ${b.soVua}`} data-testid="the-doan-dung">
            {daCham > 0 ? <>{p.doanDung.trung}<small>{`/ ${daCham}`}</small></> : '—'}
          </span>
          <span className={`${b.duoi} ${b.mot}`}>{daCham > 0 ? CB.theDoanTuan : CB.theChuaCham}</span>
        </OBento>
      </div>

      <OBento
        dau="the-nhat-quan" className={`${b.vao} ${tb.oNhatQuan}`} style={sole(3)} nhan={CB.theNhatQuan} onChon={() => p.onMo('nhat-quan')}
      >
        <span className={b.nhan}><span className={b.ten}>{CB.theNhatQuan}</span><span className={b.mui} aria-hidden="true">›</span></span>
        {p.nhatQuan.map((x, k) => (
          <span key={x.ma} className={tb.hangNhat} data-testid={`nhat-quan-${x.ma}`}>
            <span className={b.mot}>{x.ten}</span>
            {x.pct === null
              ? <span className={`${b.duoi} ${b.mot}`}>{p.dangTai ? CB.dangTai : CB.chuaDuDeNoi}</span>
              : (
                <span className={b.thanh} role="img" aria-label={`${x.ten}: ${x.pct}%`}>
                  <i className={`${b.mocNgang} ${b.tim}`} style={{ width: `${x.pct}%`, '--j': k } as CSSProperties} />
                </span>
              )}
          </span>
        ))}
      </OBento>

      <div className={tb.nutViec}>
        <NutChinh dau="the-viec-dau" onChon={p.onViec}>
          {CB.theViecDau}
          <DomBao hien={p.domViec} />
        </NutChinh>
      </div>
    </div>
  );
}
