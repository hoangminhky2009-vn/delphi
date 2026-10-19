/**
 * ĐIỀU KHOẢN & DỮ LIỆU — màn CÔNG KHAI, không cần đăng nhập.
 *
 * ⚠ KHÔNG bọc `AuthGate`: người ta phải đọc được TRƯỚC khi tạo tài khoản. Một
 * trang điều khoản chỉ xem được sau khi đã đồng ý là trang vô nghĩa.
 *
 * Nội dung nằm ở `@/content/dieuKhoan` — xem lý do ở đầu file đó.
 */
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CAP_NHAT_LUC, MUC, TOM_TAT } from '@/content/dieuKhoan';
import s from './DieuKhoan.module.css';

/**
 * `**đậm**` → <strong>, `` `mã` `` → <code> (mã lỗi mẫu ở đoạn báo lỗi ẩn danh — T4). Đủ cho nhu cầu hiện tại, không kéo
 * cả thư viện markdown.
 */
function dam(raw: string): React.ReactNode[] {
  return raw.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((phan, i) =>
    phan.startsWith('**') && phan.endsWith('**')
      ? <strong key={i}>{phan.slice(2, -2)}</strong>
      : phan.length > 1 && phan.startsWith('`') && phan.endsWith('`')
        ? <code key={i}>{phan.slice(1, -1)}</code>
        : <span key={i}>{phan}</span>,
  );
}

export default function DieuKhoan() {
  // `/dieu-khoan#du-lieu` (nút "Xem chỗ đổi" của thẻ T9): router không tự cuộn tới neo ⇒ cuộn tay một lần.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);
  return (
    <div className={s.boc}>
      <header className={s.dau}>
        <h1 className={s.tieuDe}>ĐIỀU KHOẢN &amp; DỮ LIỆU</h1>
        <p className={s.phu}>
          Bản dễ đọc. Tụi mình cố viết cho người thật đọc được, không phải cho
          luật sư đọc — nhưng mọi thứ ghi ở đây là thật.
        </p>
      </header>

      <section className={s.tomTat} aria-label="Tóm tắt">
        <h2 className={s.tomTatTieuDe}>30 GIÂY LÀ ĐỦ</h2>
        <ul className={s.tomTatDs}>
          {TOM_TAT.map((d, i) => <li key={i}>{dam(d)}</li>)}
        </ul>
      </section>

      {MUC.map((m) => (
        <section key={m.id} className={s.muc} id={m.id}>
          <h2 className={s.mucTieuDe}>{m.tieuDe}</h2>
          {m.doan.map((d, i) => <p key={i} className={s.doan}>{dam(d)}</p>)}
          {m.nhan ? <p className={s.nhan}>{dam(m.nhan)}</p> : null}
        </section>
      ))}

      <section className={s.muc} id="lien-he">
        <h2 className={s.mucTieuDe}>HỎI GÌ THÌ HỎI</h2>
        <p className={s.doan}>
          Thắc mắc về điều khoản, về dữ liệu, hay muốn xoá tài khoản mà không
          tìm thấy nút: nhắn cho tụi mình.
        </p>
        <p className={s.doan}>
          <a className={s.mail} href="mailto:hotenmau@example.com">
            hotenmau@example.com
          </a>
        </p>
      </section>

      <footer className={s.chan}>
        <p>Cập nhật lần cuối: {CAP_NHAT_LUC}</p>
        <Link className={s.ve} to="/">← VỀ HUB</Link>
      </footer>
    </div>
  );
}
