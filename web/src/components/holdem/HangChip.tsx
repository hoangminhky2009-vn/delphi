/**
 * HÀNG CHIP — dải dán ĐÁY shop trận nav: bốn chip cỡ vốn · ba mặt (MUA · RÚT ·
 * KHỐNG) · lá đã xếp · KHỚP NGAY · CHỐT VÒNG · LẶP. Thay cho panel "MUA/BÁN theo
 * mốc" bung ra sau khi chạm mã (v10 → 16/08, thiết kế 07, founder: *"chốt cái
 * chợ này, làm y nguyên"*).
 *
 * ─── VÌ SAO CHIP NẰM DƯỚI ĐÁY VÀ LUÔN THẤY ─────────────────────────────────
 * Panel cũ: chạm mã → panel bung → chạm mốc → ba nhịp, và nhịp giữa là một cú
 * "đọc lại màn". Casino mobile làm ngược: chip đứng SẴN trong tầm ngón cái, cầm
 * chip rồi chạm ô cược (hoặc ngược lại) — hai chạm, một tay, không kéo thả
 * (founder: *"vòng nào cũng kéo kéo thả thả nếu chơi bằng một tay thì phiền"*).
 * Component này CHỈ vẽ và báo chạm; ai đang cầm gì, lệnh thành hình ra sao là
 * việc của cha (`ShopManHinh`) — nó giữ ngữ pháp "cầm rồi chạm" ở một chỗ.
 *
 * ─── BỐN CHIP BẰNG NHAU LÀ LUẬT DATA (A1 · D85 §1.2), KHÔNG PHẢI GU ────────
 * Không chip nào sáng sẵn, không chip nào to hơn, không mặc định. Cỡ vị thế là
 * trục khẩu vị rủi ro đang đo; UI nghiêng về một mốc là bẻ trục đó bằng ma sát.
 * ⚠ ALL-IN: founder 16/08 tối — *"đặc biệt hơn KHI BẤM VÀO chứ không phải phát
 * sáng mặc định"*. Lúc yên nó y hệt ba chip kia (chỉ chữ đậm); lúc bấm mới thành
 * nước đi khác hạng (`.allDang` + rung nặng + dấu ALL-IN + loé — cha lo phần
 * toàn màn, đây chỉ là cú của chính cái nút).
 * Chia Lệnh (bước 500bp): hàng mọc thành 20 chip 5% — vẫn cách đều, cuộn ngang.
 *
 * ─── CHIP KHÔNG DÍNH TAY ─────────────────────────────────────────────────────
 * Sau mỗi lệnh cha thả cả chip lẫn lá. Casino để chip dính để rải nhanh; với ta
 * đó là làm "25% × 4 mã" rẻ hơn "100% × 1 mã" ⇒ ma sát lệch về đa dạng hoá.
 */
import { NAV_V10 } from '@config/holdem';
import { tienTuMoc } from '@server/holdem/nav';
import { NHIP_RUNG, rung } from '@/lib/rung';
import s from './HangChip.module.css';

export type ChieuLenh = 'mua' | 'ban' | 'khong' | 'dong_khong';
export type MatChip = 'mua' | 'ban' | 'khong';
export interface LenhMoc { ma: string; chieu: ChieuLenh; moc_bp: number }

/** Danh sách mốc từ bước (server cấp) — thô 4 nấc, mịn 20. */
export function cacMocTuBuoc(buocMocBp: number): number[] {
  const ds: number[] = [];
  const buoc = buocMocBp > 0 ? buocMocBp : 2500;
  for (let m = buoc; m < 10000; m += buoc) ds.push(m);
  ds.push(10000);
  return ds;
}

/**
 * v55 (D409) — bộ mốc của một mặt. Mặt MUA có thể mang `mocChoPhep` (server suy từ trait — C4): mốc THÊM = phần vượt bộ
 * thô (LỆNH MỊN), mốc CẤM = phần bộ thô thiếu (hôm nay không lá nào cấm — CẤM TẤT TAY gỡ ở D425; server vẫn là nơi
 * quyết); áp lên bộ theo bước để lá Chia Lệnh vẫn giữ 20 nấc.
 * Mặt KHỐNG chỉ nấc ¼ (luật cũ); mặt RÚT không đọc `mocChoPhep`.
 */
