/**
 * DẢI HÀNG CHỜ SUẤT TRẬN (SPEC `docs/spec/tran-tran-ngay.md` mục 1 + 4).
 *
 * Khác `HangCho` (cổng vào app, phủ ĐẶC toàn màn vì sau lưng chưa có dữ liệu): ở đây app vẫn sống, chỉ việc TẠO TRẬN phải chờ
 * hạn mức ⇒ một dải nổi nhỏ, KHÔNG che Hub/Hồ sơ — người chơi được lướt app trong lúc chờ. Đứng trên phòng chờ trận (z 66) để
 * người vừa bấm TÌM TRẬN thấy ngay vì sao bàn chưa dựng.
 *
 * NÓI THẬT (cùng luật `HangCho`): luôn có số thứ tự + giờ dự kiến khi cổng biết; hết suất ngày thì nói "mở lại 0:00", không
 * phải một lỗi đỏ. "Máy chủ vẫn khoẻ" là sự thật — ta xếp hàng để GIỮ hạn mức, không phải vì sập.
 *
 * Lời hứa "tới lượt app tự đưa vào trận" có mã đứng sau: vòng hỏi lại ở `api/suatTran.ts` + nhánh TRẬN MỒ CÔI dưới đây (màn gốc
 * đã đóng khi tới lượt ⇒ dải này điều hướng). Không có hoạt ảnh mới (§2 luật 2): dải đứng yên, chỉ số đổi.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ngheSuatTran, roiHangSuat, trangThaiSuat, tranMoCoi, xongTranMoCoi,
} from '@/api/suatTran';
import { duongDanTran } from '@/lib/vocab';
import { nhoTranTap } from '@/lib/man_tap_dau';
import { formatGio } from '@/lib/time';
import s from './HangChoSuatTran.module.css';

export function HangChoSuatTran() {
  const t = useSyncExternalStore(ngheSuatTran, trangThaiSuat);
  const moCoi = useSyncExternalStore(ngheSuatTran, tranMoCoi);
  const navigate = useNavigate();
  /*
   * THU NHỎ (founder 12/10: *"có cho thu nhỏ được không"*) — hàng chờ có thể dài cả giờ, dải đầy che nửa trên Hub. Thu thành
   * một viên nhỏ vẫn còn số thứ tự + giờ (thứ người chờ thật sự cần), chạm là mở lại. Giữ ở state của AppShell (sống qua mọi
   * màn) — đổi màn không bung lại; hàng chờ mới không ép mở vì người đã thu là đã chọn.
   */
  const [thuNho, setThuNho] = useState(false);

  useEffect(() => {
    if (!moCoi) return;
    if (moCoi.tap) nhoTranTap(moCoi.matchId);
    xongTranMoCoi();
    navigate(`${duongDanTran(moCoi.matchId)}${moCoi.tap ? '?tap=1' : ''}`);
  }, [moCoi, navigate]);

  if (!t) return null;

  const sapToi = !t.het_ngay && (t.du_kien === null || t.du_kien <= Date.now());

  const gioNgan = t.het_ngay ? '0:00' : sapToi ? 'SẮP TỚI' : formatGio(new Date(t.du_kien!).toISOString());

  if (thuNho) {
    return (
      <button
        type="button" className={s.vien} onClick={() => setThuNho(false)}
        aria-label="Mở hàng chờ suất trận" data-testid="hang-cho-suat-vien"
      >
        <span className={s.vienNhan}>{t.het_ngay ? 'HẾT SUẤT' : 'CHỜ TRẬN'}</span>
        {t.vi_tri !== null && <b className={s.vienSo}>#{t.vi_tri}</b>}
        <span className={s.vienGio}>{t.het_ngay ? `MỞ ${gioNgan}` : gioNgan}</span>
        <span aria-hidden>▾</span>
      </button>
    );
  }

  return (
    <div className={s.dai} role="status" aria-live="polite" data-testid="hang-cho-suat-tran">
      <div className={s.hangDau}>
        <div className={s.dau}>
          {t.het_ngay ? 'HẾT SUẤT TRẬN HÔM NAY' : 'HÀNG CHỜ SUẤT TRẬN'}
        </div>
        <button type="button" className={s.thuNho} onClick={() => setThuNho(true)} data-testid="hang-cho-suat-thu-nho">
          THU NHỎ ▴
        </button>
      </div>

      <div className={s.than}>
        {t.vi_tri !== null && (
          <div className={s.oSo}>
            <span className={s.nhanSo}>BẠN THỨ</span>
            <span className={s.so}>{t.vi_tri}</span>
            {t.tong !== null && <span className={s.tong}>/ {t.tong}</span>}
          </div>
        )}
        <div className={s.gio} data-testid="hang-cho-suat-gio">
          {t.het_ngay
            ? <>MỞ LẠI LÚC <b>0:00</b></>
            : sapToi
              ? <b>SẮP TỚI LƯỢT</b>
              : <>DỰ KIẾN <b>{gioNgan}</b></>}
        </div>
      </div>

      <p className={s.ghiChu}>
        {/* Câu hết-suất do founder viết nguyên văn (12/10). */}
        {t.het_ngay
          ? 'Admin không có tiền host server xịn. Mong mọi người thông cảm (〒﹏〒) Còn không thông cảm thì donate 😈'
          : 'App có hạn mức trận mỗi giờ để máy chủ không bị khoá. Tới lượt, app tự đưa bạn vào trận — cứ lướt app.'}
      </p>

      <button type="button" className={s.roi} onClick={roiHangSuat} data-testid="hang-cho-suat-roi">
        RỜI HÀNG
      </button>
    </div>
  );
}
