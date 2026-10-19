/**
 * BA KHU GOM VỀ (D335) — founder 15/09: *"gom về 1 admin panel các công cụ quản trị cho gọn, trang kia chỉ còn
 * chức năng xác thực và quản trị cấp cao"*.
 *
 *   SẢN PHẨM  — năm mặt cũ của `/quan-tri` (hành trình · trận & hạng · tính cách · kèo dự báo · phiên bản).
 *   VẬN HÀNH  — việc cần làm (chỉ đọc) · kinh tế (dời từ `/admin`) · sức khoẻ hệ thống · quản kèo · tạo kèo nháp.
 *   DỮ LIỆU   — kho dữ liệu thô.
 *
 * ⚠ Ranh "cấp cao" giữ ở `/admin`: MỞ kèo (rút seed Kho bạc) · CHỐT kết quả · HUỶ kèo. Cả ba chuyển token của
 *   người chơi, không hoàn tác, và `/admin` là trang máy chủ vẽ — sống kể cả khi bản build web hỏng (§8.1). Ở đây
 *   việc nào cần một trong ba thao tác đó thì có đường bấm sang, không có nút làm thay.
 */
import { useState } from 'react';
import type { ThamSoKhoang } from '@/api/phantich';
import { useTongQuan } from '@/api/thongke';
import { useBaoCaoKinhTe, useBaoLoiAdmin, useDashboardKinhTe, useTaoKeoNhap, useViecCanLam, type ThanKeoNhap } from '@/api/vanhanh';
import { Cho } from '@/screens/admin/Cho';
import { HanhTrinh } from '@/screens/admin/HanhTrinh';
import { MatKho } from '@/screens/admin/Kho';
import { MatKeo, MatPhienBan, MatTinhCach, MatTran } from '@/screens/admin/MatSanPham';
import { QuanKeo } from '@/screens/admin/QuanKeo';
import { ngayGioVN, so } from './khoang';
import s from './QuanTriApp.module.css';

function TabCon<T extends string>({ ds, chon, dat }: { ds: ReadonlyArray<readonly [T, string]>; chon: T; dat: (t: T) => void }) {
  return (
    <div className={s.tabCon} role="tablist">
      {ds.map(([id, ten]) => (
        <button key={id} type="button" role="tab" className={s.chip} aria-pressed={chon === id} aria-selected={chon === id}
          onClick={() => dat(id)}>{ten}</button>
      ))}
    </div>
  );
}

const hopLe = <T extends string>(ds: ReadonlyArray<readonly [T, string]>, x: string | null): T => (ds.find(([id]) => id === x) ?? ds[0]!)[0];

/* ══ SẢN PHẨM ═════════════════════════════════════════════════════════════ */

const TAB_SP = [
  ['hanh-trinh', 'HÀNH TRÌNH'], ['tran', 'TRẬN & HẠNG'], ['tinh-cach', 'TÍNH CÁCH'], ['keo', 'KÈO DỰ BÁO'], ['phien-ban', 'PHIÊN BẢN'],
] as const;

/**
 * ⚠ D341 — `k` là khoảng của THANH THỜI GIAN (đọc từ URL), truyền thẳng xuống từng mặt. Trước đó khung truyền
 * `soNgay` đọc từ phản hồi tổng quan và bốn mặt không nhận gì: đổi mốc không đổi số (founder bắt trên prod 16/09).
 */
export function SanPham({ tab, datTab, k }: { tab: string | null; datTab: (t: string) => void; k: ThamSoKhoang }) {
  const t = hopLe(TAB_SP, tab);
  return (
    <>
      <div className={s.khuDau}>
        <h1 className={s.khuTen}>SẢN PHẨM</h1>
        <span className={s.khuMo}>mọi mặt đọc đúng khoảng ngày và công tắc ở thanh trên — mỗi mặt ghi rõ nó cắt thế nào</span>
      </div>
      <TabCon ds={TAB_SP} chon={t} dat={datTab} />
      {t === 'hanh-trinh' ? <HanhTrinh k={k} /> : null}
      {t === 'tran' ? <MatTran k={k} /> : null}
      {t === 'tinh-cach' ? <MatTinhCach k={k} /> : null}
      {t === 'keo' ? <MatKeo k={k} /> : null}
      {t === 'phien-ban' ? <MatPhienBan k={k} /> : null}
    </>
  );
}

