/**
 * RUỘT LỚP TRƯỢT CÀI ĐẶT CỦA KHU PFM (SPEC `pfm-tang-khong-gian` mục 6 câu 1 = A): GIỮ BỐN CỬA đồng ý `CUA_PFM` (`ket · dac_trung ·
 * thuong · noi_game`) của `CaiDatPfm` — không vẽ năm lớp theo docx. Đổi duy nhất là CHỖ ĐẶT: từ tấm phủ riêng `BoardCaiDatPfm` (overlay
 * thứ hai của repo — chính nó ghi nợ "board thứ BA thì gom") sang lớp trượt dùng chung `components/ui/TamTruot`.
 *
 * ⚠ Nạp trễ (`lazy` ở `KhungPfm`): `CaiDatPfm` kéo theo mật mã két + mạng; người chỉ ghi chi tiêu không tải nó.
 * ⚠ Không sở hữu tuỳ chọn nào (cùng luật `BoardCaiDatPfm`): thêm tuỳ chọn PFM mới thì thêm vào `CaiDatPfm`.
 * ⚠ Ngoại lệ có chủ đích: KHUNG CHIA TIỀN (HŨ · 50/30/20 · KAKEIBO) đứng DƯỚI bốn cửa — không phải cửa đồng ý, chỉ là cách bạn muốn nhìn tiền.
 */
import { useNavigate } from 'react-router-dom';
import {
  ROUTE_TAI_CHINH_GUONG, ROUTE_TAI_CHINH_LO_TRINH, ROUTE_TAI_CHINH_NGAY_DAU, ROUTE_TAI_CHINH_PHONG_VAN,
} from '@/lib/vocab';
import { KhoProvider } from '@/pfm/dung_kho';
import { CaiDatPfm } from './CaiDatPfm';
import { GiongHoSo } from './GiongHoSo';
import { KhungChiaTien } from '@/screens/tai-chinh/KhungChiaTien';

export default function NoiDungCaiDatPfm({ onDong }: { onDong: () => void }): React.ReactElement {
  const navigate = useNavigate();
  return (
    <KhoProvider>
      <GiongHoSo />
      {/* Đóng lớp RỒI MỚI đi (D308): đổi route thường tự tháo lớp, trừ ca mở ngay trên màn phỏng vấn. */}
      <CaiDatPfm
        suaPhongVan={() => { onDong(); navigate(ROUTE_TAI_CHINH_PHONG_VAN); }}
        moLoTrinh={() => { onDong(); navigate(ROUTE_TAI_CHINH_LO_TRINH); }}
        moChanDung={() => { onDong(); navigate(ROUTE_TAI_CHINH_NGAY_DAU); }}
      />
      {/* KHUNG CHIA TIỀN (D429) dời về đây từ lớp HƯỚNG của GƯƠNG (founder 11/10, câu B): đặt một lần, ít khi đổi — đúng loại việc của CÀI ĐẶT. */}
      <KhungChiaTien onDi={onDong} onChotTuan={() => { onDong(); navigate(`${ROUTE_TAI_CHINH_GUONG}?mo=chot`); }} />
    </KhoProvider>
  );
}
