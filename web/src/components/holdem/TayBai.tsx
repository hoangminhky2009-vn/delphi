/**
 * TAY — DANH MỤC + LÕI ĐANG CẦM, ghim đáy màn trận (D184).
 *
 * Founder 30/08: *"Phần nút 'chốt vòng' 'bỏ bài' và 'shop' đã lỗi thời. Giờ dùng
 * phần diện tích được dọn dẹp mới để thiết kế 1 cái như kiểu 'danh mục/ bài đang
 * cầm trên tay' của player để thao tác nhanh … và khi bấm vào phần shop thì mới
 * mở rộng ra thành shop chi tiết."*
 *
 * ─── VÌ SAO KHỐI NÀY THAY ĐƯỢC BỐN THỨ CÙNG LÚC ────────────────────────────
 * Bốn khối bị gỡ đều trả lời một mảnh của cùng MỘT câu hỏi — *"tôi đang đứng ở
 * đâu"* — nhưng mỗi khối trả lời ở một chỗ khác nhau trên màn, bằng một đơn vị
 * khác nhau:
 *   · LĂNG KÍNH        → phân bổ, dạng % của ba nhóm;
 *   · DANH MỤC ±%      → tổng cả trận, dạng %;
 *   · dòng chữ mời chốt → hướng dẫn, dạng câu;
 *   · ba nút hành động  → thao tác, tách rời khỏi thứ chúng thao tác lên.
 * Gom lại: **thấy mình đang cầm gì, ngay cạnh nút bấm lên chính thứ đó.**
 *
 * ─── D443 (founder 28/09): THANH ĐÁY = VÙNG BẤM ─────────────────────────────
 * *"Những gì user ko thao tác được (Ngoại trừ avatar đối thủ) Thì hiện ở trên, những gì cần thao tác như bảng điện
 * tử thì hiện ở dưới."* Khối này nay chỉ chở thứ BẤM được: chip lãi suất · SỔ (+ ngăn kéo của chúng) · con số vòng
 * (cửa VÌ SAO) · SHOP · BẢNG ĐIỆN TỬ · CHỐT VÒNG · BỎ. Mã đang cầm (chỉ để xem) lên khung NAV (`HangMaCam`); hàng
 * LÕI gỡ khỏi màn chính (*"Bỏ cái phần hiển thị lõi ở màn hình chính"* — lõi vẫn xem ở SHOP).
 *
 * ⚠ LUẬT GIỮ:
 * · D443 — chữ và số đi CÙNG MỘT font của app (Handjet, tự host), không vẽ lại bằng `ChuPixel` cạnh chữ font:
 *   *"phải đồng bộ font chữ đi chứ bro. nhìn thiếu chuyên nghiệp quá"*. (Lý lẽ §XI cũ — "chữ do font hệ điều hành
 *   vẽ" — hết đúng từ D182: font app là font pixel tự host, không phải font hệ điều hành.)
 * · chữ ở CLIENT, server chỉ trả id + số (D26);
 * · chú thích lá = ĐẶC ĐIỂM NGOÀI ĐỜI, mô tả không kê đơn (D28 + A10) — khối
 *   này KHÔNG gợi ý nên mua gì, chỉ nói đang cầm gì.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { PixelIcon } from '../ui/PixelIcon';
import { rung, NHIP_RUNG } from '@/lib/rung';
import s from './TayBai.module.css';

export interface MaCam {
  ma: string;
  ten: string;
  /** Giá trị vị thế (để xếp thứ tự — nặng nhất đứng trước). */
  giaTri: number;
  /** Số chip DÀY của cọc (25% vốn mỗi chip). */
  chipDay: number;
  /** Số chip MẢNH (5%) — chỉ người cầm Chia Lệnh mới có. */
  chipManh: number;
  khong?: boolean;
}

