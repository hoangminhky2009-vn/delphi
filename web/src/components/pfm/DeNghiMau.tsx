/**
 * ORACLE GIÚP 2/5 — **thấy một khoản lặp thì ĐỀ NGHỊ lưu thành mẫu một chạm** (D365).
 * Demo đã chốt (A11.25): `pfm-ngay-dau.html` màn `n3` — bong bóng Oracle + hai nút
 * `LƯU MẪU` / `KHÔNG`, trả lời xong thì thu thành MỘT DÒNG có nút `ĐỔI`.
 *
 * ⚠⚠ KHÔNG NGÕ CỤT (luật 1 của `yeu-cau-ky-thuat/11`, founder 20/09: *"bấm nhầm cái là
 * không chọn lại được"*). Trả lời xong, khoá vào danh sách "đã hỏi" và thẻ biến mất — nên
 * phải có đường về: dòng thu gọn giữ nút `ĐỔI`, bấm là gỡ khoá khỏi "đã hỏi" VÀ xoá mẫu
 * vừa tạo, thẻ hiện lại nguyên trạng.
 *
 * ⚠ P3 🔒 — mẫu chỉ ĐIỀN SẴN, không tự sinh khoản nào (xem chú thích `MauLap` ở `so.ts`).
 * ⚠ A10 🔒 — câu chữ chỉ TẢ ("trong sổ có N khoản giống nhau") + HỎI; không kê đơn.
 */
import { useMemo, useState } from 'react';
import type React from 'react';
import { CHU_GIUP, CHU_MAN_SO } from '@/lib/pfm_chu';
import { useGhiKho, useMauLap, useSoTatCa } from '@/pfm/dung_kho';
import {
  deNghiMauLap, ghiKhoaDaHoi, goKhoaDaHoi, khoaCuaMau, useKhoaDaHoiLap,
  type DeNghiMauLap as Loi,
} from '@/pfm/khoan_lap';
import type { MauLap } from '@/pfm/so';
import { bayGio, homNay, thangNay } from '@/pfm/thoi_gian';
import { BongOracle } from './BongOracle';
import s from './DeNghiMau.module.css';

/** Lượt trả lời VỪA XONG trong phiên này — chỉ để vẽ dòng thu gọn + đường `ĐỔI`. */
interface VuaTraLoi { khoa: string; luu: boolean; mauId: string | null }

