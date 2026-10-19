/**
 * DẢI "GHI VÀO THẺ" — đáy khối PHONG CÁCH CẢ TRẬN ở màn kết. Thay HAI khối rời trước đây:
 * "NĂNG LỰC TRÊN ĐỀ NÀY" (D323) và "HÔM NAY BẠN VỪA CHẠM" (16/08).
 *
 * ⚠⚠ Founder 13/09: *"phong cách cá nhân phải là nổi bật nhất để flex"* + *"chia ra nhiều quá thì
 * thừa thãi và rối"*. Đo trước lượt gộp (màn 375px): khối năng lực 469px cao GẤP ĐÔI khối phong cách
 * 219px, và ba khối xếp chồng dùng ba kiểu nền. Nên dải này đứng DƯỚI hạng, NHỎ hơn hạng, trong CÙNG
 * khung — nó kể trận này ghi gì vào thẻ, không phải bảng điểm thứ hai.
 *
 * Nội dung, theo thứ tự: ba dấu kỹ năng của trận (cùng hình với mặt THẺ) · khái niệm vừa chạm (khối
 * `DaCham`, giữ nguyên câu NGOÀI ĐỜI nhìn thấy — đó là phần dạy).
 * ⚠ Im khi không có gì để ghi: API cũ chưa có `nang_luc`, trận không khoảnh khắc.
 * ⚠ D392 — GỠ dòng "MÃ THAM GIA · ghi mã này lên bài giấy": bài giấy đã thay bằng ba Google Form mà app
 *   TỰ ĐIỀN mã buổi đo (dải tester, D370). Dòng này là mã thứ HAI cùng dạng 4 ký tự in to ở màn kết — chép
 *   nhầm nó vào ô MÃ BUỔI ĐO của phiếu thì phiếu vẫn nhận, và số của người ấy ghép sai im lặng.
 */
import { Link } from 'react-router-dom';
import type { NangLucId } from '@config/nang_luc';
import type { TheNangLucTranDTO } from '@server/holdem/nang_luc_ids';
import { ChiTietTran, HangKyNang, laIdKyNang } from '@/components/HangKyNang';
import { CHU_NANG_LUC as C } from '@/lib/nang_luc';
import { THE_KHOANH_KHAC } from '@/lib/khoanh_khac';
import { ROUTE_PROFILE_THE } from '@/lib/vocab';
import { DaCham, type DaChamProps } from './DaCham';
import s from './GhiVaoThe.module.css';

export interface GhiVaoTheProps {
  the: TheNangLucTranDTO | undefined;
  khoanhKhac: DaChamProps['danhSach'];
  /** Không có khối PHONG CÁCH để nằm trong (API cũ) ⇒ tự mang khung. */
  rieng?: boolean;
}

export function GhiVaoThe({ the, khoanhKhac, rieng }: GhiVaoTheProps): React.ReactElement | null {
  const muc = (the?.nang_luc ?? []).filter((n): n is typeof n & { id: NangLucId } => laIdKyNang(n.id));
  const coKhoanh = (khoanhKhac ?? []).some((k) =>
    Object.prototype.hasOwnProperty.call(THE_KHOANH_KHAC, k.id));
  if (muc.length === 0 && !coKhoanh) return null;
  const tap = the !== undefined && !the.tinh_vao_the && the.ly_do_khong_tinh === 'man_tap';

  return (
    <div className={rieng ? `${s.dai} ${s.rieng}` : s.dai} data-testid="ghi-vao-the">
      {muc.length > 0 && (
        <>
          <div className={s.dauDai}>
            <span className={tap ? `${s.nhan} ${s.nhanTap}` : s.nhan}>{tap ? C.banTap : C.ghiVaoThe}</span>
            {/* 21/09 — thẻ ĐO TỪ TRẬN về ở với hồ sơ; link sau trận nói về THẺ GAME nên đi theo nó,
                không về `/tai-chinh/the` (nay là chân dung PFM, dựng từ lời khai). */}
            <Link to={ROUTE_PROFILE_THE} className={s.lienKet}>{C.xemThe}</Link>
          </div>
          <HangKyNang muc={muc.map((n) => ({ id: n.id, bac: n.bac, chiTiet: <ChiTietTran n={n} /> }))} />
        </>
      )}
      {coKhoanh && <DaCham danhSach={khoanhKhac} />}
    </div>
  );
}
