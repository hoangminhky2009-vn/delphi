/**
 * B5 (SPEC va-bao-mat-chuan-hoa-api-dot-1, C8) — TẤM HỎI NĂM SINH cho khách / Discord trước trận đầu.
 *
 * Khác `Bac1NhanKhau` ở đúng một chỗ, và đó là cả thiết kế: tấm kia là câu HỎI (bỏ qua được), tấm này là CỔNG — máy chủ đóng mọi
 * cửa `requireOnboarded` (`chua_xac_nhan_tuoi`) tới khi `POST /me/tuoi` nhận một năm đủ tuổi. Nên không có nút BỎ QUA.
 *
 * Dùng lại nguyên khung + lớp CSS của `Bac1NhanKhau` (cùng lớp phủ, cùng ô năm sinh) — hai tấm cùng hỏi năm sinh thì phải trông
 * như một nhà. ⚠ C7: chỉ hỏi NĂM, máy chủ không lưu năm (chỉ ghi mốc "đã xác nhận").
 * Dưới tuổi ⇒ máy chủ trả 403 `duoi_tuoi`, câu của máy chủ hiện ngay dưới ô; gõ nhầm thì sửa rồi gửi lại.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import { NeonButton } from '@/components/ui';
import { Mascot } from '@/components/Mascot';
import s from './Bac1NhanKhau.module.css';

export function TamHoiTuoi() {
  const qc = useQueryClient();
  const [nam, setNam] = useState('');

  const gui = useMutation({
    mutationFn: () => api('/me/tuoi', { method: 'POST', body: { birth_year: Number(nam) } }),
    /*
     * ⚠ Làm mới MỌI truy vấn, không riêng `/me`: trước lúc xác nhận, các màn bên dưới đã nhận 403 `chua_xac_nhan_tuoi` (sảnh,
     * nhiệm vụ…). Chỉ làm mới `/me` thì tấm đóng mà màn dưới vẫn trắng tới lần tải lại.
     */
    onSuccess: async () => { await qc.invalidateQueries(); },
  });

  const loi = gui.error instanceof ApiError ? gui.error : null;
  const hopLe = /^\d{4}$/.test(nam);

  return (
    <div className={s.phu} role="dialog" aria-modal="true" aria-labelledby="tuoi-tieu-de">
      <div className={s.hop}>
        <div className={s.dau}>
          <Mascot size={28} />
          <div>
            <p className={s.tieuDe} id="tuoi-tieu-de">BẠN SINH NĂM NÀO?</p>
            <p className={s.phuDe}>Một câu trước trận đầu — app dành cho người từ 16 tuổi.</p>
          </div>
        </div>

        <label className={s.oNam}>
          <span className={s.nhan}>NĂM SINH</span>
          <input
            className={s.nhap}
            inputMode="numeric"
            maxLength={4}
            placeholder="2009"
            value={nam}
            onChange={(e) => setNam(e.target.value.replace(/\D/g, '').slice(0, 4))}
            aria-invalid={loi ? true : undefined}
          />
          <span className={s.ghiChu}>Không lưu năm sinh — chỉ ghi là bạn đã xác nhận.</span>
        </label>

        {loi && <p className={s.loi} role="alert">✕ {loi.message}</p>}

        <div className={s.nut}>
          <NeonButton block disabled={!hopLe || gui.isPending} onClick={() => gui.mutate()}>
            {gui.isPending ? 'ĐANG GỬI…' : 'XÁC NHẬN'}
          </NeonButton>
        </div>
      </div>
    </div>
  );
}
