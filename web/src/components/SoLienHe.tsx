/**
 * SỔ LIÊN HỆ — CÁI KÉO NÀO BẠN ĐÃ SỐNG QUA (12/09/2026, Q3 "liên kết nhìn thấy").
 *
 * Một danh sách, hai chỗ đọc: trong trận (nút SỔ ở hàng bảng, dưới dải sáu mã) và
 * SỔ TAY KHÁI NIỆM trang Tài chính. Vì thế tệp đứng NGOÀI 
 * (tường lửa D24: trang Tài chính không import module trong trận) và không import
 *  — chỉ kiểu cấu trúc + . Cùng payload
 * `GET /holdem/me/so-tay` → `lien_he` (server tính từ seed trận đã xong —
 * `server/holdem/lien_he.ts`), thành phần này chỉ VẼ.
 *
 * ─── LUẬT ──────────────────────────────────────────────────────────────────
 * · Outer Wilds: hàng CHỈ điền khi CHÍNH bạn đã sống qua mặt ấy; mặt chưa gặp vẽ
 *   MỜ với tên (bản đồ những gì còn tồn tại), KHÔNG dấu hỏi, KHÔNG gợi ý.
 * · HÌNH, KHÔNG SỐ β: sáu chấm nghiêng = lá nào đi đâu khi mặt này lật (dấu do
 *   server gửi từ ma trận luật); ba ô bậc = GẶP · GẶP LẠI · QUEN.
 * · MÔ TẢ, KHÔNG KÊ ĐƠN (A10): mọi chữ ở đây tả sổ và tả mặt; test cấm từ khuyên.
 * · IM khi API cũ (`lien_he` vắng): trả null, không vẽ khung rỗng (D62).
 * · 0 art mới: huy hiệu là bốn lưới đã có (`TC_ICON`), chấm là CSS.
 */
import { useState } from 'react';
import { NutHoi } from '@/components/ui/NutHoi';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { bacLienHe, type LienHeSoTay } from '@server/holdem/khoanh_khac_ids';
import { TC_ICON, TC_TEN } from '@/lib/tinh_chat';
import s from './SoLienHe.module.css';

export interface SoLienHeProps {
  /** `SoTayDTO.lien_he` — undefined = API cũ / chưa tải ⇒ không vẽ. */
  lienHe: readonly LienHeSoTay[] | undefined;
  /** Catalog mặt sự kiện (thứ tự hàng) — tên từ catalog, kiểu cấu trúc để trang Tài chính (tường lửa D24) không phải import api/holdem. */
  suKien: readonly { id: string; label: string }[];
  /** Sáu mã theo thứ tự cột. */
  taiSan: readonly { id: string; label: string }[];
  /** Nhãn gọn hơn (vd trong trận) — cùng dữ liệu. */
  gon?: boolean | undefined;
  /**
   * D336 lượt 2 — CẤT sổ từ CHÍNH đầu sổ. Founder 15/09: *"phần sổ liên hệ … đ** ẩn được"*: trong
   * trận nút SỔ nằm trên bản đồ, còn sổ mở ra dưới dải sáu mã — đọc tới đây rồi thì cái nút đóng đã
   * trôi khỏi màn. Vắng ⇒ không nút (trang Tài chính: sổ là nội dung thường trực, không phải tấm mở).
   */
  onDong?: (() => void) | undefined;
}

