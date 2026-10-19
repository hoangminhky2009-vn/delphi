/**
 * DÂY CHUYỀN CHẤM ĐIỂM — diễn từng mắt xích.
 *
 * NHỊP THEO KẾT QUẢ, không cố định — "thắng ỒN, thua NHANH":
 *   lãi : 150 + độ đậm × 140 ms/mắt xích
 *   lỗ  : 85 ms/mắt xích
 * Trận 8 vòng có thể thua 5–6 lần; nghi lễ thua dài = trừng phạt lặp lại =
 * bỏ bàn. Thua vẫn phải RÕ, nhưng không dí mặt người chơi 5 giây.
 */
import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks';
import {
  dinhDangChip, pctBp, type OngKinhDTO,
  type ChienThuatDTO, type KetQuaVongDTO, type MatXichDTO, type NhanDTO, type TaiSanDTO,
} from '@/api/holdem';
import { khoanLaiLo } from '@/lib/khoan_lai_lo';
import { laCuaMatXich } from '@/lib/tra_cong';
import { T_CAT_LO_UPPER, T_QUY_VONG_UPPER, T_VON_UPPER } from '@/lib/vocab';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { matLa } from '@/lib/la_bai';
import { moTaODoi } from '@/lib/o_doi';
import { phanTramNhip } from './SoNhipVong';
import s from './ChainReveal.module.css';

/** "+7,0%" / "-38,1%" / "0,0%" — CÙNG một chữ số thập phân với con số vòng ngoài bàn. */
const chuoiPhanTram = (v: number): string =>
  `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v).toFixed(1).replace('.', ',')}%`;

/* 24/09 (D393) — bản chép thứ hai của tên ô tiếng Anh (UPTREND…) đã gỡ: ô bản đồ nay là LÁ BÀI
   mới và ghi tên lá (TĂNG · QUÁ NÓNG…). Mắt xích "khớp X" phải gọi đúng cái tên người chơi vừa
   thấy trên ô — nên đọc CÙNG nguồn `matLa`, không giữ bảng riêng (D61). */
const tenPha = (id: string): string | undefined => matLa(`gd_${id}`)?.ten;

/** D88 — nhãn ống kính theo con đường. Chữ đã qua lint từ vựng D26. */
const OK_NHAN: Record<OngKinhDTO['loai'], string> = {
  la_ban: 'ĐÚNG HƯỚNG',
  tay_can: 'ĐỘ CHUẨN',
  ve_song: 'CHỌN so với LOẠI',
  bat_nhip: 'Ô VỪA LẬT',
};

/** Số của dòng ống kính — null = vòng đứng ngoài, vẽ — (không số âm, §1.2). */
function okSo(ok: OngKinhDTO): string {
  switch (ok.loai) {
    case 'la_ban':
      return ok.ty_le_dung_bp === null ? '—'
        : `${Math.round(ok.ty_le_dung_bp / 100)}% vốn`;
    case 'tay_can':
      return ok.brier === null ? '—' : ok.brier.toFixed(2);
    case 've_song':
      return ok.chenh_bp === null ? '—' : pctBp(ok.chenh_bp);
    default:
      return ok.doi_pha ? 'ĐỔI PHA' : 'GIỮ PHA';
  }
}

/*
 * D342/D374 — nhãn các dòng cầu nối NAV và thứ tự "PHẦN TIỀN CỦA BẠN" dời sang `lib/khoan_lai_lo.ts` (D400): hộp chữ
 * nổi ở bước LÃI/LỖ đọc CÙNG danh sách — founder 24/09: màu và số của hai nơi "phải trùng khớp".
 */

