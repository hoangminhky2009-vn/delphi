/**
 * CHỌN LÁ TẶNG — hai lá cạnh nhau, KHÔNG lá nào được chọn sẵn.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VÌ SAO "KHÔNG CHỌN SẴN" LÀ MỘT YÊU CẦU DỮ LIỆU, KHÔNG PHẢI GU THIẾT KẾ.
 *
 * Nếu onboard chọn giùm một lá thì phân bố thu về là phân bố của CÁI MẶC ĐỊNH chứ
 * không phải của GU — và cả ba phép đo dựng trên `avatar_chon` mất nghĩa. Giá phải
 * trả là thêm một nhịp trong onboard; đổi lại là một cột revealed-preference sạch
 * cho 100% người dùng. Đây là món rẻ nhất trong cả tầng diện mạo.
 *
 * `msCanNhac` = thời gian từ lúc bảng hiện tới lúc chạm lá đầu tiên. Nó tách "chọn
 * thật" khỏi "bấm cho xong" — không có nó thì mọi lượt chọn trông giống hệt nhau
 * trong dữ liệu. Đo Ở ĐÂY vì đây là nơi duy nhất biết bảng hiện lúc nào.
 *
 * ⚠ CHỈ HIỆN `NEN_TANG` (D36: hai lá). Áo trùm đầu là HÀNG BÁN bản Beta Access —
 * hiện nó ở đây là mời người ta chọn một món rồi báo không được, và tệ hơn: nếu ai
 * đó nối dây ẩu thì nó thành món phát không.
 */
import { useEffect, useRef } from 'react';
import { NEN_TANG, vietDienMao } from '@config/avatar';
import { Avatar } from './Avatar';
import s from './Avatar.module.css';

interface Props {
  /** `null` = CHƯA CHỌN. Không được mặc định thành 'A' ở phía trên. */
  giaTri: string | null;
  onChon: (ma: string, msCanNhac: number) => void;
  size?: 32 | 64;
}

export function AvatarChon({ giaTri, onChon, size = 64 }: Props) {
  const moLuc = useRef<number>(0);
  useEffect(() => { moLuc.current = Date.now(); }, []);

  return (
    <div className={s.chon} role="radiogroup" aria-label="Chọn ảnh đại diện">
      {NEN_TANG.map((g) => {
        const dang = giaTri === g.ma;
        return (
          <button
            key={g.ma}
            type="button"
            role="radio"
            aria-checked={dang}
            className={`${s.the} ${dang ? s.theChon : ''}`}
            onClick={() => onChon(g.ma, Math.max(0, Date.now() - moLuc.current))}
          >
            {/*
              Lá nền TRẦN — không khung, không nhãn dán. Thứ đang chọn là KHUÔN MẶT;
              trộn trang trí vào là hỏi hai câu trong một ô.
            */}
            <Avatar dm={vietDienMao({ goc: g.ma })} size={size} alt={g.ten} />
            <span className={s.tenLa}>{g.ten}</span>
            <span className={s.moTa}>{g.mo_ta}</span>
          </button>
        );
      })}
    </div>
  );
}
