/**
 * TAB HÀNH TRÌNH — NGƯỜI TA RỜI ĐI Ở ĐÂU (founder hỏi 03/08).
 *
 * Đọc từ trên xuống theo đúng thứ tự một người mới đi qua:
 *   đăng ký → đăng nhập (mất bao lâu) → đăng nhập xong làm gì →
 *   có học hướng dẫn không, rơi ở bước nào, học xong có ở lại →
 *   trong trận bao lâu, bỏ dở ở phút thứ mấy → và cuối cùng dừng ở màn nào.
 *
 * ⚠ MỖI PHỄU LUÔN HIỆN CẢ SỐ NGƯỜI LẪN % CÒN LẠI. Chỉ có % thì ở quy mô beta
 * nó nói dối: "rơi 50%" có thể là một người trên hai.
 *
 * ⚠ Không vẽ biểu đồ tròn/đường cầu kỳ. Phễu là thanh ngang, phân bố là cột —
 * hai hình đó trả lời đúng câu hỏi "rơi ở đâu" mà không cần thư viện nào.
 *
 * ⚠ D341 — MỌI khối đọc ĐÚNG khoảng của thanh thời gian (`k`, lấy thẳng từ URL). Trước đó mặt này gửi "N ngày trượt"
 * đọc từ phản hồi tổng quan, và phễu đăng ký không cắt gì: founder đổi mốc Hôm nay / 7 / 30 ngày mà số đứng yên.
 * Khối đọc telemetry thô trả `null` khi khoảng nằm trước phần dữ liệu còn giữ ⇒ màn nói "không đo được", không vẽ 0.
 */
import { useHanhTrinhSP, type HanhTrinhDTO, type ThamSoKhoang } from '@/api/phantich';
import { ngayDu, ngayGioVN } from '@/quan-tri/khoang';
import { Cho } from './Cho';
import s from './QuanTri.module.css';