export function mocsCuaMat(mat: MatChip, buocMocBp: number, mocChoPhep?: readonly number[]): number[] {
  const goc = cacMocTuBuoc(buocMocBp);
  if (mat === 'khong') return goc.filter((m) => m % 2500 === 0);
  if (mat !== 'mua' || mocChoPhep === undefined) return goc;
  const tho = cacMocTuBuoc(NAV_V10.BUOC_MOC_THO_BP);
  const them = mocChoPhep.filter((m) => !tho.includes(m));
  const cam = tho.filter((m) => !mocChoPhep.includes(m));
  return [...new Set([...goc, ...them])].filter((m) => !cam.includes(m)).sort((a, b) => a - b);
}

export const nhanChip = (mat: MatChip, moc: number): string => {
  if (moc === 10000) return mat === 'ban' ? 'HẾT' : mat === 'khong' ? '100%' : 'ALL-IN';
  return `${moc / 100}%`;
};

/** Nhãn tag "lá đã xếp": `MUA BTC 25%` · `RÚT VÀNG HẾT` · `KHỐNG USD 100%`. */
export const nhanLenh = (l: LenhMoc, ten: string): string => {
  const chieu = l.chieu === 'mua' ? 'MUA' : l.chieu === 'ban' ? 'RÚT'
    : l.chieu === 'khong' ? 'KHỐNG' : 'ĐÓNG KHỐNG';
  const moc = l.moc_bp === 10000
    ? (l.chieu === 'mua' ? 'ALL-IN' : l.chieu === 'khong' ? '100%' : 'HẾT')
    : `${l.moc_bp / 100}%`;
  return `${chieu} ${ten.toUpperCase()} ${moc}`;
};

