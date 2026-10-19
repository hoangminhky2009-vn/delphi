/**
 * NGÂN HÀNG ĐỀ BUỔI ĐO (D328 đo · D329 dùng). Bàn loại `buoi_do` chỉ nhận `de_id` trỏ vào bảng này.
 *
 * ⏳ PLAYTEST-TUNE — hai đề dưới là SỐ ĐO của `scripts/do_phan_hoa_de.ts` (bảng đầy đủ + cảnh báo thước
 * phân hoá yếu: `docs/buoi-do/ngan-hang-de.md`). Agent không chọn đề thay founder (A8.2): đây là cặp
 * đầu tiên cùng bộ chữ ký trong bảng, chờ chốt hoặc thay.
 *
 * ⚠⚠ SERVER KHÔNG NHẬN SEED TUỲ Ý cho bàn buổi đo — cùng luật `MAN_TAP_SEED`: seed tự do là farm được
 * một đề đã biết trước, và buổi đo lại mất nghĩa nếu người ta tập trước đúng đề ấy.
 * ⚠⚠ `balance_version` GHIM THEO ĐỀ và ghi vào bàn lúc tạo: đề phải bất biến giữa buổi 1 và buổi đo lại.
 * Lật `HOLDEM_BALANCE_VERSION` không được đổi đề đang dùng. Đổi đề = thêm đề mới, không sửa đề cũ —
 * bàn đã tạo trỏ `de_id` vào đây, sửa tại chỗ là đổi quá khứ của bàn ấy.
 */
export interface DeBuoiDo {
  id: string;
  seed: number;
  /** 12 · 16 — D437: đề luật v55 là bàn 16 (`chiBan16`). */
  so_o: 12 | 16;
  balance_version: string;
  /** Mặt sự kiện THẬT của đề, lúc đo (`soLienHe`). Bài canh tính lại để bắt cú trôi. */
  chu_ky: readonly string[];
  ghi_chu: string;
  /**
   * D392 — đề THÔI DÙNG: không tạo được bàn mới, không hiện ở màn điều phối. Giữ trong bảng (không
   * xoá, không sửa) vì bàn cũ trỏ `de_id` vào đây. Giá trị = lý do, để người đọc bảng biết vì sao.
   */
  thoi_dung?: string;
}

export const NGAN_HANG_DE: readonly DeBuoiDo[] = [
  {
    id: 'de-a', seed: 3485517718, so_o: 12, balance_version: 'balance-v45-duongcong',
    chu_ky: ['tang_lai_suat'], ghi_chu: '7 ghế · 2 tin giả · σ hạng 1,462 (đo 13/09, 200 seed)',
    thoi_dung: 'D392 — luật v45 (ô ngửa, thiếu bảy bản sửa tiền v46–v52) lệch bàn tập và lời Oracle',
  },
  {
    id: 'de-b', seed: 3006816934, so_o: 12, balance_version: 'balance-v45-duongcong',
    chu_ky: ['tang_lai_suat'], ghi_chu: '8 ghế · 2 tin giả · σ hạng 1,106 (đo 13/09, 200 seed)',
    thoi_dung: 'D392 — như de-a; thêm: ghế người mang vai ĐỘI LÁI (vốn ×3) nên không so được với de-a',
  },
  /*
   * D437 — ĐỀ LUẬT TRẬN THẬT v55 (founder 27/09: buổi đo chạy v55 — *"Deploy. Đủ, delay tối đa 30p"*). Bàn 16 ô (v55 chỉ
   * chơi bàn 16 — `chiBan16`), ghế người CÁ NHÂN. ⏳ PLAYTEST-TUNE — seed ĐẦU bảng đo nhanh 40 seed (60 giây, 16/40 hợp lệ):
   *   npx tsx scripts/do_phan_hoa_de.ts 40 16 --luat=balance-v55-build --vai=ca_nhan --cung-ghe
   * Đứng TRƯỚC đề C/D để màn điều phối bày nó đầu tiên. Chưa có cặp song song cùng chữ ký — mùa này một buổi, không đo
   * lại. ⚠ Bàn tập vẫn v54 (bàn tập v55 chưa có): tester tập ô úp nhưng chưa tập lửa · xu · chợ TÀI/TẬT.
   */
  {
    id: 'de-e', seed: 2802388139, so_o: 16, balance_version: 'balance-v55-build',
    chu_ky: ['tang_lai_suat'],
    ghi_chu: '8 ghế · ghế người cá nhân · 3 tin giả · σ hạng 1,213 (đo 27/09, 40 seed, luật v55 bàn 16)',
  },
  /*
   * D392 — cặp đề CÙNG LUẬT BÀN TẬP (`HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION`, v52): tester tập đúng
   * luật mình sắp được đo. ⏳ PLAYTEST-TUNE như cặp cũ — số đo, không phải quyết định (A8.2):
   *   npx tsx scripts/do_phan_hoa_de.ts 200 12 --luat=balance-v52-dadang --vai=ca_nhan --cung-ghe --ghi
   * (bảng: `docs/buoi-do/ngan-hang-de-v52-dadang.md`). Hai lọc mới so với cặp cũ: ghế người là CÁ NHÂN
   * (vốn 10.000 — cặp cũ để de-b ở vai đội lái ×3) và hai đề CÙNG số ghế (hạng 4/7 và 4/8 không cùng thước).
   */
  {
    id: 'de-c', seed: 1844986183, so_o: 12, balance_version: 'balance-v52-dadang',
    chu_ky: ['ha_lai_suat', 'hack_san'],
    ghi_chu: '7 ghế · ghế người cá nhân · 1 tin giả · σ hạng 0,745 (đo 24/09, 200 seed, luật v52)',
  },
  {
    id: 'de-d', seed: 56528123, so_o: 12, balance_version: 'balance-v52-dadang',
    chu_ky: ['ha_lai_suat', 'hack_san'],
    ghi_chu: '7 ghế · ghế người cá nhân · 1 tin giả · σ hạng 0,373 (đo 24/09, 200 seed, luật v52)',
  },
];

/** D392 — đề còn tạo được bàn mới (màn điều phối chỉ bày những đề này). */
export const DE_DANG_DUNG: readonly DeBuoiDo[] = NGAN_HANG_DE.filter((d) => d.thoi_dung === undefined);

/**
 * Hạn của bàn buổi đo (ngày). ⏳ PLAYTEST-TUNE — một buổi 60 phút cần vài giờ, nhưng buổi làm ở lớp
 * có thể kéo sang hôm sau; trần 14 ngày để một mã buổi đo không sống lâu thành một bàn công khai.
 * Người điều phối đóng sớm được (`POST /holdem/ban/:ma/dong`) — trang nhóm chỉ mở SAU khi đóng.
 */
export const BUOI_DO = { HAN_MAC_DINH_NGAY: 7, HAN_TOI_DA_NGAY: 14 } as const;

/** Đề theo id — KỂ CẢ đề thôi dùng (bàn cũ vẫn trỏ vào). Cửa TẠO bàn phải tự kiểm `thoi_dung`. */
export function deCua(id: unknown): DeBuoiDo | null {
  return typeof id === 'string' ? NGAN_HANG_DE.find((d) => d.id === id) ?? null : null;
}