/* ══ VẬN HÀNH ═════════════════════════════════════════════════════════════ */

const TAB_VH = [
  ['viec', 'VIỆC CẦN LÀM'], ['bao-loi', 'BÁO LỖI'], ['kinh-te', 'KINH TẾ'], ['suc-khoe', 'SỨC KHOẺ HỆ THỐNG'], ['quan-keo', 'QUẢN KÈO'],
  ['tao-keo', 'TẠO KÈO NHÁP'],
] as const;

export function VanHanh({ tab, datTab, gom }: { tab: string | null; datTab: (t: string) => void; gom: boolean }) {
  const t = hopLe(TAB_VH, tab);
  return (
    <>
      <div className={s.khuDau}>
        <h1 className={s.khuTen}>VẬN HÀNH</h1>
        <span className={s.khuMo}>mở kèo · chốt kết quả · huỷ kèo vẫn ở <a className={s.lienKet} href="/admin">/admin</a> — ba thao tác chuyển token, không hoàn tác</span>
      </div>
      <TabCon ds={TAB_VH} chon={t} dat={datTab} />
      {t === 'viec' ? <ViecCanLam /> : null}
      {t === 'bao-loi' ? <BaoLoiNguoiChoi /> : null}
      {t === 'kinh-te' ? <KinhTe /> : null}
      {t === 'suc-khoe' ? <SucKhoe gom={gom} /> : null}
      {t === 'quan-keo' ? <QuanKeo /> : null}
      {t === 'tao-keo' ? <TaoKeoNhap /> : null}
    </>
  );
}

/**
 * BÁO LỖI NGƯỜI CHƠI (SPEC chan-truoc-beta; founder 11/10: DB + chuông Sentry, anh đọc ở admin). Mỗi báo một dòng: lúc · ai · màn · bản ·
 * mã lỗi gần nhất · chữ họ gõ. Chuông Sentry chỉ mang `#mã` — chữ đọc ở đây.
 */