export function HangChip({
  mat, onDoiMat, coBanKhong, coCocRut,
  buocMocBp, mocChoPhep, coSo, chipCam, onChamChip, chipVoHieu, allDangNhip,
  onNganHang, nganHangMo,
  lenh, tenMa, onXoa, vohieu,
  khopLoi,
  onChotVong, lapDuoc, onLap, onBanSach, phi, onXemSau, phieuTrenThe,
}: {
  /**
   * D540 (founder 06/10: *"Phiếu lệnh mọc trên thẻ mã"*) — mặt + chip dời lên PHIẾU LỆNH mọc ngay trên lưới tài sản (`PhieuLenh`); dải đáy chỉ
   * còn lệnh đã xếp · BÁN SẠCH · hàng CHỐT. Vắng = dải đáy cũ đủ mặt + chip.
   */
  phieuTrenThe?: boolean;
  mat: MatChip;
  onDoiMat: (m: MatChip) => void;
  /** Mặt KHỐNG chỉ hiện khi cầm lá Bán Khống (server cấp cờ). */
  coBanKhong: boolean;
  /** Mặt RÚT chỉ có nghĩa khi đang có cọc ở đâu đó. */
  coCocRut: boolean;
  buocMocBp: number;
  /**
   * v55 (D409) — bộ mốc MUA của ghế này do server suy (`moc_cho_phep`): trait LỆNH MỊN thêm mốc nhỏ. Vắng = bộ mốc từ
   * bước. Chỉ mặt MUA đọc — xem `mocsCuaMat`.
   */
  mocChoPhep?: readonly number[] | undefined;
  /**
   * ⭐⭐ D375 — MẪU SỐ CỦA HÀNG CHIP, in ngay trên chip.
   *
   * Founder 21/09: *"sau khi chọn đòn bẩy và all in vào 1 mã thì round sau không rút được
   * hết"*. Đo lại bằng chính hàm server (`giaiLenhMoc`): ghế có tiền mặt 2.234 + Crypto
   * 53.888 (NAV 56.122) bấm **ALL-IN** mua Trái phiếu Mỹ ⇒ vào đúng **2.234**, tức 4% số
   * tiền họ đang có. Cơ chế KHÔNG hỏng — chip tính trên TIỀN MẶT, luôn luôn thế. Cái hỏng
   * là chữ: "ALL-IN" đọc ra là "tất tay", và người vừa all-in vòng trước thì tiền mặt của
   * họ gần bằng 0, nên nút to nhất màn đặt một lệnh gần như không làm gì — trong khi lá Đòn
   * Bẩy gắn vào mã ấy thì nhân đôi một vị thế 2.228.
   *
   * ⚠ KHÔNG đổi luật chip (vẫn % tiền mặt): đổi sang % NAV là bắt người chơi bán ngầm, mà
   * bán là một quyết định có giá (phí hai bậc D346) — không được làm hộ trong im lặng.
   * Thứ đổi là hàng chip THÔI IM: nó khai luôn mẫu số, như D342 đã làm cho mặt KHỐNG
   * (*"chip KHỐNG không còn tính trên ví, nên thiếu con số này thì 100% là một nấc không ai
   * đọc ra được"*). Cùng lớp lỗi, cùng cách chữa — lần này cho cả ba mặt.
   */
  /*
   * ⭐ D432 — MẪU SỐ IN LÊN CHÍNH CHIP, bỏ dòng chữ "CHIP TÍNH TRÊN …" đứng trên hàng chip (founder 27/09: *"Quá nhiều
   * thứ trên 1 màn hình"*). Dòng ấy là bản thứ tư của cùng con số tiền mặt trên màn (VÍ · DANH MỤC SAU LỆNH · lăng kính ·
   * dòng mẫu số). Nay mỗi chip in số tiền NÓ sẽ đặt: ALL-IN của ca founder in thẳng 2.234 — đọc là "tất tay phần tiền
   * mặt" mà không cần một câu nào, và VÍ · NAV trên đầu màn nói phần còn lại nằm ở đâu.
   * Cha đưa CƠ SỞ của mặt đang bật: MUA = tiền mặt sau hàng đợi · RÚT = vị thế của mã đang cầm · KHỐNG = hạn mức còn.
   * Số tính bằng CHÍNH hàm server giải chip (`tienTuMoc`, cùng nếp `NganHang`) — không một phép nhân tiền thứ hai (C4).
   * `null` = chưa biết cơ sở (mặt RÚT chưa chạm mã nào) ⇒ chip chỉ in phần trăm, KHÔNG bịa số.
   */
  coSo?: number | null | undefined;
  /**
   * D432 — PHÍ của chuỗi đang xếp (bản nháp server) đứng đầu hàng lệnh, kèm `!` mở tờ SAU LỆNH (danh mục trước → sau ·
   * lăng kính · luật phí). Thay khối "DANH MỤC SAU LỆNH" thường trực: người mới vẫn thấy GIÁ TRƯỚC KHI TRẢ (§7.4), phần
   * giải thích lùi xuống tầng đọc-khi-muốn.
   */
  phi?: number | undefined;
  onXemSau?: (() => void) | undefined;
  /** Mốc đang cầm trên tay (null = tay không). */
  chipCam: number | null;
  onChamChip: (mocBp: number) => void;
  /** Cả hàng chip vô hiệu (hết tiền ở mặt MUA/KHỐNG · lá không có cọc ở mặt RÚT). */
  chipVoHieu: boolean;
  /** Đổi giá trị = ALL-IN vừa được bấm ⇒ chạy lại `.allDang`. */
  allDangNhip: number;
  lenh: LenhMoc[];
  tenMa: (ma: string) => string;
  onXoa: (i: number) => void;
  vohieu?: boolean;
  khopLoi?: string | null | undefined;
  onChotVong?: (() => void) | undefined;
  lapDuoc: boolean;
  /**
   * D321b (13/09) — nút 🏦 đứng trong HÀNG HÀNH ĐỘNG cạnh ↺ và CHỐT (demo: icon
   * góc). undefined = trận không có ngân hàng ⇒ không vẽ.
   */
  onNganHang?: (() => void) | undefined;
  nganHangMo?: boolean;
  onLap?: (() => void) | undefined;
  /**
   * v54 (D403) — BÁN SẠCH: xếp lệnh đưa cả danh mục về tiền mặt (cha lo lệnh — `ShopManHinh.banSach`). undefined =
   * trận còn nút BỎ, hoặc không cầm gì ⇒ không vẽ. Nút HÀNH ĐỘNG chứ không phải MẶT: không `aria-pressed`, dạt phải.
   */
  onBanSach?: (() => void) | undefined;
}) {
  const mocs = mocsCuaMat(mat, buocMocBp, mocChoPhep);
  const min = mocs.length > 6;
  /*
   * ⭐⭐ D375 — CHIA LỆNH: 20 NẤC MÀ KHÔNG AI BIẾT LÀ CÓ 20.
   *
   * Cầm lá Chia Lệnh thì bước mốc hạ 2500 → 500bp, tức hàng chip mọc từ 4 lên 20 nấc và
   * chuyển sang cuộn ngang (`.chipsMin`). Đo bằng chính CSS: mỗi nút `flex: 0 0 56px` + gap
   * 6px ⇒ 20 nấc = 1.234px, trong khi cột app rộng 390px (điện thoại) tới ~630px (màn ngang).
   * Tức **nhìn thấy 6–10 nấc trên 20**, và `.chipsMin` CỐ Ý ẩn thanh cuộn
   * (`scrollbar-width: none`) nên không một pixel nào nói rằng còn nấc nữa.
   *
   * ⇒ Người cầm lá đọc ra là "Chia Lệnh cho tôi mấy nấc nhỏ, và mất ALL-IN" — trong khi nấc
   * 100% vẫn ở đó, chỉ nằm ngoài mép. Cùng lớp lỗi với mẫu số chip ngay trên: cái điều khiển
   * có một phần nằm ngoài tầm nhìn, và màn im lặng về nó.
   *
   * Vá bằng CHỮ chứ không bằng bố cục mới: dải mẫu số vừa dựng nói luôn số nấc. Không đổi
   * cỡ nút (nhét 20 nút vào 630px là 31px/nút — bấm trượt), không đổi bốn tầng không cuộn
   * của D321.
   */
  const nhacKeo = min ? `${mocs.length} NẤC · KÉO NGANG ĐỂ THẤY HẾT` : null;

  return (
    <div className={s.day} data-hang-chip>
      {/* D321b — dòng mời DỜI XUỐNG MÉP NỈ (ShopManHinh), rack chỉ còn vật để bấm
          như demo: mặt (khi có ≥2 lựa chọn) · chip · hàng hành động. */}
      {phieuTrenThe ? (onBanSach && (
        <div className={s.matHang}>
          <button type="button" className={s.banSach} data-ban-sach disabled={!!vohieu} onClick={() => onBanSach()}
            aria-label="BÁN SẠCH — xếp lệnh rút hết mọi mã về tiền mặt">BÁN SẠCH</button>
        </div>
      )) : (coCocRut || coBanKhong || onBanSach) && (
      // D336 — neo trợ lý màn tập: bước `rut` (vòng tăng lãi) chỉ vào CHÍNH hàng mặt MUA/RÚT.
      // Rọi hàng chip bên dưới thì thẻ thoại đậu đè đúng lên hàng mặt mà câu đang nhắc tới.
      <div className={s.matHang} data-tap="shop-mat">
        {/*
         * ⭐ D321 (13/09) — MẶT CHỈ HIỆN KHI CÓ TỪ HAI LỰA CHỌN. Founder gọi shop
         * là "buồng lái máy bay"; một nút RÚT xám 0,4 đứng thường trực từ vòng 1
         * (chưa giữ mã nào) là đúng loại nút ấy: không bấm được, chỉ có mặt để
         * nói "sẽ có lúc bấm được". Poker không có toggle mua/rút — chip đặt vào
         * cọc của mình là rút. Nay: chưa giữ gì thì KHÔNG có nút RÚT, và khi chỉ
         * còn mỗi MUA thì thôi luôn cả cụm (một lựa chọn không phải lựa chọn),
         * chỉ còn dòng mời. Có gì để rút/khống thì cụm hiện lại y hệt cũ.
         * ⚠ Logic `mat` không đổi — chỉ đổi ĐIỀU KIỆN VẼ NÚT.
         */}
        {(coCocRut || coBanKhong) && (
          <button
            type="button" className={`${s.mat} ${mat === 'mua' ? s.matOn : ''}`}
            aria-pressed={mat === 'mua'} onClick={() => onDoiMat('mua')}
          >
            MUA
          </button>
        )}
        {coCocRut && (
          <button
            type="button" className={`${s.mat} ${s.matRut} ${mat === 'ban' ? s.matOn : ''}`}
            aria-pressed={mat === 'ban'}
            onClick={() => onDoiMat('ban')}
          >
            RÚT
          </button>
        )}
        {coBanKhong && (
          <button
            type="button" className={`${s.mat} ${s.matKhong} ${mat === 'khong' ? s.matOn : ''}`}
            aria-pressed={mat === 'khong'} onClick={() => onDoiMat('khong')}
          >
            KHỐNG
          </button>
        )}
        {onBanSach && (
          <button
            type="button" className={s.banSach} data-ban-sach
            disabled={!!vohieu}
            onClick={() => onBanSach()}
            aria-label="BÁN SẠCH — xếp lệnh rút hết mọi mã về tiền mặt"
          >
            BÁN SẠCH
          </button>
        )}
      </div>
      )}

      {/* D375 → D432 — mẫu số nay in trên từng chip (`coSo`); dòng này chỉ còn lời nhắc kéo ngang của Chia Lệnh. */}
      {!phieuTrenThe && nhacKeo !== null && (
        <div className={s.nenChip}><b data-nhac-keo>{nhacKeo}</b></div>
      )}
      {/* Coach màn tập rọi vào ĐÂY (id `shop-lenh` giữ nguyên — phễu BUOC_HUONG_DAN). D540 — có phiếu trên thẻ thì chip ở phiếu. */}
      {!phieuTrenThe && <div className={`${s.chips} ${min ? s.chipsMin : ''}`} data-tap="shop-lenh" role="group" aria-label="Chip cỡ vốn">
        {mocs.map((m) => {
          const all = m === 10000;
          const cam = chipCam === m;
          return (
            <button
              key={`${mat}-${m}-${all ? allDangNhip : 0}`}
              type="button"
              className={[
                s.nutMoc,
                all ? s.nutMocAll : '',
                cam ? s.cam : '',
                all && allDangNhip > 0 ? s.allDang : '',
              ].filter(Boolean).join(' ')}
              data-moc={m}
              aria-pressed={cam}
              disabled={!!vohieu || chipVoHieu}
              onClick={() => { rung(all ? NHIP_RUNG.nang : NHIP_RUNG.cham); onChamChip(m); }}
            >
              <span className={s.nhanMoc} data-nhan-moc>{nhanChip(mat, m)}</span>
              {/* Số tiền là phần NHÌN (mẫu số ngay trên vật); tên nút giữ đúng nhãn mốc — trình đọc màn hình và các bài
                  `getByRole(name: '25%')` không đổi. VÍ ở đầu màn vẫn đọc được số ấy. */}
              {typeof coSo === 'number' && (
                <span className={s.soMoc} data-so-moc aria-hidden="true">{tienTuMoc(m, coSo).toLocaleString('vi-VN')}</span>
              )}
            </button>
          );
        })}
      </div>}

      {lenh.length > 0 && (
        <div className={s.lenhDaXep} data-tap="shop-daxep">
          {/* D432 — PHÍ đứng ĐẦU hàng lệnh: thấy giá trước khi trả; `!` mở tờ SAU LỆNH. Neo coach `shop-xemtruoc`. */}
          {phi !== undefined && (
            <button
              type="button" className={s.nutPhi} data-tap="shop-xemtruoc"
              onClick={() => { rung(NHIP_RUNG.cham); onXemSau?.(); }}
              aria-label={`Phí mua bán ${phi.toLocaleString('vi-VN')} — xem danh mục sau lệnh`}
            >
              PHÍ <b>{phi.toLocaleString('vi-VN')}</b><span className={s.phiHoi} aria-hidden>!</span>
            </button>
          )}
          {lenh.map((l, i) => (
            <button
              key={`${l.ma}-${l.chieu}-${l.moc_bp}-${i}`} type="button"
              className={[
                s.lenhTag,
                l.chieu === 'ban' ? s.tagRut : '',
                l.chieu === 'khong' || l.chieu === 'dong_khong' ? s.tagKhong : '',
                l.chieu === 'mua' && l.moc_bp === 10000 ? s.tagAll : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onXoa(i)}
              title="Bấm để rút lá này khỏi bàn"
            >
              {nhanLenh(l, tenMa(l.ma))}{' ✕'}
            </button>
          ))}
          {typeof khopLoi === 'string' && khopLoi !== '' && (
            <div className={s.khopLoi} role="alert">{khopLoi}</div>
          )}
        </div>
      )}

      {/* D321b — HÀNG HÀNH ĐỘNG như demo: icon nhỏ (↺ lặp · 🏦 ngân hàng) rồi CHỐT to.
          ⚠ Chữ LẶP giữ trong aria-label — test và người dùng đọc màn hình vẫn thấy nó. */}
      {(onChotVong || (lapDuoc && onLap) || onNganHang) && (
        <div className={s.chotHang}>
          {lapDuoc && onLap && (
            <button
              type="button" className={s.nutLap}
              aria-label="LẶP — xếp lại y hệt vòng trước"
              title="Xếp lại y hệt các lá của vòng trước"
              onClick={() => { rung(NHIP_RUNG.cham); onLap(); }}
            >
              ↺
            </button>
          )}
          {onNganHang && (
            <button
              type="button" className={`${s.nutLap} ${s.nutBank}`}
              aria-label="NGÂN HÀNG — gửi tiết kiệm"
              aria-expanded={nganHangMo === true}
              data-testid="nut-ngan-hang"
              onClick={() => { rung(NHIP_RUNG.cham); onNganHang(); }}
            >
              🏦
            </button>
          )}
          {onChotVong && (
            <button type="button" className={s.nutChot} data-tap="shop-chot" onClick={onChotVong}>
              CHỐT VÒNG
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * D540 — PHIẾU LỆNH (founder 06/10: *"chạm thẻ mã thì hàng chip và MUA/BÁN mọc ngay trên thẻ, Delphi luôn neo phía trên khung"*). Trước đây
 * chip nằm ở dải đáy: chạm mã ở lưới rồi phải kéo mắt xuống đáy, và ở bàn tập khung Delphi đậu đáy che đúng hàng chip (vùng rọi chỉ bao lưới ⇒
 * chip mọc NGOÀI vùng sáng — dựng lại ngày 06/10). Phiếu mọc ngay trong lưới, cạnh thẻ đang chọn: cùng ngữ pháp "chạm mã rồi chạm chip",
 * cùng mặt MUA / RÚT / KHỐNG (chỉ hiện khi có từ hai lựa chọn — D321), cùng bộ mốc và số tiền in trên chip (D432).
 */
export function PhieuLenh({
  tenMa, mat, onDoiMat, coBanKhong, coCocRut, buocMocBp, mocChoPhep, coSo, onChamChip, chipVoHieu, allDangNhip, vohieu, onDong, mui,
}: {
  /** Mũi phiếu chỉ lên (thẻ ở hàng trên) hay xuống (thẻ ở hàng dưới). */
  mui: 'tren' | 'duoi';
  tenMa: string;
  mat: MatChip;
  onDoiMat: (m: MatChip) => void;
  coBanKhong: boolean;
  coCocRut: boolean;
  buocMocBp: number;
  mocChoPhep?: readonly number[] | undefined;
  coSo?: number | null | undefined;
  onChamChip: (mocBp: number) => void;
  chipVoHieu: boolean;
  allDangNhip: number;
  vohieu?: boolean;
  onDong: () => void;
}) {
  const mocs = mocsCuaMat(mat, buocMocBp, mocChoPhep);
  const min = mocs.length > 6;
  return (
    <div className={s.phieu} data-phieu-lenh data-mui={mui} role="group" aria-label={`Phiếu lệnh ${tenMa}`}>
      <div className={s.phieuDau}>
        <span className={s.phieuTen}>{tenMa.toUpperCase()}</span>
        {(coCocRut || coBanKhong) && (
          <div className={s.phieuMat} data-tap="shop-mat">
            <button type="button" className={`${s.mat} ${mat === 'mua' ? s.matOn : ''}`} aria-pressed={mat === 'mua'} onClick={() => onDoiMat('mua')}>MUA</button>
            {coCocRut && (
              <button type="button" className={`${s.mat} ${s.matRut} ${mat === 'ban' ? s.matOn : ''}`} aria-pressed={mat === 'ban'} onClick={() => onDoiMat('ban')}>RÚT</button>
            )}
            {coBanKhong && (
              <button type="button" className={`${s.mat} ${s.matKhong} ${mat === 'khong' ? s.matOn : ''}`} aria-pressed={mat === 'khong'} onClick={() => onDoiMat('khong')}>KHỐNG</button>
            )}
          </div>
        )}
        <button type="button" className={s.phieuDong} aria-label="Đóng phiếu lệnh" onClick={onDong}>✕</button>
      </div>
      {min && <div className={s.nenChip}><b data-nhac-keo>{`${mocs.length} NẤC · KÉO NGANG ĐỂ THẤY HẾT`}</b></div>}
      <div className={`${s.chips} ${min ? s.chipsMin : ''}`} data-tap="shop-lenh" role="group" aria-label="Chip cỡ vốn">
        {mocs.map((m) => {
          const all = m === 10000;
          return (
            <button
              key={`${mat}-${m}-${all ? allDangNhip : 0}`}
              type="button"
              className={[s.nutMoc, all ? s.nutMocAll : '', all && allDangNhip > 0 ? s.allDang : ''].filter(Boolean).join(' ')}
              data-moc={m}
              disabled={!!vohieu || chipVoHieu}
              onClick={() => { rung(all ? NHIP_RUNG.nang : NHIP_RUNG.cham); onChamChip(m); }}
            >
              <span className={s.nhanMoc} data-nhan-moc>{nhanChip(mat, m)}</span>
              {typeof coSo === 'number' && (
                <span className={s.soMoc} data-so-moc aria-hidden="true">{tienTuMoc(m, coSo).toLocaleString('vi-VN')}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
