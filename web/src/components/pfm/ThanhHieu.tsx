/**
 * PFM — THANH "MỨC ĐỘ HIỂU BẠN" (`.hieu` của demo `pfm-ngay-dau.html`, D355/D356).
 * Đo Oracle đang có BAO NHIÊU CĂN CỨ về người dùng — KHÔNG đo đoán đúng bao nhiêu (thành
 * tích đoán là chuyện của một màn khác, chưa thi công ở GIAI ĐOẠN A). Đứng đầu màn NGÀY
 * ĐẦU; số/ba mốc tới từ `pfm/chan_dung.ts` §`mucDoHieu` — component này CHỈ VẼ (A10).
 *
 * ⚠ THANH ĐẦY CÓ VƯỢT, NHƯNG BỀ RỘNG LUÔN ĐÚNG NGAY LẬP TỨC: `transform: scaleX()` đặt
 * qua `style` inline mỗi lần vẽ — không animation nào là nguồn chân lý của con số (xem
 * chú thích dài ở `.ndThanhDay`, `styles/motion.module.css`). Cú "vượt rồi co lại" chỉ là
 * MỘT LỚP VẼ THÊM, kích bằng cách remount phần tử qua `key={phanTram}` mỗi lần % đổi thật
 * — không phải một tuỳ chọn trang trí có thể tách rời sai.
 */
import { useState } from 'react';
import { CHU_NGAY_DAU } from '@/lib/pfm_chu';
import type { KetQuaHieu } from '@/pfm/chan_dung';
import motion from '@/styles/motion.module.css';
import s from './ThanhHieu.module.css';

interface Props {
  ket: KetQuaHieu;
  /** Câu "lên tiếp nhờ:" — hai nửa Pre/Bold, đổi theo bước đang đứng (chân dung/ba việc). */
  lenTiepPre: string;
  lenTiepBold: string;
}

const NHAN_MOC: Record<KetQuaHieu['moc'][number]['ma'], string> = {
  hoi: CHU_NGAY_DAU.hieuMocHoi,
  doan: CHU_NGAY_DAU.hieuMocDoan,
  khang_dinh: CHU_NGAY_DAU.hieuMocKhangDinh,
};

export function ThanhHieu({ ket, lenTiepPre, lenTiepBold }: Props): React.ReactElement {
  const [moGiai, setMoGiai] = useState(false);
  const p = ket.phanTram;

  /*
   * ⚠ MẪU REACT CHÍNH THỨC CHO "GIÁ TRỊ TRƯỚC ĐÓ khi prop đổi", KHÔNG dùng ref-mutate-
   * trong-render (StrictMode double-invoke sẽ làm `tu` sai — cùng họ lỗi `CuaPfm.tsx` đã
   * ghi: "ghi thuộc về effect, render phải thuần"). `setState` TRONG thân render, có điều
   * kiện, là cách React tự tài liệu hoá cho đúng việc này — React gộp cú render-lại vào
   * cùng một lượt, không có khung hình trung gian nào bị vẽ ra.
   */
  const [pTruoc, setPTruoc] = useState(p);
  const [tu, setTu] = useState(p);
  if (p !== pTruoc) {
    setTu(pTruoc);
    setPTruoc(p);
  }

  return (
    <div className={s.hieu} data-testid="thanh-hieu">
      <div className={s.dau}>
        <span className={s.ten}>{CHU_NGAY_DAU.hieuTen}</span>
        <span className={s.so}>
          <span data-testid="hieu-so">{p}</span>
          <small>%</small>
        </span>
        <button
          type="button"
          className={s.hoi}
          aria-expanded={moGiai}
          aria-label={CHU_NGAY_DAU.hieuHoiAria}
          onClick={() => setMoGiai((v) => !v)}
        >
          {moGiai ? '✕' : '?'}
        </button>
      </div>

      <div className={s.thanh}>
        {/*
          ⚠ Lớp `ndThanhDay` LUÔN gắn — `prefers-reduced-motion` tắt animation của nó bằng
          CSS (`motion.module.css`), không phải bằng nhánh JS ở đây (D116: TẮT CÁI NHÁY,
          GIỮ CÁI TIN — `transform` inline vẫn luôn đúng ngay cả khi animation bị tắt).
        */}
        <span
          key={p}
          className={`${s.day} ${motion.ndThanhDay}`}
          style={{
            transform: `scaleX(${p / 100})`,
            ['--nd-p-tu' as string]: tu / 100,
            ['--nd-p-den' as string]: p / 100,
          }}
        />
        <span className={s.oPixel} aria-hidden />
      </div>

      <div className={s.moc}>
        {ket.moc.map((m) => (
          <span
            key={m.ma}
            className={m.dat ? s.moiMocDat : s.moiMoc}
            style={{ left: `${m.p}%` }}
          >
            {NHAN_MOC[m.ma]}
          </span>
        ))}
      </div>

      <p className={s.ke}>
        <span>{CHU_NGAY_DAU.hieuKeNhan}</span>
        <span>
          {lenTiepPre}
          <b>{lenTiepBold}</b>
        </span>
      </p>

      {moGiai && <p className={s.giai}>{CHU_NGAY_DAU.hieuGiai}</p>}
    </div>
  );
}
