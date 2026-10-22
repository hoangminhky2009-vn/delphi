# Rules — the ten invariants of the system

Ten things no code path may break — among them: pool sizes stay hidden until a user’s first bet, the resolution source is published before a market opens, the `events` table is append-only, tokens are never minted as prizes, and the betting token and quest points can never be exchanged. When the code and these rules disagree, the code is changed.

*The document below is in Vietnamese, the language of the project.*

## A3. Mười luật bất biến của hệ thống

1. **Ẩn pool trước lần đặt đầu.** User CHƯA đặt kèo nào ở kèo X thì không
   được thấy phân bố cược các cửa của kèo X — chỉ thấy tổng số người tham gia
   + tổng volume. Enforce ở TẦNG API/DB (response không chứa trường phân bố),
   không phải giấu bằng UI. Sau lần đặt đầu → thấy phân bố % + tỷ lệ ăn ngụ ý.
   Khoảnh khắc thấy lần đầu phải ghi event `pool_reveal`.
2. **Resolution là thiêng liêng.** Nguồn resolve công bố TRƯỚC khi mở kèo,
   ghi ngay trên kèo. Số công bố LẦN ĐẦU của nguồn là chung thẩm. Nguồn không
   công bố trong 7 ngày sau hạn → tự hủy kèo, hoàn 100%. Trả thưởng đúng hẹn.
3. **Events là append-only, bất biến.** Bảng `events` không có UPDATE/DELETE.
   `state_snapshot_json` lưu đúng những gì user NHÌN THẤY tại khoảnh khắc
   hành động (null nếu pool chưa reveal với user đó).
4. **Không bao giờ mint token T làm giải thưởng.** Ngoại lệ duy nhất: bút toán
   `genesis_grant` cấp vốn Kho bạc MỘT LẦN khi khởi tạo hệ thống (D10, 17/07/2026).
   Mọi khoản chi (trợ cấp, sự kiện) rút từ Kho bạc (nạp bởi genesis một lần +
   2% rake). Rake 5% = 3% đốt + 2% Kho bạc. Kho bạc KHÔNG bao giờ âm
   (CHECK ở tầng DB) — chi vượt quỹ phải fail rõ ràng.
5. **Tường lửa T↔Q vĩnh viễn.** Token cược (T) và điểm quest (Q) không có
   bất kỳ đường quy đổi nào, ở mức schema lẫn code. (v0.1 chưa dùng Q nhưng
   trường đã tồn tại — cấm viết code chuyển đổi.)
6. **Seed thanh khoản chia đều tuyệt đối các cửa.** Cấm seed lệch cửa.
   Seed gắn cờ `is_seed`, loại khỏi mọi thống kê index và số người tham gia,
   hiển thị minh bạch cho user, phần thắng của seed quay về Kho bạc.
7. **Cấm chủ đề kèo: thể thao, chính trị, đời tư người nổi tiếng.** Chỉ kèo
   kinh tế/đời sống có nguồn resolve chính thức công khai.
8. **Rank = Brier tính RIÊNG từng pool**, lưu từ ngày 1 nhưng v0.1 KHÔNG
   hiển thị cho user. Lịch sử Brier không bao giờ xóa.
9. **Không trò thuần may rủi, không mua lợi thế cược bằng tiền/token.**
10. **Mọi thay đổi số dư đi qua ledger** (bút toán ghi lý do), số dư ví là
    kết quả suy ra được — có thể recompute từ ledger để audit.