/**
 * D443 — HÀNG MÃ ĐANG CẦM, đứng trong khung NAV (vùng XEM), không còn ở thanh đáy.
 *
 * Founder 28/09: *"Những gì user ko thao tác được (Ngoại trừ avatar đối thủ) Thì hiện ở trên, những gì cần thao tác
 * như bảng điện tử thì hiện ở dưới."* Cọc chip chỉ để xem ⇒ lên dưới NAV, cạnh con số mà nó cộng thành. Tổng tài sản
 * vẽ lần thứ hai ở đây (bằng bộ chữ pixel tự dựng, khác font cả màn) đã gỡ: NAV ngay trên nói đúng số ấy.
 *
 * ⚠ VÙNG LIVE ở hàng này (không remount mỗi vòng) — trình đọc màn hình nghe được mã vừa vào / ra tay.
 */
export function HangMaCam({ maCam }: { maCam: readonly MaCam[] }) {
  return (
    <div className={s.hangMa} role="status" data-tap="dang-cam">
      {maCam.length === 0 ? (
        <span className={s.trong}>CHƯA CẦM MÃ NÀO</span>
      ) : (
        <>
          <span className={s.nhanCam}>ĐANG CẦM</span>
          {maCam.map((m) => (
            <span
              key={m.ma}
              className={`${s.oMa} ${m.khong ? s.oMaKhong : ''}`}
              title={m.ten}
            >
              <span className={s.tenMa}>{m.ten}</span>
              <span className={s.coc} aria-hidden>
                {Array.from({ length: Math.min(4, m.chipDay) }, (_, i) => (
                  <i key={`d${i}`} className={`${s.chip} ${m.khong ? s.chipKhong : ''}`} />
                ))}
                {Array.from({ length: Math.min(4, m.chipManh) }, (_, i) => (
                  <i
                    key={`m${i}`}
                    className={`${s.chip} ${s.chipManhCss} ${m.khong ? s.chipKhong : ''}`}
                  />
                ))}
              </span>
            </span>
          ))}
        </>
      )}
    </div>
  );
}

/** D548 — nhãn CTA lúc chờ màn của bàn: tự đếm mỗi giây (không kéo cả thanh đáy vẽ lại). Hết giờ ⇒ "MỞ VÒNG SAU…" tới khi trạng thái mới về. */
function DemChoBan({ moc }: { moc: number }) {
  const [bay, setBay] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setBay(Date.now()), 1000); return () => clearInterval(t); }, []);
  const con = Math.ceil((moc - bay) / 1000);
  return <>{con > 0 ? `CHỜ BÀN · ${con}s` : 'MỞ VÒNG SAU…'}</>;
}

