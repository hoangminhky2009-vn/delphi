/**
 * KHU PHÂN KHÚC (D335) — dựng nhóm · lưu dùng chung · so hai nhóm · chia một nhóm. Bám demo đã chốt.
 *
 * ⚠ Nhóm dưới sàn KHÔNG có số nào rời server (`n: null`) — màn chỉ in "<5", không suy ra gì. Lưu nhóm cũng khoá
 *   khi nhóm dưới sàn: một nhóm lưu mà mở ra lần nào cũng trống thì chỉ dạy người ta nới điều kiện cho tới khi
 *   nó chỉ đích một người.
 * ⚠ Số "mỗi người" chia ở màn từ hai số server trả cùng một ảnh chụp (tử và mẫu cùng một lượt đọc).
 */
import { useState } from 'react';
import { AGE_BAND_LABELS, OCCUPATION_LABELS, REGION_LABELS } from '@/lib/labels';
import {
  useChiaNhom, useCoNhieuNhom, useLuuNhom, useNhomLuu, useTinhNhom, useXoaNhom,
  type ChiSoNhomDTO, type DieuKienDTO, type TheoChia, type ThamSoKhoang,
} from '@/api/phantich';
import { Cho } from '@/screens/admin/Cho';
import { congNgay, ngayDu, ngayNgan, pt, so, so1 } from './khoang';
import s from './QuanTriApp.module.css';

const TUOI = AGE_BAND_LABELS as Record<string, string>;
const VUNG = REGION_LABELS as Record<string, string>;
const NGHE = OCCUPATION_LABELS as Record<string, string>;

export function moTaDieuKien(dk: DieuKienDTO): string {
  const p: string[] = [];
  if (dk.tao_tu || dk.tao_den) p.push(`tạo ${dk.tao_tu ? ngayDu(dk.tao_tu) : '…'} → ${dk.tao_den ? ngayDu(dk.tao_den) : 'nay'}`);
  if (dk.tuoi?.length) p.push(dk.tuoi.map((x) => TUOI[x] ?? x).join('/'));
  if (dk.vung?.length) p.push(dk.vung.map((x) => VUNG[x] ?? x).join('/'));
  if (dk.nghe?.length) p.push(dk.nghe.map((x) => NGHE[x] ?? x).join('/'));
  if (dk.tran_tu) p.push(`≥ ${dk.tran_tu} trận đã xong`);
  if (dk.vao_trong_ngay) p.push(`vào app trong ${dk.vao_trong_ngay} ngày qua`);
  if (dk.xong_tap) p.push('xong màn tập');
  if (dk.dung_tai_chinh) p.push('có dùng khu Tài chính');
  return p.length ? p.join(' · ') : 'mọi người bật ghi';
}

const bat = <T extends string>(ds: T[] | undefined, x: T): T[] | undefined => {
  const cu = ds ?? [];
  const moi = cu.includes(x) ? cu.filter((y) => y !== x) : [...cu, x];
  return moi.length ? moi : undefined;
};

