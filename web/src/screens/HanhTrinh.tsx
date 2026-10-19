/**
 * HÀNH TRÌNH MÙA — trang riêng (founder 01/08: "giống các game như TFT hay
 * LOL, làm thành 1 trang riêng"). Work-order: docs/thiet-ke-da-chot/04.
 *
 * Ba khối, đúng ba lý do của khối Hub cũ (nay Hub chỉ còn bản tóm tắt):
 *  1. TRACK MÙA DỌC (founder 02/08 — bản ngang kiểu TFT tranh chấp cử chỉ
 *     vuốt trang trên điện thoại) — cả 30 mốc thấy được từ phút 0, mỗi mốc
 *     một hàng. "Không biết chơi để làm gì" là bệnh THÔNG TIN; cho xem đích
 *     trước là cách chữa rẻ nhất.
 *  2. VIỆC TUẦN dạng "3/4" — biết còn thiếu gì; trần tuần chạm thì NÓI RA
 *     ("cày thêm không có thêm"), không nói là vừa mất dữ liệu sạch vừa mất
 *     thiện chí.
 *  3. ĐIỂM DANH ngày — một nút, trần 1 lần/ngày VN, server là chân lý (C4).
 *
 * D26: từ vựng quỹ. D25/R1: mọi khối hiện vô điều kiện — không accordion.
 */
import { Link } from 'react-router-dom';
import { NeonButton, PixelIcon } from '@/components/ui';
import { useDiemDanh, useLoTrinh, useNhanQuaBeta, useQuaBeta } from '@/api/nhiem_vu';
import { ROUTE_SHOP } from '@/lib/vocab';
import s from './HanhTrinh.module.css';

/**
 * QUÀ TRI ÂN MÙA BETA (D68b) — khối riêng, tự tải, tự hỏng riêng.
 *
 * Tách khỏi `HanhTrinh` chứ không nhét vào cùng một `useQuery`: quà beta là cửa
 * MỚI, và nếu nó lỗi thì cả trang hành trình không được sập theo. Người chơi
 * vẫn phải xem được 30 mốc của mình.
 *
 * ⚠ BỐN MÓN HIỆN TRƯỚC KHI ĐỦ ĐIỀU KIỆN, và điều kiện hiện dạng SỐ CÒN THIẾU.
 * Một nút xám không nói thiếu gì là một nút bị bỏ qua — mà điều kiện (4 việc lõi
 * + 3 trận) chính là thứ founder dựng lên để chặn tài khoản rỗng. Không cho thấy
 * đường đi thì điều kiện chỉ còn tác dụng chặn, mất hẳn tác dụng dẫn.
 */
function QuaBetaKhoi() {
  const qb = useQuaBeta();
  const nhan = useNhanQuaBeta();
  const q = qb.data;

  // Lỗi/đang tải: im lặng. Khối này là quà thêm, không phải nội dung chính của
  // trang — hiện "đang tải quà…" là thêm nhiễu vào màn vốn đã nhiều số.
  if (q === undefined) return null;

  const thieuViec = Math.max(0, q.viec_loi_can - q.viec_loi_xong);
  const thieuTran = Math.max(0, q.so_tran_can - q.so_tran);

  return (
    <section className={s.khoi} aria-label="Quà tri ân mùa beta">
      <div className={s.khoiDau}>
        <span>QUÀ TRI ÂN MÙA BETA</span>
        <span className={s.khoiPhu}>
          {q.da_nhan ? 'đã nhận' : `còn ${q.con_suat}/${q.tran_nguoi} suất`}
        </span>
      </div>

      <p className={s.quaMon}>
        {q.qua.t} T · {q.qua.q} Q · {q.qua.the_phong} thẻ tạo phòng · Dấu niêm Beta
      </p>
      {/*
        ⚠ THẺ TẠO PHÒNG LÀ VÉ CHO CÁNH CỬA CHƯA MỞ — TẠO PHÒNG đang khoá ở sảnh.
        Founder chọn phát dù đã đọc cảnh báo đó, nên màn PHẢI nói rõ: một tấm vé
        không chú thích là đúng thứ A8.9 cấm.
      */}
      <p className={s.quaGhiChu}>
        Dấu niêm Beta <b>không bao giờ phát lại</b> — mùa sau reset gần hết mọi thứ
        trừ đồ sở hữu. Thẻ tạo phòng dùng được <b>khi cửa Tạo phòng mở</b>.
      </p>

      {q.da_nhan ? (
        <p className={s.quaXong}>✓ Đã vào ví và bộ sưu tập của bạn.</p>
      ) : (
        <>
          <p className={s.quaDieuKien}>
            {q.du_dieu_kien
              ? 'Đủ điều kiện — nhận được rồi.'
              : `Còn thiếu: ${[
                thieuViec > 0 ? `${thieuViec} việc cơ bản` : null,
                thieuTran > 0 ? `${thieuTran} trận` : null,
              ].filter(Boolean).join(' · ')}`}
          </p>
          {nhan.isError && (
            <p className={s.quaLoi} role="alert">{nhan.error.message}</p>
          )}
          <NeonButton
            disabled={!q.du_dieu_kien || q.con_suat === 0 || nhan.isPending}
            onClick={() => nhan.mutate()}
          >
            {nhan.isPending ? 'ĐANG NHẬN…'
              : q.con_suat === 0 ? 'ĐÃ HẾT SUẤT' : 'NHẬN QUÀ'}
          </NeonButton>
        </>
      )}
    </section>
  );
}

