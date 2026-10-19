/**
 * VĂN BẢN ĐỒNG Ý NGHIÊN CỨU — năm vế + số bản, MỘT component cho mọi chỗ người dùng bật ô này (Hồ sơ · tấm hỏi lại · màn nhắc
 * xếp hạng · onboarding). Vết ghi (nghien_cuu, phiên bản) ⇒ màn phải hiện ĐÚNG chữ của phiên bản ấy, nên chữ chỉ đến từ
 * `VAN_BAN_NGHIEN_CUU` và số bản chỉ đến từ `CONSENT_PHIEN_BAN` (A11.5).
 */
import { CONSENT_PHIEN_BAN } from '@config/pfm_consent';
import { CHU_NGHIEN_CUU, VAN_BAN_NGHIEN_CUU } from '@/lib/nghien_cuu_chu';
import s from './TamDuLieu.module.css';

export function VanBanNghienCuu(): React.ReactElement {
  const v = VAN_BAN_NGHIEN_CUU;
  return (
    <div className={s.vanBan} data-van-ban="nghien_cuu" data-phien-ban={CONSENT_PHIEN_BAN.nghien_cuu}>
      <span className={s.vanBanTen}>{v.tieuDe} · {CHU_NGHIEN_CUU.ban} {CONSENT_PHIEN_BAN.nghien_cuu}</span>
      <p>{v.tomTat}</p>
      <p>{v.roiMay}</p>
      <p>{v.mayChuKhongDoc}</p>
      <p>{v.chot}</p>
    </div>
  );
}
