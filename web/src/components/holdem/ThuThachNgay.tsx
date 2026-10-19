/**
 * THỬ THÁCH HÔM NAY — bàn ngày (17/08; D85 §5.2 founder chốt "cả hai", migration
 * 0041). Một bàn CHUNG cho cả ngày (giờ VN), ai cũng chơi cùng seed cùng bot,
 * xong thì thấy PHÂN VỊ của mình so với cả sân. Nền của kèo T (D95).
 *
 * Hai mặt, MỘT nguồn chữ:
 *   · `ThuThachNgayCard` — card ở sảnh: CHƯA VÀO / ĐANG CHƠI, đọc từ
 *     `GET /holdem/ngay` (server phát bàn, biết tôi ở đâu). ⚠ ĐÃ XONG thì card
 *     BIẾN MẤT (founder 23/08) — xem lý lẽ tại chỗ;
 *   · `KetQuaThuThach` — khối ở màn kết khi trận thuộc bàn ngày (từ `BanDTO`),
 *     và từ 23/08 nó là chỗ DUY NHẤT phân vị hiện ra.
 *
 * D32 (đọc trước khi chạm bảng xếp hạng): hiện PHÂN VỊ cho MỌI người, KHÔNG top-N,
 * không danh sách tên — server đã không gửi (`doi` rỗng), client không có gì để
 * lỡ tay vẽ. A3.1: hạng/phân vị của tôi chỉ có sau khi tôi xong — server quyết,
 * client chỉ vẽ trường có mặt.
 * ⚠ Ít người thì "TOP 100%" là câu vô duyên: dưới `IT_NGUOI` người xong, đổi
 * lời thành "bạn là người thứ h trong N" — cùng số, khác cách nói.
 */
import { useNavigate } from 'react-router-dom';
import { PixelIcon } from '@/components/ui';
import { useThuThachNgay, type BanDTO } from '@/api/holdem';
import { duongDanTran } from '@/lib/vocab';
import { NHIP_RUNG, rung } from '@/lib/rung';
import s from './ThuThachNgay.module.css';

/** Dưới ngưỡng này, không nói "TOP x%" (một mình = TOP 100% — đúng nhưng vô duyên). */
export const IT_NGUOI = 3;

/** "17/08" từ "2026-08-17" — hiển thị ngày kiểu VN. */
export const ngayNgan = (ngay: string): string => {
  const [, m, d] = ngay.split('-');
  return d && m ? `${d}/${m}` : ngay;
};

/** Còn bao lâu tới lúc bàn đóng — "còn 5h" / "còn 40'" / "sắp đóng". */
export const conLai = (hetHan: string, now = Date.now()): string => {
  const ms = new Date(hetHan).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 60_000) return 'sắp đóng';
  const h = Math.floor(ms / 3_600_000);
  const p = Math.floor((ms % 3_600_000) / 60_000);
  return h >= 1 ? `còn ${h}h${p > 0 && h < 3 ? `${String(p).padStart(2, '0')}` : ''}` : `còn ${p}'`;
};

/** Câu phân vị — MỘT nguồn cho sảnh lẫn màn kết. */
export function cauPhanVi(t: NonNullable<BanDTO['thu_thach']>): string | null {
  if (t.hang === undefined || t.tong === undefined || t.top_pct === undefined) return null;
  if (t.tong < IT_NGUOI) return `bạn là người thứ ${t.hang} trong ${t.tong} người đã xong`;
  return `TOP ${t.top_pct}% · hạng ${t.hang}/${t.tong}`;
}

/** Hai mặt của MỘT phân vị — `to` (số to) + `duoi` (dòng phụ). Cùng nguồn với `cauPhanVi`: ô "hôm nay xong" ở sảnh bento dùng nó. */
export function phanViGon(t: NonNullable<BanDTO['thu_thach']>): { to: string; duoi: string } | null {
  if (t.hang === undefined || t.tong === undefined || t.top_pct === undefined) return null;
  if (t.tong < IT_NGUOI) return { to: `#${t.hang}`, duoi: `người thứ ${t.hang} trong ${t.tong} người đã xong` };
  return { to: `TOP ${t.top_pct}%`, duoi: `hạng ${t.hang}/${t.tong}` };
}

/** Trạng thái thử thách hôm nay của TÔI — MỘT nguồn cho card cũ và ô chính của sảnh bento (đang hỏi · lỗi · chưa vào · đang chơi · xong). */
export type TrangThaiNgay = 'doc' | 'loi' | 'chua' | 'dang' | 'xong';
export function trangThaiNgay(b: BanDTO | undefined, loi: boolean): TrangThaiNgay {
  if (!b) return loi ? 'loi' : 'doc';
  return b.toi_da_xong ? 'xong' : b.toi?.status === 'dang_choi' ? 'dang' : 'chua';
}

