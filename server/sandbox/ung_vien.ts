/**
 * ỨNG VIÊN CỦA MỘT LƯỢT MỞ HỘP — hàm THUẦN, không chạm DB.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VÌ SAO TÁCH RA KHỎI `server/shop.ts`
 *
 * Bản trước là một closure 4 dòng nằm giữa route (`shop.ts:301`), và nó lọc theo
 * ĐÚNG MỘT THỨ: tồn kho TOÀN HỆ. Không có `user_id` ở bất kỳ đâu trong đó.
 *
 * Điều đó đúng chừng nào hộp chỉ rơi NHÃN DÁN — nhãn dán là vật tiêu hao (D36),
 * bản thứ hai là +1 vào kho, nên "đã có rồi" không phải một trạng thái. Từ 04/08
 * hộp rơi thêm HAI LÁ NỀN `doc_ban` (mỗi người đúng một bản), và lúc đó "đã có
 * rồi" thành trạng thái thật — mà một closure không biết người chơi là ai thì
 * không thể biết điều đó.
 *
 * Tách ra file riêng vì hai lý do, lý do thứ hai mới là lý do cứng:
 *   1. Test được mà không cần dựng Postgres — luật lọc là chỗ dễ sai nhất.
 *   2. ⚠ Bậc `epic` sau 04/08 chỉ còn ĐÚNG MỘT món, và nó là `doc_ban`. Nghĩa là
 *      với người đã có nó, cửa `epic` RỖNG THẬT — không phải hiếm, là không tồn
 *      tại. Một closure ẩn trong route sẽ để `haBac()` lặng lẽ hạ bậc và màn vẫn
 *      dán "5%", tức app nói dối đúng chỗ người chơi vừa trả tiền. Muốn nói thật
 *      thì catalog phải tính được tỷ lệ THEO NGƯỜI, mà muốn vậy thì phép lọc phải
 *      gọi được từ ngoài route.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { AVATAR_NEN, NHAN_DAN, type Hiem } from '../../config/avatar.js';

/** Một món có thể rơi ra từ hộp — hợp nhất hai họ vốn nằm ở hai bảng khác nhau. */
export interface MonTrongHop {
  readonly id: string;
  readonly ten: string;
  readonly hiem: Hiem;
  /**
   * Quyết định ĐƯỜNG CẤP PHÁT, không phải nhãn hiển thị:
   *   `sticker` → `capMonHuuHan` → bảng `kho_sticker` (cộng dồn được)
   *   `nen`     → `taoAvatarNen` → bảng `avatar_so_huu` (một dòng một tấm)
   */
  readonly loai: 'sticker' | 'nen';
  /** Mã nền (A|B|…) — CHỈ món `nen` có; `taoAvatarNen` nhận mã chứ không nhận id. */
  readonly ma: string | null;
  /** Mỗi người đúng MỘT bản (founder 04/08). Sticker luôn `false`. */
  readonly docBan: boolean;
}

/**
 * BẢNG RƠI CỦA HỘP — nguồn chân lý DUY NHẤT cho câu hỏi "hộp có thể trả ra gì".
 *
 * ⚠ KHÔNG PHẢI `NHAN_DAN`, và khoảng cách giữa hai thứ là chỗ đã hỏng một lần:
 *   · `NHAN_DAN` là DANH MỤC nhãn dán (còn dùng cho kho, cho chuỗi diện mạo,
 *     cho catalog admin) — `st_niem_beta` vẫn Ở LẠI đó vì nó vẫn là một món có
 *     thật, người ta vẫn sở hữu và vẫn dán được.
 *   · `HOP_GACHA` là thứ BỐC RA ĐƯỢC. `st_niem_beta` rời khỏi đây vì từ 04/08 nó
 *     là QUÀ BETA, không bán không quay (D68b).
 * Gộp hai khái niệm vào một mảng là lý do bản trước không gỡ nổi một món khỏi hộp
 * mà không xoá nó khỏi cả hệ.
 */
