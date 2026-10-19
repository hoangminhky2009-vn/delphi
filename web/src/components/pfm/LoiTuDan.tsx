/**
 * ORACLE GIÚP 3/5 — **lúc tiền vừa về, đọc lại LỜI TỰ DẶN của chính người dùng** (D365).
 * Demo đã chốt (A11.25): `pfm-ngay-dau.html` màn `n5` — *"Tiền vừa về — đúng lúc bạn nói
 * mình dễ tiêu quá tay. Tôi chỉ đọc lại lời bạn:"* + khối hũ có lối góp sẵn.
 *
 * ⚠⚠ ORACLE KHÔNG NÓI GÌ CỦA RIÊNG NÓ Ở ĐÂY. Câu duy nhất có nội dung là `luat.loiNhac` —
 * chữ của chính người dùng, hiện lại nguyên văn. Đó là cả điểm của bậc 3 thang can thiệp:
 * *"Bạn viết, Oracle chỉ nhắc lại đúng lời bạn khi điều kiện đó xảy ra."*
 * ⚠ A10 🔒 — không thêm một lời khuyên nào quanh nó; không chấm "đã giữ hay chưa" (thẻ
 * đánh dấu giữ/vỡ là việc của màn GƯƠNG, và nó cố ý không thưởng không phạt).
 * ⚠ P3 🔒 — nút góp hũ chỉ MỞ màn hũ; app không điền một con số tiền nào.
 *
 * Tự im khi: không có luật `tien_vua_ve` nào đang BẬT · hôm nay không nằm trong cửa sổ
 * "tiền vừa về" (`danhGiaDieuKien` trả `false`/`null` — P7: thiếu mẫu thì im, không đoán).
 */
import { useMemo } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { CHU_GIUP } from '@/lib/pfm_chu';
import { ROUTE_TAI_CHINH_HU } from '@/lib/vocab';
import { useHu, useLuat, useSoTatCa } from '@/pfm/dung_kho';
import { danhGiaDieuKien, type Luat } from '@/pfm/luat';
import { laTichLuy, tienDo } from '@/pfm/hu';
import { tongGopVaoHu } from '@/pfm/so';
import { homNay } from '@/pfm/thoi_gian';
import { BongOracle } from './BongOracle';
import s from './LoiTuDan.module.css';

/**
 * Luật ĐANG BẬT, điều kiện `tien_vua_ve`, và hôm nay điều kiện ấy ĐÚNG.
 * ⚠ Nhiều luật cùng đúng ⇒ lấy luật TẠO SỚM NHẤT: lời dặn cũ hơn là lời người dùng đã sống
 *   với nó lâu hơn. Tất định, không phụ thuộc thứ tự mảng.
 */
export function luatDangVang(ds: readonly Luat[], so: Parameters<typeof danhGiaDieuKien>[1], nay: string): Luat | null {
  const hop = ds
    .filter((l) => l.trangThai === 'bat' && l.dieuKien === 'tien_vua_ve')
    .filter((l) => danhGiaDieuKien(l, so, nay).dung === true)
    .sort((a, b) => a.taoLuc.localeCompare(b.taoLuc) || a.id.localeCompare(b.id));
  return hop[0] ?? null;
}

export function LoiTuDan({ gon = false }: {
  /**
   * D453 — bản MỘT HÀNG ở màn SỔ: nhãn · lời tự dặn NGUYÊN VĂN · MỞ HŨ. Bong bóng đầy đủ (hũ gợi ý + câu ranh) vẫn là bản
   * mặc định; SỔ là mặt ghi nhanh nên nó chỉ nhận đúng một hàng.
   */
  gon?: boolean;
} = {}): React.ReactElement | null {
  const navigate = useNavigate();
  const { data: luat, dangTai: taiLuat } = useLuat();
  const { data: so, dangTai: taiSo } = useSoTatCa();
  const { data: hu } = useHu();

  const nay = homNay();
  const l = useMemo(
    () => (taiLuat || taiSo ? null : luatDangVang(luat, so, nay)),
    [taiLuat, taiSo, luat, so, nay],
  );

  /** Hũ để đặt ra trước mặt: còn thiếu nhiều nhất — cùng luật chọn với `quyDoiMon` (A11.5). */
  const huGoi = useMemo(() => {
    // D421 — "còn thiếu nhiều nhất" chỉ có nghĩa ở hũ tích lũy (mức của hũ tiêu dùng là trần tiêu một tháng).
    const coMuc = hu.filter((h) => laTichLuy(h) && h.muc !== null && h.muc > 0);
    const thieu = (h: typeof coMuc[number]): number => h.muc! - tongGopVaoHu(so, h.id, h.mocGop);
    return [...coMuc].sort((a, b) => thieu(b) - thieu(a) || a.id.localeCompare(b.id))[0] ?? null;
  }, [hu, so]);

  if (l === null) {
    return <span data-testid="dan-vung" aria-busy={taiLuat || taiSo ? 'true' : 'false'} hidden />;
  }

  if (gon) {
    return (
      <div className={s.gonHang} data-testid="dan-the">
        <span className={s.gonNhan}>{CHU_GIUP.danGon}</span>
        <span className={s.gonLoi} data-testid="dan-loi">“{l.loiNhac}”</span>
        <button type="button" className={s.gonNut} onClick={() => navigate(ROUTE_TAI_CHINH_HU)}>
          {CHU_GIUP.danMoHu}
        </button>
      </div>
    );
  }
  return (
    <div className={s.khoi} data-testid="dan-the">
      <BongOracle nhan={CHU_GIUP.danTen} loi={CHU_GIUP.danDau}>
        {/* Chữ của CHÍNH người dùng — nguyên văn, không diễn giải lại. */}
        <p className={s.loi} data-testid="dan-loi">“{l.loiNhac}”</p>
        {huGoi !== null && (
          <>
            <p className={s.huTen}>
              {huGoi.ten}
              {/* `tienDo` trả `null` khi hũ chưa đặt mức — ở đây `huGoi` đã lọc `muc > 0`, nhưng đọc
                  lại từ kiểu chứ không từ trí nhớ: lọc và tính là hai chỗ, và chúng trôi được. */}
              <span>{Math.round((tienDo(huGoi, tongGopVaoHu(so, huGoi.id, huGoi.mocGop)) ?? 0) * 100)}%</span>
            </p>
            <button type="button" className={s.nut} onClick={() => navigate(ROUTE_TAI_CHINH_HU)}>
              {CHU_GIUP.danMoHu}
            </button>
            <p className={s.vi}>{CHU_GIUP.danVi}</p>
          </>
        )}
      </BongOracle>
    </div>
  );
}