export function DeNghiMau({ gon = false }: {
  /** D453 — bản MỘT HÀNG ở màn SỔ (số lần · khoản · câu hỏi · LƯU NÚT · ✕). Mặc định vẫn là bong bóng đầy đủ. */
  gon?: boolean;
} = {}): React.ReactElement | null {
  const ghi = useGhiKho();
  const { data: tatCa } = useSoTatCa();
  const { data: mau } = useMauLap();
  const { data: daHoi, dangTai } = useKhoaDaHoiLap();
  const [vua, datVua] = useState<VuaTraLoi | null>(null);

  const daCoMau = useMemo(
    () => new Set(mau.map((m) => khoaCuaMau(m)).filter((x): x is string => x !== null)),
    [mau],
  );
  const deNghi: Loi | null = useMemo(
    () => (dangTai ? null : deNghiMauLap({ so: tatCa, homNay: homNay(), daCoMau, daHoi })),
    [dangTai, tatCa, daCoMau, daHoi],
  );

  async function traLoi(d: Loi, luu: boolean): Promise<void> {
    const luc = bayGio();
    const mauId = luu ? `ml_${Date.now().toString(36)}` : null;
    await ghi(['mau_lap', 'nhip'], async (kho) => {
      if (mauId !== null) {
        const moi: MauLap = {
          id: mauId,
          // ⚠ `ten` của mẫu ĐI VÀO `ghiChu` của khoản (`tuMauLap`) — nên khoá của mẫu này
          //   khớp đúng khoá đã đếm ra nó, và `deNghiMauLap` thôi hỏi lại.
          ten: d.ghiChu ?? CHU_GIUP.lapTenTrong,
          soTien: d.soTien,
          chieu: 'chi',
          nhan: null,
          huId: null,
          taoLuc: luc,
        };
        await kho.ghi<MauLap>('mau_lap', { id: mauId, thang: thangNay(), suaLuc: luc, d: moi });
      }
      await ghiKhoaDaHoi(kho, d.khoa, luc);
    });
    datVua({ khoa: d.khoa, luu, mauId });
  }

  async function doiY(v: VuaTraLoi): Promise<void> {
    await ghi(['mau_lap', 'nhip'], async (kho) => {
      if (v.mauId !== null) await kho.xoa('mau_lap', v.mauId, bayGio());
      await goKhoaDaHoi(kho, v.khoa, bayGio());
    });
    datVua(null);
  }

  if (vua !== null) {
    return (
      <p className={s.gon} data-testid="lap-da-tra-loi">
        <span>{vua.luu ? CHU_GIUP.lapDaLuu : CHU_GIUP.lapDaThoi}</span>
        <button type="button" className={s.doi} onClick={() => void doiY(vua)}>
          {CHU_GIUP.lapDoi}
        </button>
      </p>
    );
  }
  /*
   * ⚠⚠ IM LẶNG VẪN PHẢI CÓ MỘT DẤU VẾT ĐO ĐƯỢC. Bản đầu trả thẳng `null`, và hai bài canh
   * "thẻ phải im" hoá ra RỖNG: lúc kho chưa nạp xong thì cũng không có gì trong DOM, nên
   * `waitFor(… toBeNull())` xanh ngay tức khắc mà chưa đo gì (tiêm mũi 16 · 17 đều không đỏ).
   * Một nhịp `aria-busy` cho bài canh chờ đúng mốc "đã nạp xong mà vẫn im".
   */
  if (deNghi === null) {
    return <span data-testid="lap-vung" aria-busy={dangTai ? 'true' : 'false'} hidden />;
  }

  if (gon) {
    return (
      <div className={s.gonHang} data-testid="lap-de-nghi">
        <span className={s.gonChu}>
          <b>{deNghi.lan}</b>{CHU_GIUP.lapGonLan}
          {deNghi.ghiChu === null ? '' : `“${deNghi.ghiChu}” `}
          {`${deNghi.soTien.toLocaleString('vi-VN')}${CHU_MAN_SO.hauDong}`} — {CHU_GIUP.lapGonHoi}
        </span>
        <button type="button" className={s.gonLuu} onClick={() => void traLoi(deNghi, true)}>
          {CHU_GIUP.lapLuuNgan}
        </button>
        <button type="button" className={s.gonThoi} aria-label={CHU_GIUP.lapThoi} onClick={() => void traLoi(deNghi, false)}>
          ✕
        </button>
      </div>
    );
  }
  return (
    <div className={s.khoi} data-testid="lap-de-nghi">
      <BongOracle
        nhan={CHU_GIUP.lapTen}
        loi={(
          <>
            {deNghi.nhip === 'thang' ? CHU_GIUP.lapThangPre : CHU_GIUP.lapDauPre}{' '}
            <b>{deNghi.lan}</b>{' '}
            {deNghi.nhip === 'thang' ? CHU_GIUP.lapThangGiua : CHU_GIUP.lapDauGiua}{' '}
            {deNghi.ghiChu === null
              ? `${deNghi.soTien.toLocaleString('vi-VN')}${CHU_MAN_SO.hauDong}`
              : `“${deNghi.ghiChu}” ${deNghi.soTien.toLocaleString('vi-VN')}${CHU_MAN_SO.hauDong}`}
            . {CHU_GIUP.lapDauHau}
          </>
        )}
      >
        <div className={s.nut}>
          <button type="button" className={s.chinh} onClick={() => void traLoi(deNghi, true)}>
            {CHU_GIUP.lapLuu}
          </button>
          <button type="button" onClick={() => void traLoi(deNghi, false)}>
            {CHU_GIUP.lapThoi}
          </button>
        </div>
        <p className={s.vi}>{CHU_GIUP.lapVi}</p>
      </BongOracle>
    </div>
  );
}