export const HOP_GACHA: readonly MonTrongHop[] = [
  ...NHAN_DAN
    .filter((n) => n.nguon === 'gacha_t' && n.id !== 'st_niem_beta')
    .map((n) => ({
      id: n.id, ten: n.ten, hiem: n.hiem,
      loai: 'sticker' as const, ma: null, docBan: false,
    })),
  ...AVATAR_NEN
    .filter((n) => n.nguon === 'gacha_t' && n.hiem !== undefined)
    .map((n) => ({
      id: n.id, ten: n.ten, hiem: n.hiem!,
      loai: 'nen' as const, ma: n.ma, docBan: n.doc_ban === true,
    })),
];

/** Tồn kho toàn hệ của một món — đúng hình dạng `docTonKho` trả về. */
export interface TonKhoMon {
  readonly conLai: number | null;
  readonly song: boolean;
}

export interface BoiCanhUngVien {
  /** Tồn kho TOÀN HỆ theo id. Vắng mặt = chưa có hàng trong `cosmetic_items`. */
  readonly ton: ReadonlyMap<string, TonKhoMon>;
  /** Mã nền người này ĐÃ sở hữu (A|B|…). Chỉ dùng để chặn món `docBan`. */
  readonly nenDaCo: ReadonlySet<string>;
}

/**
 * Món này có trao được cho NGƯỜI NÀY ngay bây giờ không.
 *
 * Ba cửa, và cửa thứ ba là cửa mới của 04/08:
 *   1. còn "sống" (chưa bị ẩn bằng công tắc vận hành);
 *   2. còn hàng trong tổng số bản phát hành (`null` = không giới hạn);
 *   3. nếu `docBan` — người này CHƯA có.
 *
 * ⚠ Món chưa có hàng trong `cosmetic_items` (`ton` không có khoá) được coi là
 * CÒN SỐNG, KHÔNG GIỚI HẠN. Đó là lựa chọn có chủ đích: catalog nằm ở
 * `config/avatar.ts`, DB chỉ là nơi gắn công tắc + giới hạn. Coi "vắng mặt" là
 * "hết hàng" nghĩa là thêm một món mới vào config sẽ IM LẶNG không rơi cho tới
 * khi ai đó nhớ chạy migration — đúng lớp lỗi mà chính hai lá trader vừa dính.
 */
export function traoDuoc(m: MonTrongHop, bc: BoiCanhUngVien): boolean {
  const t = bc.ton.get(m.id);
  if (t?.song === false) return false;
  if (t && t.conLai !== null && t.conLai <= 0) return false;
  if (m.docBan && m.ma !== null && bc.nenDaCo.has(m.ma)) return false;
  return true;
}

/** Ứng viên của MỘT bậc, dành riêng cho người này. */
export function ungVienBac(bac: Hiem, bc: BoiCanhUngVien): MonTrongHop[] {
  return HOP_GACHA.filter((m) => m.hiem === bac && traoDuoc(m, bc));
}

export const BAC_TAT_CA: readonly Hiem[] = ['thuong', 'hiem', 'epic'];

/** Hộp có trao được BẤT KỲ thứ gì cho người này không (chặn trước khi chạm ví). */
export function conMonNao(bc: BoiCanhUngVien): boolean {
  return HOP_GACHA.some((m) => traoDuoc(m, bc));
}

/**
 * Bậc nào còn hàng RIÊNG cho người này — để catalog nói thật.
 *
 * Màn dán 70/25/5 là một lời hứa. Với người đã có lá `epic` duy nhất thì lời hứa
 * đó sai 5 điểm phần trăm, và họ là người duy nhất không kiểm chứng được. Trả
 * bảng này ra để màn ghi "cửa này với bạn đã hết" thay vì im lặng.
 */
export function bacConHang(bc: BoiCanhUngVien): Record<Hiem, boolean> {
  return {
    thuong: ungVienBac('thuong', bc).length > 0,
    hiem: ungVienBac('hiem', bc).length > 0,
    epic: ungVienBac('epic', bc).length > 0,
  };
}
