/**
 * CỌC CHIP TRÊN LÁ — phần bạn đang giữ ở mã này, vẽ bằng chip xếp cột ngay
 * trên lá chợ (thiết kế 07 §2/§4, founder chốt 16/08: *"chốt cái chợ này, làm y
 * nguyên"*).
 *
 * Trước đây "đang giữ bao nhiêu" nằm ở kho DANH MỤC dưới đáy shop, tách khỏi lá
 * mà người chơi đang nhìn — muốn biết mình đang cầm BTC bao nhiêu thì phải cuộn
 * xuống đọc một ô chữ. Cọc đặt NGAY TRÊN LÁ nên chợ đọc như một bàn cược: lá nào
 * có cọc là mình đang ở đó, cọc màu gì là trạng thái gì.
 *
 * ─── BỐN MÀU, MỘT NGHĨA MỖI MÀU ─────────────────────────────────────────────
 *   xám  = đang GIỮ (server đã ghi)      xanh = MUA đang xếp, chưa chốt (mọi cỡ, kể cả ALL-IN — D435)
 *   đỏ   = KHỐNG (cọc ký quỹ)             tím  = Đòn Bẩy đang nhắm (cọc riêng)
 * ⚠ D435 — cọc ALL-IN thôi tô VÀNG: vàng đọc ra "tiền còn trong tay" (founder 27/09, ảnh ví 1.330 → 0 mà lá Trái phiếu
 *   vẫn một cọc vàng cao). ALL-IN chỉ còn là hiệu ứng của NÚT (22/08) và chữ trong hàng lệnh.
 * Chip đang xếp ĐỨNG TRÊN chip đang giữ trong cùng cột — thứ tự đó là câu
 * chuyện: cái đã có ở dưới, cái sắp có ở trên.
 *
 * ─── ĐƠN VỊ CHIP = ¼ VỐN KHỞI ĐIỂM (`START_VON / 4`) ────────────────────────
 * D435 — chip MUA đang xếp đếm theo TIỀN của lệnh (`choTien`, bản nháp server), CÙNG đơn vị với cọc đang giữ
 * (`chipTuTien`). Bản trước xếp theo MỐC (25% = 1 chip, ALL-IN = 4 chip, "không cần biết ví") nên ALL-IN 1.326
 * cao ngang ALL-IN 10.000. Vắng `choTien` (bản nháp chưa có) ⇒ về mốc như cũ. Chip đang giữ = giá trị vị thế / đơn vị (làm tròn, tối
 * thiểu 1). Hình chỉ để ĐỌC NHANH; con số thật vẫn ở dòng giá trị và ở DANH MỤC
 * SAU LỆNH (server tính, C4). Trần 8 chip mỗi cột — cọc cao hơn thì đọc số.
 *
 * ⚠ KHÔNG phải <button>: cọc nằm TRONG nút lá (GameCard là một <button>), mà
 * button lồng button là HTML không hợp lệ. Dùng span role=button + Enter/Space,
 * và `stopPropagation` để chạm cọc không thành chạm lá.
 */
import type { KeyboardEvent, MouseEvent } from 'react';
import s from './CocChip.module.css';

export interface LenhCoc { chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }

/** Số chip mỗi cột, trần 8. Xuất riêng để test khoá phép đếm. */
export const TRAN_CHIP = 8;
export function demChip(giaTri: number, donVi: number): number {
  if (giaTri <= 0 || donVi <= 0) return 0;
  return Math.min(TRAN_CHIP, Math.max(1, Math.round(giaTri / donVi)));
}
/**
 * ⭐⭐ CHIP CỦA MỘT LỆNH — DÀY 25% + MẢNH 5% (D184).
 *
 * ⚠⚠ BẢN CŨ LÀM TRÒN THÔ VÀ NUỐT MẤT THÔNG TIN: `round(mocBp / 2500)` cho đặt
 * 25% và đặt 35% ra **y hệt 1 chip**, đặt 15% cũng 1 chip. Người chơi không đọc
 * được lệnh của chính mình từ cọc, càng không đọc được của đối thủ — tức cọc
 * chip không phải ngôn ngữ, nó là một cái nhãn làm tròn.
 *
 * ⭐ Và điều đó XOÁ SẠCH thứ duy nhất phân biệt lõi CHIA LỆNH trên bàn: đặc
 * quyền của lá đó (28/07) là hạ bước mốc **2500 → 500**, tức mở 20 nấc thay vì
 * 4 (`buocMocCua` trong `server/holdem/nav.ts`, server validate đúng thế). Bước
 * mịn đã chạy từ lâu, chỉ có CHIP là chưa bao giờ vẽ ra nó.
 *
 * ⇒ Một lệnh nay tách hai phần: phần chia hết cho 25% ra chip **DÀY**, phần dư
 * ra chip **MẢNH** (mỗi mảnh 5%). Người không có Chia Lệnh chỉ đặt được bội
 * 25% ⇒ **không bao giờ có mảnh** — nên nhìn cọc có lát mỏng là biết đối thủ
 * cầm Chia Lệnh. Lõi lần đầu lộ ra Ở BÀN, không ở tờ giải thích.
 */
