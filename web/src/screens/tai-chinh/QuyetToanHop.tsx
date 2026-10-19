/**
 * HỘP QUYẾT TOÁN (C7) — tách khỏi `Hu.tsx` (D431, 27/09) để màn SỔ thôi kéo CẢ màn HŨ vào gói của nó.
 *
 * ⚠⚠ Vẫn là MỘT hộp cho hai màn (D291/D61 — chú thích dưới giữ nguyên), chỉ đổi NHÀ: `So.tsx` nhập `QuyetToanHop` từ
 *   `Hu.tsx` nên mọi thứ `Hu.tsx` nhập (khay phân bổ · biểu đồ vị thế · bảng vào lệnh…) cũng vào gói của màn SỔ — màn mở
 *   nhiều nhất của cả khu. Đo trên bản gộp 0.0.46: bài `oracle_chat` (dựng `/tai-chinh/so`, chờ 1 giây) vượt ngưỡng ngay cả
 *   khi chạy riêng; D426 đã gặp đúng họ này và mới tách được `BieuDoViThe.tsx`.
 * ⚠ Tệp ANH EM cùng thư mục, dùng CHUNG `Hu.module.css` — đúng điều chú thích cũ lo: không chép luật CSS nào, không để
 *   `components/` nhập CSS của một màn. Bài canh `so_goi_nhe.test.ts`: màn SỔ không nhập lại màn HŨ/GƯƠNG.
 */
import { useState } from 'react';
import type React from 'react';
import { PFM } from '@config/pfm';
import { LaKetToan } from '@/components/pfm/LaKetToan';
import type { Hu, MaKetQuaHu } from '@/pfm/hu';
import { LY_DO_VI_THE, type LoiDoanHu, type MaLyDoViThe } from '@/pfm/vi_the';
import { ngayViet } from '@/pfm/thoi_gian';
import { CHU_KET_QUA_HU, CHU_LY_DO_VI_THE, CHU_MAN_HU, CHU_VI_THE as CV } from '@/lib/pfm_chu';
import s from './Hu.module.css';

/** Đích của một cú "mở quyết toán" (C7) — chỉ hai đích hợp lệ, xem `hu.ts` §`quyetToan`. */
export type DichQuyetToan = 'xong' | 'bo_do';

/** Tiền ĐỒNG — cùng định dạng với màn SỔ (`So.tsx`), tách khỏi định dạng token. */
export function dinhDangDong(n: number): string {
  return n.toLocaleString('vi-VN');
}

/* ═══ Quyết toán (C7) — MỘT câu, bốn nấc; có lệnh sống thì LẬT LÁ trước khi hỏi vì sao ════════════ */

/**
 * ⭐⭐ THÀNH PHẦN DÙNG CHUNG — màn HŨ và màn SỔ gọi **cùng một cái này** (D291).
 *
 * ⚠⚠ XUẤT RA THAY VÌ CHÉP MỘT BẢN THỨ HAI SANG `So.tsx`, và lý do là D61 chứ không phải
 * gọn code: hộp này chở BỐN NHÃN NẤC (`CHU_KET_QUA_HU`) và bốn MÃ (`KET_QUA_HU`, suy từ
 * sổ đăng ký) — mà `kq_dat_muc_tieu` là một lớp **outcome**, đi thẳng vào dataset và
 * không dựng lại được ở kỳ sau. Một bản sao lệch đi nửa nhãn ở màn SỔ sẽ không đỏ ở đâu
 * cả; nó chỉ làm bẩn đúng cái cohort mà chỉ số ấy sinh ra để phục vụ.
 * ⚠ Nó ở lại `Hu.tsx` (không dời sang `components/`) vì nó dùng `Hu.module.css` chung với
 *   cả màn HŨ — dời tệp thì hoặc phải chép ~10 luật CSS (bản sao thứ hai, đúng thứ vừa
 *   tránh), hoặc phải để một component `components/` đi ngược lên nhập CSS của một màn.
 */
