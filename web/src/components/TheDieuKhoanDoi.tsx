/**
 * THẺ "ĐIỀU KHOẢN VỪA ĐỔI" (SPEC bao-loi-nguoi-choi — T9; founder 11/10: báo trước CÙNG BẢN, máy chưa thấy thẻ thì chưa
 * gửi lỗi ẩn danh). Hiện một lần mỗi máy; bấm nút nào cũng tính là đã xem (`danhDauDaXemTheDieuKhoan`) — và chính cờ ấy
 * mở cổng của `baoLoiAnDanh`. Thẻ nổi ở đáy, KHÔNG chặn màn: đây là thông báo, không phải hộp xin đồng ý (báo lỗi ẩn
 * danh không có công tắc — founder 11/10 A).
 * Không hiện ở màn toàn tâm (bàn đấu) — cùng luật chỗ đứng với BottomNav/Oracle; rời bàn là thấy.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHU_THE_DIEU_KHOAN as C } from '@/content/baoLoi';
import { NGAY_THE_DIEU_KHOAN, daXemTheDieuKhoan, danhDauDaXemTheDieuKhoan } from '@/lib/bao_loi_an_danh';
import s from './TheDieuKhoanDoi.module.css';

export function TheDieuKhoanDoi(): React.ReactElement | null {
  const [an, datAn] = useState(daXemTheDieuKhoan);
  const dieuHuong = useNavigate();
  if (an) return null;
  const xong = (): void => {
    danhDauDaXemTheDieuKhoan();
    datAn(true);
  };
  return (
    <section className={s.the} role="status" aria-labelledby="the-dk-tieu-de" data-the="dieu-khoan-doi">
      <p className={s.tieuDe} id="the-dk-tieu-de">{C.tieuDe} · {NGAY_THE_DIEU_KHOAN}</p>
      <p className={s.than}>{C.than}</p>
      <div className={s.nut}>
        <button type="button" className={s.phu} onClick={() => { xong(); dieuHuong(C.duongXem); }} data-nut="xem-cho-doi">
          {C.xem}
        </button>
        <button type="button" className={s.chinh} onClick={xong} data-nut="da-hieu">
          {C.daHieu}
        </button>
      </div>
    </section>
  );
}