export function PhanKhuc({ k, homNay }: { k: ThamSoKhoang; homNay: string }) {
  const [dk, datDk] = useState<DieuKienDTO>({});
  const [ten, datTen] = useState('');
  const hienTai = useTinhNhom([dk], k);
  const luu = useLuuNhom();
  const ds = useNhomLuu();
  const xoa = useXoaNhom();
  const nhomLuu = ds.data?.nhom ?? [];
  const co = useCoNhieuNhom(nhomLuu.map((x) => x.dieu_kien), k);
  const [a, datA] = useState<string | null>(null);
  const [b, datB] = useState<string | null>(null);
  const [chacXoa, datChacXoa] = useState<string | null>(null);
  const idA = a ?? nhomLuu[0]?.id ?? null;
  const idB = b ?? nhomLuu[1]?.id ?? null;
  const A = nhomLuu.find((x) => x.id === idA);
  const B = nhomLuu.find((x) => x.id === idB);
  const san = hienTai.data?.san ?? 5;
  const kq = hienTai.data?.nhom[0];

  const nhomChip = (khoa: 'tuoi' | 'vung' | 'nghe', bang: Record<string, string>) => Object.entries(bang).map(([id, t]) => (
    <button key={id} type="button" className={s.cChip} aria-pressed={dk[khoa]?.includes(id) ?? false}
      onClick={() => datDk({ ...dk, [khoa]: bat(dk[khoa], id) })}>{t}</button>
  ));

  return (
    <>
      <div className={s.khuDau}>
        <h1 className={s.khuTen}>PHÂN KHÚC</h1>
        <span className={s.khuMo}>dựng một nhóm người bằng điều kiện · lưu lại · so hai nhóm · chia một nhóm</span>
      </div>
      <div className={s.luoi2}>
        <div className={s.khoi}>
          <div className={s.khoiTen}>DỰNG NHÓM <span>chỉ người bật ghi</span></div>
          <div className={s.dieuKien}>
            <span>Tạo tài khoản</span>
            <span className={s.dkChon}>
              từ <input type="date" id="pk-tao-tu" aria-label="Tạo từ ngày" value={dk.tao_tu ?? ''} max={homNay}
                onChange={(e) => datDk({ ...dk, tao_tu: e.target.value || undefined })} />
              đến <input type="date" id="pk-tao-den" aria-label="Tạo đến ngày" value={dk.tao_den ?? ''} max={homNay}
                onChange={(e) => datDk({ ...dk, tao_den: e.target.value || undefined })} />
            </span>
            <span>Nhóm tuổi</span><span className={s.dkChon}>{nhomChip('tuoi', TUOI)}</span>
            <span>Vùng</span><span className={s.dkChon}>{nhomChip('vung', VUNG)}</span>
            <span>Nghề</span><span className={s.dkChon}>{nhomChip('nghe', NGHE)}</span>
            <span>Số trận đã xong</span>
            <span className={s.dkChon}>
              từ <input type="number" id="pk-tran" aria-label="Số trận đã xong tối thiểu" min={0} max={999} style={{ width: 64 }}
                value={dk.tran_tu ?? ''} placeholder="0"
                onChange={(e) => datDk({ ...dk, tran_tu: Number(e.target.value) > 0 ? Math.trunc(Number(e.target.value)) : undefined })} />
              trận trở lên (cả đời tài khoản)
            </span>
            <span>Có vào app trong</span>
            <span className={s.dkChon}>
              <input type="number" id="pk-vao" aria-label="Có vào app trong số ngày gần nhất" min={0} max={90} style={{ width: 64 }}
                value={dk.vao_trong_ngay ?? ''} placeholder="—"
                onChange={(e) => {
                  const n = Math.trunc(Number(e.target.value));
                  datDk({ ...dk, vao_trong_ngay: n >= 1 && n <= 90 ? n : undefined });
                }} />
              ngày gần nhất (tối đa 90)
            </span>
            <span>Hành vi</span>
            <span className={s.dkChon}>
              <button type="button" className={s.cChip} aria-pressed={dk.xong_tap ?? false}
                onClick={() => datDk({ ...dk, xong_tap: dk.xong_tap ? undefined : true })}>xong màn tập</button>
              <button type="button" className={s.cChip} aria-pressed={dk.dung_tai_chinh ?? false}
                onClick={() => datDk({ ...dk, dung_tai_chinh: dk.dung_tai_chinh ? undefined : true })}>có dùng khu Tài chính</button>
            </span>
          </div>
          <div className={s.ketQua}>
            <div>
              <div className={s.oNhan}>NHÓM NÀY CÓ</div>
              <div className={s.oGt} data-testid="pk-co-nhom">
                {kq === undefined ? '…' : kq.n === null ? <span className={s.an}>&lt;{san}</span> : so(kq.n)}<small>người</small>
              </div>
            </div>
            <span className={s.it} style={{ flex: 1, minWidth: 160 }}>{moTaDieuKien(dk)}</span>
            <input type="text" id="pk-ten" aria-label="Tên nhóm" placeholder="tên nhóm" maxLength={60} value={ten} onChange={(e) => datTen(e.target.value)} />
            <button type="button" className={s.nutChinh} disabled={!kq || kq.n === null || !ten.trim() || luu.isPending}
              onClick={() => luu.mutate({ ten: ten.trim(), dieu_kien: dk }, { onSuccess: (r) => { datTen(''); datA(r.id); } })}>
              LƯU NHÓM
            </button>
            <button type="button" className={s.nutPhu} onClick={() => datDk({})}>XOÁ ĐIỀU KIỆN</button>
          </div>
          {kq?.chi_so ? (
            <p className={s.ghiChu}>
              Trong khoảng đang chọn: {kq.chi_so.vao_app === null ? 'chưa đo được số người vào app'
                : `${so(kq.chi_so.vao_app)} người vào app (${Math.round(pt(kq.chi_so.vao_app, kq.chi_so.n))}%)`}
              {kq.chi_so.phien === null ? '' : ` · ${so1(kq.chi_so.phien / kq.chi_so.n)} phiên/người`}
              {` · ${so1(kq.chi_so.tran / kq.chi_so.n)} trận/người`}.
            </p>
          ) : kq ? <p className={s.ghiChu}>Dưới {san} người: không hiện chỉ số, không lưu được.</p> : null}
          {luu.error ? <p className={s.loi}>{String((luu.error as Error).message)}</p> : null}
        </div>

        <div className={s.khoi}>
          <div className={s.khoiTen}>NHÓM ĐÃ LƯU <span>dùng chung giữa các admin · chọn A và B để so</span></div>
          <Cho q={ds} con={(
            <div className={s.nhomLuu}>
              {nhomLuu.length === 0 ? <p className={s.ghiChu}>Chưa có nhóm nào. Dựng một nhóm bên trái rồi bấm LƯU NHÓM.</p> : null}
              {nhomLuu.map((g, i) => (
                <div key={g.id} className={s.nhomDong} data-testid={`nhom-luu-${g.id}`}>
                  <span><b>{g.ten}</b><br /><span className={s.it}>{moTaDieuKien(g.dieu_kien)} · lưu bởi {g.tao_boi}</span></span>
                  <span className={s.so}>{co[i] === undefined ? '…' : co[i]!.n === null ? <span className={s.an}>&lt;{san}</span> : so(co[i]!.n)} người</span>
                  <button type="button" className={`${s.chonAB} ${s.chonA}`} aria-pressed={idA === g.id} aria-label={`Chọn ${g.ten} làm nhóm A`} onClick={() => datA(g.id)}>A</button>
                  <button type="button" className={`${s.chonAB} ${s.chonB}`} aria-pressed={idB === g.id} aria-label={`Chọn ${g.ten} làm nhóm B`} onClick={() => datB(g.id)}>B</button>
                  <button type="button" className={s.xoaNho} disabled={xoa.isPending}
                    onClick={() => { if (chacXoa !== g.id) { datChacXoa(g.id); return; } xoa.mutate(g.id); datChacXoa(null); }}>
                    {chacXoa === g.id ? 'bấm lần nữa để xoá' : 'xoá'}
                  </button>
                </div>
              ))}
            </div>
          )} />
        </div>
      </div>

      {A && B ? <SoHaiNhom A={A} B={B} k={k} /> : null}
      {A ? <ChiaNhom A={A} k={k} homNay={homNay} /> : null}
    </>
  );
}

