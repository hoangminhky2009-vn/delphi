/**
 * ĐỒNG HỒ VÒNG (D38) — bao lâu nữa hết hạn nộp vòng này.
 *
 * Khác `DongHoLuot` (đồng hồ của một LƯỢT trong vòng cược, chờ bot/đối thủ ra
 * tay): cái này là hạn của CẢ PHA CHỌN BÀI, tức thời gian người chơi còn để mua
 * thẻ, đảo danh mục, quyết cam kết. Hai đồng hồ đếm hai thứ khác nhau và có thể
 * cùng hiện, nên chúng là hai component.
 *
 * ─── BA LUẬT, ĐỌC TRƯỚC KHI SỬA ───────────────────────────────────────────────
 *
 * 1. KHÔNG PHẢI NGUỒN CHÂN LÝ (C4). Component này đếm lùi từ `conLaiS` do server
 *    gửi, thuần tuý cho mượt. Nó KHÔNG khoá nút, KHÔNG tự nộp vòng, KHÔNG báo
 *    server. Chạm 0 ở đây chỉ nghĩa là "theo chỗ tôi biết thì đã hết" — server
 *    còn ân hạn, và server mới là bên quyết. Cho nó khoá nút là bán mất một lượt
 *    của người có đồng hồ máy chạy nhanh.
 *
 * 2. HIỆN VÔ ĐIỀU KIỆN (D25/R1). Đồng hồ là một trong những thứ NẶNG NHẤT lên
 *    quyết định — biết còn 4 giây thì người ta chọn khác hẳn lúc còn 40. Giấu nó
 *    sau tab/tooltip/dưới màn cuộn là log ra một quyết định "dưới sức ép" mà
 *    người chơi không hề thấy sức ép đó.
 *
 * 3. §XI — khung vuông, không bo góc, không gradient, `composes` từ pixel.
 */
import { useDemNguocVong } from '@/lib/hooks';
import pixel from '@/styles/pixel.module.css';
import s from './DongHoVong.module.css';

/**
 * Dưới ngưỡng này thì đổi màu + đập nhịp. Thuần trình bày, không phải luật.
 *
 * XUẤT RA vì màn trận cũng đọc nó cho VIỀN CẢNH BÁO (founder 09/08): hai con
 * số ngưỡng rời nhau nghĩa là có lúc viền đỏ nháy mà đồng hồ vẫn xanh — người
 * chơi không biết tin cái nào.
 */
export const NGUONG_GAP_S = 8;

/**
 * Nấc KHẨN của viền — dưới ngưỡng này viền dày lên, đậm lên, nháy gấp đôi.
 *
 * Founder 11/08 chọn "đổi kiểu viền". Hai nấc chứ không phải một nấc đậm hơn,
 * vì nấc thứ hai làm viền CHỞ THÔNG TIN thay vì chỉ báo động: liếc một cái là
 * biết "còn kịp cân nhắc" hay "bấm ngay đi". Một mức duy nhất thì suốt 8 giây
 * đều gào như nhau, và người chơi học cách phớt lờ nó.
 *
 * 3s chứ không phải 4–5s: đây là quãng chỉ còn đủ cho MỘT cú bấm, không còn
 * đủ để cân nhắc — đúng thứ nấc này muốn nói.
 */
export const NGUONG_KHAN_S = 3;

/**
 * PHA ĐANG CHẠY của vòng — suy từ giây ĐANG ĐẾM, không đọc `pha` thô.
 *
 * ⚠⚠ VÌ SAO PHẢI SUY (bắt được 23/08 khi đo trên stack): server tính
 * `pha = daTroi < doc_s ? 'doc' : 'quyet'` TẠI THỜI ĐIỂM RESPONSE, mà màn trận
 * KHÔNG polling (`refetchInterval: false`) — nên trong cả vòng chỉ có đúng một
 * ảnh chụp, chụp ngay đầu vòng, tức LUÔN LÀ 'doc'. Nhãn ĐỌC/QUYẾT đứng yên cả
 * vòng: cơ chế M2 (D90) đúng ở server mà chết ở màn hình.
 *
 * ⚠ KHÔNG phải phép trừ `tongS - 15` mà docstring server cấm: nó cấm client
 * GÕ HẰNG SỐ 15, vì THẺ GIỜ (v32) cộng giây vào `tong_s`. Ở đây `docS` do CHÍNH
 * SERVER phát, còn `con` là số mặt đồng hồ đang hiện — cùng một nguồn, nên
 * nhãn và cần gạt không bao giờ lệch nhau (D61).
 *
 * `docS <= 0` (vòng 1: không có gì để đọc) hoặc trận cũ không phát gì ⇒ trả
 * đúng thứ server nói, không bịa.
 */
