/**
 * Cổng đăng nhập dùng chung: mọi màn dữ liệu (sảnh/chi tiết/ví/kết quả) đều cần
 * phiên + đã onboard (API requireAuth + requireOnboarded). Khách → mời đăng nhập;
 * có phiên nhưng chưa onboard → đưa đi lập hồ sơ.
 */
import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ECONOMY } from '@config/economy';
import { useMe } from '@/api/queries';
import { ghiDiemQuayVe } from '@/lib/diem_quay_ve';
import { formatT } from '@/lib/money';
import { NeonButton } from '@/components/ui';
import { AuthHero } from './AuthHero';
import s from './AuthGate.module.css';

export function AuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const me = useMe();
  /*
   * D333 — người mở LINK BÀN khi chưa có tài khoản / chưa lập hồ sơ: nhớ bàn ấy để cuối chuỗi đăng ký
   * đưa họ về đúng bàn, không về Hub. `ghiDiemQuayVe` tự bỏ qua mọi đường không phải đường bàn.
   */
  const canCuaVao = !me.isPending && !me.isError && (!me.data || !me.data.user);
  useEffect(() => {
    if (canCuaVao) ghiDiemQuayVe(pathname);
  }, [canCuaVao, pathname]);

  if (me.isPending) {
    return (
      <div className={s.box} aria-busy="true">
        <span className={s.prompt}>&gt;_</span> đang kiểm tra phiên…
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className={s.box} role="alert">
        <span>Không gọi được máy chủ. Kiểm tra mạng rồi thử lại nhé.</span>
        <NeonButton variant="ghost" onClick={() => me.refetch()}>
          ↻ THỬ LẠI
        </NeonButton>
      </div>
    );
  }

  if (!me.data) {
    return (
      <>
        <AuthHero />
        <div className={s.box}>
          <span>
            Tạo tài khoản — nhận <b>{formatT(ECONOMY.STARTING_BANKROLL)}</b> vốn ảo khởi điểm.
          </span>
          <NeonButton block onClick={() => navigate('/onboard')}>
            ▶ ĐĂNG NHẬP / ĐĂNG KÝ
          </NeonButton>
        </div>
      </>
    );
  }

  if (!me.data.user) {
    return (
      <div className={s.box}>
        <span>
          Còn một bước: lập hồ sơ dự báo để nhận {formatT(ECONOMY.STARTING_BANKROLL)} vốn khởi
          điểm.
        </span>
        <NeonButton block onClick={() => navigate('/onboard/ho-so')}>
          ▶ HOÀN TẤT HỒ SƠ
        </NeonButton>
      </div>
    );
  }

  return <>{children}</>;
}
