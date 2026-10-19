/**
 * TAB KHO — mọi bảng, mọi cột, đọc thẳng (D209).
 *
 * Founder 31/08: "panel admin phải hiện tất cả những thứ có trong database
 * nhằm phục vụ mục đích phân tích và định hướng sản phẩm."
 *
 * Bảy tab kia trả lời những câu ĐÃ được nghĩ ra trước rồi mới viết SQL. Tab này
 * trả lời những câu CHƯA ai nghĩ ra — nên nó cố tình KHÔNG diễn giải gì: không
 * gộp, không suy ra tỷ lệ, không đặt tên đẹp cho cột. Diễn giải là việc của bảy
 * tab kia; ở đây thêm một lớp diễn giải là thêm một chỗ để nó nói sai.
 *
 * ⚠ HAI THỨ PHẢI LUÔN HIỆN, và chúng là lý do mặt này đáng tin:
 *  1. **Bản kê cột bị khoá** — ngay đầu mặt, kèm lý do. Một mặt tự nhận "hiện
 *     tất cả" mà lại giấu vài cột trong im lặng thì lần đầu ai đó phát hiện là
 *     lần cuối họ tin nó.
 *  2. **Số dòng THẬT của từng bảng**, không phải ước lượng. Xem chú thích
 *     `dem` ở `server/admin_kho.ts` — ước lượng trả 0 cho bảng chưa ANALYZE.
 */
import { useEffect, useRef, useState } from 'react';
import { useKhoBang, useKhoDong } from '@/api/thongke';
import { Cho } from './Cho';
import s from './QuanTri.module.css';

const so = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : n.toLocaleString('vi-VN');

const co = (b: number): string => (b >= 1048576
  ? `${(b / 1048576).toFixed(1)} MB`
  : `${Math.max(1, Math.round(b / 1024))} KB`);

const NHAN_KHOA: Record<string, string> = {
  an_han: 'ẨN HẲN — khoá xác thực, đọc được là đăng nhập được dưới danh nghĩa người khác',
  che: 'CHE — còn nhận ra người, không đọc ra được danh sách',
  rut_gon: 'RÚT GỌN — chỉ hiện cỡ byte; ruột đã mã hoá đầu-cuối, máy chủ không có chìa',
};