export function phaVong(
  con: number, tongS: number, docS: number,
  phaServer?: 'doc' | 'quyet' | undefined,
): 'doc' | 'quyet' | undefined {
  if (docS <= 0 || tongS <= 0) return phaServer;
  return tongS - con < docS ? 'doc' : 'quyet';
}

export function DongHoVong({
  conLaiS, tongS, hetGio, tamDung, lyDo, nhanLuc, pha, docS = 0,
}: {
  conLaiS: number;
  tongS: number;
  /**
   * M2 (D90) — PHA của vòng do SERVER phát: `doc` (đang đọc kết quả vòng trước)
   * hay `quyet`. Nhãn đổi theo pha để người mới thôi tưởng cả 40 giây là để
   * quyết. Vắng ⇒ giữ nguyên mặt số cũ (API cũ, và trận đang mở trong cache).
   */
  pha?: 'doc' | 'quyet' | undefined;
  /** Số giây của pha ĐỌC — vẽ vạch chia trên thanh. 0 ⇒ không vạch. */
  docS?: number;
  /** SERVER nói đã quá hạn. Ưu tiên hơn số client tự đếm — luật 1 ở trên. */
  hetGio: boolean;
  /**
   * MÀN TẬP MIỄN GIỜ (founder 02/08) — server nói vòng này không chạy đồng hồ.
   * Vẽ "TẠM DỪNG" thay vì đếm lùi: một con số đứng yên trông như đồng hồ hỏng,
   * mà "hỏng" là đúng thứ founder vừa phải đi báo hai lần.
   */
  tamDung?: boolean;
  /**
   * VÌ SAO tạm dừng (16/08): trận LÀM QUEN (hai trận đầu — cả trận không
   * tính giờ) hay bốn vòng đầu màn tập. Cùng một cơ chế server, hai câu khác
   * nhau trên màn: "TẠM DỪNG" nói "lát nữa chạy lại", còn trận làm quen thì
   * KHÔNG lát nữa nào — nói "tạm dừng" ở đó là hứa một thứ không xảy ra, và
   * người chơi ngồi chờ đồng hồ bắt đầu.
   */
  lyDo?: 'man_tap' | 'tran_lam_quen';
  /**
   * Mốc NHẬN response mang `conLaiS` này, theo `Date.now()` của MÁY NÀY (rà
   * đồng hồ 08/08). Trước đây component tự lấy mốc lúc EFFECT chạy — mà effect
   * chạy lúc state được ÁP, tức SAU overlay khoảnh khắc (tối đa 12s): toàn bộ
   * thời lượng diễn cộng thẳng vào đồng hồ, màn nói dối LÊN đúng chừng đó giây
   * và người chơi hiện diện vẫn bị chốt hộ. Đo prod 08/08: hai vòng `tu_dong`
   * trong một trận founder đang ngồi chơi. Mốc phải là lúc NHẬN, do nơi nhận
   * response đóng dấu.
   *
   * Chỉ đo KHOẢNG đã trôi trên cùng một đồng hồ máy — không so với giờ server,
   * nên lệch múi giờ / NTP không hiện lên mặt số.
   */
  nhanLuc: number;
}) {
  // CÙNG bộ đếm với viền cảnh báo ở màn trận — xem `useDemNguocVong`.
  const con = useDemNguocVong(conLaiS, nhanLuc);

  if (tamDung) {
    const lamQuen = lyDo === 'tran_lam_quen';
    return (
      <div
        className={s.hop}
        aria-label={lamQuen
          ? 'Trận làm quen — không tính giờ, cứ nghĩ cho kỹ'
          : 'Vòng hướng dẫn — đồng hồ tạm dừng'}
      >
        <span className={s.nhan}>{lamQuen ? 'KHÔNG TÍNH GIỜ' : 'TẠM DỪNG'}</span>
        <span className={s.so}>∞</span>
      </div>
    );
  }

  // Server đã chốt là hết giờ ⇒ nói thẳng, đừng vẽ một con số đang đếm.
  const het = hetGio || con <= 0;
  // Xem `phaVong`: pha thô là ảnh chụp đầu vòng, suy lại theo giây đang đếm.
  const phaThat = phaVong(con, tongS, docS, pha);
  const gap = !het && con <= NGUONG_GAP_S;
  // Phần thời gian ĐÃ TRÔI, 0–1. `tongS` 0 (không nên có) thì coi như đầy.
  const troiPct = tongS > 0 ? Math.min(1, Math.max(0, 1 - con / tongS)) : 1;

  return (
    <div
      className={[s.hop, het ? s.het : '', gap ? s.gap : ''].filter(Boolean).join(' ')}
      aria-live="polite"
      aria-label={het ? 'Đã hết giờ vòng này' : `Còn ${con} giây để quyết định`}
    >
      <span className={s.nhan}>
        {het ? 'HẾT GIỜ' : phaThat === 'doc' ? 'ĐỌC' : phaThat === 'quyet' ? 'QUYẾT' : 'CÒN'}
      </span>
      {!het && <span className={s.so}>{con}s</span>}
      {/*
        * THANH ĐÃ TRÔI — chia nấc chứ không trượt liên tục: ở 4px chiều cao, một
        * thanh trượt mượt bị khử răng cưa thành một vệt xám. Nấc thì luôn ăn khớp
        * lưới điểm ảnh, đúng §XI.
        */}
      <span className={`${pixel.khung} ${s.thanh}`} aria-hidden>
        <span className={s.day} style={{ width: `${Math.round(troiPct * 10) * 10}%` }} />
        {/* Vạch chia ĐỌC | QUYẾT — nhịp TFT: mắt biết trước đoạn nào để nhìn,
            đoạn nào để bấm. Không có pha ĐỌC (vòng 1) thì không vạch. */}
        {docS > 0 && tongS > 0 && (
          <span className={s.vach} style={{ left: `${Math.round((docS / tongS) * 100)}%` }} />
        )}
      </span>
    </div>
  );
}

