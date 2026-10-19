/**
 * CỜ CỦA NỀN KINH TẾ — một chỗ cho cả mười hai bước thi công.
 *
 * Bảng đầy đủ (cờ nào bật khi nào, đo được) ở
 * `docs/thiet-ke-de-xuat/kinh-te/kien-truc-ky-thuat.md` §8. File này chỉ giữ
 * những cờ ĐÃ CÓ CODE đằng sau — khai một cờ chưa có gì để bật là dựng một công
 * tắc không nối vào đâu, và công tắc kiểu đó sẽ bị ai đó bật rồi tưởng đã xong.
 *
 * ⚠ MẶC ĐỊNH TẤT CẢ LÀ `false`, VÀ ĐÓ LÀ MỘT LUẬT CHỨ KHÔNG PHẢI SỰ THẬN TRỌNG:
 * cả loạt bước này đổi **nguồn chân lý** của tài sản người chơi. Khuôn ba nhịp
 * (di trú → ghi song song → chuyển đọc) chỉ an toàn khi **tắt cờ là quay về
 * nguyên trạng, không mất dữ liệu**. Một cờ mặc định `true` làm mất đúng tính
 * chất đó.
 */

export const CO_KINH_TE = {
  /**
   * **GHI SONG SONG vào sổ vật** (bước B1, nhịp 2).
   *
   * Bật ⇒ mọi đường đúc/tiêu vật phẩm ghi CẢ `vat_pham_ban_the` LẪN hai bảng
   * đọc nhanh (`user_cosmetics`, `kho_sticker`), trong **cùng một transaction**.
   * Tắt ⇒ hành vi y hệt trước khi có sổ.
   *
   * ⚠ Cờ này KHÔNG đổi một dòng đường ĐỌC nào. Đọc vẫn lấy từ hai bảng cũ cho
   * tới bước B4 — và đó là chủ ý: giữa hai bước, hỏng thì tắt cờ là xong.
   *
   * ✔ **BẬT 06/09/2026** (founder: *"Chạy, bật cờ, nạp"*) sau khi 0057 chạy và
   * `audit:cung` cân trên DB dev. Bật cờ này cũng mở cửa bán (`server/cho.ts`),
   * vì cửa đó bán một `ban_the_id` nên nó đứng trên sổ vật.
   */
  CHO_SO_VAT: true,

  /**
   * **CHUYỂN ĐƯỜNG ĐỌC** sang sổ vật (bước B4). Chưa có code.
   *
   * Điều kiện bật: `audit:cung` cân **liên tục N ngày** (N founder chốt). Bật
   * sớm là đặt cược rằng ghi song song không lệch — mà cả lý do có bước B1
   * riêng là vì ta chưa biết nó có lệch không.
   */
  CHO_SO_VAT_DOC: false,
} as const;

export type TenCoKinhTe = keyof typeof CO_KINH_TE;
