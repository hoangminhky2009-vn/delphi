/**
 * MÀN HÀNG CHỜ — khi cổng chống quá tải đang đóng (D207).
 *
 * ⭐ MÀN NÀY CHẠY ĐƯỢC LÀ NHỜ MỘT TÍNH CHẤT CỦA HẠ TẦNG, không phải nhờ React:
 * vỏ app (HTML/JS/CSS) do Cloudflare trả THẲNG Ở BIÊN — không qua Vercel,
 * không qua DB. Nên kể cả lúc cổng đóng chặt, người dùng vẫn tải được app và
 * nhìn thấy một màn hàng chờ THẬT của DELPHI, thay vì trang lỗi trần của trình
 * duyệt. Không có tính chất đó thì cả cơ chế hàng chờ vô nghĩa.
 *
 * ─── NÓI THẬT, KHÔNG NÓI QUÁ ───────────────────────────────────────────────
 * Cùng luật với `BangMatKetNoi`: chỉ nói đúng thứ mình biết. "Đang đông người"
 * là sự thật; "server sập" thì không (server đang chạy tốt, ta chủ động xếp
 * hàng để nó KHÔNG sập). Và luôn có số thứ tự — một hàng chờ không cho biết
 * mình đứng thứ mấy thì người ta bấm F5, mà F5 chính là thứ hàng chờ sinh ra
 * để chặn.
 *
 * ⚠ KHÔNG có nút "thử lại". Nhấn thử lại trong lúc quá tải là làm nặng thêm,
 * và ở đây nó còn vô ích: `api/cong.ts` đã tự hỏi theo nhịp cổng bảo.
 */
import { useEffect, useState } from 'react';
import { ngheHangCho, type TrangThaiCho } from '@/api/cong';
import s from './HangCho.module.css';

export function useHangCho(): TrangThaiCho | null {
  const [t, setT] = useState<TrangThaiCho | null>(null);
  useEffect(() => ngheHangCho(setT), []);
  return t;
}

export function HangCho() {
  const t = useHangCho();
  if (!t) return null;

  const coSucChua = typeof t.dang_trong === 'number' && typeof t.tran === 'number';

  return (
    <div className={s.phu} role="status" aria-live="polite">
      <div className={s.the}>
        <div className={s.nhan}>
          DELPHI<span className={s.nhay}>_</span>
        </div>

        <p className={s.tieuDe}>ĐANG ĐÔNG NGƯỜI</p>

        <div className={s.oSo}>
          <div className={s.soNhan}>VỊ TRÍ CỦA BẠN</div>
          {/* Con số là thứ DUY NHẤT người ta thật sự chờ đợi ở màn này. */}
          <div className={s.so}>{t.vi_tri}</div>
          <div className={s.soPhu}>trong {t.tong} người đang chờ</div>
        </div>

        {coSucChua && (
          <div className={s.suc}>
            ĐANG CHƠI <b>{t.dang_trong}</b> / {t.tran}
          </div>
        )}

        <p className={s.loi}>
          Máy chủ vẫn khoẻ — chúng tôi xếp hàng để nó <b>không</b> sập.
          Giữ tab này mở, tới lượt là bạn vào thẳng, không cần bấm gì.
        </p>
      </div>
    </div>
  );
}
