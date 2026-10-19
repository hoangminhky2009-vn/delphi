/**
 * BÁCH KHOA CƠ CHẾ — ba thứ chợ làm với bạn mà trước nay không chỗ nào nói.
 *
 * ─── VÌ SAO CÓ ───────────────────────────────────────────────────────────────
 * Founder 13/09: *"vẫn chưa có chỗ nào thể hiện hay giải thích rõ ràng lắm về
 * tính liên kết của các thẻ sự kiện … trong màn hướng dẫn cũng chưa có tình
 * huống trượt giá hay là thay đổi sự kiện do tất cả hành động giống nhau cùng 1
 * lúc … user phải biết vì sao"*.
 *
 * Đo trước khi viết (replay bàn tập, seed 20417769, người chơi ngồi im): đám đông
 * BẺ Ô **ba lần** ngay trong 12 vòng của màn tập (v7 · v11 · v12), phí vội vàng
 * BẬT, và dây chuyền sự kiện thì đã có mắt xích `day_chuyen` trong chuỗi lý do.
 * Tức cả ba cơ chế đang CHẠY và đang ảnh hưởng tới tiền của người chơi — chỉ là
 * chưa ai giải thích. Đây là chỗ giải thích nguội; dạy NÓNG (đúng lúc nó nổ) nằm
 * ở `CoachTap`.
 *
 * ─── LUẬT ────────────────────────────────────────────────────────────────────
 * · HÌNH TRƯỚC, CHỮ SAU (founder: *"đừng có mà toàn chữ nhé, có minh họa thì
 *   tốt"*). Mỗi mục một sơ đồ dựng bằng CHÍNH các khối của bàn — ô, hạt, cột —
 *   nên 0 art mới (A11.14) và sơ đồ tự già đi cùng giao diện thật.
 * · MÔ TẢ, KHÔNG KÊ ĐƠN (A10): kể chợ làm gì, không kể nên làm gì. Không câu nào
 *   dạng "nên/hãy/tránh".
 * · TỪ VỰNG MỘT NGUỒN (D26): chữ ở đây phải là chữ người chơi đã thấy trên bàn —
 *   "ĐÃ ĐỔI ↺" lấy từ `lib/o_doi`, "Chen chúc" và "trượt giá" lấy đúng lời mắt
 *   xích chuỗi (`ChainReveal`). Đổi lời ở đây mà không đổi ở kia là dựng bản sao
 *   thứ hai của cùng một khái niệm (A11.5).
 * · TĨNH: không `animation`. Đây là trang tra cứu, không phải màn chơi.
 */
import { NHAN_O_DOI } from '@/lib/o_doi';
import s from './BachKhoaCoChe.module.css';

/** Một mục: tiêu đề · sơ đồ · hai câu. Không mục nào được dài hơn màn hình. */
function Muc({ ten, hinh, than }: { ten: string; hinh: React.ReactNode; than: React.ReactNode }) {
  return (
    <section className={s.muc}>
      <h4 className={s.ten}>{ten}</h4>
      <div className={s.hinh} aria-hidden>{hinh}</div>
      <p className={s.than}>{than}</p>
    </section>
  );
}

export function BachKhoaCoChe({ gon }: { gon?: boolean }) {
  return (
    <div className={`${s.khoi} ${gon ? s.gon : ''}`} aria-label="Bách khoa cơ chế">
      <div className={s.dau}>BÁCH KHOA · CHỢ LÀM GÌ VỚI BẠN</div>

      {/*
        SƠ ĐỒ 1 — ĐÁM ĐÔNG BẺ Ô. Hai ô cạnh nhau, mũi tên đổi ở giữa, và hàng ghế
        bên dưới nghiêng hết về một phía: chính hình dạng "cả bàn cùng một phía"
        là thứ gây ra cú bẻ, nên nó phải nằm trong hình chứ không nằm trong câu.
      */}
      <Muc
        ten="ĐÁM ĐÔNG BẺ Ô SẮP LẬT"
        hinh={(
          <div className={s.soDo}>
            <span className={`${s.o} ${s.oMo}`}>bong bóng</span>
            <span className={s.doi}>↺</span>
            <span className={`${s.o} ${s.oThat}`}>tăng lãi suất</span>
            <span className={s.ghe}>
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} className={`${s.cham} ${i < 6 ? s.chamDon : ''}`} />
              ))}
            </span>
          </div>
        )}
        than={(
          <>
            Khi phần lớn bàn dồn về cùng một phía hai vòng liền, ô sắp lật bị
            thay. Ô đã lật kiểu đó mang dấu <b>{NHAN_O_DOI}</b> ở chân, chạm giữ
            vào ô để đọc ô đáng lẽ là gì.
          </>
        )}
      />

      {/*
        SƠ ĐỒ 2 — TRƯỢT GIÁ. Bốn cột lệnh to dần, phần đỏ ở đỉnh là phần trượt:
        mắt đọc ra "càng to càng lệch" mà không cần một con số nào (và con số thì
        thuộc về `config/`, không thuộc về một trang tra cứu — A8.2).
      */}
      <Muc
        ten="LỆNH CÀNG TO, GIÁ KHỚP CÀNG LỆCH"
        hinh={(
          <div className={s.soDo}>
            <span className={s.cot}>
              {[18, 30, 46, 64].map((h, i) => (
                <i key={h} className={s.thanh} style={{ height: h }}>
                  <b className={s.truot} style={{ height: [0, 3, 8, 17][i] }} />
                </i>
              ))}
            </span>
            <span className={s.chuHinh}>cỡ lệnh →</span>
          </div>
        )}
        than={(
          <>
            Một lệnh lớn không khớp hết ở giá đang thấy; phần đuôi khớp ở giá xấu
            hơn. Chuỗi lý do gọi nó là <b>trượt giá</b>, và khi nhiều người cùng
            mua một mã thì có thêm dòng <b>Chen chúc</b>.
          </>
        )}
      />

      {/*
        SƠ ĐỒ 3 — DÂY CHUYỀN SỰ KIỆN. Ô đã lật → ô còn úp, nối bằng một gạch
        nghiêng đúng màu gạch thật trên bản đồ. Đây là "liên kết giữa các thẻ sự
        kiện với nhau" mà founder nói chưa chỗ nào giải thích.
      */}
      <Muc
        ten="TIN NÀY MỞ CỬA CHO TIN KIA"
        hinh={(
          <div className={s.soDo}>
            <span className={`${s.o} ${s.oThat}`}>sàn khoá rút tiền</span>
            <span className={s.noi} />
            <span className={`${s.o} ${s.oUp}`}>?</span>
            <span className={s.chuHinh}>gạch dưới ô úp = phía nó nghiêng</span>
          </div>
        )}
        than={(
          <>
            Bộ ô không rút ngẫu nhiên: một tin vừa lật làm vài tin sau dễ ra hơn.
            Ô còn úp nào đã bị tin trước nghiêng sẽ mang một gạch màu ở chân,
            và <b>SỔ</b> ghi lại những cái kéo bạn đã đi qua.
          </>
        )}
      />
    </div>
  );
}
