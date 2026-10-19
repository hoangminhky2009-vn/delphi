/**
 * Hero cụm đăng nhập — nhận diện "game đọc thị trường" đúng chất Mẫu E:
 * logo chip + prompt terminal + dải tài sản chạy + 3 trụ (Alpha Draft ·
 * Personal Finance · dự báo) vẽ bằng LED bar/pixel-art chữ ký.
 * Ticker/anim chỉ transform+opacity, tôn trọng prefers-reduced-motion (CSS).
 *
 * ⚠ THỨ TỰ BA TRỤ LÀ MỘT PHÁT BIỂU, KHÔNG PHẢI TRANG TRÍ (founder 07/09):
 * trụ đứng đầu là thứ app tự nhận là vòng chơi LÕI. Trước 07/09 chỗ đó là
 * "DỰ BÁO · ĂN POOL" — mặt chợ ĐANG ĐÓNG BĂNG cả mùa 0.0 (D86) — nên màn đầu
 * tiên người lạ nhìn thấy đang mời họ vào thứ không mở. Alpha Draft lên đầu.
 */
import { TAI_SAN } from '@config/holdem';
import { NAME_ARENA_UPPER, NAME_FINANCE_UPPER } from '@/lib/vocab';
import { Mascot } from './Mascot';
import { PixelIcon } from './ui/PixelIcon';
import s from './AuthHero.module.css';

/**
 * Dải chữ chạy = SÁU TÀI SẢN CÓ THẬT TRONG GAME, lấy thẳng từ `TAI_SAN` (đúng tên,
 * đúng thứ tự). CHỈ tên, KHÔNG mũi tên/giá: chưa đăng nhập thì không có số thật, mà
 * bịa biến động thị trường là nói dối người dùng.
 *
 * ⚠ 24/09 — founder: chữ chạy "gây hiểu lầm quá". Bản cũ GÕ TAY CPI · XĂNG RON95 ·
 * VÀNG SJC · BTC · USD/VND · ĐIỂM CHUẨN ĐH · GIÁ iPHONE — chủ đề của chợ dự báo (ĐÓNG
 * BĂNG cả mùa 0.0, D86), không phải thứ người chơi cầm trong game; bộ tài sản đã đổi
 * ở D310 (08/09) mà dải này đứng yên. Lấy từ config thì đổi tài sản là tự theo.
 */
const TICKER = TAI_SAN.map((t) => t.label.toUpperCase());

function TickerRow() {
  return (
    <>
      {TICKER.map((t) => (
        <span key={t} className={s.tick}>
          <span className={s.tickDot} aria-hidden="true">
            ·
          </span>
          <span className={s.tickName}>{t}</span>
        </span>
      ))}
    </>
  );
}

export function AuthHero({ compact = false }: { compact?: boolean }) {
  return (
    <div className={s.hero}>
      <div className={s.logoRow}>
        <span className={s.logoChip}>
          <Mascot size={36} glow float title="Oracle — linh vật Dự báo" />
        </span>
        <span className={s.logoBig}>
          DELPHI<span className={s.logoSlash}>://</span>
          <span className={s.logoSub}>ORACLE</span>
        </span>
        <span className={s.live} aria-hidden="true">
          <span className={s.liveDot} /> LIVE
        </span>
      </div>

      <div className={s.promptLine}>
        {/*
          Dòng khước từ (founder 07/09) — nhại đúng câu ghi trên hộp thực phẩm
          chức năng. ⚠ Nó THAY câu "token ảo" ở đây; câu khước từ THẬT vẫn phải
          còn đường sống: thẻ meta + manifest PWA + `/dieu-khoan` (A10).
        */}
        <span className={s.promptUser}>sys@delphi:~$</span> Sản phẩm này không phải là thuốc
        · không có giá trị thay thế thuốc chữa bệnh
        <span className={s.cursor} aria-hidden="true" />
      </div>

      <div className={s.ticker} aria-hidden="true">
        <div className={s.tickerInner}>
          <TickerRow />
          {/* bản sao cho vòng lặp marquee — ẩn khi reduced-motion (CSS) */}
          <span className={s.tickerDup}>
            <TickerRow />
          </span>
        </div>
      </div>

      {!compact && (
        <div className={s.pillars}>
          {/*
            ⚠ 04/08 — GỠ NHÃN "SẮP RA MẮT". Vòng chơi lõi đã chạy thật trên prod
            từ lâu (137 trận), nên để nguyên nhãn cũ là màn đầu tiên người lạ nhìn
            thấy nói dối về chính thứ họ sắp chơi — và đó là màn quyết định họ có
            ở lại hay không.
          */}
          <div className={`${s.pillar} ${s.pillarViolet}`}>
            <PixelIcon name="arena" size={32} />
            <span className={s.pillarLabel}>{NAME_ARENA_UPPER}</span>
            <span className={s.moiRa}>CHƠI ĐƯỢC NGAY</span>
          </div>
          <div className={`${s.pillar} ${s.pillarGreen}`}>
            <PixelIcon name="candle" size={32} />
            <span className={s.pillarLabel}>{NAME_FINANCE_UPPER}</span>
          </div>
          <div className={`${s.pillar} ${s.pillarCyan}`}>
            <div className={s.bars} aria-hidden="true">
              <span className={s.bar} style={{ height: 10 }} />
              <span className={`${s.bar} ${s.barWin}`} style={{ height: 22 }} />
              <span className={s.bar} style={{ height: 15 }} />
            </div>
            <span className={s.pillarLabel}>DỰ BÁO · ĂN POOL</span>
          </div>
        </div>
      )}
    </div>
  );
}
