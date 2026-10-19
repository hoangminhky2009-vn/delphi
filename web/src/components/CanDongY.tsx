/**
 * MÀN NHẮC ĐỒNG Ý — hiện khi người chơi đã TẮT điều khoản rồi bấm vào chơi.
 *
 * ⚠ VÌ SAO CÓ MÀN NÀY THAY VÌ CHỈ ẨN NÚT: ẩn nút thì người ta không hiểu vì
 * sao app "hỏng". Cửa khoá phải nói ra là nó khoá, khoá vì cái gì, và mở bằng
 * cách nào — cả ba trong một màn, không bắt ai đi tìm.
 *
 * ⚠ ĐÂY LÀ LỚP TRÌNH BÀY, KHÔNG PHẢI LỚP BẢO VỆ. Cổng thật nằm ở server
 * (`requireDongY`) và trả 403 `chua_dong_y` — C4, client không bao giờ là gác
 * cổng. Màn này chỉ để người dùng khỏi phải đâm vào một lỗi mới hiểu.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, useMe } from '@/api/queries';
import { NeonButton } from '@/components/ui';
import { Mascot } from '@/components/Mascot';
import s from './CanDongY.module.css';
import { datNghienCuu } from '@/api/du_lieu';
import { VanBanNghienCuu } from './VanBanNghienCuu';

export function CanDongY({ onXong }: { onXong?: () => void } = {}) {
  const qc = useQueryClient();
  const [loi, setLoi] = useState(false);
  const bat = useMutation<{ research_consent: boolean }, Error, void>({
    // 0079 — bật kèm văn bản `nghien_cuu` ở bản hiện hành, đúng chữ hiện ngay trên nút.
    mutationFn: () => datNghienCuu(true),
    onSuccess: () => {
      setLoi(false);
      void qc.invalidateQueries({ queryKey: queryKeys.me });
      /*
       * ⚠ Người gọi PHẢI dọn trạng thái lỗi cũ của nó. Ở sảnh Đấu trường, màn
       * này hiện vì `tao.error` là 403 `chua_dong_y`; đồng ý xong mà không
       * `reset()` thì lỗi cũ vẫn dính và màn nhắc không chịu biến mất — người
       * ta bấm đồng ý rồi mà app vẫn bảo chưa đồng ý.
       */
      onXong?.();
    },
    onError: () => setLoi(true),
  });

  return (
    <div className={s.boc} role="alert">
      <Mascot size={64} title="Oracle" />
      <h2 className={s.tieuDe}>XẾP HẠNG CẦN ĐỒNG Ý ĐIỀU KHOẢN</h2>
      <p className={s.chinh}>
        Chơi tự do thì bạn cứ chơi, không cần gì cả. Nhưng xếp hạng là lúc tên
        bạn đứng trên bảng chung, cạnh tên người lạ.
      </p>
      <p className={s.phu}>
        Nên chỗ đó cần một thoả thuận chung. Tụi mình không thu tên thật, không
        thu số điện thoại, không thu bạn đang ở đâu — chỉ là bạn bấm gì, ở màn
        nào bao lâu, để còn biết chỗ nào đang dở mà sửa.
      </p>
      <VanBanNghienCuu />
      <div className={s.nut}>
        <NeonButton onClick={() => bat.mutate()} disabled={bat.isPending}>
          {bat.isPending ? 'ĐANG BẬT…' : '✓ ĐỒNG Ý & LEO HẠNG'}
        </NeonButton>
        <Link className={s.doc} to="/dieu-khoan">
          Đọc điều khoản trước →
        </Link>
      </div>
      {loi && (
        <p className={s.loi}>✕ Chưa lưu được. Kiểm tra mạng rồi thử lại nhé.</p>
      )}
      <p className={s.chan}>
        Không muốn cũng không sao — chế độ TỰ DO ngay trên vẫn chơi được đủ.
      </p>
    </div>
  );
}

/**
 * CỔNG — bọc quanh phần CHƠI. Chưa đồng ý thì hiện màn nhắc thay vì nội dung.
 *
 * Đặt BÊN TRONG `AuthGate` ở mỗi màn: khách chưa đăng nhập phải gặp cửa đăng
 * nhập trước, chứ không phải một màn đòi đồng ý điều khoản của một tài khoản
 * chưa tồn tại.
 *
 * ⚠ Chờ `me` xong mới quyết — không thì người đã đồng ý vẫn thấy màn nhắc loé
 * lên một nhịp mỗi lần mở app, và đó là kiểu phiền vô cớ khó chịu nhất.
 */
export function CongDongY({ children }: { children: React.ReactNode }) {
  const me = useMe();
  if (me.isPending) return null;
  if (me.data?.user && me.data.user.research_consent !== true) return <CanDongY />;
  return <>{children}</>;
}