/**
 * VIỀN CẢNH BÁO SẮP HẾT GIỜ (founder 09/08: *"viền màn hình nhấp nháy đỏ nhẹ
 * khi sắp hết giờ để người chơi biết đi"*).
 *
 * Vì sao nó tồn tại dù ĐÃ CÓ đồng hồ: đồng hồ nằm ở dải trên cùng, còn tay
 * người chơi ở SHOP dưới đáy — lúc đang cân mốc lệnh thì mắt không rời khỏi
 * bảng giá. Viền là tín hiệu ngoại vi: thấy được mà không phải nhìn.
 *
 * BA RÀNG BUỘC:
 *  1. `pointer-events: none` — nó phủ toàn màn, chạm phải xuyên qua. Một cảnh
 *     báo "nhanh lên" mà lại CHẶN nút bấm thì đúng là trò đùa.
 *  2. Chỉ animate `opacity` (D68) — nhấp nháy trên viền là đổi độ sáng, không
 *     đụng bố cục, nên không tốn một lần tính lại layout nào.
 *  3. reduced-motion ⇒ ĐỨNG YÊN CHỨ KHÔNG BIẾN MẤT: người tắt hoạt ảnh vẫn có
 *     quyền biết mình sắp hết giờ. Thứ bị tắt là cái nháy, không phải tin.
 *
 * `khan` = đã dưới `NGUONG_KHAN_S` ⇒ nấc hai: dày hơn, đậm hơn, gấp đôi nhịp.
 */
export function VienGapGio({ hien, khan = false }: {
  hien: boolean;
  khan?: boolean;
}) {
  if (!hien) return null;
  return (
    <div
      className={[s.vienGap, khan ? s.vienKhan : ''].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  );
}