export function QuyetToanHop({ hu, dich, onChon, loiDoan = null }: {
  hu: Hu; dich: DichQuyetToan;
  onChon: (ma: MaKetQuaHu, lyDo?: MaLyDoViThe) => void;
  /**
   * Lệnh còn MỞ của hũ (`loiDoanHuDangMo`) — có thì bấm nấc CHƯA đóng hộp: lá vị thế LẬT ra kết quả (suy từ CHÍNH
   * nấc vừa bấm), rồi hỏi VÌ SAO. BỎ QUA vẫn chốt, chỉ không nhãn.
   */
  loiDoan?: LoiDoanHu | null;
}): React.ReactElement {
  const [moGiai, datMoGiai] = useState(false);
  const [nac, datNac] = useState<MaKetQuaHu | null>(null);
  const chon = (ma: MaKetQuaHu): void => { if (loiDoan !== null) datNac(ma); else onChon(ma); };
  const nut = (ma: MaKetQuaHu, chinh = false): string =>
    [s.nut2, chinh || nac === ma ? s.chinh : ''].filter(Boolean).join(' ');
  const xong = dich === 'xong';
  // ⚠ Tên hũ hiện HOA cho đúng giọng chữ cả màn — xem chú thích ở `TheHuHang` (h.ten.toUpperCase()).
  const cauHoi = xong
    ? `${CHU_MAN_HU.hoiXongPre}${hu.ten.toUpperCase()}${CHU_MAN_HU.hoiHau}`
    : `${CHU_MAN_HU.hoiBoDoPre}${hu.ten.toUpperCase()}${CHU_MAN_HU.hoiHau}`;
  const phu = xong ? CHU_MAN_HU.phuXong : CHU_MAN_HU.phuBoDo;

  return (
    <div className={s.khoi2}>
      <div className={s.ten2}>{cauHoi}</div>
      <p className={s.chuThich}>{phu}</p>
      {loiDoan !== null && (
        <LaKetToan
          nhan={`${CV.ktPre}${hu.ten.toUpperCase()}`}
          lat={nac !== null}
          /* Kỳ hạn sang năm khác thì in cả năm — cùng luật với nắp ĐỘ KHỚP ở GƯƠNG. */
          dieu={<>{CV.matDuPre}<b>{dinhDangDong(loiDoan.muc)}</b>{`${CV.matToiGiua}${ngayViet(loiDoan.han, loiDoan.han.slice(0, 4) !== loiDoan.datLuc.slice(0, 4))}`}</>}
          chac={PFM.VI_THE_CHAC[loiDoan.chac]}
          phu={loiDoan.viSao ? `“${loiDoan.viSao}”` : undefined}
          /* Kết quả suy từ CHÍNH nấc vừa bấm: đủ ⇒ TỚI, ba nấc kia ⇒ CHƯA TỚI (tệp 15 R3). */
          ket={nac === null ? null : nac === 'du' ? CV.ketToi : CV.ketKhongToi}
          khai={nac === null ? undefined : `${CV.lungNacPre}${CHU_KET_QUA_HU[nac]}`}
        />
      )}
      <div className={s.nutHang}>
        <button
          type="button" className={nut('du', nac === null)} aria-pressed={nac === 'du'}
          onClick={() => chon('du')}
        >
          {CHU_KET_QUA_HU.du}
        </button>
        <button type="button" className={nut('gan_du')} aria-pressed={nac === 'gan_du'} onClick={() => chon('gan_du')}>
          {CHU_KET_QUA_HU.gan_du}
        </button>
      </div>
      <div className={s.nutHang}>
        <button
          type="button" className={nut('dang_tien')} aria-pressed={nac === 'dang_tien'}
          onClick={() => chon('dang_tien')}
        >
          {CHU_KET_QUA_HU.dang_tien}
        </button>
        <button type="button" className={nut('xa')} aria-pressed={nac === 'xa'} onClick={() => chon('xa')}>
          {CHU_KET_QUA_HU.xa}
        </button>
      </div>
      {loiDoan !== null && nac !== null && (
        <HangLyDo onLyDo={(ld) => onChon(nac, ld)} onBoQua={() => onChon(nac)} />
      )}
      <div className={`${s.hang2} ${s.hangHoi}`}>
        <span className={s.phu2s}>{CHU_MAN_HU.hoiSaoKhongTuTinh}</span>
        <button
          type="button" className={s.hoi} aria-expanded={moGiai}
          onClick={() => datMoGiai((v) => !v)}
        >
          {moGiai ? '✕' : '?'}
        </button>
      </div>
      {moGiai && <p className={s.giai}>{CHU_MAN_HU.giaiSaoKhongTuTinh}</p>}
    </div>
  );
}

/**
 * Hàng VÌ SAO — sau khi lá vừa lật. Ba nhãn CÙNG TRỌNG LƯỢNG (không nút nào sáng sẵn) + BỎ QUA.
 * ⚠ Nhãn là BỐI CẢNH, không phải điểm: "hoàn cảnh đổi" vẫn đếm (tệp 15 R4).
 */
function HangLyDo({ onLyDo, onBoQua }: {
  onLyDo: (ld: MaLyDoViThe) => void; onBoQua: () => void;
}): React.ReactElement {
  return (
    <div className={s.vaoLoiDoan} data-testid="hang-ly-do">
      <div className={`${s.tieu} ${s.tieuForm}`}>{CV.hoiLyDo}</div>
      <div className={s.nutHang}>
        {LY_DO_VI_THE.map((ld) => (
          <button key={ld} type="button" className={s.nut2} onClick={() => onLyDo(ld)}>
            {CHU_LY_DO_VI_THE[ld]}
          </button>
        ))}
      </div>
      <div className={s.nutHang}>
        <button type="button" className={`${s.nut2} ${s.rong100}`} onClick={onBoQua}>{CV.boQua}</button>
      </div>
    </div>
  );
}
