/**
 * BĂNG-RÔN SỰ KIỆN — làm cho tin tức thành chuyện CỦA MÌNH.
 *
 * Founder 20/07: "tác động của sự kiện lên người chơi chưa rõ ràng và quá ít
 * cảm xúc".
 *
 * Chẩn đoán: bản cũ có hiện tên sự kiện, nhưng nó chỉ là một ô nhỏ trên bản đồ
 * ghi "LẠM PHÁT". Người chơi đọc xong vẫn không biết điều đó có ý nghĩa gì với
 * MÌNH — phải tự tra chéo tin tức với danh mục trong đầu. Không ai làm thế
 * giữa lúc đang đếm tiền, nên tin tức trôi qua như chữ trang trí.
 *
 * Nên băng-rôn này KHÔNG nhắc lại tên sự kiện rồi thôi. Nó trả lời đúng câu
 * người chơi thật sự hỏi: **lá nào của tôi vừa ăn đòn, và ăn bao nhiêu.**
 *
 * Dữ liệu lấy thẳng từ `chain` (mắt xích `echo`) — cùng một nguồn với bảng
 * "vì sao", nên băng-rôn không bao giờ nói khác kết quả. Bịa một con số riêng
 * cho hiệu ứng là cách chắc chắn nhất để hai chỗ lệch nhau.
 */
import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks';
import { pctBp, type MatXichDTO, type NhanDTO, type TaiSanDTO } from '@/api/holdem';
import { NHIP } from '@/lib/nhip';
import { PixelIcon } from '@/components/ui/PixelIcon';
import s from './SuKienBanner.module.css';
import mo from '@/styles/motion.module.css';

export function SuKienBanner({
  suKienId, chain, taiSan, suKien, laTinGia, vongGoc, onXong,
}: {
  suKienId: string | null;
  chain: MatXichDTO[];
  taiSan: TaiSanDTO[];
  suKien: NhanDTO[];
  laTinGia?: boolean;
  /**
   * Vòng của cái tin vừa bị bóc — CHỈ có ở nhánh tin giả lộ (founder 23/08).
   * Vắng nghĩa là băng-rôn đang nói về ô VỪA LẬT, không phải một cú bóc.
   */
  vongGoc?: number;
  onXong?: () => void;
}) {
  const itMotion = useReducedMotion();
  const [hien, setHien] = useState(false);

  useEffect(() => {
    if (!suKienId) { setHien(false); return undefined; }
    setHien(true);
    // ⚠ CỐ Ý ĐẢO CHIỀU: reduced-motion để LÂU HƠN. Không có băng-rôn quét thì
    // người chơi cần thời gian ĐỌC tin, chứ không phải bớt thời gian.
    const t = setTimeout(
      () => { setHien(false); onXong?.(); },
      itMotion ? NHIP.BANG_RON + 600 : NHIP.BANG_RON,
    );
    return () => clearTimeout(t);
  }, [suKienId, itMotion, onXong]);

  if (!suKienId || !hien) return null;

  // Chỉ lấy mắt xích echo CỦA ĐÚNG sự kiện này — danh mục có thể đang ăn dư âm
  // của nhiều tin cũ cùng lúc, gộp hết vào là nói sai nguyên nhân.
  const trung = chain.filter(
    (m): m is Extract<MatXichDTO, { kind: 'echo' }> =>
      m.kind === 'echo' && m.su_kien === suKienId,
  );
  const tong = trung.reduce((x, m) => x + m.delta_bp, 0);
  const ten = suKien.find((x) => x.id === suKienId)?.label ?? suKienId;
  // Chỉ trả NHÃN CHỮ: `icon` do server cấp (config/holdem.ts) là emoji, tức hình
  // do font hệ điều hành vẽ — cùng ký tự ra khác nhau trên Windows và iPhone.
  // Ở đây nó lại nằm trong chip 11px cạnh con số %, nên hình cao thấp lệch nhau
  // giữa các máy là hàng chip so le. Tên mã đứng ngay sau nó, không mất gì.
  const nhanTS = (id: string) => taiSan.find((x) => x.id === id)?.label ?? id;

  return (
    <div className={s.lop} aria-live="polite">
      <div className={`${s.bang} ${tong >= 0 ? s.tot : s.xau} ${itMotion ? '' : mo.bangRonQuet}`}>
        <div className={s.dau}>
          {/*
            MỘT lưới cho cả hai nhánh (`news`), không phải một bên hình một bên
            chữ trơn: tin thật và tin giả là cùng một vật, chỉ khác nội dung —
            và người chơi phải phân biệt được chúng bằng CHỮ chứ không bằng việc
            hình có hay không. Nền băng-rôn đã đỏ sẵn khi tin xấu.
          */}
          <span className={s.chuTin}>
            <PixelIcon name="news" size={16} />
            {laTinGia ? 'TIN GIẢ' : 'TIN'}
          </span>
          <span className={s.ten}>{ten}</span>
        </div>

        {/*
          ⭐ CÚ BÓC TIN GIẢ nói một câu KHÁC HẲN tin thường, nên nó có dòng riêng.
          Founder 23/08: cú này phải là thông báo TOÀN MAP chứ không nằm im
          trong bảng VÌ SAO. Và nó đúng là loại tin không suy được từ con số:
          dư âm ĐẢO CHIỀU, tức số âm ở vòng này có nguyên nhân khác hẳn "đọc sai".
        */}
        {laTinGia && vongGoc !== undefined && (
          <div className={s.boc}>
            Tin ở vòng {vongGoc} là <b>BỊA</b> — dư âm vừa <b>ĐẢO NGƯỢC</b>.
          </div>
        )}

        {trung.length === 0 ? (
          // Không trúng lá nào cũng là THÔNG TIN — và là thông tin tốt lành:
          // người chơi biết mình đứng ngoài cơn bão, thay vì phải tự đoán.
          <div className={s.khongTrung}>Danh mục của bạn KHÔNG dính tin này</div>
        ) : (
          <>
            <div className={s.dsTrung}>
              {trung.map((m, i) => (
                <span key={i} className={m.delta_bp >= 0 ? s.laLen : s.laXuong}>
                  {nhanTS(m.id)} <b>{pctBp(m.delta_bp)}</b>
                </span>
              ))}
            </div>
            <div className={s.tong}>
              {tong >= 0 ? '▲' : '▼'} {pctBp(tong)} lên danh mục của bạn
            </div>
          </>
        )}
      </div>
    </div>
  );
}
