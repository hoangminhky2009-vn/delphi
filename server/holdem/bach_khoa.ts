/**
 * BÁCH KHOA — phần LUẬT mà trang bách khoa ở client cần nhưng catalog chưa phát.
 *
 * Founder 14/09: bách khoa giải thích cơ chế trong game bằng định nghĩa ngoài đời, cho người
 * muốn chơi kỹ hoặc không muốn mày mò. Chữ nằm ở client (D26); file này chỉ phát ID + MỨC.
 *
 * ─── HAI THỨ, CẢ HAI SUY TỪ BỘ LUẬT ĐANG PHỤC VỤ ─────────────────────────────────
 * · `bien_dong_hang` — hạng ồn của sáu mã theo biên nhiễu HIỆU DỤNG (`bienDongCua`, có lớp
 *   v44/v45). Catalog đã có `tai_san[].bien_dong_bp` nhưng đó là trường GỐC dùng chung mọi phiên
 *   bản: đọc thẳng nó ở v45 thì vàng ồn hơn VN30 — đúng cái sai mà D318 vừa sửa.
 * · `the_tin` — với mỗi mặt tin CÒN SỐNG ở bộ luật này: tính chất nền · pha nó báo trước · những
 *   mặt nó hay kéo theo · độ hay bị làm giả. Toàn là LUẬT CHƠI (tu_dien.ts: "biết BTC ăn đòn ở
 *   giai đoạn Giảm là nội dung app muốn DẠY"), không có trạng thái ván nào.
 *
 * ⚠ MỨC, KHÔNG PHẢI SỐ (founder 25/07, `DAI_DINH_TINH`): không một bp, trọng số hay hệ số nhân
 * nào rời server. Kéo theo chỉ nói "hay đi cùng", độ giả chỉ nói năm bậc chữ. Bài canh:
 * `tests/bach_khoa.test.ts` §II quét payload tìm số.
 * ⚠ Mức phản ứng của từng mã khi tin nổ KHÔNG ở đây — nó đã có ở `tu_dien.tai_san[].su_kien`,
 * cùng thang với tờ (!) trong trận. Phát lại ở đây là bản sao thứ hai (A11.5).
 */
import {
  MAP_V28, SU_KIEN, TAI_SAN, TINH_CHAT_NEN, bienDongCua, luatCua, mtKeTiep,
  type SuKienId, type TinhChatO, DONG_HO_MINIGAME,
} from '../../config/holdem.js';
import { KY_QUY, MUC_DON_BAY, NAP_TY_LE, PHI_BAN_BP, PHI_GAI_BP, TO_CHUC_V57, TRAIT_MAN } from '../../config/minigame.js';
import { RAI_LENH_NEN } from '../../config/trait.js';

/**
 * D495 — số của MÀN LÕI cho bách khoa (`%{mg.…}`): đọc thẳng `config/minigame.ts` — một nguồn với khớp lệnh (A11.5). Phát vô điều kiện: đây là hằng
 * của khung minigame, không phụ thuộc bộ luật mặc định (bộ mặc định hôm nay chưa có màn lõi — mục bách khoa nói rõ "trận có màn lõi").
 */
export interface MinigameBK {
  chay_s: number; muc_don_bay: readonly number[]; goi_bp: number; thanh_ly_bp: number; nap_bp: number; phi_ban_bp: number;
  kien_nhan_s: number; nong_voi_s: number; phi_gai_bp: number;
  /** D501 — Tổ Chức: trần thua (bp vốn màn) · phí quản lý (bp NAV) · trượt khớp thỏa thuận (hệ số) · Rải lệnh (số nến các cấp). */
  to_chuc_tran_bp: number; phi_ql_bp: number; thoa_thuan: number; rai_nen: readonly number[];
}
export function soMinigameBK(): MinigameBK {
  return {
    chay_s: DONG_HO_MINIGAME.CHAY_S, muc_don_bay: [...MUC_DON_BAY], goi_bp: KY_QUY.GOI * 10000, thanh_ly_bp: KY_QUY.THANH_LY * 10000,
    nap_bp: NAP_TY_LE * 10000, phi_ban_bp: PHI_BAN_BP, kien_nhan_s: TRAIT_MAN.KIEN_NHAN_KHOA_S, nong_voi_s: TRAIT_MAN.NONG_VOI_HAN_S, phi_gai_bp: PHI_GAI_BP,
    to_chuc_tran_bp: TO_CHUC_V57.TRAN_THUA_BP, phi_ql_bp: TO_CHUC_V57.PHI_QL_BP, thoa_thuan: TO_CHUC_V57.TRUOT_THOA_THUAN,
    rai_nen: Object.values(RAI_LENH_NEN).filter((x): x is number => typeof x === 'number').sort((a, b) => a - b),
  };
}