/** dd/mm — múi giờ máy người xem (A8.8). */
function ngayNgan(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const TEN_BAC = ['', 'GẶP', 'GẶP LẠI', 'QUEN'] as const;

/**
 * 13/09 — cách đọc sổ nằm SAU `!` ở đầu sổ, không nằm sẵn dưới bảng (founder: *"chữ thì chỉ dành
 * cho bách khoa toàn thư"*). Xuất ra để bài quét A10 đọc cả phần không có trong DOM khi đóng.
 */
export const CHU_SO_LIEN_HE = {
  hoi: 'Sổ này đọc thế nào',
  giai: 'Sổ chỉ ghi mặt đã lật ở bàn bạn ngồi, trong trận đã xong. Chấm nghiêng: lá ấy thường đi về đâu khi mặt này lật thật. Ba ô: gặp · gặp lại · quen.',
} as const;

export function SoLienHe({ lienHe, suKien, taiSan, gon, onDong }: SoLienHeProps) {
  const [moGiai, datMoGiai] = useState(false);
  if (lienHe === undefined) return null;
  const theo = new Map(lienHe.map((x) => [x.id, x] as const));
  const daGap = suKien.filter((sk) => (theo.get(sk.id)?.so_lan ?? 0) >= 1).length;
  const quen = suKien.filter((sk) => bacLienHe(theo.get(sk.id)?.so_lan ?? 0) === 3).length;
  return (
    <section className={`${s.so} ${gon ? s.gon : ''}`} aria-label="Sổ liên hệ">
      <div className={s.dau}>
        <span className={s.nhan}>SỔ LIÊN HỆ</span>
        <span className={s.dauPhai}>
          <span className={s.dem}>
            đã gặp {daGap}/{suKien.length}{quen > 0 ? ` · quen ${quen}` : ''}
          </span>
          <NutHoi mo={moGiai} onBam={() => datMoGiai((x) => !x)} nhan={CHU_SO_LIEN_HE.hoi} />
          {onDong && (
            <button type="button" className={s.dong} onClick={onDong} aria-label="Cất sổ liên hệ">
              ✕
            </button>
          )}
        </span>
      </div>
      {moGiai && <p className={s.chuThich}>{CHU_SO_LIEN_HE.giai}</p>}
      <div className={s.cotDau} aria-hidden>
        <span className={s.oTen} />
        {taiSan.map((t) => (
          <span key={t.id} className={s.oCot} title={t.label}>{t.label}</span>
        ))}
        <span className={s.oBac} />
      </div>
      <ul className={s.danhSach}>
        {suKien.map((sk) => {
          const d = theo.get(sk.id);
          const soLan = d?.so_lan ?? 0;
          const bac = bacLienHe(soLan);
          const icon = d ? TC_ICON[d.tinh_chat] : undefined;
          const chuaGap = soLan === 0;
          const ngay = d ? ngayNgan(d.lan_dau) : null;
          return (
            <li
              key={sk.id}
              className={`${s.hang} ${chuaGap ? s.hangMo : ''}`}
              data-mat={sk.id}
              data-bac={bac}
            >
              <span className={s.oTen}>
                {icon && !chuaGap ? (
                  <span
                    className={s.huyHieu}
                    role="img"
                    aria-label={`Tính chất ${TC_TEN[d!.tinh_chat] ?? d!.tinh_chat}`}
                    title={TC_TEN[d!.tinh_chat] ?? d!.tinh_chat}
                  >
                    <PixelIcon name={icon} size={16} />
                  </span>
                ) : (
                  <span className={s.huyHieuTrong} aria-hidden />
                )}
                <span className={s.ten}>{sk.label}</span>
              </span>
              {taiSan.map((t) => {
                const dau = chuaGap ? 0 : (d?.dau.find((x) => x.ma === t.id)?.dau ?? 0);
                return (
                  <span key={t.id} className={s.oCot} aria-hidden>
                    {!chuaGap && (
                      <i className={dau > 0 ? s.chamLen : dau < 0 ? s.chamXuong : s.chamNgang} />
                    )}
                  </span>
                );
              })}
              <span className={s.oBac}>
                {chuaGap ? (
                  <span className={s.chuaGap}>{d && d.so_lan_gia > 0 ? `tin giả ×${d.so_lan_gia}` : 'chưa gặp'}</span>
                ) : (
                  <>
                    <span className={s.bac} aria-label={`${TEN_BAC[bac]} — ${soLan} lần`} title={`${TEN_BAC[bac]} — ${soLan} lần`}>
                      {[1, 2, 3].map((i) => (
                        <i key={i} className={`${s.oBacPip} ${i <= bac ? s.oBacDay : ''}`} />
                      ))}
                    </span>
                    <span className={s.phu}>
                      ×{soLan}{ngay ? ` · ${ngay}` : ''}{d && d.so_lan_gia > 0 ? ` · giả ×${d.so_lan_gia}` : ''}
                    </span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