export interface ChipLenh { day: number; manh: number }
export const BP_CHIP_DAY = 2500;
export const BP_CHIP_MANH = 500;
export function chipTuMoc(mocBp: number): ChipLenh {
  if (mocBp <= 0) return { day: 0, manh: 0 };
  const day = Math.floor(mocBp / BP_CHIP_DAY);
  const manh = Math.round((mocBp % BP_CHIP_DAY) / BP_CHIP_MANH);
  // Mốc nhỏ hơn một mảnh vẫn phải hiện — lệnh có thật thì cọc phải nói.
  return day + manh === 0 ? { day: 0, manh: 1 } : { day, manh };
}
/**
 * ⭐ D435 — CHIP CỦA TIỀN ĐANG XẾP MUA, đếm theo TIỀN: dày = một đơn vị (`donVi`), mảnh = 1/5 đơn vị (cùng tỷ lệ
 * dày/mảnh với `chipTuMoc`). Lệnh có thật thì ít nhất một mảnh. Founder 27/09: *"chip vàng đây này trong khi đã tiêu
 * hết tiền?"* — cọc đang xếp phải nói ĐÚNG số tiền sắp vào mã, không phải phần trăm của một cái ví gần rỗng.
 */
export function chipTuTien(tien: number, donVi: number): ChipLenh {
  if (tien <= 0 || donVi <= 0) return { day: 0, manh: 0 };
  let day = Math.floor(tien / donVi);
  let manh = Math.round((tien - day * donVi) / (donVi / 5));
  if (manh >= 5) { day += 1; manh -= 5; }
  return day + manh === 0 ? { day: 0, manh: 1 } : { day, manh };
}
/** @deprecated Giữ cho bài test cũ; đường sống là `chipTuMoc`. */
export const chipTheoMoc = (mocBp: number): number => {
  const c = chipTuMoc(mocBp);
  return Math.max(1, c.day + (c.manh > 0 ? 1 : 0));
};

