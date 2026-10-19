/**
 * CỬA VÀO `/onboard` — màn ĐẦU TIÊN người chưa đăng nhập nhìn thấy.
 *
 * ── Bố cục 07/09 (chỉ thị founder) ────────────────────────────────────────
 * Trước: nút CHƠI NGAY to nhất → vạch "hoặc dùng tài khoản" → biểu mẫu email
 * bày sẵn ngay dưới. Ba khối, hai đường vào ngang hàng nhau.
 *
 * Nay: MỘT nút — `ĐĂNG KÝ / ĐĂNG NHẬP` — bật `BoardAuth` lên. Biểu mẫu và cái
 * vạch biến mất khỏi màn. Đường khách tụt xuống thành một DÒNG CHỮ cùng cỡ với
 * dòng điều khoản: vẫn vào được, nhưng không còn là lời mời to nhất màn.
 *
 * ⚠ Màn này khai `toanMan` trong `routes.tsx` ⇒ AppShell giấu BottomNav (5 tab)
 * và bong bóng Oracle. Không phải tiện tay: bong bóng Oracle mặc định NẰM ĐÈ lên
 * đúng chỗ nút chính, và 5 tab dưới thì dẫn tới những màn mà người chưa có tài
 * khoản vào sẽ bị chặn.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMe } from '@/api/queries';
import { AuthHero } from '@/components/AuthHero';
import { NeonButton } from '@/components/ui';
import { useVaoKhach } from '@/api/khach';
import { docDiemQuayVe } from '@/lib/diem_quay_ve';
import { BoardAuth } from './BoardAuth';
import s from './auth.module.css';

export function Login() {
  const navigate = useNavigate();
  const me = useMe();
  const [moBoard, setMoBoard] = useState(false);

  // Đã có phiên → không ở lại màn auth
  useEffect(() => {
    if (!me.data) return;
    /*
     * ⚠⚠ KHÁCH CỐ Ý ĐƯỢC Ở LẠI — bug founder bắt 04/08: *"bấm đăng ký để giữ tài
     * khoản mà nó đ** điều hướng đi đâu"*.
     *
     * Khách CÓ phiên và `onboarded === true`, nên luật cũ đá họ về `/` NGAY khi
     * màn vừa dựng — bằng `replace: true` nên không còn dấu vết nào trong lịch
     * sử. Nhìn từ ngoài: bấm nút, không có gì xảy ra.
     *
     * Và nó đá đúng người cần màn này nhất: đây là cửa DUY NHẤT để thoát chế độ
     * khách. Cùng một lớp lỗi với nút ở Hub — code coi "có phiên" là "đã là người
     * dùng thật", trong khi khách là phiên của một người CHƯA có tài khoản.
     */
    if (me.data.user?.la_khach === true) return;
    // D333 — cùng đích với biểu mẫu đăng nhập (đọc chung một điểm quay về, không xoá) để hai cú điều
    // hướng sau đăng nhập không cãi nhau.
    navigate(me.data.onboarded ? (docDiemQuayVe() ?? '/') : '/onboard/ho-so', { replace: true });
  }, [me.data, navigate]);

  const khach = useVaoKhach();

  return (
    <>
      <AuthHero />
      <div className={s.cuaVao}>
        <NeonButton type="button" block onClick={() => setMoBoard(true)}>
          ▶ ĐĂNG KÝ / ĐĂNG NHẬP
        </NeonButton>
        <p className={s.cuaVaoChu}>
          Giữ thành tích, lên bảng xếp hạng, mở khu Personal Finance.
        </p>
        {/*
          Điều khoản đứng NGAY ĐÂY, cạnh nút chính — không giấu ở chân trang.
          Tạo tài khoản là đã dùng dịch vụ, nên đường đọc điều khoản phải ở cùng
          tầm mắt với cái nút đó, không phải sau ba lần cuộn.
        */}
        <p className={s.cuaVaoDieuKhoan}>
          Tiếp tục là bạn đồng ý với <Link to="/dieu-khoan">Điều khoản &amp; dữ liệu</Link>.
        </p>
        {/*
          ĐƯỜNG KHÁCH — cùng cỡ chữ, cùng kiểu với dòng điều khoản ngay trên
          (founder 07/09: *"làm giống như phần Điều khoản & dữ liệu ấy, ko cần
          nút"*). Nó vẫn là cửa DUY NHẤT không cần email (D64: "bậc 0 ngồi vào
          bàn chơi ngay"), chỉ thôi không còn là nút to nhất màn.

          Là `<button>` chứ không phải `<Link>`: nó GỌI API tạo phiên khách chứ
          không đi tới một địa chỉ nào — một thẻ `a` ở đây sẽ nói dối cả trình
          đọc màn hình lẫn cái menu chuột phải.
        */}
        <p className={s.cuaVaoDieuKhoan}>
          Chưa muốn tạo tài khoản?{' '}
          <button
            type="button"
            className={s.lienKetChu}
            disabled={khach.isPending}
            onClick={() => khach.mutate(undefined, {
              /*
               * ⚠⚠ ĐIỀU HƯỚNG NGAY TẠI CÚ BẤM — không trông cậy effect phía trên.
               *
               * Hai bản vá đúng va nhau (bắt được 15/08 khi đi thử bằng mắt người
               * lạ): effect trên cố ý `return` sớm khi `la_khach` để khách quay lại
               * đăng ký không bị đá đi (bug 04/08). Nhưng `useVaoKhach` chỉ
               * invalidate `me` rồi TRÔNG CẬY đúng effect đó để đi tiếp — nên
               * người lạ bấm chơi ngay: phiên tạo xong (200), ví đổi KHÁCH → 0 T,
               * và màn ĐỨNG NGUYÊN ở trang đăng nhập. Nhìn từ ngoài: nút chết.
               *
               * ⭐ D374 (founder 21/09) — VỀ HUB, KHÔNG VÀO THẲNG ĐẤU TRƯỜNG.
               * Chú thích cũ viện D86 ("phễu đổ vào vòng chơi lõi"); founder lật:
               * *"đăng nhập xong phải dẫn vào hub"*. Cú dắt vào bàn tập KHÔNG mất —
               * D336 vẫn dắt người lần đầu ngay khi họ bấm Đấu trường ở Hub, chỉ là
               * sau một cú bấm CỦA HỌ. Lý lẽ đầy đủ ở `OnboardProfile.tsx`.
               */
              onSuccess: () => navigate('/', { replace: true }),
            })}
          >
            {khach.isPending ? 'đang vào…' : 'Chơi ngay'}
          </button>{' '}
          — không cần email, nhưng chưa lên bảng xếp hạng được.
        </p>
        {khach.error && (
          <p className={s.serverError} role="alert">✕ {khach.error.message}</p>
        )}
      </div>
      {moBoard && <BoardAuth onDong={() => setMoBoard(false)} />}
    </>
  );
}
