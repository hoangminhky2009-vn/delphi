/**
 * TẤM HỎI LẠI ĐỒNG Ý (SPEC chan-truoc-beta; founder 11/10: người đang bật nghiên cứu khi lên v1 ⇒ HỎI LẠI MỘT LẦN, chưa trả lời = TẮT).
 *
 * Hiện khi `/auth/me` báo `hoi_lai_nghien_cuu` — máy chủ quyết, không phải client (C4): cột bật mà số bản không phải bản hiện hành.
 * Trả lời ĐỒNG Ý hay KHÔNG đều là một câu trả lời, và cả hai đều để lại vết ⇒ máy chủ hết báo ⇒ tấm không hiện nữa.
 * ĐÓNG (vuốt · chạm nền · nút) = chưa trả lời: trong phiên này không hỏi nữa (đỡ phiền), lần mở app sau hỏi lại; giữa chừng máy chủ
 * vẫn coi như TẮT. ⚠ Lớp trình bày — cổng thật ở `server/nghien_cuu.ts`.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queries';
import { datNghienCuu } from '@/api/du_lieu';
import { CHU_NGHIEN_CUU } from '@/lib/nghien_cuu_chu';
import { TamTruot } from '@/components/ui/TamTruot';
import { VanBanNghienCuu } from './VanBanNghienCuu';
import s from './TamDuLieu.module.css';

const KHOA_DA_HOAN = 'delphi.hoi_lai_nghien_cuu.hoan';

function daHoanTrongPhien(): boolean {
  try { return sessionStorage.getItem(KHOA_DA_HOAN) === '1'; } catch { return false; }
}

export function HoiLaiNghienCuu(): React.ReactElement | null {
  const qc = useQueryClient();
  const [mo, datMo] = useState(() => !daHoanTrongPhien());
  const tra = useMutation({
    mutationFn: (bat: boolean) => datNghienCuu(bat),
    onSuccess: () => { datMo(false); void qc.invalidateQueries({ queryKey: queryKeys.me }); },
  });
  const hoan = (): void => {
    try { sessionStorage.setItem(KHOA_DA_HOAN, '1'); } catch { /* chế độ riêng tư: hỏi lại ở lần render sau, không sao */ }
    datMo(false);
  };
  return (
    <TamTruot
      mo={mo}
      onDong={hoan}
      nhan={CHU_NGHIEN_CUU.hoiLaiTieuDe}
      dau="hoi-lai-nghien-cuu"
      chan={(
        <>
          <button type="button" className={s.nut} disabled={tra.isPending} onClick={() => tra.mutate(true)} data-nut="dong-y">
            {tra.isPending && tra.variables === true ? CHU_NGHIEN_CUU.dangLuu : CHU_NGHIEN_CUU.dongY}
          </button>
          <button type="button" className={s.nut} disabled={tra.isPending} onClick={() => tra.mutate(false)} data-nut="khong">
            {tra.isPending && tra.variables === false ? CHU_NGHIEN_CUU.dangLuu : CHU_NGHIEN_CUU.khong}
          </button>
        </>
      )}
    >
      <h2 className={s.dau}>{CHU_NGHIEN_CUU.hoiLaiTieuDe}</h2>
      <p className={s.mo}>{CHU_NGHIEN_CUU.hoiLaiMo}</p>
      <VanBanNghienCuu />
      <Link className={s.lienKet} to="/dieu-khoan" onClick={hoan}>{CHU_NGHIEN_CUU.docDieuKhoan}</Link>
      {tra.isError && <p className={s.loi} role="alert">{CHU_NGHIEN_CUU.loiLuu}</p>}
    </TamTruot>
  );
}
