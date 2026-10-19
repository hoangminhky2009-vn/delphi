/**
 * SỔ TAY KHÁI NIỆM — khối ở trang Tài chính cá nhân (founder 16/08, "vá lối
 * chơi" tầng 3 — cây cầu duy nhất được phép bắc sang "ngoài đời": GỌI TÊN).
 *
 * Người được bạn rủ, chưa có nền, sau vài trận hỏi: "cái tôi vừa học có tên
 * gì ngoài đời?". Khối này trả lời bằng chính bộ tự điển của màn kết
 * (`lib/khoanh_khac.ts` — một nguồn câu chữ, hai chỗ đọc): khái niệm nào bạn
 * đã CHẠM (mấy trận · lần đầu · cú nặng nhất) và khái niệm nào CHƯA — vẽ mờ,
 * không ẩn: đó là bản đồ những gì còn tồn tại trong trò, không phải danh sách
 * việc phải làm (D67: discovery > instruction).
 *
 * ⭐ 13/09 — TỪ TÁM ĐOẠN VĂN THÀNH MỘT ALBUM. Founder: *"toàn chữ là chữ, đọc muốn lòi mắt… cái
 * họ muốn chỉ là cái gì trực quan thể hiện kiến thức của mình, chữ thì chỉ dành cho bách khoa toàn
 * thư"*. Trước: tám hàng, mỗi hàng một đoạn văn — kể cả khái niệm CHƯA chạm — cộng một chú thích.
 * Nay: lưới tám ô, mỗi ô là icon pixel (cùng `ICON_KHOANH_KHAC` của màn kết) · tên · cú nặng nhất;
 * đếm "3/8" in TO. Câu NGOÀI ĐỜI + số trận + lần đầu nằm trong MỘT tấm mở ngay dưới hàng ô vừa
 * chạm — tầng bách khoa, không phải tầng nhìn. Chú thích của sổ nằm sau `!` ở nhãn.
 *
 * ⚠ A10 — MÔ TẢ, KHÔNG KÊ ĐƠN. Mọi câu ở đây là "nó là gì" và "bạn đã gặp
 * nó thế nào"; không một câu nào nói bạn NÊN làm gì, trong trò hay ngoài đời.
 * Chữ nằm sau `!` không có trong DOM khi đóng ⇒ bài quét đọc `CHU_SO_TAY`, không
 * chỉ `textContent`. Không nói về tiền thật.
 * ⚠ Nằm NGOÀI `components/holdem` có chủ ý: trang Tài chính bị tường lửa D24
 * cấm import module trong-trận; dữ liệu đi qua kênh đọc thuần `api/tinh_cach`.
 * ⚠ IM khi người chơi chưa xong trận nào (`so_tran === 0`) — trang này đã có
 * đủ lời mời, và một sổ trống toàn "chưa chạm" là bảng nói với người mới rằng
 * họ chưa có gì.
 */
import { Fragment, useState } from 'react';
import { KHOANH_KHAC_IDS, type KhoanhKhacId } from '@server/holdem/khoanh_khac_ids';
import type { SoTayDTO, TuDienMatDTO } from '@/api/tinh_cach';
import { NutHoi } from '@/components/ui/NutHoi';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { ICON_KHOANH_KHAC, pctCuaBp, THE_KHOANH_KHAC } from '@/lib/khoanh_khac';
import { SoLienHe } from './SoLienHe';
import s from './SoTayKhaiNiem.module.css';

/** Chữ riêng của khối — gồm cả phần sau `!` (bài quét A10 đọc bảng này). */
export const CHU_SO_TAY = {
  nhan: 'SỔ TAY KHÁI NIỆM',
  demHau: 'đã chạm',
  chuaCham: 'chưa chạm',
  hoi: 'Sổ này ghi gì',
  giai: 'Sổ chỉ ghi khái niệm đã đi qua danh mục của chính bạn trong các trận đã xong — cùng thước với dòng “HÔM NAY BẠN VỪA CHẠM” ở màn kết.',
} as const;

/** Một hàng lưới có mấy ô — tấm chi tiết chèn ngay SAU hàng chứa ô vừa chạm. */
const O_MOT_HANG = 4;