function SoHaiNhom({ A, B, k }: {
  A: { ten: string; dieu_kien: DieuKienDTO }; B: { ten: string; dieu_kien: DieuKienDTO }; k: ThamSoKhoang;
}) {
  const q = useTinhNhom([A.dieu_kien, B.dieu_kien], k);
  const san = q.data?.san ?? 5;
  const ca = q.data?.nhom[0]?.chi_so ?? null;
  const cb = q.data?.nhom[1]?.chi_so ?? null;
  /*
   * Kiểu của dòng quyết định CẢ cách in giá trị LẪN cách in chênh. ⚠ Bản đầu chỉ có cờ "là phần trăm" nên dòng thời
   * lượng in chênh bằng mili-giây trần: "A thấp hơn 39.053" — đọc thành ba mươi chín nghìn (soi mắt 15/09).
   */
  type KieuDong = 'so' | 'pt' | 'phut';
  type Dong = [string, (c: ChiSoNhomDTO) => number | null, KieuDong];
  const DONG: Dong[] = [
    ['Số người', (c) => c.n, 'so'],
    ['Có vào app trong khoảng', (c) => (c.vao_app === null ? null : pt(c.vao_app, c.n)), 'pt'],
    ['Phiên mỗi người', (c) => (c.phien === null ? null : c.phien / c.n), 'so'],
    ['Thời gian mỗi phiên (trung vị)', (c) => (c.ms_moi_phien_tv === null ? null : c.ms_moi_phien_tv / 60_000), 'phut'],
    ['Trận mỗi người', (c) => c.tran / c.n, 'so'],
    ['Xong màn tập', (c) => pt(c.xong_tap, c.n), 'pt'],
    ['Quay lại tuần 2', (c) => (c.quay_lai.nhom < san ? null : pt(c.quay_lai.co, c.quay_lai.nhom)), 'pt'],
    ['Có dùng khu Tài chính', (c) => pt(c.dung_tai_chinh, c.n), 'pt'],
  ];
  const inGt = (v: number, kieu: KieuDong) => (kieu === 'pt' ? `${Math.round(v)}%` : kieu === 'phut' ? `${so1(v)} phút` : so1(v));
  const inChenh = (d: number, kieu: KieuDong) =>
    (kieu === 'pt' ? `${Math.round(Math.abs(d))} điểm %` : kieu === 'phut' ? `${so1(Math.abs(d))} phút` : so1(Math.abs(d)));
  const o = (c: ChiSoNhomDTO | null, f: Dong[1], kieu: KieuDong) => {
    if (!c) return <span className={s.an}>&lt;{san}</span>;
    const v = f(c);
    return v === null ? <span className={s.an}>—</span> : inGt(v, kieu);
  };
  return (
    <div className={s.khoi}>
      <div className={s.khoiTen}>SO HAI NHÓM <span>trong khoảng {ngayDu(k.tu)} → {ngayDu(k.den)}</span></div>
      <Cho q={q} con={(
        <div className={s.cuon}>
          <table className={s.bang} data-testid="so-hai-nhom">
            <thead>
              <tr>
                <th>chỉ số</th>
                <th className={s.so} style={{ color: 'var(--neon)' }}>A · {A.ten}</th>
                <th className={s.so} style={{ color: 'var(--tim)' }}>B · {B.ten}</th>
                <th>chênh</th>
              </tr>
            </thead>
            <tbody>
              {DONG.map(([ten, f, kieu]) => {
                const va = ca ? f(ca) : null;
                const vb = cb ? f(cb) : null;
                let chenh: React.ReactNode = '';
                if (va !== null && vb !== null) {
                  const d = va - vb;
                  chenh = Math.abs(d) < (kieu === 'pt' ? 0.5 : 0.05) ? <span className={s.an}>≈</span>
                    : <span className={d > 0 ? s.len : s.xuong}>{d > 0 ? 'A cao hơn' : 'A thấp hơn'} {inChenh(d, kieu)}</span>;
                }
                return <tr key={ten}><td>{ten}</td><td className={s.so}>{o(ca, f, kieu)}</td><td className={s.so}>{o(cb, f, kieu)}</td><td>{chenh}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      )} />
      <p className={s.ghiChu}>Hai nhóm có thể chồng lên nhau (một người thuộc cả A lẫn B). Chênh lệch trên nhóm nhỏ dễ là ngẫu nhiên — xem cỡ nhóm trước khi kết luận.</p>
    </div>
  );
}

const TEN_CHIA: ReadonlyArray<[TheoChia, string]> = [
  ['tuoi', 'Nhóm tuổi'], ['vung', 'Vùng'], ['nghe', 'Nghề'], ['so_tran', 'Số trận đã xong'], ['tuan_tao', 'Tuần tạo tài khoản'],
];
const TEN_RO_TRAN: Readonly<Record<string, string>> = { 0: '0 trận', 1: '1–2 trận', 3: '3–9 trận', 10: '10 trận trở lên' };

function ChiaNhom({ A, k, homNay }: { A: { ten: string; dieu_kien: DieuKienDTO }; k: ThamSoKhoang; homNay: string }) {
  const [theo, datTheo] = useState<TheoChia>('tuoi');
  const q = useChiaNhom(A.dieu_kien, theo, k);
  const san = q.data?.san ?? 5;
  const tenKhoa = (khoa: string): string => {
    if (theo === 'tuoi') return TUOI[khoa] ?? khoa;
    if (theo === 'vung') return VUNG[khoa] ?? khoa;
    if (theo === 'nghe') return NGHE[khoa] ?? khoa;
    if (theo === 'so_tran') return TEN_RO_TRAN[khoa] ?? khoa;
    if (khoa.endsWith('+')) return `cũ hơn ${khoa.slice(0, -1)} tuần`;
    const t = Number(khoa);
    return `${ngayNgan(congNgay(homNay, -7 * t - 6))} → ${ngayNgan(congNgay(homNay, -7 * t))}`;
  };
  const maxN = Math.max(1, ...(q.data?.nhom ?? []).map((x) => x.n ?? 0));
  return (
    <div className={s.khoi}>
      <div className={s.khoiTen}>
        CHIA NHÓM A THEO
        <span className={s.tgHang}>
          {TEN_CHIA.map(([id, t]) => (
            <button key={id} type="button" className={s.chip} aria-pressed={theo === id} onClick={() => datTheo(id)}>{t}</button>
          ))}
        </span>
      </div>
      <Cho q={q} con={q.data ? (
        q.data.n === null ? <p className={s.ghiChu}>Nhóm A dưới {san} người — không chia.</p> : (
          <div className={s.cuon}>
            <table className={s.bang} data-testid="chia-nhom">
              <thead><tr><th>{TEN_CHIA.find(([id]) => id === theo)![1]}</th><th className={s.so}>người</th><th /><th className={s.so}>trận mỗi người</th><th className={s.so}>quay lại tuần 2</th></tr></thead>
              <tbody>
                {q.data.nhom.map((x) => (
                  <tr key={x.khoa}>
                    <td>{tenKhoa(x.khoa)}</td>
                    <td className={s.so}>{x.n === null ? <span className={s.an}>&lt;{san}</span> : so(x.n)}</td>
                    <td><span className={s.thanhNgang}><i style={{ width: `${x.n === null ? 0 : (x.n / maxN) * 100}%` }} /></span></td>
                    <td className={s.so}>{x.n && x.tran !== null ? so1(x.tran / x.n) : <span className={s.an}>—</span>}</td>
                    <td className={s.so}>{x.quay_lai ? `${Math.round(pt(x.quay_lai.co, x.quay_lai.nhom))}%` : <span className={s.an}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null} />
      <p className={s.ghiChu}>Ô dưới {san} người: không hiện số, không hiện thanh. "Quay lại tuần 2" chỉ hiện khi đủ {san} người đã tới tuần 2.</p>
    </div>
  );
}
