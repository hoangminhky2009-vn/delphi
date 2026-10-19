/**
 * BẢNG ✉ BÁO LỖI trong Hồ sơ (SPEC `docs/spec/bao-loi-nguoi-choi.md` — nguồn của phần Báo lỗi; dựng đầu ở SPEC chan-truoc-beta).
 *
 * Chữ là T10 founder duyệt nguyên văn (`web/src/content/baoLoi.ts`). Gửi: chữ người chơi gõ + email nếu tự điền + đúng các thứ ở
 * dòng "Gửi kèm" — dòng ấy và gói gửi cùng dựng từ `TRUONG_GUI_KEM` + `giaTriGuiKem()` (A11.5), nên chữ không thể nói khác hành vi.
 * Trần 1.000 ký tự và 3 lượt/ngày do máy chủ giữ (`server/du_lieu_cua_toi.ts`); lượt thứ tư ⇒ chữ "hết lượt", ô GIỮ nội dung.
 * Không có nút "Báo lỗi này" trên màn lỗi (SPEC mục 3 — Ý chờ). KHÔNG nút nổi đè HUD trận.
 */
import { useState } from 'react';
import { BAO_LOI, TRUONG_GUI_KEM } from '@config/bao_loi';
import { ApiError } from '@/api/client';
import { giaTriGuiKem, guiBaoLoi, type GiaTriGuiKem } from '@/api/du_lieu';
import { CHU_BAO_LOI as C } from '@/content/baoLoi';
import { TamTruot } from '@/components/ui/TamTruot';
import s from './TamDuLieu.module.css';

/** Dòng "Gửi kèm:" — từng mục theo `TRUONG_GUI_KEM`; `tai_khoan` chỉ có nhãn (máy chủ lấy từ phiên, không có giá trị ở máy). */
export function dongGuiKem(kem: GiaTriGuiKem): string[] {
  return TRUONG_GUI_KEM.map((k) => (k === 'tai_khoan' ? C.kem[k] : `${C.kem[k]} ${kem[k] ?? C.khongCo}`));
}

export function TamBaoLoi({ mo, onDong }: { mo: boolean; onDong: () => void }): React.ReactElement | null {
  const [chu, datChu] = useState('');
  const [email, datEmail] = useState('');
  const [trangThai, datTrangThai] = useState<'nhap' | 'gui' | 'xong'>('nhap');
  const [loi, datLoi] = useState<string | null>(null);
  // Chụp MỘT lần lúc vẽ: thứ người chơi thấy ở dòng "Gửi kèm" là đúng thứ được gửi.
  const kem = giaTriGuiKem();
  const gui = async (): Promise<void> => {
    datTrangThai('gui');
    datLoi(null);
    try {
      await guiBaoLoi(chu.trim(), email, kem);
      datChu('');
      datEmail('');
      datTrangThai('xong');
    } catch (e) {
      // Hết lượt / mất mạng: ô GIỮ nguyên chữ người chơi đã gõ.
      datLoi(e instanceof ApiError && e.status === 429 ? C.hetLuot : C.loiGui);
      datTrangThai('nhap');
    }
  };
  return (
    <TamTruot
      mo={mo}
      onDong={() => { onDong(); datLoi(null); if (trangThai === 'xong') datTrangThai('nhap'); }}
      nhan={C.nut}
      dau="bao-loi"
      chan={(
        <button
          type="button"
          className={s.nut}
          disabled={trangThai === 'gui' || chu.trim().length === 0}
          onClick={() => { void gui(); }}
          data-nut="gui-bao-loi"
        >
          {trangThai === 'gui' ? C.dangGui : C.gui}
        </button>
      )}
    >
      <h2 className={s.dau}>{C.nut}</h2>
      <label className={s.nhom}>
        <span className={s.nhomTen}>{C.nhanO}</span>
        <textarea
          className={s.oNhap}
          value={chu}
          maxLength={BAO_LOI.DO_DAI_TOI_DA}
          placeholder={C.goiY}
          onChange={(e) => { datChu(e.target.value); if (trangThai === 'xong') datTrangThai('nhap'); }}
          data-o="noi-dung-bao-loi"
        />
      </label>
      <label className={s.nhom}>
        <span className={s.nhomTen}>{C.nhanEmail}</span>
        <input
          className={s.oMotDong}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          maxLength={BAO_LOI.EMAIL_TOI_DA}
          onChange={(e) => datEmail(e.target.value)}
          data-o="email-bao-loi"
        />
      </label>
      <p className={s.phu} data-dong="gui-kem"><b>{C.guiKem}</b> {dongGuiKem(kem).join(' · ')}</p>
      <p className={s.phu}>{C.dongCuoi}</p>
      {trangThai === 'xong' && <p className={s.tot} role="status"><b>{C.daGuiDam}</b> {C.daGuiThan}</p>}
      {loi && <p className={s.loi} role="alert">{loi}</p>}
    </TamTruot>
  );
}
