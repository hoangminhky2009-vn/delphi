/**
 * TAB QUẢN KÈO (bước 4 — bản yêu cầu 01 §5).
 *
 * Vòng đời kèo đã TRỌN từ GĐ4; đây chỉ thêm phần TIỆN:
 *   · danh sách MỌI trạng thái, có lọc + tìm (trước chỉ có "đang chờ")
 *   · sửa kèo còn nháp (trước: gõ sai một chữ là huỷ làm lại)
 *   · tạo hàng loạt theo tháng (kèo vĩ mô là kèo tháng)
 *   · xem trước ĐÚNG thứ người chơi thấy — kiểm A3.1 bằng mắt
 *
 * ⚠ KHÔNG có resolve/huỷ ở đây. Hai thao tác đó ở lại trang `/admin` (Hono) —
 * nó là đường thoát phải sống khi bản build này hỏng, và một đường thoát chỉ có
 * giá trị nếu nó vẫn làm được việc quan trọng nhất (§8.1).
 */
import { useState } from 'react';
import {
  nhanBanTheoThang, useDanhSachKeo, useHenGio, useSuaKeo, useTaoHangLoat,
  useXacThucLai, useXemTruoc, type KeoDong, type ThanKeo,
} from '@/api/quankeo';
import s from './QuanTri.module.css';

const POOLS = [
  { ma: 'macro', ten: 'VĨ MÔ' }, { ma: 'life', ten: 'ĐỜI SỐNG' }, { ma: 'event', ten: 'SỰ KIỆN' },
] as const;
const TRANG_THAI = ['draft', 'open', 'locked', 'resolved', 'cancelled'] as const;

const gio = (s2: string) => new Date(s2).toLocaleString('vi-VN');
const soT = (x: string) => `${Number(x).toLocaleString('vi-VN')} T`;
/** `<input type="datetime-local">` cần YYYY-MM-DDTHH:mm theo giờ MÁY. */
const choO = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const THAN_TRONG: ThanKeo = {
  pool: 'macro',
  question_text: '',
  resolution_source_name: '',
  resolution_source_url: '',
  open_ts: '', lock_ts: '', resolve_deadline_ts: '',
  seed_per_option: 0,
  options: [{ label: '' }, { label: '' }],
};

/* ══════════════════════════════════════════════════════════════════════════
 * Cửa nặng — nhập lại mã hai lớp
 * ══════════════════════════════════════════════════════════════════════════ */

