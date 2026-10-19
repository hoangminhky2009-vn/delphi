/**
 * Khung placeholder chung của một màn: breadcrumb terminal + tiêu đề + mô tả scope.
 * GĐ5 thay ruột từng màn bằng UI thật; khung card/breadcrumb giữ nguyên phong cách.
 */
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import s from './ScreenFrame.module.css';

interface Props {
  /** Tiêu đề màn (Space Grotesk — nội dung "người"). */
  title: string;
  /** Ghi chú scope/luật liên quan — hiển thị như mô tả tạm. */
  children?: ReactNode;
  /** Màn đã có logic thật (verify-email…) thì tắt pill "khung". */
  live?: boolean;
  /**
   * Khe GÓC PHẢI, ngang dòng breadcrumb — cho MỘT biểu tượng của riêng màn/khu
   * (khu Tài chính cắm bánh răng cài đặt vào đây, founder 07/09).
   *
   * ⚠ Một biểu tượng, không phải một thanh công cụ. Dòng breadcrumb cao 11px chữ;
   * nhét hai ba thứ vào là nó tự thành hàng nút thứ hai, mà hàng nút thì đã có dải
   * tab lo. Cần nhiều hơn một thì đó là dấu hiệu phải thiết kế lại, không phải
   * nhét thêm.
   */
  goc?: ReactNode;
  /**
   * KHUNG GỌN — bỏ breadcrumb + tiêu đề, chỉ chừa một dải mỏng cho `goc`.
   *
   * Founder 08/09: khu Tài chính xếp BỐN tầng khung trước khi tới nội dung
   * (header `DELPHI://SỔ` → breadcrumb → tiêu đề → dải tab). Ba tầng đầu nói
   * CÙNG MỘT THỨ và ăn ~112px trên màn 812px. Bỏ hai tầng giữa thì **dải tab
   * dâng lên đúng chỗ ấy** — founder chỉ đích danh: *"phần diện tích vô ích đó
   * thay bằng cái này"*.
   *
   * ⚠ LÀ PROP, KHÔNG ĐỌC ROUTE. Bản đầu tôi đọc cờ `khuRieng` bằng `useMatches`
   * và nó NÉM ở mọi test render `ScreenFrame` ngoài data router — hook ấy đòi
   * đúng một loại router. Một khung dùng chung không được kén nơi mình bị dựng.
   *
   * ⚠ Chỉ bật ở màn CÓ dải tab. Màn ngoài khu không có gì khác nói đang ở đâu.
   */
  gon?: boolean;
}

export function ScreenFrame({ title, children, live = false, goc, gon = false }: Props) {
  const { pathname } = useLocation();
  return (
    <section className={`${s.card} ${gon ? s.cardGon : ''}`}>
      <div className={s.breadcrumb}>
        {!gon && (
          <>
            <span className={s.prompt}>&gt;_</span>
            <span>{pathname}</span>
          </>
        )}
        {goc !== undefined && <span className={s.goc}>{goc}</span>}
      </div>
      {!gon && <h1 className={s.title}>{title}</h1>}
      {children !== undefined && <div className={s.body}>{children}</div>}
      {!live && <span className={s.stub}>KHUNG — UI THẬT LÀM Ở GĐ5</span>}
    </section>
  );
}
