/**
 * PFM — BIỂU ĐỒ VỊ THẾ trên lá hũ tích lũy đang mở ở màn HŨ (D426) + `tienNgan` dùng chung với `BieuDo.tsx`.
 *
 * ⚠ TỆP RIÊNG CÓ CHỦ ĐÍCH (D426): hồi ấy `So.tsx` nhập `QuyetToanHop` từ `Hu.tsx` (D431 đã tách hộp ấy ra), nên mọi thứ `Hu.tsx` nhập cũng vào gói của màn SỔ. Để
 *   biểu đồ vị thế ở `BieuDo.tsx` thì SỔ — màn không vẽ biểu đồ nào — tải cả khối biểu đồ của GƯƠNG (~11 KB gzip); đo được
 *   ở bài `oracle_chat.test.tsx`: lần dựng SỔ đầu tiên chậm quá ngưỡng chờ 1 giây của nó (26/09).
 */
import { ngayViet, soNgayGiua } from '@/pfm/thoi_gian';
import type { DiemGop } from '@/pfm/bieu_do';
import type { LenhHu } from '@/pfm/vi_the';
import { CHU_BIEU_DO as B } from '@/lib/pfm_chu';
import s from './BieuDo.module.css';

const dong = (n: number): string => n.toLocaleString('vi-VN');

/** Tiền NGẮN cho chú giải chật: 1.341.000 → "1,34tr" · 550.000 → "550k" · 900 → "900". Con số đủ luôn nằm ở hàng số. */
export function tienNgan(n: number): string {
  const a = Math.abs(n);
  const dau = n < 0 ? '−' : '';
  if (a >= 1_000_000) return `${dau}${(Math.round(a / 10_000) / 100).toLocaleString('vi-VN')}${B.donTr}`;
  if (a >= 1_000) return `${dau}${Math.round(a / 1_000)}${B.donK}`;
  return `${dau}${a}`;
}

/* ═══ ĐƯỜNG GÓP CỦA MỘT VỊ THẾ — lá hũ tích lũy đang mở ở màn HŨ ═════════════════════════════════ */

/**
 * ⭐ "ko chỉ gương mà còn là theo hướng dữ liệu mới ta có" — một vị thế có kỳ hạn là một đường KẾ HOẠCH (0 lúc vào lệnh →
 * mức lúc tới hạn, đứt vàng) và một đường THỰC GÓP bậc thang (xanh), vạch hôm nay ở giữa. Nhịp "đúng · chậm · nhanh" mà lá
 * đã nói bằng chữ thì ở đây nhìn thấy được: đường xanh nằm trên hay dưới đường vàng.
 * ⚠ Điểm cuối đường xanh = số "đã góp" trên lá (`duongGopHu` — cùng luật đếm, bài canh `pfm_bieu_do.test.ts` §VII).
 */
export function BieuDoViThe({ muc, lenh, duong, homNay }: {
  muc: number; lenh: LenhHu; duong: readonly DiemGop[]; homNay: string;
}): React.ReactElement {
  const dau = duong.length > 0 && duong[0]!.ngay < lenh.tu ? duong[0]!.ngay : lenh.tu;
  const cuoi = homNay > lenh.kyHan ? homNay : lenh.kyHan;
  const rong = Math.max(1, soNgayGiua(dau, cuoi));
  const top = Math.max(1, muc, ...duong.map((p) => p.luyKe)) * 1.08;
  const X = (ngay: string): number => (Math.min(rong, Math.max(0, soNgayGiua(dau, ngay))) / rong) * 100;
  const Y = (v: number): number => 100 - (Math.max(0, v) / top) * 100;
  let thuc = 'M0 100';
  for (const q of duong) {
    if (q.ngay > homNay) break;
    thuc += ` H${X(q.ngay).toFixed(2)} V${Y(q.luyKe).toFixed(2)}`;
  }
  thuc += ` H${X(homNay).toFixed(2)}`;
  const daGop = duong.at(-1)?.luyKe ?? 0;
  return (
    <div className={s.viThe} data-testid="bd-vi-the">
      <div className={s.viTheKhung}>
        <span className={s.nhanMuc} style={{ top: `${Y(muc)}%` }}>{`${B.mucPre}${tienNgan(muc)}`}</span>
        <svg className={s.svgViThe} viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={B.bieuDoViTheAria}>
          <line className={s.vMuc} x1="0" x2="100" y1={Y(muc)} y2={Y(muc)} />
          <line className={s.vNay} x1={X(homNay)} x2={X(homNay)} y1="0" y2="100" />
          <path className={s.vKeHoach} d={`M${X(lenh.tu)} 100 L${X(lenh.kyHan)} ${Y(muc)}`} />
          <path className={s.vThuc} d={thuc} />
        </svg>
      </div>
      <div className={s.trucViThe} aria-hidden="true">
        <span>{ngayViet(dau)}</span>
        <span className={s.homNay} style={{ left: `${X(homNay)}%` }}>{B.homNay}</span>
        <span>{ngayViet(lenh.kyHan, lenh.kyHan.slice(0, 4) !== dau.slice(0, 4))}</span>
      </div>
      <div className={s.ghiChu}>
        <span className={s.gThuc}>{`${B.thucGop} `}<b data-testid="vt-da-gop">{dong(daGop)}</b></span>
        <span className={s.gKeHoach}>{B.keHoach}</span>
      </div>
    </div>
  );
}
