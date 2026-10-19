/**
 * "HÔM NAY BẠN VỪA CHẠM" — khối khoảnh khắc ở màn kết (founder 16/08, "vá lối
 * chơi" tầng 1). Nhận đúng thứ server trả (`autopsy.khoanh_khac`: ID + vòng +
 * delta_bp), tra tự điển client (`lib/khoanh_khac.ts`) rồi vẽ.
 *
 * ⚠ IM KHI RỖNG. Không có khoảnh khắc ⇒ trả `null`, không vẽ khung, không vẽ
 * dòng "chưa có gì": một khung trống ở màn kết đọc thành "trò bị lỗi", còn
 * một khung nói bừa thì người ta tin (D62). Server đã quyết "có gì đáng gọi
 * tên không"; client không tự bịa thêm từ dữ liệu khác.
 * ⚠ ID lạ (API mới hơn bundle) ⇒ bỏ qua mục đó, không nổ, không hiện ID thô.
 */
import { PixelIcon } from '@/components/ui';
import { ICON_KHOANH_KHAC, pctCuaBp, THE_KHOANH_KHAC } from '@/lib/khoanh_khac';
import type { KhoanhKhacId } from '@server/holdem/khoanh_khac_ids';
import s from './DaCham.module.css';

export interface DaChamProps {
  danhSach: readonly { id: string; vong: number; delta_bp: number }[] | undefined;
}

export function DaCham({ danhSach }: DaChamProps) {
  const muc = (danhSach ?? [])
    .filter((k): k is { id: KhoanhKhacId; vong: number; delta_bp: number } =>
      Object.prototype.hasOwnProperty.call(THE_KHOANH_KHAC, k.id));
  if (muc.length === 0) return null;
  return (
    <section className={s.khoi} aria-label="Hôm nay bạn vừa chạm">
      <div className={s.nhan}>HÔM NAY BẠN VỪA CHẠM</div>
      <ul className={s.danhSach}>
        {muc.map((k) => {
          const the = THE_KHOANH_KHAC[k.id];
          const am = k.delta_bp < 0;
          const pct = pctCuaBp(k.delta_bp);
          return (
            /*
             * ⭐ 24/08 — MỘT HÀNG ĐẦU MANG ĐỦ BỐN TIN, rồi mới tới chữ.
             * Founder: *"trực quan hóa bằng hình ảnh và các icon pixel, giảm
             * chữ xuống"*. Hàng đầu: [icon] TÊN · vòng · %. Bốn thứ đó liếc một
             * cái là đọc xong, không phải parse câu nào.
             *
             * ⚠ CÂU HỒI CỐ THU SAU `!`, KHÔNG PHẢI CÂU NGOÀI ĐỜI — và thứ tự ưu
             * tiên này là điểm chính:
             *   · `ngoai_doi` DẠY (khái niệm ngoài đời) — đó là toàn bộ lý do
             *     khối này tồn tại (D89 tầng 1: cây cầu duy nhất sang "ngoài
             *     đời" là GỌI TÊN, và một cái tên không kèm nghĩa thì không bắc
             *     được cầu nào). Giữ.
             *   · `hoi_co` KỂ LẠI ("Vòng 6: bạn đứng ở phía tin bịa… lấy −31,4%")
             *     — mà VÒNG và % nay đã nằm ngay trên hàng đầu, nên nó chủ yếu
             *     nói lại thứ vừa đọc. Thu vào.
             * Đổi ngược lại là bỏ phần dạy để giữ phần lặp.
             */
            <li key={k.id} className={s.muc}>
              <div className={s.dau}>
                <PixelIcon
                  name={ICON_KHOANH_KHAC[k.id]}
                  size={14}
                  className={s.icon}
                />
                <span className={s.ten}>{the.ten}</span>
                <span className={s.vong}>V{k.vong}</span>
                <span className={`${s.so} ${am ? s.soAm : s.soDuong}`}>{pct}</span>
              </div>
              <p className={s.ngoaiDoi}>{the.ngoai_doi}</p>
              {/*
                `<details>` thuần — cùng nếp SỔ CÁI DƯ ÂM và Bảng điện tử: nội
                dung vẫn nằm TRONG DOM khi đóng nên trình đọc màn hình vẫn với
                tới. Thu gọn mà làm rơi mất tin thì không phải thu gọn.
              */}
              <details className={s.giai}>
                <summary className={s.giaiNut} aria-label={`Chuyện gì đã xảy ra với ${the.ten}`}>!</summary>
                <p className={s.hoiCo}>{the.hoi_co({ vong: k.vong, pct, am })}</p>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