export function ThuThachNgayCard({ onVao }: { onVao: (ma: string) => void }) {
  const navigate = useNavigate();
  const q = useThuThachNgay();
  const b = q.data;
  const t = b?.thu_thach;
  const trangThai = trangThaiNgay(b, q.isError);

  /*
   * ⭐ CHƠI XONG RỒI THÌ CARD ĐI (founder 23/08: *"cái phần thử thách hôm nay ở
   * hub của đấu trường ấy thì bạn có thể để nó biến mất sau khi player chơi và
   * hoàn thành nhiệm vụ không?"*).
   *
   * Card này đứng ĐẦU sảnh và là thứ to nhất màn — đúng chỗ của nó khi còn một
   * lượt để chơi. Xong rồi thì nó thành một tấm bảng thông báo chiếm chỗ nổi
   * bật nhất để nói "hết việc", mỗi lần vào sảnh, tới tận 0:00. Một lượt/ngày
   * (UNIQUE ở tầng DB, migration 0040) nên không có gì để bấm nữa.
   *
   * ⚠ PHÂN VỊ KHÔNG BỊ CHÔN: nó vẫn hiện ở MÀN KẾT của chính bàn đó
   * (`KetQuaThuThach`), là chỗ người chơi vừa đi qua. Thứ mất đi là đường xem
   * LẠI từ sảnh — chấp nhận được vì phân vị của một bàn đã đóng sổ với mình
   * không còn là việc phải làm, và mai có bàn mới.
   * ⚠ Query vẫn chạy (`useThuThachNgay`) — sảnh cần biết trạng thái để QUYẾT
   * ĐỊNH ẩn; đây là ẩn ở tầng TRÌNH BÀY, không phải thôi hỏi server.
   */
  if (trangThai === 'xong') return null;

  const bam = () => {
    if (!b) return;
    rung(NHIP_RUNG.nang);
    if (trangThai === 'dang' && b.toi) { navigate(duongDanTran(b.toi.match_id)); return; }
    onVao(b.ma);
  };
  /*
   * ⚠ D336 lượt 2 — CARD GỌN (founder 15/09: *"Thu gọn cái này lại, chỉ hiện thử thách hôm nay, màn
   * chơi, số giờ còn lại của thử thách và vào bàn hôm nay thôi"*). Bỏ đoạn mô tả hai câu + số người
   * đã vào: người quay lại mỗi ngày đọc nó một lần là thuộc, còn chỗ đứng đầu sảnh thì trả mỗi lần
   * mở. Giữ đúng bốn thứ: tên + ngày · cỡ bàn · giờ còn lại · nút. Số người cả sân vẫn ở phòng chờ
   * ("CẢ SÂN · …") và phân vị ở màn kết — không mất tin nào, chỉ thôi nói ở sảnh.
   * Trạng thái đang tải / lỗi đi vào chính ô phụ bên phải (nơi "12 ô · còn 4h" sẽ đứng).
   */
  const phu = b ? `${b.so_o} ô · ${conLai(b.het_han)}`
    : trangThai === 'loi' ? 'chưa đọc được — kéo lại trang' : 'đang hỏi…';
  return (
    <button
      type="button"
      className={s.the}
      data-tap="thu-thach-ngay"
      data-trang-thai={trangThai}
      onClick={bam}
      disabled={trangThai === 'doc' || trangThai === 'loi'}
    >
      <span className={s.tieuDe}>
        <span className={s.moRong}>
          <PixelIcon name="flame" size={16} className={s.icon} />
          {' '}THỬ THÁCH HÔM NAY{t ? ` · ${ngayNgan(t.ngay)}` : ''}
        </span>
        <span className={s.phu}>{phu}</span>
      </span>
      {trangThai === 'chua' && <span className={s.nutGia}>▶ VÀO BÀN HÔM NAY</span>}
      {trangThai === 'dang' && <span className={s.nutGia}>▶ CHƠI TIẾP BÀN HÔM NAY</span>}
    </button>
  );
}

/** Khối ở MÀN KẾT khi trận thuộc bàn ngày — thay cho ĐỘI (bàn đội). */
export function KetQuaThuThach({ b, chiaSe }: { b: BanDTO; chiaSe: () => void }) {
  const t = b.thu_thach;
  if (!t) return null;
  const cau = cauPhanVi(t);
  return (
    <section className={s.ket} data-tap="ket-thu-thach" aria-label="Thử thách hôm nay">
      <header className={s.ketDau}>
        <span className={s.nhan}>THỬ THÁCH HÔM NAY · {ngayNgan(t.ngay)}</span>
        <span className={s.phu}>{t.so_nguoi_xong} người đã xong</span>
      </header>
      {cau ? (
        <div className={s.ketSo}>
          <span className={s.ketTo}>{t.tong !== undefined && t.tong >= IT_NGUOI ? `TOP ${t.top_pct}%` : `#${t.hang}`}</span>
          <span className={s.ketChu}>{cau}{t.nav !== undefined ? ` · NAV ${t.nav.toLocaleString('vi-VN')}` : ''}</span>
        </div>
      ) : (
        <div className={s.chu}>Phân vị hiện sau khi bạn chốt xong bàn.</div>
      )}
      <div className={s.chan}>
        <button type="button" className={s.nut} onClick={chiaSe}>RỦ BẠN CHƠI BÀN HÔM NAY</button>
        <span className={s.chu}>Cùng seed, cùng bot — bàn đóng lúc 0:00, mai có bàn mới.</span>
      </div>
    </section>
  );
}