/** dd/mm — đủ để nhớ "lần đầu", không cần giờ. Múi giờ máy người xem (A8.8). */
function ngayNgan(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/*
 * 12/09 (Q3) — SỔ LIÊN HỆ là chỗ đọc thứ hai của cùng danh sách `lien_he` (chỗ
 * đầu: nút SỔ trong trận). Tên mặt/mã do TRANG (`TaiChinh.tsx`) lấy qua kênh đọc
 * thuần `useTuDienMat` và truyền xuống — khối này giữ nguyên là thành phần thuần
 * (test vẽ nó không cần QueryClient), và tường lửa D24 không bị chạm.
 */
export function SoTayKhaiNiem({ so, tuDien }: { so: SoTayDTO | undefined; tuDien?: TuDienMatDTO | undefined }) {
  const [mo, datMo] = useState<KhoanhKhacId | null>(null);
  const [moGiai, datMoGiai] = useState(false);
  if (!so || so.so_tran <= 0) return null;
  const daCham = new Map(so.khai_niem
    .filter((k) => Object.prototype.hasOwnProperty.call(THE_KHOANH_KHAC, k.id))
    .map((k) => [k.id as KhoanhKhacId, k] as const));
  // Đã chạm đứng trước (đúng thứ tự server xếp), chưa chạm theo thứ tự bảng.
  const thuTu: KhoanhKhacId[] = [
    ...so.khai_niem.map((k) => k.id).filter((id): id is KhoanhKhacId => daCham.has(id as KhoanhKhacId)),
    ...KHOANH_KHAC_IDS.filter((id) => !daCham.has(id)),
  ];
  const viTriMo = mo === null ? -1 : thuTu.indexOf(mo);
  // Hết hàng chứa ô đang mở (hoặc ô cuối nếu hàng ấy thiếu ô).
  const cuoiHangMo = viTriMo < 0 ? -1
    : Math.min(thuTu.length - 1, (Math.floor(viTriMo / O_MOT_HANG) + 1) * O_MOT_HANG - 1);

  const giai = (id: KhoanhKhacId) => {
    const the = THE_KHOANH_KHAC[id];
    const k = daCham.get(id);
    const ngay = k ? ngayNgan(k.lan_dau) : null;
    return (
      <li className={`${s.giai} ${k ? '' : s.giaiChua}`} data-testid="giai-khai-niem">
        <p className={s.giaiTen}>{the.ten}{k ? '' : ` · ${CHU_SO_TAY.chuaCham}`}</p>
        {k && (
          <p className={s.so}>
            {k.so_tran} trận{ngay ? ` · lần đầu ${ngay}` : ''} · nặng nhất{' '}
            <span className={k.manh_nhat.delta_bp < 0 ? s.manhAm : s.manhDuong}>{pctCuaBp(k.manh_nhat.delta_bp)}</span>
            {' '}(vòng {k.manh_nhat.vong})
          </p>
        )}
        <p className={s.ngoaiDoi}>{the.ngoai_doi}</p>
      </li>
    );
  };

  return (
    <section className={s.khoi} aria-label="Sổ tay khái niệm">
      <div className={s.nhan}>
        <span>{CHU_SO_TAY.nhan}</span>
        <span className={s.dauPhai}>
          <span className={s.dem} data-testid="dem-khai-niem">
            <b>{daCham.size}/{KHOANH_KHAC_IDS.length}</b> {CHU_SO_TAY.demHau}
          </span>
          <NutHoi mo={moGiai} onBam={() => datMoGiai((x) => !x)} nhan={CHU_SO_TAY.hoi} />
        </span>
      </div>
      {moGiai && <p className={s.giaiKhoi}>{CHU_SO_TAY.giai}</p>}
      <ul className={s.luoi}>
        {thuTu.map((id, i) => {
          const the = THE_KHOANH_KHAC[id];
          const k = daCham.get(id);
          const moi = mo === id;
          return (
            <Fragment key={id}>
              <li>
                <button
                  type="button"
                  className={`${s.o} ${k ? '' : s.oChua} ${moi ? s.oMo : ''}`}
                  data-testid={`kn-${id}`}
                  data-cham={k ? '1' : '0'}
                  aria-expanded={moi}
                  aria-label={k ? `${the.ten}, nặng nhất ${pctCuaBp(k.manh_nhat.delta_bp)}` : `${the.ten}, ${CHU_SO_TAY.chuaCham}`}
                  onClick={() => datMo(moi ? null : id)}
                >
                  <PixelIcon name={ICON_KHOANH_KHAC[id]} size={32} className={s.icon} />
                  <span className={s.ten}>{the.ten}</span>
                  {k
                    ? <span className={k.manh_nhat.delta_bp < 0 ? s.manhAm : s.manhDuong}>{pctCuaBp(k.manh_nhat.delta_bp)}</span>
                    : <span className={s.trong} aria-hidden>·</span>}
                </button>
              </li>
              {i === cuoiHangMo && mo !== null && giai(mo)}
            </Fragment>
          );
        })}
      </ul>
      {/* Chỉ vẽ khi API mới (có `lien_he`) và catalog đã về — thiếu một trong hai thì im, không khung rỗng (D62). */}
      {so.lien_he !== undefined && tuDien && (
        <SoLienHe lienHe={so.lien_he} suKien={tuDien.su_kien} taiSan={tuDien.tai_san} />
      )}
    </section>
  );
}