export function CocChip({ giu, khong, cho, choTien, donVi, donBay, onCham, vohieu }: {
  /** Giá trị vị thế đang giữ (server). */
  giu: number;
  /**
   * D435 — tổng TIỀN các lệnh MUA đang xếp ở mã này, từ bản nháp server (`xemTruocLenh`). Có ⇒ cọc chờ đếm theo tiền
   * (`chipTuTien`); vắng ⇒ theo mốc như cũ.
   */
  choTien?: number | undefined;
  /** Cọc khống đang mở (server). */
  khong: number;
  /** Lệnh đang xếp cho ĐÚNG mã này. */
  cho: LenhCoc[];
  donVi: number;
  /**
   * ⭐ ĐÒN BẨY ĐANG NHẮM MÃ NÀY ⇒ mọc thêm MỘT CỌC TÍM RIÊNG bên cạnh (founder
   * 24/08, chọn phương án "thêm cọc tím RIÊNG" thay vì nhân đôi cọc thật).
   *
   * ⚠⚠ VÌ SAO KHÔNG NHÂN ĐÔI CỌC THẬT — engine KHÔNG nhân vị thế. `engine.ts`
   * nhân phần LÃI/LỖ bp (`pnl * 2`), rồi `nav.ts` rải khoản đó ĐỀU cho mọi mã
   * đang giữ. Tức mã bị nhắm không hề lớn gấp đôi và cũng không nở nhanh hơn mã
   * khác — vẽ cọc gấp đôi là dạy người chơi một điều SAI về tài sản của họ, đúng
   * thứ D28 cấm. Cọc RIÊNG đọc ra "thêm SỨC NẶNG", không phải "thêm TÀI SẢN".
   * ⚠ Và nó tránh luôn trần `TRAN_CHIP`: nhân đôi một cọc 4 chip là chạm trần 8
   * rồi phần "gấp đôi" bị cắt cụt IM LẶNG ở đúng người ôm nặng nhất.
   */
  donBay?: boolean;
  /** Chạm cọc = lật hàng chip sang mặt RÚT cho mã này. */
  onCham?: () => void;
  vohieu?: boolean;
}) {
  let mua = 0; let muaM = 0; let ban = 0; let kh = 0; let khM = 0;
  for (const l of cho) {
    const c = chipTuMoc(l.moc_bp);
    if (l.chieu === 'mua') { mua += c.day; muaM += c.manh; }
    else if (l.chieu === 'ban') ban += c.day + (c.manh > 0 ? 1 : 0);
    else if (l.chieu === 'khong') { kh += c.day; khM += c.manh; }
  }
  if (choTien !== undefined && cho.some((l) => l.chieu === 'mua')) {
    const t = chipTuTien(choTien, donVi);
    mua = t.day; muaM = t.manh;
  }
  const nGiu = Math.max(0, demChip(giu, donVi) - ban);
  const nCho = Math.min(TRAN_CHIP, mua);
  const nChoM = Math.min(TRAN_CHIP, muaM);
  const nKh = Math.min(TRAN_CHIP, demChip(khong, donVi) + kh);
  const nKhM = Math.min(TRAN_CHIP, khM);
  /*
   * CỌC TÍM = phần khuếch đại, cao BẰNG phần đang phơi ra ở mã này (giữ + đang
   * xếp + khống). Nó không cộng vào cọc thật, nó ĐỨNG CẠNH — xem docstring
   * `donBay` để biết vì sao không nhân đôi cọc thật.
   */
  const nNhan = donBay ? Math.min(TRAN_CHIP, nGiu + nCho + nKh) : 0;
  if (nGiu + nCho + nKh + nChoM + nKhM === 0) return null;

  const bamDuoc = !!onCham && giu > 0 && !vohieu;
  const cham = (e: MouseEvent | KeyboardEvent) => {
    if (!bamDuoc) return;
    e.stopPropagation();
    e.preventDefault();
    onCham?.();
  };
  return (
    <span
      className={s.coc}
      data-coc
      role={bamDuoc ? 'button' : undefined}
      tabIndex={bamDuoc ? 0 : undefined}
      aria-label={bamDuoc ? 'Cọc của bạn — chạm để rút bớt' : undefined}
      title={bamDuoc ? 'cọc của bạn — chạm để rút' : undefined}
      onClick={cham}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') cham(e); }}
    >
      {(nGiu > 0 || nCho > 0 || nChoM > 0) && (
        <span className={s.cot}>
          {Array.from({ length: nGiu }, (_, i) => <i key={`g${i}`} className={s.chip} />)}
          {Array.from({ length: nCho }, (_, i) => (
            <i key={`c${i}`} className={`${s.chip} ${s.cho}`} />
          ))}
          {/* MẢNH đứng TRÊN CÙNG cọc: phần lẻ là thứ vừa thêm vào, và để mắt
              bắt được ngay "cọc này có lát mỏng" mà không phải đếm. */}
          {Array.from({ length: nChoM }, (_, i) => (
            <i key={`cm${i}`} className={`${s.chip} ${s.manh} ${s.cho}`} />
          ))}
        </span>
      )}
      {(nKh > 0 || nKhM > 0) && (
        <span className={s.cot}>
          {Array.from({ length: nKh }, (_, i) => <i key={`k${i}`} className={`${s.chip} ${s.khg}`} />)}
          {Array.from({ length: nKhM }, (_, i) => (
            <i key={`km${i}`} className={`${s.chip} ${s.manh} ${s.khg}`} />
          ))}
        </span>
      )}
      {/*
        CỌC TÍM — phần Đòn Bẩy khuếch đại. Đứng RIÊNG, sau cùng, và hơi tách ra
        (`.cotNhan`) để mắt đọc nó là "thêm một thứ khác", không phải "cọc kia
        cao hơn". Nhãn `title` nói LÃI/LỖ ×2 chứ không nói tài sản ×2 — engine
        nhân phần lãi/lỗ, không nhân vị thế.
      */}
      {nNhan > 0 && (
        <span className={`${s.cot} ${s.cotNhan}`} title="Đòn Bẩy đang nhắm — lãi/lỗ của mã này ×2">
          {Array.from({ length: nNhan }, (_, i) => (
            <i key={`n${i}`} className={`${s.chip} ${s.nhan}`} />
          ))}
        </span>
      )}
    </span>
  );
}