export function MatKho() {
  const [chon, datChon] = useState<string | null>(null);
  const [trang, datTrang] = useState(0);
  const [sap, datSap] = useState('');
  const [chieu, datChieu] = useState('desc');
  const [day, datDay] = useState(false);

  const bang = useKhoBang();
  const dong = useKhoDong(chon, { trang, sap, chieu, day });

  /*
   * ⚠ TỰ CUỘN TỚI DỮ LIỆU KHI MỞ MỘT BẢNG — phát hiện khi soi thật, không phải
   * khi đọc code. Kho có 57 bảng nên danh sách cao ~2.500px; bấm một bảng xong
   * mà đứng nguyên chỗ cũ thì người dùng thấy KHÔNG GÌ XẢY RA, phải tự cuộn một
   * quãng dài để tìm thứ mình vừa mở. Một mặt để "tự tìm thấy thứ chưa biết là
   * mình cần" mà mỗi cú mở tốn một lần đi lạc thì sẽ không ai mở tới bảng thứ ba.
   *
   * Neo theo `chon` chứ không theo `dong.data`: cuộn ngay lúc bấm, không đợi
   * mạng trả về — chỗ đó đã có dòng "đang tải…" nên người dùng thấy đúng thứ
   * mình vừa yêu cầu, kể cả khi mạng chậm.
   */
  const neo = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (chon !== null) neo.current?.scrollIntoView({ block: 'start' });
  }, [chon]);

  /** Đổi bảng là đổi cả bộ toạ độ — giữ lại số trang cũ là đọc trang 7 của một
   *  bảng có 2 trang, tức một bảng rỗng trông y hệt một bảng thật sự rỗng. */
  const moBang = (ten: string) => {
    datChon(ten); datTrang(0); datSap(''); datChieu('desc'); datDay(false);
  };

  /** Bấm lại đúng cột đang sắp thì đảo chiều — nếp bảng ai cũng biết. */
  const doiSap = (ten: string, hienTai: string) => {
    if (ten === hienTai) { datChieu(chieu === 'desc' ? 'asc' : 'desc'); return; }
    datSap(ten); datChieu('desc'); datTrang(0);
  };

  return (
    <>
      <Cho q={bang} con={bang.data ? (
        <>
          <div className={s.hangO}>
            <div className={s.o}>
              <div className={s.oNhan}>BẢNG</div>
              <div className={s.oGt}>{so(bang.data.bang.length)}</div>
            </div>
            <div className={s.o}>
              <div className={s.oNhan}>TỔNG SỐ DÒNG</div>
              <div className={s.oGt}>{so(bang.data.tong_dong)}</div>
              <div className={s.oPhu}>đếm thật, không ước lượng</div>
            </div>
            <div className={s.o}>
              <div className={s.oNhan}>DUNG LƯỢNG</div>
              <div className={s.oGt}>{co(bang.data.tong_byte)}</div>
              <div className={s.oPhu}>trần free tier 500 MB</div>
            </div>
          </div>

          {/*
            Bản kê cột bị khoá đứng TRƯỚC dữ liệu, không nhét xuống chân trang.
            Nó là điều kiện để đọc đúng mọi thứ bên dưới.
          */}
          <p className={s.khoiTieuDe}>CỘT KHÔNG HIỆN NGUYÊN VẸN</p>
          <div className={s.khoi}>
            <table className={s.bang}>
              <tbody>
                {(['an_han', 'che', 'rut_gon'] as const).map((k) => (
                  <tr key={k}>
                    <td><code>{bang.data!.khoa[k].join(' · ') || '—'}</code></td>
                    <td className={s.mo}>{NHAN_KHOA[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={s.khoiTieuDe}>BẢNG TRONG KHO — chạm để mở</p>
          <div className={s.khoi}>
            <table className={s.bang}>
              <thead>
                <tr><th>bảng</th><th className={s.phai}>dòng</th>
                  <th className={s.phai}>cột</th><th className={s.phai}>cỡ</th></tr>
              </thead>
              <tbody>
                {bang.data.bang.map((b) => (
                  <tr key={b.ten}>
                    <td>
                      <button type="button"
                        className={b.ten === chon ? `${s.tab} ${s.tabChon}` : s.chip}
                        onClick={() => moBang(b.ten)}>{b.ten}</button>
                    </td>
                    <td className={s.phai}>{so(b.dong ?? b.dong_uoc)}</td>
                    <td className={s.phai}>{so(b.cot)}</td>
                    <td className={s.phai}>{co(b.byte)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null} />

      {chon === null ? null : (
        <>
          <p className={s.khoiTieuDe} ref={neo}>{chon.toUpperCase()}</p>
          <Cho q={dong} con={dong.data ? (
            <>
              <p className={s.moc}>
                sắp theo <code>{dong.data.sap}</code> {dong.data.chieu} · trang{' '}
                {dong.data.trang + 1} · {dong.data.dong.length} dòng{' '}
                <button type="button" className={s.chip}
                  onClick={() => { datDay(!day); datTrang(0); }}>
                  {day ? 'ô đã mở hết — thu lại' : 'mở hết ô bị cắt (5 dòng)'}
                </button>{' '}
                <button type="button" className={s.chip} disabled={trang === 0}
                  onClick={() => datTrang(trang - 1)}>‹ trước</button>{' '}
                <button type="button" className={s.chip} disabled={!dong.data.con_nua}
                  onClick={() => datTrang(trang + 1)}>sau ›</button>
              </p>
              <div className={s.khoi}>
                <table className={s.bang}>
                  <thead>
                    <tr>
                      {dong.data.cot.map((c) => (
                        <th key={c.ten}>
                          {c.an === 'an_han' ? (
                            <span className={s.mo} title={NHAN_KHOA.an_han}>
                              {c.ten} 🔒
                            </span>
                          ) : (
                            <button type="button" className={s.chip}
                              title={c.an ? NHAN_KHOA[c.an] : c.kieu}
                              onClick={() => doiSap(c.ten, dong.data!.sap)}>
                              {c.ten}{c.ten === dong.data!.sap
                                ? (dong.data!.chieu === 'desc' ? ' ▼' : ' ▲') : ''}
                              {c.an ? ' •' : ''}
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dong.data.dong.map((r, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <tr key={i}>
                        {dong.data!.cot.map((c) => (
                          <td key={c.ten}>
                            {c.an === 'an_han'
                              ? <span className={s.mo}>🔒</span>
                              : (r[c.ten] === null || r[c.ten] === undefined
                                ? <span className={s.mo}>null</span>
                                : String(r[c.ten]))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dong.data.dong.length === 0
                ? <p className={s.mo}>Bảng này không có dòng nào.</p> : null}
            </>
          ) : null} />
        </>
      )}
    </>
  );
}