export function TayBai({
  congCu, ngan, nhipPhai, bang, thayHangNut, shopMo, onShop, soTheChon, chamMoi, chamMoiNhan,
  onChotVong, onBo, coBo = true, dangGui, vohieu, choDen,
}: {
  /** D443 — hàng CÔNG CỤ: chip lãi suất · SỔ (bấm để xem thêm) — dời từ đầu bản đồ xuống vùng bấm. */
  congCu?: ReactNode;
  /** D443 — NGĂN KÉO của hàng công cụ (bảng lãi suất / sổ liên hệ), mở ngay TRÊN hàng ấy, mỗi lúc một ngăn. */
  ngan?: ReactNode;
  /** Con số lãi/lỗ vòng — cửa DUY NHẤT tới bảng VÌ SAO (D119), phải có chỗ đứng. */
  nhipPhai?: ReactNode;
  /** D443 — nút BẢNG ĐIỆN TỬ (bản gọn, tự mang lớp phủ), đứng cạnh SHOP trong hàng nút. */
  bang?: ReactNode;
  /** D443 — thay CẢ hàng nút (tư thế ALL-IN: không còn nút nào để bấm, chỉ còn báo). Hàng công cụ vẫn đứng. */
  thayHangNut?: ReactNode;
  shopMo: boolean;
  onShop: () => void;
  /** Số lá đang chọn trong shop — hiện trên nút SHOP. */
  soTheChon: number;
  /** Chấm vàng thở trên SHOP — có quầy lõi / chợ trait chờ chọn mà chưa mở shop. */
  chamMoi?: boolean;
  chamMoiNhan?: string | undefined;
  onChotVong: () => void;
  onBo: () => void;
  /** v54 (D403) — trận không còn nước BỎ ⇒ gỡ nút. */
  coBo?: boolean;
  dangGui?: boolean;
  vohieu?: boolean;
  /**
   * D548 — đang chờ MÀN CỦA BÀN (đã chốt, không có màn riêng): mốc `Date.now()` lúc màn hết. Có mốc ⇒ CTA tắt và đếm "CHỜ BÀN · Ns".
   * Founder 07/10: *"Vào trận phát bấm chốt vòng luôn là bị"* kẹt — thật ra bàn chờ ~49 s rồi tự sang vòng, nhưng CTA vẫn sáng y như chưa chốt.
   */
  choDen?: number | undefined;
}) {
  return (
    <div className={s.tay} data-tap="tay">
      {ngan && <div className={s.ngan}>{ngan}</div>}

      {/* ── HÀNG 1 — CÔNG CỤ XEM THÊM (chip lãi suất · SỔ) + con số vòng (cửa VÌ SAO) ── */}
      <div className={s.hangCongCu}>
        {congCu}
        <span className={s.day} />
        {/*
          ⚠ VÙNG LIVE Ở ĐÂY, KHÔNG Ở CON SỐ. Con số nhịp vòng mang `key` theo vòng nên nó REMOUNT mỗi vòng, mà một
          vùng live vừa-sinh-vừa-có-ruột thì trình đọc màn hình xướng không đáng tin. Ô bọc này không remount ⇒ vùng
          có sẵn, ruột đổi. (Vai này từng rơi mất một lần khi thu gọn khối — D116; D443 dời nó cùng con số.)
        */}
        <span className={s.oKetQua} role="status">{nhipPhai}</span>
      </div>

      {/* ── HÀNG 2 — HÀNH ĐỘNG ── */}
      {thayHangNut ?? (
      <div className={s.hangNut}>
        <button
          type="button"
          className={s.nutShop}
          data-tap="nut-shop"
          onClick={onShop}
          aria-expanded={shopMo}
          aria-label={shopMo ? 'Cất shop' : 'Mở shop chi tiết'}
        >
          <PixelIcon name="shop" size={16} />
          <span className={s.nutChu}>{shopMo ? 'CẤT' : 'SHOP'}</span>
          {soTheChon > 0 && <span className={s.dem}>{soTheChon}</span>}
          {chamMoi && soTheChon === 0 && (
            <span className={s.cham} aria-label={chamMoiNhan ?? 'Có lõi chiến thuật chờ chọn'} />
          )}
        </button>

        {bang}

        <button
          type="button"
          className={s.nutChot}
          disabled={vohieu || choDen !== undefined}
          {...(choDen !== undefined ? { 'data-cho': '1' } : {})}
          /*
           * ⭐ RUNG NẶNG (31/08) — trả nợ một docstring. `NHIP_RUNG.nang` tự khai
           * là dành cho *"ALL-IN, chốt vòng"*, nhưng tới hôm nay chỉ ALL-IN gọi
           * nó (`HangChip.tsx:175`); CHỐT VÒNG — nước đi NẶNG NHẤT của vòng, cú
           * bấm khoá lại mọi lệnh — thì không có phản hồi xúc giác nào.
           * ⚠ Đây là món CỘNG THÊM (iOS Safari không có `vibrate`): cú lún của
           * `.nutChot` vẫn là kênh chính, không được bỏ.
           */
          onClick={() => { rung(NHIP_RUNG.nang); onChotVong(); }}
        >
          <span className={s.chotChu}>{choDen !== undefined ? <DemChoBan moc={choDen} /> : dangGui ? 'ĐANG GỬI…' : 'CHỐT VÒNG'}</span>
        </button>

        {coBo && (
          <button
            type="button"
            className={s.nutBo}
            disabled={vohieu}
            onClick={onBo}
            /* Tên phải BẮT ĐẦU bằng "BỎ": bài canh sheet-phá-cam-kết tìm nút theo
               `/^BỎ/`, và đó là tên người chơi nghe được. */
            aria-label="BỎ — giữ vốn còn lại"
          >
            BỎ
          </button>
        )}
      </div>
      )}
    </div>
  );
}
