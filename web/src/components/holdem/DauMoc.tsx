/**
 * DẤU MỐC KỸ NĂNG — khối ở màn kết (doc 06 §5.1, founder chốt D85; thi công 17/08).
 *
 * Server nhặt (`server/holdem/dau_moc.ts`, hàm thuần trên `hd_brier_vong` +
 * `hd_chot_phien`) và chỉ trả ID + VÒNG + SỐ; câu chữ nằm ở đây.
 *
 * ⚠ GHI NHẬN VỀ SAU, KHÔNG KÊ TRƯỚC: không có danh sách mốc nào hiện trước trận,
 * nên nó không lái được hành vi — chính là lý do §5.1 tồn tại song song với kỳ
 * ngộ. Đừng bao giờ biến khối này thành "nhiệm vụ".
 * ⚠ Khen KỸ NĂNG (đọc đúng, độ chuẩn, cắt đúng lúc), KHÔNG khen TƯ THẾ RỦI RO
 * (all-in, ôm nhiều mã, giữ tiền mặt) — §1.2, và test quét lời để giữ điều đó.
 * ⚠ A10: MÔ TẢ, không kê đơn — không "nên/hãy/lần sau"; có test quét.
 * ⚠ IM KHI RỖNG (D62) — không khung trống, không câu an ủi.
 */
import s from './DauMoc.module.css';

export type DauMocId = 'do_chuan_len' | 'chuoi_dung_huong' | 'cat_truoc_sap' | 'chuan_nhat_tu_truoc';

export const THE_DAU_MOC: Record<DauMocId, {
  ten: string;
  /** Một câu HỒI CỐ về chính cú vừa rồi — nhận vòng + số server gửi. */
  cau: (c: { vong: number; so: number }) => string;
}> = {
  do_chuan_len: {
    ten: 'ĐỘ CHUẨN ĐANG LÊN',
    cau: ({ so }) => `Nửa sau trận bạn đọc sát hơn nửa đầu ${(so / 10000).toFixed(2).replace('.', ',')} điểm.`,
  },
  chuoi_dung_huong: {
    ten: 'BA VÒNG LIỀN ĐÚNG HƯỚNG',
    cau: ({ vong, so }) => `${so} vòng liên tiếp bạn đứng đúng phía, chuỗi khép ở vòng ${vong}.`,
  },
  cat_truoc_sap: {
    ten: 'CẮT TRƯỚC CÚ SẬP',
    cau: ({ vong, so }) => `Bạn hạ vị thế ngay trước vòng ${vong} — vòng đó chợ mất ${(so / 100).toFixed(1).replace('.', ',')}%.`,
  },
  chuan_nhat_tu_truoc: {
    ten: 'TRẬN CHUẨN NHẤT TỪ TRƯỚC TỚI NAY',
    cau: ({ so }) => `Độ chuẩn trung bình trận này ${(so / 10000).toFixed(2).replace('.', ',')} — sát nhất trong các trận đã chơi.`,
  },
};

export function DauMocKhoi({ danhSach }: {
  danhSach: readonly { id: string; vong: number; so: number }[] | undefined;
}) {
  const muc = (danhSach ?? []).filter((d): d is { id: DauMocId; vong: number; so: number } =>
    Object.prototype.hasOwnProperty.call(THE_DAU_MOC, d.id));
  if (muc.length === 0) return null;
  return (
    <section className={s.khoi} data-tap="dau-moc" aria-label="Dấu mốc kỹ năng">
      <div className={s.nhan}>DẤU MỐC</div>
      <ul className={s.ds}>
        {muc.map((d) => (
          <li key={d.id} className={s.muc}>
            <span className={s.ten}>{THE_DAU_MOC[d.id].ten}</span>
            <p className={s.cau}>{THE_DAU_MOC[d.id].cau({ vong: d.vong, so: d.so })}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