export function ChainReveal({
  kq, deltaVon, nhip = null, taiSan, chienThuat, giaiDoan, suKien, moChain = true, trait = [],
}: {
  kq: KetQuaVongDTO;
  /** Chênh TIỀN MẶT của vòng — chỉ còn dùng khi thiếu `nhip` (trận cũ không NAV). */
  deltaVon: number;
  /**
   * ⭐ D336 — CHÊNH NAV CỦA VÒNG + mẫu số: ĐÚNG object con số ngoài bàn (`SoNhipVong`) đọc.
   * Có nó thì số to trong tấm và chân tấm nói CÙNG một đại lượng với ngoài bàn.
   * Vắng (trận cũ không NAV) ⇒ hành vi cũ: số to = tổng dây chuyền, chân tấm = tiền mặt.
   */
  nhip?: { delta: number; goc: number } | null;
  taiSan: TaiSanDTO[];
  chienThuat: ChienThuatDTO[];
  giaiDoan: NhanDTO[];
  suKien: NhanDTO[];
  /**
   * Founder 01/08 — thu gọn CHỌN LỌC: `false` = giấu DANH SÁCH "VÌ SAO",
   * nhưng số % neon đếm nhảy + băng TIN GIẢ + chớp sáng + dòng Quỹ vòng VẪN
   * diễn. Con số là hiệu ứng chính ("không thì m làm hiệu ứng cho ai xem?"),
   * danh sách mới là phần chi tiết bấm-mới-mở. Mặc định `true` để nơi gọi cũ
   * (xem lại bàn đấu) giữ nguyên hành vi.
   */
  moChain?: boolean;
  /**
   * v55 (D422) — trait đang mang: sàn `chan_lo_san` và phí bảo hiểm ở v55 là của KỶ LUẬT (lá Chặn Lỗ đã rời shop —
   * cổng `chanLoTrait`), nên nhãn gọi tên KỶ LUẬT thay vì lá. Vắng ⇒ nhãn lá như cũ.
   */
  trait?: readonly string[];
}) {
  const itMotion = useReducedMotion();
  const kyLuat = trait.includes('ky_luat');
  const chain = kq.cua_ban?.chain ?? [];
  const pnl = kq.cua_ban?.pnl_bp ?? 0;
  const catLo = kq.cua_ban?.da_cat_lo;
  const [hien, setHien] = useState(chain.length);

  /**
   * SKIP — doc §6 (design_style_terminal_neon) BẮT BUỘC: "Luôn cho phép skip:
   * chạm màn hình khi đang chạy → nhảy thẳng trạng thái cuối."
   *
   * ⚠ Thiếu nó là nợ tôi tự tạo ra hôm 25/07: tôi nới nhịp diễn rộng ra (ô lật
   * 0,38→0,9s, mắt xích 0,26→0,42s, nhịp kể khi lỗ 85→210ms) để "kịp cảm nhận",
   * nhưng KHÔNG có đường thoát. Chậm + không skip = trừng phạt người chơi lần
   * thứ hai sau khi họ vừa thua, và trận 8 vòng thì thua 5–6 lần là bình thường.
   */
  const boQua = () => setHien(chain.length);

  /*
   * ⚠ D435 (founder 27/09) — VÌ SAO THÔI DIỄN: *"hiệu ứng lãi lỗ thay đổi theo từng lý do rồi shake và khớp lại tổng
   * trong phần vì sao ấy, ko cần thiết … vì sao chỉ để xem tổng kết và lí do thôi"*. Mọi dòng hiện MỘT lượt, số tổng
   * đứng đúng đích ngay. Nhịp "đổi theo từng khoản rồi rung, khớp tổng" dời ra con số vòng ở MÀN CHÍNH (`SoNhipVong`,
   * bước theo hàng hộp `KhoanNoi`). Nút "chạm để xem ngay" vì thế cũng thôi hiện (không còn gì để bỏ qua).
   */
  useEffect(() => { setHien(chain.length); }, [chain.length]);

  /**
   * TỔNG CỘNG DẦN — không spoil.
   *
   * ⚠ Bản trước in thẳng PnL cuối NGAY trên đầu rồi mới lần lượt kể từng mắt
   * xích. Tức là đọc xong con số to nhất rồi mới xem giải thích — mọi hồi hộp
   * chết ngay dòng đầu, và founder gọi đúng tên: "quá ít cảm xúc".
   *
   * Nay tổng bắt đầu từ 0 và nhảy lên theo từng mắt xích đáp xuống. Đây cũng
   * là cách duy nhất khiến mắt xích NHÂN thành cao trào thật: tới nó thì con
   * số đang tích luỹ mới bị nhân đôi trước mắt người chơi.
   */
  const dienRoi = chain.slice(0, hien);
  const tongChay = dienRoi.reduce((x, m) => x + m.delta_bp, 0);
  const xong = hien >= chain.length;
  /*
   * ⚠⚠ D336 (15/09) — SỐ TO LÀ % CẢ VÍ, KHÔNG PHẢI TỔNG CÁC DÒNG.
   *
   * Thời lá bài, "tổng mắt xích = PnL" là bất biến nên cộng dồn là đúng. Từ v10 NAV, mỗi
   * dòng mang mã là % GIÁ CỦA MÃ ĐÓ (áp lên vị thế ấy, `apDinhGia`), còn engine ghi đè
   * `pnl_bp` bằng tăng trưởng NAV (engine.ts, "chuỗi bp còn vai trò GIẢI THÍCH"). Cộng
   * % giá của hai mã khác nhau không ra % của ai: ảnh prod founder gửi 15/09 — ngoài bàn
   * −38%, trong tấm −123,47% (hai mã, mỗi mã ~−60% và ~−71% trên phần tiền của nó).
   * ⇒ Số to đọc ĐÚNG hàm con số ngoài bàn đọc. Nhịp "cộng dần không spoil" giữ nguyên:
   * con số chạy tới đích theo số dòng đã đáp, chỉ là đích nay là % cả ví.
   */
  const pctVi = nhip ? phanTramNhip(nhip.delta, nhip.goc) : null;
  const pctDangChay = pctVi === null ? null
    : pctVi * (chain.length === 0 ? 1 : Math.min(1, hien / chain.length));
  const soTo = catLo ? `ĐÃ ${T_CAT_LO_UPPER}`
    : pctDangChay !== null ? chuoiPhanTram(pctDangChay) : pctBp(tongChay);
  const laiLo = pctVi !== null ? pctVi : tongChay;
  /*
   * PHẦN TIỀN CỦA BẠN — số server tính sẵn (`tien_theo_ma` + cầu nối NAV D342, C4: client chỉ vẽ); cộng lại = đúng cú
   * đổi NAV của vòng. D400: MỘT hàm dựng danh sách cho cả tấm này lẫn hộp chữ nổi ở bước LÃI/LỖ (`KhoanNoi`).
   */
  const khoan = khoanLaiLo(kq, taiSan);

  /*
   * ⚠ ĐÃ GỠ RUNG Ở ĐÂY (founder 27/07). Lễ công bố kết quả vòng RUNG THEO ĐỘ
   * MẠNH của lãi/lỗ, nên nó nổ ngay sau mỗi lần bấm — kể cả những vòng chẳng có
   * gì đáng rung. Founder: "xóa hiệu ứng rung ngay sau khi bấm all-in".
   *
   * Rung nay CHỈ còn một chỗ duy nhất: lúc màn hình hiện chữ ALL-IN, mỗi người
   * all-in một nhịp (xem MomentOverlay + `rungAllIn` ở AlphaDraftMatch). Để rung
   * ở hai nơi thì cái nào cũng mất nghĩa — rung phải hiếm mới đáng sợ.
   *
   * Hằng số độ mạnh (`Math.abs(tongChay)` so 1.200 / 3.000 bp) gỡ luôn cùng lúc:
   * giữ một biến không ai đọc là để lại một cái bẫy trông như còn cơ chế.
   */

  const ts = (id: string) => taiSan.find((x) => x.id === id);
  const ct = (id: string) => chienThuat.find((x) => x.id === id);
  // D422 — lớp che của riêng người mang trait: server thay tên tin bằng `che` (MÙ TIN), tên pha bằng `suong` (SƯƠNG MÙ).
  const nGD = (id: string) => (id === 'suong' ? 'pha trong sương' : giaiDoan.find((x) => x.id === id)?.label ?? id);
  const nSK = (id: string) => (id === 'che' ? 'tin bị che' : suKien.find((x) => x.id === id)?.label ?? id);

  /**
   * NHÃN "VÌ SAO" — phải phủ ĐỦ 12 kind của engine.
   *
   * ⚠ Bản trước có `default:` trả về "… khuếch đại ×2" và chỉ khai 6 kind.
   * Sáu cơ chế T1/T2/T4/T8 rơi hết vào đó → người chơi bị bảo là "Đòn Bẩy" khi
   * thật ra Bán Khống vừa ăn tin xấu, hoặc Lướt Sóng vừa bám nhầm dây chuyền.
   * Nay `default` chỉ còn là lưới an toàn NÓI THẬT là chưa biết, thay vì đoán
   * bừa một cái tên sai — thà thấy "cơ chế lạ" còn hơn tin một lời giải thích sai.
   *
   * ⚠ KHÔNG CÒN EMOJI DẪN ĐẦU (26/07 — luật 4, mục ICON).
   *
   * Mười lăm nhãn dưới đây từng mở đầu bằng một hình vẽ do FONT HỆ ĐIỀU HÀNH
   * dựng: cùng ký tự ra tam giác đơn sắc trên Windows, ra hình màu trên iPhone —
   * tức người chơi thấy một danh sách khác danh sách người dựng đang kiểm, và
   * chiều cao dòng cũng khác nên hàng bị đội lên không đều. Cột này lại là chỗ
   * duy nhất giải thích VÌ SAO mất tiền (yêu cầu cứng D26 §18.5), nên nó phải
   * hiện y hệt nhau trên mọi máy.
   *
   * Bỏ HẲN chứ không thay bằng lưới pixel: chữ ngay bên cạnh đã nói đủ ("Chen
   * chúc — 3 người cùng mua VN30"), phần đọc-lướt do màu vạch trái và dấu ±
   * của con số bên phải lo. Thêm một icon nữa chỉ là nói hai lần.
   * Cùng lý do, tiền tố `icon` do server cấp (config/holdem.ts, cũng là emoji)
   * không còn được ghép vào nhãn — nhãn chữ luôn đứng ngay sau nó.
   */
  const nhan = (m: MatXichDTO): string => {
    switch (m.kind) {
      case 'tai_san': {
        const chong = m.cap > 1 ? ` ×${m.cap} lá` : '';
        return `${ts(m.id)?.label ?? m.id}${chong} khớp ${tenPha(m.giai_doan) ?? nGD(m.giai_doan)}`;
      }
      case 'echo':
        /*
         * "dư âm X" CHỈ đúng khi X đã LẬT. Nếu đây là nhánh hệ quả suy ra từ một
         * lá khác thì phải nói tên lá ĐÃ LẬT — founder bắt đúng lỗi này: bảng ghi
         * "dư âm Thiên nga đen" trong khi lá đó chưa từng xuất hiện trên map.
         */
        /*
         * 28/07 — TIN GIẢ phải GỌI TÊN: founder thấy "dư âm Hạ lãi suất −12%"
         * (sự kiện tốt, dư âm âm) và đọc thành lỗi tính toán. Số đúng — dư âm
         * tin giả ĐẢO chiều theo thiết kế §17.1c — nhưng nhãn im lặng biến phép
         * tính đúng thành một lỗi trong mắt người chơi.
         */
        {
          /*
           * v35 — CỘNG HƯỞNG TRÚ ẨN: hậu tố gọi tên cú nhân, vì con số một
           * mình trông như tính sai so với ma trận (D28: nhãn không nói dối).
           * Ranh §13 addendum giữ nguyên: đây là THẺ + DƯ ÂM, không biến nội bộ.
           */
          const duoiCH = m.cong_huong_tru_an === true ? ' · CỘNG HƯỞNG chiến tranh + cấm vận' : '';
          return m.tu_nhanh
            ? `${ts(m.id)?.label ?? m.id} · hệ quả ${nSK(m.tu_nhanh)} → ${nSK(m.su_kien)}${duoiCH}`
            : m.dao
              ? `${ts(m.id)?.label ?? m.id} · dư âm ĐẢO — ${nSK(m.su_kien)} là TIN GIẢ${duoiCH}`
              : `${ts(m.id)?.label ?? m.id} · dư âm ${nSK(m.su_kien)}${duoiCH}`;
        }
      case 'crowding':
        return `Chen chúc — ${m.so_nguoi_dong} người cùng mua ${ts(m.id)?.label ?? m.id}`;
      case 'xung_dot':
        return `${ct(m.cap[0])?.label ?? ''} xung đột ${ct(m.cap[1])?.label ?? ''}`;
      case 'cong_huong':
        return `Cộng hưởng: ${ct(m.cap[0])?.label ?? ''} + ${ct(m.cap[1])?.label ?? ''}`;
      case 'nhan':
        // Có mã gắn thì PHẢI nêu tên — "×2 trên BTC" khác hẳn "×2" khi người
        // chơi tự cộng các dòng để kiểm (và họ ĐÃ làm thế — 28/07).
        // v49 (D342) — phần SỔ KHỐNG của mã nói rõ "khống", vì cùng mã có thể có hai dòng.
        return m.ma
          ? `${ct(m.id)?.label ?? m.id} — khuếch đại ×2 phần ${m.khong ? 'khống ' : ''}${ts(m.ma)?.label ?? m.ma}`
          : `${ct(m.id)?.label ?? m.id} — khuếch đại ×2 toàn danh mục`;

      /*
       * v49 (D342) — GIÁ CHỢ CỦA MÃ ĐANG KHỐNG. Nói CẢ giá mã lẫn chiều của sổ khống: con số bên
       * phải là phần của người khống (giá rơi 93% ⇒ +93%), mà nếu nhãn không nhắc giá thì một dòng
       * "+93%" đứng cạnh bảng giá "−93%" đọc ra như tính ngược.
       */
      case 'khong_gia':
        return `${ts(m.id)?.label ?? m.id} · khống — giá ${m.gia_bp < 0 ? 'rơi' : 'lên'} ${pctBp(Math.abs(m.gia_bp)).slice(1)}`;

      // D561 — tin đã được thị trường phản ánh từ trước: lúc tin ra, giá đi theo một nhịp rồi quay đầu.
      case 'vao_gia':
        return `${ts(m.id)?.label ?? m.id} — tin đã vào giá: thị trường quay đầu`;

      // ── T1: chiến thuật phản ứng với tin đang nổ ──────────────────────
      case 'ct_su_kien':
        return `${ct(m.id)?.label ?? m.id} ${
          m.delta_bp >= 0 ? 'ăn' : 'ngược'} tin ${nSK(m.su_kien)}`;

      // ── T2: Lướt Sóng bám dây chuyền nhân quả ─────────────────────────
      case 'day_chuyen':
        return m.dung
          ? `Bám ĐÚNG dây chuyền ${nSK(m.tu)} → ${nSK(m.den)}`
          : `Bám NHẦM dây chuyền — đoán ${nSK(m.den)}, thị trường đi lối khác`;

      // ── T4: Khớp Nhanh hoàn lại phần trượt giá ────────────────────────
      case 'hoan_truot':
        return `Khớp Nhanh hoàn trượt giá ${ts(m.id)?.label ?? m.id} (${m.so_nguoi_dong} người chen)`;

      // ── T8: thẻ canh nhịp bắt trúng / trượt ───────────────────────────
      case 'canh_nhip':
        return m.trung
          ? `${ct(m.id)?.label ?? m.id} bắt TRÚNG nhịp`
          : `${ct(m.id)?.label ?? m.id} bắt TRƯỢT nhịp`;

      // ── T8: thưởng đa dạng hoá ────────────────────────────────────────
      case 'da_dang':
        return `Đa Dạng Hóa · ${m.so_ma} mã khác nhau`;

      // ── T8: thẻ phòng thủ ăn hay tốn phí ──────────────────────────────
      case 'phong_thu':
        return m.an
          ? `${ct(m.id)?.label ?? m.id} che được cú này`
          : `${ct(m.id)?.label ?? m.id} · phí giữ bảo hiểm`;

      // ── D1: cặp phòng thủ trả giá trong uptrend ───────────────────────
      case 'triet_bien_tang':
        return `${ct(m.cap[0])?.label ?? ''} + ${ct(m.cap[1])?.label ?? ''} — bỏ mất nửa con sóng`;

      // ── D5: thẻ Đi Ngược — thưởng lệch đám, phạt theo đám ─────────────
      case 'di_nguoc':
        if (m.so_theo > 0 && m.so_lech === 0) {
          return `Đi Ngược · ${m.so_theo} mã đang đi theo số đông`;
        }
        if (m.so_lech > 0 && m.so_theo === 0) {
          return `Đi Ngược · ${m.so_lech} mã ít ai nắm`;
        }
        return `Đi Ngược · ${m.so_lech} mã lệch đám, ${m.so_theo} mã theo đám`;

      // ── D5: rủi ro đối tác — cả bàn cùng núp một thẻ ──────────────────
      case 'doi_tac':
        return `${ct(m.id)?.label ?? m.id} · `
          + `${Math.round(m.ty_le_bp / 100)}% cả bàn cùng núp — phần che teo lại`;

      // ── D6: khẩu vị rủi ro — từ v47 mỗi phần một dòng, nêu tên mã ─────
      case 'khau_vi': {
        const x = (m.he_so_bp / 10000).toFixed(2).replace(/0$/, '');
        const ten = m.he_so_bp > 10000 ? 'quyết liệt' : 'thận trọng';
        // Cùng lý lẽ với `nhan`: có mã thì PHẢI nêu tên, vì người chơi tự cộng
        // các dòng để kiểm và "×1,35" đứng một mình đọc ra một con số khác.
        if (m.ma) return `Khẩu vị ${ten} · biên độ ×${x} phần ${m.khong ? 'khống ' : ''}${ts(m.ma)?.label ?? m.ma}`;
        return `Khẩu vị ${ten} · biên độ ×${x}`;
      }

      // ── LÕI VỐN A: đảo danh mục — phí chuyển đổi + hàng chờ khớp lệnh ──
      case 'dao_phi':
        return `Phí chuyển đổi ${ts(m.tu)?.label ?? m.tu} → ${ts(m.den)?.label ?? m.den}`;
      case 'xep_hang':
        return `Xếp hàng khớp lệnh ${ts(m.id)?.label ?? m.id}`
          + ` — ${m.so_vao} người cùng vào vòng này`;

      // ── LÕI VỐN B: khoá nắm giữ ───────────────────────────────────────
      case 'khoa_giam_truot':
        return `Khoá ${ts(m.id)?.label ?? m.id} · đỡ bớt trượt giá do đông`;
      case 'khoa_thuong':
        return `Giữ ${ts(m.ma)?.label ?? m.ma} qua ${nGD(m.giai_doan)} — thưởng nắm giữ`;
      case 'be_keo':
        return `Phá cam kết ${ts(m.ma)?.label ?? m.ma}`
          + ` — phạt ${m.phat_bp} bp + thu hồi ${m.thu_hoi_bp} bp đã thưởng`;

      /*
       * ⚠ BỐN NHÃN THÊM 28/07 — engine phát bốn kind này từ trước mà bảng nhãn
       * thiếu case, nên chúng rơi vào default "cơ chế chưa có nhãn (báo lỗi giúp
       * mình nhé)". Không phải ca hiếm: đo 28.000 ghế-vòng thì `dac_quyen` nổ
       * 5.600 lần, `chan_lo_san` 431 lần. Ba trong bốn là ĐẶC QUYỀN THẺ — tức
       * đúng khoảnh khắc lá bài của người chơi làm được việc thì màn hình bảo
       * họ đi báo lỗi. Đúng lời founder: "cực kỳ nhiều lỗi hiển thị".
       */
      case 'short':
        return m.delta_bp >= 0
          ? `Phòng hộ ${ts(m.ma)?.label ?? m.ma} KHỚP — ăn cú nghịch đảo`
          : `Phòng hộ ${ts(m.ma)?.label ?? m.ma} khớp — trái chiều, chịu phí`;
      case 'chan_lo_san':
        return kyLuat
          ? `KỶ LUẬT đỡ đòn — lỗ ${pctBp(m.truoc_san_bp)}, sàn chặn ở ${pctBp(m.san_bp)}`
          : `${ct('chan_lo')?.label ?? 'Chặn Lỗ'} đỡ đòn — lỗ ${Math.abs(m.truoc_san_bp)} bp, sàn chặn ở ${Math.abs(m.san_bp)} bp`;
      case 'dac_quyen':
        return m.ly_do === 'xep_hang'
          ? `${ct(m.id)?.label ?? m.id} — hoàn phần xếp hàng khớp lệnh`
          : m.ly_do === 'dao_phi'
            ? `${ct(m.id)?.label ?? m.id} — hoàn phần phí đảo danh mục`
            : `${kyLuat && m.id === 'chan_lo' ? 'KỶ LUẬT' : ct(m.id)?.label ?? m.id} — phí bảo hiểm mỗi vòng`;
      case 'don_bay_cam_ket':
        return `Cam kết ${Math.round(m.ty_le_bp / 100)}% Vốn — đòn bẩy ${(m.he_so_bp / 10000).toFixed(2).replace('.', ',')}×${m.ben_lo ? ' (vế lỗ nặng hơn)' : ''}`;

      // ── v55 (D409) — trait CHỐT NON · Lướt Sóng mới (chốt lời trong ô) · NGỌN LỬA ĐÀ ──────────────
      case 'chot_non_tran':
        return `CHỐT NON — lãi ${pctBp(m.truoc_tran_bp)}, trần cắt ở ${pctBp(m.tran_bp)}`;
      case 'song':
        return `${ct('luot_song')?.label ?? 'Lướt Sóng'} · chốt lời ${ts(m.ma)?.label ?? m.ma} ở ${pctBp(m.nguong_bp)}`
          + ` (đỉnh sóng ${pctBp(m.dinh_bp)}) — ${Math.round(m.phan_bp / 100)}% vị thế`;
      case 'lua':
        return m.thuan
          ? `Lửa đà nấc ${m.nac} — ${ts(m.ma)?.label ?? m.ma} THUẬN, cộng thêm ${Math.round(m.he_so_bp / 100)}% phần lãi`
          : `Lửa đà nấc ${m.nac} — ${ts(m.ma)?.label ?? m.ma} ĐẢO, trừ thêm ${Math.round(m.he_so_bp / 100)}% phần lỗ`;
      // ── v55 (D422) — KIÊN NHẪN / NÓNG VỘI: theo MÃ, đọc số vòng đã giữ liền ─────────────────────────────
      case 'kien_nhan':
        return `KIÊN NHẪN — ${ts(m.ma)?.label ?? m.ma} giữ liền ${m.giu_vong} vòng, cộng thêm ${Math.round(m.he_so_bp / 100)}% phần lãi`;
      case 'nong_voi':
        return `NÓNG VỘI — ${ts(m.ma)?.label ?? m.ma} giữ liền ${m.giu_vong} vòng, cắt ${Math.round(m.he_so_bp / 100)}% phần lãi`;
      default:
        return '• cơ chế chưa có nhãn (báo lỗi giúp mình nhé)';
    }
  };

  const voKhung = !itMotion && Math.abs(pnl) > 2500;

  const dangDien = hien < chain.length;

  return (
    /*
     * Lớp nhận chạm phủ cả dây chuyền. `div` + role/onKeyDown thay vì `button`:
     * bên trong có nhiều phần tử và text người chơi cần chọn/đọc, bọc trong
     * button là HTML không hợp lệ.
     */
    <div
      className={s.boc}
      onClick={dangDien ? boQua : undefined}
      aria-hidden={false}
    >
      {/*
        Ngón tay: chạm BẤT KỲ ĐÂU trên dây chuyền (onClick ở lớp bọc).
        Bàn phím: nút thật dưới đây — lớp bọc là `display: contents` nên không vẽ
        được vòng focus, mà bỏ focus ring đi thì người dùng bàn phím mất đường.
      */}
      {dangDien && !itMotion && (
        <button type="button" className={s.nhacBoQua} onClick={boQua}>
          chạm để xem ngay ›
        </button>
      )}

      {kq.tin_gia_lo && (
        <div className={s.tinGia}>
          {/* Cùng lưới `news` với băng-rôn tin thật (SuKienBanner) — cặp nhãn
              tin thật / tin giả phải là MỘT vật ở hai màu, không phải một bên
              icon một bên chữ trơn. Ký tự cảnh báo U+26A0 cũ ra tam giác đơn sắc
              trên Windows và tam giác MÀU trên iPhone. */}
          <span className={s.tinGiaDau}>
            <PixelIcon name="news" size={16} />
            TIN GIẢ
          </span>
          <div className={s.tinGiaPhu}>
            &quot;{nSK(kq.tin_gia_lo.su_kien)}&quot; ở vòng {kq.tin_gia_lo.vong} là tin bịa.
            <br />
            Dư âm đã <b>ĐẢO NGƯỢC</b> — cả bàn đều vào theo nó.
          </div>
        </div>
      )}

      {/* D302 — ĐÁM ĐÔNG ĐỔI Ô, lộ ex-post (luật 03 §3 "không hiện được đường
          đọc = cấm ship cơ chế đó"). Cùng khuôn với băng TIN GIẢ: một băng, một
          câu, không tooltip — người chơi phải thấy ô mình vừa chơi đáng lẽ là gì. */}
      {kq.o_doi && (
        <div className={s.tinGia} data-o-doi={kq.o_doi.boi}>
          <span className={s.tinGiaDau}>
            <PixelIcon name="chart" size={16} />
            ĐÁM ĐÔNG ĐỔI Ô
          </span>
          <div className={s.tinGiaPhu}>{moTaODoi(kq.o_doi, giaiDoan, suKien)}</div>
        </div>
      )}

      {/* D435 — chớp sáng toàn màn đã gỡ: VÌ SAO là tấm ĐỌC, cú mở tấm không phải một khoảnh khắc của trận. */}

      <div
        className={[
          s.tong, laiLo >= 0 ? s.lai : s.lo, voKhung && xong ? s.voKhung : '',
        ].filter(Boolean).join(' ')}
        data-so-to={pctVi !== null ? 'ca-vi' : 'tong-chuoi'}
      >
        {soTo}
      </div>

      {/*
        D88 §11.2 — ỐNG KÍNH CON ĐƯỜNG: dòng soi riêng của con đường đã chọn
        ở kỳ ngộ. Đây là chỗ "lựa chọn khác biệt" thành sự thật: hai người
        cùng bàn, cùng ô, đọc hai con số khác nhau sau mỗi vòng.
        Chỉ hiện khi server gửi (đã chọn con đường); số null vẽ —, TUYỆT ĐỐI
        không vẽ số âm/0 ở vòng đứng ngoài (chốt §1.2 — xem OngKinhDTO).
        Hiện khi ĐÃ diễn xong chuỗi để không tranh cao trào với số tổng.
      */}
      {xong && kq.ong_kinh && (
        <div className={s.ongKinh} role="status">
          <span className={s.okNhan}>{OK_NHAN[kq.ong_kinh.loai]}</span>
          <b className={s.okSo}>{okSo(kq.ong_kinh)}</b>
        </div>
      )}

      {/* Danh sách chi tiết — phần DUY NHẤT thu sau nút "VÌ SAO ▾". Việc đếm
          `hien` vẫn chạy ngầm kể cả khi đóng, nên số tổng ở trên vẫn nhảy theo
          từng mắt xích và mở ra là danh sách đã đầy đủ, không diễn lại. */}
      {moChain && khoan.length > 0 && (
        <div className={s.tienMa} data-tien-theo-ma>
          <div className={s.nhan}>PHẦN TIỀN CỦA BẠN</div>
          {khoan.map((k) => (
            <div
              key={k.khoa}
              className={`${s.tienMaDong} ${k.loai === 'truot' ? s.truot : k.loai === 'lai' ? s.pos : s.neg}`}
              data-khoan={k.khoa}
              data-loai={k.loai}
              {...(k.khoa.startsWith('cn:') ? { 'data-cau-noi': k.khoa.slice(3) } : {})}
            >
              {/* D400 — founder 23/09: *"Tách riêng dòng: Trượt giá: -X% (màu đỏ/cam)"* — % trên NAV trước vòng,
                  CÙNG phép chia với con số ngoài bàn (`phanTramNhip`). */}
              <span>
                {k.nhan}
                {k.loai === 'truot' && nhip && nhip.goc > 0
                  ? ` · ${chuoiPhanTram(phanTramNhip(k.tien, nhip.goc)).replace(/^[+-]/, '')} NAV` : ''}
              </span>
              <b>
                {k.tien > 0 ? '+' : k.tien < 0 ? '-' : ''}
                <PixelIcon name="coin" size={8} />
                {dinhDangChip(Math.abs(k.tien))}
              </b>
            </div>
          ))}
        </div>
      )}
      {/*
        ⭐⭐ D374 (founder 21/09) — VÒNG KHÔNG CẦM MÃ NÀO THÌ KHỐI "VÌ SAO" RỖNG, VÀ MÀN CÂM.

        Nguyên văn: *"sau khi t bán hết tài sản thì hiện lãi 29.7% nhưng không có lí do giải
        thích?"*. Số đúng: hôm ấy +3.517 NAV trên 11.848 = 29,7%, và gần như trọn phần ấy là
        dòng ăn chia tiền cược. Nhưng `chain` là chuỗi GIÁ CỦA MÃ — không cầm mã nào thì nó
        rỗng, nên khối VÌ SAO hiện một cái nhãn trống dưới một con số to.

        Khối PHẦN TIỀN CỦA BẠN ngay trên ĐÃ chở đủ lời giải, chỉ là không ai nối được nó với
        con số. Một dòng nối hộ, và chỉ hiện đúng ca ấy — vòng có cầm mã thì danh sách tự nói.
      */}
      {moChain && chain.length === 0 && (
        <div className={s.nhan} data-khong-cam-ma>
          VÒNG NÀY BẠN KHÔNG CẦM MÃ NÀO
          <span className={s.nhanPhu}>
            {' '}· nên không có dòng giá nào — toàn bộ chênh lệch đến từ các khoản ngay trên
          </span>
        </div>
      )}
      {moChain && chain.length > 0 && (<>
      {/* D336 — nói rõ đơn vị của các dòng dưới: % GIÁ của mã, không phải % ví. */}
      <div className={s.nhan}>VÌ SAO <span className={s.nhanPhu}>· % là giá của mã</span></div>
      <div>
        {dienRoi.map((m, i) => (
          <div
            key={i}
            className={[
              s.mx,
              /*
               * Founder 08/08 (lần 2): mắt xích CỦA LÁ ăn thẳng style nổi bật
               * kiểu dòng Đòn Bẩy ngay trong danh sách — không mục riêng
               * ("gượng gạo"). `laCuaMatXich` là bộ nhận diện duy nhất; số vẫn
               * nhuộm màu thắng/thua qua mulLai/mulLo.
               */
              laCuaMatXich(m) !== null
                ? `${s.mul} ${m.delta_bp >= 0 ? s.mulLai : s.mulLo}`
                : (m.delta_bp >= 0 ? s.pos : s.neg),
              // D435 — tấm tĩnh: dòng không còn nảy vào từng cái.
            ].filter(Boolean).join(' ')}
          >
            <span>{nhan(m)}</span>
            <b>{pctBp(m.delta_bp)}</b>
            {/* v13 — 8.4: cú bị sức căng khuếch đại phải GỌI TÊN nguyên nhân,
              * không thì người chơi đọc thành "bị phạt ngẫu nhiên" (17.7 cấm). */}
            {/*
              ⭐ D374 (founder 21/09): *"· sức căng ÊM khuếch đại. Cũng khó hiểu"*. Đúng — câu cũ
              TỰ MÂU THUẪN: "ÊM" mà "khuếch đại" thì khuếch đại cái gì. Gốc là dải ÊM nghĩa là
              hệ số ≈ ×1, tức KHÔNG khuếch đại gì cả, mà dòng vẫn hiện.
              Nay: dải ÊM thì THÔI HIỆN DÒNG (không có gì để nói), hai dải còn lại nói thẳng
              chuyện đang xảy ra — đông người ôm cùng một mã thì cú kéo giá mạnh hơn.
            */}
            {(m as { cang_bp?: number }).cang_bp !== undefined
              && ((m as { cang_dai?: number }).cang_dai ?? 0) > 0 && (
              <i>
                {' · '}
                {((m as { cang_dai?: number }).cang_dai ?? 0) >= 2
                  ? 'quá đông cùng ôm mã này — cú kéo mạnh hơn nhiều'
                  : 'đông người cùng ôm mã này — cú kéo mạnh hơn'}
              </i>
            )}
          </div>
        ))}
      </div>
      </>)}

      <div className={s.chan}>
        {/* `coin` 8px chứ không `wallet` 16px: dòng này chỉ 10px, lưới 16 hàng
            đứng cạnh sẽ cao hơn cả cap-height và đội dòng lên. */}
        <span className={s.quy}>
          {T_QUY_VONG_UPPER}
          <PixelIcon name="coin" size={8} />
          {dinhDangChip(kq.quy_vong)}
        </span>
        {/*
          D336 — chân tấm nói CHÊNH NAV (cùng đại lượng với số to), không nói tiền mặt. Chênh
          tiền mặt gồm cả tiền vừa chuyển sang một mã — vòng 1 bàn tập mua Crypto 2.500 thì
          chân tấm ghi "▼ 3.105 VỐN" trong khi NAV chỉ đổi 811: một cú đổi chỗ bị in thành lỗ.
        */}
        {nhip ? (
          <b className={s.delta} style={{ color: nhip.delta >= 0 ? 'var(--win)' : 'var(--lose)' }}>
            {nhip.delta >= 0 ? '▲ +' : '▼ '}{dinhDangChip(Math.abs(nhip.delta))} NAV
          </b>
        ) : (
          <b className={s.delta} style={{ color: deltaVon >= 0 ? 'var(--win)' : 'var(--lose)' }}>
            {deltaVon >= 0 ? '▲ +' : '▼ '}{dinhDangChip(Math.abs(deltaVon))} {T_VON_UPPER}
          </b>
        )}
      </div>
    </div>
  );
}
