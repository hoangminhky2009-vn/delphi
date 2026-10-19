/**
 * CỔNG CỬA TIÊU T — bước B2 của `docs/thiet-ke-de-xuat/kinh-te/
 * kien-truc-ky-thuat.md` §9. Tầng T0: hàm thuần, không I/O.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VÌ SAO NÂNG MỘT ĐIỀU KIỆN CỦA GACHA THÀNH LUẬT CỦA CẢ HỌ CỬA
 *
 * D245 chẩn đoán rằng trợ cấp đang chảy thẳng vào lò đốt gacha (550 → quay →
 * 450 → dưới ngưỡng → xin trợ cấp → quay tiếp). **Chẩn đoán đó SAI với code**,
 * và D246 §10.2 đã đính chính bằng ba dòng cụ thể: cổng ở `shop_kho.ts` đòi
 * *số dư CÒN LẠI* ≥ ngưỡng, nên phải có ≥600 T mới quay được và quay xong vẫn
 * còn ≥500 T. Vòng lặp đó không tồn tại.
 *
 * ⚠ NHƯNG MỐI NGUY LÀ THẬT, CHỈ CHƯA TỚI. Cổng ấy nằm trong `shop_kho.ts` và
 * **chỉ gacha đi qua**. Mỗi cửa tiêu T mới — mua ở AMM, vé đấu giá, phí giao
 * dịch, khoá T cho lệnh đặt mua — là một đường mới xuống dưới ngưỡng, và không
 * có gì trong repo ép cửa mới mang theo cổng. **Chính cái chợ sắp xây sẽ mở
 * đúng cái ống dẫn mà D245 tưởng đang mở.**
 *
 * Nên B2 không sửa hành vi nào cả. Nó làm đúng hai việc:
 *   1. Đưa cổng ra một chỗ, đặt tên theo HỌ CỬA chứ không theo gacha.
 *   2. Dựng `tests/cua_tieu_t.test.ts` — bài quét mã nguồn khiến **một cửa tiêu
 *      T mới KHÔNG THỂ ra đời im lặng**: thêm một tệp ghi `wallet_ledger` mà
 *      chưa khai vào sổ đăng ký thì test đỏ.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TIÊU ≠ ĐẶT CƯỢC — ranh này quyết định cổng áp vào đâu
 *
 * Cổng KHÔNG áp cho tiền đặt cược. Cược có thể trả lại (payout/refund) và đã có
 * luật riêng của nó: trần 20%/kèo (A5.3). Áp cổng lên cược là chặn đúng sản
 * phẩm lõi vì một lý do thuộc về cosmetic.
 *
 * Cổng áp cho **chi tiêu KHÔNG HOÀN**: đốt gacha, mua đứt, phí. Đó là những
 * đồng T rời ví và không có đường quay lại — và chỉ những đồng đó mới đẩy được
 * một người xuống dưới lưới an toàn.
 */
import { ECONOMY } from '../../config/economy.js';

/**
 * Sau khi chi, người chơi phải còn TRÊN ngưỡng trợ cấp.
 *
 * ⚠ Tham số đầu là **KHẢ DỤNG**, không phải `bankroll`. Hôm nay hai thứ đó bằng
 * nhau vì chưa có khoá T (`khoa_t` ra đời ở bước B10). Khi có rồi thì
 * `kha_dung = bankroll − Σ khoá đang giữ`, và caller phải truyền khả dụng —
 * nếu truyền bankroll thì khoá sạch ví là lách được cổng
 * (`kien-truc-ky-thuat.md` §7.4). Đặt tên tham số là `khaDung` ngay từ bây giờ
 * để cái sai đó không viết ra được mà trông vẫn hợp lý.
 */
export function conTrenLuoiSauKhiChi(khaDung: bigint, chi: bigint): boolean {
  if (khaDung < 0n) throw new Error(`khả dụng âm: ${khaDung}`);
  if (chi < 0n) throw new Error(`chi âm: ${chi}`);
  return khaDung - chi >= BigInt(ECONOMY.SUBSIDY_THRESHOLD);
}

/**
 * Câu từ chối dùng chung — MỘT nguồn cho mọi cửa tiêu T (D61).
 *
 * ⚠ D26 ("server trả ID + SỐ, chữ ở client") KHÔNG bị vi phạm ở đây, nhưng phải
 * nói rõ vì trông thì giống: phần máy đọc là **mã lỗi** (`von_qua_thap`) cộng
 * hai con số; chuỗi này là văn bản dự phòng cho log và cho client chưa dịch —
 * đúng nếp `ShopError` đang dùng. Client có từ điển thì hiện chữ của nó.
 */
export function lyDoTuChoiTieuT(chi: bigint): string {
  return `Cần số dư còn lại trên ${ECONOMY.SUBSIDY_THRESHOLD} T sau khi trừ ${chi} T `
    + '— vốn dự báo không phải thứ để đổi lấy ngoại hình.';
}

