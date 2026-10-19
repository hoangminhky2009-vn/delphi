# THIẾT KẾ ĐÃ CHỐT — viết TRƯỚC khi code, không viết sau

**Founder lập thư mục này 27/07:** *"thêm một thư mục để ghi rõ bản thiết kế đã chốt
và sửa đổi trước khi làm."*

## Vì sao nó tồn tại — nguyên nhân cụ thể, không phải quy trình cho đẹp

Ngày 27/07 phát hiện: **Alpha Draft chưa bao giờ có bản thiết kế.** D24 (19/07) tự ghi
*"Khối luật đầy đủ nằm trong tài liệu pivot"* — **tài liệu đó không tồn tại trong repo**.
`docs/` có 27 file, không file nào nhắc "Alpha Draft"; tám file nhắc "Market Hold'em"
đều là UI · motion · kinh tế · nhiệm vụ — **không cái nào là luật chơi**. Cái gần nhất,
`design_sandbox_arena_v2.1.md`, là bản TRƯỚC pivot mà chính D24 khai tử.

⇒ Luật nằm rải ở **19 mục nhật ký D24→D42** và trong code. Không chỗ nào trả lời được
*"một vòng diễn ra thế nào, người chơi bấm gì, mỗi thứ giá bao nhiêu"*.

**Hậu quả đo được, không phải lo xa** — bốn thứ hỏng trong một ngày, cùng một gốc:
- Bảng QUẢN TRỊ VỐN đổ nguyên bảng giá cho nút **không bấm được**.
- Agent đề xuất "thẻ áp toàn danh mục" — quay về lối nghĩ trước D33, vì không biết
  `pham_vi` đã khai phạm vi từng lá.
- Agent kết luận sai rằng Đa Dạng Hoá mất đặc quyền trong chợ liên tục.
- Ba lần đoán sai nguyên nhân một test đỏ, phải bắt thông báo thật mới ra.

Cả bốn là **cùng một bệnh: không có spec thì mọi thay đổi đều là suy đoán về hệ quả.**

## Luật của thư mục này

1. **Chốt xong mới code.** Một thay đổi luật chơi phải có file ở đây trước khi có commit
   code. Không có file = chưa được làm.
2. **Mỗi file là LUẬT ĐANG CÓ HIỆU LỰC**, không phải lịch sử tranh luận. Lịch sử ở
   `CLAUDE.md` (Nhật ký quyết định) và ở `docs/design_*.md`.
3. **SỬA THÌ GHI RÕ ĐÃ SỬA GÌ**, không viết đè im lặng. Mỗi file có mục "ĐÃ SỬA" ở
   cuối: ngày · đổi gì · vì sao · ai quyết.
4. **Mỗi luật phải chỉ được ra CODE thi hành nó** (`file:dòng`). Luật không có địa chỉ
   trong code là luật chưa được làm — và phải ghi thẳng là CHƯA LÀM.
5. **Số kinh tế không tự đặt (A8.2).** Chưa có số thì ghi `CHỜ FOUNDER`, không điền tạm.

## Danh mục

| File | Nội dung | Trạng thái |
|---|---|---|
| `01-alpha-draft-vong-choi.md` | Vòng chơi: chọn mã tự do + phân bổ vốn, bỏ pha cược, nút BỎ = thoát hàng | **ĐÃ CHỐT — đang thi công** |
| `02-the-dau-tu-dai-han.md` | Thẻ Đầu Tư Dài Hạn: khoá vị thế N vòng, đổi tự do lấy miễn trượt giá + giảm sốc xấu + khuếch đại sốc tốt | **ĐÃ CHỐT — chờ 01 xong trước** |
| `03-chu-ky-tin-dung.md` | Thẻ sự kiện = máy trạng thái chu kỳ tín dụng: lịch chính sách, sức căng ẩn, 5 mặt đuôi; 7 bước × 10 gate | **ĐÃ CHỐT — bước 1 xong 01/08, bước 2 chờ Q1, bước 3+ chờ Kelly** |
| `07-ban-cuoc-shop.md` | Shop trận nav = BÀN CƯỢC: hàng chip dán đáy · cầm rồi chạm (không kéo) · cọc chip trên lá · ALL-IN đặc biệt khi bấm · TAY (Đòn Bẩy cầm-chạm, khống) · LẶP · telemetry nhãn cách nhập | **ĐÃ CHỐT 16/08 ("làm y nguyên") — ĐÃ THI CÔNG cùng ngày, prod** |
| `08-ban-chung-theo-seed.md` | Mời bạn kiểu TFT không cần online cùng lúc: mã ↔ seed, mỗi người một trận cùng bàn, bảng ĐỘI ở màn kết (A3.1), nền cho kèo T (D95) | **THI CÔNG bản A 16/08 — prod** |

## Ai làm

**Không dùng agent song song.** Founder 27/07: *"cho agent làm song song toàn mất
context và code n** si."* Repo này có mật độ ràng buộc ngầm quá cao (19 mục nhật ký chỉ
riêng Alpha Draft, A1–A8, cổng `balance_version`, chín cái bẫy đã ghi) — agent chỉ nhận
được bản tóm tắt trong brief nên suy sai những thứ chỉ đọc code mới biết. Làm tuần tự,
chia thành nhiều lượt commit nhỏ, mỗi lượt chạy test và báo.
