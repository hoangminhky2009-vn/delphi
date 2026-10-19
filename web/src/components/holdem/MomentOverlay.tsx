/**
 * KHOẢNH KHẮC LỚN — công bố toàn màn khi ai đó NHÂN ĐÔI TÀI KHOẢN.
 *
 * ⚠⚠ ALL-IN KHÔNG CÒN Ở ĐÂY, SSS THAY CHỖ (founder 22/08: *"xóa hiệu ứng all
 * in đi, chỉ cải tiến hiệu ứng khi bấm nút all in thôi"* → *"thay bằng hiện
 * toàn màn hình SSS khi player đạt điểm SSS"*).
 *
 * ⚠ Và phép đo trước khi gỡ cho thấy lớp phủ này VỐN ĐÃ không nổ lần nào:
 * 0/14.400 ghế-vòng cho cả ALL-IN lẫn ×2 (chi tiết + nguyên nhân từng loại ghi
 * ở docstring `KhoanhKhac` trong `api/holdem.ts`). Nên SSS là người dùng thật
 * đầu tiên của nó, và cái giá "dừng bàn 2,1 giây" nay có người trả xứng đáng:
 * D105 đo phân phối 600 trận, SSS chiếm 3,3%.
 *
 * XẾP HÀNG ĐỢI, không diễn song song: một vòng có thể vừa SSS vừa ×2.
 * Chồng lên nhau thì không ai đọc kịp cái nào.
 *
 * `onXong` báo cho màn cha biết đã diễn hết — dây chuyền tính điểm phải CHỜ,
 * nếu không hai lớp hoạt hình đè nhau.
 */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks';
import type { KhoanhKhac } from '@/api/holdem';
import { useMe } from '@/api/queries';
import { GheAvatar } from './BotAvatar';
import { ChuHang, type HangCongBo } from './ChuHang';
import { LoiGay } from './LoiGay';
import { ChuPixel } from './ChuPixel';
import { dinhDangChip } from '@/api/holdem';
import { NHIP } from '@/lib/nhip';
import s from './MomentOverlay.module.css';

// Thời lượng từ config (lib/nhip.ts) — cũ gõ tay ở đây, không ai biết nó
// phải khớp với animation nào.
const TAT_MS = NHIP.KHOANH_KHAC_TAT;

/**
 * THỜI LƯỢNG THEO BẬC (founder 22/08: *"S và SS cũng hiện nhé nhưng mà không
 * dài … bằng SSS thôi"*).
 *
 * ⚠ Đây là cần gạt QUAN TRỌNG NHẤT của cụm này, vì nó là thứ người chơi TRẢ:
 * mỗi mili giây ở đây là mili giây bàn bị dừng. Hạng S xảy ra thường hơn SSS
 * nhiều (D105 đo S+ 20,8% vs SSS 3,3%), nên nó phải rẻ — nếu không, thứ hay gặp
 * nhất lại là thứ chắn đường nhiều nhất, đúng cái bệnh vừa gỡ ở ALL-IN.
 */
const HIEN_THEO_HANG: Record<string, number> = {
  S: 950,
  SS: 1300,
  SSS: NHIP.KHOANH_KHAC_HIEN,
  /*
   * GỌI KÝ QUỸ — dài hơn SSS một chút, và đây là chỗ DUY NHẤT trong bảng mà chi
   * phí "dừng bàn" đáng trả cho một tin XẤU. Ba lý do, đo được cả ba:
   *   · nó hiếm hơn hẳn thứ D116 đã gỡ vì quá dày (3,34% số vòng-ghế, so với
   *     8,39% của ×2 cũ) — 19,3% số trận có đúng một cú;
   *   · nó có hoạt ảnh HAI THÌ (lá đứng nguyên → gãy), mà thì đầu là điều kiện
   *     để thì sau có nghĩa, nên cắt ngắn là giết cả hai;
   *   · người chơi vừa mất 684 chip trung bình và trước hôm nay KHÔNG có một
   *     chữ nào giải thích. Đây là lần đầu họ được biết.
   */
  /*
   * +50% — bậc VỪA, nổ ~0,21 lần/trận (gấp ~4 lần bậc ×2). Ngắn hơn ×2 vì luật
   * D113 đã đặt: thứ hay gặp hơn phải RẺ hơn, không thì cái thường gặp nhất lại
   * chắn đường nhiều nhất — đúng bệnh đã phải gỡ ở ALL-IN.
   */
  '+50%': 900,
  KY_QUY: 1900,
};
const hienMs = (chu: string): number => HIEN_THEO_HANG[chu] ?? NHIP.KHOANH_KHAC_HIEN;

/**
 * Thời lượng cho người bật TIẾT KIỆM CHUYỂN ĐỘNG — đủ đọc ba glyph và cái nhãn,
 * và bằng nhau cho MỌI bậc: thang bậc ở đây được kể bằng MÀU và CHỮ (nhánh
 * reduced-motion của `ChuHang`), không bằng thời lượng. Cho SSS đứng lâu hơn S
 * là dựng lại đúng cái nhịp mà người ta vừa tắt đi.
 */
