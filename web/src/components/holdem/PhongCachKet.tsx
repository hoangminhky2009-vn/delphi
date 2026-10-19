/**
 * KHỐI PHONG CÁCH Ở MÀN KẾT — hạng cả trận + ba trục để flex.
 *
 * Founder 17/08: *"kết trận thay vì chỉ có màn hình hiện thứ tự xếp hạng thì
 * còn hiện phong cách chơi cả trận ở góc nữa"* và *"kết trận thì ở MENU KẾT
 * THÚC mới khoe mấy chỉ số kia cụ thể thôi để flex chứ kết quả thì tính chung
 * tất cả chứ ko tính riêng"*.
 *
 * ⇒ Đây là chỗ DUY NHẤT ba trục được banh ra. Trong trận chỉ có một thanh.
 * ⚠ Ba trục là THÀNH PHẦN của một điểm chung, không phải ba bảng điểm rời —
 * nên chúng hiện DƯỚI hạng và nhỏ hơn hạng, không đứng ngang hàng với nó.
 *
 * ⭐ 13/09 — KHỐI DUY NHẤT "TRẬN NÀY CỦA BẠN" ở màn kết. Founder: *"phong cách cá nhân phải là nổi
 * bật nhất để flex"* + *"chia ra nhiều quá thì thừa thãi và rối"*. Hai khối rời đứng dưới nó trước
 * đây (năng lực trên đề · hôm nay vừa chạm) nay đi vào `children` — dải `GhiVaoThe` ở ĐÁY, nhỏ hơn
 * hạng, cùng khung. Khung đổi sang vai màu của màn kết: viền tím như các nếp THẺ KẾT TRẬN · BẢN ĐỒ
 * TRẬN ngay trên, nhãn tím nhạt; bảng xám `--vien/--nen-2/--mo` cũ không phải token nào của app.
 */
import { ChuPixel } from './ChuPixel';
import { ThanhPhongCach, bacCua } from './ThanhPhongCach';
import type { CSSProperties, ReactNode } from 'react';
import { mauTheoDiem } from './mau_hang';
import s from './PhongCachKet.module.css';

export interface PhongCachKetDTO {
  diem: number;
  hang: string;
  streak: number;
  streak_dai_nhat: number;
  ba_truc: { doc: number | null; thang_cho: number; tru: number };
}

/**
 * Câu một dòng cho từng trục — MÔ TẢ, không kê đơn (A10). Không câu nào bảo
 * người chơi lần sau nên làm gì.
 */
const TRUC = [
  { k: 'doc' as const, ten: 'ĐỌC', y: 'đoán đúng mã lời nhất tới đâu' },
  { k: 'thang_cho' as const, ten: 'THẮNG CHỢ', y: 'hơn hay kém mặt bằng cả bảng' },
  { k: 'tru' as const, ten: 'TRỤ', y: 'giữ được bao nhiêu lúc chợ sập' },
];

/**
 * `gon` (màn kết bento, 11/10): bản NẰM TRONG Ô PHONG CÁCH của lưới không cuộn — hạng chữ pixel + THANH chấm điểm thật (`ThanhPhongCach`,
 * thang E→SSS, màu `mauTheoDiem`) + ba trục (tên · thanh · %). Bỏ khung riêng (ô đã có khung) và dòng giải nghĩa từng trục (nằm ở lớp
 * trượt PHONG CÁCH — bản đầy đủ, `gon` tắt). Cùng một component, cùng một nguồn màu/chữ/hiệu ứng với bản đầy đủ (A11.5).
 */
/** Cỡ hạng ở bản gọn: màn cao (≥ 740 px, vd 390×812) có chỗ cho hạng TO; màn thấp (360×640) co về 6 để cả ô vẫn vừa không cuộn. */
const pxHangGon = (): number => (typeof window !== 'undefined' && window.innerHeight >= 740 ? 9 : 6);

export function PhongCachKet({ pc, children, gon = false }: { pc: PhongCachKetDTO; children?: ReactNode; gon?: boolean }) {
  const bac = bacCua(pc.hang);
  return (
    <section
      className={`${s.khoi} ${s[bac] ?? ''} ${gon ? s.gon : ''}`}
      data-tap="phong-cach-ket"
      /*
       * ⚠ MỘT NGUỒN với thanh trong trận: cùng `mauTheoDiem`, cùng con số điểm.
       * Trước 23/08 chỗ này có bảng 5 bậc riêng và nó trôi ngay khi thanh đổi
       * sang thang liên tục — chữ hạng SSS hồng đứng cạnh thanh vàng.
       */
      style={{ '--pc-mau': mauTheoDiem(pc.diem) } as CSSProperties}
    >
      <header className={s.dau}>
        <span className={s.nhan}>PHONG CÁCH CẢ TRẬN</span>
        {pc.streak_dai_nhat >= 2 && (
          <span className={s.chuoi}>chuỗi dài nhất ×{pc.streak_dai_nhat}</span>
        )}
      </header>

      <div className={s.than}>
        {/* Hạng CẢ TRẬN — cùng bộ glyph pixel, cỡ lớn nhất ngoài lớp phủ.
            `px = 4`: chữ cao 48px, nhỉnh hơn cỡ chữ cũ (40px) vì glyph pixel
            đọc "nhẹ" hơn font đậm ở cùng chiều cao. */}
        <span className={s.hangTo} role="img" aria-label={`Hạng ${pc.hang}`}>
          <ChuPixel chuoi={pc.hang} px={gon ? pxHangGon() : 4} vien />
        </span>
        <div className={s.phai}>
          <ThanhPhongCach pc={{ diem: pc.diem, hang: pc.hang, streak: 0 }} gon />
          <span className={s.diem}>{pc.diem} / 1000</span>
        </div>
      </div>

      <ul className={s.truc}>
        {TRUC.map((t) => {
          const v = pc.ba_truc[t.k];
          return (
            <li key={t.k} className={s.mot}>
              <span className={s.trucTen}>{t.ten}</span>
              <span className={s.trucThanh} aria-hidden>
                <span
                  className={s.trucDay}
                  style={{ transform: `scaleX(${v === null ? 0 : Math.max(0, Math.min(1, v))})` }}
                />
              </span>
              {/* `null` = KHÔNG ĐO ĐƯỢC (cả trận không dự báo vòng nào), khác hẳn
                  0 = đo được và bằng không. Hiện dấu gạch, không hiện "0%". */}
              <span className={s.trucSo}>{v === null ? '—' : `${Math.round(v * 100)}%`}</span>
              {/* Bản gọn (`gon`): giải nghĩa từng trục chuyển vào lớp trượt PHONG CÁCH — KHÔNG có trong DOM của ô (mặt ô chỉ tên + số). */}
              {!gon && <span className={s.trucY}>{t.y}</span>}
            </li>
          );
        })}
      </ul>
      {/* 13/09 — dải GHI VÀO THẺ (kỹ năng · vừa chạm · mã tham gia): đáy khối, nhỏ hơn hạng. */}
      {children}
    </section>
  );
}
