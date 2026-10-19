/**
 * DẤU `!` BẤM ĐƯỢC — cửa vào TẦNG CHỮ của một khối (13/09).
 *
 * ⚠⚠ Founder 13/09 về trang THẺ: *"toàn chữ là chữ, đọc muốn lòi mắt… cái họ muốn chỉ là cái gì
 * trực quan thể hiện kiến thức của mình, chữ thì chỉ dành cho bách khoa toàn thư"*. Nên câu giải
 * thích của một khối (khối đo gì · tính thế nào) nằm SAU dấu này, không nằm sẵn dưới khối. Tầng
 * nhìn là thanh · ô · số; tầng đọc là một cú chạm — và founder đã giữ `!` làm cửa ấy (lá bài, dấu
 * kỹ năng), nên đây là CÙNG MỘT hình, không phải nút mới.
 *
 * ⚠ Ô vẽ 14px nhưng vùng chạm 24px (lề âm bù lại để không đẩy bố cục).
 * ⚠ Lam = bấm được (một trong bốn luật màu) — đây là thứ duy nhất trên nhãn khối mang lam.
 */
import s from './NutHoi.module.css';

export function NutHoi({ mo, onBam, nhan }: { mo: boolean; onBam: () => void; nhan: string }): React.ReactElement {
  return (
    <button type="button" className={s.nut} aria-expanded={mo} aria-label={nhan} onClick={onBam}>
      <span className={s.o} aria-hidden>{mo ? '✕' : '!'}</span>
    </button>
  );
}