function ONhapMa({ nhan, xong }: { nhan: string; xong: () => void }) {
  const [ma, datMa] = useState('');
  const xt = useXacThucLai();
  return (
    <div className={s.khoi}>
      <h3 className={s.khoiTieuDe}>{nhan}</h3>
      {/*
        Thao tác này tiêu Kho bạc và sẽ tự chạy lúc không ai ngồi đó, nên nó đi
        cửa nặng (bước 2). Uỷ quyền được DỜI CHỖ — sang lúc hẹn lịch — chứ
        không được bỏ.
      */}
      <p className={s.mo}>Thao tác này chi Kho bạc. Nhập mã 6 số để xác nhận.</p>
      <input className={s.o} inputMode="numeric" autoComplete="one-time-code"
        placeholder="000000" value={ma} onChange={(e) => datMa(e.target.value)} />
      <button type="button" className={s.tab}
        onClick={() => xt.mutate(ma, { onSuccess: xong })}>XÁC NHẬN</button>
      {xt.error ? <p className={s.loi}>{(xt.error as Error).message}</p> : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Xem trước
 * ══════════════════════════════════════════════════════════════════════════ */

function XemTruoc({ id, dong }: { id: string; dong: () => void }) {
  const q = useXemTruoc(id);
  return (
    <div className={s.khoi}>
      <button type="button" className={s.lienKet} onClick={dong}>‹ đóng xem trước</button>
      {q.isPending ? <p className={s.mo}>đang tải…</p> : null}
      {q.error ? <p className={s.loi}>{(q.error as Error).message}</p> : null}
      {q.data ? (
        <>
          {/*
            Câu trả lời cho "A3.1 còn nguyên không" phải ĐỌC THẲNG, không phải
            suy từ hai cục JSON. Đây là lý do màn này tồn tại.
          */}
          <p className={q.data.a31_an_phan_bo ? s.moc : s.loi}>
            {q.data.a31_an_phan_bo
              ? '✔ A3.1 CÒN NGUYÊN — người chưa đặt KHÔNG thấy phân bổ các cửa.'
              : '✖ A3.1 VỠ — người chưa đặt ĐANG thấy phân bổ. Dừng lại và báo ngay.'}
          </p>
          <div className={s.luoi}>
            <div>
              <h3 className={s.khoiTieuDe}>NGƯỜI CHƯA ĐẶT NHÌN THẤY</h3>
              <pre className={s.mo}>{JSON.stringify(q.data.nhu_nguoi_chua_dat, null, 1)}</pre>
            </div>
            <div>
              <h3 className={s.khoiTieuDe}>NGƯỜI ĐÃ ĐẶT NHÌN THẤY</h3>
              {q.data.co_nguoi_da_dat
                ? <pre className={s.mo}>{JSON.stringify(q.data.nhu_nguoi_da_dat, null, 1)}</pre>
                : <p className={s.mo}>chưa ai đặt kèo này — không có góc nhìn thứ hai để so</p>}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Biểu mẫu thân kèo — dùng cho SỬA và cho TẠO HÀNG LOẠT
 * ══════════════════════════════════════════════════════════════════════════ */

function BieuMau({
  than, datThan, nhan, chay, dangChay, loi,
}: {
  than: ThanKeo; datThan: (t: ThanKeo) => void; nhan: string;
  chay: () => void; dangChay: boolean; loi: string | null;
}) {
  const o = (k: keyof ThanKeo, v: unknown) => datThan({ ...than, [k]: v });
  return (
    <>
      <label className={s.oNhan}>POOL</label>
      <select className={s.o} value={than.pool} onChange={(e) => o('pool', e.target.value)}>
        {POOLS.map((p) => <option key={p.ma} value={p.ma}>{p.ten}</option>)}
      </select>

      <label className={s.oNhan}>CÂU HỎI</label>
      <input className={s.o} value={than.question_text}
        onChange={(e) => o('question_text', e.target.value)} />

      <label className={s.oNhan}>NGUỒN CHỐT (tên) — bắt buộc trước khi mở, A3.2</label>
      <input className={s.o} value={than.resolution_source_name}
        onChange={(e) => o('resolution_source_name', e.target.value)} />
      <label className={s.oNhan}>NGUỒN CHỐT (URL)</label>
      <input className={s.o} value={than.resolution_source_url}
        onChange={(e) => o('resolution_source_url', e.target.value)} />

      <div className={s.hangO}>
        {([['open_ts', 'MỞ LÚC'], ['lock_ts', 'KHOÁ LÚC'],
          ['resolve_deadline_ts', 'HẠN NGUỒN']] as const).map(([k, n]) => (
            <span key={k}>
              <label className={s.oNhan}>{n}</label>
              <input className={s.o} type="datetime-local"
                value={than[k] ? choO(than[k]) : ''}
                onChange={(e) => o(k, new Date(e.target.value).toISOString())} />
            </span>
        ))}
        <span>
          <label className={s.oNhan}>SEED MỖI CỬA (T, chia ĐỀU — A3.6)</label>
          <input className={s.o} type="number" min={0} value={than.seed_per_option}
            onChange={(e) => o('seed_per_option', Number(e.target.value))} />
        </span>
      </div>

      <label className={s.oNhan}>CÁC CỬA (2–6)</label>
      {than.options.map((c, i) => (
        <input key={i} className={s.o} value={c.label} placeholder={`Cửa ${i + 1}`}
          onChange={(e) => {
            const ds = [...than.options];
            ds[i] = { ...ds[i], label: e.target.value };
            o('options', ds);
          }} />
      ))}
      <button type="button" className={s.tab}
        onClick={() => o('options', [...than.options, { label: '' }])}
        disabled={than.options.length >= 6}>+ THÊM CỬA</button>
      <button type="button" className={s.tab}
        onClick={() => o('options', than.options.slice(0, -1))}
        disabled={than.options.length <= 2}>− BỚT CỬA</button>

      <p><button type="button" className={`${s.tab} ${s.tabChon}`} onClick={chay}
        disabled={dangChay}>{dangChay ? 'đang gửi…' : nhan}</button></p>
      {loi ? <p className={s.loi}>{loi}</p> : null}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Tạo hàng loạt theo tháng
 * ══════════════════════════════════════════════════════════════════════════ */

function TaoHangLoat({ dong }: { dong: () => void }) {
  const [than, datThan] = useState<ThanKeo>({
    ...THAN_TRONG, question_text: 'CPI tháng {thang} so với tháng trước?',
  });
  const [soThang, datSoThang] = useState(3);
  const m = useTaoHangLoat();
  const xem = than.open_ts ? nhanBanTheoThang(than, soThang) : [];

  return (
    <div className={s.khoi}>
      <button type="button" className={s.lienKet} onClick={dong}>‹ đóng</button>
      <h3 className={s.khoiTieuDe}>TẠO HÀNG LOẠT THEO THÁNG</h3>
      <p className={s.mo}>
        Viết một kèo mẫu rồi nhân theo tháng. Chuỗi <code>{'{thang}'}</code> trong
        câu hỏi được thay bằng tháng thật của từng kèo. Ngày dịch theo THÁNG LỊCH,
        không phải cộng 30 ngày.
      </p>
      <label className={s.oNhan}>SỐ THÁNG</label>
      <input className={s.o} type="number" min={1} max={12} value={soThang}
        onChange={(e) => datSoThang(Math.min(12, Math.max(1, Number(e.target.value))))} />

      <BieuMau
        than={than} datThan={datThan} nhan={`TẠO ${soThang} KÈO`}
        dangChay={m.isPending} loi={m.error ? (m.error as Error).message : null}
        chay={() => m.mutate(nhanBanTheoThang(than, soThang), { onSuccess: dong })}
      />

      {xem.length > 0 ? (
        <>
          <h3 className={s.khoiTieuDe}>XEM TRƯỚC {xem.length} KÈO SẼ TẠO</h3>
          <table className={s.bang}>
            <tbody>
              {xem.map((k, i) => (
                <tr key={i}>
                  <td>{k.question_text}</td>
                  <td className={s.mo}>{gio(k.open_ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Tab chính
 * ══════════════════════════════════════════════════════════════════════════ */

export function QuanKeo() {
  const [tt, datTt] = useState('');
  const [pool, datPool] = useState('');
  const [q, datQ] = useState('');
  const [trang, datTrang] = useState(0);
  const [xemId, datXemId] = useState<string | null>(null);
  const [suaKeo, datSuaKeo] = useState<KeoDong | null>(null);
  const [than, datThan] = useState<ThanKeo>(THAN_TRONG);
  const [moLo, datMoLo] = useState(false);
  const [chuaXacThuc, datChuaXacThuc] = useState<{ id: string; bat: boolean } | null>(null);

  const ds = useDanhSachKeo({ tt, pool, q, trang });
  const sua = useSuaKeo();
  const hen = useHenGio();

  const batHen = (k: KeoDong) =>
    hen.mutate({ id: k.market_id, bat: !k.tu_mo }, {
      // 403 `can_xac_thuc_lai` ⇒ hiện ô nhập mã rồi thử lại, thay vì báo lỗi cụt.
      onError: () => datChuaXacThuc({ id: k.market_id, bat: !k.tu_mo }),
    });

  if (xemId) return <XemTruoc id={xemId} dong={() => datXemId(null)} />;
  if (moLo) return <TaoHangLoat dong={() => datMoLo(false)} />;

  if (suaKeo) {
    return (
      <div className={s.khoi}>
        <button type="button" className={s.lienKet} onClick={() => datSuaKeo(null)}>‹ đóng</button>
        <h3 className={s.khoiTieuDe}>SỬA KÈO NHÁP</h3>
        <p className={s.mo}>
          Chỉ sửa được kèo CHƯA MỞ. Kèo đã mở mà đổi câu hỏi hay đổi cửa là đổi
          luật giữa chừng với người đang giữ token trong đó.
        </p>
        <BieuMau
          than={than} datThan={datThan} nhan="LƯU"
          dangChay={sua.isPending} loi={sua.error ? (sua.error as Error).message : null}
          chay={() => sua.mutate({ id: suaKeo.market_id, than }, {
            onSuccess: () => datSuaKeo(null),
          })}
        />
      </div>
    );
  }

  return (
    <>
      {chuaXacThuc ? (
        <ONhapMa nhan="CẦN XÁC THỰC LẠI" xong={() => {
          hen.mutate({ id: chuaXacThuc.id, bat: chuaXacThuc.bat });
          datChuaXacThuc(null);
        }} />
      ) : null}

      <div className={s.khoi}>
        <h3 className={s.khoiTieuDe}>LỌC</h3>
        <div className={s.hangO}>
          <span>
            <label className={s.oNhan}>TRẠNG THÁI</label>
            <select className={s.o} value={tt}
              onChange={(e) => { datTt(e.target.value); datTrang(0); }}>
              <option value="">tất cả</option>
              {TRANG_THAI.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </span>
          <span>
            <label className={s.oNhan}>POOL</label>
            <select className={s.o} value={pool}
              onChange={(e) => { datPool(e.target.value); datTrang(0); }}>
              <option value="">tất cả</option>
              {POOLS.map((p) => <option key={p.ma} value={p.ma}>{p.ten}</option>)}
            </select>
          </span>
          <span>
            <label className={s.oNhan}>TÌM TRONG CÂU HỎI</label>
            <input className={s.o} value={q}
              onChange={(e) => { datQ(e.target.value); datTrang(0); }} />
          </span>
        </div>
        <button type="button" className={`${s.tab} ${s.tabChon}`}
          onClick={() => datMoLo(true)}>+ TẠO HÀNG LOẠT THEO THÁNG</button>
      </div>

      {ds.isPending ? <p className={s.mo}>đang tải…</p> : null}
      {ds.error ? <p className={s.loi}>{(ds.error as Error).message}</p> : null}
      {ds.data ? (
        <div className={s.khoi}>
          <h3 className={s.khoiTieuDe}>{ds.data.tong} KÈO</h3>
          <table className={s.bang}>
            <thead>
              <tr>
                <th>câu hỏi</th><th>pool</th><th>trạng thái</th><th>mở lúc</th>
                <th className={s.phai}>người</th><th className={s.phai}>volume</th><th>việc</th>
              </tr>
            </thead>
            <tbody>
              {ds.data.keo.map((k) => (
                <tr key={k.market_id}>
                  <td>{k.question_text}</td>
                  <td className={s.mo}>{k.pool}</td>
                  <td className={s.mo}>
                    {k.status}{k.tu_mo ? ' · ⏰ tự mở' : ''}
                  </td>
                  <td className={s.mo}>{gio(k.open_ts)}</td>
                  <td className={s.phai}>{k.so_nguoi}</td>
                  <td className={s.phai}>{soT(k.volume_nguoi)}</td>
                  <td>
                    {k.status === 'draft' ? (
                      <>
                        <button type="button" className={s.lienKet} onClick={() => {
                          datThan({
                            pool: k.pool, question_text: k.question_text,
                            resolution_source_name: '', resolution_source_url: '',
                            open_ts: k.open_ts, lock_ts: k.lock_ts,
                            resolve_deadline_ts: k.resolve_deadline_ts,
                            seed_per_option: Number(k.seed_per_option),
                            options: [{ label: '' }, { label: '' }],
                          });
                          datSuaKeo(k);
                        }}>sửa</button>
                        {' · '}
                        <button type="button" className={s.lienKet} onClick={() => batHen(k)}>
                          {k.tu_mo ? 'tắt hẹn giờ' : 'hẹn giờ mở'}
                        </button>
                      </>
                    ) : (
                      <button type="button" className={s.lienKet}
                        onClick={() => datXemId(k.market_id)}>xem như người chơi</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <button type="button" className={s.tab} disabled={trang === 0}
              onClick={() => datTrang(trang - 1)}>‹ trước</button>
            {' '}
            <button type="button" className={s.tab}
              disabled={(trang + 1) * ds.data.moi_trang >= ds.data.tong}
              onClick={() => datTrang(trang + 1)}>sau ›</button>
          </p>
        </div>
      ) : null}
    </>
  );
}