function BaoLoiNguoiChoi() {
  const q = useBaoLoiAdmin();
  return (
    <Cho q={q} con={q.data ? (
      <div className={s.khoi}>
        <div className={s.khoiTen}>BÁO LỖI <span>200 báo mới nhất · chuông Sentry chỉ chở mã, chữ đọc ở đây</span></div>
        {q.data.bao_loi.length === 0 ? <p className={s.ghiChu}>✔ Chưa ai báo lỗi.</p> : (
          <div className={s.cuon}>
            <table className={s.bang}>
              <thead><tr><th>#</th><th>lúc</th><th>ai</th><th>màn · bản · mã lỗi</th><th>người chơi viết</th></tr></thead>
              <tbody>
                {q.data.bao_loi.map((b) => (
                  <tr key={String(b.bao_loi_id)}>
                    <td className={s.so}>{String(b.bao_loi_id)}</td>
                    <td>{ngayGioVN(b.ts)}</td>
                    <td>@{b.handle}</td>
                    <td>{[b.man, b.ban, b.ma_loi].map((x) => x ?? '—').join(' · ')}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{b.noi_dung}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    ) : null} />
  );
}

function ViecCanLam() {
  const q = useViecCanLam();
  return (
    <Cho q={q} con={q.data ? (
      <div className={s.khoi}>
        <div className={s.khoiTen}>VIỆC CẦN LÀM <span>kèo nháp chờ mở · kèo đã khoá chờ chốt</span></div>
        {q.data.markets.length === 0 ? <p className={s.ghiChu}>✔ Không có việc nào. Kèo đang mở cứ để chạy.</p> : (
          <div className={s.cuon}>
            <table className={s.bang}>
              <thead><tr><th>trạng thái</th><th>câu hỏi</th><th>khoá lúc</th><th className={s.so}>pool</th><th /></tr></thead>
              <tbody>
                {q.data.markets.map((m) => (
                  <tr key={m.market_id}>
                    <td className={m.status === 'locked' ? s.ghiTat : s.an}>{m.status === 'locked' ? 'ĐÃ KHOÁ — CHỜ CHỐT' : 'NHÁP — CHỜ MỞ'}</td>
                    <td style={{ whiteSpace: 'normal' }}>{m.question_text}</td>
                    <td>{ngayGioVN(m.lock_ts)}</td>
                    <td className={s.so}>{so(m.total_volume)} T</td>
                    <td><a className={s.lienKet} href="/admin">{m.status === 'locked' ? 'chốt ở /admin ›' : 'mở ở /admin ›'}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    ) : null} />
  );
}

/** Cùng quy tắc với báo cáo cũ ở `/admin`: null là "chưa đo được", KHÔNG phải 0 (A11.2/D62). */
const chuaDo = <span className={s.an}>chưa đo được</span>;
const T = (v: string | number | null | undefined) => (v === null || v === undefined ? chuaDo : `${Number(v).toLocaleString('vi-VN')} T`);
const SO = (v: string | number | null | undefined, hau = '') => (v === null || v === undefined ? chuaDo : `${Number(v).toLocaleString('vi-VN')}${hau}`);

function KinhTe() {
  const bc = useBaoCaoKinhTe();
  const db = useDashboardKinhTe();
  const Bang = ({ dong }: { dong: Array<[string, React.ReactNode]> }) => (
    <table className={s.bang}><tbody>{dong.map(([k, v]) => <tr key={k}><td>{k}</td><td className={s.so}>{v}</td></tr>)}</tbody></table>
  );
  return (
    <>
      <Cho q={bc} con={bc.data ? (
        <>
          {bc.data.mauSo.canhBaoMauSo ? (
            <p className={`${s.rao}`}>⚠ Chỉ <b>{so(bc.data.mauSo.that)}</b> người thật — dưới ngưỡng đọc số. Mọi TỶ LỆ dưới đây là giai thoại, không phải phép đo (D223).</p>
          ) : null}
          <div className={s.khoi}>
            <div className={s.khoiTen}>BÁO ĐỘNG <span>chỉ số chưa đo được thì im — đúng thiết kế</span></div>
            {bc.data.baoDong.length === 0 ? <p className={s.ghiChu}>Không dòng nào nổ.</p> : (
              <table className={s.bang}>
                <thead><tr><th>mức</th><th>dòng</th><th>đo</th><th>ngưỡng</th></tr></thead>
                <tbody>{bc.data.baoDong.map((d) => (
                  <tr key={d.ma}><td className={d.muc === 'do' ? s.xuong : s.ghiTat}>{d.muc === 'do' ? '✖ ĐỎ' : '⚠ vàng'}</td><td>{d.ma}</td><td>{d.do}</td><td>{d.nguong}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
          <div className={s.luoi2}>
            <div className={s.khoi}>
              <div className={s.khoiTen}>CUNG</div>
              <Bang dong={[
                ['mint ròng', T(bc.data.cung.mintRong)], ['đã đốt', T(bc.data.cung.daDot)], ['tổng cung', T(bc.data.cung.tongCung)],
                ['Σ ví', T(bc.data.cung.sigmaVi)], ['Kho bạc', T(bc.data.cung.khoBac)],
                ['sổ CÂN', bc.data.cung.can ? '✔' : <span className={s.xuong}>✖ {bc.data.cung.vanDe.join(' · ')}</span>],
              ]} />
            </div>
            <div className={s.khoi}>
              <div className={s.khoiTen}>KHO BẠC — CÒN SỐNG BAO LÂU</div>
              <Bang dong={[
                ['chi/ngày (7 ngày)', T(bc.data.khoBacDong.chiMoiNgay7Ngay)],
                ['runway', bc.data.khoBacDong.runwayNgay === null ? chuaDo : `${so(bc.data.khoBacDong.runwayNgay)} ngày`],
                ['người đủ điều kiện trợ cấp', SO(bc.data.troCap.soNguoiDuDieuKien)], ['trợ cấp tuần dự kiến', T(bc.data.troCap.tuanDuKien)],
              ]} />
            </div>
            <div className={s.khoi}>
              <div className={s.khoiTen}>TRỢ CẤP → LÒ ĐỐT</div>
              <Bang dong={[
                ['trợ cấp phát (7 ngày)', T(bc.data.troCap.phat7Ngay)], ['nhóm nhận đã đốt', T(bc.data.troCap.dotBoiNguoiNhan7Ngay)],
                ['tỷ lệ', SO(bc.data.troCap.vaoLoDotBp, ' bp')],
              ]} />
              <p className={s.ghiChu}>{bc.data.troCap.ghiChu}</p>
            </div>
            <div className={s.khoi}>
              <div className={s.khoiTen}>Q · XU HƯỚNG · PHÂN PHỐI</div>
              <Bang dong={[
                ['Q phát / tiêu / tồn', `${bc.data.q.phat} / ${bc.data.q.tieu} / ${bc.data.q.ton}`], ['trần phát cả mùa', SO(bc.data.q.tranPhatMua)],
                ['Q sink/phát', SO(bc.data.q.sinkPhatBp, ' bp')],
                [`phát / đốt (${bc.data.xuHuong.cuaSoNgay} ngày, không tính vốn genesis)`, <>{T(bc.data.xuHuong.phat)} / {T(bc.data.xuHuong.dot)}</>],
                ['sink/faucet', SO(bc.data.xuHuong.sinkFaucetBp, ' bp')],
                [`median ví (trên ${bc.data.phanPhoi.tren})`, T(bc.data.phanPhoi.medianVi)], ['Gini', SO(bc.data.phanPhoi.giniBp, ' bp')],
              ]} />
            </div>
          </div>
        </>
      ) : null} />
      <Cho q={db} con={db.data ? (
        <div className={s.khoi}>
          <div className={s.khoiTen}>DASHBOARD KINH TẾ <span>kiểm toán cung + ví</span></div>
          <Bang dong={[
            ['kiểm toán cung', db.data.audit_ok ? '✔ CÂN' : <span className={s.xuong}>✖ {db.data.audit_problems.join(' · ')}</span>],
            ['tài khoản', SO(db.data.users)], ['ví trung vị', T(db.data.bankroll_median)], ['ví p90', T(db.data.bankroll_p90)],
            ['Gini ví', db.data.bankroll_gini.toLocaleString('vi-VN')],
            ['kèo theo trạng thái', Object.entries(db.data.markets_by_status).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'],
          ]} />
        </div>
      ) : null} />
    </>
  );
}

function SucKhoe({ gom }: { gom: boolean }) {
  const q = useTongQuan(30, gom);
  return (
    <Cho q={q} con={q.data ? (
      <>
        <div className={s.hangO}>
          <div className={s.o}><div className={s.oNhan}>KHO DỮ LIỆU</div><div className={s.oGt}>{q.data.kho.tong_mb}<small>MB</small></div><div className={s.oPham}>trần {q.data.kho.tran_mb} MB · {Math.round((q.data.kho.tong_mb / q.data.kho.tran_mb) * 100)}%</div></div>
          <div className={s.o}><div className={s.oNhan}>KIỂM TOÁN CUNG</div><div className={s.oGt}>{q.data.kinh_te.audit_ok ? 'CÂN' : <span className={s.xuong}>LỆCH</span>}</div><div className={s.oPham}>{q.data.kinh_te.van_de.join(' · ') || 'không vấn đề'}</div></div>
          <div className={s.o}><div className={s.oNhan}>TRẬN (DÙNG ĐƯỢC / KHO)</div><div className={s.oGt}>{so(q.data.tran.tong - q.data.tran.khong_dung_lai_duoc)} / {so(q.data.tran.tong)}</div><div className={s.oPham}>{so(q.data.tran.ver_hien_tai)} ở bản đang chạy</div></div>
          <div className={s.o}><div className={s.oNhan}>LỖI GỌI MÁY CHỦ (30 NGÀY)</div><div className={s.oGt}>{so(q.data.loi_api.reduce((a, x) => a + x.n, 0))}</div><div className={s.oPham}>{q.data.loi_api.map((x) => `${x.ma} ${x.n}`).join(' · ') || 'không có'}</div></div>
        </div>
        <div className={s.khoi}>
          <div className={s.khoiTen}>BẢNG LỚN NHẤT <span>tổng là cả database, không phải tổng các dòng dưới</span></div>
          <table className={s.bang}>
            <thead><tr><th>bảng</th><th className={s.so}>MB</th><th className={s.so}>dòng (ước)</th></tr></thead>
            <tbody>{q.data.kho.bang.map((b) => <tr key={b.ten}><td>{b.ten}</td><td className={s.so}>{b.mb}</td><td className={s.so}>{so(b.uoc_dong)}</td></tr>)}</tbody>
          </table>
        </div>
      </>
    ) : null} />
  );
}

const MAC_DINH: ThanKeoNhap = {
  pool: 'life', question_text: '', resolution_source_name: '', resolution_source_url: '',
  open_ts: '', lock_ts: '', resolve_deadline_ts: '', seed_per_option: 0, options: [],
};

function TaoKeoNhap() {
  const tao = useTaoKeoNhap();
  const [than, datThan] = useState<ThanKeoNhap>(MAC_DINH);
  const [cua, datCua] = useState<string[]>(['', '', '', '', '', '']);
  const iso = (v: string) => (v ? new Date(v).toISOString() : '');
  const o = (nhan: string, id: keyof ThanKeoNhap, kieu = 'text', goiY = '') => (
    <label className={s.dieuKien} style={{ margin: '6px 0' }}>
      <span>{nhan}</span>
      <input id={`tk-${id}`} type={kieu} placeholder={goiY} value={String(than[id] ?? '')}
        onChange={(e) => datThan({ ...than, [id]: kieu === 'number' ? Number(e.target.value || 0) : e.target.value })}
        style={{ background: 'var(--gieng)', border: '1px solid var(--vien-2)', padding: '4px 6px', colorScheme: 'dark' }} />
    </label>
  );
  return (
    <div className={s.khoi}>
      <div className={s.khoiTen}>TẠO KÈO NHÁP <span>nháp chưa ai thấy, sửa/gỡ được ở QUẢN KÈO — MỞ kèo làm ở /admin</span></div>
      <label className={s.dieuKien} style={{ margin: '6px 0' }}>
        <span>Pool</span>
        <select id="tk-pool" value={than.pool} onChange={(e) => datThan({ ...than, pool: e.target.value as ThanKeoNhap['pool'] })}
          style={{ background: 'var(--gieng)', border: '1px solid var(--vien-2)', padding: '4px 6px' }}>
          <option value="macro">VĨ MÔ</option><option value="life">ĐỜI SỐNG</option><option value="event">SỰ KIỆN</option>
        </select>
      </label>
      {o('Câu hỏi', 'question_text', 'text', 'Giá xăng RON95 ngày X sẽ…?')}
      {o('Tên nguồn chốt (bắt buộc trước khi mở — A3.2)', 'resolution_source_name', 'text', 'Petrolimex')}
      {o('URL nguồn chốt', 'resolution_source_url', 'text', 'https://…')}
      {o('Mở lúc (giờ máy bạn)', 'open_ts', 'datetime-local')}
      {o('Khoá lúc', 'lock_ts', 'datetime-local')}
      {o('Hạn nguồn công bố', 'resolve_deadline_ts', 'datetime-local')}
      {o('Seed mỗi cửa (T, chia đều — A3.6)', 'seed_per_option', 'number')}
      <div className={s.dieuKien} style={{ margin: '6px 0' }}>
        <span>Các cửa (2–6; để trống = không dùng)</span>
        <span className={s.dkChon}>
          {cua.map((c, i) => (
            <input key={i} id={`tk-cua-${i}`} aria-label={`Cửa ${i + 1}`} placeholder={`Cửa ${i + 1}`} value={c}
              onChange={(e) => datCua(cua.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
        </span>
      </div>
      <button type="button" className={s.nutChinh} disabled={tao.isPending}
        onClick={() => tao.mutate({
          ...than, open_ts: iso(than.open_ts), lock_ts: iso(than.lock_ts), resolve_deadline_ts: iso(than.resolve_deadline_ts),
          options: cua.map((x) => x.trim()).filter(Boolean).map((label) => ({ label })),
        }, { onSuccess: () => { datThan(MAC_DINH); datCua(['', '', '', '', '', '']); } })}>
        {tao.isPending ? 'ĐANG TẠO…' : 'TẠO NHÁP'}
      </button>
      {tao.data ? <p className={s.ghiChu}>✔ Đã tạo nháp <code>{tao.data.market_id}</code> — sửa ở QUẢN KÈO, mở ở /admin.</p> : null}
      {tao.error ? <p className={s.loi}>{String((tao.error as Error).message)}</p> : null}
    </div>
  );
}

/* ══ DỮ LIỆU ══════════════════════════════════════════════════════════════ */

export function DuLieu() {
  return (
    <>
      <div className={s.khuDau}>
        <h1 className={s.khuTen}>DỮ LIỆU</h1>
        <span className={s.khuMo}>kho thô — mọi bảng, mọi cột; cột email tự che (D209) · không theo khoảng thời gian</span>
      </div>
      <MatKho />
    </>
  );
}