const DOC_IT_MOTION_MS = 900;

export function MomentOverlay({
  hangDoi, onXong, art,
}: {
  hangDoi: KhoanhKhac[];
  onXong: () => void;
  /**
   * Art lá từ catalog — chỉ nhánh GỌI KÝ QUỸ dùng (vẽ lá `don_bay` gãy đôi).
   * Truyền từ ngoài thay vì nhét SVG vào từng khoảnh khắc: hàng đợi là dữ liệu
   * đi qua state mỗi vòng, còn art là hằng số cả trận — nhét vào là chép một
   * chuỗi vài KB vào state không vì lý do gì.
   */
  art?: Record<string, string>;
  /*
   * ⚠ `onNhipRung` GỠ 22/08 cùng nhánh ALL-IN. Nó tồn tại để rung đúng nhịp
   * chữ ALL-IN hiện (founder 27/07: "mỗi một người all-in sẽ rung 1 nhịp") và
   * CỐ Ý không bắn cho ×2 — nhân đôi tài khoản là tin vui, rung như bị đấm là
   * sai nghĩa. Bỏ nhánh all-in đi thì prop này không còn ca nào bắn: giữ lại
   * là để lại một cần gạt đã ngắt điện, đúng bẫy "cơ chế trang trí" của repo.
   */
}) {
  const itMotion = useReducedMotion();
  // Diện mạo của chính mình: một cột trên `users` đã có sẵn trong `/auth/me`,
  // nên 0 request thêm. Payload trận chỉ mang diện mạo của NGƯỜI KHÁC.
  const dmCuaToi = useMe().data?.user?.dien_mao ?? null;
  const [i, setI] = useState(0);
  const [dangTat, setDangTat] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Mọi hẹn giờ gom một chỗ và dọn khi unmount — rời bàn giữa chừng không
    // được để hoạt hình chạy tiếp (luật motion mục 8.2 của chỉ đạo).
    const dat = (f: () => void, ms: number) => { timers.current.push(setTimeout(f, ms)); };
    if (i >= hangDoi.length) { onXong(); return undefined; }

    /*
     * ⚠⚠ TIẾT KIỆM CHUYỂN ĐỘNG ≠ KHÔNG CHO ĐỌC. Bản đầu kẹp MỌI hẹn giờ về
     * `min(ms, 60)`, nên với người bật "Giảm chuyển động" thì lớp phủ nháy 60ms
     * rồi biến mất: không kịp đọc glyph nào, không thấy nhãn — và cả nhánh CSS
     * reduced-motion viết riêng cho `ChuHang` (màu tĩnh phân bậc, tia tắt) trở
     * thành mã không ai quan sát được. Tắt cái NHÁY, không tắt cái TIN.
     * ⚠ Và hai mốc phải TÁCH NHAU: kẹp chung một số làm `dangTat` với `setI` nổ
     * cùng lúc, tức pha tắt thành vô nghĩa — chính là cách bản 60ms hỏng.
     */
    const hien = itMotion ? DOC_IT_MOTION_MS : hienMs(hangDoi[i]!.chu);
    setDangTat(false);
    dat(() => setDangTat(true), hien);
    dat(() => setI((x) => x + 1), hien + (itMotion ? 0 : TAT_MS));

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [i, hangDoi, itMotion, onXong]);

  const k = hangDoi[i];
  if (!k) return null;
  /** Ba mốc hạng đi đường glyph pixel; ×2 giữ đường chữ gradient cũ. */
  const laHang = k.chu === 'S' || k.chu === 'SS' || k.chu === 'SSS';
  const laKyQuy = k.chu === 'KY_QUY';

  if (laKyQuy) {
    /*
     * ⚠⚠ GỌI KÝ QUỸ — nhánh RIÊNG, không đi qua thân chung, vì nó khác cả ba
     * nhánh kia ở TỪNG mặt: không chữ (ChuPixel không có chữ cái tiếng Việt),
     * không avatar (đây là hình phạt riêng, không phải công bố cho bàn xem),
     * và tông thì ngược hẳn.
     *
     * ⭐ CÚ RUNG NEO VÀO ĐÚNG NHỊP GÃY (founder: *"chỉ rung ở khoảnh khắc lõi
     * gãy đôi thôi"*). Không rung suốt lớp phủ: rung nền suốt 1,9 giây là quấy,
     * còn rung ĐÚNG một nhịp tại khung hình lá gãy thì cú rung tự nó KỂ chuyện.
     * ⚠ Rung `.man` — vỏ RIÊNG của lớp phủ này — TUYỆT ĐỐI không rung `.phu`
     * của shop hay bất kỳ hộp nào thứ khác đo toạ độ theo. Đó chính là lỗi D125
     * founder bắt được sáng nay: cú rung dán lên một hộp `fixed; inset: 0` làm
     * đàn chip bay tính đường từ một hệ quy chiếu đang rung.
     * ⚠ Và ở đây KHÔNG có gì đang bay: lớp phủ nổ ở CUỐI vòng, shop đã đóng.
     */
    return (
      <div className={s.lop} role="status" aria-live="assertive">
        <div className={`${s.nen} ${s.nenKyQuy} ${dangTat ? s.tat : ''}`} />
        {/* Nháy đỏ MỘT phát — không lặp. Lặp thì nó thành đèn báo động, mà đèn
            báo động nhấp nháy mãi là thứ người ta học cách phớt lờ (D77/D119). */}
        <div className={`${s.chop} ${dangTat ? s.tat : ''}`} aria-hidden />
        <div className={`${s.man} ${itMotion ? '' : s.manRung} ${dangTat ? s.tat : ''}`}>
          <LoiGay svg={art?.['don_bay']} mat={k.mat ?? 0} />
        </div>
        {/*
          ⚠⚠ ĐƯỜNG ĐỌC CHO TRÌNH ĐỌC MÀN HÌNH. Không có dòng này thì lớp phủ có
          `role="status"` mà KHÔNG CÓ GÌ ĐỂ XƯỚNG: `ChuPixel` render `aria-hidden`
          (nó là hình vẽ từng ô, không phải chữ), và hai nửa lá cũng `aria-hidden`.
          Tức người dùng trình đọc màn hình sẽ mất 700 chip mà không nghe một tiếng
          nào — đúng cái im lặng mà cả cụm này sinh ra để chấm dứt, chỉ đổi đối
          tượng. Ba nhánh kia thoát được vì chúng có `s.ten`/`s.bac` là chữ thật.
        */}
        <span className={s.doc}>
          {`Gọi ký quỹ: lá Đòn Bẩy gãy, bạn mất ${dinhDangChip(k.mat ?? 0)} chip.`}
        </span>
      </div>
    );
  }

  return (
    <div className={s.lop} role="status" aria-live="polite">
      <div className={`${s.nen} ${laHang ? s.nenHang : ''} ${dangTat ? s.tat : ''}`} />
      {laHang ? (
        /*
         * ⭐ HẠNG S/SS/SSS — GLYPH PIXEL VẼ TAY, không phải font hệ thống.
         * Toàn bộ lý lẽ dựng hình + phân bậc nằm ở `ChuHang.tsx`.
         */
        <div className={`${s.hangVo} ${dangTat ? s.tat : ''}`}>
          <ChuHang hang={k.chu as HangCongBo} />
        </div>
      ) : (
        /*
         * ⭐ VẼ BẰNG GLYPH PIXEL, KHÔNG BẰNG FONT HỆ ĐIỀU HÀNH (24/08).
         *
         * Cả hai chuỗi của nhánh này — `×2` và `+50%` — vẽ được TRỌN VẸN bằng
         * lưới sẵn có (`× 2 + 5 0 %`), nên đây là chỗ §XI đang HỞ mà đóng được
         * miễn phí: *"vật do FONT HỆ ĐIỀU HÀNH vẽ … người chơi thấy một màn khác
         * màn người dựng đang kiểm"*.
         *
         * ⚠ VÀ NÓ GỠ LUÔN MỘT BUG CHỜ NỔ: bản cũ tô chữ bằng `background-clip:
         * text` + gradient, đúng thứ D113 ghi là VỠ TRÊN ANDROID khi phần tử vừa
         * cắt chữ vừa transform — mà `.chuVo` thì transform liên tục. Nó chưa lộ
         * vì cú này gần như không nổ (0,06 lần/trận); hạ ngưỡng xuống +50% là cho
         * nó nổ gấp ~4 lần, tức biến một lỗi lý thuyết thành một lỗi người chơi
         * gặp. Sửa cùng lượt chứ không để nó nổ rồi mới chữa.
         */
        <div className={`${s.chuVo} ${dangTat ? s.tat : ''}`}>
          <ChuPixel chuoi={k.chu} px={9} vien />
        </div>
      )}
      <div className={`${s.ai} ${dangTat ? s.tat : ''}`}>
        {/*
          KHOẢNH KHẮC TOÀN MÀN — 96px (32×3), cỡ lớn nhất avatar được hiện.
          Đây là chỗ khung viền và phụ kiện thật sự có sân khấu: trong dải đối thủ
          chúng chỉ là một gợi ý 2px, ở đây cả bàn nhìn 2–4 giây vào giữa màn.
        */}
        <GheAvatar
          ghe={k.loai === 'nguoi'
            ? { loai: 'nguoi', dm: k.gheId === 'ban' ? dmCuaToi : k.dm ?? null }
            : { loai: 'may', hat: k.ten }}
          ten={k.ten}
          size={96}
        />
        <div>
          <div className={s.ten}>{k.ten}</div>
          {k.bac && <div className={s.bac}>{k.bac}</div>}
        </div>
      </div>
    </div>
  );
}

/** Nháy đỏ một cái khi cháy tài khoản. Tự tháo sau khi diễn xong. */
export function NhayDo({ hien }: { hien: boolean }) {
  if (!hien) return null;
  return <div className={s.nhayDo} aria-hidden="true" />;
}
