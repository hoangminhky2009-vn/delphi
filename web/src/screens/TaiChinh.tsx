/**
 * TÀI CHÍNH CÁ NHÂN — hồ sơ "Tính cách tài chính" (04 §3; founder 08/08:
 * *"biến tính năng phân tích tính cách này thành 1 profile, biểu đồ phân tích
 * thú vị… vừa giúp player hiểu bản thân vừa có giá trị giải trí/flex"*).
 *
 * ─── BA LUẬT CỦA TRANG ──────────────────────────────────────────────────────
 * 1. MÔ TẢ được, KÊ ĐƠN không (A10): mọi câu nói về hành vi ĐÃ ĐO trong trò.
 *    Trang tự nói rõ nó không phải lời khuyên cho tiền thật.
 * 2. Mọi hình vẽ chỉ là BIẾN HÌNH của số thật — bảng số gốc luôn nằm ngay
 *    dưới, không có hình nào nói điều mà số không nói (bài học D62: một bảng
 *    nói sai thì người ta tin).
 * 3. SVG thuần, không thư viện biểu đồ (cùng idiom mặt quản trị) — radar và
 *    đường độ chuẩn chỉ là polygon/polyline.
 *
 * Emoji CỐ Ý (founder đặt hàng "icon/emoji vui vui") — trang khoe, khác luật
 * bàn đấu D47.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMe, useDongToken } from '@/api/queries';
import { useNangLuc, useSoTay, useTinhCach, useTuDienMat, type HoSoGoi } from '@/api/tinh_cach';
import { useTraLoiTuKhai, useTuKhai } from '@/api/cai_dat';
import {
  BAC_DOC_NHAN, KHAU_VI_NHAN, NET_NHAN, NHAN_CHI_SO, NHAN_DONG_TOKEN, giongCua, theCua,
  trucRadar, type Giong, type GiongChon,
} from '@/lib/tinh_cach';
import { ScreenFrame } from '@/components/ScreenFrame';
import { NutCaiDatPfm } from '@/components/pfm/NutCaiDatPfm';
import { SoTayKhaiNiem } from '@/components/SoTayKhaiNiem';
import { HangKyNangNguoi } from '@/components/HangKyNang';
import { CHU_CHE_DO_TESTER } from '@/lib/buoi_do_chu';
import { NutHoi } from '@/components/ui/NutHoi';
import { formatT } from '@/lib/money';
import { useReducedMotion } from '@/lib/hooks';
import { ROUTE_CAI_DAT, ROUTE_PROFILE } from '@/lib/vocab';
import s from './TaiChinh.module.css';

/** Toạ độ đỉnh i/n trên vòng tròn bán kính r, tâm (c, c) — đỉnh đầu ở 12h. */
const dinh = (i: number, n: number, r: number, c: number): [number, number] => {
  const goc = (Math.PI * 2 * i) / n - Math.PI / 2;
  return [c + r * Math.cos(goc), c + r * Math.sin(goc)];
};

/**
 * HỆ SỐ KÉO RA 0→1 khi khối lăn vào tầm nhìn (founder 08/08: *"khi mở/dần đến
 * phần đó những chỉ số sẽ kéo từ tâm ra các góc và số thì nhảy từ 0 chạy lên
 * hiện tại"*).
 *
 * · NHẢY NẤC bằng state rời rạc (14 nấc × 45ms ≈ 0,6s) chứ không phải CSS
 *   animation liên tục — số "chạy" đúng kiểu bảng điện tử, hợp §XI, và không
 *   đụng luật chỉ-animate-transform/opacity vì đây là re-render, không phải
 *   thuộc tính layout bị animate.
 * · Chạy MỘT LẦN mỗi lần vào trang — trang khoe, không phải màn hình nhấp nháy.
 * · Reduced-motion / môi trường không có IntersectionObserver (jsdom, trình
 *   duyệt cũ) ⇒ hiện thẳng giá trị thật: hoạt ảnh là gia vị, số mới là món.
 *
 * ⚠⚠ TRẢ VỀ **CALLBACK REF**, KHÔNG PHẢI `useRef` — founder phải báo HAI LẦN
 * mới lộ ra. Bản đầu dùng `useRef` + `useEffect([itMotion])`: effect chạy đúng
 * MỘT LẦN lúc mount, mà lúc đó `/me/tinh-cach` còn đang bay nên khối radar
 * CHƯA RENDER ⇒ `ref.current` null ⇒ hook rơi vào nhánh "không quan sát được"
 * và đặt thẳng k=1. Data về sau vài trăm ms, radar hiện ra ĐÃ ĐẦY — im lặng,
 * không lỗi, và đúng thứ founder nhìn thấy.
 *
 * `useState` cho cái NODE là mấu chốt: hàm `setNode` bền qua mọi lần render
 * (React bảo đảm), nên nó dùng làm ref callback được; và khi node THẬT SỰ gắn
 * vào DOM thì state đổi ⇒ effect chạy LẠI ⇒ observer mới bám đúng phần tử.
 * Không phụ thuộc thứ tự "data về trước hay sau khi mount" nữa.
 *
 * ⚠ BÀI HỌC ĐO: hôm 08/08 tôi nghiệm thu bằng điều hướng SPA (pushState) khi
 * dữ liệu ĐÃ nằm trong cache — đường đó render khối ngay lập tức nên hoạt ảnh
 * chạy thật và phép đo XANH. Đường người thật đi là NẠP THẲNG trang. Đo trên
 * đường tắt thì không bao giờ thấy lỗi của đường chính.
 */