/** Năm bậc "hay bị làm giả" — chữ ở client. `theo_lai_suat`: Bong bóng giả nhiều hay ít tuỳ tiền rẻ/đắt. */
export type DoGiaBK = 'hiem' | 'it' | 'vua' | 'hoi_hay' | 'hay' | 'theo_lai_suat';

export interface TheTinBK {
  tinh_chat: TinhChatO;
  /** Pha ô KẾ mà tin THẬT làm nghiêng tới (`SU_KIEN.bao_truoc`). */
  bao_truoc: string;
  /** Mặt hay tới sau tin THẬT này, nặng nhất trước. Rỗng = không kéo mặt nào rõ rệt. */
  keo_theo: SuKienId[];
  do_gia: DoGiaBK;
}

export interface BachKhoaLuat {
  /** mã → hạng ồn (1 = ồn nhất). */
  bien_dong_hang: Record<string, number>;
  the_tin: Partial<Record<SuKienId, TheTinBK>>;
  /** D495 — số của màn lõi (`soMinigameBK`). */
  minigame: MinigameBK;
}

/**
 * Cạnh kéo theo đáng gọi tên khi phần CỘNG THÊM ít nhất bằng trọng số nền của một mặt (1.000) —
 * tức mặt đích dễ ra gấp đôi trở lên. Ngưỡng hiển thị, không phải tham số kinh tế: nó không đổi
 * một phép rút nào, chỉ quyết có in một cái tên hay không.
 */
const NGUONG_KEO_THEO = 1000;
/** Tối đa bao nhiêu tên — ba tên trở lên là danh sách, không còn là "hay kéo theo". */
const KEO_THEO_TOI_DA = 2;

/** Hệ số nhân tỷ lệ giả (bp) → bậc chữ. Vắng trong bảng = 10000 = mức chung. */
function bacGia(nhanBp: number): DoGiaBK {
  if (nhanBp <= 5000) return 'hiem';
  if (nhanBp < 10000) return 'it';
  if (nhanBp === 10000) return 'vua';
  if (nhanBp < 15000) return 'hoi_hay';
  return 'hay';
}

/** Mặt tin còn sống ở bộ luật: `duoi5` bật thì Thiên nga đen về 0, tắt thì năm mặt đuôi về 0 (map.ts). */
function matSong(duoi5: boolean): SuKienId[] {
  const duoi: readonly SuKienId[] = ['phap_ly', 'pha_san', 'cam_van', 'tham_hoa', 'dich_benh'];
  return SU_KIEN.map((x) => x.id)
    .filter((id) => (duoi5 ? id !== 'thien_nga_den' : !duoi.includes(id)));
}

export function dungBachKhoa(phienBan: string): BachKhoaLuat {
  const luat = luatCua(phienBan);

  const on = TAI_SAN.map((t) => ({ id: t.id, bd: bienDongCua(t, luat.betaTaiSanV2, luat.bienDongV45) }));
  const xep = [...on].sort((a, b) => b.bd - a.bd);
  const bien_dong_hang: Record<string, number> = {};
  xep.forEach((x, i) => { bien_dong_hang[x.id] = i + 1; });

  const song = matSong(luat.duoi5);
  const bangKeo = mtKeTiep(luat.chuoiMoRong);
  const the_tin: Partial<Record<SuKienId, TheTinBK>> = {};
  for (const id of song) {
    const sk = SU_KIEN.find((x) => x.id === id)!;
    const keo_theo = Object.entries(bangKeo[id] ?? {})
      .filter(([den, w]) => song.includes(den as SuKienId) && (w ?? 0) >= NGUONG_KEO_THEO)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, KEO_THEO_TOI_DA)
      .map(([den]) => den as SuKienId);
    const do_gia: DoGiaBK = !luat.mapV28 ? 'vua'
      : id === 'bong_bong' ? 'theo_lai_suat'
        : bacGia(MAP_V28.NHAN_TIN_GIA_SU_KIEN[id] ?? 10000);
    the_tin[id] = { tinh_chat: TINH_CHAT_NEN[id], bao_truoc: sk.bao_truoc, keo_theo, do_gia };
  }
  return { bien_dong_hang, the_tin, minigame: soMinigameBK() };
}
