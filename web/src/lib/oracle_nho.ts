/**
 * ORACLE NHỚ — trạng thái thu/mở, câu đã đọc, và VỊ TRÍ chat head.
 *
 * Vì sao cần: bong bóng chat mà cứ tự bung lại mỗi lần đổi trang thì nó là một
 * cái pop-up, không phải trợ lý — và người ta sẽ tìm cách tắt vĩnh viễn. Nhớ
 * lựa chọn là cách duy nhất để "đừng cứng" (founder 22/08) là thật.
 * Từ 23/08 nhớ thêm CHỖ ĐỨNG: founder kéo thử và không kéo được (*"delphi mang
 * tiếng là bong bóng chat mà t ko di chuyển được là sao"*) — kéo được mà quên
 * chỗ vừa đặt thì vẫn là nửa vời.
 *
 * ⚠ localStorage, KHÔNG server: đây là sở thích hiển thị của MỘT máy, không phải
 * dữ liệu hành vi (A9 — máy người chơi là hộp thư đi, không phải kho). Mất thì
 * mở lại như lần đầu, không ai thiệt gì.
 * ⚠ Lưu CÂU ĐÃ ĐỌC chứ không lưu "đã đọc hôm nay": câu đổi theo hồ sơ chứ không
 * chỉ theo ngày (chơi thêm 4 trận là câu giục đổi số) — neo theo ngày thì người
 * chơi bỏ lỡ đúng lúc có gì đó mới để nói.
 * ⚠ Lưu Y theo TỶ LỆ (0..1) chứ không theo pixel: đổi máy / xoay ngang thì một
 * số pixel tuyệt đối có thể rơi ra ngoài màn, còn tỷ lệ thì luôn nằm trong.
 */
const KEY = 'delphi.oracle';

export type CanhOracle = 'trai' | 'phai';

export interface TrangThaiOracle {
  /** Bong bóng đang mở hay đã thu về chat head. Lần đầu (chưa có gì) = MỞ. */
  mo: boolean;
  /** Câu người chơi đã đọc hết — câu khác câu này ⇒ hiện chấm báo. */
  cau_da_doc: string;
  /** Bám mép trái hay phải (chat head luôn snap về một cạnh, như Messenger). */
  canh: CanhOracle;
  /** Vị trí dọc theo TỶ LỆ chiều cao khả dụng, 0 = trên cùng, 1 = sát đáy. */
  y: number;
}

const MAC_DINH: TrangThaiOracle = { mo: true, cau_da_doc: '', canh: 'phai', y: 0.82 };

const kep01 = (x: number): number => Math.min(1, Math.max(0, x));

export function docTrangThaiOracle(): TrangThaiOracle {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return MAC_DINH;
    const o = JSON.parse(raw) as Partial<TrangThaiOracle>;
    return {
      mo: typeof o.mo === 'boolean' ? o.mo : MAC_DINH.mo,
      cau_da_doc: typeof o.cau_da_doc === 'string' ? o.cau_da_doc : '',
      canh: o.canh === 'trai' ? 'trai' : 'phai',
      y: typeof o.y === 'number' && Number.isFinite(o.y) ? kep01(o.y) : MAC_DINH.y,
    };
  } catch {
    return MAC_DINH;
  }
}

function ghi(sua: Partial<TrangThaiOracle>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...docTrangThaiOracle(), ...sua }));
  } catch {
    /* private mode — thôi cũng được */
  }
}

export const ghiMoOracle = (mo: boolean): void => ghi({ mo });
export const ghiCauDaDoc = (cau: string): void => ghi({ cau_da_doc: cau });
export const ghiViTriOracle = (canh: CanhOracle, y: number): void => ghi({ canh, y: kep01(y) });

/* ══════════════════════════════════════════════════════════════════════════
 * LUẬT KÉO — thuần, test được không cần DOM
 * ══════════════════════════════════════════════════════════════════════════ */

/** Kéo quá ngần này pixel thì tính là KÉO, dưới thì là CHẠM (mở bong bóng). */
export const NGUONG_KEO_PX = 6;

/**
 * Thả tay ở đâu thì bám cạnh nào + đứng cao bao nhiêu.
 * Snap theo TÂM của chat head so với giữa màn — như Messenger: không bao giờ để
 * bong bóng lửng lơ giữa màn che mất nội dung.
 */
export function snapViTri(
  x: number, y: number,
  man: { w: number; h: number },
  head = 44,
  le = { tren: 56, duoi: 70 },
): { canh: CanhOracle; y: number } {
  const tamX = x + head / 2;
  const canh: CanhOracle = tamX < man.w / 2 ? 'trai' : 'phai';
  // Vùng đứng được: từ dưới header tới trên thanh nav.
  const cao = Math.max(1, man.h - le.tren - le.duoi - head);
  return { canh, y: kep01((y - le.tren) / cao) };
}

/** Tỷ lệ y → pixel `bottom`, luôn nằm trong vùng đứng được. */
export function bottomTuY(y: number, man: { h: number }, head = 44,
  le = { tren: 56, duoi: 70 }): number {
  const cao = Math.max(1, man.h - le.tren - le.duoi - head);
  return le.duoi + Math.round((1 - kep01(y)) * cao);
}