function useKeoRa(): [(el: HTMLDivElement | null) => void, number] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [k, setK] = useState(0);
  const itMotion = useReducedMotion();
  useEffect(() => {
    const el = node;
    if (!el) return undefined;
    if (itMotion || typeof IntersectionObserver === 'undefined') {
      setK(1);
      return undefined;
    }
    let id: ReturnType<typeof setInterval> | null = null;
    const chay = () => {
      if (id !== null) return;
      io.disconnect();
      const NAC = 14;
      let n = 0;
      id = setInterval(() => {
        n += 1;
        setK(n / NAC);
        if (n >= NAC && id !== null) clearInterval(id);
      }, 45);
    };
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) chay();
    }, { threshold: 0.25 });
    io.observe(el);
    /*
     * LƯỚI AN TOÀN: IO không bắn (tab nền, prerender, quirk trình duyệt) thì
     * 2,5s sau tự chạy. Một trang đứng ở "0.00" vĩnh viễn là một BẢNG NÓI SAI
     * — người ta tin nó (D62); thà mất màn kéo-ra còn hơn hiện số giả.
     */
    const duPhong = setTimeout(chay, 2_500);
    return () => {
      io.disconnect();
      clearTimeout(duPhong);
      if (id !== null) clearInterval(id);
    };
  }, [node, itMotion]);
  return [setNode, k];
}

