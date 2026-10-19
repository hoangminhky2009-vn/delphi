/**
 * Menu chính — thanh tab dưới cùng (mobile-first C6). Icon pixel-art tự vẽ
 * (không bộ icon ngoài).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 25/07/2026 — 5 TAB → 4 TAB (chỉ đạo founder §2).
 *
 * Cũ: Sảnh · Kết quả · DỰ BÁO(hero) · Token · Hồ sơ
 * Mới: Hub · Token · Shop · Profile
 *
 * Vì sao bỏ hai tab mà KHÔNG mất tính năng:
 *  - "Dự báo" không còn là TAB vì nó là một MODULE có cửa vào từ Hub. Route
 *    `/du-bao` vẫn sống nguyên (nó LÀ gốc module), chỉ không chiếm ô nav nữa.
 *  - "Kết quả" từng là màn riêng trùng ~85% với sảnh kèo (cùng CSS, cùng hook,
 *    khác đúng mảng `statuses`). Giờ là một LỚP LỌC trong module Dự báo. Route
 *    `/ket-qua` redirect vào đó, không màn nào chết.
 *
 * Vì sao BỎ tab "hero" (Mascot nổi giữa): 4 ô thì không có ô giữa. Nhấn giả
 * một trong hai ô trong cùng là lệch thị giác không có lý do. Linh vật Oracle
 * vẫn ngự ở khối ORACLE CORE trên Hub — nơi nó có nghĩa thật.
 *
 * Chấm đỏ thông báo phải CÓ NGHĨA THẬT — hiện ở TOKEN khi ví dưới ngưỡng trợ
 * cấp (tức đang có trợ cấp ngày để nhận). Không gắn chấm trang trí.
 */
import { NavLink } from 'react-router-dom';
import { ECONOMY } from '@config/economy';
import { useMe } from '@/api/queries';
import { useLoTrinh } from '@/api/nhiem_vu';
import { coViecCho } from '@/lib/viec_cho';
import { ROUTE_HANH_TRINH, ROUTE_HUB, ROUTE_PROFILE, ROUTE_SHOP, ROUTE_TOKEN } from '@/lib/vocab';
import { PixelIcon, type PixelIconName } from './ui/PixelIcon';
import s from './BottomNav.module.css';

interface Item {
  to: string;
  label: string;
  icon: PixelIconName;
}

const ITEMS: Item[] = [
  { to: ROUTE_HUB, label: 'HUB', icon: 'hall' },
  { to: ROUTE_TOKEN, label: 'TOKEN', icon: 'wallet' },
  // Founder 01/08: BP + nhiệm vụ có TRANG RIÊNG kiểu TFT — shortcut ngay toolbar.
  { to: ROUTE_HANH_TRINH, label: 'MÙA', icon: 'medal' },
  { to: ROUTE_SHOP, label: 'SHOP', icon: 'shop' },
  { to: ROUTE_PROFILE, label: 'HỒ SƠ', icon: 'user' },
];

export function BottomNav() {
  const me = useMe();
  const bankroll = me.data?.user?.bankroll;
  const canClaimSubsidy = bankroll !== undefined && bankroll < ECONOMY.SUBSIDY_THRESHOLD;
  /*
   * Chấm tab MÙA (founder 22/08) — thay khối lộ trình vừa gỡ khỏi đầu Hub. Cùng
   * khoá cache với trang /hanh-trinh nên không đẻ request thừa; luật chấm ở
   * `lib/viec_cho.ts` (thuần, test riêng).
   */
  const lt = useLoTrinh();
  const coViec = coViecCho(lt.data);

  return (
    <nav className={s.nav} aria-label="Menu chính">
      <div className={s.bar}>
        {ITEMS.map((item) => {
          // Neo theo HẰNG SỐ, không so chuỗi tay: đổi path ở vocab.ts mà quên
          // dòng này từng làm chấm trợ cấp tắt lặng lẽ (không lỗi biên dịch).
          const dot = (item.to === ROUTE_TOKEN && canClaimSubsidy)
            || (item.to === ROUTE_HANH_TRINH && coViec);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === ROUTE_HUB}
              className={({ isActive }) =>
                [s.item, isActive ? s.active : ''].filter(Boolean).join(' ')
              }
            >
              <span className={s.iconWrap}>
                <PixelIcon name={item.icon} size={16} />
                {dot && (
                  <span
                    className={s.dot}
                    aria-label={item.to === ROUTE_TOKEN
                      ? 'Có trợ cấp ngày để nhận' : 'Có việc mùa để nhận'}
                  />
                )}
              </span>
              <span className={s.label}>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
