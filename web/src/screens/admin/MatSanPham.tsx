/**
 * KHU SẢN PHẨM của app quản trị riêng (D335) — bốn mặt cũ của `/quan-tri` (kèo · trận & hạng · tính cách ·
 * phiên bản), nhận công tắc CHUNG "gồm quản trị & thử" từ thanh thời gian.
 *
 * ⚠ D341: cả bốn mặt nhận KHOẢNG NGÀY của thanh thời gian (`k`) — trước đó không mặt nào nhận, nên đổi mốc không đổi
 * số (founder bắt trên prod 16/09). Mỗi mặt nói rõ nó cắt theo khoảng THẾ NÀO ngay trên số.
 *
 * ⚠ Trước D335 bốn mặt này không nhận công tắc nào từ màn: `tk/keo` và ô "thoát theo vòng" không lọc ai cả,
 * còn `gom_tester` chưa từng được gửi. Server nay lọc đủ (`tests/loai_admin_khoi_phan_tich.test.ts` §IV).
 * ⚠ Hai mặt NHÓM và NGƯỜI cũ nằm ở đây đã rời đi: khu PHÂN KHÚC và NGƯỜI DÙNG thay (`src/quan-tri/`).
 */
import { useState } from 'react';
import {
  useKeoSP, usePhienBanSP, useTinhCachSP, useTranSP, type ThamSoKhoang, type TranDTO,
} from '@/api/phantich';
import { ngayDu } from '@/quan-tri/khoang';
import { THE_TINH_CACH, type Giong } from '@/lib/tinh_cach';
import { Cho } from './Cho';
import s from './QuanTri.module.css';

