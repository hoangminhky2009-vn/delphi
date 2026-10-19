/**
 * BOARD CÀI ĐẶT CHUNG CỦA KHU PFM (chỉ thị founder 07/09).
 *
 * *"làm cái cài đặt chung cho PFM đi, để lên góc phải ấy, cho luôn cả cái đổi
 * giọng hay mọi setting hiện có của PFM vào phần setting chung đó"*.
 *
 * Ruột là HAI khối đã có, gọi nguyên bản — board không sở hữu một tuỳ chọn nào
 * của riêng nó (A11.5):
 *   · `GiongHoSo`  — giọng thẻ tính cách (trước nằm ở `/cai-dat`);
 *   · `CaiDatPfm`  — consent · mã khôi phục · két · xoá sạch (D295).
 * Thêm tuỳ chọn PFM mới thì thêm vào `CaiDatPfm`, KHÔNG thêm vào đây — không thì
 * `/cai-dat` và board này lệch nhau, và người dùng thấy hai bộ cài đặt khác nhau
 * cho cùng một thứ.
 *
 * ⚠ NỢ ĐÃ BIẾT: đây là bản overlay THỨ HAI trong repo (sau `screens/auth/BoardAuth`).
 * Hai bản CSS cho cùng một hành vi "tấm phủ + tấm trượt" là mầm trôi. ĐIỀU KIỆN GOM
 * (A11.15 — hoãn thì ghi mốc đo được): khi có board thứ BA, tách `components/ui/Tam.tsx`
 * và cả ba dùng chung; hai bản thì chưa đáng một lớp trừu tượng.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTE_TAI_CHINH_LO_TRINH, ROUTE_TAI_CHINH_NGAY_DAU, ROUTE_TAI_CHINH_PHONG_VAN } from '@/lib/vocab';
import { KhoProvider } from '@/pfm/dung_kho';
import { CaiDatPfm } from './CaiDatPfm';
import { GiongHoSo } from './GiongHoSo';
import s from './BoardCaiDatPfm.module.css';

export function BoardCaiDatPfm({ onDong }: { onDong: () => void }): React.ReactElement {
  const khung = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Esc để thoát — cửa ra bằng bàn phím, bắt buộc với một lớp phủ toàn màn.
  useEffect(() => {
    const nghe = (e: KeyboardEvent) => { if (e.key === 'Escape') onDong(); };
    window.addEventListener('keydown', nghe);
    return () => window.removeEventListener('keydown', nghe);
  }, [onDong]);

  /*
   * Khoá cuộn NỀN khi board mở. Thiếu dòng này thì trên điện thoại, vuốt trong
   * board hết đà sẽ cuộn trang phía sau — board đứng yên còn nền trôi, mắt đọc
   * ra là app hỏng.
   */
  useEffect(() => {
    const cu = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = cu; };
  }, []);

  useEffect(() => { khung.current?.focus(); }, []);

  return (
    <div
      className={s.nen}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onDong(); }}
    >
      <div
        className={s.board}
        ref={khung}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Cài đặt khu Tài chính"
      >
        <div className={s.dinh}>
          <span className={s.tieuDe}>CÀI ĐẶT · TÀI CHÍNH</span>
          <button type="button" className={s.dong} onClick={onDong} aria-label="Đóng">
            ✕
          </button>
        </div>
        {/*
          `KhoProvider` bọc ở ĐÂY chứ không ở từng khối: `CaiDatPfm` đọc/ghi kho trên
          máy, và board này mở được từ MỌI màn PFM — trong đó có màn chưa dựng kho.
        */}
        <div className={s.ruot}>
          <KhoProvider>
            <GiongHoSo />
            {/*
              ĐÓNG BOARD RỒI MỚI ĐI (D308). Đổi route thường tự tháo board vì cả
              màn bị gỡ — trừ đúng ca mở ⚙ NGAY TRÊN màn phỏng vấn: route không
              đổi, board đứng nguyên, và người dùng bấm SỬA thấy y như hỏng.
            */}
            <CaiDatPfm
              suaPhongVan={() => { onDong(); navigate(ROUTE_TAI_CHINH_PHONG_VAN); }}
              moLoTrinh={() => { onDong(); navigate(ROUTE_TAI_CHINH_LO_TRINH); }}
              moChanDung={() => { onDong(); navigate(ROUTE_TAI_CHINH_NGAY_DAU); }}
            />
          </KhoProvider>
        </div>
      </div>
    </div>
  );
}