export function HanhTrinh() {
  const lt = useLoTrinh();
  const diemDanh = useDiemDanh();
  const d = lt.data;

  if (lt.isError) {
    // Khách 401 — nói thẳng thay vì treo 'đang tải' vô hạn (bắt được khi
    // kiểm prod bằng trình duyệt thật, 01/08).
    return (
      <div className={s.trang}>
        <p className={s.cho}>
          Đăng nhập để xem hành trình mùa — <Link to='/onboard' className={s.linkShop}>đăng nhập</Link>.
        </p>
      </div>
    );
  }
  if (lt.isPending) {
    return <div className={s.trang}><p className={s.cho}>Đang tải hành trình…</p></div>;
  }
  if (d === undefined || !d.mua_mo) {
    return (
      <div className={s.trang}>
        <p className={s.cho}>Mùa chưa mở. Quay lại khi mùa Beta bắt đầu.</p>
      </div>
    );
  }

  const xongHet = d.viec.length > 0 && d.viec.every((v) => v.xong);
  const mocKe = d.moc.find((m) => !m.da_nhan) ?? null;
  const phanTram = Math.min(100, Math.floor((d.chang * 100) / d.so_chang));

  return (
    <div className={s.trang}>
      {/* ── Đầu trang: mùa · tuần · số dư Q ─────────────────────────────── */}
      <header className={s.dau}>
        <div className={s.dauTen}>
          <PixelIcon name="medal" size={20} />
          <h1>HÀNH TRÌNH MÙA 0.0 <small>BETA ACCESS</small></h1>
        </div>
        <div className={s.dauSo}>
          <span className={s.tuan}>TUẦN {d.tuan}/{d.so_tuan}</span>
          <span className={s.q}><PixelIcon name="coin" size={14} /> {d.quest_points} Q</span>
        </div>
      </header>

      {/* ── Track mùa cuộn ngang kiểu TFT — CẢ 30 mốc, không giấu mốc nào ── */}
      <section className={s.khoi} aria-label="Track mùa">
        <div className={s.khoiDau}>
          <span>CHẶNG {d.chang}/{d.so_chang}</span>
          <span className={s.khoiPhu}>
            {mocKe ? `mốc kế: chặng ${mocKe.chang_no}` : 'đã nhận hết mốc mùa này'}
          </span>
        </div>
        <div className={s.thanh}>
          <span className={s.thanhTrong} style={{ width: `${phanTram}%` }} />
        </div>
        <div className={s.track} role="list">
          {d.moc.map((m) => {
            const trangThai = m.da_nhan ? s.mocNhan
              : (m.chang_no === mocKe?.chang_no ? s.mocKe : s.mocKhoa);
            return (
              <div key={m.chang_no} role="listitem" className={`${s.moc} ${trangThai}`}>
                <span className={s.mocSo}>{m.chang_no}</span>
                {/* Thưởng của mốc: Q, hoặc cosmetic có tên — server quyết. */}
                {m.nhan !== null ? (
                  <span className={s.mocNhan2}>{m.nhan}</span>
                ) : (
                  <span className={s.mocQ}>+{m.q} Q</span>
                )}
                {m.doc_ban && <span className={s.mocDocBan}>ĐỘC BẢN</span>}
                {/* Thưởng chốt thiết kế nhưng chưa có art — nói thật, không vẽ đại. */}
                {m.cho_art && <span className={s.mocChoArt}>chờ art</span>}
                {m.da_nhan && <span className={s.mocTick}>✓</span>}
              </div>
            );
          })}
        </div>
      </section>

      <QuaBetaKhoi />

      {/* ── Điểm danh ngày ──────────────────────────────────────────────── */}
      <section className={s.khoi} aria-label="Điểm danh ngày">
        <div className={s.diemDanhHang}>
          <div>
            <div className={s.khoiDau}><span>ĐIỂM DANH NGÀY</span></div>
            <p className={s.khoiPhu}>Mỗi ngày một lần — đóng góp thẳng vào việc tuần.</p>
          </div>
          <NeonButton
            onClick={() => diemDanh.mutate()}
            disabled={d.da_diem_danh_hom_nay || diemDanh.isPending}
          >
            {d.da_diem_danh_hom_nay ? 'ĐÃ ĐIỂM DANH HÔM NAY' : 'ĐIỂM DANH'}
          </NeonButton>
        </div>
      </section>

      {/* ── Việc tuần — tiến độ dạng n/m, trần tuần phải NÓI RA ─────────── */}
      <section className={s.khoi} aria-label="Việc tuần">
        <div className={s.khoiDau}><span>VIỆC TUẦN NÀY</span></div>
        <ul className={s.viec}>
          {d.viec.map((v) => (
            <li key={v.nv_id} className={v.xong ? s.viecXong : s.viecMo}>
              <PixelIcon name={v.xong ? 'medal' : 'target'} size={14} />
              <span className={s.viecTen}>{v.ten}</span>
              <span className={s.viecThanh}>
                <span
                  className={s.viecThanhTrong}
                  style={{ width: `${Math.min(100, Math.floor((v.da * 100) / Math.max(1, v.muc)))}%` }}
                />
              </span>
              <span className={s.viecSo}>{Math.min(v.da, v.muc)}/{v.muc}</span>
            </li>
          ))}
        </ul>
        {xongHet && (
          <p className={s.hetViec}>
            HẾT VIỆC TUẦN NÀY — cày thêm không có thêm; việc mới mở đầu tuần sau.
          </p>
        )}
        <p className={s.chanTrang}>
          Q tiêu ở <Link to={ROUTE_SHOP} className={s.linkShop}>SHOP</Link> — diện mạo
          và tiện ích, giá niêm yết.
        </p>
      </section>
    </div>
  );
}
