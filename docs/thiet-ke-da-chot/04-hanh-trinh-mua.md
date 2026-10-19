# 04 — HÀNH TRÌNH MÙA (battle pass + nhiệm vụ TRANG RIÊNG) + SỬA CHUỖI COSMETIC

**Lệnh founder 01/08 (nguyên văn):** *"Làm lại phần battle pass và nhiệm vụ đi
cho nó giống các game như tft hay LOL kiểu làm thành 1 trang riêng ấy. Đồng
thời kiểm tra lại phần avatar, shop, custom avatar và vật phẩm vì hiện tại t
chưa dùng được."*

## Khảo sát mở màn (01/08, cuối phiên D43 — CHƯA THI CÔNG)

- Cờ `COSMETICS: true`, `GACHA: true` (config/sandbox.ts) — KHÔNG phải bệnh cờ.
- Server ĐÃ CÓ: `server/avatar.ts` · `server/nhiem_vu.ts` · `server/shop.ts` ·
  `server/shop_kho.ts` (+ web `Profile.tsx`, `Shop.tsx`, module nhiệm vụ PHASE C).
- Routes: `/shop`, `/ho-so` có; **KHÔNG có trang nhiệm vụ/BP riêng** — đang vùi
  trong Hub/Profile. ⇒ Nghi bệnh tầng NỐI (route/flow/data rỗng), đúng khuôn
  "cơ chế trang trí" đã dính 12 lần — phải audit BẰNG TRÌNH DUYỆT THẬT từng bước.

## Kế hoạch thi công (phiên sau — theo thứ tự)

1. **AUDIT CHUỖI SỐNG bằng browser thật** (không đọc code suông): đăng nhập →
   chọn avatar → vào Profile bấm đổi avatar → mở Shop mua nền/sticker → dán
   sticker (custom) → gacha. Ghi TỪNG bước gãy với ảnh + nguyên nhân file:dòng.
   Nghi vấn sẵn có: nguồn Q chưa chảy (nhiệm vụ chưa trả thưởng?) ⇒ shop chết
   đói; sticker UI thiếu scale/rotate (backlog founder); avatar click-to-change.
2. **TRANG `/hanh-trinh`** (kiểu TFT/LOL, một trang riêng + shortcut toolbar):
   · Track mùa ngang: mốc thưởng Q/cosmetic, mốc **Áo Trùm Đầu** (D41 — phần
     thưởng lộ trình mùa); thanh tiến độ + cấp hiện tại.
   · Nhiệm vụ NGÀY/TUẦN quanh Alpha Draft (chơi X trận, sống sót tới chốt,
     thoát mã trước khi nổ, đọc đúng kỳ họp...) — nguồn tiến độ từ `events`
     (hd_chot_phien/hd_cam_ket đã giàu field D43). Check-in trợ cấp gộp vào đây
     (backlog: check-in auto-hide).
   · D26 từ vựng quỹ; D25/R1 hiện vô điều kiện; A7 log đủ.
3. **Sửa từng flow gãy** tìm ra ở (1); GIA_BAN_SAO_THEM vẫn ⭐200–300 CHỜ
   FOUNDER (A8.2 — hỏi khi shop sống lại).

## Ràng buộc kế thừa

D16 (kinh tế Q khép kín, guardrail sink/phát 0,82) · D36/D41/D42 (avatar 3 lá
tặng + trùm đầu BP + sticker dán-là-tiêu + bán nền trắng) · quest_points đang
đóng băng bằng trigger (nới CÓ CHỦ ĐÍCH bằng migration khi bật nguồn Q — ghi
17/07). Bước 7 D43 (v16 sau cổng) KHÔNG chặn việc này — hai nhánh độc lập.
