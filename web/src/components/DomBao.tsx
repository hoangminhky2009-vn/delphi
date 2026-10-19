/**
 * ĐỐM BÁO — chấm vàng nhỏ ở góc một lối vào. Luật của cơ chế ở `lib/dom_bao.ts` (đọc khối
 * đầu tệp đó trước khi thêm mã mới: **đốm đánh dấu SỰ KIỆN, không đánh dấu TRẠNG THÁI**).
 *
 * ⚠ `aria-hidden` + một chữ cho máy đọc màn hình ở phần tử CHA: bản thân chấm không mang
 *   nghĩa gì khi đọc thành tiếng, nhưng "có mục mới" thì có.
 */
import { useEffect, useState } from 'react';
import { SU_KIEN_DOM, domDangHien, type MaDom } from '@/lib/dom_bao';
import s from './DomBao.module.css';

/**
 * Danh sách đốm ĐANG HIỆN, và tự cập nhật khi có đốm bật/tắt.
 *
 * ⚠ Nghe HAI sự kiện: `SU_KIEN_DOM` (do `lib/dom_bao.ts` tự bắn mỗi lần ghi — vì `localStorage`
 *   KHÔNG bắn `storage` trong chính tab vừa ghi) và `storage` (tab khác cùng máy). Thiếu vế đầu thì
 *   một dải tab đã dựng sẵn không bao giờ thấy đốm mới cho tới khi rời màn rồi quay lại.
 */
export function useDomHien(): readonly MaDom[] {
  const [ds, datDs] = useState<readonly MaDom[]>([]);
  useEffect(() => {
    const doc = (): void => datDs(domDangHien());
    doc();
    /* Nghe cả sự kiện trong-tab (`SU_KIEN_DOM`) lẫn `storage` (tab khác cùng máy). */
    window.addEventListener(SU_KIEN_DOM, doc);
    window.addEventListener('storage', doc);
    return () => {
      window.removeEventListener(SU_KIEN_DOM, doc);
      window.removeEventListener('storage', doc);
    };
  }, []);
  return ds;
}

export function useDom(ma: MaDom): boolean {
  return useDomHien().includes(ma);
}

export function DomBao({ hien }: { hien: boolean }): React.ReactElement | null {
  if (!hien) return null;
  return <span className={s.dom} aria-hidden />;
}
