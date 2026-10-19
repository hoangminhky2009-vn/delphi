/**
 * Ô TÀI CHÍNH LÚC KHOÁ — BẢN XEM TRƯỚC XOAY VÒNG (founder 11/10: "tạm để PFM khoá, giữ nguyên chức năng, nhưng hiện lần lượt các hành
 * tinh tính cách tài chính và những màn tính năng của PFM như một bản Preview").
 *
 * Chỉ là MẶT Ô: không mở kho, không gọi mạng, không dữ liệu của ai — hành tinh mẫu lấy từ bảng 9 hành tinh của chân dung PFM
 * (`HANH_TINH_MAU` · `CHU_HANH_TINH`, một nguồn với màn chân dung), tính năng là SỔ · HŨ · GƯƠNG đang có trong mã (khoá trên web).
 * Cùng nhịp banner Đấu trường (`NHIP.HUB_BANNER` 10 s, mờ chuyển `HUB_BANNER_MO`); dừng khi lớp trượt mở hoặc tab ẩn; giảm chuyển động
 * ⇒ không đổi cảnh. A10: tả chỗ đứng, không hành tinh nào "tốt" hơn.
 */
import { useEffect, useState } from 'react';
import { NHIP } from '@/lib/nhip';
import { CHU_COT_HANH, CHU_HANG_HANH, CHU_HANH_TINH } from '@/lib/pfm_chu';
import { HANH_TINH_MAU } from '@/lib/hanh_tinh_mau';
import { CHU_HUB } from '@/lib/hub_chu';
import { PixelIcon, type PixelIconName } from '@/components/ui/PixelIcon';
import s from './HubPfmXemTruoc.module.css';

type Canh =
  | { k: 'hanh'; ma: keyof typeof CHU_HANH_TINH }
  | { k: 'tinh_nang'; icon: PixelIconName; ten: string; mo: string };

/** Ba hành tinh có đặc điểm RÕ (tránh ô 'ở giữa · ở giữa'), xen kẽ hành tinh ↔ tính năng: người xem thấy cả "mình là ai" lẫn "app làm được gì" trong một vòng 60 s. */
export const CANH_PFM: readonly Canh[] = [
  { k: 'hanh', ma: '00' },
  { k: 'tinh_nang', icon: 'sach', ten: CHU_HUB.xemTruocSo, mo: CHU_HUB.xemTruocSoMo },
  { k: 'hanh', ma: '22' },
  { k: 'tinh_nang', icon: 'coin', ten: CHU_HUB.xemTruocHu, mo: CHU_HUB.xemTruocHuMo },
  { k: 'hanh', ma: '02' },
  { k: 'tinh_nang', icon: 'analyze', ten: CHU_HUB.xemTruocGuong, mo: CHU_HUB.xemTruocGuongMo },
];

function giamChuyenDong(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function HubPfmXemTruoc({ tamMo }: { tamMo: boolean }): React.ReactElement {
  const [i, datI] = useState(0);
  useEffect(() => {
    if (tamMo || giamChuyenDong()) return undefined;
    let t: ReturnType<typeof setInterval> | null = null;
    const chay = (): void => { if (t === null) t = setInterval(() => datI((x) => (x + 1) % CANH_PFM.length), NHIP.HUB_BANNER); };
    const dung = (): void => { if (t !== null) clearInterval(t); t = null; };
    const doiHien = (): void => { if (document.visibilityState === 'hidden') dung(); else chay(); };
    if (document.visibilityState !== 'hidden') chay();
    document.addEventListener('visibilitychange', doiHien);
    return () => { dung(); document.removeEventListener('visibilitychange', doiHien); };
  }, [tamMo]);

  return (
    <span className={s.khung} data-xem-truoc-pfm={i}>
      <span className={s.tag}>{CHU_HUB.xemTruoc}</span>
      {CANH_PFM.map((c, j) => (
        <span key={j} className={`${s.canh} ${j === i ? s.hien : ''}`} aria-hidden={j !== i}>
          {c.k === 'hanh' ? (
            <>
              <span className={s.cau}>
                <span
                  className={s.qcau}
                  style={{ background: `radial-gradient(circle at 34% 30%, ${HANH_TINH_MAU[c.ma]} 0%, ${HANH_TINH_MAU[c.ma]} 42%, #1a1207 92%)` }}
                />
              </span>
              <span className={s.ten}>{CHU_HANH_TINH[c.ma]}</span>
              <span className={s.mo}>
                {CHU_HANG_HANH[c.ma[0] as '0' | '1' | '2']} · {CHU_COT_HANH[c.ma[1] as '0' | '1' | '2']}
              </span>
            </>
          ) : (
            <>
              <PixelIcon name={c.icon} size={48} />
              <span className={s.ten}>{c.ten}</span>
              <span className={s.mo}>{c.mo}</span>
            </>
          )}
        </span>
      ))}
    </span>
  );
}