/**
 * SỔ ĐĂNG KÝ CỬA CHẠM VÍ — nguồn chân lý của bài quét `tests/cua_tieu_t.test.ts`.
 *
 * Mỗi tệp `server/` có câu `INSERT INTO wallet_ledger` PHẢI có một dòng ở đây.
 * Thêm tệp mà quên khai ⇒ test đỏ, và đó chính là mục đích: một cửa tiêu T mới
 * không ra đời im lặng được.
 *
 * `canCong` = cửa này chi KHÔNG HOÀN nên phải qua `conTrenLuoiSauKhiChi`.
 * `false` thì **bắt buộc có `viSao`** — miễn trừ phải là một câu người ta đọc
 * được, không phải một ô để trống.
 */
export interface CuaChamVi {
  tep: string;
  canCong: boolean;
  viSao: string;
}

/**
 * Tệp mà bài quét CỐ Ý bỏ qua, kèm lý do. Danh sách này phải NGẮN và mỗi dòng
 * phải tự bào chữa được — một danh sách miễn trừ dài là một hàng rào sắp mục.
 */
export const QUET_BO_QUA: readonly { tep: string; viSao: string }[] = [
  {
    tep: 'server/kinh_te/cua_tieu.ts',
    viSao: 'Chính là sổ đăng ký. Văn xuôi ở đây có nhắc câu SQL để giải thích bài '
      + 'quét, nên máy quét bắt được chính tài liệu của nó — không phải một cửa.',
  },
];

export const SO_DANG_KY_CUA_CHAM_VI: readonly CuaChamVi[] = [
  {
    tep: 'server/shop_kho.ts',
    canCong: true,
    viSao: 'Đốt gacha — chi KHÔNG hoàn, đúng họ cửa cổng sinh ra để canh.',
  },
  {
    tep: 'server/markets.ts',
    canCong: false,
    viSao: 'Đặt/điều chỉnh cược. Tiền còn đường về (payout/refund) và đã có luật '
      + 'riêng: trần 20%/kèo (A5.3). Áp cổng ở đây là chặn sản phẩm lõi vì một '
      + 'lý do thuộc về cosmetic.',
  },
  {
    tep: 'server/resolve.ts',
    canCong: false,
    viSao: 'Chia thưởng và hoàn cược — chỉ CỘNG vào ví, không phải cửa tiêu.',
  },
  {
    tep: 'server/subsidy.ts',
    canCong: false,
    viSao: 'Phát trợ cấp — chính là cái lưới mà cổng dựng lên để bảo vệ.',
  },
  {
    tep: 'server/qua_beta.ts',
    canCong: false,
    viSao: 'Quà tri ân mùa beta (D68b) — chỉ CỘNG.',
  },
  {
    tep: 'server/cho.ts',
    canCong: true,
    viSao: 'HAI CHIỀU, HAI LUẬT, MỘT TỆP. Chiều MUA (B7b) là chi KHÔNG HOÀN vào '
      + 'ngoại hình — đúng họ cửa cổng sinh ra để canh, y như gacha, nên nó gọi '
      + 'cổng. Chiều BÁN (B7a) thì KHÔNG, và không phải vì quên: cổng hỏi "chi '
      + 'rồi còn trên lưới trợ cấp không", mà một khoản ĐI VÀO không thể đẩy ai '
      + 'xuống dưới lưới — áp cổng ở đó vừa vô nghĩa vừa CẤM người nghèo bán đồ '
      + 'đúng lúc họ cần bán nhất. `canCong` là cờ theo TỆP nên nó ghi được điều '
      + 'mạnh hơn ("tệp này có một cửa cần cổng"), không ghi được điều yếu hơn.',
  },
  {
    tep: 'server/app.ts',
    canCong: false,
    viSao: 'Vốn khởi điểm lúc đăng ký (`signup_grant`) — chỉ CỘNG, và là bút '
      + 'toán mint duy nhất ngoài genesis (A3.4).',
  },
  {
    tep: 'server/admin_tester.ts',
    canCong: false,
    viSao: 'Cửa admin đưa tài khoản thử về mốc sạch (D52). Người thật không đi '
      + 'qua đây; đây là công cụ, không phải một cửa của người chơi.',
  },
];

/**
 * SỔ ĐĂNG KÝ NƠI ĐƯỢC SO VỚI `SUBSIDY_THRESHOLD`.
 *
 * Ngưỡng trợ cấp bị hỏi bởi HAI câu khác hẳn nhau, và trộn chúng là trộn hai
 * luật: **"anh có ĐƯỢC NHẬN không"** (dưới ngưỡng ⇒ có) và **"anh có ĐƯỢC CHI
 * không"** (còn trên ngưỡng sau khi chi ⇒ có). Cùng một hằng số, ngược chiều so
 * sánh, khác miền áp dụng.
 *
 * Bài quét khoá danh sách này lại để một cửa thứ ba không lặng lẽ chép phép so
 * đó lần nữa (D61/A11.5 — bản sao thứ hai sẽ trôi).
 */
export const SO_DANG_KY_SO_SANH_NGUONG: readonly { tep: string; hoi: string }[] = [
  { tep: 'server/kinh_te/cua_tieu.ts', hoi: 'ĐƯỢC CHI không — còn trên ngưỡng sau khi trừ?' },
  { tep: 'server/subsidy.ts', hoi: 'ĐƯỢC NHẬN không — đang dưới ngưỡng?' },
];