/** RADAR 6 trục — hình flex chính của trang. `k` kéo hình từ tâm ra các góc. */
function Radar({ truc, k = 1 }: { truc: ReturnType<typeof trucRadar>; k?: number }) {
  const C = 110; const R = 78;
  const diem = truc
    .map((t, i) => dinh(i, truc.length, (R * t.diem * k) / 100, C));
  return (
    <svg className={s.radar} viewBox="0 0 220 220" role="img"
      aria-label="Radar sáu trục tính cách">
      {/* Lưới nền ba nấc + trục — ĐỨNG YÊN làm khung, chỉ HÌNH kéo ra theo `k`. */}
      {[1 / 3, 2 / 3, 1].map((nac) => (
        <polygon key={nac} className={s.radarLuoi}
          points={truc.map((_, i) => dinh(i, truc.length, R * nac, C).join(',')).join(' ')} />
      ))}
      {truc.map((_, i) => {
        const [x, y] = dinh(i, truc.length, R, C);
        return <line key={i} className={s.radarLuoi} x1={C} y1={C} x2={x} y2={y} />;
      })}
      <polygon className={s.radarHinh} points={diem.map((d) => d.join(',')).join(' ')} />
      {diem.map(([x, y], i) => (
        <circle key={i} className={truc[i]!.mo ? s.radarDiemMo : s.radarDiem}
          cx={x} cy={y} r={3} />
      ))}
      {truc.map((t, i) => {
        const [x, y] = dinh(i, truc.length, R + 18, C);
        return (
          <text key={t.ten} className={t.mo ? s.radarNhanMo : s.radarNhan}
            x={x} y={y} textAnchor="middle" dominantBaseline="middle">
            {t.ten}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * Đường ĐỘ CHUẨN theo thời gian: vẽ (2−brier)/2 để đường ĐI LÊN = tiến bộ.
 * Nay là một DÒNG NHỎ trong khối số gốc, không còn là khối riêng — xem `SoGoc`.
 */
function DuongDoChuan({ chuoi }: { chuoi: number[] }) {
  if (chuoi.length < 4) return null;
  const W = 280; const H = 40;
  const doChuan = chuoi.map((b) => (2 - b) / 2);
  const pts = doChuan.map((v, i) => `${(i / (doChuan.length - 1)) * W},${H - v * H}`);
  return (
    <div className={s.duongOm}>
      <span className={s.duongNhan}>ĐỘ CHUẨN QUA {chuoi.length} VÒNG · lên = khá hơn</span>
      <svg className={s.duong} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label="Đường độ chuẩn niềm tin theo thời gian">
        <polyline className={s.duongNet} points={pts.join(' ')} />
      </svg>
    </div>
  );
}

/**
 * SỐ GỐC — khối "soi kỹ", ĐẨY XUỐNG DƯỚI CÙNG (founder 11/08).
 *
 * ⚠ ĐẨY XUỐNG chứ KHÔNG GIẤU. Founder cho hai lựa chọn ("bỏ luôn hoặc thiết
 * kế lại và cho xuống dưới cùng"); chọn cái thứ hai vì D73 dựng cả trang này
 * trên một luật: *mọi hình chỉ là BIẾN HÌNH của số thật, số phải có mặt* —
 * bỏ số đi thì radar ở trên thành một hình không ai kiểm được, đúng lớp lỗi
 * D62 ("một bảng nói sai thì người ta tin").
 *
 * Thiết kế lại theo đúng vai: đây là phần cho người MUỐN SOI, không phải phần
 * khoe. Nên nó gộp làm một (sáu chỉ số + đường độ chuẩn + cỡ mẫu), chữ nhỏ
 * hơn, nhãn xám, và đứng sau mọi thứ đáng khoe.
 */
function SoGoc({ hs, k, gan }: {
  hs: NonNullable<ReturnType<typeof useTinhCach>['data']>;
  k: number;
  gan: (el: HTMLDivElement | null) => void;
}) {
  const cs = hs.chi_so;
  /*
   * `k` nhân TRƯỚC khi định dạng: số trên màn "chạy từ 0 lên hiện tại" mà mọi
   * nhánh định dạng (%, ×, dấu) vẫn đi qua đúng một đường — không có bản sao
   * công thức thứ hai chỉ để làm hoạt ảnh (bài học D61).
   */
  const pctChi = (x: number) => `${Math.round(x * k * 100)}%`;
  const soChi = (x: number, lamTron: number) => (x * k).toFixed(lamTron);
  const hang = [
    [NHAN_CHI_SO.hieu_chinh, cs.hieu_chinh
      ? `${soChi(cs.hieu_chinh.brier_tb, 2)}${
        cs.hieu_chinh.xu_huong !== null
          ? cs.hieu_chinh.xu_huong < 0 ? ' · đang chuẩn dần' : ' · đang loãng dần'
          : ''}`
      : null],
    // D106 — #2/#3 đo SO VỚI NỀN: hiện "khi X: a% · bình thường: b%".
    [NHAN_CHI_SO.duoi_gia, cs.duoi_gia
      ? `khi chuỗi xanh ${pctChi(cs.duoi_gia.ty_le)} · bình thường ${pctChi(cs.duoi_gia.nen)}`
      : null],
    [NHAN_CHI_SO.theo_tin, cs.theo_tin
      ? `có tin ${pctChi(cs.theo_tin.ty_le)} · không tin ${pctChi(cs.theo_tin.nen)}${
        cs.theo_tin.lech_tin_gia !== null
          ? ` · ăn tin dựng ${cs.theo_tin.lech_tin_gia >= 0 ? '+' : ''}${pctChi(cs.theo_tin.lech_tin_gia)} so nền` : ''}`
      : null],
    [NHAN_CHI_SO.chot_non, cs.chot_non
      ? `${cs.chot_non.lech >= 0 ? '+' : ''}${soChi(cs.chot_non.lech, 2)}` : null],
    [NHAN_CHI_SO.don_von, cs.don_von
      ? [
        cs.don_von.sau_thang_x !== null
          ? `sau thắng ×${soChi(cs.don_von.sau_thang_x, 1)}` : null,
        cs.don_von.sau_thua_x !== null
          ? `sau thua ×${soChi(cs.don_von.sau_thua_x, 1)}` : null,
      ].filter(Boolean).join(' · ') || null
      : null],
    [NHAN_CHI_SO.mua_tin, cs.mua_tin ? pctChi(cs.mua_tin.ty_le) : null],
    [NHAN_CHI_SO.khau_vi, cs.khau_vi
      ? `tiền đang làm việc ${pctChi(cs.khau_vi.phoi_nhiem_tb)} · ${soChi(cs.khau_vi.so_ma_tb, 1)} rổ · đứng ngoài ${pctChi(cs.khau_vi.dung_ngoai)} vòng`
      : null],
  ] as const;

  return (
    <div className={`${s.khoi} ${s.khoiSo}`} ref={gan}>
      <NhanGiai nhan="SỐ GỐC — phần soi kỹ" lop={s.khoiNhanPhu} giai={CHU_GIAI.soGoc} />
      <div className={s.bang}>
        {hang.map(([nhan, gt]) => (
          <div key={nhan.ten} className={s.dong} title={nhan.giai}>
            <span className={s.dongTen}>{nhan.ten}</span>
            <span className={s.dongGt}>{gt ?? 'chưa đủ dữ liệu'}</span>
          </div>
        ))}
      </div>
      <DuongDoChuan chuoi={hs.brier_chuoi} />
      {/* Cỡ mẫu vẫn NHÌN THẤY (D62: số không kèm n là số nói dối); câu giải thích lên `!` ở nhãn. */}
      <p className={s.chuThich}>
        {hs.n_vong} vòng · {hs.n_tran} trận đã xong{hs.goi ? ` · gói ${hs.goi.so}` : ''}
      </p>
    </div>
  );
}

/**
 * 13/09 — NHÃN KHỐI + `!`. Câu giải thích của khối (đo gì · tính thế nào) nằm SAU dấu, không nằm
 * sẵn dưới khối. Founder: *"toàn chữ là chữ, đọc muốn lòi mắt… chữ thì chỉ dành cho bách khoa toàn
 * thư"*. Tầng nhìn là thanh/số; tầng đọc là một cú chạm (`NutHoi`).
 */
export const CHU_GIAI = {
  tienDo: 'Chỉ trận CHƠI HẾT mới tính (bỏ dở và màn tập không đếm). Đủ cả ba là thẻ tự nở — không phải "chơi nhiều" mà là "đủ tình huống để đọc".',
  dongToken: 'Đọc thẳng từ sổ cái ví T — mọi đồng vào ra đều có bút toán, không có nguồn thứ hai để mà lệch.',
  soGoc: 'Radar phía trên chỉ là biến hình của đúng mấy con số này.',
} as const;

function NhanGiai({ nhan, giai, lop = s.khoiNhan }: { nhan: ReactNode; giai: ReactNode; lop?: string | undefined }) {
  const [mo, datMo] = useState(false);
  return (
    <>
      <div className={`${lop} ${s.nhanGiai}`}>
        <span>{nhan}</span>
        <NutHoi mo={mo} onBam={() => datMo((x) => !x)} nhan="Giải thích khối này" />
      </div>
      {mo && <p className={`${s.chuThich} ${s.giaiNhan}`}>{giai}</p>}
    </>
  );
}

/**
 * TIẾN ĐỘ GÓI — "phân tích chỉ bật khi có đủ pack" (D106). Ba điều kiện, ba
 * thanh, nói rõ còn thiếu GÌ chứ không phải "còn N trận". Gói đã đầy thì khối này
 * vẫn hiện cho gói ĐANG MỞ (thẻ tiếp theo đang tới).
 */
function TienDoGoi({ td, giong, daCoThe }: {
  td: HoSoGoi['tien_do']; giong: Giong; daCoThe: boolean;
}) {
  const hang: [string, number, number][] = [
    ['trận đã xong', td.tran, td.can.tran],
    ['vòng có quyết định', td.vong_quyet, td.can.vong_quyet],
    ['vòng có tin (sự kiện)', td.vong_su_kien, td.can.vong_su_kien],
  ];
  const loi = daCoThe
    ? (giong === 'tre' ? 'GÓI TIẾP THEO — thẻ mới đang tới 👀' : 'GÓI TIẾP THEO')
    : (giong === 'tre' ? 'DATA ĐANG LOADING 🗿 — CÒN THIẾU' : 'THẺ CHƯA NỞ — CÒN THIẾU');
  return (
    <div className={s.khoi} data-testid="tien-do-goi">
      <NhanGiai nhan={loi} giai={CHU_GIAI.tienDo} />
      <div className={s.bang}>
        {hang.map(([ten, co, can]) => (
          <div key={ten} className={s.dongToken}>
            <span className={s.dongTen}>{ten}</span>
            <span className={s.thanhCum}>
              <span className={s.thanhVao}
                style={{ width: `${Math.min(100, Math.round((co / can) * 100))}%` }} />
            </span>
            <span className={s.dongGt}>{co}/{can}{co >= can ? ' ✓' : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * CÂU TỰ KHAI (D101 Q4, Dohmen 2011) — hỏi SAU khi đã chơi, cạnh thẻ; trả lời một
 * thang 0–10; không thưởng. Đã có câu trả lời thì hiện ĐỐI CHIẾU: "bạn tự thấy X ·
 * trong trận đo ra Y" — hai con số cạnh nhau, KHÔNG phán xét cái nào đúng (A10, và
 * D101: phần LỆCH có hiển thị không là phán quyết founder — ở đây chỉ đặt cạnh).
 */
function TuKhai({ giong, khauVi, daChoi }: {
  giong: Giong; khauVi: HoSoGoi['khau_vi']; daChoi: boolean;
}) {
  const tk = useTuKhai(true);
  const tra = useTraLoiTuKhai();
  if (!daChoi || tk.isPending) return null;
  const cauHoi = giong === 'tre'
    ? 'Câu hỏi nhanh bro: ngoài đời bro là kiểu "liều ăn nhiều" hay "chắc cú cho lành"? 0 = né hết, 10 = tới luôn 🗿'
    : giong === 'vua'
      ? 'Một câu về NGOÀI ĐỜI: bạn là người sẵn sàng chấp nhận rủi ro hay cố tránh nó? 0 = tránh hết, 10 = rất sẵn sàng.'
      : 'Nhìn chung, ngoài đời bạn là người sẵn sàng chấp nhận rủi ro hay cố tránh rủi ro? 0 = hoàn toàn tránh, 10 = rất sẵn sàng.';
  const daTraLoi = tk.data?.rui_ro ?? null;
  return (
    <div className={s.khoi} data-testid="tu-khai">
      <div className={s.khoiNhan}>{daTraLoi === null ? 'MỘT CÂU — NGOÀI ĐỜI' : 'NGOÀI ĐỜI vs TRONG TRẬN'}</div>
      {daTraLoi === null ? (
        <>
          <p className={s.chuThich}>{cauHoi}</p>
          <div className={s.thangTuKhai} role="radiogroup" aria-label="Khẩu vị rủi ro ngoài đời">
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} type="button" className={s.nutThang} disabled={tra.isPending}
                onClick={() => tra.mutate(i)} data-testid={`tu-khai-${i}`}>{i}</button>
            ))}
          </div>
          <p className={s.chuThich}>Không có đáp án đúng, không có thưởng — chỉ để đặt cạnh con số đo được.</p>
        </>
      ) : (
        <div className={s.bang}>
          <div className={s.dong}>
            <span className={s.dongTen}>BẠN TỰ THẤY (ngoài đời)</span>
            <span className={s.dongGt}>{daTraLoi}/10 sẵn sàng rủi ro</span>
          </div>
          <div className={s.dong}>
            <span className={s.dongTen}>TRONG TRẬN ĐO RA</span>
            <span className={s.dongGt}>
              {khauVi ? KHAU_VI_NHAN[khauVi][giong].ten : 'chưa đủ gói để đo'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function TaiChinh() {
  const me = useMe();
  const hasUser = Boolean(me.data?.user);
  const giong = giongCua(me.data?.user?.age_band, me.data?.user?.giong_ho_so as GiongChon | undefined);
  const tc = useTinhCach(hasUser);
  const dt = useDongToken(hasUser);
  const soTay = useSoTay(hasUser);
  // 13/09 — ba dấu kỹ năng in trên mặt thẻ (tab NĂNG LỰC riêng đã gộp vào đây).
  const nangLuc = useNangLuc(hasUser);
  // 12/09 (Q3) — tên mặt/mã cho SỔ LIÊN HỆ (chỗ đọc thứ hai); chỉ tải khi sổ có `lien_he`.
  const tuDien = useTuDienMat(hasUser && soTay.data?.lien_he !== undefined);
  // Mỗi khối một hệ số kéo-ra riêng — cuộn tới đâu, khối đó thức dậy tới đó.
  const [radarRef, kRadar] = useKeoRa();
  const [soRef, kSo] = useKeoRa();
  const [tokenRef, kToken] = useKeoRa();

  return (
    <ScreenFrame title="Thẻ tính cách" live goc={<NutCaiDatPfm />} gon>
      {/*
        ⚠⚠ DẢI TAB PFM ĐÃ GỠ KHỎI ĐÂY (21/09) — màn này không còn ở trong khu PFM.

        Lịch sử, vì nó là bài học đắt: dải tab được THÊM vào đây khi màn này sống ở
        `/tai-chinh/the`, bởi thẻ PERSONAL FINANCE trên Hub trỏ thẳng vào nó, còn
        SỔ · HŨ · GƯƠNG sống ở route con và tự vẽ dải tab của mình — thiếu dải tab thì
        từ Hub bấm vào là ngõ cụt: bốn màn đã ship, đã lên prod, mà không ai chạm tới.

        Nay màn này ở `/ho-so/the` (thẻ ĐO TỪ TRẬN về ở với hồ sơ — chỉ thị founder
        21/09), còn `/tai-chinh/the` là CHÂN DUNG PFM và màn đó tự vẽ dải tab. Để dải
        tab PFM ở lại đây là dựng lại đúng chỗ trộn vừa dọn: một thanh điều hướng của
        PFM nằm trên trang hồ sơ, với ô THẺ sáng lên trong khi người dùng đang xem một
        tấm thẻ KHÁC.
        ⚠ Không thành ngõ cụt: link "‹ về Hồ sơ" ở chân màn + thanh điều hướng dưới cùng.
      */}

      {tc.isPending && <p className={s.chuThich}>đang đọc sổ của bạn…</p>}

      {tc.data && (() => {
        const hs = tc.data;
        const the = theCua(hs.tinh_cach, giong);
        const daCoThe = hs.goi !== null && hs.goi !== undefined;
        const bac = BAC_DOC_NHAN[hs.bac_doc ?? 'chua'][giong];
        return (
          <>
            {/*
              ══════════════════════════════════════════════════════════════════
              KHUNG HÌNH ĐẦU = THẺ + RADAR, KHÔNG GÌ KHÁC (chỉ thị founder 07/09)
              ══════════════════════════════════════════════════════════════════
              *"những thứ có giá trị nhất như radar 6 trục hay phần thẻ tính cách
              sẽ được gói gọn trong 1 khung hình, những phần còn lại thì dùng
              Progressive Disclosure và phải lướt xuống dưới"*.

              Đo trước khi sắp (07/09, khung 812px): radar bắt đầu ở **929px** —
              tức thứ đáng xem nhất nằm trọn ở màn THỨ HAI, sau ba khối phụ. Ngân
              sách thật: 812 − 68 (header) − 60 (nav dưới) = 684; trừ 112 của
              breadcrumb + tiêu đề còn **572** cho thẻ (~210 sau khi đẩy dòng
              Oracle xuống) + radar (280) = 490. Vừa, còn dư ~80.

              ⚠ SỬA BỐ CỤC Ở ĐÂY THÌ ĐO LẠI, đừng ước lượng: mọi con số trên là
              đo trên máy thật, không phải suy từ CSS.
            */}
            <div className={s.the} data-testid="the-tinh-cach" data-the={hs.tinh_cach}>
              <div className={s.theMat}>
                <span className={s.theEmoji} aria-hidden>{the.emoji}</span>
                <div className={s.theChu}>
                  <span className={s.theTen}>{the.ten}</span>
                  <span className={s.theDocVi}>{the.doc_vi}</span>
                </div>
              </div>
              {/*
                13/09 — DÒNG CHỈ SỐ IN TRÊN LÁ BÀI: ba dấu kỹ năng (giữ sổ · lọc tin · chia giỏ).
                Trước đó chúng ở tab NĂNG LỰC riêng — founder: *"chia ra nhiều quá thì thừa thãi và
                rối"*. Đang tải/lỗi ⇒ im, thẻ vẫn là thẻ. ⚠ Dòng này ăn vào ngân sách khung hình
                đầu ở trên — đổi nó thì đo lại.
              */}
              {/*
                D404 — tester chưa nộp PHIẾU 2: server giữ thẻ ở CẢ đường này (không riêng màn kết) và trả
                `the_dang_giu`. Nói đúng câu D370 thay vì để trống — trống thì người ta tưởng thẻ hỏng.
              */}
              {nangLuc.data?.the_dang_giu ? (
                <p className={s.theKyNang} data-testid="the-dang-giu">{CHU_CHE_DO_TESTER.theDangGiu}</p>
              ) : nangLuc.data ? (
                <div className={s.theKyNang} data-testid="the-ky-nang">
                  <HangKyNangNguoi nl={nangLuc.data} />
                </div>
              ) : null}
            </div>

            {daCoThe && hs.n_vong > 0 && (
              <div className={`${s.khoi} ${s.khoiRadar}`} ref={radarRef}>
                <div className={s.khoiNhan}>RADAR SÁU TRỤC</div>
                <Radar truc={trucRadar(hs.chi_so)} k={kRadar} />
              </div>
            )}

            {/*
              ── DƯỚI NẾP GẤP ──────────────────────────────────────────────────
              `<details>` chứ không phải state React: cùng idiom với `BangDienTu`
              và `HuongDan`, mở/đóng được bằng bàn phím sẵn, và nội dung vẫn nằm
              trong DOM nên Ctrl+F của trình duyệt còn tìm ra. Ba nếp, không phải
              một — gộp hết vào một nếp thì nó chỉ là "ẩn bớt", không phải phân
              tầng theo thứ người đọc muốn biết tiếp.
            */}
            <details className={s.gap}>
              <summary className={s.gapNhan}>ORACLE NÓI GÌ VỀ THẺ NÀY</summary>
              <p className={s.goiY}>{the.goi_y}</p>
              <p className={s.chuThich}>
                <Link className={s.lienKet} to={ROUTE_CAI_DAT}>⚙ đổi giọng của thẻ</Link>
              </p>
            </details>

            {/* ── VÌ SAO RA THẺ NÀY — hai trục + bậc đọc (tách riêng) ──── */}
            {daCoThe && hs.khau_vi && hs.net && (
              <details className={s.gap} data-testid="vi-sao-the">
                <summary className={s.gapNhan}>VÌ SAO RA THẺ NÀY</summary>
                <div className={s.bang}>
                  <div className={s.dong}>
                    <span className={s.dongTen}>TIỀN ĐI ĐÂU</span>
                    <span className={s.dongGt}>
                      {KHAU_VI_NHAN[hs.khau_vi][giong].ten}
                      <span className={s.dongPhu}> — {KHAU_VI_NHAN[hs.khau_vi][giong].giai}</span>
                    </span>
                  </div>
                  <div className={s.dong}>
                    <span className={s.dongTen}>AI CẦM LÁI</span>
                    <span className={s.dongGt}>
                      {NET_NHAN[hs.net][giong].ten}
                      <span className={s.dongPhu}> — {NET_NHAN[hs.net][giong].giai}</span>
                    </span>
                  </div>
                  <div className={s.dong}>
                    <span className={s.dongTen}>BẬC ĐỌC (không đổi loại thẻ)</span>
                    <span className={s.dongGt}>
                      {bac.emoji} {bac.ten}
                      <span className={s.dongPhu}> — {bac.giai}</span>
                    </span>
                  </div>
                </div>
                {(hs.lich_su?.length ?? 0) > 1 && (
                  <p className={s.chuThich}>
                    Đường đi: {hs.lich_su.map((l) =>
                      `gói ${l.goi_so} ${theCua(l.tinh_cach, giong).emoji}`).join(' → ')}
                  </p>
                )}
                {/*
                  Câu "trục nào MỜ là chưa đủ dữ liệu" theo XUỐNG ĐÂY cùng lượt dời
                  radar lên đầu: nó GIẢI THÍCH radar, mà chỗ giải thích thuộc về tầng
                  đọc kỹ. Để nguyên dưới radar thì nó ăn ~60px của khung hình đầu và
                  đẩy chính cái radar nó nói về xuống dưới nếp gấp.
                */}
                <p className={s.chuThich}>
                  Trục nào MỜ ở radar là chưa đủ dữ liệu (đứng tạm giữa thang) — chơi
                  thêm là nó tự nét. Tấm thẻ đổi khi lối chơi của bạn đổi.
                </p>
              </details>
            )}

            <details className={s.gap}>
              <summary className={s.gapNhan}>TIẾN ĐỘ GÓI · MỘT CÂU NGOÀI ĐỜI</summary>
              {hs.tien_do && <TienDoGoi td={hs.tien_do} giong={giong} daCoThe={daCoThe} />}
              <TuKhai giong={giong} khauVi={hs.khau_vi ?? null}
                daChoi={(hs.tien_do?.tran ?? 0) > 0 || daCoThe} />
            </details>
          </>
        );
      })()}

      {/*
        ── SỔ TAY KHÁI NIỆM (16/08, tầng 3) ────────────────────────────────
        Cây cầu duy nhất được bắc sang "ngoài đời": GỌI TÊN khái niệm bạn đã
        chạm — mô tả, không kê đơn (A10). Đứng trước DÒNG TOKEN vì nó là thứ
        đáng khoe hơn sổ cái. Chưa xong trận nào ⇒ khối IM (xem component).
      */}
      <SoTayKhaiNiem so={soTay.data} tuDien={tuDien.data} />

      {/* ── DÒNG TOKEN — sổ cái của chính mình, gộp theo lý do ──────────── */}
      {dt.data && dt.data.dong.length > 0 && (() => {
        const max = Math.max(1, ...dt.data.dong.map((d) => Math.max(d.vao, -d.ra)));
        // Cùng hệ số cho THANH lẫn SỐ: thanh mọc tới đâu, con số đuổi tới đó.
        const lam = (x: number) => Math.round(x * kToken);
        return (
          <div className={s.khoi} ref={tokenRef}>
            <NhanGiai nhan="DÒNG TOKEN CỦA BẠN" giai={CHU_GIAI.dongToken} />
            <div className={s.bang}>
              {dt.data.dong.map((d) => {
                const nhan = NHAN_DONG_TOKEN[d.reason]
                  ?? { emoji: '·', ten: d.reason };
                return (
                  <div key={d.reason} className={s.dongToken}>
                    <span className={s.dongTen}>
                      {nhan.emoji} {nhan.ten}
                      <span className={s.dongPhu}> ×{d.so_but_toan}</span>
                    </span>
                    <span className={s.thanhCum}>
                      {d.vao > 0 && (
                        <span className={s.thanhVao}
                          style={{ width: `${(lam(d.vao) / max) * 100}%` }}
                          title={`+${formatT(d.vao)}`} />
                      )}
                      {d.ra < 0 && (
                        <span className={s.thanhRa}
                          style={{ width: `${(-lam(d.ra) / max) * 100}%` }}
                          title={formatT(d.ra)} />
                      )}
                    </span>
                    <span className={s.dongGt}>
                      {d.vao > 0 ? `+${formatT(lam(d.vao))}` : ''}
                      {d.vao > 0 && d.ra < 0 ? ' · ' : ''}
                      {d.ra < 0 ? formatT(lam(d.ra)) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* SỐ GỐC đứng SAU mọi thứ đáng khoe — founder 11/08. Xem `SoGoc`. */}
      {tc.data && tc.data.goi !== null && tc.data.n_vong > 0 && (
        <SoGoc hs={tc.data} k={kSo} gan={soRef} />
      )}

      <p className={s.ranGioi}>
        Trang này là tấm gương về CÁCH BẠN TIÊU TIỀN, đo qua cách bạn chơi — mô tả,
        không phải lời khuyên cho tiền thật.
      </p>
      <p className={s.chuThich}>
        <Link className={s.lienKet} to={ROUTE_PROFILE}>‹ về Hồ sơ</Link>
      </p>
    </ScreenFrame>
  );
}