const so = (n: number | null | undefined, hau = ''): string =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('vi-VN')}${hau}`;
const pct = (x: number | null): string => (x === null ? '—' : `${Math.round(x * 100)}%`);

function O({ nhan, gt, phu }: { nhan: string; gt: string; phu?: string }) {
  return (
    <div className={s.o}>
      <div className={s.oNhan}>{nhan}</div>
      <div className={s.oGt}>{gt}</div>
      {phu ? <div className={s.oPhu}>{phu}</div> : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * MẶT KÈO + TRẬN
 * ══════════════════════════════════════════════════════════════════════════ */

export function MatKeo({ k }: { k: ThamSoKhoang }) {
  const q = useKeoSP(k);
  return (
    <Cho q={q} con={q.data ? (
      <>
        <div className={s.hangO}>
          {/*
            Tín hiệu B2B đắt nhất (§4.2 mục 9). 1,00 = tất tay một cửa;
            1/số cửa = rải đều. D19/D25/D32 dựng riêng để giữ cột này sạch.
          */}
          <O nhan="ĐỘ ĐẬM ĐẶC TB" gt={q.data.khau_vi_rui_ro.tb?.toFixed(2) ?? '—'}
            phu={`trung vị ${q.data.khau_vi_rui_ro.p50?.toFixed(2) ?? '—'}`} />
          <O nhan="DỒN MỘT CỬA" gt={so(q.data.khau_vi_rui_ro.tat_tay)}
            phu={`trên ${so(q.data.khau_vi_rui_ro.n)} lượt`} />
          <O nhan="THẤY PHÂN BỐ POOL" gt={so(q.data.bay_dan.da_thay)} />
          <O nhan="CHỈNH SAU KHI THẤY" gt={so(q.data.bay_dan.co_chinh_sau)}
            phu="hiệu ứng bầy đàn" />
        </div>
        <p className={s.mo}>
          Bốn ô trên tính trên các lượt đặt TRONG khoảng; “chỉnh sau khi thấy” là người thấy pool lần đầu trong khoảng
          rồi có chỉnh (kể cả sau khoảng).
        </p>
        <div className={s.khoi}>
          <h3 className={s.khoiTieuDe}>KÈO TRONG KHOẢNG</h3>
          <p className={s.mo}>
            Kèo mở trong khoảng hoặc có người đặt trong khoảng — người &amp; volume chỉ đếm lượt đặt trong khoảng.
          </p>
          <table className={s.bang}>
            <thead>
              <tr><th>câu hỏi</th><th>pool</th><th>trạng thái</th>
                <th className={s.phai}>người</th><th className={s.phai}>volume</th></tr>
            </thead>
            <tbody>
              {q.data.keo_trong_khoang.length === 0
                ? <tr><td colSpan={5} className={s.mo}>không có kèo nào trong khoảng này</td></tr>
                : q.data.keo_trong_khoang.map((keo) => (
                  <tr key={keo.market_id}>
                    <td>{keo.question_text}</td>
                    <td className={s.mo}>{keo.pool}</td>
                    <td className={s.mo}>{keo.status}</td>
                    <td className={s.phai}>{so(keo.nguoi)}</td>
                    <td className={s.phai}>{so(Number(keo.volume), ' T')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </>
    ) : null} />
  );
}

/**
 * Dải "đang xem phiên bản nào, trên bao nhiêu trận".
 *
 * ⚠ Nó đứng TRÊN mọi con số của mặt, không nằm dưới chân — vì nó là ĐIỀU KIỆN
 * để đọc mấy con số kia, không phải chú thích cho chúng.
 */
function DaiVer({ loc, mau }: { loc: TranDTO['loc']; mau: TranDTO['mau'] }) {
  return (
    <div className={s.dai}>
      <span className={s.daiNhan}>ĐANG XEM</span>
      <span className={s.daiVer}>
        {loc.che_do === 'tat_ca' ? 'MỌI PHIÊN BẢN CÒN DỰNG LẠI ĐƯỢC' : loc.ver}
      </span>
      {loc.ver === loc.ver_hien_tai
        ? <span className={s.daiNhan}>(bản đang chạy)</span> : null}
      <span className={s.daiNhan}>·</span>
      <span className={mau.mong ? s.daiMong : undefined}>
        {so(mau.tran)} trận bắt đầu trong khoảng · {so(mau.xong)} xong · {so(mau.nguoi)} người
        {mau.mong ? ` · ⚠ MẪU MỎNG (< ${mau.san_tin_cay} trận xong)` : ''}
      </span>
    </div>
  );
}

export function MatTran({ k }: { k: ThamSoKhoang }) {
  /*
   * `undefined` = để SERVER chọn mặc định. Cố ý không gõ lại tên phiên bản hiện
   * tại ở client: bản thứ hai của cùng một sự thật sẽ trôi (D61), và cú trôi ở
   * đây biểu hiện là "mặt admin lọc theo một phiên bản, engine chạy phiên bản khác".
   */
  const [ver, setVer] = useState<string | undefined>(undefined);
  const q = useTranSP(ver, k);
  const dsVer = usePhienBanSP(k);
  // Ô chọn chỉ liệt kê phiên bản CÓ trận trong khoảng — phiên bản đang chọn mà khoảng mới không có vẫn phải hiện,
  // không thì ô chọn đứng ở một giá trị không có trong danh sách.
  const dsTen = (dsVer.data?.dong ?? [])
    .filter((d) => d.giai_doan !== 'khong_dung_lai_duoc')
    .map((d) => d.ver)
    .concat(ver && ver !== 'tat_ca' ? [ver] : [])
    .filter((v, i, a) => a.indexOf(v) === i);
  return (
    <Cho q={q} con={q.data ? (
      <>
        <div className={s.dai}>
          <span className={s.daiNhan}>PHIÊN BẢN</span>
          <select
            className={s.chonVer} value={ver ?? ''}
            aria-label="Chọn phiên bản cân bằng"
            onChange={(e) => setVer(e.target.value === '' ? undefined : e.target.value)}
          >
            <option value="">— bản đang chạy —</option>
            <option value="tat_ca">tất cả (còn dựng lại được)</option>
            {/* Chỉ liệt kê phiên bản CÓ dữ liệu và CÒN dựng lại được: bày một
                phiên bản đã chết trong ô chọn là mời người ta chọn nó. */}
            {dsTen.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <DaiVer loc={q.data.loc} mau={q.data.mau} />
        <div className={s.hangO}>
          <O nhan="CHUỖI VỀ BÉT DÀI NHẤT" gt={so(q.data.chuoi_ve_bet.dai_nhat)} />
          <O nhan="CHUỖI ≥3 TRẬN" gt={so(q.data.chuoi_ve_bet.so_lan_tu_3)}
            phu={`${so(q.data.chuoi_ve_bet.nguoi_dinh)} người dính`} />
        </div>
        <div className={s.luoi}>
          <div className={s.khoi}>
            {/* Hạng KHÔNG có nghĩa nếu thiếu số ghế: "hạng 4" ở bàn 4 là BÉT. */}
            <h3 className={s.khoiTieuDe}>PHÂN BỐ THỨ HẠNG</h3>
            <table className={s.bang}>
              <thead><tr><th>hạng / số ghế</th><th className={s.phai}>lượt</th></tr></thead>
              <tbody>
                {q.data.phan_bo_hang.map((h) => (
                  <tr key={`${h.so_ghe}-${h.hang}`}>
                    <td>{h.hang} / {h.so_ghe}{h.hang === h.so_ghe ? ' (bét)' : ''}</td>
                    <td className={s.phai}>{so(h.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={s.khoi}>
            <h3 className={s.khoiTieuDe}>THOÁT GIỮA CHỪNG THEO VÒNG</h3>
            {/* Máy chủ trả cờ này vì lượt thoát không chở mã trận — nói ra, đừng để người đọc tưởng nó cùng bộ lọc. */}
            {q.data.thoat_khong_loc_duoc_ver ? (
              <p className={s.mo}>⚠ ô này GỘP MỌI PHIÊN BẢN (lượt thoát không ghi trận nào) · chỉ tính người đang bật ghi</p>
            ) : null}
            <table className={s.bang}>
              <thead><tr><th>vòng</th><th className={s.phai}>lượt thoát</th></tr></thead>
              <tbody>
                {q.data.thoat_theo_vong === null
                  ? <tr><td colSpan={2} className={s.mo}>không đo được — dữ liệu thao tác thô chỉ còn từ {ngayDu(q.data.khoang.tho_tu)}</td></tr>
                  : q.data.thoat_theo_vong.length === 0
                  ? <tr><td colSpan={2} className={s.mo}>không có trong khoảng này</td></tr>
                  : q.data.thoat_theo_vong.map((t) => (
                    <tr key={t.vong}><td>{t.vong}</td><td className={s.phai}>{so(t.n)}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    ) : null} />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * MẶT TÍNH CÁCH — bảng tỷ lệ cho product (08/08, hướng B2C)
 *
 * Founder: *"phần tôi thì chỉ cần data để làm product và phân tích tỷ lệ"* —
 * nên mặt này CHỈ có hai bảng: phân bố tính cách (cùng catalog chữ với thẻ
 * người chơi — một nguồn) và trung bình sáu chỉ số. Mọi số kèm cỡ mẫu.
 * ══════════════════════════════════════════════════════════════════════════ */

export function MatTinhCach({ k }: { k: ThamSoKhoang }) {
  const q = useTinhCachSP(k);
  const NHAN_TB: Record<string, string> = {
    brier: 'Brier trung bình (0–2, thấp = chuẩn)',
    duoi_gia: 'Đuổi giá (phần mua trong chuỗi xanh)',
    theo_tin: 'Vào lệnh trong vòng tin nóng',
    an_tin_gia: 'Phần cú vào rơi trúng tin dựng',
    chot_non: 'Chốt non − cắt lỗ (dương = ôm lỗ)',
    don_von_sau_thang: 'Cỡ mua sau thắng (× nền)',
    don_von_sau_thua: 'Cỡ mua sau thua (× nền)',
    mua_tin: 'Tỷ lệ vòng mở Bảng điện tử',
  };
  return (
    <Cho q={q} con={q.data ? (
      <>
        <div className={s.khoi}>
          <h3 className={s.khoiTieuDe}>
            PHÂN BỐ TÍNH CÁCH · {q.data.n_nguoi} người có trận trong khoảng
          </h3>
          {/* Founder chốt 16/09: nhóm theo khoảng, hồ sơ theo cả lịch sử — một gói cần ≥10 trận liên tiếp. */}
          <p className={s.mo}>
            Nhóm = người có ít nhất một trận bắt đầu trong khoảng; hồ sơ của mỗi người dựng trên CẢ lịch sử của họ
            (một hồ sơ cần ≥10 trận liên tiếp — cắt theo ngày thì khoảng ngắn không còn hồ sơ nào).
          </p>
          {/* Nói ra vì sao cỡ mẫu nhỏ — im lặng thì lần sau ai đó "sửa" bằng
              cách gỡ cổng đồng ý (D101). */}
          <p className={s.mo}>
            Chỉ gộp người ĐÃ đồng ý nghiên cứu
            {q.data.bo_qua_chua_dong_y > 0
              ? ` · đã loại ${so(q.data.bo_qua_chua_dong_y)} người chưa đồng ý` : ''}
            {' '}· ô dưới {q.data.san_o} người gộp thành “ô mỏng”.
          </p>
          {/*
            ⚠ Mặt này KHÔNG cắt được theo phiên bản (một gói = ≥10 trận liên tiếp,
            vắt qua nhiều lần lật cổng balance). Nên nó KHAI ĐỘ TRỘN thay vì im
            lặng gộp — người đọc phải biết chân dung này dựng trên mấy bộ luật.
          */}
          <p className={q.data.tron_phien_ban.ty_le_khong_dung_lai_duoc > 0
            ? s.daiChet : s.mo}>
            Trộn {so(q.data.tron_phien_ban.so_phien_ban)} phiên bản cân bằng
            {' '}trên {so(q.data.tron_phien_ban.n_vong)} vòng
            {q.data.tron_phien_ban.ty_le_khong_dung_lai_duoc > 0
              ? ` · ⚠ ${pct(q.data.tron_phien_ban.ty_le_khong_dung_lai_duoc)} số vòng`
                + ' đến từ phiên bản KHÔNG DỰNG LẠI ĐƯỢC (luật đã biến mất khỏi code)'
              : ''}
          </p>
          <table className={s.bang}>
            <tbody>
              {Object.entries(q.data.phan_bo)
                .sort((a, b) => b[1] - a[1])
                .map(([id, n]) => {
                  // Bảng admin nói giọng CHỮNG — đây là bảng số, không phải tấm thẻ khoe.
                  const the = THE_TINH_CACH[id as keyof typeof THE_TINH_CACH]?.['chung' as Giong];
                  const ten = id === '_it_hon_san'
                    ? `▪ ô mỏng (< ${q.data!.san_o} người, gộp lại)`
                    : (the ? `${the.emoji} ${the.ten}` : id);
                  return (
                    <tr key={id}>
                      <td>{ten}</td>
                      <td className={s.phai}>{so(n)}</td>
                      <td className={s.phai}>
                        {q.data!.n_nguoi > 0
                          ? `${Math.round((n / q.data!.n_nguoi) * 100)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div className={s.khoi}>
          <h3 className={s.khoiTieuDe}>TRUNG BÌNH SÁU CHỈ SỐ (những người trên)</h3>
          <table className={s.bang}>
            <tbody>
              {Object.entries(NHAN_TB).map(([k, nhan]) => {
                const v = q.data!.trung_binh[k];
                return (
                  <tr key={k}>
                    <td>{nhan}</td>
                    <td className={s.phai}>
                      {v === null || v === undefined ? '—' : v.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className={s.mo}>
            Cùng một đường tính với thẻ của người chơi (`/holdem/me/tinh-cach`)
            — hai màn một con số. Ô "—" là chưa đủ mẫu, không phải bằng không.
          </p>
        </div>
      </>
    ) : null} />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * MẶT PHIÊN BẢN — so sánh (founder 31/08: *"data phân tích product cũng cần
 * hiển thị rõ phiên bản để mà so sánh"*).
 *
 * Đây là mặt DUY NHẤT bày cả phiên bản đã chết, vì nó không tính tỷ lệ gì — nó
 * kể kho đang chứa gì. Mọi mặt khác thì cắt chúng.
 * ══════════════════════════════════════════════════════════════════════════ */

export function MatPhienBan({ k }: { k: ThamSoKhoang }) {
  const q = usePhienBanSP(k);
  return (
    <Cho q={q} con={q.data ? (
      <>
        <div className={s.hangO}>
          <O nhan="PHIÊN BẢN CÓ TRẬN TRONG KHOẢNG" gt={so(q.data.tong.so_phien_ban)} />
          <O nhan="TRẬN BẮT ĐẦU TRONG KHOẢNG" gt={so(q.data.tong.tran)} />
          <O nhan="BẢN ĐANG CHẠY" gt={q.data.ver_hien_tai} />
        </div>
        {/* Nói ra phần bị cắt kèm tỷ lệ — cắt im lặng thì lần sau người đọc thấy
            cỡ mẫu tụt và tưởng app hỏng, rồi ai đó "sửa" bằng cách gỡ bộ lọc. */}
        {q.data.bi_cat.tran > 0 ? (
          <div className={s.dai}>
            <span className={s.daiChet}>
              ⚠ ĐÃ CẮT KHỎI MỌI MẶT PHÂN TÍCH: {so(q.data.bi_cat.tran)} trận
              {' '}({pct(q.data.bi_cat.ty_le_tran)} số trận trong khoảng) · {so(q.data.bi_cat.events)} event
            </span>
            <span className={s.daiNhan}>
              — luật của chúng đã biến mất khỏi code, không dựng lại được:
              {' '}{q.data.bi_cat.phien_ban.join(', ')}
            </span>
          </div>
        ) : null}
        <div className={s.khoi}>
          <h3 className={s.khoiTieuDe}>TRẬN TRONG KHOẢNG THEO PHIÊN BẢN</h3>
          <table className={s.bang}>
            <thead>
              <tr>
                <th>phiên bản</th><th>chế độ</th><th>giai đoạn</th>
                <th className={s.phai}>trận</th><th className={s.phai}>xong</th>
                <th className={s.phai}>bỏ dở</th><th className={s.phai}>người</th>
                <th className={s.phai}>event</th><th>trận đầu → cuối</th>
              </tr>
            </thead>
            <tbody>
              {q.data.dong.map((d) => (
                <tr key={`${d.ver}-${d.che_do}`}
                  className={d.giai_doan === 'khong_dung_lai_duoc' ? s.hangChet : undefined}>
                  <td>
                    {d.ver}
                    {d.giai_doan === 'hien_tai' ? ' ◀ đang chạy' : ''}
                  </td>
                  <td>{d.che_do}</td>
                  <td className={d.giai_doan === 'khong_dung_lai_duoc' ? s.daiChet : undefined}>
                    {d.nhan_giai_doan}
                  </td>
                  <td className={s.phai}>{so(d.tran)}</td>
                  {/* Mẫu mỏng vẫn HIỆN — chỉ tô cảnh báo. Ẩn thì mùa 0.0 mặt trắng trơn. */}
                  <td className={`${s.phai} ${d.mau_mong ? s.daiMong : ''}`}>
                    {so(d.xong)}{d.mau_mong ? ' ⚠' : ''}
                  </td>
                  <td className={s.phai}>{so(d.bo_do)}</td>
                  <td className={s.phai}>{so(d.nguoi)}</td>
                  <td className={s.phai}>{so(d.n_events)}</td>
                  <td className={s.mo}>{ngayDu(d.tu)} → {ngayDu(d.den)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={s.mo}>
            “Mẫu mỏng” = dưới {q.data.san_tran_tin_cay} trận xong — con số vẫn hiện,
            nhưng đừng đọc nó như một kết luận.
          </p>
        </div>
      </>
    ) : null} />
  );
}