const so = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : n.toLocaleString('vi-VN');
const pct = (x: number | null | undefined): string =>
  x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`;

/**
 * Nhãn người đọc được. Phễu NGƯỜI đọc từ trạng thái bền (`auth_accounts` +
 * `holdem_matches`) nên nó nối được mọi bậc; phễu LƯỢT chỉ có hai bước
 * vì đó là hai bước duy nhất ghép được bằng mã phiên.
 */
const NHAN_DANG_KY: Record<string, string> = {
  'tao-tai-khoan': 'Tạo tài khoản',
  'xac-minh-email': 'Xác minh email',
  'xong-ho-so': 'Xong hồ sơ (nhận vốn)',
  'tran-dau': 'Đã chơi ít nhất 1 trận',
};

const NHAN_MAN_DK: Record<string, string> = {
  'mo-dang-ky': 'Mở màn đăng ký',
  'gui-dang-ky': 'Bấm gửi đăng ký',
};

/**
 * Thanh phễu. Mỗi hàng cho thấy NGAY chỗ tụt: cột "rơi" là hiệu số với bậc
 * trên, tô đỏ khi mất hơn một phần ba — đó là chỗ đáng đi sửa trước.
 */
function Phieu({ ds, nhan }: {
  ds: Array<{ buoc: string; so_nguoi: number; ty_le_con_lai: number | null }>;
  nhan?: Record<string, string>;
}) {
  const dau = ds[0]?.so_nguoi ?? 0;
  return (
    <table className={s.bang}>
      <thead>
        <tr>
          <th>bước</th><th className={s.phai}>người</th>
          <th className={s.phai}>còn lại</th><th className={s.phai}>rơi ở bước này</th><th />
        </tr>
      </thead>
      <tbody>
        {ds.map((b, i) => {
          const truoc = i === 0 ? b.so_nguoi : ds[i - 1]!.so_nguoi;
          const roi = truoc - b.so_nguoi;
          const roiNang = truoc > 0 && roi / truoc > 1 / 3;
          return (
            <tr key={b.buoc}>
              <td>{nhan?.[b.buoc] ?? b.buoc}</td>
              <td className={s.phai}>{so(b.so_nguoi)}</td>
              <td className={s.phai}>{pct(b.ty_le_con_lai)}</td>
              <td className={s.phai}>
                {i === 0 ? '' : (
                  <span className={roiNang ? s.loi : s.mo}>
                    {roi > 0 ? `−${so(roi)}` : '0'}
                  </span>
                )}
              </td>
              <td style={{ width: '40%' }}>
                <span className={s.thanh}
                  style={{ width: `${dau > 0 ? (b.so_nguoi / dau) * 100 : 0}%` }} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PhanBo({ ds, donVi }: { ds: Array<{ n: number } & Record<string, any>>; donVi: string }) {
  if (ds.length === 0) return <p className={s.mo}>không có trong khoảng này</p>;
  const khoa = donVi === 'phút' ? 'phut' : 'vong';
  const max = Math.max(...ds.map((d) => d.n));
  return (
    <table className={s.bang}>
      <tbody>
        {ds.map((d) => (
          <tr key={d[khoa]}>
            <td style={{ width: 90 }}>{donVi} {d[khoa]}</td>
            <td className={s.phai} style={{ width: 50 }}>{so(d.n)}</td>
            <td><span className={s.thanh} style={{ width: `${(d.n / max) * 100}%` }} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Trong({ co }: { co: boolean }) {
  if (co) return null;
  return <p className={s.mo}>không có dữ liệu trong khoảng này</p>;
}

export function HanhTrinh({ k }: { k: ThamSoKhoang }) {
  const q = useHanhTrinhSP(k);
  return <Cho q={q} con={q.data ? <MatHanhTrinh d={q.data} /> : null} />;
}

function MatHanhTrinh({ d }: { d: HanhTrinhDTO }) {
  const tho = d.khoang.tho_tu;
  /** Khối đọc telemetry thô mà khoảng nằm trước phần dữ liệu còn giữ — KHÔNG phải số 0. */
  const khongDo = (
    <p className={s.mo} data-testid="ht-khong-do">
      không đo được — dữ liệu thao tác thô chỉ còn từ {ngayDu(tho)}
    </p>
  );
  const mc = d.man_cuoi;

  return (
    <>
      <p className={s.moc} data-testid="ht-khoang">
        Khoảng {ngayDu(d.khoang.tu)} → {ngayDu(d.khoang.den)} ({so(d.khoang.so_ngay)} ngày, giờ Việt Nam). Trận tính
        theo lúc BẮT ĐẦU. Phễu và “học xong có ở lại” là NHÓM bắt đầu trong khoảng, theo họ tới hôm nay. Số thao tác
        trong app chỉ tính người đang bật ghi
        {!d.do_duoc
          ? <> — <b className={s.loi}>khoảng này nằm trước {ngayDu(tho)} nên các khối đó không đo được</b></>
          : d.cat_tho ? <> — <b className={s.loi}>và chỉ có từ {ngayDu(tho)}</b></> : null}
        .
      </p>

      {/* ── 1. PHỄU ĐĂNG KÝ ──────────────────────────────────────────── */}
      <div className={s.luoi}>
        <div className={s.khoi}>
          <h3 className={s.khoiTieuDe}>1 · TỪ TÀI KHOẢN TỚI TRẬN ĐẦU (người)</h3>
          <p className={s.mo}>
            Nhóm = tài khoản tạo trong khoảng; ba bậc sau theo chính những người đó tới hôm nay, nên mỗi bậc là tập
            con của bậc trên.
          </p>
          <Phieu ds={d.phieu_dang_ky} nhan={NHAN_DANG_KY} />
          <Trong co={d.phieu_dang_ky.some((b) => b.so_nguoi > 0)} />
        </div>

        <div className={s.khoi}>
          <h3 className={s.khoiTieuDe}>1b · MỞ MÀN ĐĂNG KÝ RỒI CÓ GỬI KHÔNG (lượt)</h3>
          <p className={s.mo}>
            ⚠ Đơn vị là LƯỢT MỞ MÀN, không phải người — cùng một người mở hai lần
            là hai lượt. KHÔNG cộng chung với bảng bên cạnh. Đây là bậc rơi duy
            nhất mà tài khoản không thấy được, vì tài khoản chỉ biết ai đã thành công.
          </p>
          {d.man_dang_ky === null ? khongDo : (
            <>
              <Phieu ds={d.man_dang_ky} nhan={NHAN_MAN_DK} />
              <Trong co={d.man_dang_ky.some((b) => b.so_nguoi > 0)} />
            </>
          )}
        </div>
      </div>

      {/* ── 2. ĐĂNG NHẬP ─────────────────────────────────────────────── */}
      <div className={s.hangO}>
        <div className={s.o}>
          <div className={s.oNhan}>ĐĂNG NHẬP MẤT BAO LÂU</div>
          <div className={s.oGt}>{d.dang_nhap ? `${so(d.dang_nhap.giay_p50)} giây` : '—'}</div>
          <div className={s.oPhu}>
            {d.dang_nhap
              ? `chậm nhất 10% mất ${so(d.dang_nhap.giay_p90)} giây · ${so(d.dang_nhap.so_lan)} lượt`
              : 'không đo được'}
          </div>
        </div>
        <div className={s.o}>
          <div className={s.oNhan}>HỌC HƯỚNG DẪN</div>
          <div className={s.oGt}>{d.huong_dan ? `${so(d.huong_dan.bat_dau)} người` : '—'}</div>
          <div className={s.oPhu}>
            {d.huong_dan ? `đi hết ${so(d.huong_dan.di_het)} · tự tắt ${so(d.huong_dan.tu_tat)}` : 'không đo được'}
          </div>
        </div>
        <div className={s.o}>
          <div className={s.oNhan}>HỌC XONG RỒI Ở LẠI</div>
          <div className={s.oGt}>{d.huong_dan ? so(d.huong_dan.xong_roi_o_lai) : '—'}</div>
          <div className={s.oPhu}>{d.huong_dan ? `đi luôn ${so(d.huong_dan.xong_roi_di_luon)}` : 'không đo được'}</div>
        </div>
        <div className={s.o}>
          <div className={s.oNhan}>MỘT TRẬN CHƠI HẾT KÉO DÀI</div>
          <div className={s.oGt}>{so(d.tran.phut_p50)} phút</div>
          <div className={s.oPhu}>
            lâu nhất 10% là {so(d.tran.phut_p90)} phút · trên {so(d.tran.so_xong)} trận đã xong
          </div>
        </div>
        <div className={s.o}>
          <div className={s.oNhan}>TRẬN BỎ DỞ</div>
          <div className={s.oGt}>
            {d.tran.so_lan_vao > 0
              ? `${Math.round((d.tran.so_lan_bo_do / d.tran.so_lan_vao) * 100)}%`
              : '—'}
          </div>
          <div className={s.oPhu}>
            {so(d.tran.so_lan_bo_do)} bỏ / {so(d.tran.so_lan_vao)} lượt vào ·
            {' '}{so(d.tran.so_dang_choi)} đang chơi
          </div>
        </div>
      </div>

      {/* ── 3. ĐĂNG NHẬP XONG LÀM GÌ ─────────────────────────────────── */}
      <div className={s.luoi}>
        <div className={s.khoi}>
          <h3 className={s.khoiTieuDe}>2 · ĐĂNG NHẬP XONG THÌ ĐI ĐÂU</h3>
          {d.sau_dang_nhap === null ? khongDo : d.sau_dang_nhap.length === 0 ? <Trong co={false} /> : (
            <table className={s.bang}>
              <tbody>
                {d.sau_dang_nhap.map((x) => (
                  <tr key={x.man}>
                    <td><code>{x.man}</code></td>
                    <td className={s.phai}>{so(x.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── 5. DỪNG LẠI Ở ĐÂU ──────────────────────────────────────── */}
        <div className={s.khoi}>
          <h3 className={s.khoiTieuDe}>5 · MÀN CUỐI CÙNG TRƯỚC KHI BIẾN MẤT</h3>
          {mc.trang_thai === 'khong_do_duoc' ? khongDo : mc.trang_thai === 'chua_du_24h' ? (
            <p className={s.mo} data-testid="man-cuoi-chua-du">
              chưa biết được — cả khoảng nằm trong 24 giờ qua, chưa ai im đủ 24 giờ để tính là đã rời đi. Chọn
              khoảng dài hơn.
            </p>
          ) : (
            <>
              <p className={s.mo}>
                Người có lần xem màn CUỐI CÙNG rơi vào khoảng và đã im từ 24 giờ trở lên (tính tới
                {' '}{ngayGioVN(mc.tinh_toi)}). Ai quay lại sau đó thì chưa rời đi.
              </p>
              {mc.dong.length === 0 ? <Trong co={false} /> : (
                <table className={s.bang}>
                  <tbody>
                    {mc.dong.map((x) => (
                      <tr key={x.man}>
                        <td><code>{x.man}</code></td>
                        <td className={s.phai}>{so(x.n)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 4. HƯỚNG DẪN RƠI Ở BƯỚC NÀO ──────────────────────────────── */}
      <div className={s.khoi}>
        <h3 className={s.khoiTieuDe}>3 · MÀN HƯỚNG DẪN — RƠI Ở BƯỚC NÀO</h3>
        <p className={s.mo}>
          Các bước theo đúng thứ tự xuất hiện. Bậc nào tụt mạnh là bậc cần viết lại.
        </p>
        {d.huong_dan === null ? khongDo : (
          <>
            <Phieu ds={d.huong_dan.buoc} />
            <Trong co={d.huong_dan.buoc.some((b) => b.so_nguoi > 0)} />
          </>
        )}
      </div>

      {/* ── 4b. BÀN TẬP — RỔ RIÊNG (D359) ────────────────────────────────
          Mọi ô TRẬN ở mặt này là số của TRẬN THẬT; ván dạy đứng riêng ở đây. Hai câu hỏi khác
          nhau nên hai chỗ trả lời — trộn lại là kéo mọi tỷ lệ về phía bàn tập theo đúng tỷ lệ
          người mới trong mẫu. */}
      <div className={s.khoi}>
        <h3 className={s.khoiTieuDe}>3b · BÀN TẬP — VÁN DẠY, ĐẾM RIÊNG</h3>
        <p className={s.mo}>
          Bàn tập là bản đồ ghim, miễn giờ mấy vòng đầu, Oracle dắt tay — nó không phải một trận dễ mà là
          một trò khác, nên <b>không</b> cộng vào ô TRẬN ở trên. Khác với khối 3: khối kia đếm người bấm qua
          từng bước trợ lý, khối này đếm người thật sự ngồi xuống chơi ván dạy.
        </p>
        {d.ban_tap === null ? khongDo : (
          <>
            <div className={s.luoi}>
              <div className={s.o}>
                <div className={s.oNhan}>NGƯỜI VÀO BÀN TẬP</div>
                <div className={s.oGt}>{so(d.ban_tap.so_nguoi_vao)}</div>
                <div className={s.oPhu}>{so(d.ban_tap.so_tran)} ván</div>
              </div>
              <div className={s.o}>
                <div className={s.oNhan}>CHƠI HẾT VÁN DẠY</div>
                <div className={s.oGt}>{so(d.ban_tap.so_xong)}</div>
                <div className={s.oPhu}>
                  {d.ban_tap.so_tran > 0
                    ? `${Math.round((d.ban_tap.so_xong / d.ban_tap.so_tran) * 100)}% số ván`
                    : 'chưa có ván nào'}
                </div>
              </div>
              <div className={s.o}>
                <div className={s.oNhan}>BỎ GIỮA CHỪNG</div>
                <div className={s.oGt}>{so(d.ban_tap.so_bo_do)}</div>
                <div className={s.oPhu}>
                  {d.ban_tap.so_tran > 0
                    ? `${Math.round((d.ban_tap.so_bo_do / d.ban_tap.so_tran) * 100)}% số ván`
                    : 'chưa có ván nào'}
                </div>
              </div>
            </div>
            <p className={s.mo}>
              Bỏ ở <b>vòng</b> nào — vòng nói về nội dung đang dạy, tức đoạn nào của bài dạy làm người mới rời đi.
            </p>
            <PhanBo ds={d.ban_tap.bo_o_vong} donVi="vòng" />
            <Trong co={d.ban_tap.bo_o_vong.length > 0} />
          </>
        )}
      </div>

      {/* ── 5. BỎ TRẬN ───────────────────────────────────────────────── */}
      <div className={s.luoi}>
        <div className={s.khoi}>
          <h3 className={s.khoiTieuDe}>4 · BỎ TRẬN Ở PHÚT THỨ MẤY</h3>
          <p className={s.mo}>
            {so(d.tran.so_lan_bo_do)} lượt bỏ dở. Mốc đo là nước CUỐI CÙNG họ đi — không dùng giờ đóng sổ, vì trận bỏ
            dở chỉ bị quét dọn đóng lại sau nhiều giờ. Phút đo mức KIÊN NHẪN. Rổ cuối gộp mọi trận trên 30 phút.
          </p>
          <PhanBo ds={d.tran.bo_do_theo_phut} donVi="phút" />
          <p className={s.mo}>
            {d.tran.client_kip_bao === null
              ? 'Số lượt máy người chơi kịp báo lúc rời: không đo được (dữ liệu thô đã hết hạn).'
              : <>Trong số đó {so(d.tran.client_kip_bao)} lượt máy người chơi kịp báo lúc
                {' '}rời. Số này LUÔN nhỏ hơn — phần chênh chính là những người đóng thẳng
                {' '}app. Nó tồn tại để biết đường đo phía máy người chơi còn sống, chứ
                {' '}không phải để đếm người bỏ.</>}
          </p>
        </div>
        <div className={s.khoi}>
          <h3 className={s.khoiTieuDe}>4b · …VÀ Ở VÒNG NÀO</h3>
          <p className={s.mo}>
            Vòng đo NỘI DUNG — cùng một chỗ trong trò chơi, khác với cùng một
            khoảng thời gian.
          </p>
          <PhanBo ds={d.tran.bo_do_theo_vong} donVi="vòng" />
        </div>
      </div>

      {/* ── 6. SẬP GIAO DIỆN ─────────────────────────────────────────── */}
      <div className={s.khoi}>
        <h3 className={s.khoiTieuDe}>6 · SẬP GIAO DIỆN (màn trắng)</h3>
        <p className={s.mo}>
          Cú sập lúc dựng màn — người chơi thấy màn lỗi thay vì nội dung. Khác hẳn
          "lỗi gọi máy chủ" ở mặt Tổng quan: cái kia là mạng, cái này là app.
        </p>
        {d.loi_client === null ? khongDo : d.loi_client.length === 0 ? (
          <p className={s.mo}>không có cú sập nào trong khoảng này — đây là tin tốt</p>
        ) : (
          <table className={s.bang}>
            <tbody>
              {d.loi_client.map((x) => (
                <tr key={x.ma}>
                  <td><code>{x.ma}</code></td>
                  <td className={s.phai}>{so(x.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
