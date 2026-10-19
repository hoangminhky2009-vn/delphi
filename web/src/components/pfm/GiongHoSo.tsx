/**
 * GIỌNG HỒ SƠ TÍNH CÁCH — khối chọn giọng, MỘT BẢN CÀI ĐẶT DUY NHẤT (A11.5).
 *
 * Vì sao tách khỏi `screens/CaiDat.tsx`: từ 07/09 nó có HAI cửa —
 *   · màn `/cai-dat` (cài đặt chung của app);
 *   · board ⚙ ở góc phải khu PFM (founder 07/09: *"làm cái cài đặt chung cho PFM
 *     đi, để lên góc phải ấy, cho luôn cả cái đổi giọng"*).
 * Chép khối này sang board là dựng bản thứ hai của cùng một cú `useDoiGiong`, và
 * bản thứ hai sẽ trôi: thêm một giọng ở một bên, bên kia không có.
 *
 * ⚠ CSS import thẳng từ `screens/CaiDat.module.css` — CỐ Ý. Các lớp `.khoi`,
 * `.lua`, `.luaChon`… đã được cân ở đó (tương phản + vùng chạm 44px); chép sang
 * một module mới là dựng bản sao thứ hai của bảng màu, đúng thứ A11.5 cấm. Một
 * tệp CSS dùng bởi hai nơi vẫn là MỘT nguồn.
 */
import { useMe } from '@/api/queries';
import { useDoiGiong } from '@/api/cai_dat';
import {
  TEN_GIONG, THE_TINH_CACH, giongCua, type GiongChon,
} from '@/lib/tinh_cach';
import s from '@/screens/CaiDat.module.css';

const THU_TU: GiongChon[] = ['tu_dong', 'tre', 'vua', 'chung'];

export function GiongHoSo(): React.ReactElement {
  const me = useMe();
  const doi = useDoiGiong();
  const user = me.data?.user ?? null;
  const chon: GiongChon = (user?.giong_ho_so as GiongChon | undefined) ?? 'tu_dong';
  const hieuLuc = giongCua(user?.age_band, chon);

  return (
    <div className={s.khoi}>
      <div className={s.khoiNhan}>GIỌNG HỒ SƠ TÍNH CÁCH</div>
      <p className={s.chuThich}>
        Thẻ tính cách tài chính của bạn nói bằng giọng nào. Tự động thì đọc tuổi
        bạn khai lúc đăng ký{user?.age_band ? ` (${user.age_band})` : ''} — đang
        hiệu lực: <b>{TEN_GIONG[hieuLuc].ten}</b>.
      </p>
      {!user && <p className={s.chuThich}>Đăng nhập để đổi giọng.</p>}
      <div className={s.danhSach} role="radiogroup" aria-label="Giọng hồ sơ">
        {THU_TU.map((g) => {
          const dangChon = chon === g;
          // Xem trước bằng chính câu đọc vị của một thẻ thật — cùng nguồn chữ.
          const xemTruoc = THE_TINH_CACH.don_lanh[giongCua(user?.age_band, g)].doc_vi;
          return (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={dangChon}
              className={`${s.lua} ${dangChon ? s.luaChon : ''}`}
              disabled={!user || doi.isPending}
              onClick={() => { if (!dangChon) doi.mutate(g); }}
              data-testid={`giong-${g}`}
            >
              <span className={s.luaTen}>
                {dangChon ? '▣ ' : '▢ '}{TEN_GIONG[g].ten}
                <span className={s.luaGiai}> — {TEN_GIONG[g].giai}</span>
              </span>
              <span className={s.luaXemTruoc}>“{xemTruoc}”</span>
            </button>
          );
        })}
      </div>
      {doi.isError && (
        <p className={s.loi}>Chưa đổi được — {doi.error.message}</p>
      )}
      {doi.isSuccess && !doi.isPending && (
        <p className={s.chuThich}>Đã lưu. Thẻ ở trang Tài chính nói giọng mới ngay.</p>
      )}
    </div>
  );
}
