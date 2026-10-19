/**
 * HỘP VỠ PIXEL — nghi lễ mở hộp (founder tả 04/08, D68 §2).
 *
 * Kịch bản đúng thứ tự founder đặt:
 *   đen xì → vòng sáng xoay → rung → VỠ TỪNG MẢNH lộ màu vật phẩm →
 *   phóng to nhẹ → khựng một phát.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TRẦN HIỆU NĂNG — ĐÂY LÀ RÀNG BUỘC, KHÔNG PHẢI GỢI Ý (D68 §2)
 *
 * Mỗi mảnh là MỘT THẺ DOM. Bản "cho đẹp" hay chọn lưới dày (300+ mảnh) và đó
 * đúng là công thức làm máy tầm trung khựng ĐÚNG LÚC muốn gây ấn tượng nhất —
 * 300 lớp hợp thành, mỗi khung hình một lần. Ba luật cứng:
 *
 *   1. **≤ SO_MANH_TRAN mảnh.** Lưới 8×6 = 48, không nới.
 *   2. **CHỈ animate `transform` và `opacity`.** Mọi thuộc tính khác bắt trình
 *      duyệt tính lại bố cục mỗi khung hình (D68 nêu thẳng luật này).
 *   3. **`will-change` BẬT LÚC DIỄN, TẮT NGAY SAU.** Để nguyên là giữ một lớp
 *      hợp thành cho 48 phần tử suốt phiên — tốn bộ nhớ GPU không vì gì cả.
 *
 * ⚠ TẤT ĐỊNH THEO HẠT SERVER: hướng bay của từng mảnh suy từ `hat` mà server
 * trả về, không phải `Math.random()`. Cùng một lượt quay xem lại là cùng một
 * hình ảnh — hợp với chỗ khác trong repo (mọi thứ tái lập được từ hạt), và nó
 * khiến ảnh chụp màn hình của người chơi kiểm lại được.
 */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks';
import s from './HopVo.module.css';

/** Lưới mảnh vỡ. 8×6 = 48 — trần cứng, xem khối đầu file. */
const COT = 8;
const HANG = 6;
export const SO_MANH_TRAN = 48;

/** Mốc thời gian (ms). Tổng ≈ 1,9s — đủ cho một nhịp, chưa tới mức phải chờ. */
const NHIP = {
  xoay: 620,
  rung: 260,
  vo: 620,
  lo: 400,
} as const;

export type PhaHop = 'kin' | 'rung' | 'vo' | 'lo' | 'xong';

/**
 * Sinh số giả ngẫu nhiên TẤT ĐỊNH từ hạt — cùng hạt, cùng hình.
 * (Không dùng `makeRng` của server: đây thuần trình diễn, không được để màn
 * phụ thuộc vào một module server chỉ vì tiện.)
 */
function bam(hat: number, i: number): number {
  const x = Math.sin(hat * 9301 + i * 49297) * 233280;
  return x - Math.floor(x);
}

interface Props {
  /** Hạt server trả về — quyết định hướng bay từng mảnh. */
  hat: number;
  /** Bậc món, để chọn tông màu mảnh vỡ. */
  bac: string;
  /** Nội dung lộ ra sau khi vỡ (ảnh món). */
  children: React.ReactNode;
  /** Gọi khi nghi lễ xong — màn cha mở phần chữ. */
  onXong?: () => void;
}

export function HopVo({ hat, bac, children, onXong }: Props) {
  const reduced = useReducedMotion();
  const [pha, setPha] = useState<PhaHop>(reduced ? 'xong' : 'kin');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    /*
     * reduced-motion: BỎ CHUYỂN ĐỘNG, KHÔNG bỏ kết quả. Người chơi vẫn thấy món
     * mình vừa nhận — thứ bị tắt là cú rung và 48 mảnh bay, tức đúng phần gây
     * chóng mặt, không phải phần mang thông tin.
     */
    if (reduced) {
      setPha('xong');
      onXong?.();
      return;
    }
    const at = (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, ms));
    };
    at(NHIP.xoay, () => setPha('rung'));
    at(NHIP.xoay + NHIP.rung, () => setPha('vo'));
    at(NHIP.xoay + NHIP.rung + NHIP.vo, () => setPha('lo'));
    at(NHIP.xoay + NHIP.rung + NHIP.vo + NHIP.lo, () => {
      setPha('xong');
      onXong?.();
    });
    const t = timers.current;
    return () => { t.forEach(clearTimeout); timers.current = []; };
  }, [hat, reduced, onXong]);

  /*
   * Mảnh CHỈ tồn tại trong pha `vo`. Dựng sẵn từ đầu nghĩa là 48 thẻ DOM nằm
   * chờ suốt nghi lễ; gỡ ngay sau khi vỡ xong nghĩa là chúng sống đúng 620ms.
   */
  const dangVo = pha === 'vo';
  const manh = dangVo
    ? Array.from({ length: SO_MANH_TRAN }, (_, i) => {
      const c = i % COT;
      const h = Math.floor(i / COT);
      // Hướng bay: toả từ tâm, lệch theo hạt để không thành hình ngôi sao đều.
      const dx = (c - (COT - 1) / 2) * 14 + (bam(hat, i) - 0.5) * 26;
      const dy = (h - (HANG - 1) / 2) * 14 + (bam(hat, i + 99) - 0.5) * 26;
      const xoay = (bam(hat, i + 7) - 0.5) * 180;
      return (
        <span
          key={i}
          className={s.manh}
          style={{
            left: `${(c / COT) * 100}%`,
            top: `${(h / HANG) * 100}%`,
            width: `${100 / COT}%`,
            height: `${100 / HANG}%`,
            // Chỉ transform + opacity chạy; ba biến này chỉ là ĐẦU VÀO của transform.
            ['--dx' as string]: `${dx.toFixed(1)}px`,
            ['--dy' as string]: `${dy.toFixed(1)}px`,
            ['--xoay' as string]: `${xoay.toFixed(0)}deg`,
            animationDelay: `${(bam(hat, i + 31) * 90).toFixed(0)}ms`,
          }}
        />
      );
    })
    : null;

  return (
    <div
      className={[
        s.san,
        s[`bac_${bac}`] ?? '',
        pha === 'rung' ? s.rung : '',
        // will-change CHỈ bật ở hai pha có chuyển động thật, tắt ở mọi pha khác.
        pha === 'rung' || pha === 'vo' ? s.sanTang : '',
      ].filter(Boolean).join(' ')}
      data-pha={pha}
    >
      {pha === 'kin' && <span className={s.vong} aria-hidden="true" />}
      {(pha === 'kin' || pha === 'rung') && <span className={s.hop} aria-hidden="true" />}
      {dangVo && <span className={s.lopManh} aria-hidden="true">{manh}</span>}
      <span className={pha === 'lo' ? `${s.mon} ${s.monHien}` : s.mon}>
        {(pha === 'lo' || pha === 'xong') && children}
      </span>
    </div>
  );
}
