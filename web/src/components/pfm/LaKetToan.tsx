/**
 * KẾT TOÁN LẬT LÁ (tệp 15 lát 1, bản 2) — lá vị thế hai mặt: MẶT = điều đã đặt (mức · kỳ hạn · độ chắc), LƯNG = kết
 * quả. Lá lật 180° ngay khi câu khai sự việc vừa có (nấc "tới đâu" · "có tác dụng không"), rồi hạt pixel phụt đúng
 * lúc mặt sau hiện ra — khoảnh khắc "lật bài" của game thẻ, dùng lại `hat_pixel.ts` (không hiệu ứng mới).
 *
 * ⭐ MỘT KHUÔN cho hai chỗ kết toán: hộp quyết toán sớm ở màn HŨ (`QuyetToanHop`) và thẻ NHÌN LẠI ở GƯƠNG
 *   (`TheCuoiKy`). Bố cục hai mặt nằm Ở ĐÂY (kể cả CSS), chỗ gọi chỉ đưa CHỮ + SỐ — hai bản bố cục là hai lá
 *   trông khác nhau cho cùng một khoảnh khắc (A11.5).
 * ⚠ Chữ đến từ chỗ gọi (`lib/pfm_chu.ts`, D26); riêng chip độ chắc dùng `CHU_VI_THE.chacPre` để hai chỗ không lệch.
 * ⚠ Không màu đỏ-xanh cho kết quả (A10): TỚI và CHƯA TỚI cùng một màu, khác nhau ở CHỮ.
 * ⚠ Chỉ animate `transform` (luật ba runtime), nhịp `--nhip-lat-la` (`lib/nhip.ts`). Giảm chuyển động ⇒ đổi mặt tức
 *   thì — mặt sau vẫn hiện đủ chữ, chỉ mất cú lật (D116: tắt cái nháy, giữ cái tin); `phutHat` tự im ở chế độ ấy.
 * ⚠ Hai mặt xếp CHỒNG trong MỘT ô lưới, không `position:absolute` ⇒ lá cao bằng mặt cao hơn, bố cục không nhảy lúc lật.
 * ⚠ Hạt dọn bằng đồng hồ (`hat_pixel.ts`), lá không chờ `transitionend` cho bất kỳ trạng thái nào.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { NHIP } from '@/lib/nhip';
import { phutHat, tamPhanTu } from '@/lib/hat_pixel';
import { CHU_VI_THE } from '@/lib/pfm_chu';
import s from './LaKetToan.module.css';

export function LaKetToan({ nhan, lat, dieu, chac, phu, ket, khai, dem }: {
  /** Dòng đầu lá — "KẾT TOÁN · LAPTOP CŨ". Có ở cả hai mặt. */
  nhan: string;
  /** `true` = đã có câu khai sự việc ⇒ lá nằm ngửa mặt KẾT QUẢ. */
  lat: boolean;
  /** Mặt trước — điều đã đặt, một dòng (`<b>` = con số, tô vàng). */
  dieu: ReactNode;
  /** Độ chắc đã nêu, %. */
  chac: number;
  /** Dòng phụ mặt trước (qua app đã góp… · vì sao đã ghi). */
  phu?: ReactNode;
  /** Chữ kết quả mặt sau — `null` khi lá chưa lật. */
  ket: string | null;
  /** Dòng phụ mặt sau — câu khai / nhịp app tự đếm. */
  khai?: ReactNode;
  /** Dòng độ khớp — "Chắc 70%: 2 vị thế, tới 1". */
  dem?: ReactNode;
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const truoc = useRef(lat);
  useEffect(() => {
    const vuaLat = lat && !truoc.current;
    truoc.current = lat;
    if (!vuaLat) return undefined;
    const hen = setTimeout(() => phutHat(tamPhanTu(ref.current), 'var(--gold)', 14), NHIP.PFM_LAT_LA / 2);
    return () => clearTimeout(hen);
  }, [lat]);

  return (
    <div className={s.la} ref={ref} data-testid="la-ket-toan" data-lat={lat ? 'co' : 'khong'}>
      <div className={`${s.than} ${lat ? s.lat : ''}`}>
        <div className={s.mat} aria-hidden={lat}>
          <span className={s.nhan}>{nhan}</span>
          <p className={s.dieu}>
            {dieu}
            <span className={s.chac}>{`${CHU_VI_THE.chacPre}${chac}%`}</span>
          </p>
          {phu ? <p className={s.phu}>{phu}</p> : null}
        </div>
        <div className={s.lung} aria-hidden={!lat}>
          <span className={s.nhan}>{nhan}</span>
          {ket !== null && <b className={s.ket} data-testid="ket-la">{ket}</b>}
          {khai ? <p className={s.phu}>{khai}</p> : null}
          {dem ? <p className={s.dem}>{dem}</p> : null}
        </div>
      </div>
    </div>
  );
}
