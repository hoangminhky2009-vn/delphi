/**
 * ĐỘI CỦA BẠN — khối ở màn kết khi trận thuộc một BÀN CHUNG (16/08, 0040).
 *
 * Đọc `GET /holdem/ban/:ma`. Số của NGƯỜI KHÁC chỉ có khi CHÍNH tôi đã xong —
 * server quyết (A3.1, cùng đề mù), client không tự suy: người chưa xong thấy
 * "đang chơi", không thấy số. Nút CHIA SẺ dùng chung `linkBan` với sảnh.
 * IM khi không phải bàn chung (không render khối rỗng — D62).
 */
import { linkBan, useBan } from '@/api/holdem';
import { NHIP_RUNG, rung } from '@/lib/rung';
import { KetQuaThuThach } from './ThuThachNgay';
import s from './DoiBan.module.css';

export function DoiBan({ ma, dangChoi }: { ma: string | null | undefined; dangChoi?: boolean }) {
  const q = useBan(ma, { poll: !!ma && !dangChoi });
  if (!ma) return null;
  const b = q.data;
  const laNgay = b?.loai === 'ngay';
  const chiaSe = async () => {
    rung(NHIP_RUNG.cham);
    const url = linkBan(ma);
    const text = laNgay
      ? 'Bàn hôm nay của DELPHI — cùng seed, cùng bot, xem ai đọc thị trường giỏi hơn.'
      : `Vào bàn ${ma.toUpperCase()} chơi cùng tôi — cùng một bàn, xem ai đọc thị trường giỏi hơn.`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'DELPHI · Bàn chung', text, url });
        return;
      }
    } catch { /* huỷ share ⇒ sao chép */ }
    try { await navigator.clipboard.writeText(`${text} ${url}`); } catch { /* im */ }
  };
  // BÀN NGÀY (17/08): phân vị, không danh sách tên (D32) — khối riêng, cùng dữ liệu.
  if (b && laNgay) return <KetQuaThuThach b={b} chiaSe={() => void chiaSe()} />;
  return (
    <section className={s.khoi} data-tap="doi-ban" aria-label="Đội của bạn">
      <header className={s.dau}>
        <span className={s.nhan}>ĐỘI CỦA BẠN · BÀN {ma.toUpperCase()}</span>
        {b && <span className={s.phu}>{b.so_nguoi} người · {b.so_o} ô</span>}
      </header>
      {!b ? (
        <div className={s.chu}>{q.isError ? 'Không đọc được bảng đội.' : 'đang đọc…'}</div>
      ) : (
        <ol className={s.ds}>
          {[...b.doi]
            .sort((x, y) => (x.hang ?? 99) - (y.hang ?? 99) || Number(y.xong) - Number(x.xong))
            .map((d) => (
              <li key={d.handle} className={`${s.dong} ${d.la_toi ? s.toi : ''}`}>
                <span className={s.ten}>{d.handle}{d.la_toi ? ' (bạn)' : ''}</span>
                <span className={s.so}>
                  {d.von_cuoi !== undefined
                    ? <>{d.von_cuoi.toLocaleString('vi-VN')} <small>· hạng {d.hang}</small></>
                    : d.xong ? <small>{b.toi_da_xong ? 'xong' : 'xong · số lộ khi bạn chốt bàn'}</small>
                      : d.dang_choi ? <small>đang chơi…</small> : <small>bỏ dở</small>}
                </span>
              </li>
            ))}
        </ol>
      )}
      <div className={s.chan}>
        <button type="button" className={s.nut} onClick={() => void chiaSe()}>RỦ THÊM · CHIA SẺ LINK</button>
        {b && !b.toi_da_xong && <span className={s.chu}>Số của người khác hiện sau khi bạn chốt xong bàn.</span>}
      </div>
    </section>
  );
}
