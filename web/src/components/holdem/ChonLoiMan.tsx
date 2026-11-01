/**
 * D609 (founder 13/10: "chọn lõi là bắt buộc … màn hình tự hiện, đừng để người chơi bấm chốt vòng rồi móm") — HỘP "LÕI CHO MÀN".
 *
 * Vòng có màn minigame mà ghế cầm ≥ 2 lõi ⇒ phải nói lõi nào vào màn. Trước đây chỉ có một chip nhỏ ở hàng công cụ (khoá v65, D561) — người chơi không
 * thấy, màn chạy bằng lõi mặc định. Nay hộp này hiện khi bấm CHỐT VÒNG và tự nổi lên ở 8 giây cuối của vòng; bấm một lá là chọn VÀ chốt luôn.
 * Không chọn gì tới hết giờ thì server dùng lõi mặc định (`laCuaMan`: Bắt Đáy nếu cầm, không thì lõi đầu) — một nguồn, không đoán ở client.
 */
import { LOI_MINIGAME_CHU } from '@/lib/khung_minigame';
import { htmlTinh } from '@/lib/html_tinh';
import type { ChienThuatId } from '@config/holdem';
import s from './ChonLoiMan.module.css';

interface Props {
  /** Lõi đang cầm (+ lõi vừa chọn mua) — thứ tự như chip cũ. */
  ds: readonly string[];
  /** Lõi mặc định nếu không chọn (server cũng chốt đúng lõi này). */
  macDinh: string | null;
  /** Tranh có sẵn của app (khoá = id lõi). */
  art: Readonly<Record<string, string>>;
  /** Tên lõi theo catalog (dự phòng khi `LOI_MINIGAME_CHU` không có). */
  ten: (id: string) => string;
  /** Giây còn lại của vòng — chỉ để nhắc; hộp không tự đóng. */
  conGiay?: number;
  dangGui?: boolean;
  onChon: (id: string) => void;
  onDong: () => void;
}

export function ChonLoiMan({ ds, macDinh, art, ten, conGiay, dangGui = false, onChon, onDong }: Props) {
  return (
    <div className={s.nen} role="dialog" aria-modal="true" aria-label="Chọn lõi cho màn minigame" data-khoi="chon-loi-man">
      <div className={s.khung}>
        <div className={s.dau}>
          <span className={s.tieuDe}>LÕI CHO MÀN</span>
          {conGiay !== undefined && conGiay >= 0 && <span className={s.giay}>{conGiay}s</span>}
        </div>
        <p className={s.phu}>Chọn một lõi để chơi màn vòng này. Không chọn thì dùng lõi có dấu MẶC ĐỊNH.</p>
        <div className={s.luoi}>
          {ds.map((id) => {
            const l = LOI_MINIGAME_CHU[id as ChienThuatId];
            return (
              <button key={id} type="button" className={`${s.la} ${id === macDinh ? s.macDinh : ''}`} disabled={dangGui}
                aria-label={`Chọn lõi ${l?.ten ?? ten(id)} cho màn`} data-loi={id} onClick={() => onChon(id)}>
                {id === macDinh && <span className={s.nhan}>MẶC ĐỊNH</span>}
                {/* eslint-disable-next-line react/no-danger -- SVG hằng số trong repo, xem GameCard */}
                <span className={s.icon} aria-hidden dangerouslySetInnerHTML={htmlTinh(art[id] ?? '')} />
                <span className={s.ten}>{l?.ten ?? ten(id)}</span>
                <span className={s.mt}>{l?.mt ?? ''}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className={s.dong} disabled={dangGui} onClick={onDong}>ĐỂ SAU</button>
      </div>
    </div>
  );
}
