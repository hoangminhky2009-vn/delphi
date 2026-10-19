/**
 * KHUNG CHIA TIỀN (HŨ · 50/30/20 · KAKEIBO — D429) — nay nằm trong lớp CÀI ĐẶT của khu Tài chính (founder 11/10, câu B của lớp HƯỚNG).
 *
 * Vì sao dời: demo bản 6 chỉ có HAI việc trong lớp HƯỚNG (app học được · bạn chọn hướng tuần tới); chọn khung là việc "cách tôi chia tiền"
 * — đặt một lần rồi ít khi đổi, đúng loại thứ của lớp CÀI ĐẶT (một bánh răng ở dải tab, tới được từ mọi tab: ≤ 1 chạm + một lần mở lớp).
 * Nội dung KHÔNG đổi: dùng lại nguyên `KhoiDinhHuong` (thẻ khung · dấu hiệu · "xem số của mình theo khung ấy" · bước dựng · chọn khung).
 *
 * ⚠ Nạp trễ cùng lớp CÀI ĐẶT (`NoiDungCaiDatPfm` là `lazy`) — SỔ không kéo thêm byte nào (`so_goi_nhe.test.ts`).
 * ⚠ Bước "bốn câu cuối tuần" của khung kakeibo mở lớp CHỐT SỔ TUẦN ở GƯƠNG: đóng lớp này rồi `/tai-chinh/guong?mo=chot`.
 * ⚠ Chỉ dựng khi sổ + hũ + luật đã THẬT (nếp D426/D429): dựng trên mảng rỗng của nhịp đầu là thẻ nói một câu sai rồi tự đổi.
 */
import { useState } from 'react';
import type React from 'react';
import { CHU_BENTO as CB, CHU_HUONG as H } from '@/lib/pfm_chu';
import { useCaiDatMay, useHoSo, useHu, useLuat, useSoTatCa } from '@/pfm/dung_kho';
import { homNay } from '@/pfm/thoi_gian';
import b from '@/components/pfm/PfmBento.module.css';
import { KhoiDinhHuong } from './DinhHuong';

/** Tên ngắn của khung đang chọn — cùng tên thẻ chọn khung của `DinhHuong.tsx`. */
const TEN_KHUNG: Record<string, string> = { hu: 'HŨ', '50_30_20': '50/30/20', kakeibo: 'KAKEIBO' };

export function KhungChiaTien({ onChotTuan, onDi }: { onChotTuan: () => void; onDi: () => void }): React.ReactElement {
  const [ngayNay] = useState(() => homNay());
  const { data: tatCa, dangTai: taiTatCa } = useSoTatCa();
  const { data: hu, dangTai: taiHu } = useHu();
  const { data: luat, dangTai: taiLuat } = useLuat();
  const { data: hoSo } = useHoSo();
  const guongTat = useCaiDatMay().data.guongTat === true;
  const dangTai = taiTatCa || taiHu || taiLuat;
  const ten = hoSo.khung !== undefined && hoSo.khung in TEN_KHUNG ? TEN_KHUNG[hoSo.khung]! : H.napKhungChuaChon;
  return (
    <div data-testid="khung-chia-tien" data-nap="khung">
      <p className={b.tieuNho}>{`${H.napKhung} · ${ten}`}</p>
      {dangTai
        ? <p className={b.ghiChu}>{CB.dangTai}</p>
        : <KhoiDinhHuong tatCa={tatCa} hu={hu} luat={luat} ngayNay={ngayNay} tatHanhVi={guongTat} onChotTuan={onChotTuan} onDi={onDi} />}
    </div>
  );
}
