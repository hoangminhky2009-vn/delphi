/**
 * BOARD ĐĂNG NHẬP / ĐĂNG KÝ (chỉ thị founder 07/09).
 *
 * Trước đó `/onboard` bày SẴN biểu mẫu email ngay dưới nút CHƠI NGAY, cách nhau
 * một vạch "hoặc dùng tài khoản". Founder gỡ cả cụm đó: màn cửa vào chỉ còn MỘT
 * nút, bấm mới bật board này lên.
 *
 * Ruột hai tab lấy từ `AuthForms` — board KHÔNG có bản cài đặt riêng của biểu
 * mẫu nào (A11.5). Ở đây chỉ có: khung, hai tab, và đường thoát.
 *
 * ⚠ Không tự bắt phím Tab (focus trap). Board đóng được bằng Esc, bằng nút ✕ và
 * bằng bấm ra nền, nên người dùng bàn phím không bị kẹt — một trap viết vội thì
 * hại hơn là không có.
 */
import { useEffect, useRef, useState } from 'react';
import { LoginForm, RegisterForm } from './AuthForms';
import s from './auth.module.css';

type Tab = 'dang-nhap' | 'dang-ky';

interface Props {
  /** Tab mở sẵn khi board bật lên. */
  tabDau?: Tab;
  onDong: () => void;
}

export function BoardAuth({ tabDau = 'dang-nhap', onDong }: Props) {
  const [tab, setTab] = useState<Tab>(tabDau);
  const khung = useRef<HTMLDivElement>(null);

  // Esc để thoát — cửa ra bằng bàn phím, bắt buộc với một lớp phủ toàn màn.
  useEffect(() => {
    const nghe = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDong();
    };
    window.addEventListener('keydown', nghe);
    return () => window.removeEventListener('keydown', nghe);
  }, [onDong]);

  /*
   * Khóa cuộn NỀN khi board mở. Thiếu dòng này thì trên điện thoại, vuốt trong
   * board hết đà sẽ cuộn trang phía sau — board đứng yên còn nền trôi, mắt đọc
   * ra là app hỏng.
   */
  useEffect(() => {
    const cu = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = cu;
    };
  }, []);

  // Đưa con trỏ vào board ngay khi mở, để người đọc màn hình không còn đứng ở nền.
  useEffect(() => {
    khung.current?.focus();
  }, []);

  return (
    <div
      className={s.boardNen}
      onMouseDown={(e) => {
        // Chỉ đóng khi bấm ĐÚNG nền, không phải khi bấm trong board rồi thả ra nền.
        if (e.target === e.currentTarget) onDong();
      }}
    >
      <div
        className={s.board}
        ref={khung}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Đăng nhập hoặc đăng ký"
      >
        <div className={s.boardDinh}>
          <div className={s.boardTabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'dang-nhap'}
              className={`${s.boardTab} ${tab === 'dang-nhap' ? s.boardTabBat : ''}`}
              onClick={() => setTab('dang-nhap')}
            >
              ĐĂNG NHẬP
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'dang-ky'}
              className={`${s.boardTab} ${tab === 'dang-ky' ? s.boardTabBat : ''}`}
              onClick={() => setTab('dang-ky')}
            >
              ĐĂNG KÝ
            </button>
          </div>
          <button
            type="button"
            className={s.boardDong}
            onClick={onDong}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className={s.boardRuot}>
          {tab === 'dang-nhap' ? (
            <LoginForm onXong={onDong} />
          ) : (
            <RegisterForm onSangDangNhap={() => setTab('dang-nhap')} />
          )}
        </div>
      </div>
    </div>
  );
}
