/**
 * CÀI ĐẶT — màn đầu tiên của app (D106, founder 22/08: *"game chưa có phần
 * setting, bạn làm luôn đi"*).
 *
 * ⚠ 07/09 — RUỘT ĐÃ RA Ở NƠI KHÁC, màn này giờ là một trong HAI cửa vào cùng bộ
 * cài đặt. Cửa kia là board ⚙ ở góc phải khu PFM (`BoardCaiDatPfm`). Cả hai gọi
 * đúng `GiongHoSo` + `CaiDatPfm` — không bên nào có bản riêng (A11.5).
 *
 * ⚠ Không có gì ở đây chạm ví hay trận. Thêm tuỳ chọn mới thì thêm một khối —
 * đừng biến màn này thành nơi giấu nút nguy hiểm.
 */
import { Link, useNavigate } from 'react-router-dom';
import { ScreenFrame } from '@/components/ScreenFrame';
import { NeonButton } from '@/components/ui';
import { CaiDatPfm } from '@/components/pfm/CaiDatPfm';
import { GiongHoSo } from '@/components/pfm/GiongHoSo';
import { KhoProvider } from '@/pfm/dung_kho';
import {
  ROUTE_PROFILE, ROUTE_TAI_CHINH_LO_TRINH, ROUTE_TAI_CHINH_NGAY_DAU, ROUTE_TAI_CHINH_PHONG_VAN,
  ROUTE_PROFILE_THE,
} from '@/lib/vocab';
import s from './CaiDat.module.css';
import { PFM_WEB_MO } from '@/lib/pfm_mo';
import { CHU_HUB } from '@/lib/hub_chu';

export function CaiDat() {
  const navigate = useNavigate();
  return (
    <ScreenFrame title="Cài đặt">
      <GiongHoSo />

      <div className={s.khoi}>
        <Link to={ROUTE_PROFILE_THE}>
          <NeonButton variant="ghost" block>XEM THẺ TÍNH CÁCH ›</NeonButton>
        </Link>
      </div>

      {/*
        SỔ CHI TIÊU (D295) — bốn cửa consent · mã khôi phục · két · xoá sạch. Bọc
        `KhoProvider` vì khối này đọc/ghi kho trên máy (chìa, cài đặt cục bộ) và là chỗ
        driver đồng bộ được kích như mọi màn PFM khác. Ruột theo demo đã chốt.
      */}
      {/* SPEC chan-truoc-beta — khu Tài chính KHOÁ trên web (`lib/pfm_mo.ts`): không dựng khối ⇒ không `KhoProvider` ⇒ driver nền
          PFM không chạy. Xoá sạch sổ cũ vẫn ở Hồ sơ → Dữ liệu của tôi. */}
      {!PFM_WEB_MO ? <p className={s.chuThich}>{CHU_HUB.taiChinhKhoaMo}</p> : (
      <div className={`${s.khoi} ${s.khoiPfm}`}>
        <KhoProvider>
          {/* Cùng một hàng "SỬA SÁU CÂU" như board ⚙ — hai cửa, một khối (A11.5). */}
          <CaiDatPfm
            suaPhongVan={() => navigate(ROUTE_TAI_CHINH_PHONG_VAN)}
            moLoTrinh={() => navigate(ROUTE_TAI_CHINH_LO_TRINH)}
            moChanDung={() => navigate(ROUTE_TAI_CHINH_NGAY_DAU)}
          />
        </KhoProvider>
      </div>
      )}
      <p className={s.chuThich}>
        <Link className={s.lienKet} to={ROUTE_PROFILE}>‹ về Hồ sơ</Link>
      </p>
    </ScreenFrame>
  );
}
